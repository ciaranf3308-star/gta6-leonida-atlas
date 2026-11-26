import { useEffect, useId, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, LocateFixed, Minus, Plus } from 'lucide-react';
import { useUiStore } from '../../stores/atlas';
import type { LayerDefinition, Place, Position, Preferences } from '../../domain/types';
import { displayTitleFor } from '../../domain/types';
import {
  BASEMAP_BOUNDS,
  INITIAL_BOUNDS,
  MAX_ZOOM,
  MIN_ZOOM,
  fromMapCoordinate,
  getFocusCenter,
  isValidPosition,
  toMapCoordinate,
  type MapBounds,
} from './coordinates';
import {
  GTADB_TILE_BOUNDS,
  gtadbTileUrl,
} from './gtadb-tiles';
import { buildSpatialIndex, clusterPlaces, querySpatialIndex, selectHeroPlaces, type PlaceCluster, type SpatialIndex } from './spatial';
import { startTilePrefetch } from './tile-prefetch';
import { TILE_ERROR_DATA_URI } from './tile-error';
import {
  FALLBACK_GEOMETRY,
  fitPaddingFor,
  markerBoxHidden,
  measureChromeGeometry,
  observeChromeGeometry,
  type ChromeGeometry,
} from './chrome-geometry';
import { markerColor, markerIcon } from './marker-icon';
import { computeLabelPlacements, type LabelCandidate } from './label-placement';
import { addIsolationLayers } from './isolation-layer';
import { geoLabelsForView } from '../../domain/geography';
import type { AreaNode } from '../../domain/geography';
import {
  iconKeyForAiRecord,
  iconKeyForPlace,
  placeIconSvg,
} from './place-icons';
import type { AiCategoryRecord } from '../categorise/categories';
import type { Isolation } from './isolation';
import { isPlaceVisible } from '../spoiler/visibility';
import { loadSavedCamera, shouldResumeCamera } from './camera-persistence';
import { useAfterHoursGeo } from './after-hours-geo';
import 'leaflet/dist/leaflet.css';
import './map.css';

export interface MapViewProps {
  places: Place[];
  layers: LayerDefinition[];
  selectedId: string | null;
  focus: { position: Position; requestId: number } | null;
  /** Fit the map to these bounds (county picker). */
  boundsFocus: { bounds: MapBounds; requestId: number } | null;
  /** Area isolation (v0.14.0): the named area stays lit, everything
   * outside its bounds is dimmed, and only its places show. */
  isolation?: Isolation | null;
  /** Exit isolation — back to all of Leonida. */
  onExitIsolation?: () => void;
  /** Geography (§6.4, step 4): area nodes for the geo-label chips,
   * the selected area (its own chip is hidden — its name is already
   * on the map), and the tap handler. Labels render with all
   * gameplay layers off and never reveal a gameplay record. */
  areas?: ReadonlyMap<string, AreaNode>;
  selectedAreaId?: string | null;
  onSelectArea?: (areaId: string) => void;
  /** Hide the isolation pill while the area page is open — the page
   * already names the area and offers "Show all of Leonida". The
   * dim mask and the map title stay. */
  hideIsolationPill?: boolean;
  editorMode: 'none' | 'create' | 'move';
  preferences: Preferences;
  foundIds: ReadonlySet<string>;
  /** Explored places (v0.21.0) — been there, checked it out. Explored
   * pins fade on the map; found pins keep the tick and outrank them. */
  exploredIds?: ReadonlySet<string>;
  /** Ask Nylah highlights — rendered even when their layer is off. */
  highlightIds?: ReadonlySet<string>;
  /** The empty-map prompt is up — the zoom pill lifts above it
   * (bottom 150px) instead of sitting half-hidden behind it. */
  promptVisible?: boolean;
  /** AI-suggested types (on-device only): a categorised "?" pins its type glyph. */
  aiCategories?: Readonly<Record<string, AiCategoryRecord>>;
  onSelect: (id: string) => void;
  onPlacePosition: (position: Position) => void;
  /** Long-press / right-click on empty map: start a marker at that point. */
  onAddMarkerAt: (position: Position) => void;
  onViewport?: (viewport: { center: Position; zoom: number }) => void;
}

function leafletBounds(bounds: MapBounds): L.LatLngBoundsExpression {
  return [
    [bounds.south, bounds.west],
    [bounds.north, bounds.east],
  ];
}

