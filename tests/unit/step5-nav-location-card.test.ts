import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  buildGameDatabase,
  locationCard,
  remainingItems,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import { subtreeAreaIds, type AreaNode } from '../../src/domain/geography';
import { locationCardActions } from '../../src/features/completion/location-actions';
import {
  loadGameDatabase,
  recordCompletion,
} from '../../src/features/completion/record';
import { AtlasDatabase } from '../../src/db/repository';
import type { StorageLike } from '../../src/features/categorise/storage';
import { resolveViewArea } from '../../src/features/library/view-area';
import {
  ESTIMATED_EXTENT_TOOLTIP_CLASS,
  ESTIMATED_EXTENT_TOOLTIP_TEXT,
} from '../../src/features/map/isolation-label';
import BottomNav, { NAV_TABS } from '../../src/app/BottomNav';
import MapFilterSheet, { hideCompletedChecked } from '../../src/features/map/MapFilterSheet';
import { CollectionsPanel, FindPanel, Sidebar } from '../../src/app/Sidebar';
import { ProgressPanel } from '../../src/features/completion/ProgressPanel';
import { useUiStore } from '../../src/stores/atlas';

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

function buildFullDb(overrides: { records?: CompletionRecord[] } = {}): GameDatabase {
  return buildGameDatabase({ places, ...overrides });
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

let repo: AtlasDatabase;
let storage: StorageLike;
beforeEach(() => {
  repo = new AtlasDatabase(`step5-test-${crypto.randomUUID()}`);
  storage = memoryStorage();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await repo.delete();
  // The zustand server snapshot is the initial state, so SSR tests
  // never see setState — but the client-side store still holds
  // whatever a test set, so reset it for the next test anyway.
  useUiStore.setState({ navTab: 'map', findOpen: false, filterSheetOpen: false });
});
const deps = () => ({ repository: repo, places, storage });

describe('four-tab nav (step 5)', () => {
  it('is exactly Map, Collections, Progress, Ask — no Find, no Layers, no Saved', () => {
    expect(NAV_TABS.map((tab) => tab.id)).toEqual([
      'map',
      'collections',
      'progress',
      'ask',
    ]);
    expect(NAV_TABS.map((tab) => tab.label)).toEqual([
      'Map',
      'Collections',
      'Progress',
      'Ask',
    ]);
  });

  it('renders the four labelled tabs and nothing else', () => {
    const html = renderToStaticMarkup(
      createElement(BottomNav, { onNavigate: () => {} }),
    );
    for (const label of ['Map', 'Collections', 'Progress', 'Ask']) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain('>Find<');
    expect(html).not.toContain('>Layers<');
    expect(html).not.toContain('>Saved<');
    expect(html).toContain('aria-label="Atlas sections"');
    expect(html).toContain('aria-current="page"');
  });

  it('every tab is a 48px target: --nav-height is 72px and the buttons use it as min-height', () => {
    const css = readFileSync(
      new URL('../../src/app/atlas.css', import.meta.url),
      'utf8',
    );
    expect(css).toMatch(/--nav-height:\s*72px/);
    const buttonRule = /\.bottom-nav button \{[^}]*\}/s.exec(css);
    expect(buttonRule).not.toBeNull();
    expect(buttonRule![0]).toContain('min-height: var(--nav-height)');
  });

  it('the Map tab renders no panel — the panel only opens for a tab or Find', () => {
    const html = renderToStaticMarkup(
      createElement(Sidebar, {
        places: [],
        allPlaces: [],
        db: null,
        progress: [],
        anyPublicLayerVisible: false,
        showingCount: 0,
        onSelect: () => {},
      }),
    );
    expect(html).toBe('');
  });
});

