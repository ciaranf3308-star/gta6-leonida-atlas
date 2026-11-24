import { useState } from 'react';
import { KeyRound, Play, Sparkles } from 'lucide-react';
import { Modal } from '../../app/Modal';
import type { LayerDefinition, Place } from '../../domain/types';
import { getAskApiKey, setAskApiKey } from '../ask/openai';
import { PlaceIcon, iconKeyForLayer } from '../map/place-icons';
import { DEFAULT_LAYERS } from '../map/layers';
import {
  QUICK_START_LAYERS,
  layerCounts,
  nameCounts,
  totalMappedPlaces,
} from './onboarding';
import { tagResolutionCounts } from '../../domain/resolve-tags';

export interface WelcomeSheetProps {
  places: Place[];
  layers: LayerDefinition[];
  onQuickStart: (layerId: string) => void;
  onClose: () => void;
  /** First launch after v0.11.0: no ×, no Escape — Start or Skip only. */
  forced?: boolean;
  /** "Start sorting" from the onboarding: save the key (if typed),
   * close, open Layers, and start the indexing job. */
  onStartIndexing: () => void;
}

/**
 * Forced first-launch onboarding (v0.11.0). The map opens blank on
 * purpose so nothing is spoiled — but the reason this sheet cannot be
 * dismissed with an × is the indexing job: 2,732 places are still "?",
 * 581 already have a type from the map data's own tags, 2,151 still
 * have nothing to read, and the ONLY way they get sorted is this job,
 * on this phone, with the user's own OpenAI key.
 *
 * Plain words, no jargon: paste the key (the same one Ask Nylah uses,
 * on-device only, sent nowhere except OpenAI), tap Start — or
 * explicitly tap "Skip for now". Skipping is a choice, not a missed ×:
 * afterwards the job is one tap away in Layers ("Sort the unnamed
 * places") and a reminder pill stays on the map until it has run once.
 */
