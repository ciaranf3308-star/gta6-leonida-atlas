import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { catalogueFromSnapshot } from '../../src/data/catalogue';
import { buildGameDatabase, type GameDatabase } from '../../src/domain/game-db';
import { hintItemForQuestion } from '../../src/features/ask/intent';
import type { Place } from '../../src/domain/types';

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

function buildDb(): GameDatabase {
  return buildGameDatabase({ places });
}

describe('hintItemForQuestion — the "Bigger hint" button target (Demo G)', () => {
  it('resolves the item a hint question names by name', () => {
    const db = buildDb();
    const harley = hintItemForQuestion('give me a hint for the Harley card', db);
    expect(harley?.name).toBe('Harley');
    const vicki = hintItemForQuestion('give me a hint for Vicki', db);
    expect(vicki?.name).toBe('Vicki');
  });

  it('resolves an unpinned card too — the ladder works past level 2 honestly', () => {
    const db = buildDb();
    // Jude Flores is still unpinned (gap — no fbrito record matched).
    const jude = hintItemForQuestion('give me a hint for the Jude Flores card', db);
    expect(jude?.name).toBe('Jude Flores');
    expect(jude?.locationId).toBeNull();
  });

  it('returns null when the question names no item — the button never guesses', () => {
    const db = buildDb();
    expect(hintItemForQuestion('give me a hint for a Delights Dancers card', db)).toBeNull();
    expect(hintItemForQuestion('give me a hint', db)).toBeNull();
  });

  it('returns null for non-hint questions, even ones naming an item', () => {
    const db = buildDb();
    expect(hintItemForQuestion('have I found Vicki?', db)).toBeNull();
    expect(hintItemForQuestion('where is the Harley card?', db)).toBeNull();
  });
});
