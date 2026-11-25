# Illustrated island view — v0.22.0 report

User decision 2026-11-25 00:34, after the v0.20.2 colour grade measured as
"0 difference" against the reference: AI-illustrate the island view, keep
the real map at street zoom. Separate lane from v0.21; no deploy until
v0.21 was live (v0.21 went live 2026-11-25 00:40 UTC).

## What shipped

- One AI-illustrated island image, sliced into 515 tiles for tile zooms
  0–3 (z0 12, z1 30, z2 99, z3 374) under
  `public/assets/gta6-leonida-atlas/tiles/illustrated/`.
- Tile zooms 4–6 stay the real enhanced GTADB tiles (`tiles/enhanced/`).
  The switch is in `src/features/map/gtadb-tiles.ts` (`gtadbTileUrl`).
- The map carries a small zoom-aware label (`.atlas-map-illustration-note`
  in `src/features/map/MapView.tsx`): "Island view: AI illustration traced
  from the real map" out wide, "Street zoom: the real in-game map" in
  close. The Cartography section in `src/features/project/ProjectPage.tsx`
  says the same.
- `scripts/finalize-build.mjs` folds BOTH pyramids into the service-worker
  cache name, so an illustrated re-render changes the cache.
- Pipeline, deterministic and re-runnable: `scripts/illustrate-island.py`
  (numpy + Pillow only). Inputs kept in the repo:
  `scripts/illustrated-island-generated-v2.png` (the generation),
  `scripts/illustrated-island-source.png` (the trace-corrected image).

## How the illustration was made

1. Real overview: the 374 z3 GTADB day tiles composited into one
   4352x5632 image, the source of truth for the geography.
2. Generation (sandbox image generation): the overview restyled in the
   reference look — deep teal sea with clouds, rich green land, gold
   sand, glowing pink roads — with the reference render
   (`1000017560_12_lqxm.png`) as the style reference. v1, then one
   resume/refine pass asking for the lake and the east-coast islands
   to match the real map (v2). The refine barely moved anything
   (land-mask IoU 0.491 -> 0.499): prompt iteration does not converge
   the generator onto exact tracing. That is a finding, not a failure
   to iterate enough — a third pass was not attempted.
3. Trace-correction (the script): the generator invents geography in
   the open sea. Where the real map is sea — beyond a 12px shallows
   band around real land, and outside real inland water (Lake Leonida)
   — the illustration is replaced by its own sea (a sea field
   inpainted from sea pixels only, so no land colour smears into the
   water). Real land, the lake, roads and cities keep the illustration
   exactly as generated. Clouds over the sea are kept.

## Alignment evidence (measured, not eyeballed)

- Raw v1/v2 land-mask IoU vs the real map: 0.491 / 0.499. After
  trace-correction: 0.627. The remaining gap is clouds over the sea
  and the turquoise shallows band, which the mask counts as land.
  The number alone is not the verdict — the crops are.
- Full-resolution side-by-side crops (real / v2 / corrected):
  Lake Leonida sits in the same place and shape; the Keys airport
  island, its runway cross and the bridge east are in the same places;
  the Vice City bay now traces the real layout (the raw generation
  had invented extra islets around the Keys and redrawn the bay
  islands — both removed by the trace-correction).
- Stitched tiles: four neighbouring z3 tiles re-stitched match the
  source image with mean abs diff 1.11 (JPEG artefacts only) — no seams.
- z2/z1/z0 are downsamples of the same image, so no seams between zooms.

## Honest limits

- Resolution: the generation is 1344x1728, so a z3 tile carries ~79px
  of generated detail upscaled 3.24x to 256px. The illustration is
  painterly by design, so the upscale reads as smooth — but it is NOT
  sharp linework, and the sharp real map takes over at z4. Do not call
  the island view sharp.
- Inside the real land footprint, the illustration's internal detail
  (exact road paths, bay-island shapes off Vice City) is still the
  generator's drawing, bounded to the right land. A pin on a real place
  lands on illustrated land in the right spot; at z4 the real map shows
  the exact position.
