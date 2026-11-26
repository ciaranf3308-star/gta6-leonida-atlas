/**
 * Progress tab (v0.32 step 5) — the 100% completion panel, re-homed
 * out of the old Layers sheet, plus the per-layer found / explored
 * rows that used to live in Saved (the old library view).
 *
 * Tapping a layer row turns that layer on, shows only the places in
 * it you have not found yet, and opens Find — the chase for the last
 * ones starts there.
 */
import type { CSSProperties } from 'react';
import { useMapStore, useUiStore } from '../../stores/atlas';
import { CompletionPanel } from './CompletionPanel';
import type { LayerProgress } from '../../app/Sidebar';

export function ProgressPanel({ progress }: { progress: LayerProgress[] }) {
  return (
    <div className="progress-view">
      <CompletionPanel />
      <div className="section-label">Progress by layer</div>
      <p className="empty-state">
        Mark places as found or explored from their details. Turn a layer on, then use
        “Only places I haven’t found” to chase the last ones.
      </p>
      {progress
        .filter((row) => row.total > 0)
        .map((row) => {
          const percent = row.total ? Math.round((row.found / row.total) * 100) : 0;
          return (
            <button
              className="library-row"
              key={row.layerId}
              onClick={() => {
                useMapStore.getState().setLayers(
                  useMapStore
                    .getState()
                    .layers.map((layer) =>
                      layer.id === row.layerId ? { ...layer, visible: true } : layer,
                    ),
                );
                useUiStore.getState().resetFilters();
                useUiStore
                  .getState()
                  .setFilters({ remainingOnly: true, collectionId: null });
                useUiStore.getState().setFindOpen(true);
              }}
            >
              <span className="progress-name">
                {row.name}
                <small>
                  {row.found} of {row.total} found · {row.explored} explored · {percent}%
                </small>
              </span>
              <span className="progress-wrap" aria-hidden="true">
                <span
                  className="progress-bar"
                  style={{ '--progress': `${percent}%` } as CSSProperties}
                />
              </span>
            </button>
          );
        })}
    </div>
  );
}
