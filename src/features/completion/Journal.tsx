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
 *   it was found — the host's name, never a scraped face).
 * - Step 7: an unfound, unpositioned card's row carries two more
 *   location helps, BOTH behind the same "Show where to look" tap
 *   (the tap is the consent for that row's location help, same as
 *   the hint): the Vice City Hispano community lead (vch-links —
 *   LINK-ONLY, labelled as an external community report, never our
 *   verified pin; rejected cards show the reason, no link) and the
 *   Find-this-card web-search button (a proposal with sources, never
 *   a placed pin; the player confirms it in the matcher review list).
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
import { FindCardButton } from '../ask/FindCardButton';
import { vchLeadForSlot, vchLeadLabel } from '../ask/vch-links';

export type JournalFilter = 'all' | 'found' | 'remaining' | 'unpositioned';

export const JOURNAL_FILTERS: { id: JournalFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'found', label: 'Found' },
  { id: 'remaining', label: 'Remaining' },
  { id: 'unpositioned', label: 'Unpositioned' },
];

/**
 * The journal's row accounting (v0.32 gang-op follow-up): the header
 * used to say "18 sets, 480 cards in total" while the filter row said
 * "All · 614" — both true, neither explained the other. The 614 rows
 * are the 480 checklist slots + 117 extra game-text tiers (62 filed
 * under their set, 55 with no set) + 17 other collectibles with no
 * set (10 meditations, 5 magazines, 1 watch, 1 WAiNK scan). Pure, so
 * tests can pin the breakdown and the header can never drift from
 * the filter counts again: slots + extras + other === all.
 */
export interface JournalCounts {
  /** Checklist rows in the journal (the "All" filter count). */
  all: number;
  found: number;
  remaining: number;
  unpositioned: number;
  /** In-game checklist slots — the "480 cards". */
  slots: number;
  /** Extra game-text tiers, never checklist slots. */
  extras: number;
  /** Other collectibles with no set (meditations, magazines…). */
  other: number;
}

export function journalCounts(db: GameDatabase | null): JournalCounts {
  const zero: JournalCounts = {
    all: 0,
    found: 0,
    remaining: 0,
    unpositioned: 0,
    slots: 0,
    extras: 0,
    other: 0,
  };
  if (!db) return zero;
  const items = [...db.items.values()];
  return {
    all: items.length,
    found: items.filter((item) => db.completedItemIds.has(item.id)).length,
    remaining: items.filter((item) => !db.completedItemIds.has(item.id)).length,
    unpositioned: items.filter((item) => item.placement !== 'pinned').length,
    slots: items.filter((item) => item.checklistSlot).length,
    extras: items.filter(
      (item) => !item.checklistSlot && item.kind === 'trading-card',
    ).length,
    other: items.filter(
      (item) => !item.checklistSlot && item.kind !== 'trading-card',
    ).length,
  };
}

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
  // Step 7: the community lead for this slot, if the Vice City
  // Hispano review covered it. Link-only, never a pin.
  const vchLead = !found && item.checklistSlot ? vchLeadForSlot(item.id) : null;
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
            {vchLead && (
              <span className="journal-vch-lead">
                {vchLead.status !== 'rejected' ? (
                  <a href={vchLead.sourcePinUrl} target="_blank" rel="noreferrer">
                    {vchLeadLabel(vchLead)}
                  </a>
                ) : (
                  <span>{vchLeadLabel(vchLead)}</span>
                )}
              </span>
            )}
            {item.placement !== 'pinned' && (
              <FindCardButton item={item} db={db} />
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

  const counts = useMemo(() => journalCounts(db), [db]);

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
    // The 55 set-less extra game-text tiers land here (kind
    // 'trading-card', setId null) — name them what they are, not the
    // raw kind id, so the section reads with the header accounting.
    'trading-card': 'Extra game-text tiers',
    other: 'Other collectibles',
  };

  return (
    <section className="journal" aria-label="Collections journal">
      <h3>Trading cards</h3>
      <p className="panel-intro">
        {sets.length} sets, {counts.slots} card slots in total — no set is hidden for
        being unmapped. A card with no verified spot still lists here; its hint stays
        hidden until you tap “Show where to look” on that card.
      </p>
      <p className="panel-intro">
        All lists {counts.all} rows: the {counts.slots} slots, {counts.extras} extra
        game-text tiers, and {counts.other} other collectibles.
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
