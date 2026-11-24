#!/usr/bin/env python3
"""Re-render the GTADB In-Game Day tiles into the After Hours look (v0.18.0).

Reads every tile under tiles-source/day/<z>/ and
writes a recoloured copy to .../tiles/styled/<z>/ with the SAME filename,
tile coordinates, zoom levels and geometry. Nothing moves; no place data
changes; no geography is invented. This is a colour grade of the real
tiles, not new map art.

Classification is per-pixel, from measured real-tile colours (see
scripts/restyle-palette-report.md):
  water  B >= R+45 and B >= G+25 (the app's own rule) -> deep teal ramp
  green  G-B dominance -> rich green (saturation up, value kept, so hill
         shading / terrain texture survives)
  sand   warm tan (R-B>15, G-B>5) -> warm pale sand
  road   near-white / pale-yellow thin lines on land -> Coral #FF527F /
         Sunset #FFB56B (the reference's pink roads)
  urban  everything else on land -> warm grey with a contrast stretch,
         so city blocks read as a city
  unsure pixels are left at their real colour (blend weight 0) — never
  invent detail.

Clouds: z0-z2 ocean tiles only, soft white value-noise blobs at <=16%
alpha over WATER pixels only, seeded per tile so neighbouring tiles do
not repeat. The animated sea canvas already drifts cloud shadows at
runtime; these baked clouds give the full-zoom view the reference's
cloud-fringed sea even before the canvas paints.

Run:
  python3 scripts/restyle-tiles.py --preview   # sample sheets only, /tmp/v018
  python3 scripts/restyle-tiles.py --all       # full pyramid, 31,022 tiles
  python3 scripts/restyle-tiles.py --zooms 0 1 2
"""
import argparse
import glob
import os
import sys
from multiprocessing import Pool

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "tiles-source/day")
DST = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/styled")
QUALITY = 88  # matches the source tiles' visual quality at ~same byte size

# --- After Hours target palette (measured, see restyle-palette-report.md) ---
CORAL = np.array([255.0, 82.0, 127.0])    # #FF527F road glow
SUNSET = np.array([255.0, 181.0, 107.0])  # #FFB56B highway glow
SAND = np.array([236.0, 214.0, 168.0])    # warm pale sand
SEA_DEEP = np.array([5.0, 58.0, 76.0])    # #053A4C deep teal
SEA_SHALLOW = np.array([18.0, 126.0, 148.0])  # #127E94 shore turquoise


