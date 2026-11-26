// Regression: personal markers must not nuke the game database.
//
// v0.32 acceptance demos (step 8): restoring the seeded v3 backup —
// which carries two markers (custom:capri-gym, custom:breakable-house)
// — left the journal stuck on "Collections load with the map…"
// forever, with Progress and Ask degraded the same way. Cause:
// App passed catalogue + marker-derived places to buildGameDatabase
// while ALSO passing `user` (which carries the same markers), and
// buildGameDatabase threw "Personal marker id collides with a
// catalogue place" — swallowed by App's try/catch into a null db.
// The contract is catalogue-only places in, markers via user.markers;
// the domain additionally tolerates the double-passed identical
// place instead of throwing, so one caller mistake can never blank
// the whole app again. A genuinely different place sharing a
// marker's id still throws.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot, markerToPlace } from '../../src/data/catalogue';
import { buildGameDatabase } from '../../src/domain/game-db';
import type { PersonalMarker, Place, UserData } from '../../src/domain/types';

const snapshot = JSON.parse(
  readFileSync(
    new URL('../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json', import.meta.url),
    'utf8',
  ),
);
const places: Place[] = catalogueFromSnapshot(snapshot);
const time = '2026-11-20T10:00:00.000Z';

const seedMarkers: PersonalMarker[] = [
  {
    id: 'custom:capri-gym',
    title: 'Capri garage gym',
    description: 'Gear in the garage',
    category: 'my-markers',
    position: { x: 100, y: 200 },
    icon: 'flag',
    kind: 'workout',
    color: '#73cbbb',
    createdAt: time,
    updatedAt: time,
  },
  {
    id: 'custom:breakable-house',
    title: 'Breakable house',
    description: 'Back door opens',
    category: 'my-markers',
    position: { x: 110, y: 210 },
    icon: 'pin',
    kind: 'breakable',
    color: '#ff8a5c',
    createdAt: time,
    updatedAt: time,
  },
];

function userWithMarkers(markers: PersonalMarker[]): UserData {
  return {
    favorites: [],
    notes: [],
    placeTags: [],
    collections: [],
    markers,
    visited: [],
    explored: [],
    preferences: { reducedMotion: false, showLabels: true, clusterMarkers: true },
  };
}

describe('game-db marker places (v0.32 demo regression)', () => {
  it('markers arrive via user.markers on catalogue-only input', () => {
    const db = buildGameDatabase({ places, user: userWithMarkers(seedMarkers) });
    expect(db.locations.get('custom:capri-gym')?.name).toBe('Capri garage gym');
    expect(db.locations.get('custom:breakable-house')?.name).toBe('Breakable house');
    expect(db.items.size).toBeGreaterThan(0);
  });

  it('tolerates the same marker-derived place passed in `places` too', () => {
    const markerPlaces = seedMarkers.map((m) => markerToPlace(m));
    const db = buildGameDatabase({
      places: [...places, ...markerPlaces],
      user: userWithMarkers(seedMarkers),
    });
    const gyms = [...db.locations.values()].filter((loc) => loc.id === 'custom:capri-gym');
    expect(gyms).toHaveLength(1);
    expect(db.locations.get('custom:breakable-house')?.name).toBe('Breakable house');
  });

  it('still throws on a genuinely different place sharing a marker id', () => {
    const impostor: Place = {
      ...markerToPlace(seedMarkers[0]!),
      title: 'Somebody else’s place',
    };
    expect(() =>
      buildGameDatabase({ places: [...places, impostor], user: userWithMarkers(seedMarkers) }),
    ).toThrow(/collides with a catalogue place: custom:capri-gym/);
  });
});
