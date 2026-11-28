import { describe, expect, it } from 'vitest';
import {
  COLLECTIBLE_KIND_IDS,
  ICON_COMPONENTS,
  KIND_STYLES,
  iconKeyForPlace,
  isPlainResidential,
  kindForPlace,
  pinFormForPlace,
  pinStyleForPlace,
  placeIconSvg,
  type CollectibleKindId,
  type IconKey,
  type KindId,
} from '../../src/features/map/place-icons';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import { selectHeroPlaces } from '../../src/features/map/spatial';
import { LOOT_MAP_COLLECTIBLES } from '../../src/data/loot-map';
import type { AiCategoryRecord } from '../../src/features/categorise/categories';
import type { Place } from '../../src/domain/types';

function fakePlace(
  tags: string[],
  layerId = 'community',
  evidence: Place['evidence'] = 'approximate',
): Place {
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
    evidence,
  };
}

// The D-2 table (DECISIONS.md), verbatim — the test pins the spec, so
// a drift in either hex or glyph fails here first. The found tick
// badge with the new colours cannot run in this node-env suite
// (marker-icon.ts needs Leaflet + a DOM); it is asserted in the
// Playwright demo probe instead (scripts/check-v033-lane-b.mjs, (e)).
const D2_TABLE: Array<[KindId, string, IconKey]> = [
  ['cards', '#6FB7E8', 'gem'],
  ['loot-box', '#F2C230', 'package'],
  ['waink', '#A9805B', 'camera'],
  ['scoop', '#2EC4B6', 'package'],
  ['meteorite', '#9B7EDE', 'sparkles'],
  ['hoops', '#F28C28', 'target'],
  ['murals', '#F27FB0', 'brush'],
  ['flamingos', '#F27FB0', 'bird'],
  ['watches', '#B9BDC4', 'watch'],
  ['meditations', '#58B368', 'moon'],
  ['magazines', '#5B8DEF', 'book'],
  ['treasure', '#E8B64C', 'star'],
  ['easter-eggs', '#A8D94A', 'egg'],
  ['bottles', '#4AD0D8', 'mail'],
  ['underwater', '#2E6FB0', 'waves'],
  ['vehicles', '#F2A65A', 'car'],
  ['breakable', '#E07A5F', 'home'],
  ['gyms', '#ff8a5c', 'gym'],
  ['equipment', '#7ddb8a', 'weight'],
  ['weapons', '#c9a9ef', 'crosshair'],
];

