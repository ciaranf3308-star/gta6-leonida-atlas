import type { Place } from '../domain/types';

/**
 * Gyms / Strength layer — where to work out in Leonida.
 *
 * Verified against two independent post-launch guides (PowerPyx's gym list and
 * GTA6 GPS's gym pages, checked 23 Nov 2026): there are 9 gyms, all in the
 * Vice City area, with the membership prices below. Coordinates come from
 * GTA6 GPS's per-gym pages, except Ajax Gym, which is tagged #gym in the
 * bundled GTADB catalogue itself (record L1869).
 *
 * The 9 gyms split into 8 member gyms (GYM_PLACES) and 1 free outdoor gym,
 * Muscle Sands, which lives in OUTDOOR_GYM_PLACES with the other free
 * public equipment: the home gym on Jason's house deck (Chapter 1 only).
 * No other free outdoor equipment spots have a verified position in any
 * source checked — outdoor gear is unmarked in game, so the rest is for
 * your own markers when you find it.
 *
 * Two gyms have NO verified coordinates in any source checked, so they are
 * listed with position: null (searchable only, never guessed) — the Atlas
 * convention for unknown positions. Do not invent coordinates for them.
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
 * Free / outdoor public equipment — no membership, no building to enter.
 * Muscle Sands is the free outdoor gym from the 9 (Ocean Beach); Jason's
 * house deck is the free home gym from Chapter 1. Jason's deck position is
 * GTADB's position for Jason's House itself (record L266); the deck gear
 * (squat rack, pull-up bar, bench, deadlift bar, kettlebells, punching bag
 * underneath) is per post-launch guides. The house — and the deck with it —
 * closes when Chapter 1 ends.
 */
export const OUTDOOR_GYM_PLACES: Place[] = [
  gym(
    'gym:muscle-sands',
    'Muscle Sands',
    'Ocean Beach, Vice Beach',
    'Free — outdoor gym on the beach',
    { x: 2019, y: 407 },
    'https://gta6gps.com/?p=gyms-9',
    'GTA6 GPS · approximate pin',
    'gyms-outdoor',
    ['free', 'outdoor'],
  ),
  gym(
    'gym:jason-house-deck',
    "Jason's house deck (home gym)",
    'Key Lento, Leonida Keys',
    'Free — Chapter 1 only',
    { x: -2353.531, y: -5532.255 },
    'https://map.gtadb.org',
    'GTADB / Map GTA · CC BY 4.0 (Jason’s House, record L266)',
    'gyms-outdoor',
    ['free', 'outdoor', 'home'],
    'Home gym on the lower deck: squat rack, pull-up bar, bench press, deadlift bar and kettlebells, with a punching bag underneath the house. Strength only; the house closes when Chapter 1 ends.',
  ),
];
