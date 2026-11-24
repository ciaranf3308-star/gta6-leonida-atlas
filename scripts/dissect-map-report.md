# Map pixel dissection — GTADB In-Game Day tiles (z5, 16-unit cells)

Tiles read: 5829; missing slots treated as ocean: 6459.
Sampled cells: 3,145,728 over -16384..8192 x -16384..16384.
Classification is the app's own `classifyGtadbSurfacePixel` rule
(walk-cartography.ts) — water is blue >= red+45 and blue >= green+25.

## Surface mix (classifier buckets)

The classifier is strict: its vegetation rule needs a strong green
dominance, so much of the map's green falls into "unknown" (mean
colour green-grey). Read the buckets as a rough mix, not as truth —
the sampled spot colours below are the ground truth for palette work.

| class | share | mean colour |
|---|---|---|
| water | 88.7% | rgb(19, 58, 71) |
| vegetation | 0.1% | rgb(122, 149, 107) |
| ink | 0.0% | rgb(0, 0, 0) |
| road | 0.0% | rgb(86, 103, 91) |
| pavement | 0.0% | rgb(122, 135, 125) |
| building | 1.5% | rgb(162, 168, 175) |
| ground | 1.3% | rgb(208, 211, 215) |
| marking | 0.0% | rgb(0, 0, 0) |
| unknown | 8.5% | rgb(116, 155, 141) |

## Sampled spot colours (real tile pixels, 128x128-unit windows)

- open ocean east of Vice City (3500, 2000): rgb(49, 146, 178)
- shore water off Ocean Beach (2250, 350): rgb(76, 160, 188)
- Ocean Beach sand (2110, 550): rgb(194, 186, 156)
- Vice Beach city blocks (1500, 500): rgb(167, 175, 188)
- Mount Kalaga forest (-4200, 7500): rgb(84, 125, 100)
- Capri streets (-6500, 200): rgb(155, 174, 185)

## What this means for the After Hours palette

- Water is bright teal-blue — open ocean rgb(49, 146, 178), shore
  water rgb(76, 160, 188). Coral #FF527F clusters and ivory labels
  both read on it; the sea shimmer must stay faint or it fights
  the tile's own water shading.
- Sand is pale warm tan rgb(194, 186, 156) — coral pins read on it,
  sunset #FFB56B pins do not (too close to sand). Keep sunset for
  text and small accents only, never for pins on sand.
- City blocks are pale grey-blue rgb(167, 175, 188), forest muted
  green rgb(84, 125, 100) — coral reads on both; ivory place labels
  need their dark chip behind them on roads, as they already have.

## Coastline (traced, not drawn)

Total traced coastline: 307,526 canonical units.
Per-county outlines (coast = traced from tiles, estimate = on the
estimated rect edge — no official boundary lines are published):

- Lummox County: 25 land rings, 25 coast runs (47,723 units traced), 10 estimate runs (9,402 units on the rect edge), 516 outline points
- Kelly County: 23 land rings, 23 coast runs (38,400 units traced), 7 estimate runs (13,749 units on the rect edge), 459 outline points
- Leonard County: 10 land rings, 13 coast runs (24,978 units traced), 8 estimate runs (12,477 units on the rect edge), 286 outline points
- Vice-Dale County: 10 land rings, 12 coast runs (34,460 units traced), 9 estimate runs (13,285 units on the rect edge), 363 outline points
- Mariana County: 81 land rings, 83 coast runs (161,966 units traced), 8 estimate runs (10,036 units on the rect edge), 1866 outline points

## Honesty notes

- Inland county edges are estimates from GTADB records that name the
  county (see src/data/counties.ts). Only the coastline is traced.
- The mask grid is 16 units/cell; the outline is simplified to a
  24-unit tolerance, so fine coves under ~24 units are smoothed.
- Missing tile slots are open ocean by construction (the app's
  errorTileUrl is ocean.jpg).

