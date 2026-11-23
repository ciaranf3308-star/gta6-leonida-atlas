import type { Filters, LayerDefinition, Place } from '../../domain/types';
import { isUnnamedPlace } from '../../domain/types';
import { COUNTIES, countyForPlace, countyIdFromText } from '../../data/counties';
import { ROBBABLE_SHOP_TAGS, SHOP_TAGS } from '../../data/catalogue';

/**
 * Ask Nylah retrieval — the spoiler rule, in code.
 *
 * THE RULE (user, 2026-11-23): asking for a thing IS consent to show that
 * layer, even if it is off. Gyms off + "where can I train?" = show the gyms.
 * That consent covers ONLY the layer(s) the question actually asks for, for
 * that answer only — it never turns the layer on in the UI.
 *
 * The other half of the rule: NEVER volunteer extras from layers the user
 * did not ask for. A burglary question returns lootable buildings only —
 * never "you'll also find cards/watches in those houses". Retrieval only
 * ever returns records from layers the question asks for (plus the user's
 * own markers) — or, for a general question that names no layer, from
 * layers already visible. Nothing else is sent to the AI, so the AI cannot
 * leak what it was never given.
 */

export const ASK_MAX_RECORDS = 30;

/**
 * "Near" in map units. The Leonida map is ~12,000 units wide and the Vice
 * City gyms sit ~2,800 units apart from each other — so 2,000 units is a
 * same-neighbourhood radius. The nearest gym to Capri is ~5,700 units away:
 * far outside it, and the code below must say so instead of calling it near.
 */
export const NEAR_DISTANCE_UNITS = 2000;

export interface AskRetrievalInput {
  question: string;
  places: readonly Place[];
  layers: readonly LayerDefinition[];
  filters: Pick<Filters, 'hideFound' | 'remainingOnly' | 'countyId'>;
  visitedIds?: readonly string[];
  /**
   * Earlier user questions in this conversation, oldest first. Only used to
   * recover the place a follow-up is about ("is there nowhere else I can
   * workout?" after "gym near Capri") — the layers asked for still come
   * from the current question alone.
   */
  priorQuestions?: readonly string[];
}

export interface AskRetrievalResult {
  /** Records the AI may use — and the only records it will ever see. */
  records: Place[];
  requestedLayerIds: string[];
  requestedLayerNames: string[];
  anchorPlace: Place | null;
  /** Position distances are measured from — the anchor, or the centroid of
   * the named area's positioned places when the area itself is the anchor. */
  anchorPosition: { x: number; y: number } | null;
  /** Distance in map units from the anchor, for positioned records only. */
  anchorDistances: ReadonlyMap<string, number>;
  /** Distance to the nearest positioned record, or null when none is positioned. */
  nearestDistance: number | null;
  /** Records within NEAR_DISTANCE_UNITS of the anchor. */
  nearCount: number;
  /**
   * Plain-words proximity verdict, computed from the distances — e.g.
   * "There's no gym near Capri in the map data. The nearest is Grand
   * Majestic, in Tequesta, Vice City, a long way across the map." Null
   * when the question names no place to measure from.
   */
  proximitySummary: string | null;
  /** County / area / direction the question scoped to, if any. */
  areaLabel: string | null;
  /** True when the scoped area had nothing and we fell back to nearest. */
  areaMismatch: boolean;
  /** Eligible records before the area scope and the 30 cap. */
  totalInScope: number;
}

export function normalizeAsk(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return haystack.includes(phrase);
}

function hasWord(haystack: string, word: string): boolean {
  return haystack.split(' ').includes(word);
}

