import type { Place } from '../domain/types';

/**
 * Gyms vs workout equipment — two different things, two different layers
 * (user correction, 2026-11-23 23:18: "I'm not looking for gyms I'm
 * looking for workout equipment!!").
 *
 * GYM_PLACES — 8 member gyms, all in Vice City, verified against two
 * independent post-launch guides (PowerPyx's gym list and GTA6 GPS's gym
 * pages, checked 23 Nov 2026), with the membership prices below.
 * Coordinates come from GTA6 GPS's per-gym pages, except Ajax Gym, which
 * is tagged #gym in the bundled GTADB catalogue itself (record L1869).
 *
 * EQUIPMENT_PLACES — free public workout equipment, no membership: Muscle
 * Sands outdoor gym (Ocean Beach), the home gym on Jason's house deck
 * (Chapter 1 only) and the bench by the pool at the Starlet Motel, Port
 * Gellhorn (Chapter 2 only — confirmed by three independent guides, Nov
 * 2026: gta6activities.com's gym page, gta-xtreme's Chapter 2 gym guide
 * and The Games Wiki's Starlet Motel page; all agree it is a free
 * open-air bench by the motel pool, no membership). The bench has NO
 * verified coordinates in any source checked — no guide pins the bench
 * itself, only the motel (GTADB L304) and its pool (L1159) — so it is
 * listed with position: null (searchable only, never guessed), like the
 * two member gyms without coordinates. Do not invent coordinates for it.
 * Basketball hoops are dotted around Leonida too, but no source lists
 * their positions, so none is added — the same rule.
 *
 * A search or question for "workout", "equipment", "bench" or "weights"
 * answers from EQUIPMENT_PLACES first — never from the member gyms.
 * What the user knows about Capri (equipment in a garage in a house)
 * is in no public source at all, so it is not a pin here: it becomes
 * one only when he marks that house himself.
 *
 * Three places have NO verified coordinates in any source checked — two
 * member gyms plus the Starlet Motel bench — so they are listed with
 * position: null (searchable only, never guessed), the Atlas convention
 * for unknown positions. Do not invent coordinates for them.
 */
function gym(
  id: string,
  title: string,
  area: string,
  membership: string,
  position: { x: number; y: number } | null,
  sourceUrl: string,
  sourceTitle: string,
  layerId = 'gyms',
  extraTags: string[] = [],
  note = '',
): Place {
  return {
    id,
    title,
    description: `${title} — ${area}. Membership: ${membership}. ${
      position
        ? 'Approximate community pin — verify in game.'
        : 'No verified coordinates yet — listed here so it can be found by name, not placed on the map.'
    } Working out raises Strength and Cardio.${note ? ` ${note}` : ''}`,
    category: 'business',
    position,
    layerId,
    tags: ['gym', 'strength', 'fitness', ...extraTags],
    region: area,
    source: { title: sourceTitle, url: sourceUrl },
    evidence: 'approximate',
  };
}

export const GYM_PLACES: Place[] = [
  gym(
    'gym:grand-majestic',
    'Grand Majestic Gym',
    'Tequesta, Vice City',
    '$250',
    { x: -1035, y: -1249 },
    'https://gta6gps.com/?p=gyms-1',
    'GTA6 GPS · approximate pin',
  ),
  gym(
    'gym:vice-seven',
    'Vice Seven Condominiums Gym',
    'Tequesta, Vice City',
    '$450',
    null,
    'https://gta6gps.com/?p=gyms-2',
    'GTA6 GPS · no verified coordinates',
  ),
  gym(
    'gym:dynamix',
    'Dynamix Fitness',
    'Vice City',
    '$600',
    { x: -366, y: 1514 },
    'https://gta6gps.com/?p=gyms-4',
    'GTA6 GPS · approximate pin',
  ),
  gym(
    'gym:venus',
    'Venus Fitness',
    'Ocean Beach, Vice Beach',
    '$600',
    null,
    'https://gta6gps.com/?p=gyms-7',
    'GTA6 GPS · no verified coordinates',
  ),
  gym(
    'gym:zenith',
    'Zenith',
    'Downtown, Vice City',
    '$750',
    { x: -826, y: -566 },
    'https://gta6gps.com/?p=gyms-3',
    'GTA6 GPS · approximate pin',
  ),
  gym(
    'gym:aichi',
    'Aichi Condominiums Outdoor Gym',
    'Washington Beach, Vice Beach',
    '$950',
    { x: 1472, y: 2643 },
    'https://gta6gps.com/?p=gyms-6',
    'GTA6 GPS · approximate pin',
  ),
  gym(
    'gym:y-hotel',
    'Y Hotel Fitness Club',
    'Vice Beach',
    '$1,200',
    { x: 1893, y: 1601 },
    'https://gta6gps.com/?p=gyms-8',
    'GTA6 GPS · approximate pin',
  ),
  gym(
    'gym:ajax',
    'Ajax Gym',
    'SW 4th St, Vice Beach',
    '$1,800',
    { x: 1420.182, y: 1766.116 },
    'https://map.gtadb.org',
    'GTADB / Map GTA · CC BY 4.0 (record L1869, tagged #gym)',
  ),
];

/**
 * Free public workout equipment — no membership, no building to enter.
 * Muscle Sands is the free outdoor gym from the 9 (Ocean Beach); Jason's
 * house deck is the free home gym from Chapter 1. Jason's deck position is
 * GTADB's position for Jason's House itself (record L266); the deck gear
 * (squat rack, pull-up bar, bench, deadlift bar, kettlebells, punching bag
 * underneath) is per post-launch guides. The house — and the deck with it —
 * closes when Chapter 1 ends. The Starlet Motel bench is the Chapter 2
 * equivalent: free weights by the motel pool in Port Gellhorn, gone when
 * the stay ends with Checking Out — but with no verified pin of its own.
 */
export const EQUIPMENT_PLACES: Place[] = [
  gym(
    'gym:muscle-sands',
    'Muscle Sands',
    'Ocean Beach, Vice Beach',
    'Free — outdoor gym on the beach',
    { x: 2019, y: 407 },
    'https://gta6gps.com/?p=gyms-9',
    'GTA6 GPS · approximate pin',
    'equipment',
    ['free', 'outdoor', 'equipment', 'workout'],
  ),
  gym(
    'gym:jason-house-deck',
    "Jason's house deck (home gym)",
    'Key Lento, Leonida Keys',
    'Free — Chapter 1 only',
    { x: -2353.531, y: -5532.255 },
    'https://map.gtadb.org',
    'GTADB / Map GTA · CC BY 4.0 (Jason’s House, record L266)',
    'equipment',
    ['free', 'outdoor', 'home', 'equipment', 'workout'],
    'Home gym on the lower deck: squat rack, pull-up bar, bench press, deadlift bar and kettlebells, with a punching bag underneath the house. Strength only; the house closes when Chapter 1 ends.',
  ),
  gym(
    'gym:starlet-motel-bench',
    'Starlet Motel bench',
    'Port Gellhorn, Kelly County',
    'Free — Chapter 2 only',
    null,
    'https://www.gta6activities.com/activities/gym',
    'gta6activities.com · no verified coordinates',
    'equipment',
    ['free', 'outdoor', 'equipment', 'workout'],
    'Open-air bench by the motel pool — walk around the pool toward the lifebuoy; the bench, barbell and weights are beside it. No verified pin yet: the bench’s own spot is not in any map data, so this is listed by name only. The motel itself is on the map as Starlet Motel (GTADB L304) with its pool (L1159). Gone when the stay ends with Checking Out.',
  ),
];
