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
import { buildSpatialIndex, clusterPlaces, querySpatialIndex, selectHeroPlaces, type PlaceCluster } from './spatial';
import {
  iconKeyForAiRecord,
  iconKeyForPlace,
  placeIconSvg,
} from './place-icons';
import type { AiCategoryRecord } from '../categorise/categories';
import type { Isolation } from './isolation';
import { loadSavedCamera, shouldResumeCamera } from './camera-persistence';
import { runToLatLngs, useAfterHoursGeo } from './after-hours-geo';
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
  editorMode: 'none' | 'create' | 'move';
  preferences: Preferences;
  foundIds: ReadonlySet<string>;
  /** Explored places (v0.21.0) — been there, checked it out. Explored
   * pins fade on the map; found pins keep the tick and outrank them. */
  exploredIds?: ReadonlySet<string>;
  /** Ask Nylah highlights — rendered even when their layer is off. */
  highlightIds?: ReadonlySet<string>;
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

function markerIcon(
  group: PlaceCluster,
  layer: LayerDefinition | undefined,
  selected: boolean,
  color?: string,
  found?: boolean,
  highlighted?: boolean,
  iconSvg?: string,
  clusterIconSvg?: string,
  explored?: boolean,
): L.DivIcon {
  const cluster = group.places.length > 1;
  const content = document.createElement('span');
  content.className = cluster ? 'atlas-cluster-face' : 'atlas-pin-face';
  content.style.setProperty('--pin-color', color ?? layer?.style.color ?? '#e8823a');
  content.setAttribute('aria-hidden', 'true');
  if (cluster) {
    // v0.16.0: a cluster is a small icon pin, not a giant pink number.
    // It wears its best member's glyph (named first, enterable next)
    // and carries the count as one tiny badge — the reference never
    // shows a number as the whole marker.
    content.innerHTML = clusterIconSvg ?? '';
    const badge = document.createElement('span');
    badge.className = 'atlas-cluster-count';
    badge.textContent = group.places.length > 99 ? '99+' : String(group.places.length);
    content.append(badge);
  } else {
    // A GTA blip: white pictogram in the layer-coloured roundel — never a
    // bare coloured dot. Found places keep their glyph and gain a tick.
    content.innerHTML = iconSvg ?? '';
    if (found) {
      const badge = document.createElement('span');
      badge.className = 'atlas-found-badge';
      badge.textContent = '✓';
      content.append(badge);
    }
  }
  // The hit area is 48px on every pin — a thumb-sized target, not the
  // 24px roundel. The visible blip face stays 28px (38px for clusters)
  // centred inside it, via map.css. The map still shows the same pins.
  const size = 48;
  return L.divIcon({
    html: content,
    className: `atlas-map-marker ${cluster ? 'is-cluster' : ''} ${selected ? 'is-selected' : ''} ${found && !cluster ? 'is-found' : ''} ${explored && !found && !cluster ? 'is-explored' : ''} ${highlighted ? 'is-highlighted' : ''} ${group.places[0]?.layerId === 'regions' ? 'is-region' : ''}`,
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
        activeMap.fitBounds(leafletBounds(INITIAL_BOUNDS), { padding: [24, 24], animate: false });
      }
      const base = import.meta.env.BASE_URL ?? '/';
      // GTADB In-Game Day tiles — the real in-game map, sharp at max zoom.
      // Leaflet zoom -5..1 maps onto tile zooms 0..6 inside gtadbTileUrl
      // (coords.z is the Leaflet zoom). The layer MUST declare
      // minZoom/maxZoom in Leaflet zoom: GridLayer defaults minZoom 0,
      // which sets _tileZoom undefined and loads nothing below zoom 0.
      // No zoomOffset / minNativeZoom / maxNativeZoom: those clamp the
      // tile zoom Leaflet computes, which would break the mapping.
      // v0.20.0: the redrawn tiles are 512x512 files served at
      // tileSize 256, so each tile displays at 256 CSS px from 512
      // real pixels — 1:1 device pixels on a DPR 2 phone, 1.5x on
      // DPR 3 (v0.19's 256px tiles were stretched 2-3x by the
      // browser, the main cause of his "so blurry" verdict).
      // Leaflet's detectRetina is deliberately NOT used: it clamps
      // the layer minZoom to 0 and this map lives at -5..1, so tiles
      // below Leaflet zoom 0 would vanish on his phone.
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
      // v0.16.0: full-map zoom shows hero pins only — about two dozen
      // small icon pins, no clustering, no counts. Zooming in brings
      // the full layers back, clustered, capped at 120 DOM markers.
      // That cap is the lag fix: 3,754 places never become 3,754 pins.
      const heroMode = currentZoom <= -2.5;
      const groups = heroMode
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
      let labelCount = 0;
      // v0.17.0: label-collision check — a label runs right from its
      // pin, so when another pin sits just to the right (Leonida Keys
      // into Grassrivers, in his screenshot) the text runs straight
      // into that pin and the next label. Those pins label left.
      const groupPoints = groups.map((g) =>
        map.latLngToContainerPoint(toMapCoordinate(g.position)),
      );
      for (let gi = 0; gi < groups.length; gi++) {
        const group = groups[gi]!;
        const pinPoint = groupPoints[gi]!;
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
          labelCount < 65 &&
          // v0.16.0: labels only for regions / selected / highlights at
          // normal zoom — every place labelling itself at zoom -1 was
          // the overlapping-labels mess in his screenshot. Close in
          // (zoom 0.5+) the labels come back for every place.
          (selected || props.highlightIds?.has(place.id) || place.layerId === 'regions' || currentZoom >= 0.5)
        ) {
          const label = document.createElement('span');
          label.textContent = place.title;
          // v0.17.0: a label runs right from its pin — when another
          // pin sits just to the right of it (Leonida Keys into
          // Grassrivers, in his screenshot) the text runs straight
          // into that pin and the next label. Those pins label left,
          // over empty sea, instead.
          const labelLeft = groupPoints.some(
            (other, oi) =>
              oi !== gi &&
              Math.abs(other.y - pinPoint.y) < 28 &&
              other.x > pinPoint.x &&
              other.x - pinPoint.x < 90,
          );
          marker.bindTooltip(label, {
            permanent: true,
            direction: labelLeft ? 'left' : 'right',
            offset: labelLeft ? [-10, 0] : [10, 0],
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
      map.fitBounds(leafletBounds(props.boundsFocus.bounds), {
        padding: [24, 24],
        animate: false,
      });
      return;
    }
    map.flyToBounds(leafletBounds(props.boundsFocus.bounds), {
      padding: [24, 24],
    });
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
  // past the app edge (bright ocean.jpg error tiles), and a mask cut
  // to the app bounds leaves that strip lit — a straight horizontal
  // cut across the screen. The coastline is drawn twice — a dark
  // under-stroke, then ivory — so the delicate line reads on bright
  // sand, bright sea and dark forest alike.
  const geo = useAfterHoursGeo();
  useEffect(() => {
    if (!map) return;
    const isolation = props.isolation;
    if (!isolation) return;
    const outer: L.LatLngExpression[] = [
      [GTADB_TILE_BOUNDS.south, GTADB_TILE_BOUNDS.west],
      [GTADB_TILE_BOUNDS.south, GTADB_TILE_BOUNDS.east],
      [GTADB_TILE_BOUNDS.north, GTADB_TILE_BOUNDS.east],
      [GTADB_TILE_BOUNDS.north, GTADB_TILE_BOUNDS.west],
    ];
    const added: L.Layer[] = [];
    const countyGeo = isolation.countyId ? geo?.counties[isolation.countyId] : undefined;
    if (countyGeo && countyGeo.loops.length > 0) {
      const mask = L.polygon(
        [outer, ...countyGeo.loops.map((loop) => runToLatLngs(loop))],
        {
          color: '#0b1018',
          weight: 0,
          fillColor: '#0b1018',
          fillOpacity: 0.55,
          interactive: false,
        },
      ).addTo(map);
      added.push(mask);
      for (const run of countyGeo.coast) {
        const latlngs = runToLatLngs(run);
        added.push(
          L.polyline(latlngs, {
            color: '#0b1018',
            weight: 4,
            opacity: 0.5,
            interactive: false,
          }).addTo(map),
        );
        added.push(
          L.polyline(latlngs, {
            color: '#f6f0e5',
            weight: 2,
            opacity: 0.9,
            interactive: false,
          }).addTo(map),
        );
      }
      for (const run of countyGeo.estimate) {
        const latlngs = runToLatLngs(run);
        added.push(
          L.polyline(latlngs, {
            color: '#0b1018',
            weight: 3.5,
            opacity: 0.4,
            interactive: false,
          }).addTo(map),
        );
        added.push(
          L.polyline(latlngs, {
            color: '#f6f0e5',
            weight: 1.5,
            opacity: 0.75,
            dashArray: '5 5',
            interactive: false,
          }).addTo(map),
        );
      }
    } else {
      const b = isolation.bounds;
      const hole: L.LatLngExpression[] = [
        [b.south, b.west],
        [b.south, b.east],
        [b.north, b.east],
        [b.north, b.west],
      ];
      added.push(
        L.polygon([outer, hole], {
          color: '#0b1018',
          weight: 0,
          fillColor: '#0b1018',
          fillOpacity: 0.55,
          interactive: false,
        }).addTo(map),
      );
      added.push(
        L.rectangle(leafletBounds(b), {
          color: '#f6f0e5',
          weight: 1,
          opacity: 0.65,
          dashArray: '5 5',
          fill: false,
          interactive: false,
        }).addTo(map),
      );
    }
    return () => {
      for (const layer of added) layer.remove();
    };
  }, [map, props.isolation, geo]);

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
      {props.isolation && (
        <>
          <div className="county-map-title" aria-hidden="true">
            <strong>{props.isolation.label}</strong>
            <span>{props.isolation.subtitle}</span>
          </div>
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
        </>
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
      {/* v0.17.0: the zoom buttons are hidden on phones, so a saved
       * camera that stranded the player zoomed in had no way out —
       * pinch was the only escape and he did not know it. One
       * floating recenter button, phones only (desktop keeps the
       * full nav above); it fits all of Leonida, like the reference's
       * right-edge controls. */}
      <button
        type="button"
        className="atlas-recenter"
        aria-label="Show all of Leonida"
        title="Show all of Leonida"
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
