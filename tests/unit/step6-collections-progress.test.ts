import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { AtlasDatabase } from '../../src/db/repository';
import {
  parseBackup,
  parseBackupFile,
  parseBackupV4,
  parseBackupV4WithDrops,
} from '../../src/db/backup';
import { COMPLETION_STORAGE_KEY } from '../../src/features/completion/store';
import type { StorageLike } from '../../src/features/categorise/storage';
import {
  buildGameDatabase,
  categoryProgress,
  overallProgress,
  type CompletionRecord,
  type GameDatabase,
  type ReconciliationEntry,
} from '../../src/domain/game-db';
import { filterPlaces } from '../../src/domain/filter';
import { DEFAULT_FILTERS } from '../../src/stores/atlas';
import {
  recordCompletion,
  recordReconciliation,
} from '../../src/features/completion/record';
import {
  completedPlaceIds,
  estimatedCoverage,
  exploredPlaceIds,
  splitOverall,
} from '../../src/features/completion/place-ids';
import { useCompletionLogStore } from '../../src/features/completion/log-store';
import { Journal, hintForItem } from '../../src/features/completion/Journal';
import { CompletionPanel } from '../../src/features/completion/CompletionPanel';
import { ProgressPanel } from '../../src/features/completion/ProgressPanel';
import { CollectionsPanel } from '../../src/app/Sidebar';
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
const time = '2026-11-26T06:00:00.000Z';

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

function buildFullDb(overrides: {
  records?: CompletionRecord[];
  reconciliation?: ReconciliationEntry[];
} = {}): GameDatabase {
  return buildGameDatabase({ places, ...overrides });
}

function reconciliationEntry(
  categoryId: string,
  count: number,
): ReconciliationEntry {
  return { categoryId, count, basis: 'game-stat', at: time };
}

let repo: AtlasDatabase;
let storage: StorageLike;
beforeEach(() => {
  repo = new AtlasDatabase(`step6-test-${crypto.randomUUID()}`);
  storage = memoryStorage();
  useCompletionLogStore.setState({
    records: [],
    reconciliation: [],
    loaded: false,
    error: null,
  });
});
afterEach(async () => {
  await repo.delete().catch(() => undefined);
});

