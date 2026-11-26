import type { Category, PersonalMarker, Place } from '../domain/types';
import { COLLECTABLE_CARD_PLACES } from './collectables';
import { LOOT_MAP_PLACES } from './loot-map';
import { BREAKABLE_HOME_PLACES } from './breakable-homes';
import { GANG_OP_GTADB_HOSTS, GANG_OP_PLACES, gangOpHasVehicleLoot } from './gang-operations';
import { EQUIPMENT_PLACES, GYM_PLACES } from './gyms';
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
 *
 * One deliberate exception: the generic 'retail' tag must not swallow a
 * Style shop. A clothes / shoe / tattoo / hair shop is Style in the
 * game's Map Index even when it is enterable and carries 'retail' —
 * the cited guides cover small stores, gas shops and food/drink, and
 * no per-store source confirms a clothes shop can be held up. Before
 * this rule, six named Style shops (Sara's, Kurt's, Stock 305,
 * A1 Fashions, Electric Fang, The Old Mill) filed under Robberies and
 * Kind → Style showed a single place. (We Have Shoes, the seventh
 * named shoe shop, is tagged 'demolished' so it stays Unverified —
 * that is the uncertainty rule, not this one.)
 */
export const STYLE_SHOP_TAGS: readonly string[] = [
  '#clothes',
  '#shoes',
  '#tattoos',
  '#hair',
];

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

/**
 * Where a shop sits in the game's own Map Index. There is no "Business"
 * category in the game: Ammu-Nation is Weapons, clothing / tattoo /
 * hair is Style, food / bars / convenience is Food & Drink, gas / mod /
 * Pay 'n' Spray is Vehicles. The judgement calls, documented:
 * - generic retail, pharmacy and electronics are everyday shops, so
 *   they sit with Food & Drink (convenience / general stores);
 * - strip clubs and nightclubs are bars-and-clubs venues, so they sit
 *   with Food & Drink too, not Activities (the Activities layer is
 *   gyms and workout gear, not nightlife).
 */
export function shopMapIndex(tags: readonly string[]): 'weapons' | 'style' | 'food-drink' | 'vehicles' {
  if (tags.includes('#guns')) return 'weapons';
  if (tags.some((tag) => STYLE_SHOP_TAGS.includes(tag))) return 'style';
  if (
    tags.some((tag) => ['#gas', '#modshop', "#pay'n'spray", '#carwash', '#bikeshop'].includes(tag))
  )
    return 'vehicles';
  return 'food-drink';
}

/** The Shops layer a named, non-lootable shop belongs to — one per Map Index group. */
export function shopLayerFor(tags: readonly string[]): string {
  const group = shopMapIndex(tags);
  return group === 'food-drink' ? 'shops-food' : `shops-${group}`;
}

function categoryFor(tags: readonly string[], layerId: string): Category {
  // Robbery targets first: lootable shops and breakable homes are
  // Robberies whatever else they are.
  if (layerId === 'lootable' || layerId === 'breakable') return 'robberies';
  // Gang operations (§8.1 import): illegal operations are Robberies
  // in the game's Map Index, whatever their GTADB tags say.
  if (layerId === 'gang-op') return 'robberies';
  if (layerId === 'uncertain') return 'unverified';
  if (layerId.startsWith('cards:')) return 'collectibles';
  if (layerId === 'gyms' || layerId === 'equipment') return 'activities';
  if (layerId === 'personal' || layerId === 'my-markers') return 'my-markers';
  if (layerId === 'regions') return 'exploration';
  // Shops split by type — the game's own filing, not "Business".
  if (SHOP_TAGS.some((tag) => tags.includes(tag))) return shopMapIndex(tags);
  if (tags.some((tag) => ['gym', '#gym', 'fitness'].includes(tag))) return 'activities';
  if (tags.some((tag) => ['transportation', 'infrastructure', 'infr'].includes(tag)))
    return 'vehicles';
  // Everything else named is a point of interest: Exploration. Nature,
  // hotels, offices and landmarks all live here — the game has no
  // separate "Nature" or "Landmark" filter.
  return 'exploration';
}

/**
 * Layer precedence for a GTADB record. Uncertain records stay in
 * 'uncertain' whatever their tags say — an unknown name is not a shop —
 * except breakable houses: a residential+enterable record, a Capri
 * rob-house candidate, or the Port Gellhorn trailer park is a breakable
 * home even when its name is still "?". Otherwise a robbable enterable
 * shop is 'lootable', any other shop is one of the four shops-* layers
 * (split by the game's Map Index: Weapons / Style / Food & Drink /
 * Vehicles — there is no "Business" layer), any other enterable
 * building is 'interiors', the rest is 'community'.
 */
export function layerForGtadbLandmark(
  landmark: GtadbLandmark,
  uncertain: boolean,
): string {
  if (isBreakableGtadbLandmark(landmark)) return 'breakable';
  if (uncertain) return 'uncertain';
  const tags = landmark.tags;
  // Style before lootable: a clothes / shoe / tattoo / hair shop is
  // Style in the game's Map Index even when it is enterable and
  // carries the generic 'retail' tag (see STYLE_SHOP_TAGS above).
  if (tags.some((tag) => STYLE_SHOP_TAGS.includes(tag))) return shopLayerFor(tags);
  if (
    tags.includes('enterable') &&
    ROBBABLE_SHOP_TAGS.some((tag) => tags.includes(tag))
  )
    return 'lootable';
  if (SHOP_TAGS.some((tag) => tags.includes(tag))) return shopLayerFor(tags);
  if (tags.includes('enterable')) return 'interiors';
  return 'community';
}

