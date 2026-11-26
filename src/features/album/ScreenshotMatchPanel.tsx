/**
 * "Add from screenshot" (DESIGN-ADDENDUM §3.5, Demo F) — upload a
 * photo of a card front or of the in-game collection screen, get
 * PROPOSED completion updates, confirm or dismiss each one. Nothing
 * is auto-applied, ever: dismissing a proposal writes nothing, and
 * leaving one unconfirmed writes nothing.
 *
 * Honest states, in plain words:
 * - No OpenAI key: the sheet says matching needs your key (Settings
 *   → Ask Nylah) and the Match button stays off. The photo can still
 *   be saved on this device — as the card's own photo when a card was
 *   picked, or as a saved screenshot — but no match is faked and no
 *   result is invented.
 * - The photo is sent to the AI provider under your key for the one
 *   match call, stored on this device only, and never in a backup.
 * - A "possible match" (0.5–0.8) is labelled "check the name" and is
 *   excluded from batch confirm; a < 0.5 candidate is never proposed.
 * - A discrepancy is not an auto-undo: if the app has a card
 *   collected that the screen does not show, the proposal list simply
 *   does not include it — the screen is authoritative for additions
 *   only, and the app never silently un-collects.
 */
import { useEffect, useRef, useState } from 'react';
import './album.css';
import type { GameDatabase } from '../../domain/game-db';
import { getAskApiKey } from '../ask/openai';
import { downscalePhoto } from '../library/place-photo';
import { useCompletionLogStore } from '../completion/log-store';
import {
  applyScreenshotProposals,
  matchScreenshot,
  saveScreenshot,
  type ScreenshotKind,
  type ScreenshotMatchResult,
  type ScreenshotProposal,
} from './screenshot-match';
import type { AlbumScreenshotPreset } from './Album';

export interface ScreenshotMatchPreset {
  setId?: string;
  itemId?: string;
  kind?: ScreenshotKind;
}

function presetToState(preset: AlbumScreenshotPreset | null): {
  kind: ScreenshotKind;
  setId: string;
  itemId: string;
} {
  return {
    kind: preset?.kind ?? 'card-front',
    setId: preset?.setId ?? '',
    itemId: preset?.itemId ?? '',
  };
}

