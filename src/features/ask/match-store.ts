/**
 * The card-matcher store (v0.32 step 7) — the one live copy of the
 * matcher's on-device state: confirmed matches, attempt fingerprints
 * and rejections (CARD-MATCHER-DESIGN §2.3 + M4).
 *
 * Mirrors `useCompletionLogStore`: App loads it on startup and builds
 * its `GameDatabase` from `matches` (a confirmed match pins its slot
 * to its host), so a one-tap confirmation in Collections appears on
 * the map immediately — no second read, no reload.
 *
 * - `load()` reads the three matcher tables. No migration — the
 *   tables are new in Dexie v6, existing data is untouched.
 * - `confirmProposal()` writes the match TWICE in the design's sense:
 *   the on-device personal record lands here (Dexie `cardMatches`),
 *   and the shipped-data half rides in the backup (the backup
 *   carries `cardMatches` — export → merged-cards.json → generator).
 *   The match is written with `buildPersonalMatch`, so it carries
 *   'approximate' evidence, never 'verified'.
 * - `rejectProposal()` writes an M4 rejection: the (slot, host) pair
 *   is never re-proposed, the slot stays open.
 * - `skipProposal()` writes nothing — the proposal stays queued.
 * - `recordJot()` writes a 'personal'-evidence match for a marker
 *   the player placed in-game (the jot flow).
 * - `startJob()` wires `runMatcherJob` with the store's repository +
 *   the player's key; pause/cancel are flags the job loop reads
 *   between batches. A paused job resumes by starting again with
 *   the same slots — saved attempts fingerprint-skip, so nothing is
 *   re-run or re-paid.
 *
 * The review list is derived, not stored: `reviewItems(db, state)`
 * takes the attempts with result 'proposed' whose slot has no
 * confirmed match and whose (slot, host) is not rejected, and joins
 * them to the live database for host names and area checks.
 */
import { create } from 'zustand';
import {
  atlasRepository,
  type AtlasDatabase,
} from '../../db/repository';
import type { PersonalMatch } from '../../domain/album';
import type { CollectibleItem, GameDatabase } from '../../domain/game-db';
import type { PersonalMarker } from '../../domain/types';
import type { AiCategoryRecord } from '../categorise/categories';
import { getAskApiKey } from './openai';
import {
  areaCheckLine,
  buildPersonalMatch,
  candidateHostsForSlot,
  rejectionKey,
  recordJot,
  runMatcherJob,
  slotConflictNote,
  type MatchCandidate,
  type MatcherAttempt,
  type MatcherRejection,
  type MatchProposal,
  type RunMatcherJobOutcome,
} from './card-matcher';

export interface MatchStoreDeps {
  /** Defaults to the global repository. Pass a fresh database in tests. */
  repository?: AtlasDatabase;
}

/** One row of the Collections review list. */
export interface ReviewItem {
  slot: CollectibleItem;
  attempt: MatcherAttempt;
  hostId: string;
  hostName: string;
  confidence: number;
  reasoning: string;
  proposedBy: 'deterministic' | 'llm';
  areaCheck: string;
  conflictNote: string | null;
  direction: string;
  directionSourceTitle: string;
  directionSourceUrl: string;
  /** The candidate re-derived from the live database — null when the
   *  map data changed since the attempt was made (a re-sync moved or
   *  removed the host). A null candidate cannot be confirmed: the
   *  row says so and the player re-runs the matcher instead of
   *  confirming a stale host. */
  candidate: MatchCandidate | null;
}

export interface MatcherJobState {
  running: boolean;
  done: number;
  total: number;
  outcome: RunMatcherJobOutcome | null;
  error?: string;
  /** Proposals from this run (the review list shows them once the
   *  attempts land — this is the run's own copy for the panel). */
  proposed: MatchProposal[];
}

