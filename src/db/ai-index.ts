import Dexie, { type Table } from "dexie";
import {
  AI_CATEGORIES_STORAGE_KEY,
  AI_INDEX_JOB_STORAGE_KEY,
  EMPTY_INDEX_JOB,
  migrateIndexJobForResolver,
  parseAiCategories,
  parseIndexJob,
  type IndexJobState,
  type StorageLike,
} from "../features/categorise/storage";
import type { AiCategoryRecord } from "../features/categorise/categories";
import { parseAiCategoryRecord } from "./backup";
import {
  mergeAiCategories,
  mergeIndexJob,
} from "../features/backup/ai-merge";

/**
 * The AI index in transactional IndexedDB (v0.30.0).
 *
 * Before v0.30 the AI categories and the index job lived in
 * localStorage (`leonida-ai-categories-v1` /
 * `leonida-ai-index-job-v1`), written by two separate `setItem`
 * calls that each swallowed their own errors. Two holes that
 * combination left open:
 *
 * 1. A batch's results and its "attempted" marking were two
 *    independent writes. If the categories write failed (quota,
 *    unavailable storage) but the job write succeeded, the place
 *    counted as attempted with no type recorded — permanently
 *    skipped, silently. If the tab died between the two, the same
 *    split could strand a batch either way.
 * 2. A failed write was invisible: `saveAiCategories` / `saveIndexJob`
 *    caught everything, so the UI showed progress as saved while
 *    nothing persisted. On reload the work was gone.
 *
 * This database fixes both. Categories, job progress and the
 * migration marker live in ONE Dexie database (`leonida-atlas-ai`),
 * separate from the per-workspace user-data database: the AI index
 * is device-global — one index, one job — while workspaces are
 * per-identity user data, and a workspace switch must never hide or
 * fork the index. Every mutation below runs in a single transaction
 * and verifies by reading back before it reports success; a failed
 * transaction reports failure, never success.
 *
 * Migration (localStorage -> here) is one transaction too: the old
 * keys are only removed AFTER the transaction commits and the
 * read-back verifies. A failed migration leaves the old keys and
 * the old data exactly where they were, and the store fails loudly
 * instead of silently falling back to the lossy store.
 */

export interface AiIndexJobRow extends IndexJobState {
  key: "job";
}

export interface AiMetaRow {
  key: string;
  value: unknown;
}

export interface AiMigrationRecord {
  migratedAt: string;
  categories: number;
  attempted: number;
  source: "localStorage-v1" | "none";
}

export const AI_MIGRATION_META_KEY = "ai-migration-v1";

export class AiIndexDatabase extends Dexie {
  declare aiCategories: Table<AiCategoryRecord, string>;
  declare aiIndexJob: Table<AiIndexJobRow, string>;
  declare aiMeta: Table<AiMetaRow, string>;

  constructor(name = "leonida-atlas-ai") {
    super(name);
    this.version(1).stores({
      aiCategories: "placeId",
      aiIndexJob: "key",
      aiMeta: "key",
    });
  }
}

// A live binding lets the store and tests use the selected database.
// Only the store's load path may replace it.
export let aiIndexDb = new AiIndexDatabase();
export function replaceAiIndexDatabase(database: AiIndexDatabase): void {
  aiIndexDb = database;
}

export interface AiIndexSnapshot {
  categories: Record<string, AiCategoryRecord>;
  job: IndexJobState;
  /** True once the localStorage migration has run (even with zero records). */
  migrated: boolean;
  migration: AiMigrationRecord | null;
}

