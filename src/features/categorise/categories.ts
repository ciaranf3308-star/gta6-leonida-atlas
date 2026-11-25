import type { Place } from "../../domain/types";
import { countyForPlace } from "../../data/counties";
import { displayTagsFor } from "../../domain/tags";
import { DEFAULT_ASK_MODEL } from "../ask/openai";

/**
 * AI categorisation of the unnamed "?" places — the index job.
 *
 * 2,768 of the 3,754 GTADB records have no confirmed name; 2,732 of
 * them are still "?" and are this job's scope (the other 36 show a
 * tentative name with a "?"). 1,042 of the 2,732 already carry a tag
 * that says what they are (house, shop, petrol station) and 1,108 carry
 * no tag at all — and with no tag and no analogue address there is
 * nothing for the AI to read, so those stay "not sure" rather than
 * guessed. A gym tag, for instance, appears on exactly one record in
 * the whole snapshot (Ajax Gym, L1869): the AI cannot find gym
 * equipment in Capri houses because no evidence for it exists. This job asks the user's own OpenAI key
 * (the same BYOK setup as Ask Nylah — key in localStorage only, default
 * model gpt-4o-mini, sent only to api.openai.com) to suggest a TYPE for
 * each unnamed place, from the fixed set below, using everything the app
 * already knows: coordinates, source tags, the real-world analogue
 * address, nearby named places, area/county, and whether it is enterable.
 *
 * HONESTY GUARDS (in code, not just in a prompt):
 * - The AI categorises ONLY — it must never invent a proper name. The
 *   place stays "?" whatever the answer; only a type label is added.
 * - A suggestion is NEVER presented as a verified fact. It is labelled
 *   "AI suggested" with its confidence, and the user can confirm or
 *   correct it with one tap.
 * - Low-confidence results (below MIN_CONFIDENCE) stay uncategorised /
 *   "not sure" — they are recorded as attempted so the job does not loop
 *   on them, but they never show as a type.
 * - Results are saved ON-DEVICE only (localStorage, alongside My
 *   markers) — never committed, never sent anywhere except api.openai.com.
 * - The parser only accepts ids it sent and categories from the fixed
 *   set; a `name` field in a reply is ignored outright.
 */

/** The fixed set of types the AI may suggest. Nothing else is accepted. */
export const AI_CATEGORIES = [
  "gym",
  "house",
  "shop",
  "restaurant",
  "bar",
  "petrol",
  "services",
  "leisure",
  "transport",
  "landmark",
  "other",
] as const;

export type AiCategoryId = (typeof AI_CATEGORIES)[number];

export const AI_CATEGORY_LABELS: Record<AiCategoryId, string> = {
  gym: "Gym / workout",
  house: "House / residential",
  shop: "Shop",
  restaurant: "Restaurant / food",
  bar: "Bar",
  petrol: "Petrol station",
  services: "Services",
  leisure: "Leisure",
  transport: "Transport",
  landmark: "Landmark",
  other: "Other",
};

/** Short label for chips and lists ("Gym", "House", "Petrol station"). */
export function aiCategoryShortLabel(category: AiCategoryId): string {
  return AI_CATEGORY_LABELS[category].split(" / ")[0]!;
}

/** Where a stored type came from. 'ai' is the LLM, last resort — the
 * deterministic steps below resolve first, and the label shown in the
 * app follows this field, so a tag match is never shown as "AI
 * suggested". Records written before v0.13.0 have no source and read
 * as 'ai'. */
export type ResolutionSource = 'coordinate' | 'tag' | 'guide' | 'analogue' | 'ai';
/** Below this confidence a suggestion is recorded as "not sure" and is
 * never shown as a type. */
export const MIN_AI_CONFIDENCE = 0.6;

/** Small batches keep each call cheap and the map responsive. */
export const CATEGORISATION_BATCH_SIZE = 8;

export const CATEGORISATION_MODEL = DEFAULT_ASK_MODEL;

export type AiCategoryStatus =
  "suggested" | "unsure" | "confirmed" | "corrected";

