import { PlaceIcon, type IconKey } from '../features/map/place-icons';
import { useMapStore, useUiStore, type NavTab } from '../stores/atlas';

/**
 * Bottom navigation — the one way around the app. Five labelled tabs for
 * the five real jobs: Map, Find, Layers, Saved, Ask. Every tab is a big
 * labelled target (never icon-only), the active tab is obvious, and the
 * Layers tab carries a badge with how many layers are on right now.
 * There are no other menus: no top-bar buttons, no hidden sidebar.
 * The icons are the atlas's own blip set (PlaceIcon) — the same glyphs
 * as the map pins — not a second, generic icon style.
 */

const TABS: { id: NavTab; label: string; icon: IconKey }[] = [
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'explore', label: 'Find', icon: 'search' },
  { id: 'layers', label: 'Layers', icon: 'layers' },
  { id: 'saved', label: 'Saved', icon: 'star' },
  { id: 'ask', label: 'Ask', icon: 'sparkles' },
];

export default function BottomNav({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  const navTab = useUiStore((s) => s.navTab);
  const layers = useMapStore((s) => s.layers);
  const layersOn = layers.filter((l) => l.visible && l.id !== 'my-markers').length;
  return (
    <nav className="bottom-nav" aria-label="Atlas sections">
      {TABS.map((tab) => {
        const active = navTab === tab.id;
        const badge = tab.id === 'layers' && layersOn > 0 ? layersOn : null;
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
              {badge !== null && (
                <span className="bottom-nav-badge" aria-label={`${badge} layers on`}>
                  {badge}
                </span>
              )}
            </span>
            <span className="bottom-nav-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
