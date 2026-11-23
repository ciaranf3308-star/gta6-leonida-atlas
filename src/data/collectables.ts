import type { Place } from '../domain/types';

/**
 * Collectible trading cards — all 18 sets, 480 cards in total (PowerPyx's
 * launch-day list, via GTA6Info). Completing 3 sets unlocks Don't Touch My
 * Deck; 15 sets are required for the 100% checklist.
 *
 * Honest state of the data, 23 Nov 2026: only a handful of cards have a
 * published location precise enough to pin. A card is only pinned here when
 * the guide names a host building that exists in the GTADB catalogue, and
 * the pin sits on that host building's verified GTADB position with the
 * exact spot described in the pin — the pin is the building, not the shelf.
 * The other 475 cards have no verified position in any source checked and
 * are NOT placed by guess. Drop your own marker when you find one.
 *
 * Set sizes below are the reported in-game totals, not pinned counts.
 */
export interface CollectableSet {
  id: string;
  name: string;
  size: number;
}

export const COLLECTABLE_SETS: CollectableSet[] = [
  { id: 'vice-city-flamingos', name: 'Vice City Flamingos', size: 24 },
  { id: 'vice-city-narcos', name: 'Vice City Narcos', size: 24 },
  { id: 'vice-city-manatees', name: 'Vice City Manatees', size: 24 },
  { id: 'vice-city-club-de-futbol', name: 'Vice City Club De Fútbol', size: 30 },
  { id: 'liberty-city-swingers', name: 'Liberty City Swingers', size: 24 },
  { id: 'liberty-city-penetrators', name: 'Liberty City Penetrators', size: 24 },
  { id: 'liberty-city-wrath', name: 'Liberty City Wrath', size: 24 },
  { id: 'los-santos-corkers', name: 'Los Santos Corkers', size: 24 },
  { id: 'los-santos-panic', name: 'Los Santos Panic', size: 24 },
  { id: 'los-santos-pounders', name: 'Los Santos Pounders', size: 24 },
  { id: 'backyard-wrestling', name: 'Backyard Wrestling', size: 12 },
  { id: 'americas-next-top-hooker', name: "America's Next Top Hooker", size: 24 },
  { id: 'delights-dancers', name: 'Delights Dancers', size: 18 },
  { id: 'jack-of-hearts-dancers', name: 'Jack of Hearts Dancers', size: 36 },
  { id: 'nine1nine-dancers', name: 'Nine1Nine Dancers', size: 36 },
  { id: 'the-legends-of-ratface', name: 'The Legends of Ratface', size: 36 },
  { id: 'right-wing-americas-hero', name: "Right Wing: America's Hero", size: 36 },
  { id: 'ed-comics-universe', name: 'Ed Comics Universe', size: 36 },
];

export const COLLECTABLE_TOTAL = COLLECTABLE_SETS.reduce((sum, set) => sum + set.size, 0);

function card(
  id: string,
  title: string,
  setId: string,
  setName: string,
  where: string,
  position: { x: number; y: number },
  host: string,
  sourceUrl: string,
  sourceTitle: string,
): Place {
  return {
    id,
    title: `${title} — ${setName}`,
    description: `Collectible card, ${setName} set. ${where} Pin is the host building's verified GTADB position (${host}); the exact spot inside is as described.`,
    category: 'landmark',
    position,
    layerId: `cards:${setId}`,
    tags: ['collectible', 'trading-card', setId, 'card'],
    region: host,
    source: { title: sourceTitle, url: sourceUrl },
    evidence: 'approximate',
  };
}

/**
 * The only cards with a host building in GTADB (Starlet Motel L304,
 * Gellhorn Drive-In Theatre L3658) or at a verified gym position
 * (Dynamix Fitness, GTA6 GPS). Locations per GTA6Info's Collectible Cards
 * page (Push Square's launch-day guide) unless noted.
 */
export const COLLECTABLE_CARD_PLACES: Place[] = [
  card(
    'card:vicki',
    'Vicki',
    'delights-dancers',
    'Delights Dancers',
    'Starlet Motel, Port Gellhorn: go through the door on the right opposite the reception counter; the card is on the floor in the toilet on the left.',
    { x: -5354.67, y: 3461.862 },
    'Starlet Motel, Kelly County (GTADB L304)',
    'https://gta6info.com/wiki/Collectible_Cards',
    'GTA6Info · Collectible Cards (Push Square)',
  ),
  card(
    'card:victor-maravilla',
    'Victor Maravilla',
    'los-santos-corkers',
    'Los Santos Corkers',
    'Starlet Motel kitchen, Port Gellhorn, stuck to the fridge on the west side of the room. Pick it up before the end of Chapter 2.',
    { x: -5354.67, y: 3461.862 },
    'Starlet Motel, Kelly County (GTADB L304)',
    'https://gta6info.com/wiki/Collectible_Cards',
    'GTA6Info · Collectible Cards (Push Square)',
  ),
  card(
    'card:reggie-pierce',
    'Reggie Pierce',
    'vice-city-manatees',
    'Vice City Manatees',
    'Roof of the drive-in theatre north of the Pay ’n’ Spray, Port Gellhorn.',
    { x: -6570.253279357878, y: 3976.339424556506 },
    'Gellhorn Drive-In Theatre, Port Gellhorn (GTADB L3658)',
    'https://gta6info.com/wiki/Collectible_Cards',
    'GTA6Info · Collectible Cards (Push Square)',
  ),
  card(
    'card:lexi-campbell',
    'Lexi Campbell (gold)',
    'jack-of-hearts-dancers',
    'Jack of Hearts Dancers',
    'Storage room of the drive-in theatre north of the Pay ’n’ Spray, Port Gellhorn.',
    { x: -6570.253279357878, y: 3976.339424556506 },
    'Gellhorn Drive-In Theatre, Port Gellhorn (GTADB L3658)',
    'https://gta6info.com/wiki/Collectible_Cards',
    'GTA6Info · Collectible Cards (Push Square)',
  ),
  card(
    'card:kyle-lewicky',
    'Kyle Lewicky',
    'vice-city-narcos',
    'Vice City Narcos',
    'On a bench in the rear corridor of Dynamix Fitness, Bayside, Vice City. Set per gtadb.net; GTA6Info lists this card’s set as unclear.',
    { x: -366, y: 1514 },
    'Dynamix Fitness, Vice City (GTA6 GPS approximate pin)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
];
