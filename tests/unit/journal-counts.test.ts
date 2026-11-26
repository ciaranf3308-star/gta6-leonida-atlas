import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  buildGameDatabase,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import type { Place } from '../../src/domain/types';
import { Journal, journalCounts } from '../../src/features/completion/Journal';

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

function dbWithCollected(...itemIds: string[]): GameDatabase {
  const records: CompletionRecord[] = itemIds.map((id, index) => ({
    id: `rec:test-${index}`,
    target: { type: 'item', id },
    verb: 'collected',
    count: 1,
    at: `2026-11-26T08:41:5${index}Z`,
    source: 'user',
  }));
  return buildGameDatabase({ places, records });
}

describe('Journal header vs filter row — the row accounting (v0.32 gang-op follow-up)', () => {
  it('counts every row: 614 = 480 slots + 117 extras + 17 other collectibles', () => {
    const db = buildGameDatabase({ places });
    const counts = journalCounts(db);
    expect(counts).toEqual({
      all: 614,
      found: 0,
      remaining: 614,
      unpositioned: 557,
      slots: 480,
      extras: 117,
      other: 17,
    });
    expect(counts.slots + counts.extras + counts.other).toBe(counts.all);
    // The 17 the demo lane could not place: loot/other items with no
    // set — 10 meditations, 5 magazines, 1 watch, 1 WAiNK scan.
    const items = [...db.items.values()];
    const otherByKind = new Map<string, number>();
    for (const item of items) {
      if (item.checklistSlot || item.kind === 'trading-card') continue;
      otherByKind.set(item.kind, (otherByKind.get(item.kind) ?? 0) + 1);
    }
    expect(Object.fromEntries(otherByKind)).toEqual({
      meditation: 10,
      magazine: 5,
      watch: 1,
      'waink-scan': 1,
    });
    // The 117 extras split 62 filed under a set + 55 with no set.
    expect(
      items.filter((i) => !i.checklistSlot && i.kind === 'trading-card' && i.setId !== null)
        .length,
    ).toBe(62);
    expect(
      items.filter((i) => !i.checklistSlot && i.kind === 'trading-card' && i.setId === null)
        .length,
    ).toBe(55);
    // Pinned rows: 40 card slots + all 17 other items = 57; the rest
    // are unpositioned.
    expect(items.filter((i) => i.placement === 'pinned').length).toBe(57);
    expect(counts.unpositioned).toBe(614 - 57);
  });

  it('found / remaining move together when a card is collected', () => {
    const slot = [...buildGameDatabase({ places }).items.values()].find(
      (i) => i.checklistSlot,
    )!;
    const db = dbWithCollected(slot.id);
    const counts = journalCounts(db);
    expect(counts.found).toBe(1);
    expect(counts.remaining).toBe(613);
    expect(counts.all).toBe(614);
  });

  it('renders the header and the filter row from the same counts', () => {
    const db = buildGameDatabase({ places });
    const html = renderToStaticMarkup(createElement(Journal, { db }));
    expect(html).toContain('18 sets, 480 card slots in total');
    expect(html).toContain(
      'All lists 614 rows: the 480 slots, 117 extra game-text tiers, and 17 other collectibles.',
    );
    expect(html).toContain('All · 614');
    expect(html).toContain('Found · 0');
    expect(html).toContain('Remaining · 614');
    expect(html).toContain('Unpositioned · 557');
    // The set-less extras read as what they are, not a raw kind id.
    expect(html).toContain('Extra game-text tiers');
    expect(html).not.toContain('>trading-card ·');
  });

  it('returns zeros with no database', () => {
    expect(journalCounts(null)).toEqual({
      all: 0,
      found: 0,
      remaining: 0,
      unpositioned: 0,
      slots: 0,
      extras: 0,
      other: 0,
    });
  });
});
