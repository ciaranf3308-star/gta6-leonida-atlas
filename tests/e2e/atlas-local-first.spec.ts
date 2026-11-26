import { readFile } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import type { Backup } from '../../src/domain/types';

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Atlas panel' });
const details = (page: Page) => page.getByRole('complementary', { name: 'Place details' });
const search = (page: Page) =>
  page.getByRole('searchbox', { name: 'Search places, regions, tags' });

// Headless WPE WebKit stops producing compositor frames once this
// page settles: on the mounted app rAF fires ~0-4 times in 9s (vs
// 186 on a blank page, 185-186 on the same page with the bundle
// unmounted, with Leaflet alone, or with the JS bundle blocked;
// the service worker is exonerated too). The main thread is idle
// (zero longtasks), the targets are pixel-stable (one distinct
// bounding box over 50 samples at 4-decimal precision), timers run,
// and force clicks land — so this is the headless compositor going
// quiet on a settled full-viewport page, not a moving or covered
// control and not an app busy-loop. Playwright's normal click waits
// on rAF-driven stability polling, so it hangs 30s on a button that
// is visible, enabled, stable and uncovered (reproduced locally).
// Chromium's rAF is degraded on this page too (33/3s) but still
// enough for its checks, which is why Chromium is green. A force
// click dispatches the same event at the same coordinates; the state
// assertions after each click (checked, visible, saved, backup
// contents) still catch a covered or missing control. WebKit only —
// Chromium keeps the strict actionability gates. See
// hidden_files/v032-ci/DIAGNOSIS.md for the probe evidence.
function isWebkit(page: Page): boolean {
  return page.context().browser()?.browserType().name() === 'webkit';
}

async function tap(page: Page, locator: Locator): Promise<void> {
  if (isWebkit(page)) await locator.click({ force: true });
  else await locator.click();
}

async function dismissPlaceSheet(page: Page): Promise<void> {
  // v0.26.0: first open shows the Vice City region sheet ("Pick what
  // to see") on top of the panel controls — on phones it covers the
  // Layers checkboxes entirely, on desktop it covers "Enter
  // coordinates". A player taps ×; the spec does the same before
  // touching any panel chrome, so a standing sheet never blocks a
  // click the test means to land on a panel control.
  const close = page.getByRole('button', { name: 'Close place details', exact: true });
  if (await close.isVisible()) {
    await tap(page, close);
    await expect(details(page)).not.toBeVisible();
  }
}

async function dismissSheetAfterReload(page: Page): Promise<void> {
  // A reload remounts the app, resetting firstOpenDismissed and
  // firstOpenFired: the Vice City first-open sheet fires ~1s after
  // load (once persistence is ready), so a test that interacts
  // immediately after reload races it — the sheet opens over the
  // panel mid-interaction and swallows the click (local full-suite
  // run: :304's Named-regions check, :348's marker-row tap). Wait
  // for it to appear, then close it; it fires at most once per
  // mount, so once closed it stays closed. If it never appears
  // (layers already restored visible), there is nothing to do.
  const sheet = details(page);
  const appeared = await sheet
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (appeared) await dismissPlaceSheet(page);
  await expect(sheet).not.toBeVisible();
}

async function openPanel(
  page: Page,
  tab: 'find' | 'layers' | 'saved' | 'ask',
): Promise<void> {
  await dismissPlaceSheet(page);
  // One place to go: the labelled bottom-nav tabs open the panel.
  const label = tab === 'find' ? 'Find' : tab === 'layers' ? 'Layers' : tab === 'saved' ? 'Saved' : 'Ask';
  await tap(page, page.locator('.bottom-nav').getByRole('button', { name: label }));
  await expect(sidebar(page)).toBeVisible();
}

