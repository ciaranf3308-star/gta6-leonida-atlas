import { useEffect, useRef, useState } from 'react';
import { ChevronRight, KeyRound, Send, Sparkles, X } from 'lucide-react';
import type { Filters, LayerDefinition, Place } from '../../domain/types';
import type { GameDatabase } from '../../domain/game-db';
import { atlasRepository } from '../../db/repository';
import { useMapStore, useUiStore } from '../../stores/atlas';
import { useCompletionLogStore } from '../completion/log-store';
import { recordCompletion, recordSale } from '../completion/record';
import { retrieveForAsk, isPersonalProgressQuestion, normalizeAsk } from './retrieval';
import { executeGetHint, type ToolCall, type ToolResult } from './tools';
import {
  askOpenAi,
  getAskApiKey,
  getAskModel,
  sanitizeAiNote,
  setAskApiKey,
} from './openai';
import { askWithTools, hintItemForQuestion, type AskProposal } from './intent';
import { FindCardButton } from './FindCardButton';
import { useMatchStore } from './match-store';
import { buildAskCard, buildAskCards, askAnchorLabel, shortVerdict, type AskCard } from './cards';
import type { AiCategoryRecord } from '../categorise/categories';
import {
  PlaceIcon,
  iconKeyForAiRecord,
  iconKeyForPlace,
} from '../map/place-icons';

export interface AskPanelProps {
  places: Place[];
  layers: LayerDefinition[];
  filters: Filters;
  /** AI-suggested types for unnamed places (on-device only). */
  aiCategories: Readonly<Record<string, AiCategoryRecord>>;
  /** The user's own secondary tags (on-device only) — Ask answers
   * from them, and cards show them as "Your tag". */
  userTags: ReadonlyMap<string, readonly string[]>;
  visitedIds: string[];
  offline: boolean;
  onSelect: (id: string) => void;
  onClearHighlights: () => void;
  highlightIds: ReadonlySet<string>;
  onOpenSettings: () => void;
  /** Controlled by the bottom nav — Ask is one sheet, never stacked on
   * a place detail. Opening it closes the detail; picking a place
   * closes Ask. */
  open: boolean;
  onClose: () => void;
  /** One tap on a house-to-check: start a workout-spot marker there. */
  onMarkWorkout: (place: Place) => void;
  /** The gameplay database (step 7): the tools-first path runs
   *  against it when a key is saved. Without it Ask stays on the
   *  keyword finder, as before. */
  db?: GameDatabase | null;
}

/**
 * An Ask answer is CARDS, never a text wall (user, 2026-11-24: the old
 * presentation was "awful"). One assistant message is:
 *   - one short verdict line (the proximity verdict — never "near"
 *     when it is far),
 *   - at most two short AI sentences, only when a key is saved — the AI
 *     never lists places, the cards do that,
 *   - big place cards: blip roundel, name or "? · type", area/county,
 *     distance from the anchor, Enterable / Lootable / Breakable / Gym
 *     / Equipment badges — nearest first, one tap to fly to the place
 *     and open its sheet.
 *
 * STABILITY: a message is only ever appended whole, once its cards are
 * built — never half-loaded. While an answer is being fetched the panel
 * shows skeleton cards, not a partial answer. A stale answer (an
 * earlier request finishing after a newer one) is dropped by request
 * id. The anchor is shown on every answer, so a follow-up never loses
 * what it is about.
 *
 * MINIMAL CARDS (v0.14.0): the card face carries the blip, the name,
 * the area, the distance and the badges — nothing else. No "AI
 * suggested" line, no county line, no evidence paragraph on the card:
 * all of that lives behind one tap, in the place sheet.
 */
/** Progressive-hint state (v0.32 step-9, Demo G): the item a hint
 * answer is about and the level already shown, so the "Bigger
 * hint" button can call the next get_hint level. Level 0 means no
 * hint has been shown yet — the finder answered the question and
 * the button starts the ladder at level 1. */
export interface AskHintState {
  itemId: string;
  itemName: string;
  level: number;
  nextLevelAvailable: boolean;
  nextLevelBlockedReason?: string;
}

