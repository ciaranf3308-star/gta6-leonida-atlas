/**
 * The ONE completion write path (DESIGN §3.4 + addendum §3.4).
 *
 * Every surface funnels here: the map pin, the journal checkbox, the
 * progress bar and Ask all read selectors over the `GameDatabase`
 * this returns, so they cannot disagree — there is nothing else to
 * disagree with. No UI is rewired in this step; this module is built
 * alongside the old store and the old UI keeps working as it does
 * today.
 *
 * Rules enforced inside recordCompletion, before any write:
 * - Target must exist in the database (unknown id → error, never a
 *   guessed record). A legacy `card:*` id is redirected through
 *   `GameDatabase.legacyItemIds` — a defined bridge, not a guess.
 * - Verb must be legal for the target kind: `collected` only on
 *   items and only once (a second `collected` is a no-op returning
 *   the existing record); `looted` only on opportunities with
 *   `repeatable: true`; `discovered`/`explored` on locations and
 *   opportunities only. An illegal verb is rejected with a plain
 *   message, never silently mapped.
 * - Persist-first, read-back verified: the Dexie transaction writes,
 *   reads the record back inside the transaction, then the store
 *   reloads from the database and rebuilds the GameDatabase — the
 *   caller gets the result only after the reload proves the record
 *   is there. A failed write leaves the old state and reports
 *   `storageError` (code 'storageError').
 * - One transaction, then a rebuild: the write is a single Dexie
 *   transaction on `completionRecords`, followed by a
 *   `buildGameDatabase()` rebuild. recordCompletion returns
 *   `{ ok, record, db }` with the rebuilt database.
 *
 * Undo is a compensating record (`count: -1` on repeatable verbs; a
 * `collected`/`discovered`/`explored` undo deletes the record — both
 * are themselves records, so undo survives restart and restore).
 * `discovered`/`explored` undo deletes like `collected`: the design
 * specifies the delete only for `collected`, but a one-time mark
 * undoes by removal, not by a negative record the selectors would
 * ignore (the discovered/explored indexes are presence-based).
 *
 * Selling (addendum §3.4) is separate personal state, not a
 * completion record: `recordSale` requires the item collected first
 * and writes a `PersonalItemState` row — Progress never moves.
 */
import { loadCatalogue } from '../../data/catalogue';
import { completionThresholdById } from '../../data/completion';
import {
  atlasRepository,
  ensureCompletionMigration,
  type AtlasDatabase,
} from '../../db/repository';
import {
  buildGameDatabase,
  type CompletionRecord,
  type CompletionTarget,
  type CompletionVerb,
  type GameDatabase,
  type ReconciliationEntry,
} from '../../domain/game-db';
import type { PersonalItemState } from '../../domain/album';
import type { Place, UserData } from '../../domain/types';
import { browserStorage, type StorageLike } from '../categorise/storage';

export const COMPLETION_SOURCES = ['user', 'ask', 'import', 'screenshot'] as const;
export type CompletionSource = (typeof COMPLETION_SOURCES)[number];

export interface RecordCompletionInput {
  target: CompletionTarget;
  verb: CompletionVerb;
  /** Repeatable verbs only; default 1. `collected` is always 1. */
  count?: number;
  /** ≤ 500 chars, e.g. the safe code used. */
  note?: string;
  /** Default 'user'. Never 'ai' alone — the AI proposes, the user confirms. */
  source?: CompletionSource;
}

export interface RecordCompletionResult {
  ok: boolean;
  record?: CompletionRecord;
  /** The rebuilt GameDatabase — every future surface reads this db.
   * On failure, the pre-write db (the old state, unchanged). */
  db?: GameDatabase;
  error?: string;
  code?: 'validation' | 'storageError';
}

export interface UndoCompletionResult {
  ok: boolean;
  /** The compensating record, when one was appended (looted undo). */
  record?: CompletionRecord;
  /** The id of the record that was deleted (collected / discovered /
   * explored undo). */
  undoneId?: string;
  db?: GameDatabase;
  error?: string;
  code?: 'validation' | 'storageError';
}

export interface RecordSaleResult {
  ok: boolean;
  state?: PersonalItemState;
  error?: string;
  code?: 'validation' | 'storageError';
}

