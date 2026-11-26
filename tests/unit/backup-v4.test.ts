import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  AtlasDatabase,
  atlasRepository,
  ensureCompletionMigration,
  getCompletionMigrationLog,
} from '../../src/db/repository';
import {
  parseBackup,
  parseBackupFile,
  parseBackupV4,
  parseBackupV4WithDrops,
} from '../../src/db/backup';
import { importAtlasBackup } from '../../src/db/backup-import';
import { AiIndexDatabase, loadAiIndex, mergeImportedAiIndex } from '../../src/db/ai-index';
import { COMPLETION_STORAGE_KEY } from '../../src/features/completion/store';
import type { StorageLike } from '../../src/features/categorise/storage';
import { recordCompletion, recordSale } from '../../src/features/completion/record';
import type { Backup } from '../../src/domain/types';
import {
  buildGameDatabase,
  setProgress,
  type CompletionRecord,
} from '../../src/domain/game-db';
import type { Place } from '../../src/domain/types';
import {
  exportWorkspaceBackup,
  hydrateUserData,
  saveLocal,
  switchLocalWorkspace,
} from '../../src/stores/atlas';
import { backupFileName } from '../../src/features/backup/atlas-backup';
import { attemptFingerprint } from '../../src/features/ask/card-matcher';

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

const time = '2026-11-20T10:00:00.000Z';

/** In-memory localStorage stand-in (the tallies key lives there). */
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

/**
 * A v0.31.5-format backup — the FULL fixture, including the two rows
 * the v3 validator used to reject (see the validator-gap tests
 * below): the breakable marker `custom:breakable-house`, and the
 * visited row `custom:gone`, whose marker is gone. Both must import
 * cleanly now: the marker parses (kind 'breakable' is legal), and
 * the visited row restores as a `discovered` record on the id string.
 *
 * Sections: markers incl. kind workout AND breakable (with
 * color/createdAt), notes, user tags, favorites (incl. card:vicki),
 * a collection, 13 visited + 3 explored, tallies
 * {missions:10, gang-ops:5, card-sets:3, flamingos:0, stunts:250},
 * aiCategories + aiIndexJob.
 */
function v3Fixture(): Backup {
  return {
    format: 'leonida-atlas',
    version: 3,
    exportedAt: time,
    favorites: [
      { placeId: 'card:vicki', createdAt: time },
      { placeId: 'L629', createdAt: time },
      { placeId: 'custom:capri-gym', createdAt: time },
    ],
    notes: [
      { placeId: 'L629', text: 'Pool here', updatedAt: time },
      { placeId: 'custom:capri-gym', text: 'Garage gear', updatedAt: time },
    ],
    placeTags: [{ placeId: 'L629', tags: ['pool', 'nightlife'], updatedAt: time }],
    collections: [
      {
        id: 'favs',
        name: 'Favs',
        placeIds: ['card:vicki', 'L629', 'custom:capri-gym'],
        createdAt: time,
        updatedAt: time,
      },
    ],
    markers: [
      {
        id: 'custom:capri-gym',
        title: 'Capri garage gym',
        description: 'Gear in the garage',
        category: 'my-markers',
        position: { x: 100, y: 200 },
        icon: 'flag',
        kind: 'workout',
        color: '#73cbbb',
        createdAt: time,
        updatedAt: time,
      },
      {
        id: 'custom:breakable-house',
        title: 'Breakable house',
        description: 'Back door opens',
        category: 'my-markers',
        position: { x: 110, y: 210 },
        icon: 'pin',
        kind: 'breakable',
        color: '#ff8a5c',
        createdAt: time,
        updatedAt: time,
      },
    ],
    visited: [
      { placeId: 'card:vicki', visitedAt: time },
      { placeId: 'card:jason', visitedAt: time },
      { placeId: 'loot:guide-harley-card', visitedAt: time },
      { placeId: 'loot:guide-meditation-jasons-house', visitedAt: time },
      { placeId: 'loot:guide-job-bayside-lombank', visitedAt: time },
      { placeId: 'breakable:parlor-apartments', visitedAt: time },
      { placeId: 'L360', visitedAt: time },
      { placeId: 'L2380', visitedAt: time },
      { placeId: 'custom:breakable-house', visitedAt: time },
      { placeId: 'L629', visitedAt: time },
      { placeId: 'custom:capri-gym', visitedAt: time },
      { placeId: 'L99999', visitedAt: time },
      { placeId: 'custom:gone', visitedAt: time },
    ],
    explored: [
      { placeId: 'L629', exploredAt: time },
      { placeId: 'card:vicki', exploredAt: time },
      { placeId: 'L304', exploredAt: time },
    ],
    preferences: { reducedMotion: true, showLabels: false, clusterMarkers: true },
    aiCategories: [
      {
        placeId: 'L1',
        aiCategory: 'house',
        confidence: 0.9,
        reason: 'Imported suggestion.',
        model: 'test',
        indexedAt: time,
        status: 'suggested',
        source: 'ai',
      },
    ],
    aiIndexJob: {
      status: 'done',
      attemptedPlaceIds: ['L1'],
      resolverVersion: 3,
      updatedAt: time,
    },
  };
}

const talliesStorage = () =>
  memoryStorage({
    [COMPLETION_STORAGE_KEY]: JSON.stringify({
      missions: 10,
      'gang-ops': 5,
      'card-sets': 3,
      flamingos: 0,
      stunts: 250,
    }),
  });

