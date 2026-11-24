import type { Place } from "../../domain/types";
import {
  CATEGORISATION_BATCH_SIZE,
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
  applyResults: (results: ParsedCategorisationResult[]) => void;
  markAttempted: (placeIds: readonly string[]) => void;
  setJob: (patch: Partial<IndexJobState>) => void;
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
  let attempted = 0;
  input.setJob({ status: "running", error: undefined });
  try {
    for (
      let start = 0;
      start < input.places.length;
      start += CATEGORISATION_BATCH_SIZE
    ) {
      if (input.shouldCancel()) {
        input.setJob({ status: "idle" });
        return "cancelled";
      }
      if (input.shouldPause()) {
        input.setJob({ status: "paused" });
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
      if (deterministic.length > 0) input.applyResults(deterministic);
      const batchResults: ParsedCategorisationResult[] = [...deterministic];
      if (unresolved.length > 0) {
        const aiResults = await categoriseBatch({
          places: unresolved,
          allPlaces: input.allPlaces,
          apiKey: input.apiKey,
          model: input.model,
          fetchImpl: input.fetchImpl,
        });
        input.applyResults(aiResults);
        batchResults.push(...aiResults);
      }
      // Save the results FIRST, then mark the batch attempted — so a
      // crash between the two can only re-run a batch, never lose one.
      // (A failed LLM call throws before this line: the deterministic
      // results above are already saved, and the batch is not marked
      // attempted, so a resume retries only the unresolved rest.)
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
      input.markAttempted(attemptedIds);
      attempted += attemptedIds.length;
      input.onProgress?.(attempted, total);
      // Yield so the map thread gets a turn between batches.
      await sleep(input.batchDelayMs ?? 120);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Indexing stopped — nothing was lost.";
    input.setJob({ status: "error", error: message });
    return "error";
  }
  input.setJob({ status: "done" });
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
