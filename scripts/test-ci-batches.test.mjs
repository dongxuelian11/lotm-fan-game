import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  SHARD_COUNT, BATCH_SIZE, DEFAULT_NODE_OPTIONS, ISOLATED_TESTS, assertTestPath, discoverTestFiles,
  assertCoverage, createPlan, verifyBatchReport, runShard,
} from './test-ci-batches.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Keep every shard multi-batch, with shard 1 retaining its five-plus-two split.
const sampleFiles = Array.from({ length: 49 }, (_, index) => `tests/domain/case-${String(index).padStart(2, '0')}.test.ts`);

function fixture(t, files = [...sampleFiles, ...ISOLATED_TESTS]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-batches-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'vitest.config.mts'), 'export default { test: { include: ["tests/**/*.test.{ts,tsx}"] } };');
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '');
  }
  return root;
}

function passedReport(files, root) {
  return {
    success: true,
    testResults: files.map(file => ({
      name: path.join(root, file), status: 'passed', assertionResults: [{ status: 'passed' }],
    })),
  };
}

function fakeSuccess(command, args, options) {
  assert.equal(command, process.execPath);
  assert.equal(args[0], path.join(options.cwd, 'node_modules/vitest/vitest.mjs'));
  assert.equal(args[1], 'run');
  assert.ok(args.includes('--maxWorkers=1'));
  assert.ok(args.includes('--no-file-parallelism'));
  assert.equal(options.shell, undefined);
  const files = args.slice(2).filter(arg => !arg.startsWith('--'));
  assert.ok(files.length >= 1 && files.length <= BATCH_SIZE);
  const reportPath = args.find(arg => arg.startsWith('--outputFile=')).slice('--outputFile='.length);
  fs.writeFileSync(reportPath, JSON.stringify(passedReport(files, options.cwd)));
  return { status: 0, signal: null };
}

test('repository discovery covers the exact configured glob, including new regression files', () => {
  const discovered = discoverTestFiles(repo);
  const independent = [...fs.globSync('tests/**/*.test.{ts,tsx}', { cwd: repo })].map(file => file.split(path.sep).join('/')).sort();
  assert.deepEqual(discovered, independent);
  assert.ok(discovered.length >= 983);
  const plan = createPlan(discovered);
  assertCoverage(discovered, plan.shards);
  assert.equal(plan.shards.flat().length + plan.isolated.length, discovered.length);
});

test('discovery includes root, nested ts and tsx tests and ignores helpers and default excludes', t => {
  const expected = ['tests/root.test.ts', 'tests/a/nested.test.ts', 'tests/b/view.test.tsx'];
  const root = fixture(t, [...expected, 'tests/a/helper.ts', 'tests/a/old.test.js', 'tests/node_modules/hidden.test.ts', 'tests/.git/hidden.test.ts']);
  assert.deepEqual(discoverTestFiles(root), expected.sort());
});

test('changed Vitest include or exclude fails closed', t => {
  const root = fixture(t);
  for (const source of [
    'export default { test: { include: ["other/**/*.test.ts"] } };',
    'export default { test: { include: ["tests/**/*.test.{ts,tsx}"], exclude: ["tests/domain/**"] } };',
  ]) {
    fs.writeFileSync(path.join(root, 'vitest.config.mts'), source);
    assert.throws(() => discoverTestFiles(root), /changed Vitest/);
  }
});

test('eight deterministic shards plus exactly two fixed isolated exceptions cover every file once', () => {
  assert.equal(SHARD_COUNT, 8);
  assert.equal(BATCH_SIZE, 5);
  assert.deepEqual(ISOLATED_TESTS, ['tests/domain/catastrophe-shared.test.ts', 'tests/domain/wisdom-angel-life.test.ts']);
  assert.ok(Object.isFrozen(ISOLATED_TESTS));
  const discovered = [...sampleFiles, ...ISOLATED_TESTS];
  const plan = createPlan(discovered);
  assert.deepEqual(createPlan([...discovered].reverse()), plan);
  assert.deepEqual(plan.shards.map(shard => shard.length), [7, 6, 6, 6, 6, 6, 6, 6]);
  assert.deepEqual([...plan.shards.flat(), ...plan.isolated].sort(), [...discovered].sort());
  assert.equal(new Set([...plan.shards.flat(), ...plan.isolated]).size, discovered.length);
  assert.ok(plan.shards.flat().every(file => !ISOLATED_TESTS.includes(file)));
  const added = createPlan([...discovered, 'tests/backend/new-regression.test.ts']);
  assert.equal(added.shards.flat().filter(file => file === 'tests/backend/new-regression.test.ts').length, 1);
});

