/**
 * Area page (DESIGN §6.3, step 4) — a map-overlay surface for one area.
 *
 * Parent crumb at every level, child areas, member locations. The
 * extent is an estimate, labelled as such; when the area has no
 * positioned places the honest empty state shows instead of a
 * camera move: "No positioned places here yet — N named places, all
 * unpositioned". "Show all of Leonida" exits back to the whole map.
 * A member tap opens that place (the existing reveal-one behaviour);
 * a child-area tap isolates that child.
 */
import { useMemo } from 'react';
import { X } from 'lucide-react';
import {
  areaNoExtentMessage,
  breadcrumbChain,
  COUNTY_DISPUTED_LABEL,
  directLocationIds,
  type AreaNode,
} from '../../domain/geography';
import type { GameDatabase } from '../../domain/game-db';
import { AreaBreadcrumb } from './AreaSelector';

export function AreaPage({
  node,
  nodes,
  db,
  onSelectArea,
  onSelectPlace,
  onClose,
}: {
  node: AreaNode;
  nodes: ReadonlyMap<string, AreaNode>;
  db: GameDatabase;
  onSelectArea: (areaId: string | null) => void;
  onSelectPlace: (placeId: string) => void;
  onClose: () => void;
}) {
  const children = useMemo(
    () =>
      node.childrenIds
        .map((id) => nodes.get(id))
        .filter((child): child is AreaNode => child !== undefined),
    [node, nodes],
  );
  const directMembers = useMemo(
    () => directLocationIds(nodes, node.id),
    [nodes, node.id],
  );
  const namedCount = useMemo(() => {
    let count = 0;
    for (const memberId of node.locationIds) {
      if (db.locations.get(memberId)?.name) count += 1;
    }
    return count;
  }, [node, db]);
  const chain = breadcrumbChain(nodes, node.id);
  const parent = chain.length >= 2 ? chain[chain.length - 2]! : null;
  return (
    <section className="area-page" aria-label={`Area: ${node.name}`}>
      <header className="area-page-head">
        <AreaBreadcrumb
          nodes={nodes}
          selectedAreaId={node.id}
          onSelectArea={onSelectArea}
        />
        <button
          type="button"
          className="icon-button"
          aria-label="Close area page — show all of Leonida"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </header>
      <h2>{node.name}</h2>
      <p className="area-page-sub">
        {node.level === 'county' || node.level === 'state'
          ? node.path
          : `${node.path} · ${node.level}`}
        {parent && parent.id !== 'state:leonida'
          ? ` · in ${parent.name}`
          : ''}
      </p>
      {node.countyDisputed && (
        <p className="area-page-dispute" role="status">
          {COUNTY_DISPUTED_LABEL} —{' '}
          {node.countyDisputed.claims
            .map((claim) => {
              const county = nodes.get(`county:${claim.countyId}`);
              const countyName = (county?.name ?? claim.countyId).replace(
                ' County',
                '',
              );
              return `${claim.source} says ${countyName}`;
            })
            .join('; ')}
          .{' '}
          {node.countyDisputed.claims.map((claim) => {
            const county = nodes.get(`county:${claim.countyId}`);
            return county ? (
              <button
                key={claim.countyId}
                type="button"
                className="text-button"
                onClick={() => onSelectArea(county.id)}
              >
                {county.name}
              </button>
            ) : null;
          })}
        </p>
      )}
      <p className="area-page-extent">{node.extentNote}</p>
      {!node.bounds && (
        <p className="area-page-empty" role="status">
          {areaNoExtentMessage(namedCount)}
        </p>
      )}
      {children.length > 0 && (
        <div className="area-page-children">
          <h3>Areas in {node.name}</h3>
          <ul>
            {children.map((child) => (
              <li key={child.id}>
                <button type="button" onClick={() => onSelectArea(child.id)}>
                  <strong>{child.name}</strong>
                  <small>
                    {child.locationIds.length.toLocaleString()} place
                    {child.locationIds.length === 1 ? '' : 's'}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {directMembers.length > 0 && (
        <div className="area-page-members">
          <h3>
            Places in {node.name} ({directMembers.length.toLocaleString()})
          </h3>
          <ul>
            {directMembers.map((memberId) => {
              const location = db.locations.get(memberId);
              const name = location?.name ?? 'Unnamed place';
              return (
                <li key={memberId}>
                  <button type="button" onClick={() => onSelectPlace(memberId)}>
                    <strong>{name}</strong>
                    {!location?.position && <small>No map position yet</small>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button type="button" className="button area-page-all" onClick={onClose}>
        Show all of Leonida
      </button>
    </section>
  );
}
