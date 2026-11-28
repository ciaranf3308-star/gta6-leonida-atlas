import type { ComponentType } from 'react';
import {
  Anchor,
  Banknote,
  BedDouble,
  Bike,
  Bird,
  BookOpen,
  Building2,
  Bus,
  Camera,
  Car,
  CircleDollarSign,
  CircleQuestionMark,
  Clapperboard,
  Cross,
  Crosshair,
  Disc3,
  DoorOpen,
  Dumbbell,
  Egg,
  Factory,
  FerrisWheel,
  Flag,
  Footprints,
  Fuel,
  Gem,
  HardHat,
  Home,
  Landmark,
  Layers,
  Lock,
  Mail,
  MapPin,
  Map as MapIcon,
  Martini,
  Moon,
  Music,
  Navigation,
  Package,
  Palmtree,
  Pill,
  Pizza,
  Plane,
  Scissors,
  Search,
  Shield,
  Shirt,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Target,
  Train,
  TreePine,
  Trophy,
  Tv,
  Users,
  UtensilsCrossed,
  Watch,
  Waves,
  Weight,
  Wine,
  Wrench,
  Zap,
  Brush,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Place } from '../../domain/types';
import { effectiveAiCategory, type AiCategoryId, type AiCategoryRecord } from '../categorise/categories';

/**
 * The icon system — one designed set for the whole atlas.
 *
 * PROVENANCE (no invented logos, no scraped closed-site assets):
 * - The GTADB snapshot the app ships (`gtadb-landmarks-2e9e194.json`)
 *   carries NO icon or blip field at all — only `tags` and a `color`.
 *   There is no authentic per-place blip asset in the data to reuse.
 * - So the pins follow the form of the game's own map legend: a GTA
 *   V / VI blip is a white pictogram inside a coloured roundel. The
 *   pictogram for a place comes from its GTADB tags (the game's own
 *   category vocabulary — #gas, #guns, #supermarket, residential …),
 *   and the roundel colour is the layer colour the app already used.
 * - The pictograms themselves are one consistent hand-drawn set:
 *   Lucide (ISC licence, 24×24 grid, 2px stroke, round caps/joins),
 *   already a dependency of the app. Same stroke, same weight,
 *   everywhere — map pins, chips, layer rows, detail sheets, search
 *   results, Ask answers and AI-suggested types.
 * - Named in-game brands (Ammu-Nation, Pay 'n' Spray …) have NO logo
 *   drawn for them: no brand mark is invented. The brand reads from
 *   the place's own name, and the pin carries the category glyph
 *   (Crosshair for a gun shop, Car for Pay 'n' Spray). If Rockstar /
 *   GTADB ever ship real brand blips, they slot into `iconKeyForPlace`
 *   without touching the callers.
 * - A place with no recognisable tag never falls back to a coloured
 *   dot: it gets the layer's glyph (DoorOpen for an enterable building,
 *   CircleQuestionMark for an unverified place, MapPin otherwise).
 */

export type IconKey =
  | 'anchor'
  | 'banknote'
  | 'bed'
  | 'bike'
  | 'building'
  | 'bus'
  | 'car'
  | 'question'
  | 'cinema'
  | 'cross'
  | 'crosshair'
  | 'dollarsign'
  | 'nightclub'
  | 'door'
  | 'gym'
  | 'factory'
  | 'ferris'
  | 'flag'
  | 'shoes'
  | 'fuel'
  | 'gem'
  | 'hardhat'
  | 'home'
  | 'landmark'
  | 'layers'
  | 'lock'
  | 'pin'
  | 'bar'
  | 'music'
  | 'navigation'
  | 'palmtree'
  | 'pill'
  | 'pizza'
  | 'plane'
  | 'scissors'
  | 'shield'
  | 'shirt'
  | 'shopping'
  | 'sparkles'
  | 'star'
  | 'store'
  | 'train'
  | 'tree'
  | 'trophy'
  | 'tv'
  | 'users'
  | 'food'
  | 'waves'
  | 'wine'
  | 'weight'
  | 'wrench'
  | 'zap'
  | 'brush'
  | 'key'
  | 'search'
  | 'map'
  | 'book'
  | 'package'
  | 'camera'
  | 'bird'
  | 'watch'
  | 'moon'
  | 'egg'
  | 'mail'
  | 'target';

