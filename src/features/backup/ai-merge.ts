import type {
  AiCategoryRecord,
  AiCategoryStatus,
} from "../categorise/categories";
import type { IndexJobState } from "../categorise/storage";

/**
 * Merging a restored AI index with the one already on this phone.
 *
 * Pure functions — no storage, no store — so the rules are unit-testable
 * and the same whether the merge runs from a backup import or anywhere
 * else.
 *
 * The user's own word always wins:
 * - `corrected` (the user picked the type) beats everything.
 * - `confirmed` (the user said the AI was right) beats a bare suggestion.
 * - A confident type beats "not sure" — an unsure record never
 *   overwrites a type, and never erases one.
 * - Within the same rank, the newer record wins; a tie keeps the one
 *   already on this phone. A newer correction is never overwritten by
 *   an older backup.
 */

const STATUS_RANK: Record<AiCategoryStatus, number> = {
  unsure: 1,
  suggested: 2,
  confirmed: 3,
  corrected: 4,
};

export interface AiCategoryMergeResult {
  merged: Record<string, AiCategoryRecord>;
  /** Places that only the backup had. */
  added: number;
  /** Places where the backup's record won over a different local one. */
  updated: number;
  /** Places where the record already on this phone won. */
  keptLocal: number;
}

export function mergeAiCategories(
  local: Readonly<Record<string, AiCategoryRecord>>,
  imported: readonly AiCategoryRecord[],
): AiCategoryMergeResult {
  const merged: Record<string, AiCategoryRecord> = { ...local };
  let added = 0;
  let updated = 0;
  let keptLocal = 0;
  for (const record of imported) {
    const current = merged[record.placeId];
    if (!current) {
      merged[record.placeId] = record;
      added++;
      continue;
    }
    const currentRank = STATUS_RANK[current.status];
    const incomingRank = STATUS_RANK[record.status];
    const incomingWins =
      incomingRank > currentRank ||
      (incomingRank === currentRank &&
        record.indexedAt > current.indexedAt);
    if (incomingWins) {
      merged[record.placeId] = record;
      updated++;
    } else {
      keptLocal++;
    }
  }
  return { merged, added, updated, keptLocal };
}

export interface IndexJobMergeResult {
  job: IndexJobState;
  /** Attempted ids the backup added to the local job. */
  addedAttempted: number;
}

/**
 * Merge a restored job with the live one. Attempted ids are a union —
 * a restore never forgets a place either side already did. The local
 * status is always kept: a job running on this phone right now is
 * never paused, stopped or marked done by a file, and a file that
 * says "running" was interrupted when it was exported, so it never
 * claims the job is going. The resolver version is the newer of the
 * two, so a restore never re-queues places the current resolver
 * already handled.
 */
export function mergeIndexJob(
  local: IndexJobState,
  imported: IndexJobState,
): IndexJobMergeResult {
  const attempted = new Set(local.attemptedPlaceIds);
  let addedAttempted = 0;
  for (const id of imported.attemptedPlaceIds) {
    if (!attempted.has(id)) {
      attempted.add(id);
      addedAttempted++;
    }
  }
  return {
    job: {
      status: local.status,
      attemptedPlaceIds: [...attempted],
      resolverVersion: Math.max(
        local.resolverVersion ?? 0,
        imported.resolverVersion ?? 0,
      ),
      updatedAt: new Date().toISOString(),
      ...(local.status === "error" && local.error
        ? { error: local.error }
        : {}),
    },
    addedAttempted,
  };
}
