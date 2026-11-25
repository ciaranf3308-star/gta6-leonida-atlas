import { describe, expect, it } from "vitest";
import type { LayerDefinition, Place } from "../../src/domain/types";
import { DEFAULT_LAYERS } from "../../src/features/map/layers";
import { retrieveForAsk } from "../../src/features/ask/retrieval";
import {
  ASK_MAX_CARDS,
  askAnchorLabel,
  badgesForPlace,
  buildAskCards,
  shortVerdict,
} from "../../src/features/ask/cards";
import type { AiCategoryRecord } from "../../src/features/categorise/categories";

function place(
  overrides: Partial<Place> & Pick<Place, "id" | "title" | "layerId">,
): Place {
  return {
    description: "",
    category: "food-drink",
    position: { x: 0, y: 0 },
    tags: [],
    region: "",
    source: { title: "test", url: "" },
    evidence: "approximate",
    ...overrides,
  };
}

const layers = (): LayerDefinition[] =>
  DEFAULT_LAYERS.map((layer) => ({ ...layer, visible: false }));

/** Capri anchor places + the gyms/equipment, as in ask-nylah.test.ts. */
const CAPRI_PLACES: Place[] = [
  place({
    id: "L672",
    title: "Train Bridge, Capri",
    layerId: "community",
    position: { x: -6837, y: 769 },
    region: "Capri",
    category: "vehicles",
  }),
  place({
    id: "L1064",
    title: "Capri City Jackals Stadium, Capri",
    layerId: "community",
    position: { x: -6409, y: -210 },
    region: "Capri",
    category: "exploration",
  }),
  place({
    id: "gym:grand-majestic",
    title: "Grand Majestic Gym",
    layerId: "gyms",
    position: { x: -1035, y: -1249 },
    region: "Tequesta, Vice City",
    tags: ["gym"],
  }),
  place({
    id: "gym:zenith",
    title: "Zenith",
    layerId: "gyms",
    position: { x: -826, y: -566 },
    region: "Downtown, Vice City",
    tags: ["gym"],
  }),
  place({
    id: "gym:dynamix",
    title: "Dynamix Fitness",
    layerId: "gyms",
    position: { x: -366, y: 1514 },
    region: "Vice City",
    tags: ["gym"],
  }),
  place({
    id: "gym:muscle-sands",
    title: "Muscle Sands",
    layerId: "equipment",
    position: { x: 2019, y: 407 },
    region: "Ocean Beach, Vice Beach",
    tags: ["gym", "free", "outdoor", "equipment", "workout"],
  }),
  place({
    id: "gym:jason-house-deck",
    title: "Jason's house deck (home gym)",
    layerId: "equipment",
    position: { x: -2353, y: -5532 },
    region: "Key Lento, Leonida Keys",
    tags: ["gym", "free", "outdoor", "home", "equipment", "workout"],
  }),
  place({
    id: "gym:starlet-motel-bench",
    title: "Starlet Motel bench",
    layerId: "equipment",
    position: null,
    region: "Port Gellhorn, Kelly County",
    tags: ["gym", "free", "outdoor", "equipment", "workout"],
  }),
  place({
    id: "L3001",
    title: "?, Capri",
    layerId: "breakable",
    position: { x: -6800, y: 200 },
    region: "Capri",
    tags: ["enterable", "residential"],
  }),
];

const noAi: Record<string, AiCategoryRecord> = {};

describe("Ask cards — the verdict stays short", () => {
  it("keeps the first two sentences of the proximity summary, never the whole paragraph", () => {
    expect(
      shortVerdict(
        "There is no gym near Capri in the map data. The nearest is Grand Majestic Gym, in Tequesta, Vice City — about 5700 map units away, a long way across the map. House gyms and workout gear inside houses are not in the public map data yet — no source lists them. If you mark a house gym yourself, Ask will use your marker next time. 13 houses in Capri are worth checking — listed below. None of them is a verified gym.",
      ),
    ).toBe(
      "There is no gym near Capri in the map data. The nearest is Grand Majestic Gym, in Tequesta, Vice City — about 5700 map units away, a long way across the map.",
    );
    expect(shortVerdict("One sentence.")).toBe("One sentence.");
    expect(shortVerdict(null)).toBeNull();
  });
});

