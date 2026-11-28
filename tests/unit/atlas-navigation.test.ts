import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueFromSnapshot } from "../../src/data/catalogue";
import { filterPlaces } from "../../src/domain/filter";
import { DEFAULT_FILTERS } from "../../src/stores/atlas";
import type { LayerDefinition, Place } from "../../src/domain/types";
import { distanceBetween, distanceWord } from "../../src/domain/distance";
import {
  housesToCheck,
  isEquipmentQuery,
  isGymQuery,
  nearestVerifiedEquipment,
  nearestVerifiedGym,
} from "../../src/domain/gym-check";
import { filterByVisibleLayers } from "../../src/features/map/layers";
import { layersRequestedByQuestion } from "../../src/features/ask/retrieval";
import { nameCounts } from "../../src/features/onboarding/onboarding";
import { DEFAULT_LAYERS } from "../../src/features/map/layers";
import { retrieveForAsk } from "../../src/features/ask/retrieval";

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function place(overrides: Partial<Place> & Pick<Place, "id" | "title" | "layerId">): Place {
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

const layers = (): LayerDefinition[] =>
  DEFAULT_LAYERS.map((layer) => ({ ...layer, visible: false }));

describe("navigation filters — one system, map and Find", () => {
  it("narrows to enterable places only", () => {
    const places = [
      place({ id: "a", title: "House, Capri", layerId: "uncertain", tags: ["enterable"], region: "Capri" }),
      place({ id: "b", title: "Park, Capri", layerId: "uncertain", tags: [], region: "Capri" }),
      place({ id: "c", title: "Shop, Capri", layerId: "interiors", tags: ["retail"], region: "Capri" }),
    ];
    const found = filterPlaces(places, { ...DEFAULT_FILTERS, enterableOnly: true }, [], [], []);
    expect(found.map((p) => p.id).sort()).toEqual(["a", "c"]);
  });

  it("narrows to lootable buildings only", () => {
    const places = [
      place({ id: "a", title: "Store, Capri", layerId: "lootable", tags: ["enterable", "retail"] }),
      place({ id: "b", title: "Shop, Capri", layerId: "shops-food", tags: ["retail"] }),
    ];
    const found = filterPlaces(places, { ...DEFAULT_FILTERS, lootableOnly: true }, [], [], []);
    expect(found.map((p) => p.id)).toEqual(["a"]);
  });

  it("distance words never invent metres — close, nearby, a long way away", () => {
    expect(distanceWord(500)).toBe("Close by");
    expect(distanceWord(1999)).toBe("Close by");
    expect(distanceWord(2500)).toBe("Nearby");
    expect(distanceWord(5700)).toBe("A long way away");
    expect(distanceWord(null)).toBeNull();
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("real counts — no 5k, ever", () => {
  it("counts the snapshot's own names: 1,064 known, 3,316 unknown, 3,280 still ?", () => {
    const places = catalogueFromSnapshot(snapshot);
    const counts = nameCounts(places);
    expect(counts.total).toBe(4380);
    expect(counts.known).toBe(1064);
    expect(counts.unknown).toBe(3316);
    expect(counts.questionMark).toBe(3280);
    expect(counts.tentative).toBe(36);
    expect(counts.questionMark + counts.tentative).toBe(counts.unknown);
  });

  it("counts a tentative name as unknown, not as a confirmed name", () => {
    const counts = nameCounts([
      place({ id: "L1", title: "Parsons Hotel?, Ocean Beach", layerId: "community" }),
      place({ id: "L2", title: "?, Capri", layerId: "uncertain" }),
      place({ id: "L3", title: "Ajax Gym, Vice Beach", layerId: "community" }),
    ]);
    expect(counts).toEqual({ total: 3, known: 1, unknown: 2, questionMark: 1, tentative: 1 });
  });
});

describe("Capri gym hunting — honest, from the real data", () => {
  it("finds 0 gym tags in the snapshot outside Ajax Gym, and 230 Capri records", () => {
    const places = catalogueFromSnapshot(snapshot);
    // GTADB records only — the curated gyms carry a 'gym' tag by
    // construction, so they are not part of this claim.
    const gtadb = places.filter((p) =>
      ["community", "interiors", "shops-food", "shops-vehicles", "lootable", "uncertain"].includes(p.layerId),
    );
    const gymTagged = gtadb.filter((p) => p.tags.some((t) => /^#?(gym|fitness|workout)$/.test(t)));
    expect(gymTagged.map((p) => p.id)).toEqual(["L1869"]);
    const capri = places.filter((p) => p.title.includes("Capri") || p.region.includes("Capri"));
    // 230, not 227: the Smooth Sand meditation sits on a sandbar off
    // Capri (region "Capri, Mariana County") — the one Loot Map place
    // in Capri — plus the three Capri cards (Brianna Blue purple,
    // Pricilla Pace gold, Gouwan Marcus), whose host regions name Capri.
    expect(capri.length).toBe(246); // 230 + 16 fbrito candidate pins in Capri
    expect(capri.filter((p) => p.tags.includes("enterable")).length).toBe(12);
    expect(capri.filter((p) => p.tags.includes("residential")).length).toBe(3);
    expect(capri.filter((p) => p.tags.some((t) => /^#?(gym|fitness|workout)$/.test(t)))).toHaveLength(0);
  });

  it("isGymQuery only fires on gym words — never on equipment words", () => {
    expect(isGymQuery("gym near Capri")).toBe(true);
    expect(isGymQuery("where can I train")).toBe(true);
    expect(isGymQuery("shops in Capri")).toBe(false);
    expect(isGymQuery("")).toBe(false);
    // "work out" is equipment, not a gym: the member clubs must not
    // answer it.
    expect(isGymQuery("where can I work out")).toBe(false);
    expect(isGymQuery("gym equipment near Capri")).toBe(false);
    expect(isGymQuery("bench in Capri")).toBe(false);
  });

  it("isEquipmentQuery fires on workout / equipment / bench / weights", () => {
    for (const q of [
      "workout equipment near Capri",
      "where can I work out",
      "bench in Capri",
      "weights near me",
      "gym equipment",
      "kettlebell",
      "home gym",
      "Muscle Sands",
    ]) {
      expect(isEquipmentQuery(q)).toBe(true);
    }
    expect(isEquipmentQuery("gym near Capri")).toBe(false);
    expect(isEquipmentQuery("where can I train")).toBe(false);
    expect(isEquipmentQuery("shops in Capri")).toBe(false);
  });

  it("housesToCheck returns enterable/residential ? places nearest-first, never a gym claim", () => {
    const places = [
      place({ id: "h1", title: "?, Capri", layerId: "uncertain", position: { x: 100, y: 100 }, tags: ["enterable"], region: "Capri" }),
      place({ id: "h2", title: "?, Capri", layerId: "uncertain", position: { x: 300, y: 300 }, tags: ["residential"], region: "Capri" }),
      place({ id: "n1", title: "Named Shop, Capri", layerId: "shops-food", position: { x: 110, y: 110 }, tags: ["retail"], region: "Capri" }),
      place({ id: "n2", title: "?, Capri", layerId: "uncertain", position: { x: 120, y: 120 }, tags: [], region: "Capri" }),
      place({ id: "far", title: "?, Vice City", layerId: "uncertain", position: { x: 130, y: 130 }, tags: ["enterable"], region: "Vice City" }),
    ];
    const found = housesToCheck(places, { x: 0, y: 0 }, (p) => p.region === "Capri");
    expect(found.places.map((p) => p.id)).toEqual(["h1", "h2"]);
    expect(found.total).toBe(2);
  });

  it("nearestVerifiedGym measures from the anchor, unpositioned gyms excluded", () => {
    const places = [
      place({ id: "g1", title: "Grand Majestic Gym", layerId: "gyms", position: { x: -1035, y: -1249 }, region: "Tequesta" }),
      place({ id: "g2", title: "Venus Fitness", layerId: "gyms", position: null, region: "Ocean Beach" }),
    ];
    const nearest = nearestVerifiedGym(places, { x: -6000, y: 0 });
    expect(nearest?.place.id).toBe("g1");
    expect(nearest!.distance).toBeGreaterThan(5000);
  });

  it("Ask for a gym near Capri lists the Capri houses to check — as candidates, not gyms", () => {
    const places = catalogueFromSnapshot(snapshot);
    const result = retrieveForAsk({
      question: "Show me a gym near Capri",
      places,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.nearCount).toBe(0);
    expect(result.housesAreaName).toBe("Capri");
    // 12 enterable in Capri, but 2 are named gas stations — the 6
    // unnamed enterable "?" plus the 2 residential-tagged "?" are the
    // houses to check. Four of the old 13 gained real names upstream
    // (Capri Classics, Gibson Brothers Bank, Woodhatch Gunsmith, Still
    // Waters) and one lost its enterable tag, so the candidate list
    // shrank because GTADB resolved them, not because houses vanished.
    expect(result.housesToCheckTotal).toBe(8);
    expect(result.housesToCheck).toHaveLength(8);
    // The houses are candidates only: none of them is in the gym records.
    const recordIds = new Set(result.records.map((p) => p.id));
    for (const house of result.housesToCheck) {
      expect(recordIds.has(house.id)).toBe(false);
      expect(house.title.startsWith("?")).toBe(true);
    }
    // ...and the verdict says so in plain words.
    expect(result.proximitySummary).toMatch(/8 houses in Capri are worth checking/);
    expect(result.proximitySummary).toMatch(/None of them is a verified gym/);
  });

  it("Ask for a gym where one IS near offers no houses to check", () => {
    const places = catalogueFromSnapshot(snapshot);
    const result = retrieveForAsk({
      question: "Show me a gym near Vice City",
      places,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.nearCount).toBeGreaterThan(0);
    expect(result.housesToCheck).toHaveLength(0);
    expect(result.housesAreaName).toBeNull();
  });
});

describe("Gyms vs workout equipment — the split (user, 2026-11-23)", () => {
  it("routes 'workout equipment' to the equipment layer only, 'gym' to the gyms layer only", () => {
    const all = layers();
    expect(layersRequestedByQuestion("workout equipment near Capri", all)).toEqual([
      "equipment",
    ]);
    expect(layersRequestedByQuestion("gym near Capri", all)).toEqual(["gyms"]);
    expect(layersRequestedByQuestion("Where can I train?", all)).toEqual(["gyms"]);
    expect(layersRequestedByQuestion("bench in Capri", all)).toEqual(["equipment"]);
    // A question that asks for both gets both layers.
    expect(
      layersRequestedByQuestion(
        "Show me a gym near Capri or somewhere I can hit some strength workouts",
        all,
      ).sort(),
    ).toEqual(["equipment", "gyms"]);
  });

  it("search 'workout equipment' finds the free gear, never a member gym", () => {
    const places = catalogueFromSnapshot(snapshot);
    const equipmentOn = layers().map((l) =>
      l.id === "equipment" ? { ...l, visible: true } : l,
    );
    const found = filterPlaces(
      filterByVisibleLayers(places, equipmentOn),
      { ...DEFAULT_FILTERS, query: "workout equipment" },
      [],
      [],
      [],
    );
    expect(found.map((p) => p.id).sort()).toEqual([
      "gym:jason-house-deck",
      "gym:muscle-sands",
      "gym:starlet-motel-bench",
    ]);
    // And with only the member gyms on, "gym equipment" finds nothing —
    // a club is not equipment, and the search must not pretend it is.
    const gymsOn = layers().map((l) => (l.id === "gyms" ? { ...l, visible: true } : l));
    const gymsFound = filterPlaces(
      filterByVisibleLayers(places, gymsOn),
      { ...DEFAULT_FILTERS, query: "gym equipment" },
      [],
      [],
      [],
    );
    expect(gymsFound).toHaveLength(0);
  });

  it("Ask 'workout equipment near Capri' answers from equipment only, with the houses as candidates", () => {
    const places = catalogueFromSnapshot(snapshot);
    const result = retrieveForAsk({
      question: "Show me workout equipment near Capri",
      places,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    // No member gym in the answer at all.
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records.every((p) => p.layerId === "equipment")).toBe(true);
    // Nearest verified equipment to Capri is Jason's house deck — a long
    // way away, never presented as near.
    expect(result.nearCount).toBe(0);
    expect(result.records[0]?.id).toBe("gym:jason-house-deck");
    expect(result.proximitySummary).toMatch(/no workout equipment near capri/i);
    expect(result.proximitySummary).toMatch(/Jason's house deck/);
    expect(result.proximitySummary).toMatch(/garage in a house/);
    // Same 8 houses to check — as equipment candidates, not gyms.
    expect(result.housesKind).toBe("equipment");
    expect(result.housesAreaName).toBe("Capri");
    expect(result.housesToCheckTotal).toBe(8);
    expect(result.proximitySummary).toMatch(/None of them is verified workout equipment/);
  });

  it("Ask 'gym near Capri' still answers from the member gyms only", () => {
    const places = catalogueFromSnapshot(snapshot);
    const result = retrieveForAsk({
      question: "Show me a gym near Capri",
      places,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records.every((p) => p.layerId === "gyms")).toBe(true);
    expect(result.records.map((p) => p.id)).toContain("gym:grand-majestic");
    expect(result.housesKind).toBe("gym");
    expect(result.proximitySummary).toMatch(/None of them is a verified gym/);
  });

  it("nearestVerifiedEquipment counts a user-marked workout spot — his own data", () => {
    const places = [
      place({
        id: "gym:muscle-sands",
        title: "Muscle Sands",
        layerId: "equipment",
        position: { x: 2019, y: 407 },
        region: "Ocean Beach",
        tags: ["gym", "free", "outdoor", "equipment", "workout"],
      }),
      place({
        id: "marker:garage",
        title: "Bench in the garage",
        layerId: "my-markers",
        position: { x: -6800, y: 200 },
        region: "My markers",
        tags: ["pin", "gym", "workout", "equipment"],
        evidence: "personal",
      }),
    ];
    const nearest = nearestVerifiedEquipment(places, { x: -6857, y: 219 });
    expect(nearest?.place.id).toBe("marker:garage");
  });
});
