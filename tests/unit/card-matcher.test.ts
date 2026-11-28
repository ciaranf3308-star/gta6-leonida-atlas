import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Place } from '../../src/domain/types';
import type { CardChecklistItem } from '../../src/data/card-checklist.generated';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  buildGameDatabase,
  type CollectibleItem,
  type GameDatabase,
} from '../../src/domain/game-db';
import {
  attemptFingerprint,
  buildPersonalMatch,
  candidateHostsForSlot,
  matchSlot,
  matchSlotWithLlm,
  recordJot,
  rejectionKey,
  resolveSlotDeterministically,
  runMatcherJob,
  slotConflictNote,
} from '../../src/features/ask/card-matcher';

// ---------------------------------------------------------------------------
// Real data — the honest yield, measured 2026-11-26 on rev 2e9e194.
// ---------------------------------------------------------------------------

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
const fullDb: GameDatabase = buildGameDatabase({ places });
const unmatched = [...fullDb.items.values()].filter(
  (item) => item.checklistSlot && item.placement === 'area-known',
);
const slotById = (id: string): CollectibleItem => {
  const slot = unmatched.find((item) => item.id === id);
  if (!slot) throw new Error(`no unmatched slot ${id}`);
  return slot;
};
// Three Dominic Brizzolato variants share the name (bronze/silver/
// gold) with different directions — name lookups grab the wrong one,
// so the D1 tests use ids.
const DOMINIC_SILVER = 'card-checklist:vice-city-manatees:dominic-brizzolato:silver';
const ARMANDO_LIFEGUARD = 'card-checklist:liberty-city-wrath:armando-ibarra-jr:standard';

describe('card matcher — deterministic yield on the real data', () => {
  it('the fbrito import resolved the one deterministic slot — the real pool now proposes nothing', () => {
    // 28 Nov 2026: Dominic Brizzolato (silver) was the pool's only
    // deterministic D1 proposal (Nehrling River, L3442). The fbrito
    // import pinned him at card:fbrito-card-vice-city-manatees-023,
    // so the matcher — which only runs over area-known slots — has
    // nothing left to propose. D1 keeps coverage from the synthetic
    // test below ('D1 proposes the only named host in the area').
    const proposed = unmatched
      .map((slot) => resolveSlotDeterministically(fullDb, slot))
      .filter((result) => result.proposal);
    expect(unmatched).toHaveLength(94);
    expect(proposed).toHaveLength(0);
    const dominic = fullDb.items.get(DOMINIC_SILVER)!;
    expect(dominic.placement).toBe('pinned');
    expect(dominic.locationId).toBe('card:fbrito-card-vice-city-manatees-023');
  });

  it('D2 and D3 propose nothing today — the AI index is 32/3,280 typed and only 19 residential records are named, none on any direction street', () => {
    const byPass = new Map<string, number>();
    for (const slot of unmatched) {
      const result = resolveSlotDeterministically(fullDb, slot);
      if (result.proposal) {
        byPass.set(
          result.proposal.candidate.pass,
          (byPass.get(result.proposal.candidate.pass) ?? 0) + 1,
        );
      }
    }
    expect(byPass.get('D2') ?? 0).toBe(0);
    expect(byPass.get('D3') ?? 0).toBe(0);
  });

  it('counts the LLM-eligible pool: 0 proposed, 1 ambiguous, 0 more with candidates, 93 with none', () => {
    let proposed = 0;
    let ambiguous = 0;
    let noneWith = 0;
    let noneWithout = 0;
    for (const slot of unmatched) {
      const result = resolveSlotDeterministically(fullDb, slot);
      if (result.proposal) proposed += 1;
      else if (result.status === 'ambiguous') ambiguous += 1;
      else if (result.candidates.length > 0) noneWith += 1;
      else noneWithout += 1;
    }
    expect(proposed).toBe(0);
    expect(ambiguous).toBe(1);
    expect(noneWith).toBe(0);
    expect(noneWithout).toBe(93);
    expect(proposed + ambiguous + noneWith + noneWithout).toBe(94);
    // The one ambiguous slot is Armando Ibarra Jr (two lifeguard
    // towers in his area — the LLM's call, never a coin flip).
    const ambiguousSlots = unmatched.filter(
      (slot) => resolveSlotDeterministically(fullDb, slot).status === 'ambiguous',
    );
    expect(ambiguousSlots.map((slot) => slot.id)).toEqual([ARMANDO_LIFEGUARD]);
  });

  it('the Sahara Arena slot is resolved by the import — the area-disagreeing host is no longer a matcher case', () => {
    // Christoph Schulz (Vice City Narcos) was the pool's Sahara Arena
    // case: the guide names Downtown, the arena sits in Shoreline.
    // The fbrito import pinned him, so the matcher never sees him —
    // the conflict is moot, not hidden. The area-disagreement
    // mechanism itself keeps coverage in the synthetic test below
    // ('an area-disagreeing host is never a deterministic proposal').
    const slot = [...fullDb.items.values()].find((item) =>
      (item.pickups[0]?.direction ?? '').includes('Sahara Arena'),
    )!;
    expect(slot.id).toBe('card-checklist:vice-city-narcos:christoph-schulz:standard');
    expect(slot.placement).toBe('pinned');
    expect(slot.locationId?.startsWith('card:fbrito-')).toBe(true);
    expect(unmatched.some((item) => item.id === slot.id)).toBe(false);
  });

  it('a lifeguard direction is a chain question even though the type word is in the second segment', () => {
    const slot = slotById(ARMANDO_LIFEGUARD);
    expect(slot.pickups[0]?.direction).toContain('lifeguard');
    const candidates = candidateHostsForSlot(fullDb, slot);
    // Two towers in the slot's area — ambiguous, never a
    // deterministic pick, but the slot IS in the LLM's universe.
    // (Gerry Northgate / Ian Harris, both Ocean Beach, have ZERO
    // candidates today: their towers sit in the qualified node
    // 'Ocean Beach, Vice Beach' while the slot's area is the bare
    // 'Ocean Beach' node — the same bare-vs-qualified area-identity
    // gap as Port Gellhorn. That is a step-1 area-tree gap, flagged
    // for the coordinator; the matcher must not paper over it.)
    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) => candidate.pass === 'D2')).toBe(true);
    const result = resolveSlotDeterministically(fullDb, slot);
    expect(result.proposal).toBeNull();
    expect(result.status).toBe('ambiguous');
  });
});

