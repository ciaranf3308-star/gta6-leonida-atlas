import type { Place } from '../../domain/types';
import { isUnnamedPlace } from '../../domain/types';
import { tagResolutionFor } from '../../domain/resolve-tags';
import { ROBBABLE_SHOP_TAGS } from '../../data/catalogue';
import { COUNTIES, countyForPlace } from '../../data/counties';
import {
  aiCategoryDisplay,
  aiCategoryShortLabel,
  effectiveAiCategory,
  type AiCategoryRecord,
} from '../categorise/categories';
import {
  NEAR_DISTANCE_UNITS,
  type AskRetrievalResult,
} from './retrieval';

/**
 * Ask Nylah answers as big place cards — never a text wall.
 *
 * The user (2026-11-24, rating v0.12.0 a 7): "When I use ai to search
 * how it presents back places is awful". The old answer was a paragraph
 * of AI prose with a small text list underneath it. The new answer is
 * cards first: the same big card as Find (56px blip roundel, name,
 * area/county, badges), one per place, nearest first, always with its
 * distance from the place asked about, one tap to fly to the place and
 * open its sheet. The AI, when a key is saved, writes at most two
 * short sentences above the cards — it never lists places, the cards
 * do that. No key, no AI text at all: the cards and the one-line
 * proximity verdict are the whole answer.
 *
 * Cards are built here, as a pure function of the retrieval result, so
 * they are unit-testable without rendering: nearest-first, distances
 * attached, badges derived from tags + layer + AI type, "?" places
 * titled "? · House" (tag) or "? · Gym — AI suggested", never with an
 * invented name.
 */

/** Big cards shown per answer — the rest are on the map as highlights. */
export const ASK_MAX_CARDS = 10;

export type AskBadge = 'Enterable' | 'Lootable' | 'Breakable' | 'Gym' | 'Equipment';

export interface AskCard {
  placeId: string;
  layerId: string;
  /** "Grand Majestic Gym", or "? · House" for an unnamed place. */
  title: string;
  /** Where the type in the title came from. */
  typeSource: 'layer' | 'tag' | 'ai' | 'none';
  /** "AI suggested: Gym" — kept on the card data for the place sheet,
   * never rendered on the card face (v0.14.0: the card stays clean). */
  typeNote: string | null;
  /** Area / region, e.g. "Tequesta, Vice City". */
  area: string;
  /** County short name, e.g. "Vice-Dale", or null. */
  countyName: string | null;
  /** Distance in map units from the anchor, null when unpositioned. */
  distanceUnits: number | null;
  /** "about 1,200 map units away", or "No verified position". */
  distanceLabel: string;
  /** Within NEAR_DISTANCE_UNITS of the anchor. */
  near: boolean;
  badges: AskBadge[];
  /** Badges that come from an AI suggestion, not from the map data. */
  aiBadges: Partial<Record<AskBadge, boolean>>;
  hasPosition: boolean;
}

/** Badges for one place: what you can do there, from its tags + layer
 * (+ AI type, flagged as AI — a badge from the AI never reads as a
 * verified fact). */
export function badgesForPlace(
  place: Place,
  aiRecord: AiCategoryRecord | undefined | null,
): { badges: AskBadge[]; aiBadges: Partial<Record<AskBadge, boolean>> } {
  const badges: AskBadge[] = [];
  const aiBadges: Partial<Record<AskBadge, boolean>> = {};
  const add = (badge: AskBadge, ai = false) => {
    if (!badges.includes(badge)) badges.push(badge);
    if (ai) aiBadges[badge] = true;
  };
  if (place.tags.includes('enterable') || place.layerId === 'interiors')
    add('Enterable');
  if (
    place.layerId === 'lootable' ||
    (place.tags.includes('enterable') &&
      place.tags.some((tag) => (ROBBABLE_SHOP_TAGS as readonly string[]).includes(tag)))
  )
    add('Lootable');
  if (
    place.layerId === 'breakable' ||
    place.tags.includes('breakable') ||
    (place.tags.includes('residential') && place.tags.includes('enterable'))
  )
    add('Breakable');
  // Gyms vs equipment never leak into each other: a member club is a
  // Gym, free gear is Equipment, whatever the loose 'gym' tag says.
  if (place.layerId === 'gyms') add('Gym');
  else if (place.layerId === 'equipment') add('Equipment');
  else if (place.tags.includes('equipment') || place.tags.includes('workout'))
    add('Equipment');
  else if (place.tags.includes('gym') || place.tags.includes('fitness')) add('Gym');
  const aiCategory = effectiveAiCategory(aiRecord);
  if (aiCategory === 'gym') {
    if (place.layerId === 'equipment') add('Equipment', true);
    else add('Gym', true);
  }
  return { badges, aiBadges };
}

