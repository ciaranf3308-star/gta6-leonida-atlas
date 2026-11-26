// Shared Playwright harness for the v0.32 acceptance demos.
// 390px wide, DPR 2, persistent profile per demo (so "kill + reopen"
// is a context close + relaunch on the same userDataDir).
// Profiles live under /home/hatch/.v032-profiles (NOT /tmp: /tmp is a
// 512MB tmpfs and filled up on 2026-11-26, which crashed every
// renderer and wiped /tmp on the service restart).
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/gta6-leonida-atlas/package.json');
const { chromium } = require('playwright');
import { mkdirSync } from 'node:fs';

export const BASE = 'http://127.0.0.1:4330/gta6-leonida-atlas/';
export const SHOTS =
  '/home/hatch/workspace/goals/gta-6-leonida-map-spoiler-free-pwa/hidden_files/v032-demos/shots';
mkdirSync(SHOTS, { recursive: true });

const PROFILE_BASE = '/home/hatch/.v032-profiles';

function wire(page, label) {
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[${label}] console.error:`, m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => console.log(`[${label}] pageerror:`, String(e).slice(0, 300)));
}

export async function launch(profile, label) {
  const ctx = await chromium.launchPersistentContext(`${PROFILE_BASE}/${profile}`, {
    headless: true,
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  wire(page, label);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

/** WebKit fallback (2026-11-26): the Chromium headless_shell renderer
 * in this VM started dying on every screenshot capture (and then on
 * plain page load) while /tmp was full — "Target crashed" on the first
 * screenshot of a fresh profile, in single-process mode too, while
 * DOM/evaluate still worked. WebKit 2370 (via executablePath; the
 * repo's playwright expects 2336, which is not installed) loads the
 * app and captures fine. Demos run under launchWk are flagged as
 * WebKit in DEMOS.md. */
export async function launchWk(profile, label) {
  const { webkit } = require('playwright');
  const ctx = await webkit.launchPersistentContext(`${PROFILE_BASE}/${profile}`, {
    headless: true,
    viewport: { width: 390, height: 780 },
    deviceScaleFactor: 2,
    executablePath: '/home/hatch/.cache/ms-playwright/webkit-2370/pw_run.sh',
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  wire(page, label);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

export async function shot(page, name) {
  const p = `${SHOTS}/${name}.png`;
  await page.screenshot({ path: p });
  console.log('shot:', p);
  return p;
}

export async function bodyText(page) {
  return (await page.evaluate(() => document.body.innerText)).slice(0, 6000);
}

export async function clickText(page, text, opts = {}) {
  const loc = page.getByText(text, { exact: false }).first();
  await loc.waitFor({ timeout: 15000 });
  await loc.click(opts);
  await page.waitForTimeout(700);
}

export async function clickButton(page, name) {
  const loc = page.getByRole('button', { name, exact: false }).first();
  await loc.waitFor({ timeout: 15000 });
  await loc.click();
  await page.waitForTimeout(700);
}

export async function clickTab(page, label) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(900);
}

/** Dump all button labels visible right now (for selector discovery). */
export async function closeDialog(page) {
  const close = page.getByLabel('Close dialog').first();
  if (await close.count()) {
    await close.click();
    await page.waitForTimeout(600);
  }
}

export async function waitForText(page, re, timeout = 30000) {
  await page.waitForFunction((src) => new RegExp(src, 'i').test(document.body.innerText), re.source, { timeout });
}

/** Dump all button labels visible right now (for selector discovery). */
export async function dumpButtons(page, label) {
  const names = await page.evaluate(() =>
    [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80)).filter(Boolean),
  );
  console.log(`--- buttons [${label}] (${names.length}) ---`);
  for (const n of names) console.log('  •', n);
  return names;
}

export async function dumpHeadings(page, label) {
  const hs = await page.evaluate(() =>
    [...document.querySelectorAll('h1,h2,h3')].map((h) => `${h.tagName}: ${(h.innerText || '').trim()}`).filter(Boolean),
  );
  console.log(`--- headings [${label}] ---`);
  for (const h of hs) console.log('  •', h);
}
