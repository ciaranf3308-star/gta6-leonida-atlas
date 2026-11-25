import type { Place } from "../../domain/types";
import { isUnnamedPlace } from "../../domain/types";
import { tagResolutionFor, tagResolutionForTags } from "../../domain/resolve-tags";
import { EQUIPMENT_PLACES, GYM_PLACES } from "../../data/gyms";
import {
  realWorldAnalogueFromDescription,
  type AiCategoryId,
  type AiCategoryRecord,
  type ParsedCategorisationResult,
  type ResolutionSource,
} from "./categories";

/**
 * Index resolver v2 — deterministic first, LLM last.
 *
 * WHY (user, 2026-11-24): the v1 job sent the LLM a "?" with almost no
 * data (coords + sparse tags + nearby names) and asked it to guess —
 * that is guessing, not resolving, and it showed: about half the
 * answers came back unsure. A mark at X/Y in the most popular game in
 * the world CAN be resolved — by matching those coords against real
 * data first. So every place now runs these steps in order, and only
 * what survives all of them reaches the LLM:
 *
 *   a. TAG — the map data's own tags (581 + extended rules, see
 *      resolve-tags.ts). A tag is the source speaking, not a guess.
 *   b. COORDINATE — same spot as a named GTADB record. Calibrated
 *      against the snapshot, NOT the 50–100 units the brief suggested:
 *      records sit a median 118 units apart, and at 50 units most
 *      "matches" are neighbouring buildings, not the same place —
 *      proven by tag disagreements (67 disagree vs 15 agree at 50u).
 *      So the tolerance is 15 units, AND a tag-type on either side
 *      must not contradict the other. Yield on the real snapshot: 15
 *      same-spot candidates, ~8 that yield a type. Small and honest.
 *   c. GUIDE — same spot as a verified guide pin (the gym / equipment
 *      pins from GTA6 GPS and the guides in src/data/gyms.ts, 25 units
 *      — guide pins are approximate, so they get more slack than
 *      GTADB records, but the place must carry no tag-type of its own
 *      to contradict). The guide lists with coordinates are the ones
 *      already pulled and bundled; the shop guides (TheGamesWiki,
 *      PowerPyx/Game8) publish counts but no pullable positions, so
 *      their missing shops cannot be matched by coords — that gap is
 *      shown in the panel, not hidden, and no live per-place web
 *      lookup runs on the phone: there is no pullable endpoint for it,
 *      and the app must not fetch guide sites for 2,700 places.
 *      Collectible card pins are host-building pins, so a "?" at a
 *      card host resolves through the GTADB host record in step (b),
 *      not through the card. Yield: 4 gyms.
 *   d. ANALOGUE — narrow keyword rules on the real-world analogue
 *      address ("Apartments" reads residential, "Supermarket" reads
 *      shop). Ordered, with the ambiguous words dropped: no hotel
 *      (a hotel name says "a building", same as the hotel tag), no
 *      marina, no "filling station" ("Filling Station Lofts" is flats,
 *      not fuel), and "Bar & Grill" reads restaurant, not bar. Only
 *      fires when tags, coordinate and guide found nothing, so a tag
 *      always wins over an analogue reading. Yield: ~100.
 *   e. LLM — only for what is left after a–d, with the full context
 *      (coords, tags, analogue, nearby, enterable, and the note that
 *      every deterministic check already failed), temperature 0, JSON
 *      mode, and the existing honesty guards (never invents a name,
 *      <0.6 stays "not sure", labelled "AI suggested").
 *
 * The goal is to drive "not sure" DOWN by resolving from data first,
 * never by lowering the confidence bar — a guess is never presented
 * as a fact, and every resolved type carries its source so the user
 * can see exactly how it was earned.
 */

/** Same-spot tolerance for GTADB records, in map units (see above). */
export const COORDINATE_MATCH_UNITS = 15;
/** Guide-pin tolerance, in map units — guide pins are approximate. */
export const GUIDE_MATCH_UNITS = 25;

/** Deterministic confidences: data matches outrank any LLM suggestion,
 * and a tag is the source speaking. All clear MIN_AI_CONFIDENCE (0.6)
 * on purpose — these are not guesses. */
export const DETERMINISTIC_CONFIDENCE: Record<
  Exclude<ResolutionSource, "ai">,
  number
> = { coordinate: 0.9, tag: 0.95, guide: 0.8, analogue: 0.75 };

export interface DeterministicResolution extends ParsedCategorisationResult {
  source: Exclude<ResolutionSource, "ai">;
}

/** A verified guide pin with a position — the only guide entries that
 * can match by coordinates. Breakable-home guide examples have no
 * verified position, so they are not entries: an area-only match would
 * be a guess, and their houses already resolve through tags. */
export interface GuideEntry {
  title: string;
  position: { x: number; y: number };
  category: AiCategoryId;
  /** Where the pin was verified, for the reason line. */
  sourceLabel: string;
}

