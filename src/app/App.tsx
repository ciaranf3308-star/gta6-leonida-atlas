import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { MapPinPlus, Search, X } from 'lucide-react';
import { loadCatalogue, markerToPlace } from '../data/catalogue';
import { filterPlaces } from '../domain/filter';
import { DEFAULT_LAYERS, filterByVisibleLayers } from '../features/map/layers';
import MapView from '../features/map/MapView';
import BottomNav from './BottomNav';
import {
  loadSavedMapView,
  mapViewFromState,
  saveMapView,
} from '../features/map/view-persistence';
import { COUNTIES } from '../data/counties';
import { INITIAL_BOUNDS } from '../features/map/coordinates';
import { areaIsolation, countyIsolation } from '../features/map/isolation';
import { saveCamera } from '../features/map/camera-persistence';
import AskPanel from '../features/ask/AskPanel';
import { useAiIndexStore } from '../features/categorise/store';
import WelcomeSheet from '../features/onboarding/WelcomeSheet';
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
  /** First launch after v0.11.0 is forced (no ×, no Escape); reopening
   * it from the panel footer ("What is mapped") is dismissable. */
  const [welcomeForced, setWelcomeForced] = useState(true);
  /** Map-view restore gate: layer/filter changes are only saved once the
   * saved view (if any) has been applied — otherwise the first render's
   * blank defaults would overwrite the user's saved layers. */
  const [viewRestored, setViewRestored] = useState(false);
  /** First run: once the catalogue is loaded, the forced indexing
   * onboarding shows BEFORE the map is usable — it is the one thing
   * that cannot be skipped past with an ×. A new key (v0.11.0) means
   * everyone sees it once after this update, even users who already
   * dismissed the old welcome sheet. */
  useEffect(() => {
    if (status === 'ready' && !hasSeenIndexOnboarding()) {
      setWelcomeForced(true);
      setWelcomeOpen(true);
    }
  }, [status]);
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
        ).filter((place) =>
          [...atlasRegistry.filters.values()].every((filter) => filter.matches(place)),
        ),
        layers,
      ),
    [allPlaces, filters, deferredQuery, favorites, notes, collections, visited, layers, aiCategories],
  );
  /** Per-layer found/total for the Progress section. Counts every place in the layer. */
  const progress = useMemo(() => {
    const found = new Set(visited.map((v) => v.placeId));
    return layers.map((layer) => {
      const total = allPlaces.filter((p) => p.layerId === layer.id).length;
      const done = allPlaces.filter(
        (p) => p.layerId === layer.id && found.has(p.id),
      ).length;
      return { layerId: layer.id, name: layer.name, total, found: done };
    });
  }, [allPlaces, visited, layers]);
  const anyPublicLayerVisible = layers.some(
    (layer) => layer.visible && layer.id !== 'personal',
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
        if (place.layerId !== 'personal') {
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
          layer.id === 'personal'
            ? layer
            : layerIds === 'all' || layerIds.includes(layer.id)
              ? { ...layer, visible: true }
              : layer,
        ),
    );
  }, []);
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
    // Restore the saved map view (layers, county, filters) from the last
    // visit — first launch has no saved view and stays blank on purpose.
    const saved = loadSavedMapView();
    if (saved) {
      const visible = new Set(saved.visibleLayerIds);
      useMapStore.getState().setLayers(
        [...atlasRegistry.layers.values()].map((layer) => ({
          ...layer,
          visible: layer.id === 'personal' ? true : visible.has(layer.id),
        })),
      );
      useUiStore.getState().setFilters({
        countyId: saved.countyId,
        area: saved.area ?? null,
        hideFound: saved.hideFound,
        remainingOnly: saved.remainingOnly,
        favoritesOnly: saved.favoritesOnly,
        evidence: saved.evidence,
        category: saved.category,
        enterableOnly: saved.enterableOnly,
        lootableOnly: saved.lootableOnly,
      });
      const county = COUNTIES.find((c) => c.id === saved.countyId);
      if (county) {
        useMapStore.getState().setBoundsFocus(county.bounds);
        useMapStore.getState().setIsolation(countyIsolation(county));
      }
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
          editorMode={editorMode}
          preferences={preferences}
          foundIds={new Set(visited.map((v) => v.placeId))}
          highlightIds={highlightSet}
          aiCategories={aiCategories}
          onSelect={select}
          onPlacePosition={placePosition}
          onAddMarkerAt={beginMarkerAt}
          onViewport={(viewport) => {
            useMapStore.getState().setMapCenter(viewport.center);
            // Resume where the player left off: the camera is saved
            // on every moveend/zoomend and restored on the next open.
            saveCamera({ center: viewport.center, zoom: viewport.zoom });
          }}
        />
        {navTab === 'map' && !selected && (
          <div className="map-hero">
            <div className="map-wordmark" aria-label="Leonida Atlas">
              <span>Leonida</span>
              <em>Atlas</em>
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
            </button>
            {status === 'ready' && showingCount === 0 ? (
              !anyPublicLayerVisible ? (
                <div className="empty-map-prompt" role="status">
                  <strong>Nothing showing yet — pick what to see</strong>
                  <p>
                    {allPlaces.length.toLocaleString()} places are in the
                    map — nothing is turned on yet. Pick one and the pins
                    appear straight away.
                  </p>
                  <div className="empty-map-buttons">
                    <button type="button" onClick={() => turnOnLayers(['interiors'])}>
                      Show interiors
                    </button>
                    <button type="button" onClick={() => turnOnLayers(['lootable'])}>
                      Show lootable
                    </button>
                    <button type="button" onClick={() => turnOnLayers(['shops'])}>
                      Show shops
                    </button>
                    <button type="button" onClick={() => turnOnLayers('all')}>
                      Show everything
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty-map-prompt" role="status">
                  <strong>Nothing showing here</strong>
                  <p>
                    Layers are on, but nothing matches in this area with
                    these filters. Clear the filters, or show everything.
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
              )
            ) : null}
          </div>
        )}
        <AskPanel
          places={allPlaces}
          layers={layers}
          filters={filters}
          aiCategories={aiCategories}
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
