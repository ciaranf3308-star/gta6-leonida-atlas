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
): Place {
  return {
    id,
    title,
    description: `${title} — ${area}. Membership: ${membership}. ${
      position
        ? 'Approximate community pin — verify in game.'
        : 'No verified coordinates yet — listed here so it can be found by name, not placed on the map.'
    } Working out raises Strength and Cardio.`,
    category: 'business',
    position,
    layerId: 'gyms',
    tags: ['gym', 'strength', 'fitness'],
    region: area,
    source: { title: sourceTitle, url: sourceUrl },
    evidence: 'approximate',
  };
}

export const GYM_PLACES: Place[] = [
  gym(
    'gym:muscle-sands',
    'Muscle Sands',
    'Ocean Beach, Vice Beach',
    'Free',
    { x: 2019, y: 407 },
    'https://gta6gps.com/?p=gyms-9',
    'GTA6 GPS · approximate pin',
  ),
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
