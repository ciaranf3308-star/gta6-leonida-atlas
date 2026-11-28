import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  buildGameDatabase,
  setFoundLabel,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import { DEFAULT_FILTERS } from '../../src/stores/atlas';
import { filterPlaces } from '../../src/domain/filter';
import { completedPlaceIds } from '../../src/features/completion/place-ids';
import {
  itemForPlace,
  nextInSet,
  noNextInSetLabel,
  pinPlaceIdForItem,
  setDriveLayerIds,
  setDriveMembers,
  setPinnedByCounty,
  setPinnedCount,
} from '../../src/features/map/set-drive';
import { Journal } from '../../src/features/completion/Journal';
import { Album } from '../../src/features/album/Album';
import { CompletionPanel } from '../../src/features/completion/CompletionPanel';
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

const VICKI = 'card-checklist:delights-dancers:vicki:standard';
const JASON = 'card-checklist:delights-dancers:jason:standard';
const KANDI = 'card-checklist:delights-dancers:kandi:standard';
const PERLA = 'card-checklist:delights-dancers:perla:standard';
const HARLEY = 'card-checklist:delights-dancers:harley:standard';

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

describe('v0.33 Lane C — D-5 count hygiene (one shared selector)', () => {
  it('setFoundLabel is the one "x / y found" string for Delights', () => {
    expect(setFoundLabel(buildGameDatabase({ places }), 'delights-dancers')).toBe(
      '0 / 18 found',
    );
    expect(setFoundLabel(dbWithCollected(VICKI), 'delights-dancers')).toBe(
      '1 / 18 found',
    );
    expect(
      setFoundLabel(dbWithCollected(VICKI, JASON, KANDI), 'delights-dancers'),
    ).toBe('3 / 18 found');
  });

  it('journal row, album cover and Progress by set render the identical string', () => {
    const db = dbWithCollected(VICKI);
    const journal = renderToStaticMarkup(createElement(Journal, { db }));
    const album = renderToStaticMarkup(createElement(Album, { db }));
    const progress = renderToStaticMarkup(createElement(CompletionPanel, { db }));
    for (const [name, html] of [
      ['journal', journal],
      ['album', album],
      ['progress', progress],
    ] as const) {
      expect(html, `${name} shows the shared label`).toContain('1 / 18 found');
      expect(html, `${name} never shows the old wording`).not.toContain('1 / 18 cards');
    }
    // The journal header is slots, not found — "18 sets, 480 card
    // slots in total" is a different number and stays as it is.
    expect(journal).toContain('18 sets, 480 card slots in total');
  });

  it('unknown sets throw instead of inventing a count', () => {
    const db = buildGameDatabase({ places });
    expect(() => setFoundLabel(db, 'no-such-set')).toThrow('Unknown collectible set');
    expect(() => setPinnedCount(db, 'no-such-set')).toThrow('Unknown collectible set');
    expect(() => setDriveMembers(db, places, 'no-such-set')).toThrow(
      'Unknown collectible set',
    );
  });
});