export function ScreenshotMatchPanel({
  db,
  open,
  preset,
  onClose,
  onApplied,
  onPhotoSaved,
}: {
  db: GameDatabase | null;
  open: boolean;
  preset: AlbumScreenshotPreset | null;
  onClose: () => void;
  /** Called with the rebuilt db after a confirm, so the album and
   * the journal move in the same write. */
  onApplied?: (db: GameDatabase) => void;
  /** Called after a photo is saved/linked, so card faces reload. */
  onPhotoSaved?: () => void;
}) {
  const [kind, setKind] = useState<ScreenshotKind>('card-front');
  const [setId, setSetId] = useState('');
  const [itemId, setItemId] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState('');
  const [matchResult, setMatchResult] = useState<ScreenshotMatchResult | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [appliedNote, setAppliedNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'pick' | 'matched'>('pick');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const initial = presetToState(preset);
    setKind(initial.kind);
    setSetId(initial.setId);
    setItemId(initial.itemId);
    setHasKey(getAskApiKey().length > 0);
    setPreviewUrl(null);
    setSavedId(null);
    setSavedNote('');
    setMatchResult(null);
    setSelected(new Set());
    setDismissed(new Set());
    setAppliedNote('');
    setError('');
    setBusy(false);
    setPhase('pick');
  }, [open, preset]);

  if (!open) return null;

  const sets = db ? [...db.sets.values()] : [];
  const targetItem = itemId && db ? db.items.get(itemId) : undefined;
  const visibleProposals = (matchResult?.ok ? matchResult.proposals : []).filter(
    (proposal) => !dismissed.has(proposal.itemId),
  );
  const confirmableSelected = visibleProposals.filter(
    (proposal) => proposal.tier === 'confirm' && selected.has(proposal.itemId),
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setMatchResult(null);
    setAppliedNote('');
    setPhase('pick');
    const dataUrl = await downscalePhoto(file);
    if (!dataUrl) {
      setPreviewUrl(null);
      setError('That file could not be read as a photo. Try a screenshot from your phone.');
      return;
    }
    setPreviewUrl(dataUrl);
  }

  async function savePhotoOnly(): Promise<string | null> {
    if (!previewUrl) return null;
    const saved = await saveScreenshot({
      dataUrl: previewUrl,
      kind,
      setId: setId || null,
      itemId: itemId || null,
    });
    if (!saved.ok) {
      setError(saved.error);
      return null;
    }
    setSavedId(saved.screenshot.id);
    if (kind === 'card-front' && itemId) {
      setSavedNote(
        `Saved as your photo for ${targetItem?.name ?? 'that card'} — it now shows as the card's face in the album.`,
      );
    } else {
      setSavedNote('Saved on this device. It is never in a backup.');
    }
    onPhotoSaved?.();
    return saved.screenshot.id;
  }

  async function runMatch() {
    if (!db || !previewUrl || busy) return;
    setBusy(true);
    setError('');
    setAppliedNote('');
    // Save first: the screenshot stays as a user attachment even when
    // the match fails or finds nothing ("it stays attached to your
    // note" — §3.5 step 4). Save once — a second match tap reuses the
    // saved row instead of duplicating it.
    const screenshotId = savedId ?? (await savePhotoOnly());
    if (!screenshotId) {
      setBusy(false);
      return;
    }
    const result = await matchScreenshot({
      dataUrl: previewUrl,
      kind,
      setId: setId || null,
      screenshotId,
      db,
    });
    setBusy(false);
    setMatchResult(result);
    setPhase('matched');
    if (result.ok) {
      setSelected(
        new Set(result.proposals.filter((p) => p.tier === 'confirm').map((p) => p.itemId)),
      );
      if (result.proposals.length === 0) {
        setSavedNote(
          'No cards could be matched from this photo — nothing was marked found. The photo is saved on this device.',
        );
      }
    } else if (result.code !== 'no-key') {
      setError(result.error);
    }
  }

  async function confirmSelected() {
    if (!db || busy || confirmableSelected.length === 0) return;
    setBusy(true);
    setError('');
    const result = await applyScreenshotProposals({
      proposals: confirmableSelected,
      db,
    });
    setBusy(false);
    if (result.errors.length > 0) {
      setError(result.errors.map((entry) => entry.error).join(' '));
    }
    if (result.applied.length > 0) {
      useCompletionLogStore.getState().applyDb(result.db);
      setAppliedNote(
        `${result.applied.map((entry) => entry.name).join(', ')} marked collected ✓ — from your screenshot. The set, the map pin and Progress all updated from that record.`,
      );
      setMatchResult((current) =>
        current?.ok
          ? {
              ...current,
              proposals: current.proposals.filter(
                (proposal) => !result.applied.some((entry) => entry.itemId === proposal.itemId),
              ),
            }
          : current,
      );
      setSelected(new Set());
      onApplied?.(result.db);
      onPhotoSaved?.();
    }
    if (result.skipped.length > 0) {
      setSavedNote(
        result.skipped.map((entry) => entry.reason).join(' '),
      );
    }
  }

  async function confirmOne(proposal: ScreenshotProposal) {
    if (!db || busy) return;
    setBusy(true);
    setError('');
    const result = await applyScreenshotProposals({ proposals: [proposal], db });
    setBusy(false);
    if (result.errors.length > 0) {
      setError(result.errors.map((entry) => entry.error).join(' '));
      return;
    }
    if (result.applied.length > 0) {
      useCompletionLogStore.getState().applyDb(result.db);
      setAppliedNote(
        `${result.applied.map((entry) => entry.name).join(', ')} marked collected ✓ — from your screenshot.`,
      );
      setMatchResult((current) =>
        current?.ok
          ? {
              ...current,
              proposals: current.proposals.filter((p) => p.itemId !== proposal.itemId),
            }
          : current,
      );
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(proposal.itemId);
        return next;
      });
      onApplied?.(result.db);
      onPhotoSaved?.();
    }
  }

  function dismissOne(proposal: ScreenshotProposal) {
    // Dismiss applies nothing — the proposal is dropped, the card
    // stays exactly as it was. No write of any kind happens here.
    setDismissed((prev) => new Set([...prev, proposal.itemId]));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(proposal.itemId);
      return next;
    });
  }

  return (
    <section className="screenshot-match" aria-label="Add from screenshot">
      <h3>Add from screenshot</h3>
      <p className="panel-intro">
        Upload a photo of a card, or of the in-game collection screen. The photo is sent to the
        AI provider under your own OpenAI key for the one match call, stored on this device only,
        and never in a backup. Nothing is marked found until you confirm it below.
      </p>
      {!hasKey && (
        <p className="screenshot-match-nokey" role="note">
          Matching needs your OpenAI key — add it in Settings, under Ask Nylah. Without it, no
          match can run and no result will be invented. You can still save the photo on this
          device as the card&apos;s own photo.
        </p>
      )}
      <div className="screenshot-match-kind" role="group" aria-label="Screenshot kind">
        <label>
          <input
            type="radio"
            name="screenshot-kind"
            checked={kind === 'card-front'}
            onChange={() => setKind('card-front')}
          />
          Card front — one card
        </label>
        <label>
          <input
            type="radio"
            name="screenshot-kind"
            checked={kind === 'collection-screen'}
            onChange={() => setKind('collection-screen')}
          />
          Collection screen — several cards
        </label>
      </div>
      <label className="screenshot-match-set">
        Set (optional — narrows the match)
        <select value={setId} onChange={(event) => setSetId(event.target.value)}>
          <option value="">Any set</option>
          {sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </select>
      </label>
      {targetItem && (
        <p className="screenshot-match-target">
          For card: {targetItem.name}
          {targetItem.variant ? ` (${targetItem.variant})` : ''} — confirming a match will also
          use this photo as the card&apos;s face in the album.
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="screenshot-match-file"
        aria-label="Choose a screenshot photo"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <div className="screenshot-match-actions">
        <button type="button" className="button" onClick={() => fileRef.current?.click()}>
          Choose photo
        </button>
        {previewUrl && (
          <button
            type="button"
            className="button"
            disabled={!hasKey || busy || !db}
            onClick={() => void runMatch()}
          >
            {busy ? 'Matching…' : 'Match this screenshot'}
          </button>
        )}
        {previewUrl && !hasKey && (
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => void savePhotoOnly()}
          >
            Save photo only
          </button>
        )}
        <button type="button" className="text-button" onClick={onClose}>
          Close
        </button>
      </div>
      {previewUrl && (
        <img className="screenshot-match-preview" src={previewUrl} alt="Your screenshot, ready to match" />
      )}
      {phase === 'matched' && matchResult && !matchResult.ok && matchResult.code === 'no-key' && (
        <p className="screenshot-match-nokey" role="note">
          {matchResult.error}
        </p>
      )}
      {error && (
        <p className="completion-error" role="alert">
          {error}
        </p>
      )}
      {savedNote && <p className="screenshot-match-note">{savedNote}</p>}
      {appliedNote && (
        <p className="screenshot-match-note" role="status">
          {appliedNote}
        </p>
      )}
      {phase === 'matched' && matchResult?.ok && (
        <div className="screenshot-match-results">
          <h4>
            Proposed from your screenshot — nothing is marked found yet
          </h4>
          {visibleProposals.length === 0 ? (
            <p className="empty-state">
              No proposals left — everything was confirmed, dismissed, or already collected.
            </p>
          ) : (
            <ul className="screenshot-match-proposals">
              {visibleProposals.map((proposal) => {
                const item = db?.items.get(proposal.itemId);
                if (!item) return null;
                const set = item.setId ? db?.sets.get(item.setId) : undefined;
                return (
                  <li key={proposal.itemId} className="screenshot-match-proposal">
                    <label>
                      <input
                        type="checkbox"
                        checked={selected.has(proposal.itemId)}
                        onChange={(event) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) next.add(proposal.itemId);
                            else next.delete(proposal.itemId);
                            return next;
                          });
                        }}
                        aria-label={`Confirm ${item.name} from this screenshot`}
                      />
                      <span>
                        <strong>{item.name}</strong>
                        {item.variant ? ` · ${item.variant}` : ''}
                        {set ? ` · ${set.name}` : ''}
                        <br />
                        <small>
                          {Math.round(proposal.confidence * 100)}% sure —{' '}
                          {proposal.tier === 'confirm'
                            ? 'ready to confirm'
                            : 'possible match — check the name'}
                        </small>
                        <br />
                        <small>{proposal.reason}</small>
                      </span>
                    </label>
                    <span className="screenshot-match-proposal-actions">
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => void confirmOne(proposal)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={busy}
                        onClick={() => dismissOne(proposal)}
                      >
                        Not this one
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {visibleProposals.length > 0 && (
            <button
              type="button"
              className="button"
              disabled={busy || confirmableSelected.length === 0}
              onClick={() => void confirmSelected()}
            >
              Confirm selected ({confirmableSelected.length} ready)
            </button>
          )}
          <p className="screenshot-match-batch-note">
            Batch confirm covers only the “ready to confirm” cards (≥ 80% sure). Possible
            matches need their own Confirm tap, after you check the name.
          </p>
          {matchResult.dropped.length > 0 && (
            <div className="screenshot-match-dropped">
              <h5>Not proposed</h5>
              <ul>
                {matchResult.dropped.map((dropped, index) => (
                  <li key={`${dropped.name}-${index}`}>
                    {dropped.name} —{' '}
                    {dropped.reason === 'already-collected'
                      ? 'you already have this one'
                      : dropped.reason === 'unknown-name'
                        ? 'no card with that name in the checklist'
                        : dropped.reason === 'ambiguous-name'
                          ? 'that name matches more than one card — check it yourself'
                          : dropped.reason === 'over-batch-cap'
                            ? 'over the 30-card batch cap'
                            : 'too unsure to propose — it stays attached to your photo, never forced onto a card'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <p className="screenshot-match-local">
        Photos stay on this device. Deleting the app deletes them. They are never in a backup —
        after a restore, re-add any photo you want as a card face.
      </p>
    </section>
  );
}
