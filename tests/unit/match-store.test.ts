import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Place } from '../../src/domain/types';
import type { CardChecklistItem } from '../../src/data/card-checklist.generated';
import { AtlasDatabase } from '../../src/db/repository';
import {
  buildGameDatabase,
  type CollectibleItem,
  type GameDatabase,
} from '../../src/domain/game-db';
import { attemptFingerprint, resolveSlotDeterministically } from '../../src/features/ask/card-matcher';
import {
  reviewItems,
  useMatchStore,
} from '../../src/features/ask/match-store';

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

const PLACES: Place[] = [
  place({ id: 'L9001', title: 'Xero Gas Station, Test Town', layerId: 'shops-food', tags: ['#gas'] }),
  place({ id: 'L9003', title: 'Smith House, Grace Ave, Test Town', layerId: 'breakable', tags: ['residential'] }),
];

const SLOTS: CardChecklistItem[] = [
  slot({
    id: 'slot:xero',
    person: 'Xero Person',
    pickups: [{ areaLead: 'Test Town', direction: '· Xero, Main St · desk', sourceTitle: 'lorenzone.fr', sourceUrl: '', evidence: 'approximate', hostId: null, hostName: null }],
  }),
  slot({
    id: 'slot:grace',
    person: 'Grace Person',
    pickups: [{ areaLead: 'Test Town', direction: '· Grace Ave · bedroom', sourceTitle: 'lorenzone.fr', sourceUrl: '', evidence: 'approximate', hostId: null, hostName: null }],
  }),
];

function syntheticDb(): GameDatabase {
  return buildGameDatabase({ places: PLACES, checklistItems: SLOTS });
}

function syntheticSlot(db: GameDatabase, id: string): CollectibleItem {
  const item = db.items.get(id);
  if (!item) throw new Error(`no synthetic slot ${id}`);
  return item;
}

let repo: AtlasDatabase;
beforeEach(() => {
  repo = new AtlasDatabase(`match-store-test-${crypto.randomUUID()}`);
  useMatchStore.setState({
    matches: [],
    attempts: [],
    rejections: [],
    loaded: false,
    error: null,
    job: null,
  });
});
afterEach(async () => {
  await repo.delete();
});

describe('match store', () => {
  it('loads empty, then confirms a proposal — the match lands in Dexie and in state', async () => {
    const store = useMatchStore.getState();
    await store.load({ repository: repo });
    expect(useMatchStore.getState().loaded).toBe(true);
    expect(useMatchStore.getState().matches).toEqual([]);

    const db = syntheticDb();
    const item = syntheticSlot(db, 'slot:xero');
    const proposal = resolveSlotDeterministically(db, item).proposal!;
    const result = await useMatchStore.getState().confirmProposal(proposal, item, { repository: repo });
    expect(result.ok).toBe(true);
    expect(await repo.loadCardMatches()).toHaveLength(1);
    expect(useMatchStore.getState().matches[0]?.hostId).toBe('L9001');
    expect(useMatchStore.getState().matches[0]?.evidenceKind).toBe('approximate');
  });

  it('rejecting a proposal excludes it from the review list, and the slot stays open', async () => {
    const db = syntheticDb();
    const item = syntheticSlot(db, 'slot:grace');
    const proposal = resolveSlotDeterministically(db, item).proposal!;
    const store = useMatchStore.getState();
    await store.load({ repository: repo });
    // Seed the attempt so the review list has something to exclude.
    const fingerprint = attemptFingerprint(item.id, ['L9003']);
    await repo.saveMatcherAttempts([
      {
        id: `${item.id}::${fingerprint}`,
        slotId: item.id,
        fingerprint,
        at: '2026-11-26T07:00:00.000Z',
        result: 'proposed',
        proposedHostId: 'L9003',
        confidence: 0.7,
        reasoning: 'Only named house on the named street in the area.',
        proposedBy: 'deterministic',
      },
    ]);
    await useMatchStore.getState().refresh({ repository: repo });
    expect(reviewItems(db, useMatchStore.getState())).toHaveLength(1);

    const result = await useMatchStore.getState().rejectProposal(item.id, proposal.hostId, { repository: repo });
    expect(result.ok).toBe(true);
    expect(await repo.loadMatcherRejections()).toHaveLength(1);
    expect(reviewItems(db, useMatchStore.getState())).toHaveLength(0);
    // The slot is still unmatched — it re-enters the matcher queue.
    expect(useMatchStore.getState().matches).toHaveLength(0);
  });

  it('a confirmed slot leaves the review list', async () => {
    const db = syntheticDb();
    const item = syntheticSlot(db, 'slot:xero');
    const fingerprint = attemptFingerprint(item.id, ['L9001']);
    await repo.saveMatcherAttempts([
      {
        id: `${item.id}::${fingerprint}`,
        slotId: item.id,
        fingerprint,
        at: '2026-11-26T07:00:00.000Z',
        result: 'proposed',
        proposedHostId: 'L9001',
        confidence: 0.8,
        reasoning: 'Only Xero in the named area.',
        proposedBy: 'deterministic',
      },
    ]);
    await useMatchStore.getState().load({ repository: repo });
    const rows = reviewItems(db, useMatchStore.getState());
    expect(rows).toHaveLength(1);
    expect(rows[0]?.hostName).toBe('Xero Gas Station, Test Town');
    expect(rows[0]?.areaCheck).toContain('Test Town');

    const proposal = resolveSlotDeterministically(db, item).proposal!;
    await useMatchStore.getState().confirmProposal(proposal, item, { repository: repo });
    expect(reviewItems(db, useMatchStore.getState())).toHaveLength(0);
  });

  it('records a jot as a personal match', async () => {
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
    const result = await useMatchStore.getState().recordJotMatch(item, marker, { repository: repo });
    expect(result.ok).toBe(true);
    const saved = await repo.loadCardMatches();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.hostId).toBe('custom:jot-1');
    expect(saved[0]?.evidenceKind).toBe('personal');
    expect(saved[0]?.confidence).toBe(1);
  });

  it('runs the job over the synthetic slots and saves the attempts', async () => {
    const db = syntheticDb();
    const slots = SLOTS.map((entry) => syntheticSlot(db, entry.id));
    await useMatchStore.getState().load({ repository: repo });
    await useMatchStore.getState().startJob(
      { db, slots, apiKey: '' },
      { repository: repo },
    );
    const job = useMatchStore.getState().job;
    expect(job?.outcome).toBe('done');
    expect(job?.running).toBe(false);
    expect(job?.proposed.map((proposal) => proposal.hostId).sort()).toEqual(['L9001', 'L9003']);
    expect(await repo.loadMatcherAttempts()).toHaveLength(2);
    expect(reviewItems(db, useMatchStore.getState())).toHaveLength(2);
  });
});
