import { describe, expect, it, vi } from 'vitest';
import type { LayerDefinition, Place } from '../../src/domain/types';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import { retrieveForAsk, layersRequestedByQuestion } from '../../src/features/ask/retrieval';
import {
  askOpenAi,
  buildAskSystemPrompt,
  formatRecordsForPrompt,
  parsePlaceMentions,
} from '../../src/features/ask/openai';

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'title' | 'layerId'>): Place {
  return {
    description: '',
    category: 'business',
    position: { x: 0, y: 0 },
    tags: [],
    region: '',
    source: { title: 'test', url: '' },
    evidence: 'approximate',
    ...overrides,
  };
}

const layers = (): LayerDefinition[] =>
  DEFAULT_LAYERS.map((layer) => ({ ...layer, visible: false }));

const FIXTURES: Place[] = [
  place({
    id: 'gym:dynamix',
    title: 'Dynamix Fitness',
    layerId: 'gyms',
    position: { x: -366, y: 1514 },
    region: 'Vice City',
    tags: ['gym'],
  }),
  place({
    id: 'gym:north-gym',
    title: 'North Gym',
    layerId: 'gyms',
    position: { x: -5000, y: 6000 },
    region: 'Mount Kalaga',
    tags: ['gym'],
  }),
  place({
    id: 'gym:muscle-sands',
    title: 'Muscle Sands',
    layerId: 'gyms-outdoor',
    position: { x: 2019, y: 407 },
    region: 'Ocean Beach',
    tags: ['gym', 'free', 'outdoor'],
  }),
  place({
    id: 'L1001',
    title: 'Corner Store, Capri',
    layerId: 'lootable',
    position: { x: 100, y: 100 },
    region: 'Capri',
    tags: ['enterable', 'retail'],
  }),
  place({
    id: 'L1002',
    title: 'Liquor Store, Capri',
    layerId: 'lootable',
    position: { x: 200, y: 120 },
    region: 'Capri',
    tags: ['enterable', '#liquor'],
  }),
  place({
    id: 'L1003',
    title: 'Grocery, Vice City',
    layerId: 'lootable',
    position: { x: -500, y: -500 },
    region: 'Vice City',
    tags: ['enterable', '#supermarket'],
  }),
  // A card pinned at the same building as a lootable place — the leak test.
  place({
    id: 'card:vicki',
    title: 'Vicki — Delights Dancers',
    layerId: 'cards:delights-dancers',
    position: { x: 100, y: 100 },
    region: 'Corner Store, Capri',
    tags: ['collectible', 'card'],
  }),
  place({
    id: 'L2001',
    title: 'Starlet Motel',
    layerId: 'interiors',
    position: { x: -5354, y: 3461 },
    region: 'Kelly County',
    tags: ['enterable', 'hotel'],
  }),
];