describe('journal spoiler gating (DESIGN §3.5)', () => {
  it('an unpinned row shows name, set and checkbox — no hint until its own tap', () => {
    const db = buildFullDb();
    const hinted = [...db.items.values()].filter(
      (item) => item.spotDescription || item.areaLead,
    );
    expect(hinted.length).toBeGreaterThan(1);
    const [first, second] = hinted as [
      (typeof hinted)[number],
      (typeof hinted)[number],
    ];
    // Pure gate first: nothing revealed, nothing returned.
    expect(hintForItem(first, new Set())).toBeNull();
    expect(hintForItem(first, new Set([first.id]))).toEqual({
      areaLead: first.areaLead,
      spotDescription: first.spotDescription,
    });
    // Rendered: no hint text anywhere before any tap.
    const closed = renderToStaticMarkup(createElement(Journal, { db }));
    expect(closed).toContain('Show where to look');
    expect(closed).not.toContain(first.spotDescription!);
    expect(closed).not.toContain(second.spotDescription!);
    // One tap reveals THAT item only — its set-mate stays hidden.
    const revealed = renderToStaticMarkup(
      createElement(Journal, { db, initialRevealedIds: [first.id] }),
    );
    expect(revealed).toContain(first.spotDescription!);
    expect(revealed).not.toContain(second.spotDescription!);
  });

  it('a collected row shows the found treatment — and no artwork, ever', () => {
    const vickiId = buildFullDb().legacyItemIds.get('card:vicki')!;
    const db = buildFullDb({
      records: [
        {
          id: 'rec:test-vicki',
          target: { type: 'item', id: vickiId },
          verb: 'collected',
          count: 1,
          at: time,
          source: 'user',
        },
      ],
    });
    const html = renderToStaticMarkup(createElement(Journal, { db }));
    expect(html).toContain('Vicki');
    expect(html).toContain('Collected ✓');
    // The found date renders from the record's `at` timestamp.
    expect(html).toContain(
      new Date(time).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    );
    // No artwork anywhere: no image element, no external card link.
    expect(html).not.toContain('<img');
    expect(html).not.toContain('fbrito');
    expect(html).not.toContain('gta6/?id=');
  });

  it('sets are never hidden for being unmapped, and the filters split the list', () => {
    const vickiId = buildFullDb().legacyItemIds.get('card:vicki')!;
    const db = buildFullDb({
      records: [
        {
          id: 'rec:test-vicki',
          target: { type: 'item', id: vickiId },
          verb: 'collected',
          count: 1,
          at: time,
          source: 'user',
        },
      ],
    });
    const all = renderToStaticMarkup(createElement(Journal, { db }));
    expect(all).toContain('Delights Dancers');
    expect(all).toContain('Vice City Manatees');
    // Found filter: Vicki stays, an uncollected set-mate goes.
    const found = renderToStaticMarkup(
      createElement(Journal, { db, initialFilter: 'found' }),
    );
    expect(found).toContain('Vicki');
    expect(found).not.toContain('Harley');
    expect(found).toContain('Delights Dancers');
    // Remaining filter: the reverse.
    const remaining = renderToStaticMarkup(
      createElement(Journal, { db, initialFilter: 'remaining' }),
    );
    expect(remaining).toContain('Harley');
    expect(remaining).not.toContain('Vicki');
    // Unpositioned filter: the set cover still renders.
    const unpositioned = renderToStaticMarkup(
      createElement(Journal, { db, initialFilter: 'unpositioned' }),
    );
    expect(unpositioned).toContain('Delights Dancers');
  });

  it('Collections holds the journal (not the old per-set layer list)', () => {
    const html = renderToStaticMarkup(
      createElement(CollectionsPanel, { db: buildFullDb(), onSelect: () => {} }),
    );
    expect(html).toContain('Favorites');
    expect(html).toContain('Trading cards');
    expect(html).toContain('Delights Dancers');
    expect(html).toContain('Show where to look');
    expect(html).toContain('Add to the map');
    expect(html).not.toContain('100% completion');
    expect(html).not.toContain('verified pins so far');
  });
});

describe('Progress dashboard (DESIGN §4)', () => {
  it('shows the three numbers with their bases labelled, never conflated', () => {
    const vickiId = buildFullDb().legacyItemIds.get('card:vicki')!;
    const db = buildFullDb({
      records: [
        {
          id: 'rec:test-vicki',
          target: { type: 'item', id: vickiId },
          verb: 'collected',
          count: 1,
          at: time,
          source: 'user',
        },
      ],
      reconciliation: [reconciliationEntry('missions', 41)],
    });
    const html = renderToStaticMarkup(
      createElement(ProgressPanel, { progress: [], db }),
    );
    expect(html).toContain('100% completion');
    expect(html).toContain('Recorded');
    expect(html).toContain('from your finds');
    expect(html).toContain('Reconciled');
    expect(html).toContain('from your in-game stats');
    expect(html).toContain('Estimated');
    expect(html).toContain('not a completion fraction');
    // One card moves the set row, not the overall total (card sets
    // count complete sets toward the 15-set requirement).
    expect(html).toContain('Delights Dancers');
    expect(html).toContain('1 / 18 cards');
    expect(html).toContain('41 / 91');
  });

  it('carries the meditation 15-vs-10 gap as an honest note, not invented spots', () => {
    const html = renderToStaticMarkup(
      createElement(CompletionPanel, { db: buildFullDb() }),
    );
    expect(html).toContain('Meditation Spots');
    expect(html).toContain('5 spots unaccounted for');
    expect(html).toContain('our data lists 10 meditation spots');
  });

  it('every category row carries a reconciliation input (in-game counter as source)', () => {
    const html = renderToStaticMarkup(
      createElement(CompletionPanel, { db: buildFullDb() }),
    );
    expect(html).toContain('In-game count for Main Story Missions');
    expect(html).toContain('In-game count for Basketball Hoops');
  });
});

