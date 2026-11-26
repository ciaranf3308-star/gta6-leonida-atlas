import Dexie, { type Table, type Transaction } from 'dexie';
import { DEFAULT_PREFERENCES } from '../domain/types';
import type {
  Backup,
  Collection,
  ExploredPlace,
  Favorite,
  PersonalMarker,
  Place,
  PlaceNote,
  PlaceTags,
  Preferences,
  UserData,
  VisitedPlace,
} from '../domain/types';
import {
  buildGameDatabase,
  type CompletionRecord,
  type GameDatabase,
  type ReconciliationEntry,
} from '../domain/game-db';
import type { Correction, Enrichment } from '../domain/enrichment';
import type {
  PersonalItemState,
  PersonalMatch,
  ResearchRequest,
  UserScreenshot,
} from '../domain/album';
import type {
  MatcherAttempt,
  MatcherRejection,
} from '../features/ask/card-matcher';
import {
  BACKUP_LIMITS,
  BackupValidationError,
  parseBackup,
  parseCollection,
  parseId,
  parsePersonalMarker,
  parsePreferences,
  parseText,
} from './backup';
import { RESOLVER_VERSION } from '../features/categorise/storage';
import { browserStorage, type StorageLike } from '../features/categorise/storage';
import { parseUserTags } from '../domain/user-tags';
import { COMPLETION_STORAGE_KEY, parseCompletionCounts } from '../features/completion/store';

type PreferencesRecord = { key: 'preferences'; value: Preferences };

