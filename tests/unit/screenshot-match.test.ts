import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { AtlasDatabase } from '../../src/db/repository';
import {
  buildGameDatabase,
  setProgress,
  type CompletionRecord,
  type GameDatabase,
} from '../../src/domain/game-db';
import type { Place } from '../../src/domain/types';
import type { StorageLike } from '../../src/features/categorise/storage';
import { recordCompletion } from '../../src/features/completion/record';
import {
  applyScreenshotProposals,
  buildScreenshotProposals,
  matchScreenshot,
  parseMatchReply,
  resolveMatchCandidate,
  saveScreenshot,
  type ScreenshotMatchCandidate,
  type ScreenshotProposal,
} from '../../src/features/album/screenshot-match';

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

const VICKI = 'card-checklist:delights-dancers:vicki:standard';
const HARLEY = 'card-checklist:delights-dancers:harley:standard';
const DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function dbWithCollected(...itemIds: string[]): GameDatabase {
  const records: CompletionRecord[] = itemIds.map((id, index) => ({
    id: `rec:test-${index}`,
    target: { type: 'item', id },
    verb: 'collected',
    count: 1,
    at: '2026-11-26T08:41:56.000Z',
    source: 'user',
  }));
  return buildGameDatabase({ places, records });
}

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

function stubFetch(content: string, ok = true, status = 200) {
  // Returns the mock itself, so tests can assert on calls; call
  // sites cast it to `typeof fetch` for the executor input. The
  // parameters are typed so `mock.calls[0][1]` is the RequestInit.
  return vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => content,
  }));
}

describe('parseMatchReply — the model contract, validated before trust', () => {
  it('parses bare and fenced JSON', () => {
    const bare = parseMatchReply(
      '{"matches":[{"name":"Vicki","set":"Delights Dancers","variant":"Standard","confidence":0.92}]}',
    );
    expect(bare).toEqual([
      { name: 'Vicki', setName: 'Delights Dancers', variant: 'Standard', confidence: 0.92 },
    ]);
    const fenced = parseMatchReply(
      '```json\n{"matches":[{"name":"Harley","confidence":0.6}]}\n```',
    );
    expect(fenced).toEqual([
      { name: 'Harley', setName: undefined, variant: undefined, confidence: 0.6 },
    ]);
    expect(parseMatchReply('{"matches":[]}')).toEqual([]);
  });

  it('rejects garbage, wrong shapes and unusable entries — never partially trusted', () => {
    expect(parseMatchReply('no json here')).toBeNull();
    expect(parseMatchReply('{"matches":"nope"}')).toBeNull();
    expect(parseMatchReply('{"matches":[{"name":"Vicki"}]}')).toBeNull();
    expect(parseMatchReply('{"matches":[{"name":"","confidence":0.9}]}')).toBeNull();
    expect(parseMatchReply('{"other":[]}')).toBeNull();
  });
});

describe('resolveMatchCandidate — names resolve to ids in code, never by the model', () => {
  it('resolves Vicki by name, and narrows by set', () => {
    const db = buildGameDatabase({ places });
    const resolved = resolveMatchCandidate(db, { name: 'Vicki', confidence: 0.9 });
    expect(resolved).toEqual({ item: expect.objectContaining({ id: VICKI }) });
    const inSet = resolveMatchCandidate(
      db,
      { name: 'Vicki', setName: 'Delights Dancers', confidence: 0.9 },
      'delights-dancers',
    );
    expect(inSet).toEqual({ item: expect.objectContaining({ id: VICKI }) });
  });

  it('returns null for an unknown name and ambiguous for a name shared by several slots', () => {
    const db = buildGameDatabase({ places });
    expect(resolveMatchCandidate(db, { name: 'Nobody McNobody', confidence: 0.9 })).toBeNull();
    // Angel Cienfuegos holds three slots — the name alone cannot pick one.
    const ambiguous = resolveMatchCandidate(db, { name: 'Angel Cienfuegos', confidence: 0.9 });
    expect(ambiguous && 'ambiguous' in ambiguous && ambiguous.ambiguous.length).toBe(3);
  });
});

