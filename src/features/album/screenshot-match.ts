/**
 * Screenshot-match proposals (DESIGN-ADDENDUM §3.5, Demo F).
 *
 * Flow (normative — nothing is auto-applied, ever):
 *   upload a photo of a card front or of the in-game collection
 *   screen → one multimodal call under the player's own OpenAI key
 *   → PROPOSED completion updates → the user confirms per item (or
 *   one batch confirm for the ≥ 0.8 items) → each confirmed item
 *   writes a CompletionRecord with verb 'collected', source
 *   'screenshot', note "matched from screenshot <id>".
 *
 * The match call goes through the EXISTING Ask/OpenAI plumbing: the
 * key and model come from openai.ts (`getAskApiKey` / `getAskModel`,
 * the same localStorage keys Ask uses), the endpoint is the same
 * api.openai.com chat-completions endpoint Ask uses, and the timeout
 * is the same 30 s bound. No second client, no second key store.
 *
 * No key, no match — and no fake: with no key the executor returns
 * `{ ok: false, code: 'no-key' }` and the UI says so honestly. The
 * executor, not the model, enforces the proposal rules: a proposal
 * must resolve to an existing checklist item id (an unknown name is
 * dropped), a proposal for an already-collected item is dropped as
 * "already have it", confidence ≥ 0.8 is proposed for confirmation,
 * 0.5–0.8 is proposed as "possible match — check the name" and is
 * excluded from batch confirm, < 0.5 is not proposed at all, and a
 * batch is capped at 30 items.
 *
 * Screenshots stay device-local: the row + image bytes live in
 * IndexedDB (`userScreenshots` + `screenshotData`) and are never in
 * a backup (backup v4 already excludes them — nothing here adds a
 * backup section). The blob is sent nowhere except the single match
 * call, under the player's key.
 */
import { ASK_TIMEOUT_MS, getAskApiKey, getAskModel } from '../ask/openai';
import { DEFAULT_ASK_MODEL } from '../ask/model';
import type { CollectibleItem, GameDatabase } from '../../domain/game-db';
import type { UserScreenshot } from '../../domain/album';
import { atlasRepository, type AtlasDatabase } from '../../db/repository';
import { recordCompletion, type CompletionDeps } from '../completion/record';

export const SCREENSHOT_MATCH_MAX_BATCH = 30;
/** Confidence at/above which a proposal is offered for confirmation. */
export const SCREENSHOT_CONFIRM_THRESHOLD = 0.8;
/** Below this a candidate is not proposed at all. */
export const SCREENSHOT_MIN_THRESHOLD = 0.5;
/** A downscaled screenshot must fit the same 1.5 MB cap as place photos. */
export const SCREENSHOT_MAX_DATA_URL_LENGTH = 1_500_000;

export type ScreenshotKind = 'card-front' | 'collection-screen';

export interface ScreenshotMatchCandidate {
  /** The person name as printed on the card. */
  name: string;
  setName?: string;
  variant?: string;
  /** 0–1, how sure the model is the name is right. */
  confidence: number;
}

export interface ScreenshotProposal {
  itemId: string;
  confidence: number;
  /** 'confirm': ≥ 0.8, offered for confirmation (and batch confirm).
   *  'possible': 0.5–0.8, "check the name" — excluded from batch. */
  tier: 'confirm' | 'possible';
  reason: string;
  screenshotId: string;
  kind: ScreenshotKind;
}

export interface ScreenshotDropped {
  name: string;
  reason:
    | 'unknown-name'
    | 'ambiguous-name'
    | 'already-collected'
    | 'too-unsure'
    | 'over-batch-cap';
}

export type ScreenshotMatchResult =
  | {
      ok: true;
      proposals: ScreenshotProposal[];
      dropped: ScreenshotDropped[];
      model: string;
    }
  | {
      ok: false;
      code: 'no-key' | 'not-an-image' | 'match-failed' | 'unparseable';
      error: string;
    };