test('missing, duplicate, or unexpected file assignments fail coverage', () => {
  const discovered = [...sampleFiles, ...ISOLATED_TESTS];
  const plan = createPlan(discovered);
  for (const change of [
    shards => shards[0].pop(),
    shards => shards[0].push(shards[1][0]),
    shards => shards[0].push('tests/domain/unexpected.test.ts'),
    shards => shards[0].push(ISOLATED_TESTS[0]),
  ]) {
    const shards = structuredClone(plan.shards);
    change(shards);
    assert.throws(() => assertCoverage(discovered, shards), /Duplicate|exactly equal/);
  }
  assert.throws(() => createPlan([...discovered, sampleFiles[0]]), /Duplicate/);
  assert.throws(() => createPlan(discovered.filter(file => file !== ISOLATED_TESTS[0])), /exactly equal/);
});

test('empty discovery, empty shards, and invalid shard numbers are rejected before execution', t => {
  for (const files of [[], [...ISOLATED_TESTS], [...ISOLATED_TESTS, ...sampleFiles.slice(0, 3)],
    [...ISOLATED_TESTS, ...sampleFiles.slice(0, 7)]]) {
    assert.throws(() => createPlan(files), /nonempty/);
  }
  const discovered = [...sampleFiles, ...ISOLATED_TESTS];
  const plan = createPlan(discovered);
  for (const shards of [plan.shards.slice(0, 7), [...plan.shards, []],
    [...plan.shards.slice(0, 7), []]]) {
    assert.throws(() => assertCoverage(discovered, shards), /Exactly eight nonempty/);
  }
  const root = fixture(t);
  for (const shard of [0, 9, 1.5, NaN, '1']) {
    assert.throws(() => runShard({ repo: root, shard, execute: () => assert.fail('must not execute') }), /Shard must/);
  }
});

test('unsafe paths, Windows paths, traversal, and option-shaped input are rejected', () => {
  for (const file of ['../tests/a.test.ts', '/tests/a.test.ts', 'C:/tests/a.test.ts', 'tests\\a.test.ts',
    'tests/../a.test.ts', 'tests/./a.test.ts', 'tests//a.test.ts', 'tests/a\0.test.ts',
    'tests/a\n.test.ts', '--passWithNoTests', 'tests/a.test.js']) {
    assert.throws(() => assertTestPath(file), /Unsafe/);
  }
  assert.doesNotThrow(() => assertTestPath('tests/domain/space in name.test.tsx'));
});

