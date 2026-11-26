// Chrome geometry — v0.30.0 map lane.
//
// Every hardcoded viewport exclusion the map used to carry (topChrome
// 200/162, the 99px zoom pill at bottom 76/150, the 72px right-edge
// zone, the 40px bottom strip) is replaced here by rects MEASURED
// from the actual interface at runtime. A resized chrome, a different
// phone, or a changed header no longer needs a code edit: the clamp
// follows whatever is really on screen.
//
// The module is split in two on purpose:
// - measureChromeGeometry() reads the DOM (getBoundingClientRect).
//   It is the only impure part, and it is exercised by the Playwright
//   probe (scripts/check-v030-geometry.mjs), not by unit tests.
// - markerBoxHidden(), decideLabelSide() and fitPaddingFor() are pure
//   functions of a ChromeGeometry value, so the clamp rules themselves
//   are unit-tested with synthetic geometry (tests/unit/chrome-
//   geometry.test.ts), including the v0.26 L2227 regression numbers.
//
// Coordinate space: canvas pixels — the same space Leaflet's
// latLngToContainerPoint returns. Every chrome rect is converted
// into it by subtracting the map canvas rect, so an overlay that
// moves with the page still lands on the right map pixels.
//
// Design constants (kept, named): the clearances around chrome are
// judgement, not measurements — 12px of breathing room above the top
// band, 24px from the screen edges, a 40px bottom strip. What is
// measured is WHERE the chrome is, not how much room it needs.

export interface ChromeRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ChromeGeometry {
  /** Map canvas size in CSS px (Leaflet container points). */
  width: number;
  height: number;
  /** Bottom edge of the hero banner block (banner + search + chips). */
  heroBottom: number;
  /** Bottom edge of the whole top chrome band: hero, illustration
   * note and county title, whichever reaches lowest. The note sits
   * ~20px below the hero on phones, so a hero-only band left pins
   * half-hidden under it. */
  topChromeBottom: number;
  /** topChromeBottom + TOP_PIN_CLEARANCE: a pin whose box starts
   * above this line is in the top chrome. */
  topBand: number;
  /** Right-edge stack (Layers + recenter), when it is displayed
   * (phones only — display:none on desktop). */
  edgeStack: ChromeRect | null;
  /** Zoom controls, whichever set is displayed: the bottom-right
   * pill on phones, the full navigation column on desktop. */
  zoomControls: ChromeRect | null;
  /** Top edge of the attribution line, when it is displayed. */
  attributionTop: number | null;
  /** Height of the empty-map prompt, when it is displayed. */
  promptHeight: number | null;
  /** Height of the bottom nav bar (0 when absent). */
  navHeight: number;
}

/** Breathing room between a pin box and the top chrome band. */
export const TOP_PIN_CLEARANCE = 12;
/** Pins keep this far from the left/right screen edges. */
export const EDGE_CLEARANCE = 24;
/** Bottom strip kept clear even when the attribution is hidden
 * (a place sheet is open then, and it covers the bottom of the
 * map — the strip is the pre-existing guard for that case). */
export const BOTTOM_STRIP = 40;
/** Fit framing: the island sits this far below the hero. */
export const FIT_TOP_MARGIN = 6;
/** Fit framing: this far above the bottom nav / prompt. */
export const FIT_BOTTOM_MARGIN = 11;
/** Fit framing above the empty-map prompt (taller chrome). */
export const FIT_BOTTOM_MARGIN_PROMPT = 18;

/** Fallback geometry for the first frame before the host is
 * measured — the v0.29 phone constants, so a missing measurement
 * degrades to the old behaviour instead of showing pins under
 * chrome. */
export const FALLBACK_GEOMETRY: ChromeGeometry = {
  width: 390,
  height: 771,
  heroBottom: 198,
  topChromeBottom: 217,
  topBand: 229,
  edgeStack: { left: 330, top: 196, right: 378, bottom: 302 },
  zoomControls: { left: 328, top: 596, right: 378, bottom: 695 },
  attributionTop: 740,
  promptHeight: null,
  navHeight: 73,
};

function isVisible(el: Element | null): el is Element {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function toCanvasRect(el: Element, canvasRect: DOMRect): ChromeRect {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - canvasRect.left,
    top: r.top - canvasRect.top,
    right: r.right - canvasRect.left,
    bottom: r.bottom - canvasRect.top,
  };
}

