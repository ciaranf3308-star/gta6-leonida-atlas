import { describe, expect, it, vi } from 'vitest';
import type { LayerDefinition, Place } from '../../src/domain/types';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import { GANG_OPERATIONS, GANG_OP_PLACES } from '../../src/data/gang-operations';
import { shortVerdict } from '../../src/features/ask/cards';
import {
  asksForGangOps,
  cardSetForQuestion,
  isNightlifePlace,
  nightlifeTagsForQuestion,
  retrieveForAsk,
  layersRequestedByQuestion,
} from '../../src/features/ask/retrieval';
import {
  askOpenAi,
  buildAskSystemPrompt,
  formatRecordsForPrompt,
  parsePlaceMentions,
  sanitizeAiNote,
} from '../../src/features/ask/openai';

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'title' | 'layerId'>): Place {
  return {
    description: '',
    category: 'food-drink',
    position: { x: 0, y: 0 },
    tags: [],
    region: '',
    source: { title: 'test', url: '' },
    evidence: 'approximate',
    ...overrides,
  };
}

const layers = (): LayerDefinition[] =>
  DEFAULT_LAYERS.map((layer) => ({ ...layer, visible: false }));

/**
 * Fixture 'gang-op' layer (v0.32 gang-op follow-up, lane 2): the
 * routing tests are self-contained and pass on their own, whether or
 * not lane 1's definition has landed in DEFAULT_LAYERS yet. The
 * real-layer integration is pinned separately, against
 * DEFAULT_LAYERS itself.
 */
const GANG_OP_LAYER: LayerDefinition = {
  id: 'gang-op',
  name: 'Gang operations',
  description:
    'Illegal operations from the in-game Gangs tracker — area-known only.',
  category: 'activity',
  mapIndex: 'robberies',
  visible: false,
  order: 89,
  source: 'test',
  style: { color: '#ff8f8f', radius: 7 },
  icon: 'users',
  interactive: true,
};

const layersWithGangOp = (): LayerDefinition[] => [...layers(), GANG_OP_LAYER];

const FIXTURES: Place[] = [
  place({
    id: 'gym:dynamix',
    title: 'Dynamix Fitness',
    layerId: 'gyms',
    position: { x: -366, y: 1514 },
    region: 'Vice City',
    tags: ['gym'],
  }),
  place({
    id: 'gym:north-gym',
    title: 'North Gym',
    layerId: 'gyms',
    position: { x: -5000, y: 6000 },
    region: 'Mount Kalaga',
    tags: ['gym'],
  }),
  place({
    id: 'gym:muscle-sands',
    title: 'Muscle Sands',
    layerId: 'equipment',
    position: { x: 2019, y: 407 },
    region: 'Ocean Beach',
    tags: ['gym', 'free', 'outdoor'],
  }),
  place({
    id: 'L1001',
    title: 'Corner Store, Capri',
    layerId: 'lootable',
    position: { x: 100, y: 100 },
    region: 'Capri',
    tags: ['enterable', 'retail'],
  }),
  place({
    id: 'L1002',
    title: 'Liquor Store, Capri',
    layerId: 'lootable',
    position: { x: 200, y: 120 },
    region: 'Capri',
    tags: ['enterable', '#liquor'],
  }),
  place({
    id: 'L1003',
    title: 'Grocery, Vice City',
    layerId: 'lootable',
    position: { x: -500, y: -500 },
    region: 'Vice City',
    tags: ['enterable', '#supermarket'],
  }),
  // A card pinned at the same building as a lootable place — the leak test.
  place({
    id: 'card:vicki',
    title: 'Vicki — Delights Dancers',
    layerId: 'cards:delights-dancers',
    position: { x: 100, y: 100 },
    region: 'Corner Store, Capri',
    tags: ['collectible', 'card'],
  }),
  // The set's second card, from the Loot Map collectibles bucket — a
  // dancer card tagged with its set (reported 2026-11-26: "cards for
  // delight dancers near Capri" answered with a meditation).
  place({
    id: 'loot:harley-card',
    title: 'Harley dancer card',
    layerId: 'loot-collectibles',
    position: { x: -6360, y: 3590 },
    region: 'Port Gellhorn',
    tags: ['collectible', 'loot-map', 'trading-card', 'delights-dancers'],
  }),
  // A Jack of Hearts card — the bare-name regression needs a second
  // set in the fixtures, so "Jack of Hearts" (no "Dancers", no word
  // "card") has something to return.
  place({
    id: 'card:jada-gold',
    title: 'Jada Watts (gold) — Jack of Hearts Dancers',
    layerId: 'cards:jack-of-hearts-dancers',
    position: { x: -5256, y: 3079 },
    region: 'Kelly County',
    tags: ['collectible', 'card'],
  }),
  // A Vice City Flamingos card — "flamingos" (bare set name) must
  // return the set's cards, not the animal flamingos.
  place({
    id: 'card:ulysses',
    title: 'Ulysses Whitlock (silver) — Vice City Flamingos',
    layerId: 'cards:vice-city-flamingos',
    position: { x: -758, y: -1258 },
    region: 'Tequesta, Vice City',
    tags: ['collectible', 'card'],
  }),
  // A Nine1Nine Dancers card — NINE1NINE is both the nightclub and
  // the set, so the bare name is genuinely ambiguous; the Delights
  // ruling (bare set name → the set's cards) generalises to it.
  place({
    id: 'card:nine-talia',
    title: 'Talia — Nine1Nine Dancers',
    layerId: 'cards:nine1nine-dancers',
    position: { x: -700, y: 450 },
    region: 'Downtown, Vice City',
    tags: ['collectible', 'card'],
  }),
  // A meditation in Capri, same bucket as the dancer card — a card
  // question must never answer with it.
  place({
    id: 'loot:meditation-capri',
    title: 'Smooth Sand meditation',
    layerId: 'loot-collectibles',
    position: { x: -6800, y: 200 },
    region: 'Capri',
    tags: ['collectible', 'loot-map', 'meditation'],
  }),
  place({
    id: 'L2001',
    title: 'Starlet Motel',
    layerId: 'interiors',
    position: { x: -5354, y: 3461 },
    region: 'Kelly County',
    tags: ['enterable', 'hotel'],
  }),
  // Breakable homes: a Capri rob-house candidate and one in Vice City.
  place({
    id: 'L3001',
    title: '?, Capri',
    layerId: 'breakable',
    position: { x: -6800, y: 200 },
    region: 'Capri',
    tags: ['enterable', 'residential'],
  }),
  place({
    id: 'L3002',
    title: 'Venture Apts North, Rockridge, Vice City',
    layerId: 'breakable',
    position: { x: -1325, y: 713 },
    region: 'Rockridge, Vice City',
    tags: ['enterable', 'residential'],
  }),
  // Nightlife (reported 2026-11-25: "Nightclub in vice city" returned
  // nothing, though both clubs carry #nightclub in the data). Both sit
  // in Food & Drink — the game's own filing for bars-and-clubs venues.
  place({
    id: 'L190',
    title: 'NINE1NINE, Downtown, Vice City',
    layerId: 'shops-food',
    position: { x: -671, y: 468 },
    region: 'Downtown, Vice City',
    tags: ['#nightclub', 'enterable', 'leisure'],
  }),
  place({
    id: 'L556',
    title: 'The Vault, Downtown, Vice City',
    layerId: 'shops-food',
    position: { x: -774, y: 462 },
    region: 'Downtown, Vice City',
    tags: ['#nightclub', 'enterable', 'leisure'],
  }),
  // VYB is a real nightclub (LIV Nightclub Miami) with no verified
  // in-game position — it must never appear in a Vice City answer.
  place({
    id: 'L1453',
    title: 'VYB, Vice Beach',
    layerId: 'shops-food',
    position: null,
    region: 'Vice Beach',
    tags: [],
  }),
  // A Food & Drink place that is NOT nightlife — the narrowing must
  // keep it out of a nightclub answer.
  place({
    id: 'L4001',
    title: 'Seaside Grill, Ocean Beach, Vice City',
    layerId: 'shops-food',
    position: { x: -700, y: 300 },
    region: 'Ocean Beach, Vice City',
    tags: ['restaurant', 'enterable'],
  }),
];

