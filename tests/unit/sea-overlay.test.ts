import { describe, expect, it, vi } from 'vitest';
import { drawSeaFrame, maskDrawRect, SEA_MASK_BOUNDS } from '../../src/features/map/sea-overlay';

function fakeCtx() {
  const gradient = { addColorStop: vi.fn() };
  const compositeOps: string[] = [];
  return {
    ctx: {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
      createRadialGradient: vi.fn(() => gradient),
      fillRect: vi.fn(),
      save: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      restore: vi.fn(),
      set globalCompositeOperation(value: string) {
        compositeOps.push(value);
      },
      get globalCompositeOperation() {
        return compositeOps[compositeOps.length - 1] ?? 'source-over';
      },
    } as unknown as CanvasRenderingContext2D,
    compositeOps,
  };
}

describe('animated sea overlay', () => {
  it('covers the full tile bounds, not just the land', () => {
    expect(SEA_MASK_BOUNDS).toEqual({ west: -16384, east: 8192, south: -16384, north: 16384 });
  });

  it('maps the mask corners through the map projector', () => {
    // Identity-ish projector: 1 canonical unit = 0.05 container px, origin at (400, 300).
    const rect = maskDrawRect((lat, lng) => ({ x: 400 + lng * 0.05, y: 300 - lat * 0.05 }));
    expect(rect.x).toBeCloseTo(400 + -16384 * 0.05);
    expect(rect.y).toBeCloseTo(300 - 16384 * 0.05);
    expect(rect.width).toBeCloseTo((8192 - -16384) * 0.05);
    expect(rect.height).toBeCloseTo((16384 - -16384) * 0.05);
  });

  it('draws the mask then light only where the mask is (source-atop)', () => {
    const { ctx } = fakeCtx();
    const mask = {} as HTMLImageElement;
    drawSeaFrame(ctx, mask, { x: 10, y: 20, width: 300, height: 400 }, 5, 390, 844);
    expect(ctx.drawImage).toHaveBeenCalledWith(mask, 10, 20, 300, 400);
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('grades the sea deep teal before the light bands (v0.16.0)', () => {
    const { ctx } = fakeCtx();
    const mask = {} as HTMLImageElement;
    drawSeaFrame(ctx, mask, { x: 0, y: 0, width: 300, height: 400 }, 5, 390, 844);
    // First linear gradient is the vertical deep-teal grade over the
    // whole water rect; the bands come after it.
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 0, 400);
  });

  it('grades with source-in so the grade replaces the stencil white (v0.16.0)', () => {
    // The v0.15.0 bug: the grade was drawn source-atop over the white
    // mask, so the sea stayed pale. source-in replaces the white with
    // dark teal; the bands then layer on with source-atop.
    const { ctx, compositeOps } = fakeCtx();
    const mask = {} as HTMLImageElement;
    drawSeaFrame(ctx, mask, { x: 0, y: 0, width: 300, height: 400 }, 5, 390, 844);
    expect(compositeOps[0]).toBe('source-in');
    expect(compositeOps).toContain('source-atop');
    expect(compositeOps[compositeOps.length - 1]).toBe('source-over');
  });

  it('does nothing visible when the mask is off-screen', () => {
    const { ctx } = fakeCtx();
    const mask = {} as HTMLImageElement;
    drawSeaFrame(ctx, mask, { x: 0, y: 0, width: 0, height: 0 }, 5, 390, 844);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
