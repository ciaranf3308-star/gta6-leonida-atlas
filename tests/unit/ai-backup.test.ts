import { describe, expect, it } from "vitest";
import { parseAiIndexJob, parseBackup } from "../../src/db/backup";
import { mergeAiCategories, mergeIndexJob } from "../../src/features/backup/ai-merge";
import {
  backupFileName,
  shouldShowBackupNudge,
} from "../../src/features/backup/atlas-backup";
import { useAiIndexStore } from "../../src/features/categorise/store";
import {
  EMPTY_INDEX_JOB,
  type IndexJobState,
  type StorageLike,
} from "../../src/features/categorise/storage";
import type { AiCategoryRecord } from "../../src/features/categorise/categories";

const time = "2026-11-24T12:00:00.000Z";

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

function record(
  placeId: string,
  overrides: Partial<AiCategoryRecord> = {},
): AiCategoryRecord {
  return {
    placeId,
    aiCategory: "house",
    confidence: 0.9,
    reason: "Test record.",
    model: "test",
    indexedAt: time,
    status: "suggested",
    source: "ai",
    ...overrides,
  };
}

function job(overrides: Partial<IndexJobState> = {}): IndexJobState {
  return {
    ...EMPTY_INDEX_JOB,
    attemptedPlaceIds: [],
    updatedAt: time,
    ...overrides,
  };
}

const baseBackup = () => ({
  format: "leonida-atlas",
  version: 3,
  exportedAt: time,
  favorites: [],
  notes: [],
  collections: [],
  markers: [],
  visited: [],
  preferences: { reducedMotion: false, showLabels: true, clusterMarkers: true },
  aiCategories: [record("L1"), record("L2", { status: "unsure", confidence: 0.4 })],
  aiIndexJob: job({ status: "done", attemptedPlaceIds: ["L1", "L2"] }),
});

describe("AI index in the backup file", () => {
  it("round-trips AI categories and job state in a v3 backup", () => {
    const result = parseBackup(baseBackup());
    expect(result.version).toBe(3);
    expect(result.aiCategories).toHaveLength(2);
    expect(result.aiCategories[0]).toMatchObject({
      placeId: "L1",
      aiCategory: "house",
      status: "suggested",
    });
    expect(result.aiIndexJob).toMatchObject({
      status: "done",
      attemptedPlaceIds: ["L1", "L2"],
    });
  });

  it("accepts a v2 backup with an empty AI index", () => {
    const { aiCategories, aiIndexJob, ...v2 } = baseBackup();
    void aiCategories;
    void aiIndexJob;
    const result = parseBackup({ ...v2, version: 2 });
    expect(result.version).toBe(3);
    expect(result.aiCategories).toEqual([]);
    expect(result.aiIndexJob.attemptedPlaceIds).toEqual([]);
  });

  it("rejects version 4 and a bad AI record", () => {
    expect(() => parseBackup({ ...baseBackup(), version: 4 })).toThrow(/version/i);
    expect(() =>
      parseBackup({
        ...baseBackup(),
        aiCategories: [record("L1", { aiCategory: "not-a-type" as never })],
      }),
    ).toThrow(/aiCategory/i);
    expect(() =>
      parseBackup({
        ...baseBackup(),
        aiCategories: [record("L1", { confidence: 1.5 })],
      }),
    ).toThrow(/confidence/i);
  });

  it("never carries an API key — unknown keys are dropped", () => {
    const result = parseBackup({
      ...baseBackup(),
      apiKey: "sk-test-secret",
      openAiKey: "sk-test-secret",
    });
    expect(result).not.toHaveProperty("apiKey");
    expect(result).not.toHaveProperty("openAiKey");
    expect(JSON.stringify(result)).not.toContain("sk-test-secret");
  });

  it("reads an interrupted 'running' job as paused, never running", () => {
    const parsed = parseAiIndexJob({
      status: "running",
      attemptedPlaceIds: ["L1"],
      resolverVersion: 3,
      updatedAt: time,
    });
    expect(parsed.status).toBe("paused");
    expect(parsed.attemptedPlaceIds).toEqual(["L1"]);
  });

  it("names the backup file by date", () => {
    expect(backupFileName(new Date("2026-11-24T17:01:00.000Z"))).toBe(
      "leonida-atlas-backup-2026-11-24.json",
    );
  });
});