describe('§4.3 no-double-counting (read-time rule)', () => {
  it('derived applies on an import-complete category with zero records — the reconciled number is shown, not counted', () => {
    const db = buildFullDb({
      reconciliation: [reconciliationEntry('bank-jobs', 5)],
    });
    const view = categoryProgress(db, 'bank-jobs');
    expect(view.basis).toBe('derived');
    expect(view.displayed).toBe(0);
    expect(view.superseded).toBe(true);
    expect(view.reconciledCount).toBe(5);
    expect(overallProgress(db).found).toBe(0);
  });

  it('the overall total is the sum of the displayed values — never derived + reconciled for one category', () => {
    const bankJob = [...buildFullDb().opportunities.values()].find(
      (opp) => opp.kind === 'bank-job',
    )!;
    const db = buildFullDb({
      records: [
        {
          id: 'rec:test-bank',
          target: { type: 'opportunity', id: bankJob.id },
          verb: 'looted',
          count: 1,
          at: time,
          source: 'user',
        },
      ],
      reconciliation: [
        reconciliationEntry('bank-jobs', 5),
        reconciliationEntry('missions', 41),
      ],
    });
    expect(categoryProgress(db, 'bank-jobs').displayed).toBe(1);
    expect(overallProgress(db).found).toBe(42);
    expect(splitOverall(overallProgress(db))).toEqual({
      recorded: 1,
      reconciled: 41,
    });
  });

  it('a reconciled count above the game total is capped at read time', () => {
    const db = buildFullDb({
      reconciliation: [reconciliationEntry('missions', 200)],
    });
    const view = categoryProgress(db, 'missions');
    expect(view.displayed).toBe(91);
    expect(view.reconciledCount).toBe(200);
    expect(overallProgress(db).found).toBe(91);
  });

  it('estimated coverage counts pins, never completions', () => {
    const db = buildFullDb();
    const coverage = estimatedCoverage(db);
    expect(coverage.pinnedItems).toBe(386); // 40 host + 346 fbrito candidate pins
    expect(coverage.totalItems).toBe(480);
    expect(coverage.totalSets).toBe(18);
    expect(coverage.foundItems).toBe(0);
  });
});

