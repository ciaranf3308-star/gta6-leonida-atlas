/**
 * Place-level views over the completion log (v0.32 step 6).
 *
 * The map, the find filters, SavedPlaces and Ask all used to read the
 * old visited/explored tables (`leonida-completion-v1` / the Dexie
 * `visited` + `explored` tables). Those tables froze when step 6
 * replaced the store: the completion log is canonical now, and these
 * pure selectors are the ONLY bridge from the log back to place ids —
 * every reader goes through them, so a mark made in the journal and
 * a mark made on the map can never disagree.
 *
 * Found (a place whose thing is got) vs explored (a place the player
 * has been to) stay separate, exactly as the old store kept them:
 * - found: a `discovered` record on the location, a `collected` item
 *   hosted there (or the item itself — loot items ARE places), or a
 *   `looted` opportunity on it. The old `card:*` place ids resolve
 *   through `legacyItemIds`, so a collected Vicki still dims the
 *   `card:vicki` pin and hides under "Hide completed".
 * - explored: an `explored` record on the location (or, via the host,
 *   on an item that lives there). Explored is NOT found — the
 *   "Hide completed" filter never hides a place that was only
 *   explored, same as the old store.
 *
 * The old visited/explored tables stay intact as an audit trail;
 * nothing here reads them.
 */
import type {
  CollectibleItem,
  CompletionRecord,
  GameDatabase,
  OverallView,
} from '../../domain/game-db';
import { COMPLETION_THRESHOLDS } from '../../data/completion';

/** Place ids the log marks as found — the set MapView dims, the
 * find filters hide under "Hide completed", and Ask leaves out. */
export function completedPlaceIds(db: GameDatabase): ReadonlySet<string> {
  const found = new Set<string>();
  for (const id of db.discoveredLocationIds) found.add(id);
  for (const itemId of db.completedItemIds) {
    const item = db.items.get(itemId);
    if (!item) continue;
    // A loot item's id IS its place id (meditations, magazines).
    found.add(itemId);
    if (item.locationId) found.add(item.locationId);
  }
  // Old catalogue ids for collected checklist items (`card:vicki` →
  // the checklist item) — the pin for the old id dims too.
  for (const [legacyId, itemId] of db.legacyItemIds) {
    if (db.completedItemIds.has(itemId)) found.add(legacyId);
  }
  for (const oppId of db.completedOpportunityIds.keys()) {
    const opp = db.opportunities.get(oppId);
    if (opp) found.add(opp.locationId);
  }
  return found;
}

/** Place ids the log marks as explored — the set MapView renders
 * with explored styling. Location ids plus, for symmetry with
 * completedPlaceIds, the old catalogue ids of items hosted on an
 * explored location. */
export function exploredPlaceIds(db: GameDatabase): ReadonlySet<string> {
  const explored = new Set<string>(db.exploredLocationIds);
  for (const item of db.items.values()) {
    if (item.locationId && db.exploredLocationIds.has(item.locationId)) {
      explored.add(item.id);
    }
  }
  for (const [legacyId, itemId] of db.legacyItemIds) {
    const item = db.items.get(itemId);
    if (item?.locationId && db.exploredLocationIds.has(item.locationId)) {
      explored.add(legacyId);
    }
  }
  return explored;
}

/** The `collected` record for one item, if any — the journal's undo
 * target and the source of the found date. A second `collected` can
 * never exist (recordCompletion is idempotent for one-time verbs),
 * so the first match is the record. */
export function collectedRecordFor(
  db: GameDatabase,
  itemId: string,
): CompletionRecord | undefined {
  return db.records.find(
    (record) =>
      record.target.type === 'item' &&
      record.target.id === itemId &&
      record.verb === 'collected' &&
      record.count > 0,
  );
}

/** The latest still-standing `looted` record for one opportunity —
 * the undo target for a "Looted ×N" row. Any +1 record undoes one
 * loot (undo appends a -1 compensating record); compensating
 * records (count < 0) are themselves undos and are never a target.
 * When the net count is 0 — every loot already undone — there is
 * nothing to undo, so this returns undefined even though the +1
 * records are still in the log (they are the audit trail, and
 * undoing one would drive the net negative). */
export function latestLootedRecordFor(
  db: GameDatabase,
  opportunityId: string,
): CompletionRecord | undefined {
  let net = 0;
  for (const record of db.records) {
    if (
      record.target.type === 'opportunity' &&
      record.target.id === opportunityId &&
      record.verb === 'looted'
    ) {
      net += record.count;
    }
  }
  if (net <= 0) return undefined;
  for (let i = db.records.length - 1; i >= 0; i -= 1) {
    const record = db.records[i]!;
    if (
      record.target.type === 'opportunity' &&
      record.target.id === opportunityId &&
      record.verb === 'looted' &&
      record.count > 0
    ) {
      return record;
    }
  }
  return undefined;
}

/** Net looted count for one opportunity — the "Looted ×N" number.
 * Positive only: a net of 0 or less means nothing stands. */
export function netLootedCount(db: GameDatabase, opportunityId: string): number {
  let net = 0;
  for (const record of db.records) {
    if (
      record.target.type === 'opportunity' &&
      record.target.id === opportunityId &&
      record.verb === 'looted'
    ) {
      net += record.count;
    }
  }
  return net;
}

/** Date + time for a record's original `at` timestamp — the
 * timestamp is shown as recorded, never re-stamped on restore or
 * undo (the compensating record carries its own `at`). */
