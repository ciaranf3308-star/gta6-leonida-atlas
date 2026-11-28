import { useState } from 'react';
import { atlasRepository } from '../../db/repository';
import { saveLocal, usePersistenceStore, useUserStore } from '../../stores/atlas';
import { Modal } from '../../app/Modal';
import type { Place } from '../../domain/types';
import IndexPanel from '../categorise/IndexPanel';
import {
  DEFAULT_ASK_MODEL,
  getAskApiKey,
  getAskModel,
  setAskApiKey,
  setAskModel,
} from '../ask/openai';
import { COUNTIES } from '../../data/counties';
import {
  AiImageError,
  clearCountyArt,
  generateCountyArt,
  saveCountyArt,
  useCountyArt,
} from '../art/ai-images';

export default function SettingsDialog({
  onClose,
  onOpenBackup,
  onOpenAbout,
  places,
  offline,
}: {
  onClose: () => void;
  /** The panel footer used to carry these on every page — they live
   * here now, in the one dedicated settings area. All optional: the
   * dialog also works standalone (tests, deep links). */
  onOpenBackup?: () => void;
  onOpenAbout?: () => void;
  /** All catalogue places — the index panel counts the unnamed ones. */
  places: Place[];
  offline: boolean;
}) {
  const preferences = useUserStore((s) => s.preferences);
  const ready = usePersistenceStore((s) => s.ready);
  const [storageMessage, setStorageMessage] = useState('');
  const [askApiKey, setAskApiKeyState] = useState(() => getAskApiKey());
  const [askModel, setAskModelState] = useState(() => getAskModel());
  // County art (After Hours): one AI-painted image per county, made with
  // the key above, stored on this device, labelled "AI image".
  const countyArt = useCountyArt();
  const [generatingCountyId, setGeneratingCountyId] = useState<string | null>(null);
  const [artMessage, setArtMessage] = useState('');
  return (
    <Modal title="ViceWire settings" onClose={onClose}>
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
        <h3>Back up my ViceWire</h3>
        <p className="help-text">
          Everything you make here lives only on this phone — your markers, notes, saved places,
          collections, and the AI index (every &ldquo;?&rdquo; place the job has sorted). A phone
          wipe, clearing browser data, uninstalling the app or moving to a new phone loses all of
          it unless you export. One file, <strong>leonida-atlas-backup-YYYY-MM-DD.json</strong>,
          keeps it forever. Your OpenAI key is never in the file — it stays on the device you
          typed it on, and you add it again on a new phone.
        </p>
        <button
          className="button primary"
          type="button"
          disabled={!ready || !onOpenBackup}
          onClick={() => {
            if (onOpenBackup) {
              onClose();
              onOpenBackup();
            }
          }}
        >
          Back up my ViceWire
        </button>
        <p className="help-text">
          Where my stuff lives: markers, notes and saved places in this browser&apos;s storage;
          the AI index in this browser too, saved after every batch while indexing. The map
          itself and the app can reopen offline after the first complete load. Nothing is
          stored in an account anywhere — there is no account — so the backup file is the
          only copy that survives this phone.
        </p>
      </section>
      <section className="detail-section">
        <h3>Ask Nylah (AI)</h3>
        <p className="help-text">
          Ask Nylah answers only from this map, and only about what you asked for. Your OpenAI
          key stays on this device only — it is never backed up, never sent anywhere except
          OpenAI when you ask, and never shown in full. Without a key, Ask still lists matching
          places from the map. OpenAI itself recommends against keeping API keys in a browser:
          this one lives in this browser&apos;s storage, so anyone with access to this device
          or browser profile could read it — remove it here any time, and don&apos;t reuse a
          key that protects anything else.
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
      {/* v0.33 D-1: "Sort the unnamed places" lives here now — buried
        in Settings, never advertised (v0.32 open decision 1). v0.32
        step 5 took it out of the primary experience and no lane ever
        re-mounted it, so the typing route §A9.3 depends on was
        unreachable in the app; this is its decided home. It uses the
        same key as Ask above, so its "add your key" action focuses
        that field instead of opening Settings again. */}
      <IndexPanel
        places={places}
        offline={offline}
        onOpenSettings={() => {
          const keyField = document.getElementById('ask-api-key');
          keyField?.scrollIntoView({ block: 'center' });
          keyField?.focus();
        }}
      />
      <section className="detail-section">
        <h3>County art</h3>
        <p className="help-text">
          The county photographs are AI-generated art — dusk landscapes in each county&apos;s
          mood, not photos of real places. With your OpenAI key (the same one above) you can
          paint a fresh one for any county. It stays on this device, is labelled &ldquo;AI
          image&rdquo; on the card, and OpenAI charges per image on your key. The bundled art
          comes back any time you restore it.
        </p>
        <div className="county-art-list">
          {COUNTIES.map((county) => {
            const record = countyArt[county.id];
            const generating = generatingCountyId === county.id;
            return (
              <div className="county-art-row" key={county.id}>
                <span>
                  {county.name}
                  <small>
                    {record
                      ? `AI image · ${new Date(record.createdAt).toLocaleDateString()}`
                      : 'Bundled art'}
                  </small>
                </span>
                <span className="county-art-actions">
                  <button
                    className="button"
                    type="button"
                    disabled={!askApiKey || generating}
                    onClick={async () => {
                      setArtMessage('');
                      setGeneratingCountyId(county.id);
                      try {
                        const painted = await generateCountyArt({ county });
                        saveCountyArt(painted);
                        setArtMessage(`${county.name} repainted — it is on the card now.`);
                      } catch (error) {
                        setArtMessage(
                          error instanceof AiImageError
                            ? error.message
                            : 'The image could not be painted. The bundled art is untouched.',
                        );
                      } finally {
                        setGeneratingCountyId(null);
                      }
                    }}
                  >
                    {generating ? 'Painting…' : 'Generate with AI'}
                  </button>
                  {record && (
                    <button
                      className="button"
                      type="button"
                      disabled={generating}
                      onClick={() => {
                        clearCountyArt(county.id);
                        setArtMessage(`${county.name} is back to the bundled art.`);
                      }}
                    >
                      Restore bundled
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {!askApiKey && (
          <p className="help-text">
            Add your OpenAI key in Ask Nylah above to paint county art.
          </p>
        )}
        {artMessage && (
          <p role="status" className="help-text">
            {artMessage}
          </p>
        )}
      </section>
      <section className="detail-section">
        <h3>Storage on this device</h3>
        <p className="help-text">
          Your browser stores personal data in IndexedDB, and the AI index in this browser too.
          Backups protect your work if browser data is cleared — without one, the AI index is
          lost with it. The map and app can reopen offline after the first complete load; The 3D view and its textures
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
      {(onOpenBackup || onOpenAbout) && (
        <section className="detail-section">
          <h3>More</h3>
          <div className="button-row settings-more">
            {onOpenBackup && (
              <button className="button" type="button" onClick={() => { onClose(); onOpenBackup(); }}>
                Backup
              </button>
            )}
            {onOpenAbout && (
              <button className="button" type="button" onClick={() => { onClose(); onOpenAbout(); }}>
                About
              </button>
            )}
          </div>
        </section>
      )}
    </Modal>
  );
}
