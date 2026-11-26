import type { Backup } from "../domain/types";
import type { Place } from "../domain/types";
import { atlasRepository, ensureCompletionMigration, type AtlasDatabase } from "./repository";
import type { BackupV4 } from "./backup";
import { loadCatalogue } from "../data/catalogue";
import { browserStorage, type StorageLike } from "../features/categorise/storage";
import {
  aiIndexDb,
  loadAiIndex,
  mergeImportedAiIndex,
  replaceAiIndex,
  type AiIndexDatabase,
  type AiMergeStats,
} from "./ai-index";

/**
 * Import a validated backup into BOTH stores, honestly.
 *
 * The user data lives in the per-workspace Dexie database
 * (repository.importBackup, one transaction) and the AI index lives
 * in the device-global AI database (mergeImportedAiIndex, one
 * transaction). IndexedDB cannot span two databases in one
 * transaction, so the import is ordered and compensated instead of
 * pretending to be atomic:
 *
 * 1. The caller validates the file first (parseBackup / parseBackupV4)
 *    — a corrupt file never reaches this function, so it can change
 *    nothing.
 * 2. The AI half merges first, in its own verified transaction.
 * 3. The user-data half imports next, in its own transaction.
 * 4. If step 3 throws, the AI half is rolled back to the snapshot
 *    taken before step 2, and the original error is rethrown — the
 *    import reports failure and the pre-import data is back where
 *    it was. (If the rollback itself fails, the error carries both
 *    failures — the caller must surface that, not claim success.)
 *
 * v0.32 step 3 (backup v4): a v4 file carries seven more sections
 * (DESIGN §11 + addendum §6 step 3). They import after the v3
 * sections, in this order, for a reason:
 *
 * 3a. The repository's v3 import (visited/explored/markers/…) — the
 *     repository only speaks v3, so a v4 file is handed to it as a
 *     version-3 view (`{ ...backup, version: 3 }`); its internal
 *     parseBackup ignores the extra keys.
 * 3b. `ensureCompletionMigration` runs AFTER visited/explored land —
 *     a v3 backup imported after the first migration (or a v4 file
 *     exported before its source database migrated) is picked up by
 *     this pass instead of being stranded. It runs BEFORE the v4
 *     sections import, so the file's own reconciliation entries win
 *     over a stale local tallies key for the same categories (the
 *     migration converts the local key, then the file's entries
 *     overwrite them by category id).
 * 3c. The v4 sections (completion log, reconciliation, enrichments,
 *     corrections, sold state, screenshot metadata, research queue)
 *     land in one transaction, merged by id — import wins on a
 *     same-id conflict, local rows not in the file are never deleted.
 *     Re-importing the same file is a no-op (identical rows, put
 *     semantics), and a migration record the file carries overwrites
 *     the identical record step 3b just created (deterministic ids,
 *     same classification — no duplicates, no double-count).
 *
 * If 3b or 3c throws, the AI half is rolled back like any other step-3
 * failure — but the v3 sections (and any v4 sections already written)
 * stay imported: the import reports failure and the user retries.
 * Retrying is safe — imports merge by id and the migration is
 * idempotent.
 *
 * Callers must wrap this in saveLocal (which reloads the user
 * store after the transaction) and reload the AI store from the
 * database after it resolves — only then may the UI say the import
 * succeeded.
 */

export interface ImportAtlasBackupDeps {
  /** Defaults to the global repository. Pass a fresh database in tests. */
  repository?: AtlasDatabase;
  /** Defaults to the global AI database. Pass a fresh database in tests. */
  aiDb?: AiIndexDatabase;
  /** Defaults to loadCatalogue() (memoized fetch). Pass in tests to avoid the fetch. */
  places?: readonly Place[];
  /** Defaults to the browser's localStorage (the tallies key lives there). */
  storage?: StorageLike | null;
}

/** Write the v4-only sections into the repository, merged by id. */
export async function importBackupV4Sections(
  repository: AtlasDatabase,
  backup: BackupV4,
): Promise<void> {
  await repository.transaction(
    "rw",
    [
      repository.completionRecords,
      repository.reconciliation,
      repository.enrichments,
      repository.corrections,
      repository.personalItemState,
      repository.userScreenshots,
      repository.researchRequests,
    ],
    async () => {
      await repository.completionRecords.bulkPut(backup.completionRecords);
      await repository.reconciliation.bulkPut(backup.reconciliation);
      await repository.enrichments.bulkPut(backup.enrichments);
      await repository.corrections.bulkPut(backup.corrections);
      await repository.personalItemState.bulkPut(backup.personalItemState);
      await repository.userScreenshots.bulkPut(backup.userScreenshots);
      await repository.researchRequests.bulkPut(backup.researchRequests);
    },
  );
}

export async function importAtlasBackup(
  backup: Backup | BackupV4,
  deps: ImportAtlasBackupDeps = {},
): Promise<AiMergeStats> {
  const repository = deps.repository ?? atlasRepository;
  const aiDb = deps.aiDb ?? aiIndexDb;
  const storage = deps.storage !== undefined ? deps.storage : browserStorage();
  const before = await loadAiIndex(aiDb);
  const stats = await mergeImportedAiIndex(
    backup.aiCategories,
    backup.aiIndexJob,
    aiDb,
  );
  try {
    // The repository speaks v3: hand it a version-3 view of a v4 file.
    // Its internal parseBackup re-validates the v3 sections and drops
    // the v4 keys; the v4 sections land in step 3c below.
    await repository.importBackup(
      backup.version === 4 ? { ...backup, version: 3 } : backup,
    );
    // The migration needs the catalogue — resolve it here, after the
    // user-data half lands, so a catalogue failure can never block
    // the AI half or mask a user-data import failure with a fetch
    // error. In production this is the memoized same-origin fetch;
    // in tests the caller injects `places`.
    const places = deps.places ?? (await loadCatalogue());
    // The migration runs after visited/explored land (step 3b).
    await ensureCompletionMigration(repository, places, storage);
    if (backup.version === 4) {
      await importBackupV4Sections(repository, backup);
    }
  } catch (error) {
    try {
      await replaceAiIndex(before.categories, before.job, aiDb);
    } catch (rollbackError) {
      throw new Error(
        `Backup import failed (${error instanceof Error ? error.message : "unknown error"}) and the AI index could not be rolled back (${rollbackError instanceof Error ? rollbackError.message : "unknown error"}). Your previous data may be partially restored — check the index before continuing.`,
        { cause: rollbackError },
      );
    }
    throw error;
  }
  return stats;
}