export default function WelcomeSheet(props: WelcomeSheetProps) {
  const [keyInput, setKeyInput] = useState('');
  const [keySaved, setKeySaved] = useState(() => getAskApiKey().length > 0);
  const counts = layerCounts(props.places, props.layers);
  const byId = new Map(counts.map((count) => [count.layerId, count]));
  const total = totalMappedPlaces(props.places);
  const names = nameCounts(props.places);
  const tagCounts = tagResolutionCounts(props.places);
  const cardCounts = counts.filter((count) => count.layerId.startsWith('cards:'));
  const cardPins = cardCounts.reduce((sum, count) => sum + count.positioned, 0);
  const canStart = keySaved || keyInput.trim().length > 0;

  function startIndexing() {
    if (keyInput.trim()) {
      setAskApiKey(keyInput.trim());
      setKeyInput('');
      setKeySaved(true);
    }
    props.onStartIndexing();
  }

  return (
    <Modal
      title="Welcome to Leonida"
      titleClassName="display-title"
      dismissable={!props.forced}
      onClose={props.onClose}
      footer={
        <div className="button-row">
          <button
            type="button"
            className="button primary"
            disabled={!canStart}
            onClick={startIndexing}
          >
            <Play size={16} /> Start sorting
          </button>
          <button type="button" className="button" onClick={props.onClose}>
            Skip for now — I&rsquo;ll sort them later
          </button>
        </div>
      }
    >
      <p className="panel-intro">
        Your map starts blank on purpose — so nothing is spoiled. But the
        places <strong>are</strong> mapped: <strong>{total.toLocaleString()} places</strong>{' '}
        in this atlas. Nothing shows until you choose what to see.
      </p>
      <section className="detail-section">
        <h3>
          <Sparkles size={15} /> {tagCounts.remaining.toLocaleString()} places still
          need sorting
        </h3>
        <p className="panel-intro">
          {names.questionMark.toLocaleString()} places are still &ldquo;?&rdquo; — they
          have no name at all. {tagCounts.resolved.toLocaleString()} of them
          already have a type from the map data&rsquo;s own tags (house, shop,
          petrol station), so they show as &ldquo;? · House&rdquo; in Find.{' '}
          <strong>
            {tagCounts.remaining.toLocaleString()} still have nothing to read.
          </strong>{' '}
          The only way they get sorted is the indexing job below, on this
          phone, with your own OpenAI key. On a fresh phone, 0 are sorted —
          the job has never run until you start it.
        </p>
        <p className="panel-intro">
          How it works, plainly: it goes through the unnamed places{' '}
          <strong>8 at a time</strong>, using the small model{' '}
          <strong>(gpt-4o-mini)</strong>, and saves each batch on this phone
          before starting the next — so you can pause it, stop it, and pick
          up where you left off. Every suggestion is labelled{' '}
          <strong>&ldquo;AI suggested&rdquo;</strong>, never a fact, and if the
          AI isn&rsquo;t sure it stays <strong>&ldquo;not sure&rdquo;</strong> — nothing
          is guessed, and no name is ever invented.
        </p>
      </section>
      <section className="detail-section">
        <h3>Your OpenAI key — to start the job</h3>
        <p className="help-text">
          The same key Ask Nylah uses. It stays only on this phone, in this
          browser — it is never sent anywhere except OpenAI, when the job
          runs or when you ask a question. No key is ever bundled with the
          app. Get one at{' '}
          <a
            href="https://platform.openai.com/api-keys"
            target="_blank"
            rel="noreferrer"
          >
            platform.openai.com/api-keys
          </a>
          .
        </p>
        {keySaved ? (
          <p className="help-text" role="status">
            Key saved on this device. Tap &ldquo;Start sorting&rdquo; below to
            run the job — or change or remove the key in Settings.
          </p>
        ) : (
          <div className="welcome-key-row">
            <label className="map-sr-only" htmlFor="welcome-api-key">
              OpenAI API key
            </label>
            <input
              id="welcome-api-key"
              type="password"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Paste your OpenAI key (sk-…)"
              value={keyInput}
              onChange={(event) => setKeyInput(event.target.value)}
            />
            <button
              type="button"
              className="button"
              disabled={!keyInput.trim()}
              onClick={() => {
                setAskApiKey(keyInput.trim());
                setKeyInput('');
                setKeySaved(true);
              }}
            >
              <KeyRound size={16} /> Save key
            </button>
          </div>
        )}
      </section>
      <section className="detail-section">
        <h3>What is mapped</h3>
        <ul className="welcome-counts">
          {counts
            .filter((count) => !count.layerId.startsWith('cards:') && count.total > 0)
            .map((count) => (
              <li key={count.layerId}>
                <span
                  className="welcome-icon"
                  style={{
                    background:
                      DEFAULT_LAYERS.find((l) => l.id === count.layerId)?.style.color ??
                      '#e8823a',
                  }}
                  aria-hidden="true"
                >
                  <PlaceIcon icon={iconKeyForLayer(count.layerId)} size={17} />
                </span>
                <span>
                  <strong>{count.name}</strong>
                  <small>
                    {count.positioned.toLocaleString()} on the map
                    {count.unpositioned > 0
                      ? ` · ${count.unpositioned} listed by name, no verified position yet`
                      : ''}
                  </small>
                </span>
              </li>
            ))}
          <li>
            <span className="welcome-icon" style={{ background: '#d98cb3' }} aria-hidden="true">
              <PlaceIcon icon="gem" size={17} />
            </span>
            <span>
              <strong>Trading cards · 18 sets, 480 cards</strong>
              <small>
                {cardPins} verified pins so far — the rest have no verified position yet.
                Toggle a set on only when you want to hunt it.
              </small>
            </span>
          </li>
        </ul>
        <p className="help-text">
          {names.known.toLocaleString()} places have a confirmed name.{' '}
          {names.unknown.toLocaleString()} do not yet — {names.questionMark.toLocaleString()}{' '}
          are still “?” and {names.tentative} show a name with a “?” because the name itself
          is not confirmed. {tagCounts.resolved.toLocaleString()} of the “?” places already
          have a type from the map data's own tags (house, shop, petrol station), so they
          show as “? · House” in Find. {tagCounts.remaining.toLocaleString()} still have
          nothing to read — those are what the AI job in Layers is for, or your own marks.
          Turn on Unverified places in Layers to see them.
        </p>
      </section>
      <section className="detail-section">
        <h3>Show me…</h3>
        <p className="help-text">
          One tap turns on just that layer. Everything else stays hidden until you ask for it.
        </p>
        <div className="welcome-quick-starts">
          {QUICK_START_LAYERS.map((quick) => {
            const count = byId.get(quick.layerId);
            return (
              <button
                key={quick.layerId}
                type="button"
                className="button"
                onClick={() => props.onQuickStart(quick.layerId)}
              >
                <span
                  className="welcome-icon"
                  style={{
                    background:
                      DEFAULT_LAYERS.find((l) => l.id === quick.layerId)?.style.color ??
                      '#e8823a',
                  }}
                  aria-hidden="true"
                >
                  <PlaceIcon icon={iconKeyForLayer(quick.layerId)} size={15} />
                </span>
                {quick.label}
                {count ? ` (${count.positioned})` : ''}
                <small>{quick.hint}</small>
              </button>
            );
          })}
        </div>
      </section>
      <p className="help-text">
        Skipped the job? It is one tap away in Layers — &ldquo;Sort the unnamed
        places&rdquo; — and a reminder stays on the map until it has run at
        least once. You can reopen this sheet at any time from the ? button
        on the map, and turn layers on or off from Layers.
      </p>
    </Modal>
  );
}
