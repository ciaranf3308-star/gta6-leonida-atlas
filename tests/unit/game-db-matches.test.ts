import { describe, expect, it } from 'vitest';
import type { Place } from '../../src/domain/types';
import { EMPTY_USER_DATA } from '../../src/domain/types';
import type { CardChecklistItem } from '../../src/data/card-checklist.generated';
import type { PersonalMatch } from '../../src/domain/album';
import { buildGameDatabase, type BuildGameDatabaseInput, type GameDatabase } from '../../src/domain/game-db';

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'title' | 'layerId'>): Place {
  return {
    description: '',
    category: 'food-drink',
    position: { x: 100, y: 100 },
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
        direction: '· Grace Ave · bedroom',
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

function match(overrides: Partial<PersonalMatch> & Pick<PersonalMatch, 'slotId' | 'hostId'>): PersonalMatch {
  return {
    confidence: 0.8,
    reasoning: 'Only Xero in the area.',
    citations: [],
    proposedBy: 'deterministic',
    confirmedBy: 'player',
    confirmedAt: '2026-11-26T07:00:00.000Z',
    evidenceKind: 'approximate',
    ...overrides,
  };
}

const PLACES: Place[] = [
  place({ id: 'L9003', title: 'Smith House, Grace Ave, Test Town', layerId: 'breakable', tags: ['residential'] }),
  place({ id: 'L9002', title: 'Xero Gas Station, Other Town', layerId: 'shops-food', region: 'Other Town', tags: ['#gas'] }),
  // An uncertain GTADB record — uncorroborated it is area-known even
  // with a position; a confirmed match is the second source that
  // pins it.
  place({
    id: 'L9100',
    title: 'Doubtful House, Grace Ave, Test Town',
    layerId: 'breakable',
    tags: ['residential'],
    source: { title: 'GTADB snapshot', url: '' },
    evidence: 'uncertain',
  }),
];

const SLOTS: CardChecklistItem[] = [
  slot({ id: 'slot:grace' }),
  slot({ id: 'slot:other', person: 'Other Person' }),
  slot({ id: 'slot:doubtful', person: 'Doubtful Person' }),
];

function build(matches: readonly PersonalMatch[], user?: BuildGameDatabaseInput['user']): GameDatabase {
  return buildGameDatabase({ places: PLACES, checklistItems: SLOTS, matches, user });
}

describe('game-db — player-confirmed card matches (CARD-MATCHER-DESIGN §2.3)', () => {
  it('an applied match pins the slot to its host and lands in itemsByLocation', () => {
    const db = build([match({ slotId: 'slot:grace', hostId: 'L9003' })]);
    const item = db.items.get('slot:grace')!;
    expect(item.placement).toBe('pinned');
    expect(item.locationId).toBe('L9003');
    expect(item.areaId).toBe(db.locations.get('L9003')!.areaId);
    expect(db.itemsByLocation.get('L9003')!.map((entry) => entry.id)).toContain('slot:grace');
    expect(db.matches).toHaveLength(1);
    expect(db.matches[0]?.slotId).toBe('slot:grace');
    expect(db.staleMatches).toHaveLength(0);
    // The slot now counts as found-in-the-world, not remaining.
    expect(db.items.get('slot:grace')!.placement).toBe('pinned');
  });

  it('a match to a deleted host goes stale — the slot stays area-known and the match is preserved', () => {
    const db = build([match({ slotId: 'slot:grace', hostId: 'L9999' })]);
    expect(db.items.get('slot:grace')!.placement).toBe('area-known');
    expect(db.items.get('slot:grace')!.locationId).toBeNull();
    expect(db.matches).toHaveLength(0);
    expect(db.staleMatches).toHaveLength(1);
    expect(db.staleMatches[0]?.reason).toBe('host-missing');
    expect(db.staleMatches[0]?.match.slotId).toBe('slot:grace');
    expect(db.staleMatches[0]?.detail).toContain('L9999');
  });

  it('a match for a slot that left the checklist goes stale', () => {
    const db = build([match({ slotId: 'slot:ghost', hostId: 'L9003' })]);
    expect(db.matches).toHaveLength(0);
    expect(db.staleMatches).toHaveLength(1);
    expect(db.staleMatches[0]?.reason).toBe('slot-missing');
  });

  it('a match whose host area disagrees with the guide area goes stale — never silently pinned', () => {
    const db = build([match({ slotId: 'slot:grace', hostId: 'L9002' })]);
    expect(db.items.get('slot:grace')!.placement).toBe('area-known');
    expect(db.matches).toHaveLength(0);
    expect(db.staleMatches).toHaveLength(1);
    expect(db.staleMatches[0]?.reason).toBe('area-disagreement');
    expect(db.staleMatches[0]?.detail).toContain('L9002');
  });

  it('a confirmed match corroborates an uncertain host — the place pins', () => {
    const without = build([]);
    expect(without.locations.get('L9100')!.placement).toBe('area-known');
    const withMatch = build([match({ slotId: 'slot:doubtful', hostId: 'L9100' })]);
    expect(withMatch.locations.get('L9100')!.placement).toBe('pinned');
    expect(withMatch.items.get('slot:doubtful')!.placement).toBe('pinned');
  });

  it('a jot (player marker host) always applies — the player stood there', () => {
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
    const db = build(
      [
        {
          slotId: 'slot:grace',
          hostId: 'custom:jot-1',
          confidence: 1,
          reasoning: 'Marked by you in-game.',
          citations: [],
          proposedBy: 'player',
          confirmedBy: 'player',
          confirmedAt: '2026-11-26T07:00:00.000Z',
          evidenceKind: 'personal',
        },
      ],
      { ...EMPTY_USER_DATA, markers: [marker] },
    );
    expect(db.locations.has('custom:jot-1')).toBe(true);
    const item = db.items.get('slot:grace')!;
    expect(item.placement).toBe('pinned');
    expect(item.locationId).toBe('custom:jot-1');
    expect(db.matches).toHaveLength(1);
    expect(db.staleMatches).toHaveLength(0);
  });

  it('a null guide area takes the host area — the confirmed match is the only area evidence the slot has', () => {
    const noAreaSlot = slot({
      id: 'slot:no-area',
      person: 'No Area Person',
      areaLead: '',
      pickups: [
        {
          areaLead: '',
          direction: '· Grace Ave · bedroom',
          sourceTitle: 'lorenzone.fr',
          sourceUrl: '',
          evidence: 'approximate',
          hostId: null,
          hostName: null,
        },
      ],
    });
    const db = buildGameDatabase({
      places: PLACES,
      checklistItems: [...SLOTS, noAreaSlot],
      matches: [match({ slotId: 'slot:no-area', hostId: 'L9003' })],
    });
    expect(db.items.get('slot:no-area')!.placement).toBe('pinned');
    expect(db.items.get('slot:no-area')!.areaId).toBe(db.locations.get('L9003')!.areaId);
  });

  it('the slot conflict note survives onto the item', () => {
    const conflictSlot = slot({
      id: 'slot:conflict',
      person: 'Conflict Person',
      conflict: 'Sahara Arena is in Shoreline — not pinned per the area-agreement rule.',
    });
    const db = buildGameDatabase({ places: PLACES, checklistItems: [...SLOTS, conflictSlot] });
    expect(db.items.get('slot:conflict')!.conflict).toContain('Sahara Arena');
    expect(db.items.get('slot:grace')!.conflict).toBeNull();
  });
});
