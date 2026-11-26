// Likely-area label width — v0.32 regions fix (lane 1).
//
// The tooltip's width must be REAL, not a max-width: Leaflet's
// tooltip pane shrink-wraps, so max-width alone collapsed the
// 8-name Kelly label to a 68px-wide one-word-per-line column
// (DEMOS-GANGOP Finding 1, R3b). The CSS rule and the
// LIKELY_AREA_LABEL_WIDTH_PX constant in likely-area-layer.ts must
// agree — the constant is what the layer's callers and the
// placement reasoning quote, the CSS is what the browser renders.
// The layer file imports Leaflet, so the constant is read from its
// source text here rather than imported.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const MAP_CSS = readFileSync(
  new URL("../../src/features/map/map.css", import.meta.url),
  "utf8",
);
const LAYER_SRC = readFileSync(
  new URL("../../src/features/map/likely-area-layer.ts", import.meta.url),
  "utf8",
);

/** The .leaflet-tooltip.likely-area-label rule body, verbatim. */
function likelyAreaLabelRule(): string {
  const match = MAP_CSS.match(
    /\.leaflet-tooltip\.likely-area-label\s*\{([^}]*)\}/,
  );
  if (!match) throw new Error("likely-area-label rule not found in map.css");
  const body = match[1];
  if (body === undefined) throw new Error("likely-area-label rule has no body");
  return body;
}

/** The LIKELY_AREA_LABEL_WIDTH_PX value declared in the layer. */
function layerWidthPx(): number {
  const match = LAYER_SRC.match(
    /export const LIKELY_AREA_LABEL_WIDTH_PX = (\d+);/,
  );
  if (!match) throw new Error("LIKELY_AREA_LABEL_WIDTH_PX not found");
  return Number(match[1]);
}

describe("likely-area label width (v0.32 regions fix, lane 1)", () => {
  it("the tooltip has a real fixed width, not a max-width", () => {
    const rule = likelyAreaLabelRule();
    // A real width: the text wraps into a readable block.
    expect(rule).toContain(`width: ${layerWidthPx()}px`);
    // No max-width anywhere in the rule: a max-width without a
    // width is exactly the shrink-wrap that produced the 68px
    // column, and a max-width below the width would silently
    // re-cap it.
    expect(rule).not.toContain("max-width");
  });

  it("the width is 200px — wide enough for the longest label to read as a block", () => {
    // R3b's bar is a block at least 120px wide and at most 260px
    // tall; 200px wraps the longest live label (the 6-name Port
    // Gellhorn one, after lane 4b's town merges — the Kelly label
    // is a single name, Walker Farm alone) into ~5 lines.
    expect(layerWidthPx()).toBe(200);
  });

  it("the label still wraps and never intercepts taps", () => {
    const rule = likelyAreaLabelRule();
    expect(rule).toContain("white-space: normal");
    expect(rule).toContain("pointer-events: none");
  });
});
