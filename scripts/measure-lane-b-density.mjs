// ViceWire v0.33 Lane B — headless density measurement (real catalogue,
// the exact functions MapView calls: querySpatialIndex, selectHeroPlaces,
// clusterPlaces, pinFormForPlace, isPlainResidential).
//
// Why headless for the "set on" column: no UI route solos a single card
// set until Lane C builds set drive mode (the filter sheet has no
// cards:* toggles; Collections has no set-level "Show on map"), so the
// browser cannot produce the "only this set's layer visible" condition
// yet. The exemption itself is proven here on the real Delights
// positions through the same code path MapView uses, and the
// everything-on column is cross-checked against the live browser demo
// (scripts/check-v033-lane-b.mjs) — if headless and browser agree on
// the All-on column, the headless set-on column is the same machinery.
//
//   npx tsx scripts/measure-lane-b-density.mjs
import { readFileSync } from 'node:fs';
import { catalogueFromSnapshot } from '../src/data/catalogue.ts';
import { DEFAULT_LAYERS } from '../src/features/map/layers.ts';
import {
  buildSpatialIndex,
  clusterPlaces,
  querySpatialIndex,
  selectHeroPlaces,
} from '../src/features/map/spatial.ts';
import {
  isPlainResidential,
  kindForPlace,
  pinFormForPlace,
} from '../src/features/map/place-icons.tsx';
import { isPlacePinnable } from '../src/features/map/pin-visibility.ts';
import { isPlaceVisible } from '../src/features/spoiler/visibility.ts';
import { INITIAL_BOUNDS } from '../src/features/map/coordinates.ts';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const places = catalogueFromSnapshot(snapshot);
console.log(`catalogue: ${places.length} places`);

const aiCategories = {};

function visibleSet(visibleLayerIds) {
  const layers = DEFAULT_LAYERS.map((l) => ({
    ...l,
    visible: visibleLayerIds === 'all' ? true : visibleLayerIds.includes(l.id),
  }));
  return places.filter(
    (p) => isPlaceVisible(p, layers) && isPlacePinnable(p, aiCategories),
  );
}

const index = buildSpatialIndex(places);

function screenSeparation(groups, zoom) {
  let min = Infinity;
  let minPair = null;
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const dx = (groups[i].position.x - groups[j].position.x) * Math.pow(2, zoom);
      const dy = (groups[i].position.y - groups[j].position.y) * Math.pow(2, zoom);
      const d = Math.hypot(dx, dy);
      if (d < min) {
        min = d;
        minPair = [groups[i].id, groups[j].id];
      }
    }
  }
  return { minPx: min === Infinity ? null : Math.round(min * 10) / 10, minPair };
}

function measure(label, visible, bounds, zoom, exemptLayerIds) {
  const inView = querySpatialIndex(index, bounds).filter((p) => visible.includes(p));
  const heroMode = zoom <= -2.5;
  const groups = heroMode
    ? selectHeroPlaces(inView, 24, exemptLayerIds).map((p) => ({
        id: p.id,
        position: p.position,
        places: [p],
      }))
    : clusterPlaces(inView, { zoom, enabled: true, maxMarkers: 120 }).slice(0, 120);
  let dots = 0;
  let dotClusters = 0;
  let clusters = 0;
  let allResClusters = 0;
  let mixedClusters = 0;
  let noResClusters = 0;
  let residentialInsideClusters = 0;
  let residentialAsDots = 0;
  for (const g of groups) {
    if (g.places.length > 1) {
      clusters++;
      const resCount = g.places.filter((m) => isPlainResidential(m, aiCategories[m.id])).length;
      residentialInsideClusters += resCount;
      if (resCount === g.places.length) allResClusters++;
      else if (resCount > 0) mixedClusters++;
      else noResClusters++;
      if (
        zoom < 0.5 &&
        g.places.every((m) => isPlainResidential(m, aiCategories[m.id]))
      )
        dotClusters++;
    } else if (pinFormForPlace(g.places[0], zoom, aiCategories[g.places[0].id]) === 'dot') {
      dots++;
      if (isPlainResidential(g.places[0], aiCategories[g.places[0].id])) residentialAsDots++;
    }
  }
  const sep = screenSeparation(groups, zoom);
  console.log(
    `${label} zoom=${zoom} hero=${heroMode} inView=${inView.length} markers=${groups.length} clusters=${clusters} (allRes=${allResClusters} mixed=${mixedClusters} noRes=${noResClusters}) dotClusters=${dotClusters} singleDots=${dots} (residential=${residentialAsDots}) residentialInsideClusters=${residentialInsideClusters} minSeparationPx=${sep.minPx} ${sep.minPair ? `(${sep.minPair.join(' / ')})` : ''}`,
  );
  return { inView: inView.length, markers: groups.length, clusters, dotClusters, dots, minSepPx: sep.minPx };
}

