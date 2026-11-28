import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  convert,
  descScore,
  isTierVariant,
  norm,
  normPerson,
  parseFbrito,
  parseGtName,
  tokens,
  variantMatches,
} from '../../scripts/fbrito-join-lib.mjs';
import {
  activeResolved,
  checkFiles,
  computeChanges,
  pinFor,
  pinIdFor,
} from '../../scripts/apply-fbrito-import.mjs';
import { CARD_CHECKLIST_SLOTS } from '../../src/data/card-checklist.generated';
import { GENERATED_FBRITO_CARD_PLACES } from '../../src/data/card-fbrito-pins.generated';
import { COLLECTABLE_CARD_PLACES } from '../../src/data/collectables';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { buildGameDatabase } from '../../src/domain/game-db';

const manifest = JSON.parse(
  readFileSync(new URL('../../scripts/fbrito-import-manifest.json', import.meta.url), 'utf8'),
);
const checklistText = readFileSync(
  new URL('../../src/data/card-checklist.generated.ts', import.meta.url),
  'utf8',
);
const pinsText = readFileSync(
  new URL('../../src/data/card-fbrito-pins.generated.ts', import.meta.url),
  'utf8',
);
const creditsText = readFileSync(
  new URL('../../src/features/project/ProjectPage.tsx', import.meta.url),
  'utf8',
);

