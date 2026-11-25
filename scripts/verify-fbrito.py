"""Verify fbrito (Open GTA 6 Map, CC BY 4.0) vectors against our real GTADB day tiles.

Checks (research step 1 — measure before trusting):
  1. land.json polygons vs our day-tile land mask -> IoU at z4.
  2. roads.json centrelines vs our day-tile road pixels -> hit rate at z5,
     per kind, with a shifted control and a small shift search.
  3. elevation2.bin sanity vs the GTADB calibration (sea ~0 m, max in the
     northern hills ~800 m) and vs heightmap_16bit.png.

Usage: python3 scripts/verify-fbrito.py [--land] [--roads] [--elevation]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

REPO = Path(__file__).resolve().parent.parent
DAY = REPO / "tiles-source" / "day"
RESEARCH = Path.home() / "workspace" / "vicewire-research"
FBRITO = RESEARCH / "fbrito"

# fbrito map units -> game canonical units (research report, verified 3 ways).
def fb_to_game(x, y):
    return x * 32 - 16384, 16384 - y * 32


def tile_path(zoom, ty, tx):
    return DAY / str(zoom) / f"{zoom},{ty},{tx}.jpg"


_tile_cache = {}


def load_tile(zoom, ty, tx):
    key = (zoom, ty, tx)
    if key not in _tile_cache:
        p = tile_path(zoom, ty, tx)
        _tile_cache[key] = np.asarray(Image.open(p).convert("RGB")) if p.exists() else None
        if len(_tile_cache) > 64:
            _tile_cache.pop(next(iter(_tile_cache)))
    return _tile_cache[key]


def classify(rgb):
    """Same rules as dissect-map.py classify_block."""
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    out = np.full(r.shape, 8, dtype=np.uint8)
    water = (b >= r + 45) & (b >= g + 25)
    out[water] = 0
    veg = (~water) & (g >= r + 12) & (g >= b + 40)
    out[veg] = 1
    rest = ~(water | veg)
    spread = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    light = (r + g + b) / 3.0
    out[rest & (spread > 18)] = 8
    out[rest & (spread <= 18) & (light <= 28)] = 2
    out[rest & (spread <= 18) & (light >= 244)] = 7
    out[rest & (spread <= 18) & (light >= 55) & (light <= 101)] = 3
    out[rest & (spread <= 18) & (light > 101) & (light <= 138)] = 4
    out[rest & (spread <= 18) & (light >= 150) & (light <= 197)] = 5
    out[rest & (spread <= 18) & (light > 197) & (light < 244)] = 6
    return out


def check_land():
    print("== land.json vs our day tiles (z4, IoU) ==")
    land = json.loads((FBRITO / "land.json").read_text())
    # Convert polygons (each a list of rings; ring 0 outer, rest holes) to game coords.
    polys = []
    for rings in land:
        conv = []
        for ring in rings:
            pts = [fb_to_game(x, y) for x, y in ring]
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            conv.append((pts, min(xs), max(xs), min(ys), max(ys)))
        polys.append(conv)
    print(f"polygons: {len(polys)}")
    zoom = 4
    tile_units = 256 * 2 ** (5 - zoom)  # 512 at z4
    # z4 grid: tileX 0..47 (west -16384..8192), tileY 0..63 (north 16384..-16384)
    inter = union = 0
    fb_only_tiles = 0
    for ty in range(64):
        for tx in range(48):
            west = -16384 + tx * tile_units
            north = 16384 - ty * tile_units
            arr = load_tile(zoom, ty, tx)
            if arr is None:
                ours_land = np.zeros((256, 256), dtype=bool)
            else:
                ours_land = classify(arr) != 0
            # Rasterize fbrito land clipped to this tile.
            mask_img = Image.new("L", (256, 256), 0)
            draw = ImageDraw.Draw(mask_img)
            drew = False
            for rings in polys:
                outer, mnx, mxx, mny, mxy = rings[0]
                if mxx < west or mnx > west + tile_units or mxy < north - tile_units or mny > north:
                    continue
                px = [((x - west) / tile_units * 256, (north - y) / tile_units * 256) for x, y in outer]
                draw.polygon(px, fill=1)
                for hole, _, _, _, _ in rings[1:]:
                    pxh = [((x - west) / tile_units * 256, (north - y) / tile_units * 256) for x, y in hole]
                    draw.polygon(pxh, fill=0)
                drew = True
            fb_land = np.asarray(mask_img).astype(bool)
            if arr is None and fb_land.any():
                fb_only_tiles += 1
            inter += int((ours_land & fb_land).sum())
            union += int((ours_land | fb_land).sum())
    print(f"intersection px: {inter}, union px: {union}")
    print(f"land IoU (fbrito vs real): {inter / union:.3f}  (illustration baseline was 0.627)")
    print(f"tiles with fbrito land but no real tile (open ocean): {fb_only_tiles}")


def _road_points(shift=(0, 0)):
    roads = json.loads((FBRITO / "roads.json").read_text())
    by_kind = {}
    for f in roads["features"]:
        kind = f["properties"].get("kind", "?")
        pts = []
        for x, y in f["geometry"]["coordinates"]:
            gx, gy = fb_to_game(x, y)
            pts.append((gx + shift[0], gy + shift[1]))
        by_kind.setdefault(kind, []).extend(pts)
    return by_kind


def _sample_z5(points):
    """Return class histogram for points sampled from z5 day tiles (1 px = 1 unit)."""
    # Group by tile.
    by_tile = {}
    for gx, gy in points:
        px, py = int(gx + 16384), int(16384 - gy)
        tx, ty = px // 256, py // 256
        by_tile.setdefault((ty, tx), []).append((px % 256, py % 256))
    hist = np.zeros(9, dtype=np.int64)
    yellow = 0
    total = 0
    for (ty, tx), local in by_tile.items():
        arr = load_tile(5, ty, tx)
        if arr is None:
            continue
        cls = classify(arr)
        for lx, ly in local:
            # 3x3 neighbourhood tolerance for +-1px alignment error.
            patch = cls[max(0, ly - 1):ly + 2, max(0, lx - 1):lx + 2]
            # Road-like = the best (lowest-numbered road class) in the patch,
            # preferring road(3)/marking(7)/pavement(4) over anything else.
            vals = patch.ravel()
            best = 8
            for v in (3, 7, 4):
                if v in vals:
                    best = v
                    break
            else:
                best = int(vals[0])
            hist[best] += 1
            total += 1
            # Yellow highway pixels (spread>18, R/G high, B low).
            r, g, b = (int(arr[ly, lx, c]) for c in range(3))
            if r > 140 and g > 110 and b < 140 and r - b > 40:
                yellow += 1
    return hist, yellow, total


def check_roads():
    print("== roads.json vs our day tiles (z5, 3x3 tolerance) ==")
    by_kind = _road_points()
    for kind in ("highway", "main", "street", "minor"):
        pts = by_kind.get(kind, [])
        # Thin dense vertices: sample every 4th point to keep it fast.
        hist, yellow, total = _sample_z5(pts[::4])
        road_like = int(hist[3] + hist[7] + hist[4])
        print(f"{kind:8s} n={total:6d} road/pave/mark={road_like/total:.3f} "
              f"(road={hist[3]/total:.2f} mark={hist[7]/total:.2f} pave={hist[4]/total:.2f}) "
              f"yellow-centre={yellow/total:.2f} water={hist[0]/total:.2f} veg={hist[1]/total:.2f} "
              f"build={hist[5]/total:.2f} ground={hist[6]/total:.2f} unknown={hist[8]/total:.2f}")
    # Shifted control: same roads moved by a non-round offset.
    print("-- shifted control (+37, -23 units) --")
    shifted = _road_points(shift=(37, -23))
    all_pts = [p for v in shifted.values() for p in v]
    hist, yellow, total = _sample_z5(all_pts[::4])
    road_like = int(hist[3] + hist[7] + hist[4])
    print(f"ALL shifted n={total} road-like={road_like/total:.3f} yellow={yellow/total:.2f}")
    # Shift search: best small offset.
    print("-- shift search (dx, dy in units) --")
    all_real = [p for v in by_kind.values() for p in v][::8]
    best = (0, 0, -1.0)
    for dx in (-8, -4, 0, 4, 8):
        row = []
        for dy in (-8, -4, 0, 4, 8):
            pts = [(gx + dx, gy + dy) for gx, gy in all_real]
            hist, _, total = _sample_z5(pts)
            rate = (int(hist[3] + hist[7] + hist[4])) / max(total, 1)
            row.append(f"{rate:.3f}")
            if rate > best[2]:
                best = (dx, dy, rate)
        print(f"  dy -8..8 at dx={dx:+d}: " + " ".join(row))
    print(f"best shift: dx={best[0]} dy={best[1]} rate={best[2]:.3f}")


def check_roads_segments():
    """Segment-based road agreement: densify fbrito polylines, measure the
    distance from each point to the nearest road centreline skeletonised
    from OUR day tiles (redraw-tiles._road_skeleton on the light mask).
    A median distance of ~0-2 px with a far larger shifted control means
    the vectors sit on our real roads."""
    import importlib.util as _ilu
    from scipy import ndimage as _ndi
    spec = _ilu.spec_from_file_location("redraw_tiles", REPO / "scripts" / "redraw-tiles.py")
    rt = _ilu.module_from_spec(spec)
    spec.loader.exec_module(rt)
    print("== roads.json segments vs our road skeleton (z5, distance in px) ==")
    roads = json.loads((FBRITO / "roads.json").read_text())
    # Spatial index: feature -> tiles it touches.
    tile_feats = {}
    for fi, f in enumerate(roads["features"]):
        xs = [c[0] for c in f["geometry"]["coordinates"]]
        ys = [c[1] for c in f["geometry"]["coordinates"]]
        gx0, gy0 = fb_to_game(min(xs), max(ys))
        gx1, gy1 = fb_to_game(max(xs), min(ys))
        tx0, tx1 = int((gx0 + 16384) // 256), int((gx1 + 16384) // 256)
        ty0, ty1 = int((16384 - gy0) // 256), int((16384 - gy1) // 256)
        for ty in range(ty0, ty1 + 1):
            for tx in range(tx0, tx1 + 1):
                tile_feats.setdefault((ty, tx), []).append(fi)

    def densify(coords, step=2.0):
        """Interpolate polyline vertices to ~step-unit spacing, in game coords."""
        pts = []
        prev = None
        for x, y in coords:
            gx, gy = fb_to_game(x, y)
            if prev is not None:
                dx, dy = gx - prev[0], gy - prev[1]
                n = int(max(abs(dx), abs(dy)) / step)
                for i in range(1, n + 1):
                    pts.append((prev[0] + dx * i / (n + 1), prev[1] + dy * i / (n + 1)))
            pts.append((gx, gy))
            prev = (gx, gy)
        return pts

    stats = {}  # kind -> list of distances
    control = []
    n_tiles = 0
    for (ty, tx), fis in sorted(tile_feats.items()):
        arr = load_tile(5, ty, tx)
        if arr is None:
            continue
        f = arr.astype(np.float32)
        r, g, b = f[..., 0], f[..., 1], f[..., 2]
        mn = np.minimum(np.minimum(r, g), b)
        mx = np.maximum(np.maximum(r, g), b)
        water = (b - r > 35) & (b - g > 5)
        light = (mn > 192) & ((mx - mn) < 22) & ((b - r) < 16) & (~water)
        skel, _ = rt._road_skeleton(light.copy())
        if not skel.any():
            continue
        edt = _ndi.distance_transform_edt(~skel)
        n_tiles += 1
        x0, y1 = tx * 256 - 16384, 16384 - ty * 256
        for fi in fis:
            feat = roads["features"][fi]
            kind = feat["properties"].get("kind", "?")
            for gx, gy in densify(feat["geometry"]["coordinates"]):
                lx, ly = int(gx - x0), int(y1 - gy)
                if 0 <= lx < 256 and 0 <= ly < 256:
                    stats.setdefault(kind, []).append(float(edt[ly, lx]))
                    cx, cy = int(gx + 37 - x0), int(y1 - (gy - 23))
                    if 0 <= cx < 256 and 0 <= cy < 256:
                        control.append(float(edt[cy, cx]))
    print(f"tiles with both our skeleton and fbrito roads: {n_tiles}")
    for kind in ("highway", "main", "street", "minor"):
        d = np.array(stats.get(kind, []))
        if len(d) == 0:
            continue
        print(f"{kind:8s} n={len(d):7d} median={np.median(d):.1f}px "
              f"<=1px: {(d <= 1).mean():.2f} <=2px: {(d <= 2).mean():.2f} "
              f"<=4px: {(d <= 4).mean():.2f} mean={d.mean():.1f}")
    c = np.array(control)
    print(f"CONTROL shifted (+37,-23) n={len(c)} median={np.median(c):.1f}px "
          f"<=2px: {(c <= 2).mean():.2f} mean={c.mean():.1f}")


def check_elevation():
    print("== elevation2.bin sanity (GTADB calibration) ==")
    raw = np.fromfile(RESEARCH / "elevation2.bin", dtype="<u2")
    print(f"bytes: {raw.size * 2} values: {raw.size} expected 1536x1748={1536 * 1748}")
    grid = raw.reshape(1748, 1536)
    elev = grid.astype(np.float64) / 92.466616 - 303.103
    print(f"elevation range: {elev.min():.1f} .. {elev.max():.1f} m")
    print(f"median: {np.median(elev):.1f} m, pct>0: {(elev > 0).mean():.3f}")
    # Sea level check: far-east open ocean (gx 6000, gy 0) and far-south ocean.
    def sample(gx, gy):
        hx = 1108.53 + gx * 0.083188297074
        hy = 938.09 - gy * 0.083188297074
        ix, iy = int(round(hx)), int(round(hy))
        if 0 <= ix < 1536 and 0 <= iy < 1748:
            return float(elev[iy, ix])
        return float("nan")
    print(f"open ocean E (6000, 0): {sample(6000, 0):.1f} m (expect ~0)")
    print(f"open ocean S (-6000, -12000): {sample(-6000, -12000):.1f} m (expect ~0)")
    print(f"open ocean W (-14000, 4000): {sample(-14000, 4000):.1f} m (expect ~0)")
    # Highest point: where, and how high (Mount Kalaga ~800 m per leonida_gis).
    iy, ix = np.unravel_index(np.argmax(elev), elev.shape)
    gx = (ix - 1108.53) / 0.083188297074
    gy = (938.09 - iy) / 0.083188297074
    print(f"max {elev[iy, ix]:.1f} m at game ({gx:.0f}, {gy:.0f}) heightmap ({ix}, {iy})")
    # Cross-check vs the leonida_gis PNG (same grid if same source).
    png = np.asarray(Image.open(RESEARCH / "heightmap_16bit.png"))
    print(f"png shape {png.shape} dtype {png.dtype} range {png.min()}..{png.max()}")
    print(f"png == bin: {np.array_equal(png, grid)}  (max abs diff {np.abs(png.astype(int) - grid.astype(int)).max()})")


if __name__ == "__main__":
    args = set(sys.argv[1:])
    if not args:
        args = {"--land", "--roads", "--elevation"}
    if "--land" in args:
        check_land()
    if "--roads" in args:
        check_roads()
    if "--roads2" in args:
        check_roads_segments()
    if "--elevation" in args:
        check_elevation()
