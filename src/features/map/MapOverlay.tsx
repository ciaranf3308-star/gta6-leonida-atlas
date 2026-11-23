import { useMemo } from 'react';
import { Dumbbell, MapPin, ShoppingBag, DoorOpen, Layers, Star } from 'lucide-react';
import type { LayerDefinition, Place } from '../../domain/types';
import { useMapStore, useUiStore } from '../../stores/atlas';
import { COUNTIES, COUNTY_EXTENT_NOTE } from '../../data/counties';
import { INITIAL_BOUNDS } from './coordinates';

/**
 * The map overlay — the functionality lives ON the map, not buried in a
 * sidebar that starts closed on a phone. Quick chips toggle the layers
 * right there (with counts), a pill says how many places are showing, and
 * the county picker isolates a county without opening the sidebar.
 *
 * Layer choices made here persist across reloads (see view-persistence):
 * first launch still starts blank, but a chip tapped on stays tapped.
 */

export interface MapOverlayProps {
  layers: LayerDefinition[];
  /** All catalogue + user places (named, positioned counts come from this). */
  allPlaces: Place[];
  /** Positioned places currently matching the filters. */
  showingCount: number;
  /** Any public layer on — when false the pill says to tap a chip. */
  anyPublicLayerVisible: boolean;
  onAddWorkoutSpot: () => void;
}

interface Chip {
  key: string;
  label: string;
  layerIds: string[];
  icon: typeof Dumbbell;
  singleLayer: boolean;
}

const CHIPS: Chip[] = [
  { key: 'gyms', label: 'Gyms', layerIds: ['gyms', 'gyms-outdoor'], icon: Dumbbell, singleLayer: false },
  { key: 'lootable', label: 'Lootable', layerIds: ['lootable'], icon: MapPin, singleLayer: true },
  { key: 'shops', label: 'Shops', layerIds: ['shops'], icon: ShoppingBag, singleLayer: true },
  { key: 'interiors', label: 'Interiors', layerIds: ['interiors'], icon: DoorOpen, singleLayer: true },
  { key: 'cards', label: 'Cards', layerIds: [], icon: Layers, singleLayer: false },
  { key: 'personal', label: 'My markers', layerIds: ['personal'], icon: Star, singleLayer: true },
];

export default function MapOverlay(props: MapOverlayProps) {
  const countyId = useUiStore((s) => s.filters.countyId);
  const byId = useMemo(() => new Map(props.layers.map((l) => [l.id, l])), [props.layers]);

  /** Positioned places per layer — what a chip actually puts on the map.
   * Unnamed "?" records count: they are on the map, in the unverified
   * layer, and the chips must say so. */
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const place of props.allPlaces) {
      if (!place.position) continue;
      map.set(place.layerId, (map.get(place.layerId) ?? 0) + 1);
    }
    return map;
  }, [props.allPlaces]);
  const cardLayerIds = useMemo(
    () => props.layers.filter((l) => l.id.startsWith('cards:')).map((l) => l.id),
    [props.layers],
  );
  const cardCount = cardLayerIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
  const cardsOn = cardLayerIds.some((id) => byId.get(id)?.visible);

  function setLayers(next: LayerDefinition[]) {
    useMapStore.getState().setLayers(next);
  }

  function toggleChip(chip: Chip) {
    if (chip.key === 'cards') {
      const on = !cardsOn;
      setLayers(
        props.layers.map((layer) =>
          layer.id.startsWith('cards:')
            ? { ...layer, visible: on && (counts.get(layer.id) ?? 0) > 0 }
            : layer,
        ),
      );
      return;
    }
    const anyOn = chip.layerIds.some((id) => byId.get(id)?.visible);
    setLayers(
      props.layers.map((layer) =>
        chip.layerIds.includes(layer.id) ? { ...layer, visible: !anyOn } : layer,
      ),
    );
  }

  function chipCount(chip: Chip): number {
    if (chip.key === 'cards') return cardCount;
    return chip.layerIds.reduce((sum, id) => sum + (counts.get(id) ?? 0), 0);
  }

  function chipActive(chip: Chip): boolean {
    if (chip.key === 'cards') return cardsOn;
    return chip.layerIds.some((id) => byId.get(id)?.visible);
  }

  function chooseCounty(id: string | null) {
    useUiStore.getState().setFilters({ countyId: id });
    const county = COUNTIES.find((c) => c.id === id);
    useMapStore.getState().setBoundsFocus(county ? county.bounds : INITIAL_BOUNDS);
  }

  return (
    <div className="map-overlay" aria-label="Map quick controls">
      <div className="map-overlay-top">
        <label className="map-county-picker">
          <span className="map-sr-only">Isolate one county</span>
          <select
            value={countyId ?? ''}
            onChange={(e) => chooseCounty(e.target.value || null)}
            aria-label="Isolate one county"
            title={COUNTY_EXTENT_NOTE}
          >
            <option value="">All Leonida</option>
            {COUNTIES.map((county) => (
              <option key={county.id} value={county.id}>
                {county.name}
              </option>
            ))}
          </select>
        </label>
        <span className="map-count-pill" role="status">
          {props.anyPublicLayerVisible || props.showingCount > 0
            ? `${props.showingCount.toLocaleString()} place${props.showingCount === 1 ? '' : 's'} showing`
            : 'Nothing showing — tap a chip below'}
        </span>
      </div>
      <div className="map-chips" role="group" aria-label="Turn layers on and off">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          const active = chipActive(chip);
          return (
            <button
              key={chip.key}
              type="button"
              className={`map-chip ${active ? 'active' : ''}`}
              aria-pressed={active}
              onClick={() => toggleChip(chip)}
            >
              <Icon size={15} />
              {chip.label}
              <span className="map-chip-count">{chipCount(chip)}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="map-chip map-chip-action"
          onClick={props.onAddWorkoutSpot}
          title="Mark a house gym or workout spot where you are looking"
        >
          + Workout spot
        </button>
      </div>
    </div>
  );
}
