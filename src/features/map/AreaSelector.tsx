/**
 * Area selector (DESIGN §6.3, step 4) — the permanent compact area
 * selector on the map.
 *
 * Current-area breadcrumb, state first: Leonida › Vice-Dale › Vice
 * City › Downtown. One tap on any crumb returns to that parent; one
 * tap on the search button opens the area search (geo mode). The
 * selector never touches gameplay layers and never reveals a
 * gameplay record — it only moves the area context.
 */
import { Search } from 'lucide-react';
import { breadcrumbChain, type AreaNode } from '../../domain/geography';

export function AreaBreadcrumb({
  nodes,
  selectedAreaId,
  onSelectArea,
}: {
  nodes: ReadonlyMap<string, AreaNode>;
  selectedAreaId: string | null;
  onSelectArea: (areaId: string | null) => void;
}) {
  const chain = selectedAreaId
    ? breadcrumbChain(nodes, selectedAreaId)
    : (() => {
        const state = nodes.get('state:leonida');
        return state ? [state] : [];
      })();
  if (chain.length === 0) return null;
  return (
    <nav className="area-breadcrumb" aria-label="Current area">
      {chain.map((crumb, index) => {
        const isLast = index === chain.length - 1;
        const isState = crumb.id === 'state:leonida';
        return (
          <span key={crumb.id} className="area-crumb-wrap">
            {index > 0 && (
              <span className="area-crumb-sep" aria-hidden="true">
                ›
              </span>
            )}
            {isLast ? (
              <span className="area-crumb is-current" aria-current="location">
                {crumb.name}
              </span>
            ) : (
              <button
                type="button"
                className="area-crumb"
                onClick={() => onSelectArea(isState ? null : crumb.id)}
                aria-label={`Go to ${crumb.name}`}
              >
                {crumb.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function AreaSelector({
  nodes,
  selectedAreaId,
  onSelectArea,
  onOpenGeoSearch,
}: {
  nodes: ReadonlyMap<string, AreaNode>;
  selectedAreaId: string | null;
  onSelectArea: (areaId: string | null) => void;
  onOpenGeoSearch: () => void;
}) {
  return (
    <div className="area-selector" role="group" aria-label="Area selector">
      <AreaBreadcrumb
        nodes={nodes}
        selectedAreaId={selectedAreaId}
        onSelectArea={onSelectArea}
      />
      <button
        type="button"
        className="area-search-button"
        onClick={onOpenGeoSearch}
        aria-label="Search for an area in Leonida"
        title="Search areas"
      >
        <Search size={16} />
        <span>Area</span>
      </button>
    </div>
  );
}