export const GUIDE_ENTRIES: GuideEntry[] = [
  ...GYM_PLACES.filter(
    (place): place is Place & { position: NonNullable<Place["position"]> } =>
      place.position !== null,
  ).map((place) => ({
    title: place.title,
    position: place.position,
    category: "gym" as const,
    sourceLabel: `${place.title} — ${place.source.title}`,
  })),
  ...EQUIPMENT_PLACES.filter(
    (place): place is Place & { position: NonNullable<Place["position"]> } =>
      place.position !== null,
  ).map((place) => ({
    title: place.title,
    position: place.position,
    category: "gym" as const,
    sourceLabel: `${place.title} — ${place.source.title}`,
  })),
];

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The type a NAMED place carries, for the coordinate step: its tags
 * first (same rules as an unnamed place), then its layer — a member
 * gym, a free-equipment spot, a shop, a lootable shop or a breakable
 * home says what it is even when its tags do not. Interiors,
 * community and card pins say nothing about type on their own.
 */
export function categoryForNamedPlace(
  place: Place,
): { category: AiCategoryId; shopType?: string } | null {
  const fromTags = tagResolutionForTags(place.tags);
  if (fromTags) return { category: fromTags.category, shopType: fromTags.shopType };
  if (place.layerId === "gyms" || place.layerId === "equipment")
    return { category: "gym" };
  if (place.layerId.startsWith("shops") || place.layerId === "lootable")
    return { category: "shop" };
  if (place.layerId === "breakable") return { category: "house" };
  if (place.layerId === "regions") return { category: "landmark" };
  return null;
}

function coordinateResolution(
  place: Place,
  allPlaces: readonly Place[],
): DeterministicResolution | null {
  if (!place.position) return null;
  // Named, positioned records — GTADB records first on a distance tie
  // (a seeded pin sits on a GTADB host's position; the host record is
  // the match, the pin is the corroboration).
  const named = allPlaces.filter(
    (candidate) =>
      candidate.id !== place.id &&
      candidate.position !== null &&
      !isUnnamedPlace(candidate) &&
      candidate.layerId !== "my-markers",
  );
  let best: Place | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of named) {
    // Cheap bounding-box reject first: Math.hypot on every candidate
    // makes the full-snapshot pass ~5s; the box check keeps it fast
    // (and the per-batch job on the phone trivial).
    const dx = candidate.position!.x - place.position.x;
    if (dx > COORDINATE_MATCH_UNITS || dx < -COORDINATE_MATCH_UNITS) continue;
    const dy = candidate.position!.y - place.position.y;
    if (dy > COORDINATE_MATCH_UNITS || dy < -COORDINATE_MATCH_UNITS) continue;
    const d = Math.hypot(dx, dy);
    if (
      d < bestDistance ||
      (d === bestDistance && best !== null && /^L\d+$/.test(candidate.id) && !/^L\d+$/.test(best.id))
    ) {
      best = candidate;
      bestDistance = d;
    }
  }
  if (!best || bestDistance > COORDINATE_MATCH_UNITS) return null;
  const mine = tagResolutionForTags(place.tags);
  const theirs = categoryForNamedPlace(best);
  if (!theirs) return null;
  // A tag-type on either side must not contradict the other — a "?"
  // tagged residential 12 units from a named shop is a neighbour, not
  // that shop.
  if (mine && mine.category !== theirs.category) return null;
  return {
    placeId: place.id,
    category: theirs.category,
    shopType: theirs.shopType ?? mine?.shopType,
    confidence: DETERMINISTIC_CONFIDENCE.coordinate,
    reason: `Same spot as ${best.title} (${Math.round(bestDistance)} map units away) — the same building in the map data.`,
    source: "coordinate",
    matchedFrom: best.title,
  };
}

function guideResolution(place: Place): DeterministicResolution | null {
  if (!place.position) return null;
  // The tag step already ran: a place reaching here carries no
  // tag-type, so nothing can contradict a guide pin.
  let best: GuideEntry | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entry of GUIDE_ENTRIES) {
    const d = distance(place.position, entry.position);
    if (d < bestDistance) {
      best = entry;
      bestDistance = d;
    }
  }
  if (!best || bestDistance > GUIDE_MATCH_UNITS) return null;
  return {
    placeId: place.id,
    category: best.category,
    confidence: DETERMINISTIC_CONFIDENCE.guide,
    reason: `${Math.round(bestDistance)} map units from the verified guide pin for ${best.title}.`,
    source: "guide",
    matchedFrom: best.sourceLabel,
  };
}

/**
 * Narrow keyword rules on the real-world analogue address. Ordered
 * most specific first; the first match wins. Deliberately missing:
 * hotel (a hotel name says "a building", like the hotel tag), marina
 * ("Marina Blue" is flats), "filling station" ("Filling Station
 * Lofts" is flats) — all three misread real analogues in the
 * snapshot. "Bar & Grill" reads restaurant, not bar.
 */
