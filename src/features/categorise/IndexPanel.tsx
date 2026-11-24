import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Pause, Play, Sparkles, Square } from "lucide-react";
import type { Place } from "../../domain/types";
import { isUnnamedPlace } from "../../domain/types";
import { getAskApiKey, getAskModel } from "../ask/openai";
import { indexJobCounts, useAiIndexStore } from "./store";
import { remainingUnnamedPlaces, runIndexJob } from "./runner";
import { resolutionSourceCounts } from "./resolver";
import {
  AI_CATEGORIES,
  aiCategoryShortLabel,
  effectiveAiCategory,
} from "./categories";
import { nameCounts } from "../onboarding/onboarding";
import { PlaceIcon, iconKeyForAiCategory } from "../map/place-icons";
import { tagResolutionCounts } from "../../domain/resolve-tags";

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
  const startRequestId = useAiIndexStore((s) => s.startRequestId);
  const [running, setRunning] = useState(false);
  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  /** StrictMode double-invokes effects in dev; the ref guard makes a
   * second auto-start a no-op even before `running` state lands. */
  const runningRef = useRef(false);

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
  /** Real totals, from the snapshot itself: 2,768 places have no
   * confirmed name; 2,732 of them are still "?" (this job's scope) and
   * 36 show a tentative name with a "?". There is no "5k". */
  const names = nameCounts(props.places);
  /** "?" places the map data's own tags already resolve to a type — no
   * AI needed, no guessing. These already show as "? · House" etc. in
   * Find; the job below is for the rest, which have nothing to read. */
  const tagCounts = useMemo(() => tagResolutionCounts(props.places), [props.places]);
  /** What the job has resolved each "?" INTO so far — a count per type,
   * plus the not-sure ones. A type is a suggestion, never a fact. */
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of Object.values(categories)) {
      const type = effectiveAiCategory(record);
      if (type) counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    return counts;
  }, [categories]);
  /** Resolved BY SOURCE, honestly: the tag counts are live from the
   * map data's own tags (they are not in the store until the job
   * runs); the rest are what the job itself resolved, split by the
   * step that earned them — same-spot coordinate, guide pin, analogue
   * address, or the AI as last resort. "Not sure" is only ever the
   * AI's answer, never a data match. */
  const sourceCounts = useMemo(
    () => resolutionSourceCounts(categories),
    [categories],
  );
  const percent =
    unnamed.length > 0
      ? Math.round((counts.attempted / unnamed.length) * 100)
      : 0;
  const done = unnamed.length > 0 && counts.remaining === 0 && !running;

  async function start() {
    if (running || runningRef.current) return;
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
    runningRef.current = true;
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
      runningRef.current = false;
      setRunning(false);
    }
  }

  /** The forced onboarding's "Start sorting" bumps startRequestId;
   * this panel starts the job when it sees the bump (it mounts when
   * Layers opens). No key, nothing left, or already running: no-op. */
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    if (startRequestId === 0) return;
    if (!getAskApiKey()) return;
    void startRef.current();
    // Only the request id drives this — start() itself is a ref so the
    // effect never re-fires on a re-render.
  }, [startRequestId]);

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
    <section className="index-panel" id="index-panel" aria-label="Sort the unnamed places">
      <h3>
        <Sparkles size={16} /> Sort the unnamed places
      </h3>
      <p className="panel-intro">
        {names.unknown.toLocaleString()} places have no confirmed name —{' '}
        {unnamed.length.toLocaleString()} are still “?” and this job sorts
        those. It resolves each one from real data first, in order: the
        map data’s own tags, then the same spot as a named place on the
        map (within 15 units — checked against the snapshot, because at
        50 units most “matches” are just neighbouring buildings), then
        a verified guide pin (gyms and free equipment from the guides
        already checked), then narrow rules on its real-world analogue
        address. Only what survives all of that goes to the AI, with the
        full context — the AI is the last resort, not the first guess.
        A name is never invented. Low-confidence answers stay “not
        sure” instead of guessed: with no tag and no analogue address
        there is nothing to read, so a house with no evidence never
        becomes a gym.
      </p>
      {counts.attempted === 0 && (
        <p className="panel-intro" role="status">
          <strong>0 sorted so far — this job has never run on this phone.</strong>{' '}
          Nothing is indexed yet. No real AI call has ever run: the job
          only starts when you add your key and tap Start below.
        </p>
      )}
      <p className="panel-intro">
        <strong>
          {tagCounts.resolved.toLocaleString()} of the {unnamed.length.toLocaleString()}{' '}
          “?” places already have a type from the map data's own tags
        </strong>{' '}
        — houses, shops, petrol stations and more, no AI needed, and they
        already show as “? · House” in Find. {tagCounts.remaining.toLocaleString()}{' '}
        still have nothing to read (no tags, or only notes like “can go
        inside”), and those are the ones this job is for.
      </p>
      <div className="index-types" aria-label="Types resolved from the map data's tags">
        {AI_CATEGORIES.map((category) => {
          const count = tagCounts.byCategory[category] ?? 0;
          if (count === 0) return null;
          return (
            <span key={category}>
              <PlaceIcon icon={iconKeyForAiCategory(category)} size={13} />
              {aiCategoryShortLabel(category)} · {count.toLocaleString()} from the map data
            </span>
          );
        })}
      </div>
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
      <div className="index-sources" aria-label="Resolved by source">
        <span>
          Tags · {tagCounts.resolved.toLocaleString()}
        </span>
        <span>
          Same spot · {sourceCounts.coordinate.toLocaleString()}
        </span>
        <span>
          Guide match · {sourceCounts.guide.toLocaleString()}
        </span>
        <span>
          Analogue address · {sourceCounts.analogue.toLocaleString()}
        </span>
        <span>
          AI suggested · {sourceCounts.ai.toLocaleString()}
        </span>
        <span>
          Not sure · {counts.unsure.toLocaleString()}
        </span>
        <span>
          To go · {counts.remaining.toLocaleString()}
        </span>
      </div>
      <p className="help-text">
        Guide matches come from the guide lists already checked and
        bundled with the app (gyms and equipment pins, verified
        23 Nov 2026). The shop guides publish counts but no positions
        you can pull, so a shop the guides count but no map data pins
        cannot be matched by coordinates — that gap is shown, not
        hidden, and the job never invents a pin for it.
      </p>
      <div className="index-types" aria-label="Types resolved so far, with how many of each">
        {AI_CATEGORIES.map((category) => {
          const count = typeCounts.get(category) ?? 0;
          return (
            <span key={category}>
              <PlaceIcon icon={iconKeyForAiCategory(category)} size={13} />
              {aiCategoryShortLabel(category)}
              {count > 0 ? ` · ${count.toLocaleString()}` : ""}
            </span>
          );
        })}
        {counts.unsure > 0 && (
          <span>
            <PlaceIcon icon="question" size={13} />
            Not sure · {counts.unsure.toLocaleString()}
          </span>
        )}
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
        batch — so you can stop any time and pick up where you left off.
        Places the map data, a same-spot match, a guide pin or the analogue
        address already resolve never reach the AI at all, so those cost
        nothing. Turn on Unverified places to see the “?” places on the map,
        with their suggested type.
      </p>
    </section>
  );
}
