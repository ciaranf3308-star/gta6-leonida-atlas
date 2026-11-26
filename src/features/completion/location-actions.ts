/**
 * Location-card completion actions (v0.32 step 5) — pure derivation.
 *
 * What you can DO at a location depends on what the location IS — its
 * opportunities (DESIGN §3.2), never the app's filing. The card
 * renders these; the only writer is step 2's recordCompletion, called
 * by PlaceDetails. Nothing here writes anything.
 *
 * - `shop` → "Shop here" — an info row, NOT a completion. Shopping
 *   is not a completion, so there is no verb and no record.
 * - `robbery-shop` (on the same location as a shop), `bank-job`,
 *   `gang-op`, `break-in` → "Mark as looted" on THAT opportunity.
 *   All four are repeatable, so the button stays live and the row
 *   shows the looted count ("Looted ×3").
 * - `break-in` → also "Mark as discovered" (the location).
 * - `interior` / `discovery` → "Mark as discovered" and
 *   "Mark as explored" (the location, once each per card — a place
 *   with both an interior and a discovery opportunity still gets one
 *   of each).
 * - any item hosted here → "Mark as collected" per item (a checkbox
 *   in the card's items section — the same record the journal uses).
 *
 * Discovered / explored target the LOCATION, not an opportunity:
 * they are about the place, and the db indexes them by location
 * (discoveredLocationIds). Looted targets the OPPORTUNITY, so the
 * count is per hold-up / job / break-in, not per building.
 *
 * Kinds with no action of their own (gym, workout-equipment, activity,
 * vehicle-loot, easter-egg, mission) still get the fallback below:
 * "Mark as discovered" on the location itself. 'discovered' is an
 * existing model verb targeting the location — finding the place is
 * the completion — so nothing is invented. The fallback fires only
 * when no record or collect action exists yet, so it can never
 * duplicate the discovered row above.
 */
import type {
  CompletionTarget,
  CompletionVerb,
  GameDatabase,
  LocationCardView,
  Opportunity,
  OpportunityKind,
} from '../../domain/game-db';

export type LocationCardAction =
  | {
      key: string;
      kind: 'info';
      /** e.g. "Shop here". */
      label: string;
      /** The opportunity's own label, e.g. "Food & drink shop". */
      detail: string;
    }
  | {
      key: string;
      kind: 'record';
      /** e.g. "Mark as looted". */
      label: string;
      /** The opportunity's own label, or "This place". */
      detail: string;
      target: CompletionTarget;
      verb: CompletionVerb;
      /** One-time verbs only: true once the record exists. Looted
       * is repeatable, so it is never "done" — the count carries it. */
      done: boolean;
      /** What the row shows once done ("Looted ×3", "Discovered ✓"). */
      doneLabel: string;
      /** Looted count (0 when never looted); 1 when a one-time verb is done. */
      count: number;
    }
  | {
      key: string;
      kind: 'collect';
      itemId: string;
      /** The item's name. */
      label: string;
      done: boolean;
    };

function lootedAction(
  opp: Opportunity,
  db: GameDatabase,
): Extract<LocationCardAction, { kind: 'record' }> {
  const count = db.completedOpportunityIds.get(opp.id) ?? 0;
  return {
    key: `loot:${opp.id}`,
    kind: 'record',
    label: 'Mark as looted',
    detail: opp.label,
    target: { type: 'opportunity', id: opp.id },
    verb: 'looted',
    done: false,
    doneLabel: `Looted ×${count}`,
    count,
  };
}

export function locationCardActions(
  view: LocationCardView,
  db: GameDatabase,
): LocationCardAction[] {
  const actions: LocationCardAction[] = [];
  const byKind = (kind: OpportunityKind): Opportunity[] =>
    view.opportunities.filter((opp) => opp.kind === kind);

  const shop = byKind('shop')[0];
  if (shop) {
    actions.push({
      key: 'shop',
      kind: 'info',
      label: 'Shop here',
      detail: shop.label,
    });
  }

  // One "Mark as looted" per repeatable loot opportunity on this
  // location: the hold-up on a shop, a bank job, a gang op, a
  // break-in. At most one per kind — ids are opp:<loc>:<kind>:1.
  for (const kind of ['robbery-shop', 'bank-job', 'gang-op', 'break-in'] as const) {
    for (const opp of byKind(kind)) actions.push(lootedAction(opp, db));
  }

  const discovered = db.discoveredLocationIds.has(view.location.id);
  const explored = db.exploredLocationIds.has(view.location.id);
  const wantsDiscovered =
    byKind('break-in').length > 0 ||
    byKind('interior').length > 0 ||
    byKind('discovery').length > 0;
  const wantsExplored =
    byKind('interior').length > 0 || byKind('discovery').length > 0;
  if (wantsDiscovered) {
    actions.push({
      key: 'discovered',
      kind: 'record',
      label: 'Mark as discovered',
      detail: 'This place',
      target: { type: 'location', id: view.location.id },
      verb: 'discovered',
      done: discovered,
      doneLabel: 'Discovered ✓',
      count: discovered ? 1 : 0,
    });
  }
  if (wantsExplored) {
    actions.push({
      key: 'explored',
      kind: 'record',
      label: 'Mark as explored',
      detail: 'This place',
      target: { type: 'location', id: view.location.id },
      verb: 'explored',
      done: explored,
      doneLabel: 'Explored ✓',
      count: explored ? 1 : 0,
    });
  }

  // Fallback (coordinator ruling, step-6 follow-up): a location whose
  // opportunities carry no verb at all — gym, workout-equipment,
  // activity, vehicle-loot, easter-egg, mission, a shop with no
  // robbery-shop, or no opportunities — still gets one honest action:
  // "Mark as discovered" on the location itself. It only fires when
  // no record or collect action exists yet, so it can never duplicate
  // the discovered row above.
  const hasRecordOrCollect = actions.some(
    (action) => action.kind === 'record' || action.kind === 'collect',
  );
  if (!hasRecordOrCollect) {
    actions.push({
      key: 'discovered',
      kind: 'record',
      label: 'Mark as discovered',
      detail: 'This place',
      target: { type: 'location', id: view.location.id },
      verb: 'discovered',
      done: discovered,
      doneLabel: 'Discovered ✓',
      count: discovered ? 1 : 0,
    });
  }

  for (const item of view.items) {
    actions.push({
      key: `collect:${item.id}`,
      kind: 'collect',
      itemId: item.id,
      label: item.name,
      done: db.completedItemIds.has(item.id),
    });
  }
  return actions;
}
