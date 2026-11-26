import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { AtlasDatabase } from '../../src/db/repository';
import {
  buildGameDatabase,
  setProgress,
  type GameDatabase,
} from '../../src/domain/game-db';
import type { StorageLike } from '../../src/features/categorise/storage';
import { recordCompletion } from '../../src/features/completion/record';
import type { Place } from '../../src/domain/types';
import {
  executeTool,
  hintForItem,
  isNightlifeLocation,
  resolveAreaId,
  resolveSetId,
  type ToolResult,
} from '../../src/features/ask/tools';

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

function memoryStorage(): StorageLike {
  const store = new Map<string, string>();
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

let repo: AtlasDatabase;
beforeEach(() => {
  repo = new AtlasDatabase(`ask-tools-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await repo.delete();
});

function unwrap<T>(result: ToolResult<T>): T {
  if (!result.ok) throw new Error(`Tool failed: ${result.error}`);
  return result.data;
}

describe('Ask tools — §7.4 regression cases (DESIGN §7.2, real data)', () => {
  it('case 1: remaining_collectibles({setId: delights-dancers}) returns all 18, including the loot Harley', async () => {
    // NOTE (design text updated by this lane): DESIGN §7.4 case 1 said
    // "5 items" — that predated the 480-slot import, when only the 5
    // pinned cards existed as records. The set now has 18 slots; the
    // regression that matters is that the loot Harley is not dropped
    // by an area filter, and all 5 pinned cards are present.
    const db = buildFullDb();
    const data = unwrap(
      await executeTool(db, {
        name: 'remaining_collectibles',
        args: { setId: 'delights-dancers' },
      }),
    ) as { items: { name: string; placement: string }[]; total: number; found: number };
    expect(data.total).toBe(18);
    expect(data.items).toHaveLength(18);
    expect(data.items.map((item) => item.name)).toContain('Harley');
    const pinned = data.items.filter((item) => item.placement === 'pinned');
    expect(pinned.map((item) => item.name).sort()).toEqual([
      'Harley',
      'Jason',
      'Kandi',
      'Perla',
      'Vicki',
    ]);
    // The 13 unpositioned set members are present as "no position
    // yet" — never dropped, never hidden.
    expect(data.items.filter((item) => item.placement !== 'pinned')).toHaveLength(13);
  });

  it('case 1b: setId wins over areaId — Delights in Port Gellhorn is 15', async () => {
    const db = buildFullDb();
    const data = unwrap(
      await executeTool(db, {
        name: 'remaining_collectibles',
        args: { setId: 'delights-dancers', areaId: 'area:port-gellhorn' },
      }),
    ) as { items: { name: string }[]; total: number };
    expect(data.total).toBe(15);
    expect(data.items.map((item) => item.name)).toContain('Harley');
    expect(data.items.map((item) => item.name)).toContain('Jason');
  });

  it('case 2: "cards for delight dancers near Capri" — set first, area as a sort, honest nearest', async () => {
    const db = buildFullDb();
    const data = unwrap(
      await executeTool(db, {
        name: 'remaining_collectibles',
        args: { setId: 'delights-dancers', sortNearAreaId: 'area:capri' },
      }),
    ) as {
      items: { name: string; placement: string }[];
      total: number;
      nearest: { name: string; locationName: string | null; distanceUnits: number } | null;
      nearCount: number;
    };
    // All 18, nothing dropped — the area sorted, it did not filter.
    expect(data.total).toBe(18);
    expect(data.items).toHaveLength(18);
    // The nearest is Harley, in Delights, Port Gellhorn — and it is
    // NOT near Capri: the honest verdict, never "near" when far.
    // Harley and Jason share host L629, so they are equidistant
    // (3,599 units from the Capri centroid); Harley sorts first on
    // the stable tie. DESIGN §7.4 case 2 names Jason — same host,
    // same distance — the design text now names both.
    expect(data.nearest?.name).toBe('Harley');
    expect(data.nearest?.locationName).toMatch(/Delights/);
    expect(data.nearest!.distanceUnits).toBe(3599);
    expect(data.nearCount).toBe(0);
    // The 13 unpositioned set members trail the positioned ones.
    const positioned = data.items.filter((item) => item.placement === 'pinned');
    expect(positioned).toHaveLength(5);
    expect(data.items.slice(0, 5)).toEqual(positioned);
    // areaId (membership) and sortNearAreaId (proximity) never mix.
    const both = await executeTool(db, {
      name: 'remaining_collectibles',
      args: { setId: 'delights-dancers', areaId: 'area:capri', sortNearAreaId: 'area:capri' },
    });
    expect(both.ok).toBe(false);
  });

  it('case 3: "Nightclub in Vice City" returns the nightclubs — not the nearest thirty shops', async () => {
    const db = buildFullDb();
    const data = unwrap(
      await executeTool(db, {
        name: 'find_nearby_opportunities',
        args: {
          anchor: { areaId: 'area:vice-city' },
          kinds: ['shop'],
          nightlife: true,
          radiusUnits: 16384,
        },
      }),
    ) as {
      opportunities: { locationName: string | null; locationId: string }[];
    };
    // Every returned opportunity is a nightlife venue by source tag —
    // the v0.31.2 fix, now a tool-side evidence filter, not a keyword.
    expect(data.opportunities.length).toBeGreaterThan(0);
    for (const row of data.opportunities) {
      const location = db.locations.get(row.locationId)!;
      expect(isNightlifeLocation(location)).toBe(true);
    }
    const names = data.opportunities.map((row) => row.locationName ?? '');
    expect(names.some((name) => name.includes('NINE1NINE'))).toBe(true);
    expect(names.some((name) => name.includes('Vault'))).toBe(true);
    // Without the nightlife flag the same call is the nearest thirty
    // Food & Drink shops — the over-match the filter exists to stop.
    const unfiltered = unwrap(
      await executeTool(db, {
        name: 'find_nearby_opportunities',
        args: {
          anchor: { areaId: 'area:vice-city' },
          kinds: ['shop'],
          radiusUnits: 16384,
        },
      }),
    ) as { opportunities: { locationName: string | null }[] };
    expect(unfiltered.opportunities.length).toBeGreaterThan(data.opportunities.length);
  });

  it('case 4: "where can I rob a bank" returns bank-job opportunities only', async () => {
    const db = buildFullDb();
    const expected = [...db.opportunities.values()].filter(
      (opp) => opp.kind === 'bank-job',
    ).length;
    expect(expected).toBeGreaterThan(0);
    const data = unwrap(
      await executeTool(db, {
        name: 'find_nearby_opportunities',
        args: {
          anchor: { position: { x: 0, y: 0 } },
          kinds: ['bank-job'],
          radiusUnits: 16384,
        },
      }),
    ) as { opportunities: { kind: string }[] };
    expect(data.opportunities.length).toBeGreaterThan(0);
    expect(data.opportunities.every((row) => row.kind === 'bank-job')).toBe(true);
    // No lootable SHOP leaks in — the v0.31.4 over-match, fixed by
    // the kind enum.
    expect(data.opportunities.some((row) => row.kind === 'robbery-shop')).toBe(false);
  });

  it('case 5: "I found the Tracy card" proposes, never writes — confirm moves progress 5→6 found', async () => {
    const db = buildFullDb();
    const tracy = [...db.items.values()].find((item) => item.name === 'Tracy')!;
    expect(tracy.setId).toBe('delights-dancers');
    expect(setProgress(db, 'delights-dancers')).toMatchObject({ found: 0, total: 18 });
    // The tool call PROPOSES. Nothing is written.
    const proposal = unwrap(
      await executeTool(db, {
        name: 'update_completion',
        args: { verb: 'collected', targetType: 'item', targetId: tracy.id },
      }),
    ) as { confirmLabel: string; jotOffer: string | null; kind: string };
    expect(proposal.kind).toBe('completion');
    expect(proposal.confirmLabel).toMatch(/Mark Tracy .* as collected\?/);
    // Tracy is unpositioned — the proposal carries the jot offer.
    expect(proposal.jotOffer).toMatch(/no spot in the map data yet/);
    const stillThere = unwrap(
      await executeTool(db, {
        name: 'remaining_collectibles',
        args: { setId: 'delights-dancers' },
      }),
    ) as { items: { id: string }[] };
    expect(stillThere.items.map((item) => item.id)).toContain(tracy.id);
    // The player taps Confirm: the write goes through the step-2 path
    // with source 'ask' — and only then does progress move.
    const write = await recordCompletion(
      { target: { type: 'item', id: tracy.id }, verb: 'collected', source: 'ask' },
      { repository: repo, places, storage: memoryStorage() },
    );
    expect(write.ok).toBe(true);
    expect(write.record?.source).toBe('ask');
    const db2 = write.db!;
    expect(setProgress(db2, 'delights-dancers')).toMatchObject({ found: 1, total: 18 });
    const remaining2 = unwrap(
      await executeTool(db2, {
        name: 'remaining_collectibles',
        args: { setId: 'delights-dancers' },
      }),
    ) as { items: { id: string }[]; total: number; found: number };
    expect(remaining2.items.map((item) => item.id)).not.toContain(tracy.id);
    expect(remaining2.found).toBe(1);
    // A second proposal for the same card is refused — collected is once.
    const again = await executeTool(db2, {
      name: 'update_completion',
      args: { verb: 'collected', targetType: 'item', targetId: tracy.id },
    });
    expect(again.ok).toBe(false);
    expect((again as { error: string }).error).toMatch(/already got/);
  });

  it('update_completion rejects illegal verbs with plain words, never a silent mapping', async () => {
    const db = buildFullDb();
    const tracy = [...db.items.values()].find((item) => item.name === 'Tracy')!;
    const looted = await executeTool(db, {
      name: 'update_completion',
      args: { verb: 'looted', targetType: 'item', targetId: tracy.id },
    });
    expect(looted.ok).toBe(false);
    const unknown = await executeTool(db, {
      name: 'update_completion',
      args: { verb: 'collected', targetType: 'item', targetId: 'no-such-item' },
    });
    expect(unknown.ok).toBe(false);
    expect((unknown as { error: string }).error).toMatch(/no collectible item/);
  });

  it('search_locations finds by name, exact first, and never needs a layer on', async () => {
    const db = buildFullDb();
    const data = unwrap(
      await executeTool(db, {
        name: 'search_locations',
        args: { query: 'Delights' },
      }),
    ) as { locations: { id: string; name: string | null }[] };
    expect(data.locations[0]?.id).toBe('L629');
    const typo = unwrap(
      await executeTool(db, {
        name: 'search_locations',
        args: { query: 'Deligts' },
      }),
    ) as { locations: { id: string }[] };
    // One edit away from "Delights" — the typo tier finds L629.
    expect(typo.locations.map((row) => row.id)).toContain('L629');
    const farTypo = unwrap(
      await executeTool(db, {
        name: 'search_locations',
        args: { query: 'Delites' },
      }),
    ) as { locations: { id: string }[] };
    // Two edits away — the typo tier does not stretch to L629 (it
    // finds Al Dentes instead, a real place; the finder is not wrong,
    // just fuzzy at one edit).
    expect(farTypo.locations.map((row) => row.id)).not.toContain('L629');
    const none = unwrap(
      await executeTool(db, {
        name: 'search_locations',
        args: { query: 'zzzz-no-such-place' },
      }),
    ) as { locations: unknown[] };
    expect(none.locations).toHaveLength(0);
    const badArea = await executeTool(db, {
      name: 'search_locations',
      args: { query: 'Delights', areaId: 'no-such-area' },
    });
    expect(badArea.ok).toBe(false);
  });

  it('get_location_detail returns the card — and strips the spot unless explicitly asked', async () => {
    const db = buildFullDb();
    const plain = unwrap(
      await executeTool(db, {
        name: 'get_location_detail',
        args: { locationId: 'L629' },
      }),
    ) as {
      opportunities: unknown[];
      items: { name: string; spotDescription?: string | null }[];
      revealIds: string[];
    };
    expect(plain.opportunities).toHaveLength(4);
    expect(plain.items.map((item) => item.name).sort()).toEqual(['Harley', 'Jason']);
    // No hints without the explicit ask (§3.5).
    expect(plain.items.every((item) => item.spotDescription === undefined)).toBe(true);
    // Calling the tool IS the explicit request for that location.
    expect(plain.revealIds).toEqual(['L629']);
    const hinted = unwrap(
      await executeTool(db, {
        name: 'get_location_detail',
        args: { locationId: 'L629', includeHints: true },
      }),
    ) as { items: { name: string; spotDescription?: string | null }[] };
    const jason = hinted.items.find((item) => item.name === 'Jason')!;
    expect(jason.spotDescription).toMatch(/restroom/);
    const unknown = await executeTool(db, {
      name: 'get_location_detail',
      args: { locationId: 'no-such-place' },
    });
    expect(unknown.ok).toBe(false);
  });

  it('remaining_collectibles strips hints by default — the spot needs an explicit ask', async () => {
    const db = buildFullDb();
    const plain = unwrap(
      await executeTool(db, {
        name: 'remaining_collectibles',
        args: { setId: 'delights-dancers' },
      }),
    ) as { items: { spotDescription?: string | null; areaLead?: string | null }[] };
    expect(plain.items.every((item) => item.spotDescription === undefined)).toBe(true);
    expect(plain.items.every((item) => item.areaLead === undefined)).toBe(true);
    const hinted = unwrap(
      await executeTool(db, {
        name: 'remaining_collectibles',
        args: { setId: 'delights-dancers', includeHints: true },
      }),
    ) as { items: { name: string; spotDescription?: string | null }[] };
    expect(hinted.items.find((item) => item.name === 'Jason')?.spotDescription).toMatch(
      /restroom/,
    );
  });

  it('personal_progress answers from the selectors — overall, set, and category', async () => {
    const db = buildFullDb();
    const overall = unwrap(
      await executeTool(db, { name: 'personal_progress', args: { scope: 'overall' } }),
    ) as { pct: number };
    expect(typeof overall.pct).toBe('number');
    const set = unwrap(
      await executeTool(db, {
        name: 'personal_progress',
        args: { scope: { setId: 'delights-dancers' } },
      }),
    ) as { found: number; total: number };
    expect(set).toEqual({ found: 0, total: 18, remaining: expect.any(Array) });
    const bad = await executeTool(db, {
      name: 'personal_progress',
      args: { scope: { setId: 'no-such-set' } },
    });
    expect(bad.ok).toBe(false);
    const badCategory = await executeTool(db, {
      name: 'personal_progress',
      args: { scope: { categoryId: 'no-such-category' } },
    });
    expect(badCategory.ok).toBe(false);
  });

  it('focus_map validates exactly one target', async () => {
    const db = buildFullDb();
    expect(
      unwrap(
        await executeTool(db, {
          name: 'focus_map',
          args: { locationId: 'L629' },
        }),
      ),
    ).toEqual({ action: 'focus', locationId: 'L629' });
    expect(
      (await executeTool(db, { name: 'focus_map', args: {} })).ok,
    ).toBe(false);
    expect(
      (await executeTool(db, {
        name: 'focus_map',
        args: { locationId: 'L629', areaId: 'area:capri' },
      })).ok,
    ).toBe(false);
    expect(
      (await executeTool(db, {
        name: 'focus_map',
        args: { locationId: 'no-such-place' },
      })).ok,
    ).toBe(false);
  });
});

describe('Ask tools — get_hint ladder (addendum §5.2, Demo G)', () => {
  it('levels reveal one step at a time — and never the next level in the same answer', async () => {
    const db = buildFullDb();
    const harley = [...db.items.values()].find((item) => item.name === 'Harley')!;
    const l1 = unwrap(
      await executeTool(db, {
        name: 'get_hint',
        args: { targetType: 'item', targetId: harley.id, level: 1 },
      }),
    ) as { level: number; hint: string; nextLevelAvailable: boolean };
    expect(l1.level).toBe(1);
    expect(l1.hint).toMatch(/Delights Dancers/);
    expect(l1.hint).not.toMatch(/Port Gellhorn|Delights,|booth|bathroom/i);
    expect(l1.nextLevelAvailable).toBe(true);
    const l2 = unwrap(
      await executeTool(db, {
        name: 'get_hint',
        args: { targetType: 'item', targetId: harley.id, level: 2 },
      }),
    ) as { level: number; hint: string };
    expect(l2.level).toBe(2);
    expect(l2.hint).toMatch(/Port Gellhorn/);
    expect(l2.hint).not.toMatch(/Delights,|bathroom|booth/i);
    const l3 = unwrap(
      await executeTool(db, {
        name: 'get_hint',
        args: { targetType: 'item', targetId: harley.id, level: 3 },
      }),
    ) as { level: number; hint: string };
    expect(l3.level).toBe(3);
    expect(l3.hint).toMatch(/Delights/);
    expect(l3.hint).not.toMatch(/booth seat|restroom/i);
    const l4 = unwrap(
      await executeTool(db, {
        name: 'get_hint',
        args: { targetType: 'item', targetId: harley.id, level: 4 },
      }),
    ) as { level: number; hint: string; nextLevelAvailable: boolean };
    expect(l4.level).toBe(4);
    expect(l4.hint).toMatch(/booth seat/);
    expect(l4.nextLevelAvailable).toBe(false);
  });

  it('an unpinned card stops at level 3 with the honest no-location message', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    expect(amber.locationId).toBeNull();
    // Level 2 works for any unpositioned card whose area lead resolves
    // to a real area — the area is the honest extent of what is known.
    // (Some checklist area leads resolve to area ids that are not in
    // the area table — those stop at level 2 with the no-area message
    // instead; the filter below keeps this test on the resolvable ones.)
    const areaKnown = [...db.items.values()].find(
      (item) =>
        item.locationId === null &&
        item.areaId !== null &&
        db.areas.has(item.areaId),
    )!;
    const l2 = unwrap(
      await executeTool(db, {
        name: 'get_hint',
        args: { targetType: 'item', targetId: areaKnown.id, level: 2 },
      }),
    ) as { level: number; hint: string };
    expect(l2.level).toBe(2);
    expect(l2.hint).toMatch(new RegExp(db.areas.get(areaKnown.areaId!)!.name));
    const l3 = await executeTool(db, {
      name: 'get_hint',
      args: { targetType: 'item', targetId: amber.id, level: 3 },
    });
    // …and level 3 refuses honestly instead of inventing a location.
    expect(l3.ok).toBe(false);
    expect((l3 as { error: string }).error).toMatch(/Nobody's published a spot/);
  });

  it('a hint for a collected card is refused', async () => {
    const db = buildFullDb();
    const vicki = [...db.items.values()].find((item) => item.name === 'Vicki')!;
    const db2 = buildGameDatabase({
      places,
      records: [
        {
          id: 'rec:test-vicki',
          target: { type: 'item', id: vicki.id },
          verb: 'collected',
          count: 1,
          at: '2026-11-26T03:00:00.000Z',
          source: 'user',
        },
      ],
    });
    const hint = await executeTool(db2, {
      name: 'get_hint',
      args: { targetType: 'item', targetId: vicki.id, level: 1 },
    });
    expect(hint.ok).toBe(false);
    expect((hint as { error: string }).error).toMatch(/already got/);
  });

  it('a level outside 1–4 is a tool error, never an inference', async () => {
    const db = buildFullDb();
    const harley = [...db.items.values()].find((item) => item.name === 'Harley')!;
    for (const level of [0, 5, 'three']) {
      const result = await executeTool(db, {
        name: 'get_hint',
        args: { targetType: 'item', targetId: harley.id, level },
      });
      expect(result.ok).toBe(false);
    }
  });
});

describe('Ask tools — research_missing (addendum §5.3)', () => {
  it('queues when the cache misses, returns cached when it hits', async () => {
    const db = buildFullDb();
    const amber = [...db.items.values()].find((item) => item.name === 'Amber')!;
    const queued: unknown[] = [];
    const deps = {
      findEnrichment: () => null,
      queueResearch: async (request: unknown) => {
        queued.push(request);
        return true;
      },
    };
    const miss = unwrap(
      await executeTool(
        db,
        {
          name: 'research_missing',
          args: {
            targetType: 'item',
            targetId: amber.id,
            question: 'Where is the Amber card?',
          },
        },
        deps,
      ),
    ) as { status: string; requestId?: string; message: string };
    expect(miss.status).toBe('queued');
    expect(miss.requestId).toBeTruthy();
    expect(queued).toHaveLength(1);
    expect(miss.message).toMatch(/queued it for research/);
    // A cache hit returns the enrichment, never a second queue. The
    // cache is keyed by LOCATION, so the hit case needs a positioned
    // item — an unpositioned one (Amber above) has no location to
    // look up and always queues.
    const harley = [...db.items.values()].find((item) => item.name === 'Harley')!;
    const cached = unwrap(
      await executeTool(
        db,
        {
          name: 'research_missing',
          args: {
            targetType: 'item',
            targetId: harley.id,
            question: 'Where is the Harley card?',
          },
        },
        {
          findEnrichment: () => ({
            id: 'enr:test',
            locationId: 'L629',
            schemaVersion: 1,
            researchedAt: '2026-11-26T00:00:00.000Z',
            researchedBy: 'gpt-4o-mini',
            fields: [],
            imagery: [],
            question: null,
          }),
          queueResearch: async () => {
            throw new Error('must not queue on a cache hit');
          },
        },
      ),
    ) as { status: string; enrichment?: { id: string } };
    expect(cached.status).toBe('cached');
    expect(cached.enrichment?.id).toBe('enr:test');
    expect(queued).toHaveLength(1);
  });

  it('an unknown target is a tool error', async () => {
    const db = buildFullDb();
    const result = await executeTool(db, {
      name: 'research_missing',
      args: { targetType: 'item', targetId: 'no-such-item', question: 'Where?' },
    });
    expect(result.ok).toBe(false);
  });
});

describe('Ask tools — resolve helpers', () => {
  it('resolveSetId takes an id or a name; resolveAreaId takes an id or a name', () => {
    const db = buildFullDb();
    expect(resolveSetId(db, 'delights-dancers')).toBe('delights-dancers');
    expect(resolveSetId(db, 'Delights Dancers')).toBe('delights-dancers');
    expect(resolveSetId(db, 'no-such-set')).toBeNull();
    expect(resolveAreaId(db, 'area:port-gellhorn')).toBe('area:port-gellhorn');
    expect(resolveAreaId(db, 'Port Gellhorn')).toBe('area:port-gellhorn');
    expect(resolveAreaId(db, 'no-such-area')).toBeNull();
  });

  it('record_sale proposes only for a collected item', async () => {
    const db = buildFullDb();
    const vicki = [...db.items.values()].find((item) => item.name === 'Vicki')!;
    const uncollected = await executeTool(db, {
      name: 'record_sale',
      args: { itemId: vicki.id },
    });
    expect(uncollected.ok).toBe(false);
    expect((uncollected as { error: string }).error).toMatch(/not found .* yet/);
    const db2 = buildGameDatabase({
      places,
      records: [
        {
          id: 'rec:test-vicki-2',
          target: { type: 'item', id: vicki.id },
          verb: 'collected',
          count: 1,
          at: '2026-11-26T03:00:00.000Z',
          source: 'user',
        },
      ],
    });
    const proposal = unwrap(
      await executeTool(db2, {
        name: 'record_sale',
        args: { itemId: vicki.id, price: 500 },
      }),
    ) as { kind: string; confirmLabel: string };
    expect(proposal.kind).toBe('sale');
    expect(proposal.confirmLabel).toMatch(/never un-finds a card/);
  });

  it('an unknown tool name is a tool error, not a crash', async () => {
    const db = buildFullDb();
    const result = await executeTool(db, {
      name: 'teleport' as never,
      args: {},
    });
    expect(result.ok).toBe(false);
  });

  it('hintForItem level 1 never carries geography', () => {
    const db = buildFullDb();
    const harley = [...db.items.values()].find((item) => item.name === 'Harley')!;
    const l1 = hintForItem(db, harley, 1);
    expect(l1.ok).toBe(true);
    if (l1.ok) {
      expect(l1.data.hint).not.toMatch(/Port Gellhorn|Kelly|Delights,/);
    }
  });
});