let dbName: string;
let db: AtlasDatabase;
let aiDb: AiIndexDatabase;
beforeEach(() => {
  dbName = `backup-v4-test-${crypto.randomUUID()}`;
  db = new AtlasDatabase(dbName);
  aiDb = new AiIndexDatabase(`backup-v4-ai-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await db.delete().catch(() => undefined);
  await aiDb.delete().catch(() => undefined);
});

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
const byMarkerId = byId;
const byCategory = (a: { categoryId: string }, b: { categoryId: string }) =>
  a.categoryId < b.categoryId ? -1 : 1;
const byItem = (a: { itemId: string }, b: { itemId: string }) =>
  a.itemId < b.itemId ? -1 : 1;

describe('backup v4 — the two validator gaps (step 3)', () => {
  it('imports a v3 backup carrying a breakable marker', () => {
    const parsed = parseBackup(v3Fixture());
    expect(parsed.markers).toHaveLength(2);
    const breakable = parsed.markers.find((m) => m.id === 'custom:breakable-house')!;
    expect(breakable.kind).toBe('breakable');
    expect(breakable.color).toBe('#ff8a5c');
    expect(breakable.createdAt).toBe(time);
    const workout = parsed.markers.find((m) => m.id === 'custom:capri-gym')!;
    expect(workout.kind).toBe('workout');
    expect(workout.color).toBe('#73cbbb');
    expect(() => parseBackup({ ...v3Fixture(), markers: [{ ...v3Fixture().markers[0]!, kind: 'sideways' }] })).toThrow(
      /kind/i,
    );
  });

  it('imports visited/explored rows pointing at a deleted custom:* marker', () => {
    const parsed = parseBackup(v3Fixture());
    expect(parsed.visited.map((v) => v.placeId)).toContain('custom:gone');
    expect(parsed.visited).toHaveLength(13);
    expect(parsed.explored).toHaveLength(3);
    // A dangling explored row is the same class: a completion input,
    // not a dangling link.
    const dangling = v3Fixture();
    dangling.explored = [...dangling.explored, { placeId: 'custom:gone', exploredAt: time }];
    expect(parseBackup(dangling).explored).toHaveLength(4);
  });

  it('still rejects favorites, notes, tags and collections on a missing marker', () => {
    const note = v3Fixture();
    note.notes[0]!.placeId = 'custom:missing';
    expect(() => parseBackup(note)).toThrow(/missing|reference/i);
    const collection = v3Fixture();
    collection.collections[0]!.placeIds.push('custom:missing');
    expect(() => parseBackup(collection)).toThrow(/missing|reference/i);
    const favorite = v3Fixture();
    favorite.favorites.push({ placeId: 'custom:missing', createdAt: time });
    expect(() => parseBackup(favorite)).toThrow(/missing|reference/i);
  });
});

describe('backup v4 — validation of the new sections', () => {
  function v4Base(): Record<string, unknown> {
    return {
      ...v3Fixture(),
      version: 4,
      completionRecords: [],
      reconciliation: [],
      enrichments: [],
      corrections: [],
      personalItemState: [],
    };
  }

  const oneRecord = (overrides: Partial<CompletionRecord> = {}): CompletionRecord => ({
    id: 'rec:550e8400-e29b-41d4-a716-446655440000',
    target: { type: 'item', id: 'card-checklist:delights-dancers:vicki:standard' },
    verb: 'collected',
    count: 1,
    at: time,
    source: 'user',
    ...overrides,
  });

  it('accepts the screenshot completion source (addendum §3.4, not DESIGN §11)', () => {
    const input = v4Base();
    input.completionRecords = [oneRecord({ source: 'screenshot', note: 'matched from screenshot shot:1' })];
    expect(parseBackupV4(input).completionRecords[0]?.source).toBe('screenshot');
    for (const source of ['user', 'ask', 'import']) {
      const attempt = v4Base();
      attempt.completionRecords = [oneRecord({ source: source as CompletionRecord['source'] })];
      expect(parseBackupV4(attempt).completionRecords).toHaveLength(1);
    }
    const bad = v4Base();
    bad.completionRecords = [{ ...oneRecord(), source: 'ai' }];
    // An unsupported source is invalid — and invalid completion
    // records are dropped and counted (DESIGN §11), never fail-fast.
    const dropped = parseBackupV4WithDrops(bad);
    expect(dropped.backup.completionRecords).toHaveLength(0);
    expect(dropped.droppedCompletionRecords).toHaveLength(1);
    expect(dropped.droppedCompletionRecords[0]?.reason).toMatch(/source/i);
  });

  it('enforces the §11 count rules by dropping, not failing: collected is 1, only looted may be -1', () => {
    // The validation rules are unchanged from the step-3 lane (bad
    // verb, bad count, bad target are all still invalid) — only the
    // handling changed: invalid records are dropped and counted.
    const collected = v4Base();
    collected.completionRecords = [oneRecord({ count: 2 })];
    const droppedCount = parseBackupV4WithDrops(collected);
    expect(droppedCount.backup.completionRecords).toHaveLength(0);
    expect(droppedCount.droppedCompletionRecords).toHaveLength(1);
    expect(droppedCount.droppedCompletionRecords[0]?.reason).toMatch(/count/i);
    const undo = v4Base();
    undo.completionRecords = [
      oneRecord({
        id: 'rec:undo-550e8400-e29b-41d4-a716-446655440000',
        target: { type: 'opportunity', id: 'opp:L360:robbery-shop:1' },
        verb: 'looted',
        count: -1,
      }),
    ];
    expect(parseBackupV4(undo).completionRecords).toHaveLength(1);
    const badUndo = v4Base();
    badUndo.completionRecords = [oneRecord({ verb: 'discovered', count: -1 })];
    expect(parseBackupV4WithDrops(badUndo).droppedCompletionRecords).toHaveLength(1);
    expect(parseBackupV4WithDrops(badUndo).droppedCompletionRecords[0]?.reason).toMatch(
      /count/i,
    );
    const badVerb = v4Base();
    badVerb.completionRecords = [{ ...oneRecord(), verb: 'found' }];
    const droppedVerb = parseBackupV4WithDrops(badVerb);
    expect(droppedVerb.backup.completionRecords).toHaveLength(0);
    expect(droppedVerb.droppedCompletionRecords[0]?.reason).toMatch(/verb/i);
    const badTarget = v4Base();
    badTarget.completionRecords = [{ ...oneRecord(), target: { type: 'place', id: 'L629' } }];
    const droppedTarget = parseBackupV4WithDrops(badTarget);
    expect(droppedTarget.droppedCompletionRecords[0]?.reason).toMatch(/target/i);
    // A file mixing valid and invalid records keeps the valid ones.
    const mixed = v4Base();
    mixed.completionRecords = [
      oneRecord(),
      { ...oneRecord(), id: 'rec:bad-550e8400-e29b-41d4-a716-446655440000', verb: 'found' },
      oneRecord({
        id: 'rec:second-550e8400-e29b-41d4-a716-446655440000',
        target: { type: 'opportunity', id: 'opp:L360:robbery-shop:1' },
        verb: 'looted',
      }),
    ];
    const parsedMixed = parseBackupV4WithDrops(mixed);
    expect(parsedMixed.backup.completionRecords).toHaveLength(2);
    expect(parsedMixed.droppedCompletionRecords).toHaveLength(1);
    expect(parsedMixed.droppedCompletionRecords[0]?.index).toBe(1);
  });

  it('drops a citation-less enrichment field and a stored superseded flag, never the row', () => {
    const input = v4Base();
    input.enrichments = [
      {
        id: 'enr:L629:1',
        locationId: 'L629',
        schemaVersion: 1,
        researchedAt: time,
        researchedBy: 'gpt-4o-mini',
        fields: [
          {
            kind: 'identity',
            text: 'Delights is a strip club.',
            confidence: 0.8,
            sources: [
              { title: 'PowerPyx guide', url: 'https://example.com/guide', quote: 'Delights.' },
            ],
            status: 'ai-suggested',
          },
          // No citation — dropped at write time (addendum §2.4).
          { kind: 'loot', text: 'A safe.', confidence: 0.9, sources: [], status: 'ai-suggested' },
        ],
        imagery: [],
        question: 'what shop is this?',
      },
    ];
    const parsed = parseBackupV4(input);
    expect(parsed.enrichments).toHaveLength(1);
    expect(parsed.enrichments[0]?.fields).toHaveLength(1);
    expect(parsed.enrichments[0]?.fields[0]?.kind).toBe('identity');
    input.reconciliation = [
      { categoryId: 'missions', count: 10, basis: 'game-stat', at: time, superseded: true },
    ];
    const withTally = parseBackupV4(input);
    expect(withTally.reconciliation).toEqual([
      { categoryId: 'missions', count: 10, basis: 'game-stat', at: time },
    ]);
    expect(withTally.reconciliation[0]).not.toHaveProperty('superseded');
  });

  it('drops duplicate completion ids, still rejects duplicates elsewhere; ignores screenshot/research sections', () => {
    // A duplicate completion id is an invalid completion record, so
    // it is dropped and counted like any other (DESIGN §11) — the
    // first record survives, the import does not fail.
    const dup = v4Base();
    dup.completionRecords = [oneRecord(), oneRecord()];
    const droppedDup = parseBackupV4WithDrops(dup);
    expect(droppedDup.backup.completionRecords).toHaveLength(1);
    expect(droppedDup.droppedCompletionRecords).toHaveLength(1);
    expect(droppedDup.droppedCompletionRecords[0]?.reason).toMatch(/duplicate/i);
    // Every other section keeps its fail-fast contract: a duplicate
    // reconciliation entry still fails the whole import.
    const dupTally = v4Base();
    dupTally.reconciliation = [
      { categoryId: 'missions', count: 10, basis: 'game-stat', at: time },
      { categoryId: 'missions', count: 11, basis: 'game-stat', at: time },
    ];
    expect(() => parseBackupV4(dupTally)).toThrow(/duplicate/i);
    // Step-3 follow-up ruling 1: a v4 file carrying userScreenshots
    // or researchRequests sections is IGNORED, not rejected — even a
    // malformed row in them cannot fail the import of the valid
    // sections. The sections are not in v4 (addendum lines 518,
    // 725); the rows were never restorable (dangling blobIds), so
    // ignoring them loses nothing importable.
    const carried = v4Base();
    carried.userScreenshots = [
      { id: 'shot:1', at: time, kind: 'card-front', setId: 'delights-dancers', blobId: 'blob:1' },
    ];
    carried.researchRequests = [
      {
        id: 'req:1',
        targetType: 'item',
        targetId: 'card:vicki',
        question: 'Where is the Vicki card?',
        requestedAt: time,
        status: 'queued',
      },
    ];
    const parsedCarried = parseBackupV4(carried);
    expect(parsedCarried).not.toHaveProperty('userScreenshots');
    expect(parsedCarried).not.toHaveProperty('researchRequests');
    const malformed = v4Base();
    malformed.userScreenshots = [
      { id: 'shot:1', at: time, kind: 'video', blobId: 'blob:1' },
    ];
    malformed.researchRequests = [{ id: 'req:1', status: 'sideways' }];
    expect(() => parseBackupV4(malformed)).not.toThrow();
    expect(parseBackupV4(malformed)).not.toHaveProperty('userScreenshots');
    const badBasis = v4Base();
    badBasis.reconciliation = [
      { categoryId: 'missions', count: 10, basis: 'player-guess', at: time },
    ];
    expect(() => parseBackupV4(badBasis)).toThrow(/basis/i);
    const badVersion = v4Base();
    badVersion.version = 5;
    expect(() => parseBackupFile(badVersion)).toThrow(/version/i);
    // parseBackup itself stays v3-only: a v4 file must go through
    // parseBackupV4 / parseBackupFile.
    expect(() => parseBackup(v4Base())).toThrow(/version/i);
    expect(parseBackupFile(v3Fixture()).version).toBe(3);
    expect(parseBackupFile(v4Base()).version).toBe(4);
    const extra = v4Base();
    (extra as Record<string, unknown>).apiKey = 'sk-never-in-a-backup';
    const parsed = parseBackupV4(extra);
    expect(parsed).not.toHaveProperty('apiKey');
    expect(parsed.version).toBe(4);
  });

  it('rejects a v4 file beyond the 10 MiB limit', () => {
    const input = v4Base();
    input.notes = Array.from({ length: 106 }, (_, index) => ({
      placeId: `L${index}`,
      text: 'x'.repeat(100_000),
      updatedAt: time,
    }));
    expect(() => parseBackupV4(input)).toThrow(/MiB|data limit/i);
  });
});

describe('backup v4 — headline: a v0.31.5 backup survives import + migration', () => {
  it('restores every record and migrates visited/explored/tallies', async () => {
    const fixture = v3Fixture();
    const storage = talliesStorage();
    // The full fixture is a valid v3 file now (both validator gaps fixed).
    expect(parseBackup(fixture).visited).toHaveLength(13);

    const stats = await importAtlasBackup(fixture, {
      repository: db,
      aiDb,
      places,
      storage,
    });
    expect(stats.ai.added).toBe(1);
    expect(stats.droppedCompletionRecords).toEqual([]);

    // --- Markers incl. kind workout AND breakable, with color/createdAt.
    const after = await db.load();
    expect([...after.markers].sort(byMarkerId)).toEqual([...fixture.markers].sort(byMarkerId));
    // --- Notes, user tags, favorites (incl. card:vicki), a collection.
    expect(after.notes.map((n) => n.placeId).sort()).toEqual(['L629', 'custom:capri-gym']);
    expect(after.placeTags).toEqual(fixture.placeTags);
    expect(after.favorites.map((f) => f.placeId).sort()).toEqual([
      'L629',
      'card:vicki',
      'custom:capri-gym',
    ]);
    expect(after.collections[0]?.placeIds).toEqual(['card:vicki', 'L629', 'custom:capri-gym']);
    expect(after.preferences).toEqual(fixture.preferences);
    // --- 13 visited + 3 explored, intact in the old tables.
    expect(after.visited).toHaveLength(13);
    expect(after.explored).toHaveLength(3);

    // --- The migration ran on import: 13 visited == 13
    // visited-records, 3 explored == 3.
    const { records, reconciliation } = await db.loadCompletion();
    expect(records.filter((r) => r.id.startsWith('rec:mig:visited:'))).toHaveLength(13);
    expect(records.filter((r) => r.id.startsWith('rec:mig:explored:'))).toHaveLength(3);
    expect(records).toHaveLength(16);
    expect(records.every((r) => r.source === 'import')).toBe(true);
    // The dangling visited row restores as a discovered record on the
    // id string — never silently dropped.
    const gone = records.find((r) => r.id === 'rec:mig:visited:custom:gone')!;
    expect(gone.target).toEqual({ type: 'location', id: 'custom:gone' });
    expect(gone.verb).toBe('discovered');
    // --- Tallies == 4 reconciliation entries (flamingos: 0 excluded).
    expect(reconciliation.map((e) => [e.categoryId, e.count]).sort()).toEqual([
      ['card-sets', 3],
      ['gang-ops', 5],
      ['missions', 10],
      ['stunts', 250],
    ]);
    expect(reconciliation.every((e) => e.basis === 'game-stat')).toBe(true);

    // --- All 40 legacyItemIds resolve (DESIGN §5's "23" is STALE —
    // the real count is 40 pinned cards: 37 cards:* + 3 loot).
    const gameDb = buildGameDatabase({ places, user: after, records, reconciliation });
    expect(gameDb.legacyItemIds.size).toBe(40);
    for (const [legacyId, itemId] of gameDb.legacyItemIds) {
      expect(legacyId.startsWith('card:') || legacyId.startsWith('loot:')).toBe(true);
      const item = gameDb.items.get(itemId);
      expect(item).toBeDefined();
      expect(gameDb.locations.has(item?.locationId ?? '')).toBe(true);
    }
    expect(gameDb.completedItemIds.size).toBe(4);
    expect(setProgress(gameDb, 'delights-dancers')).toMatchObject({ found: 3, total: 18 });

    // --- aiCategories + aiIndexJob survived the import. The job merge
    // keeps the LOCAL job's status by design (a restore never pauses
    // or stops a run in progress — ai-merge.ts) — what survives from
    // the file is the attempted ids and the resolver version.
    const index = await loadAiIndex(aiDb);
    expect(index.categories['L1']).toMatchObject({ aiCategory: 'house', confidence: 0.9 });
    expect(index.job.attemptedPlaceIds).toEqual(['L1']);
    expect(index.job.resolverVersion).toBe(3);
  });
});

describe('backup v4 — round-trip: export → wipe → import preserves the log exactly', () => {
  it('restores completionRecords, reconciliation and personalItemState deep-equal', async () => {
    const fixture = v3Fixture();
    const storage = talliesStorage();
    await db.importBackup(fixture);
    await mergeImportedAiIndex(fixture.aiCategories, fixture.aiIndexJob, aiDb);
    const migration = await ensureCompletionMigration(db, places, storage);
    expect(migration?.log.completionRecordsCreated).toBe(13);

    // A screenshot-matched find, through the real write path.
    const before = await db.load();
    const { records: migratedRecords, reconciliation: migratedRecon } =
      await db.loadCompletion();
    const gameDb = buildGameDatabase({
      places,
      user: before,
      records: migratedRecords,
      reconciliation: migratedRecon,
    });
    const screenshotLegacyId = [...gameDb.legacyItemIds.keys()].find((id) => {
      const itemId = gameDb.legacyItemIds.get(id)!;
      return !gameDb.completedItemIds.has(itemId);
    })!;
    const screenshotShot = await recordCompletion(
      {
        target: { type: 'item', id: screenshotLegacyId },
        verb: 'collected',
        source: 'screenshot',
        note: 'matched from screenshot shot:1',
      },
      { repository: db, places, storage },
    );
    expect(screenshotShot.ok).toBe(true);
    expect(screenshotShot.record?.source).toBe('screenshot');
    // A sale, through the real write path (Vicki was collected by the migration).
    const sale = await recordSale(
      { itemId: 'card:vicki', price: 1500 },
      { repository: db, places, storage },
    );
    expect(sale.ok).toBe(true);
    // The step-5/7 tables have no writers yet — seed rows directly.
    await db.enrichments.put({
      id: 'enr:L629:1',
      locationId: 'L629',
      schemaVersion: 1,
      researchedAt: time,
      researchedBy: 'gpt-4o-mini',
      fields: [
        {
          kind: 'identity',
          text: 'Delights is a strip club.',
          confidence: 0.8,
          sources: [
            { title: 'PowerPyx guide', url: 'https://example.com/guide', quote: 'Delights.' },
          ],
          status: 'ai-suggested',
        },
      ],
      imagery: [],
      question: 'what shop is this?',
    });
    await db.corrections.put({
      id: 'cor:550e8400-e29b-41d4-a716-446655440000',
      locationId: 'L629',
      field: 'name',
      oldText: 'Delights',
      newText: 'Delights Nightclub',
      at: time,
      source: 'user',
    });
    // Step-3 follow-up ruling 1: screenshots and research requests
    // are NOT in v4 — the tables still exist locally (the album
    // feature writes them), but they are never exported, so seed
    // rows here to prove they stay behind: the export below must not
    // carry them, and the import must not restore them.
    await db.userScreenshots.put({
      id: 'shot:550e8400-e29b-41d4-a716-446655440000',
      at: time,
      kind: 'card-front',
      setId: 'delights-dancers',
      blobId: 'blob:local-1',
    });
    await db.researchRequests.put({
      id: 'req:550e8400-e29b-41d4-a716-446655440000',
      targetType: 'item',
      targetId: 'card-checklist:delights-dancers:vicki:standard',
      question: 'Where is the Vicki card?',
      requestedAt: time,
      status: 'queued',
    });
    // Step 7: a confirmed match (the silver Dominic → L3442, D1),
    // its attempt fingerprint, and one M4 rejection — all three ride
    // in the file, unlike the screenshot/research rows above.
    const silverSlot = 'card-checklist:vice-city-manatees:dominic-brizzolato:silver';
    const silverFingerprint = attemptFingerprint(silverSlot, ['L3442']);
    await db.saveCardMatch({
      slotId: silverSlot,
      hostId: 'L3442',
      confidence: 0.95,
      reasoning: "Only Nehrling River in the named area matches the direction's host name.",
      citations: [
        {
          sourceTitle: 'lorenzone.fr · GTA 6 Trading Cards checklist',
          sourceUrl:
            'https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations',
          catalogueRecordId: 'L3442',
          snapshotRev: '2e9e194b497d7a1a7da4f2288c1065dc0b913e80',
        },
      ],
      proposedBy: 'deterministic',
      confirmedBy: 'player',
      confirmedAt: time,
      evidenceKind: 'approximate',
    });
    await db.saveMatcherAttempts([
      {
        id: `${silverSlot}::${silverFingerprint}`,
        slotId: silverSlot,
        fingerprint: silverFingerprint,
        at: time,
        result: 'proposed',
        proposedHostId: 'L3442',
        confidence: 0.95,
        reasoning: "Only Nehrling River in the named area matches the direction's host name.",
        proposedBy: 'deterministic',
      },
    ]);
    await db.saveMatcherRejection({
      id: 'card-checklist:delights-dancers:vicki:standard::L629',
      slotId: 'card-checklist:delights-dancers:vicki:standard',
      hostId: 'L629',
      rejectedAt: time,
    });

    // --- Export: the same assembly exportWorkspaceBackup performs.
    const exportedV3 = await db.exportBackup();
    const aiIndex = await loadAiIndex(aiDb);
    const exported = parseBackupV4({
      ...exportedV3,
      version: 4,
      aiCategories: Object.values(aiIndex.categories),
      aiIndexJob: aiIndex.job,
      completionRecords: (await db.loadCompletion()).records,
      reconciliation: (await db.loadCompletion()).reconciliation,
      enrichments: await db.enrichments.toArray(),
      corrections: await db.corrections.toArray(),
      personalItemState: await db.loadPersonalItemStates(),
      cardMatches: await db.loadCardMatches(),
      matcherAttempts: await db.loadMatcherAttempts(),
      matcherRejections: await db.loadMatcherRejections(),
    });
    expect(exported.version).toBe(4);
    expect(exported.visited).toHaveLength(13);
    expect(exported.completionRecords).toHaveLength(17); // 16 migrated + 1 screenshot
    expect(exported.reconciliation).toHaveLength(4);
    expect(exported.personalItemState).toHaveLength(1);
    expect(exported.cardMatches).toHaveLength(1);
    expect(exported.cardMatches[0]?.hostId).toBe('L3442');
    expect(exported.matcherAttempts).toHaveLength(1);
    expect(exported.matcherRejections).toHaveLength(1);
    // Ruling 1: the file carries neither section, even though the
    // source database has rows in both tables.
    expect(exported).not.toHaveProperty('userScreenshots');
    expect(exported).not.toHaveProperty('researchRequests');
    // The file round-trips through JSON and parses as v4.
    const parsed = parseBackupFile(JSON.parse(JSON.stringify(exported)));
    expect(parsed.version).toBe(4);
    if (parsed.version !== 4) throw new Error('expected a v4 file');

    // --- Capture the source state, then wipe.
    const sourceRecords = [...(await db.loadCompletion()).records].sort(byId);
    const sourceRecon = [...(await db.loadCompletion()).reconciliation].sort(byCategory);
    const sourceSold = [...(await db.loadPersonalItemStates())].sort(byItem);
    const sourceEnrichments = [...(await db.enrichments.toArray())].sort(byId);
    const sourceCorrections = [...(await db.corrections.toArray())].sort(byId);
    const sourceMatches = [...(await db.loadCardMatches())].sort((a, b) =>
      a.slotId < b.slotId ? -1 : 1,
    );
    const sourceAttempts = [...(await db.loadMatcherAttempts())].sort(byId);
    const sourceRejections = [...(await db.loadMatcherRejections())].sort(byId);
    const sourceVisited = (await db.load()).visited;
    const sourceMarkers = [...(await db.load()).markers].sort(byMarkerId);

    const db2 = new AtlasDatabase(`backup-v4-test-${crypto.randomUUID()}`);
    const aiDb2 = new AiIndexDatabase(`backup-v4-ai-test-${crypto.randomUUID()}`);
    try {
      const freshStorage = memoryStorage();
      await importAtlasBackup(parsed, {
        repository: db2,
        aiDb: aiDb2,
        places,
        storage: freshStorage,
      });

      // --- Deep-equal: the restored log is the exported log.
      const restored = await db2.loadCompletion();
      expect([...restored.records].sort(byId)).toEqual(sourceRecords);
      expect([...restored.reconciliation].sort(byCategory)).toEqual(sourceRecon);
      expect([...(await db2.loadPersonalItemStates())].sort(byItem)).toEqual(sourceSold);
      expect([...(await db2.enrichments.toArray())].sort(byId)).toEqual(sourceEnrichments);
      expect([...(await db2.corrections.toArray())].sort(byId)).toEqual(sourceCorrections);
      // Step 7: the confirmed match, its attempt and the rejection
      // restore deep-equal — the pins rebuild from them.
      expect([...(await db2.loadCardMatches())].sort((a, b) => (a.slotId < b.slotId ? -1 : 1))).toEqual(
        sourceMatches,
      );
      expect([...(await db2.loadMatcherAttempts())].sort(byId)).toEqual(sourceAttempts);
      expect([...(await db2.loadMatcherRejections())].sort(byId)).toEqual(sourceRejections);
      // --- Ruling 1: the screenshot and research rows stayed behind
      // on the source device — the restored database has none.
      expect(await db2.userScreenshots.toArray()).toEqual([]);
      expect(await db2.researchRequests.toArray()).toEqual([]);
      // --- The v3 sections survive too.
      const restoredUser = await db2.load();
      expect(restoredUser.visited).toEqual(sourceVisited);
      expect([...restoredUser.markers].sort(byMarkerId)).toEqual(sourceMarkers);
      // --- The screenshot record and the sale are intact, with their
      // provenance (source, note, price) — not re-derived, not dropped.
      const restoredShot = restored.records.find((r) => r.id === screenshotShot.record!.id)!;
      expect(restoredShot.source).toBe('screenshot');
      expect(restoredShot.note).toBe('matched from screenshot shot:1');
      expect(restoredShot.verb).toBe('collected');
      const restoredSale = await db2.getPersonalItemState('card-checklist:delights-dancers:vicki:standard');
      expect(restoredSale?.soldPrice).toBe(1500);
      expect(typeof restoredSale?.soldAt).toBe('string');
      // --- The rebuilt database agrees: the screenshot find counts.
      const restoredDb = buildGameDatabase({
        places,
        user: restoredUser,
        records: restored.records,
        reconciliation: restored.reconciliation,
      });
      expect(restoredDb.completedItemIds.size).toBe(5);
      expect(restoredDb.legacyItemIds.size).toBe(40);
      // --- The AI index came along.
      const restoredIndex = await loadAiIndex(aiDb2);
      expect(restoredIndex.categories['L1']).toMatchObject({ aiCategory: 'house' });
      // --- A second import of the same file is a no-op (merge by id).
      await importAtlasBackup(parsed, {
        repository: db2,
        aiDb: aiDb2,
        places,
        storage: freshStorage,
      });
      expect((await db2.loadCompletion()).records).toHaveLength(17);
      expect((await db2.loadCompletion()).reconciliation).toHaveLength(4);
      expect(await db2.loadCardMatches()).toHaveLength(1);
      expect(await db2.loadMatcherAttempts()).toHaveLength(1);
      expect(await db2.loadMatcherRejections()).toHaveLength(1);
    } finally {
      await db2.delete().catch(() => undefined);
      await aiDb2.delete().catch(() => undefined);
    }
  });
});

describe('backup v4 — store export assembles v4 (filename unchanged)', () => {
  it('exports version 4 with the new sections from the live store', async () => {
    await atlasRepository.open();
    await hydrateUserData();
    try {
      await saveLocal(() => atlasRepository.saveNote('L1', 'Store export'));
      const backup = await exportWorkspaceBackup(null);
      expect(backup.version).toBe(4);
      expect(backup.completionRecords).toEqual([]);
      expect(backup.reconciliation).toEqual([]);
      expect(backup.enrichments).toEqual([]);
      expect(backup.corrections).toEqual([]);
      expect(backup.personalItemState).toEqual([]);
      expect(backup.cardMatches).toEqual([]);
      expect(backup.matcherAttempts).toEqual([]);
      expect(backup.matcherRejections).toEqual([]);
      // Step-3 follow-up ruling 1: v4 gains exactly enrichments,
      // corrections, personalItemState — the file has no screenshot
      // or research sections at all.
      expect(backup).not.toHaveProperty('userScreenshots');
      expect(backup).not.toHaveProperty('researchRequests');
      expect(backup.notes.map((n) => n.text)).toContain('Store export');
      expect(parseBackupFile(JSON.parse(JSON.stringify(backup))).version).toBe(4);
      // The filename and the "Back up my ViceWire" label are unchanged.
      expect(backupFileName(new Date('2026-11-26T00:00:00.000Z'))).toBe(
        'leonida-atlas-backup-2026-11-26.json',
      );
    } finally {
      await switchLocalWorkspace(null);
      await atlasRepository.delete();
    }
  });
});

describe('backup v4 — follow-up ruling 1: carried screenshot/research sections ignored on import', () => {
  const oneRecord = (overrides: Partial<CompletionRecord> = {}): CompletionRecord => ({
    id: 'rec:550e8400-e29b-41d4-a716-446655440000',
    target: { type: 'item', id: 'card-checklist:delights-dancers:vicki:standard' },
    verb: 'collected',
    count: 1,
    at: time,
    source: 'user',
    ...overrides,
  });

  function v4WithCarried(): Record<string, unknown> {
    return {
      ...v3Fixture(),
      version: 4,
      completionRecords: [oneRecord()],
      reconciliation: [],
      enrichments: [],
      corrections: [],
      personalItemState: [],
      userScreenshots: [
        {
          id: 'shot:550e8400-e29b-41d4-a716-446655440000',
          at: time,
          kind: 'card-front',
          setId: 'delights-dancers',
          blobId: 'blob:local-1',
        },
      ],
      researchRequests: [
        {
          id: 'req:550e8400-e29b-41d4-a716-446655440000',
          targetType: 'item',
          targetId: 'card-checklist:delights-dancers:vicki:standard',
          question: 'Where is the Vicki card?',
          requestedAt: time,
          status: 'queued',
        },
      ],
    };
  }

  it('imports the valid sections and leaves the screenshot/research tables empty', async () => {
    // DECISION (step-3 follow-up ruling 1): a v4 file carrying
    // userScreenshots / researchRequests sections is IGNORED, not
    // rejected. The sections are not in v4 (addendum lines 518,
    // 725); rows-only export would have created dangling blobIds on
    // restore, so the rows were never restorable from the file and
    // ignoring them loses nothing importable.
    const { backup, droppedCompletionRecords } = parseBackupV4WithDrops(v4WithCarried());
    expect(droppedCompletionRecords).toEqual([]);
    const result = await importAtlasBackup(backup, {
      repository: db,
      aiDb,
      places,
      storage: memoryStorage(),
      droppedCompletionRecords,
    });
    expect(result.droppedCompletionRecords).toEqual([]);
    // The valid sections landed: the file's completion record plus
    // the 16 migration records, and both markers.
    const { records } = await db.loadCompletion();
    expect(records.some((r) => r.id === 'rec:550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(records).toHaveLength(17);
    expect((await db.load()).markers).toHaveLength(2);
    // The carried rows did NOT land: the tables stay empty on the
    // restoring device (no dangling blobIds).
    expect(await db.userScreenshots.toArray()).toEqual([]);
    expect(await db.researchRequests.toArray()).toEqual([]);
  });
});

describe('backup v4 — follow-up ruling 2: drop-and-count on import', () => {
  const oneRecord = (overrides: Partial<CompletionRecord> = {}): CompletionRecord => ({
    id: 'rec:550e8400-e29b-41d4-a716-446655440000',
    target: { type: 'item', id: 'card-checklist:delights-dancers:vicki:standard' },
    verb: 'collected',
    count: 1,
    at: time,
    source: 'user',
    ...overrides,
  });

  function v4File(completionRecords: unknown[]): Record<string, unknown> {
    return {
      ...v3Fixture(),
      version: 4,
      completionRecords,
      reconciliation: [],
      enrichments: [],
      corrections: [],
      personalItemState: [],
    };
  }

  it('imports the valid records and reports 1 dropped with the reason — in the result and the migration log', async () => {
    const bad = {
      ...oneRecord(),
      id: 'rec:bad-550e8400-e29b-41d4-a716-446655440000',
      verb: 'found',
    };
    const { backup, droppedCompletionRecords } = parseBackupV4WithDrops(
      v4File([oneRecord(), bad]),
    );
    expect(backup.completionRecords).toHaveLength(1);
    expect(droppedCompletionRecords).toHaveLength(1);
    expect(droppedCompletionRecords[0]?.reason).toMatch(/verb/i);

    const storage = talliesStorage();
    const result = await importAtlasBackup(backup, {
      repository: db,
      aiDb,
      places,
      storage,
      droppedCompletionRecords,
    });
    expect(result.droppedCompletionRecords).toHaveLength(1);
    expect(result.droppedCompletionRecords[0]?.reason).toMatch(/verb/i);
    // The valid file record landed alongside the 16 migration records.
    const { records } = await db.loadCompletion();
    expect(records).toHaveLength(17);
    expect(
      records.some((r) => r.id === 'rec:550e8400-e29b-41d4-a716-446655440000'),
    ).toBe(true);
    // DESIGN §11: the migration log shows "N records dropped: reason".
    const log = getCompletionMigrationLog(storage);
    expect(log).not.toBeNull();
    const entries = (
      log as unknown as {
        droppedCompletionRecords?: Array<{ at: string; count: number; reasons: string[] }>;
      }
    ).droppedCompletionRecords;
    expect(entries).toHaveLength(1);
    expect(entries?.[0]?.count).toBe(1);
    expect(entries?.[0]?.reasons[0]).toMatch(/verb/i);
    expect(typeof entries?.[0]?.at).toBe('string');
  });

  it('imports the rest of the backup when ALL completion records are malformed', async () => {
    const badVerb = {
      ...oneRecord(),
      id: 'rec:bad-verb-550e8400-e29b-41d4-a716-446655440000',
      verb: 'found',
    };
    const badCount = {
      ...oneRecord(),
      id: 'rec:bad-count-550e8400-e29b-41d4-a716-446655440000',
      count: 2,
    };
    const { backup, droppedCompletionRecords } = parseBackupV4WithDrops(
      v4File([badVerb, badCount]),
    );
    expect(backup.completionRecords).toEqual([]);
    expect(droppedCompletionRecords).toHaveLength(2);
    const storage = talliesStorage();
    const result = await importAtlasBackup(backup, {
      repository: db,
      aiDb,
      places,
      storage,
      droppedCompletionRecords,
    });
    expect(result.droppedCompletionRecords).toHaveLength(2);
    // Everything else landed: markers, the migration's records, tallies.
    expect((await db.load()).markers).toHaveLength(2);
    const { records, reconciliation } = await db.loadCompletion();
    expect(records).toHaveLength(16);
    expect(reconciliation.map((e) => [e.categoryId, e.count]).sort()).toEqual([
      ['card-sets', 3],
      ['gang-ops', 5],
      ['missions', 10],
      ['stunts', 250],
    ]);
    const log = getCompletionMigrationLog(storage);
    const entries = (
      log as unknown as {
        droppedCompletionRecords?: Array<{ count: number; reasons: string[] }>;
      }
    ).droppedCompletionRecords;
    expect(entries?.[0]?.count).toBe(2);
    expect(entries?.[0]?.reasons).toHaveLength(2);
  });
});

describe('backup v4 — step 7: card matcher sections', () => {
  function v4Base(): Record<string, unknown> {
    return {
      ...v3Fixture(),
      version: 4,
      completionRecords: [],
      reconciliation: [],
      enrichments: [],
      corrections: [],
      personalItemState: [],
      cardMatches: [],
      matcherAttempts: [],
      matcherRejections: [],
    };
  }

  const oneMatch = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    slotId: 'card-checklist:vice-city-manatees:dominic-brizzolato:silver',
    hostId: 'L3442',
    confidence: 0.95,
    reasoning: "Only Nehrling River in the named area matches the direction's host name.",
    citations: [
      {
        sourceTitle: 'lorenzone.fr · GTA 6 Trading Cards checklist',
        sourceUrl:
          'https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations',
        catalogueRecordId: 'L3442',
        snapshotRev: '2e9e194b497d7a1a7da4f2288c1065dc0b913e80',
      },
    ],
    proposedBy: 'deterministic',
    confirmedBy: 'player',
    confirmedAt: time,
    evidenceKind: 'approximate',
    ...overrides,
  });

  it('parses a confirmed match and a jot (personal evidence, empty sourceUrl)', () => {
    const input = v4Base();
    input.cardMatches = [
      oneMatch(),
      oneMatch({
        slotId: 'card-checklist:delights-dancers:vicki:standard',
        hostId: 'custom:jot-1',
        confidence: 1,
        reasoning: 'Marked by you in-game.',
        citations: [
          {
            sourceTitle: 'Player jot — marked in-game',
            sourceUrl: '',
            catalogueRecordId: 'custom:jot-1',
            snapshotRev: '2e9e194b497d7a1a7da4f2288c1065dc0b913e80',
          },
        ],
        proposedBy: 'player',
        evidenceKind: 'personal',
      }),
    ];
    const parsed = parseBackupV4(input);
    expect(parsed.cardMatches).toHaveLength(2);
    expect(parsed.cardMatches[1]?.evidenceKind).toBe('personal');
    expect(parsed.cardMatches[1]?.citations[0]?.sourceUrl).toBe('');
  });

  it('rejects a match claiming verified evidence — a confirmation is never verified', () => {
    const input = v4Base();
    input.cardMatches = [oneMatch({ evidenceKind: 'verified' })];
    expect(() => parseBackupV4(input)).toThrow(/evidenceKind/i);
  });

  it('rejects a match with confidence outside 0–1 or an unknown proposer', () => {
    const badConfidence = v4Base();
    badConfidence.cardMatches = [oneMatch({ confidence: 1.5 })];
    expect(() => parseBackupV4(badConfidence)).toThrow(/confidence/i);
    const badProposer = v4Base();
    badProposer.cardMatches = [oneMatch({ proposedBy: 'ai' })];
    expect(() => parseBackupV4(badProposer)).toThrow(/proposedBy/i);
  });

  it('rejects duplicate slotIds fail-fast — one confirmed match per slot', () => {
    const input = v4Base();
    input.cardMatches = [oneMatch(), oneMatch({ hostId: 'L1006' })];
    expect(() => parseBackupV4(input)).toThrow(/cardMatches/i);
  });

  it('rejects an attempt with an unknown result and defaults missing matcher sections to []', () => {
    const badResult = v4Base();
    badResult.matcherAttempts = [
      {
        id: 'slot:x::fp',
        slotId: 'slot:x',
        fingerprint: 'fp',
        at: time,
        result: 'guessed',
      },
    ];
    expect(() => parseBackupV4(badResult)).toThrow(/result/i);
    const old = v4Base();
    delete old.cardMatches;
    delete old.matcherAttempts;
    delete old.matcherRejections;
    const parsed = parseBackupV4(old);
    expect(parsed.cardMatches).toEqual([]);
    expect(parsed.matcherAttempts).toEqual([]);
    expect(parsed.matcherRejections).toEqual([]);
  });

  it('round-trips a rejection through the repository', async () => {
    const repo = new AtlasDatabase(`backup-v4-step7-test-${crypto.randomUUID()}`);
    try {
      await repo.saveMatcherRejection({
        id: 'slot:x::L1',
        slotId: 'slot:x',
        hostId: 'L1',
        rejectedAt: time,
      });
      expect(await repo.loadMatcherRejections()).toHaveLength(1);
      expect(await repo.loadCardMatches()).toEqual([]);
      expect(await repo.loadMatcherAttempts()).toEqual([]);
    } finally {
      await repo.delete();
    }
  });
});