describe('tab homes — §6.5c re-homing (step 5)', () => {
  it('Progress holds the completion panel and the per-layer rows', () => {
    const html = renderToStaticMarkup(
      createElement(ProgressPanel, {
        progress: [
          { layerId: 'lootable', name: 'Lootable', total: 47, found: 3, explored: 5 },
        ],
        // Step 6: the dashboard reads the completion log, so the
        // panel takes the database — the old localStorage tally panel
        // it replaced read 0 after migration.
        db: buildFullDb(),
      }),
    );
    expect(html).toContain('100% completion');
    expect(html).toContain('Recorded');
    expect(html).toContain('Reconciled');
    expect(html).toContain('Estimated');
    expect(html).toContain('Progress by layer');
    expect(html).toContain('Lootable');
    expect(html).toContain('3 of 47 found');
    expect(html).not.toContain('Trading cards');
    expect(html).not.toContain('Add to the map');
  });

  it('Collections holds the library, the journal and Add to the map', () => {
    const html = renderToStaticMarkup(
      createElement(CollectionsPanel, {
        // Step 6: the per-set layer list (TradingCardSets) is replaced
        // by the journal — every set, every item, pinned or not.
        db: buildFullDb(),
        onSelect: () => {},
      }),
    );
    expect(html).toContain('Favorites');
    expect(html).toContain('My markers');
    expect(html).toContain('Collections');
    expect(html).toContain('Trading cards');
    expect(html).toContain('Delights Dancers');
    expect(html).toContain('Add to the map');
    expect(html).not.toContain('100% completion');
    expect(html).not.toContain('Progress by layer');
  });

  it('Find is a Map-tab overlay: search field, county/area/kind filters, category tiles', () => {
    const html = renderToStaticMarkup(
      createElement(FindPanel, {
        places: [],
        allPlaces: [],
        db: null,
        anyPublicLayerVisible: false,
        showingCount: 0,
        onSelect: () => {},
      }),
    );
    expect(html).toContain('Search places, shops, cards…');
    expect(html).toContain('Isolate one county');
    expect(html).toContain('Isolate one town, city or area');
    expect(html).toContain('Browse by category');
    expect(html).toContain('0 places showing');
  });
});

describe('map-filter sheet — filters only (step 5)', () => {
  it('has the layer toggles, the kill switch, Narrow it down and Hide completed', () => {
    const html = renderToStaticMarkup(
      createElement(MapFilterSheet, { progress: [], onClose: () => {} }),
    );
    expect(html).toContain('Map filters');
    expect(html).toContain('Turn everything off');
    expect(html).toContain('Narrow it down');
    expect(html).toContain('Hide completed');
    expect(html).toContain('Hide places you already found or finished');
    expect(html).toContain('Can go inside');
  });

  it('carries none of the re-homed surfaces: no county cards, no completion, no indexing, no Add, no trading cards, no basemap credit', () => {
    const html = renderToStaticMarkup(
      createElement(MapFilterSheet, { progress: [], onClose: () => {} }),
    );
    expect(html).not.toContain('Isolate a county');
    expect(html).not.toContain('100% completion');
    expect(html).not.toContain('Sort the unnamed');
    expect(html).not.toContain('places still unnamed');
    expect(html).not.toContain('Add to the map');
    expect(html).not.toContain('Trading cards');
    expect(html).not.toContain('basemap');
    expect(html).not.toContain('Rockstar Games');
  });

  it('Hide completed reads the hideFound flag (the same flag Ask mirrors)', () => {
    expect(hideCompletedChecked({ hideFound: false, remainingOnly: false })).toBe(false);
    expect(hideCompletedChecked({ hideFound: true, remainingOnly: false })).toBe(true);
    // "Not found yet" implies the same hiding, so the toggle reads on.
    expect(hideCompletedChecked({ hideFound: false, remainingOnly: true })).toBe(true);
    expect(hideCompletedChecked({ hideFound: true, remainingOnly: true })).toBe(true);
    // And the sheet renders the toggle unchecked by default.
    const html = renderToStaticMarkup(
      createElement(MapFilterSheet, { progress: [], onClose: () => {} }),
    );
    expect(html).toContain('Hide completed');
    expect(html).toContain('aria-pressed="false"');
  });
});

