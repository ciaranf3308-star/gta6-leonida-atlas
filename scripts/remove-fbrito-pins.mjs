#!/usr/bin/env node
/**
 * Takedown for the fbrito card import — remove records by fbrito id.
 *
 *   node scripts/remove-fbrito-pins.mjs --ids <id1,id2,...> [--reason "..."]
 *   node scripts/remove-fbrito-pins.mjs --all --yes [--reason "..."]
 *
 * Moves the matching entries from the manifest's `resolved` list to its
 * `removed` list (with removedAt + reason), then re-runs
 * scripts/apply-fbrito-import.mjs, which deletes their pins from
 * src/data/card-fbrito-pins.generated.ts and restores their checklist
 * slots to `area-known` (catalogueId null, import conflict notes
 * stripped). Host-pinned slots are never in the manifest's resolved
 * list, so they cannot be touched by this step — the script aborts if
 * any requested id maps to a host-pinned slot.
 *
 * `--all` removes the whole import (all 346 pins). It requires `--yes`
 * so an accidental run cannot wipe the import.
 *
 * See hidden_files/v032-gtatown/IMPORT-OVERRIDE.md §6 for the full
 * takedown procedure.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = resolve(repoRoot, 'scripts', 'fbrito-import-manifest.json');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const idsArg = arg('--ids');
const removeAll = process.argv.includes('--all');
const yes = process.argv.includes('--yes');
const reason = arg('--reason') ?? 'takedown';

if (!idsArg && !removeAll) {
  console.error('Usage: node scripts/remove-fbrito-pins.mjs --ids <id1,id2,...> [--reason "..."]');
  console.error('   or: node scripts/remove-fbrito-pins.mjs --all --yes [--reason "..."]');
  process.exit(2);
}
if (removeAll && !yes) {
  console.error('Refusing to remove the whole import without --yes.');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const wanted = removeAll
  ? manifest.resolved.map((r) => r.fbritoId)
  : idsArg.split(',').map((s) => s.trim()).filter(Boolean);
const removedAt = new Date().toISOString();
const moved = [];
for (const id of wanted) {
  const idx = manifest.resolved.findIndex((r) => r.fbritoId === id);
  if (idx < 0) {
    if ((manifest.removed ?? []).some((r) => r.fbritoId === id)) {
      console.log(`already removed: ${id} (skipped)`);
      continue;
    }
    console.error(`fbrito id not in the import's resolved list: ${id}`);
    process.exit(1);
  }
  const entry = manifest.resolved[idx];
  if (manifest.hostPinnedSlotIds.includes(entry.slotId)) {
    console.error(`NEVER-MOVE VIOLATION: ${id} maps to host-pinned slot ${entry.slotId} — refusing`);
    process.exit(1);
  }
  manifest.resolved.splice(idx, 1);
  manifest.removed = manifest.removed ?? [];
  manifest.removed.push({ ...entry, removedAt, reason });
  moved.push(entry);
}
if (moved.length === 0) {
  console.log('Nothing to remove.');
  process.exit(0);
}
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Removed ${moved.length} fbrito record(s) from the manifest (${reason}):`);
for (const m of moved) console.log(`- ${m.fbritoId} (${m.setId} / ${m.person} (${m.variant}))`);
console.log('Re-applying the import to remove pins and restore slots…');
execFileSync(process.execPath, [resolve(repoRoot, 'scripts', 'apply-fbrito-import.mjs')], { stdio: 'inherit' });
console.log('Done. Verify with: node scripts/apply-fbrito-import.mjs --check');
