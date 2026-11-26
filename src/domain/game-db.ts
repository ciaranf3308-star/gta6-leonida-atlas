/**
 * The unified gameplay database (DESIGN §3) — pure, no storage, no React.
 *
 * Map, Progress and Ask are three interfaces to ONE database: locations,
 * opportunities, items and completion records, derived here from today's
 * ingest shapes (`Place[]` + the 480-slot card checklist) and rebuilt on
 * every write. Every surface reads the selectors below, nothing else.
 *
 * Derivation rules (§3.2, deterministic, unit-tested, no precedence chain):
 * - Every `Place` becomes a `GameLocation` with the same id — EXCEPT
 *   `cards:*` rows and loot dancer cards, which become `CollectibleItem`s
 *   (their host GTADB record already IS the location), and `region:*`
 *   rows, which become `AreaNode`s (§6).
 * - Opportunities come from `opportunitiesForLocation` — one function per
 *   kind, all of which may fire for the same location.
 * - The 480 checklist slots (+ 117 extras) become `CollectibleItem`s
 *   from `CARD_CHECKLIST_ITEMS` (six.mics.dev identities + lorenzone
 *   pickups), merged with the existing `card()` rows: a pinned slot's
 *   `locationId` is its checklist `hostId`; where the checklist has no
 *   host id, the slot's catalogue pin is resolved (GTADB id parsed from
 *   the pin's host string, else a unique host-name match — Kyle
 *   Lewicki (teal) → `gym:dynamix`, Marquise Bernard → its own loot
 *   location). A card whose host cannot be resolved is a BUILD-TIME
 *   ERROR, never a silent drop.
 * - Loot Map heists become a location + a `bank-job` opportunity; loot
 *   collectibles (meditations 10, magazines 5, watch, scan) become a
 *   location + an item hosted there.
 *
 * DESIGN CONFLICTS found against the real data (see the step-1 report):
 * - DESIGN §3.1's set table (20 pinned + 3 = 23) predates the checklist
 *   import. Real counts: 37 `cards:*` pins + 3 loot = 40 pinned of 480.
 * - DESIGN §3.1 says card ids keep today's Place ids verbatim
 *   (`card:vicki`). The 480-slot ingest makes the checklist id
 *   (`card-checklist:<set>:<person>:<variant>`) the canonical item id —
 *   it is the only id that exists for all 480 slots. The old ids are
 *   kept as `legacyItemIds` (old catalogue id → item id) so step 2's
 *   migration can redirect favorites / visited / collections.
 * - DESIGN §7.4 case 1 says `remaining_collectibles({setId})` returns
 *   "5 items". Under the 480-slot model the Delights set has 18 slots,
 *   so it returns 18 — the regression that matters (the loot Harley is
 *   not dropped) still holds, and is what the selector test asserts.
 */
import { CARD_CHECKLIST_ITEMS, type CardChecklistItem } from '../data/card-checklist.generated';
import { COLLECTABLE_SETS, parseCardHostId } from '../data/collectables';
import { COMPLETION_THRESHOLDS, completionThresholdById, overallCompletion } from '../data/completion';
import { markerToPlace } from '../data/catalogue';
import { areaIdForRegion, buildRegionNameIndex, deriveAreaNodes, type AreaNode } from './geography';
import { opportunitiesForLocation } from './opportunities';
import type { ArtworkRef } from './album';
import { EMPTY_USER_DATA, isUnnamedPlace, type Place, type UserData } from './types';

/** Game units, never lat/lng. World ±16384 m, origin (-16384, 16384). */
export type GamePosition = { x: number; y: number };

export type Placement = 'pinned' | 'area-known' | 'unmapped';
/**
 * pinned     — a published position (GTADB, guide-registered, player-jotted).
 * area-known — named + an area, no usable position (the ~280 shops, most gang
 *              ops, most unpinned cards). Searchable, journal-listed, and
 *              rendered on the map as a soft "likely area" region — never a
 *              pin (user decision 2026-11-26: plot the area we actually know,
 *              not a guessed point). The region is the named area's extent,
 *              labelled with the item's name + "likely area".
 * unmapped   — known to exist only as a total / counter (hoops, drones).
 */
export type EvidenceKind =
  | 'verified' // in-game verified position AND gameplay fact. NONE yet.
  | 'approximate' // real record, published position known to be approximate
  | 'unverified' // named thing, no usable position
  | 'unmapped' // exists as a total/counter only
  | 'personal' // the player saw it / marked it himself
  | 'ai-suggested'; // on-device AI type, confidence-gated, never a fact

export interface Evidence {
  kind: EvidenceKind;
  /** e.g. 'GTADB / Map GTA · revision 2e9e194', 'gtadb.net · Collectible Cards guide'. */
  sourceTitle: string;
  sourceUrl: string;
  /** e.g. 'CC BY 4.0', 'MIT', 'unlicensed — names and areas only, no positions'. */
  license: string;
  /** ISO UTC. Empty when the ingest shape carries no recorded date —
   *  the gap is recorded as empty, never filled with an invented date. */
  recordedAt: string;
  /** AI only: model + confidence, as in AiCategoryRecord. */
  model?: string;
  confidence?: number;
}

/** A physical thing. */
export interface GameLocation {
  /** Stable id. TODAY'S Place ids are kept verbatim (L1234, loot:guide-*,
   *  region:* is an area, not a location, custom:*), so deep links
   *  (?place=L2227), favorites, notes and collections keep resolving. */
  id: string;
  /** Display name, or null when genuinely unknown ("?" records). Never invented. */
  name: string | null;
  /** True when the name is tentative ("Parsons Hotel?") or the record is "?". */
  nameUncertain: boolean;
  position: GamePosition | null;
  placement: Placement;
  /** Geography reference — the area node this location belongs to (§6). */
  areaId: string | null;
  /** Optional footprint geometry. NULL until a licensed footprint source
   *  exists. The map renders points until then. */
  footprint: { type: 'polygon'; points: GamePosition[] } | null;
  /** All evidence for this location, newest first. The FIRST entry is the
   *  display evidence; the rest is the audit trail. */
  evidence: Evidence[];
  /** Source tags, as today (GTADB tags, #shop tags, l1–l9). Tags are data,
   *  never a filing decision. */
  tags: string[];
  /** Free-text description from the source (guide loot lines, etc.). */
  description: string;
}

