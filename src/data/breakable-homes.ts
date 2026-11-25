import type { Place } from '../domain/types';

/**
 * Breakable homes named in post-launch robbery guides — houses, apartments
 * and trailers you can break into — where NO verified position exists in
 * any source checked. They are listed with position: null (searchable
 * only, never guessed), the Atlas convention for unknown positions.
 *
 * The positioned breakable homes live in the GTADB catalogue itself and
 * are reassigned to the 'breakable' layer there (src/data/catalogue.ts):
 * the 33 residential+enterable records (8 named, 25 unnamed — Venture
 * Apartments North/South L192/L193, Jason's House L266, the Washington
 * Beach houses L4/L8/L9/L10…), the 8 Capri rob-house candidates (6
 * enterable + 2 residential "?" records), and the Port Gellhorn Trailer
 * Park (L1062). Those are real pins; these entries are the guide-named
 * examples with no pin.
 *
 * Do NOT invent a position for any of these. A guide-named example
 * becomes a pin only when its position is verified (GTADB record) or the
 * user marks it himself.
 *
 * Sources (checked 2026-11-23):
 * - Capri rob houses: GameRant, "Best Neighborhood to Rob Houses in
 *   GTA 6" — red = break into the house, yellow = garage only; the
 *   houses share one design, so a clone of it can be broken into too.
 *   Gibson Brothers Bank (green) is a high-level heist, ~$9,000.
 * - The dark-blue rule + how to get in: HowToVideoGame, "Can You Rob
 *   Houses? Answered" (dark blue = can go in, light blue = closed;
 *   Snap Gun, Chapter 3, Yasmani, picks locks quietly) and DualShockers,
 *   "How to Identify Which Houses You Can Enter".
 * - The named examples below (Parlor Apartments, Bayside apartment,
 *   Ambrosia houses, Lost Vista and Scattered Pines trailers) are the
 *   robbery-guide examples the user verified in game; the HowToVideoGame
 *   rob-houses guide is cited as the representative robbery guide for
 *   the mechanics. Per-example guide pages were not individually
 *   re-verified in this pass — the entries say so by being searchable
 *   only, and their descriptions name what is inside rather than
 *   claiming a confirmed pin.
 */
const ROBBERY_GUIDE_SOURCE = {
  title: 'Robbery guides · HowToVideoGame "Can You Rob Houses?"',
  url: 'https://howtovideogame.com/gta-6-rob-houses/',
};

function breakableExample(
  id: string,
  title: string,
  area: string,
  whatIsInside: string,
  extraTags: string[] = [],
): Place {
  return {
    id,
    title,
    description: `${title} — ${area}. ${whatIsInside} Listed by area only — no verified position, so it is searchable only, not placed on the map.`,
    category: 'robberies',
    position: null,
    layerId: 'breakable',
    // Guide-verified enterable homes — they carry the 'enterable' tag
    // like the GTADB-tagged ones, so "Can go inside" and the Interiors
    // venue filter include them; the 'breakable' tag keeps them in the
    // Breakable homes answers and out of nothing else.
    tags: ['breakable', 'house', 'enterable', ...extraTags],
    region: area,
    source: ROBBERY_GUIDE_SOURCE,
    evidence: 'uncertain',
  };
}

/**
 * What the robbery guides say is inside each guide-named breakable
 * example — the same facts as the descriptions above, distilled to
 * one loot line each, for the place card's "Available loot" row. Only
 * what a guide actually names: Bayside names no loot, so it is not
 * here, and its card honestly says "Loot unknown".
 */
export const GUIDE_BREAKABLE_LOOT: ReadonlyMap<string, string> = new Map([
  [
    'breakable:parlor-apartments',
    'Safe full of cash, drugs — and a shotgun in the apartment.',
  ],
  [
    'breakable:ambrosia-houses',
    '$1,000 in a safe, a Copperhead Gauntlet in the garage, a football card inside.',
  ],
  [
    'breakable:lost-vista-trailers',
    'Pill stash in the brown wood trailer, plus a northern mobile home.',
  ],
  [
    'breakable:scattered-pines-trailer',
    'Crystal inside the white single-wide trailer.',
  ],
]);

export const BREAKABLE_HOME_PLACES: Place[] = [
  breakableExample(
    'breakable:parlor-apartments',
    'Parlor Apartments',
    'Rockridge, Vice City',
    'A robbery opportunity named in the robbery guides — enter the building, apartment with a shotgun, safe full of cash, drugs.',
    ['apartment'],
  ),
  breakableExample(
    'breakable:bayside-apartment',
    'Bayside apartment',
    'Bayside, Vice City',
    'An apartment named in the robbery guides as a break-in.',
    ['apartment'],
  ),
  breakableExample(
    'breakable:ambrosia-houses',
    'Ambrosia houses',
    'Ambrosia',
    'Houses outside Vice City named in the robbery guides — break the garage, steal $1,000 from a safe, find a Copperhead Gauntlet in the garage and a football card inside.',
  ),
  breakableExample(
    'breakable:lost-vista-trailers',
    'Lost Vista trailers',
    'Lost Vista',
    'Trailer park named in the robbery guides — brown wood trailer with a pill stash, plus a northern mobile home.',
    ['trailer'],
  ),
  breakableExample(
    'breakable:scattered-pines-trailer',
    'Scattered Pines trailer',
    'Scattered Pines',
    'White single-wide trailer named in the robbery guides, crystal inside.',
    ['trailer'],
  ),
];
