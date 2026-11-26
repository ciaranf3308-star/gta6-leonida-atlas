/**
 * Recent activity — the individual completion-log records, newest
 * first (v0.32 step-9 follow-up, Demo D step 2): what was done,
 * where, and when (the record's original `at`). Before this the
 * Progress "Recorded" section showed only the summary ("N records
 * in the log"); the records themselves were consumed by derivation
 * and the summary only. This is also the home for per-record undo
 * (Demo B step 3): every row that can be undone carries an Undo
 * button — a looted record undoes via the -1 compensating record,
 * a one-time record undoes by deletion (undoCompletion, the same
 * one-write rule as the journal). A compensating record shows as
 * its own "Undid loot" row and is never itself undoable.
 */
import { useState } from 'react';
import type { GameDatabase } from '../../domain/game-db';
import { recordListRows } from './place-ids';
import { undoCompletion } from './record';
import { useCompletionLogStore } from './log-store';

export function RecordList({ db }: { db: GameDatabase | null }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!db) {
    return (
      <div className="record-list" aria-label="Recent activity">
        <div className="section-label">Recent activity</div>
        <p className="empty-state">Your records load with the map…</p>
      </div>
    );
  }

  const rows = recordListRows(db);

  async function undo(recordId: string) {
    if (busyId) return;
    setBusyId(recordId);
    setError('');
    const result = await undoCompletion(recordId);
    setBusyId(null);
    if (result.ok && result.db) {
      useCompletionLogStore.getState().applyDb(result.db);
    } else {
      setError(result.error ?? 'Could not undo that — try again.');
    }
  }

  return (
    <div className="record-list" aria-label="Recent activity">
      <div className="section-label">Recent activity</div>
      {rows.length === 0 ? (
        <p className="empty-state">
          Nothing recorded yet — mark a card collected, loot a place, or explore somewhere
          and it shows up here, with the date.
        </p>
      ) : (
        <ul className="record-rows">
          {rows.map((row) => (
            <li key={row.recordId} className="record-row">
              <span className="record-row-main">
                <strong>{row.verbLabel}</strong>
                <span className="record-row-target">
                  {row.targetLabel}
                  {row.detail ? <small> · {row.detail}</small> : null}
                </span>
                <small className="record-row-date">{row.dateLabel}</small>
              </span>
              {row.canUndo && (
                <button
                  type="button"
                  className="text-button record-undo"
                  disabled={busyId !== null}
                  onClick={() => void undo(row.recordId)}
                  aria-label={`Undo ${row.verbLabel} — ${row.targetLabel}`}
                >
                  {busyId === row.recordId ? 'Undoing…' : 'Undo'}
                </button>
              )}
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
    </div>
  );
}
