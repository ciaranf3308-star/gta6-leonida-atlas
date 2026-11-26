import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { COLLECTABLE_SETS } from '../../src/data/collectables';
import {
  buildGameDatabase,
  setProgress,
  type GameDatabase,
} from '../../src/domain/game-db';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

function buildFullDb(): GameDatabase {
  return buildGameDatabase({ places: catalogueFromSnapshot(snapshot) });
}

describe('game-db ingest — the 480-slot checklist becomes 597 items (26 Nov 2026)', () => {
  it('carries 614 items: the 597 checklist items (480 slots + 117 extras) + 17 loot non-card items', () => {
    const db = buildFullDb();
    const items = [...db.items.values()];
    expect(items).toHaveLength(614);
    expect(new Set(items.map((item) => item.id)).size).toBe(614);
    const cards = items.filter((item) => item.kind === 'trading-card');
    expect(cards).toHaveLength(597);
    const slots = cards.filter((item) => item.checklistSlot);
    const extras = cards.filter((item) => !item.checklistSlot);
    expect(slots).toHaveLength(480);
    expect(extras).toHaveLength(117);
  });

  it('reconciles 596 game-text tiers: 479 slot pairs + 117 extras, Crystal Standard filling two slots', () => {
    const db = buildFullDb();
    const slots = [...db.items.values()].filter(
      (item) => item.kind === 'trading-card' && item.checklistSlot,
    );
    expect(slots).toHaveLength(480);
    const slotPairs = new Set(slots.map((item) => `${item.name}\n${item.variant}`));
    expect(slotPairs.size).toBe(479);
    const extras = [...db.items.values()].filter(
      (item) => item.kind === 'trading-card' && !item.checklistSlot,
    );
    expect(extras).toHaveLength(117);
    for (const extra of extras) {
      expect(slotPairs.has(`${extra.name}\n${extra.variant}`)).toBe(false);
    }
    expect(slotPairs.size + extras.length).toBe(596);
    const crystal = slots.filter((item) => item.name === 'Crystal' && item.variant === 'standard');
    expect(crystal.map((item) => item.setId).sort()).toEqual([
      'americas-next-top-hooker',
      'delights-dancers',
    ]);
    // The 11 set-unattributed people (55 tiers) are carried with no
    // set — never guessed into one.
    expect(extras.filter((item) => item.setId === null)).toHaveLength(55);
    expect(
      new Set(extras.filter((item) => item.setId === null).map((item) => item.name)).size,
    ).toBe(11);
  });

  it('per-set sizes are exact, extras never count toward a set, Manatees carries the 24 vs 30 dispute', () => {
    const db = buildFullDb();
    for (const set of COLLECTABLE_SETS) {
      const model = db.sets.get(set.id)!;
      expect(model.size).toBe(set.size);
      expect(model.itemIds).toHaveLength(set.size);
      expect(setProgress(db, set.id).total).toBe(set.size);
      expect(setProgress(db, set.id).found).toBe(0);
      // Every item in the set is a checklist slot of that set.
      for (const itemId of model.itemIds) {
        const item = db.items.get(itemId)!;
        expect(item.checklistSlot).toBe(true);
        expect(item.setId).toBe(set.id);
      }
    }
    const manatees = db.sets.get('vice-city-manatees')!;
    expect(manatees.sizeDisputed).toEqual({
      low: 24,
      high: 30,
      note: expect.stringContaining('24 vs 30'),
    });
    const otherSets = [...db.sets.values()].filter((set) => set.id !== 'vice-city-manatees');
    for (const set of otherSets) expect(set.sizeDisputed).toBeUndefined();
  });

  it('tracks every slot regardless of position: 40 pinned, 440 area-known, 0 unmapped, 490 pickups', () => {
    const db = buildFullDb();
    const slots = [...db.items.values()].filter(
      (item) => item.kind === 'trading-card' && item.checklistSlot,
    );
    const byPlacement = new Map<string, number>();
    for (const slot of slots) {
      byPlacement.set(slot.placement, (byPlacement.get(slot.placement) ?? 0) + 1);
    }
    expect(byPlacement.get('pinned')).toBe(40);
    expect(byPlacement.get('area-known')).toBe(440);
    expect(byPlacement.get('unmapped') ?? 0).toBe(0);
    const pickups = slots.flatMap((item) => item.pickups);
    expect(pickups).toHaveLength(490);
    expect(slots.filter((item) => item.pickups.length > 1)).toHaveLength(9);
    for (const slot of slots) {
      expect(slot.pickups.length).toBeGreaterThanOrEqual(1);
      expect(slot.spotDescription).not.toBeNull();
      expect(slot.areaLead).not.toBeNull();
      // Every area-known item carries areaId + areaLead for the soft
      // "likely area" region (step 4/5 renders it; this step stores it).
      if (slot.placement === 'area-known') {
        expect(slot.locationId).toBeNull();
        expect(slot.areaId).not.toBeNull();
      }
      for (const pickup of slot.pickups) {
        expect(pickup.areaLead.length).toBeGreaterThan(0);
        expect(pickup.direction.length).toBeGreaterThan(0);
        expect(pickup.sourceTitle).toMatch(/lorenzone\.fr/);
        expect(pickup.sourceUrl).toMatch(/^https:\/\/lorenzone\.fr\//);
        expect(pickup.evidence).toBe('approximate');
        expect(pickup.areaId).not.toBeNull();
      }
    }
    // Extras have no lorenzone direction — game-text tiers only, with
    // no pickup and no position.
    const extras = [...db.items.values()].filter(
      (item) => item.kind === 'trading-card' && !item.checklistSlot,
    );
    for (const extra of extras) {
      expect(extra.pickups).toEqual([]);
      expect(extra.placement).toBe('unmapped');
      expect(extra.locationId).toBeNull();
    }
  });

  it('per-set pinned counts match the checklist release notes (40 pinned of 480)', () => {
    const db = buildFullDb();
    const expected: Record<string, number> = {
      'vice-city-flamingos': 2,
      'vice-city-narcos': 2,
      'vice-city-manatees': 5,
      'vice-city-club-de-futbol': 0,
      'liberty-city-swingers': 0,
      'liberty-city-penetrators': 1,
      'liberty-city-wrath': 1,
      'los-santos-corkers': 2,
      'los-santos-panic': 1,
      'los-santos-pounders': 1,
      'backyard-wrestling': 2,
      'americas-next-top-hooker': 2,
      'delights-dancers': 5,
      'jack-of-hearts-dancers': 3,
      'nine1nine-dancers': 5,
      'the-legends-of-ratface': 1,
      'right-wing-americas-hero': 5,
      'ed-comics-universe': 2,
    };
    let total = 0;
    for (const [setId, pinned] of Object.entries(expected)) {
      const set = db.sets.get(setId)!;
      const actual = set.itemIds.filter(
        (itemId) => db.items.get(itemId)!.placement === 'pinned',
      ).length;
      expect(actual).toBe(pinned);
      total += actual;
    }
    expect(total).toBe(40);
  });

  it('every pinned slot resolves to a real location; host spot-checks match the checklist lane', () => {
    const db = buildFullDb();
    const pinned = [...db.items.values()].filter(
      (item) => item.kind === 'trading-card' && item.checklistSlot && item.placement === 'pinned',
    );
    expect(pinned).toHaveLength(40);
    for (const item of pinned) {
      expect(item.locationId).not.toBeNull();
      expect(db.locations.has(item.locationId!)).toBe(true);
    }
    const hostOf = (name: string, variant = 'standard') =>
      [...db.items.values()].find(
        (item) => item.name === name && item.variant === variant,
      )!.locationId;
    expect(hostOf('Mateo Caballero', 'gold')).toBe('L544');
    expect(hostOf('Diagnosis', 'orange')).toBe('L625');
    expect(hostOf('Fornicator', 'Light Blue')).toBe('L3785');
    expect(hostOf('Carlos Larios', 'bronze')).toBe('L2608');
    expect(hostOf('Gouwan Marcus')).toBe('L1064');
    // The GPS-pinned exception: Kyle Lewicki (teal) resolves by host
    // name to the Dynamix Fitness gym place, not a GTADB record.
    expect(hostOf('Kyle Lewicki', 'teal')).toBe('gym:dynamix');
    // Vanessa gold stays unpinned: lorenzone says Bayside, the only
    // Uncle Jack's Liquor (L313) is in Port Gellhorn.
    const vanessa = [...db.items.values()].find(
      (item) => item.name === 'Vanessa' && item.variant === 'gold',
    )!;
    expect(vanessa.placement).toBe('area-known');
    expect(vanessa.locationId).toBeNull();
  });

  it('bundles no printed text and no artwork anywhere', () => {
    const db = buildFullDb();
    for (const item of db.items.values()) {
      expect(item.printedText).toBeNull();
      expect(item.artwork).toEqual({ front: null, back: null });
    }
  });

  it('loot non-card items land as items hosted at their own location (17: 10 meditations, 5 magazines, watch, scan)', () => {
    const db = buildFullDb();
    const lootItems = [...db.items.values()].filter((item) => item.id.startsWith('loot:'));
    expect(lootItems).toHaveLength(17);
    expect(lootItems.filter((item) => item.kind === 'meditation')).toHaveLength(10);
    expect(lootItems.filter((item) => item.kind === 'magazine')).toHaveLength(5);
    expect(lootItems.filter((item) => item.kind === 'watch')).toHaveLength(1);
    expect(lootItems.filter((item) => item.kind === 'waink-scan')).toHaveLength(1);
    for (const item of lootItems) {
      expect(item.locationId).toBe(item.id);
      expect(db.locations.has(item.id)).toBe(true);
      expect(item.setId).toBeNull();
      expect(item.checklistSlot).toBe(false);
    }
  });
});
