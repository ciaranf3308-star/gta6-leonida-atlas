/**
 * First launch (v0.32 step 5) — one dismissible hint, no wall.
 *
 * The v0.26 first-open Vice City region sheet and the forced indexing
 * onboarding are gone from the primary experience: first launch is a
 * clean map, the area breadcrumb, four tabs, and this single hint.
 * The hint dismisses when any panel opens, when the selected place
 * sheet closes, or from its own × — and the dismissal persists on
 * this device, so a reload never brings the hint back.
 *
 * StorageLike is injected (same pattern as onboarding.ts) so the
 * persistence is unit-testable without a browser.
 */
import type { StorageLike } from '../categorise/storage';

/** The one first-launch hint. Plain words, no jargon. */
export const FIRST_OPEN_HINT =
  'Everything is off — tap the map filter to show places, or ask Nylah';

export const FIRST_OPEN_DISMISSED_STORAGE_KEY = 'leonida-first-open-dismissed';

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export function hasDismissedFirstOpen(
  storage: StorageLike | null = browserStorage(),
): boolean {
  try {
    return storage?.getItem(FIRST_OPEN_DISMISSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markFirstOpenDismissed(
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(FIRST_OPEN_DISMISSED_STORAGE_KEY, '1');
  } catch {
    // Storage unavailable — the hint just shows again next launch.
  }
}

/**
 * Auto-dismiss hardening (CI diagnosis) — pure predicates, so the
 * behaviour is pinned by tests instead of living only in App's
 * effects.
 *
 * Any panel open dismisses first-open: a tab, Find, the map-filter
 * sheet, or Ask. A sheet sitting on top of panel controls on a phone
 * is the overlap class this fixes.
 */
export function shouldDismissFirstOpen(state: {
  navTab: string;
  askOpen: boolean;
  findOpen: boolean;
  filterSheetOpen: boolean;
}): boolean {
  return (
    state.navTab !== 'map' ||
    state.askOpen ||
    state.findOpen ||
    state.filterSheetOpen
  );
}

/** The selected-sheet Close ends first-open: closing the place sheet
 * means the player has started using the map. */
export function selectedSheetClosed(
  previousSelectedId: string | null,
  selectedId: string | null,
): boolean {
  return previousSelectedId !== null && selectedId === null;
}