describe('fbrito import — conversion + parsing (fbrito-join-lib)', () => {
  it('converts fbrito 1024-unit map coordinates to game units', () => {
    expect(convert({ x: 512, y: 512 })).toEqual({ x: 0, y: 0 });
    expect(convert({ x: 0, y: 0 })).toEqual({ x: -16384, y: 16384 });
    expect(convert({ x: 1024, y: 1024 })).toEqual({ x: 16384, y: -16384 });
    // Real record: Angel Cienfuegos (Blue), card-vice-city-flamingos-025.
    expect(convert({ x: 401, y: 486.03125 })).toEqual({ x: -3552, y: 831 });
  });

  it('parses every fbrito card name shape', () => {
    const base = { kind: 'card', type: 'Vice City Flamingos card', x: 1, y: 2, description: '' };
    expect(parseFbrito({ ...base, id: 'a', name: 'Vice City Flamingos card: Angel Cienfuegos (Blue)' })).toMatchObject({
      setId: 'vice-city-flamingos', person: 'Angel Cienfuegos', variant: 'Blue', parsed: 'named-variant',
    });
    expect(parseFbrito({ ...base, id: 'b', name: 'Vice City Flamingos card: Angel Cienfuegos' })).toMatchObject({
      person: 'Angel Cienfuegos', variant: null, parsed: 'named-novariant',
    });
    expect(parseFbrito({ ...base, id: 'c', name: 'Sue Prettyman card (Standard)' })).toMatchObject({
      person: 'Sue Prettyman', variant: 'Standard', parsed: 'person-card-variant',
    });
    expect(parseFbrito({ ...base, id: 'd', name: 'Demario Richardson Signed Card' })).toMatchObject({
      person: 'Demario Richardson', variant: null, parsed: 'person-card',
    });
    expect(parseFbrito({ ...base, id: 'e', name: 'Tusi Taufua (Silver)' })).toMatchObject({
      person: 'Tusi Taufua', variant: 'Silver', parsed: 'bare-person-variant',
    });
    // A set-only name is not a person.
    expect(parseFbrito({ ...base, id: 'f', name: 'The Legends of Ratface card' })).toMatchObject({
      person: null, parsed: 'set-only',
    });
    // Generic "Collectible Card" with a bare-name description.
    expect(
      parseFbrito({ ...base, id: 'g', name: 'Collectible Card', description: 'Mateo Caballero' }),
    ).toMatchObject({ person: 'Mateo Caballero', parsed: 'generic-desc-person' });
    // A sentence description is not a person — but the name still parses
    // as the dead-end "person" Collectible, which matches no slot.
    expect(
      parseFbrito({ ...base, id: 'h', name: 'Collectible Card', description: 'On a table in the luggage building' }),
    ).toMatchObject({ person: 'Collectible', parsed: 'person-card' });
    // A name matching no branch at all (and no mappable set) is unparseable.
    expect(
      parseFbrito({ kind: 'card', type: 'x', name: '???', description: '', x: 0, y: 0 }),
    ).toMatchObject({ person: null, parsed: 'unparseable' });
    expect(parseFbrito({ kind: 'landmark', type: 'x', name: 'Y' })).toBeNull();
  });

  it('normalises names the way the join does', () => {
    expect(norm("Cherry O'Glade")).toBe(norm("Cherry O' Glade"));
    expect(norm('The Ratster')).toBe('ratster');
    expect(norm('The Fornicator')).toBe('fornicator');
    expect(normPerson('Amie')).toBe('aimie');
    expect(normPerson('Lupin de Juarez')).toBe('lupinjuarez');
    // "de" is NOT stripped from set names (Club De Fútbol keeps it).
    expect(norm('Club De Fútbol')).toBe('clubdefutbol');
  });

  it('matches variants through the checklist variantAlias equivalences', () => {
    // Chrissie (Deep Red) carries variantAlias "dark red".
    expect(variantMatches({ variant: 'Deep Red', variantAlias: 'dark red' }, 'dark red')).toBe(true);
    expect(variantMatches({ variant: 'Deep Red', variantAlias: 'dark red' }, 'burgundy')).toBe(false);
    // "Blue" is a tier variant but NOT "Light Blue" — the Angel 025 case.
    expect(variantMatches({ variant: 'Light Blue', variantAlias: null }, 'Blue')).toBe(false);
    expect(variantMatches({ variant: 'Light Blue', variantAlias: null }, 'Light Blue')).toBe(true);
    expect(isTierVariant('Blue')).toBe(true);
    expect(isTierVariant('Rialto Islands')).toBe(false);
    expect(isTierVariant('Hotshot Rookie')).toBe(false);
  });

  it('parses gtatown entry names, treating area parens as non-variants', () => {
    expect(parseGtName('Vice City Flamingos card: Angel Cienfuegos (Blue)', 'vice-city-flamingos')).toEqual({
      person: 'Angel Cienfuegos', variant: 'Blue',
    });
    expect(parseGtName('Liberty City Swingers card: Ichiro Yamada (Port Vice City)', 'liberty-city-swingers')).toEqual({
      person: 'Ichiro Yamada', variant: null,
    });
    expect(parseGtName('Vice City Flamingos card: Angel Cienfuegos', 'vice-city-flamingos')).toEqual({
      person: 'Angel Cienfuegos', variant: null,
    });
  });

  it('scores descriptions on distinctive shared tokens (Angel microwave)', () => {
    const slot = {
      spotDescription: 'Microwave at Xero on Omega Pkwy, Buckskin Swamp.',
      areaLead: 'Buckskin Swamp',
      pickups: [{ direction: '· Xero, Omega Pkwy · microwave' }],
    };
    const rec = { description: 'At the back of the gas station, on top of the microwave in the staff break room.' };
    expect(descScore(slot, rec)).toEqual({ shared: ['microwave'], score: 1 });
    expect(tokens('In the garage (the house has no interior)').has('garage')).toBe(true);
    expect(tokens('In the garage').has('the')).toBe(false);
  });
});

