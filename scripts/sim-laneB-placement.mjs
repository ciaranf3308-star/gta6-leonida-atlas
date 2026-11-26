// Lane B (v0.32.1) — OFFLINE PLACEMENT SIM.
// Replays the live placement rule (label-placement.ts
// placeLikelyAreaLabels, two-pass, 10px grid, 300px radius, 4/2
// gaps) on the captured live geometry (scripts/laneB-geometry.json)
// and scores variants against the same bars the live probe uses:
// 0px² label-vs-pill / label-vs-label overlap, island/district
// visible counts (baseline 7/17, 10/17), and chrome overlap px²
// per visible label (the two unreadable cases: Weed Grow line 1,
// Hog Stars at district).
//
// Variants:
//   current  — the shipped rule; must reproduce the live visible
//              sets exactly, or the harness is not trusted.
//   chrome   — (2) CHROME PREFERENCE: pass 1 keeps the centre only
//              when it is pill-clear AND chrome-clear; pass 2 takes
//              the least-chrome-occluded clear anchor (chrome px²,
//              then distance). Chrome is a soft score, never a
//              keep-out: a label with no chrome-clear anchor still
//              shows at its least-occluded anchor.
//   narrow<W> — (3) narrower label at width W px (heights from the
//              calibrated text-wrap formula, which must reproduce
//              all 17 live 200px heights first).
//   leader   — (3) leader-line: anchors may sit OUTSIDE the region
//              (within the same 300px radius of the centre), scored
//              as in `chrome`.
//   chrome+narrow<W>, chrome+leader — combinations.
// Usage: node sim-laneB-placement.mjs
//
// LIVE VERDICT (2026-11-26, Lane B — read this before trusting the
// sim's "predictions" below): the sim's height estimates are the
// weak point, and live refuted its island optimism. The best sim
// candidate, 180px (island 9/17 predicted, Port Gellhorn recovered,
// district 10/17 held), was implemented and probed live:
// island came back 6/17 (WORSE than 7/17 — Port Gellhorn still
// hidden, Slator + Gas Station lost), district held 10/17 with Hog
// Stars cleared (7400→0px²) but Farm Fix blew up to 8808px²
// occluded (the sim predicted 8742 — that part was right), and
// Weed Grow stayed 9900px² at both zooms. The 180px change was
// REVERTED; the tree keeps 200px. Chrome-preference fared no
// better in the sim (island: zero change; district: 10/17 → 9/17,
// Weed Grow never clears — at district the whole Lummox region
// sits behind the hero, so no in-region anchor can clear it).
// Leader-line recovers Port Gellhorn (11–13/17) but its chrome
// totals explode (26k–47k px²), the recovered label itself sits
// ~13k px² behind chrome, and Vice City stays hidden at district.
// CONCLUSION: no variant measured is a net win; no app code was
// changed. The sim stays as the record of what was measured and
// why, not as a recommendation.
import { readFileSync } from 'node:fs';

const d = JSON.parse(readFileSync(new URL('./laneB-geometry.json', import.meta.url), 'utf8'));

const GAP_X = 4;
const GAP_Y = 2;
const STEP = 10;
const RADIUS = 300;
const VW = 390;
const VH = 707; // map container height (bottom nav sits below it)

function overlaps(a, b) {
  return (
    a.left < b.right + GAP_X &&
    a.right > b.left - GAP_X &&
    a.top < b.bottom + GAP_Y &&
    a.bottom > b.top - GAP_Y
  );
}
function rawOverlap(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return w > 0 && h > 0 ? Math.round(w * h) : 0;
}
function boxFor(ax, ay, w, h) {
  return { left: ax - w / 2, right: ax + w / 2, top: ay - h / 2, bottom: ay + h / 2 };
}
function inViewport(box) {
  return box.left >= 0 && box.right <= VW && box.top >= 0 && box.bottom <= VH;
}

/**
 * Height of a label at width w, from its text length. Calibrated
 * against the live 200px heights: 11px condensed, line-height
 * 1.35 (≈14.85px/line), ~4.9px/char, 16px horizontal padding +
 * 2px border, 10px vertical padding + border. Must reproduce all
 * 17 live heights at 200px (asserted in main).
 */
function heightAt(chars, w) {
  const inner = w - 18;
  const lines = Math.max(1, Math.ceil((chars * 4.9) / inner));
  return Math.round(lines * 14.85 + 10);
}

function candidates(geo, width) {
  return geo.labels.map((l, i) => {
    const region = geo.regions[i];
    const chars = l.text.length;
    return {
      key: l.text.slice(0, 40),
      text: l.text,
      width,
      height: width === 200 ? l.height : heightAt(chars, width),
      centre: { x: (region.left + region.right) / 2, y: (region.top + region.bottom) / 2 },
      region,
      isPriority: l.text.startsWith('Walker Farm'),
      liveVisible: l.visible,
    };
  });
}

