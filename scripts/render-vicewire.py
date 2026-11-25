#!/usr/bin/env python3
"""ViceWire basemap render — geometry-driven, one style z0-z6.

Overhaul basemap lane (2026-11-25). The user judged the v0.20.2 colour
grade "0 difference" against the reference and picked the AI-illustrated
island view (v0.22) for z0-z3, but that left two open wounds: the z3
tiles are soft/painterly (1344x1728 source, land-mask IoU 0.627, internal
roads are the generator's drawing) and the z3 -> z4 switch pops into the
pale real map. The v0.20 sharp geometry redraw was never fairly judged:
it was live on the server but invisible on the user's phone because of
the tile-cache bug. This script is its successor, built to be judged on
its merits.

APPROACH — geometry-driven render (not a grade, not a generation):
  * Source of truth ONLY: the GTADB In-Game Day tiles
    (tiles-source/day/, z0-z6). Coastline, water, sand, land, urban
    ground, buildings and roads all come from THAT data. No invented
    coastline, road, city or place. A pin on a road stays on that road.
  * Surfaces treated INDEPENDENTLY: sea (shore-distance depth bands),
    sand, green/forest (hill-shade + texture), urban ground, building
    blocks (roof edge shading), roads (fbrito vector centrelines at
    low zoom, our own skeleton centrelines at street zoom, both
    coloured by fbrito kind), clouds (procedural, water only, low
    zoom). Each surface gets its own treatment; nothing is a global tint.
  * NO blur on any classification mask or edge (the v0.19 lesson):
    masks are hard steps, painting is at 512px with nearest-neighbour
    class reads. Every output pixel's class comes from exactly ONE
    source pixel. The only smooth fields are (a) sea depth bands,
    sampled from the continuous global shore-distance field, (b) cloud
    puffs, soft by design, water only, and (c) terrain texture, a
    multiplier, never a blur of edges.
  * Dimensional terrain from the GTADB elevation grid
    (api.gtadb.org/data/6/elevation.bin, 16-bit 1536x1748, GTADB
    MIT maps.js calibration): VERIFIED aligned — its land mask
    matches our day-tile land mask at IoU 0.758. Used for
    hill-shading gradients ONLY; absolute heights are unverified
    (GTADB calibration gives Mount Kalaga ~404 m, leonida_gis
    claims ~800 m — the two disagree 2x), so no height is ever
    printed or baked as a label. Provenance: leak-derived GPU
    capture, usable with GTADB attribution, never presented as
    cleanly sourced, never redistributed.
  * Roads from fbritoferreira/gta6 ("Open GTA 6 Map", CC BY 4.0)
    vector data, VERIFIED against our real tiles
    (scripts/verify-fbrito.py): land polygons IoU 0.875 vs our
    land mask (beats the illustration's 0.627); road centrelines
    sit a median 3.6 px (z5 units) from our skeletonised road
    centrelines vs 16.1 px for a shifted control — aligned, but
    not pixel-exact. So: fbrito strokes at z0-z3 (a 3.6-unit
    offset is sub-pixel there) and OUR skeleton at z4-z6 (exact
    by construction), coloured by the nearest fbrito kind. The
    generator never draws a road: centrelines are real geometry.
  * ONE pyramid, ONE style, z0-z6: the same pipeline at every zoom,
    so zooming in feels like getting closer to the same map and the
    z3 -> z4 pop is gone by construction. Output is 512px tiles
    (v0.20's sharpness proof: 2x display density, 1:1 device pixels
    at DPR 2, crisp at DPR 3) under a FRESH versioned path
    (tiles/vicewire-v1/) — never reuse a tile path; the v0.20 stale
    tiles cost a whole pass.

PALETTE (goal-matched, After Hours family):
  sea abyss #053A4C -> deep teal -> bright cyan shallows; rich deep
  green land; gold sand; warm-grey urban ground; coral #FF527F major
  roads (restrained: major routes only, minor streets cream);
  sunset #FFB56B highways.

Usage:
  python3 scripts/render-vicewire.py --preview   # sample sheets, /tmp/vicewire/
  python3 scripts/render-vicewire.py --all       # full pyramid, 31,022 tiles
  python3 scripts/render-vicewire.py --zooms 0 1 2
  python3 scripts/render-vicewire.py --check     # counts + determinism
"""
import argparse
import glob
import importlib.util
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tiles-source/day")
DST = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/vicewire-v1")
QUALITY = 92
OUT = 512  # 2x display density; source is 256px, classes read nearest

# --- load the proven v0.20 helpers (no re-running that script) ---
_spec = importlib.util.spec_from_file_location(
    "redraw_v020", os.path.join(ROOT, "scripts/redraw-tiles.py")
)
R = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(R)
_smoothstep = R._smoothstep
_paint = R._paint
_up2_nearest = R._up2_nearest
_road_skeleton = R._road_skeleton
_shore_distance = R._shore_distance
_cloud_field = R._cloud_field

# --- ViceWire palette (goal-matched) ---
CORAL = np.array([255.0, 82.0, 127.0])      # #FF527F major-road core
SUNSET = np.array([255.0, 181.0, 107.0])    # #FFB56B highway core
CREAM = np.array([246.0, 238.0, 218.0])     # minor-street core (no pink)
SAND_FLAT = np.array([238.0, 216.0, 170.0])  # gold sand
GREEN_FLAT = np.array([74.0, 140.0, 88.0])    # rich green land
FOREST_FLAT = np.array([52.0, 118.0, 70.0])    # deep forest green
URBAN_FLAT = np.array([198.0, 192.0, 178.0])   # warm-grey city ground
URBAN_LOW = np.array([178.0, 176.0, 170.0])    # cooler city ground, island view
ROCK_FLAT = np.array([110.0, 145.0, 100.0])   # muted mid-green bare terrain
BLOCK_TONE = np.array([172.0, 166.0, 150.0])  # muted roof tone, one shade
SEA_SHORE = np.array([46.0, 178.0, 198.0])   # bright cyan shallows
SEA_MID = np.array([14.0, 102.0, 130.0])
SEA_DEEP = np.array([8.0, 76.0, 100.0])
SEA_ABYSS = np.array([5.0, 58.0, 76.0])      # #053A4C

