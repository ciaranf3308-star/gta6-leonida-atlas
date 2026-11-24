import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  ChevronRight,
  Database,
  HelpCircle,
  Info,
  Search,
  Settings,
  X,
} from 'lucide-react';
import type { Place } from '../domain/types';
import { isUnnamedPlace } from '../domain/types';
import {
  useDomainStore,
  useMapStore,
  usePersistenceStore,
  useUiStore,
} from '../stores/atlas';
import { useAiIndexStore } from '../features/categorise/store';
import { COUNTIES, countyForPlace, countyIdForPosition } from '../data/counties';
import { DEFAULT_LAYERS } from '../features/map/layers';
import {
  PlaceIcon,
  iconKeyForAiRecord,
  iconKeyForLayer,
  iconKeyForPlace,
} from '../features/map/place-icons';
import { SavedPlaces } from '../features/library/SavedPlaces';
import { Status } from './Status';
import { setAccountEntryTarget } from '../capabilities/extension-host';
import IndexPanel from '../features/categorise/IndexPanel';
import { aiCategoryDisplay, aiCategoryShortLabel, effectiveAiCategory } from '../features/categorise/categories';
import FilterBar from './FilterBar';
import { distanceBetween, distanceWord } from '../domain/distance';
import {
  housesToCheck,
  isEquipmentQuery,
  isGymQuery,
  nearestVerifiedEquipment,
  nearestVerifiedGym,
} from '../domain/gym-check';
import { possibleBreakableHouse } from '../domain/interiors';
import { tagResolutionFor } from '../domain/resolve-tags';
import { NEAR_DISTANCE_UNITS } from '../features/ask/retrieval';

/**
 * The panel — Find, Layers and Saved live here, driven by the bottom
 * nav. There are no tabs inside the panel and no sidebar that starts
 * closed: the bottom nav IS the navigation, and the one filter bar
 * (FilterBar, shared with the map) sits at the top of Find.
 *
 * On a phone the panel is a bottom sheet above the bottom nav; on a
 * wide screen it is the left column. One sheet at a time: picking a
 * place closes the panel and opens the place detail instead.
 */

/** Layer colour per layer id — the search-result roundel wears the layer colour. */
const LAYER_COLORS = new Map(DEFAULT_LAYERS.map((l) => [l.id, l.style.color]));

export interface LayerProgress {
  layerId: string;
  name: string;
  total: number;
  found: number;
}

function LayerManager({ progress, allPlaces }: { progress: LayerProgress[]; allPlaces: Place[] }) {
  const layers = useMapStore((s) => s.layers);
  const offline = usePersistenceStore((s) => s.offline);
  const totalById = new Map(progress.map((entry) => [entry.layerId, entry.total]));
  const ordered = [...layers].sort((a, b) => b.order - a.order);
  // Trading-card sets live in one group at the bottom: only the sets with
  // a verified pin are listed — the rest have no verified position yet and
  // would otherwise fill the list with 18 empty rows.
  const mainLayers = ordered.filter((layer) => !layer.id.startsWith('cards:'));
  const cardLayers = ordered.filter((layer) => layer.id.startsWith('cards:'));
  const cardLayersWithPins = cardLayers.filter(
    (layer) => (totalById.get(layer.id) ?? 0) > 0,
  );
  const cardPins = cardLayers.reduce(
    (sum, layer) => sum + (totalById.get(layer.id) ?? 0),
    0,
  );
  function row(layer: (typeof ordered)[number]) {
    return (
      <div className="layer-row" key={layer.id}>
        <label>
          <input
            type="checkbox"
            checked={layer.visible}
            onChange={(e) =>
              useMapStore
                .getState()
                .setLayers(
                  layers.map((l) =>
                    l.id === layer.id ? { ...l, visible: e.target.checked } : l,
                  ),
                )
            }
          />
          <span
            className="layer-icon"
            style={{ background: layer.style.color }}
            aria-hidden="true"
          >
            <PlaceIcon icon={iconKeyForLayer(layer.id)} size={15} />
          </span>
          <span>
            {layer.name}
            {totalById.has(layer.id) && (
              <> · {(totalById.get(layer.id) ?? 0).toLocaleString()} places</>
            )}
            <small>{layer.description}</small>
          </span>
        </label>
      </div>
    );
  }
  return (
    <div className="layer-manager">
      <p className="panel-intro">
        Your map starts blank on purpose — nothing is shown until you choose it. Turn a layer
        on only when you want to see those places. Your choices are remembered on this device,
        so the map comes back as you left it.
      </p>
      {mainLayers.map((layer) => row(layer))}
      <details className="layer-group">
        <summary>
          Trading cards · {cardPins.toLocaleString()} verified pin
          {cardPins === 1 ? '' : 's'} so far
        </summary>
        <p className="panel-intro">
          18 sets, 480 cards in total — only {cardPins} have a verified spot on the map so far.
          The rest have no verified position yet. Turn a set on only when you want to hunt it.
        </p>
        {cardLayersWithPins.map((layer) => row(layer))}
        {cardLayers.length - cardLayersWithPins.length > 0 && (
          <p className="empty-state">
            {cardLayers.length - cardLayersWithPins.length} more set
            {cardLayers.length - cardLayersWithPins.length === 1 ? '' : 's'} with no verified
            pin yet — they are hidden until a card in the set gets a verified spot.
          </p>
        )}
      </details>
      <IndexPanel
        places={allPlaces}
        offline={offline}
        onOpenSettings={() => useUiStore.getState().setDialog('settings')}
      />
      <p className="empty-state">
        The basemap is the GTADB in-game map (map artwork © Rockstar Games, CC BY 4.0). Place
        positions are approximate community data.
      </p>
    </div>
  );
}

