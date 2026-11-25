import { create } from "zustand";
import {
  CATEGORISATION_MODEL,
  MIN_AI_CONFIDENCE,
  type AiCategoryId,
  type AiCategoryRecord,
  type ParsedCategorisationResult,
} from "./categories";
import {
  AI_CATEGORIES_STORAGE_KEY,
  AI_INDEX_JOB_STORAGE_KEY,
  browserStorage,
  EMPTY_INDEX_JOB,
  loadAiCategories,
  loadIndexJob,
  migrateIndexJobForResolver,
  parseAiCategories,
  parseIndexJob,
  saveAiCategories,
  saveIndexJob,
  type IndexJobState,
  type StorageLike,
} from "./storage";
import {
  aiIndexDb,
  clearAiIndex,
  loadAiIndex,
  markAiMigrationEmpty,
  mergeImportedAiIndex,
  migrateAiIndexFromLocalStorage,
  saveAiBatch,
  saveAiCategory,
  saveAiJob,
} from "../../db/ai-index";
import { mergeAiCategories, mergeIndexJob } from "../backup/ai-merge";

/**
 * The AI index, as app state.
 *
 * v0.30.0: categories and job progress live in transactional
 * IndexedDB (`leonida-atlas-ai`, see db/ai-index.ts), not
 * localStorage. Every mutation persists first and only then updates
 * the in-memory state — the UI never shows progress as saved that
 * is not actually persisted — and a batch's results and its
 * "attempted" marking commit in ONE transaction, so a place can
 * never count as attempted with no type recorded.
 *
 * The old localStorage keys (`leonida-ai-categories-v1` /
 * `leonida-ai-index-job-v1`) are migrated once, in one transaction,
 * and only removed after the migration verifies. A failed migration
 * leaves the old data untouched and the store reports
 * `storageError` instead of silently falling back to the lossy
 * store.
 *
 * Tests may still inject a StorageLike (`load(storage)`): that is
 * the legacy path, kept so the store's rules stay unit-testable
 * without IndexedDB. The app never passes one — it always loads
 * from the database.
 */

let activeStorage: StorageLike | null = browserStorage();
/** Where this store loaded from: the database (app) or an injected store (tests). */
let loadedFrom: "idb" | "legacy" | null = null;
let loadInFlight: Promise<boolean> | null = null;

function storageErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "The AI index could not be saved on this device.";
}

