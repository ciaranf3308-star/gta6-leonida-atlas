import { DEFAULT_PREFERENCES, migrateLegacyCategory } from '../domain/types';
import type {
  Backup,
  Category,
  Collection,
  ExploredPlace,
  Favorite,
  PersonalMarker,
  PlaceNote,
  PlaceTags,
  Preferences,
  VisitedPlace,
} from '../domain/types';
import { parseUserTags } from '../domain/user-tags';
import { CANONICAL_BOUNDS } from '../features/street-leonida/leonida-coordinates';
import {
  AI_CATEGORIES,
  type AiCategoryId,
  type AiCategoryRecord,
  type AiCategoryStatus,
  type ResolutionSource,
} from '../features/categorise/categories';
import type { CompletionRecord, ReconciliationEntry } from '../domain/game-db';
import type { Correction, Enrichment, EnrichmentFieldKind } from '../domain/enrichment';
import type { PersonalItemState } from '../domain/album';
import {
  EMPTY_INDEX_JOB,
  RESOLVER_VERSION,
  type IndexJobState,
  type IndexJobStatus,
} from '../features/categorise/storage';

/** The file picker should check this before reading or JSON-parsing a file. */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const BACKUP_LIMITS = Object.freeze({
  items: 10_000,
  title: 200,
  description: 20_000,
  note: 100_000,
  id: 128,
});

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(`Invalid Atlas backup: ${message}`);
    this.name = 'BackupValidationError';
  }
}

function invalid(path: string, requirement: string): never {
  throw new BackupValidationError(`${path} ${requirement}`);
}

function record(input: unknown, path: string): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input))
    invalid(path, 'must be an object');
  return input as Record<string, unknown>;
}

function list(input: unknown, path: string): unknown[] {
  if (!Array.isArray(input)) invalid(path, 'must be an array');
  if (input.length > BACKUP_LIMITS.items)
    invalid(path, `exceeds the limit of ${BACKUP_LIMITS.items} items`);
  return input;
}

export function parseText(input: unknown, path: string, max: number, required = false): string {
  if (typeof input !== 'string') invalid(path, 'must be text');
  if (input.length > max) invalid(path, `exceeds the limit of ${max} characters`);
  if (required && !input.trim()) invalid(path, 'must not be empty');
  return input;
}

export function parseId(input: unknown, path = 'id', personal = false): string {
  const id = parseText(input, path, BACKUP_LIMITS.id, true);
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9:_-]*$/.test(id) ||
    ['constructor', 'prototype', '__proto__'].includes(id)
  ) {
    invalid(
      path,
      'must be a safe identifier using letters, numbers, colons, underscores or hyphens',
    );
  }
  if ((personal || id.startsWith('custom:')) && !/^custom:[a-zA-Z0-9][a-zA-Z0-9:_-]*$/.test(id)) {
    invalid(path, 'must start with custom: followed by a safe identifier');
  }
  return id;
}

function timestamp(input: unknown, path: string): string {
  if (
    typeof input !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(input)
  ) {
    invalid(path, 'must be an ISO UTC timestamp');
  }
  const milliseconds = Date.parse(input);
  if (!Number.isFinite(milliseconds)) invalid(path, 'must be a valid timestamp');
  const normalized = new Date(milliseconds).toISOString();
  if (normalized.slice(0, 19) !== input.slice(0, 19))
    invalid(path, 'must be a valid calendar date');
  return normalized;
}

function unique<T>(items: T[], key: (item: T) => string, path: string): T[] {
  const seen = new Set<string>();
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) invalid(path, `contains duplicate id ${id}`);
    seen.add(id);
  }
  return items;
}

export function parsePreferences(input: unknown, legacy = false): Preferences {
  const item = record(input === undefined && legacy ? {} : input, 'preferences');
  const boolean = (key: keyof Preferences): boolean => {
    const value = item[key] === undefined && legacy ? DEFAULT_PREFERENCES[key] : item[key];
    if (typeof value !== 'boolean') invalid(`preferences.${key}`, 'must be a boolean');
    return value;
  };
  return {
    reducedMotion: boolean('reducedMotion'),
    showLabels: boolean('showLabels'),
    clusterMarkers: boolean('clusterMarkers'),
  };
}

export const MARKER_COLORS = Object.freeze([
  '#c9a9ef',
  '#73cbbb',
  '#f2d897',
  '#ff8a5c',
  '#ff5c7a',
  '#6ea8ff',
  '#8be07a',
] as const);

function parseMarkerColor(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  if (typeof input !== 'string' || !(MARKER_COLORS as readonly string[]).includes(input))
    invalid('marker.color', 'is unsupported');
  return input;
}

