import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { catalogueFromSnapshot } from "../../src/data/catalogue";
import { unnamedTagAudit } from "../../src/domain/tags";
import { filterPlaces } from "../../src/domain/filter";
import { DEFAULT_FILTERS } from "../../src/stores/atlas";
import type { Place } from "../../src/domain/types";
import { DEFAULT_LAYERS } from "../../src/features/map/layers";
import { retrieveForAsk } from "../../src/features/ask/retrieval";
import {
  AI_CATEGORIES,
  aiCategoryMatchesLayer,
  aiCategorySearchWords,
  buildCategorisationSystemPrompt,
  buildPlaceContext,
  categoriseBatch,
  effectiveAiCategory,
  MIN_AI_CONFIDENCE,
  parseCategorisationResponse,
  type AiCategoryRecord,
  type ParsedCategorisationResult,
} from "../../src/features/categorise/categories";
import {
  loadAiCategories,
  loadIndexJob,
  parseAiCategories,
  parseIndexJob,
  saveAiCategories,
  type StorageLike,
} from "../../src/features/categorise/storage";
import {
  indexJobCounts,
  useAiIndexStore,
} from "../../src/features/categorise/store";
import {
  remainingUnnamedPlaces,
  runIndexJob,
} from "../../src/features/categorise/runner";

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function place(
  overrides: Partial<Place> & Pick<Place, "id" | "title" | "layerId">,
): Place {
  return {
    description: "",
    category: "exploration",
    position: { x: 0, y: 0 },
    tags: [],
    region: "",
    source: { title: "test", url: "" },
    evidence: "approximate",
    ...overrides,
  };
}

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

function aiRecord(
  overrides: Partial<AiCategoryRecord> & Pick<AiCategoryRecord, "placeId">,
): AiCategoryRecord {
  return {
    aiCategory: "gym",
    confidence: 0.85,
    reason: "Analogue address is a fitness centre.",
    model: "gpt-4o-mini",
    indexedAt: "2026-11-23T00:00:00.000Z",
    status: "suggested",
    ...overrides,
  };
}

describe("AI categorisation — real counts (no invented figures)", () => {
  it("counts the catalogue honestly: 4,456 places in-app, 4,380 GTADB records, 3,280 unnamed, 1,064 named", () => {
    const places = catalogueFromSnapshot(snapshot);
    expect(places).toHaveLength(4456);
    // 4,380 GTADB + 6 regions + 8 member gyms + 3 free outdoor + 5
    // breakable-home guide examples + 5 card pins + 29 Loot Map bank
    // jobs + 20 Loot Map collectibles.
    expect(places.filter((p) => p.layerId === "gyms")).toHaveLength(8);
    expect(places.filter((p) => p.layerId === "equipment")).toHaveLength(3);
    expect(places.filter((p) => p.layerId === "regions")).toHaveLength(6);
    const audit = unnamedTagAudit(places);
    expect(audit.unnamed).toBe(3280);
    expect(audit.withUsefulTags).toBe(1013);
    expect(audit.noTags).toBe(1711);
    expect(audit.onlyInternalTags).toBe(556);
    expect(audit.withUsefulTags + audit.noTags + audit.onlyInternalTags).toBe(
      3280,
    );
  });
});

