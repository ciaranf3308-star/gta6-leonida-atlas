import type { BackupV4 } from "../../db/backup";
import { exportWorkspaceBackup } from "../../stores/atlas";
import {
  browserStorage,
  type StorageLike,
} from "../categorise/storage";

/**
 * The one "Back up my Atlas" export, shared by Settings, the backup
 * dialog and the indexing nudge — one file, one filename, one place
 * that records that a backup happened.
 *
 * The file is a plain JSON snapshot of everything the user owns:
 * markers, notes, saved/found places, collections, preferences, and
 * the AI index (sorted "?" places + job progress). The OpenAI key is
 * never in it — the export path never reads the key at all, and the
 * backup validator drops unknown keys, so a key could not ride along
 * even in a hand-edited file.
 *
 * Export reads a snapshot and never writes: it is safe while the
 * indexing job is running. The job saves after every batch on this
 * phone; the backup is what keeps that work past a wipe, a
 * browser-data clear, a PWA uninstall or a new phone.
 */

export const LAST_BACKUP_STORAGE_KEY = "leonida-last-backup-v1";
export const BACKUP_NUDGE_STORAGE_KEY = "leonida-backup-nudge-v1";

export interface LastBackup {
  exportedAt: string;
  /** How many AI-sorted places the backup held. */
  aiCategories: number;
}

export interface BackupExportResult {
  backup: BackupV4;
  aiCategories: number;
  markers: number;
  notes: number;
  favorites: number;
  collections: number;
  visited: number;
  /** v4: the completion log and the manual tallies in the file. */
  completionRecords: number;
  reconciliation: number;
  /** v4: sold cards in the file (the album's sold state). */
  personalItemState: number;
}

function parseLastBackup(raw: string | null): LastBackup | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<LastBackup>;
    if (
      typeof value.exportedAt !== "string" ||
      typeof value.aiCategories !== "number"
    )
      return null;
    return { exportedAt: value.exportedAt, aiCategories: value.aiCategories };
  } catch {
    return null;
  }
}

export function readLastBackup(
  storage: StorageLike | null = browserStorage(),
): LastBackup | null {
  try {
    return parseLastBackup(storage?.getItem(LAST_BACKUP_STORAGE_KEY) ?? null);
  } catch {
    return null;
  }
}

export function recordBackupCompleted(
  aiCategories: number,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(
      LAST_BACKUP_STORAGE_KEY,
      JSON.stringify({
        exportedAt: new Date().toISOString(),
        aiCategories,
      } satisfies LastBackup),
    );
  } catch {
    // The file still downloaded; only the "backed up yet?" reminder
    // loses track, and it will simply ask again.
  }
}

export function readNudgeDismissedUntil(
  storage: StorageLike | null = browserStorage(),
): number {
  try {
    const raw = storage?.getItem(BACKUP_NUDGE_STORAGE_KEY) ?? null;
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function dismissBackupNudge(
  categorisedCount: number,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(
      BACKUP_NUDGE_STORAGE_KEY,
      String(categorisedCount),
    );
  } catch {
    // Dismissal is best-effort; the nudge may show again.
  }
}

/**
 * When the "Backed up yet?" nudge may show. Never while the job is
 * running (the caller checks that) and never twice for the same work:
 * it fires once the index passes 100 newly sorted places since the
 * last backup (or since the user last said "not now"), and once when
 * a finished run has never been backed up at all.
 */
export function shouldShowBackupNudge(args: {
  categorised: number;
  done: boolean;
  lastBackup: LastBackup | null;
  dismissedUntilCount: number;
}): boolean {
  const { categorised, done, lastBackup, dismissedUntilCount } = args;
  if (categorised <= 0) return false;
  if (done && !lastBackup) return true;
  const since = Math.max(lastBackup?.aiCategories ?? 0, dismissedUntilCount);
  return categorised - since >= 100;
}

export function backupFileName(date: Date = new Date()): string {
  return `leonida-atlas-backup-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * Export everything and download the file. Reads a snapshot only —
 * safe to call while the indexing job is running; it never pauses,
 * stops or resets the job. In a non-browser context (tests) the
 * download step is skipped and the counts are still returned.
 */
export async function downloadAtlasBackup(
  workspaceId: string | null,
): Promise<BackupExportResult> {
  const backup = await exportWorkspaceBackup(workspaceId);
  const result: BackupExportResult = {
    backup,
    aiCategories: backup.aiCategories.length,
    markers: backup.markers.length,
    notes: backup.notes.length,
    favorites: backup.favorites.length,
    collections: backup.collections.length,
    visited: backup.visited.length,
    completionRecords: backup.completionRecords.length,
    reconciliation: backup.reconciliation.length,
    personalItemState: backup.personalItemState.length,
  };
  if (typeof document !== "undefined") {
    const blob = new Blob([JSON.stringify(backup)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = backupFileName();
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  recordBackupCompleted(result.aiCategories);
  return result;
}