function gridAnchors(c, allowOutsideRegion) {
  const { centre, region } = c;
  const minX = allowOutsideRegion ? centre.x - RADIUS : Math.max(region.left, centre.x - RADIUS);
  const maxX = allowOutsideRegion ? centre.x + RADIUS : Math.min(region.right, centre.x + RADIUS);
  const minY = allowOutsideRegion ? centre.y - RADIUS : Math.max(region.top, centre.y - RADIUS);
  const maxY = allowOutsideRegion ? centre.y + RADIUS : Math.min(region.bottom, centre.y + RADIUS);
  const pts = [];
  for (let x = minX; x <= maxX; x += STEP) {
    for (let y = minY; y <= maxY; y += STEP) {
      pts.push({ x, y, d: Math.hypot(x - centre.x, y - centre.y) });
    }
  }
  pts.sort((a, b) => a.d - b.d);
  return pts;
}

/**
 * The placement run. `chromeScore`: false = shipped rule (first
 * pill-clear anchor by distance; pass 1 takes a pill-clear centre
 * whatever the chrome says). true = chrome preference (pass 1
 * keeps the centre only when chrome-clear; pass 2 takes the
 * least-chrome-occluded clear anchor, distance as tie-break).
 * `allowOutsideRegion`: leader-line variant.
 */
function run(geo, opts) {
  const width = opts.width ?? 200;
  const list = candidates(geo, width);
  const pills = geo.pills.map((p) => p.rect);
  const chrome = geo.chrome.map((c) => c.rect);
  const chromePx2 = (box) => chrome.reduce((sum, c) => sum + rawOverlap(box, c), 0);
  const placed = [];
  const result = new Map(); // key -> {anchor, box, chromePx2} | null
  const boxFits = (box) =>
    inViewport(box) &&
    !pills.some((p) => overlaps(box, p)) &&
    !placed.some((p) => overlaps(box, p));

  const suppressed = [];
  for (const c of list) {
    const box = boxFor(c.centre.x, c.centre.y, c.width, c.height);
    const centreOk = boxFits(box) && (!opts.chromeScore || chromePx2(box) === 0);
    if (centreOk) {
      result.set(c.key, { anchor: { ...c.centre }, box, chromePx2: chromePx2(box), moved: 0 });
      placed.push(box);
    } else {
      suppressed.push(c);
    }
  }
  const pass2 = [
    ...suppressed.filter((c) => c.isPriority),
    ...suppressed.filter((c) => !c.isPriority),
  ];
  for (const c of pass2) {
    let best = null;
    for (const pt of gridAnchors(c, opts.allowOutsideRegion ?? false)) {
      const box = boxFor(pt.x, pt.y, c.width, c.height);
      if (!boxFits(box)) continue;
      if (!opts.chromeScore) {
        best = { anchor: { x: pt.x, y: pt.y }, box, chromePx2: chromePx2(box), moved: pt.d };
        break; // nearest clear anchor wins (shipped rule)
      }
      const occ = chromePx2(box);
      if (
        best === null ||
        occ < best.chromePx2 ||
        (occ === best.chromePx2 && pt.d < best.moved)
      ) {
        best = { anchor: { x: pt.x, y: pt.y }, box, chromePx2: occ, moved: pt.d };
      }
    }
    if (best) {
      result.set(c.key, best);
      placed.push(best.box);
    } else {
      result.set(c.key, null);
    }
  }
  return { list, result };
}

function report(tag, geo, runOut) {
  const { list, result } = runOut;
  const vis = list.filter((c) => result.get(c.key) !== null);
  const hid = list.filter((c) => result.get(c.key) === null);
  const occ = vis.map((c) => ({ name: c.key, px2: result.get(c.key).chromePx2 }));
  const totalOcc = occ.reduce((s, o) => s + o.px2, 0);
  const worst = [...occ].sort((a, b) => b.px2 - a.px2).slice(0, 4);
  console.log(`\n== ${tag}: ${vis.length}/${list.length} visible, chrome total ${totalOcc}px² ==`);
  for (const o of occ) {
    if (o.px2 > 0) console.log(`  OCC ${o.px2}px² ${o.name}`);
  }
  console.log(`  worst: ${worst.map((w) => `${w.name}=${w.px2}`).join(' | ')}`);
  for (const c of hid) console.log(`  HIDE ${c.key}`);
  return { visible: vis.length, totalOcc, occ, hidden: hid.map((c) => c.key) };
}

function liveSet(geo) {
  return new Set(geo.labels.filter((l) => l.visible).map((l) => l.text.slice(0, 40)));
}