/**
 * A GTADB record that is a breakable home: residential + enterable
 * (the 33 houses GTADB tags, none of them in Capri), an unnamed Capri
 * record that is enterable or residential (the Capri rob-house
 * candidates — GameRant marked every house and garage you can break
 * into there, and most Capri houses carry no tags at all), or the
 * Port Gellhorn trailer park (L1062, residential, named "Trailer
 * Park"). Breakable homes are systemic — dark blue on the in-game map
 * means you can go in — so this layer is examples plus tagged houses,
 * never a complete list.
 */
export function isBreakableGtadbLandmark(landmark: GtadbLandmark): boolean {
  const tags = landmark.tags;
  if (tags.includes('residential') && tags.includes('enterable')) return true;
  const address = landmark.inGameAddress;
  const region = address.split(',').slice(1).join(',').trim();
  const unnamed = address.trim().startsWith('?');
  if (
    unnamed &&
    region.toLowerCase().startsWith('capri') &&
    (tags.includes('enterable') || tags.includes('residential'))
  )
    return true;
  if (address.trim().toLowerCase().startsWith('trailer park') && tags.includes('residential'))
    return true;
  return false;
}

function landmarkToPlace(landmark: GtadbLandmark): Place {
  const reasons = classifyGtadbUncertaintyReasons(landmark.inGameAddress, landmark.tags);
  const uncertain = reasons.length > 0;
  const layerId = layerForGtadbLandmark(landmark, uncertain);
  const shopGroup =
    layerId === 'shops-weapons'
      ? 'Weapons'
      : layerId === 'shops-style'
        ? 'Style'
        : layerId === 'shops-vehicles'
          ? 'Vehicles'
          : 'Food & Drink';
  const layerNote =
    layerId === 'breakable'
      ? 'Breakable house — can be broken into for robbery. On the in-game map, dark blue means you can go in.'
      : layerId === 'lootable'
        ? 'Enterable shop — most small stores can be held up; safes and alarms vary by store.'
        : layerId.startsWith('shops-')
          ? `Shop — filed under the game's Map Index as ${shopGroup}.`
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
      // §8.1 gang-op host-match: Sunrise RV Park is GTADB L265, so
      // the gang-op opportunity derives on the real place instead of
      // a second area-known row. The 'vehicle-loot' tag rides along
      // exactly when the site holds a vehicle or a safe code
      // (gangOpHasVehicleLoot) — L265's code 6769 qualifies it.
      GANG_OP_GTADB_HOSTS.has(landmark.id)
        ? 'Gang operation — one of the 39 illegal operations (see the gang-op record for its Key Valuables).'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
    category: categoryFor(landmark.tags, layerId),
    position: landmark.inGameCoordinates
      ? { x: landmark.inGameCoordinates[0], y: landmark.inGameCoordinates[1] }
      : null,
    layerId,
    tags: [
      ...landmark.tags,
      ...(GANG_OP_GTADB_HOSTS.has(landmark.id)
        ? ['gang-op', ...(gangOpHasVehicleLoot(landmark.id) ? ['vehicle-loot'] : [])]
        : []),
    ],
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
    category: 'exploration',
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
    ...EQUIPMENT_PLACES,
    ...BREAKABLE_HOME_PLACES,
    ...GANG_OP_PLACES,
    ...COLLECTABLE_CARD_PLACES,
    ...LOOT_MAP_PLACES,
  ];
}

let catalogueRequest: Promise<Place[]> | undefined;

/** The snapshot is local, same-origin and base-path aware; failures remain actionable to callers. */
export function loadCatalogue(): Promise<Place[]> {
  if (!catalogueRequest) {
    const base = import.meta.env.BASE_URL ?? '/';
    catalogueRequest = fetch(
      `${base.endsWith('/') ? base : `${base}/`}assets/street-leonida/maps/gtadb-landmarks-2e9e194.json`,
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
    // A marker is always a My marker — its own group, never the game's
    // Personal (safehouse / garages / ATMs). Old stored markers that
    // carried a legacy category read the same way.
    category: 'my-markers',
    position: marker.position,
    layerId: 'my-markers',
    tags: [
      marker.icon,
      // A workout-spot marker is a workout-equipment answer for Ask
      // Nylah — the user marked it himself, so it is real equipment
      // on his device, whatever the public data says.
      ...(marker.kind === 'workout' ? ['gym', 'workout', 'equipment'] : []),
      // A breakable-home marker is a breakable answer for Ask Nylah —
      // the user found the house himself, so it is real, whatever the
      // public data says (most breakable homes have no tag at all).
      ...(marker.kind === 'breakable' ? ['breakable', 'house'] : []),
      ...(marker.color ? [`color:${marker.color}`] : []),
    ],
    region: 'My markers',
    source: { title: 'Your local atlas', url: '' },
    evidence: 'personal',
  };
}
