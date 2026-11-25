import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueFromSnapshot } from "../../src/data/catalogue";
import { isUnnamedPlace, type Place } from "../../src/domain/types";
import { tagResolutionCounts } from "../../src/domain/resolve-tags";
import {
  COORDINATE_MATCH_UNITS,
  GUIDE_MATCH_UNITS,
  analogueResolutionFor,
  categoryForNamedPlace,
  resolvePlaceDeterministically,
  resolutionSourceCounts,
} from "../../src/features/categorise/resolver";
import {
  effectiveAiCategory,
  type AiCategoryRecord,
} from "../../src/features/categorise/categories";
import { runIndexJob } from "../../src/features/categorise/runner";
import { useAiIndexStore } from "../../src/features/categorise/store";
import type { StorageLike } from "../../src/features/categorise/storage";

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

describe("index resolver v2 — coordinate match (same spot only)", () => {
  it("matches a '?' on the same spot as a named place, and inherits its type", () => {
    const busStop = place({
      id: "L3120",
      title: "Bus Stop, Ocean Beach, Vice Beach",
      layerId: "community",
      position: { x: 100, y: 100 },
      tags: ["transportation"],
    });
    const unnamed = place({
      id: "L64",
      title: "?, Ocean Beach, Vice Beach",
      layerId: "uncertain",
      position: { x: 105, y: 108 },
      region: "Ocean Beach, Vice Beach",
    });
    const resolved = resolvePlaceDeterministically(unnamed, [unnamed, busStop]);
    expect(resolved?.source).toBe("coordinate");
    expect(resolved?.category).toBe("transport");
    expect(resolved?.matchedFrom).toContain("Bus Stop");
  });

  it("does NOT match a neighbour: 50 units away is a different building", () => {
    const shop = place({
      id: "L100",
      title: "Corner Store, Capri",
      layerId: "shops-food",
      position: { x: 0, y: 0 },
      tags: ["retail"],
    });
    const neighbour = place({
      id: "L101",
      title: "?, Capri",
      layerId: "uncertain",
      position: { x: 50, y: 0 },
      region: "Capri",
    });
    // 50 units is far past the 15-unit same-spot tolerance — the
    // snapshot proves it: records sit a median 118 units apart, and at
    // 50u tag disagreements (67) outnumber agreements (15).
    expect(COORDINATE_MATCH_UNITS).toBe(15);
    expect(resolvePlaceDeterministically(neighbour, [neighbour, shop])).toBeNull();
  });

  it("does NOT match when the tags contradict — a residential '?' next to a named shop is a neighbour", () => {
    const shop = place({
      id: "L100",
      title: "Corner Store, Capri",
      layerId: "shops-food",
      position: { x: 0, y: 0 },
      tags: ["retail"],
    });
    const house = place({
      id: "L101",
      title: "?, Capri",
      layerId: "uncertain",
      position: { x: 10, y: 0 },
      region: "Capri",
      tags: ["residential"],
    });
    // The tag step fires first here (house) — and a coordinate match
    // must never override it.
    const resolved = resolvePlaceDeterministically(house, [house, shop]);
    expect(resolved?.source).toBe("tag");
    expect(resolved?.category).toBe("house");
  });

  it("does NOT resolve when the named neighbour has no type to inherit", () => {
    const plain = place({
      id: "L100",
      title: "Somewhere, Capri",
      layerId: "community",
      position: { x: 0, y: 0 },
      tags: [],
    });
    const unnamed = place({
      id: "L101",
      title: "?, Capri",
      layerId: "uncertain",
      position: { x: 5, y: 0 },
      region: "Capri",
    });
    expect(resolvePlaceDeterministically(unnamed, [unnamed, plain])).toBeNull();
  });

  it("a gym layer place lends its type to a '?' on the same spot", () => {
    const gym = place({
      id: "gym:zenith",
      title: "Zenith",
      layerId: "gyms",
      position: { x: -826, y: -566 },
      tags: ["gym"],
    });
    const unnamed = place({
      id: "L2860",
      title: "?, Downtown, Vice City",
      layerId: "uncertain",
      position: { x: -820, y: -560 },
      region: "Downtown, Vice City",
      tags: ["//blue"],
    });
    const resolved = resolvePlaceDeterministically(unnamed, [unnamed, gym]);
    expect(resolved?.source).toBe("coordinate");
    expect(resolved?.category).toBe("gym");
  });

  it("categoryForNamedPlace reads tags first, then the layer", () => {
    expect(
      categoryForNamedPlace(
        place({ id: "L1", title: "X", layerId: "community", tags: ["retail"] }),
      ),
    ).toEqual({ category: "shop", shopType: "shop" });
    expect(
      categoryForNamedPlace(
        place({ id: "g1", title: "Gym", layerId: "gyms", tags: ["gym"] }),
      ),
    ).toEqual({ category: "gym", shopType: undefined });
    expect(
      categoryForNamedPlace(
        place({ id: "L2", title: "X", layerId: "community", tags: [] }),
      ),
    ).toBeNull();
    expect(
      categoryForNamedPlace(
        place({ id: "L3", title: "X", layerId: "interiors", tags: ["enterable"] }),
      ),
    ).toBeNull();
  });
});

