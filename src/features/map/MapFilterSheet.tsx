/**
 * Contextual map-filter sheet (v0.32 step 5) — filters only.
 *
 * This is what "Layers" became: the layer toggles grouped by the
 * game's Map Index, the narrowing toggles, the one-tap kill switch,
 * and the "Hide completed" toggle. No statistics, no paragraphs, no
 * county cards, no completion panel, no indexing panel, no Add
 * section, no trading-card sets, no basemap credit — those all left
 * for their step-5 homes (Progress / Collections / Settings / About).
 * The sheet is contextual: it opens over the Map tab from the map
 * filter button, and picking a place closes it (one sheet at a time).
 */
import { X } from 'lucide-react';
import { useMapStore, useUiStore } from '../../stores/atlas';
import {
  PlaceIcon,
  iconKeyForLayer,
} from './place-icons';
import { CATEGORY_GROUPS, EMPTY_GROUP_NOTES, MAP_INDEX_GROUPS } from '../../app/categories';
import {
  VENUE_TYPE_OPTIONS,
  type VenueType,
} from '../../domain/interiors';
import type { LayerDefinition } from '../../domain/types';

/** One layer toggle row — also used by the trading-card sets in Collections. */
export function LayerRow({ layer }: { layer: LayerDefinition }) {
  const layers = useMapStore((s) => s.layers);
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
          {/* Step 4 (§6.5c): the map-filter sheet is filter toggles
            only — no per-layer statistics. */}
          <small>{layer.description}</small>
        </span>
      </label>
    </div>
  );
}

/** "Hide completed" is the master switch for hiding finished
 * places: on it hides found places (hideFound); off it also lifts
 * "Not found yet", which implies the same hiding. The checked
 * state reads both flags, so the toggle never claims completed
 * places are showing while "Not found yet" hides them. Pure, so
 * tests can pin the truth table. */
export function hideCompletedChecked(filters: {
  hideFound: boolean;
  remainingOnly: boolean;
}): boolean {
  return filters.hideFound || filters.remainingOnly;
}
/** "Narrow it down" — the narrowing filters that used to live on the
 * old filter bar. They live here as big toggle rows: Can go inside,
 * Interior houses, Lootable only, Not found yet, Saved only, My
 * markers only — plus the interior-type picker while an interiors
 * layer is on. Step 5: "Hide completed" leads the list — it hides
 * places you already found or finished (filters.hideFound, the same
 * flag Ask's retrieval mirrors when it leaves found places out).
 * Toggles carry no statistics. */
function NarrowFilters() {
  const layers = useMapStore((s) => s.layers);
  const filters = useUiStore((s) => s.filters);
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
  // "Hide completed" is the master switch for hiding finished
  // places — see hideCompletedChecked above.
  const hideCompleted = hideCompletedChecked(filters);
  return (
    <section className="narrow-filters" aria-label="Narrow what shows">
      <h3>Narrow it down</h3>
      <button
        type="button"
        className={`narrow-row ${hideCompleted ? 'active' : ''}`}
        aria-pressed={hideCompleted}
        onClick={() => {
          if (hideCompleted) {
            useUiStore
              .getState()
              .setFilters({ hideFound: false, remainingOnly: false });
          } else {
            useUiStore.getState().setFilters({ hideFound: true });
          }
        }}
      >
        <span>
          <strong>Hide completed</strong>
          <small>Hide places you already found or finished</small>
        </span>
      </button>
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
                {option.value === 'all' ? 'All interiors' : option.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </section>
  );
}

export default function MapFilterSheet({
  progress,
  onClose,
}: {
  /** Per-layer totals (from App) — only used to hide layer groups
   * with no verified places yet. */
  progress: readonly { layerId: string; total: number }[];
  onClose: () => void;
}) {
  const layers = useMapStore((s) => s.layers);
  const highlightIds = useMapStore((s) => s.highlightIds);
  const totalById = new Map(progress.map((entry) => [entry.layerId, entry.total]));
  const ordered = [...layers].sort((a, b) => b.order - a.order);
  // Trading-card sets are NOT here any more (step 5: they live in
  // Collections) — only the main layers toggle from this sheet.
  const mainLayers = ordered.filter((layer) => !layer.id.startsWith('cards:'));
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
        {/* Step 4 (§6.5c): the map-filter sheet is filter toggles
          only — no explanatory paragraphs under the group titles. */}
        {groupLayers.map((layer) => (
          <LayerRow key={layer.id} layer={layer} />
        ))}
        {groupLayers.length === 0 && EMPTY_GROUP_NOTES[group.id] && (
          <p className="empty-state">{EMPTY_GROUP_NOTES[group.id]}</p>
        )}
      </section>
    );
  }
  return (
    <aside className="map-filter-sheet" aria-label="Map filters">
      <div className="sheet-grabber" aria-hidden="true" />
      <header className="map-filter-head">
        <h2 className="panel-title">Map filters</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close map filters"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      <div className="sidebar-content">
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
        {MAP_INDEX_GROUPS.map((group) => groupSection(group))}
        {CATEGORY_GROUPS.filter(
          (group) =>
            group.id === 'my-markers' ||
            group.id === 'unverified' ||
            group.id === 'collectibles',
        ).map((group) => groupSection(group))}
        <NarrowFilters />
      </div>
    </aside>
  );
}