// ---------------------------------------------------------------------------
// Synthetic db — D2/D3 with known ground truth (the real data has none)
// ---------------------------------------------------------------------------

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'title' | 'layerId'>): Place {
  return {
    description: '',
    category: 'food-drink',
    position: { x: 0, y: 0 },
    tags: [],
    region: 'Test Town',
    source: { title: 'test', url: '' },
    evidence: 'approximate',
    ...overrides,
  };
}

function slot(overrides: Partial<CardChecklistItem> & Pick<CardChecklistItem, 'id'>): CardChecklistItem {
  return {
    person: 'Test Person',
    variant: 'standard',
    variantAlias: null,
    setId: null,
    setName: null,
    checklistSlot: true,
    rarity: { tier: 'standard' },
    placement: 'area-known',
    spotDescription: '',
    areaLead: 'Test Town',
    pickups: [
      {
        areaLead: 'Test Town',
        direction: '· Test Town · desk',
        sourceTitle: 'lorenzone.fr',
        sourceUrl: '',
        evidence: 'approximate',
        hostId: null,
        hostName: null,
      },
    ],
    hostId: null,
    catalogueId: null,
    conflict: null,
    printedText: null,
    artwork: { front: null, back: null },
    ...overrides,
  };
}

const SYNTHETIC_PLACES: Place[] = [
  place({ id: 'L9001', title: 'Xero Gas Station, Test Town', layerId: 'shops-food', tags: ['#gas'] }),
  place({ id: 'L9002', title: 'Xero Gas Station, Other Town', layerId: 'shops-food', region: 'Other Town', tags: ['#gas'] }),
  // Titled but untagged — the title alone types the chain (fix g).
  place({ id: 'L9006', title: 'Xero Gas Station, Third Town', layerId: 'shops-food', region: 'Third Town', tags: [] }),
  place({ id: 'L9003', title: 'Smith House, Grace Ave, Test Town', layerId: 'breakable', tags: ['residential'] }),
  place({ id: 'L9004', title: 'Jones House, Main St, Test Town', layerId: 'breakable', tags: ['residential'] }),
  place({ id: 'L9005', title: 'Brown House, Main St, Test Town', layerId: 'breakable', tags: ['residential'] }),
];

