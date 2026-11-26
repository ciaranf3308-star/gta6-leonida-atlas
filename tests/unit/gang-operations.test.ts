import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  GANG_OPERATIONS,
  GANG_OP_GTADB_HOSTS,
  GANG_OP_LICENSE,
  GANG_OP_PLACES,
  gangOpHasVehicleLoot,
  gangOpLootForLocation,
  gangOpLootText,
} from '../../src/data/gang-operations';
import {
  buildGameDatabase,
  categoryProgress,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import { lootFor } from '../../src/domain/loot';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

function buildFullDb(overrides: { records?: CompletionRecord[] } = {}): GameDatabase {
  return buildGameDatabase({
    places: catalogueFromSnapshot(snapshot),
    ...overrides,
  });
}

describe('gang operations — §8.1 import (Demo C)', () => {
  it('imports all 39 operations, in-game order 1–39, with the published gang split', () => {
    expect(GANG_OPERATIONS).toHaveLength(39);
    const orders = GANG_OPERATIONS.map((op) => op.order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 39 }, (_, i) => i + 1));
    const names = GANG_OPERATIONS.map((op) => op.name);
    expect(new Set(names).size).toBe(39);
    const byGang = new Map<string, number>();
    for (const op of GANG_OPERATIONS) {
      byGang.set(op.gang, (byGang.get(op.gang) ?? 0) + 1);
    }
    expect(Object.fromEntries(byGang)).toEqual({
      Kingfishers: 3,
      'Kolts & Associates': 5,
      M7: 2,
      'La Polilla Negra': 2,
      'Final Chapter': 4,
      San4San: 5,
      'PTT Youngin$': 2,
      'The Guardia Brothers': 3,
      'Other Criminals': 13,
    });
  });

  it('every record names an area lead and a region — and none carries a position', () => {
    for (const op of GANG_OPERATIONS) {
      expect(op.areaLead.trim().length, `${op.id} areaLead`).toBeGreaterThan(0);
      expect(op.region.trim().length, `${op.id} region`).toBeGreaterThan(0);
      expect(op.id.startsWith('gang-op:'), op.id).toBe(true);
    }
    // 37 new places: the other two ride on existing locations.
    expect(GANG_OP_PLACES).toHaveLength(37);
    for (const place of GANG_OP_PLACES) {
      expect(place.position, place.id).toBeNull();
      expect(place.layerId, place.id).toBe('gang-op');
      expect(place.category, place.id).toBe('robberies');
      expect(place.tags, place.id).toContain('gang-op');
      expect(place.source.license, place.id).toBe(GANG_OP_LICENSE);
      expect(place.evidence, place.id).toBe('uncertain');
    }
    const placeIds = GANG_OP_PLACES.map((place) => place.id);
    expect(new Set(placeIds).size).toBe(37);
  });

  it('host-matches instead of duplicating: Sunrise RV Park → L265, Parlor Apartments → the breakable example', () => {
    expect(GANG_OP_GTADB_HOSTS.get('L265')).toBe('gang-op:sunrise-rv-park');
    expect(GANG_OP_PLACES.some((place) => place.id === 'gang-op:sunrise-rv-park')).toBe(false);
    expect(GANG_OP_PLACES.some((place) => place.id === 'gang-op:parlor-apartments')).toBe(false);
    const db = buildFullDb();
    // Sunrise RV Park (L265) gains gang-op + vehicle-loot on its real place.
    expect(db.locations.get('L265')?.name).toBe('Sunrise RV Park, Mariana County');
    expect(
      (db.opportunitiesByLocation.get('L265') ?? []).map((opp) => opp.kind).sort(),
    ).toEqual(['gang-op', 'vehicle-loot']);
    // Parlor Apartments gains a gang-op alongside its break-in.
    expect(
      (db.opportunitiesByLocation.get('breakable:parlor-apartments') ?? []).map(
        (opp) => opp.kind,
      ),
    ).toContain('gang-op');
    expect(db.opportunities.size).toBe(980);
  });

  it('La Cascara Motel stays area-known: two GTADB records share the name, so no host is guessed', () => {
    const record = GANG_OPERATIONS.find((op) => op.id === 'gang-op:la-cascara-motel')!;
    expect(record.hostLocationId).toBeUndefined();
    expect(record.notes).toMatch(/L806, L981/);
    const db = buildFullDb();
    expect(db.locations.get('gang-op:la-cascara-motel')?.placement).toBe('area-known');
    expect(db.locations.get('gang-op:la-cascara-motel')?.position).toBeNull();
  });

  it('Brooks Boatworks carries the Demo C loot: safe code 6823, Caracara 4×4, Clunker 556', () => {
    const db = buildFullDb();
    const location = db.locations.get('gang-op:brooks-boatworks')!;
    expect(location).toBeDefined();
    expect(location.placement).toBe('area-known');
    expect(location.position).toBeNull();
    expect(location.areaId).toBe('area:port-gellhorn--kelly-county');
    expect(location.evidence[0]?.license).toBe(GANG_OP_LICENSE);
    const opps = db.opportunitiesByLocation.get('gang-op:brooks-boatworks')!;
    const gangOp = opps.find((opp) => opp.kind === 'gang-op')!;
    expect(gangOp.detail).toBe('Kolts & Associates');
    expect(gangOp.repeatable).toBe(true);
    expect(gangOp.loot?.code).toBe('6823');
    expect(gangOp.loot?.contents).toContain('Vapid Smuggler Caracara (standout vehicle)');
    expect(gangOp.loot?.contents).toContain('Clunker 556 Assault Rifle (unique variant)');
    const vehicleLoot = opps.find((opp) => opp.kind === 'vehicle-loot')!;
    expect(vehicleLoot.repeatable).toBe(true);
    expect(vehicleLoot.detail).toBe('Safe code 6823');
    expect(vehicleLoot.loot?.code).toBe('6823');
    // The place card's loot row shows the code + contents, cited.
    const place = catalogueFromSnapshot(snapshot).find(
      (candidate) => candidate.id === 'gang-op:brooks-boatworks',
    )!;
    const loot = lootFor(place)!;
    expect(loot.text).toMatch(/6823/);
    expect(loot.text).toMatch(/Caracara/);
    expect(loot.text).toMatch(/Clunker 556/);
    expect(loot.source).toMatch(/GTA Addict/);
  });

  it('11 safe codes, 16 vehicle-loot opportunities, 23 sites with published loot, 16 without', () => {
    const coded = GANG_OPERATIONS.filter((op) => op.loot.code !== undefined);
    expect(coded.map((op) => `${op.name}:${op.loot.code}`).sort()).toEqual(
      [
        'Biker Hideout:1982',
        'Brooks Boatworks:6823',
        'Farm Fix Meth Lab:2121',
        'Illegal Sneaker Trade:4124',
        "JanJak's Garage:4444",
        'Kingpin Bowling:0300',
        'La Cascara Motel:6969',
        'Palmer Fishing Warehouse:1886',
        'Saber Shipping Facility:1122',
        'Saber Shipping Yard:8046',
        'Sunrise RV Park:6769',
      ].sort(),
    );
    const db = buildFullDb();
    let vehicleLootCount = 0;
    for (const opp of db.opportunities.values()) {
      if (opp.kind === 'vehicle-loot') vehicleLootCount += 1;
    }
    expect(vehicleLootCount).toBe(16);
    for (const op of GANG_OPERATIONS) {
      const locationId = op.hostLocationId ?? op.id;
      expect(gangOpHasVehicleLoot(locationId), op.id).toBe(
        op.loot.code !== undefined || op.loot.vehicles.length > 0,
      );
    }
    expect(GANG_OPERATIONS.filter((op) => op.loot.contents.length > 0)).toHaveLength(23);
    expect(GANG_OPERATIONS.filter((op) => op.loot.contents.length === 0)).toHaveLength(16);
    // A site with no published loot carries no invented loot.
    expect(gangOpLootForLocation('gang-op:weed-grow')).toBeNull();
    expect(gangOpLootText('gang-op:weed-grow')).toBeNull();
  });

  it('records its conflicts instead of resolving them', () => {
    const m7 = GANG_OPERATIONS.find((op) => op.id === 'gang-op:m7-compound')!;
    expect(m7.aliases).toContain('Nova Auto Junkyard');
    expect(m7.notes).toMatch(/same spot/);
    const biker = GANG_OPERATIONS.find((op) => op.id === 'gang-op:biker-hideout')!;
    expect(biker.notes).toMatch(/Lake Leonida/);
    expect(biker.notes).toMatch(/Ambrosia/);
    const farmFix = GANG_OPERATIONS.find((op) => op.id === 'gang-op:farm-fix-meth-lab')!;
    expect(farmFix.loot.code).toBe('2121');
    expect(farmFix.notes).toMatch(/single-source/);
  });

  it('Gang Operations progress is derived now that the import is complete', () => {
    const empty = buildFullDb();
    const before = categoryProgress(empty, 'gang-ops');
    expect(before.basis).toBe('derived');
    expect(before.displayed).toBe(0);
    expect(before.superseded).toBe(false);
    // One looted gang-op moves it 0 → 1.
    const looted = buildFullDb({
      records: [
        {
          id: 'rec:test-brooks',
          target: { type: 'opportunity', id: 'opp:gang-op:brooks-boatworks:gang-op:1' },
          verb: 'looted',
          count: 1,
          at: '2026-11-26T10:00:00.000Z',
          source: 'user',
        },
      ],
    });
    expect(categoryProgress(looted, 'gang-ops').displayed).toBe(1);
    expect(categoryProgress(looted, 'gang-ops').basis).toBe('derived');
    // A typed in-game tally is kept but superseded — shown, never counted.
    const reconciled = buildFullDb({
      records: [
        {
          id: 'rec:test-brooks',
          target: { type: 'opportunity', id: 'opp:gang-op:brooks-boatworks:gang-op:1' },
          verb: 'looted',
          count: 1,
          at: '2026-11-26T10:00:00.000Z',
          source: 'user',
        },
      ],
    });
    const withEntry: GameDatabase = {
      ...reconciled,
      reconciliation: [
        {
          categoryId: 'gang-ops',
          count: 5,
          basis: 'game-stat',
          at: '2026-11-26T10:00:00.000Z',
        },
      ],
    };
    const view = categoryProgress(withEntry, 'gang-ops');
    expect(view.displayed).toBe(1);
    expect(view.superseded).toBe(true);
    expect(view.reconciledCount).toBe(5);
  });
});
