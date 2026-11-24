import { useEffect, useRef, useState } from 'react';
import { ChevronRight, KeyRound, Send, Sparkles, X } from 'lucide-react';
import type { Filters, LayerDefinition, Place } from '../../domain/types';
import { useMapStore } from '../../stores/atlas';
import { retrieveForAsk } from './retrieval';
import {
  askOpenAi,
  getAskApiKey,
  getAskModel,
  setAskApiKey,
} from './openai';
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
  /** Houses in the asked area worth checking for workout equipment —
   * candidates, never verified equipment. 'equipment' when equipment was
   * asked for, 'gym' when a member gym was. */
  houses?: { placeIds: string[]; areaName: string; total: number; kind: 'equipment' | 'gym' };
  /** The systemic rule for a breakable question, one line under the
   * verdict (from retrieval ruleNote). */
  ruleNote?: string | null;
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
  const messagesRef = useRef<HTMLDivElement>(null);
  /** Monotonic submit id — a stale answer never lands after a newer one. */
  const requestRef = useRef(0);
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

  function appendAssistant(message: Omit<AskMessage, 'role'>, requestId: number) {
    if (requestId !== requestRef.current) return;
    setMessages((prev) => [...prev, { ...message, role: 'assistant' }]);
  }

  async function submit(questionText: string) {
    const question = questionText.trim();
    if (!question || busy) return;
    const requestId = ++requestRef.current;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question, cards: [], totalInScope: 0, anchorLabel: null }]);
    setBusy(true);
    setBusyNote('Finding places…');
    try {
      const result = retrieveForAsk({
        question,
        places: props.places,
        layers: props.layers,
        filters: props.filters,
        aiCategories: props.aiCategories,
        visitedIds: props.visitedIds,
        // Follow-ups ("is there nowhere else?") inherit the place from the
        // earlier question in this conversation — the layers asked for
        // still come from this question alone.
        priorQuestions: messages
          .filter((message) => message.role === 'user')
          .map((message) => message.text),
      });
      const anchorLabel = askAnchorLabel(result);
      const cards = buildAskCards(result, props.places, props.aiCategories);
      setBusyNote(
        anchorLabel
          ? `Finding places ${anchorLabel.toLowerCase()}…`
          : 'Finding places…',
      );
      const apiKey = getAskApiKey();
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
              : result.areaMismatch
                ? `Nothing${scope} in that area in the map data — the nearest matching places are shown below instead.`
                : `Nothing${scope} in the map data for that. I won't guess — try turning a layer on, or drop your own marker when you find one.`,
            cards: [],
            totalInScope: 0,
            anchorLabel,
            houses,
          },
          requestId,
        );
        props.onClearHighlights();
        return;
      }
      // The verdict leads, in one or two lines — the cards carry the
      // places, and the houses section carries the house-gym gap.
      const verdict =
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
          },
          requestId,
        );
        return;
      }
      const answer = await askOpenAi({
        question,
        records: result.records,
        requestedLayerNames: result.requestedLayerNames,
        apiKey,
        model: getAskModel(),
        proximitySummary: result.proximitySummary,
        anchorName: result.anchorPlace?.title ?? result.areaLabel,
        distances: result.anchorDistances,
        aiCategories: props.aiCategories,
      });
      showOnMap(result.records);
      appendAssistant(
        {
          // The verdict is the answer; the AI writes at most two short
          // sentences under it (see the system prompt) — never a wall,
          // never a place list, never a repeat of the verdict. One
          // atomic append: verdict + AI note + cards together.
          text: verdict,
          aiNote: answer,
          cards: cards.cards,
          totalInScope: cards.total,
          anchorLabel,
          houses: housesFor(result),
          ruleNote: result.ruleNote,
        },
        requestId,
      );
    } catch (error) {
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
            {message.role === 'assistant' && message.ruleNote && (
              <p className="ask-rule-note">{message.ruleNote}</p>
            )}
            {message.cards.length > 0 && (
              <ul className="ask-cards">
                {message.cards.map((card) => {
                  const place = placeById.get(card.placeId);
                  if (!place) return null;
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