const SYNTHETIC_SLOTS: CardChecklistItem[] = [
  slot({
    id: 'slot:xero',
    person: 'Xero Person',
    areaLead: 'Test Town',
    pickups: [{ areaLead: 'Test Town', direction: '· Xero, Main St · desk', sourceTitle: 'lorenzone.fr', sourceUrl: '', evidence: 'approximate', hostId: null, hostName: null }],
  }),
  slot({
    id: 'slot:xero-title',
    person: 'Title Person',
    areaLead: 'Third Town',
    pickups: [{ areaLead: 'Third Town', direction: '· Xero, Third Town · desk', sourceTitle: 'lorenzone.fr', sourceUrl: '', evidence: 'approximate', hostId: null, hostName: null }],
  }),
  slot({
    id: 'slot:grace',
    person: 'Grace Person',
    areaLead: 'Test Town',
    pickups: [{ areaLead: 'Test Town', direction: '· Grace Ave · bedroom', sourceTitle: 'lorenzone.fr', sourceUrl: '', evidence: 'approximate', hostId: null, hostName: null }],
  }),
  slot({
    id: 'slot:main',
    person: 'Main Person',
    areaLead: 'Test Town',
    pickups: [{ areaLead: 'Test Town', direction: '· Main St · kitchen', sourceTitle: 'lorenzone.fr', sourceUrl: '', evidence: 'approximate', hostId: null, hostName: null }],
  }),
];

function syntheticDb(): GameDatabase {
  return buildGameDatabase({ places: SYNTHETIC_PLACES, checklistItems: SYNTHETIC_SLOTS });
}

// A second synthetic db carrying the two cases the real pool no
// longer has: a D1 named host in the same area, and an
// area-disagreeing host (the Sahara Arena shape). Kept separate
// from SYNTHETIC_* so the job tests' batch counts do not move.
const EXTRA_PLACES: Place[] = [
  ...SYNTHETIC_PLACES,
  place({ id: 'L9010', title: 'The Old Mill, Test Town', layerId: 'shops-food', tags: [] }),
  place({ id: 'L9011', title: 'Sahara Arena, Other Town', layerId: 'shops-food', region: 'Other Town', tags: [] }),
];
const EXTRA_SLOTS: CardChecklistItem[] = [
  ...SYNTHETIC_SLOTS,
  slot({
    id: 'slot:mill',
    person: 'Mill Person',
    areaLead: 'Test Town',
    pickups: [{ areaLead: 'Test Town', direction: '· The Old Mill · back room', sourceTitle: 'lorenzone.fr', sourceUrl: '', evidence: 'approximate', hostId: null, hostName: null }],
  }),
  slot({
    id: 'slot:sahara',
    person: 'Sahara Person',
    areaLead: 'Test Town',
    conflict: 'Guide names Downtown; the Sahara Arena sits in Shoreline.',
    pickups: [{ areaLead: 'Test Town', direction: '· Sahara Arena · lobby', sourceTitle: 'lorenzone.fr', sourceUrl: '', evidence: 'approximate', hostId: null, hostName: null }],
  }),
];
function extraDb(): GameDatabase {
  return buildGameDatabase({ places: EXTRA_PLACES, checklistItems: EXTRA_SLOTS });
}

function syntheticSlot(db: GameDatabase, id: string): CollectibleItem {
  const item = db.items.get(id);
  if (!item) throw new Error(`no synthetic slot ${id}`);
  return item;
}

