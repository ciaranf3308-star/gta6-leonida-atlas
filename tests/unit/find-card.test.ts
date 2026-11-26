import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { buildGameDatabase, type GameDatabase } from '../../src/domain/game-db';
import type { Place } from '../../src/domain/types';
import type { ResearchRequest } from '../../src/domain/album';
import {
  buildFindCardSystemPrompt,
  buildFindCardUserPrompt,
  FIND_CARD_BUTTON_LABEL,
  FIND_CARD_COST_COPY,
  FIND_CARD_MIN_CONFIDENCE,
  findCard,
} from '../../src/features/ask/find-card';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const places: Place[] = catalogueFromSnapshot(snapshot);

function buildFullDb(): GameDatabase {
  return buildGameDatabase({ places });
}

function responsesPayload(message: {
  text: string;
  citations?: { url: string; title: string }[];
}): unknown {
  return {
    output: [
      {
        type: 'web_search_call',
        id: 'ws_test',
        status: 'completed',
      },
      {
        type: 'message',
        content: [
          {
            type: 'output_text',
            text: message.text,
            annotations: (message.citations ?? []).map((citation) => ({
              type: 'url_citation',
              url: citation.url,
              title: citation.title,
              start_index: 0,
              end_index: 10,
            })),
          },
        ],
      },
    ],
  };
}

function mockFetch(payload: unknown, status = 200) {
  const bodies: unknown[] = [];
  const fetchImpl = (async (_url: string, init?: { body?: unknown }) => {
    if (init?.body !== undefined) bodies.push(JSON.parse(String(init.body)));
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (status === 200 ? '' : 'unauthorized'),
      json: async () => payload,
    } as unknown as Response;
  }) as typeof fetch;
  return { fetchImpl, bodies };
}

