import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Gem, LayoutGrid, MapPin, MapPinPlus, Palmtree, Scan, Search, ShoppingBag, X } from 'lucide-react';
import { loadCatalogue, markerToPlace } from '../data/catalogue';
import { filterPlaces } from '../domain/filter';
import { userTagsMap } from '../domain/user-tags';
import { DEFAULT_LAYERS, filterByVisibleLayers } from '../features/map/layers';
import MapView from '../features/map/MapView';
import BottomNav from './BottomNav';
import {
  loadSavedMapView,
  mapViewFromState,
  savedLayersOffer,
  saveMapView,
} from '../features/map/view-persistence';
import { INITIAL_BOUNDS } from '../features/map/coordinates';
import { areaIsolation } from '../features/map/isolation';
import { saveCamera } from '../features/map/camera-persistence';
import AskPanel from '../features/ask/AskPanel';
import { useAiIndexStore } from '../features/categorise/store';
import WelcomeSheet from '../features/onboarding/WelcomeSheet';
import { firstOpenPlace } from '../features/onboarding/first-open';
import {
  hasSeenIndexOnboarding,
  markIndexOnboardingSeen,
} from '../features/onboarding/onboarding';
import { explorerPath } from '../features/explorer/public-path';
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
import { Sidebar } from './Sidebar';
import { resolveRoute } from './routes';
import { updateAtlasHead } from './seo';
import type { Place, Position } from '../domain/types';

