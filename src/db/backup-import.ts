import type { Backup } from "../domain/types";
import { atlasRepository } from "./repository";
import {
  aiIndexDb,
  loadAiIndex,
  mergeImportedAiIndex,
  replaceAiIndex,
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
 * 1. The caller validates the file first (parseBackup) — a corrupt
 *    file never reaches this function, so it can change nothing.
 * 2. The AI half merges first, in its own verified transaction.
 * 3. The user-data half imports next, in its own transaction.
 * 4. If step 3 throws, the AI half is rolled back to the snapshot
 *    taken before step 2, and the original error is rethrown — the
 *    import reports failure and the pre-import data is back where
 *    it was. (If the rollback itself fails, the error carries both
 *    failures — the caller must surface that, not claim success.)
 *
 * Callers must wrap this in saveLocal (which reloads the user
 * store after the transaction) and reload the AI store from the
 * database after it resolves — only then may the UI say the import
 * succeeded.
 */
export async function importAtlasBackup(
  backup: Backup,
): Promise<AiMergeStats> {
  const before = await loadAiIndex(aiIndexDb);
  const stats = await mergeImportedAiIndex(
    backup.aiCategories,
    backup.aiIndexJob,
    aiIndexDb,
  );
  try {
    await atlasRepository.importBackup(backup);
  } catch (error) {
    try {
      await replaceAiIndex(before.categories, before.job, aiIndexDb);
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
