export interface LeonidaAtlasRelease {
  readonly version: `v${number}.${number}.${number}`;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly status: 'public' | 'in-preparation';
  readonly highlights: readonly string[];
  readonly verification: readonly string[];
}

/** Retained public history starts at v0.5.0; the newest release stays first. */
export const LEONIDA_ATLAS_RELEASES: readonly LeonidaAtlasRelease[] = [
  {
    version: 'v0.14.0',
    date: '2026-11-24',
    title: 'Minimal cards, not-sure places re-scanned, county and area isolation, and a map that never looks empty',
    summary:
      'The fix for three complaints at once: place cards that read as essays, not-sure places the job skipped forever, and a county picker that filtered the list while the map stayed lit — plus the empty first-launch map that read as broken, with 3,754 places in the data and nothing showing.',
    status: 'public',
    highlights: [
      'Cards are minimal now: a 56px blip roundel, the name or "? · type", the area, the distance, and Enterable / Lootable / Breakable / Gym / Equipment badges — nothing else on the card face. No paragraph, no evidence text, no "AI suggested" line on the card. All of that lives behind one tap, in the place sheet: the full description, the Inside section, loot, the AI-suggested label with its confidence, and the source. Ask answers are the same: a one-or-two-line verdict, then clean cards.',
      'Not-sure places get re-scanned: "not sure" is no longer attempted — a low-confidence answer is saved as "not sure" but its place stays in the "To go" count, and the next run checks it again. When the resolver version moves, the job re-queues every "not sure" place from the old version (resolver v3) and the Index panel says so — "X not-sure places re-queued for re-scan with the new prompt" — with a "Re-scan not-sure places" button to trigger it by hand.',
      'County and area isolation work on the map now, not just in the list: pick a county (Lummox, Kelly, Leonard, Vice-Dale, Mariana) or a town/city/area (Capri, Vice City, Port Gellhorn and the rest) from Layers or Find and the map zooms to it, dims everything outside it, shows only that area\'s places, and names the area on the map — with one big "Show all of Leonida" button to leave. County bounds are the estimated extents; area bounds come from the area\'s own places.',
      'The map never looks empty with no explanation again: on first launch — every public layer off on purpose, spoiler-free — the map now says so in plain words, "Nothing showing yet — pick what to see", with big buttons: Show interiors, Show lootable, Show shops, Show everything. One tap turns a layer on and the pins appear straight away. While places are showing, the map itself says how many and that Layers changes it.',
      'Kept, unchanged: spoiler-free first launch (all collectibles off, no spoilers shown), forced indexing onboarding, persistence, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system (dark blue = has an interior, light blue = closed), interiors on tap, the Ask spoiler rule + proximity, and the index resolver v2 (data first, LLM last). Positions remain APPROXIMATE and absent coverage UNKNOWN; GTADB data is CC BY 4.0, including 107 unpositioned entries.',
    ],
    verification: [
      'Unit tests pass, including 11 new tests for the not-sure re-queue (a v1 not-sure place re-queued under the new version, the runner never marking a not-sure place attempted, the re-queue surviving a storage round-trip exactly once) and for county/area isolation (Capri bounds contain its own places, Vice City neighbourhoods belong to Vice City). TypeScript, ESLint and the production build pass.',
      'The 390px walk passes with zero console errors and zero overflow, and the screenshots were looked at: a clean minimal Find card, an Ask answer with clean cards, the Index panel showing the re-queued not-sure count, Capri isolated with the rest of the map dimmed, and the fresh-profile first launch — the empty-map prompt, then pins appearing after one tap on "Show interiors".',
      'Chromium e2e: 11 of 12 pass; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.',
    ],
  },
  {
    version: 'v0.13.0',
    date: '2026-11-24',
    title: 'Ask answers as place cards, and an index resolver that checks the data before it guesses',
    summary:
      'The fix for the user’s 7/10 verdict on v0.12.0: Ask answers as nearest-first place cards with distances and badges instead of a text wall, and the indexing job resolves from real data — coordinates, tags, guide pins, analogues — before the LLM ever sees a place.',
    status: 'public',
    highlights: [
      'Ask answers are big place cards: a 56px blip roundel, the name or “? · type”, area and county, the distance from the anchor, and Enterable / Lootable / Breakable / Gym / Equipment badges — nearest first, always. One tap flies to the place and opens its sheet. The verdict is one or two lines above the cards, with a “Near Capri” anchor chip on every answer.',
      'Ask is stable: an answer is added whole or not at all, a skeleton shows while it works, a stale answer can never overwrite a later one, and the latest answer scrolls to its top — the verdict and the first cards — instead of landing on the tail of the list.',
      'Index resolver v2 — the job no longer guesses from almost nothing. Before the LLM sees a “?” place it checks the real data: a same-spot coordinate match (within 15 map units — measured, not guessed: records sit a median 118 units apart, so a wider tolerance matches neighbouring buildings), then GTADB tags, then guide pins, then real-world analogue rules. Only what is left goes to the LLM, with the full context and temperature 0.',
      'Measured on the real snapshot, 658 of 2,732 “?” places resolve from data alone (588 from tags, 9 same-spot, 1 guide match, 60 analogue) and 2,074 go to the LLM. The Index panel shows the unsure rate honestly, resolved by source, with the remaining count — and every resolved place carries its source where the type is shown, so a data match is never shown as an AI guess.',
      'Fixed, found by looking at the screenshots: the 56px blip roundel was stretched into a wide oval on every Find and Ask card in v0.12.0. It is a circle again everywhere.',
      'Kept, unchanged: forced indexing onboarding, the job’s pause/resume/batch-save, the on-device-only key, spoiler-free first launch, Gyms vs Workout Equipment split, breakable homes as a system, and the Ask spoiler rule. Real counts throughout: 3,754 GTADB records, 986 named, 2,768 unnamed, 588 of 2,732 “?” typed from data, 2,144 left for the job. No “5k” anywhere.',
    ],
    verification: [
      '712 unit tests pass, including 17 for the coordinate/guide/analogue resolver and 7 for Ask card presentation; TypeScript, ESLint and the production build pass.',
      'The 390px walk passes with zero console errors and zero overflow, and the Ask screenshots were looked at: “gym near Capri” (Grand Majestic Gym, about 5,700 units away, GYM badge), “workout equipment near Capri” (Jason’s deck first), “enterable houses in Rockridge” (Venture Apts with Breakable badges), and the Index panel with the per-source counts row.',
      'Chromium e2e: 11 of 12 pass; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.',
    ],
  },
  {
    version: 'v0.12.0',
    date: '2026-11-24',
    title: 'Mobile redesign from scratch — full-screen map, GTA VI sunset identity',
    summary:
      'The phone app is rebuilt, not re-coloured: a full-screen map with nothing on it but a wordmark and one search bar, proper Find and Layers screens, county cards, and a full place sheet — after the user rated v0.11.0 a 6 and said the redesign was tweaks on a design he hates.',
    status: 'public',
    highlights: [
      'The map is the app now: full-bleed Leaflet map, edge to edge, with only a small LEONIDA ATLAS wordmark and one search pill over it. The filter bar is deleted — no chips, no count pill, no reminder pill, no floating Add button on the map at all.',
      'Find is a proper screen: big search, two big filters (county, kind), and big place cards with a 56px blip roundel, area, county, distance and Can go inside / Lootable / Breakable home badges. Tap a card to fly to the place.',
      'Layers is a proper screen: big toggle rows with real icons and counts, a county picker as six big cards (All Leonida plus Lummox, Kelly, Leonard, Vice-Dale, Mariana), trading cards grouped at the bottom, the indexing job inside Layers only, and Add to the map (marker / workout spot / breakable home) here instead of floating over the map.',
      'Place detail is a full bottom sheet: grabber, a 72px blip hero, badges (Can go inside, Lootable, Breakable home, Gym, Workout equipment), and Save / Mark as found as two big buttons right under the title — then Inside, with the dark-blue rule and the 385 enterable places in GTADB.',
      'Fresh phone-first stylesheet written from scratch (1,800 lines replacing the layered v0.9/v0.10/v0.11 sheet): violet-night chrome, the GTA VI pink-to-orange sunset on primary actions and the active bottom-nav tab, Anton display + Oswald labels, glass sheets. No black pill stack, no generic dark dashboard.',
      'Kept, unchanged: forced indexing onboarding (2,732 still “?”, 581 typed from GTADB tags, 2,151 unresolved — the job is the only way they get sorted), spoiler-free first launch, persistence, 48px+ thumb targets, Gyms vs Workout Equipment split, breakable homes as a system, the Ask spoiler rule, and AI categories labelled “AI suggested”, never a fact. Positions remain APPROXIMATE and absent coverage UNKNOWN; GTADB data is CC BY 4.0, including 107 unpositioned entries.',
    ],
    verification: [
      'Unit tests passed; TypeScript, ESLint and the production build passed.',
      'The 390px walk (22 flows) and the 390px check script pass with zero console errors, zero overflow, and zero tap targets under 48px.',
      'Chromium e2e: 11 of 12 pass, including the new forced-onboarding test on a fresh profile; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.',
    ],
  },
  {
    version: 'v0.11.0',
    date: '2026-11-24',
    title: 'Forced indexing onboarding, a de-cluttered map, GTA VI sunset vibes',
    summary:
      'The indexing job gets a forced first-launch onboarding, the map gets its space back with a two-row filter bar and one Add button, and the whole app wears the official art’s pink-to-orange sunset.',
    status: 'public',
    highlights: [
      'Forced onboarding before the map is usable: 2,732 places are still “?”, 581 already have a type from the map data’s own tags, 2,151 still have nothing to read, and the only way they get sorted is this job with your own OpenAI key — paste it, tap Start sorting, or explicitly tap Skip for now.',
      'Skipping is a choice, not a missed ×: the job stays one tap away in Layers (“Sort the unnamed places”) and a reminder pill stays on the map until it has run at least once.',
      'The filter bar is two rows — one count pill, the reminder, Clear all, then one scrolling strip of chips — and the map caption’s duplicate count is gone.',
      'One “+ Add” button with a sheet (Add marker / Add workout spot / Add breakable home) instead of three buttons over the map.',
      'GTA VI sunset accent (pink-to-orange) on primary actions, active chips, the reminder pill and cluster roundels; LEONIDA ATLAS wordmark with ATLAS in the gradient; Anton + Oswald self-hosted; glass bottom sheets.',
    ],
    verification: [
      '681 unit tests passed; TypeScript and the production build passed.',
      'The 390px walk (22 flows) and the 390px check script pass with zero console errors, zero overflow, and zero tap targets under 48px.',
      'Chromium e2e: 11 of 12 pass, including the new forced-onboarding test on a fresh profile; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox). The WebKit offline-navigation case is explicitly skipped in the suite where Playwright WebKit cannot run it.',
    ],
  },
  {
    version: 'v0.10.0',
    date: '2026-11-24',
    title: 'Navigation first, breakable homes, interiors on tap',
    summary:
      'A labelled bottom nav with one filter system, thumb-sized controls everywhere, breakable homes as a systemic rule instead of a 33-item list, and interiors shown on every place.',
    status: 'public',
    highlights: [
      'Labelled bottom nav (Map / Find / Layers / Saved / Ask), one filter system shared by the map and Find, and one sheet at a time — Ask never stacks on a place detail.',
      'Every tappable thing is at least 48px on a phone, measured by the 390px walk.',
      'Gyms and workout equipment are separate layers; the Capri garage-in-a-house flow turns his own knowledge into a real Workout Equipment pin.',
      'Breakable homes layer (52 places) with the dark-blue in-game rule in plain words, plus “Possible enterable house — check it” for untagged houses.',
      'Every place detail has an “Inside” section, and Interiors filters by venue type — 385 enterable in GTADB, 33 houses tagged.',
      '581 of the 2,732 “?” places already have a type from the map data’s own tags; 2,151 still have nothing to read, and the AI indexing job is the way to close them.',
      'Real service worker (the app registered one that did not exist), Anton + Oswald type, and the welcome’s Skip button pinned below the sheet instead of 1,200px below the fold.',
    ],
    verification: [
      '678 unit tests passed; TypeScript, ESLint and the production build passed.',
      'The 390px walk (22 flows) and the 390px check script pass with zero console errors and zero tap targets under 48px.',
      'Chromium e2e: 10 of 11 pass; the 3D explorer test needs a real GPU (software WebGL is too slow in this sandbox).',
    ],
  },
  {
    version: 'v0.9.0',
    date: '2026-11-23',
    title: 'Authentic map blips and a warmer companion redesign',
    summary:
      'Every place pins a real pictogram in a GTA-style blip, and the whole app is redesigned to a warm charcoal-and-orange companion look.',
    status: 'public',
    highlights: [
      'Map pins are GTA-style blips: a white pictogram in a coloured roundel, drawn from each place’s GTADB tags — petrol, gun shop, hotel, gym and more — in one consistent stroke set. No place falls back to a coloured dot.',
      'The same icons run through the whole app: overlay chips, layer rows, search results, place detail sheets, Ask Nylah answers and AI-suggested types.',
      'The interface is redesigned to a boutique-hotel register: warm charcoal surfaces with orange accents, an elegant serif for headings, floating glass cards and rounded bottom sheets.',
      'The map chip row wraps instead of scrolling, and the place description lifts its real-world analogue address into its own line instead of a wall of text.',
    ],
    verification: [
      '641 unit tests passed, including 9 new icon-system tests covering every GTADB tag in the snapshot.',
      'TypeScript, ESLint and the production build passed; the 390px walk was re-run with screenshots.',
    ],
  },
  {
    version: 'v0.8.2',
    date: '2026-11-17',
    title: 'Updated landmarks and safer local editing',
    summary:
      '3,431 refreshed community landmarks, safer marker deletion, and more reliable mobile navigation.',
    status: 'public',
    highlights: [
      'The November 17 GTADB catalogue keeps all previous IDs and adds 1,233 records. Positions remain approximate.',
      'Marker deletion checks the marker and its note for changes before committing.',
      'The 3D renderer downloads when you open it. The map and local library still reopen offline.',
    ],
    verification: [
      'The release workflow checks the production build and browser flows in Chromium and WebKit.',
    ],
  },
  {
    version: 'v0.8.1',
    date: '2026-09-18',
    title: 'Crawlable project pages and dependency refresh',
    summary: 'Clean project URLs, distinct metadata and a TypeScript 6 migration.',
    status: 'public',
    highlights: ['Project pages include readable static content and dedicated page metadata.'],
    verification: ['The public source and tag are available on GitHub.'],
  },
  {
    version: 'v0.8.0',
    date: '2026-09-06',
    title: 'Deeper streets and researched regional scenes',
    summary:
      'Fifteen sourced discoveries, six richer regional arrivals, deep window interiors, photographic surfaces and contact shading.',
    status: 'public',
    highlights: [
      'Official Rockstar regional descriptions and public images support fifteen short discoveries in place details, search and the explorer Evidence panel. Unpositioned observations lead to existing regional arrivals without inventing exact map pins.',
      'Vice City gains a shaded bakery court and market; the Keys a working marina; Grassrivers stilt structures; Port Gellhorn weathered shops; Ambrosia a service yard; and Kalaga a trail shelter and stream access.',
      'Recessed window openings, view-dependent room interiors, balconies, setbacks and storefronts add architectural depth. Nearby mapped roads gain curbs, gutters and drainage where their source context is urban.',
      'Locally hosted CC0 photographic color, normal and roughness maps cover asphalt, concrete, rock, timber and gravel. Shared texture sources and spatial detail limits keep the added resources bounded.',
      'Depth-based contact shading, sharper nearby shadows and restrained highlight glow strengthen grounding. Unsupported effect configurations retain direct rendering. Native trees have finer silhouettes and more efficient forest geometry.',
      'GTADB coordinates, CC BY 4.0 attribution and existing releases remain available. Decorative parcels and unmeasured relief stay APPROXIMATE; the source material does not establish exact dimensions or positions.',
    ],
    verification: [
      'Unit and integration checks cover source claims, facade clearance, parcel occupancy, road context, terrain clearance, texture sharing, asynchronous disposal and rendering fallback.',
      'Chromium checks cover regional views, selected destinations, native keyboard activation of Evidence and travel, return to the atlas and touch controls.',
      'The rendering checks use Chromium with SwiftShader software rendering. Hardware frame rates and real iOS graphics performance are not established by this environment.',
    ],
  },
  {
    version: 'v0.7.0',
    date: '2026-09-06',
    title: 'A fuller, living 3D Leonida',
    summary:
      'Restored mapped streets and buildings, articulated pedestrians and richer architecture, vegetation, terrain, water and lighting across six regions.',
    status: 'public',
    highlights: [
      'Source roads remain visible above approximate terrain. Mapped building occupancy is preserved on desktop and mobile, with rotated footprints, regional floor and roof patterns, and nearby facade detail.',
      'Hotel Dixon, the Sahara arena, waterfront towers and the mural viaduct have rebuilt volumes. Regional porches, storefronts, roofs and service details add depth to the existing arrivals.',
      'Original articulated characters replace block figures and flat life collages. Walking feet and vehicle tyres follow the active street surfaces; Vice City and Ambrosia traffic use their selected arrival frames.',
      'Nearby trees use three-dimensional trunks and leaves, with photographic vegetation retained in the distance. Kalaga gains continuous local rock ridges and elevated forest.',
      'Outdoor image-based lighting, properly shaded clouds, traveling water normals and bounded streetlight pools improve the six regional atmospheres.',
      'GTADB positions and attribution remain intact. Unmeasured architecture and local relief stay APPROXIMATE; this is a browser reconstruction, not the original game world or its assets.',
    ],
    verification: [
      '503 unit and integration tests passed, including streaming, geometry, contact, source-coordinate, actor and water lifecycle checks. TypeScript, ESLint and the production build passed.',
      'Chromium rendered all six regions and a reverse Vice City view without reported application or shader errors. Additional isolated captures checked the rebuilt landmarks, actors and clouds.',
      'Draw calls and triangles were recorded. The test machine uses SwiftShader software rendering, so these checks do not establish a hardware frame-rate guarantee.',
    ],
  },
  {
    version: 'v0.6.2',
    date: '2026-09-06',
    title: 'Public collaboration and security hardening',
    summary:
      'Community contribution workflows, protected pull requests, validated dependency updates and continuous security scanning.',
    status: 'public',
    highlights: [
      'The public repository now includes contribution guidelines, a code of conduct, issue forms, a pull-request template and private vulnerability reporting.',
      'The main branch requires a successful Quality check and resolved conversations, keeps linear history, and blocks force pushes and branch deletion.',
      'Dependabot groups compatible updates, keeps Node type definitions on Node 22 and avoids unrelated lockfile downgrades.',
      'GitHub Actions use pinned revisions and read-only default permissions. Secret scanning, push protection and CodeQL continuously inspect the repository.',
      'Public map data, coordinates, licensing, account boundaries and local-first behavior are unchanged.',
    ],
    verification: [
      'Frozen installation, strict TypeScript, lint, 458 unit/integration tests and the production build passed.',
      'The Chromium browser suite passed after the public collaboration and dependency updates.',
      'CodeQL completed both analyses with no findings. GitHub reported no unresolved secrets or dependency vulnerabilities, and Git integrity checks found no corruption.',
    ],
  },
  {
    version: 'v0.6.1',
    date: '2026-09-05',
    title: 'Visitor measurement and release history',
    summary: 'Consent-based visitor measurement and an About page with every release since v0.5.0.',
    status: 'public',
    highlights: [
      'Visitors can allow or decline audience measurement and change their choice in About. Accepted visits use a separate random browser identifier; personal Atlas data stays isolated from Analytics.',
      'About lists the current version and earlier releases, with dates and a short description of each update.',
      'The changelog retains the complete history from v0.5.0, ordered from newest to oldest.',
      'GitHub publication preserves existing releases and restores missing historical entries without replacing the latest version.',
    ],
    verification: [
      'TypeScript, lint, release-history rendering and publication lifecycle tests passed.',
      'About and changelog links were checked in desktop and mobile browsers.',
      'Google accepted consented test visits with stable browser and session identifiers. Consent withdrawal, origin isolation and cross-tab changes were checked; the private Analytics dashboard is outside this verification.',
    ],
  },
  {
    version: 'v0.6.0',
    date: '2026-09-05',
    title: 'Account workspaces and selected 3D destinations',
    summary:
      'Isolated account workspaces and a private official account service, with the selected map destination preserved when entering the 3D explorer.',
    status: 'public',
    highlights: [
      'React, Vite and strict TypeScript replace the Astro shell and build. Static hosting requires no CMS, parent website, account or private API.',
      'The calibrated Leaflet CRS.Simple map supports search, intersecting filters, ordered layers, zoom rules, bounded spatial clustering and source details.',
      'Dexie / IndexedDB stores favorites, notes, collections, markers and preferences with schema upgrades, transactional saves, cross-tab updates and stale-draft protection.',
      'The personal marker editor supports create, edit, move and delete. Versioned backups are validated and previewed before an atomic merge.',
      'Offline caching preserves the app shell, public catalogue and basemap after a complete online load. Optional 3D assets are cached as visited with bounded storage.',
      'Selected map coordinates now initialize the 3D world. Ambrosia, Leonida Keys and individual places keep their destinations; rapid map/explorer transitions clean up pending map animations.',
      'Local guest and account workspaces stay separate. Queued writes, stale reads and backup operations cannot silently cross an account transition.',
      'The existing Three.js reconstruction loads on demand, with desktop and touch controls, regional travel, evidence panels and a fallback when WebGL is unavailable.',
      'The official instance supplies email/username registration, secure sessions and explicit server backups through a separate private service. Public forks remain fully usable as guests; Analytics stays isolated and deployment-configured.',
      'GTADB / Map GTA attribution and CC BY 4.0 data licensing are retained: 2,198 source records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placement remains APPROXIMATE and absent coverage UNKNOWN.',
    ],
    verification: [
      'Frozen installation, strict types, lint, unit/integration tests, static build and isolated public-fork checks passed.',
      'Desktop Chromium and mobile WebKit exercise map and local-data flows. WebKit offline-navigation is explicitly skipped when its automation runtime fails; Chromium verifies offline reopening and selected 3D spawning.',
      'An isolated subdirectory build verified map data, saved markers, project links, historical routes, 3D assets and service-worker scope. The standalone Nginx container passed the browser suite.',
      'Dependency audit and peer checks passed. Analytics isolation and emitted offline-worker boundaries were verified; the full scope and limitations are in docs/refactor/VERIFICATION.md.',
    ],
  },
  {
    version: 'v0.5.0',
    date: '2026-09-05',
    title: 'Standalone local-first Atlas',
    summary:
      'A standalone map workspace with local favorites, notes, collections, personal markers and portable backups, plus an optional 3D explorer.',
    status: 'public',
    highlights: [
      'React, Vite and strict TypeScript replace the Astro shell and build. Static hosting requires no CMS, parent website, account or private API.',
      'The calibrated Leaflet CRS.Simple map supports search, intersecting filters, ordered layers, zoom rules, bounded spatial clustering and source details.',
      'Dexie / IndexedDB stores favorites, notes, collections, markers and preferences with schema upgrades, transactional saves, cross-tab updates and stale-draft protection.',
      'The personal marker editor supports create, edit, move and delete. Versioned backups are validated and previewed before an atomic merge.',
      'Offline caching preserves the app shell, public catalogue and basemap after a complete online load. Optional 3D assets are cached as visited with bounded storage.',
      'The existing Three.js reconstruction loads on demand, with desktop and touch controls, regional travel, evidence panels and a fallback when WebGL is unavailable.',
      'Public forks work as guests without credentials. Account and cloud-sync contracts remain optional; Analytics is isolated and enabled only by deployment configuration.',
      'GTADB / Map GTA attribution and CC BY 4.0 data licensing are retained: 2,198 source records, including 2,091 positioned and 107 unpositioned entries, plus six regions. Community placement remains APPROXIMATE and absent coverage UNKNOWN.',
    ],
    verification: [
      'Frozen installation, strict types, lint, unit/integration tests, static build and isolated public-fork checks passed.',
      'Desktop Chromium and mobile WebKit passed 17 browser cases; one WebKit offline-navigation case is explicitly skipped when its automation runtime fails. Chromium verifies offline reopening.',
      'An isolated subdirectory build verified map data, saved markers, project links, historical routes, 3D assets and service-worker scope. The standalone Nginx container passed the browser suite.',
      'Dependency audit and peer checks passed. Analytics isolation and emitted offline-worker boundaries were verified; the full scope and limitations are in docs/refactor/VERIFICATION.md.',
    ],
  },
] as const;

export const latestLeonidaAtlasRelease = LEONIDA_ATLAS_RELEASES[0]!;
