import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { GANG_OP_PLACES } from '../../src/data/gang-operations';
import { buildGameDatabase, type GameDatabase } from '../../src/domain/game-db';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import {
  nothingShowing,
  regionsDrawnCount,
} from '../../src/features/map/empty-state';
import { gangOpLikelyAreas } from '../../src/features/map/likely-area';

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

function gangOpLayersOn(): typeof DEFAULT_LAYERS {
  return DEFAULT_LAYERS.map((layer) =>
    layer.id === 'gang-op' ? { ...layer, visible: true } : layer,
  );
}

describe('empty-state banner showing computation (v0.32 lane 3, Finding 3)', () => {
  it('regions drawn: the gang-op layer on draws 34 regions, so nothing is "not showing"', () => {
    const db = buildFullDb();
    const regions = regionsDrawnCount(db.areas, GANG_OP_PLACES, gangOpLayersOn());
    expect(regions).toBe(34);
    expect(regions).toBe(
      gangOpLikelyAreas(db.areas, GANG_OP_PLACES, gangOpLayersOn()).length,
    );
    // The R2e case: gang-op places carry no position, so the old
    // places-only count is 0 — yet the banner must NOT fire.
    expect(GANG_OP_PLACES.filter((p) => p.position)).toHaveLength(0);
    expect(nothingShowing(0, regions)).toBe(false);
  });

  it('regions drawn: the grouped count (13 rects) also suppresses the banner — any region counts', () => {
    expect(nothingShowing(0, 13)).toBe(false);
    expect(nothingShowing(0, 1)).toBe(false);
  });

  it('nothing drawn: layer off draws no regions, so the banner fires when no place shows either', () => {
    const db = buildFullDb();
    expect(regionsDrawnCount(db.areas, GANG_OP_PLACES, DEFAULT_LAYERS)).toBe(0);
    expect(nothingShowing(0, 0)).toBe(true);
  });

  it('nothing drawn: a revealed op with the layer off draws no region — the banner still fires', () => {
    const db = buildFullDb();
    // A reveal shows that place, never its layer (likely-area.ts):
    // regionsDrawnCount gates on layer visibility, like MapView.
    expect(regionsDrawnCount(db.areas, GANG_OP_PLACES, DEFAULT_LAYERS)).toBe(0);
    expect(nothingShowing(0, 0)).toBe(true);
  });

  it('nothing drawn: the 3 no-extent ops on their own draw nothing and must not count as showing', () => {
    const db = buildFullDb();
    const noExtent = GANG_OP_PLACES.filter((p) =>
      ['gang-op:fishing-shacks', 'gang-op:chatfield-storage-logistics', 'gang-op:vespucci-mansion'].includes(p.id),
    );
    expect(noExtent).toHaveLength(3);
    expect(regionsDrawnCount(db.areas, noExtent, gangOpLayersOn())).toBe(0);
    expect(nothingShowing(0, 0)).toBe(true);
  });

  it('nothing drawn: no areas yet (game db still loading) draws nothing', () => {
    expect(regionsDrawnCount(null, GANG_OP_PLACES, gangOpLayersOn())).toBe(0);
    expect(regionsDrawnCount(undefined, GANG_OP_PLACES, gangOpLayersOn())).toBe(0);
  });

  it('places showing suppress the banner with or without regions', () => {
    expect(nothingShowing(1, 0)).toBe(false);
    expect(nothingShowing(27, 0)).toBe(false);
    expect(nothingShowing(5, 34)).toBe(false);
  });
});
