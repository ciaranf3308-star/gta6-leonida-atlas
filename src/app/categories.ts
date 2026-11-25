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

/** Kinds of places — the "Kind" picker in Find and the marker editor. */
export const CATEGORIES: { id: Category | 'all'; name: string }[] = [
  { id: 'all', name: 'All kinds' },
  ...CATEGORY_GROUPS.map(({ id, name }) => ({ id, name })),
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
    'No verified Ammu-Nation yet — the 6 #guns records in the public data are 4 unnamed “?” places and 2 lootable shops, so no gun shop has a verified name of its own yet.',
  style:
    'No verified clothing, tattoo, hair or shoe shops yet — the 23 #clothes / #hair / #tattoos / #shoes records are all unnamed “?” places or filed under Robberies / Breakable homes, so there is no Style shop layer to turn on yet.',
};
