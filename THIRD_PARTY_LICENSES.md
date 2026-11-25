# Third-party licenses and attribution

GTA6 Leonida Atlas separates project source code from third-party data and references.

## Project code

Original GTA6 Leonida Atlas source code in this repository is licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`). See [LICENSE](./LICENSE).

## GTADB / Map GTA data

Some data and cartographic source material used by GTA6 Leonida Atlas originates from `gtadb.org` / Map GTA community reconstruction material.

- Source: https://github.com/rolux/gtadb.org
- Map: https://map.gtadb.org
- Pinned landmark catalogue revision: `2e9e194b497d7a1a7da4f2288c1065dc0b913e80`
- Basemap: the GTADB In-Game Day tile pyramid (`tiles-source/day/`,
  tracked in git), served through a fixed per-pixel colour grade
  (`scripts/grade-tiles.py`, v0.28.0). Geography locked 1:1 to the
  source tiles. The Yanis v16 basemap revision
  (`7c3f8c295d64254e6b6d269b77c6f84fc4339f9c`) is retained only for
  the 3D explorer's reconstruction, not the 2D basemap.
- Elevation grid (`elevation.bin`, hill-shading only): licence-grey
  per GTADB's own FAQ (Aug 2026) — "remodeled from the ground up…
  mostly correct, shouldn't be treated as 100% accurate". Used for
  hill-shading gradients only, at render time, never committed,
  vendored, or bundled. Absolute heights unverified.
- Data license: Creative Commons Attribution 4.0 International (`CC BY 4.0`)
- License URL: https://creativecommons.org/licenses/by/4.0/
- Attribution: `gtadb.org` and contributors

Adaptations made in this repository may include coordinate transforms, filtering, rendering windows, generalized/recolored basemap presentation, and derived metadata used to label entries as positioned, unpositioned, supported or uncertain.

Data originating from `gtadb.org` remains under CC BY 4.0 and must retain attribution.

## gta6-leonida-map-data / gta6maps.io

County stunt-jump counts and 100% completion thresholds used by GTA6 Leonida Atlas (v0.31.0) originate from `gta6-leonida-map-data`.

- Source: https://github.com/duanhesen/gta6-leonida-map-data
- Site: https://gta6maps.io
- Pinned commit: `1c5977bb9c40401667a192f14239beebbde54211` (2026-11-23)
- Files used: `data/leonida-counties-summary.csv` (130 stunt jumps by county — Vice-Dale 53, Kelly 29, Lummox 19, Mariana 16, Leonard 13) and `data/completion-100-thresholds.json` (19 categories; 1,325 required for 100%, 1,962 in game in total). Only aggregate counts were used — no per-item detail, no story content.
- Data license: Creative Commons Attribution 4.0 International (`CC BY 4.0`)
- License URL: https://creativecommons.org/licenses/by/4.0/
- Archive: Zenodo DOI 10.5281/zenodo.24412576 (https://doi.org/10.5281/zenodo.24412576)
- Attribution: `gta6-leonida-map-data` and contributors

The same repository's 798 markers (`data/gta-6-markers.csv` / `data/gta-6-markers.json`) were NOT imported: their `x`/`y` are normalized 0–1 schematic coordinates on the source's own map. Fitted against the GTADB frame on the 774 markers whose ids match GTADB records, the best affine transform leaves a median error of ~2.1 km (p90 ~3.9 km, max ~8.5 km; only 2 of 774 within 100 m). The 774 matched markers duplicate places the GTADB catalogue already carries with verified positions; the 24 unmatched markers cannot be verified at all. See `hidden_files/v031-county/markers-inventory.md` in the project goal workspace for the full per-type analysis. County extents shown in the atlas remain estimates — the official poster prints county names but no boundary lines.

## GTA 6 Loot Map / theihtishaam

Bank jobs & vaults (29 places) and Loot Map collectibles (20 places) used by GTA6 Leonida Atlas (v0.31.1) originate from the GTA 6 Loot Map community dataset. Only PLACE DATA was used — coordinates, names and guide descriptions, read from the dataset's JSON place lists (`public/collectible-guides.json`, `guides.json`, `guide-positions.json`). No code from that repository was run, installed, imported or copied.

- Source: https://github.com/theihtishaam/GTA-6-Interactive-Map-and-Loot-Tracker
- Pinned version: `v0.1.5`, commit `95dabd3` (2026-11-25)
- Files used: `guides.json` (75 records — 29 heists and 10 collectibles imported) and `collectible-guides.json` (10 meditations, all imported). Normalised 0–1 coordinates were converted to GTADB game metres (gameX = x · 13824 − 10240, gameY = 10496 − y · 19456) and verified before import: in bounds, inside the GTADB landmass box, no position conflicts, no duplicates of existing card pins, landmarkId cross-checked against the GTADB snapshot.
- Data license: MIT
- Attribution: `GTA 6 Loot Map` and contributors

Records NOT imported: earbuds (15 — duplicate GTADB shop venues), leisure (8), reward (8), bag (1), story missions (176 — spoiler design needed, separate lane), `landmarks.json` (a GTADB re-import), `roads.json`, and `community.json` (empty). Two heist records were excluded for position conflicts (venue vs registered marker >100 m apart: downtown-shorefront ~553 m, rockridge-shorefront ~147 m). One meditation (Kalaga) and one card (Vicki) were duplicates of existing places and imported once / excluded respectively. Every imported record is UNVERIFIED-tier (evidence: 'uncertain') — community-sourced guide positions (PowerPyx / games.gg), registered from guide screenshots, not in-game verified — and both layers are OFF by default. See `hidden_files/v031-loot/VERIFICATION.md` and `REJECTED.md` in the project goal workspace for the full per-record verification.

## GTADB code

If code is copied directly from `gtadb.org`, it remains subject to that project's MIT license and copyright notices. This release is structured to keep direct third-party code notices here when applicable.

## Rockstar Games references

Rockstar Games / Take-Two Interactive own Grand Theft Auto, Grand Theft Auto VI, GTA VI names, logos, imagery, video and related intellectual property.

Rockstar media is used only as cited visual/reference evidence and outbound source attribution. It is not licensed as part of this repository.

GTA6 Leonida Atlas is an independent fan/community project and is not affiliated with, endorsed by or sponsored by Rockstar Games or Take-Two Interactive.

## Photographic surface maps — v0.8.0

The following Poly Haven assets are licensed under **CC0-1.0** ([asset license](https://polyhaven.com/license)). Clean Asphalt uses its documented 2.1 m physical coverage in the road shader. Their 1K diffuse, OpenGL normal and roughness maps are served locally as WebP. The diffuse/roughness maps use quality 88; normals use lossless encoding. No cropping or resampling was applied.

- [Clean Asphalt](https://polyhaven.com/a/clean_asphalt)
- [Concrete Wall 007](https://polyhaven.com/a/concrete_wall_007)
- [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry)
- [Wood Planks Grey](https://polyhaven.com/a/wood_planks_grey)
- [Sandy Gravel 02](https://polyhaven.com/a/sandy_gravel_02)

Acquired on 6 September 2026 through the public asset API. Exact download URLs, source and converted SHA-256 checksums, dimensions and byte sizes are recorded in `public/assets/street-leonida/surfaces/manifest.json`. These generic surface materials are original Poly Haven assets, not textures extracted from GTA.