/**
 * Read the chrome geometry around a map host element. The hero and
 * the empty-map prompt live in the surrounding .map-workspace (they
 * are App siblings of the map, not MapView children); the bottom nav
 * lives at the document level. Everything else — the edge stack, the
 * zoom pill, the desktop nav, the attribution, the note and the
 * county title — lives in .atlas-map-view as SIBLINGS of the canvas,
 * not children of it, so they are resolved from the view wrapper
 * (host.closest('.atlas-map-view')), never from the host itself.
 * Elements that are display:none (the phone stack on desktop, the
 * attribution while a sheet is open) report zero-area rects and are
 * treated as absent — the clamp must not avoid chrome that is not
 * on screen.
 */
export function measureChromeGeometry(host: HTMLElement): ChromeGeometry {
  // v0.30.0 correction: host is the Leaflet canvas itself
  // (MapView's hostRef — L.map(host) needs the canvas), and the
  // chrome overlays are its SIBLINGS inside .atlas-map-view, not
  // its children. Querying them from the canvas returned null for
  // the stack, the pill, the nav, the attribution, the note and the
  // county title — so the clamp silently stopped avoiding the pill
  // (caught by the geometry probe: zoomControls was null while the
  // pill was on screen). Resolve the view wrapper first, exactly
  // as the hero already resolves .map-workspace.
  const view = host.closest('.atlas-map-view') ?? host;
  const canvas =
    view.querySelector<HTMLElement>('.atlas-map-canvas') ?? host;
  const canvasRect = canvas.getBoundingClientRect();
  const workspace = host.closest('.map-workspace');
  const hero = workspace?.querySelector('.map-hero') ?? null;
  const prompt = workspace?.querySelector('.empty-map-prompt') ?? null;
  const bottomNav =
    typeof document !== 'undefined'
      ? document.querySelector('.bottom-nav')
      : null;

  const heroRect = isVisible(hero) ? toCanvasRect(hero, canvasRect) : null;
  const note = view.querySelector('.atlas-map-illustration-note');
  const noteRect = isVisible(note) ? toCanvasRect(note, canvasRect) : null;
  const title = view.querySelector('.county-map-title');
  const titleRect = isVisible(title) ? toCanvasRect(title, canvasRect) : null;
  const stack = view.querySelector('.atlas-edge-stack');
  const stackRect = isVisible(stack) ? toCanvasRect(stack, canvasRect) : null;
  const pill = view.querySelector('.atlas-edge-zoom');
  const pillRect = isVisible(pill) ? toCanvasRect(pill, canvasRect) : null;
  const nav = view.querySelector('.atlas-map-navigation');
  const navRect = isVisible(nav) ? toCanvasRect(nav, canvasRect) : null;
  const attribution = view.querySelector('.atlas-map-attribution');
  const attributionRect = isVisible(attribution)
    ? toCanvasRect(attribution, canvasRect)
    : null;
  const promptRect = isVisible(prompt) ? prompt.getBoundingClientRect() : null;
  const bottomNavRect = isVisible(bottomNav)
    ? bottomNav.getBoundingClientRect()
    : null;

  const topChromeBottom = Math.max(
    0,
    heroRect?.bottom ?? 0,
    noteRect?.bottom ?? 0,
    titleRect?.bottom ?? 0,
  );
  return {
    width: canvasRect.width,
    height: canvasRect.height,
    heroBottom: heroRect?.bottom ?? 0,
    topChromeBottom,
    topBand: topChromeBottom + TOP_PIN_CLEARANCE,
    edgeStack: stackRect,
    zoomControls: pillRect ?? navRect,
    attributionTop: attributionRect?.top ?? null,
    promptHeight: promptRect?.height ?? null,
    navHeight: bottomNavRect?.height ?? 0,
  };
}

/**
 * Watch every chrome element whose size can change (the hero wraps
 * to two chip rows on narrow phones, the prompt appears and
 * disappears, the stack/pill hide while a sheet is open) and call
 * onChange when any of them resizes. The marker render re-measures
 * on the next frame, so a chrome change moves the clamp without a
 * code edit — and without waiting for a map move. Returns a
 * disconnect function.
 */