export interface AiCategoryRecord {
  placeId: string;
  /** What the AI suggested. */
  aiCategory: AiCategoryId;
  /** Shop kind, only when the AI said `shop` (e.g. "supermarket"). */
  shopType?: string;
  /** 0..1, as returned by the model. */
  confidence: number;
  /** One line from the AI, saying why. */
  reason: string;
  model: string;
  indexedAt: string;
  status: AiCategoryStatus;
  /** The user's correction, when status is `corrected`. */
  userCategory?: AiCategoryId;
  userShopType?: string;
  /** Where the type came from — 'ai' when the LLM suggested it, one of
   * the deterministic resolver steps otherwise. Absent on records
   * written before v0.13.0; those read as 'ai'. */
  source?: ResolutionSource;
  /** What the deterministic step matched — the named place for a
   * coordinate match, the guide pin for a guide match. */
  matchedFrom?: string;
}

/** The source of a stored record — 'ai' for the LLM and for every
 * record written before v0.13.0, which had no source field. */
export function recordSource(
  record: AiCategoryRecord | undefined | null,
): ResolutionSource {
  return record?.source ?? 'ai';
}

/** Short source label for lists ("AI suggested", "From its tags"). */
export function resolutionSourceLabel(source: ResolutionSource): string {
  if (source === 'coordinate') return 'Same spot on the map';
  if (source === 'tag') return 'From its tags';
  if (source === 'guide') return 'Guide match';
  if (source === 'analogue') return 'From its analogue address';
  return 'AI suggested';
}

/** One honest line about where a stored type came from, for the detail
 * sheet — a deterministic match is never called an AI suggestion. */
export function resolutionSourceNote(
  record: AiCategoryRecord | undefined | null,
): string | null {
  if (!record) return null;
  const source = recordSource(record);
  if (source === 'coordinate')
    return `Matched by position${record.matchedFrom ? ` — same spot as ${record.matchedFrom}` : ''}. A type from the map data, not a name.`;
  if (source === 'tag')
    return 'Resolved from the map data’s own tags — not a name, only a type.';
  if (source === 'guide')
    return `Matched to a verified guide entry${record.matchedFrom ? ` — ${record.matchedFrom}` : ''}. A type from the guide, not a name.`;
  if (source === 'analogue')
    return 'Read from its real-world analogue address — the Miami-area building it was modelled on. A type, not a name.';
  return 'AI suggested, not a verified fact. The name stays “?” — only the type is suggested.';
}

/**
 * The type that counts for search, Ask and the detail sheet — null when
 * the AI was not sure enough, or when there is no record at all.
 */
export function effectiveAiCategory(
  record: AiCategoryRecord | undefined | null,
): AiCategoryId | null {
  if (!record) return null;
  if (record.status === "unsure") return null;
  if (record.status === "corrected") return record.userCategory ?? null;
  if (record.confidence < MIN_AI_CONFIDENCE) return null;
  return record.aiCategory;
}

export function effectiveAiShopType(
  record: AiCategoryRecord | undefined | null,
): string | undefined {
  if (!record || effectiveAiCategory(record) !== "shop") return undefined;
  return record.status === "corrected"
    ? (record.userShopType ?? record.shopType)
    : record.shopType;
}

/** A record whose type may be shown (labelled "AI suggested"). */
export function isUsableAiCategory(
  record: AiCategoryRecord | undefined | null,
): record is AiCategoryRecord {
  return effectiveAiCategory(record) !== null;
}

export function aiCategoryDisplay(
  record: AiCategoryRecord | undefined | null,
): { label: string; confidence: number; status: AiCategoryStatus } | null {
  const category = effectiveAiCategory(record);
  if (!record || !category) return null;
  const shopType = effectiveAiShopType(record);
  return {
    label:
      category === "shop" && shopType
        ? `Shop · ${shopType}`
        : AI_CATEGORY_LABELS[category],
    confidence: record.confidence,
    status: record.status,
  };
}

/**
 * Shop kinds the released game lets you hold up (the same small-store /
 * food / drink set as the lootable layer — see src/data/catalogue.ts).
 * An AI "shop" only answers a burglary question when it is enterable AND
 * one of these kinds; a clothes shop never does.
 */