# --- fbrito vector roads/rails (vendored, CC BY 4.0) ---
FBRITO_DIR = os.path.join(ROOT, "scripts/vendor/fbrito")
# Elevation grid (GTADB, leak-derived — never commit/redistribute).
# Read from the research dir or VICEWIRE_ELEVATION; if absent the render
# still runs, just without hill-shading (warned once per process).
ELEVATION_PATH = os.environ.get(
    "VICEWIRE_ELEVATION",
    os.path.expanduser("~/workspace/vicewire-research/elevation2.bin"),
)
_fbr_cache = None
_surf_cache = {}
_elev_cache = None
_elev_warned = False

KIND_HIGHWAY, KIND_MAIN, KIND_STREET, KIND_MINOR, KIND_RAIL = 1, 2, 3, 4, 5
KIND_NAMES = {1: "highway", 2: "main", 3: "street", 4: "minor", 5: "rail"}


def _fbrito_data():
    """(features, cell_index): features are (kind, [(gx, gy), ...]) in
    game coords; cell_index maps 512-unit cells -> feature ids."""
    global _fbr_cache
    if _fbr_cache is not None:
        return _fbr_cache
    import json

    feats = []
    for path, kind_map in (
        (os.path.join(FBRITO_DIR, "roads.json"), {"highway": 1, "main": 2, "street": 3, "minor": 4}),
        (os.path.join(FBRITO_DIR, "rails.json"), {}),
    ):
        data = json.loads(open(path).read())
        for f in data["features"]:
            kind = kind_map.get(f["properties"].get("kind"), 5) if kind_map else 5
            pts = [(x * 32 - 16384, 16384 - y * 32) for x, y in f["geometry"]["coordinates"]]
            feats.append((kind, pts))
    index = {}
    for i, (_, pts) in enumerate(feats):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        cx0, cx1 = int((min(xs) + 16384) // 512), int((max(xs) + 16384) // 512)
        cy0, cy1 = int((16384 - max(ys)) // 512), int((16384 - min(ys)) // 512)
        for cy in range(cy0, cy1 + 1):
            for cx in range(cx0, cx1 + 1):
                index.setdefault((cx, cy), []).append(i)
    _fbr_cache = (feats, index)
    return _fbr_cache


def _fbrito_in_tile(zoom, tile_y, tile_x):
    """Feature ids whose bbox touches this tile (game coords)."""
    feats, index = _fbrito_data()
    scale = 2.0 ** (5 - zoom)  # canonical units per 256-tile px
    west = tile_x * 256 * scale - 16384
    north = 16384 - tile_y * 256 * scale
    span = 256 * scale
    cx0, cx1 = int((west + 16384) // 512), int((west + span - 1 + 16384) // 512)
    cy0, cy1 = int((16384 - north) // 512), int((16384 - (north - span) + 1) // 512)
    ids = set()
    for cy in range(cy0, cy1 + 1):
        for cx in range(cx0, cx1 + 1):
            ids.update(index.get((cx, cy), ()))
    return feats, sorted(ids), west, north, span


def _elevation_gradients():
    """(dzdx, dzdy) in metres per game unit, on the 1748x1536 heightmap
    grid. Nodata (raw 0, open ocean outside the capture) is set to sea
    level so coastal gradients do not spike. Absolute heights are
    unverified (see header) — only gradients are used, for shading."""
    global _elev_cache, _elev_warned
    if _elev_cache is not None:
        return _elev_cache
    if not os.path.exists(ELEVATION_PATH):
        if not _elev_warned:
            print(f"WARNING: elevation grid not found at {ELEVATION_PATH} — no hill-shading",
                  file=sys.stderr)
            _elev_warned = True
        return None
    raw = np.fromfile(ELEVATION_PATH, dtype="<u2").reshape(1748, 1536).astype(np.float64)
    raw[raw == 0] = 28027.0  # sea level (the raw spike at 28026-28027)
    elev = raw / 92.466616 - 303.103
    # Grid: hx = 1108.53 + gx*0.0831883 (12.02 units/px), hy = 938.09 - gy*0.0831883.
    # np.gradient axis 1 -> d/dhx, axis 0 -> d/dhy = -d/dgy * (1/0.0831883).
    gy_grad, gx_grad = np.gradient(elev)
    per_unit = 0.083188297074
    dzdx = gx_grad * per_unit
    dzdy = -gy_grad * per_unit
    _elev_cache = (elev, dzdx, dzdy)
    return _elev_cache


def _relief(zoom, tile_y, tile_x):
    """(elev_m, hillshade) at 512 output px, bilinear-sampled from the
    elevation grid. elev in metres (calibration unverified — used only
    as a relative low/high discriminator, never printed). Hill-shade
    is the standard formula, light from the NW (azimuth 315, altitude
    45), vertical exaggeration 3x, centred so flat ground is 1.0.
    Returns (None, None) when the grid is absent. The grid is 12
    units per px, so at street zoom many output px share one sample:
    relief is a coarse field, never a per-pixel fake."""
    grads = _elevation_gradients()
    if grads is None:
        return None, None
    elev, dzdx, dzdy = grads
    scale = 2.0 ** (5 - zoom)
    step = scale / 2.0  # units per 512-output px
    west = tile_x * 256 * scale - 16384
    north = 16384 - tile_y * 256 * scale
    xs = west + (np.arange(OUT, dtype=np.float64) + 0.5) * step
    ys = north - (np.arange(OUT, dtype=np.float64) + 0.5) * step
    hxf = 1108.53 + xs * 0.083188297074
    hyf = 938.09 - ys * 0.083188297074

    def _sample(field):
        x0 = np.clip(np.floor(hxf).astype(int), 0, 1534)
        y0 = np.clip(np.floor(hyf).astype(int), 0, 1746)
        fx = np.clip(hxf - np.floor(hxf), 0.0, 1.0)[None, :]
        fy = np.clip(hyf - np.floor(hyf), 0.0, 1.0)[:, None]
        top = field[np.ix_(y0, x0)] * (1.0 - fx) + field[np.ix_(y0, x0 + 1)] * fx
        bot = field[np.ix_(y0 + 1, x0)] * (1.0 - fx) + field[np.ix_(y0 + 1, x0 + 1)] * fx
        return top * (1.0 - fy) + bot * fy

    elev512 = _sample(elev)
    gx = _sample(dzdx) * 4.0
    gy = _sample(dzdy) * 4.0
    # Standard hillshade. Aspect is the downhill direction, clockwise
    # from north: aspect = atan2(-dzdx, -dzdy). A NW-facing slope
    # (aspect 315) gets cos(azimuth - aspect) = 1 (bright); a
    # SE-facing slope gets -1 (shaded).
    slope_ex = np.arctan(np.sqrt(gx * gx + gy * gy))
    aspect = np.arctan2(-gx, -gy)
    zenith = np.radians(45.0)
    azimuth = np.radians(315.0)
    shade = np.cos(zenith) * np.cos(slope_ex) + np.sin(zenith) * np.sin(slope_ex) * np.cos(
        azimuth - aspect
    )
    shade = np.clip(shade, 0.0, 1.0)
    # Flat ground shades cos(45) = 0.707; centre the multiplier there.
    hill = 1.0 + (shade - 0.707) * 0.45
    return elev512, hill


def _fbrito_masks(zoom, tile_y, tile_x):
    """Rasterize fbrito roads/rails for one tile at 512 output px.

    Returns dict kind -> float32 512x512 mask (1.0 on the centreline,
    0 elsewhere), plus a 256x256 kind map (nearest fbrito kind within
    8 px, 0 = none) for colouring the skeleton at street zoom."""
    from PIL import ImageDraw

    feats, ids, west, north, span = _fbrito_in_tile(zoom, tile_y, tile_x)
    step = span / OUT  # units per output px
    masks = {}
    kind256 = np.zeros((256, 256), dtype=np.uint8)
    # Kind map at 256: draw each kind, dilate 8 px, priority highway first.
    img256 = {}
    for kind in (KIND_HIGHWAY, KIND_MAIN, KIND_STREET, KIND_MINOR, KIND_RAIL):
        img256[kind] = Image.new("L", (256, 256), 0)
    for i in ids:
        kind, pts = feats[i]
        px = [((gx - west) / (span / 256.0), (north - gy) / (span / 256.0)) for gx, gy in pts]
        d = ImageDraw.Draw(img256[kind])
        d.line(px, fill=255, width=1, joint="curve")
    for kind in (KIND_HIGHWAY, KIND_MAIN, KIND_STREET, KIND_MINOR, KIND_RAIL):
        m = np.asarray(img256[kind]) > 0
        if not m.any():
            continue
        dil = ndi.binary_dilation(m, np.ones((17, 17), dtype=bool))
        kind256[(kind256 == 0) & dil] = kind
    # 512 masks per kind (centrelines only, 1 px wide — widths are applied
    # by the caller with dilations, so the mask stays a centreline).
    for kind in (KIND_HIGHWAY, KIND_MAIN, KIND_STREET, KIND_MINOR, KIND_RAIL):
        img = Image.new("L", (OUT, OUT), 0)
        d = ImageDraw.Draw(img)
        for i in ids:
            k, pts = feats[i]
            if k != kind:
                continue
            px = [((gx - west) / step, (north - gy) / step) for gx, gy in pts]
            d.line(px, fill=255, width=1, joint="curve")
        arr = np.asarray(img)
        if arr.any():
            masks[kind] = (arr > 0).astype(np.float32)
    return masks, kind256


def _surface_mask(zoom, tile_y, tile_x, layer):
    """256x256 float mask (0..1) of one fbrito surface layer's polygons
    for this tile, dilated ~8 px and smoothed so the boundary is a
    gradient, not a cliff. Only 'urban' is used (city-grey gate)."""
    from PIL import ImageDraw

    global _surf_cache
    if layer not in _surf_cache:
        import json

        data = json.loads(open(os.path.join(FBRITO_DIR, "surface.json")).read())
        feats = []
        for f in data["features"]:
            if f["properties"].get("layer") != layer:
                continue
            rings = []
            for ring in f["geometry"]["coordinates"]:
                rings.append([(x * 32 - 16384, 16384 - y * 32) for x, y in ring])
            feats.append(rings)
        index = {}
        for i, rings in enumerate(feats):
            xs = [p[0] for ring in rings for p in ring]
            ys = [p[1] for ring in rings for p in ring]
            cx0, cx1 = int((min(xs) + 16384) // 512), int((max(xs) + 16384) // 512)
            cy0, cy1 = int((16384 - max(ys)) // 512), int((16384 - min(ys)) // 512)
            for cy in range(cy0, cy1 + 1):
                for cx in range(cx0, cx1 + 1):
                    index.setdefault((cx, cy), []).append(i)
        _surf_cache[layer] = (feats, index)
    feats, index = _surf_cache[layer]
    scale = 2.0 ** (5 - zoom)
    west = tile_x * 256 * scale - 16384
    north = 16384 - tile_y * 256 * scale
    span = 256 * scale
    cx0, cx1 = int((west + 16384) // 512), int((west + span - 1 + 16384) // 512)
    cy0, cy1 = int((16384 - north) // 512), int((16384 - (north - span) + 1) // 512)
    ids = set()
    for cy in range(cy0, cy1 + 1):
        for cx in range(cx0, cx1 + 1):
            ids.update(index.get((cx, cy), ()))
    img = Image.new("L", (256, 256), 0)
    d = ImageDraw.Draw(img)
    unit = span / 256.0
    for i in ids:
        rings = feats[i]
        outer = [((gx - west) / unit, (north - gy) / unit) for gx, gy in rings[0]]
        d.polygon(outer, fill=255)
        for hole in rings[1:]:
            hp = [((gx - west) / unit, (north - gy) / unit) for gx, gy in hole]
            d.polygon(hp, fill=0)
    m = (np.asarray(img) > 0)
    if m.any():
        m = ndi.binary_dilation(m, np.ones((17, 17), dtype=bool))
        return ndi.gaussian_filter(m.astype(np.float32), 4.0)
    return np.zeros((256, 256), dtype=np.float32)


def _sea_from_distance(dist_px, zoom, px_scale=2.0):
    """Sea RGB from distance-to-land in output px (same band logic as
    v0.20, ViceWire palette: brighter, wider shallows band)."""
    h, w = dist_px.shape
    zscale = 2.0 ** (zoom - 5)
    shore_hi = max(1.5, 14.0 * zscale) * px_scale
    mid_hi = max(5.0, 36.0 * zscale) * px_scale
    sea = np.tile(SEA_ABYSS, (h, w, 1)).astype(np.float32)
    band_mid = _smoothstep(dist_px, mid_hi, mid_hi * 0.35)
    band_shore = _smoothstep(dist_px, shore_hi, shore_hi * 0.3)
    _paint(sea, band_mid, SEA_MID)
    _paint(sea, band_shore, SEA_SHORE)
    far = _smoothstep(dist_px, mid_hi * 2.0, mid_hi * 4.0)
    _paint(sea, far * 0.5, SEA_DEEP)
    return sea


def _hash2(ix, iy, seed):
    """Deterministic 0..1 hash of integer lattice coords (uint64)."""
    z = (
        ix.astype(np.uint64) * np.uint64(0x9E3779B97F4A7C15)
        + iy.astype(np.uint64) * np.uint64(0xC2B2AE3D27D4EB4F)
        + np.uint64(seed)
    )
    z = (z ^ (z >> np.uint64(30))) * np.uint64(0xBF58476D1CE4E5B9)
    z = (z ^ (z >> np.uint64(27))) * np.uint64(0x94D049BB133111EB)
    z = z ^ (z >> np.uint64(31))
    return (z % np.uint64(1000)).astype(np.float64) / 1000.0


def _cloud_field_vw(zoom, tile_y, tile_x, n=OUT):
    """Cloud puffs in GLOBAL coordinates (seamless by construction).

    Same construction as v0.20's _cloud_field, but the puffs are ~3x
    smaller and fainter: v0.20's clouds rendered as giant white blobs
    that dominated the sea at island zoom (preview v1), while the
    reference sea is fringed with small wisps at the edges."""
    scale = 2.0**zoom
    pos = (np.arange(n, dtype=np.float32) + 0.5) / 2.0
    gx = (tile_x * 256.0 + pos[None, :]) / scale
    gy = (tile_y * 256.0 + pos[:, None]) / scale
    envelope = _smoothstep(
        np.sin(gx * 0.0084 + 0.6) * np.sin(gy * 0.0069 + 2.1), 0.05, 0.55
    )
    field = (
        np.sin(gx * 0.120 + 1.7) * np.sin(gy * 0.099 + 0.4)
        + 0.7 * np.sin((gx + gy) * 0.069 + 4.2)
        + 0.5 * np.sin((gx - gy) * 0.141 + 2.3)
        + 0.25 * np.sin(gx * 0.183 + gy * 0.159 + 0.9)
    )
    # Sparse small puffs: preview v3-2 showed the 0.90 threshold as a
    # regular diagonal band of blobs across the sea. The higher
    # threshold keeps only the field peaks (wisps, not weather).
    cloud = _smoothstep(field, 1.05, 1.55) * envelope
    return ndi.gaussian_filter(cloud, 8.0)


def _value_noise(n, zoom, tile_x, tile_y, cell_units, seed):
    """Smooth world-coordinate value noise, 0..1, nxn.

    Lattice spacing is cell_units canonical units, so the field is
    continuous across tile edges and approximately the same at every
    zoom (the same world point maps to the same lattice neighbourhood).
    Bilinear interpolation between lattice hashes — the FIELD is smooth,
    but it is only ever used as a multiplier on flat fills, never to
    blur an edge."""
    scale = 2.0 ** (6 - zoom)  # canonical units per 256-tile px
    step = scale / 2.0  # canonical units per 512-output px
    x0 = tile_x * 256 * scale - 16384
    y_top = 16384 - tile_y * 256 * scale
    xs = x0 + (np.arange(n, dtype=np.float64) + 0.5) * step
    ys = y_top - (np.arange(n, dtype=np.float64) + 0.5) * step
    gx = xs / cell_units
    gy = ys / cell_units
    x0i = np.floor(gx).astype(np.int64)
    y0i = np.floor(gy).astype(np.int64)
    fx = (gx - x0i)[None, :]
    fy = (gy - y0i)[:, None]
    v00 = _hash2(x0i[None, :], y0i[:, None], seed)
    v10 = _hash2(x0i[None, :] + 1, y0i[:, None], seed)
    v01 = _hash2(x0i[None, :], y0i[:, None] + 1, seed)
    v11 = _hash2(x0i[None, :] + 1, y0i[:, None] + 1, seed)
    # Smoothstep interpolation (no sharp lattice seams).
    sx = fx * fx * (3.0 - 2.0 * fx)
    sy = fy * fy * (3.0 - 2.0 * fy)
    top = v00 * (1.0 - sx) + v10 * sx
    bot = v01 * (1.0 - sx) + v11 * sx
    return top * (1.0 - sy) + bot * sy


def _terrain_texture(zoom, tile_x, tile_y, n=OUT):
    """Two-octave mottling, centred on 0, about +/-1.

    Coarse octave (128 canonical units) reads as terrain variation,
    fine octave (40 units) as canopy. Same world point -> same value
    at every zoom, so zooming does not shimmer."""
    coarse = _value_noise(n, zoom, tile_x, tile_y, 128.0, 0x51A3) - 0.5
    fine = _value_noise(n, zoom, tile_x, tile_y, 40.0, 0x7E7A) - 0.5
    return coarse * 1.4 + fine * 0.6


def render(arr, zoom, tile_y, tile_x):
    """arr: uint8 256x256x3 RGB source day tile.
    Returns uint8 512x512x3 ViceWire tile."""
    f = arr.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    lum = (0.30 * r + 0.50 * g + 0.20 * b) / 255.0

    # --- masks at 256 (same measured rules as v0.18/v0.20). NO gaussian
    # on any mask: hard steps only. ---
    water = _smoothstep(b - r, 35.0, 55.0) * _smoothstep(b - g, 5.0, 20.0)
    land = 1.0 - water

    # --- mask cleanup (preview v1 lesson): the raw water mask is noisy
    # near shores (JPEG artefacts flip individual sea pixels to land),
    # which painted sand speckles across the water and a ragged shore.
    # Threshold to binary, then close pinholes in the water and open
    # 1px land speckles out of the sea (cross structure, so thin
    # rivers survive). This moves a coastline by at most 1px at 256 —
    # the same pixel the classifier itself is unsure about — and the
    # cleaned mask is what every later step reads. Morphology runs on
    # an edge-padded copy so the tile border does not erode (a 1px
    # mask flip at a tile edge is a visible seam: the source tiles
    # already step slightly at their borders, and per-tile morphology
    # without padding would add to it).
    def _morph(mask, fn, structure):
        p = np.pad(mask, 1, mode="edge")
        return fn(p, structure=structure)[1:-1, 1:-1]

    water_bin = water > 0.5
    water_bin = _morph(water_bin, ndi.binary_closing, np.ones((3, 3), dtype=bool))
    cross = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], dtype=bool)
    water_bin = _morph(water_bin, ndi.binary_opening, cross)
    land_bin = ~water_bin
    # Big water (sea + Lake Leonida) vs tiny pools: label the water and
    # keep components >= 400px. The sand coast band only hugs big
    # water — a pool in a garden does not get a beach ring.
    lab_w, n_w = ndi.label(water_bin, structure=np.ones((3, 3), dtype=int))
    big_water = np.zeros_like(water_bin)
    if n_w:
        sizes_w = ndi.sum_labels(np.ones_like(lab_w), lab_w, range(1, n_w + 1))
        for i, size in enumerate(sizes_w, start=1):
            if size >= 400:
                big_water[lab_w == i] = True

    # --- fast path: open ocean — sea bands from the GLOBAL distance
    # field (+ clouds at low zoom). ---
    if water.mean() > 0.985:
        dist = _shore_distance(zoom, tile_y, tile_x)
        if dist is None:
            dist = ndi.distance_transform_edt(water > 0.5) * 2.0
        out = _sea_from_distance(dist, zoom)
        if zoom <= 2:
            cloud = _cloud_field_vw(zoom, tile_y, tile_x) * 0.30 * _up2_nearest(water_bin.astype(np.float32))
            _paint(out, cloud, np.array([255.0, 255.0, 255.0]))
        return np.clip(out, 0, 255).astype(np.uint8)

    green_s = _smoothstep(g - r, 3.0, 20.0) * _smoothstep(g - b, 8.0, 30.0) * land
    if zoom <= 2:
        green_s = _smoothstep(g - r, 0.0, 8.0) * _smoothstep(g - b, 2.0, 12.0) * land
    sand_src = (
        _smoothstep(r - b, 15.0, 30.0)
        * _smoothstep(g - b, 5.0, 15.0)
        * _smoothstep(r, 140.0, 170.0)
        * land
        * (1.0 - green_s)
    )
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    light = (mn > 192) & ((mx - mn) < 22) & ((b - r) < 16) & (land > 0.5)
    highway = (
        (r > 205) & (g > 195) & ((r - b) > 25) & ((r - b) < 60) & ((mx - mn) > 20) & (land > 0.5)
    )

    # --- upscale to 512 for painting. Class boundaries NEAREST. ---
    water512 = (_up2_nearest(water_bin.astype(np.float32)) > 0.5).astype(np.float32)
    land512 = 1.0 - water512
    green512 = _up2_nearest(green_s)
    sand512 = _up2_nearest(sand_src)
    lum512 = _up2_nearest(lum)
    light512 = _up2_nearest(light)
    highway512 = _up2_nearest(highway)

    out = np.zeros((OUT, OUT, 3), dtype=np.float32)

    # --- sea: depth bands from the GLOBAL field (no seams). ---
    dist_to_land = _shore_distance(zoom, tile_y, tile_x)
    if dist_to_land is None:
        dist_to_land = ndi.distance_transform_edt(water > 0.5) * 2.0
    sea = _sea_from_distance(dist_to_land, zoom)
    out = out * (1.0 - water512[..., None]) + sea * water512[..., None]

    # --- land base: flat illustrated fills, then DIMENSIONAL texture.
    # (a) The source's own luminance, per-pixel, never blurred:
    # mountains and forest in the in-game map carry luminance
    # variation; modulating the flat fill by it (clamped +/-7%)
    # restores that variation with hard edges intact.
    # (b) World-coordinate value-noise mottling on green only.
    # Both are multipliers on the fill, never a blur of any edge. ---
    green_rgb = GREEN_FLAT[None, None, :]
    forest_rgb = FOREST_FLAT[None, None, :]
    land_rgb = green_rgb * (1.0 - green512[..., None]) + forest_rgb * green512[..., None]
    # Building bucket (dissection classifier: low-spread, luminance
    # 150-197 on a 0-255 scale — lum here is 0..1, so 150/255..197/255;
    # a units bug in v3-preview-1 wrote 150..197 against 0..1 and the
    # bucket was always empty, so no blocks ever painted). Its smoothed
    # density, gated by the fbrito 'urban' polygons and by low
    # elevation, is the city discriminator: Vice City is ~50% buildings
    # inside the urban polygons at ~0 m; the northern hills are ~1%
    # buildings at 100-400 m; the Keys are pale ground in the bucket
    # but outside every urban polygon. Pale non-green land is city
    # ground ONLY where all three agree; elsewhere it is bare terrain
    # in a muted mid-green. Preview v3-1 painted the hills pale grey
    # and the Keys as a grey slab because colour alone cannot tell
    # rock/pavement from a city.
    spread = mx - mn
    building = (spread <= 18) & (lum >= 150 / 255.0) & (lum < 197 / 255.0) & land_bin & (green_s <= 0.5)
    dens = ndi.gaussian_filter(building.astype(np.float32), 6.0)
    urb_dens = _smoothstep(dens, 0.10, 0.35)
    elev512, hill = _relief(zoom, tile_y, tile_x) if land_bin.any() else (None, None)
    urban_w = land512 * (1.0 - green512) * (1.0 - sand512)
    urb_dens512 = _up2_nearest(urb_dens)
    # City gate: the fbrito 'urban' polygons. Colour alone cannot tell
    # a city from the Keys' pale ground (same pale blue-grey, both in
    # the building bucket), but the polygons can: Vice City is inside
    # them, the Keys island is not. The polygon mask is dilated and
    # smoothed, and it multiplies the (already smooth) density and
    # elevation factors, so the city edge is a gradient, not a cliff.
    urb_poly512 = _up2_nearest(_surface_mask(zoom, tile_y, tile_x, "urban"))
    if elev512 is not None:
        urb_elev = 1.0 - _smoothstep(elev512, 50.0, 130.0)
        cityness = urb_poly512 * urb_dens512 * urb_elev
    else:
        cityness = urb_poly512 * urb_dens512
    urban_rgb = (URBAN_LOW if zoom <= 2 else URBAN_FLAT)[None, None, :]
    land_rgb = land_rgb * (1.0 - (urban_w * cityness)[..., None]) + urban_rgb * (urban_w * cityness)[..., None]
    land_rgb = land_rgb * (1.0 - (urban_w * (1.0 - cityness))[..., None]) + ROCK_FLAT[None, None, :] * (urban_w * (1.0 - cityness))[..., None]
    out = out * (1.0 - land512[..., None]) + land_rgb * land512[..., None]
    lum_mod = 1.0 + np.clip((lum512 - 0.5) * 0.16, -0.07, 0.07)
    tex = _terrain_texture(zoom, tile_x, tile_y)
    green_tex = 1.0 + tex * 0.06 * green512
    # Hill-shade from the elevation grid (real relief, NW light).
    # Replaces most of the fake mottling's job: the value noise stays
    # as a faint canopy texture only.
    mod = lum_mod * green_tex
    if hill is not None:
        mod = mod * hill
    out = out * (1.0 - land512[..., None]) + out * mod[..., None] * land512[..., None]

    # --- sand: source sand + a coast band hugging BIG water only
    # (land within 5px of sea/lake — pools get no beach ring). Then
    # drop small sand components: isolated sand-coloured JPEG noise
    # in the sea painted as speckles in preview v1. A real beach
    # touches the coast band, so it is never dropped.
    dist_to_big = ndi.distance_transform_edt(~big_water)
    coast_band = (dist_to_big <= 5.0).astype(np.float32) * land_bin * (1.0 - green_s)
    sand_w = np.clip(sand_src + coast_band, 0.0, 1.0)
    lab_s, n_s = ndi.label(sand_w > 0.5, structure=np.ones((3, 3), dtype=int))
    if n_s:
        sizes_s = ndi.sum_labels(np.ones_like(lab_s), lab_s, range(1, n_s + 1))
        keep_s = np.zeros_like(sand_w)
        min_sand = 10 if zoom <= 3 else 40
        for i, size in enumerate(sizes_s, start=1):
            comp = lab_s == i
            if size >= min_sand or (comp & (coast_band > 0.5)).any():
                keep_s[comp] = sand_w[comp]
        sand_w = keep_s
    sand_w512 = _up2_nearest(sand_w)
    _paint(out, sand_w512 * land512, SAND_FLAT)

    # --- city blocks: the dissection classifier's building bucket
    # (low-spread, luminance 150-197) — the pale blue-grey rooftops.
    # Preview v1 used the near-white `light` mask for blocks and
    # found almost none: rooftops are NOT near-white (tile mean
    # rgb(168,176,189); building bucket is 49% of a city tile).
    # Two tones from quantised luminance, plus fake-3D roof edge
    # shading at street zoom (light north edge, dark south edge,
    # INSIDE the existing footprint — no geometry invented). The
    # `building` mask is computed above (land base) and reused here.
    if zoom >= 4:
        building = _morph(building, ndi.binary_opening, cross)
        if building.any():
            # ONE muted roof tone, slightly darker than the urban ground,
            # modulated by the source luminance (already applied to the
            # land). The v3 two-tone split (block_lum < 0.5 vs >= 0.5)
            # read as black/white static: the source luminance inside a
            # rooftop is JPEG noise, so the split was a checkerboard.
            # Dimensionality comes from the edge shading alone, kept
            # subtle (0.25 / 0.30, was 0.55 / 0.75).
            _paint(out, _up2_nearest(building).astype(np.float32) * land512, BLOCK_TONE)
            if zoom >= 5:
                b512 = _up2_nearest(building).astype(np.float32)
                north = b512 * (1.0 - np.vstack([np.zeros((1, OUT), dtype=np.float32), b512[:-1, :]]))
                south = b512 * (1.0 - np.vstack([b512[1:, :], np.zeros((1, OUT), dtype=np.float32)]))
                _paint(out, north * land512 * 0.35, np.array([255.0, 255.0, 255.0]))
                _paint(out, south * land512 * 0.40, np.array([0.0, 0.0, 0.0]))
        skel, dist = _road_skeleton(light.copy())
    else:
        skel, dist = None, None

    # --- roads: vector strokes over the flat land. ---
    if zoom <= 3:
        # fbrito vector centrelines (verified: median 3.6 units from our
        # real road centrelines — sub-pixel at these zooms). Thin and
        # restrained: the review's z3 complaint was 15-20px glowing
        # pink/orange ribbons, and v3-preview-1 showed a full-strength
        # minor-road mesh turning the whole island pink at z0. So the
        # network GENERALISES with zoom like a real map: z0-z1 show
        # highways + mains only, streets fade in at z2, minors at
        # z3. No glow halo; a subtle dark casing only on highway/main
        # at z2-z3. Rails: thin dark slate, barely there.
        masks, _ = _fbrito_masks(zoom, tile_y, tile_x)
        # Core widths in 512-output px (1 output px = 2^(4-zoom) units).
        core_w = {
            KIND_HIGHWAY: {0: 2, 1: 2, 2: 3, 3: 3}[zoom],
            KIND_MAIN: {0: 1, 1: 2, 2: 2, 3: 3}[zoom],
            KIND_STREET: {0: 1, 1: 1, 2: 2, 3: 2}[zoom],
            KIND_MINOR: {0: 1, 1: 1, 2: 1, 3: 1}[zoom],
        }
        # Alpha per kind per zoom: minor streets are below the
        # resolution at island scale — not drawing them is honest
        # cartographic generalisation, not missing data. At z3 the
        # minor web read as pink spaghetti in preview v3-1, so minors
        # are 1px and faint there too.
        core_a = {
            KIND_HIGHWAY: 1.0,
            KIND_MAIN: 0.95,
            KIND_STREET: {0: 0.0, 1: 0.55, 2: 0.8, 3: 0.8}[zoom],
            KIND_MINOR: {0: 0.0, 1: 0.0, 2: 0.5, 3: 0.6}[zoom],
        }
        core_c = {
            KIND_HIGHWAY: SUNSET,
            KIND_MAIN: CORAL,
            KIND_STREET: CORAL,
            KIND_MINOR: CORAL,
        }
        for kind in (KIND_MINOR, KIND_STREET, KIND_MAIN, KIND_HIGHWAY):
            m = masks.get(kind)
            a = core_a[kind]
            if m is None or a <= 0.0:
                continue
            w = core_w[kind]
            if zoom >= 2 and kind in (KIND_HIGHWAY, KIND_MAIN) and w > 1:
                _paint(
                    out,
                    ndi.binary_dilation(m > 0, np.ones((w + 2, w + 2), dtype=bool)).astype(np.float32)
                    * 0.35,
                    core_c[kind] * 0.45,
                )
            _paint(
                out,
                ndi.binary_dilation(m > 0, np.ones((w, w), dtype=bool)).astype(np.float32) * a,
                core_c[kind],
            )
        rail = masks.get(KIND_RAIL)
        if rail is not None:
            rw = 1 if zoom <= 1 else 2
            _paint(
                out,
                ndi.binary_dilation(rail > 0, np.ones((rw, rw), dtype=bool)).astype(np.float32) * 0.6,
                np.array([58.0, 74.0, 85.0]),
            )
    else:
        if skel is None:
            skel, dist = _road_skeleton(light.copy())
        major_hw = 8.0 * (2.0 ** (zoom - 5))
        w_field = np.where(skel, dist, 0.0).astype(np.float32)
        w_smooth = ndi.gaussian_filter(w_field, 3.0) / np.maximum(
            ndi.gaussian_filter(skel.astype(np.float32), 3.0), 1e-6
        )
        major = skel & (w_smooth >= major_hw)
        lab_m, n_m = ndi.label(major, structure=np.ones((3, 3), dtype=int))
        if n_m:
            sizes_m = ndi.sum_labels(np.ones_like(lab_m), lab_m, range(1, n_m + 1))
            for i, size in enumerate(sizes_m, start=1):
                if size < 20:
                    major[lab_m == i] = False
        nbrs = ndi.convolve(skel.astype(int), np.ones((3, 3), dtype=int), mode="constant", cval=0) - 1
        junction = skel & (nbrs >= 3)
        if junction.any():
            jzone = ndi.binary_dilation(junction, np.ones((15, 15), dtype=bool))
            major = major & ~jzone
        minor = skel & ~major
        hwy_dil = ndi.binary_dilation(highway, np.ones((5, 5), dtype=bool))
        hwy_skel = skel & hwy_dil
        major = major | hwy_skel
        minor = minor & ~hwy_skel
        # Colour by fbrito kind where a vector road is within 8 px
        # (the vectors sit a median 3.6 px off our centrelines, so the
        # kind is reliable even though the geometry is not used here).
        # Unclassified skeleton keeps the width-based major/minor split.
        masks, kind256 = _fbrito_masks(zoom, tile_y, tile_x)
        hwy_skel = hwy_skel | (skel & (kind256 == KIND_HIGHWAY))
        major = (major | (skel & (kind256 == KIND_MAIN))) & ~hwy_skel
        minor = skel & ~major & ~hwy_skel

        def dil(mask, size):
            return ndi.binary_dilation(mask, np.ones((size, size), dtype=bool))

        major512 = _up2_nearest(major)
        minor512 = _up2_nearest(minor)
        hwy_skel512 = _up2_nearest(hwy_skel)
        # Restrained cores (v1 lesson: the 10px 0.12 halo + full-width
        # highway wash read as thick pink/orange at street zoom).
        # No halo, thin cores sitting on the pale real road.
        if major512.any():
            _paint(out, dil(major512, 5).astype(np.float32) * 0.85, CORAL)
        if hwy_skel512.any():
            _paint(out, dil(hwy_skel512, 5).astype(np.float32) * 0.85, SUNSET)
        if minor512.any():
            if zoom >= 5:
                # Skeleton lines with no fbrito road within 8 px are
                # driveways, parking aisles and alleys, not streets:
                # paint them fainter so the real street grid reads.
                minor_known = _up2_nearest((minor & (kind256 != 0)).astype(np.float32))
                minor_unknown = _up2_nearest((minor & (kind256 == 0)).astype(np.float32))
                _paint(out, dil(minor_known, 4).astype(np.float32) * 0.95, CREAM)
                _paint(out, dil(minor_unknown, 4).astype(np.float32) * 0.4, CREAM)
            else:
                _paint(out, dil(minor512, 4).astype(np.float32) * 0.95, CREAM)
        rail = masks.get(KIND_RAIL)
        if rail is not None:
            _paint(out, dil(rail, 3).astype(np.float32) * 0.8, np.array([58.0, 74.0, 85.0]))

    # --- clouds: z0-z2, small faint puffs over water only (same field
    # as the ocean fast path — v0.20's _cloud_field rendered as giant
    # white blobs and must not be used here). ---
    if zoom <= 2:
        cloud = _cloud_field_vw(zoom, tile_y, tile_x) * 0.30 * water512
        _paint(out, cloud, np.array([255.0, 255.0, 255.0]))

    # --- shoreline foam: a crisp bright edge where water meets land
    # (hdr6-style). The shore band in _sea_from_distance gives the
    # bright shallows; this adds the 1-2px white waterline.
    if water512.any() and land512.any():
        foam = _smoothstep(dist_to_land, 4.0, 0.5) * water512
        _paint(out, foam * 0.45, np.array([235.0, 248.0, 250.0]))

    # --- fine grain (hdr6-style, anti-banding): deterministic per-tile
    # noise, +/-2 levels. Seeded from the tile coords so the render is
    # reproducible and identical across runs.
    rng = np.random.default_rng((zoom * 1000003 + tile_y * 9176 + tile_x * 131) % (2**32))
    grain = rng.normal(0.0, 1.6, (OUT, OUT, 1)).astype(np.float32)
    out = out + grain

    return np.clip(out, 0, 255).astype(np.uint8)


def _render_one(args):
    src, dst, zoom, ty, tx = args
    try:
        if os.path.exists(dst):
            try:
                with Image.open(dst) as done:
                    if done.size == (OUT, OUT):
                        return (src, os.path.getsize(dst), None)
            except Exception:
                pass
        arr = np.asarray(Image.open(src).convert("RGB"))
        out = render(arr, zoom, ty, tx)
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
    """Sample sheets to /tmp/vicewire/ for the eye check, before the
    full run. Before/after pairs + composites at the three test spots:
    full island, Vice City district, street-zoom interchange."""
    import time

    os.makedirs("/tmp/vicewire", exist_ok=True)
    t0 = time.time()
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
        styled = render(arr, z, int(parts[1]), int(parts[2]))
        before = Image.open(src).convert("RGB").resize((384, 384), Image.NEAREST)
        after = Image.fromarray(styled).resize((384, 384), Image.NEAREST)
        pair = Image.new("RGB", (384, 384 * 2 + 8))
        pair.paste(before, (0, 0))
        pair.paste(after, (0, 384 + 8))
        cols.append(pair)
        print(f"{name} done ({time.time() - t0:.1f}s)")
    sheet = Image.new("RGB", (384 * len(cols), 384 * 2 + 8))
    for i, c in enumerate(cols):
        sheet.paste(c, (384 * i, 0))
    sheet.save("/tmp/vicewire/preview-samples.png")
    print("saved /tmp/vicewire/preview-samples.png")

    # Full-island z0 composite, day vs vicewire.
    for label, do_render in (("orig", False), ("vicewire", True)):
        comp = Image.new("RGB", (768, 1024))
        for ty in range(4):
            for tx in range(3):
                p = os.path.join(SRC, "0", f"0,{ty},{tx}.jpg")
                tile = Image.open(p).convert("RGB")
                if do_render:
                    tile = Image.fromarray(render(np.asarray(tile), 0, ty, tx)).resize(
                        (256, 256), Image.NEAREST
                    )
                comp.paste(tile, (tx * 256, ty * 256))
        comp.save(f"/tmp/vicewire/z0-{label}.png")
    print("saved /tmp/vicewire/z0-orig.png /tmp/vicewire/z0-vicewire.png")

    # Street-zoom composite: 2x2 z6 tiles over Vice City (Ajax area,
    # ty 114 / tx 139 is Ajax Gym: x=1420 -> tx=(1420+16384)/128=139,
    # y=1766 -> ty=(16384-1766)/128=114).
    comp = Image.new("RGB", (1024, 1024))
    for dy, ty in enumerate((114, 115)):
        for dx, tx in enumerate((139, 140)):
            p = os.path.join(SRC, "6", f"6,{ty},{tx}.jpg")
            tile = Image.fromarray(render(np.asarray(Image.open(p).convert("RGB")), 6, ty, tx))
            comp.paste(tile, (dx * 512, dy * 512))
    comp = comp.resize((768, 768), Image.NEAREST)
    comp.save("/tmp/vicewire/vc-street-z6.png")
    print("saved /tmp/vicewire/vc-street-z6.png")

    # District composite: 2x2 z4 tiles over Vice City (z4 tiles are 512
    # units across: x~1000 -> tx=33, y~1000 -> ty=30).
    comp = Image.new("RGB", (1024, 1024))
    for dy, ty in enumerate((30, 31)):
        for dx, tx in enumerate((33, 34)):
            p = os.path.join(SRC, "4", f"4,{ty},{tx}.jpg")
            tile = Image.fromarray(render(np.asarray(Image.open(p).convert("RGB")), 4, ty, tx))
            comp.paste(tile, (dx * 512, dy * 512))
    comp = comp.resize((768, 768), Image.NEAREST)
    comp.save("/tmp/vicewire/vc-district-z4.png")
    print("saved /tmp/vicewire/vc-district-z4.png")

    # z3 2x2 composites at the review's complaint spots (seam near the
    # vertical tile edge, Keys pale-slab break). z3 tiles are 1024
    # units across: Mount Kalaga (-3400, 6400 -> tx 12, ty 9) and the
    # Keys (-4000, -6000 -> tx 12, ty 21). Stitched, so a seam shows.
    for name, tys, txs in (
        ("hills-z3", (9, 10), (12, 13)),
        ("keys-z3", (21, 22), (12, 13)),
    ):
        comp = Image.new("RGB", (1024, 1024))
        for dy, ty in enumerate(tys):
            for dx, tx in enumerate(txs):
                p = os.path.join(SRC, "3", f"3,{ty},{tx}.jpg")
                tile = Image.fromarray(render(np.asarray(Image.open(p).convert("RGB")), 3, ty, tx))
                comp.paste(tile, (dx * 512, dy * 512))
        comp = comp.resize((768, 768), Image.NEAREST)
        comp.save(f"/tmp/vicewire/{name}.png")
        print(f"saved /tmp/vicewire/{name}.png")
    print(f"preview total {time.time() - t0:.1f}s")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--zooms", nargs="+", type=int, default=[])
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()
    if args.preview:
        preview()
        return 0
    if args.check:
        for zoom in range(7):
            sdir = os.path.join(SRC, str(zoom))
            ddir = os.path.join(DST, str(zoom))
            s = len([n for n in os.listdir(sdir) if n.endswith(".jpg")]) if os.path.isdir(sdir) else 0
            d = len([n for n in os.listdir(ddir) if n.endswith(".jpg")]) if os.path.isdir(ddir) else 0
            print(f"z{zoom}: day={s} vicewire={d}")
        # Determinism: render one tile twice, identical bytes.
        src = os.path.join(SRC, "5/5,62,69.jpg")
        arr = np.asarray(Image.open(src).convert("RGB"))
        a = render(arr, 5, 62, 69)
        b = render(arr, 5, 62, 69)
        assert np.array_equal(a, b), "non-deterministic"
        print("determinism OK")
        return 0
    zooms = list(range(0, 7)) if args.all else args.zooms
    if not zooms:
        print("pass --preview, --all, --zooms or --check", file=sys.stderr)
        return 2
    jobs = _tile_jobs(zooms)
    print(f"{len(jobs)} tiles to render")
    import time

    start = time.time()
    total = 0
    errors = []
    with Pool(args.workers) as pool:
        for i, (src, size, err) in enumerate(
            pool.imap_unordered(_render_one, jobs, chunksize=16)
        ):
            total += size
            if err:
                errors.append((src, err))
            if (i + 1) % 2000 == 0:
                print(
                    f"{i + 1}/{len(jobs)}  {total / 1e6:.1f} MB  "
                    f"{(i + 1) / (time.time() - start):.1f} tiles/s",
                    flush=True,
                )
    print(f"done: {len(jobs) - len(errors)} ok, {len(errors)} errors, {total / 1e6:.1f} MB total")
    for src, err in errors[:20]:
        print("ERR", src, err)
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
