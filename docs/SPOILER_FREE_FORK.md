# Spoiler-free fork — what changed vs upstream

Fork of [Leonida Atlas](https://github.com/navanem/gta6-leonida-atlas) (AGPL-3.0;
GTADB data CC BY 4.0). Personal use. Live at
`https://ciaranf3308-star.github.io/gta6-leonida-atlas/` (branch
`spoiler-free-pwa`, deployed via `gh-pages`; upstream `main` untouched).

## Spoiler-free mode (the point of the fork)

- Every public layer starts **off**: Named regions, Community places,
  Interiors / Enterable, Shops & services, Lootable buildings, Gyms /
  Strength, Free outdoor equipment, Uncertain records, and one layer per
  trading-card set (18). First load shows only the blank Leonida basemap —
  no pins, no labels.
- First launch shows a welcome sheet saying the map starts blank on purpose,
  with the real counts per layer (3,775 places mapped: interiors 81, shops
  39, lootable 52, gyms 8 + 2 free outdoor, community 680, uncertain 2,902,
  regions 6, cards 5 verified pins of 480) and one-tap quick starts — "Show
  gyms", "Show lootable", "Show interiors", "Show shops" — that turn on just
  that layer. Reopen it any time from the ? button on the map. The Layers
  button in the top bar opens the layer toggles, which now show their counts.
- The welcome sheet also onboards the Ask Nylah OpenAI key in place (same
  inline key field in the Ask panel when no key is set): the key stays only
  on the device, in localStorage, sent only to api.openai.com when asking.
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

## v2 — GTADB In-Game Day basemap (replaces the pixelated Yanis basemap)

- The 2D map now uses GTADB's In-Game Day tiles (`maps/tiles/6/day` at GTADB
  revision `d406fea`), the real in-game pause-menu map, bundled as
  `public/assets/gta6-leonida-atlas/tiles/day/{z}/{z},{y},{x}.jpg`
  (31,022 tiles, zooms 0–6). Leaflet zoom −5…1 maps 1:1 onto tile zooms 0–6,
  so max zoom is native detail, not an upscale. Tile registration was
  verified against the old Yanis grid: Ajax Gym (1420, 1766) sits on day
  tile z5 (57, 69), which shows the same SW 4th St waterfront, and z6 tile
  (114, 139) exists. Missing tiles (open sea the source never drew) fall
  back to a solid ocean tile. Map artwork © Rockstar Games; GTADB CC BY 4.0.
- The service worker runtime-caches visited tiles (bounded, 1,500 entries);
  tiles are NOT precached, so first install stays small.
- The official Rockstar poster was downloaded (5775×7900) but is NOT shipped
  as a basemap — the in-game tiles supersede it.
- GTADB landmark snapshot refreshed to revision `d406fea`
  (`public/assets/street-leonida/maps/gtadb-landmarks-d406fea.json`):
  3,754 records, 3,663 positioned, 91 unpositioned.

## v2 — Counties

- Picker in Layers: Lummox (north), Kelly (west), Leonard (centre-east),
  Vice-Dale (south-east, Vice City), Mariana (south, Leonida Keys). Tapping
  one zooms the map to it and filters the list to places in it; All Leonida
  clears it.
- Extents are **estimates**: each rect is the bounding box of the GTADB
  records whose in-game address names that county (355 records). The poster
  prints county names but no boundary lines, and GTADB boundary lines remain
  disabled while reviewed — the UI says so. A place is assigned to the
  county its address names, otherwise to the rect it falls in (nearest rect
  centre breaks overlaps).

## v2 — Interiors, shops, lootable buildings

All derived from GTADB tags at revision `d406fea`; uncertain records
(unknown name / unconfirmed / demolished / may-not-exist) stay in Uncertain
records whatever their tags say, so the counts below are the certain subset:

- **Interiors / Enterable** — 81 certain enterable buildings (80 positioned).
  GTADB tags 385 records `enterable` in total (384 positioned); the other
  304 are uncertain and stay in Uncertain records.
- **Shops & services** — 39 certain shops (36 positioned), by type
  (`#gas`, `#supermarket`, `#clothes`, `#hair`, `#guns`, `#food`, `#vendor`,
  `#electronics`, `#shoes`, `#tattoos`, `#fastfood`, `#bar`, `#stripclub`,
  `#nightclub`, `#modshop`, `#pay'n'spray`, `#drinks`, `#carwash`,
  `#bikeshop`, `#liquor`, `#pharmacy`, plus `retail` / `restaurant`).
  Search by tag, e.g. `#gas`.
- **Lootable buildings** — 52 enterable shops of types the released game
  lets you hold up (small stores, gas station shops, food/drink spots), per
  The Games Wiki's Enterable Buildings page and Rockstar previews. Per-store
  safes, alarms and CCTV vary — this is not a per-store confirmed robbery
  list. Ammu-Nation (`#guns`) is excluded: it cannot be robbed.
