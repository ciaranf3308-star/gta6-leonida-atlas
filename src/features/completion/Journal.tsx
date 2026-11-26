/**
 * The Collections journal (v0.32 step 6, DESIGN §3.5 + §8).
 *
 * Every set, every item — sets are never hidden for being unmapped.
 * The found checkbox IS the same record as the map pin: it calls
 * step 2's recordCompletion (never changed), and the rebuilt database
 * it returns is adopted by the log store, so the pin dims and the
 * Progress tab move in the same write. Unchecking undoes the record
 * (undoCompletion deletes it — the same one-write rule).
 *
 * Spoiler gating (§3.5, normative):
 * - A journal row for an unpinned item shows name, set, variant,
 *   checkbox — nothing else. Its spotDescription and areaLead sit
 *   behind an explicit "Show where to look" tap on THAT row; the tap
 *   IS the consent (same as today's reveal rule): it reveals that
 *   one item's hint, for now, and never reveals its set-mates.
 * - Pinned items are gated the same way: the pin is off by default
 *   and the host is a spoiler until the player asks. "Show on map"
 *   is the same tap's companion, not a second reveal.
 * - Artwork: null for everything (addendum §3.3 — no licence for
 *   official art, and no fake card faces ever). An uncollected card
 *   shows name + a generic silhouette only; a collected card shows
 *   the collected treatment (gold border + ✓ + found date + the spot
 *   it was found — the host's name, never a scraped face). No
 *   fbrito/external links are wired here — that is step 7's matcher
 *   lane; the row structure carries no link slot yet.
 * - The 116 non-slot game-text variants (addendum §1.1) list under
 *   "Also in the game files" per set — never counted toward the set,
 *   never counted in Progress.
 *
 * Filters: all / found / remaining / unpositioned (DESIGN §8).
 * "Unpositioned" is placement other than pinned — area-known +
 * unmapped. The filter never hides a set: an empty set still shows
 * its cover with 0 found.
 */
import { useMemo, useState } from 'react';
import {
  setProgress,
  type CollectibleItem,
  type GameDatabase,
} from '../../domain/game-db';
import { collectedRecordFor } from './place-ids';
import { recordCompletion, undoCompletion } from './record';
import { useCompletionLogStore } from './log-store';

export type JournalFilter = 'all' | 'found' | 'remaining' | 'unpositioned';

export const JOURNAL_FILTERS: { id: JournalFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'found', label: 'Found' },
  { id: 'remaining', label: 'Remaining' },
  { id: 'unpositioned', label: 'Unpositioned' },
];

/** The hint for one item: null until its own row's tap reveals it.
 * Pure, so tests can pin the gating without driving the component. */
export function hintForItem(
  item: CollectibleItem,
  revealed: ReadonlySet<string>,
): { areaLead: string | null; spotDescription: string | null } | null {
  if (!revealed.has(item.id)) return null;
  return { areaLead: item.areaLead, spotDescription: item.spotDescription };
}

function itemMatchesFilter(
  item: CollectibleItem,
  found: boolean,
  filter: JournalFilter,
): boolean {
  switch (filter) {
    case 'found':
      return found;
    case 'remaining':
      return !found;
    case 'unpositioned':
      return item.placement !== 'pinned';
    case 'all':
    default:
      return true;
  }
}

