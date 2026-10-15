import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_SOURCE = 'tests/fixtures/sage-v01780';
const CHECKS = ['rollback-no-receipt', 'reopen-before-no-receipt', 'public-private-equality', 'reopen-after', 'idempotent-retry'];
const integer = (value, minimum, label) => {
  const result = Number(value);
  assert(Number.isSafeInteger(result) && result >= minimum, `${label} must be an integer >= ${minimum}`);
  return result;
};

// The former save scripts' positional key/tag/start/count remain supported.
export function parseArguments(args) {
  const options = { key: 'boundaries', tag: 'natural', sourceDirectory: DEFAULT_SOURCE, outputDirectory: 'output/qa-0178/sqlite', start: 0 };
  const positional = [], flags = new Set();
  const setters = {
    '--source-directory': value => { options.sourceDirectory = value; },
    '--output-directory': value => { options.outputDirectory = value; },
    '--expected-boundaries': value => { options.expectedBoundaries = integer(value, 1, 'Expected boundaries'); },
    '--start': value => { options.start = integer(value, 0, 'Start'); },
    '--count': value => { options.count = integer(value, 1, 'Count'); },
    '--tag': value => { options.tag = value; },
    '--key': value => { options.key = value; },
  };
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (value === '--help') { options.help = true; continue; }
    if (!value.startsWith('--')) { positional.push(value); continue; }
    assert(setters[value], `Unknown option: ${value}`);
    assert(!flags.has(value), `Repeated option: ${value}`);
    flags.add(value);
    assert(args[i + 1] && !args[i + 1].startsWith('--'), `Missing value: ${value}`);
    setters[value](args[++i]);
  }
  assert(positional.length <= 4, 'Expected at most key, tag, start, count');
  for (const [i, flag] of ['--key', '--tag', '--start', '--count'].entries()) {
    if (positional[i] === undefined) continue;
    assert(!flags.has(flag), `Do not mix positional and named ${flag}`);
    setters[flag](positional[i]);
  }
  assert(['boundaries', 'directed'].includes(options.key), 'Key must be boundaries or directed');
  assert(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(options.tag), 'Tag must be a simple filename token');
  return options;
}

export function fileEvidence(path) {
  const fd = openSync(path, 'r'), buffer = Buffer.allocUnsafe(64 * 1024), hash = createHash('sha256');
  let bytes = 0;
  try {
    for (;;) {
      const n = readSync(fd, buffer, 0, buffer.length, null);
      if (!n) break;
      bytes += n; hash.update(buffer.subarray(0, n));
    }
  } finally { closeSync(fd); }
  assert.equal(bytes, statSync(path).size, `Source size changed: ${path}`);
  return { bytes, sha256: hash.digest('hex') };
}

export function inspectSources(options) {
  const root = realpathSync(options.sourceDirectory);
  const indexPath = join(root, `${options.key}.index.json`), indexEvidence = fileEvidence(indexPath);
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  assert(index && typeof index === 'object' && !Array.isArray(index), 'Boundary index must be an object');
  const names = Object.keys(index);
  assert(names.length > 0, 'Boundary index must not be empty');
  if (options.expectedBoundaries !== undefined) assert.equal(names.length, options.expectedBoundaries, 'Unexpected source boundary count');
  const entries = names.map(name => {
    const filename = index[name];
    assert(typeof filename === 'string' && filename.endsWith('.json') && !isAbsolute(filename), `Invalid boundary filename: ${name}`);
    const path = realpathSync(join(root, filename)), inside = relative(root, path);
    assert(inside && !inside.startsWith(`..${sep}`) && inside !== '..' && !isAbsolute(inside), `Boundary escapes source directory: ${name}`);
    return { name, filename, path };
  });
  const start = integer(options.start ?? 0, 0, 'Start');
  const count = integer(options.count ?? names.length - start, 1, 'Count');
  assert(start < names.length && start + count <= names.length, 'Requested range must exist in full; partial or empty verification is not success');
  return { root, indexPath, indexEvidence, entries, selected: entries.slice(start, start + count), start, count };
}

