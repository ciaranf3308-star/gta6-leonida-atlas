import { GTADB_TILE_BOUNDS } from './gtadb-tiles';
import type { MapBounds } from './coordinates';

/**
 * The animated sea (After Hours, v0.15.0, graded v0.16.0) — a
 * lightweight canvas overlay, not an animated tile layer. The water
 * mask is traced from the real day tiles by scripts/dissect-map.py
 * (same water rule as the 3D explorer), so the grade only ever falls
 * on water. v0.15.0's shimmer was honest but invisible on a phone
 * screenshot (5–7% white): v0.16.0 grades the sea properly — a deep
 * teal wash over the flat light-blue tiles, stronger drifting light
 * bands, and slow cloud shadows crossing the water — so the sea reads
 * like the reference: deep, alive, dark at the edges. The frame is
 * still throttled to ~8fps and the loop stops entirely when the tab
 * is hidden or reduced motion is on, so the grade costs nothing
 * per-frame beyond one canvas redraw a few times a second.
 *
 * Honest limit: this is a grade + shimmer on the water regions, not
 * a new ocean simulation — a full animated tile layer would cost a
 * phone its battery for a subtle effect, and the tiles themselves
 * already draw the sea.
 */

export const SEA_MASK_BOUNDS: MapBounds = GTADB_TILE_BOUNDS;

export function seaMaskUrl(base: string = import.meta.env.BASE_URL ?? '/'): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}assets/after-hours/sea-mask.png`;
}

/**
 * The mask PNG is grayscale with NO alpha channel (mode L: 255 =
 * water, 0 = land), so drawing it straight onto the sea canvas paints
 * an opaque white veil over the water and an opaque black veil over
 * the land — that was the v0.15.0 bug: the sea read as flat pale blue
 * because the grade was composited over white, and the land was
 * darkened for free. The stencil keeps the mask's luminance as ALPHA
 * (white, alpha = water) so the grade below replaces it instead of
 * tinting it. Built once when the mask loads; the per-frame draw only
 * ever touches the stencil.
 */
export function buildSeaStencil(mask: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = mask.naturalWidth || mask.width;
  canvas.height = mask.naturalHeight || mask.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(mask, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const luminance = px[i] ?? 0;
    px[i] = 255;
    px[i + 1] = 255;
    px[i + 2] = 255;
    px[i + 3] = luminance;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

export interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Container rect of the mask image for the current map view. */
export function maskDrawRect(
  project: (lat: number, lng: number) => { x: number; y: number },
): MaskRect {
  const nw = project(SEA_MASK_BOUNDS.north, SEA_MASK_BOUNDS.west);
  const se = project(SEA_MASK_BOUNDS.south, SEA_MASK_BOUNDS.east);
  return { x: nw.x, y: nw.y, width: se.x - nw.x, height: se.y - nw.y };
}

/** One sea frame: deep-teal grade, then light and cloud shadows drifting across the water only.
 * Takes the STENCIL (see buildSeaStencil), never the raw mask: the
 * grade is drawn with source-in, so it REPLACES the stencil's white
 * with dark teal at the mask's alpha — water goes deep teal, land
 * stays untouched. Bands and shadows then layer on top with
 * source-atop. */
export function drawSeaFrame(
  ctx: CanvasRenderingContext2D,
  mask: HTMLImageElement | HTMLCanvasElement,
  rect: MaskRect,
  phaseSeconds: number,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  if (rect.width <= 0 || rect.height <= 0) return;
  ctx.drawImage(mask, rect.x, rect.y, rect.width, rect.height);
  // Grade FIRST, with source-in: dark teal replaces the stencil white
  // exactly where the water is, at the grade's own alpha — the tiles'
  // blue shows through underneath, so the sea goes deep, not black.
  ctx.globalCompositeOperation = 'source-in';
  const grade = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
  grade.addColorStop(0, 'rgba(4,32,46,0.62)');
  grade.addColorStop(0.55, 'rgba(6,48,66,0.52)');
  grade.addColorStop(1, 'rgba(9,66,86,0.45)');
  ctx.fillStyle = grade;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  // Everything after this only lands where the grade is (water).
  ctx.globalCompositeOperation = 'source-atop';
  const band = (offset: number, alpha: number) => {
    const travel = rect.width + 400;
    const x = rect.x + (((phaseSeconds * 14 + offset) % travel) + travel) % travel - 200;
    const grad = ctx.createLinearGradient(x, rect.y, x + 220, rect.y + rect.height);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  };
  band(0, 0.16);
  band(500, 0.11);
  // Slow cloud shadows crossing the water — soft dark ellipses, one
  // slow pass a minute, so the sea moves without flashing.
  for (let i = 0; i < 3; i++) {
    const span = rect.width + 600;
    const cx =
      rect.x +
      (((phaseSeconds * 6 + i * 420) % span) + span) % span -
      300;
    const cy = rect.y + rect.height * (0.22 + 0.28 * i);
    const rx = rect.width * 0.28;
    const ry = rect.height * 0.09;
    const shadow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
    shadow.addColorStop(0, 'rgba(2,18,28,0.16)');
    shadow.addColorStop(1, 'rgba(2,18,28,0)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = shadow;
    ctx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
    ctx.restore();
  }
  const gx = rect.x + rect.width * (0.5 + 0.3 * Math.sin(phaseSeconds * 0.05));
  const gy = rect.y + rect.height * (0.5 + 0.25 * Math.cos(phaseSeconds * 0.04));
  const glow = ctx.createRadialGradient(
    gx,
    gy,
    0,
    gx,
    gy,
    Math.max(rect.width, rect.height) * 0.45,
  );
  glow.addColorStop(0, 'rgba(255,240,220,0.07)');
  glow.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.globalCompositeOperation = 'source-over';
}
