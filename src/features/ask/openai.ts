import type { Place } from '../../domain/types';
import { normalizeAsk } from './retrieval';

/**
 * Ask Nylah — OpenAI client, BYOK.
 *
 * The key lives ONLY on this device, in localStorage, under the keys below.
 * It is never written to IndexedDB backups, never logged, never committed,
 * and is sent only to api.openai.com when the user asks a question. No key
 * is bundled with the app; without a key the panel still lists matching
 * places from the local map, it just cannot write an AI answer.
 */

export const ASK_API_KEY_STORAGE_KEY = 'leonida-ask-api-key';
export const ASK_MODEL_STORAGE_KEY = 'leonida-ask-model';
export const DEFAULT_ASK_MODEL = 'gpt-4o-mini';

export function getAskApiKey(): string {
  if (typeof window === 'undefined' || !window.localStorage) return '';
  try {
    return window.localStorage.getItem(ASK_API_KEY_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAskApiKey(value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (value.trim()) window.localStorage.setItem(ASK_API_KEY_STORAGE_KEY, value.trim());
    else window.localStorage.removeItem(ASK_API_KEY_STORAGE_KEY);
  } catch {
    // Storage unavailable — the panel surfaces this as a no-key state.
  }
}

export function getAskModel(): string {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_ASK_MODEL;
  try {
    return window.localStorage.getItem(ASK_MODEL_STORAGE_KEY) ?? DEFAULT_ASK_MODEL;
  } catch {
    return DEFAULT_ASK_MODEL;
  }
}

export function setAskModel(value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (value.trim()) window.localStorage.setItem(ASK_MODEL_STORAGE_KEY, value.trim());
    else window.localStorage.removeItem(ASK_MODEL_STORAGE_KEY);
  } catch {
    // Ignore — the default model is used instead.
  }
}

/**
 * The spoiler rule, as a system prompt. The model is only ever given the
 * records retrieval returned — layers the user asked for, layers already
 * visible, and their own markers. It must not name, hint at, or count
 * anything outside those records, and must not add bonus suggestions from
 * other kinds of places. A short, helpful finder answer, nothing more.
 */
export function buildAskSystemPrompt(requestedLayerNames: readonly string[]): string {
  const scope =
    requestedLayerNames.length > 0
      ? `The user asked about: ${requestedLayerNames.join(', ')}.`
      : 'The user did not ask for a specific kind of place.';
  return [
    'You are Ask Nylah, a helpful finder inside a GTA 6 map app. Answer ONLY from the map records supplied with the question.',
    scope,
    'Rules:',
    '1. Only name places that appear in the supplied records. Never invent a place, a position, a price, or a detail that is not in a record.',
    '2. Answer ONLY what was asked, scoped strictly to the kind of place asked for. Do NOT volunteer extras from other kinds of places — for example, never add that a building also holds collectible cards, watches, or other items unless the user asked about collectibles. No bonus suggestions, no cross-layer extras.',
    '3. If the supplied records do not answer the question, say so plainly: "not in the map data". Do not guess.',
    '4. Keep it short — a sentence or two, then the place names. Cite each place by its exact title.',
    '5. Never mention layers, toggles, or places that are not in the supplied records.',
  ].join('\n');
}

export function formatRecordsForPrompt(records: readonly Place[]): string {
  if (records.length === 0) return '(no records)';
  return records
    .map(
      (place) =>
        `- ${place.title} [${place.layerId}] — ${place.region || 'Leonida'}. ${place.description.slice(0, 240)}${place.position ? ` Position: ${place.position.x}, ${place.position.y}.` : ' No verified position.'}`,
    )
    .join('\n');
}

export interface AskOpenAiInput {
  question: string;
  records: readonly Place[];
  requestedLayerNames: readonly string[];
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export async function askOpenAi(input: AskOpenAiInput): Promise<string> {
  const model = input.model?.trim() || DEFAULT_ASK_MODEL;
  const response = await (input.fetchImpl ?? fetch)('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: buildAskSystemPrompt(input.requestedLayerNames) },
        {
          role: 'user',
          content: `Question: ${input.question}\n\nMap records you may use (and nothing else):\n${formatRecordsForPrompt(input.records)}`,
        },
      ],
      temperature: 0.2,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `OpenAI request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) throw new Error('OpenAI returned an empty answer.');
  return content;
}

/**
 * Places the AI actually cited, matched by title — only against records
 * that were sent to it. A mention of a place that was never sent (a leak or
 * a hallucination) can never become a highlight this way.
 */
export function parsePlaceMentions(answer: string, records: readonly Place[]): Place[] {
  const haystack = normalizeAsk(answer);
  const found: Array<{ index: number; place: Place }> = [];
  for (const place of records) {
    const base = normalizeAsk(place.title.split(' — ')[0] ?? place.title);
    if (base.length < 3) continue;
    const index = haystack.indexOf(base);
    if (index >= 0) found.push({ index, place });
  }
  return found.sort((a, b) => a.index - b.index).map((entry) => entry.place);
}
