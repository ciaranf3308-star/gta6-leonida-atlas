# v0.20.0 — FIX THE BLUR, pixel by pixel (this file's v0.19 section follows)

## The verdict that forced it

v0.19.0 shipped as a "true rebuild" and the user rated it 3/10:
"Wow it's so blurry .. you say 7 I say 3." Then, the fourth time he
has asked for the same thing: "No seriously like this is the 4th
fucking time to ask to build the map pixel by pixel. That level of
blur means it was not pixel by pixel. Therefore my direct input is
being ignored." He is right. v0.19 claimed pixel-by-pixel and still
shipped two blur sources:

1. **DPR upscale (dominant).** 256px tiles at tileSize 256, no
   retina handling. Measured live on a 390px viewport: naturalWidth
   256, displayed 256 CSS px, devicePxPerTile 512 at DPR 2 and 768
   at DPR 3 — every tile pixel stretched 2-3x by the browser.
   Leaflet's `detectRetina` cannot fix this: it clamps the layer
   minZoom to 0 (Leaflet 1.9.4 `TileLayer.initialize`) and this map
   lives at Leaflet zoom -5..1, so tiles below zoom 0 would vanish.
2. **Baked blur in the renderer.** Every classification mask was
   gaussian-blurred (water sigma 2, green sigma 2, sand sigma 1),
   the relief shade was sigma 6 at +/-5%, output JPEG quality 88.
   Measured on the z0 island tile: redrawn mean |gradient| 3.86 vs
   8.99 for the day source. Strongest-edge width in the files was
   4-17px (coast 4px, streets 17px, island 12-17px) — a true hard
   edge is 1-2px. The blur was in the files before any phone saw
   them.

## What v0.20.0 does (scripts/redraw-tiles.py, rewritten)

- **512x512 tiles, same pyramid.** Every tile rendered at 512
  (2x display density) from the same 256px GTADB source; Leaflet
  tileSize stays 256, so a tile displays at 256 CSS px from 512
  real pixels: 1:1 device pixels at DPR 2, 1.5x at DPR 3,
  downsampled-crisp at DPR 1. Same filenames, coordinates, zooms.
- **No blur step anywhere in the image path.** No gaussian on any
  mask. NO relief shade at all — the "blurred luminance base" is
  deleted, not reduced: flat fills are flat. No bilinear
  resampling of image data. Every output pixel is decided
  individually: its class comes from exactly ONE source pixel
  (nearest-neighbour lookup, never a blend of neighbours) and its
  colour is a flat fill for that class. Coastline, forest edge and
  beach are hard 1-2px steps.
- **Roads** are vector centrelines from the road mask (skeletonize
  is geometry extraction, not a blur), drawn as hard strokes at 512
  with doubled widths (glow 10, core 6, minor 6). Same major/minor
  classification as v0.19 (half-width >= 8 tile-px at z5, junction
  zones cut, fragments < 20px dropped).
- **The only soft things left, disclosed:** (a) sea depth bands are
  a smooth gradient by design, sampled from a continuous global
  shore-distance field (not from image pixels); (b) clouds at z0-z2
  are soft puffs by design over water only; (c) the major-vs-minor
  decision smooths the measured road-width field along the skeleton
  (a classification decision only). Nothing soft touches land,
  roads or city blocks.
- **Receipts (measured, not claimed):** 31,022 tiles (z0 12, z1 30,
  z2 99, z3 374, z4 1,496, z5 5,829, z6 23,182) — 2,033,057,792
  source pixels in, 8,132,231,168 output pixels out. Strongest edge
  in the Vice City street tiles: 1px wide at 512 (v0.19: 4-17px).
  JPEG quality 92. v0.18's recoloured pyramid (tiles/styled/,
  175 MB, superseded and unreferenced since v0.19) is deleted.
- **Limits, owned:** the source's finest detail is z6 (1 px per
  canonical unit) — nothing here invents detail above it; the 512
  canvas is display density so the phone never upscales, and each
  of its pixels reads exactly one source pixel. City blocks are
  still flat two-tone slabs, clouds procedural sine puffs (they read
  as diagonal grey-white streaks at full zoom-out), header wordmark
  text. Per-pixel classification with no spatial regularisation
  leaves occasional single-pixel speckles in the green at z0 —
  invisible at phone display size, honest at 100%.

## Verification (v0.20.0)

- Render: `python3 scripts/redraw-tiles.py --all` — 31,022 ok, 0 errors,
  287.7 MB total (was 166 MB at 256px). Every tile on disk verified
  512x512, per-zoom counts z0 12, z1 30, z2 99, z3 374, z4 1,496,
  z5 5,829, z6 23,182.
- `scripts/check-v020.mjs` — the v0.19 walk at 390px DPR 2, plus:
  every loaded tile asserts naturalWidth 512 at 256 CSS px (1:1
  device pixels at DPR 2), and a DPR 3 probe (512px files, 768
  device px = 1.5x, was 3x). Street-zoom coral/cream sampled at
  native 512: 0.0007% coral, 1.72% cream across 15 tiles. PASS,
  zero console errors, zero overflow.
- 100% crops before/after in /tmp/v020/crops-before|after (coast,
  streets, blocks, Capri, island): v0.19 files soft at 4-17px
  edges, v0.20 files hard at 1px. Judged by eye at DPR 2: the
  whole-island open and the street zoom are both sharp now — the
  v0.19 open was a soft wash, the v0.20 open has hard pixel-step
  coastlines throughout.
