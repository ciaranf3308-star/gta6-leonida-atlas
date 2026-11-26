/* global document, window */
// Lane 4 item 3 — Find results below the fold (runs on :4331,
// the lane's own isolated build). Fresh profile `lane4-findfold`.
//  Search "Brooks Boatworks" in Find and check the result rows are
//  in the visible viewport WITHOUT manual scrolling: the first
//  .place-result must sit fully inside the 390x780 viewport, and the
//  element at its centre must be the row itself (not covered by the
//  category browser or anything else). The search field must stay
//  visible too — it sits outside the scrolling content.
import { launch4, shot } from './lane4-harness.mjs';

const results = [];
function check(step, ok, detail) {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${step} — ${detail}`);
}

let { ctx, page } = await launch4('lane4-findfold', 'L4-3');
await shot(page, 'l4-10-find-before');

// Open Find from the map search pill.
await page.getByRole('button', { name: /Search Leonida/i }).first().click();
await page.waitForTimeout(900);
await page.locator('#atlas-search').fill('Brooks Boatworks');
await page.waitForTimeout(1500);
await shot(page, 'l4-11-find-brooks');

const geo = await page.evaluate(() => {
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height) };
  };
  const rows = [...document.querySelectorAll('.place-result')].map((el) => ({
    text: (el.textContent || '').trim().slice(0, 40),
    rect: r(el),
    hit: (() => {
      const b = el.getBoundingClientRect();
      const at = document.elementFromPoint(b.x + b.width / 2, b.y + Math.min(b.height / 2, 30));
      return at ? el.contains(at) : false;
    })(),
  }));
  const scroller = document.querySelector('.sidebar-content');
  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    scrollTop: scroller ? Math.round(scroller.scrollTop) : null,
    searchField: r(document.querySelector('#atlas-search')),
    // The POI results line ("N results"), not the FindFilters
    // "N places showing" — that one counts positioned places on
    // visible layers (0 with every layer off) and is not the search.
    resultsLine: (document.querySelector('.poi-results .results-count')?.textContent || '').trim(),
    rows,
  };
});
console.log(JSON.stringify(geo, null, 2));
check(
  'Find lists Brooks Boatworks results (POI search, whole database)',
  /\d+ results?/i.test(geo.resultsLine) && geo.rows.some((row) => /Brooks Boatworks/.test(row.text)),
  geo.resultsLine,
);
check(
  'at least the demo’s 2 result rows exist',
  geo.rows.length >= 2,
  `${geo.rows.length} rows`,
);
const first = geo.rows[0];
check(
  'first result row is inside the visible viewport (no manual scroll)',
  !!first && first.rect.top >= 0 && first.rect.bottom <= geo.viewport.h,
  first ? `top ${first.rect.top}, bottom ${first.rect.bottom}, viewport ${geo.viewport.h}` : 'no rows',
);
check(
  'first result row is the element under its own centre (not covered)',
  !!first && first.hit === true,
  first ? `hit=${first.hit}` : 'no rows',
);
const second = geo.rows[1];
check(
  'second result row is inside the visible viewport too',
  !!second && second.rect.top >= 0 && second.rect.bottom <= geo.viewport.h,
  second ? `top ${second.rect.top}, bottom ${second.rect.bottom}` : 'no rows',
);
check(
  'every result row is inside the visible viewport',
  geo.rows.length > 0 &&
    geo.rows.every((row) => row.rect.top >= 0 && row.rect.bottom <= geo.viewport.h),
  geo.rows.map((row) => `${row.text.slice(0, 20)}: ${row.rect.top}-${row.rect.bottom}`).join('; '),
);
check(
  'search field stays visible while results are in view',
  !!geo.searchField && geo.searchField.top >= 0,
  geo.searchField ? `top ${geo.searchField.top}` : 'no search field',
);
check(
  'the content scrolled (not the page) to bring results up',
  typeof geo.scrollTop === 'number' && geo.scrollTop > 0,
  `sidebar-content scrollTop=${geo.scrollTop}`,
);

await ctx.close();
console.log('\n=== LANE4-3 SUMMARY ===');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.step} :: ${r.detail}`);
process.exitCode = results.some((r) => !r.ok) ? 1 : 0;
