import { useEffect, useMemo, useRef, useState } from 'react';
import { Bookmark, Camera, Check, Dumbbell, ExternalLink, Footprints, Home, MapPin, Move, Navigation, Pencil, Scan, Sparkles, Star, Tag, X } from 'lucide-react';
import type { Place, Position } from '../../domain/types';
import { displayTitleFor, isUnnamedPlace } from '../../domain/types';
import { topCategoriesNear } from '../../domain/nearby-categories';
import { categoryLabel } from '../../app/categories';
import {
  displayTagsFor,
  placeStatusLine,
  placeTypeLine,
} from '../../domain/tags';
import { DARK_BLUE_RULE, interiorInfoFor } from '../../domain/interiors';
import { tagResolutionFor } from '../../domain/resolve-tags';
import { lootFor } from '../../domain/loot';
import { collectablesNear } from '../../domain/nearby-collectables';
import { MAX_TAG_LENGTH, parseUserTags, userTagsFor } from '../../domain/user-tags';
import PlaceMapCrop from './PlaceMapCrop';
import { downscalePhoto } from './place-photo';
import {
  AI_CATEGORIES,
  AI_CATEGORY_LABELS,
  aiCategoryDisplay,
  effectiveAiCategory,
  realWorldAnalogueFromDescription,
  recordSource,
  resolutionSourceLabel,
  resolutionSourceNote,
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
import { getLocalStreetPlaces } from '../street-leonida/page-data';
import type { StreetPlaceCategory } from '../street-leonida/types';
import RegionalResearch from './RegionalResearch';
import { COUNTIES } from '../../data/counties';
import { countyIsolation } from '../map/isolation';

export default function PlaceDetails({
  place,
  allPlaces,
  onAddMarkerHere,
  onMarkWorkout,
  onMarkBreakable,
  firstOpen,
  onClose,
}: {
  place: Place;
  /** Every place, for the "Hidden collectables" row: verified card pins
   * near this place. The card receives only its own place otherwise. */
  allPlaces: readonly Place[];
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
  /** First-open sheet (v0.26.0): "Pick what to see" — the layer
   * buttons that used to live in the empty-map banner, now inside
   * the Vice City sheet, right under the card head. */
  firstOpen?: {
    onPickLayers: (layerIds: string[] | 'all') => void;
    lastSession: { layerIds: string[] } | null;
    onRestore: () => void;
  };
  /** Close without selecting: the first-open sheet is not a
   * selection, so its × cannot call select(null) — that would be a
   * no-op and the sheet would never close. */
  onClose?: () => void;
}) {
  const favorite = useUserStore((s) => s.favorites.some((f) => f.placeId === place.id));
  const found = useUserStore((s) => s.visited.some((v) => v.placeId === place.id));
  const explored = useUserStore((s) => s.explored.some((e) => e.placeId === place.id));
  // Select the raw store array (a stable reference) and derive the
  // place's tags with useMemo. Selecting userTagsFor(...) directly
  // returns a fresh array on every render, and React's external-store
  // check reads that as a change on every pass — an infinite loop
  // (React error #185) that unmounted the whole sheet.
  const placeTags = useUserStore((s) => s.placeTags);
  const userTags = useMemo(() => userTagsFor(place.id, placeTags), [place.id, placeTags]);
  const savedNote = useUserStore((s) => s.notes.find((n) => n.placeId === place.id)?.text ?? '');
  const savedRevision = useUserStore(
    (s) => s.notes.find((n) => n.placeId === place.id)?.updatedAt ?? null,
  );
  const collections = useUserStore((s) => s.collections);
  const ready = usePersistenceStore((s) => s.ready);
  // What can be looted here — verified sources only, "Loot unknown"
  // when nothing is confirmed. Hidden collectables — verified card
  // pins near this place, or "None verified here".
  const loot = useMemo(() => lootFor(place), [place]);
  const nearbyCollectables = useMemo(
    () => collectablesNear(place, allPlaces),
    [place, allPlaces],
  );
  // The user's own photo for this place (his screenshot, on-device
  // only). Loads from IndexedDB when the card opens.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void atlasRepository
      .getPlacePhoto(place.id)
      .then((photo) => {
        if (alive) setPhotoUrl(photo?.dataUrl ?? null);
      })
      .catch(() => {
        if (alive) setPhotoUrl(null);
      });
    return () => {
      alive = false;
    };
  }, [place.id]);
  async function onPhotoFile(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    const dataUrl = await downscalePhoto(file);
    if (!dataUrl) {
      setPhotoBusy(false);
      setPhotoError('That file could not be read as a photo. Try a screenshot from your phone.');
      return;
    }
    const ok = await saveLocal(() => atlasRepository.savePlacePhoto(place.id, dataUrl));
    setPhotoBusy(false);
    if (ok) setPhotoUrl(dataUrl);
    else setPhotoError('The photo could not be saved on this device.');
  }
  async function removePhoto() {
    const ok = await saveLocal(() => atlasRepository.deletePlacePhoto(place.id));
    if (ok) setPhotoUrl(null);
  }
  // The user's own secondary tags ("sells t-shirts", "workout
  // equipment") — free text, saved on-device, shown as "Your tag",
  // never mixed with verified data, never changing the real category.
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  async function addTag() {
    const parsed = parseUserTags(tagInput);
    if (parsed.length === 0) {
      setTagError(
        'A tag needs at least 2 letters — try “sells t-shirts” or “workout equipment”.',
      );
      return;
    }
    setTagError(null);
    setTagInput('');
    await saveLocal(() =>
      atlasRepository.savePlaceTags(place.id, [...userTags, ...parsed]),
    );
  }
  async function removeTag(tag: string) {
    await saveLocal(() =>
      atlasRepository.savePlaceTags(
        place.id,
        userTags.filter((t) => t !== tag),
      ),
    );
  }
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
  // The county line on the card head (reference: "MARIANA COUNTY"):
  // the county whose bounds contain this place, else the area name,
  // else the type line. Same bounds lookup as viewArea below.
  const cardCounty = useMemo(() => {
    if (!place.position) return null;
    return (
      COUNTIES.find(
        (c) =>
          place.position &&
          place.position.x >= c.bounds.west &&
          place.position.x <= c.bounds.east &&
          place.position.y >= c.bounds.south &&
          place.position.y <= c.bounds.north,
      )?.name ?? null
    );
  }, [place.position]);
  const cardSubtitle =
    cardCounty || place.region || placeTypeLine(place) || categoryLabel(place.category);
  // The headline never shows "?" — an unnamed place is headlined by
  // its area ("Washington Beach, Vice Beach"), never by its missing
  // name. The eyebrow says so too: UNVERIFIED PLACE, not the generic
  // LEONIDA · PLACE.
  const displayTitle = displayTitleFor(place);
  // Long descriptions clamp to three lines with a Read more toggle —
  // a clamped mid-sentence ("…giving…") reads as a cut-off, not a
  // summary. Whether it clamps is measured, not guessed from the
  // character count: at this column width three lines hold ~90
  // characters, so a 105-character description already overflows
  // while a 180-character threshold would leave it cut with no way
  // to read the rest. The toggle shows exactly when the clamped text
  // overflows; once expanded it stays as Show less.
  const [descExpanded, setDescExpanded] = useState(false);
  const descRef = useRef<HTMLParagraphElement | null>(null);
  const [descOverflows, setDescOverflows] = useState(false);
  useEffect(() => {
    const el = descRef.current;
    if (!el || descExpanded) return;
    const measure = () => setDescOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [description, descExpanded]);
  const showDescToggle = descOverflows || descExpanded;
  // Interior status, in plain words at the top of the sheet: enterable /
  // unknown (never a false no), what kind of venue, what you do inside,
  // and whether it is a breakable house. A house with no enterable tag
  // is "check the in-game map", not "closed".
  const interior = interiorInfoFor(place);
  // What the map data's tags say this "?" is — a resolved type from the
  // tags, never a name. The name stays "?" until a source names it.
  const tagResolution = tagResolutionFor(place);
  // Category chips (reference sheet: "Major City / Activities /
  // Stores"): real data only. A region gets its kind from the local
  // catalogue (City / Region / Natural area) plus the top Map Index
  // categories of verified places near it; any other place gets its
  // own category, its tag-resolved type, and its layer's group.
  const cardChips = useMemo(() => {
    const chips: string[] = [];
    if (place.layerId === 'regions') {
      const local = getLocalStreetPlaces().items.find(
        (item) => `region:${item.slug}` === place.id,
      );
      const kindLabels: Record<StreetPlaceCategory, string> = {
        CITY: 'City',
        TOWN: 'Town',
        REGION: 'Region',
        DISTRICT: 'District',
        LANDMARK: 'Landmark',
        BUSINESS: 'Business',
        NATURAL_AREA: 'Natural area',
        INFRASTRUCTURE: 'Infrastructure',
        OTHER: 'Place',
      };
      if (local) chips.push(kindLabels[local.category]);
      if (place.position) {
        for (const { category } of topCategoriesNear(place.position, allPlaces)) {
          const label = categoryLabel(category);
          if (!chips.includes(label)) chips.push(label);
        }
      }
      return chips.slice(0, 3);
    }
    const category = categoryLabel(place.category);
    if (category) chips.push(category);
    const typeLabel = tagResolution?.label ?? aiDisplay?.label;
    if (typeLabel && !chips.includes(typeLabel)) chips.push(typeLabel);
    const layer = DEFAULT_LAYERS.find((l) => l.id === place.layerId);
    if (layer) {
      const group = categoryLabel(layer.mapIndex);
      if (group && !chips.includes(group)) chips.push(group);
    }
    return chips.slice(0, 3);
  }, [place, allPlaces, tagResolution, aiDisplay]);
  const [correcting, setCorrecting] = useState(false);
  const [correctChoice, setCorrectChoice] = useState<AiCategoryId>('house');
  const [correctShopType, setCorrectShopType] = useState('');
  /** Shown when a confirm/correct write did not persist — the
   * record on screen only changes after the write is verified, so
   * a failure must say so instead of looking like it worked. */
  const [aiSaveError, setAiSaveError] = useState('');
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
  async function toggleFavorite() {
    await saveLocal(() => atlasRepository.toggleFavorite(place.id));
  }
  /** Region sheet actions (v0.16.0, reference bottom sheet): fly the
   * camera to the region, or isolate its county on the map. */
  function setRoute() {
    // Re-selecting re-fires the focus (new requestId) — the camera flies.
    useMapStore.getState().select(place);
  }
  function viewArea() {
    const county =
      COUNTIES.find(
        (c) => c.area.includes(place.title) || c.name.includes(place.title),
      ) ??
      COUNTIES.find(
        (c) =>
          place.position &&
          place.position.x >= c.bounds.west &&
          place.position.x <= c.bounds.east &&
          place.position.y >= c.bounds.south &&
          place.position.y <= c.bounds.north,
      );
    if (!county) return;
    useUiStore.getState().setFilters({ countyId: county.id, area: null });
    useMapStore.getState().setBoundsFocus(county.bounds);
    useMapStore.getState().setIsolation(countyIsolation(county));
  }
  const photoInputRef = useRef<HTMLInputElement>(null);
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
    <aside className="place-sheet" aria-label="Place details">
      <div className="sheet-grabber" aria-hidden="true" />
      <header className="place-sheet-top">
        <span className="eyebrow">
          {isPersonal
            ? 'MY MARKER'
            : isUnnamedPlace(place)
              ? 'UNVERIFIED PLACE'
              : 'LEONIDA · PLACE'}
        </span>
        <button
          className="icon-button"
          aria-label="Close place details"
          onClick={() => (onClose ? onClose() : useMapStore.getState().select(null))}
        >
          <X size={20} />
        </button>
      </header>
      <div className="detail-scroll">
        {/*
          * The card head (reference bottom sheet): the picture sits
          * LEFT of the title — your own screenshot, or the zoomed
          * map crop at this exact spot, labelled as the map, never
          * as a photo. No AI image, no scraped image, no stock photo
          * of a different building. The crop used to render 0px tall
          * (no height rule) — only its caption showed.
          */}
        <div className="place-card-head">
          <div className="place-card-photo">
            {photoUrl ? (
              <div className="place-photo">
                <img src={photoUrl} alt={`${place.title} — your photo`} />
              </div>
            ) : place.position ? (
              <PlaceMapCrop position={place.position} />
            ) : (
              <div className="place-photo place-photo-empty" aria-hidden="true">
                <PlaceIcon
                  icon={iconKeyForAiRecord(aiRecord) ?? iconKeyForPlace(place)}
                  size={30}
                />
              </div>
            )}
            <span
              className="place-card-photo-badge"
              style={{ background: layerColor }}
              aria-hidden="true"
            >
              <PlaceIcon
                icon={iconKeyForAiRecord(aiRecord) ?? iconKeyForPlace(place)}
                size={16}
              />
            </span>
          </div>
          <div className="place-card-text">
            {/* The headline never shows "?" — an unnamed place is
                headlined by its area, never by its missing name. */}
            <h2>{displayTitle}</h2>
            <span className="place-card-county">{cardSubtitle}</span>
            {description.trim() ? (
              <>
                <p
                  ref={descRef}
                  className={`place-card-desc ${descExpanded ? 'is-expanded' : ''}`}
                >
                  {description}
                </p>
                {showDescToggle && (
                  <button
                    type="button"
                    className="text-button place-card-desc-more"
                    aria-expanded={descExpanded}
                    onClick={() => setDescExpanded((v) => !v)}
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </>
            ) : null}
            {cardChips.length > 0 && (
              <p className="place-card-chips" aria-label="What this place is">
                {cardChips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </p>
            )}
          </div>
          <button
            type="button"
            className={`place-card-bookmark ${favorite ? 'is-saved' : ''}`}
            disabled={!ready}
            aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => void toggleFavorite()}
          >
            <Star size={18} fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <p className="place-card-photo-note">
          {photoUrl
            ? 'Your photo — added by you'
            : place.position
              ? 'Map view of this spot — not a photo'
              : ''}
        </p>
        {/* First-open sheet (v0.26.0): "Pick what to see", right
         * under the card head so it reads without scrolling — the
         * layer buttons the old empty-map banner carried, now
         * inside the Vice City sheet. One tap turns the layers on
         * and closes the sheet, so the pins appear on the island
         * the user was just looking at. */}
        {firstOpen && (
          <section className="detail-section first-open-picker" aria-label="Pick what to see">
            <h3>Pick what to see</h3>
            <p className="help-text">
              {allPlaces.length.toLocaleString()} places are in the map — nothing is turned
              on yet.
            </p>
            <div className="empty-map-buttons">
              <button type="button" onClick={() => firstOpen.onPickLayers(['interiors'])}>
                Show interiors
              </button>
              <button type="button" onClick={() => firstOpen.onPickLayers(['lootable'])}>
                Show lootable
              </button>
              <button
                type="button"
                onClick={() =>
                  firstOpen.onPickLayers([
                    'shops-food',
                    'shops-vehicles',
                    'shops-weapons',
                    'shops-style',
                  ])
                }
              >
                Show shops
              </button>
              <button type="button" onClick={() => firstOpen.onPickLayers('all')}>
                Show everything
              </button>
              {firstOpen.lastSession && (
                <button
                  type="button"
                  className="restore-last"
                  onClick={firstOpen.onRestore}
                >
                  Restore my last layers ({firstOpen.lastSession.layerIds.length} on)
                </button>
              )}
            </div>
          </section>
        )}
        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={!ready || photoBusy}
            onClick={() => photoInputRef.current?.click()}
          >
            <Camera size={16} />{' '}
            {photoBusy ? 'Adding…' : photoUrl ? 'Replace your photo' : 'Add your photo'}
          </button>
          {photoUrl && (
            <button
              type="button"
              className="button"
              disabled={!ready}
              onClick={() => void removePhoto()}
            >
              Remove photo
            </button>
          )}
        </div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="visually-hidden"
          aria-label="Choose your own in-game screenshot of this place"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void onPhotoFile(file);
          }}
        />
        {photoError && (
          <p className="inline-error" role="alert">
            {photoError}
          </p>
        )}
        {!photoUrl && (
          <p className="help-text">
            {/* A region is not a building: "No photo of this building
                yet" on a whole city is wrong. */}
            {place.layerId === 'regions'
              ? 'No photo of this area yet — add your own in-game screenshot. Photos stay on this device and are never in backups.'
              : 'No photo of this place yet — add your own in-game screenshot. Photos stay on this device and are never in backups.'}
          </p>
        )}
        {/* Reference action row — one row of three, for every place,
          * not only regions. Set Route flies the camera to the place;
          * View Area isolates its county; Add to List is the
          * favorite toggle. */}
        <div className="place-card-actions">
          <button
            type="button"
            className="button primary"
            disabled={!place.position}
            onClick={setRoute}
          >
            <Navigation size={18} /> Set Route
          </button>
          <button type="button" className="button" disabled={!place.position} onClick={viewArea}>
            <Scan size={18} /> View Area
          </button>
          <button
            type="button"
            disabled={!ready}
            className={`button ${favorite ? 'selected' : ''}`}
            onClick={() => void toggleFavorite()}
          >
            <Star size={18} fill={favorite ? 'currentColor' : 'none'} />
            {favorite ? 'Saved' : 'Add to List'}
          </button>
        </div>
        <p className="place-badges" aria-label="What this place is">
          {interior.breakable && <span>Breakable home</span>}
          {place.layerId === 'lootable' && <span>Lootable</span>}
          {place.layerId === 'loot-heists' && <span>Bank job</span>}
          {place.layerId === 'loot-collectibles' && <span>Collectible</span>}
          {interior.status === 'enterable' && <span>Can go inside</span>}
          {interior.possibleBreakable && !interior.breakable && (
            <span>Possible enterable house</span>
          )}
          {place.layerId === 'gyms' && <span>Gym</span>}
          {place.layerId === 'equipment' && <span>Workout equipment</span>}
        </p>
        <p className="evidence-label">
          {isPersonal
            ? 'My marker · saved on this device'
            : !place.position
              ? 'No mapped position'
              : place.layerId === 'loot-heists' || place.layerId === 'loot-collectibles'
                ? 'Loot Map · community-sourced, unverified'
                : place.evidence === 'uncertain'
                  ? 'Unverified place · position not confirmed'
                  : 'Community placement · approximate'}
        </p>
        {aiDisplay && aiCategory && (
          <p className="ai-chip" role="status">
            <Sparkles size={13} /> {resolutionSourceLabel(recordSource(aiRecord))}:{' '}
            {aiDisplay.label} · {Math.round(aiDisplay.confidence * 100)}% sure
          </p>
        )}
        {aiRecord && aiRecord.status === 'unsure' && (
          <p className="ai-chip is-unsure" role="status">
            <Sparkles size={13} /> The AI was not sure what this is yet — it stays
            uncategorised.
          </p>
        )}
        <div className="place-actions">
          <button
            disabled={!ready}
            className={`button ${found ? 'selected' : ''}`}
            onClick={() => void saveLocal(() => atlasRepository.toggleVisited(place.id))}
          >
            <Check size={18} />
            {found ? 'Found ✓ — tap to undo' : 'Mark as found'}
          </button>
          <button
            disabled={!ready}
            className={`button ${explored ? 'selected' : ''}`}
            onClick={() => void saveLocal(() => atlasRepository.toggleExplored(place.id))}
          >
            <Footprints size={18} />
            {explored ? 'Explored ✓ — tap to undo' : 'Mark as explored'}
          </button>
        </div>
        {(loot || nearbyCollectables.length > 0 || place.layerId === 'lootable' || place.layerId === 'breakable') && (
          <section className="detail-section" aria-label="Loot and collectables">
            {loot && (
              <>
                <h3>Available loot</h3>
                <p className="help-text">
                  <strong>{loot.text}</strong>
                  {loot.source ? ` ${loot.source}` : ''}
                </p>
              </>
            )}
            <h3>Hidden collectables</h3>
            {nearbyCollectables.length > 0 ? (
              <ul className="collectables-list">
                {nearbyCollectables.map(({ place: card }) => (
                  <li key={card.id}>{card.title}</li>
                ))}
              </ul>
            ) : (
              <p className="help-text">None verified here.</p>
            )}
          </section>
        )}
        <section className="detail-section" aria-label="Your tags">
          <h3>
            <Tag size={15} /> Your tags
          </h3>
          <p className="help-text">
            Your own labels for this place — “sells t-shirts” on a gas station, “workout
            equipment” on a house. They never change its real category.
          </p>
          {userTags.length > 0 && (
            <p className="detail-tags" aria-label="Your tags on this place">
              {userTags.map((tag) => (
                <span key={tag}>
                  Your tag: {tag}
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove tag ${tag}`}
                    disabled={!ready}
                    onClick={() => void removeTag(tag)}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </p>
          )}
          <div className="tag-add-row">
            <input
              type="text"
              maxLength={MAX_TAG_LENGTH}
              value={tagInput}
              disabled={!ready}
              placeholder="Add a tag… e.g. sells t-shirts"
              aria-label="Add your own tag for this place"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addTag();
              }}
            />
            <button
              type="button"
              className="button"
              disabled={!ready || tagInput.trim().length === 0}
              onClick={() => void addTag()}
            >
              Add tag
            </button>
          </div>
          {tagError && (
            <p className="inline-error" role="alert">
              {tagError}
            </p>
          )}
        </section>
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
          <section className="detail-section ai-suggestion" aria-label="Suggested type">
            <h3>
              <Sparkles size={15} />{' '}
              {recordSource(aiRecord) === 'ai'
                ? 'What the AI suggests'
                : 'What the index found'}
            </h3>
            {aiDisplay && aiCategory ? (
              <>
                <p className="help-text">
                  <strong>
                    {aiDisplay.label} — {Math.round(aiDisplay.confidence * 100)}% sure.
                  </strong>{' '}
                  {aiRecord.reason}
                </p>
                <p className="help-text">{resolutionSourceNote(aiRecord)}</p>
                {aiRecord.status === 'suggested' && (
                  <button
                    type="button"
                    className="button"
                    onClick={async () => {
                      const ok = await useAiIndexStore
                        .getState()
                        .confirmCategory(place.id);
                      setAiSaveError(
                        ok
                          ? ''
                          : 'That confirmation could not be saved on this device — try again.',
                      );
                    }}
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
                    onClick={async () => {
                      const ok = await useAiIndexStore
                        .getState()
                        .correctCategory(
                          place.id,
                          correctChoice,
                          correctChoice === 'shop'
                            ? correctShopType.trim() || undefined
                            : undefined,
                        );
                      if (!ok) {
                        setAiSaveError(
                          'That type could not be saved on this device — try again.',
                        );
                        return;
                      }
                      setAiSaveError('');
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
            {aiSaveError && (
              <p className="inline-error" role="alert">
                {aiSaveError}
              </p>
            )}
          </section>
        )}

        {analogue && (
          <p className="analogue-note">
            <strong>Real-world reference (analogue only):</strong> {analogue} — a
            Miami-area building of the same kind, not the Leonida place.
          </p>
        )}
        <dl className="place-meta">
          <div>
            <dt>Category</dt>
            <dd>{categoryLabel(place.category)}</dd>
          </div>
          {place.region && (
            <div>
              <dt>Region</dt>
              <dd>{place.region}</dd>
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
                  Note saved
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
