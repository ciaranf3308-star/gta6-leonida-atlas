import { useEffect, useId, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { LayerDefinition, Place, Position, Preferences } from '../../domain/types';
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
import { GTADB_TILE_BOUNDS, gtadbTileUrl } from './gtadb-tiles';
import { buildSpatialIndex, clusterPlaces, querySpatialIndex, type PlaceCluster } from './spatial';
import 'leaflet/dist/leaflet.css';
import './map.css';

export interface MapViewProps {
  places: Place[];
  layers: LayerDefinition[];
  selectedId: string | null;
  focus: { position: Position; requestId: number } | null;
  /** Fit the map to these bounds (county picker). */
  boundsFocus: { bounds: MapBounds; requestId: number } | null;
  editorMode: 'none' | 'create' | 'move';
  preferences: Preferences;
  foundIds: ReadonlySet<string>;
  /** Ask Nylah highlights — rendered even when their layer is off. */
  highlightIds?: ReadonlySet<string>;
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

function markerIcon(
  group: PlaceCluster,
  layer: LayerDefinition | undefined,
  selected: boolean,
  color?: string,
  found?: boolean,
  highlighted?: boolean,
): L.DivIcon {
  const cluster = group.places.length > 1;
  const content = document.createElement('span');
  content.className = cluster ? 'atlas-cluster-face' : 'atlas-pin-face';
  content.style.setProperty('--pin-color', color ?? layer?.style.color ?? '#73cbbb');
  content.setAttribute('aria-hidden', 'true');
  content.textContent = cluster
    ? group.places.length.toLocaleString()
    : found
      ? '✓'
      : group.places[0]?.layerId === 'personal'
        ? group.places[0].tags.includes('star')
          ? '★'
          : group.places[0].tags.includes('flag')
            ? '⚑'
            : '•'
        : group.places[0]?.layerId === 'uncertain'
          ? '?'
          : '•';
  const size = cluster ? 38 : Math.max(24, (layer?.style.radius ?? 6) * 2 + 10);
  return L.divIcon({
    html: content,
    className: `atlas-map-marker ${cluster ? 'is-cluster' : ''} ${selected ? 'is-selected' : ''} ${found && !cluster ? 'is-found' : ''} ${highlighted ? 'is-highlighted' : ''} ${group.places[0]?.layerId === 'regions' ? 'is-region' : ''}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function markerColor(place: Place): string | undefined {
  const tag = place.tags.find((tag) => tag.startsWith('color:'));
  return tag?.slice('color:'.length);
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
  const [counts, setCounts] = useState({ places: 0, groups: 0, groupedForPerformance: false });
  const descriptionId = useId();
  const index = useMemo(() => buildSpatialIndex(props.places), [props.places]);

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
      activeMap.fitBounds(leafletBounds(INITIAL_BOUNDS), { padding: [24, 24], animate: false });
      const base = import.meta.env.BASE_URL ?? '/';
      // GTADB In-Game Day tiles — the real in-game map, sharp at max zoom.
      // Leaflet zoom -5..1 maps onto tile zooms 0..6 inside gtadbTileUrl
      // (coords.z is the Leaflet zoom). The layer MUST declare
      // minZoom/maxZoom in Leaflet zoom: GridLayer defaults minZoom 0,
      // which sets _tileZoom undefined and loads nothing below zoom 0.
      // No zoomOffset / minNativeZoom / maxNativeZoom: those clamp the
      // tile zoom Leaflet computes, which would break the mapping.
      const tiles = L.tileLayer('', {
        tileSize: 256,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        bounds: leafletBounds(GTADB_TILE_BOUNDS),
        errorTileUrl: `${base.endsWith('/') ? base : `${base}/`}assets/gta6-leonida-atlas/tiles/ocean.jpg`,
        noWrap: true,
        keepBuffer: 1,
      });
      tiles.getTileUrl = (coords: L.Coords) =>
        gtadbTileUrl(base, coords.x, coords.y, coords.z);
      tiles.addTo(activeMap);
      tiles.on('tileerror', () => {
        // Missing tiles are ocean the source never drew; the ocean tile
        // above covers them. Only a wholesale failure is worth surfacing.
      });
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
        return (
          (layer?.visible || props.highlightIds?.has(place.id)) &&
          (layer?.minZoom === undefined || currentZoom >= layer.minZoom) &&
          (layer?.maxZoom === undefined || currentZoom <= layer.maxZoom)
        );
      });
      const groups = clusterPlaces(visible, {
        zoom: currentZoom,
        enabled: props.preferences.clusterMarkers,
        selectedId: props.selectedId,
      });
      setCounts((previous) => {
        const next = {
          places: visible.length,
          groups: groups.length,
          groupedForPerformance:
            !props.preferences.clusterMarkers && groups.length < visible.length,
        };
        return previous.places === next.places &&
          previous.groups === next.groups &&
          previous.groupedForPerformance === next.groupedForPerformance
          ? previous
          : next;
      });
      let labelCount = 0;
      for (const group of groups) {
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
          : `${place.title}${selected ? ', selected' : ''}`;
        const marker = L.marker(toMapCoordinate(group.position), {
          icon: markerIcon(
            group,
            layer,
            selected,
            markerColor(place),
            props.foundIds.has(place.id),
            group.places.some((member) => props.highlightIds?.has(member.id)),
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
              map.setView(
                toMapCoordinate(group.position),
                Math.min(MAX_ZOOM, map.getZoom() + 1.5),
                { animate: !callbacks.current.preferences.reducedMotion },
              );
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
          labelCount < 65 &&
          (selected || props.highlightIds?.has(place.id) || place.layerId === 'regions' || currentZoom >= -1)
        ) {
          const label = document.createElement('span');
          label.textContent = place.title;
          marker.bindTooltip(label, {
            permanent: true,
            direction: 'right',
            offset: [10, 0],
            className: `atlas-place-label ${selected ? 'is-selected' : ''}`,
          });
          labelCount++;
        }
      }
    };
    const scheduleRender = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(renderMarkers);
    };
    renderMarkers();
    map.on('moveend zoomend resize', scheduleRender);
    return () => {
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
    props.highlightIds,
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

  // County picker: fit the map to the chosen county's estimated bounds.
  useEffect(() => {
    if (!map || !props.boundsFocus) return;
    map.fitBounds(leafletBounds(props.boundsFocus.bounds), {
      padding: [24, 24],
      animate: !callbacks.current.preferences.reducedMotion,
    });
  }, [map, props.boundsFocus]);

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
    <div className={`atlas-map-view ${props.editorMode !== 'none' ? 'is-editing' : ''}`}>
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
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          title="Zoom out"
          disabled={!map || zoom <= MIN_ZOOM}
          onClick={() => map?.zoomOut(0.5, { animate: !props.preferences.reducedMotion })}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Show full source coverage"
          title="Show full source coverage"
          disabled={!map}
          onClick={() =>
            map?.fitBounds(leafletBounds(INITIAL_BOUNDS), {
              padding: [24, 24],
              animate: !props.preferences.reducedMotion,
            })
          }
        >
          ⌖
        </button>
      </div>
      <div className="atlas-map-caption">
        <span>{counts.places.toLocaleString()} places in view</span>
        {counts.groupedForPerformance ? <span>Grouped for map performance</span> : null}
      </div>
      <div className="atlas-map-attribution">
        <a href="https://map.gtadb.org" target="_blank" rel="noreferrer">
          GTADB / Map GTA
        </a>
        <span> · </span>
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
          CC BY 4.0
        </a>
        <span> · In-game map © Rockstar Games · Places approximate</span>
      </div>
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