export interface MatchScreenshotInput {
  /** Downscaled JPEG data URL (place-photo.ts `downscalePhoto`). */
  dataUrl: string;
  kind: ScreenshotKind;
  /** The set the screenshot was attached to, when known — narrows
   *  name resolution (two sets can hold the same person). */
  setId?: string | null;
  /** The saved screenshot row id, when the UI saved first (the
   * normal flow — proposals are stamped with it, so a confirm links
   * the record to the screenshot). Minted when omitted. */
  screenshotId?: string;
  db: GameDatabase;
  /** Defaults to the stored Ask key. Pass '' explicitly to force the
   *  no-key path (tests do this — the sandbox has no key). */
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Resolve one model-named candidate to a checklist slot id. The
 * model cannot know ids, so the executor matches on the printed
 * name (+ set + variant when given) against the catalogue — an
 * unknown name resolves to nothing and is dropped, never guessed.
 * Returns the item, or null (no match / ambiguous — the caller
 * records which).
 */
export function resolveMatchCandidate(
  db: GameDatabase,
  candidate: ScreenshotMatchCandidate,
  setId?: string | null,
): { item: CollectibleItem } | { ambiguous: CollectibleItem[] } | null {
  const name = normalizeName(candidate.name);
  if (!name) return null;
  const setName = candidate.setName ? normalizeName(candidate.setName) : null;
  const variant = candidate.variant ? normalizeName(candidate.variant) : null;
  const slots = [...db.items.values()].filter((item) => item.checklistSlot);
  let matches = slots.filter((item) => normalizeName(item.name) === name);
  if (matches.length === 0) return null;
  if (setId) {
    const inSet = matches.filter((item) => item.setId === setId);
    if (inSet.length > 0) matches = inSet;
  } else if (setName) {
    const inSet = matches.filter((item) => {
      const set = item.setId ? db.sets.get(item.setId) : undefined;
      return set ? normalizeName(set.name) === setName : false;
    });
    if (inSet.length > 0) matches = inSet;
  }
  if (variant) {
    const withVariant = matches.filter(
      (item) => normalizeName(item.variant ?? '') === variant,
    );
    if (withVariant.length > 0) matches = withVariant;
  }
  if (matches.length === 1) return { item: matches[0]! };
  return { ambiguous: matches };
}

/** Pure proposal builder — the executor rules, testable without any
 * network. `candidates` are the model's raw matches, in its order. */
export function buildScreenshotProposals(
  db: GameDatabase,
  candidates: readonly ScreenshotMatchCandidate[],
  screenshotId: string,
  kind: ScreenshotKind,
  setId?: string | null,
): { proposals: ScreenshotProposal[]; dropped: ScreenshotDropped[] } {
  const proposals: ScreenshotProposal[] = [];
  const dropped: ScreenshotDropped[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const confidence = Number(candidate.confidence);
    if (!Number.isFinite(confidence) || confidence < SCREENSHOT_MIN_THRESHOLD) {
      dropped.push({ name: candidate.name, reason: 'too-unsure' });
      continue;
    }
    const resolved = resolveMatchCandidate(db, candidate, setId);
    if (resolved === null) {
      dropped.push({ name: candidate.name, reason: 'unknown-name' });
      continue;
    }
    if ('ambiguous' in resolved) {
      dropped.push({ name: candidate.name, reason: 'ambiguous-name' });
      continue;
    }
    const item = resolved.item;
    if (seen.has(item.id)) continue;
    if (db.completedItemIds.has(item.id)) {
      dropped.push({ name: candidate.name, reason: 'already-collected' });
      continue;
    }
    seen.add(item.id);
    if (proposals.length >= SCREENSHOT_MATCH_MAX_BATCH) {
      dropped.push({ name: candidate.name, reason: 'over-batch-cap' });
      continue;
    }
    proposals.push({
      itemId: item.id,
      confidence,
      tier: confidence >= SCREENSHOT_CONFIRM_THRESHOLD ? 'confirm' : 'possible',
      reason:
        confidence >= SCREENSHOT_CONFIRM_THRESHOLD
          ? `Matched "${item.name}"${item.variant ? ` (${item.variant})` : ''} on the screenshot.`
          : `Possible match for "${item.name}"${item.variant ? ` (${item.variant})` : ''} — check the name before confirming.`,
      screenshotId,
      kind,
    });
  }
  return { proposals, dropped };
}

function matchSystemPrompt(kind: ScreenshotKind): string {
  return [
    'You are matching a photo against a GTA 6 trading-card checklist. Return JSON only, no other text:',
    '{"matches":[{"name":"<person name as printed on the card>","set":"<set name if readable>","variant":"<Standard|Bronze|Silver|Gold if readable>","confidence":0.0-1.0}]}',
    kind === 'card-front'
      ? 'The photo shows ONE card front. Return that one card.'
      : 'The photo shows the in-game collection screen. Return EVERY card the screen shows as collected, and no card it shows as missing.',
    'Name the person exactly as printed. Confidence is how sure you are the name is right — below 0.5 means you cannot read it. Never invent a card you cannot read. If nothing is readable, return {"matches":[]}.',
  ].join('\n');
}

/** Pull the JSON object out of a chat reply (fenced or bare) and
 * validate its shape. A reply that is not shaped like the contract
 * is unparseable — never partially trusted. */
export function parseMatchReply(content: string): ScreenshotMatchCandidate[] | null {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const matches = (parsed as { matches?: unknown }).matches;
  if (!Array.isArray(matches)) return null;
  const candidates: ScreenshotMatchCandidate[] = [];
  for (const entry of matches) {
    if (typeof entry !== 'object' || entry === null) return null;
    const name = (entry as { name?: unknown }).name;
    const confidence = (entry as { confidence?: unknown }).confidence;
    if (typeof name !== 'string' || !name.trim()) return null;
    if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return null;
    candidates.push({
      name: name.trim(),
      setName:
        typeof (entry as { set?: unknown }).set === 'string'
          ? ((entry as { set: string }).set.trim() || undefined)
          : undefined,
      variant:
        typeof (entry as { variant?: unknown }).variant === 'string'
          ? ((entry as { variant: string }).variant.trim() || undefined)
          : undefined,
      confidence: Math.max(0, Math.min(1, confidence)),
    });
  }
  return candidates;
}

export async function matchScreenshot(
  input: MatchScreenshotInput,
): Promise<ScreenshotMatchResult> {
  const apiKey = input.apiKey !== undefined ? input.apiKey : getAskApiKey();
  if (!apiKey.trim()) {
    return {
      ok: false,
      code: 'no-key',
      error:
        'Matching needs your OpenAI key — add it in Settings, under Ask Nylah. Without it nothing can be matched, and no result will be invented.',
    };
  }
  if (!input.dataUrl.startsWith('data:image/')) {
    return { ok: false, code: 'not-an-image', error: 'That file is not an image.' };
  }
  const model = input.model?.trim() || getAskModel() || DEFAULT_ASK_MODEL;
  const timeoutMs = input.timeoutMs ?? ASK_TIMEOUT_MS;
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal =
    input.signal === undefined
      ? timeoutController.signal
      : AbortSignal.any([input.signal, timeoutController.signal]);
  let response: Response;
  try {
    const fetchPromise = (input.fetchImpl ?? fetch)(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: matchSystemPrompt(input.kind) },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text:
                    input.kind === 'card-front'
                      ? 'Match the card in this photo.'
                      : 'List the cards this collection screen shows as collected.',
                },
                { type: 'image_url', image_url: { url: input.dataUrl } },
              ],
            },
          ],
          temperature: 0.2,
        }),
        signal,
      },
    );
    const timeoutPromise = new Promise<never>((_, reject) => {
      const t = setTimeout(
        () => reject(new Error(`Screenshot match timed out after ${Math.round(timeoutMs / 1000)} seconds.`)),
        timeoutMs,
      );
      fetchPromise.then(
        () => clearTimeout(t),
        () => clearTimeout(t),
      );
    });
    response = await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    clearTimeout(timer);
    return {
      ok: false,
      code: 'match-failed',
      error:
        error instanceof Error
          ? `The match request failed: ${error.message} Nothing was marked found.`
          : 'The match request failed. Nothing was marked found.',
    };
  }
  clearTimeout(timer);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    return {
      ok: false,
      code: 'match-failed',
      error: `OpenAI request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}. Nothing was marked found.`,
    };
  }
  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    return { ok: false, code: 'unparseable', error: 'OpenAI returned an empty answer. Nothing was marked found.' };
  }
  const candidates = parseMatchReply(content);
  if (candidates === null) {
    return {
      ok: false,
      code: 'unparseable',
      error: 'The match reply was not in the expected shape, so nothing was proposed. The screenshot is saved — try again, or mark the card yourself.',
    };
  }
  const screenshotId = input.screenshotId ?? `shot:${crypto.randomUUID()}`;
  const { proposals, dropped } = buildScreenshotProposals(
    input.db,
    candidates,
    screenshotId,
    input.kind,
    input.setId,
  );
  return { ok: true, proposals, dropped, model };
}

