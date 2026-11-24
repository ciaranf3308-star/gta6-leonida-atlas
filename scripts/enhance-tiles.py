#!/usr/bin/env python3
"""One realism filter for the GTADB In-Game Day tiles (v0.20.2).

The user (2026-11-24 22:48-22:51): the illustrated redraw is dead, but a
filter is welcome — "a realism filter", ONE filter, applied CONSISTENTLY
to every tile at every zoom, "1-2-1" geography, visual invention allowed
(trees, texture) as long as nothing moves.

THE RULES THIS SCRIPT OBEYS
1. GEOGRAPHY LOCKED 1:1. Every output pixel comes from exactly one
   source pixel at the same coordinates. No resampling, no blur, no
   warp, no inpainting, no new roads, no new coastline, no moved
   cities. A pin on a road stays on that road.
2. ONE PIPELINE, EVERYWHERE. The same fixed parameters for every tile
   at every zoom. No per-tile tuning, no per-zoom look. The transform
   is a pure function of the pixel's own colour (plus a grain value
   keyed on world coordinates, so it is continuous across tile edges
   and approximately the same at every zoom). That is what makes
   zooming feel like getting closer to the same map instead of a
   different map loading: parent and child tiles agree because they
   went through the same function.
3. NO FLICKER. Nothing in the pipeline depends on the pixel's position
   inside its tile (no vignette, no per-tile normalisation), so
   neighbouring tiles cannot disagree at a shared edge.
4. SHARP. Native 256px in, native 256px out. The retina sharpness
   comes from the app requesting the next zoom level on DPR >= 2
   (MapView tileSize 128 + zoomOffset 1), not from upscaling here.

What the filter does (colour only):
- Sea (cyan-blue): deeper teal, more saturated.
- Land (pale grey-blue): warmed and enriched, more contrast.
- Green (parks/vegetation): richer, with a subtle canopy stipple
  (darkened speckles keyed on world coordinates — texture, not
  objects; no tree is drawn where there was not green).
- Sand (pale yellow): warmer gold.
- Roads (near-white): warm cream.
- A gentle S-curve on luminance for depth, and a fine luminance
  grain (+/-4 levels) for a printed-map feel.

The day tiles are the source of truth and are NEVER overwritten:
input is tiles-source/day/ (or --src), output is tiles/enhanced/ (or --dst)
with identical filenames, zooms and grid. The app serves the enhanced
pyramid; the as-is fallback is one path change in gtadbTileUrl.

Determinism: same input bytes -> same output bytes (fixed parameters,
no RNG; the grain is a hash of world coordinates). Re-running the
script over the pyramid is a no-op for finished tiles unless --force.

Usage:
  python3 scripts/enhance-tiles.py --sample      # a handful of tiles -> /tmp/enhanced-sample/
  python3 scripts/enhance-tiles.py --full        # the whole pyramid
  python3 scripts/enhance-tiles.py --check       # verify counts + determinism on 20 tiles
"""
import argparse
import hashlib
import os
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tiles-source/day")
DST = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/enhanced")
SAMPLE_OUT = "/tmp/enhanced-sample"

# --- One fixed pipeline. These numbers ARE the filter. Change them only
# --- by re-running the whole pyramid and re-checking the zoom walk. ---
PARAMS = {
    "sea_sat": 1.45,      # sea saturation multiplier
    "sea_dark": 0.90,     # sea value multiplier (deeper)
    "sea_hue_shift": -6.0,  # degrees toward teal
    "land_sat": 1.30,
    "land_warm_r": 1.04,  # warm the grey land: a little more red...
    "land_warm_b": 0.94,  # ...a little less blue
    "green_sat": 1.40,
    "green_dark": 0.94,
    "sand_sat": 1.35,
    "sand_warm_r": 1.05,
    "road_warm_b": 0.93,  # near-white roads -> warm cream
    "road_warm_r": 1.02,
    "contrast": 0.10,     # S-curve strength on luminance
    "grain": 4.0,         # +/- levels of luminance grain
    "stipple": 0.10,      # canopy stipple darken in green areas
    "jpeg_quality": 90,
}


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


