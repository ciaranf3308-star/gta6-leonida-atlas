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

/**
 * Resolver version (v0.14.0 = 3). The job's prompt/resolver changed in
 * v0.13.0 (v2: data first, LLM last) and again in v0.14.0 (v3: the
 * re-scan rule — see below). A stored job from an older version is
 * migrated on load, never silently trusted.
 *
 * THE RE-SCAN RULE (user, 2026-11-24): when the resolver/prompt is
 * updated, every place previously left "not sure" must be re-queued
 * and re-scanned with the new prompt — not left as attempted and
 * skipped forever. "Not sure" is NOT attempted: the job only ever
 * marks a place attempted once it has a confident type, so a "not
 * sure" answer stays in the "To go" count and the next run (or the
 * version migration) picks it up again.
 */
export const RESOLVER_VERSION = 3;
/** Jobs stored before the version field existed ran resolver v2. */
export const PRE_VERSION_RESOLVER_VERSION = 2;

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
  /** Ids with a confident type (categorised). "Not sure" places are
   * NEVER in here — a low-confidence answer is not an attempt that
   * counts, so the job re-runs those places until the data or a new
   * prompt resolves them. A batch is only ever marked attempted
   * after its confident results are saved. */
  attemptedPlaceIds: string[];
  /** The resolver version this job's attempts were made under. A job
   * from an older version has its "not sure" places re-queued on
   * load (see migrateIndexJobForResolver). */
  resolverVersion?: number;
  updatedAt: string;
  error?: string;
}

export const EMPTY_INDEX_JOB: IndexJobState = {
  status: "idle",
  attemptedPlaceIds: [],
  resolverVersion: RESOLVER_VERSION,
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
      resolverVersion:
        typeof job.resolverVersion === "number"
          ? job.resolverVersion
          : PRE_VERSION_RESOLVER_VERSION,
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

/**
 * Re-queue "not sure" places when the resolver is newer than the job.
 *
 * A job stored under an older resolver version had its "not sure"
 * places marked attempted, and the old job skipped them forever. On
 * a new resolver version those places are un-attempted again — they
 * go back into the "To go" count and the next run re-scans them with
 * the new prompt. Confident results are untouched: only "not sure"
 * (status "unsure") places are re-queued, and a job already done
 * under the old version goes back to idle so it can actually run.
 * A job already on the current version is returned unchanged.
 */
export function migrateIndexJobForResolver(
  job: IndexJobState,
  categories: Readonly<Record<string, AiCategoryRecord>>,
  currentVersion: number = RESOLVER_VERSION,
): { job: IndexJobState; requeued: number } {
  const storedVersion = job.resolverVersion ?? PRE_VERSION_RESOLVER_VERSION;
  if (storedVersion >= currentVersion) return { job, requeued: 0 };
  const unsure = new Set(
    Object.values(categories)
      .filter((record) => record.status === "unsure")
      .map((record) => record.placeId),
  );
  const attemptedPlaceIds = job.attemptedPlaceIds.filter(
    (id) => !unsure.has(id),
  );
  const requeued = job.attemptedPlaceIds.length - attemptedPlaceIds.length;
  return {
    job: {
      ...job,
      attemptedPlaceIds,
      resolverVersion: currentVersion,
      status: job.status === "done" ? "idle" : job.status,
      updatedAt: new Date().toISOString(),
    },
    requeued,
  };
}