describe('Find this card — web search (step-7 scope item 2)', () => {
  it('returns a proposal with sources + confidence when search finds the card', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    const queued: ResearchRequest[] = [];
    const { fetchImpl, bodies } = mockFetch(
      responsesPayload({
        text: [
          'The Amber card is in the Agricore mine tower in Southern Leonard County, on the top floor.',
          '',
          '```json',
          '{"found": true, "direction": "Agricore mine tower, Southern Leonard County — top floor", "confidence": 0.8}',
          '```',
        ].join('\n'),
        citations: [
          {
            url: 'https://lorenzone.fr/blogs/news/gta-6-collectible-card-checklist-images-locations',
            title: 'lorenzone.fr · GTA 6 Trading Cards checklist',
          },
        ],
      }),
    );
    const result = await findCard({
      item: amber,
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
      queueResearch: async (request) => {
        queued.push(request);
        return true;
      },
    });
    expect(result.kind).toBe('proposal');
    if (result.kind !== 'proposal') return;
    expect(result.proposal.itemId).toBe(amber.id);
    expect(result.proposal.direction).toMatch(/Agricore mine tower/);
    expect(result.proposal.confidence).toBe(0.8);
    expect(result.proposal.sources).toHaveLength(1);
    expect(result.proposal.sources[0]?.url).toMatch(/lorenzone/);
    expect(queued).toHaveLength(0);
    // The request went to the Responses API with the web_search tool.
    const body = bodies[0] as { tools: unknown[]; model: string; input: { content: string }[] };
    expect(body.tools).toEqual([{ type: 'web_search' }]);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.input[1]?.content).toMatch(/Amber/);
    expect(body.input[1]?.content).toMatch(/Delights Dancers/);
  });

  it('queues a ResearchRequest when search finds nothing usable', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    const queued: ResearchRequest[] = [];
    const { fetchImpl } = mockFetch(
      responsesPayload({
        text: [
          'I searched several guides and none of them gives a building for the Amber card.',
          '',
          '```json',
          '{"found": false, "direction": "", "confidence": 0.2}',
          '```',
        ].join('\n'),
        citations: [],
      }),
    );
    const result = await findCard({
      item: amber,
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
      queueResearch: async (request) => {
        queued.push(request);
        return true;
      },
    });
    expect(result.kind).toBe('queued');
    if (result.kind !== 'queued') return;
    expect(result.requestId).toBeTruthy();
    expect(result.message).toMatch(/queued it for research/);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.targetType).toBe('item');
    expect(queued[0]?.targetId).toBe(amber.id);
    expect(queued[0]?.question).toMatch(/Amber/);
    expect(queued[0]?.status).toBe('queued');
  });

  it('a low-confidence answer is queued, never proposed', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    const queued: ResearchRequest[] = [];
    const { fetchImpl } = mockFetch(
      responsesPayload({
        text: [
          'One guide names a mine tower, another names a guard post — they disagree.',
          '',
          '```json',
          '{"found": true, "direction": "Agricore mine tower, maybe", "confidence": 0.4}',
          '```',
        ].join('\n'),
        citations: [
          { url: 'https://example.com/guide', title: 'A guide' },
        ],
      }),
    );
    const result = await findCard({
      item: amber,
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
      queueResearch: async (request) => {
        queued.push(request);
        return true;
      },
    });
    expect(result.kind).toBe('queued');
    expect(queued).toHaveLength(1);
  });

  it('a confident answer with no cited source is queued, never proposed', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    const queued: ResearchRequest[] = [];
    const { fetchImpl } = mockFetch(
      responsesPayload({
        text: [
          'The Amber card is definitely in the mine tower.',
          '',
          '```json',
          '{"found": true, "direction": "Agricore mine tower", "confidence": 0.9}',
          '```',
        ].join('\n'),
        citations: [],
      }),
    );
    const result = await findCard({
      item: amber,
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
      queueResearch: async (request) => {
        queued.push(request);
        return true;
      },
    });
    expect(result.kind).toBe('queued');
    expect(queued).toHaveLength(1);
  });

  it('an answer without the JSON block is queued, never guessed from the prose', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    const queued: ResearchRequest[] = [];
    const { fetchImpl } = mockFetch(
      responsesPayload({
        text: 'The Amber card is in the Agricore mine tower, I am fairly sure.',
        citations: [{ url: 'https://example.com/guide', title: 'A guide' }],
      }),
    );
    const result = await findCard({
      item: amber,
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
      queueResearch: async (request) => {
        queued.push(request);
        return true;
      },
    });
    expect(result.kind).toBe('queued');
    expect(queued).toHaveLength(1);
  });

  it('no key means no_key — no request is made', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      throw new Error('must not fetch without a key');
    }) as typeof fetch;
    const result = await findCard({ item: amber, db, apiKey: '  ', fetchImpl });
    expect(result).toEqual({ kind: 'no_key' });
    expect(called).toBe(false);
  });

  it('an API failure is an error — nothing is queued on a failure', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    const queued: ResearchRequest[] = [];
    const { fetchImpl } = mockFetch({}, 401);
    const result = await findCard({
      item: amber,
      db,
      apiKey: 'sk-bad-key',
      fetchImpl,
      queueResearch: async (request) => {
        queued.push(request);
        return true;
      },
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/401/);
    expect(queued).toHaveLength(0);
  });

  it('a timeout is an error, and the test does not hang', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    const fetchImpl = (() =>
      new Promise(() => {
        // Never settles — the timeout race must unblock the caller.
      })) as typeof fetch;
    const result = await findCard({
      item: amber,
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
      timeoutMs: 50,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/timed out/);
  });

  it('the prompt carries what the search needs — and the JSON instruction', () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    expect(buildFindCardSystemPrompt()).toMatch(/do not answer from memory/);
    expect(buildFindCardSystemPrompt()).toMatch(/"found": true or false/);
    expect(buildFindCardSystemPrompt()).toMatch(/below 0\.6/);
    const user = buildFindCardUserPrompt(amber, db);
    expect(user).toMatch(/Amber/);
    expect(user).toMatch(/Delights Dancers/);
    expect(user).toMatch(/Southern Leonard County/);
    expect(user).toMatch(/Agricore mine tower/);
    expect(user).toMatch(/Find the BUILDING/);
  });

  it('the cost copy is honest: extra per search, proposal not a pin', () => {
    expect(FIND_CARD_COST_COPY).toMatch(/costs extra/);
    expect(FIND_CARD_COST_COPY).toMatch(/bills each web search separately/);
    expect(FIND_CARD_COST_COPY).toMatch(/on top of the chat tokens/);
    expect(FIND_CARD_COST_COPY).toMatch(/never a placed pin/);
    expect(FIND_CARD_COST_COPY).not.toMatch(/\$\d/);
    expect(FIND_CARD_BUTTON_LABEL).toBe('Find this card');
    expect(FIND_CARD_MIN_CONFIDENCE).toBe(0.6);
  });
});
