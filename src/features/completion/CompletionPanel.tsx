/**
 * 100% completion tracker.
 *
 * Aggregate counts only — the 19 categories of the in-game 100%
 * checklist (gta6-leonida-map-data, CC BY 4.0). The user taps +/− as
 * they play; the game itself (Map > Progress > Stats) is the source
 * of truth, the app cannot see what happens in-game, so nothing here
 * is auto-counted. No per-item detail: no mission names, no card
 * locations, no chapter titles — category names and numbers only, so
 * the panel is safe to open with everything else off.
 *
 * Lives in the Layers sheet, right after the county cards: the
 * Combined Stunts row carries the per-county stunt-jump split, and
 * the county cards carry each county's jump count.
 */
import { useEffect, useState } from 'react';
import {
  COMPLETION_REQUIRED_TOTAL,
  COMPLETION_THRESHOLDS,
  overallCompletion,
  stuntJumpsByCounty,
  thresholdProgress,
} from '../../data/completion';
import { useCompletionStore } from './store';

export function CompletionPanel() {
  const counts = useCompletionStore((s) => s.counts);
  const loaded = useCompletionStore((s) => s.loaded);
  const storageError = useCompletionStore((s) => s.storageError);
  const load = useCompletionStore((s) => s.load);
  const adjust = useCompletionStore((s) => s.adjust);
  const resetAll = useCompletionStore((s) => s.resetAll);
  const clearError = useCompletionStore((s) => s.clearError);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!confirmReset) return;
    const timer = window.setTimeout(() => setConfirmReset(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmReset]);

  const overall = overallCompletion(counts);
  const pct = Math.round(overall.pct * 100);
  const countyStunts = stuntJumpsByCounty();

  return (
    <details className="layer-group completion-panel">
      <summary>
        100% completion · {pct}% — {overall.found.toLocaleString()} of{' '}
        {COMPLETION_REQUIRED_TOTAL.toLocaleString()} required
      </summary>
      <p className="panel-intro">
        Tap + as you play — the game&rsquo;s own checklist (Map &gt; Progress &gt; Stats) is the
        source of truth. Counts stay on this device.
      </p>
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
          const progress = thresholdProgress(counts[threshold.id] ?? 0, threshold);
          return (
            <div className="completion-row" key={threshold.id}>
              <div className="completion-row-main">
                <div className="completion-row-head">
                  <span className="completion-row-name">{threshold.name}</span>
                  {progress.done && <span className="completion-done">Done</span>}
                  <span className="completion-row-count">
                    {progress.found} / {threshold.required}
                    {threshold.required < threshold.total
                      ? ` of ${threshold.total} in the game`
                      : ''}
                  </span>
                </div>
                <div
                  className="completion-bar"
                  role="progressbar"
                  aria-label={`${threshold.name} progress`}
                  aria-valuenow={progress.found}
                  aria-valuemin={0}
                  aria-valuemax={threshold.required}
                >
                  <span style={{ width: `${progress.pctRequired * 100}%` }} />
                </div>
                {threshold.note && <p className="completion-row-note">{threshold.note}</p>}
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
              <div className="completion-steppers">
                <button
                  type="button"
                  className="completion-stepper"
                  aria-label={`One fewer ${threshold.name} — ${progress.found} now`}
                  disabled={!loaded || progress.found <= 0}
                  onClick={() => adjust(threshold.id, -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className="completion-stepper"
                  aria-label={`One more ${threshold.name} — ${progress.found} now`}
                  disabled={!loaded || progress.found >= threshold.total}
                  onClick={() => adjust(threshold.id, 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {storageError && (
        <p className="completion-error" role="alert">
          {storageError}{' '}
          <button type="button" className="completion-error-dismiss" onClick={clearError}>
            Dismiss
          </button>
        </p>
      )}
      <div className="completion-footer">
        <button
          type="button"
          className="completion-reset"
          onClick={() => {
            if (confirmReset) {
              resetAll();
              setConfirmReset(false);
            } else {
              setConfirmReset(true);
            }
          }}
        >
          {confirmReset ? 'Tap again to clear all counts' : 'Start over'}
        </button>
        <p className="help-text">
          Targets from gta6-leonida-map-data (gta6maps.io), CC BY 4.0, updated 2026-11-23.
          Completion counts live on this device only — they are not in the Atlas backup yet.
        </p>
      </div>
    </details>
  );
}
