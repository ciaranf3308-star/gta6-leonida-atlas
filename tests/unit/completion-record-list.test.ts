import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  buildGameDatabase,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import {
  describeCompletionRecord,
  formatRecordDate,
  latestLootedRecordFor,
  recordListRows,
} from '../../src/features/completion/place-ids';
import type { Place } from '../../src/domain/types';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const places: Place[] = catalogueFromSnapshot(snapshot);

function buildDb(records: CompletionRecord[]): GameDatabase {
  return buildGameDatabase({ places, records });
}

function findItemId(db: GameDatabase, name: string): string {
  const item = [...db.items.values()].find((candidate) => candidate.name === name);
  if (!item) throw new Error(`No item ${name} in test db.`);
  return item.id;
}

/** The Demo B loot target: L1614's break-in opportunity. */
const BREAK_IN_OPP = 'opp:L1614:break-in:1';
/** The Demo D explore target: Redshaw's Gas & General Store. */
const REDSHAW = 'L1676';

describe('completion record list — Recent activity (v0.32 step-9, Demo D step 2)', () => {
  it('renders one row per record, newest first, with what / where / when', () => {
    const probe = buildDb([]);
    const vickiId = findItemId(probe, 'Vicki');
    const db = buildDb([
      {
        id: 'rec:seed-1',
        target: { type: 'item', id: vickiId },
        verb: 'collected',
        count: 1,
        at: '2026-11-26T08:41:56.634Z',
        source: 'user',
      },
      {
        id: 'rec:seed-2',
        target: { type: 'opportunity', id: BREAK_IN_OPP },
        verb: 'looted',
        count: 1,
        at: '2026-11-26T08:46:41.961Z',
        source: 'user',
      },
      {
        id: 'rec:seed-3',
        target: { type: 'location', id: REDSHAW },
        verb: 'explored',
        count: 1,
        at: '2026-11-26T09:09:00.512Z',
        source: 'user',
      },
    ]);
    const rows = recordListRows(db);
    expect(rows).toHaveLength(3);
    // Newest first — the input order is oldest first.
    expect(rows[0]!.recordId).toBe('rec:seed-3');
    expect(rows[0]!.verbLabel).toBe('Explored');
    expect(rows[0]!.targetLabel).toBe(db.locations.get(REDSHAW)?.name);
    expect(rows[0]!.dateLabel).toMatch(/2026/);
    expect(rows[0]!.dateLabel).toMatch(/Nov/);
    expect(rows[0]!.canUndo).toBe(true);

    const looted = rows[1]!;
    expect(looted.verbLabel).toBe('Looted');
    expect(looted.targetLabel).toContain('Break-in');
    expect(looted.detail).toBe(db.locations.get('L1614')?.name ?? null);
    expect(looted.dateLabel).toMatch(/26/);

    const collected = rows[2]!;
    expect(collected.verbLabel).toBe('Collected');
    expect(collected.targetLabel).toBe('Vicki');
    expect(collected.detail).toContain('Delights Dancers');
    // The original `at` is shown, not re-stamped: 26 Nov 2026.
    expect(collected.dateLabel).toMatch(/26 Nov 2026|Nov 26, 2026/);
  });

  it('a ×2 loot reads "Looted ×2", and its undo target is the latest +1 record', () => {
    const db = buildDb([
      {
        id: 'rec:loot-1',
        target: { type: 'opportunity', id: BREAK_IN_OPP },
        verb: 'looted',
        count: 1,
        at: '2026-11-26T08:46:41.961Z',
        source: 'user',
      },
      {
        id: 'rec:loot-2',
        target: { type: 'opportunity', id: BREAK_IN_OPP },
        verb: 'looted',
        count: 1,
        at: '2026-11-26T08:46:53.847Z',
        source: 'user',
      },
    ]);
    expect(db.completedOpportunityIds.get(BREAK_IN_OPP)).toBe(2);
    const described = describeCompletionRecord(db, db.records[1]!);
    expect(described.verbLabel).toBe('Looted');
    // Per-record rows carry their own count; the card's "Looted ×2"
    // is the summed count — both read from the same log.
    expect(latestLootedRecordFor(db, BREAK_IN_OPP)?.id).toBe('rec:loot-2');
  });

  it('a compensating record shows as its own "Undid loot" row and is never undoable', () => {
    const db = buildDb([
      {
        id: 'rec:loot-1',
        target: { type: 'opportunity', id: BREAK_IN_OPP },
        verb: 'looted',
        count: 1,
        at: '2026-11-26T08:46:41.961Z',
        source: 'user',
      },
      {
        id: 'rec:undo-1',
        target: { type: 'opportunity', id: BREAK_IN_OPP },
        verb: 'looted',
        count: -1,
        at: '2026-11-26T08:47:10.000Z',
        source: 'user',
      },
    ]);
    const rows = recordListRows(db);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.verbLabel).toBe('Undid loot');
    expect(rows[0]!.canUndo).toBe(false);
    expect(rows[1]!.verbLabel).toBe('Looted');
    // Net is 0, so the +1 row offers no Undo — undoing it would
    // drive the net negative. The row stays as audit trail.
    expect(rows[1]!.canUndo).toBe(false);
    // The undone loot no longer counts — the undo is real, not cosmetic.
    expect(db.completedOpportunityIds.has(BREAK_IN_OPP)).toBe(false);
    // ...but the original +1 is still the undo target of nothing:
    // every loot has already been undone.
    expect(latestLootedRecordFor(db, BREAK_IN_OPP)).toBeUndefined();
  });

  it('a record whose target no longer exists still lists, under its id', () => {
    const db = buildDb([
      {
        id: 'rec:gone-1',
        target: { type: 'location', id: 'L99999' },
        verb: 'discovered',
        count: 1,
        at: '2026-11-20T10:00:00.000Z',
        source: 'import',
      },
    ]);
    const rows = recordListRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.verbLabel).toBe('Discovered');
    expect(rows[0]!.targetLabel).toBe('L99999');
    expect(rows[0]!.canUndo).toBe(true);
  });

  it('formatRecordDate keeps the original timestamp and never invents one', () => {
    expect(formatRecordDate('2026-11-26T08:41:56.634Z')).toMatch(
      /26 Nov 2026|Nov 26, 2026/,
    );
    expect(formatRecordDate('not-a-date')).toBe('not-a-date');
  });
});
