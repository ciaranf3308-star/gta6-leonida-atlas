import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogueFromSnapshot } from "../../src/data/catalogue";
import { BREAKABLE_HOME_PLACES } from "../../src/data/breakable-homes";
import { COLLECTABLE_CARD_PLACES } from "../../src/data/collectables";
import { GANG_OP_PLACES } from "../../src/data/gang-operations";
import { GYM_PLACES, EQUIPMENT_PLACES } from "../../src/data/gyms";
import { LOOT_MAP_PLACES } from "../../src/data/loot-map";
import { filterPlaces } from "../../src/domain/filter";

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

// v0.33 D-4 (focus cut): the "Discover Leonida" surface is gone —
// RegionalResearch.tsx and getResearchForPlace were deleted with it,
// and the two tests that covered them (place→region association,
// component render with citations) went with them, behaviour gone by
// design. What REMAINS is the research data itself: page-data.ts still
// feeds region descriptions from RESEARCH_REGIONS, so the catalogue
// test below stays — it guards live code, not the cut surface.
describe("regional research data still feeds place descriptions", () => {
  it("adds source context without changing any source coordinate or introducing discovery pins", () => {
    const catalogue = catalogueFromSnapshot(snapshot);
    expect(catalogue.length).toBe(
      snapshot.landmarks.length +
        6 +
        GYM_PLACES.length +
        EQUIPMENT_PLACES.length +
        BREAKABLE_HOME_PLACES.length +
        COLLECTABLE_CARD_PLACES.length +
        LOOT_MAP_PLACES.length +
        // 37 gang operations (v0.32 Demo C import — area-known, no pins;
        // 2 host-matched onto existing records, so +37 not +39).
        GANG_OP_PLACES.length,
    );
    const raw = snapshot.landmarks.find(
      (place: { id: string }) => place.id === "L399",
    );
    expect(catalogue.find((place) => place.id === "L399")?.position).toEqual({
      x: raw.inGameCoordinates[0],
      y: raw.inGameCoordinates[1],
    });
    expect(catalogue.some((place) => place.id.startsWith("discovery:"))).toBe(
      false,
    );
    const region = catalogue.find((place) => place.id === "region:ambrosia")!;
    expect(region.description).toMatch(/Allied Crystal/);
    expect(region.evidence).toBe("approximate");
    expect(region.position).not.toBeNull();
    // Regions are Exploration in the v0.21.0 Map Index (the game has
    // no separate "Region" filter), so this search scopes to the
    // regions layer itself — the test is about the research context on
    // region places, not the category filter.
    const search = (query: string) =>
      filterPlaces(
        catalogue,
        {
          query,
          category: "exploration",
          favoritesOnly: false,
          personalOnly: false,
          evidence: "all",
          collectionId: null,
          countyId: null,
          area: null,
          hideFound: false,
          remainingOnly: false,
          enterableOnly: false,
          lootableOnly: false,
          interiorHouseOnly: false,
          venueType: "all",
          sortNearest: false,
        },
        [],
        [],
        [],
      )
        .filter((place) => place.layerId === "regions")
        .map((place) => place.id);
    expect(search("Little Cuba")).toEqual(["region:vice-city"]);
    expect(search("Final Chapter")).toEqual(["region:ambrosia"]);
  });
});
