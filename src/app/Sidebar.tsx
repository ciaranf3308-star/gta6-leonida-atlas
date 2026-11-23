import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  ChevronRight,
  Compass,
  Database,
  Layers,
  MapPin,
  Search,
  Settings,
  X,
} from 'lucide-react';
import type { Category, Place } from '../domain/types';
import { useDomainStore, useMapStore, useUiStore } from '../stores/atlas';
import { COUNTIES, COUNTY_EXTENT_NOTE } from '../data/counties';
import { INITIAL_BOUNDS } from '../features/map/coordinates';
import { SavedPlaces } from '../features/library/SavedPlaces';
import { Status } from './Status';
import { setAccountEntryTarget } from '../capabilities/extension-host';

export const CATEGORIES: { id: Category | 'all'; name: string }[] = [
  { id: 'all', name: 'All places' },
  { id: 'region', name: 'Regions' },
  { id: 'landmark', name: 'Landmarks' },
  { id: 'nature', name: 'Nature' },
  { id: 'transport', name: 'Transport' },
  { id: 'business', name: 'Businesses' },
  { id: 'personal', name: 'My markers' },
];

export interface LayerProgress {
  layerId: string;
  name: string;
  total: number;
  found: number;
}

function CountyPicker() {
  const countyId = useUiStore((s) => s.filters.countyId);
  function choose(id: string | null) {
    useUiStore.getState().setFilters({ countyId: id });
    const county = COUNTIES.find((c) => c.id === id);
    useMapStore
      .getState()
      .setBoundsFocus(county ? county.bounds : INITIAL_BOUNDS);
  }
  return (
    <div className="county-picker">
      <h3>Counties</h3>
      <p className="panel-intro">
        Isolate one county — the map zooms to it and the list shows only places in it.
      </p>
      <div className="county-buttons">
        <button
          type="button"
          className={countyId === null ? 'active' : ''}
          aria-pressed={countyId === null}
          onClick={() => choose(null)}
        >
          All Leonida
        </button>
        {COUNTIES.map((county) => (
          <button
            type="button"
            key={county.id}
            className={countyId === county.id ? 'active' : ''}
            aria-pressed={countyId === county.id}
            onClick={() => choose(county.id)}
          >
            {county.name}
            <small>{county.area}</small>
          </button>
        ))}
      </div>
      <p className="empty-state">{COUNTY_EXTENT_NOTE}</p>
    </div>
  );
}

function LayerManager({ progress }: { progress: LayerProgress[] }) {
  const layers = useMapStore((s) => s.layers);
  const totalById = new Map(progress.map((entry) => [entry.layerId, entry.total]));
  const ordered = [...layers].sort((a, b) => b.order - a.order);
  function move(id: string, direction: number) {
    const index = ordered.findIndex((l) => l.id === id);
    const neighbor = ordered[index + direction];
    const current = ordered[index];
    if (!neighbor || !current) return;
    useMapStore
      .getState()
      .setLayers(
        layers.map((layer) =>
          layer.id === id
            ? { ...layer, order: neighbor.order }
            : layer.id === neighbor.id
              ? { ...layer, order: current.order }
              : layer,
        ),
      );
  }
  function row(layer: (typeof ordered)[number], index: number) {
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
          <span className="layer-dot" style={{ background: layer.style.color }} />
          <span>
            {layer.name}
            {totalById.has(layer.id) && (
              <> · {(totalById.get(layer.id) ?? 0).toLocaleString()} places</>
            )}
            <small>{layer.description}</small>
          </span>
        </label>
        <div>
          <button
            className="icon-button"
            aria-label={`Raise ${layer.name}`}
            disabled={index === 0}
            onClick={() => move(layer.id, -1)}
          >
            <ArrowUp size={15} />
          </button>
          <button
            className="icon-button"
            aria-label={`Lower ${layer.name}`}
            disabled={index === ordered.length - 1}
            onClick={() => move(layer.id, 1)}
          >
            <ArrowDown size={15} />
          </button>
        </div>
      </div>
    );
  }
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
  return (
    <div className="layer-manager">
      <CountyPicker />
      <p className="panel-intro">
        Your map starts blank on purpose — nothing is shown until you choose it. Turn a layer
        on only when you want to see those places. Layers at the top draw above the others.
        Your choices are remembered on this device, so the map comes back as you left it.
      </p>
      {mainLayers.map((layer) => row(layer, ordered.indexOf(layer)))}
      <details className="layer-group">
        <summary>
          Trading cards · {cardPins.toLocaleString()} verified pin
          {cardPins === 1 ? '' : 's'} so far
        </summary>
        <p className="panel-intro">
          18 sets, 480 cards in total — only {cardPins} have a verified spot on the map so far.
          The rest have no verified position yet. Turn a set on only when you want to hunt it.
        </p>
        {cardLayersWithPins.map((layer) => row(layer, ordered.indexOf(layer)))}
        {cardLayers.length - cardLayersWithPins.length > 0 && (
          <p className="empty-state">
            {cardLayers.length - cardLayersWithPins.length} more set
            {cardLayers.length - cardLayersWithPins.length === 1 ? '' : 's'} with no verified
            pin yet — they are hidden until a card in the set gets a verified spot.
          </p>
        )}
      </details>
      <p className="empty-state">
        The basemap is the GTADB in-game map (map artwork © Rockstar Games, CC BY 4.0). Place
        positions are approximate community data.
      </p>
    </div>
  );
}

