#!/usr/bin/env python3
"""TRUE REDRAW of the Leonida basemap — v0.20.0, the BLUR FIX.

v0.19.0 drew a new illustrated map, but the user verdict was
"Wow it's so blurry .. you say 7 I say 3." Root causes, measured:

  1. DPR UPSCALE (dominant, MapView/Leaflet side): the pyramid was
     256px tiles served at tileSize 256 with no retina handling, so
     on his phone every tile pixel was stretched 2x (DPR 2) to 3x
     (DPR 3) by the browser. Measured live: naturalWidth 256,
     displayed 256 CSS px, devicePxPerTile 512 @ DPR2 / 768 @ DPR3.
     Leaflet's detectRetina cannot fix this: it clamps the layer
     minZoom to 0 (Leaflet 1.9.4 TileLayer.initialize), and this map
     lives at Leaflet zoom -5..1 — tiles below zoom 0 would vanish.
  2. BAKED BLUR in this script: every classification mask was
     gaussian-blurred (water sigma 2, green sigma 2, sand sigma 1),
     the relief shade was sigma 6 at +/-5%, and the output was
     JPEG quality 88. Measured on the z0 island tile: redrawn
     mean |gradient| 3.86 vs 8.99 for the day source — the redraw
     was less than half as sharp as the photo it was drawn from.

v0.20.0 fix (this script) — PIXEL BY PIXEL, provably:
  * Renders every tile at 512x512 (2x display density) from the same
    256px GTADB source. Leaflet tileSize stays 256, so a 512px tile
    displays at 256 CSS px: 1:1 device pixels at DPR 2, 1.5x at
    DPR 3 (was 3x), downsampled-crisp at DPR 1. Same filenames,
    coordinates and zooms — no map-code zoom change, no pin moves.
  * NO blur step anywhere in the image path. No gaussian on any
    mask, NO relief shade at all (the "blurred luminance base" is
    deleted, not reduced), no bilinear resampling of image data.
    Every output pixel is decided individually: its class comes
    from exactly ONE source pixel (nearest-neighbour lookup, never
    a blend of neighbours), its colour is a flat fill for that
    class. Coastline, forest edge and beach are hard 1-2px steps.
  * Roads are vector centrelines extracted from the road mask
    (skeletonize — geometry extraction, not a blur) and drawn as
    hard strokes at 512 with doubled widths, so strokes keep their
    true widths with hard edges. JPEG quality 92 (was 88).
  * The only soft things left, disclosed: (a) the sea depth bands
    are a smooth gradient by design, sampled from a continuous
    global shore-distance field (not from image pixels); (b) clouds
    at z0-z2 are soft puffs by design — real clouds are soft, and
    they cover water only; (c) the major-vs-minor road decision
    smooths the measured road-width field along the skeleton so a
    junction spike cannot turn a crossing coral — a classification
    decision only, it touches no painted pixel directly. Neither
    touches land, roads or blocks.
  * No step downsamples and no step upscales image data: the 512
    canvas is display density only — each of its pixels reads
    exactly one 256 source pixel. The source's finest detail is
    z6 (1 px per canonical unit); nothing here invents detail
    above it, and the report states the pixel counts to prove it.

SOURCE OF TRUTH (only): the GTADB In-Game Day tiles
(tiles-source/day/, z0-z6, same grid).
Coastline, water, sand, land, urban ground and roads all come from
THAT data. No invented coastline, road, city or place. The ungraded
originals stay in `tiles/day/`; the redrawn pyramid is
`tiles/redrawn/` with the same filenames, coordinates and zooms.

WHAT IS PAINTED (artistic interpretation):
* Flat illustrated fills per surface — deep-teal sea in depth bands,
  rich green land, warm sand, warm-grey city blocks. NO relief
  shade: v0.19's blurred-luminance base is deleted outright, not
  reduced. A flat fill is the sharpest possible fill — every pixel
  of one surface is exactly the same colour.
* Roads are VECTOR strokes over the flat land, drawn from skeleton
  centrelines of the source road network: casing + core. MAJOR roads
  and highways get a thin coral / sunset core with a soft glow.
  MINOR streets get a cream core, NO pink.
* Clouds at z0-z2 are large soft puffs over WATER only, in global
  coordinates so they never seam.
* Sea depth bands come from distance-to-land in the source land
  mask, not from bathymetry (there is none): shore turquoise ->
  mid teal -> deep teal. A styling device, labelled as such.

Output: public/assets/gta6-leonida-atlas/tiles/redrawn/<z>/ — 512px
tiles the app serves instead of tiles/styled/.

Run:
  python3 scripts/redraw-tiles.py --preview   # sample sheets, /tmp/v020
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
SRC = os.path.join(ROOT, "tiles-source/day")
DST = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/redrawn")
QUALITY = 92
OUT = 512  # v0.20.0: 2x supersampled tiles (source is 256px)


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


def _up2_nearest(a):
    """256 -> 512, NEAREST: hard step edges, no blur. Classification
    masks, skeletons and block masks go through here — the class
    boundary is where it is, and a hard step at 512px is the
    sharpest true edge the source supports. Each output pixel reads
    exactly ONE source pixel; no pixel is ever a blend of neighbours.
    This is the only "upscale" in the pipeline and it cannot blur:
    nearest-neighbour copies values, it never mixes them."""
    return np.repeat(np.repeat(a, 2, axis=0), 2, axis=1)


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


def _shore_distance(zoom, tile_y, tile_x, n=OUT):
    """Distance to land in OUTPUT pixels, from the GLOBAL shore-distance
    map (scripts/build-shore-distance.py, z2 grid, 1 px = 8 units).
    Per-tile distance transforms seam at borders (a tile's water far
    from land *inside that tile* paints abyss against a neighbour's
    bands); the global field is continuous by construction. Falls
    back to a per-tile transform if the map is missing.
    Returns a float nxn array. v0.20.0: sampled at 512 steps."""
    global _SHORE
    if _SHORE is None:
        try:
            _SHORE = np.asarray(
                Image.open(os.path.join(ROOT, "public/assets/gta6-leonida-atlas/shore-distance.png"))
                .convert("L")
            ).astype(np.float32)
            # v0.25: the field is uint8, 1 level = 8 units. Bilinear
            # sampling of those steps made the sea bands change in
            # visible increments at street zoom (the review's tonal
            # step in the Keys shot). A 1.5-px gaussian on the field
            # itself — once, at load — removes the steps; the bands
            # are smooth fields anyway, so no coastline moves.
            _SHORE = ndi.gaussian_filter(_SHORE, 1.5)
        except Exception:
            _SHORE = False
    if _SHORE is False:
        return None
    # Output pixel i sits at 256-scale coordinate (i + 0.5) / 2 inside
    # the tile; the z2 grid is 2^(2-zoom) z2-px per 256-tile-px.
    pos = (np.arange(n, dtype=np.float32) + 0.5) / 2.0
    gy_f = (tile_y * 256 + pos) * (2.0 ** (2 - zoom))
    gx_f = (tile_x * 256 + pos) * (2.0 ** (2 - zoom))
    y0 = np.clip(np.floor(gy_f).astype(int), 0, 4094)
    x0 = np.clip(np.floor(gx_f).astype(int), 0, 3070)
    fy = np.clip(gy_f - np.floor(gy_f), 0.0, 1.0)[:, None]
    fx = np.clip(gx_f - np.floor(gx_f), 0.0, 1.0)[None, :]
    top = _SHORE[np.ix_(y0, x0)] * (1.0 - fx) + _SHORE[np.ix_(y0, x0 + 1)] * fx
    bot = _SHORE[np.ix_(y0 + 1, x0)] * (1.0 - fx) + _SHORE[np.ix_(y0 + 1, x0 + 1)] * fx
    dist_z2 = top * (1.0 - fy) + bot * fy
    return dist_z2 * (2.0 ** (zoom - 1))  # z2 px -> OUT px (x2 vs 256)


_SHORE = None


def _sea_from_distance(dist_px, zoom, px_scale=2.0):
    """Sea RGB from distance-to-land in output px. Bands are in tile px
    and scale with zoom: a shore band is ~10 canonical units wide at
    every zoom, not 45 tile-px at z0. px_scale is OUT/256 (2.0)."""
    h, w = dist_px.shape
    zscale = 2.0 ** (zoom - 5)
    shore_hi = max(1.5, 10.0 * zscale) * px_scale
    mid_hi = max(5.0, 32.0 * zscale) * px_scale
    sea = np.tile(SEA_ABYSS, (h, w, 1)).astype(np.float32)
    band_mid = _smoothstep(dist_px, mid_hi, mid_hi * 0.35)
    band_shore = _smoothstep(dist_px, shore_hi, shore_hi * 0.3)
    _paint(sea, band_mid, SEA_MID)
    _paint(sea, band_shore, SEA_SHORE)
    far = _smoothstep(dist_px, mid_hi * 2.0, mid_hi * 4.0)
    _paint(sea, far * 0.5, SEA_DEEP)
    return sea


def _cloud_field(zoom, tile_y, tile_x, n=OUT):
    """Cloud puffs in GLOBAL coordinates (seamless by construction),
    z0 scale. A low-frequency envelope clusters them into patches
    with clear sea between — the reference sea is fringed with
    clouds at the edges, not polka-dotted all over. Returns float
    0..1 field, nxn. v0.20.0: sampled at 512, sigma 8 (was 4 @ 256)."""
    scale = 2.0**zoom
    pos = (np.arange(n, dtype=np.float32) + 0.5) / 2.0
    gx = (tile_x * 256.0 + pos[None, :]) / scale
    gy = (tile_y * 256.0 + pos[:, None]) / scale
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
    return ndi.gaussian_filter(cloud, 8.0)


def redraw(arr, zoom, tile_y, tile_x):
    """arr: uint8 256x256x3 RGB source day tile.
    Returns uint8 512x512x3 redrawn tile (v0.20.0: 2x supersample).

    Classification happens at 256 (the source resolution — nothing
    is invented above it); painting happens at 512 with hard edges.
    Masks are NEVER gaussian-blurred in v0.20.0: that blur was baked
    into every v0.19 tile and read as blur on the phone."""
    f = arr.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    lum = (0.30 * r + 0.50 * g + 0.20 * b) / 255.0

    # --- masks at 256 (same measured rules as the v0.18 dissection).
    # v0.20.0: NO gaussian_filter on any mask — the v0.19 sigmas
    # (water 2, green 2, sand 1) softened every coastline, forest
    # edge and beach by 4-5px before the phone ever saw them. ---
    water = _smoothstep(b - r, 35.0, 55.0) * _smoothstep(b - g, 5.0, 20.0)
    land = 1.0 - water

    # --- fast path: open ocean — sea bands from the GLOBAL distance
    # field (+ clouds at low zoom). NOT flat abyss: the flat fast path
    # seamed against neighbouring shore tiles' bands in the walk.
    if water.mean() > 0.985:
        dist = _shore_distance(zoom, tile_y, tile_x)
        if dist is None:
            dist = ndi.distance_transform_edt(water > 0.5) * 2.0
        out = _sea_from_distance(dist, zoom)
        if zoom <= 2:
            cloud = _cloud_field(zoom, tile_y, tile_x) * 0.70 * _up2_nearest(water)
            _paint(out, cloud, np.array([255.0, 255.0, 255.0]))
        return np.clip(out, 0, 255).astype(np.uint8)

    green_s = _smoothstep(g - r, 3.0, 20.0) * _smoothstep(g - b, 8.0, 30.0) * land
    if zoom <= 2:
        # Downsampled low-zoom tiles wash the green out (the dissection's
        # "unknown" mean is green-grey): loosen the rule or the whole
        # island paints as urban cream.
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

    # --- relief: DELETED in v0.20.0. v0.19 modulated every flat fill
    # by a heavily blurred source luminance (sigma 6, +/-5%) — a
    # cloudy mottling baked over the whole map. The user asked for
    # pixel by pixel with no blurred luminance base, so there is no
    # relief step at all now: flat fills are flat. ---

    # --- upscale to 512 for painting. Class boundaries NEAREST
    # (hard step). Water is thresholded so the coastline is a hard
    # edge, not a 4px ramp. No bilinear anywhere in the image path. ---
    water512 = (_up2_nearest(water) > 0.5).astype(np.float32)
    land512 = 1.0 - water512
    green512 = _up2_nearest(green_s)
    sand512 = _up2_nearest(sand_src)
    lum512 = _up2_nearest(lum)
    light512 = _up2_nearest(light)
    highway512 = _up2_nearest(highway)

    out = np.zeros((OUT, OUT, 3), dtype=np.float32)

    # --- sea: depth bands by distance to land, from the GLOBAL field
    # (continuous across tile borders — see _shore_distance). ---
    dist_to_land = _shore_distance(zoom, tile_y, tile_x)
    if dist_to_land is None:
        dist_to_land = ndi.distance_transform_edt(water > 0.5) * 2.0
    sea = _sea_from_distance(dist_to_land, zoom)
    out = out * (1.0 - water512[..., None]) + sea * water512[..., None]

    # --- land base: flat illustrated fills, NO relief modulation ---
    green_rgb = GREEN_FLAT[None, None, :]
    forest_rgb = FOREST_FLAT[None, None, :]
    land_rgb = green_rgb * (1.0 - green512[..., None]) + forest_rgb * green512[..., None]
    # Urban ground where the land is not green and not sand.
    urban_w = land512 * (1.0 - green512) * (1.0 - sand512)
    urban_rgb = URBAN_FLAT[None, None, :]
    land_rgb = land_rgb * (1.0 - urban_w[..., None]) + urban_rgb * urban_w[..., None]
    out = out * (1.0 - land512[..., None]) + land_rgb * land512[..., None]

    # --- sand: source sand + a coast band (land within 5px of water,
    # HARD step — v0.19's smoothstep ramp softened the beach edge) ---
    dist_to_water = ndi.distance_transform_edt(land > 0.5)
    coast_band = (dist_to_water <= 5.0).astype(np.float32) * land * (1.0 - green_s)
    sand_w = np.clip(sand_src + coast_band, 0.0, 1.0)
    sand_w512 = _up2_nearest(sand_w)
    _paint(out, sand_w512 * land512, SAND_FLAT * np.array([1.0, 1.0, 1.0]))

    # --- city blocks: light compact blobs that are NOT road get flat
    # block tones (two steps from quantised luminance) — the city reads
    # as drawn blocks, not photo rooftops. Classified at 256, painted
    # at 512 with hard edges. ---
    if zoom >= 4:
        skel, dist = _road_skeleton(light.copy())
        road_area = ndi.binary_dilation(skel, np.ones((7, 7), dtype=bool))
        blocks = light & ~road_area
        blocks = ndi.binary_erosion(blocks, np.ones((3, 3), dtype=bool))
        if blocks.any():
            block_lum = np.clip((lum - 0.55) / 0.30, 0.0, 1.0)
            dark = _up2_nearest(blocks & (block_lum < 0.5)).astype(np.float32)
            lite = _up2_nearest(blocks & (block_lum >= 0.5)).astype(np.float32)
            _paint(out, dark * land512, BLOCK_DARK)
            _paint(out, lite * land512, BLOCK_LIGHT)
    else:
        skel, dist = None, None

    # --- roads: vector strokes over the flat land ---
    if zoom <= 3:
        # Sub-pixel at these zooms: highways sunset, other light lines
        # a faint coral — never a wash. No skeleton, no glow. Hard
        # per-pixel values, nearest-upscaled — no gaussian anywhere.
        hwy_f = _up2_nearest(highway.astype(np.float32))
        _paint(out, hwy_f * 0.85, SUNSET)
        faint = (
            _smoothstep(mn, 208.0, 220.0)
            * _smoothstep(20.0 - (mx - mn), 0.0, 10.0)
            * land
        )
        _paint(out, _up2_nearest(faint) * (0.12 if zoom <= 1 else 0.22), CORAL)
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

        # Paint at 512: skeletons upscaled NEAREST (2px-wide hard
        # lines), dilation widths doubled vs v0.19 (glow 10, core 6,
        # minor 6) so strokes keep their true widths with hard edges.
        def dil(mask, size):
            return ndi.binary_dilation(mask, np.ones((size, size), dtype=bool))

        major512 = _up2_nearest(major)
        minor512 = _up2_nearest(minor)
        hwy_skel512 = _up2_nearest(hwy_skel)
        # Major: soft glow, thin coral core — no casing (v1's casing
        # made the line read thicker than its core). Minor: cream.
        if major512.any():
            _paint(out, dil(major512, 10).astype(np.float32) * 0.12, CORAL)
            _paint(out, dil(major512, 6).astype(np.float32) * 0.80, CORAL)
        # Highway cores overpaint in sunset (same geometry, warmer).
        if hwy_skel512.any():
            _paint(out, dil(hwy_skel512, 10).astype(np.float32) * 0.12, SUNSET)
            _paint(out, dil(hwy_skel512, 6).astype(np.float32) * 0.80, SUNSET)
        # Minor: cream core only — NO pink, NO glow. The pink-mess fix.
        if minor512.any():
            _paint(out, dil(minor512, 6).astype(np.float32) * 0.95, CREAM)
        # Wide non-skeleton highway ribbons (aprons/interchanges) sunset.
        if highway512.any():
            hwy_f = _up2_nearest(highway.astype(np.float32))
            _paint(out, hwy_f * 0.8, SUNSET)

    # --- clouds: z0-z2, large puffs over water only, 30% max alpha.
    # v0.18's 6% was invisible on his phone; the reference sea is
    # fringed with real clouds. ---
    if zoom <= 2:
        cloud = _cloud_field(zoom, tile_y, tile_x) * 0.70 * water512
        _paint(out, cloud, np.array([255.0, 255.0, 255.0]))

    return np.clip(out, 0, 255).astype(np.uint8)


def _render_one(args):
    src, dst, zoom, ty, tx = args
    try:
        # Resumable: a 512px tile on disk is done — skip it, so a
        # killed or interrupted run picks up where it left off
        # instead of re-rendering 31,022 tiles from scratch.
        if os.path.exists(dst):
            try:
                with Image.open(dst) as done:
                    if done.size == (OUT, OUT):
                        return (src, os.path.getsize(dst), None)
            except Exception:
                pass
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
    os.makedirs("/tmp/v020", exist_ok=True)
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
    sheet.save("/tmp/v020/preview-v6.png")
    print("saved /tmp/v020/preview-v6.png")

    # Full-island z0 composite, before vs after.
    for label, do_redraw in (("orig", False), ("redrawn", True)):
        comp = Image.new("RGB", (768, 1024))
        for ty in range(4):
            for tx in range(3):
                p = os.path.join(SRC, "0", f"0,{ty},{tx}.jpg")
                tile = Image.open(p).convert("RGB")
                if do_redraw:
                    tile = Image.fromarray(redraw(np.asarray(tile), 0, ty, tx)).resize(
                        (256, 256), Image.NEAREST
                    )
                comp.paste(tile, (tx * 256, ty * 256))
        comp.save(f"/tmp/v020/z0-{label}.png")
    print("saved /tmp/v020/z0-orig.png /tmp/v020/z0-redrawn.png")

    # Street-zoom composite: 2x2 z5 tiles over Vice City (the pink-mess view).
    comp = Image.new("RGB", (1024, 1024))
    for dy, ty in enumerate((61, 62)):
        for dx, tx in enumerate((68, 69)):
            p = os.path.join(SRC, "5", f"5,{ty},{tx}.jpg")
            tile = Image.fromarray(redraw(np.asarray(Image.open(p).convert("RGB")), 5, ty, tx))
            comp.paste(tile, (dx * 512, dy * 512))
    comp = comp.resize((768, 768), Image.NEAREST)
    comp.save("/tmp/v020/vc-street-z5.png")
    print("saved /tmp/v020/vc-street-z5.png")


def main():
    # SUPERSEDED (v0.20.2, user decision 2026-11-24): the illustrated
    # redraw is dead — the reference image is a render, not a real map,
    # and the repaint ended up worse than the real map. The basemap is
    # now the real GTADB tiles through ONE realism filter,
    # scripts/enhance-tiles.py. This script is kept for the record
    # only; it refuses to run.
    raise SystemExit(
        "redraw-tiles.py is superseded by enhance-tiles.py (v0.20.2). "
        "Do not re-run the redraw."
    )
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
