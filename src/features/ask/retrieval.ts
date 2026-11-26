import type { Filters, LayerDefinition, Place } from '../../domain/types';
import { isUnnamedPlace } from '../../domain/types';
import { COUNTIES, countyForPlace, countyIdFromText } from '../../data/counties';
import { COLLECTABLE_SETS, type CollectableSet } from '../../data/collectables';
import { ROBBABLE_SHOP_TAGS, SHOP_TAGS } from '../../data/catalogue';
import { GUIDE_BREAKABLE_LOOT } from '../../data/breakable-homes';
import { gangOpRecordForLocation } from '../../data/gang-operations';
import { housesToCheck, isWorkoutMarker } from '../../domain/gym-check';
import { userTagsMatchLayer } from '../../domain/user-tags';
import {
  BREAKABLE_GAP_NOTE,
  DARK_BLUE_RULE,
  isBreakableMarker,
} from '../../domain/interiors';

/** Re-exported for callers that already import it from here. */
export { isWorkoutMarker, isBreakableMarker };
import {
  aiCategoryMatchesLayer,
  type AiCategoryRecord,
} from '../categorise/categories';
import { askAllowedLayerIds } from '../spoiler/visibility';

/** Shared nightlife evidence (./nightlife) — re-exported so the
 *  local finder's import path stays stable. */
import { isNightlifePlace } from './nightlife';
export { isNightlifePlace };

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
  /** Place ids the completion log marks as found (step 6: the old
   * visited table is never read — App passes completedPlaceIds here).
   * The name is historical; the values are log-derived. */
  visitedIds?: readonly string[];
  /**
   * AI-suggested types for unnamed places (on-device only). A confident
   * AI gym answers a gym question exactly like a gym tag does — labelled
   * "AI suggested" in the results, never as a verified fact. Low
   * confidence / "not sure" records never match.
   */
  aiCategories?: Readonly<Record<string, AiCategoryRecord>>;
  /**
   * The user's own secondary tags (on-device only). A place he tagged
   * "workout equipment" answers a workout question the way a verified
   * equipment pin does — he saw the gear there. A tag never answers
   * for a layer it was not tagged for.
   */
  userTags?: ReadonlyMap<string, readonly string[]>;
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
  /**
   * Houses in the asked area worth checking for gym equipment — unnamed
   * "?" places tagged enterable or residential, nearest-first. Only ever
   * set for a gym question in an area with no gym near it. These are
   * CANDIDATES, never verified gyms: no source says they have equipment.
   * Empty unless a gym was asked for in a named area or county.
   */
  housesToCheck: Place[];
  /** All such houses in the area, before the display cap. */
  housesToCheckTotal: number;
  /** The area the houses are in ("Capri", "Vice-Dale County"), or null. */
  housesAreaName: string | null;
  /**
   * What the houses are candidates for: 'equipment' when workout
   * equipment was asked for, 'gym' when a member gym was, null when
   * there are no houses. The answer copy follows this, never the other.
   */
  housesKind: 'equipment' | 'gym' | null;
  /**
   * The systemic rule for a breakable question, as one line shown
   * under the verdict — e.g. "On the in-game map, a building drawn
   * dark blue has an interior…". The verdict itself is capped at two
   * sentences (cards first), so the rule would otherwise only live
   * behind a tap on one place's sheet. Null unless a breakable
   * question was asked and a proximity verdict exists.
   */
  ruleNote: string | null;
  /**
   * Honest empty-answer advice (v0.32 gang-op follow-up, lane 2),
   * used only when records is empty: the area instead of a layer
   * when the record asked about is area-known, and the gang-op
   * area-only line when the question asked for gang ops by kind but
   * no 'gang-op' layer is defined yet. Null when the generic "try
   * turning a layer on" line is the honest one — that line names
   * only layers that exist, via requestedLayerNames.
   */
  emptyAdvice: string | null;
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

/**
 * Nightlife #tags, by the words a question uses. Nightclubs, strip
 * clubs and bars are bars-and-clubs venues in the game's own filing
 * (shopMapIndex puts them in Food & Drink, not Activities), so a
 * nightlife question asks for the Food & Drink layer — and
 * retrieveForAsk then narrows the eligible set to these tags, so
 * the answer is the nightclubs, not the nearest thirty shops in
 * the area (the over-match the QA report already flagged for
 * "shop"). A bare "club" means the whole nightlife set: in GTA a
 * club is a nightclub first (a member gym is asked for as "gym").
 * "Nightclub in vice city" (reported 2026-11-25) returned nothing
 * before this, even though NINE1NINE and The Vault both carry
 * #nightclub in the data — no nightlife word reached any layer.
 */
export function nightlifeTagsForQuestion(question: string): string[] {
  const q = normalizeAsk(question);
  const tags = new Set<string>();
  if (hasWord(q, 'nightclub') || hasWord(q, 'nightclubs')) tags.add('#nightclub');
  if (hasPhrase(q, 'strip club') || hasPhrase(q, 'strip clubs') || hasWord(q, 'stripclub'))
    tags.add('#stripclub');
  if (hasWord(q, 'bar') || hasWord(q, 'bars') || hasWord(q, 'pub') || hasWord(q, 'pubs'))
    tags.add('#bar');
  if (
    hasWord(q, 'nightlife') ||
    hasWord(q, 'club') ||
    hasWord(q, 'clubs') ||
    hasWord(q, 'dance') ||
    hasWord(q, 'dancing') ||
    hasWord(q, 'dj') ||
    hasWord(q, 'karaoke') ||
    hasWord(q, 'party') ||
    hasWord(q, 'partying')
  ) {
    tags.add('#nightclub');
    tags.add('#stripclub');
    tags.add('#bar');
  }
  return [...tags];
}