- No pawn-shop / bank / jewellery / liquor-store tags exist in GTADB, so no
  separate pawn/bank layer was built — those shops appear in Shops /
  Lootable only where their GTADB tags put them.

## Gyms / Strength layer (was missing)

9 gyms, all in the Vice City area. Verified 23 Nov 2026 against two
independent post-launch guides (PowerPyx gym list; GTA6 GPS gym pages):

- 8 member gyms in **Gyms / Strength**; 6 have published coordinates
  (GTA6 GPS per-gym pages; Ajax Gym is tagged `#gym` in the bundled GTADB
  catalogue, record L1869). 2 gyms (Venus Fitness, Vice Seven Condominiums)
  have no verified coordinates, so they are listed with `position: null` —
  searchable by name, never placed by guess.
- **Free outdoor equipment** (new layer): Muscle Sands, the free outdoor gym
  from the 9, plus the home gym on Jason's house deck, Key Lento (Chapter 1
  only — squat rack, pull-up bar, bench, deadlift bar, kettlebells, punching
  bag underneath; position is GTADB's Jason's House record L266). No other
  free outdoor equipment spots have a verified position in any source
  checked — outdoor gear is unmarked in game, so the rest is for your own
  markers when you find it.
- See `src/data/gyms.ts` for the per-pin source.

## Collectible cards — all 18 sets, off by default

- 18 sets, 480 cards in total (PowerPyx's launch-day list, via GTA6Info).
  One toggle layer per set, all off; per-set progress in Saved → Progress.
- Only **5 cards have a verified position** and are pinned, each on its host
  building's verified GTADB position with the exact spot described in the
  pin: Vicki and Victor Maravilla (Starlet Motel, GTADB L304), Reggie Pierce
  and Lexi Campbell (Gellhorn Drive-In Theatre, GTADB L3658), Kyle Lewicky
  (Dynamix Fitness, GTA6 GPS pin). The other 475 cards have no verified
  position in any source checked — only ~148 of 480 have any published
  location lead at all, most in words, not coordinates — and are NOT placed
  by guess. See `src/data/collectables.ts`.

## Ask Nylah (AI helper, BYOK)

- Floating "Ask Nylah" button on the map opens a bottom-sheet panel. Ask in
  plain words — "I'm up north beside Mount Kalaga, need to hit some gains"
  or "highlight the houses I can hit in Capri tonight" — and matching places
  are highlighted on the map (gold ring) with a tap-through result list and
  a Clear highlights control. The map pans to the answer's places, so a
  highlight is never off-screen.
- Spoiler rule, enforced in `src/features/ask/retrieval.ts` (not just in a
  prompt): asking for a thing IS consent to show that layer, even if it is
  off — gyms off + a gym question = the gyms are shown, for that answer
  only, without turning the layer on. But the AI is only ever sent records
  from layers the question asked for, layers already visible, and My
  markers — so it CANNOT volunteer extras from other layers (a burglary
  answer never adds cards/watches in those houses). Tested in
  `tests/unit/ask-nylah.test.ts`, including a card pinned at the same
  building as a lootable place.
- Retrieval is local and pure: keyword → layer, area/county/direction/anchor
  scope, nearest-first fallback flagged as an area mismatch, hideFound /
  remainingOnly respected, max 30 records.
- BYOK OpenAI: the key is entered in Settings (password field, masked),
  stored ONLY in localStorage (`leonida-ask-api-key`, `leonida-ask-model`),
  never in IndexedDB backups, never logged, never committed, and sent only
  to `api.openai.com/v1/chat/completions` when the user asks. Default model
  `gpt-4o-mini`. Without a key, Ask still lists matching places from the
  map; it just cannot write an AI answer. Offline disables sending. API
  errors are shown verbatim — no fake answers. The AI only cites places it
  was sent (`parsePlaceMentions` matches titles only against sent records).

## PWA (Android)

- `public/manifest.webmanifest` + 192/512 icons (generated from the existing
  favicon by `scripts/generate-pwa-icons.mjs`, committed as PNGs).
- `index.html` links the manifest and Apple touch icon.
- The generated service worker (`scripts/finalize-build.mjs`) precaches
  the manifest, icons, app shell, basemap SVG (still used by the 3D
  explorer) and catalogue, and runtime-caches visited map tiles.
- Install: open the deployed site in Chrome on Android → Add to Home Screen.

## Deploy

- `.github/workflows/pages.yml` — manual trigger only (`workflow_dispatch`).
  Build uses `ATLAS_BASE_PATH=/gta6-leonida-atlas/`. Nothing deploys on push.
  The workflow cannot be dispatched until it exists on the default branch,
  so publishing is currently manual: build, then push `dist/` to the
  `gh-pages` branch (legacy Pages source). Site:
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
