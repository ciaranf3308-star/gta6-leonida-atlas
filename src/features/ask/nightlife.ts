import type { Place } from '../../domain/types';
import { normalizeUserTag } from '../../domain/user-tags';
import {
  effectiveAiCategory,
  type AiCategoryRecord,
} from '../categorise/categories';

/**
 * Ask Nylah — nightlife evidence, shared by the local finder
 * (retrieval.ts) and the structured tools (tools.ts).
 *
 * One function answers "is this a nightlife venue?" from all three
 * evidences on the device, so the two paths can never drift apart
 * again: before this module the tools path saw source #tags only
 * (DESIGN §7.4 case 3, known gap), while the local finder also
 * answered from the user's own tags and confident AI "bar" types.
 * The v0.32 step-7 follow-up moved the v0.31.2 logic here verbatim
 * and threaded the two missing evidences into the tools path.
 */

/** Source #tags that mark a nightlife venue. */
export const NIGHTLIFE_TAGS = ['#nightclub', '#stripclub', '#bar'];

/** User-tag words for each nightlife #tag — the words a tag of his
 * own has to carry to count as that venue. */
const NIGHTLIFE_TAG_WORDS: Record<string, readonly string[]> = {
  '#nightclub': ['nightclub'],
  '#stripclub': ['stripclub', 'strip club'],
  '#bar': ['bar', 'pub'],
};

/**
 * Is this place one of the nightlife venues asked for, by any
 * evidence on the device? A source #tag, the user's own tag saying
 * so, or a confident AI "bar" type (the resolver files nightclub /
 * bar / pub words as "bar", so an AI bar counts for any nightlife
 * ask). Whole-word matching on user tags, so a "barbecue" tag never
 * counts as a bar.
 *
 * `sourceTags` are the place's source #tags; `tags` are the
 * nightlife #tags the question asked for (one subtype in the local
 * finder, the whole set in the tools path); `userTags` / `aiRecord`
 * are looked up by Place id — GameLocation.id IS the Place id
 * verbatim, so the tools path keys them by `location.id`.
 */
export function isNightlifeEvidence(
  sourceTags: readonly string[],
  tags: readonly string[],
  userTags: readonly string[] | undefined,
  aiRecord: AiCategoryRecord | undefined | null,
): boolean {
  if (sourceTags.some((tag) => tags.includes(tag))) return true;
  const words = tags.flatMap((tag) => NIGHTLIFE_TAG_WORDS[tag] ?? []);
  const mine = userTags ?? [];
  if (
    words.length > 0 &&
    mine.some((tag) => {
      const clean = normalizeUserTag(tag);
      if (!clean) return false;
      if (words.includes('strip club') && clean.includes('strip club')) return true;
      return clean.split(' ').some((word) => words.includes(word));
    })
  )
    return true;
  return effectiveAiCategory(aiRecord) === 'bar';
}

/** Local-finder adapter: `place` is a Place (retrieval.ts). */
export function isNightlifePlace(
  place: Place,
  tags: readonly string[],
  userTags: readonly string[] | undefined,
  aiRecord: AiCategoryRecord | undefined | null,
): boolean {
  return isNightlifeEvidence(place.tags, tags, userTags, aiRecord);
}

/** Tools adapter: `location` is a GameLocation (tools.ts). `tags`
 *  defaults to the whole nightlife set — the tools path narrows to
 *  nightlife as a class, not to one subtype. */
export function isNightlifeLocation(
  location: { tags: readonly string[] },
  tags: readonly string[] = NIGHTLIFE_TAGS,
  userTags?: readonly string[] | undefined,
  aiRecord?: AiCategoryRecord | undefined | null,
): boolean {
  return isNightlifeEvidence(location.tags, tags, userTags, aiRecord);
}
