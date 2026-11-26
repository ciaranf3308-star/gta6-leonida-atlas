/**
 * Match the unplaced cards (v0.32 step 7, CARD-MATCHER-DESIGN) — the
 * Collections checklist header.
 *
 * The matcher runs deterministic-first (exact host → chain+area →
 * same-street → LLM last) over the unpositioned checklist slots, in
 * batches of 8 with pause/cancel between batches. NOTHING is
 * auto-accepted: every proposal lands in the review list below, and
 * the player confirms it with one tap — or rejects it ("Not this
 * one", M4: the pair is never re-proposed) or skips it (stays
 * queued, no write).
 *
 * Counts: matched (confirmed pins) · waiting for review (proposals
 * with no decision yet) · still unmatched (area-known slots with no
 * proposal). Without a key the deterministic passes still run; the
 * LLM pass needs the player's OpenAI key, like Ask.
 *
 * The jot affordance ("Mark it yourself") is on every review row:
 * the player found the card in-game and the guides don't name the
 * building. One tap arms the slot and opens the marker editor — the
 * next marker saved becomes that card's host, evidence 'personal'
 * (the Capri gym equipment rule: the player is the only source).
 * The armed state is shown until the marker lands or the player
 * cancels — a stale arm never silently links an unrelated marker:
 * the panel says plainly that the next marker saved is the card's
 * spot.
 */
import { useState } from 'react';
import type { CollectibleItem, GameDatabase } from '../../domain/game-db';
import { useMapStore, useUiStore } from '../../stores/atlas';
import { useAiIndexStore } from '../categorise/store';
import { getMatcherApiKey, resumeMatcherJob, reviewItems, useMatchStore } from './match-store';