export type OpportunityKind =
  | 'shop' // buy here (subtype: weapons/style/food-drink/vehicles)
  | 'robbery-shop' // hold this shop up (stick-up target)
  | 'bank-job' // Loot Map heist / vault / payday loan
  | 'gang-op' // one of the 39 illegal operations (respawning)
  | 'break-in' // break into this house / apartment / trailer
  | 'interior' // enterable building, no robbery implied
  | 'gym' // member gym
  | 'workout-equipment'
  | 'activity' // pool, golf, arcade, race, shooting range, …
  | 'vehicle-loot' // a safe / garage / bunker holding a vehicle or code
  | 'easter-egg'
  | 'mission' // gated by missionsEnabled (§2.8)
  | 'discovery'; // a place worth visiting (landmark scan, viewpoint)

/** A thing you can do at a location. */
export interface Opportunity {
  /** `opp:<locationId>:<kind>:<n>` — stable, derived, never reused. */
  id: string;
  locationId: string;
  kind: OpportunityKind;
  /** Shop subtype, gang name, activity name, safe code — the detail that
   *  makes this opportunity distinct from its siblings on the same building.
   *  Vehicle loot lives HERE: `loot: { code?: string; contents: string[] }`
   *  on the host opportunity, never as a standalone pin. */
  label: string;
  detail?: string;
  loot?: { code?: string; contents: string[] };
  /** Repeatable loot (gang ops respawn, shops can be re-held-up) vs
   *  permanent completion (a card, a meditation). */
  repeatable: boolean;
  evidence: Evidence[];
}

export type ItemKind =
  | 'trading-card'
  | 'meditation'
  | 'magazine'
  | 'flamingo'
  | 'waink-scan'
  | 'vehicle-scan'
  | 'animal'
  | 'underwater'
  | 'watch'
  | 'earbuds'
  | 'other';

/**
 * One pickup spot for an item. The first is primary; the rest are
 * duplicates (same variant, second location — the lorenzone 490).
 * Each pickup carries its own source, so a disputed second pickup
 * (Charlie Spears' Key Lento porch, single source) is visible.
 * `areaId` is this step's addition: the area the pickup's lead names,
 * so step 4/5 can render the soft "likely area" region. It may dangle
 * (no `AreaNode` yet) until step 4 builds the full hierarchy.
 */
export interface Pickup {
  areaLead: string;
  areaId: string | null;
  /** lorenzone.fr's written direction for this pickup, kept as text. */
  direction: string;
  sourceTitle: string;
  sourceUrl: string;
  evidence: EvidenceKind;
  /** GTADB host id where this pickup is host-matched, else null. */
  hostId: string | null;
  hostName: string | null;
}

/** A thing you can have. */
export interface CollectibleItem {
  /** Stable id. Checklist slots keep their checklist id
   *  (`card-checklist:<set>:<person>:<variant>`); loot items keep their
   *  loot Place id (`loot:guide-*`). Old `card:*` ids resolve through
   *  `GameDatabase.legacyItemIds`. */
  id: string;
  name: string;
  /** e.g. 'gold', 'silver', 'bronze', 'red' — a colour variant is its own
   *  card (each counts separately toward its set). */
  variant?: string;
  kind: ItemKind;
  setId: string | null; // null for un-set items (meditations, flamingos)
  /** Host location when pinned; NULL when unpinned — the item still exists
   *  in the journal, searchable, checkable, with placement 'area-known'
   *  or 'unmapped'. 440 of 480 cards are null today. */
  locationId: string | null;
  placement: Placement;
  /** Exact spot inside the host, from the guide ("on the floor in the
   *  toilet on the left"). SHOWN ONLY AFTER AN EXPLICIT TAP — see §3.5. */
  spotDescription: string | null;
  /** Area-level lead from a guide ("Key Lento, central tower") — the
   *  citable text that is NOT a pin. Also behind the explicit tap. */
  areaLead: string | null;
  /** The area the lead names, for the soft "likely area" region (§6 of
   *  the task: area-known is a first-class placement). For pinned items
   *  this is the HOST location's area; for area-known items it is
   *  derived from `areaLead`. May dangle until step 4. */
  areaId: string | null;
  evidence: Evidence[];
  /** Checklist identity (addendum §1.1). 480 slots are true; the 117
   *  game-text variants that are not slots are false and never count
   *  toward a set. Non-card items carry false — the flag is meaningful
   *  only for trading cards. */
  checklistSlot: boolean;
  /** Pickup spots for this item (addendum §3.1). */
  pickups: Pickup[];
  /** Rarity, from six.mics.dev tiers. 'standard' is the default tier;
   *  colours are the variant colour. The variant string stays the
   *  display name; rarity drives the visual effect (addendum §3.2). */
  rarity: { tier: 'standard' | 'bronze' | 'silver' | 'gold'; colour?: string };
  /** Printed card text / stats, from six.mics.dev, cited. Shown only
   *  on the card back, only for collected cards (addendum §3.3).
   *  NULL — never bundle Rockstar text. */
  printedText: string | null;
  /** Artwork references. Null until a licensed source exists or the
   *  player supplies their own photo (addendum §3.3). */
  artwork: { front: ArtworkRef | null; back: ArtworkRef | null };
}

export interface CollectibleSet {
  id: string; // 'delights-dancers' — today's COLLECTABLE_SETS ids kept
  name: string;
  kind: ItemKind; // sets exist for cards; other kinds use setId null + kind
  /** Reported in-game total. DISPUTED totals are carried as a range with
   *  a flag, never silently picked: Manatees 24 vs 30. */
  size: number;
  sizeDisputed?: { low: number; high: number; note: string };
  /** Item ids in this set — checklistSlot items ONLY. The set is NEVER
   *  hidden because its items are unmapped. */
  itemIds: string[];
}

