import { describe, expect, it } from 'vitest';
import { gtadbTileUrl, leafletTileToGtadb } from '../../src/features/map/gtadb-tiles';
import { COUNTIES, countyForPlace, countyIdFromText } from '../../src/data/counties';
import { layerForGtadbLandmark } from '../../src/data/catalogue';
import { COLLECTABLE_CARD_PLACES, COLLECTABLE_SETS, COLLECTABLE_TOTAL } from '../../src/data/collectables';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import type { GtadbLandmark } from '../../src/features/street-leonida/gtadb';

const landmark = (tags: readonly string[]): GtadbLandmark => ({
  id: 'L9999',
  inGameAddress: 'Test Place, Vice City',
  inGameCoordinates: [0, 0],
  inGamePhotoSize: null,
  realWorldAddress: '',
  realWorldCoordinates: null,
  realWorldPhotoSize: null,
  tags,
  color: '000000',
  editedAt: [0, 0, 0],
  confidence: 'SUPPORTED',
  evidence: {
    name: 'KNOWN',
    placement: 'APPROXIMATE',
    tagSignals: { levelTags: [], unconfirmed: false, demolished: false },
  },
});

describe('GTADB In-Game Day tiles', () => {
  it('maps Leaflet zoom -5..1 onto tile zooms 0..6', () => {
    expect(leafletTileToGtadb(0, 0, -5)).toEqual({ zoom: 0, tileX: 2, tileY: 2 });
    expect(leafletTileToGtadb(0, 0, 1)).toEqual({ zoom: 6, tileX: 128, tileY: 128 });
  });

  it('places Ajax Gym (1420, 1766) on the verified day tiles', () => {
    // Canonical (1420, 1766): z5 tile (57, 69) shows SW 4th St; z6 tile (114, 139).
    // Leaflet tile coords at zoom 0 (tile zoom 5): x = floor(1420/256) = 5,
    // y = floor(-1766/256) = -7.
    expect(leafletTileToGtadb(5, -7, 0)).toEqual({ zoom: 5, tileX: 69, tileY: 57 });
    // Leaflet zoom 1 (tile zoom 6): x = floor(1420/128) = 11, y = floor(-1766/128) = -14.
    expect(leafletTileToGtadb(11, -14, 1)).toEqual({ zoom: 6, tileX: 139, tileY: 114 });
    expect(gtadbTileUrl('/gta6-leonida-atlas/', 5, -7, 0)).toBe(
      '/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/graded/5/5,57,69.jpg',
    );
  });

  it('covers the z0 grid 3 wide by 4 tall', () => {
    expect(leafletTileToGtadb(-2, -2, -5)).toEqual({ zoom: 0, tileX: 0, tileY: 0 });
    expect(leafletTileToGtadb(0, 1, -5)).toEqual({ zoom: 0, tileX: 2, tileY: 3 });
  });

  it('serves the graded pyramid at every tile zoom 0-6 (one style, no switch)', () => {
    // v0.28.0 (2026-11-25): the real GTADB day tiles through one
    // colour grade only — the ViceWire repaint is dead. No z3 -> z4
    // style cliff by construction. Pin coordinates never change:
    // the tile file name is the same at every zoom.
    expect(gtadbTileUrl('/gta6-leonida-atlas/', -2, -2, -5)).toBe(
      '/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/graded/0/0,0,0.jpg',
    );
    expect(gtadbTileUrl('/gta6-leonida-atlas/', 0, 0, -2)).toContain(
      '/tiles/graded/3/',
    );
    expect(gtadbTileUrl('/gta6-leonida-atlas/', 0, 0, -1)).toContain(
      '/tiles/graded/4/',
    );
    expect(gtadbTileUrl('/gta6-leonida-atlas/', 5, -7, 0)).toBe(
      '/gta6-leonida-atlas/assets/gta6-leonida-atlas/tiles/graded/5/5,57,69.jpg',
    );
    expect(gtadbTileUrl('/gta6-leonida-atlas/', 0, 0, -2)).toContain('3,');
    expect(gtadbTileUrl('/gta6-leonida-atlas/', 0, 0, -1)).toContain('4,');
  });
});