describe('location-card actions per opportunity kind (step 5)', () => {
  it('a Style shop gets Shop here, Mark as looted (robbery-shop), discovered and explored', () => {
    const db = buildFullDb();
    // Sara's Unisex Salon (L360): shop + robbery-shop + interior.
    const actions = locationCardActions(locationCard(db, 'L360')!, db);
    const labels = actions.map((action) =>
      action.kind === 'collect' ? `collect:${action.label}` : action.label,
    );
    expect(labels).toEqual([
      'Shop here',
      'Mark as looted',
      'Mark as discovered',
      'Mark as explored',
    ]);
    const info = actions.find((action) => action.kind === 'info')!;
    expect(info.kind).toBe('info');
    if (info.kind === 'info') {
      expect(info.label).toBe('Shop here');
      expect(info.detail).toBe('Style shop');
    }
    const looted = actions.find(
      (action) => action.kind === 'record' && action.verb === 'looted',
    )!;
    expect(looted.kind).toBe('record');
    if (looted.kind === 'record') {
      expect(looted.target).toEqual({
        type: 'opportunity',
        id: 'opp:L360:robbery-shop:1',
      });
      expect(looted.count).toBe(0);
    }
  });

  it('a shop with no hold-up (Delights) gets Shop here + discovered + explored + two collect checkboxes — never looted', () => {
    const db = buildFullDb();
    const actions = locationCardActions(locationCard(db, 'L629')!, db);
    const labels = actions.map((action) =>
      action.kind === 'collect' ? `collect:${action.label}` : action.label,
    );
    expect(labels).toEqual([
      'Shop here',
      'Mark as discovered',
      'Mark as explored',
      'collect:Harley',
      'collect:Jason',
    ]);
    expect(actions.some((action) => action.kind === 'record' && action.verb === 'looted')).toBe(
      false,
    );
  });

  it('a bank job gets exactly Mark as looted — nothing else', () => {
    const db = buildFullDb();
    const actions = locationCardActions(
      locationCard(db, 'loot:guide-job-ocean-fleeca-small')!,
      db,
    );
    expect(actions).toHaveLength(1);
    const only = actions[0]!;
    expect(only.kind).toBe('record');
    if (only.kind === 'record') {
      expect(only.label).toBe('Mark as looted');
      expect(only.verb).toBe('looted');
      expect(only.target.type).toBe('opportunity');
      expect(only.detail).toBe('Bank job');
    }
  });

  it('a break-in gets Mark as looted plus Mark as discovered plus Mark as explored', () => {
    const db = buildFullDb();
    const actions = locationCardActions(
      locationCard(db, 'breakable:parlor-apartments')!,
      db,
    );
    expect(
      actions.map((action) => (action.kind === 'collect' ? 'collect' : action.label)),
    ).toEqual(['Mark as looted', 'Mark as discovered', 'Mark as explored']);
  });

  it('a gym-only location gets no completion action — no verb is invented for it', () => {
    const db = buildFullDb();
    expect(locationCardActions(locationCard(db, 'gym:ajax')!, db)).toEqual([]);
  });

  it('completed state reads back from the log: Looted ×2, Discovered ✓, Collected ✓', () => {
    const db = buildFullDb({
      records: [
        {
          id: 'rec:1',
          target: { type: 'opportunity', id: 'opp:L360:robbery-shop:1' },
          verb: 'looted',
          count: 2,
          at: '2026-11-26T00:00:00.000Z',
          source: 'user',
        },
        {
          id: 'rec:2',
          target: { type: 'location', id: 'L360' },
          verb: 'discovered',
          count: 1,
          at: '2026-11-26T00:00:00.000Z',
          source: 'user',
        },
        {
          id: 'rec:3',
          target: { type: 'item', id: 'card-checklist:delights-dancers:harley:standard' },
          verb: 'collected',
          count: 1,
          at: '2026-11-26T00:00:00.000Z',
          source: 'user',
        },
      ],
    });
    const salon = locationCardActions(locationCard(db, 'L360')!, db);
    const looted = salon.find(
      (action) => action.kind === 'record' && action.verb === 'looted',
    )!;
    expect(looted.kind).toBe('record');
    if (looted.kind === 'record') {
      expect(looted.count).toBe(2);
      expect(looted.doneLabel).toBe('Looted ×2');
    }
    const discovered = salon.find(
      (action) => action.kind === 'record' && action.verb === 'discovered',
    )!;
    expect(discovered.kind).toBe('record');
    if (discovered.kind === 'record') {
      expect(discovered.done).toBe(true);
      expect(discovered.doneLabel).toBe('Discovered ✓');
    }
    const delights = locationCardActions(locationCard(db, 'L629')!, db);
    const harley = delights.find(
      (action) => action.kind === 'collect' && action.label === 'Harley',
    )!;
    expect(harley.kind).toBe('collect');
    if (harley.kind === 'collect') expect(harley.done).toBe(true);
    const jason = delights.find(
      (action) => action.kind === 'collect' && action.label === 'Jason',
    )!;
    if (jason.kind === 'collect') expect(jason.done).toBe(false);
  });
});