export type CompletionVerb =
  | 'looted' // repeatable: shop held up, gang op cleared, safe opened
  | 'collected' // permanent: a card, a meditation, a magazine
  | 'discovered' // found / visited a location or opportunity
  | 'explored'; // been here and checked it out

export type CompletionTarget =
  | { type: 'item'; id: string }
  | { type: 'opportunity'; id: string }
  | { type: 'location'; id: string };

/** The one write (DESIGN §3.4). Step 2 lands `recordCompletion`. */
export interface CompletionRecord {
  /** `rec:<uuid>` */
  id: string;
  target: CompletionTarget;
  verb: CompletionVerb;
  /** For repeatable verbs: how many times (gang-op respawns). For
   *  'collected': always 1 — a duplicate card is not a second completion. */
  count: number;
  /** ISO UTC, device time (labelled as such — no fake server time). */
  at: string;
  /** 'user' (tapped in the app), 'ask' (confirmed via Ask), 'import'
   *  (backup restore / migration), 'screenshot' (matched from a
   *  screenshot, addendum §3.4 — lands with the write path in step 2).
   *  Never 'ai' alone — the AI proposes, the user confirms (§7). */
  source: 'user' | 'ask' | 'import' | 'screenshot';
  /** Optional note, e.g. the safe code used, or "found in the garage". */
  note?: string;
}

/** The honest manual tally (DESIGN §3.1). */
export interface ReconciliationEntry {
  /** One of the 19 duanhesen threshold ids, or a counts-only category
   *  the tracker gains (hoops, drones, races). */
  categoryId: string;
  /** The number the player reconciled against the in-game counter. */
  count: number;
  /** 'game-stat' — typed from the in-game Progress screen. This is the
   *  ONLY basis a manual tally may have. */
  basis: 'game-stat';
  at: string;
  /** Set by the Progress selector at read time, never stored: true when
   *  derived record-level coverage for this category reaches its total,
   *  in which case this entry is shown but NOT counted (§4.3). */
  superseded?: boolean;
}

/** One category row of the Progress dashboard (§4.1). */
export interface ProgressView {
  categoryId: string;
  name: string;
  /** What 100% requires. */
  required: number;
  /** How many exist in the game in total. */
  total: number;
  /** The number Progress shows — derived OR reconciled, never summed. */
  displayed: number;
  /** 'derived' = "from your finds"; 'reconciled' = "from your in-game stats". */
  basis: 'derived' | 'reconciled';
  /** True when a reconciliation entry exists but is not counted because
   *  derived coverage applies (§4.3). */
  superseded: boolean;
  /** Record-level count (capped at total). */
  derivedCount: number;
  /** The reconciliation entry's count, or 0 when there is none. */
  reconciledCount: number;
  /** Disputed totals are carried as a range, never silently picked
   *  (stick-ups 50 vs 91, WAiNK 100 vs 112). */
  sizeDisputed?: { low: number; high: number; note: string };
}

/** Overall 100% progress (§4.1): recorded + reconciled, capped per category. */
export interface OverallView {
  /** Sum of min(displayed, required) across categories. */
  found: number;
  /** Sum of required across categories (1,325). */
  required: number;
  /** Overall progress toward 100% (0–1). */
  pct: number;
  /** Categories where the requirement is met. */
  doneCategories: number;
  categories: ProgressView[];
}

/** The location card (§8): a location with its opportunities and items. */
export interface LocationCardView {
  location: GameLocation;
  opportunities: Opportunity[];
  items: CollectibleItem[];
}

// src/domain/game-db.ts — pure, no storage, no React
export interface GameDatabase {
  locations: ReadonlyMap<string, GameLocation>;
  opportunities: ReadonlyMap<string, Opportunity>;
  opportunitiesByLocation: ReadonlyMap<string, readonly Opportunity[]>;
  items: ReadonlyMap<string, CollectibleItem>;
  itemsByLocation: ReadonlyMap<string, readonly CollectibleItem[]>;
  sets: ReadonlyMap<string, CollectibleSet>;
  areas: ReadonlyMap<string, AreaNode>; // §6
  records: readonly CompletionRecord[]; // the log, newest last
  reconciliation: readonly ReconciliationEntry[];
  /** Derived indexes, rebuilt on every write (cheap: ≤ ~5,000 rows). */
  completedItemIds: ReadonlySet<string>;
  completedOpportunityIds: ReadonlyMap<string, number>; // id → looted count
  discoveredLocationIds: ReadonlySet<string>;
  exploredLocationIds: ReadonlySet<string>;
  /** Old catalogue ids → canonical item ids (`card:vicki` →
   *  `card-checklist:delights-dancers:vicki:standard`). The step-2
   *  migration bridge for favorites / visited / collections that point
   *  at the pre-checklist ids. */
  legacyItemIds: ReadonlyMap<string, string>;
  /** Missions gate (§2.8): default off, spoiler-gated journal, no map pins. */
  missionsEnabled: boolean;
}

export interface BuildGameDatabaseInput {
  places: readonly Place[];
  /** Defaults to the generated 480-slot checklist (597 items). Pass a
   *  subset in tests to build a small database. */
  checklistItems?: readonly CardChecklistItem[];
  /** Defaults to EMPTY_USER_DATA. Markers become personal locations. */
  user?: UserData;
  /** The completion log. Defaults to []. */
  records?: readonly CompletionRecord[];
  /** Manual tallies. Defaults to []. */
  reconciliation?: readonly ReconciliationEntry[];
}

/** The six.mics.dev identity citation, carried as evidence on every
 *  checklist item (names / tiers cited as facts; no text bundled). */
const SIX_MICS_EVIDENCE: Evidence = {
  kind: 'unverified',
  sourceTitle: 'six.mics.dev · trading cards (game text)',
  sourceUrl: 'https://six.mics.dev',
  license: 'Game text © Rockstar Games — names, set membership, tiers and stats usable as facts with citation; no raw text bundled',
  recordedAt: '',
};

