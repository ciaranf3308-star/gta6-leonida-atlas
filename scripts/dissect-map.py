#!/usr/bin/env python3
"""Pixel-dissect the real GTADB In-Game Day tiles (After Hours, v0.15.0).

Reads every z5 day tile under public/assets/gta6-leonida-atlas/tiles/day/5/,
classifies each 16-unit cell with the SAME rule the app's 3D explorer uses
(`classifyGtadbSurfacePixel` in src/features/street-leonida/walk-cartography.ts:
water is blue >= red+45 and blue >= green+25), and derives from that grid:

  1. public/assets/after-hours/sea-mask.png — the water mask over the full
     tile bounds, for the animated-sea overlay (768x1024, water = white).
  2. public/assets/after-hours/after-hours-geo.json — per-county traced
     outlines: the coastline of the land inside each estimated county rect
     ("coast", traced from the tiles) and the rect-edge stretches
     ("estimate", still an estimate — no official boundary lines exist),
     plus the land rings ("loops") used as holes in the isolation dim mask.
  3. scripts/dissect-map-report.md — what the pixels actually say:
     class percentages, dominant colours, coastline length, per-county
     outline stats. Read it before tuning pin/cluster colours.

Nothing here invents geography: the coastline comes from the tiles, the
county rects come from src/data/counties.ts (parsed, not copied), and any
edge that is not coastline is labelled "estimate" in the output.

Run: python3 scripts/dissect-map.py
"""

import json
import math
import os
import re
import sys
from collections import defaultdict

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILE_DIR = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/day/5")
COUNTIES_TS = os.path.join(ROOT, "src/data/counties.ts")
MASK_OUT = os.path.join(ROOT, "public/assets/after-hours/sea-mask.png")
GEO_OUT = os.path.join(ROOT, "public/assets/after-hours/after-hours-geo.json")
REPORT_OUT = os.path.join(ROOT, "scripts/dissect-map-report.md")

# Full GTADB tile coverage (src/features/map/gtadb-tiles.ts).
WEST, EAST, SOUTH, NORTH = -16384, 8192, -16384, 16384
CELL = 16  # canonical units per grid cell
COLS = (EAST - WEST) // CELL  # 1536
ROWS = (NORTH - SOUTH) // CELL  # 2048
ZOOM = 5
TILE_PX = 256

# Same rule as classifyGtadbSurfacePixel (walk-cartography.ts).
CLASS_NAMES = [
    "water",
    "vegetation",
    "ink",
    "road",
    "pavement",
    "building",
    "ground",
    "marking",
    "unknown",
]


def classify_block(rgb):
    """Vectorised classifyGtadbSurfacePixel over an (h, w, 3) uint8 array."""
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    out = np.full(r.shape, 8, dtype=np.uint8)  # unknown
    water = (b >= r + 45) & (b >= g + 25)
    out[water] = 0
    veg = (~water) & (g >= r + 12) & (g >= b + 40)
    out[veg] = 1
    rest = ~(water | veg)
    spread = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    light = (r + g + b) / 3.0
    out[rest & (spread > 18)] = 8
    out[rest & (spread <= 18) & (light <= 28)] = 2  # ink
    out[rest & (spread <= 18) & (light >= 244)] = 7  # marking
    out[rest & (spread <= 18) & (light >= 55) & (light <= 101)] = 3  # road
    out[rest & (spread <= 18) & (light > 101) & (light <= 138)] = 4  # pavement
    out[rest & (spread <= 18) & (light >= 150) & (light <= 197)] = 5  # building
    out[rest & (spread <= 18) & (light > 197) & (light < 244)] = 6  # ground
    return out


def parse_counties():
    """County rects straight from src/data/counties.ts — never copied."""
    text = open(COUNTIES_TS).read()
    pattern = re.compile(
        r"id: '([a-z-]+)',\s*\n\s*name: '([^']+)',\s*\n\s*area: '([^']+)',"
        r"\s*\n\s*photo: '([^']+)',\s*\n\s*bounds: \{ west: (-?\d+), east: (-?\d+),"
        r" south: (-?\d+), north: (-?\d+) \}",
    )
    counties = []
    for m in pattern.finditer(text):
        counties.append(
            {
                "id": m.group(1),
                "name": m.group(2),
                "area": m.group(3),
                "photo": m.group(4),
                "bounds": {
                    "west": int(m.group(5)),
                    "east": int(m.group(6)),
                    "south": int(m.group(7)),
                    "north": int(m.group(8)),
                },
            }
        )
    if len(counties) != 5:
        raise SystemExit(f"expected 5 counties in counties.ts, parsed {len(counties)}")
    return counties