describe("merging a restored AI index", () => {
  it("a user correction wins over everything, confirmed beats suggested", () => {
    const local = {
      L1: record("L1", { status: "corrected", userCategory: "shop" }),
      L2: record("L2", { status: "confirmed" }),
      L3: record("L3", { status: "suggested" }),
    };
    const { merged, added, updated, keptLocal } = mergeAiCategories(local, [
      record("L1", { status: "suggested", aiCategory: "house", indexedAt: "2026-11-25T00:00:00.000Z" }),
      record("L2", { status: "suggested", indexedAt: "2026-11-25T00:00:00.000Z" }),
      record("L3", { status: "confirmed", indexedAt: "2026-11-25T00:00:00.000Z" }),
      record("L4", { status: "suggested" }),
    ]);
    expect(merged["L1"]?.status).toBe("corrected");
    expect(merged["L1"]?.userCategory).toBe("shop");
    expect(merged["L2"]?.status).toBe("confirmed");
    expect(merged["L3"]?.status).toBe("confirmed");
    expect(merged["L4"]?.status).toBe("suggested");
    expect(added).toBe(1);
    expect(updated).toBe(1);
    expect(keptLocal).toBe(2);
  });

  it("'not sure' never overwrites a type, and a newer correction is never overwritten by an older backup", () => {
    const local = {
      L1: record("L1", { status: "suggested" }),
      L2: record("L2", {
        status: "corrected",
        userCategory: "petrol",
        indexedAt: "2026-11-24T12:00:00.000Z",
      }),
    };
    const { merged } = mergeAiCategories(local, [
      record("L1", { status: "unsure", confidence: 0.2, indexedAt: "2026-11-25T00:00:00.000Z" }),
      record("L2", {
        status: "corrected",
        userCategory: "house",
        indexedAt: "2026-11-20T00:00:00.000Z",
      }),
    ]);
    expect(merged["L1"]?.status).toBe("suggested");
    expect(merged["L2"]?.userCategory).toBe("petrol");
  });

  it("within the same rank the newer record wins, a tie keeps the local one", () => {
    const local = { L1: record("L1", { indexedAt: "2026-11-24T12:00:00.000Z" }) };
    const newer = mergeAiCategories(local, [
      record("L1", { aiCategory: "shop", indexedAt: "2026-11-25T00:00:00.000Z" }),
    ]);
    expect(newer.merged["L1"]?.aiCategory).toBe("shop");
    const tied = mergeAiCategories(local, [
      record("L1", { aiCategory: "shop", indexedAt: "2026-11-24T12:00:00.000Z" }),
    ]);
    expect(tied.merged["L1"]?.aiCategory).toBe("house");
  });

  it("merges job progress as a union and keeps the local job status", () => {
    const local = job({ status: "running", attemptedPlaceIds: ["L1", "L2"], resolverVersion: 3 });
    const { job: merged, addedAttempted } = mergeIndexJob(
      local,
      job({ status: "done", attemptedPlaceIds: ["L2", "L3"], resolverVersion: 2 }),
    );
    expect(merged.status).toBe("running");
    expect(merged.attemptedPlaceIds).toEqual(["L1", "L2", "L3"]);
    expect(merged.resolverVersion).toBe(3);
    expect(addedAttempted).toBe(1);
  });

  it("restores into the store and persists it, without touching a running job's status", () => {
    const storage = memoryStorage({
      "leonida-ai-categories-v1": JSON.stringify({
        L1: record("L1", { status: "corrected", userCategory: "shop" }),
      }),
      "leonida-ai-index-job-v1": JSON.stringify(
        job({ status: "running", attemptedPlaceIds: ["L1"] }),
      ),
    });
    useAiIndexStore.getState().load(storage);
    // A reloaded "running" job reads as paused (it was interrupted);
    // put it back to running the way the live runner does, then merge.
    useAiIndexStore.getState().setJob({ status: "running" });
    const result = useAiIndexStore
      .getState()
      .mergeImportedAi(
        [record("L2", { status: "suggested" })],
        job({ status: "done", attemptedPlaceIds: ["L1", "L2"] }),
      );
    const state = useAiIndexStore.getState();
    expect(state.categories["L1"]?.status).toBe("corrected");
    expect(state.categories["L2"]?.status).toBe("suggested");
    expect(state.job.status).toBe("running");
    expect(state.job.attemptedPlaceIds).toEqual(["L1", "L2"]);
    expect(result.added).toBe(1);
    expect(result.addedAttempted).toBe(1);
    const persisted = JSON.parse(
      storage.getItem("leonida-ai-categories-v1") ?? "{}",
    ) as Record<string, AiCategoryRecord>;
    expect(persisted["L2"]?.status).toBe("suggested");
  });
});

describe("the 'Backed up yet?' nudge", () => {
  it("fires for a finished run never backed up, and every 100 newly sorted places", () => {
    expect(
      shouldShowBackupNudge({ categorised: 50, done: true, lastBackup: null, dismissedUntilCount: 0 }),
    ).toBe(true);
    expect(
      shouldShowBackupNudge({ categorised: 50, done: false, lastBackup: null, dismissedUntilCount: 0 }),
    ).toBe(false);
    expect(
      shouldShowBackupNudge({
        categorised: 250,
        done: false,
        lastBackup: { exportedAt: time, aiCategories: 100 },
        dismissedUntilCount: 0,
      }),
    ).toBe(true);
    expect(
      shouldShowBackupNudge({
        categorised: 199,
        done: false,
        lastBackup: { exportedAt: time, aiCategories: 100 },
        dismissedUntilCount: 0,
      }),
    ).toBe(false);
  });

  it("stays quiet after 'Not now' until 100 more places are sorted", () => {
    expect(
      shouldShowBackupNudge({
        categorised: 250,
        done: false,
        lastBackup: { exportedAt: time, aiCategories: 100 },
        dismissedUntilCount: 200,
      }),
    ).toBe(false);
    expect(
      shouldShowBackupNudge({
        categorised: 300,
        done: false,
        lastBackup: { exportedAt: time, aiCategories: 100 },
        dismissedUntilCount: 200,
      }),
    ).toBe(true);
  });

  it("never fires with nothing sorted", () => {
    expect(
      shouldShowBackupNudge({ categorised: 0, done: true, lastBackup: null, dismissedUntilCount: 0 }),
    ).toBe(false);
  });
});