export interface CompletionDeps {
  repository?: AtlasDatabase;
  /** The loaded catalogue. Defaults to loadCatalogue() (memoized fetch). */
  places?: readonly Place[];
  /** Defaults to repository.load(). Pass in tests to avoid a second read. */
  user?: UserData;
  /** Defaults to the browser's localStorage (the tallies key lives there). */
  storage?: StorageLike | null;
}

function validationError(message: string, db?: GameDatabase): RecordCompletionResult {
  return { ok: false, error: message, code: 'validation', db };
}

function storageError(message: string, db?: GameDatabase): RecordCompletionResult {
  return { ok: false, error: message, code: 'storageError', db };
}

async function resolveDeps(
  deps: CompletionDeps,
): Promise<{ repository: AtlasDatabase; places: readonly Place[]; storage: StorageLike | null }> {
  const repository = deps.repository ?? atlasRepository;
  const places = deps.places ?? (await loadCatalogue());
  const storage = deps.storage !== undefined ? deps.storage : browserStorage();
  return { repository, places, storage };
}

async function loadDatabase(
  repository: AtlasDatabase,
  places: readonly Place[],
  user?: UserData,
): Promise<{ db: GameDatabase; userData: UserData }> {
  const userData = user ?? (await repository.load());
  const { records, reconciliation } = await repository.loadCompletion();
  return {
    db: buildGameDatabase({ places, user: userData, records, reconciliation }),
    userData,
  };
}

/**
 * Load the current GameDatabase from storage — the same database
 * recordCompletion validates against. Pure read: it does NOT run the
 * migration (a read must never write); callers that need migrated
 * state call `ensureCompletionMigration` first, as recordCompletion
 * does.
 */
export async function loadGameDatabase(deps: CompletionDeps = {}): Promise<GameDatabase> {
  const { repository, places } = await resolveDeps(deps);
  return (await loadDatabase(repository, places, deps.user)).db;
}

/** Run the v3 migration if it would change anything. Exported so a
 * later step can wire it to startup; recordCompletion calls it first
 * so the first write after upgrade converts the old visited /
 * explored / tallies state before the new record lands. */
export async function ensureMigrated(
  repository: AtlasDatabase,
  places: readonly Place[],
  storage: StorageLike | null,
): Promise<void> {
  await ensureCompletionMigration(repository, places, storage);
}

/** A legacy `card:*` / loot id redirects to its canonical checklist
 * item id through the defined bridge — never a guess, never a new id. */
function resolveItemId(db: GameDatabase, id: string): string | null {
  if (db.items.has(id)) return id;
  return db.legacyItemIds.get(id) ?? null;
}

function targetKind(db: GameDatabase, target: CompletionTarget): string | null {
  if (target.type === 'item') return resolveItemId(db, target.id) ? 'item' : null;
  if (target.type === 'opportunity') return db.opportunities.has(target.id) ? 'opportunity' : null;
  return db.locations.has(target.id) ? 'location' : null;
}