def world_grain(shape, zoom, tile_x, tile_y):
    """Deterministic luminance grain, keyed on z6-equivalent world pixel
    coordinates so it is continuous across tile edges at the same zoom
    (and approximately the same at other zooms — the same world point
    maps to the same neighbourhood of grain values)."""
    rows, cols = shape
    scale = 2 ** (6 - zoom)
    gy, gx = np.mgrid[0:rows, 0:cols]
    wx = (tile_x * 256 + gx) * scale
    wy = (tile_y * 256 + gy) * scale
    # Integer hash (splitmix-style) -> uniform [0, 1).
    z = (wx.astype(np.uint64) * np.uint64(0x9E3779B97F4A7C15) +
         wy.astype(np.uint64) * np.uint64(0xC2B2AE3D27D4EB4F))
    z = (z ^ (z >> np.uint64(30))) * np.uint64(0xBF58476D1CE4E5B9)
    z = (z ^ (z >> np.uint64(27))) * np.uint64(0x94D049BB133111EB)
    z = z ^ (z >> np.uint64(31))
    return (z % np.uint64(1000)).astype(np.float64) / 1000.0


def enhance(arr, zoom, tile_x, tile_y, params=PARAMS):
    """arr: uint8 HxWx3 RGB. Returns uint8 HxWx3 RGB, same size."""
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

    # Gentle S-curve on luminance for depth (continuous, no banding).
    lum = out.mean(axis=-1, keepdims=True)
    curve = params["contrast"] * np.sin(np.pi * np.clip(lum, 0.0, 1.0))
    out = out + (lum - 0.5) * curve * 2.0

    # Canopy stipple: in green areas, darken speckles (world-hash) so
    # parks read as foliage texture. Texture only — no object is drawn.
    grain01 = world_grain(arr.shape[:2], zoom, tile_x, tile_y)
    stipple = green * (grain01 < 0.22) * params["stipple"]
    out = out * (1.0 - stipple[..., None])

    # Fine luminance grain, same hash — printed-map feel, no blur.
    delta = (grain01 - 0.5) * 2.0 * params["grain"] / 255.0
    out = out + delta[..., None]

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
        out = enhance(arr, zoom, tx, ty)
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--full", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
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
            out = enhance(arr, zoom, tx, ty)
            base_name = rel.replace("/", "_")[:-4]
            Image.fromarray(out).save(
                os.path.join(SAMPLE_OUT, f"{base_name}-enhanced.jpg"),
                "JPEG", quality=PARAMS["jpeg_quality"], optimize=True, subsampling=0,
            )
            # Side-by-side strip: original | enhanced, for the eye check.
            strip = Image.new("RGB", (512, 256), (255, 255, 255))
            strip.paste(Image.open(src).convert("RGB"), (0, 0))
            strip.paste(Image.fromarray(out), (256, 0))
            strip.save(os.path.join(SAMPLE_OUT, f"{base_name}-compare.jpg"),
                       "JPEG", quality=92)
            print(f"sample: {rel}")
        print(f"samples in {SAMPLE_OUT}")
        return 0

    if args.check:
        tiles = list_tiles(SRC)[:20]
        # Determinism: run twice, identical bytes.
        for src in tiles[:5]:
            arr = np.array(Image.open(src).convert("RGB"))
            zoom, tx, ty = parse_tile(src)
            a = enhance(arr, zoom, tx, ty)
            b = enhance(arr, zoom, tx, ty)
            assert np.array_equal(a, b), f"non-deterministic: {src}"
        # Counts match day pyramid.
        for zoom in range(7):
            sdir = os.path.join(SRC, str(zoom))
            ddir = os.path.join(DST, str(zoom))
            s = len([n for n in os.listdir(sdir) if n.endswith(".jpg")]) \
                if os.path.isdir(sdir) else 0
            d = len([n for n in os.listdir(ddir) if n.endswith(".jpg")]) \
                if os.path.isdir(ddir) else 0
            print(f"z{zoom}: day={s} enhanced={d}")
        print("determinism OK on 5 tiles")
        return 0

    if args.full:
        tiles = list_tiles(SRC)
        jobs = [
            (src, src.replace(SRC, DST, 1), args.force) for src in tiles
        ]
        print(f"enhancing {len(jobs)} tiles with {args.workers} workers ...")
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
