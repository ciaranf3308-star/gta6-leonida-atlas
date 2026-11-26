import type { Category, LayerDefinition, Place } from '../../domain/types';
import { COLLECTABLE_CARD_PLACES, COLLECTABLE_SETS } from '../../data/collectables';
import {
  GANG_OPERATIONS,
  GANG_OP_LICENSE,
  GANG_OP_SOURCE,
} from '../../data/gang-operations';
import { visiblePlaces } from '../spoiler/visibility';

/**
 * Spoiler-free fork: every public layer starts OFF. The map opens as a blank
 * Leonida basemap; nothing is shown until the user turns a layer on.
 * "My markers" stays on — those are the user's own notes, never spoilers.
 *
 * v0.21.0: layers are grouped by the game's own Map Index (pause map →
 * D-pad Right → Map Index) — see `mapIndex` on each layer and
 * src/app/categories.ts. There is no "Business" layer: the old Shops &
 * services layer is split four ways by the game's filing — Weapons
 * (Ammu-Nation), Style (clothing / tattoo / hair), Food & Drink
 * (food, bars, convenience) and Vehicles (gas, mod, Pay 'n' Spray).
 * The split is real but honest: at GTADB revision 2e9e194 three of
 * the four have verified named pins (Food & Drink 30, Vehicles 9,
 * Style 1 — the Au Courant hair salon). Weapons has 3 verified named
 * gun shops in the data (Phil's Ammu-Nation, Pawn & Gun, Gellhorn
 * Outfitters), but the old filing puts them under Robberies, so that
 * layer exists with 0 places until the v0.32 model surfaces them as
 * weapons shops — the Layers list says so instead of showing an
 * empty toggle.
 *
 * Layer counts below are the verified counts at GTADB revision 2e9e194
 * (4,380 records), computed by catalogueFromSnapshot and asserted in
 * tests/unit/atlas-spoiler-free.test.ts. Uncertain GTADB records stay in
 * 'uncertain' whatever their tags say, except breakable houses: a
 * residential+enterable record, a Capri rob-house candidate, or the Port
 * Gellhorn trailer park is a breakable home even when its name is "?".
 * The 386 enterable records split across Interiors (83 named venues),
 * Breakable homes (47 houses/apartments/trailers — 42 positioned, 5
 * guide examples searchable-only), Lootable (47 shops) and Unverified
 * (the rest — unnamed, no confirmed use). The 8 named
 * residential+enterable records (Venture Apts, Jason's House, Bayside
 * Apartments, Pegassi Residences…) moved from Interiors / Unverified
 * into Breakable homes; the 5 guide examples add the 'enterable' tag,
 * so the built catalogue counts 391 enterable places in total.
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

/**
 * Gang-op counts, computed from the import — never hardcoded. 39
 * operations from the in-game tracker; the hosted ones ride on an
 * existing building (Sunrise RV Park → L265, Parlor Apartments →
 * breakable:parlor-apartments) and the rest are area-known only.
 * The 22 / 12 / 3 likely-area split in the description below is
 * MEASURED by measureGangOpBounds (src/features/map/likely-area.ts)
 * over the derived areas and asserted in
 * tests/unit/gang-op-likely-area.test.ts — update this copy if the
 * measurement moves (e.g. a re-sync gains an area positioned
 * members, or a host-match lands). The split moved 16 / 18 / 3 →
 * 22 / 12 / 3 in the v0.32 regions-fix (lane 4): the six Port
 * Gellhorn ops now draw the town extent instead of the Kelly
 * County rect — same place, county-qualified naming; see
 * hidden_files/v032-regions/PORT-GELLHORN-NODES.md.
 */
const GANG_OP_TOTAL_COUNT = GANG_OPERATIONS.length;
const GANG_OP_HOSTED = GANG_OPERATIONS.filter(
  (op) => op.hostLocationId !== undefined,
);
const GANG_OP_HOSTED_COUNT = GANG_OP_HOSTED.length;
const GANG_OP_AREA_KNOWN_COUNT = GANG_OP_TOTAL_COUNT - GANG_OP_HOSTED_COUNT;
const GANG_OP_HOSTED_NAMES = GANG_OP_HOSTED.map((op) => op.name).join(' and ');

