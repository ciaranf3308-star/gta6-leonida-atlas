import { isUnnamedPlace, type Place } from '../../domain/types';
import { isUsableAiCategory, type AiCategoryRecord } from '../categorise/categories';

/**
 * §A9.3 / v0.33 D-1 — which places may draw a map pin.
 *
 * A "?" record (unnamed: its in-game address starts with "?" — see
 * isUnnamedPlace) renders as NOTHING on the map — no pin, no label —
 * until it is typed. The typing routes are the AI index job (which
 * stores a usable AiCategoryRecord — its deterministic steps resolve
 * from the map data's own tags first, the LLM is the last resort), a
 * player correction that names it, or a player jot that names it. A
 * stored usable type IS the typing: the job never invents a name, so
 * the record stays "?" — but its kind is now known, and the kind
 * decides. Every category in AI_CATEGORIES is a place kind (house,
 * shop, gym, …), so a typed record pins with its type glyph. There
 * is NO road/corner category: a road/corner name has no text layer
 * to go to and never pins — if a road/corner kind is ever added to
 * AI_CATEGORIES it must be excluded here, not pinned.
 *
 * Deliberately NOT live tag resolution: the catalogue's own tags can
 * already type ~1,500 "?" records (tagResolutionFor), and the Find
 * list shows those as "? · House" — but the map gate reads the stored
 * index only. Live tags would pin ~1,500 "?" places on a fresh
 * profile before the job ever ran, which is exactly the street-zoom
 * wall of "?" pins this rule removes. The job is the typing route;
 * running it stores the tag resolutions too.
 *
 * The gate is the single choke point for every render path: MapView
 * filters the visible set through it before hero selection,
 * clustering and marker creation, so a reveal (Ask highlight, Find
 * tap, deep link, selected place) can never smuggle a "?" pin back
 * onto the map. The record itself is untouched: it stays searchable
 * in Find, listed in the index job's queue, and openable from a list
 * — only its map pin is gone until it is typed. The player's own
 * markers are exempt: a marker's title is the player's own words,
 * never an unnamed catalogue record.
 */
export function isPlacePinnable(
  place: Pick<Place, 'id' | 'title' | 'layerId'>,
  aiCategories?: Readonly<Record<string, AiCategoryRecord>>,
): boolean {
  if (place.layerId === 'my-markers') return true;
  if (!isUnnamedPlace(place)) return true;
  return isUsableAiCategory(aiCategories?.[place.id]);
}