export async function loadAiIndex(
  db: AiIndexDatabase = aiIndexDb,
): Promise<AiIndexSnapshot> {
  const [rows, jobRow, meta] = await Promise.all([
    db.aiCategories.toArray(),
    db.aiIndexJob.get("job"),
    db.aiMeta.get(AI_MIGRATION_META_KEY),
  ]);
  const categories: Record<string, AiCategoryRecord> = {};
  for (const record of rows) categories[record.placeId] = record;
  const migration = (meta?.value ?? null) as AiMigrationRecord | null;
  return {
    categories,
    job: jobRow
      ? {
          status: jobRow.status,
          attemptedPlaceIds: jobRow.attemptedPlaceIds,
          resolverVersion: jobRow.resolverVersion,
          updatedAt: jobRow.updatedAt,
          ...(jobRow.error ? { error: jobRow.error } : {}),
        }
      : { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] },
    migrated: migration !== null,
    migration,
  };
}

/**
 * Migrate the localStorage index into IndexedDB, atomically.
 *
 * Reads and validates the old keys, writes categories + job +
 * migration marker in ONE transaction, and reads the counts back
 * inside that same transaction. Returns the migrated counts. The
 * caller must only remove the localStorage keys after this resolves
 * — if it throws, nothing was written and the old data is untouched.
 */
export async function migrateAiIndexFromLocalStorage(
  storage: StorageLike,
  db: AiIndexDatabase = aiIndexDb,
): Promise<AiMigrationRecord> {
  const categories = parseAiCategories(
    storage.getItem(AI_CATEGORIES_STORAGE_KEY),
  );
  const job = parseIndexJob(storage.getItem(AI_INDEX_JOB_STORAGE_KEY));
  const records = Object.values(categories).map((record) =>
    parseAiCategoryRecord(record),
  );
  const record: AiMigrationRecord = {
    migratedAt: new Date().toISOString(),
    categories: records.length,
    attempted: job.attemptedPlaceIds.length,
    source: "localStorage-v1",
  };
  await db.transaction(
    "rw",
    [db.aiCategories, db.aiIndexJob, db.aiMeta],
    async () => {
      await db.aiCategories.bulkPut(records);
      await db.aiIndexJob.put({ ...job, key: "job" });
      await db.aiMeta.put({
        key: AI_MIGRATION_META_KEY,
        value: record,
      });
      // Verify inside the transaction: the counts we just wrote
      // must read back, or the whole migration aborts.
      const [count, jobRow] = await Promise.all([
        db.aiCategories.count(),
        db.aiIndexJob.get("job"),
      ]);
      if (count !== records.length)
        throw new Error(
          `AI migration verification failed: wrote ${records.length} categories, read back ${count}.`,
        );
      if (!jobRow || jobRow.attemptedPlaceIds.length !== job.attemptedPlaceIds.length)
        throw new Error(
          "AI migration verification failed: the index job did not read back.",
        );
    },
  );
  return record;
}

/** Mark the migration done with zero records (no localStorage data to move). */
export async function markAiMigrationEmpty(
  db: AiIndexDatabase = aiIndexDb,
): Promise<AiMigrationRecord> {
  const record: AiMigrationRecord = {
    migratedAt: new Date().toISOString(),
    categories: 0,
    attempted: 0,
    source: "none",
  };
  await db.aiMeta.put({ key: AI_MIGRATION_META_KEY, value: record });
  return record;
}

export interface AiBatchResult {
  categories: number;
  attempted: number;
}

/**
 * Save one finished batch — its category records AND its attempted
 * marking — in a single transaction. Either both commit or neither
 * does, so a place can never count as attempted with no type
 * recorded, and a batch is never half-saved. The job patch (usually
 * a status change) rides in the same transaction. Verifies by
 * reading the written records and the job row back before resolving.
 */
