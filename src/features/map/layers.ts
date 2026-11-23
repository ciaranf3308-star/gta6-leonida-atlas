import type { LayerDefinition, Place } from '../../domain/types';

/**
 * Spoiler-free fork: every public layer starts OFF. The map opens as a blank
 * Leonida basemap; nothing is shown until the user turns a layer on.
 * "My markers" stays on — those are the user's own notes, never spoilers.
 */
export const DEFAULT_LAYERS: LayerDefinition[] = [
  {
    id: 'regions',
    name: 'Named regions',
    description: 'Official names with approximate community positions.',
    category: 'reference',
    visible: false,
    order: 0,
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
    order: 10,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#73cbbb', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'gyms',
    name: 'Gyms / Strength',
    description: 'Where to work out in Leonida. 9 gyms; 2 have no verified coordinates yet.',
    category: 'activity',
    visible: false,
    order: 15,
    source: 'GTA6 GPS / PowerPyx · approximate',
    style: { color: '#ff8a5c', radius: 7 },
    icon: 'gym',
    interactive: true,
  },
  {
    id: 'uncertain',
    name: 'Uncertain records',
    description: 'Unknown names or explicit uncertainty signals in the source.',
    category: 'community',
    visible: false,
    order: 20,
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
    order: 30,
    source: 'Your local atlas',
    style: { color: '#c9a9ef', radius: 8 },
    icon: 'pin',
    interactive: true,
  },
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
