import { GTADB_TILE_BOUNDS } from './gtadb-tiles';
import type { MapBounds } from './coordinates';

/**
 * The animated sea (After Hours, v0.15.0) — a lightweight canvas overlay,
 * not an animated tile layer. The water mask is traced from the real day
 * tiles by scripts/dissect-map.py (same water rule as the 3D explorer),
 * so the shimmer only ever falls on water. Two slow diagonal light bands
 * plus one drifting glow, all faint (the tiles' own water shading does
 * the heavy lifting); the frame is throttled to ~8fps and the loop stops
 * entirely when the tab is hidden or reduced motion is on.
 *
 * Honest limit: this is a shimmer on the water regions, not a new ocean
 * simulation — a full animated tile layer would cost a phone its battery
 * for a subtle effect, and the tiles themselves already draw the sea.
 */

export const SEA_MASK_BOUNDS: MapBounds = GTADB_TILE_BOUNDS;

export function seaMaskUrl(base: string = import.meta.env.BASE_URL ?? '/'): string {
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}assets/after-hours/sea-mask.png`;
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

/** One shimmer frame: the mask, then light drifting across the water only. */
export function drawSeaFrame(
  ctx: CanvasRenderingContext2D,
  mask: HTMLImageElement,
  rect: MaskRect,
  phaseSeconds: number,
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  if (rect.width <= 0 || rect.height <= 0) return;
  ctx.drawImage(mask, rect.x, rect.y, rect.width, rect.height);
  // Everything after this only lands where the mask is opaque (water).
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
  band(0, 0.07);
  band(500, 0.05);
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
  glow.addColorStop(0, 'rgba(255,240,220,0.05)');
  glow.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.globalCompositeOperation = 'source-over';
}
