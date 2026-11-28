import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { buildGameDatabase, type GameDatabase } from '../../src/domain/game-db';
import { normalizeAsk } from '../../src/features/ask/retrieval';
import type { Place } from '../../src/domain/types';import {
  allowedNamesForResults,
  askWithTools,
  buildToolNarrationSystemPrompt,
  buildToolRouterSystemPrompt,
  fallbackSummary,
  requestedLayersForToolCalls,
  sanitizeToolsNarration,
} from '../../src/features/ask/intent';
import type { ToolCall, ToolResult } from '../../src/features/ask/tools';

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

interface MockResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}

function chatResponse(message: {
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}): MockResponse {
  return {
    ok: true,
    status: 200,
    text: async () => '',
    json: async () => ({ choices: [{ message }] }),
  };
}

function toolCallResponse(name: string, args: Record<string, unknown>): MockResponse {
  return chatResponse({
    content: null,
    tool_calls: [
      {
        id: `call_${name}`,
        type: 'function',
        function: { name, arguments: JSON.stringify(args) },
      },
    ],
  });
}

/** A fetch that serves queued responses and records every request body. */
function queuedFetch(responses: MockResponse[]) {
  const bodies: unknown[] = [];
  const urls: string[] = [];
  const fetchImpl = (async (url: string, init?: { body?: unknown }) => {
    urls.push(url);
    if (init?.body !== undefined) bodies.push(JSON.parse(String(init.body)));
    const next = responses.shift();
    if (!next) throw new Error('Mock fetch ran out of queued responses.');
    return next as unknown as Response;
  }) as typeof fetch;
  return { fetchImpl, bodies, urls };
}

