import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { AtlasDatabase } from '../../src/db/repository';
import { COMPLETION_STORAGE_KEY } from '../../src/features/completion/store';
import type { StorageLike } from '../../src/features/categorise/storage';
import {
  loadGameDatabase,
  recordCompletion,
  recordSale,
  undoCompletion,
  undoSale,
  type RecordCompletionInput,
} from '../../src/features/completion/record';
import { setProgress } from '../../src/domain/game-db';
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

let db: AtlasDatabase;
let storage: StorageLike;
beforeEach(() => {
  db = new AtlasDatabase(`completion-test-${crypto.randomUUID()}`);
  storage = memoryStorage();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

const deps = () => ({ repository: db, places, storage });

describe('recordCompletion — the one write path (DESIGN §3.4)', () => {
  it('collects a card through its legacy id and the rebuilt db agrees everywhere', async () => {
    const result = await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected', source: 'user' },
      deps(),
    );
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    // Legacy id redirects to the canonical checklist id — never a guess.
    expect(result.record?.target).toEqual({
      type: 'item',
      id: 'card-checklist:delights-dancers:vicki:standard',
    });
    expect(result.record?.verb).toBe('collected');
    expect(result.record?.count).toBe(1);
    expect(result.record?.source).toBe('user');
    expect(result.db?.completedItemIds.has('card-checklist:delights-dancers:vicki:standard')).toBe(
      true,
    );
    expect(setProgress(result.db!, 'delights-dancers').found).toBe(1);
    // Persisted: a fresh open reads the same record back.
    db.close();
    await db.open();
    const reloaded = await loadGameDatabase(deps());
    expect(reloaded.completedItemIds.has('card-checklist:delights-dancers:vicki:standard')).toBe(
      true,
    );
    expect(reloaded.records).toHaveLength(1);
  });

  it('a second collected for the same item is a no-op returning the existing record', async () => {
    const first = await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' },
      deps(),
    );
    const second = await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected', source: 'ask' },
      deps(),
    );
    expect(second.ok).toBe(true);
    expect(second.record?.id).toBe(first.record?.id);
    expect((await db.loadCompletion()).records).toHaveLength(1);
  });

  it('rejects illegal verbs with plain messages and writes nothing', async () => {
    const cases: { input: RecordCompletionInput; match: RegExp }[] = [
      {
        input: { target: { type: 'location', id: 'L629' }, verb: 'collected' as const },
        match: /only items can be collected/i,
      },
      {
        input: { target: { type: 'item', id: 'card:vicki' }, verb: 'discovered' as const },
        match: /cannot be discovered/i,
      },
      {
        input: { target: { type: 'item', id: 'card:vicki' }, verb: 'explored' as const },
        match: /cannot be explored/i,
      },
      {
        input: {
          target: { type: 'opportunity', id: 'opp:L629:shop:1' },
          verb: 'looted' as const,
        },
        match: /not a repeatable opportunity/i,
      },
      {
        input: { target: { type: 'item', id: 'card:vicki' }, verb: 'looted' as const },
        match: /only opportunities can be looted/i,
      },
      {
        input: { target: { type: 'location', id: 'L629' }, verb: 'looted' as const },
        match: /only opportunities can be looted/i,
      },
      {
        input: { target: { type: 'item', id: 'card:nope' }, verb: 'collected' as const },
        match: /no item with id "card:nope" exists/i,
      },
      {
        input: { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' as const, count: 2 },
        match: /always counts as 1/i,
      },
      {
        input: {
          target: { type: 'item', id: 'card:vicki' },
          verb: 'collected' as const,
          source: 'ai' as never,
        },
        match: /source must be/i,
      },
    ];
    for (const { input, match } of cases) {
      const result = await recordCompletion(input, deps());
      expect(result.ok).toBe(false);
      expect(result.code).toBe('validation');
      expect(result.error).toMatch(match);
    }
    expect((await db.loadCompletion()).records).toHaveLength(0);
  });

  it('loots a repeatable opportunity repeatedly and counts each time', async () => {
    const first = await recordCompletion(
      {
        target: { type: 'opportunity', id: 'opp:L360:robbery-shop:1' },
        verb: 'looted',
        note: 'used code 6823',
      },
      deps(),
    );
    expect(first.ok).toBe(true);
    expect(first.record?.note).toBe('used code 6823');
    const second = await recordCompletion(
      { target: { type: 'opportunity', id: 'opp:L360:robbery-shop:1' }, verb: 'looted' },
      deps(),
    );
    expect(second.ok).toBe(true);
    expect(second.record?.id).not.toBe(first.record?.id);
    expect(second.db?.completedOpportunityIds.get('opp:L360:robbery-shop:1')).toBe(2);
  });

  it('accepts discovered/explored on locations and opportunities, idempotently', async () => {
    const discovered = await recordCompletion(
      { target: { type: 'location', id: 'L629' }, verb: 'discovered' },
      deps(),
    );
    expect(discovered.ok).toBe(true);
    expect(discovered.db?.discoveredLocationIds.has('L629')).toBe(true);
    const again = await recordCompletion(
      { target: { type: 'location', id: 'L629' }, verb: 'discovered' },
      deps(),
    );
    expect(again.record?.id).toBe(discovered.record?.id);
    const explored = await recordCompletion(
      { target: { type: 'opportunity', id: 'opp:L629:interior:1' }, verb: 'explored' },
      deps(),
    );
    expect(explored.ok).toBe(true);
    expect(explored.db?.exploredLocationIds.has('L629')).toBe(true);
    expect((await db.loadCompletion()).records).toHaveLength(2);
  });

  it('accepts source screenshot (addendum §3.4)', async () => {
    const result = await recordCompletion(
      { target: { type: 'item', id: 'card:jason' }, verb: 'collected', source: 'screenshot' },
      deps(),
    );
    expect(result.ok).toBe(true);
    expect(result.record?.source).toBe('screenshot');
  });

  it('undoes a collected record by deleting it and a looted record with a compensating record', async () => {
    const collected = await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' },
      deps(),
    );
    await recordCompletion(
      { target: { type: 'opportunity', id: 'opp:L360:robbery-shop:1' }, verb: 'looted' },
      deps(),
    );
    await recordCompletion(
      { target: { type: 'opportunity', id: 'opp:L360:robbery-shop:1' }, verb: 'looted' },
      deps(),
    );
    const undoCollected = await undoCompletion(collected.record!.id, deps());
    expect(undoCollected.ok).toBe(true);
    expect(undoCollected.undoneId).toBe(collected.record!.id);
    expect(undoCollected.db?.completedItemIds.size).toBe(0);
    // The undo survives a restart: the record is gone after reopen.
    db.close();
    await db.open();
    expect((await loadGameDatabase(deps())).completedItemIds.size).toBe(0);

    const looted = (await db.loadCompletion()).records.find((r) => r.verb === 'looted')!;
    const undoLooted = await undoCompletion(looted.id, deps());
    expect(undoLooted.ok).toBe(true);
    expect(undoLooted.record?.count).toBe(-1);
    expect(undoLooted.record?.verb).toBe('looted');
    // Compensating ids sort after every +1 record (rec:undo-…), so
    // the step-1 accumulator — which reads in id order — can never
    // drop the -1 before the loots it compensates.
    expect(undoLooted.record?.id.startsWith('rec:undo-')).toBe(true);
    expect(undoLooted.db?.completedOpportunityIds.get('opp:L360:robbery-shop:1')).toBe(1);
    // Both the loot and its undo are in the log.
    const records = (await db.loadCompletion()).records;
    expect(records.filter((r) => r.verb === 'looted')).toHaveLength(3);
    // Undoing the undo itself is refused — it would append a second
    // -1 for a loot that is already undone.
    const undoUndo = await undoCompletion(undoLooted.record!.id, deps());
    expect(undoUndo.ok).toBe(false);
    expect(undoUndo.code).toBe('validation');
    expect((await db.loadCompletion()).records.filter((r) => r.verb === 'looted')).toHaveLength(3);

    const unknown = await undoCompletion('rec:missing', deps());
    expect(unknown.ok).toBe(false);
    expect(unknown.code).toBe('validation');
  }, 30000);

  it('reports storageError and leaves the old state on a failed write', async () => {
    const failWrite = () => {
      throw new Error('Simulated storage failure');
    };
    db.completionRecords.hook('creating', failWrite);
    const result = await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' },
      deps(),
    );
    db.completionRecords.hook('creating').unsubscribe(failWrite);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('storageError');
    expect(result.db?.completedItemIds.size).toBe(0);
    expect((await db.loadCompletion()).records).toHaveLength(0);
  });
});

