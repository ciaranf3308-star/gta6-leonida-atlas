import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ICON_COMPONENTS,
  iconKeyForAiCategory,
  iconKeyForAiRecord,
  iconKeyForLayer,
  iconKeyForPlace,
  placeIconSvg,
  type IconKey,
} from '../../src/features/map/place-icons';
import { AI_CATEGORIES, type AiCategoryRecord } from '../../src/features/categorise/categories';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import type { Place } from '../../src/domain/types';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-d406fea.json',
      import.meta.url,
    ),
    'utf8',
  ),
) as { landmarks: { id: string; tags: string[] }[] };

function fakePlace(tags: string[], layerId = 'community'): Place {
  return {
    id: 'L1',
    title: 'Test',
    description: '',
    category: 'exploration',
    position: { x: 0, y: 0 },
    layerId,
    tags,
    region: '',
    source: { title: '', url: '' },
    evidence: 'approximate',
  };
}

describe('place icons — one designed set, no coloured dots', () => {
  it('every icon key resolves to a real Lucide component', () => {
    for (const key of Object.keys(ICON_COMPONENTS) as IconKey[]) {
      expect(ICON_COMPONENTS[key], key).toBeDefined();
    }
  });

  it('every GTADB tag in the snapshot resolves to a known icon key', () => {
    const tags = new Set<string>();
    for (const record of snapshot.landmarks) for (const tag of record.tags) tags.add(tag);
    expect(tags.size).toBeGreaterThan(50);
    for (const tag of tags) {
      const key = iconKeyForPlace(fakePlace([tag]));
      expect(ICON_COMPONENTS[key], `tag ${tag}`).toBeDefined();
    }
  });

  it('every snapshot record gets an icon — the "?" records included', () => {
    for (const record of snapshot.landmarks) {
      const key = iconKeyForPlace(fakePlace(record.tags, 'uncertain'));
      expect(ICON_COMPONENTS[key], record.id).toBeDefined();
    }
  });

  it('every layer id has a glyph', () => {
    for (const layer of DEFAULT_LAYERS) {
      expect(ICON_COMPONENTS[iconKeyForLayer(layer.id)], layer.id).toBeDefined();
    }
    expect(iconKeyForLayer('cards:unknown-set')).toBe('gem');
    // Lootable reads as money at a glance — a $ in a circle, never a
    // banknote rectangle that can read as a "no" sign at pin size.
    expect(iconKeyForLayer('lootable')).toBe('dollarsign');
    expect(iconKeyForPlace(fakePlace([], 'lootable'))).toBe('dollarsign');
  });

  it('every AI category maps to a glyph, and a shop type refines it', () => {
    for (const category of AI_CATEGORIES) {
      expect(ICON_COMPONENTS[iconKeyForAiCategory(category)], category).toBeDefined();
    }
    expect(iconKeyForAiCategory('shop', 'supermarket')).toBe('shopping');
    expect(iconKeyForAiCategory('shop', 'petrol')).toBe('fuel');
    expect(iconKeyForAiCategory('gym')).toBe('gym');
    expect(iconKeyForAiCategory('house')).toBe('home');
  });

  it('an AI record wins over the source tags (a categorised "?" shows its type)', () => {
    const record = {
      placeId: 'L818',
      aiCategory: 'gym',
      confidence: 0.9,
      reason: 'test',
      model: 'gpt-4o-mini',
      indexedAt: '2026-11-23T00:00:00.000Z',
      status: 'suggested',
    } as AiCategoryRecord;
    expect(iconKeyForAiRecord(record)).toBe('gym');
    expect(iconKeyForAiRecord(undefined)).toBeNull();
    const unsure = { ...record, confidence: 0.2, status: 'unsure' } as AiCategoryRecord;
    expect(iconKeyForAiRecord(unsure)).toBeNull();
  });

  it('specific tags win over generic ones; enterable alone is a door', () => {
    expect(iconKeyForPlace(fakePlace(['#gas', 'retail']))).toBe('fuel');
    expect(iconKeyForPlace(fakePlace(['#guns', 'enterable']))).toBe('crosshair');
    expect(iconKeyForPlace(fakePlace(['enterable']))).toBe('door');
    expect(iconKeyForPlace(fakePlace([], 'uncertain'))).toBe('question');
    expect(iconKeyForPlace(fakePlace([]))).toBe('pin');
  });

  it('personal markers keep star / flag / workout', () => {
    expect(iconKeyForPlace({ ...fakePlace([]), layerId: 'my-markers', icon: 'star' })).toBe('star');
    expect(iconKeyForPlace({ ...fakePlace([]), layerId: 'my-markers', icon: 'flag' })).toBe('flag');
    expect(
      iconKeyForPlace({ ...fakePlace([]), layerId: 'my-markers', icon: 'pin', kind: 'workout' }),
    ).toBe('gym');
  });

  it('placeIconSvg renders a white-stroke SVG string (for Leaflet divIcons)', () => {
    const svg = placeIconSvg('gym', 17);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('stroke="#fff"');
    expect(svg).toContain('lucide-dumbbell');
    expect(placeIconSvg('gym', 17)).toBe(svg);
  });
});
