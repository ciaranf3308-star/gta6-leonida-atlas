import { describe, expect, it } from 'vitest';
import { useMapStore } from '../../src/stores/atlas';

/** setFocus — the sheet-close recenter (v0.30.0). The focus had
 * centred the place above the sheet, so after the sheet closes the
 * pin sits under the top chrome and the pin clamp hides it while the
 * highlight is still there. setFocus re-flies the camera to the
 * centre of the visible band WITHOUT selecting anything, so the
 * reveal stays on screen. These tests pin the store contract the
 * App deselect-recenter effect relies on. */
describe('map store setFocus (sheet-close recenter)', () => {
  it('moves the camera focus without selecting anything or touching highlights', () => {
    useMapStore.setState({ selectedId: null, focus: null, highlightIds: ['L2227'] });
    useMapStore.getState().setFocus({ x: -629, y: -164 });
    const s = useMapStore.getState();
    expect(s.selectedId).toBeNull();
    expect(s.highlightIds).toEqual(['L2227']);
    expect(s.focus?.position).toEqual({ x: -629, y: -164 });
    expect(s.focus?.requestId).toBeGreaterThan(0);
  });

  it('bumps requestId on every call so the MapView focus effect re-runs', () => {
    useMapStore.setState({ focus: null });
    useMapStore.getState().setFocus({ x: 0, y: 0 });
    const first = useMapStore.getState().focus?.requestId;
    useMapStore.getState().setFocus({ x: 1, y: 1 });
    expect(useMapStore.getState().focus?.requestId).toBe((first ?? 0) + 1);
    expect(useMapStore.getState().focus?.position).toEqual({ x: 1, y: 1 });
  });

  it('clears the focus with null', () => {
    useMapStore.setState({ focus: { position: { x: 1, y: 1 }, requestId: 3 } });
    useMapStore.getState().setFocus(null);
    expect(useMapStore.getState().focus).toBeNull();
  });

  it('select(null) clears focus but never touches highlights — the recenter must come from setFocus, not select', () => {
    useMapStore.setState({
      selectedId: 'L2227',
      focus: { position: { x: 1, y: 1 }, requestId: 1 },
      highlightIds: ['L2227'],
    });
    useMapStore.getState().select(null);
    expect(useMapStore.getState().selectedId).toBeNull();
    expect(useMapStore.getState().focus).toBeNull();
    expect(useMapStore.getState().highlightIds).toEqual(['L2227']);
  });
});
