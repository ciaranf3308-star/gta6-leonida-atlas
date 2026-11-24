#!/usr/bin/env python3
"""TRUE REDRAW of the Leonida basemap (v0.19.0) — an ILLUSTRATION drawn
from the real geography, not a recolour of the game-map photo.

v0.18 "rebuilt" the tiles only by recolouring the same GTADB day-map
pixels (same image, new colours, coral road highlights). The user
clocked it — rightly — and the zoomed-in screenshot proved the road
grade had gone too far: EVERY street was a thick bright-pink neon line.

This script draws a NEW map. Every output pixel is painted from a
classification of the source, never copied from it:

  SOURCE OF TRUTH (only): the GTADB In-Game Day tiles
  (public/assets/gta6-leonida-atlas/tiles/day/, z0-z6, same grid).
  Coastline, water, sand, land, urban ground and roads all come from
  THAT data. No invented coastline, road, city or place.

  WHAT IS PAINTED (artistic interpretation):
  * Flat illustrated fills per surface — deep-teal sea in depth bands,
    rich green land, warm sand, warm-grey city blocks — modulated only
    by a heavily blurred relief shade taken from the source luminance
    (hillshade feel, no photo texture). Source photographic detail is
    deliberately flattened away; that is what makes it a redraw.
  * Roads are VECTOR strokes over the flat land, drawn from skeleton
    centrelines of the source road network: casing + core. MAJOR roads
    (wide skeleton, half-width >= 5 tile-px at z5, scaled per zoom)
    and highways get a thin coral / sunset core with a soft glow.
    MINOR streets get a cream core, NO pink — at street zoom the map
    must read like a clean street map, pink only on the routes that
    matter. This is the pink-mess fix, built into the redraw.
  * Clouds at z0-z2 are large soft puffs over WATER only, in global
    coordinates so they never seam; v0.18's 6% alpha read as no clouds
    at all, these are clustered puffs at 70% core alpha, not a wash.
  * Sea depth bands come from distance-to-land in the source land
    mask, not from bathymetry (there is none): shore turquoise ->
    mid teal -> deep teal. A styling device, labelled as such. The
    distance field is GLOBAL (scripts/build-shore-distance.py, one
    z2 map sampled by every tile) — a per-tile transform seamed at
    borders in the 390px walk.

  WHAT STAYS REAL: tile filenames, coordinates and zooms are
  unchanged, so every place coordinate lands in exactly the same
  spot. A pin that was on a road is still on that road.

Output: public/assets/gta6-leonida-atlas/tiles/redrawn/<z>/ — a new
pyramid the app serves instead of tiles/styled/.

Run:
  python3 scripts/redraw-tiles.py --preview   # sample sheets, /tmp/v019
  python3 scripts/redraw-tiles.py --all       # full pyramid, 31,022 tiles
  python3 scripts/redraw-tiles.py --zooms 0 1 2
"""
import argparse
import glob
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/day")
DST = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/redrawn")
QUALITY = 88

# --- After Hours illustrated palette ---
CORAL = np.array([255.0, 82.0, 127.0])     # #FF527F major-road core
SUNSET = np.array([255.0, 181.0, 107.0])   # #FFB56B highway core
CREAM = np.array([245.0, 237.0, 216.0])    # minor-street core (no pink)
CASING_MAJOR = np.array([122.0, 62.0, 78.0])
SAND_FLAT = np.array([234.0, 217.0, 168.0])
GREEN_FLAT = np.array([88.0, 143.0, 84.0])     # rich illustrated green
FOREST_FLAT = np.array([58.0, 118.0, 66.0])    # deep forest green
URBAN_FLAT = np.array([206.0, 199.0, 182.0])   # warm-grey city ground
BLOCK_DARK = np.array([154.0, 145.0, 124.0])
BLOCK_LIGHT = np.array([233.0, 227.0, 211.0])
SEA_SHORE = np.array([30.0, 143.0, 168.0])     # #1E8FA8
SEA_MID = np.array([15.0, 107.0, 132.0])       # #0F6B84
SEA_DEEP = np.array([10.0, 85.0, 110.0])
SEA_ABYSS = np.array([5.0, 58.0, 76.0])        # #053A4C