async function expectTilesLoaded(page: Page): Promise<void> {
  // Graded tiles: at least one loaded tile from the bundled set.
  const tile = page.locator('.leaflet-tile-loaded[src*="tiles/graded/"]').first();
  await expect(tile).toBeVisible();
  await expect(tile).toHaveJSProperty('complete', true);
  expect(
    await tile.evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
}

async function dismissWelcome(page: Page): Promise<void> {
  // Tests that navigate directly (no openAtlas) still land on the first-
  // launch onboarding dialog, which blocks the nav underneath until an
  // explicit choice is made. The onboarding mounts once persistence has
  // loaded, which can lag the map by a second or two — a single isVisible
  // snapshot races it, so wait for it to appear before deciding there
  // is nothing to skip.
  const welcome = page.getByRole('dialog', { name: 'Welcome to Leonida' });
  const appeared = await welcome
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  if (!appeared) return;
  // Forced onboarding (v0.11.0): there is no × and Escape does nothing —
  // "Skip for now" is the explicit way out. Force-click: in headless
  // WebKit a normal click inside a showModal top-layer dialog never
  // completes its actionability checks (the button is visible, stable
  // and the hit target — a force click works — but the plain click
  // hangs).
  await welcome.getByRole('button', { name: /^Skip for now/ }).click({ force: true });
  await expect(welcome).not.toBeVisible();
}

async function openAtlas(page: Page): Promise<void> {
  await page.goto('');
  await expect(page).toHaveTitle(/ViceWire/);
  await expect(
    page.getByRole('region', { name: 'Leonida interactive map', exact: true }),
  ).toBeVisible();
  await expectTilesLoaded(page);
  // First launch shows the forced onboarding as a modal dialog — it blocks
  // the bottom nav underneath until an explicit choice (Start or Skip).
  await dismissWelcome(page);
  // First launch also shows the Vice City region sheet once the dialog
  // is gone — dismiss it too, or it sits on top of the panel chrome
  // (see dismissPlaceSheet) for the rest of the test.
  await dismissPlaceSheet(page);
  // v0.12.0: the map is clean — a wordmark and one search pill, no
  // filter bar, no floating Add button (Add lives in Layers now).
  await expect(page.locator('.map-hero-banner')).toBeVisible();
  await expect(page.locator('.map-search-pill')).toBeVisible();
  await expect(page.locator('.filter-bar')).toHaveCount(0);
}

async function enableLayer(page: Page, name: string): Promise<void> {
  await openPanel(page, 'layers');
  // The sheet can fire late (after a reload it appears ~1s after load,
  // mid-interaction) and cover the checkbox — dismiss it immediately
  // before touching the checkbox, not just when the panel opens. (An
  // earlier fail-fast visibility assertion here backfired: on desktop
  // Chromium the sheet is legitimately visible without covering the
  // sidebar checkboxes, so it broke tests that would otherwise pass.)
  await dismissPlaceSheet(page);
  const checkbox = page.getByRole('checkbox', { name: new RegExp(`^${name}`) });
  if (!(await checkbox.isChecked()))
    await checkbox.check(isWebkit(page) ? { force: true } : {});
}

async function selectRegion(page: Page, name = 'Ambrosia'): Promise<void> {
  // Spoiler-free defaults start with every public layer off.
  await enableLayer(page, 'Named regions');
  await openPanel(page, 'find');
  await page.getByLabel('Show one kind of place').selectOption('exploration');
  await search(page).fill(name);
  // The region row is the one whose title AND area are both the name
  // ("Ambrosia Ambrosia · Nearby") — a plain /^Ambrosia/ also matches
  // the community places in Ambrosia (L832 Police Department, L3788
  // Fire District), which the exploration Kind turns on since v0.31.3,
  // so the click violates strict mode with 3 elements. The distance
  // word varies ("Nearby" vs "Close by") and may be absent, hence the
  // "( · |$)" tail.
  const regionRow = page
    .locator('.place-results')
    .getByRole('button', { name: new RegExp(`^${name} ${name}( · |$)`) });
  await tap(page, regionRow);
  await expect(details(page).getByRole('heading', { name, exact: true })).toBeVisible();
}

async function createCollection(page: Page, name: string): Promise<void> {
  await openPanel(page, 'saved');
  await page.getByLabel('Collection name', { exact: true }).fill(name);
  await tap(page, page.getByRole('button', { name: 'Create collection', exact: true }));
  await expect(page.getByRole('button', { name: `Rename ${name}`, exact: true })).toBeVisible();
}

async function createMarker(page: Page, title: string): Promise<void> {
  if (await page.getByRole('button', { name: 'Close panel', exact: true }).isVisible()) {
    await tap(page, page.getByRole('button', { name: 'Close panel', exact: true }));
  }
  await openPanel(page, 'layers');
  await tap(page, page.getByRole('button', { name: /^Add marker/ }));
  await tap(page, page.getByRole('button', { name: 'Enter coordinates', exact: true }));
  const editor = page.getByRole('dialog', { name: 'New marker', exact: true });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Title', { exact: true }).fill(title);
  await editor.getByLabel('Description', { exact: true }).fill('A private map annotation');
  await editor.getByLabel('Game X', { exact: true }).fill('-1200');
  await editor.getByLabel('Game Y', { exact: true }).fill('900');
  await editor.getByLabel('Icon', { exact: true }).selectOption('flag');
  await tap(page, editor.getByRole('button', { name: 'Save marker', exact: true }));
  await expect(editor).not.toBeVisible();
  await expect(details(page).getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function openBackup(page: Page): Promise<void> {
  if (await page.getByRole('dialog', { name: 'Your local backup', exact: true }).isVisible())
    return;
  if (await details(page).isVisible()) {
    await tap(page, page.getByRole('button', { name: 'Close place details', exact: true }));
  }
  await openPanel(page, 'find');
  // Backup moved into the Settings dialog (v0.12.0 redesign): Find no
  // longer carries a Backup button.
  await tap(page, sidebar(page).getByRole('button', { name: 'Settings', exact: true }));
  await tap(page, page.getByRole('button', { name: 'Backup', exact: true }));
  await expect(page.getByRole('dialog', { name: 'Your local backup', exact: true })).toBeVisible();
}

async function exportBackup(page: Page, testInfo: TestInfo, label: string): Promise<Backup> {
  await openBackup(page);
  const downloading = page.waitForEvent('download');
  await tap(page, page.getByRole('button', { name: 'Export backup', exact: true }));
  const download = await downloading;
  const path = testInfo.outputPath(`backup-${label}.json`);
  await download.saveAs(path);
  return JSON.parse(await readFile(path, 'utf8')) as Backup;
}

function savedData(backup: Backup) {
  return {
    favorites: backup.favorites,
    notes: backup.notes,
    markers: backup.markers,
    collections: backup.collections,
    preferences: backup.preferences,
  };
}

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus) {
    const name = testInfo.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 90);
    await page.screenshot({
      path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-${name}-failed.png`),
      fullPage: true,
    });
  }
});

test('the map opens without an account, filters public evidence, and toggles visible layers', async ({
  page,
}, testInfo) => {
  const runtimeErrors: string[] = [];
  const consoleErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !== new URL(testInfo.project.use.baseURL!).origin
    ) {
      externalRequests.push(request.url());
    }
  });
  await openAtlas(page);
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-initial-map.png`),
    fullPage: true,
  });
  await openPanel(page, 'find');
  await expect(
    sidebar(page).getByRole('heading', { name: 'ViceWire', exact: true }),
  ).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  // Spoiler-free defaults start with every public layer off; opt in before
  // asserting on search results.
  await enableLayer(page, 'Named regions');
  await enableLayer(page, 'Community places');
  await enableLayer(page, 'Unverified places');
  await openPanel(page, 'find');
  await page.getByLabel('Show one kind of place').selectOption('exploration');
  // v0.14.0 minimal cards: no evidence/category line on the card face,
  // so the first region-kind result is identified by its title — Vice City
  // sorts first from the default centre.
  await expect(page.locator('.place-results .place-result').first()).toContainText(
    'Vice City',
  );
  // 'My markers' has no places yet in a fresh profile, so it is the
  // category that yields no results with these layers on.
  await page.getByLabel('Show one kind of place').selectOption('my-markers');
  await expect(page.getByText('No places match these filters.', { exact: false })).toBeVisible();
  await page.getByLabel('Show one kind of place').selectOption('all');
  // The list repopulates — regions sort first now, so assert on the list
  // being back rather than on which kind of place is first.
  await expect(page.locator('.place-results .place-result').first()).toBeVisible();
  await tap(page, page.getByRole('button', { name: 'Clear all', exact: true }));
  await selectRegion(page);
  await tap(page, page.getByRole('button', { name: 'Close place details', exact: true }));
  await openPanel(page, 'layers');
  // Only the region pin should be in view for the count assertions below.
  const communityLayer = page.getByRole('checkbox', { name: /^Community places/ });
  if (await communityLayer.isChecked())
    await communityLayer.uncheck(isWebkit(page) ? { force: true } : {});
  const uncertainLayer = page.getByRole('checkbox', { name: /^Unverified places/ });
  if (await uncertainLayer.isChecked())
    await uncertainLayer.uncheck(isWebkit(page) ? { force: true } : {});
  const regionLayer = page.getByRole('checkbox', { name: /^Named regions/ });
  await expect(regionLayer).toBeChecked();
  await regionLayer.uncheck(isWebkit(page) ? { force: true } : {});
  await expect(regionLayer).not.toBeChecked();
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-layers.png`),
    fullPage: true,
  });
  // One count, in Find — v0.12.0 has no filter bar on the map at
  // all, so the count lives in the Find screen.
  await openPanel(page, 'find');
  await expect(page.locator('.find-count')).toContainText('0 places showing');
  await openPanel(page, 'layers');
  await page.getByRole('checkbox', { name: /^Named regions/ }).check(isWebkit(page) ? { force: true } : {});
  await openPanel(page, 'find');
  await expect(page.locator('.find-count')).toContainText('1 place showing');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('a renamed collection, favorite and note survive a browser reload', async ({
  page,
}, testInfo) => {
  await openAtlas(page);
  await createCollection(page, 'Weekend route');
  await tap(page, page.getByRole('button', { name: 'Rename Weekend route', exact: true }));
  await page.getByLabel('Collection name', { exact: true }).fill('Sunset route');
  await tap(page, page.getByRole('button', { name: 'Save collection name', exact: true }));
  await expect(
    page.getByRole('button', { name: 'Rename Sunset route', exact: true }),
  ).toBeVisible();
  await selectRegion(page);
  await tap(page, details(page).getByRole('button', { name: 'Add to favorites', exact: true }));
  await expect(
    details(page).getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  await details(page)
    .getByLabel('Notes', { exact: true })
    .fill('Return to Ambrosia before sunset.');
  await tap(page, details(page).getByRole('button', { name: 'Save note', exact: true }));
  await expect(details(page).getByRole('button', { name: 'Note saved', exact: true })).toBeVisible();
  await details(page)
    .getByLabel('Add to collection', { exact: true })
    .selectOption({ label: 'Sunset route' });
  await expect(
    details(page).getByRole('button', { name: 'Remove from Sunset route', exact: true }),
  ).toBeVisible();
  await page.reload();
  await dismissSheetAfterReload(page);
  await selectRegion(page);
  await expect(
    details(page).getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  await expect(details(page).getByLabel('Notes', { exact: true })).toHaveValue(
    'Return to Ambrosia before sunset.',
  );
  await expect(
    details(page).getByRole('button', { name: 'Remove from Sunset route', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-saved-place.png`),
    fullPage: true,
  });
});

