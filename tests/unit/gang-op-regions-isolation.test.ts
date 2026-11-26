import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueFromSnapshot } from "../../src/data/catalogue";
import { filterPlaces } from "../../src/domain/filter";
import type { Filters, Place } from "../../src/domain/types";
import { buildGameDatabase, type GameDatabase } from "../../src/domain/game-db";
import {
  DEFAULT_LAYERS,
  filterByVisibleLayers,
} from "../../src/features/map/layers";
import {
  gangOpLikelyAreas,
  groupLikelyAreas,
  measureGangOpBounds,
} from "../../src/features/map/likely-area";
import { DEFAULT_FILTERS } from "../../src/stores/atlas";

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

function buildFullDb(): GameDatabase {
  return buildGameDatabase({ places: catalogueFromSnapshot(snapshot) });
}

/** Catalogue places, as App's allPlaces — catalogueFromSnapshot already
 * appends GANG_OP_PLACES (catalogue.ts:317), so no second copy. */
function allPlaces(): Place[] {
  return catalogueFromSnapshot(snapshot);
}

function gangOpLayersOn(): typeof DEFAULT_LAYERS {
  return DEFAULT_LAYERS.map((layer) =>
    layer.id === "gang-op" ? { ...layer, visible: true } : layer,
  );
}

/** App's visible-places pipeline (App.tsx visiblePlaces), parameterised
 * on the filters. */
function visiblePlaces(
  places: Place[],
  filters: Filters,
  layers: typeof DEFAULT_LAYERS,
): Place[] {
  return filterByVisibleLayers(
    filterPlaces(places, filters, [], [], [], []),
    layers,
  );
}

/** App's likelyAreaPlaces (App.tsx): the same pipeline with the geo
 * isolation lifted (area + countyId nulled) — the feed MapView's
 * region computation reads. */
function regionFeed(
  places: Place[],
  filters: Filters,
  layers: typeof DEFAULT_LAYERS,
): Place[] {
  return visiblePlaces(
    places,
    { ...filters, area: null, countyId: null },
    layers,
  );
}

/** The regions with NO isolation active — the baseline the isolated
 * runs must match exactly. Counts are derived, never hardcoded:
 * the town-extent merges (lanes 4/4b) move ops between own-bounds
 * and county-fallback and regroup the rects, so pinning a number
 * here would break on every geography change. What must NOT move
 * is the isolation behaviour: the isolated run draws exactly what
 * the open map draws. */
function baselineGroups(db: GameDatabase, layers: typeof DEFAULT_LAYERS) {
  const regions = gangOpLikelyAreas(
    db.areas,
    regionFeed(allPlaces(), DEFAULT_FILTERS, layers),
    layers,
  );
  return { regions, groups: groupLikelyAreas(regions) };
}