function evidenceFromPlace(place: Place): Evidence {
  return {
    kind:
      place.evidence === 'personal'
        ? 'personal'
        : place.evidence === 'approximate'
          ? 'approximate'
          : 'unverified',
    sourceTitle: place.source.title,
    sourceUrl: place.source.url,
    license:
      place.source.license ??
      (place.evidence === 'personal' ? 'personal' : 'unknown — see source'),
    recordedAt: '',
  };
}

function placeToLocation(
  place: Place,
  regionNameIndex: ReadonlyMap<string, string>,
  corroboratedLocationIds: ReadonlySet<string>,
): GameLocation {
  const unnamed = isUnnamedPlace(place);
  const nameUncertain = unnamed || place.title.includes('?');
  // A pin is a claim of a confirmed place (DESIGN §3.2, A§9): 'pinned'
  // needs a position AND a confirmed name AND (evidence better than
  // 'uncertain' OR a second source establishing the place — see the
  // corroborated set built in buildGameDatabase). An unnamed "?" record,
  // a tentative name ("Ammu-Nation?") or an uncorroborated unconfirmed
  // record is 'area-known' — it exists in the db, it is searchable and
  // its uncertainty is shown, but it renders no pin until it is
  // typed/confirmed. (v0.32 step 1 follow-up: the Weapons regression —
  // L2406 "?" and L1091 "Ammu-Nation?" were 'pinned'.)
  //
  // The 'uncertain' demotion applies only to GTADB-sourced records.
  // A guide-sourced place (Loot Map heist guides) carries 'uncertain'
  // for a different reason — its position is estimated from the guide,
  // not its identity doubted — and the guide IS the source establishing
  // the place, so it is pinned on position + name (evidence 'unverified'
  // still shown on the card). Without this, all 29 bank-job locations
  // would demote and the Loot Map heist layer would vanish.
  const gtadbSourced = place.source.title.startsWith('GTADB');
  const pinned =
    place.position !== null &&
    place.position !== undefined &&
    !nameUncertain &&
    (!gtadbSourced ||
      place.evidence !== 'uncertain' ||
      corroboratedLocationIds.has(place.id));
  return {
    id: place.id,
    name: unnamed ? null : place.title,
    nameUncertain,
    position: place.position ? { x: place.position.x, y: place.position.y } : null,
    placement: pinned ? 'pinned' : place.region.trim() ? 'area-known' : 'unmapped',
    areaId: areaIdForRegion(place.region, regionNameIndex),
    footprint: null,
    evidence: [evidenceFromPlace(place)],
    tags: [...place.tags],
    description: place.description,
  };
}

/** Loot-collectible kind, from the loot record's own tags. */
function lootItemKind(place: Place): ItemKind {
  if (place.tags.includes('meditation')) return 'meditation';
  if (place.tags.includes('magazine')) return 'magazine';
  if (place.tags.includes('watch')) return 'watch';
  if (place.tags.includes('scan')) return 'waink-scan';
  if (place.tags.includes('trading-card')) return 'trading-card';
  return 'other';
}

/**
 * Resolve a pinned checklist slot to its host location id.
 *
 * 1. The checklist `hostId` wins — it is the host-matched GTADB id.
 *    Where the slot's catalogue pin is a `cards:*` row whose region
 *    also parses, the two must agree (a mismatch is a build-time
 *    error: the generator and the hand-written pin disagree).
 * 2. No host id + a `cards:*` pin: parse the GTADB id from the pin's
 *    host string (`parseCardHostId` — throws when unparseable).
 * 3. No GTADB id in the host string: resolve by the pickup's host
 *    name to the unique non-card place of that name (Kyle Lewicki
 *    (teal) → `gym:dynamix`, whose host is a GTA6 GPS pin, not a
 *    GTADB record). Zero or several matches is a build-time error.
 * 4. No host id + a `loot-collectibles` pin: the loot record IS the
 *    location (Marquise Bernard — "outside Kenton's shop", no GTADB
 *    host); the item's location id is the loot record's own id.
 * Anything else is a build-time error — never a silent drop.
 */
function resolvePinnedSlotLocationId(
  slot: CardChecklistItem,
  placesById: ReadonlyMap<string, Place>,
): string {
  if (slot.hostId) {
    // The checklist host id is authoritative. Where the slot's catalogue
    // pin exists and is a `cards:*` row whose region also parses, the
    // two must agree (a mismatch is a build-time error: the generator
    // and the hand-written pin disagree). A pin whose host string has
    // no GTADB id (a GPS pin, not a GTADB record) does not block the
    // checklist host — and a dangling catalogue id does not either.
    if (slot.catalogueId) {
      const pin = placesById.get(slot.catalogueId);
      if (pin?.layerId.startsWith('cards:')) {
        try {
          const parsed = parseCardHostId(pin);
          if (parsed !== slot.hostId) {
            throw new Error(
              `Card slot ${slot.id}: checklist host ${slot.hostId} disagrees with pin ${pin.id} host ${parsed}.`,
            );
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('disagrees')) throw error;
        }
      }
    }
    return slot.hostId;
  }
  if (!slot.catalogueId) {
    throw new Error(
      `Card slot ${slot.id} is pinned but has neither a host id nor a catalogue pin.`,
    );
  }
  const pin = placesById.get(slot.catalogueId);
  if (!pin) {
    throw new Error(
      `Card slot ${slot.id} joins to missing catalogue pin ${slot.catalogueId}.`,
    );
  }
  if (pin.layerId.startsWith('cards:')) {
    try {
      return parseCardHostId(pin);
    } catch {
      // No GTADB id in the host string — resolve by host name.
      const hostName = slot.pickups.find((pickup) => pickup.hostName)?.hostName;
      if (!hostName) {
        throw new Error(
          `Card slot ${slot.id}: pin ${pin.id} has no GTADB host id and no host name to resolve.`,
        );
      }
      const normalized = hostName.trim().toLowerCase().replace(/^the\s+/, '');
      const candidates = [...placesById.values()].filter(
        (place) =>
          !place.layerId.startsWith('cards:') &&
          place.layerId !== 'loot-collectibles' &&
          place.layerId !== 'regions' &&
          (place.title.split(',')[0]?.trim().toLowerCase().replace(/^the\s+/, '') ===
            normalized),
      );
      if (candidates.length === 1) return candidates[0]!.id;
      throw new Error(
        `Card slot ${slot.id}: host name "${hostName}" resolves to ${candidates.length} places (expected exactly 1).`,
      );
    }
  }
  if (pin.layerId === 'loot-collectibles') return pin.id;
  throw new Error(
    `Card slot ${slot.id}: catalogue pin ${pin.id} is neither a cards:* pin nor a loot-collectibles pin.`,
  );
}

