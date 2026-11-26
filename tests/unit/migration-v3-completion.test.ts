import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  AtlasDatabase,
  CompletionMigrationError,
  completionMigrationNeeded,
  ensureCompletionMigration,
  getCompletionMigrationLog,
  getCompletionMigrationStatus,
  migrateV3CompletionData,
} from '../../src/db/repository';
import { COMPLETION_STORAGE_KEY, parseCompletionCounts } from '../../src/features/completion/store';
import type { StorageLike } from '../../src/features/categorise/storage';
import { AiIndexDatabase, loadAiIndex, mergeImportedAiIndex } from '../../src/db/ai-index';
import { parseBackup } from '../../src/db/backup';
import type { Backup } from '../../src/domain/types';
import {
  buildGameDatabase,
  categoryProgress,
  setProgress,
  type GameDatabase,
} from '../../src/domain/game-db';
import type { Place, UserData } from '../../src/domain/types';

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
 * A v0.31.5-format backup: every section the design's §5 table
 * migrates or preserves. ...
 *
 * NOTE on the two rows this fixture keeps that the v3 validator used
 * to reject: `parseBackup` (backup.ts) accepted only markers with
 * kind 'workout' — a 'breakable' marker failed the whole import —
 * and it rejected any visited row referencing a `custom:*` id with no
 * marker in the file, so the `custom:gone` row (a visited mark whose
 * marker is gone — the audit-trail case) could never appear in a
 * valid backup file either. Both were pre-existing backup-validator
 * gaps, FIXED in step 3 (backup v4): breakable markers parse, and
 * visited/explored rows are exempt from the missing-marker check —
 * the migration keeps them as `discovered` records on the id string.
 * The legacy Dexie seed path writes rows directly, so the headline
 * test keeps both; the importBackup path uses the fixture WITHOUT
 * them (`{ importable: true }`) and asserts the adjusted counts.
 * (The full fixture, including both rows, now imports cleanly —
 * see tests/unit/backup-v4.test.ts.)
 */