describe('store replacement — the log feeds the map (selector level)', () => {
  it('a recordCompletion write dims the pin and hides it under Hide completed, and survives a restart', async () => {
    const shot = await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' },
      { repository: repo, places, storage },
    );
    expect(shot.ok).toBe(true);
    const after = buildGameDatabase({
      places,
      records: shot.db!.records,
      reconciliation: [],
    });
    const vickiId = after.legacyItemIds.get('card:vicki')!;
    const vicki = after.items.get(vickiId)!;
    expect(vicki.locationId).toBeTruthy();
    // The pin dims: the host location AND the old card id are found.
    const found = completedPlaceIds(after);
    expect(found.has(vicki.locationId!)).toBe(true);
    expect(found.has('card:vicki')).toBe(true);
    expect(found.has(vickiId)).toBe(true);
    // Hide completed: both the card pin and the host place vanish.
    const hidden = filterPlaces(
      places,
      { ...DEFAULT_FILTERS, hideFound: true },
      [],
      [],
      [],
      [...found],
    );
    expect(hidden.some((place) => place.id === 'card:vicki')).toBe(false);
    expect(hidden.some((place) => place.id === vicki.locationId)).toBe(false);
    // Restart: a fresh read from the repository still has the record.
    const { records } = await repo.loadCompletion();
    const restarted = buildGameDatabase({ places, records });
    expect(restarted.completedItemIds.has(vickiId)).toBe(true);
    expect(completedPlaceIds(restarted).has('card:vicki')).toBe(true);
    // And the old localStorage key is gone — the log is Dexie-backed.
    expect(storage.getItem(COMPLETION_STORAGE_KEY)).toBeNull();
  });

  it('a looted bank job marks its location found and explored stays separate', async () => {
    // The first bank-job in map order is a one-time 'Story job'
    // (repeatable: false) — looting it is correctly rejected, so
    // take a repeatable job.
    const bankJob = [...buildFullDb().opportunities.values()].find(
      (opp) => opp.kind === 'bank-job' && opp.repeatable,
    )!;
    const shot = await recordCompletion(
      { target: { type: 'opportunity', id: bankJob.id }, verb: 'looted' },
      { repository: repo, places, storage },
    );
    expect(shot.ok).toBe(true);
    const found = completedPlaceIds(shot.db!);
    expect(found.has(bankJob.locationId)).toBe(true);
    expect(exploredPlaceIds(shot.db!).has(bankJob.locationId)).toBe(false);
    const explored = await recordCompletion(
      { target: { type: 'location', id: bankJob.locationId }, verb: 'explored' },
      { repository: repo, places, storage },
    );
    expect(explored.ok).toBe(true);
    expect(exploredPlaceIds(explored.db!).has(bankJob.locationId)).toBe(true);
  });

  it('the log store load() runs the startup migration (step 2 handoff)', async () => {
    await repo.visited.put({ placeId: 'card:vicki', visitedAt: time });
    await repo.explored.put({ placeId: 'L629', exploredAt: time });
    const tallies = memoryStorage({
      [COMPLETION_STORAGE_KEY]: JSON.stringify({ missions: 10 }),
    });
    await useCompletionLogStore
      .getState()
      .load({ repository: repo, places, storage: tallies });
    const state = useCompletionLogStore.getState();
    expect(state.loaded).toBe(true);
    expect(state.error).toBeNull();
    expect(
      state.records.some((record) => record.id === 'rec:mig:visited:card:vicki'),
    ).toBe(true);
    expect(
      state.records.some((record) => record.id === 'rec:mig:explored:L629'),
    ).toBe(true);
    expect(state.reconciliation).toEqual([
      { categoryId: 'missions', count: 10, basis: 'game-stat', at: expect.any(String) },
    ]);
    // The old key is gone after migration.
    expect(tallies.getItem(COMPLETION_STORAGE_KEY)).toBeNull();
    // applyDb adopts a rebuilt database without a second read.
    const db = buildGameDatabase({ places, records: state.records });
    useCompletionLogStore.getState().applyDb(db);
    expect(useCompletionLogStore.getState().records).toHaveLength(
      state.records.length,
    );
  });

  it('recordReconciliation validates, migrates first, and never overwrites with stale tallies', async () => {
    const unknown = await recordReconciliation(
      { categoryId: 'no-such-category', count: 1 },
      { repository: repo, places, storage },
    );
    expect(unknown.ok).toBe(false);
    expect(unknown.code).toBe('validation');
    const tooHigh = await recordReconciliation(
      { categoryId: 'missions', count: 200 },
      { repository: repo, places, storage },
    );
    expect(tooHigh.ok).toBe(false);
    expect(tooHigh.code).toBe('validation');
    // A stale tallies key converts first — then this entry wins.
    const tallies = memoryStorage({
      [COMPLETION_STORAGE_KEY]: JSON.stringify({ missions: 10 }),
    });
    const written = await recordReconciliation(
      { categoryId: 'missions', count: 20 },
      { repository: repo, places, storage: tallies },
    );
    expect(written.ok).toBe(true);
    expect(written.entry).toMatchObject({
      categoryId: 'missions',
      count: 20,
      basis: 'game-stat',
    });
    const { reconciliation } = await repo.loadCompletion();
    expect(
      reconciliation.find((entry) => entry.categoryId === 'missions')?.count,
    ).toBe(20);
    expect(tallies.getItem(COMPLETION_STORAGE_KEY)).toBeNull();
    // The log store's save path writes and refreshes.
    const saved = await useCompletionLogStore
      .getState()
      .saveReconciliation('hoops', 12, { repository: repo, places, storage });
    expect(saved.ok).toBe(true);
    expect(
      useCompletionLogStore
        .getState()
        .reconciliation.find((entry) => entry.categoryId === 'hoops')?.count,
    ).toBe(12);
  });
});

