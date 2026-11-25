import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AI_CATEGORIES_STORAGE_KEY,
  AI_INDEX_JOB_STORAGE_KEY,
  EMPTY_INDEX_JOB,
  type IndexJobState,
} from "../../src/features/categorise/storage";
import type { AiCategoryRecord } from "../../src/features/categorise/categories";
import {
  aiIndexDb,
  AiIndexDatabase,
  clearAiIndex,
  loadAiIndex,
  mergeImportedAiIndex,
  migrateAiIndexFromLocalStorage,
  replaceAiIndexDatabase,
  saveAiBatch,
  saveAiCategory,
  saveAiJob,
} from "../../src/db/ai-index";
import { importAtlasBackup } from "../../src/db/backup-import";
import {
  AtlasDatabase,
  atlasRepository,
  replaceAtlasRepository,
} from "../../src/db/repository";
import { useAiIndexStore } from "../../src/features/categorise/store";
import type { Backup } from "../../src/domain/types";

const time = "2026-11-25T10:00:00.000Z";

function record(
  overrides: Partial<AiCategoryRecord> & Pick<AiCategoryRecord, "placeId">,
): AiCategoryRecord {
  return {
    aiCategory: "house",
    confidence: 0.9,
    reason: "Test record.",
    model: "gpt-4o-mini",
    indexedAt: time,
    status: "suggested",
    source: "ai",
    ...overrides,
  };
}

