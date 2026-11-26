import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { AtlasDatabase } from '../../src/db/repository';
import type { StorageLike } from '../../src/features/categorise/storage';
import {
  recordCompletion,
  undoCompletion,
} from '../../src/features/completion/record';
import { latestLootedRecordFor } from '../../src/features/completion/place-ids';
import type { Place } from '../../src/domain/types';

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

function memoryStorage(): StorageLike {
  const store = new Map<string, string>();
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

let db: AtlasDatabase;
let storage: StorageLike;
beforeEach(() => {
  db = new AtlasDatabase(`completion-undo-test-${crypto.randomUUID()}`);
  storage = memoryStorage();
});
afterEach(async () => {
  await db.delete();
});

const deps = () => ({ repository: db, places, storage });

/** The Demo B loot target: L1614's break-in opportunity. */
const BREAK_IN_OPP = 'opp:L1614:break-in:1';

describe('undoCompletion — undoing a looted record (v0.32 step-9, Demo B step 3)', () => {
  it(
    'undo of a looted record decrements the count via a compensating record',
    async () => {
    const first = await recordCompletion(
      { target: { type: 'opportunity', id: BREAK_IN_OPP }, verb: 'looted' },
      deps(),
    );
    expect(first.ok).toBe(true);
    const second = await recordCompletion(
      { target: { type: 'opportunity', id: BREAK_IN_OPP }, verb: 'looted' },
      deps(),
    );
    expect(second.ok).toBe(true);
    expect(second.db!.completedOpportunityIds.get(BREAK_IN_OPP)).toBe(2);

    // The card's Undo targets the latest still-standing loot.
    const target = latestLootedRecordFor(second.db!, BREAK_IN_OPP);
    expect(target?.id).toBe(second.record!.id);

    const undone = await undoCompletion(target!.id, deps());
    expect(undone.ok).toBe(true);
    // The undo IS a record: a -1 compensating record, in the log.
    expect(undone.record?.count).toBe(-1);
    expect(undone.record?.target).toEqual({
      type: 'opportunity',
      id: BREAK_IN_OPP,
    });
    expect(undone.record?.verb).toBe('looted');
    // …and the count went 2 → 1, not 2 → 0, and both +1s are still there.
    expect(undone.db!.completedOpportunityIds.get(BREAK_IN_OPP)).toBe(1);
    expect(
      undone.db!.records.filter(
        (record) =>
          record.target.type === 'opportunity' &&
          record.target.id === BREAK_IN_OPP &&
          record.verb === 'looted' &&
          record.count > 0,
      ),
    ).toHaveLength(2);

    // Undo again: 1 → 0, and the opportunity leaves the completed map.
    const target2 = latestLootedRecordFor(undone.db!, BREAK_IN_OPP);
    const undone2 = await undoCompletion(target2!.id, deps());
    expect(undone2.ok).toBe(true);
    expect(undone2.db!.completedOpportunityIds.has(BREAK_IN_OPP)).toBe(false);
    // Nothing left to undo.
    expect(latestLootedRecordFor(undone2.db!, BREAK_IN_OPP)).toBeUndefined();
    },
    // Four write cycles through the full-catalogue path: slow under
    // load (each reloads the catalogue + migration), so the default
    // 5s timeout flakes. The slowness is the test harness, not the
    // undo — the second test below does one cycle and fits in 5s.
    30000,
  );

  it('a compensating record is itself an undo and cannot be undone', async () => {
    const looted = await recordCompletion(
      { target: { type: 'opportunity', id: BREAK_IN_OPP }, verb: 'looted' },
      deps(),
    );
    const undone = await undoCompletion(looted.record!.id, deps());
    expect(undone.ok).toBe(true);
    const again = await undoCompletion(undone.record!.id, deps());
    expect(again.ok).toBe(false);
    expect(again.error).toMatch(/already an undo/);
  });
});
