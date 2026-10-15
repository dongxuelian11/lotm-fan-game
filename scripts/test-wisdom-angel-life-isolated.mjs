#!/usr/bin/env node
// Execute the unchanged Wisdom Angel life-contract cases in fresh processes.
// The case inventory is checked against every collected Vitest report.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testFile = 'tests/domain/wisdom-angel-life.test.ts';
const names = [
  "Wisdom Angel original finite evidence, current conditions and actual physical return starts with one living original adult, two dated original sheets and one device with exactly two charges",
  "Wisdom Angel original finite evidence, current conditions and actual physical return hides unread sheet text, unknown current filter and verified handover from the public projection and blocked reasons",
  "Wisdom Angel original finite evidence, current conditions and actual physical return requires current source agreement before entering and spends actual seconds and metres without teleporting originals",
  "Wisdom Angel original finite evidence, current conditions and actual physical return honors refusal before entry without spending abilities, moving bodies or borrowing originals",
  "Wisdom Angel original finite evidence, current conditions and actual physical return records successful synthesis as a limited unverified hypothesis, then awards only an actual reported handover application",
  "Wisdom Angel original finite evidence, current conditions and actual physical return pays for a failed synthesis without reroll, truth disclosure, mastery or blocking ordinary comparison",
  "Wisdom Angel original finite evidence, current conditions and actual physical return requires an actually paid first demonstration before modelling the original device",
  "Wisdom Angel original finite evidence, current conditions and actual physical return physically changes the real filter once, preserves old evidence and invalidates rather than silently revises the old model",
  "Wisdom Angel original finite evidence, current conditions and actual physical return keeps a WHITE prediction as a hypothesis and requires the actual second charge plus later result verification",
  "Wisdom Angel original finite evidence, current conditions and actual physical return keeps a AMBER prediction as a hypothesis and requires the actual second charge plus later result verification",
  "Wisdom Angel original finite evidence, current conditions and actual physical return a stale original prediction remains recorded but never applies to changed conditions",
  "Wisdom Angel original finite evidence, current conditions and actual physical return failed response still costs6S and cannot reroll, refund or recharge the original demonstration",
  "Wisdom Angel original finite evidence, current conditions and actual physical return a successful-unused response followed by WAIT_20 earns no application or mastery",
  "Wisdom Angel original finite evidence, current conditions and actual physical return a successful-unused response followed by STOP_METHOD earns no application or mastery",
  "Wisdom Angel original finite evidence, current conditions and actual physical return current withdrawal stops a successful-unused synthesis immediately at zero AP and preserves required physical cleanup",
  "Wisdom Angel original finite evidence, current conditions and actual physical return ordinary play completes every actual demonstration, return and report without needing success or spirituality",
  "Wisdom Angel original finite evidence, current conditions and actual physical return insufficient resources reject before charging or drawing and still leave the ordinary route open",
  "Wisdom Angel original finite evidence, current conditions and actual physical return locks ordinary week actions, inherited craft and old scenes while originals are held",
  "Wisdom Angel original finite evidence, current conditions and actual physical return detaches projections and distinguishes attempts, successes, actual applications and reported mastery",
  "Wisdom Angel original finite evidence, current conditions and actual physical return rejects nonexact life command0 without mutating input or RNG",
  "Wisdom Angel original finite evidence, current conditions and actual physical return rejects nonexact life command1 without mutating input or RNG",
  "Wisdom Angel original finite evidence, current conditions and actual physical return rejects nonexact life command2 without mutating input or RNG",
  "Wisdom Angel original finite evidence, current conditions and actual physical return rejects nonexact life command3 without mutating input or RNG",
  "Wisdom Angel original finite evidence, current conditions and actual physical return rejects nonexact life command4 without mutating input or RNG",
  "Wisdom Angel original finite evidence, current conditions and actual physical return rejects nonexact life command5 without mutating input or RNG",
  "Wisdom Angel original finite evidence, current conditions and actual physical return rejects nonexact life command6 without mutating input or RNG",
  "Wisdom Angel original finite evidence, current conditions and actual physical return rejects forged physical identities, sheets, stored charges, versions, consent, movement, time and unearned effects",
  "Wisdom Angel original finite evidence, current conditions and actual physical return replays every recorded check and actual source and rejects missing, reordered, duplicated, backdated or forged history",
  "Wisdom Angel original finite evidence, current conditions and actual physical return replays captured FIRST_DEMONSTRATION unchanged under the original seed, without assuming a successful ability outcome",
  "Wisdom Angel original finite evidence, current conditions and actual physical return replays captured SWITCH_FILTER unchanged under the original seed, without assuming a successful ability outcome",
  "Wisdom Angel original finite evidence, current conditions and actual physical return replays captured SECOND_DEMONSTRATION unchanged under the original seed, without assuming a successful ability outcome",
  "Wisdom Angel original finite evidence, current conditions and actual physical return replays captured VERIFY_RESULT unchanged under the original seed, without assuming a successful ability outcome",
  "Wisdom Angel original finite evidence, current conditions and actual physical return replays captured WITHDRAW_CONSENT unchanged under the original seed, without assuming a successful ability outcome"
];
const argv = process.argv.slice(2);
if (argv.length && !(argv.length === 2 && argv[0] === '--output-dir')) {
  console.error('Usage: node scripts/test-wisdom-angel-life-isolated.mjs [--output-dir NEW_DIRECTORY]');
  process.exit(2);
}
const out = argv.length ? path.resolve(argv[1]) : path.join(repo, 'output', 'wisdom-angel-life-isolated-' + new Date().toISOString().replace(/[:.]/g, '-'));
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
    if (JSON.stringify(cases.map(item => item.fullName).sort()) !== JSON.stringify(expected)) throw new Error('Collected case inventory differs from the required thirty-three cases.');
    selected = cases.filter(item => item.fullName === name);
    const others = cases.filter(item => item.fullName !== name);
    if (selected.length !== 1 || selected[0].status !== 'passed') throw new Error('The exact selected case did not pass.');
    if (others.length !== 32 || others.some(item => item.status !== 'skipped')) throw new Error('Unselected cases were not explicitly filtered.');
    filtered = others.length;
  } catch (cause) { error = cause instanceof Error ? cause.message : String(cause); }
  const passed = result.status === 0 && result.signal === null && error === null;
  rows.push({ name, passed, exit: result.status, signal: result.signal, error, selectedPassed: passed ? 1 : 0, intentionallyFiltered: filtered });
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ testFile, expectedCases: names.length, completedCases: rows.length, passedCases: rows.filter(row => row.passed).length, rows }, null, 2) + '\n');
}
const success = rows.length === 33 && rows.every(row => row.passed);
console.log(`Wisdom Angel life isolated coverage: ${rows.filter(row => row.passed).length}/33 passed. Reports: ${out}`);
process.exitCode = success ? 0 : 1;
