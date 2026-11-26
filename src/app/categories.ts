import type { Category, MapIndexCategory } from '../domain/types';
import type { IconKey } from '../features/map/place-icons';

/**
 * The game's own Map Index categories (pause map → D-pad Right → Map
 * Index), in the game's order, with the game's own icons:
 * Personal = arrow, Story = diary, Robberies = cash sack, Activities =
 * weights, Exploration = magnifying glass, Vehicles = car, Weapons =
 * gun, Style = shirt, Food & Drink = fork & knife.
 *
 * There is NO "Business" in the game — shops are split across Weapons,
 * Style, Food & Drink, Vehicles and Robberies — and "Personal" in the
 * game means your vehicles, safehouse/residence, owned garages and
 * ATMs, never your own notes. Those live under "My markers".
 *
 * Collectibles is the game's Progress > Collections (cards, WAiNK,
 * flamingos…). Unverified is not a game category: places with no
 * confirmed name or use yet, kept separate rather than forced in.
 */

export interface CategoryInfo {
  id: Category;
  name: string;
  icon: IconKey;
  /** One line for the Browse tiles and the Layers groups. */
  blurb: string;
}

export const MAP_INDEX_GROUPS: { id: MapIndexCategory; name: string; icon: IconKey; blurb: string }[] = [
  {
    id: 'personal',
    name: 'Personal',
    icon: 'navigation',
    blurb: 'Your vehicles, safehouse, owned garages and ATMs.',
  },
  {
    id: 'story',
    name: 'Story',
    icon: 'book',
    blurb: 'Main and optional missions.',
  },
  {
    id: 'robberies',
    name: 'Robberies',
    icon: 'banknote',
    blurb: 'Banks, stick-up targets, gang hideouts, drop-offs.',
  },
  {
    id: 'activities',
    name: 'Activities',
    icon: 'weight',
    blurb: 'Races, ranges, golf, hunting, fishing, gyms, clubs.',
  },
  {
    id: 'exploration',
    name: 'Exploration',
    icon: 'search',
    blurb: 'Points of interest, optional quests, stunt and base jumps.',
  },
  {
    id: 'vehicles',
    name: 'Vehicles',
    icon: 'car',
    blurb: 'Mod shops, Pay ’n’ Spray, gas, EV chargers, car washes, rentals, transit.',
  },
  {
    id: 'weapons',
    name: 'Weapons',
    icon: 'crosshair',
    blurb: 'Ammu-Nation locations.',
  },
  {
    id: 'style',
    name: 'Style',
    icon: 'shirt',
    blurb: 'Clothing, tattoos, hair & makeup.',
  },
  {
    id: 'food-drink',
    name: 'Food & Drink',
    icon: 'food',
    blurb: 'Bars, cafes, convenience stores, fast food, liquor stores.',
  },
];

/** The extra groups, after the game's nine, in display order. */
export const EXTRA_GROUPS: { id: Category; name: string; icon: IconKey; blurb: string }[] = [
  {
    id: 'collectibles',
    name: 'Collectibles',
    icon: 'gem',
    blurb: 'Progress > Collections — cards, WAiNK, flamingos and more.',
  },
  {
    id: 'my-markers',
    name: 'My markers',
    icon: 'star',
    blurb: 'Your own notes on the map. Never spoilers, always on.',
  },
  {
    id: 'unverified',
    name: 'Unverified',
    icon: 'question',
    blurb: 'No confirmed name or use yet — kept separate, never guessed.',
  },
];

export const CATEGORY_GROUPS: CategoryInfo[] = [...MAP_INDEX_GROUPS, ...EXTRA_GROUPS];

/** Kinds of places — the "Kind" picker in Find and the category tiles.
 * The blurb rides along so the picker says what the game's term means:
 * "Style" on its own never told anyone it was clothes, hair and
 * tattoos (reported 2026-11-25). */
export const CATEGORIES: { id: Category | 'all'; name: string; blurb?: string }[] = [
  { id: 'all', name: 'All kinds' },
  ...CATEGORY_GROUPS.map(({ id, name, blurb }) => ({ id, name, blurb })),
];

const CATEGORY_NAMES = new Map<Category, string>(
  CATEGORY_GROUPS.map(({ id, name }) => [id, name]),
);

/** Display name for a stored category id ("food-drink" → "Food & Drink"). */
export function categoryLabel(category: Category): string {
  return CATEGORY_NAMES.get(category) ?? category;
}

/**
 * Honest empty notes for groups with no verified places yet. Personal
 * and Story have 0 places in the public data — the note says so instead
 * of inventing pins. A group with layers never shows its note.
 */
export const EMPTY_GROUP_NOTES: Partial<Record<Category, string>> = {
  personal:
    'No verified places yet — your safehouse, owned garages and ATMs are not in the public map data, so there is nothing to turn on here. Your own markers are under My markers below.',
  story:
    'Missions are not mapped yet — the atlas covers places, not the story so far.',
  weapons:
    '3 verified gun shops are in the data — Phil’s Ammu-Nation, Pawn & Gun, Gellhorn Outfitters. The community list names 24 Ammu-Nations; ~19 have no position in any licensed dataset yet.',
  // No style entry: Style has 7 verified shops (Stock 305, A1 Fashions,
  // Electric Fang Tattoo, Sara's, Kurt's, The Old Mill, Au Courant).
  // It had one until v0.31.3, when the filing put the other six back —
  // see STYLE_SHOP_TAGS in src/data/catalogue.ts. (We Have Shoes, the
  // eighth named Style shop, is tagged demolished and stays Unverified.)
};
