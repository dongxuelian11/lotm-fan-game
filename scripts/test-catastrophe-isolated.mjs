#!/usr/bin/env node
// Execute the unchanged Catastrophe shared-contract cases in fresh processes.
// The case inventory is checked against every collected Vitest report.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testFile = 'tests/domain/catastrophe-shared.test.ts';
const names = [
  "Catastrophe original492 living prefix, migration168 and shared runtime migrates the actual W121 survivor without changing original bodies, wounds, fields or random state",
  "Catastrophe original492 living prefix, migration168 and shared runtime replays the full492 original commands and every captured new choice without changing the seed or searching for favorable outcomes",
  "Catastrophe original492 living prefix, migration168 and shared runtime replays every full indexed before/intent/after boundary without mutating input or substituting a final-only snapshot",
  "Catastrophe original492 living prefix, migration168 and shared runtime actually discovers care, pays60 for the same original heavy injury and clears wounds only through a later ordinary rest",
  "Catastrophe original492 living prefix, migration168 and shared runtime naturally preserves exactly20 old values, adds only two zero entries and freezes Sea King digestion without refilling S",
  "Catastrophe original492 living prefix, migration168 and shared runtime validates all seven inherited histories, both old rituals and central mastery at promotion, practice and actual terminal state",
  "Catastrophe original492 living prefix, migration168 and shared runtime keeps all old exact-stage acquisition, life, ritual and combat entrances closed at S2",
  "Catastrophe original492 living prefix, migration168 and shared runtime keeps Benedict and Quentin dead, their original clubs on the quay, old failed bottles consumed and original Sea King wear unchanged",
  "Catastrophe original492 living prefix, migration168 and shared runtime derives natural practice mastery from actual applications and leaves unused successful windows unrewarded",
  "Catastrophe original492 living prefix, migration168 and shared runtime projects the actual old Sea King enemy constants without changing old dice, and keeps the Cataclysm Priest enemy ordinary",
  "Catastrophe original492 living prefix, migration168 and shared runtime preserves S0 with public/save cap120 and ordinary rest does not clamp S2 to30",
  "Catastrophe original492 living prefix, migration168 and shared runtime preserves S31 with public/save cap120 and ordinary rest does not clamp S2 to30",
  "Catastrophe original492 living prefix, migration168 and shared runtime preserves S119 with public/save cap120 and ordinary rest does not clamp S2 to30",
  "Catastrophe original492 living prefix, migration168 and shared runtime preserves S120 with public/save cap120 and ordinary rest does not clamp S2 to30",
  "Catastrophe original492 living prefix, migration168 and shared runtime rejects deleted/extra mastery, changed old digestion, revived originals and future or unknown fields instead of repairing them"
];
const argv = process.argv.slice(2);
if (argv.length && !(argv.length === 2 && argv[0] === '--output-dir')) {
  console.error('Usage: node scripts/test-catastrophe-isolated.mjs [--output-dir NEW_DIRECTORY]');
  process.exit(2);
}
const out = argv.length ? path.resolve(argv[1]) : path.join(repo, 'output', 'catastrophe-isolated-' + new Date().toISOString().replace(/[:.]/g, '-'));
if (fs.existsSync(out)) throw new Error('Use a new output directory; existing evidence is never replaced: ' + out);
fs.mkdirSync(out, { recursive: true });
const expected = [...names].sort();
const rows = [];
const escapeRegExp = value => [...value].map(char => (String.fromCharCode(92) + '^$.*+?()[]{}|').includes(char) ? String.fromCharCode(92) + char : char).join('');
for (const [index, name] of names.entries()) {
  const reportPath = path.join(out, String(index + 1).padStart(2, '0') + '.json');
  const result = spawnSync(process.execPath, [path.join(repo, 'node_modules/vitest/vitest.mjs'), 'run', testFile,
    '-t', '^' + escapeRegExp(name) + '$', '--maxWorkers=1', '--no-file-parallelism',
    '--reporter=default', '--reporter=json', '--outputFile=' + reportPath], {
      cwd: repo, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=768' },
    });
  let error = result.error?.message ?? null;
  let selected = [];
  let filtered = 0;
  try {
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const cases = report.testResults.flatMap(file => file.assertionResults);
    if (JSON.stringify(cases.map(item => item.fullName).sort()) !== JSON.stringify(expected)) throw new Error('Collected case inventory differs from the required fifteen cases.');
    selected = cases.filter(item => item.fullName === name);
    const others = cases.filter(item => item.fullName !== name);
    if (selected.length !== 1 || selected[0].status !== 'passed') throw new Error('The exact selected case did not pass.');
    if (others.length !== 14 || others.some(item => item.status !== 'skipped')) throw new Error('Unselected cases were not explicitly filtered.');
    filtered = others.length;
  } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
  const passed = result.status === 0 && result.signal === null && error === null;
  rows.push({ name, passed, exit: result.status, signal: result.signal, error, selectedPassed: passed ? 1 : 0, intentionallyFiltered: filtered });
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ testFile, expectedCases: names.length, completedCases: rows.length, passedCases: rows.filter(row => row.passed).length, rows }, null, 2) + '\n');
}
const success = rows.length === 15 && rows.every(row => row.passed);
console.log(`Catastrophe isolated coverage: ${rows.filter(row => row.passed).length}/15 passed. Reports: ${out}`);
process.exitCode = success ? 0 : 1;
