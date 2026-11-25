import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueFromSnapshot } from "../../src/data/catalogue";
import { resolvePlaceDeterministically } from "../../src/features/categorise/resolver";
import { runIndexJob } from "../../src/features/categorise/runner";
import { useAiIndexStore, indexJobCounts } from "../../src/features/categorise/store";
import {
  RESOLVER_VERSION,
  migrateIndexJobForResolver,
  type IndexJobState,
  type StorageLike,
} from "../../src/features/categorise/storage";
import type { AiCategoryRecord } from "../../src/features/categorise/categories";
import {
  areaIsolation,
  areaOptions,
  countyIsolation,
  matchesArea,
} from "../../src/features/map/isolation";
import { COUNTIES } from "../../src/data/counties";

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

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../public/assets/street-leonida/maps/gtadb-landmarks-d406fea.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

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
    indexedAt: new Date().toISOString(),
    status: "suggested",
    source: "ai",
    ...overrides,
  };
}

function job(overrides: Partial<IndexJobState> = {}): IndexJobState {
  return {
    status: "idle",
    attemptedPlaceIds: [],
    resolverVersion: RESOLVER_VERSION,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("v0.14.0 — not-sure places are re-queued on a new resolver version", () => {
  it("a place marked not-sure under v1 is re-queued under the new version", () => {
    const categories = {
      L939: record("L939", { confidence: 0.4, status: "unsure" }),
      L4: record("L4", { confidence: 0.95, status: "suggested", source: "tag" }),
    };
    const oldJob = job({
      status: "done",
      resolverVersion: 1,
      attemptedPlaceIds: ["L939", "L4"],
    });
    const { job: migrated, requeued } = migrateIndexJobForResolver(
      oldJob,
      categories,
    );
    // The not-sure place is un-attempted again; the confident one stays.
    expect(requeued).toBe(1);
    expect(migrated.attemptedPlaceIds).toEqual(["L4"]);
    expect(migrated.resolverVersion).toBe(RESOLVER_VERSION);
    // A finished job goes back to idle so it can actually run again.
    expect(migrated.status).toBe("idle");
  });

  it("a job with no version field (v2 era) re-queues its not-sure places too", () => {
    const categories = {
      L939: record("L939", { confidence: 0.3, status: "unsure" }),
    };
    const { requeued } = migrateIndexJobForResolver(
      {
        status: "done",
        attemptedPlaceIds: ["L939"],
        updatedAt: new Date().toISOString(),
      },
      categories,
    );
    expect(requeued).toBe(1);
  });

  it("a job already on the current version is untouched", () => {
    const categories = {
      L939: record("L939", { confidence: 0.4, status: "unsure" }),
    };
    const current = job({
      status: "done",
      attemptedPlaceIds: ["L939"],
    });
    const { job: migrated, requeued } = migrateIndexJobForResolver(
      current,
      categories,
    );
    expect(requeued).toBe(0);
    expect(migrated).toBe(current);
  });

  it("the store load migrates a stored v1 job and reports the re-queue count", () => {
    const categories = {
      L939: record("L939", { confidence: 0.4, status: "unsure" }),
      L4: record("L4", { confidence: 0.95, status: "suggested", source: "tag" }),
    };
    const storage = memoryStorage({
      "leonida-ai-categories-v1": JSON.stringify(categories),
      "leonida-ai-index-job-v1": JSON.stringify({
        status: "done",
        attemptedPlaceIds: ["L939", "L4"],
        resolverVersion: 1,
        updatedAt: new Date().toISOString(),
      }),
    });
    const store = useAiIndexStore.getState();
    store.load(storage);
    const afterFirstLoad = useAiIndexStore.getState();
    expect(afterFirstLoad.requeuedUnsure).toBe(1);
    expect(afterFirstLoad.job.attemptedPlaceIds).toEqual(["L4"]);
    expect(afterFirstLoad.job.resolverVersion).toBe(RESOLVER_VERSION);
    // The migration is saved, so a second load does not re-queue again.
    afterFirstLoad.load(storage);
    expect(useAiIndexStore.getState().requeuedUnsure).toBe(0);
    useAiIndexStore.getState().clearAll(storage);
  });

  it("the runner never marks a not-sure place attempted", async () => {
    const storage = memoryStorage();
    useAiIndexStore.getState().load(storage);
    const places = catalogueFromSnapshot(snapshot);
    // L939 is a real "?" no deterministic step can resolve — the LLM's
    // job, and only the LLM's.
    const unknown = places.find((p) => p.id === "L939")!;
    expect(resolvePlaceDeterministically(unknown, places)).toBeNull();
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                results: [
                  {
                    id: "L939",
                    category: "house",
                    confidence: 0.4,
                    reason: "Not sure.",
                  },
                ],
              }),
            },
          },
        ],
      }),
    })) as unknown as typeof fetch;
    const outcome = await runIndexJob({
      places: [unknown],
      allPlaces: places,
      apiKey: "test-key",
      fetchImpl,
      shouldPause: () => false,
      shouldCancel: () => false,
      applyResults: (results, model) =>
        useAiIndexStore.getState().applyResults(results, model),
      applyBatch: (results, attemptedPlaceIds, model) =>
        useAiIndexStore.getState().applyBatch(results, attemptedPlaceIds, model),
      setJob: (patch) => useAiIndexStore.getState().setJob(patch),
      batchDelayMs: 0,
    });
    expect(outcome).toBe("done");
    // The low-confidence answer IS saved — as "not sure", never as a type.
    const saved = useAiIndexStore.getState().categories["L939"];
    expect(saved?.status).toBe("unsure");
    // …but the place is NOT attempted, so it stays in "To go" and the
    // next run re-scans it.
    expect(
      useAiIndexStore.getState().job.attemptedPlaceIds,
    ).not.toContain("L939");
    useAiIndexStore.getState().clearAll(storage);
  });

  it("counts: not-sure places stay in 'to go' but never block 'done'", () => {
    const categories = {
      L939: record("L939", { confidence: 0.4, status: "unsure" }),
      L4: record("L4", { confidence: 0.95, status: "suggested" }),
    };
    const counts = indexJobCounts(
      categories,
      job({ attemptedPlaceIds: ["L4"] }),
      10,
    );
    expect(counts.attempted).toBe(1);
    expect(counts.unsure).toBe(1);
    expect(counts.remaining).toBe(9); // the not-sure place is still to go
    expect(counts.pending).toBe(8); // …but only 8 were never run at all
  });
});