describe('recordCompletion actually records (step-2 API, step-5 actions)', () => {
  it('looting a bank job twice reads back as Looted ×2', async () => {
    const d = deps();
    const target = {
      type: 'opportunity' as const,
      id: 'opp:loot:guide-job-ocean-fleeca-small:bank-job:1',
    };
    const first = await recordCompletion({ target, verb: 'looted' }, d);
    expect(first.ok).toBe(true);
    const second = await recordCompletion({ target, verb: 'looted' }, d);
    expect(second.ok).toBe(true);
    const db = await loadGameDatabase(d);
    expect(db.completedOpportunityIds.get(target.id)).toBe(2);
    const actions = locationCardActions(
      locationCard(db, 'loot:guide-job-ocean-fleeca-small')!,
      db,
    );
    expect(actions).toHaveLength(1);
    const only = actions[0]!;
    if (only.kind === 'record') {
      expect(only.doneLabel).toBe('Looted ×2');
    }
  });

  it('discovering a break-in location and collecting its card both land in the rebuilt db', async () => {
    const d = deps();
    const discovered = await recordCompletion(
      { target: { type: 'location', id: 'breakable:parlor-apartments' }, verb: 'discovered' },
      d,
    );
    expect(discovered.ok).toBe(true);
    const collected = await recordCompletion(
      { target: { type: 'item', id: 'card:vicki' }, verb: 'collected' },
      d,
    );
    expect(collected.ok).toBe(true);
    const db = await loadGameDatabase(d);
    expect(db.discoveredLocationIds.has('breakable:parlor-apartments')).toBe(true);
    expect(
      db.completedItemIds.has('card-checklist:delights-dancers:vicki:standard'),
    ).toBe(true);
    // And the card shows the discovered row struck through.
    const actions = locationCardActions(
      locationCard(db, 'breakable:parlor-apartments')!,
      db,
    );
    const found = actions.find(
      (action) => action.kind === 'record' && action.verb === 'discovered',
    )!;
    if (found.kind === 'record') expect(found.done).toBe(true);
  });

  it('shopping records nothing — there is no verb for it', async () => {
    const db = buildFullDb();
    const actions = locationCardActions(locationCard(db, 'L360')!, db);
    // The only shop action is the info row: no target, no verb.
    expect(actions.filter((action) => action.kind === 'info')).toHaveLength(1);
    expect(actions.every((action) => action.kind !== 'record' || action.verb !== 'collected')).toBe(
      true,
    );
    expect((await repo.loadCompletion()).records).toHaveLength(0);
  });
});

describe('View Area uses the area’s own bounds (step 5)', () => {
  it('an area with positioned members shows its own extent, no fallback, no note', () => {
    const db = buildFullDb();
    const place = places.find((candidate) => candidate.id === 'L629')!;
    const resolved = resolveViewArea(db, place);
    expect(resolved.kind).toBe('area');
    if (resolved.kind === 'area') {
      expect(resolved.bounds).toEqual(db.areas.get('area:port-gellhorn')!.bounds);
      expect(resolved.areaName).toBe('Port Gellhorn');
      expect(resolved.placeCount).toBeGreaterThan(0);
      expect(resolved.note).toBeNull();
    }
  });

  it('an area with no extent falls back to the county — and says so', () => {
    const db = buildFullDb();
    // Grassrivers has no positioned members of its own: the county.
    const place = [...db.locations.values()].find(
      (location) => location.areaId === 'area:grassrivers--mariana-county',
    )!;
    expect(place).toBeDefined();
    const cataloguePlace = places.find((candidate) => candidate.id === place.id)!;
    const resolved = resolveViewArea(db, cataloguePlace);
    expect(resolved.kind).toBe('county');
    if (resolved.kind === 'county') {
      expect(resolved.countyId).toBe('mariana');
      expect(resolved.bounds).toEqual(db.areas.get('county:mariana')!.bounds);
      expect(resolved.note).toMatch(/showing the Mariana County extent instead/);
    }
  });

  it('an area with no extent and no county to fall back to moves no camera — just the reason', () => {
    const db = buildFullDb();
    const place = [...db.locations.values()].find(
      (location) => location.areaId === 'area:lost-vista',
    )!;
    expect(place).toBeDefined();
    const cataloguePlace = places.find((candidate) => candidate.id === place.id)!;
    const resolved = resolveViewArea(db, cataloguePlace);
    expect(resolved.kind).toBe('none');
    if (resolved.kind === 'none') {
      expect(resolved.note).toMatch(/No positioned places in Lost Vista/);
    }
  });

  it('without a database, a positioned place still resolves its county by position', () => {
    const place = places.find((candidate) => candidate.id === 'L629')!;
    const resolved = resolveViewArea(null, place);
    expect(resolved.kind).toBe('county');
    if (resolved.kind === 'county') {
      expect(resolved.note).toBeNull();
    }
  });

  it('a place with neither area nor county resolves to none', () => {
    const resolved = resolveViewArea(null, {
      id: 'no-such-place',
      title: 'No Such Place',
      position: null,
    });
    expect(resolved).toEqual({
      kind: 'none',
      note: 'No area or county found for this place.',
    });
  });
});