const ROBBABLE_AI_SHOP_TYPES = new Set([
  "supermarket",
  "gas",
  "petrol",
  "food",
  "vendor",
  "bar",
  "liquor",
  "pharmacy",
  "restaurant",
  "retail",
  "store",
  "shop",
  "fast food",
  "convenience",
]);

/**
 * Does this place's AI type answer a question about `layerId` — the same
 * way a source tag does in retrieval.ts (`tagMatchesLayer`)? Only a
 * usable (confident, not "not sure") suggestion counts, and only for the
 * layer the question asked for. An AI gym never answers a burglary
 * question; an AI house never answers a shops question.
 */
export function aiCategoryMatchesLayer(
  record: AiCategoryRecord | undefined | null,
  place: Pick<Place, "tags">,
  layerId: string,
): boolean {
  const category = effectiveAiCategory(record);
  if (!category) return false;
  if (layerId === "gyms" || layerId === "equipment")
    return category === "gym";
  // A "?" the AI suggested is a house answers a breakable-home question
  // — labelled "AI suggested" in the results, never a verified fact.
  if (layerId === "breakable") return category === "house";
  if (layerId === "interiors") {
    // An AI-suggested house / shop / bar / gym is an enterable building
    // only when the record itself is tagged enterable — the AI type
    // alone never claims an interior.
    if (!place.tags.includes("enterable")) return false;
    return (
      category === "house" ||
      category === "shop" ||
      category === "restaurant" ||
      category === "bar" ||
      category === "gym" ||
      category === "services"
    );
  }
  if (layerId.startsWith("shops")) {
    return (
      category === "shop" ||
      category === "restaurant" ||
      category === "bar" ||
      category === "petrol" ||
      category === "services"
    );
  }
  if (layerId === "lootable") {
    if (!place.tags.includes("enterable")) return false;
    if (
      category === "restaurant" ||
      category === "bar" ||
      category === "petrol"
    )
      return true;
    if (category !== "shop") return false;
    const shopType = effectiveAiShopType(record);
    return shopType !== undefined && ROBBABLE_AI_SHOP_TYPES.has(shopType);
  }
  return false;
}

/** Search words for an AI type, so "gym" finds an AI-gym "?" place. */
export function aiCategorySearchWords(
  record: AiCategoryRecord | undefined | null,
): string[] {
  const category = effectiveAiCategory(record);
  if (!category) return [];
  const words = [AI_CATEGORY_LABELS[category].toLowerCase(), category];
  const shopType = effectiveAiShopType(record);
  if (shopType) words.push(shopType);
  if (category === "house") words.push("residential");
  if (category === "petrol") words.push("gas");
  if (category === "gym") words.push("workout", "fitness", "strength");
  return [...new Set(words)];
}

/** The real-world analogue address, as embedded in the place description
 * ("Real-world reference (analogue only): …"). It is an analogue for a
 * Miami-area building — useful evidence for the TYPE (a tower called
 * "Apartments" reads residential), never a name for the Leonida place. */