describe('Counties', () => {
  it('has five counties with estimated, non-empty extents', () => {
    expect(COUNTIES.map((c) => c.id)).toEqual([
      'lummox',
      'kelly',
      'leonard',
      'vice-dale',
      'mariana',
    ]);
    for (const county of COUNTIES) {
      expect(county.bounds.east).toBeGreaterThan(county.bounds.west);
      expect(county.bounds.north).toBeGreaterThan(county.bounds.south);
    }
  });

  it('reads the county from a GTADB address', () => {
    expect(countyIdFromText('Starlet Motel, Historic Route 628, Kelly County')).toBe('kelly');
    expect(countyIdFromText('Somewhere, Vice City')).toBeNull();
  });

  it('assigns known places to their counties', () => {
    // Starlet Motel, Kelly County, at (-5354, 3461).
    expect(
      countyForPlace({
        position: { x: -5354.67, y: 3461.862 },
        region: 'Historic Route 628, Kelly County',
        title: 'Starlet Motel',
      }),
    ).toBe('kelly');
    // Grand Majestic, Vice City (-1065, -1317): inside both Vice-Dale and
    // Mariana rects; nearest rect centre wins — Vice-Dale.
    expect(
      countyForPlace({
        position: { x: -1065.2, y: -1317.3 },
        region: 'Tequesta, Vice City',
        title: 'Grand Majestic',
      }),
    ).toBe('vice-dale');
    // Jason's House, Key Lento (-2353, -5532): Mariana only.
    expect(
      countyForPlace({
        position: { x: -2353.531, y: -5532.255 },
        region: 'Key Lento',
        title: "Jason's House",
      }),
    ).toBe('mariana');
    // Unpositioned places have no county.
    expect(countyForPlace({ position: null, region: '', title: 'Nowhere' })).toBeNull();
  });
});

describe('Interiors / shops / lootable layer assignment', () => {
  it('keeps uncertain records in uncertain whatever their tags say', () => {
    expect(layerForGtadbLandmark(landmark(['enterable', 'retail']), true)).toBe('uncertain');
  });

  it('puts robbable enterable shops in lootable, other shops in the split shops-* layers, other enterable in interiors', () => {
    expect(layerForGtadbLandmark(landmark(['enterable', 'retail']), false)).toBe('lootable');
    expect(layerForGtadbLandmark(landmark(['enterable', '#gas']), false)).toBe('lootable');
    expect(layerForGtadbLandmark(landmark(['enterable', '#guns']), false)).toBe('shops-weapons');
    expect(layerForGtadbLandmark(landmark(['#hair']), false)).toBe('shops-style');
    expect(layerForGtadbLandmark(landmark(['enterable', 'hotel']), false)).toBe('interiors');
    expect(layerForGtadbLandmark(landmark(['hotel']), false)).toBe('community');
  });
});

describe('Collectable card sets', () => {
  it('covers 18 sets totalling 480 cards, with one toggle layer per set', () => {
    expect(COLLECTABLE_SETS).toHaveLength(18);
    expect(COLLECTABLE_TOTAL).toBe(480);
    for (const set of COLLECTABLE_SETS) {
      const layer = DEFAULT_LAYERS.find((l) => l.id === `cards:${set.id}`);
      expect(layer?.visible).toBe(false);
      expect(layer?.name).toContain(set.name);
    }
  });

  it('pins only cards whose host building is verified, never by guess', () => {
    expect(COLLECTABLE_CARD_PLACES).toHaveLength(20);
    for (const card of COLLECTABLE_CARD_PLACES) {
      expect(card.position).not.toBeNull();
      expect(card.evidence).toBe('approximate');
      expect(card.source.url).toMatch(/^https:\/\//);
    }
    expect(COLLECTABLE_CARD_PLACES.map((c) => c.id).sort()).toEqual([
      'card:anthony-poke-ii',
      'card:braelynn-pink',
      'card:brianna-blue-purple',
      'card:bryson-powers',
      'card:chrissie-deep-red',
      'card:flamer-red',
      'card:jason',
      'card:kandi',
      'card:kyle-lewicky',
      'card:lexi-campbell',
      'card:luke-x',
      'card:meghan-bronze',
      'card:perla',
      'card:pricilla-pace-gold',
      'card:reggie-pierce',
      'card:right-wing-red',
      'card:tusi-taufua',
      'card:ulysses-whitlock',
      'card:vicki',
      'card:victor-maravilla',
    ]);
  });
});
