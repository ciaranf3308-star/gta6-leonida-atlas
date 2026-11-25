import type { ComponentType } from 'react';
import {
  Anchor,
  Banknote,
  BedDouble,
  Bike,
  BookOpen,
  Building2,
  Bus,
  Car,
  CircleDollarSign,
  CircleQuestionMark,
  Clapperboard,
  Cross,
  Crosshair,
  Disc3,
  DoorOpen,
  Dumbbell,
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
  MapPin,
  Map as MapIcon,
  Martini,
  Music,
  Navigation,
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
  Train,
  TreePine,
  Trophy,
  Tv,
  Users,
  UtensilsCrossed,
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
  | 'book';

export const ICON_COMPONENTS: Record<IconKey, LucideIcon> = {
  anchor: Anchor,
  banknote: Banknote,
  bed: BedDouble,
  bike: Bike,
  book: BookOpen,
  building: Building2,
  bus: Bus,
  car: Car,
  question: CircleQuestionMark,
  cinema: Clapperboard,
  cross: Cross,
  crosshair: Crosshair,
  dollarsign: CircleDollarSign,
  nightclub: Disc3,
  door: DoorOpen,
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
  pin: MapPin,
  bar: Martini,
  music: Music,
  navigation: Navigation,
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
  train: Train,
  tree: TreePine,
  trophy: Trophy,
  tv: Tv,
  users: Users,
  food: UtensilsCrossed,
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
 * a "?"), then the most specific GTADB tag, then "enterable" alone,
 * then the layer glyph. Personal markers keep their own star/flag/pin
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