export function parsePersonalMarker(
  input: unknown,
  path = 'marker',
  legacyTime?: string,
): PersonalMarker {
  const item = record(input, path);
  const position = record(item.position, `${path}.position`);
  const coordinate = (axis: 'x' | 'y', min: number, max: number): number => {
    const value = position[axis];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      invalid(
        `${path}.position.${axis}`,
        `must be a finite coordinate within map bounds [${min}, ${max}]`,
      );
    }
    return value;
  };
  // Markers are My markers (v0.21.0): a missing category on a legacy
  // backup defaults to 'my-markers', a legacy 'personal' on a marker
  // is a My marker (a user marker is never the game's Personal), and a
  // pre-rebuild category (region / landmark / nature / transport /
  // business) migrates instead of failing the restore.
  const rawCategory =
    item.category === undefined && legacyTime ? 'my-markers' : item.category;
  const category =
    rawCategory === 'personal' ? 'my-markers' : migrateLegacyCategory(rawCategory);
  if (category === 'all') invalid(`${path}.category`, 'is unsupported');
  const icon = item.icon === undefined && legacyTime ? 'pin' : item.icon;
  if (icon !== 'pin' && icon !== 'star' && icon !== 'flag')
    invalid(`${path}.icon`, 'is unsupported');
  const createdAt = timestamp(
    item.createdAt === undefined ? legacyTime : item.createdAt,
    `${path}.createdAt`,
  );
  const color = parseMarkerColor(item.color);
  const kind = item.kind === undefined ? undefined : item.kind;
  // v0.32 step 3: 'breakable' is a legal marker kind
  // (PersonalMarker.kind is 'workout' | 'breakable') — the old check
  // accepted only 'workout', so a v3 backup carrying a breakable
  // marker could not be imported at all, and exportBackup would
  // throw for such a user. Both kinds now parse.
  if (kind !== undefined && kind !== 'workout' && kind !== 'breakable')
    invalid(`${path}.kind`, 'is unsupported');
  return {
    id: parseId(item.id, `${path}.id`, true),
    title: parseText(item.title, `${path}.title`, BACKUP_LIMITS.title, true),
    description: parseText(
      item.description === undefined && legacyTime ? '' : item.description,
      `${path}.description`,
      BACKUP_LIMITS.description,
    ),
    category: category as Category,
    position: {
      x: coordinate('x', CANONICAL_BOUNDS.west, CANONICAL_BOUNDS.east),
      y: coordinate('y', CANONICAL_BOUNDS.south, CANONICAL_BOUNDS.north),
    },
    icon,
    ...(kind ? { kind } : {}),
    ...(color ? { color } : {}),
    createdAt,
    updatedAt: timestamp(
      item.updatedAt === undefined && legacyTime ? createdAt : item.updatedAt,
      `${path}.updatedAt`,
    ),
  };
}

export function parseCollection(
  input: unknown,
  path = 'collection',
  legacyTime?: string,
): Collection {
  const item = record(input, path);
  const createdAt = timestamp(
    item.createdAt === undefined ? legacyTime : item.createdAt,
    `${path}.createdAt`,
  );
  return {
    id: parseId(item.id, `${path}.id`),
    name: parseText(item.name, `${path}.name`, BACKUP_LIMITS.title, true),
    placeIds: unique(
      list(item.placeIds, `${path}.placeIds`).map((id, index) =>
        parseId(id, `${path}.placeIds[${index}]`),
      ),
      (id) => id,
      `${path}.placeIds`,
    ),
    createdAt,
    updatedAt: timestamp(
      item.updatedAt === undefined && legacyTime ? createdAt : item.updatedAt,
      `${path}.updatedAt`,
    ),
  };
}

/**
 * One AI-sorted "?" place, whitelisted the same way as every other
 * backup entry: only known fields survive, in known shapes. A record
 * the job never wrote (bad category, bad confidence, bad status) is
 * dropped, never trusted as a type. Unknown keys — including anything
 * that looks like an API key — are ignored, so a key can never ride
 * along in a backup file.
 */