/**
 * The card set a question names, if it names one — e.g. "delight
 * dancers" (his spelling, singular) names the Delights Dancers set.
 * Words are stemmed by dropping a trailing "s", so "delight dancers"
 * matches "Delights Dancers" and "vice city flamingo" matches
 * "Vice City Flamingos". The longest matching set wins; a question
 * naming no set returns null and the answer stays the whole
 * collectibles pool. Without this, "help me find the Delights
 * Dancers card set" returned all 25 collectibles — five cards from
 * five different sets plus every meditation, magazine and watch —
 * because nothing ever narrowed by set (reported 2026-11-26).
 *
 * BARE NAMES (v0.32 step 7 — the live bug, screenshot 2026-11-26
 * 05:13 GMT: "Delight dancers" → "Nothing in the map data for
 * that"): a set named BY NAME ALONE must match, even without the
 * word "card" and even as a single word. The full-name rule above
 * needs every set word, so it misses "Delights" (one word),
 * "Jack of Hearts" (missing "Dancers") and "flamingos" (the last
 * word of "Vice City Flamingos" only). The second rule below matches
 * on SIGNATURE words — a stemmed set-name word that belongs to
 * exactly one set, is at least 4 letters, and is not a generic word
 * that means something else in this app ('club' is nightlife, not
 * the Club De Fútbol set; 'next'/'top'/'right'/'wing'/'hero' are
 * plain English). A single signature word matches only when it is
 * at least 5 letters ('delight', 'flamingo'); a 4-letter one ('jack')
 * needs a second signature word from the same set ('heart'), so a
 * bare "jack" never answers as a card set. Signature words from two
 * different sets never match — the question is ambiguous, and the
 * answer stays the whole pool rather than guessing a set.
 */
const SET_SIGNATURE_EXCLUDED = new Set([
  'club', // bare "club" is nightlife, never the Club De Fútbol set
  'next',
  'top',
  'right',
  'wing',
  'hero', // plain English — "Right Wing" needs its full name
  'dancer', // in three set names; "dancers" alone names no set
]);

function setSignatureWords(): ReadonlyMap<string, CollectableSet> {
  const stem = (word: string): string => (word.endsWith('s') ? word.slice(0, -1) : word);
  const counts = new Map<string, number>();
  const owner = new Map<string, CollectableSet>();
  for (const set of COLLECTABLE_SETS) {
    const words = new Set(normalizeAsk(set.name).split(' ').map(stem));
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
      owner.set(word, set);
    }
  }
  const signature = new Map<string, CollectableSet>();
  for (const [word, count] of counts) {
    if (
      count === 1 &&
      word.length >= 4 &&
      !SET_SIGNATURE_EXCLUDED.has(word)
    ) {
      signature.set(word, owner.get(word)!);
    }
  }
  return signature;
}

const SET_SIGNATURES = setSignatureWords();

export function cardSetForQuestion(question: string): CollectableSet | null {
  const stem = (word: string): string => (word.endsWith('s') ? word.slice(0, -1) : word);
  const questionWords = new Set(normalizeAsk(question).split(' ').map(stem));
  let best: CollectableSet | null = null;
  let bestLength = 0;
  for (const set of COLLECTABLE_SETS) {
    const setWords = normalizeAsk(set.name).split(' ').map(stem);
    if (setWords.every((word) => questionWords.has(word)) && setWords.length > bestLength) {
      best = set;
      bestLength = setWords.length;
    }
  }
  if (best) return best;
  // Bare-name rule (see the doc comment above): signature words only.
  const found = [...questionWords].filter((word) => SET_SIGNATURES.has(word));
  if (found.length === 0) return null;
  const sets = new Set(found.map((word) => SET_SIGNATURES.get(word)!));
  if (sets.size !== 1) return null;
  const only = [...sets][0]!;
  if (found.length >= 2 || found[0]!.length >= 5) return only;
  return null;
}

/** A question that asks for cards specifically — not a generic
 * "collectibles" ask, and not one that also names meditations or
 * magazines. A card question takes trading cards only: before this,
 * "cards" also pulled the whole Loot Map collectibles bucket, so a
 * "cards near Capri" question answered with the Smooth Sand
 * meditation — the only eligible place with "Capri" in its region —
 * and the summary called a meditation "the nearest card"
 * (reported 2026-11-26). */
function asksForCardsOnly(question: string): boolean {
  const q = normalizeAsk(question);
  const cardWords = ['card', 'cards', 'trading card', 'trading cards'];
  const otherCollectibles = ['meditation', 'meditations', 'magazine', 'magazines'];
  return (
    cardWords.some((p) => hasPhrase(q, p)) &&
    !otherCollectibles.some((p) => hasPhrase(q, p))
  );
}

const GANG_OP_PHRASES = [
  // Hyphen forms too: normalizeAsk keeps "-", so "gang-op" in a
  // question is "gang-op", never "gang op".
  'gang op',
  'gang-op',
  'gang ops',
  'gang-ops',
  'gang operation',
  'gang operations',
  'illegal operation',
  'illegal operations',
];

/**
 * A question asking for gang operations by kind — the 'gang-op'
 * layer, when it exists. A bare "gang" does not route: it names no
 * layer on its own. Shared by the layer router and the empty-answer
 * advice, so a kind question asked before the layer exists still
 * gets an honest answer instead of a layer that is not there.
 */
export function asksForGangOps(question: string): boolean {
  const q = normalizeAsk(question);
  return GANG_OP_PHRASES.some((p) => hasPhrase(q, p));
}

/** Layer ids a question asks for, by keyword. Empty = no layer asked for. */
/**
 * Personal-progress intent (v0.32 step-9 follow-up, Demo D step 3).
 *
 * A question about the PLAYER's own progress — what they have
 * found, collected, looted or explored, what is left in a set —
 * can only be answered from the completion log, through the
 * tools path (`personal_progress` / `remaining_collectibles`),
 * which needs an OpenAI key. The no-key finder answers from the
 * MAP only: it treats "Lummox County" as a place name and returns
 * a proximity verdict that can state the opposite of the truth
 * ("There is no place near lummox county" when Redshaw's in
 * Lummox County WAS explored). AskPanel refuses these questions
 * honestly without a key instead of running the finder.
 *
 * ONLY personal-progress intent matches — a bare card-set name
 * ("Delight dancers", "Delights", "Jack of Hearts", "flamingos")
 * is a map question, not a progress question, and must still
 * return the set's cards. The detector therefore keys on
 * first-person progress phrasing, never on a set or place name.
 */
