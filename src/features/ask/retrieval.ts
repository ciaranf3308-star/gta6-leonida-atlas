import type { Filters, LayerDefinition, Place } from '../../domain/types';
import { isUnnamedPlace } from '../../domain/types';
import { COUNTIES, countyForPlace, countyIdFromText } from '../../data/counties';
import { COLLECTABLE_SETS, type CollectableSet } from '../../data/collectables';
import { ROBBABLE_SHOP_TAGS, SHOP_TAGS } from '../../data/catalogue';
import { housesToCheck, isWorkoutMarker } from '../../domain/gym-check';
import { normalizeUserTag, userTagsMatchLayer } from '../../domain/user-tags';
import {
  BREAKABLE_GAP_NOTE,
  DARK_BLUE_RULE,
  isBreakableMarker,
} from '../../domain/interiors';

/** Re-exported for callers that already import it from here. */
export { isWorkoutMarker, isBreakableMarker };
import {
  aiCategoryMatchesLayer,
  effectiveAiCategory,
  type AiCategoryRecord,
} from '../categorise/categories';
import { askAllowedLayerIds } from '../spoiler/visibility';

/**
 * Ask Nylah retrieval — the spoiler rule, in code.
 *
 * THE RULE (user, 2026-11-23): asking for a thing IS consent to show that
 * layer, even if it is off. Gyms off + "where can I train?" = show the gyms.
 * That consent covers ONLY the layer(s) the question actually asks for, for
 * that answer only — it never turns the layer on in the UI.
 *
 * The other half of the rule: NEVER volunteer extras from layers the user
 * did not ask for. A burglary question returns lootable buildings only —
 * never "you'll also find cards/watches in those houses". Retrieval only
 * ever returns records from layers the question asks for (plus the user's
 * own markers) — or, for a general question that names no layer, from
 * layers already visible. Nothing else is sent to the AI, so the AI cannot
 * leak what it was never given.
 */

export const ASK_MAX_RECORDS = 30;

/**
 * "Near" in map units. The Leonida map is ~12,000 units wide and the Vice
 * City gyms sit ~2,800 units apart from each other — so 2,000 units is a
 * same-neighbourhood radius. The nearest gym to Capri is ~5,700 units away:
 * far outside it, and the code below must say so instead of calling it near.
 */
export const NEAR_DISTANCE_UNITS = 2000;

export interface AskRetrievalInput {
  question: string;
  places: readonly Place[];
  layers: readonly LayerDefinition[];
  filters: Pick<Filters, 'hideFound' | 'remainingOnly' | 'countyId'>;
  /** Place ids the completion log marks as found (step 6: the old
   * visited table is never read — App passes completedPlaceIds here).
   * The name is historical; the values are log-derived. */
  visitedIds?: readonly string[];
  /**
   * AI-suggested types for unnamed places (on-device only). A confident
   * AI gym answers a gym question exactly like a gym tag does — labelled
   * "AI suggested" in the results, never as a verified fact. Low
   * confidence / "not sure" records never match.
   */
  aiCategories?: Readonly<Record<string, AiCategoryRecord>>;
  /**
   * The user's own secondary tags (on-device only). A place he tagged
   * "workout equipment" answers a workout question the way a verified
   * equipment pin does — he saw the gear there. A tag never answers
   * for a layer it was not tagged for.
   */
  userTags?: ReadonlyMap<string, readonly string[]>;
  /**
   * Earlier user questions in this conversation, oldest first. Only used to
   * recover the place a follow-up is about ("is there nowhere else I can
   * workout?" after "gym near Capri") — the layers asked for still come
   * from the current question alone.
   */
  priorQuestions?: readonly string[];
}

export interface AskRetrievalResult {
  /** Records the AI may use — and the only records it will ever see. */
  records: Place[];
  requestedLayerIds: string[];
  requestedLayerNames: string[];
  anchorPlace: Place | null;
  /** Position distances are measured from — the anchor, or the centroid of
   * the named area's positioned places when the area itself is the anchor. */
  anchorPosition: { x: number; y: number } | null;
  /** Distance in map units from the anchor, for positioned records only. */
  anchorDistances: ReadonlyMap<string, number>;
  /** Distance to the nearest positioned record, or null when none is positioned. */
  nearestDistance: number | null;
  /** Records within NEAR_DISTANCE_UNITS of the anchor. */
  nearCount: number;
  /**
   * Plain-words proximity verdict, computed from the distances — e.g.
   * "There's no gym near Capri in the map data. The nearest is Grand
   * Majestic, in Tequesta, Vice City, a long way across the map." Null
   * when the question names no place to measure from.
   */
  proximitySummary: string | null;
  /** County / area / direction the question scoped to, if any. */
  areaLabel: string | null;
  /** True when the scoped area had nothing and we fell back to nearest. */
  areaMismatch: boolean;
  /** Eligible records before the area scope and the 30 cap. */
  totalInScope: number;
  /**
   * Houses in the asked area worth checking for gym equipment — unnamed
   * "?" places tagged enterable or residential, nearest-first. Only ever
   * set for a gym question in an area with no gym near it. These are
   * CANDIDATES, never verified gyms: no source says they have equipment.
   * Empty unless a gym was asked for in a named area or county.
   */
  housesToCheck: Place[];
  /** All such houses in the area, before the display cap. */
  housesToCheckTotal: number;
  /** The area the houses are in ("Capri", "Vice-Dale County"), or null. */
  housesAreaName: string | null;
  /**
   * What the houses are candidates for: 'equipment' when workout
   * equipment was asked for, 'gym' when a member gym was, null when
   * there are no houses. The answer copy follows this, never the other.
   */
  housesKind: 'equipment' | 'gym' | null;
  /**
   * The systemic rule for a breakable question, as one line shown
   * under the verdict — e.g. "On the in-game map, a building drawn
   * dark blue has an interior…". The verdict itself is capped at two
   * sentences (cards first), so the rule would otherwise only live
   * behind a tap on one place's sheet. Null unless a breakable
   * question was asked and a proximity verdict exists.
   */
  ruleNote: string | null;
}

