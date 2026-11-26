/**
 * Measure the card matcher's deterministic yield on the real data
 * (CARD-MATCHER-DESIGN §3): D1 exact host → D2 chain+area → D3
 * same-street, over the 440 area-known slots + the GTADB snapshot.
 * No LLM calls — this is the deterministic ceiling, and the number
 * the design's "realistic yield 25–60" is checked against.
 *
 * Run: npx tsx scripts/measure-matcher-yield.ts
 * (dev-only: not shipped, not imported by the app.)
 */
import { readFileSync } from 'node:fs';
import { catalogueFromSnapshot } from '../src/data/catalogue';
import { buildGameDatabase } from '../src/domain/game-db';
import {
  candidateHostsForSlot,
  resolveSlotDeterministically,
} from '../src/features/ask/card-matcher';

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      '../public/assets/street-leonida/maps/gtadb-landmarks-2e9e194.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const db = buildGameDatabase({ places: catalogueFromSnapshot(snapshot) });
const slots = [...db.items.values()].filter(
  (item) => item.checklistSlot && item.placement === 'area-known',
);
console.log(`Unmatched (area-known) slots: ${slots.length}`);

const byPass = new Map<string, number>();
const examples = new Map<string, string[]>();
let proposed = 0;
let ambiguous = 0;
let none = 0;
let llmEligible = 0;
for (const slot of slots) {
  const result = resolveSlotDeterministically(db, slot);
  if (result.proposal) {
    proposed += 1;
    const pass = result.proposal.candidate.pass;
    byPass.set(pass, (byPass.get(pass) ?? 0) + 1);
    const list = examples.get(pass) ?? [];
    if (list.length < 8) {
      list.push(
        `${slot.name} → ${result.proposal.hostName} (${result.proposal.hostId}, ${pass}, ${result.proposal.confidence})`,
      );
    }
    examples.set(pass, list);
  } else if (result.status === 'ambiguous') {
    ambiguous += 1;
    if (result.candidates.length > 0) llmEligible += 1;
  } else {
    none += 1;
    if (result.candidates.length > 0) llmEligible += 1;
  }
}
console.log(`Deterministic proposals: ${proposed}`);
for (const pass of ['D1', 'D2', 'D3']) {
  console.log(`  ${pass}: ${byPass.get(pass) ?? 0}`);
  for (const example of examples.get(pass) ?? []) console.log(`    - ${example}`);
}
console.log(`Ambiguous (2+ candidates, LLM decides): ${ambiguous}`);
console.log(`No candidates at all: ${none}`);
console.log(`LLM-eligible (has candidates, no deterministic proposal): ${llmEligible}`);
// Candidate-pool shape: how many slots have ANY candidate (the LLM's
// universe), and how many of those are area-mismatched exact names.
let withCandidates = 0;
let mismatchOnly = 0;
for (const slot of slots) {
  const candidates = candidateHostsForSlot(db, slot);
  if (candidates.length > 0) {
    withCandidates += 1;
    if (candidates.every((candidate) => !candidate.areaAgrees)) mismatchOnly += 1;
  }
}
console.log(`Slots with at least one candidate: ${withCandidates}`);
console.log(`Slots whose candidates are ALL area-mismatched: ${mismatchOnly}`);
console.log(
  `Pinned total if every deterministic proposal were confirmed: ${40 + proposed} of 480 (${Math.round(((40 + proposed) / 480) * 100)}%)`,
);