function checklistSlotToItem(
  slot: CardChecklistItem,
  locationId: string | null,
  hostAreaId: string | null,
  regionNameIndex: ReadonlyMap<string, string>,
): CollectibleItem {
  const areaLead = slot.areaLead || null;
  const pickups: Pickup[] = slot.pickups.map((pickup) => ({
    areaLead: pickup.areaLead,
    areaId: areaIdForRegion(pickup.areaLead, regionNameIndex),
    direction: pickup.direction,
    sourceTitle: pickup.sourceTitle,
    sourceUrl: pickup.sourceUrl,
    evidence: pickup.evidence,
    hostId: pickup.hostId,
    hostName: pickup.hostName,
  }));
  const primarySource =
    pickups[0] === undefined
      ? null
      : {
          kind: 'approximate' as const,
          sourceTitle: pickups[0].sourceTitle,
          sourceUrl: pickups[0].sourceUrl,
          license: 'Text citable as a lead (lorenzone.fr)',
          recordedAt: '',
        };
  return {
    id: slot.id,
    name: slot.person,
    variant: slot.variant,
    kind: 'trading-card',
    setId: slot.setId,
    locationId,
    placement: slot.placement,
    spotDescription: slot.spotDescription || null,
    areaLead,
    // Pinned items sit at their host: the host's area is the area.
    // Area-known items carry the area their lead names.
    areaId: hostAreaId ?? (areaLead ? areaIdForRegion(areaLead, regionNameIndex) : null),
    evidence: primarySource ? [primarySource, SIX_MICS_EVIDENCE] : [SIX_MICS_EVIDENCE],
    checklistSlot: slot.checklistSlot,
    pickups,
    rarity: { ...slot.rarity },
    printedText: slot.printedText,
    artwork: { front: slot.artwork.front, back: slot.artwork.back },
  };
}

/**
 * A loot-collectible place that is NOT a trading card becomes an item
 * hosted at its own location (meditations 10, magazines 5, watch,
 * scan). Trading-card loot places are owned by the checklist — they
 * return null here, never a second item.
 */
function lootPlaceToItem(
  place: Place,
  regionNameIndex: ReadonlyMap<string, string>,
): CollectibleItem | null {
  if (place.tags.includes('trading-card')) return null;
  return {
    id: place.id,
    name: place.title,
    kind: lootItemKind(place),
    setId: null,
    locationId: place.id,
    placement: place.position ? 'pinned' : 'area-known',
    spotDescription: null,
    areaLead: place.region.trim() || null,
    areaId: areaIdForRegion(place.region, regionNameIndex),
    evidence: [evidenceFromPlace(place)],
    checklistSlot: false,
    pickups: [],
    rarity: { tier: 'standard' },
    printedText: null,
    artwork: { front: null, back: null },
  };
}