interface AiIndexStoreState {
  categories: Record<string, AiCategoryRecord>;
  job: IndexJobState;
  loaded: boolean;
  /** Set when a load or a write failed — shown in the Index panel,
   * never silently swallowed. Null once a write succeeds again. */
  storageError: string | null;
  /** How many "not sure" places the resolver-version migration just
   * re-queued (v0.14.0) — shown in the Index panel until the job runs
   * again. Session-only: it describes this launch's migration. */
  requeuedUnsure: number;
  clearRequeueNotice: () => void;
  /** Session-only counter, never persisted: the forced onboarding's
   * "Start sorting" bumps it, and the Layers panel starts the job
   * when it sees the bump. Lets the job start from the onboarding
   * sheet, where the run controls themselves don't live. */
  startRequestId: number;
  requestIndexStart: () => void;
  /** Load the index (migrating from localStorage once, if needed).
   * With an injected storage this is the legacy path; without one
   * it is the IndexedDB path. Returns true only if the index is
   * actually loaded — false leaves `storageError` set. */
  load: (storage?: StorageLike | null) => Promise<boolean>;
  /** Reload from the database (post-import, cross-tab update).
   * No-op on the legacy path. */
  reloadFromDatabase: () => Promise<boolean>;
  /** Apply one finished batch: results become records, ids become
   * attempted — in ONE transaction, verified by read-back. Returns
   * false (and sets storageError) if the batch did not persist;
   * the in-memory state is only updated on success. */
  applyBatch: (
    results: ParsedCategorisationResult[],
    attemptedPlaceIds: readonly string[],
    model?: string,
  ) => Promise<boolean>;
  /** Apply results without marking anything attempted (deterministic
   * results saved before the LLM call). Kept for the runner's
   * deterministic-first step and for tests. */
  applyResults: (
    results: ParsedCategorisationResult[],
    model?: string,
  ) => Promise<boolean>;
  markAttempted: (placeIds: readonly string[]) => Promise<boolean>;
  setJob: (patch: Partial<IndexJobState>) => Promise<boolean>;
  /** The user confirms the AI's type — it stays labelled as AI suggested, now confirmed by them. */
  confirmCategory: (placeId: string) => Promise<boolean>;
  /** The user corrects the type with one tap — their word replaces the AI's. */
  correctCategory: (
    placeId: string,
    category: AiCategoryId,
    shopType?: string,
  ) => Promise<boolean>;
  /**
   * Merge a restored AI index with the one on this phone (see
   * ai-merge.ts for the rules: the user's corrections win, confirmed
   * beats suggested, "not sure" never overwrites a type). Safe to
   * call while the job is running — the runner always reads the
   * live state, and the merge keeps the local job status, so a
   * restore never pauses or stops a run in progress.
   */
  mergeImportedAi: (
    records: readonly AiCategoryRecord[],
    job: IndexJobState | null,
  ) => Promise<{
    added: number;
    updated: number;
    keptLocal: number;
    addedAttempted: number;
  }>;
  /** Re-check the ones the AI was not sure about (clears only `unsure` attempts). */
  retryUnsure: () => Promise<boolean>;
  clearAll: (storage?: StorageLike | null) => Promise<boolean>;
}

function buildRecords(
  current: Record<string, AiCategoryRecord>,
  results: ParsedCategorisationResult[],
  model: string,
): Record<string, AiCategoryRecord> {
  const now = new Date().toISOString();
  const categories = { ...current };
  for (const result of results) {
    const previous = categories[result.placeId];
    // A user correction is theirs — a later re-run must not overwrite it.
    if (previous?.status === "corrected" || previous?.status === "confirmed")
      continue;
    categories[result.placeId] = {
      placeId: result.placeId,
      aiCategory: result.category,
      shopType: result.shopType,
      confidence: result.confidence,
      reason: result.reason,
      model,
      indexedAt: now,
      status: result.confidence < MIN_AI_CONFIDENCE ? "unsure" : "suggested",
      // Where the type came from — 'ai' for an LLM reply, a
      // deterministic step otherwise. The label in the app follows
      // this, so a data match is never shown as "AI suggested".
      source: result.source ?? "ai",
      matchedFrom: result.matchedFrom,
    };
  }
  return categories;
}

