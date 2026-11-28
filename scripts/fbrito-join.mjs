#!/usr/bin/env node
/**
 * Re-derive the fbrito join against our 480-slot checklist, then apply
 * gtatown's public Sources citations as cross-reference.
 *
 * Inputs (read-only; all overridable with CLI flags):
 *   --fbrito <path> — pinned fbrito file (default /tmp/fbrito-locations.json)
 *   --checklist <path> — our 597 items, 480 slots + 117 extras
 *   --generated-pins <path> — 17 generated host pins
 *   --repo <dir> — src/data/collectables.ts (regex-extracted, 20
 *     hand-written host pins) + src/data/loot-map.ts (3 loot-joined pins)
 *   --citations <path> — gtatown per-card cited fbrito ids (citations
 *     only; no gtatown coordinates/descriptions were read or stored)
 *   --out <path> — join result JSON (default /tmp/join-result.json)
 *
 * Derivation record (2026-11-28): pinned fbrito commit
 * 77cd5024140f8ff857363998a210750191d9c777 (2,048,012 bytes, SHA-256
 * 289628eedbf72f6139df570fc96071fbf2102149bd23920d6a2783789e3a1631,
 * 5,838 records, 596 cards), citations fetched 2026-11-28 12:19-12:30 UTC
 * (scripts/gt-citations.json, 400 cards). Pure functions (parsing,
 * normalisation, conversion, description scoring) live in
 * ./fbrito-join-lib.mjs so tests can import them without running the join.
 *
 * Conversion: gx = x*32 - 16384, gy = 16384 - y*32.
 * Output: <out> + human summary on stdout.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  normPerson, parseFbrito, convert, dist, variantMatches,
  isTierVariant, parseGtName, normArea, tokens, descScore,
} from './fbrito-join-lib.mjs';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}
const FBRITO_PATH = arg('--fbrito', '/tmp/fbrito-locations.json');
const CHECKLIST_PATH = arg('--checklist', '/tmp/checklist.json');
const GEN_PINS_PATH = arg('--generated-pins', '/tmp/generated-pins.json');
const REPO = arg('--repo', '/home/hatch/workspace/gta6-leonida-atlas');
const CITATIONS_PATH = arg('--citations', '/tmp/gt-citations.json');
const OUT_PATH = arg('--out', '/tmp/join-result.json');
const FBRITO = JSON.parse(readFileSync(FBRITO_PATH, 'utf8'));
const ITEMS = JSON.parse(readFileSync(CHECKLIST_PATH, 'utf8'));
const GEN_PINS = JSON.parse(readFileSync(GEN_PINS_PATH, 'utf8'));

// ---- host-pin positions (pin position = host position by construction) ----
const pinPos = new Map();
for (const p of GEN_PINS) pinPos.set(p.id, p.position);
// collectables.ts: card() calls pass the position as a bare object literal
// "{ x: .., y: .. }" — there is no "position:" label at the call site.
// Anchor on "card(" and take the FIRST "{ x:" within the call.
const collSrc = readFileSync(`${REPO}/src/data/collectables.ts`, 'utf8');
for (const m of collSrc.matchAll(/card\(\s*'((?:card):[^']+)'[\s\S]{0,1200}?\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+)\s*\}/g)) {
  pinPos.set(m[1], { x: parseFloat(m[2]), y: parseFloat(m[3]) });
}
// loot-map.ts: only the 3 loot-joined card pins matter (other loot records
// are guides, not card pins).
const LOOT_CARD_IDS = new Set(['loot:guide-marquise-card', 'loot:guide-harley-card', 'loot:guide-rusty-anchor-card']);
const lootSrc = readFileSync(`${REPO}/src/data/loot-map.ts`, 'utf8');
for (const m of lootSrc.matchAll(/id:\s*'((?:loot):[^']+)',[\s\S]{0,2000}?position:\s*\{\s*x:\s*(-?[\d.]+),\s*y:\s*(-?[\d.]+)\s*\}/g)) {
  if (LOOT_CARD_IDS.has(m[1])) pinPos.set(m[1], { x: parseFloat(m[2]), y: parseFloat(m[3]) });
}
console.log('host-pin positions extracted:', pinPos.size, '(expect 40: 20 hand-written + 17 generated + 3 loot)');

// ---- normalisation ----
const fbritoCards = FBRITO.filter((r) => r.kind === 'card').map(parseFbrito);
const fbritoById = new Map(fbritoCards.map((c) => [c.id, c]));
console.log('fbrito cards:', fbritoCards.length, 'parseable person:', fbritoCards.filter((c) => c.person).length,
  'unparseable:', fbritoCards.filter((c) => !c.person).length);
for (const c of fbritoCards.filter((c) => !c.person)) {
  console.log('  unparseable:', c.id, JSON.stringify(c.rawName), JSON.stringify(c.rawDesc));
}

// ---- our slots ----
const slots = ITEMS.filter((i) => i.checklistSlot);
const extras = ITEMS.filter((i) => !i.checklistSlot);
const slotKey = (s) => `${s.setId}|${normPerson(s.person)}`;
const slotsByPerson = new Map();
for (const s of slots) {
  const k = slotKey(s);
  if (!slotsByPerson.has(k)) slotsByPerson.set(k, []);
  slotsByPerson.get(k).push(s);
}

// ---- buckets, no citations ----
const buckets = { A: [], B: [], C1: [], C2: [], D: [] };
const slotFbrito = new Map(); // slotId -> {bucket, record(s)}
for (const s of slots) {
  const cands = fbritoCards.filter((c) => c.setId === s.setId && c.person && normPerson(c.person) === normPerson(s.person));
  const matching = cands.filter((c) => variantMatches(s, c.variant));
  if (matching.length === 1) {
    buckets.A.push(s); slotFbrito.set(s.id, { bucket: 'A', records: matching });
  } else if (matching.length > 1) {
    buckets.B.push(s); slotFbrito.set(s.id, { bucket: 'B', records: matching });
  } else if (cands.length === 1 && (cands[0].variant == null || !isTierVariant(cands[0].variant)) && (slotsByPerson.get(slotKey(s)) ?? []).length === 1) {
    // C1: one record, one slot for the person, and the record carries no
    // tier label (missing, or a non-tier label like "Hotshot Rookie") —
    // assignable by elimination.
    buckets.C1.push(s); slotFbrito.set(s.id, { bucket: 'C1', records: cands });
  } else if (cands.length > 0) {
    buckets.C2.push(s); slotFbrito.set(s.id, { bucket: 'C2', records: cands });
  } else {
    buckets.D.push(s); slotFbrito.set(s.id, { bucket: 'D', records: [] });
  }
}
console.log('BUCKETS no-citation: A=%d B=%d C1=%d C2=%d D=%d total=%d',
  buckets.A.length, buckets.B.length, buckets.C1.length, buckets.C2.length, buckets.D.length,
  buckets.A.length + buckets.B.length + buckets.C1.length + buckets.C2.length + buckets.D.length);
console.log('EXPECTED:           A=279 B=6 C1=15 C2=161 D=19 total=480');
console.log('A slots from bare/person-card parses:');
for (const s of buckets.A) { const r=slotFbrito.get(s.id).records[0]; if (r.parsed==='bare-person-variant'||r.parsed==='person-card-variant'||r.parsed==='person-card'||r.parsed==='bare-person') console.log('  A*:', s.setId,'/',s.person,'('+s.variant+') <-',r.id,'parsed='+r.parsed,'variant='+JSON.stringify(r.variant)); }
console.log('D slots (mine):');
for (const s of buckets.D) console.log(`  D: ${s.setId} / ${s.person} (${s.variant})`);
console.log('C2 slots with exactly 1 candidate (single-record, variant mismatch or labelled):');
for (const s of buckets.C2) {
  const cands = slotFbrito.get(s.id).records;
  if (cands.length === 1) console.log(`  C2-1: ${s.setId} / ${s.person} (${s.variant}) <- ${cands[0].id} variant=${JSON.stringify(cands[0].variant)} parsed=${cands[0].parsed}`);
}
console.log('C1 slots (mine):');
for (const s of buckets.C1) console.log(`  C1: ${s.setId} / ${s.person} (${s.variant}) <- ${slotFbrito.get(s.id).records[0].id}`);

// extras sanity: how many of the 117 extras match an fbrito record
let extraMatches = 0;
for (const x of extras) {
  const cands = fbritoCards.filter((c) => c.setId === x.setId && c.person && normPerson(c.person) === normPerson(x.person) && variantMatches(x, c.variant));
  if (cands.length > 0) extraMatches++;
}
console.log('extras matching fbrito (expect ~2):', extraMatches);

// ---- host-disagreement check (the 40 host-pinned slots) ----
// Only A/C1 records are usable here (a unique variant match or an
// elimination match). A C2 first-record is arbitrary — never a
// disagreement signal. B conflicts are reported separately.
const hostDisagree = [];
for (const s of slots.filter((i) => i.placement === 'pinned')) {
  const hostPos = s.catalogueId ? pinPos.get(s.catalogueId) : null;
  const fb = slotFbrito.get(s.id);
  const rec = fb?.records?.[0];
  if (!hostPos) { hostDisagree.push({ slot: s.id, issue: 'no host pin position found', catalogueId: s.catalogueId }); continue; }
  if (!rec) { hostDisagree.push({ slot: s.id, issue: 'no fbrito record at all', bucket: fb.bucket }); continue; }
  if (fb.bucket === 'B') { hostDisagree.push({ slot: s.id, issue: 'B conflict — two fbrito records', records: fb.records.map((r) => r.id) }); continue; }
  if (fb.bucket === 'C2') { hostDisagree.push({ slot: `${s.setId} / ${s.person} (${s.variant})`, issue: 'C2 — no unique fbrito match, cannot compare', records: fb.records.map((r) => r.id) }); continue; }
  const d = dist(hostPos, convert(rec));
  hostDisagree.push({ slot: `${s.setId} / ${s.person} (${s.variant})`, fbritoId: rec.id, bucket: fb.bucket, distanceUnits: Math.round(d * 10) / 10, over100: d > 100 });
}
const over100 = hostDisagree.filter((h) => h.over100);
console.log('host-pinned slots with usable fbrito match:', hostDisagree.filter((h) => h.fbritoId).length, '(expect 23)');
console.log('host-pinned slots with fbrito match >100u away:', over100.length);
for (const h of over100) console.log('  ', JSON.stringify(h));
console.log('host-pinned with no fbrito record:', JSON.stringify(hostDisagree.filter((h) => h.issue === 'no fbrito record at all').map((h) => h.slot)));
console.log('host-pinned C2 (cannot compare):', JSON.stringify(hostDisagree.filter((h) => h.issue?.startsWith('C2')).map((h) => h.slot)));
console.log('host-pinned B conflicts:', JSON.stringify(hostDisagree.filter((h) => h.issue?.startsWith('B conflict')).map((h) => h.slot)));
console.log('host-pinned missing pin position:', JSON.stringify(hostDisagree.filter((h) => h.issue === 'no host pin position found').map((h) => h.slot)));

// ---- citation join ----
let citations = null;
if (existsSync(CITATIONS_PATH)) {
  citations = JSON.parse(readFileSync(CITATIONS_PATH, 'utf8'));
}
const result = { buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])), hostDisagree, over100: over100.length, citation: null };
if (citations) {
  const cited = citations.citations;
  console.log('citations loaded:', cited.length, 'cards;', cited.filter((c) => c.fbritoIds.length > 0).length, 'with fbrito id;',
    cited.filter((c) => c.fbritoIds.length === 0).length, 'without');
  console.log('set totals from API:', JSON.stringify(citations.setTotals));
  // Parse gtatown name: "<Set> card #N: Person (Variant)" or "<Set> card: Person (Variant)" or "...: Person"
  // NOTE: parens sometimes hold a PLACE, not a variant (e.g. "Ichiro Yamada (Rialto Islands)") —
  // only accept the paren content as a variant if it is a known tier/colour word.
  // CITATION-FIRST matching. gtatown's card names mostly carry NO variant
  // ("Vice City Flamingos card: Angel Cienfuegos" appears once per variant
  // with nothing to tell them apart), so the name alone cannot assign the
  // slot. The cited fbrito record is the assigner: parse ITS (set, person,
  // variant) and match that to a slot. The gtatown name is only supporting
  // evidence (and a sanity check).
  //
  // Per (set, person) pool: all cited records across all gtatown entries
  // in that set for that person, plus all slots for that person.
  //   1. Labelled records assign to the slot whose variant they match.
  //   2. Elimination: one unassigned record + one unassigned slot left
  //      in the pool -> assign (method citation-elimination).
  //   3. Anything left unassigned after 1+2 stays held (the citation
  //      narrowed it to the person's records but cannot pair them —
  //      pairing would need description/direction matching, per-record).
  const gtBySlot = new Map(); // slotId -> {gtName, gtPage, fbritoIds, method, fbritoId, spread, conflictNote}
  const unmatchedGt = [];
  const sanityFlags = [];
  // Pool keyed by (setId, person-norm): {records: Map fbritoId->rec, slots, entries}
  const pools = new Map();
  function poolFor(setId, person) {
    const k = `${setId}|${normPerson(person)}`;
    if (!pools.has(k)) pools.set(k, { setId, person, records: new Map(), slots: [], entries: [] });
    return pools.get(k);
  }
  for (const s of slots) poolFor(s.setId, s.person).slots.push(s);
  for (const c of cited) {
    const { person: gtPerson } = parseGtName(c.gtName, c.setId);
    for (const id of c.fbritoIds ?? []) {
      const rec = fbritoById.get(id);
      if (!rec) { unmatchedGt.push({ gtName: c.gtName, setId: c.setId, reason: `cited fbrito id ${id} is not in the pinned file`, citedIds: c.fbritoIds }); continue; }
      if (!rec.person || !rec.setId) { unmatchedGt.push({ gtName: c.gtName, setId: c.setId, reason: `cited record ${id} has no parseable person/set`, citedIds: c.fbritoIds }); continue; }
      const pool = poolFor(rec.setId, rec.person);
      pool.records.set(id, rec);
      pool.entries.push({ gtName: c.gtName, gtPage: c.gtPage, fbritoId: id, fbritoCommit: c.fbritoCommit, gtPerson });
    }
    // Entries whose cited records parse to nobody still count as "shown"
    // for gap purposes — record them against the name's person if any.
    if ((c.fbritoIds ?? []).length > 0 && gtPerson) {
      const pool = poolFor(c.setId, gtPerson);
      pool.entries.push({ gtName: c.gtName, gtPage: c.gtPage, fbritoId: null, fbritoCommit: c.fbritoCommit, gtPerson });
    }
  }
  // Pass 1: labelled records -> variant-matching slots.
  for (const pool of pools.values()) {
    for (const rec of pool.records.values()) {
      if (rec.variant == null || !isTierVariant(rec.variant)) continue;
      const slot = pool.slots.find((s) => variantMatches(s, rec.variant) && !gtBySlot.has(s.id));
      if (!slot) continue;
      const entry = pool.entries.find((e) => e.fbritoId === rec.id);
      gtBySlot.set(slot.id, { gtName: entry?.gtName, gtPage: entry?.gtPage, fbritoIds: [rec.id], method: 'citation', fbritoId: rec.id, spread: 0, conflictNote: null });
    }
  }
  // Pass 1b: area qualifier. Some gtatown entry names carry an AREA in
  // parens — e.g. "Ichiro Yamada (Port Vice City)" — not a variant. When
  // the parenthetical is not a tier variant and normalises to exactly one
  // unassigned slot's areaLead in the pool, the cited record belongs to
  // that slot. (Variant parens like "(Blue)"/"(Silver)" are skipped here;
  // Pass 1 already handles labelled records.)
  const areaLeads = new Set(slots.map((s) => normArea(s.areaLead ?? '')));
  for (const pool of pools.values()) {
    for (const rec of pool.records.values()) {
      if ([...gtBySlot.values()].some((g) => g.fbritoId === rec.id)) continue;
      const entry = pool.entries.find((e) => e.fbritoId === rec.id);
      if (!entry) continue;
      const m = entry.gtName.match(/\(([^)]+)\)\s*$/);
      if (!m) continue;
      const qual = m[1].trim();
      if (isTierVariant(qual)) continue;
      if (!areaLeads.has(normArea(qual))) continue;
      const cands = pool.slots.filter((s) => !gtBySlot.has(s.id) && normArea(s.areaLead ?? '') === normArea(qual));
      if (cands.length !== 1) continue;
      gtBySlot.set(cands[0].id, { gtName: entry.gtName, gtPage: entry.gtPage, fbritoIds: [rec.id], method: 'citation-area', fbritoId: rec.id, spread: 0, conflictNote: null });
    }
  }
  // Area guard for the description pass: when the entry citing a record
  // carries an area qualifier, a slot whose areaLead differs from it may
  // not claim that record on description text alone (e.g. Ichiro 011 is
  // cited by "(Rialto Islands)" — neither Vespucci Island nor Waning
  // Sands may take it on the word "garage").
  function entryAreaFor(pool, recId) {
    const entry = pool.entries.find((e) => e.fbritoId === recId);
    if (!entry) return null;
    const m = entry.gtName.match(/\(([^)]+)\)\s*$/);
    if (!m) return null;
    const qual = m[1].trim();
    if (isTierVariant(qual)) return null;
    if (!areaLeads.has(normArea(qual))) return null;
    return normArea(qual);
  }
  // Pass 2: elimination within the pool (one record + one slot left).
  // Pass 3: description matching. Claims are computed for ALL unassigned
  // slots in the pool first, then resolved: a record claimed by exactly
  // one slot goes to it; claimed by 2+ slots it goes to the strictly
  // highest scorer; a tie for highest holds the record for all of them
  // (the earlier per-slot version let the first slot in iteration order
  // steal a record a later slot scored higher on — Leroy Rook 002).
  // 2+3 iterate to a fixpoint.
  let changed = true;
  while (changed) {
    changed = false;
    // Elimination pass.
    for (const pool of pools.values()) {
      const unassignedRecs = [...pool.records.values()].filter((r) => ![...gtBySlot.values()].some((g) => g.fbritoId === r.id));
      const unassignedSlots = pool.slots.filter((s) => !gtBySlot.has(s.id));
      if (unassignedRecs.length === 1 && unassignedSlots.length === 1) {
        const rec = unassignedRecs[0];
        const slot = unassignedSlots[0];
        const entry = pool.entries.find((e) => e.fbritoId === rec.id);
        gtBySlot.set(slot.id, { gtName: entry?.gtName, gtPage: entry?.gtPage, fbritoIds: [rec.id], method: 'citation-elimination', fbritoId: rec.id, spread: 0, conflictNote: null });
        changed = true;
      }
    }
    // Description pass: assign iff the best-scoring record beats the
    // runner-up strictly AND shares >=1 distinctive token. A shared token
    // counts only when it appears in exactly one candidate record's
    // description within the pool (otherwise it does not discriminate).
    for (const pool of pools.values()) {
      const unassignedRecs = [...pool.records.values()].filter((r) => ![...gtBySlot.values()].some((g) => g.fbritoId === r.id));
      const unassignedSlots = pool.slots.filter((s) => !gtBySlot.has(s.id));
      if (!unassignedRecs.length || !unassignedSlots.length) continue;
      const tokenDocCount = new Map();
      for (const r of unassignedRecs) for (const t of tokens(r.description ?? '')) tokenDocCount.set(t, (tokenDocCount.get(t) ?? 0) + 1);
      // Best claim per slot, computed against the same unassigned set.
      const claims = [];
      for (const slot of unassignedSlots) {
        const scored = unassignedRecs.map((r) => {
          const area = entryAreaFor(pool, r.id);
          if (area && normArea(slot.areaLead ?? '') !== area) return { rec: r, distinctive: [], score: -1 };
          const { shared } = descScore(slot, r);
          const distinctive = shared.filter((t) => (tokenDocCount.get(t) ?? 0) === 1);
          return { rec: r, distinctive, score: distinctive.length };
        }).sort((a, b) => b.score - a.score);
        const best = scored[0];
        const second = scored[1];
        if (best && best.score >= 1 && (!second || second.score < best.score)) {
          claims.push({ slot, rec: best.rec, distinctive: best.distinctive, score: best.score });
        }
      }
      // Resolve contests per record: sole claim wins; 2+ claims go to the
      // strictly highest scorer; a tie for highest holds the record.
      const byRec = new Map();
      for (const c of claims) {
        if (!byRec.has(c.rec.id)) byRec.set(c.rec.id, []);
        byRec.get(c.rec.id).push(c);
      }
      for (const [, cs] of byRec) {
        cs.sort((a, b) => b.score - a.score);
        if (cs.length === 1 || cs[0].score > cs[1].score) {
          const win = cs[0];
          const entry = pool.entries.find((e) => e.fbritoId === win.rec.id);
          gtBySlot.set(win.slot.id, { gtName: entry?.gtName, gtPage: entry?.gtPage, fbritoIds: [win.rec.id], method: 'citation-description', fbritoId: win.rec.id, spread: 0, conflictNote: null, matchKeywords: win.distinctive, matchEvidence: { fbritoDescription: win.rec.description ?? '', slotSpot: win.slot.spotDescription } });
          changed = true;
        }
      }
    }
  }
  // Sanity: every assignment's cited record must agree with the slot on
  // person (already enforced by pool key) — but flag assignments where the
  // gtatown entry's own name person disagrees with the slot person.
  for (const [slotId, g] of gtBySlot) {
    const slot = slots.find((s) => s.id === slotId);
    if (g.gtName) {
      const { person: gtPerson } = parseGtName(g.gtName, slot.setId);
      if (gtPerson && normPerson(gtPerson) !== normPerson(slot.person)) {
        sanityFlags.push({ slotId, reason: 'gtatown entry name person disagrees with assigned slot', gtName: g.gtName, slotPerson: slot.person, fbritoId: g.fbritoId });
      }
    }
  }
  // How many gtatown entries ended up attached to a slot?
  const attachedEntries = new Set([...gtBySlot.values()].map((g) => g.gtPage));
  console.log('citation assignment: slots assigned =', gtBySlot.size, 'of', slots.length,
    '; gtatown entries attached =', attachedEntries.size, 'of', cited.length);
  console.log('unmatched citations (cited id not in file / unparseable):', unmatchedGt.length);
  for (const u of unmatchedGt) console.log('  unmatched citation:', JSON.stringify(u));
  console.log('sanity flags:', sanityFlags.length);
  for (const f of sanityFlags) console.log('  sanity:', JSON.stringify(f));

  // Final resolution per slot
  const resolved = []; // {slot, method, fbritoId, position, notes}
  const held = [];
  const gap = []; // gtatown shows it, no fbrito record
  // Which slots does gtatown show? Any slot with an assigned citation, OR
  // any slot whose (set, person) appears in a gtatown entry name.
  const shownSlotIds = new Set([...gtBySlot.keys()]);
  for (const c of cited) {
    const { person } = parseGtName(c.gtName, c.setId);
    if (!person) continue;
    for (const s of slotsByPerson.get(`${c.setId}|${normPerson(person)}`) ?? []) shownSlotIds.add(s.id);
  }
  for (const s of slots) {
    const fb = slotFbrito.get(s.id);
    const gt = gtBySlot.get(s.id);
    const shows = shownSlotIds.has(s.id);
    if (s.placement === 'pinned') {
      // Host pin wins, never moved. But record whether the citation agrees.
      if (gt) {
        const rec = fbritoById.get(gt.fbritoId);
        const hostPos = pinPos.get(s.catalogueId);
        const d = hostPos && rec ? dist(hostPos, convert(rec)) : null;
        if (d != null && d > 100) {
          held.push({ slotId: s.id, setId: s.setId, person: s.person, variant: s.variant, reason: `host-pinned; cited fbrito record ${gt.fbritoId} sits ${Math.round(d)}u from the host pin — host wins, disagreement recorded`, fbritoId: gt.fbritoId, distanceUnits: Math.round(d * 10) / 10 });
        }
      }
      continue;
    }
    if (fb.bucket === 'A' || fb.bucket === 'C1') {
      const rec = fb.records[0];
      resolved.push({ slotId: s.id, setId: s.setId, person: s.person, variant: s.variant, method: fb.bucket, fbritoId: rec.id, position: convert(rec), gtatownShows: shows, gtCitedId: gt?.fbritoId === rec.id ? rec.id : null, citedIds: gt ? gt.fbritoIds : [], gtPage: gt?.gtPage ?? null });
    } else if (gt) {
      const rec = fbritoById.get(gt.fbritoId);
      const otherB = (fb.bucket === 'B' ? fb.records.filter((r) => r.id !== rec.id).map((r) => r.id) : []);
      resolved.push({ slotId: s.id, setId: s.setId, person: s.person, variant: s.variant, method: gt.method === 'citation' ? `citation-${fb.bucket}` : gt.method, fbritoId: rec.id, position: convert(rec), gtatownShows: true, gtCitedId: rec.id, citedIds: gt.fbritoIds, gtPage: gt.gtPage ?? null, conflictNote: otherB.length ? `fbrito also has ${otherB.join(', ')} for this slot — citation picks ${rec.id}` : null, matchKeywords: gt.matchKeywords ?? null, matchEvidence: gt.matchEvidence ?? null });
    } else if (shows) {
      // gtatown shows it (by name) but no citation assigned a record.
      const pool = pools.get(`${s.setId}|${normPerson(s.person)}`);
      const cands = pool ? [...pool.records.values()].map((r) => r.id) : [];
      gap.push({ slotId: s.id, setId: s.setId, person: s.person, variant: s.variant, bucket: fb.bucket, reason: 'gtatown shows it; citation cannot pair a record to this slot', candidateFbritoIds: cands, gtEntries: (pool?.entries ?? []).filter((e) => e.gtPerson && normPerson(e.gtPerson) === normPerson(s.person)).map((e) => e.gtPage) });
    } else {
      held.push({ slotId: s.id, setId: s.setId, person: s.person, variant: s.variant, reason: `bucket ${fb.bucket}, gtatown does not show it`, bucket: fb.bucket });
    }
  }
  const perSet = {};
  for (const s of slots) {
    perSet[s.setId] = perSet[s.setId] ?? { size: 0, hostPinned: 0, imported: 0, gap: 0, held: 0 };
    perSet[s.setId].size++;
    if (s.placement === 'pinned') perSet[s.setId].hostPinned++;
  }
  for (const r of resolved) perSet[r.setId].imported++;
  for (const g of gap) perSet[g.setId].gap++;
  for (const h of held) perSet[h.setId].held++;
  const gtPerSet = {};
  for (const c of cited) gtPerSet[c.setId] = (gtPerSet[c.setId] ?? 0) + 1;
  console.log('\nFINAL: resolved(import) =', resolved.length, '| gap (gtatown shows, no fbrito) =', gap.length, '| held =', held.length);
  console.log('per-set (size / hostPinned / imported / gtatownShows / gap / held):');
  for (const [setId, p] of Object.entries(perSet).sort()) {
    console.log(`  ${setId}: ${p.size} / ${p.hostPinned} / ${p.imported} / ${gtPerSet[setId] ?? 0} / ${p.gap} / ${p.held}`);
  }
  console.log('total gtatown cards fetched:', cited.length, '(target 406)');
  console.log('gap list (named):');
  for (const g of gap) console.log(`  ${g.setId} / ${g.person} (${g.variant}) — bucket ${g.bucket}, candidates=[${(g.candidateFbritoIds ?? []).join(', ')}] ${g.reason}`);
  console.log('held with citation-related reasons:', JSON.stringify(held.filter((h) => h.reason.startsWith('host-pinned') || h.reason.startsWith('citation')), null, 1));
  console.log('sanity flags (gtatown entry name disagrees with assigned slot):', sanityFlags.length);
  for (const r of sanityFlags) console.log('  ', JSON.stringify(r));
  result.citation = { resolved: resolved.length, gap: gap.length, held: held.length, perSet, gapList: gap, heldList: held, resolvedList: resolved, unmatchedGt, sanityFlags, shownSlots: shownSlotIds.size };
}
writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));
console.log('wrote /tmp/join-result.json');
