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
      "../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

const place = (id: string, layerId = "community"): Place => ({
  id,
  title: id,
  description: "",
  category: "exploration",
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
    expect(byId.get("shops-food")?.visible).toBe(false);
    expect(byId.get("shops-vehicles")?.visible).toBe(false);
    expect(byId.get("shops-weapons")?.visible).toBe(false);
    expect(byId.get("shops-style")?.visible).toBe(false);
    expect(byId.get("lootable")?.visible).toBe(false);
    for (const layer of DEFAULT_LAYERS) {
      if (layer.id.startsWith("cards:")) expect(layer.visible).toBe(false);
    }
    expect(byId.get("my-markers")?.visible).toBe(true);
  });

  it("gates search and results to enabled layers, never hiding personal markers", () => {
    const places = [
      place("a", "community"),
      place("b", "regions"),
      place("c", "my-markers"),
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

  it("files the named clothes / hair / shoe / tattoo shops under Style, not Robberies", () => {
    // Reported 2026-11-25: "EVERY clothes store is missing" — Kind →
    // Style showed one place (Au Courant) because the lootable check
    // ran first and the generic 'retail' tag on every named Style
    // shop is robbable. All eight named Style shops are shops-style
    // with category 'style' now; the sixteen still-unnamed Style
    // records stay 'uncertain' (or breakable for the Capri ones).
    const places = catalogueFromSnapshot(snapshot);
    const style = places.filter((p) => p.layerId === "shops-style");
    expect(style.map((p) => p.id).sort()).toEqual([
      "L1482",
      "L1488",
      "L2361",
      "L3396",
      "L360",
      "L370",
      "L3786",
    ]);
    expect(style.map((p) => p.title).sort()).toEqual([
      "A1 Fashions, El Joven Blvd, Southside, Vice City",
      "Au Courant Unisex Hair Salon, Peacock Bay, Vice City",
      "Electric Fang Tattoo, Stockyard, Vice City",
      "Kurt's Barber Shop, Route 61, Hamlet",
      "Sara's Unisex Salon, Hamlet",
      "Stock 305, Stockyard, Vice City",
      "The Old Mill Barber Shop, Millport",
    ]);
    expect(style.every((p) => p.category === "style")).toBe(true);
    // We Have Shoes is the eighth named Style shop, but it is tagged
    // 'demolished' — the uncertainty rule keeps it Unverified, and
    // this fix does not override that.
    const shoes = places.find((p) => p.id === "L1716");
    expect(shoes?.title).toMatch(/We Have Shoes/);
    expect(shoes?.layerId).toBe("uncertain");
    // And the search path works too: "clothes" finds all nine
    // #clothes records — the two named shops plus the seven "?" ones.
    const found = filterPlaces(
      places,
      { ...DEFAULT_FILTERS, query: "clothes" },
      [],
      [],
      [],
    );
    expect(found.map((p) => p.id).sort()).toEqual([
      "L1488",
      "L1504",
      "L1614",
      "L2361",
      "L2381",
      "L2383",
      "L3303",
      "L335",
      "L3747",
    ]);
  });

  it("merges the gyms into the catalogue alongside the community records", () => {
    const places = catalogueFromSnapshot(snapshot);
    expect(places).toHaveLength(4488);
    expect(places.filter((p) => p.position === null)).toHaveLength(102);
    expect(places.filter((p) => p.layerId === "gyms")).toHaveLength(8);
    expect(places.filter((p) => p.layerId === "equipment")).toHaveLength(3);
    expect(places.filter((p) => p.layerId === "interiors")).toHaveLength(83);
    expect(places.filter((p) => p.layerId === "breakable")).toHaveLength(47);
    expect(places.filter((p) => p.layerId === "shops-food")).toHaveLength(30);
    expect(places.filter((p) => p.layerId === "shops-vehicles")).toHaveLength(9);
    expect(places.filter((p) => p.layerId === "shops-weapons")).toHaveLength(0);
    // Style was 1 until v0.31.3: six more named clothes / hair /
    // shoe / tattoo shops filed under Robberies because the lootable
    // check ran first and their generic 'retail' tag is robbable. A
    // Style tag now files to shops-style first (STYLE_SHOP_TAGS).
    expect(places.filter((p) => p.layerId === "shops-style")).toHaveLength(7);
    expect(
      places.filter((p) => p.layerId.startsWith("shops-")),
    ).toHaveLength(46);
    expect(places.filter((p) => p.layerId === "lootable")).toHaveLength(47);
    expect(
      places.filter((p) => p.layerId.startsWith("cards:")),
    ).toHaveLength(37);
    expect(places.filter((p) => p.layerId === "loot-heists")).toHaveLength(29);
    expect(places.filter((p) => p.layerId === "loot-collectibles")).toHaveLength(20);
    expect(new Set(places.map((p) => p.id)).size).toBe(4488);
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

describe("Map Index categories (v0.21.0) — the game's own filters, not the data model", () => {
  const places = catalogueFromSnapshot(snapshot);

  it("files every place under the game's Map Index, with no Business or data-model categories left", () => {
    const counts = new Map<string, number>();
    for (const place of places) {
      counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
    }
    // The old set (region / landmark / nature / transport / business /
    // personal-as-markers) is gone from the catalogue entirely.
    for (const dead of ['region', 'landmark', 'nature', 'transport', 'business']) {
      expect(counts.get(dead) ?? 0).toBe(0);
    }
    expect(counts.get('activities')).toBe(12);
    expect(counts.get('collectibles')).toBe(57);
    expect(counts.get('exploration')).toBe(737);
    expect(counts.get('food-drink')).toBe(30);
    expect(counts.get('robberies')).toBe(123);
    expect(counts.get('unverified')).toBe(3415);
    expect(counts.get('vehicles')).toBe(107);
    // Style was 1 (Au Courant alone) until v0.31.3, when six named
    // clothes / hair / tattoo shops moved out of Robberies into Style.
    expect(counts.get('style')).toBe(7);
    // Honest zeroes, not invented pins: no verified Personal places
    // (safehouse / garages / ATMs) and no mapped missions yet.
    expect(counts.get('personal') ?? 0).toBe(0);
    expect(counts.get('story') ?? 0).toBe(0);
    expect(counts.get('my-markers') ?? 0).toBe(0);
  });

  it('maps layers to categories: lootable + breakable are Robberies, gyms + equipment are Activities', () => {
    for (const place of places.filter((p) => p.layerId === 'lootable' || p.layerId === 'breakable' || p.layerId === 'loot-heists')) {
      expect(place.category).toBe('robberies');
    }
    for (const place of places.filter((p) => p.layerId === 'gyms' || p.layerId === 'equipment')) {
      expect(place.category).toBe('activities');
    }
    for (const place of places.filter((p) => p.layerId === 'uncertain')) {
      expect(place.category).toBe('unverified');
    }
    for (const place of places.filter((p) => p.layerId.startsWith('cards:') || p.layerId === 'loot-collectibles')) {
      expect(place.category).toBe('collectibles');
    }
    for (const place of places.filter((p) => p.layerId === 'regions')) {
      expect(place.category).toBe('exploration');
    }
  });

  it('splits shops by the game’s filing: guns are Weapons, clothes are Style, gas is Vehicles, food is Food & Drink', async () => {
    const { shopMapIndex } = await import('../../src/data/catalogue');
    expect(shopMapIndex(['#guns'])).toBe('weapons');
    expect(shopMapIndex(['#clothes'])).toBe('style');
    expect(shopMapIndex(['#tattoos'])).toBe('style');
    expect(shopMapIndex(['#hair'])).toBe('style');
    expect(shopMapIndex(['#gas'])).toBe('vehicles');
    expect(shopMapIndex(['#modshop'])).toBe('vehicles');
    expect(shopMapIndex(["#pay'n'spray"])).toBe('vehicles');
    expect(shopMapIndex(['restaurant'])).toBe('food-drink');
    expect(shopMapIndex(['#bar'])).toBe('food-drink');
    expect(shopMapIndex(['retail'])).toBe('food-drink');
    expect(shopMapIndex(['#supermarket'])).toBe('food-drink');
  });

  it('keeps every shop layer in the game’s order: Weapons, Style, Food & Drink, Vehicles', () => {
    const byId = new Map(DEFAULT_LAYERS.map((layer) => [layer.id, layer]));
    expect(byId.get('shops-weapons')?.mapIndex).toBe('weapons');
    expect(byId.get('shops-style')?.mapIndex).toBe('style');
    expect(byId.get('shops-food')?.mapIndex).toBe('food-drink');
    expect(byId.get('shops-vehicles')?.mapIndex).toBe('vehicles');
    expect(byId.get('breakable')?.mapIndex).toBe('robberies');
    expect(byId.get('lootable')?.mapIndex).toBe('robberies');
    expect(byId.get('gyms')?.mapIndex).toBe('activities');
    expect(byId.get('equipment')?.mapIndex).toBe('activities');
    expect(byId.get('uncertain')?.mapIndex).toBe('unverified');
    expect(byId.get('my-markers')?.mapIndex).toBe('my-markers');
    // Every layer has a Map Index home — no layer is ungrouped.
    for (const layer of DEFAULT_LAYERS) {
      expect(layer.mapIndex).toBeDefined();
    }
  });

  it('migrates pre-rebuild categories instead of dropping old backups and views', async () => {
    const { migrateLegacyCategory } = await import('../../src/domain/types');
    expect(migrateLegacyCategory('business')).toBe('exploration');
    expect(migrateLegacyCategory('region')).toBe('exploration');
    expect(migrateLegacyCategory('landmark')).toBe('exploration');
    expect(migrateLegacyCategory('nature')).toBe('exploration');
    expect(migrateLegacyCategory('transport')).toBe('vehicles');
    // 'personal' is a live category now — the game's own Personal — so
    // it passes through here. A MARKER's legacy 'personal' is a
    // different thing and migrates in parseBackup, not here (see
    // atlas-backup.test.ts: a v2 marker with category 'personal'
    // restores as 'my-markers').
    expect(migrateLegacyCategory('personal')).toBe('personal');
    expect(migrateLegacyCategory('food-drink')).toBe('food-drink');
    expect(migrateLegacyCategory('bogus')).toBe('all');
    expect(migrateLegacyCategory(undefined)).toBe('all');
  });
});