def _smoothstep(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _paint(dst, mask, rgb, alpha=1.0):
    """Blend flat rgb onto dst where mask (float 0..1) says so."""
    w = (mask * alpha)[..., None]
    dst[:] = dst * (1.0 - w) + rgb[None, None, :] * w


def _road_skeleton(light):
    """Centrelines of the road network, from the light-neutral mask.

    Same geometry argument as v0.18: roads are long thin connected
    structures, rooftops are compact blobs. Fill small holes, drop
    compact blobs, skeletonize (Lee, C-fast), prune short stubs,
    drop short leftover components. Returns (skeleton bool, half-width
    float array = distance transform of the kept light mask)."""
    if light.sum() < 40:
        return np.zeros_like(light), np.zeros(light.shape, dtype=np.float32)
    inv = ~light
    lab_bg, n_bg = ndi.label(inv)
    if n_bg:
        for i in range(1, n_bg + 1):
            ys, xs = np.where(lab_bg == i)
            if (
                len(ys) < 2000
                and ys.min() > 0
                and ys.max() < light.shape[0] - 1
                and xs.min() > 0
                and xs.max() < light.shape[1] - 1
            ):
                light[lab_bg == i] = True
    lab, n = ndi.label(light)
    keep = light.copy()
    if n:
        for i in range(1, n + 1):
            ys, xs = np.where(lab == i)
            size = len(ys)
            hh, ww = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
            fill = size / float(hh * ww)
            if fill > 0.5 and max(hh, ww) <= 80 and min(hh, ww) / max(hh, ww) > 0.45:
                keep[lab == i] = False
    dist = ndi.distance_transform_edt(keep)
    skel = skeletonize(keep)
    # Prune short stubs (endpoints, not on the tile edge — a road
    # crossing the border must not be cut back at the seam).
    s = skel.copy()
    for _ in range(12):
        ker = np.ones((3, 3), dtype=int)
        ker[1, 1] = 0
        nbrs = ndi.convolve(s.astype(int), ker, mode="constant", cval=0)
        endpoints = s & (nbrs == 1)
        interior = endpoints.copy()
        interior[0, :] = False
        interior[-1, :] = False
        interior[:, 0] = False
        interior[:, -1] = False
        if not interior.any():
            break
        s[interior] = False
    skel = s
    lab_s, n_s = ndi.label(skel, structure=np.ones((3, 3), dtype=int))
    if n_s:
        sizes = ndi.sum_labels(np.ones_like(lab_s), lab_s, range(1, n_s + 1))
        for i, size in enumerate(sizes, start=1):
            if size < 30:
                skel[lab_s == i] = False
    return skel, dist


def _shore_distance(zoom, tile_y, tile_x):
    """Distance to land in TILE pixels, from the GLOBAL shore-distance
    map (scripts/build-shore-distance.py, z2 grid, 1 px = 8 units).
    Per-tile distance transforms seam at borders (a tile's water far
    from land *inside that tile* paints abyss against a neighbour's
    bands); the global field is continuous by construction. Falls
    back to a per-tile transform if the map is missing.
    Returns a float 256x256 array."""
    global _SHORE
    if _SHORE is None:
        try:
            _SHORE = np.asarray(
                Image.open(os.path.join(ROOT, "public/assets/gta6-leonida-atlas/shore-distance.png"))
                .convert("L")
            ).astype(np.float32)
        except Exception:
            _SHORE = False
    if _SHORE is False:
        return None
    scale = 2.0 ** (2 - zoom)  # tile px -> z2 px
    # BILINEAR sample: nearest-neighbour on the 8-unit grid paints
    # 8px blocks into the shore bands at street zoom. Fractional
    # coords + bilinear weights keep the bands smooth.
    gy_f = (tile_y * 256 + np.arange(256, dtype=np.float32)) * scale
    gx_f = (tile_x * 256 + np.arange(256, dtype=np.float32)) * scale
    y0 = np.clip(np.floor(gy_f).astype(int), 0, 4094)
    x0 = np.clip(np.floor(gx_f).astype(int), 0, 3070)
    fy = np.clip(gy_f - np.floor(gy_f), 0.0, 1.0)[:, None]
    fx = np.clip(gx_f - np.floor(gx_f), 0.0, 1.0)[None, :]
    top = _SHORE[np.ix_(y0, x0)] * (1.0 - fx) + _SHORE[np.ix_(y0, x0 + 1)] * fx
    bot = _SHORE[np.ix_(y0 + 1, x0)] * (1.0 - fx) + _SHORE[np.ix_(y0 + 1, x0 + 1)] * fx
    dist_z2 = top * (1.0 - fy) + bot * fy
    return dist_z2 * (2.0 ** (zoom - 2))  # z2 px -> tile px


_SHORE = None


def _sea_from_distance(dist_tile_px, zoom):
    """Sea RGB from distance-to-land in tile px. Bands are in tile px
    and scale with zoom: a shore band is ~10 canonical units wide at
    every zoom, not 45 tile-px at z0."""
    h, w = dist_tile_px.shape
    zscale = 2.0 ** (zoom - 5)
    shore_hi = max(1.5, 10.0 * zscale)
    mid_hi = max(5.0, 32.0 * zscale)
    sea = np.tile(SEA_ABYSS, (h, w, 1)).astype(np.float32)
    band_mid = _smoothstep(dist_tile_px, mid_hi, mid_hi * 0.35)
    band_shore = _smoothstep(dist_tile_px, shore_hi, shore_hi * 0.3)
    _paint(sea, band_mid, SEA_MID)
    _paint(sea, band_shore, SEA_SHORE)
    far = _smoothstep(dist_tile_px, mid_hi * 2.0, mid_hi * 4.0)
    _paint(sea, far * 0.5, SEA_DEEP)
    return sea


def _cloud_field(zoom, tile_y, tile_x):
    """Cloud puffs in GLOBAL coordinates (seamless by construction),
    z0 scale. A low-frequency envelope clusters them into patches
    with clear sea between — the reference sea is fringed with
    clouds at the edges, not polka-dotted all over. Returns float
    0..1 field, 256x256."""
    scale = 2.0**zoom
    gx = (tile_x * 256.0 + np.arange(256, dtype=np.float32)[None, :]) / scale
    gy = (tile_y * 256.0 + np.arange(256, dtype=np.float32)[:, None]) / scale
    envelope = _smoothstep(
        np.sin(gx * 0.0028 + 0.6) * np.sin(gy * 0.0023 + 2.1), 0.05, 0.55
    )
    field = (
        np.sin(gx * 0.040 + 1.7) * np.sin(gy * 0.033 + 0.4)
        + 0.7 * np.sin((gx + gy) * 0.023 + 4.2)
        + 0.5 * np.sin((gx - gy) * 0.047 + 2.3)
        + 0.25 * np.sin(gx * 0.061 + gy * 0.053 + 0.9)
    )
    cloud = _smoothstep(field, 0.90, 1.50) * envelope
    return ndi.gaussian_filter(cloud, 4.0)


def redraw(arr, zoom, tile_y, tile_x):
    """arr: uint8 HxWx3 RGB source day tile. Returns uint8 redrawn tile."""
    f = arr.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h, w = r.shape
    lum = (0.30 * r + 0.50 * g + 0.20 * b) / 255.0

    # --- masks (same measured rules as the v0.18 dissection) ---
    # Water first: most tiles are open ocean, and they return here
    # before any other mask, relief or road work is done.
    water = _smoothstep(b - r, 35.0, 55.0) * _smoothstep(b - g, 5.0, 20.0)
    water = ndi.gaussian_filter(water, 2.0)
    land = 1.0 - water

    # --- fast path: open ocean — sea bands from the GLOBAL distance
    # field (+ clouds at low zoom). NOT flat abyss: the flat fast path
    # seamed against neighbouring shore tiles' bands in the walk.
    if water.mean() > 0.985:
        dist = _shore_distance(zoom, tile_y, tile_x)
        if dist is None:
            dist = ndi.distance_transform_edt(water > 0.5)
        out = _sea_from_distance(dist, zoom)
        if zoom <= 2:
            cloud = _cloud_field(zoom, tile_y, tile_x) * 0.70 * water
            _paint(out, cloud, np.array([255.0, 255.0, 255.0]))
        return np.clip(out, 0, 255).astype(np.uint8)

    green_s = _smoothstep(g - r, 3.0, 20.0) * _smoothstep(g - b, 8.0, 30.0) * land
    if zoom <= 2:
        # Downsampled low-zoom tiles wash the green out (the dissection's
        # "unknown" mean is green-grey): loosen the rule or the whole
        # island paints as urban cream.
        green_s = _smoothstep(g - r, 0.0, 8.0) * _smoothstep(g - b, 2.0, 12.0) * land
    green_s = ndi.gaussian_filter(green_s, 2.0)
    sand_src = (
        _smoothstep(r - b, 15.0, 30.0)
        * _smoothstep(g - b, 5.0, 15.0)
        * _smoothstep(r, 140.0, 170.0)
        * land
        * (1.0 - green_s)
    )
    sand_src = ndi.gaussian_filter(sand_src, 1.0)
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    light = (mn > 192) & ((mx - mn) < 22) & ((b - r) < 16) & (land > 0.5)
    highway = (
        (r > 205) & (g > 195) & ((r - b) > 25) & ((r - b) < 60) & ((mx - mn) > 20) & (land > 0.5)
    )

    # --- relief: heavily blurred source luminance, smooth (never
    # quantised — v1's steps read as JPEG blocks at low zoom). ---
    relief_blur = ndi.gaussian_filter(lum, 6.0)
    relief = np.clip(0.95 + 0.10 * np.clip((relief_blur - 0.50) / 0.30, -1.0, 1.0), 0.95, 1.05)
    relief_urban = 1.0 + (relief - 1.0) * 0.3  # city ground stays flat

    out = np.zeros((h, w, 3), dtype=np.float32)

    # --- sea: depth bands by distance to land, from the GLOBAL field
    # (continuous across tile borders — see _shore_distance). ---
    dist_to_land = _shore_distance(zoom, tile_y, tile_x)
    if dist_to_land is None:
        dist_to_land = ndi.distance_transform_edt(water > 0.5)
    sea = _sea_from_distance(dist_to_land, zoom)
    _paint(out, water, np.array([0.0, 0.0, 0.0]))  # placeholder, replaced below
    out = out * (1.0 - water[..., None]) + sea * water[..., None]

    # --- land base: flat illustrated fills, relief-modulated ---
    green_rgb = GREEN_FLAT[None, None, :] * relief[..., None]
    forest_rgb = FOREST_FLAT[None, None, :] * relief[..., None]
    land_rgb = green_rgb * (1.0 - green_s[..., None]) + forest_rgb * green_s[..., None]
    # Urban ground where the land is not green and not sand.
    urban_w = land * (1.0 - green_s) * (1.0 - sand_src)
    urban_rgb = URBAN_FLAT[None, None, :] * relief_urban[..., None]
    land_rgb = land_rgb * (1.0 - urban_w[..., None]) + urban_rgb * urban_w[..., None]
    out = out * (1.0 - land[..., None]) + land_rgb * land[..., None]

    # --- sand: source sand + a coast band (land within ~5px of water) ---
    dist_to_water = ndi.distance_transform_edt(land > 0.5)
    coast_band = _smoothstep(5.0 - dist_to_water, 0.0, 3.0) * land * (1.0 - green_s)
    sand_w = np.clip(sand_src + coast_band, 0.0, 1.0)
    _paint(out, sand_w * land, SAND_FLAT * np.array([1.0, 1.0, 1.0]))

    # --- city blocks: light compact blobs that are NOT road get flat
    # block tones (two steps from quantised luminance) — the city reads
    # as drawn blocks, not photo rooftops. ---
    if zoom >= 4:
        skel, dist = _road_skeleton(light.copy())
        road_area = ndi.binary_dilation(skel, np.ones((7, 7), dtype=bool))
        blocks = light & ~road_area
        blocks = ndi.binary_erosion(blocks, np.ones((3, 3), dtype=bool))
        if blocks.any():
            block_lum = np.clip((lum - 0.55) / 0.30, 0.0, 1.0)
            dark = blocks & (block_lum < 0.5)
            lite = blocks & (block_lum >= 0.5)
            _paint(out, dark.astype(np.float32) * land, BLOCK_DARK)
            _paint(out, lite.astype(np.float32) * land, BLOCK_LIGHT)
    else:
        skel, dist = None, None

    # --- roads: vector strokes over the flat land ---
    if zoom <= 3:
        # Sub-pixel at these zooms: highways sunset, other light lines
        # a faint coral — never a wash. No skeleton, no glow.
        hwy_f = ndi.gaussian_filter(highway.astype(np.float32), 0.8)
        _paint(out, hwy_f * 0.85, SUNSET)
        faint = (
            _smoothstep(mn, 208.0, 220.0)
            * _smoothstep(20.0 - (mx - mn), 0.0, 10.0)
            * land
        )
        _paint(out, faint * (0.12 if zoom <= 1 else 0.22), CORAL)
    else:
        if skel is None:
            skel, dist = _road_skeleton(light.copy())
        major_hw = 8.0 * (2.0 ** (zoom - 5))  # half-width px at this zoom
        # Measured on real VC/Capri z5 tiles: the pale road band (road +
        # shoulders) has median half-width ~6px, so a 5px bar made 83%
        # of Vice City's streets "major" — the pink grid. 8px keeps
        # ~10% as major: the routes that matter, nothing else.
        # Width is smoothed ALONG the skeleton before thresholding:
        # per-pixel width spikes at junctions (two roads crossing read
        # wide), which painted pink X blobs at every intersection
        # while the road between them stayed cream.
        w_field = np.where(skel, dist, 0.0).astype(np.float32)
        w_smooth = ndi.gaussian_filter(w_field, 3.0) / np.maximum(
            ndi.gaussian_filter(skel.astype(np.float32), 3.0), 1e-6
        )
        major = skel & (w_smooth >= major_hw)
        # Drop short leftover major fragments (junction residue).
        lab_m, n_m = ndi.label(major, structure=np.ones((3, 3), dtype=int))
        if n_m:
            sizes_m = ndi.sum_labels(np.ones_like(lab_m), lab_m, range(1, n_m + 1))
            for i, size in enumerate(sizes_m, start=1):
                if size < 20:
                    major[lab_m == i] = False
        # Junctions read wide (two paved bands crossing) even on minor
        # streets, so the crossing itself must not be major: cut a
        # cream zone around every skeleton junction out of the major
        # mask. The approaches keep their class; the crossing reads as
        # a normal intersection, not a pink X.
        nbrs = ndi.convolve(skel.astype(int), np.ones((3, 3), dtype=int), mode="constant", cval=0) - 1
        junction = skel & (nbrs >= 3)
        if junction.any():
            jzone = ndi.binary_dilation(junction, np.ones((15, 15), dtype=bool))
            major = major & ~jzone
        minor = skel & ~major
        # Highways (source yellow) are major whatever their width.
        hwy_dil = ndi.binary_dilation(highway, np.ones((5, 5), dtype=bool))
        hwy_skel = skel & hwy_dil
        major = major | hwy_skel
        minor = minor & ~hwy_skel

        def dil(mask, size):
            return ndi.binary_dilation(mask, np.ones((size, size), dtype=bool))

        # Major: soft glow, thin coral core — no casing (v1's casing
        # made the line read thicker than its core). Minor: cream.
        if major.any():
            _paint(out, dil(major, 5).astype(np.float32) * 0.12, CORAL)
            _paint(out, dil(major, 3).astype(np.float32) * 0.80, CORAL)
        # Highway cores overpaint in sunset (same geometry, warmer).
        if hwy_skel.any():
            _paint(out, dil(hwy_skel, 5).astype(np.float32) * 0.12, SUNSET)
            _paint(out, dil(hwy_skel, 3).astype(np.float32) * 0.80, SUNSET)
        # Minor: cream core only — NO pink, NO glow. The pink-mess fix.
        if minor.any():
            _paint(out, dil(minor, 3).astype(np.float32) * 0.95, CREAM)
        # Wide non-skeleton highway ribbons (aprons/interchanges) sunset.
        if highway.any():
            hwy_f = ndi.gaussian_filter(highway.astype(np.float32), 0.8)
            _paint(out, hwy_f * 0.8, SUNSET)

    # --- clouds: z0-z2, large puffs over water only, 30% max alpha.
    # v0.18's 6% was invisible on his phone; the reference sea is
    # fringed with real clouds. ---
    if zoom <= 2:
        cloud = _cloud_field(zoom, tile_y, tile_x) * 0.70 * water
        _paint(out, cloud, np.array([255.0, 255.0, 255.0]))

    return np.clip(out, 0, 255).astype(np.uint8)


def _render_one(args):
    src, dst, zoom, ty, tx = args
    try:
        arr = np.asarray(Image.open(src).convert("RGB"))
        out = redraw(arr, zoom, ty, tx)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        Image.fromarray(out).save(dst, quality=QUALITY, optimize=True)
        return (src, os.path.getsize(dst), None)
    except Exception as e:  # noqa: BLE001 - report per-tile, keep going
        return (src, 0, str(e))


def _tile_jobs(zooms):
    jobs = []
    for z in zooms:
        for src in sorted(glob.glob(os.path.join(SRC, str(z), "*.jpg"))):
            name = os.path.basename(src)
            try:
                _, ty, tx = name[:-4].split(",")
                jobs.append((src, os.path.join(DST, str(z), name), z, int(ty), int(tx)))
            except ValueError:
                continue
    return jobs


def preview():
    os.makedirs("/tmp/v019", exist_ok=True)
    samples = {
        "vc-city": "5/5,62,69.jpg",
        "vc-waterfront": "5/5,59,67.jpg",
        "capri": "5/5,63,38.jpg",
        "kalaga-forest": "5/5,34,47.jpg",
        "ocean-beach": "5/5,61,72.jpg",
        "ocean-east": "5/5,56,77.jpg",
    }
    cols = []
    for name, rel in samples.items():
        src = os.path.join(SRC, rel)
        arr = np.asarray(Image.open(src).convert("RGB"))
        z = int(rel.split("/")[0])
        parts = os.path.basename(rel)[:-4].split(",")
        styled = redraw(arr, z, int(parts[1]), int(parts[2]))
        before = Image.open(src).convert("RGB").resize((384, 384), Image.NEAREST)
        after = Image.fromarray(styled).resize((384, 384), Image.NEAREST)
        pair = Image.new("RGB", (384, 384 * 2 + 8))
        pair.paste(before, (0, 0))
        pair.paste(after, (0, 384 + 8))
        cols.append(pair)
        print(name, "done")
    sheet = Image.new("RGB", (384 * len(cols), 384 * 2 + 8))
    for i, c in enumerate(cols):
        sheet.paste(c, (384 * i, 0))
    sheet.save("/tmp/v019/preview-v5.png")
    print("saved /tmp/v019/preview-v5.png")

    # Full-island z0 composite, before vs after.
    for label, do_redraw in (("orig", False), ("redrawn", True)):
        comp = Image.new("RGB", (768, 1024))
        for ty in range(4):
            for tx in range(3):
                p = os.path.join(SRC, "0", f"0,{ty},{tx}.jpg")
                tile = Image.open(p).convert("RGB")
                if do_redraw:
                    tile = Image.fromarray(redraw(np.asarray(tile), 0, ty, tx))
                comp.paste(tile, (tx * 256, ty * 256))
        comp.save(f"/tmp/v019/z0-{label}.png")
    print("saved /tmp/v019/z0-orig.png /tmp/v019/z0-redrawn.png")

    # Street-zoom composite: 2x2 z5 tiles over Vice City (the pink-mess view).
    comp = Image.new("RGB", (512, 512))
    for dy, ty in enumerate((61, 62)):
        for dx, tx in enumerate((68, 69)):
            p = os.path.join(SRC, "5", f"5,{ty},{tx}.jpg")
            tile = Image.fromarray(redraw(np.asarray(Image.open(p).convert("RGB")), 5, ty, tx))
            comp.paste(tile, (dx * 256, dy * 256))
    comp = comp.resize((768, 768), Image.NEAREST)
    comp.save("/tmp/v019/vc-street-z5.png")
    print("saved /tmp/v019/vc-street-z5.png")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--zooms", nargs="+", type=int, default=[])
    args = ap.parse_args()
    if args.preview:
        preview()
        return
    zooms = list(range(0, 7)) if args.all else args.zooms
    if not zooms:
        print("pass --preview, --all or --zooms", file=sys.stderr)
        sys.exit(2)
    jobs = _tile_jobs(zooms)
    print(f"{len(jobs)} tiles to render")
    total = 0
    errors = []
    with Pool(4) as pool:
        for i, (src, size, err) in enumerate(pool.imap_unordered(_render_one, jobs, chunksize=16)):
            total += size
            if err:
                errors.append((src, err))
            if (i + 1) % 2000 == 0:
                print(f"{i+1}/{len(jobs)}  {total/1e6:.1f} MB", flush=True)
    print(f"done: {len(jobs)-len(errors)} ok, {len(errors)} errors, {total/1e6:.1f} MB total")
    for src, err in errors[:20]:
        print("ERR", src, err)


if __name__ == "__main__":
    main()
