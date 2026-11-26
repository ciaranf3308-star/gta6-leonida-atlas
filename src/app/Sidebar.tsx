import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  ChevronRight,
  Dumbbell,
  Home,
  MapPinPlus,
  Search,
  Settings,
  X,
} from 'lucide-react';
import type { Place } from '../domain/types';
import { displayTitleFor, isUnnamedPlace } from '../domain/types';
import {
  useDomainStore,
  useMapStore,
  usePersistenceStore,
  useUiStore,
  useUserStore,
} from '../stores/atlas';
import { useAiIndexStore } from '../features/categorise/store';
import { COUNTIES, countyForPlace, countyIdForPosition } from '../data/counties';
import { areaIsolation, areaOptions, countyIsolation } from '../features/map/isolation';
import { DEFAULT_LAYERS, layersWithCategoryEnabled } from '../features/map/layers';
import {
  PlaceIcon,
  iconKeyForAiRecord,
  iconKeyForPlace,
  type IconKey,
} from '../features/map/place-icons';
import { SavedPlaces } from '../features/library/SavedPlaces';
import { ProgressPanel } from '../features/completion/ProgressPanel';
import { Journal } from '../features/completion/Journal';
import { Album, type AlbumScreenshotPreset } from '../features/album/Album';
import { ScreenshotMatchPanel } from '../features/album/ScreenshotMatchPanel';
import { MatcherPanel } from '../features/ask/MatcherPanel';
import { completedPlaceIds } from '../features/completion/place-ids';
import { Status } from './Status';
import { setAccountEntryTarget } from '../capabilities/extension-host';
import { aiCategoryShortLabel, effectiveAiCategory } from '../features/categorise/categories';
import { INITIAL_BOUNDS } from '../features/map/coordinates';
import { CATEGORIES } from './categories';
import { distanceBetween, distanceWord } from '../domain/distance';
import {
  housesToCheck,
  isEquipmentQuery,
  isGymQuery,
  nearestVerifiedEquipment,
  nearestVerifiedGym,
} from '../domain/gym-check';
import {
  poiNoMatchMessage,
  poiUnpositionedMessage,
  searchPoi,
} from '../domain/search';
import { useSearchSplitStore } from '../stores/search-split';
import type { GameDatabase } from '../domain/game-db';
import {
  possibleBreakableHouse,
} from '../domain/interiors';
import { userTagsMap } from '../domain/user-tags';
import { tagResolutionFor } from '../domain/resolve-tags';
import { NEAR_DISTANCE_UNITS } from '../features/ask/retrieval';

/**
 * The panel — Collections and Progress live here, driven by the bottom
 * nav, and Find lives here as a search overlay on the Map tab (the map
 * search pill and `/` open it; it is not a nav tab). On a phone each
 * tab is a full screen over the map: nothing sits on the map itself.
 *
 * Step 5 (§6.5c): the old Layers sheet is gone. Its filter-only
 * contents live in the contextual map-filter sheet
 * (features/map/MapFilterSheet); the completion panel lives in the
 * Progress tab; the library lives in the Collections tab; trading
 * cards and Add-to-map live in Collections too; the AI indexing panel
 * left the primary experience entirely (developer-side enrichment —
 * the player's existing index is preserved, nothing gates on it);
 * county cards are gone (isolating a county is the area selector's
 * job now); the basemap credit lives on the Credits page, not in a
 * panel.
 */

/** Layer colour per layer id — the search-result roundel wears the layer colour. */
const LAYER_COLORS = new Map(DEFAULT_LAYERS.map((l) => [l.id, l.style.color]));

export interface LayerProgress {
  layerId: string;
  name: string;
  total: number;
  found: number;
  /** Explored (been there, checked it out) — separate from found. */
  explored: number;
}

/**
 * Explicit POI search results (§6.5b): locations, opportunities and
 * items by name, against the whole database — never the visible
 * subset. A row shows the name and kind only. Tapping a row reveals
 * THAT ONE record (adds it to the reveal set) and opens its card;
 * nothing else appears. Clearing this search touches POI only.
 */