describe("gang-op regions survive area isolation (v0.32 regions fix, lane 2)", () => {
  it("the area filter drops unpositioned gang-op places — the trap Finding 2 fell into", () => {
    const places = allPlaces();
    const isolated = filterPlaces(
      places,
      { ...DEFAULT_FILTERS, area: "Ambrosia" },
      [],
      [],
      [],
      [],
    );
    // Every gang-op place is unpositioned, so the area filter drops
    // all of them — and gangOpLikelyAreas over that feed draws nothing.
    expect(isolated.filter((p) => p.layerId === "gang-op")).toHaveLength(0);
    const db = buildFullDb();
    expect(
      gangOpLikelyAreas(db.areas, isolated, gangOpLayersOn()),
    ).toHaveLength(0);
  });

  it("the county filter drops them too — Kelly County isolates by countyId, not area", () => {
    const places = allPlaces();
    const isolated = filterPlaces(
      places,
      { ...DEFAULT_FILTERS, countyId: "kelly" },
      [],
      [],
      [],
      [],
    );
    expect(isolated.filter((p) => p.layerId === "gang-op")).toHaveLength(0);
    const db = buildFullDb();
    expect(
      gangOpLikelyAreas(db.areas, isolated, gangOpLayersOn()),
    ).toHaveLength(0);
  });

  it("the region feed — same pipeline, geo filters lifted — keeps every drawable region under a Kelly isolation", () => {
    const db = buildFullDb();
    const layers = gangOpLayersOn();
    const feed = regionFeed(
      allPlaces(),
      { ...DEFAULT_FILTERS, countyId: "kelly" },
      layers,
    );
    // The feed is the geo-UNfiltered pipeline: every drawable op
    // survives, so the region computation sees all of them.
    const regions = gangOpLikelyAreas(db.areas, feed, layers);
    expect(regions).toHaveLength(measureGangOpBounds(db.areas).drawn);
    const groups = groupLikelyAreas(regions);
    // Isolation must change NOTHING about the regions: same groups,
    // same labels as the open map.
    const baseline = baselineGroups(db, layers);
    expect(groups.map((g) => g.label).sort()).toEqual(
      baseline.groups.map((g) => g.label).sort(),
    );
    expect(groups.map((g) => g.areas.map((a) => a.placeId).sort())).toEqual(
      baseline.groups.map((g) => g.areas.map((a) => a.placeId).sort()),
    );
    // The Kelly region itself is still drawn under the Kelly page:
    // whichever ops the current town merges leave on the county
    // rect, that group — label included — survives isolation.
    const kelly = groups.find((g) =>
      (g.label ?? "").includes("Kelly County extent (estimate)"),
    );
    const baselineKelly = baseline.groups.find((g) =>
      (g.label ?? "").includes("Kelly County extent (estimate)"),
    );
    expect(kelly).toBeDefined();
    expect(kelly!.label).toBe(baselineKelly!.label);
    expect(kelly!.bounds).toEqual(db.areas.get("county:kelly")?.bounds);
  });

  it("the region feed keeps the Kelly region under an unrelated area isolation (Ambrosia)", () => {
    const db = buildFullDb();
    const layers = gangOpLayersOn();
    const feed = regionFeed(
      allPlaces(),
      { ...DEFAULT_FILTERS, area: "Ambrosia" },
      layers,
    );
    const regions = gangOpLikelyAreas(db.areas, feed, layers);
    expect(regions).toHaveLength(measureGangOpBounds(db.areas).drawn);
    const kelly = regions.find((r) => r.countyName === "Kelly County");
    expect(kelly).toBeDefined();
    expect(kelly!.bounds).toEqual(db.areas.get("county:kelly")?.bounds);
  });

  it("the region feed still respects the layer switch: layer off draws nothing", () => {
    const db = buildFullDb();
    const feed = regionFeed(allPlaces(), DEFAULT_FILTERS, DEFAULT_LAYERS);
    expect(gangOpLikelyAreas(db.areas, feed, DEFAULT_LAYERS)).toHaveLength(0);
  });

  it("the region feed still respects the other filters: a non-matching query hides the regions", () => {
    const db = buildFullDb();
    const layers = gangOpLayersOn();
    // Only the geo isolation is lifted — a query that matches no
    // gang-op place still empties the region feed, as before.
    const feed = regionFeed(
      allPlaces(),
      { ...DEFAULT_FILTERS, query: "zzzz-no-such-place" },
      layers,
    );
    expect(feed.filter((p) => p.layerId === "gang-op")).toHaveLength(0);
    expect(gangOpLikelyAreas(db.areas, feed, layers)).toHaveLength(0);
  });

  it("isolation still hides other areas’ positioned pins — only the region feed is geo-free", () => {
    const places = allPlaces();
    const isolated = filterPlaces(
      places,
      { ...DEFAULT_FILTERS, area: "Ambrosia" },
      [],
      [],
      [],
      [],
    );
    const positioned = isolated.filter((p) => p.position);
    expect(positioned.length).toBeGreaterThan(0);
    // Every positioned place left is an Ambrosia place — nothing
    // from Vice City or anywhere else leaks through the isolation.
    for (const place of positioned) {
      expect(
        place.region === "Ambrosia" || place.region.endsWith(", Ambrosia"),
      ).toBe(true);
    }
    expect(
      places.filter((p) => p.position && p.region === "Vice City").length,
    ).toBeGreaterThan(0);
    expect(positioned.some((p) => p.region === "Vice City")).toBe(false);
  });
});
