import {
  AI_CATEGORIES,
  type AiCategoryId,
  type AiCategoryRecord,
  type AiCategoryStatus,
} from "./categories";

/**
 * On-device storage for AI categories and the index job.
 *
 * localStorage, versioned keys, next to the Ask key
 * (`leonida-ask-api-key`) — never IndexedDB backups, never committed,
 * never sent anywhere except api.openai.com. A record is only ever
 * loaded if it parses and its category is in the fixed set; anything
 * else is dropped, so a corrupt or hand-edited value can never surface
 * as a made-up type.
 */

export const AI_CATEGORIES_STORAGE_KEY = "leonida-ai-categories-v1";
export const AI_INDEX_JOB_STORAGE_KEY = "leonida-ai-index-job-v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export function browserStorage(): StorageLike | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

export type IndexJobStatus = "idle" | "running" | "paused" | "done" | "error";

export interface IndexJobState {
  status: IndexJobStatus;
  /** Ids already sent to the AI (categorised + not-sure alike). The job
   * resumes by skipping these — a batch is only ever marked attempted
   * after its results are saved. */
  attemptedPlaceIds: string[];
  updatedAt: string;
  error?: string;
}

export const EMPTY_INDEX_JOB: IndexJobState = {
  status: "idle",
  attemptedPlaceIds: [],
  updatedAt: new Date(0).toISOString(),
};

function isValidRecord(value: unknown): value is AiCategoryRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if (typeof record.placeId !== "string" || !record.placeId) return false;
  if (
    typeof record.aiCategory !== "string" ||
    !(AI_CATEGORIES as readonly string[]).includes(record.aiCategory)
  )
    return false;
  if (
    typeof record.confidence !== "number" ||
    !Number.isFinite(record.confidence) ||
    record.confidence < 0 ||
    record.confidence > 1
  )
    return false;
  if (
    typeof record.status !== "string" ||
    !["suggested", "unsure", "confirmed", "corrected"].includes(record.status)
  )
    return false;
  if (typeof record.reason !== "string" || typeof record.indexedAt !== "string")
    return false;
  if (
    record.userCategory !== undefined &&
    (typeof record.userCategory !== "string" ||
      !(AI_CATEGORIES as readonly string[]).includes(record.userCategory))
  )
    return false;
  if (
    record.source !== undefined &&
    (typeof record.source !== "string" ||
      !["coordinate", "tag", "guide", "analogue", "ai"].includes(record.source))
  )
    return false;
  if (
    record.matchedFrom !== undefined &&
    typeof record.matchedFrom !== "string"
  )
    return false;
  return true;
}

export function parseAiCategories(
  raw: string | null,
): Record<string, AiCategoryRecord> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const out: Record<string, AiCategoryRecord> = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!isValidRecord(value)) continue;
      const record = value as AiCategoryRecord;
      // The map key is the place id; a record that disagrees is dropped.
      if (record.placeId !== key) continue;
      out[key] = {
        ...record,
        aiCategory: record.aiCategory as AiCategoryId,
        status: record.status as AiCategoryStatus,
      };
    }
    return out;
  } catch {
    return {};
  }
}

export function loadAiCategories(
  storage: StorageLike | null = browserStorage(),
): Record<string, AiCategoryRecord> {
  try {
    return parseAiCategories(
      storage?.getItem(AI_CATEGORIES_STORAGE_KEY) ?? null,
    );
  } catch {
    return {};
  }
}

export function saveAiCategories(
  categories: Record<string, AiCategoryRecord>,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(AI_CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // Storage full or unavailable — the in-memory results still show
    // this session; the job reports it cannot save.
  }
}

export function parseIndexJob(raw: string | null): IndexJobState {
  if (!raw) return { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object")
      return { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] };
    const job = parsed as Partial<IndexJobState>;
    const status = job.status;
    return {
      status:
        status === "running"
          ? "paused" // A running job that reloaded was interrupted — resume, don't claim it is still going.
          : status === "paused" ||
              status === "done" ||
              status === "error" ||
              status === "idle"
            ? status
            : "idle",
      attemptedPlaceIds: Array.isArray(job.attemptedPlaceIds)
        ? job.attemptedPlaceIds.filter(
            (id): id is string => typeof id === "string",
          )
        : [],
      updatedAt:
        typeof job.updatedAt === "string"
          ? job.updatedAt
          : new Date(0).toISOString(),
      error: typeof job.error === "string" ? job.error : undefined,
    };
  } catch {
    return { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] };
  }
}

export function loadIndexJob(
  storage: StorageLike | null = browserStorage(),
): IndexJobState {
  try {
    return parseIndexJob(storage?.getItem(AI_INDEX_JOB_STORAGE_KEY) ?? null);
  } catch {
    return { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] };
  }
}

export function saveIndexJob(
  job: IndexJobState,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(AI_INDEX_JOB_STORAGE_KEY, JSON.stringify(job));
  } catch {
    // See saveAiCategories — the job state still shows this session.
  }
}
