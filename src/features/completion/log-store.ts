/**
 * The completion-log store (v0.32 step 6) — the one live copy of the
 * completion log in the app.
 *
 * The map, the journal, Progress and Ask used to read the old
 * visited/explored tables through `useUserStore`. Step 6 re-points
 * them at this store instead: App builds its `GameDatabase` from
 * `records` + `reconciliation` here, so a `recordCompletion` write
 * anywhere (journal checkbox, location card, Ask confirm) rebuilds
 * the same database every surface reads.
 *
 * - `load()` runs on app startup (App.tsx): it runs the v3→v4
 *   migration FIRST (`ensureCompletionMigration` — step 2's handoff
 *   says step 5/6 wires it; until now it ran only on the backup
 *   import path), then reads the log. A migration failure is stored
 *   as `error` and surfaced as a banner with a retry — the old data
 *   is untouched and the app keeps working on the old tables'
 *   audit trail until the retry succeeds.
 * - `refresh()` re-reads the log without migrating (backup import,
 *   cross-tab save). `applyDb()` adopts the rebuilt database a
 *   `recordCompletion` / `undoCompletion` call returns, so the UI
 *   updates without a second read.
 * - `saveReconciliation()` is the Progress tab's write path for the
 *   in-game counter (recordReconciliation — the only writer of
 *   reconciliation entries besides migration and backup import).
 *
 * The store holds data, not the database: App owns the
 * `buildGameDatabase` memo, so a catalogue reload rebuilds the db
 * from the same log. The old visited/explored tables are never read
 * here — they are the audit trail the migration already converted.
 */
import { create } from 'zustand';
import { loadCatalogue } from '../../data/catalogue';
import {
  atlasRepository,
  ensureCompletionMigration,
  type AtlasDatabase,
} from '../../db/repository';
import type {
  CompletionRecord,
  GameDatabase,
  ReconciliationEntry,
} from '../../domain/game-db';
import type { Place } from '../../domain/types';
import { browserStorage, type StorageLike } from '../categorise/storage';
import { recordReconciliation } from './record';

export interface CompletionLogDeps {
  /** Defaults to the global repository. Pass a fresh database in tests. */
  repository?: AtlasDatabase;
  /** Defaults to loadCatalogue() (memoized fetch). Pass in tests to avoid the fetch. */
  places?: readonly Place[];
  /** Defaults to the browser's localStorage (the tallies key lives there). */
  storage?: StorageLike | null;
}

export interface CompletionLogState {
  records: CompletionRecord[];
  reconciliation: ReconciliationEntry[];
  loaded: boolean;
  error: string | null;
  /** Startup: migrate (if anything is left to migrate), then read the log. */
  load: (deps?: CompletionLogDeps) => Promise<void>;
  /** Re-read the log without migrating (after a backup import, or a save in another tab). */
  refresh: (deps?: CompletionLogDeps) => Promise<void>;
  /** Adopt the rebuilt database a completion write returned. */
  applyDb: (db: GameDatabase) => void;
  /** Write one in-game counter; refreshes the log on success. */
  saveReconciliation: (
    categoryId: string,
    count: number,
    deps?: CompletionLogDeps,
  ) => Promise<{ ok: boolean; error?: string }>;
}

/** One in-flight load at a time: App's startup effect, the retry
 * button and the cross-tab handler must never run the migration
 * twice concurrently. */
let loadPromise: Promise<void> | null = null;

async function resolveDeps(
  deps: CompletionLogDeps,
): Promise<{ repository: AtlasDatabase; places: readonly Place[]; storage: StorageLike | null }> {
  const repository = deps.repository ?? atlasRepository;
  const places = deps.places ?? (await loadCatalogue());
  const storage = deps.storage !== undefined ? deps.storage : browserStorage();
  return { repository, places, storage };
}

export const useCompletionLogStore = create<CompletionLogState>()((set, get) => ({
  records: [],
  reconciliation: [],
  loaded: false,
  error: null,

  load: (deps = {}) => {
    if (!loadPromise) {
      loadPromise = (async () => {
        try {
          const { repository, places, storage } = await resolveDeps(deps);
          await ensureCompletionMigration(repository, places, storage);
          const { records, reconciliation } = await repository.loadCompletion();
          set({ records, reconciliation, loaded: true, error: null });
        } catch (error) {
          // No rethrow: the failure is stored as `error` state and the
          // banner offers a retry. App calls this as `void load()` —
          // a rejection there would be an unhandled rejection.
          set({
            loaded: true,
            error:
              error instanceof Error
                ? error.message
                : 'The completion data could not be loaded.',
          });
        } finally {
          loadPromise = null;
        }
      })();
    }
    return loadPromise;
  },

  refresh: async (deps = {}) => {
    const repository = deps.repository ?? atlasRepository;
    try {
      const { records, reconciliation } = await repository.loadCompletion();
      set({ records, reconciliation, loaded: true, error: null });
    } catch (error) {
      set({
        loaded: true,
        error:
          error instanceof Error
            ? error.message
            : 'The completion data could not be loaded.',
      });
    }
  },

  applyDb: (db) => {
    set({
      records: [...db.records],
      reconciliation: [...db.reconciliation],
      loaded: true,
      error: null,
    });
  },

  saveReconciliation: async (categoryId, count, deps = {}) => {
    const result = await recordReconciliation({ categoryId, count }, deps);
    if (!result.ok) {
      return { ok: false, error: result.error ?? 'Could not save that count — try again.' };
    }
    await get().refresh(deps);
    return { ok: true };
  },
}));