function Results({
  places,
  allPlaces,
  anyPublicLayerVisible,
  onSelect,
}: {
  places: Place[];
  allPlaces: Place[];
  anyPublicLayerVisible: boolean;
  onSelect: (id: string) => void;
}) {
  const filters = useUiStore((s) => s.filters);
  const selectedId = useMapStore((s) => s.selectedId);
  const mapCenter = useMapStore((s) => s.mapCenter);
  const status = useDomainStore((s) => s.status);
  const aiCategories = useAiIndexStore((s) => s.categories);
  const [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [filters]);
  function select(place: Place) {
    onSelect(place.id);
  }

  /** Nearest-first, from the map centre. Unpositioned entries go last. */
  const sorted = useMemo(() => {
    if (!filters.sortNearest || !mapCenter) return places;
    return [...places].sort((a, b) => {
      const da = a.position ? distanceBetween(a.position, mapCenter) : Infinity;
      const db = b.position ? distanceBetween(b.position, mapCenter) : Infinity;
      return da - db;
    });
  }, [places, filters.sortNearest, mapCenter]);

  /**
   * Gym or workout-equipment search with none near: say so, name the
   * nearest verified one, and offer the houses in that area worth
   * checking. Gyms and equipment are different questions with different
   * answers — an equipment search never names a member gym as the
   * nearest, and the houses are houses (the equipment the user knows
   * about is in a garage in a house). The anchor is the chosen county
   * (or the county under the map centre); without an area there is
   * nothing honest to say "near" about, so no card shows.
   */
  const gymHint = useMemo(() => {
    const equipment = isEquipmentQuery(filters.query);
    const gym = !equipment && isGymQuery(filters.query);
    if (!equipment && !gym) return null;
    const countyId =
      filters.countyId ?? (mapCenter ? countyIdForPosition(mapCenter) : null);
    const county = COUNTIES.find((c) => c.id === countyId);
    if (!county) return null;
    const anchor = filters.countyId
      ? {
          x: (county.bounds.west + county.bounds.east) / 2,
          y: (county.bounds.south + county.bounds.north) / 2,
        }
      : mapCenter!;
    const nearest = equipment
      ? nearestVerifiedEquipment(allPlaces, anchor)
      : nearestVerifiedGym(allPlaces, anchor);
    if (!nearest || nearest.distance <= NEAR_DISTANCE_UNITS) return null;
    const houses = housesToCheck(allPlaces, anchor, (place) =>
      countyForPlace(place) === county.id,
    );
    return { county, nearest, housesTotal: houses.total, equipment };
  }, [filters.query, filters.countyId, mapCenter, allPlaces]);

  function showHousesToCheck() {
    if (!gymHint) return;
    useMapStore.getState().setLayers(
      useMapStore
        .getState()
        .layers.map((layer) =>
          layer.id === 'breakable' ? { ...layer, visible: true } : layer,
        ),
    );
    useUiStore.getState().setFilters({
      query: '',
      countyId: gymHint.county.id,
      enterableOnly: true,
    });
  }

  return (
    <>
      <div className="results-count">
        <span>{places.length.toLocaleString()} results</span>
        <button
          type="button"
          className={`text-button ${filters.sortNearest ? 'selected-sort' : ''}`}
          aria-pressed={filters.sortNearest}
          disabled={!mapCenter}
          onClick={() =>
            useUiStore.getState().setFilters({ sortNearest: !filters.sortNearest })
          }
        >
          {filters.sortNearest ? 'Nearest first ✓' : 'Nearest first'}
        </button>
      </div>
      {gymHint && (
        <div className="gym-hint" role="status">
          {gymHint.equipment ? (
            <p>
              <strong>No verified workout equipment in {gymHint.county.name}.</strong>{' '}
              No guide lists any there, and no gym tag exists in the map data
              outside Ajax Gym. Nearest verified equipment is{' '}
              {gymHint.nearest.place.title}
              {gymHint.nearest.place.region ? `, ${gymHint.nearest.place.region}` : ''}{' '}
              — {distanceWord(gymHint.nearest.distance)?.toLowerCase() ?? 'far away'}.
            </p>
          ) : (
            <p>
              <strong>No verified gym in {gymHint.county.name}.</strong> No guide
              lists one there, and no gym tag exists in the map data outside
              Ajax Gym. Nearest verified gym is {gymHint.nearest.place.title}
              {gymHint.nearest.place.region ? `, ${gymHint.nearest.place.region}` : ''} —{' '}
              {distanceWord(gymHint.nearest.distance)?.toLowerCase() ?? 'far away'}.
            </p>
          )}
          {gymHint.housesTotal > 0 ? (
            <p>
              {gymHint.housesTotal} house{gymHint.housesTotal === 1 ? '' : 's'} in{' '}
              {gymHint.county.name} {gymHint.housesTotal === 1 ? 'is' : 'are'} worth
              checking — enterable houses and homes, not verified{' '}
              {gymHint.equipment ? 'workout equipment' : 'gyms'}. The equipment
              is in a garage in a house, so check the houses.
            </p>
          ) : (
            <p>No enterable houses are mapped in {gymHint.county.name} either.</p>
          )}
          {gymHint.housesTotal > 0 && (
            <button type="button" className="button" onClick={showHousesToCheck}>
              Show houses to check in {gymHint.county.name}
            </button>
          )}
        </div>
      )}
      {status === 'loading' ? (
        <p className="empty-state">Loading the public catalogue…</p>
      ) : sorted.length ? (
        <div className="place-results" aria-label="Search results">
          {sorted.slice(0, limit).map((place) => {
            const aiDisplay = aiCategoryDisplay(aiCategories[place.id]);
            const aiCategory = effectiveAiCategory(aiCategories[place.id]);
            // A categorised "?" shows as "?" + its AI type — the name stays "?".
            // A "?" the map data's tags resolve to a type shows the same way,
            // labelled "from its tags" below. An unresolved "?" stays "?".
            const tagResolution = tagResolutionFor(place);
            const displayTitle =
              isUnnamedPlace(place) && aiCategory
                ? `? · ${aiCategoryShortLabel(aiCategory)}`
                : isUnnamedPlace(place) && tagResolution
                  ? `? · ${aiCategoryShortLabel(tagResolution.category)}`
                  : place.title;
            const countyId = countyForPlace(place);
            const countyName = COUNTIES.find((c) => c.id === countyId)?.name.replace(
              ' County',
              '',
            );
            const distance =
              place.position && mapCenter
                ? distanceWord(distanceBetween(place.position, mapCenter))
                : null;
            const badges: string[] = [];
            if (place.tags.includes('enterable') || place.layerId === 'interiors')
              badges.push('Can go inside');
            if (place.layerId === 'breakable') badges.push('Breakable home');
            if (place.layerId === 'lootable') badges.push('Lootable');
            if (possibleBreakableHouse(place)) badges.push('Possible enterable house');
            return (
            <button
              className={`place-result ${selectedId === place.id ? 'active' : ''}`}
              key={place.id}
              onClick={() => select(place)}
            >
              <span
                className="result-icon"
                style={{ background: LAYER_COLORS.get(place.layerId) ?? '#e8823a' }}
                aria-hidden="true"
              >
                <PlaceIcon
                  icon={
                    iconKeyForAiRecord(aiCategories[place.id]) ?? iconKeyForPlace(place)
                  }
                  size={19}
                />
              </span>
              <span>
                <strong>{displayTitle || 'Unnamed entry'}</strong>
                <small>
                  {!place.position
                    ? 'Unpositioned'
                    : place.evidence === 'personal'
                      ? 'My marker'
                      : place.category === 'region'
                        ? 'Region · approximate'
                        : place.evidence === 'uncertain'
                          ? 'Unverified · position not confirmed'
                          : `${place.category} · approximate`}
                  {place.region ? ` · ${place.region}` : ''}
                  {countyName && place.region !== countyName ? ` · ${countyName}` : ''}
                  {distance ? ` · ${distance}` : ''}
                  {aiDisplay ? ` · AI suggested: ${aiDisplay.label}` : ''}
                  {!aiDisplay && tagResolution
                    ? ` · ${tagResolution.label} — from its tags`
                    : ''}
                </small>
                {badges.length > 0 && (
                  <span className="result-badges">
                    {badges.map((badge) => (
                      <span key={badge}>{badge}</span>
                    ))}
                  </span>
                )}
              </span>
              <ChevronRight size={16} />
            </button>
            );
          })}
        </div>
      ) : !anyPublicLayerVisible ? (
        <p className="empty-state">
          Your map starts blank on purpose — all layers are off, so there is nothing to list
          yet. Open Layers and turn on just what you want to see — your own markers are always
          listed. Or tap a chip on the map.
        </p>
      ) : (
        <p className="empty-state">
          No places match these filters. Try another name, region or tag.
        </p>
      )}
      {sorted.length > limit && (
        <button className="load-more" onClick={() => setLimit((n) => n + 50)}>
          Show next {Math.min(50, sorted.length - limit)} places
        </button>
      )}
    </>
  );
}

