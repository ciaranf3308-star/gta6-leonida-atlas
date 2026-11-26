import { PlaceIcon, type IconKey } from '../features/map/place-icons';
import { useUiStore, type NavTab } from '../stores/atlas';

/**
 * Bottom navigation — the one way around the app. Four labelled tabs
 * for the four real jobs (v0.32 step 5): Map, Collections, Progress,
 * Ask. Every tab is a big labelled target (never icon-only) — the
 * buttons are at least 48px tall (see --nav-height in atlas.css) —
 * and the active tab is obvious. Find is a search overlay on the Map
 * tab and the map filter is a contextual sheet over the map; neither
 * is a nav tab, and "Layers" is not a tab at all any more.
 * The icons are the atlas's own blip set (PlaceIcon) — the same glyphs
 * as the map pins — not a second, generic icon style.
 */

export const NAV_TABS: { id: NavTab; label: string; icon: IconKey }[] = [
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'collections', label: 'Collections', icon: 'star' },
  { id: 'progress', label: 'Progress', icon: 'trophy' },
  { id: 'ask', label: 'Ask', icon: 'sparkles' },
];

export default function BottomNav({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const navTab = useUiStore((s) => s.navTab);
  return (
    <nav className="bottom-nav" aria-label="Atlas sections">
      {NAV_TABS.map((tab) => {
        const active = navTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            className={active ? 'active' : ''}
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(tab.id)}
          >
            <span className="bottom-nav-icon">
              <PlaceIcon icon={tab.icon} size={22} />
            </span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
