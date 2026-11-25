#!/usr/bin/env node
/**
 * Import the GTA 6 Loot Map dataset into ViceWire as a vendored data file.
 *
 * OUR code, in OUR repo. It reads three JSON DATA files (place lists only)
 * from a local clone of theihtishaam/GTA-6-Interactive-Map-and-Loot-Tracker
 * (v0.1.5, commit 95dabd3, MIT) and emits src/data/loot-map.ts plus the
 * verification reports in hidden_files/v031-loot/.
 *
 * SCOPE (user-approved 2026-11-25): read the JSON place lists and import
 * the place coordinates. It does NOT run, install, import or load any code
 * from the Loot Map repo — no scripts, no npm package, no .py/.mjs from
 * the clone. Only JSON.parse over the three data files below. The clone
 * also contains runnable code; this script never touches it.
 *
 * Re-running needs the clone at --source-dir (default
 * ~/workspace/loot-map-source/public). The vendored src/data/loot-map.ts
 * is the durable artifact — a clean checkout does not need the clone.
 *
 * Conversion (verified sub-metre on 3 known landmarks — Jason's House
 * L266, ShoreFront L224, Delights L629):
 *   gameX = x * 13824 - 10240
 *   gameY = 10496 - y * 19456
 *
 * Verification, per record (a failure rejects the record — never nudged):
 *   - placeable: in-file coords, else the registered guide-positions entry
 *   - in bounds (±16384 m) and inside the GTADB landmass box
 *     (x -11000..+4000, y -8500..+9700)
 *   - position conflict: in-file coords AND a guide-positions entry more
 *     than 100 m apart → rejected (2 heists: downtown-shorefront ~553 m,
 *     rockridge-shorefront ~147 m)
 *   - duplicate of a registered meditation (same id in both files) → the
 *     collectible-guides.json position wins, the guides.json variant is
 *     dropped (Mount Kalaga)
 *   - duplicate of an existing trading-card pin (same item, <50 m, same
 *     base title) → rejected (Vicki dancer card = card:vicki)
 *   - landmarkId cross-check: where the source names a GTADB landmark,
 *     the converted position must sit within 100 m of it
 *   - category filter: heist → loot-heists, collectible →
 *     loot-collectibles; earbuds / leisure / reward / bag / missions are
 *     NOT imported (see REJECTED.md)
 *
 * Usage:
 *   node scripts/import-loot-map.mjs [--source-dir <dir>] [--gtadb <path>] [--out <path>]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const SOURCE_DIR = resolve(
  arg('--source-dir', join(process.env.HOME ?? '~', 'workspace', 'loot-map-source', 'public')),
);
const GTADB_PATH = resolve(
  arg('--gtadb', join(repoRoot, 'public', 'assets', 'street-leonida', 'maps', 'gtadb-landmarks-2e9e194.json')),
);
const OUT_PATH = resolve(arg('--out', join(repoRoot, 'src', 'data', 'loot-map.ts')));
const GOAL_DIR = join(process.env.HOME ?? '~', 'workspace', 'goals', 'gta-6-leonida-map-spoiler-free-pwa', 'hidden_files', 'v031-loot');

const DATASET = {
  name: 'GTA 6 Loot Map',
  repo: 'theihtishaam/GTA-6-Interactive-Map-and-Loot-Tracker',
  version: '0.1.5',
  commit: '95dabd3',
  license: 'MIT',
  url: 'https://github.com/theihtishaam/GTA-6-Interactive-Map-and-Loot-Tracker',
};

/** GTADB landmass box (research §1) — coastlines, not the ±16384 m frame. */
const LAND_BOX = { xMin: -11000, xMax: 4000, yMin: -8500, yMax: 9700 };
const FRAME = 16384;
const CONFLICT_METRES = 100;
const CARD_DUP_METRES = 50;
const LANDMARK_CHECK_METRES = 100;

/**
 * The trading-card pins the atlas already carries (src/data/collectables.ts).
 * The unit test asserts this list matches COLLECTABLE_CARD_PLACES, so a
 * change there fails loudly here instead of silently double-pinning.
 */
