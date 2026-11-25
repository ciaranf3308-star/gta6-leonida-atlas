/**
 * County stunt jumps + 100% completion thresholds.
 *
 * Source: duanhesen/gta6-leonida-map-data (gta6maps.io), CC BY 4.0,
 * Zenodo DOI 10.5281/zenodo.24412576, commit
 * 1c5977bb9c40401667a192f14239beebbde54211 (2026-11-23):
 * - `data/leonida-counties-summary.csv` — 130 stunt jumps by county
 *   (Vice-Dale 53, Kelly 29, Lummox 19, Mariana 16, Leonard 13).
 * - `data/completion-100-thresholds.json` — 19 threshold categories for
 *   the in-game 100% checklist ("The Long Road").
 *
 * What is NOT in here, deliberately: the file's `story_chapters`
 * (chapter titles, settings, safehouses) are story detail — spoiler
 * content — so only the aggregate mission total (91) is used. The
 * file's chapter `approx_missions` sum to 92 against its own stated
 * total of 91; they are labelled approximate in the source and are not
 * reproduced here. Cheat codes (61) are not a completion category and
 * are not tracked.
 *
 * The same repo's 798 markers (`gta-6-markers.csv` / `.json`) were
 * checked and NOT imported: their `x`/`y` are "normalized 0–1
 * schematic coordinates" (the README's own words). Fitted against the
 * GTADB frame on the 774 markers whose ids match GTADB records, the
 * best affine transform leaves a median error of ~2.1 km (p90 ~3.9 km,
 * max ~8.5 km; only 2 of 774 within 100 m). The 774 matched markers
 * duplicate places the GTADB catalogue already carries with verified
 * positions, and the 24 unmatched ones cannot be verified at all.
 * See hidden_files/v031-county/markers-inventory.md.
 */
import { COUNTIES } from './counties';

export const COMPLETION_SOURCE = {
  repo: 'https://github.com/duanhesen/gta6-leonida-map-data',
  site: 'https://gta6maps.io',
  commit: '1c5977bb9c40401667a192f14239beebbde54211',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  doi: '10.5281/zenodo.24412576',
  doiUrl: 'https://doi.org/10.5281/zenodo.24412576',
  countiesFile: 'data/leonida-counties-summary.csv',
  thresholdsFile: 'data/completion-100-thresholds.json',
  updated: '2026-11-23',
} as const;

/** Stunt jumps per county, from `leonida-counties-summary.csv`. */
export const COUNTY_STUNT_JUMPS: Readonly<Record<string, number>> = {
  'vice-dale': 53,
  kelly: 29,
  lummox: 19,
  mariana: 16,
  leonard: 13,
} as const;

/** Total stunt jumps across Leonida (53 + 29 + 19 + 16 + 13). */
export const STUNT_JUMPS_TOTAL = 130;

/** Stunt jumps per county, in the county picker's display order. */
export function stuntJumpsByCounty(): { id: string; name: string; jumps: number }[] {
  return COUNTIES.map((county) => ({
    id: county.id,
    name: county.name.replace(' County', ''),
    jumps: COUNTY_STUNT_JUMPS[county.id] ?? 0,
  }));
}

export interface CompletionThreshold {
  /** Stable key for the user's saved count. */
  id: string;
  /** The checklist's own category name (aggregate label, not a spoiler). */
  name: string;
  /** How many the in-game 100% checklist requires. */
  required: number;
  /** How many exist in the game in total. */
  total: number;
  /** Total individual items, when the category counts sets (cards). */
  totalItems?: number;
  /** Aggregate hint from the source file (how-to, never a location). */
  note?: string;
  /** Trophy threshold, when the trophy needs fewer than 100%. */
  trophyThreshold?: number;
  /** Sub-counts that add up to `total`, when the source gives them. */
  breakdown?: { label: string; count: number }[];
}

/**
 * The 19 categories of the in-game 100% checklist, in the source
 * file's order. Required totals sum to 1,325; in-game totals sum to
 * 1,962. Every `required` is <= its `total` (verified by unit test).
 */
