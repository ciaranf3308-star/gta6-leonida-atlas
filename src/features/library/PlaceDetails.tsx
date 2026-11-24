import { useEffect, useRef, useState } from 'react';
import { Bookmark, Check, Dumbbell, ExternalLink, Home, MapPin, Move, Pencil, Sparkles, Star, X } from 'lucide-react';
import type { Place, Position } from '../../domain/types';
import { isUnnamedPlace } from '../../domain/types';
import {
  displayTagsFor,
  placeStatusLine,
  placeTypeLine,
} from '../../domain/tags';
import { DARK_BLUE_RULE, interiorInfoFor } from '../../domain/interiors';
import { tagResolutionFor } from '../../domain/resolve-tags';
import {
  AI_CATEGORIES,
  AI_CATEGORY_LABELS,
  aiCategoryDisplay,
  effectiveAiCategory,
  realWorldAnalogueFromDescription,
  type AiCategoryId,
} from '../categorise/categories';
import { PlaceIcon, iconKeyForAiRecord, iconKeyForPlace } from '../map/place-icons';
import { DEFAULT_LAYERS } from '../map/layers';
import { useAiIndexStore } from '../categorise/store';
import { atlasRepository, ConflictError } from '../../db/repository';
import {
  saveLocal,
  useMapStore,
  usePersistenceStore,
  useUiStore,
  useUserStore,
} from '../../stores/atlas';
import { finishNoteSave, reconcileNoteDraft, type NoteDraft } from './note-draft';
import { getResearchForPlace } from '../street-leonida/leonida-research';
import RegionalResearch from './RegionalResearch';