export interface StartMatcherJobOpts {
  db: GameDatabase;
  slots: readonly CollectibleItem[];
  aiCategories?: ReadonlyMap<string, AiCategoryRecord>;
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export interface MatchStoreState {
  matches: PersonalMatch[];
  attempts: MatcherAttempt[];
  rejections: MatcherRejection[];
  loaded: boolean;
  error: string | null;
  job: MatcherJobState | null;
  /** The jot flow: the slot the player's NEXT saved marker becomes
   *  the host of (armed by "Mark it yourself" in the matcher panel,
   *  cleared on save or on cancel). */
  pendingJotSlotId: string | null;
  armJot: (slotId: string) => void;
  clearPendingJot: () => void;
  load: (deps?: MatchStoreDeps) => Promise<void>;
  refresh: (deps?: MatchStoreDeps) => Promise<void>;
  /** One-tap confirm: the proposal becomes a personal record and
   *  the slot pins to its host on the next db rebuild. */
  confirmProposal: (
    proposal: MatchProposal,
    slot: CollectibleItem,
    deps?: MatchStoreDeps,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** "Not this one": the pair is never re-proposed (M4). */
  rejectProposal: (
    slotId: string,
    hostId: string,
    deps?: MatchStoreDeps,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** The jot flow: a marker the player placed in-game becomes the
   *  slot's host, evidence 'personal'. */
  recordJotMatch: (
    slot: CollectibleItem,
    marker: PersonalMarker,
    deps?: MatchStoreDeps,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Save one matcher attempt (a Find-this-card lead that resolved
   *  to a host, or any other attempt the UI produced). The review
   *  list picks it up on the next read. */
  saveAttempt: (
    attempt: MatcherAttempt,
    deps?: MatchStoreDeps,
  ) => Promise<{ ok: boolean; error?: string }>;
  startJob: (opts: StartMatcherJobOpts, deps?: MatchStoreDeps) => Promise<void>;
  pauseJob: () => void;
  cancelJob: () => void;
}

let loadPromise: Promise<void> | null = null;
/** Pause/cancel flags the job loop reads between batches. */
let jobPaused = false;
let jobCancelled = false;
/** The last job's inputs, so a paused job resumes with the same slots. */
let lastJobOpts: StartMatcherJobOpts | null = null;
let lastJobDeps: MatchStoreDeps | undefined;

async function readAll(
  repository: AtlasDatabase,
): Promise<{
  matches: PersonalMatch[];
  attempts: MatcherAttempt[];
  rejections: MatcherRejection[];
}> {
  const [matches, attempts, rejections] = await Promise.all([
    repository.loadCardMatches(),
    repository.loadMatcherAttempts(),
    repository.loadMatcherRejections(),
  ]);
  return { matches, attempts, rejections };
}

export function reviewItems(
  db: GameDatabase,
  state: Pick<MatchStoreState, 'matches' | 'attempts' | 'rejections'>,
): ReviewItem[] {
  const matchedSlotIds = new Set(state.matches.map((match) => match.slotId));
  const rejected = new Set(state.rejections.map((entry) => entry.id));
  const rows: ReviewItem[] = [];
  for (const attempt of state.attempts) {
    if (attempt.result !== 'proposed' || !attempt.proposedHostId) continue;
    if (matchedSlotIds.has(attempt.slotId)) continue;
    if (rejected.has(rejectionKey(attempt.slotId, attempt.proposedHostId))) continue;
    const slot = db.items.get(attempt.slotId);
    const host = db.locations.get(attempt.proposedHostId);
    if (!slot || !host) continue;
    const direction = slot.pickups[0];
    // Re-derive the candidate from the live database — the attempt
    // stores the host id, not the pass that proposed it, and the
    // confirm path needs the real candidate (never a fabricated one).
    const candidate =
      candidateHostsForSlot(db, slot).find(
        (entry) => entry.hostId === attempt.proposedHostId,
      ) ?? null;
    rows.push({
      slot,
      attempt,
      hostId: host.id,
      hostName: host.name ?? host.id,
      confidence: attempt.confidence ?? 0,
      reasoning: attempt.reasoning ?? '',
      proposedBy: attempt.proposedBy ?? 'deterministic',
      areaCheck: areaCheckLine(db, slot, host),
      conflictNote: slotConflictNote(slot),
      direction: direction?.direction ?? '',
      directionSourceTitle: direction?.sourceTitle ?? '',
      directionSourceUrl: direction?.sourceUrl ?? '',
      candidate,
    });
  }
  return rows;
}

export const useMatchStore = create<MatchStoreState>()((set, get) => ({
  matches: [],
  attempts: [],
  rejections: [],
  loaded: false,
  error: null,
  job: null,
  pendingJotSlotId: null,

  armJot: (slotId) => {
    set({ pendingJotSlotId: slotId });
  },

  clearPendingJot: () => {
    set({ pendingJotSlotId: null });
  },

  load: (deps = {}) => {
    if (!loadPromise) {
      loadPromise = (async () => {
        try {
          const repository = deps.repository ?? atlasRepository;
          const { matches, attempts, rejections } = await readAll(repository);
          set({ matches, attempts, rejections, loaded: true, error: null });
        } catch (error) {
          set({
            loaded: true,
            error:
              error instanceof Error
                ? error.message
                : 'The card matches could not be loaded.',
          });
        } finally {
          loadPromise = null;
        }
      })();
    }
    return loadPromise;
  },

  refresh: async (deps = {}) => {
    const repository = deps.repository ?? atlasRepository;
    try {
      const { matches, attempts, rejections } = await readAll(repository);
      set({ matches, attempts, rejections, loaded: true, error: null });
    } catch (error) {
      set({
        loaded: true,
        error:
          error instanceof Error
            ? error.message
            : 'The card matches could not be loaded.',
      });
    }
  },

  confirmProposal: async (proposal, slot, deps = {}) => {
    const repository = deps.repository ?? atlasRepository;
    try {
      const match = buildPersonalMatch(proposal, slot);
      await repository.saveCardMatch(match);
      set((state) => ({
        matches: [...state.matches.filter((entry) => entry.slotId !== match.slotId), match],
      }));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not save that match — try again.',
      };
    }
  },

  rejectProposal: async (slotId, hostId, deps = {}) => {
    const repository = deps.repository ?? atlasRepository;
    try {
      const rejection: MatcherRejection = {
        id: rejectionKey(slotId, hostId),
        slotId,
        hostId,
        rejectedAt: new Date().toISOString(),
      };
      await repository.saveMatcherRejection(rejection);
      set((state) => ({
        rejections: [
          ...state.rejections.filter((entry) => entry.id !== rejection.id),
          rejection,
        ],
      }));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not save that rejection — try again.',
      };
    }
  },

  recordJotMatch: async (slot, marker, deps = {}) => {
    const repository = deps.repository ?? atlasRepository;
    try {
      const match = recordJot(slot, marker);
      await repository.saveCardMatch(match);
      set((state) => ({
        matches: [...state.matches.filter((entry) => entry.slotId !== match.slotId), match],
      }));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not save that mark — try again.',
      };
    }
  },

  saveAttempt: async (attempt, deps = {}) => {
    const repository = deps.repository ?? atlasRepository;
    try {
      await repository.saveMatcherAttempts([attempt]);
      set((state) => ({
        attempts: [
          ...state.attempts.filter((entry) => entry.id !== attempt.id),
          attempt,
        ],
      }));
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Could not save that lead — try again.',
      };
    }
  },

  startJob: async (opts, deps = {}) => {
    const repository = deps.repository ?? atlasRepository;
    if (get().job?.running) return;
    jobPaused = false;
    jobCancelled = false;
    lastJobOpts = opts;
    lastJobDeps = deps;
    set({
      job: { running: true, done: 0, total: opts.slots.length, outcome: null, proposed: [] },
    });
    try {
      const attempts = await repository.loadMatcherAttempts();
      const outcome = await runMatcherJob({
        db: opts.db,
        slots: opts.slots,
        aiCategories: opts.aiCategories,
        attempts,
        apiKey: opts.apiKey,
        model: opts.model,
        fetchImpl: opts.fetchImpl,
        shouldPause: () => jobPaused,
        shouldCancel: () => jobCancelled,
        applyBatch: async (batch) => {
          try {
            await repository.saveMatcherAttempts(batch);
            return true;
          } catch {
            return false;
          }
        },
        onProgress: (done, total) => {
          set((state) => ({
            job: state.job ? { ...state.job, done, total } : state.job,
          }));
        },
      });
      await get().refresh(deps);
      set((state) => ({
        job: state.job
          ? {
              ...state.job,
              running: false,
              outcome: outcome.outcome,
              error: outcome.error,
              proposed: outcome.proposed,
            }
          : state.job,
      }));
    } catch (error) {
      set((state) => ({
        job: state.job
          ? {
              ...state.job,
              running: false,
              outcome: 'error',
              error: error instanceof Error ? error.message : 'The matcher job failed.',
            }
          : state.job,
      }));
    }
  },

  pauseJob: () => {
    jobPaused = true;
  },

  cancelJob: () => {
    jobCancelled = true;
  },
}));

/** Resume a paused job with the same slots (fingerprint-skip makes
 *  the re-run cheap). Returns false when there is nothing to resume. */
export async function resumeMatcherJob(): Promise<boolean> {
  const state = useMatchStore.getState();
  if (!lastJobOpts || state.job?.running || state.job?.outcome !== 'paused') return false;
  await state.startJob(lastJobOpts, lastJobDeps);
  return true;
}

/** The player's Ask key, re-read on every use — the matcher never
 *  holds it. Null when no key is saved (the matcher still runs its
 *  deterministic passes; the LLM pass stays off). */
export function getMatcherApiKey(): string | null {
  return getAskApiKey() || null;
}
