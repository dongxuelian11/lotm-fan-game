import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { registerHooks } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { FORMAT, INPUT_FORMAT, FINAL_RUNTIME_FORMAT, archiveCompletedCase, assertFreeze, assertFinalRuntimeOptions, assertFinalRuntimeProof, assertInputManifest, assertOutputPath, assertBoundarySelection, assertResumeManifest, claimAuditLock,
  fileEvidence, inspectCaptureInputs, parseOptions, readFinalRuntimeProof, safeRelativeFile, selectBoundaries, stateHash, verifyPerfecterCapture } from './perfecter-save.mjs';

// Contracts only: no game/dist imports, source fixtures, natural play or SQLite.
const sha = value => createHash('sha256').update(value).digest('hex');
const evidence = (file, digit = 'a') => ({ file, bytes: 5, sha256: digit.repeat(64) });
const freeze = files => ({ files, nodeVersion: 'v24.15.0', sha256: sha(JSON.stringify(files)) });
function workspace(run) {
  const root = mkdtempSync(join(tmpdir(), 'perfecter-save-contract-'));
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('import is safe with an empty working directory and no compiled runtime', () => workspace(root => {
  execFileSync(process.execPath, ['--input-type=module', '--eval', `
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === 'node:sqlite' || specifier.includes('/dist/') || specifier.includes('/scripts/play/')) throw new Error('Forbidden runtime import');
      return next(specifier, context);
    } });
    await import(${JSON.stringify(new URL('./perfecter-save.mjs', import.meta.url).href)});`], { cwd: root });
  assert.deepEqual(readdirSync(root), []);
}));

test('relative evidence paths reject traversal, absolute paths and ambiguous separators', () => {
  assert.equal(safeRelativeFile('boundary-798-guidance.json'), 'boundary-798-guidance.json');
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

function finalRuntimeFixture() {
  // Opaque fingerprints only. No game, compiled runtime or natural capture.
  const changed = ['dist/domain/fool/index.js', 'dist/domain/fool/index.js.map', 'src/domain/fool/index.ts'];
  const captured = freeze([...changed.map(file => evidence(file)), evidence('src/domain/perfecter/index.ts'), evidence('$natural-producer')]);
  const current = freeze(captured.files.map(row => changed.includes(row.file) ? { ...row, bytes: 6, sha256: 'b'.repeat(64) } : row));
  const inputs = { format: INPUT_FORMAT, files: [evidence('checkpoint.json'), evidence('freeze.json'), evidence('natural.json')] };
  const proof = { format: FINAL_RUNTIME_FORMAT, kind: 'POST_CAPTURE_PARAGON_ZERO_EMPTY_FOOL_ROOT_VALIDATION_ONLY', captureFreezeSha256: captured.sha256,
    captureInputs: structuredClone(inputs), finalRuntimeFreeze: structuredClone(current),
    changedFiles: changed.map(file => ({ file, before: { bytes: 5, sha256: 'a'.repeat(64) }, after: { bytes: 6, sha256: 'b'.repeat(64) } })) };
  return { captured, current, inputs, proof };
}

test('optional proof permits only the exact reviewed validation repair; default remains strict', () => {
  const { captured, current, inputs, proof } = finalRuntimeFixture();
  assertFinalRuntimeProof(proof, captured, current, inputs);
  assert.throws(() => assertFreeze(captured, current), /must match exactly/);
  assertFreeze(captured, structuredClone(captured));
  const invalid = [
    freeze([...current.files, evidence('src/extra.ts')]), freeze(current.files.slice(1)), freeze([...current.files].reverse()),
    freeze(current.files.map(row => row.file === 'src/domain/perfecter/index.ts' ? { ...row, sha256: 'c'.repeat(64) } : row)),
    freeze(current.files.map(row => row.file === '$natural-producer' ? { ...row, bytes: 7 } : row)),
    freeze(current.files.map(row => row.file === 'src/domain/fool/index.ts' ? captured.files.find(old => old.file === row.file) : row)),
    freeze(current.files.map(row => row.file === 'dist/domain/fool/index.js.map' ? captured.files.find(old => old.file === row.file) : row)),
    { ...current, nodeVersion: 'v24.16.0' }, captured,
  ];
  for (const altered of invalid) assert.throws(() => assertFinalRuntimeProof({ ...proof, finalRuntimeFreeze: altered }, captured, altered, inputs));
});

test('proof rejects altered original inputs, freeze hashes, before/after evidence and unknown fields', () => {
  const { captured, current, inputs, proof } = finalRuntimeFixture();
  const mutations = [
    value => { value.format = 'OTHER'; }, value => { value.kind = 'OTHER'; }, value => { value.extra = true; },
    value => { value.captureFreezeSha256 = 'c'.repeat(64); }, value => { value.finalRuntimeFreeze.sha256 = 'c'.repeat(64); },
    value => { value.captureInputs.files.pop(); }, value => { value.captureInputs.files[0].sha256 = 'c'.repeat(64); },
    value => { value.changedFiles[0].before.sha256 = 'c'.repeat(64); }, value => { value.changedFiles[0].before.bytes++; },
    value => { value.changedFiles[0].after.sha256 = 'c'.repeat(64); }, value => { value.changedFiles[0].after.bytes++; },
    value => { value.changedFiles.pop(); }, value => { value.changedFiles.reverse(); },
  ];
  for (const mutate of mutations) { const altered = structuredClone(proof); mutate(altered); assert.throws(() => assertFinalRuntimeProof(altered, captured, current, inputs)); }
  const alteredInputs = structuredClone(inputs); alteredInputs.files[0].bytes++;
  assert.throws(() => assertFinalRuntimeProof(proof, captured, current, alteredInputs));
});

test('proof options require independent reviewed proof and final-freeze digests together', () => {
  assert.equal(assertFinalRuntimeOptions({}), false);
  const options = { finalRuntimeProof: '/reviewed-proof.json', finalRuntimeProofSha256: 'a'.repeat(64), runtimeFreezeSha256: 'b'.repeat(64) };
  assert.equal(assertFinalRuntimeOptions(options), true);
  for (const key of Object.keys(options)) {
    const missing = { ...options }; delete missing[key]; assert.throws(() => assertFinalRuntimeOptions(missing));
    assert.throws(() => assertFinalRuntimeOptions({ ...options, [key]: '' }));
  }
  assert.deepEqual(parseOptions(['--final-runtime-proof', options.finalRuntimeProof, '--final-runtime-proof-sha256', options.finalRuntimeProofSha256,
    '--runtime-freeze-sha256', options.runtimeFreezeSha256, '--preflight']), { ...options, preflight: true });
  assert.throws(() => parseOptions(['--final-runtime-proof', options.finalRuntimeProof]));
});

test('read-only proof authentication rejects changed bytes, unreviewed hashes and proof inside original capture', () => workspace(root => {
  const capture = join(root, 'capture'); mkdirSync(capture);
  const { proof, current } = finalRuntimeFixture(), path = join(root, 'reviewed-proof.json'); writeFileSync(path, JSON.stringify(proof));
  const options = { finalRuntimeProof: path, finalRuntimeProofSha256: fileEvidence(path).sha256, runtimeFreezeSha256: current.sha256 };
  const original = inspectCaptureInputs(root), loaded = readFinalRuntimeProof(options, capture);
  assert.deepEqual(loaded, { input: { path, ...fileEvidence(path) }, proof }); assertInputManifest(inspectCaptureInputs(root), original);
  assert.equal(readFinalRuntimeProof({}, capture), null);
  assert.throws(() => readFinalRuntimeProof({ ...options, finalRuntimeProofSha256: 'c'.repeat(64) }, capture), /reviewed final-runtime proof SHA/);
  assert.throws(() => readFinalRuntimeProof({ ...options, runtimeFreezeSha256: 'c'.repeat(64) }, capture), /reviewed final-runtime freeze SHA/);
  writeFileSync(path, JSON.stringify(proof) + '\n'); assert.throws(() => readFinalRuntimeProof(options, capture), /reviewed final-runtime proof SHA/);
  const bundled = join(capture, 'final-runtime-proof.json'); writeFileSync(bundled, JSON.stringify(proof));
  assert.throws(() => readFinalRuntimeProof({ ...options, finalRuntimeProof: bundled }, capture), /outside the unchanged original capture/);
}));

test('resume binds exact proof bytes, path, payload and full final runtime as well as original freeze', () => {
  const { captured, current, inputs, proof } = finalRuntimeFixture();
  const manifest = { format: FORMAT, inputs, freeze: captured, runtimeFreeze: current,
    finalRuntimeProof: { input: { path: '/reviewed-proof.json', bytes: 100, sha256: 'c'.repeat(64) }, proof } };
  assertResumeManifest(manifest, structuredClone(manifest));
  for (const mutate of [value => { delete value.finalRuntimeProof; }, value => { value.finalRuntimeProof.input.path = '/other-proof.json'; },
    value => { value.finalRuntimeProof.input.sha256 = 'd'.repeat(64); }, value => { value.finalRuntimeProof.input.bytes++; },
    value => { value.finalRuntimeProof.proof.changedFiles[0].after.bytes++; }, value => { value.runtimeFreeze = captured; },
    value => { value.freeze = current; }]) {
    const altered = structuredClone(manifest); mutate(altered); assert.throws(() => assertResumeManifest(manifest, altered));
  }
});

test('resume fingerprint binds complete inputs, runtime, verifier, selection and paths', () => {
  const manifest = { format: FORMAT, inputs: { format: INPUT_FORMAT, files: [evidence('checkpoint.json')] }, freeze: freeze([evidence('$natural-producer')]),
    verifier: evidence('verifier.mjs'), selected: [{ commandCount: 798 }], sourceDirectory: '/capture', repo: '/repo' };
  assertResumeManifest(manifest, structuredClone(manifest));
  for (const key of Object.keys(manifest)) assert.throws(() => assertResumeManifest(manifest, { ...manifest, [key]: null }));
});

function boundary(commandCount, marker = 'actual') {
  return { commandCount, beforeLast: { marker }, lastIntent: { type: 'PERFECTER', command: { type: 'REST' } }, final: { marker }, public: { marker }, audit: { marker } };
}
function index(file, commandCount, kind = 'first-rest') { return { ...evidence(file), commandCount, kind }; }
test('identical real command counts are one transition with multiple semantic aliases', () => {
  const entries = [index('later.json', 808), index('first.json', 798, 'learn_guidance'), index('alias.json', 808, 'final-boundary')];
  const selected = selectBoundaries(entries, item => boundary(item.commandCount));
  assert.equal(selected.length, 2); assert.deepEqual(selected.map(row => row.commandCount), [798, 808]);
  assert.deepEqual(selected[1].files, ['alias.json', 'later.json']); assert.deepEqual(selected[1].kinds, ['final-boundary', 'first-rest']);
  assert.equal(selected[1].boundarySha256, stateHash(boundary(808)));
  assert.deepEqual(selectBoundaries([...entries].reverse(), item => boundary(item.commandCount)), selected, 'Alias arrival order cannot change the reviewed selection');
});

test('empty, conflicting duplicate and malformed boundaries never become coverage', () => {
  assert.throws(() => selectBoundaries([], () => {}));
  assert.throws(() => selectBoundaries([index('a.json', 798), index('b.json', 798)], item => boundary(798, item.file)));
  assert.throws(() => selectBoundaries([index('a.json', 798), index('a.json', 798)], item => boundary(item.commandCount)));
  assert.throws(() => selectBoundaries([index('a.json', 798)], () => boundary(799)));
  assert.throws(() => selectBoundaries([index('a.json', 798)], () => ({ ...boundary(798), synthesized: true })));
  assert.throws(() => selectBoundaries([index('../a.json', 798)], () => boundary(798)));
  assert.throws(() => selectBoundaries([index('historical.json', 797)], () => boundary(797)));
});

function semanticFixture() {
  // Command-shaped contract data only; these are not natural play or results.
  const rows = [], selected = [];
  const add = (command, kind) => {
    const commandCount = 798 + rows.length; rows.push({ commandCount, intent: { type: 'PERFECTER', command } });
    if (kind) selected.push({ commandCount, kinds: [kind] });
  };
  add({ type: 'LEARN_GUIDANCE' }, 'learn_guidance');
  for (const type of ['WORK', 'NEXT_WEEK', 'TRAVEL', 'REST', 'CLINIC']) {
    add({ type }, `first-${type.toLowerCase()}`); add({ type });
  }
  for (const stationId of ['ARCHIVE', 'WORKSHOP', 'SOUTH_BANK']) {
    add({ type: 'WORKS', command: { type: 'WORKS_INSPECT', stationId } });
    for (const type of ['WORKS_TRIAL', 'WORKS_VERIFY']) add({ type: 'WORKS', command: { type, stationId } }, `${type.toLowerCase()}-${stationId.toLowerCase()}`);
  }
  for (const type of ['MATERIAL_LABOUR', 'ACQUIRE_CHARACTERISTIC', 'ACQUIRE_UNIQUENESS']) {
    add({ type: 'MATERIAL', command: { type } }, `first-${type.toLowerCase()}`); add({ type: 'MATERIAL', command: { type } });
  }
  for (const step of ['CHAIN', 'VACANCY', 'SEAL']) add({ type: 'MATERIAL', command: { type: 'VERIFY_UNIQUENESS', step } }, `uniqueness-${step.toLowerCase()}`);
  for (const type of ['BUY_COMPOUND', 'COMPOSE_POTION', 'SEAL_REMAINS', 'RECOVER_SEALED', 'REQUEST_COMPOUND_REPAIR', 'RECEIVE_COMPOUND_REPAIR', 'COMPOSE_POTION'])
    add({ type: 'MATERIAL', command: { type } }, type.toLowerCase());
  for (const type of ['STABILIZE_PROMOTION', 'CONSUME', 'STABILIZE_PROMOTION', 'CONSUME', 'START_EPILOGUE']) add({ type }, type.toLowerCase());
  for (const type of ['OBSERVE', 'CONTAIN_FLOW', 'RECONSTRUCT_MODEL', 'EVACUATE', 'ISOLATE', 'WITHDRAW', 'REPORT'])
    add({ type: 'EPILOGUE', command: { type } }, `actual-archive-${type.toLowerCase()}`);
  return { rows, selected };
}

test('selection binds actual ordinary, all three station, uniqueness, promotion, recovery and epilogue commands', () => {
  const { rows, selected } = semanticFixture(); assertBoundarySelection(rows, selected);
  for (const item of selected) assert.throws(() => assertBoundarySelection(rows, selected.filter(row => row !== item)), 'No actual semantic boundary can be silently omitted');
  assert.throws(() => assertBoundarySelection(rows, [...selected, selected.at(-1)]));
  assert.throws(() => assertBoundarySelection(rows, [...selected].reverse()));
  const altered = structuredClone(selected); altered[0].kinds = ['first-rest']; assert.throws(() => assertBoundarySelection(rows, altered));
  const invalidStation = structuredClone(rows); invalidStation.find(row => row.intent.command.command?.type === 'WORKS_TRIAL').intent.command.command.stationId = 'INVENTED';
  assert.throws(() => assertBoundarySelection(invalidStation, selected));
});

test('selection never fabricates future promotion, recovery, epilogue or a death source', () => {
  const { rows, selected } = semanticFixture();
  assertBoundarySelection(rows.slice(0, 3), selected.filter(row => row.commandCount < 801));
  assert.throws(() => assertBoundarySelection(rows.slice(0, 3), selected));
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
  const root = mkdtempSync(join(tmpdir(), 'perfecter-empty-preflight-'));
  const hooks = registerHooks({ resolve(specifier, context, next) {
    assert(specifier !== 'node:sqlite' && !specifier.includes('/dist/') && !specifier.includes('/scripts/play/'), 'Preflight cannot import runtime');
    return next(specifier, context);
  } });
  try {
    const capture = join(root, 'capture'); mkdirSync(capture); const manifest = join(root, 'inputs.json');
    writeFileSync(manifest, JSON.stringify({ format: INPUT_FORMAT, files: [] }));
    const self = fileURLToPath(new URL('./perfecter-save.mjs', import.meta.url));
    await assert.rejects(verifyPerfecterCapture({ repo: dirname(dirname(dirname(self))), sourceDirectory: capture,
      inputManifest: manifest, inputManifestSha256: fileEvidence(manifest).sha256, freezeSha256: 'a'.repeat(64), verifierSha256: fileEvidence(self).sha256, preflight: true }), /Empty capture/);
    assert.deepEqual(readdirSync(root).sort(), ['capture', 'inputs.json']); assert.deepEqual(readdirSync(capture), []);
  } finally { hooks.deregister(); rmSync(root, { recursive: true, force: true }); }
});

test('CLI is explicit and rejects duplicate flags, ambiguous resume, and preflight writes', () => {
  assert.deepEqual(parseOptions(['--source-directory', 'capture', '--preflight']), { sourceDirectory: 'capture', preflight: true });
  assert.equal(parseOptions(['--expected-boundaries', '33']).expectedBoundaries, 33);
  assert.equal(parseOptions(['--remove-stale-lock-pid', '123']).removeStaleLockPid, 123);
  for (const args of [['--expected-boundaries', '0'], ['--remove-stale-lock-pid', '-1'], ['--preflight', '--preflight'], ['--source-directory'],
    ['--source-directory', '--preflight'], ['--unknown', 'x'], ['--output-directory', 'a', '--resume-directory', 'a'], ['--preflight', '--output-directory', 'a']]) assert.throws(() => parseOptions(args));
});

test('help remains import-safe and describes only the exact original797 living campaign', () => workspace(root => {
  const text = execFileSync(process.execPath, [fileURLToPath(new URL('./perfecter-save.mjs', import.meta.url)), '--help'], { cwd: root, encoding: 'utf8' });
  assert.match(text, /Original797.*living Enlightener history/); assert.doesNotMatch(text, /667|659|Visionary|visionary/);
  assert.deepEqual(readdirSync(root), []);
}));

test('stable hashes preserve all values and arrays while ignoring record-key order', () => {
  assert.equal(stateHash({ b: [2, 1], a: { y: 2, x: 1 } }), stateHash({ a: { x: 1, y: 2 }, b: [2, 1] }));
  assert.notEqual(stateHash({ b: [2, 1] }), stateHash({ b: [1, 2] }));
});

function compressionFixture(root, phase = 'VERIFIED', indexed = true) {
  // Opaque byte fixtures test the evidence protocol, never a SQLite/game claim.
  const work = join(root, 'case-798'), indexPath = join(root, 'completed.json'), hash = 'a'.repeat(64); mkdirSync(work);
  for (const file of ['case.sqlite', 'case.sqlite.bak']) writeFileSync(join(work, file), Buffer.from(`opaque contract bytes: ${file}\n`.repeat(50)));
  const result = { commandCount: 798, databaseFiles: Object.fromEntries(['case.sqlite', 'case.sqlite.bak'].map(file => [file, fileEvidence(join(work, file))])) };
  writeFileSync(join(work, 'phase.json'), JSON.stringify({ input: { manifestSha256: hash }, phase }));
  writeFileSync(indexPath, JSON.stringify({ manifestSha256: hash, results: indexed ? [result] : [], complete: false }));
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

test('valid gzip with different original bytes is rejected before any raw evidence is removed', () => workspace(root => {
  const { work, indexPath, result } = compressionFixture(root);
  writeFileSync(join(work, 'case.sqlite.bak.gz'), gzipSync(Buffer.from('different valid gzip payload')));
  assert.throws(() => archiveCompletedCase(work, result, indexPath), /decompressed original byte/);
  for (const file of Object.keys(result.databaseFiles)) assert.deepEqual(fileEvidence(join(work, file)), result.databaseFiles[file]);
  assert(!existsSync(join(work, 'archive.json')));
}));

test('recorded gzip fingerprints and the original completed result survive resume unchanged', () => workspace(root => {
  const { work, indexPath, result } = compressionFixture(root);
  result.databaseArchives = archiveCompletedCase(work, result, indexPath);
  const completed = { manifestSha256: 'a'.repeat(64), results: [result], complete: true };
  writeFileSync(indexPath, JSON.stringify(completed)); const originalIndex = readFileSync(indexPath);
  const originalArtifacts = inspectCaptureInputs(work);
  assert.deepEqual(archiveCompletedCase(work, result, indexPath), result.databaseArchives);
  assert(readFileSync(indexPath).equals(originalIndex), 'Archival resume cannot rewrite the original completed result');
  assertInputManifest(inspectCaptureInputs(work), originalArtifacts);
  writeFileSync(join(work, 'case.sqlite.gz'), gzipSync(gunzipSync(readFileSync(join(work, 'case.sqlite.gz'))), { level: 1 }));
  assert.throws(() => archiveCompletedCase(work, result, indexPath), /Compressed evidence or original fingerprint changed/);
}));

test('partial raw deletion and a durable archive successor recover without losing original bytes', () => workspace(root => {
  const { work, indexPath, result } = compressionFixture(root);
  const originals = Object.fromEntries(Object.keys(result.databaseFiles).map(name => [name, readFileSync(join(work, name))]));
  const archive = archiveCompletedCase(work, result, indexPath);
  writeFileSync(join(work, 'case.sqlite.bak'), originals['case.sqlite.bak']);
  writeFileSync(join(work, 'archive.json.next'), JSON.stringify(archive));
  assert.deepEqual(archiveCompletedCase(work, result, indexPath), archive);
  assert(!existsSync(join(work, 'archive.json.next')));
  for (const [name, bytes] of Object.entries(originals)) {
    assert(!existsSync(join(work, name))); assert(gunzipSync(readFileSync(join(work, `${name}.gz`))).equals(bytes));
  }
}));

test('unindexed sidecars and unexpected compressed evidence stay retained', () => {
  for (const name of ['case.sqlite-journal', 'case.sqlite.sealed.gz']) workspace(root => {
    const { work, indexPath, result } = compressionFixture(root); writeFileSync(join(work, name), 'unindexed bytes');
    assert.throws(() => archiveCompletedCase(work, result, indexPath), /Unindexed/);
    for (const file of Object.keys(result.databaseFiles)) assert.deepEqual(fileEvidence(join(work, file)), result.databaseFiles[file]);
    assert.equal(readFileSync(join(work, name), 'utf8'), 'unindexed bytes');
  });
});

test('generic actual terminal sidecar can be retained without creating a separate death branch', () => workspace(root => {
  const { work, indexPath, result } = compressionFixture(root); const sealed = Buffer.from('["opaque-contract-run"]');
  writeFileSync(join(work, 'case.sqlite.sealed'), sealed); result.databaseFiles['case.sqlite.sealed'] = fileEvidence(join(work, 'case.sqlite.sealed'));
  writeFileSync(indexPath, JSON.stringify({ manifestSha256: 'a'.repeat(64), results: [result], complete: false }));
  const archive = archiveCompletedCase(work, result, indexPath);
  assert(gunzipSync(readFileSync(join(work, 'case.sqlite.sealed.gz'))).equals(sealed));
  assert.deepEqual(archive.files['case.sqlite.sealed'].original, result.databaseFiles['case.sqlite.sealed']);
  assert.throws(() => archiveCompletedCase(work, { ...result, commandCount: undefined }, indexPath), /Only actual completed Perfecter/);
}));
