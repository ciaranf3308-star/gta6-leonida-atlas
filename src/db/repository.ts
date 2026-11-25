import Dexie, { type Table, type Transaction } from 'dexie';
import { DEFAULT_PREFERENCES } from '../domain/types';
import type {
  Backup,
  Collection,
  ExploredPlace,
  Favorite,
  PersonalMarker,
  PlaceNote,
  PlaceTags,
  Preferences,
  UserData,
  VisitedPlace,
} from '../domain/types';
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
import { parseUserTags } from '../domain/user-tags';

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

  constructor(name = 'leonida-atlas') {
    super(name);
    this.version(1).stores(schemaV1);
    this.version(2).stores(schemaV2).upgrade(migrateV1);
    // v3 adds the visited (found) table only; existing data is untouched.
    this.version(3).stores(schemaV3);
    // v4 adds placeTags, explored and placePhotos; existing data untouched.
    this.version(4).stores(schemaV4);
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