export interface SaveScreenshotInput {
  dataUrl: string;
  kind: ScreenshotKind;
  setId?: string | null;
  itemId?: string | null;
  repository?: AtlasDatabase;
}

/**
 * Persist an uploaded screenshot on this device only (metadata row +
 * image bytes). The id is minted here; pass it as `screenshotId` to
 * `matchScreenshot` so proposals are stamped with the saved row.
 */
export async function saveScreenshot(
  input: SaveScreenshotInput,
): Promise<{ ok: true; screenshot: UserScreenshot } | { ok: false; error: string }> {
  if (!input.dataUrl.startsWith('data:image/')) {
    return { ok: false, error: 'That file is not an image.' };
  }
  if (input.dataUrl.length > SCREENSHOT_MAX_DATA_URL_LENGTH) {
    return { ok: false, error: 'That photo is too large to store on this device.' };
  }
  const repository = input.repository ?? atlasRepository;
  const screenshot: UserScreenshot = {
    id: `shot:${crypto.randomUUID()}`,
    at: new Date().toISOString(),
    kind: input.kind,
    setId: input.setId ?? null,
    itemId: input.itemId ?? null,
    blobId: '',
  };
  screenshot.blobId = screenshot.id;
  try {
    await repository.saveUserScreenshot(screenshot, input.dataUrl);
  } catch (error) {
    return {
      ok: false,
      error: `The photo could not be saved on this device (${error instanceof Error ? error.message : 'unknown error'}).`,
    };
  }
  return { ok: true, screenshot };
}