interface AskMessage {
  role: 'user' | 'assistant';
  text: string;
  /** At most two short AI sentences, only when a key is saved — never a
   * place list, never a repeat of the verdict. */
  aiNote?: string;
  /** Cards for this answer, nearest first (assistant only). */
  cards: AskCard[];
  /** Matching places in total — the rest are highlighted on the map. */
  totalInScope: number;
  /** The anchor the distances are measured from ("Near Capri"). */
  anchorLabel: string | null;
  /** When the AI answer failed: the local map results still stand,
   * labelled honestly — never a silent AI answer, never a fake one. */
  aiFailed?: string;
  /** Houses in the asked area worth checking for workout equipment —
   * candidates, never verified equipment. 'equipment' when equipment was
   * asked for, 'gym' when a member gym was. */
  houses?: { placeIds: string[]; areaName: string; total: number; kind: 'equipment' | 'gym' };
  /** The systemic rule for a breakable question, one line under the
   * verdict (from retrieval ruleNote). */
  ruleNote?: string | null;
  /** Confirm cards (step 7, tools-first answers only): proposals from
   *  update_completion / record_sale. Never writes — the player
   *  confirms, one tap, through the same step-2 recordCompletion /
   *  recordSale path, source 'ask'. */
  proposals?: AskProposal[];
  /** Progressive-hint state (Demo G) — see AskHintState above. */
  hint?: AskHintState;
}

/** The hint state behind a tools answer: the get_hint call (if any)
 * and its result. The level shown and whether a bigger hint exists
 * come from the tool, never from the narration text. */
function hintStateFromTools(
  db: GameDatabase,
  toolCalls: readonly ToolCall[],
  results: readonly ToolResult<unknown>[],
): AskHintState | undefined {
  const index = toolCalls.findIndex((call) => call.name === 'get_hint');
  if (index < 0) return undefined;
  const call = toolCalls[index]!;
  const result = results[index];
  const targetId =
    typeof call.args['targetId'] === 'string' ? call.args['targetId'] : null;
  if (!targetId || !result?.ok) return undefined;
  const data = result.data as {
    level?: unknown;
    nextLevelAvailable?: unknown;
    nextLevelBlockedReason?: unknown;
  };
  if (typeof data.level !== 'number') return undefined;
  const item = db.items.get(targetId);
  return {
    itemId: targetId,
    itemName: item?.name ?? targetId,
    level: data.level,
    nextLevelAvailable: data.nextLevelAvailable === true,
    nextLevelBlockedReason:
      typeof data.nextLevelBlockedReason === 'string'
        ? data.nextLevelBlockedReason
        : undefined,
  };
}

const SUGGESTED_PROMPTS = [
  "I'm up north beside Mount Kalaga, need to hit some gains — any ideas?",
  'Thinking of hitting some burglaries in Capri — highlight all the houses I can hit tonight.',
  'Where is the nearest gym to Vice City?',
];

