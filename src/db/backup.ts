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
  if (kind !== undefined && kind !== 'workout') invalid(`${path}.kind`, 'is unsupported');
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

/** Returns a new, whitelisted value. Never mutates input or touches browser storage. */
export function parseBackup(input: unknown): Backup {
  const data = record(input, 'backup');
  if (data.format !== 'leonida-atlas') invalid('format', 'must be leonida-atlas');
  if (data.version !== 1 && data.version !== 2 && data.version !== 3)
    invalid('version', 'is unsupported (supported versions: 1, 2 and 3)');
  const exportedAt = timestamp(data.exportedAt, 'exportedAt');
  const legacyTime = data.version === 1 ? exportedAt : undefined;
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
  for (const item of visited) checkReference(item.placeId);
  for (const item of explored) checkReference(item.placeId);
  const result: Backup = {
    format: 'leonida-atlas',
    version: 3,
    exportedAt,
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
  // Count only whitelisted data: ignored keys cannot become stored executable content.
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_BACKUP_BYTES)
    invalid('backup', 'exceeds the 10 MiB data limit');
  return result;
}
