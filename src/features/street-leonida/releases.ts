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
