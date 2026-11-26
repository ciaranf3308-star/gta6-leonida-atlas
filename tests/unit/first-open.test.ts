import { describe, expect, it } from 'vitest';
import {
  FIRST_OPEN_DISMISSED_STORAGE_KEY,
  FIRST_OPEN_HINT,
  hasDismissedFirstOpen,
  markFirstOpenDismissed,
  selectedSheetClosed,
  shouldDismissFirstOpen,
} from '../../src/features/onboarding/first-open';
import type { StorageLike } from '../../src/features/categorise/storage';

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  entries: () => Record<string, string>;
} {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    entries: () => Object.fromEntries(store),
  };
}

describe('first launch — one dismissible hint, no wall (step 5)', () => {
  it('the hint says exactly what it says, in plain words', () => {
    expect(FIRST_OPEN_HINT).toBe(
      'Everything is off — tap the map filter to show places, or ask Nylah',
    );
  });

  it('a fresh device has not dismissed first-open', () => {
    expect(hasDismissedFirstOpen(memoryStorage())).toBe(false);
  });

  it('dismissing persists — a reload (fresh storage over the same entries) never brings the hint back', () => {
    const storage = memoryStorage();
    markFirstOpenDismissed(storage);
    expect(hasDismissedFirstOpen(storage)).toBe(true);
    const reloaded = memoryStorage(storage.entries());
    expect(hasDismissedFirstOpen(reloaded)).toBe(true);
  });

  it('the dismissal key is its own key — it never touches the old onboarding keys', () => {
    const storage = memoryStorage({
      'leonida-index-onboarding-seen': '1',
      'leonida-welcome-seen': '1',
    });
    expect(hasDismissedFirstOpen(storage)).toBe(false);
    markFirstOpenDismissed(storage);
    expect(storage.entries()[FIRST_OPEN_DISMISSED_STORAGE_KEY]).toBe('1');
    expect(storage.entries()['leonida-index-onboarding-seen']).toBe('1');
  });

  it('unavailable storage never throws — the hint just shows again', () => {
    const failing: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(hasDismissedFirstOpen(failing)).toBe(false);
    expect(() => markFirstOpenDismissed(failing)).not.toThrow();
    expect(hasDismissedFirstOpen(null)).toBe(false);
    expect(() => markFirstOpenDismissed(null)).not.toThrow();
  });
});

describe('auto-dismiss hardening (CI diagnosis)', () => {
  it('any panel open dismisses first-open — a tab, Find, the filter sheet, or Ask', () => {
    const clean = {
      navTab: 'map',
      askOpen: false,
      findOpen: false,
      filterSheetOpen: false,
    };
    expect(shouldDismissFirstOpen(clean)).toBe(false);
    expect(shouldDismissFirstOpen({ ...clean, navTab: 'collections' })).toBe(true);
    expect(shouldDismissFirstOpen({ ...clean, navTab: 'progress' })).toBe(true);
    expect(shouldDismissFirstOpen({ ...clean, navTab: 'ask' })).toBe(true);
    expect(shouldDismissFirstOpen({ ...clean, askOpen: true })).toBe(true);
    expect(shouldDismissFirstOpen({ ...clean, findOpen: true })).toBe(true);
    expect(shouldDismissFirstOpen({ ...clean, filterSheetOpen: true })).toBe(true);
  });

  it('the selected-sheet Close ends first-open — opening a place does not', () => {
    expect(selectedSheetClosed('L629', null)).toBe(true);
    expect(selectedSheetClosed(null, 'L629')).toBe(false);
    expect(selectedSheetClosed(null, null)).toBe(false);
    expect(selectedSheetClosed('L629', 'L360')).toBe(false);
  });
});