function v3Fixture(options: { importable?: boolean } = {}): Backup {
  const importable = options.importable ?? false;
  const fixture: Backup = {
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
  if (!importable) return fixture;
  return {
    ...fixture,
    markers: fixture.markers.filter((marker) => marker.id !== 'custom:breakable-house'),
    visited: fixture.visited.filter(
      (row) => row.placeId !== 'custom:breakable-house' && row.placeId !== 'custom:gone',
    ),
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

/** The Dexie v4 schema the fixture was written under (pre-v0.32). */
const schemaV4 = {
  favorites: 'placeId, createdAt',
  notes: 'placeId, updatedAt',
  markers: 'id, category, updatedAt',
  collections: 'id, name, updatedAt, *placeIds',
  visited: 'placeId, visitedAt',
  preferences: 'key',
  placeTags: 'placeId, updatedAt',
  explored: 'placeId, exploredAt',
  placePhotos: 'placeId, updatedAt',
};

let dbName: string;
let db: AtlasDatabase;
let aiDb: AiIndexDatabase;
beforeEach(() => {
  dbName = `migration-test-${crypto.randomUUID()}`;
  db = new AtlasDatabase(dbName);
  aiDb = new AiIndexDatabase(`migration-ai-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete().catch(() => undefined);
  await aiDb.delete().catch(() => undefined);
});

/** Seed a real v4 database (legacy Dexie), then open it as v6. */
async function seedLegacyV4(fixture: Backup): Promise<void> {
  const legacy = new Dexie(dbName);
  legacy.version(4).stores(schemaV4);
  await legacy.open();
  await legacy.table('favorites').bulkPut(fixture.favorites);
  await legacy.table('notes').bulkPut(fixture.notes);
  await legacy.table('placeTags').bulkPut(fixture.placeTags);
  await legacy.table('markers').bulkPut(fixture.markers);
  await legacy.table('collections').bulkPut(fixture.collections);
  await legacy.table('visited').bulkPut(fixture.visited);
  await legacy.table('explored').bulkPut(fixture.explored);
  await legacy.table('preferences').put({ key: 'preferences', value: fixture.preferences });
  legacy.close();
  await db.open();
}

function buildDbFromStorage(records: GameDatabase['records'], reconciliation: GameDatabase['reconciliation'], user: UserData): GameDatabase {
  return buildGameDatabase({ places, user, records, reconciliation });
}

describe('v3 → v4 completion migration (DESIGN §5, headline)', () => {
  it('moves every record from a v4 database into the v4 log without losing one', async () => {
    const fixture = v3Fixture();
    const storage = talliesStorage();
    await seedLegacyV4(fixture);
    expect(db.verno).toBe(7); // schema v7 (Demo F: screenshotData table)
    // The upgrade only adds empty tables — nothing is migrated yet.
    expect(await db.completionRecords.count()).toBe(0);
    expect(await db.reconciliation.count()).toBe(0);
    const before = await db.load();
    expect(await completionMigrationNeeded(db)).toBe(true);

    const { log } = await migrateV3CompletionData(db, places, storage);

    // --- The log says what happened, including the honest timestamp note.
    expect(log.visitedRows).toBe(13);
    expect(log.completionRecordsCreated).toBe(13);
    expect(log.exploredRows).toBe(3);
    expect(log.exploredRecordsCreated).toBe(3);
    expect(log.tallyCategories).toBe(4);
    expect(log.reconciliationEntries).toBe(4);
    expect(log.unknownVisitedTargets).toBe(2);
    expect(log.talliesTimestampNote).toMatch(/carries no timestamp/i);
    expect(getCompletionMigrationLog(storage)).toEqual(log);
    expect(getCompletionMigrationStatus(storage).migrated).toBe(true);
    expect(await completionMigrationNeeded(db)).toBe(false);

    // --- Every id present before is present after.
    const after = await db.load();
    expect(after).toEqual(before);
    // Markers keep kind / color / createdAt (Dexie returns key order).
    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1);
    expect([...after.markers].sort(byId)).toEqual([...fixture.markers].sort(byId));
    // Notes, user tags, favorites and collections resolve via preserved ids.
    expect(after.notes.map((n) => n.placeId).sort()).toEqual(['L629', 'custom:capri-gym']);
    expect(after.placeTags).toEqual(fixture.placeTags);
    expect(after.favorites.map((f) => f.placeId).sort()).toEqual([
      'L629',
      'card:vicki',
      'custom:capri-gym',
    ]);
    expect(after.collections[0]?.placeIds).toEqual(['card:vicki', 'L629', 'custom:capri-gym']);
    // Preferences preserved as-is; layer visibility is NOT migrated.
    expect(after.preferences).toEqual(fixture.preferences);
    // The old tables stay intact (audit trail + old UI reads them).
    expect(after.visited).toHaveLength(13);
    expect(after.explored).toHaveLength(3);

    // --- visited count == completion records created; explored likewise.
    const { records, reconciliation } = await db.loadCompletion();
    expect(records.filter((r) => r.id.startsWith('rec:mig:visited:'))).toHaveLength(13);
    expect(records.filter((r) => r.id.startsWith('rec:mig:explored:'))).toHaveLength(3);
    expect(records).toHaveLength(16);
    expect(records.every((r) => r.source === 'import')).toBe(true);

    // --- Verbs follow the §5 table, against the real catalogue.
    const byVisitedId = new Map(
      records
        .filter((r) => r.id.startsWith('rec:mig:visited:'))
        .map((r) => [r.id.replace('rec:mig:visited:', ''), r]),
    );
    const collected = [...byVisitedId.values()].filter((r) => r.verb === 'collected');
    expect(collected).toHaveLength(4);
    expect(collected.map((r) => r.target)).toEqual(
      expect.arrayContaining([
        { type: 'item', id: 'card-checklist:delights-dancers:vicki:standard' },
        { type: 'item', id: 'card-checklist:delights-dancers:jason:standard' },
        { type: 'item', id: 'card-checklist:delights-dancers:harley:standard' },
        { type: 'item', id: 'loot:guide-meditation-jasons-house' },
      ]),
    );
    expect(collected.every((r) => r.count === 1 && r.at === time)).toBe(true);
    const looted = [...byVisitedId.values()].filter((r) => r.verb === 'looted');
    expect(looted).toHaveLength(5);
    expect(looted.map((r) => r.target.id).sort()).toEqual([
      'opp:L2380:robbery-shop:1',
      'opp:L360:robbery-shop:1',
      'opp:breakable:parlor-apartments:break-in:1',
      'opp:custom:breakable-house:break-in:1',
      'opp:loot:guide-job-bayside-lombank:bank-job:1',
    ]);
    const discovered = [...byVisitedId.values()].filter((r) => r.verb === 'discovered');
    expect(discovered).toHaveLength(4);
    expect(discovered.map((r) => r.target)).toEqual(
      expect.arrayContaining([
        { type: 'location', id: 'L629' },
        { type: 'location', id: 'custom:capri-gym' },
        // Unknown targets are kept on the id string — the audit trail.
        { type: 'location', id: 'L99999' },
        { type: 'location', id: 'custom:gone' },
      ]),
    );
    // Explored rows: the card id resolves to its host location.
    const exploredTargets = records
      .filter((r) => r.id.startsWith('rec:mig:explored:'))
      .map((r) => r.target);
    expect(exploredTargets).toEqual(
      expect.arrayContaining([
        { type: 'location', id: 'L629' },
        { type: 'location', id: 'L304' },
      ]),
    );
    expect(exploredTargets.filter((t) => t.id === 'L304')).toHaveLength(2);

    // --- Tallies == reconciliation entries (zero categories excluded).
    expect(reconciliation.map((e) => [e.categoryId, e.count]).sort()).toEqual([
      ['card-sets', 3],
      ['gang-ops', 5],
      ['missions', 10],
      ['stunts', 250],
    ]);
    expect(reconciliation.every((e) => e.basis === 'game-stat')).toBe(true);
    expect(reconciliation.every((e) => e.at === log.migratedAt)).toBe(true);

    // --- The tallies key is deleted only after the verified write.
    // (Known consequence, recorded: the old completion panel reads 0
    // tallies from here until step 6 replaces it.)
    expect(storage.getItem(COMPLETION_STORAGE_KEY)).toBeNull();
    expect(parseCompletionCounts(storage.getItem(COMPLETION_STORAGE_KEY))).toEqual({});

    // --- The migrated database builds without error, and the 40
    // pinned cards keep the same host ids (DESIGN §5 said 23 — the
    // real count is 40: 37 cards:* + 3 loot).
    const migratedDb = buildDbFromStorage(records, reconciliation, after);
    expect(migratedDb.legacyItemIds.size).toBe(40);
    const preMigrationDb = buildGameDatabase({ places, user: before });
    for (const [legacyId, itemId] of preMigrationDb.legacyItemIds) {
      const item = migratedDb.items.get(itemId);
      expect(item).toBeDefined();
      expect(item?.locationId).toBe(preMigrationDb.items.get(itemId)?.locationId);
      expect(migratedDb.locations.has(item?.locationId ?? '')).toBe(true);
      expect(legacyId.startsWith('card:') || legacyId.startsWith('loot:')).toBe(true);
    }
    expect(migratedDb.completedItemIds.size).toBe(4);
    expect(setProgress(migratedDb, 'delights-dancers')).toMatchObject({ found: 3, total: 18 });
    expect(migratedDb.completedOpportunityIds.get('opp:L360:robbery-shop:1')).toBe(1);
    expect(migratedDb.discoveredLocationIds.has('L629')).toBe(true);
    expect(migratedDb.exploredLocationIds.has('L304')).toBe(true);
    expect(() => categoryProgress(migratedDb, 'missions')).not.toThrow();

    // --- Re-running the migration is a no-op (deterministic ids).
    const again = await migrateV3CompletionData(db, places, storage);
    expect(again.log.completionRecordsCreated).toBe(13);
    expect((await db.loadCompletion()).records).toHaveLength(16);
    expect((await db.loadCompletion()).reconciliation).toHaveLength(4);
  });

  it('restores a v3 backup into v4, including the AI index', async () => {
    // The importable variant drops the breakable marker and the
    // custom:gone visited row — the two validator gaps step 3 fixed,
    // kept here as the pre-fix shape so this test still pins the
    // adjusted counts (11 visited rows, 4 looted, 14 records total).
    // The full fixture now imports too — see backup-v4.test.ts.
    const fixture = v3Fixture({ importable: true });
    const storage = talliesStorage();
    // parseBackup is the v3 gate: the fixture must be a valid v3 file.
    expect(parseBackup(fixture).aiCategories).toHaveLength(1);
    await db.importBackup(fixture);
    const aiStats = await mergeImportedAiIndex(
      fixture.aiCategories,
      fixture.aiIndexJob,
      aiDb,
    );
    expect(aiStats.added).toBe(1);
    const index = await loadAiIndex(aiDb);
    expect(index.categories['L1']).toMatchObject({ aiCategory: 'house', confidence: 0.9 });

    await migrateV3CompletionData(db, places, storage);
    const { records, reconciliation } = await db.loadCompletion();
    expect(records).toHaveLength(14);
    expect(reconciliation).toHaveLength(4);
    expect((await db.load()).visited).toHaveLength(11);
    // The migrated db builds, and a v3 backup still exports (step 3
    // owns the v4 format; the export stays version 3 here).
    const exported = await db.exportBackup();
    expect(exported.version).toBe(3);
    expect(exported.visited).toHaveLength(11);
    const migratedDb = buildDbFromStorage(records, reconciliation, await db.load());
    expect(migratedDb.legacyItemIds.size).toBe(40);
  });

  it('fails loudly and leaves old data untouched when the write fails', async () => {
    const fixture = v3Fixture();
    const storage = talliesStorage();
    await seedLegacyV4(fixture);
    const before = await db.load();
    const failWrite = () => {
      throw new Error('Simulated storage failure');
    };
    db.completionRecords.hook('creating', failWrite);
    await expect(migrateV3CompletionData(db, places, storage)).rejects.toThrow(
      CompletionMigrationError,
    );
    db.completionRecords.hook('creating').unsubscribe(failWrite);
    expect(getCompletionMigrationStatus(storage).lastError).toMatch(/storage failure/i);
    expect(getCompletionMigrationLog(storage)).toBeNull();
    // Old data untouched: visited/explored still there, tallies key kept.
    expect(await db.load()).toEqual(before);
    expect(await db.completionRecords.count()).toBe(0);
    expect(await db.reconciliation.count()).toBe(0);
    expect(storage.getItem(COMPLETION_STORAGE_KEY)).not.toBeNull();
    // The retry hook works: the same call now succeeds.
    const { log } = await migrateV3CompletionData(db, places, storage);
    expect(log.completionRecordsCreated).toBe(13);
    expect(getCompletionMigrationStatus(storage).lastError).toBeNull();
  });

  it('migrates nothing and still marks itself done on a fresh profile', async () => {
    await db.open();
    const storage = memoryStorage();
    expect(await completionMigrationNeeded(db)).toBe(false);
    const { log } = await migrateV3CompletionData(db, places, storage);
    expect(log).toMatchObject({
      visitedRows: 0,
      completionRecordsCreated: 0,
      tallyCategories: 0,
      reconciliationEntries: 0,
    });
    expect(getCompletionMigrationLog(storage)).toEqual(log);
    // ...but a v3 backup imported afterwards is still picked up.
    await db.importBackup(v3Fixture({ importable: true }));
    expect(await completionMigrationNeeded(db)).toBe(true);
    const second = await ensureCompletionMigration(db, places, talliesStorage());
    expect(second?.log.completionRecordsCreated).toBe(11);
    expect((await db.loadCompletion()).records).toHaveLength(14);
  });
});