- The z3 -> z4 switch pops: illustrated to real. Same palette family,
  same coastline — it reads as the same place getting real — but it is
  a visible change, not a seamless morph. The walk reports how jarring
  it feels; if it is awful, that is in the walk report, not hidden.
- The illustration is never presented as the real map or as a photo.
  The label is on the map at every zoom and in Cartography.

## Verification

- Typecheck + lint: clean.
- Unit: 780 tests (779 v0.21 + 1 new zoom-switch test), 81 files.
- 390px walk: scripts/check-illustrated.mjs — PASSED (DPR 2, stale
  v0.21 profile, bundle index-DVd1U6jZ.js). Old v0.21 cache gone
  after one reload; 84 illustrated tile requests at island zoom, 0
  enhanced; label on screen (y=172) AND topmost at its centre;
  256px tile at 128 CSS px; loaded tiles cover the whole map at the
  fit view (union -84,-108–428,788 vs map 0,0–390,771); sampled
  illustrated tile bytes match disk (1/1,3,2.jpg); 0 markers on
  open; 24 hero pins (cap) landing on the right spots (Vice City,
  Leonida Keys, Port Gellhorn, Ambrosia, Mount Kalaga, Grassrivers,
  the airport pin on its runways); wheel in i1 → i2 → i3 → e4 with
  the label flipping to street at e4, wheel back out to i1 with the
  label flipping back; Turn everything off → 0 markers; zero
  console errors, zero failed requests. Screenshots eye-checked:
  the island fills the screen, the label reads under the chips, the
  z3 → z4 switch pops (illustrated to real, same coastline — a
  visible style change, not a morph, but the geography is
  continuous and it reads as the same place getting real).
- Production build: one command, ATLAS_BASE_PATH=/gta6-leonida-atlas/.
- NOT deployed by this lane (per the brief — deploy after v0.21 live;
  v0.21 went live during this build, so deployment is unblocked and
  is the parent agent's call).

## Two bugs the walk caught (both fixed in this lane)

1. Retina regression (the small-island frame): v0.21 dropped
   v0.20.2's retina handling in a stale stash pop — restored it,
   then the walk's phase-2 screenshot still showed the island
   SMALL and offset right, black space on the left. Diagnosis
   (tile-position probe, not eyeballing): v0.20.2's retina was
   itself broken — tileSize 128 halves the rendered size WITHOUT
   loading deeper tiles, because the app's getTileUrl override
   bypasses Leaflet's zoomOffset (the offset only feeds the default
   URL builder; the override receives coords.z, the tile zoom).
   So at map zoom -5 the layer loaded z0 tiles displayed at 128px
   each: a 384x512 grid in a 390x771 map. Fix: on DPR >= 2 pass
   coords.z + 1 to gtadbTileUrl — a 128-grid tile at map zoom z
   covers exactly the ground of a 256-grid tile at z + 1 (verified:
   coords (-2,-1)@-5 now load 1/1,3,2.jpg, the correct z1 tile,
   and the four z1 children of a z0 tile match exactly). The
   illustration label uses the same +1, so it describes the tiles
   actually on screen. The walk gained a framing check (the union
   of loaded tile rects must cover the whole map container) so this
   can never pass silently again — the first framing run used the
   844px viewport as the target and failed; the map container is
   390x771 (the bottom nav sits below it), so the check measures
   the container, not the viewport.
2. Label hidden under the empty-map prompt: at the bottom spot
   (above the attribution) the label was in the DOM with a box and
   z-index 500, but the prompt is a sibling overlay in a higher
   stacking context (z-index 450 on a later sibling), so
   elementFromPoint at the label's centre hit the prompt's "Show
   shops" button — the first thing the user saw was the
   illustration with no label at all. Fix: the label moved to just
   below the filter chips (top: 176px, 172px on phones), where
   nothing covers it. The walk gained a topmost check
   (elementFromPoint at the label's centre must hit the label).
