import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { COUNTIES } from '../../src/data/counties';
import { CATEGORIES } from '../../src/app/categories';

/**
 * v0.12.0 mobile redesign, from scratch — the guards that stop the old
 * design creeping back. The user rated v0.11.0 a 6: tweaks on a design
 * he hates. So the filter bar is deleted, the map is clean, and Find /
 * Layers / place detail are proper screens — and these tests fail if
 * any of that regresses.
 */
describe('v0.12.0 mobile redesign', () => {
  it('has five counties plus All Leonida — six county cards', () => {
    expect(COUNTIES.map((c) => c.id)).toEqual([
      'lummox',
      'kelly',
      'leonard',
      'vice-dale',
      'mariana',
    ]);
    for (const county of COUNTIES) {
      expect(county.name).toMatch(/ County$/);
      expect(county.area.length).toBeGreaterThan(0);
    }
  });

  it('has seven place kinds, including My markers', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'all',
      'region',
      'landmark',
      'nature',
      'transport',
      'business',
      'personal',
    ]);
  });

  it('has no FilterBar anywhere — the file is deleted and nothing imports it', async () => {
    expect(existsSync(new URL('../../src/app/FilterBar.tsx', import.meta.url))).toBe(false);
    for (const file of [
      '../../src/app/App.tsx',
      '../../src/app/Sidebar.tsx',
      '../../src/features/editor/MarkerEditor.tsx',
    ]) {
      const source = await readFile(new URL(file, import.meta.url), 'utf8');
      expect(source).not.toContain('FilterBar');
    }
  });

  it('the map is clean: hero banner + one search pill + chips, nothing else over it', async () => {
    const app = await readFile(new URL('../../src/app/App.tsx', import.meta.url), 'utf8');
    expect(app).toContain('map-hero');
    expect(app).toContain('map-search-pill');
    expect(app).toContain('map-hero-banner');
    expect(app).toContain('map-chips');
    expect(app).not.toContain('map-add-buttons');
    expect(app).not.toContain('FilterBar');
  });

  it('Find has its own county + kind filters and Layers has county cards', async () => {
    const sidebar = await readFile(
      new URL('../../src/app/Sidebar.tsx', import.meta.url),
      'utf8',
    );
    expect(sidebar).toContain('county-card');
    expect(sidebar).toContain('find-filters');
    expect(sidebar).toContain('index-reminder');
    expect(sidebar).toContain('add-section');
  });

  it('place detail is a full bottom sheet with a hero and badges', async () => {
    const details = await readFile(
      new URL('../../src/features/library/PlaceDetails.tsx', import.meta.url),
      'utf8',
    );
    expect(details).toContain('place-sheet');
    expect(details).toContain('sheet-grabber');
    expect(details).toContain('place-hero');
    expect(details).toContain('place-badges');
    expect(details).toContain('place-actions');
    expect(details).not.toContain('detail-panel');
  });

  it('the stylesheet is the fresh phone-first one, not the layered old one', async () => {
    const css = await readFile(new URL('../../src/app/atlas.css', import.meta.url), 'utf8');
    for (const selector of [
      '.map-hero',
      '.map-search-pill',
      '.place-sheet',
      '.county-card',
      '.find-filters',
      '.index-reminder',
      '.place-hero-icon',
    ])
      expect(css).toContain(selector);
    expect(css).not.toContain('.filter-bar');
    expect(css).not.toContain('.filter-chip');
    expect(css).not.toContain('Navigation-first rebuild');
    expect(css).not.toContain('de-clutter');
  });
});