export function parseAiCategoryRecord(input: unknown, path = 'aiCategory'): AiCategoryRecord {
  const item = record(input, path);
  const placeId = parseId(item.placeId, `${path}.placeId`);
  if (
    typeof item.aiCategory !== 'string' ||
    !(AI_CATEGORIES as readonly string[]).includes(item.aiCategory)
  )
    invalid(`${path}.aiCategory`, 'is unsupported');
  const confidence = item.confidence;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    invalid(`${path}.confidence`, 'must be a number between 0 and 1');
  const status = item.status;
  if (
    typeof status !== 'string' ||
    !['suggested', 'unsure', 'confirmed', 'corrected'].includes(status)
  )
    invalid(`${path}.status`, 'is unsupported');
  const userCategory =
    item.userCategory === undefined
      ? undefined
      : (AI_CATEGORIES as readonly string[]).includes(item.userCategory as string)
        ? (item.userCategory as AiCategoryId)
        : invalid(`${path}.userCategory`, 'is unsupported');
  const source =
    item.source === undefined
      ? undefined
      : ['coordinate', 'tag', 'guide', 'analogue', 'ai'].includes(item.source as string)
        ? (item.source as ResolutionSource)
        : invalid(`${path}.source`, 'is unsupported');
  const shopType =
    item.shopType === undefined
      ? undefined
      : parseText(item.shopType, `${path}.shopType`, 60);
  const userShopType =
    item.userShopType === undefined
      ? undefined
      : parseText(item.userShopType, `${path}.userShopType`, 60);
  const matchedFrom =
    item.matchedFrom === undefined
      ? undefined
      : parseText(item.matchedFrom, `${path}.matchedFrom`, 200);
  return {
    placeId,
    aiCategory: item.aiCategory as AiCategoryId,
    ...(shopType ? { shopType } : {}),
    confidence,
    reason: parseText(item.reason, `${path}.reason`, 1000),
    model: parseText(item.model, `${path}.model`, 128),
    indexedAt: timestamp(item.indexedAt, `${path}.indexedAt`),
    status: status as AiCategoryStatus,
    ...(userCategory ? { userCategory } : {}),
    ...(userShopType ? { userShopType } : {}),
    ...(source ? { source } : {}),
    ...(matchedFrom ? { matchedFrom } : {}),
  };
}

/**
 * The index job's progress, as stored in the backup. A "running" job
 * in a file was interrupted when it was exported — it reads as
 * paused, never as still running, so a restore never claims a job is
 * going when it is not.
 */
export function parseAiIndexJob(input: unknown): IndexJobState {
  const item = record(input, 'aiIndexJob');
  const status = item.status;
  if (
    typeof status !== 'string' ||
    !['idle', 'running', 'paused', 'done', 'error'].includes(status)
  )
    invalid('aiIndexJob.status', 'is unsupported');
  const attemptedPlaceIds = list(item.attemptedPlaceIds, 'aiIndexJob.attemptedPlaceIds').map(
    (id, index) => parseId(id, `aiIndexJob.attemptedPlaceIds[${index}]`),
  );
  const resolverVersion =
    item.resolverVersion === undefined
      ? RESOLVER_VERSION
      : typeof item.resolverVersion === 'number' &&
          Number.isFinite(item.resolverVersion) &&
          item.resolverVersion >= 1 &&
          item.resolverVersion <= 99
        ? Math.floor(item.resolverVersion)
        : invalid('aiIndexJob.resolverVersion', 'must be a number between 1 and 99');
  return {
    status: (status === 'running' ? 'paused' : status) as IndexJobStatus,
    attemptedPlaceIds: [...new Set(attemptedPlaceIds)],
    resolverVersion,
    updatedAt: timestamp(item.updatedAt, 'aiIndexJob.updatedAt'),
    ...(typeof item.error === 'string'
      ? { error: parseText(item.error, 'aiIndexJob.error', 500) }
      : {}),
  };
}

/**
 * The v3 sections, shared by the v3 and v4 parsers (v0.32 step 6
 * unification, step-3 ruling #6: "unify when the domain type +
 * repository are touched together"). One implementation parses the
 * sections; the version-specific entry points below only check the
 * version and assemble the result — there is no second parser and
 * no version-spoofing call anymore (parseBackupV4 used to call
 * parseBackup with `{ ...data, version: 3 }`).
 */
