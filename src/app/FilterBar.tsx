import { useMemo } from 'react';
import { Layers, Sparkles, X } from 'lucide-react';
import type { Category, Place } from '../domain/types';
import { filterPlaces } from '../domain/filter';
import { COUNTIES } from '../data/counties';
import { INITIAL_BOUNDS } from '../features/map/coordinates';
import { useMapStore, useUiStore, useUserStore } from '../stores/atlas';
import { useAiIndexStore } from '../features/categorise/store';
import { tagResolutionCounts } from '../domain/resolve-tags';
import { PlaceIcon, type IconKey } from '../features/map/place-icons';
import type { LayerDefinition } from '../domain/types';
import {
  VENUE_TYPE_OPTIONS,
  venueTypeCounts,
  type VenueType,
} from '../domain/interiors';

/**
 * THE one filter system — the same bar on the map and at the top of Find.
 * Everything that decides what shows lives here, and only here. v0.11.0:
 * TWO rows, and only two — the map must dominate, so the old four-row
 * stack (count + Clear all, wrapping layer chips, a second scrolling
 * narrow row, active-filter pills) is gone:
 *
 * - Row 1: the ONE place count ("76 places" — the map caption's
 *   "76 places in view" was the same number twice, so the caption is
 *   gone), the indexing reminder pill while the job has never run, and
 *   Clear all when anything is active.
 * - Row 2: ONE horizontally scrolling strip — county, kind, layer
 *   chips, narrowing chips, the interior-type picker, More layers.
 *   Active filters read from the chips themselves (active state, select
 *   value); there is no pills row repeating them.
 *
 * Quick chips turn whole layers on and off (Gyms, Workout equipment,
 * Lootable, Shops, Interiors, Breakable homes, Cards, My markers). Gyms
 * and Workout equipment are separate chips on purpose: a member club is
 * not free gear, and a search for equipment must not answer from the
 * gyms. Breakable homes is separate from Interiors on purpose too: a
 * house you can break into is not a shop interior. Each chip says how
 * many places it would put on the map, so a tap never surprises.
 * Narrowing chips narrow what is already showing: Can go inside,
 * Interior houses, Not found yet, Saved only, My markers only — plus
 * Lootable only, which appears while the Lootable layer is on, and the
 * Interior type picker, which appears while an interiors layer is on.
 * County and kind narrow by place, and apply instantly to the map.
 *
 * Nothing here is buried in a sidebar that starts closed: on a phone the
 * bar sits on the map itself, and the same bar tops the Find list.
 */

export const CATEGORIES: { id: Category | 'all'; name: string }[] = [
  { id: 'all', name: 'All kinds' },
  { id: 'region', name: 'Regions' },
  { id: 'landmark', name: 'Landmarks' },
  { id: 'nature', name: 'Nature' },
  { id: 'transport', name: 'Transport' },
  { id: 'business', name: 'Businesses' },
  { id: 'personal', name: 'My markers' },
];

interface LayerChip {
  key: string;
  label: string;
  layerIds: string[] | 'cards';
  icon: IconKey;
}

const LAYER_CHIPS: LayerChip[] = [
  { key: 'gyms', label: 'Gyms', layerIds: ['gyms'], icon: 'gym' },
  { key: 'equipment', label: 'Workout equipment', layerIds: ['equipment'], icon: 'weight' },
  { key: 'lootable', label: 'Lootable', layerIds: ['lootable'], icon: 'dollarsign' },
  { key: 'shops', label: 'Shops', layerIds: ['shops'], icon: 'store' },
  { key: 'interiors', label: 'Interiors', layerIds: ['interiors'], icon: 'door' },
  { key: 'breakable', label: 'Breakable homes', layerIds: ['breakable'], icon: 'home' },
  { key: 'cards', label: 'Cards', layerIds: 'cards', icon: 'gem' },
  { key: 'personal', label: 'My markers', layerIds: ['personal'], icon: 'star' },
];

function chipLayerIds(chip: LayerChip, layers: LayerDefinition[]): string[] {
  if (chip.layerIds !== 'cards') return chip.layerIds;
  return layers.filter((l) => l.id.startsWith('cards:')).map((l) => l.id);
}