describe('recordSale — sold is personal state, not completion (addendum §3.4)', () => {
  it('rejects a sale before the item is collected', async () => {
    const result = await recordSale({ itemId: 'card:vicki', price: 50 }, deps());
    expect(result.ok).toBe(false);
    expect(result.code).toBe('validation');
    expect(result.error).toMatch(/has not been collected yet/i);
    expect(await db.loadPersonalItemStates()).toHaveLength(0);
  });

  it('records a sale without moving completion, and undo keeps the row with soldAt null', async () => {
    await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' },
      deps(),
    );
    const sold = await recordSale({ itemId: 'card:vicki', price: 50 }, deps());
    expect(sold.ok).toBe(true);
    expect(sold.state?.soldAt).not.toBeNull();
    expect(sold.state?.soldPrice).toBe(50);
    const dbAfter = await loadGameDatabase(deps());
    expect(dbAfter.completedItemIds.has('card-checklist:delights-dancers:vicki:standard')).toBe(
      true,
    );
    expect(setProgress(dbAfter, 'delights-dancers').found).toBe(1);
    const undone = await undoSale('card:vicki', deps());
    expect(undone.ok).toBe(true);
    expect(undone.state?.soldAt).toBeNull();
    const rows = await db.loadPersonalItemStates();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.soldAt).toBeNull();
  });

  it('rejects a sale for an unknown item and a negative price', async () => {
    expect((await recordSale({ itemId: 'card:nope' }, deps())).ok).toBe(false);
    await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' },
      deps(),
    );
    const badPrice = await recordSale({ itemId: 'card:vicki', price: -5 }, deps());
    expect(badPrice.ok).toBe(false);
    expect(badPrice.error).toMatch(/price must be/i);
  });
});

describe('recordCompletion runs the v3 migration first', () => {
  it('converts a visited card before the new write, so the no-op sees it', async () => {
    storage.setItem(
      COMPLETION_STORAGE_KEY,
      JSON.stringify({ missions: 10, 'gang-ops': 0, stunts: 0 }),
    );
    await db.visited.put({ placeId: 'card:vicki', visitedAt: '2026-11-20T10:00:00.000Z' });
    const result = await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' },
      deps(),
    );
    expect(result.ok).toBe(true);
    // No duplicate: the migration's collected record IS the record.
    expect(result.record?.id).toBe('rec:mig:visited:card:vicki');
    expect((await db.loadCompletion()).records).toHaveLength(1);
    expect((await db.loadCompletion()).reconciliation).toHaveLength(1);
    expect((await db.loadCompletion()).reconciliation[0]).toMatchObject({
      categoryId: 'missions',
      count: 10,
      basis: 'game-stat',
    });
    expect(storage.getItem(COMPLETION_STORAGE_KEY)).toBeNull();
  });
});
