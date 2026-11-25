#!/usr/bin/env python3
"""AI-illustrated island view — one image, sliced into tiles for z0-z3.

Pipeline (decided by the user 2026-11-25 00:34, after the v0.20.2 colour
grade measured as "0 difference" against the reference):
  1. GENERATE (outside this script, sandbox image generation): one
     illustrated island in the style of the reference renders
     (workspace/user/files/1000017560_12_lqxm.png), using the real
     GTADB day-tile overview as the reference image, so the illustration
     is a stylisation of the real map. The generation kept is v2
     (scripts/illustrated-island-generated-v2.png) — v1, then one
     resume/refine pass asking for the lake and the east-coast islands
     to match the real map.
  2. TRACE-CORRECT (this script): the generator invents geography in
     the open sea — extra islets around the Leonida Keys, redrawn bay
     islands off Vice City — and paints shallow water green, which
     blurs the coastline. This step removes ONLY invented sea features:
     where the real map is sea (beyond a small shallows band around
     real land, and outside real inland water such as Lake Leonida),
     the illustration is replaced by its own sea — the illustration's
     sea colour field, inpainted from sea pixels only, so no land
     colour can smear into the water. Real land, the lake, the roads
     and the cities keep the illustration exactly as generated. Clouds
     over the sea are kept (they are in the reference look). Nothing
     is moved: the coastline in the output is the real coastline.
  3. SLICE: the corrected illustration (1344x1728) is upscaled to the
     z3 composite size (4352x5632) and sliced deterministically into
     tiles for z0-z3 (12+30+99+374 = 515). z2/z1/z0 are downsamples of
     the same image, so no seams between tiles or zooms. z4-z6 stay
     the real enhanced GTADB tiles (tiles/enhanced/) — see
     src/features/map/gtadb-tiles.ts for the zoom switch.

HONEST LIMITS, read before claiming anything about this:
- The generation is 1344x1728, so a z3 tile carries ~79px of
  generated detail upscaled to 256px. The illustration is painterly
  by design, so the upscale reads as smooth, not as the v0.19 blur —
  but it is NOT sharp linework, and the sharp real map takes over at
  z4. Do not call the island view sharp.
- Inside the real land footprint the illustration's internal detail
  (exact road paths, bay-island shapes off Vice City) is still the
  generator's drawing, bounded to the right land. A pin on a real
  place lands on illustrated land in the right spot; at z4 the real
  map shows the exact position.
- The z3 -> z4 switch pops: illustrated to real. Same palette
  family, same coastline, so it reads as the same place getting
  real — but it is a visible change, not a seamless morph.

Dependencies: numpy + Pillow only (same as scripts/enhance-tiles.py).
Deterministic: same inputs -> same tiles. Run:
  python3 scripts/illustrate-island.py \
    --illustration scripts/illustrated-island-generated-v2.png
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DAY_DIR = os.path.join(REPO, "tiles-source", "day")
# z3 grid in the real pyramid: x 4..20, y 4..25 (17 x 22 = 374 tiles).
Z3_X0, Z3_X1, Z3_Y0, Z3_Y1 = 4, 20, 4, 25
TILE = 256


def real_land_mask(rgb: np.ndarray) -> np.ndarray:
    """Sea in the real day tiles is blue-dominant; everything else land."""
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    sea = (b >= g) & (b >= r) & ((b - r) > 40) & (r < 150)
    return ~sea


def ocean_mask(sea: np.ndarray) -> np.ndarray:
    """Sea connected to the image border, by iterative numpy flood fill."""
    ocean = np.zeros_like(sea)
    ocean[0, :] = sea[0, :]
    ocean[-1, :] = sea[-1, :]
    ocean[:, 0] = sea[:, 0]
    ocean[:, -1] = sea[:, -1]
    for _ in range(4000):
        grown = ocean.copy()
        grown[1:, :] |= ocean[:-1, :]
        grown[:-1, :] |= ocean[1:, :]
        grown[:, 1:] |= ocean[:, :-1]
        grown[:, :-1] |= ocean[:, 1:]
        grown &= sea
        if (grown == ocean).all():
            return ocean
        ocean = grown
    raise RuntimeError("ocean flood fill did not converge")


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    """Binary dilation via Pillow (MaxFilter), radius in pixels."""
    if radius <= 0:
        return mask
    img = Image.fromarray((mask * 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.MaxFilter(radius * 2 + 1))) > 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--illustration", required=True,
                    help="generated illustration PNG (1344x1728)")
    ap.add_argument("--source-out", default=os.path.join(
        REPO, "scripts", "illustrated-island-source.png"),
        help="where to write the trace-corrected illustration")
    ap.add_argument("--tiles-out", default=os.path.join(
        REPO, "public", "assets", "gta6-leonida-atlas", "tiles", "illustrated"),
        help="where to write the z0-z3 tiles")
    args = ap.parse_args()

    ill = Image.open(args.illustration).convert("RGB")
    W, H = ill.size
    print(f"illustration: {W}x{H}")

    # 1. Real z3 overview at the illustration's size.
    canvas = Image.new("RGB", ((Z3_X1 - Z3_X0 + 1) * TILE,
                                (Z3_Y1 - Z3_Y0 + 1) * TILE), (0, 119, 143))
    for y in range(Z3_Y0, Z3_Y1 + 1):
        for x in range(Z3_X0, Z3_X1 + 1):
            path = os.path.join(DAY_DIR, "3", f"3,{y},{x}.jpg")
            canvas.paste(Image.open(path),
                         ((x - Z3_X0) * TILE, (y - Z3_Y0) * TILE))
    real_small = np.asarray(
        canvas.resize((W, H), Image.LANCZOS)).astype(int)
    print(f"real overview: {canvas.size} -> {W}x{H}")

    # 2. Trace-correct: keep real land (+shallows band) and real inland
    #    water (Lake Leonida); everywhere else, the illustration's own
    #    sea. Clouds over the sea are kept.
    land = real_land_mask(real_small)
    sea = ~land
    ocean = ocean_mask(sea)
    inland_water = sea & ~ocean
    print(f"inland water pixels: {int(inland_water.sum())} "
          f"(Lake Leonida and ponds)")
    keep = dilate(land, 12) | dilate(inland_water, 6)
    I = np.asarray(ill).astype(float)
    ir, ig, ib = I[:, :, 0], I[:, :, 1], I[:, :, 2]
    cloud = np.minimum(np.minimum(ir, ig), ib) > 205
    keep = keep | cloud
    sea_ill = ((ib >= ig) & (ib >= ir) & ((ib - ir) > 40)
               & (ir < 150) & ~cloud)
    med_sea = np.median(I[sea_ill], axis=0)
    print(f"illustration median sea colour: {med_sea.round(1)}")
    sea_only = I.copy()
    sea_only[~sea_ill] = med_sea
    sea_field = np.asarray(
        Image.fromarray(sea_only.astype(np.uint8))
        .filter(ImageFilter.GaussianBlur(64))).astype(float)
    mask_f = np.asarray(
        Image.fromarray((keep * 255).astype(np.uint8))
        .filter(ImageFilter.GaussianBlur(4))).astype(float) / 255.0
    final = (I * mask_f[..., None]
             + sea_field * (1 - mask_f[..., None])).astype(np.uint8)
    Image.fromarray(final).save(args.source_out)
    print(f"trace-corrected illustration: {args.source_out}")

    # 3. Alignment self-check (classifier 1, main land component).
    final_land = real_land_mask(final.astype(int))
    inter = (land & final_land).sum()
    union = (land | final_land).sum()
    print(f"land-mask IoU vs real (clouds/shallows inflate this): "
          f"{inter / union:.3f} — see the report for the crop evidence, "
          f"the number alone is not the verdict")

    # 4. Upscale to the z3 composite and slice z0-z3 from the one image.
    big = Image.fromarray(final).resize(canvas.size, Image.LANCZOS)
    print(f"upscaled to z3 composite: {big.size} "
          f"(one generated pixel -> {canvas.size[0] / W:.2f} output px)")
    total = 0
    for zoom in (3, 2, 1, 0):
        step = 2 ** (3 - zoom)  # z3 tiles per tile at this zoom
        x0 = Z3_X0 // step
        x1 = Z3_X1 // step
        y0 = Z3_Y0 // step
        y1 = Z3_Y1 // step
        outdir = os.path.join(args.tiles_out, str(zoom))
        os.makedirs(outdir, exist_ok=True)
        for ty in range(y0, y1 + 1):
            for tx in range(x0, x1 + 1):
                px = (tx * step - Z3_X0) * TILE
                py = (ty * step - Z3_Y0) * TILE
                size = step * TILE
                tile = big.crop((px, py, px + size, py + size))
                if size != TILE:
                    tile = tile.resize((TILE, TILE), Image.LANCZOS)
                tile.save(os.path.join(outdir, f"{zoom},{ty},{tx}.jpg"),
                          quality=88)
                total += 1
        print(f"z{zoom}: {(y1 - y0 + 1) * (x1 - x0 + 1)} tiles")
    print(f"total illustrated tiles: {total} (expect 515)")
    if total != 515:
        print("ERROR: expected 515 tiles", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
