#!/usr/bin/env node
// Match vitest.config.mts, partition every test once, and verify each batch report.
// The two existing per-case runners remain the only whole-file exceptions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const defaultRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHARD_COUNT = 4;
export const BATCH_SIZE = 5;
// Keep the single-worker batch bounded; compare large files as bytes, not object keys.
export const DEFAULT_NODE_OPTIONS = '--max-old-space-size=768';
export const ISOLATED_TESTS = Object.freeze([
  'tests/domain/catastrophe-shared.test.ts',
  'tests/domain/wisdom-angel-life.test.ts',
]);

export function assertTestPath(file) {
  if (typeof file !== 'string' || /[\\\0\r\n:]/.test(file)
    || !/^tests\/.+\.test\.tsx?$/.test(file)
    || file.split('/').some(part => part === '' || part === '.' || part === '..')) {
    throw new Error(`Unsafe or unsupported test path: ${JSON.stringify(file)}`);
  }
}

export function discoverTestFiles(repo = defaultRepo) {
  // Fail closed if the Vitest include/exclude contract changes.
  const config = fs.readFileSync(path.join(repo, 'vitest.config.mts'), 'utf8');
  if (!/\binclude\s*:\s*\[\s*["']tests\/\*\*\/\*\.test\.\{ts,tsx\}["']\s*,?\s*\]/.test(config)
    || /\bexclude\s*:/.test(config)) {
    throw new Error('Update CI discovery to match the changed Vitest include/exclude configuration.');
  }
  const files = [];
  function visit(relative) {
    const directory = path.join(repo, relative);
    if (fs.lstatSync(directory).isSymbolicLink()) throw new Error(`Symlink is not allowed in test discovery: ${relative}`);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      // These are Vitest's default excluded directory names.
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const file = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in test discovery: ${file}`);
      if (entry.isDirectory()) visit(file);
      else if (/\.test\.tsx?$/.test(entry.name)) {
        assertTestPath(file);
        if (!entry.isFile()) throw new Error(`Test path is not a regular file: ${file}`);
        files.push(file);
      }
    }
  }
  visit('tests');
  return files.sort();
}

export function assertCoverage(discovered, shards) {
  const assigned = [...shards.flat(), ...ISOLATED_TESTS];
  for (const file of [...discovered, ...assigned]) assertTestPath(file);
  if (shards.length !== SHARD_COUNT || shards.some(shard => shard.length === 0)) {
    throw new Error('Exactly four nonempty test shards are required.');
  }
  if (new Set(discovered).size !== discovered.length || new Set(assigned).size !== assigned.length) {
    throw new Error('Duplicate test file in discovery or CI assignment.');
  }
  if (JSON.stringify([...discovered].sort()) !== JSON.stringify(assigned.sort())) {
    throw new Error('CI shards plus the two isolated files must exactly equal all discovered tests.');
  }
}

export function createPlan(discovered) {
  const shards = Array.from({ length: SHARD_COUNT }, () => []);
  [...discovered].sort().filter(file => !ISOLATED_TESTS.includes(file))
    .forEach((file, index) => shards[index % SHARD_COUNT].push(file));
  assertCoverage(discovered, shards);
  return { discovered: [...discovered].sort(), shards, isolated: [...ISOLATED_TESTS] };
}

export function verifyBatchReport(report, expected, repo) {
  if (report.success !== true || !Array.isArray(report.testResults)) {
    throw new Error('Vitest did not report a successful completed batch.');
  }
  const actual = report.testResults.map(file => {
    if (typeof file.name !== 'string') throw new Error('Vitest report has no test file name.');
    const relative = path.relative(repo, path.resolve(repo, file.name)).split(path.sep).join('/');
    assertTestPath(relative);
    if (file.status !== 'passed' || !Array.isArray(file.assertionResults)
      || file.assertionResults.length === 0 || file.assertionResults.some(test => test.status !== 'passed')) {
      throw new Error(`Failed, skipped, todo, or unexecuted cases in ${relative}`);
    }
    return relative;
  });
  if (new Set(actual).size !== actual.length
    || JSON.stringify(actual.sort()) !== JSON.stringify([...expected].sort())) {
    throw new Error('Vitest executed file inventory differs from the requested batch.');
  }
}

export function runShard({ shard, repo = defaultRepo, execute = spawnSync, log = console.log }) {
  if (!Number.isInteger(shard) || shard < 1 || shard > SHARD_COUNT) {
    throw new Error('Shard must be an integer from 1 through 4.');
  }
  const plan = createPlan(discoverTestFiles(repo));
  const selected = plan.shards[shard - 1];
  const outputRoot = path.join(repo, 'output');
  fs.mkdirSync(outputRoot, { recursive: true });
  const output = fs.mkdtempSync(path.join(outputRoot, `ci-shard-${shard}-`));
  const summaryPath = path.join(output, 'summary.json');
  const summary = { ...plan, shard, batchSize: BATCH_SIZE, selected, passed: [], batches: [], success: false };
  const save = () => fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
  save();
  try {
    for (let offset = 0; offset < selected.length; offset += BATCH_SIZE) {
      const files = selected.slice(offset, offset + BATCH_SIZE);
      const batchNumber = summary.batches.length + 1;
      const reportPath = path.join(output, `batch-${String(batchNumber).padStart(3, '0')}.json`);
      log(`Shard ${shard}/4, batch ${batchNumber}: ${files.join(', ')}`);
      const batch = { files, passed: false };
      summary.batches.push(batch);
      save();
      const result = execute(process.execPath, [
        path.join(repo, 'node_modules/vitest/vitest.mjs'), 'run', ...files,
        '--maxWorkers=1', '--no-file-parallelism', '--reporter=default', '--reporter=json',
        `--outputFile=${reportPath}`,
      ], { cwd: repo, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || DEFAULT_NODE_OPTIONS } });
      if (result.error || result.status !== 0 || result.signal != null) {
        throw new Error(`Vitest batch ${batchNumber} failed: ${result.error?.message ?? result.signal ?? `exit ${result.status}`}`);
      }
      verifyBatchReport(JSON.parse(fs.readFileSync(reportPath, 'utf8')), files, repo);
      batch.passed = true;
      summary.passed.push(...files);
      save();
    }
    summary.success = summary.passed.length === selected.length;
    if (!summary.success) throw new Error('The shard contains unexecuted test files.');
  } catch (error) {
    summary.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    save();
    log(`Shard ${shard}/4: ${summary.passed.length}/${selected.length} files passed. Reports: ${output}`);
  }
  return summary;
}

export function main(argv = process.argv.slice(2)) {
  if (argv.length === 1 && argv[0] === '--check-inventory') {
    const plan = createPlan(discoverTestFiles());
    console.log(`Inventory only (tests not run): ${plan.discovered.length} files = shards [${plan.shards.map(shard => shard.length).join(', ')}] + ${plan.isolated.length} isolated files.`);
    return;
  }
  if (argv.length !== 2 || argv[0] !== '--shard' || !/^[1-4]\/4$/.test(argv[1])) {
    throw new Error('Usage: node scripts/test-ci-batches.mjs --shard N/4 | --check-inventory');
  }
  runShard({ shard: Number(argv[1][0]) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
