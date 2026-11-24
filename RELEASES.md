# Releases

Release history, newest first.

## v0.18.0 — 2026-11-24

**Released: The map itself, rebuilt pixel by pixel — deep teal sea, rich green land, pink roads, baked into the tiles.**

- The answer to his question — "why is it the exact same?" — was that v0.15–v0.17 changed everything around the map and never the map: the GTADB day tiles were still the same pale tiles. This build re-renders all 31,022 tiles (z0–z6) offline into the After Hours look and serves the new pyramid: deep teal ocean (#053A4C to #127E94, keeping the tiles' own light variation), rich green forest and grass, warm pale sand with a clean edge against the teal, warm-grey city blocks with a contrast stretch so Vice City reads as a city, coral #FF527F road centrelines and sunset #FFB56B highways, and a few large soft baked clouds over the sea at z0–z1. Same tile coordinates, zooms and geometry — a colour grade of the real tiles, not new geography; unclassifiable pixels keep their real colour.
- Roads are centrelines, not a pink wash: a road core (209,209,219) and a bright rooftop (202,205,214) are ~7 units apart, so no pixel rule can separate them — v1 painted whole avenues solid pink. The grade thins light-neutral pixels to skeletons, drops compact rooftop blobs and short stubs, and keeps only road-width centrelines (3px coral core, faint glow). At full zoom the city reads pinkish, like the reference.
- The sea overlay is DELETED, not fixed again. His 4:54pm screenshot proved the v0.17 "seamless sea" fix did not hold — the grade still ended mid-screen with flat teal and a ghost landmass on the right. The colour is now baked into the tiles, so there is no overlay, no mask rect, no canvas and nothing left that can seam. The tile-pane CSS filter is removed too (it would double-darken the styled tiles), and the ocean error tile is re-graded to the styled sea.
- Kept, unchanged: camera gate (opens on the whole of Leonida), slim 56px header, bottom-bar empty-map prompt, 120-marker cap / 24 hero pins, traced county outlines, spoiler-free defaults, real place data only (3,754 GTADB records, 986 named, 2,768 unnamed — never invent a name, coordinate, interior or pin).
- Honest limit: this is a recolour of the real in-game map, not new geography and not the AI-rendered reference (which invents places). The styled pyramid is 92 MB of tile bytes alongside the 149 MB originals, which stay in the repo as the source of truth. Palette, method and the five-iteration log (pink wash, lime beach, rooftop speckles, the source tiles' own stitch seam, cloud rash) are in `scripts/restyle-palette-report.md`.

## v0.17.0 — 2026-11-24

**Released: Opens on Leonida — a saved zoomed-in camera can no longer strand the map, the header is a slim strip, and the sea has no seams.**

- The map always opens on the whole of Leonida: his 4:28pm screenshot showed the map shifted right with the land cut off, a huge empty sea on the left and a few pins on the right edge. The cause was a saved camera from an old session, zoomed into the Vice City shops, resuming on open — with the zoom buttons hidden on phones there was no way back. A saved camera is now only resumed when it still shows the full map; anything zoomed in or panned away is ignored and the map fits all of Leonida, and the stale value is overwritten by the fit camera so it never comes back.
- A way back on phones: one floating recenter button (⌖) on the map, phones only, fits all of Leonida in one tap.
- The header is a slim strip now: the sunset banner was a big floating card (84px, round corners, border, shadow) and read as a website header sitting on the map. It is a 56px edge-to-edge strip with no card, no border, no shadow, and the subtitle hides on phones.
- The empty-map prompt is a compact bar pinned to the bottom of the map, not a big card in the middle of it — the big card covered the whole of Leonida on first open. Same buttons, one line of copy.
- The sea has no seams: the grade used to stop at the edge of the water-mask rect, so a camera that put that edge mid-screen showed a sharp rectangle of graded water against pale ungraded sea. The strips past the mask rect now get the same deep-teal grade (outside the tile bounds there is only ocean), and the map background is the same deep teal.
- Kept, unchanged: spoiler-free first launch, forced indexing onboarding, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, interiors on tap, the Ask spoiler rule + proximity, the index resolver v3, traced county outlines, and the animated sea at ~8fps, paused when the tab hides.

## v0.16.0 — 2026-11-24

**Released: Clean, fast, pretty — the map opens empty, the sea is deep teal at last, and the pink number blobs are gone.**

- Clean launch, every time: a saved view never brings its layers back on open. His screenshot had a "27" badge and a wall of pink clusters because a saved "Show everything" restored itself. Now the map opens with zero public pins and the empty-map prompt offers the saved layers back in one tap — "Restore my last layers (27 on)". Layers also has a one-tap "Turn everything off". The camera (position + zoom) still resumes.
- The lag fix: never more than 120 DOM markers at any zoom (was 360), and at full-map zoom only hero pins draw — at most 24 small icon pins, regions first, one per grid cell so they spread across the map instead of bunching in Vice City. The full 3,754-place catalogue is never turned into pins on launch; markers only ever come from layers the player turned on.
- Clusters are small icon pins now, not giant pink numbers: a cluster wears its best member's glyph on dark smoked glass with one tiny count badge. The pink numbered disc that covered his map is gone.
- The sea is deep teal at last — two bugs hid it since v0.15.0. First, the water mask PNG has no alpha channel, so the grade was composited over opaque white and the sea stayed pale; the mask is now stencilled (luminance becomes alpha) and the grade replaces the white with dark teal. Second, the sea canvas sat at z-index 300 as a sibling of the map — but Leaflet's map pane itself is z-index 400, so the whole map painted over it; the canvas now lives in its own Leaflet pane at z-index 300, between the tiles and the pins, with its size set in pixels because the pane has no size of its own.
- The reference header, on the real map: a sunset banner (generated art, no text, no logos) with "Leonida Atlas / The complete GTA VI companion", a compact search pill, and the All / Locations / Activities / Stores / Collectibles chips — one group on, the rest off, so a tap is the way into the map. Tapping a region pin opens the reference-style sheet: county photo, Set Route, View Area, Add to List.
- Kept, unchanged: spoiler-free first launch, forced indexing onboarding, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, interiors on tap, the Ask spoiler rule + proximity, the index resolver v3, traced county outlines, and the animated sea at ~8fps, paused when the tab hides.

## v0.15.0 — 2026-11-24

**Released: After Hours — a map that reads beautiful: traced county outlines, an animated sea, and art painted with your key.**

- County outlines are traced, not rectangles: the build dissected every z5 tile pixel by pixel (5,829 tiles, 3.1 million cells) and traced the real coastline — 307,527 units of it — inside each county, with inland edges drawn dashed where they are still estimates. Isolate a county and the map dims everything outside the actual landmass, with a delicate ivory coastline and a slim "&lt;County&gt; ×" pill to leave. The same traced outline sits on each county card in Layers.
- The sea is alive, quietly: a canvas over the real water areas drifts light across the ocean at about 8 frames a second, pausing when the tab hides and drawing one still frame when motion is reduced. It is a shimmer on the real water — not a new ocean simulation; a full animated tile layer would cost a phone its battery for a subtle effect.
- County art, painted with your key: each county card carries a dusk landscape in that county's mood, labelled "AI image" — art, never a photo of a real place. In Settings → County art, with the same OpenAI key Ask uses, you can paint a fresh one per county; it stays on this device, and "Restore bundled" brings the original back. No key, no problem — the bundled art stays.
- The After Hours system throughout: Midnight and Slate smoked glass, Ivory type, Coral and Sunset used only where they earn it — the wordmark, primary buttons, display titles. The "76 places showing" banner is gone, the brand is a small wordmark, search is one compact pill, the isolation banner is a slim pill with the county title drawn on the map, and Settings, Backup, the 3D explorer and About live in one settings area instead of on every page. The map is at least 85% of the screen.
- Kept, unchanged: spoiler-free first launch, persistence, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, interiors on tap, the Ask spoiler rule + proximity, the index resolver v3, and the empty-map prompt. The bright GTADB day tiles are untouched — no darkening filter, which would muddy the geography. Positions remain APPROXIMATE and absent coverage UNKNOWN.

## v0.14.0 — 2026-11-24

**Released: Minimal cards, not-sure places re-scanned, county and area isolation, and a map that never looks empty.**

- Cards are minimal now: a 56px blip roundel, the name or "? · type", the area, the distance, and Enterable / Lootable / Breakable / Gym / Equipment badges — nothing else on the card face. No paragraph, no evidence text, no "AI suggested" line on the card. All of that lives behind one tap, in the place sheet: the full description, the Inside section, loot, the AI-suggested label with its confidence, and the source. Ask answers are the same: a one-or-two-line verdict, then clean cards.
- Not-sure places get re-scanned: "not sure" is no longer attempted — a low-confidence answer is saved as "not sure" but its place stays in the "To go" count, and the next run checks it again. When the resolver version moves, the job re-queues every "not sure" place from the old version (resolver v3) and the Index panel says so — "X not-sure places re-queued for re-scan with the new prompt" — with a "Re-scan not-sure places" button to trigger it by hand.
- County and area isolation work on the map now, not just in the list: pick a county (Lummox, Kelly, Leonard, Vice-Dale, Mariana) or a town/city/area (Capri, Vice City, Port Gellhorn and the rest) from Layers or Find and the map zooms to it, dims everything outside it, shows only that area's places, and names the area on the map — with one big "Show all of Leonida" button to leave. County bounds are the estimated extents; area bounds come from the area's own places.
- The map never looks empty with no explanation again: on first launch — every public layer off on purpose, spoiler-free — the map now says so in plain words, "Nothing showing yet — pick what to see", with big buttons: Show interiors, Show lootable, Show shops, Show everything. One tap turns a layer on and the pins appear straight away. While places are showing, the map itself says how many and that Layers changes it.
- Kept, unchanged: spoiler-free first launch (all collectibles off, no spoilers shown), forced indexing onboarding, persistence, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system (dark blue = has an interior, light blue = closed), interiors on tap, the Ask spoiler rule + proximity, and the index resolver v2 (data first, LLM last). Real counts throughout: 3,754 GTADB records, 986 named, 2,768 unnamed, 658 of 2,732 "?" resolve from data (588 tags, 9 same-spot, 1 guide, 60 analogue). No "5k" anywhere.

## v0.13.0 — 2026-11-24

**Released: Ask answers as place cards, and an index resolver that checks the data before it guesses — the fix for the user's 7/10 verdict on v0.12.0.**

- Ask answers are big place cards now, never a text wall: a 56px blip roundel, the name or "? · type", area and county, the distance from the anchor, and Enterable / Lootable / Breakable / Gym / Equipment badges — nearest first, always. One tap flies to the place on the map and opens its sheet. The verdict is one or two lines above the cards, with a "Near Capri" anchor chip on every answer, so a follow-up never loses where it was looking. Nothing from a layer you did not ask about is volunteered.
- Ask is stable now: an answer is added whole or not at all (no half-loaded answer), a skeleton shows while it works, a stale answer from an earlier question can never overwrite a later one, and the latest answer scrolls to its top — the verdict and the first cards — instead of landing on the tail of the list. One sheet at a time, as before.
- Index resolver v2 — the job no longer guesses from almost nothing. Before the LLM sees a "?" place, it checks the real data first: a same-spot coordinate match (within 15 map units — measured, not guessed: records sit a median 118 units apart, so a wider tolerance matches neighbouring buildings, not the same place), then GTADB tags, then guide pins, then real-world analogue rules. Only what is left goes to the LLM, with the full context and temperature 0. Measured on the real snapshot, 658 of 2,732 "?" places resolve from data alone (588 from tags, 9 same-spot, 1 guide match, 60 analogue) and 2,074 go to the LLM — the unsure rate falls because data answers first, not because the confidence bar moved. Nothing is ever presented as a fact unless the data said it.
- The Index panel shows the unsure rate honestly: resolved by source — Tags 588, Same spot, Guide match, Analogue address, AI suggested, Not sure — with the remaining count. Every resolved place carries its source, and the source is shown where the type is shown ("? · House — from its tags", "AI suggested", and so on), so a data match is never shown as an AI guess. The online check is honest about its limit too: the guides publish shop counts but no pullable positions, so their shops cannot be matched by coordinates — that gap is shown in the panel, not hidden.
- Fixed, found by looking at the screenshots: the 56px blip roundel was stretched into a wide oval on every Find and Ask card in v0.12.0 (a flex rule on the card's text span was growing the icon). It is a circle again everywhere.
- Kept, unchanged: forced indexing onboarding, the job's pause/resume/batch-save, the on-device-only key, spoiler-free first launch, Gyms vs Workout Equipment split, breakable homes as a system, and the Ask spoiler rule. Real counts throughout: 3,754 GTADB records, 986 named, 2,768 unnamed, 588 of 2,732 "?" typed from data, 2,144 left for the job. No "5k" anywhere.

## v0.12.0 — 2026-11-24

**Released: mobile redesign from scratch — full-screen map, GTA VI sunset identity.**

- The map is the app now: full-bleed, edge to edge, with only a small LEONIDA ATLAS wordmark and one search pill over it. The filter bar is deleted — no chips, no count pill, no reminder pill, no floating Add button on the map at all. This is the redesign the user asked for after rating v0.11.0 a 6 ("tweaks on a design I hate rather than redesigning").
- Find is a proper screen: big search, two big filters (county, kind), and big place cards with a 56px blip roundel, area, county, distance and Can go inside / Lootable / Breakable home badges. Tap a card to fly to the place.
- Layers is a proper screen: big toggle rows with real icons and counts, a county picker as six big cards (All Leonida plus Lummox, Kelly, Leonard, Vice-Dale, Mariana), trading cards grouped at the bottom, the indexing job inside Layers only, and Add to the map (marker / workout spot / breakable home) here instead of floating over the map.
- Place detail is a full bottom sheet: grabber, a 72px blip hero, badges (Can go inside, Lootable, Breakable home, Gym, Workout equipment), and Save / Mark as found as two big buttons right under the title — then Inside, with the dark-blue rule and the 385 enterable places in GTADB.
- Fresh phone-first stylesheet written from scratch, replacing the layered v0.9/v0.10/v0.11 sheet: violet-night chrome, the GTA VI pink-to-orange sunset on primary actions and the active bottom-nav tab, Anton display + Oswald labels, glass sheets. No black pill stack, no generic dark dashboard.
- Kept, unchanged: forced indexing onboarding (2,732 still "?", 581 typed from GTADB tags, 2,151 unresolved), spoiler-free first launch, persistence, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, the Ask spoiler rule, and AI categories labelled "AI suggested", never a fact.

## v0.11.0 — 2026-11-24

**Released: forced indexing onboarding, a de-cluttered map-first layout, and GTA VI sunset vibes — the "one more go" pass.**

- Forced onboarding for the indexing job: on first launch after this update — and for anyone who has never seen it — a full-screen onboarding shows BEFORE the map is usable, with no × and no Escape. Plain words: 2,732 places are still "?", 581 already have a type from the map data's own tags, 2,151 still have nothing to read, and the ONLY way they get sorted is this job with your own OpenAI key. Paste the key (the same one Ask Nylah uses, on-device only, sent nowhere except OpenAI — with a link to where to get one), tap Start sorting, or explicitly tap "Skip for now". Skipping is a choice, not a missed ×: the job stays one tap away in Layers ("Sort the unnamed places") and a reminder pill stays on the map until it has run at least once. The job as shown honestly: 8 places at a time, gpt-4o-mini, each batch saved on-device before the next, pause/stop/resume, suggestions labelled "AI suggested", low confidence stays "not sure", 0 sorted on a fresh phone. A new seen-key means everyone sees it once after this update, including users who already dismissed the old welcome sheet.
- De-cluttered: the map dominates again. The filter bar is TWO rows, not four — row 1 is the one place count, the indexing reminder, and Clear all; row 2 is one horizontally scrolling strip (county, kind, layer chips, narrowing chips, interior-type picker, More layers). No second filter row, no pills row repeating the active filters, and no duplicated count: the map caption's "76 places in view" is gone, the filter pill's "76 places" is the only count. The three add buttons are one "+ Add" button with a sheet (Add marker / Add workout spot / Add breakable home).
- GTA VI vibes, not generic dark UI: the in-game pause-map's own language — deep blue water, muted green land, warm sand is the basemap itself — with the official art's pink-to-orange sunset as the accent (primary actions, active chips, the reminder pill, cluster roundels), the LEONIDA ATLAS wordmark with ATLAS in the sunset gradient, Anton display type + Oswald condensed labels (self-hosted OFL — no Rockstar font is legally bundleable), GTA blip roundels throughout, and glass bottom sheets and panels the map shows through. No more black pills stacked over the whole map.
- Everything kept: spoiler-free first launch (the onboarding is the exception — it IS the first launch), persistence, bottom nav (Map/Find/Layers/Saved/Ask), 48px+ thumb targets everywhere, Gyms vs Workout Equipment split, breakable homes as a system (dark blue = has an interior, light blue = closed), interiors on tap (385 enterable), the Ask spoiler rule + proximity (asking for a thing IS consent to show that layer, never volunteer extras from other layers), and the AI categorisation job itself. Real counts throughout: 3,754 GTADB records, 986 named, 2,768 unnamed, 581 of 2,732 "?" typed from GTADB tags, 2,151 unresolved. No "5k" anywhere.

## v0.10.0 — 2026-11-24

**Released: navigation-first rebuild, breakable homes, interiors on tap, and the 10/10 pass — thumb-sized everywhere, honest about what the data does not know.**

- Navigation first: a labelled bottom nav (Map / Find / Layers / Saved / Ask), one filter system shared by the map and Find ("X places showing" + removable filter pills + one-tap Clear all), Explore as a first-class searchable list, and one sheet at a time — Ask never stacks on a place detail.
- Every tappable thing is at least 48px on a phone — chips, buttons, layer rows, list rows, map pins, bottom nav, filter pills, close buttons — with press feedback. The 390px walk measures it and fails the build if anything is under.
- Gyms and workout equipment are separate layers, filters and icons (dumbbell vs kettlebell). Equipment searches and Ask answer from the free gear first, never the member gyms. The Capri garage-in-a-house flow: tap a house in Capri → "Workout equipment in the garage — mark it" → a real Workout Equipment pin with your note. Nothing invented — no public source lists equipment in Capri.
- Breakable homes are systemic, not a 33-item list: a Breakable homes layer (52 places — the 33 GTADB-tagged residential-enterable, 13 Capri rob-house candidates, the Port Gellhorn trailer park, plus 5 seeded guide examples), the dark-blue in-game rule in plain words ("dark blue on the in-game map = can go in, light blue = closed, Focus shows the doors"), "Possible enterable house — check it" for untagged houses, and mark-any-house-as-breakable with loot notes.
- Interiors on tap: every place detail has an "Inside" section (Enterable / Interior unknown, venue type, what you do inside), an Interiors layer (77 places, 385 enterable in GTADB) filterable by venue type, and an "Interior houses" filter (33 tagged in GTADB — labelled as tagged, not as the real total).
- Resolve every POI: 581 of the 2,732 "?" places already have a type from the map data's own tags (house 332, shop 106, landmark 47, transport 37, leisure 25, services 17, restaurant 15, petrol 2), shown as "? · House — from its tags" in search and detail; 2,151 still have nothing to read, and the AI indexing job is the way to close them (0 indexed so far — it only runs on your phone with your key).
- Data, honestly merged: GTADB is current at d406fea (verified against the repo — no newer revision exists); FullSweep's 1,534 landmarks add nothing new (all already in the snapshot, and its 75 locations are pre-release predictions, not imported); GTABase and GTA6GPS have no public data file, so they stay reference-only; the shop gap is named, not hidden (e.g. bars 3 of 122, clothing 9 of 67 in GTADB tags). Total 3,781 places. No 5k anywhere.
- 10/10 visuals: Anton display type + Oswald condensed labels, self-hosted (OFL) — no Rockstar font is legally bundleable; GTA blip roundels in the bottom nav; a real service worker (the app registered one that did not exist, so every load logged a console error — now it caches the shell and tiles for offline use).
- Fixed in this pass, found by looking at the screenshots, not the assertions: the Ask "houses to check" cards crushed the house name to 0px wide; Ask result rows clipped past the sheet edge; the Find empty state rendered 200px below the fold in a 35px slit (the filter bar now scrolls with the results); the map credit line wrapped and clipped; the "Add marker" button read as disabled (dark text on a dark background).
- The welcome sheet's Skip button now sits in a pinned footer below the sheet instead of at the end of ~1,900px of scrolling content. The e2e suite was repaired alongside: it now dismisses the welcome, uses the current layer/dialog/category names, and the mobile-safari project needs its system libraries installed to launch in a fresh sandbox.

## v0.9.0 — 2026-11-23

**Released: authentic map blips and a warmer companion redesign.**

- Every place pins a GTA-style blip — a white pictogram in a coloured roundel, drawn from its GTADB tags (petrol, gun shop, hotel, gym and more) in one consistent stroke set. No place falls back to a coloured dot.
- The same icons run through the whole app: overlay chips, layer rows, search results, place detail sheets, Ask Nylah answers and AI-suggested types.
- Warm charcoal-and-orange redesign with an elegant serif for headings, floating glass cards and rounded bottom sheets. The map chip row wraps instead of scrolling, and the place description lifts its real-world analogue address into its own line.

## v0.8.2 — 2026-11-17

### Map data and local editing

- Refresh the GTADB landmark catalogue to the November 17 revision. The map includes 3,431 community records and six regions. All 2,198 previous landmark identifiers remain available to local favorites, collections and notes.
- Verify marker and note revisions before deleting either record, so an older tab cannot erase newer work.
- Keep dismissed place details closed during background data refreshes. Stabilize the mobile sidebar and restore keyboard focus after closing settings.

### Distribution and performance

- Point the README's place and 3D examples at the interactive atlas. Add Chromium and WebKit to the pull request and release checks.
- Cache the optional 3D code on first use. The map and personal library still reopen offline after a complete initial load.
- Remove unused analytics event and guest provider code. The private account extension contract is unchanged.
- Configure the Docker analytics helper with exact HTTPS origins and update the development-only minimatch dependency.

## v0.8.1 — 2026-09-18

- Publish crawlable project pages, clean project URLs and distinct metadata.
- Refresh dependencies and migrate to TypeScript 6.

## v0.8.0 — 2026-09-06

**Released: deeper streets and researched regional scenes.**

The 3D explorer adds coherent local scenes around all six regional arrivals: a bakery court and market in Vice City, working marina in the Keys, stilt structures in Grassrivers, weathered retail in Port Gellhorn, an industrial service yard in Ambrosia, and trail shelter and stream access in Kalaga.

- Fifteen short discoveries link to official Rockstar descriptions and public images in place details, search and Evidence. Source observations remain unpositioned; regional travel uses existing reviewed arrivals.
- Window openings have real depth and view-dependent room interiors, with balconies, storefronts, roof setbacks and service details. Mapped urban roads gain curbs, gutters and drainage; rural roads keep softer verges.
- Five locally served CC0 photographic surface sets provide color, normal and roughness detail for asphalt, concrete, rock, wood and gravel. Source manifests retain licensing, dimensions and checksums.
- Contact shading, higher-resolution nearby shadows and restrained highlight glow improve depth. A direct-render fallback covers unavailable HDR targets or failed effect shaders.
- Shared GPU texture sources, spatial facade detail and leaner native forest geometry bound the extra rendering cost. Regional terrain clears the actual accepted scenery footprints.
- Evidence and regional travel work with native keyboard activation. Existing accounts, local workspaces, selected destinations and private deployment Analytics configuration are preserved.

Validation covers geometry, parcel occupancy, terrain clearance, source provenance, texture reuse and late disposal, rendering state and fallback, plus Chromium regional views and navigation. The test environment uses SwiftShader software rendering, so it does not establish hardware frame rates or real iOS graphics performance.

Research uses [Only in Leonida](https://www.rockstargames.com/VI/only-in-leonida) and its official public imagery. The catalogue also links the [Extended Look](https://www.rockstargames.com/VI/an-extended-look) without deriving unverified footage details. Decorative placements and unmeasured relief remain **APPROXIMATE**. This browser reconstruction retains visible simplifications; exact game models, dimensions and surveyed terrain are not available in the project.

## v0.7.0 — 2026-09-06

**Released: a fuller, living 3D Leonida.**

The explorer restores mapped road visibility and building occupancy, including the view behind Vice City's arrival. Ground-tile coverage is separate from visual detail: desktop/mobile retain 7×7/5×5 tile neighborhoods, while detailed facade geometry is limited to 300/220 metres.

- Rotated footprints, regional floor spacing, roofs, recessed windows and smoother source-road geometry replace repeated axis-aligned boxes and gaps.
- Hotel Dixon, the Sahara arena, waterfront towers and the mural viaduct have rebuilt volumes. Existing regional arrivals gain porches, pitched roofs, storefronts and service details.
- Original skinned pedestrians replace block figures and oversized life collages. Feet and tyres meet active street surfaces, and traffic follows the actual Vice City and rotated Ambrosia arrival frames.
- Native nearby foliage, continuous local Kalaga rock ridges, outdoor reflections, traveling water normals, shaded clouds and bounded night streetlights deepen the regional scenes.
- Coordinate provenance, source attribution, map data, local workspaces and deployment-only account/Analytics boundaries are preserved. Existing releases from v0.5.0 remain available in About.

Validation includes 503 unit/integration tests, TypeScript, ESLint, a production build, actual Chromium views of all six regions and additional landmark/actor captures. Geometry, contact, streaming and disposal checks are included. GPU measurements were obtained with software rendering; no hardware FPS guarantee is claimed.

The supplied game screenshots guide the visual interpretation. Original game models, exact building heights, comprehensive surveyed relief and rigged game characters were not supplied. New local details remain **APPROXIMATE**, and the result is a browser reconstruction with visible simplifications. See [visual verification](https://github.com/navanem/gta6-leonida-atlas/blob/v0.7.0/docs/visual-overhaul/VERIFICATION.md).

## v0.6.2 — 2026-09-06

**Released: public collaboration and security hardening.**

The repository is now public and ready for community forks, corrections and focused pull requests. Contribution guidelines, a code of conduct, issue forms, a pull-request template and a security policy define how to propose changes and report vulnerabilities. The default branch requires a pull request, a successful Quality check, resolved conversations and linear history; force pushes and branch deletion are blocked.

Continuous integration now uses SHA-pinned GitHub Actions with read-only default permissions. Dependabot groups compatible production, development and workflow updates, while keeping Node type definitions on the supported Node 22 major. Valid dependency updates were consolidated and tested without accepting unrelated lockfile downgrades.

GitHub private vulnerability reporting, dependency alerts, secret scanning, push protection and default CodeQL analysis are enabled. The initial CodeQL scan completed successfully with no findings, GitHub reported no unresolved secrets or dependency vulnerabilities, and the repository contained no workflow caches at publication time.

This maintenance release does not change public map data, coordinates, licensing, account boundaries or the application’s local-first behavior.

### Verification

Frozen installation, strict TypeScript, lint, 458 unit/integration tests and the production build passed. The existing browser suite passed in Chromium, including the public contribution changes. Git integrity and history scans found no corruption or recognized credential patterns; the local checkout and remote `main` matched before publication.

## v0.6.1 — 2026-09-05

**Released: visitor measurement and release history.**

The About page now lists the current and earlier versions with their dates, summaries and direct GitHub release links. The full changelog retains each version’s details.

Release history is retained from **v0.5.0** onward. The publication workflow preserves existing releases and restores missing historical entries using their original Git tags and version-specific notes. The newest version remains the latest release.

Audience measurement now asks visitors to allow or decline Analytics, with a changeable choice in About. Accepted visits use a dedicated random browser identifier instead of recreating one on every load. Declining stops measurement and removes the saved identifiers. The Google tag remains isolated from accounts, forms, searches and personal map data, and the instance measurement configuration stays outside GitHub.

This update preserves the working account service, local workspaces and selected 3D destinations. Analytics reports cover consenting visitors; delivery checks do not establish what is visible in a private Google Analytics dashboard.

### Verification

The isolated public fork passes installation, types, lint, 458 unit/integration tests and its browser suite (18 passed, two existing platform-specific skips). Release publication has 25 lifecycle tests. Desktop and mobile checks cover the release history and consent controls. Real Google SDK checks verify accepted page-view delivery and browser/session continuity; the complete scope is recorded in `docs/refactor/VERIFICATION.md`.

## v0.6.0 — 2026-09-05

**Released: account workspaces and selected 3D destinations.**

Live application: [Leonida Atlas](https://gta6state.com/gta6-leonida-atlas/).

### Selected map destination in 3D

Choosing Ambrosia, Leonida Keys or another positioned place before opening **3D explorer** now carries that destination into the actual world spawn. Reloading the explorer URL preserves it. Existing approach offsets and collision clearance remain; opening the explorer without a selection keeps its default entry. Rapid map/explorer transitions also cancel pending Leaflet zoom callbacks.

### Official accounts and independent forks

The official deployment supplies a separately maintained private account service and panel: registration with email, a unique username and password; sign-in by email or username; profile and password controls; recovery keys; account deletion; and explicit server backup save/restore. Email confirmation is disabled for now. Both email and username uniqueness are enforced by the server. Backups use revision checks to avoid silently overwriting another device's newer copy.

The public core adds an empty-by-default extension point and distinct local account workspaces. Accepted writes finish in their original workspace; stale reads, drafts and backup operations are guarded across identity changes. Guest data remains separate and is never automatically uploaded on sign-in.

A default fork still needs no account, server, CMS, API credentials or parent site. The private account implementation, database and configuration remain outside this repository. Google Analytics remains optional, deployment-configured and isolated from personal application data.

### Preserved map, data and licensing

The standalone React/Vite map retains local favorites, notes, collections, personal markers, validated portable backups, public offline caching and the optional Three.js explorer. GTADB / Map GTA data stays attributed under **CC BY 4.0**: all 2,198 records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placements remain **APPROXIMATE** and absent coverage **UNKNOWN**.

Original source remains **AGPL-3.0-only**; third-party rights are unchanged. See [third-party notices](THIRD_PARTY_LICENSES.md) and the [verification record](docs/refactor/VERIFICATION.md) for test scope and browser limitations.

## v0.5.0 — 2026-09-05

**Released: standalone local-first Atlas.**

Live application: [Leonida Atlas](https://gta6state.com/gta6-leonida-atlas/).

### Map and local workspace

- A standalone React/Vite/TypeScript application replaces the Astro shell and build. Static hosting requires no CMS, parent website, account or private API.
- The calibrated Leaflet CRS.Simple map is the primary workspace, with search, intersecting category/evidence/favorite filters, ordered layers, zoom rules, bounded spatial clustering and source details.
- Dexie / IndexedDB stores favorites, notes, collections, personal markers and preferences. Schema upgrades, transactional saves, cross-tab updates and stale-draft checks protect local work.
- The personal marker editor supports creation, editing, coordinate moves and deletion with local-reference cleanup.
- Versioned JSON backups are validated before writes, previewed before import and merged atomically. Invalid, unsupported or oversized imports leave existing data intact.

### Independent hosting and optional features

- The production service worker preserves the app shell, catalogue and basemap after a complete online load. Optional 3D image assets are cached as visited with bounded eviction; a complete offline world download is not promised.
- The preserved Three.js reconstruction loads on demand. Desktop/touch controls, regional travel, source evidence, cleanup on return and a WebGL-unavailable fallback remain available.
- Public forks work as guests without credentials. Auth/user/sync contracts are optional integration points; no private user backend is distributed.
- Optional Google Analytics is configured outside public source and runs in an opaque sandbox isolated from notes, markers, collections and IndexedDB.
- Static output and a standalone Nginx container support root or subdirectory hosting. Historical project and regional URLs remain resolvable.

### Evidence and licensing

GTADB / Map GTA data remains pinned and attributed under **CC BY 4.0**. All 2,198 upstream records are retained: 2,091 positioned and 107 unpositioned, plus six regional entries. Missing coordinates remain missing. Community placements are **APPROXIMATE** and unsupported coverage remains **UNKNOWN**.

Original project source is **AGPL-3.0-only**. Rockstar references and other third-party material retain their own rights. See [LICENSE](LICENSE), [third-party notices](THIRD_PARTY_LICENSES.md) and [methodology](docs/METHODOLOGY.md).

### Verification

- Frozen installation, strict types, lint, unit/integration tests, static build and the isolated public-fork workflow passed.
- Desktop Chromium and mobile WebKit: **17 browser cases passed, one conditional WebKit offline-navigation skip**. Chromium verifies cached offline reopening; the WebKit limitation is not presented as a Safari offline-reload pass.
- An isolated `/atlas/` build verified the catalogue, map, marker reload, project links, historical regional routes, 3D resources and scoped service worker.
- The standalone Nginx container passed startup/configuration checks and the browser suite. Analytics isolation, offline-cache boundaries, dependency audit and peer checks passed.

The [verification record](docs/refactor/VERIFICATION.md) documents the executed checks, their scope and browser automation limits. It records pre-publication validation; production delivery is verified separately.
