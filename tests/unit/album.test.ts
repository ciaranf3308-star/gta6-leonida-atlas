import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { AtlasDatabase } from '../../src/db/repository';
import {
  buildGameDatabase,
  setProgress,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import type { Place } from '../../src/domain/types';
import type { StorageLike } from '../../src/features/categorise/storage';
import { recordCompletion, recordSale, undoSale } from '../../src/features/completion/record';
import {
  ALBUM_FILTERS,
  albumArtwork,
  albumCounts,
  albumSlots,
  allAlbumSlots,
  isSetComplete,
  rarityFrameClass,
  slotMatchesFilter,
  soldIdsFromStates,
} from '../../src/features/album/album';
import { Album } from '../../src/features/album/Album';

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

const VICKI = 'card-checklist:delights-dancers:vicki:standard';

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

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe('Album — the 480 slots, as a view over the same log (addendum §3.2)', () => {
  it('renders all 480 checklist slots across the 18 sets', () => {
    const db = buildGameDatabase({ places });
    expect(allAlbumSlots(db)).toHaveLength(480);
    expect([...db.sets.values()]).toHaveLength(18);
    const perSet = [...db.sets.values()].reduce((sum, set) => sum + albumSlots(db, set.id).length, 0);
    expect(perSet).toBe(480);
    expect(albumSlots(db, 'delights-dancers')).toHaveLength(18);
    expect(albumSlots(db, 'delights-dancers').map((item) => item.id)).toContain(VICKI);
    // Non-slot game-text variants are never slots and never count.
    expect(albumSlots(db, 'delights-dancers').every((item) => item.checklistSlot)).toBe(true);
  });

  it('counts found/remaining/unpositioned/sold from the completion log + sold join', () => {
    const db = dbWithCollected(VICKI);
    const counts = albumCounts(db, new Set());
    expect(counts).toEqual({ all: 480, found: 1, remaining: 479, unpositioned: 94, sold: 0 });
    const sold = soldIdsFromStates([{ itemId: VICKI, soldAt: '2026-11-26T10:00:00.000Z' }]);
    expect(albumCounts(db, sold).sold).toBe(1);
    // An undone sale (soldAt null) is the audit trail, not a sold card.
    expect(soldIdsFromStates([{ itemId: VICKI, soldAt: null }]).size).toBe(0);
    expect(isSetComplete(db, 'delights-dancers')).toBe(false);
    expect(setProgress(db, 'delights-dancers').found).toBe(1);
  });

  it('filters: found / remaining / unpositioned / sold', () => {
    const db = dbWithCollected(VICKI);
    const vicki = db.items.get(VICKI)!;
    expect(slotMatchesFilter(vicki, true, false, 'found')).toBe(true);
    expect(slotMatchesFilter(vicki, true, false, 'remaining')).toBe(false);
    expect(slotMatchesFilter(vicki, true, true, 'sold')).toBe(true);
    expect(slotMatchesFilter(vicki, false, false, 'sold')).toBe(false);
    expect(slotMatchesFilter(vicki, true, false, 'unpositioned')).toBe(
      vicki.placement !== 'pinned',
    );
    expect(ALBUM_FILTERS.map((option) => option.id)).toEqual([
      'all',
      'found',
      'remaining',
      'unpositioned',
      'sold',
    ]);
  });

  it('rarity frames map tiers to classes (applied to collected cards only, by the component)', () => {
    const db = buildGameDatabase({ places });
    const byTier = new Map<string, string>();
    for (const item of db.items.values()) {
      if (item.checklistSlot && !byTier.has(item.rarity.tier)) {
        byTier.set(item.rarity.tier, item.id);
      }
    }
    expect(rarityFrameClass(db.items.get(byTier.get('gold')!)!)).toBe('rarity-gold');
    expect(rarityFrameClass(db.items.get(byTier.get('silver')!)!)).toBe('rarity-silver');
    expect(rarityFrameClass(db.items.get(byTier.get('bronze')!)!)).toBe('rarity-bronze');
    expect(rarityFrameClass(db.items.get(byTier.get('standard')!)!)).toBe('rarity-standard');
  });
});

describe('Album artwork — the two hard lines (addendum §3.3)', () => {
  it('an uncollected card NEVER renders artwork — even when a photo URL is handed in', () => {
    const db = buildGameDatabase({ places });
    const vicki = db.items.get(VICKI)!;
    expect(albumArtwork(vicki, false, 'data:image/jpeg;base64,AAAA')).toEqual({
      kind: 'silhouette',
    });
    expect(albumArtwork(vicki, false, null)).toEqual({ kind: 'silhouette' });
  });

  it('a collected card shows the player photo, else the honest empty slot', () => {
    const db = buildGameDatabase({ places });
    const vicki = db.items.get(VICKI)!;
    expect(albumArtwork(vicki, true, 'data:image/jpeg;base64,AAAA')).toEqual({
      kind: 'photo',
      url: 'data:image/jpeg;base64,AAAA',
    });
    expect(albumArtwork(vicki, true, null)).toEqual({ kind: 'empty' });
  });

  it('renders all 480 slots with uncollected concealed: silhouettes, no <img> anywhere', () => {
    const db = buildGameDatabase({ places });
    const html = renderToStaticMarkup(createElement(Album, { db }));
    expect(html).toContain('All 480 cards');
    expect(html).toContain('0 found');
    expect(html).toContain('Vicki');
    expect(html).toContain('album-silhouette');
    // 480 card tiles, one per slot — and no artwork element at all
    // while nothing is collected (no fake faces, no photos).
    expect(html.match(/album-card /g)?.length ?? 0).toBe(480);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('No licensed artwork yet');
  });

  it('a collected card renders found state, flip affordance and rarity frame — still no <img> without a photo', () => {
    const db = dbWithCollected(VICKI);
    const html = renderToStaticMarkup(createElement(Album, { db }));
    expect(html).toContain('1 found');
    expect(html).toContain('Collected ✓');
    expect(html).toContain('Flip card');
    expect(html).toContain('No licensed artwork yet');
    expect(html).not.toContain('<img');
    const vicki = db.items.get(VICKI)!;
    expect(html).toContain(rarityFrameClass(vicki));
  });
});

describe('recordSale — collected-first validation, sold never moves progress (addendum §3.4)', () => {
  let repo: AtlasDatabase;
  let storage: StorageLike;
  beforeEach(() => {
    repo = new AtlasDatabase(`album-sale-test-${crypto.randomUUID()}`);
    storage = memoryStorage();
  });
  afterEach(async () => {
    await repo.delete();
  });
  const deps = () => ({ repository: repo, places, storage });

  it('rejects selling a card that has not been collected', async () => {
    const result = await recordSale({ itemId: VICKI, price: 50 }, deps());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/has not been collected/);
    expect(await repo.loadPersonalItemStates()).toHaveLength(0);
  });

  it('records the sale after collecting; the set still counts the card and Progress is unchanged', async () => {
    const collected = await recordCompletion(
      { target: { type: 'item', id: VICKI }, verb: 'collected' },
      deps(),
    );
    expect(collected.ok).toBe(true);
    expect(setProgress(collected.db!, 'delights-dancers').found).toBe(1);
    const sold = await recordSale({ itemId: VICKI, price: 50 }, deps());
    expect(sold.ok).toBe(true);
    expect(sold.state?.soldAt).toBeTruthy();
    expect(sold.state?.soldPrice).toBe(50);
    // The completion log is untouched by the sale — no record added.
    const { records } = await repo.loadCompletion();
    expect(records.filter((record) => record.target.id === VICKI)).toHaveLength(1);
    // Progress still counts the card.
    const after = await recordCompletion(
      { target: { type: 'item', id: VICKI }, verb: 'collected' },
      deps(),
    );
    expect(setProgress(after.db!, 'delights-dancers').found).toBe(1);
    // Undo keeps the row with soldAt null — the audit trail.
    const undone = await undoSale(VICKI, deps());
    expect(undone.ok).toBe(true);
    expect(undone.state?.soldAt).toBeNull();
    const states = await repo.loadPersonalItemStates();
    expect(states).toHaveLength(1);
    expect(soldIdsFromStates(states).size).toBe(0);
  });
});
