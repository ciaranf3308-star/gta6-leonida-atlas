import type { Category, PersonalMarker, Place } from '../domain/types';
import { COLLECTABLE_CARD_PLACES } from './collectables';
import { GYM_PLACES, OUTDOOR_GYM_PLACES } from './gyms';
import { getLocalStreetPlaces } from '../features/street-leonida/page-data';
import {
  GTADB_LICENSE,
  GTADB_PREFERRED_SOURCE,
  GTADB_REVISION,
  classifyGtadbUncertaintyReasons,
  normalizeGtadbCatalogue,
  type GtadbLandmark,
} from '../features/street-leonida/gtadb';

/**
 * Shop / service tags in the GTADB catalogue. `#`-prefixed tags are the
 * community's shop-type markers; the plain ones are building-type tags.
 */
export const SHOP_TAGS: readonly string[] = [
  'retail',
  'restaurant',
  '#gas',
  '#supermarket',
  '#clothes',
  '#hair',
  '#guns',
  '#food',
  '#vendor',
  '#electronics',
  '#shoes',
  '#tattoos',
  '#fastfood',
  '#bar',
  '#stripclub',
  '#nightclub',
  '#modshop',
  "#pay'n'spray",
  '#drinks',
  '#carwash',
  '#bikeshop',
  '#liquor',
  '#pharmacy',
];

/**
 * Shop types the released game lets you hold up, per post-launch guides
 * (The Games Wiki's Enterable Buildings page; Rockstar previews): small
 * stores, gas station shops, food and drink spots. Ammu-Nation (#guns) is
 * explicitly excluded — it cannot be robbed. A lootable pin is an enterable
 * shop of one of these types; per-store safes, alarms and CCTV vary, and
 * this is not a per-store confirmed robbery list.
 */
export const ROBBABLE_SHOP_TAGS: readonly string[] = [
  'retail',
  '#supermarket',
  '#gas',
  '#food',
  '#vendor',
  'restaurant',
  '#bar',
  '#liquor',
  '#pharmacy',
];

function categoryFor(tags: readonly string[]): Category {
  if (tags.some((tag) => ['natural', 'agriculture'].includes(tag))) return 'nature';
  if (tags.some((tag) => ['transportation', 'infrastructure', 'infr'].includes(tag)))
    return 'transport';
  if (
    tags.some((tag) =>
      ['hotel', 'restaurant', 'retail', 'service', 'office', 'industrial'].includes(tag),
    ) ||
    tags.some((tag) => SHOP_TAGS.includes(tag))
  )
    return 'business';
  return 'landmark';
}

/**
 * Layer precedence for a GTADB record. Uncertain records stay in
 * 'uncertain' whatever their tags say — an unknown name is not a shop.
 * Otherwise a robbable enterable shop is 'lootable', any other shop is
 * 'shops', any other enterable building is 'interiors', the rest is
 * 'community'.
 */
export function layerForGtadbLandmark(
  landmark: GtadbLandmark,
  uncertain: boolean,
): string {
  if (uncertain) return 'uncertain';
  const tags = landmark.tags;
  if (
    tags.includes('enterable') &&
    ROBBABLE_SHOP_TAGS.some((tag) => tags.includes(tag))
  )
    return 'lootable';
  if (SHOP_TAGS.some((tag) => tags.includes(tag))) return 'shops';
  if (tags.includes('enterable')) return 'interiors';
  return 'community';
}