export const ICON_COMPONENTS: Record<IconKey, LucideIcon> = {
  anchor: Anchor,
  banknote: Banknote,
  bed: BedDouble,
  bike: Bike,
  bird: Bird,
  book: BookOpen,
  building: Building2,
  bus: Bus,
  camera: Camera,
  car: Car,
  question: CircleQuestionMark,
  cinema: Clapperboard,
  cross: Cross,
  crosshair: Crosshair,
  dollarsign: CircleDollarSign,
  nightclub: Disc3,
  door: DoorOpen,
  egg: Egg,
  gym: Dumbbell,
  factory: Factory,
  ferris: FerrisWheel,
  flag: Flag,
  shoes: Footprints,
  fuel: Fuel,
  gem: Gem,
  hardhat: HardHat,
  home: Home,
  landmark: Landmark,
  layers: Layers,
  lock: Lock,
  mail: Mail,
  moon: Moon,
  pin: MapPin,
  bar: Martini,
  music: Music,
  navigation: Navigation,
  package: Package,
  palmtree: Palmtree,
  pill: Pill,
  pizza: Pizza,
  plane: Plane,
  scissors: Scissors,
  shield: Shield,
  shirt: Shirt,
  shopping: ShoppingBag,
  sparkles: Sparkles,
  star: Star,
  store: Store,
  target: Target,
  train: Train,
  tree: TreePine,
  trophy: Trophy,
  tv: Tv,
  users: Users,
  food: UtensilsCrossed,
  watch: Watch,
  waves: Waves,
  wine: Wine,
  weight: Weight,
  wrench: Wrench,
  zap: Zap,
  brush: Brush,
  key: KeyRound,
  search: Search,
  map: MapIcon,
};

/**
 * v0.33 D-2 — one distinct icon per kind: colour + glyph, gtatown-style.
 * Colour codes by KIND (type), never by set or tier — all 18 card sets
 * share one light-blue card pin; tier is text in the name only (no tier
 * filter). No two kinds share a glyph AND a colour (enforced by test):
 * loot boxes and SCOOP share the `package` glyph in different colours,
 * murals and flamingos share pink in different glyphs — colour is the
 * first read. The KIND colour wins over the layer colour for the kinds
 * below (see pinStyleForPlace); existing shop / gym / interior layer
 * colours stay, and the weapons / gyms / interiors / breakable rows
 * below repeat those layer colours so the table is the single source
 * of truth. Kinds with no pinned places yet (loot boxes, WAiNK, SCOOP,
 * meteorites, hoops, murals, flamingos, treasure, easter eggs, bottles,
 * underwater finds, free cars) exist in the table so a future pin
 * never needs a redesign — the registry is the taxonomy, not a count.
 * Glyphs are all Lucide (ISC, same stroke/weight as the rest of the
 * set); `target` is the hoop ring — Lucide has no basketball glyph.
 */
export type CollectibleKindId =
  | 'cards'
  | 'loot-box'
  | 'waink'
  | 'scoop'
  | 'meteorite'
  | 'hoops'
  | 'murals'
  | 'flamingos'
  | 'watches'
  | 'meditations'
  | 'magazines'
  | 'treasure'
  | 'easter-eggs'
  | 'bottles'
  | 'underwater'
  | 'vehicles';

export type KindId =
  | CollectibleKindId
  | 'breakable'
  | 'gyms'
  | 'equipment'
  | 'weapons';

export const KIND_STYLES: Record<KindId, { color: string; icon: IconKey }> = {
  cards: { color: '#6FB7E8', icon: 'gem' },
  'loot-box': { color: '#F2C230', icon: 'package' },
  waink: { color: '#A9805B', icon: 'camera' },
  scoop: { color: '#2EC4B6', icon: 'package' },
  meteorite: { color: '#9B7EDE', icon: 'sparkles' },
  hoops: { color: '#F28C28', icon: 'target' },
  murals: { color: '#F27FB0', icon: 'brush' },
  flamingos: { color: '#F27FB0', icon: 'bird' },
  watches: { color: '#B9BDC4', icon: 'watch' },
  meditations: { color: '#58B368', icon: 'moon' },
  magazines: { color: '#5B8DEF', icon: 'book' },
  treasure: { color: '#E8B64C', icon: 'star' },
  'easter-eggs': { color: '#A8D94A', icon: 'egg' },
  bottles: { color: '#4AD0D8', icon: 'mail' },
  underwater: { color: '#2E6FB0', icon: 'waves' },
  vehicles: { color: '#F2A65A', icon: 'car' },
  breakable: { color: '#E07A5F', icon: 'home' },
  gyms: { color: '#ff8a5c', icon: 'gym' },
  equipment: { color: '#7ddb8a', icon: 'weight' },
  weapons: { color: '#c9a9ef', icon: 'crosshair' },
};