def build_grid():
    """Classify the tile set into a (ROWS, COLS) class grid + water mask."""
    grid = np.full((ROWS, COLS), 8, dtype=np.uint8)
    counts = np.zeros(len(CLASS_NAMES), dtype=np.int64)
    sums = np.zeros((len(CLASS_NAMES), 3), dtype=np.float64)
    tiles_read = 0
    tiles_missing = 0
    # Tile (tx, ty): tx = floor((x + 16384) / 256), ty = floor((16384 - y) / 256).
    for ty in range(0, (NORTH - SOUTH) // TILE_PX + 1):
        for tx in range(0, (EAST - WEST) // TILE_PX + 1):
            path = os.path.join(TILE_DIR, f"{ZOOM},{ty},{tx}.jpg")
            r0, r1 = ty * (TILE_PX // CELL), (ty + 1) * (TILE_PX // CELL)
            c0, c1 = tx * (TILE_PX // CELL), (tx + 1) * (TILE_PX // CELL)
            if r0 >= ROWS or c0 >= COLS:
                continue
            r1 = min(r1, ROWS)
            c1 = min(c1, COLS)
            if not os.path.exists(path):
                # No tile file: open ocean (the app's errorTileUrl is ocean.jpg).
                tiles_missing += 1
                grid[r0:r1, c0:c1] = 0
                counts[0] += (r1 - r0) * (c1 - c0)
                continue
            tiles_read += 1
            img = np.asarray(Image.open(path).convert("RGB"))
            # Centre pixel of each 16x16 block: offsets 8, 24, ... 248.
            block = img[8::CELL, 8::CELL]
            classes = classify_block(block)
            grid[r0:r1, c0:c1] = classes[: r1 - r0, : c1 - c0]
            for ci in range(len(CLASS_NAMES)):
                sel = classes == ci
                n = int(sel.sum())
                counts[ci] += n
                if n:
                    sums[ci] += block[sel].reshape(-1, 3).sum(axis=0)
    return grid, counts, sums, tiles_read, tiles_missing


def boundary_segments(mask):
    """Boundary edges of a boolean mask as (p1, p2) corner pairs.

    Corners are (row, col) grid points; a cell's four corners are
    (r, c), (r, c+1), (r+1, c), (r+1, c+1). An edge between a land cell
    and a water/outside cell is a boundary edge.
    """
    rows, cols = mask.shape
    segs = []
    # North edge of land cells (row r, between (r, c) and (r, c+1)).
    north = mask & ~np.vstack([np.zeros((1, cols), bool), mask[:-1, :]])
    south = mask & ~np.vstack([mask[1:, :], np.zeros((1, cols), bool)])
    west = mask & ~np.hstack([np.zeros((rows, 1), bool), mask[:, :-1]])
    east = mask & ~np.hstack([mask[:, 1:], np.zeros((rows, 1), bool)])
    rr, cc = np.nonzero(north)
    segs += [((int(r), int(c)), (int(r), int(c) + 1)) for r, c in zip(rr, cc)]
    rr, cc = np.nonzero(south)
    segs += [((int(r) + 1, int(c)), (int(r) + 1, int(c) + 1)) for r, c in zip(rr, cc)]
    rr, cc = np.nonzero(west)
    segs += [((int(r), int(c)), (int(r) + 1, int(c))) for r, c in zip(rr, cc)]
    rr, cc = np.nonzero(east)
    segs += [((int(r), int(c) + 1), (int(r) + 1, int(c) + 1)) for r, c in zip(rr, cc)]
    return segs


def chain_segments(segs):
    """Chain boundary segments into ordered loops/polylines."""
    by_point = defaultdict(list)
    for i, (a, b) in enumerate(segs):
        by_point[a].append(i)
        by_point[b].append(i)
    used = [False] * len(segs)
    chains = []
    for i, (a, b) in enumerate(segs):
        if used[i]:
            continue
        used[i] = True
        chain = [a, b]
        # Walk forward from b.
        while True:
            nxt = [j for j in by_point[chain[-1]] if not used[j]]
            if not nxt:
                break
            j = nxt[0]
            used[j] = True
            p, q = segs[j]
            chain.append(q if p == chain[-1] else p)
        # Walk backward from a (unless the chain closed).
        if chain[0] != chain[-1]:
            while True:
                nxt = [j for j in by_point[chain[0]] if not used[j]]
                if not nxt:
                    break
                j = nxt[0]
                used[j] = True
                p, q = segs[j]
                chain.insert(0, q if p == chain[0] else p)
        chains.append(chain)
    return chains


def douglas_peucker(points, tolerance):
    """Simplify a polyline (list of (x, y)); iterative, no recursion."""
    if len(points) <= 2:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    tol2 = tolerance * tolerance
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        length2 = dx * dx + dy * dy
        worst, worst_i = 0.0, -1
        for i in range(a + 1, b):
            px, py = points[i]
            if length2 == 0:
                d2 = (px - ax) ** 2 + (py - ay) ** 2
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / length2))
                qx, qy = ax + t * dx, ay + t * dy
                d2 = (px - qx) ** 2 + (py - qy) ** 2
            if d2 > worst:
                worst, worst_i = d2, i
        if worst > tol2 and worst_i > 0:
            keep[worst_i] = True
            stack.append((a, worst_i))
            stack.append((worst_i, b))
    return [p for p, k in zip(points, keep) if k]


def grid_to_canonical(point):
    """Grid corner (row, col) -> canonical game [x, y]."""
    row, col = point
    return [WEST + col * CELL, NORTH - row * CELL]


def chain_length_canonical(points):
    total = 0.0
    for (x1, y1), (x2, y2) in zip(points, points[1:]):
        total += math.hypot(x2 - x1, y2 - y1)
    return total


def point_in_polygon(x, y, poly):
    """Even-odd ray casting for a ring of [x, y] points."""
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xin = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xin:
                inside = not inside
    return inside


def trace_county(land, bounds):
    """Traced outline of the land inside one estimated county rect.

    Returns (loops, coast_runs, estimate_runs) in canonical coords.
    A loop vertex is an "estimate" vertex when it sits on the rect edge
    (the land continues past the rect there, so the edge is the estimated
    border); every other vertex is traced coastline. Only OUTER loops
    count: a lake shore inside the county is a hole in the land, not a
    county boundary, so rings contained in another ring are dropped
    (even-odd: an island in a lake is land again, and is kept).
    """
    r0 = max(0, int((NORTH - bounds["north"]) // CELL))
    r1 = min(ROWS, int(math.ceil((NORTH - bounds["south"]) / CELL)))
    c0 = max(0, int((bounds["west"] - WEST) // CELL))
    c1 = min(COLS, int(math.ceil((bounds["east"] - WEST) / CELL)))
    sub = land[r0:r1, c0:c1]
    segs = boundary_segments(sub)
    # Shift segment corners back into full-grid coordinates.
    segs = [((r + r0, c + c0), (r2 + r0, c2 + c0)) for (r, c), (r2, c2) in segs]
    chains = chain_segments(segs)
    rings = []
    for chain in chains:
        if len(chain) < 3:
            continue
        pts = [grid_to_canonical(p) for p in chain]
        # Closed loop: last point repeats the first — simplify as a ring.
        closed = pts[0] == pts[-1]
        ring = pts[:-1] if closed else pts
        simple = douglas_peucker(ring, 24)
        if chain_length_canonical(simple + [simple[0]]) < 256:
            continue
        rings.append((simple, closed))
    # Drop holes: a ring inside an odd number of other rings is a lake
    # shore, not a boundary. (An island in a lake sits inside two rings.)
    outer = []
    for i, (ring, closed) in enumerate(rings):
        containing = 0
        px, py = ring[0]
        for j, (other, _) in enumerate(rings):
            if i == j:
                continue
            if point_in_polygon(px, py, other):
                containing += 1
        if containing % 2 == 0:
            outer.append((ring, closed))
    loops = []
    coast_runs = []
    estimate_runs = []
    for simple, closed in outer:
        if closed:
            loops.append(simple)
        # Split into coast / estimate runs.
        def on_edge(p):
            x, y = p
            return (
                abs(x - bounds["west"]) <= 24
                or abs(x - bounds["east"]) <= 24
                or abs(y - bounds["south"]) <= 24
                or abs(y - bounds["north"]) <= 24
            )

        flags = [on_edge(p) for p in simple]
        runs = []
        start = 0
        cur = flags[0]
        for i in range(1, len(simple) + 1):
            if i == len(simple) or flags[i] != cur:
                runs.append((cur, simple[start:i]))
                if i < len(simple):
                    start = i
                    cur = flags[i]
        if closed and len(runs) > 1 and runs[0][0] == runs[-1][0]:
            merged = runs[-1][1] + runs[0][1]
            runs = [(runs[0][0], merged)] + runs[1:-1]
        for flag, run in runs:
            if len(run) < 2:
                continue
            if chain_length_canonical(run) < 96:
                continue
            (estimate_runs if flag else coast_runs).append(run)
    return loops, coast_runs, estimate_runs


def sample_spot(cx, cy, half=64):
    """Mean RGB of the real tile pixels in a canonical window around (cx, cy).

    Loads the z5 tiles the window overlaps; returns None when the window
    is entirely missing tiles (open ocean beyond the tile set).
    """
    pixels = []
    x0, x1 = cx - half, cx + half
    y0, y1 = cy - half, cy + half
    tx0 = (x0 + 16384) // TILE_PX
    tx1 = (x1 + 16384) // TILE_PX
    ty0 = (16384 - y1) // TILE_PX
    ty1 = (16384 - y0) // TILE_PX
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            path = os.path.join(TILE_DIR, f"{ZOOM},{ty},{tx}.jpg")
            if not os.path.exists(path):
                continue
            img = np.asarray(Image.open(path).convert("RGB"))
            # Tile covers x in [tx*256-16384, +256), y in (16384-(ty+1)*256, 16384-ty*256].
            px0 = max(0, x0 - (tx * TILE_PX - 16384))
            px1 = min(TILE_PX, x1 - (tx * TILE_PX - 16384))
            py0 = max(0, (16384 - ty * TILE_PX) - y1)
            py1 = min(TILE_PX, (16384 - ty * TILE_PX) - y0)
            if px1 > px0 and py1 > py0:
                pixels.append(img[py0:py1, px0:px1].reshape(-1, 3))
    if not pixels:
        return None
    all_px = np.concatenate(pixels)
    return tuple(int(v) for v in all_px.mean(axis=0))


def main():
    counties = parse_counties()
    print(f"parsing {len(counties)} county rects from counties.ts")
    grid, counts, sums, tiles_read, tiles_missing = build_grid()
    print(f"tiles read: {tiles_read}, missing (treated as ocean): {tiles_missing}")
    water = grid == 0
    land = ~water
    total = int(counts.sum())
    print(f"sampled cells: {total:,}")

    # Sea mask PNG (water = white) at 768x1024 for the overlay.
    os.makedirs(os.path.dirname(MASK_OUT), exist_ok=True)
    mask_img = Image.fromarray((water.astype(np.uint8) * 255), mode="L")
    mask_img = mask_img.resize((768, 1024), Image.LANCZOS)
    mask_img = mask_img.point(lambda v: 255 if v >= 128 else 0)
    mask_img.save(MASK_OUT, optimize=True)
    print(f"sea mask: {MASK_OUT} ({os.path.getsize(MASK_OUT):,} bytes)")

    # Per-county traced outlines.
    geo = {
        "generatedBy": "scripts/dissect-map.py",
        "source": "GTADB In-Game Day tiles, revision d406fea (CC BY 4.0)",
        "grid": {"west": WEST, "east": EAST, "south": SOUTH, "north": NORTH, "cell": CELL},
        "waterRule": "blue >= red + 45 and blue >= green + 25 (same as classifyGtadbSurfacePixel)",
        "note": "Coast runs are traced from the tiles. Estimate runs sit on the "
        "estimated county rect edge — no official boundary lines exist.",
        "counties": {},
    }
    report_lines = []
    coast_total = 0.0
    for county in counties:
        loops, coast, estimate = trace_county(land, county["bounds"])
        coast_len = sum(chain_length_canonical(r) for r in coast)
        est_len = sum(chain_length_canonical(r) for r in estimate)
        coast_total += coast_len
        geo["counties"][county["id"]] = {
            "loops": [[[int(x), int(y)] for x, y in loop] for loop in loops],
            "coast": [[[int(x), int(y)] for x, y in run] for run in coast],
            "estimate": [[[int(x), int(y)] for x, y in run] for run in estimate],
        }
        report_lines.append(
            f"- {county['name']}: {len(loops)} land rings, "
            f"{len(coast)} coast runs ({coast_len:,.0f} units traced), "
            f"{len(estimate)} estimate runs ({est_len:,.0f} units on the rect edge), "
            f"{sum(len(r) for r in coast) + sum(len(r) for r in estimate)} outline points"
        )
        print(report_lines[-1])

    with open(GEO_OUT, "w") as f:
        json.dump(geo, f, separators=(",", ":"))
    print(f"geo: {GEO_OUT} ({os.path.getsize(GEO_OUT):,} bytes)")

    # Palette report.
    spots = [
        ("open ocean east of Vice City", 3500, 2000),
        ("shore water off Ocean Beach", 2250, 350),
        ("Ocean Beach sand", 2110, 550),
        ("Vice Beach city blocks", 1500, 500),
        ("Mount Kalaga forest", -4200, 7500),
        ("Capri streets", -6500, 200),
    ]
    sampled = []
    for name, sx, sy in spots:
        mean = sample_spot(sx, sy)
        sampled.append((name, sx, sy, mean))
        print(f"sample {name} ({sx}, {sy}): {mean}")
    lines = [
        "# Map pixel dissection — GTADB In-Game Day tiles (z5, 16-unit cells)",
        "",
        f"Tiles read: {tiles_read}; missing slots treated as ocean: {tiles_missing}.",
        f"Sampled cells: {total:,} over {WEST}..{EAST} x {SOUTH}..{NORTH}.",
        "Classification is the app's own `classifyGtadbSurfacePixel` rule",
        "(walk-cartography.ts) — water is blue >= red+45 and blue >= green+25.",
        "",
        "## Surface mix (classifier buckets)",
        "",
        "The classifier is strict: its vegetation rule needs a strong green",
        "dominance, so much of the map's green falls into \"unknown\" (mean",
        "colour green-grey). Read the buckets as a rough mix, not as truth —",
        "the sampled spot colours below are the ground truth for palette work.",
        "",
        "| class | share | mean colour |",
        "|---|---|---|",
    ]
    for ci, name in enumerate(CLASS_NAMES):
        n = int(counts[ci])
        share = 100.0 * n / total if total else 0
        mean = sums[ci] / max(n, 1)
        lines.append(
            f"| {name} | {share:.1f}% | rgb({int(mean[0])}, {int(mean[1])}, {int(mean[2])}) |"
        )
    lines += [
        "",
        "## Sampled spot colours (real tile pixels, 128x128-unit windows)",
        "",
    ]
    for name, sx, sy, mean in sampled:
        if mean is None:
            lines.append(f"- {name} ({sx}, {sy}): no tile data (open ocean beyond the set)")
        else:
            lines.append(f"- {name} ({sx}, {sy}): rgb({mean[0]}, {mean[1]}, {mean[2]})")
    lines += [
        "",
        "## What this means for the After Hours palette",
        "",
        "- Water is bright teal-blue — open ocean rgb(49, 146, 178), shore",
        "  water rgb(76, 160, 188). Coral #FF527F clusters and ivory labels",
        "  both read on it; the sea shimmer must stay faint or it fights",
        "  the tile's own water shading.",
        "- Sand is pale warm tan rgb(194, 186, 156) — coral pins read on it,",
        "  sunset #FFB56B pins do not (too close to sand). Keep sunset for",
        "  text and small accents only, never for pins on sand.",
        "- City blocks are pale grey-blue rgb(167, 175, 188), forest muted",
        "  green rgb(84, 125, 100) — coral reads on both; ivory place labels",
        "  need their dark chip behind them on roads, as they already have.",
        "",
        "## Coastline (traced, not drawn)",
        "",
        f"Total traced coastline: {coast_total:,.0f} canonical units.",
        "Per-county outlines (coast = traced from tiles, estimate = on the",
        "estimated rect edge — no official boundary lines are published):",
        "",
    ]
    lines += report_lines
    lines += [
        "",
        "## Honesty notes",
        "",
        "- Inland county edges are estimates from GTADB records that name the",
        "  county (see src/data/counties.ts). Only the coastline is traced.",
        "- The mask grid is 16 units/cell; the outline is simplified to a",
        "  24-unit tolerance, so fine coves under ~24 units are smoothed.",
        "- Missing tile slots are open ocean by construction (the app's",
        "  errorTileUrl is ocean.jpg).",
        "",
    ]
    with open(REPORT_OUT, "w") as f:
        f.write("\n".join(lines) + "\n")
    print(f"report: {REPORT_OUT}")


if __name__ == "__main__":
    main()
