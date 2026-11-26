/**
 * Demo E — enrichment is cached, never re-requested (DESIGN-ADDENDUM
 * §2.3, §2.4; Demo E steps 1–3 + the negative case in step 5).
 *
 * The executor is tested here with an in-memory store and a mocked
 * model call — no IndexedDB, no network, no key.
 */
import { describe, expect, it } from 'vitest';
import { parseEnrichment } from '../../src/db/backup';
import type { ResearchRequest } from '../../src/domain/album';
import {
  ENRICHMENT_SCHEMA_VERSION,
  isEnrichmentFresh,
  type Enrichment,
  type EnrichmentField,
} from '../../src/domain/enrichment';
import type { Evidence } from '../../src/domain/game-db';
import {
  applyConflictQuarantine,
  daysSinceResearch,
  enrichmentIdFor,
  freshnessLabel,
  researchBuilding,
  validateEnrichmentFields,
  type EnrichmentStore,
  type RawEnrichmentField,
} from '../../src/features/enrichment/research';

const NOW = '2026-11-26T12:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.parse(NOW) - days * DAY_MS).toISOString();
}

function verifiedEvidence(): Evidence[] {
  return [
    {
      kind: 'approximate',
      sourceTitle: 'GTADB / Map GTA · revision 2e9e194',
      sourceUrl: 'https://gtadb.net/map',
      license: 'CC BY 4.0',
      recordedAt: '2026-11-01T00:00:00.000Z',
    },
  ];
}

function makeEnrichment(overrides: Partial<Enrichment> = {}): Enrichment {
  return {
    id: enrichmentIdFor('L304'),
    locationId: 'L304',
    schemaVersion: ENRICHMENT_SCHEMA_VERSION,
    researchedAt: daysAgo(10),
    researchedBy: 'gpt-4o-mini',
    fields: [],
    imagery: [],
    question: null,
    researchCalls: 1,
    ...overrides,
  };
}

function makeStore(seed: Enrichment[] = []): EnrichmentStore & {
  rows: Map<string, Enrichment>;
  requests: ResearchRequest[];
  changedAt: string | null;
} {
  const rows = new Map(seed.map((row) => [row.id, row]));
  const requests: ResearchRequest[] = [];
  return {
    rows,
    requests,
    changedAt: null,
    async getEnrichment(id) {
      return rows.get(id);
    },
    async saveEnrichment(enrichment) {
      rows.set(enrichment.id, enrichment);
    },
    async getLocationChangedAt() {
      return this.changedAt;
    },
    async getQueuedResearchRequest(targetId) {
      return requests.find(
        (request) => request.targetId === targetId && request.status === 'queued',
      );
    },
    async saveResearchRequest(request) {
      requests.push(request);
    },
  };
}

