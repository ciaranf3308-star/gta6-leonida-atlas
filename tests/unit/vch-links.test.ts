import { describe, expect, it } from 'vitest';
import {
  VCH_LEAD_COUNTS,
  vchLeadForSlot,
  vchLeadLabel,
} from '../../src/features/ask/vch-links';

describe('VCH review links — link-only, never pins', () => {
  it('loads all 118 reviewed slots: 3 confirmed, 105 proposed, 10 rejected', () => {
    // The 105 proposed split by TIER (REVIEW §3 fold): cross-checked
    // 38 + community report 41 = 79 proposed, unrated 26. (The REVIEW
    // §3 table's 81/24 splits by file status instead; the tier fold is
    // the one that decides what a lead needs — unrated needs a second
    // source before it can ever be confirmed.)
    expect(VCH_LEAD_COUNTS).toEqual({
      total: 118,
      confirmed: 3,
      proposed: 79,
      proposedUnrated: 26,
      rejected: 10,
    });
  });

  it('the 3 confirmed rows are link-only with their host recorded as a lead', () => {
    const jada = vchLeadForSlot('card-checklist:jack-of-hearts-dancers:jada-watts:gold');
    expect(jada?.status).toBe('confirmed');
    expect(jada?.tier).toBe('cross-checked');
    expect(jada?.proposedHostId).toBe('L513');
    expect(jada?.sourcePinUrl).toBe(
      'https://fbritoferreira.github.io/gta6/?id=collectible-card-029',
    );
    // A confirmed row has NO proposed position to plot — the host is
    // the lead, and even that is link-only (licence-blocked).
    expect(jada?.proposedPosition).toBeNull();
    expect(jada?.licenceStatus).toMatch(/NOT CLEARED/);
    expect(vchLeadLabel(jada!)).toMatch(/link only, not our pin/);
    const lavinia = vchLeadForSlot('card-checklist:nine1nine-dancers:lavinia:deep-red');
    expect(lavinia?.status).toBe('confirmed');
    expect(lavinia?.proposedHostId).toBe('L535');
    const ratface = vchLeadForSlot('card-checklist:ed-comics-universe:ratface:silver');
    expect(ratface?.status).toBe('confirmed');
    expect(ratface?.proposedHostId).toBe('L360');
  });

  it("Taylor Blanc's winner is the OTHER pin — host L1589, proposed-unrated", () => {
    const taylor = vchLeadForSlot(
      'card-checklist:liberty-city-penetrators:taylor-blanc:standard',
    );
    expect(taylor?.status).toBe('proposed-unrated');
    expect(taylor?.proposedHostId).toBe('L1589');
    expect(taylor?.proposedPosition).toEqual({ x: -1674, y: -2182 });
    expect(taylor?.sourcePinId).toBe('card-liberty-city-penetrators-008');
    expect(taylor?.reviewReason).toMatch(/DIFFERENT pin wins arbitration/);
  });

  it('a proposed row keeps its proposed position as a lead, never a pin', () => {
    const blood = vchLeadForSlot('card-checklist:backyard-wrestling:blood-smith:standard');
    expect(blood?.status).toBe('proposed');
    expect(blood?.tier).toBe('cross-checked');
    expect(blood?.proposedPosition).toEqual({ x: -5471, y: 4841 });
    expect(blood?.proposedHostId).toBeNull();
    expect(vchLeadLabel(blood!)).toMatch(/kept as a lead, not a pin/);
  });

  it('a rejected row carries its reason and no usable link', () => {
    const jadaSilver = vchLeadForSlot(
      'card-checklist:jack-of-hearts-dancers:jada-watts:silver',
    );
    expect(jadaSilver?.status).toBe('rejected');
    expect(jadaSilver?.reviewReason).toMatch(/Bobcat Key/);
    expect(vchLeadLabel(jadaSilver!)).toMatch(/^Community pin rejected/);
    const amber = vchLeadForSlot('card-checklist:delights-dancers:amber:standard');
    expect(amber?.status).toBe('rejected');
  });

  it('an unreviewed slot has no lead at all', () => {
    expect(vchLeadForSlot('card-checklist:delights-dancers:vicki:standard')).toBeNull();
    expect(vchLeadForSlot('no-such-slot')).toBeNull();
  });

  it('no Delights Dancers candidate was confirmed — the set stays 5 pinned', () => {
    const delights = [
      'chip',
      'cyrus',
      'lance',
      'nicole',
      'cleo',
      'crystal',
      'daisy',
      'lucky',
      'mario',
      'tracy',
      'amber',
      'nevaeh',
    ].map(
      (person) =>
        vchLeadForSlot(`card-checklist:delights-dancers:${person}:standard`),
    );
    expect(delights.filter(Boolean)).toHaveLength(12);
    expect(delights.some((lead) => lead?.status === 'confirmed')).toBe(false);
  });
});