const TAG_CHIPS: { label: string; query: string }[] = [
  { label: 'Gym', query: 'gym' },
  { label: 'Houses', query: 'residential' },
  { label: 'Enterable', query: 'enterable' },
  { label: 'Shops', query: 'retail' },
  { label: 'Petrol', query: '#gas' },
  { label: 'Food', query: '#food' },
];

function Results({
  places,
  anyPublicLayerVisible,
}: {
  places: Place[];
  anyPublicLayerVisible: boolean;
}) {
  const filters = useUiStore((s) => s.filters);
  const selectedId = useMapStore((s) => s.selectedId);
  const status = useDomainStore((s) => s.status);
  const [limit, setLimit] = useState(50);
  useEffect(() => setLimit(50), [filters]);
  function select(place: Place) {
    useMapStore.getState().select(place);
    if (window.innerWidth < 1000) useUiStore.getState().setSidebar(false);
  }
  return (
    <>
      <div className="filter-controls">
        <label htmlFor="category">Browse categories</label>
        <select
          id="category"
          value={filters.category}
          onChange={(e) =>
            useUiStore.getState().setFilters({ category: e.target.value as Category | 'all' })
          }
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="tag-chips" aria-label="Find by type">
          <span>Find by type:</span>
          {TAG_CHIPS.map((chip) => {
            const active = filters.query === chip.query;
            return (
              <button
                key={chip.query}
                type="button"
                className={active ? 'active' : ''}
                aria-pressed={active}
                onClick={() =>
                  useUiStore
                    .getState()
                    .setFilters({ query: active ? '' : chip.query })
                }
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <div className="row-between">
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.favoritesOnly}
              onChange={(e) =>
                useUiStore.getState().setFilters({ favoritesOnly: e.target.checked })
              }
            />
            Favorites
          </label>
          <select
            className="compact-select"
            aria-label="Show places by how sure we are"
            value={filters.evidence}
            onChange={(e) =>
              useUiStore
                .getState()
                .setFilters({ evidence: e.target.value as 'all' | 'approximate' | 'uncertain' })
            }
          >
            <option value="all">All places</option>
            <option value="approximate">Named places</option>
            <option value="uncertain">Unverified places</option>
          </select>
        </div>
        <div className="row-between">
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.hideFound}
              onChange={(e) =>
                useUiStore.getState().setFilters({ hideFound: e.target.checked })
              }
            />
            Hide places I’ve found
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.remainingOnly}
              onChange={(e) =>
                useUiStore.getState().setFilters({ remainingOnly: e.target.checked })
              }
            />
            Only places I haven’t found
          </label>
        </div>
      </div>
      <div className="results-count">
        <span>{places.length.toLocaleString()} results</span>
        <button className="text-button" onClick={() => useUiStore.getState().resetFilters()}>
          Reset filters
        </button>
      </div>
      {status === 'loading' ? (
        <p className="empty-state">Loading the public catalogue…</p>
      ) : places.length ? (
        <div className="place-results" aria-label="Search results">
          {places.slice(0, limit).map((place) => (
            <button
              className={`place-result ${selectedId === place.id ? 'active' : ''}`}
              key={place.id}
              onClick={() => select(place)}
            >
              <MapPin size={19} />
              <span>
                <strong>{place.title || 'Unnamed entry'}</strong>
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
                </small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
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
      {places.length > limit && (
        <button className="load-more" onClick={() => setLimit((n) => n + 50)}>
          Show next {Math.min(50, places.length - limit)} places
        </button>
      )}
    </>
  );
}

export function Sidebar({
  places,
  progress,
  anyPublicLayerVisible,
}: {
  places: Place[];
  progress: LayerProgress[];
  anyPublicLayerVisible: boolean;
}) {
  const tab = useUiStore((s) => s.tab);
  const open = useUiStore((s) => s.sidebarOpen);
  const query = useUiStore((s) => s.filters.query);
  return (
    <aside className="sidebar" data-open={open} aria-label="Atlas sidebar">
      <header className="brand-header">
        <div>
          <h1>LEONIDA ATLAS</h1>
          <p>GTA VI INDEPENDENT COMMUNITY ATLAS</p>
        </div>
        <button
          className="icon-button mobile-only"
          aria-label="Close sidebar"
          onClick={() => useUiStore.getState().setSidebar(false)}
        >
          <X size={21} />
        </button>
      </header>
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
            useUiStore.getState().setTab('explore');
          }}
        />
        <kbd>/</kbd>
      </div>
      <nav className="sidebar-tabs" aria-label="Atlas tools">
        {(
          [
            { id: 'explore', name: 'Explore', icon: Compass },
            { id: 'layers', name: 'Layers', icon: Layers },
            { id: 'saved', name: 'Saved', icon: Bookmark },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => useUiStore.getState().setTab(item.id)}
          >
            <item.icon size={18} />
            {item.name}
          </button>
        ))}
      </nav>
      <div className="sidebar-content">
        {tab === 'explore' ? (
          <Results places={places} anyPublicLayerVisible={anyPublicLayerVisible} />
        ) : tab === 'layers' ? (
          <LayerManager progress={progress} />
        ) : (
          <SavedPlaces progress={progress} />
        )}
      </div>
      <footer className="sidebar-footer">
        <div ref={setAccountEntryTarget} data-atlas-account-slot />
        <Status />
        <div className="button-row">
          <button className="button" onClick={(event) => {
              event.currentTarget.focus();
              useUiStore.getState().setDialog('settings');
            }}>
            <Settings size={17} />
            Settings
          </button>
          <button className="button" onClick={(event) => {
              event.currentTarget.focus();
              useUiStore.getState().setDialog('backup');
            }}>
            <Database size={17} />
            Backup
          </button>
        </div>
      </footer>
    </aside>
  );
}