export function normalizeAsk(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return haystack.includes(phrase);
}

function hasWord(haystack: string, word: string): boolean {
  return haystack.split(' ').includes(word);
}

/**
 * Nightlife #tags, by the words a question uses. Nightclubs, strip
 * clubs and bars are bars-and-clubs venues in the game's own filing
 * (shopMapIndex puts them in Food & Drink, not Activities), so a
 * nightlife question asks for the Food & Drink layer — and
 * retrieveForAsk then narrows the eligible set to these tags, so
 * the answer is the nightclubs, not the nearest thirty shops in
 * the area (the over-match the QA report already flagged for
 * "shop"). A bare "club" means the whole nightlife set: in GTA a
 * club is a nightclub first (a member gym is asked for as "gym").
 * "Nightclub in vice city" (reported 2026-11-25) returned nothing
 * before this, even though NINE1NINE and The Vault both carry
 * #nightclub in the data — no nightlife word reached any layer.
 */
export function nightlifeTagsForQuestion(question: string): string[] {
  const q = normalizeAsk(question);
  const tags = new Set<string>();
  if (hasWord(q, 'nightclub') || hasWord(q, 'nightclubs')) tags.add('#nightclub');
  if (hasPhrase(q, 'strip club') || hasPhrase(q, 'strip clubs') || hasWord(q, 'stripclub'))
    tags.add('#stripclub');
  if (hasWord(q, 'bar') || hasWord(q, 'bars') || hasWord(q, 'pub') || hasWord(q, 'pubs'))
    tags.add('#bar');
  if (
    hasWord(q, 'nightlife') ||
    hasWord(q, 'club') ||
    hasWord(q, 'clubs') ||
    hasWord(q, 'dance') ||
    hasWord(q, 'dancing') ||
    hasWord(q, 'dj') ||
    hasWord(q, 'karaoke') ||
    hasWord(q, 'party') ||
    hasWord(q, 'partying')
  ) {
    tags.add('#nightclub');
    tags.add('#stripclub');
    tags.add('#bar');
  }
  return [...tags];
}

/** User-tag words for each nightlife #tag — the words a tag of his
 * own has to carry to count as that venue. */
const NIGHTLIFE_TAG_WORDS: Record<string, readonly string[]> = {
  '#nightclub': ['nightclub'],
  '#stripclub': ['stripclub', 'strip club'],
  '#bar': ['bar', 'pub'],
};

/**
 * The card set a question names, if it names one — e.g. "delight
 * dancers" (his spelling, singular) names the Delights Dancers set.
 * Words are stemmed by dropping a trailing "s", so "delight dancers"
 * matches "Delights Dancers" and "vice city flamingo" matches
 * "Vice City Flamingos". The longest matching set wins; a question
 * naming no set returns null and the answer stays the whole
 * collectibles pool. Without this, "help me find the Delights
 * Dancers card set" returned all 25 collectibles — five cards from
 * five different sets plus every meditation, magazine and watch —
 * because nothing ever narrowed by set (reported 2026-11-26).
 */
export function cardSetForQuestion(question: string): CollectableSet | null {
  const stem = (word: string): string => (word.endsWith('s') ? word.slice(0, -1) : word);
  const questionWords = new Set(normalizeAsk(question).split(' ').map(stem));
  let best: CollectableSet | null = null;
  let bestLength = 0;
  for (const set of COLLECTABLE_SETS) {
    const setWords = normalizeAsk(set.name).split(' ').map(stem);
    if (setWords.every((word) => questionWords.has(word)) && setWords.length > bestLength) {
      best = set;
      bestLength = setWords.length;
    }
  }
  return best;
}

/** A question that asks for cards specifically — not a generic
 * "collectibles" ask, and not one that also names meditations or
 * magazines. A card question takes trading cards only: before this,
 * "cards" also pulled the whole Loot Map collectibles bucket, so a
 * "cards near Capri" question answered with the Smooth Sand
 * meditation — the only eligible place with "Capri" in its region —
 * and the summary called a meditation "the nearest card"
 * (reported 2026-11-26). */
function asksForCardsOnly(question: string): boolean {
  const q = normalizeAsk(question);
  const cardWords = ['card', 'cards', 'trading card', 'trading cards'];
  const otherCollectibles = ['meditation', 'meditations', 'magazine', 'magazines'];
  return (
    cardWords.some((p) => hasPhrase(q, p)) &&
    !otherCollectibles.some((p) => hasPhrase(q, p))
  );
}