export const DEFAULT_LAYERS: LayerDefinition[] = [
  {
    id: 'regions',
    name: 'Named regions',
    description: 'Official names with approximate community positions.',
    category: 'reference',
    mapIndex: 'exploration',
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
    mapIndex: 'exploration',
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
      'Enterable shops, venues and other buildings with confirmed names — 77 here. Houses and apartments that can be broken into live in Breakable homes; 385 places in total carry the enterable tag in GTADB, and the rest of them are unnamed, so they sit in Unverified places. Venues are also filed by kind in Find — a bar interior is Food & Drink there.',
    category: 'activity',
    mapIndex: 'exploration',
    visible: false,
    order: 80,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#e8b64c', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'breakable',
    name: 'Breakable homes',
    description:
      'Houses, apartments and trailers you can break into — 33 tagged in GTADB (none in Capri), the 8 Capri rob-house candidates, the Port Gellhorn trailer park, and guide-named examples like Parlor Apartments and the Lost Vista trailers. Not every breakable home: most houses have no tag in the data. On the in-game map, dark blue means you can go in, light blue means closed.',
    category: 'activity',
    mapIndex: 'robberies',
    visible: false,
    order: 75,
    source: 'GTADB / Map GTA · CC BY 4.0; robbery guides: GameRant, HowToVideoGame',
    style: { color: '#e07a5f', radius: 7 },
    icon: 'home',
    interactive: true,
  },
  {
    id: 'shops-weapons',
    name: 'Weapons shops',
    description:
      'Ammu-Nation locations — the game’s Weapons filter. 3 verified gun shops: Phil’s Ammu-Nation, Pawn & Gun, and Gellhorn Outfitters. The community list names 24 Ammu-Nations; ~19 have no position in any licensed dataset yet.',
    category: 'activity',
    mapIndex: 'weapons',
    visible: false,
    order: 72,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#c9a9ef', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'shops-style',
    name: 'Style shops',
    description:
      'Clothing, tattoos, hair & makeup — the game’s Style filter. 7 shops with confirmed names: Stock 305 and A1 Fashions (clothes), Electric Fang Tattoo, Sara’s Unisex Salon, Kurt’s Barber Shop, The Old Mill Barber Shop and Au Courant Unisex Hair Salon. We Have Shoes is named in the data but tagged demolished, so it stays Unverified; 16 more Style records are still unnamed “?” places.',
    category: 'activity',
    mapIndex: 'style',
    visible: false,
    order: 71,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#e8a0c8', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'shops-food',
    name: 'Food & drink shops',
    description:
      'Bars, cafes, restaurants, convenience stores and liquor stores — the game’s Food & Drink filter. 30 shops with confirmed names (27 positioned). Robbable shops live in Lootable buildings.',
    category: 'activity',
    mapIndex: 'food-drink',
    visible: false,
    order: 70,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#7ec8e3', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'shops-vehicles',
    name: 'Vehicle services',
    description:
      'Gas stations, mod shops, Pay ’n’ Spray and car washes — the game’s Vehicles filter. 9 places with confirmed names, all positioned.',
    category: 'activity',
    mapIndex: 'vehicles',
    visible: false,
    order: 69,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#8fd0a0', radius: 6 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'lootable',
    name: 'Lootable buildings',
    description:
      '52 enterable shops that can be held up — most small stores can be robbed; safes and alarms vary by store. Ammu-Nation cannot be robbed.',
    category: 'activity',
    mapIndex: 'robberies',
    visible: false,
    order: 90,
    source: 'GTADB / Map GTA · CC BY 4.0; robbery guidance: The Games Wiki',
    style: { color: '#ff5c5c', radius: 7 },
    icon: 'pin',
    interactive: true,
  },
  {
    id: 'loot-heists',
    name: 'Bank jobs & vaults',
    description:
      'Bank jobs, vaults and payday loans from the GTA 6 Loot Map community dataset — 29 places. Community-sourced guide positions, not in-game verified. A job is a robbery target, not a shop: the shops you can hold up live in Lootable buildings.',
    category: 'activity',
    mapIndex: 'robberies',
    visible: false,
    order: 88,
    source: 'GTA 6 Loot Map (MIT) · community-sourced, unverified',
    style: { color: '#ffb020', radius: 7 },
    icon: 'banknote',
    interactive: true,
  },
  {
    // order 89: the robbery layers cluster at 75–90 — Breakable
    // homes 75, Bank jobs & vaults 88, Lootable buildings 90. Gang
    // operations sits between Bank jobs and Lootable, beside the
    // other robbery layers: below Lootable (the broadest robbery
    // layer, 52 shops) and above Bank jobs (29 jobs). The map draws
    // likely-area REGIONS for this layer, never pins — see
    // src/features/map/likely-area.ts.
    id: 'gang-op',
    name: 'Gang operations',
    description:
      `${GANG_OP_TOTAL_COUNT} illegal operations from the in-game Gangs tracker. ` +
      `${GANG_OP_HOSTED_COUNT} ride on an existing building (${GANG_OP_HOSTED_NAMES}) and show there; ` +
      `the other ${GANG_OP_AREA_KNOWN_COUNT} are known by area only — no verified position exists for any of them, ` +
      `so the map shows each one's likely area, a dashed region over the area the guides name, never a pin. ` +
      `27 draw their own area's extent, 7 draw a county extent instead — a whole-county region for a single ` +
      `building, labelled as the county extent, because its named area has no extent of its own — and 3 have no ` +
      `extent to draw and are listed by area only. Licence: ${GANG_OP_LICENSE}.`,
    category: 'activity',
    mapIndex: 'robberies',
    visible: false,
    order: 89,
    source: GANG_OP_SOURCE.title,
    style: { color: '#ff8f8f', radius: 7 },
    icon: 'users',
    interactive: true,
  },
  {
    id: 'loot-collectibles',
    name: 'Collectibles · Loot Map',
    description:
      'Meditations, magazines, cards and watches from the GTA 6 Loot Map community dataset — 20 places. Community-sourced guide positions, not in-game verified. Trading-card sets live in their own Cards layers.',
    category: 'collectible',
    mapIndex: 'collectibles',
    visible: false,
    order: 19,
    source: 'GTA 6 Loot Map (MIT) · community-sourced, unverified',
    style: { color: '#2ec4b6', radius: 6 },
    icon: 'sparkles',
    interactive: true,
  },
  {
    id: 'gyms',
    name: 'Gyms',
    description:
      'Member gyms in Vice City only — 8 gyms, 2 with no verified coordinates yet. These are clubs you pay to join. Free workout equipment (beach gear, home gyms, benches) is the separate Workout equipment layer, not this one.',
    category: 'activity',
    mapIndex: 'activities',
    visible: false,
    order: 60,
    source: 'GTA6 GPS / PowerPyx · approximate',
    style: { color: '#ff8a5c', radius: 7 },
    icon: 'gym',
    interactive: true,
  },
  {
    id: 'equipment',
    name: 'Workout equipment',
    description:
      'Free public workout equipment — Muscle Sands beach gym, Jason’s house deck (Chapter 1 only) and the Starlet Motel bench by the pool (Chapter 2 only, listed by name — no verified pin yet). No other free spots have a verified position yet. Equipment in a garage in a house is in no public source: mark a house yourself and it becomes an equipment pin on your map.',
    category: 'activity',
    mapIndex: 'activities',
    visible: false,
    order: 55,
    source: 'GTA6 GPS / GTADB · approximate',
    style: { color: '#7ddb8a', radius: 7 },
    icon: 'weight',
    interactive: true,
  },
  {
    id: 'uncertain',
    name: 'Unverified places',
    description:
      'Places with no confirmed name or use yet — kept off so they don’t fill the map. Turn on only if you want to see them. Breakable houses with an enterable or residential tag moved to Breakable homes, even when unnamed.',
    category: 'community',
    mapIndex: 'unverified',
    visible: false,
    order: 30,
    source: 'GTADB / Map GTA · CC BY 4.0',
    style: { color: '#cba980', radius: 5 },
    icon: 'question',
    interactive: true,
  },
  {
    id: 'my-markers',
    name: 'My markers',
    description: 'Your own local map annotations.',
    category: 'my-markers',
    mapIndex: 'my-markers',
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
    mapIndex: 'collectibles' as const,
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
 * user's own notes. The rule itself lives in features/spoiler/visibility.ts
 * (one source of truth); this stays as the call-site name. A revealed
 * place (Ask answer, Find tap, deep link) is listed too — see the reveal
 * set in that module.
 */
export function filterByVisibleLayers(
  places: readonly Place[],
  layers: readonly LayerDefinition[],
  revealIds: ReadonlySet<string> = new Set(),
): Place[] {
  return visiblePlaces(places, layers, revealIds);
}

/**
 * Picking a Kind in Find turns on that kind's layers — the pick IS the
 * request to see those places, the same consent Ask runs on ("asking
 * for a thing is consent to show that layer"). Before this, Kind →
 * Style showed "0 places showing" with every layer off and no hint
 * why (reported 2026-11-25: "it's not clear how to filter"). The map
 * still opens clean — nothing turns a layer on except the user asking
 * for its kind, an Ask answer, or the Layers switches themselves —
 * and Find's "Clear all" still turns every public layer back off.
 * 'all' and kinds with no layers (Story, Personal) change nothing;
 * clearing the Kind leaves the layers as they are.
 */
export function layersWithCategoryEnabled(
  layers: readonly LayerDefinition[],
  category: Category | 'all',
): LayerDefinition[] {
  if (category === 'all') return [...layers];
  const ids = new Set(
    layers.filter((layer) => layer.mapIndex === category).map((layer) => layer.id),
  );
  if (ids.size === 0) return [...layers];
  return layers.map((layer) =>
    ids.has(layer.id) ? { ...layer, visible: true } : layer,
  );
}

/**
 * The Collectibles quick-filter chip turns on every collectibles layer:
 * one per trading-card set (cards:<set>) AND the Loot Map collectibles
 * (loot-collectibles: meditations + guide collectibles). Before v0.31.5
 * the chip only turned on the cards:* layers, so it showed 3 hero pins
 * at island zoom and hid the 20 loot collectibles entirely (reported
 * 2026-11-26: "when I click collectables .. 3 entry's on the whole map
 * show"). The 3-at-island-zoom collapse itself is by design:
 * selectHeroPlaces allows one pin per 2200-unit cell, and Vicki shares
 * the Starlet Motel cell with Victor Maravilla while Reggie Pierce
 * shares the Drive-In cell with Lexi Campbell.
 */
export function collectiblesChipLayerIds(
  layers: readonly LayerDefinition[],
): string[] {
  return layers
    .filter(
      (layer) =>
        layer.id.startsWith('cards:') || layer.id === 'loot-collectibles',
    )
    .map((layer) => layer.id);
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
