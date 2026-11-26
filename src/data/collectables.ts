import type { Place } from '../domain/types';
import { GENERATED_CARD_PLACES } from './card-checklist-pins.generated';

/**
 * Collectible trading cards — all 18 sets, 480 cards in total (PowerPyx's
 * launch-day list, via GTA6Info). Completing 3 sets unlocks Don't Touch My
 * Deck; 15 sets are required for the 100% checklist.
 *
 * Honest state of the data, 26 Nov 2026: 37 cards have a published
 * location precise enough to pin (plus 3 Loot Map dancer cards in
 * loot-map.ts, so 40 cards in the catalogue). A card is only pinned
 * here when the guide names a host building that exists in the GTADB
 * catalogue, and the pin sits on that host building's verified GTADB
 * position with the exact spot described in the pin — the pin is the
 * building, not the shelf. A venue pin (mine tunnel, airfield parts
 * room, raceway sign, railyard control building) sits on the venue's
 * GTADB record and says so in the description. The other 440 cards
 * have no verified position in any source checked and are NOT placed
 * by guess. Drop your own marker when you find one.
 *
 * The 17 newest pins come from lorenzone.fr's written directions
 * (480 slots, 490 pickups), hand-matched to GTADB host buildings by
 * scripts/build-card-checklist.mjs — see
 * src/data/card-checklist-pins.generated.ts. The full 480-slot
 * checklist — every slot trackable whether pinned or not — lives in
 * src/data/card-checklist.generated.ts, built over a six.mics.dev
 * identity backbone (596 game-text tiers, 230 people). No printed
 * card text (© Rockstar) or artwork (no licence) is bundled.
 *
 * Sources: gtadb.net's Collectible Cards guide (148 named leads,
 * updated 22 Nov 2026) and GTA6Info's Collectible Cards page (Push
 * Square's launch-day guide). No machine-readable card source exists:
 * gtadb.net's 475 map positions are NOT published in the public
 * gtadb.org repo — map/data/6 holds landmarks.json only, api.py has
 * no cards endpoint, and the interactive map's marker data is served
 * by that site's own app — so these pins come from the written
 * guides, host-building rule unchanged. Nothing was scraped from
 * the closed map.
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
    category: 'collectibles',
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
 *
 * 26 Nov 2026: 15 more cards from gtadb.net's Collectible Cards guide
 * (148 named leads) and GTA6Info, each pinned to its named host
 * building's current 2e9e194 GTADB position. The first five cards keep
 * their original positions — Starlet Motel L304 has moved ~19 m between
 * snapshot revisions, so Bryson Powers (new, current L304 position) sits
 * ~19 m from Vicki / Victor Maravilla (original positions); same motel,
 * never nudged. Venue pins (Perla, Chrissie, Luke X, Braelynn) sit on
 * the venue's GTADB record and say so.
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
    'Kyle Lewicki (teal)',
    'vice-city-narcos',
    'Vice City Narcos',
    'On a bench in the rear corridor of Dynamix Fitness, Bayside, Vice City. Set per gtadb.net; GTA6Info lists this card’s set as unclear.',
    { x: -366, y: 1514 },
    'Dynamix Fitness, Vice City (GTA6 GPS approximate pin)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  // Delights Dancers — the set the user asked about (26 Nov 2026).
  card(
    'card:jason',
    'Jason',
    'delights-dancers',
    'Delights Dancers',
    'Delights, Port Gellhorn: search the bathroom counter inside Delights.',
    { x: -6373.0411029991965, y: 3576.79259599525 },
    'Delights, Port Gellhorn (GTADB L629)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:kandi',
    'Kandi',
    'delights-dancers',
    'Delights Dancers',
    'First upstairs apartment above Farmacia Tu Salud, near Northbrook Drive and NW 4th Avenue in Little Cuba: search the bathroom.',
    { x: -1207.777, y: -41.732 },
    'Farmacia, Little Cuba, Vice City (GTADB L3078)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:perla',
    'Perla',
    'delights-dancers',
    'Delights Dancers',
    'Rail yard in northern Balsero: climb to the elevated control building; the card is on the electrical box against its outer wall. Pin is the railyard record — the control building is part of the yard.',
    { x: -2200.02, y: 701.758 },
    'Railyard, Balsero, Vice City (GTADB L1603)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:ulysses-whitlock',
    'Ulysses Whitlock (silver)',
    'vice-city-flamingos',
    'Vice City Flamingos',
    'Helipad rooftop of Penny Haus, east of the Grand Majestic gym, Tequesta: take the building lift, then climb the spiral stairs.',
    { x: -757.9366292362162, y: -1257.9183082743361 },
    'Penny Haus, Tequesta, Vice City (GTADB L233)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:bryson-powers',
    'Bryson Powers',
    'vice-city-narcos',
    'Vice City Narcos',
    'Starlet Motel laundry room, Port Gellhorn: inspect the top of the washing machine. Pick it up on the Chapter 2 visit with Vicki and Victor Maravilla.',
    { x: -5365.916099322314, y: 3476.416854288034 },
    'Starlet Motel, Kelly County (GTADB L304)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:tusi-taufua',
    'Tusi Taufua',
    'vice-city-manatees',
    'Vice City Manatees',
    'Kitchen on the same floor as Grand Majestic Gym, Tequesta.',
    { x: -1065.2067607601375, y: -1317.2765616827874 },
    'Grand Majestic, Tequesta, Vice City (GTADB L240)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:anthony-poke-ii',
    'Anthony Poke II (red)',
    'liberty-city-wrath',
    'Liberty City Wrath',
    'Upper hallway of Ajax Gym, Washington Beach (Oldby Island); the guide describes roof and interior access.',
    { x: 1420.182, y: 1766.116 },
    'Ajax Gym, SW 4th St, Vice Beach (GTADB L1869)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:brianna-blue-purple',
    'Brianna Blue (purple)',
    'jack-of-hearts-dancers',
    'Jack of Hearts Dancers',
    'Xero station near US-183 and South Cunningham Drive in southeastern Capri (the south-eastern Capri Xero): search the noticeboard in the rear staff room.',
    { x: -6234.496295879728, y: -762.9623186150181 },
    'Xero Gas Station, Capri (GTADB L1612)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:pricilla-pace-gold',
    'Pricilla Pace (gold)',
    'jack-of-hearts-dancers',
    'Jack of Hearts Dancers',
    'Leonida Brewing Company warehouse between Sweetbay Road and the railway in Capri: climb the tower at the back of the building to reach the card.',
    { x: -6405.362436345714, y: 484.31413707708396 },
    'Leonida Brewing Company, Capri (GTADB L3637)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:braelynn-pink',
    'Braelynn (pink)',
    'nine1nine-dancers',
    'Nine1Nine Dancers',
    'Gellhorn Raceway: search the ledge behind the large Xero Gas sign beside the track. Pin is the raceway record — the sign stands beside the track.',
    { x: -6733.309499999999, y: 2325.4455000000003 },
    'Gellhorn International Raceway, Port Gellhorn (GTADB L281)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:meghan-bronze',
    'Meghan (bronze)',
    'nine1nine-dancers',
    'Nine1Nine Dancers',
    'Upstairs storage area at Vice City Pawn, Crosstown: search the shelving.',
    { x: -660, y: 1162.5 },
    'Vice City Pawn, Crosstown, Vice City (GTADB L539)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:chrissie-deep-red',
    'Chrissie (deep red)',
    'nine1nine-dancers',
    'Nine1Nine Dancers',
    'MacAlister Gold Mine tunnel in Moreau: search the red blanket among the discarded items. Pin is the mine record — the tunnel is part of the mine.',
    { x: -4115.015262678639, y: 6942.891316175541 },
    'MacAlister Gold Mine, Leonida (GTADB L996)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:flamer-red',
    'Flamer (red)',
    'right-wing-americas-hero',
    "Right Wing: America's Hero",
    'Upper walkway of Williams Guest House in central Grayson.',
    { x: -5603.934982168612, y: 6865.050212722604 },
    'Williams Guest House, Grayson (GTADB L3783)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:right-wing-red',
    'Right Wing (red)',
    'right-wing-americas-hero',
    "Right Wing: America's Hero",
    'Small table in the Bayside Apartments lobby, Bayside.',
    { x: -472.69446322379815, y: 1218.9317204733493 },
    'Bayside Apartments, Bayside, Vice City (GTADB L475)',
    'https://gtadb.net/articles/gta-6-collectible-cards-locations-guide/',
    'gtadb.net · Collectible Cards guide',
  ),
  card(
    'card:luke-x',
    'Luke X',
    'backyard-wrestling',
    'Backyard Wrestling',
    'Wild Hog Point airfield west of Port Gellhorn: parts room full of numbered red storage bins. Pin is the airfield record — the parts room is part of the airfield complex.',
    { x: -7562.852683676938, y: 3276.5642285778686 },
    'Wild Hog Point, Kelly County (GTADB L3434)',
    'https://gta6info.com/wiki/Collectible_Cards',
    'GTA6Info · Collectible Cards',
  ),
  // 26 Nov 2026: 17 more cards from lorenzone.fr's written directions,
  // hand-matched to GTADB host buildings (see the generated file).
  ...GENERATED_CARD_PLACES,
];