describe('Ask intent — router → tools → narration (DESIGN §7.3)', () => {
  it('routes "Delight dancers" to remaining_collectibles and narrates the tool result', async () => {
    const db = buildFullDb();
    const { fetchImpl, bodies } = queuedFetch([
      toolCallResponse('remaining_collectibles', { setId: 'Delights Dancers' }),
      chatResponse({
        content:
          'There are 18 Delights Dancers cards left to find, including Jason and Harley at Delights in Port Gellhorn.',
      }),
    ]);
    const result = await askWithTools({
      question: 'Delight dancers',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result.kind).toBe('tools');
    if (result.kind !== 'tools') return;
    // The router asked for the set by name — never the word "card".
    const routerBody = bodies[0] as { messages: { content: string }[]; tools: unknown[] };
    expect(routerBody.tools).toHaveLength(10);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]?.name).toBe('remaining_collectibles');
    expect(result.toolCalls[0]?.args['setId']).toBe('Delights Dancers');
    // The tool ran against the real database: 18 items, Harley present.
    const data = result.results[0] as ToolResult<{
      items: { name: string }[];
      total: number;
    }>;
    expect(data.ok).toBe(true);
    if (data.ok) {
      expect(data.data.total).toBe(18);
      expect(data.data.items.map((item) => item.name)).toContain('Harley');
    }
    // The narration survived sanitization — every name in it was in
    // the tool results.
    expect(result.narration).toMatch(/18 Delights Dancers cards/);
    // The pinned cards' hosts are revealed on the map.
    expect(result.revealIds).toContain('L629');
    expect(result.proposals).toHaveLength(0);
    expect(result.focus).toBeNull();
  });

  it('routes "cards near Capri" with sortNearAreaId and leads with the honest nearest verdict', async () => {
    const db = buildFullDb();
    const { fetchImpl } = queuedFetch([
      toolCallResponse('remaining_collectibles', {
        setId: 'delights-dancers',
        sortNearAreaId: 'Capri',
      }),
      chatResponse({
        content:
          'The nearest is Harley, in Delights, Port Gellhorn — about 3,599 map units away, not near Capri. 13 more in this set have no position yet.',
      }),
    ]);
    const result = await askWithTools({
      question: 'cards for delight dancers near Capri',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result.kind).toBe('tools');
    if (result.kind !== 'tools') return;
    expect(result.narration).toMatch(/not near Capri/);
    expect(result.narration).toMatch(/3,599/);
  });

  it('a model that cannot map the question returns no_tool — its free text is never shown', async () => {
    const db = buildFullDb();
    const { fetchImpl } = queuedFetch([
      chatResponse({ content: 'no_tool' }),
    ]);
    const result = await askWithTools({
      question: 'what is the meaning of life',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result).toEqual({ kind: 'no_tool' });
  });

  it('a content-only answer (no tool call) is no_tool, even when it names a place', async () => {
    const db = buildFullDb();
    const { fetchImpl } = queuedFetch([
      chatResponse({ content: 'The nearest gym is Muscle Sands in Vice City.' }),
    ]);
    const result = await askWithTools({
      question: 'where is the nearest gym',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result).toEqual({ kind: 'no_tool' });
  });

  it('a model inventing a tool name is no_tool', async () => {
    const db = buildFullDb();
    const { fetchImpl } = queuedFetch([
      toolCallResponse('teleport', { place: 'Vice City' }),
    ]);
    const result = await askWithTools({
      question: 'take me to Vice City',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result).toEqual({ kind: 'no_tool' });
  });

  it('no key means no_tool — the finder works without one, and no request is made', async () => {
    const db = buildFullDb();
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      throw new Error('must not fetch without a key');
    }) as typeof fetch;
    const result = await askWithTools({
      question: 'Delight dancers',
      db,
      apiKey: '   ',
      fetchImpl,
    });
    expect(result).toEqual({ kind: 'no_tool' });
    expect(called).toBe(false);
  });

  it('a tool error is the answer — the narrator gets it, and the fallback summary carries it', async () => {
    const db = buildFullDb();
    const { fetchImpl, bodies } = queuedFetch([
      toolCallResponse('remaining_collectibles', { setId: 'no-such-set' }),
      chatResponse({
        content: 'There is no collectible set called "no-such-set" in the map data.',
      }),
    ]);
    const result = await askWithTools({
      question: 'show me the no-such-set cards',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result.kind).toBe('tools');
    if (result.kind !== 'tools') return;
    expect(result.results[0]?.ok).toBe(false);
    // The narration call was given the tool error as its only fact.
    const narrationBody = bodies[1] as { messages: { content: string }[] };
    expect(narrationBody.messages[1]?.content).toMatch(/no collectible set called/);
    expect(result.narration).toMatch(/no collectible set called/);
  });

  it('a router network failure is an error, not a guessed answer', async () => {
    const db = buildFullDb();
    const fetchImpl = (async () => {
      throw new Error('network down');
    }) as typeof fetch;
    const result = await askWithTools({
      question: 'Delight dancers',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/network down/);
  });

  it('a narration failure still returns the tools result with the deterministic summary', async () => {
    const db = buildFullDb();
    const { fetchImpl } = queuedFetch([
      toolCallResponse('remaining_collectibles', { setId: 'delights-dancers' }),
      // The narration call throws — the summary stands.
      {
        ok: false,
        status: 500,
        text: async () => 'internal error',
        json: async () => ({}),
      },
    ]);
    const result = await askWithTools({
      question: 'Delight dancers',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result.kind).toBe('tools');
    if (result.kind !== 'tools') return;
    expect(result.narration).toMatch(/18 of 18 Delights Dancers cards left to find/);
  });

  it('an update_completion call returns a proposal — never a write', async () => {
    const db = buildFullDb();
    const { fetchImpl } = queuedFetch([
      toolCallResponse('update_completion', {
        verb: 'collected',
        targetType: 'item',
        targetId: [...db.items.values()].find((item) => item.name === 'Tracy')!.id,
      }),
      chatResponse({
        content: 'Found it? Tap Confirm to mark Tracy as collected.',
      }),
    ]);
    const result = await askWithTools({
      question: 'I found the Tracy card',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
    });
    expect(result.kind).toBe('tools');
    if (result.kind !== 'tools') return;
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.kind).toBe('completion');
    if (result.proposals[0]?.kind === 'completion') {
      expect(result.proposals[0].confirmLabel).toMatch(/Mark Tracy .* as collected\?/);
      // Tracy is pinned now (fbrito candidate pin), so there is a spot
      // in the map data and no jot offer.
      expect(result.proposals[0].jotOffer).toBeNull();
    }
    // The proposal did not write: Tracy is still uncollected.
    const tracy = [...db.items.values()].find((item) => item.name === 'Tracy')!;
    expect(db.completedItemIds.has(tracy.id)).toBe(false);
  });

  it('a router timeout is an error, and the test does not hang', async () => {
    const db = buildFullDb();
    const fetchImpl = (() =>
      new Promise(() => {
        // Never settles — the timeout race must unblock the caller.
      })) as typeof fetch;
    const result = await askWithTools({
      question: 'Delight dancers',
      db,
      apiKey: 'sk-test-key',
      fetchImpl,
      timeoutMs: 50,
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/timed out/);
  });

  it('the router prompt carries the no_tool rule and the equipment rule', () => {
    const prompt = buildToolRouterSystemPrompt();
    expect(prompt).toMatch(/reply with the single word: no_tool/);
    expect(prompt).toMatch(/Never answer from memory/);
    expect(prompt).toMatch(/workout-equipment/);
    expect(prompt).toMatch(/never \["gym"\]/);
    expect(prompt).toMatch(/sortNearAreaId/);
    expect(prompt).toMatch(/includeHints = true — ONLY when the question explicitly asks where/);
  });

  it('the narration prompt carries the spoiler rule and the nearest-first rule', () => {
    const prompt = buildToolNarrationSystemPrompt(['Delights Dancers cards']);
    expect(prompt).toMatch(/Answer ONLY from the map records/);
    expect(prompt).toMatch(/Do NOT volunteer extras/);
    expect(prompt).toMatch(/say the proximity verdict FIRST/);
    expect(prompt).toMatch(/never invent a spot/);
  });
});

describe('Ask intent — sanitizeToolsNarration (the spoiler rule in code)', () => {
  function sanitize(
    narration: string,
    allowed: string[],
    layers: string[],
  ): string {
    const db = buildFullDb();
    // Allowed names are normalized exactly like the production path
    // (allowedNamesForResults runs every name through normalizeAsk).
    const allowedNames = new Set(allowed.map((name) => normalizeAsk(name)));
    return sanitizeToolsNarration(narration, db, allowedNames, layers);
  }

  it('keeps a sentence naming only what the tool results named', () => {
    const out = sanitize(
      'The nearest is Harley, in Delights, Port Gellhorn — about 3,599 map units away, not near Capri.',
      ['harley', 'delights', 'delights, interstate 404, port gellhorn', 'port gellhorn', 'capri'],
      ['cards', 'cards:delights-dancers'],
    );
    expect(out).toMatch(/Harley/);
    expect(out).toMatch(/3,599/);
  });

  it('drops a sentence naming a place that was not in the tool results', () => {
    const out = sanitize(
      'The nearest is Harley, in Delights, Port Gellhorn. You should also check NINE1NINE in Vice City, it has great views.',
      ['harley', 'delights', 'Delights, Interstate 404, Port Gellhorn', 'Port Gellhorn'],
      ['cards', 'cards:delights-dancers'],
    );
    expect(out).toMatch(/Harley/);
    expect(out).not.toMatch(/NINE1NINE/);
  });

  it('drops a sentence naming a card that was not in the tool results', () => {
    const out = sanitize(
      'Jason and Harley are both at Delights. Tracy is in the same set and much easier to find.',
      ['jason', 'harley', 'delights', 'delights, interstate 404, port gellhorn'],
      ['cards', 'cards:delights-dancers'],
    );
    expect(out).toMatch(/Jason and Harley/);
    expect(out).not.toMatch(/Tracy/);
  });

  it('drops the cross-layer extra — "you will also find cards in them houses"', () => {
    const out = sanitize(
      'Muscle Sands is the nearest gym. You will also find all these cards and watches in them houses.',
      ['muscle sands'],
      ['gyms'],
    );
    expect(out).toMatch(/Muscle Sands/);
    expect(out).not.toMatch(/cards and watches/);
  });

  it('does not drop a set name that masks a card name inside it', () => {
    const out = sanitize(
      'The Jack of Hearts set has 18 cards left to find.',
      ['jack of hearts'],
      ['cards', 'cards:jack-of-hearts'],
    );
    expect(out).toMatch(/Jack of Hearts/);
  });

  it('an area name is geography, not a find — "in Capri" never counts as a place leak', () => {
    const out = sanitize(
      'Nothing near Capri in the map data. The nearest is Harley, about 3,599 map units away.',
      ['harley', 'delights', 'delights, interstate 404, port gellhorn', 'capri'],
      ['cards', 'cards:delights-dancers'],
    );
    expect(out).toMatch(/Nothing near Capri/);
    expect(out).toMatch(/Harley/);
  });

  it('allowedNamesForResults collects names from calls and results', () => {
    const db = buildFullDb();
    const calls: ToolCall[] = [
      { name: 'remaining_collectibles', args: { setId: 'delights-dancers' } },
    ];
    const results: ToolResult<unknown>[] = [
      {
        ok: true,
        data: {
          items: [
            { id: 'x', name: 'Jason', locationName: 'Delights, Interstate 404, Port Gellhorn' },
          ],
          total: 18,
          found: 0,
        },
      },
    ];
    const names = allowedNamesForResults(db, calls, results);
    expect(names.has('jason')).toBe(true);
    expect(names.has('delights dancers')).toBe(true);
    expect(names.has('delights')).toBe(true);
  });

  it('requestedLayersForToolCalls maps calls to layer ids for the spoiler check', () => {
    const db = buildFullDb();
    expect(
      requestedLayersForToolCalls(db, [
        { name: 'remaining_collectibles', args: { setId: 'delights-dancers' } },
      ]),
    ).toEqual(expect.arrayContaining(['cards', 'cards:delights-dancers']));
    expect(
      requestedLayersForToolCalls(db, [
        {
          name: 'find_nearby_opportunities',
          args: { kinds: ['bank-job'], anchor: { position: { x: 0, y: 0 } } },
        },
      ]),
    ).toContain('loot-heists');
    expect(
      requestedLayersForToolCalls(db, [
        {
          name: 'find_nearby_opportunities',
          args: { kinds: ['workout-equipment'], anchor: { position: { x: 0, y: 0 } } },
        },
      ]),
    ).toContain('equipment');
    expect(
      requestedLayersForToolCalls(db, [
        { name: 'search_locations', args: { query: 'Delights' } },
      ]),
    ).toHaveLength(0);
  });
});

describe('Ask intent — fallbackSummary (deterministic, no AI)', () => {
  it('summarizes a remaining_collectibles result with the nearest verdict first', () => {
    const summary = fallbackSummary(
      [{ name: 'remaining_collectibles', args: { setId: 'delights-dancers' } }],
      [
        {
          ok: true,
          data: {
            items: [{ name: 'Jason', setName: 'Delights Dancers' }],
            total: 18,
            found: 0,
            nearest: {
              id: 'x',
              name: 'Harley',
              locationName: 'Delights, Interstate 404, Port Gellhorn',
              distanceUnits: 3599,
            },
            nearCount: 0,
          },
        },
      ],
    );
    expect(summary).toMatch(/The nearest is Harley/);
    expect(summary).toMatch(/3,599|3599/);
    expect(summary).toMatch(/not near/);
    expect(summary).toMatch(/18 of 18 Delights Dancers cards left to find/);
  });

  it('carries a tool error verbatim — the error IS the answer', () => {
    const summary = fallbackSummary(
      [{ name: 'remaining_collectibles', args: { setId: 'no-such-set' } }],
      [{ ok: false, error: 'There is no collectible set called "no-such-set" in the map data.' }],
    );
    expect(summary).toMatch(/no collectible set called/);
  });

  it('says plainly when nothing matched', () => {
    const summary = fallbackSummary(
      [{ name: 'search_locations', args: { query: 'zzzz' } }],
      [{ ok: true, data: { locations: [] } }],
    );
    expect(summary).toMatch(/Nothing by that name/);
  });
});