export default function FilterBar({
  allPlaces,
  showingCount,
}: {
  allPlaces: Place[];
  /** Positioned places currently matching the filters. */
  showingCount: number;
}) {
  const layers = useMapStore((s) => s.layers);
  const filters = useUiStore((s) => s.filters);
  const favorites = useUserStore((s) => s.favorites);
  const notes = useUserStore((s) => s.notes);
  const collections = useUserStore((s) => s.collections);
  const visited = useUserStore((s) => s.visited);
  const aiCategories = useAiIndexStore((s) => s.categories);
  const attempted = useAiIndexStore((s) => s.job.attemptedPlaceIds.length);
  const byId = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);
  const visibleIds = useMemo(
    () => new Set(layers.filter((l) => l.visible).map((l) => l.id)),
    [layers],
  );
  const cardLayerIds = useMemo(
    () => layers.filter((l) => l.id.startsWith('cards:')).map((l) => l.id),
    [layers],
  );
  const cardsOn = cardLayerIds.some((id) => byId.get(id)?.visible);
  const favoriteIds = useMemo(() => favorites.map((f) => f.placeId), [favorites]);
  const visitedIds = useMemo(() => visited.map((v) => v.placeId), [visited]);

  /** "?" places the map data's own tags cannot resolve — the indexing
   * job's real remaining work (2,151 on a fresh phone: 581 of the 2,732
   * "?" already have a type from their tags, so they never needed the
   * job). The reminder pill shows this number until the job has run at
   * least once, then it is gone for good. */
  const unnamedRemaining = useMemo(
    () => tagResolutionCounts(allPlaces).remaining,
    [allPlaces],
  );

  /** Positioned places in a layer, matching every other current filter. */
  const layerCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const matching = filterPlaces(
      allPlaces,
      filters,
      favoriteIds,
      notes,
      collections,
      visitedIds,
      aiCategories,
    );
    for (const place of matching) {
      if (!place.position) continue;
      counts.set(place.layerId, (counts.get(place.layerId) ?? 0) + 1);
    }
    return counts;
  }, [allPlaces, filters, favoriteIds, notes, collections, visitedIds, aiCategories]);

  /** Narrowing chips count within what is already showing. */
  const narrowCounts = useMemo(() => {
    const countWith = (patch: Partial<typeof filters>) => {
      const matching = filterPlaces(
        allPlaces,
        { ...filters, ...patch },
        favoriteIds,
        notes,
        collections,
        visitedIds,
        aiCategories,
      );
      return matching.filter((p) => p.position && visibleIds.has(p.layerId)).length;
    };
    return {
      enterable: countWith({ enterableOnly: true }),
      lootable: countWith({ lootableOnly: true }),
      interiorHouse: countWith({ interiorHouseOnly: true }),
      remaining: countWith({ remainingOnly: true }),
      favorites: countWith({ favoritesOnly: true }),
      personal: countWith({ personalOnly: true }),
    };
  }, [allPlaces, filters, favoriteIds, notes, collections, visitedIds, aiCategories, visibleIds]);

  /** Enterable places per venue type, matching every other current filter. */
  const venueCounts = useMemo(() => {
    const matching = filterPlaces(
      allPlaces,
      { ...filters, venueType: 'all' },
      favoriteIds,
      notes,
      collections,
      visitedIds,
      aiCategories,
    );
    return venueTypeCounts(matching);
  }, [allPlaces, filters, favoriteIds, notes, collections, visitedIds, aiCategories]);

  function setLayers(next: LayerDefinition[]) {
    useMapStore.getState().setLayers(next);
  }

  function toggleChip(chip: LayerChip) {
    const ids = chipLayerIds(chip, layers);
    if (chip.key === 'cards') {
      const on = !cardsOn;
      setLayers(
        layers.map((layer) =>
          layer.id.startsWith('cards:')
            ? { ...layer, visible: on && (layerCounts.get(layer.id) ?? 0) > 0 }
            : layer,
        ),
      );
      return;
    }
    const anyOn = ids.some((id) => byId.get(id)?.visible);
    setLayers(
      layers.map((layer) =>
        ids.includes(layer.id) ? { ...layer, visible: !anyOn } : layer,
      ),
    );
  }

  function chipCount(chip: LayerChip): number {
    return chipLayerIds(chip, layers).reduce(
      (sum, id) => sum + (layerCounts.get(id) ?? 0),
      0,
    );
  }

  function chipActive(chip: LayerChip): boolean {
    if (chip.key === 'cards') return cardsOn;
    return chipLayerIds(chip, layers).some((id) => byId.get(id)?.visible);
  }

  function chooseCounty(id: string | null) {
    useUiStore.getState().setFilters({ countyId: id });
    const county = COUNTIES.find((c) => c.id === id);
    useMapStore.getState().setBoundsFocus(county ? county.bounds : INITIAL_BOUNDS);
  }

  const anyLayerOn = layers.some((l) => l.visible && l.id !== 'personal');
  const lootableOn = byId.get('lootable')?.visible === true;
  const interiorsOn =
    byId.get('interiors')?.visible === true ||
    byId.get('breakable')?.visible === true ||
    filters.enterableOnly;
  const anythingActive =
    anyLayerOn ||
    filters.countyId !== null ||
    filters.category !== 'all' ||
    filters.query !== '' ||
    filters.enterableOnly ||
    filters.lootableOnly ||
    filters.interiorHouseOnly ||
    filters.venueType !== 'all' ||
    filters.remainingOnly ||
    filters.hideFound ||
    filters.favoritesOnly ||
    filters.personalOnly ||
    filters.collectionId !== null;

  function clearAll() {
    useUiStore.getState().resetFilters();
    setLayers(
      layers.map((layer) =>
        layer.id === 'personal' ? layer : { ...layer, visible: false },
      ),
    );
  }

  function toggleFlag(
    key:
      | 'enterableOnly'
      | 'lootableOnly'
      | 'remainingOnly'
      | 'favoritesOnly'
      | 'personalOnly'
      | 'interiorHouseOnly',
  ) {
    const patch: Partial<typeof filters> = { [key]: !filters[key] };
    // "Not found yet" is the same switch as the old hide-found checkbox.
    if (key === 'remainingOnly') patch.hideFound = !filters.remainingOnly;
    useUiStore.getState().setFilters(patch);
  }

  function openIndexJob() {
    useUiStore.getState().setAskOpen(false);
    useUiStore.getState().setNavTab('layers');
  }

  return (
    <div className="filter-bar" aria-label="Filter what the map shows">
      <div className="filter-bar-top">
        <span className="filter-count-pill" role="status">
          {showingCount.toLocaleString()} place{showingCount === 1 ? '' : 's'}
        </span>
        {attempted === 0 && unnamedRemaining > 0 && (
          <button
            type="button"
            className="filter-reminder-pill"
            onClick={openIndexJob}
            aria-label={`Sort the unnamed places — ${unnamedRemaining.toLocaleString()} still unnamed`}
          >
            <Sparkles size={14} />
            {unnamedRemaining.toLocaleString()} still unnamed — Sort them
          </button>
        )}
        {anythingActive && (
          <button type="button" className="filter-clear-all" onClick={clearAll}>
            <X size={14} /> Clear all
          </button>
        )}
      </div>
      <div className="filter-chips" role="group" aria-label="Show or hide kinds of places">
        <label className="filter-select-wrap">
          <span className="map-sr-only">Isolate one county</span>
          <select
            value={filters.countyId ?? ''}
            onChange={(e) => chooseCounty(e.target.value || null)}
            aria-label="Isolate one county"
          >
            <option value="">All Leonida</option>
            {COUNTIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-select-wrap">
          <span className="map-sr-only">Show one kind of place</span>
          <select
            value={filters.category}
            onChange={(e) =>
              useUiStore.getState().setFilters({ category: e.target.value as Category | 'all' })
            }
            aria-label="Show one kind of place"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {LAYER_CHIPS.map((chip) => {
          const active = chipActive(chip);
          return (
            <button
              key={chip.key}
              type="button"
              className={`filter-chip ${active ? 'active' : ''}`}
              aria-pressed={active}
              onClick={() => toggleChip(chip)}
            >
              <PlaceIcon icon={chip.icon} size={15} />
              {chip.label}
              <span className="filter-chip-count">{chipCount(chip)}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={`filter-chip narrow ${filters.enterableOnly ? 'active' : ''}`}
          aria-pressed={filters.enterableOnly}
          onClick={() => toggleFlag('enterableOnly')}
        >
          Can go inside
          <span className="filter-chip-count">{narrowCounts.enterable}</span>
        </button>
        <button
          type="button"
          className={`filter-chip narrow ${filters.interiorHouseOnly ? 'active' : ''}`}
          aria-pressed={filters.interiorHouseOnly}
          onClick={() => toggleFlag('interiorHouseOnly')}
        >
          Interior houses
          <span className="filter-chip-count">{narrowCounts.interiorHouse}</span>
        </button>
        {interiorsOn && (
          <label className="filter-select-wrap">
            <span className="map-sr-only">Show one kind of interior</span>
            <select
              value={filters.venueType}
              onChange={(e) =>
                useUiStore
                  .getState()
                  .setFilters({ venueType: e.target.value as VenueType | 'all' })
              }
              aria-label="Show one kind of interior"
            >
              {VENUE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === 'all'
                    ? 'All interiors'
                    : `${option.label} (${venueCounts[option.value as VenueType]})`}
                </option>
              ))}
            </select>
          </label>
        )}
        {lootableOn && (
          <button
            type="button"
            className={`filter-chip narrow ${filters.lootableOnly ? 'active' : ''}`}
            aria-pressed={filters.lootableOnly}
            onClick={() => toggleFlag('lootableOnly')}
          >
            Lootable only
            <span className="filter-chip-count">{narrowCounts.lootable}</span>
          </button>
        )}
        <button
          type="button"
          className={`filter-chip narrow ${filters.remainingOnly ? 'active' : ''}`}
          aria-pressed={filters.remainingOnly}
          onClick={() => toggleFlag('remainingOnly')}
        >
          Not found yet
          <span className="filter-chip-count">{narrowCounts.remaining}</span>
        </button>
        <button
          type="button"
          className={`filter-chip narrow ${filters.favoritesOnly ? 'active' : ''}`}
          aria-pressed={filters.favoritesOnly}
          onClick={() => toggleFlag('favoritesOnly')}
        >
          Saved only
          <span className="filter-chip-count">{narrowCounts.favorites}</span>
        </button>
        <button
          type="button"
          className={`filter-chip narrow ${filters.personalOnly ? 'active' : ''}`}
          aria-pressed={filters.personalOnly}
          onClick={() => toggleFlag('personalOnly')}
        >
          My markers only
          <span className="filter-chip-count">{narrowCounts.personal}</span>
        </button>
        <button
          type="button"
          className="filter-chip filter-chip-more"
          onClick={() => useUiStore.getState().setNavTab('layers')}
        >
          <Layers size={15} />
          More layers
        </button>
      </div>
    </div>
  );
}
