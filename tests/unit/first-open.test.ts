import { describe, expect, it } from 'vitest';
import type { Place } from '../../src/domain/types';
import { firstOpenPlace } from '../../src/features/onboarding/first-open';

const place = (id: string, title: string): Place => ({
  id,
  title,
  description: '',
  category: 'exploration',
  position: { x: 0, y: 0 },
  layerId: 'regions',
  tags: [],
  region: title,
  evidence: 'approximate',
  source: { title: 'Rockstar Games', url: '', license: 'Official name' },
});

describe('first-open region sheet', () => {
  it('opens on the real Vice City region record', () => {
    const places = [place('region:port-gellhorn', 'Port Gellhorn'), place('region:vice-city', 'Vice City')];
    expect(firstOpenPlace(places)?.id).toBe('region:vice-city');
  });

  it('has no sheet when the catalogue carries no Vice City region', () => {
    expect(firstOpenPlace([place('region:port-gellhorn', 'Port Gellhorn')])).toBeUndefined();
    expect(firstOpenPlace([])).toBeUndefined();
  });
});
