import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Pause, Play, Sparkles, Square } from "lucide-react";
import type { Place } from "../../domain/types";
import { isUnnamedPlace } from "../../domain/types";
import { getAskApiKey, getAskModel } from "../ask/openai";
import { indexJobCounts, useAiIndexStore } from "./store";
import { remainingUnnamedPlaces, runIndexJob } from "./runner";
import { resolutionSourceCounts } from "./resolver";
import { useWorkspaceStore } from "../../stores/atlas";
import {
  dismissBackupNudge,
  downloadAtlasBackup,
  readLastBackup,
  readNudgeDismissedUntil,
  shouldShowBackupNudge,
  type LastBackup,
} from "../backup/atlas-backup";
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
  const storageError = useAiIndexStore((s) => s.storageError);
  const requeuedUnsure = useAiIndexStore((s) => s.requeuedUnsure);
  const startRequestId = useAiIndexStore((s) => s.startRequestId);
  const [running, setRunning] = useState(false);
  /** True when another tab already holds the index-job lock — this
   * tab does not start a second run. Cleared when a run starts here. */
  const [lockNotice, setLockNotice] = useState(false);
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
  // Done means nothing never-run is left — "not sure" places still
  // sit in "To go" for a re-scan, so they never block "done".
  const done = unnamed.length > 0 && counts.pending === 0 && !running;
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  /** The "Backed up yet?" nudge: the index lives only on this phone,
   * and a wipe loses hours of sorting. It fires after a finished run
   * that was never backed up, or every 100 newly sorted places since
   * the last backup — never while the job is running, never twice for
   * the same work. Export reads a snapshot; it never pauses the job. */
  const [lastBackup, setLastBackup] = useState<LastBackup | null>(() =>
    readLastBackup(),
  );
  const [nudgeDismissedUntil, setNudgeDismissedUntil] = useState<number>(() =>
    readNudgeDismissedUntil(),
  );
  const [backupMessage, setBackupMessage] = useState("");
  const showBackupNudge =
    !running &&
    shouldShowBackupNudge({
      categorised: counts.categorised,
      done,
      lastBackup,
      dismissedUntilCount: nudgeDismissedUntil,
    });
  const remaining = useMemo(
    () => remainingUnnamedPlaces(unnamed, job.attemptedPlaceIds),
    [unnamed, job.attemptedPlaceIds],
  );
  const hasKey = getAskApiKey().length > 0;
  /** Real totals, from the snapshot itself: 3,316 places have no
   * confirmed name; 3,280 of them are still "?" (this job's scope) and
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

  async function start() {
    if (running || runningRef.current) return;
    const apiKey = getAskApiKey();
    if (!apiKey) return;
    useAiIndexStore.getState().clearRequeueNotice();
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
    setLockNotice(false);
    try {
      const run = () =>
        runIndexJob({
          places: todo,
          allPlaces: props.places,
          apiKey,
          model: getAskModel(),
          shouldPause: () => pauseRef.current,
          shouldCancel: () => cancelRef.current,
          applyResults: (results, model) =>
            useAiIndexStore.getState().applyResults(results, model),
          // One atomic write per batch: the AI results AND the
          // attempted marking commit together — a place can never
          // count as attempted with no type recorded.
          applyBatch: (results, placeIds, model) =>
            useAiIndexStore.getState().applyBatch(results, placeIds, model),
          setJob: (patch) => useAiIndexStore.getState().setJob(patch),
        });
      // One tab runs the job at a time (Web Locks). Two tabs
      // indexing the same places would interleave their writes and
      // the progress counts would disagree — the second tab waits
      // and says so instead of starting a duplicate run. The lock
      // is held for the whole run; if the tab dies, the lock is
      // released and the other tab can start again.
      if (typeof navigator !== "undefined" && "locks" in navigator) {
        const claimed = await navigator.locks.request(
          "leonida-ai-index-job",
          { ifAvailable: true },
          async () => {
            await run();
            return true;
          },
        );
        if (claimed !== true) setLockNotice(true);
      } else {
        // No Web Locks on this browser: the batches themselves are
        // still atomic, so the index stays consistent — but two tabs
        // could both run and duplicate API calls. The gap is named
        // here, not hidden.
        await run();
      }
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

  async function retryUnsure() {
    // Await the re-queue first: start() reads the attempted list
    // fresh, and starting before the re-queue lands would compute
    // the "to do" list from the stale one and skip the not-sure
    // places this retry is for.
    await useAiIndexStore.getState().retryUnsure();
    await start();
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
      {requeuedUnsure > 0 && (
        <p className="index-requeue" role="status">
          <strong>
            {requeuedUnsure.toLocaleString()} not-sure place
            {requeuedUnsure === 1 ? '' : 's'} re-queued for re-scan with
            the new prompt.
          </strong>{' '}
          The last run could not tell what {requeuedUnsure === 1 ? 'this place is' : 'these places are'} — with the new
          prompt they go back in the “To go” count and get checked
          again instead of being skipped forever.
        </p>
      )}
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
      {showBackupNudge && (
        <div className="backup-nudge" role="status">
          <p>
            <strong>Backed up yet?</strong> Your index lives on this phone
            only — a wipe, a browser-data clear or a new phone loses it.
            {lastBackup
              ? ` Last backup had ${lastBackup.aiCategories.toLocaleString()} sorted place${lastBackup.aiCategories === 1 ? "" : "s"}.`
              : " Nothing is backed up yet."}
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button primary"
              onClick={async () => {
                try {
                  const result = await downloadAtlasBackup(workspaceId);
                  setLastBackup({
                    exportedAt: new Date().toISOString(),
                    aiCategories: result.aiCategories,
                  });
                  setBackupMessage(
                    `Backup downloaded — ${result.aiCategories.toLocaleString()} AI-sorted places kept safe.`,
                  );
                } catch {
                  setBackupMessage(
                    "Could not read local data for export. Retry after checking storage.",
                  );
                }
              }}
            >
              Back up now
            </button>
            <button
              type="button"
              className="button"
              onClick={() => {
                dismissBackupNudge(counts.categorised);
                setNudgeDismissedUntil(counts.categorised);
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}
      {backupMessage && (
        <p className="success-message" role="status">
          {backupMessage}
        </p>
      )}
      {job.error && (
        <p className="inline-error" role="alert">
          Indexing stopped: {job.error} Nothing was lost — the places already
          indexed stay saved, and you can try again.
        </p>
      )}
      {storageError && (
        <div className="inline-error" role="alert">
          <p>
            The index could not be saved on this device: {storageError} Your
            places already indexed are safe — nothing was marked done that
            was not saved.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => void useAiIndexStore.getState().load()}
          >
            Try saving again
          </button>
        </div>
      )}
      {lockNotice && (
        <p className="inline-error" role="status">
          The index job is already running in another tab — this tab will
          not start a second one. Finish or stop it there, then start
          again here.
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
            Every unnamed place has been through the job.
            {counts.unsure > 0
              ? ` ${counts.unsure.toLocaleString()} the AI was not sure about — those stay uncategorised, in the “To go” count, until a re-scan.`
              : ""}
          </p>
          {counts.unsure > 0 && (
            <button
              type="button"
              className="button"
              onClick={retryUnsure}
              disabled={running}
            >
              Re-scan not-sure places
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
        <div className="button-row">
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
          {counts.unsure > 0 && (
            <button type="button" className="button" onClick={retryUnsure}>
              Re-scan not-sure places
            </button>
          )}
        </div>
      )}
      <p className="help-text">
        Small and cheap: the small model, 8 places at a time, saved after each
        batch — so you can stop any time and pick up where you left off.
        Places the map data, a same-spot match, a guide pin or the analogue
        address already resolve never reach the AI at all, so those cost
        nothing. Once a “?” place has a type, it shows on the map with that
        type when its layer is on — until then it draws no pin at all.
        Saved after every batch on this phone — back up in Settings to keep
        it forever, past a wipe or a new phone.
      </p>
    </section>
  );
}