describe("AI categorisation — prompt and context", () => {
  it("has a fixed category set and forbids inventing a name", () => {
    expect(AI_CATEGORIES).toEqual([
      "gym",
      "house",
      "shop",
      "restaurant",
      "bar",
      "petrol",
      "services",
      "leisure",
      "transport",
      "landmark",
      "other",
    ]);
    const prompt = buildCategorisationSystemPrompt();
    expect(prompt).toMatch(/NEVER invent/i);
    expect(prompt).toMatch(/never a name/i);
    expect(prompt).toMatch(/Below 0\.6 means "not sure"/);
  });

  it("builds context from everything the app knows — tags, analogue, county, enterable, neighbours", () => {
    const target = place({
      id: "L818",
      title: "?, Capri",
      layerId: "uncertain",
      position: { x: -6625, y: 251 },
      region: "Capri",
      tags: ["residential"],
      description:
        "Approximate community-mapped position. Real-world reference (analogue only): Lake Mirror Tower Apartments, 130 S Massachusetts Ave, Orlando, FL, USA",
      evidence: "uncertain",
    });
    const neighbour = place({
      id: "L672",
      title: "Train Bridge, Capri",
      layerId: "community",
      position: { x: -6837, y: 769 },
      region: "Capri",
    });
    const context = buildPlaceContext(target, [target, neighbour]);
    expect(context).toContain("L818");
    expect(context).toContain("area: Capri");
    // Capri (-6625, 251) falls in no estimated county rect — the context
    // omits the county rather than guessing one.
    expect(context).not.toContain("county:");
    expect(context).toContain("position: -6625, 251");
    expect(context).toContain("enterable: not known");
    expect(context).toContain("source tags: House");
    expect(context).toContain("Lake Mirror Tower Apartments");
    expect(context).toContain("Train Bridge, Capri");
    // A place inside an estimated county does name it.
    const viceCity = place({
      id: "gym:dynamix",
      title: "Dynamix Fitness",
      layerId: "gyms",
      position: { x: -366, y: 1514 },
      region: "Vice City",
      tags: ["gym"],
    });
    expect(buildPlaceContext(viceCity, [viceCity])).toContain(
      "county: vice-dale",
    );
  });

  it("says plainly when there is no analogue address and no named neighbour", () => {
    const target = place({
      id: "L939",
      title: "?, Capri",
      layerId: "uncertain",
      position: { x: -6731, y: 84 },
      region: "Capri",
      description: "Approximate community-mapped position.",
      evidence: "uncertain",
    });
    const context = buildPlaceContext(target, [target]);
    expect(context).toContain("source tags: none");
    expect(context).toContain("real-world analogue: none given");
    expect(context).toContain("none within 1,500 units");
  });
});

describe("AI categorisation — parsing (honesty guards)", () => {
  it("accepts a valid batch reply", () => {
    const results = parseCategorisationResponse(
      JSON.stringify({
        results: [
          {
            id: "L818",
            category: "house",
            confidence: 0.9,
            reason: "Apartment tower; tagged residential.",
          },
          {
            id: "L939",
            category: "other",
            confidence: 0.3,
            reason: "No evidence at all.",
          },
          {
            id: "L777",
            category: "shop",
            shopType: "supermarket",
            confidence: 0.82,
            reason: "Analogue is a grocery store.",
          },
        ],
      }),
      ["L818", "L939", "L777"],
    );
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({
      placeId: "L818",
      category: "house",
      confidence: 0.9,
    });
    expect(results[2]).toMatchObject({
      category: "shop",
      shopType: "supermarket",
    });
  });

  it("drops invented ids, unknown categories, bad confidences — and any name field", () => {
    const results = parseCategorisationResponse(
      JSON.stringify({
        results: [
          {
            id: "L818",
            category: "house",
            confidence: 0.9,
            reason: "ok",
            name: "Lake Mirror Tower",
          },
          {
            id: "L9999",
            category: "house",
            confidence: 0.9,
            reason: "never sent",
          },
          {
            id: "L939",
            category: "castle",
            confidence: 0.9,
            reason: "not a fixed type",
          },
          {
            id: "L940",
            category: "gym",
            confidence: "high",
            reason: "not a number",
          },
          { id: "L941", category: "gym", confidence: 0.8, reason: "ok" },
        ],
      }),
      ["L818", "L939", "L940", "L941"],
    );
    expect(results.map((r) => r.placeId)).toEqual(["L818", "L941"]);
    expect(results[0]).not.toHaveProperty("name");
  });

  it("throws on non-JSON or a missing results list instead of saving garbage", () => {
    expect(() => parseCategorisationResponse("not json", ["L818"])).toThrow(
      /not valid JSON/,
    );
    expect(() => parseCategorisationResponse('{"foo": []}', ["L818"])).toThrow(
      /no results list/,
    );
  });

  it("low confidence stays uncategorised — never shown as a type", () => {
    expect(
      effectiveAiCategory(
        aiRecord({ placeId: "L939", confidence: 0.3, status: "unsure" }),
      ),
    ).toBeNull();
    expect(
      effectiveAiCategory(aiRecord({ placeId: "L939", confidence: 0.59 })),
    ).toBeNull();
    expect(
      effectiveAiCategory(
        aiRecord({ placeId: "L818", confidence: MIN_AI_CONFIDENCE }),
      ),
    ).toBe("gym");
    expect(
      effectiveAiCategory(
        aiRecord({
          placeId: "L818",
          status: "corrected",
          userCategory: "house",
        }),
      ),
    ).toBe("house");
  });
});