export async function recordCompletion(
  input: RecordCompletionInput,
  deps: CompletionDeps = {},
): Promise<RecordCompletionResult> {
  const { repository, places, storage } = await resolveDeps(deps);
  try {
    await ensureMigrated(repository, places, storage);
  } catch (error) {
    return storageError(
      `Could not save that — the old completion data could not be migrated (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed; try again.`,
    );
  }
  let before: GameDatabase;
  try {
    before = (await loadDatabase(repository, places, deps.user)).db;
  } catch (error) {
    return storageError(
      `Could not save that — the completion data could not be read (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed.`,
    );
  }

  // --- Validation, before any write. ---
  const source = input.source ?? 'user';
  if (!COMPLETION_SOURCES.includes(source)) {
    return validationError(
      `Source must be user, ask, import or screenshot — not "${input.source}".`,
      before,
    );
  }
  if (input.note !== undefined && input.note.length > 500) {
    return validationError('A note can be at most 500 characters.', before);
  }
  const canonicalTarget: CompletionTarget =
    input.target.type === 'item'
      ? {
          type: 'item',
          id: resolveItemId(before, input.target.id) ?? input.target.id,
        }
      : input.target;
  const kind = targetKind(before, canonicalTarget);
  if (!kind) {
    return validationError(
      `No ${input.target.type} with id "${input.target.id}" exists — nothing was recorded.`,
      before,
    );
  }
  const count = input.count ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 99) {
    return validationError('Count must be a whole number between 1 and 99.', before);
  }
  if (input.verb === 'collected') {
    if (kind !== 'item') {
      return validationError(
        `Only items can be collected — "${input.target.id}" is a ${kind}, not an item.`,
        before,
      );
    }
    if (count !== 1) {
      return validationError('A collected item always counts as 1 — a duplicate is not a second completion.', before);
    }
  } else if (input.verb === 'looted') {
    if (kind !== 'opportunity') {
      return validationError(
        `Only opportunities can be looted — "${input.target.id}" is a ${kind}.`,
        before,
      );
    }
    const opp = before.opportunities.get(canonicalTarget.id)!;
    if (!opp.repeatable) {
      return validationError(
        `"${opp.label}" cannot be looted — it is not a repeatable opportunity.`,
        before,
      );
    }
  } else {
    // discovered / explored: locations and opportunities only.
    if (kind === 'item') {
      return validationError(
        `Items cannot be ${input.verb === 'discovered' ? 'discovered' : 'explored'} — mark the item collected, or ${input.verb === 'discovered' ? 'discover' : 'explore'} its location.`,
        before,
      );
    }
    if (count !== 1) {
      return validationError(
        `${input.verb === 'discovered' ? 'Discovered' : 'Explored'} is a one-time mark — count is always 1.`,
        before,
      );
    }
  }

  // --- One transaction: re-check the no-op inside it (two taps at
  // once must not write two `collected` records), write, read back. ---
  const record: CompletionRecord = {
    id: `rec:${crypto.randomUUID()}`,
    target: canonicalTarget,
    verb: input.verb,
    count,
    at: new Date().toISOString(),
    source,
    ...(input.note ? { note: input.note } : {}),
  };
  let written: CompletionRecord | undefined;
  try {
    written = await repository.transaction('rw', repository.completionRecords, async () => {
      const existing = (await repository.completionRecords.toArray()).find(
        (candidate) =>
          candidate.verb === input.verb &&
          candidate.target.type === canonicalTarget.type &&
          candidate.target.id === canonicalTarget.id &&
          candidate.count > 0,
      );
      if (existing && input.verb !== 'looted') {
        // One-time verbs are idempotent: return the existing record.
        return existing;
      }
      await repository.completionRecords.put(record);
      const readBack = await repository.completionRecords.get(record.id);
      if (!readBack || readBack.id !== record.id) {
        throw new Error('The completion record did not read back after writing.');
      }
      return record;
    });
  } catch (error) {
    return storageError(
      `Could not save that — it is not lost, try again (${error instanceof Error ? error.message : 'unknown error'}).`,
      before,
    );
  }

  // --- Reload from the database and rebuild; the caller gets the
  // result only after the reload proves the record is there. ---
  try {
    const after = (await loadDatabase(repository, places)).db;
    if (!after.records.some((candidate) => candidate.id === written!.id)) {
      return storageError('Could not save that — the record is not in the database after reloading. Nothing was changed.', before);
    }
    return { ok: true, record: written, db: after };
  } catch (error) {
    return storageError(
      `Could not verify that save — try again (${error instanceof Error ? error.message : 'unknown error'}).`,
      before,
    );
  }
}

/**
 * Undo a completion record. Repeatable verbs get a compensating
 * record (`count: -1`) — the loot and its undo both stay in the log.
 * One-time verbs (`collected`, `discovered`, `explored`) undo by
 * deleting the record. Either way the rebuilt db is returned.
 */
