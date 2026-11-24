# Tile restyle — palette report (v0.18.0, After Hours)

The map itself, recoloured: `scripts/restyle-tiles.py` reads every GTADB
In-Game Day tile under `public/assets/gta6-leonida-atlas/tiles/day/` and
writes a recoloured copy to `tiles/styled/` with the same filename, tile
coordinates, zoom levels and geometry. Nothing moves, no place data
changes, no geography is invented. This is a colour grade of the real
tiles, not new map art. The app serves `tiles/styled/`; the ungraded
originals stay in `tiles/day/` as the source of truth.

## Measured source palette (real tile pixels, z5)

| surface | measured colour | where |
|---|---|---|
| open ocean | rgb(49, 146, 178) | east of Vice City (3500, 2000) |
| shore water | rgb(76, 160, 188) | off Ocean Beach (2250, 350) |
| sand | rgb(194, 186, 156) | Ocean Beach (2110, 550) |
| city blocks | rgb(167, 175, 188) | Vice Beach (1500, 500) |
| forest | rgb(84, 125, 100) | Mount Kalaga (-4200, 7500) |
| Capri streets | rgb(155, 174, 185) | Capri (-6500, 200) |
| road core | rgb(209, 209, 219) | Vice City avenues |
| bright rooftop | rgb(202, 205, 214) | Vice City (nearly identical to road core) |
| highway | rgb(215, 207, 181) | Capri (pale yellow, barely yellow) |

Source: `scripts/dissect-map-report.md` (v0.15.0) + spot samples taken
while building this grade. The source tiles are flat and pale: the
ocean is one flat cyan, the land is pale green-grey, the city is pale
grey-blue. That flatness is why v0.15–v0.17 still looked the same —
every build changed the UI around the tiles and never the tiles.

## Target palette (After Hours)

| surface | target | treatment |
|---|---|---|
| ocean, deep | #053A4C rgb(5, 58, 76) | water ramp, deep end |
| ocean, shore | #127E94 rgb(18, 126, 148) | water ramp, shallow end (keeps the tile's own light variation) |
| sand | rgb(236, 214, 168) | warm pale sand, clean edge against the teal |
| forest / grass | green ×(0.68, 1.00, 0.74) ×0.97 | rich green; hill-shading variation kept, so terrain texture survives |
| urban ground | contrast stretch ×1.30 around 140 + warm (R×1.06, B×0.84) | warm grey; city blocks read as a city |
| roads | Coral #FF527F | thin centrelines only (see below) |
| highways | Sunset #FFB56B | pale-yellow pixels (R>205, G>195, 25<R−B<60) |
| clouds (z0–z1) | white, ≤6% alpha | a few large soft puffs, global-coordinate field |

## How each surface is found

- **Water** — B ≥ R+45 and B ≥ G+25 (the app's own rule), with the B−G
  window widened to (5, 20). The source tiles are stitched from halves
  with a ±3-unit step in B−G mid-tile (27 vs 30), invisible in the pale
  original but amplified into a hard vertical seam when the mask sat on
  the steep part of the curve (v3 bug, found by measuring the graded
  tile). The B−R gate is what keeps blue-grey buildings out of the
  water mask, so the wide B−G window is safe. Mask blurred (σ=2) so
  JPEG block edges at the shore blend instead of stepping.
- **Green** — needs green over RED (G−R) as well as over blue. A G−B-only
  rule painted Ocean Beach lime green in v1 (sand is R>G>B with a big
  G−B). Unclassifiable pixels keep their real colour.
- **Roads** — road core rgb(209,209,219) and bright rooftop
  rgb(202,205,214) are ~7 units apart: NO pixel rule can separate
  them, and v1's brightness rule painted whole avenues solid pink.
  Geometry separates them instead: light-neutral pixels are thinned
  (Zhang–Suen) to centrelines, compact square blobs (rooftops) are
  dropped, small holes are filled first (a road band with a darker
  centre marking thins into a ladder of loops otherwise), short
  skeleton stubs (<30 px) are dropped, and skeleton pixels whose local
  light-region half-width exceeds 40 px are dropped (runways/aprons).
  The result is a 3 px coral centreline with a faint 7 px glow.
  At z≤3 roads and rooftops are sub-pixel, so light-neutral pixels get
  a soft rose tint (0.40) instead — the city reads pinkish at full
  zoom, like the reference.
- **Clouds** — a function of GLOBAL pixel coordinates (mapped back to
  z0 scale), so the field is seamless across tile borders by
  construction. Per-tile random fields (v1–v4) always read as a
  speckle rash or as mould at the seams. Faint on purpose: the
  reference has clouds at the sea edges, not a rash.
- **Ocean error tile** — `tiles/ocean.jpg` (missing/out-of-bounds
  tiles) is graded the same way, so the map edge never shows flat
  pale blue. It was already deep teal from v0.16; the grade moves it
  to (4, 55, 73), the styled sea.

## Iteration log (looked at, not just measured)

- v1: whole road bands solid coral; beach lime green; shore JPEG
  blocks; clouds read as mould. Not shippable.
- v2: thin pink centrelines, but pink dotted speckles on every rooftop
  (skeleton stubs of bright blobs) and loops on the beach road.
- v3: speckles and loops fixed; shore still blocky — traced to the
  source tiles' own ±3-unit stitch step, not to the grade.
- v4: seam gone (widened B−G window), waterfront uniform deep teal;
  clouds still a speckle rash at z0.
- v5: global-coordinate clouds — a few large soft faint puffs, no
  seams. Land rich green, sea deep teal, cities read, Vice City has a
  subtle pink glow. Shipped as the grade.

## What changed in the app (v0.18.0)

- `gtadbTileUrl` serves `tiles/styled/` (new revision constant
  `GTADB_STYLED_TILE_REVISION = 'v0.18.0-restyle-v5'`).
- The sea canvas is DELETED (`src/features/map/sea-overlay.ts` +
  its test removed, canvas creation + draw loop removed from
  `MapView.tsx`). The user's 4:54pm screenshot proved the v0.17
  "seamless sea" fix did not hold: the grade still ended mid-screen
  with flat teal and a ghost landmass on the right. The colour is now
  baked into the tiles, so there is no overlay, no mask rect and
  nothing left that can seam.
- The static tile-pane CSS filter (`saturate(1.18) contrast(1.05)
  brightness(0.93)`) is removed — it graded the pale tiles in the
  browser and would double-darken the styled ones. The pane now shows
  the tiles exactly as rendered.
- `ocean.jpg` re-graded to the styled sea.
- Kept, unchanged: camera gate (opens on the whole of Leonida),
  slim 56px header, bottom-bar empty-map prompt, 120-marker cap /
  24 hero pins, traced county outlines, spoiler-free defaults, real
  place data only (3,754 GTADB records, 986 named, 2,768 unnamed).

## Render counts

<!-- filled in by the render run; see the v0.18.0 RELEASES.md entry -->

- Tiles re-rendered: 31,022 (z0 12, z1 30, z2 99, z3 374, z4 1,496,
  z5 5,829, z6 23,182)
- Source size: 149 MB (`tiles/day/`); styled size: 92 MB of tile bytes (175 MB on disk with filesystem block overhead)
- Renderer: `python3 scripts/restyle-tiles.py --all` (4 workers),
  JPEG quality 88, same 256×256 tiles, same tile count.
- Honesty: a recolour/restyle of the real tiles, not new geography.
  If a surface cannot be classified confidently, the pixel keeps its
  real colour — never invented detail.
