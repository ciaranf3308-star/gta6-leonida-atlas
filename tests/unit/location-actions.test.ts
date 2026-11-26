import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { GANG_OP_PLACES } from '../../src/data/gang-operations';
import {
  buildGameDatabase,
  locationCard,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import { locationCardActions, type LocationCardAction } from '../../src/features/completion/location-actions';
import { EMPTY_USER_DATA } from '../../src/domain/types';

type RecordAction = Extract<LocationCardAction, { kind: 'record' }>;
function recordActions(actions: LocationCardAction[]): RecordAction[] {
  return actions.filter((action): action is RecordAction => action.kind === 'record');
}

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const places = catalogueFromSnapshot(snapshot);

function buildDb(overrides: { records?: CompletionRecord[] } = {}): GameDatabase {
  return buildGameDatabase({ places, ...overrides });
}

describe('locationCardActions — vehicle-loot is looted, with its code on the row (Demo C)', () => {
  it('Brooks Boatworks offers Mark as looted on BOTH its gang-op and its vehicle-loot opportunity', () => {
    const db = buildDb();
    const view = locationCard(db, 'gang-op:brooks-boatworks')!;
    const actions = locationCardActions(view, db);
    const looted = recordActions(actions).filter((action) => action.verb === 'looted');
    expect(looted.map((action) => action.target.id).sort()).toEqual([
      'opp:gang-op:brooks-boatworks:gang-op:1',
      'opp:gang-op:brooks-boatworks:vehicle-loot:1',
    ]);
    for (const action of looted) {
      expect(action.label).toBe('Mark as looted');
      expect(action.done).toBe(false);
      expect(action.count).toBe(0);
    }
    const vehicleLoot = looted.find(
      (action) => action.target.id === 'opp:gang-op:brooks-boatworks:vehicle-loot:1',
    )!;
    // The row carries the loot, so the card can show the code and
    // offer it as the note suggestion — no key needed.
    expect(vehicleLoot.loot?.code).toBe('6823');
    expect(vehicleLoot.loot?.contents).toContain('Vapid Smuggler Caracara (standout vehicle)');
    const gangOp = looted.find(
      (action) => action.target.id === 'opp:gang-op:brooks-boatworks:gang-op:1',
    )!;
    expect(gangOp.detail).toBe('Kolts & Associates');
    expect(gangOp.loot?.code).toBe('6823');
  });

  it('after looting, the row shows Looted ×1 and stays live (repeatable)', () => {
    const db = buildDb({
      records: [
        {
          id: 'rec:brooks-loot-1',
          target: { type: 'opportunity', id: 'opp:gang-op:brooks-boatworks:gang-op:1' },
          verb: 'looted',
          count: 1,
          at: '2026-11-26T10:00:00.000Z',
          source: 'user',
          note: 'used code 6823',
        },
      ],
    });
    const view = locationCard(db, 'gang-op:brooks-boatworks')!;
    const actions = locationCardActions(view, db);
    const gangOp = recordActions(actions).find(
      (action) => action.target.id === 'opp:gang-op:brooks-boatworks:gang-op:1',
    )!;
    expect(gangOp.count).toBe(1);
    expect(gangOp.doneLabel).toBe('Looted ×1');
    expect(gangOp.done).toBe(false);
  });

  it('a jotted vehicle-loot spot offers Mark as looted too (no imported loot needed)', () => {
    const user = {
      ...EMPTY_USER_DATA,
      markers: [
        {
          id: 'custom:jot-vehicle',
          title: 'Garage with a safe',
          description: 'Safe code 4444',
          category: 'my-markers' as const,
          icon: 'pin' as const,
          kind: 'vehicle-loot' as const,
          position: { x: -8000, y: 3000 },
          createdAt: '2026-11-26T10:00:00.000Z',
          updatedAt: '2026-11-26T10:00:00.000Z',
        },
      ],
    };
    const db = buildGameDatabase({ places, user });
    const view = locationCard(db, 'custom:jot-vehicle')!;
    const actions = locationCardActions(view, db);
    const looted = recordActions(actions).filter((action) => action.verb === 'looted');
    expect(looted).toHaveLength(1);
    expect(looted[0]?.target.id).toBe('opp:custom:jot-vehicle:vehicle-loot:1');
    expect(looted[0]?.label).toBe('Mark as looted');
    // No invented loot on a jot: no code line on the row.
    expect(looted[0]?.loot).toBeUndefined();
  });

  it('a site with no published loot still offers the loot action, with no loot on the row', () => {
    const db = buildDb();
    const view = locationCard(db, 'gang-op:weed-grow')!;
    const actions = locationCardActions(view, db);
    const gangOp = recordActions(actions).find((action) => action.verb === 'looted')!;
    expect(gangOp.label).toBe('Mark as looted');
    expect(gangOp.loot).toBeUndefined();
    // And no vehicle-loot opportunity at all: no code, no vehicle.
    expect(
      view.opportunities.some((opp) => opp.kind === 'vehicle-loot'),
    ).toBe(false);
    expect(GANG_OP_PLACES.find((place) => place.id === 'gang-op:weed-grow')).toBeDefined();
  });
});