const PERSONAL_PROGRESS_PHRASES = [
  // "have I found Vicki?" / "what break-in houses have I looted?"
  'have i',
  'did i',
  'do i have',
  'what have i',
  'where have i',
  'where did i',
  'what did i',
  // "what's left in the Delights Dancers set?" (normalised: "what s left")
  'what s left',
  'what is left',
  'left in the set',
  'left to find',
  'left to collect',
  'how many have i',
  'how many did i',
  'my progress',
  'my collection',
  'my finds',
  // First-person past tense: "I found the Harley card" as a question.
  'i found',
  'i ve found',
  'i collected',
  'i ve collected',
  'i looted',
  'i ve looted',
  'i explored',
  'i ve explored',
  'i discovered',
  'i ve discovered',
  'what am i missing',
  'am i missing',
  'what do i have left',
  'what have i got',
];

export function isPersonalProgressQuestion(question: string): boolean {
  const q = ` ${normalizeAsk(question)} `;
  // Word-boundary match: "i found" must be its own words, never
  // the tail of another word ("mini found" is not progress).
  return PERSONAL_PROGRESS_PHRASES.some((phrase) => q.includes(` ${phrase} `));
}

export function layersRequestedByQuestion(
  question: string,
  layers: readonly LayerDefinition[],
): string[] {
  const q = normalizeAsk(question);
  const ids = new Set<string>();
  const has = (layerId: string) => layers.some((l) => l.id === layerId) && ids.add(layerId);

  // Gang operations ("Illegal Operations", DESIGN §4.2): a gang-op
  // question asks for the 'gang-op' layer — the 37 area-known places
  // plus the two host-matched ones. "gang op" / "gang operation" /
  // "illegal operation(s)" all route here; a bare "gang" does not
  // (too generic — it names no layer on its own). The `has` guard
  // means the route only fires once the layer is defined (lane 1);
  // until then the question falls through to the empty-advice path,
  // which answers from the area instead of naming a missing layer.
  if (asksForGangOps(question)) has('gang-op');

  // Gyms vs workout equipment (user correction, 2026-11-23): "workout",
  // "equipment", "bench", "weights" or "gym equipment" asks for the free
  // gear — never the member clubs. A bare "gym" (or "train", "fitness")
  // asks for the member gyms. A question that asks for both ("a gym near
  // Capri or somewhere I can hit some strength workouts") asks for both
  // layers. Only the equipment PHRASES consume the word "gym": in "gym
  // equipment", "home gym", "free gym" or "Muscle Sands" the gym word
  // belongs to the equipment phrase, so it is stripped before the gym
  // check runs.
  const equipmentWords = [
    'workout', 'equipment', 'bench', 'weights', 'weight', 'kettlebell',
    'dumbbell', 'squat', 'deadlift', 'calisthenics',
  ];
  const equipmentPhrases = [
    'work out', 'working out', 'gym equipment', 'home gym', 'outdoor gym',
    'free gym', 'free workout', 'public equipment', "jason's house",
    'jason house', 'muscle sands', 'punching bag', 'pull-up', 'pull up',
  ];
  if (
    equipmentWords.some((w) => hasWord(q, w) || hasPhrase(q, w)) ||
    equipmentPhrases.some((p) => hasPhrase(q, p)) ||
    (hasWord(q, 'free') && (hasWord(q, 'gym') || hasWord(q, 'workout')))
  ) {
    has('equipment');
  }
  const gymWords = [
    'gym', 'fitness', 'strength', 'gains', 'lift', 'exercise', 'cardio',
    'muscle', 'train', 'training',
  ];
  const qWithoutEquipmentPhrases = equipmentPhrases.reduce(
    (acc, phrase) => acc.split(phrase).join(' '),
    q,
  );
  if (
    gymWords.some(
      (w) => hasWord(qWithoutEquipmentPhrases, w) || hasPhrase(qWithoutEquipmentPhrases, w),
    )
  ) {
    has('gyms');
  }
  const lootPhrases = [
    'burglar', 'burglary', 'burglaries', 'loot', 'rob', 'robbery', 'robberies',
    'hold up', 'holdup', 'steal', 'break in', 'break-in', 'hit tonight',
    'houses i can hit', 'can i rob', 'can be robbed', 'held up',
  ];
  // 'shops' (plural) names the category, same as 'shop' (v0.32 step 7
  // — the bare-name audit: the whole-word match missed the plural).
  // 'stores' is deliberately NOT here: "stores I can hit tonight" is
  // a robbery question and routes to lootable only (pinned by test).
  const shopWords = [
    'shop', 'shops', 'store', 'clothes', 'clothing', 'guns', 'ammo', 'food', 'gas',
    'supermarket', 'pharmacy', 'tattoo', 'tattoos', 'hair', 'shoes',
    'electronics', 'vendor', 'restaurant',
  ];
  const houseWords = [
    'house', 'houses', 'home', 'homes', 'apartment', 'apartments', 'apts',
    'trailer', 'trailers', 'mansion', 'mansions', 'mobile home',
  ];
  const asksHouses =
    houseWords.some((w) => hasWord(q, w) || hasPhrase(q, w)) &&
    !shopWords.some((w) => hasWord(q, w));
  // A robbery question about HOUSES asks for breakable homes, not shops:
  // "apartments I can break into in Vice City" is houses, "rob a store"
  // is shops. 'lootable' (shops) only joins when the question is not a
  // house question.
  if (lootPhrases.some((p) => hasPhrase(q, p)) && !asksHouses) has('lootable');
  // Bank jobs & vaults are their own layer, not the lootable SHOPS
  // layer: "bank job", "vault" and "heist" ask for the Loot Map jobs.
  // A generic "rob" question still asks for the shops (unchanged above).
  const heistPhrases = [
    'bank job', 'bank jobs', 'bank vault', 'bank vaults', 'vault', 'vaults',
    'payday loan', 'payday loans', 'heist', 'heists',
  ];
  if (heistPhrases.some((p) => hasPhrase(q, p))) has('loot-heists');
  // Breakable homes are systemic, not a list: the question asks for the
  // Breakable homes layer — the 33 GTADB-tagged houses, the Capri rob
  // houses, the trailer parks, the guide examples, and the user's own
  // marked homes — plus the dark-blue rule in the summary. "Enterable
  // houses" asks for breakable homes AND interiors (a house interior is
  // both); trailers ask for breakable homes only.
  const breakablePhrases = [
    'breakable', 'break into', 'break-in', 'break in', 'rob a house',
    'rob houses', 'rob a home', 'rob homes', 'houses i can break into',
    'apartments i can break into', 'trailer', 'trailers', 'mobile home',
    'enterable house', 'enterable houses', 'enterable home', 'enterable homes',
    'interior house', 'interior houses', 'house interior', 'house interiors',
    'houses i can enter', 'house i can enter', 'apartments i can enter',
    'houses i can hit', 'house i can hit',
    // "Lootable houses" is houses you can loot — breakable homes, not
    // the lootable SHOPS layer (which is "lootable buildings").
    'lootable house', 'lootable houses', 'lootable home', 'lootable homes',
    'lootable apartment', 'lootable apartments',
  ];
  if (breakablePhrases.some((p) => hasPhrase(q, p))) has('breakable');
  if (
    shopWords.some((w) => hasWord(q, w)) ||
    hasPhrase(q, 'buy') ||
    hasPhrase(q, 'where can i buy')
  ) {
    // Shops split four ways in v0.21.0 (Weapons / Style / Food & Drink
    // / Vehicles) — a shop question asks for all of them; the question
    // words narrow it further only through the place tags.
    for (const layer of layers) if (layer.id.startsWith('shops-')) ids.add(layer.id);
  }
  // Nightlife asks for Food & Drink only — every nightlife #tag files
  // there (shopMapIndex: nightclubs and strip clubs are bars-and-clubs
  // venues). retrieveForAsk narrows it to the nightlife tags, so the
  // answer is the nightclubs, not the nearest thirty shops.
  if (nightlifeTagsForQuestion(question).length > 0) has('shops-food');
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
    // The Loot Map collectibles (meditations, magazines, watches) are
    // collectibles too — a "collectibles" question asks for both.
    has('loot-collectibles');
  }
  // A NAMED set brings its own layer into scope — the word "card" is
  // not required (v0.32 step 7, the live bug: "Delight dancers" with
  // every layer off answered "Nothing in the map data for that",
  // because the layer gate above only fires on the word "card" and
  // set narrowing can only FILTER the eligible layers, never ADD
  // one). Naming the set is the ask; its cards:* layer plus the Loot
  // Map dancer cards tagged with the set id join the scope.
  const namedSet = cardSetForQuestion(question);
  if (namedSet) {
    has(`cards:${namedSet.id}`);
    has('loot-collectibles');
  }
  // Meditation and magazine questions ask for the Loot Map collectibles
  // only — never the trading-card sets.
  if (['meditation', 'meditations', 'magazine', 'magazines'].some((p) => hasPhrase(q, p))) {
    has('loot-collectibles');
  }
  if (['my marker', 'my markers', 'my note', 'my notes', 'my places'].some((p) => hasPhrase(q, p)))
    has('my-markers');
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
    // The SHORT name — the title before its ", Area" suffix ("NINE1NINE"
    // from "NINE1NINE, Downtown, Vice City"). A bare place name is a
    // question too ("Starlet Motel", "NINE1NINE"): without this the
    // anchor only ever matched when the question repeated the area
    // suffix as well, so a place asked for by name alone had no
    // anchor, no distances, and — with every layer off — no answer
    // at all (v0.32 step 7, the bare-name class). The short name is
    // only ever the title's first segment, never a single word, so a
    // common word in the question cannot anchor by accident.
    const short = normalizeAsk(
      (place.title.split(' — ')[0] ?? place.title).split(',')[0] ?? '',
    );
    if (
      short.length >= 3 &&
      short.length > bestLength &&
      q.includes(short) &&
      // A 3-letter short name must be a whole word in the question:
      // a 3-letter sequence inside another word is not a name, and
      // the ≥4 rule below it exists for exactly that reason. The
      // only length-3 short names in the catalogue are "84", "Mio"
      // and "VYB" — a number, a name and an acronym — so the
      // whole-word guard closes the VYB gap (v0.32 gang-op follow-up,
      // lane 2) without letting a common word anchor by accident.
      (short.length >= 4 || q.split(' ').includes(short)) &&
      // The short name must be the whole question (or the question's
      // head) — a question that merely MENTIONS the place in passing
      // ("shops near Starlet Motel") anchors on it for distances, but
      // the bare-place layer rule below only fires when no layer was
      // asked for at all, so the mention never widens the answer.
      short !== base
    ) {
      best = place;
      bestLength = short.length;
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
    if (layerIds[0] === 'equipment') return 'workout equipment';
    if (layerIds[0] === 'gyms') return 'gym';
    if (layerIds[0] === 'breakable') return 'breakable home';
    if (layerIds[0] === 'lootable') return 'lootable building';
    if (layerIds[0] === 'loot-heists') return 'bank job';
    if (layerIds[0] === 'gang-op') return 'gang operation';
    if (layerIds[0] === 'loot-collectibles') return 'collectible';
    if (layerIds[0]?.startsWith('shops-')) return 'shop';
    if (layerIds[0] === 'interiors') return 'enterable building';
    if (layerIds[0]?.startsWith('cards:')) return 'card';
    if (layerIds[0] === 'my-markers') return 'marker of yours';
    return 'place';
  }
  if (layerIds.includes('gyms')) return 'gym';
  if (layerIds.includes('equipment')) return 'workout equipment';
  if (layerIds.includes('breakable')) return 'breakable home';
  if (layerIds.includes('gang-op')) return 'gang operation';
  // A card question requests all eighteen cards:* layers plus
  // loot-collectibles — the noun is still "card", never "place",
  // or the proximity verdict reads "there is no place near Capri"
  // for a question that asked for a card.
  if (layerIds.some((id) => id.startsWith('cards:'))) return 'card';
  if (layerIds.includes('loot-collectibles')) return 'collectible';
  return 'place';
}