describe('parser unification — one path for v3 and v4', () => {
  function minimalV3(): Record<string, unknown> {
    return {
      format: 'leonida-atlas',
      version: 3,
      exportedAt: time,
      markers: [],
      favorites: [],
      notes: [],
      placeTags: [],
      collections: [],
      visited: [],
      explored: [],
      preferences: { reducedMotion: false, showLabels: true, clusterMarkers: true },
      aiCategories: [],
      aiIndexJob: {
        status: 'idle',
        attemptedPlaceIds: [],
        resolverVersion: 3,
        updatedAt: time,
      },
    };
  }

  function validRecord(id: string): Record<string, unknown> {
    return {
      id,
      target: { type: 'item', id: 'card-checklist:delights-dancers:vicki:standard' },
      verb: 'collected',
      count: 1,
      at: time,
      source: 'user',
    };
  }

  it('a v3 file parses identically through parseBackup and parseBackupFile', () => {
    const fixture = minimalV3();
    const direct = parseBackup(fixture);
    const viaFile = parseBackupFile(fixture);
    expect(viaFile).toEqual(direct);
    expect(direct.version).toBe(3);
    expect(direct.preferences).toEqual({
      reducedMotion: false,
      showLabels: true,
      clusterMarkers: true,
    });
  });

  it('parseBackup still rejects version 4, and parseBackupV4 still rejects v3', () => {
    expect(() => parseBackup({ ...minimalV3(), version: 4 })).toThrow(
      /supported versions: 1, 2 and 3/,
    );
    expect(() => parseBackupV4(minimalV3())).toThrow(/expects version 4/);
    expect(() => parseBackup({ ...minimalV3(), version: 5 })).toThrow(
      /supported versions: 1, 2 and 3/,
    );
  });

  it('drop-and-count survives unification: invalid and duplicate records are dropped with reasons', () => {
    const v4 = {
      ...minimalV3(),
      version: 4,
      completionRecords: [
        validRecord('rec:good-1'),
        { ...validRecord('rec:bad-verb'), verb: 'teleported' },
        validRecord('rec:good-2'),
        validRecord('rec:good-1'),
      ],
      reconciliation: [],
      enrichments: [],
      corrections: [],
      personalItemState: [],
    };
    const { backup, droppedCompletionRecords } = parseBackupV4WithDrops(v4);
    expect(backup.version).toBe(4);
    expect(backup.completionRecords.map((record) => record.id)).toEqual([
      'rec:good-1',
      'rec:good-2',
    ]);
    expect(droppedCompletionRecords).toHaveLength(2);
    expect(droppedCompletionRecords[0]?.reason).toMatch(/verb/);
    expect(droppedCompletionRecords[1]?.reason).toMatch(/duplicate id rec:good-1/);
    // The plain entry point keeps the same parse, minus the report.
    expect(parseBackupV4(v4).completionRecords).toHaveLength(2);
    // And the version-aware entry point dispatches v4.
    expect(parseBackupFile(v4).version).toBe(4);
  });

  it('the 10 MiB cap is still enforced on the unified path', () => {
    const input = minimalV3();
    input.notes = Array.from({ length: 106 }, (_, index) => ({
      placeId: `L${index}`,
      text: 'x'.repeat(100_000),
      updatedAt: time,
    }));
    expect(() => parseBackup(input)).toThrow(/MiB|data limit/i);
    expect(() => parseBackupV4({ ...input, version: 4 })).toThrow(/MiB|data limit/i);
  });
});
