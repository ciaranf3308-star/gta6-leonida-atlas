import type { Filters, LayerDefinition, Place } from '../../domain/types';
import { COUNTIES, countyForPlace, countyIdFromText } from '../../data/counties';

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

export interface AskRetrievalInput {
  question: string;
  places: readonly Place[];
  layers: readonly LayerDefinition[];
  filters: Pick<Filters, 'hideFound' | 'remainingOnly' | 'countyId'>;
  visitedIds?: readonly string[];
}

export interface AskRetrievalResult {
  /** Records the AI may use — and the only records it will ever see. */
  records: Place[];
  requestedLayerIds: string[];
  requestedLayerNames: string[];
  anchorPlace: Place | null;
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

  const eligible = places.filter(
    (place) => allowed.has(place.layerId) && !(hideFound && visited.has(place.id)),
  );
  const totalInScope = eligible.length;

  // Scope: an anchor place beats a county, which beats an area word, which
  // beats a direction. The UI's county filter applies only when the
  // question names no other scope.
  const anchor = anchorForQuestion(question, places);
  const namedCounty = countyIdFromText(question) ?? COUNTIES.find((c) => hasWord(normalizeAsk(question), c.id))?.id ?? null;
  const areaWord = namedCounty ? null : areaWordForQuestion(question, places);
  const direction = anchor || namedCounty || areaWord ? null : directionOf(question);
  const uiCounty = !anchor && !namedCounty && !areaWord && !direction ? input.filters.countyId : null;
  const countyId = namedCounty ?? uiCounty;
  const county = countyId ? COUNTIES.find((c) => c.id === countyId) : null;

  let areaLabel: string | null = null;
  let scoped = eligible;
  let areaMismatch = false;
  if (anchor?.position) {
    areaLabel = `near ${anchor.title}`;
    scoped = [...eligible].sort((a, b) => {
      const da = a.position ? distance(a.position, anchor.position!) : Number.POSITIVE_INFINITY;
      const db = b.position ? distance(b.position, anchor.position!) : Number.POSITIVE_INFINITY;
      return da - db;
    });
  } else if (county) {
    areaLabel = county.name;
    scoped = eligible.filter((p) => countyForPlace(p) === county.id);
    if (scoped.length === 0) {
      areaMismatch = true;
      scoped = eligible;
    }
  } else if (areaWord) {
    areaLabel = areaWord;
    scoped = eligible.filter((p) => normalizeAsk(`${p.title} ${p.region}`).includes(areaWord));
    if (scoped.length === 0) {
      areaMismatch = true;
      scoped = eligible;
    }
  } else if (direction) {
    areaLabel = direction;
    scoped = eligible.filter((p) => p.position && inDirection(p.position, direction));
    if (scoped.length === 0) {
      areaMismatch = true;
      scoped = eligible;
    }
  }

  const requestedLayerNames = requestedLayerIds
    .map((id) => layers.find((l) => l.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  return {
    records: scoped.slice(0, ASK_MAX_RECORDS),
    requestedLayerIds,
    requestedLayerNames,
    anchorPlace: anchor,
    areaLabel,
    areaMismatch,
    totalInScope,
  };
}
