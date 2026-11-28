import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { LayerDefinition } from '../../src/domain/types';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  COLLECTABLE_CARD_PLACES,
  COLLECTABLE_SETS,
} from '../../src/data/collectables';
import { retrieveForAsk } from '../../src/features/ask/retrieval';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

const layers = (): LayerDefinition[] =>
  DEFAULT_LAYERS.map((layer) => ({ ...layer, visible: false }));

describe('collectable cards — v0.31.5 written-guides import + lorenzone.fr host-match (26 Nov 2026)', () => {
  it('pins 383 cards across 18 sets — 37 host + 346 fbrito, Delights Dancers 18 of 18', () => {
    expect(COLLECTABLE_CARD_PLACES).toHaveLength(383);
    const hostPins = COLLECTABLE_CARD_PLACES.filter((c) => !c.tags.includes('fbrito-import'));
    const fbritoPins = COLLECTABLE_CARD_PLACES.filter((c) => c.tags.includes('fbrito-import'));
    expect(hostPins).toHaveLength(37);
    expect(fbritoPins).toHaveLength(346);
    // The host pins are unchanged by the import — same ids, same sets.
    const bySet = new Map<string, string[]>();
    for (const card of hostPins) {
      const setId = card.layerId.slice('cards:'.length);
      bySet.set(setId, [...(bySet.get(setId) ?? []), card.id]);
    }
    expect(bySet.get('delights-dancers')).toEqual([
      'card:vicki',
      'card:jason',
      'card:kandi',
      'card:perla',
    ]);
    expect(bySet.get('vice-city-flamingos')).toEqual([
      'card:ulysses-whitlock',
      'card:mateo-caballero-gold',
    ]);
    expect(bySet.get('vice-city-narcos')).toEqual([
      'card:kyle-lewicky',
      'card:bryson-powers',
    ]);
    expect(bySet.get('vice-city-manatees')).toEqual([
      'card:reggie-pierce',
      'card:tusi-taufua',
      'card:gouwan-marcus',
      'card:jacob-schneeman',
      'card:tusi-taufua-dusty-pink',
    ]);
    expect(bySet.get('liberty-city-penetrators')).toEqual([
      'card:alexander-avain-navy-blue',
    ]);
    expect(bySet.get('liberty-city-wrath')).toEqual(['card:anthony-poke-ii']);
    expect(bySet.get('los-santos-corkers')).toEqual([
      'card:victor-maravilla',
      'card:carlos-larios-bronze',
    ]);
    expect(bySet.get('los-santos-pounders')).toEqual([
      'card:rider-butler-silver',
    ]);
    expect(bySet.get('backyard-wrestling')).toEqual([
      'card:luke-x',
      'card:chrissy-deangelo',
    ]);
    expect(bySet.get('americas-next-top-hooker')).toEqual([
      'card:drake-gold',
      'card:sapphire-silver',
    ]);
    expect(bySet.get('jack-of-hearts-dancers')).toEqual([
      'card:lexi-campbell',
      'card:brianna-blue-purple',
      'card:pricilla-pace-gold',
    ]);
    expect(bySet.get('nine1nine-dancers')).toEqual([
      'card:braelynn-pink',
      'card:meghan-bronze',
      'card:chrissie-deep-red',
      'card:julia-bronze',
    ]);
    expect(bySet.get('the-legends-of-ratface')).toEqual([
      'card:wokester-blue',
    ]);
    expect(bySet.get('right-wing-americas-hero')).toEqual([
      'card:flamer-red',
      'card:right-wing-red',
      'card:right-wings-truck-blue',
      'card:right-wings-truck-red',
      'card:they-red',
    ]);
    expect(bySet.get('ed-comics-universe')).toEqual([
      'card:diagnosis-orange',
      'card:fornicator-light-blue',
    ]);
    // Three sets still have no HOST-pinned card — the guides name no
    // host building for any of their cards (Panic's only pin is the
    // Loot Map Marquise card, which is a loot record, not a cards:* pin).
    expect(COLLECTABLE_SETS.filter((s) => !bySet.has(s.id))).toEqual([
      expect.objectContaining({ id: 'vice-city-club-de-futbol' }),
      expect.objectContaining({ id: 'liberty-city-swingers' }),
      expect.objectContaining({ id: 'los-santos-panic' }),
    ]);
    // But every set has pins once the fbrito candidates count.
    const allBySet = new Set(
      COLLECTABLE_CARD_PLACES.map((c) => c.layerId.slice('cards:'.length)),
    );
    expect(allBySet.size).toBe(18);
    // fbrito candidate pins per set (28 Nov 2026 import manifest).
    const fbritoBySet = new Map<string, number>();
    for (const card of fbritoPins) {
      const setId = card.layerId.slice('cards:'.length);
      fbritoBySet.set(setId, (fbritoBySet.get(setId) ?? 0) + 1);
    }
    expect(Object.fromEntries(fbritoBySet)).toEqual({
      'vice-city-flamingos': 21,
      'vice-city-narcos': 20,
      'vice-city-manatees': 14,
      'vice-city-club-de-futbol': 20,
      'liberty-city-swingers': 17,
      'liberty-city-penetrators': 21,
      'liberty-city-wrath': 21,
      'los-santos-corkers': 16,
      'los-santos-panic': 15,
      'los-santos-pounders': 15,
      'backyard-wrestling': 8,
      'americas-next-top-hooker': 18,
      'delights-dancers': 13,
      'jack-of-hearts-dancers': 33,
      'nine1nine-dancers': 31,
      'the-legends-of-ratface': 20,
      'right-wing-americas-hero': 21,
      'ed-comics-universe': 22,
    });
  });

  it('every card carries its source, an approximate pin and a GTADB host (or the one GPS pin) — fbrito pins carry their own source instead', () => {
    expect(new Set(COLLECTABLE_CARD_PLACES.map((c) => c.id)).size).toBe(383);
    for (const card of COLLECTABLE_CARD_PLACES) {
      expect(card.source.title.length).toBeGreaterThan(0);
      expect(card.source.url).toMatch(/^https:\/\//);
      expect(card.evidence).toBe('approximate');
      expect(card.position).not.toBeNull();
      expect(card.tags).toContain('trading-card');
      if (card.tags.includes('fbrito-import')) {
        // Candidate pins: no GTADB host — the region is the slot's
        // area lead, and the source is the per-record fbrito URL.
        expect(card.source.url).toMatch(
          /^https:\/\/fbritoferreira\.github\.io\/gta6\/\?id=/,
        );
        expect(card.source.title).toMatch(/Open GTA 6 Map.*CC BY 4\.0/);
        expect(card.region).not.toMatch(/GTADB L\d+/);
        continue;
      }
      if (card.id === 'card:kyle-lewicky') {
        // The one pre-existing GPS pin — no GTADB host record. Spelling
        // corrected 26 Nov 2026 (was "Kyle Lewicky"); the id is stable
        // because user data references it.
        expect(card.title).toBe('Kyle Lewicki (teal) — Vice City Narcos');
        expect(card.region).toMatch(/GTA6 GPS/);
      } else {
        expect(card.region).toMatch(/GTADB L\d+/);
      }
    }
  });

  it('a Delights Dancers set question over the real catalogue returns the pinned cards:* cards — and the loot Harley card (step-7 set-wins fix)', () => {
    const places = catalogueFromSnapshot(snapshot);
    const result = retrieveForAsk({
      question: 'help me find the Delights Dancers card set',
      places,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    // FIXED 26 Nov 2026 (step 7, DESIGN §7.2 set-wins rule): "Delights"
    // is also an area word — Jason's host region starts with "Delights"
    // — but set narrowing now beats the area filter, so the Loot Map
    // Harley ("Harley dancer card", region "Port Gellhorn") is no longer
    // dropped. The set question returns all eighteen, nearest-first from
    // the Delights venue (5 host + 13 fbrito candidate pins), never a
    // meditation.
    expect(result.records.map((p) => p.id)).toEqual([
      'card:jason',
      'loot:guide-harley-card',
      'card:vicki',
      'card:fbrito-hidden-package-010',
      'card:fbrito-collectible-card-036',
      'card:perla',
      'card:fbrito-collectible-card-001',
      'card:fbrito-collectible-card-035',
      'card:fbrito-collectible-card-032',
      'card:fbrito-collectible-card-065',
      'card:kandi',
      'card:fbrito-collectible-card-063',
      'card:fbrito-collectible-card-078',
      'card:fbrito-collectible-card-074',
      'card:fbrito-collectible-card-060',
      'card:fbrito-collectible-card-080',
      'card:fbrito-collectible-card-064',
      'card:fbrito-collectible-card-085',
    ]);
    expect(result.records.map((p) => p.id)).not.toContain(
      'loot:meditation-capri',
    );
  });

  it('cards for Delights Dancers near Capri still answers honestly — none is near Capri', () => {
    const places = catalogueFromSnapshot(snapshot);
    const result = retrieveForAsk({
      question: 'cards for delight dancers near Capri',
      places,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.proximitySummary).toMatch(/no card near capri/i);
    expect(result.records.map((p) => p.id)).not.toContain(
      'loot:meditation-capri',
    );
    // All eighteen Delights cards are in the answer, nearest first —
    // the two Port Gellhorn cards (Jason, Harley) lead. Note the nearest
    // is now Jason, not Harley: Jason sits on the Delights GTADB pin,
    // ~13 m closer to the Capri centroid than the Loot Map Harley pin.
    expect(result.records.map((p) => p.id).sort()).toEqual(
      [
        'card:fbrito-collectible-card-001',
        'card:fbrito-collectible-card-032',
        'card:fbrito-collectible-card-035',
        'card:fbrito-collectible-card-036',
        'card:fbrito-collectible-card-060',
        'card:fbrito-collectible-card-063',
        'card:fbrito-collectible-card-064',
        'card:fbrito-collectible-card-065',
        'card:fbrito-collectible-card-074',
        'card:fbrito-collectible-card-078',
        'card:fbrito-collectible-card-080',
        'card:fbrito-collectible-card-085',
        'card:fbrito-hidden-package-010',
        'card:jason',
        'card:kandi',
        'card:perla',
        'card:vicki',
        'loot:guide-harley-card',
      ].sort(),
    );
    expect(result.records[0]?.id).toMatch(/harley|jason/);
  });
});
