import { useState } from 'react';
import { KeyRound } from 'lucide-react';
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
}

/**
 * First-run welcome sheet. The map opens blank on purpose so nothing is
 * spoiled — this sheet is the thing that says so, proves the places are
 * there with real counts, and lets the user turn on just one layer with
 * one tap. It also onboards the Ask Nylah API key in place, instead of
 * sending the user hunting through Settings.
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

  function saveKey() {
    if (!keyInput.trim()) return;
    setAskApiKey(keyInput.trim());
    setKeyInput('');
    setKeySaved(true);
  }

  return (
    <Modal
      title="Welcome to Leonida"
      titleClassName="display-title"
      onClose={props.onClose}
      footer={
        <button type="button" className="button" onClick={props.onClose}>
          {keySaved ? 'Done' : 'Skip for now — explore the blank map'}
        </button>
      }
    >
      <p className="panel-intro">
        Your map starts blank on purpose — so nothing is spoiled. But the
        places <strong>are</strong> mapped: <strong>{total.toLocaleString()} places</strong>{' '}
        in this atlas. Nothing shows until you choose what to see.
      </p>
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
      <section className="detail-section">
        <h3>Ask Nylah — your API key</h3>
        <p className="help-text">
          Ask Nylah can answer in your own words and highlight the places on the map — but it
          needs your OpenAI key to write answers. Without a key it still lists matching places.
          The key stays only on this phone, in this browser — it is never sent anywhere except
          OpenAI when you ask a question.
        </p>
        {keySaved ? (
          <p className="help-text" role="status">
            Key saved on this device. You can change or remove it in Settings.
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
              onClick={saveKey}
            >
              <KeyRound size={16} /> Save key
            </button>
          </div>
        )}
      </section>
      <p className="help-text">
        You can reopen this at any time from the ? button on the map, and turn layers on or off
        from Layers.
      </p>
    </Modal>
  );
}
