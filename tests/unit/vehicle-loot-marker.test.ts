import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogueFromSnapshot, markerToPlace } from '../../src/data/catalogue';
import { parsePersonalMarker } from '../../src/db/backup';
import { AtlasDatabase } from '../../src/db/repository';
import { buildGameDatabase } from '../../src/domain/game-db';
import type { StorageLike } from '../../src/features/categorise/storage';
import { loadGameDatabase, recordCompletion } from '../../src/features/completion/record';
import { EMPTY_USER_DATA, type PersonalMarker, type Place, type UserData } from '../../src/domain/types';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const places: Place[] = catalogueFromSnapshot(snapshot);

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

const JOTTED_MARKER: PersonalMarker = {
  id: 'custom:brooks-boatworks-jot',
  title: 'Brooks Boatworks — my jot',
  description: 'Safe code 6823, Caracara in the garage',
  category: 'my-markers',
  icon: 'pin',
  kind: 'vehicle-loot',
  position: { x: -8000, y: 3000 },
  createdAt: '2026-11-26T10:00:00.000Z',
  updatedAt: '2026-11-26T10:00:00.000Z',
};

let db: AtlasDatabase;
let storage: StorageLike;
beforeEach(() => {
  db = new AtlasDatabase(`vehicle-loot-marker-test-${crypto.randomUUID()}`);
  storage = memoryStorage();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('vehicle-loot marker kind — the Demo C jot path', () => {
  it('a vehicle-loot marker becomes a personal place carrying the vehicle-loot tag', () => {
    const place = markerToPlace(JOTTED_MARKER);
    expect(place.layerId).toBe('my-markers');
    expect(place.evidence).toBe('personal');
    expect(place.tags).toContain('vehicle-loot');
    expect(place.position).toEqual({ x: -8000, y: 3000 });
  });

  it('the jot derives a repeatable vehicle-loot opportunity — with no invented loot', () => {
    const user: UserData = { ...EMPTY_USER_DATA, markers: [JOTTED_MARKER] };
    const gameDb = buildGameDatabase({ places, user });
    const location = gameDb.locations.get('custom:brooks-boatworks-jot')!;
    expect(location.evidence[0]?.kind).toBe('personal');
    expect(location.placement).toBe('pinned');
    const opps = gameDb.opportunitiesByLocation.get('custom:brooks-boatworks-jot')!;
    expect(opps.map((opp) => opp.kind)).toEqual(['vehicle-loot']);
    const vehicleLoot = opps[0]!;
    expect(vehicleLoot.repeatable).toBe(true);
    // The player's description is the loot — no code is ever
    // invented for a jot. The code lives in the description + the
    // looted record's note (commit 3), not on the opportunity.
    expect(vehicleLoot.loot).toBeUndefined();
    expect(vehicleLoot.detail).toBe('Vehicle or safe the player marked');
  });

  it('a jotted vehicle-loot spot can be marked looted, and the record survives a reopen', async () => {
    const user: UserData = { ...EMPTY_USER_DATA, markers: [JOTTED_MARKER] };
    const deps = () => ({ repository: db, places, storage, user });
    const result = await recordCompletion(
      {
        target: { type: 'opportunity', id: 'opp:custom:brooks-boatworks-jot:vehicle-loot:1' },
        verb: 'looted',
        source: 'user',
      },
      deps(),
    );
    expect(result.ok).toBe(true);
    expect(result.record?.verb).toBe('looted');
    expect(result.db?.completedOpportunityIds.get('opp:custom:brooks-boatworks-jot:vehicle-loot:1')).toBe(1);
    db.close();
    await db.open();
    const reloaded = await loadGameDatabase(deps());
    expect(
      reloaded.completedOpportunityIds.get('opp:custom:brooks-boatworks-jot:vehicle-loot:1'),
    ).toBe(1);
  });

  it('a vehicle-loot marker survives backup validation — and an unknown kind still fails', () => {
    const parsed = parsePersonalMarker({
      id: 'custom:brooks-boatworks-jot',
      title: 'Brooks Boatworks — my jot',
      description: 'Safe code 6823',
      category: 'my-markers',
      position: { x: -8000, y: 3000 },
      icon: 'pin',
      kind: 'vehicle-loot',
      createdAt: '2026-11-26T10:00:00.000Z',
      updatedAt: '2026-11-26T10:00:00.000Z',
    });
    expect(parsed.kind).toBe('vehicle-loot');
    expect(() =>
      parsePersonalMarker({
        id: 'custom:bad-kind',
        title: 'Bad',
        description: '',
        category: 'my-markers',
        position: { x: 0, y: 0 },
        icon: 'pin',
        kind: 'spaceship',
        createdAt: '2026-11-26T10:00:00.000Z',
        updatedAt: '2026-11-26T10:00:00.000Z',
      }),
    ).toThrow(/kind.*unsupported/);
  });
});