function formatFoundDate(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function JournalRow({
  item,
  db,
  revealed,
  busy,
  onReveal,
  onToggle,
  onSelectPlace,
}: {
  item: CollectibleItem;
  db: GameDatabase;
  revealed: ReadonlySet<string>;
  busy: boolean;
  onReveal: (itemId: string) => void;
  onToggle: (item: CollectibleItem) => void;
  onSelectPlace?: (locationId: string) => void;
}) {
  const found = db.completedItemIds.has(item.id);
  const hint = hintForItem(item, revealed);
  const record = found ? collectedRecordFor(db, item.id) : undefined;
  const hostName = item.locationId
    ? (db.locations.get(item.locationId)?.name ?? null)
    : null;
  return (
    <li className={`journal-row ${found ? 'is-found' : ''}`}>
      <span className="journal-silhouette" aria-hidden="true">
        {found ? '✓' : ''}
      </span>
      <span className="journal-row-main">
        <label className="journal-row-label">
          <input
            type="checkbox"
            checked={found}
            disabled={busy}
            onChange={() => onToggle(item)}
            aria-label={`Mark ${item.name}${item.variant ? ` (${item.variant})` : ''} as collected`}
          />
          <span className="journal-row-name">
            {item.name}
            {item.variant ? <small> · {item.variant}</small> : null}
          </span>
        </label>
        {found && (
          <small className="journal-row-found">
            Collected ✓
            {record ? ` · ${formatFoundDate(record.at)}` : ''}
            {hostName ? ` · ${hostName}` : ''}
          </small>
        )}
        {!found && hint === null && (
          <button
            type="button"
            className="text-button journal-hint-toggle"
            disabled={busy}
            onClick={() => onReveal(item.id)}
          >
            Show where to look
          </button>
        )}
        {!found && hint !== null && (
          <span className="journal-hint">
            {hint.areaLead ?? hint.spotDescription ? (
              <>
                {hint.areaLead ? <span>{hint.areaLead}</span> : null}
                {hint.spotDescription ? <span>{hint.spotDescription}</span> : null}
              </>
            ) : (
              <span>No spot published for this card yet.</span>
            )}
            {item.locationId && onSelectPlace && (
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectPlace(item.locationId!)}
              >
                Show on map
              </button>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

export function Journal({
  db,
  onSelectPlace,
  initialFilter = 'all',
  initialRevealedIds = [],
}: {
  db: GameDatabase | null;
  onSelectPlace?: (locationId: string) => void;
  initialFilter?: JournalFilter;
  initialRevealedIds?: readonly string[];
}) {
  const [filter, setFilter] = useState<JournalFilter>(initialFilter);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(
    () => new Set(initialRevealedIds),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const counts = useMemo(() => {
    if (!db) return { all: 0, found: 0, remaining: 0, unpositioned: 0 };
    const items = [...db.items.values()];
    return {
      all: items.length,
      found: items.filter((item) => db.completedItemIds.has(item.id)).length,
      remaining: items.filter((item) => !db.completedItemIds.has(item.id)).length,
      unpositioned: items.filter((item) => item.placement !== 'pinned').length,
    };
  }, [db]);

  async function toggle(item: CollectibleItem) {
    if (!db || busyId) return;
    setBusyId(item.id);
    setError('');
    const found = db.completedItemIds.has(item.id);
    if (found) {
      const record = collectedRecordFor(db, item.id);
      if (!record) {
        setBusyId(null);
        setError(`Could not unmark "${item.name}" — its record is missing. Nothing was changed.`);
        return;
      }
      const result = await undoCompletion(record.id);
      setBusyId(null);
      if (result.ok && result.db) {
        useCompletionLogStore.getState().applyDb(result.db);
      } else {
        setError(result.error ?? 'Could not save that — try again.');
      }
      return;
    }
    const result = await recordCompletion({
      target: { type: 'item', id: item.id },
      verb: 'collected',
    });
    setBusyId(null);
    if (result.ok && result.db) {
      useCompletionLogStore.getState().applyDb(result.db);
    } else {
      setError(result.error ?? 'Could not save that — try again.');
    }
  }

  if (!db) {
    return (
      <section className="journal" aria-label="Collections journal">
        <h3>Trading cards</h3>
        <p className="empty-state">Collections load with the map…</p>
      </section>
    );
  }

  const sets = [...db.sets.values()];
  const otherItems = [...db.items.values()].filter((item) => item.setId === null);
  const otherByKind = new Map<string, CollectibleItem[]>();
  for (const item of otherItems) {
    const list = otherByKind.get(item.kind) ?? [];
    otherByKind.set(item.kind, [...list, item]);
  }
  const kindLabels: Record<string, string> = {
    meditation: 'Meditation spots',
    magazine: 'Magazines, books & comics',
    flamingo: 'Cocaine flamingos',
    'waink-scan': 'WAiNK landmark scans',
    underwater: 'Underwater discoveries',
    watch: 'Watches',
    earbuds: 'Earbuds',
    other: 'Other collectibles',
  };

  return (
    <section className="journal" aria-label="Collections journal">
      <h3>Trading cards</h3>
      <p className="panel-intro">
        18 sets, 480 cards in total — no set is hidden for being unmapped. A card with no
        verified spot still lists here; its hint stays hidden until you tap “Show where to
        look” on that card.
      </p>
      <div className="journal-filters" role="group" aria-label="Filter journal items">
        {JOURNAL_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`journal-filter ${filter === option.id ? 'is-active' : ''}`}
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label} · {counts[option.id]}
          </button>
        ))}
      </div>
      {sets.map((set) => {
        const progress = setProgress(db, set.id);
        const items = set.itemIds
          .map((id) => db.items.get(id)!)
          .filter((item) => itemMatchesFilter(item, db.completedItemIds.has(item.id), filter));
        const extras = [...db.items.values()]
          .filter((item) => item.setId === set.id && !item.checklistSlot)
          .filter((item) => itemMatchesFilter(item, db.completedItemIds.has(item.id), filter));
        return (
          <details className="layer-group journal-set" key={set.id}>
            <summary>
              {set.name} · {progress.found} / {progress.total} found
              {set.sizeDisputed
                ? ` · size disputed ${set.sizeDisputed.low} vs ${set.sizeDisputed.high}`
                : ''}
            </summary>
            {items.length === 0 && extras.length === 0 ? (
              <p className="empty-state">Nothing in this set matches this filter.</p>
            ) : (
              <ul className="journal-items">
                {items.map((item) => (
                  <JournalRow
                    key={item.id}
                    item={item}
                    db={db}
                    revealed={revealed}
                    busy={busyId === item.id}
                    onReveal={(itemId) =>
                      setRevealed((prev) => new Set([...prev, itemId]))
                    }
                    onToggle={(rowItem) => void toggle(rowItem)}
                    onSelectPlace={onSelectPlace}
                  />
                ))}
              </ul>
            )}
            {extras.length > 0 && (
              <details className="journal-extras">
                <summary>
                  Also in the game files ({extras.length}) — not checklist slots, never counted
                </summary>
                <ul className="journal-items">
                  {extras.map((item) => (
                    <JournalRow
                      key={item.id}
                      item={item}
                      db={db}
                      revealed={revealed}
                      busy={busyId === item.id}
                      onReveal={(itemId) =>
                        setRevealed((prev) => new Set([...prev, itemId]))
                      }
                      onToggle={(rowItem) => void toggle(rowItem)}
                      onSelectPlace={onSelectPlace}
                    />
                  ))}
                </ul>
              </details>
            )}
          </details>
        );
      })}
      {otherByKind.size > 0 && (
        <>
          <div className="section-label">Other collectibles</div>
          {[...otherByKind.entries()].map(([kind, items]) => {
            const visible = items.filter((item) =>
              itemMatchesFilter(item, db.completedItemIds.has(item.id), filter),
            );
            const foundCount = items.filter((item) =>
              db.completedItemIds.has(item.id),
            ).length;
            return (
              <details className="layer-group journal-set" key={kind}>
                <summary>
                  {kindLabels[kind] ?? kind} · {foundCount} / {items.length} found
                </summary>
                {visible.length === 0 ? (
                  <p className="empty-state">Nothing here matches this filter.</p>
                ) : (
                  <ul className="journal-items">
                    {visible.map((item) => (
                      <JournalRow
                        key={item.id}
                        item={item}
                        db={db}
                        revealed={revealed}
                        busy={busyId === item.id}
                        onReveal={(itemId) =>
                          setRevealed((prev) => new Set([...prev, itemId]))
                        }
                        onToggle={(rowItem) => void toggle(rowItem)}
                        onSelectPlace={onSelectPlace}
                      />
                    ))}
                  </ul>
                )}
              </details>
            );
          })}
        </>
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