/** Point already-built proposals at the screenshot row the UI saved
 * (the match call runs before the save in the unsaved flow, so its
 * stamped id is a placeholder). */
export function restampProposals(
  proposals: readonly ScreenshotProposal[],
  screenshotId: string,
): ScreenshotProposal[] {
  return proposals.map((proposal) => ({ ...proposal, screenshotId }));
}

export interface ApplyProposalsInput {
  /** Only the proposals the user confirmed — dismissing, or leaving
   * a proposal unconfirmed, writes nothing. Pass [] and nothing is
   * written at all. */
  proposals: readonly ScreenshotProposal[];
  db: GameDatabase;
  deps?: CompletionDeps;
  repository?: AtlasDatabase;
}

export interface ApplyProposalsResult {
  applied: { itemId: string; name: string }[];
  skipped: { itemId: string; reason: string }[];
  errors: { itemId: string; error: string }[];
  /** The rebuilt database after the last write (or the input db when
   * nothing was written). */
  db: GameDatabase;
}

/**
 * Apply confirmed screenshot proposals: one `collected` record per
 * item, source 'screenshot', note "matched from screenshot <id>" —
 * the same one-write rule as every other completion, so the set, the
 * map pin, Progress and Ask all update from that record. A card-front
 * proposal also links the screenshot to the item, so the album can
 * show the player's own photo as that card's face. An already-
 * collected item is skipped, never double-written.
 */
export async function applyScreenshotProposals(
  input: ApplyProposalsInput,
): Promise<ApplyProposalsResult> {
  const repository = input.repository ?? atlasRepository;
  let db = input.db;
  const applied: ApplyProposalsResult['applied'] = [];
  const skipped: ApplyProposalsResult['skipped'] = [];
  const errors: ApplyProposalsResult['errors'] = [];
  for (const proposal of input.proposals) {
    const item = db.items.get(proposal.itemId);
    if (!item) {
      skipped.push({ itemId: proposal.itemId, reason: 'No such item exists — nothing was recorded.' });
      continue;
    }
    if (db.completedItemIds.has(proposal.itemId)) {
      skipped.push({ itemId: proposal.itemId, reason: 'Already collected — nothing was recorded.' });
      continue;
    }
    const result = await recordCompletion(
      {
        target: { type: 'item', id: proposal.itemId },
        verb: 'collected',
        source: 'screenshot',
        note: `matched from screenshot ${proposal.screenshotId}`,
      },
      input.deps ?? {},
    );
    if (!result.ok || !result.db) {
      errors.push({ itemId: proposal.itemId, error: result.error ?? 'Could not save that — try again.' });
      continue;
    }
    db = result.db;
    if (proposal.kind === 'card-front') {
      try {
        await repository.linkScreenshotToItem(proposal.screenshotId, proposal.itemId);
      } catch {
        // The completion record is the source of truth and it landed;
        // a failed photo link only means the card face stays empty.
      }
    }
    applied.push({ itemId: proposal.itemId, name: item.name });
  }
  return { applied, skipped, errors, db };
}
