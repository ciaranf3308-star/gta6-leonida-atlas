# Methodology

GTA6 Leonida Atlas separates visual references, community-estimated data and local reconstruction.

## Source hierarchy

1. Rockstar Games official GTA VI media can support official visual identity or existence.
2. GTADB / Map GTA community reconstruction data can support approximate placement and catalogue entries.
3. Florida/Miami references are secondary atmosphere analogues only and are not treated as GTA VI truth.

## Map treatment

The public basemap is the GTADB In-Game Day tile pyramid
(`tiles-source/day/`, tracked in git), served through a fixed
per-pixel colour grade only (`scripts/grade-tiles.py`, v0.28.0) —
deeper teal water, stronger contrast, warm cream roads, hill-shading
kept as a luminance-only modulation. Geography is locked 1:1 to the
source tiles: no resampling, no repaint, no invented places. It is
not an official Rockstar map. The Yanis v16 raster is retained only
for the 3D explorer's reconstruction, not the 2D basemap.

The landmark catalogue and basemap have separate pins. The November 17, 2026
landmark refresh uses GTADB commit `d406fea099e1df2bce42fd6b87eed04bce646629` and keeps
all 2,198 previous identifiers. It adds 1,233 records, with 3,340 positioned and
91 unpositioned records in total. Existing saved places still refer to the same
IDs. A public map position may move when the source record changes.

The app keeps the established GTADB-derived coordinate frame aligned between the 2D map and the 3D explorer.

## Uncertainty labels

- `APPROXIMATE`: transformed, generalized or reconstructed placement.
- `UNKNOWN`: no mapped source coverage, unknown name or source-flagged uncertainty.
- `SUPPORTED`: community-estimated placement with usable source context.
- `CONFIRMED`: reserved for official visual identity or existence when supported by Rockstar media.

Unknown or low-evidence areas may be visually integrated so the interface feels complete, but they must not be presented as confirmed geography, roads or landmarks.