describe('fbrito import — join integration on fixtures', () => {
  const runJoin = () => {
    const dir = mkdtempSync(join(tmpdir(), 'fbrito-join-test-'));
    mkdirSync(join(dir, 'src', 'data'), { recursive: true });
    // One host-pinned slot (Host Hero) whose fbrito record sits far away.
    writeFileSync(
      join(dir, 'src', 'data', 'collectables.ts'),
      `card(\n  'card:host-hero',\n  'Host Hero',\n  'vice-city-flamingos',\n  'Vice City Flamingos',\n  'Somewhere.',\n  { x: 100, y: 200 },\n  'Somewhere (GTADB L1)',\n  'https://example.com',\n  'Example',\n),\n`,
    );
    writeFileSync(join(dir, 'src', 'data', 'loot-map.ts'), 'export const LOOT = [];\n');
    const slot = (over: Record<string, unknown>) => ({
      id: '', person: '', variant: 'standard', variantAlias: null,
      setId: 'vice-city-flamingos', setName: 'Vice City Flamingos',
      checklistSlot: true, placement: 'area-known', spotDescription: 'Somewhere.',
      areaLead: 'Test Area', pickups: [{ areaLead: 'Test Area', direction: '· somewhere', sourceTitle: 't', sourceUrl: 'https://example.com', evidence: 'approximate', hostId: null, hostName: null }],
      hostId: null, catalogueId: null, conflict: null, printedText: null,
      artwork: { front: null, back: null }, ...over,
    });
    const checklist = [
      slot({ id: 'card-checklist:vice-city-flamingos:host-hero:standard', person: 'Host Hero', variant: 'standard', placement: 'pinned', catalogueId: 'card:host-hero', hostId: 'L1' }),
      slot({ id: 'card-checklist:vice-city-flamingos:test-person:light-blue', person: 'Test Person', variant: 'Light Blue', spotDescription: 'Microwave at Xero on Omega Pkwy, Buckskin Swamp.', areaLead: 'Buckskin Swamp', pickups: [{ areaLead: 'Buckskin Swamp', direction: '· Xero, Omega Pkwy · microwave', sourceTitle: 't', sourceUrl: 'https://example.com', evidence: 'approximate', hostId: null, hostName: null }] }),
      slot({ id: 'card-checklist:vice-city-flamingos:test-person:pink', person: 'Test Person', variant: 'pink', spotDescription: 'Restroom fence on the south beach, Abismo Key.', areaLead: 'Abismo Key', pickups: [{ areaLead: 'Abismo Key', direction: '· restroom · fence', sourceTitle: 't', sourceUrl: 'https://example.com', evidence: 'approximate', hostId: null, hostName: null }] }),
      slot({ id: 'card-checklist:vice-city-flamingos:test-person:silver', person: 'Test Person', variant: 'silver', spotDescription: 'Garage of a house on Grace Ave, Belville.', areaLead: 'Belville', pickups: [{ areaLead: 'Belville', direction: '· Grace Ave · garage', sourceTitle: 't', sourceUrl: 'https://example.com', evidence: 'approximate', hostId: null, hostName: null }] }),
      slot({ id: 'card-checklist:los-santos-panic:contest-person:bronze', person: 'Contest Person', variant: 'bronze', setId: 'los-santos-panic', setName: 'Los Santos Panic', spotDescription: 'I-297 safe', areaLead: 'Eastern Lummox County', pickups: [{ areaLead: 'Eastern Lummox County', direction: '· I-297 · safe', sourceTitle: 't', sourceUrl: 'https://example.com', evidence: 'approximate', hostId: null, hostName: null }] }),
      slot({ id: 'card-checklist:los-santos-panic:contest-person:gold', person: 'Contest Person', variant: 'gold', setId: 'los-santos-panic', setName: 'Los Santos Panic', spotDescription: 'Emerald Springs Dr safe', areaLead: 'Emerald Springs', pickups: [{ areaLead: 'Emerald Springs', direction: '· Emerald Springs Dr · safe', sourceTitle: 't', sourceUrl: 'https://example.com', evidence: 'approximate', hostId: null, hostName: null }] }),
      slot({ id: 'card-checklist:liberty-city-swingers:area-person:silver', person: 'Area Person', variant: 'silver', setId: 'liberty-city-swingers', setName: 'Liberty City Swingers', spotDescription: 'Baggage room at Terminal E, Port of Vice City.', areaLead: 'Port of Vice City', pickups: [{ areaLead: 'Port of Vice City', direction: '· Terminal E · baggage room', sourceTitle: 't', sourceUrl: 'https://example.com', evidence: 'approximate', hostId: null, hostName: null }] }),
      // A second Area Person slot so the pool is not C1-resolvable by
      // elimination — the area pass must be the assigner.
      slot({ id: 'card-checklist:liberty-city-swingers:area-person:bronze', person: 'Area Person', variant: 'bronze', setId: 'liberty-city-swingers', setName: 'Liberty City Swingers', spotDescription: 'Somewhere else entirely.', areaLead: 'Somewhere Else', pickups: [{ areaLead: 'Somewhere Else', direction: '· somewhere else', sourceTitle: 't', sourceUrl: 'https://example.com', evidence: 'approximate', hostId: null, hostName: null }] }),
      slot({ id: 'extra:nobody:gold', person: 'Nobody', variant: 'gold', checklistSlot: false, placement: 'unmapped', spotDescription: '', areaLead: '', pickups: [] }),
    ];
    const fbrito = [
      { id: 'card-vice-city-flamingos-900', kind: 'card', type: 'Vice City Flamingos card', name: 'Vice City Flamingos card: Host Hero', x: 600, y: 400, description: 'Far away.' },
      { id: 'card-vice-city-flamingos-002', kind: 'card', type: 'Vice City Flamingos card', name: 'Vice City Flamingos card: Test Person', x: 500, y: 500, description: '' },
      { id: 'card-vice-city-flamingos-025', kind: 'card', type: 'Vice City Flamingos card', name: 'Vice City Flamingos card: Test Person (Blue)', x: 401, y: 486.03125, description: 'At the back of the gas station, on top of the microwave in the staff break room.' },
      { id: 'card-vice-city-flamingos-020', kind: 'card', type: 'Vice City Flamingos card', name: 'Vice City Flamingos card: Test Person', x: 450, y: 450, description: 'Inside the garage (the house has no interior): on the edge of the white desk.' },
      { id: 'card-los-santos-panic-011', kind: 'card', type: 'Los Santos Panic card', name: 'Los Santos Panic card: Contest Person', x: 300, y: 300, description: 'Inside the safe in the caravan.' },
      { id: 'card-liberty-city-swingers-013', kind: 'card', type: 'Liberty City Swingers card', name: 'Liberty City Swingers card: Area Person', x: 350, y: 350, description: 'On a table in the luggage building' },
    ];
    const citations = {
      fetchedAt: '2026-11-28T12:30:00Z',
      setTotals: [],
      citations: [
        { gtName: 'Vice City Flamingos card: Test Person', setId: 'vice-city-flamingos', fbritoIds: ['card-vice-city-flamingos-002'], gtPage: 'https://gtatown.com/locations/test-002' },
        { gtName: 'Vice City Flamingos card: Test Person (Blue)', setId: 'vice-city-flamingos', fbritoIds: ['card-vice-city-flamingos-025'], gtPage: 'https://gtatown.com/locations/test-025' },
        { gtName: 'Vice City Flamingos card: Test Person', setId: 'vice-city-flamingos', fbritoIds: ['card-vice-city-flamingos-020'], gtPage: 'https://gtatown.com/locations/test-020' },
        { gtName: 'Los Santos Panic card: Contest Person', setId: 'los-santos-panic', fbritoIds: ['card-los-santos-panic-011'], gtPage: 'https://gtatown.com/locations/test-contest-bronze' },
        { gtName: 'Los Santos Panic card: Contest Person', setId: 'los-santos-panic', fbritoIds: ['card-los-santos-panic-011'], gtPage: 'https://gtatown.com/locations/test-contest-gold' },
        { gtName: 'Liberty City Swingers card: Area Person (Port Vice City)', setId: 'liberty-city-swingers', fbritoIds: ['card-liberty-city-swingers-013'], gtPage: 'https://gtatown.com/locations/test-area' },
        { gtName: 'Vice City Flamingos card: Host Hero', setId: 'vice-city-flamingos', fbritoIds: ['card-vice-city-flamingos-900'], gtPage: 'https://gtatown.com/locations/test-host' },
      ],
    };
    const fbritoPath = join(dir, 'fbrito.json');
    const checklistPath = join(dir, 'checklist.json');
    const pinsPath = join(dir, 'pins.json');
    const citationsPath = join(dir, 'citations.json');
    const outPath = join(dir, 'out.json');
    writeFileSync(fbritoPath, JSON.stringify(fbrito));
    writeFileSync(checklistPath, JSON.stringify(checklist));
    writeFileSync(pinsPath, JSON.stringify([]));
    writeFileSync(citationsPath, JSON.stringify(citations));
    execFileSync(
      process.execPath,
      [
        new URL('../../scripts/fbrito-join.mjs', import.meta.url).pathname,
        '--fbrito', fbritoPath,
        '--checklist', checklistPath,
        '--generated-pins', pinsPath,
        '--repo', dir,
        '--citations', citationsPath,
        '--out', outPath,
      ],
      { stdio: 'pipe' },
    );
    return JSON.parse(readFileSync(outPath, 'utf8'));
  };

  it('resolves description + elimination + area matches, holds ties, never moves the host pin', () => {
    const result = runJoin();
    const bySlot = new Map(result.citation.resolvedList.map((r: { slotId: string }) => [r.slotId, r]));
    // Description: microwave -> Light Blue, garage -> silver.
    expect(bySlot.get('card-checklist:vice-city-flamingos:test-person:light-blue')).toMatchObject({
      fbritoId: 'card-vice-city-flamingos-025', method: 'citation-description', matchKeywords: ['microwave'],
    });
    expect(bySlot.get('card-checklist:vice-city-flamingos:test-person:silver')).toMatchObject({
      fbritoId: 'card-vice-city-flamingos-020', method: 'citation-description', matchKeywords: ['garage'],
    });
    // Elimination: one record + one slot left -> pink takes 002.
    expect(bySlot.get('card-checklist:vice-city-flamingos:test-person:pink')).toMatchObject({
      fbritoId: 'card-vice-city-flamingos-002', method: 'citation-elimination',
    });
    // Area: "(Port Vice City)" assigns the luggage-building record.
    expect(bySlot.get('card-checklist:liberty-city-swingers:area-person:silver')).toMatchObject({
      fbritoId: 'card-liberty-city-swingers-013', method: 'citation-area',
    });
    // Contest: both slots tie on "safe" for the single record — neither
    // takes it, and the record is claimed by no slot.
    expect(bySlot.has('card-checklist:los-santos-panic:contest-person:bronze')).toBe(false);
    expect(bySlot.has('card-checklist:los-santos-panic:contest-person:gold')).toBe(false);
    const claimed = result.citation.resolvedList.map((r: { fbritoId: string }) => r.fbritoId);
    expect(claimed.filter((id: string) => id === 'card-los-santos-panic-011')).toHaveLength(0);
    // The host-pinned slot is never in the resolved list, however far
    // its fbrito match sits — and the disagreement is recorded.
    expect(bySlot.has('card-checklist:vice-city-flamingos:host-hero:standard')).toBe(false);
    const host = result.hostDisagree.find((h: { slot: string }) => h.slot.includes('Host Hero'));
    expect(host.over100).toBe(true);
    expect(host.distanceUnits).toBeGreaterThan(1000);
    // One record, one slot: no fbrito id is claimed twice.
    expect(new Set(claimed).size).toBe(claimed.length);
  });
});