export function buildGameDatabase(input: BuildGameDatabaseInput): GameDatabase {
  const places = input.places;
  const checklistItems = input.checklistItems ?? CARD_CHECKLIST_ITEMS;
  const user = input.user ?? EMPTY_USER_DATA;
  const records = input.records ?? [];
  const reconciliation = input.reconciliation ?? [];

  const placesById = new Map<string, Place>();
  for (const place of places) {
    if (placesById.has(place.id)) {
      throw new Error(`Duplicate place id in catalogue input: ${place.id}.`);
    }
    placesById.set(place.id, place);
  }
  const checklistById = new Map<string, CardChecklistItem>();
  for (const item of checklistItems) {
    if (checklistById.has(item.id)) {
      throw new Error(`Duplicate checklist item id: ${item.id}.`);
    }
    checklistById.set(item.id, item);
  }

  // Personal markers are locations too (evidence 'personal').
  const markerPlaces = user.markers.map(markerToPlace);
  for (const place of markerPlaces) {
    if (placesById.has(place.id)) {
      throw new Error(`Personal marker id collides with a catalogue place: ${place.id}.`);
    }
    placesById.set(place.id, place);
  }
  const allPlaces = [...places, ...markerPlaces];

  const regionPlaces = allPlaces.filter((place) => place.layerId === 'regions');
  const regionNameIndex = buildRegionNameIndex(regionPlaces);

  // Which loot dancer cards already have a GTADB host (Harley → L629,
  // Aimie → L325)? Their loot records are NOT locations — the host is.
  // A loot dancer card with no host (Marquise) keeps its loot record
  // as its location.
  const lootCardHostIds = new Map<string, string | null>();
  for (const slot of checklistItems) {
    if (slot.catalogueId?.startsWith('loot:')) {
      lootCardHostIds.set(slot.catalogueId, slot.hostId);
    }
  }

  // Corroboration (v0.32 step 1 follow-up — the Weapons regression):
  // a GTADB record flagged 'uncertain' is pinned only when a second
  // source establishes the place — here, a pinned checklist slot hosted
  // there. Delights (L629, 'unconfirmed' tag) hosts Jason + Harley, so
  // it is pinned; Redshaw's (L1676, 'unconfirmed', hosts nothing) stays
  // area-known. This is the addendum's corroboration principle applied
  // to placement: two independent sources lift a place to pinned, one
  // flagged source does not. The evidence stays 'unverified' on the card
  // — the GTADB flag is still shown; placement is about "is there a
  // place here", evidence is about "how sure is the source".
  const corroboratedLocationIds = new Set<string>();
  for (const slot of checklistItems) {
    if (slot.placement === 'pinned' && slot.hostId) {
      corroboratedLocationIds.add(slot.hostId);
    }
  }

  // --- Locations (§3.2) ---
  const locations = new Map<string, GameLocation>();
  for (const place of allPlaces) {
    if (place.layerId === 'regions') continue; // → AreaNode, not a location
    if (place.layerId.startsWith('cards:')) continue; // → CollectibleItem
    const lootCardHost = lootCardHostIds.get(place.id);
    if (
      place.layerId === 'loot-collectibles' &&
      place.tags.includes('trading-card') &&
      lootCardHost !== undefined &&
      lootCardHost !== null
    ) {
      continue; // dancer card with a GTADB host → item on the host
    }
    locations.set(
      place.id,
      placeToLocation(place, regionNameIndex, corroboratedLocationIds),
    );
  }

  // --- Opportunities (§3.2, via opportunitiesForLocation) ---
  const opportunities = new Map<string, Opportunity>();
  const opportunitiesByLocation = new Map<string, readonly Opportunity[]>();
  for (const location of locations.values()) {
    const opps = opportunitiesForLocation(location);
    opportunitiesByLocation.set(location.id, opps);
    for (const opp of opps) opportunities.set(opp.id, opp);
  }

  // --- Items: checklist first, then loot non-cards (§3.2 + addendum §3.1) ---
  const items = new Map<string, CollectibleItem>();
  const legacyItemIds = new Map<string, string>();
  for (const slot of checklistItems) {
    let locationId: string | null = null;
    if (slot.placement === 'pinned') {
      locationId = resolvePinnedSlotLocationId(slot, placesById);
      if (!locations.has(locationId)) {
        throw new Error(
          `Card slot ${slot.id} resolves to ${locationId}, which is not a location in this database.`,
        );
      }
    }
    const hostAreaId = locationId ? (locations.get(locationId)?.areaId ?? null) : null;
    const item = checklistSlotToItem(slot, locationId, hostAreaId, regionNameIndex);
    items.set(item.id, item);
    if (slot.catalogueId) legacyItemIds.set(slot.catalogueId, item.id);
  }
  for (const place of allPlaces) {
    if (place.layerId !== 'loot-collectibles') continue;
    const item = lootPlaceToItem(place, regionNameIndex);
    if (!item) continue;
    if (!locations.has(item.locationId!)) {
      throw new Error(`Loot item ${item.id} has no location ${item.locationId}.`);
    }
    items.set(item.id, item);
  }

  // --- Sets: checklistSlot items only; extras never count (§1.1) ---
  const sets = new Map<string, CollectibleSet>();
  for (const set of COLLECTABLE_SETS) {
    const itemIds = [...items.values()]
      .filter((item) => item.setId === set.id && item.checklistSlot)
      .map((item) => item.id);
    sets.set(set.id, {
      id: set.id,
      name: set.name,
      kind: 'trading-card',
      size: set.size,
      ...(set.id === 'vice-city-manatees'
        ? {
            sizeDisputed: {
              low: 24,
              high: 30,
              note: 'Manatees 24 vs 30: the 24 is the named checklist size; the 30-position list includes unnamed entries (addendum §1.1).',
            },
          }
        : {}),
      itemIds,
    });
  }

  // --- Areas (§6, step 1: nodes + membership only) ---
  const areas = deriveAreaNodes(regionPlaces, [...locations.values()]);

  // --- Indexes over the completion log ---
  const completedItemIds = new Set<string>();
  const completedOpportunityIds = new Map<string, number>();
  const discoveredLocationIds = new Set<string>();
  const exploredLocationIds = new Set<string>();
  const itemCollectedCounts = new Map<string, number>();
  for (const record of records) {
    if (record.target.type === 'item') {
      const total = (itemCollectedCounts.get(record.target.id) ?? 0) + record.count;
      itemCollectedCounts.set(record.target.id, total);
    } else if (record.target.type === 'opportunity') {
      // Sum unconditionally here; the ≤ 0 filter runs AFTER the loop
      // (below). Record order is id order, not chronological — a -1
      // compensating record may sort before its +1s, and filtering
      // during accumulation would silently drop it (step-2 lane finding:
      // loot ×2 + undo read back as ×2, ~50% of runs). The item branch
      // already sums-then-filters; this matches it.
      const total = (completedOpportunityIds.get(record.target.id) ?? 0) + record.count;
      completedOpportunityIds.set(record.target.id, total);
      const opp = opportunities.get(record.target.id);
      if (record.verb === 'discovered' && opp) discoveredLocationIds.add(opp.locationId);
      if (record.verb === 'explored' && opp) exploredLocationIds.add(opp.locationId);
    } else {
      if (record.verb === 'discovered') discoveredLocationIds.add(record.target.id);
      if (record.verb === 'explored') exploredLocationIds.add(record.target.id);
    }
  }
  for (const [itemId, total] of itemCollectedCounts) {
    if (total > 0) completedItemIds.add(itemId);
  }
  for (const [oppId, total] of completedOpportunityIds) {
    if (total <= 0) completedOpportunityIds.delete(oppId);
  }

  const itemsByLocation = new Map<string, readonly CollectibleItem[]>();
  for (const item of items.values()) {
    if (!item.locationId) continue;
    const list = itemsByLocation.get(item.locationId) ?? [];
    itemsByLocation.set(item.locationId, [...list, item]);
  }

  return {
    locations,
    opportunities,
    opportunitiesByLocation,
    items,
    itemsByLocation,
    sets,
    areas,
    records,
    reconciliation,
    completedItemIds,
    completedOpportunityIds,
    discoveredLocationIds,
    exploredLocationIds,
    legacyItemIds,
    missionsEnabled: false,
  };
}

