import { describe, expect, it } from 'vitest';
import { isPersonalProgressQuestion } from '../../src/features/ask/retrieval';

/**
 * No-key personal-progress refusal (v0.32 step-9, Demo D step 3).
 * The detector is the gate AskPanel refuses on: a personal-progress
 * question without a key gets an honest refusal instead of a finder
 * proximity verdict that can state the opposite of the truth.
 * The bare-name card cases must NOT refuse — they are map questions
 * whose answers are the set's cards (the 2026-11-26 05:13 live bug).
 */
describe('isPersonalProgressQuestion — no-key refusal gate (Demo D3)', () => {
  it.each([
    // Demo D3, the sharpest case: the finder said "There is no place
    // near lummox county" when Redshaw's in Lummox County WAS explored.
    'where have I explored in Lummox County?',
    // Demo A4: "what's left in the Delights Dancers set?" and
    // "have I found Vicki?" both got proximity answers, no yes/no.
    "what's left in the Delights Dancers set?",
    'have I found Vicki?',
    // Demo B2: "what break-in houses have I looted in Capri?"
    'what break-in houses have I looted in Capri?',
    'have I found the Harley card?',
    'what have I collected so far?',
    'did I loot the Parlor Apartments?',
    'how many have I found in the set?',
    'what am I missing from the Delights Dancers set?',
    'where did I explore yesterday?',
  ])('refuses "%s" (personal progress)', (question) => {
    expect(isPersonalProgressQuestion(question)).toBe(true);
  });

  it.each([
    // The bare-name regression cases (2026-11-26 05:13 live bug):
    // layers off, each must still return the set's cards.
    'Delight dancers',
    'Delights',
    'Jack of Hearts',
    'flamingos',
    // Ordinary map questions — no first-person progress phrasing.
    'where are the collectibles?',
    'I need any cards for delight dancers near Capri',
    'help me find the Delights Dancers card set',
    'where is the nearest gym to Vice City?',
    'show me the houses I can hit tonight in Capri',
    'nightclub in Vice City',
  ])('does NOT refuse "%s" (a map question)', (question) => {
    expect(isPersonalProgressQuestion(question)).toBe(false);
  });

  it('word-boundary matching: "mini found" is not progress', () => {
    expect(isPersonalProgressQuestion('mini found')).toBe(false);
    expect(isPersonalProgressQuestion('I found the Harley card')).toBe(true);
  });
});