describe('descendant-aware area filter (step 5)', () => {
  it('a Vice City filter includes Downtown items; exact-match does not', () => {
    const db = buildFullDb();
    // An item whose host sits in a Vice City descendant area.
    const nested = [...db.items.values()].find((item) => {
      const hostArea = item.locationId
        ? db.locations.get(item.locationId)?.areaId
        : item.areaId;
      return (
        hostArea !== null &&
        hostArea !== undefined &&
        hostArea !== 'area:vice-city' &&
        hostArea.startsWith('area:') &&
        hostArea.endsWith('--vice-city')
      );
    });
    expect(nested).toBeDefined();
    const exact = remainingItems(db, { areaId: 'area:vice-city' });
    expect(exact.some((item) => item.id === nested!.id)).toBe(false);
    const subtree = remainingItems(db, {
      areaIds: subtreeAreaIds(db.areas, 'area:vice-city'),
    });
    expect(subtree.some((item) => item.id === nested!.id)).toBe(true);
    expect(subtree.length).toBeGreaterThan(exact.length);
  });

  it('a Port Gellhorn filter includes its children — pinned on a Port-Gellhorn-shaped hierarchy, because today’s data has none', () => {
    // Honest data fact: no "Neighbourhood, Port Gellhorn" region
    // exists in the snapshot, so area:port-gellhorn has no children
    // today and the widened filter equals the exact one. The
    // children rule itself is pinned here on a synthetic
    // Port-Gellhorn-shaped hierarchy (and on the real Vice City
    // hierarchy in the test above).
    const db = buildFullDb();
    const real = subtreeAreaIds(db.areas, 'area:port-gellhorn');
    expect([...real]).toEqual(['area:port-gellhorn']);
    expect(
      remainingItems(db, { areaIds: real }),
    ).toEqual(remainingItems(db, { areaId: 'area:port-gellhorn' }));

    const node = (id: string, childrenIds: string[]): AreaNode => ({
      id,
      name: id,
      path: id,
      level: 'town',
      parentId: null,
      childrenIds,
      locationIds: [],
      bounds: null,
      extentNote: '',
    });
    const synthetic: ReadonlyMap<string, AreaNode> = new Map([
        [
          'area:port-gellhorn',
          node('area:port-gellhorn', [
            'area:downtown--port-gellhorn',
            'area:raceway--port-gellhorn',
          ]),
        ],
        ['area:downtown--port-gellhorn', node('area:downtown--port-gellhorn', [])],
        ['area:raceway--port-gellhorn', node('area:raceway--port-gellhorn', [])],
      ]);
    expect(subtreeAreaIds(synthetic, 'area:port-gellhorn')).toEqual(
      new Set([
        'area:port-gellhorn',
        'area:downtown--port-gellhorn',
        'area:raceway--port-gellhorn',
      ]),
    );
  });

  it('a one-member set behaves exactly like the old exact-match areaId', () => {
    const db = buildFullDb();
    expect(remainingItems(db, { areaIds: ['area:port-gellhorn'] })).toEqual(
      remainingItems(db, { areaId: 'area:port-gellhorn' }),
    );
  });

  it('subtreeAreaIds is the area plus every descendant, deduped', () => {
    const db = buildFullDb();
    const ids = subtreeAreaIds(db.areas, 'area:vice-city');
    expect(ids.has('area:vice-city')).toBe(true);
    expect(ids.has('area:downtown--vice-city')).toBe(true);
    // Every id in the set is the area or a descendant of it.
    for (const id of ids) {
      expect(id === 'area:vice-city' || id.endsWith('--vice-city')).toBe(true);
    }
  });
});