async function loadRuntime() {
  const [{ SqliteSliceStore }, { projectSliceState, assertValidSliceState }, { migrateSliceState }] = await Promise.all([
    import('../../dist/persistence/slice-store.js'), import('../../dist/domain/slice/index.js'), import('../../dist/domain/slice/migration.js'),
  ]);
  return { SqliteSliceStore, projectSliceState, assertValidSliceState, migrateSliceState };
}

export async function verifySageBoundaries(options, runtime) {
  const source = inspectSources(options);
  const { SqliteSliceStore, projectSliceState, assertValidSliceState, migrateSliceState } = runtime ?? await loadRuntime();
  mkdirSync(options.outputDirectory, { recursive: true });
  // Only a newly created verification directory is writable. No supplied/player DB is opened or removed.
  const outputDir = mkdtempSync(join(options.outputDirectory, `${options.key}-${options.tag}-`));
  const commonDatabase = join(outputDir, 'verification.sqlite'), checks = [];
  const provenance = ['natural.json', 'summary.json'].filter(name => existsSync(join(source.root, name)))
    .map(filename => ({ filename, ...fileEvidence(join(source.root, filename)) }));
  let current = null;
  try {
    for (const [ordinal, entry] of source.selected.entries()) {
      current = entry.name;
      const rawBytes = readFileSync(entry.path), sourceEvidence = { bytes: rawBytes.length, sha256: createHash('sha256').update(rawBytes).digest('hex') };
      const raw = JSON.parse(rawBytes.toString('utf8'));
      assert(raw.beforeLast && raw.lastIntent && raw.final, `Missing beforeLast/lastIntent/final: ${entry.name}`);
      const before = migrateSliceState(raw.beforeLast), after = migrateSliceState(raw.final);
      assertValidSliceState(before); assertValidSliceState(after);
      assert.equal(before.status, 'ACTIVE', `${entry.name}: source must be a live pre-intent state`);
      assert.equal(after.runId, before.runId, `${entry.name}: run identity changed`);
      assert.equal(after.revision, before.revision + 1, `${entry.name}: not one committed intent`);
      // A death sidecar seals its real runId permanently. Each death branch gets a unique DB,
      // even if several independent directed branches preserve the same source runId.
      const database = after.status === 'DEAD' ? join(outputDir, `terminal-${ordinal + source.start}.sqlite`) : commonDatabase;
      if (existsSync(database)) {
        assert.equal(database, commonDatabase);
        const db = new DatabaseSync(database);
        try { db.exec('BEGIN IMMEDIATE; DELETE FROM slice_receipts; DELETE FROM slice_runs; DELETE FROM slice_meta; COMMIT;'); }
        finally { db.close(); }
      }
      let app, fail = false;
      const envelope = { intentId: `sage178:${options.key}:${source.start + ordinal}:${entry.name}`, runId: before.runId, expectedRevision: before.revision, payload: raw.lastIntent };
      try {
        app = new SqliteSliceStore(database, { beforeWrite: () => { if (fail) throw Error('simulated write failure'); } });
        app.repository.transaction(() => {
          app.repository.put({ state: before, updatedAt: '2026-10-15T00:00:00.000Z' });
          app.repository.selectRun(before.runId);
        });
        fail = true;
        const rejected = app.submitIntent(envelope);
        assert.equal(rejected.ok, false, `${entry.name}: injected failure unexpectedly succeeded`);
        assert.equal(rejected.error.code, 'SAVE_FAILED', JSON.stringify(rejected));
        assert.deepEqual(app.repository.get(before.runId).state, before);
        assert.equal(app.repository.receipt(envelope.intentId), null);
        assert.equal(existsSync(`${database}.sealed`), false, 'Rolled-back death must not leave a terminal sidecar');
        app.close(); app = undefined; app = new SqliteSliceStore(database);
        assert.deepEqual(app.repository.get(before.runId).state, before);
        assert.equal(app.repository.receipt(envelope.intentId), null);
        assert.equal(app.repository.activeRun(), before.runId);
        const result = app.submitIntent(envelope);
        assert.equal(result.ok, true, JSON.stringify(result));
        assert.equal(result.value.replayed, false);
        assert.deepEqual(result.value.state, projectSliceState(after));
        assert.deepEqual(app.repository.get(before.runId).state, after);
        assert.deepEqual(app.repository.receipt(envelope.intentId).receipt, result.value);
        app.close(); app = undefined; app = new SqliteSliceStore(database);
        assert.deepEqual(app.repository.get(before.runId).state, after);
        const replay = app.submitIntent(envelope);
        assert.equal(replay.ok, true, JSON.stringify(replay));
        assert.equal(replay.value.replayed, true);
        assert.deepEqual(replay.value, { ...result.value, replayed: true });
        assert.deepEqual(app.repository.get(before.runId).state, after);
        if (after.status === 'DEAD') assert.deepEqual(JSON.parse(readFileSync(`${database}.sealed`, 'utf8')), [before.runId]);
      } finally { app?.close(); }
      assert.deepEqual(fileEvidence(entry.path), sourceEvidence, `${entry.name}: source bytes changed`);
      const row = {
        name: entry.name, source: entry.filename, sourceBytes: sourceEvidence.bytes, sourceSha256: sourceEvidence.sha256,
        status: after.status, revision: after.revision,
        finalSha256: createHash('sha256').update(JSON.stringify(after)).digest('hex'),
        database: relative(outputDir, database), checks: [...CHECKS, ...(after.status === 'DEAD' ? ['unique-terminal-sidecar'] : [])],
      };
      checks.push(row); console.log(JSON.stringify(row)); global.gc?.();
    }
    assert.equal(checks.length, source.count, 'Not every requested boundary was verified');
    assert.deepEqual(fileEvidence(source.indexPath), source.indexEvidence, 'Boundary index bytes changed');
    for (const item of provenance) assert.deepEqual(fileEvidence(join(source.root, item.filename)), { bytes: item.bytes, sha256: item.sha256 }, `${item.filename}: source bytes changed`);
    const summary = {
      passed: true, sourceDirectory: source.root, outputDir, key: options.key,
      sourceBoundaryCount: source.entries.length, expectedBoundaryCount: options.expectedBoundaries ?? source.entries.length,
      start: source.start, requestedBoundaryCount: source.count, boundaries: checks.length,
      fullIndexVerified: checks.length === source.entries.length && source.start === 0,
      uniqueSourceFiles: new Set(checks.map(row => row.source)).size,
      uniqueSourceBytes: new Set(checks.map(row => row.sourceSha256)).size,
      uniqueFinalStates: new Set(checks.map(row => row.finalSha256)).size,
      boundaryBytes: checks.reduce((sum, row) => sum + row.sourceBytes, 0),
      index: { filename: `${options.key}.index.json`, ...source.indexEvidence }, provenance,
      terminalBoundaries: checks.filter(row => row.status === 'DEAD').length,
      checks,
    };
    writeFileSync(join(outputDir, 'summary.json'), JSON.stringify(summary, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ passed: true, boundaries: summary.boundaries, sourceBoundaryCount: summary.sourceBoundaryCount, uniqueFinalStates: summary.uniqueFinalStates, outputDir }));
    return summary;
  } catch (error) {
    writeFileSync(join(outputDir, 'failure.json'), JSON.stringify({ passed: false, failedBoundary: current, verifiedBoundaries: checks.length, expectedBoundaries: source.count, error: String(error), checks }, null, 2), { flag: 'wx' });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) console.log('Usage: node --expose-gc scripts/play/sage-save.mjs [boundaries|directed] [tag] [start] [count] [--source-directory DIR] [--expected-boundaries N] [--output-directory DIR]\nDefault source: tests/fixtures/sage-v01780. Output always uses a new unique subdirectory.');
    else await verifySageBoundaries(options);
  } catch (error) { console.error(error); process.exitCode = 1; }
}
