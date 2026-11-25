import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Dumbbell,
  Home,
  MapPinPlus,
  Search,
  Settings,
  Sparkles,
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
import { STUNT_JUMPS_TOTAL } from '../data/completion';
import { CompletionPanel } from '../features/completion/CompletionPanel';
import { areaIsolation, areaOptions, countyIsolation } from '../features/map/isolation';
import { countyOutlineSvg, islandOutlineSvg, useAfterHoursGeo } from '../features/map/after-hours-geo';
import { useCountyArt } from '../features/art/ai-images';
import { DEFAULT_LAYERS } from '../features/map/layers';
import {
  PlaceIcon,
  iconKeyForAiRecord,
  iconKeyForLayer,
  iconKeyForPlace,
  type IconKey,
} from '../features/map/place-icons';
import { SavedPlaces } from '../features/library/SavedPlaces';
import { Status } from './Status';
import { setAccountEntryTarget } from '../capabilities/extension-host';
import IndexPanel from '../features/categorise/IndexPanel';
import { aiCategoryShortLabel, effectiveAiCategory } from '../features/categorise/categories';
import { INITIAL_BOUNDS } from '../features/map/coordinates';
import { CATEGORIES, CATEGORY_GROUPS, EMPTY_GROUP_NOTES, MAP_INDEX_GROUPS } from './categories';
import { distanceBetween, distanceWord } from '../domain/distance';
import {
  housesToCheck,
  isEquipmentQuery,
  isGymQuery,
  nearestVerifiedEquipment,
  nearestVerifiedGym,
} from '../domain/gym-check';
import {
  VENUE_TYPE_OPTIONS,
  possibleBreakableHouse,
  venueTypeCounts,
  type VenueType,
} from '../domain/interiors';
import { filterPlaces } from '../domain/filter';
import { userTagsMap } from '../domain/user-tags';
import { tagResolutionCounts, tagResolutionFor } from '../domain/resolve-tags';
import { NEAR_DISTANCE_UNITS } from '../features/ask/retrieval';

/**
 * The panel — Find, Layers and Saved live here, driven by the bottom
 * nav. On a phone each tab is a full screen over the map: nothing sits
 * on the map itself. Find has its own two big filters (county, kind);
 * the layer switches live in Layers.
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
  /** Explored (been there, checked it out) — separate from found. */
  explored: number;
}

/** "Narrow it down" — the narrowing filters that used to live on the
 * old filter bar. They live in Layers now, as big toggle rows with
 * counts: Can go inside, Interior houses, Lootable only, Not found
 * yet, Saved only, My markers only — plus the interior-type picker
 * while an interiors layer is on. */
