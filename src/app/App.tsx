import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Gem, LayoutGrid, MapPin, MapPinPlus, Palmtree, Scan, Search, ShoppingBag, X } from 'lucide-react';
import { loadCatalogue, markerToPlace } from '../data/catalogue';
import { filterPlaces } from '../domain/filter';
import { userTagsMap } from '../domain/user-tags';
import { DEFAULT_LAYERS, collectiblesChipLayerIds, filterByVisibleLayers } from '../features/map/layers';
import { revealSet } from '../features/spoiler/visibility';
import MapView from '../features/map/MapView';
import BottomNav from './BottomNav';
import MapFilterSheet from '../features/map/MapFilterSheet';
import {
  mapViewFromState,
  saveMapView,
} from '../features/map/view-persistence';
import { INITIAL_BOUNDS } from '../features/map/coordinates';
import { areaIsolation, countyIsolation } from '../features/map/isolation';
import { COUNTIES } from '../data/counties';
import { buildGameDatabase } from '../domain/game-db';
import { AreaSelector } from '../features/map/AreaSelector';
import { AreaSearch } from '../features/map/AreaSearch';
import { AreaPage } from '../features/map/AreaPage';
import { useSearchSplitStore } from '../stores/search-split';
import { saveCamera } from '../features/map/camera-persistence';
import AskPanel from '../features/ask/AskPanel';
import { useAiIndexStore } from '../features/categorise/store';
import {
  FIRST_OPEN_HINT,
  hasDismissedFirstOpen,
  markFirstOpenDismissed,
  selectedSheetClosed,
  shouldDismissFirstOpen,
} from '../features/onboarding/first-open';
import { atlasRegistry } from '../plugins/registry';
import {
  hydrateUserData,
  useDomainStore,
  useMapStore,
  usePersistenceStore,
  useUiStore,
  useUserStore,
  useWorkspaceStore,
} from '../stores/atlas';
import { useCompletionLogStore } from '../features/completion/log-store';
import { useMatchStore } from '../features/ask/match-store';
import {
  completedPlaceIds,
  exploredPlaceIds,
} from '../features/completion/place-ids';
import { Sidebar } from './Sidebar';
import { resolveRoute } from './routes';
import { updateAtlasHead } from './seo';
import type { Place, Position } from '../domain/types';

const PlaceDetails = lazy(() => import('../features/library/PlaceDetails'));
const MarkerEditor = lazy(() => import('../features/editor/MarkerEditor'));
const BackupDialog = lazy(() => import('../features/library/BackupDialog'));
const SettingsDialog = lazy(() => import('../features/library/SettingsDialog'));
const ProjectPage = lazy(() => import('../features/project/ProjectPage'));

let cataloguePromise: ReturnType<typeof loadCatalogue> | undefined;
for (const layer of DEFAULT_LAYERS) {
  if (!atlasRegistry.layers.has(layer.id)) atlasRegistry.registerLayer(layer);
}
if (!atlasRegistry.sources.has('public'))
  atlasRegistry.registerDataSource({ id: 'public', load: loadCatalogue });