describe("index resolver v2 — guide match", () => {
  it("matches a '?' near a verified guide pin (25 units — guide pins are approximate)", () => {
    expect(GUIDE_MATCH_UNITS).toBe(25);
    // L2858 sits 21 units from the Grand Majestic Gym guide pin: too
    // far for the 15-unit same-spot step, close enough for a guide pin.
    const places = catalogueFromSnapshot(snapshot);
    const target = places.find((p) => p.id === "L2858")!;
    expect(isUnnamedPlace(target)).toBe(true);
    const resolved = resolvePlaceDeterministically(target, places);
    expect(resolved?.source).toBe("guide");
    expect(resolved?.category).toBe("gym");
    expect(resolved?.matchedFrom).toContain("Grand Majestic Gym");
  });

  it("does NOT guide-match past 25 units — Y Hotel's nearest '?' is 80 away", () => {
    const places = catalogueFromSnapshot(snapshot);
    const target = places.find((p) => p.id === "L1321")!;
    const resolved = resolvePlaceDeterministically(target, places);
    expect(resolved?.source).not.toBe("guide");
  });
});

describe("index resolver v2 — analogue rules", () => {
  it("reads an apartment building as a house, a supermarket as a shop, a gas station as petrol", () => {
    expect(
      analogueResolutionFor(
        "Approximate community-mapped position. Real-world reference (analogue only): Lake Mirror Tower Apartments, 130 S Massachusetts Ave, Orlando, FL, USA",
      )?.category,
    ).toBe("house");
    expect(
      analogueResolutionFor(
        "Real-world reference (analogue only): Publix Super Market, 123 Main St, Miami, FL, USA",
      ),
    ).toEqual(
      expect.objectContaining({ category: "shop", shopType: "supermarket" }),
    );
    expect(
      analogueResolutionFor(
        "Real-world reference (analogue only): Chevron Gas Station, 1 Ocean Dr, Miami, FL, USA",
      )?.category,
    ).toBe("petrol");
  });

  it("reads 'Bar & Grill' as a restaurant, not a bar", () => {
    expect(
      analogueResolutionFor(
        "Real-world reference (analogue only): Big Deck Bar & Grill, 331 Dock St, Cedar Key, FL, USA",
      )?.category,
    ).toBe("restaurant");
  });

  it("refuses the ambiguous words: hotel, marina and 'filling station' resolve nothing", () => {
    for (const analogue of [
      "Grand Beach Hotel, 123 Ocean Dr, Miami, FL, USA",
      "Marina Blue, 888 Biscayne Blvd, Miami, FL, USA",
      "Filling Station Lofts, 1657 N Miami Ave, Miami, FL, USA",
    ]) {
      expect(
        analogueResolutionFor(
          `Real-world reference (analogue only): ${analogue}`,
        ),
      ).toBeNull();
    }
    expect(analogueResolutionFor("No analogue here.")).toBeNull();
  });
});

describe("index resolver v2 — the job runner (mocked fetch)", () => {
  it("a batch the data already resolves makes no API call at all", async () => {
    const storage = memoryStorage();
    const store = useAiIndexStore.getState();
    store.load(storage);
    const places = catalogueFromSnapshot(snapshot);
    // Eight places the deterministic steps resolve: tag (L4 house),
    // coordinate (L64 bus stop), guide (L2858 gym), analogue (L90
    // apartments) + four more tag-resolved houses.
    const ids = ["L4", "L64", "L2858", "L90", "L5", "L7", "L8", "L9"];
    const batch = ids.map((id) => places.find((p) => p.id === id)!);
    expect(batch.every(Boolean)).toBe(true);
    const fetchImpl = (() => {
      throw new Error("fetch must not be called for a resolved batch");
    }) as unknown as typeof fetch;
    const outcome = await runIndexJob({
      places: batch,
      allPlaces: places,
      apiKey: "sk-test",
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
    const categories = useAiIndexStore.getState().categories;
    expect(Object.keys(categories)).toHaveLength(8);
    expect(categories["L64"]?.source).toBe("coordinate");
    expect(categories["L2858"]?.source).toBe("guide");
    expect(categories["L90"]?.source).toBe("analogue");
    expect(categories["L4"]?.source).toBe("tag");
    expect(
      useAiIndexStore.getState().job.attemptedPlaceIds,
    ).toHaveLength(8);
    useAiIndexStore.getState().clearAll(storage);
  });

  it("a mixed batch sends only the unresolved rest to the LLM", async () => {
    const storage = memoryStorage();
    useAiIndexStore.getState().load(storage);
    const places = catalogueFromSnapshot(snapshot);
    const tagged = places.find((p) => p.id === "L4")!;
    // L939 is a real "?" the deterministic steps cannot resolve (no
    // tags, no analogue, no same-spot or guide match) — it is the
    // LLM's job, and only the LLM's.
    const unknown = places.find((p) => p.id === "L939")!;
    expect(resolvePlaceDeterministically(unknown, places)).toBeNull();
    const sentIds: string[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const text: string = body.messages[1].content as string;
      for (const id of ["L4", "L939"]) if (text.includes(id)) sentIds.push(id);
      return {
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
                      confidence: 0.9,
                      reason: "Test batch.",
                    },
                  ],
                }),
              },
            },
          ],
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const outcome = await runIndexJob({
      places: [tagged, unknown],
      allPlaces: places,
      apiKey: "sk-test",
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
    // Only the unresolved place was sent to the LLM.
    expect(sentIds).toEqual(["L939"]);
    const categories = useAiIndexStore.getState().categories;
    expect(categories["L4"]?.source).toBe("tag");
    expect(categories["L939"]?.source).toBe("ai");
    useAiIndexStore.getState().clearAll(storage);
  });
});