function parseV3Sections(
  data: Record<string, unknown>,
  exportedAt: string,
  legacyTime: string | undefined,
): Omit<Backup, 'format' | 'version' | 'exportedAt'> {
  const markers = unique(
    list(data.markers, 'markers').map((item, index) =>
      parsePersonalMarker(item, `markers[${index}]`, legacyTime),
    ),
    (item) => item.id,
    'markers',
  );
  const favorites = unique(
    list(data.favorites, 'favorites').map((value, index): Favorite => {
      const path = `favorites[${index}]`;
      const item =
        typeof value === 'string' && legacyTime ? { placeId: value } : record(value, path);
      return {
        placeId: parseId(item.placeId, `${path}.placeId`),
        createdAt: timestamp(
          item.createdAt === undefined ? legacyTime : item.createdAt,
          `${path}.createdAt`,
        ),
      };
    }),
    (item) => item.placeId,
    'favorites',
  );
  const notes = unique(
    list(data.notes, 'notes').map((value, index): PlaceNote => {
      const path = `notes[${index}]`;
      const item = record(value, path);
      return {
        placeId: parseId(item.placeId, `${path}.placeId`),
        text: parseText(item.text, `${path}.text`, BACKUP_LIMITS.note),
        updatedAt: timestamp(
          item.updatedAt === undefined ? legacyTime : item.updatedAt,
          `${path}.updatedAt`,
        ),
      };
    }),
    (item) => item.placeId,
    'notes',
  );
  const collections = unique(
    list(data.collections === undefined && legacyTime ? [] : data.collections, 'collections').map(
      (item, index) => parseCollection(item, `collections[${index}]`, legacyTime),
    ),
    (item) => item.id,
    'collections',
  );
  const visited = unique(
    list(data.visited === undefined ? [] : data.visited, 'visited').map(
      (value, index): VisitedPlace => {
        const path = `visited[${index}]`;
        const item = record(value, path);
        return {
          placeId: parseId(item.placeId, `${path}.placeId`),
          visitedAt: timestamp(item.visitedAt, `${path}.visitedAt`),
        };
      },
    ),
    (item) => item.placeId,
    'visited',
  );
  // v0.21.0: the user's secondary tags and explored state. Old files
  // never had them — they restore with empty lists, and nothing else
  // in the file is affected. Tags are re-normalised on the way in
  // (lowercased, deduped, capped), so a hand-edited file cannot smuggle
  // in a 10,000-character tag.
  const placeTags = unique(
    list(data.placeTags === undefined ? [] : data.placeTags, 'placeTags').map(
      (value, index): PlaceTags => {
        const path = `placeTags[${index}]`;
        const item = record(value, path);
        if (!Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string'))
          invalid(`${path}.tags`, 'must be an array of strings');
        return {
          placeId: parseId(item.placeId, `${path}.placeId`),
          tags: parseUserTags(item.tags.join(', ')),
          updatedAt: timestamp(item.updatedAt, `${path}.updatedAt`),
        };
      },
    ),
    (item) => item.placeId,
    'placeTags',
  );
  const explored = unique(
    list(data.explored === undefined ? [] : data.explored, 'explored').map(
      (value, index): ExploredPlace => {
        const path = `explored[${index}]`;
        const item = record(value, path);
        return {
          placeId: parseId(item.placeId, `${path}.placeId`),
          exploredAt: timestamp(item.exploredAt, `${path}.exploredAt`),
        };
      },
    ),
    (item) => item.placeId,
    'explored',
  );
  const markerIds = new Set(markers.map((item) => item.id));
  const checkReference = (id: string) => {
    if (id.startsWith('custom:') && !markerIds.has(id))
      invalid('references', `contains missing personal marker ${id}`);
  };
  for (const item of favorites) checkReference(item.placeId);
  for (const item of notes) checkReference(item.placeId);
  for (const item of placeTags) checkReference(item.placeId);
  for (const item of collections) for (const id of item.placeIds) checkReference(id);
  // v0.32 step 3: visited/explored are NOT reference-checked. A row
  // pointing at a deleted custom:* marker is a completion input, not
  // a dangling link — the v3→v4 migration keeps it as a `discovered`
  // record on the id string (DESIGN §5), never silently dropped. A
  // v3 backup carrying such a row used to fail the whole import.
  // Favorites, notes, tags and collections still reject a missing
  // marker: those are live references to a thing that must exist.
  return {
    favorites,
    notes,
    placeTags,
    collections,
    markers,
    visited,
    explored,
    preferences: parsePreferences(data.preferences, Boolean(legacyTime)),
    // v1/v2 files never had the AI index — they restore with an empty
    // one, and the job simply starts from scratch. v3 files carry it.
    aiCategories: unique(
      list(data.aiCategories === undefined ? [] : data.aiCategories, 'aiCategories').map(
        (item, index) => parseAiCategoryRecord(item, `aiCategories[${index}]`),
      ),
      (item) => item.placeId,
      'aiCategories',
    ),
    aiIndexJob:
      data.aiIndexJob === undefined
        ? { ...EMPTY_INDEX_JOB, attemptedPlaceIds: [], updatedAt: exportedAt }
        : parseAiIndexJob(data.aiIndexJob),
  };
}

/**
 * The ONE parser path (step 6 unification): every backup version
 * validates through here. The v3 sections are parsed once by
 * parseV3Sections; version 4 adds its sections on top, with
 * drop-and-count for completion records (DESIGN §11). The 10 MiB cap
 * is checked once, on the final whitelisted result — a v3 file
 * checks the v3 result, a v4 file the v4 result including the new
 * sections, exactly as before the unification.
 */
function parseBackupData(
  data: Record<string, unknown>,
  version: 1 | 2 | 3 | 4,
): { backup: Backup | BackupV4; droppedCompletionRecords: DroppedCompletionRecord[] } {
  const exportedAt = timestamp(data.exportedAt, 'exportedAt');
  const legacyTime = version === 1 ? exportedAt : undefined;
  const sections = parseV3Sections(data, exportedAt, legacyTime);
  if (version !== 4) {
    const result: Backup = {
      format: 'leonida-atlas',
      version: 3,
      exportedAt,
      ...sections,
    };
    // Count only whitelisted data: ignored keys cannot become stored executable content.
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_BACKUP_BYTES)
      invalid('backup', 'exceeds the 10 MiB data limit');
    return { backup: result, droppedCompletionRecords: [] };
  }
  // Completion records are drop-and-count (DESIGN §11): an invalid
  // record is skipped with its reason, the valid ones survive. Every
  // other section below is still fail-fast.
  const { records: completionRecords, dropped: droppedCompletionRecords } =
    parseCompletionRecords(data.completionRecords);
  const reconciliation = unique(
    list(data.reconciliation === undefined ? [] : data.reconciliation, 'reconciliation').map(
      (item, index) => parseReconciliationEntry(item, `reconciliation[${index}]`),
    ),
    (item) => item.categoryId,
    'reconciliation',
  );
  const enrichments = unique(
    list(data.enrichments === undefined ? [] : data.enrichments, 'enrichments').map((item, index) =>
      parseEnrichment(item, `enrichments[${index}]`),
    ),
    (item) => item.id,
    'enrichments',
  );
  const corrections = unique(
    list(data.corrections === undefined ? [] : data.corrections, 'corrections').map((item, index) =>
      parseCorrection(item, `corrections[${index}]`),
    ),
    (item) => item.id,
    'corrections',
  );
  const personalItemState = unique(
    list(
      data.personalItemState === undefined ? [] : data.personalItemState,
      'personalItemState',
    ).map((item, index) => parsePersonalItemState(item, `personalItemState[${index}]`)),
    (item) => item.itemId,
    'personalItemState',
  );
  // No userScreenshots / researchRequests sections: they are not in
  // v4 (see the note at the top of the v4 section). A file carrying
  // them is ignored here — unknown keys, never read.
  const result: BackupV4 = {
    format: 'leonida-atlas',
    version: 4,
    exportedAt,
    ...sections,
    completionRecords,
    reconciliation,
    enrichments,
    corrections,
    personalItemState,
  };
  // Count only whitelisted data: the 10 MiB cap applies to the whole
  // v4 file, new sections included.
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_BACKUP_BYTES)
    invalid('backup', 'exceeds the 10 MiB data limit');
  return { backup: result, droppedCompletionRecords };
}

