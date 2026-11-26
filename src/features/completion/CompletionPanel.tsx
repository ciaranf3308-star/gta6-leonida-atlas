/**
 * 100% completion dashboard (v0.32 step 6, DESIGN §4) — the old
 * localStorage tally panel, replaced.
 *
 * The old panel read `useCompletionStore` (`leonida-completion-v1`):
 * after the v3→v4 migration deleted that key it read 0 tallies — the
 * known step-2 consequence this step fixes. The dashboard now reads
 * the completion log through `GameDatabase` (App builds it from the
 * log store), so it can never disagree with the journal or the map.
 *
 * Three numbers, never conflated, in separate rows with the basis
 * labelled on each (§4.1):
 * - Recorded — CompletionRecords, the only number that can ever be
 *   called "done". The sum of the derived-basis categories' displayed
 *   values (capped per category).
 * - Reconciled — ReconciliationEntry's, labelled "from your in-game
 *   stats". The sum of the reconciled-basis categories.
 * - Estimated — derived coverage (cards pinned vs the 480 checklist).
 *   The pinned fraction is NOT a completion fraction and is never
 *   presented as one.
 * The overall % is recorded + reconciled against the 1,325 required
 * (19 categories), computed exactly as overallCompletion() does —
 * capped per category, so over-finding one category cannot mask
 * another. The §4.3 no-double-counting rule lives in
 * categoryProgress() (game-db.ts): a superseded entry is shown, not
 * counted, and the overall total is the sum of the displayed values.
 *
 * Reconciliation inputs: one number per category, typed from the
 * in-game Progress screen (the only basis a manual tally may have).
 * Writing one never changes a derived row's displayed value — the
 * entry is stored and shown as superseded.
 *
 * OPEN QUESTION, carried as an honest gap, not resolved by inventing
 * data: the checklist requires 15 meditation spots but our data
 * lists 10 (completion.ts vs the Loot Map meditation pins) — 5 spots
 * unaccounted for. The meditation row says so.
 */
import { useState } from 'react';
import {
  COMPLETION_REQUIRED_TOTAL,
  COMPLETION_THRESHOLDS,
  clampFound,
  stuntJumpsByCounty,
} from '../../data/completion';
import {
  categoryProgress,
  overallProgress,
  setProgress,
  type GameDatabase,
} from '../../domain/game-db';
import { estimatedCoverage, itemsOfKind, splitOverall } from './place-ids';
import { useCompletionLogStore } from './log-store';

