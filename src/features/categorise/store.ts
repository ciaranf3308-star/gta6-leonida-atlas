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
  saveAiCategories,
  saveIndexJob,
  type IndexJobState,
  type StorageLike,
} from "./storage";

/**
 * The AI index, as app state. Categories and job progress live in
 * localStorage (see storage.ts) and are loaded once on app start; every
 * mutation writes through immediately, so a batch is saved before the
 * next one starts and the job can always resume.
 *
 * The storage the store loaded from is remembered, so saves always go
 * back to the same place the load came from (in the app: localStorage).
 */

let activeStorage: StorageLike | null = browserStorage();

interface AiIndexStoreState {
  categories: Record<string, AiCategoryRecord>;
  job: IndexJobState;
  loaded: boolean;
  load: (storage?: StorageLike | null) => void;
  /** Apply one finished batch: results become records, ids become attempted. */
  applyResults: (results: ParsedCategorisationResult[], model?: string) => void;
  markAttempted: (placeIds: readonly string[]) => void;
  setJob: (patch: Partial<IndexJobState>) => void;
  /** The user confirms the AI's type — it stays labelled as AI suggested, now confirmed by them. */
  confirmCategory: (placeId: string) => void;
  /** The user corrects the type with one tap — their word replaces the AI's. */
  correctCategory: (
    placeId: string,
    category: AiCategoryId,
    shopType?: string,
  ) => void;
  /** Re-check the ones the AI was not sure about (clears only `unsure` attempts). */
  retryUnsure: () => void;
  clearAll: (storage?: StorageLike | null) => void;
}

export const useAiIndexStore = create<AiIndexStoreState>()((set, get) => ({
  categories: {},
  job: { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] },
  loaded: false,
  load: (storage = browserStorage()) => {
    activeStorage = storage;
    set({
      categories: loadAiCategories(storage),
      job: loadIndexJob(storage),
      loaded: true,
    });
  },
  applyResults: (results, model = CATEGORISATION_MODEL) => {
    const now = new Date().toISOString();
    const categories = { ...get().categories };
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
      };
    }
    set({ categories });
    saveAiCategories(categories, activeStorage);
  },
  markAttempted: (placeIds) => {
    const attempted = new Set(get().job.attemptedPlaceIds);
    for (const id of placeIds) attempted.add(id);
    const job: IndexJobState = {
      ...get().job,
      attemptedPlaceIds: [...attempted],
      updatedAt: new Date().toISOString(),
    };
    set({ job });
    saveIndexJob(job, activeStorage);
  },
  setJob: (patch) => {
    const job: IndexJobState = {
      ...get().job,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    set({ job });
    saveIndexJob(job, activeStorage);
  },
  confirmCategory: (placeId) => {
    const record = get().categories[placeId];
    if (!record || record.status === "unsure") return;
    const categories = {
      ...get().categories,
      [placeId]: { ...record, status: "confirmed" as const },
    };
    set({ categories });
    saveAiCategories(categories, activeStorage);
  },
  correctCategory: (placeId, category, shopType) => {
    const record = get().categories[placeId];
    if (!record) return;
    const categories = {
      ...get().categories,
      [placeId]: {
        ...record,
        status: "corrected" as const,
        userCategory: category,
        userShopType: category === "shop" ? shopType : undefined,
      },
    };
    set({ categories });
    saveAiCategories(categories, activeStorage);
  },
  retryUnsure: () => {
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
    set({ job });
    saveIndexJob(job, activeStorage);
  },
  clearAll: (storage = activeStorage) => {
    set({ categories: {}, job: { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] } });
    try {
      storage?.removeItem?.(AI_CATEGORIES_STORAGE_KEY);
      storage?.removeItem?.(AI_INDEX_JOB_STORAGE_KEY);
    } catch {
      // Ignore — the in-memory state is already cleared.
    }
  },
}));

/** Counts for the progress line: X of N indexed, Y still to go. */
export function indexJobCounts(
  categories: Record<string, AiCategoryRecord>,
  job: IndexJobState,
  totalUnnamed: number,
): {
  attempted: number;
  categorised: number;
  unsure: number;
  remaining: number;
} {
  const attempted = job.attemptedPlaceIds.length;
  let categorised = 0;
  let unsure = 0;
  for (const record of Object.values(categories)) {
    if (record.status === "unsure") unsure++;
    else if (record.confidence >= MIN_AI_CONFIDENCE) categorised++;
  }
  return {
    attempted,
    categorised,
    unsure,
    remaining: Math.max(0, totalUnnamed - attempted),
  };
}
