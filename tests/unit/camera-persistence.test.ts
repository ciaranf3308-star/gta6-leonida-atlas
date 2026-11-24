import { describe, expect, it } from 'vitest';
import { shouldResumeCamera } from '../../src/features/map/camera-persistence';

// The whole-map fit on a 390px phone: INITIAL_BOUNDS centre
// (-3350, 600), fit zoom about -5.3 (below the -5 min zoom).
const FIT_ZOOM = -5.3;
const FIT_CENTER = { x: -3350, y: 600 };

describe('shouldResumeCamera (v0.17.0)', () => {
  it('resumes a camera that is already on the whole map', () => {
    expect(
      shouldResumeCamera({ center: { x: -3350, y: 600 }, zoom: -5 }, FIT_ZOOM, FIT_CENTER),
    ).toBe(true);
  });

  it('ignores the zoomed-in Vice City camera from his 4:28pm screenshot', () => {
    // Saved camera: zoomed into the shops, land cut off, empty sea left.
    expect(
      shouldResumeCamera({ center: { x: 800, y: -800 }, zoom: -2 }, FIT_ZOOM, FIT_CENTER),
    ).toBe(false);
  });

  it('ignores a camera panned far away even at whole-map zoom', () => {
    expect(
      shouldResumeCamera({ center: { x: 4000, y: -6000 }, zoom: -5 }, FIT_ZOOM, FIT_CENTER),
    ).toBe(false);
  });

  it('ignores a camera zoomed in even when centred on Leonida', () => {
    expect(
      shouldResumeCamera({ center: { x: -3350, y: 600 }, zoom: -1 }, FIT_ZOOM, FIT_CENTER),
    ).toBe(false);
  });

  it('allows a near-fit camera (half a zoom step of slack for rounding)', () => {
    expect(
      shouldResumeCamera({ center: { x: -3000, y: 500 }, zoom: -4.9 }, FIT_ZOOM, FIT_CENTER),
    ).toBe(true);
  });
});
