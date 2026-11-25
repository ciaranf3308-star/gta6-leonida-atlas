# Vendored vector data — fbritoferreira/gta6 ("Open GTA 6 Map"), CC BY 4.0
# https://github.com/fbritoferreira/gta6
#
# roads.json (9,075 LineStrings, kinds highway/main/street/minor) and
# rails.json (182 LineStrings) in fbrito map units: game gx = x*32 - 16384,
# gy = 16384 - y*32. Used by scripts/render-vicewire.py for road centrelines.
# VERIFIED against our real GTADB day tiles (scripts/verify-fbrito.py):
# land polygons IoU 0.875 vs our land mask; road centrelines median 3.6 px
# (z5 units) from our skeletonised roads vs 16.1 px for a shifted control.
# So fbrito strokes are used at z0-z3 only (sub-pixel there); at z4-z6
# our own skeleton supplies the geometry and fbrito only the kind.
#
# surface.json (3,496 Polygons, layers building/sand/urban/park/shallow/
# paved) is used for ONE thing: the 'urban' polygons gate the city-grey
# ground colour. Colour alone cannot tell a city from the Keys' pale
# ground (same pale blue-grey, both in the building bucket), but the
# urban polygons can: Vice City is inside them, the Keys island is not.
#
# Credit in the app: "Map data from Open GTA 6 Map (fbritoferreira),
# CC BY 4.0" — see the basemap report for the exact attribution line.
#
# land.json is NOT vendored: the renderer classifies OUR own day tiles
# for surfaces (exact by construction) and only needed land.json for
# the one-off verification.