for (const tag of ['island', 'district']) {
  const geo = d[tag];
  console.log(`\n##### ${tag.toUpperCase()} (live ${geo.labels.filter((l) => l.visible).length}/17) #####`);
  // Height calibration check at 200px.
  const bad = geo.labels.filter((l) => heightAt(l.text.length, 200) !== l.height);
  console.log(`height formula at 200px: ${bad.length === 0 ? 'reproduces all 17 live heights' : `MISMATCH on ${bad.map((l) => `${l.text.slice(0, 30)} live=${l.height} formula=${heightAt(l.text.length, 200)}`).join('; ')}`}`);

  const live = liveSet(geo);
  const cur = run(geo, {});
  const curVis = new Set(cur.list.filter((c) => cur.result.get(c.key) !== null).map((c) => c.key));
  const reproduced = live.size === curVis.size && [...live].every((k) => curVis.has(k));
  console.log(`CURRENT rule reproduces live set: ${reproduced ? 'YES' : `NO — live-only: ${[...live].filter((k) => !curVis.has(k))} sim-only: ${[...curVis].filter((k) => !live.has(k))}`}`);

  const rCur = report('current (200px, shipped)', geo, cur);
  const rChrome = report('chrome-preference (200px)', geo, run(geo, { chromeScore: true }));
  const r160 = report('narrow 160px (shipped rule)', geo, run(geo, { width: 160 }));
  const r170 = report('narrow 170px (shipped rule)', geo, run(geo, { width: 170 }));
  const r150 = report('narrow 150px (shipped rule)', geo, run(geo, { width: 150 }));
  const rLeader = report('leader-line (200px, chrome-scored)', geo, run(geo, { chromeScore: true, allowOutsideRegion: true }));
  const rChrome160 = report('chrome-preference + narrow 160px', geo, run(geo, { chromeScore: true, width: 160 }));
  const rChromeLeader = report('chrome-preference + leader-line (160px)', geo, run(geo, { chromeScore: true, allowOutsideRegion: true, width: 160 }));

  // Width sweep (shipped rule only): is there a width between 150
  // and 200 that holds both counts AND recovers Port Gellhorn?
  console.log(`\n-- ${tag} width sweep, shipped rule (visible / WeedGrow px² / PortGellhorn) --`);
  for (const w of [190, 180, 175, 170, 165, 160, 155, 150]) {
    const r = report(`width ${w}`, geo, run(geo, { width: w }));
    const pgW = r.hidden.some((h) => h.startsWith('Kingpin Bowling')) ? 'HID' : 'VIS';
    const weedW = r.occ.find((o) => o.name.startsWith('Weed Grow'));
    console.log(`  width ${w}: ${r.visible}/17 weed=${weedW?.px2 ?? 'HID'} PG=${pgW} chromeTotal=${r.totalOcc}`);
  }

  // Chrome-preference + narrowing: the shipped rule is chrome-blind,
  // so a narrower label can land its nearest clear anchor under the
  // hero (Farm Fix at district 180px: 8742px²). Score the anchors
  // and the width may keep its count gain without the occlusion.
  console.log(`\n-- ${tag} chrome-preference + width sweep (visible / WeedGrow px² / HogStars px² / PortGellhorn / chromeTotal) --`);
  for (const w of [190, 180, 175]) {
    const r = report(`chrome+width ${w}`, geo, run(geo, { chromeScore: true, width: w }));
    const pgW = r.hidden.some((h) => h.startsWith('Kingpin Bowling')) ? 'HID' : 'VIS';
    const weedW = r.occ.find((o) => o.name.startsWith('Weed Grow'));
    const hogW = r.occ.find((o) => o.name.startsWith('Hog Stars'));
    console.log(`  chrome+${w}: ${r.visible}/17 weed=${weedW?.px2 ?? 'HID'} hog=${hogW?.px2 ?? 'HID'} PG=${pgW} chromeTotal=${r.totalOcc}`);
  }

  // Headline checks for this lane.
  const weed = (r) => r.occ.find((o) => o.name.startsWith('Weed Grow'));
  const hog = (r) => r.occ.find((o) => o.name.startsWith('Hog Stars'));
  const pg = (r) => (r.hidden.some((h) => h.startsWith('Kingpin Bowling')) ? 'HID' : 'VIS');
  const vc = (r) => (r.hidden.some((h) => h.startsWith("JanJak's Garage")) ? 'HID' : 'VIS');
  console.log(`\n-- ${tag} headline table (visible / WeedGrow px² / HogStars px² / PortGellhorn / ViceCity) --`);
  for (const [name, r] of [['current', rCur], ['chrome', rChrome], ['160px', r160], ['170px', r170], ['150px', r150], ['leader', rLeader], ['chrome+160', rChrome160], ['chrome+leader160', rChromeLeader]]) {
    console.log(`  ${name.padEnd(16)} ${r.visible}/17  weed=${weed(r)?.px2 ?? 'HID'}  hog=${hog(r)?.px2 ?? 'HID'}  PG=${pg(r)}  VC=${vc(r)}`);
  }
}