export function formatRecordDate(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return `${date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })}, ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

/** Plain-words description of one completion record — what was
 * done, where, and (via formatRecordDate) when. Names come from
 * the database; an id with no database row (a migrated record
 * whose target no longer exists) shows the id itself — the record
 * is the audit trail and is never dropped for being unresolvable. */
export function describeCompletionRecord(
  db: GameDatabase,
  record: CompletionRecord,
): { verbLabel: string; targetLabel: string; detail: string | null } {
  if (record.verb === 'looted' && record.count < 0) {
    const target = record.target;
    const base =
      target.type === 'opportunity'
        ? describeOpportunity(db, target.id)
        : target.type === 'location'
          ? (db.locations.get(target.id)?.name ?? target.id)
          : (db.items.get(target.id)?.name ?? target.id);
    return { verbLabel: 'Undid loot', targetLabel: base, detail: null };
  }
  switch (record.target.type) {
    case 'item': {
      const item = db.items.get(record.target.id);
      const setName = item?.setId ? (db.sets.get(item.setId)?.name ?? null) : null;
      const hostName = item?.locationId
        ? (db.locations.get(item.locationId)?.name ?? null)
        : null;
      return {
        verbLabel: 'Collected',
        targetLabel: item?.name ?? record.target.id,
        detail: [setName, hostName].filter(Boolean).join(' · ') || null,
      };
    }
    case 'opportunity': {
      const opp = db.opportunities.get(record.target.id);
      const locationName = opp
        ? (db.locations.get(opp.locationId)?.name ?? null)
        : null;
      return {
        verbLabel:
          record.verb === 'looted'
            ? `Looted${record.count > 1 ? ` ×${record.count}` : ''}`
            : record.verb === 'discovered'
              ? 'Discovered'
              : 'Explored',
        targetLabel: opp?.label ?? record.target.id,
        detail: locationName,
      };
    }
    case 'location': {
      const location = db.locations.get(record.target.id);
      return {
        verbLabel: record.verb === 'discovered' ? 'Discovered' : 'Explored',
        targetLabel: location?.name ?? record.target.id,
        detail: null,
      };
    }
  }
}

function describeOpportunity(db: GameDatabase, opportunityId: string): string {
  const opp = db.opportunities.get(opportunityId);
  if (!opp) return opportunityId;
  const locationName = db.locations.get(opp.locationId)?.name;
  return locationName ? `${opp.label} · ${locationName}` : opp.label;
}

/** One render row per completion record, newest first — the pure
 * builder behind the Recent activity list, so the list's content
 * (what / where / when / undoable) is unit-testable without
 * driving the component. A compensating record (count < 0) is a
 * row of its own — the undo stays visible in the log — but it is
 * never itself undoable. */
export interface CompletionRecordRow {
  recordId: string;
  verbLabel: string;
  targetLabel: string;
  detail: string | null;
  /** The record's original `at`, formatted — never re-stamped. */
  dateLabel: string;
  canUndo: boolean;
}

export function recordListRows(db: GameDatabase): CompletionRecordRow[] {
  return [...db.records].reverse().map((record) => {
    const described = describeCompletionRecord(db, record);
    // A looted +1 row offers Undo only while a loot still stands
    // for that opportunity — once every loot is undone (net 0) the
    // +1 rows stay as audit trail, with no Undo button.
    const canUndo =
      record.count > 0 &&
      !(
        record.target.type === 'opportunity' &&
        record.verb === 'looted' &&
        netLootedCount(db, record.target.id) <= 0
      );
    return {
      recordId: record.id,
      verbLabel: described.verbLabel,
      targetLabel: described.targetLabel,
      detail: described.detail,
      dateLabel: formatRecordDate(record.at),
      canUndo,
    };
  });
}

/** Estimated coverage (DESIGN §4.1, third number): what the
 * companion can infer from pinned positions. The pinned fraction is
 * NOT a completion fraction and is never presented as one. */
export function estimatedCoverage(db: GameDatabase): {
  pinnedItems: number;
  totalItems: number;
  foundItems: number;
  pinnedSets: number;
  totalSets: number;
} {
  const checklistItems = [...db.items.values()].filter((item) => item.checklistSlot);
  const pinnedItems = checklistItems.filter((item) => item.placement === 'pinned').length;
  const foundItems = checklistItems.filter((item) =>
    db.completedItemIds.has(item.id),
  ).length;
  let pinnedSets = 0;
  for (const set of db.sets.values()) {
    if (
      set.itemIds.length > 0 &&
      set.itemIds.every((id) => db.items.get(id)?.placement === 'pinned')
    ) {
      pinnedSets += 1;
    }
  }
  return {
    pinnedItems,
    totalItems: checklistItems.length,
    foundItems,
    pinnedSets,
    totalSets: db.sets.size,
  };
}

/** Split the overall total into its two counted halves (DESIGN
 * §4.3): what came from the player's finds (derived basis) vs what
 * came from the in-game stats (reconciled basis). The sum is the
 * overall `found` — never derived + reconciled for the same
 * category, because each category contributes its displayed value
 * exactly once. */
export function splitOverall(overall: OverallView): {
  recorded: number;
  reconciled: number;
} {
  let recorded = 0;
  let reconciled = 0;
  for (const category of overall.categories) {
    const capped = Math.min(category.displayed, category.required);
    if (category.basis === 'derived') recorded += capped;
    else reconciled += capped;
  }
  return { recorded, reconciled };
}

/** How many record-level items of one kind the database actually
 * carries — the honest denominator behind a derived category. The
 * meditation gap (DESIGN open question, step-6 handoff): the
 * checklist requires 15, the data lists 10. */
export function itemsOfKind(db: GameDatabase, kind: CollectibleItem['kind']): number {
  let count = 0;
  for (const item of db.items.values()) {
    if (item.kind === kind) count += 1;
  }
  return count;
}

/** The 19 thresholds, in the checklist's order — the Progress rows. */
export function progressThresholds() {
  return COMPLETION_THRESHOLDS;
}