describe("Ask cards — gym near Capri", () => {
  it("is cards, nearest first, every card with its distance — never a text wall", () => {
    const result = retrieveForAsk({
      question: "Show me a gym near Capri",
      places: CAPRI_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    const { cards, total } = buildAskCards(result, CAPRI_PLACES, noAi);
    expect(total).toBe(result.records.length);
    expect(cards.length).toBeGreaterThan(0);
    // Nearest first: Grand Majestic, then Zenith, then Dynamix.
    expect(cards.map((c) => c.placeId)).toEqual([
      "gym:grand-majestic",
      "gym:zenith",
      "gym:dynamix",
    ]);
    const distances = cards.map((c) => c.distanceUnits);
    expect(distances[0]).not.toBeNull();
    expect(distances[0]!).toBeGreaterThan(5000);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]!).toBeGreaterThanOrEqual(distances[i - 1]!);
    }
    // No card is presented as near: all three are far from Capri.
    expect(cards.every((c) => !c.near)).toBe(true);
    expect(cards[0]?.distanceLabel).toMatch(/map units away/);
    // Every card carries a Gym badge and its area.
    expect(cards[0]?.badges).toContain("Gym");
    expect(cards[0]?.area).toBe("Tequesta, Vice City");
    expect(cards[0]?.title).toBe("Grand Majestic Gym");
    // The anchor is on the answer, so a follow-up never loses it.
    expect(askAnchorLabel(result)).toBe("Near Capri");
    expect(result.proximitySummary).toMatch(/no gym near capri/i);
  });
});