export default function MapView(props: MapViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef(props);
  const [map, setMap] = useState<L.Map | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [previewPosition, setPreviewPosition] = useState<Position | null>(null);
  const [placementMessage, setPlacementMessage] = useState('');
  const [zoom, setZoom] = useState(-5);
  // Retina (DPR >= 2): the tile layer loads one pyramid level deeper
  // and displays each 256px tile at 128 CSS px — see the tile-layer
  // comment in the map effect below. The illustration label must
  // follow the tiles actually on screen, so it uses the same +1.
  const retina =
    typeof window !== "undefined" && window.devicePixelRatio >= 2;
  const descriptionId = useId();
  // v0.30.0: the fit framing is MEASURED (chrome-geometry.ts) —
  // the island fits into the VISIBLE band below the hero and above
  // the bottom nav (or the taller empty-map prompt while it is up).
  // The geometry is re-measured on every marker render and whenever
  // the chrome resizes, so a wrapped chip row or a taller hero moves
  // the framing without a code edit.
  const geometryRef = useRef<ChromeGeometry>(FALLBACK_GEOMETRY);
  const getGeometry = (): ChromeGeometry => {
    const host = hostRef.current;
    if (!host) return geometryRef.current;
    geometryRef.current = measureChromeGeometry(host);
    return geometryRef.current;
  };
  const fitAllOptions = (animate: boolean): L.FitBoundsOptions => {
    const padding = fitPaddingFor(getGeometry(), props.promptVisible === true);
    return {
      paddingTopLeft: L.point(12, padding.top),
      paddingBottomRight: L.point(12, padding.bottom),
      animate,
    };
  };
  const index = useMemo(() => buildSpatialIndex(props.places), [props.places]);
  // v0.29.0: memo for the hero/cluster grouping step of renderMarkers.
  // A layer toggle re-runs the marker effect, and the grouping (hero
  // sort over ~1,000 named places at island zoom, cluster passes at
  // street zoom) was recomputed even when the camera and the visible
  // layers had not moved — toggling a layer off and back on at the
  // same camera is the common case. Keyed on everything the grouping
  // can depend on; the spatial index identity pins the place set, so
  // a catalogue reload or a user marker can never read stale groups.
  // Marker DOM creation still runs every render (icons, labels and
  // chrome clamp are live per render) — only the grouping is cached.
  const groupCache = useRef(
    new Map<string, { index: SpatialIndex; groups: PlaceCluster[] }>(),
  );

  useEffect(() => {
    callbacks.current = props;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let instance: L.Map | undefined;
    let observer: ResizeObserver | undefined;
    let resizeFrame = 0;
    setMapError(null);
    try {
      instance = L.map(host, {
        crs: L.CRS.Simple,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        zoomControl: false,
        attributionControl: false,
        keyboard: true,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        // Camera padding allows wide screens to center the occupied source extent. Data stays within BASEMAP_BOUNDS.
        maxBounds: L.latLngBounds(leafletBounds(BASEMAP_BOUNDS) as L.LatLngBoundsLiteral).pad(0.75),
        maxBoundsViscosity: 0.8,
        zoomAnimation: !callbacks.current.preferences.reducedMotion,
        fadeAnimation: !callbacks.current.preferences.reducedMotion,
        markerZoomAnimation: !callbacks.current.preferences.reducedMotion,
      });
      const activeMap = instance;
      // v0.17.0: the camera is resumed ONLY when it still shows the
      // whole of Leonida. A saved zoomed-in / panned-away camera (his
      // 4:28pm screenshot: Vice City shops, land cut off, empty sea
      // on the left) is ignored and the map fits all of Leonida —
      // with the zoom buttons hidden on phones there was no way back.
      // The fit camera is then saved by reportViewport below, so the
      // stale value is overwritten and never comes back.
      const savedCamera = loadSavedCamera();
      const fitCenter = {
        x: (INITIAL_BOUNDS.west + INITIAL_BOUNDS.east) / 2,
        y: (INITIAL_BOUNDS.south + INITIAL_BOUNDS.north) / 2,
      };
      const fitZoom = activeMap.getBoundsZoom(leafletBounds(INITIAL_BOUNDS), false, L.point(24, 24));
      if (savedCamera && shouldResumeCamera(savedCamera, fitZoom, fitCenter)) {
        activeMap.setView(
          toMapCoordinate(savedCamera.center),
          savedCamera.zoom,
          { animate: false },
        );
      } else {
        activeMap.fitBounds(leafletBounds(INITIAL_BOUNDS), fitAllOptions(false));
      }
      const base = import.meta.env.BASE_URL ?? '/';
      // GTADB In-Game Day tiles — the real in-game map, sharp at max zoom.
      // Leaflet zoom -5..1 maps onto tile zooms 0..6 inside gtadbTileUrl
      // (coords.z is the Leaflet zoom). The layer MUST declare
      // minZoom/maxZoom in Leaflet zoom: GridLayer defaults minZoom 0,
      // which sets _tileZoom undefined and loads nothing below zoom 0.
      // v0.20.2 retina, restored in v0.22.0: v0.21 dropped it in a
      // stale stash pop and the walk caught the regression — tiles
      // went back to 256px files displayed at 256 CSS px, i.e. every
      // tile pixel stretched 2x on a DPR 2 phone, the v0.19 blur all
      // over again. The two safe halves of Leaflet's detectRetina,
      // applied by hand: on DPR >= 2 the layer displays each 256px
      // tile at 128 CSS px (tileSize 128) AND loads one pyramid
      // level deeper (coords.z + 1 passed to gtadbTileUrl) — 1:1
      // device pixels at DPR 2, 1.5x at DPR 3. Both halves are
      // needed: tileSize alone halves the rendered size WITHOUT
      // loading deeper tiles, so the fit view shrank to a small
      // island in a black frame (caught by this walk's framing
      // check). detectRetina itself is NOT used: it clamps the layer
      // minZoom to 0 and this map lives at -5..1, so tiles below
      // Leaflet zoom 0 would vanish on his phone. The zoomOffset
      // option is NOT set on purpose: the app overrides getTileUrl
      // and Leaflet hands it coords.z, the tile zoom — the offset
      // only feeds the default URL builder, which the override
      // bypasses, so the +1 is passed explicitly here instead.
      // minZoom / maxZoom stay -5..1. Retina overzoom (P0 fix,
      // 2026-11-25): the pyramid ends at tile zoom 6, so at map
      // zoom 1 retina must NOT ask for tile zoom 7 — the +1 would
      // request a 512-grid that does not exist. The old clamp
      // (leafletTileToGtadb halves z7-scale indices to z6) picked
      // the right tile FILE but Leaflet displayed the whole 512px
      // tile in each 128px slot, so every z6 tile painted 2x2 and
      // the street view repeated like wallpaper (walk caught it:
      // 54 img elements, 20 distinct URLs at Ambrosia max zoom).
      // maxNativeZoom: 0 on retina makes Leaflet request the z6
      // grid (coords.z 0, +1 -> tile zoom 6) and scale it 2x — the
      // 512px file lands 1:1 on device pixels at DPR 2, each slot
      // a different tile, geography correct. Non-retina keeps
      // maxNativeZoom 1 (map zoom 1 IS tile zoom 6 there). Do not
      // "simplify" this back to tileSize 256: the walk's dpr2 check
      // (256px tile at 128 CSS px) and framing check exist to catch
      // exactly that.
      const tiles = L.tileLayer('', {
        tileSize: retina ? 128 : 256,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        // Retina overzoom: the pyramid ends at tile zoom 6, so the
        // layer's native max in coords.z terms is 0 on retina
        // (coords.z 0 + 1 = tile zoom 6) and 1 off retina.
        maxNativeZoom: retina ? 0 : 1,
        bounds: leafletBounds(GTADB_TILE_BOUNDS),
        // v0.30.0: a failed tile shows the error tile, NOT ocean —
        // the worker refuses to substitute ocean for land, and the
        // error tile (dark slate, hatched) reads as "not loaded" at
        // a glance instead of painting water over land (v0.24 P0).
        errorTileUrl: TILE_ERROR_DATA_URI,
        noWrap: true,
        // v0.29.0: two rings of buffered tiles around the viewport
        // instead of one — a pan by a screenful stays inside tiles
        // Leaflet already holds, so the new edge arrives from the
        // service-worker cache instead of the network. Costs ~2x the
        // tiles per view; the SW cache (6000 entries) holds them.
        keepBuffer: 2,
      });
      tiles.getTileUrl = (coords: L.Coords) =>
        gtadbTileUrl(base, coords.x, coords.y, coords.z + (retina ? 1 : 0));
      tiles.addTo(activeMap);
      // v0.29.0: warm the tile cache on idle — low-zoom island plus
      // the neighbours and child/parent zooms of the current view —
      // so the next pan or zoom step reads from cache. Stopped when
      // this map instance is torn down.
      const prefetch = startTilePrefetch(activeMap, tiles, base);
      tiles.on('tileerror', () => {
        // A tile error now means the tile genuinely failed: the
        // worker answers real ocean itself, so an error tile is a
        // land (or coast) tile that did not load — the next pan
        // retries it. Only a wholesale failure is worth surfacing.
      });
      // v0.30.0: tiles painted before the service worker took
      // control can sit as error tiles after a failed first paint —
      // give them one second chance through the active worker, but
      // only when an error tile is actually on screen (a blind
      // redraw on every mount would flicker the whole map).
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        void navigator.serviceWorker.ready.then(() => {
          const host = activeMap.getContainer();
          if (host.querySelector('img[src^="data:image/svg+xml"]'))
            tiles.redraw();
        });
      }
      // v0.18.0: NO sea canvas. The sea grade used to live in a canvas
      // over the tiles (sea-overlay.ts, water-mask stencil) and it
      // seamed: the grade ended mid-screen where the mask rect ended
      // and the pale tiles showed through (reported 2026-11-24, the
      // v0.17 "seamless sea" fix did not hold on the user's phone).
      // The colour is now baked into the tiles themselves
      // (v0.19.0: tiles/redrawn/, scripts/redraw-tiles.py), so there
      // is no overlay, no mask rect and nothing left that can seam.
      const reportViewport = () => {
        setZoom(activeMap.getZoom());
        callbacks.current.onViewport?.({
          center: fromMapCoordinate(activeMap.getCenter()),
          zoom: activeMap.getZoom(),
        });
      };
      activeMap.on('moveend zoomend', reportViewport);
      activeMap.on('click', (event: L.LeafletMouseEvent) => {
        if (callbacks.current.editorMode === 'none') return;
        const position = fromMapCoordinate(event.latlng);
        if (!isValidPosition(position)) {
          setPlacementMessage('Choose a point inside the source map.');
          return;
        }
        setPreviewPosition(position);
        setPlacementMessage('Position chosen. Complete the marker details to save.');
        callbacks.current.onPlacePosition(position);
      });
      // Right-click on desktop, long-press on touch: drop a marker here.
      // In placement mode it behaves like a click; otherwise it opens the editor.
      activeMap.on('contextmenu', (event: L.LeafletMouseEvent) => {
        const position = fromMapCoordinate(event.latlng);
        if (!isValidPosition(position)) {
          setPlacementMessage('Choose a point inside the source map.');
          return;
        }
        if (callbacks.current.editorMode === 'none') {
          callbacks.current.onAddMarkerAt(position);
          return;
        }
        setPreviewPosition(position);
        setPlacementMessage('Position chosen. Complete the marker details to save.');
        callbacks.current.onPlacePosition(position);
      });
      const resize = () => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => activeMap.invalidateSize({ pan: false }));
      };
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(resize);
        observer.observe(host);
      }
      reportViewport();
      setMap(activeMap);
      return () => {
        prefetch.stop();
        observer?.disconnect();
        cancelAnimationFrame(resizeFrame);
        tiles.off();
        tiles.remove();
        activeMap.off('moveend zoomend', reportViewport);
        // Leaflet 1.9's uncancellable 250ms zoom fallback can outlive remove().
        // Clear its guard before the map pane is deleted; preserve internal unload cleanup.
        (activeMap as L.Map & { _animatingZoom?: boolean })._animatingZoom = false;
        activeMap.remove();
        activeMap.off();
      };
    } catch (error) {
      observer?.disconnect();
      cancelAnimationFrame(resizeFrame);
      instance?.remove();
      setMap(null);
      setMapError(
        error instanceof Error
          ? `Map unavailable: ${error.message}`
          : 'The map could not be initialized.',
      );
    }
  }, [attempt]);

  useEffect(() => {
    if (!map) return;
    const markerGroup = L.layerGroup().addTo(map);
    const layersById = new Map(props.layers.map((layer) => [layer.id, layer]));
    let frame = 0;
    const renderMarkers = () => {
      markerGroup.clearLayers();
      const bounds = map.getBounds();
      const currentZoom = map.getZoom();
      const visible = querySpatialIndex(index, {
        west: bounds.getWest(),
        east: bounds.getEast(),
        south: bounds.getSouth(),
        north: bounds.getNorth(),
      }).filter((place) => {
        const layer = layersById.get(place.layerId);
        // Spoiler visibility (features/spoiler/visibility.ts): a place
        // renders when its layer is on, it is the user's own marker,
        // or it is in the current reveal set (Ask highlights / the
        // selected place). Nothing else gets a pin.
        return (
          isPlaceVisible(place, props.layers, props.highlightIds) &&
          (layer?.minZoom === undefined || currentZoom >= layer.minZoom) &&
          (layer?.maxZoom === undefined || currentZoom <= layer.maxZoom)
        );
      });
      // v0.16.0: full-map zoom shows hero pins only — about two dozen
      // small icon pins, no clustering, no counts. Zooming in brings
      // the full layers back, clustered, capped at 120 DOM markers.
      // That cap is the lag fix: 4,380 places never become 4,380 pins.
      // v0.29.0: the grouping step is memoized (see groupCache above)
      // — a layer toggle at a stationary camera reuses the groups
      // instead of re-sorting / re-clustering the same visible set.
      const heroMode = currentZoom <= -2.5;
      const groupKey = [
        currentZoom.toFixed(2),
        Math.floor(bounds.getWest() / index.cellSize),
        Math.floor(bounds.getEast() / index.cellSize),
        Math.floor(bounds.getSouth() / index.cellSize),
        Math.floor(bounds.getNorth() / index.cellSize),
        props.layers
          .filter((layer) => layer.visible)
          .map((layer) => `${layer.id}:${layer.minZoom ?? ''}:${layer.maxZoom ?? ''}`)
          .sort()
          .join(','),
        [...(props.highlightIds ?? [])].sort().join(','),
        props.selectedId ?? '',
        props.preferences.clusterMarkers ? '1' : '0',
      ].join('|');
      const cachedGroups = groupCache.current.get(groupKey);
      let groups: PlaceCluster[];
      if (cachedGroups && cachedGroups.index === index) {
        groups = cachedGroups.groups;
        groupCache.current.delete(groupKey);
        groupCache.current.set(groupKey, cachedGroups);
      } else {
        groups = heroMode
          ? selectHeroPlaces(visible).map((place) => ({
              id: place.id,
              position: place.position,
              places: [place],
            }))
          : clusterPlaces(visible, {
              zoom: currentZoom,
              enabled: props.preferences.clusterMarkers,
              selectedId: props.selectedId,
              maxMarkers: 120,
            }).slice(0, 120);
        groupCache.current.set(groupKey, { index, groups });
        while (groupCache.current.size > 4) {
          const oldest = groupCache.current.keys().next().value;
          if (oldest === undefined) break;
          groupCache.current.delete(oldest);
        }
      }
      // v0.30.0: the pin layer is clamped to the visible band, and
      // the band is MEASURED (chrome-geometry.ts) — the hero, the
      // illustration note, the edge stack, the zoom pill / desktop
      // navigation and the attribution are read off the live DOM
      // every render, so a resized chrome moves the clamp with it.
      // A pin whose 48px box touches any chrome rect is not
      // rendered at all (v0.25.0 clamp, v0.26.1 whole-box test).
      const groupPoints = groups.map((g) =>
        map.latLngToContainerPoint(toMapCoordinate(g.position)),
      );
      const geometry = getGeometry();
      // Diagnostic hook for the geometry probe
      // (scripts/check-v030-geometry.mjs): the measured rects, so a
      // harness can prove the clamp follows live chrome changes.
      (window as unknown as { __vicewireChromeGeometry?: ChromeGeometry }).__vicewireChromeGeometry =
        geometry;
      const PIN_HALF = 24;
      const shown = groups
        .map((group, gi) => ({ group, point: groupPoints[gi]! }))
        .filter(({ point }) => !markerBoxHidden(point, PIN_HALF, geometry));
      const markers: L.Marker[] = [];
      const labelCandidates: LabelCandidate[] = [];
      for (let si = 0; si < shown.length; si++) {
        const { group, point: pinPoint } = shown[si]!;
        const place = group.places[0]!;
        const layer = layersById.get(place.layerId);
        const isCluster = group.places.length > 1;
        const selected = !isCluster && place.id === props.selectedId;
        const interactive = group.places.some(
          (member) => layersById.get(member.layerId)?.interactive,
        );
        const draggable = selected && place.evidence === 'personal' && props.editorMode === 'move';
        const title = isCluster
          ? `Explore ${group.places.length.toLocaleString()} places`
          : `${displayTitleFor(place)}${selected ? ', selected' : ''}`;
        // A cluster wears its best member's glyph: a named place first,
        // then an enterable one, so the pin still says what it is.
        const representative =
          group.places.find((member) => member.title !== '?') ?? group.places[0]!;
        const marker = L.marker(toMapCoordinate(group.position), {
          icon: markerIcon(
            group,
            layer,
            selected,
            markerColor(place),
            props.foundIds.has(place.id),
            group.places.some((member) => props.highlightIds?.has(member.id)),
            isCluster
              ? undefined
              : placeIconSvg(
                  iconKeyForAiRecord(props.aiCategories?.[place.id]) ??
                    iconKeyForPlace(place),
                  17,
                ),
            isCluster
              ? placeIconSvg(
                  iconKeyForAiRecord(props.aiCategories?.[representative.id]) ??
                    iconKeyForPlace(representative),
                  15,
                )
              : undefined,
            props.exploredIds?.has(place.id),
          ),
          title,
          alt: title,
          keyboard: interactive,
          interactive,
          draggable,
          autoPan: draggable,
          bubblingMouseEvents: false,
          riseOnHover: true,
          zIndexOffset: selected ? 1500 : (layer?.order ?? 0) * 5,
        }).addTo(markerGroup);
        markers.push(marker);
        const markerElement = marker.getElement();
        markerElement?.setAttribute('aria-label', title);
        if (interactive)
          markerElement?.addEventListener('keydown', (event) => {
            if (event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              marker.fire('click');
            }
          });
        if (interactive) {
          marker.on('click', () => {
            if (callbacks.current.editorMode !== 'none') {
              setPreviewPosition(group.position);
              setPlacementMessage('Position chosen. Complete the marker details to save.');
              callbacks.current.onPlacePosition(group.position);
              return;
            }
            if (!isCluster) {
              callbacks.current.onSelect(place.id);
              return;
            }
            if (map.getZoom() < MAX_ZOOM) {
              // Tap a cluster: the camera flies into it, smoothly.
              map.flyTo(toMapCoordinate(group.position), Math.min(MAX_ZOOM, map.getZoom() + 1.5), {
                animate: !callbacks.current.preferences.reducedMotion,
              });
              return;
            }
            // Coincident source positions cannot separate through zoom; offer their records directly.
            const content = document.createElement('div');
            content.className = 'atlas-cluster-list';
            const heading = document.createElement('strong');
            heading.textContent = `${group.places.length} places at this position`;
            content.append(heading);
            for (const member of group.places.slice(0, 30)) {
              if (!layersById.get(member.layerId)?.interactive) continue;
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = `${member.title} · ${member.id}`;
              button.addEventListener('click', () => {
                callbacks.current.onSelect(member.id);
                map.closePopup();
              });
              content.append(button);
            }
            if (group.places.length > 30) {
              const note = document.createElement('p');
              note.textContent =
                'Showing the first 30 records. Search the catalogue to find any other place.';
              content.append(note);
            }
            L.popup({ maxWidth: 310, maxHeight: 280 })
              .setLatLng(toMapCoordinate(group.position))
              .setContent(content)
              .openOn(map);
          });
        }
        if (draggable) {
          marker.on('dragend', () => {
            const position = fromMapCoordinate(marker.getLatLng());
            if (!isValidPosition(position)) {
              marker.setLatLng(toMapCoordinate(place.position!));
              setPlacementMessage('Choose a point inside the source map.');
              return;
            }
            setPreviewPosition(position);
            setPlacementMessage('Marker moved in preview. Save its details to keep this position.');
            callbacks.current.onPlacePosition(position);
          });
        }
        if (
          !isCluster &&
          props.preferences.showLabels &&
          // Unnamed "?" places never get a name pill — their titles
          // are "?, Downtown, Vice City" and at street zoom the pills
          // overlapped the search, the chips and each other.
          !place.title.startsWith('?') &&
          // v0.16.0: labels only for regions / selected / highlights at
          // normal zoom — every place labelling itself at zoom -1 was
          // the overlapping-labels mess in his screenshot. Close in
          // (zoom 0.5+) the labels come back for every place.
          (selected || props.highlightIds?.has(place.id) || place.layerId === 'regions' || currentZoom >= 0.5)
        ) {
          // v0.30.0: placement (which side, or skipped) is decided
          // after the loop by label-placement.ts — the 65-label
          // budget and first-wins overlap rule live there.
          labelCandidates.push({ index: si, title: place.title, point: pinPoint });
        }
      }
      // v0.30.0: labels are placed (and bound) after all markers
      // exist — placement is a pure function of the shown points and
      // the measured chrome (label-placement.ts), not interleaved
      // with marker creation.
      const placements = computeLabelPlacements(
        labelCandidates,
        groupPoints,
        geometry,
      );
      for (const [si, side] of placements) {
        const marker = markers[si];
        const candidate = labelCandidates.find((c) => c.index === si);
        if (!marker || !candidate) continue;
        const label = document.createElement('span');
        label.textContent = candidate.title;
        const placed = shown[si]!.group.places[0]!;
        const isSelected =
          shown[si]!.group.places.length === 1 && placed.id === props.selectedId;
        marker.bindTooltip(label, {
          permanent: true,
          direction: side,
          offset: side === 'left' ? [-10, 0] : [10, 0],
          className: `atlas-place-label ${isSelected ? 'is-selected' : ''}`,
        });
      }
    };
    const scheduleRender = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(renderMarkers);
    };
    // v0.29.0: the first render of a run is scheduled, not synchronous
    // — a layer tap's React commit paints first (sheet closing, chip
    // state) and the marker rebuild lands on the next frame, instead
    // of the tap waiting on the whole rebuild before anything moves.
    scheduleRender();
    map.on('moveend zoomend resize', scheduleRender);
    // v0.30.0: chrome resizes (hero height, pill position, bottom nav)
    // re-measure the geometry and re-render, so the clamp follows a
    // resized chrome without a map move — no hardcoded offsets. The
    // observer is re-created whenever this effect re-runs, so newly
    // mounted chrome (e.g. the county title) is picked up then.
    const stopObservingChrome = hostRef.current
      ? observeChromeGeometry(hostRef.current, scheduleRender)
      : () => {};
    return () => {
      stopObservingChrome();
      cancelAnimationFrame(frame);
      map.off('moveend zoomend resize', scheduleRender);
      markerGroup.clearLayers();
      markerGroup.remove();
    };
  }, [
    map,
    index,
    props.layers,
    props.selectedId,
    props.editorMode,
    props.foundIds,
    props.exploredIds,
    props.highlightIds,
    props.aiCategories,
    props.preferences.clusterMarkers,
    props.preferences.showLabels,
  ]);

  useEffect(() => {
    if (!map || !props.focus || !isValidPosition(props.focus.position)) return;
    const position = props.focus.position;
    const applyFocus = () => {
      const targetZoom = Math.max(map.getZoom(), -1.5);
      const center = getFocusCenter(
        position,
        targetZoom,
        map.getSize().y,
        window.innerWidth <= 599 && callbacks.current.selectedId !== null,
      );
      map.setView(toMapCoordinate(center), targetZoom, {
        animate: !callbacks.current.preferences.reducedMotion,
      });
    };
    const followResize = () => {
      if (callbacks.current.selectedId) applyFocus();
    };
    applyFocus();
    map.on('resize', followResize);
    return () => {
      map.off('resize', followResize);
    };
  }, [map, props.focus, props.preferences.reducedMotion]);

  // County picker: the camera flies into the chosen county's
  // estimated bounds — travelling into a region, not jumping to it.
  useEffect(() => {
    if (!map || !props.boundsFocus) return;
    if (callbacks.current.preferences.reducedMotion) {
      map.fitBounds(leafletBounds(props.boundsFocus.bounds), fitAllOptions(false));
      return;
    }
    map.flyToBounds(leafletBounds(props.boundsFocus.bounds), fitAllOptions(true));
  }, [map, props.boundsFocus]);

  // Area isolation: the surrounding counties desaturate — a dim
  // mask over everything outside the isolated area, plus a delicate
  // boundary line around the area itself. No pink, no heavy card:
  // the lit part reads as the place, the rest as deliberately
  // switched off, not broken. The list filter already hides the
  // outside places; the mask is what makes it visible.
  //
  // Counties draw the TRACED outline (after-hours-geo.json, built
  // from the real tiles by scripts/dissect-map.py): the coastline
  // solid ivory, the estimated rect edges dashed — and the dim mask
  // is cut to the land rings, so the sea inside the county rect is
  // not lit as if it were land. Towns/areas keep the rect outline
  // (no traced data for an arbitrary area), as does a county when
  // the geo file has not loaded. The outline is what makes a county
  // feel like a place with a real edge, not a box.
  //
  // The mask's outer ring is the full TILE bounds, not the app
  // bounds: fitting a wide county into a portrait phone shows map
  // past the app edge (dark error tiles where a tile failed), and a
  // mask cut to the app bounds leaves that strip lit — a straight
  // horizontal cut across the screen. The coastline is drawn twice — a dark
  // under-stroke, then ivory — so the delicate line reads on bright
  // sand, bright sea and dark forest alike.
  // Area isolation (v0.15.0 After Hours): the surrounding counties
  // desaturate and the isolated area gets a delicate boundary line.
  // The layers themselves live in isolation-layer.ts; this effect
  // only wires them to the map lifecycle.
  const geo = useAfterHoursGeo();
  useEffect(() => {
    if (!map) return;
    const isolation = props.isolation;
    if (!isolation) return;
    return addIsolationLayers(map, isolation, geo);
  }, [map, props.isolation, geo]);

  // Geo labels (§6.4): tappable area-name chips at each area's
  // centroid, INDEPENDENT of gameplay layers — they render with all
  // gameplay filters off, and tapping one never turns a gameplay
  // filter on, never reveals a gameplay record, never requires a
  // layer. Zoom-aware (geoLabelsForView): counties at island zoom,
  // cities/towns at district zoom, neighbourhoods/districts at
  // street zoom. Own layer group, re-rendered on pan/zoom — never
  // part of the pin clamp or the marker budget.
  useEffect(() => {
    if (!map || !props.areas) return;
    const group = L.layerGroup().addTo(map);
    const render = () => {
      group.clearLayers();
      const bounds = map.getBounds();
      const viewport: MapBounds = {
        west: bounds.getWest(),
        east: bounds.getEast(),
        south: bounds.getSouth(),
        north: bounds.getNorth(),
      };
      for (const label of geoLabelsForView(
        props.areas!,
        map.getZoom(),
        viewport,
        props.selectedAreaId ?? null,
      )) {
        const marker = L.marker(toMapCoordinate(label.position), {
          icon: L.divIcon({
            className: 'atlas-geo-label-wrap',
            // The inner button centres itself on the point
            // (translate -50%/-50% in map.css); the marker click
            // is what isolates the area — the button is the
            // keyboard target, and its click bubbles to the icon.
            html: `<button type="button" class="atlas-geo-label" aria-label="Show ${label.name} area">${label.name}</button>`,
          }),
          interactive: true,
          keyboard: true,
          title: label.name,
        });
        marker.on('click', () => {
          callbacks.current.onSelectArea?.(label.areaId);
        });
        marker.addTo(group);
      }
    };
    render();
    map.on('moveend zoomend', render);
    return () => {
      map.off('moveend zoomend', render);
      group.remove();
    };
  }, [map, props.areas, props.selectedAreaId]);

  useEffect(() => {
    if (props.editorMode === 'none') {
      setPreviewPosition(null);
      setPlacementMessage('');
    }
    if (!map) return;
    if (props.editorMode === 'none') map.doubleClickZoom.enable();
    else map.doubleClickZoom.disable();
  }, [map, props.editorMode]);

  useEffect(() => {
    if (!map || !previewPosition || props.editorMode === 'none') return;
    const content = document.createElement('span');
    content.textContent = '+';
    content.setAttribute('aria-hidden', 'true');
    const preview = L.marker(toMapCoordinate(previewPosition), {
      icon: L.divIcon({
        className: 'atlas-position-preview',
        html: content,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 2000,
    }).addTo(map);
    return () => {
      preview.remove();
    };
  }, [map, previewPosition, props.editorMode]);

  // v0.19.0: the animated sea canvas is gone — the sea is baked
  // into the redrawn tiles themselves, so there is no overlay left
  // that can seam. See the note at the tile-layer setup above.

  const useMapCenter = () => {
    if (!map) return;
    const size = map.getSize();
    const center =
      window.innerWidth <= 599 && props.selectedId !== null
        ? map.containerPointToLatLng([size.x / 2, size.y * 0.28])
        : map.getCenter();
    const position = fromMapCoordinate(center);
    if (!isValidPosition(position)) {
      setPlacementMessage('Pan to a point inside the source map.');
      return;
    }
    setPreviewPosition(position);
    setPlacementMessage('Map center chosen. Complete the marker details to save.');
    props.onPlacePosition(position);
  };

  return (
    <div
      className={`atlas-map-view ${props.editorMode !== 'none' ? 'is-editing' : ''} ${zoom <= -2.5 ? 'is-hero-zoom' : ''} ${props.promptVisible ? 'has-prompt' : ''} ${props.selectedId !== null ? 'has-details' : ''}`}
    >
      <p id={descriptionId} className="map-sr-only">
        Interactive map using the GTADB in-game map of Leonida, with approximate game
        coordinates. Use arrow keys to pan and plus or minus to zoom. Select a map marker or use
        the searchable place list.
      </p>
      <div
        ref={hostRef}
        className="atlas-map-canvas"
        role="region"
        aria-label="Leonida interactive map"
        aria-describedby={descriptionId}
        tabIndex={0}
      />
      {/* Decorative clouds over the sea at island zoom (map.css) —
        pure CSS, no asset, pointer-events none, below the pins. */}
      <div className="atlas-clouds" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      {props.isolation && (
        <div className="county-map-title" aria-hidden="true">
          <strong>{props.isolation.label}</strong>
          <span>{props.isolation.subtitle}</span>
        </div>
      )}
      {props.isolation && !props.hideIsolationPill && (
        <div className="isolation-pill" role="status">
          <span>{props.isolation.label}</span>
          <button
            type="button"
            aria-label={`Show all of Leonida — leave ${props.isolation.label}`}
            onClick={() => props.onExitIsolation?.()}
          >
            ×
          </button>
        </div>
      )}
      {props.editorMode !== 'none' ? (
        <div className="atlas-map-editor-hint">
          <button type="button" onClick={useMapCenter}>
            Use map center
          </button>
          <span className="map-sr-only" role="status">
            {placementMessage ||
              (props.editorMode === 'move'
                ? 'Choose the new marker position'
                : 'Choose a position for your marker')}
          </span>
        </div>
      ) : null}
      {props.editorMode !== 'none' ? (
        <div className="atlas-center-crosshair" aria-hidden="true">
          +
        </div>
      ) : null}
      <div className="atlas-map-navigation" aria-label="Map navigation">
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={!map || zoom >= MAX_ZOOM}
          onClick={() => map?.zoomIn(0.5, { animate: !props.preferences.reducedMotion })}
        >
          <Plus size={22} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={!map || zoom <= MIN_ZOOM}
          onClick={() => map?.zoomOut(0.5, { animate: !props.preferences.reducedMotion })}
        >
          <Minus size={22} />
        </button>
        <button
          type="button"
          aria-label="Show full source coverage"
          title="Show full source coverage"
          disabled={!map}
          onClick={() => map?.fitBounds(leafletBounds(INITIAL_BOUNDS), fitAllOptions(!props.preferences.reducedMotion))}
        >
          <LocateFixed size={20} />
        </button>
      </div>
      {/* v0.23.0: the reference's right-edge stack on phones —
       * layers + recenter as round dark-translucent buttons under
       * the chips, zoom as a pill bottom-right. The zoom buttons
       * used to be hidden on phones and the lone recenter was the
       * only way back from a stranded camera; the pill is the
       * reference composition and pinch still works. Desktop keeps
       * .atlas-map-navigation above and never sees this stack. */}
      <div className="atlas-edge-stack" aria-label="Map shortcuts">
        <button
          type="button"
          aria-label="Open map filters"
          title="Map filters"
          onClick={() => useUiStore.getState().setFilterSheetOpen(true)}
        >
          <Layers size={20} />
        </button>
        <button
          type="button"
          aria-label="Show all of Leonida"
          title="Show all of Leonida"
          disabled={!map}
          onClick={() => map?.fitBounds(leafletBounds(INITIAL_BOUNDS), fitAllOptions(!props.preferences.reducedMotion))}
        >
          <LocateFixed size={20} />
        </button>
      </div>
      <div className="atlas-edge-zoom" aria-label="Zoom">
        <button
          type="button"
          aria-label="Zoom in"
          title="Zoom in"
          disabled={!map || zoom >= MAX_ZOOM}
          onClick={() => map?.zoomIn(0.5, { animate: !props.preferences.reducedMotion })}
        >
          <Plus size={22} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={!map || zoom <= MIN_ZOOM}
          onClick={() => map?.zoomOut(0.5, { animate: !props.preferences.reducedMotion })}
        >
          <Minus size={22} />
        </button>
      </div>
      {/* v0.31.2: the map view carries no text labels any more — the
          "ViceWire map: the real in-game map, restyled" note and the
          GTADB attribution footer are both gone from here (the user
          asked for a clean map). The credit lives on in the app:
          About → Credits & sources carries the full GTADB section
          with the CC BY 4.0 licence link (step 5: the old Layers
          sheet footer that also named the GTADB basemap is gone with
          the sheet — Credits is the one honest home for it). The
          chrome geometry reads both elements as absent (null) and
          falls back to the 40px bottom strip, so removing them
          changes no clamp. */}
      {mapError ? (
        <div className="atlas-map-error" role="alert">
          <span>{mapError}</span>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>
            Reload map
          </button>
        </div>
      ) : null}
    </div>
  );
}