describe('fbrito import — manifest vs committed files', () => {
  it('reconciles: 346 imported, 83 gap, 23 held, 386 pinned of 480', () => {
    expect(manifest.counts.imported).toBe(346);
    expect(manifest.counts.gap).toBe(83);
    expect(manifest.counts.held).toBe(23);
    expect(manifest.resolved).toHaveLength(346);
    expect(manifest.gap).toHaveLength(83);
    expect(manifest.held).toHaveLength(23);
    const byPlacement = new Map<string, number>();
    for (const slot of CARD_CHECKLIST_SLOTS) {
      byPlacement.set(slot.placement, (byPlacement.get(slot.placement) ?? 0) + 1);
    }
    expect(byPlacement.get('pinned')).toBe(386);
    expect(byPlacement.get('area-known')).toBe(94);
    expect(byPlacement.get('unmapped') ?? 0).toBe(0);
    // Per-set imported counts match the manifest.
    for (const [setId, counts] of Object.entries(manifest.counts.perSet as Record<string, { imported: number }>)) {
      expect(
        CARD_CHECKLIST_SLOTS.filter(
          (s) => s.setId === setId && s.catalogueId?.startsWith('card:fbrito-'),
        ).length,
      ).toBe(counts.imported);
    }
    // The manifest's own counts reconcile.
    expect(
      manifest.counts.imported + manifest.counts.gap +
        manifest.held.filter((h: { reason: string }) => !h.reason.startsWith('host-pinned')).length,
    ).toBe(440);
  });

  it('passes the apply-script check: files match the manifest', () => {
    expect(checkFiles(manifest, checklistText, pinsText)).toEqual([]);
  });

  it('never moves a host-pinned slot', () => {
    // Every resolved slot was area-known (not host-pinned) before the import.
    for (const r of manifest.resolved) {
      expect(manifest.hostPinnedSlotIds).not.toContain(r.slotId);
    }
    // No host-pinned slot's catalogue pin is an fbrito pin.
    for (const slotId of manifest.hostPinnedSlotIds) {
      const slot = CARD_CHECKLIST_SLOTS.find((s) => s.id === slotId)!;
      expect(slot.catalogueId?.startsWith('card:fbrito-') ?? false).toBe(false);
    }
    // No fbrito pin id collides with a non-fbrito catalogue place.
    const pinIds = new Set(GENERATED_FBRITO_CARD_PLACES.map((p) => p.id));
    for (const place of COLLECTABLE_CARD_PLACES) {
      if (pinIds.has(place.id)) expect(place.tags).toContain('fbrito-import');
    }
    expect(new Set(COLLECTABLE_CARD_PLACES.map((p) => p.id)).size).toBe(COLLECTABLE_CARD_PLACES.length);
  });

  it('carries per-record provenance on every imported pin', () => {
    expect(GENERATED_FBRITO_CARD_PLACES).toHaveLength(346);
    for (const pin of GENERATED_FBRITO_CARD_PLACES) {
      expect(pin.evidence).toBe('approximate');
      expect(pin.tags).toContain('fbrito-import');
      const fbritoId = pin.id.slice('card:fbrito-'.length);
      expect(pin.source.url).toBe(`https://fbritoferreira.github.io/gta6/?id=${fbritoId}`);
      expect(pin.source.title).toMatch(/Open GTA 6 Map.*CC BY 4\.0/);
      // The manifest has this record, with a method and (where the
      // citation was used) the gtatown citation page.
      const entry = manifest.resolved.find((r: { fbritoId: string }) => r.fbritoId === fbritoId);
      expect(entry).toBeDefined();
      expect(entry.slotId).toBe(
        CARD_CHECKLIST_SLOTS.find((s) => s.catalogueId === pin.id)?.id,
      );
    }
    // The pins file header names the pinned commit.
    expect(pinsText).toContain('77cd5024140f8ff857363998a210750191d9c777');
    // The Credits page attributes the source in-app.
    expect(creditsText).toContain('Open GTA 6 Map');
    expect(creditsText).toContain('77cd5024');
    expect(creditsText).toContain('Creative Commons Attribution 4.0 International');
  });

  it('records the 14 host disagreements + 4 host B-conflicts as slot notes', () => {
    expect(manifest.hostDisagreements).toHaveLength(14);
    expect(manifest.hostBConflicts).toHaveLength(4);
    for (const d of manifest.hostDisagreements) {
      const slot = CARD_CHECKLIST_SLOTS.find((s) => s.id === d.slotId)!;
      expect(slot.placement).toBe('pinned');
      expect(slot.conflict).toContain(d.fbritoId);
      expect(slot.conflict).toContain('Open GTA 6 Map import');
    }
    for (const b of manifest.hostBConflicts) {
      const slot = CARD_CHECKLIST_SLOTS.find((s) => s.id === b.slotId)!;
      expect(slot.conflict).toContain('Two Open GTA 6 Map records claim this slot');
    }
    // Tusi Taufua silver: the 8,936u disagreement is on the slot.
    const tusi = CARD_CHECKLIST_SLOTS.find((s) => s.id === 'card-checklist:vice-city-manatees:tusi-taufua:silver')!;
    expect(tusi.conflict).toContain('card-vice-city-manatees-016');
    expect(tusi.conflict).toContain('8936u');
  });

  it('refuses to move a host-pinned slot (computeChanges)', () => {
    const hostile = JSON.parse(JSON.stringify(manifest));
    hostile.resolved.push({
      ...hostile.resolved[0],
      slotId: hostile.hostPinnedSlotIds[0],
      fbritoId: 'card-vice-city-flamingos-999',
    });
    expect(() => computeChanges(hostile, CARD_CHECKLIST_SLOTS)).toThrow(/NEVER-MOVE VIOLATION/);
  });

  it('restores a taken-down record (computeChanges)', () => {
    const taken = JSON.parse(JSON.stringify(manifest));
    const victim = taken.resolved[0];
    taken.resolved = taken.resolved.filter((r: { fbritoId: string }) => r.fbritoId !== victim.fbritoId);
    taken.removed = [{ ...victim, removedAt: '2026-11-28T00:00:00Z', reason: 'test takedown' }];
    const { updates, pins } = computeChanges(taken, CARD_CHECKLIST_SLOTS);
    expect(pins).toHaveLength(345);
    const u = updates.get(victim.slotId)!;
    expect(u.placement).toBe('area-known');
    expect(u.catalogueId).toBeNull();
  });

  it('builds pin objects with the fbrito id in the id and the area as region', () => {
    const entry = manifest.resolved.find((r: { fbritoId: string }) => r.fbritoId === 'card-vice-city-flamingos-025')!;
    const slot = CARD_CHECKLIST_SLOTS.find((s) => s.id === entry.slotId)!;
    const pin = pinFor(entry, slot);
    expect(pin.id).toBe('card:fbrito-card-vice-city-flamingos-025');
    expect(pin.layerId).toBe('cards:vice-city-flamingos');
    expect(pin.region).toBe(slot.areaLead);
    expect(pin.position).toEqual(entry.position);
    expect(pinIdFor('card-vice-city-flamingos-025')).toBe(pin.id);
    expect(activeResolved(manifest)).toHaveLength(346);
  });
});