describe('buildScreenshotProposals — the executor rules (§3.5)', () => {
  const db = () => buildGameDatabase({ places });

  it('tiers by confidence: ≥0.8 confirmable, 0.5–0.8 possible, <0.5 never proposed', () => {
    const candidates: ScreenshotMatchCandidate[] = [
      { name: 'Vicki', confidence: 0.92 },
      { name: 'Harley', confidence: 0.6 },
      { name: 'Amber', confidence: 0.4 },
    ];
    const { proposals, dropped } = buildScreenshotProposals(db(), candidates, 'shot:x', 'card-front');
    expect(proposals.map((p) => [p.itemId, p.tier])).toEqual([
      [VICKI, 'confirm'],
      [HARLEY, 'possible'],
    ]);
    expect(dropped).toEqual([{ name: 'Amber', reason: 'too-unsure' }]);
  });

  it('drops unknown names, ambiguous names and already-collected items', () => {
    const collected = dbWithCollected(VICKI);
    const candidates: ScreenshotMatchCandidate[] = [
      { name: 'Vicki', confidence: 0.95 },
      { name: 'Nobody McNobody', confidence: 0.95 },
      { name: 'Angel Cienfuegos', confidence: 0.95 },
      { name: 'Harley', confidence: 0.9 },
    ];
    const { proposals, dropped } = buildScreenshotProposals(
      collected,
      candidates,
      'shot:x',
      'collection-screen',
    );
    expect(proposals.map((p) => p.itemId)).toEqual([HARLEY]);
    expect(dropped.map((d) => d.reason)).toEqual([
      'already-collected',
      'unknown-name',
      'ambiguous-name',
    ]);
  });

  it('dedupes a repeated candidate and caps a batch at 30', () => {
    // 35 candidates with names that resolve to exactly one slot each
    // (a shared name would be ambiguous and dropped, not proposed).
    const db0 = db();
    const nameCounts = new Map<string, number>();
    for (const item of db0.items.values()) {
      if (item.checklistSlot) nameCounts.set(item.name, (nameCounts.get(item.name) ?? 0) + 1);
    }
    const unique = [...db0.items.values()]
      .filter((item) => item.checklistSlot && nameCounts.get(item.name) === 1)
      .slice(0, 35);
    expect(unique).toHaveLength(35);
    const candidates: ScreenshotMatchCandidate[] = [
      ...unique.map((item) => ({ name: item.name, confidence: 0.9 })),
      { name: 'Vicki', confidence: 0.9 },
    ];
    const { proposals, dropped } = buildScreenshotProposals(db(), candidates, 'shot:x', 'collection-screen');
    expect(proposals).toHaveLength(30);
    expect(dropped.some((d) => d.reason === 'over-batch-cap')).toBe(true);
    expect(new Set(proposals.map((p) => p.itemId)).size).toBe(30);
  });
});

