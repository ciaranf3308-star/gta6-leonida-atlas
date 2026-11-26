/**
 * The card album (DESIGN-ADDENDUM §3.2) — the Collections view over
 * the SAME CollectibleItem records and the SAME completion log as the
 * journal. A set cover, then its 480 checklist slots as cards in set
 * order. Nothing here writes a second log: the checkbox calls
 * recordCompletion / undoCompletion, the sale buttons call
 * recordSale / undoSale, and the rebuilt database is adopted through
 * the completion-log store, so the journal, the map pin and Progress
 * move in the same write.
 *
 * Hard lines (§3.3), as rendered:
 * - Uncollected cards show name + variant + silhouette only — NEVER
 *   artwork, never printed text, never a flip. The silhouette is a
 *   generic set-coloured card back (CSS only).
 * - No fake card faces, ever. A collected card's face is the player's
 *   own photo of that card (when they attached one), or the honest
 *   empty slot ("No licensed artwork yet"). AI illustration may
 *   decorate a set cover — this lane ships plain covers, no generated
 *   art anywhere — never a card front.
 * - Rarity effects (CSS frame + sheen) apply ONLY to collected cards.
 * - Sold is a second flag, never conflated with collected: a sold
 *   card keeps its checkbox checked and shows a "Sold" ribbon; the
 *   set still counts it and Progress never moves.
 */
import { useEffect, useState } from 'react';
import './album.css';
import {
  setProgress,
  type CollectibleItem,
  type GameDatabase,
} from '../../domain/game-db';
import { collectedRecordFor } from '../completion/place-ids';
import { recordCompletion, recordSale, undoCompletion, undoSale } from '../completion/record';
import { useCompletionLogStore } from '../completion/log-store';
import { atlasRepository } from '../../db/repository';
import {
  ALBUM_FILTERS,
  albumArtwork,
  albumCounts,
  albumSlots,
  isSetComplete,
  rarityFrameClass,
  slotMatchesFilter,
  soldIdsFromStates,
  type AlbumFilter,
} from './album';
import type { ScreenshotKind } from './screenshot-match';

export interface AlbumScreenshotPreset {
  setId?: string;
  itemId?: string;
  kind?: ScreenshotKind;
}