describe("Ask cards — workout equipment near Capri", () => {
  it("answers from the free gear, never the member gyms, unpositioned last", () => {
    const result = retrieveForAsk({
      question: "workout equipment near Capri",
      places: CAPRI_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    const { cards } = buildAskCards(result, CAPRI_PLACES, noAi);
    // Nearest first from the Capri centroid: Jason's deck (Key Lento)
    // is nearer than Muscle Sands (Ocean Beach); the bench has no
    // verified position, so it sorts last.
    expect(cards.map((c) => c.placeId)).toEqual([
      "gym:jason-house-deck",
      "gym:muscle-sands",
      "gym:starlet-motel-bench",
    ]);
    expect(cards[0]?.badges).toContain("Equipment");
    expect(cards[0]?.badges).not.toContain("Gym");
    // The bench has no verified position: last, and it says so.
    expect(cards[2]?.hasPosition).toBe(false);
    expect(cards[2]?.distanceLabel).toBe("No verified position");
    expect(cards[2]?.distanceUnits).toBeNull();
  });
});

describe("Ask cards — enterable houses in Vice City", () => {
  it("shows breakable/enterable badges on the house cards", () => {
    const places: Place[] = [
      place({
        id: "L3002",
        title: "Venture Apts North, Rockridge, Vice City",
        layerId: "breakable",
        position: { x: -1325, y: 713 },
        region: "Rockridge, Vice City",
        tags: ["enterable", "residential"],
      }),
      place({
        id: "L3001",
        title: "?, Capri",
        layerId: "breakable",
        position: { x: -6800, y: 200 },
        region: "Capri",
        tags: ["enterable", "residential"],
      }),
      place({
        id: "L2001",
        title: "Starlet Motel",
        layerId: "interiors",
        position: { x: -5354, y: 3461 },
        region: "Kelly County",
        tags: ["enterable", "hotel"],
      }),
    ];
    const result = retrieveForAsk({
      question: "enterable houses in Vice City",
      places,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    const { cards } = buildAskCards(result, places, noAi);
    expect(cards.length).toBeGreaterThan(0);
    const venture = cards.find((c) => c.placeId === "L3002");
    expect(venture?.badges).toContain("Enterable");
    expect(venture?.badges).toContain("Breakable");
    // The "?" house titles with its tag type, never an invented name.
    const capriHouse = cards.find((c) => c.placeId === "L3001");
    expect(capriHouse?.title).toBe("? · House");
    expect(capriHouse?.typeSource).toBe("tag");
  });
});

describe("Ask cards — badges and '?' titles", () => {
  it("derives Enterable / Lootable / Breakable / Gym / Equipment from tags + layer", () => {
    const lootable = place({
      id: "L1",
      title: "Corner Store, Capri",
      layerId: "lootable",
      tags: ["enterable", "retail"],
    });
    expect(badgesForPlace(lootable, null).badges).toEqual(
      expect.arrayContaining(["Enterable", "Lootable"]),
    );
    const equipment = place({
      id: "gym:muscle-sands",
      title: "Muscle Sands",
      layerId: "equipment",
      tags: ["gym", "free", "outdoor", "equipment"],
    });
    expect(badgesForPlace(equipment, null).badges).toEqual(["Equipment"]);
    const gym = place({
      id: "gym:dynamix",
      title: "Dynamix Fitness",
      layerId: "gyms",
      tags: ["gym"],
    });
    expect(badgesForPlace(gym, null).badges).toEqual(["Gym"]);
    const house = place({
      id: "L2",
      title: "?, Capri",
      layerId: "breakable",
      tags: ["enterable", "residential"],
    });
    expect(badgesForPlace(house, null).badges).toEqual(
      expect.arrayContaining(["Enterable", "Breakable"]),
    );
  });

  it("flags an AI gym badge as AI — never a verified fact", () => {
    const unknown = place({
      id: "L3",
      title: "?, Capri",
      layerId: "uncertain",
      tags: [],
    });
    const aiGym: AiCategoryRecord = {
      placeId: "L3",
      aiCategory: "gym",
      confidence: 0.85,
      reason: "Analogue address is a fitness centre.",
      model: "gpt-4o-mini",
      indexedAt: "2026-11-24T00:00:00.000Z",
      status: "suggested",
      source: "ai",
    };
    const { badges, aiBadges } = badgesForPlace(unknown, aiGym);
    expect(badges).toContain("Gym");
    expect(aiBadges["Gym"]).toBe(true);
    const { cards } = buildAskCards(
      {
        records: [unknown],
        requestedLayerIds: ["gyms"],
        requestedLayerNames: ["Gyms"],
        anchorPlace: null,
        anchorPosition: null,
        anchorDistances: new Map(),
        nearestDistance: null,
        nearCount: 0,
        proximitySummary: null,
        areaLabel: null,
        areaMismatch: false,
        totalInScope: 1,
        housesToCheck: [],
        housesToCheckTotal: 0,
        housesAreaName: null,
        housesKind: null,
        ruleNote: null,
      },
      [unknown],
      { L3: aiGym },
    );
    expect(cards[0]?.title).toBe("? · Gym");
    expect(cards[0]?.typeSource).toBe("ai");
    expect(cards[0]?.typeNote).toMatch(/AI suggested/);
  });

  it("caps at 10 cards — the rest stay highlighted on the map", () => {
    expect(ASK_MAX_CARDS).toBe(10);
    const many = Array.from({ length: 15 }, (_, i) =>
      place({
        id: `gym:g${i}`,
        title: `Gym ${i}`,
        layerId: "gyms",
        position: { x: i * 100, y: 0 },
        tags: ["gym"],
      }),
    );
    const { cards, total } = buildAskCards(
      {
        records: many,
        requestedLayerIds: ["gyms"],
        requestedLayerNames: ["Gyms"],
        anchorPlace: null,
        anchorPosition: { x: 0, y: 0 },
        anchorDistances: new Map(many.map((p, i) => [p.id, i * 100])),
        nearestDistance: 0,
        nearCount: 1,
        proximitySummary: null,
        areaLabel: null,
        areaMismatch: false,
        totalInScope: 15,
        housesToCheck: [],
        housesToCheckTotal: 0,
        housesAreaName: null,
        housesKind: null,
        ruleNote: null,
      },
      many,
      noAi,
    );
    expect(cards).toHaveLength(10);
    expect(total).toBe(15);
  });
});
