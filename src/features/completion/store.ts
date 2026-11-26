/**
 * The user's own 100% completion counts — RETIRED as a UI data
 * source (v0.32 step 6). The UI reads the completion log now
 * (features/completion/log-store.ts); this module stays ONLY because
 * the v3→v4 migration still reads `leonida-completion-v1` through
 * `parseCompletionCounts` / `COMPLETION_STORAGE_KEY` (repository.ts),
 * and its unit tests pin that parse. No UI component may read
 * `useCompletionStore` anymore — after migration deletes the key,
 * it reads 0 tallies (the known step-2 consequence step 6 fixed).
 *
 * Counts live in localStorage under a versioned key
 * (`leonida-completion-v1`) — the same persist-first rule as the AI
 * index store: a mutation writes to storage and verifies the read-back
 * BEFORE the in-memory state changes, so the UI never shows a count as
 * saved that is not actually persisted. A failed write leaves the old
 * counts on screen and reports `storageError`.
 *
 * Counts are NOT in the Atlas backup yet (v0.31.0): the backup merge
 * machine is versioned, two-database, and stabilisation just locked it
 * down — wiring a new section in is a second feature. Counts are small
 * and re-enterable, and the panel says so. That is the follow-up, not
 * a silent gap.
 *
 * Load validation: only the 19 known threshold ids load, only finite
 * numbers, clamped to [0, total]. Unknown ids, non-numbers, and
 * corrupt JSON are dropped — a hand-edited value can never surface as
 * a made-up count.
 */
import { create } from 'zustand';
import {
  COMPLETION_THRESHOLDS,
  clampFound,
  completionThresholdById,
} from '../../data/completion';
import { browserStorage, type StorageLike } from '../categorise/storage';

export type { StorageLike } from '../categorise/storage';

export const COMPLETION_STORAGE_KEY = 'leonida-completion-v1';

export type CompletionCounts = Record<string, number>;

/** Parse a stored value into counts, dropping anything untrusted. */
export function parseCompletionCounts(raw: string | null): CompletionCounts {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const counts: CompletionCounts = {};
  for (const threshold of COMPLETION_THRESHOLDS) {
    const value = (parsed as Record<string, unknown>)[threshold.id];
    if (typeof value === 'number' && Number.isFinite(value)) {
      counts[threshold.id] = clampFound(value, threshold);
    }
  }
  return counts;
}

export function serializeCompletionCounts(counts: CompletionCounts): string {
  return JSON.stringify(counts);
}

function countsEqual(a: CompletionCounts, b: CompletionCounts): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/**
 * Write counts and verify the read-back. Returns false (and leaves
 * storage untouched beyond the failed write) on any exception or
 * mismatch.
 */
export function saveCompletionCounts(
  storage: StorageLike | null,
  counts: CompletionCounts,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(COMPLETION_STORAGE_KEY, serializeCompletionCounts(counts));
    const readBack = parseCompletionCounts(storage.getItem(COMPLETION_STORAGE_KEY));
    return countsEqual(readBack, counts);
  } catch {
    return false;
  }
}

export interface CompletionStore {
  counts: CompletionCounts;
  loaded: boolean;
  storageError: string | null;
  load: (storage?: StorageLike | null) => void;
  setCount: (id: string, value: number, storage?: StorageLike | null) => boolean;
  adjust: (id: string, delta: number, storage?: StorageLike | null) => boolean;
  resetAll: (storage?: StorageLike | null) => boolean;
  clearError: () => void;
}

export const useCompletionStore = create<CompletionStore>()((set, get) => ({
  counts: {},
  loaded: false,
  storageError: null,

  load: (storage = browserStorage()) => {
    if (!storage) {
      set({ loaded: true, storageError: 'Completion counts need on-device storage.' });
      return;
    }
    set({ counts: parseCompletionCounts(storage.getItem(COMPLETION_STORAGE_KEY)), loaded: true });
  },

  setCount: (id, value, storage = browserStorage()) => {
    const threshold = completionThresholdById(id);
    if (!threshold) return false;
    const next = { ...get().counts, [id]: clampFound(value, threshold) };
    if (!saveCompletionCounts(storage, next)) {
      set({ storageError: 'Could not save that count — it is not lost, try again.' });
      return false;
    }
    set({ counts: next, storageError: null });
    return true;
  },

  adjust: (id, delta, storage = browserStorage()) => {
    const threshold = completionThresholdById(id);
    if (!threshold) return false;
    return get().setCount(id, (get().counts[id] ?? 0) + delta, storage);
  },

  resetAll: (storage = browserStorage()) => {
    if (!saveCompletionCounts(storage, {})) {
      set({ storageError: 'Could not clear the counts — nothing was changed.' });
      return false;
    }
    set({ counts: {}, storageError: null });
    return true;
  },

  clearError: () => set({ storageError: null }),
}));