describe("AI categorisation — OpenAI batch call (mocked fetch, no real key)", () => {
  it("calls api.openai.com with the small model, JSON mode, and only the batch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                results: [
                  {
                    id: "L818",
                    category: "house",
                    confidence: 0.9,
                    reason: "Apartment tower.",
                  },
                ],
              }),
            },
          },
        ],
      }),
    } as unknown as Response);
    const target = place({
      id: "L818",
      title: "?, Capri",
      layerId: "uncertain",
      position: { x: -6625, y: 251 },
      region: "Capri",
      tags: ["residential"],
    });
    const results = await categoriseBatch({
      places: [target],
      allPlaces: [target],
      apiKey: "sk-test-key-never-real",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.category).toBe("house");
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toMatch(/NEVER invent/);
    expect(JSON.stringify(body)).toContain("L818");
    expect(JSON.stringify(body)).not.toContain("Lake Mirror");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer sk-test-key-never-real",
    });
  });

  it("surfaces API errors verbatim instead of saving a fake category", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Incorrect API key provided",
    } as unknown as Response);
    await expect(
      categoriseBatch({
        places: [
          place({ id: "L818", title: "?, Capri", layerId: "uncertain" }),
        ],
        allPlaces: [],
        apiKey: "sk-bad",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow("401");
  });
});

describe("AI categorisation — on-device storage", () => {
  it("round-trips records and drops corrupt or invented categories", () => {
    const storage = memoryStorage({
      "leonida-ai-categories-v1": JSON.stringify({
        L818: aiRecord({ placeId: "L818" }),
        L939: {
          placeId: "L939",
          aiCategory: "castle",
          confidence: 0.9,
          reason: "x",
          model: "m",
          indexedAt: "t",
          status: "suggested",
        },
        L940: {
          placeId: "L999",
          aiCategory: "house",
          confidence: 0.9,
          reason: "x",
          model: "m",
          indexedAt: "t",
          status: "suggested",
        },
      }),
    });
    const loaded = loadAiCategories(storage);
    expect(Object.keys(loaded)).toEqual(["L818"]);
    expect(parseAiCategories("not json")).toEqual({});
  });

  it('a reloaded "running" job comes back paused, never claimed as still going', () => {
    const job = parseIndexJob(
      JSON.stringify({
        status: "running",
        attemptedPlaceIds: ["L818"],
        updatedAt: "t",
      }),
    );
    expect(job.status).toBe("paused");
    expect(job.attemptedPlaceIds).toEqual(["L818"]);
    expect(loadIndexJob(memoryStorage())).toEqual({
      status: "idle",
      attemptedPlaceIds: [],
      resolverVersion: 3,
      updatedAt: new Date(0).toISOString(),
    });
  });

  it("store confirm/correct never let a later batch overwrite the user", () => {
    const storage = memoryStorage();
    const store = useAiIndexStore.getState();
    store.load(storage);
    store.applyResults(
      [
        {
          placeId: "L818",
          category: "house",
          confidence: 0.9,
          reason: "Apartment tower.",
        },
      ],
      "gpt-4o-mini",
    );
    expect(useAiIndexStore.getState().categories["L818"]?.status).toBe(
      "suggested",
    );
    useAiIndexStore.getState().confirmCategory("L818");
    expect(useAiIndexStore.getState().categories["L818"]?.status).toBe(
      "confirmed",
    );
    // A re-run suggesting something else must not overwrite the confirmation.
    useAiIndexStore
      .getState()
      .applyResults(
        [
          {
            placeId: "L818",
            category: "gym",
            confidence: 0.95,
            reason: "Changed mind.",
          },
        ],
        "gpt-4o-mini",
      );
    expect(useAiIndexStore.getState().categories["L818"]?.aiCategory).toBe(
      "house",
    );
    useAiIndexStore.getState().correctCategory("L818", "shop", "supermarket");
    expect(useAiIndexStore.getState().categories["L818"]?.status).toBe(
      "corrected",
    );
    expect(
      effectiveAiCategory(useAiIndexStore.getState().categories["L818"]),
    ).toBe("shop");
    // And the corrected record survives a storage round-trip.
    const reloaded = loadAiCategories(storage);
    expect(reloaded["L818"]?.status).toBe("corrected");
    expect(reloaded["L818"]?.userCategory).toBe("shop");
    useAiIndexStore.getState().clearAll(storage);
    expect(useAiIndexStore.getState().categories).toEqual({});
  });

  it("counts X of N indexed, with unsure kept apart from categorised", () => {
    const counts = indexJobCounts(
      {
        L818: aiRecord({ placeId: "L818" }),
        L939: aiRecord({ placeId: "L939", confidence: 0.3, status: "unsure" }),
      },
      { status: "paused", attemptedPlaceIds: ["L818", "L939"], updatedAt: "t" },
      3280,
    );
    expect(counts).toEqual({
      attempted: 2,
      categorised: 1,
      unsure: 1,
      remaining: 3278,
      // The unsure place is still "to go" (remaining) but was already
      // run once, so it is not pending — only the never-run places are.
      pending: 3277,
    });
  });
});