describe('card matcher — D1/D2/D3 on synthetic ground truth', () => {
  it('D1 proposes the only named host in the area (0.95)', () => {
    const db = extraDb();
    const result = resolveSlotDeterministically(db, syntheticSlot(db, 'slot:mill'));
    expect(result.status).toBe('proposed');
    expect(result.proposal?.hostId).toBe('L9010');
    expect(result.proposal?.candidate.pass).toBe('D1');
    expect(result.proposal?.candidate.areaAgrees).toBe(true);
    expect(result.proposal?.confidence).toBe(0.95);
    expect(result.proposal?.proposedBy).toBe('deterministic');
  });

  it('an area-disagreeing host is never a deterministic proposal — it stays visible for the LLM', () => {
    const db = extraDb();
    const item = syntheticSlot(db, 'slot:sahara');
    const candidates = candidateHostsForSlot(db, item);
    const arena = candidates.find((candidate) => candidate.hostId === 'L9011');
    expect(arena).toBeDefined();
    expect(arena?.pass).toBe('llm');
    expect(arena?.areaAgrees).toBe(false);
    expect(arena?.hostName).toContain('Sahara Arena');
    const result = resolveSlotDeterministically(db, item);
    expect(result.proposal).toBeNull();
    expect(result.status).toBe('none');
    // The conflict note is on the slot and survives to the review screen.
    expect(slotConflictNote(item)).toContain('Sahara Arena');
  });

  it('D2 proposes the only Xero in the area (tag-typed, 0.8), never the one in the other town', () => {
    const db = syntheticDb();
    const result = resolveSlotDeterministically(db, syntheticSlot(db, 'slot:xero'));
    expect(result.status).toBe('proposed');
    expect(result.proposal?.hostId).toBe('L9001');
    expect(result.proposal?.candidate.pass).toBe('D2');
    expect(result.proposal?.candidate.typeEvidence).toBe('tag');
    expect(result.proposal?.confidence).toBe(0.8);
  });

  it('D2 proposes a titled-but-untagged station on the title alone', () => {
    const db = syntheticDb();
    const result = resolveSlotDeterministically(db, syntheticSlot(db, 'slot:xero-title'));
    expect(result.status).toBe('proposed');
    expect(result.proposal?.hostId).toBe('L9006');
    expect(result.proposal?.candidate.typeEvidence).toBe('title');
  });

  it('D3 proposes the only named house on the named street (0.7)', () => {
    const db = syntheticDb();
    const result = resolveSlotDeterministically(db, syntheticSlot(db, 'slot:grace'));
    expect(result.status).toBe('proposed');
    expect(result.proposal?.hostId).toBe('L9003');
    expect(result.proposal?.candidate.pass).toBe('D3');
    expect(result.proposal?.confidence).toBe(0.7);
  });

  it('D3 stays silent when two houses share the street — the LLM decides, never a coin flip', () => {
    const db = syntheticDb();
    const result = resolveSlotDeterministically(db, syntheticSlot(db, 'slot:main'));
    expect(result.proposal).toBeNull();
    expect(result.status).toBe('ambiguous');
    expect(result.candidates.map((candidate) => candidate.hostId).sort()).toEqual([
      'L9004',
      'L9005',
    ]);
  });

  it('an M4 rejection removes the host from the candidates — the slot stays open, never re-proposed', () => {
    const db = syntheticDb();
    const item = syntheticSlot(db, 'slot:xero');
    const rejected = new Set([rejectionKey(item.id, 'L9001')]);
    const result = resolveSlotDeterministically(db, item, { rejections: rejected });
    expect(result.proposal).toBeNull();
    // L9001 is gone; what remains is D3's two Main St houses, so the
    // slot is ambiguous (the LLM's call), not silently empty.
    expect(result.status).toBe('ambiguous');
    expect(result.candidates.map((candidate) => candidate.hostId).sort()).toEqual([
      'L9004',
      'L9005',
    ]);
  });
});

// ---------------------------------------------------------------------------
// LLM pass, fingerprints, job, jot
// ---------------------------------------------------------------------------