const PlaceDetails = lazy(() => import('../features/library/PlaceDetails'));
const MarkerEditor = lazy(() => import('../features/editor/MarkerEditor'));
const BackupDialog = lazy(() => import('../features/library/BackupDialog'));
const SettingsDialog = lazy(() => import('../features/library/SettingsDialog'));
const ExplorerView = lazy(() => import('../features/explorer/ExplorerView'));
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
  const visited = useUserStore((s) => s.visited);
  const explored = useUserStore((s) => s.explored);
  const placeTags = useUserStore((s) => s.placeTags);
  const favorites = useUserStore((s) => s.favorites);
  const notes = useUserStore((s) => s.notes);
  const collections = useUserStore((s) => s.collections);
  const preferences = useUserStore((s) => s.preferences);
  const filters = useUiStore((s) => s.filters);
  const navTab = useUiStore((s) => s.navTab);
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
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  /** First-open region sheet (v0.26.0): the map opens blank on
   * purpose, so the first thing a new player sees is the Vice City
   * region sheet — not the "nothing showing yet" banner. Dismissed
   * once per session: closing the sheet (or picking layers from it)
   * never re-opens it, and the fired ref stops it coming back after
   * the layers are turned off again. */
  const [firstOpenDismissed, setFirstOpenDismissed] = useState(false);
  const [firstOpenActive, setFirstOpenActive] = useState(false);
  const firstOpenFired = useRef(false);
  /** v0.16.0 — clean launch: the saved view is NEVER re-applied on
   * open. His screenshot had a "27" badge and a wall of pink clusters
   * because a saved "Show everything" came back on its own. The map
   * opens with zero public pins, every time; the saved layers are kept
   * aside here so the empty-map prompt can offer them back in one tap.
   * The camera still resumes — but only when it still shows the
   * whole of Leonida (v0.17.0 gate in camera-persistence.ts); a
   * zoomed-in camera from an old session no longer opens the map
   * on a partial view. */
  const [lastSession, setLastSession] = useState<{ layerIds: string[] } | null>(null);
  /** First launch after v0.11.0 is forced (no ×, no Escape); reopening
   * it from the panel footer ("What is mapped") is dismissable. */
  const [welcomeForced, setWelcomeForced] = useState(true);
  /** Map-view restore gate: layer/filter changes are only saved once the
   * saved view (if any) has been applied — otherwise the first render's
   * blank defaults would overwrite the user's saved layers. */
  const [viewRestored, setViewRestored] = useState(false);
  function closeWelcome() {
    markIndexOnboardingSeen();
    setWelcomeOpen(false);
  }
  function quickStart(layerId: string) {
    useMapStore
      .getState()
      .setLayers(
        useMapStore
          .getState()
          .layers.map((layer) =>
            layer.id === layerId ? { ...layer, visible: true } : layer,
          ),
      );
    markIndexOnboardingSeen();
    setWelcomeOpen(false);
  }
  /** Onboarding "Start sorting": close, open Layers, and tell the
   * index panel to start the job (it mounts with Layers). */
  function startIndexing() {
    markIndexOnboardingSeen();
    setWelcomeOpen(false);
    useAiIndexStore.getState().requestIndexStart();
    useUiStore.getState().setAskOpen(false);
    useUiStore.getState().setNavTab('layers');
  }
  const persistenceLoading = usePersistenceStore((s) => s.status === 'loading');
  const workspaceRevision = useWorkspaceStore((s) => s.revision);
  const allPlaces = useMemo(() => [...places, ...markers.map(markerToPlace)], [places, markers]);
  /** First run: once the catalogue is loaded, the forced indexing
   * onboarding shows BEFORE the map is usable — it is the one thing
   * that cannot be skipped past with an ×. A new key (v0.11.0) means
   * everyone sees it once after this update, even users who already
   * dismissed the old welcome sheet. A ?place= deep link opens
   * straight to the place instead (v0.26.0): the welcome must not
   * intercept it — the sheet would sit on top of the place the link
   * names until Skip is tapped. A dead link (no such place once the
   * catalogue is in) does not block the welcome. */
  useEffect(() => {
    if (status !== 'ready' || hasSeenIndexOnboarding()) return;
    if (route.placeId && allPlaces.some((p) => p.id === route.placeId)) return;
    setWelcomeForced(true);
    setWelcomeOpen(true);
  }, [status, route.placeId, allPlaces]);
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
          visited.map((v) => v.placeId),
          aiCategories,
          userTagsMap(placeTags),
        ).filter((place) =>
          [...atlasRegistry.filters.values()].every((filter) => filter.matches(place)),
        ),
        layers,
      ),
    [allPlaces, filters, deferredQuery, favorites, notes, collections, visited, layers, aiCategories, placeTags],
  );
  /** Per-layer found / explored / total for the Progress section.
   * Counts every place in the layer. Explored is separate from found:
   * found is "got the thing", explored is "been here". */
  const progress = useMemo(() => {
    const found = new Set(visited.map((v) => v.placeId));
    const seen = new Set(explored.map((e) => e.placeId));
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
  }, [allPlaces, visited, explored, layers]);
  const anyPublicLayerVisible = layers.some(
    (layer) => layer.visible && layer.id !== 'my-markers',
  );
  /** Positioned places currently matching — what the overlay pill counts. */
  const showingCount = useMemo(
    () => filtered.filter((place) => place.position).length,
    [filtered],
  );
  /** Ask Nylah highlights render even when their layer is off — the
   * question itself was consent to show them, for that answer only. */
  const mapPlaces = useMemo(() => {
    if (highlightIds.length === 0) return filtered;
    const seen = new Set(filtered.map((place) => place.id));
    return [
      ...filtered,
      ...allPlaces.filter((place) => highlightSet.has(place.id) && !seen.has(place.id)),
    ];
  }, [filtered, allPlaces, highlightIds, highlightSet]);
  const selected = useMemo(
    () => allPlaces.find((p) => p.id === selectedId),
    [allPlaces, selectedId],
  );
  const select = useCallback(
    (id: string) => {
      // One sheet at a time: a place pick closes Ask, and on a phone it
      // closes the panel too — the detail is the sheet now open.
      useUiStore.getState().setAskOpen(false);
      if (useUiStore.getState().navTab === 'ask' || window.innerWidth < 1000)
        useUiStore.getState().setNavTab('map');
      const place = allPlaces.find((p) => p.id === id);
      if (place) {
        // An explicit tap is the user choosing to reveal that place: turn its
        // layer on so a deep link or a search result is never a dead end.
        if (place.layerId !== 'my-markers') {
          const current = useMapStore.getState().layers;
          if (current.some((l) => l.id === place.layerId && !l.visible)) {
            useMapStore
              .getState()
              .setLayers(
                current.map((l) =>
                  l.id === place.layerId ? { ...l, visible: true } : l,
                ),
              );
          }
        }
        useMapStore.getState().select(place);
      }
    },
    [allPlaces],
  );
  /** Exit area isolation: back to all of Leonida, filters and map. */
  const exitIsolation = useCallback(() => {
    useUiStore.getState().setFilters({ countyId: null, area: null });
    useMapStore.getState().setIsolation(null);
    useMapStore.getState().setBoundsFocus(INITIAL_BOUNDS);
  }, []);
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
   * is the consent to show it all. */
  const turnOnLayers = useCallback((layerIds: string[] | 'all') => {
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
  }, []);
  /** v0.16.0: bring back the layers from the last session — the one
   * tap the clean launch offers instead of restoring them itself. */
  const restoreLastSession = useCallback(() => {
    if (!lastSession) return;
    turnOnLayers(lastSession.layerIds);
    setLastSession(null);
  }, [lastSession, turnOnLayers]);
  /** First-open sheet (v0.26.0): picking layers from the sheet turns
   * them on and closes the sheet, so the pins appear on the map the
   * user was just looking at. Closing it with the × dismisses it for
   * the session — the map stays clean, and the chips on the map are
   * the way back to turning things on. */
  const closeFirstOpen = useCallback(() => {
    setFirstOpenActive(false);
    setFirstOpenDismissed(true);
  }, []);
  const pickFirstOpenLayers = useCallback(
    (layerIds: string[] | 'all') => {
      turnOnLayers(layerIds);
      closeFirstOpen();
      useMapStore.getState().select(null);
    },
    [turnOnLayers, closeFirstOpen],
  );
  const restoreFirstOpen = useCallback(() => {
    restoreLastSession();
    closeFirstOpen();
    useMapStore.getState().select(null);
  }, [restoreLastSession, closeFirstOpen]);
  const firstOpenProps = useMemo(
    () => ({
      onPickLayers: pickFirstOpenLayers,
      lastSession,
      onRestore: restoreFirstOpen,
    }),
    [pickFirstOpenLayers, lastSession, restoreFirstOpen],
  );
  /** Map chips (v0.16.0, reference row: All / Locations / Activities /
   * Stores / Collectibles): one group on, the rest off — the map stays
   * fast and readable. "All" is the only one that turns everything on,
   * and only on an explicit tap. */
  const showOnlyLayers = useCallback((layerIds: string[] | 'all') => {
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
  }, []);
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
      layers: layers.filter((l) => l.id.startsWith('cards:')).map((l) => l.id),
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
  const goToTab = useCallback((tab: 'map' | 'explore' | 'layers' | 'saved' | 'ask') => {
    if (tab === 'ask') {
      useMapStore.getState().select(null);
      useUiStore.getState().setAskOpen(true);
      useUiStore.getState().setNavTab('ask');
      return;
    }
    useUiStore.getState().setAskOpen(false);
    useUiStore.getState().setNavTab(tab);
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
  function navigate(view: '3d' | 'about') {
    const url = view === '3d' ? explorerPath(selected?.id) : `${import.meta.env.BASE_URL}about`;
    history.pushState({}, '', url);
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
  useEffect(() => {
    useAiIndexStore.getState().load();
    useMapStore.getState().setLayers([...atlasRegistry.layers.values()]);
    // v0.16.0: restore NOTHING visible on launch. The saved view is
    // read only so the empty-map prompt can offer it back ("Restore my
    // last layers") — first launch has no saved view and stays clean.
    // Camera, county and filters stay off: clean map first.
    const saved = loadSavedMapView();
    const offer = savedLayersOffer(saved);
    if (offer.length > 0) {
      setLastSession({ layerIds: offer });
    }
    setViewRestored(true);
    void hydrateUserData();
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
        useUiStore.getState().setNavTab('explore');
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
      if (matches && usePersistenceStore.getState().status !== 'saving') void hydrateUserData();
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
  /** First-open region sheet (v0.26.0): once the welcome is out of
   * the way and the map is clean (nothing on, nothing showing), open
   * the Vice City region sheet — the reference composition — with
   * its "Pick what to see" row inside. It opens WITHOUT selecting
   * the place: select() would turn the regions layer on and fly the
   * camera into the city, and the reference keeps the whole island
   * in view behind the sheet. Declared after the deep-link effect
   * and guarded by !route.placeId, so a deep link always wins.
   * Fires once per session: the welcome re-opens it never, and
   * turning everything off again does not either. */
  const viceCityPlace = useMemo(() => firstOpenPlace(allPlaces), [allPlaces]);
  useEffect(() => {
    if (
      firstOpenFired.current ||
      firstOpenDismissed ||
      welcomeOpen ||
      route.placeId ||
      status !== 'ready' ||
      selected ||
      showingCount !== 0 ||
      anyPublicLayerVisible ||
      !viceCityPlace
    )
      return;
    firstOpenFired.current = true;
    setFirstOpenActive(true);
  }, [
    firstOpenDismissed,
    welcomeOpen,
    route.placeId,
    status,
    selected,
    showingCount,
    anyPublicLayerVisible,
    viceCityPlace,
  ]);
  /** Track the first-open sheet's life: picking another place ends
   * it (the picker row leaves with it), and closing it without
   * picking layers dismisses it for the session — otherwise the
   * empty map would re-open it on the next render. Set Route on the
   * sheet selects Vice City for real (camera flies, regions layer
   * on) — the sheet stays, now as the normal selected sheet, with
   * its picker row still inside. */
  const previousSelectedId = useRef<string | null>(null);
  useEffect(() => {
    if (!firstOpenActive) {
      previousSelectedId.current = selectedId;
      return;
    }
    if (selectedId !== null && selectedId !== viceCityPlace?.id) {
      setFirstOpenActive(false);
    } else if (
      selectedId === null &&
      previousSelectedId.current === viceCityPlace?.id
    ) {
      setFirstOpenActive(false);
      setFirstOpenDismissed(true);
    }
    previousSelectedId.current = selectedId;
  }, [selectedId, firstOpenActive, viceCityPlace]);
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
  if (route.view === 'explorer') {
    const initialPlace = allPlaces.find((place) => place.id === route.placeId);
    // Deep links must wait for the catalogue/local hydration before choosing a spawn.
    if (route.placeId && !initialPlace && (status === 'loading' || persistenceLoading))
      return <div className="full-loading">Opening selected place in 3D…</div>;
    return (
      <Suspense fallback={<div className="full-loading">Opening 3D explorer…</div>}>
        <ExplorerView
          key={`${route.placeId ?? 'default'}:${workspaceRevision}`}
          initialPlace={initialPlace}
          requestedPlaceId={route.placeId}
          onClose={goMap}
        />
      </Suspense>
    );
  }
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
          attributionHidden={navTab === 'map' && !selected && status === 'ready' && showingCount === 0 && anyPublicLayerVisible}
          promptVisible={navTab === 'map' && !selected && status === 'ready' && showingCount === 0 && anyPublicLayerVisible}
          editorMode={editorMode}
          preferences={preferences}
          foundIds={new Set(visited.map((v) => v.placeId))}
          exploredIds={new Set(explored.map((e) => e.placeId))}
          highlightIds={highlightSet}
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
                goToTab('explore');
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
          </div>
        )}
        {/* v0.26.0: the "nothing showing yet" banner is gone — the
         * first-open Vice City region sheet (above) is the empty
         * state now, with its "Pick what to see" row inside. What
         * remains of the prompt is the second case only: layers are
         * on but nothing matches here, so the map would otherwise
         * look broken with no explanation. One compact bar, same
         * buttons, never the centre of the map. */}
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
        <AskPanel
          places={allPlaces}
          layers={layers}
          filters={filters}
          aiCategories={aiCategories}
          userTags={userTagsMap(placeTags)}
          visitedIds={visited.map((v) => v.placeId)}
          offline={offline}
          onSelect={select}
          onClearHighlights={() => useMapStore.getState().clearHighlights()}
          highlightIds={highlightSet}
          onOpenSettings={() => useUiStore.getState().setDialog('settings')}
          open={askOpen}
          onClose={closeAsk}
          onMarkWorkout={markWorkoutAt}
        />
        {status === 'error' && (
          <div className="map-notice inline-error" role="alert">
            {error}
            <button className="text-button" onClick={() => location.reload()}>
              Reload
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
            onAddMarkerHere={beginMarkerAt}
            onMarkWorkout={markWorkoutAt}
            onMarkBreakable={markBreakableAt}
            firstOpen={
              firstOpenActive && selected.id === viceCityPlace?.id
                ? firstOpenProps
                : undefined
            }
          />
        )}
        {/* First-open region sheet (v0.26.0): the Vice City sheet,
         * opened without selecting the place — the island stays in
         * view behind it. Set Route on it selects Vice City for
         * real, and the sheet continues as the normal selected
         * sheet above. */}
        {firstOpenActive && viceCityPlace && !selected && (
          <PlaceDetails
            key={viceCityPlace.id}
            place={viceCityPlace}
            allPlaces={allPlaces}
            onAddMarkerHere={beginMarkerAt}
            onMarkWorkout={markWorkoutAt}
            onMarkBreakable={markBreakableAt}
            firstOpen={firstOpenProps}
            onClose={closeFirstOpen}
          />
        )}
        {editorOpen && <MarkerEditor position={draftPosition} onClose={closeEditor} />}
        {dialog === 'backup' && <BackupDialog onClose={closeDialog} />}
        {dialog === 'settings' && (
          <SettingsDialog
            onClose={closeDialog}
            onOpenBackup={() => useUiStore.getState().setDialog('backup')}
            onOpenExplorer={() => navigate('3d')}
            onOpenAbout={() => navigate('about')}
            onShowWelcome={() => {
              setWelcomeForced(false);
              setWelcomeOpen(true);
            }}
          />
        )}
      </Suspense>
      </div>
      <BottomNav onNavigate={goToTab} />
      {welcomeOpen && (
        <WelcomeSheet
          places={allPlaces}
          layers={layers}
          onQuickStart={quickStart}
          onClose={closeWelcome}
          forced={welcomeForced}
          onStartIndexing={startIndexing}
        />
      )}
    </main>
  );
}
