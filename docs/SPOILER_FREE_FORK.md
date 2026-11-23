# Spoiler-free fork — what changed vs upstream

Fork of [Leonida Atlas](https://github.com/navanem/gta6-leonida-atlas) (AGPL-3.0;
GTADB data CC BY 4.0). Personal use. No push/deploy has run yet — see below.

## Spoiler-free mode (the point of the fork)

- Every public layer starts **off**: Named regions, Community places, Gyms /
  Strength, Uncertain records. First load shows only the blank Leonida
  basemap — no pins, no labels.
- "My markers" (your own notes) stays on; those can never spoil anything.
- Search and the results list only return places from layers you turned on.
  With everything off, Explore says so and points at Layers.
- Tapping a place (search result or shared `?place=` link) is an explicit
  choice: its layer is turned on so the place can be shown.
- The 3D explorer is untouched and still reachable from the map top bar.

## Custom markers + notes (local only)

- Already in upstream (IndexedDB via Dexie, backup export/import JSON) and
  kept: title, note, category, edit / move / delete.
- Added: **long-press on the map** (right-click on desktop) drops a marker
  right there and opens the editor; **colour choice** (7 colours) per marker.
- Notes are per place, saved on blur / Save, and included in backups.

## Progress tracking

- Every place can be marked **Found** from its details panel; found pins show
  a green ✓ and dim on the map.
- Saved → Progress shows found/total and % per layer. Tapping a layer row
  turns that layer on and switches to **Remaining only** — the 99% case.
- Explore filters add **Hide found** and **Remaining only** checkboxes.
- Collections also show found counts. Found state is stored locally
  (Dexie `visited` table, DB v3) and included in backup export/import.
  Old v1/v2 backups still import; `visited` just starts empty.

## Gyms / Strength layer (was missing)

9 gyms, all in the Vice City area. Verified 23 Nov 2026 against two
independent post-launch guides (PowerPyx gym list; GTA6 GPS gym pages):

- 7 pins have published coordinates (GTA6 GPS per-gym pages; Ajax Gym is
  tagged `#gym` in the bundled GTADB catalogue, record L1869).
- 2 gyms have no verified coordinates in any source checked, so they are
  listed with `position: null` — searchable by name, never placed by guess.
  See `src/data/gyms.ts` for the per-pin source.

No other collectible data was added: this repo's bundled catalogue is
landmarks only, so there are no trading-card pins in this build. The
found/progress system is generic and will attach to any layer added later;
importing card locations is a separate data task, not done here.

## PWA (Android)

- `public/manifest.webmanifest` + 192/512 icons (generated from the existing
  favicon by `scripts/generate-pwa-icons.mjs`, committed as PNGs).
- `index.html` links the manifest and Apple touch icon.
- The generated service worker (`scripts/finalize-build.mjs`) now precaches
  the manifest and icons too, alongside the app shell, basemap and catalogue.
- Install: open the deployed site in Chrome on Android → Add to Home Screen.

## Deploy (prepared, NOT run)

- `.github/workflows/pages.yml` — manual trigger only (`workflow_dispatch`).
  Build uses `ATLAS_BASE_PATH=/gta6-leonida-atlas/`. Nothing deploys on push.
- To publish: push this branch, enable Pages (Settings → Pages → GitHub
  Actions), run the workflow from the Actions tab. Site:
  `https://ciaranf3308-star.github.io/gta6-leonida-atlas/`

## Verify locally

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm build
pnpm start   # http://127.0.0.1:4330
```