/** Layer ids a question asks for, by keyword. Empty = no layer asked for. */
export function layersRequestedByQuestion(
  question: string,
  layers: readonly LayerDefinition[],
): string[] {
  const q = normalizeAsk(question);
  const ids = new Set<string>();
  const has = (layerId: string) => layers.some((l) => l.id === layerId) && ids.add(layerId);

  const gymWords = [
    'gym', 'workout', 'strength', 'gains', 'lift', 'weight', 'fitness', 'muscle',
    'bench', 'squat', 'kettlebell', 'cardio', 'exercise',
  ];
  const trainWord = hasWord(q, 'train') || hasWord(q, 'training');
  if (gymWords.some((w) => hasWord(q, w) || hasPhrase(q, w)) || trainWord) {
    has('gyms');
    has('gyms-outdoor');
  }
  if (
    ['outdoor', 'muscle sands', "jason's house", 'jason house', 'home gym', 'public equipment', 'calisthenics', 'free gym', 'free workout'].some(
      (p) => hasPhrase(q, p),
    ) ||
    (hasWord(q, 'free') && (hasWord(q, 'gym') || hasWord(q, 'workout')))
  ) {
    has('gyms-outdoor');
  }
  const lootPhrases = [
    'burglar', 'burglary', 'burglaries', 'loot', 'rob', 'robbery', 'robberies',
    'hold up', 'holdup', 'steal', 'break in', 'break-in', 'hit tonight',
    'houses i can hit', 'can i rob', 'can be robbed', 'held up',
  ];
  if (lootPhrases.some((p) => hasPhrase(q, p))) has('lootable');
  const shopWords = [
    'shop', 'store', 'clothes', 'clothing', 'guns', 'ammo', 'food', 'gas',
    'supermarket', 'pharmacy', 'tattoo', 'tattoos', 'hair', 'shoes',
    'electronics', 'vendor', 'restaurant',
  ];
  if (
    shopWords.some((w) => hasWord(q, w)) ||
    hasPhrase(q, 'buy') ||
    hasPhrase(q, 'where can i buy')
  )
    has('shops');
  // Interiors only on an explicit interior ask — never from a generic
  // "house/building" mention, so a burglary question cannot leak interiors.
  if (
    ['interior', 'interiors', 'enterable', 'enter a', 'go inside', 'inside a', 'can i enter'].some(
      (p) => hasPhrase(q, p),
    )
  )
    has('interiors');
  if (
    ['card', 'cards', 'collectible', 'collectable', 'trading card', 'trading cards'].some((p) =>
      hasPhrase(q, p),
    )
  ) {
    for (const layer of layers) if (layer.id.startsWith('cards:')) ids.add(layer.id);
  }
  if (['my marker', 'my markers', 'my note', 'my notes', 'my places'].some((p) => hasPhrase(q, p)))
    has('personal');
  if (
    ['named region', 'named regions', 'place name', 'place names'].some((p) => hasPhrase(q, p))
  )
    has('regions');
  return [...ids];
}

function directionOf(question: string): 'north' | 'south' | 'west' | 'east' | null {
  const q = normalizeAsk(question);
  if (hasPhrase(q, 'up north') || hasPhrase(q, 'north')) return 'north';
  if (hasPhrase(q, 'down south') || hasPhrase(q, 'south')) return 'south';
  if (hasPhrase(q, 'out west') || hasPhrase(q, 'west')) return 'west';
  if (hasPhrase(q, 'east')) return 'east';
  return null;
}