function ReconciliationInput({
  categoryId,
  categoryName,
  current,
  max,
}: {
  categoryId: string;
  categoryName: string;
  current: number;
  max: number;
}) {
  const [value, setValue] = useState(String(current));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
      setError(`Enter a whole number between 0 and ${max}.`);
      setSaved(false);
      return;
    }
    setBusy(true);
    setError('');
    setSaved(false);
    const result = await useCompletionLogStore
      .getState()
      .saveReconciliation(categoryId, parsed);
    setBusy(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.error ?? 'Could not save that count — try again.');
    }
  }
  return (
    <span className="completion-reconcile">
      <label>
        <span className="sr-only">In-game count for {categoryName}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          disabled={busy}
          onChange={(event) => {
            setValue(event.target.value);
            setSaved(false);
          }}
          onBlur={() => {
            if (value !== String(current)) void save();
          }}
          aria-label={`In-game count for ${categoryName}`}
        />
      </label>
      {saved && <span className="completion-saved">Saved</span>}
      {error && (
        <span className="completion-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

export function CompletionPanel({ db }: { db: GameDatabase | null }) {
  const overall = db ? overallProgress(db) : null;
  const pct = overall ? Math.round(overall.pct * 100) : 0;
  const countyStunts = stuntJumpsByCounty();

  if (!db || !overall) {
    return (
      <details className="layer-group completion-panel" open>
        <summary>100% completion · {pct}%</summary>
        <p className="panel-intro">Your progress loads with the map…</p>
      </details>
    );
  }

  const split = splitOverall(overall);
  const coverage = estimatedCoverage(db);
  const meditationItems = itemsOfKind(db, 'meditation');
  const meditationThreshold = COMPLETION_THRESHOLDS.find((t) => t.id === 'meditation')!;

  return (
    <details className="layer-group completion-panel" open>
      <summary>
        100% completion · {pct}% — {overall.found.toLocaleString()} of{' '}
        {COMPLETION_REQUIRED_TOTAL.toLocaleString()} required
      </summary>
      <p className="panel-intro">
        The game&rsquo;s own checklist (Map &gt; Progress &gt; Stats) is the source of truth.
        Three numbers, never mixed: what you did, what you typed from the in-game counter,
        and what the map can infer.
      </p>
      <div className="completion-totals">
        <div className="completion-total-row">
          <span className="completion-total-name">
            Recorded
            <small>from your finds — CompletionRecords, the only number that can be called “done”</small>
          </span>
          <span className="completion-total-count">
            {split.recorded.toLocaleString()} of {COMPLETION_REQUIRED_TOTAL.toLocaleString()}
            <small>{db.records.length} records in the log</small>
          </span>
        </div>
        <div className="completion-total-row">
          <span className="completion-total-name">
            Reconciled
            <small>from your in-game stats — numbers typed from the in-game Progress screen</small>
          </span>
          <span className="completion-total-count">
            {split.reconciled.toLocaleString()} of {COMPLETION_REQUIRED_TOTAL.toLocaleString()}
            <small>{db.reconciliation.length} entries</small>
          </span>
        </div>
        <div className="completion-total-row">
          <span className="completion-total-name">
            Estimated
            <small>
              derived coverage — the pinned fraction is not a completion fraction
            </small>
          </span>
          <span className="completion-total-count">
            {coverage.pinnedItems} of {coverage.totalItems} cards pinned
            <small>
              {coverage.pinnedSets} of {coverage.totalSets} sets fully pinned ·{' '}
              {coverage.foundItems} cards found
            </small>
          </span>
        </div>
      </div>
      <div
        className="completion-bar completion-bar--overall"
        role="progressbar"
        aria-label="Overall completion"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${overall.pct * 100}%` }} />
      </div>
      <p className="completion-overall-note">
        {overall.doneCategories} of {COMPLETION_THRESHOLDS.length} categories done · 100% is
        &ldquo;The Long Road&rdquo;
      </p>
      <div className="completion-rows">
        {COMPLETION_THRESHOLDS.map((threshold) => {
          const view = categoryProgress(db, threshold.id);
          const done = view.displayed >= view.required;
          return (
            <div className="completion-row" key={threshold.id}>
              <div className="completion-row-main">
                <div className="completion-row-head">
                  <span className="completion-row-name">{threshold.name}</span>
                  {done && <span className="completion-done">Done</span>}
                  <span className="completion-row-count">
                    {view.displayed} / {threshold.required}
                    {threshold.required < threshold.total
                      ? ` of ${threshold.total} in the game`
                      : ''}
                  </span>
                </div>
                <div
                  className="completion-bar"
                  role="progressbar"
                  aria-label={`${threshold.name} progress`}
                  aria-valuenow={view.displayed}
                  aria-valuemin={0}
                  aria-valuemax={threshold.required}
                >
                  <span
                    style={{
                      width: `${threshold.required === 0 ? 100 : Math.min(100, (view.displayed / threshold.required) * 100)}%`,
                    }}
                  />
                </div>
                <p className="completion-row-note">
                  {view.basis === 'derived' ? 'from your finds' : 'from your in-game stats'}
                  {view.superseded
                    ? ` · in-game count ${view.reconciledCount} — superseded by your finds, shown not counted`
                    : ''}
                </p>
                {threshold.note && <p className="completion-row-note">{threshold.note}</p>}
                {view.sizeDisputed && (
                  <p className="completion-row-note">
                    Total disputed: {view.sizeDisputed.low} vs {view.sizeDisputed.high} —{' '}
                    {view.sizeDisputed.note}
                  </p>
                )}
                {threshold.id === 'meditation' &&
                  meditationItems < meditationThreshold.total && (
                    <p className="completion-row-note">
                      Gap, not a guess: our data lists {meditationItems} meditation spots; the
                      checklist requires {meditationThreshold.total} —{' '}
                      {meditationThreshold.total - meditationItems} spots unaccounted for, and
                      the derived count can never pass {meditationItems} until a source names
                      them.
                    </p>
                  )}
                {threshold.id === 'stunts' && (
                  <p className="completion-row-note">
                    {threshold.breakdown
                      ?.map((part) => `${part.count} ${part.label.toLowerCase()}`)
                      .join(' · ')}
                    <br />
                    {countyStunts.map((county) => `${county.name} ${county.jumps}`).join(' · ')}
                  </p>
                )}
              </div>
              <ReconciliationInput
                key={`${threshold.id}:${view.reconciledCount}`}
                categoryId={threshold.id}
                categoryName={threshold.name}
                current={clampFound(view.reconciledCount, threshold)}
                max={threshold.total}
              />
            </div>
          );
        })}
      </div>
      <div className="section-label">Progress by set</div>
      <div className="completion-rows">
        {[...db.sets.values()].map((set) => {
          const progress = setProgress(db, set.id);
          const pctSet =
            progress.total === 0 ? 0 : Math.round((progress.found / progress.total) * 100);
          return (
            <div className="completion-row" key={set.id}>
              <div className="completion-row-main">
                <div className="completion-row-head">
                  <span className="completion-row-name">{set.name}</span>
                  <span className="completion-row-count">
                    {progress.found} / {progress.total} cards
                  </span>
                </div>
                <div
                  className="completion-bar"
                  role="progressbar"
                  aria-label={`${set.name} progress`}
                  aria-valuenow={progress.found}
                  aria-valuemin={0}
                  aria-valuemax={progress.total}
                >
                  <span style={{ width: `${pctSet}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="completion-footer">
        <p className="help-text">
          Targets from gta6-leonida-map-data (gta6maps.io), CC BY 4.0, updated 2026-11-23.
          Counts live on this device only — the completion log is in the Atlas backup (v4).
        </p>
      </div>
    </details>
  );
}
