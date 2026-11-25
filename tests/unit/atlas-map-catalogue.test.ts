import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot, markerToPlace } from '../../src/data/catalogue';

const snapshot = JSON.parse(readFileSync(new URL('../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json', import.meta.url), 'utf8'));

describe('Atlas searchable catalogue', () => {
  it('retains all 4,380 community records, six regions, eight member gyms, three outdoor spots, five breakable-home examples, five cards and 49 Loot Map places, including 102 unpositioned records', () => {
    const places = catalogueFromSnapshot(snapshot);
    expect(places).toHaveLength(4456);
    expect(places.filter(p => p.position === null)).toHaveLength(102);
    expect(places.filter(p => p.layerId === 'regions')).toHaveLength(6);
    expect(places.filter(p => p.layerId === 'gyms')).toHaveLength(8);
    expect(places.filter(p => p.layerId === 'equipment')).toHaveLength(3);
    expect(places.filter(p => p.layerId === 'breakable' && p.id.startsWith('breakable:'))).toHaveLength(5);
    expect(places.filter(p => p.layerId.startsWith('cards:'))).toHaveLength(5);
    expect(places.filter(p => p.layerId === 'loot-heists')).toHaveLength(29);
    expect(places.filter(p => p.layerId === 'loot-collectibles')).toHaveLength(20);
    expect(places.filter(p => p.id.startsWith('loot:')).every(p => p.evidence === 'uncertain')).toBe(true);
    expect(new Set(places.map(p => p.id)).size).toBe(4456);
  });
  it('uses only source game coordinates and keeps approximate and uncertain evidence explicit', () => {
    const places = catalogueFromSnapshot(snapshot);
    for (const record of snapshot.landmarks) {
      const result = places.find(place => place.id === record.id)!;
      expect(result.position).toEqual(record.inGameCoordinates ? { x: record.inGameCoordinates[0], y: record.inGameCoordinates[1] } : null);
      expect(result.source.license).toBe('CC BY 4.0');
      expect(result.evidence).not.toBe('personal');
    }
    expect(places.find(p => p.id === 'L1')).toMatchObject({ evidence: 'approximate', layerId: 'community' });
    const uncertainRecord = snapshot.landmarks.find((record: { inGameAddress: string }) => record.inGameAddress.includes('?'))!;
    expect(places.find(p => p.id === uncertainRecord.id)).toMatchObject({ evidence: 'uncertain', layerId: 'uncertain' });
    expect(places.find(p => p.id === 'region:vice-city')).toMatchObject({ title: 'Vice City', evidence: 'approximate' });
  });
  it('rejects malformed or duplicate source records instead of manufacturing empty data', () => {
    expect(() => catalogueFromSnapshot({ landmarks: null })).toThrow();
    expect(() => catalogueFromSnapshot({ ...snapshot, landmarks: [snapshot.landmarks[0], snapshot.landmarks[0]] })).toThrow(/duplicate/i);
    expect(() => catalogueFromSnapshot({ ...snapshot, landmarks: [{ ...snapshot.landmarks[0], inGameCoordinates: [0, Infinity] }] })).toThrow();
  });
  it('maps personal markers to their own selectable layer without changing persisted identity', () => {
    const marker = { id: 'personal-1', title: 'My stop', description: 'Visit later', category: 'my-markers' as const, position: { x: 100, y: -90 }, icon: 'star' as const, createdAt: '2026-09-05', updatedAt: '2026-09-05' };
    expect(markerToPlace(marker)).toMatchObject({ id: marker.id, title: marker.title, position: marker.position, layerId: 'my-markers', evidence: 'personal' });
  });
});