describe('fbrito import — game database', () => {
  it('resolves imported items to their fbrito pin locations; host items unchanged', () => {
    const snapshot = JSON.parse(
      readFileSync(
        new URL('../../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json', import.meta.url),
        'utf8',
      ),
    );
    const places = catalogueFromSnapshot(snapshot);
    const gameDb = buildGameDatabase({ places });
    // Every imported item is pinned at its fbrito pin (a location).
    for (const r of manifest.resolved) {
      const item = gameDb.items.get(r.slotId)!;
      expect(item).toBeDefined();
      expect(item.placement).toBe('pinned');
      expect(item.locationId).toBe(pinIdFor(r.fbritoId));
      const location = gameDb.locations.get(item.locationId!)!;
      expect(location).toBeDefined();
      expect(location.placement).toBe('pinned');
      expect(location.position).toEqual(r.position);
    }
    // Host items still resolve to their GTADB host, never to fbrito.
    const mateo = gameDb.items.get('card-checklist:vice-city-flamingos:mateo-caballero:gold')!;
    expect(mateo.locationId).toBe('L544');
    const luke = gameDb.items.get('card-checklist:backyard-wrestling:luke-x:standard')!;
    expect(luke.locationId).toBe('L3434');
    // Delights is complete: 5 host + 13 imported = 18 pinned.
    const delights = gameDb.sets.get('delights-dancers')!;
    expect(delights.itemIds).toHaveLength(18);
    expect(delights.itemIds.filter((id) => gameDb.items.get(id)?.placement === 'pinned')).toHaveLength(18);
  });
});