/** One card for one place — used for the houses-to-check list, where
 * the distance comes from the house search rather than retrieval. */
export function buildAskCard(
  place: Place,
  distanceUnits: number | null,
  aiCategories: Readonly<Record<string, AiCategoryRecord>>,
): AskCard {
  return cardFor(place, distanceUnits, aiCategories);
}

function cardFor(
  place: Place,
  distanceUnits: number | null,
  aiCategories: Readonly<Record<string, AiCategoryRecord>>,
): AskCard {
  const aiRecord = aiCategories[place.id];
  const aiDisplay = aiCategoryDisplay(aiRecord);
  const tagResolution = tagResolutionFor(place);
  let title = place.title;
  let typeSource: AskCard['typeSource'] = 'layer';
  let typeNote: string | null = null;
  if (isUnnamedPlace(place)) {
    if (tagResolution) {
      title = `? · ${aiCategoryShortLabel(tagResolution.category)}`;
      typeSource = 'tag';
    } else if (aiDisplay) {
      title = `? · ${aiCategoryShortLabel(effectiveAiCategory(aiRecord)!)}`;
      typeSource = 'ai';
      typeNote = `AI suggested: ${aiDisplay.label}`;
    } else {
      title = '?';
      typeSource = 'none';
    }
  } else if (aiDisplay && place.layerId === 'uncertain') {
    // A named-but-uncertain place with an AI type keeps its name; the
    // suggestion is a note, never the title.
    typeNote = `AI suggested: ${aiDisplay.label}`;
  }
  const countyId = countyForPlace(place);
  const countyName =
    COUNTIES.find((c) => c.id === countyId)?.name.replace(' County', '') ?? null;
  const { badges, aiBadges } = badgesForPlace(place, aiRecord);
  const rounded =
    distanceUnits === null ? null : Math.round(distanceUnits / 100) * 100;
  return {
    placeId: place.id,
    layerId: place.layerId,
    title,
    typeSource,
    typeNote,
    area: place.region || 'Leonida',
    countyName,
    distanceUnits,
    distanceLabel:
      rounded === null
        ? place.position
          ? 'On the map — tap to fly there'
          : 'No verified position'
        : rounded === 0
          ? 'Right here'
          : `about ${rounded.toLocaleString()} map units away`,
    near: distanceUnits !== null && distanceUnits <= NEAR_DISTANCE_UNITS,
    badges,
    aiBadges,
    hasPosition: place.position !== null,
  };
}

export interface AskCardsResult {
  /** Cards to show, nearest first, unpositioned last. */
  cards: AskCard[];
  /** Matching places in total (before the card cap) — the rest are
   * highlighted on the map. */
  total: number;
}

export function buildAskCards(
  result: AskRetrievalResult,
  places: readonly Place[],
  aiCategories: Readonly<Record<string, AiCategoryRecord>>,
): AskCardsResult {
  const placeById = new Map(places.map((place) => [place.id, place]));
  const ordered = [...result.records].sort((a, b) => {
    const da = result.anchorDistances.get(a.id) ?? Number.POSITIVE_INFINITY;
    const db = result.anchorDistances.get(b.id) ?? Number.POSITIVE_INFINITY;
    return da - db;
  });
  const cards = ordered
    .slice(0, ASK_MAX_CARDS)
    .map((place) => {
      const full = placeById.get(place.id) ?? place;
      return cardFor(
        full,
        result.anchorDistances.get(place.id) ?? null,
        aiCategories,
      );
    });
  return { cards, total: result.records.length };
}

/** The verdict line, kept short: the proximity summary's first two
 * sentences. The rest of the summary (the house-gym gap, the houses
 * count) is redundant with the houses section below the cards, and a
 * five-line paragraph above the cards hides them — the answer is
 * cards first, so the verdict is one or two lines, never a wall. */
export function shortVerdict(text: string | null): string | null {
  if (!text) return null;
  const sentences = text.split(/(?<=[.!])\s+/).filter(Boolean);
  return sentences.slice(0, 2).join(' ');
}

/** "Near Capri" — the anchor chip on an answer, so a follow-up never
 * loses what it is about. The area label already reads "near X" for a
 * named place anchor, or the bare area word otherwise. */
export function askAnchorLabel(result: AskRetrievalResult): string | null {
  if (!result.areaLabel) return null;
  const label = result.areaLabel;
  if (label.startsWith('near ')) return label;
  return `Near ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}