test('a personal marker can be edited, moved and deleted with its saved references', async ({
  page,
}, testInfo) => {
  await openAtlas(page);
  await createCollection(page, 'Personal trip');
  await createMarker(page, 'Quiet beach');
  await tap(page, details(page).getByRole('button', { name: 'Add to favorites', exact: true }));
  await expect(
    details(page).getByRole('button', { name: 'Remove from favorites', exact: true }),
  ).toBeVisible();
  await details(page)
    .getByLabel('Notes', { exact: true })
    .fill('A private note to remove with this marker.');
  await tap(page, details(page).getByRole('button', { name: 'Save note', exact: true }));
  await expect(details(page).getByRole('button', { name: 'Note saved', exact: true })).toBeVisible();
  await details(page)
    .getByLabel('Add to collection', { exact: true })
    .selectOption({ label: 'Personal trip' });
  await expect(
    details(page).getByRole('button', { name: 'Remove from Personal trip', exact: true }),
  ).toBeVisible();
  await tap(page, details(page).getByRole('button', { name: 'Edit marker', exact: true }));
  let editor = page.getByRole('dialog', { name: 'Edit my marker', exact: true });
  await editor.getByLabel('Title', { exact: true }).fill('Quiet beach overlook');
  await tap(page, editor.getByRole('button', { name: 'Save marker', exact: true }));
  await expect(
    details(page).getByRole('heading', { name: 'Quiet beach overlook', exact: true }),
  ).toBeVisible();
  await tap(page, details(page).getByRole('button', { name: 'Move', exact: true }));
  await tap(page, page.getByRole('button', { name: 'Enter coordinates', exact: true }));
  editor = page.getByRole('dialog', { name: 'Edit my marker', exact: true });
  await editor.getByLabel('Game X', { exact: true }).fill('-1000');
  await editor.getByLabel('Game Y', { exact: true }).fill('1200');
  await tap(page, editor.getByRole('button', { name: 'Save marker', exact: true }));
  // v0.21.0: the card no longer prints raw game coordinates (cut as a
  // redundant line), so the moved position is proven by reopening the
  // editor and reading the fields back.
  await tap(page, details(page).getByRole('button', { name: 'Edit marker', exact: true }));
  editor = page.getByRole('dialog', { name: 'Edit my marker', exact: true });
  await expect(editor.getByLabel('Game X', { exact: true })).toHaveValue('-1000');
  await expect(editor.getByLabel('Game Y', { exact: true })).toHaveValue('1200');
  await tap(page, editor.getByRole('button', { name: 'Cancel', exact: true }));
  await page.reload();
  await dismissSheetAfterReload(page);
  await openPanel(page, 'find');
  await search(page).fill('Quiet beach overlook');
  await tap(page, page.locator('.place-results').getByRole('button', { name: /^Quiet beach overlook My marker/ }));
  await tap(page, details(page).getByRole('button', { name: 'Edit marker', exact: true }));
  editor = page.getByRole('dialog', { name: 'Edit my marker', exact: true });
  await expect(editor.getByLabel('Game X', { exact: true })).toHaveValue('-1000');
  await expect(editor.getByLabel('Game Y', { exact: true })).toHaveValue('1200');
  await tap(page, editor.getByRole('button', { name: 'Delete marker', exact: true }));
  await tap(page, editor.getByRole('button', { name: 'Confirm deletion', exact: true }));
  await expect(editor).not.toBeVisible();
  // Deleting the last visible place on a fresh profile empties the
  // map, so the first-open Vice City sheet can fire again (it never
  // fired after the reload, because the marker was showing) — the
  // marker's own sheet is gone either way; dismiss the welcome
  // sheet if it appeared, then the map is clean.
  await expect(
    details(page).getByRole('heading', { name: 'Quiet beach overlook', exact: true }),
  ).toHaveCount(0);
  await dismissPlaceSheet(page);
  await expect(details(page)).not.toBeVisible();
  const backup = await exportBackup(page, testInfo, 'deleted-marker');
  expect(backup.markers).toEqual([]);
  expect(backup.favorites).toEqual([]);
  expect(backup.notes).toEqual([]);
  expect(backup.collections).toHaveLength(1);
  expect(backup.collections[0]).toMatchObject({ name: 'Personal trip', placeIds: [] });
});