// --- Selectors (§3.4) ---

export function setProgress(
  db: GameDatabase,
  setId: string,
): { found: number; total: number; remaining: CollectibleItem[] } {
  const set = db.sets.get(setId);
  if (!set) throw new Error(`Unknown collectible set: ${setId}.`);
  const remaining = set.itemIds
    .filter((itemId) => !db.completedItemIds.has(itemId))
    .map((itemId) => db.items.get(itemId)!);
  return { found: set.itemIds.length - remaining.length, total: set.size, remaining };
}

/**
 * Category derivation table (§4.2). Each category has ONE authoritative
 * source at a time (§4.3): derived from completion records where
 * record-level coverage exists, or a `ReconciliationEntry` (game-stat
 * basis) where it does not. The two are never added.
 *
 * `importComplete` means the record source for the category is fully
 * imported, so a derived 0 is a real 0 and a reconciliation entry is
 * superseded even with no records yet. Where the import is partial or
 * pending, derived applies only once the player has ≥1 record for the
 * category; otherwise the reconciled number shows.
 */
interface CategoryDerivation {
  /** Distinct 'collected' items of this kind. */
  itemsKind?: ItemKind;
  /** Distinct 'looted' opportunities of this kind (+ detail filter). */
  opportunityKind?: OpportunityKind;
  opportunityDetail?: string;
  /** Complete card sets (card-sets category only). */
  completeSets?: true;
  importComplete: boolean;
  sizeDisputed?: { low: number; high: number; note: string };
}

function categoryDerivation(categoryId: string): CategoryDerivation | null {
  switch (categoryId) {
    case 'gang-ops':
      // 39 records to import (§8.1) — none exist yet.
      return { opportunityKind: 'gang-op', importComplete: false };
    case 'bank-jobs':
      // The 29 loot heist pins are imported; a derived 0 is a real 0.
      return { opportunityKind: 'bank-job', importComplete: true };
    case 'payday-loans':
      return { opportunityKind: 'bank-job', opportunityDetail: 'Payday loan', importComplete: true };
    case 'smash-grabs':
      // Jewellery/pawn robbery-shops: 0 exist today — needs the shop import.
      return { opportunityKind: 'robbery-shop', opportunityDetail: 'pawn', importComplete: false };
    case 'store-stickups':
      return {
        opportunityKind: 'robbery-shop',
        opportunityDetail: 'convenience',
        importComplete: false,
        sizeDisputed: {
          low: 50,
          high: 91,
          note: 'Convenience Store Stick Ups total disputed: 50 vs 91 (DESIGN §9.2).',
        },
      };
    case 'card-sets':
      // All 480 slots ingested — derived, always.
      return { completeSets: true, importComplete: true };
    case 'flamingos':
      // 0 flamingo items today.
      return { itemsKind: 'flamingo', importComplete: false };
    case 'waink-scans':
      return {
        itemsKind: 'waink-scan',
        importComplete: false,
        sizeDisputed: {
          low: 100,
          high: 112,
          note: 'WAiNK Landmark Scans total disputed: 100 vs 112 (DESIGN §9.1).',
        },
      };
    case 'underwater':
      return { itemsKind: 'underwater', importComplete: false };
    case 'magazines':
      // 5 pinned of 30 titles — partial import.
      return { itemsKind: 'magazine', importComplete: false };
    case 'meditation':
      // 10 pinned of 15 — partial import.
      return { itemsKind: 'meditation', importComplete: false };
    default:
      // missions, stunts, vehicles, animals, hunting, hoops,
      // drone-trials, range-gold: no record-level source at all.
      return null;
  }
}

function derivedCountFor(db: GameDatabase, derivation: CategoryDerivation): number {
  if (derivation.completeSets) {
    let complete = 0;
    for (const set of db.sets.values()) {
      if (set.itemIds.every((itemId) => db.completedItemIds.has(itemId))) complete += 1;
    }
    return complete;
  }
  if (derivation.itemsKind) {
    let count = 0;
    for (const itemId of db.completedItemIds) {
      if (db.items.get(itemId)?.kind === derivation.itemsKind) count += 1;
    }
    return count;
  }
  if (derivation.opportunityKind) {
    let count = 0;
    for (const oppId of db.completedOpportunityIds.keys()) {
      const opp = db.opportunities.get(oppId);
      if (!opp || opp.kind !== derivation.opportunityKind) continue;
      if (derivation.opportunityDetail && opp.detail !== derivation.opportunityDetail) continue;
      count += 1;
    }
    return count;
  }
  return 0;
}

/** The no-double-counting rule (§4.3, normative), at read time. */
export function categoryProgress(db: GameDatabase, categoryId: string): ProgressView {
  const threshold = completionThresholdById(categoryId);
  if (!threshold) throw new Error(`Unknown completion category: ${categoryId}.`);
  const entries = db.reconciliation
    .filter((entry) => entry.categoryId === categoryId)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const latestEntry = entries.at(-1);
  const reconciledCount = latestEntry?.count ?? 0;
  const derivation = categoryDerivation(categoryId);
  if (!derivation) {
    return {
      categoryId,
      name: threshold.name,
      required: threshold.required,
      total: threshold.total,
      displayed: reconciledCount,
      basis: 'reconciled',
      superseded: false,
      derivedCount: 0,
      reconciledCount,
    };
  }
  const rawDerived = derivedCountFor(db, derivation);
  const derivedCount = Math.min(rawDerived, threshold.total);
  const hasRecordLevelSource =
    derivation.completeSets === true ||
    (derivation.itemsKind !== undefined &&
      [...db.items.values()].some((item) => item.kind === derivation.itemsKind)) ||
    (derivation.opportunityKind !== undefined &&
      [...db.opportunities.values()].some(
        (opp) =>
          opp.kind === derivation.opportunityKind &&
          (derivation.opportunityDetail === undefined ||
            opp.detail === derivation.opportunityDetail),
      ));
  const derivedApplies =
    hasRecordLevelSource && (rawDerived > 0 || derivation.importComplete);
  if (derivedApplies) {
    return {
      categoryId,
      name: threshold.name,
      required: threshold.required,
      total: threshold.total,
      displayed: derivedCount,
      basis: 'derived',
      superseded: latestEntry !== undefined,
      derivedCount,
      reconciledCount,
      sizeDisputed: derivation.sizeDisputed,
    };
  }
  return {
    categoryId,
    name: threshold.name,
    required: threshold.required,
    total: threshold.total,
    displayed: reconciledCount,
    basis: 'reconciled',
    superseded: false,
    derivedCount,
    reconciledCount,
    sizeDisputed: derivation.sizeDisputed,
  };
}