describe('v0.33 Lane B — D-2 icon taxonomy', () => {
  it('every D-2 row resolves to exactly its colour + glyph', () => {
    expect(Object.keys(KIND_STYLES).sort()).toEqual(
      D2_TABLE.map(([kind]) => kind).sort(),
    );
    for (const [kind, color, icon] of D2_TABLE) {
      expect(KIND_STYLES[kind]).toEqual({ color, icon });
    }
  });

  it('no two kinds share a glyph AND a colour', () => {
    const seen = new Map<string, KindId>();
    for (const [kind, color, icon] of D2_TABLE) {
      const key = `${icon}@${color}`;
      expect(seen.get(key), `${kind} collides with ${seen.get(key)}`).toBeUndefined();
      seen.set(key, kind);
    }
  });

  it('every kind glyph is a real Lucide component and renders as SVG', () => {
    for (const [, , icon] of D2_TABLE) {
      expect(ICON_COMPONENTS[icon], icon).toBeDefined();
      const svg = placeIconSvg(icon, 17);
      expect(svg).toMatch(/^<svg /);
      expect(svg).toContain('stroke="#fff"');
    }
    // The new keys the table needed (no invented brand marks, no
    // closed-site assets — plain Lucide, same stroke/weight).
    for (const key of ['package', 'camera', 'bird', 'watch', 'moon', 'egg', 'mail', 'target'] as IconKey[]) {
      expect(ICON_COMPONENTS[key], key).toBeDefined();
    }
  });

  it('all 18 card sets share one light-blue card pin — never pink, never per-set', () => {
    const cardLayers = DEFAULT_LAYERS.filter((l) => l.id.startsWith('cards:'));
    expect(cardLayers).toHaveLength(18);
    for (const layer of cardLayers) {
      expect(layer.style.color, layer.id).toBe('#6FB7E8');
      expect(layer.icon, layer.id).toBe('gem');
    }
  });

  it('kind resolution: cards by layer, loot-collectibles by item tag', () => {
    expect(kindForPlace(fakePlace(['collectible', 'trading-card'], 'cards:delights-dancers'))).toBe('cards');
    expect(kindForPlace(fakePlace(['collectible', 'loot-map', 'meditation'], 'loot-collectibles'))).toBe('meditations');
    expect(kindForPlace(fakePlace(['collectible', 'loot-map', 'magazine'], 'loot-collectibles'))).toBe('magazines');
    expect(kindForPlace(fakePlace(['collectible', 'loot-map', 'watch'], 'loot-collectibles'))).toBe('watches');
    expect(kindForPlace(fakePlace(['collectible', 'loot-map', 'trading-card'], 'loot-collectibles'))).toBe('cards');
    // The Wonder Whale sculpture scan is a phone scan — the WAiNK
    // interaction — and the D-2 table has no separate scan kind.
    expect(kindForPlace(fakePlace(['collectible', 'loot-map', 'scan'], 'loot-collectibles'))).toBe('waink');
    expect(kindForPlace(fakePlace([], 'breakable'))).toBe('breakable');
    expect(kindForPlace(fakePlace(['gym'], 'gyms'))).toBe('gyms');
    expect(kindForPlace(fakePlace([], 'equipment'))).toBe('equipment');
    expect(kindForPlace(fakePlace(['#guns'], 'shops-weapons'))).toBe('weapons');
  });

  it('kind resolution never claims personal markers or unkinded places', () => {
    expect(kindForPlace({ ...fakePlace([], 'my-markers'), kind: 'breakable' })).toBeNull();
    expect(kindForPlace(fakePlace(['#gas'], 'shops-vehicles'))).toBeNull();
    expect(kindForPlace(fakePlace(['residential']))).toBeNull();
    expect(kindForPlace(fakePlace(['collectible', 'loot-map'], 'loot-collectibles'))).toBeNull();
  });

  it('the loot-collectibles split, derived from the real data — 10/5/3/1/1', () => {
    const byKind = new Map<KindId, number>();
    for (const item of LOOT_MAP_COLLECTIBLES) {
      const kind = kindForPlace(item);
      expect(kind, item.id).not.toBeNull();
      byKind.set(kind!, (byKind.get(kind!) ?? 0) + 1);
    }
    expect(Object.fromEntries(byKind)).toEqual({
      meditations: 10,
      magazines: 5,
      cards: 3,
      watches: 1,
      waink: 1,
    });
  });

  it('the kind colour wins over the layer colour; the glyph says what it is', () => {
    const cardLayer = DEFAULT_LAYERS.find((l) => l.id === 'cards:delights-dancers')!;
    expect(
      pinStyleForPlace(fakePlace(['collectible', 'trading-card'], 'cards:delights-dancers'), cardLayer, null),
    ).toEqual({ color: '#6FB7E8', icon: 'gem' });
    const lootLayer = DEFAULT_LAYERS.find((l) => l.id === 'loot-collectibles')!;
    expect(
      pinStyleForPlace(fakePlace(['collectible', 'loot-map', 'meditation'], 'loot-collectibles'), lootLayer, null),
    ).toEqual({ color: '#58B368', icon: 'moon' });
    expect(
      pinStyleForPlace(fakePlace(['collectible', 'loot-map', 'magazine'], 'loot-collectibles'), lootLayer, null),
    ).toEqual({ color: '#5B8DEF', icon: 'book' });
    expect(
      pinStyleForPlace(fakePlace(['collectible', 'loot-map', 'watch'], 'loot-collectibles'), lootLayer, null),
    ).toEqual({ color: '#B9BDC4', icon: 'watch' });
    expect(
      pinStyleForPlace(fakePlace(['collectible', 'loot-map', 'scan'], 'loot-collectibles'), lootLayer, null),
    ).toEqual({ color: '#A9805B', icon: 'camera' });
    expect(pinStyleForPlace(fakePlace([], 'breakable'), undefined, null)).toEqual({
      color: '#E07A5F',
      icon: 'home',
    });
    // A kinded place wears its kind glyph in every surface, not just
    // on the map — iconKeyForPlace consults the kind too.
    expect(iconKeyForPlace(fakePlace(['collectible', 'loot-map', 'meditation'], 'loot-collectibles'))).toBe('moon');
    expect(iconKeyForPlace(fakePlace(['collectible', 'trading-card'], 'cards:delights-dancers'))).toBe('gem');
  });

  it('unkinded places keep their layer colour and tag glyph', () => {
    const foodLayer = DEFAULT_LAYERS.find((l) => l.id === 'shops-food')!;
    expect(pinStyleForPlace(fakePlace(['#gas'], 'shops-vehicles'), undefined, null).icon).toBe('fuel');
    expect(pinStyleForPlace(fakePlace(['#gas'], 'shops-vehicles'), foodLayer, null).color).toBe('#7ec8e3');
    // A personal marker keeps its own colour, never a kind colour.
    const mine = fakePlace(['color:#123456'], 'my-markers');
    expect(pinStyleForPlace(mine, undefined, 'star').color).toBe('#123456');
  });
});

