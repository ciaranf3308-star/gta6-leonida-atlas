# VICEWIRE — reproducible build

One command, from a fresh clone to a verified production build
including the graded tile pyramid:

```sh
git clone https://github.com/ciaranf3308-star/gta6-leonida-atlas.git
cd gta6-leonida-atlas
git checkout spoiler-free-pwa
./scripts/build-from-clean.sh
```

The script checks prerequisites, installs JS deps, grades the whole
tile pyramid from the tracked day tiles, runs the one-command
production build, and verifies the result (tile counts + the
service-worker cache name is stable across a second finalize run).
It takes a while on a small box — the tile render is the long pole
(tens of minutes on 2 workers; `GRADE_WORKERS=4` if you have the
cores). It resumes cleanly: re-running it skips valid existing
tiles.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 22+ | `pnpm build` runs `tsc` + Vite |
| pnpm | 10+ (repo pins 12.18.0 via `packageManager`) | `pnpm install --frozen-lockfile` |
| Python | 3.10+ | `scripts/grade-tiles.py` |
| numpy, Pillow | any recent | the grade pipeline (no scikit-image needed) |
| scipy | only to *regenerate* the sea mask | `render-vicewire.py`, not the grade path |
| curl | any | optional elevation download attempt |

`PYTHONNOUSERSITE=1` hides the user-site numpy/Pillow on some
machines (including this sandbox). The script unsets it for every
Python step; if you run the grade script by hand, use
`env -u PYTHONNOUSERSITE python3 scripts/grade-tiles.py …`.

Disk: ~1 GB free for sources + the graded pyramid + `dist/`.
Never render into `/tmp` — it is cleaned out from under long runs.

## What is tracked, what is generated

| Path | State | Notes |
| --- | --- | --- |
| `tiles-source/day/` (31,022 JPGs) | **tracked** | The raw GTADB In-Game Day tiles. Source of truth; never overwritten. |
| `scripts/sea-mask-z2.png` | **tracked, derived** | Global sea mask on the z2 grid, built from the tracked z2 day tiles by `render-vicewire.py` `_build_sea_mask` (water test + largest-component labelling). sha256 `75f59459e841e95e714b095816b392f6c6aa6a580d167206c859b72db27c6495` — verified byte-identical to a fresh regeneration (v0.30.0). Needed by `grade-tiles.py --fill-ocean`. Regenerate with scipy if you ever doubt it. |
| `public/assets/gta6-leonida-atlas/tiles/graded/` (31,527 JPGs, ~197 MB) | **generated, gitignored** | Output of `scripts/grade-tiles.py --full` + `--fill-ocean`. Never commit 197 MB of derived JPEGs. |
| `dist/` | **generated, gitignored** | Output of `pnpm build`. |
| `build/` | **generated, gitignored** | Script scratch: sample renders, a downloaded elevation grid. |

## The grade pipeline

`scripts/grade-tiles.py` is a fixed per-pixel colour grade over the
raw day tiles — no resampling, no blur, no warp, no per-tile tuning,
no AI generation. Parameters live in `PARAMS` at the top of the file;
changing them means re-rendering the whole pyramid and re-checking
the zoom walk. Determinism: same input bytes → same output bytes
(fixed parameters, no RNG); re-running `--full` skips finished tiles
unless `--force`.

`--fill-ocean` renders the 505 missing y=0 ocean rows at z1–z3 from
the day sea's own colour through the same grade, after verifying
each candidate tile is pure ocean against the sea mask. A tile with
any land in it is skipped, never filled with sea.

`--check` verifies counts per zoom against `EXPECTED` and that
grading is deterministic on a sample.

## Hill-shading and the elevation grid

The grade applies a luminance-only hill-shade from GTADB's
`elevation.bin` (16-bit grid, 1536×1748). Provenance, corrected
v0.30.0 (research lane): the grid is **licence-grey** — GTADB's own
FAQ (Aug 2026) says it was "remodeled from the ground up… mostly
correct, shouldn't be treated as 100% accurate". It is **never
committed, vendored, or bundled**; only its gradients are used, at
render time, and absolute heights are unverified.

The build script looks for it as `$VICEWIRE_ELEVATION`, then
`~/workspace/vicewire-research/elevation2.bin`, then attempts a
download from `https://api.gtadb.org/data/6/elevation.bin` (expected
size 5,369,856 bytes). That download 403s from sandboxed networks —
expected, not fatal. Without the grid the grade runs with
hill-shading off and says so loudly: the tiles match the shipped
pyramid everywhere except the hills, which are flat. Geography never
changes either way.

## Content-hash asset versioning

`scripts/finalize-build.mjs` builds the service-worker cache name
from a SHA-256 over the app shell **and the actual bytes of every
tile in `tiles/graded/` plus `ocean.jpg`** (streamed, sorted order).
A tile re-render must also change the tile path (`gtadb-tiles.ts`) —
both layers, not one hope.

Two properties are tested in `tests/unit/atlas-security.test.ts`:

- A tile byte change **at the same file size** moves the cache name
  (v0.20.2–v0.29 hashed paths + sizes only, so a same-size re-render
  left phones serving stale tiles — the audit finding).
- An unchanged rebuild keeps the cache name. That includes
  finalize's SSR step: before v0.30.0 each finalize run appended
  another robots/og block to `dist/index.html`, so the hash moved on
  every build. The injected head block and root markup are now
  wrapped in `vicewire-ssr-*` sentinels and stripped before
  re-injection, so re-running finalize over its own output reproduces
  byte-identical files.

`finalize-build.mjs` takes ~35 s on the full 197 MB pyramid (mostly
the content hash + the SSR render). The test helper that shells out
to it allows 120 s (the old 30 s budget flaked as a spawnSync
ETIMEDOUT on loaded boxes).

## CI

`.github/workflows/ci.yml` runs on pushes to `main` **and**
`spoiler-free-pwa`, plus pull requests: typecheck, lint, the unit
suite, the production build, then a `--sample` grade-render smoke
test (proves the tile pipeline runs in CI without paying for the
full 31k-tile render) and the browser tests. The full pyramid render
lives in `.github/workflows/tiles.yml` (manual dispatch + weekly):
full grade + fill + `--check` + fingerprint-stability check. CI does
not ship tiles; deploys come from the lead's verified local build.

## Docs map

- `README.md` — what VICEWIRE is, fork vs upstream, quick start.
- `docs/SPOILER_FREE_FORK.md` — what changed vs upstream Leonida Atlas.
- `docs/METHODOLOGY.md` — source hierarchy and map treatment.
- `RELEASES.md` — release history, newest first.
- `THIRD_PARTY_LICENSES.md` — licences for bundled data and code.
