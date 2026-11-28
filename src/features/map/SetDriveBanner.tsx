import { Gem } from 'lucide-react';
import { setFoundLabel, type GameDatabase } from '../../domain/game-db';
import {
  setPinnedByCounty,
  setPinnedCount,
} from './set-drive';
import type { Place } from '../../domain/types';

/**
 * Set drive mode (v0.33 Lane C, items 2 + 8 — D-3 + D-5): the drive
 * header + the top pill, one component so the two can never
 * disagree about the count.
 *
 * The banner is the SET HEADER surface (D-5): the set's name, the
 * shared "x / y found" string (in the pill — the bar's single
 * count surface), the PINNED count (a separate number, always
 * labelled "pinned"), the per-county breakdown counting PINNED
 * cards by county, the "Hide found" switch, and the "Show all"
 * exit. The pill is the second surface: the same "x / y found"
 * string, nothing else.
 *
 * The title is the set name ONLY — it used to carry the count
 * too, but the top row is 280px on a phone and name + count +
 * pill need ~310px, so the count truncated to "0 …" beside a
 * pill showing the same string. The pill is the header's count;
 * the title keeps the name whole.
 *
 * The bar is deliberately COMPACT (two rows on a phone, ~110px):
 * it sits below the hero and its bottom edge sets the pin clamp's
 * top band (chrome-geometry: topBand = driveBar.bottom + 12). At
 * the island fit the set's northernmost pins sit ~20px below that
 * band — the earlier five-row bar (207px) hid the Kelly trio
 * outright (their 48px boxes fell under the band) and parked every
 * focused pin behind the bar. A taller bar is not a cosmetic
 * choice: it eats pins.
 */
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
  onExit: () => void;
}) {
  const set = db.sets.get(setId);
  if (!set) return null;
  const foundLabel = setFoundLabel(db, setId);
  const { pinned, total } = setPinnedCount(db, setId);
  const byCounty = setPinnedByCounty(db, places, setId);
  return (
    <div className="set-drive-bar" role="status">
      <div className="set-drive-top">
        <span className="set-drive-title">
          <strong>{set.name}</strong>
        </span>
        <div className="set-drive-pill">
          <Gem size={14} aria-hidden="true" />
          <span>{foundLabel}</span>
        </div>
      </div>
      <div className="set-drive-meta">
        <span className="set-drive-pinned">
          {pinned} pinned of {total}
        </span>
        {byCounty.length > 0 && (
          <span className="set-drive-counties">
            {byCounty
              .map((entry) => `${entry.countyName} ${entry.count}`)
              .join(' · ')}
          </span>
        )}
        <span className="set-drive-controls">
          <label className="set-drive-hide-found">
            <input
              type="checkbox"
              checked={hideFound}
              onChange={onToggleHideFound}
            />
            Hide found
          </label>
          <button
            type="button"
            className="set-drive-exit"
            onClick={onExit}
            aria-label={`Show all layers — exit the ${set.name} drive`}
          >
            Show all
          </button>
        </span>
      </div>
    </div>
  );
}