test('directory symlinks cannot escape the test tree', t => {
  const root = fixture(t);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  fs.writeFileSync(path.join(outside, 'external.test.ts'), '');
  // Junctions do not require Windows developer-mode symlink privileges.
  fs.symlinkSync(outside, path.join(root, 'tests', 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => discoverTestFiles(root), /Symlink/);
});

test('batches never exceed five and every assigned file is reported passed exactly once', t => {
  const root = fixture(t);
  const calls = [];
  const result = runShard({ repo: root, shard: 1, log() {}, execute(...args) {
    calls.push(args);
    return fakeSuccess(...args);
  } });
  assert.equal(calls.length, 2);
  assert.deepEqual(result.batches.map(batch => batch.files.length), [5, 2]);
  assert.deepEqual(result.passed, createPlan(discoverTestFiles(root)).shards[0]);
  assert.equal(result.success, true);
});

test('nonzero exits, signals, spawn errors and thrown execution failures cannot pass', t => {
  for (const result of [{ status: 7, signal: null }, { status: null, signal: 'SIGTERM' },
    { status: null, signal: null, error: new Error('spawn failed') }, null]) {
    const root = fixture(t);
    let calls = 0;
    assert.throws(() => runShard({ repo: root, shard: 1, log() {}, execute() {
      calls += 1;
      if (result === null) throw new Error('executor threw');
      return result;
    } }), /failed|executor threw/);
    assert.equal(calls, 1);
    const [folder] = fs.readdirSync(path.join(root, 'output'));
    const summary = JSON.parse(fs.readFileSync(path.join(root, 'output', folder, 'summary.json'), 'utf8'));
    assert.equal(summary.success, false);
    assert.equal(summary.passed.length, 0);
    assert.ok(summary.error);
  }
});

test('a zero exit without a valid complete report is still failure', t => {
  for (const report of [null, '{broken json', JSON.stringify({ success: true, testResults: [] })]) {
    const root = fixture(t);
    assert.throws(() => runShard({ repo: root, shard: 1, log() {}, execute(command, args) {
      if (report !== null) fs.writeFileSync(args.find(arg => arg.startsWith('--outputFile=')).slice('--outputFile='.length), report);
      return { status: 0, signal: null };
    } }));
  }
});

test('a later failed or incomplete batch preserves only earlier confirmed files', t => {
  for (const incompleteReport of [false, true]) {
    const root = fixture(t);
    const selected = createPlan(discoverTestFiles(root)).shards[0];
    let calls = 0;
    assert.throws(() => runShard({ repo: root, shard: 1, log() {}, execute(...args) {
      calls += 1;
      if (calls === 1) return fakeSuccess(...args);
      if (!incompleteReport) return { status: 7, signal: null };
      const result = fakeSuccess(...args);
      const reportPath = args[1].find(arg => arg.startsWith('--outputFile=')).slice('--outputFile='.length);
      fs.writeFileSync(reportPath, JSON.stringify(passedReport(selected.slice(BATCH_SIZE, -1), root)));
      return result;
    } }), /Vitest batch 2 failed|inventory differs/);
    assert.equal(calls, 2);
    const [folder] = fs.readdirSync(path.join(root, 'output'));
    const summary = JSON.parse(fs.readFileSync(path.join(root, 'output', folder, 'summary.json'), 'utf8'));
    assert.equal(summary.success, false);
    assert.deepEqual(summary.selected, selected);
    assert.deepEqual(summary.passed, selected.slice(0, BATCH_SIZE));
    assert.deepEqual(summary.batches.map(batch => batch.files.length), [5, 2]);
    assert.deepEqual(summary.batches.map(batch => batch.passed), [true, false]);
    assert.ok(summary.error);
  }
});

test('report verification rejects failed, skipped, todo, empty and mismatched execution', () => {
  const expected = sampleFiles.slice(0, 2);
  const valid = passedReport(expected, repo);
  assert.doesNotThrow(() => verifyBatchReport(valid, expected, repo));
  for (const change of [
    report => { report.success = false; },
    report => { report.testResults[0].status = 'failed'; },
    report => { report.testResults[0].assertionResults = []; },
    report => { report.testResults[0].assertionResults[0].status = 'failed'; },
    report => { report.testResults[0].assertionResults[0].status = 'skipped'; },
    report => { report.testResults[0].assertionResults[0].status = 'todo'; },
    report => { report.testResults.pop(); },
    report => { report.testResults[1] = report.testResults[0]; },
    report => { report.testResults[0].name = path.join(repo, 'tests/extra.test.ts'); },
    report => { report.testResults[0].name = path.resolve(repo, '../outside.test.ts'); },
  ]) {
    const report = structuredClone(valid);
    change(report);
    assert.throws(() => verifyBatchReport(report, expected, repo));
  }
});

test('CLI rejects malformed or missing shard arguments with a nonzero process exit', () => {
  for (const args of [[], ['--shard', '0/8'], ['--shard', '9/8'], ['--shard', '1/4'],
    ['--shard', '1/5'], ['--shard', '01/8'], ['--shard', '1/8\n'], ['--shard', '1/8 '],
    ['--shard', '1/8', '--passWithNoTests'], ['--shard', '../1']]) {
    const result = spawnSync(process.execPath, [path.join(repo, 'scripts/test-ci-batches.mjs'), ...args], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Usage:/);
  }
});

test('CLI propagates a real child process failure instead of claiming incomplete coverage passed', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, 'scripts'));
  const runner = path.join(root, 'scripts/test-ci-batches.mjs');
  fs.copyFileSync(path.join(repo, 'scripts/test-ci-batches.mjs'), runner);
  // No Vitest is installed in this temporary fixture. Node must fail to launch it.
  for (const shard of [1, 8]) {
    const result = spawnSync(process.execPath, [runner, '--shard', `${shard}/8`], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Vitest batch 1 failed: exit 1/);
    assert.ok(result.stdout.includes(`Shard ${shard}/8: 0/${shard === 1 ? 7 : 6} files passed.`));
  }
});


test('uses the bounded integration heap default and preserves explicit caller options', t => {
  const root = fixture(t);
  const original = process.env.NODE_OPTIONS;
  try {
    for (const requested of [undefined, '--max-old-space-size=2048 --trace-warnings']) {
      if (requested === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = requested;
      const values = [];
      runShard({ repo: root, shard: 1, log() {}, execute(command, args, options) {
        values.push(options.env.NODE_OPTIONS);
        return fakeSuccess(command, args, options);
      } });
      assert.equal(DEFAULT_NODE_OPTIONS, '--max-old-space-size=768');
      assert.ok(values.length > 0);
      assert.ok(values.every(value => value === (requested ?? DEFAULT_NODE_OPTIONS)));
    }
  } finally {
    if (original === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = original;
  }
});