export function observeChromeGeometry(
  host: HTMLElement,
  onChange: () => void,
): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  const observer = new ResizeObserver(() => onChange());
  // Same view-wrapper resolution as measureChromeGeometry: the
  // stack, pill, nav and attribution are siblings of the canvas
  // inside .atlas-map-view, not children of it.
  const view = host.closest('.atlas-map-view') ?? host;
  const workspace = host.closest('.map-workspace');
  const targets: (Element | null)[] = [
    host,
    workspace?.querySelector('.map-hero') ?? null,
    workspace?.querySelector('.empty-map-prompt') ?? null,
    view.querySelector('.atlas-edge-stack'),
    view.querySelector('.atlas-edge-zoom'),
    view.querySelector('.atlas-map-navigation'),
    view.querySelector('.atlas-map-attribution'),
    typeof document !== 'undefined'
      ? document.querySelector('.bottom-nav')
      : null,
  ];
  for (const target of targets) {
    if (target) observer.observe(target);
  }
  return () => observer.disconnect();
}

function rectsOverlap(
  box: { left: number; top: number; right: number; bottom: number },
  rect: ChromeRect,
): boolean {
  return (
    box.right > rect.left &&
    box.left < rect.right &&
    box.bottom > rect.top &&
    box.top < rect.bottom
  );
}

/**
 * The chrome clamp (v0.25.0, measured in v0.30.0): a marker is a
 * 48px square centred on its anchor, and the WHOLE box is tested,
 * not just its centre point (v0.26.1 — a pin whose centre cleared
 * the zoom pill still hung its bottom 11px behind it). A pin in any
 * chrome rect is not rendered at all; it comes back the moment the
 * camera moves it into the open band.
 */
export function markerBoxHidden(
  point: { x: number; y: number },
  half: number,
  geometry: ChromeGeometry,
): boolean {
  const box = {
    left: point.x - half,
    right: point.x + half,
    top: point.y - half,
    bottom: point.y + half,
  };
  if (box.top < geometry.topBand) return true;
  if (box.left < EDGE_CLEARANCE || box.right > geometry.width - EDGE_CLEARANCE)
    return true;
  if (geometry.edgeStack && rectsOverlap(box, geometry.edgeStack)) return true;
  if (geometry.zoomControls && rectsOverlap(box, geometry.zoomControls))
    return true;
  // Bottom strip: the attribution line when it is displayed, else
  // the fixed 40px strip (a place sheet covers the bottom then).
  const bottomLimit = Math.min(
    geometry.attributionTop ?? Number.POSITIVE_INFINITY,
    geometry.height - BOTTOM_STRIP,
  );
  if (box.bottom > bottomLimit) return true;
  return false;
}

export type LabelSide = 'left' | 'right' | 'none';

/**
 * Which way a pin's label runs, or 'none' when it fits nowhere.
 * A label runs right from its pin unless another pin sits just to
 * its right (v0.17.0), it would run off the screen edge, or it
 * would run into the right-edge chrome (edge stack / zoom controls,
 * v0.25.0). When it must run left but there is no room on the left
 * either, the label is skipped outright rather than cut off.
 */
export function decideLabelSide(
  pin: { x: number; y: number },
  labelWidth: number,
  geometry: ChromeGeometry,
  hasPinToTheRight: boolean,
  /** Distance from the pin centre to the label's near edge
   * (labelOffsetForPin) — the edge checks must use the rendered
   * clearance, or a ringed label is judged to fit where it is
   * actually cut off. Defaults to the old 10px for direct callers. */
  clearance = 10,
): LabelSide {
  const rightEdge = pin.x + clearance + labelWidth;
  const rightChrome = [geometry.edgeStack, geometry.zoomControls].filter(
    (rect): rect is ChromeRect => rect !== null,
  );
  const rightHitsChrome = rightChrome.some(
    (rect) =>
      rightEdge > rect.left && pin.y >= rect.top && pin.y <= rect.bottom,
  );
  const labelLeft =
    hasPinToTheRight || rightEdge > geometry.width - 8 || rightHitsChrome;
  if (!labelLeft) return 'right';
  if (pin.x - clearance - labelWidth < 8) return 'none';
  return 'left';
}

/**
 * Fit framing for fitBounds (v0.23.0, measured in v0.30.0): the
 * island fits into the VISIBLE band — below the hero, above the
 * bottom nav (or the taller empty-map prompt while it is up).
 * Returns the top/bottom padding in canvas px; the caller turns
 * them into Leaflet points (12px on the sides, as before).
 */
export function fitPaddingFor(
  geometry: ChromeGeometry,
  promptVisible: boolean,
): { top: number; bottom: number } {
  const top = geometry.heroBottom + FIT_TOP_MARGIN;
  const bottom =
    promptVisible && geometry.promptHeight !== null
      ? geometry.promptHeight + FIT_BOTTOM_MARGIN_PROMPT
      : (geometry.navHeight || 73) + FIT_BOTTOM_MARGIN;
  return { top, bottom };
}