/** The kinds that shrink to coloured dots at island zoom (D-6). */
export const COLLECTIBLE_KIND_IDS: ReadonlySet<CollectibleKindId> = new Set([
  'cards',
  'loot-box',
  'waink',
  'scoop',
  'meteorite',
  'hoops',
  'murals',
  'flamingos',
  'watches',
  'meditations',
  'magazines',
  'treasure',
  'easter-eggs',
  'bottles',
  'underwater',
  'vehicles',
]);

/**
 * Zoom bands for the dot rules (D-6) — the same thresholds the map
 * already uses: hero mode (island) is zoom <= -2.5 (MapView), and
 * street zoom — where every place gets its label back — is zoom >= 0.5
 * (MapView label rule). Collectible kinds are dots at/below -2.5 and
 * full pins above it; plain residential is a dot below 0.5.
 */
export const ISLAND_DOT_ZOOM_MAX = -2.5;
export const STREET_PIN_ZOOM_MIN = 0.5;

/**
 * The kind of one place, or null when no D-2 kind claims it (shops,
 * interiors, community places and the rest keep their tag-resolved
 * glyph and layer colour). Personal markers are never kinded: a
 * marker's own colour/icon is the player's choice. `loot-collectibles`
 * is the one multi-kind layer — its items split by their own tags,
 * derived from the data model, never guessed:
 * - `meditation` → meditations, `magazine` → magazines,
 *   `watch` → watches, `trading-card` → cards;
 * - `scan` (the Wonder Whale sculpture scan) → WAiNK: it is a phone
 *   scan of a sculpture, the same interaction as a WAiNK spot, and
 *   the D-2 table has no separate scan kind. If a scan kind is ever
 *   added, this line moves to it.
 */
export function kindForPlace(
  place: Pick<Place, 'tags' | 'layerId'> & { kind?: string },
): KindId | null {
  if (place.layerId === 'my-markers') return null;
  if (place.layerId.startsWith('cards:')) return 'cards';
  if (place.layerId === 'loot-collectibles') {
    if (place.tags.includes('meditation')) return 'meditations';
    if (place.tags.includes('magazine')) return 'magazines';
    if (place.tags.includes('watch')) return 'watches';
    if (place.tags.includes('trading-card')) return 'cards';
    if (place.tags.includes('scan')) return 'waink';
    return null;
  }
  if (place.layerId === 'breakable') return 'breakable';
  if (place.layerId === 'gyms') return 'gyms';
  if (place.layerId === 'equipment') return 'equipment';
  if (place.layerId === 'shops-weapons') return 'weapons';
  return null;
}

/**
 * Plain residential (D-2): a house with no opportunity — residential
 * tag, not enterable, not in the Breakable homes layer. An enterable
 * residential place is breakable, never plain; a typed "?" whose index
 * category is `house` is plain too, including the tagless Capri houses
 * (their tags cannot say residential, the index job can).
 */
export function isPlainResidential(
  place: Pick<Place, 'tags' | 'layerId'>,
  aiRecord?: AiCategoryRecord | null,
): boolean {
  if (place.layerId === 'breakable') return false;
  if (place.tags.includes('enterable')) return false;
  if (place.tags.includes('residential')) return true;
  return effectiveAiCategory(aiRecord) === 'house';
}

/**
 * Dot or full pin for one place at one zoom (D-2 + D-6). A pin's glyph
 * must say what it IS, so a plain residential place gets NO full pin
 * below street zoom — a dot only — and collectible kinds shrink to
 * coloured dots at island zoom, full pins by district zoom. Everything
 * else is always a full pin (breakable houses keep the `home` glyph:
 * a breakable house IS a house).
 */
export function pinFormForPlace(
  place: Pick<Place, 'tags' | 'layerId'>,
  zoom: number,
  aiRecord?: AiCategoryRecord | null,
): 'dot' | 'pin' {
  if (isPlainResidential(place, aiRecord)) {
    return zoom >= STREET_PIN_ZOOM_MIN ? 'pin' : 'dot';
  }
  const kind = kindForPlace(place);
  if (kind && COLLECTIBLE_KIND_IDS.has(kind as CollectibleKindId)) {
    return zoom <= ISLAND_DOT_ZOOM_MAX ? 'dot' : 'pin';
  }
  return 'pin';
}

/**
 * A place's own colour tag (`color:#…`), carried by personal markers
 * (the player's chosen colour) — v0.33: moved here from marker-icon.ts
 * so the kind system stays Leaflet-free and node-testable. marker-icon
 * re-exports it; GTADB catalogue places carry no `color:` tag, so this
 * only ever fires for personal markers.
 */