/** A draft must be reconciled with the current record before it can be saved. */
export class ConflictError extends Error {
  constructor(
    message = 'This record changed in another tab or import. Review the current version before saving.',
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

function checkRevision(
  current: { updatedAt: string } | undefined,
  expectedUpdatedAt: string | null | undefined,
): void {
  if (expectedUpdatedAt !== undefined && (current?.updatedAt ?? null) !== expectedUpdatedAt) {
    throw new ConflictError();
  }
}

/** Millisecond timestamps also act as revisions, so every local edit must advance them. */
function nextUpdatedAt(previous?: string, proposed = new Date(Date.now()).toISOString()): string {
  if (!previous || proposed > previous) return proposed;
  return new Date(Date.parse(previous) + 1).toISOString();
}
const schemaV1 = {
  favorites: 'placeId',
  notes: 'placeId',
  markers: 'id',
  collections: 'id',
  preferences: 'key',
};
const schemaV2 = {
  favorites: 'placeId, createdAt',
  notes: 'placeId, updatedAt',
  markers: 'id, category, updatedAt',
  collections: 'id, name, updatedAt, *placeIds',
  preferences: 'key',
};
const schemaV3 = {
  favorites: 'placeId, createdAt',
  notes: 'placeId, updatedAt',
  markers: 'id, category, updatedAt',
  collections: 'id, name, updatedAt, *placeIds',
  visited: 'placeId, visitedAt',
  preferences: 'key',
};
/** v4 adds the user's secondary tags (v0.21.0), the explored state
 * (v0.21.0) and the user's own place photos (v0.21.0, device-only —
 * photos are NOT part of UserData or backups: a phone screenshot can
 * be megabytes, and a backup must stay portable). New tables only;
 * existing data is untouched. */
const schemaV4 = {
  ...schemaV3,
  placeTags: 'placeId, updatedAt',
  explored: 'placeId, exploredAt',
  placePhotos: 'placeId, updatedAt',
};

/** v5 (v0.32 step 2) adds the unified gameplay database's write
 * tables (DESIGN §3.4 + addendum §6 step 2). Existing tables are
 * untouched by the upgrade — it only creates empty tables.
 *
 * NOTE on the version number: DESIGN calls this "repository v4", but
 * the repo is already at Dexie version 4 (schemaV4: placeTags,
 * explored, placePhotos, v0.21.0). The new Dexie version is 5; the
 * backup format version stays 3 in this step — backup v4 is step 3's
 * job and must not be conflated with this Dexie version. */
const schemaV5 = {
  ...schemaV4,
  completionRecords: 'id, verb, at, source',
  reconciliation: 'categoryId, at',
  enrichments: 'id, locationId, schemaVersion',
  corrections: 'id, locationId, field, at',
  personalItemState: 'itemId',
  userScreenshots: 'id, at, kind, setId',
  researchRequests: 'id, targetId, status, requestedAt',
};

/** v6 (v0.32 step 7) adds the card matcher's write tables
 * (CARD-MATCHER-DESIGN §2.3 + M4): confirmed matches, attempt
 * fingerprints (the cost rule — a slot is never re-run for unchanged
 * inputs), and rejections. New tables only; existing data untouched. */
const schemaV6 = {
  ...schemaV5,
  cardMatches: 'slotId, hostId, confirmedAt',
  matcherAttempts: 'id, slotId, fingerprint, at',
  matcherRejections: 'id, slotId, hostId',
};

/** A photo the user added himself — his own in-game screenshot, stored
 * on this device only (downscaled to ≤1024px JPEG before saving, so
 * one photo stays small). Never AI-generated, never scraped, never in
 * a backup file. */
export interface PlacePhoto {
  placeId: string;
  /** Downscaled JPEG data URL. */
  dataUrl: string;
  updatedAt: string;
}

async function migrateV1(transaction: Transaction): Promise<void> {
  const [favorites, notes, markers, collections, prefs] = await Promise.all([
    transaction.table('favorites').toArray(),
    transaction.table('notes').toArray(),
    transaction.table('markers').toArray(),
    transaction.table('collections').toArray(),
    transaction.table('preferences').get('preferences'),
  ]);
  const migrated = parseBackup({
    format: 'leonida-atlas',
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites,
    notes,
    markers,
    collections,
    preferences: prefs?.value,
  });
  // An upgrade validation/write failure aborts IndexedDB's versionchange transaction.
  await transaction.table('markers').bulkPut(migrated.markers);
  await transaction.table('favorites').bulkPut(migrated.favorites);
  await transaction.table('notes').bulkPut(migrated.notes);
  await transaction.table('collections').bulkPut(migrated.collections);
  await transaction.table('preferences').put({ key: 'preferences', value: migrated.preferences });
}

function mergeNewest<T extends { updatedAt: string }>(
  local: T[],
  imported: T[],
  getId: (item: T) => string,
): T[] {
  const merged = new Map(local.map((item) => [getId(item), item]));
  for (const item of imported) {
    const previous = merged.get(getId(item));
    if (!previous || item.updatedAt > previous.updatedAt) merged.set(getId(item), item);
  }
  return [...merged.values()];
}

export class AtlasDatabase extends Dexie {
  declare favorites: Table<Favorite, string>;
  declare notes: Table<PlaceNote, string>;
  declare placeTags: Table<PlaceTags, string>;
  declare markers: Table<PersonalMarker, string>;
  declare collections: Table<Collection, string>;
  declare visited: Table<VisitedPlace, string>;
  declare explored: Table<ExploredPlace, string>;
  declare placePhotos: Table<PlacePhoto, string>;
  declare preferences: Table<PreferencesRecord, string>;
  /** The one completion log (DESIGN §3.4) — every surface derives from it. */
  declare completionRecords: Table<CompletionRecord, string>;
  /** Manual tallies typed from the in-game Progress screen (§4.3). */
  declare reconciliation: Table<ReconciliationEntry, string>;
  /** On-demand building intelligence (addendum §2) — empty until step 5. */
  declare enrichments: Table<Enrichment, string>;
  /** Player corrections (addendum §2.6) — empty until step 5. */
  declare corrections: Table<Correction, string>;
  /** Sold state per item (addendum §3.4) — written by recordSale. */
  declare personalItemState: Table<PersonalItemState, string>;
  /** Player screenshot uploads (addendum §3.5) — empty until step 7. */
  declare userScreenshots: Table<UserScreenshot, string>;
  /** Research-when-missing queue (addendum §5.3) — empty until step 7. */
  declare researchRequests: Table<ResearchRequest, string>;
  /** Player-confirmed card matches (CARD-MATCHER-DESIGN §2.3) — one
   * row per slot; a confirmed match pins the slot to its host. */
  declare cardMatches: Table<PersonalMatch, string>;
  /** Matcher attempts, keyed `${slotId}::${fingerprint}` — the
   * fingerprint rule lives here (never re-pay for unchanged inputs). */
  declare matcherAttempts: Table<MatcherAttempt, string>;
  /** Rejected (slot, host) pairs (M4) — never re-proposed. */
  declare matcherRejections: Table<MatcherRejection, string>;

  constructor(name = 'leonida-atlas') {
    super(name);
    this.version(1).stores(schemaV1);
    this.version(2).stores(schemaV2).upgrade(migrateV1);
    // v3 adds the visited (found) table only; existing data is untouched.
    this.version(3).stores(schemaV3);
    // v4 adds placeTags, explored and placePhotos; existing data untouched.
    this.version(4).stores(schemaV4);
    // v5 adds the v0.32 write tables only; existing data is untouched.
    // The v3 → v4 data migration does NOT run here (see
    // migrateV3CompletionData below): the versionchange transaction has
    // no catalogue — the snapshot is fetched at runtime — so it cannot
    // classify a visited row (card vs lootable vs plain location).
    this.version(5).stores(schemaV5);
    // v6 adds the card matcher tables only; existing data is untouched.
    this.version(6).stores(schemaV6);
  }

  private async snapshot(): Promise<UserData> {
    const [favorites, notes, placeTags, markers, collections, visited, explored, preferences] =
      await Promise.all([
        this.favorites.toArray(),
        this.notes.toArray(),
        this.placeTags.toArray(),
        this.markers.toArray(),
        this.collections.toArray(),
        this.visited.toArray(),
        this.explored.toArray(),
        this.preferences.get('preferences'),
      ]);
    return {
      favorites,
      notes,
      placeTags,
      markers,
      collections,
      visited,
      explored,
      preferences: preferences?.value ?? { ...DEFAULT_PREFERENCES },
    };
  }

  async load(): Promise<UserData> {
    return this.transaction('r', this.tables, () => this.snapshot());
  }

  /** The completion log + manual tallies, as stored. Read-only: the
   * only writers are recordCompletion / recordReconciliation / the v3
   * migration (and, from step 3, the backup import). */
  async loadCompletion(): Promise<{
    records: CompletionRecord[];
    reconciliation: ReconciliationEntry[];
  }> {
    const [records, reconciliation] = await Promise.all([
      this.completionRecords.toArray(),
      this.reconciliation.toArray(),
    ]);
    return { records, reconciliation };
  }

  /**
   * Write one manual tally (v0.32 step 6, DESIGN §4.2: one number per
   * counts-only category, with the in-game counter as the source).
   * The caller (recordReconciliation) validates the category and the
   * range and runs the v3 migration first, so a stale tallies key can
   * never overwrite this entry afterwards. The write is persist-first
   * with a read-back check inside the transaction: a failed write
   * throws and leaves the old entry in place.
   */
  async saveReconciliationEntry(entry: ReconciliationEntry): Promise<void> {
    await this.transaction('rw', this.reconciliation, async () => {
      await this.reconciliation.put(entry);
      const readBack = await this.reconciliation.get(entry.categoryId);
      if (!readBack || readBack.count !== entry.count || readBack.at !== entry.at) {
        throw new Error('The reconciliation entry did not read back after writing.');
      }
    });
  }

  /** Sold state for every item the player has sold (addendum §3.4).
   * A row with soldAt null is a sale that was undone — the audit
   * trail, not a missing row. */
  async loadPersonalItemStates(): Promise<PersonalItemState[]> {
    return this.personalItemState.toArray();
  }

  async getPersonalItemState(itemId: string): Promise<PersonalItemState | undefined> {
    return this.personalItemState.get(itemId);
  }

  /** Player-confirmed card matches (CARD-MATCHER-DESIGN §2.3) — one
   * row per slot, keyed by slotId. */
  async loadCardMatches(): Promise<PersonalMatch[]> {
    return this.cardMatches.toArray();
  }

  async saveCardMatch(match: PersonalMatch): Promise<void> {
    await this.cardMatches.put(match);
  }

  async deleteCardMatch(slotId: string): Promise<void> {
    await this.cardMatches.delete(slotId);
  }

  /** Matcher attempts, keyed `${slotId}::${fingerprint}`. */
  async loadMatcherAttempts(): Promise<MatcherAttempt[]> {
    return this.matcherAttempts.toArray();
  }

  async saveMatcherAttempts(attempts: readonly MatcherAttempt[]): Promise<void> {
    if (attempts.length > 0) await this.matcherAttempts.bulkPut([...attempts]);
  }

  /** Rejected (slot, host) pairs (M4), keyed `${slotId}::${hostId}`. */
  async loadMatcherRejections(): Promise<MatcherRejection[]> {
    return this.matcherRejections.toArray();
  }

  async saveMatcherRejection(rejection: MatcherRejection): Promise<void> {
    await this.matcherRejections.put(rejection);
  }

  private async requirePlace(id: string): Promise<void> {
    if (id.startsWith('custom:') && !(await this.markers.get(id))) {
      throw new BackupValidationError(`reference contains missing personal marker ${id}`);
    }
  }

  private async checkCapacity<T>(table: Table<T, string>, id: string): Promise<void> {
    if (!(await table.get(id)) && (await table.count()) >= BACKUP_LIMITS.items) {
      throw new BackupValidationError(
        `${table.name} exceeds the limit of ${BACKUP_LIMITS.items} items`,
      );
    }
  }

  private async ensureRestorable(): Promise<void> {
    // Called inside the write transaction so exceeding backup limits rolls it back.
    parseBackup({
      ...(await this.snapshot()),
      format: 'leonida-atlas',
      version: 3,
      exportedAt: new Date().toISOString(),
    });
  }

  async toggleFavorite(placeId: string): Promise<void> {
    const id = parseId(placeId, 'placeId');
    await this.transaction('rw', this.tables, async () => {
      if (await this.favorites.get(id)) await this.favorites.delete(id);
      else {
        await this.requirePlace(id);
        await this.checkCapacity(this.favorites, id);
        await this.favorites.put({ placeId: id, createdAt: new Date().toISOString() });
        await this.ensureRestorable();
      }
    });
  }

  /** Mark a place as found (or unmark it). Found state is local-only progress. */
  async toggleVisited(placeId: string): Promise<void> {
    const id = parseId(placeId, 'placeId');
    await this.transaction('rw', this.tables, async () => {
      if (await this.visited.get(id)) await this.visited.delete(id);
      else {
        await this.requirePlace(id);
        await this.checkCapacity(this.visited, id);
        await this.visited.put({ placeId: id, visitedAt: new Date().toISOString() });
        await this.ensureRestorable();
      }
    });
  }

  /** Mark a place as explored (or unmark it). Explored is separate
   * from found: found is "got the thing", explored is "been here". */
  async toggleExplored(placeId: string): Promise<void> {
    const id = parseId(placeId, 'placeId');
    await this.transaction('rw', this.tables, async () => {
      if (await this.explored.get(id)) await this.explored.delete(id);
      else {
        await this.requirePlace(id);
        await this.checkCapacity(this.explored, id);
        await this.explored.put({ placeId: id, exploredAt: new Date().toISOString() });
        await this.ensureRestorable();
      }
    });
  }

  /** Replace the user's secondary tags on a place. An empty list
   * removes the row. Tags go through parseUserTags (the same rules as
   * the card's Add-a-tag box) so a stored row is always restorable. */
  async savePlaceTags(placeId: string, tags: string[]): Promise<void> {
    const id = parseId(placeId, 'placeId');
    const clean = parseUserTags(tags.join(', '));
    await this.transaction('rw', this.tables, async () => {
      if (clean.length === 0) {
        await this.placeTags.delete(id);
        return;
      }
      await this.requirePlace(id);
      await this.checkCapacity(this.placeTags, id);
      const current = await this.placeTags.get(id);
      await this.placeTags.put({
        placeId: id,
        tags: clean,
        updatedAt: nextUpdatedAt(current?.updatedAt),
      });
      await this.ensureRestorable();
    });
  }

  /** The user's own photo for a place, if they added one. Device-only:
   * photos are never in backups or UserData. */
  async getPlacePhoto(placeId: string): Promise<PlacePhoto | undefined> {
    return this.placePhotos.get(parseId(placeId, 'placeId'));
  }

  async savePlacePhoto(placeId: string, dataUrl: string): Promise<void> {
    const id = parseId(placeId, 'placeId');
    if (!dataUrl.startsWith('data:image/jpeg;base64,') || dataUrl.length > 1_500_000) {
      throw new BackupValidationError('place photo must be a downscaled JPEG under 1.5 MB');
    }
    await this.transaction('rw', this.placePhotos, async () => {
      const current = await this.placePhotos.get(id);
      await this.placePhotos.put({
        placeId: id,
        dataUrl,
        updatedAt: nextUpdatedAt(current?.updatedAt),
      });
    });
  }

  async deletePlacePhoto(placeId: string): Promise<void> {
    await this.placePhotos.delete(parseId(placeId, 'placeId'));
  }

  async saveNote(placeId: string, text: string, expectedUpdatedAt?: string | null): Promise<void> {
    const id = parseId(placeId, 'placeId');
    const value = parseText(text, 'note.text', BACKUP_LIMITS.note);
    await this.transaction('rw', this.tables, async () => {
      const current = await this.notes.get(id);
      checkRevision(current, expectedUpdatedAt);
      if (!value.trim()) await this.notes.delete(id);
      else {
        await this.requirePlace(id);
        await this.checkCapacity(this.notes, id);
        await this.notes.put({
          placeId: id,
          text: value,
          updatedAt: nextUpdatedAt(current?.updatedAt),
        });
        await this.ensureRestorable();
      }
    });
  }

  async saveMarker(marker: PersonalMarker, expectedUpdatedAt?: string | null): Promise<void> {
    const value = parsePersonalMarker(marker);
    await this.transaction('rw', this.tables, async () => {
      const current = await this.markers.get(value.id);
      checkRevision(current, expectedUpdatedAt);
      await this.checkCapacity(this.markers, value.id);
      await this.markers.put({
        ...value,
        updatedAt: nextUpdatedAt(current?.updatedAt, value.updatedAt),
      });
      await this.ensureRestorable();
    });
  }

  async deleteMarker(
    id: string,
    expectedMarkerUpdatedAt: string,
    expectedNoteUpdatedAt: string | null,
  ): Promise<void> {
    const markerId = parseId(id, 'marker.id', true);
    await this.transaction(
      'rw',
      [this.markers, this.favorites, this.notes, this.placeTags, this.visited, this.explored, this.placePhotos, this.collections],
      async () => {
        checkRevision(await this.markers.get(markerId), expectedMarkerUpdatedAt);
        checkRevision(await this.notes.get(markerId), expectedNoteUpdatedAt);
        await this.markers.delete(markerId);
        await this.favorites.delete(markerId);
        await this.notes.delete(markerId);
        await this.placeTags.delete(markerId);
        await this.visited.delete(markerId);
        await this.explored.delete(markerId);
        await this.placePhotos.delete(markerId);
        await this.collections
          .where('placeIds')
          .equals(markerId)
          .modify((collection) => {
            collection.placeIds = collection.placeIds.filter((placeId) => placeId !== markerId);
            collection.updatedAt = nextUpdatedAt(collection.updatedAt);
          });
      },
    );
  }

  /** Complete drafts should carry a revision; field edits use the transactional methods below. */
  async saveCollection(collection: Collection, expectedUpdatedAt?: string | null): Promise<void> {
    const value = parseCollection(collection);
    await this.transaction('rw', this.tables, async () => {
      const current = await this.collections.get(value.id);
      checkRevision(current, expectedUpdatedAt);
      await this.checkCapacity(this.collections, value.id);
      for (const id of value.placeIds) await this.requirePlace(id);
      await this.collections.put({
        ...value,
        updatedAt: nextUpdatedAt(current?.updatedAt, value.updatedAt),
      });
      await this.ensureRestorable();
    });
  }

  private async updateCollection(
    id: string,
    update: (current: Collection) => Collection,
  ): Promise<void> {
    const collectionId = parseId(id, 'collection.id');
    await this.transaction('rw', this.tables, async () => {
      const current = await this.collections.get(collectionId);
      if (!current)
        throw new ConflictError(
          'This collection was deleted. Create a new collection to continue.',
        );
      const value = parseCollection({
        ...update(current),
        updatedAt: nextUpdatedAt(current.updatedAt),
      });
      for (const placeId of value.placeIds) await this.requirePlace(placeId);
      await this.collections.put(value);
      await this.ensureRestorable();
    });
  }

  async addCollectionPlace(id: string, placeId: string): Promise<void> {
    const value = parseId(placeId, 'placeId');
    await this.updateCollection(id, (current) => ({
      ...current,
      placeIds: [...new Set([...current.placeIds, value])],
    }));
  }

  async removeCollectionPlace(id: string, placeId: string): Promise<void> {
    const value = parseId(placeId, 'placeId');
    await this.updateCollection(id, (current) => ({
      ...current,
      placeIds: current.placeIds.filter((member) => member !== value),
    }));
  }

  async renameCollection(id: string, name: string): Promise<void> {
    const value = parseText(name, 'collection.name', BACKUP_LIMITS.title, true);
    await this.updateCollection(id, (current) => ({ ...current, name: value }));
  }

  async deleteCollection(id: string): Promise<void> {
    await this.collections.delete(parseId(id, 'collection.id'));
  }

  async savePreferences(prefs: Preferences): Promise<void> {
    const value = parsePreferences(prefs);
    await this.transaction('rw', this.tables, async () => {
      await this.preferences.put({ key: 'preferences', value });
      await this.ensureRestorable();
    });
  }

  async exportBackup(): Promise<Backup> {
    // The AI index lives in localStorage, not in this database — the
    // store layer (exportWorkspaceBackup) fills aiCategories and
    // aiIndexJob from the live index before the file is written, so a
    // direct database export honestly reports an empty index here.
    return parseBackup({
      ...(await this.load()),
      format: 'leonida-atlas',
      version: 3,
      exportedAt: new Date().toISOString(),
      aiCategories: [],
      aiIndexJob: {
        status: 'idle',
        attemptedPlaceIds: [],
        resolverVersion: RESOLVER_VERSION,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  async importBackup(input: unknown): Promise<void> {
    const imported = parseBackup(input);
    await this.transaction('rw', this.tables, async () => {
      const local = await this.snapshot();
      const favorites = new Map(local.favorites.map((item) => [item.placeId, item]));
      for (const item of imported.favorites) {
        const previous = favorites.get(item.placeId);
        if (!previous || item.createdAt < previous.createdAt) favorites.set(item.placeId, item);
      }
      // Import deliberately merges newer revisions; open editor drafts must use compare-and-set
      // saves so a restored revision cannot later be replaced by stale component state.
      // Check merged limits and relationships before writing, including local data.
      const merged = parseBackup({
        ...imported,
        favorites: [...favorites.values()],
        markers: mergeNewest(local.markers, imported.markers, (item) => item.id),
        notes: mergeNewest(local.notes, imported.notes, (item) => item.placeId),
        placeTags: mergeNewest(local.placeTags, imported.placeTags, (item) => item.placeId),
        collections: mergeNewest(local.collections, imported.collections, (item) => item.id),
        visited: mergeNewest(
          local.visited.map((item) => ({ ...item, updatedAt: item.visitedAt })),
          imported.visited.map((item) => ({ ...item, updatedAt: item.visitedAt })),
          (item) => item.placeId,
        ).map(({ placeId, visitedAt }) => ({ placeId, visitedAt })),
        explored: mergeNewest(
          local.explored.map((item) => ({ ...item, updatedAt: item.exploredAt })),
          imported.explored.map((item) => ({ ...item, updatedAt: item.exploredAt })),
          (item) => item.placeId,
        ).map(({ placeId, exploredAt }) => ({ placeId, exploredAt })),
      });
      await this.markers.bulkPut(merged.markers);
      await this.favorites.bulkPut(merged.favorites);
      await this.notes.bulkPut(merged.notes);
      await this.placeTags.bulkPut(merged.placeTags);
      await this.collections.bulkPut(merged.collections);
      await this.visited.bulkPut(merged.visited);
      await this.explored.bulkPut(merged.explored);
      await this.preferences.put({ key: 'preferences', value: merged.preferences });
    });
  }

  async requestPersistence(): Promise<boolean> {
    if (typeof navigator === 'undefined' || typeof navigator.storage?.persist !== 'function')
      return false;
    return navigator.storage.persist();
  }
}

// ---------------------------------------------------------------------------
// v3 → v4 completion migration (DESIGN §5, v0.32 step 2)
// ---------------------------------------------------------------------------

/**
 * Why this is a load-time migration, not a Dexie versionchange upgrade
 * — a deliberate deviation from DESIGN §5's "inside the existing Dexie
 * upgrade transaction", recorded here so the coordinator can rule on
 * it rather than discover it:
 *
 * The §5 verb classification needs the built GameDatabase: a visited
 * `card:vicki` is `collected` only via `legacyItemIds`, and a visited
 * GTADB shop is `looted` only when `opportunitiesForLocation` yields
 * a repeatable opportunity for it — both need the catalogue, and the
 * catalogue snapshot is fetched at runtime (`loadCatalogue`), so it
 * does not exist inside a versionchange transaction. A migration run
 * there could only classify by id prefix and would silently demote
 * every looted shop / break-in house to `discovered`. Instead this
 * follows the pattern DESIGN §5 itself cites — the v0.30 AI-index
 * migration (`src/db/ai-index.ts`, `migrateAiIndexFromLocalStorage`):
 * read the old shapes, write the new shapes in ONE Dexie transaction,
 * verify counts by reading back inside that transaction, and only
 * then remove the old key. The v5 upgrade above only creates the
 * empty tables, so the migration can run any time after the database
 * opens — the first completion write (`recordCompletion`) runs it
 * first, and step 5/6 wires an explicit call on startup.
 *
 * The old tables stay intact afterwards (audit trail + the old UI
 * reads them until step 6 replaces the panel). The migration is
 * idempotent: record ids are deterministic
 * (`rec:mig:visited:<placeId>`), reconciliation rows are keyed by
 * category, and writes are put-only — a re-run overwrites identical
 * rows and never duplicates, so a v3 backup imported AFTER the first
 * migration (step 3) is picked up by the next `ensureCompletionMigration`
 * pass instead of being stranded.
 */

export const COMPLETION_MIGRATION_LOG_KEY = 'leonida-completion-migration-v1';

/** What one migration run did. Stored under COMPLETION_MIGRATION_LOG_KEY. */
export interface CompletionMigrationLog {
  migratedAt: string; // ISO UTC — also the reconciliation entries' `at`
  visitedRows: number;
  /** Completion records created from visited rows (== visitedRows:
   * the §5 verification "visited count == completion records
   * created"). Explored rows are counted separately below. */
  completionRecordsCreated: number;
  exploredRows: number;
  exploredRecordsCreated: number;
  /** Non-zero tally categories read from leonida-completion-v1. */
  tallyCategories: number;
  reconciliationEntries: number;
  /** Visited rows whose target no longer exists — kept as `discovered`
   * records on the id string, never dropped (DESIGN §5). */
  unknownVisitedTargets: number;
  /** The tallies key carries no timestamp, so `at` is the migration
   * time — stated here, never invented (DESIGN §5). */
  talliesTimestampNote: string;
  source: 'v3-visited-explored-tallies';
}

export class CompletionMigrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompletionMigrationError';
  }
}

/** The last migration failure, if any — the banner hook for the UI
 * (a later step reads this + getCompletionMigrationStatus and offers
 * a retry, which is just calling migrateV3CompletionData again). */
let lastCompletionMigrationError: string | null = null;

export function getCompletionMigrationLog(
  storage: StorageLike | null = browserStorage(),
): CompletionMigrationLog | null {
  if (!storage) return null;
  const raw = storage.getItem(COMPLETION_MIGRATION_LOG_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as CompletionMigrationLog;
  } catch {
    return null;
  }
}

/** Migrated yet, and what the last attempt did or failed with. */
export function getCompletionMigrationStatus(
  storage: StorageLike | null = browserStorage(),
): {
  migrated: boolean;
  log: CompletionMigrationLog | null;
  lastError: string | null;
} {
  const log = getCompletionMigrationLog(storage);
  return { migrated: log !== null, log, lastError: lastCompletionMigrationError };
}

const MIGRATION_TALLIES_NOTE =
  'leonida-completion-v1 carries no timestamp; reconciliation `at` is the migration time, not the time the counts were typed.';

/** Repeatable-opportunity priority when a visited location has more
 * than one (only 4 catalogue locations do — L2380–L2383, each a
 * robbery-shop AND a break-in; the shop hold-up wins because the
 * place is first a shop). A bank-job can never co-occur with the
 * others on one location. */
const LOOTED_OPPORTUNITY_PRIORITY = ['bank-job', 'robbery-shop', 'break-in', 'gang-op'] as const;

function completionRecordForVisited(
  placeId: string,
  visitedAt: string,
  db: GameDatabase,
): { record: CompletionRecord; unknownTarget: boolean } {
  const id = `rec:mig:visited:${placeId}`;
  const legacyItemId = db.legacyItemIds.get(placeId);
  if (legacyItemId) {
    return {
      record: {
        id,
        target: { type: 'item', id: legacyItemId },
        verb: 'collected',
        count: 1,
        at: visitedAt,
        source: 'import',
      },
      unknownTarget: false,
    };
  }
  if (db.items.has(placeId)) {
    // A loot non-card item (meditation, magazine, watch, scan) whose
    // id IS the item id — collected, not discovered.
    return {
      record: {
        id,
        target: { type: 'item', id: placeId },
        verb: 'collected',
        count: 1,
        at: visitedAt,
        source: 'import',
      },
      unknownTarget: false,
    };
  }
  const opportunities = db.opportunitiesByLocation.get(placeId) ?? [];
  const repeatable = opportunities.filter((opp) => opp.repeatable);
  if (repeatable.length > 0) {
    repeatable.sort(
      (a, b) =>
        LOOTED_OPPORTUNITY_PRIORITY.indexOf(
          a.kind as (typeof LOOTED_OPPORTUNITY_PRIORITY)[number],
        ) -
        LOOTED_OPPORTUNITY_PRIORITY.indexOf(
          b.kind as (typeof LOOTED_OPPORTUNITY_PRIORITY)[number],
        ),
    );
    return {
      record: {
        id,
        target: { type: 'opportunity', id: repeatable[0]!.id },
        verb: 'looted',
        count: 1,
        at: visitedAt,
        source: 'import',
      },
      unknownTarget: false,
    };
  }
  // Anything else — including a visited row whose target no longer
  // exists — is kept as a `discovered` record on the id string. The
  // id is the audit trail; dropping the row would lose the fact that
  // the player marked something found.
  return {
    record: {
      id,
      target: { type: 'location', id: placeId },
      verb: 'discovered',
      count: 1,
      at: visitedAt,
      source: 'import',
    },
    unknownTarget: !db.locations.has(placeId),
  };
}

function completionRecordForExplored(
  placeId: string,
  exploredAt: string,
  db: GameDatabase,
): CompletionRecord {
  let targetId = placeId;
  const legacyItemId = db.legacyItemIds.get(placeId);
  const item = legacyItemId ? db.items.get(legacyItemId) : db.items.get(placeId);
  if (item?.locationId) targetId = item.locationId;
  return {
    id: `rec:mig:explored:${placeId}`,
    target: { type: 'location', id: targetId },
    verb: 'explored',
    count: 1,
    at: exploredAt,
    source: 'import',
  };
}

export interface CompletionMigrationResult {
  log: CompletionMigrationLog;
}

/**
 * Migrate v3 completion state into the v4 log. `places` is the loaded
 * catalogue (the same array `buildGameDatabase` takes); `storage` is
 * the localStorage-like holding `leonida-completion-v1` (defaults to
 * the browser's — pass an in-memory store in tests).
 *
 * One Dexie transaction writes completionRecords + reconciliation and
 * verifies by reading the written ids back inside that transaction;
 * a mismatch aborts the transaction, the tallies key stays, and a
 * CompletionMigrationError is thrown. Only after the commit verifies
 * is the tallies key deleted and the log written. Markers, notes,
 * user tags, favorites, collections, preferences and aiCategories
 * are preserved as-is (aiCategories live in the separate AI-index
 * database and are untouched here); layer visibility is NOT migrated
 * (reset — first launch all filters off, DESIGN §5).
 */
export async function migrateV3CompletionData(
  db: AtlasDatabase,
  places: readonly Place[],
  storage: StorageLike | null = browserStorage(),
): Promise<CompletionMigrationResult> {
  const migratedAt = new Date().toISOString();
  try {
    const log = await db.transaction(
      'rw',
      [
        db.favorites,
        db.notes,
        db.placeTags,
        db.markers,
        db.collections,
        db.visited,
        db.explored,
        db.preferences,
        db.completionRecords,
        db.reconciliation,
      ],
      async () => {
        const [favorites, notes, placeTags, markers, collections, visited, explored, prefs] =
          await Promise.all([
            db.favorites.toArray(),
            db.notes.toArray(),
            db.placeTags.toArray(),
            db.markers.toArray(),
            db.collections.toArray(),
            db.visited.toArray(),
            db.explored.toArray(),
            db.preferences.get('preferences'),
          ]);
        const user: UserData = {
          favorites,
          notes,
          placeTags,
          markers,
          collections,
          visited,
          explored,
          preferences: prefs?.value ?? { ...DEFAULT_PREFERENCES },
        };
        const gameDb = buildGameDatabase({ places, user });
        const records: CompletionRecord[] = [];
        let unknownVisitedTargets = 0;
        for (const row of visited) {
          const { record, unknownTarget } = completionRecordForVisited(
            row.placeId,
            row.visitedAt,
            gameDb,
          );
          if (unknownTarget) unknownVisitedTargets += 1;
          records.push(record);
        }
        for (const row of explored) {
          records.push(completionRecordForExplored(row.placeId, row.exploredAt, gameDb));
        }
        // Tallies: one ReconciliationEntry per non-zero category, basis
        // 'game-stat', at = migration time (the key carries no timestamp).
        const tallies = parseCompletionCounts(
          storage?.getItem(COMPLETION_STORAGE_KEY) ?? null,
        );
        const entries: ReconciliationEntry[] = Object.entries(tallies)
          .filter(([, count]) => count !== 0)
          .map(([categoryId, count]) => ({
            categoryId,
            count,
            basis: 'game-stat' as const,
            at: migratedAt,
          }));
        await db.completionRecords.bulkPut(records);
        await db.reconciliation.bulkPut(entries);
        // Verify inside the transaction: every written id reads back.
        const readBackRecords = await db.completionRecords.bulkGet(records.map((r) => r.id));
        const readBackEntries = await db.reconciliation.bulkGet(
          entries.map((e) => e.categoryId),
        );
        if (
          readBackRecords.some((row) => row === undefined) ||
          readBackEntries.some((row) => row === undefined)
        ) {
          throw new CompletionMigrationError(
            `Migration verification failed: wrote ${records.length} completion records and ${entries.length} reconciliation entries, but not all read back.`,
          );
        }
        return {
          migratedAt,
          visitedRows: visited.length,
          completionRecordsCreated: visited.length,
          exploredRows: explored.length,
          exploredRecordsCreated: explored.length,
          tallyCategories: entries.length,
          reconciliationEntries: entries.length,
          unknownVisitedTargets,
          talliesTimestampNote: MIGRATION_TALLIES_NOTE,
          source: 'v3-visited-explored-tallies' as const,
        } satisfies CompletionMigrationLog;
      },
    );
    // The commit verified. Only now may the old key go.
    try {
      storage?.removeItem?.(COMPLETION_STORAGE_KEY);
    } catch {
      // The tallies are already safe in reconciliation; a key that
      // cannot be removed just means the next pass re-runs a no-op.
    }
    try {
      storage?.setItem(COMPLETION_MIGRATION_LOG_KEY, JSON.stringify(log));
    } catch {
      // The log is informational; the migration itself is done.
    }
    lastCompletionMigrationError = null;
    return { log };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown migration error.';
    lastCompletionMigrationError = message;
    throw error instanceof CompletionMigrationError
      ? error
      : new CompletionMigrationError(
          `Completion migration failed — old data is untouched: ${message}`,
        );
  }
}

/**
 * True when a migration pass would change anything: the tallies key
 * is still present, or a visited/explored row has no migration record
 * yet (e.g. a v3 backup imported after the first pass, or a mark made
 * through the old UI, which keeps writing visited/explored until
 * step 6 replaces it). Cheap: one bulkGet over the deterministic ids.
 */
export async function completionMigrationNeeded(db: AtlasDatabase): Promise<boolean> {
  const [visited, explored] = await Promise.all([
    db.visited.toArray(),
    db.explored.toArray(),
  ]);
  const ids = [
    ...visited.map((row) => `rec:mig:visited:${row.placeId}`),
    ...explored.map((row) => `rec:mig:explored:${row.placeId}`),
  ];
  if (ids.length > 0) {
    const present = await db.completionRecords.bulkGet(ids);
    if (present.some((row) => row === undefined)) return true;
  }
  return false;
}

/** Run the migration only if it would change anything. Returns null
 * when there was nothing to do. */
export async function ensureCompletionMigration(
  db: AtlasDatabase,
  places: readonly Place[],
  storage: StorageLike | null = browserStorage(),
): Promise<CompletionMigrationResult | null> {
  const talliesPresent = storage?.getItem(COMPLETION_STORAGE_KEY) != null;
  if (!talliesPresent && !(await completionMigrationNeeded(db))) return null;
  return migrateV3CompletionData(db, places, storage);
}

// A live binding lets existing local operations use the selected namespace.
// Only the store's serialized workspace transition may replace it.
export let atlasRepository = new AtlasDatabase();
export function replaceAtlasRepository(repository: AtlasDatabase): void {
  atlasRepository = repository;
}

export function workspaceDatabaseName(workspaceId: string | null): string {
  if (workspaceId === null) return 'leonida-atlas';
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(workspaceId)) throw new Error('Invalid workspace identifier.');
  return `leonida-atlas-workspace-${workspaceId}`;
}