describe("index resolver v2 — order and real-snapshot yields", () => {
  it("tag beats everything: a tagged '?' never reaches the coordinate step", () => {
    const shop = place({
      id: "L100",
      title: "Corner Store, Capri",
      layerId: "shops-food",
      position: { x: 0, y: 0 },
      tags: ["retail"],
    });
    const tagged = place({
      id: "L101",
      title: "?, Capri",
      layerId: "uncertain",
      position: { x: 5, y: 0 },
      region: "Capri",
      tags: ["residential"],
    });
    const resolved = resolvePlaceDeterministically(tagged, [tagged, shop]);
    expect(resolved?.source).toBe("tag");
    expect(resolved?.category).toBe("house");
  });

  it("named places never resolve — they already say what they are", () => {
    const named = place({
      id: "L100",
      title: "Corner Store, Capri",
      layerId: "shops-food",
      position: { x: 0, y: 0 },
      tags: ["retail"],
    });
    expect(resolvePlaceDeterministically(named, [named])).toBeNull();
  });

  it("resolves 658 of 2,732 '?' from data alone on the real snapshot — 2,074 left for the LLM", { timeout: 30_000 }, () => {
    const places = catalogueFromSnapshot(snapshot);
    const unnamed = places.filter(isUnnamedPlace);
    expect(unnamed).toHaveLength(2732);
    const bySource: Record<string, number> = {};
    let unresolved = 0;
    for (const target of unnamed) {
      const resolved = resolvePlaceDeterministically(target, places);
      if (!resolved) unresolved += 1;
      else bySource[resolved.source] = (bySource[resolved.source] ?? 0) + 1;
    }
    // Tags (extended rules) 588, same-spot coordinate 9, guide pin 1,
    // analogue keywords 60 — measured, not estimated.
    expect(bySource).toEqual({ tag: 588, coordinate: 9, guide: 1, analogue: 60 });
    expect(unresolved).toBe(2074);
    const tagCounts = tagResolutionCounts(places);
    expect(tagCounts.resolved).toBe(588);
    expect(tagCounts.remaining).toBe(2144);
    expect(tagCounts.byCategory).toEqual({
      house: 332,
      transport: 37,
      services: 19,
      restaurant: 15,
      shop: 106,
      leisure: 30,
      landmark: 47,
      petrol: 2,
    });
  });

  it("counts resolved records by source, with unsure kept apart", () => {
    const record = (
      overrides: Partial<AiCategoryRecord> & Pick<AiCategoryRecord, "placeId">,
    ): AiCategoryRecord => ({
      aiCategory: "house",
      confidence: 0.9,
      reason: "test",
      model: "gpt-4o-mini",
      indexedAt: "2026-11-24T00:00:00.000Z",
      status: "suggested",
      ...overrides,
    });
    const counts = resolutionSourceCounts({
      L1: record({ placeId: "L1", source: "tag" }),
      L2: record({ placeId: "L2", source: "coordinate" }),
      L3: record({ placeId: "L3", source: "guide" }),
      L4: record({ placeId: "L4", source: "analogue" }),
      L5: record({ placeId: "L5", source: "ai" }),
      L6: record({ placeId: "L6" }), // pre-v0.13.0 record: reads as AI
      L7: record({ placeId: "L7", confidence: 0.3, status: "unsure" }),
    });
    expect(counts).toEqual({
      coordinate: 1,
      guide: 1,
      analogue: 1,
      ai: 2,
      unsure: 1,
    });
    expect(effectiveAiCategory(record({ placeId: "L1", source: "tag" }))).toBe("house");
  });
});
