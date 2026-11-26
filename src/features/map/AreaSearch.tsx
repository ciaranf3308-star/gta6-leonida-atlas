/**
 * Geographical search panel (DESIGN §6.5a, step 4) — areas only.
 *
 * Typeahead over every area name + curated aliases. Exact first,
 * then prefix, then typo-tolerant. A result tap isolates the area.
 * NO gameplay information is ever in a geo result — name, path and
 * member count only. Clearing this search (×) touches geo only:
 * POI search and layers are never touched.
 *
 * Empty states (exact strings): no match →
 * "No area called that in Leonida — try a county, city or town",
 * plus the five counties as buttons.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { GEO_NO_MATCH, geoNoMatchCounties, searchAreas } from '../../domain/search';
import type { AreaNode } from '../../domain/geography';
import { useSearchSplitStore } from '../../stores/search-split';

export function AreaSearch({
  nodes,
  onSelectArea,
  onClose,
}: {
  nodes: ReadonlyMap<string, AreaNode>;
  onSelectArea: (areaId: string) => void;
  onClose: () => void;
}) {
  const query = useSearchSplitStore((s) => s.geo.query);
  const setGeoQuery = useSearchSplitStore((s) => s.setGeoQuery);
  const clearGeo = useSearchSplitStore((s) => s.clearGeo);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const results = useMemo(() => searchAreas(nodes, query), [nodes, query]);
  const counties = useMemo(() => geoNoMatchCounties(), []);
  const hasQuery = query.trim() !== '';
  return (
    <div
      className="area-search-panel"
      role="dialog"
      aria-label="Search for an area in Leonida"
    >
      <div className="area-search-field">
        <Search size={18} />
        <input
          ref={inputRef}
          type="search"
          maxLength={120}
          placeholder="Search areas — a county, city or town"
          aria-label="Search areas"
          value={query}
          onChange={(e) => setGeoQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />
        {hasQuery && (
          <button
            type="button"
            className="icon-button"
            aria-label="Clear area search"
            onClick={clearGeo}
          >
            <X size={18} />
          </button>
        )}
        <button
          type="button"
          className="icon-button"
          aria-label="Close area search"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {!hasQuery && (
        <div className="area-search-start">
          <p>Start with a county:</p>
          <div className="area-county-buttons">
            {counties.map((county) => (
              <button
                key={county.id}
                type="button"
                onClick={() => onSelectArea(county.id)}
              >
                {county.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {hasQuery && results.length === 0 && (
        <div className="area-search-empty" role="status">
          <p>{GEO_NO_MATCH}</p>
          <div className="area-county-buttons">
            {counties.map((county) => (
              <button
                key={county.id}
                type="button"
                onClick={() => onSelectArea(county.id)}
              >
                {county.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {results.length > 0 && (
        <ul className="area-search-results" aria-label="Matching areas">
          {results.map((result) => (
            <li key={result.areaId}>
              <button type="button" onClick={() => onSelectArea(result.areaId)}>
                <strong>{result.name}</strong>
                <small>
                  {result.path !== result.name ? `${result.path} · ` : ''}
                  {result.memberCount.toLocaleString()} place
                  {result.memberCount === 1 ? '' : 's'}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
