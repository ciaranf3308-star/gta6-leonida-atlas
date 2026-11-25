import type { LayerDefinition, Place } from '../../domain/types';

/**
 * Spoiler visibility — the single deterministic source of truth for
 * "what is the user allowed to see right now".
 *
 * THE RULE (user, 2026-11-23, and the v0.30 stabilisation):
 * a public place is visible exactly when ONE of these holds:
 *   1. it is the user's own marker ('my-markers' — never a spoiler), or
 *   2. its layer is turned on by an explicit user action (a Layer
 *      checkbox, a map chip, the first-open picker, "Restore my last
 *      layers", "Show everything" — all one-tap consents), or
 *   3. it is in the current REVEAL set: a place the user asked to see
 *      individually — an Ask answer, a Find result tap, a deep link,
 *      a place card. A reveal shows THAT place only, for now; it never
 *      turns its layer on, so no unrelated marker appears with it.
 *
 * Nothing here depends on a prompt, a default, or a hope. Every
 * surface that shows places — the map pins, the Find list, the Ask
 * answer scope — reads this module. The AI is only ever handed
 * records this module already allowed, and its free text is checked
 * against those records before it is shown (see sanitizeAiNote in
 * features/ask/openai.ts), so a prompt can never leak what the rule
 * did not allow.
 */

/** Ids the user revealed individually (Ask highlights + selected place). */
export type RevealIds = ReadonlySet<string>;

/**
 * The reveal set for one render: the Ask highlights plus the place
 * whose sheet is open. The selected place is itself a reveal — its
 * pin must not vanish while its sheet is open just because its layer
 * is off and the highlights were cleared. And the pin must not vanish
 * when the sheet closes either: App recenters a still-visible
 * deselected place into the visible band (the focus had centred it
 * above the sheet, so it would otherwise sit under the top chrome
 * and the pin clamp would hide it while the highlight is still there).
 */
export function revealSet(
  highlightIds: Iterable<string>,
  selectedId: string | null,
): ReadonlySet<string> {
  const set = new Set(highlightIds);
  if (selectedId) set.add(selectedId);
  return set;
}

/** Layer ids whose toggles are on right now. */
export function visibleLayerIds(layers: readonly LayerDefinition[]): ReadonlySet<string> {
  return new Set(layers.filter((layer) => layer.visible).map((layer) => layer.id));
}

export function isPlaceVisible(
  place: Place,
  layers: readonly LayerDefinition[],
  revealIds: RevealIds = new Set(),
): boolean {
  if (place.layerId === 'my-markers') return true;
  if (revealIds.has(place.id)) return true;
  return layers.some((layer) => layer.id === place.layerId && layer.visible);
}

/** The places the map and the Find list may show right now. */
export function visiblePlaces(
  places: readonly Place[],
  layers: readonly LayerDefinition[],
  revealIds: RevealIds = new Set(),
): Place[] {
  const visible = visibleLayerIds(layers);
  return places.filter(
    (place) =>
      place.layerId === 'my-markers' ||
      revealIds.has(place.id) ||
      visible.has(place.layerId),
  );
}

/**
 * The layers an Ask answer may draw records from — deterministic, from
 * the question alone:
 * - the question names layers → ONLY those layers (plus My markers).
 *   A visible-but-unasked layer never hijacks the answer.
 * - the question names no layer → the layers already visible (plus
 *   My markers). Nothing hidden is ever in scope.
 * The AI is only ever sent records from this set, so it cannot name,
 * hint at, or count anything outside it.
 */
export function askAllowedLayerIds(
  requestedLayerIds: readonly string[],
  layers: readonly LayerDefinition[],
): ReadonlySet<string> {
  if (requestedLayerIds.length > 0) {
    return new Set([...requestedLayerIds, 'my-markers']);
  }
  return new Set([...visibleLayerIds(layers), 'my-markers']);
}
