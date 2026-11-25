# VICEWIRE — GTA VI Leonida Map

A spoiler-free, local-first, installable map of GTA VI's Leonida.
The real in-game map (GTADB), colour-graded for depth and contrast —
no repaint, no invented places, no AI-generated geography.

**Live:** https://ciaranf3308-star.github.io/gta6-leonida-atlas/
· **Branch:** `spoiler-free-pwa` (upstream `main` untouched)

> VICEWIRE is an independent fan project. It is not affiliated with
> or endorsed by Rockstar Games or Take-Two Interactive. Place
> positions are approximate community data, and unknown locations
> remain unknown.

## What it is

- **The real map.** The basemap is the GTADB In-Game Day tile
  pyramid (`tiles-source/day/`, tracked in git), served through a
  colour grade only (`scripts/grade-tiles.py`): deeper teal water,
  stronger contrast, warm cream roads, hill-shading kept as a
  luminance-only modulation. Geography is locked 1:1 — a pin on a
  road stays on that road.
- **Spoiler-free by default.** Every public layer starts **off**.
  First load shows only the blank Leonida basemap — no pins, no
  labels. You turn on exactly what you ask for, one tap at a time.
  See `docs/SPOILER_FREE_FORK.md`.
- **Your data stays yours.** Favorites, notes, markers, tags and
  backups live on your device (IndexedDB + portable backup files).
  No account, no backend, no tracking.
- **Ask Nylah.** An optional finder that answers in plain language
  from the layers you turned on — never volunteering places from
  layers you didn't ask about. Bring your own OpenAI key, stored
  on-device only, never bundled or exported.
- **Installable.** A PWA: add to home screen, reopen offline after
  the first complete load.

## VICEWIRE vs upstream Leonida Atlas

VICEWIRE is a fork of [Leonida Atlas](https://github.com/navanem/gta6-leonida-atlas)
(AGPL-3.0). Upstream is the community atlas this fork started from;
it is not this app. What changed:

- Spoiler-free defaults and the game's own 9 Map Index categories
  (Personal / Story / Robberies / Activities / Exploration /
  Vehicles / Weapons / Style / Food & Drink) instead of generic
  business/personal browsing.
- The basemap is the real GTADB day map, colour-graded in-repo —
  not upstream's recolored community reconstruction, and not the
  ViceWire geometry-driven repaints (v0.24–v0.27, stripped in
  v0.28.0).
- Place cards with verified-only loot and collectables, custom
  secondary tags ("Your tag"), mark-as-explored, and a rebuilt
  first-open flow (Vice City region sheet, Layers as a sheet).
- Tile prefetch + a 6,000-entry service-worker tile cache, so
  panning and zooming stay snappy (v0.29.0).
- Content-hash asset versioning: the service-worker cache name is
  a SHA-256 of the app shell **and the actual tile bytes**, so a
  re-render can never hide behind an unchanged filename (v0.30.0).

Upstream `main` is untouched in this repo; all VICEWIRE work lives
on `spoiler-free-pwa`. Upstream links, badges and the v0.8.2 release
line in the old README described the upstream project, not this one.

## Data provenance

- **Basemap + places:** GTADB / Map GTA community reconstruction
  — data CC BY 4.0, code MIT (`github.com/rolux/gtadb.org`).
  Landmark catalogue pinned at revision `d406fea`. Map artwork
  © Rockstar Games.
- **Elevation (hill-shade only):** GTADB `elevation.bin`, licence-grey
  (GTADB FAQ, Aug 2026: "remodeled from the ground up… mostly
  correct, shouldn't be treated as 100% accurate"). Used for
  hill-shading gradients only, at render time, never committed,
  vendored, or bundled. Absolute heights unverified.
- **No fbritoferreira / Open GTA 6 Map data is used** in the live
  app — its road vectors powered the stripped v0.24–v0.27 renders
  only, and were removed with them. It survives in the release
  history as a record of what was tried.
- Full inventory: `THIRD_PARTY_LICENSES.md` · `docs/METHODOLOGY.md`.

## Build it yourself

Prerequisites: Node.js 22+, pnpm 10+ (repo pins 12.18.0),
Python 3.10+ with numpy + Pillow. One command from a clean clone:

```sh
git clone https://github.com/ciaranf3308-star/gta6-leonida-atlas.git
cd gta6-leonida-atlas
git checkout spoiler-free-pwa
./scripts/build-from-clean.sh
```

That installs dependencies, grades the full tile pyramid from the
tracked day tiles, runs the production build, and verifies it (tile
counts + a stable service-worker cache name). Full instructions,
what is tracked vs generated, and the elevation story:
[`docs/BUILD.md`](docs/BUILD.md).

Day-to-day commands (`pnpm`):

| Command | What it does |
| --- | --- |
| `pnpm dev` | Local dev server |
| `pnpm typecheck` / `pnpm lint` | Types / lint |
| `pnpm test:unit` | Unit suite (vitest) |
| `pnpm test:e2e` | Browser tests (Playwright, Chromium + WebKit) |
| `pnpm build` | One-command production build (`tsc` + Vite + finalize). Run with `ATLAS_BASE_PATH=/gta6-leonida-atlas/` exported for the deployed path. |
| `pnpm build:clean` | The clean-checkout script above |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, unit tests,
the production build, a tile-grade smoke test and browser tests on
every push to `main` and `spoiler-free-pwa`. The full tile render
runs on manual dispatch / weekly (`.github/workflows/tiles.yml`).

## Deploy

Deploys go to GitHub Pages via the `gh-pages` branch from a
verified local build (`dist/` rsynced into the `gh-pages`
worktree). `main` is never deployed from this fork.

## Releases

History, newest first: [`RELEASES.md`](RELEASES.md).
Current: **v0.30.0**.
