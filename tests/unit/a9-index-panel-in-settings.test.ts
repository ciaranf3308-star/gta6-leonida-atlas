import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Place } from '../../src/domain/types';
import SettingsDialog from '../../src/features/library/SettingsDialog';

/**
 * v0.33 D-1 — the index job's home is Settings. v0.32 step 5 took
 * "Sort the unnamed places" out of the primary experience and no lane
 * re-mounted it, so the typing route §A9.3 depends on was unreachable
 * in the app even though the component, the store and the backup all
 * still worked. This test renders Settings and proves the panel is
 * mounted there and still lists the unnamed queue.
 */
const place = (id: string, title: string): Place => ({
  id,
  title,
  description: '',
  category: 'exploration',
  position: { x: 0, y: 0 },
  layerId: 'community',
  tags: [],
  region: '',
  source: { title: 'Test', url: '' },
  evidence: 'approximate',
});

describe('index job lives in Settings (v0.33 D-1)', () => {
  it('Settings mounts "Sort the unnamed places" and it lists the unnamed queue', () => {
    const places = [
      place('L1', '?, Downtown, Vice City'),
      place('L2', '?'),
      place('L3', 'NINE1NINE, Downtown, Vice City'),
    ];
    const html = renderToStaticMarkup(
      createElement(SettingsDialog, {
        onClose: () => {},
        places,
        offline: false,
      }),
    );
    expect(html).toContain('Sort the unnamed places');
    // 2 of the 3 places are still "?" — the queue the job sorts.
    expect(html).toContain('0 of 2 indexed');
    expect(html).toContain('To go');
    // No key on this device: the panel says so and points at the key
    // field above it instead of opening Settings again.
    expect(html).toContain('Indexing needs your OpenAI key');
    expect(html).toContain('Add your key');
    // The key section itself is still right above the panel.
    expect(html).toContain('Ask Nylah (AI)');
  });
});
