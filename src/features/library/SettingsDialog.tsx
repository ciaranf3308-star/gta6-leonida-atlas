import { useState } from 'react';
import { atlasRepository } from '../../db/repository';
import { saveLocal, usePersistenceStore, useUserStore } from '../../stores/atlas';
import { Modal } from '../../app/Modal';
import {
  DEFAULT_ASK_MODEL,
  getAskApiKey,
  getAskModel,
  setAskApiKey,
  setAskModel,
} from '../ask/openai';

export default function SettingsDialog({ onClose }: { onClose: () => void }) {
  const preferences = useUserStore((s) => s.preferences);
  const ready = usePersistenceStore((s) => s.ready);
  const [storageMessage, setStorageMessage] = useState('');
  const [askApiKey, setAskApiKeyState] = useState(() => getAskApiKey());
  const [askModel, setAskModelState] = useState(() => getAskModel());
  return (
    <Modal title="Atlas settings" onClose={onClose}>
      <div className="settings-list">
        {(
          [
            {
              key: 'showLabels',
              title: 'Map labels',
              description: 'Show place names when zoomed in.',
            },
            {
              key: 'clusterMarkers',
              title: 'Group nearby markers',
              description: 'Cluster points to keep dense areas readable.',
            },
            {
              key: 'reducedMotion',
              title: 'Reduce motion',
              description: 'Use immediate map movements and quiet transitions.',
            },
          ] as const
        ).map((option) => (
          <label className="setting-row" key={option.key}>
            <span>
              {option.title}
              <small>{option.description}</small>
            </span>
            <input
              type="checkbox"
              disabled={!ready}
              checked={preferences[option.key]}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                void saveLocal(() =>
                  atlasRepository.savePreferences({
                    ...useUserStore.getState().preferences,
                    [option.key]: checked,
                  }),
                );
              }}
            />
          </label>
        ))}
      </div>
      <section className="detail-section">
        <h3>Ask Nylah (AI)</h3>
        <p className="help-text">
          Ask Nylah answers only from this map, and only about what you asked for. Your OpenAI
          key stays on this device only — it is never backed up, never sent anywhere except
          OpenAI when you ask, and never shown in full. Without a key, Ask still lists matching
          places from the map.
        </p>
        <label className="ask-setting-row" htmlFor="ask-api-key">
          <span>
            OpenAI API key
            <small>Stored only in this browser.</small>
          </span>
          <input
            id="ask-api-key"
            type="password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="sk-…"
            value={askApiKey}
            onChange={(e) => {
              setAskApiKeyState(e.target.value);
              setAskApiKey(e.target.value);
            }}
          />
        </label>
        <label className="ask-setting-row" htmlFor="ask-model">
          <span>
            Model
            <small>Default: {DEFAULT_ASK_MODEL}</small>
          </span>
          <input
            id="ask-model"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={DEFAULT_ASK_MODEL}
            value={askModel}
            onChange={(e) => {
              setAskModelState(e.target.value);
              setAskModel(e.target.value);
            }}
          />
        </label>
        {askApiKey && (
          <button
            className="button"
            type="button"
            onClick={() => {
              setAskApiKeyState('');
              setAskApiKey('');
            }}
          >
            Remove API key
          </button>
        )}
      </section>
      <section className="detail-section">
        <h3>Storage on this device</h3>
        <p className="help-text">
          Your browser stores personal data in IndexedDB. Backups protect your work if browser data
          is cleared. The map and app can reopen offline after the first complete load; The 3D view and its textures
          are cached as you explore.
        </p>
        <button
          className="button"
          disabled={!ready}
          onClick={async () => {
            const persisted = await atlasRepository.requestPersistence();
            setStorageMessage(
              persisted
                ? 'Persistent storage is enabled.'
                : 'Your browser did not grant persistent storage. Local saves still work; keep an exported backup.',
            );
          }}
        >
          Protect local storage
        </button>
        {storageMessage && (
          <p role="status" className="help-text">
            {storageMessage}
          </p>
        )}
      </section>
      <section className="detail-section">
        <h3>Keyboard</h3>
        <p className="help-text">
          / to search · Escape to close the selected place or cancel placement · arrow keys to pan
          the focused map · + / − to zoom. Use the marker coordinate form to place a point without a
          mouse.
        </p>
      </section>
    </Modal>
  );
}