const PANEL_TITLES = {
  explore: 'Find a place',
  layers: 'Layers',
  saved: 'Saved',
} as const;

export function Sidebar({
  places,
  allPlaces,
  progress,
  anyPublicLayerVisible,
  showingCount,
  onNavigate,
  onShowWelcome,
  onSelect,
}: {
  places: Place[];
  allPlaces: Place[];
  progress: LayerProgress[];
  anyPublicLayerVisible: boolean;
  showingCount: number;
  onNavigate: (view: '3d' | 'about') => void;
  onShowWelcome: () => void;
  onSelect: (id: string) => void;
}) {
  const navTab = useUiStore((s) => s.navTab);
  const query = useUiStore((s) => s.filters.query);
  if (navTab !== 'explore' && navTab !== 'layers' && navTab !== 'saved') return null;
  return (
    <aside className="sidebar" aria-label="Atlas panel">
      <header className="brand-header">
        <div>
          <h1>
            Leonida <em>Atlas</em>
          </h1>
          <p>GTA VI INDEPENDENT COMMUNITY ATLAS</p>
        </div>
        <button
          className="icon-button"
          aria-label="Close panel"
          onClick={() => useUiStore.getState().setNavTab('map')}
        >
          <X size={21} />
        </button>
      </header>
      <h2 className="panel-title">{PANEL_TITLES[navTab]}</h2>
      {navTab === 'explore' && (
        <div className="search-field">
          <Search size={18} />
          <input
            id="atlas-search"
            type="search"
            maxLength={250}
            placeholder="Search places, regions, tags"
            aria-label="Search places, regions, tags"
            value={query}
            onChange={(e) => {
              useUiStore.getState().setFilters({ query: e.target.value });
            }}
          />
          <kbd>/</kbd>
        </div>
      )}
      <div className="sidebar-content">
        {/* The filter bar rides inside the scrolling content here — it
            used to sit above it as fixed chrome and left the results
            a 35px slit, with the "no places match" guidance below the
            fold where nobody could see it. */}
        {navTab === 'explore' && <FilterBar allPlaces={allPlaces} showingCount={showingCount} />}
        {navTab === 'explore' ? (
          <Results places={places} allPlaces={allPlaces} anyPublicLayerVisible={anyPublicLayerVisible} onSelect={onSelect} />
        ) : navTab === 'layers' ? (
          <LayerManager progress={progress} allPlaces={allPlaces} />
        ) : (
          <SavedPlaces progress={progress} />
        )}
      </div>
      <footer className="sidebar-footer">
        <div ref={setAccountEntryTarget} data-atlas-account-slot />
        <Status />
        <div className="button-row">
          <button className="button" onClick={() => useUiStore.getState().setDialog('settings')}>
            <Settings size={17} />
            Settings
          </button>
          <button className="button" onClick={() => useUiStore.getState().setDialog('backup')}>
            <Database size={17} />
            Backup
          </button>
          <button className="button" onClick={() => onNavigate('3d')}>
            <Box size={17} />
            3D explorer
          </button>
          <button className="button" onClick={() => onNavigate('about')}>
            <Info size={17} />
            About
          </button>
          <button className="button" onClick={onShowWelcome}>
            <HelpCircle size={17} />
            What is mapped
          </button>
        </div>
      </footer>
    </aside>
  );
}
