import { describe, expect, it } from 'vitest';
import type { AiCategoryRecord } from '../../src/features/categorise/categories';
import { isPlacePinnable } from '../../src/features/map/pin-visibility';

/**
 * §A9.3 / v0.33 D-1 — a "?" record renders as NOTHING on the map until
 * typed. The gate is isPlacePinnable (the single choke point MapView
 * filters through before hero selection, clustering and marker
 * creation); these tests pin its truth table, including the routes
 * that do and do not count as "typed".
 */
const place = (id: string, title: string, layerId = 'community') => ({
  id,
  title,
  layerId,
});

const record = (
  placeId: string,
  overrides: Partial<AiCategoryRecord> = {},
): AiCategoryRecord => ({
  placeId,
  aiCategory: 'house',
  confidence: 0.87,
  reason: 'Analogue address is an apartment tower; tagged residential.',
  model: 'gpt-4o-mini',
  indexedAt: '2026-11-28T00:00:00.000Z',
  status: 'suggested',
  source: 'ai',
  ...overrides,
});

describe('§A9.3 — the pin gate', () => {
  it('a named place pins with no index record', () => {
    expect(isPlacePinnable(place('L190', 'NINE1NINE, Downtown, Vice City'))).toBe(true);
  });

  it('a "?" record with no index record draws nothing', () => {
    expect(isPlacePinnable(place('L1', '?, Downtown, Vice City'))).toBe(false);
  });

  it('a bare "?" record (no address, no tags) draws nothing', () => {
    expect(isPlacePinnable(place('L2', '?'))).toBe(false);
  });

  it('a "? (N)" record draws nothing until typed', () => {
    expect(isPlacePinnable(place('L3', '? (N), Ocean Beach, Vice Beach'))).toBe(false);
  });

  it('a typed "?" place pins — the index job is the typing route', () => {
    const categories = { L1: record('L1') };
    expect(isPlacePinnable(place('L1', '?, Downtown, Vice City'), categories)).toBe(true);
  });

  it('a tag-resolved type counts — the job stores its deterministic steps too', () => {
    const categories = { L1: record('L1', { source: 'tag' }) };
    expect(isPlacePinnable(place('L1', '?, Downtown, Vice City'), categories)).toBe(true);
  });

  it('a "not sure" record does not type the place', () => {
    const categories = { L1: record('L1', { status: 'unsure', confidence: 0.4 }) };
    expect(isPlacePinnable(place('L1', '?, Downtown, Vice City'), categories)).toBe(false);
  });

  it('a low-confidence suggestion (below the 0.60 floor) does not type the place', () => {
    const categories = { L1: record('L1', { confidence: 0.5 }) };
    expect(isPlacePinnable(place('L1', '?, Downtown, Vice City'), categories)).toBe(false);
  });

  it('a player-corrected type counts as typed', () => {
    const categories = {
      L1: record('L1', { status: 'corrected', userCategory: 'shop' }),
    };
    expect(isPlacePinnable(place('L1', '?, Downtown, Vice City'), categories)).toBe(true);
  });

  it('a correction with no replacement type does not type the place', () => {
    const categories = {
      L1: record('L1', { status: 'corrected', userCategory: undefined }),
    };
    expect(isPlacePinnable(place('L1', '?, Downtown, Vice City'), categories)).toBe(false);
  });

  it('the player’s own marker is exempt — its title is the player’s own words', () => {
    expect(isPlacePinnable(place('m1', '?', 'my-markers'))).toBe(true);
  });

  it('a tentative named place ("Parsons Hotel?") is named, so it pins — the rule is about unnamed, not about tentative', () => {
    expect(isPlacePinnable(place('L4', 'Parsons Hotel?'))).toBe(true);
  });
});