describe('Ask Nylah — the spoiler rule', () => {
  it('asking for a gym opts the gym layer in even when it is off', () => {
    const result = retrieveForAsk({
      question: 'I need to hit some gains — any ideas?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toContain('gyms');
    expect(result.records.map((p) => p.id)).toContain('gym:dynamix');
    expect(result.records.map((p) => p.id)).toContain('gym:muscle-sands');
  });

  it('a named area scopes the answer to that area', () => {
    const result = retrieveForAsk({
      question: "I'm up north beside Mount Kalaga, need to hit some gains — any ideas?",
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.areaLabel).toBe('mount kalaga');
    expect(result.records.map((p) => p.id)).toEqual(['gym:north-gym']);
  });

  it('a gyms-north question returns only the northern gyms', () => {
    const result = retrieveForAsk({
      question: 'Need to hit some gains up north — where?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.areaLabel).toBe('north');
    expect(result.records.map((p) => p.id)).toEqual(['gym:north-gym']);
  });

  it('a burglary question returns lootable records only — never card names', () => {
    const result = retrieveForAsk({
      question:
        'Thinking of hitting some burglaries in Capri — highlight all the houses I can hit tonight.',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toEqual(['lootable']);
    expect(result.records.map((p) => p.id).sort()).toEqual(['L1001', 'L1002']);
    // The card at the same building is never in the records, so the AI
    // cannot volunteer it — and neither can the result list.
    expect(result.records.map((p) => p.title).join(' ')).not.toMatch(/Vicki|Delights/);
    expect(layersRequestedByQuestion('highlight the houses I can hit tonight', layers())).toEqual([
      'lootable',
    ]);
  });

  it('a collectable question with its layer off is still answered — asking opts it in', () => {
    const result = retrieveForAsk({
      question: 'Where is the Vicki card?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toContain('cards:delights-dancers');
    expect(result.records.map((p) => p.id)).toContain('card:vicki');
  });

  it('a scoped gym question never returns a visible-but-unasked layer', () => {
    const visibleLayers = layers().map((layer) =>
      layer.id === 'interiors' ? { ...layer, visible: true } : layer,
    );
    const result = retrieveForAsk({
      question: 'Where can I train?',
      places: FIXTURES,
      layers: visibleLayers,
      filters: { hideFound: false, remainingOnly: false, countyId: 'kelly' },
    });
    // No gym is in Kelly, so it falls back to the nearest gyms and says so
    // — it must not answer a gym question with a Kelly interior.
    expect(result.areaMismatch).toBe(true);
    expect(result.records.every((p) => ['gyms', 'gyms-outdoor'].includes(p.layerId))).toBe(true);
    expect(result.records.map((p) => p.id)).toContain('gym:dynamix');
    expect(result.records.map((p) => p.id)).not.toContain('L2001');
  });

  it('a general question uses visible layers only — hidden layers stay hidden', () => {
    const visibleLayers = layers().map((layer) =>
      layer.id === 'shops' || layer.id === 'lootable' ? { ...layer, visible: true } : layer,
    );
    const result = retrieveForAsk({
      question: "What's around here?",
      places: FIXTURES,
      layers: visibleLayers,
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.requestedLayerIds).toEqual([]);
    expect(result.records.every((p) => ['shops', 'lootable', 'personal'].includes(p.layerId))).toBe(
      true,
    );
    expect(result.records.map((p) => p.id)).not.toContain('gym:dynamix');
    expect(result.records.map((p) => p.id)).not.toContain('card:vicki');
  });

  it('respects hideFound / remainingOnly', () => {
    const result = retrieveForAsk({
      question: 'Where can I train?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: true, remainingOnly: false, countyId: null },
      visitedIds: ['gym:dynamix', 'gym:muscle-sands'],
    });
    expect(result.records.map((p) => p.id)).toEqual(['gym:north-gym']);
  });

  it('falls back to nearest when the scoped area has nothing, and says so', () => {
    const result = retrieveForAsk({
      question: 'Lootable houses in Lummox County tonight?',
      places: FIXTURES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.areaMismatch).toBe(true);
    expect(result.records.length).toBeGreaterThan(0);
    expect(result.records.every((p) => p.layerId === 'lootable')).toBe(true);
  });

  it('caps records at 30', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      place({ id: `gym:x${i}`, title: `Gym ${i}`, layerId: 'gyms', position: { x: i, y: 0 } }),
    );
    const result = retrieveForAsk({
      question: 'Where can I train?',
      places: many,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records).toHaveLength(30);
    expect(result.totalInScope).toBe(40);
  });
});

describe('Ask Nylah — OpenAI client', () => {
  it('system prompt scopes to the asked layers and forbids extras', () => {
    const prompt = buildAskSystemPrompt(['Gyms / Strength']);
    expect(prompt).toContain('Gyms / Strength');
    expect(prompt).not.toContain('Cards');
    expect(prompt).not.toContain('Lootable');
    expect(prompt).toMatch(/only what was asked/i);
  });

  it('parses only mentions of records that were actually sent', async () => {
    const records = FIXTURES.filter((p) => p.layerId === 'lootable');
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content:
                'Hit Corner Store, Capri first — and Vicki is in there too, plus the Starlet Motel.',
            },
          },
        ],
      }),
    } as unknown as Response);
    const answer = await askOpenAi({
      question: 'Lootable houses in Capri?',
      records,
      requestedLayerNames: ['Lootable buildings'],
      apiKey: 'sk-test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(answer).toContain('Corner Store');
    // Vicki / Starlet Motel were never sent, so they can never be highlights.
    expect(parsePlaceMentions(answer, records).map((p) => p.id)).toEqual(['L1001']);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1].body));
    expect(body.model).toBe('gpt-4o-mini');
    expect(JSON.stringify(body)).not.toContain('Vicki');
  });

  it('surfaces API errors verbatim instead of faking an answer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Incorrect API key provided',
    } as unknown as Response);
    await expect(
      askOpenAi({
        question: 'Where can I train?',
        records: FIXTURES.slice(0, 1),
        requestedLayerNames: ['Gyms / Strength'],
        apiKey: 'sk-bad',
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow('401');
  });
});

describe('Ask Nylah — real proximity (the Capri gyms case)', () => {
  // The user's exact case, with real coordinates: Capri is at about
  // x -6,500, y 0 (west side); every gym is in Vice City (east side).
  // The nearest gym to Capri is Grand Majestic, ~5,700 map units away.
  const CAPRI_PLACES: Place[] = [
    place({
      id: 'L672',
      title: 'Train Bridge, Capri',
      layerId: 'community',
      position: { x: -6837, y: 769 },
      region: 'Capri',
      category: 'transport',
    }),
    place({
      id: 'L1064',
      title: 'Capri City Jackals Stadium, Capri',
      layerId: 'community',
      position: { x: -6409, y: -210 },
      region: 'Capri',
      category: 'landmark',
    }),
    place({
      id: 'gym:grand-majestic',
      title: 'Grand Majestic Gym',
      layerId: 'gyms',
      position: { x: -1035, y: -1249 },
      region: 'Tequesta, Vice City',
      tags: ['gym'],
    }),
    place({
      id: 'gym:zenith',
      title: 'Zenith',
      layerId: 'gyms',
      position: { x: -826, y: -566 },
      region: 'Downtown, Vice City',
      tags: ['gym'],
    }),
    place({
      id: 'gym:dynamix',
      title: 'Dynamix Fitness',
      layerId: 'gyms',
      position: { x: -366, y: 1514 },
      region: 'Vice City',
      tags: ['gym'],
    }),
    place({
      id: 'gym:muscle-sands',
      title: 'Muscle Sands',
      layerId: 'gyms-outdoor',
      position: { x: 2019, y: 407 },
      region: 'Ocean Beach, Vice Beach',
      tags: ['gym', 'free', 'outdoor'],
    }),
    place({
      id: 'gym:jason-house-deck',
      title: "Jason's house deck (home gym)",
      layerId: 'gyms-outdoor',
      position: { x: -2353, y: -5532 },
      region: 'Key Lento, Leonida Keys',
      tags: ['gym', 'free', 'outdoor', 'home'],
    }),
    place({
      id: 'L9999',
      title: '?, Capri',
      layerId: 'lootable',
      position: { x: -6600, y: 200 },
      region: 'Capri',
      evidence: 'uncertain',
    }),
  ];

  const capriGymQuestion =
    'Show me a gym near Capri or somewhere I can hit some strength workouts';

  it('a gym near Capri is answered nearest-first, and says plainly none is near', () => {
    const result = retrieveForAsk({
      question: capriGymQuestion,
      places: CAPRI_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.anchorPlace?.region).toBe('Capri');
    expect(result.areaMismatch).toBe(true);
    expect(result.nearCount).toBe(0);
    expect(result.nearestDistance).not.toBeNull();
    expect(result.nearestDistance!).toBeGreaterThan(5000);
    // Nearest first: Grand Majestic, NOT Muscle Sands / Jason's deck.
    expect(result.records[0]?.id).toBe('gym:grand-majestic');
    expect(result.records.map((p) => p.id)).not.toEqual([
      'gym:muscle-sands',
      'gym:jason-house-deck',
    ]);
    expect(result.proximitySummary).toMatch(/no gym near capri/i);
    expect(result.proximitySummary).toContain('Grand Majestic');
    expect(result.proximitySummary).toMatch(/long way across the map/i);
    // The house-gym gap is stated, not hidden behind the 9 official gyms.
    expect(result.proximitySummary).toMatch(/house gyms.*not in the public map data/i);
  });

  it('the follow-up keeps the Capri anchor instead of re-listing the far gyms', () => {
    const result = retrieveForAsk({
      question: 'is there nowhere else I can workout?',
      places: CAPRI_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
      priorQuestions: [capriGymQuestion],
    });
    expect(result.anchorPlace?.region).toBe('Capri');
    expect(result.nearCount).toBe(0);
    expect(result.records[0]?.id).toBe('gym:grand-majestic');
    expect(result.records[0]?.id).not.toBe('gym:muscle-sands');
    expect(result.proximitySummary).toMatch(/no gym near capri/i);
  });

  it('a house gym the user marked near Capri answers first, before the far gyms', () => {
    const withMarker = [
      ...CAPRI_PLACES,
      place({
        id: 'custom:house-gym-capri',
        title: 'House gym on 5th, Capri',
        layerId: 'personal',
        position: { x: -6500, y: 100 },
        region: 'My markers',
        evidence: 'personal',
        tags: ['pin', 'gym', 'workout'],
        description: 'Squat rack and bench in the garage.',
      }),
      place({
        id: 'custom:photo-spot-capri',
        title: 'Photo spot, Capri',
        layerId: 'personal',
        position: { x: -6550, y: 150 },
        region: 'My markers',
        evidence: 'personal',
        tags: ['pin'],
      }),
    ];
    const result = retrieveForAsk({
      question: capriGymQuestion,
      places: withMarker,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records[0]?.id).toBe('custom:house-gym-capri');
    expect(result.nearCount).toBe(1);
    expect(result.proximitySummary).toMatch(/nearest gym to capri is house gym on 5th/i);
    // The photo spot is the user's marker but it is not a gym.
    expect(result.records.map((p) => p.id)).not.toContain('custom:photo-spot-capri');
  });

  it('records sent to the AI carry their distance from the anchor', () => {
    const result = retrieveForAsk({
      question: capriGymQuestion,
      places: CAPRI_PLACES,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    const prompt = formatRecordsForPrompt(result.records, {
      anchorName: 'Capri',
      distances: result.anchorDistances,
    });
    expect(prompt).toMatch(/Grand Majestic Gym.*map units from Capri — far/s);
    expect(prompt).not.toMatch(/near\.$/m);
  });
});

describe('Ask Nylah — answers from tags, not just names', () => {
  const TAGGED: Place[] = [
    place({
      id: 'L777',
      title: '?, Capri',
      layerId: 'uncertain',
      position: { x: -6600, y: 200 },
      region: 'Capri',
      evidence: 'uncertain',
      tags: ['enterable', '#gas'],
    }),
    place({
      id: 'L778',
      title: '?, Capri',
      layerId: 'uncertain',
      position: { x: -6700, y: 300 },
      region: 'Capri',
      evidence: 'uncertain',
      tags: ['residential'],
    }),
    place({
      id: 'L779',
      title: '?, Capri',
      layerId: 'uncertain',
      position: { x: -6500, y: 100 },
      region: 'Capri',
      evidence: 'uncertain',
      tags: ['gym'],
    }),
    place({
      id: 'L1001',
      title: 'Corner Store, Capri',
      layerId: 'lootable',
      position: { x: -6400, y: -200 },
      region: 'Capri',
      tags: ['enterable', 'retail'],
    }),
  ];

  it('a burglary question returns a "?" gas-station shop by its tags', () => {
    const result = retrieveForAsk({
      question: 'Can I rob a shop in Capri tonight?',
      places: TAGGED,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records.map((p) => p.id)).toContain('L777');
    expect(result.records.map((p) => p.id)).toContain('L1001');
    // The house is not a shop — its tags do not match.
    expect(result.records.map((p) => p.id)).not.toContain('L778');
  });

  it('a gym question returns a gym-tagged "?" place near Capri, nearest first', () => {
    const result = retrieveForAsk({
      question: 'Show me a gym near Capri',
      places: TAGGED,
      layers: layers(),
      filters: { hideFound: false, remainingOnly: false, countyId: null },
    });
    expect(result.records[0]?.id).toBe('L779');
    expect(result.nearCount).toBe(1);
    // The house and the petrol station are not gyms.
    expect(result.records.map((p) => p.id)).not.toContain('L777');
    expect(result.records.map((p) => p.id)).not.toContain('L778');
  });
});
