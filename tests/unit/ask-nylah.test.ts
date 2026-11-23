import { describe, expect, it, vi } from 'vitest';
import type { LayerDefinition, Place } from '../../src/domain/types';
import { DEFAULT_LAYERS } from '../../src/features/map/layers';
import { retrieveForAsk, layersRequestedByQuestion } from '../../src/features/ask/retrieval';
import {
  askOpenAi,
  buildAskSystemPrompt,
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
