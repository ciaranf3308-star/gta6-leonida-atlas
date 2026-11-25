#!/usr/bin/env bash
# VICEWIRE — reproducible build from a clean checkout.
#
#   git clone <repo> && cd <repo> && git checkout spoiler-free-pwa
#   ./scripts/build-from-clean.sh
#
# Goes from a fresh clone to a verified production build in dist/,
# INCLUDING the graded tile pyramid (31,022 tiles + 505 ocean fill).
# No tribal knowledge: every step is in this script and docs/BUILD.md.
#
# What it does, in order:
#   1. Checks prerequisites (Node 22+, pnpm 10+, Python 3.10+, numpy, Pillow).
#   2. pnpm install --frozen-lockfile.
#   3. Finds the elevation grid for hill-shading (see below) or warns
#      loudly and grades without it — the build never fails on this.
#   4. python3 scripts/grade-tiles.py --full (resumes by skipping
#      valid existing tiles), --fill-ocean, --check.
#   5. ATLAS_BASE_PATH=/gta6-leonida-atlas/ pnpm build (tsc + vite +
#      finalize-build.mjs, which content-hashes the tile pyramid into
#      the service-worker cache name).
#   6. Verifies: tile counts in dist/, and that running finalize twice
#      produces the same SW cache name (the v0.30 idempotency proof).
#
# Elevation (hill-shade): the grid is GTADB's elevation.bin —
# licence-grey (GTADB FAQ, Aug 2026: "remodeled from the ground up…
# mostly correct, shouldn't be treated as 100% accurate"). It is
# NEVER committed or bundled. The script looks for it in this order:
#   a. $VICEWIRE_ELEVATION, if set and the file exists;
#   b. ~/workspace/vicewire-research/elevation2.bin (the research copy);
#   c. a download attempt from https://api.gtadb.org/data/6/elevation.bin
#      into build/elevation.bin (gitignored) — this 403s from some
#      networks, including the sandbox; that is expected, not fatal.
# Without it the grade runs with hill-shading off and says so: the
# tiles are identical except the hills are flat. The shipped pyramid
# was graded WITH hill-shading, so a no-elevation build differs from
# the live tiles in shading only — never in geography.
#
# Python: some shells export PYTHONNOUSERSITE=1, which hides the user
# site where numpy/Pillow live. This script unsets it for every python
# step. Never render into /tmp — it is cleaned out from under long
# runs on this box; the render writes under the repo (gitignored).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

step() { echo; echo "=== $1 ==="; }
fail() { echo "ERROR: $1" >&2; exit 1; }

step "1/6 prerequisites"
command -v node >/dev/null 2>&1 || fail "node not found (need Node 22+)"
command -v pnpm >/dev/null 2>&1 || fail "pnpm not found (need pnpm 10+)"
command -v python3 >/dev/null 2>&1 || fail "python3 not found (need Python 3.10+)"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node 22+ required, found $(node --version)"
echo "node $(node --version)  pnpm $(pnpm --version)  python3 $(python3 --version)"
echo "disk free in repo: $(df -h "$ROOT" | awk 'NR==2 {print $4}') (pyramid needs ~1 GB incl. sources)"

# The sandbox and some CI images set PYTHONNOUSERSITE=1, which hides
# the user-site numpy/Pillow/scikit-image the tile scripts need.
unset PYTHONNOUSERSITE

step "2/6 JavaScript dependencies"
pnpm install --frozen-lockfile

step "3/6 Python tile dependencies (numpy, Pillow)"
if ! python3 -c "import numpy, PIL" 2>/dev/null; then
  echo "numpy/Pillow not importable — installing into user site..."
  python3 -m pip install --user --quiet numpy pillow \
    || fail "pip install failed; install numpy and Pillow manually: python3 -m pip install --user numpy pillow"
  python3 -c "import numpy, PIL" \
    || fail "numpy/Pillow still not importable after install"
fi
python3 -c "import numpy, PIL; print('numpy', numpy.__version__, '| Pillow', PIL.__version__)"

step "4/6 elevation grid for hill-shading (optional, warned if absent)"
ELEV=""
if [ -n "${VICEWIRE_ELEVATION:-}" ] && [ -f "$VICEWIRE_ELEVATION" ]; then
  ELEV="$VICEWIRE_ELEVATION"
  echo "using VICEWIRE_ELEVATION=$ELEV"
elif [ -f "$HOME/workspace/vicewire-research/elevation2.bin" ]; then
  ELEV="$HOME/workspace/vicewire-research/elevation2.bin"
  echo "using research copy $ELEV"
else
  mkdir -p "$ROOT/build"
  echo "trying GTADB download (may 403 from sandboxed networks — not fatal)..."
  if curl -fsSL --max-time 60 "https://api.gtadb.org/data/6/elevation.bin" \
      -o "$ROOT/build/elevation.bin" 2>/dev/null \
     && [ "$(stat -c%s "$ROOT/build/elevation.bin" 2>/dev/null || echo 0)" = "5369856" ]; then
    ELEV="$ROOT/build/elevation.bin"
    echo "downloaded elevation grid to $ELEV"
  else
    rm -f "$ROOT/build/elevation.bin"
    echo "WARNING: no elevation grid available — grading WITHOUT hill-shading."
    echo "The tiles will match the shipped pyramid everywhere except the"
    echo "hills, which will be flat. To reproduce the shipped shading,"
    echo "place elevation.bin at \$VICEWIRE_ELEVATION and re-run."
  fi
fi
if [ -n "$ELEV" ]; then export VICEWIRE_ELEVATION="$ELEV"; fi

step "5/6 graded tile pyramid (31,022 tiles + 505 ocean fill)"
echo "source: tiles-source/day/ (tracked in git)"
echo "output: public/assets/gta6-leonida-atlas/tiles/graded/ (generated, gitignored)"
echo "sea mask: scripts/sea-mask-z2.png (tracked derived artifact, sha256 75f59459e841e95e714b095816b392f6c6aa6a580d167206c859b72db27c6495)"
START="$(date +%s)"
python3 scripts/grade-tiles.py --full --workers "${GRADE_WORKERS:-2}"
python3 scripts/grade-tiles.py --fill-ocean
python3 scripts/grade-tiles.py --check
echo "tile render took $(( ($(date +%s) - START) / 60 )) min"

step "6/6 production build + verification"
export ATLAS_BASE_PATH=/gta6-leonida-atlas/
pnpm build
echo "--- dist tile counts ---"
for z in 0 1 2 3 4 5 6; do
  printf "z%s: %s tiles\n" "$z" "$(find "dist/assets/gta6-leonida-atlas/tiles/graded/$z" -name '*.jpg' 2>/dev/null | wc -l)"
done
CACHE_A="$(grep -o 'const CACHE="[^"]*"' dist/sw.js)"
node scripts/finalize-build.mjs >/dev/null
CACHE_B="$(grep -o 'const CACHE="[^"]*"' dist/sw.js)"
echo "SW cache after build:    $CACHE_A"
echo "SW cache after re-run:   $CACHE_B"
[ "$CACHE_A" = "$CACHE_B" ] \
  || fail "finalize is not idempotent: cache name moved on an unchanged rebuild"
echo
echo "CLEAN BUILD OK — dist/ is a verified production build."
echo "Next: serve it (pnpm start, port 4330) and run the walks:"
echo "  node scripts/check-graded-walk.mjs   (basemap, 390px DPR 2)"
echo "  node scripts/check-v026-app.mjs      (app)"
