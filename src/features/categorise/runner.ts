import type { Place } from "../../domain/types";
import {
  CATEGORISATION_BATCH_SIZE,
  CATEGORISATION_MODEL,
  categoriseBatch,
  MIN_AI_CONFIDENCE,
  type AiCategoryRecord,
  type ParsedCategorisationResult,
} from "./categories";
import { resolvePlaceDeterministically } from "./resolver";
import type { IndexJobState } from "./storage";

/**
 * The index job runner — sequential small batches, saved after each one,
 * never blocking the map (each batch awaits the network, then yields
 * briefly before the next). Pause and cancel are checked between
 * batches, never mid-batch, so a batch is either fully saved or not
 * attempted at all. A failed batch is NOT marked attempted, so a resume
 * retries exactly that batch.
 *
 * Resolver v2: every batch runs the deterministic resolver FIRST
 * (tags → same-spot coordinate → guide pin → analogue keywords).
 * Places it resolves never reach the network at all — the LLM only
 * ever sees what no data could resolve, with the full context. A
 * batch that resolves fully makes no API call. Deterministic results
 * are saved before the LLM call, so a failed LLM batch keeps them and
 * a resume only re-runs the unresolved rest.
 *
 * "Not sure" is NOT attempted (v0.14.0): a batch's low-confidence
 * results (< 0.6) are saved as "not sure" records but their places
 * are NOT marked attempted — they stay in the "To go" count and the
 * next run, or the next resolver version, re-scans them with the new
 * prompt instead of skipping them forever.
 */

export interface RunIndexJobInput {
  /** Unnamed places not yet attempted, in catalogue order. */
  places: readonly Place[];
  allPlaces: readonly Place[];
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  /** Pause/cancel flags, read between batches (owned by the UI). */
  shouldPause: () => boolean;
  shouldCancel: () => boolean;
  /** Apply one finished batch. The second argument is the model that
   * produced the results — 'deterministic' for data-resolved results
   * (no model produced those), the job's model for AI results — so a
   * stored record never claims a model that did not make it.
   * Each callback reports whether the write actually persisted
   * (false = storage failed); the runner stops the job with an
   * honest error instead of carrying on as if the batch were saved. */
  applyResults: (results: ParsedCategorisationResult[], model?: string) => Promise<boolean>;
  /** Apply one finished batch atomically: the AI results AND the
   * attempted marking for the whole batch in one transaction — so a
   * place can never count as attempted with no type recorded, and a
   * batch is either fully saved or not attempted at all. The
   * deterministic results of the same batch are already saved (see
   * below); pass only the AI results here. */
  applyBatch: (
    results: ParsedCategorisationResult[],
    attemptedPlaceIds: readonly string[],
    model?: string,
  ) => Promise<boolean>;
  setJob: (patch: Partial<IndexJobState>) => Promise<boolean>;
  onProgress?: (attempted: number, total: number) => void;
  /** Yield between batches so the map stays responsive. Default 120ms. */
  batchDelayMs?: number;
}

