import type { LayerDefinition, Place } from '../../domain/types';
import { COLLECTABLE_CARD_PLACES, COLLECTABLE_SETS } from '../../data/collectables';

/**
 * Spoiler-free fork: every public layer starts OFF. The map opens as a blank
 * Leonida basemap; nothing is shown until the user turns a layer on.
 * "My markers" stays on — those are the user's own notes, never spoilers.
 *
 * Layer counts below are the verified counts at GTADB revision d406fea
 * (3,754 records), computed by catalogueFromSnapshot and asserted in
 * tests/unit/atlas-spoiler-free.test.ts. Uncertain GTADB records stay in
 * 'uncertain' whatever their tags say, so the interiors/shops/lootable
 * counts are the certain subset only.
 *
 * `order` does double duty: the Layers list shows highest first, and the
 * map draws highest last (on top). So the order below IS the list order:
 * the useful layers first, trading-card sets last (order 1-18).
 */
const CARD_PIN_COUNTS = new Map<string, number>();
for (const card of COLLECTABLE_CARD_PLACES) {
  const setId = card.layerId.slice('cards:'.length);
  CARD_PIN_COUNTS.set(setId, (CARD_PIN_COUNTS.get(setId) ?? 0) + 1);
}

export const DEFAULT_LAYERS: LayerDefinition[] = [
  {
    id: 'regions',
    name: 'Named regions',
    description: 'Official names with approximate community positions.',
    category: 'reference',
    visible: false,
    order: 45,
    source: 'Rockstar Games / GTADB',
    style: { color: '#f2d897', radius: 9 },
    icon: 'region',
    interactive: true,
  },
  {
    id: 'community',
    name: 'Community places',
    description: 'Named community records; placement remains approximate.',
    category: 'community',
    visible: false,
    order: 50,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#73cbbb', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'interiors',
    name: 'Interiors / Enterable',
    description:
      'Enterable buildings from GTADB with confirmed names — 81 here; the other 304 of the 385 enterable records are unverified and stay in Unverified places.',
    category: 'activity',
    visible: false,
    order: 80,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#e8b64c', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'shops',
    name: 'Shops & services',
    description:
      '39 shops with confirmed names, by type — search #gas, #clothes, #guns, #supermarket and more. Robbable shops live in Lootable buildings.',
    category: 'activity',
    visible: false,
    order: 70,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#7ec8e3', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'lootable',
    name: 'Lootable buildings',
    description:
      '52 enterable shops that can be held up — most small stores can be robbed; safes and alarms vary by store. Ammu-Nation cannot be robbed.',
    category: 'activity',
    visible: false,
    order: 90,
    source: 'GTADB / Map GTA · CC BY 4.0; robbery guidance: The Games Wiki',
    style: { color: '#ff5c5c', radius: 7 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'gyms',
    name: 'Gyms / Strength',
    description:
      'Member gyms in Vice City. 8 gyms; 2 have no verified coordinates yet. House gyms and workout gear inside houses are not in the public data yet — add your own marker when you find one.',
    category: 'activity',
    visible: false,
    order: 60,
    source: 'GTA6 GPS / PowerPyx · approximate',
    style: { color: '#ff8a5c', radius: 7 },
    icon: 'gym',
    interactive: true,
  },
  {
    id: 'gyms-outdoor',
    name: 'Free outdoor equipment',
    description:
      'Free public workout gear — Muscle Sands beach gym and Jason’s house deck (Chapter 1 only). No other outdoor spots have a verified position yet.',
    category: 'activity',
    visible: false,
    order: 55,
    source: 'GTA6 GPS / GTADB · approximate',
    style: { color: '#7ddb8a', radius: 7 },
    icon: 'gym',
    interactive: true,
  },
  {
    id: 'uncertain',
    name: 'Unverified places',
    description:
      'Places with no confirmed name or use yet — kept off so they don’t fill the map. Turn on only if you want to see them.',
    category: 'community',
    visible: false,
    order: 30,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#cba980', radius: 5 },
    icon: 'question',
    interactive: true,
  },
  {
    id: 'personal',
    name: 'My markers',
    description: 'Your own local map annotations.',
    category: 'personal',
    visible: true,
    order: 52,
    source: 'Your local atlas',
    style: { color: '#c9a9ef', radius: 8 },
    icon: 'pin',
    interactive: true,
  },
  ...COLLECTABLE_SETS.map((set, index) => ({
    id: `cards:${set.id}`,
    name: `Cards · ${set.name}`,
    description: `${set.size} cards in the set · ${CARD_PIN_COUNTS.get(set.id) ?? 0} verified pin(s) so far — the rest have no verified position yet.`,
    category: 'collectible',
    visible: false,
    order: 1 + index,
    source: 'GTA6Info / PowerPyx · approximate',
    style: { color: '#d98cb3', radius: 6 },
    icon: 'pin',
    interactive: true,
  })),
];

/**
 * Spoiler gate for search and results: a public place is only listed when its
 * layer is turned on. Personal markers are always listed — they are the
 * user's own notes.
 */
export function filterByVisibleLayers(
  places: readonly Place[],
  layers: readonly LayerDefinition[],
): Place[] {
  const visible = new Set(
    layers.filter((layer) => layer.visible).map((layer) => layer.id),
  );
  return places.filter(
    (place) => place.layerId === 'personal' || visible.has(place.layerId),
  );
}

/** Unpositioned records remain available to the catalogue; the spatial index omits them. */
export function getVisiblePlaces(
  places: readonly Place[],
  layers: readonly LayerDefinition[],
  zoom?: number,
): Place[] {
  const orderedLayers = layers
    .filter(
      (layer) =>
        layer.visible &&
        (zoom === undefined || layer.minZoom === undefined || zoom >= layer.minZoom) &&
        (zoom === undefined || layer.maxZoom === undefined || zoom <= layer.maxZoom),
    )
    .sort((a, b) => a.order - b.order);
  const buckets = new Map(orderedLayers.map((layer) => [layer.id, [] as Place[]]));
  for (const place of places) buckets.get(place.layerId)?.push(place);
  return orderedLayers.flatMap((layer) => buckets.get(layer.id) ?? []);
}
