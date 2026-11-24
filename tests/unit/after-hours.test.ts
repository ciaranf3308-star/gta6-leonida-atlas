import { describe, expect, it } from 'vitest';
import {
  loadSavedCamera,
  MAP_CAMERA_STORAGE_KEY,
  saveCamera,
  type SavedCamera,
} from '../../src/features/map/camera-persistence';
import { areaIsolation, countyIsolation } from '../../src/features/map/isolation';
import { COUNTIES } from '../../src/data/counties';

function memoryStorage(values: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(values));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('camera persistence (After Hours: resume where you left off)', () => {
  it('round-trips a saved camera', () => {
    const storage = memoryStorage();
    const camera: SavedCamera = { center: { x: -1000, y: 2000 }, zoom: -1.5 };
    saveCamera(camera, storage);
    expect(loadSavedCamera(storage)).toEqual(camera);
    expect(storage.getItem(MAP_CAMERA_STORAGE_KEY)).toContain('"zoom":-1.5');
  });

  it('returns null for missing, corrupt, or out-of-bounds values', () => {
    expect(loadSavedCamera(memoryStorage())).toBeNull();
    expect(loadSavedCamera(memoryStorage({ [MAP_CAMERA_STORAGE_KEY]: 'not json' }))).toBeNull();
    expect(
      loadSavedCamera(
        memoryStorage({
          [MAP_CAMERA_STORAGE_KEY]: JSON.stringify({ center: { x: 999999, y: 0 }, zoom: 0 }),
        }),
      ),
    ).toBeNull();
    expect(
      loadSavedCamera(
        memoryStorage({
          [MAP_CAMERA_STORAGE_KEY]: JSON.stringify({ center: { x: 0, y: 0 }, zoom: 'far' }),
        }),
      ),
    ).toBeNull();
  });

  it('clamps the zoom into the basemap range', () => {
    const storage = memoryStorage({
      [MAP_CAMERA_STORAGE_KEY]: JSON.stringify({ center: { x: 0, y: 0 }, zoom: 99 }),
    });
    expect(loadSavedCamera(storage)?.zoom).toBe(1);
  });

  it('never throws when storage is unavailable', () => {
    expect(() => saveCamera({ center: { x: 0, y: 0 }, zoom: 0 }, null)).not.toThrow();
    expect(loadSavedCamera(null)).toBeNull();
  });
});

describe('isolation subtitle (After Hours: the on-map title line)', () => {
  it('county isolation names the county area as its subtitle and carries the county id', () => {
    const county = COUNTIES.find((c) => c.id === 'lummox')!;
    const isolation = countyIsolation(county);
    expect(isolation).not.toBeNull();
    expect(isolation?.label).toBe(county.name);
    expect(isolation?.subtitle).toBe(county.area);
    // The id is what lets the map draw the traced coastline, not the rect.
    expect(isolation?.countyId).toBe('lummox');
  });

  it('area isolation reports how many places are inside it', () => {
    const places = [
      { region: 'Capri', position: { x: -6500, y: 0 } },
      { region: 'Capri', position: { x: -6400, y: 100 } },
      { region: 'Vice City', position: { x: 0, y: 0 } },
    ] as unknown as Parameters<typeof areaIsolation>[1];
    const isolation = areaIsolation('Capri', places);
    expect(isolation?.subtitle).toBe('2 places');
  });
});

describe('county photography (After Hours: art-directed region cards)', () => {
  it('every county has a photo path under assets/after-hours/', () => {
    expect(COUNTIES).toHaveLength(5);
    for (const county of COUNTIES) {
      expect(county.photo).toMatch(/^assets\/after-hours\/county-[a-z-]+\.jpg$/);
    }
  });
});