function PoiResults({
  db,
  onSelect,
}: {
  db: GameDatabase;
  onSelect: (id: string) => void;
}) {
  const poiQuery = useSearchSplitStore((s) => s.poi.query);
  const clearPoi = useSearchSplitStore((s) => s.clearPoi);
  const revealRecord = useSearchSplitStore((s) => s.revealRecord);
  const outcome = useMemo(() => searchPoi(db, poiQuery), [db, poiQuery]);
  const resultsRef = useRef<HTMLDivElement>(null);
  // A search is the point of Find: when the rows (or the no-match
  // message) appear, bring them into view. The category browser above
  // them fills the viewport at 390px, so without this the player must
  // scroll past it to see the results — "Brooks Boatworks" showed "2
  // places showing" with the rows below the fold (2026-11-26). The
  // search field sits outside the scrolling content, so it stays put.
  useEffect(() => {
    if (poiQuery.trim() === '') return;
    resultsRef.current?.scrollIntoView({ block: 'start' });
  }, [poiQuery]);
  if (outcome.totalMatching === 0) {
    return (
      <div className="poi-results" ref={resultsRef}>
        <div className="poi-empty" role="status">
          <p>{poiNoMatchMessage(poiQuery, outcome.suggestion)}</p>
          {outcome.suggestion && (
            <button
              type="button"
              className="button"
              onClick={() =>
                useSearchSplitStore.getState().setPoiQuery(outcome.suggestion!)
              }
            >
              Search for {outcome.suggestion}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="poi-results" ref={resultsRef}>
      <div className="results-count">
        <span>
          {outcome.totalMatching.toLocaleString()} result
          {outcome.totalMatching === 1 ? '' : 's'}
        </span>
        <button type="button" className="text-button" onClick={clearPoi}>
          Clear search
        </button>
      </div>
      {outcome.allUnpositioned && (
        <p className="poi-unpositioned" role="status">
          {poiUnpositionedMessage(outcome.totalMatching)}
        </p>
      )}
      <div className="place-results" aria-label="Search results">
        {outcome.results.map((result) => (
          <button
            className="place-result"
            key={result.id}
            onClick={() => {
              revealRecord(result.id);
              if (result.hostLocationId) onSelect(result.hostLocationId);
            }}
          >
            <span>
              <strong>{result.name}</strong>
              <small>{result.kind}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Results({
  places,
  allPlaces,
  db,
  anyPublicLayerVisible,
  onSelect,
}: {
  places: Place[];
  allPlaces: Place[];
  db: GameDatabase | null;
  anyPublicLayerVisible: boolean;
  onSelect: (id: string) => void;
}) {
  const filters = useUiStore((s) => s.filters);
  const selectedId = useMapStore((s) => s.selectedId);
  const mapCenter = useMapStore((s) => s.mapCenter);
  const status = useDomainStore((s) => s.status);
  const placeTags = useUserStore((s) => s.placeTags);
  const aiCategories = useAiIndexStore((s) => s.categories);
  const poiQuery = useSearchSplitStore((s) => s.poi.query);
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
    const equipment = isEquipmentQuery(poiQuery);
    const gym = !equipment && isGymQuery(poiQuery);
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
      ? nearestVerifiedEquipment(allPlaces, anchor, userTagsMap(placeTags))
      : nearestVerifiedGym(allPlaces, anchor);
    if (!nearest || nearest.distance <= NEAR_DISTANCE_UNITS) return null;
    const houses = housesToCheck(allPlaces, anchor, (place) =>
      countyForPlace(place) === county.id,
    );
    return { county, nearest, housesTotal: houses.total, houses: houses.places, equipment };
  }, [poiQuery, filters.countyId, mapCenter, allPlaces, placeTags]);

  function showHousesToCheck() {
    if (!gymHint) return;
    // Reveal ONLY these houses (v0.30.0): their pins render as
    // highlights, with the county filter on — the whole Breakable
    // homes layer stays exactly as it was, so no unrelated house
    // appears island-wide as a side effect of this tap.
    useMapStore
      .getState()
      .setHighlights(gymHint.houses.map((place) => place.id));
    useUiStore.getState().setFilters({
      countyId: gymHint.county.id,
      enterableOnly: true,
    });
  }

  // Explicit POI search (§6.5b): while a POI query is active the
  // list is the database search, not the visible subset.
  if (db && poiQuery.trim() !== '') {
    return <PoiResults db={db} onSelect={onSelect} />;
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
            const aiCategory = effectiveAiCategory(aiCategories[place.id]);
            // A categorised "?" shows as "?" + its AI type — the name stays "?".
            // A "?" the map data's tags resolve to a type shows the same way.
            // An unresolved "?" is headlined by its area, never by "?".
            const tagResolution = tagResolutionFor(place);
            const displayTitle =
              isUnnamedPlace(place) && aiCategory
                ? `? · ${aiCategoryShortLabel(aiCategory)}`
                : isUnnamedPlace(place) && tagResolution
                  ? `? · ${aiCategoryShortLabel(tagResolution.category)}`
                  : displayTitleFor(place);
            const distance =
              place.position && mapCenter
                ? distanceWord(distanceBetween(place.position, mapCenter))
                : null;
            // The card face is minimal (v0.14.0): name, area, distance,
            // badges — nothing else. No evidence line, no "AI suggested"
            // line, no tag line: all of that lives behind one tap, in
            // the place sheet. A card that reads as a paragraph fails.
            const badges: string[] = [];
            if (place.tags.includes('enterable') || place.layerId === 'interiors')
              badges.push('Enterable');
            if (place.layerId === 'lootable') badges.push('Lootable');
            if (place.layerId === 'breakable' || possibleBreakableHouse(place))
              badges.push('Breakable');
            if (place.layerId === 'gyms' || place.tags.includes('gym') || place.tags.includes('fitness'))
              badges.push('Gym');
            else if (
              place.layerId === 'equipment' ||
              place.tags.includes('equipment') ||
              place.tags.includes('workout')
            )
              badges.push('Equipment');
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
                  {place.region || 'Leonida'}
                  {distance ? ` · ${distance}` : ''}
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
          yet. Open the map filter and turn on just what you want to see — your own markers are always
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

/** Find's own filters — three big native selects inside the Find
 * screen, never pills over the map. County isolates one county and
 * area isolates one town/city (both fly the map there and dim the
 * rest); kind narrows to one kind of place. The full layer switches
 * live in the map filter. */
function FindFilters({
  allPlaces,
  showingCount,
}: {
  allPlaces: Place[];
  showingCount: number;
}) {
  const filters = useUiStore((s) => s.filters);
  const layers = useMapStore((s) => s.layers);
  const areas = useMemo(() => areaOptions(allPlaces), [allPlaces]);
  function chooseCounty(id: string | null) {
    useUiStore.getState().setFilters({ countyId: id, area: null });
    const county = COUNTIES.find((c) => c.id === id);
    useMapStore.getState().setBoundsFocus(county ? county.bounds : INITIAL_BOUNDS);
    // Isolation, on the map: the county stays lit and named, the rest
    // of Leonida dims. Picking All Leonida lifts it.
    useMapStore.getState().setIsolation(county ? countyIsolation(county) : null);
  }
  /** Isolate one town/city/area: the area's own places draw its box,
   * the map dims outside it, the list shows only its places. */
  function chooseArea(area: string | null) {
    useUiStore.getState().setFilters({ area, countyId: null });
    const iso = area ? areaIsolation(area, allPlaces) : null;
    useMapStore.getState().setIsolation(iso);
    useMapStore.getState().setBoundsFocus(iso ? iso.bounds : INITIAL_BOUNDS);
  }
  const anythingActive =
    layers.some((l) => l.visible && l.id !== 'my-markers') ||
    filters.countyId !== null ||
    filters.area !== null ||
    filters.category !== 'all' ||
    filters.query !== '' ||
    filters.enterableOnly ||
    filters.lootableOnly ||
    filters.interiorHouseOnly ||
    filters.remainingOnly ||
    filters.favoritesOnly ||
    filters.personalOnly;
  return (
    <div className="find-filters">
      <label>
        <span>County</span>
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
      <label>
        <span>Area</span>
        <select
          value={filters.area ?? ''}
          onChange={(e) => chooseArea(e.target.value || null)}
          aria-label="Isolate one town, city or area"
        >
          <option value="">All Leonida</option>
          {areas.map((area) => (
            <option key={area.name} value={area.name}>
              {area.name} ({area.count.toLocaleString()})
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Kind</span>
        <select
          value={filters.category}
          onChange={(e) => {
            const category = e.target.value as (typeof CATEGORIES)[number]['id'];
            useUiStore.getState().setFilters({ category });
            // Picking a kind turns on its layers — the pick is the
            // request to see those places (layersWithCategoryEnabled).
            useMapStore
              .getState()
              .setLayers(
                layersWithCategoryEnabled(useMapStore.getState().layers, category),
              );
          }}
          aria-label="Show one kind of place"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.blurb ? `${c.name} — ${c.blurb}` : c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="find-count" role="status">
        {showingCount.toLocaleString()} place{showingCount === 1 ? '' : 's'} showing
        {anythingActive && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              useUiStore.getState().resetFilters();
              useMapStore.getState().setIsolation(null);
              useMapStore.getState().setBoundsFocus(INITIAL_BOUNDS);
              useMapStore
                .getState()
                .setLayers(
                  useMapStore
                    .getState()
                    .layers.map((layer) =>
                      layer.id === 'my-markers' ? layer : { ...layer, visible: false },
                    ),
                );
            }}
          >
            Clear all
          </button>
        )}
      </div>
      <p className="help-text">
        {allPlaces.length.toLocaleString()} places in the atlas.
      </p>
    </div>
  );
}

/** Browse by category — art-directed tiles, not a select. Tapping
 * one sets Find's Kind filter; tapping the active one clears it. The
 * tiles are the game's own Map Index (v0.21.0) — Personal, Story,
 * Robberies, Activities, Exploration, Vehicles, Weapons, Style, Food
 * & Drink — plus Collectibles, My markers and Unverified. */
const CATEGORY_ICONS: Record<string, IconKey> = {
  all: 'layers',
  personal: 'navigation',
  story: 'book',
  robberies: 'banknote',
  activities: 'weight',
  exploration: 'search',
  vehicles: 'car',
  weapons: 'crosshair',
  style: 'shirt',
  'food-drink': 'food',
  collectibles: 'gem',
  'my-markers': 'star',
  unverified: 'question',
};

function CategoryTiles() {
  const filters = useUiStore((s) => s.filters);
  return (
    <section className="category-tiles" aria-label="Browse by category">
      <h3>Browse by category</h3>
      <p className="help-text">
        The game’s own Map Index — pause map, D-pad Right — plus Collectibles, My markers and
        Unverified.
      </p>
      <div className="category-grid">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`category-tile ${filters.category === category.id ? 'active' : ''}`}
            aria-pressed={filters.category === category.id}
            onClick={() => {
              const next =
                filters.category === category.id
                  ? 'all'
                  : (category.id as (typeof CATEGORIES)[number]['id']);
              useUiStore.getState().setFilters({ category: next });
              // Picking a kind turns on its layers — the pick is the
              // request to see those places (layersWithCategoryEnabled).
              useMapStore
                .getState()
                .setLayers(
                  layersWithCategoryEnabled(useMapStore.getState().layers, next),
                );
            }}
          >
            <PlaceIcon icon={CATEGORY_ICONS[category.id] ?? 'layers'} size={20} />
            <span>{category.name}</span>
            {category.blurb && <small>{category.blurb}</small>}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Add to the map (step 5: re-homed from the old Layers sheet into
 * Collections). Your own marks only — nothing here invents a place. */
function AddToMapSection() {
  const ready = usePersistenceStore((s) => s.ready);
  function beginAdd(preset: 'marker' | 'workout' | 'breakable' | 'vehicle-loot') {
    useMapStore
      .getState()
      .setMarkerKindPreset(preset === 'marker' ? null : preset);
    useMapStore.getState().setEditor('create');
    useUiStore.getState().setNavTab('map');
  }
  return (
    <section className="add-section" aria-label="Add to the map">
      <h3>Add to the map</h3>
      <p className="panel-intro">
        Your own marks only — nothing here invents a place. Pick what you found, then tap
        the map to place it, or use the map centre.
      </p>
      <div className="add-options">
        <button type="button" className="button" disabled={!ready} onClick={() => beginAdd('marker')}>
          <MapPinPlus size={18} />
          <span>
            Add marker
            <small>A place or note of your own</small>
          </span>
        </button>
        <button type="button" className="button" onClick={() => beginAdd('workout')}>
          <Dumbbell size={18} />
          <span>
            Add workout spot
            <small>Free equipment — a bench, a deck, a bar</small>
          </span>
        </button>
        <button type="button" className="button" onClick={() => beginAdd('breakable')}>
          <Home size={18} />
          <span>
            Add breakable home
            <small>A house you can get into — dark blue on the map</small>
          </span>
        </button>
        <button type="button" className="button" onClick={() => beginAdd('vehicle-loot')}>
          <Car size={18} />
          <span>
            Add vehicle-loot spot
            <small>A safe, garage or bunker with a vehicle or code</small>
          </span>
        </button>
      </div>
    </section>
  );
}

/** Find overlay (Map tab) — exported so tests can render it without
 * driving the nav store. The search field, Find's filters, the
 * category tiles and the results. */
export function FindPanel({
  places,
  allPlaces,
  db,
  anyPublicLayerVisible,
  showingCount,
  onSelect,
}: {
  places: Place[];
  allPlaces: Place[];
  db: GameDatabase | null;
  anyPublicLayerVisible: boolean;
  showingCount: number;
  onSelect: (id: string) => void;
}) {
  const poiQuery = useSearchSplitStore((s) => s.poi.query);
  const setPoiQuery = useSearchSplitStore((s) => s.setPoiQuery);
  const clearPoi = useSearchSplitStore((s) => s.clearPoi);
  return (
    <>
      <div className="search-field">
        <Search size={18} />
        <input
          id="atlas-search"
          type="search"
          maxLength={250}
          placeholder="Search places, shops, cards…"
          aria-label="Search places, opportunities and items"
          value={poiQuery}
          onChange={(e) => {
            // Explicit POI search (§6.5b): its own state, separate
            // from geo search and from layers. Clearing it never
            // touches either.
            setPoiQuery(e.target.value);
          }}
        />
        {poiQuery !== '' && (
          <button
            type="button"
            className="icon-button"
            aria-label="Clear search"
            onClick={clearPoi}
          >
            <X size={18} />
          </button>
        )}
        <kbd>/</kbd>
      </div>
      <div className="sidebar-content">
        <FindFilters allPlaces={allPlaces} showingCount={showingCount} />
        <CategoryTiles />
        <Results places={places} allPlaces={allPlaces} db={db} anyPublicLayerVisible={anyPublicLayerVisible} onSelect={onSelect} />
      </div>
    </>
  );
}

/** Collections tab content — exported so tests can render it without
 * driving the nav store. Step 6: the per-set layer list
 * (TradingCardSets — "18 sets, only N have a verified pin") is gone;
 * the journal lists every set and every item, pinned or not (DESIGN
 * §3.5). SavedPlaces and Add to the map stay, as step 5 placed them. */
export function CollectionsPanel({
  db,
  onSelect,
}: {
  db?: GameDatabase | null;
  onSelect?: (id: string) => void;
}) {
  // Demo F: the album is the Collections view over the same items and
  // the same completion log as the journal — List is the journal rows,
  // Album is the 480-slot card album. The screenshot-match sheet is
  // shared by both views (and by per-set / per-card buttons inside
  // the album) via the preset.
  const [view, setView] = useState<'list' | 'album'>('list');
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchPreset, setMatchPreset] = useState<AlbumScreenshotPreset | null>(null);
  const [photosRefresh, setPhotosRefresh] = useState(0);
  function openScreenshotMatch(preset: AlbumScreenshotPreset) {
    setMatchPreset(preset);
    setMatchOpen(true);
  }
  return (
    <div className="sidebar-content">
      <SavedPlaces foundIds={db ? completedPlaceIds(db) : new Set<string>()} />
      <MatcherPanel db={db ?? null} />
      <div className="collections-view-switch" role="group" aria-label="Collections view">
        <button
          type="button"
          className="button"
          aria-pressed={view === 'list'}
          onClick={() => setView('list')}
        >
          List
        </button>
        <button
          type="button"
          className="button"
          aria-pressed={view === 'album'}
          onClick={() => setView('album')}
        >
          Album
        </button>
        <button
          type="button"
          className="button"
          onClick={() => openScreenshotMatch({ kind: 'card-front' })}
        >
          Add from screenshot
        </button>
      </div>
      <ScreenshotMatchPanel
        db={db ?? null}
        open={matchOpen}
        preset={matchPreset}
        onClose={() => setMatchOpen(false)}
        onApplied={() => setPhotosRefresh((current) => current + 1)}
        onPhotoSaved={() => setPhotosRefresh((current) => current + 1)}
      />
      {view === 'album' ? (
        <Album
          db={db ?? null}
          onSelectPlace={onSelect}
          onAddFromScreenshot={openScreenshotMatch}
          photosRefresh={photosRefresh}
        />
      ) : (
        <Journal db={db ?? null} onSelectPlace={onSelect} />
      )}
      <AddToMapSection />
    </div>
  );
}

export function Sidebar({
  places,
  allPlaces,
  db,
  progress,
  anyPublicLayerVisible,
  showingCount,
  onSelect,
}: {
  places: Place[];
  allPlaces: Place[];
  db: GameDatabase | null;
  progress: LayerProgress[];
  anyPublicLayerVisible: boolean;
  showingCount: number;
  onSelect: (id: string) => void;
}) {
  const navTab = useUiStore((s) => s.navTab);
  const findOpen = useUiStore((s) => s.findOpen);
  // Find wins while it is open — it is a search overlay, and opening
  // it from Collections (a row tap) returns to Collections when it
  // closes. Otherwise the open tab decides.
  const showingFind = findOpen;
  if (navTab !== 'collections' && navTab !== 'progress' && !showingFind) return null;
  const title = showingFind ? 'Find a place' : navTab === 'collections' ? 'Collections' : 'Progress';
  function closePanel() {
    if (showingFind) {
      useUiStore.getState().setFindOpen(false);
      return;
    }
    useUiStore.getState().setNavTab('map');
  }
  return (
    <aside
      className="sidebar"
      aria-label="Atlas panel"
    >
      <header className="brand-header">
        <div className="brand-identity">
          <img
            className="brand-mark"
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            aria-hidden="true"
          />
          <div>
            <h1>
              Vice<em>Wire</em>
            </h1>
            <p>GTA VI · Leonida</p>
          </div>
        </div>
        <button
          className="icon-button"
          aria-label="Close panel"
          onClick={closePanel}
        >
          <X size={21} />
        </button>
      </header>
      <h2 className="panel-title">{title}</h2>
      {showingFind ? (
        <FindPanel
          places={places}
          allPlaces={allPlaces}
          db={db}
          anyPublicLayerVisible={anyPublicLayerVisible}
          showingCount={showingCount}
          onSelect={onSelect}
        />
      ) : navTab === 'collections' ? (
        <CollectionsPanel db={db} onSelect={onSelect} />
      ) : (
        <div className="sidebar-content">
          <ProgressPanel progress={progress} db={db} />
        </div>
      )}
      <footer className="sidebar-footer">
        <div ref={setAccountEntryTarget} data-atlas-account-slot />
        <Status />
        <button
          className="text-button sidebar-settings-link"
          onClick={() => useUiStore.getState().setDialog('settings')}
        >
          <Settings size={16} />
          Settings
        </button>
      </footer>
    </aside>
  );
}