function NarrowFilters({ allPlaces }: { allPlaces: Place[] }) {
  const layers = useMapStore((s) => s.layers);
  const filters = useUiStore((s) => s.filters);
  const favorites = useUserStore((s) => s.favorites);
  const notes = useUserStore((s) => s.notes);
  const collections = useUserStore((s) => s.collections);
  const visited = useUserStore((s) => s.visited);
  const placeTags = useUserStore((s) => s.placeTags);
  const aiCategories = useAiIndexStore((s) => s.categories);
  const visibleIds = new Set(layers.filter((l) => l.visible).map((l) => l.id));
  const favoriteIds = favorites.map((f: { placeId: string }) => f.placeId);
  const visitedIds = visited.map((v: { placeId: string }) => v.placeId);
  const countWith = (patch: Partial<typeof filters>) => {
    const matching = filterPlaces(
      allPlaces,
      { ...filters, ...patch },
      favoriteIds,
      notes,
      collections,
      visitedIds,
      aiCategories,
      userTagsMap(placeTags),
    );
    return matching.filter((p) => p.position && visibleIds.has(p.layerId)).length;
  };
  const venueCounts = venueTypeCounts(
    filterPlaces(
      allPlaces,
      { ...filters, venueType: 'all' },
      favoriteIds,
      notes,
      collections,
      visitedIds,
      aiCategories,
      userTagsMap(placeTags),
    ),
  );
  const interiorsOn =
    layers.some((l) => l.id === 'interiors' && l.visible) ||
    layers.some((l) => l.id === 'breakable' && l.visible) ||
    filters.enterableOnly;
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
    if (key === 'remainingOnly') patch.hideFound = !filters.remainingOnly;
    useUiStore.getState().setFilters(patch);
  }
  const toggles: {
    key:
      | 'enterableOnly'
      | 'lootableOnly'
      | 'remainingOnly'
      | 'favoritesOnly'
      | 'personalOnly'
      | 'interiorHouseOnly';
    label: string;
    hint: string;
  }[] = [
    { key: 'enterableOnly', label: 'Can go inside', hint: 'Only places with an interior' },
    { key: 'interiorHouseOnly', label: 'Interior houses', hint: 'Houses you can go inside' },
    { key: 'lootableOnly', label: 'Lootable only', hint: 'Only places you can loot' },
    { key: 'remainingOnly', label: 'Not found yet', hint: 'Hide places you already found' },
    { key: 'favoritesOnly', label: 'Saved only', hint: 'Only your saved places' },
    { key: 'personalOnly', label: 'My markers only', hint: 'Only your own markers' },
  ];
  return (
    <section className="narrow-filters" aria-label="Narrow what shows">
      <h3>Narrow it down</h3>
      {toggles.map((toggle) => (
        <button
          key={toggle.key}
          type="button"
          className={`narrow-row ${filters[toggle.key] ? 'active' : ''}`}
          aria-pressed={filters[toggle.key]}
          onClick={() => toggleFlag(toggle.key)}
        >
          <span>
            <strong>{toggle.label}</strong>
            <small>{toggle.hint}</small>
          </span>
          <span className="narrow-count">{countWith({ [toggle.key]: true })}</span>
        </button>
      ))}
      {interiorsOn && (
        <label className="narrow-select">
          <span>Kind of interior</span>
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
    </section>
  );
}

function LayerManager({ progress, allPlaces }: { progress: LayerProgress[]; allPlaces: Place[] }) {
  const layers = useMapStore((s) => s.layers);
  const highlightIds = useMapStore((s) => s.highlightIds);
  const offline = usePersistenceStore((s) => s.offline);
  // Traced county outlines (After Hours geo) and key-painted county art.
  const geo = useAfterHoursGeo();
  const countyArt = useCountyArt();
  // The whole island, traced, for the "All Leonida" card.
  const islandOutline = islandOutlineSvg(geo);
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
  const filters = useUiStore((s) => s.filters);
  const attempted = useAiIndexStore((s) => s.job.attemptedPlaceIds.length);
  const ready = usePersistenceStore((s) => s.ready);
  /** "?" places the map data's own tags cannot resolve — the indexing
   * job's real remaining work (2,700 on a fresh phone). */
  const unnamedRemaining = tagResolutionCounts(allPlaces).remaining;
  function chooseCounty(id: string | null) {
    useUiStore.getState().setFilters({ countyId: id, area: null });
    const county = COUNTIES.find((c) => c.id === id);
    useMapStore.getState().setBoundsFocus(county ? county.bounds : INITIAL_BOUNDS);
    // Isolation, on the map: the county stays lit and named, the rest
    // of Leonida dims. Picking All Leonida lifts it.
    useMapStore.getState().setIsolation(county ? countyIsolation(county) : null);
  }
  function beginAdd(preset: 'marker' | 'workout' | 'breakable') {
    useMapStore
      .getState()
      .setMarkerKindPreset(preset === 'marker' ? null : preset);
    useMapStore.getState().setEditor('create');
    useUiStore.getState().setNavTab('map');
  }
  // Layers grouped by the game's Map Index (v0.21.0) — the nine
  // filters the pause map offers, in the game's order, then
  // Collectibles, My markers and Unverified. A layer with no verified
  // places yet (Weapons, Style) is hidden and the group says why,
  // instead of showing an empty toggle.
  function groupSection(group: (typeof CATEGORY_GROUPS)[number]) {
    const groupLayers = mainLayers.filter(
      (layer) =>
        layer.mapIndex === group.id &&
        (layer.id === 'my-markers' || (totalById.get(layer.id) ?? 0) > 0),
    );
    if (groupLayers.length === 0 && !EMPTY_GROUP_NOTES[group.id]) return null;
    return (
      <section className="layer-group-section" key={group.id} aria-label={group.name}>
        <h3 className="layer-group-title">
          <PlaceIcon icon={group.icon} size={18} />
          {group.name}
        </h3>
        <p className="help-text">{group.blurb}</p>
        {groupLayers.map((layer) => row(layer))}
        {groupLayers.length === 0 && EMPTY_GROUP_NOTES[group.id] && (
          <p className="empty-state">{EMPTY_GROUP_NOTES[group.id]}</p>
        )}
      </section>
    );
  }
  return (
    <div className="layer-manager">
      <button
        type="button"
        className="button"
        disabled={
          !layers.some((l) => l.visible && l.id !== 'my-markers') && highlightIds.length === 0
        }
        onClick={() => {
          // The one-tap kill switch (v0.30.0): layers off AND the reveal
          // cleared. A revealed pin is visible with every layer off, so
          // turning the layers off alone would leave a pin on screen
          // after "everything" was turned off — the spoiler promise is
          // that one tap leaves zero markers. My markers are untouched.
          const store = useMapStore.getState();
          store.setLayers(
            layers.map((l) =>
              l.id === 'my-markers' ? l : { ...l, visible: false },
            ),
          );
          store.clearHighlights();
        }}
      >
        Turn everything off
      </button>
      {/* v0.26.1: the nine Map Index groups come FIRST in the sheet —
        they are what Layers is for. v0.26.0 opened on the county
        cards and the first group title sat just below the sheet's
        bottom edge, ~3,000px down a ~6,944px scroll. County
        isolation stays, below the groups. */}
      {MAP_INDEX_GROUPS.map((group) => groupSection(group))}
      <section className="county-cards" aria-label="Isolate one county">
        <h3>Isolate a county</h3>
        <div className="county-grid">
          <button
            type="button"
            className={`county-card is-all ${filters.countyId === null ? 'active' : ''}`}
            aria-pressed={filters.countyId === null}
            onClick={() => chooseCounty(null)}
          >
            {/* The island, traced from the real map — the same traced
                geometry the county cards draw, so the card is never
                an empty dark tile. No "AI image" tag: this is traced
                geometry, not AI art. */}
            {islandOutline && (
              <svg
                className="county-outline"
                viewBox={islandOutline.viewBox}
                preserveAspectRatio="xMidYMid slice"
                aria-hidden="true"
              >
                <path d={islandOutline.coast} className="county-outline-coast" />
              </svg>
            )}
            <strong>All Leonida</strong>
            <small>The whole map</small>
            <small className="county-stunts">{STUNT_JUMPS_TOTAL} stunt jumps across Leonida</small>
          </button>
          {COUNTIES.map((county) => {
            // Art: a key-painted image wins over the bundled photograph.
            // Both are AI-generated art (never a photo of a real place),
            // so the card carries the "AI image" tag either way.
            const aiRecord = countyArt[county.id];
            const artSrc = aiRecord
              ? aiRecord.dataUrl
              : county.photo
                ? `${import.meta.env.BASE_URL ?? '/'}${county.photo}`
                : null;
            const outline = countyOutlineSvg(county, geo);
            return (
              <button
                type="button"
                key={county.id}
                className={`county-card ${artSrc ? 'has-photo' : ''} ${filters.countyId === county.id ? 'active' : ''}`}
                aria-pressed={filters.countyId === county.id}
                style={
                  artSrc
                    ? {
                        backgroundImage: `linear-gradient(180deg, #0b101800 30%, #0b1018d9 100%), url(${artSrc})`,
                      }
                    : undefined
                }
                onClick={() => chooseCounty(county.id)}
              >
                {outline && (
                  <svg
                    className="county-outline"
                    viewBox={outline.viewBox}
                    preserveAspectRatio="xMidYMid slice"
                    aria-hidden="true"
                  >
                    <path d={outline.estimate} className="county-outline-estimate" />
                    <path d={outline.coast} className="county-outline-coast" />
                  </svg>
                )}
                {artSrc && <span className="county-art-tag">AI image</span>}
                <strong>{county.name.replace(' County', '')}</strong>
                <small>{county.area}</small>
                <small className="county-stunts">{county.stuntJumps} stunt jumps</small>
              </button>
            );
          })}
        </div>
        <p className="help-text">
          The coastline on each card is traced from the in-game map; inland edges are estimates
          — the official map prints county names but no boundary lines.
        </p>
      </section>
      <CompletionPanel />
      {attempted === 0 && unnamedRemaining > 0 && (
        <button
          type="button"
          className="index-reminder"
          onClick={() =>
            document.getElementById('index-panel')?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          <Sparkles size={16} />
          <span>
            <strong>{unnamedRemaining.toLocaleString()} places still unnamed</strong>
            <small>Sort them with your key — tap here</small>
          </span>
        </button>
      )}
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
      {CATEGORY_GROUPS.filter((group) => group.id === 'my-markers' || group.id === 'unverified').map(
        (group) => groupSection(group),
      )}
      <NarrowFilters allPlaces={allPlaces} />
      <IndexPanel
        places={allPlaces}
        offline={offline}
        onOpenSettings={() => useUiStore.getState().setDialog('settings')}
      />
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
        </div>
      </section>
      <p className="empty-state">
        The basemap is the GTADB in-game map (map artwork © Rockstar Games, CC BY 4.0),
        colour-graded only — geography unchanged. Place positions are approximate
        community data. County stunt counts and 100% thresholds: gta6-leonida-map-data
        (gta6maps.io), CC BY 4.0 — county extents are estimates.
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
  const placeTags = useUserStore((s) => s.placeTags);
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
      ? nearestVerifiedEquipment(allPlaces, anchor, userTagsMap(placeTags))
      : nearestVerifiedGym(allPlaces, anchor);
    if (!nearest || nearest.distance <= NEAR_DISTANCE_UNITS) return null;
    const houses = housesToCheck(allPlaces, anchor, (place) =>
      countyForPlace(place) === county.id,
    );
    return { county, nearest, housesTotal: houses.total, houses: houses.places, equipment };
  }, [filters.query, filters.countyId, mapCenter, allPlaces, placeTags]);

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

/** Find's own filters — three big native selects inside the Find
 * screen, never pills over the map. County isolates one county and
 * area isolates one town/city (both fly the map there and dim the
 * rest); kind narrows to one kind of place. The full layer switches
 * live in Layers. */
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
          onChange={(e) =>
            useUiStore
              .getState()
              .setFilters({ category: e.target.value as (typeof CATEGORIES)[number]['id'] })
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
            onClick={() =>
              useUiStore
                .getState()
                .setFilters({
                  category:
                    filters.category === category.id
                      ? 'all'
                      : (category.id as (typeof CATEGORIES)[number]['id']),
                })
            }
          >
            <PlaceIcon icon={CATEGORY_ICONS[category.id] ?? 'layers'} size={20} />
            <span>{category.name}</span>
          </button>
        ))}
      </div>
    </section>
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
  onSelect,
}: {
  places: Place[];
  allPlaces: Place[];
  progress: LayerProgress[];
  anyPublicLayerVisible: boolean;
  showingCount: number;
  onSelect: (id: string) => void;
}) {
  const navTab = useUiStore((s) => s.navTab);
  const query = useUiStore((s) => s.filters.query);
  if (navTab !== 'explore' && navTab !== 'layers' && navTab !== 'saved') return null;
  /** Layers is a compact bottom sheet, not a full screen (v0.26.0):
   * the reference's filter presentation is a sheet over a live map,
   * and the panel's own intro paragraph went with the full screen —
   * the guidance ("nothing is turned on yet") now lives in the
   * first-open Vice City sheet. Find and Saved stay full screens:
   * they are lists, not filters. */
  const isLayersSheet = navTab === 'layers';
  return (
    <aside
      className={`sidebar${isLayersSheet ? ' is-layers-sheet' : ''}`}
      aria-label="Atlas panel"
    >
      {isLayersSheet && <div className="sheet-grabber" aria-hidden="true" />}
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
        {navTab === 'explore' && (
          <>
            <FindFilters allPlaces={allPlaces} showingCount={showingCount} />
            <CategoryTiles />
          </>
        )}
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