function formatDistance(units: number): string {
  return `about ${Math.round(units / 100) * 100} map units away`;
}

/**
 * The area-known answer for a named place with no verified position
 * (v0.32 gang-op follow-up, lane 2): its area + likely area + safe
 * code / loot where known, in two sentences. The verdict shows the
 * first two sentences (shortVerdict), so the facts that matter —
 * gang, area, likely area, no position, code — are in them, never
 * in a third sentence the panel cuts off. Null for positioned places
 * and unnamed "?" records: neither is an area-known answer.
 */
function areaKnownSummaryFor(place: Place): string | null {
  if (place.position !== null || isUnnamedPlace(place)) return null;
  const record = gangOpRecordForLocation(place.id);
  if (record) {
    // The likely area is the guide's area lead, minus the region it
    // already repeats ("Port Gellhorn, north of the Pay 'n' Spray"
    // after "Port Gellhorn, Kelly County" is just its second half).
    const regionFirst = record.region.split(',')[0] ?? '';
    let detail = record.areaLead;
    if (detail.startsWith(`${regionFirst}, `)) detail = detail.slice(regionFirst.length + 2);
    else if (detail.endsWith(`, ${record.region}`)) detail = detail.slice(0, -record.region.length - 2);
    else if (detail === record.region) detail = '';
    const first = `${record.name} is a ${record.gang} illegal operation in ${record.region}${detail ? ` — ${detail}` : ''}.`;
    const loot = record.loot.contents;
    const second =
      record.loot.code !== undefined
        ? `It has no verified position, so it can't be pinned on the map — the safe code is ${record.loot.code}.`
        : loot.length > 0
          ? `It has no verified position, so it can't be pinned on the map — the guides list ${loot
              .slice(0, 2)
              .join(' and ')} among the key valuables.`
          : `It has no verified position, so it can't be pinned on the map, and no guide has published its key valuables yet.`;
    return `${first} ${second}`;
  }
  // Any other area-known place: title + region, then no position +
  // the guide loot where the breakable-loot map has it (Parlor
  // Apartments is the gang-op case above, not this one).
  const loot = GUIDE_BREAKABLE_LOOT.get(place.id);
  const first = `${place.title} is in ${place.region}.`;
  const second = loot
    ? `It has no verified position, so it can't be pinned on the map — the guides list ${loot.charAt(0).toLowerCase() + loot.slice(1)}`
    : `It has no verified position, so it can't be pinned on the map — it is listed by area only.`;
  return `${first} ${second}`;
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
  if (positioned.length === 0) {
    // Every record in scope is area-known: no distance was ever
    // measured, so the answer must never claim "these are the
    // nearest" — the fallback verdict would, and it would be a lie.
    return `There is no ${noun} with a verified position near ${areaName} in the map data, so how far away things are cannot be measured.`;
  }
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
  // Gyms and equipment never leak into each other through tags: the
  // free-gear places carry a 'gym' tag (they are gyms in the loose
  // sense), but a gym question must not answer from them, and a member
  // club must not answer an equipment question.
  if (layerId === 'gyms')
    return (
      place.layerId !== 'equipment' &&
      tags.some((tag) => ['gym', 'fitness'].includes(tag))
    );
  if (layerId === 'equipment')
    return (
      place.layerId !== 'gyms' &&
      tags.some((tag) => ['equipment', 'workout'].includes(tag))
    );
  if (layerId.startsWith('shops-'))
    return tags.some((tag) => (SHOP_TAGS as readonly string[]).includes(tag));
  if (layerId === 'lootable')
    return (
      tags.includes('enterable') &&
      tags.some((tag) => (ROBBABLE_SHOP_TAGS as readonly string[]).includes(tag))
    );
  if (layerId === 'interiors') return tags.includes('enterable');
  // Breakable homes: the tag, or residential + enterable (the 33 GTADB
  // houses). The Capri rob-house candidates carry the layer itself, so
  // they match through allowed.has(layerId) rather than through tags.
  if (layerId === 'breakable')
    return (
      tags.includes('breakable') ||
      (tags.includes('residential') && tags.includes('enterable'))
    );
  return false;
}