/** Is this place one of the nightlife venues asked for, by any
 * evidence on the device? A source #tag, the user's own tag saying
 * so, or a confident AI "bar" type (the resolver files nightclub /
 * bar / pub words as "bar", so an AI bar counts for any nightlife
 * ask). Whole-word matching on user tags, so a "barbecue" tag never
 * counts as a bar. */
export function isNightlifePlace(
  place: Place,
  tags: readonly string[],
  userTags: readonly string[] | undefined,
  aiRecord: AiCategoryRecord | undefined | null,
): boolean {
  if (place.tags.some((tag) => tags.includes(tag))) return true;
  const words = tags.flatMap((tag) => NIGHTLIFE_TAG_WORDS[tag] ?? []);
  const mine = userTags ?? [];
  if (
    words.length > 0 &&
    mine.some((tag) => {
      const clean = normalizeUserTag(tag);
      if (!clean) return false;
      if (words.includes('strip club') && clean.includes('strip club')) return true;
      return clean.split(' ').some((word) => words.includes(word));
    })
  )
    return true;
  return effectiveAiCategory(aiRecord) === 'bar';
}

/** Layer ids a question asks for, by keyword. Empty = no layer asked for. */
export function layersRequestedByQuestion(
  question: string,
  layers: readonly LayerDefinition[],
): string[] {
  const q = normalizeAsk(question);
  const ids = new Set<string>();
  const has = (layerId: string) => layers.some((l) => l.id === layerId) && ids.add(layerId);

  // Gyms vs workout equipment (user correction, 2026-11-23): "workout",
  // "equipment", "bench", "weights" or "gym equipment" asks for the free
  // gear — never the member clubs. A bare "gym" (or "train", "fitness")
  // asks for the member gyms. A question that asks for both ("a gym near
  // Capri or somewhere I can hit some strength workouts") asks for both
  // layers. Only the equipment PHRASES consume the word "gym": in "gym
  // equipment", "home gym", "free gym" or "Muscle Sands" the gym word
  // belongs to the equipment phrase, so it is stripped before the gym
  // check runs.
  const equipmentWords = [
    'workout', 'equipment', 'bench', 'weights', 'weight', 'kettlebell',
    'dumbbell', 'squat', 'deadlift', 'calisthenics',
  ];
  const equipmentPhrases = [
    'work out', 'working out', 'gym equipment', 'home gym', 'outdoor gym',
    'free gym', 'free workout', 'public equipment', "jason's house",
    'jason house', 'muscle sands', 'punching bag', 'pull-up', 'pull up',
  ];
  if (
    equipmentWords.some((w) => hasWord(q, w) || hasPhrase(q, w)) ||
    equipmentPhrases.some((p) => hasPhrase(q, p)) ||
    (hasWord(q, 'free') && (hasWord(q, 'gym') || hasWord(q, 'workout')))
  ) {
    has('equipment');
  }
  const gymWords = [
    'gym', 'fitness', 'strength', 'gains', 'lift', 'exercise', 'cardio',
    'muscle', 'train', 'training',
  ];
  const qWithoutEquipmentPhrases = equipmentPhrases.reduce(
    (acc, phrase) => acc.split(phrase).join(' '),
    q,
  );
  if (
    gymWords.some(
      (w) => hasWord(qWithoutEquipmentPhrases, w) || hasPhrase(qWithoutEquipmentPhrases, w),
    )
  ) {
    has('gyms');
  }
  const lootPhrases = [
    'burglar', 'burglary', 'burglaries', 'loot', 'rob', 'robbery', 'robberies',
    'hold up', 'holdup', 'steal', 'break in', 'break-in', 'hit tonight',
    'houses i can hit', 'can i rob', 'can be robbed', 'held up',
  ];
  const shopWords = [
    'shop', 'store', 'clothes', 'clothing', 'guns', 'ammo', 'food', 'gas',
    'supermarket', 'pharmacy', 'tattoo', 'tattoos', 'hair', 'shoes',
    'electronics', 'vendor', 'restaurant',
  ];
  const houseWords = [
    'house', 'houses', 'home', 'homes', 'apartment', 'apartments', 'apts',
    'trailer', 'trailers', 'mansion', 'mansions', 'mobile home',
  ];
  const asksHouses =
    houseWords.some((w) => hasWord(q, w) || hasPhrase(q, w)) &&
    !shopWords.some((w) => hasWord(q, w));
  // A robbery question about HOUSES asks for breakable homes, not shops:
  // "apartments I can break into in Vice City" is houses, "rob a store"
  // is shops. 'lootable' (shops) only joins when the question is not a
  // house question.
  if (lootPhrases.some((p) => hasPhrase(q, p)) && !asksHouses) has('lootable');
  // Bank jobs & vaults are their own layer, not the lootable SHOPS
  // layer: "bank job", "vault" and "heist" ask for the Loot Map jobs.
  // A generic "rob" question still asks for the shops (unchanged above).
  const heistPhrases = [
    'bank job', 'bank jobs', 'bank vault', 'bank vaults', 'vault', 'vaults',
    'payday loan', 'payday loans', 'heist', 'heists',
  ];
  if (heistPhrases.some((p) => hasPhrase(q, p))) has('loot-heists');
  // Breakable homes are systemic, not a list: the question asks for the
  // Breakable homes layer — the 33 GTADB-tagged houses, the Capri rob
  // houses, the trailer parks, the guide examples, and the user's own
  // marked homes — plus the dark-blue rule in the summary. "Enterable
  // houses" asks for breakable homes AND interiors (a house interior is
  // both); trailers ask for breakable homes only.
  const breakablePhrases = [
    'breakable', 'break into', 'break-in', 'break in', 'rob a house',
    'rob houses', 'rob a home', 'rob homes', 'houses i can break into',
    'apartments i can break into', 'trailer', 'trailers', 'mobile home',
    'enterable house', 'enterable houses', 'enterable home', 'enterable homes',
    'interior house', 'interior houses', 'house interior', 'house interiors',
    'houses i can enter', 'house i can enter', 'apartments i can enter',
    'houses i can hit', 'house i can hit',
    // "Lootable houses" is houses you can loot — breakable homes, not
    // the lootable SHOPS layer (which is "lootable buildings").
    'lootable house', 'lootable houses', 'lootable home', 'lootable homes',
    'lootable apartment', 'lootable apartments',
  ];
  if (breakablePhrases.some((p) => hasPhrase(q, p))) has('breakable');
  if (
    shopWords.some((w) => hasWord(q, w)) ||
    hasPhrase(q, 'buy') ||
    hasPhrase(q, 'where can i buy')
  ) {
    // Shops split four ways in v0.21.0 (Weapons / Style / Food & Drink
    // / Vehicles) — a shop question asks for all of them; the question
    // words narrow it further only through the place tags.
    for (const layer of layers) if (layer.id.startsWith('shops-')) ids.add(layer.id);
  }
  // Nightlife asks for Food & Drink only — every nightlife #tag files
  // there (shopMapIndex: nightclubs and strip clubs are bars-and-clubs
  // venues). retrieveForAsk narrows it to the nightlife tags, so the
  // answer is the nightclubs, not the nearest thirty shops.
  if (nightlifeTagsForQuestion(question).length > 0) has('shops-food');
  // Interiors only on an explicit interior ask — never from a generic
  // "house/building" mention, so a burglary question cannot leak interiors.
  if (
    ['interior', 'interiors', 'enterable', 'enter a', 'go inside', 'inside a', 'can i enter'].some(
      (p) => hasPhrase(q, p),
    )
  )
    has('interiors');
  if (
    ['card', 'cards', 'collectible', 'collectable', 'trading card', 'trading cards'].some((p) =>
      hasPhrase(q, p),
    )
  ) {
    for (const layer of layers) if (layer.id.startsWith('cards:')) ids.add(layer.id);
    // The Loot Map collectibles (meditations, magazines, watches) are
    // collectibles too — a "collectibles" question asks for both.
    has('loot-collectibles');
  }
  // Meditation and magazine questions ask for the Loot Map collectibles
  // only — never the trading-card sets.
  if (['meditation', 'meditations', 'magazine', 'magazines'].some((p) => hasPhrase(q, p))) {
    has('loot-collectibles');
  }
  if (['my marker', 'my markers', 'my note', 'my notes', 'my places'].some((p) => hasPhrase(q, p)))
    has('my-markers');
  if (
    ['named region', 'named regions', 'place name', 'place names'].some((p) => hasPhrase(q, p))
  )
    has('regions');
  return [...ids];
}