export default function App() {
  const [route, setRoute] = useState(() => resolveRoute(location.pathname, location.search));
  const appliedPlaceRoute = useRef<typeof route>(null);
  useEffect(() => { updateAtlasHead(location.pathname, location.search); }, [route]);
  const places = useDomainStore((s) => s.places);
  const status = useDomainStore((s) => s.status);
  const error = useDomainStore((s) => s.error);
  const markers = useUserStore((s) => s.markers);
  /** Step 6: found/explored come from the completion log, never the
   * old visited/explored tables. The log store holds the records;
   * the GameDatabase below is built from them, and every reader in
   * this file goes through its selectors (completedPlaceIds /
   * exploredPlaceIds) — the old tables are an audit trail only. */
  const completionRecords = useCompletionLogStore((s) => s.records);
  const completionReconciliation = useCompletionLogStore((s) => s.reconciliation);
  const completionError = useCompletionLogStore((s) => s.error);
  /** Step 7: confirmed card matches — the GameDatabase below pins
   *  matched slots to their hosts, so a one-tap confirmation in
   *  Collections appears on the map without a reload. */
  const cardMatches = useMatchStore((s) => s.matches);
  const pendingJotSlotId = useMatchStore((s) => s.pendingJotSlotId);
  const placeTags = useUserStore((s) => s.placeTags);
  const favorites = useUserStore((s) => s.favorites);
  const notes = useUserStore((s) => s.notes);
  const collections = useUserStore((s) => s.collections);
  const preferences = useUserStore((s) => s.preferences);
  const filters = useUiStore((s) => s.filters);
  const navTab = useUiStore((s) => s.navTab);
  const findOpen = useUiStore((s) => s.findOpen);
  const filterSheetOpen = useUiStore((s) => s.filterSheetOpen);
  const dialog = useUiStore((s) => s.dialog);
  const editorOpen = useUiStore((s) => s.editorOpen);
  const askOpen = useUiStore((s) => s.askOpen);
  const selectedId = useMapStore((s) => s.selectedId);
  const layers = useMapStore((s) => s.layers);
  const highlightIds = useMapStore((s) => s.highlightIds);
  const highlightSet = useMemo(() => new Set(highlightIds), [highlightIds]);
  const offline = usePersistenceStore((s) => s.offline);
  const aiCategories = useAiIndexStore((s) => s.categories);
  const focus = useMapStore((s) => s.focus);
  const boundsFocus = useMapStore((s) => s.boundsFocus);
  const isolation = useMapStore((s) => s.isolation);
  const editorMode = useMapStore((s) => s.editorMode);
  const draftPosition = useMapStore((s) => s.draftPosition);
  /** First launch (step 5): no welcome wall, no first-open picker —
   * first launch is a clean map plus ONE dismissible hint. The
   * dismissal persists on this device. Auto-dismiss hardening (CI
   * diagnosis): opening any panel dismisses the hint, closing the
   * selected place sheet ends first-open, and turning layers on from
   * the map dismisses it too — so no sheet can ever stack on top of
   * it and intercept the panel controls underneath. */
  const [firstOpenDismissed, setFirstOpenDismissed] = useState(
    () => hasDismissedFirstOpen(),
  );
  const dismissFirstOpen = useCallback(() => {
    setFirstOpenDismissed(true);
    markFirstOpenDismissed();
  }, []);
  /** v0.16.0 — clean launch: the saved view is NEVER re-applied on
   * open. His screenshot had a "27" badge and a wall of pink clusters
   * because a saved "Show everything" came back on its own. The map
   * opens with zero public pins, every time. The camera still
   * resumes — but only when it still shows the whole of Leonida
   * (v0.17.0 gate in camera-persistence.ts); a zoomed-in camera from
   * an old session no longer opens the map on a partial view. Layer
   * and filter choices are still saved on change (below), so a reload
   * keeps them — only the launch itself stays clean. */
  /** Map-view restore gate: layer/filter changes are only saved once the
   * saved view (if any) has been applied — otherwise the first render's
   * blank defaults would overwrite the user's saved layers. */
  const [viewRestored, setViewRestored] = useState(false);
  const allPlaces = useMemo(() => [...places, ...markers.map(markerToPlace)], [places, markers]);
  /** Step 4 (§6) + step 6: the gameplay database — areas and POI
   * search run off this, never off the visible subset. Memoized on
   * the catalogue + markers + the completion log; user data is read
   * live so personal markers become personal locations. A build
   * failure degrades to null (geo features hide) instead of crashing
   * the map. The log is what makes this database records-aware: a
   * journal checkbox and a map pin read the same selectors, so they
   * cannot disagree. */
  const gameDb = useMemo(() => {
    if (status !== 'ready') return null;
    try {
      // Catalogue-only places: buildGameDatabase converts user.markers
      // to places itself, so passing allPlaces (catalogue + marker
      // places) collides with the same markers in `user` and the
      // build throws — which nulled the whole game db (journal,
      // Progress, Ask) on any profile with a marker. (v0.32 demos.)
      return buildGameDatabase({
        places,
        user: useUserStore.getState(),
        records: completionRecords,
        reconciliation: completionReconciliation,
        matches: cardMatches,
      });
    } catch {
      return null;
    }
  }, [status, places, markers, completionRecords, completionReconciliation, cardMatches]);
  const areas = gameDb?.areas ?? null;
  const selectedAreaId = useSearchSplitStore((s) => s.selectedAreaId);
  const areaPageOpen = useSearchSplitStore((s) => s.areaPageOpen);
  const geoOpen = useSearchSplitStore((s) => s.geoOpen);
  const selectedAreaNode =
    selectedAreaId && areas ? (areas.get(selectedAreaId) ?? null) : null;
  const deferredQuery = useDeferredValue(filters.query);
  const filtered = useMemo(
    () =>
      filterByVisibleLayers(
        filterPlaces(
          allPlaces,
          { ...filters, query: deferredQuery },
          favorites.map((f) => f.placeId),
          notes,
          collections,
          gameDb ? [...completedPlaceIds(gameDb)] : [],
          aiCategories,
          userTagsMap(placeTags),
        ).filter((place) =>
          [...atlasRegistry.filters.values()].every((filter) => filter.matches(place)),
        ),
        layers,
      ),
    [allPlaces, filters, deferredQuery, favorites, notes, collections, gameDb, layers, aiCategories, placeTags],
  );
  /** Per-layer found / explored / total for the Progress section.
   * Counts every place in the layer. Explored is separate from found:
   * found is "got the thing", explored is "been here". Both come
   * from the completion log (step 6), never the old tables. */
  const progress = useMemo(() => {
    const found = gameDb ? completedPlaceIds(gameDb) : new Set<string>();
    const seen = gameDb ? exploredPlaceIds(gameDb) : new Set<string>();
    return layers.map((layer) => {
      const total = allPlaces.filter((p) => p.layerId === layer.id).length;
      const done = allPlaces.filter(
        (p) => p.layerId === layer.id && found.has(p.id),
      ).length;
      const checked = allPlaces.filter(
        (p) => p.layerId === layer.id && seen.has(p.id),
      ).length;
      return { layerId: layer.id, name: layer.name, total, found: done, explored: checked };
    });
  }, [allPlaces, gameDb, layers]);
  const anyPublicLayerVisible = layers.some(
    (layer) => layer.visible && layer.id !== 'my-markers',
  );
  /** Positioned places currently matching — what the overlay pill counts. */
  const showingCount = useMemo(
    () => filtered.filter((place) => place.position).length,
    [filtered],
  );
  /** Ask Nylah highlights render even when their layer is off — the
   * question itself was consent to show them, for that answer only.
   * The reveal set is the highlights plus the selected place
   * (features/spoiler/visibility.ts): a revealed place renders with
   * its layer off, and its pin must not vanish while its sheet is
   * open. The Ask panel keeps the true highlight set, so its "Clear
   * highlights (N)" count stays honest. */
  const mapHighlightSet = useMemo(
    () => revealSet(highlightIds, selectedId),
    [highlightIds, selectedId],
  );
  const mapPlaces = useMemo(() => {
    if (mapHighlightSet.size === 0) return filtered;
    const seen = new Set(filtered.map((place) => place.id));
    return [
      ...filtered,
      ...allPlaces.filter((place) => mapHighlightSet.has(place.id) && !seen.has(place.id)),
    ];
  }, [filtered, allPlaces, mapHighlightSet]);
  const selected = useMemo(
    () => allPlaces.find((p) => p.id === selectedId),
    [allPlaces, selectedId],
  );
  const select = useCallback(
    (id: string) => {
      // One sheet at a time: a place pick closes Ask, the area page,
      // Find and the map-filter sheet — and — on a phone — the panel
      // too. The area itself (and its isolation) stay put; only the
      // page closes.
      useSearchSplitStore.getState().setAreaPageOpen(false);
      useUiStore.getState().setAskOpen(false);
      useUiStore.getState().setFindOpen(false);
      useUiStore.getState().setFilterSheetOpen(false);
      if (useUiStore.getState().navTab === 'ask' || window.innerWidth < 1000)
        useUiStore.getState().setNavTab('map');
      const place = allPlaces.find((p) => p.id === id);
      if (place) {
        // Reveal ONE place only (v0.30.0): the tap reveals that place
        // — its pin renders and its sheet opens — but its layer stays
        // exactly as it was, so no unrelated marker appears with it.
        // Turning a whole layer on is a separate, explicit action
        // (a Layers checkbox, a map chip, "Show everything").
        // Previously this turned the place's layer on, so a Find tap,
        // an Ask card or a deep link switched on every marker in
        // that layer as a side effect.
        useMapStore.getState().setHighlights([place.id]);
        useMapStore.getState().select(place);
      }
    },
    [allPlaces],
  );
  /** Exit area isolation: back to all of Leonida, filters and map. */
  const exitIsolation = useCallback(() => {
    useSearchSplitStore.getState().selectArea(null);
    useUiStore.getState().setFilters({ countyId: null, area: null });
    useMapStore.getState().setIsolation(null);
    useMapStore.getState().setBoundsFocus(INITIAL_BOUNDS);
  }, []);
  /** Select an area (§6.3): focus its OWN bounds (the member bbox,
   * not the whole county) and dim outside it; a county uses its
   * traced isolation; an area with no extent shows its member list
   * with no camera move. Selecting an area never touches a layer. */
  const selectArea = useCallback(
    (areaId: string | null) => {
      const store = useSearchSplitStore.getState();
      if (areaId === null) {
        exitIsolation();
        return;
      }
      const node = gameDb?.areas.get(areaId);
      if (!node) return;
      store.selectArea(areaId);
      store.setGeoOpen(false);
      if (node.level === 'state') {
        exitIsolation();
        return;
      }
      if (node.level === 'county') {
        const county = COUNTIES.find((c) => `county:${c.id}` === areaId);
        if (!county) return;
        useUiStore.getState().setFilters({ countyId: county.id, area: null });
        useMapStore.getState().setBoundsFocus(county.bounds);
        useMapStore.getState().setIsolation(countyIsolation(county));
        return;
      }
      useUiStore.getState().setFilters({ area: node.path, countyId: null });
      if (node.bounds) {
        useMapStore.getState().setIsolation({
          label: node.name,
          subtitle: `${node.locationIds.length.toLocaleString()} places`,
          bounds: node.bounds,
        });
        useMapStore.getState().setBoundsFocus(node.bounds);
      } else {
        // No positioned places: the member list, not a camera move.
        useMapStore.getState().setIsolation(null);
      }
    },
    [gameDb, exitIsolation],
  );
  /** Restore a saved area isolation once the catalogue is in — the
   * area's bounds come from its own places, so this waits for them. */
  useEffect(() => {
    if (status !== 'ready') return;
    const area = useUiStore.getState().filters.area;
    if (area && !useMapStore.getState().isolation) {
      const iso = areaIsolation(area, allPlaces);
      if (iso) {
        useMapStore.getState().setIsolation(iso);
        useMapStore.getState().setBoundsFocus(iso.bounds);
      }
    }
  }, [status, allPlaces]);
  /** Turn layers on from the empty-map prompt: one tap, pins appear
   * immediately. "Everything" is every public layer — the user's tap
   * is the consent to show it all. Turning anything on ends
   * first-open: the hint's "everything is off" is no longer true. */
  const turnOnLayers = useCallback((layerIds: string[] | 'all') => {
    dismissFirstOpen();
    useMapStore.getState().setLayers(
      useMapStore
        .getState()
        .layers.map((layer) =>
          layer.id === 'my-markers'
            ? layer
            : layerIds === 'all' || layerIds.includes(layer.id)
              ? { ...layer, visible: true }
              : layer,
        ),
    );
  }, [dismissFirstOpen]);
  /** Map chips (v0.16.0, reference row: All / Locations / Activities /
   * Stores / Collectibles): one group on, the rest off — the map stays
   * fast and readable. "All" is the only one that turns everything on,
   * and only on an explicit tap. */
  const showOnlyLayers = useCallback((layerIds: string[] | 'all') => {
    // A chip tap is an explicit "show places" — first-open ends.
    dismissFirstOpen();
    useMapStore.getState().setLayers(
      useMapStore
        .getState()
        .layers.map((layer) =>
          layer.id === 'my-markers'
            ? layer
            : layerIds === 'all' || layerIds.includes(layer.id)
              ? { ...layer, visible: true }
              : { ...layer, visible: false },
        ),
    );
  }, [dismissFirstOpen]);
  const chipGroups: { id: string; label: string; icon: typeof LayoutGrid; layers: string[] | 'all' }[] = [
    { id: 'all', label: 'All', icon: LayoutGrid, layers: 'all' },
    { id: 'locations', label: 'Locations', icon: MapPin, layers: ['regions', 'community'] },
    {
      id: 'activities',
      label: 'Activities',
      icon: Palmtree,
      layers: ['interiors', 'breakable', 'gyms', 'equipment'],
    },
    { id: 'stores', label: 'Stores', icon: ShoppingBag, layers: ['shops-food', 'shops-vehicles', 'shops-weapons', 'shops-style', 'lootable'] },
    {
      id: 'collectibles',
      label: 'Collectibles',
      icon: Gem,
      layers: collectiblesChipLayerIds(layers),
    },
  ];
  const activeChip = useMemo(() => {
    const visible = new Set(layers.filter((l) => l.visible && l.id !== 'my-markers').map((l) => l.id));
    if (visible.size === 0) return null;
    for (const chip of chipGroups) {
      if (chip.layers === 'all') {
        if (visible.size === layers.filter((l) => l.id !== 'my-markers').length) return 'all';
      } else if (
        chip.layers.length > 0 &&
        chip.layers.every((id) => visible.has(id)) &&
        [...visible].every((id) => chip.layers.includes(id))
      ) {
        return chip.id;
      }
    }
    return null;
  }, [layers]);
  /** Clear every filter and lift the isolation: back to all of Leonida. */
  const clearFiltersAndIsolation = useCallback(() => {
    useUiStore.getState().resetFilters();
    useMapStore.getState().setIsolation(null);
    useMapStore.getState().setBoundsFocus(INITIAL_BOUNDS);
  }, []);
  const goToTab = useCallback((tab: 'map' | 'collections' | 'progress' | 'ask') => {
    if (tab === 'ask') {
      useMapStore.getState().select(null);
      useUiStore.getState().setAskOpen(true);
      useUiStore.getState().setNavTab('ask');
      return;
    }
    useUiStore.getState().setAskOpen(false);
    useUiStore.getState().setNavTab(tab);
    // Map is the clean tab: Find and the filter sheet close with it.
    useUiStore.getState().setFindOpen(false);
    useUiStore.getState().setFilterSheetOpen(false);
    if (tab !== 'map' && window.innerWidth < 1000) useMapStore.getState().select(null);
  }, []);
  const closeAsk = useCallback(() => {
    useUiStore.getState().setAskOpen(false);
    if (useUiStore.getState().navTab === 'ask') useUiStore.getState().setNavTab('map');
  }, []);
  /** One tap on a house-to-check (Ask, the Find hint, or a place
   * detail): start a workout-equipment marker at that place's position.
   * The observation becomes real data; nothing is invented. */
  const markWorkoutAt = useCallback((place: Place) => {
    if (!place.position) return;
    closeAsk();
    useUiStore.getState().setNavTab('map');
    useMapStore.getState().setMarkerKindPreset('workout');
    useMapStore.getState().setEditor('create');
    useMapStore.getState().setPosition(place.position);
    useUiStore.getState().setEditorOpen(true);
  }, [closeAsk]);
  /** One tap on a house (place detail): start a breakable-home marker
   * at that place's position, with the loot notes in the description.
   * Breakable homes are systemic — dark blue on the in-game map means
   * you can go in — so the user's own marks are the only way the
   * untagged ones get on the map. */
  const markBreakableAt = useCallback((place: Place) => {
    if (!place.position) return;
    closeAsk();
    useUiStore.getState().setNavTab('map');
    useMapStore.getState().setMarkerKindPreset('breakable');
    useMapStore.getState().setEditor('create');
    useMapStore.getState().setPosition(place.position);
    useUiStore.getState().setEditorOpen(true);
  }, [closeAsk]);
  const placePosition = useCallback((position: Position) => {
    useMapStore.getState().setPosition(position);
    useUiStore.getState().setEditorOpen(true);
  }, []);
  const closeEditor = useCallback(() => {
    useUiStore.getState().setEditorOpen(false);
    useMapStore.getState().setEditor('none');
    useMapStore.getState().setMarkerKindPreset(null);
  }, []);
  const closeDialog = useCallback(() => useUiStore.getState().setDialog(null), []);
  const goMap = useCallback(() => {
    history.pushState({}, '', import.meta.env.BASE_URL);
    setRoute(resolveRoute(location.pathname, location.search));
  }, []);
  function goAbout() {
    history.pushState({}, '', `${import.meta.env.BASE_URL}about`);
    setRoute(resolveRoute(location.pathname, location.search));
  }
  /** Long-press / right-click on the map: start a marker right there. */
  const beginMarkerAt = useCallback((position: Position) => {
    useMapStore.getState().setMarkerKindPreset(null);
    useMapStore.getState().setEditor('create');
    useMapStore.getState().setPosition(position);
    useUiStore.getState().setEditorOpen(true);
    if (window.innerWidth < 1000) useUiStore.getState().setNavTab('map');
  }, []);
  /** The jot flow (step 7): "Mark it yourself" in the matcher panel
   *  (or the jot offer on an Ask confirm) arms a slot; the next
   *  marker the player saves becomes that card's host, evidence
   *  'personal'. The arm is visible in the panel until the marker
   *  lands or the player cancels — a stale arm never silently links
   *  an unrelated marker, because the panel says plainly that the
   *  next marker saved is the card's spot. */
  const prevMarkersRef = useRef(markers);
  useEffect(() => {
    const prev = prevMarkersRef.current;
    prevMarkersRef.current = markers;
    if (!pendingJotSlotId || !gameDb) return;
    const added = markers.filter(
      (marker) => !prev.some((entry) => entry.id === marker.id),
    );
    if (added.length === 0) return;
    const slot = gameDb.items.get(pendingJotSlotId);
    if (!slot) return;
    const marker = added[added.length - 1]!;
    void useMatchStore
      .getState()
      .recordJotMatch(slot, marker)
      .then(() => {
        useMatchStore.getState().clearPendingJot();
      });
  }, [markers, pendingJotSlotId, gameDb]);
  useEffect(() => {
    useAiIndexStore.getState().load();
    useMapStore.getState().setLayers([...atlasRegistry.layers.values()]);
    // v0.16.0: restore NOTHING visible on launch (step 5: the
    // "Restore my last layers" offer died with the first-open sheet
    // that carried it — the saved view is still written on change,
    // so a reload keeps the user's layers, but launch itself never
    // re-applies anything). Camera, county and filters stay off:
    // clean map first.
    setViewRestored(true);
    void hydrateUserData();
    /** Step 6: the v3→v4 completion migration runs on startup, not
     * only on backup import. Until now ensureCompletionMigration ran
     * only from backup-import.ts:217 — a player who never restored a
     * backup kept the old visited/explored/tallies state unmigrated
     * and the new surfaces read an empty log. The migration is
     * idempotent (deterministic record ids, put-only writes), so a
     * second launch is a no-op; a failure is stored in the log
     * store and surfaced as a banner with a retry below. */
    void useCompletionLogStore.getState().load();
    // Step 7: confirmed matches, attempts and rejections load with
    // the log — the matcher review list and the pinned slots are
    // live from the first render.
    void useMatchStore.getState().load();
    cataloguePromise ??= Promise.all(
      [...atlasRegistry.sources.values()].map((source) => source.load()),
    ).then((batches) => batches.flat());
    void cataloguePromise
      .then((p) => useDomainStore.getState().setPlaces(p))
      .catch(() =>
        useDomainStore
          .getState()
          .fail('The public catalogue could not be loaded. Reload to retry.'),
      );
    const network = (event: Event) =>
      usePersistenceStore.setState({ offline: event.type === 'offline' });
    const pop = () => setRoute(resolveRoute(location.pathname, location.search));
    window.addEventListener('online', network);
    window.addEventListener('offline', network);
    window.addEventListener('popstate', pop);
    const keyboard = (event: KeyboardEvent) => {
      const editing =
        event.target instanceof HTMLElement &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) ||
          event.target.isContentEditable);
      if (event.key === '/' && !editing && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        // Find is a search overlay on the Map tab now, not a nav tab.
        useUiStore.getState().setFindOpen(true);
        requestAnimationFrame(() => document.getElementById('atlas-search')?.focus());
      }
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
        useMapStore.getState().setEditor('none');
        useMapStore.getState().select(null);
      }
    };
    document.addEventListener('keydown', keyboard);
    const channel =
      typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('leonida-atlas-local') : null;
    channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
      const data = event.data;
      const ownWorkspace = useWorkspaceStore.getState().workspaceId;
      const matches =
        data === 'saved'
          ? ownWorkspace === null
          : typeof data === 'object' &&
            data !== null &&
            'workspaceId' in data &&
            data.workspaceId === ownWorkspace;
      // A save in another tab reloads the user data AND the AI index
      // here — the index is device-global, so a batch finished in the
      // other tab is this tab's progress too. The runner's own
      // post-batch reload (store.applyBatch) already keeps a running
      // job current; this covers imports and confirmations made
      // elsewhere.
      if (matches && usePersistenceStore.getState().status !== 'saving') {
        void hydrateUserData();
        void useCompletionLogStore.getState().refresh();
        void useMatchStore.getState().refresh();
        void useAiIndexStore.getState().reloadFromDatabase();
      }
    });
    const unlisten = atlasRegistry.on('saved', () =>
      channel?.postMessage({ workspaceId: useWorkspaceStore.getState().workspaceId }),
    );
    return () => {
      window.removeEventListener('online', network);
      window.removeEventListener('offline', network);
      window.removeEventListener('popstate', pop);
      document.removeEventListener('keydown', keyboard);
      unlisten();
      channel?.close();
    };
  }, []);
  useEffect(() => {
    if (!route.placeId || status !== 'ready' || appliedPlaceRoute.current === route) return;
    const place = allPlaces.find((p) => p.id === route.placeId);
    if (!place) return;
    appliedPlaceRoute.current = route;
    select(place.id);
  }, [route, status, allPlaces, select]);
  /** Auto-dismiss hardening (step 5, CI diagnosis): opening any
   * panel — a tab, Find, the map-filter sheet, or Ask — dismisses
   * the first-open hint, so a sheet can never sit on top of the
   * panel controls and intercept them on a phone. */
  useEffect(() => {
    if (shouldDismissFirstOpen({ navTab, askOpen, findOpen, filterSheetOpen })) {
      dismissFirstOpen();
    }
  }, [navTab, askOpen, findOpen, filterSheetOpen, dismissFirstOpen]);
  /** The selected-sheet Close ends first-open: closing the place
   * sheet means the player has started using the map. (Opening a
   * place does not dismiss it — the hint is already hidden while a
   * sheet is open.) */
  const previousSelectedId = useRef<string | null>(null);
  useEffect(() => {
    const prev = previousSelectedId.current;
    previousSelectedId.current = selectedId;
    if (selectedSheetClosed(prev, selectedId)) dismissFirstOpen();
  }, [selectedId, dismissFirstOpen]);
  /** A reveal's pin must not vanish when its sheet closes (v0.30.0).
   * The focus had centred the place above the sheet, so after the
   * sheet closes the pin sits under the top chrome and the pin clamp
   * hides it — while the highlight itself is still there (Ask still
   * shows "Clear highlights (1)"). When the selection closes on a
   * place that stays visible (still revealed, or its layer is on),
   * glide it to the centre of the visible band with no sheet offset,
   * so the pin lands mid-screen and stays on the map. Only the
   * deselect transition fires this — layer toggles, pans and zooms
   * never move the camera. If the reveal was cleared too, nothing
   * stays visible, so the camera stays put. */
  const previousSelectedForReveal = useRef<string | null>(null);
  useEffect(() => {
    const prev = previousSelectedForReveal.current;
    previousSelectedForReveal.current = selectedId;
    if (prev === null || selectedId !== null) return;
    const place = allPlaces.find((p) => p.id === prev);
    if (!place?.position) return;
    const stillVisible =
      highlightIds.includes(prev) ||
      layers.some((l) => l.id === place.layerId && l.visible);
    if (!stillVisible) return;
    useMapStore.getState().setFocus(place.position);
  }, [selectedId, highlightIds, allPlaces, layers]);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
  }, [preferences.reducedMotion]);
  /** Persist layer + filter choices on this device, so a reload or PWA
   * restart brings the map back exactly as the user left it. */
  useEffect(() => {
    if (!viewRestored || layers.length === 0) return;
    saveMapView(
      mapViewFromState(
        layers.filter((layer) => layer.visible).map((layer) => layer.id),
        filters,
      ),
    );
  }, [layers, filters, viewRestored]);
  if (route.view === 'project')
    return (
      <Suspense fallback={<div className="full-loading">Loading project information…</div>}>
        <ProjectPage page={route.page} onClose={goMap} />
      </Suspense>
    );
  return (
    <main className="atlas-app" data-details={Boolean(selected)}>
      <a className="skip-link" href="#atlas-map-region">
        Skip to map
      </a>
      <div className="atlas-main">
      <Sidebar
        places={filtered}
        allPlaces={allPlaces}
        db={gameDb}
        progress={progress}
        anyPublicLayerVisible={anyPublicLayerVisible}
        showingCount={showingCount}
        onSelect={select}
      />
      <section className="map-workspace" id="atlas-map-region" aria-label="Interactive Leonida map">
        <MapView
          places={mapPlaces}
          layers={layers}
          selectedId={selectedId}
          focus={focus}
          boundsFocus={boundsFocus}
          isolation={isolation}
          onExitIsolation={exitIsolation}
          areas={areas ?? undefined}
          selectedAreaId={selectedAreaId}
          onSelectArea={selectArea}
          hideIsolationPill={areaPageOpen}
          promptVisible={navTab === 'map' && !selected && status === 'ready' && showingCount === 0 && anyPublicLayerVisible}
          editorMode={editorMode}
          preferences={preferences}
          foundIds={gameDb ? completedPlaceIds(gameDb) : new Set<string>()}
          exploredIds={gameDb ? exploredPlaceIds(gameDb) : new Set<string>()}
          highlightIds={mapHighlightSet}
          aiCategories={aiCategories}
          onSelect={select}
          onPlacePosition={placePosition}
          onAddMarkerAt={beginMarkerAt}
          onViewport={(viewport) => {
            useMapStore.getState().setMapCenter(viewport.center);
            // Resume where the player left off: the camera is saved
            // on every moveend/zoomend and restored on the next open
            // — but only if it still shows the whole of Leonida
            // (v0.17.0 gate in MapView: a zoomed-in saved camera is
            // ignored and the map fits all of Leonida instead).
            saveCamera({ center: viewport.center, zoom: viewport.zoom });
          }}
        />
        {navTab === 'map' && !selected && (
          <div className="map-hero">
            <div className="map-hero-banner" aria-hidden="true">
              <img
                src={`${import.meta.env.BASE_URL}assets/after-hours/hero-sunset.jpg`}
                alt=""
              />
              <div className="map-hero-titles">
                {/* v0.21.0 VICEWIRE (Option A, The Network): the bold
                 * geometric V mark (drawn vector, not lifted from the
                 * concept boards) beside the wordmark — VICE in ivory,
                 * WIRE in coral — with "GTA VI · Leonida" as the
                 * context line, not the product name. */}
                <img
                  className="map-hero-mark"
                  src={`${import.meta.env.BASE_URL}favicon.svg`}
                  alt=""
                  aria-hidden="true"
                />
                <span className="map-hero-names">
                  <span className="map-hero-brand vicewire">
                    <span className="vicewire-vice">VICE</span>
                    <span className="vicewire-wire">WIRE</span>
                  </span>
                  <span className="map-hero-sub">GTA VI · Leonida</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              className="map-search-pill"
              onClick={() => {
                // Find is a search overlay on the Map tab now.
                useUiStore.getState().setFindOpen(true);
                requestAnimationFrame(() =>
                  document.getElementById('atlas-search')?.focus(),
                );
              }}
            >
              <Search size={18} />
              <span>Search Leonida…</span>
              <span className="map-search-expand" aria-hidden="true">
                <Scan size={16} />
              </span>
            </button>
            <div className="map-chips" role="group" aria-label="Quick filters">
              {chipGroups.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  className={`map-chip ${activeChip === chip.id ? 'is-active' : ''}`}
                  aria-pressed={activeChip === chip.id}
                  onClick={() => showOnlyLayers(chip.layers)}
                >
                  <chip.icon size={15} aria-hidden="true" />
                  {chip.label}
                </button>
              ))}
            </div>
            {areas && (
              <AreaSelector
                nodes={areas}
                selectedAreaId={selectedAreaId}
                onSelectArea={selectArea}
                onOpenGeoSearch={() => {
                  useSearchSplitStore.getState().setAreaPageOpen(false);
                  useSearchSplitStore.getState().setGeoOpen(true);
                }}
              />
            )}
          </div>
        )}
        {/* Permanent area selector (§6.3): when the hero is hidden
          (a place is open, or another tab), the selector still sits
          on the map, top-left. */}
        {areas && !(navTab === 'map' && !selected) && (
          <div className="area-selector-standalone">
            <AreaSelector
              nodes={areas}
              selectedAreaId={selectedAreaId}
              onSelectArea={selectArea}
              onOpenGeoSearch={() => {
                useSearchSplitStore.getState().setAreaPageOpen(false);
                useSearchSplitStore.getState().setGeoOpen(true);
              }}
            />
          </div>
        )}
        {geoOpen && areas && (
          <AreaSearch
            nodes={areas}
            onSelectArea={selectArea}
            onClose={() => useSearchSplitStore.getState().setGeoOpen(false)}
          />
        )}
        {areaPageOpen && selectedAreaNode && gameDb && (
          <AreaPage
            node={selectedAreaNode}
            nodes={areas!}
            db={gameDb}
            onSelectArea={selectArea}
            onSelectPlace={select}
            onClose={() => selectArea(null)}
          />
        )}
        {/* Step 5: the v0.26 first-open region sheet is gone — first
         * launch is a clean map plus the single dismissible hint
         * (below). What remains of the prompt is the second case
         * only: layers are on but nothing matches here, so the map
         * would otherwise look broken with no explanation. One
         * compact bar, same buttons, never the centre of the map. */}
        {navTab === 'map' && !selected && status === 'ready' && showingCount === 0 && anyPublicLayerVisible ? (
          <div className="empty-map-prompt" role="status">
            <strong>Nothing showing here</strong>
            <p>
              Layers are on, but nothing matches in this area with these filters.
            </p>
            <div className="empty-map-buttons">
              <button type="button" onClick={clearFiltersAndIsolation}>
                Clear filters
              </button>
              <button type="button" onClick={() => turnOnLayers('all')}>
                Show everything
              </button>
            </div>
          </div>
        ) : null}
        {/* First-open hint (step 5): the single dismissible hint —
         * no wall, no picker. Only while nothing is showing yet;
         * opening any panel, closing the place sheet, or turning
         * layers on dismisses it for good (persisted). */}
        {navTab === 'map' &&
          !selected &&
          !filterSheetOpen &&
          !findOpen &&
          status === 'ready' &&
          !firstOpenDismissed &&
          !anyPublicLayerVisible && (
            <div className="first-open-hint" role="status">
              <span>{FIRST_OPEN_HINT}</span>
              <button
                type="button"
                className="icon-button"
                aria-label="Dismiss hint"
                onClick={dismissFirstOpen}
              >
                <X size={16} />
              </button>
            </div>
          )}
        {/* Contextual map-filter sheet (step 5): filters only — the
          old Layers sheet, minus everything that is not a filter. */}
        {filterSheetOpen && (
          <MapFilterSheet
            progress={progress}
            onClose={() => useUiStore.getState().setFilterSheetOpen(false)}
          />
        )}
        <AskPanel
          places={allPlaces}
          layers={layers}
          filters={filters}
          aiCategories={aiCategories}
          userTags={userTagsMap(placeTags)}
          visitedIds={gameDb ? [...completedPlaceIds(gameDb)] : []}
          offline={offline}
          onSelect={select}
          onClearHighlights={() => useMapStore.getState().clearHighlights()}
          highlightIds={highlightSet}
          onOpenSettings={() => useUiStore.getState().setDialog('settings')}
          open={askOpen}
          onClose={closeAsk}
          onMarkWorkout={markWorkoutAt}
          db={gameDb}
        />
        {status === 'error' && (
          <div className="map-notice inline-error" role="alert">
            {error}
            <button className="text-button" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        )}
        {completionError && (
          <div className="map-notice inline-error" role="alert">
            Your old completion marks could not be migrated to the new log — nothing was
            lost, and the old marks are still on this device. {completionError}{' '}
            <button
              className="text-button"
              onClick={() => void useCompletionLogStore.getState().load()}
            >
              Retry migration
            </button>
          </div>
        )}
        {editorMode !== 'none' && (
          <div className="placement-notice" role="status">
            <MapPinPlus size={19} />
            <span>
              {editorMode === 'create'
                ? 'Click the map to place your marker — or long-press the map anywhere'
                : 'Click a new position for this marker'}
            </span>
            <button
              className="text-button"
              onClick={() => useUiStore.getState().setEditorOpen(true)}
            >
              Enter coordinates
            </button>
            <button className="icon-button" aria-label="Cancel placement" onClick={closeEditor}>
              <X size={18} />
            </button>
          </div>
        )}
      </section>
      <Suspense
        fallback={
          <div className="loading-panel" role="status">
            Opening panel…
          </div>
        }
      >
        {selected && (
          <PlaceDetails
            key={selected.id}
            place={selected}
            allPlaces={allPlaces}
            db={gameDb}
            onAddMarkerHere={beginMarkerAt}
            onMarkWorkout={markWorkoutAt}
            onMarkBreakable={markBreakableAt}
          />
        )}
        {editorOpen && <MarkerEditor position={draftPosition} onClose={closeEditor} />}
        {dialog === 'backup' && <BackupDialog onClose={closeDialog} />}
        {dialog === 'settings' && (
          <SettingsDialog
            onClose={closeDialog}
            onOpenBackup={() => useUiStore.getState().setDialog('backup')}
            onOpenAbout={goAbout}
          />
        )}
      </Suspense>
      </div>
      <BottomNav onNavigate={goToTab} />
    </main>
  );
}