function landmarkToPlace(landmark: GtadbLandmark): Place {
  const reasons = classifyGtadbUncertaintyReasons(landmark.inGameAddress, landmark.tags);
  const uncertain = reasons.length > 0;
  const layerId = layerForGtadbLandmark(landmark, uncertain);
  const layerNote =
    layerId === 'lootable'
      ? 'Enterable shop — most small stores can be held up; safes and alarms vary by store.'
      : layerId === 'shops'
        ? 'Shop / service — enterable business.'
        : layerId === 'interiors'
          ? 'Enterable building — has an interior.'
          : '';
  return {
    id: landmark.id,
    title: landmark.inGameAddress.trim() || `Unnamed community place (${landmark.id})`,
    description: [
      landmark.inGameCoordinates
        ? 'Approximate community-mapped position.'
        : 'No game position supplied; this record is searchable only.',
      uncertain ? `Source uncertainty: ${reasons.join(', ').replaceAll('-', ' ')}.` : '',
      layerNote,
      landmark.realWorldAddress
        ? `Real-world reference (analogue only): ${landmark.realWorldAddress}`
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    category: categoryFor(landmark.tags),
    position: landmark.inGameCoordinates
      ? { x: landmark.inGameCoordinates[0], y: landmark.inGameCoordinates[1] }
      : null,
    layerId,
    tags: [...landmark.tags],
    region: landmark.inGameAddress.split(',').slice(1).join(',').trim(),
    source: {
      title: `GTADB / Map GTA · revision ${GTADB_REVISION.slice(0, 7)}`,
      url: GTADB_PREFERRED_SOURCE,
      license: GTADB_LICENSE,
    },
    evidence: uncertain ? 'uncertain' : 'approximate',
  };
}

/** Parse bundled source data through the existing strict evidence/coordinate normalizer. */
export function catalogueFromSnapshot(input: unknown): Place[] {
  if (
    !input ||
    typeof input !== 'object' ||
    !('landmarks' in input) ||
    !Array.isArray(input.landmarks)
  ) {
    throw new Error('The bundled community catalogue is invalid.');
  }
  const tuples: Record<string, unknown> = {};
  for (const candidate of input.landmarks) {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      typeof candidate.id !== 'string' ||
      !/^L\d+$/.test(candidate.id)
    ) {
      throw new Error('The community catalogue contains an invalid record.');
    }
    if (Object.hasOwn(tuples, candidate.id))
      throw new Error(`Duplicate community record: ${candidate.id}`);
    tuples[candidate.id] = [
      candidate.inGameAddress,
      candidate.inGameCoordinates === null ? [] : candidate.inGameCoordinates,
      candidate.inGamePhotoSize === null ? [] : candidate.inGamePhotoSize,
      candidate.realWorldAddress,
      candidate.realWorldCoordinates === null ? [] : candidate.realWorldCoordinates,
      candidate.realWorldPhotoSize === null ? [] : candidate.realWorldPhotoSize,
      candidate.tags,
      candidate.color,
      candidate.editedAt,
    ];
  }
  const regions: Place[] = getLocalStreetPlaces().items.map((region) => ({
    id: `region:${region.slug}`,
    title: region.name,
    description: region.description ?? '',
    category: 'region',
    position: region.position ? { x: region.position.x, y: region.position.y } : null,
    layerId: 'regions',
    tags: [...region.labels],
    region: region.name,
    source: {
      title: region.source?.title ?? 'Rockstar Games',
      url: region.source?.url ?? '',
      license: 'Official name; GTADB position CC BY 4.0',
    },
    evidence: 'approximate',
  }));
  return [
    ...regions,
    ...normalizeGtadbCatalogue(tuples).map(landmarkToPlace),
    ...GYM_PLACES,
    ...OUTDOOR_GYM_PLACES,
    ...COLLECTABLE_CARD_PLACES,
  ];
}

let catalogueRequest: Promise<Place[]> | undefined;

/** The snapshot is local, same-origin and base-path aware; failures remain actionable to callers. */
export function loadCatalogue(): Promise<Place[]> {
  if (!catalogueRequest) {
    const base = import.meta.env.BASE_URL ?? '/';
    catalogueRequest = fetch(
      `${base.endsWith('/') ? base : `${base}/`}assets/street-leonida/maps/gtadb-landmarks-d406fea.json`,
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error(`Could not load the community catalogue (${response.status}).`);
        return catalogueFromSnapshot(await response.json());
      })
      .catch((error: unknown) => {
        catalogueRequest = undefined;
        throw error;
      });
  }
  return catalogueRequest;
}

export function markerToPlace(marker: PersonalMarker): Place {
  return {
    id: marker.id,
    title: marker.title,
    description: marker.description,
    category: marker.category,
    position: marker.position,
    layerId: 'personal',
    tags: [marker.icon, ...(marker.color ? [`color:${marker.color}`] : [])],
    region: 'My markers',
    source: { title: 'Your local atlas', url: '' },
    evidence: 'personal',
  };
}
