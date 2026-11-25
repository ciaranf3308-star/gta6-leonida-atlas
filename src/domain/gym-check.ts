import type { Place, Position } from './types';
import { isUnnamedPlace } from './types';
import { normalizeSearch } from './filter';
import { userTagsMatchLayer } from './user-tags';

/**
 * Gyms vs workout equipment — two different things, kept apart on purpose
 * (user correction, 2026-11-23 23:18: "I'm not looking for gyms I'm
 * looking for workout equipment!!").
 *
 * - GYMS are the 8 member clubs, all in Vice City. A question for a "gym"
 *   answers from them.
 * - EQUIPMENT is free gear: Muscle Sands beach gym, Jason's house deck,
 *   the Starlet Motel bench — plus any workout spot the user marks
 *   himself. A question for "workout", "equipment", "bench", "weights"
 *   or "gym equipment" answers from equipment first, never from the
 *   member gyms.
 *
 * The public data has exactly one gym tag in the whole 4,380-record
 * snapshot (Ajax Gym, L1869) and no guide lists a gym — or equipment —
 * in Capri. The equipment the user knows about in Capri is in a garage
 * in a house: no public source can pin that house, and the app must not
 * invent one. What it CAN do when equipment is asked for somewhere with
 * none verified: say so plainly, name the nearest verified equipment,
 * and list the houses in that area worth checking — enterable or
 * residential "?" houses — as candidates, never as verified equipment.
 * Each one gets a one-tap "Workout equipment in the garage — mark it",
 * so the user's own in-game observation becomes real data instead of
 * the app pretending it knows.
 */

/** Words that mean the free gear, not a member club. Checked first. */
const EQUIPMENT_WORDS = [
  'workout',
  'equipment',
  'bench',
  'weights',
  'weight',
  'kettlebell',
  'dumbbell',
  'squat',
  'deadlift',
  'calisthenics',
];

const EQUIPMENT_PHRASES = [
  'work out',
  'working out',
  'gym equipment',
  'home gym',
  'outdoor gym',
  'free gym',
  'free workout',
  'public equipment',
  "jason's house",
  'jason house',
  'muscle sands',
  'punching bag',
  'pull-up',
  'pull up',
];

/** Words that mean a member gym club. */
const GYM_WORDS = [
  'gym',
  'fitness',
  'strength',
  'gains',
  'lift',
  'exercise',
  'cardio',
  'muscle',
  'train',
  'training',
];

function hasWord(q: string, word: string): boolean {
  return q.split(/\s+/).includes(word) || q.includes(word);
}

export function isEquipmentQuery(text: string): boolean {
  const q = normalizeSearch(text);
  return (
    EQUIPMENT_PHRASES.some((phrase) => q.includes(phrase)) ||
    EQUIPMENT_WORDS.some((word) => hasWord(q, word))
  );
}

export function isGymQuery(text: string): boolean {
  const q = normalizeSearch(text);
  // "gym equipment" is an equipment question, not a gym question — the
  // word "gym" inside that phrase must not route it to the member clubs.
  if (isEquipmentQuery(text)) return false;
  return GYM_WORDS.some((word) => hasWord(q, word));
}

/** The 8 member gym clubs (layer 'gyms'). */
export function memberGyms(places: readonly Place[]): Place[] {
  return places.filter((place) => place.layerId === 'gyms');
}

/**
 * Verified free workout equipment: the public equipment layer, plus any
 * workout spot the user marked himself — that is verified equipment too,
 * on his device, and it is what answers an equipment question near home.
 * A public place the user tagged "workout equipment" counts the same
 * way: he saw the gear there, no public source needed. (The Capri
 * garage: he tags the house, and it becomes a Workout Equipment pin.)
 */
export function verifiedEquipment(
  places: readonly Place[],
  userTags?: ReadonlyMap<string, readonly string[]>,
): Place[] {
  return places.filter(
    (place) =>
      place.layerId === 'equipment' ||
      isWorkoutMarker(place) ||
      (userTags ? userTagsMatchLayer(userTags.get(place.id) ?? [], 'equipment') : false),
  );
}

export function nearestVerifiedGym(
  places: readonly Place[],
  from: Position,
): { place: Place; distance: number } | null {
  let best: { place: Place; distance: number } | null = null;
  for (const place of memberGyms(places)) {
    if (!place.position) continue;
    const distance = Math.hypot(place.position.x - from.x, place.position.y - from.y);
    if (!best || distance < best.distance) best = { place, distance };
  }
  return best;
}

export function nearestVerifiedEquipment(
  places: readonly Place[],
  from: Position,
  userTags?: ReadonlyMap<string, readonly string[]>,
): { place: Place; distance: number } | null {
  let best: { place: Place; distance: number } | null = null;
  for (const place of verifiedEquipment(places, userTags)) {
    if (!place.position) continue;
    const distance = Math.hypot(place.position.x - from.x, place.position.y - from.y);
    if (!best || distance < best.distance) best = { place, distance };
  }
  return best;
}

/**
 * A My marker counts as workout equipment only when the user marked it
 * as one (a workout-spot marker, or gym/workout words in its title or
 * notes). Without this, a photo-spot marker near Capri would be returned
 * as equipment just because it is near — the user's own markers are never
 * spoilers, but they still have to be the thing asked for.
 */
export function isWorkoutMarker(place: Place): boolean {
  if (place.layerId !== 'my-markers') return false;
  if (place.tags.some((tag) => ['gym', 'workout', 'strength', 'fitness', 'equipment'].includes(tag)))
    return true;
  const text = normalizeSearch(`${place.title} ${place.description}`);
  return ['gym', 'workout', 'strength', 'weights', 'home gym', 'equipment'].some((p) =>
    text.includes(p),
  );
}

/**
 * Houses in an area worth checking for workout equipment: unnamed "?"
 * houses with a position, tagged enterable or residential — the only
 * evidence the source supplies. Sorted nearest-first from the anchor.
 * These are CANDIDATES, never verified equipment: 0 records in the
 * snapshot carry a gym tag outside Ajax Gym, most Capri "?" houses carry
 * no tag at all, and the equipment the user knows about is in a garage
 * in a house — which house, no public source says. Nothing here is
 * equipment until the user marks it as such.
 */
export function housesToCheck(
  places: readonly Place[],
  anchor: Position,
  matchesArea: (place: Place) => boolean,
  limit = 15,
): { places: Place[]; total: number } {
  const candidates = places
    .filter(
      (place) =>
        isUnnamedPlace(place) &&
        place.position !== null &&
        (place.tags.includes('enterable') || place.tags.includes('residential')) &&
        matchesArea(place),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.position!.x - anchor.x, a.position!.y - anchor.y) -
        Math.hypot(b.position!.x - anchor.x, b.position!.y - anchor.y),
    );
  return { places: candidates.slice(0, limit), total: candidates.length };
}
