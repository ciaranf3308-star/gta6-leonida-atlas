#!/usr/bin/env python3
"""Build the GLOBAL shore-distance map for the v0.19.0 redraw.

The redraw's sea depth bands were first computed per tile (distance
transform inside one 256px tile). That seams: a tile whose water is
far from land *inside that tile* paints abyss right up to the border
of a neighbour whose bands reach the same border — a hard rectangle
in the sea, visible in the 390px walk at low zoom.

Fix: one global distance field, computed once from the z2 day tiles
(3072x4096 px, 1 px = 8 canonical units), sampled by every tile.
Distance is in z2 px, clipped to 40 (320 units — beyond that the sea
is abyss everywhere). Land pixels are 0. Saved as an 8-bit PNG next
to the script's output; scripts/redraw-tiles.py loads it lazily.

Run: python3 scripts/build-shore-distance.py
"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/tiles/day/2")
OUT = os.path.join(ROOT, "public/assets/gta6-leonida-atlas/shore-distance.png")

W, H = 3072, 4096  # z2 grid: 12 tiles wide x 16 tall, 256px each
# Missing slots are open ocean by construction (the app's errorTileUrl
# is ocean.jpg), so the field starts as water and only existing tiles
# can clear it to land.
water = np.ones((H, W), dtype=bool)
for ty in range(16):
    for tx in range(12):
        p = os.path.join(SRC, f"2,{ty},{tx}.jpg")
        if not os.path.exists(p):
            continue  # missing slot: open ocean by construction
        a = np.asarray(Image.open(p).convert("RGB")).astype(np.float32)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        w = ((b - r) > 35) & ((b - g) > 5)
        water[ty * 256:(ty + 1) * 256, tx * 256:(tx + 1) * 256] = w
    print(f"row {ty}/15", flush=True)
print("water share:", round(float(water.mean()), 3))
dist = ndi.distance_transform_edt(water)
np.clip(dist, 0, 40, out=dist)
Image.fromarray(dist.astype(np.uint8), mode="L").save(OUT)
print("saved", OUT, os.path.getsize(OUT), "bytes")