export async function saveAiBatch(
  records: readonly AiCategoryRecord[],
  attemptedPlaceIds: readonly string[],
  jobPatch: Partial<IndexJobState>,
  db: AiIndexDatabase = aiIndexDb,
): Promise<AiBatchResult> {
  const clean = records.map((record) => parseAiCategoryRecord(record));
  const result = await db.transaction(
    "rw",
    [db.aiCategories, db.aiIndexJob],
    async () => {
      if (clean.length > 0) await db.aiCategories.bulkPut(clean);
      const current =
        (await db.aiIndexJob.get("job")) ?? ({ ...EMPTY_INDEX_JOB, key: "job" } as AiIndexJobRow);
      const attempted = new Set(current.attemptedPlaceIds);
      for (const id of attemptedPlaceIds) attempted.add(id);
      const job: AiIndexJobRow = {
        ...current,
        ...jobPatch,
        attemptedPlaceIds: [...attempted],
        updatedAt: new Date().toISOString(),
        key: "job",
      };
      await db.aiIndexJob.put(job);
      // Verify: every record just written must read back, and the
      // job row must hold every attempted id.
      if (clean.length > 0) {
        const readBack = await db.aiCategories.bulkGet(
          clean.map((record) => record.placeId),
        );
        if (readBack.some((record) => record === undefined))
          throw new Error(
            "AI batch verification failed: a saved category did not read back.",
          );
      }
      const savedJob = await db.aiIndexJob.get("job");
      if (
        !savedJob ||
        attemptedPlaceIds.some((id) => !savedJob.attemptedPlaceIds.includes(id))
      )
        throw new Error(
          "AI batch verification failed: the index job did not read back.",
        );
      return {
        categories: await db.aiCategories.count(),
        attempted: savedJob.attemptedPlaceIds.length,
      };
    },
  );
  return result;
}

/** Persist a job-only change (pause, resume, error) and verify it read back. */
export async function saveAiJob(
  patch: Partial<IndexJobState>,
  db: AiIndexDatabase = aiIndexDb,
): Promise<void> {
  await db.transaction("rw", [db.aiIndexJob], async () => {
    const current =
      (await db.aiIndexJob.get("job")) ?? ({ ...EMPTY_INDEX_JOB, key: "job" } as AiIndexJobRow);
    const job: AiIndexJobRow = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      key: "job",
    };
    await db.aiIndexJob.put(job);
    const saved = await db.aiIndexJob.get("job");
    if (!saved || saved.updatedAt !== job.updatedAt)
      throw new Error("AI job verification failed: the job did not read back.");
  });
}

/** Persist one category record (confirm / correct) and verify it read back. */
export async function saveAiCategory(
  record: AiCategoryRecord,
  db: AiIndexDatabase = aiIndexDb,
): Promise<void> {
  const clean = parseAiCategoryRecord(record);
  await db.transaction("rw", [db.aiCategories], async () => {
    await db.aiCategories.put(clean);
    const saved = await db.aiCategories.get(clean.placeId);
    if (!saved || saved.status !== clean.status || saved.aiCategory !== clean.aiCategory)
      throw new Error(
        "AI category verification failed: the record did not read back.",
      );
  });
}

export interface AiMergeStats {
  added: number;
  updated: number;
  keptLocal: number;
  addedAttempted: number;
}

/**
 * Merge a restored AI index with the one already on this device, in
 * one transaction (see ai-merge.ts for the rules: the user's
 * corrections win, confirmed beats suggested, "not sure" never
 * overwrites a type). Returns the merge counts for the success
 * message. A failed transaction leaves the local index untouched.
 */