describe('v0.33 Lane B — D-2 residential dot rule + D-6 dot-shrinkage', () => {
  it('plain residential is a dot below street zoom, a full pin at street zoom', () => {
    const house = fakePlace(['residential']);
    expect(isPlainResidential(house)).toBe(true);
    for (const zoom of [-5, -2.5, -1, 0, 0.25]) {
      expect(pinFormForPlace(house, zoom), `zoom ${zoom}`).toBe('dot');
    }
    for (const zoom of [0.5, 1]) {
      expect(pinFormForPlace(house, zoom), `zoom ${zoom}`).toBe('pin');
    }
    // At street zoom the pin says what it is: a house.
    expect(iconKeyForPlace(house)).toBe('home');
  });

  it('a typed "?" house with no tags is plain residential too (tagless Capri houses)', () => {
    const record: AiCategoryRecord = {
      placeId: 'Lx',
      aiCategory: 'house',
      confidence: 0.9,
      reason: 'test',
      model: 'gpt-4o-mini',
      indexedAt: '2026-11-23T00:00:00.000Z',
      status: 'suggested',
    };
    const tagless = fakePlace([], 'uncertain');
    expect(isPlainResidential(tagless, record)).toBe(true);
    expect(pinFormForPlace(tagless, -1, record)).toBe('dot');
    expect(pinFormForPlace(tagless, 1, record)).toBe('pin');
  });

  it('breakable / enterable houses are never dots — a breakable house IS a house', () => {
    expect(isPlainResidential(fakePlace(['residential', 'enterable'], 'breakable'))).toBe(false);
    expect(isPlainResidential(fakePlace(['residential', 'enterable']))).toBe(false);
    for (const zoom of [-5, -1, 0.5, 1]) {
      expect(pinFormForPlace(fakePlace(['residential', 'enterable'], 'breakable'), zoom)).toBe('pin');
    }
    expect(iconKeyForPlace(fakePlace(['residential', 'enterable'], 'breakable'))).toBe('home');
  });

  it('collectible kinds shrink to dots at island zoom, full pins by district zoom', () => {
    const card = fakePlace(['collectible', 'trading-card'], 'cards:delights-dancers');
    const meditation = fakePlace(['collectible', 'loot-map', 'meditation'], 'loot-collectibles');
    for (const place of [card, meditation]) {
      expect(pinFormForPlace(place, -5)).toBe('dot');
      expect(pinFormForPlace(place, -2.5)).toBe('dot');
      expect(pinFormForPlace(place, -2.4)).toBe('pin');
      expect(pinFormForPlace(place, -1)).toBe('pin');
      expect(pinFormForPlace(place, 1)).toBe('pin');
    }
    // Non-collectible kinds never shrink: gyms, interiors, shops.
    expect(pinFormForPlace(fakePlace(['gym'], 'gyms'), -5)).toBe('pin');
    expect(pinFormForPlace(fakePlace(['enterable'], 'interiors'), -5)).toBe('pin');
    expect(pinFormForPlace(fakePlace(['#gas'], 'shops-vehicles'), -5)).toBe('pin');
  });

  it('every collectible kind in the table is dot-eligible', () => {
    for (const kind of Object.keys(KIND_STYLES) as KindId[]) {
      const collectible = [
        'cards', 'loot-box', 'waink', 'scoop', 'meteorite', 'hoops', 'murals',
        'flamingos', 'watches', 'meditations', 'magazines', 'treasure',
        'easter-eggs', 'bottles', 'underwater', 'vehicles',
      ].includes(kind);
      expect(COLLECTIBLE_KIND_IDS.has(kind as CollectibleKindId)).toBe(collectible);
    }
  });
});

