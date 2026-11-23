import { useEffect, useRef, useState } from 'react';
import { KeyRound, Send, Sparkles, X } from 'lucide-react';
import type { Filters, LayerDefinition, Place } from '../../domain/types';
import { isUnnamedPlace } from '../../domain/types';
import { displayTagsFor } from '../../domain/tags';
import { useMapStore } from '../../stores/atlas';
import { retrieveForAsk } from './retrieval';
import {
  askOpenAi,
  getAskApiKey,
  getAskModel,
  parsePlaceMentions,
  setAskApiKey,
} from './openai';
import {
  aiCategoryDisplay,
  type AiCategoryRecord,
} from '../categorise/categories';

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
}

interface AskMessage {
  role: 'user' | 'assistant';
  text: string;
  placeIds: string[];
}

const SUGGESTED_PROMPTS = [
  "I'm up north beside Mount Kalaga, need to hit some gains — any ideas?",
  'Thinking of hitting some burglaries in Capri — highlight all the houses I can hit tonight.',
  'Where is the nearest gym to Vice City?',
];

export default function AskPanel(props: AskPanelProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(() => getAskApiKey().length > 0);
  const messagesRef = useRef<HTMLDivElement>(null);
  // The latest answer must be in view: scroll the messages to the bottom
  // on every new message, instead of leaving the answer below the fold.
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  function saveKey() {
    if (!keyInput.trim()) return;
    setAskApiKey(keyInput.trim());
    setKeyInput('');
    setHasKey(true);
  }

  const placeById = new Map(props.places.map((place) => [place.id, place]));

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

  async function submit(questionText: string) {
    const question = questionText.trim();
    if (!question || busy) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: question, placeIds: [] }]);
    setBusy(true);
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
      const apiKey = getAskApiKey();
      if (result.records.length === 0) {
        const scope = result.requestedLayerNames.length
          ? ` for ${result.requestedLayerNames.join(', ')}`
          : '';
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: result.areaMismatch
              ? `Nothing${scope} in that area in the map data — the nearest matching places are shown below instead.`
              : `Nothing${scope} in the map data for that. I won't guess — try turning a layer on, or drop your own marker when you find one.`,
            placeIds: [],
          },
        ]);
        props.onClearHighlights();
        return;
      }
      if (!apiKey) {
        // No key: still a useful finder — the local records, no AI text.
        // The proximity verdict leads: never present far-away places as near.
        showOnMap(result.records);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: result.proximitySummary
              ? `${result.proximitySummary} Matching places from the map (${result.records.length} shown${result.totalInScope > result.records.length ? ` of ${result.totalInScope}` : ''}):`
              : `Here are the matching places from the map (${result.records.length} shown${result.totalInScope > result.records.length ? ` of ${result.totalInScope}` : ''}${result.areaMismatch ? ' — nothing in that exact area, so these are the nearest' : ''}). Add your OpenAI key in Settings for a written answer.`,
            placeIds: result.records.map((place) => place.id),
          },
        ]);
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
      const mentioned = parsePlaceMentions(answer, result.records);
      const highlight = mentioned.length > 0 ? mentioned : result.records;
      showOnMap(highlight);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: answer,
          placeIds: highlight.map((place) => place.id),
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            error instanceof Error
              ? error.message
              : 'Ask failed. Your map and markers are untouched.',
          placeIds: [],
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="ask-fab"
        aria-label="Ask Nylah"
        onClick={() => setOpen(true)}
      >
        <Sparkles size={18} />
        <span>Ask Nylah</span>
      </button>
    );
  }

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
            setOpen(false);
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
            <p>{message.text}</p>
            {message.placeIds.length > 0 && (
              <ul className="ask-results">
                {message.placeIds.slice(0, 10).map((id) => {
                  const place = placeById.get(id);
                  if (!place) return null;
                  const aiDisplay = aiCategoryDisplay(props.aiCategories[id]);
                  return (
                    <li key={id}>
                      <button type="button" onClick={() => props.onSelect(id)}>
                        <strong>{place.title}</strong>
                        <small>
                          {place.region || 'Leonida'}
                          {isUnnamedPlace(place) && displayTagsFor(place).length > 0
                            ? ` · ${displayTagsFor(place).join(' · ')}`
                            : ''}
                          {aiDisplay ? ` · AI suggested: ${aiDisplay.label}` : ''}
                        </small>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {message.role === 'assistant' && message.placeIds.length === 0 && !hasKey && (
              <button type="button" className="text-button" onClick={props.onOpenSettings}>
                Add your OpenAI key in Settings
              </button>
            )}
          </div>
        ))}
        {busy && (
          <p className="help-text" role="status">
            Asking…
          </p>
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