describe("v0.14.0 — county / area isolation", () => {
  it("a county isolates to its estimated bounds, named", () => {
    const county = COUNTIES.find((c) => c.id === "vice-dale")!;
    const iso = countyIsolation(county);
    expect(iso.label).toBe("Vice-Dale County");
    expect(iso.bounds).toEqual(county.bounds);
  });

  it("Capri isolates to the box around its own places", () => {
    const places = catalogueFromSnapshot(snapshot);
    const iso = areaIsolation("Capri", places);
    expect(iso).not.toBeNull();
    expect(iso!.label).toBe("Capri");
    const capri = places.filter((p) => p.region === "Capri" && p.position);
    expect(capri.length).toBeGreaterThan(100);
    for (const place of capri) {
      expect(place.position!.x).toBeGreaterThanOrEqual(iso!.bounds.west);
      expect(place.position!.x).toBeLessThanOrEqual(iso!.bounds.east);
      expect(place.position!.y).toBeGreaterThanOrEqual(iso!.bounds.south);
      expect(place.position!.y).toBeLessThanOrEqual(iso!.bounds.north);
    }
  });

  it("a Vice City neighbourhood belongs to the Vice City area", () => {
    const places = catalogueFromSnapshot(snapshot);
    const downtown = places.find((p) => p.region === "Downtown, Vice City")!;
    expect(downtown).toBeDefined();
    expect(matchesArea(downtown, "Vice City")).toBe(true);
    expect(matchesArea(downtown, "Capri")).toBe(false);
  });

  it("the area picker offers Capri, Port Gellhorn and Vice City", () => {
    const places = catalogueFromSnapshot(snapshot);
    const names = areaOptions(places).map((a) => a.name);
    expect(names).toContain("Capri");
    expect(names).toContain("Port Gellhorn");
    expect(names).toContain("Vice City");
    const capri = areaOptions(places).find((a) => a.name === "Capri")!;
    expect(capri.count).toBeGreaterThan(100);
  });

  it("an area with no positioned places isolates to nothing", () => {
    expect(areaIsolation("Nowhere", [])).toBeNull();
  });
});