describe('v0.33 Lane B — D-6 hero exemption for a soloed set', () => {
  const card = (id: string, x: number, y: number): Place => ({
    id,
    title: id,
    description: '',
    category: 'collectibles',
    position: { x, y },
    layerId: 'cards:delights-dancers',
    tags: ['collectible', 'trading-card'],
    region: '',
    source: { title: 'Test', url: '' },
    evidence: 'approximate',
  });

  it('all five Delights pins show when the set is soloed, sharing one cell', () => {
    // The real Delights 5: Vicki + Victor Maravilla share the Starlet
    // Motel cell, Jason sits in the Delights cell, Kandi and Perla
    // island-wide. Synthetic same-cell bunching is the hard case.
    const places: Place[] = [
      card('card:vicki', -5354, 3461),
      card('card:victor-maravilla', -5354, 3461),
      card('card:jason', -6373, 3576),
      card('card:kandi', -1207, -41),
      card('card:perla', -2200, 701),
    ];
    const exempt = new Set(['cards:delights-dancers']);
    const hero = selectHeroPlaces(places, 24, exempt);
    expect(hero.map((p) => p.id).sort()).toEqual([
      'card:jason',
      'card:kandi',
      'card:perla',
      'card:vicki',
      'card:victor-maravilla',
    ]);
    // Without the exemption the cell collapse keeps one per cell.
    const collapsed = selectHeroPlaces(places, 24);
    expect(collapsed.length).toBeLessThan(5);
    expect(collapsed.map((p) => p.id)).toContain('card:vicki');
  });

  it('the exemption admits only the soloed set — never an unnamed pin, never the rest', () => {
    const places: Place[] = [
      card('card:vicki', -5354, 3461),
      card('card:jason', -6373, 3576),
      { ...card('card:unnamed', -5354, 3461), title: '?' },
      ...Array.from({ length: 40 }, (_, i) => ({
        ...card(`other-${i}`, 100 + (i % 5), 100 + Math.floor(i / 5)),
        layerId: 'shops-food',
        tags: [] as string[],
      })),
    ];
    const hero = selectHeroPlaces(places, 24, new Set(['cards:delights-dancers']));
    expect(hero.map((p) => p.id)).toContain('card:vicki');
    expect(hero.map((p) => p.id)).toContain('card:jason');
    expect(hero.some((p) => p.id === 'card:unnamed')).toBe(false);
    // The 40 bunched shops still collapse to one hero pin.
    expect(hero.filter((p) => p.layerId === 'shops-food')).toHaveLength(1);
  });

  it('outside a set drive the hero rule stands (max 24, one per cell)', () => {
    const places: Place[] = Array.from({ length: 60 }, (_, i) =>
      card(`named-${i}`, -8000 + i * 300, -4000 + i * 200),
    );
    const hero = selectHeroPlaces(places);
    expect(hero.length).toBeLessThanOrEqual(24);
  });
});
