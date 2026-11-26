import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, Bookmark, Camera, Check, Dumbbell, ExternalLink, Home, MapPin, Move, Navigation, Pencil, Scan, ShoppingBag, Sparkles, Star, Tag, X } from 'lucide-react';
import type { Place, Position } from '../../domain/types';
import { displayTitleFor, isUnnamedPlace } from '../../domain/types';
import { resolveViewArea } from './view-area';
import { locationCard, type GameDatabase } from '../../domain/game-db';
import {
  locationCardActions,
  type LocationCardAction,
} from '../completion/location-actions';
import {
  attachCompletionNote,
  loadGameDatabase,
  recordCompletion,
} from '../completion/record';
import { latestLootedRecordFor } from '../completion/place-ids';
import { useCompletionLogStore } from '../completion/log-store';
import { topCategoriesNear } from '../../domain/nearby-categories';
import { categoryLabel } from '../../app/categories';
import { CATEGORY_GROUPS } from '../../app/categories';
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
import PlaceResearch from './PlaceResearch';
import { COUNTIES } from '../../data/counties';
import { countyIsolation } from '../map/isolation';

export default function PlaceDetails({
  place,
  allPlaces,
  db,
  completionDb: completionDbProp,
  onAddMarkerHere,
  onMarkWorkout,
  onMarkBreakable,
}: {
  place: Place;
  /** Every place, for the "Hidden collectables" row: verified card pins
   * near this place. The card receives only its own place otherwise. */
  allPlaces: readonly Place[];
  /** The gameplay database (App) — the location's area for View Area
   * and the initial card view. May be null while the catalogue loads. */
  db?: GameDatabase | null;
  /** A records-aware database to start from (tests / a future store
   * injection). When absent the card loads its own via
   * loadGameDatabase and refreshes it from every recordCompletion
   * result, so looted counts and collected marks are never stale. */
  completionDb?: GameDatabase | null;
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
   * camera to the region, or isolate its area on the map. There is no
   * routing — "Show on Map" only re-selects the place so the camera
   * flies to it (DESIGN §6.3). */
  function showOnMap() {
    // Re-selecting re-fires the focus (new requestId) — the camera flies.
    useMapStore.getState().select(place);
  }
  /** View Area (§6.3, step 5): the area's OWN extent via
   * resolveAreaBounds — the member bbox, an estimate — falling back
   * to the county only when the area has none, and saying so. A
   * county fallback shows the county's traced isolation with the
   * reason on the card; no bounds at all means no camera move, just
   * the reason. Places with no area in the database keep the old
   * county-by-position behaviour. */
  const [viewAreaNote, setViewAreaNote] = useState<string | null>(null);
  function viewArea() {
    const resolved = resolveViewArea(db ?? null, place);
    if (resolved.kind === 'none') {
      setViewAreaNote(resolved.note);
      return;
    }
    if (resolved.kind === 'county') {
      const county = COUNTIES.find((c) => c.id === resolved.countyId);
      if (!county) {
        setViewAreaNote(resolved.note ?? 'No county found for this place.');
        return;
      }
      useUiStore.getState().setFilters({ countyId: county.id, area: null });
      useMapStore.getState().setBoundsFocus(resolved.bounds);
      useMapStore.getState().setIsolation(countyIsolation(county));
      setViewAreaNote(resolved.note);
      return;
    }
    useUiStore.getState().setFilters({ area: resolved.areaPath, countyId: null });
    useMapStore.getState().setBoundsFocus(resolved.bounds);
    useMapStore.getState().setIsolation({
      label: resolved.areaName,
      subtitle: `${resolved.placeCount.toLocaleString()} places · estimated extent`,
      bounds: resolved.bounds,
    });
    setViewAreaNote(null);
  }
  /** View Area needs no position: an unpositioned place can still
   * belong to an area with an extent (its siblings draw the box). */
  const canViewArea = Boolean(place.position) || Boolean(db?.locations.get(place.id)?.areaId);
  /** The game's own Map Index group for this place (DESIGN §3.1) —
   * the ACTUAL in-game category, not the app's filing. From the
   * place's layer, never invented. */
  const mapIndexGroup = useMemo(() => {
    const layer = DEFAULT_LAYERS.find((l) => l.id === place.layerId);
    if (!layer) return null;
    return CATEGORY_GROUPS.find((group) => group.id === layer.mapIndex)?.name ?? null;
  }, [place.layerId]);
  // --- Completion (step 6): the records-aware database. App's `db`
  // prop IS records-aware now (built from the log store), so the card
  // uses it directly — no second load, no stale copy. The
  // loadGameDatabase fallback below is only for callers that render
  // the card without a database (tests); it reads the log, never the
  // old visited/explored tables. ---
  const [completionDb, setCompletionDb] = useState<GameDatabase | null>(
    completionDbProp ?? null,
  );
  useEffect(() => {
    if (completionDbProp) {
      setCompletionDb(completionDbProp);
      return;
    }
    if (db) {
      setCompletionDb(db);
      return;
    }
    let alive = true;
    void loadGameDatabase({ places: allPlaces })
      .then((loaded) => {
        if (alive) setCompletionDb(loaded);
      })
      .catch(() => {
        // No completion data: the card still shows its actions, just
        // without completed state. The record calls surface their own
        // errors when the user taps.
      });
    return () => {
      alive = false;
    };
  }, [place.id, allPlaces, completionDbProp, db]);
  const activeDb = completionDb ?? db ?? null;
  const cardView = useMemo(
    () => (activeDb ? locationCard(activeDb, place.id) : null),
    [activeDb, place.id],
  );
  const cardActions = useMemo(
    () => (cardView && activeDb ? locationCardActions(cardView, activeDb) : []),
    [cardView, activeDb],
  );
  const [completionBusy, setCompletionBusy] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState('');
  /** The one write path (step 2's recordCompletion — called, never
   * changed). On success the returned db becomes the card's db, so
   * the struck-through state and the counts update immediately — and
   * it is adopted by the log store too, so the map pin dims and the
   * journal checkbox move in the same write (step 6). */
  async function recordAction(
    action: Extract<LocationCardAction, { kind: 'record' | 'collect' }>,
  ) {
    if (completionBusy) return;
    const target =
      action.kind === 'collect'
        ? { type: 'item' as const, id: action.itemId }
        : action.target;
    const verb = action.kind === 'collect' ? ('collected' as const) : action.verb;
    setCompletionBusy(action.key);
    setCompletionError('');
    const result = await recordCompletion({ target, verb });
    setCompletionBusy(null);
    if (result.ok && result.db) {
      setCompletionDb(result.db);
      useCompletionLogStore.getState().applyDb(result.db);
    } else {
      setCompletionError(result.error ?? 'Could not save that — try again.');
    }
  }
  const [noteEditingKey, setNoteEditingKey] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [lootNoteBusy, setLootNoteBusy] = useState<string | null>(null);
  const [noteError, setNoteError] = useState('');
  /** Attach a note to the latest still-standing looted record for
   *  one opportunity (Demo C, no key): the safe code used, or where
   *  the thing was. The note lives ON the record (record.ts
   *  attachCompletionNote), so it survives restart and
   *  backup/restore exactly like the loot itself. */
  async function saveLootNote(action: Extract<LocationCardAction, { kind: 'record' }>) {
    if (!activeDb || lootNoteBusy) return;
    const record = latestLootedRecordFor(activeDb, action.target.id);
    if (!record) {
      setNoteError('Nothing looted here yet — mark it looted first, then add a note.');
      return;
    }
    setLootNoteBusy(action.key);
    setNoteError('');
    const result = await attachCompletionNote(record.id, noteDraft);
    setLootNoteBusy(null);
    if (result.ok && result.db) {
      setCompletionDb(result.db);
      useCompletionLogStore.getState().applyDb(result.db);
      setNoteEditingKey(null);
      setNoteDraft('');
    } else {
      setNoteError(result.error ?? 'Could not save that note — try again.');
    }
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
          onClick={() => useMapStore.getState().select(null)}
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
          * not only regions. Show on Map flies the camera to the
          * place (there is no routing — §6.3); View Area isolates
          * the place's own area; Add to List is the favorite toggle. */}
        <div className="place-card-actions">
          <button
            type="button"
            className="button primary"
            disabled={!place.position}
            onClick={showOnMap}
          >
            <Navigation size={18} /> Show on Map
          </button>
          <button type="button" className="button" disabled={!canViewArea} onClick={viewArea}>
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
        {viewAreaNote && (
          <p className="view-area-note" role="status">
            {viewAreaNote}
          </p>
        )}
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
        {/* Your progress here (step 5, step 6): contextual actions
          * driven by this location's opportunities — the same
          * recordCompletion write the journal uses. Completed rows
          * are struck through and dimmed; looted rows keep their
          * count ("Looted ×3") and stay live, because hold-ups
          * repeat. "Shop here" is not a completion — it records
          * nothing. Step 6 removed the old "Mark as found /
          * explored" row above this section: it wrote the old
          * visited/explored tables, duplicating "Mark as explored"
          * while the log section already had it. A location with no
          * opportunity-driven action has no completion button here
          * (DESIGN §8 gives gyms, activities and the rest no verb —
          * the gap is flagged in the step-6 report for the
          * coordinator to rule on, not silently filled). */}
        {cardActions.length > 0 && (
          <section className="detail-section completion-actions" aria-label="Your progress here">
            <h3>Your progress here</h3>
            <ul className="completion-action-list">
              {cardActions.map((action) => {
                if (action.kind === 'info') {
                  return (
                    <li key={action.key} className="completion-action is-info">
                      <ShoppingBag size={16} aria-hidden="true" />
                      <span>
                        <strong>{action.label}</strong>
                        <small>{action.detail}</small>
                      </span>
                    </li>
                  );
                }
                if (action.kind === 'collect') {
                  return (
                    <li
                      key={action.key}
                      className={`completion-action is-collect ${action.done ? 'is-done' : ''}`}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={action.done}
                          disabled={action.done || completionBusy !== null}
                          onChange={() => void recordAction(action)}
                          aria-label={`Mark ${action.label} as collected`}
                        />
                        <span>
                          <strong className={action.done ? 'is-struck' : ''}>
                            {action.label}
                          </strong>
                          {action.done && <small>Collected ✓</small>}
                        </span>
                      </label>
                    </li>
                  );
                }
                const busy = completionBusy === action.key;
                const isLooted = action.verb === 'looted';
                // The note target: the latest still-standing looted
                // record for this opportunity. The suggested note is the opportunity's
                // own safe code, when it has one.
                const latestLooted =
                  isLooted && action.count > 0 && activeDb
                    ? latestLootedRecordFor(activeDb, action.target.id)
                    : undefined;
                const existingNote = latestLooted?.note;
                const suggestedNote =
                  action.loot?.code !== undefined ? `used code ${action.loot.code}` : '';
                const editingNote = noteEditingKey === action.key;
                return (
                  <Fragment key={action.key}>
                    <li
                      className={`completion-action ${action.done ? 'is-done' : ''} ${isLooted && action.count > 0 ? 'is-looted' : ''}`}
                    >
                      {isLooted ? <Banknote size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}
                      <span>
                        <strong className={action.done ? 'is-struck' : ''}>
                          {action.done ? action.doneLabel : action.label}
                        </strong>
                        <small>{action.detail}</small>
                        {action.loot?.code !== undefined && (
                          <small>Safe code {action.loot.code}</small>
                        )}
                      </span>
                      {isLooted && action.count > 0 && (
                        <span className="completion-count">{action.doneLabel}</span>
                      )}
                      <button
                        type="button"
                        className="button"
                        disabled={action.done || busy || !ready}
                        onClick={() => void recordAction(action)}
                      >
                        {busy ? 'Saving…' : action.label}
                      </button>
                    </li>
                    {latestLooted && (
                      <li className="completion-note">
                        {editingNote ? (
                          <>
                            <div className="tag-add-row">
                              <input
                                type="text"
                                maxLength={500}
                                value={noteDraft}
                                disabled={!ready || lootNoteBusy !== null}
                                placeholder={
                                  suggestedNote
                                    ? `e.g. ${suggestedNote}`
                                    : 'e.g. safe code used, where it was'
                                }
                                aria-label={`Note on this ${action.detail} loot`}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') void saveLootNote(action);
                                  if (e.key === 'Escape') {
                                    setNoteEditingKey(null);
                                    setNoteError('');
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="button primary"
                                disabled={!ready || lootNoteBusy !== null}
                                onClick={() => void saveLootNote(action)}
                              >
                                {lootNoteBusy === action.key ? 'Saving…' : 'Save note'}
                              </button>
                              <button
                                type="button"
                                className="button"
                                disabled={lootNoteBusy !== null}
                                onClick={() => {
                                  setNoteEditingKey(null);
                                  setNoteError('');
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                            {noteError && (
                              <p className="inline-error" role="alert">
                                {noteError}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="help-text">
                              {existingNote ? (
                                <>
                                  <strong>Note:</strong> {existingNote}
                                </>
                              ) : (
                                'No note on this loot yet.'
                              )}
                            </p>
                            <button
                              type="button"
                              className="button"
                              disabled={!ready}
                              onClick={() => {
                                setNoteEditingKey(action.key);
                                setNoteDraft(existingNote ?? suggestedNote);
                                setNoteError('');
                              }}
                            >
                              {existingNote ? 'Edit note' : 'Add a note'}
                            </button>
                          </>
                        )}
                      </li>
                    )}
                  </Fragment>
                );
              })}
            </ul>
            {completionError && (
              <p className="inline-error" role="alert">
                {completionError}
              </p>
            )}
          </section>
        )}
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
          {mapIndexGroup && (
            <div>
              <dt>Map Index</dt>
              <dd>{mapIndexGroup}</dd>
            </div>
          )}
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
        <PlaceResearch place={place} db={db} />
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