def _smoothstep(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _zhang_suen(mask):
    """Vectorised Zhang-Suen thinning. mask: bool array. Returns bool skeleton."""
    p = mask.astype(np.uint8)
    h, w = p.shape
    pad = np.pad(p, 1)
    changing = True
    it = 0
    while changing and it < 120:
        changing = False
        it += 1
        for step in (0, 1):
            P = np.pad(pad[1:-1, 1:-1], 1)  # refresh from padded working copy
            # neighbours of the padded array's interior
            P2 = P[:-2, 1:-1]
            P3 = P[:-2, 2:]
            P4 = P[1:-1, 2:]
            P5 = P[2:, 2:]
            P6 = P[2:, 1:-1]
            P7 = P[2:, :-2]
            P8 = P[1:-1, :-2]
            P9 = P[:-2, :-2]
            C = P[1:-1, 1:-1]
            neighbours = [P2, P3, P4, P5, P6, P7, P8, P9]
            B = sum(neighbours)
            # A: 0->1 transitions in the ordered sequence P2..P9,P2
            seq = neighbours + [P2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(np.uint8) for i in range(8))
            if step == 0:
                m1 = P2 * P4 * P6
                m2 = P4 * P6 * P8
            else:
                m1 = P2 * P4 * P8
                m2 = P2 * P6 * P8
            delete = (C == 1) & (B >= 2) & (B <= 6) & (A == 1) & (m1 == 0) & (m2 == 0)
            if delete.any():
                changing = True
                new = P[1:-1, 1:-1].copy()
                new[delete] = 0
                pad[1:-1, 1:-1] = new
        p = pad[1:-1, 1:-1]
    return p.astype(bool)


def _prune_short_branches(skel, min_len=12):
    """Delete skeleton endpoints iteratively, except endpoints on the tile edge
    (a road crossing the tile border must not be cut back at the seam)."""
    s = skel.copy()
    h, w = s.shape
    for _ in range(min_len):
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
    return s


def _road_centrelines(light):
    """Thin pink centrelines for high-zoom tiles.

    Roads and bright rooftops are nearly identical pixel colours
    (road core ~(209,209,219), bright roof ~(202,205,214)), so no pixel
    rule can separate them. Geometry can: roads are long thin connected
    structures, rooftops are compact blobs, runways/aprons are very wide.
    Steps: drop compact-blob components, thin the rest to a skeleton,
    prune short stubs, keep only skeleton pixels whose local light-region
    half-width (distance transform) is road-like (< 40 px at z5 scale).
    Returns (core, glow) float masks in [0,1].
    """
    if light.sum() < 40:
        return np.zeros_like(light, dtype=np.float32), np.zeros_like(light, dtype=np.float32)
    # Fill small holes (<2000 px, not touching the border): a road band with
    # a darker centre marking thins into a ladder of loops otherwise.
    # City blocks enclosed by ring roads are far bigger and stay holes.
    inv = ~light
    lab_bg, n_bg = ndi.label(inv)
    if n_bg:
        for i in range(1, n_bg + 1):
            ys, xs = np.where(lab_bg == i)
            if len(ys) < 2000 and ys.min() > 0 and ys.max() < light.shape[0] - 1 and xs.min() > 0 and xs.max() < light.shape[1] - 1:
                light[lab_bg == i] = True
    lab, n = ndi.label(light)
    if n:
        keep = light.copy()
        for i in range(1, n + 1):
            ys, xs = np.where(lab == i)
            size = len(ys)
            hh, ww = ys.max() - ys.min() + 1, xs.max() - xs.min() + 1
            fill = size / float(hh * ww)
            # Compact, roughly square blob: rooftop / marking, not road.
            # Long thin components (road stubs, aspect < 0.45) are kept.
            if fill > 0.5 and max(hh, ww) <= 80 and min(hh, ww) / max(hh, ww) > 0.45:
                keep[lab == i] = False
    else:
        keep = light
    dist = ndi.distance_transform_edt(keep)
    skel = _zhang_suen(keep)
    skel = _prune_short_branches(skel, 12)
    skel = skel & (dist <= 40)
    # Drop short leftover skeleton components (loops / stubs < 30 px):
    # a real road is part of the long network, these are rooftop residue.
    lab_s, n_s = ndi.label(skel, structure=np.ones((3, 3), dtype=int))
    if n_s:
        sizes = ndi.sum_labels(np.ones_like(lab_s), lab_s, range(1, n_s + 1))
        for i, size in enumerate(sizes, start=1):
            if size < 30:
                skel[lab_s == i] = False
    core = ndi.binary_dilation(skel, np.ones((3, 3), dtype=bool)).astype(np.float32)
    glow = ndi.binary_dilation(skel, np.ones((7, 7), dtype=bool)).astype(np.float32)
    return core, glow


def grade(arr, zoom, tile_y, tile_x):
    """arr: uint8 HxWx3 RGB. Returns uint8 HxWx3 recoloured. Pure function."""
    f = arr.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    out = f.copy()

    # --- water: deep teal ramp, preserving the tile's own light variation.
    # Blur the mask: JPEG block edges at the shore flicker across the
    # threshold, which read as dark blocks in v1. ---
    # B-G window is (5, 20), not (15, 35): the source tiles are stitched
    # from halves with a +/-3-unit step in B-G (e.g. 27 vs 30 mid-tile),
    # invisible in the pale original but amplified into a hard seam when
    # the mask sat on the steep part of the curve. The B-R gate (35, 55)
    # is what keeps buildings out of the water mask, so the wide B-G
    # window is safe.
    water = _smoothstep(b - r, 35.0, 55.0) * _smoothstep(b - g, 5.0, 20.0)
    water = ndi.gaussian_filter(water, 2.0)
    lum = (0.30 * r + 0.50 * g + 0.20 * b) / 255.0
    t = np.clip((lum - 0.42) / 0.28, 0.0, 1.0)
    sea = SEA_DEEP[None, None, :] * (1.0 - t[..., None]) + SEA_SHALLOW[None, None, :] * t[..., None]
    out = out * (1.0 - water[..., None]) + sea * water[..., None]

    land = 1.0 - water

    # --- green: rich green, needs green OVER red (sand is R>G>B, so a
    # G-B-only rule painted the beach lime in v1). ---
    green_s = _smoothstep(g - r, 3.0, 20.0) * _smoothstep(g - b, 8.0, 30.0) * land
    green_s = ndi.gaussian_filter(green_s, 1.0)
    green_rgb = np.stack([r * 0.68, np.minimum(g * 1.00, 255.0), b * 0.74], axis=-1) * 0.97
    out = out * (1.0 - green_s[..., None]) + green_rgb * green_s[..., None]

    # --- sand: warm pale sand ---
    sand = (
        _smoothstep(r - b, 15.0, 30.0)
        * _smoothstep(g - b, 5.0, 15.0)
        * _smoothstep(r, 140.0, 170.0)
        * land
        * (1.0 - green_s)
    )
    sand = ndi.gaussian_filter(sand, 1.0)
    sand_rgb = SAND[None, None, :] * (0.82 + 0.18 * (lum[..., None]))
    out = out * (1.0 - (sand * 0.85)[..., None]) + sand_rgb * (sand * 0.85)[..., None]

    # --- urban ground: warm grey + contrast stretch ---
    urban = land * (1.0 - green_s) * (1.0 - sand)
    stretched = np.clip((f - 140.0) * 1.30 + 138.0, 0.0, 255.0)
    warm = np.stack(
        [stretched[..., 0] * 1.06, stretched[..., 1] * 0.99, stretched[..., 2] * 0.84],
        axis=-1,
    )
    out = out * (1.0 - (urban * 0.85)[..., None]) + warm * (urban * 0.85)[..., None]

    # --- roads ---
    mn = np.minimum(np.minimum(r, g), b)
    mx = np.maximum(np.maximum(r, g), b)
    if zoom <= 3:
        # Low zoom: roads and rooftops are sub-pixel; light-neutral pixels
        # are overwhelmingly road. Soft rose tint, not hot pink.
        road = (
            _smoothstep(mn, 205.0, 218.0)
            * _smoothstep(20.0 - (mx - mn), 0.0, 10.0)
            * _smoothstep(14.0 - (b - r), 0.0, 6.0)
            * land
        )
        out = out * (1.0 - (road * 0.40)[..., None]) + CORAL[None, None, :] * (road * 0.40)[..., None]
    else:
        light = (mn > 192) & ((mx - mn) < 22) & ((b - r) < 16) & (land > 0.5)
        core, glow = _road_centrelines(light)
        out = out * (1.0 - (glow * 0.22)[..., None]) + CORAL[None, None, :] * (glow * 0.22)[..., None]
        out = out * (1.0 - (core * 0.95)[..., None]) + CORAL[None, None, :] * (core * 0.95)[..., None]

    # --- highways: pale yellow is unambiguous once sand is excluded
    # (sand G <= ~195, highway G > 195 and R > 205). Sunset, not coral. ---
    highway = (
        (r > 205) & (g > 195) & ((r - b) > 25) & ((r - b) < 60) & ((mx - mn) > 20) & (land > 0.5)
    ).astype(np.float32)
    if highway.any():
        highway = ndi.gaussian_filter(highway, 0.8)
        out = out * (1.0 - (highway * 0.8)[..., None]) + SUNSET[None, None, :] * (highway * 0.8)[..., None]

    # --- clouds: z0-z1 only, a few large soft puffs over water. The field
    # is a function of GLOBAL pixel coordinates (mapped back to z0 scale),
    # so it is seamless across tile borders by construction — per-tile
    # random fields (v1-v4) always read as stains or repeat at the seams.
    # Faint: the reference has clouds at the sea edges, not a rash. ---
    if zoom <= 1:
        scale = 2.0**zoom
        gx = (tile_x * 256.0 + np.arange(256, dtype=np.float32)[None, :]) / scale
        gy = (tile_y * 256.0 + np.arange(256, dtype=np.float32)[:, None]) / scale
        field = (
            np.sin(gx * 0.011 + 1.7) * np.sin(gy * 0.009 + 0.4)
            + 0.6 * np.sin((gx + gy) * 0.006 + 4.2)
            + 0.4 * np.sin((gx - gy) * 0.013 + 2.3)
        )
        cloud = _smoothstep(field, 0.55, 1.05) * 0.06 * water
        out = out * (1.0 - cloud[..., None]) + 255.0 * cloud[..., None]

    return np.clip(out, 0, 255).astype(np.uint8)


def _render_one(args):
    src, dst, zoom, ty, tx = args
    try:
        arr = np.asarray(Image.open(src).convert("RGB"))
        out = grade(arr, zoom, ty, tx)
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
    os.makedirs("/tmp/v018", exist_ok=True)
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
        styled = grade(arr, z, int(parts[1]), int(parts[2]))
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
    sheet.save("/tmp/v018/preview-v5.png")
    print("saved /tmp/v018/preview-v5.png")

    # Full-island z0 composite, before vs after (the whole-Leonida view).
    for label, srcdir in (("orig", SRC), ("styled", None)):
        comp = Image.new("RGB", (768, 1024))
        for ty in range(4):
            for tx in range(3):
                p = os.path.join(SRC, "0", f"0,{ty},{tx}.jpg")
                tile = Image.open(p).convert("RGB")
                if label == "styled":
                    tile = Image.fromarray(grade(np.asarray(tile), 0, ty, tx))
                comp.paste(tile, (tx * 256, ty * 256))
        comp.save(f"/tmp/v018/z0-{label}.png")
    print("saved /tmp/v018/z0-orig.png /tmp/v018/z0-styled.png")


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
                print(f"{i+1}/{len(jobs)}  {total/1e6:.1f} MB")
    print(f"done: {len(jobs)-len(errors)} ok, {len(errors)} errors, {total/1e6:.1f} MB total")
    for src, err in errors[:20]:
        print("ERR", src, err)


if __name__ == "__main__":
    main()