function llmFetch(content: string): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('card matcher — LLM pass and fingerprints', () => {
  it('the LLM can propose the area-disagreeing Sahara Arena, capped at 0.7 with the area check on the proposal', async () => {
    // Synthetic: the real Sahara slot was resolved by the fbrito
    // import, so the 0.7 cap now demonstrates on the synthetic
    // area-disagreeing arena (slot:sahara in the extra db).
    const db = extraDb();
    const slot = syntheticSlot(db, 'slot:sahara');
    const candidates = candidateHostsForSlot(db, slot);
    const fetchImpl = llmFetch(
      JSON.stringify({ choice: 'L9011', confidence: 0.95, reasoning: 'The guide names the arena.' }),
    );
    const result = await matchSlotWithLlm({
      db,
      slot,
      candidates,
      apiKey: 'test-key',
      fetchImpl,
    });
    expect(result.status).toBe('proposed');
    expect(result.proposal?.hostId).toBe('L9011');
    expect(result.proposal?.confidence).toBe(0.7);
    expect(result.proposal?.proposedBy).toBe('llm');
    expect(result.proposal?.candidate.areaAgrees).toBe(false);
    expect(result.proposal?.areaCheck).toContain('areas disagree');
  });

  it('the LLM prompt carries no coordinates', async () => {
    const slot = slotById(ARMANDO_LIFEGUARD);
    const candidates = candidateHostsForSlot(fullDb, slot);
    let body = '';
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      body = String(init?.body ?? '');
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"choice": "none", "confidence": 0.9, "reasoning": "too many identical towers"}' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as unknown as typeof fetch;
    const result = await matchSlotWithLlm({
      db: fullDb,
      slot,
      candidates,
      apiKey: 'test-key',
      fetchImpl,
    });
    expect(result.status).toBe('not-sure');
    expect(body).not.toMatch(/-?\d{3,4}\.\d+/);
  });

  it('a low-confidence LLM answer is not-sure, never a proposal', async () => {
    const slot = slotById(ARMANDO_LIFEGUARD);
    const candidates = candidateHostsForSlot(fullDb, slot);
    const result = await matchSlotWithLlm({
      db: fullDb,
      slot,
      candidates,
      apiKey: 'test-key',
      fetchImpl: llmFetch(
        JSON.stringify({ choice: candidates[0]!.hostId, confidence: 0.4, reasoning: 'a guess' }),
      ),
    });
    expect(result.status).toBe('not-sure');
    expect(result.proposal).toBeNull();
  });

  it('an unchanged fingerprint skips the slot — no re-run, no paid call', async () => {
    const db = syntheticDb();
    const item = syntheticSlot(db, 'slot:xero');
    const first = await matchSlot(db, item, { apiKey: 'test-key' });
    expect(first.status).toBe('proposed');
    const second = await matchSlot(db, item, {
      apiKey: 'test-key',
      latestAttempt: first.status === 'proposed' ? first.attempt : null,
      fetchImpl: (() => {
        throw new Error('must not fetch on a skip');
      }) as unknown as typeof fetch,
    });
    expect(second.status).toBe('skipped');
    expect(second.attempt.fingerprint).toBe(
      first.status === 'proposed' ? first.attempt.fingerprint : '',
    );
  });

  it('a keyless attempt never blocks a later keyed run — the fingerprint carries :nokey', async () => {
    const item = slotById(ARMANDO_LIFEGUARD);
    const noKey = await matchSlot(fullDb, item, {});
    expect(noKey.status).toBe('none');
    expect(noKey.attempt.fingerprint.endsWith(':nokey')).toBe(true);
    const keyedFingerprint = attemptFingerprint(
      item.id,
      candidateHostsForSlot(fullDb, item).map((candidate) => candidate.hostId),
      true,
    );
    expect(keyedFingerprint).not.toBe(noKey.attempt.fingerprint);
    // And the keyed run actually asks the LLM (mocked to none).
    const keyed = await matchSlot(fullDb, item, {
      apiKey: 'test-key',
      latestAttempt: noKey.attempt,
      fetchImpl: llmFetch(
        JSON.stringify({ choice: 'none', confidence: 0.9, reasoning: 'too many identical towers' }),
      ),
    });
    expect(keyed.status).toBe('not-sure');
  });

  it('a deterministic proposal needs no key at all', async () => {
    // Synthetic Xero (D2): the real deterministic slot (Dominic
    // silver) was resolved by the fbrito import.
    const db = syntheticDb();
    const item = syntheticSlot(db, 'slot:xero');
    const result = await matchSlot(db, item, {});
    if (result.status !== 'proposed') throw new Error(`expected a proposal, got ${result.status}`);
    expect(result.proposal.hostId).toBe('L9001');
  });

  it('the job proposes the deterministic slot and saves one batch', async () => {
    const db = syntheticDb();
    const saved: Array<readonly unknown[]> = [];
    const outcome = await runMatcherJob({
      db,
      slots: SYNTHETIC_SLOTS.map((entry) => syntheticSlot(db, entry.id)),
      attempts: [],
      apiKey: '',
      shouldPause: () => false,
      shouldCancel: () => false,
      applyBatch: async (attempts) => {
        saved.push(attempts);
        return true;
      },
      batchDelayMs: 0,
    });
    expect(outcome.outcome).toBe('done');
    expect(outcome.proposed.map((proposal) => proposal.hostId).sort()).toEqual([
      'L9001',
      'L9003',
      'L9006',
    ]);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toHaveLength(4);
  });

  it('the job pauses between batches and resumes with the proposals so far', async () => {
    const db = syntheticDb();
    // 9 slots = batch 1 of 8 + batch 2 of 1; the pause flag fires at
    // the top of batch 2, so the run stops with batch 1's proposals.
    const nine = [
      ...SYNTHETIC_SLOTS.map((entry) => syntheticSlot(db, entry.id)),
      ...SYNTHETIC_SLOTS.map((entry) => syntheticSlot(db, entry.id)),
      syntheticSlot(db, 'slot:xero'),
    ];
    let checks = 0;
    const outcome = await runMatcherJob({
      db,
      slots: nine,
      attempts: [],
      apiKey: '',
      shouldPause: () => ++checks > 1,
      shouldCancel: () => false,
      applyBatch: async () => true,
      batchDelayMs: 0,
    });
    expect(outcome.outcome).toBe('paused');
    expect(outcome.proposed.map((proposal) => proposal.hostId).sort()).toEqual([
      'L9001',
      'L9001',
      'L9003',
      'L9003',
      'L9006',
      'L9006',
    ]);
  });
});

