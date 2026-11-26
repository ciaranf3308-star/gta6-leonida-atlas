// Offline placement simulation for the lane-1 island-zoom pile-up.
// Reads probe-lane1-geometry.json (live centre-anchored label rects,
// region screen boxes, geo pills) and simulates re-placement:
// the label anchor may move INSIDE its own region box (the region
// is the honest anchor; the chip is a label for a point in it),
// first clear position wins, otherwise the label is suppressed.
// Tries several candidate orders. This is an experiment to choose
// the placement rule — the real rule lives in label-placement.ts
// and is proven live by probe-lane1-verify.mjs.
import { readFileSync } from 'node:fs';

const d = JSON.parse(readFileSync(new URL('./probe-lane1-geometry.json', import.meta.url), 'utf8'));
const labels = d.labels.map((l, i) => ({
  name: l.text.slice(0, 40),
  w: l.rect.w,
  h: l.rect.h,
  cx: l.rect.x + l.rect.w / 2,
  cy: l.rect.y + l.rect.h / 2,
  region: d.regions[i].rect,
}));
const pills = d.pills.map((p) => {
  const r = p.rect;
  return { left: r.x, right: r.x + r.w, top: r.y, bottom: r.y + r.h };
});

const GAP_X = 4;
const GAP_Y = 2;
const VW = 390;
const VH = 780;

function overlaps(a, b) {
  return (
    a.left < b.right + GAP_X &&
    a.right > b.left - GAP_X &&
    a.top < b.bottom + GAP_Y &&
    a.bottom > b.top - GAP_Y
  );
}
function boxFor(ax, ay, w, h) {
  return { left: ax - w / 2, right: ax + w / 2, top: ay - h / 2, bottom: ay + h / 2 };
}
function inViewport(box) {
  return box.left >= 0 && box.right <= VW && box.top >= 0 && box.bottom <= VH;
}

/** Candidate anchors inside the region box, nearest the centre first. */
function candidates(label, step = 10) {
  const r = label.region;
  const pts = [];
  for (let ax = r.x; ax <= r.x + r.w; ax += step) {
    for (let ay = r.y; ay <= r.y + r.h; ay += step) {
      pts.push({ ax, ay, d: Math.hypot(ax - label.cx, ay - label.cy) });
    }
  }
  pts.sort((a, b) => a.d - b.d);
  return pts;
}

function simulate(order, name) {
  const placed = [];
  const kept = [];
  const suppressed = [];
  for (const label of order) {
    let found = null;
    for (const c of candidates(label)) {
      const box = boxFor(c.ax, c.ay, label.w, label.h);
      if (!inViewport(box)) continue;
      if (pills.some((p) => overlaps(box, p))) continue;
      if (placed.some((p) => overlaps(box, p))) continue;
      found = { ...c, box };
      break;
    }
    if (found) {
      kept.push({ label, anchor: found });
      placed.push(found.box);
    } else {
      suppressed.push(label);
    }
  }
  console.log(`\n== ${name}: ${kept.length}/${labels.length} visible ==`);
  for (const k of kept) {
    const moved = Math.round(Math.hypot(k.anchor.ax - k.label.cx, k.anchor.ay - k.label.cy));
    console.log(`  SHOW moved=${moved}px ${k.label.name}`);
  }
  for (const s of suppressed) console.log(`  HIDE ${s.name}`);
  return kept.length;
}

