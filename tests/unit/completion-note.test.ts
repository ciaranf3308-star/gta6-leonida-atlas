import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { parseCompletionRecord } from '../../src/db/backup';
import { AtlasDatabase } from '../../src/db/repository';
import type { StorageLike } from '../../src/features/categorise/storage';
import {
  attachCompletionNote,
  loadGameDatabase,
  recordCompletion,
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

const BROOKS_GANG_OP = 'opp:gang-op:brooks-boatworks:gang-op:1';

let db: AtlasDatabase;
let storage: StorageLike;
beforeEach(() => {
  db = new AtlasDatabase(`completion-note-test-${crypto.randomUUID()}`);
  storage = memoryStorage();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

const deps = () => ({ repository: db, places, storage });

async function lootBrooks() {
  const result = await recordCompletion(
    { target: { type: 'opportunity', id: BROOKS_GANG_OP }, verb: 'looted', source: 'user' },
    deps(),
  );
  expect(result.ok).toBe(true);
  return result.record!;
}

describe('attachCompletionNote — the no-key note on a looted record (Demo C)', () => {
  it('attaches a safe-code note to a looted record, and it survives a reopen', async () => {
    const record = await lootBrooks();
    const attached = await attachCompletionNote(record.id, 'used code 6823', deps());
    expect(attached.ok).toBe(true);
    expect(attached.record?.note).toBe('used code 6823');
    expect(attached.record?.id).toBe(record.id);
    // The loot itself is untouched — only the note changed.
    expect(attached.record?.verb).toBe('looted');
    expect(attached.record?.count).toBe(1);
    expect(attached.record?.at).toBe(record.at);
    db.close();
    await db.open();
    const reloaded = await loadGameDatabase(deps());
    const found = reloaded.records.find((candidate) => candidate.id === record.id);
    expect(found?.note).toBe('used code 6823');
    // The note target is the same record Undo targets.
    expect(latestLootedRecordFor(reloaded, BROOKS_GANG_OP)?.id).toBe(record.id);
    expect(latestLootedRecordFor(reloaded, BROOKS_GANG_OP)?.note).toBe('used code 6823');
  }, 20_000);

  it('replacing a note overwrites it; an empty note clears it', async () => {
    const record = await lootBrooks();
    const first = await attachCompletionNote(record.id, 'used code 6823', deps());
    expect(first.record?.note).toBe('used code 6823');
    const second = await attachCompletionNote(record.id, 'used code 6823, second safe by screwdriver', deps());
    expect(second.ok).toBe(true);
    expect(second.record?.note).toBe('used code 6823, second safe by screwdriver');
    const cleared = await attachCompletionNote(record.id, '   ', deps());
    expect(cleared.ok).toBe(true);
    expect(cleared.record?.note).toBeUndefined();
    const reloaded = await loadGameDatabase(deps());
    expect(
      reloaded.records.find((candidate) => candidate.id === record.id)?.note,
    ).toBeUndefined();
  }, 20_000);

  it('rejects an unknown record, an over-long note, and a note on an undo', async () => {
    const record = await lootBrooks();
    const unknown = await attachCompletionNote('rec:nope', 'used code 6823', deps());
    expect(unknown.ok).toBe(false);
    expect(unknown.code).toBe('validation');
    const long = await attachCompletionNote(record.id, 'x'.repeat(501), deps());
    expect(long.ok).toBe(false);
    expect(long.code).toBe('validation');
    // The failed writes left the record untouched.
    const reloaded = await loadGameDatabase(deps());
    expect(
      reloaded.records.find((candidate) => candidate.id === record.id)?.note,
    ).toBeUndefined();
    // An undo (compensating -1 record) takes no note.
    const { undoCompletion } = await import('../../src/features/completion/record');
    const undone = await undoCompletion(record.id, deps());
    expect(undone.ok).toBe(true);
    expect(undone.record).toBeDefined();
    const onUndo = await attachCompletionNote(undone.record!.id, 'nope', deps());
    expect(onUndo.ok).toBe(false);
    expect(onUndo.code).toBe('validation');
  }, 20_000);

  it('a noted record keeps its note through backup validation (v4 export/import)', () => {
    const parsed = parseCompletionRecord({
      id: 'rec:note-kept',
      target: { type: 'opportunity', id: BROOKS_GANG_OP },
      verb: 'looted',
      count: 1,
      at: '2026-11-26T10:00:00.000Z',
      source: 'user',
      note: 'used code 6823',
    });
    expect(parsed.note).toBe('used code 6823');
    const unnoted = parseCompletionRecord({
      id: 'rec:no-note',
      target: { type: 'opportunity', id: BROOKS_GANG_OP },
      verb: 'looted',
      count: 1,
      at: '2026-11-26T10:00:00.000Z',
      source: 'user',
    });
    expect(unnoted.note).toBeUndefined();
  });
});