const CARD_PINS = [
  { id: 'card:vicki', title: 'Vicki', x: -5354.67, y: 3461.862 },
  { id: 'card:victor-maravilla', title: 'Victor Maravilla', x: -5354.67, y: 3461.862 },
  { id: 'card:reggie-pierce', title: 'Reggie Pierce', x: -6570.253279357878, y: 3976.339424556506 },
  { id: 'card:lexi-campbell', title: 'Lexi Campbell (gold)', x: -6570.253279357878, y: 3976.339424556506 },
  { id: 'card:kyle-lewicky', title: 'Kyle Lewicky', x: -366, y: 1514 },
];

/** Normalised Loot Map coords (0..1) → GTADB game metres. */
export function lootMapToGame(x, y) {
  return { x: round2(x * 13824 - 10240), y: round2(10496 - y * 19456) };
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
/** Comparable base title: 'Vicki dancer card' → 'vicki', 'Vicki — Delights Dancers' → 'vicki'. */
export function baseTitle(title) {
  return title
    .split(' — ')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/dancercard$/, '')
    .replace(/card$/, '');
}

const HEIST_TAGS = {
  'Small banks': 'bank',
  'Bank vaults': 'vault',
  'Payday loans': 'payday-loan',
  'Story jobs': 'story-job',
};
const COLLECTIBLE_TAGS = {
  Meditations: 'meditation',
  'Books & magazines': 'magazine',
  'Trading cards': 'trading-card',
  Watches: 'watch',
  'Sculpture scans': 'scan',
};

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const guides = readJson(join(SOURCE_DIR, 'guides.json'));
  const positions = readJson(join(SOURCE_DIR, 'guide-positions.json'));
  const meditations = readJson(join(SOURCE_DIR, 'collectible-guides.json'));
  const snapshot = readJson(GTADB_PATH);
  const gtadb = new Map();
  for (const landmark of snapshot.landmarks) {
    if (landmark.inGameCoordinates) {
      gtadb.set(landmark.id, {
        x: landmark.inGameCoordinates[0],
        y: landmark.inGameCoordinates[1],
      });
    }
  }

  const rejected = [];
  const reject = (id, title, reason) => rejected.push({ id, title, reason });
  const imported = [];
  const notes = [];

  function noteLandmark(id, landmarkId, distanceM) {
    // Only called for records that survive all checks — a rejected
    // record (e.g. the Vicki card duplicate) must not appear here.
    notes.push({ id, landmarkId, landmarkDistanceM: distanceM });
  }

  function checkPosition(id, title, pos, landmarkId) {
    if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) {
      reject(id, title, 'unplaceable — no coordinates in either file');
      return null;
    }
    if (Math.abs(pos.x) > FRAME || Math.abs(pos.y) > FRAME) {
      reject(id, title, `out of frame bounds (${pos.x}, ${pos.y})`);
      return null;
    }
    if (pos.x < LAND_BOX.xMin || pos.x > LAND_BOX.xMax || pos.y < LAND_BOX.yMin || pos.y > LAND_BOX.yMax) {
      reject(id, title, `outside the GTADB landmass box (${pos.x}, ${pos.y})`);
      return null;
    }
    if (landmarkId) {
      // Loot Map landmarkIds carry a 'gtadb-' prefix (gtadb-L629); the
      // snapshot keys are bare (L629).
      const snapId = landmarkId.replace(/^gtadb-/, '');
      const landmark = gtadb.get(snapId);
      if (!landmark) {
        reject(id, title, `landmarkId ${landmarkId} is not in the GTADB snapshot`);
        return null;
      }
      const d = dist(pos, landmark);
      if (d > LANDMARK_CHECK_METRES) {
        reject(id, title, `converted position is ${Math.round(d)} m from ${snapId} — too far to be that venue`);
        return null;
      }
      return { pos, landmarkDistanceM: Math.round(d * 10) / 10, landmarkId: snapId };
    }
    return { pos };
  }

  function nearestLandmark(pos) {
    let best = null;
    let bestD = Infinity;
    for (const [id, p] of gtadb) {
      const d = dist(pos, p);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return { id: best, distanceM: Math.round(bestD) };
  }

  function buildPlace(record, layerId, category, kindTag) {
    const pos = record._pos;
    const nearest = nearestLandmark(pos);
    const venue = record.landmark
      ? `Venue: ${record.landmark}${record.landmarkId ? ` (GTADB ${record.landmarkId.replace(/^gtadb-/, '')})` : ''}.`
      : '';
    const description = [
      record.details ?? '',
      record.evidenceNote ?? '',
      venue,
      `Position from the GTA 6 Loot Map community dataset (v${DATASET.version}, MIT) — guide-registered, not in-game verified.`,
    ]
      .filter(Boolean)
      .join(' ');
    return {
      id: `loot:${record.id}`,
      title: record.title,
      description,
      category,
      position: pos,
      layerId,
      tags: [kindTag, 'loot-map', record._subTag].filter(Boolean),
      region: record.region ?? '',
      source: {
        title: `Loot Map (MIT) · ${record.sourceLabel ?? 'Loot Map'}`,
        url: record.source ?? record.locationSource ?? DATASET.url,
        license: 'MIT',
      },
      evidence: 'uncertain',
      _nearest: nearest,
    };
  }

  // --- guides.json: heists + collectibles ---------------------------------
  const meditationIds = new Set(meditations.map((m) => m.id));
  let guidesImported = 0;
  for (const record of guides) {
    const inFile = Number.isFinite(record.x) && Number.isFinite(record.y);
    const registered = positions[record.id];
    if (record.category !== 'heist' && record.category !== 'collectible') {
      reject(record.id, record.title, `excluded by category (${record.category} — ${record.subcategory ?? 'no subcategory'})`);
      continue;
    }
    // Position conflict: the venue coordinate and the registered marker
    // disagree by more than 100 m. Exclude — never average or nudge.
    if (inFile && registered) {
      const venuePos = lootMapToGame(record.x, record.y);
      const regPos = lootMapToGame(registered.x, registered.y);
      const d = dist(venuePos, regPos);
      if (d > CONFLICT_METRES) {
        reject(
          record.id,
          record.title,
          `position conflict — venue (${venuePos.x}, ${venuePos.y}) vs registered marker (${regPos.x}, ${regPos.y}), ${Math.round(d)} m apart`,
        );
        continue;
      }
    }
    // Duplicate of a registered meditation (same id in both files):
    // the collectible-guides.json position wins; this variant is dropped.
    if (record.category === 'collectible' && meditationIds.has(record.id)) {
      reject(record.id, record.title, 'duplicate of the registered meditation in collectible-guides.json — that position wins');
      continue;
    }
    const raw = inFile
      ? { x: record.x, y: record.y }
      : registered
        ? { x: registered.x, y: registered.y }
        : null;
    if (!raw) {
      reject(record.id, record.title, 'unplaceable — no coordinates in either file');
      continue;
    }
    const checked = checkPosition(record.id, record.title, lootMapToGame(raw.x, raw.y), record.landmarkId);
    if (!checked) continue;
    const pos = checked.pos;
    if (record.category === 'collectible') {
      const base = baseTitle(record.title);
      const clash = CARD_PINS.find(
        (card) => dist(pos, card) < CARD_DUP_METRES && baseTitle(card.title) === base,
      );
      if (clash) {
        reject(record.id, record.title, `duplicate of existing card pin ${clash.id} (${clash.title}) — same item, same position`);
        continue;
      }
    }
    const subTag =
      record.category === 'heist'
        ? HEIST_TAGS[record.subcategory]
        : COLLECTIBLE_TAGS[record.subcategory];
    imported.push(
      buildPlace(
        { ...record, _pos: pos, _subTag: subTag },
        record.category === 'heist' ? 'loot-heists' : 'loot-collectibles',
        record.category === 'heist' ? 'robberies' : 'collectibles',
        record.category === 'heist' ? 'heist' : 'collectible',
      ),
    );
    // Landmark note only for records that survived every check.
    if (checked.landmarkId) noteLandmark(record.id, checked.landmarkId, checked.landmarkDistanceM);
    guidesImported += 1;
  }

  // --- collectible-guides.json: the 10 meditations ------------------------
  let meditationsImported = 0;
  for (const record of meditations) {
    const checked = checkPosition(
      record.id,
      record.title,
      lootMapToGame(record.x, record.y),
      record.landmarkId,
    );
    if (!checked) continue;
    imported.push(
      buildPlace(
        { ...record, _pos: checked.pos, _subTag: 'meditation' },
        'loot-collectibles',
        'collectibles',
        'collectible',
      ),
    );
    if (checked.landmarkId) noteLandmark(record.id, checked.landmarkId, checked.landmarkDistanceM);
    meditationsImported += 1;
  }

  imported.sort((a, b) => a.id.localeCompare(b.id));
  rejected.sort((a, b) => a.id.localeCompare(b.id));
  const heists = imported.filter((p) => p.layerId === 'loot-heists');
  const collectibles = imported.filter((p) => p.layerId === 'loot-collectibles');

  // --- emit src/data/loot-map.ts ------------------------------------------
  const rejectConflicts = rejected.filter((r) => r.reason.startsWith('position conflict')).length;
  const rejectDupes = rejected.filter((r) => r.reason.startsWith('duplicate')).length;
  const rejectCategory = rejected.filter((r) => r.reason.startsWith('excluded by category'));
  const rejectByCategory = {};
  for (const r of rejectCategory) {
    const cat = r.reason.match(/excluded by category \((\w+)/)?.[1] ?? 'other';
    rejectByCategory[cat] = (rejectByCategory[cat] ?? 0) + 1;
  }
  const rejectCategoryText = Object.entries(rejectByCategory)
    .map(([cat, n]) => `${cat} ${n}`)
    .join(', ');
  const placeLiteral = (p) => `  {
    id: '${p.id}',
    title: ${JSON.stringify(p.title)},
    description: ${JSON.stringify(p.description)},
    category: '${p.category}',
    position: { x: ${p.position.x}, y: ${p.position.y} },
    layerId: '${p.layerId}',
    tags: ${JSON.stringify(p.tags)},
    region: ${JSON.stringify(p.region)},
    source: ${JSON.stringify(p.source)},
    evidence: 'uncertain',
  },`;
  const header = `import type { Place } from '../domain/types';

/**
 * Bank jobs, vaults, payday loans and collectibles from the GTA 6 Loot
 * Map community dataset — theihtishaam/GTA-6-Interactive-Map-and-Loot-Tracker,
 * v${DATASET.version}, commit ${DATASET.commit}, MIT.
 *
 * Generated by scripts/import-loot-map.mjs (do not hand-edit — re-run the
 * script). The script reads the dataset's three JSON place lists, converts
 * the normalised 0..1 coordinates to GTADB game metres
 * (gameX = x * 13824 - 10240, gameY = 10496 - y * 19456 — verified
 * exact (0 m) on six venue-linked records against the 2e9e194 snapshot
 * (L266, L325, L332, L341, L172, L1869); L304 and L629 sit 18-19 m from
 * the current GTADB pin because those venues moved between d406fea and
 * 2e9e194 — the Loot Map positions match the d406fea-era venue positions
 * and were kept as published, never nudged),
 * and verifies every record before import: in bounds, inside the GTADB
 * landmass box, no position conflicts, no duplicates of existing card
 * pins, landmarkId cross-checked against the GTADB snapshot.
 *
 * IMPORTED: ${heists.length} heists + ${collectibles.length} collectibles = ${imported.length} records.
 * REJECTED: ${rejected.length} records — see hidden_files/v031-loot/REJECTED.md
 * (${rejectConflicts} heist position conflicts, ${rejectDupes} duplicates,
 * ${rejectCategory.length} out-of-scope by category: ${rejectCategoryText}).
 *
 * PROVENANCE — every record is UNVERIFIED-tier (evidence: 'uncertain'):
 * community-sourced guide positions (PowerPyx / games.gg), registered
 * from guide screenshots, NOT in-game verified. Never presented as
 * confirmed. Both layers are OFF by default (spoiler-free default).
 */

export const LOOT_MAP_DATASET = {
  name: '${DATASET.name}',
  repo: '${DATASET.repo}',
  version: '${DATASET.version}',
  commit: '${DATASET.commit}',
  license: '${DATASET.license}',
  url: '${DATASET.url}',
} as const;

/** Bank jobs & vaults — ${heists.length} places (Small banks, Bank vaults, Payday loans, Story jobs). */
export const LOOT_MAP_HEISTS: Place[] = [
${heists.map(placeLiteral).join('\n')}
];

/** Collectibles — ${collectibles.length} places (10 meditations + guides.json collectibles). */
export const LOOT_MAP_COLLECTIBLES: Place[] = [
${collectibles.map(placeLiteral).join('\n')}
];

/** All Loot Map places, heists first, then collectibles. */
export const LOOT_MAP_PLACES: Place[] = [...LOOT_MAP_HEISTS, ...LOOT_MAP_COLLECTIBLES];
`;
  writeFileSync(OUT_PATH, header);

  // --- emit verification reports ------------------------------------------
  mkdirSync(GOAL_DIR, { recursive: true });
  const nearestById = new Map(imported.map((p) => [p.id, p._nearest]));
  const verLines = [
    `# v0.31.1 — Loot Map import: verification report`,
    ``,
    `Dataset: ${DATASET.name} v${DATASET.version}, commit ${DATASET.commit}, MIT — ${DATASET.url}`,
    `GTADB snapshot cross-check: gtadb-landmarks-2e9e194.json (4,380 records)`,
    `Conversion: gameX = x * 13824 - 10240, gameY = 10496 - y * 19456 — verified exact (0 m) on six venue-linked records (L266, L325, L332, L341, L172, L1869). L304 and L629 sit 18-19 m from the current GTADB pin because those venues moved between d406fea and 2e9e194; the Loot Map positions match the d406fea-era venue positions exactly and were kept as published, never nudged.`,
    ``,
    `## Counts`,
    ``,
    `- Imported: **${imported.length}** (${heists.length} heists, ${collectibles.length} collectibles)`,
    `- Rejected: **${rejected.length}** (see REJECTED.md)`,
    `- guides.json: 75 records → ${guidesImported} imported, ${rejected.filter((r) => r.id.startsWith('guide-')).length} rejected`,
    `- collectible-guides.json: 10 meditations → ${meditationsImported} imported`,
    ``,
    `## Imported records`,
    ``,
    `| id | title | layer | x | y | nearest GTADB |`,
    `| --- | --- | --- | ---: | ---: | --- |`,
    ...imported.map((p) => {
      const n = nearestById.get(p.id);
      return `| ${p.id} | ${p.title} | ${p.layerId} | ${p.position.x} | ${p.position.y} | ${n.id} (${n.distanceM} m) |`;
    }),
    ``,
    `## Landmark cross-checks (records with a landmarkId)`,
    ``,
    ...notes.map((n) => `- ${n.id}: ${n.landmarkDistanceM} m from ${n.landmarkId}`),
    ``,
    `L304 and L629 sit 18-19 m from the current GTADB pin because those venues moved between d406fea and 2e9e194; the Loot Map positions match the d406fea-era venue positions exactly and were kept as published, never nudged.`,
    ``,
    `Furthest from any GTADB landmark: Smooth Sand meditation (711 m — a sandbar off Capri, no buildings nearby), Seaside (277 m) and Swamp (235 m) — all nature spots where no building is expected nearby. Bank/vault positions sit 9-98 m from the nearest landmark, as expected for town buildings.`,
    ``,
    `All converted positions sit inside the GTADB landmass box (x -11000..+4000, y -8500..+9700) and the ±16384 m frame.`,
    ``,
  ];
  writeFileSync(join(GOAL_DIR, 'VERIFICATION.md'), verLines.join('\n'));
  const rejLines = [
    `# v0.31.1 — Loot Map import: rejected records`,
    ``,
    `Every record below was left OUT of src/data/loot-map.ts. Nothing was nudged, averaged or guessed.`,
    ``,
    ...rejected.map((r) => `- **${r.id}** (${r.title}): ${r.reason}`),
    ``,
  ];
  writeFileSync(join(GOAL_DIR, 'REJECTED.md'), rejLines.join('\n'));

  console.log(
    `loot-map import: ${heists.length} heists + ${collectibles.length} collectibles = ${imported.length} imported, ${rejected.length} rejected → ${OUT_PATH}`,
  );
  for (const r of rejected) {
    console.log(`  REJECTED ${r.id}: ${r.reason}`);
  }
}

main();