export default function AskPanel(props: AskPanelProps) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyNote, setBusyNote] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(() => getAskApiKey().length > 0);
  /** Confirm cards handled this session (by proposal key) — a
   *  confirmed card flips to "Confirmed ✓" and never re-writes. */
  const [handledProposals, setHandledProposals] = useState<ReadonlySet<string>>(new Set());
  const [proposalBusy, setProposalBusy] = useState<string | null>(null);
  const [proposalError, setProposalError] = useState('');
  /** Unpositioned finds whose jot was armed after confirming. */
  const [jotArmed, setJotArmed] = useState<ReadonlySet<string>>(new Set());
  const messagesRef = useRef<HTMLDivElement>(null);
  /** Monotonic submit id — a stale answer never lands after a newer one. */
  const requestRef = useRef(0);
  /** The in-flight AI request, so Cancel / close / unmount actually
   * abort it instead of letting it run on and land late. */
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);
  // Closing the sheet abandons the question — the request stops with it.
  useEffect(() => {
    if (!props.open) abortRef.current?.abort();
  }, [props.open]);
  // The key can be added in Settings while this sheet stays mounted
  // behind the dialog — re-read it every time the sheet opens, or the
  // "Add your OpenAI key" prompts keep showing after the key is saved
  // (reported 2026-11-25: key added in Settings, Ask still said no key).
  useEffect(() => {
    if (props.open) setHasKey(getAskApiKey().length > 0);
  }, [props.open]);

  /** Cancel the running question: abort the network call, drop any
   * late result, and stop the spinner. Nothing is appended. */
  function cancelCurrent() {
    abortRef.current?.abort();
    requestRef.current++;
    abortRef.current = null;
    setBusy(false);
    setBusyNote(null);
  }

  function proposalKey(proposal: AskProposal): string {
    return proposal.kind === 'completion'
      ? `completion:${proposal.targetType}:${proposal.targetId}`
      : `sale:${proposal.itemId}`;
  }

  /** One tap on a confirm card: the proposal becomes a real write
   *  through the same step-2 path the journal uses, source 'ask'.
   *  A proposal never writes on its own — this tap is the write. */
  async function confirmProposal(proposal: AskProposal) {
    const key = proposalKey(proposal);
    if (proposalBusy || handledProposals.has(key)) return;
    setProposalBusy(key);
    setProposalError('');
    if (proposal.kind === 'completion') {
      const result = await recordCompletion({
        target: { type: proposal.targetType, id: proposal.targetId },
        verb: proposal.verb,
        count: proposal.count,
        source: 'ask',
        note: proposal.note,
      });
      if (result.ok && result.db) {
        useCompletionLogStore.getState().applyDb(result.db);
        setHandledProposals((prev) => new Set([...prev, key]));
      } else {
        setProposalError(result.error ?? 'Could not save that — try again.');
      }
    } else {
      const result = await recordSale({ itemId: proposal.itemId, price: proposal.price });
      if (result.ok) {
        await useCompletionLogStore.getState().refresh();
        setHandledProposals((prev) => new Set([...prev, key]));
      } else {
        setProposalError(result.error ?? 'Could not save that sale — try again.');
      }
    }
    setProposalBusy(null);
  }

  /** The jot follow-up (§7.2): after confirming an unpositioned
   *  find, the player marks where it was found. Arms the slot and
   *  opens the marker editor on the map — the next marker saved
   *  becomes the pin for it. */
  function offerJot(proposal: Extract<AskProposal, { kind: 'completion' }>) {
    if (proposal.targetType !== 'item') return;
    useMatchStore.getState().armJot(proposal.targetId);
    setJotArmed((prev) => new Set([...prev, proposal.targetId]));
    props.onClose();
    props.onClearHighlights();
    useUiStore.getState().setNavTab('map');
    useMapStore.getState().setMarkerKindPreset(null);
    useMapStore.getState().setEditor('create');
    useUiStore.getState().setEditorOpen(true);
  }
  // The latest answer must be in view — scrolled to its TOP, so the
  // verdict and the first cards show, not the tail of the list. (The
  // old scroll-to-bottom landed on the houses list at the end of a
  // long answer, hiding the cards the answer is about.)
  useEffect(() => {
    const el = messagesRef.current;
    const last = el?.lastElementChild as HTMLElement | null;
    if (el && last) el.scrollTop = last.offsetTop - el.offsetTop;
  }, [messages, busy]);

  function saveKey() {
    if (!keyInput.trim()) return;
    setAskApiKey(keyInput.trim());
    setKeyInput('');
    setHasKey(true);
  }

  const placeById = new Map(props.places.map((place) => [place.id, place]));
  const layerColor = (layerId: string) =>
    props.layers.find((layer) => layer.id === layerId)?.style.color ?? '#e8823a';

  /** Houses to check ride on the answer message — never sent to the AI,
   * never presented as verified gyms. */
  function housesFor(result: {
    housesToCheck: Place[];
    housesToCheckTotal: number;
    housesAreaName: string | null;
    housesKind: 'equipment' | 'gym' | null;
  }): AskMessage['houses'] {
    if (result.housesToCheck.length === 0 || !result.housesAreaName || !result.housesKind)
      return undefined;
    return {
      placeIds: result.housesToCheck.map((place) => place.id),
      areaName: result.housesAreaName,
      total: result.housesToCheckTotal,
      kind: result.housesKind,
    };
  }

  /** Show the answer on the map: highlight the places and pan to them. */
  function showOnMap(highlight: Place[]) {
    useMapStore.getState().setHighlights(highlight.map((place) => place.id));
    const positioned = highlight.filter(
      (place): place is Place & { position: NonNullable<Place['position']> } =>
        place.position !== null,
    );
    if (positioned.length === 0) return;
    const xs = positioned.map((place) => place.position.x);
    const ys = positioned.map((place) => place.position.y);
    const padX = Math.max((Math.max(...xs) - Math.min(...xs)) * 0.15, 400);
    const padY = Math.max((Math.max(...ys) - Math.min(...ys)) * 0.15, 400);
    useMapStore.getState().setBoundsFocus({
      west: Math.min(...xs) - padX,
      east: Math.max(...xs) + padX,
      south: Math.min(...ys) - padY,
      north: Math.max(...ys) + padY,
    });
  }

  /** One tap on a card: highlight just that place, fly to it, open its sheet. */
  function openCard(placeId: string) {
    const place = placeById.get(placeId);
    if (!place) return;
    useMapStore.getState().setHighlights([placeId]);
    props.onSelect(placeId);
  }

  /** The checklist item behind a card answer, if the card is an
   *  unpositioned, unfound card — the Find-this-card button's input. */
  function itemForCard(placeId: string) {
    const db = props.db ?? null;
    if (!db) return null;
    const candidates = [
      [...db.items.values()].find((item) => item.locationId === placeId),
      db.items.get(placeId),
    ];
    for (const item of candidates) {
      if (
        item &&
        item.checklistSlot &&
        item.placement !== 'pinned' &&
        !db.completedItemIds.has(item.id)
      ) {
        return item;
      }
    }
    return null;
  }

  function appendAssistant(message: Omit<AskMessage, 'role'>, requestId: number) {
    if (requestId !== requestRef.current) return;
    setMessages((prev) => [...prev, { ...message, role: 'assistant' }]);
  }

  /** "Bigger hint" (v0.32 step-9, Demo G): call the next get_hint
   * level for the item the last hint was about. The tool is
   * deterministic — no LLM round trip — but the ladder runs
   * through the tools path, so without a key there is nothing to
   * call: the honest refusal, never a faked hint. A failed call
   * (already collected, no spot published) surfaces the tool's own
   * honest error as the answer. Level 3 names the host building,
   * so the map focuses on it (highlight + pan, never opening the
   * sheet — the hint stays on screen). */
  async function escalateHint(hint: AskHintState, requestId: number) {
    const db = props.db ?? null;
    if (!db) {
      appendAssistant(
        {
          text: 'Hints need the map database — it is still loading. Try again in a moment.',
          cards: [],
          totalInScope: 0,
          anchorLabel: null,
        },
        requestId,
      );
      return;
    }
    if (!getAskApiKey()) {
      appendAssistant(
        {
          text: `A bigger hint for ${hint.itemName} needs your OpenAI key — the hint ladder runs through the tools path, and without a key there is nothing to call. I won't make one up. Add your key in Settings and ask again.`,
          cards: [],
          totalInScope: 0,
          anchorLabel: null,
        },
        requestId,
      );
      return;
    }
    const nextLevel = hint.level + 1;
    const result = executeGetHint(db, {
      level: nextLevel,
      targetType: 'item',
      targetId: hint.itemId,
    });
    if (!result.ok) {
      appendAssistant(
        {
          text: result.error,
          cards: [],
          totalInScope: 0,
          anchorLabel: null,
        },
        requestId,
      );
      return;
    }
    const data = result.data;
    if (data.level === 3) {
      const item = db.items.get(hint.itemId);
      const host = item?.locationId ? placeById.get(item.locationId) : undefined;
      if (host) showOnMap([host]);
    }
    appendAssistant(
      {
        text: `Hint ${data.level} of 4 — ${data.hint}`,
        cards: [],
        totalInScope: 0,
        anchorLabel: null,
        hint: {
          itemId: hint.itemId,
          itemName: hint.itemName,
          level: data.level,
          nextLevelAvailable: data.nextLevelAvailable,
          nextLevelBlockedReason: data.nextLevelBlockedReason,
        },
      },
      requestId,
    );
  }

  /** The button's tap: one escalation, one request id, spinner
   * while it runs. */
  async function biggerHint(hint: AskHintState) {
    if (busy) return;
    const requestId = ++requestRef.current;
    setBusy(true);
    setBusyNote('Getting a bigger hint…');
    try {
      await escalateHint(hint, requestId);
    } finally {
      if (requestId === requestRef.current) {
        setBusy(false);
        setBusyNote(null);
      }
    }
  }

  async function submit(questionText: string) {
    const question = questionText.trim();
    if (!question || busy) return;
    const requestId = ++requestRef.current;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question, cards: [], totalInScope: 0, anchorLabel: null }]);
    setBusy(true);
    setBusyNote('Finding places…');
    // The local answer is built inside the try but must survive into
    // the catch: an AI failure falls back to it (verdict + cards +
    // map highlights, labelled local-only), so these live outside
    // the try block.
    let result: ReturnType<typeof retrieveForAsk> | undefined;
    let cards: ReturnType<typeof buildAskCards> | undefined;
    let verdict: string | undefined;
    let anchorLabel: string | null | undefined;
    try {
      // A typed "Bigger hint" follow-up escalates the last hint
      // shown, exactly like the button (Demo G asked it by typing).
      const lastHint = [...messages]
        .reverse()
        .find((message) => message.role === 'assistant' && message.hint)?.hint;
      if (normalizeAsk(question).includes('bigger hint') && lastHint?.nextLevelAvailable) {
        await escalateHint(lastHint, requestId);
        return;
      }
      const apiKeyEarly = getAskApiKey();
      // No key, personal-progress question (v0.32 step-9, Demo D
      // step 3): refuse honestly INSTEAD of running the finder.
      // The finder answers from the map only — it never consults
      // the completion log, so it can state the opposite of the
      // truth ("no place near Lummox County" when Redshaw's there
      // WAS explored). The tools path answers these, and it needs
      // a key. No cards, no map highlights, no proximity verdict.
      if (!apiKeyEarly && isPersonalProgressQuestion(question)) {
        appendAssistant(
          {
            text: "I can't check that without your OpenAI key — questions about what you've found, looted or explored need the tools path, and the local finder can only list what's on the map. It can't tell what you've done, and guessing would get it wrong. Add your key in Settings and ask again.",
            cards: [],
            totalInScope: 0,
            anchorLabel: null,
          },
          requestId,
        );
        return;
      }
      result = retrieveForAsk({
        question,
        places: props.places,
        layers: props.layers,
        filters: props.filters,
        aiCategories: props.aiCategories,
        userTags: props.userTags,
        visitedIds: props.visitedIds,
        // Follow-ups ("is there nowhere else?") inherit the place from the
        // earlier question in this conversation — the layers asked for
        // still come from this question alone.
        priorQuestions: messages
          .filter((message) => message.role === 'user')
          .map((message) => message.text),
      });
      anchorLabel = askAnchorLabel(result);
      cards = buildAskCards(result, props.places, props.aiCategories, props.userTags);
      // The hint ladder's starting point (Demo G): a hint question
      // that names one item by name carries that item, level 0 — no
      // hint shown yet — so the "Bigger hint" button can start the
      // ladder. Without a key the button says so honestly; with a
      // key the tools path above already answered.
      const dbForHint = props.db ?? null;
      const hintItem = dbForHint ? hintItemForQuestion(question, dbForHint) : null;
      const finderHint: AskHintState | undefined = hintItem
        ? {
            itemId: hintItem.id,
            itemName: hintItem.name,
            level: 0,
            nextLevelAvailable: true,
          }
        : undefined;
      setBusyNote(
        anchorLabel
          ? `Finding places ${anchorLabel.toLowerCase()}…`
          : 'Finding places…',
      );
      const apiKey = getAskApiKey();
      // The key may have been added in Settings since this sheet
      // mounted (hasKey is captured at mount) — refresh it from the
      // same fresh read, or the "add your key" prompts stay up after
      // a keyed question runs.
      setHasKey(apiKey.length > 0);
      const db = props.db ?? null;
      // Step 7, tools-first (DESIGN §7.2/§7.3): with a key and the
      // database, the structured tools answer first — the router maps
      // the question to tool calls, the tools answer from the live
      // database, the narration is sanitized. A 'no_tool' or 'error'
      // result falls through to the keyword finder below, so the
      // local answer still stands when the tools cannot map the
      // question.
      if (db && apiKey) {
        const toolsResult = await (async () => {
          const controller = new AbortController();
          abortRef.current = controller;
          try {
            return await askWithTools({
              question,
              db,
              apiKey,
              model: getAskModel(),
              signal: controller.signal,
              // Nightlife evidence for the tools path (DESIGN §7.4
              // case 3): the same maps the local finder reads, keyed
              // by Place id — GameLocation.id IS the Place id.
              userTags: props.userTags,
              aiCategories: props.aiCategories,
              researchDeps: {
                queueResearch: async (request) => {
                  try {
                    await atlasRepository.researchRequests.put(request);
                    return true;
                  } catch {
                    return false;
                  }
                },
              },
            });
          } finally {
            if (abortRef.current === controller) abortRef.current = null;
          }
        })();
        if (toolsResult.kind === 'tools') {
          const revealPlaces = toolsResult.revealIds
            .map((id) => placeById.get(id))
            .filter((place): place is Place => place !== undefined);
          const toolCards = revealPlaces.map((place) =>
            buildAskCard(place, null, props.aiCategories, props.userTags),
          );
          showOnMap(revealPlaces);
          if (toolsResult.focus?.bounds) {
            useMapStore.getState().setBoundsFocus(toolsResult.focus.bounds);
          } else if (toolsResult.focus?.locationId) {
            openCard(toolsResult.focus.locationId);
          }
          appendAssistant(
            {
              text: toolsResult.narration,
              cards: toolCards,
              totalInScope: revealPlaces.length,
              anchorLabel,
              proposals: toolsResult.proposals,
              hint: hintStateFromTools(db, toolsResult.toolCalls, toolsResult.results),
            },
            requestId,
          );
          return;
        }
      }
      if (result.records.length === 0) {
        const scope = result.requestedLayerNames.length
          ? ` for ${result.requestedLayerNames.join(', ')}`
          : '';
        const houses = housesFor(result);
        appendAssistant(
          {
            text: houses
              ? houses.kind === 'equipment'
                ? `No verified workout equipment in ${houses.areaName} — the houses below are worth checking instead.`
                : `No verified gym in ${houses.areaName} — the houses below are worth checking instead.`
              : // The honest empty answer (v0.32 gang-op follow-up,
                // lane 2): when retrieval computed emptyAdvice, the
                // record asked about is area-known, or the kind
                // asked for has no layer yet — the advice says the
                // area instead of pointing at a layer that does not
                // exist. Otherwise the existing line, which names
                // only layers that exist.
                result.emptyAdvice ??
                (result.areaMismatch
                  ? `Nothing${scope} in that area in the map data — the nearest matching places are shown below instead.`
                  : `Nothing${scope} in the map data for that. I won't guess — try turning a layer on, or drop your own marker when you find one.`),
            cards: [],
            totalInScope: 0,
            anchorLabel,
            houses,
            hint: finderHint,
          },
          requestId,
        );
        props.onClearHighlights();
        return;
      }
      // The verdict leads, in one or two lines — the cards carry the
      // places, and the houses section carries the house-gym gap.
      verdict =
        shortVerdict(result.proximitySummary) ??
        `Here are the matching places from the map (${result.records.length} shown${result.totalInScope > result.records.length ? ` of ${result.totalInScope}` : ''}${result.areaMismatch ? ' — nothing in that exact area, so these are the nearest' : ''}).`;
      if (!apiKey) {
        // No key: still a useful finder — the local records, no AI text.
        // The proximity verdict leads: never present far-away places as near.
        showOnMap(result.records);
        appendAssistant(
          {
            text: verdict,
            cards: cards.cards,
            totalInScope: cards.total,
            anchorLabel,
            houses: housesFor(result),
            ruleNote: result.ruleNote,
            hint: finderHint,
          },
          requestId,
        );
        return;
      }
      // Local answer, built first: the verdict, the cards and the
      // houses are all deterministic, from retrieval — they stand
      // whether or not the AI answers. The AI only ever adds at most
      // two short sentences under them, checked before they are shown.
      const localAnswer: Omit<AskMessage, 'role'> = {
        text: verdict,
        cards: cards.cards,
        totalInScope: cards.total,
        anchorLabel,
        houses: housesFor(result),
        ruleNote: result.ruleNote,
        hint: finderHint,
      };
      const answer = await (async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          return await askOpenAi({
            question,
            records: result.records,
            requestedLayerNames: result.requestedLayerNames,
            apiKey,
            model: getAskModel(),
            proximitySummary: result.proximitySummary,
            anchorName: result.anchorPlace?.title ?? result.areaLabel,
            distances: result.anchorDistances,
            aiCategories: props.aiCategories,
            signal: controller.signal,
          });
        } finally {
          if (abortRef.current === controller) abortRef.current = null;
        }
      })();
      // Retrieval ran before the await, so this is unreachable in
      // practice — it only re-narrows `result` for the type checker
      // (an await resets narrowing on a `let`).
      if (result === undefined || verdict === undefined || cards === undefined) return;
      showOnMap(result.records);
      appendAssistant(
        {
          ...localAnswer,
          // Deterministic check on the free text (v0.30.0): a
          // sentence naming a place that was never sent, or
          // volunteering an extra from an unasked layer, is dropped
          // before it is shown. If nothing survives, no AI note.
          aiNote:
            sanitizeAiNote(
              answer,
              result.records,
              props.places,
              result.requestedLayerIds,
              result.anchorPlace?.title ?? result.areaLabel,
            ) || undefined,
        },
        requestId,
      );
    } catch (error) {
      // A cancelled question appends nothing — the user stopped it.
      if (
        (error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        return;
      }
      // AI failure is NOT a dead end: the local finder already found
      // the places, so the answer still lands — verdict, cards, map
      // highlights — labelled honestly as local-only. Never a silent
      // AI answer, never a fake one, never an error with zero cards
      // when records exist.
      if (result !== undefined && result.records.length > 0 && verdict !== undefined && cards !== undefined) {
        showOnMap(result.records);
        appendAssistant(
          {
            text: verdict,
            cards: cards.cards,
            totalInScope: cards.total,
            anchorLabel: anchorLabel ?? null,
            houses: housesFor(result),
            ruleNote: result.ruleNote,
            aiFailed:
              error instanceof Error
                ? error.message
                : 'The AI answer failed.',
          },
          requestId,
        );
        return;
      }
      appendAssistant(
        {
          text:
            error instanceof Error
              ? error.message
              : 'Ask failed. Your map and markers are untouched.',
          cards: [],
          totalInScope: 0,
          anchorLabel: null,
        },
        requestId,
      );
    } finally {
      if (requestId === requestRef.current) {
        setBusy(false);
        setBusyNote(null);
      }
    }
  }

  if (!props.open) return null;

  return (
    <section className="ask-panel" aria-label="Ask Nylah">
      <div className="ask-panel-header">
        <span>
          <Sparkles size={16} /> Ask Nylah
        </span>
        <small>Answers only from this map — nothing it was not asked for.</small>
        <button
          type="button"
          className="icon-button"
          aria-label="Close Ask Nylah"
          onClick={() => {
            props.onClose();
            props.onClearHighlights();
          }}
        >
          <X size={18} />
        </button>
      </div>
      {props.highlightIds.size > 0 && (
        <button type="button" className="text-button ask-clear" onClick={props.onClearHighlights}>
          Clear highlights ({props.highlightIds.size})
        </button>
      )}
      <div className="ask-messages" ref={messagesRef}>
        {messages.length === 0 && (
          <p className="help-text">
            Roleplay help, grounded in the map. Ask for a gym, a shop, a place to hit — asking
            for it shows that kind of place, even if its layer is off. It will never volunteer
            other things you did not ask for.
          </p>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`ask-message is-${message.role}`}>
            {message.role === 'assistant' && message.anchorLabel && (
              <p className="ask-anchor" aria-label="Anchor for this answer">
                {message.anchorLabel}
              </p>
            )}
            <p className={message.role === 'assistant' ? 'ask-summary' : undefined}>
              {message.text}
            </p>
            {message.role === 'assistant' && message.aiNote && (
              <p className="ask-ai-note">{message.aiNote}</p>
            )}
            {message.role === 'assistant' && message.aiFailed && (
              <p className="help-text">
                AI answer unavailable — showing local map results only.{' '}
                {message.aiFailed}
              </p>
            )}
            {message.role === 'assistant' && message.ruleNote && (
              <p className="ask-rule-note">{message.ruleNote}</p>
            )}
            {message.role === 'assistant' && message.hint && (
              message.hint.nextLevelAvailable ? (
                <button
                  type="button"
                  className="button ask-bigger-hint"
                  disabled={busy}
                  onClick={() => void biggerHint(message.hint!)}
                >
                  Bigger hint
                </button>
              ) : (
                <p className="help-text">
                  {message.hint.nextLevelBlockedReason ??
                    "That's everything the map knows about this one — there is no bigger hint."}
                </p>
              )
            )}
            {message.cards.length > 0 && (
              <ul className="ask-cards">
                {message.cards.map((card) => {
                  const place = placeById.get(card.placeId);
                  if (!place) return null;
                  const item = itemForCard(card.placeId);
                  return (
                  <li key={card.placeId}>
                    <button
                      type="button"
                      className="place-result ask-card"
                      onClick={() => openCard(card.placeId)}
                    >
                      <span
                        className="result-icon"
                        style={{ background: layerColor(card.layerId) }}
                        aria-hidden="true"
                      >
                        <PlaceIcon
                          icon={
                            iconKeyForAiRecord(props.aiCategories[card.placeId]) ??
                            iconKeyForPlace(place)
                          }
                          size={19}
                        />
                      </span>
                      <span>
                        <strong>{card.title}</strong>
                        <small>
                          {card.area}
                        </small>
                        <small className="ask-card-distance">
                          {card.near ? 'Close by · ' : ''}
                          {card.distanceLabel}
                        </small>
                        {card.userTags.length > 0 && (
                          <small className="ask-card-user-tags">
                            Your tag: {card.userTags.join(', ')}
                          </small>
                        )}
                        {card.badges.length > 0 && (
                          <span className="result-badges">
                            {card.badges.map((badge) => (
                              <span key={badge}>{badge}</span>
                            ))}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                    {item && props.db ? <FindCardButton item={item} db={props.db} /> : null}
                  </li>
                  );
                })}
              </ul>
            )}
            {message.role === 'assistant' &&
              message.totalInScope > message.cards.length &&
              message.cards.length > 0 && (
                <p className="help-text">
                  {message.totalInScope - message.cards.length} more matching{' '}
                  {message.totalInScope - message.cards.length === 1 ? 'place' : 'places'}{' '}
                  highlighted on the map.
                </p>
              )}
            {message.role === 'assistant' && message.proposals && message.proposals.length > 0 && (
              <ul className="ask-proposals">
                {message.proposals.map((proposal) => {
                  const key = proposalKey(proposal);
                  const handled = handledProposals.has(key);
                  const isCompletion = proposal.kind === 'completion';
                  return (
                    <li key={key} className="ask-proposal">
                      <span>{proposal.confirmLabel}</span>
                      {handled ? (
                        <span role="status">Confirmed ✓</span>
                      ) : (
                        <button
                          type="button"
                          className="button"
                          disabled={proposalBusy === key}
                          onClick={() => void confirmProposal(proposal)}
                        >
                          Confirm
                        </button>
                      )}
                      {handled && isCompletion && proposal.jotOffer && proposal.targetType === 'item' && !jotArmed.has(proposal.targetId) && (
                        <span className="ask-jot-offer">
                          <span>{proposal.jotOffer}</span>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => offerJot(proposal)}
                          >
                            Mark where you found it
                          </button>
                        </span>
                      )}
                      {handled && isCompletion && proposal.jotOffer && proposal.targetType === 'item' && jotArmed.has(proposal.targetId) && (
                        <span role="status">
                          Marker armed — tap the map to place it, and it becomes this card’s pin.
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {message.role === 'assistant' && proposalError && (
              <p className="completion-error" role="alert">
                {proposalError}{' '}
                <button
                  type="button"
                  className="completion-error-dismiss"
                  onClick={() => setProposalError('')}
                >
                  Dismiss
                </button>
              </p>
            )}
            {message.houses && message.houses.placeIds.length > 0 && (
              <div className="ask-houses">
                <strong>
                  Houses in {message.houses.areaName} to check
                  {message.houses.total > message.houses.placeIds.length
                    ? ` (${message.houses.placeIds.length} of ${message.houses.total} shown)`
                    : ` (${message.houses.total})`}
                </strong>
                {message.houses.kind === 'equipment' ? (
                  <p>
                    No verified workout equipment here — check these houses
                    instead. Not verified equipment: if you find gear in
                    one, mark it and Ask will use it next time.
                  </p>
                ) : (
                  <p>
                    No verified gym here — check these houses instead. Not
                    verified gyms: if you find equipment in one, mark it
                    and Ask will use it next time.
                  </p>
                )}
                <ul className="ask-cards">
                  {message.houses.placeIds.map((id) => {
                    const place = placeById.get(id);
                    if (!place) return null;
                    const card = buildAskCard(
                      place,
                      null,
                      props.aiCategories,
                      props.userTags,
                    );
                    return (
                      <li key={id} className="ask-house-card">
                        <button
                          type="button"
                          className="place-result ask-card"
                          onClick={() => openCard(id)}
                        >
                          <span
                            className="result-icon"
                            style={{ background: layerColor(card.layerId) }}
                            aria-hidden="true"
                          >
                            <PlaceIcon
                              icon={
                                iconKeyForAiRecord(props.aiCategories[id]) ??
                                iconKeyForPlace(place)
                              }
                              size={19}
                            />
                          </span>
                          <span>
                            <strong>{card.title}</strong>
                            <small>
                              {card.area}
                            </small>
                            {card.badges.length > 0 && (
                              <span className="result-badges">
                                {card.badges.map((badge) => (
                                  <span key={badge}>{badge}</span>
                                ))}
                              </span>
                            )}
                          </span>
                          <ChevronRight size={16} />
                        </button>
                        <button
                          type="button"
                          className="button ask-house-mark"
                          onClick={() => props.onMarkWorkout(place)}
                        >
                          {message.houses?.kind === 'equipment'
                            ? 'Workout equipment in the garage — mark it'
                            : 'Mark as workout spot'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {message.role === 'assistant' && message.cards.length === 0 && !message.houses && !hasKey && (
              <button type="button" className="text-button" onClick={props.onOpenSettings}>
                Add your OpenAI key in Settings
              </button>
            )}
          </div>
        ))}
        {busy && (
          <div className="ask-loading" role="status">
            <p className="help-text">{busyNote ?? 'Finding places…'}</p>
            <button type="button" className="text-button" onClick={cancelCurrent}>
              Cancel
            </button>
            <div className="ask-card-skeleton" aria-hidden="true" />
            <div className="ask-card-skeleton" aria-hidden="true" />
            <div className="ask-card-skeleton" aria-hidden="true" />
          </div>
        )}
      </div>
      {messages.length === 0 && (
        <div className="ask-suggestions">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy || props.offline}
              onClick={() => void submit(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
      )}
      <form
        className="ask-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(input);
        }}
      >
        <label className="map-sr-only" htmlFor="ask-nylah-input">
          Ask Nylah about the map
        </label>
        <input
          id="ask-nylah-input"
          type="text"
          value={input}
          disabled={busy || props.offline}
          placeholder={props.offline ? 'Offline — Ask needs internet' : 'Ask about the map…'}
          onChange={(event) => setInput(event.target.value)}
        />
        <button type="submit" disabled={busy || props.offline || !input.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
      {!hasKey && messages.length === 0 && (
        <div className="ask-key-onboarding">
          <p>
            For written answers, Ask needs your OpenAI key. Paste it here — it stays only on
            this phone, and is sent nowhere except OpenAI when you ask. Without a key, matching
            places still show on the map.
          </p>
          <div className="ask-key-row">
            <label className="map-sr-only" htmlFor="ask-api-key-inline">
              OpenAI API key
            </label>
            <input
              id="ask-api-key-inline"
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Paste your OpenAI key (sk-…)"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
            />
            <button type="button" className="button" disabled={!keyInput.trim()} onClick={saveKey}>
              <KeyRound size={16} /> Save key
            </button>
          </div>
          <p>
            <button type="button" className="text-button" onClick={props.onOpenSettings}>
              Or add it in Settings instead
            </button>
          </p>
        </div>
      )}
      {!hasKey && messages.length > 0 && (
        <p className="help-text">
          Written answers need your OpenAI key.{' '}
          <button type="button" className="text-button" onClick={props.onOpenSettings}>
            Add it in Settings
          </button>
        </p>
      )}
      {hasKey && (
        <p className="help-text">
          Key saved on this device — you can change or remove it in Settings.
        </p>
      )}
    </section>
  );
}