export const useAiIndexStore = create<AiIndexStoreState>()((set, get) => ({
  categories: {},
  job: { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] },
  loaded: false,
  storageError: null,
  requeuedUnsure: 0,
  clearRequeueNotice: () => set({ requeuedUnsure: 0 }),
  startRequestId: 0,
  requestIndexStart: () =>
    set((state) => ({ startRequestId: state.startRequestId + 1 })),

  load: (storage?: StorageLike | null) => {
    // An injected storage is the legacy path (tests). No argument
    // is the production path: IndexedDB, with a one-time migration.
    if (storage !== undefined) {
      activeStorage = storage;
      loadedFrom = "legacy";
      const categories = loadAiCategories(storage);
      const storedJob = loadIndexJob(storage);
      // A job from an older resolver version has its "not sure" places
      // re-queued for a re-scan with the new prompt (v0.14.0) — the
      // migration is saved immediately, so it runs exactly once.
      const { job, requeued } = migrateIndexJobForResolver(storedJob, categories);
      if (requeued > 0) saveIndexJob(job, storage);
      set({ categories, job, loaded: true, requeuedUnsure: requeued, storageError: null });
      return Promise.resolve(true);
    }
    if (loadInFlight) return loadInFlight;
    loadInFlight = (async () => {
      try {
        let snapshot = await loadAiIndex(aiIndexDb);
        if (!snapshot.migrated) {
          const legacy = browserStorage();
          const legacyCategories = legacy
            ? parseAiCategories(legacy.getItem(AI_CATEGORIES_STORAGE_KEY))
            : {};
          const legacyJob = legacy
            ? parseIndexJob(legacy.getItem(AI_INDEX_JOB_STORAGE_KEY))
            : { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] };
          const hasLegacyData =
            Object.keys(legacyCategories).length > 0 ||
            legacyJob.attemptedPlaceIds.length > 0 ||
            legacyJob.status !== "idle";
          if (legacy && hasLegacyData) {
            // Migrate in one transaction; the old keys are removed
            // ONLY after it resolves — a failure leaves them (and
            // the data) exactly where they were.
            await migrateAiIndexFromLocalStorage(legacy, aiIndexDb);
            legacy.removeItem?.(AI_CATEGORIES_STORAGE_KEY);
            legacy.removeItem?.(AI_INDEX_JOB_STORAGE_KEY);
          } else {
            await markAiMigrationEmpty(aiIndexDb);
          }
          snapshot = await loadAiIndex(aiIndexDb);
        }
        // A job from an older resolver version has its "not sure"
        // places re-queued — persisted, so it runs exactly once.
        const { job, requeued } = migrateIndexJobForResolver(
          snapshot.job,
          snapshot.categories,
        );
        if (requeued > 0) {
          await saveAiJob(job, aiIndexDb);
          snapshot = await loadAiIndex(aiIndexDb);
        }
        loadedFrom = "idb";
        activeStorage = null;
        set({
          categories: snapshot.categories,
          job: snapshot.job,
          loaded: true,
          requeuedUnsure: requeued,
          storageError: null,
        });
        return true;
      } catch (error) {
        // Fail loudly: the index is NOT loaded, and the panel shows
        // why with a retry. Never fall back to localStorage here —
        // that is how progress used to be silently lost.
        set({
          loaded: true,
          storageError: storageErrorMessage(error),
        });
        return false;
      } finally {
        loadInFlight = null;
      }
    })();
    return loadInFlight;
  },

  reloadFromDatabase: async () => {
    if (loadedFrom !== "idb") return get().loaded;
    try {
      const snapshot = await loadAiIndex(aiIndexDb);
      // Deliberately leaves storageError alone: a successful reload
      // here (another tab saved) does not prove this tab's failed
      // write succeeded — only this tab's next successful write
      // clears its own error.
      set({
        categories: snapshot.categories,
        job: snapshot.job,
      });
      return true;
    } catch (error) {
      set({ storageError: storageErrorMessage(error) });
      return false;
    }
  },

  applyBatch: async (results, attemptedPlaceIds, model = CATEGORISATION_MODEL) => {
    const next = buildRecords(get().categories, results, model);
    const changed = Object.values(next).filter(
      (record) => get().categories[record.placeId] !== record,
    );
    try {
      if (loadedFrom === "legacy") {
        saveAiCategories(next, activeStorage);
        saveIndexJob(
          {
            ...get().job,
            attemptedPlaceIds: [
              ...new Set([...get().job.attemptedPlaceIds, ...attemptedPlaceIds]),
            ],
            updatedAt: new Date().toISOString(),
          },
          activeStorage,
        );
        // Verify the legacy write read back — localStorage can
        // throw (quota) or silently drop a write.
        const readBack = loadAiCategories(activeStorage);
        if (
          changed.some((record) => readBack[record.placeId]?.status !== record.status)
        )
          throw new Error("The AI index could not be saved on this device.");
        const readJob = loadIndexJob(activeStorage);
        if (
          attemptedPlaceIds.some((id) => !readJob.attemptedPlaceIds.includes(id))
        )
          throw new Error("The AI index could not be saved on this device.");
      } else {
        await saveAiBatch(changed, attemptedPlaceIds, {}, aiIndexDb);
        // Reload so the in-memory state is exactly what persisted
        // (including any write from another tab in the meantime).
        const snapshot = await loadAiIndex(aiIndexDb);
        set({
          categories: snapshot.categories,
          job: snapshot.job,
          storageError: null,
        });
        return true;
      }
    } catch (error) {
      set({ storageError: storageErrorMessage(error) });
      return false;
    }
    set({
      categories: next,
      job: {
        ...get().job,
        attemptedPlaceIds: [
          ...new Set([...get().job.attemptedPlaceIds, ...attemptedPlaceIds]),
        ],
        updatedAt: new Date().toISOString(),
      },
      storageError: null,
    });
    return true;
  },

  applyResults: (results, model) => get().applyBatch(results, [], model),

  markAttempted: (placeIds) => get().applyBatch([], placeIds),

  setJob: async (patch) => {
    try {
      if (loadedFrom === "legacy") {
        const job: IndexJobState = {
          ...get().job,
          ...patch,
          updatedAt: new Date().toISOString(),
        };
        saveIndexJob(job, activeStorage);
        const readBack = loadIndexJob(activeStorage);
        // NOTE (v0.30.0 cross-lane fix): parseIndexJob deliberately
        // rewrites a saved "running" as "paused" on read — a reloaded
        // running job was interrupted. So the read-back of a running
        // job IS "paused", and that is a successful save, not a
        // failure. Comparing readBack.status to "running" made every
        // job start fail with "could not be saved".
        const expectedStatus =
          job.status === "running" ? "paused" : job.status;
        if (readBack.status !== expectedStatus && patch.status !== undefined)
          throw new Error("The AI index could not be saved on this device.");
        set({ job, storageError: null });
        return true;
      }
      await saveAiJob(patch, aiIndexDb);
      const snapshot = await loadAiIndex(aiIndexDb);
      set({ job: snapshot.job, storageError: null });
      return true;
    } catch (error) {
      set({ storageError: storageErrorMessage(error) });
      return false;
    }
  },

  confirmCategory: async (placeId) => {
    const record = get().categories[placeId];
    if (!record || record.status === "unsure") return true;
    const next = { ...record, status: "confirmed" as const };
    try {
      if (loadedFrom === "legacy") {
        const categories = { ...get().categories, [placeId]: next };
        saveAiCategories(categories, activeStorage);
        const readBack = loadAiCategories(activeStorage);
        if (readBack[placeId]?.status !== "confirmed")
          throw new Error("The AI index could not be saved on this device.");
        set({ categories, storageError: null });
        return true;
      }
      await saveAiCategory(next, aiIndexDb);
      set({
        categories: { ...get().categories, [placeId]: next },
        storageError: null,
      });
      return true;
    } catch (error) {
      set({ storageError: storageErrorMessage(error) });
      return false;
    }
  },

  correctCategory: async (placeId, category, shopType) => {
    const record = get().categories[placeId];
    if (!record) return true;
    const next = {
      ...record,
      status: "corrected" as const,
      userCategory: category,
      userShopType: category === "shop" ? shopType : undefined,
    };
    try {
      if (loadedFrom === "legacy") {
        const categories = { ...get().categories, [placeId]: next };
        saveAiCategories(categories, activeStorage);
        const readBack = loadAiCategories(activeStorage);
        if (readBack[placeId]?.status !== "corrected")
          throw new Error("The AI index could not be saved on this device.");
        set({ categories, storageError: null });
        return true;
      }
      await saveAiCategory(next, aiIndexDb);
      set({
        categories: { ...get().categories, [placeId]: next },
        storageError: null,
      });
      return true;
    } catch (error) {
      set({ storageError: storageErrorMessage(error) });
      return false;
    }
  },

  mergeImportedAi: async (records, job) => {
    try {
      if (loadedFrom === "legacy") {
        const categoriesResult = mergeAiCategories(get().categories, records);
        const jobResult = job
          ? mergeIndexJob(get().job, job)
          : { job: get().job, addedAttempted: 0 };
        set({ categories: categoriesResult.merged, job: jobResult.job });
        saveAiCategories(categoriesResult.merged, activeStorage);
        if (job) saveIndexJob(jobResult.job, activeStorage);
        set({ storageError: null });
        return {
          added: categoriesResult.added,
          updated: categoriesResult.updated,
          keptLocal: categoriesResult.keptLocal,
          addedAttempted: jobResult.addedAttempted,
        };
      }
      const stats = await mergeImportedAiIndex(records, job, aiIndexDb);
      const snapshot = await loadAiIndex(aiIndexDb);
      set({
        categories: snapshot.categories,
        job: snapshot.job,
        storageError: null,
      });
      return stats;
    } catch (error) {
      set({ storageError: storageErrorMessage(error) });
      throw error;
    }
  },

  retryUnsure: async () => {
    const unsure = new Set(
      Object.values(get().categories)
        .filter((record) => record.status === "unsure")
        .map((record) => record.placeId),
    );
    const job: IndexJobState = {
      ...get().job,
      status: "idle",
      attemptedPlaceIds: get().job.attemptedPlaceIds.filter(
        (id) => !unsure.has(id),
      ),
      updatedAt: new Date().toISOString(),
      error: undefined,
    };
    try {
      if (loadedFrom === "legacy") {
        saveIndexJob(job, activeStorage);
        set({ job, requeuedUnsure: 0, storageError: null });
        return true;
      }
      await saveAiJob(job, aiIndexDb);
      const snapshot = await loadAiIndex(aiIndexDb);
      set({ job: snapshot.job, requeuedUnsure: 0, storageError: null });
      return true;
    } catch (error) {
      set({ storageError: storageErrorMessage(error) });
      return false;
    }
  },

  clearAll: async (storage) => {
    // An explicit storage is the legacy path (tests). No argument
    // is the database path — the database is the source of truth
    // even if load() has not run yet in this tab.
    if (storage !== undefined) {
      set({ categories: {}, job: { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] }, requeuedUnsure: 0 });
      try {
        storage?.removeItem?.(AI_CATEGORIES_STORAGE_KEY);
        storage?.removeItem?.(AI_INDEX_JOB_STORAGE_KEY);
      } catch {
        // Ignore — the in-memory state is already cleared.
      }
      return true;
    }
    try {
      await clearAiIndex(aiIndexDb);
      try {
        const legacy = browserStorage();
        legacy?.removeItem?.(AI_CATEGORIES_STORAGE_KEY);
        legacy?.removeItem?.(AI_INDEX_JOB_STORAGE_KEY);
      } catch {
        // Legacy keys are already migrated away; their removal is best-effort.
      }
      set({
        categories: {},
        job: { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] },
        requeuedUnsure: 0,
        storageError: null,
      });
      return true;
    } catch (error) {
      set({ storageError: storageErrorMessage(error) });
      return false;
    }
  },
}));

/** Counts for the progress line: X of N indexed, Y still to go.
 * "To go" includes the "not sure" places — they are NOT attempted,
 * so they are still to do. "Pending" is the never-run remainder:
 * the job is done when pending hits 0, even while "not sure" places
 * wait for a re-scan. */
export function indexJobCounts(
  categories: Record<string, AiCategoryRecord>,
  job: IndexJobState,
  totalUnnamed: number,
): {
  attempted: number;
  categorised: number;
  unsure: number;
  remaining: number;
  pending: number;
} {
  const attempted = job.attemptedPlaceIds.length;
  let categorised = 0;
  let unsure = 0;
  for (const record of Object.values(categories)) {
    if (record.status === "unsure") unsure++;
    else if (record.confidence >= MIN_AI_CONFIDENCE) categorised++;
  }
  const remaining = Math.max(0, totalUnnamed - attempted);
  return {
    attempted,
    categorised,
    unsure,
    remaining,
    pending: Math.max(0, remaining - unsure),
  };
}