function formatFoundDate(at: string): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function AlbumCard({
  item,
  db,
  sold,
  photoUrl,
  busy,
  onToggle,
  onSaleChange,
  onAddPhoto,
  onSelectPlace,
}: {
  item: CollectibleItem;
  db: GameDatabase;
  sold: boolean;
  photoUrl: string | null;
  busy: boolean;
  onToggle: (item: CollectibleItem) => void;
  onSaleChange: () => void;
  onAddPhoto: (item: CollectibleItem) => void;
  onSelectPlace?: (locationId: string) => void;
}) {
  const found = db.completedItemIds.has(item.id);
  const [flipped, setFlipped] = useState(false);
  const [price, setPrice] = useState('');
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleError, setSaleError] = useState('');
  const artwork = albumArtwork(item, found, photoUrl);
  const record = found ? collectedRecordFor(db, item.id) : undefined;
  const hostName = item.locationId
    ? (db.locations.get(item.locationId)?.name ?? null)
    : null;

  async function toggleSale() {
    if (saleBusy) return;
    setSaleBusy(true);
    setSaleError('');
    const priceNumber = price.trim() === '' ? undefined : Number(price.trim());
    if (priceNumber !== undefined && (!Number.isFinite(priceNumber) || priceNumber < 0)) {
      setSaleBusy(false);
      setSaleError('A sale price must be a number of 0 or more.');
      return;
    }
    const result = sold
      ? await undoSale(item.id)
      : await recordSale({ itemId: item.id, ...(priceNumber !== undefined ? { price: priceNumber } : {}) });
    setSaleBusy(false);
    if (!result.ok) {
      setSaleError(result.error ?? 'Could not save that sale — try again.');
      return;
    }
    setPrice('');
    onSaleChange();
  }

  return (
    <article
      className={`album-card ${found ? `is-found ${rarityFrameClass(item)}` : ''} ${sold ? 'is-sold' : ''}`}
      aria-label={`${item.name}${item.variant ? ` (${item.variant})` : ''}${found ? ' — collected' : ' — not collected yet'}${sold ? ' — sold' : ''}`}
    >
      <div className="album-card-top">
        <label className="album-card-label">
          <input
            type="checkbox"
            checked={found}
            disabled={busy}
            onChange={() => onToggle(item)}
            aria-label={`Mark ${item.name}${item.variant ? ` (${item.variant})` : ''} as collected`}
          />
          <span className="album-card-name">
            {item.name}
            {item.variant ? <small> · {item.variant}</small> : null}
          </span>
        </label>
        {sold && <span className="album-sold-ribbon">Sold</span>}
      </div>
      <div className="album-card-face">
        {artwork.kind === 'silhouette' ? (
          <div className="album-silhouette" aria-hidden="true">
            <span>VICEWIRE</span>
          </div>
        ) : artwork.kind === 'photo' ? (
          <img className="album-photo" src={artwork.url} alt={`Your photo of the ${item.name} card`} />
        ) : (
          <div className="album-art-empty">
            <span>No licensed artwork yet</span>
            <small>Card art is Rockstar / Panini art with no licence to bundle — add your own photo of the card instead.</small>
          </div>
        )}
      </div>
      {found && (
        <div className="album-card-found">
          <span>
            Collected ✓
            {record ? ` · ${formatFoundDate(record.at)}` : ''}
            {hostName ? ` · ${hostName}` : ''}
          </span>
          <div className="album-card-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => setFlipped((current) => !current)}
              aria-expanded={flipped}
            >
              {flipped ? 'Show front' : 'Flip card'}
            </button>
            <button type="button" className="text-button" onClick={() => onAddPhoto(item)}>
              {photoUrl ? 'Replace your photo' : 'Add your photo'}
            </button>
            {item.locationId && onSelectPlace && (
              <button
                type="button"
                className="text-button"
                onClick={() => onSelectPlace(item.locationId!)}
              >
                Show on map
              </button>
            )}
          </div>
          {flipped && (
            <div className="album-card-back">
              {item.printedText ? (
                <p>{item.printedText}</p>
              ) : (
                <p className="album-card-back-empty">No printed card text on file for this card.</p>
              )}
              {item.spotDescription ? (
                <p>
                  <small>Found at: {item.spotDescription}</small>
                </p>
              ) : null}
              <div className="album-sale">
                {sold ? (
                  <>
                    <span>Sold ✓ — the set still counts this card.</span>
                    <button
                      type="button"
                      className="text-button"
                      disabled={saleBusy}
                      onClick={() => void toggleSale()}
                    >
                      Undo sale
                    </button>
                  </>
                ) : (
                  <>
                    <label className="album-sale-price">
                      Sale price (optional)
                      <input
                        type="number"
                        min="0"
                        inputMode="decimal"
                        value={price}
                        disabled={saleBusy}
                        onChange={(event) => setPrice(event.target.value)}
                        aria-label={`Sale price for ${item.name}`}
                        placeholder="0"
                      />
                    </label>
                    <button
                      type="button"
                      className="text-button"
                      disabled={saleBusy}
                      onClick={() => void toggleSale()}
                    >
                      Mark as sold
                    </button>
                  </>
                )}
                {saleError && (
                  <span className="completion-error" role="alert">
                    {saleError}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function Album({
  db,
  onSelectPlace,
  onAddFromScreenshot,
  photosRefresh = 0,
  initialFilter = 'all',
  initialOpenSetId,
}: {
  db: GameDatabase | null;
  onSelectPlace?: (locationId: string) => void;
  onAddFromScreenshot?: (preset: AlbumScreenshotPreset) => void;
  /** Bump after a screenshot is attached so card photos reload. */
  photosRefresh?: number;
  initialFilter?: AlbumFilter;
  initialOpenSetId?: string;
}) {
  const [filter, setFilter] = useState<AlbumFilter>(initialFilter);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [soldIds, setSoldIds] = useState<ReadonlySet<string>>(new Set());
  const [photos, setPhotos] = useState<ReadonlyMap<string, string>>(new Map());
  const [openSetId, setOpenSetId] = useState<string | null>(initialOpenSetId ?? null);

  async function loadSoldAndPhotos() {
    try {
      const states = await atlasRepository.loadPersonalItemStates();
      setSoldIds(soldIdsFromStates(states));
    } catch {
      // Sold state is display-only; the album works without it.
    }
    try {
      const screenshots = await atlasRepository.loadUserScreenshots();
      const linked = screenshots.filter((shot) => shot.itemId && shot.kind === 'card-front');
      const next = new Map<string, string>();
      for (const shot of linked) {
        const data = await atlasRepository.getScreenshotData(shot.id);
        if (data && shot.itemId) next.set(shot.itemId, data.dataUrl);
      }
      setPhotos(next);
    } catch {
      // Photos are the player's own attachments; the album works without them.
    }
  }

  useEffect(() => {
    void loadSoldAndPhotos();
  }, [photosRefresh]);

  async function toggle(item: CollectibleItem) {
    if (!db || busyId) return;
    setBusyId(item.id);
    setError('');
    const found = db.completedItemIds.has(item.id);
    if (found) {
      const record = collectedRecordFor(db, item.id);
      if (!record) {
        setBusyId(null);
        setError(`Could not unmark "${item.name}" — its record is missing. Nothing was changed.`);
        return;
      }
      const result = await undoCompletion(record.id);
      setBusyId(null);
      if (result.ok && result.db) useCompletionLogStore.getState().applyDb(result.db);
      else setError(result.error ?? 'Could not save that — try again.');
      return;
    }
    const result = await recordCompletion({
      target: { type: 'item', id: item.id },
      verb: 'collected',
    });
    setBusyId(null);
    if (result.ok && result.db) useCompletionLogStore.getState().applyDb(result.db);
    else setError(result.error ?? 'Could not save that — try again.');
  }

  if (!db) {
    return (
      <section className="album" aria-label="Card album">
        <h3>Card album</h3>
        <p className="empty-state">Collections load with the map…</p>
      </section>
    );
  }

  const counts = albumCounts(db, soldIds);
  const sets = [...db.sets.values()];

  return (
    <section className="album" aria-label="Card album">
      <h3>Card album</h3>
      <p className="panel-intro">
        All 480 cards, as an album — {counts.found} found
        {counts.sold > 0 ? `, ${counts.sold} sold` : ''}. Uncollected cards show their name and
        a silhouette only: the artwork is the reveal, earned by finding the card. No card face
        here is generated — it is your own photo, or the honest empty slot until licensed art
        exists.
      </p>
      <div className="journal-filters" role="group" aria-label="Filter album cards">
        {ALBUM_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`journal-filter ${filter === option.id ? 'is-active' : ''}`}
            aria-pressed={filter === option.id}
            onClick={() => setFilter(option.id)}
          >
            {option.label} · {counts[option.id]}
          </button>
        ))}
      </div>
      {sets.map((set) => {
        const progress = setProgress(db, set.id);
        const complete = isSetComplete(db, set.id);
        const slots = albumSlots(db, set.id);
        const visible = slots.filter((item) =>
          slotMatchesFilter(item, db.completedItemIds.has(item.id), soldIds.has(item.id), filter),
        );
        const remainingNames = progress.remaining.map((item) => item.name);
        const extras = [...db.items.values()]
          .filter((item) => item.setId === set.id && !item.checklistSlot)
          .filter((item) =>
            slotMatchesFilter(item, db.completedItemIds.has(item.id), soldIds.has(item.id), filter),
          );
        const open = openSetId === set.id;
        return (
          <details
            className="layer-group album-set"
            key={set.id}
            open={open || undefined}
            onToggle={(event) => {
              const details = event.currentTarget;
              if (details.open) setOpenSetId(set.id);
              else if (openSetId === set.id) setOpenSetId(null);
            }}
          >
            <summary>
              <span className="album-cover">
                <span className="album-cover-name">{set.name}</span>
                <span className="album-cover-count">
                  {progress.found} / {progress.total} found
                  {complete ? ' · Complete ✓' : ''}
                  {set.sizeDisputed
                    ? ` · size disputed ${set.sizeDisputed.low} vs ${set.sizeDisputed.high}`
                    : ''}
                </span>
                {!complete && remainingNames.length > 0 && (
                  <span className="album-cover-remaining">
                    Still to find: {remainingNames.slice(0, 5).join(', ')}
                    {remainingNames.length > 5 ? `, and ${remainingNames.length - 5} more` : ''}
                  </span>
                )}
              </span>
            </summary>
            <div className="album-set-actions">
              {onAddFromScreenshot && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onAddFromScreenshot({ setId: set.id, kind: 'collection-screen' })}
                >
                  Add from screenshot
                </button>
              )}
              {visible.length > 0 && (
                <span className="album-set-hint">
                  Tap a collected card to flip it. Uncollected cards stay concealed.
                </span>
              )}
            </div>
            {visible.length === 0 && extras.length === 0 ? (
              <p className="empty-state">Nothing in this set matches this filter.</p>
            ) : (
              <div className="album-grid">
                {visible.map((item) => (
                  <AlbumCard
                    key={item.id}
                    item={item}
                    db={db}
                    sold={soldIds.has(item.id)}
                    photoUrl={photos.get(item.id) ?? null}
                    busy={busyId === item.id}
                    onToggle={(rowItem) => void toggle(rowItem)}
                    onSaleChange={() => void loadSoldAndPhotos()}
                    onAddPhoto={(rowItem) =>
                      onAddFromScreenshot?.({ setId: set.id, itemId: rowItem.id, kind: 'card-front' })
                    }
                    onSelectPlace={onSelectPlace}
                  />
                ))}
              </div>
            )}
            {extras.length > 0 && (
              <details className="journal-extras">
                <summary>
                  Also in the game files ({extras.length}) — not checklist slots, never counted
                </summary>
                <ul className="journal-items">
                  {extras.map((item) => {
                    const found = db.completedItemIds.has(item.id);
                    return (
                      <li className={`journal-row ${found ? 'is-found' : ''}`} key={item.id}>
                        <span className="journal-silhouette" aria-hidden="true">
                          {found ? '✓' : ''}
                        </span>
                        <span className="journal-row-main">
                          <label className="journal-row-label">
                            <input
                              type="checkbox"
                              checked={found}
                              disabled={busyId === item.id}
                              onChange={() => void toggle(item)}
                              aria-label={`Mark ${item.name} as collected`}
                            />
                            <span className="journal-row-name">
                              {item.name}
                              {item.variant ? <small> · {item.variant}</small> : null}
                            </span>
                          </label>
                          {found && <small className="journal-row-found">Collected ✓</small>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </details>
        );
      })}
      {error && (
        <p className="completion-error" role="alert">
          {error}{' '}
          <button type="button" className="completion-error-dismiss" onClick={() => setError('')}>
            Dismiss
          </button>
        </p>
      )}
    </section>
  );
}
