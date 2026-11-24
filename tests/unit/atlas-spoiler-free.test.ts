import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueFromSnapshot } from "../../src/data/catalogue";
import { GYM_PLACES, EQUIPMENT_PLACES } from "../../src/data/gyms";
import { filterPlaces } from "../../src/domain/filter";
import { DEFAULT_FILTERS } from "../../src/stores/atlas";
import type { Place } from "../../src/domain/types";
import {
  DEFAULT_LAYERS,
  filterByVisibleLayers,
} from "../../src/features/map/layers";

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../public/assets/street-leonida/maps/gtadb-landmarks-d406fea.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

const place = (id: string, layerId = "community"): Place => ({
  id,
  title: id,
  description: "",
  category: "landmark",
  position: { x: 0, y: 0 },
  layerId,
  tags: [],
  region: "",
  source: { title: "Test", url: "" },
  evidence: "approximate",
});

describe("Spoiler-free defaults", () => {
  it("starts with every public layer off and only personal markers on", () => {
    const byId = new Map(DEFAULT_LAYERS.map((layer) => [layer.id, layer]));
    expect(byId.get("regions")?.visible).toBe(false);
    expect(byId.get("community")?.visible).toBe(false);
    expect(byId.get("uncertain")?.visible).toBe(false);
    expect(byId.get("gyms")?.visible).toBe(false);
    expect(byId.get("equipment")?.visible).toBe(false);
    expect(byId.get("interiors")?.visible).toBe(false);
    expect(byId.get("shops")?.visible).toBe(false);
    expect(byId.get("lootable")?.visible).toBe(false);
    for (const layer of DEFAULT_LAYERS) {
      if (layer.id.startsWith("cards:")) expect(layer.visible).toBe(false);
    }
    expect(byId.get("personal")?.visible).toBe(true);
  });

  it("gates search and results to enabled layers, never hiding personal markers", () => {
    const places = [
      place("a", "community"),
      place("b", "regions"),
      place("c", "personal"),
    ];
    expect(
      filterByVisibleLayers(places, DEFAULT_LAYERS).map((p) => p.id),
    ).toEqual(["c"]);
    const withCommunity = DEFAULT_LAYERS.map((layer) =>
      layer.id === "community" ? { ...layer, visible: true } : layer,
    );
    expect(
      filterByVisibleLayers(places, withCommunity).map((p) => p.id),
    ).toEqual(["a", "c"]);
  });
});

describe("Gyms and Workout equipment layers", () => {
  it("lists eight member gyms with a source on every pin", () => {
    expect(GYM_PLACES).toHaveLength(8);
    expect(new Set(GYM_PLACES.map((g) => g.id)).size).toBe(8);
    for (const gym of GYM_PLACES) {
      expect(gym.layerId).toBe("gyms");
      expect(gym.source.url).toMatch(/^https:\/\//);
      expect(gym.tags).toContain("gym");
    }
  });

  it("positions six member gyms and leaves two unpositioned instead of guessing", () => {
    expect(GYM_PLACES.filter((g) => g.position !== null)).toHaveLength(6);
    const unpositioned = GYM_PLACES.filter((g) => g.position === null).map(
      (g) => g.id,
    );
    expect(unpositioned.sort()).toEqual(["gym:venus", "gym:vice-seven"]);
  });

  it("keeps the free workout equipment in its own layer, separate from the member gyms", () => {
    expect(EQUIPMENT_PLACES.map((g) => g.id).sort()).toEqual([
      "gym:jason-house-deck",
      "gym:muscle-sands",
      "gym:starlet-motel-bench",
    ]);
    for (const gym of EQUIPMENT_PLACES) {
      expect(gym.layerId).toBe("equipment");
      expect(gym.tags).toContain("free");
      // Equipment answers an equipment search; member gyms must not.
      expect(gym.tags).toContain("equipment");
      expect(gym.tags).toContain("workout");
    }
    // Nine gyms in total: eight member gyms plus free Muscle Sands.
    expect(GYM_PLACES.length + 1).toBe(9);
  });

  it("lists the Starlet Motel bench by name only — no invented pin", () => {
    const bench = EQUIPMENT_PLACES.find((g) => g.id === "gym:starlet-motel-bench");
    expect(bench).toBeDefined();
    expect(bench!.position).toBeNull();
    expect(bench!.region).toMatch(/Port Gellhorn/);
    expect(bench!.description).toMatch(/No verified coordinates yet/);
  });

  it("merges the gyms into the catalogue alongside the community records", () => {
    const places = catalogueFromSnapshot(snapshot);
    expect(places).toHaveLength(3781);
    expect(places.filter((p) => p.position === null)).toHaveLength(99);
    expect(places.filter((p) => p.layerId === "gyms")).toHaveLength(8);
    expect(places.filter((p) => p.layerId === "equipment")).toHaveLength(3);
    expect(places.filter((p) => p.layerId === "interiors")).toHaveLength(77);
    expect(places.filter((p) => p.layerId === "breakable")).toHaveLength(52);
    expect(places.filter((p) => p.layerId === "shops")).toHaveLength(39);
    expect(places.filter((p) => p.layerId === "lootable")).toHaveLength(52);
    expect(
      places.filter((p) => p.layerId.startsWith("cards:")),
    ).toHaveLength(5);
    expect(new Set(places.map((p) => p.id)).size).toBe(3781);
  });
});

describe("Found / progress filtering", () => {
  it("hides found places and supports a remaining-only view", () => {
    const places = [place("a"), place("b")];
    const visited = ["a"];
    expect(
      filterPlaces(
        places,
        { ...DEFAULT_FILTERS, hideFound: true },
        [],
        [],
        [],
        visited,
      ).map((p) => p.id),
    ).toEqual(["b"]);
    expect(
      filterPlaces(
        places,
        { ...DEFAULT_FILTERS, remainingOnly: true },
        [],
        [],
        [],
        visited,
      ).map((p) => p.id),
    ).toEqual(["b"]);
    expect(
      filterPlaces(places, DEFAULT_FILTERS, [], [], [], visited).map(
        (p) => p.id,
      ),
    ).toEqual(["a", "b"]);
  });
});
