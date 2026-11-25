#!/usr/bin/env python3
"""Colour grade ONLY for the GTADB In-Game Day tiles (v0.28.0).

User verdict (2026-11-25 08:23, final): v0.27 was a waste of time.
Strip ALL of the ViceWire rendering. Use the real GTADB maps as-is,
with ONLY a colour filter on top: deeper blues, better contrast,
realistic colours. NO more generative AI, NO illustrated redraw, NO
geometry-driven repaint, NO surface classification, NO painted
roads/buildings/water. He needs to SEE the shape of the buildings —
the raw tiles already draw real building footprints, and every repaint
so far has painted over them.

THE RULES THIS SCRIPT OBEYS
1. GEOGRAPHY LOCKED 1:1. Every output pixel comes from exactly one
   source pixel at the same coordinates. No resampling, no blur, no
   warp, no inpainting, no new roads, no new coastline, no moved
   cities. A pin on a road stays on that road. The raw tiles ARE the
   map; this script only re-grades their colours.
2. ONE PIPELINE, EVERYWHERE. The same fixed parameters for every tile
   at every zoom. No per-tile tuning, no per-zoom look. The transform
   is a pure function of the pixel's own colour. That is what makes
   zooming feel like getting closer to the same map instead of a
   different map loading: parent and child tiles agree because they
   went through the same function.
3. NO FLICKER. Nothing in the pipeline depends on the pixel's position
   inside its tile (no vignette, no per-tile normalisation, no grain
   keyed on coordinates), so neighbouring tiles cannot disagree at a
   shared edge.
4. SHARP. Native 256px in, native 256px out. No grain, no stipple:
   the v0.20.2 grain (+/-4 levels) and the v0.25 fine grain both
   washed out the dark outlines that give buildings their shape, so
   they are gone. The building footprints survive because the grade
   only stretches the colours that are already there — the strong
   S-curve darkens dark outlines and lifts light roofs, which is
   what makes the shapes read.
5. HILL-SHADE KEPT (user verdict 2026-11-25 08:30: "Hills shading
   looks very nice btw !!"). The elevation-gradient hill-shade from
   the ViceWire render stays, as a LUMINANCE-ONLY multiplier inside
   this grade: each raw pixel is multiplied by the hill-shade factor
   from the elevation grid (same formula as render-vicewire.py's
   _relief — standard hillshade, light from the NW, azimuth 315,
   altitude 45, factor 1.0 + (shade - 0.707) * 0.45). It shades the
   raw pixels that are already there, exactly like a lighting
   filter: no surface classification, no painted roads/buildings/
   water, nothing moves. It is gated off the water by the grade's
   own soft sea mask — exactly as v0.27 gated it to land — and it
   is a smooth low-frequency field (the grid is 12 game units per
   px, so at street zoom many pixels share one sample), never a
   per-pixel fake, so building outlines stay crisp. Gradients only,
   render-time only, never vendored; absolute heights unverified.
6. VISIBLY DIFFERENT. The v0.20.2 grade measured as "0 difference"
   on the user's phone: sea_sat 1.45, contrast 0.10 was too gentle
   at phone scale. This grade is deliberately strong — sea value
   x0.72 with saturation x1.90, contrast 0.30 — and the proof gate
   (raw-vs-graded 100% crops + measured colour deltas) must show it
   before the pyramid ships. If the crops look identical, retune,
   don't ship.

What the filter does (colour only):
- Sea AND inland water (same hue family — one water family):
  deeper teal, much more saturated, darker.
- Land (pale grey-blue city ground): warmed, enriched, and given
  real contrast by the S-curve, so pale blocks separate from roads.
- Green (parks/vegetation): richer, slightly darker.
- Sand (pale yellow): warmer gold.
- Roads (near-white): warm cream, kept bright.
- A strong S-curve on luminance for depth (continuous, no banding).
- Hill-shading from the elevation gradient (rule 5 above): the
  northern hills and ridges get real NW-light relief, the flat
  city and the sea stay flat (factor 1.0 where the ground is flat).

The day tiles are the source of truth and are NEVER overwritten:
input is tiles-source/day/ (or --src), output is tiles/graded/ (or
--dst) with identical filenames, zooms and grid. The app serves the
graded pyramid; the as-is fallback is one path change in gtadbTileUrl.

The y=0 ocean rows (v0.25 fill): the day pyramid's grid starts at
ty=1 (z1), ty=2 (z2), ty=4 (z3), so the island fit view can request
tiles the pyramid never drew. --fill-ocean renders those 505 tiles
from a synthetic pure-sea source (the day sea's own colour,
47,144,176) through the SAME grade, after verifying each one is
pure ocean against the z2 water mask (scripts/sea-mask-z2.png,
rebuilt deterministically by render-vicewire.py). A tile with any
land in it is skipped and reported, never filled with sea.

Determinism: same input bytes -> same output bytes (fixed
parameters, no RNG). Re-running the script over the pyramid is a
no-op for finished tiles unless --force.

Usage:
  python3 scripts/grade-tiles.py --sample      # a handful of tiles -> build/graded-sample/
  python3 scripts/grade-tiles.py --full        # the whole pyramid
  python3 scripts/grade-tiles.py --fill-ocean  # the 505 missing y=0 ocean rows
  python3 scripts/grade-tiles.py --check       # verify counts + determinism
"""
import argparse
import os
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tiles-source/day")
DST = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/graded")
# Sample output lives under the repo (build/, gitignored), not /tmp:
# /tmp is cleaned out from under long runs on this box, and a sample
# run must survive long enough to be eye-checked.
SAMPLE_OUT = os.path.join(ROOT, "build/graded-sample")
SEA_MASK = os.path.join(ROOT, "scripts/sea-mask-z2.png")
# Elevation grid (GTADB elevation.bin — licence-grey per GTADB's own
# FAQ, Aug 2026: "remodeled from the ground up… mostly correct,
# shouldn't be treated as 100% accurate". Never commit/redistribute).
# Read from the research dir or VICEWIRE_ELEVATION; if absent the
# grade still runs, just without hill-shading (warned once per
# process) — same fallback as render-vicewire.py.
ELEVATION_PATH = os.environ.get(
    "VICEWIRE_ELEVATION",
    os.path.expanduser("~/workspace/vicewire-research/elevation2.bin"),
)
_elev_cache = None
_elev_warned = False