export const COMPLETION_THRESHOLDS: readonly CompletionThreshold[] = [
  { id: 'missions', name: 'Main Story Missions', required: 91, total: 91 },
  { id: 'gang-ops', name: 'Gang Operations', required: 39, total: 39 },
  { id: 'bank-jobs', name: 'Bank Jobs', required: 22, total: 22 },
  { id: 'payday-loans', name: 'Payday Loan Jobs', required: 7, total: 7 },
  { id: 'smash-grabs', name: "Smash 'n' Grabs", required: 34, total: 34 },
  { id: 'store-stickups', name: 'Convenience Store Stick Ups', required: 50, total: 50 },
  {
    id: 'card-sets',
    name: 'Collectible Card Sets',
    required: 15,
    total: 18,
    totalItems: 480,
    note: '15 sets of 18 · 480 cards in total',
  },
  {
    id: 'flamingos',
    name: 'Cocaine Flamingos',
    required: 100,
    total: 125,
    note: 'Shoot flamingos with black-and-white beaks',
  },
  { id: 'waink-scans', name: 'WAiNK Landmark Scans', required: 100, total: 100 },
  {
    id: 'stunts',
    name: 'Combined Stunts',
    required: 300,
    total: 397,
    trophyThreshold: 250,
    breakdown: [
      { label: 'Stunt jumps', count: 130 },
      { label: 'Base jumps', count: 25 },
      { label: 'Knife flights', count: 40 },
      { label: 'Under the bridge', count: 202 },
    ],
  },
  { id: 'underwater', name: 'Underwater Discoveries', required: 33, total: 33 },
  { id: 'magazines', name: 'Magazines, Books & Comics', required: 30, total: 30 },
  { id: 'meditation', name: 'Meditation Spots', required: 15, total: 15 },
  { id: 'vehicles', name: 'Vehicles Scanned (WAiNK)', required: 200, total: 557 },
  { id: 'animals', name: 'Animals Studied (Binoculars)', required: 100, total: 255 },
  { id: 'hunting', name: "Bret's Hunting Questline", required: 15, total: 15 },
  { id: 'hoops', name: 'Basketball Hoops', required: 90, total: 90 },
  { id: 'drone-trials', name: 'Drone Time Trials', required: 42, total: 42 },
  { id: 'range-gold', name: 'Shooting Range Gold Medals', required: 42, total: 42 },
];

/** Sum of `required` across all 19 categories (1,325). */
export const COMPLETION_REQUIRED_TOTAL = COMPLETION_THRESHOLDS.reduce(
  (sum, threshold) => sum + threshold.required,
  0,
);

export function completionThresholdById(id: string): CompletionThreshold | undefined {
  return COMPLETION_THRESHOLDS.find((threshold) => threshold.id === id);
}

/** Clamp a user-entered count into [0, total] as an integer. */
export function clampFound(value: number, threshold: CompletionThreshold): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(threshold.total, Math.floor(value)));
}

export interface ThresholdProgress {
  found: number;
  required: number;
  total: number;
  /** Progress toward what 100% requires (0–1, capped at 1). */
  pctRequired: number;
  /** Progress toward everything in the game (0–1, capped at 1). */
  pctTotal: number;
  done: boolean;
}

export function thresholdProgress(
  found: number,
  threshold: CompletionThreshold,
): ThresholdProgress {
  const clamped = clampFound(found, threshold);
  return {
    found: clamped,
    required: threshold.required,
    total: threshold.total,
    pctRequired: threshold.required === 0 ? 1 : Math.min(1, clamped / threshold.required),
    pctTotal: threshold.total === 0 ? 1 : Math.min(1, clamped / threshold.total),
    done: clamped >= threshold.required,
  };
}

export interface OverallCompletion {
  /** Sum of min(found, required) across categories. */
  found: number;
  /** Sum of required across categories (1,325). */
  required: number;
  /** Overall progress toward 100% (0–1). */
  pct: number;
  /** Categories where the requirement is met. */
  doneCategories: number;
}

/**
 * Overall 100% progress: found counts are capped at each category's
 * requirement, so over-finding one category cannot mask another.
 * The game's own checklist is the source of truth; this is the
 * companion tally.
 */
export function overallCompletion(
  counts: Readonly<Record<string, number>>,
): OverallCompletion {
  let found = 0;
  let doneCategories = 0;
  for (const threshold of COMPLETION_THRESHOLDS) {
    const progress = thresholdProgress(counts[threshold.id] ?? 0, threshold);
    found += Math.min(progress.found, threshold.required);
    if (progress.done) doneCategories += 1;
  }
  return {
    found,
    required: COMPLETION_REQUIRED_TOTAL,
    pct: COMPLETION_REQUIRED_TOTAL === 0 ? 0 : found / COMPLETION_REQUIRED_TOTAL,
    doneCategories,
  };
}