describe('Ask Nylah — the spoiler rule', () => {
  it('asking for a gym opts the gym layer in even when it is off', () => {
    const result = retrieveForAsk({
      question: 'I need to hit some gains — any ideas?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toContain('gyms');
    expect(result.records.map((p) => p.id)).toContain('gym:dynamix');
    // "gains" asks for a member gym — the free equipment (Muscle Sands)
    // is a different question and stays out of a gym answer.
    expect(result.records.map((p) => p.id)).not.toContain('gym:muscle-sands');
  });

  it('asking for workout equipment opts the equipment layer in, not the gyms', () => {
    const result = retrieveForAsk({
      question: 'Where is there workout equipment nearby?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toEqual(['equipment']);
    expect(result.records.map((p) => p.id)).toContain('gym:muscle-sands');
    expect(result.records.map((p) => p.id)).not.toContain('gym:dynamix');
  });

  it('a nightclub question returns the nightclubs — not the nearest shops', () => {
    // Reported 2026-11-25: "Nightclub in vice city" answered "Nothing
    // in the map data", though NINE1NINE and The Vault both carry
    // #nightclub. No nightlife word reached any layer before this.
    expect(layersRequestedByQuestion('Nightclub in vice city', layers())).toEqual(['shops-food']);
    expect(nightlifeTagsForQuestion('Nightclub in vice city')).toEqual(['#nightclub']);
    const result = retrieveForAsk({
      question: 'Nightclub in vice city',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toEqual(['shops-food']);
    expect(result.records.map((p) => p.id).sort()).toEqual(['L190', 'L556']);
    // The restaurant next door is Food & Drink too — the narrowing
    // keeps it out. VYB has no verified position and is in Vice
    // Beach, not Vice City — it stays out as well.
    expect(result.records.map((p) => p.id)).not.toContain('L4001');
    expect(result.records.map((p) => p.id)).not.toContain('L1453');
  });

  it('a bar question asks for Food & Drink and narrows to bars', () => {
    expect(layersRequestedByQuestion('Where is the nearest bar?', layers())).toEqual([
      'shops-food',
    ]);
    expect(nightlifeTagsForQuestion('Where is the nearest bar?')).toEqual(['#bar']);
    // A bare "club" means the whole nightlife set.
    expect(nightlifeTagsForQuestion('Any clubs open tonight?').sort()).toEqual([
      '#bar',
      '#nightclub',
      '#stripclub',
    ]);
  });

  it('isNightlifePlace needs the venue asked for, from any evidence', () => {
    const club = FIXTURES.find((p) => p.id === 'L190')!;
    const grill = FIXTURES.find((p) => p.id === 'L4001')!;
    // Source tag: a nightclub answers a nightclub ask, not a bar ask.
    expect(isNightlifePlace(club, ['#nightclub'], undefined, undefined)).toBe(true);
    expect(isNightlifePlace(club, ['#bar'], undefined, undefined)).toBe(false);
    expect(isNightlifePlace(grill, ['#nightclub'], undefined, undefined)).toBe(false);
    // The user's own tag: "nightclub" on a place counts; "barbecue" is not a bar.
    expect(isNightlifePlace(grill, ['#nightclub'], ['nightclub'], undefined)).toBe(true);
    expect(isNightlifePlace(grill, ['#bar'], ['barbecue joint'], undefined)).toBe(false);
    // A confident AI "bar" type counts for a bar ask.
    expect(
      isNightlifePlace(grill, ['#bar'], undefined, {
        placeId: 'L4001',
        aiCategory: 'bar',
        confidence: 0.9,
        reason: 'test',
        model: 'test',
        indexedAt: '2026-11-25',
        status: 'suggested',
      }),
    ).toBe(true);
  });

  it('a named area scopes the answer to that area', () => {
    const result = retrieveForAsk({
      question: "I'm up north beside Mount Kalaga, need to hit some gains — any ideas?",
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.areaLabel).toBe('mount kalaga');
    expect(result.records.map((p) => p.id)).toEqual(['gym:north-gym']);
  });

  it('a gyms-north question returns only the northern gyms', () => {
    const result = retrieveForAsk({
      question: 'Need to hit some gains up north — where?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.areaLabel).toBe('north');
    expect(result.records.map((p) => p.id)).toEqual(['gym:north-gym']);
  });

  it('a burglary question about HOUSES returns breakable homes — never card names', () => {
    const result = retrieveForAsk({
      question:
        'Thinking of hitting some burglaries in Capri — highlight all the houses I can hit tonight.',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    // Houses you can hit are breakable homes, not the lootable SHOPS
    // layer — the split the user asked for ("apartments I can break
    // into" is houses, "rob a store" is shops).
    expect(result.requestedLayerIds).toEqual(['breakable']);
    expect(result.records.map((p) => p.id).sort()).toEqual(['L3001']);
    // The card at the same building is never in the records, so the AI
    // cannot volunteer it — and neither can the result list.
    expect(result.records.map((p) => p.title).join(' ')).not.toMatch(/Vicki|Delights/);
    expect(layersRequestedByQuestion('highlight the houses I can hit tonight', layers())).toEqual([
      'breakable',
    ]);
    // The same words about STORES still route to the lootable shops.
    expect(layersRequestedByQuestion('highlight the stores I can hit tonight', layers())).toEqual([
      'lootable',
    ]);
  });

  it('a collectable question with its layer off is still answered — asking opts it in', () => {
    const result = retrieveForAsk({
      question: 'Where is the Vicki card?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toContain('cards:delights-dancers');
    expect(result.records.map((p) => p.id)).toContain('card:vicki');
  });

  it('a card-set question near Capri answers with the set’s cards, never a meditation (reported 2026-11-26)', () => {
    // His exact words: "I need any cards for delight dancers near
    // Capri". Before the fix this answered with the Smooth Sand
    // meditation — the only eligible place with "Capri" in its region —
    // and the summary called it "the nearest card".
    //
    // SET WINS OVER AREA (v0.32 step 7, DESIGN §7.2 normative): the
    // area is a SORT here, never a filter — so BOTH set cards answer,
    // nearest first from the Capri centroid, even though Harley is
    // pinned in Port Gellhorn and Vicki's region is Capri. The old
    // expectation (Vicki only) encoded the area-filter flaw: the
    // filter dropped Harley, and the fix is the point of this lane.
    const result = retrieveForAsk({
      question: 'I need any cards for delight dancers near Capri',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records.map((p) => p.id)).toEqual(['card:vicki', 'loot:harley-card']);
    expect(result.records.map((p) => p.id)).not.toContain('loot:meditation-capri');
    // The noun is "card", never "place", and the verdict is honest
    // about the distance: the set's cards are not near Capri.
    expect(result.proximitySummary).toMatch(/no card near capri/i);
    expect(result.proximitySummary).not.toMatch(/meditation/i);
  });

  it('naming a card set narrows to that set only', () => {
    const result = retrieveForAsk({
      question: 'help me find the Delights Dancers card set',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records.map((p) => p.id)).toEqual(['card:vicki', 'loot:harley-card']);
    expect(result.records.map((p) => p.id)).not.toContain('loot:meditation-capri');
  });

  it('a set question in Port Gellhorn keeps the whole set — set wins over the area filter', () => {
    // "Delights Dancers in Port Gellhorn": the old area filter kept
    // only Harley (region Port Gellhorn) and dropped Vicki — the
    // mirror image of the Capri flaw. Set narrowing beats the area
    // filter in both directions: the area sorts (Harley first, at
    // the Port Gellhorn centroid), it never drops a set item.
    const result = retrieveForAsk({
      question: 'Delights Dancers in Port Gellhorn',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records.map((p) => p.id)).toEqual(['loot:harley-card', 'card:vicki']);
    expect(result.areaMismatch).toBe(false);
  });
});

describe('Ask Nylah — bare names bring their layer into scope (v0.32 step 7)', () => {
  // The live bug (screenshot 2026-11-26 05:13 GMT): "Delight dancers"
  // into Ask with every layer off → "Nothing in the map data for
  // that." The layer gate only fired on the word "card", and set
  // narrowing could only FILTER the eligible layers, never ADD one.
  // The rule now: naming a thing by name alone brings its layer into
  // scope — the answer never depends on the user also saying the
  // category keyword.
  const ask = (question: string) =>
    retrieveForAsk({
      question,
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });

  it('"Delight dancers" (singular, bare) returns the set’s cards', () => {
    expect(cardSetForQuestion('Delight dancers')?.id).toBe('delights-dancers');
    const result = ask('Delight dancers');
    expect(result.requestedLayerIds).toContain('cards:delights-dancers');
    expect(result.requestedLayerIds).toContain('loot-collectibles');
    expect(result.records.map((p) => p.id)).toEqual(['card:vicki', 'loot:harley-card']);
  });

  it('"Delights" (bare set name, one word) returns the set’s cards', () => {
    expect(cardSetForQuestion('Delights')?.id).toBe('delights-dancers');
    const result = ask('Delights');
    expect(result.requestedLayerIds).toContain('cards:delights-dancers');
    expect(result.records.map((p) => p.id)).toEqual(['card:vicki', 'loot:harley-card']);
    expect(result.records.map((p) => p.id)).not.toContain('loot:meditation-capri');
  });

  it('"Jack of Hearts" (bare set name) returns the set’s cards', () => {
    expect(cardSetForQuestion('Jack of Hearts')?.id).toBe('jack-of-hearts-dancers');
    const result = ask('Jack of Hearts');
    expect(result.requestedLayerIds).toContain('cards:jack-of-hearts-dancers');
    expect(result.records.map((p) => p.id)).toEqual(['card:jada-gold']);
  });

  it('"flamingos" (bare set name) returns the set’s cards', () => {
    expect(cardSetForQuestion('flamingos')?.id).toBe('vice-city-flamingos');
    expect(cardSetForQuestion('flamingo')?.id).toBe('vice-city-flamingos');
    const result = ask('flamingos');
    expect(result.requestedLayerIds).toContain('cards:vice-city-flamingos');
    expect(result.records.map((p) => p.id)).toEqual(['card:ulysses']);
  });

  it('"Delights Dancers card set" (the long form) still returns the set’s cards', () => {
    const result = ask('Delights Dancers card set');
    expect(result.records.map((p) => p.id)).toEqual(['card:vicki', 'loot:harley-card']);
  });

  it('a bare name that names no set stays the whole pool — never a guessed set', () => {
    // "dancers" alone is three sets; "jack" alone is a verb as much
    // as a name; "club" alone is nightlife. None of them picks a set.
    expect(cardSetForQuestion('dancers')).toBeNull();
    expect(cardSetForQuestion('jack')).toBeNull();
    expect(cardSetForQuestion('Any clubs open tonight?')).toBeNull();
    // …and the nightlife question still asks for Food & Drink only.
    expect(layersRequestedByQuestion('Any clubs open tonight?', layers())).toEqual([
      'shops-food',
    ]);
    // Two sets named at once is ambiguous, not a coin flip.
    expect(cardSetForQuestion('flamingos and narcos')).toBeNull();
  });

  it('a bare place name brings its layer into scope', () => {
    // "Starlet Motel" with every layer off: the place answers, not
    // "Nothing in the map data". Same class as the bare set name.
    const motel = ask('Starlet Motel');
    expect(motel.requestedLayerIds).toContain('interiors');
    expect(motel.records.map((p) => p.id)).toContain('L2001');
    // …but a question that already names a kind keeps its own scope:
    // "shops near Starlet Motel" is a shops question, and the motel
    // is the measuring point, not a second kind to answer from.
    const shops = ask('shops near Starlet Motel');
    expect(shops.requestedLayerIds).not.toContain('interiors');
  });

  it('a name that is BOTH a place and a set answers with the set — unless a kind is named', () => {
    // NINE1NINE is the nightclub AND the Nine1Nine Dancers set. The
    // bare name follows the "Delights" ruling: the set's cards.
    // (Design conflict, ruled by the Delights precedent — see the
    // set-narrowing comment in retrieval.ts. The club is one kind
    // word away: "NINE1NINE nightclub".)
    const bare = ask('NINE1NINE');
    expect(bare.requestedLayerIds).toContain('cards:nine1nine-dancers');
    expect(bare.records.map((p) => p.id)).toEqual(['card:nine-talia']);
    // With the kind named, the kind wins and the set is not a filter.
    const club = ask('NINE1NINE nightclub');
    expect(club.requestedLayerIds).toContain('shops-food');
    expect(club.records.map((p) => p.id)).toEqual(['L190', 'L556']);
    expect(club.records.map((p) => p.id)).not.toContain('card:nine-talia');
  });

  it('a generic cards question takes trading cards only — a generic collectibles question takes the whole bucket', () => {
    const cards = retrieveForAsk({
      question: 'where are the cards?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(cards.records.map((p) => p.id)).toContain('card:vicki');
    expect(cards.records.map((p) => p.id)).toContain('loot:harley-card');
    expect(cards.records.map((p) => p.id)).not.toContain('loot:meditation-capri');
    const collectibles = retrieveForAsk({
      question: 'where are the collectibles?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(collectibles.records.map((p) => p.id)).toContain('loot:meditation-capri');
  });

  it('a scoped gym question never returns a visible-but-unasked layer', () => {
    const visibleLayers = layers().map((layer) =>
      layer.id === 'interiors' ? { ...layer, visible: true } : layer,
    );
    const result = retrieveForAsk({
      question: 'Where can I train?',
      places: FIXTURES,
      layers: visibleLayers,
      filters: { hideFound: false, remainingOnly: false, countyId: 'kelly' },
    });
    // No gym is in Kelly, so it falls back to the nearest gyms and says so
    // — it must not answer a gym question with a Kelly interior.
    expect(result.areaMismatch).toBe(true);
    // "train" asks for a member gym — never the free equipment layer.
    expect(result.records.every((p) => p.layerId === 'gyms')).toBe(true);
    expect(result.records.map((p) => p.id)).toContain('gym:dynamix');
    expect(result.records.map((p) => p.id)).not.toContain('L2001');
  });

  it('a general question uses visible layers only — hidden layers stay hidden', () => {
    const visibleLayers = layers().map((layer) =>
      layer.id.startsWith('shops-') || layer.id === 'lootable' ? { ...layer, visible: true } : layer,
    );
    const result = retrieveForAsk({
      question: "What's around here?",
      places: FIXTURES,
      layers: visibleLayers,
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toEqual([]);
    expect(result.records.every((p) => ['shops-food', 'lootable', 'my-markers'].includes(p.layerId))).toBe(
      true,
    );
    expect(result.records.map((p) => p.id)).not.toContain('gym:dynamix');
    expect(result.records.map((p) => p.id)).not.toContain('card:vicki');
  });

  it('respects hideFound / remainingOnly', () => {
    const result = retrieveForAsk({
      question: 'Where can I train?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: true, remainingOnly: false, countyId: null },
      visitedIds: ['gym:dynamix', 'gym:muscle-sands'],
    });
    expect(result.records.map((p) => p.id)).toEqual(['gym:north-gym']);
  });

  it('falls back to nearest when the scoped area has nothing, and says so', () => {
    const result = retrieveForAsk({
      question: 'Lootable houses in Lummox County tonight?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    // "Lootable houses" is houses you can loot — breakable homes, not
    // the lootable shops layer.
    expect(result.requestedLayerIds).toEqual(['breakable']);
    expect(result.areaMismatch).toBe(true);
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records.every((p) => p.layerId === 'breakable')).toBe(true);
  });

  it('apartments I can break into in Vice City answers from breakable homes, nearest first', () => {
    const result = retrieveForAsk({
      question: 'What apartments can I break into in Vice City?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toContain('breakable');
    expect(result.records.map((p) => p.id)).toEqual(['L3002']);
    // The answer says the in-game rule — dark blue means you can go in.
    expect(result.proximitySummary).toMatch(/dark blue/);
  });

  it('enterable houses near Capri answers from the tagged houses + Capri rob houses', () => {
    const result = retrieveForAsk({
      question: 'Enterable houses near Capri?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toContain('breakable');
    expect(result.records.map((p) => p.id)).toContain('L3001');
    expect(result.proximitySummary).toMatch(/dark blue/);
  });

  it('trailers near an area answers from breakable homes, and says the list is not exhaustive', () => {
    const result = retrieveForAsk({
      question: 'Trailers near Vice City?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toEqual(['breakable']);
    expect(result.proximitySummary).toMatch(/not every breakable home/);
  });

  it('a user-marked breakable home answers a breakable question; a workout marker does not', () => {
    const marked = place({
      id: 'personal:capri-house',
      title: 'Capri house with a garage',
      layerId: 'my-markers',
      position: { x: -6800, y: 200 },
      region: 'My markers',
      tags: ['breakable', 'house'],
      evidence: 'personal',
      description: 'Safe upstairs, special car in the garage',
    });
    const workout = place({
      id: 'personal:capri-gym',
      title: 'Capri garage gym',
      layerId: 'my-markers',
      position: { x: -6800, y: 200 },
      region: 'My markers',
      tags: ['gym', 'workout', 'equipment'],
      evidence: 'personal',
      description: 'Bench in the garage',
    });
    const result = retrieveForAsk({
      question: 'Houses I can break into near Capri?',
      places: [...FIXTURES, marked, workout],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records.map((p) => p.id)).toContain('personal:capri-house');
    expect(result.records.map((p) => p.id)).not.toContain('personal:capri-gym');
  });

  it('caps records at 30', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      place({ id: `gym:x${i}`, title: `Gym ${i}`, layerId: 'gyms', position: { x: i, y: 0 } }),
    );
    const result = retrieveForAsk({
      question: 'Where can I train?',
      places: many,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records).toHaveLength(30);
    expect(result.totalInScope).toBe(40);
  });
});

describe('Ask Nylah — gang-op keyword routing (v0.32 gang-op follow-up, lane 2)', () => {
  it('gang-op phrases route to the gang-op layer', () => {
    // Every phrasing the brief names, plus the hyphen form
    // (normalizeAsk keeps "-") and a question-shaped form.
    for (const question of [
      'gang op',
      'gang ops',
      'gang operation',
      'gang operations',
      'illegal operation',
      'illegal operations',
      'where are the gang operations?',
      'show me gang ops in Port Gellhorn',
      'any illegal operations near Capri?',
      'where is the gang-op in Port Gellhorn?',
    ]) {
      expect(asksForGangOps(question)).toBe(true);
      expect(layersRequestedByQuestion(question, layersWithGangOp())).toContain('gang-op');
    }
  });

  it('a bare "gang" does not route — it names no layer on its own', () => {
    expect(asksForGangOps('which gang runs Port Gellhorn?')).toBe(false);
    expect(layersRequestedByQuestion('which gang runs Port Gellhorn?', layersWithGangOp())).toEqual(
      [],
    );
  });

  it('without the layer defined, the keyword route returns nothing — no invented layer id', () => {
    // The `has` guard means the route only fires once lane 1's
    // definition exists; until then the question falls through to
    // the empty-advice path, which answers from the area instead of
    // naming a layer that is not there. The list here is filtered
    // explicitly, so the test holds whether or not lane 1 has
    // landed in DEFAULT_LAYERS yet.
    const noGangOp = layers().filter((layer) => layer.id !== 'gang-op');
    expect(asksForGangOps('show me the gang operations')).toBe(true);
    expect(layersRequestedByQuestion('show me the gang operations', noGangOp)).toEqual([]);
  });
});

describe('Ask Nylah — area-known answers (v0.32 gang-op follow-up, lane 2)', () => {
  const ask = (
    question: string,
    places: readonly Place[],
    layerList: readonly LayerDefinition[] = layersWithGangOp(),
    extra: { priorQuestions?: readonly string[] } = {},
  ) =>
    retrieveForAsk({
      question,
      places,
      layers: layerList,
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      ...extra,
    });

  it('"where is Brooks Boatworks?" names the op, gang, area, likely area and safe code — never a proximity verdict', () => {
    const result = ask('where is Brooks Boatworks?', GANG_OP_PLACES);
    expect(result.requestedLayerIds).toEqual(['gang-op']);
    expect(result.records[0]?.id).toBe('gang-op:brooks-boatworks');
    // The anchor first, then its Port Gellhorn area-mates — never
    // the whole 37, and never another layer's places.
    expect(result.records.map((p) => p.id).sort()).toEqual(
      [
        'gang-op:brooks-boatworks',
        'gang-op:kingpin-bowling',
        'gang-op:june-warehouse',
        'gang-op:la-cascara-motel',
        'gang-op:stash-house',
        'gang-op:backroom-weed-front',
      ].sort(),
    );
    expect(result.records.every((p) => p.layerId === 'gang-op')).toBe(true);
    expect(result.anchorPlace?.id).toBe('gang-op:brooks-boatworks');
    expect(result.areaLabel).toBe('near Brooks Boatworks');
    expect(result.proximitySummary).toMatch(/Brooks Boatworks/);
    expect(result.proximitySummary).toMatch(/Kolts & Associates/);
    expect(result.proximitySummary).toMatch(/Port Gellhorn, Kelly County/);
    expect(result.proximitySummary).toMatch(/north of the Pay 'n' Spray/);
    expect(result.proximitySummary).toMatch(/no verified position/);
    expect(result.proximitySummary).toMatch(/6823/);
    expect(result.proximitySummary).not.toMatch(/nearest|map units away|long way across the map/);
    // The verdict shows the first two sentences — the code is in them.
    expect(shortVerdict(result.proximitySummary)).toMatch(/6823/);
    expect(shortVerdict(result.proximitySummary)).toMatch(/no verified position/);
  });

  it('"where is Brooks Boatworks?" works against the real DEFAULT_LAYERS', () => {
    // Lane 1's 'gang-op' definition is in the tree (committed) —
    // the bare-name path works end to end, not just on a fixture.
    const result = ask('where is Brooks Boatworks?', GANG_OP_PLACES, layers());
    expect(result.records[0]?.id).toBe('gang-op:brooks-boatworks');
    expect(result.proximitySummary).toMatch(/6823/);
  });

  it('every one of the 37 area-known gang ops answers by bare name', () => {
    for (const op of GANG_OPERATIONS.filter((record) => record.hostLocationId === undefined)) {
      const result = ask(`where is ${op.name}?`, GANG_OP_PLACES);
      expect(result.records[0]?.id).toBe(op.id);
      expect(result.proximitySummary).toContain(op.region);
      expect(result.proximitySummary).toMatch(/no verified position/);
      expect(result.proximitySummary).not.toMatch(/nearest .* map units away/i);
      if (op.loot.code) expect(result.proximitySummary).toContain(op.loot.code);
    }
  });

  it('a gang-op kind question answers from the whole list, with the real layer list', () => {
    const result = retrieveForAsk({
      question: 'show me the gang operations',
      places: GANG_OP_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toEqual(['gang-op']);
    expect(result.totalInScope).toBe(37);
    expect(result.records).toHaveLength(30); // ASK_MAX_RECORDS cap
    expect(result.records.every((p) => p.layerId === 'gang-op')).toBe(true);
  });

  it('before the gang-op layer exists, the bare Brooks question answers from the area — never "turn a layer on"', () => {
    const noGangOp = layers().filter((layer) => layer.id !== 'gang-op');
    const result = ask('where is Brooks Boatworks?', GANG_OP_PLACES, noGangOp);
    expect(result.records).toHaveLength(0);
    expect(result.emptyAdvice).toMatch(/Brooks Boatworks/);
    expect(result.emptyAdvice).toMatch(/Kolts & Associates/);
    expect(result.emptyAdvice).toMatch(/Port Gellhorn, Kelly County/);
    expect(result.emptyAdvice).toMatch(/no verified position/);
    expect(result.emptyAdvice).toMatch(/6823/);
    expect(result.emptyAdvice).toMatch(/Find lists it by name/);
    expect(result.emptyAdvice).not.toMatch(/turn a layer on/i);
  });

  it('before the gang-op layer exists, a gang-op kind question says the ops are area-only', () => {
    const noGangOp = layers().filter((layer) => layer.id !== 'gang-op');
    const result = ask('show me the gang operations', GANG_OP_PLACES, noGangOp);
    expect(result.records).toHaveLength(0);
    expect(result.emptyAdvice).toMatch(/listed by area only/);
    expect(result.emptyAdvice).toMatch(/Brooks Boatworks/);
    expect(result.emptyAdvice).not.toMatch(/turn a layer on/i);
  });

  it('a gang-op kind question in an area never answers about that area’s other places', () => {
    // "gang operations in Lost Vista" before the layer exists: the
    // area's representative (the Lost Vista trailers, a breakable
    // place) must not answer a question about gang ops.
    const noGangOp = layers().filter((layer) => layer.id !== 'gang-op');
    const places = [
      ...GANG_OP_PLACES,
      place({
        id: 'breakable:lost-vista-trailers',
        title: 'Lost Vista trailers',
        layerId: 'breakable',
        position: null,
        region: 'Lost Vista',
        tags: ['breakable', 'house', 'enterable', 'trailer'],
      }),
    ];
    const result = ask('gang operations in Lost Vista', places, noGangOp);
    expect(result.records).toHaveLength(0);
    expect(result.emptyAdvice).toMatch(/Gang operations are listed by area only/);
    expect(result.emptyAdvice).not.toMatch(/Lost Vista trailers/);
  });

  it('"gang operations near Capri" never claims the nearest — nothing is positioned', () => {
    const places = [
      ...GANG_OP_PLACES,
      place({
        id: 'L672',
        title: 'Train Bridge, Capri',
        layerId: 'community',
        position: { x: -6837, y: 769 },
        region: 'Capri',
        category: 'vehicles',
      }),
    ];
    const result = ask('gang operations near Capri', places);
    expect(result.requestedLayerIds).toEqual(['gang-op']);
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.proximitySummary).toMatch(
      /no gang operation with a verified position near capri/i,
    );
    expect(result.proximitySummary).not.toMatch(/these are the nearest/i);
  });

  it('a place named by its full title beats a set named by one word inside it — "Manatee Motel" is the motel', () => {
    // "manatee" is the Vice City Manatees set's signature word, so
    // the bare set route hijacked the question before this: the
    // motel's name says more than the set word alone, so the place
    // wins and the set narrowing stays off.
    const result = ask('where is Manatee Motel?', GANG_OP_PLACES);
    expect(result.requestedLayerIds).toEqual(['gang-op']);
    expect(result.records[0]?.id).toBe('gang-op:manatee-motel');
    expect(result.proximitySummary).toMatch(/Manatee Motel/);
    expect(result.proximitySummary).toMatch(/Kingfishers/);
    expect(result.proximitySummary).toMatch(/Grassrivers, Mariana County/);
  });

  it('a place whose name adds nothing to the set name keeps the set ruling — "Delights" is the set', () => {
    // L629 "Delights, Interstate 404, Port Gellhorn" shares the set
    // word and adds no word of its own: the bare name is the set's
    // cards, per the Delights precedent — the place does not steal it.
    const places = [
      ...GANG_OP_PLACES,
      place({
        id: 'L629',
        title: 'Delights, Interstate 404, Port Gellhorn',
        layerId: 'community',
        position: { x: -6000, y: 3000 },
        region: 'Port Gellhorn',
        category: 'exploration',
      }),
      place({
        id: 'card:vicki',
        title: 'Vicki — Delights Dancers',
        layerId: 'cards:delights-dancers',
        position: { x: 100, y: 100 },
        region: 'Corner Store, Capri',
        tags: ['collectible', 'card'],
      }),
    ];
    const result = ask('Delights', places);
    expect(result.records.map((p) => p.id)).toContain('card:vicki');
    expect(result.records.map((p) => p.id)).not.toContain('L629');
  });

  it('a kind word inside a place name does not hijack the question — "Gas Station Meth Front" is the op', () => {
    // "gas" is a shop word, so the kind router asked for the Vehicle
    // services layer before this — but the question names the op by
    // its full title, and nothing outside that title asks for a layer.
    const result = ask('where is Gas Station Meth Front?', GANG_OP_PLACES);
    expect(result.requestedLayerIds).toEqual(['gang-op']);
    expect(result.records[0]?.id).toBe('gang-op:gas-station-meth-front');
    expect(result.proximitySummary).toMatch(/Gas Station Meth Front/);
    expect(result.proximitySummary).toMatch(/Emerald Springs, Kelly County/);
    expect(result.proximitySummary).toMatch(/no verified position/);
    // …while a kind question that names a kind outside the place
    // keeps its own scope: "shops near Starlet Motel" is shops.
    const shops = ask('shops near Starlet Motel', FIXTURES);
    expect(shops.requestedLayerIds).not.toContain('interiors');
  });

  it('a follow-up after Brooks does not re-answer Brooks as its subject', () => {
    const result = ask('show me the gang operations', GANG_OP_PLACES, layersWithGangOp(), {
      priorQuestions: ['where is Brooks Boatworks?'],
    });
    expect(result.requestedLayerIds).toEqual(['gang-op']);
    expect(result.records).toHaveLength(30);
    // The inherited anchor is for distances only — the answer is the
    // whole list, not a Brooks summary.
    expect(result.proximitySummary).toBeNull();
    expect(result.records[0]?.id).toBe('gang-op:fishing-shacks');
  });

  it('a general question with no anchor and no layer keeps the generic advice', () => {
    const result = ask("what's around here?", GANG_OP_PLACES, layersWithGangOp());
    expect(result.records).toHaveLength(0);
    expect(result.emptyAdvice).toBeNull();
  });
});

describe('Ask Nylah — OpenAI client', () => {
  it('system prompt scopes to the asked layers and forbids extras', () => {
    const prompt = buildAskSystemPrompt(['Gyms']);
    expect(prompt).toContain('Gyms');
    expect(prompt).not.toContain('Cards');
    expect(prompt).not.toContain('Lootable');
    expect(prompt).toMatch(/only what was asked/i);
  });

  it('parses only mentions of records that were actually sent', async () => {
    const records = FIXTURES.filter((p) => p.layerId === 'lootable');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                'Hit Corner Store, Capri first — and Vicki is in there too, plus the Starlet Motel.',
            },
          },
        ],
      }),
    } as unknown as Response);
    const answer = await askOpenAi({
      question: 'Lootable houses in Capri?',
      records,
      requestedLayerNames: ['Lootable buildings'],
      apiKey: 'sk-test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(answer).toContain('Corner Store');
    // Vicki / Starlet Motel were never sent, so they can never be highlights.
    expect(parsePlaceMentions(answer, records).map((p) => p.id)).toEqual(['L1001']);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1].body));
    expect(body.model).toBe('gpt-4o-mini');
    expect(JSON.stringify(body)).not.toContain('Vicki');
  });

  it('surfaces API errors verbatim instead of faking an answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Incorrect API key provided',
    } as unknown as Response);
    await expect(
      askOpenAi({
        question: 'Where can I train?',
        records: FIXTURES.slice(0, 1),
        requestedLayerNames: ['Gyms'],
        apiKey: 'sk-bad',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow('401');
  });
});

describe('Ask Nylah — real proximity (the Capri gyms case)', () => {
  // The user's exact case, with real coordinates: Capri is at about
  // x -6,500, y 0 (west side); every gym is in Vice City (east side).
  // The nearest gym to Capri is Grand Majestic, ~5,700 map units away.
  const CAPRI_PLACES: Place[] = [
    place({
      id: 'L672',
      title: 'Train Bridge, Capri',
      layerId: 'community',
      position: { x: -6837, y: 769 },
      region: 'Capri',
      category: 'vehicles',
    }),
    place({
      id: 'L1064',
      title: 'Capri City Jackals Stadium, Capri',
      layerId: 'community',
      position: { x: -6409, y: -210 },
      region: 'Capri',
      category: 'exploration',
    }),
    place({
      id: 'gym:grand-majestic',
      title: 'Grand Majestic Gym',
      layerId: 'gyms',
      position: { x: -1035, y: -1249 },
      region: 'Tequesta, Vice City',
      tags: ['gym'],
    }),
    place({
      id: 'gym:zenith',
      title: 'Zenith',
      layerId: 'gyms',
      position: { x: -826, y: -566 },
      region: 'Downtown, Vice City',
      tags: ['gym'],
    }),
    place({
      id: 'gym:dynamix',
      title: 'Dynamix Fitness',
      layerId: 'gyms',
      position: { x: -366, y: 1514 },
      region: 'Vice City',
      tags: ['gym'],
    }),
    place({
      id: 'gym:muscle-sands',
      title: 'Muscle Sands',
      layerId: 'equipment',
      position: { x: 2019, y: 407 },
      region: 'Ocean Beach, Vice Beach',
      tags: ['gym', 'free', 'outdoor'],
    }),
    place({
      id: 'gym:jason-house-deck',
      title: "Jason's house deck (home gym)",
      layerId: 'equipment',
      position: { x: -2353, y: -5532 },
      region: 'Key Lento, Leonida Keys',
      tags: ['gym', 'free', 'outdoor', 'home'],
    }),
    place({
      id: 'L9999',
      title: '?, Capri',
      layerId: 'lootable',
      position: { x: -6600, y: 200 },
      region: 'Capri',
      evidence: 'uncertain',
    }),
  ];

  const capriGymQuestion =
    'Show me a gym near Capri or somewhere I can hit some strength workouts';

  it('a gym near Capri is answered nearest-first, and says plainly none is near', () => {
    const result = retrieveForAsk({
      question: capriGymQuestion,
      places: CAPRI_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.anchorPlace?.region).toBe('Capri');
    expect(result.areaMismatch).toBe(true);
    expect(result.nearCount).toBe(0);
    expect(result.nearestDistance).not.toBeNull();
    expect(result.nearestDistance!).toBeGreaterThan(5000);
    // Nearest first: Grand Majestic, NOT Muscle Sands / Jason's deck.
    expect(result.records[0]?.id).toBe('gym:grand-majestic');
    expect(result.records.map((p) => p.id)).not.toEqual([
      'gym:muscle-sands',
      'gym:jason-house-deck',
    ]);
    expect(result.proximitySummary).toMatch(/no gym near capri/i);
    expect(result.proximitySummary).toContain('Grand Majestic');
    expect(result.proximitySummary).toMatch(/long way across the map/i);
    // The house-gym gap is stated, not hidden behind the 9 official gyms.
    expect(result.proximitySummary).toMatch(/house gyms.*not in the public map data/i);
  });

  it('the follow-up keeps the Capri anchor instead of re-listing the far gyms', () => {
    // "workout" is an equipment question now — the follow-up answers
    // from the free gear, nearest first, still anchored on Capri.
    const result = retrieveForAsk({
      question: 'is there nowhere else I can workout?',
      places: CAPRI_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      priorQuestions: [capriGymQuestion],
    });
    expect(result.anchorPlace?.region).toBe('Capri');
    expect(result.nearCount).toBe(0);
    expect(result.records[0]?.id).toBe('gym:jason-house-deck');
    expect(result.records[0]?.id).not.toBe('gym:muscle-sands');
    expect(result.proximitySummary).toMatch(/no workout equipment near capri/i);
  });

  it('a house gym the user marked near Capri answers first, before the far gyms', () => {
    const withMarker = [
      ...CAPRI_PLACES,
      place({
        id: 'custom:house-gym-capri',
        title: 'House gym on 5th, Capri',
        layerId: 'my-markers',
        position: { x: -6500, y: 100 },
        region: 'My markers',
        evidence: 'personal',
        tags: ['pin', 'gym', 'workout'],
        description: 'Squat rack and bench in the garage.',
      }),
      place({
        id: 'custom:photo-spot-capri',
        title: 'Photo spot, Capri',
        layerId: 'my-markers',
        position: { x: -6550, y: 150 },
        region: 'My markers',
        evidence: 'personal',
        tags: ['pin'],
      }),
    ];
    const result = retrieveForAsk({
      question: capriGymQuestion,
      places: withMarker,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records[0]?.id).toBe('custom:house-gym-capri');
    expect(result.nearCount).toBe(1);
    expect(result.proximitySummary).toMatch(/nearest gym to capri is house gym on 5th/i);
    // The photo spot is the user's marker but it is not a gym.
    expect(result.records.map((p) => p.id)).not.toContain('custom:photo-spot-capri');
  });

  it('records sent to the AI carry their distance from the anchor', () => {
    const result = retrieveForAsk({
      question: capriGymQuestion,
      places: CAPRI_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    const prompt = formatRecordsForPrompt(result.records, {
      anchorName: 'Capri',
      distances: result.anchorDistances,
    });
    expect(prompt).toMatch(/Grand Majestic Gym.*map units from Capri — far/s);
    expect(prompt).not.toMatch(/near\.$/m);
  });
});

describe('Ask Nylah — the breakable rule rides with the answer', () => {
  it('a breakable question returns the dark-blue rule as one line, and a gym question does not', () => {
    const breakable = retrieveForAsk({
      question: 'What apartments can I break into in Vice City?',
      places: [
        place({
          id: 'apt:venture',
          title: 'Venture Apartments',
          layerId: 'breakable',
          position: { x: 1500, y: 1800 },
          region: 'Vice City',
          tags: ['residential', 'enterable'],
        }),
      ],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(breakable.ruleNote).toMatch(/dark blue has an interior/i);
    expect(breakable.ruleNote).toMatch(/light blue means it is closed/i);
    // One line, not the whole rule paragraph.
    expect(breakable.ruleNote?.split(/(?<=[.!])\s+/).filter(Boolean)).toHaveLength(1);

    const gym = retrieveForAsk({
      question: 'Show me a gym near Capri',
      places: [
        place({
          id: 'gym:grand-majestic',
          title: 'Grand Majestic Gym',
          layerId: 'gyms',
          position: { x: -1035, y: -1249 },
          region: 'Tequesta, Vice City',
          tags: ['gym'],
        }),
      ],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(gym.ruleNote).toBeNull();
  });
});

describe('Ask Nylah — answers from tags, not just names', () => {
  const TAGGED: Place[] = [
    place({
      id: 'L777',
      title: '?, Capri',
      layerId: 'uncertain',
      position: { x: -6600, y: 200 },
      region: 'Capri',
      evidence: 'uncertain',
      tags: ['enterable', '#gas'],
    }),
    place({
      id: 'L778',
      title: '?, Capri',
      layerId: 'uncertain',
      position: { x: -6700, y: 300 },
      region: 'Capri',
      evidence: 'uncertain',
      tags: ['residential'],
    }),
    place({
      id: 'L779',
      title: '?, Capri',
      layerId: 'uncertain',
      position: { x: -6500, y: 100 },
      region: 'Capri',
      evidence: 'uncertain',
      tags: ['gym'],
    }),
    place({
      id: 'L1001',
      title: 'Corner Store, Capri',
      layerId: 'lootable',
      position: { x: -6400, y: -200 },
      region: 'Capri',
      tags: ['enterable', 'retail'],
    }),
  ];

  it('a burglary question returns a "?" gas-station shop by its tags', () => {
    const result = retrieveForAsk({
      question: 'Can I rob a shop in Capri tonight?',
      places: TAGGED,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records.map((p) => p.id)).toContain('L777');
    expect(result.records.map((p) => p.id)).toContain('L1001');
    // The house is not a shop — its tags do not match.
    expect(result.records.map((p) => p.id)).not.toContain('L778');
  });

  it('a gym question returns a gym-tagged "?" place near Capri, nearest first', () => {
    const result = retrieveForAsk({
      question: 'Show me a gym near Capri',
      places: TAGGED,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records[0]?.id).toBe('L779');
    expect(result.nearCount).toBe(1);
    // The house and the petrol station are not gyms.
    expect(result.records.map((p) => p.id)).not.toContain('L777');
    expect(result.records.map((p) => p.id)).not.toContain('L778');
  });

  it('a house the user tagged "workout equipment" answers a workout-equipment question, whatever its source tags say', () => {
    const result = retrieveForAsk({
      question: 'Where is there workout equipment near Capri?',
      places: TAGGED,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      userTags: new Map([['L778', ['workout equipment']]]),
    });
    // The house has no gym tag in the source data — only the user's tag.
    expect(result.records.map((p) => p.id)).toContain('L778');
    // And the tag is layer-scoped: it never answers a member-gym question.
    const gym = retrieveForAsk({
      question: 'Show me a gym near Capri',
      places: TAGGED,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      userTags: new Map([['L778', ['workout equipment']]]),
    });
    expect(gym.records.map((p) => p.id)).not.toContain('L778');
  });

  it('a gas station the user tagged "sells t-shirts" answers a shopping question, but never a gym question', () => {
    const userTags = new Map([['L777', ['sells t-shirts']]]);
    const shopping = retrieveForAsk({
      question: 'Where can I buy t-shirts?',
      places: TAGGED,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      userTags,
    });
    expect(shopping.records.map((p) => p.id)).toContain('L777');
    const gym = retrieveForAsk({
      question: 'Show me a gym near Capri',
      places: TAGGED,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      userTags,
    });
    expect(gym.records.map((p) => p.id)).not.toContain('L777');
  });
});

describe('Ask Nylah — deterministic check on the AI free text (v0.30.0)', () => {
  const gymRecords = FIXTURES.filter((p) => p.layerId === 'gyms');
  const all = FIXTURES;

  it('keeps a sentence about a place that was actually sent', () => {
    const note = sanitizeAiNote(
      'The nearest gym is Dynamix Fitness, in Vice City.',
      gymRecords,
      all,
      ['gyms'],
      'Vice City',
    );
    expect(note).toContain('Dynamix Fitness');
  });

  it('drops a sentence naming a place that was never sent — the Vicki / Starlet Motel leak', () => {
    const lootRecords = FIXTURES.filter((p) => p.layerId === 'lootable');
    const note = sanitizeAiNote(
      'Hit Corner Store, Capri first. Vicki is in there too, plus the Starlet Motel.',
      lootRecords,
      all,
      ['lootable'],
      'Capri',
    );
    expect(note).toContain('Corner Store');
    expect(note).not.toContain('Vicki');
    expect(note).not.toContain('Starlet Motel');
  });

  it('drops a cross-layer extra the question never asked for', () => {
    const note = sanitizeAiNote(
      'The nearest gym is Dynamix Fitness. You will also find trading cards in those houses.',
      gymRecords,
      all,
      ['gyms'],
      'Vice City',
    );
    expect(note).toContain('Dynamix Fitness');
    expect(note).not.toMatch(/card/i);
  });

  it('keeps a cross-layer word when that layer WAS asked for', () => {
    const cardRecords = FIXTURES.filter((p) => p.layerId.startsWith('cards:'));
    const note = sanitizeAiNote(
      'One card is pinned here.',
      cardRecords,
      all,
      ['cards:delights'],
    );
    expect(note).toContain('card');
  });

  it('returns empty when every sentence leaks — the answer falls back to verdict + cards', () => {
    expect(
      sanitizeAiNote(
        'Vicki is in there too, plus the Starlet Motel.',
        gymRecords,
        all,
        ['gyms'],
      ),
    ).toBe('');
  });
});

describe('Ask Nylah — bounded requests (v0.30.0)', () => {
  const base = {
    question: 'Where can I train?',
    records: FIXTURES.slice(0, 1),
    requestedLayerNames: ['Gyms'],
    apiKey: 'sk-test',
  };

  it('fails fast when the API hangs — the caller is never stuck on a spinner', async () => {
    const hanging = vi.fn(
      () => new Promise<Response>(() => {}),
    ) as unknown as typeof fetch;
    await expect(
      askOpenAi({ ...base, fetchImpl: hanging, timeoutMs: 50 }),
    ).rejects.toThrow(/timed out/i);
  });

  it('aborts the in-flight request when the caller cancels', async () => {
    const controller = new AbortController();
    let seenSignal: AbortSignal | undefined;
    const slow = vi.fn(async (_url: string, init?: RequestInit) => {
      seenSignal = init?.signal as AbortSignal | undefined;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 5000);
        seenSignal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'late' } }] }) } as unknown as Response;
    }) as unknown as typeof fetch;
    const promise = askOpenAi({ ...base, fetchImpl: slow, signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toThrow();
    expect(seenSignal?.aborted).toBe(true);
  });
});
