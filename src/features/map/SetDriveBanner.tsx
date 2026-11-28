/**
 * The set-drive header (v0.33 Lane C, D-3 + D-5): the banner + pill
 * row that sits below the hero while a set is being driven.
 *
 * Two surfaces, one count (D-5): the banner's count line and the
 * compact pill BOTH render `setFoundLabel` — the shared selector —
 * so they can never disagree with each other, the pin dialog
 * footer, the journal row or the album cover. The pinned count is
 * the separate number, always labelled "pinned".
 *
 * - Banner: set name, x/y found, "N pinned of M", the per-county
 *   breakdown (PINNED cards by county), a Hide found switch (found
 *   pins vanish from the map while on; the header count does not
 *   change — it counts found, not shown), and "Show all" to exit
 *   back to the previous layer state.
 * - Pill: the compact count chip at the row's right end (gtatown's
 *   top-right scope pill, same string).
 */
import { Gem } from 'lucide-react';
import { setFoundLabel, type GameDatabase } from '../../domain/game-db';
import { setPinnedByCounty, setPinnedCount } from './set-drive';
import type { Place } from '../../domain/types';

export function SetDriveBanner({
  db,
  places,
  setId,
  hideFound,
  onToggleHideFound,
  onExit,
}: {
  db: GameDatabase;
  places: readonly Place[];
  setId: string;
  hideFound: boolean;
  onToggleHideFound: () => void;
  /** Exit the drive — back to the previous layer state. */
  onExit: () => void;
}) {
  const set = db.sets.get(setId);
  if (!set) return null;
  const foundLabel = setFoundLabel(db, setId);
  const { pinned, total } = setPinnedCount(db, setId);
  const counties = setPinnedByCounty(db, places, setId);
  return (
    <div className="set-drive-bar" role="status" aria-label={`Driving ${set.name}`}>
      <div className="set-drive-banner">
        <div className="set-drive-main">
          <strong className="set-drive-name">{set.name}</strong>
          <span className="set-drive-count">{foundLabel}</span>
          <span className="set-drive-pinned">
            {pinned} pinned of {total}
          </span>
          <button
            type="button"
            className="set-drive-exit"
            onClick={onExit}
            aria-label={`Show all layers — leave the ${set.name} drive`}
          >
            Show all
          </button>
        </div>
        <div className="set-drive-sub">
          <span className="set-drive-counties">
            {counties.length > 0
              ? counties.map((county) => `${county.countyName} ${county.count}`).join(' · ')
              : 'No pinned cards yet'}
          </span>
          <label className="set-drive-hide-found">
            <input
              type="checkbox"
              checked={hideFound}
              onChange={onToggleHideFound}
              aria-label="Hide found pins while driving this set"
            />
            Hide found
          </label>
        </div>
      </div>
      <div className="set-drive-pill">
        <Gem size={14} aria-hidden="true" />
        <span>{foundLabel}</span>
      </div>
    </div>
  );
}