describe('card matcher — what a confirmation becomes', () => {
  it('buildPersonalMatch carries approximate evidence, never verified', () => {
    const db = syntheticDb();
    const item = syntheticSlot(db, 'slot:xero');
    const resolved = resolveSlotDeterministically(db, item);
    const match = buildPersonalMatch(resolved.proposal!, item);
    expect(match.slotId).toBe('slot:xero');
    expect(match.hostId).toBe('L9001');
    expect(match.confidence).toBe(0.8);
    expect(match.evidenceKind).toBe('approximate');
    expect(match.proposedBy).toBe('deterministic');
    expect(match.confirmedBy).toBe('player');
    expect(match.citations[0]?.catalogueRecordId).toBe('L9001');
  });

  it('recordJot is evidence personal, confidence 1, host is the marker', () => {
    const db = syntheticDb();
    const item = syntheticSlot(db, 'slot:grace');
    const marker = {
      id: 'custom:jot-1',
      title: 'House on Grace Ave',
      description: '',
      category: 'my-markers' as const,
      position: { x: 10, y: 20 },
      kind: 'breakable' as const,
      icon: 'pin' as const,
      createdAt: '2026-11-26T00:00:00.000Z',
      updatedAt: '2026-11-26T00:00:00.000Z',
    };
    const match = recordJot(item, marker);
    expect(match.hostId).toBe('custom:jot-1');
    expect(match.confidence).toBe(1);
    expect(match.evidenceKind).toBe('personal');
    expect(match.proposedBy).toBe('player');
    expect(match.citations[0]?.sourceTitle).toBe('Player jot — marked in-game');
  });
});