export function markerColor(place: Pick<Place, 'tags'>): string | undefined {
  const tag = place.tags.find((tag) => tag.startsWith('color:'));
  return tag?.slice('color:'.length);
}

/**
 * The pin's colour + glyph for one place (D-2). The KIND colour wins
 * over the layer colour for kinded places — the layer row in the
 * filter sheet shows the same kind colour+glyph, so the sheet is the
 * legend. Otherwise the place keeps its own colour tag (personal
 * markers) or its layer colour, and its AI-resolved or tag-resolved
 * glyph. A found pin keeps this colour and gains a tick badge
 * (marker-icon.ts) — the style never changes with found state.
 */
export function pinStyleForPlace(
  place: Pick<Place, 'tags' | 'layerId' | 'evidence'> & {
    icon?: string;
    kind?: string;
  },
  layer: { style: { color: string } } | undefined,
  aiIcon: IconKey | null,
): { color: string; icon: IconKey } {
  const kind = kindForPlace(place);
  if (kind) return KIND_STYLES[kind];
  return {
    color: markerColor(place) ?? layer?.style.color ?? '#e8823a',
    icon: aiIcon ?? iconKeyForPlace(place),
  };
}

/** The glyph for one icon key, as a React component (chips, rows, sheets). */
export function PlaceIcon({
  icon,
  size = 16,
  className,
}: {
  icon: IconKey;
  size?: number;
  className?: string;
}) {
  const Icon = ICON_COMPONENTS[icon] as ComponentType<{
    size?: number | string;
    className?: string;
    strokeWidth?: number | string;
  }>;
  return <Icon size={size} className={className} strokeWidth={2} />;
}

/** The glyph for one icon key, as an SVG string (Leaflet divIcon pins). */
const svgCache = new Map<string, string>();
export function placeIconSvg(icon: IconKey, size = 17): string {
  const cacheKey = `${icon}:${size}`;
  const cached = svgCache.get(cacheKey);
  if (cached) return cached;
  const Icon = ICON_COMPONENTS[icon] as ComponentType<{
    size?: number | string;
    strokeWidth?: number | string;
    color?: string;
  }>;
  const markup = renderToStaticMarkup(
    <Icon size={size} strokeWidth={2.1} color="#fff" />,
  );
  svgCache.set(cacheKey, markup);
  return markup;
}

/**
 * GTADB tag → glyph. Ordered most specific first: a `#gas` place is a
 * petrol station even though it is also `retail`; a `#guns` place is a
 * gun shop even though it is also enterable. Tags not listed here fall
 * through to the layer default — never to a dot.
 */
const TAG_ICONS: Record<string, IconKey> = {
  '#gas': 'fuel',
  '#supermarket': 'shopping',
  '#clothes': 'shirt',
  '#shoes': 'shoes',
  '#hair': 'scissors',
  '#guns': 'crosshair',
  '#food': 'food',
  '#fastfood': 'pizza',
  '#vendor': 'store',
  '#electronics': 'tv',
  '#tattoos': 'brush',
  '#bar': 'bar',
  '#drinks': 'wine',
  '#liquor': 'wine',
  '#stripclub': 'sparkles',
  '#nightclub': 'nightclub',
  '#modshop': 'wrench',
  "#pay'n'spray": 'car',
  '#carwash': 'car',
  '#bikeshop': 'bike',
  '#pharmacy': 'pill',
  '#marina': 'anchor',
  '#police': 'shield',
  '#hospital': 'cross',
  '#tennis': 'trophy',
  '#metromover': 'train',
  '#metro': 'train',
  '#racetrack': 'flag',
  '#cinema': 'cinema',
  '#airport': 'plane',
  '#bus': 'bus',
  '#train': 'train',
  '#blimp': 'navigation',
  '#airbase': 'plane',
  '#ferriswheel': 'ferris',
  '#jail': 'lock',
  gym: 'gym',
  fitness: 'gym',
  workout: 'weight',
  equipment: 'weight',
  strength: 'gym',
  breakable: 'home',
  residential: 'home',
  hotel: 'bed',
  retail: 'store',
  restaurant: 'food',
  transportation: 'bus',
  industrial: 'factory',
  natural: 'tree',
  leisure: 'palmtree',
  government: 'landmark',
  office: 'building',
  service: 'wrench',
  utilities: 'zap',
  construction: 'hardhat',
  landmark: 'landmark',
  events: 'flag',
  public: 'users',
  agriculture: 'tree',
  'point-of-interest': 'pin',
  closed: 'lock',
  safehouse: 'key',
  supermarket: 'shopping',
};