describe('matchScreenshot — stubbed matcher, never a real key', () => {
  it('with no key it says so honestly and never calls the network', async () => {
    const db = buildGameDatabase({ places });
    const fetchImpl = stubFetch('{"matches":[]}');
    const result = await matchScreenshot({
      dataUrl: DATA_URL,
      kind: 'card-front',
      db,
      apiKey: '',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({
      ok: false,
      code: 'no-key',
      error: expect.stringContaining('needs your OpenAI key'),
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a stubbed match returns a confirmable Vicki proposal stamped with the saved screenshot id', async () => {
    const db = buildGameDatabase({ places });
    const fetchImpl = stubFetch(
      '{"matches":[{"name":"Vicki","set":"Delights Dancers","variant":"Standard","confidence":0.92}]}',
    );
    const result = await matchScreenshot({
      dataUrl: DATA_URL,
      kind: 'card-front',
      db,
      apiKey: 'sk-test',
      screenshotId: 'shot:saved-1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]).toMatchObject({
      itemId: VICKI,
      tier: 'confirm',
      screenshotId: 'shot:saved-1',
      kind: 'card-front',
    });
    expect(result.model).toBeTruthy();
    // The image went to the model call, and only there.
    const init = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body ?? '{}'));
    expect(JSON.stringify(body)).toContain(DATA_URL);
    expect(body.messages[1].content[1].image_url.url).toBe(DATA_URL);
  });

  it('a collection-screen stub proposes the delta only — already-collected is dropped', async () => {
    const db = dbWithCollected(VICKI);
    const fetchImpl = stubFetch(
      '{"matches":[' +
        '{"name":"Vicki","confidence":0.95},' +
        '{"name":"Harley","confidence":0.88},' +
        '{"name":"Nobody McNobody","confidence":0.9}]}',
    );
    const result = await matchScreenshot({
      dataUrl: DATA_URL,
      kind: 'collection-screen',
      setId: 'delights-dancers',
      db,
      apiKey: 'sk-test',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.proposals.map((p) => p.itemId)).toEqual([HARLEY]);
    expect(result.dropped.map((d) => d.reason)).toEqual(['already-collected', 'unknown-name']);
  });

  it('a failed request and an unparseable reply both propose nothing', async () => {
    const db = buildGameDatabase({ places });
    const failed = await matchScreenshot({
      dataUrl: DATA_URL,
      kind: 'card-front',
      db,
      apiKey: 'sk-test',
      fetchImpl: stubFetch('boom', false, 401) as unknown as typeof fetch,
    });
    expect(failed).toEqual(
      expect.objectContaining({ ok: false, code: 'match-failed' }),
    );
    const unparseable = await matchScreenshot({
      dataUrl: DATA_URL,
      kind: 'card-front',
      db,
      apiKey: 'sk-test',
      fetchImpl: stubFetch('just some words, no json') as unknown as typeof fetch,
    });
    expect(unparseable).toEqual(
      expect.objectContaining({ ok: false, code: 'unparseable' }),
    );
  });
});

describe('applyScreenshotProposals — confirm applies, dismiss applies nothing', () => {
  let repo: AtlasDatabase;
  let storage: StorageLike;
  beforeEach(() => {
    repo = new AtlasDatabase(`screenshot-match-test-${crypto.randomUUID()}`);
    storage = memoryStorage();
  });
  afterEach(async () => {
    await repo.delete();
  });
  const deps = () => ({ repository: repo, places, storage });

  async function savedShot(kind: 'card-front' | 'collection-screen' = 'card-front') {
    const saved = await saveScreenshot({ dataUrl: DATA_URL, kind, repository: repo });
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error('save failed');
    return saved.screenshot;
  }

  it('confirm applies the updates: collected, source screenshot, note carries the screenshot id', async () => {
    const shot = await savedShot();
    const db = buildGameDatabase({ places });
    const { proposals } = buildScreenshotProposals(
      db,
      [{ name: 'Vicki', confidence: 0.92 }],
      shot.id,
      'card-front',
    );
    expect(proposals).toHaveLength(1);
    const result = await applyScreenshotProposals({
      proposals,
      db,
      deps: deps(),
      repository: repo,
    });
    expect(result.applied).toEqual([{ itemId: VICKI, name: 'Vicki' }]);
    expect(result.errors).toEqual([]);
    expect(result.db.completedItemIds.has(VICKI)).toBe(true);
    expect(setProgress(result.db, 'delights-dancers').found).toBe(1);
    const { records } = await repo.loadCompletion();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      target: { type: 'item', id: VICKI },
      verb: 'collected',
      source: 'screenshot',
      note: `matched from screenshot ${shot.id}`,
    });
    // A card-front confirm links the photo to the item — the album
    // can show it as the card's face.
    const shots = await repo.loadUserScreenshots();
    expect(shots).toHaveLength(1);
    expect(shots[0]?.itemId).toBe(VICKI);
    const bytes = await repo.getScreenshotData(shot.id);
    expect(bytes?.dataUrl).toBe(DATA_URL);
  });

  it('dismiss applies nothing: an empty confirm list writes no records', async () => {
    const db = buildGameDatabase({ places });
    const result = await applyScreenshotProposals({ proposals: [], db, deps: deps(), repository: repo });
    expect(result.applied).toEqual([]);
    expect(result.errors).toEqual([]);
    const { records } = await repo.loadCompletion();
    expect(records).toHaveLength(0);
  });

  it('an already-collected proposal is skipped, never double-written', async () => {
    const shot = await savedShot('collection-screen');
    const first = await recordCompletion(
      { target: { type: 'item', id: VICKI }, verb: 'collected', source: 'user' },
      deps(),
    );
    expect(first.ok).toBe(true);
    const proposals: ScreenshotProposal[] = [
      {
        itemId: VICKI,
        confidence: 0.95,
        tier: 'confirm',
        reason: 'Matched Vicki.',
        screenshotId: shot.id,
        kind: 'collection-screen',
      },
    ];
    const result = await applyScreenshotProposals({
      proposals,
      db: first.db!,
      deps: deps(),
      repository: repo,
    });
    expect(result.applied).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    const { records } = await repo.loadCompletion();
    expect(records).toHaveLength(1);
  });

  it('screenshots persist device-local and round-trip their bytes', async () => {
    const shot = await savedShot();
    const shots = await repo.loadUserScreenshots();
    expect(shots.map((row) => row.id)).toEqual([shot.id]);
    expect(shots[0]?.blobId).toBe(shot.id);
    await repo.deleteUserScreenshot(shot.id);
    expect(await repo.loadUserScreenshots()).toHaveLength(0);
    expect(await repo.getScreenshotData(shot.id)).toBeUndefined();
  });
});