# --- One fixed pipeline. These numbers ARE the filter. Change them only
# --- by re-running the whole pyramid and re-checking the zoom walk. ---
# --- v0.28: retuned STRONG after the user rated v0.20.2 "0 difference".
# --- Sea value 0.72 (was 0.90), sea saturation 1.90 (was 1.45),
# --- contrast 0.30 (was 0.10), grain and stipple REMOVED (they washed
# --- out the building outlines). Measured raw anchors: pure sea
# --- (47,144,176) hue ~195 sat 0.73 val 0.69; street tile 6,114,139
# --- mean (172,180,194) std ~20 — very flat, pale, desaturated. ---
PARAMS = {
    "sea_sat": 1.90,       # sea saturation multiplier (was 1.45)
    "sea_dark": 0.72,      # sea value multiplier, deeper (was 0.90)
    "sea_hue_shift": -10.0,  # degrees toward teal
    "land_sat": 1.45,
    "land_warm_r": 1.08,   # warm the grey land: a little more red...
    "land_warm_b": 0.90,   # ...a little less blue
    "green_sat": 1.60,
    "green_dark": 0.92,
    "sand_sat": 1.50,
    "sand_warm_r": 1.06,
    "road_warm_b": 0.90,   # near-white roads -> warm cream
    "road_warm_r": 1.03,
    "contrast": 0.30,      # S-curve strength on luminance (was 0.10)
    "hillshade": 0.45,     # hill-shade strength, same as v0.27's render
    "jpeg_quality": 90,
}