/** AI-suggested type → glyph (same set, so a categorised "?" reads true). */
export function iconKeyForAiCategory(
  category: AiCategoryId,
  shopType?: string,
): IconKey {
  if (category === 'shop' && shopType) {
    const byShopType: Record<string, IconKey> = {
      supermarket: 'shopping',
      gas: 'fuel',
      petrol: 'fuel',
      food: 'food',
      restaurant: 'food',
      bar: 'bar',
      liquor: 'wine',
      pharmacy: 'pill',
      clothes: 'shirt',
      shoes: 'shoes',
      electronics: 'tv',
      hair: 'scissors',
    };
    const hit = byShopType[shopType.trim().toLowerCase()];
    if (hit) return hit;
    return 'store';
  }
  const map: Record<AiCategoryId, IconKey> = {
    gym: 'gym',
    house: 'home',
    shop: 'store',
    restaurant: 'food',
    bar: 'bar',
    petrol: 'fuel',
    services: 'wrench',
    leisure: 'palmtree',
    transport: 'bus',
    landmark: 'landmark',
    other: 'pin',
  };
  return map[category];
}

/** Layer → glyph, for layer rows and overlay chips. */
export function iconKeyForLayer(layerId: string): IconKey {
  if (layerId.startsWith('cards:')) return 'gem';
  const map: Record<string, IconKey> = {
    regions: 'pin',
    community: 'pin',
    interiors: 'door',
    'shops-weapons': 'crosshair',
    'shops-style': 'shirt',
    'shops-food': 'food',
    'shops-vehicles': 'car',
    lootable: 'dollarsign',
    'loot-heists': 'banknote',
    // v0.33 D-2: loot-collectibles is the one MULTI-kind layer
    // (meditations, magazines, watches, cards, one scan) — no single
    // kind glyph can stand for it, so the row keeps the layer mark
    // (teal sparkles) while each pin carries its own kind colour +
    // glyph. Single-kind layers show their kind glyph here, so the
    // sheet is the legend for those.
    'loot-collectibles': 'sparkles',
    gyms: 'gym',
    equipment: 'weight',
    uncertain: 'question',
    'my-markers': 'star',
  };
  return map[layerId] ?? 'pin';
}

/**
 * The glyph for one place. Priority: the AI-suggested type (when the
 * user has one and it counts — a categorised "?" shows its type, not
 * a "?"), then the D-2 kind (a kinded place wears its kind glyph),
 * then the most specific GTADB tag, then "enterable" alone, then the
 * layer glyph. Personal markers keep their own star/flag/pin
 * (a workout spot is always a dumbbell).
 */
export function iconKeyForPlace(
  place: Pick<Place, 'tags' | 'layerId' | 'evidence'> & {
    icon?: string;
    kind?: string;
  },
  aiCategory?: { category: AiCategoryId; shopType?: string } | null,
): IconKey {
  if (aiCategory) return iconKeyForAiCategory(aiCategory.category, aiCategory.shopType);
  if (place.layerId === 'my-markers') {
    if (place.kind === 'workout') return 'gym';
    if (place.kind === 'breakable') return 'home';
    if (place.icon === 'star') return 'star';
    if (place.icon === 'flag') return 'flag';
    return 'pin';
  }
  // v0.33 D-2: a kinded place wears its kind glyph everywhere — map
  // pins, chips, layer rows, detail sheets, search results, Ask
  // answers — so a meditation reads as a moon in every surface, not
  // just on the map. Kind beats tags: a gyms-layer place tagged
  // 'workout' is a member gym (gym), not equipment (weight); a
  // breakable house keeps `home` in its breakable colour.
  const kind = kindForPlace(place);
  if (kind) return KIND_STYLES[kind].icon;
  for (const tag of place.tags) {
    const hit = TAG_ICONS[tag];
    if (hit) return hit;
  }
  if (place.tags.includes('enterable')) return 'door';
  if (place.layerId === 'uncertain') return 'question';
  return iconKeyForLayer(place.layerId);
}

/** Convenience: resolve the AI record for a place to an icon, or null. */
export function iconKeyForAiRecord(
  record: AiCategoryRecord | undefined | null,
): IconKey | null {
  const category = effectiveAiCategory(record);
  if (!category || !record) return null;
  return iconKeyForAiCategory(
    category,
    record.status === 'corrected' ? record.userShopType : record.shopType,
  );
}