const ANALOGUE_RULES: ReadonlyArray<{
  pattern: RegExp;
  category: AiCategoryId;
  shopType?: string;
  matched: string;
}> = [
  { pattern: /\bgas station\b/i, category: "petrol", matched: "a gas station" },
  { pattern: /\bsuper\s?market\b|\bgrocery\b/i, category: "shop", shopType: "supermarket", matched: "a supermarket" },
  {
    pattern: /\brestaurant\b|\bdiner\b|\bpizzeria\b|\btaqueria\b|\bsushi\b|\bgrill\b|\bcafe\b|\bcoffee\b|\bbakery\b/i,
    category: "restaurant",
    matched: "a restaurant",
  },
  { pattern: /\bbar\b|\bpub\b|\bnightclub\b|\bbrewery\b/i, category: "bar", matched: "a bar" },
  {
    pattern: /\b(apartments?|condominiums?|condos?|residences|townhouses?|townhomes?)\b/i,
    category: "house",
    matched: "an apartment building",
  },
  { pattern: /\bgym\b|\bfitness center\b|\bfitness centre\b/i, category: "gym", matched: "a gym" },
  { pattern: /\bpharmacy\b/i, category: "shop", shopType: "pharmacy", matched: "a pharmacy" },
  { pattern: /\bhospital\b|\bmedical center\b/i, category: "services", matched: "a hospital" },
  { pattern: /\bschool\b|\buniversity\b|\bcollege\b/i, category: "services", matched: "a school" },
  { pattern: /\bchurch\b|\btemple\b|\bmosque\b|\bsynagogue\b/i, category: "landmark", matched: "a church" },
  {
    pattern: /\btrain station\b|\bbus station\b|\bmetro station\b|\bairport\b|\bterminal\b/i,
    category: "transport",
    matched: "a station",
  },
  { pattern: /\bbank\b/i, category: "services", matched: "a bank" },
  {
    pattern: /\bmuseum\b|\btheatre\b|\btheater\b|\bcinema\b|\bstadium\b|\barena\b/i,
    category: "leisure",
    matched: "a leisure venue",
  },
  { pattern: /\bpolice\b|\bfire station\b|\bcourthouse\b/i, category: "services", matched: "a public service building" },
  { pattern: /\bstore\b|\bshop\b|\bmall\b|\bmarket\b/i, category: "shop", matched: "a shop" },
];

/** The analogue rule that fires for a place's analogue address, if any. */
export function analogueResolutionFor(
  description: string,
): { category: AiCategoryId; shopType?: string; matched: string } | null {
  const analogue = realWorldAnalogueFromDescription(description);
  if (!analogue) return null;
  for (const rule of ANALOGUE_RULES) {
    if (rule.pattern.test(analogue))
      return { category: rule.category, shopType: rule.shopType, matched: rule.matched };
  }
  return null;
}

function analogueResolution(place: Place): DeterministicResolution | null {
  const hit = analogueResolutionFor(place.description);
  if (!hit) return null;
  return {
    placeId: place.id,
    category: hit.category,
    shopType: hit.shopType,
    confidence: DETERMINISTIC_CONFIDENCE.analogue,
    reason: `Analogue address names ${hit.matched} — the Miami-area building this place was modelled on.`,
    source: "analogue",
  };
}

/**
 * Resolve one unnamed place without the LLM, in order: tag, same-spot
 * coordinate, guide pin, analogue keywords. Returns null when nothing
 * fires — that place is the LLM's job, and only the LLM's. Named
 * places never resolve here: they already say what they are.
 */
export function resolvePlaceDeterministically(
  place: Place,
  allPlaces: readonly Place[],
): DeterministicResolution | null {
  if (!isUnnamedPlace(place)) return null;
  const tag = tagResolutionFor(place);
  if (tag) {
    return {
      placeId: place.id,
      category: tag.category,
      shopType: tag.shopType,
      confidence: DETERMINISTIC_CONFIDENCE.tag,
      reason: `Tagged ${tag.label.toLowerCase()} in the map data.`,
      source: "tag",
    };
  }
  return (
    coordinateResolution(place, allPlaces) ??
    guideResolution(place) ??
    analogueResolution(place)
  );
}

/** How many places the job resolved, by source — for the IndexPanel's
 * honest count. Tag counts come from the live tag rules (not the
 * store), so they are counted by the caller and added there. */
export function resolutionSourceCounts(
  categories: Readonly<Record<string, AiCategoryRecord>>,
): {
  coordinate: number;
  guide: number;
  analogue: number;
  ai: number;
  unsure: number;
} {
  const counts = { coordinate: 0, guide: 0, analogue: 0, ai: 0, unsure: 0 };
  for (const record of Object.values(categories)) {
    if (record.status === "unsure" || record.confidence < 0.6) {
      counts.unsure += 1;
      continue;
    }
    const source = record.source ?? "ai";
    // Tag resolutions are counted live from the tag rules (see
    // tagResolutionCounts), not from the store — a job-resolved tag
    // record is already in that live count, so counting it here would
    // double-count it and mislabel it.
    if (source === "tag") continue;
    if (source === "coordinate") counts.coordinate += 1;
    else if (source === "guide") counts.guide += 1;
    else if (source === "analogue") counts.analogue += 1;
    else counts.ai += 1;
  }
  return counts;
}