function job(overrides: Partial<IndexJobState> = {}): IndexJobState {
  return {
    status: "idle",
    attemptedPlaceIds: [],
    resolverVersion: 3,
    updatedAt: time,
    ...overrides,
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

function backupWithAi(): Backup {
  return {
    format: "leonida-atlas",
    version: 3,
    exportedAt: time,
    favorites: [],
    notes: [],
    collections: [],
    markers: [],
    placeTags: [],
    explored: [],
    visited: [],
    preferences: {
      reducedMotion: false,
      showLabels: true,
      clusterMarkers: true,
    },
    aiCategories: [record({ placeId: "L9", aiCategory: "shop" })],
    aiIndexJob: job({ status: "done", attemptedPlaceIds: ["L9"] }),
  };
}

let aiDb: AiIndexDatabase;
let userDb: AtlasDatabase;
const originalAiDb = aiIndexDb;
const originalRepository = atlasRepository;

beforeEach(() => {
  aiDb = new AiIndexDatabase(`ai-test-${crypto.randomUUID()}`);
  replaceAiIndexDatabase(aiDb);
  userDb = new AtlasDatabase(`atlas-test-${crypto.randomUUID()}`);
  replaceAtlasRepository(userDb);
  useAiIndexStore.setState({
    categories: {},
    job: { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [] },
    loaded: false,
    storageError: null,
    requeuedUnsure: 0,
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  replaceAiIndexDatabase(originalAiDb);
  replaceAtlasRepository(originalRepository);
  await aiDb.delete().catch(() => undefined);
  await userDb.delete().catch(() => undefined);
});

describe("AI index in transactional IndexedDB — migration (v0.30.0)", () => {
  it("moves old localStorage data into IndexedDB, verified, and only then may the keys go", async () => {
    const storage = memoryStorage({
      [AI_CATEGORIES_STORAGE_KEY]: JSON.stringify({
        L1: record({ placeId: "L1" }),
        L2: record({ placeId: "L2", aiCategory: "gym" }),
      }),
      [AI_INDEX_JOB_STORAGE_KEY]: JSON.stringify(
        job({ status: "paused", attemptedPlaceIds: ["L1", "L2"] }),
      ),
    });
    // Before the migration the old keys — and the data — are there.
    expect(storage.getItem(AI_CATEGORIES_STORAGE_KEY)).not.toBeNull();
    const migrated = await migrateAiIndexFromLocalStorage(storage, aiDb);
    expect(migrated).toEqual({
      migratedAt: expect.any(String),
      categories: 2,
      attempted: 2,
      source: "localStorage-v1",
    });
    // The migration verified by read-back inside its transaction.
    const snapshot = await loadAiIndex(aiDb);
    expect(snapshot.migrated).toBe(true);
    expect(Object.keys(snapshot.categories)).toEqual(["L1", "L2"]);
    expect(snapshot.categories["L2"]?.aiCategory).toBe("gym");
    expect(snapshot.job.status).toBe("paused");
    expect(snapshot.job.attemptedPlaceIds).toEqual(["L1", "L2"]);
    // Only NOW may the caller remove the old keys — the store does
    // this after the migration resolves, never before.
    storage.removeItem(AI_CATEGORIES_STORAGE_KEY);
    storage.removeItem(AI_INDEX_JOB_STORAGE_KEY);
    expect(storage.getItem(AI_CATEGORIES_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(AI_INDEX_JOB_STORAGE_KEY)).toBeNull();
    // And the data survives the removal — it lives in the database now.
    expect((await loadAiIndex(aiDb)).categories["L1"]).toBeDefined();
  });

  it("the store migrates once on load and removes the old keys only after success", async () => {
    const storage = memoryStorage({
      [AI_CATEGORIES_STORAGE_KEY]: JSON.stringify({
        L1: record({ placeId: "L1" }),
      }),
      [AI_INDEX_JOB_STORAGE_KEY]: JSON.stringify(
        job({ status: "done", attemptedPlaceIds: ["L1"] }),
      ),
    });
    vi.stubGlobal("window", { localStorage: storage });
    const loaded = await useAiIndexStore.getState().load();
    expect(loaded).toBe(true);
    expect(useAiIndexStore.getState().categories["L1"]).toBeDefined();
    expect(useAiIndexStore.getState().job.status).toBe("done");
    expect(storage.getItem(AI_CATEGORIES_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(AI_INDEX_JOB_STORAGE_KEY)).toBeNull();
    // A second load does not re-migrate or lose anything.
    const again = await useAiIndexStore.getState().load();
    expect(again).toBe(true);
    expect(useAiIndexStore.getState().categories["L1"]).toBeDefined();
    expect((await loadAiIndex(aiDb)).migrated).toBe(true);
  });

  it("a failed migration leaves the old data untouched and fails loudly", async () => {
    const storage = memoryStorage({
      [AI_CATEGORIES_STORAGE_KEY]: JSON.stringify({
        L1: record({ placeId: "L1" }),
      }),
      [AI_INDEX_JOB_STORAGE_KEY]: JSON.stringify(
        job({ status: "paused", attemptedPlaceIds: ["L1"] }),
      ),
    });
    const dead = new AiIndexDatabase(`ai-test-${crypto.randomUUID()}`);
    await dead.delete();
    await expect(
      migrateAiIndexFromLocalStorage(storage, dead),
    ).rejects.toThrow();
    // Nothing was written, nothing was removed: the old data is
    // exactly where it was, and the store reports the failure
    // instead of silently falling back to the lossy store.
    expect(storage.getItem(AI_CATEGORIES_STORAGE_KEY)).not.toBeNull();
    expect(storage.getItem(AI_INDEX_JOB_STORAGE_KEY)).not.toBeNull();
    vi.stubGlobal("window", { localStorage: storage });
    replaceAiIndexDatabase(dead);
    const loaded = await useAiIndexStore.getState().load();
    expect(loaded).toBe(false);
    expect(useAiIndexStore.getState().storageError).toBeTruthy();
    expect(storage.getItem(AI_CATEGORIES_STORAGE_KEY)).not.toBeNull();
    expect(useAiIndexStore.getState().categories).toEqual({});
  });

  it("marks the migration done with zero records when there is nothing to move", async () => {
    vi.stubGlobal("window", { localStorage: memoryStorage() });
    expect(await useAiIndexStore.getState().load()).toBe(true);
    const snapshot = await loadAiIndex(aiDb);
    expect(snapshot.migrated).toBe(true);
    expect(snapshot.migration?.source).toBe("none");
    expect(snapshot.categories).toEqual({});
  });

  it("a record missing `model` is repaired with 'unknown' instead of aborting the migration (v0.30.1)", async () => {
    const storage = memoryStorage({
      [AI_CATEGORIES_STORAGE_KEY]: JSON.stringify({
        L1: record({ placeId: "L1" }),
        // L2 predates model tracking (or was hand-edited): no `model`.
        L2: {
          placeId: "L2",
          aiCategory: "gym",
          confidence: 0.9,
          reason: "Test record.",
          indexedAt: time,
          status: "suggested",
          source: "ai",
        },
        L3: record({ placeId: "L3", aiCategory: "shop" }),
      }),
      [AI_INDEX_JOB_STORAGE_KEY]: JSON.stringify(
        job({ status: "paused", attemptedPlaceIds: ["L1", "L2", "L3"] }),
      ),
    });
    const migrated = await migrateAiIndexFromLocalStorage(storage, aiDb);
    expect(migrated.categories).toBe(3);
    expect(migrated.skipped ?? 0).toBe(0);
    const snapshot = await loadAiIndex(aiDb);
    expect(Object.keys(snapshot.categories)).toEqual(["L1", "L2", "L3"]);
    // The repair is honest provenance: the record predates model
    // tracking, so it says so instead of claiming a model it never had.
    expect(snapshot.categories["L2"]?.model).toBe("unknown");
    expect(snapshot.categories["L2"]?.aiCategory).toBe("gym");
  });

  it("drifted records are skipped and counted instead of aborting the migration (v0.30.1)", async () => {
    const storage = memoryStorage({
      [AI_CATEGORIES_STORAGE_KEY]: JSON.stringify({
        L1: record({ placeId: "L1" }),
        L2: record({ placeId: "L2", indexedAt: "not-a-date" }),
        L3: record({ placeId: "L3", reason: "x".repeat(1001) }),
        L4: record({ placeId: "L4", shopType: "y".repeat(61) }),
        L5: record({ placeId: "L5", confidence: 1.5 }),
      }),
      [AI_INDEX_JOB_STORAGE_KEY]: JSON.stringify(
        job({
          status: "paused",
          attemptedPlaceIds: ["L1", "L2", "L3", "L4", "L5"],
        }),
      ),
    });
    const migrated = await migrateAiIndexFromLocalStorage(storage, aiDb);
    expect(migrated.categories).toBe(1);
    expect(migrated.skipped).toBe(4);
    const snapshot = await loadAiIndex(aiDb);
    expect(Object.keys(snapshot.categories)).toEqual(["L1"]);
    expect(snapshot.migration?.source).toBe("localStorage-v1");
  });
});

describe("AI index in transactional IndexedDB — atomic batches and save truth (v0.30.0)", () => {
  it("a batch's results and its attempted marking commit together", async () => {
    const result = await saveAiBatch(
      [record({ placeId: "L1" }), record({ placeId: "L2", aiCategory: "gym" })],
      ["L1", "L2"],
      {},
      aiDb,
    );
    expect(result).toEqual({ categories: 2, attempted: 2 });
    const snapshot = await loadAiIndex(aiDb);
    expect(Object.keys(snapshot.categories)).toEqual(["L1", "L2"]);
    expect(snapshot.job.attemptedPlaceIds).toEqual(["L1", "L2"]);
  });

  it("a batch that cannot be written writes nothing — no place is ever attempted without a type", async () => {
    await saveAiBatch([record({ placeId: "L1" })], ["L1"], {}, aiDb);
    // An invalid record fails validation before any write, so the
    // attempted marking for its batch never lands either.
    await expect(
      saveAiBatch(
        [record({ placeId: "L2", confidence: 1.5 })],
        ["L2"],
        {},
        aiDb,
      ),
    ).rejects.toThrow();
    const snapshot = await loadAiIndex(aiDb);
    expect(Object.keys(snapshot.categories)).toEqual(["L1"]);
    expect(snapshot.job.attemptedPlaceIds).toEqual(["L1"]);
    expect(snapshot.job.attemptedPlaceIds).not.toContain("L2");
  });

  it("a failed write is reported as failed, not saved — in-memory state never shows unsaved work", async () => {
    const dead = new AiIndexDatabase(`ai-test-${crypto.randomUUID()}`);
    await dead.delete();
    replaceAiIndexDatabase(dead);
    const store = useAiIndexStore.getState();
    const saved = await store.applyBatch(
      [
        {
          placeId: "L1",
          category: "house",
          confidence: 0.9,
          reason: "Test batch.",
        },
      ],
      ["L1"],
      "gpt-4o-mini",
    );
    expect(saved).toBe(false);
    expect(useAiIndexStore.getState().storageError).toBeTruthy();
    expect(useAiIndexStore.getState().categories).toEqual({});
    expect(useAiIndexStore.getState().job.attemptedPlaceIds).toEqual([]);
    expect(await store.setJob({ status: "running" })).toBe(false);
    expect(await store.confirmCategory("L1")).toBe(true); // nothing to confirm
  });

  it("a single confirm/correct write verifies by read-back", async () => {
    await saveAiCategory(record({ placeId: "L1" }), aiDb);
    expect((await loadAiIndex(aiDb)).categories["L1"]?.status).toBe(
      "suggested",
    );
    await saveAiJob({ status: "running" }, aiDb);
    expect((await loadAiIndex(aiDb)).job.status).toBe("running");
  });

  it("clearAll empties the index and verifies it is empty", async () => {
    await saveAiBatch([record({ placeId: "L1" })], ["L1"], {}, aiDb);
    await clearAiIndex(aiDb);
    const snapshot = await loadAiIndex(aiDb);
    expect(snapshot.categories).toEqual({});
    expect(snapshot.job.status).toBe("idle");
    expect(snapshot.job.attemptedPlaceIds).toEqual([]);
  });
});

describe("AI index — backup import (v0.30.0)", () => {
  it("merges a restored index with the local one, corrections winning", async () => {
    await saveAiBatch(
      [record({ placeId: "L1", status: "corrected", userCategory: "shop" })],
      ["L1"],
      { status: "running" },
      aiDb,
    );
    const stats = await mergeImportedAiIndex(
      [
        record({ placeId: "L1", aiCategory: "gym", indexedAt: "2026-11-26T00:00:00.000Z" }),
        record({ placeId: "L2", aiCategory: "shop" }),
      ],
      job({ status: "done", attemptedPlaceIds: ["L1", "L2"] }),
      aiDb,
    );
    expect(stats.added).toBe(1);
    expect(stats.keptLocal).toBe(1);
    const snapshot = await loadAiIndex(aiDb);
    expect(snapshot.categories["L1"]?.status).toBe("corrected");
    expect(snapshot.categories["L2"]).toBeDefined();
    // The merge keeps the live job's status, so a restore never
    // pauses or stops a run in progress.
    expect(snapshot.job.status).toBe("running");
    expect(snapshot.job.attemptedPlaceIds).toEqual(["L1", "L2"]);
  });

  it("a user-data import failure rolls the AI half back — existing data untouched", async () => {
    await saveAiBatch(
      [record({ placeId: "L1" })],
      ["L1"],
      { status: "paused" },
      aiDb,
    );
    class FailingAtlasDatabase extends AtlasDatabase {
      override async importBackup(): Promise<void> {
        throw new Error("simulated import failure");
      }
    }
    const failing = new FailingAtlasDatabase(
      `atlas-test-${crypto.randomUUID()}`,
    );
    replaceAtlasRepository(failing);
    await expect(importAtlasBackup(backupWithAi())).rejects.toThrow(
      /simulated import failure/,
    );
    // The AI half was rolled back to its pre-import snapshot.
    const snapshot = await loadAiIndex(aiDb);
    expect(Object.keys(snapshot.categories)).toEqual(["L1"]);
    expect(snapshot.categories["L9"]).toBeUndefined();
    expect(snapshot.job.status).toBe("paused");
    expect(snapshot.job.attemptedPlaceIds).toEqual(["L1"]);
    await failing.delete().catch(() => undefined);
  });

  it("a successful import lands both halves and the store reloads from the database", async () => {
    const imported = await importAtlasBackup(backupWithAi());
    expect(imported.added).toBe(1);
    expect(imported.addedAttempted).toBe(1);
    const snapshot = await loadAiIndex(aiDb);
    expect(snapshot.categories["L9"]?.aiCategory).toBe("shop");
    expect(snapshot.job.attemptedPlaceIds).toEqual(["L9"]);
    // The user-data half landed too (importBackup ran, not just the AI half).
    expect((await userDb.load()).favorites).toEqual([]);
    await useAiIndexStore.getState().load();
    expect(useAiIndexStore.getState().categories["L9"]).toBeDefined();
  });
});