/** Returns a new, whitelisted v3 value. Never mutates input or touches browser storage. */
export function parseBackup(input: unknown): Backup {
  const data = record(input, 'backup');
  if (data.format !== 'leonida-atlas') invalid('format', 'must be leonida-atlas');
  if (data.version !== 1 && data.version !== 2 && data.version !== 3)
    invalid('version', 'is unsupported (supported versions: 1, 2 and 3)');
  return parseBackupData(data, data.version as 1 | 2 | 3).backup as Backup;
}

// ---------------------------------------------------------------------------
// Backup format v4 (v0.32 step 3 — DESIGN §11 + DESIGN-ADDENDUM §6 step 3)
// ---------------------------------------------------------------------------

/**
 * Why there are TWO parse entry points, and why `parseBackup` above
 * still rejects version 4:
 *
 * `parseBackup` returns the v3-typed `Backup` (`version: 3`, in
 * `src/domain/types.ts`), and `AtlasDatabase.exportBackup` /
 * `importBackup` in `repository.ts` are typed around it. A v4 object
 * is not a `Backup`, so `parseBackup` cannot honestly return one —
 * and changing its return type would break `exportBackup`'s declared
 * `Promise<Backup>`. So:
 *
 * - `parseBackup` stays the v3 validator (versions 1–3 only). The
 *   repository's internal gates keep using it, and the existing
 *   "version 4 is unsupported" test still holds — for `parseBackup`.
 * - `parseBackupV4` below is the v4 validator. Since step 6 both
 *   validators run through the ONE parser path `parseBackupData`
 *   (shared `parseV3Sections` + the v4 sections) — the v4 parser no
 *   longer calls `parseBackup` with a spoofed `version: 3`. The store
 *   layer (`exportWorkspaceBackup` / `importWorkspaceBackup`) and the
 *   backup dialog use `parseBackupV4` / `parseBackupFile` for v4 files.
 * - `importAtlasBackup` hands the repository a version-3 view of a v4
 *   file (`{ ...backup, version: 3 }`) so the repository's v3 import
 *   runs unchanged, then writes the v4 sections itself.
 *
 * A v4 file is a strict superset of v3: every v3 section, plus the
 * completion log, reconciliation, and exactly three addendum tables
 * — `enrichments`, `corrections`, `personalItemState` (addendum line
 * 725). Screenshots and research requests are NOT in the backup:
 * screenshots are device-local blobs (addendum line 518: "device-local
 * only, never in a backup"; the JSON is capped at 10 MiB — stated
 * plainly in Settings and in the export dialog, not hidden), and
 * research requests are fulfilled developer-side (the answers arrive
 * as data). A v4 file that still carries `userScreenshots` or
 * `researchRequests` sections — e.g. one written by the step-3 lane
 * before this ruling — is NOT rejected: the sections are ignored as
 * unknown keys, like any other unknown key, and the valid sections
 * import normally. Rows-only export would have created dangling
 * blobIds on restore (a restored UserScreenshot row referencing a
 * blob that may not exist on the new device), so ignoring the rows
 * is the honest behaviour, not a silent loss of restorable data:
 * the blobs were never restorable from the file.
 */