function directionOf(question: string): 'north' | 'south' | 'west' | 'east' | null {
  const q = normalizeAsk(question);
  if (hasPhrase(q, 'up north') || hasPhrase(q, 'north')) return 'north';
  if (hasPhrase(q, 'down south') || hasPhrase(q, 'south')) return 'south';
  if (hasPhrase(q, 'out west') || hasPhrase(q, 'west')) return 'west';
  if (hasPhrase(q, 'east')) return 'east';
  return null;
}

function inDirection(position: { x: number; y: number }, direction: string): boolean {
  if (direction === 'north') return position.y >= 3000;
  if (direction === 'south') return position.y <= -2500;
  if (direction === 'west') return position.x <= -3000;
  return position.x >= 1000;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Find the longest catalogue place title named in the question (the anchor). */
export function anchorForQuestion(question: string, places: readonly Place[]): Place | null {
  const q = normalizeAsk(question);
  let best: Place | null = null;
  let bestLength = 0;
  for (const place of places) {
    // An unnamed "?" record normalizes to just its area ("?, Capri" -> "capri")
    // and must never be the anchor — it has no name to be asked about.
    if (isUnnamedPlace(place)) continue;
    const base = normalizeAsk(place.title.split(' — ')[0] ?? place.title);
    if (base.length >= 4 && q.includes(base) && base.length > bestLength) {
      best = place;
      bestLength = base.length;
    }
  }
  return best;
}

/** A region phrase from the question that names an area in the catalogue (e.g. Capri, Mount Kalaga). */
function areaWordForQuestion(question: string, places: readonly Place[]): string | null {
  const q = normalizeAsk(question);
  const regions = new Set<string>();
  for (const place of places) {
    const segment = normalizeAsk(place.region.split(',')[0] ?? '');
    if (segment.length >= 4) regions.add(segment);
    const titleArea = normalizeAsk(place.title.split(',').slice(1).join(',').trim());
    if (titleArea.length >= 4) regions.add(titleArea);
  }
  let best: string | null = null;
  for (const region of regions) {
    if (q.includes(region) && (!best || region.length > best.length)) best = region;
  }
  return best;
}

/**
 * The anchor for a named area: the positioned places in that area, and the
 * place closest to their centroid as the representative. A bare area word
 * like "Capri" never matches a full place title ("Train Bridge, Capri"),
 * so without this the question had no anchor at all — the area filter found
 * no gyms in Capri, and retrieval fell back to the whole gym list in
 * catalogue order with no distances, which is how Vice City gyms got
 * presented as "near Capri". Distances are measured from the centroid.
 */
export function areaAnchorForWord(
  areaWord: string,
  places: readonly Place[],
): { place: Place | null; position: { x: number; y: number } | null } {
  const word = normalizeAsk(areaWord);
  const inArea = places.filter((place) => {
    const regionSegment = normalizeAsk(place.region.split(',')[0] ?? '');
    const titleArea = normalizeAsk(place.title.split(',').slice(1).join(',').trim());
    return regionSegment === word || titleArea === word;
  });
  // The representative is a NAMED place: an unnamed "?" record must never
  // be the anchor a distance or a sentence is built around.
  const named = inArea.filter((place) => !isUnnamedPlace(place));
  const candidates = named.length > 0 ? named : inArea;
  const positioned = candidates.filter(
    (place): place is Place & { position: NonNullable<Place['position']> } =>
      place.position !== null,
  );
  if (positioned.length === 0) return { place: candidates[0] ?? null, position: null };
  const cx = positioned.reduce((sum, p) => sum + p.position.x, 0) / positioned.length;
  const cy = positioned.reduce((sum, p) => sum + p.position.y, 0) / positioned.length;
  let best = positioned[0]!;
  let bestDistance = distance(positioned[0]!.position, { x: cx, y: cy });
  for (const place of positioned.slice(1)) {
    const d = distance(place.position, { x: cx, y: cy });
    if (d < bestDistance) {
      best = place;
      bestDistance = d;
    }
  }
  return { place: best, position: { x: cx, y: cy } };
}

/** Plain noun for the asked layer(s), for the proximity verdict. */
function placeNounForLayers(layerIds: readonly string[]): string {
  if (layerIds.length === 1) {
    if (layerIds[0] === 'equipment') return 'workout equipment';
    if (layerIds[0] === 'gyms') return 'gym';
    if (layerIds[0] === 'breakable') return 'breakable home';
    if (layerIds[0] === 'lootable') return 'lootable building';
    if (layerIds[0] === 'loot-heists') return 'bank job';
    if (layerIds[0] === 'loot-collectibles') return 'collectible';
    if (layerIds[0]?.startsWith('shops-')) return 'shop';
    if (layerIds[0] === 'interiors') return 'enterable building';
    if (layerIds[0]?.startsWith('cards:')) return 'card';
    if (layerIds[0] === 'my-markers') return 'marker of yours';
    return 'place';
  }
  if (layerIds.includes('gyms')) return 'gym';
  if (layerIds.includes('equipment')) return 'workout equipment';
  if (layerIds.includes('breakable')) return 'breakable home';
  // A card question requests all eighteen cards:* layers plus
  // loot-collectibles — the noun is still "card", never "place",
  // or the proximity verdict reads "there is no place near Capri"
  // for a question that asked for a card.
  if (layerIds.some((id) => id.startsWith('cards:'))) return 'card';
  if (layerIds.includes('loot-collectibles')) return 'collectible';
  return 'place';
}

function formatDistance(units: number): string {
  return `about ${Math.round(units / 100) * 100} map units away`;
}

/**
 * The proximity verdict, in plain words, from the computed distances.
 * Never calls a far place near: when nothing is within NEAR_DISTANCE_UNITS
 * it says so first, names the nearest with its area, and says it is a long
 * way away — so the answer can never re-list far gyms as if they were near.
 */
function proximitySummaryFor(
  areaName: string,
  noun: string,
  records: readonly Place[],
  distances: ReadonlyMap<string, number>,
  anchorPosition: { x: number; y: number } | null,
): string | null {
  if (!anchorPosition) {
    return `There is no verified position for ${areaName} in the map data, so how far away things are from there cannot be measured.`;
  }
  const positioned = records.filter((p) => distances.has(p.id));
  if (positioned.length === 0) return null;
  const nearest = [...positioned].sort(
    (a, b) => (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity),
  )[0]!;
  const nearestDistance = distances.get(nearest.id) ?? Infinity;
  const near = positioned.filter((p) => (distances.get(p.id) ?? Infinity) <= NEAR_DISTANCE_UNITS);
  const area = nearest.region ? `, in ${nearest.region}` : '';
  if (near.length > 0) {
    return `The nearest ${noun} to ${areaName} is ${nearest.title}${area} (${formatDistance(nearestDistance)}). ${near.length} ${near.length === 1 ? 'is' : 'are'} near ${areaName}.`;
  }
  return `There is no ${noun} near ${areaName} in the map data. The nearest is ${nearest.title}${area} — ${formatDistance(nearestDistance)}, a long way across the map.`;
}

/**
 * A place whose TAGS say it is the thing asked for, whatever layer it sits
 * in. This is how the unnamed "?" records answer: a "?" with #gas +
 * enterable sits in the unverified layer (its name is unknown), but it IS
 * a petrol-station shop — a burglary or shops question must be able to
 * return it. Only tags the source supplied count; no tag is ever inferred
 * here. A gym tag would match here too — but 0 records in the snapshot
 * carry one, so a gym question still finds no "?" gyms until a source
 * tags one or the user marks a workout spot himself.
 */
export function tagMatchesLayer(place: Place, layerId: string): boolean {
  const tags = place.tags;
  // Gyms and equipment never leak into each other through tags: the
  // free-gear places carry a 'gym' tag (they are gyms in the loose
  // sense), but a gym question must not answer from them, and a member
  // club must not answer an equipment question.
  if (layerId === 'gyms')
    return (
      place.layerId !== 'equipment' &&
      tags.some((tag) => ['gym', 'fitness'].includes(tag))
    );
  if (layerId === 'equipment')
    return (
      place.layerId !== 'gyms' &&
      tags.some((tag) => ['equipment', 'workout'].includes(tag))
    );
  if (layerId.startsWith('shops-'))
    return tags.some((tag) => (SHOP_TAGS as readonly string[]).includes(tag));
  if (layerId === 'lootable')
    return (
      tags.includes('enterable') &&
      tags.some((tag) => (ROBBABLE_SHOP_TAGS as readonly string[]).includes(tag))
    );
  if (layerId === 'interiors') return tags.includes('enterable');
  // Breakable homes: the tag, or residential + enterable (the 33 GTADB
  // houses). The Capri rob-house candidates carry the layer itself, so
  // they match through allowed.has(layerId) rather than through tags.
  if (layerId === 'breakable')
    return (
      tags.includes('breakable') ||
      (tags.includes('residential') && tags.includes('enterable'))
    );
  return false;
}

export function retrieveForAsk(input: AskRetrievalInput): AskRetrievalResult {
  const { question, places, layers } = input;
  const requestedLayerIds = layersRequestedByQuestion(question, layers);
  // Scope: when the question asks for specific layers, ONLY those layers
  // (plus My markers) are in scope — a visible-but-unasked layer must never
  // hijack the answer (e.g. a gym question must not return an interior just
  // because Interiors is on and the county filter matches it). Visible
  // layers only count for general questions that name no layer.
  // (features/spoiler/visibility.ts — one source of truth.)
  const allowed = askAllowedLayerIds(requestedLayerIds, layers);
  const visited = new Set(input.visitedIds ?? []);
  const hideFound = input.filters.hideFound || input.filters.remainingOnly;
  const asksGyms = requestedLayerIds.includes('gyms');
  const asksEquipment = requestedLayerIds.includes('equipment');
  const asksWorkout = asksGyms || asksEquipment;
  const asksBreakable = requestedLayerIds.includes('breakable');
  // A marker-kind question only takes matching markers from My markers:
  // a workout question takes workout markers, a breakable question takes
  // breakable markers, a question asking for both takes either. A
  // general question takes all of them — they are the user's own notes.
  const asksMarkerKind = asksWorkout || asksBreakable;

  let eligible = places.filter(
    (place) =>
      (allowed.has(place.layerId) ||
        // Tag evidence: a "?" place whose tags say it is the thing asked
        // for counts, whatever layer it sits in (see tagMatchesLayer).
        (requestedLayerIds.length > 0 &&
          requestedLayerIds.some((id) => tagMatchesLayer(place, id))) ||
        // The user's own tags: a place he tagged "workout equipment"
        // answers a workout question, whatever layer it sits in.
        (requestedLayerIds.length > 0 &&
          requestedLayerIds.some((id) =>
            userTagsMatchLayer(input.userTags?.get(place.id) ?? [], id),
          )) ||
        // AI evidence: a confident AI type counts the same way — a gym
        // the AI suggested for a "?" near Capri answers a gym question.
        (requestedLayerIds.length > 0 &&
          requestedLayerIds.some((id) =>
            aiCategoryMatchesLayer(input.aiCategories?.[place.id], place, id),
          ))) &&
      !(hideFound && visited.has(place.id)) &&
      !(
        asksMarkerKind &&
        place.layerId === 'my-markers' &&
        !(
          (asksWorkout && isWorkoutMarker(place)) ||
          (asksBreakable && isBreakableMarker(place))
        )
      ),
  );
  // Nightlife narrowing (see nightlifeTagsForQuestion): when the
  // question names a nightlife subtype, only nightlife evidence
  // counts — a source #tag, the user's own tag, or a confident AI
  // "bar" type. Without this the two Vice City nightclubs drown in
  // the nearest thirty Food & Drink shops, and the answer reads as
  // a shop list instead of the clubs asked for.
  const nightlifeTags = nightlifeTagsForQuestion(question);
  if (nightlifeTags.length > 0) {
    eligible = eligible.filter((place) =>
      isNightlifePlace(
        place,
        nightlifeTags,
        input.userTags?.get(place.id),
        input.aiCategories?.[place.id],
      ),
    );
  }
  // Card narrowing (reported 2026-11-26): a question that asks for
  // CARDS takes trading cards only — the Loot Map collectibles bucket
  // holds meditations, magazines and watches too, and a "cards near
  // Capri" question answered with the Smooth Sand meditation because
  // it was the only eligible place with "Capri" in its region. A
  // generic "collectibles" question still takes the whole bucket.
  if (asksForCardsOnly(question)) {
    eligible = eligible.filter(
      (place) => place.layerId !== 'loot-collectibles' || place.tags.includes('trading-card'),
    );
  }
  // Set narrowing: a question naming one card set takes that set only —
  // its cards:* layer plus the Loot Map dancer cards tagged with the
  // set id. "Help me find the Delights Dancers card set" is two cards
  // (Vicki + Harley), not all 25 collectibles.
  const askedSet = cardSetForQuestion(question);
  if (askedSet) {
    eligible = eligible.filter(
      (place) => place.layerId === `cards:${askedSet.id}` || place.tags.includes(askedSet.id),
    );
  }
  const totalInScope = eligible.length;

  // Scope resolution, in order. The current question is tried first; a
  // follow-up with no place in it ("is there nowhere else I can workout?")
  // falls back to the place from the earlier question in this conversation.
  const scopeQuestions = [
    question,
    ...(input.priorQuestions ?? []).slice().reverse(),
  ];
  let anchor: Place | null = null;
  let areaWord: string | null = null;
  let namedCounty: string | null = null;
  for (const scopeQuestion of scopeQuestions) {
    anchor = anchorForQuestion(scopeQuestion, places);
    areaWord = areaWordForQuestion(scopeQuestion, places);
    namedCounty =
      countyIdFromText(scopeQuestion) ??
      COUNTIES.find((c) => hasWord(normalizeAsk(scopeQuestion), c.id))?.id ??
      null;
    if (anchor || areaWord || namedCounty) break;
    anchor = null;
    areaWord = null;
    namedCounty = null;
  }
  const direction =
    anchor || namedCounty || areaWord ? null : directionOf(question);
  const uiCounty =
    !anchor && !namedCounty && !areaWord && !direction ? input.filters.countyId : null;
  const countyId = namedCounty ?? uiCounty;
  const county = countyId ? COUNTIES.find((c) => c.id === countyId) : null;

  const byDistanceFrom = (from: { x: number; y: number }) => (a: Place, b: Place) => {
    const da = a.position ? distance(a.position, from) : Number.POSITIVE_INFINITY;
    const db = b.position ? distance(b.position, from) : Number.POSITIVE_INFINITY;
    return da - db;
  };

  let areaLabel: string | null = null;
  let anchorPosition: { x: number; y: number } | null = anchor?.position ?? null;
  let scoped = eligible;
  let areaMismatch = false;
  // 1. A named area that actually holds matching places: answer from that
  // area only, nearest first. (Mount Kalaga gyms: only the gym in that area.)
  if (areaWord) {
    const inArea = eligible.filter((p) =>
      normalizeAsk(`${p.title} ${p.region}`).includes(areaWord),
    );
    if (inArea.length > 0) {
      areaLabel = areaWord;
      const areaAnchor = areaAnchorForWord(areaWord, places);
      anchor = areaAnchor.place ?? anchor;
      anchorPosition = areaAnchor.position ?? anchorPosition;
      scoped = anchorPosition ? [...inArea].sort(byDistanceFrom(anchorPosition)) : inArea;
    }
  }
  // 2. A named place (full title): everything sorted nearest-first from it.
  if (scoped === eligible && anchor?.position) {
    areaLabel = `near ${anchor.title}`;
    anchorPosition = anchor.position;
    scoped = [...eligible].sort(byDistanceFrom(anchor.position));
    const nearest = scoped.find((p) => p.position);
    if (nearest && distance(nearest.position!, anchor.position) > NEAR_DISTANCE_UNITS)
      areaMismatch = true;
  }
  // 3. A named area with nothing in it: fall back to nearest-first from
  // the area's centroid — never catalogue order, never presented as near.
  if (scoped === eligible && areaWord) {
    areaLabel = areaWord;
    const areaAnchor = areaAnchorForWord(areaWord, places);
    anchor = areaAnchor.place ?? anchor;
    anchorPosition = areaAnchor.position ?? null;
    scoped = anchorPosition ? [...eligible].sort(byDistanceFrom(anchorPosition)) : eligible;
    areaMismatch = true;
  }
  // 4. County, then direction, as before — but a county fallback is also
  // nearest-first, measured from the county centre.
  if (scoped === eligible && county) {
    areaLabel = county.name;
    scoped = eligible.filter((p) => countyForPlace(p) === county.id);
    if (scoped.length === 0) {
      areaMismatch = true;
      const centre = {
        x: (county.bounds.west + county.bounds.east) / 2,
        y: (county.bounds.south + county.bounds.north) / 2,
      };
      anchorPosition = centre;
      scoped = [...eligible].sort(byDistanceFrom(centre));
    }
  } else if (scoped === eligible && direction) {
    areaLabel = direction;
    scoped = eligible.filter((p) => p.position && inDirection(p.position, direction));
    if (scoped.length === 0) {
      areaMismatch = true;
      scoped = eligible;
    }
  }

  const records = scoped.slice(0, ASK_MAX_RECORDS);
  const anchorDistances = new Map<string, number>();
  if (anchorPosition) {
    for (const place of records) {
      if (place.position) anchorDistances.set(place.id, distance(place.position, anchorPosition));
    }
  }
  const positionedDistances = [...anchorDistances.values()];
  const nearestDistance =
    positionedDistances.length > 0 ? Math.min(...positionedDistances) : null;
  const nearCount = positionedDistances.filter((d) => d <= NEAR_DISTANCE_UNITS).length;
  // A named place with no verified position cannot anchor distances.
  if (anchor && !anchor.position && !anchorPosition) anchorPosition = null;

  const requestedLayerNames = requestedLayerIds
    .map((id) => layers.find((l) => l.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  // Houses to check: a gym question in a named area or county with no
  // gym near it. Capri is the case that matters — 0 gym tags in the
  // whole snapshot outside Ajax Gym, no guide lists a gym there, and
  // most Capri "?" records carry no tag at all — so the honest answer is
  // the nearest verified gym PLUS the enterable/residential "?" houses
  // in that area, as candidates to check, never as gyms. They are not
  // sent to the AI and never presented as verified.
  let houses: Place[] = [];
  let housesTotal = 0;
  let housesAreaName: string | null = null;
  const housesKind: 'equipment' | 'gym' | null =
    asksEquipment && !asksGyms ? 'equipment' : asksGyms ? 'gym' : null;
  if (asksWorkout && nearCount === 0 && anchorPosition && (areaWord || county)) {
    const inAreaWord = (place: Place) =>
      areaWord !== null &&
      normalizeAsk(`${place.title} ${place.region}`).includes(areaWord);
    const matchesArea = areaWord
      ? inAreaWord
      : (place: Place) => county !== undefined && county !== null && countyForPlace(place) === county.id;
    // The area word is normalised lowercase ("capri"); display it
    // with a capital, like the county names already are.
    housesAreaName =
      areaWord !== null
        ? areaWord.charAt(0).toUpperCase() + areaWord.slice(1)
        : (county?.name ?? null);
    const found = housesToCheck(
      places,
      anchorPosition,
      (place) =>
        matchesArea(place) && !records.some((record) => record.id === place.id),
    );
    houses = found.places;
    housesTotal = found.total;
  }

  const noun = placeNounForLayers(requestedLayerIds);
  let proximitySummary: string | null = null;
  if (areaLabel && (anchorPosition || anchor)) {
    proximitySummary = proximitySummaryFor(
      areaLabel.startsWith('near ') ? areaLabel.slice('near '.length) : areaLabel,
      noun,
      records,
      anchorDistances,
      anchorPosition,
    );
    // House-level gap, stated honestly: no source lists workout gear
    // inside houses, so the public list is never the whole picture for
    // workouts. A user-marked house gym is already in the records above
    // when it is near — this line says where to get one when there is
    // none. Equipment the user knows about is in a garage in a house:
    // the houses below are the ones to check, not a guessed pin.
    if (asksWorkout && nearCount === 0 && proximitySummary) {
      if (asksEquipment && !asksGyms) {
        proximitySummary +=
          ' Workout equipment in a garage in a house is not in the public map data yet — no source lists it. If you mark a house yourself, Ask will use your marker next time.';
      } else {
        proximitySummary +=
          ' House gyms and workout gear inside houses are not in the public map data yet — no source lists them. If you mark a house gym yourself, Ask will use your marker next time.';
      }
      if (housesTotal > 0 && housesAreaName) {
        proximitySummary +=
          asksEquipment && !asksGyms
            ? ` ${housesTotal} house${housesTotal === 1 ? '' : 's'} in ${housesAreaName} ${housesTotal === 1 ? 'is' : 'are'} worth checking — listed below. None of them is verified workout equipment.`
            : ` ${housesTotal} house${housesTotal === 1 ? '' : 's'} in ${housesAreaName} ${housesTotal === 1 ? 'is' : 'are'} worth checking — listed below. None of them is a verified gym.`;
      }
    }
    // Breakable homes are systemic: the in-game map is the source of
    // truth, and the list is examples plus tagged houses, never a count
    // of every breakable home. Say the rule in the answer itself.
    if (asksBreakable && proximitySummary) {
      proximitySummary += ` ${DARK_BLUE_RULE} ${BREAKABLE_GAP_NOTE}`;
    }
  }
  // The systemic rule, as one line under the verdict (see the
  // ruleNote field): the verdict is capped at two sentences, so the
  // full rule in the summary above never reaches the screen.
  const ruleNote =
    asksBreakable && proximitySummary
      ? (DARK_BLUE_RULE.split(/(?<=[.!])\s+/).filter(Boolean)[0] ?? null)
      : null;

  return {
    records,
    requestedLayerIds,
    requestedLayerNames,
    anchorPlace: anchor,
    anchorPosition,
    anchorDistances,
    nearestDistance,
    nearCount,
    proximitySummary,
    areaLabel,
    areaMismatch,
    totalInScope,
    housesToCheck: houses,
    housesToCheckTotal: housesTotal,
    housesAreaName,
    housesKind: houses.length > 0 ? housesKind : null,
    ruleNote,
  };
}