describe('v0.33 Lane C — D-3 set drive members (measured from the data)', () => {
  it('Delights Dancers is 5 pinned of 18 — counted, never hard-coded', () => {
    const db = buildGameDatabase({ places });
    expect(setPinnedCount(db, 'delights-dancers')).toEqual({ pinned: 5, total: 18 });
    const { placeIds, pinnedItems } = setDriveMembers(db, places, 'delights-dancers');
    expect(pinnedItems.map((item) => item.name)).toEqual([
      'Harley',
      'Jason',
      'Kandi',
      'Perla',
      'Vicki',
    ]);
    expect(placeIds).toEqual([
      'loot:guide-harley-card',
      'card:jason',
      'card:kandi',
      'card:perla',
      'card:vicki',
    ]);
    // The 13 unpinned slots have no pin and are not in the drive.
    expect(db.sets.get('delights-dancers')!.itemIds.length).toBe(18);
  });

  it('the drive rides every layer the set uses — cards:* AND loot-collectibles', () => {
    const db = buildGameDatabase({ places });
    expect(setDriveLayerIds(db, places, 'delights-dancers').sort()).toEqual([
      'cards:delights-dancers',
      'loot-collectibles',
    ]);
    const { placeIds } = setDriveMembers(db, places, 'delights-dancers');
    const byLayer = new Map<string, string[]>();
    for (const id of placeIds) {
      const place = places.find((p) => p.id === id)!;
      byLayer.set(place.layerId, [...(byLayer.get(place.layerId) ?? []), id]);
    }
    expect(byLayer.get('loot-collectibles')).toEqual(['loot:guide-harley-card']);
    expect(byLayer.get('cards:delights-dancers')).toHaveLength(4);
  });

  it('per-county breakdown counts PINNED cards by county', () => {
    const db = buildGameDatabase({ places });
    expect(setPinnedByCounty(db, places, 'delights-dancers')).toEqual([
      { countyId: 'kelly', countyName: 'Kelly County', count: 3 },
      { countyId: 'vice-dale', countyName: 'Vice-Dale County', count: 2 },
    ]);
  });

  it('itemForPlace resolves a card pin and a loot pin to the same item model', () => {
    const db = buildGameDatabase({ places });
    expect(itemForPlace(db, 'card:jason')?.id).toBe(JASON);
    expect(itemForPlace(db, 'loot:guide-harley-card')?.id).toBe(HARLEY);
    expect(itemForPlace(db, 'card:kandi')?.id).toBe(KANDI);
    // A host location is not an item.
    expect(itemForPlace(db, 'L629')).toBeNull();
    expect(itemForPlace(db, 'L3078')).toBeNull();
    expect(pinPlaceIdForItem(db, places, db.items.get(HARLEY)!)).toBe(
      'loot:guide-harley-card',
    );
    expect(pinPlaceIdForItem(db, places, db.items.get(PERLA)!)).toBe('card:perla');
  });

  it('the other loot-joined sets ride the same rule', () => {
    const db = buildGameDatabase({ places });
    // Marquise (Los Santos Panic) and Aimie (Nine1Nine) are loot pins too.
    expect(itemForPlace(db, 'loot:guide-marquise-card')?.setId).toBe('los-santos-panic');
    expect(itemForPlace(db, 'loot:guide-rusty-anchor-card')?.setId).toBe(
      'nine1nine-dancers',
    );
    expect(setDriveLayerIds(db, places, 'los-santos-panic')).toContain(
      'loot-collectibles',
    );
    expect(setDriveLayerIds(db, places, 'nine1nine-dancers')).toContain(
      'loot-collectibles',
    );
  });
});

describe('v0.33 Lane C — Next in set', () => {
  it('walks the set in set order, wrapping from the last pinned card', () => {
    const db = buildGameDatabase({ places });
    expect(nextInSet(db, places, 'delights-dancers', VICKI)?.item.id).toBe(HARLEY);
    expect(nextInSet(db, places, 'delights-dancers', HARLEY)?.item.id).toBe(JASON);
    expect(nextInSet(db, places, 'delights-dancers', KANDI)?.item.id).toBe(PERLA);
    expect(nextInSet(db, places, 'delights-dancers', null)?.item.id).toBe(HARLEY);
  });

  it('skips collected cards and lands on the next uncollected pin', () => {
    const db = dbWithCollected(HARLEY, JASON);
    const next = nextInSet(db, places, 'delights-dancers', HARLEY);
    expect(next?.item.id).toBe(KANDI);
    expect(next?.pinPlaceId).toBe('card:kandi');
  });

  it('returns null when every pinned card is found', () => {
    const db = dbWithCollected(HARLEY, JASON, KANDI, PERLA, VICKI);
    expect(nextInSet(db, places, 'delights-dancers', VICKI)).toBeNull();
    // The set is not complete — 13 unpinned slots remain in the journal.
    expect(noNextInSetLabel(db, 'delights-dancers')).toBe(
      'All pinned cards found — 13 still to find in the journal',
    );
  });

  it('reads "Set complete" only when the whole set is found', () => {
    const all = buildGameDatabase({ places }).sets.get('delights-dancers')!.itemIds;
    const db = dbWithCollected(...all);
    expect(setFoundLabel(db, 'delights-dancers')).toBe('18 / 18 found');
    expect(nextInSet(db, places, 'delights-dancers', VICKI)).toBeNull();
    expect(noNextInSetLabel(db, 'delights-dancers')).toBe('Set complete ✓');
  });
});

describe('v0.33 Lane C — Hide found drops found set pins (never the count)', () => {
  it('a collected card pin is hidden by hideFound while the header count stands', () => {
    const db = dbWithCollected(JASON, HARLEY);
    const found = [...completedPlaceIds(db)];
    expect(found).toContain('card:jason');
    expect(found).toContain('loot:guide-harley-card');
    const hidden = filterPlaces(
      places,
      { ...DEFAULT_FILTERS, hideFound: true },
      [],
      [],
      [],
      found,
    );
    expect(hidden.some((place) => place.id === 'card:jason')).toBe(false);
    expect(hidden.some((place) => place.id === 'loot:guide-harley-card')).toBe(false);
    // The other Delights pins still show.
    expect(hidden.some((place) => place.id === 'card:kandi')).toBe(true);
    // And the count is from the log, not from what is shown.
    expect(setFoundLabel(db, 'delights-dancers')).toBe('2 / 18 found');
  });
});