export async function undoCompletion(
  recordId: string,
  deps: CompletionDeps = {},
): Promise<UndoCompletionResult> {
  const { repository, places, storage } = await resolveDeps(deps);
  try {
    await ensureMigrated(repository, places, storage);
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not undo that — the old completion data could not be migrated (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed.`,
    };
  }
  let before: GameDatabase;
  try {
    before = (await loadDatabase(repository, places, deps.user)).db;
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not undo that — the completion data could not be read (${error instanceof Error ? error.message : 'unknown error'}).`,
    };
  }
  const original = before.records.find((record) => record.id === recordId);
  if (!original) {
    return { ok: false, code: 'validation', error: `No completion record with id "${recordId}" exists — nothing was undone.`, db: before };
  }
  if (original.count < 0) {
    // A compensating record is itself an undo — undoing it would
    // append a second -1 for a loot that is already undone.
    return { ok: false, code: 'validation', error: 'That record is already an undo — nothing was undone.', db: before };
  }
  if (original.verb === 'looted') {
    // Compensating record id: `rec:undo-<uuid>`, NOT `rec:<uuid>`.
    // Dexie returns records in primary-key (id) order, and step-1's
    // buildGameDatabase accumulates completedOpportunityIds in that
    // order, dropping a -1 that arrives while the running total is 0
    // (a -1 sorted before the +1s it compensates is silently lost,
    // so loot ×2 + undo reads back as ×2). 'u' sorts after every hex
    // uuid and after 'rec:mig:', so compensating records always
    // accumulate LAST — the running total then only reaches 0 at the
    // tail, where nothing follows it. THE PROPER FIX belongs in
    // game-db.ts (accumulate all counts first, then drop totals ≤ 0 —
    // exactly what the item branch already does); until that lands,
    // this prefix is the invariant that keeps undo correct for every
    // consumer of the log. See the step-2 report.
    const compensating: CompletionRecord = {
      id: `rec:undo-${crypto.randomUUID()}`,
      target: original.target,
      verb: 'looted',
      count: -1,
      at: new Date().toISOString(),
      source: 'user',
    };
    try {
      await repository.transaction('rw', repository.completionRecords, async () => {
        await repository.completionRecords.put(compensating);
        const readBack = await repository.completionRecords.get(compensating.id);
        if (!readBack) throw new Error('The undo record did not read back after writing.');
      });
    } catch (error) {
      return {
        ok: false,
        code: 'storageError',
        error: `Could not undo that — it is not lost, try again (${error instanceof Error ? error.message : 'unknown error'}).`,
        db: before,
      };
    }
    try {
      const after = (await loadDatabase(repository, places)).db;
      return { ok: true, record: compensating, db: after };
    } catch (error) {
      return {
        ok: false,
        code: 'storageError',
        error: `Could not verify that undo — try again (${error instanceof Error ? error.message : 'unknown error'}).`,
        db: before,
      };
    }
  }
  try {
    await repository.transaction('rw', repository.completionRecords, async () => {
      await repository.completionRecords.delete(original.id);
      if (await repository.completionRecords.get(original.id)) {
        throw new Error('The completion record is still there after deleting it.');
      }
    });
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not undo that — it is not lost, try again (${error instanceof Error ? error.message : 'unknown error'}).`,
      db: before,
    };
  }
  try {
    const after = (await loadDatabase(repository, places)).db;
    return { ok: true, undoneId: original.id, db: after };
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not verify that undo — try again (${error instanceof Error ? error.message : 'unknown error'}).`,
      db: before,
    };
  }
}

/**
 * Attach (or replace) a note on an existing completion record — the
 * no-key path for Demo C step 2 ("used code 6823" on a looted
 * gang-op / vehicle-loot record). The Ask confirm flow already
 * attaches a note at record time (recordCompletion's `note`); this
 * is the after-the-fact equivalent for a record the player made by
 * tapping "Mark as looted", with no LLM in the loop.
 *
 * Rules, same shape as recordCompletion:
 * - The record must exist — an unknown id is rejected, never created.
 * - The note is ≤ 500 chars, like recordCompletion's. An empty note
 *   CLEARS the note (the key is removed, not stored as '').
 * - A compensating record (count < 0 — an undo) takes no note: it is
 *   itself an undo, not a loot.
 * - Persist-first, read-back verified: the Dexie transaction writes
 *   the updated record, reads it back, then the store reloads and
 *   rebuilds — the caller gets the result only after the reload
 *   proves the note is there. The note lives ON the record, so it
 *   survives restart and backup/restore exactly like the record
 *   (backup v4's completionRecords carry `note` — parseBackup keeps
 *   it, see parseCompletionRecord).
 */
export interface AttachCompletionNoteResult {
  ok: boolean;
  record?: CompletionRecord;
  /** The rebuilt GameDatabase — every future surface reads this db. */
  db?: GameDatabase;
  error?: string;
  code?: 'validation' | 'storageError';
}