export function overallProgress(db: GameDatabase): OverallView {
  const categories = COMPLETION_THRESHOLDS.map((threshold) =>
    categoryProgress(db, threshold.id),
  );
  const counts: Record<string, number> = {};
  for (const category of categories) counts[category.categoryId] = category.displayed;
  const overall = overallCompletion(counts);
  return {
    found: overall.found,
    required: overall.required,
    pct: overall.pct,
    doneCategories: overall.doneCategories,
    categories,
  };
}

/**
 * Visibility (§3.3): an opportunity is visible exactly when ONE of these holds:
 * 1. it is the user's own (`evidence: 'personal'` — never a spoiler), or
 * 2. its filter is turned on by an explicit user action (`enabledKinds`), or
 * 3. it is in the current REVEAL set (`revealIds` — an Ask answer, a
 *    search-result tap, a deep link, a location card). A reveal shows THAT
 *    record only, for now; it never turns its filter on.
 * `hideCompleted` excludes opportunities with any completion record
 * (looted / discovered / explored) targeting them.
 */
export function visibleOpportunities(
  db: GameDatabase,
  opts: {
    enabledKinds: Iterable<OpportunityKind>;
    revealIds?: Iterable<string>;
    hideCompleted?: boolean;
  },
): Opportunity[] {
  const enabled = new Set(opts.enabledKinds);
  const reveal = new Set(opts.revealIds ?? []);
  let touchedOpportunityIds: ReadonlySet<string> | null = null;
  if (opts.hideCompleted) {
    const touched = new Set<string>();
    for (const record of db.records) {
      if (record.target.type === 'opportunity') touched.add(record.target.id);
    }
    touchedOpportunityIds = touched;
  }
  return [...db.opportunities.values()].filter((opp) => {
    if (touchedOpportunityIds?.has(opp.id)) return false;
    const location = db.locations.get(opp.locationId);
    const isPersonal = opp.evidence.some((entry) => entry.kind === 'personal');
    // A§9: only a pinned (named, confirmed) location renders a pin. An
    // uncertain location's opportunities exist in the db and are
    // searchable, but render nothing until the place is typed/confirmed
    // — a "?" record must never become a pin. The gate holds even for
    // reveals: a reveal opens the location card (with its uncertainty
    // shown), it never draws a pin for an unconfirmed place. Personal
    // records are the exception (§3.3 rule 1): the player's own markers
    // are never spoilers.
    if (location && location.placement !== 'pinned' && !isPersonal) return false;
    if (enabled.has(opp.kind)) return true;
    if (reveal.has(opp.id)) return true;
    if (isPersonal) return true;
    return false;
  });
}

export function locationCard(db: GameDatabase, locationId: string): LocationCardView | null {
  const location = db.locations.get(locationId);
  if (!location) return null;
  return {
    location,
    opportunities: [...(db.opportunitiesByLocation.get(locationId) ?? [])],
    items: [...(db.itemsByLocation.get(locationId) ?? [])],
  };
}

/**
 * Remaining (uncollected) items, filtered by set AND kind AND area.
 * AND means AND — and setId ALWAYS wins over areaId (§7.2, the
 * Delights/Harley rule, normative): when setId is present, the area
 * filter applies only to items that HAVE a location in that area; items
 * in the set with no location are still returned (as "no position
 * yet"), never dropped. Without a setId, the area filter matches both
 * pinned items (by their host's area) and area-known items (by their
 * lead's area).
 *
 * Step 5 (descendant-aware): `areaIds` is a SET of area ids — the
 * caller passes a subtree (geography.subtreeAreaIds), so filtering
 * by Vice City matches Downtown items and filtering by Port Gellhorn
 * matches its children. A single `areaId` is the exact-match form
 * and keeps working unchanged; when both are given, `areaIds` wins.
 */
export function remainingItems(
  db: GameDatabase,
  opts: { setId?: string; kind?: ItemKind; areaId?: string; areaIds?: Iterable<string> } = {},
): CollectibleItem[] {
  let candidates: CollectibleItem[];
  if (opts.setId) {
    const set = db.sets.get(opts.setId);
    if (!set) throw new Error(`Unknown collectible set: ${opts.setId}.`);
    candidates = set.itemIds
      .map((itemId) => db.items.get(itemId)!)
      .filter((item) => !db.completedItemIds.has(item.id));
  } else {
    candidates = [...db.items.values()].filter(
      (item) => !db.completedItemIds.has(item.id),
    );
  }
  if (opts.kind) candidates = candidates.filter((item) => item.kind === opts.kind);
  if (opts.areaId || opts.areaIds) {
    const areaSet = opts.areaIds
      ? new Set(opts.areaIds)
      : new Set([opts.areaId!]);
    candidates = candidates.filter((item) => {
      if (item.locationId) {
        const hostAreaId = db.locations.get(item.locationId)?.areaId;
        return hostAreaId !== undefined && hostAreaId !== null && areaSet.has(hostAreaId);
      }
      // No location: with a set, the set wins — the item is kept as
      // "no position yet" (§7.2, normative: the area filter applies
      // only to items that HAVE a location in that area). Without a
      // set, the lead's area decides.
      if (opts.setId) return true;
      return item.areaId !== null && areaSet.has(item.areaId);
    });
  }
  return candidates;
}