# Expected counts: full in-bounds range at z0-3 (the fill adds the
# ocean rows the day pyramid never drew), day pyramid's own counts
# at z4-6 (no fill there).
EXPECTED = {0: 12, 1: 48, 2: 192, 3: 768, 4: 1496, 5: 5829, 6: 23182}
SEA_SRC = (47, 144, 176)  # the day sea's own colour (tile 0/0,0,0.jpg)


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def rgb_to_hsv(rgb):
    """Vectorised RGB (0..1) -> HSV (H 0..360, S 0..1, V 0..1)."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    diff = mx - mn
    v = mx
    s = np.where(mx > 0, diff / np.maximum(mx, 1e-6), 0.0)
    h = np.zeros_like(mx)
    mask = diff > 1e-6
    r_is = (mx == r) & mask
    g_is = (mx == g) & mask
    b_is = (mx == b) & mask
    h[r_is] = (60.0 * ((g[r_is] - b[r_is]) / diff[r_is]) + 360.0) % 360.0
    h[g_is] = 60.0 * ((b[g_is] - r[g_is]) / diff[g_is]) + 120.0
    h[b_is] = 60.0 * ((r[b_is] - g[b_is]) / diff[b_is]) + 240.0
    return h, s, v


def hsv_to_rgb(h, s, v):
    """Vectorised HSV -> RGB (0..1)."""
    h = h % 360.0
    c = v * s
    x = c * (1.0 - np.abs((h / 60.0) % 2.0 - 1.0))
    m = v - c
    r = np.zeros_like(h)
    g = np.zeros_like(h)
    b = np.zeros_like(h)
    z0 = np.zeros_like(c)
    seg = (h // 60).astype(int) % 6
    for i, (rr, gg, bb) in enumerate(
        [(c, x, z0), (x, c, z0), (z0, c, x), (z0, x, c), (x, z0, c), (c, z0, x)]
    ):
        sel = seg == i
        r[sel], g[sel], b[sel] = rr[sel], gg[sel], bb[sel]
    return np.stack([r + m, g + m, b + m], axis=-1)


def _elevation_gradients():
    """(dzdx, dzdy) in metres per game unit, on the 1748x1536 heightmap
    grid. Copied from render-vicewire.py's _elevation_gradients (the
    v0.27 render the user praised the hills of). Nodata (raw 0, open
    ocean outside the capture) is set to sea level so coastal
    gradients do not spike. Absolute heights are unverified — only
    gradients are used, for shading."""
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
    _elev_cache = (dzdx, dzdy)
    return _elev_cache


def hillshade(zoom, tile_x, tile_y, size=256):
    """Hill-shade multiplier (size x size) for one tile, bilinear-
    sampled from the elevation grid. Same formula as
    render-vicewire.py's _relief (standard hillshade, light from the
    NW, azimuth 315, altitude 45, vertical exaggeration x4, centred
    so flat ground is 1.0). Returns None when the grid is absent.
    The grid is 12 units per px, so at street zoom many output px
    share one sample: relief is a coarse field, never a per-pixel
    fake — which is why building outlines stay crisp under it."""
    grads = _elevation_gradients()
    if grads is None:
        return None
    dzdx, dzdy = grads
    scale = 2.0 ** (5 - zoom)  # canonical units per 256-tile px
    west = tile_x * 256 * scale - 16384
    north = 16384 - tile_y * 256 * scale
    xs = west + (np.arange(size, dtype=np.float64) + 0.5) * scale
    ys = north - (np.arange(size, dtype=np.float64) + 0.5) * scale
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
    return 1.0 + (shade - 0.707) * PARAMS["hillshade"]


def grade(arr, zoom=None, tile_x=None, tile_y=None, params=PARAMS):
    """arr: uint8 HxWx3 RGB. Returns uint8 HxWx3 RGB, same size.
    Pure per-pixel colour function plus one smooth low-frequency
    luminance term (the hill-shade) — no blur, no grain, no seams,
    no flicker, and the building outlines in the source survive
    exactly where the source drew them. When zoom/tile coords are
    given, the hill-shade is applied; without them (synthetic sea
    fill) it is skipped — the fill is pure sea, factor 1.0 anyway."""
    rgb = arr.astype(np.float64) / 255.0
    h, s, v = rgb_to_hsv(rgb)

    # Soft surface masks — smoothstep edges so a noisy JPEG pixel can
    # never flip a class and speckle. Everything is a blend, never a cut.
    sea = smoothstep(175, 190, h) * (1 - smoothstep(205, 220, h)) \
        * smoothstep(0.20, 0.35, s) * smoothstep(0.25, 0.40, v)
    green = smoothstep(60, 80, h) * (1 - smoothstep(160, 180, h)) \
        * smoothstep(0.12, 0.25, s)
    sand = smoothstep(30, 42, h) * (1 - smoothstep(58, 70, h)) \
        * smoothstep(0.15, 0.30, s)
    road = (1 - smoothstep(0.10, 0.20, s)) * smoothstep(0.70, 0.85, v)
    land = np.clip(1.0 - sea - green - sand - road, 0.0, 1.0)

    # Saturation per surface (sea deepest, land enriched, green rich).
    s_new = s * (
        1.0
        + sea * (params["sea_sat"] - 1.0)
        + green * (params["green_sat"] - 1.0)
        + sand * (params["sand_sat"] - 1.0)
        + land * (params["land_sat"] - 1.0)
    )
    # Sea hue toward teal, sea darker; green slightly darker.
    h_new = h + sea * params["sea_hue_shift"]
    v_new = v * (1.0 + sea * (params["sea_dark"] - 1.0)
                 + green * (params["green_dark"] - 1.0))
    out = hsv_to_rgb(h_new, np.clip(s_new, 0.0, 1.0), np.clip(v_new, 0.0, 1.0))

    # Warm the grey land and the near-white roads (per-channel, smooth).
    out[..., 0] *= 1.0 + land * (params["land_warm_r"] - 1.0) \
        + road * (params["road_warm_r"] - 1.0) \
        + sand * (params["sand_warm_r"] - 1.0)
    out[..., 2] *= 1.0 + land * (params["land_warm_b"] - 1.0) \
        + road * (params["road_warm_b"] - 1.0)

    # Strong S-curve on luminance for depth (continuous, no banding).
    # This is what makes the building shapes read: dark outlines get
    # darker, light roofs get lighter, and the flat pale ground
    # separates from the roads. Applied as a luminance offset on all
    # channels equally, so hues do not shift.
    lum = out.mean(axis=-1, keepdims=True)
    curve = params["contrast"] * np.sin(np.pi * np.clip(lum, 0.0, 1.0))
    out = out + (lum - 0.5) * curve * 2.0

    # Hill-shade (rule 5): a luminance-only multiplier from the
    # elevation gradient, gated off the water by the grade's own soft
    # sea mask — exactly as v0.27 gated it to land. Same factor on
    # all channels, so hues do not shift; smooth and low-frequency,
    # so it can never draw or erase a building edge.
    if zoom is not None and tile_x is not None and tile_y is not None:
        hill = hillshade(zoom, tile_x, tile_y, size=arr.shape[0])
        if hill is not None:
            factor = 1.0 + (hill - 1.0) * (1.0 - sea)
            out = out * factor[..., None]

    return np.clip(np.round(out * 255.0), 0, 255).astype(np.uint8)


def parse_tile(path):
    """'.../5/5,57,69.jpg' -> (zoom, tile_x, tile_y)."""
    name = os.path.basename(path)[:-4]
    zoom = int(os.path.basename(os.path.dirname(path)))
    z, ty, tx = name.split(",")
    assert int(z) == zoom
    return zoom, int(tx), int(ty)


def process_one(args):
    src, dst, force = args
    if not force and os.path.exists(dst):
        return ("skip", src)
    try:
        arr = np.array(Image.open(src).convert("RGB"))
        zoom, tx, ty = parse_tile(src)
        out = grade(arr, zoom, tx, ty)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        Image.fromarray(out).save(
            dst, "JPEG", quality=PARAMS["jpeg_quality"],
            optimize=True, subsampling=0,
        )
        return ("done", src)
    except Exception as exc:  # noqa: BLE001 — report and continue
        return ("error", f"{src}: {exc}")


def list_tiles(base):
    out = []
    for zoom in range(7):
        d = os.path.join(base, str(zoom))
        if not os.path.isdir(d):
            continue
        for name in sorted(os.listdir(d)):
            if name.endswith(".jpg"):
                out.append(os.path.join(d, name))
    return out


def z2_water_mask():
    """The z2 water mask (scripts/sea-mask-z2.png): True where the z2
    grid is water. Rebuilt deterministically by render-vicewire.py;
    here it is read-only input for the fill-ocean check."""
    img = np.array(Image.open(SEA_MASK).convert("L"))
    return img > 127


def fill_ocean():
    """Render the 505 missing y=0 ocean rows at z1-3 through the same
    grade, from the synthetic pure-sea source. Same enumeration and
    pure-ocean check as render-vicewire.py --fill-ocean (v0.25)."""
    water = z2_water_mask()
    sea_src = np.tile(np.array(SEA_SRC, dtype=np.uint8), (256, 256, 1))
    graded_sea = grade(sea_src)
    filled, skipped = 0, []
    for z in (1, 2, 3):
        size = 8192.0 / (2 ** z)  # units per tile
        ntx = int(24576 // size)
        nty = int(32768 // size)
        step = int(size // 8)  # z2 px per tile
        for ty in range(nty):
            for tx in range(ntx):
                dst = os.path.join(DST, str(z), f"{z},{ty},{tx}.jpg")
                if os.path.exists(dst):
                    continue
                src = os.path.join(SRC, str(z), f"{z},{ty},{tx}.jpg")
                if os.path.exists(src):
                    continue  # exists in the source; the main run covers it
                region = water[ty * step:(ty + 1) * step,
                               tx * step:(tx + 1) * step]
                if not region.all():
                    skipped.append((z, ty, tx))
                    continue
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                Image.fromarray(graded_sea).save(
                    dst, "JPEG", quality=PARAMS["jpeg_quality"],
                    optimize=True, subsampling=0,
                )
                filled += 1
    print(f"fill-ocean: {filled} tiles, skipped (not pure ocean): {skipped}")
    return filled


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--fill-ocean", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=2)
    args = ap.parse_args()

    if args.sample:
        picks = [
            "0/0,0,0.jpg",        # open sea
            "0/0,2,1.jpg",        # full island corner
            "3/3,10,12.jpg",      # mid zoom
            "5/5,57,69.jpg",      # waterfront / docks
            "5/5,59,71.jpg",      # city blocks
            "6/6,114,139.jpg",    # street zoom
            "6/6,112,138.jpg",    # street zoom neighbour (seam pair)
        ]
        os.makedirs(SAMPLE_OUT, exist_ok=True)
        for rel in picks:
            src = os.path.join(SRC, rel)
            if not os.path.exists(src):
                print(f"sample tile missing: {rel}")
                continue
            arr = np.array(Image.open(src).convert("RGB"))
            zoom, tx, ty = parse_tile(src)
            out = grade(arr, zoom, tx, ty)
            base_name = rel.replace("/", "_")[:-4]
            Image.fromarray(out).save(
                os.path.join(SAMPLE_OUT, f"{base_name}-graded.jpg"),
                "JPEG", quality=PARAMS["jpeg_quality"], optimize=True, subsampling=0,
            )
            # Side-by-side strip: original | graded, for the eye check.
            strip = Image.new("RGB", (512, 256), (255, 255, 255))
            strip.paste(Image.open(src).convert("RGB"), (0, 0))
            strip.paste(Image.fromarray(out), (256, 0))
            strip.save(os.path.join(SAMPLE_OUT, f"{base_name}-compare.jpg"),
                       "JPEG", quality=92)
            print(f"sample: {rel}")
        print(f"samples in {SAMPLE_OUT}")
        return 0

    if args.check:
        # Determinism: run twice, identical bytes (with hill-shade —
        # the coords go in, so the shading term is covered too).
        for src in list_tiles(SRC)[:5]:
            arr = np.array(Image.open(src).convert("RGB"))
            zoom, tx, ty = parse_tile(src)
            a = grade(arr, zoom, tx, ty)
            b = grade(arr, zoom, tx, ty)
            assert np.array_equal(a, b), f"non-deterministic: {src}"
        # Counts match the expected pyramid (day + fill at z1-3).
        ok = True
        for zoom in range(7):
            sdir = os.path.join(SRC, str(zoom))
            ddir = os.path.join(DST, str(zoom))
            s = len([n for n in os.listdir(sdir) if n.endswith(".jpg")]) \
                if os.path.isdir(sdir) else 0
            d = len([n for n in os.listdir(ddir) if n.endswith(".jpg")]) \
                if os.path.isdir(ddir) else 0
            flag = "OK" if d == EXPECTED[zoom] else "MISMATCH"
            if d != EXPECTED[zoom]:
                ok = False
            print(f"z{zoom}: day={s} graded={d} expected={EXPECTED[zoom]} {flag}")
        print("determinism OK on 5 tiles")
        return 0 if ok else 1

    if args.fill_ocean:
        return 0 if fill_ocean() is not None else 1

    if args.full:
        tiles = list_tiles(SRC)
        jobs = [
            (src, src.replace(SRC, DST, 1), args.force) for src in tiles
        ]
        print(f"grading {len(jobs)} tiles with {args.workers} workers ...")
        start = time.time()
        done = skipped = errors = 0
        with Pool(args.workers) as pool:
            for i, (status, info) in enumerate(
                pool.imap_unordered(process_one, jobs, chunksize=32)
            ):
                if status == "done":
                    done += 1
                elif status == "skip":
                    skipped += 1
                else:
                    errors += 1
                    print(f"ERROR {info}")
                if (i + 1) % 2000 == 0:
                    print(f"  {i + 1}/{len(jobs)} "
                          f"({(i + 1) / (time.time() - start):.0f} tiles/s)")
        print(f"done={done} skipped={skipped} errors={errors} "
              f"in {time.time() - start:.0f}s")
        return 0 if errors == 0 else 1

    ap.print_help()
    return 2


if __name__ == "__main__":
    sys.exit(main())
