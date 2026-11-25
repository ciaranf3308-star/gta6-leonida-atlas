import { describe, expect, it } from 'vitest';
import type { LayerDefinition, Place } from '../../src/domain/types';
import {
  askAllowedLayerIds,
  isPlaceVisible,
  revealSet,
  visiblePlaces,
} from '../../src/features/spoiler/visibility';

function layer(id: string, visible: boolean): LayerDefinition {
  return {
    id,
    name: id,
    description: '',
    category: 'activity',
    mapIndex: 'activities',
    visible,
    order: 1,
    source: 'test',
    style: { color: '#fff', radius: 6 },
    icon: 'pin',
    interactive: true,
  };
}

function place(id: string, layerId: string): Place {
  return {
    id,
    title: id,
    description: '',
    layerId,
    region: 'Vice City',
    position: { x: 0, y: 0 },
    tags: [],
    category: 'exploration',
    source: { title: 'test', url: '' },
    evidence: 'approximate',
  };
}

const layers = [
  layer('gyms', false),
  layer('lootable', false),
  layer('interiors', true),
  layer('my-markers', true),
];

describe('spoiler visibility — the deterministic rule', () => {
  it('a place is visible only when its layer is on, it is revealed, or it is the user’s own marker', () => {
    expect(isPlaceVisible(place('L1', 'gyms'), layers)).toBe(false);
    expect(isPlaceVisible(place('L1', 'gyms'), layers, new Set(['L1']))).toBe(true);
    expect(isPlaceVisible(place('L2', 'interiors'), layers)).toBe(true);
    expect(isPlaceVisible(place('M1', 'my-markers'), layers)).toBe(true);
  });

  it('visiblePlaces never returns a hidden-layer place that was not revealed', () => {
    const places = [
      place('L1', 'gyms'),
      place('L2', 'lootable'),
      place('L3', 'interiors'),
      place('M1', 'my-markers'),
    ];
    expect(visiblePlaces(places, layers).map((p) => p.id)).toEqual(['L3', 'M1']);
    expect(
      visiblePlaces(places, layers, new Set(['L1'])).map((p) => p.id),
    ).toEqual(['L1', 'L3', 'M1']);
  });

  it('an Ask scope is only the layers the question asked for — a visible but unasked layer never joins', () => {
    // interiors is ON, but the question asked for gyms only.
    expect([...askAllowedLayerIds(['gyms'], layers)].sort()).toEqual([
      'gyms',
      'my-markers',
    ]);
  });

  it('a general question with no layer asked for scopes to the layers already visible', () => {
    expect([...askAllowedLayerIds([], layers)].sort()).toEqual([
      'interiors',
      'my-markers',
    ]);
  });
});

describe('spoiler visibility — reveal one place, never its layer (v0.30.0)', () => {
  it('the reveal set is the highlights plus the selected place — nothing else', () => {
    // No highlights, no selection: nothing is revealed.
    expect(revealSet([], null).size).toBe(0);
    // A selected place joins the set even when its layer is off, so
    // its pin renders while its sheet is open.
    expect(revealSet([], 'L1')).toEqual(new Set(['L1']));
    // Highlights are kept, and the selected place joins them.
    expect(revealSet(['L2', 'L3'], 'L1')).toEqual(
      new Set(['L1', 'L2', 'L3']),
    );
    // A layer is never in the set — the set holds place ids only, so
    // revealing one place can never switch on a whole layer.
    expect(revealSet(['L2'], null)).toEqual(new Set(['L2']));
  });

  it('a revealed place renders with its layer off; its layer-mates do not', () => {
    const places = [
      place('L1', 'gyms'),
      place('L2', 'gyms'),
      place('L3', 'gyms'),
    ];
    const revealed = visiblePlaces(places, layers, revealSet([], 'L1'));
    expect(revealed.map((p) => p.id)).toEqual(['L1']);
  });

  it('clearing the highlights and the selection leaves the map clean again', () => {
    const places = [place('L1', 'gyms'), place('M1', 'my-markers')];
    expect(
      visiblePlaces(places, layers, revealSet([], null)).map((p) => p.id),
    ).toEqual(['M1']);
  });
});