export async function attachCompletionNote(
  recordId: string,
  note: string,
  deps: CompletionDeps = {},
): Promise<AttachCompletionNoteResult> {
  const { repository, places, storage } = await resolveDeps(deps);
  try {
    await ensureMigrated(repository, places, storage);
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not save that note — the old completion data could not be migrated (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed.`,
    };
  }
  let before: GameDatabase;
  try {
    before = (await loadDatabase(repository, places, deps.user)).db;
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not save that note — the completion data could not be read (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed.`,
    };
  }
  if (note.length > 500) {
    return { ok: false, code: 'validation', error: 'A note can be at most 500 characters.', db: before };
  }
  const original = before.records.find((record) => record.id === recordId);
  if (!original) {
    return {
      ok: false,
      code: 'validation',
      error: `No completion record with id "${recordId}" exists — nothing was changed.`,
      db: before,
    };
  }
  if (original.count < 0) {
    return {
      ok: false,
      code: 'validation',
      error: 'That record is an undo — a note goes on the loot itself, not its undo.',
      db: before,
    };
  }
  const trimmed = note.trim();
  const updated: CompletionRecord = { ...original };
  if (trimmed) updated.note = trimmed;
  else delete updated.note;
  try {
    await repository.transaction('rw', repository.completionRecords, async () => {
      await repository.completionRecords.put(updated);
      const readBack = await repository.completionRecords.get(updated.id);
      if (!readBack || (readBack.note ?? undefined) !== (updated.note ?? undefined)) {
        throw new Error('The note did not read back after writing.');
      }
    });
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not save that note — it is not lost, try again (${error instanceof Error ? error.message : 'unknown error'}).`,
      db: before,
    };
  }
  try {
    const after = (await loadDatabase(repository, places)).db;
    const verified = after.records.find((candidate) => candidate.id === updated.id);
    if (
      !verified ||
      (verified.note ?? undefined) !== (updated.note ?? undefined)
    ) {
      return {
        ok: false,
        code: 'storageError',
        error: 'Could not save that note — the record is not in the database after reloading. Nothing was changed.',
        db: before,
      };
    }
    return { ok: true, record: verified, db: after };
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not verify that note — try again (${error instanceof Error ? error.message : 'unknown error'}).`,
      db: before,
    };
  }
}

/**
 * Record a sale (addendum §3.4). Requires the item collected first —
 * selling a card you have not found is rejected. Writes a
 * PersonalItemState row only: it does NOT write or delete any
 * CompletionRecord, so the set still counts the card and Progress is
 * unchanged.
 */