describe("AI categorisation — the job runner (mocked fetch)", () => {
  function mockFetchFor(ids: readonly string[], category = "house") {
    return vi
      .fn()
      .mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        const text: string = body.messages[1].content as string;
        const batchIds = ids.filter((id) => text.includes(id));
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    results: batchIds.map((id) => ({
                      id,
                      category,
                      confidence: 0.9,
                      reason: "Test batch.",
                    })),
                  }),
                },
              },
            ],
          }),
        } as unknown as Response;
      });
  }

  it("indexes in batches of 8, saves after each batch, and resumes where it stopped", async () => {
    const storage = memoryStorage();
    const store = useAiIndexStore.getState();
    store.load(storage);
    const all = Array.from({ length: 20 }, (_, i) =>
      place({
        id: `L${1000 + i}`,
        title: "?, Capri",
        layerId: "uncertain",
        position: { x: i, y: 0 },
        region: "Capri",
      }),
    );
    const ids = all.map((p) => p.id);
    const fetchImpl = mockFetchFor(ids);
    const outcome = await runIndexJob({
      places: all,
      allPlaces: all,
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
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
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 8 + 8 + 4
    expect(useAiIndexStore.getState().job.attemptedPlaceIds).toHaveLength(20);
    expect(Object.keys(useAiIndexStore.getState().categories)).toHaveLength(20);
    // Resume: nothing left to do, no more calls.
    const remaining = remainingUnnamedPlaces(
      all,
      useAiIndexStore.getState().job.attemptedPlaceIds,
    );
    expect(remaining).toHaveLength(0);
    const second = await runIndexJob({
      places: remaining,
      allPlaces: all,
      apiKey: "sk-test",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      shouldPause: () => false,
      shouldCancel: () => false,
      applyResults: (results, model) =>
        useAiIndexStore.getState().applyResults(results, model),
      applyBatch: (results, attemptedPlaceIds, model) =>
        useAiIndexStore.getState().applyBatch(results, attemptedPlaceIds, model),
      setJob: (patch) => useAiIndexStore.getState().setJob(patch),
      batchDelayMs: 0,
    });
    expect(second).toBe("done");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    useAiIndexStore.getState().clearAll(storage);
    void saveAiCategories;
  });

  it("pause stops after the current batch and keeps what was saved", async () => {
    const storage = memoryStorage();
    useAiIndexStore.getState().load(storage);
    const all = Array.from({ length: 20 }, (_, i) =>
      place({
        id: `L${2000 + i}`,
        title: "?, Capri",
        layerId: "uncertain",
        position: { x: i, y: 0 },
        region: "Capri",
      }),
    );
    const fetchImpl = mockFetchFor(all.map((p) => p.id));
    let calls = 0;
    const outcome = await runIndexJob({
      places: all,
      allPlaces: all,
      apiKey: "sk-test",
      fetchImpl: (async (...args: Parameters<typeof fetch>) => {
        calls++;
        return fetchImpl(...args);
      }) as unknown as typeof fetch,
      shouldPause: () => calls >= 1,
      shouldCancel: () => false,
      applyResults: (results, model) =>
        useAiIndexStore.getState().applyResults(results, model),
      applyBatch: (results, attemptedPlaceIds, model) =>
        useAiIndexStore.getState().applyBatch(results, attemptedPlaceIds, model),
      setJob: (patch) => useAiIndexStore.getState().setJob(patch),
      batchDelayMs: 0,
    });
    expect(outcome).toBe("paused");
    expect(useAiIndexStore.getState().job.status).toBe("paused");
    expect(useAiIndexStore.getState().job.attemptedPlaceIds).toHaveLength(8);
    useAiIndexStore.getState().clearAll(storage);
  });

  it("a failed batch is not marked attempted, so a resume retries exactly that batch", async () => {
    const storage = memoryStorage();
    useAiIndexStore.getState().load(storage);
    const all = Array.from({ length: 10 }, (_, i) =>
      place({
        id: `L${3000 + i}`,
        title: "?, Capri",
        layerId: "uncertain",
        position: { x: i, y: 0 },
        region: "Capri",
      }),
    );
    const failing = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limited",
    } as unknown as Response);
    const outcome = await runIndexJob({
      places: all,
      allPlaces: all,
      apiKey: "sk-test",
      fetchImpl: failing as unknown as typeof fetch,
      shouldPause: () => false,
      shouldCancel: () => false,
      applyResults: (results, model) =>
        useAiIndexStore.getState().applyResults(results, model),
      applyBatch: (results, attemptedPlaceIds, model) =>
        useAiIndexStore.getState().applyBatch(results, attemptedPlaceIds, model),
      setJob: (patch) => useAiIndexStore.getState().setJob(patch),
      batchDelayMs: 0,
    });
    expect(outcome).toBe("error");
    expect(useAiIndexStore.getState().job.status).toBe("error");
    expect(useAiIndexStore.getState().job.error).toMatch(/429/);
    expect(useAiIndexStore.getState().job.attemptedPlaceIds).toHaveLength(0);
    expect(useAiIndexStore.getState().categories).toEqual({});
    useAiIndexStore.getState().clearAll(storage);
  });
});

