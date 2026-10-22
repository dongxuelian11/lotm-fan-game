import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { FORMAT, INPUT_FORMAT, archiveCompletedCase, assertFreeze, assertInputManifest, assertOutputPath, assertPortComparisonRows, assertProducerOnlyFreezeChange, assertResumeManifest, claimAuditLock,
  fileEvidence, inspectCaptureInputs, parseOptions, safeRelativeFile, selectBoundaries, stateHash, verifyVisionaryCapture } from './visionary-save.mjs';

// Contracts only: no game/dist imports, source fixtures, natural play or SQLite.
const sha = value => createHash('sha256').update(value).digest('hex');
const evidence = (file, digit = 'a') => ({ file, bytes: 5, sha256: digit.repeat(64) });
const freeze = files => ({ files, nodeVersion: 'v24.15.0', sha256: sha(JSON.stringify(files)) });
function workspace(run) {
  const root = mkdtempSync(join(tmpdir(), 'visionary-save-contract-'));
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('import is safe with an empty working directory and no compiled runtime', () => workspace(root => {
  execFileSync(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(new URL('./visionary-save.mjs', import.meta.url).href)});`], { cwd: root });
  assert.deepEqual(readdirSync(root), []);
}));

test('relative evidence paths reject traversal, absolute paths and ambiguous separators', () => {
  assert.equal(safeRelativeFile('boundary-660-guidance.json'), 'boundary-660-guidance.json');
  assert.equal(safeRelativeFile('retained/error.json'), 'retained/error.json');
  for (const path of ['', '../secret', '/absolute', 'C:/absolute', 'a/../b', './a', 'a//b', 'a\\b', 'a/', 'a\0b']) assert.throws(() => safeRelativeFile(path));
});

test('complete input hash sets reject omissions, additions, duplicates, order drift and empty captures', () => {
  const original = { format: INPUT_FORMAT, files: [evidence('a.json'), evidence('b.json', 'b')] };
  assertInputManifest(original, structuredClone(original));
  for (const files of [[], original.files.slice(1), [...original.files, evidence('c.json')], [...original.files].reverse(),
    [original.files[0], original.files[0]], [{ ...original.files[0], sha256: 'c'.repeat(64) }, original.files[1]],
    [{ ...original.files[0], bytes: 6 }, original.files[1]]]) assert.throws(() => assertInputManifest({ format: INPUT_FORMAT, files }, original));
  assert.throws(() => assertInputManifest({ ...original, extra: true }, original));
});

test('file set inspection hashes nested bytes and retained interruption evidence', () => workspace(root => {
  mkdirSync(join(root, 'capture')); const capture = join(root, 'capture'); mkdirSync(join(capture, 'retained'));
  writeFileSync(join(capture, 'checkpoint.json'), 'original'); writeFileSync(join(capture, 'retained', 'error.json'), 'interrupted');
  const original = inspectCaptureInputs(capture);
  assert.deepEqual(original.files.map(row => row.file), ['checkpoint.json', 'retained/error.json']);
  assert.deepEqual(original.files[0], { file: 'checkpoint.json', bytes: 8, sha256: sha('original') });
  writeFileSync(join(capture, 'checkpoint.json'), 'modified'); assert.throws(() => assertInputManifest(inspectCaptureInputs(capture), original));
}));

test('input files, nested directories and output ancestors cannot be symlinks', () => workspace(root => {
  const capture = join(root, 'capture'); mkdirSync(capture); writeFileSync(join(root, 'outside.json'), 'outside');
  symlinkSync(join(root, 'outside.json'), join(capture, 'alias.json'));
  assert.throws(() => inspectCaptureInputs(capture)); assert.throws(() => fileEvidence(join(capture, 'alias.json')));
  rmSync(join(capture, 'alias.json')); mkdirSync(join(root, 'outside')); symlinkSync(join(root, 'outside'), join(capture, 'alias'));
  assert.throws(() => inspectCaptureInputs(capture));
  assert.throws(() => assertOutputPath(join(capture, 'alias', 'new'), []));
}));

test('output cannot be an input, its ancestor or its descendant', () => workspace(root => {
  const input = join(root, 'capture'); mkdirSync(input);
  for (const output of [input, join(input, 'audit'), root]) assert.throws(() => assertOutputPath(output, [input]));
  assert.equal(assertOutputPath(join(root, 'audit'), [input]), join(root, 'audit')); assert(!existsSync(join(root, 'audit')));
}));

test('freeze binds exact ordered source/runtime/dependency bytes and Node version', () => {
  const original = freeze([evidence('src/a.ts'), evidence('dist/a.js', 'b'), evidence('node_modules/@noble/hashes/sha2.js', 'c'), evidence('$natural-producer', 'd')]);
  assertFreeze(original, structuredClone(original));
  for (const changed of [freeze(original.files.slice(1)), freeze([...original.files].reverse()), freeze([...original.files, original.files[0]]),
    freeze(original.files.map(row => ({ ...row, bytes: row.bytes + 1 }))), { ...original, nodeVersion: 'v24.16.0' }, { ...original, sha256: 'e'.repeat(64) },
    { ...original, ignoredRuntime: true }]) assert.throws(() => assertFreeze(original, changed));
});

test('resume fingerprint binds complete inputs, runtime, verifier, selection and paths', () => {
  const manifest = { format: FORMAT, inputs: { format: INPUT_FORMAT, files: [evidence('checkpoint.json')] }, freeze: freeze([evidence('$natural-producer')]),
    verifier: evidence('verifier.mjs'), selected: [{ commandCount: 660 }], sourceDirectory: '/capture', repo: '/repo' };
  assertResumeManifest(manifest, structuredClone(manifest));
  for (const key of Object.keys(manifest)) assert.throws(() => assertResumeManifest(manifest, { ...manifest, [key]: null }));
});

test('the exact port-wait continuation permits only producer bytes to change', () => {
  const before = freeze([evidence('src/a.ts'), evidence('dist/a.js', 'b'), evidence('$natural-producer', 'c')]);
  const after = freeze([evidence('src/a.ts'), evidence('dist/a.js', 'b'), evidence('$natural-producer', 'd')]);
  assertProducerOnlyFreezeChange(before, after);
  assert.throws(() => assertProducerOnlyFreezeChange(before, before));
  assert.throws(() => assertProducerOnlyFreezeChange(before, freeze([evidence('src/a.ts', 'e'), ...after.files.slice(1)])));
  assert.throws(() => assertProducerOnlyFreezeChange(before, { ...after, nodeVersion: 'v24.16.0' }));
});

test('the 97 recorded port-continuation comparisons bind every original row', () => {
  const rows = Array.from({ length: 97 }, (_, i) => ({ commandCount: 660 + i, afterStateSha256: sha(`private-${i}`), publicAfterSha256: sha(`public-${i}`), randomAfterSha256: sha(`random-${i}`) }));
  const comparisons = rows.map(row => ({ commandCount: row.commandCount, privateSha256: row.afterStateSha256, publicSha256: row.publicAfterSha256, randomSha256: row.randomAfterSha256 }));
  assertPortComparisonRows(comparisons, rows);
  assert.throws(() => assertPortComparisonRows(comparisons.slice(1), rows));
  for (const key of ['privateSha256', 'publicSha256', 'randomSha256']) {
    const altered = structuredClone(comparisons); altered[50][key] = 'f'.repeat(64); assert.throws(() => assertPortComparisonRows(altered, rows));
  }
});

function boundary(commandCount, marker = 'actual') {
  return { commandCount, beforeLast: { marker }, lastIntent: { type: 'VISIONARY', command: { type: 'REST' } }, final: { marker }, public: { marker }, audit: { marker } };
}
function index(file, commandCount, kind = 'first-rest') { return { ...evidence(file), commandCount, kind }; }
test('identical real command counts are one transition with multiple semantic aliases', () => {
  const entries = [index('later.json', 670), index('first.json', 660, 'learn_guidance'), index('alias.json', 670, 'final-boundary')];
  const selected = selectBoundaries(entries, item => boundary(item.commandCount));
  assert.equal(selected.length, 2); assert.deepEqual(selected.map(row => row.commandCount), [660, 670]);
  assert.deepEqual(selected[1].files, ['later.json', 'alias.json']); assert.deepEqual(selected[1].kinds, ['first-rest', 'final-boundary']);
  assert.equal(selected[1].boundarySha256, stateHash(boundary(670)));
});

test('empty, conflicting duplicate and malformed boundaries never become coverage', () => {
  assert.throws(() => selectBoundaries([], () => {}));
  assert.throws(() => selectBoundaries([index('a.json', 660), index('b.json', 660)], item => boundary(660, item.file)));
  assert.throws(() => selectBoundaries([index('a.json', 660), index('a.json', 660)], item => boundary(item.commandCount)));
  assert.throws(() => selectBoundaries([index('a.json', 660)], () => boundary(661)));
  assert.throws(() => selectBoundaries([index('a.json', 660)], () => ({ ...boundary(660), synthesized: true })));
  assert.throws(() => selectBoundaries([index('../a.json', 660)], () => boundary(660)));
});

test('live PID is never ignored even with exact stale-lock approval', () => workspace(root => {
  const hash = 'a'.repeat(64), lock = join(root, 'audit.lock.json');
  const owner = { format: FORMAT, manifestSha256: hash, pid: process.pid }; writeFileSync(lock, JSON.stringify(owner));
  assert.throws(() => claimAuditLock(root, hash));
  assert.throws(() => claimAuditLock(root, hash, process.pid), /live or uncertain/);
  assert.deepEqual(JSON.parse(readFileSync(lock, 'utf8')), owner);
  rmSync(lock); const release = claimAuditLock(root, hash); assert(existsSync(lock)); release(); assert(!existsSync(lock));
}));

test('preflight rejects an empty capture without runtime import, SQLite or output writes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'visionary-empty-preflight-'));
  try {
    const capture = join(root, 'capture'); mkdirSync(capture); const manifest = join(root, 'inputs.json');
    writeFileSync(manifest, JSON.stringify({ format: INPUT_FORMAT, files: [] }));
    const self = fileURLToPath(new URL('./visionary-save.mjs', import.meta.url));
    await assert.rejects(verifyVisionaryCapture({ repo: dirname(dirname(dirname(self))), sourceDirectory: capture,
      inputManifest: manifest, inputManifestSha256: fileEvidence(manifest).sha256, freezeSha256: 'a'.repeat(64), verifierSha256: fileEvidence(self).sha256, preflight: true }), /Empty capture/);
    assert.deepEqual(readdirSync(root).sort(), ['capture', 'inputs.json']); assert.deepEqual(readdirSync(capture), []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI is explicit and rejects duplicate flags, ambiguous resume, and preflight writes', () => {
  assert.deepEqual(parseOptions(['--source-directory', 'capture', '--preflight']), { sourceDirectory: 'capture', preflight: true });
  assert.equal(parseOptions(['--expected-boundaries', '33']).expectedBoundaries, 33);
  assert.equal(parseOptions(['--remove-stale-lock-pid', '123']).removeStaleLockPid, 123);
  for (const args of [['--expected-boundaries', '0'], ['--remove-stale-lock-pid', '-1'], ['--preflight', '--preflight'], ['--source-directory'],
    ['--source-directory', '--preflight'], ['--unknown', 'x'], ['--output-directory', 'a', '--resume-directory', 'a'], ['--preflight', '--output-directory', 'a']]) assert.throws(() => parseOptions(args));
});

test('stable hashes preserve all values and arrays while ignoring record-key order', () => {
  assert.equal(stateHash({ b: [2, 1], a: { y: 2, x: 1 } }), stateHash({ a: { x: 1, y: 2 }, b: [2, 1] }));
  assert.notEqual(stateHash({ b: [2, 1] }), stateHash({ b: [1, 2] }));
});

function compressionFixture(root, phase = 'VERIFIED', indexed = true) {
  // Opaque byte fixtures test the evidence protocol, never a SQLite/game claim.
  const work = join(root, 'case-660'), indexPath = join(root, 'completed.json'), hash = 'a'.repeat(64); mkdirSync(work);
  for (const file of ['case.sqlite', 'case.sqlite.bak']) writeFileSync(join(work, file), Buffer.from(`opaque contract bytes: ${file}\n`.repeat(50)));
  const result = { commandCount: 660, databaseFiles: Object.fromEntries(['case.sqlite', 'case.sqlite.bak'].map(file => [file, fileEvidence(join(work, file))])) };
  writeFileSync(join(work, 'phase.json'), JSON.stringify({ input: { manifestSha256: hash }, phase }));
  writeFileSync(indexPath, JSON.stringify({ manifestSha256: hash, results: indexed ? [result] : [], original667: null, complete: false }));
  return { work, indexPath, result };
}

test('completed evidence survives ordinary gunzip with original and compressed hashes', () => workspace(root => {
  const { work, indexPath, result } = compressionFixture(root), raw = readFileSync(join(work, 'case.sqlite'));
  const archive = archiveCompletedCase(work, result, indexPath);
  assert(!existsSync(join(work, 'case.sqlite'))); assert(!existsSync(join(work, 'case.sqlite.bak')));
  assert.deepEqual(archive.files['case.sqlite'].original, result.databaseFiles['case.sqlite']);
  assert.deepEqual(archive.files['case.sqlite'].gzip, { file: 'case.sqlite.gz', ...fileEvidence(join(work, 'case.sqlite.gz')) });
  assert(gunzipSync(readFileSync(join(work, 'case.sqlite.gz'))).equals(raw));
  assert.deepEqual(archiveCompletedCase(work, result, indexPath), archive, 'Resume verifies compressed bytes without restoring or rerunning transactions');
}));

test('a complete gzip plus its raw predecessor recovers safely after interruption', () => workspace(root => {
  const { work, indexPath, result } = compressionFixture(root), raw = readFileSync(join(work, 'case.sqlite'));
  writeFileSync(join(work, 'case.sqlite.gz'), gzipSync(raw, { level: 9 }));
  const before = fileEvidence(join(work, 'case.sqlite.gz')), archive = archiveCompletedCase(work, result, indexPath);
  assert.deepEqual(fileEvidence(join(work, 'case.sqlite.gz')), before); assert(!existsSync(join(work, 'case.sqlite')));
  assert.equal(archive.files['case.sqlite'].gzip.sha256, before.sha256);
}));

test('corrupted gzip is rejected and both original raw files stay available', () => workspace(root => {
  const { work, indexPath, result } = compressionFixture(root);
  writeFileSync(join(work, 'case.sqlite.gz'), 'not a gzip');
  assert.throws(() => archiveCompletedCase(work, result, indexPath));
  for (const file of Object.keys(result.databaseFiles)) assert.deepEqual(fileEvidence(join(work, file)), result.databaseFiles[file]);
  assert.equal(readFileSync(join(work, 'case.sqlite.gz'), 'utf8'), 'not a gzip');
}));

test('missing completed index or incomplete phase cannot authorize raw deletion', () => {
  for (const [phase, indexed] of [['COMMITTED', true], ['VERIFIED', false]]) workspace(root => {
    const { work, indexPath, result } = compressionFixture(root, phase, indexed);
    assert.throws(() => archiveCompletedCase(work, result, indexPath));
    assert.deepEqual(readdirSync(work).sort(), ['case.sqlite', 'case.sqlite.bak', 'phase.json']);
    for (const file of Object.keys(result.databaseFiles)) assert.deepEqual(fileEvidence(join(work, file)), result.databaseFiles[file]);
  });
});