export function retrieveForAsk(input: AskRetrievalInput): AskRetrievalResult {
  const { question, places, layers } = input;
  let requestedLayerIds = layersRequestedByQuestion(question, layers);
  // A PLACE named by its full title beats a SET named by one
  // signature word inside that title ("where is Manatee Motel?" is
  // the motel, not the Vice City Manatees cards — the motel's name
  // says more than the set word alone). The set route only ever
  // fires on a signature word (or the set's full name); when the
  // anchor's short name carries a word beyond the set's name, the
  // question names the place, so the set layers drop out and the
  // bare-place fallback below brings the anchor's own layer in
  // instead. A place whose short name adds NOTHING to the set name
  // ("Delights", "Jack of Hearts", "NINE1NINE") keeps the Delights
  // ruling: the set wins, unless a kind is named.
  const namedSetForPlace = cardSetForQuestion(question);
  const anchorForPlace = anchorForQuestion(question, places);
  if (
    namedSetForPlace &&
    anchorForPlace &&
    requestedLayerIds.every((id) => id.startsWith('cards:') || id === 'loot-collectibles')
  ) {
    const stem = (word: string): string => (word.endsWith('s') ? word.slice(0, -1) : word);
    const setWords = new Set(normalizeAsk(namedSetForPlace.name).split(' ').map(stem));
    const short = normalizeAsk(
      (anchorForPlace.title.split(' — ')[0] ?? anchorForPlace.title).split(',')[0] ?? '',
    );
    const extra = short
      .split(' ')
      .filter((word) => word.length > 0 && !setWords.has(stem(word)));
    if (extra.length > 0) requestedLayerIds = [];
  }
  if (!namedSetForPlace && anchorForPlace && requestedLayerIds.length > 0) {
    // Kind words inside a place name do not hijack a "where is X?"
    // question ("where is Gas Station Meth Front?" is the op, not a
    // request for the Vehicle services layer — "gas" is in its
    // name). If nothing outside the anchor's short name asks for a
    // layer, the question is about the place: drop the kind scope
    // and let the bare-place fallback below bring the anchor's own
    // layer in instead. A kind question that ALSO names a kind
    // outside the place ("shops near Starlet Motel") keeps its scope
    // — the remainder still asks for it.
    const short = normalizeAsk(
      (anchorForPlace.title.split(' — ')[0] ?? anchorForPlace.title).split(',')[0] ?? '',
    );
    if (short.length > 0) {
      const withoutAnchor = normalizeAsk(question).split(short).join(' ');
      if (layersRequestedByQuestion(withoutAnchor, layers).length === 0) {
        requestedLayerIds = [];
      }
    }
  }
  // A bare PLACE name brings its layer into scope (the same bare-name
  // class as the set fix above): "Starlet Motel" or "NINE1NINE" with
  // every layer off must answer with that place, not "Nothing in the
  // map data for that". Only when the question asked for NO layer at
  // all — a question that already names a kind ("shops near Starlet
  // Motel") keeps its own scope, and the named place is a measuring
  // point there, not a second kind to answer from. Only the CURRENT
  // question's anchor counts: a follow-up inherits the earlier
  // question's PLACE for distances, never its layer.
  if (requestedLayerIds.length === 0) {
    const named = anchorForQuestion(question, places);
    if (named && layers.some((layer) => layer.id === named.layerId)) {
      requestedLayerIds = [named.layerId];
    }
  }
  // Scope: when the question asks for specific layers, ONLY those layers
  // (plus My markers) are in scope — a visible-but-unasked layer must never
  // hijack the answer (e.g. a gym question must not return an interior just
  // because Interiors is on and the county filter matches it). Visible
  // layers only count for general questions that name no layer.
  // (features/spoiler/visibility.ts — one source of truth.)
  const allowed = askAllowedLayerIds(requestedLayerIds, layers);
  const visited = new Set(input.visitedIds ?? []);
  const hideFound = input.filters.hideFound || input.filters.remainingOnly;
  const asksGyms = requestedLayerIds.includes('gyms');
  const asksEquipment = requestedLayerIds.includes('equipment');
  const asksWorkout = asksGyms || asksEquipment;
  const asksBreakable = requestedLayerIds.includes('breakable');
  // A marker-kind question only takes matching markers from My markers:
  // a workout question takes workout markers, a breakable question takes
  // breakable markers, a question asking for both takes either. A
  // general question takes all of them — they are the user's own notes.
  const asksMarkerKind = asksWorkout || asksBreakable;

  let eligible = places.filter(
    (place) =>
      (allowed.has(place.layerId) ||
        // Tag evidence: a "?" place whose tags say it is the thing asked
        // for counts, whatever layer it sits in (see tagMatchesLayer).
        (requestedLayerIds.length > 0 &&
          requestedLayerIds.some((id) => tagMatchesLayer(place, id))) ||
        // The user's own tags: a place he tagged "workout equipment"
        // answers a workout question, whatever layer it sits in.
        (requestedLayerIds.length > 0 &&
          requestedLayerIds.some((id) =>
            userTagsMatchLayer(input.userTags?.get(place.id) ?? [], id),
          )) ||
        // AI evidence: a confident AI type counts the same way — a gym
        // the AI suggested for a "?" near Capri answers a gym question.
        (requestedLayerIds.length > 0 &&
          requestedLayerIds.some((id) =>
            aiCategoryMatchesLayer(input.aiCategories?.[place.id], place, id),
          ))) &&
      !(hideFound && visited.has(place.id)) &&
      !(
        asksMarkerKind &&
        place.layerId === 'my-markers' &&
        !(
          (asksWorkout && isWorkoutMarker(place)) ||
          (asksBreakable && isBreakableMarker(place))
        )
      ),
  );
  // Nightlife narrowing (see nightlifeTagsForQuestion): when the
  // question names a nightlife subtype, only nightlife evidence
  // counts — a source #tag, the user's own tag, or a confident AI
  // "bar" type. Without this the two Vice City nightclubs drown in
  // the nearest thirty Food & Drink shops, and the answer reads as
  // a shop list instead of the clubs asked for.
  const nightlifeTags = nightlifeTagsForQuestion(question);
  if (nightlifeTags.length > 0) {
    eligible = eligible.filter((place) =>
      isNightlifePlace(
        place,
        nightlifeTags,
        input.userTags?.get(place.id),
        input.aiCategories?.[place.id],
      ),
    );
  }
  // Card narrowing (reported 2026-11-26): a question that asks for
  // CARDS takes trading cards only — the Loot Map collectibles bucket
  // holds meditations, magazines and watches too, and a "cards near
  // Capri" question answered with the Smooth Sand meditation because
  // it was the only eligible place with "Capri" in its region. A
  // generic "collectibles" question still takes the whole bucket.
  if (asksForCardsOnly(question)) {
    eligible = eligible.filter(
      (place) => place.layerId !== 'loot-collectibles' || place.tags.includes('trading-card'),
    );
  }
  // Set narrowing: a question naming one card set takes that set only —
  // its cards:* layer plus the Loot Map dancer cards tagged with the
  // set id. "Help me find the Delights Dancers card set" is two cards
  // (Vicki + Harley), not all 25 collectibles.
  //
  // The narrowing does NOT apply when the question also asks for a
  // different kind. A set name can double as a place name — NINE1NINE
  // is a nightclub AND a dancer set — and "NINE1NINE nightclub" is a
  // nightclub question, not a card question: the kind scope wins and
  // the set is not used as a filter. A bare "NINE1NINE" (or "Delights")
  // names nothing else, so the set reading wins — the task's ruling
  // on "Delights" generalises. Same for the other collectibles in the
  // loot bucket: "meditations near NINE1NINE" is a meditation
  // question, not the Nine1Nine set.
  const askedSet = cardSetForQuestion(question);
  const asksOtherKind =
    requestedLayerIds.some(
      (id) => !id.startsWith('cards:') && id !== 'loot-collectibles',
    ) ||
    ['meditation', 'meditations', 'magazine', 'magazines', 'watch', 'watches'].some((p) =>
      hasPhrase(normalizeAsk(question), p),
    );
  /** The set is the question's subject (see the narrowing comment
   *  below). The area/county sort-not-filter rule keys off this, not
   *  off the bare set match — a nightclub question that happens to
   *  name a set must keep its area filter. */
  const setNarrows = askedSet !== null && !asksOtherKind;
  if (setNarrows) {
    eligible = eligible.filter(
      (place) => place.layerId === `cards:${askedSet.id}` || place.tags.includes(askedSet.id),
    );
  }
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
  // Whether the scope above came from the CURRENT question: a
  // follow-up inherits the earlier question's PLACE for distances,
  // never as the subject of a new answer — the area-known path below
  // only fires on a current-question anchor.
  let scopeFromCurrentQuestion = false;
  for (let i = 0; i < scopeQuestions.length; i += 1) {
    const scopeQuestion = scopeQuestions[i]!;
    anchor = anchorForQuestion(scopeQuestion, places);
    areaWord = areaWordForQuestion(scopeQuestion, places);
    namedCounty =
      countyIdFromText(scopeQuestion) ??
      COUNTIES.find((c) => hasWord(normalizeAsk(scopeQuestion), c.id))?.id ??
      null;
    if (anchor || areaWord || namedCounty) {
      scopeFromCurrentQuestion = i === 0;
      break;
    }
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
  // SET WINS OVER AREA (DESIGN §7.2, normative): when a card set is
  // named, the area word is a SORT, never a filter. The old area
  // filter dropped the loot Harley from a Delights set answer because
  // "Delights" is also an area word (Jason's host region starts with
  // "Delights") and Harley's region is Port Gellhorn — set narrowing
  // lost to an area filter because both were string matching over the
  // same flat record. Every set item stays, positioned or not,
  // nearest first from the area's centroid; the verdict says honestly
  // when none of them is near the named area.
  if (setNarrows && areaWord) {
    areaLabel = areaWord;
    const areaAnchor = areaAnchorForWord(areaWord, places);
    anchor = areaAnchor.place ?? anchor;
    anchorPosition = areaAnchor.position ?? anchorPosition;
    scoped = anchorPosition ? [...eligible].sort(byDistanceFrom(anchorPosition)) : [...eligible];
    const nearest = scoped.find((p) => p.position);
    if (
      nearest &&
      anchorPosition &&
      distance(nearest.position!, anchorPosition) > NEAR_DISTANCE_UNITS
    )
      areaMismatch = true;
  }
  // 1. A named area that actually holds matching places: answer from that
  // area only, nearest first. (Mount Kalaga gyms: only the gym in that area.)
  if (scoped === eligible && areaWord) {
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
  // nearest-first, measured from the county centre. A named set beats
  // the county filter the same way it beats the area filter (§7.2):
  // the county is a sort from its centre, never a filter that drops
  // set items pinned elsewhere (or with no position at all).
  if (scoped === eligible && county) {
    areaLabel = county.name;
    if (setNarrows) {
      const centre = {
        x: (county.bounds.west + county.bounds.east) / 2,
        y: (county.bounds.south + county.bounds.north) / 2,
      };
      anchorPosition = centre;
      scoped = [...eligible].sort(byDistanceFrom(centre));
      const nearest = scoped.find((p) => p.position);
      if (nearest && distance(nearest.position!, centre) > NEAR_DISTANCE_UNITS)
        areaMismatch = true;
    } else {
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
    }
  } else if (scoped === eligible && direction) {
    areaLabel = direction;
    scoped = eligible.filter((p) => p.position && inDirection(p.position, direction));
    if (scoped.length === 0) {
      areaMismatch = true;
      scoped = eligible;
    }
  }

  // AREA-KNOWN ANSWER (v0.32 gang-op follow-up, lane 2): the
  // question names a place the catalogue knows by area only — no
  // verified position, so no distance can ever be measured from it.
  // The answer is the place itself first, its same-region area-mates
  // after it, and a summary built from the place's own facts (area,
  // gang, safe code / loot) — never a proximity verdict, never
  // "Nothing in the map data". The anchor here is the place the
  // CURRENT question names by title — NOT the scope loop's anchor,
  // which an area word can overwrite with the area's centroid
  // representative ("where is Watson Bay Safehouse?" must answer
  // the Safehouse, not the Palmer warehouse that shares its bay).
  // Only when that named place is in scope: a kind question that
  // merely measures from a place ("gyms near Brooks Boatworks")
  // keeps its own scope, and a follow-up never inherits a subject.
  const namedAnchor = anchorForQuestion(question, places);
  const unpositionedAnchor =
    scopeFromCurrentQuestion &&
    namedAnchor !== null &&
    namedAnchor.position === null &&
    !isUnnamedPlace(namedAnchor) &&
    scoped.some((p) => p.id === namedAnchor!.id)
      ? namedAnchor
      : null;
  if (unpositionedAnchor) {
    areaLabel = `near ${unpositionedAnchor.title}`;
    const anchorRegion = normalizeAsk(unpositionedAnchor.region);
    scoped = [
      unpositionedAnchor,
      ...scoped.filter(
        (p) => p.id !== unpositionedAnchor!.id && normalizeAsk(p.region) === anchorRegion,
      ),
    ];
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

  // Houses to check: a gym question in a named area or county with no
  // gym near it. Capri is the case that matters — 0 gym tags in the
  // whole snapshot outside Ajax Gym, no guide lists a gym there, and
  // most Capri "?" records carry no tag at all — so the honest answer is
  // the nearest verified gym PLUS the enterable/residential "?" houses
  // in that area, as candidates to check, never as gyms. They are not
  // sent to the AI and never presented as verified.
  let houses: Place[] = [];
  let housesTotal = 0;
  let housesAreaName: string | null = null;
  const housesKind: 'equipment' | 'gym' | null =
    asksEquipment && !asksGyms ? 'equipment' : asksGyms ? 'gym' : null;
  if (asksWorkout && nearCount === 0 && anchorPosition && (areaWord || county)) {
    const inAreaWord = (place: Place) =>
      areaWord !== null &&
      normalizeAsk(`${place.title} ${place.region}`).includes(areaWord);
    const matchesArea = areaWord
      ? inAreaWord
      : (place: Place) => county !== undefined && county !== null && countyForPlace(place) === county.id;
    // The area word is normalised lowercase ("capri"); display it
    // with a capital, like the county names already are.
    housesAreaName =
      areaWord !== null
        ? areaWord.charAt(0).toUpperCase() + areaWord.slice(1)
        : (county?.name ?? null);
    const found = housesToCheck(
      places,
      anchorPosition,
      (place) =>
        matchesArea(place) && !records.some((record) => record.id === place.id),
    );
    houses = found.places;
    housesTotal = found.total;
  }

  const noun = placeNounForLayers(requestedLayerIds);
  // The area-known summary replaces the proximity verdict outright:
  // there is no distance to report for a place with no position.
  const areaKnownSummary = unpositionedAnchor ? areaKnownSummaryFor(unpositionedAnchor) : null;
  let proximitySummary: string | null = null;
  if (areaLabel && (anchorPosition || anchor)) {
    proximitySummary = areaKnownSummary ?? proximitySummaryFor(
      areaLabel.startsWith('near ') ? areaLabel.slice('near '.length) : areaLabel,
      noun,
      records,
      anchorDistances,
      anchorPosition,
    );
    // House-level gap, stated honestly: no source lists workout gear
    // inside houses, so the public list is never the whole picture for
    // workouts. A user-marked house gym is already in the records above
    // when it is near — this line says where to get one when there is
    // none. Equipment the user knows about is in a garage in a house:
    // the houses below are the ones to check, not a guessed pin.
    // Not for an area-known answer: that answer is about the named
    // place, not about where to work out.
    if (asksWorkout && nearCount === 0 && proximitySummary && !areaKnownSummary) {
      if (asksEquipment && !asksGyms) {
        proximitySummary +=
          ' Workout equipment in a garage in a house is not in the public map data yet — no source lists it. If you mark a house yourself, Ask will use your marker next time.';
      } else {
        proximitySummary +=
          ' House gyms and workout gear inside houses are not in the public map data yet — no source lists them. If you mark a house gym yourself, Ask will use your marker next time.';
      }
      if (housesTotal > 0 && housesAreaName) {
        proximitySummary +=
          asksEquipment && !asksGyms
            ? ` ${housesTotal} house${housesTotal === 1 ? '' : 's'} in ${housesAreaName} ${housesTotal === 1 ? 'is' : 'are'} worth checking — listed below. None of them is verified workout equipment.`
            : ` ${housesTotal} house${housesTotal === 1 ? '' : 's'} in ${housesAreaName} ${housesTotal === 1 ? 'is' : 'are'} worth checking — listed below. None of them is a verified gym.`;
      }
    }
    // Breakable homes are systemic: the in-game map is the source of
    // truth, and the list is examples plus tagged houses, never a count
    // of every breakable home. Say the rule in the answer itself.
    if (asksBreakable && proximitySummary) {
      proximitySummary += ` ${DARK_BLUE_RULE} ${BREAKABLE_GAP_NOTE}`;
    }
  }
  // The systemic rule, as one line under the verdict (see the
  // ruleNote field): the verdict is capped at two sentences, so the
  // full rule in the summary above never reaches the screen.
  const ruleNote =
    asksBreakable && proximitySummary
      ? (DARK_BLUE_RULE.split(/(?<=[.!])\s+/).filter(Boolean)[0] ?? null)
      : null;

  // EMPTY-ANSWER ADVICE (v0.32 gang-op follow-up, lane 2): the "try
  // turning a layer on" line is only ever actionable when a layer
  // exists to turn on. When the question asked for gang ops by kind
  // but no 'gang-op' layer is defined yet, say so and name one by
  // name — that check comes FIRST, so an incidental area anchor
  // (e.g. the Lost Vista trailers for "gang operations in Lost
  // Vista") never answers a kind question about something else.
  // When the question named an area-known record, say the area
  // instead — a layer toggle can never pin it, so the advice names
  // the place, its gang and its code, and points at Find. Otherwise
  // null, and AskPanel keeps its existing line (which names only
  // layers that exist, via requestedLayerNames).
  let emptyAdvice: string | null = null;
  if (records.length === 0) {
    if (asksForGangOps(question) && !layers.some((layer) => layer.id === 'gang-op')) {
      emptyAdvice =
        'Gang operations are listed by area only — no verified positions, so no layer can pin them on the map. Ask for one by name, like "where is Brooks Boatworks?", and I will tell you its area and safe code.';
    } else {
      // The place the current question names, else the scope loop's
      // anchor (an inherited follow-up subject, or the area's
      // representative for a bare area question).
      const adviceAnchor = namedAnchor ?? anchor;
      if (
        adviceAnchor &&
        !adviceAnchor.position &&
        !isUnnamedPlace(adviceAnchor) &&
        (requestedLayerIds.length === 0 || requestedLayerIds.includes(adviceAnchor.layerId))
      ) {
        const summary = areaKnownSummaryFor(adviceAnchor);
        emptyAdvice = summary
          ? `${summary} Find lists it by name, or drop your own marker when you find it.`
          : `${adviceAnchor.title} is in ${adviceAnchor.region} — it has no verified position, so it can't be pinned on the map. Find lists it by name, or drop your own marker when you find it.`;
      }
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
    housesToCheck: houses,
    housesToCheckTotal: housesTotal,
    housesAreaName,
    housesKind: houses.length > 0 ? housesKind : null,
    ruleNote,
    emptyAdvice,
  };
}