export type RunIndexJobOutcome = "done" | "paused" | "cancelled" | "error";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runIndexJob(
  input: RunIndexJobInput,
): Promise<RunIndexJobOutcome> {
  const total = input.places.length;
  // The model the records will name — resolved once, so a stored
  // record never claims the default when the user picked another model.
  const model = input.model?.trim() || CATEGORISATION_MODEL;
  let attempted = 0;
  const started = await input.setJob({ status: "running", error: undefined });
  if (started === false) {
    throw new Error(
      "The AI index could not be saved on this device — the job was not started.",
    );
  }
  try {
    for (
      let start = 0;
      start < input.places.length;
      start += CATEGORISATION_BATCH_SIZE
    ) {
      if (input.shouldCancel()) {
        await input.setJob({ status: "idle" });
        return "cancelled";
      }
      if (input.shouldPause()) {
        await input.setJob({ status: "paused" });
        return "paused";
      }
      const batch = input.places.slice(
        start,
        start + CATEGORISATION_BATCH_SIZE,
      );
      // Deterministic first: resolve what the data already says, and
      // only send the rest to the LLM. A fully-resolved batch makes no
      // network call at all.
      const deterministic: ParsedCategorisationResult[] = [];
      const unresolved: Place[] = [];
      for (const place of batch) {
        const resolved = resolvePlaceDeterministically(place, input.allPlaces);
        if (resolved) deterministic.push(resolved);
        else unresolved.push(place);
      }
      if (deterministic.length > 0) {
        // Saved before the LLM call, so a failed LLM batch keeps
        // them and a resume only re-runs the unresolved rest. If
        // this write fails, the batch is NOT marked attempted — the
        // places stay un-attempted and the next run retries them.
        // Marking them attempted with no type recorded would strand
        // them forever (the pre-v0.30 localStorage bug).
        const saved = await input.applyResults(deterministic, "deterministic");
        if (saved === false) {
          throw new Error(
            "The AI index could not be saved on this device — the job stopped before this batch was recorded. Nothing was lost: the batch will be tried again.",
          );
        }
      }
      const batchResults: ParsedCategorisationResult[] = [...deterministic];
      let aiResults: ParsedCategorisationResult[] = [];
      if (unresolved.length > 0) {
        // The in-flight batch is abortable: Stop / Pause in the UI
        // aborts the network call mid-batch instead of letting it
        // finish and write results after the user stopped the job.
        // The batch is not marked attempted, so a resume retries
        // exactly this batch.
        const controller = new AbortController();
        let batchDone = false;
        const watcher = (async () => {
          while (!batchDone) {
            if (input.shouldCancel() || input.shouldPause()) {
              controller.abort();
              return;
            }
            await sleep(100);
          }
        })();
        try {
          aiResults = await categoriseBatch({
            places: unresolved,
            allPlaces: input.allPlaces,
            apiKey: input.apiKey,
            model,
            fetchImpl: input.fetchImpl,
            signal: controller.signal,
          });
          batchResults.push(...aiResults);
        } finally {
          batchDone = true;
          await watcher;
        }
      }
      // ONE atomic write for the whole batch: the AI results AND the
      // attempted marking for the batch (deterministic places
      // included — their records are already saved above). Either
      // both commit or neither does, so a place can never count as
      // attempted with no type recorded. (A failed LLM call throws
      // before this line: the deterministic results above are already
      // saved, and the batch is not marked attempted, so a resume
      // retries only the unresolved rest.)
      // "Not sure" is not attempted: places the AI could not resolve
      // stay in the "To go" count for the next run / new prompt.
      const unsureIds = new Set(
        batchResults
          .filter((result) => result.confidence < MIN_AI_CONFIDENCE)
          .map((result) => result.placeId),
      );
      const attemptedIds = batch
        .map((place) => place.id)
        .filter((id) => !unsureIds.has(id));
      const batchSaved = await input.applyBatch(aiResults, attemptedIds, model);
      if (batchSaved === false) {
        throw new Error(
          "The AI index could not be saved on this device — the job stopped before this batch was recorded. Nothing was lost: the batch will be tried again.",
        );
      }
      attempted += attemptedIds.length;
      input.onProgress?.(attempted, total);
      // Yield so the map thread gets a turn between batches.
      await sleep(input.batchDelayMs ?? 120);
    }
  } catch (error) {
    // A Stop / Pause that aborted the in-flight batch is not an
    // error — the job stopped where the user asked, with nothing
    // from the aborted batch saved and nothing marked attempted.
    if (input.shouldCancel()) {
      await input.setJob({ status: "idle" });
      return "cancelled";
    }
    if (input.shouldPause()) {
      await input.setJob({ status: "paused" });
      return "paused";
    }
    const message =
      error instanceof Error
        ? error.message
        : "Indexing stopped — nothing was lost.";
    // Best-effort: if the storage that failed the batch also fails
    // this write, the error is still the outcome the UI shows — the
    // store's storageError banner says why, and nothing was marked
    // attempted, so a retry starts from the same place.
    await input.setJob({ status: "error", error: message });
    return "error";
  }
  await input.setJob({ status: "done" });
  return "done";
}

/** What the runner still has to do, given the saved job. */
export function remainingUnnamedPlaces(
  places: readonly Place[],
  attemptedPlaceIds: readonly string[],
): Place[] {
  const attempted = new Set(attemptedPlaceIds);
  return places.filter((place) => !attempted.has(place.id));
}

export type { AiCategoryRecord };