describe("AI categorisation — Ask Nylah and search use it", () => {
  const layers = () =>
    DEFAULT_LAYERS.map((layer) => ({ ...layer, visible: false }));
  const CAPRI_GYM: Place = place({
    id: "L939",
    title: "?, Capri",
    layerId: "uncertain",
    position: { x: -6731, y: 84 },
    region: "Capri",
    evidence: "uncertain",
    tags: [],
  });
  const CAPRI_HOUSE: Place = place({
    id: "L818",
    title: "?, Capri",
    layerId: "uncertain",
    position: { x: -6625, y: 251 },
    region: "Capri",
    evidence: "uncertain",
    tags: ["residential"],
  });
  const CAPRI_SHOP: Place = place({
    id: "L777",
    title: "?, Capri",
    layerId: "uncertain",
    position: { x: -6600, y: 200 },
    region: "Capri",
    evidence: "uncertain",
    tags: ["enterable", "#gas"],
  });

  it('a gym the AI suggested for a "?" near Capri answers a gym question, nearest first', () => {
    const aiCategories = {
      L939: aiRecord({ placeId: "L939", aiCategory: "gym", confidence: 0.82 }),
    };
    const result = retrieveForAsk({
      question: "Show me a gym near Capri",
      places: [CAPRI_GYM, CAPRI_HOUSE],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      aiCategories,
    });
    expect(result.records.map((p) => p.id)).toContain("L939");
    expect(result.records[0]?.id).toBe("L939");
    expect(result.nearCount).toBe(1);
    // The AI house is not a gym.
    expect(result.records.map((p) => p.id)).not.toContain("L818");
  });

  it("an AI shop answers a shops question, and a robbable AI shop answers a burglary question", () => {
    const aiCategories = {
      L777: aiRecord({
        placeId: "L777",
        aiCategory: "shop",
        shopType: "supermarket",
        confidence: 0.88,
      }),
    };
    const shops = retrieveForAsk({
      question: "Where can I buy food in Capri?",
      places: [CAPRI_SHOP],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      aiCategories,
    });
    expect(shops.records.map((p) => p.id)).toContain("L777");
    const loot = retrieveForAsk({
      question: "Can I rob a shop in Capri tonight?",
      places: [CAPRI_SHOP],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      aiCategories,
    });
    expect(loot.records.map((p) => p.id)).toContain("L777");
  });

  it('an AI gym never answers a burglary question, and "not sure" never answers anything', () => {
    const aiCategories = {
      L939: aiRecord({ placeId: "L939", aiCategory: "gym", confidence: 0.82 }),
      L818: aiRecord({
        placeId: "L818",
        aiCategory: "house",
        confidence: 0.3,
        status: "unsure",
      }),
    };
    const loot = retrieveForAsk({
      question: "Can I rob a shop in Capri tonight?",
      places: [CAPRI_GYM, CAPRI_HOUSE],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      aiCategories,
    });
    expect(loot.records).toHaveLength(0);
    const gym = retrieveForAsk({
      question: "Show me a gym near Capri",
      places: [CAPRI_HOUSE],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      aiCategories,
    });
    expect(gym.records).toHaveLength(0);
  });

  it("a corrected type answers for the correction, not the AI suggestion", () => {
    const aiCategories = {
      L939: aiRecord({
        placeId: "L939",
        aiCategory: "gym",
        confidence: 0.82,
        status: "corrected",
        userCategory: "house",
      }),
    };
    const gym = retrieveForAsk({
      question: "Show me a gym near Capri",
      places: [CAPRI_GYM],
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      aiCategories,
    });
    expect(gym.records).toHaveLength(0);
    expect(
      aiCategoryMatchesLayer(aiCategories["L939"], CAPRI_GYM, "gyms"),
    ).toBe(false);
  });

  it('search finds an AI-gym "?" by "gym" and an AI house by "house"', () => {
    const aiCategories = {
      L939: aiRecord({ placeId: "L939", aiCategory: "gym", confidence: 0.82 }),
      L818: aiRecord({ placeId: "L818", aiCategory: "house", confidence: 0.9 }),
    };
    expect(
      filterPlaces(
        [CAPRI_GYM, CAPRI_HOUSE],
        { ...DEFAULT_FILTERS, query: "gym" },
        [],
        [],
        [],
        [],
        aiCategories,
      ).map((p) => p.id),
    ).toEqual(["L939"]);
    expect(
      filterPlaces(
        [CAPRI_GYM, CAPRI_HOUSE],
        { ...DEFAULT_FILTERS, query: "house" },
        [],
        [],
        [],
        [],
        aiCategories,
      ).map((p) => p.id),
    ).toEqual(["L818"]);
    expect(aiCategorySearchWords(aiCategories["L939"])).toContain("workout");
  });
});