export default function PlaceDetails({
  place,
  onAddMarkerHere,
  onMarkWorkout,
  onMarkBreakable,
}: {
  place: Place;
  /** Start a My marker at this place's position (for "?" places the user identifies). */
  onAddMarkerHere?: (position: Position) => void;
  /** Start a workout-equipment marker at this place's position — the
   * equipment is in a garage in a house, and only the user knows which
   * house, so marking it here is how it becomes a real pin. */
  onMarkWorkout?: (place: Place) => void;
  /** Start a breakable-home marker at this place's position — the user
   * found a house / apartment / trailer he can break into, and most
   * breakable homes have no tag in the public data at all. */
  onMarkBreakable?: (place: Place) => void;
}) {
  const favorite = useUserStore((s) => s.favorites.some((f) => f.placeId === place.id));
  const found = useUserStore((s) => s.visited.some((v) => v.placeId === place.id));
  const savedNote = useUserStore((s) => s.notes.find((n) => n.placeId === place.id)?.text ?? '');
  const savedRevision = useUserStore(
    (s) => s.notes.find((n) => n.placeId === place.id)?.updatedAt ?? null,
  );
  const collections = useUserStore((s) => s.collections);
  const ready = usePersistenceStore((s) => s.ready);
  const [draft, setDraft] = useState<NoteDraft>({
    text: savedNote,
    revision: savedRevision,
    dirty: false,
    conflict: false,
  });
  const [noteSaved, setNoteSaved] = useState(false);
  const saving = useRef(false);
  const [noteBusy, setNoteBusy] = useState(false);
  useEffect(() => {
    if (!saving.current)
      setDraft((current) => reconcileNoteDraft(current, savedNote, savedRevision));
  }, [savedNote, savedRevision]);
  const [copied, setCopied] = useState(false);
  const isPersonal = place.evidence === 'personal';
  const research = getResearchForPlace(place);
  // AI-suggested type for this place (on-device only). Never a verified
  // fact — the sheet says so, with the confidence, and one tap confirms
  // it or picks the right type instead.
  const aiRecord = useAiIndexStore((s) => s.categories[place.id]);
  const aiDisplay = aiCategoryDisplay(aiRecord);
  const aiCategory = effectiveAiCategory(aiRecord);
  // The description's real-world analogue address is a Miami-area building
  // of the same kind — useful evidence, not the Leonida place. Lift it out
  // of the paragraph so the description stops reading as a wall of text.
  const analogue = realWorldAnalogueFromDescription(place.description);
  const description = analogue
    ? place.description
        .trim()
        .replace(/Real-world reference \(analogue only\): .+$/, '')
        .trim()
    : place.description;
  const layerColor =
    DEFAULT_LAYERS.find((l) => l.id === place.layerId)?.style.color ?? '#e8823a';
  // Interior status, in plain words at the top of the sheet: enterable /
  // unknown (never a false no), what kind of venue, what you do inside,
  // and whether it is a breakable house. A house with no enterable tag
  // is "check the in-game map", not "closed".
  const interior = interiorInfoFor(place);
  // What the map data's tags say this "?" is — a resolved type from the
  // tags, never a name. The name stays "?" until a source names it.
  const tagResolution = tagResolutionFor(place);
  const [correcting, setCorrecting] = useState(false);
  const [correctChoice, setCorrectChoice] = useState<AiCategoryId>('house');
  const [correctShopType, setCorrectShopType] = useState('');
  async function saveNote() {
    if (saving.current || !draft.dirty || draft.conflict) return;
    saving.current = true;
    setNoteBusy(true);
    const captured = draft;
    let conflict = false;
    const ok = await saveLocal(async () => {
      try {
        await atlasRepository.saveNote(place.id, captured.text, captured.revision);
      } catch (error) {
        conflict = error instanceof ConflictError;
        throw error;
      }
    });
    saving.current = false;
    setNoteBusy(false);
    if (ok) {
      const persisted = useUserStore.getState().notes.find((n) => n.placeId === place.id);
      setDraft((current) =>
        finishNoteSave(current, captured, {
          text: persisted?.text ?? '',
          revision: persisted?.updatedAt ?? null,
        }),
      );
      setNoteSaved((persisted?.text ?? '') === (captured.text.trim() ? captured.text : ''));
    } else if (conflict) setDraft((current) => ({ ...current, conflict: true }));
  }
  async function addToCollection(id: string) {
    const collection = collections.find((c) => c.id === id);
    if (!collection) return;
    await saveLocal(() => atlasRepository.addCollectionPlace(collection.id, place.id));
  }
  async function share() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.searchParams.set('place', place.id);
    try {
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <aside className="detail-panel" aria-label="Place details">
      <header className="panel-heading">
        <span className="eyebrow">{isPersonal ? 'MY MARKER' : 'PLACE DETAILS'}</span>
        <button
          className="icon-button"
          aria-label="Close place details"
          onClick={() => useMapStore.getState().select(null)}
        >
          <X size={20} />
        </button>
      </header>
      <div className="detail-scroll">
        <div className="place-title">
          <span className="place-title-icon" style={{ background: layerColor }} aria-hidden="true">
            <PlaceIcon
              icon={iconKeyForAiRecord(aiRecord) ?? iconKeyForPlace(place)}
              size={22}
            />
          </span>
          <h2>{place.title}</h2>
        </div>
        <p className="evidence-label">
          {isPersonal
            ? 'My marker · saved on this device'
            : !place.position
              ? 'No mapped position'
              : place.evidence === 'uncertain'
                ? 'Unverified place · position not confirmed'
                : 'Community placement · approximate'}
        </p>
        {aiDisplay && aiCategory && (
          <p className="ai-chip" role="status">
            <Sparkles size={13} /> AI suggested: {aiDisplay.label} ·{' '}
            {Math.round(aiDisplay.confidence * 100)}% sure
          </p>
        )}
        {aiRecord && aiRecord.status === 'unsure' && (
          <p className="ai-chip is-unsure" role="status">
            <Sparkles size={13} /> The AI was not sure what this is yet — it stays
            uncategorised.
          </p>
        )}
        <section className="detail-section" aria-label="Interior">
          <h3>Inside</h3>
          <p className="help-text">
            <strong>{interior.label}.</strong>
            {interior.activity ? ` ${interior.activity}` : ''}
          </p>
          {interior.status === 'unknown' &&
            (interior.venueType === 'house' ||
              interior.venueType === 'apartment' ||
              interior.venueType === 'trailer' ||
              interior.possibleBreakable) && (
              <p className="help-text">
                Breakable? {DARK_BLUE_RULE} Most ordinary houses are decoration in
                free roam — the Capri rob houses and story safehouses are the
                exceptions.
              </p>
            )}
          {interior.possibleBreakable && !interior.breakable && (
            <p className="help-text">
              <strong>Possible enterable house — check it.</strong> This house has no
              tags in the data, so it reads as unknown, not closed.
            </p>
          )}
          {place.position && onMarkBreakable && !interior.breakable && (
            <>
              <button
                type="button"
                className="button"
                onClick={() => onMarkBreakable(place)}
              >
                <Home size={16} /> Mark as a breakable home
              </button>
              <p className="help-text">
                Found you can break into this house, apartment or trailer? Mark it
                and it becomes a Breakable home pin on your map, with your loot
                notes (safe, jewellery, special car in the garage).
              </p>
            </>
          )}
        </section>
        {isUnnamedPlace(place) && (
          <section className="detail-section" aria-label="What is known about this place">
            <h3>What we know</h3>
            <p className="help-text">
              No name yet — this place is still “?” in the source data. What the source does
              say:
            </p>
            <dl className="place-meta">
              {place.region && (
                <div>
                  <dt>Area</dt>
                  <dd>{place.region}</dd>
                </div>
              )}
              {tagResolution && (
                <div>
                  <dt>What it is</dt>
                  <dd>
                    {tagResolution.label} — resolved from the map data's tags, not
                    a name. The name is still unknown.
                  </dd>
                </div>
              )}
              <div>
                <dt>You can go inside</dt>
                <dd>
                  {interior.label}
                  {interior.possibleBreakable && !interior.breakable
                    ? ' — possible enterable house, check it'
                    : ''}
                </dd>
              </div>
              {placeTypeLine(place) && (
                <div>
                  <dt>What it is</dt>
                  <dd>{placeTypeLine(place)}</dd>
                </div>
              )}
              {placeStatusLine(place) && (
                <div>
                  <dt>Heads up</dt>
                  <dd>{placeStatusLine(place)}</dd>
                </div>
              )}
            </dl>
            <p className="help-text">
              If you find out what this place is in the game, add your own marker with the
              name — or leave a note below.
            </p>
            {place.position && onAddMarkerHere && (
              <button
                type="button"
                className="button"
                onClick={() => onAddMarkerHere(place.position!)}
              >
                <MapPin size={16} /> Add my own marker here
              </button>
            )}
            {place.position && onMarkWorkout && (
              <button
                type="button"
                className="button primary"
                onClick={() => onMarkWorkout(place)}
              >
                <Dumbbell size={16} /> Workout equipment in the garage — mark it
              </button>
            )}
            {place.position && onMarkWorkout && (
              <p className="help-text">
                Know there is workout equipment here — in a garage in a house?
                Mark it and it becomes a Workout Equipment pin on your map,
                with your note (e.g. bench in garage).
              </p>
            )}
          </section>
        )}
        {aiRecord && (
          <section className="detail-section ai-suggestion" aria-label="AI-suggested type">
            <h3>
              <Sparkles size={15} /> What the AI suggests
            </h3>
            {aiDisplay && aiCategory ? (
              <>
                <p className="help-text">
                  <strong>
                    {aiDisplay.label} — {Math.round(aiDisplay.confidence * 100)}% sure.
                  </strong>{' '}
                  {aiRecord.reason}
                </p>
                <p className="help-text">
                  AI suggested, not a verified fact. The name stays “?” — only the type is
                  suggested, and only from what the map already knows.
                </p>
                {aiRecord.status === 'suggested' && (
                  <button
                    type="button"
                    className="button"
                    onClick={() => useAiIndexStore.getState().confirmCategory(place.id)}
                  >
                    <Check size={16} /> That looks right — confirm
                  </button>
                )}
                {aiRecord.status === 'confirmed' && (
                  <p className="success-message" role="status">
                    You confirmed this is a {aiDisplay.label.toLowerCase()}.
                  </p>
                )}
                {aiRecord.status === 'corrected' && (
                  <p className="success-message" role="status">
                    You corrected this to {aiDisplay.label.toLowerCase()}.
                  </p>
                )}
              </>
            ) : (
              <p className="help-text">
                The AI was not sure what this is yet, so it stays uncategorised rather than
                guessing. If you know what it is, pick the type below.
              </p>
            )}
            {!correcting ? (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCorrectChoice(aiCategory ?? 'house');
                  setCorrecting(true);
                }}
              >
                Not right? Choose the type
              </button>
            ) : (
              <div className="ai-correct">
                <label htmlFor="ai-correct-type">What kind of place is this?</label>
                <select
                  id="ai-correct-type"
                  value={correctChoice}
                  onChange={(e) => setCorrectChoice(e.target.value as AiCategoryId)}
                >
                  {AI_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {AI_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </select>
                {correctChoice === 'shop' && (
                  <>
                    <label htmlFor="ai-correct-shop-type">What kind of shop? (optional)</label>
                    <input
                      id="ai-correct-shop-type"
                      type="text"
                      maxLength={30}
                      placeholder="e.g. supermarket"
                      value={correctShopType}
                      onChange={(e) => setCorrectShopType(e.target.value)}
                    />
                  </>
                )}
                <div className="button-row">
                  <button
                    type="button"
                    className="button primary"
                    onClick={() => {
                      useAiIndexStore
                        .getState()
                        .correctCategory(
                          place.id,
                          correctChoice,
                          correctChoice === 'shop'
                            ? correctShopType.trim() || undefined
                            : undefined,
                        );
                      setCorrecting(false);
                    }}
                  >
                    Save my type
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setCorrecting(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
        <div className="detail-actions">
          <button
            disabled={!ready}
            className={`button ${favorite ? 'selected' : ''}`}
            onClick={() => void saveLocal(() => atlasRepository.toggleFavorite(place.id))}
          >
            <Star size={18} fill={favorite ? 'currentColor' : 'none'} />
            {favorite ? 'Saved to favorites' : 'Add to favorites'}
          </button>
          <button
            disabled={!ready}
            className={`button ${found ? 'selected' : ''}`}
            onClick={() => void saveLocal(() => atlasRepository.toggleVisited(place.id))}
          >
            <Check size={18} />
            {found ? 'Found ✓ — tap to undo' : 'Mark as found'}
          </button>
        </div>
        {description && <p className="description">{description}</p>}
        {analogue && (
          <p className="analogue-note">
            <strong>Real-world reference (analogue only):</strong> {analogue} — a
            Miami-area building of the same kind, not the Leonida place.
          </p>
        )}
        <dl className="place-meta">
          <div>
            <dt>Category</dt>
            <dd>{place.category}</dd>
          </div>
          {place.region && (
            <div>
              <dt>Region</dt>
              <dd>{place.region}</dd>
            </div>
          )}
          {place.position && (
            <div>
              <dt>Game coordinates</dt>
              <dd>
                {place.position.x.toFixed(1)}, {place.position.y.toFixed(1)}
              </dd>
            </div>
          )}
        </dl>
        {place.tags.length > 0 &&
          (displayTagsFor(place).length > 0 ? (
            <p className="detail-tags" aria-label="What this place is">
              {displayTagsFor(place).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </p>
          ) : (
            <p className="tags">{place.tags.join(' · ')}</p>
          ))}
        {place.source.url && (
          <a className="source-link" href={place.source.url} target="_blank" rel="noreferrer">
            {place.source.title}
            <ExternalLink size={13} />
          </a>
        )}
        {research && <RegionalResearch region={research.region.slug} />}
        <section className="detail-section">
          <label htmlFor="place-note">Notes</label>
          <textarea
            id="place-note"
            rows={5}
            maxLength={100000}
            value={draft.text}
            disabled={!ready}
            placeholder="Add notes about this place…"
            onChange={(e) => {
              const text = e.currentTarget.value;
              setDraft((current) => ({ ...current, text, dirty: true }));
              setNoteSaved(false);
            }}
            onBlur={() => {
              if (draft.dirty && ready) void saveNote();
            }}
          />
          <div className="row-between">
            <small>{draft.text.length.toLocaleString()} / 100,000</small>
            <button
              className="text-button"
              disabled={!ready || noteBusy || draft.conflict}
              onClick={() => void saveNote()}
            >
              {noteBusy ? (
                'Saving…'
              ) : noteSaved ? (
                <>
                  <Check size={14} />
                  Saved
                </>
              ) : (
                'Save note'
              )}
            </button>
          </div>
          {draft.conflict && (
            <div className="inline-error" role="alert">
              This note changed elsewhere or could not be saved. Your draft is preserved here. Copy
              it before loading the latest saved note.
              <button
                className="text-button"
                onClick={() => {
                  setDraft({
                    text: savedNote,
                    revision: savedRevision,
                    dirty: false,
                    conflict: false,
                  });
                  setNoteSaved(false);
                }}
              >
                Load saved note
              </button>
            </div>
          )}
        </section>
        <section className="detail-section">
          <label htmlFor="place-collection">Add to collection</label>
          <select
            id="place-collection"
            disabled={!ready || collections.length === 0}
            value=""
            onChange={(e) => void addToCollection(e.target.value)}
          >
            <option value="">
              {collections.length ? 'Select a collection…' : 'Create a collection in Saved'}
            </option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {collections
            .filter((c) => c.placeIds.includes(place.id))
            .map((c) => (
              <div className="membership" key={c.id}>
                <Bookmark size={14} />
                {c.name}
                <button
                  className="icon-button"
                  aria-label={`Remove from ${c.name}`}
                  onClick={() =>
                    void saveLocal(() => atlasRepository.removeCollectionPlace(c.id, place.id))
                  }
                >
                  <X size={14} />
                </button>
              </div>
            ))}
        </section>
        {isPersonal ? (
          <div className="button-row">
            <button
              className="button"
              disabled={!ready}
              onClick={() => useUiStore.getState().setEditorOpen(true)}
            >
              <Pencil size={16} />
              Edit marker
            </button>
            <button
              className="button"
              disabled={!ready}
              onClick={() => {
                useMapStore.getState().setEditor('move');
                useUiStore.getState().setNavTab('map');
              }}
            >
              <Move size={16} />
              Move
            </button>
          </div>
        ) : (
          <button className="text-button" onClick={() => void share()}>
            {copied ? 'Link copied' : 'Copy place link'}
          </button>
        )}
      </div>
    </aside>
  );
}