export function realWorldAnalogueFromDescription(
  description: string,
): string | null {
  const match = /Real-world reference \(analogue only\): (.+)$/.exec(
    description.trim(),
  );
  if (!match) return null;
  return match[1]!.replace(/\.$/, "").trim() || null;
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Nearest named, positioned places — the neighbourhood the AI can read. */
export function nearbyNamedPlaces(
  place: Place,
  allPlaces: readonly Place[],
  limit = 3,
  maxDistance = 1500,
): { title: string; distance: number }[] {
  if (!place.position) return [];
  return allPlaces
    .filter(
      (candidate) =>
        candidate.id !== place.id &&
        candidate.position !== null &&
        !candidate.title.startsWith("?") &&
        !candidate.title.startsWith("Unnamed "),
    )
    .map((candidate) => ({
      title: candidate.title,
      distance: distance(place.position!, candidate.position!),
    }))
    .filter((entry) => entry.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/**
 * Everything the app knows about one unnamed place, as one short line
 * for the prompt. No name is ever asked for; the question is only "what
 * kind of place is this?".
 */
export function buildPlaceContext(
  place: Place,
  allPlaces: readonly Place[],
): string {
  const tags = displayTagsFor(place);
  const analogue = realWorldAnalogueFromDescription(place.description);
  const county = countyForPlace(place);
  const nearby = nearbyNamedPlaces(place, allPlaces);
  const parts = [
    `${place.id} — area: ${place.region || "Leonida"}`,
    county ? `county: ${county}` : null,
    place.position
      ? `position: ${Math.round(place.position.x)}, ${Math.round(place.position.y)}`
      : "position: none",
    `enterable: ${place.tags.includes("enterable") ? "yes" : "not known"}`,
    tags.length > 0 ? `source tags: ${tags.join(", ")}` : "source tags: none",
    analogue
      ? `real-world analogue address: ${analogue}`
      : "real-world analogue: none given",
    nearby.length > 0
      ? `nearby named places: ${nearby.map((n) => `${n.title} (${Math.round(n.distance)} units)`).join("; ")}`
      : "nearby named places: none within 1,500 units",
    // Resolver v2: this place already failed every deterministic check
    // (same-spot coordinate match, guide-pin match, tag and analogue
    // rules) — what is above is all there is. The model must not
    // re-derive a type from position alone, and a low confidence is the
    // right answer when the evidence is thin.
    "deterministic check: no same-spot match, no guide-pin match, no tag or analogue rule fired",
  ];
  return parts.filter(Boolean).join(" · ");
}

export function buildCategorisationSystemPrompt(): string {
  return [
    "You categorise unnamed places on a GTA 6 map of Leonida. For each place, suggest ONLY what kind of place it is — a type, never a name.",
    "Rules:",
    "1. NEVER invent, guess, or suggest a proper name for a place. The name stays unknown. Reply with a category only.",
    '2. Use only the evidence given for that place: its source tags, its real-world analogue address (a Miami-area building of the same kind — e.g. an address naming "Apartments" or "Condominium" reads residential, a "Hotel" reads hotel/leisure), nearby named places, area and county, and whether it is enterable. If the evidence does not say, say so with a low confidence — do not guess from the map position alone.',
    '3. Reply with JSON only, exactly this shape: {"results":[{"id":"L123","category":"house","confidence":0.85,"reason":"one short line"}]}. Include every id you were given, in the same order.',
    `4. "category" must be exactly one of: ${AI_CATEGORIES.join(", ")}. Use "shop" with a "shopType" (one word, e.g. supermarket, clothes, pharmacy) when it is a shop; use "other" only when no other type fits.`,
    '5. "confidence" is 0 to 1. Below 0.6 means "not sure" — use it whenever the evidence is thin, the analogue address is empty, or two types fit equally well. A confident answer needs real evidence in the record, not a hunch.',
    '6. "reason" is one short line naming the evidence you used (e.g. "Analogue address is an apartment tower; tagged residential"). Never mention a name for the place.',
    '7. You are the last resort, not the first check: every place here already failed the deterministic checks (same-spot coordinate match, guide-pin match, tag and analogue rules). Do not re-derive a type from the map position alone — position without other evidence is "not sure".',
  ].join("\n");
}

export function buildCategorisationUserPrompt(
  contexts: readonly string[],
): string {
  return `Categorise each of these unnamed places (type only, never a name):\n${contexts
    .map((context, index) => `${index + 1}. ${context}`)
    .join("\n")}`;
}

export interface ParsedCategorisationResult {
  placeId: string;
  category: AiCategoryId;
  shopType?: string;
  confidence: number;
  reason: string;
  /** Where the type came from — 'ai' for an LLM batch reply, one of the
   * deterministic resolver steps otherwise. */
  source?: ResolutionSource;
  /** What the deterministic step matched, for the detail sheet. */
  matchedFrom?: string;
}

/**
 * Parse a batch reply. Only ids that were sent are accepted, only the
 * fixed categories, only finite confidences — anything else (including
 * any `name` field) is dropped, never stored.
 */
export function parseCategorisationResponse(
  text: string,
  expectedIds: readonly string[],
): ParsedCategorisationResult[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      "The AI reply was not valid JSON — nothing was saved from this batch.",
    );
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as { results?: unknown }).results)
  ) {
    throw new Error(
      "The AI reply had no results list — nothing was saved from this batch.",
    );
  }
  const expected = new Set(expectedIds);
  const results: ParsedCategorisationResult[] = [];
  const seen = new Set<string>();
  for (const entry of (parsed as { results: unknown[] }).results) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry as Record<string, unknown>;
    const placeId = candidate.id;
    if (
      typeof placeId !== "string" ||
      !expected.has(placeId) ||
      seen.has(placeId)
    )
      continue;
    const category = candidate.category;
    if (
      typeof category !== "string" ||
      !(AI_CATEGORIES as readonly string[]).includes(category)
    )
      continue;
    const confidence = candidate.confidence;
    if (typeof confidence !== "number" || !Number.isFinite(confidence))
      continue;
    const reason =
      typeof candidate.reason === "string"
        ? candidate.reason.trim().slice(0, 200)
        : "";
    const shopType =
      category === "shop" && typeof candidate.shopType === "string"
        ? candidate.shopType
            .trim()
            .toLowerCase()
            .replace(/[^a-z ]/g, "")
            .slice(0, 30) || undefined
        : undefined;
    seen.add(placeId);
    results.push({
      placeId,
      category: category as AiCategoryId,
      shopType,
      confidence: Math.min(1, Math.max(0, confidence)),
      reason: reason || "No reason given.",
    });
  }
  return results;
}