export type BackupV4 = Omit<Backup, 'version'> & {
  version: 4;
  completionRecords: CompletionRecord[];
  reconciliation: ReconciliationEntry[];
  enrichments: Enrichment[];
  corrections: Correction[];
  personalItemState: PersonalItemState[];
};

/** The completion sources a v4 file may carry (DESIGN §11 says only
 * `user`/`ask`/`import` — but the addendum §3.4 adds `'screenshot'`
 * and `recordCompletion` already writes it, so a v4 backup carrying
 * screenshot records must validate, or screenshot records fail v4
 * validation. See the design-conflicts note in the step-3 report. */
export const COMPLETION_RECORD_SOURCES = ['user', 'ask', 'import', 'screenshot'] as const;

function parseCount(input: unknown, path: string, min: number, max: number): number {
  if (typeof input !== 'number' || !Number.isInteger(input) || input < min || input > max)
    invalid(path, `must be a whole number between ${min} and ${max}`);
  return input;
}

/**
 * One completion record, whitelisted like every other backup entry.
 * What counts as invalid is unchanged from the step-3 lane (bad
 * verb, bad count, bad source, bad target, bad id/timestamp) — only
 * the handling changed: an invalid record is DROPPED, never trusted,
 * and the drop is counted (DESIGN §11), instead of failing the whole
 * import. See `parseCompletionRecords`.
 */
export function parseCompletionRecord(input: unknown, path = 'completionRecord'): CompletionRecord {
  const item = record(input, path);
  const target = record(item.target, `${path}.target`);
  const targetType = target.type;
  if (targetType !== 'item' && targetType !== 'opportunity' && targetType !== 'location')
    invalid(`${path}.target.type`, 'is unsupported');
  const verb = item.verb;
  if (verb !== 'looted' && verb !== 'collected' && verb !== 'discovered' && verb !== 'explored')
    invalid(`${path}.verb`, 'is unsupported');
  // The write path's own rules (record.ts): one-time verbs are always
  // count 1; only a looted undo may be -1; looted tops out at 99.
  const count = parseCount(item.count, `${path}.count`, -1, 99);
  if (verb !== 'looted' && count !== 1)
    invalid(`${path}.count`, 'must be 1 for a one-time record');
  if (verb === 'looted' && count === 0) invalid(`${path}.count`, 'must not be 0');
  const source = item.source;
  if (
    typeof source !== 'string' ||
    !(COMPLETION_RECORD_SOURCES as readonly string[]).includes(source)
  )
    invalid(`${path}.source`, 'is unsupported');
  return {
    id: parseId(item.id, `${path}.id`),
    target: { type: targetType, id: parseId(target.id, `${path}.target.id`) },
    verb,
    count,
    at: timestamp(item.at, `${path}.at`),
    source: source as CompletionRecord['source'],
    ...(item.note === undefined
      ? {}
      : { note: parseText(item.note, `${path}.note`, 500) }),
  };
}

/** One completion record the file carried that could not be trusted.
 * `reason` is the validator's message (e.g. "completionRecords[2].verb
 * is unsupported"), so the drop is explainable, never silent. */
export interface DroppedCompletionRecord {
  /** Index of the record in the file's `completionRecords` array. */
  index: number;
  reason: string;
}

/**
 * DESIGN §11's drop-and-count, for completion records ONLY — every
 * other section keeps its fail-fast contract. An invalid record is
 * skipped and counted with its reason; the valid records survive.
 * A record whose id duplicates an earlier one in the file is invalid
 * in context (the same duplicate rule the other sections enforce by
 * throwing) and is dropped the same way, with a duplicate-id reason.
 * The section itself must still be an array within the item limit —
 * a non-array `completionRecords` is a corrupt file, not a droppable
 * record, and still fails the import.
 */
export function parseCompletionRecords(input: unknown): {
  records: CompletionRecord[];
  dropped: DroppedCompletionRecord[];
} {
  const items = input === undefined ? [] : list(input, 'completionRecords');
  const records: CompletionRecord[] = [];
  const dropped: DroppedCompletionRecord[] = [];
  const seen = new Set<string>();
  items.forEach((item, index) => {
    try {
      const parsed = parseCompletionRecord(item, `completionRecords[${index}]`);
      if (seen.has(parsed.id)) {
        dropped.push({
          index,
          reason: `completionRecords[${index}].id duplicate id ${parsed.id}`,
        });
        return;
      }
      seen.add(parsed.id);
      records.push(parsed);
    } catch (error) {
      dropped.push({
        index,
        reason:
          error instanceof Error ? error.message : 'completion record is invalid',
      });
    }
  });
  return { records, dropped };
}

