/**
 * County stunt jumps + 100% completion thresholds.
 *
 * Expected values come from duanhesen/gta6-leonida-map-data
 * (gta6maps.io), CC BY 4.0, commit
 * 1c5977bb9c40401667a192f14239beebbde54211 (2026-11-23):
 * - `data/leonida-counties-summary.csv` — stunt jumps per county
 * - `data/completion-100-thresholds.json` — 19 threshold categories
 * The source files live outside this repo, so the values are asserted
 * here as the verified numbers (see src/data/completion.ts) and the
 * tests check internal consistency: sums, breakdowns, clamping.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { COUNTIES } from '../../src/data/counties';
import {
  COMPLETION_REQUIRED_TOTAL,
  COMPLETION_THRESHOLDS,
  COUNTY_STUNT_JUMPS,
  STUNT_JUMPS_TOTAL,
  clampFound,
  completionThresholdById,
  overallCompletion,
  stuntJumpsByCounty,
  thresholdProgress,
} from '../../src/data/completion';
import {
  COMPLETION_STORAGE_KEY,
  parseCompletionCounts,
  saveCompletionCounts,
  serializeCompletionCounts,
  useCompletionStore,
  type StorageLike,
} from '../../src/features/completion/store';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

describe('county stunt jumps', () => {
  it('every county carries the CSV stunt-jump count', () => {
    const expected: Record<string, number> = {
      'vice-dale': 53,
      kelly: 29,
      lummox: 19,
      mariana: 16,
      leonard: 13,
    };
    expect(COUNTIES).toHaveLength(5);
    for (const county of COUNTIES) {
      expect(county.stuntJumps).toBe(expected[county.id]);
    }
  });

  it('per-county jumps sum to the 130 total', () => {
    const sum = COUNTIES.reduce((total, county) => total + county.stuntJumps, 0);
    expect(sum).toBe(130);
    expect(STUNT_JUMPS_TOTAL).toBe(130);
    expect(Object.values(COUNTY_STUNT_JUMPS).reduce((a, b) => a + b, 0)).toBe(130);
  });

  it('stuntJumpsByCounty lists every county in picker order with its jumps', () => {
    const byCounty = stuntJumpsByCounty();
    expect(byCounty).toHaveLength(5);
    expect(byCounty.map((entry) => entry.id)).toEqual(COUNTIES.map((county) => county.id));
    expect(byCounty.find((entry) => entry.id === 'vice-dale')).toEqual({
      id: 'vice-dale',
      name: 'Vice-Dale',
      jumps: 53,
    });
    expect(byCounty.reduce((total, entry) => total + entry.jumps, 0)).toBe(130);
  });
});

describe('completion thresholds', () => {
  it('has the 19 categories from the source file, in order', () => {
    expect(COMPLETION_THRESHOLDS).toHaveLength(19);
    expect(COMPLETION_THRESHOLDS.map((t) => t.id)).toEqual([
      'missions',
      'gang-ops',
      'bank-jobs',
      'payday-loans',
      'smash-grabs',
      'store-stickups',
      'card-sets',
      'flamingos',
      'waink-scans',
      'stunts',
      'underwater',
      'magazines',
      'meditation',
      'vehicles',
      'animals',
      'hunting',
      'hoops',
      'drone-trials',
      'range-gold',
    ]);
    const ids = new Set(COMPLETION_THRESHOLDS.map((t) => t.id));
    expect(ids.size).toBe(19);
    const names = new Set(COMPLETION_THRESHOLDS.map((t) => t.name));
    expect(names.size).toBe(19);
  });

  it('required never exceeds the in-game total', () => {
    for (const threshold of COMPLETION_THRESHOLDS) {
      expect(threshold.required).toBeGreaterThan(0);
      expect(threshold.total).toBeGreaterThanOrEqual(threshold.required);
    }
  });

  it('required sums to 1,325 and totals to 1,962', () => {
    expect(COMPLETION_REQUIRED_TOTAL).toBe(1325);
    expect(COMPLETION_THRESHOLDS.reduce((sum, t) => sum + t.required, 0)).toBe(1325);
    expect(COMPLETION_THRESHOLDS.reduce((sum, t) => sum + t.total, 0)).toBe(1962);
  });

  it('carries the headline categories with their source numbers', () => {
    expect(completionThresholdById('missions')).toMatchObject({ required: 91, total: 91 });
    expect(completionThresholdById('card-sets')).toMatchObject({
      required: 15,
      total: 18,
      totalItems: 480,
    });
    expect(completionThresholdById('flamingos')).toMatchObject({ required: 100, total: 125 });
    expect(completionThresholdById('waink-scans')).toMatchObject({ required: 100, total: 100 });
    expect(completionThresholdById('vehicles')).toMatchObject({ required: 200, total: 557 });
    expect(completionThresholdById('animals')).toMatchObject({ required: 100, total: 255 });
    expect(completionThresholdById('stunts')).toMatchObject({
      required: 300,
      total: 397,
      trophyThreshold: 250,
    });
  });

  it('the stunts breakdown adds up to the 397 total', () => {
    const stunts = completionThresholdById('stunts')!;
    expect(stunts.breakdown).toHaveLength(4);
    expect(stunts.breakdown!.reduce((sum, part) => sum + part.count, 0)).toBe(397);
    expect(stunts.breakdown!.find((part) => part.label === 'Stunt jumps')?.count).toBe(130);
  });

  it('carries no chapter, mission-name, safehouse or cheat content', () => {
    const text = JSON.stringify(COMPLETION_THRESHOLDS);
    for (const spoiler of [
      'Paradise',
      'Vice City, Baby',
      'Top of the World',
      'Daily Driver',
      'safehouse',
      'chapter',
      'cheat',
    ]) {
      expect(text.toLowerCase()).not.toContain(spoiler.toLowerCase());
    }
  });
});

describe('threshold math', () => {
  const missions = completionThresholdById('missions')!;
  const flamingos = completionThresholdById('flamingos')!;

  it('clamps counts into [0, total] as integers', () => {
    expect(clampFound(-3, missions)).toBe(0);
    expect(clampFound(0, missions)).toBe(0);
    expect(clampFound(45.9, missions)).toBe(45);
    expect(clampFound(91, missions)).toBe(91);
    expect(clampFound(200, missions)).toBe(91);
    expect(clampFound(Number.NaN, missions)).toBe(0);
    expect(clampFound(150, flamingos)).toBe(125);
  });

  it('progress reports both required and total percentages', () => {
    const half = thresholdProgress(50, flamingos);
    expect(half).toMatchObject({ found: 50, required: 100, total: 125, done: false });
    expect(half.pctRequired).toBeCloseTo(0.5);
    expect(half.pctTotal).toBeCloseTo(0.4);
    const over = thresholdProgress(125, flamingos);
    expect(over.done).toBe(true);
    expect(over.pctRequired).toBe(1);
    expect(over.pctTotal).toBe(1);
  });

  it('overall completion caps each category at its requirement', () => {
    expect(overallCompletion({})).toMatchObject({ found: 0, required: 1325, pct: 0 });
    const all = Object.fromEntries(
      COMPLETION_THRESHOLDS.map((t) => [t.id, t.total]),
    );
    const done = overallCompletion(all);
    expect(done).toMatchObject({ found: 1325, pct: 1, doneCategories: 19 });
    // Over-finding one category cannot mask another: 125 flamingos
    // (25 over the 100 required) still only counts 100 toward 1,325.
    const onlyFlamingos = overallCompletion({ flamingos: 125 });
    expect(onlyFlamingos).toMatchObject({ found: 100, doneCategories: 1 });
    expect(onlyFlamingos.pct).toBeCloseTo(100 / 1325);
  });
});

describe('completion storage', () => {
  it('parses stored counts, dropping unknown ids and bad values', () => {
    expect(parseCompletionCounts(null)).toEqual({});
    expect(parseCompletionCounts('not json')).toEqual({});
    expect(parseCompletionCounts('[1,2]')).toEqual({});
    expect(
      parseCompletionCounts(
        JSON.stringify({
          missions: 12,
          flamingos: 999,
          stunts: -4,
          'made-up-id': 7,
          vehicles: 'ten',
        }),
      ),
    ).toEqual({ missions: 12, flamingos: 125, stunts: 0 });
  });

  it('serializes and saves with a read-back check', () => {
    const storage = memoryStorage();
    expect(saveCompletionCounts(storage, { missions: 12 })).toBe(true);
    expect(storage.getItem(COMPLETION_STORAGE_KEY)).toBe(
      serializeCompletionCounts({ missions: 12 }),
    );
    expect(saveCompletionCounts(null, { missions: 1 })).toBe(false);
  });

  it('a failing write reports false and keeps the old value', () => {
    const throwing: StorageLike = {
      getItem: () => JSON.stringify({ missions: 5 }),
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(saveCompletionCounts(throwing, { missions: 6 })).toBe(false);
    expect(throwing.getItem(COMPLETION_STORAGE_KEY)).toBe(JSON.stringify({ missions: 5 }));
  });
});

describe('completion store', () => {
  beforeEach(() => {
    useCompletionStore.setState({ counts: {}, loaded: false, storageError: null });
  });

  it('loads, adjusts and persists counts', () => {
    const storage = memoryStorage({
      [COMPLETION_STORAGE_KEY]: JSON.stringify({ missions: 10 }),
    });
    const store = useCompletionStore.getState();
    store.load(storage);
    expect(useCompletionStore.getState().counts).toEqual({ missions: 10 });
    expect(useCompletionStore.getState().loaded).toBe(true);
    expect(useCompletionStore.getState().adjust('missions', 1, storage)).toBe(true);
    expect(useCompletionStore.getState().counts).toEqual({ missions: 11 });
    expect(parseCompletionCounts(storage.getItem(COMPLETION_STORAGE_KEY))).toEqual({
      missions: 11,
    });
  });

  it('clamps through the store and refuses unknown ids', () => {
    const storage = memoryStorage();
    const store = useCompletionStore.getState();
    store.load(storage);
    expect(store.setCount('missions', 500, storage)).toBe(true);
    expect(useCompletionStore.getState().counts.missions).toBe(91);
    expect(store.setCount('not-a-category', 1, storage)).toBe(false);
    expect(store.adjust('missions', -200, storage)).toBe(true);
    expect(useCompletionStore.getState().counts.missions).toBe(0);
  });

  it('a failed write leaves the old counts on screen and reports the error', () => {
    const storage = memoryStorage({
      [COMPLETION_STORAGE_KEY]: JSON.stringify({ missions: 3 }),
    });
    const store = useCompletionStore.getState();
    store.load(storage);
    const throwing: StorageLike = {
      getItem: (key) => storage.getItem(key),
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(store.setCount('missions', 4, throwing)).toBe(false);
    expect(useCompletionStore.getState().counts).toEqual({ missions: 3 });
    expect(useCompletionStore.getState().storageError).toMatch(/Could not save/);
  });

  it('resetAll clears every count after a verified write', () => {
    const storage = memoryStorage({
      [COMPLETION_STORAGE_KEY]: JSON.stringify({ missions: 3, flamingos: 40 }),
    });
    const store = useCompletionStore.getState();
    store.load(storage);
    expect(store.resetAll(storage)).toBe(true);
    expect(useCompletionStore.getState().counts).toEqual({});
    expect(parseCompletionCounts(storage.getItem(COMPLETION_STORAGE_KEY))).toEqual({});
  });
});