export function MatcherPanel({ db }: { db: GameDatabase | null }) {
  const matches = useMatchStore((s) => s.matches);
  const attempts = useMatchStore((s) => s.attempts);
  const rejections = useMatchStore((s) => s.rejections);
  const job = useMatchStore((s) => s.job);
  const pendingJotSlotId = useMatchStore((s) => s.pendingJotSlotId);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const unmatched = db
    ? [...db.items.values()].filter(
        (item) => item.checklistSlot && item.placement !== 'pinned',
      )
    : [];
  const review = db ? reviewItems(db, { matches, attempts, rejections }) : [];
  const visibleReview = review.filter((row) => !skipped.has(row.attempt.id));
  const pendingSlot = pendingJotSlotId && db ? db.items.get(pendingJotSlotId) : undefined;

  function unmatchedSlots(): CollectibleItem[] {
    if (!db) return [];
    const matchedIds = new Set(matches.map((match) => match.slotId));
    return unmatched.filter((item) => !matchedIds.has(item.id));
  }

  async function start() {
    if (!db) return;
    setError('');
    const apiKey = getMatcherApiKey() ?? '';
    await useMatchStore.getState().startJob({
      db,
      slots: unmatchedSlots(),
      aiCategories: new Map(Object.entries(useAiIndexStore.getState().categories)),
      apiKey,
    });
  }

  async function resume() {
    setError('');
    const ok = await resumeMatcherJob();
    if (!ok) setError('Nothing to resume — start a fresh run.');
  }

  function armJot(slot: CollectibleItem) {
    useMatchStore.getState().armJot(slot.id);
    useMapStore.getState().setMarkerKindPreset(null);
    useMapStore.getState().setEditor('create');
    useUiStore.getState().setNavTab('map');
    useUiStore.getState().setEditorOpen(true);
  }

  async function confirm(row: (typeof review)[number]) {
    if (busyId || !row.candidate) return;
    setBusyId(row.attempt.id);
    setError('');
    const result = await useMatchStore.getState().confirmProposal(
      {
        slotId: row.slot.id,
        hostId: row.hostId,
        hostName: row.hostName,
        confidence: row.confidence,
        reasoning: row.reasoning,
        proposedBy: row.proposedBy,
        candidate: row.candidate,
        areaCheck: row.areaCheck,
        conflictNote: row.conflictNote,
        direction: row.direction,
        directionSourceTitle: row.directionSourceTitle,
        directionSourceUrl: row.directionSourceUrl,
      },
      row.slot,
    );
    setBusyId(null);
    if (!result.ok) setError(result.error ?? 'Could not save that match — try again.');
  }

  async function reject(row: (typeof review)[number]) {
    if (busyId) return;
    setBusyId(row.attempt.id);
    setError('');
    const result = await useMatchStore
      .getState()
      .rejectProposal(row.slot.id, row.hostId);
    setBusyId(null);
    if (!result.ok) setError(result.error ?? 'Could not save that rejection — try again.');
  }

  if (!db) return null;

  return (
    <section className="matcher-panel" aria-label="Match the unplaced cards">
      <h3>Match the unplaced cards</h3>
      <p className="panel-intro">
        {matches.length} matched · {review.length} waiting for review · {unmatched.length}{' '}
        still unmatched. The matcher checks the guide direction against the map — exact host,
        then chain and area, then street — and the AI only ever proposes from that list.
        Nothing is placed until you confirm it.
      </p>
      <div className="matcher-actions">
        <button
          type="button"
          className="button"
          disabled={job?.running || unmatched.length === 0}
          onClick={() => void start()}
        >
          {job?.running ? 'Matching…' : 'Start matching'}
        </button>
        {job?.running && (
          <button type="button" className="button" onClick={() => useMatchStore.getState().pauseJob()}>
            Pause
          </button>
        )}
        {job?.outcome === 'paused' && (
          <button type="button" className="button" onClick={() => void resume()}>
            Resume
          </button>
        )}
        {job?.running && (
          <button type="button" className="text-button" onClick={() => useMatchStore.getState().cancelJob()}>
            Cancel
          </button>
        )}
      </div>
      {job && (
        <p className="help-text" role="status">
          {job.running
            ? `Matching… ${job.done} of ${job.total} slots.`
            : job.outcome === 'done'
              ? `Done — ${job.proposed.length} proposal${job.proposed.length === 1 ? '' : 's'} this run.`
              : job.outcome === 'paused'
                ? `Paused after ${job.done} of ${job.total} slots — resume picks up where it stopped, nothing re-runs.`
                : job.outcome === 'cancelled'
                  ? 'Cancelled — the finished batches are saved.'
                  : `The matcher stopped: ${job.error ?? 'could not save its results.'}`}
        </p>
      )}
      {!getMatcherApiKey() && (
        <p className="help-text">
          No OpenAI key saved — the deterministic passes run, the LLM pass stays off. Add a
          key in Settings for the last-resort pass.
        </p>
      )}
      {pendingSlot && (
        <p className="matcher-pending" role="status">
          Marking “{pendingSlot.name}” yourself — the next marker you save becomes this card’s
          spot. Tap the map to place it.{' '}
          <button
            type="button"
            className="text-button"
            onClick={() => useMatchStore.getState().clearPendingJot()}
          >
            Cancel
          </button>
        </p>
      )}
      {visibleReview.length > 0 && (
        <ul className="matcher-review">
          {visibleReview.map((row) => (
            <li key={row.attempt.id} className="matcher-row">
              <span className="matcher-row-main">
                <strong>
                  {row.slot.name}
                  {row.slot.variant ? <small> · {row.slot.variant}</small> : null}
                </strong>
                <small>
                  {row.hostName} — {row.areaCheck}
                </small>
                <small className="matcher-direction">“{row.direction}”</small>
                {row.directionSourceTitle && (
                  <small>
                    Source:{' '}
                    {row.directionSourceUrl ? (
                      <a href={row.directionSourceUrl} target="_blank" rel="noreferrer">
                        {row.directionSourceTitle}
                      </a>
                    ) : (
                      row.directionSourceTitle
                    )}
                  </small>
                )}
                <small>
                  {row.proposedBy === 'llm' ? 'Proposed by the AI' : 'Proposed deterministically'}
                  {' · '}
                  {Math.round(row.confidence * 100)}% sure · {row.reasoning}
                </small>
                {row.conflictNote && (
                  <small className="matcher-conflict">Conflict: {row.conflictNote}</small>
                )}
              </span>
              <span className="matcher-row-actions">
                {row.candidate ? (
                  <button
                    type="button"
                    className="button"
                    disabled={busyId === row.attempt.id}
                    onClick={() => void confirm(row)}
                  >
                    Confirm
                  </button>
                ) : (
                  <small className="matcher-stale">
                    The map data changed since this was proposed — run the matcher again.
                  </small>
                )}
                <button
                  type="button"
                  className="text-button"
                  disabled={busyId === row.attempt.id}
                  onClick={() => void reject(row)}
                >
                  Not this one
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setSkipped((prev) => new Set([...prev, row.attempt.id]))
                  }
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => armJot(row.slot)}
                >
                  Mark it yourself
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="completion-error" role="alert">
          {error}{' '}
          <button type="button" className="completion-error-dismiss" onClick={() => setError('')}>
            Dismiss
          </button>
        </p>
      )}
    </section>
  );
}
