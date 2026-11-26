import { describe, expect, it } from 'vitest';
import {
  GANG_OPERATIONS,
  GANG_OP_LICENSE,
  GANG_OP_PLACES,
} from '../../src/data/gang-operations';
import {
  DEFAULT_LAYERS,
  layersWithCategoryEnabled,
} from '../../src/features/map/layers';

describe('gang-op layer definition (v0.32 lane 1)', () => {
  it('exists with the right id, name, category, map index, visibility and order', () => {
    const byId = new Map(DEFAULT_LAYERS.map((layer) => [layer.id, layer]));
    const gangOp = byId.get('gang-op');
    expect(gangOp).toBeDefined();
    expect(gangOp?.name).toBe('Gang operations');
    expect(gangOp?.category).toBe('activity');
    expect(gangOp?.mapIndex).toBe('robberies');
    // Spoiler-free default: off, like every other public layer.
    expect(gangOp?.visible).toBe(false);
    // Order 89: between Bank jobs & vaults (88) and Lootable
    // buildings (90) — the robbery cluster, 75–90.
    expect(gangOp?.order).toBe(89);
    expect(byId.get('loot-heists')?.order).toBe(88);
    expect(byId.get('lootable')?.order).toBe(90);
    expect(gangOp?.interactive).toBe(true);
  });

  it('counts are computed from the import, not hardcoded: 39 ops, 2 hosted, 37 area-known', () => {
    expect(GANG_OPERATIONS).toHaveLength(39);
    expect(
      GANG_OPERATIONS.filter((op) => op.hostLocationId !== undefined),
    ).toHaveLength(2);
    expect(GANG_OP_PLACES).toHaveLength(37);
    expect(
      GANG_OP_PLACES.every((place) => place.layerId === 'gang-op'),
    ).toBe(true);
    expect(
      GANG_OP_PLACES.every((place) => place.position === null),
    ).toBe(true);

    const description =
      DEFAULT_LAYERS.find((layer) => layer.id === 'gang-op')?.description ??
      '';
    expect(description).toContain('39');
    expect(description).toContain('2 ride on an existing building');
    expect(description).toContain('Sunrise RV Park and Parlor Apartments');
    expect(description).toContain('37 are known by area only');
    expect(description).toContain('never a pin');
    expect(description).toContain('likely area');
    expect(description).toContain(GANG_OP_LICENSE);
  });

  it('Find Kind → Robberies turns gang ops on too (the pick is the request to see them)', () => {
    const robberies = layersWithCategoryEnabled(DEFAULT_LAYERS, 'robberies');
    expect(
      robberies.filter((l) => l.visible).map((l) => l.id).sort(),
    ).toEqual([
      'breakable',
      'gang-op',
      'loot-heists',
      'lootable',
      'my-markers',
    ]);
  });
});