export interface CategoriseBatchInput {
  places: readonly Place[];
  allPlaces: readonly Place[];
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  /** Abort a batch the user stopped mid-flight — the request dies
   * with it instead of finishing and writing results afterwards. */
  signal?: AbortSignal;
  /** Bounded wait per batch — defaults to 60 seconds. */
  timeoutMs?: number;
}

/** One small batch to OpenAI. No key is ever bundled; the caller passes
 * the user's own key, stored on-device. */
export async function categoriseBatch(
  input: CategoriseBatchInput,
): Promise<ParsedCategorisationResult[]> {
  if (input.places.length === 0) return [];
  const model = input.model?.trim() || CATEGORISATION_MODEL;
  const timeoutMs = input.timeoutMs ?? 60_000;
  const contexts = input.places.map((place) =>
    buildPlaceContext(place, input.allPlaces),
  );
  // Bounded + abortable, like Ask: the timeout aborts the real fetch,
  // and the race unblocks the caller even if a fetch implementation
  // ignores the signal.
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal =
    input.signal === undefined
      ? timeoutController.signal
      : AbortSignal.any([input.signal, timeoutController.signal]);
  const fetchPromise = (input.fetchImpl ?? fetch)(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildCategorisationSystemPrompt() },
          { role: "user", content: buildCategorisationUserPrompt(contexts) },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      }),
      signal,
    },
  );
  const timeoutPromise = new Promise<never>((_, reject) => {
    const t = setTimeout(
      () =>
        reject(
          new Error(
            `Indexing batch timed out after ${Math.round(timeoutMs / 1000)} seconds — nothing from this batch was saved.`,
          ),
        ),
      timeoutMs,
    );
    fetchPromise.then(
      () => clearTimeout(t),
      () => clearTimeout(t),
    );
  });
  let response: Response;
  try {
    response = await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    clearTimeout(timer);
    if (timeoutController.signal.aborted && !(input.signal?.aborted ?? false)) {
      throw new Error(
        `Indexing batch timed out after ${Math.round(timeoutMs / 1000)} seconds — nothing from this batch was saved.`,
        { cause: error },
      );
    }
    throw error;
  }
  clearTimeout(timer);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `OpenAI request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content)
    throw new Error("OpenAI returned an empty answer for this batch.");
  // LLM results are always source 'ai' — the deterministic steps run
  // before this is ever called (see resolver.ts), so nothing here can
  // be mistaken for a data match.
  return parseCategorisationResponse(
    content,
    input.places.map((place) => place.id),
  ).map((result) => ({ ...result, source: "ai" as const }));
}
