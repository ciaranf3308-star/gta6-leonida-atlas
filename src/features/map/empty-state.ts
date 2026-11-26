/**
 * The "Nothing showing here" empty-state banner — what counts as
 * "showing" (v0.32 lane 3, Finding 3).
 *
 * The banner used to count layer-matched *places* only
 * (showingCount: positioned places in the filtered list), so with
 * only the gang-op layer on it fired while 13 dashed likely-area
 * regions covered the map — regions are not places (no position),
 * so by its own logic nothing was showing, but from the player's
 * view the map plainly showed 13 regions while the banner said
 * nothing is. A region is map presence too: the banner must not
 * fire while any region is drawn.
 *
 * This module is the PURE half (no React, no Leaflet), so the
 * contract is unit-testable without spinning up a map. App.tsx
 * wires it in: regionsShowingCount feeds the same single boolean
 * that gates both the banner and MapView's prompt padding.
 */
import type { AreaNode } from '../../domain/geography';
import type { LayerDefinition, Place } from '../../domain/types';
import { gangOpLikelyAreas } from './likely-area';

/**
 * How many likely-area regions are drawn right now. Consumes the
 * SAME computation MapView draws with — gangOpLikelyAreas over the
 * same areas / places / layers — so the banner and the map can
 * never disagree about whether regions are showing. That means:
 *
 * - the layer off → 0 (a revealed op with the layer off draws
 *   nothing, and counts nothing);
 * - the 3 no-extent ops (Fishing Shacks, Chatfield Storage,
 *   Vespucci Mansion) resolve to null and never count;
 * - under area isolation the area filter drops the op places, so
 *   the regions genuinely vanish and the count is 0 — the banner
 *   then fires, honestly, until lane 2's input plumbing keeps the
 *   regions (and this count) alive under isolation.
 */
export function regionsDrawnCount(
  areas: ReadonlyMap<string, AreaNode> | null | undefined,
  places: readonly Place[],
  layers: readonly LayerDefinition[],
): number {
  if (!areas) return 0;
  return gangOpLikelyAreas(areas, places, layers).length;
}

/**
 * True when nothing is showing on the map at all: no positioned
 * place matches AND no likely-area region is drawn. Either kind
 * of map presence suppresses the banner.
 */
export function nothingShowing(
  showingCount: number,
  regionsDrawn: number,
): boolean {
  return showingCount === 0 && regionsDrawn === 0;
}

/**
 * "Show everything" (v0.32.1, Finding 4) — the layer half of the
 * banner button, pure so it is unit-testable. "Everything" is every
 * public layer; my-markers is personal data, never switched on by
 * a banner tap — exactly the turnOnLayers rule it replaces. Layers
 * already on stay on; named layers turn on only the named ones.
 * The filter half lives in App.tsx (turnOnLayers also resets the
 * filters + isolation): turning layers on alone left a narrow
 * filter in place, so with "Saved only" active the banner stayed
 * up and the button read as dead.
 */
export function layersTurnedOn(
  layers: readonly LayerDefinition[],
  layerIds: string[] | 'all',
): LayerDefinition[] {
  return layers.map((layer) =>
    layer.id === 'my-markers'
      ? layer
      : layerIds === 'all' || layerIds.includes(layer.id)
        ? { ...layer, visible: true }
        : layer,
  );
}