simulate(labels, 'group order (in-game)');
simulate([...labels].reverse(), 'reversed group order');
simulate(
  [...labels].sort((a, b) => a.region.w * a.region.h - b.region.w * b.region.h),
  'smallest region first',
);
simulate(
  [...labels].sort((a, b) => b.region.w * b.region.h - a.region.w * a.region.h),
  'largest region first',
);
simulate(
  [...labels].sort((a, b) => a.cy - b.cy || a.cx - b.cx),
  'top-to-bottom, left-to-right',
);
const kelly = labels.find((l) => l.name.startsWith('Walker Farm'));
const rest = labels.filter((l) => l !== kelly);
simulate(
  [kelly, ...[...rest].sort((a, b) => a.region.w * a.region.h - b.region.w * b.region.h)],
  'Kelly first, then smallest region first',
);
simulate(
  [kelly, ...[...rest].sort((a, b) => a.cy - b.cy || a.cx - b.cx)],
  'Kelly first, then top-to-bottom',
);
// Most-constrained-first: fewest pill-clear anchors goes first
// (a label whose rect barely clears the pills has nowhere to run
// to, so it claims its slot before the flexible ones do). The
// anchor count is measured against pills only — other labels are
// what the placement itself resolves.
function pillClearAnchors(label) {
  return candidates(label).filter((c) => {
    const box = boxFor(c.ax, c.ay, label.w, label.h);
    return inViewport(box) && !pills.some((p) => overlaps(box, p));
  }).length;
}
const byConstraint = [...labels].sort(
  (a, b) => pillClearAnchors(a) - pillClearAnchors(b) || a.region.w * a.region.h - b.region.w * b.region.h,
);
console.log('\npill-clear anchor counts:');
for (const l of byConstraint) console.log(`  ${pillClearAnchors(l)} ${l.name}`);
simulate(byConstraint, 'most-constrained-first (fewest pill-clear anchors)');
// Two-pass: pass 1 places every label at its centre (first-wins,
// group order) — labels that fit stay exactly on their region's
// centre. Pass 2 re-places the suppressed ones inside their own
// rect (nearest clear anchor first). Minimal movement: only the
// crowded labels shift, and only inside their own region.
function simulateTwoPass(pass2Order, name) {
  const placed = [];
  const kept = [];
  const suppressed = [];
  for (const label of labels) {
    const box = boxFor(label.cx, label.cy, label.w, label.h);
    if (!inViewport(box)) { suppressed.push(label); continue; }
    if (pills.some((p) => overlaps(box, p))) { suppressed.push(label); continue; }
    if (placed.some((p) => overlaps(box, p))) { suppressed.push(label); continue; }
    kept.push({ label, anchor: { ax: label.cx, ay: label.cy, box } });
    placed.push(box);
  }
  for (const label of pass2Order(suppressed)) {
    let found = null;
    for (const c of candidates(label)) {
      const box = boxFor(c.ax, c.ay, label.w, label.h);
      if (!inViewport(box)) continue;
      if (pills.some((p) => overlaps(box, p))) continue;
      if (placed.some((p) => overlaps(box, p))) continue;
      found = { ...c, box };
      break;
    }
    if (found) {
      kept.push({ label, anchor: found });
      placed.push(found.box);
    }
  }
  const hidden = labels.filter((l) => !kept.some((k) => k.label === l));
  console.log(`\n== ${name}: ${kept.length}/${labels.length} visible ==`);
  for (const k of kept) {
    const moved = Math.round(Math.hypot(k.anchor.ax - k.label.cx, k.anchor.ay - k.label.cy));
    console.log(`  SHOW moved=${moved}px ${k.label.name}`);
  }
  for (const s of hidden) console.log(`  HIDE ${s.name}`);
}
simulateTwoPass((s) => s, 'two-pass, pass 2 in group order');
simulateTwoPass(
  (s) => [...s].sort((a, b) => a.region.w * a.region.h - b.region.w * b.region.h),
  'two-pass, pass 2 smallest-first',
);
const isCountyLabel = (l) => /extent \(estimate\)/.test(d.labels[labels.indexOf(l)].text);
simulateTwoPass(
  (s) => [
    ...s.filter(isCountyLabel),
    ...s.filter((l) => !isCountyLabel(l)).sort((a, b) => a.region.w * a.region.h - b.region.w * b.region.h),
  ],
  'two-pass, pass 2 county-first then smallest-first',
);
simulateTwoPass(
  (s) => {
    const k = s.find((l) => l.name.startsWith('Walker Farm'));
    return k ? [k, ...s.filter((l) => l !== k)] : s;
  },
  'two-pass, pass 2 Kelly first then group order',
);
// Single-pass, Kelly first then group order.
simulate(
  [kelly, ...rest],
  'single-pass, Kelly first then group order',
);

// ---- Width sweep: narrower labels pack more per row, but grow
// taller (same text, conserved area). Heights are re-estimated
// from the text at ~6px/char, calibrated against the live 200px
// heights (Port Gellhorn 130 chars → 69px tall at 200px).
const fullText = d.labels.map((l) => l.text);
function heightAt(chars, w) {
  const inner = w - 16;
  const lines = Math.max(1, Math.ceil((chars * 6) / inner));
  return Math.round(lines * 15 + 10);
}
for (const w of [170, 150, 130, 120]) {
  const narrow = labels.map((l, i) => ({ ...l, w, h: heightAt(fullText[i].length, w) }));
  const byArea = [...narrow].sort((a, b) => a.region.w * a.region.h - b.region.w * b.region.h);
  const byAreaDesc = [...narrow].sort((a, b) => b.region.w * b.region.h - a.region.w * a.region.h);
  // Temporarily swap the module-level labels for the simulation.
  const saved = labels.splice(0, labels.length, ...narrow);
  simulate(narrow, `width ${w} — group order`);
  simulate(byArea, `width ${w} — smallest region first`);
  simulate(byAreaDesc, `width ${w} — largest region first`);
  labels.splice(0, labels.length, ...saved);
}