/** One manual tally, typed from the in-game Progress screen. `basis`
 * is the only basis a manual tally may have (DESIGN §3.1). A
 * `superseded` flag in the file is dropped, never stored — it is set
 * by the Progress selector at read time (DESIGN §3.1). */
export function parseReconciliationEntry(
  input: unknown,
  path = 'reconciliationEntry',
): ReconciliationEntry {
  const item = record(input, path);
  if (item.basis !== 'game-stat') invalid(`${path}.basis`, 'must be game-stat');
  return {
    categoryId: parseId(item.categoryId, `${path}.categoryId`),
    count: parseCount(item.count, `${path}.count`, 0, 100_000),
    basis: 'game-stat',
    at: timestamp(item.at, `${path}.at`),
  };
}

const ENRICHMENT_FIELD_KINDS: readonly EnrichmentFieldKind[] = [
  'identity',
  'purpose',
  'shop-category',
  'accessibility',
  'interior',
  'loot',
  'vehicle-loot',
  'opportunities',
];

function parseEnrichmentSource(input: unknown, path: string): { title: string; url: string; quote: string } {
  const item = record(input, path);
  return {
    title: parseText(item.title, `${path}.title`, 200, true),
    url: parseText(item.url, `${path}.url`, 2000, true),
    quote: parseText(item.quote, `${path}.quote`, 1000, true),
  };
}

/**
 * One enrichment field. A field with no citation is dropped at write
 * time (addendum §2.4) — the backup import is a write, so a
 * source-less field is dropped here too and the rest of the row
 * survives. Returns null when the field is dropped.
 */
function parseEnrichmentField(
  input: unknown,
  path: string,
): Enrichment['fields'][number] | null {
  const item = record(input, path);
  const kind = item.kind;
  if (typeof kind !== 'string' || !(ENRICHMENT_FIELD_KINDS as readonly string[]).includes(kind))
    invalid(`${path}.kind`, 'is unsupported');
  const sources = list(item.sources, `${path}.sources`).map((source, index) =>
    parseEnrichmentSource(source, `${path}.sources[${index}]`),
  );
  if (sources.length === 0) return null;
  const confidence = item.confidence;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)
    invalid(`${path}.confidence`, 'must be a number between 0 and 1');
  const status = item.status;
  if (
    typeof status !== 'string' ||
    !['ai-suggested', 'corroborated', 'personal', 'conflicted'].includes(status)
  )
    invalid(`${path}.status`, 'is unsupported');
  return {
    kind: kind as EnrichmentFieldKind,
    text: parseText(item.text, `${path}.text`, 280, true),
    confidence,
    sources,
    status: status as Enrichment['fields'][number]['status'],
    ...(item.conflictWith === undefined
      ? {}
      : { conflictWith: parseId(item.conflictWith, `${path}.conflictWith`) }),
    ...(item.corroboratedBy === undefined
      ? {}
      : { corroboratedBy: parseText(item.corroboratedBy, `${path}.corroboratedBy`, 200) }),
  };
}

export function parseEnrichment(input: unknown, path = 'enrichment'): Enrichment {
  const item = record(input, path);
  const fields = list(item.fields, `${path}.fields`)
    .map((field, index) => parseEnrichmentField(field, `${path}.fields[${index}]`))
    .filter((field): field is NonNullable<typeof field> => field !== null);
  const imagery = list(item.imagery, `${path}.imagery`).map((value, index) => {
    const imagePath = `${path}.imagery[${index}]`;
    const image = record(value, imagePath);
    if (image.kind !== 'screenshot' && image.kind !== 'ai-illustration')
      invalid(`${imagePath}.kind`, 'is unsupported');
    return {
      kind: image.kind as Enrichment['imagery'][number]['kind'],
      url: parseText(image.url, `${imagePath}.url`, 2000, true),
      sourceTitle: parseText(image.sourceTitle, `${imagePath}.sourceTitle`, 200, true),
      sourceUrl: parseText(image.sourceUrl, `${imagePath}.sourceUrl`, 2000, true),
      ...(image.generatedPrompt === undefined
        ? {}
        : { generatedPrompt: parseText(image.generatedPrompt, `${imagePath}.generatedPrompt`, 1000) }),
    };
  });
  const usage =
    item.usage === undefined
      ? undefined
      : {
          promptTokens: parseCount(
            record(item.usage, `${path}.usage`).promptTokens,
            `${path}.usage.promptTokens`,
            0,
            10_000_000,
          ),
          completionTokens: parseCount(
            record(item.usage, `${path}.usage`).completionTokens,
            `${path}.usage.completionTokens`,
            0,
            10_000_000,
          ),
        };
  return {
    id: parseId(item.id, `${path}.id`),
    locationId: parseId(item.locationId, `${path}.locationId`),
    schemaVersion: parseCount(item.schemaVersion, `${path}.schemaVersion`, 1, 99),
    researchedAt: timestamp(item.researchedAt, `${path}.researchedAt`),
    researchedBy: parseText(item.researchedBy, `${path}.researchedBy`, 128, true),
    fields,
    imagery,
    question:
      item.question === undefined || item.question === null
        ? null
        : parseText(item.question, `${path}.question`, 500),
    ...(usage ? { usage } : {}),
  };
}