export async function recordSale(
  input: { itemId: string; price?: number },
  deps: CompletionDeps = {},
): Promise<RecordSaleResult> {
  const { repository, places, storage } = await resolveDeps(deps);
  try {
    await ensureMigrated(repository, places, storage);
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not record that sale — the old completion data could not be migrated (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed.`,
    };
  }
  let db: GameDatabase;
  try {
    db = (await loadDatabase(repository, places, deps.user)).db;
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not record that sale — the completion data could not be read (${error instanceof Error ? error.message : 'unknown error'}).`,
    };
  }
  const canonicalId = resolveItemId(db, input.itemId);
  if (!canonicalId) {
    return { ok: false, code: 'validation', error: `No item with id "${input.itemId}" exists — nothing was recorded.` };
  }
  const item = db.items.get(canonicalId)!;
  if (!db.completedItemIds.has(canonicalId)) {
    return {
      ok: false,
      code: 'validation',
      error: `Cannot record a sale — "${item.name}" has not been collected yet.`,
    };
  }
  if (
    input.price !== undefined &&
    (!Number.isFinite(input.price) || input.price < 0)
  ) {
    return { ok: false, code: 'validation', error: 'A sale price must be a number of 0 or more.' };
  }
  const state: PersonalItemState = {
    itemId: canonicalId,
    soldAt: new Date().toISOString(),
    ...(input.price !== undefined ? { soldPrice: input.price } : {}),
  };
  try {
    await repository.transaction('rw', repository.personalItemState, async () => {
      await repository.personalItemState.put(state);
      const readBack = await repository.personalItemState.get(canonicalId);
      if (!readBack || readBack.soldAt !== state.soldAt) {
        throw new Error('The sale did not read back after writing.');
      }
    });
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not record that sale — it is not lost, try again (${error instanceof Error ? error.message : 'unknown error'}).`,
    };
  }
  return { ok: true, state };
}

/** Undo a sale: clear `soldAt` and keep the row, so the sale stays
 * in the audit trail (addendum §3.4). */
export async function undoSale(
  itemId: string,
  deps: CompletionDeps = {},
): Promise<RecordSaleResult> {
  const { repository, places, storage } = await resolveDeps(deps);
  try {
    await ensureMigrated(repository, places, storage);
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not undo that sale — the old completion data could not be migrated (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed.`,
    };
  }
  let db: GameDatabase;
  try {
    db = (await loadDatabase(repository, places, deps.user)).db;
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not undo that sale — the completion data could not be read (${error instanceof Error ? error.message : 'unknown error'}).`,
    };
  }
  const canonicalId = resolveItemId(db, itemId);
  if (!canonicalId) {
    return { ok: false, code: 'validation', error: `No item with id "${itemId}" exists — nothing was undone.` };
  }
  const current = await repository.getPersonalItemState(canonicalId);
  if (!current || current.soldAt === null) {
    return { ok: false, code: 'validation', error: 'That item has not been sold — nothing was undone.' };
  }
  const state: PersonalItemState = { ...current, soldAt: null };
  await repository.transaction('rw', repository.personalItemState, async () => {
    await repository.personalItemState.put(state);
  });
  return { ok: true, state };
}

/**
 * Record one manual tally (v0.32 step 6, DESIGN §4.2): the number the
 * player typed from the in-game Progress screen, for one of the 19
 * categories. The in-game counter is the ONLY basis a manual tally
 * may have — the entry is always `basis: 'game-stat'`.
 *
 * Rules, enforced before any write (same shape as recordCompletion):
 * - The category must be one of the 19 thresholds; an unknown id is
 *   rejected, never stored under a made-up key.
 * - The count must be a whole number in [0, total] for the category
 *   (a tally above the game's total is a typo, not progress).
 * - The v3 migration runs first: a stale `leonida-completion-v1` key
 *   would otherwise overwrite this entry with its tallies on the
 *   next migration pass (bulkPut by category id).
 * - Persist-first, read-back verified (repository
 *   saveReconciliationEntry): a failed write leaves the old entry
 *   and reports `storageError`.
 * - Writing an entry for a derived category does NOT change what
 *   Progress shows — the §4.3 selector displays the derived value
 *   and marks this entry superseded (shown, not counted). The entry
 *   is still stored: it is the player's typed cross-check, and it
 *   becomes the displayed value the moment the derived coverage
 *   goes away.
 */
export interface RecordReconciliationInput {
  categoryId: string;
  count: number;
}

export interface RecordReconciliationResult {
  ok: boolean;
  entry?: ReconciliationEntry;
  error?: string;
  code?: 'validation' | 'storageError';
}

export async function recordReconciliation(
  input: RecordReconciliationInput,
  deps: CompletionDeps = {},
): Promise<RecordReconciliationResult> {
  const { repository, places, storage } = await resolveDeps(deps);
  try {
    await ensureMigrated(repository, places, storage);
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not save that count — the old completion data could not be migrated (${error instanceof Error ? error.message : 'unknown error'}). Nothing was changed.`,
    };
  }
  const threshold = completionThresholdById(input.categoryId);
  if (!threshold) {
    return {
      ok: false,
      code: 'validation',
      error: `No completion category with id "${input.categoryId}" exists — nothing was recorded.`,
    };
  }
  if (
    !Number.isInteger(input.count) ||
    input.count < 0 ||
    input.count > threshold.total
  ) {
    return {
      ok: false,
      code: 'validation',
      error: `"${threshold.name}" takes a whole number between 0 and ${threshold.total}.`,
    };
  }
  const entry: ReconciliationEntry = {
    categoryId: input.categoryId,
    count: input.count,
    basis: 'game-stat',
    at: new Date().toISOString(),
  };
  try {
    await repository.saveReconciliationEntry(entry);
  } catch (error) {
    return {
      ok: false,
      code: 'storageError',
      error: `Could not save that count — it is not lost, try again (${error instanceof Error ? error.message : 'unknown error'}).`,
    };
  }
  return { ok: true, entry };
}

// Re-exported for callers that run the migration explicitly (startup
// wiring in a later step; the banner retry hook).
export { ensureCompletionMigration, migrateV3CompletionData } from '../../db/repository';
