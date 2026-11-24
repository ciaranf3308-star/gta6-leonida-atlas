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
