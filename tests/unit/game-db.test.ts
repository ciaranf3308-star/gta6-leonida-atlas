import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { COLLECTABLE_CARD_PLACES, parseCardHostId } from '../../src/data/collectables';
import type { CardChecklistItem } from '../../src/data/card-checklist.generated';
import {
  buildGameDatabase,
  categoryProgress,
  locationCard,
  overallProgress,
  remainingItems,
  setProgress,
  visibleOpportunities,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import { opportunitiesForLocation } from '../../src/domain/opportunities';
import { EMPTY_USER_DATA, type Place, type UserData } from '../../src/domain/types';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

function buildFullDb(overrides: {
  records?: CompletionRecord[];
  reconciliation?: GameDatabase['reconciliation'];
  user?: UserData;
} = {}): GameDatabase {
  return buildGameDatabase({
    places: catalogueFromSnapshot(snapshot),
    ...overrides,
  });
}

function findItem(db: GameDatabase, name: string, variant = 'standard') {
  const item = [...db.items.values()].find(
    (candidate) => candidate.name === name && candidate.variant === variant,
  );
  if (!item) throw new Error(`No item ${name} (${variant}) in test db.`);
  return item;
}

describe('game-db — §3.2 derivation from the real catalogue (26 Nov 2026)', () => {
  it('derives the database at the measured counts: 4,826 locations, 980 opportunities, 614 items, 18 sets, 198 areas', () => {
    const db = buildFullDb();
    expect(db.locations.size).toBe(4826); // 4,480 + 346 fbrito candidate pins
    expect(db.opportunities.size).toBe(980);
    expect(db.items.size).toBe(614);
    expect(db.sets.size).toBe(18);
    expect(db.areas.size).toBe(198); // 133 + 65 new area nodes from fbrito pin regions
    expect(db.missionsEnabled).toBe(false);
    const byKind = new Map<string, number>();
    for (const opp of db.opportunities.values()) {
      byKind.set(opp.kind, (byKind.get(opp.kind) ?? 0) + 1);
    }
    expect(byKind.get('shop')).toBe(250);
    expect(byKind.get('robbery-shop')).toBe(119);
    expect(byKind.get('bank-job')).toBe(29);
    expect(byKind.get('break-in')).toBe(47);
    expect(byKind.get('interior')).toBe(391);
    expect(byKind.get('gym')).toBe(9);
    expect(byKind.get('workout-equipment')).toBe(3);
    expect(byKind.get('activity')).toBe(4);
    expect(byKind.get('discovery')).toBe(73);
    expect(byKind.get('gang-op') ?? 0).toBe(39);
    expect(byKind.get('mission') ?? 0).toBe(0);
    expect(byKind.get('vehicle-loot') ?? 0).toBe(16);
    expect(byKind.get('easter-egg') ?? 0).toBe(0);
  });

  it('Delights (L629) is ONE location with 4 opportunities + 2 items', () => {
    const db = buildFullDb();
    const location = db.locations.get('L629')!;
    expect(location).toBeDefined();
    expect(location.name).toBe('Delights, Interstate 404, Port Gellhorn');
    expect(location.placement).toBe('pinned');
    expect(location.areaId).toBe('area:port-gellhorn');
    const kinds = db.opportunitiesByLocation
      .get('L629')!
      .map((opp) => opp.kind)
      .sort();
    expect(kinds).toEqual(['activity', 'discovery', 'interior', 'shop']);
    const shop = db.opportunitiesByLocation
      .get('L629')!
      .find((opp) => opp.kind === 'shop')!;
    expect(shop.label).toBe('Food & drink shop');
    expect(shop.repeatable).toBe(false);
    const activity = db.opportunitiesByLocation
      .get('L629')!
      .find((opp) => opp.kind === 'activity')!;
    expect(activity.label).toMatch(/Pool \(8-ball\)/);
    const items = db.itemsByLocation.get('L629')!.map((item) => item.name).sort();
    expect(items).toEqual(['Harley', 'Jason']);
    // The location card shows the same four opportunities + two items.
    const card = locationCard(db, 'L629')!;
    expect(card.opportunities).toHaveLength(4);
    expect(card.items).toHaveLength(2);
  });

  it('a Style shop yields BOTH a shop and a robbery-shop opportunity (v0.31.3, structurally fixed)', () => {
    const db = buildFullDb();
    // Sara's Unisex Salon (L360): #hair + enterable + retail.
    const kinds = db.opportunitiesByLocation
      .get('L360')!
      .map((opp) => opp.kind)
      .sort();
    expect(kinds).toEqual(['interior', 'robbery-shop', 'shop']);
    const shop = db.opportunitiesByLocation
      .get('L360')!
      .find((opp) => opp.kind === 'shop')!;
    expect(shop.label).toBe('Style shop');
    const robbery = db.opportunitiesByLocation
      .get('L360')!
      .find((opp) => opp.kind === 'robbery-shop')!;
    expect(robbery.repeatable).toBe(true);
    expect(robbery.detail).toBe('convenience');
    // The same rule, directly on a synthetic location (no snapshot needed).
    const synthetic = opportunitiesForLocation({
      id: 'L9999',
      name: "Sara's Unisex Salon, Hamlet",
      nameUncertain: false,
      position: { x: 0, y: 0 },
      placement: 'pinned',
      areaId: 'area:hamlet',
      footprint: null,
      evidence: [],
      tags: ['#hair', 'enterable', 'retail'],
      description: '',
    });
    expect(synthetic.map((opp) => opp.kind).sort()).toEqual([
      'interior',
      'robbery-shop',
      'shop',
    ]);
  });

  it('weapons regression (v0.32 step 1): gun shops surface as weapons shops, never hide under Robberies', () => {
    const db = buildFullDb();
    // The 3 verified gun shops: named, positioned, evidence 'approximate'.
    // In the old model they filed to LOOTABLE (the generic 'retail' rule
    // ran before the shop-type rule — the exact v0.31.3 Style bug class),
    // so the Weapons layer showed 0 places. In the new model each is a
    // weapons-shop opportunity on its own location.
    for (const id of ['L1074', 'L298', 'L2413']) {
      const location = db.locations.get(id)!;
      expect(location.placement).toBe('pinned');
      expect(location.evidence[0]!.kind).toBe('approximate');
      const kinds = db.opportunitiesByLocation
        .get(id)!
        .map((opp) => opp.kind)
        .sort();
      expect(kinds).toEqual(['interior', 'shop']);
      const shop = db.opportunitiesByLocation
        .get(id)!
        .find((opp) => opp.kind === 'shop')!;
      expect(shop.label).toBe('Weapons shop');
      // A gun shop is not a hold-up target (DESIGN §4.2 kinds are
      // pawn/jewellery and convenience; no verified source names an
      // Ammu-Nation as a stick-up target) — so NO robbery-shop
      // opportunity, even though all three carry the generic 'retail' tag.
    }
    expect(db.locations.get('L1074')!.name).toBe("Phil's Ammu-Nation, Leonida");
    // The 3 uncertain ones stay uncertain, with the reason shown — and
    // render no pin (A§9: a "?" record is never a pin).
    const tentative = db.locations.get('L1091')!;
    expect(tentative.placement).toBe('area-known');
    expect(tentative.nameUncertain).toBe(true);
    expect(tentative.evidence[0]!.kind).toBe('unverified');
    const unconfirmed = db.locations.get('L1676')!;
    expect(unconfirmed.placement).toBe('area-known');
    expect(unconfirmed.evidence[0]!.kind).toBe('unverified');
    const unnamed = db.locations.get('L2406')!;
    expect(unnamed.placement).toBe('area-known');
    expect(unnamed.name).toBeNull();
    expect(unnamed.evidence[0]!.kind).toBe('unverified');
    // The rule, not just these six: no unnamed GTADB location is ever
    // 'pinned', and the only GTADB locations that are pinned with
    // unverified evidence are the 7 corroborated by a hosted card
    // (L304, L475, L590, L629, L996, L1006, L1916 — three of them
    // 'demolished', so the conflict is shown on the card, not resolved).
    // Guide-sourced places (Loot Map heist guides) are pinned on
    // position + name — their 'uncertain' is a position estimate, not
    // an identity doubt — so they are excluded from this check.
    const pinnedUnverifiedGtadb = [...db.locations.values()]
      .filter(
        (location) =>
          /^L\d+$/.test(location.id) &&
          location.placement === 'pinned' &&
          location.evidence[0]?.kind === 'unverified',
      )
      .map((location) => location.id)
      .sort();
    expect(pinnedUnverifiedGtadb).toEqual([
      'L1006',
      'L1916',
      'L304',
      'L475',
      'L590',
      'L629',
      'L996',
    ]);
    for (const location of db.locations.values()) {
      if (/^L\d+$/.test(location.id) && location.name === null) {
        expect(location.placement).not.toBe('pinned');
      }
    }
    // And the map layer sees it: with shop enabled, the 3 verified gun
    // shops are visible; the 3 uncertain ones are not (no pin).
    const visible = visibleOpportunities(db, { enabledKinds: ['shop'] });
    const visibleIds = new Set(visible.map((opp) => opp.locationId));
    expect(visibleIds.has('L1074')).toBe(true);
    expect(visibleIds.has('L298')).toBe(true);
    expect(visibleIds.has('L2413')).toBe(true);
    expect(visibleIds.has('L1091')).toBe(false);
    expect(visibleIds.has('L1676')).toBe(false);
    expect(visibleIds.has('L2406')).toBe(false);
  });

  it('card ids resolve to items, not locations — Vicki and Victor Maravilla are two items on one location (L304)', () => {    const db = buildFullDb();
    // No location carries a HOST card id. (fbrito candidate pins ARE
    // locations — the pin is the location, rule 5 in game-db — so
    // card:fbrito-* ids legitimately appear as location ids.)
    for (const id of db.locations.keys()) {
      expect(id.startsWith('card:') && !id.startsWith('card:fbrito-')).toBe(false);
      expect(id.startsWith('loot:guide-harley-card')).toBe(false);
      expect(id.startsWith('loot:guide-rusty-anchor-card')).toBe(false);
    }
    const vicki = findItem(db, 'Vicki');
    const victor = findItem(db, 'Victor Maravilla');
    expect(vicki.locationId).toBe('L304');
    expect(victor.locationId).toBe('L304');
    expect(vicki.id).not.toBe('card:vicki');
    // L304 hosts three cards: Vicki, Victor Maravilla, Bryson Powers.
    expect(
      db.itemsByLocation
        .get('L304')!
        .map((item) => item.name)
        .sort(),
    ).toEqual(['Bryson Powers', 'Vicki', 'Victor Maravilla']);
    // The old ids still resolve — through the legacy map, not as items.
    expect(db.legacyItemIds.get('card:vicki')).toBe(vicki.id);
    expect(db.legacyItemIds.get('card:victor-maravilla')).toBe(victor.id);
    expect(db.legacyItemIds.size).toBe(386); // 37 cards:* + 346 fbrito + 3 loot
  });

  it('every cards:* pin joins to exactly one checklist item (no orphan pins, no missing pins)', () => {
    const db = buildFullDb();
    expect(COLLECTABLE_CARD_PLACES).toHaveLength(383); // 37 host + 346 fbrito candidate pins
    for (const pin of COLLECTABLE_CARD_PLACES) {
      const itemId = db.legacyItemIds.get(pin.id);
      expect(itemId).toBeDefined();
      const item = db.items.get(itemId!)!;
      expect(item.kind).toBe('trading-card');
      expect(item.checklistSlot).toBe(true);
      expect(item.locationId).not.toBeNull();
    }
    // parseCardHostId is the host rule: it parses GTADB ids and throws
    // for the one GPS-pinned card (Kyle Lewicki, teal).
    expect(parseCardHostId(COLLECTABLE_CARD_PLACES[0]!)).toBe('L304');
    const kylePin = COLLECTABLE_CARD_PLACES.find((pin) => pin.id === 'card:kyle-lewicky')!;
    expect(() => parseCardHostId(kylePin)).toThrow(/no GTADB host id/);
  });

  it('the loot dancer cards keep their set ids and resolve to their hosts', () => {
    const db = buildFullDb();
    const harley = findItem(db, 'Harley');
    expect(harley.setId).toBe('delights-dancers');
    expect(harley.locationId).toBe('L629');
    const marquise = findItem(db, 'Marquise Bernard');
    expect(marquise.setId).toBe('los-santos-panic');
    // No GTADB host — the loot record itself is the location.
    expect(marquise.locationId).toBe('loot:guide-marquise-card');
    expect(db.locations.has('loot:guide-marquise-card')).toBe(true);
    const aimie = findItem(db, 'Aimie', 'pink');
    expect(aimie.setId).toBe('nine1nine-dancers');
    expect(aimie.locationId).toBe('L325');
  });

  it('breakable examples become area-known locations + break-in opportunities, with the loot line as detail', () => {
    const db = buildFullDb();
    const parlor = db.locations.get('breakable:parlor-apartments')!;
    expect(parlor.placement).toBe('area-known');
    expect(parlor.areaId).toBe('area:rockridge--vice-city');
    const kinds = db.opportunitiesByLocation
      .get('breakable:parlor-apartments')!
      .map((opp) => opp.kind)
      .sort();
    // Parlor Apartments is ALSO gang-op #21 (San4San) — the §8.1
    // import host-matches it instead of duplicating the building.
    expect(kinds).toEqual(['break-in', 'gang-op', 'interior']);
    const gangOp = db.opportunitiesByLocation
      .get('breakable:parlor-apartments')!
      .find((opp) => opp.kind === 'gang-op')!;
    expect(gangOp.detail).toBe('San4San');
    expect(gangOp.repeatable).toBe(true);
    const breakIn = db.opportunitiesByLocation
      .get('breakable:parlor-apartments')!
      .find((opp) => opp.kind === 'break-in')!;
    expect(breakIn.repeatable).toBe(true);
    expect(breakIn.detail).toMatch(/safe full of cash/);
  });

  it('gyms and equipment become locations + gym / workout-equipment opportunities', () => {
    const db = buildFullDb();
    const ajax = db.opportunitiesByLocation
      .get('gym:ajax')!
      .map((opp) => opp.kind);
    expect(ajax).toEqual(['gym']);
    // The GTADB Ajax Gym record (L1869) is a second location with the
    // same opportunity kind, plus an interior (it is enterable).
    expect(
      db.opportunitiesByLocation
        .get('L1869')!
        .map((opp) => opp.kind)
        .sort(),
    ).toEqual(['gym', 'interior']);
    const muscleSands = db.opportunitiesByLocation
      .get('gym:muscle-sands')!
      .map((opp) => opp.kind);
    expect(muscleSands).toEqual(['workout-equipment']);
    // The Starlet Motel bench has no position — area-known, still an
    // opportunity, still searchable.
    const bench = db.locations.get('gym:starlet-motel-bench')!;
    expect(bench.placement).toBe('area-known');
    expect(bench.position).toBeNull();
    expect(
      db.opportunitiesByLocation
        .get('gym:starlet-motel-bench')!
        .map((opp) => opp.kind),
    ).toEqual(['workout-equipment']);
  });

  it('loot heists become locations + bank-job opportunities; loot collectibles become items hosted at their own location', () => {
    const db = buildFullDb();
    const fleeca = db.opportunitiesByLocation
      .get('loot:guide-job-ocean-fleeca-small')!
      .map((opp) => opp.kind);
    expect(fleeca).toEqual(['bank-job']);
    const payday = db.opportunities
      .get('opp:loot:guide-loan-quick-buck-hamlet:bank-job:1')!;
    expect(payday.label).toBe('Payday loan job');
    expect(payday.detail).toBe('Payday loan');
    expect(payday.repeatable).toBe(true);
    const meditation = db.items.get('loot:guide-meditation-jasons-house')!;
    expect(meditation.kind).toBe('meditation');
    expect(meditation.locationId).toBe('loot:guide-meditation-jasons-house');
    expect(meditation.setId).toBeNull();
    expect(meditation.checklistSlot).toBe(false);
    const watch = db.items.get('loot:guide-kingpin-watch')!;
    expect(watch.kind).toBe('watch');
    const scan = db.items.get('loot:guide-wonder-whale-scan')!;
    expect(scan.kind).toBe('waink-scan');
  });

  it('"?" records become locations with a null name, never an invented one', () => {
    const db = buildFullDb();
    const unnamed = [...db.locations.values()].filter((loc) => loc.name === null);
    expect(unnamed.length).toBeGreaterThan(3000);
    for (const loc of unnamed) expect(loc.nameUncertain).toBe(true);
    // A tentative name ("Parsons Hotel?") keeps its name, flagged uncertain.
    const tentative = [...db.locations.values()].find(
      (loc) => (loc.name ?? '').includes('?') && !(loc.name ?? '').startsWith('?'),
    );
    expect(tentative).toBeDefined();
    expect(tentative!.name).toMatch(/Parsons Hotel\?/);
    expect(tentative!.nameUncertain).toBe(true);
  });

  it('region places become area nodes with member locations — never locations', () => {
    const db = buildFullDb();
    for (const id of db.locations.keys()) {
      expect(id.startsWith('region:')).toBe(false);
    }
    expect(db.areas.size).toBe(198); // 133 + 65 new area nodes from fbrito pin regions
    const portGellhorn = db.areas.get('area:port-gellhorn')!;
    expect(portGellhorn.name).toBe('Port Gellhorn');
    expect(portGellhorn.level).toBe('town');
    expect(portGellhorn.locationIds).toContain('L629');
    expect(portGellhorn.bounds).not.toBeNull();
    expect(portGellhorn.parentId).toBe('county:kelly');
    expect(portGellhorn.childrenIds).toEqual([]);
    const kelly = db.areas.get('county:kelly')!;
    expect(kelly.level).toBe('county');
    expect(kelly.bounds).toEqual({ west: -9382, east: -3023, south: 596, north: 5626 });
    expect(kelly.locationIds).toContain('L304');
    const viceCity = db.areas.get('area:vice-city')!;
    expect(viceCity.locationIds.length).toBeGreaterThan(100);
  });

  it('a personal marker becomes a personal location + opportunity, visible with all filters off', () => {
    const user: UserData = {
      ...EMPTY_USER_DATA,
      markers: [
        {
          id: 'custom:capri-gym',
          title: 'Gym gear in a Capri garage',
          description: 'Workout equipment in a house garage in Capri.',
          category: 'my-markers',
          position: { x: -6400, y: -200 },
          icon: 'pin',
          kind: 'workout',
          createdAt: '2026-11-26T00:00:00.000Z',
          updatedAt: '2026-11-26T00:00:00.000Z',
        },
      ],
    };
    const db = buildFullDb({ user });
    const location = db.locations.get('custom:capri-gym')!;
    expect(location.evidence[0]!.kind).toBe('personal');
    expect(location.placement).toBe('pinned');
    expect(
      db.opportunitiesByLocation.get('custom:capri-gym')!.map((opp) => opp.kind),
    ).toEqual(['workout-equipment']);
    // Visible with nothing enabled: personal records are never spoilers.
    const visible = visibleOpportunities(db, { enabledKinds: [] });
    expect(visible.map((opp) => opp.id)).toContain(
      'opp:custom:capri-gym:workout-equipment:1',
    );
  });
});

describe('game-db — §3.4 selectors', () => {
  it('§7.4 case 1 shape: remaining_items by setId returns all 18 Delights items, including the loot Harley', () => {
    // NOTE (design conflict): DESIGN §7.4 case 1 says "5 items" — that
    // predates the 480-slot import, when only the 5 pinned cards
    // existed as records. The set now has 18 slots; the regression
    // that matters is that the loot Harley is not dropped by an area
    // filter, and all 5 pinned cards are present.
    const db = buildFullDb();
    const remaining = remainingItems(db, { setId: 'delights-dancers' });
    expect(remaining).toHaveLength(18);
    expect(remaining.map((item) => item.name).sort()).toContain('Harley');
    const pinned = remaining.filter((item) => item.placement === 'pinned');
    // All 18 are pinned now (5 host + 13 fbrito candidate pins, 28 Nov
    // 2026 import) — the set is complete.
    expect(pinned.map((item) => item.name).sort()).toEqual([
      'Amber',
      'Chip',
      'Cleo',
      'Crystal',
      'Cyrus',
      'Daisy',
      'Harley',
      'Jason',
      'Kandi',
      'Lance',
      'Lucky',
      'Mario',
      'Nevaeh',
      'Nicole',
      'Perla',
      'Thelma',
      'Tracy',
      'Vicki',
    ]);
    // With Vicki collected, she is absent and Harley stays.
    const vicki = findItem(db, 'Vicki');
    const db2 = buildFullDb({
      records: [
        {
          id: 'rec:test-vicki',
          target: { type: 'item', id: vicki.id },
          verb: 'collected',
          count: 1,
          at: '2026-11-26T03:00:00.000Z',
          source: 'user',
        },
      ],
    });
    const remaining2 = remainingItems(db2, { setId: 'delights-dancers' });
    expect(remaining2).toHaveLength(17);
    expect(remaining2.map((item) => item.name)).not.toContain('Vicki');
    expect(remaining2.map((item) => item.name)).toContain('Harley');
    expect(setProgress(db2, 'delights-dancers')).toEqual({
      found: 1,
      total: 18,
      remaining: remaining2,
    });
  });

  it('remaining_items: setId wins over areaId — set members with no location are never dropped', () => {
    const db = buildFullDb();
    // Delights in Port Gellhorn: the set is fully pinned now (28 Nov
    // 2026 fbrito import), so the area filter uses real positions —
    // only the two pinned at L629 (Harley, Jason) are in Port Gellhorn.
    const inPortGellhorn = remainingItems(db, {
      setId: 'delights-dancers',
      areaId: 'area:port-gellhorn',
    });
    expect(inPortGellhorn.map((item) => item.name)).toContain('Harley');
    expect(inPortGellhorn.map((item) => item.name)).toContain('Jason');
    expect(inPortGellhorn).toHaveLength(2);
    // The "never dropped" invariant now demonstrates on Ratface: all
    // 15 of its area-known members (13 gap + 2 held) carry a Port
    // Gellhorn lead area and no location, and the area filter keeps
    // every one of them.
    const ratface = remainingItems(db, {
      setId: 'the-legends-of-ratface',
      areaId: 'area:port-gellhorn',
    });
    expect(ratface).toHaveLength(15);
    expect(ratface.every((item) => item.locationId === null)).toBe(true);
    // Without a set, the area filter matches pinned items by host area
    // and area-known items by lead area — Kandi (Little Cuba) is out.
    const areaOnly = remainingItems(db, { areaId: 'area:port-gellhorn' });
    expect(areaOnly.map((item) => item.name)).toContain('Harley');
    expect(areaOnly.map((item) => item.name)).not.toContain('Kandi');
    expect(() => remainingItems(db, { setId: 'no-such-set' })).toThrow(
      /Unknown collectible set/,
    );
  });

  it('§4.3 no-double-counting, derived category: card sets supersede reconciliation and are never summed', () => {
    const db = buildFullDb({
      reconciliation: [
        {
          categoryId: 'card-sets',
          count: 3,
          basis: 'game-stat',
          at: '2026-11-26T00:00:00.000Z',
        },
      ],
    });
    const view = categoryProgress(db, 'card-sets');
    // The 480 slots are fully imported, so derived applies even with
    // zero records — the reconciled 3 is shown but NOT counted.
    expect(view.basis).toBe('derived');
    expect(view.displayed).toBe(0);
    expect(view.superseded).toBe(true);
    expect(view.reconciledCount).toBe(3);
    expect(overallProgress(db).found).toBe(0);
  });

  it('§4.3 no-double-counting, reconciled category: missions show the game-stat count, never a derived zero', () => {
    const db = buildFullDb({
      reconciliation: [
        {
          categoryId: 'missions',
          count: 41,
          basis: 'game-stat',
          at: '2026-11-26T00:00:00.000Z',
        },
      ],
    });
    const view = categoryProgress(db, 'missions');
    expect(view.basis).toBe('reconciled');
    expect(view.displayed).toBe(41);
    expect(view.superseded).toBe(false);
    expect(view.derivedCount).toBe(0);
  });

  it('§4.3 no-double-counting, bank jobs: one looted job + a reconciled 5 displays 1, not 6', () => {
    const bankJob = [...buildFullDb().opportunities.values()].find(
      (opp) => opp.kind === 'bank-job',
    )!;
    const db = buildFullDb({
      records: [
        {
          id: 'rec:test-bank',
          target: { type: 'opportunity', id: bankJob.id },
          verb: 'looted',
          count: 1,
          at: '2026-11-26T03:00:00.000Z',
          source: 'user',
        },
      ],
      reconciliation: [
        {
          categoryId: 'bank-jobs',
          count: 5,
          basis: 'game-stat',
          at: '2026-11-26T00:00:00.000Z',
        },
      ],
    });
    const view = categoryProgress(db, 'bank-jobs');
    expect(view.basis).toBe('derived');
    expect(view.displayed).toBe(1);
    expect(view.superseded).toBe(true);
    expect(view.reconciledCount).toBe(5);
    // The same looted record does not leak into payday loans.
    expect(categoryProgress(db, 'payday-loans').displayed).toBe(0);
  });

  it('§4.3: store stick-ups flip from reconciled to derived on the first looted convenience shop', () => {
    const db0 = buildFullDb({
      reconciliation: [
        {
          categoryId: 'store-stickups',
          count: 12,
          basis: 'game-stat',
          at: '2026-11-26T00:00:00.000Z',
        },
      ],
    });
    expect(categoryProgress(db0, 'store-stickups')).toMatchObject({
      basis: 'reconciled',
      displayed: 12,
      superseded: false,
    });
    expect(categoryProgress(db0, 'store-stickups').sizeDisputed).toEqual({
      low: 50,
      high: 91,
      note: expect.stringContaining('50 vs 91'),
    });
    const shop = [...db0.opportunities.values()].find(
      (opp) => opp.kind === 'robbery-shop' && opp.detail === 'convenience',
    )!;
    const db1 = buildFullDb({
      records: [
        {
          id: 'rec:test-stickup',
          target: { type: 'opportunity', id: shop.id },
          verb: 'looted',
          count: 1,
          at: '2026-11-26T03:00:00.000Z',
          source: 'user',
        },
      ],
      reconciliation: [
        {
          categoryId: 'store-stickups',
          count: 12,
          basis: 'game-stat',
          at: '2026-11-26T00:00:00.000Z',
        },
      ],
    });
    expect(categoryProgress(db1, 'store-stickups')).toMatchObject({
      basis: 'derived',
      displayed: 1,
      superseded: true,
    });
    // Smash 'n' grabs has no derived source (0 pawn opportunities) —
    // it stays reconciled.
    expect(categoryProgress(db1, 'smash-grabs').basis).toBe('reconciled');
  });

  it('overall progress caps per category (1,325 required)', () => {
    const db = buildFullDb({
      reconciliation: [
        { categoryId: 'missions', count: 91, basis: 'game-stat', at: '2026-11-26T00:00:00.000Z' },
        { categoryId: 'hoops', count: 90, basis: 'game-stat', at: '2026-11-26T00:00:00.000Z' },
      ],
    });
    const overall = overallProgress(db);
    expect(overall.required).toBe(1325);
    expect(overall.found).toBe(181);
    expect(overall.doneCategories).toBe(2);
    expect(overall.pct).toBeCloseTo(181 / 1325);
    expect(overall.categories).toHaveLength(19);
    expect(() => categoryProgress(db, 'no-such-category')).toThrow(
      /Unknown completion category/,
    );
  });

  it('visibleOpportunities: filter-on, reveal-only, and personal (DESIGN §3.3)', () => {
    const db = buildFullDb();
    const all = visibleOpportunities(db, { enabledKinds: [] });
    // Nothing enabled and nothing revealed: only personal records show.
    expect(all).toEqual([]);
    const shops = visibleOpportunities(db, { enabledKinds: ['shop'] });
    // 92, not 250: the other 158 shop opportunities sit on unnamed "?"
    // or uncorroborated-uncertain locations, which render no pin (A§9).
    // They still exist in the db and are searchable; only pinned
    // locations draw a pin.
    expect(shops).toHaveLength(92);
    expect(shops.every((opp) => opp.kind === 'shop')).toBe(true);
    const bankJob = [...db.opportunities.values()].find((opp) => opp.kind === 'bank-job')!;
    const revealed = visibleOpportunities(db, {
      enabledKinds: [],
      revealIds: [bankJob.id],
    });
    expect(revealed).toEqual([bankJob]);
    // hideCompleted drops a looted opportunity even when its kind is on.
    const db2 = buildFullDb({
      records: [
        {
          id: 'rec:test-hide',
          target: { type: 'opportunity', id: bankJob.id },
          verb: 'looted',
          count: 2,
          at: '2026-11-26T03:00:00.000Z',
          source: 'user',
        },
      ],
    });
    expect(db2.completedOpportunityIds.get(bankJob.id)).toBe(2);
    const shown = visibleOpportunities(db2, {
      enabledKinds: ['bank-job'],
      hideCompleted: true,
    });
    expect(shown.map((opp) => opp.id)).not.toContain(bankJob.id);
    expect(shown).toHaveLength(28);
  });

  it('completedOpportunityIds sums-then-filters: a -1 record sorting before its +1s still counts (step-2 lane finding)', () => {
    const db0 = buildFullDb();
    const shop = [...db0.opportunities.values()].find(
      (opp) => opp.kind === 'robbery-shop' && opp.detail === 'convenience',
    )!;
    // Dexie returns records in id order, not chronological order — so a
    // compensating -1 whose id sorts before the +1s must still count.
    // (The step-2 lane's rec:undo- prefix makes this hold in practice;
    // the derivation must not depend on id order at all.)
    const db = buildFullDb({
      records: [
        {
          id: 'rec:aaa-undo',
          target: { type: 'opportunity', id: shop.id },
          verb: 'looted',
          count: -1,
          at: '2026-11-26T03:00:00.000Z',
          source: 'user',
        },
        {
          id: 'rec:zzz-loot-1',
          target: { type: 'opportunity', id: shop.id },
          verb: 'looted',
          count: 1,
          at: '2026-11-26T03:01:00.000Z',
          source: 'user',
        },
        {
          id: 'rec:zzz-loot-2',
          target: { type: 'opportunity', id: shop.id },
          verb: 'looted',
          count: 1,
          at: '2026-11-26T03:02:00.000Z',
          source: 'user',
        },
      ],
    });
    expect(db.completedOpportunityIds.get(shop.id)).toBe(1);
  });

  it('locationCard returns null for an unknown id', () => {
    expect(locationCard(buildFullDb(), 'L999999')).toBeNull();
  });
});

describe('game-db — build-time errors (never a silent drop)', () => {
  const fakePin: Place = {
    id: 'card:fake',
    title: 'Fake — Delights Dancers',
    description: 'Fake card.',
    category: 'collectibles',
    position: { x: 0, y: 0 },
    layerId: 'cards:delights-dancers',
    tags: ['collectible', 'trading-card', 'delights-dancers', 'card'],
    region: 'Nowhere Host, No County',
    source: { title: 'test', url: 'https://example.com' },
    evidence: 'approximate',
  };
  const fakeSlot = (overrides: Partial<CardChecklistItem> = {}): CardChecklistItem => ({
    id: 'card-checklist:delights-dancers:fake:standard',
    person: 'Fake',
    variant: 'standard',
    variantAlias: null,
    setId: 'delights-dancers',
    setName: 'Delights Dancers',
    checklistSlot: true,
    rarity: { tier: 'standard' },
    placement: 'pinned',
    spotDescription: 'Nowhere table.',
    areaLead: 'Nowhere',
    pickups: [
      {
        areaLead: 'Nowhere',
        direction: '· Nowhere · table',
        sourceTitle: 'test',
        sourceUrl: 'https://example.com',
        evidence: 'approximate',
        hostId: null,
        hostName: null,
      },
    ],
    hostId: null,
    catalogueId: 'card:fake',
    conflict: null,
    printedText: null,
    artwork: { front: null, back: null },
    ...overrides,
  });

  it('a pinned slot whose host cannot be parsed or name-matched throws', () => {
    // No host name at all: the parser failure is reported, not swallowed.
    expect(() =>
      buildGameDatabase({ places: [fakePin], checklistItems: [fakeSlot()] }),
    ).toThrow(/no host name to resolve/);
    // A host name with no catalogue record: zero candidates is an error.
    const namedSlot = fakeSlot({
      pickups: [
        {
          areaLead: 'Nowhere',
          direction: '· Nowhere Host · table',
          sourceTitle: 'test',
          sourceUrl: 'https://example.com',
          evidence: 'approximate',
          hostId: null,
          hostName: 'Nonexistent Host',
        },
      ],
    });
    expect(() =>
      buildGameDatabase({ places: [fakePin], checklistItems: [namedSlot] }),
    ).toThrow(/resolves to 0 places/);
  });

  it('a checklist host that disagrees with its pin throws', () => {
    const mismatchedPin: Place = {
      ...fakePin,
      region: 'Somewhere Host, Kelly County (GTADB L123)',
    };
    expect(() =>
      buildGameDatabase({
        places: [mismatchedPin],
        checklistItems: [fakeSlot({ hostId: 'L999' })],
      }),
    ).toThrow(/disagrees/);
  });

  it('a pinned slot joining to a missing catalogue pin throws', () => {
    expect(() =>
      buildGameDatabase({
        places: [],
        checklistItems: [fakeSlot({ catalogueId: 'card:missing' })],
      }),
    ).toThrow(/missing catalogue pin/);
  });
});
