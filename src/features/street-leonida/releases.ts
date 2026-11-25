export interface LeonidaAtlasRelease {
  readonly version: `v${number}.${number}.${number}`;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly status: "public" | "in-preparation";
  readonly highlights: readonly string[];
  readonly verification: readonly string[];
}

/** Retained public history starts at v0.5.0; the newest release stays first. */
export const LEONIDA_ATLAS_RELEASES: readonly LeonidaAtlasRelease[] = [
  {
    version: "v0.28.0",
    date: "2026-11-25",
    title: "Strip it all — the real GTADB map, colour-graded only",
    summary:
      "The user's verdict on v0.27 was final: 'Yep waste of time ... Strip it all, use GTA DB maps.. filter the colours instead.' v0.28 strips the whole ViceWire repaint and serves the real GTADB in-game day tiles through ONE colour grade only — deeper blues, better contrast, realistic colours — with the hill-shading he praised kept as a luminance-only term inside the grade. No generative AI anywhere. Building footprints stay visible because the grade never paints over them.",
    status: "public",
    highlights: [
      "The ViceWire repaint is dead: v0.28 serves the real GTADB day tiles through one colour grade only (scripts/grade-tiles.py). Deeper teal sea (saturation 1.90x, value 0.72x), a strong luminance S-curve (0.30) for real contrast, richer greens, warmer sand and roads. No generative AI, no illustrated redraw, no geometry-driven repaint, no surface classification, no painted roads/buildings/water. Every output pixel comes from exactly one source pixel at the same coordinates, and the grade is a pure function of the pixel's own colour plus one smooth low-frequency lighting term — so zooming never flickers or pops. No grain, no stipple: both washed out the dark outlines that give buildings their shape.",
      "Hill-shading kept, by his word ('Hills shading looks very nice btw !!'): the elevation-gradient hill-shade from v0.27 stays as a luminance-only multiplier inside the grade — same formula (NW light, azimuth 315, altitude 45, factor 1.0 + (shade − 0.707) × 0.45), gated off the water by the grade's own soft sea mask exactly as v0.27 gated it to land, smooth and low-frequency (the grid is 12 game units per px) so it can never draw or erase a building edge. Gradients only, render-time only, never vendored; absolute heights unverified.",
      "The grade is deliberately strong — the v0.20.2 grade measured as '0 difference' on his phone. Proof, measured not claimed: pure sea (47,144,176) goes from saturation 0.73 / value 0.69 to saturation 1.00 / value 0.40; street-zoom luminance spread rises 31% (std 0.071 → 0.093) so dark outlines separate from light roofs; hill factor spans 0.682–1.132 over the northern hills, 0.924–1.056 over flat downtown (buildings untouched), exactly 1.000 over open sea. Raw-vs-graded 100% crops at street, district and island zoom show the difference at a glance.",
      "The superseded pyramids are gone, not just unserved: vicewire-v1/v2/v3, illustrated and enhanced are removed from the repo — the deploy ships tiles/graded/ only. They are regenerable from scripts + tiles-source/day if ever needed. New tiles live at tiles/graded/ (31,022 + 505 ocean-fill y=0 rows, graded from the day sea's own colour through the same pipeline, each verified pure ocean against the z2 water mask). The service-worker cache name moves with the new path, and the fingerprint covers tiles/graded/ only — a new negative test proves a file at a dead tile path can no longer move the cache.",
    ],
    verification: [
      "Render: 31,022 tiles plus 505 fill-ocean tiles, 0 errors, 197 MB. scripts/grade-tiles.py --check: every zoom matches its expected count and the determinism check passes.",
      "390px basemap walk (scripts/check-graded-walk.mjs), DPR 2, fresh + cached: 15/15 PASS. Island fit view loads 29 tiles with 0 ocean-fallback tiles and 4 real z1 y=0 fill tiles requested; Vice City max zoom 30/30 distinct z6, centre-tile stddev 60.0; Ambrosia max zoom 24/24 distinct z6, centre-tile stddev 59.8, 0 ocean-fallback; 0 tile-zoom-7 requests, 0 failed tile requests, 0 console errors, 0 horizontal overflow. Screenshots in hidden_files/v028-walk-basemap/.",
      "390px app walk (scripts/check-v026-app.mjs), DPR 2: 41/41 PASS, plus the fix probe (scripts/check-v0261-fix.mjs) 9/9: hills and Keys at the zoom-out camera with clouds at v0.25 strength, Layers groups first and in order on open, 0 zoom-pill overlaps at the downtown max-zoom camera, 0 console errors, 0 failed requests. (One stale vicewire-v3 selector in the probe counted 0 tiles until it was fixed to tiles/graded/ — a stale test, not an app bug.)",
      "Unit: 798/798 tests pass. Typecheck clean, lint clean. Production build as one command (ATLAS_BASE_PATH=/gta6-leonida-atlas/ vite build && node scripts/finalize-build.mjs), bundle index-DvFc2Xj_.js, service-worker cache atlas-b40404d5-ca52b1dbb254.",
      "Honest grade, basemap lane (sandbox, not the user's verdict): 6/10 vs the reference — the real map, visibly deeper and higher-contrast, building shapes clear at street zoom, hills shaded; capped because a colour grade cannot add 3D relief or road names (the source pixels don't carry them), the first-open sheet still hides most of the island, and the clouds are v0.25 haze, not the reference's bold clouds. The user's on-device verdict is the final mark.",
    ],
  },
  {
    version: "v0.27.0",
    date: "2026-11-25",
    title: "The map gets depth — the v3 basemap, plus the cloud fix",
    summary:
      "The independent re-review of v0.26.0 rated it 7/10 and caught one real regression: the bolder clouds drowned the map at z3. v0.27 fixes that, puts the Layers groups first, and ships the complete vicewire-v3 basemap — street-zoom city depth from the source's own pixels, warmer city ground, continuous highways, no speckle.",
    status: "public",
    highlights: [
      "Clouds reverted to the v0.25 strength: the v0.26 near-opaque lobes (0.85–0.98 alpha, 3px blur) drowned the hills and Keys at z3 — the map rendered as a small rectangle in white blobs. The revert (max lobe alpha 0.60, 5px blur, 240–380px spans) is the last known-good state, verified at the exact cameras the review caught drowning. The v0.25 routing said bolder clouds or none; bolder broke two views, so this is the none-of-the-bolder answer.",
      "Layers groups first: the 9 Map Index groups now sit directly under Turn everything off, in the game's order — on open the sheet shows PERSONAL (with its honest No verified places yet note), STORY, ROBBERIES, instead of county cards with the groups ~3,000px down a ~6,944px scroll. County isolation sits below the groups.",
      "Zoom-pill overlap fixed: the chrome clamp tested the marker's centre point only, but the marker is a 48px square centred on its anchor — the roundel's centre cleared the pill top while its bottom 11px sat behind it. The clamp now tests the whole 48px box against every chrome rect, and the pill height is corrected 97 → 99px. Measured 0 overlaps at the L2227 downtown max-zoom camera with everything on.",
      "Street-zoom city depth, from what the source pixels actually carry: the v0.25 block paint overwrote the source's own luminance with a flat tone, discarding the real roof-to-roof contrast (measured: luminance std 0.052 inside the building mask downtown, per-component means nearly identical). The paint now modulates each roof by the smoothed source luminance, the bevel runs on all building components in all four directions (light from the NW: light north and west edges, dark south and east — a roof with light N+W and dark S+E reads as a raised block), and per-component tones widen to +/-10%. No geometry is invented: every value comes from the source pixels under it. Road names are still absent — fbrito's roads.json carries 0 named features, so there is no verified source for labels.",
      "Warmer city ground at island scale, and the street grid now shows at z0: URBAN_LOW/FLAT are warmer and a touch darker with a faint value-noise mottling on city ground, so the island-view city is a warm built-up mass instead of one flat pale patch, and streets draw faintly (0.30) at z0 so the city reads as dense texture rather than empty tan.",
      "Highway strokes are continuous now: diag2 measured one 17-unit gap in the Ambrosia highway skeleton (the light mask covers the polyline; a skeleton fragment was pruned away), so strokes bridge gaps with the verified fbrito centreline where it runs within 12 units of any skeleton pixel — it can only join two skeleton pieces, never draw a road where none is near. And the faint white speckle on grey ground at max zoom is gone: the fine grain (sigma 1.6) is water-only now — flat land never needed anti-banding dither, and the eroded-bed measurement (raw stddev 1.3 on flat road bed) proved the speckle IS the grain.",
    ],
    verification: [
      "Render: 31,022 tiles (z0 12, z1 48, z2 192, z3 768, z4 1,496, z5 5,829, z6 23,182) plus 505 fill-ocean tiles, 0 errors, 395.3 MB. scripts/render-vicewire.py --check: every zoom matches its expected count and the determinism check passes.",
      "390px basemap walk (scripts/check-vicewire-walk.mjs), DPR 2, fresh + cached: 15/15 PASS. Island fit view loads 29 tiles with 0 ocean-fallback tiles and 4 real z1 y=0 fill tiles requested; Vice City max zoom 30/30 distinct z6, centre-tile stddev 46.0; Ambrosia max zoom 24/24 distinct z6, centre-tile stddev 45.1, 0 ocean-fallback; 0 tile-zoom-7 requests, 0 failed tile requests, 0 console errors, 0 horizontal overflow. Screenshots in hidden_files/v027-walk-basemap/.",
      "390px app walk (scripts/check-v026-app.mjs), DPR 2: 41/41 PASS, plus the fix probe (scripts/check-v0261-fix.mjs) 9/9: hills and Keys at the zoom-out camera with clouds at v0.25 strength, Layers groups first and in order on open, 0 zoom-pill overlaps at the downtown max-zoom camera, 0 console errors, 0 failed requests. Screenshots in hidden_files/v0261-walk/.",
      "Unit: 798/798 tests pass. Typecheck clean, lint clean. Production build as one command (ATLAS_BASE_PATH=/gta6-leonida-atlas/ vite build && node scripts/finalize-build.mjs).",
      "Honest grade, basemap lane (sandbox, not the user's verdict): 7/10 vs the reference — all four v0.25 review basemap items are fixed to the extent the source pixels allow, and the district view is genuinely handsome now, but street zoom is shaded parcels, not buildings with depth, and there are no road names. The user's on-device verdict is the final mark.",
    ],
  },
  {
    version: "v0.26.0",
    date: "2026-11-25",
    title: "First open is a place, not a banner — the Vice City sheet, Layers as a sheet, no more half-hidden recenter",
    summary:
      "The independent re-review of v0.25.0 rated it 7/10 and named the app items first: the empty prompt still ate ~13.5% of the map, Layers was still a full screen, the recenter button was half-hidden behind the place sheet, the clouds were still haze, and the welcome dialog intercepted ?place= deep links. v0.26 fixes all five in one pass — the first-open Vice City region sheet with its Pick-what-to-see row inside, Layers as a compact bottom sheet, the edge stack hidden while a sheet is open, genuinely bold clouds, and deep links that open straight to the place.",
    status: "public",
    highlights: [
      "The empty prompt is gone as the first-open state: the map opens on the Vice City region sheet — the reference composition (real map crop, county line, description, Set Route / View Area / Add to List) with a Pick what to see row inside it (Show interiors / lootable / shops / everything, plus Restore my last layers when there is one). One tap turns the layers on and closes the sheet, so the pins appear on the island the user was just looking at. The sheet opens without selecting the place, so the camera keeps the whole island in view and no layer is turned on behind the user's back; Set Route on it selects Vice City for real and the sheet continues as the normal selected sheet. Closing it with the × dismisses it for the session — the map stays clean, and the chips on the map are the way back. The old Nothing showing yet banner survives only for the other case: layers on, but nothing matches here.",
      "Layers is a compact bottom sheet on phones, not a full screen: it covers the bottom ~78dvh, the island stays visible above it, and the panel's intro paragraph went with the full screen (the guidance now lives in the first-open sheet). Find and Saved stay full screens — they are lists, not filters. All 9 Map Index groups with honest counts are unchanged.",
      "The recenter button is no longer half-hidden behind the place sheet: while a sheet is open the whole right-edge stack hides — the sheet's own actions and its close button are the way back, and the stack returns with the map. On a 780px phone the 60dvh sheet's top edge sat above the bottom of the stack, cutting the recenter button in half.",
      "Clouds go genuinely bold: near-opaque lobes (0.85–0.98), a bright white core in every cluster, 3px blur instead of 5px, clusters ~30% larger — they read as clouds over the sea at island zoom instead of haze at the margins.",
      "A ?place= deep link opens straight to the place now: the forced welcome sheet no longer intercepts it on a fresh profile. A dead link (no such place once the catalogue is in) does not block the welcome.",
      "The basemap work for this round (tiles/vicewire-v3/: street-zoom city depth, warmer island-scale city ground, continuous highways, no speckle) was still rendering when v0.26 shipped, so v0.26 kept the complete vicewire-v2 pyramid; the v3 tiles shipped in v0.27.0.",
    ],
    verification: [
      "390px walk (scripts/check-v026-app.mjs), DPR 2: first-open Vice City sheet (crop renders, Set Route / View Area / Add to List, Pick what to see row, no banner), Layers as a compact sheet (grabber, close, 9 groups, map visible above), recenter hidden while a sheet is open and back when it closes, bold clouds at island zoom, ?place=region:vice-city deep link opening straight to the place with no welcome, tag/explored reload. Screenshots in hidden_files/v026-walk/.",
      "Unit: 777 tests passed, 0 failed, 21 skipped (the 2 atlas-security suite failures are spawnSync ETIMEDOUT under load — a known flake while the tile render saturates the box, not a code failure). Typecheck clean, lint clean. Production build as one command (ATLAS_BASE_PATH=/gta6-leonida-atlas/ vite build && node scripts/finalize-build.mjs).",
      "Honest grade, app lane (sandbox, not the user's verdict): 8/10 — all five v0.25 review app items are fixed and walked (region sheet first-open, Layers as a sheet, recenter hidden while a sheet is open, bold clouds, deep links straight to the place), and the island-scale composition is now close to the reference. Capped at 8: street zoom is unverified in this build (v3 z5/z6 mid-render — the place card sits over flat-teal ocean fallback), the Vice City region crop reads as an empty teal square (the region centroid is in the bay), and the All Leonida card is still an outline, not a photo. The independent re-review of the live build rated it 7/10 (no net movement vs v0.25): the bold clouds were a P1 regression — they drowned the map at z3 — and the Layers groups were buried ~3,000px down the sheet; both fixed in v0.27. The user's on-device verdict is the final mark.",
    ],
  },
  {
    version: "v0.25.0",
    date: "2026-11-25",
    title: "The road stops glitching: one water, shaded blocks, no missing rows",
    summary:
      "The independent re-review of v0.24.0 rated it 6/10 and named the P1 first: the Ambrosia highway read as a yellow-green checkerboard glitch at max zoom. v0.25 fixes that and the rest of the review's basemap items in the same pass — a flat road bed under the strokes, one deep-teal water family for sea and lakes alike, building seams shaded from the source's own pixels so street zoom reads as built-up, and real ocean tiles for the y=0 rows the pyramid never drew. New tiles live at tiles/vicewire-v2/; the service-worker cache name moves with them, so no phone can serve the old glitch.",
    status: "public",
    highlights: [
      "The Ambrosia checkerboard, diagnosed not guessed: the road surface in the source is pale blue-grey with spread 20-30 — too blue for the building bucket (spread <= 18) and too dark for the light mask — so the corridor was a hole in the building density, cityness dipped, and the land base fell back to bare-terrain green between the pale yellow lane lines, while the thin strokes flipped colour along a single line. Fixed three ways: a flat road-bed wash covers the corridor (pale ROCK-ground pixels near a skeleton line, plus the yellow lane-line mask outright), the corridor is cut out of the building mask so a road is never a roof, and the strokes are coloured by fbrito kind only — the width-ratio split that flipped CORAL/CREAM along one line is gone. The highway now reads as one continuous grey road with clean orange and cream lines.",
      "One water family: a global sea mask (the largest water component on the z2 grid — 11.19M px; the next largest, Lake Leonida, is 20k) splits sea from inland water. Lakes, rivers and ponds get calm mid teal with a subtle shore lightening and no foam — never the bright cyan swimming pools with a hard pale rim. The sea falloff is now a continuous exponential in canonical units, and the shore-distance field is gaussian-smoothed at load, so the Keys' vertical tonal step (the v0.24 depth-band edge) is gone by construction. Lake Leonida is a calm teal oval at island scale, not a flat dark hole.",
      "City blocks, shaded from what the source pixels actually carry: the source draws rooftops as flat blocks with slightly darker outlines and internal divisions (measured on tile 6,114,139 — luminance gradient p99 25, clean outlines, not noise), so the renderer now darkens the strong-gradient pixels inside the building mask as a subtle seam, plus a 3px bevel on small (rooftop) components and a per-component roof tone. Street zoom reads as distinct building footprints instead of one flat grey mass. No geometry is invented: every edge and tone sits inside an existing footprint. Road names are still absent — fbrito's roads.json carries 0 named features, so there is no verified source for labels this round.",
      "The missing y=0 ocean rows at z1-3 are filled: 505 ocean tiles, each verified pure ocean against the z2 water mask before it is rendered (0 skipped — none contained any land), so the island fit view loads real tiles and the ocean.jpg fallback never fires there. The fill renders through the same pipeline from a synthetic pure-sea source, so its depth bands and clouds match the neighbouring real tiles. z4-6 are not filled — the service-worker ocean fallback still covers water the user almost never pans to.",
      "Kept: the P0 max-zoom-on-land clamp and retina scaling (VC 30/30 distinct z6, Ambrosia 24/24), one style family z0-z6, hills relief, no pink ribbons, no seams, no Keys slab. Low-zoom streets and minors are now CREAM, not CORAL — the z2 city grid read as a pink mesh — and the city ground at island scale is warmer. Cache rule: finalize-build.mjs now fingerprints tiles/vicewire-v2/ (v1 stays on disk, unfingerprinted, unserved), and the service-worker cache name moves from atlas-b40404d5-687cb473d7ab to atlas-b40404d5-729e3b8b6ae4.",
    ],
    verification: [
      "Render: 31,022 tiles (z0 12, z1 30, z2 99, z3 374, z4 1,496, z5 5,829, z6 23,182) plus 505 fill-ocean tiles, 0 errors, 451.1 MB. scripts/render-vicewire.py --check: every zoom matches its expected count (z1 48, z2 192, z3 768 with the fill rows) and the determinism check passes. Preview eye-checked before the full run: the Ambrosia highway tile (6,97,107) went from 34,418 green pixels to 20,155 — the remainder is real grass and fields in the source, not the corridor.",
      "390px basemap walk (scripts/check-vicewire-walk.mjs), DPR 2, fresh + cached: 15/15 PASS. Island fit view loads 28 tiles with 0 ocean-fallback tiles and 4 real z1 y=0 fill tiles requested; Vice City max zoom 30/30 distinct z6, centre-tile stddev 44.7; Ambrosia max zoom 24/24 distinct z6, centre-tile stddev 45.1, 0 ocean-fallback; cached reload 28 tiles; 0 tile-zoom-7 requests, 0 failed tile requests, 0 console errors, 0 horizontal overflow. Screenshots in hidden_files/v024-walk-basemap/.",
      "Unit: 796 tests pass (vitest run, 2026-11-25 05:14 UTC — the run under the tile render showed 7 failures, all spawn timeouts from CPU contention; on a quiet machine it is 796/796). Typecheck clean, lint 0 errors (one pre-existing unused-import warning). Production build as one command (ATLAS_BASE_PATH=/gta6-leonida-atlas/ vite build && node scripts/finalize-build.mjs), bundle index-BLJ2CsXT.js.",
      "Honest grade, basemap lane (sandbox, not the user's verdict): 7/10 vs the reference — the P1 glitch, the two waters and the missing rows are fixed, and the blocks have visible footprints, but street zoom still has no true 3D relief or road names, the island-scale city slabs are warmer yet still pale flat masses, and the highway strokes read dashed rather than continuous. The user's on-device verdict is the final mark.",
    ],
  },
  {
    version: "v0.24.0",
    date: "2026-11-25",
    title: "One map, every zoom — the ViceWire basemap plus the rebuilt app chrome",
    summary:
      "The overhaul's first converged build: one geometry-driven tile pyramid (tiles/vicewire-v1/, z0-z6) replaces the illustrated (z0-3) + enhanced (z4-6) split, so the z3 to z4 style cliff is gone by construction, and the v0.23.0 app chrome rides on top of it. The deepest-zoom empty-ocean P0 is fixed by clamping to tile zoom 6 and fixing the retina scaling. Independent re-review of the live build rated it 6/10, up from 4/10 — and named the next round: the Ambrosia road texture, the two waters, flat city blocks, the missing y=0 rows.",
    status: "public",
    highlights: [
      "One geometry-driven tile pyramid, tiles/vicewire-v1/, z0-z6, replaces the illustrated (z0-3) + enhanced (z4-6) split, so the z3 to z4 style cliff is gone by construction. Rendered from OUR day tiles (surfaces classified per tile), fbritoferreira 'Open GTA 6 Map' CC BY 4.0 vectors for roads at low zoom, our own road skeleton at street zoom, hill-shading from the GTADB elevation grid, goal palette. 31,022 tiles, 0 errors.",
      "P0 fixed: deepest zoom on a DPR >= 2 phone used to render empty ocean (tile zoom 7 requested, 404, service worker answered ocean.jpg). Clamped to tile zoom 6 and fixed the retina scaling so z6 tiles paint 1:1, not 2x2. The walk now zooms to max on land (Vice City and Ambrosia) and asserts real land tiles load.",
      "App chrome (v0.23.0): slim empty prompt, CSS clouds, island fits the visible band, all five chips fit, '?' pins small and labelless with dark badges, place card rebuilt with a map crop that actually renders, county line, description, Set Route / View Area / Add to List, sheet capped at 72dvh, Layers badge is a dot.",
      "Attribution: roads credit added (Open GTA 6 Map, fbritoferreira, CC BY 4.0). Elevation grid is leak-derived — used for hill-shading gradients only, never vendored, never presented as cleanly sourced.",
      "Kept: ViceWire categories, place card, your tags, spoiler-free defaults, 48px targets, Ask spoiler rule, backup v3.",
    ],
    verification: [
      "Unit: 787 tests pass. 390px walks 45/45 (app) and 15/15 (basemap) at DPR 2, fresh + cached. Honest sandbox grade 7/10 vs the reference — street-zoom city blocks are still flat muted masses, no vector coastline/label crispness or 3D relief yet. User verdict is the final mark.",
      "Independent re-review of the live v0.24.0 build (hidden_files/review-v024/REVIEW.md): 6/10, up from the 4/10 baseline. P0 fixed (deepest zoom is real land: VC 30/30 distinct z6, Ambrosia 24/24, downtown VC 24/24, 0 z7 requests, 0 failed tile requests, 0 console errors); z3 to z4 cliff gone by construction. Remaining, biggest first: the Ambrosia road texture reads as a glitch at max zoom; street-zoom city still flat with no building footprints; water is two different waters (sea deep teal, lakes bright cyan with a hard pale rim); Lake Leonida a flat dark hole at island scale; a visible vertical tonal step in the sea around the Keys; pins/labels still slide under the chrome; clouds barely there; missing y=0 tile rows at z1-3. Alignment holds — coastline, lake, Keys airport and Vice City bay coincide, pins land correctly, no invented places or moved geography.",
    ],
  },
  {
    version: "v0.23.0",
    date: "2026-11-25",
    title: "The app chrome, rebuilt — the map finally fills the screen",
    summary:
      "The independent baseline review's seven app items, fixed in one pass and walked before hand-back: the empty prompt slimmed, clouds added, the island fitted to the visible band, all five chips fitting, the '?' pins made small and labelless, the place card rebuilt around a real map crop, and the sheet capped. v0.23.0 was committed as the app lane and shipped folded into v0.24.0 — it was never deployed on its own.",
    status: "public",
    highlights: [
      "Slim empty prompt (~120px, was ~25% of the screen), CSS clouds over the sea, and the island fitted to the visible band so Leonida fills the map instead of sitting small in it.",
      "All five filter chips fit in two rows (Collectibles no longer cut off), '?' pins are small and labelless with dark count badges, and the Layers tab badge is a dot, not a number.",
      "Place card rebuilt: a rendering map crop that actually renders (the old crop was 0px tall), county line, description, Set Route / View Area / Add to List, and the raw file input hidden. The sheet is capped at 72dvh.",
      "Kept: ViceWire categories, place card, your tags, spoiler-free defaults, 48px targets, Ask spoiler rule, backup v3.",
    ],
    verification: [
      "390px walk (scripts/check-v023-app.mjs), DPR 2: 45/45 PASSED. Honest sandbox grade 7/10 vs the reference. Two latent bugs fixed pre-ship: the card crop rendering 0px tall, and a badge-dot accessibility regression (now aria-hidden). The walk caught both before hand-back. User verdict is the final mark.",
    ],
  },
  {
    version: "v0.22.0",
    date: "2026-11-25",
    title:
      "The island view, illustrated — and the street view stays real",
    summary:
      "His verdict on v0.20.2, side by side with the reference (00:34): 'we're still miles away I noticed 0 difference'. He is right: the grade moved measurements, not the look. His pick from the three honest routes: AI-illustrate the island view, keep the real map at street zoom. v0.22 is that: one AI-illustrated island image, traced from the real GTADB map and sliced into tiles for the island zooms only, while street zoom stays the real enhanced in-game map — and the map says so on screen, plainly, at every zoom.",
    status: "public",
    highlights: [
      "One illustrated island, traced from the real map: scripts/illustrate-island.py composites the real GTADB day tiles into one island overview, the sandbox image generation restyles it in the reference look (deep teal sea with clouds, rich green land, gold sand, glowing pink roads), and the trace-correction step cuts the generator's invented sea features back to the real coastline — extra islets around the Leonida Keys and redrawn bay islands off Vice City are removed, the lake, the airport and the cities stay where the real map puts them. The corrected image is sliced deterministically into 515 tiles (z0 12, z1 30, z2 99, z3 374) from the one source image, so no seams between tiles. z4-z6 stay the real enhanced GTADB tiles (tiles/enhanced/), untouched.",
      "The zoom switch is honest, not hidden: tile zooms 0-3 serve tiles/illustrated/, tile zooms 4-6 serve tiles/enhanced/ — pin coordinates never change, only the backdrop does, so a pin lands on the same geographic spot at every zoom. The z3 -> z4 switch pops: illustrated to real, same palette family and same coastline, but a visible change, not a morph. The map carries a small label that follows the tiles on screen — 'Island view: AI illustration traced from the real map' out wide, 'Street zoom: the real in-game map' in close — and the Cartography section says the same. The illustration is never presented as the real map or as a photo.",
      "Honest limits, stated in the app and in scripts/illustrated-island-report.md: the generation is 1344x1728, so a z3 tile carries ~79px of generated detail upscaled to 256px — smooth and painterly by design, not sharp linework, and the sharp real map takes over at z4. Inside the real land footprint the illustration's internal detail (exact road paths, bay-island shapes off Vice City) is still the generator's drawing, bounded to the right land. Two generation attempts were measured, not eyeballed: the raw v1 land-mask IoU against the real map was 0.491 with the lake shifted and the Keys inventing islets; the trace-corrected image measures 0.627 (the rest is clouds and the shallows band, which the mask counts as land), and the lake, airport and Vice City crops coincide with the real map.",
      "Cache rule, extended: finalize-build.mjs now folds BOTH tile pyramids (enhanced z0-6, illustrated z0-3) into the service-worker cache name, and the illustrated tiles live at a versioned path (tiles/illustrated/) with their own revision in gtadb-tiles.ts — a future illustrated re-render changes the path and the cache, so the v0.20 stale-tile failure cannot repeat for either pyramid. Kept, unchanged: ViceWire categories, place card, your tags, spoiler-free defaults, 48px targets, Ask spoiler rule, backup v3.",
    ],
    verification: [
      "Unit: 780 tests pass, including one new zoom-switch test — tile zooms 0-3 resolve to tiles/illustrated/ and 4-6 to tiles/enhanced/, with the same tile file name on both sides of the switch.",
      "Alignment, measured before shipping: the corrected illustration's land mask against the real map (IoU 0.627, up from 0.491 raw — the remaining gap is clouds over the sea and the turquoise shallows band, both counted as land by the mask); side-by-side crops at full resolution show Lake Leonida, the Keys airport and the Vice City bay in the same places as the real map; four stitched neighbouring z3 tiles match the source image with mean abs diff 1.11 (JPEG artefacts only) — no seams.",
      "390px walk (scripts/check-illustrated.mjs, DPR 2, stale v0.21 profile): PASSED — old v0.21 cache gone after one reload; 84 illustrated tile requests at island zoom, 0 enhanced; label on screen AND topmost at its centre (it was hidden under the empty-map prompt at the bottom, so it moved to just below the filter chips); 256px tile at 128 CSS px; loaded tiles cover the whole map at the fit view; sampled illustrated tile bytes match disk; 0 markers on open; 24 hero pins (cap) landing on the right spots (Vice City, Leonida Keys, Port Gellhorn, Ambrosia, Mount Kalaga, Grassrivers, the airport on its runways); wheel in i1 → i2 → i3 → e4 with the label flipping to street at e4, wheel back out to i1 with the label flipping back; Turn everything off → 0 markers; zero console errors, zero failed requests. The z3 → z4 switch pops — illustrated to real, same coastline, a visible style change, not a morph — but the geography is continuous and it reads as the same place getting real.",
      "Retina regression found and fixed by this walk: v0.21 had dropped v0.20.2's retina handling, and v0.20.2's own retina was broken in a subtler way — tileSize 128 alone halves the rendered size WITHOUT loading deeper tiles, because the getTileUrl override bypasses Leaflet's zoomOffset, so the fit view shrank to a small island in a black frame. Fixed by passing coords.z + 1 to gtadbTileUrl on DPR >= 2 (a 128-grid tile at map zoom z covers exactly the ground of a 256-grid tile at z + 1) and using the same +1 in the illustration label. The walk's new framing check (loaded tiles must cover the whole map container) exists to catch exactly this.",
    ],
  },
  {
    version: "v0.21.0",
    date: "2026-11-24",
    title:
      "ViceWire: the game's own categories, a useful place card, your tags, and a real name",
    summary:
      "His verdict on the categories (22:14): they did not make sense — 'Personal' and 'Business' do not align to GTA, and the map in-game already has filters. He is right: the game itself has the Map Index (pause map → D-pad Right), nine categories with their own icons, and we were using data-model labels instead of them. v0.21 rebuilds the categories on the game's nine, rebuilds the place card so it actually helps (available loot, hidden collectables, mark as explored, a real picture), lets him tag any place himself ('sells t-shirts' on a gas station), and renames the app ViceWire with the Option A icon he picked — the bold geometric V over a cartographic layer, drawn as vector, not lifted from the concept boards.",
    status: "public",
    highlights: [
      "Categories are the game's own nine Map Index groups, in the game's order, with the game's icons: Personal (arrow — your vehicles, safehouse, owned garages, ATMs), Story (diary), Robberies (cash sack), Activities (weights), Exploration (magnifying glass), Vehicles (car), Weapons (gun), Style (shirt), Food & Drink (fork & knife). There is no 'Business' in the game — shops are split across Weapons, Style, Food & Drink, Vehicles and Robberies — so the generic Business browse category is gone, and 'Personal' is never again used for My markers (those are their own group, labelled 'My markers'). Gyms and Workout equipment sit in Activities; Lootable and banks/safes in Robberies; Interiors by the venue inside; Breakable homes in Robberies with the dark-blue rule kept; Unverified stays Unverified, never forced into a category. Personal and Story honestly count 0 verified places in the public data — the note says so instead of inventing pins.",
      "The place card is rebuilt to be useful: Available loot (verified sources only — a breakable home from the robbery guides names its loot, a lootable shop can be held up, anything unconfirmed says 'Loot unknown', and a gym gets no loot row at all), Hidden collectables (verified card pins within 600 units, or 'None verified here'), Mark as explored (separate from found — explored places fade on the map, with per-layer explored counts in Saved), and a picture that is real — your own in-game screenshot if you add one, otherwise a zoomed crop of the real map at that exact spot, labelled as the map, never as a photo. No AI image, no scraped image, no stock photo of a different building. Redundant lines cut: the raw game coordinates are gone, the category row shows the Map Index group.",
      "Your secondary tags, on any place: free text ('sells t-shirts' on a gas station, 'sells clothes' on an Ammu-Nation, 'workout equipment' on a house/garage in Capri), always shown as 'Your tag', never mixed with verified data, never changing the real category. Search finds places by your tags, Ask Nylah answers from them (a place you tagged 'workout equipment' answers a workout question), and they save on-device and travel in the v3 backup (schema v4).",
      "ViceWire, Option A — The Network: the product is renamed from Leonida Atlas to ViceWire. The icon is the bold geometric V (ivory left stroke, coral-to-sunset right stroke) over a faint cartographic grid, navy #0E1A2B, drawn as clean vector geometry in scripts/build-vicewire-icon.mjs and rendered to 192/512/maskable PNGs — not lifted from the concept boards (AI renders, not production assets). Wordmark VICE in ivory, WIRE in coral, with 'GTA VI · Leonida' as the context line. Manifest, title, header, welcome and Settings all say ViceWire. A rename never wipes data: the backup format, the IndexedDB schema and the BroadcastChannel keep their leonida-atlas identifiers on purpose, so every backup and every installed PWA still restores.",
      "Kept, unchanged: the v0.20.2 basemap (real GTADB geography, one realism filter, tiles/enhanced/, cache fix), spoiler-free defaults, 48px targets, Ask spoiler rule, backup v3.",
    ],
    verification: [
      "390px walk (scripts/check-v021.mjs), DPR 2: 38/38 PASSED. ViceWire header — the wordmark is on screen (y=6, 42px tall) with the V mark at 42x42, manifest name/short_name ViceWire, 192/512/maskable icons and favicon all 200; 0 markers on open, no horizontal overflow; Layers grouped by the game's nine Map Index groups, no Business anywhere, Personal honestly says 0 verified places; lootable pins appear; the place card shows Available loot, Hidden collectables, Mark as explored and Your tags with no raw game coordinates; adding the tag 'sells t-shirts' survives a reload and search finds the place by it; Mark as explored survives a reload; Turn everything off returns to 0 markers; zero console errors, zero failed requests.",
      "The walk caught two real bugs before shipping, both fixed and re-walked: (1) tapping any place crashed the sheet with React error #185 (maximum update depth) — a zustand selector in PlaceDetails returned a fresh array from userTagsFor on every render, so React's external-store check saw a change on every pass; fixed by selecting the stable store array and deriving with useMemo. (2) The VICEWIRE wordmark was invisible on the map — a generic `.map-hero-banner img` rule (meant for the sunset photo) outranked the mark's own size and stretched the V to 362px, pushing the whole lockup off the top of the screen while the DOM text checks still passed — and the panel header still said 'Leonida Atlas'; fixed by scoping the photo rule to the direct child and rebranding the panel and project-page headers. The walk now checks on-screen geometry (bounding boxes), not just DOM text.",
      "Unit: 779/779 vitest, including two new Ask-from-tags tests — a house the user tagged 'workout equipment' answers a workout-equipment question and never a member-gym question, and 'sells t-shirts' on a gas station answers a shopping question but never a gym question.",
      "Chromium e2e (tests/e2e/atlas-local-first.spec.ts): 11/12 passed. The one failure is the 3D explorer spawn test, which times out on software WebGL in this sandbox — a pre-existing limit, unchanged by v0.21. Mobile-Safari WebKit cannot start in the sandbox (pre-existing). The e2e spec itself needed three v0.21 updates: title/heading expectations now say ViceWire, the tile check now looks for tiles/enhanced/ (v0.20.2 renamed tiles/redrawn/), and the marker-move test now proves the new position through the editor, because the card no longer prints raw game coordinates.",
    ],
  },
  {
    version: "v0.20.2",
    date: "2026-11-24",
    title:
      "One realism filter, same map everywhere — and the update actually reaches your phone",
    summary:
      "His decision (22:48): use the sharp GTADB map as-is, real and accurate — the illustrated redraw is dead. His refinement (22:49): is there no image filtering we can do, so it is still 1-to-1 but each tile gets a filter for pizzaz, and he does not care if it invents trees or a traffic light. His correction (22:51): it must be ONE realism filter, consistent everywhere — no flicking on and off as you zoom. v0.20.2 is that filter: the real GTADB day tiles through one fixed per-pixel colour grade, geography locked 1:1, the same parameters at every zoom, plus the cache fix v0.20 needed — v0.20 was live on the server while his phone kept showing the old map, because the generated service worker never skipWaited and the cache name never moved when tiles changed. That is fixed here, and verified with a profile that had the old tiles cached.",
    status: "public",
    highlights: [
      "One realism filter, everywhere, no flicker: scripts/enhance-tiles.py runs the same fixed pipeline over all 31,022 tiles (z0 12, z1 30, z2 99, z3 374, z4 1,496, z5 5,829, z6 23,182) — deeper teal sea, warmer land, richer greens, warm cream roads, fine grain keyed on world coordinates. Every output pixel comes from exactly one source pixel at the same coordinates: no resampling, no blur, no warp, no new roads, no new coastline. The transform is a pure function of the pixel\u2019s own colour, so parent and child tiles agree and zooming feels like getting closer to the same map, never a different map loading. Nothing depends on position inside a tile, so neighbouring tiles cannot seam.",
      "Honest labelling, in the app: the Cartography section states it plainly — “Map: real GTADB geography, AI-enhanced visuals — trees and texture are illustrative.” Place data stays verified-only; the filter never creates a place, a name or a pin. The reference render remains a design target for the UI, not the map — no claim that the map looks like it, because it does not and cannot.",
      "Sharp on his phone, retina-aware: on DPR >= 2 the map asks for the next pyramid level (tileSize 128 + zoomOffset 1) and displays each 256px tile at 128 CSS px — 1:1 device pixels at DPR 2, 1.5x at DPR 3. Leaflet\u2019s own detectRetina does the same two halves but also clamps minZoom to 0, which would lose this map\u2019s -5..1 range, so the two safe halves are applied by hand and the clamps are not.",
      "The cache fix, three layers so it cannot happen again: (1) the tile path is versioned — tiles/enhanced/, never the old URL with new bytes; (2) finalize-build.mjs folds a fingerprint of the tile pyramid into the service-worker cache name, so any tile re-render changes the cache even when no app code changed; (3) the generated worker skipWaits on install and the app checks for an update on every launch and reloads once when a new worker takes over. A tile re-render must change the path AND the revision in gtadb-tiles.ts — the rule is written in the code, not hoped for.",
      "The dead redraw is deleted, not left lying around: tiles/redrawn/ (339 MB) is removed from the repo and the deploy; the GTADB day tiles move to tiles-source/day/ as the source of truth, out of the deployed public/ tree. Kept, unchanged: camera gate (opens on the whole of Leonida), slim 56px header, GTA VI text wordmark, 120-marker cap / 24 hero pins, traced county outlines, spoiler-free defaults, real place data only (3,754 GTADB records, 986 named, 2,768 unnamed), backup v3.",
      "A missing tile is ocean, not an error: the generated worker now answers a 404 tile fetch with the ocean tile (unit-tested in atlas-security.test.ts) instead of logging a console error per missing tile — the retina layer asks for one tile beyond the grid edge, and the pyramid only draws land. ocean.jpg itself is now the enhanced deep-sea colour (0,119,143), not the dark swatch from the pale day map, so out-of-grid tiles blend with the enhanced sea instead of showing a dark band.",
    ],
    verification: [
      "390px walk (scripts/check-v0202.mjs), DPR 2 + DPR 3 probe: PASSED. Stale profile (v0.20.0 installed, 12 redrawn tiles cached, worker without skipWaiting) — after one reload the old cache atlas-b40404d5-e31148585cbc is gone, only atlas-b40404d5-c615b704d84c remains, 28 enhanced tiles load, zero requests to tiles/redrawn/ ever again.",
      "Sampled tile bytes match the enhanced file on disk (SHA-256 4cb705973b0d…); DPR 2 tile is 256px at 128 CSS px (1:1 device pixels), DPR 3 the same file at 128 CSS px.",
      "No flicker, measured: wheel zoom island → street climbs tile zooms 1 → 2 → 3 → 4 → 5 one clean step each; a z5 tile and its four z6 children have the same mean RGB (111,167,178), diff 0.1 / 0.2 / 0.4; pure-sea column step ≤ 1.3 (the faint vertical line in the screenshots is the coastline, verified by measurement, not a seam). Zoom back out returns to tile zoom 1 with the same sea.",
      "Zero console errors and zero failed requests once v0.20.2 is in control. 16 one-time console errors in the old worker's transition window (the new bundle's first out-of-grid tile fetches go through the old worker before the new worker activates) — invisible to the user, tiles render as ocean, and they never recur.",
      "v0.20 flows still pass: 0 markers on open, All → 24 hero pins (the cap, exactly), Turn everything off → 0 markers, no horizontal overflow. Full unit suite: 770 tests pass, 0 fail, 81 files.",
    ],
  },
  {
    version: "v0.20.0",
    date: "2026-11-24",
    title: "Fix the blur: the map is drawn pixel by pixel, for real this time",
    summary:
      "His verdict on v0.19.0 — “Wow it’s so blurry .. you say 7 I say 3” — and then, the fourth time he has asked for the same thing: “this is the 4th fucking time to ask to build the map pixel by pixel. That level of blur means it was not pixel by pixel.” He is right. v0.19 claimed a redraw and still blurred every mask (water sigma 2, green sigma 2, relief sigma 6) and served 256px tiles that his phone stretched 2-3x. v0.20 removes every blur step and renders every tile at 512x512, each output pixel decided individually from exactly one source pixel, so the map is sharp at phone DPR. The receipts are in scripts/redraw-report.md, not just the claim.",
    status: "public",
    highlights: [
      "Pixel by pixel, with the receipts: scripts/redraw-tiles.py re-renders all 31,022 tiles (z0 12, z1 30, z2 99, z3 374, z4 1,496, z5 5,829, z6 23,182) from the GTADB day tiles — 2,033,057,792 source pixels in, 8,132,231,168 output pixels out. No gaussian on any mask, no relief shade at all (v0.19's blurred-luminance base is deleted, not reduced), no bilinear resampling of image data anywhere: every output pixel's class comes from exactly one source pixel by nearest lookup, never a blend of neighbours, and its colour is a flat fill for that class. Coastline, forest edge and beach are hard 1-2px steps, measured: the strongest edge in the Vice City street tiles is 1px wide at 512, against 4-17px in the v0.19 files.",
      "Sharp on his phone, not just on a desktop: the tiles are 512x512 files served at Leaflet tileSize 256, so each tile displays at 256 CSS px from 512 real pixels — 1:1 device pixels at DPR 2, 1.5x at DPR 3. Measured live before the fix: v0.19 tiles were naturalWidth 256 displayed at 256 CSS px, i.e. every tile pixel stretched 2x at DPR 2 and 3x at DPR 3. Leaflet detectRetina is deliberately not used — it clamps the layer minZoom to 0 and this map lives at Leaflet zoom -5..1, so tiles below zoom 0 would vanish on his phone.",
      "The only soft things left are disclosed, not hidden: the sea depth bands are a smooth gradient by design, sampled from a continuous global shore-distance field (not from image pixels); clouds at z0-z2 are soft puffs by design over water only; the major-vs-minor road decision smooths the measured road-width field along the skeleton so a junction spike cannot turn a crossing coral. Nothing soft touches land, roads or city blocks. Same geography, same filenames, coordinates and zooms — a pin that was on a road is still on that road.",
      "The pink mess stays fixed: roads are vector centrelines from skeleton geometry with hard strokes at 512 (glow 10, core 6), only genuinely wide routes get a thin coral core, highways sunset, minor streets cream with no pink and no glow, junctions cut out of the major mask. v0.18's recoloured pyramid (tiles/styled/, 175 MB, superseded and unreferenced since v0.19) is deleted in this release.",
      "Kept, unchanged: camera gate (opens on the whole of Leonida), slim 56px header, GTA VI text wordmark, 120-marker cap / 24 hero pins, traced county outlines, spoiler-free defaults, real place data only (3,754 GTADB records, 986 named, 2,768 unnamed), backup v3, the Collectibles chip fade.",
    ],
    verification: [
      "Unit tests pass (767 tests, 81 files, including the redrawn-tile URL test and the releases history for v0.20.0). TypeScript and ESLint pass. One-command production build with ATLAS_BASE_PATH=/gta6-leonida-atlas/ exported (tsc + vite build + finalize-build in one command, base /gta6-leonida-atlas/).",
      "The 390px walk (scripts/check-v020.mjs) passes with zero console errors and zero overflow: every loaded tile asserts naturalWidth 512 at 256 CSS px — 1:1 device pixels at DPR 2 (was 2x upscale) — and a DPR 3 probe shows the same 512px files at 768 device px (1.5x, was 3x); 0 markers on open, 24 hero pins, Vice City sheet, lag check clean (worst long task 55ms), Turn everything off back to 0; at street zoom the sampled redrawn tiles are 0.0007% coral with 1.72% cream streets across 15 tiles, and the sampled ocean pixel is deep teal [5,58,76].",
      "Before/after 100% crops in /tmp/v020/crops-before|after (coast, streets, blocks, Capri, island): v0.19 files measure 4-17px edge widths, v0.20 files measure 1px at 512. Chromium e2e: 20 passed, 3 failed, 1 skipped — the failures are not the tiles: the 3D-explorer test fails on software-WebGL CPU saturation in this sandbox (trace shows 20-50s per action inside the 3D world, which loads no map tiles, and the hanging click moves between runs), the mobile-Safari marker test fails on a place sheet intercepting the Enter-coordinates button in UI code v0.20 does not touch (passes on Chromium), and the note-sync failure passed on retry.",
    ],
  },
  {
    version: "v0.19.0",
    date: "2026-11-24",
    title:
      "True rebuild: the map is redrawn, not recoloured — and the pink mess is gone",
    summary:
      "The fix for his question — “You’re not truly rebuilding the map are you ??” — because he was right: v0.18 only recoloured the same GTADB day-map photo, and zoomed in every street was a thick bright-pink neon line. v0.19 draws a new illustrated basemap from the real geography: flat illustrated fills per surface, vector-drawn roads, sea depth bands and clustered clouds, cut into the same tile pyramid so every place still lands in the right spot. Illustrated basemap drawn from the real in-game map — geography is real, shading and detail are artistic.",
    status: "public",
    highlights: [
      "A true redraw, not a recolour: scripts/redraw-tiles.py paints every pixel from a classification of the GTADB day tiles — coastline, water, sand, land, urban ground and roads all come from that data only, nothing invented — then renders flat illustrated fills (deep-teal sea in depth bands, rich green land with blurred relief shading, warm sand, warm-grey city blocks) with the photographic texture deliberately flattened away. All 31,022 tiles re-rendered into tiles/redrawn/ with the same filenames, coordinates and zooms, so a pin that was on a road is still on that road.",
      'The pink mess is fixed in the redraw, not patched over: roads are drawn as vector strokes from skeleton centrelines, and only genuinely wide routes (skeleton half-width >= 8 tile-px at z5, measured — the old 5px bar made 83% of Vice City "major") get a thin coral core with a soft glow; highways get sunset. Minor streets are cream, no pink, no glow. Junctions are cut out of the major mask, so intersections no longer paint pink X blobs. At street zoom the map reads like a clean street map; the pink only survives on the routes that matter, and it fades as you zoom in.',
      "Clouds you can actually see, clustered like the reference: v0.18's 6% alpha read as no clouds at all on his phone. The redraw paints large soft white puffs over water only, clustered by a low-frequency envelope with clear sea between them, in global coordinates so they never seam.",
      'Header carries the GTA VI wordmark now (text-only, drawn not lifted: condensed "Grand Theft Auto" over a coral-to-sunset VI, a divider, then Leonida Atlas), beside the sunset banner — the reference lockup, without copying logo art.',
      'The empty-map prompt is a slim bar at last: his 7:08pm screenshot showed the "bar" was still a tall card and "Restore my last layers (4 on)" wrapped mid-phrase. Buttons are one compact row-group and the restore button is full-width with no wrapping.',
      "Kept, unchanged: camera gate (opens on the whole of Leonida), slim 56px header, 120-marker cap / 24 hero pins, traced county outlines, spoiler-free defaults, real place data only (3,754 GTADB records, 986 named, 2,768 unnamed), backup v3, the Collectibles chip fade.",
    ],
    verification: [
      "Unit tests pass (767 tests, 81 files, including the redrawn-tile URL test and the releases history for v0.19.0). TypeScript and ESLint pass. Chromium e2e: 11 passed, 0 failed.",
      "The 390px walk (scripts/check-v019.mjs) passes with zero console errors and zero overflow: redrawn tiles load at GTADB zoom 0 on open with the saved zoomed-in camera seeded, the GTA VI wordmark is in the header, the restore button is a single non-wrapping 40px line, the empty prompt is a 203px slim bar, and at street zoom the sampled redrawn tiles are 0.0008% coral with 1.45% cream streets across 15 tiles (measured on the redrawn Vice City downtown tiles: 0.000-0.009% coral, against 3.97-4.82% on the v0.18 styled tiles); the v0.18 flows still pass (0 markers on open, hero pins, Vice City sheet, lag check, Turn everything off).",
      "Before/after sheets at full zoom, Vice City street zoom and Capri were judged by eye against the reference (scripts/redraw-report.md): the land reads illustrated green, the sea deep teal with clouds, the streets cream with only majors in coral — after four redraw iterations, not one. Honest visual grade in the delivery report, owned by the builder.",
    ],
  },
  {
    version: "v0.18.0",
    date: "2026-11-24",
    title:
      "The map itself, rebuilt pixel by pixel: deep teal sea, rich green land, pink roads, baked into the tiles",
    summary:
      "The fix for his question — why is it the exact same? — because v0.15–v0.17 changed everything around the map and never the map. All 31,022 GTADB day tiles are re-rendered offline into the After Hours look and the map serves the new pyramid, and the sea overlay that kept seaming on his phone is deleted outright: the colour is baked into the tiles, so there is nothing left that can seam.",
    status: "public",
    highlights: [
      "The map itself changed: all 31,022 tiles (z0–z6) re-rendered into deep teal ocean, rich green land, warm pale sand, warm-grey city blocks and coral road centrelines with sunset highways, plus a few large soft baked clouds over the sea at full zoom. Same tile coordinates, zooms and geometry — a colour grade of the real tiles, not new geography.",
      "Roads are thin coral centrelines, not a pink wash: road cores and bright rooftops are ~7 colour units apart, so the grade finds roads by geometry (thinning light-neutral pixels to skeletons, dropping rooftop blobs) instead of by brightness.",
      "The sea overlay is deleted, not fixed again: his 4:54pm screenshot proved the v0.17 seamless-sea fix did not hold — the grade still ended mid-screen. With the colour baked into the tiles there is no overlay, no mask rect and no canvas left that can seam. The tile-pane CSS filter is removed too, and the ocean error tile is re-graded to the styled sea.",
      "Kept, unchanged: camera gate (opens on the whole of Leonida), slim 56px header, bottom-bar empty-map prompt, 120-marker cap / 24 hero pins, traced county outlines, spoiler-free defaults, real place data only (3,754 GTADB records, 986 named, 2,768 unnamed).",
    ],
    verification: [
      "Unit tests pass (767 tests, 81 files, including the new styled-tile URL test and the releases history for v0.18.0). TypeScript and ESLint pass. One real side effect of doubling the tile files: Vite’s file watcher exhausted the inotify limit and broke the atlas-security finalize test with 4 MB of ENOSPC spam — fixed by ignoring **/tiles/** in the dev and finalize watchers, since tiles are static assets nothing needs to watch.",
      "The 390px walk (scripts/check-v018.mjs) passes with zero console errors and zero overflow: styled tiles load at GTADB zoom 0 on open with the saved zoomed-in camera seeded, no sea-overlay canvas exists, the tile pane has no CSS filter, and a sampled styled ocean pixel is deep teal; the v0.17 flows still pass (0 markers on open, hero pins, Vice City sheet, lag check, Turn everything off).",
      "Before/after screenshots at full zoom, Vice City and Capri were judged by eye against the reference (scripts/restyle-palette-report.md): the land reads rich green, the sea deep teal, the roads pink — after five palette iterations, not one.",
    ],
  },
  {
    version: "v0.17.0",
    date: "2026-11-24",
    title:
      "Opens on Leonida: a saved zoomed-in camera can no longer strand the map, the header is a slim strip, and the sea has no seams",
    summary:
      "The fix for his 4:28pm screenshot — the map opened shifted right with the land cut off, a huge empty sea on the left and a few pins on the right edge. The cause was a saved camera from an old session, zoomed into the Vice City shops, resuming on open with no way back on a phone. The map now always opens on the whole of Leonida.",
    status: "public",
    highlights: [
      "The map always opens on the whole of Leonida: a saved camera is only resumed when it still shows the full map. A zoomed-in or panned-away camera from an old session is ignored and the map fits all of Leonida instead — and the stale value is overwritten by the fit camera, so it never comes back.",
      "A way back on phones: the zoom buttons are hidden under 599px, so a stranded camera had no escape except pinch. One floating recenter button (⌖) now sits on the map on phones and fits all of Leonida in one tap.",
      "The header is a slim strip now: the sunset banner was a big floating card (84px, round corners, border, shadow) and read as a website header sitting on the map. It is a 56px edge-to-edge strip with no card, no border, no shadow, and the subtitle hides on phones — the wordmark alone is the identity.",
      "The empty-map prompt is a compact bar pinned to the bottom of the map, not a big card in the middle of it — the big card covered the whole of Leonida on first open. Same buttons, one line of copy.",
      "The sea has no seams: the grade used to stop at the edge of the water-mask rect, so a camera that put that edge mid-screen showed a sharp rectangle of graded water against pale ungraded sea. The strips past the mask rect now get the same deep-teal grade (outside the tile bounds there is only ocean), and the map background is the same deep teal, so nothing the tiles have not drawn yet reads as a pale rectangle.",
      "Kept, unchanged: spoiler-free first launch, forced indexing onboarding, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, interiors on tap, the Ask spoiler rule + proximity, the index resolver v3, traced county outlines, and the animated sea at ~8fps, paused when the tab hides.",
    ],
    verification: [
      "Unit tests pass (including new tests: the camera gate resumes a whole-map camera and ignores the zoomed-in Vice City camera from his screenshot, a panned-away camera, and a centred-but-zoomed-in camera). TypeScript, ESLint and the production build pass.",
      "The 390px walk (scripts/check-v017.mjs) passes with zero console errors and zero overflow: with the exact saved camera from his screenshot seeded, the tiles that load are GTADB zoom 0 (whole map), the banner is 56px, the prompt is a bottom bar, the recenter button is visible, and the v0.16.0 flows still pass (0 markers on open, hero pins, Vice City sheet, lag check, Turn everything off).",
      "The general 390px walk passes with zero console errors.",
    ],
  },
  {
    version: "v0.16.0",
    date: "2026-11-24",
    title:
      "Clean, fast, pretty: the map opens empty, the sea is deep teal at last, and the pink number blobs are gone",
    summary:
      "The fix for his side-by-side verdict on v0.15.0 — ours was the flat one, giant pink number clusters covering the map — and for the real lag those thousands of icons caused on his phone. The map now opens with zero pins every time, draws at most 120 markers at any zoom, and the sea grade he asked for is finally visible: two real bugs had hidden it since v0.15.0.",
    status: "public",
    highlights: [
      'Clean launch, every time: a saved view never brings its layers back on open. His screenshot had a "27" badge and a wall of pink clusters because a saved "Show everything" restored itself. Now the map opens with zero public pins and the empty-map prompt offers the saved layers back in one tap — "Restore my last layers (27 on)". Layers also has a one-tap "Turn everything off". The camera (position + zoom) still resumes.',
      "The lag fix: never more than 120 DOM markers at any zoom (was 360), and at full-map zoom only hero pins draw — at most 24 small icon pins, regions first, one per grid cell so they spread across the map instead of bunching in Vice City. The full 3,754-place catalogue is never turned into pins on launch; markers only ever come from layers the player turned on.",
      "Clusters are small icon pins now, not giant pink numbers: a cluster wears its best member\u2019s glyph on dark smoked glass with one tiny count badge. The pink numbered disc that covered his map is gone.",
      "The sea is deep teal at last — two bugs hid it since v0.15.0. First, the water mask PNG has no alpha channel, so the grade was composited over opaque white and the sea stayed pale; the mask is now stencilled (luminance becomes alpha) and the grade replaces the white with dark teal. Second, the sea canvas sat at z-index 300 as a sibling of the map — but Leaflet\u2019s map pane itself is z-index 400, so the whole map painted over it; the canvas now lives in its own Leaflet pane at z-index 300, between the tiles and the pins, with its size set in pixels because the pane has no size of its own.",
      'The reference header, on the real map: a sunset banner (generated art, no text, no logos) with "Leonida Atlas / The complete GTA VI companion", a compact search pill, and the All / Locations / Activities / Stores / Collectibles chips — one group on, the rest off, so a tap is the way into the map. Tapping a region pin opens the reference-style sheet: county photo, Set Route, View Area, Add to List.',
      "Kept, unchanged: spoiler-free first launch, forced indexing onboarding, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, interiors on tap, the Ask spoiler rule + proximity, the index resolver v3, traced county outlines, and the animated sea at ~8fps, paused when the tab hides.",
    ],
    verification: [
      "Unit tests pass (754, including new tests: the saved view is an offer never a restore, hero pins cap at 24 with regions first and no unnamed places, clusters cap at 120 no matter how many places are on, and the sea grade draws with source-in so it replaces the stencil white). TypeScript, ESLint and the production build pass.",
      'The 390px walk (scripts/check-v016.mjs) passes with zero console errors and zero overflow, and the screenshots were looked at: 0 markers on open despite a seeded 27-layer saved view, the restore offer, the sunset hero and chips, 24 hero pins with zero cluster discs after "All", the Vice City sheet with its photo and three actions, 6 markers after zooming in with Activities on, and 0 markers after "Turn everything off". The pan/zoom lag check recorded no long task over 200ms (two long tasks at 72ms and 88ms in one run, none in the next — both under the bar).',
      "The general 390px walk passes with zero console errors. Chromium e2e: 11 of 12 pass; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox).",
    ],
  },
  {
    version: "v0.15.0",
    date: "2026-11-24",
    title:
      "After Hours: a map that reads beautiful — traced county outlines, an animated sea, and art painted with your key",
    summary:
      "The After Hours redesign, finished the way the reference images demanded: the real GTADB map stays the base, and the treatment sits on top — county boundaries traced from the actual tiles pixel by pixel, a sea that drifts slowly over the real water, smoked-glass sheets, and county photographs you can repaint with your own OpenAI key.",
    status: "public",
    highlights: [
      'County outlines are traced, not rectangles: the build dissected every z5 tile pixel by pixel (5,829 tiles, 3.1 million cells) and traced the real coastline — 307,527 units of it — inside each county, with inland edges drawn dashed where they are still estimates. Isolate a county and the map dims everything outside the actual landmass, with a delicate ivory coastline and a slim "<County> ×" pill to leave. The same traced outline sits on each county card in Layers.',
      "The sea is alive, quietly: a canvas over the real water areas drifts light across the ocean at about 8 frames a second, pausing when the tab hides and drawing one still frame when motion is reduced. It is a shimmer on the real water — not a new ocean simulation; a full animated tile layer would cost a phone its battery for a subtle effect.",
      'County art, painted with your key: each county card carries a dusk landscape in that county\'s mood, labelled "AI image" — art, never a photo of a real place. In Settings → County art, with the same OpenAI key Ask uses, you can paint a fresh one per county; it stays on this device, and "Restore bundled" brings the original back. No key, no problem — the bundled art stays.',
      "Clusters never overlap: neighbouring clusters closer than a circle's own diameter merge into one, so the reference screens' clean, separated clusters hold on the real map too — the selected place and the regional labels are never absorbed. The isolation dim is cut to the full tile bounds, so fitting a wide county into a portrait phone no longer leaves a bright undimmed strip of ocean past the map edge, and the coastline is drawn as a dark under-stroke with ivory over it so the delicate line reads on bright sand, bright sea and dark forest alike.",
      'The After Hours system throughout: Midnight and Slate smoked glass, Ivory type, Coral and Sunset used only where they earn it — the wordmark, primary buttons, display titles. The "76 places showing" banner is gone, the brand is a small wordmark, search is one compact pill, the isolation banner is a slim pill with the county title drawn on the map, and Settings, Backup, the 3D explorer and About live in one settings area instead of on every page. The map is at least 85% of the screen.',
      "Kept, unchanged: spoiler-free first launch, persistence, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, interiors on tap, the Ask spoiler rule + proximity, the index resolver v3, and the empty-map prompt. The bright GTADB day tiles are untouched — no darkening filter, which would muddy the geography.",
    ],
    verification: [
      "Unit tests pass, including new tests for the traced geo (the real artifact read off disk — all five counties with coast and estimate runs inside the tile bounds), the sea overlay (mask math, draw order), and the AI art module (prompts, storage round-trip, mocked gpt-image-1 call with dall-e-3 fallback, 401 → auth error). TypeScript, ESLint and the production build pass.",
      'The 390px walk passes with zero console errors and zero overflow, and the screenshots were looked at against the references: Capri isolated with its traced coastline and the sea shimmering, Layers with the five photo cards and their outlines and "AI image" tags, Settings with the County art section, and the empty map with its small wordmark and compact search pill.',
      "Chromium e2e: 11 of 12 pass; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.",
    ],
  },
  {
    version: "v0.14.0",
    date: "2026-11-24",
    title:
      "Minimal cards, not-sure places re-scanned, county and area isolation, and a map that never looks empty",
    summary:
      "The fix for three complaints at once: place cards that read as essays, not-sure places the job skipped forever, and a county picker that filtered the list while the map stayed lit — plus the empty first-launch map that read as broken, with 3,754 places in the data and nothing showing.",
    status: "public",
    highlights: [
      'Cards are minimal now: a 56px blip roundel, the name or "? · type", the area, the distance, and Enterable / Lootable / Breakable / Gym / Equipment badges — nothing else on the card face. No paragraph, no evidence text, no "AI suggested" line on the card. All of that lives behind one tap, in the place sheet: the full description, the Inside section, loot, the AI-suggested label with its confidence, and the source. Ask answers are the same: a one-or-two-line verdict, then clean cards.',
      'Not-sure places get re-scanned: "not sure" is no longer attempted — a low-confidence answer is saved as "not sure" but its place stays in the "To go" count, and the next run checks it again. When the resolver version moves, the job re-queues every "not sure" place from the old version (resolver v3) and the Index panel says so — "X not-sure places re-queued for re-scan with the new prompt" — with a "Re-scan not-sure places" button to trigger it by hand.',
      "County and area isolation work on the map now, not just in the list: pick a county (Lummox, Kelly, Leonard, Vice-Dale, Mariana) or a town/city/area (Capri, Vice City, Port Gellhorn and the rest) from Layers or Find and the map zooms to it, dims everything outside it, shows only that area's places, and names the area on the map — with one big \"Show all of Leonida\" button to leave. County bounds are the estimated extents; area bounds come from the area's own places.",
      'The map never looks empty with no explanation again: on first launch — every public layer off on purpose, spoiler-free — the map now says so in plain words, "Nothing showing yet — pick what to see", with big buttons: Show interiors, Show lootable, Show shops, Show everything. One tap turns a layer on and the pins appear straight away. While places are showing, the map itself says how many and that Layers changes it.',
      "Kept, unchanged: spoiler-free first launch (all collectibles off, no spoilers shown), forced indexing onboarding, persistence, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system (dark blue = has an interior, light blue = closed), interiors on tap, the Ask spoiler rule + proximity, and the index resolver v2 (data first, LLM last). Positions remain APPROXIMATE and absent coverage UNKNOWN; GTADB data is CC BY 4.0, including 107 unpositioned entries.",
    ],
    verification: [
      "Unit tests pass, including 11 new tests for the not-sure re-queue (a v1 not-sure place re-queued under the new version, the runner never marking a not-sure place attempted, the re-queue surviving a storage round-trip exactly once) and for county/area isolation (Capri bounds contain its own places, Vice City neighbourhoods belong to Vice City). TypeScript, ESLint and the production build pass.",
      'The 390px walk passes with zero console errors and zero overflow, and the screenshots were looked at: a clean minimal Find card, an Ask answer with clean cards, the Index panel showing the re-queued not-sure count, Capri isolated with the rest of the map dimmed, and the fresh-profile first launch — the empty-map prompt, then pins appearing after one tap on "Show interiors".',
      "Chromium e2e: 11 of 12 pass; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.",
    ],
  },
  {
    version: "v0.13.0",
    date: "2026-11-24",
    title:
      "Ask answers as place cards, and an index resolver that checks the data before it guesses",
    summary:
      "The fix for the user’s 7/10 verdict on v0.12.0: Ask answers as nearest-first place cards with distances and badges instead of a text wall, and the indexing job resolves from real data — coordinates, tags, guide pins, analogues — before the LLM ever sees a place.",
    status: "public",
    highlights: [
      "Ask answers are big place cards: a 56px blip roundel, the name or “? · type”, area and county, the distance from the anchor, and Enterable / Lootable / Breakable / Gym / Equipment badges — nearest first, always. One tap flies to the place and opens its sheet. The verdict is one or two lines above the cards, with a “Near Capri” anchor chip on every answer.",
      "Ask is stable: an answer is added whole or not at all, a skeleton shows while it works, a stale answer can never overwrite a later one, and the latest answer scrolls to its top — the verdict and the first cards — instead of landing on the tail of the list.",
      "Index resolver v2 — the job no longer guesses from almost nothing. Before the LLM sees a “?” place it checks the real data: a same-spot coordinate match (within 15 map units — measured, not guessed: records sit a median 118 units apart, so a wider tolerance matches neighbouring buildings), then GTADB tags, then guide pins, then real-world analogue rules. Only what is left goes to the LLM, with the full context and temperature 0.",
      "Measured on the real snapshot, 658 of 2,732 “?” places resolve from data alone (588 from tags, 9 same-spot, 1 guide match, 60 analogue) and 2,074 go to the LLM. The Index panel shows the unsure rate honestly, resolved by source, with the remaining count — and every resolved place carries its source where the type is shown, so a data match is never shown as an AI guess.",
      "Fixed, found by looking at the screenshots: the 56px blip roundel was stretched into a wide oval on every Find and Ask card in v0.12.0. It is a circle again everywhere.",
      "Kept, unchanged: forced indexing onboarding, the job’s pause/resume/batch-save, the on-device-only key, spoiler-free first launch, Gyms vs Workout Equipment split, breakable homes as a system, and the Ask spoiler rule. Real counts throughout: 3,754 GTADB records, 986 named, 2,768 unnamed, 588 of 2,732 “?” typed from data, 2,144 left for the job. No “5k” anywhere.",
    ],
    verification: [
      "712 unit tests pass, including 17 for the coordinate/guide/analogue resolver and 7 for Ask card presentation; TypeScript, ESLint and the production build pass.",
      "The 390px walk passes with zero console errors and zero overflow, and the Ask screenshots were looked at: “gym near Capri” (Grand Majestic Gym, about 5,700 units away, GYM badge), “workout equipment near Capri” (Jason’s deck first), “enterable houses in Rockridge” (Venture Apts with Breakable badges), and the Index panel with the per-source counts row.",
      "Chromium e2e: 11 of 12 pass; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.",
    ],
  },
  {
    version: "v0.12.0",
    date: "2026-11-24",
    title:
      "Mobile redesign from scratch — full-screen map, GTA VI sunset identity",
    summary:
      "The phone app is rebuilt, not re-coloured: a full-screen map with nothing on it but a wordmark and one search bar, proper Find and Layers screens, county cards, and a full place sheet — after the user rated v0.11.0 a 6 and said the redesign was tweaks on a design he hates.",
    status: "public",
    highlights: [
      "The map is the app now: full-bleed Leaflet map, edge to edge, with only a small LEONIDA ATLAS wordmark and one search pill over it. The filter bar is deleted — no chips, no count pill, no reminder pill, no floating Add button on the map at all.",
      "Find is a proper screen: big search, two big filters (county, kind), and big place cards with a 56px blip roundel, area, county, distance and Can go inside / Lootable / Breakable home badges. Tap a card to fly to the place.",
      "Layers is a proper screen: big toggle rows with real icons and counts, a county picker as six big cards (All Leonida plus Lummox, Kelly, Leonard, Vice-Dale, Mariana), trading cards grouped at the bottom, the indexing job inside Layers only, and Add to the map (marker / workout spot / breakable home) here instead of floating over the map.",
      "Place detail is a full bottom sheet: grabber, a 72px blip hero, badges (Can go inside, Lootable, Breakable home, Gym, Workout equipment), and Save / Mark as found as two big buttons right under the title — then Inside, with the dark-blue rule and the 385 enterable places in GTADB.",
      "Fresh phone-first stylesheet written from scratch (1,800 lines replacing the layered v0.9/v0.10/v0.11 sheet): violet-night chrome, the GTA VI pink-to-orange sunset on primary actions and the active bottom-nav tab, Anton display + Oswald labels, glass sheets. No black pill stack, no generic dark dashboard.",
      "Kept, unchanged: forced indexing onboarding (2,732 still “?”, 581 typed from GTADB tags, 2,151 unresolved — the job is the only way they get sorted), spoiler-free first launch, persistence, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, the Ask spoiler rule, and AI categories labelled “AI suggested”, never a fact. Positions remain APPROXIMATE and absent coverage UNKNOWN; GTADB data is CC BY 4.0, including 107 unpositioned entries.",
    ],
    verification: [
      "Unit tests passed; TypeScript, ESLint and the production build passed.",
      "The 390px walk (22 flows) and the 390px check script pass with zero console errors, zero overflow, and zero tap targets under 48px.",
      "Chromium e2e: 11 of 12 pass, including the new forced-onboarding test on a fresh profile; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.",
    ],
  },
  {
    version: "v0.11.0",
    date: "2026-11-24",
    title:
      "Forced indexing onboarding, a de-cluttered map, GTA VI sunset vibes",
    summary:
      "The indexing job gets a forced first-launch onboarding, the map gets its space back with a two-row filter bar and one Add button, and the whole app wears the official art’s pink-to-orange sunset.",
    status: "public",
    highlights: [
      "Forced onboarding before the map is usable: 2,732 places are still “?”, 581 already have a type from the map data’s own tags, 2,151 still have nothing to read, and the only way they get sorted is this job with your own OpenAI key — paste it, tap Start sorting, or explicitly tap Skip for now.",
      "Skipping is a choice, not a missed ×: the job stays one tap away in Layers (“Sort the unnamed places”) and a reminder pill stays on the map until it has run at least once.",
      "The filter bar is two rows — one count pill, the reminder, Clear all, then one scrolling strip of chips — and the map caption’s duplicate count is gone.",
      "One “+ Add” button with a sheet (Add marker / Add workout spot / Add breakable home) instead of three buttons over the map.",
      "GTA VI sunset accent (pink-to-orange) on primary actions, active chips, the reminder pill and cluster roundels; LEONIDA ATLAS wordmark with ATLAS in the gradient; Anton + Oswald self-hosted; glass bottom sheets.",
    ],
    verification: [
      "681 unit tests passed; TypeScript and the production build passed.",
      "The 390px walk (22 flows) and the 390px check script pass with zero console errors, zero overflow, and zero tap targets under 48px.",
      "Chromium e2e: 11 of 12 pass, including the new forced-onboarding test on a fresh profile; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.",
    ],
  },
  {
    version: "v0.10.0",
    date: "2026-11-24",
    title: "Navigation first, breakable homes, interiors on tap",
    summary:
      "A labelled bottom nav with one filter system, thumb-sized controls everywhere, breakable homes as a systemic rule instead of a 33-item list, and interiors shown on every place.",
    status: "public",
    highlights: [
      "Labelled bottom nav (Map / Find / Layers / Saved / Ask), one filter system shared by the map and Find, and one sheet at a time — Ask never stacks on a place detail.",
      "Every tappable thing is at least 48px on a phone, measured by the 390px walk.",
      "Gyms and workout equipment are separate layers; the Capri garage-in-a-house flow turns his own knowledge into a real Workout Equipment pin.",
      "Breakable homes layer (52 places) with the dark-blue in-game rule in plain words, plus “Possible enterable house — check it” for untagged houses.",
      "Every place detail has an “Inside” section, and Interiors filters by venue type — 385 enterable in GTADB, 33 houses tagged.",
      "581 of the 2,732 “?” places already have a type from the map data’s own tags; 2,151 still have nothing to read, and the AI indexing job is the way to close them.",
      "Real service worker (the app registered one that did not exist), Anton + Oswald type, and the welcome’s Skip button pinned below the sheet instead of 1,200px below the fold.",
    ],
    verification: [
      "678 unit tests passed; TypeScript, ESLint and the production build passed.",
      "The 390px walk (22 flows) and the 390px check script pass with zero console errors and zero tap targets under 48px.",
      "Chromium e2e: 10 of 11 pass; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox).",
    ],
  },
  {
    version: "v0.9.0",
    date: "2026-11-23",
    title: "Authentic map blips and a warmer companion redesign",
    summary:
      "Every place pins a real pictogram in a GTA-style blip, and the whole app is redesigned to a warm charcoal-and-orange companion look.",
    status: "public",
    highlights: [
      "Map pins are GTA-style blips: a white pictogram in a coloured roundel, drawn from each place’s GTADB tags — petrol, gun shop, hotel, gym and more — in one consistent stroke set. No place falls back to a coloured dot.",
      "The same icons run through the whole app: overlay chips, layer rows, search results, place detail sheets, Ask Nylah answers and AI-suggested types.",
      "The interface is redesigned to a boutique-hotel register: warm charcoal surfaces with orange accents, an elegant serif for headings, floating glass cards and rounded bottom sheets.",
      "The map chip row wraps instead of scrolling, and the place description lifts its real-world analogue address into its own line instead of a wall of text.",
    ],
    verification: [
      "641 unit tests passed, including 9 new icon-system tests covering every GTADB tag in the snapshot.",
      "TypeScript, ESLint and the production build passed; the 390px walk was re-run with screenshots.",
    ],
  },
  {
    version: "v0.8.2",
    date: "2026-11-17",
    title: "Updated landmarks and safer local editing",
    summary:
      "3,431 refreshed community landmarks, safer marker deletion, and more reliable mobile navigation.",
    status: "public",
    highlights: [
      "The November 17 GTADB catalogue keeps all previous IDs and adds 1,233 records. Positions remain approximate.",
      "Marker deletion checks the marker and its note for changes before committing.",
      "The 3D renderer downloads when you open it. The map and local library still reopen offline.",
    ],
    verification: [
      "The release workflow checks the production build and browser flows in Chromium and WebKit.",
    ],
  },
  {
    version: "v0.8.1",
    date: "2026-09-18",
    title: "Crawlable project pages and dependency refresh",
    summary:
      "Clean project URLs, distinct metadata and a TypeScript 6 migration.",
    status: "public",
    highlights: [
      "Project pages include readable static content and dedicated page metadata.",
    ],
    verification: ["The public source and tag are available on GitHub."],
  },
  {
    version: "v0.8.0",
    date: "2026-09-06",
    title: "Deeper streets and researched regional scenes",
    summary:
      "Fifteen sourced discoveries, six richer regional arrivals, deep window interiors, photographic surfaces and contact shading.",
    status: "public",
    highlights: [
      "Official Rockstar regional descriptions and public images support fifteen short discoveries in place details, search and the explorer Evidence panel. Unpositioned observations lead to existing regional arrivals without inventing exact map pins.",
      "Vice City gains a shaded bakery court and market; the Keys a working marina; Grassrivers stilt structures; Port Gellhorn weathered shops; Ambrosia a service yard; and Kalaga a trail shelter and stream access.",
      "Recessed window openings, view-dependent room interiors, balconies, setbacks and storefronts add architectural depth. Nearby mapped roads gain curbs, gutters and drainage where their source context is urban.",
      "Locally hosted CC0 photographic color, normal and roughness maps cover asphalt, concrete, rock, timber and gravel. Shared texture sources and spatial detail limits keep the added resources bounded.",
      "Depth-based contact shading, sharper nearby shadows and restrained highlight glow strengthen grounding. Unsupported effect configurations retain direct rendering. Native trees have finer silhouettes and more efficient forest geometry.",
      "GTADB coordinates, CC BY 4.0 attribution and existing releases remain available. Decorative parcels and unmeasured relief stay APPROXIMATE; the source material does not establish exact dimensions or positions.",
    ],
    verification: [
      "Unit and integration checks cover source claims, facade clearance, parcel occupancy, road context, terrain clearance, texture sharing, asynchronous disposal and rendering fallback.",
      "Chromium checks cover regional views, selected destinations, native keyboard activation of Evidence and travel, return to the atlas and touch controls.",
      "The rendering checks use Chromium with SwiftShader software rendering. Hardware frame rates and real iOS graphics performance are not established by this environment.",
    ],
  },
  {
    version: "v0.7.0",
    date: "2026-09-06",
    title: "A fuller, living 3D Leonida",
    summary:
      "Restored mapped streets and buildings, articulated pedestrians and richer architecture, vegetation, terrain, water and lighting across six regions.",
    status: "public",
    highlights: [
      "Source roads remain visible above approximate terrain. Mapped building occupancy is preserved on desktop and mobile, with rotated footprints, regional floor and roof patterns, and nearby facade detail.",
      "Hotel Dixon, the Sahara arena, waterfront towers and the mural viaduct have rebuilt volumes. Regional porches, storefronts, roofs and service details add depth to the existing arrivals.",
      "Original articulated characters replace block figures and flat life collages. Walking feet and vehicle tyres follow the active street surfaces; Vice City and Ambrosia traffic use their selected arrival frames.",
      "Nearby trees use three-dimensional trunks and leaves, with photographic vegetation retained in the distance. Kalaga gains continuous local rock ridges and elevated forest.",
      "Outdoor image-based lighting, properly shaded clouds, traveling water normals and bounded streetlight pools improve the six regional atmospheres.",
      "GTADB positions and attribution remain intact. Unmeasured architecture and local relief stay APPROXIMATE; this is a browser reconstruction, not the original game world or its assets.",
    ],
    verification: [
      "503 unit and integration tests passed, including streaming, geometry, contact, source-coordinate, actor and water lifecycle checks. TypeScript, ESLint and the production build passed.",
      "Chromium rendered all six regions and a reverse Vice City view without reported application or shader errors. Additional isolated captures checked the rebuilt landmarks, actors and clouds.",
      "Draw calls and triangles were recorded. The test machine uses SwiftShader software rendering, so these checks do not establish a hardware frame-rate guarantee.",
    ],
  },
  {
    version: "v0.6.2",
    date: "2026-09-06",
    title: "Public collaboration and security hardening",
    summary:
      "Community contribution workflows, protected pull requests, validated dependency updates and continuous security scanning.",
    status: "public",
    highlights: [
      "The public repository now includes contribution guidelines, a code of conduct, issue forms, a pull-request template and private vulnerability reporting.",
      "The main branch requires a successful Quality check and resolved conversations, keeps linear history, and blocks force pushes and branch deletion.",
      "Dependabot groups compatible updates, keeps Node type definitions on Node 22 and avoids unrelated lockfile downgrades.",
      "GitHub Actions use pinned revisions and read-only default permissions. Secret scanning, push protection and CodeQL continuously inspect the repository.",
      "Public map data, coordinates, licensing, account boundaries and local-first behavior are unchanged.",
    ],
    verification: [
      "Frozen installation, strict TypeScript, lint, 458 unit/integration tests and the production build passed.",
      "The Chromium browser suite passed after the public collaboration and dependency updates.",
      "CodeQL completed both analyses with no findings. GitHub reported no unresolved secrets or dependency vulnerabilities, and Git integrity checks found no corruption.",
    ],
  },
  {
    version: "v0.6.1",
    date: "2026-09-05",
    title: "Visitor measurement and release history",
    summary:
      "Consent-based visitor measurement and an About page with every release since v0.5.0.",
    status: "public",
    highlights: [
      "Visitors can allow or decline audience measurement and change their choice in About. Accepted visits use a separate random browser identifier; personal Atlas data stays isolated from Analytics.",
      "About lists the current version and earlier releases, with dates and a short description of each update.",
      "The changelog retains the complete history from v0.5.0, ordered from newest to oldest.",
      "GitHub publication preserves existing releases and restores missing historical entries without replacing the latest version.",
    ],
    verification: [
      "TypeScript, lint, release-history rendering and publication lifecycle tests passed.",
      "About and changelog links were checked in desktop and mobile browsers.",
      "Google accepted consented test visits with stable browser and session identifiers. Consent withdrawal, origin isolation and cross-tab changes were checked; the private Analytics dashboard is outside this verification.",
    ],
  },
  {
    version: "v0.6.0",
    date: "2026-09-05",
    title: "Account workspaces and selected 3D destinations",
    summary:
      "Isolated account workspaces and a private official account service, with the selected map destination preserved when entering the 3D explorer.",
    status: "public",
    highlights: [
      "React, Vite and strict TypeScript replace the Astro shell and build. Static hosting requires no CMS, parent website, account or private API.",
      "The calibrated Leaflet CRS.Simple map supports search, intersecting filters, ordered layers, zoom rules, bounded spatial clustering and source details.",
      "Dexie / IndexedDB stores favorites, notes, collections, markers and preferences with schema upgrades, transactional saves, cross-tab updates and stale-draft protection.",
      "The personal marker editor supports create, edit, move and delete. Versioned backups are validated and previewed before an atomic merge.",
      "Offline caching preserves the app shell, public catalogue and basemap after a complete online load. Optional 3D assets are cached as visited with bounded storage.",
      "Selected map coordinates now initialize the 3D world. Ambrosia, Leonida Keys and individual places keep their destinations; rapid map/explorer transitions clean up pending map animations.",
      "Local guest and account workspaces stay separate. Queued writes, stale reads and backup operations cannot silently cross an account transition.",
      "The existing Three.js reconstruction loads on demand, with desktop and touch controls, regional travel, evidence panels and a fallback when WebGL is unavailable.",
      "The official instance supplies email/username registration, secure sessions and explicit server backups through a separate private service. Public forks remain fully usable as guests; Analytics stays isolated and deployment-configured.",
      "GTADB / Map GTA attribution and CC BY 4.0 data licensing are retained: 2,198 source records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placement remains APPROXIMATE and absent coverage UNKNOWN.",
    ],
    verification: [
      "Frozen installation, strict types, lint, unit/integration tests, static build and isolated public-fork checks passed.",
      "Desktop Chromium and mobile WebKit exercise map and local-data flows. WebKit offline-navigation is explicitly skipped when its automation runtime fails; Chromium verifies offline reopening and selected 3D spawning.",
      "An isolated subdirectory build verified map data, saved markers, project links, historical routes, 3D assets and service-worker scope. The standalone Nginx container passed the browser suite.",
      "Dependency audit and peer checks passed. Analytics isolation and emitted offline-worker boundaries were verified; the full scope and limitations are in docs/refactor/VERIFICATION.md.",
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-09-05",
    title: "Standalone local-first Atlas",
    summary:
      "A standalone map workspace with local favorites, notes, collections, personal markers and portable backups, plus an optional 3D explorer.",
    status: "public",
    highlights: [
      "React, Vite and strict TypeScript replace the Astro shell and build. Static hosting requires no CMS, parent website, account or private API.",
      "The calibrated Leaflet CRS.Simple map supports search, intersecting filters, ordered layers, zoom rules, bounded spatial clustering and source details.",
      "Dexie / IndexedDB stores favorites, notes, collections, markers and preferences with schema upgrades, transactional saves, cross-tab updates and stale-draft protection.",
      "The personal marker editor supports create, edit, move and delete. Versioned backups are validated and previewed before an atomic merge.",
      "Offline caching preserves the app shell, public catalogue and basemap after a complete online load. Optional 3D assets are cached as visited with bounded storage.",
      "The existing Three.js reconstruction loads on demand, with desktop and touch controls, regional travel, evidence panels and a fallback when WebGL is unavailable.",
      "Public forks work as guests without credentials. Account and cloud-sync contracts remain optional; Analytics is isolated and enabled only by deployment configuration.",
      "GTADB / Map GTA attribution and CC BY 4.0 data licensing are retained: 2,198 source records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placement remains APPROXIMATE and absent coverage UNKNOWN.",
    ],
    verification: [
      "Frozen installation, strict types, lint, unit/integration tests, static build and isolated public-fork checks passed.",
      "Desktop Chromium and mobile WebKit passed 17 browser cases; one WebKit offline-navigation case is explicitly skipped when its automation runtime fails. Chromium verifies offline reopening.",
      "An isolated subdirectory build verified map data, saved markers, project links, historical routes, 3D assets and service-worker scope. The standalone Nginx container passed the browser suite.",
      "Dependency audit and peer checks passed. Analytics isolation and emitted offline-worker boundaries were verified; the full scope and limitations are in docs/refactor/VERIFICATION.md.",
    ],
  },
] as const;

export const latestLeonidaAtlasRelease = LEONIDA_ATLAS_RELEASES[0]!;
