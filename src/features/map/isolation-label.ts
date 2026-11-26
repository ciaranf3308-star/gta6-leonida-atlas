/**
 * The isolation rect's permanent label (§6.1, step 5) — kept in a
 * Leaflet-free module so unit tests can assert the contract without
 * spinning up a map. The rect is an ESTIMATED extent (member bbox),
 * and an estimate is labelled as such everywhere it is shown. The
 * class carries the dark-map chip styling in map.css — never
 * Leaflet's default pale tooltip.
 */
export const ESTIMATED_EXTENT_TOOLTIP_TEXT = 'estimated extent';
export const ESTIMATED_EXTENT_TOOLTIP_CLASS = 'isolation-extent-label';