describe("AI categorisation — v0.30.0 job reliability and model provenance", () => {
  function baseJob(overrides: {
    places: Place[];
    fetchImpl: unknown;
    shouldCancel?: () => boolean;
    shouldPause?: () => boolean;
    applyResults: (
      results: ParsedCategorisationResult[],
      model?: string,
    ) => Promise<boolean>;
    applyBatch?: (
      results: ParsedCategorisationResult[],
      attemptedPlaceIds: readonly string[],
      model?: string,
    ) => Promise<boolean>;
    model?: string;
  }) {
    const storage = memoryStorage();
    useAiIndexStore.getState().load(storage);
    return {
      storage,
      run: () =>
        runIndexJob({
          places: overrides.places,
          allPlaces: overrides.places,
          apiKey: "sk-test",
          model: overrides.model,
          fetchImpl: overrides.fetchImpl as unknown as typeof fetch,
          shouldPause: overrides.shouldPause ?? (() => false),
          shouldCancel: overrides.shouldCancel ?? (() => false),
          applyResults: overrides.applyResults,
          applyBatch:
            overrides.applyBatch ??
            ((results, attemptedPlaceIds, model) =>
              useAiIndexStore
                .getState()
                .applyBatch(results, attemptedPlaceIds, model)),
          setJob: (patch) => useAiIndexStore.getState().setJob(patch),
          batchDelayMs: 0,
        }),
    };
  }

  it("stopping mid-batch aborts the in-flight call — nothing from that batch is saved", async () => {
    const all = Array.from({ length: 8 }, (_, i) =>
      place({
        id: `L${5000 + i}`,
        title: "?, Capri",
        layerId: "uncertain",
        position: { x: i, y: 0 },
        region: "Capri",
      }),
    );
    let seenSignal: AbortSignal | undefined;
    const hanging = vi.fn(async (_url: string, init?: RequestInit) => {
      seenSignal = init?.signal as AbortSignal | undefined;
      await new Promise<void>((_, reject) => {
        seenSignal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
      return {} as Response;
    });
    let stop = false;
    setTimeout(() => {
      stop = true;
    }, 30);
    const applied: unknown[] = [];
    const { storage, run } = baseJob({
      places: all,
      fetchImpl: hanging,
      shouldCancel: () => stop,
      applyResults: async (results) => {
        applied.push(...results);
        return true;
      },
    });
    const outcome = await run();
    expect(outcome).toBe("cancelled");
    expect(useAiIndexStore.getState().job.status).toBe("idle");
    expect(seenSignal?.aborted).toBe(true);
    expect(applied).toHaveLength(0);
    expect(useAiIndexStore.getState().job.attemptedPlaceIds).toHaveLength(0);
    expect(useAiIndexStore.getState().categories).toEqual({});
    useAiIndexStore.getState().clearAll(storage);
  });

  it("a hanging batch times out instead of stalling the job forever", async () => {
    const all = Array.from({ length: 8 }, (_, i) =>
      place({
        id: `L${5100 + i}`,
        title: "?, Capri",
        layerId: "uncertain",
        position: { x: i, y: 0 },
        region: "Capri",
      }),
    );
    const hanging = vi.fn(
      () => new Promise<Response>(() => {}),
    ) as unknown as typeof fetch;
    // The runner's batch timeout is the categoriseBatch default (60s),
    // so exercise the batch call directly with a short timeout here.
    await expect(
      categoriseBatch({
        places: all,
        allPlaces: all,
        apiKey: "sk-test",
        fetchImpl: hanging,
        timeoutMs: 50,
      }),
    ).rejects.toThrow(/timed out/i);
  });

  it("records name the model that actually made them — custom model for AI, 'deterministic' for data-resolved", async () => {
    const deterministicPlace = place({
      id: "L5200",
      title: "?, Vice City",
      layerId: "gyms",
      tags: ["gym"],
      position: { x: 0, y: 0 },
      region: "Vice City",
    });
    const aiPlaces = Array.from({ length: 7 }, (_, i) =>
      place({
        id: `L${5201 + i}`,
        title: "?, Capri",
        layerId: "uncertain",
        position: { x: i + 1, y: 0 },
        region: "Capri",
      }),
    );
    const all = [deterministicPlace, ...aiPlaces];
    const seenModels: string[] = [];
    const fetchImpl = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      seenModels.push(body.model as string);
      const text: string = body.messages[1].content as string;
      const batchIds = aiPlaces.map((p) => p.id).filter((id) => text.includes(id));
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  results: batchIds.map((id) => ({
                    id,
                    category: "house",
                    confidence: 0.9,
                    reason: "Test batch.",
                  })),
                }),
              },
            },
          ],
        }),
      } as unknown as Response;
    });
    const appliedModels: Array<{ ids: string[]; model: string | undefined }> = [];
    const { storage, run } = baseJob({
      places: all,
      fetchImpl,
      model: "gpt-4o",
      applyResults: async (results, model) => {
        appliedModels.push({
          ids: results.map((r) => r.placeId),
          model,
        });
        return useAiIndexStore.getState().applyResults(results, model);
      },
      applyBatch: async (results, attemptedPlaceIds, model) => {
        appliedModels.push({
          ids: results.map((r) => r.placeId),
          model,
        });
        return useAiIndexStore
          .getState()
          .applyBatch(results, attemptedPlaceIds, model);
      },
    });
    const outcome = await run();
    expect(outcome).toBe("done");
    // The AI call used the user's chosen model, not the default.
    expect(seenModels).toEqual(["gpt-4o"]);
    // The data-resolved place was recorded as 'deterministic' — no
    // model made it — and the AI places as 'gpt-4o'.
    const byId = new Map(
      appliedModels.flatMap(({ ids, model }) => ids.map((id) => [id, model])),
    );
    expect(byId.get("L5200")).toBe("deterministic");
    for (const p of aiPlaces) expect(byId.get(p.id)).toBe("gpt-4o");
    const stored = useAiIndexStore.getState().categories;
    expect(stored["L5200"]?.model).toBe("deterministic");
    expect(stored["L5201"]?.model).toBe("gpt-4o");
    useAiIndexStore.getState().clearAll(storage);
  });
});