function inDirection(position: { x: number; y: number }, direction: string): boolean {
  if (direction === 'north') return position.y >= 3000;
  if (direction === 'south') return position.y <= -2500;
  if (direction === 'west') return position.x <= -3000;
  return position.x >= 1000;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Find the longest catalogue place title named in the question (the anchor). */
export function anchorForQuestion(question: string, places: readonly Place[]): Place | null {
  const q = normalizeAsk(question);
  let best: Place | null = null;
  let bestLength = 0;
  for (const place of places) {
    // An unnamed "?" record normalizes to just its area ("?, Capri" -> "capri")
    // and must never be the anchor — it has no name to be asked about.
    if (isUnnamedPlace(place)) continue;
    const base = normalizeAsk(place.title.split(' — ')[0] ?? place.title);
    if (base.length >= 4 && q.includes(base) && base.length > bestLength) {
      best = place;
      bestLength = base.length;
    }
  }
  return best;
}

/** A region phrase from the question that names an area in the catalogue (e.g. Capri, Mount Kalaga). */
function areaWordForQuestion(question: string, places: readonly Place[]): string | null {
  const q = normalizeAsk(question);
  const regions = new Set<string>();
  for (const place of places) {
    const segment = normalizeAsk(place.region.split(',')[0] ?? '');
    if (segment.length >= 4) regions.add(segment);
    const titleArea = normalizeAsk(place.title.split(',').slice(1).join(',').trim());
    if (titleArea.length >= 4) regions.add(titleArea);
  }
  let best: string | null = null;
  for (const region of regions) {
    if (q.includes(region) && (!best || region.length > best.length)) best = region;
  }
  return best;
}

/**
 * The anchor for a named area: the positioned places in that area, and the
 * place closest to their centroid as the representative. A bare area word
 * like "Capri" never matches a full place title ("Train Bridge, Capri"),
 * so without this the question had no anchor at all — the area filter found
 * no gyms in Capri, and retrieval fell back to the whole gym list in
 * catalogue order with no distances, which is how Vice City gyms got
 * presented as "near Capri". Distances are measured from the centroid.
 */
export function areaAnchorForWord(
  areaWord: string,
  places: readonly Place[],
): { place: Place | null; position: { x: number; y: number } | null } {
  const word = normalizeAsk(areaWord);
  const inArea = places.filter((place) => {
    const regionSegment = normalizeAsk(place.region.split(',')[0] ?? '');
    const titleArea = normalizeAsk(place.title.split(',').slice(1).join(',').trim());
    return regionSegment === word || titleArea === word;
  });
  // The representative is a NAMED place: an unnamed "?" record must never
  // be the anchor a distance or a sentence is built around.
  const named = inArea.filter((place) => !isUnnamedPlace(place));
  const candidates = named.length > 0 ? named : inArea;
  const positioned = candidates.filter(
    (place): place is Place & { position: NonNullable<Place['position']> } =>
      place.position !== null,
  );
  if (positioned.length === 0) return { place: candidates[0] ?? null, position: null };
  const cx = positioned.reduce((sum, p) => sum + p.position.x, 0) / positioned.length;
  const cy = positioned.reduce((sum, p) => sum + p.position.y, 0) / positioned.length;
  let best = positioned[0]!;
  let bestDistance = distance(positioned[0]!.position, { x: cx, y: cy });
  for (const place of positioned.slice(1)) {
    const d = distance(place.position, { x: cx, y: cy });
    if (d < bestDistance) {
      best = place;
      bestDistance = d;
    }
  }
  return { place: best, position: { x: cx, y: cy } };
}

/** Plain noun for the asked layer(s), for the proximity verdict. */
function placeNounForLayers(layerIds: readonly string[]): string {
  if (layerIds.length === 1) {
    if (layerIds[0] === 'gyms' || layerIds[0] === 'gyms-outdoor') return 'gym';
    if (layerIds[0] === 'lootable') return 'lootable building';
    if (layerIds[0] === 'shops') return 'shop';
    if (layerIds[0] === 'interiors') return 'enterable building';
    if (layerIds[0]?.startsWith('cards:')) return 'card';
    if (layerIds[0] === 'personal') return 'marker of yours';
    return 'place';
  }
  if (layerIds.includes('gyms') || layerIds.includes('gyms-outdoor')) return 'gym';
  return 'place';
}

function formatDistance(units: number): string {
  return `about ${Math.round(units / 100) * 100} map units away`;
}

/**
 * The proximity verdict, in plain words, from the computed distances.
 * Never calls a far place near: when nothing is within NEAR_DISTANCE_UNITS
 * it says so first, names the nearest with its area, and says it is a long
 * way away — so the answer can never re-list far gyms as if they were near.
 */
function proximitySummaryFor(
  areaName: string,
  noun: string,
  records: readonly Place[],
  distances: ReadonlyMap<string, number>,
  anchorPosition: { x: number; y: number } | null,
): string | null {
  if (!anchorPosition) {
    return `There is no verified position for ${areaName} in the map data, so how far away things are from there cannot be measured.`;
  }
  const positioned = records.filter((p) => distances.has(p.id));
  if (positioned.length === 0) return null;
  const nearest = [...positioned].sort(
    (a, b) => (distances.get(a.id) ?? Infinity) - (distances.get(b.id) ?? Infinity),
  )[0]!;
  const nearestDistance = distances.get(nearest.id) ?? Infinity;
  const near = positioned.filter((p) => (distances.get(p.id) ?? Infinity) <= NEAR_DISTANCE_UNITS);
  const area = nearest.region ? `, in ${nearest.region}` : '';
  if (near.length > 0) {
    return `The nearest ${noun} to ${areaName} is ${nearest.title}${area} (${formatDistance(nearestDistance)}). ${near.length} ${near.length === 1 ? 'is' : 'are'} near ${areaName}.`;
  }
  return `There is no ${noun} near ${areaName} in the map data. The nearest is ${nearest.title}${area} — ${formatDistance(nearestDistance)}, a long way across the map.`;
}

/**
 * A place whose TAGS say it is the thing asked for, whatever layer it sits
 * in. This is how the unnamed "?" records answer: a "?" with #gas +
 * enterable sits in the unverified layer (its name is unknown), but it IS
 * a petrol-station shop — a burglary or shops question must be able to
 * return it. Only tags the source supplied count; no tag is ever inferred
 * here. A gym tag would match here too — but 0 records in the snapshot
 * carry one, so a gym question still finds no "?" gyms until a source
 * tags one or the user marks a workout spot himself.
 */
export function tagMatchesLayer(place: Place, layerId: string): boolean {
  const tags = place.tags;
  if (layerId === 'gyms' || layerId === 'gyms-outdoor')
    return tags.some((tag) => ['gym', 'fitness', 'workout', 'strength', 'exercise'].includes(tag));
  if (layerId === 'shops') return tags.some((tag) => (SHOP_TAGS as readonly string[]).includes(tag));
  if (layerId === 'lootable')
    return (
      tags.includes('enterable') &&
      tags.some((tag) => (ROBBABLE_SHOP_TAGS as readonly string[]).includes(tag))
    );
  if (layerId === 'interiors') return tags.includes('enterable');
  return false;
}

/**
 * A My marker counts as a workout answer only when the user marked it as
 * one (a "workout spot" marker, or gym/workout words in its title or
 * notes). Without this, a photo-spot marker near Capri would be returned
 * as a gym just because it is near — the user's own markers are never
 * spoilers, but they still have to be the thing asked for.
 */
export function isWorkoutMarker(place: Place): boolean {
  if (place.layerId !== 'personal') return false;
  if (place.tags.some((tag) => ['gym', 'workout', 'strength', 'fitness'].includes(tag)))
    return true;
  const text = normalizeAsk(`${place.title} ${place.description}`);
  return ['gym', 'workout', 'strength', 'weights', 'home gym'].some((p) => text.includes(p));
}

export function retrieveForAsk(input: AskRetrievalInput): AskRetrievalResult {
  const { question, places, layers } = input;
  const requestedLayerIds = layersRequestedByQuestion(question, layers);
  const visible = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  // Scope: when the question asks for specific layers, ONLY those layers
  // (plus My markers) are in scope — a visible-but-unasked layer must never
  // hijack the answer (e.g. a gym question must not return an interior just
  // because Interiors is on and the county filter matches it). Visible
  // layers only count for general questions that name no layer.
  const allowed = new Set<string>(
    requestedLayerIds.length > 0
      ? [...requestedLayerIds, 'personal']
      : [...visible, 'personal'],
  );
  const visited = new Set(input.visitedIds ?? []);
  const hideFound = input.filters.hideFound || input.filters.remainingOnly;
  const asksWorkout =
    requestedLayerIds.includes('gyms') || requestedLayerIds.includes('gyms-outdoor');

  const eligible = places.filter(
    (place) =>
      (allowed.has(place.layerId) ||
        // Tag evidence: a "?" place whose tags say it is the thing asked
        // for counts, whatever layer it sits in (see tagMatchesLayer).
        (requestedLayerIds.length > 0 &&
          requestedLayerIds.some((id) => tagMatchesLayer(place, id)))) &&
      !(hideFound && visited.has(place.id)) &&
      // A workout question only takes workout markers from My markers.
      !(asksWorkout && place.layerId === 'personal' && !isWorkoutMarker(place)),
  );
  const totalInScope = eligible.length;

  // Scope resolution, in order. The current question is tried first; a
  // follow-up with no place in it ("is there nowhere else I can workout?")
  // falls back to the place from the earlier question in this conversation.
  const scopeQuestions = [
    question,
    ...(input.priorQuestions ?? []).slice().reverse(),
  ];
  let anchor: Place | null = null;
  let areaWord: string | null = null;
  let namedCounty: string | null = null;
  for (const scopeQuestion of scopeQuestions) {
    anchor = anchorForQuestion(scopeQuestion, places);
    areaWord = areaWordForQuestion(scopeQuestion, places);
    namedCounty =
      countyIdFromText(scopeQuestion) ??
      COUNTIES.find((c) => hasWord(normalizeAsk(scopeQuestion), c.id))?.id ??
      null;
    if (anchor || areaWord || namedCounty) break;
    anchor = null;
    areaWord = null;
    namedCounty = null;
  }
  const direction =
    anchor || namedCounty || areaWord ? null : directionOf(question);
  const uiCounty =
    !anchor && !namedCounty && !areaWord && !direction ? input.filters.countyId : null;
  const countyId = namedCounty ?? uiCounty;
  const county = countyId ? COUNTIES.find((c) => c.id === countyId) : null;

  const byDistanceFrom = (from: { x: number; y: number }) => (a: Place, b: Place) => {
    const da = a.position ? distance(a.position, from) : Number.POSITIVE_INFINITY;
    const db = b.position ? distance(b.position, from) : Number.POSITIVE_INFINITY;
    return da - db;
  };

  let areaLabel: string | null = null;
  let anchorPosition: { x: number; y: number } | null = anchor?.position ?? null;
  let scoped = eligible;
  let areaMismatch = false;
  // 1. A named area that actually holds matching places: answer from that
  // area only, nearest first. (Mount Kalaga gyms: only the gym in that area.)
  if (areaWord) {
    const inArea = eligible.filter((p) =>
      normalizeAsk(`${p.title} ${p.region}`).includes(areaWord),
    );
    if (inArea.length > 0) {
      areaLabel = areaWord;
      const areaAnchor = areaAnchorForWord(areaWord, places);
      anchor = areaAnchor.place ?? anchor;
      anchorPosition = areaAnchor.position ?? anchorPosition;
      scoped = anchorPosition ? [...inArea].sort(byDistanceFrom(anchorPosition)) : inArea;
    }
  }
  // 2. A named place (full title): everything sorted nearest-first from it.
  if (scoped === eligible && anchor?.position) {
    areaLabel = `near ${anchor.title}`;
    anchorPosition = anchor.position;
    scoped = [...eligible].sort(byDistanceFrom(anchor.position));
    const nearest = scoped.find((p) => p.position);
    if (nearest && distance(nearest.position!, anchor.position) > NEAR_DISTANCE_UNITS)
      areaMismatch = true;
  }
  // 3. A named area with nothing in it: fall back to nearest-first from
  // the area's centroid — never catalogue order, never presented as near.
  if (scoped === eligible && areaWord) {
    areaLabel = areaWord;
    const areaAnchor = areaAnchorForWord(areaWord, places);
    anchor = areaAnchor.place ?? anchor;
    anchorPosition = areaAnchor.position ?? null;
    scoped = anchorPosition ? [...eligible].sort(byDistanceFrom(anchorPosition)) : eligible;
    areaMismatch = true;
  }
  // 4. County, then direction, as before — but a county fallback is also
  // nearest-first, measured from the county centre.
  if (scoped === eligible && county) {
    areaLabel = county.name;
    scoped = eligible.filter((p) => countyForPlace(p) === county.id);
    if (scoped.length === 0) {
      areaMismatch = true;
      const centre = {
        x: (county.bounds.west + county.bounds.east) / 2,
        y: (county.bounds.south + county.bounds.north) / 2,
      };
      anchorPosition = centre;
      scoped = [...eligible].sort(byDistanceFrom(centre));
    }
  } else if (scoped === eligible && direction) {
    areaLabel = direction;
    scoped = eligible.filter((p) => p.position && inDirection(p.position, direction));
    if (scoped.length === 0) {
      areaMismatch = true;
      scoped = eligible;
    }
  }

  const records = scoped.slice(0, ASK_MAX_RECORDS);
  const anchorDistances = new Map<string, number>();
  if (anchorPosition) {
    for (const place of records) {
      if (place.position) anchorDistances.set(place.id, distance(place.position, anchorPosition));
    }
  }
  const positionedDistances = [...anchorDistances.values()];
  const nearestDistance =
    positionedDistances.length > 0 ? Math.min(...positionedDistances) : null;
  const nearCount = positionedDistances.filter((d) => d <= NEAR_DISTANCE_UNITS).length;
  // A named place with no verified position cannot anchor distances.
  if (anchor && !anchor.position && !anchorPosition) anchorPosition = null;

  const requestedLayerNames = requestedLayerIds
    .map((id) => layers.find((l) => l.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const noun = placeNounForLayers(requestedLayerIds);
  let proximitySummary: string | null = null;
  if (areaLabel && (anchorPosition || anchor)) {
    proximitySummary = proximitySummaryFor(
      areaLabel.startsWith('near ') ? areaLabel.slice('near '.length) : areaLabel,
      noun,
      records,
      anchorDistances,
      anchorPosition,
    );
    // House-level gap, stated honestly: no source lists gym gear inside
    // houses, so the public list is never the whole picture for workouts.
    // A user-marked house gym is already in the records above when it is
    // near — this line says where to get one when there is none.
    if (asksWorkout && nearCount === 0 && proximitySummary) {
      proximitySummary +=
        ' House gyms and workout gear inside houses are not in the public map data yet — no source lists them. If you mark a house gym yourself, Ask will use your marker next time.';
    }
  }

  return {
    records,
    requestedLayerIds,
    requestedLayerNames,
    anchorPlace: anchor,
    anchorPosition,
    anchorDistances,
    nearestDistance,
    nearCount,
    proximitySummary,
    areaLabel,
    areaMismatch,
    totalInScope,
  };
}