describe('isolation rect — “estimated extent” label (step 5)', () => {
  it('the label text and class are fixed', () => {
    expect(ESTIMATED_EXTENT_TOOLTIP_TEXT).toBe('estimated extent');
    expect(ESTIMATED_EXTENT_TOOLTIP_CLASS).toBe('isolation-extent-label');
  });

  it('the rect binds the permanent tooltip with that text and class', () => {
    const source = readFileSync(
      new URL('../../src/features/map/isolation-layer.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('bindTooltip(ESTIMATED_EXTENT_TOOLTIP_TEXT');
    expect(source).toContain('permanent: true');
    expect(source).toContain('className: ESTIMATED_EXTENT_TOOLTIP_CLASS');
  });

  it('map.css styles the label as a dark chip — never Leaflet’s default pale tooltip', () => {
    const css = readFileSync(
      new URL('../../src/features/map/map.css', import.meta.url),
      'utf8',
    );
    const rule = /\.leaflet-tooltip\.isolation-extent-label \{[^}]*\}/s.exec(css);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain('background: #0b1018d9');
    expect(rule![0]).toContain('pointer-events: none');
    expect(css).toContain('.leaflet-tooltip.isolation-extent-label::before');
  });
});

describe('“Set Route” is gone; “Show on Map” is the button (step 5, §6.3)', () => {
  it('PlaceDetails shows Show on Map and never Set Route', () => {
    const source = readFileSync(
      new URL('../../src/features/library/PlaceDetails.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('Show on Map');
    expect(source).toContain('function showOnMap()');
    expect(source).not.toContain('Set Route');
    expect(source).not.toContain('setRoute');
  });

  it('App carries no stale Set Route comment', () => {
    const source = readFileSync(new URL('../../src/app/App.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('Set Route');
  });

  it('the card names the location’s real Map Index group, not just the app’s filing', () => {
    const source = readFileSync(
      new URL('../../src/features/library/PlaceDetails.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('Map Index');
    expect(source).toContain('mapIndexGroup');
  });
});

describe('forced onboarding is gone from the primary experience (step 5)', () => {
  it('App never opens a welcome wall or a first-open picker', () => {
    const source = readFileSync(new URL('../../src/app/App.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('WelcomeSheet');
    expect(source).not.toContain('firstOpenPlace');
    expect(source).not.toContain('welcomeForced');
    expect(source).not.toContain('welcomeOpen');
    expect(source).not.toContain('firstOpenActive');
  });

  it('the first-open module no longer exports a region-sheet picker', async () => {
    const firstOpen = await import('../../src/features/onboarding/first-open');
    expect('firstOpenPlace' in firstOpen).toBe(false);
    expect('FIRST_OPEN_HINT' in firstOpen).toBe(true);
  });

  it('the welcome sheet file is deleted', () => {
    expect(() =>
      readFileSync(
        new URL('../../src/features/onboarding/WelcomeSheet.tsx', import.meta.url),
        'utf8',
      ),
    ).toThrow();
  });

  it('Settings no longer offers to re-open the welcome wall', () => {
    const source = readFileSync(
      new URL('../../src/features/library/SettingsDialog.tsx', import.meta.url),
      'utf8',
    );
    expect(source).not.toContain('onShowWelcome');
    expect(source).not.toContain('What is mapped');
    // Settings still holds keys, backup, storage status and About.
    expect(source).toContain('Back up my ViceWire');
    expect(source).toContain('OpenAI API key');
    expect(source).toContain('Storage on this device');
    expect(source).toContain('About');
  });
});
