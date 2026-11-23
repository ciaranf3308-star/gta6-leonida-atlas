import type { Place } from "../../domain/types";
import {
  CATEGORISATION_BATCH_SIZE,
  categoriseBatch,
  type AiCategoryRecord,
  type ParsedCategorisationResult,
} from "./categories";
import type { IndexJobState } from "./storage";

/**
 * The index job runner — sequential small batches, saved after each one,
 * never blocking the map (each batch awaits the network, then yields
 * briefly before the next). Pause and cancel are checked between
 * batches, never mid-batch, so a batch is either fully saved or not
 * attempted at all. A failed batch is NOT marked attempted, so a resume
 * retries exactly that batch.
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
      const results = await categoriseBatch({
        places: batch,
        allPlaces: input.allPlaces,
        apiKey: input.apiKey,
        model: input.model,
        fetchImpl: input.fetchImpl,
      });
      // Save the results FIRST, then mark the batch attempted — so a
      // crash between the two can only re-run a batch, never lose one.
      input.applyResults(results);
      input.markAttempted(batch.map((place) => place.id));
      attempted += batch.length;
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