export async function mergeImportedAiIndex(
  records: readonly AiCategoryRecord[],
  job: IndexJobState | null,
  db: AiIndexDatabase = aiIndexDb,
): Promise<AiMergeStats> {
  const clean = records.map((record) => parseAiCategoryRecord(record));
  return db.transaction(
    "rw",
    [db.aiCategories, db.aiIndexJob],
    async () => {
      // Read the two tables inline: loadAiIndex also reads aiMeta,
      // which is NOT in this transaction's scope — Dexie throws
      // NotFoundError for an out-of-scope table inside a transaction.
      const [rows, jobRow] = await Promise.all([
        db.aiCategories.toArray(),
        db.aiIndexJob.get("job"),
      ]);
      const current: Record<string, AiCategoryRecord> = {};
      for (const row of rows) current[row.placeId] = row;
      const currentJob: IndexJobState = jobRow
        ? {
            status: jobRow.status,
            attemptedPlaceIds: jobRow.attemptedPlaceIds,
            resolverVersion: jobRow.resolverVersion,
            updatedAt: jobRow.updatedAt,
            ...(jobRow.error ? { error: jobRow.error } : {}),
          }
        : { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] };
      const mergedCategories = mergeAiCategories(current, clean);
      const mergedJob = job
        ? mergeIndexJob(currentJob, job)
        : { job: currentJob, addedAttempted: 0 };
      await db.aiCategories.bulkPut(Object.values(mergedCategories.merged));
      await db.aiIndexJob.put({ ...mergedJob.job, key: "job" });
      const [count, savedJob] = await Promise.all([
        db.aiCategories.count(),
        db.aiIndexJob.get("job"),
      ]);
      if (count !== Object.keys(mergedCategories.merged).length)
        throw new Error(
          "AI import verification failed: the merged index did not read back.",
        );
      if (!savedJob)
        throw new Error(
          "AI import verification failed: the merged job did not read back.",
        );
      return {
        added: mergedCategories.added,
        updated: mergedCategories.updated,
        keptLocal: mergedCategories.keptLocal,
        addedAttempted: mergedJob.addedAttempted,
      };
    },
  );
}

/** Clear the whole AI index (categories + job) and verify it is empty. */
export async function clearAiIndex(
  db: AiIndexDatabase = aiIndexDb,
): Promise<void> {
  await db.transaction("rw", [db.aiCategories, db.aiIndexJob], async () => {
    await db.aiCategories.clear();
    await db.aiIndexJob.put({ ...EMPTY_INDEX_JOB, key: "job" });
    const count = await db.aiCategories.count();
    if (count !== 0)
      throw new Error("AI clear verification failed: categories remain.");
  });
}

/**
 * Replace the whole index with a snapshot, in one verified
 * transaction — the compensation step for a backup import whose
 * user-data half failed after the AI half committed. Either the
 * snapshot is fully restored or the transaction aborts and the
 * (already merged) state stays, which the caller must report.
 */
export async function replaceAiIndex(
  categories: Record<string, AiCategoryRecord>,
  job: IndexJobState,
  db: AiIndexDatabase = aiIndexDb,
): Promise<void> {
  const clean = Object.values(categories).map((record) =>
    parseAiCategoryRecord(record),
  );
  await db.transaction("rw", [db.aiCategories, db.aiIndexJob], async () => {
    await db.aiCategories.clear();
    await db.aiCategories.bulkPut(clean);
    await db.aiIndexJob.put({ ...job, key: "job" });
    const [count, savedJob] = await Promise.all([
      db.aiCategories.count(),
      db.aiIndexJob.get("job"),
    ]);
    if (count !== clean.length || !savedJob)
      throw new Error("AI restore verification failed.");
  });
}

/** Read the index for a backup export — a snapshot only, never a write. */
export async function exportAiIndex(
  db: AiIndexDatabase = aiIndexDb,
): Promise<{ aiCategories: AiCategoryRecord[]; aiIndexJob: IndexJobState }> {
  const snapshot = await loadAiIndex(db);
  return {
    aiCategories: Object.values(snapshot.categories),
    aiIndexJob: snapshot.job,
  };
}

/**
 * Apply the resolver-version re-scan rule (see storage.ts) and
 * persist the re-queued job — used by the store on load when the
 * stored job predates the current resolver.
 */
export async function migrateAiJobForResolver(
  db: AiIndexDatabase = aiIndexDb,
): Promise<{ requeued: number }> {
  const snapshot = await loadAiIndex(db);
  const { job, requeued } = migrateIndexJobForResolver(
    snapshot.job,
    snapshot.categories,
  );
  if (requeued > 0) await saveAiJob(job, db);
  return { requeued };
}
