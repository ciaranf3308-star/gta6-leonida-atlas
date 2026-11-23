import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Pause, Play, Sparkles, Square } from "lucide-react";
import type { Place } from "../../domain/types";
import { isUnnamedPlace } from "../../domain/types";
import { getAskApiKey, getAskModel } from "../ask/openai";
import { indexJobCounts, useAiIndexStore } from "./store";
import { remainingUnnamedPlaces, runIndexJob } from "./runner";
import { AI_CATEGORIES, aiCategoryShortLabel } from "./categories";
import { PlaceIcon, iconKeyForAiCategory } from "../map/place-icons";

export interface IndexPanelProps {
  /** All catalogue places (named + unnamed). */
  places: Place[];
  offline: boolean;
  onOpenSettings: () => void;
}

/**
 * "Sort the unnamed places" — the AI categorisation job, in Layers.
 *
 * Sends unnamed "?" places to OpenAI in small batches (8 at a time,
 * small model) using the key the user already saved for Ask Nylah, and
 * saves each batch on-device before starting the next — so it can be
 * paused, stopped and resumed at any point. Nothing leaves the device
 * except the batch itself, to api.openai.com; results stay on-device.
 *
 * A suggestion is never a fact: the detail sheet labels it "AI
 * suggested" with its confidence, and low-confidence answers are left
 * as "not sure" and never shown as a type.
 */
export default function IndexPanel(props: IndexPanelProps) {
  const categories = useAiIndexStore((s) => s.categories);
  const job = useAiIndexStore((s) => s.job);
  const [running, setRunning] = useState(false);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);

  const unnamed = useMemo(
    () => props.places.filter((place) => isUnnamedPlace(place)),
    [props.places],
  );
  const counts = indexJobCounts(categories, job, unnamed.length);
  const remaining = useMemo(
    () => remainingUnnamedPlaces(unnamed, job.attemptedPlaceIds),
    [unnamed, job.attemptedPlaceIds],
  );
  const hasKey = getAskApiKey().length > 0;
  const percent =
    unnamed.length > 0
      ? Math.round((counts.attempted / unnamed.length) * 100)
      : 0;
  const done = unnamed.length > 0 && counts.remaining === 0 && !running;

  async function start() {
    if (running) return;
    const apiKey = getAskApiKey();
    if (!apiKey) return;
    // Read the job fresh from the store — after "check the not-sure ones
    // again" the attempted list has just changed and the closure is stale.
    const todo = remainingUnnamedPlaces(
      unnamed,
      useAiIndexStore.getState().job.attemptedPlaceIds,
    );
    if (todo.length === 0) return;
    pauseRef.current = false;
    cancelRef.current = false;
    setRunning(true);
    try {
      await runIndexJob({
        places: todo,
        allPlaces: props.places,
        apiKey,
        model: getAskModel(),
        shouldPause: () => pauseRef.current,
        shouldCancel: () => cancelRef.current,
        applyResults: (results) =>
          useAiIndexStore.getState().applyResults(results),
        markAttempted: (placeIds) =>
          useAiIndexStore.getState().markAttempted(placeIds),
        setJob: (patch) => useAiIndexStore.getState().setJob(patch),
      });
    } finally {
      setRunning(false);
    }
  }

  function pause() {
    pauseRef.current = true;
  }

  function stop() {
    cancelRef.current = true;
    pauseRef.current = false;
  }

  function retryUnsure() {
    useAiIndexStore.getState().retryUnsure();
    void start();
  }

  return (
    <section className="index-panel" aria-label="Sort the unnamed places">
      <h3>
        <Sparkles size={16} /> Sort the unnamed places
      </h3>
      <p className="panel-intro">
        {unnamed.length.toLocaleString()} places are still “?” with no name yet.
        This asks the AI to suggest what kind of place each one is — house,
        shop, gym, petrol station and so on — from what the map already knows
        about it. Suggestions are labelled “AI suggested”, never facts, and a
        name is never invented.
      </p>
      <div className="index-progress" role="status">
        <div className="index-counts">
          <strong>
            {counts.attempted.toLocaleString()} of{" "}
            {unnamed.length.toLocaleString()} indexed
          </strong>
          <span>
            {counts.categorised.toLocaleString()} given a type ·{" "}
            {counts.unsure.toLocaleString()} not sure yet ·{" "}
            {counts.remaining.toLocaleString()} to go
          </span>
        </div>
        <span
          className="progress-bar"
          style={{ "--progress": `${percent}%` } as CSSProperties}
        />
      </div>
      <div className="index-types" aria-label="Types the AI can suggest">
        {AI_CATEGORIES.map((category) => (
          <span key={category}>
            <PlaceIcon icon={iconKeyForAiCategory(category)} size={13} />
            {aiCategoryShortLabel(category)}
          </span>
        ))}
      </div>
      {job.error && (
        <p className="inline-error" role="alert">
          Indexing stopped: {job.error} Nothing was lost — the places already
          indexed stay saved, and you can try again.
        </p>
      )}
      {!hasKey ? (
        <div className="index-no-key">
          <p>
            Indexing needs your OpenAI key — the same one Ask Nylah uses. Add it
            in Settings first, then come back here. The key stays only on this
            device, and places are sent nowhere except OpenAI while indexing.
          </p>
          <button
            type="button"
            className="button primary"
            onClick={props.onOpenSettings}
          >
            Add your key in Settings
          </button>
        </div>
      ) : props.offline ? (
        <p className="empty-state">
          You are offline — indexing needs internet. Your saved suggestions
          still work offline.
        </p>
      ) : done ? (
        <div className="index-done">
          <p className="success-message" role="status">
            All {unnamed.length.toLocaleString()} unnamed places indexed.
            {counts.unsure > 0
              ? ` ${counts.unsure.toLocaleString()} the AI was not sure about — those stay uncategorised.`
              : ""}
          </p>
          {counts.unsure > 0 && (
            <button
              type="button"
              className="button"
              onClick={retryUnsure}
              disabled={running}
            >
              Check the not-sure ones again
            </button>
          )}
        </div>
      ) : running ? (
        <div className="button-row">
          <button type="button" className="button" onClick={pause}>
            <Pause size={16} /> Pause
          </button>
          <button type="button" className="button" onClick={stop}>
            <Square size={16} /> Stop for now
          </button>
        </div>
      ) : job.status === "paused" || job.status === "error" ? (
        <div className="button-row">
          <button
            type="button"
            className="button primary"
            onClick={() => void start()}
          >
            <Play size={16} /> Resume indexing
          </button>
          <button
            type="button"
            className="button"
            onClick={() =>
              useAiIndexStore.getState().setJob({ status: "idle" })
            }
          >
            Stop for now
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="button primary"
          onClick={() => void start()}
          disabled={remaining.length === 0}
        >
          <Sparkles size={16} />{" "}
          {counts.attempted > 0
            ? `Continue indexing (${counts.remaining.toLocaleString()} to go)`
            : "Index unnamed places"}
        </button>
      )}
      <p className="help-text">
        Small and cheap: the small model, 8 places at a time, saved after each
        batch — so you can stop any time and pick up where you left off. Turn on
        Unverified places to see the “?” places on the map, with their suggested
        type.
      </p>
    </section>
  );
}