- Typecheck, lint, unit tests (767/767, 81 files), one-command
  production build (ATLAS_BASE_PATH exported, base
  /gta6-leonida-atlas/) — all pass. Chromium e2e: 20 passed,
  3 failed, 1 skipped — the 3D-explorer failure is software-WebGL
  CPU saturation in this sandbox (trace: 20-50s per action inside
  the 3D world, which loads no map tiles; the hanging click moves
  between runs), the mobile-Safari marker failure is a place sheet
  intercepting the Enter-coordinates button in UI code v0.20 does
  not touch (passes on Chromium), and the note-sync failure passed
  on retry. None of the three is a tile failure; none is hidden.

---

# v0.19.0 true rebuild — redraw report

## Honest position

v0.18.0 "rebuilt" the tiles only by recolouring the same GTADB day-map
pixels: same image, new colours, coral road highlights. The user clocked
it ("You're not truly rebuilding the map are you ??") and he was right.
The zoomed-in screenshot proved the second failure too: every street was
a thick bright-pink neon line.

v0.19.0 draws a NEW basemap. This file records what the source of truth
was, what is painted, and what was judged by eye.

## Source of truth (only)

- The GTADB In-Game Day tiles, `public/assets/gta6-leonida-atlas/tiles/day/`,
  z0–z6 (31,022 tiles), CC BY 4.0, map artwork © Rockstar Games.
- Coastline, water, sand, land, urban ground and roads come from THAT data
  only. No invented coastline, road, city or place. The ungraded originals
  stay in `tiles/day/`; the redrawn pyramid is `tiles/redrawn/` with the
  same filenames, coordinates and zooms, so every place coordinate lands
  in exactly the same spot.

## What is painted (artistic interpretation — say so in the app)

- **Flat illustrated fills, per surface.** Deep-teal sea in depth bands
  (distance-to-land in the source land mask — a styling device, not
  bathymetry), rich green land, warm sand, warm-grey city blocks. The
  only texture kept from the photo is a heavily blurred relief shade
  from source luminance (sigma 6, 0.95–1.05). Source photographic detail
  is deliberately flattened away; that is what makes it a redraw.
- **Roads are vector strokes** over the flat land, from skeleton
  centrelines of the source road network (skimage Lee skeletonize,
  compact-blob rooftop drop, short-stub prune). Major = smoothed
  skeleton half-width >= 8 tile-px at z5 (measured: the old 5px bar made
  83% of Vice City's streets "major" — the pink grid). Junctions are cut
  out of the major mask. Majors get a thin coral core (3px, 80%) with a
  soft glow; highways sunset; minor streets cream, no pink, no glow.
- **Clouds** at z0–z2: large soft white puffs over water only, clustered
  by a low-frequency envelope with clear sea between, in global
  coordinates so they never seam.
- **City blocks**: light compact blobs that are not road, painted in two
  flat tones. They are drawn blocks, not photo rooftops.

## Iterations (previewed before the full run, /tmp/v019/)

1. **v1** — Pink grid persisted (83% of VC streets "major" at 5px),
   clouds were giant grey-blue fog smears, sea bands were 45 tile-px
   wide at z0 (turquoise halo swallowed the coast), land painted mostly
   urban cream at low zoom.
2. **v2** — Major bar 8px, sea bands scaled per zoom, low-zoom green rule
   loosened, relief un-quantised, clouds smaller/whiter. Street zoom:
   pink survived only as X blobs at junctions (width spikes where roads
   cross). Clouds read as white pills, evenly scattered.
4. **v4 (shipped)** — The walk caught a sea seam: open-ocean tiles
   painted flat abyss next to shore tiles' bands, a hard rectangle
   in the sea at low zoom. Sea bands now come from one global
   shore-distance map (`scripts/build-shore-distance.py`, z2 grid,
   1 px = 8 units, water share 0.896 matching the dissection),
   sampled by every tile including the ocean fast path.
3. **v3** — Junction zones cut from the major mask (15px),
   major fragments < 20px dropped, clouds clustered by envelope with
   soft blurred edges, low-zoom faint-road alpha cut to 0.12. Street
   zoom: cream network, pink reduced to 2–3 sub-pixel specks at
   junctions. Full zoom: green island, deep teal sea, clustered white
   clouds at the edges.

## Verification

- `python3 scripts/redraw-tiles.py --all` — 31,022 tiles, same pyramid.
- `scripts/check-v019.mjs` — 390px walk: redrawn tiles at open, GTA VI
  wordmark, slim prompt + non-wrapping restore button, street-zoom
  coral share < 3% with cream streets present, plus the v0.18 flows.
- Side-by-side: `/tmp/v019/z0-redrawn.png`, `/tmp/v019/vc-street-z5.png`,
  `/tmp/v019/preview-v5.png` (before/after pairs) — judged by eye
  against the reference render, not by checklist.
- Pin-position check: tile geometry is unchanged (same filenames and
  grid), so no place moved. Spot check: Ajax Gym (1420, 1766) still
  lands on z5 tile (57, 69) — covered by the unit test.

## What the redraw does NOT do (gaps, owned)

- It does not add 3D terrain, building models, or hand-drawn city
  detail: city blocks are flat two-tone slabs from the source light
  mask, so dense districts read clean but plain next to the reference's
  rich 3D-like blocks.
- Clouds are procedural sine puffs, not photographed clouds; at full
  zoom they read as soft white clusters, flatter than the reference's
  fluffy banks.
- The header wordmark is text (condensed "Grand Theft Auto" + gradient
  VI), not the Rockstar logo art — deliberately, no logo art is copied.
- The 5th bottom tab stays "Ask", not "Discover": Ask is the app's
  established AI finder (Ask spoiler rule, releases, tests all name it);
  renaming it to match the reference label would mislabel the feature.
  Regional discoveries live in place details / Saved.
