import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import {
  displayTagsFor,
  placeTypeLine,
  tagLabel,
  unnamedTagAudit,
} from '../../src/domain/tags';
import { isUnnamedPlace } from '../../src/domain/types';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../../public/assets/street-leonida/maps/gtadb-landmarks-d406fea.json',
      import.meta.url,
    ),
    'utf8',
  ),
);

describe('Unnamed "?" records — tags are the halfway point', () => {
  it('audits the real snapshot: 1,042 usefully tagged, 582 internal-only, 1,108 bare', () => {
    const places = catalogueFromSnapshot(snapshot);
    const audit = unnamedTagAudit(places);
    expect(audit.unnamed).toBe(2732);
    expect(audit.withUsefulTags).toBe(1042);
    expect(audit.onlyInternalTags).toBe(582);
    expect(audit.noTags).toBe(1108);
    expect(audit.withUsefulTags + audit.onlyInternalTags + audit.noTags).toBe(
      audit.unnamed,
    );
  });

  it('no GTADB record carries a gym tag — the house-gym bet is unconfirmed', () => {
    const places = catalogueFromSnapshot(snapshot);
    const gtadb = places.filter((p) => p.id.startsWith('L'));
    expect(
      gtadb.filter((p) =>
        p.tags.some((t) => ['gym', 'fitness', 'workout', 'strength'].includes(t)),
      ),
    ).toHaveLength(0);
    // The only gym-tagged places in the catalogue are the 10 curated gyms.
    expect(
      places.filter((p) => p.tags.includes('gym')),
    ).toHaveLength(10);
  });

  it('translates source tags to plain English and strips internal notes', () => {
    expect(tagLabel('#gas')).toBe('Petrol station');
    expect(tagLabel('residential')).toBe('House');
    expect(tagLabel('enterable')).toBe('You can go inside');
    expect(
      displayTagsFor({ tags: ['enterable', 'residential', 'l4', '//pink', 'unconfirmed'] }),
    ).toEqual(['You can go inside', 'House', 'Not confirmed']);
    expect(placeTypeLine({ tags: ['enterable', '#gas'] })).toBe(
      'You can go inside · Petrol station',
    );
    expect(isUnnamedPlace({ title: '?, Capri' })).toBe(true);
  });
});