test('backup validation and preview preserve current data until a confirmed merge', async ({
  page,
}, testInfo) => {
  await openAtlas(page);
  await createMarker(page, 'Keep this marker');
  const original = await exportBackup(page, testInfo, 'original');
  expect(original).toMatchObject({ format: 'leonida-atlas', version: 3 });
  expect(original.markers).toHaveLength(1);
  const fileInput = page.getByLabel('Import a backup', { exact: true });
  await fileInput.setInputFiles({
    name: 'unsupported.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ ...original, version: 999 })),
  });
  await expect(page.getByRole('alert')).toContainText('version');
  await expect(page.getByRole('button', { name: 'Merge backup', exact: true })).not.toBeVisible();
  expect(savedData(await exportBackup(page, testInfo, 'after-invalid'))).toEqual(
    savedData(original),
  );
  const imported = structuredClone(original);
  imported.markers.push({
    ...original.markers[0]!,
    id: 'custom:imported-stop',
    title: 'Imported stop',
    position: { x: -800, y: 1000 },
  });
  await fileInput.setInputFiles({
    name: 'valid-preview.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(page.getByRole('region', { name: 'Backup preview', exact: true })).toContainText(
    '2 markers',
  );
  expect(savedData(await exportBackup(page, testInfo, 'before-merge'))).toEqual(
    savedData(original),
  );
  await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Merge backup', exact: true })).not.toBeVisible();
  await fileInput.setInputFiles({
    name: 'valid-confirmed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
  // v0.18.0: the merge status carries the AI-index summary too
  // ("Backup merged. AI index: 0 new, … 2 markers, … Your local data
  // is saved."), so match the stable prefix, not the whole string —
  // the exact-text expectation predates the summary and the merge
  // itself succeeds (the status above proves it).
  await expect(
    page.getByText('Backup merged.', { exact: false }),
  ).toBeVisible();
  const merged = await exportBackup(page, testInfo, 'after-merge');
  expect(merged.markers.map((marker) => marker.title).sort()).toEqual([
    'Imported stop',
    'Keep this marker',
  ]);
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-backup.png`),
    fullPage: true,
  });
});

test('the installed app reloads offline with its saved preferences and personal data', async ({
  page,
  context,
  browserName,
}, testInfo) => {
  test.setTimeout(60_000);
  await openAtlas(page);
  await createMarker(page, 'Offline stop');
  await tap(page, page.getByRole('button', { name: 'Close place details', exact: true }));
  await openPanel(page, 'find');
  await tap(page, sidebar(page).getByRole('button', { name: 'Settings', exact: true }));
  const reducedMotion = page.getByRole('checkbox', { name: /^Reduce motion/ });
  await tap(page, reducedMotion);
  await expect(reducedMotion).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await tap(page, page.getByRole('button', { name: 'Close dialog', exact: true }));
  await page.waitForFunction(
    async () => Boolean((await navigator.serviceWorker.getRegistration())?.active),
    undefined,
    { timeout: 30_000 },
  );
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await dismissSheetAfterReload(page);
  await context.setOffline(true);
  try {
    try {
      await page.reload();
    } catch (error) {
      if (
        browserName === 'webkit' &&
        error instanceof Error &&
        error.message.includes('WebKit encountered an internal error')
      ) {
        test.skip(
          true,
          'Playwright WebKit fails offline service-worker navigation with an internal browser error; Chromium verifies cached reload. https://playwright.dev/docs/service-workers',
        );
      }
      throw error;
    }
    await dismissSheetAfterReload(page);
    await expectTilesLoaded(page);
    // Playwright 1.62 can incorrectly expose navigator.onLine=true after an offline reload.
    // Prove the network is actually unavailable instead of using that emulated flag.
    // https://github.com/microsoft/playwright/issues/42174
    expect(
      await page.evaluate(() =>
        fetch('/atlas-offline-network-proof', { cache: 'no-store' }).then(
          () => false,
          () => true,
        ),
      ),
    ).toBe(true);
    await openPanel(page, 'find');
    await search(page).fill('Offline stop');
    await tap(page, page.locator('.place-results').getByRole('button', { name: /^Offline stop My marker/ }));
    await expect(
      details(page).getByRole('heading', { name: 'Offline stop', exact: true }),
    ).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
    await page.screenshot({
      path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-offline.png`),
      fullPage: true,
    });
    await tap(page, page.getByRole('button', { name: 'Close place details', exact: true }));
    await selectRegion(page);
    await expect(
      details(page).getByRole('heading', { name: 'Ambrosia', exact: true }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('keyboard search and modal dismissal preserve focus and usable navigation', async ({
  page,
}) => {
  await openAtlas(page);
  await page.getByRole('region', { name: 'Leonida interactive map', exact: true }).focus();
  await page.keyboard.press('/');
  await expect(search(page)).toBeFocused();
  await search(page).fill('Ambrosia');
  const settings = sidebar(page).getByRole('button', { name: 'Settings', exact: true });
  await settings.click();
  const dialog = page.getByRole('dialog', { name: 'ViceWire settings', exact: true });
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press('Tab');
    // Native dialogs may send Tab through browser chrome, represented as body focus.
    // The application behind the modal must never receive keyboard focus.
    expect(
      await dialog.evaluate(
        (element) =>
          document.activeElement === document.body || element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(settings).toBeFocused();
});

test('blocked local storage keeps the public map usable and never reports a successful save', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(IDBFactory.prototype, 'open', {
      configurable: true,
      value() {
        throw new DOMException('Storage was blocked by the browser.', 'SecurityError');
      },
    });
  });
  await page.goto('');
  await expect(
    page.getByRole('region', { name: 'Leonida interactive map', exact: true }),
  ).toBeVisible();
  await dismissWelcome(page);
  await openPanel(page, 'find');
  await expect(page.getByText('Local storage needs attention', { exact: true })).toBeVisible();
  await expect(page.getByText('Local data saved', { exact: true })).not.toBeVisible();
  await openPanel(page, 'layers');
  await expect(page.getByRole('button', { name: /^Add marker/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry storage', exact: true }).click();
  await expect(page.getByText('Local storage needs attention', { exact: true })).toBeVisible();
  await selectRegion(page);
  await expect(details(page).getByRole('heading', { name: 'Ambrosia', exact: true })).toBeVisible();
  await expect(
    details(page).getByRole('button', { name: 'Add to favorites', exact: true }),
  ).toBeDisabled();
  await expect(details(page).getByLabel('Notes', { exact: true })).toBeDisabled();
});

test('clean note editors synchronize across tabs without overwriting newer saved text', async ({
  page,
  context,
}) => {
  // Two full app loads + three region selections + a reload: 37s on the
  // 1.5-CPU sandbox, over the 30s default (proven by a 90s-budget run
  // passing in 37.1s). Same pattern as the offline-reload test below,
  // which already carries test.setTimeout(60_000).
  test.setTimeout(60_000);
  await openAtlas(page);
  await selectRegion(page);
  const second = await context.newPage();
  try {
    await openAtlas(second);
    await selectRegion(second);
    await details(second).getByLabel('Notes', { exact: true }).fill('Written in the second tab.');
    await tap(second, details(second).getByRole('button', { name: 'Save note', exact: true }));
    await expect(details(second).getByRole('button', { name: 'Note saved', exact: true })).toBeVisible();
    const firstNote = details(page).getByLabel('Notes', { exact: true });
    await expect(firstNote).toHaveValue('Written in the second tab.');
    await firstNote.focus();
    await tap(page, details(page).getByRole('heading', { name: 'Ambrosia', exact: true }));
    await second.reload();
    await dismissSheetAfterReload(second);
    await selectRegion(second);
    await expect(details(second).getByLabel('Notes', { exact: true })).toHaveValue(
      'Written in the second tab.',
    );
  } finally {
    await second.close();
  }
});

test('a dismissed direct link stays closed when local data refreshes', async ({ page, context }) => {
  await page.goto('?place=region%3Avice-city');
  await dismissWelcome(page);
  const heading = details(page).getByRole('heading', { name: 'Vice City', exact: true });
  await expect(heading).toBeVisible();
  await tap(page, page.getByRole('button', { name: 'Close place details', exact: true }));
  await expect(heading).not.toBeVisible();
  const other = await context.newPage();
  try {
    await openAtlas(other);
    await createMarker(other, 'Second tab update');
    await openPanel(page, 'find');
    await search(page).fill('Second tab update');
    await expect(page.getByRole('button', { name: /^Second tab update My marker/ })).toBeVisible();
    await expect(heading).not.toBeVisible();
  } finally {
    await other.close();
  }
});

test('notes saved offline remain available after reconnecting and reloading', async ({
  page,
  context,
}) => {
  await openAtlas(page);
  await selectRegion(page);
  await context.setOffline(true);
  try {
    await details(page)
      .getByLabel('Notes', { exact: true })
      .fill('Saved while the connection was unavailable.');
    await tap(page, details(page).getByRole('button', { name: 'Save note', exact: true }));
    await expect(details(page).getByRole('button', { name: 'Note saved', exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
  await page.reload();
  await dismissSheetAfterReload(page);
  await selectRegion(page);
  await expect(details(page).getByLabel('Notes', { exact: true })).toHaveValue(
    'Saved while the connection was unavailable.',
  );
});

test('forced indexing onboarding appears on a fresh profile, and Skip leaves a one-tap reminder', async ({
  page,
}, testInfo) => {
  const runtimeErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('');
  await expect(page).toHaveTitle(/ViceWire/);
  await expect(
    page.getByRole('region', { name: 'Leonida interactive map', exact: true }),
  ).toBeVisible();
  await expectTilesLoaded(page);
  const welcome = page.getByRole('dialog', { name: 'Welcome to Leonida' });
  await expect(welcome).toBeVisible();
  // Forced: no ×, and Escape does nothing — the only way out is an
  // explicit choice in the dialog itself.
  await expect(welcome.getByRole('button', { name: 'Close dialog' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(welcome).toBeVisible();
  // Plain words, real numbers: 2,700 still need sorting, 8 at a time,
  // gpt-4o-mini, 0 sorted on a fresh phone.
  await expect(welcome.getByText(/2,700 places still need sorting/)).toBeVisible();
  await expect(welcome.getByText(/8 at a time/)).toBeVisible();
  await expect(welcome.getByText(/gpt-4o-mini/)).toBeVisible();
  await expect(welcome.getByText(/0 are sorted/)).toBeVisible();
  // Start is disabled with no key; pasting one enables it (no real
  // OpenAI call is made in this test).
  const start = welcome.getByRole('button', { name: 'Start sorting', exact: true });
  await expect(start).toBeDisabled();
  await welcome.getByLabel('OpenAI API key').fill('sk-test-key');
  await expect(start).toBeEnabled();
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-onboarding.png`),
    fullPage: true,
  });
  // Skip is an explicit choice, not a missed ×.
  await welcome.getByRole('button', { name: /^Skip for now/ }).click({ force: true });
  await expect(welcome).not.toBeVisible();
  // The map after onboarding, v0.12.0: wordmark + one search pill
  // and nothing else — no filter bar, no count pill, no reminder pill,
  // no floating Add button, no caption.
  await expect(page.locator('.map-hero-banner')).toBeVisible();
  await expect(page.locator('.map-search-pill')).toBeVisible();
  await expect(page.locator('.filter-bar')).toHaveCount(0);
  await expect(page.locator('.filter-count-pill')).toHaveCount(0);
  await expect(page.locator('.atlas-map-caption')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /still unnamed/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    390,
  );
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-map-after-onboarding.png`),
    fullPage: true,
  });
  // The reminder lives in Layers now: six county cards, the reminder
  // banner, and the job itself. One tap on the reminder scrolls to it.
  await openPanel(page, 'layers');
  await expect(page.locator('.county-card')).toHaveCount(6);
  const reminder = page.getByRole('button', { name: /still unnamed/ });
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText('2,700 places still unnamed');
  await reminder.click();
  await expect(page.getByText('Sort the unnamed places')).toBeVisible();
  await expect(page.getByText('0 sorted so far')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-layers-index.png`),
    fullPage: true,
  });
  // A place detail with interiors, deep-linked.
  await page.goto('?place=L192');
  await expect(details(page).getByRole('heading', { name: 'Inside' })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-place-detail-interiors.png`),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Close place details', exact: true }).click();
  // Find, with its own county + kind filters.
  await enableLayer(page, 'Named regions');
  await openPanel(page, 'find');
  await search(page).fill('Ambrosia');
  await page
    .locator('.place-results')
    // Minimal card (v0.14.0): button name starts with the place title.
    .getByRole('button', { name: /^Ambrosia/ })
    .click();
  await expect(details(page).getByRole('heading', { name: 'Ambrosia', exact: true })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`atlas-qa-${testInfo.project.name}-find.png`),
    fullPage: true,
  });
  expect(runtimeErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