/** A player correction: the old value is kept, the new value wins on
 * the card. `source` is always 'user' — a correction is the player's
 * word, never the AI's (addendum §2.6). */
export function parseCorrection(input: unknown, path = 'correction'): Correction {
  const item = record(input, path);
  if (item.source !== 'user') invalid(`${path}.source`, 'must be user');
  return {
    id: parseId(item.id, `${path}.id`),
    locationId: parseId(item.locationId, `${path}.locationId`),
    field: parseText(item.field, `${path}.field`, 200, true),
    oldText:
      item.oldText === undefined || item.oldText === null
        ? null
        : parseText(item.oldText, `${path}.oldText`, 2000),
    newText: parseText(item.newText, `${path}.newText`, 2000, true),
    at: timestamp(item.at, `${path}.at`),
    source: 'user',
  };
}

/** Sold state for one item. `soldAt: null` is a sale that was undone
 * — the row is the audit trail, not a missing row (addendum §3.4). */
export function parsePersonalItemState(
  input: unknown,
  path = 'personalItemState',
): PersonalItemState {
  const item = record(input, path);
  const soldAt =
    item.soldAt === undefined || item.soldAt === null
      ? null
      : timestamp(item.soldAt, `${path}.soldAt`);
  const soldPrice = item.soldPrice;
  if (
    soldPrice !== undefined &&
    (typeof soldPrice !== 'number' || !Number.isFinite(soldPrice) || soldPrice < 0)
  )
    invalid(`${path}.soldPrice`, 'must be a number of 0 or more');
  return {
    itemId: parseId(item.itemId, `${path}.itemId`),
    soldAt,
    ...(soldPrice === undefined ? {} : { soldPrice }),
  };
}

/**
 * The v4 validator WITH its drop-and-count report. `parseBackupV4`
 * below is the same parse without the report (existing callers keep
 * their signature); use this one wherever the drops must be surfaced
 * — the import path and the backup dialog.
 */
export function parseBackupV4WithDrops(input: unknown): {
  backup: BackupV4;
  droppedCompletionRecords: DroppedCompletionRecord[];
} {
  const data = record(input, 'backup');
  if (data.format !== 'leonida-atlas') invalid('format', 'must be leonida-atlas');
  if (data.version !== 4) invalid('version', 'is unsupported (this parser expects version 4)');
  // One parser path (step 6): the v3 sections and the v4 sections
  // validate together in parseBackupData — no second parse, no
  // version-spoofing call. Drop-and-count for invalid completion
  // records lives there too (DESIGN §11).
  return parseBackupData(data, 4) as {
    backup: BackupV4;
    droppedCompletionRecords: DroppedCompletionRecord[];
  };
}

/** Returns a new, whitelisted v4 value. Never mutates input or touches browser storage. */
export function parseBackupV4(input: unknown): BackupV4 {
  return parseBackupV4WithDrops(input).backup;
}

/**
 * The version-aware entry point for files of unknown version: v4
 * files parse as v4, everything else goes through `parseBackup`
 * (which still rejects version 4 when called directly — see the note
 * at the top of the v4 section). Use this in the store layer and the
 * backup dialog; use `parseBackup` only where a v3 value is required.
 *
 * The WithDrops variant also returns the completion records the file
 * carried that could not be trusted (DESIGN §11 drop-and-count) —
 * v1–v3 files never carry completion records, so their list is empty.
 * The plain variant discards the report; use the WithDrops variant
 * wherever the drops must be surfaced (import path, backup dialog).
 */
export function parseBackupFileWithDrops(input: unknown): {
  backup: Backup | BackupV4;
  droppedCompletionRecords: DroppedCompletionRecord[];
} {
  const data = record(input, 'backup');
  if (data.version === 4) return parseBackupV4WithDrops(data);
  return { backup: parseBackup(data), droppedCompletionRecords: [] };
}

export function parseBackupFile(input: unknown): Backup | BackupV4 {
  return parseBackupFileWithDrops(input).backup;
}