function mockFetch(fields: RawEnrichmentField[], usage?: { prompt_tokens: number; completion_tokens: number }) {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return {
      ok: true,
      async json() {
        return {
          choices: [{ message: { content: JSON.stringify({ fields }) } }],
          ...(usage ? { usage } : {}),
        };
      },
      async text() {
        return '';
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, calls: () => calls };
}

const CITED_FIELD: RawEnrichmentField = {
  kind: 'identity',
  text: 'The Starlet Motel — a roadside motel on Historic Route 628.',
  confidence: 0.8,
  sources: [
    {
      title: 'GTADB collectibles guide',
      url: 'https://gtadb.net/guide/cards',
      quote: 'The Starlet Motel sits on Historic Route 628.',
    },
  ],
};

const BASE_INPUT = {
  locationId: 'L304',
  placeTitle: 'Starlet Motel',
  category: 'motel',
  region: 'Kelly County',
  description: 'A motel on Historic Route 628.',
  verifiedEvidence: verifiedEvidence(),
  apiKey: 'test-key',
  nowIso: NOW,
};

describe('isEnrichmentFresh — the "fresh enough" rule (§2.3)', () => {
  it('89 days old is fresh, exactly 90 days is stale (the boundary)', () => {
    expect(isEnrichmentFresh(makeEnrichment({ researchedAt: daysAgo(89) }), NOW)).toBe(true);
    expect(isEnrichmentFresh(makeEnrichment({ researchedAt: daysAgo(90) }), NOW)).toBe(false);
    expect(isEnrichmentFresh(makeEnrichment({ researchedAt: daysAgo(91) }), NOW)).toBe(false);
  });

  it('a row from another schema version is stale, whatever its age', () => {
    expect(
      isEnrichmentFresh(
        makeEnrichment({ researchedAt: daysAgo(1), schemaVersion: ENRICHMENT_SCHEMA_VERSION + 1 }),
        NOW,
      ),
    ).toBe(false);
  });

  it('a verified record changed after the research invalidates the row', () => {
    const row = makeEnrichment({ researchedAt: daysAgo(10) });
    expect(isEnrichmentFresh(row, NOW, daysAgo(20))).toBe(true);
    expect(isEnrichmentFresh(row, NOW, daysAgo(5))).toBe(false);
    expect(isEnrichmentFresh(row, NOW, daysAgo(10))).toBe(true);
  });

  it('daysSinceResearch counts whole days; freshnessLabel names the reason', () => {
    expect(daysSinceResearch(daysAgo(89), NOW)).toBe(89);
    expect(daysSinceResearch(daysAgo(90), NOW)).toBe(90);
    expect(freshnessLabel(makeEnrichment({ researchedAt: daysAgo(10) }), NOW).fresh).toBe(true);
    expect(freshnessLabel(makeEnrichment({ researchedAt: daysAgo(10) }), NOW).label).toMatch(
      /still fresh/,
    );
    const stale = freshnessLabel(makeEnrichment({ researchedAt: daysAgo(91) }), NOW);
    expect(stale.fresh).toBe(false);
    expect(stale.label).toMatch(/91 days old/);
  });
});

describe('researchBuilding — the call counter (§2.3, Demo E 1–3)', () => {
  it('a cache hit serves the row, never calls the model, never moves the counter', async () => {
    const store = makeStore([makeEnrichment({ researchCalls: 1 })]);
    const { fetchImpl, calls } = mockFetch([CITED_FIELD]);
    const outcome = await researchBuilding({ ...BASE_INPUT, fetchImpl, store });
    expect(outcome.status).toBe('cached');
    expect(calls()).toBe(0);
    expect(store.rows.get(enrichmentIdFor('L304'))?.researchCalls).toBe(1);
  });

  it('a first research spends exactly one call and stores researchCalls: 1', async () => {
    const store = makeStore();
    const { fetchImpl, calls } = mockFetch([CITED_FIELD], {
      prompt_tokens: 100,
      completion_tokens: 50,
    });
    const outcome = await researchBuilding({ ...BASE_INPUT, fetchImpl, store });
    expect(outcome.status).toBe('researched');
    expect(calls()).toBe(1);
    const stored = store.rows.get(enrichmentIdFor('L304'));
    expect(stored?.researchCalls).toBe(1);
    expect(stored?.usage).toEqual({ promptTokens: 100, completionTokens: 50 });
    expect(stored?.fields).toHaveLength(1);
  });

  it('a second identical tap is a cache hit; only "Research again" spends call 2', async () => {
    const store = makeStore();
    const first = mockFetch([CITED_FIELD]);
    await researchBuilding({ ...BASE_INPUT, fetchImpl: first.fetchImpl, store });
    const second = mockFetch([CITED_FIELD]);
    const cached = await researchBuilding({ ...BASE_INPUT, fetchImpl: second.fetchImpl, store });
    expect(cached.status).toBe('cached');
    expect(second.calls()).toBe(0);
    expect(store.rows.get(enrichmentIdFor('L304'))?.researchCalls).toBe(1);
    const third = mockFetch([CITED_FIELD]);
    const forced = await researchBuilding({
      ...BASE_INPUT,
      force: true,
      fetchImpl: third.fetchImpl,
      store,
    });
    expect(forced.status).toBe('researched');
    expect(third.calls()).toBe(1);
    expect(store.rows.get(enrichmentIdFor('L304'))?.researchCalls).toBe(2);
  });

  it('a stale row re-runs and keeps its history (count + 1, not reset)', async () => {
    const store = makeStore([makeEnrichment({ researchedAt: daysAgo(91), researchCalls: 1 })]);
    const { fetchImpl } = mockFetch([CITED_FIELD]);
    const outcome = await researchBuilding({ ...BASE_INPUT, fetchImpl, store });
    expect(outcome.status).toBe('researched');
    expect(store.rows.get(enrichmentIdFor('L304'))?.researchCalls).toBe(2);
  });
});

describe('validateEnrichmentFields — the write-time gate (§2.4)', () => {
  it('a field with no citation is dropped at write time', async () => {
    const store = makeStore();
    const { fetchImpl } = mockFetch([
      { ...CITED_FIELD },
      {
        kind: 'loot',
        text: 'There is a safe behind the counter.',
        confidence: 0.9,
        sources: [],
      },
      {
        kind: 'purpose',
        text: 'A motel.',
        confidence: 0.7,
        sources: [{ title: '', url: '', quote: '' }],
      },
    ]);
    const outcome = await researchBuilding({ ...BASE_INPUT, fetchImpl, store });
    expect(outcome.status).toBe('researched');
    const stored = store.rows.get(enrichmentIdFor('L304'));
    expect(stored?.fields).toHaveLength(1);
    expect(stored?.fields[0]?.kind).toBe('identity');
  });

  it('two sources from distinct hosts corroborate; two from one host do not', () => {
    const twoHosts = validateEnrichmentFields(
      [
        {
          ...CITED_FIELD,
          sources: [
            {
              title: 'GTADB guide',
              url: 'https://gtadb.net/guide/cards',
              quote: 'The Starlet Motel sits on Historic Route 628.',
            },
            {
              title: 'PowerPyx guide',
              url: 'https://www.powerpyx.com/gta-6-guide/',
              quote: 'Starlet Motel, Kelly County.',
            },
          ],
        },
      ],
      verifiedEvidence(),
    );
    expect(twoHosts[0]?.status).toBe('corroborated');
    expect(twoHosts[0]?.corroboratedBy).toBe('PowerPyx guide');
    const oneHost = validateEnrichmentFields(
      [
        {
          ...CITED_FIELD,
          sources: [
            {
              title: 'GTADB guide',
              url: 'https://gtadb.net/guide/cards',
              quote: 'The Starlet Motel sits on Historic Route 628.',
            },
            {
              title: 'GTADB map',
              url: 'https://gtadb.net/map',
              quote: 'Starlet Motel pin.',
            },
          ],
        },
      ],
      verifiedEvidence(),
    );
    expect(oneHost[0]?.status).toBe('ai-suggested');
  });

  it('a low-confidence field is stored (so it is not re-paid for), not dropped', async () => {
    const store = makeStore();
    const { fetchImpl } = mockFetch([
      { ...CITED_FIELD, kind: 'purpose', text: 'Probably a motel.', confidence: 0.4 },
    ]);
    await researchBuilding({ ...BASE_INPUT, fetchImpl, store });
    const stored = store.rows.get(enrichmentIdFor('L304'));
    expect(stored?.fields).toHaveLength(1);
    expect(stored?.fields[0]?.confidence).toBe(0.4);
  });
});

describe('conflicts — the verified record wins, always (§2.4, Demo E 5)', () => {
  it('an AI field contradicting a verified record is quarantined, never shown as a fact', async () => {
    const store = makeStore();
    const { fetchImpl } = mockFetch([
      {
        ...CITED_FIELD,
        kind: 'loot',
        text: 'The motel safe holds $50,000.',
        confidence: 0.85,
        conflictsWith: 'GTADB / Map GTA · revision 2e9e194',
      },
    ]);
    const outcome = await researchBuilding({ ...BASE_INPUT, fetchImpl, store });
    expect(outcome.status).toBe('researched');
    const stored = store.rows.get(enrichmentIdFor('L304'));
    expect(stored?.fields[0]?.status).toBe('conflicted');
    expect(stored?.fields[0]?.conflictWith).toBe('GTADB / Map GTA · revision 2e9e194');
  });

  it('a conflict naming no real record is ignored, not trusted', () => {
    const fields = validateEnrichmentFields(
      [{ ...CITED_FIELD, conflictsWith: 'A guide that does not exist' }],
      verifiedEvidence(),
    );
    expect(fields[0]?.status).toBe('ai-suggested');
    expect(fields[0]?.conflictWith).toBeUndefined();
  });

  it('quarantine survives re-checking, and no path ever promotes a field to verified', () => {
    const stored: EnrichmentField[] = [
      {
        kind: 'loot',
        text: 'The motel safe holds $50,000.',
        confidence: 0.85,
        sources: [
          {
            title: 'A guide',
            url: 'https://example.com/guide',
            quote: 'Safe behind the counter.',
          },
        ],
        status: 'conflicted',
        conflictWith: 'GTADB / Map GTA · revision 2e9e194',
      },
      {
        kind: 'identity',
        text: 'The Starlet Motel.',
        confidence: 0.9,
        sources: [
          {
            title: 'GTADB guide',
            url: 'https://gtadb.net/guide/cards',
            quote: 'The Starlet Motel sits on Historic Route 628.',
          },
          {
            title: 'PowerPyx guide',
            url: 'https://www.powerpyx.com/gta-6-guide/',
            quote: 'Starlet Motel, Kelly County.',
          },
        ],
        status: 'corroborated',
        corroboratedBy: 'PowerPyx guide',
      },
    ];
    const requarantined = applyConflictQuarantine(stored, verifiedEvidence());
    expect(requarantined[0]?.status).toBe('conflicted');
    expect(requarantined[1]?.status).toBe('corroborated');
    const statuses = new Set(requarantined.map((field) => field.status));
    expect(statuses.has('verified' as EnrichmentField['status'])).toBe(false);
    // The status union itself has no 'verified' member — the type
    // forbids it, and this asserts the runtime values agree.
    for (const field of requarantined) {
      expect(['ai-suggested', 'corroborated', 'personal', 'conflicted']).toContain(field.status);
    }
  });
});

describe('researchBuilding — no key, no fake (§2.2, §5.3)', () => {
  it('with no key the model is never called and the request is queued once', async () => {
    const store = makeStore();
    const { fetchImpl, calls } = mockFetch([CITED_FIELD]);
    const outcome = await researchBuilding({ ...BASE_INPUT, apiKey: '', fetchImpl, store });
    expect(outcome.status).toBe('no-key');
    expect(calls()).toBe(0);
    expect(store.requests).toHaveLength(1);
    expect(store.requests[0]?.targetType).toBe('location');
    expect(store.requests[0]?.targetId).toBe('L304');
    expect(store.requests[0]?.status).toBe('queued');
    const queuedId = (outcome as { queuedRequestId: string | null }).queuedRequestId;
    expect(queuedId).toBe(store.requests[0]?.id);
    // A second keyless tap reuses the queued request — no duplicates.
    const again = await researchBuilding({ ...BASE_INPUT, apiKey: '  ', fetchImpl, store });
    expect(again.status).toBe('no-key');
    expect(store.requests).toHaveLength(1);
    expect((again as { queuedRequestId: string | null }).queuedRequestId).toBe(queuedId);
  });

  it('with no key but a stale cached row, the stale row is returned alongside the no-key state', async () => {
    const store = makeStore([makeEnrichment({ researchedAt: daysAgo(120), researchCalls: 2 })]);
    const { fetchImpl, calls } = mockFetch([CITED_FIELD]);
    const outcome = await researchBuilding({ ...BASE_INPUT, apiKey: '', fetchImpl, store });
    expect(outcome.status).toBe('no-key');
    expect(calls()).toBe(0);
    const enrichment = (outcome as { enrichment: Enrichment | null }).enrichment;
    expect(enrichment?.researchCalls).toBe(2);
  });
});

describe('parseEnrichment — the counter survives backup round-trip', () => {
  it('researchCalls is preserved when present and absent when the row predates it', () => {
    const base = {
      id: enrichmentIdFor('L304'),
      locationId: 'L304',
      schemaVersion: ENRICHMENT_SCHEMA_VERSION,
      researchedAt: daysAgo(10),
      researchedBy: 'gpt-4o-mini',
      fields: [
        {
          kind: 'identity',
          text: 'The Starlet Motel.',
          confidence: 0.8,
          sources: [
            {
              title: 'GTADB guide',
              url: 'https://gtadb.net/guide/cards',
              quote: 'The Starlet Motel sits on Historic Route 628.',
            },
          ],
          status: 'ai-suggested',
        },
      ],
      imagery: [],
      question: null,
    };
    expect(parseEnrichment({ ...base, researchCalls: 3 }).researchCalls).toBe(3);
    expect(parseEnrichment(base).researchCalls).toBeUndefined();
  });
});