// ---- residential density by region (to pick the wall-of-houses viewport)
const residentialByRegion = new Map();
for (const p of places) {
  if (isPlainResidential(p) && p.position) {
    const key = p.region || '(no region)';
    residentialByRegion.set(key, (residentialByRegion.get(key) ?? 0) + 1);
  }
}
console.log('--- named plain-residential places by region (top 12) ---');
for (const [region, n] of [...residentialByRegion.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${n}  ${region}`);
}
const totalResidential = [...residentialByRegion.values()].reduce((a, b) => a + b, 0);
console.log(`total plain-residential with a position: ${totalResidential} (named + untyped "?" — see split below)`);
// How much of the wall is "?" (Lane A already removed it) vs named (this lane dots it)?
import { isUnnamedPlace } from '../src/domain/types.ts';
let namedRes = 0;
let unnamedRes = 0;
for (const p of places) {
  if (isPlainResidential(p) && p.position) {
    if (isUnnamedPlace(p)) unnamedRes++;
    else namedRes++;
  }
}
console.log(`  of which named (pinnable on a fresh profile): ${namedRes}; untyped "?" (no pin until the index job types them): ${unnamedRes}`);
const rialtoRes = places.filter((p) => p.region === 'Rialto Islands' && isPlainResidential(p) && p.position);
console.log(`  Rialto Islands: ${rialtoRes.length} plain-residential, ${rialtoRes.filter((p) => !isUnnamedPlace(p)).length} named / ${rialtoRes.filter((p) => isUnnamedPlace(p)).length} "?"`);

// ---- (a) Delights Dancers soloed — the set-drive exemption
// The set has 5 pinned slots, but only 4 live in its cards:* layer:
// the 5th (Harley dancer card, loot:guide-harley-card) is a
// loot-collectibles member — a set-drive solo of cards:delights-dancers
// alone shows 4, and Harley is the Lane C decision (does a set drive
// also turn on the set's loot-collectibles members?).
const delights = visibleSet(['cards:delights-dancers']);
console.log(`--- (a) Delights soloed (cards:* layer only): ${delights.length} pinned ---`);
console.log('  pins:', delights.map((p) => `${p.id} @${Math.round(p.position.x)},${Math.round(p.position.y)}`).join(' | '));
const harley = places.find((p) => p.id === 'loot:guide-harley-card');
console.log(`  5th pinned slot (loot-collectibles, NOT in the soloed layer): ${harley.id} @${Math.round(harley.position.x)},${Math.round(harley.position.y)} — in the same 2200-cell as Vicki/Jason`);
measure('(a) island   ', delights, INITIAL_BOUNDS, -5, new Set(['cards:delights-dancers']));
measure('(a) district ', delights, INITIAL_BOUNDS, -1, new Set(['cards:delights-dancers']));
measure('(a) street   ', delights, INITIAL_BOUNDS, 0.5, new Set(['cards:delights-dancers']));
measure('(a) island, NO exemption (control)', delights, INITIAL_BOUNDS, -5, new Set());
// (a2) Delights + loot-collectibles on (5 pins incl. Harley): two layers
// visible, so the soloed-set condition does NOT hold — the hero collapse
// applies, and Vicki/Jason/Harley (one cell) collapse to one hero pin.
const delightsPlusLoot = visibleSet(['cards:delights-dancers', 'loot-collectibles']);
console.log(`--- (a2) Delights + loot-collectibles: ${delightsPlusLoot.length} visible incl. Harley ---`);
measure('(a2) island, two layers (no exemption)', delightsPlusLoot, INITIAL_BOUNDS, -5, new Set());

// ---- (b) everything on
const all = visibleSet('all');
console.log(`--- (b) All on: ${all.length} visible (fresh profile, untyped "?" excluded) ---`);
measure('(b) island   ', all, INITIAL_BOUNDS, -5, new Set());
measure('(b) district ', all, INITIAL_BOUNDS, -1, new Set());
// Street zoom is viewport-scoped in reality (390px shows ~276 units at
// zoom 0.5) — a whole-island street-zoom count is not what the player
// sees. Measure it over the two demo viewports instead.
const gellhornBounds = { west: -6800, east: -5100, south: 3100, north: 4200 };
const rialtoBounds = { west: -400, east: 1500, south: 900, north: 1600 };
measure('(b) street, Port Gellhorn viewport', all, gellhornBounds, 0.5, new Set());
measure('(b) street, Rialto viewport      ', all, rialtoBounds, 0.5, new Set());
measure('(b) district, Rialto viewport    ', all, rialtoBounds, -1, new Set());

// ---- (c) Port Gellhorn street viewport — the 5-kinds side-by-side shot
// Viewport ~780 game units wide centred on the Starlet Motel / Delights
// strip (x -6800..-5100, y 3100..4200): at zoom 0.5 the 390px screen
// shows ~276 units, so this viewport is what a street-zoom pan covers.const gellhorn = { west: -6800, east: -5100, south: 3100, north: 4200 };
const gellhornPlaces = querySpatialIndex(index, gellhornBounds).filter((p) => all.includes(p));
const gGroups = clusterPlaces(gellhornPlaces, { zoom: 0.5, enabled: true, maxMarkers: 120 }).slice(0, 120);
const kinds = new Map();
for (const g of gGroups) {
  for (const p of g.places) {
    const kind = kindForPlace(p) ?? p.layerId;
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
}
console.log(`--- (c) Port Gellhorn street viewport (zoom 0.5): ${gGroups.length} markers, kinds: ${[...kinds.entries()].map(([k, n]) => `${k}×${n}`).join(', ')} ---`);
for (const g of gGroups) {
  const p = g.places[0];
  console.log(`  ${g.places.length > 1 ? `cluster×${g.places.length}` : 'single'} ${p.id} [${kindForPlace(p) ?? p.layerId}] "${p.title}" @${Math.round(p.position.x)},${Math.round(p.position.y)}`);
}

// ---- Rialto street viewport listing (wall-of-houses verdict at street zoom)
const rGroups = clusterPlaces(
  querySpatialIndex(index, rialtoBounds).filter((p) => all.includes(p)),
  { zoom: 0.5, enabled: true, maxMarkers: 120 },
).slice(0, 120);
const rKinds = new Map();
for (const g of rGroups) {
  for (const p of g.places) {
    const kind = kindForPlace(p) ?? p.layerId;
    rKinds.set(kind, (rKinds.get(kind) ?? 0) + 1);
  }
}
console.log(`--- Rialto street viewport (zoom 0.5): ${rGroups.length} markers, kinds: ${[...rKinds.entries()].map(([k, n]) => `${k}×${n}`).join(', ')} ---`);
for (const g of rGroups) {
  const p = g.places[0];
  console.log(`  ${g.places.length > 1 ? `cluster×${g.places.length}` : 'single'} ${p.id} [${kindForPlace(p) ?? p.layerId}] "${p.title}" @${Math.round(p.position.x)},${Math.round(p.position.y)}`);
}
