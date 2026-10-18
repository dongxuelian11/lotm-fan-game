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
import { FORMAT, INPUT_FORMAT, archiveCompletedCase, assertFreeze, assertInputManifest, assertOutputPath,
  assertBoundarySelection, assertActionCapture, assertResumeManifest, claimAuditLock, fileEvidence, inspectCaptureInputs,
  parseOptions, safeRelativeFile, selectBoundaries, stateHash, verifyDeathCapture } from './death-save.mjs';

// Contracts only: no game/dist imports, source fixtures, natural play or SQLite.
const sha = value => createHash('sha256').update(value).digest('hex');
const evidence = (file, digit = 'a') => ({ file, bytes: 5, sha256: digit.repeat(64) });
const freeze = files => ({ files, nodeVersion: 'v24.15.0', sha256: sha(JSON.stringify(files)) });
function workspace(run) {
  const root = mkdtempSync(join(tmpdir(), 'death-save-contract-'));
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('import is safe with an empty working directory and no compiled runtime', () => workspace(root => {
  execFileSync(process.execPath, ['--input-type=module', '--eval', `
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === 'node:sqlite' || specifier.includes('/dist/') || specifier.includes('/scripts/play/')) throw new Error('Forbidden runtime import');
      return next(specifier, context);
    } });
    await import(${JSON.stringify(new URL('./death-save.mjs', import.meta.url).href)});`], { cwd: root });
  assert.deepEqual(readdirSync(root), []);
}));

test('relative evidence paths reject traversal, absolute paths and ambiguous separators', () => {
  assert.equal(safeRelativeFile('action-1039.json.gz'), 'action-1039.json.gz');
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

test('resume binds every capture/source/runtime/selection/verifier/test byte and original path', () => {
  const manifest = { format: FORMAT, inputs: { format: INPUT_FORMAT, files: [evidence('checkpoint.json.gz')] },
    freeze: freeze([evidence('$natural-producer')]), verifier: evidence('verifier.mjs'), verifierTests: evidence('verifier.test.mjs'),
    selected: [{ commandCount: 1039 }], sourceDirectory: '/capture', repo: '/repo', source: evidence('source.json'), node: 'v24.15.0' };
  assertResumeManifest(manifest, structuredClone(manifest));
  for (const key of Object.keys(manifest)) assert.throws(() => assertResumeManifest(manifest, { ...manifest, [key]: null }));
});
function boundary(commandCount, marker = 'opaque-contract') {
  return { commandCount, beforeLast: { marker }, lastIntent: { type: 'DEATH', command: { type: 'REST' } }, final: { marker },
    randomBefore: { marker }, randomAfter: { marker }, publicBefore: { marker }, public: { marker },
    globalPublicBefore: { marker }, globalPublic: { marker }, policyBefore: { marker }, policyAfter: { marker }, audit: { marker } };
}
function entry(commandCount, kind = 'death-rest') { return { ...evidence(`action-${commandCount}.json.gz`), commandCount, kind }; }
test('same actual transition deduplicates semantic aliases without double counting', () => {
  const entries = [entry(1048), entry(1039, 'death-learn_guidance'), entry(1048, 'death-final')];
  const selected = selectBoundaries(entries, item => boundary(item.commandCount));
  assert.equal(selected.length, 2); assert.deepEqual(selected.map(row => row.commandCount), [1039, 1048]);
  assert.deepEqual(selected[1].files, ['action-1048.json.gz']); assert.deepEqual(selected[1].kinds, ['death-final', 'death-rest']);
  assert.equal(selected[1].boundarySha256, stateHash(boundary(1048)));
  assert.deepEqual(selectBoundaries([...entries].reverse(), item => boundary(item.commandCount)), selected);
});
test('selection rejects empty, overflow, historical, altered, malformed and non-capture boundaries', () => {
  assert.throws(() => selectBoundaries([], () => {}));
  assert.throws(() => selectBoundaries(Array.from({ length: 65 }, (_, i) => entry(1039 + i)), item => boundary(item.commandCount)));
  assert.throws(() => selectBoundaries([entry(1039), entry(1039)], item => boundary(item.commandCount)));
  assert.throws(() => selectBoundaries([entry(1039), entry(1039, 'alias')], item => boundary(item.commandCount, item.kind)));
  assert.throws(() => selectBoundaries([entry(1038)], item => boundary(item.commandCount)));
  assert.throws(() => selectBoundaries([{ ...entry(1039), file: '../action-1039.json.gz' }], () => boundary(1039)));
  assert.throws(() => selectBoundaries([{ ...entry(1039), file: 'invented.json.gz' }], () => boundary(1039)));
  assert.throws(() => selectBoundaries([entry(1039)], () => boundary(1040)));
  assert.throws(() => selectBoundaries([entry(1039)], () => ({ ...boundary(1039), invented: true })));
  assert.throws(() => selectBoundaries([entry(1039)], () => { const value = boundary(1039); delete value.globalPublicBefore; return value; }));
});
function semanticFixture() {
  // Command-shaped, opaque contract data. Never a game/capture/SQLite result.
  const rows = [], selected = [];
  const add = (command, kind, status = 'ACTIVE', promoted = false) => {
    const commandCount = 1039 + rows.length;
    rows.push({ commandCount, intent: { type: 'DEATH', command }, selectionOutcome: { status, promoted } });
    if (kind) selected.push({ commandCount, kinds: [kind] });
  };
  add({ type: 'LEARN_GUIDANCE' }, 'death-learn_guidance');
  for (const type of ['WORK','REST','CLINIC','NEXT_WEEK','STABILIZE_PROMOTION','START_EPILOGUE','RETURN_ON_FOOT']) {
    add({ type }, `death-${type.toLowerCase()}`); add({ type });
  }
  add({ type: 'TRAVEL', to: 'DE0-RECEPTION' }, 'death-travel-DE0-RECEPTION');
  for (const serviceId of ['residue-sealing','old-wharf-exit'])
    add({ type: 'SERVICE', command: { type: 'INSPECT', serviceId } }, `service-${serviceId}-inspect`);
  for (const [type, key, id] of [['SEAL_LEGACY','bottleId','pale-emperor-potion-1'], ['VERIFY_UNIQUENESS','step','CHAIN'],
    ['BUY_COMPOUND','batchId','death-carrier-1'], ['COMPOSE_POTION','batchId','death-carrier-1'], ['SEAL_REMAINS','compoundId','compound-1'],
    ['RECOVER_SEALED','compoundId','compound-1']]) add({ type: 'MATERIAL', command: { type, [key]: id } }, `material-${type.toLowerCase()}-${id}`);
  add({ type: 'CONSUME', compoundId: 'compound-1' }, 'death-failed-dose-compound-1');
  add({ type: 'CONSUME', compoundId: 'compound-2' }, 'death-actual-promotion', 'ACTIVE', true);
  for (const type of ['PARTIAL_SPIRIT_PASSAGE','TRAVERSE_PASSAGE','PROPAGATION_BARRIER','APPLY_BARRIER','REPORT'])
    add({ type: 'EPILOGUE', command: { type } }, `epilogue-${type.toLowerCase()}`);
  return { rows, selected, add };
}
test('ordinary care, same originals, two services and finite epilogue use exact actual taxonomy', () => {
  const { rows, selected } = semanticFixture(); assertBoundarySelection(rows, selected);
  for (const item of selected) assert.throws(() => assertBoundarySelection(rows, selected.filter(row => row !== item)));
  assert.throws(() => assertBoundarySelection(rows, [...selected].reverse()));
  assert.throws(() => assertBoundarySelection(rows, [...selected, selected.at(-1)]));
  const bad = structuredClone(rows); bad.find(row => row.intent.command.type === 'SERVICE').intent.command.command.serviceId = 'third-service';
  assert.throws(() => assertBoundarySelection(bad, selected));
});
test('partial captures never fabricate later promotion, epilogue, death or a predetermined count', () => {
  const { rows, selected } = semanticFixture();
  assertBoundarySelection(rows.slice(0, 3), selected.filter(row => row.commandCount < 1042));
  assert.throws(() => assertBoundarySelection(rows.slice(0, 3), selected));
  const dead = { commandCount: 1039, intent: { type: 'DEATH', command: { type: 'CONSUME', compoundId: 'real-id' } }, selectionOutcome: { status: 'DEAD', promoted: false } };
  assertBoundarySelection([dead], [{ commandCount: 1039, kinds: ['death-actual-terminal'] }]);
  assert.throws(() => assertBoundarySelection([dead], [{ commandCount: 1039, kinds: ['death-actual-promotion'] }]));
});
test('finite selection reserves slot 64 for actual terminal and keeps all later full action evidence', () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({ commandCount: 1039 + i, intent: { type: 'DEATH', command: { type: 'TRAVEL', to: `opaque-${i}` } }, selectionOutcome: { status: 'ACTIVE', promoted: false } }));
  const selected = rows.slice(0, 63).map(row => ({ commandCount: row.commandCount, kinds: [`death-travel-${row.intent.command.to}`] }));
  assertBoundarySelection(rows, selected); assert.throws(() => assertBoundarySelection(rows, selected.slice(0, 62)));
  assert.throws(() => assertBoundarySelection(rows, [...selected, { commandCount: rows[63].commandCount, kinds: ['death-travel-opaque-63'] }]));
  const terminal = { commandCount: 1109, intent: { type: 'DEATH', command: { type: 'CONSUME', compoundId: 'opaque-terminal' } }, selectionOutcome: { status: 'DEAD', promoted: false } };
  assert.throws(() => assertBoundarySelection([...rows, terminal], selected));
  assertBoundarySelection([...rows, terminal], [...selected, { commandCount: 1109, kinds: ['death-actual-terminal'] }]);
});
function bindActionAudit(content, row) {
  for (const [field, hash] of [['beforeLast','beforeStateSha256'], ['final','afterStateSha256'], ['publicBefore','publicBeforeSha256'],
    ['public','publicAfterSha256'], ['globalPublicBefore','globalPublicBeforeSha256'], ['globalPublic','globalPublicAfterSha256'],
    ['policyBefore','policyBeforeSha256'], ['policyAfter','policyAfterSha256']]) row[hash] = stateHash(content[field]);
  const { capture, ...audit } = row; content.audit = { ...audit, elapsedMilliseconds: null };
}
function actionContract(promoted = false) {
  const content = boundary(1039), randomBefore = { seed: 'opaque-contract', cursor: 1 }, randomAfter = { seed: 'opaque-contract', cursor: 2 };
  const state = { schemaVersion: 214, contentVersion: 'death-v214', runId: 'corpsecollector-rebuild-natural', status: 'ACTIVE',
    progression: { sequence: 1 }, death: { promotionWeek: null, guidanceKnown: true } };
  content.beforeLast = { ...state, revision: 1039, random: randomBefore };
  content.final = { ...state, revision: 1040, random: randomAfter, progression: { sequence: promoted ? 0 : 1 },
    death: { promotionWeek: promoted ? 3335 : null, guidanceKnown: true } };
  content.publicBefore = { status: 'ACTIVE', progression: { sequence: 1 }, death: { promoted: false, guidanceKnown: true } };
  content.public = { status: 'ACTIVE', progression: { sequence: promoted ? 0 : 1 }, death: { promoted, guidanceKnown: true } };
  content.globalPublicBefore = structuredClone(content.publicBefore); content.globalPublic = structuredClone(content.public);
  content.randomBefore = randomBefore; content.randomAfter = randomAfter;
  const row = { commandCount: 1039, intent: content.lastIntent, randomBefore, randomAfter, elapsedMilliseconds: 7,
    selectionOutcome: { status: 'ACTIVE', sequence: promoted ? 0 : 1, promoted, guidance: true }, capture: evidence('action-1039.json.gz') };
  bindActionAudit(content, row); return { content, row };
}
test('full actual action contract binds both private, RNG, chapter, whole-public and policy sides', () => {
  const { content, row } = actionContract(); assertActionCapture(content, row);
  for (const key of ['beforeLast','final','randomBefore','randomAfter','publicBefore','public','globalPublicBefore','globalPublic','policyBefore','policyAfter','audit','lastIntent']) {
    const altered = structuredClone(content); altered[key].extra = 'altered'; assert.throws(() => assertActionCapture(altered, row));
  }
  assert.throws(() => assertActionCapture({ ...content, commandCount: 1040 }, row));
});
test('selection outcome reads actual false and true from public projection, never nonexistent private promoted', () => {
  for (const promoted of [false, true]) {
    const { content, row } = actionContract(promoted);
    assert.equal(Object.hasOwn(content.final.death, 'promoted'), false);
    assert.equal(content.final.death.promotionWeek, promoted ? 3335 : null);
    assert.equal(content.public.death.promoted, promoted); assertActionCapture(content, row);
  }
});
test('selection outcome rejects either boolean disagreement even with otherwise rebound audit hashes', () => {
  for (const promoted of [false, true]) {
    const { content, row } = actionContract(promoted); row.selectionOutcome.promoted = !promoted;
    bindActionAudit(content, row); assert.throws(() => assertActionCapture(content, row));
  }
});
test('missing, undefined, null and nonboolean public promoted cannot pass as a false outcome', () => {
  for (const value of [undefined, null, 'false', 0]) {
    const { content, row } = actionContract(false);
    if (value === undefined) {
      delete content.public.death.promoted; bindActionAudit(content, row);
      assert.throws(() => assertActionCapture(content, row), /Captured public promoted must be boolean/);
      content.public.death.promoted = undefined;
      assert.throws(() => assertActionCapture(content, row));
    } else {
      content.public.death.promoted = value; bindActionAudit(content, row);
      assert.throws(() => assertActionCapture(content, row), /Captured public promoted must be boolean/);
    }
  }
});
test('public outcome status, sequence and guidance must still match the captured private final', () => {
  for (const mutate of [value => { value.public.status = 'DEAD'; }, value => { value.public.progression.sequence = 0; },
    value => { value.public.death.guidanceKnown = false; }]) {
    const { content, row } = actionContract(false); mutate(content); bindActionAudit(content, row);
    assert.throws(() => assertActionCapture(content, row));
  }
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
  const root = mkdtempSync(join(tmpdir(), 'death-empty-preflight-'));
  const hooks = registerHooks({ resolve(specifier, context, next) {
    assert(specifier !== 'node:sqlite' && !specifier.includes('/dist/') && !specifier.includes('/scripts/play/'), 'Preflight cannot import runtime');
    return next(specifier, context);
  } });
  try {
    const capture = join(root, 'capture'); mkdirSync(capture); const manifest = join(root, 'inputs.json');
    writeFileSync(manifest, JSON.stringify({ format: INPUT_FORMAT, files: [] }));
    const self = fileURLToPath(new URL('./death-save.mjs', import.meta.url));
    await assert.rejects(verifyDeathCapture({ repo: dirname(dirname(dirname(self))), sourceDirectory: capture,
      inputManifest: manifest, inputManifestSha256: fileEvidence(manifest).sha256, freezeSha256: 'a'.repeat(64), verifierSha256: fileEvidence(self).sha256, preflight: true }), /Empty capture/);
    assert.deepEqual(readdirSync(root).sort(), ['capture', 'inputs.json']); assert.deepEqual(readdirSync(capture), []);
  } finally { hooks.deregister(); rmSync(root, { recursive: true, force: true }); }
});

test('CLI is explicit and rejects duplicate flags, ambiguous resume, and preflight writes', () => {
  assert.deepEqual(parseOptions(['--source-directory', 'capture', '--preflight']), { sourceDirectory: 'capture', preflight: true });
  assert.equal(parseOptions(['--expected-boundaries', '33']).expectedBoundaries, 33);
  assert.equal(parseOptions(['--remove-stale-lock-pid', '123']).removeStaleLockPid, 123);
  for (const args of [['--expected-boundaries', '0'], ['--expected-boundaries', '65'], ['--final-runtime-proof', 'anything'], ['--remove-stale-lock-pid', '-1'], ['--preflight', '--preflight'], ['--source-directory'],
    ['--source-directory', '--preflight'], ['--unknown', 'x'], ['--output-directory', 'a', '--resume-directory', 'a'], ['--preflight', '--output-directory', 'a']]) assert.throws(() => parseOptions(args));
});

test('help is import-safe and separates restored195 NEW217 from old32/34 evidence', () => workspace(root => {
  const text = execFileSync(process.execPath, [fileURLToPath(new URL('./death-save.mjs', import.meta.url)), '--help'], { cwd: root, encoding: 'utf8' });
  assert.match(text, /Original1038.*restored195 living final/); assert.match(text, /old32\/34 evidence/); assert.doesNotMatch(text, /Visionary|Perfecter|final-runtime-proof/);
  assert.deepEqual(readdirSync(root), []);
}));

test('stable hashes preserve all values and arrays while ignoring record-key order', () => {
  assert.equal(stateHash({ b: [2, 1], a: { y: 2, x: 1 } }), stateHash({ a: { x: 1, y: 2 }, b: [2, 1] }));
  assert.notEqual(stateHash({ b: [2, 1] }), stateHash({ b: [1, 2] }));
});

function compressionFixture(root, phase = 'VERIFIED', indexed = true) {
  // Opaque byte fixtures test the evidence protocol, never a SQLite/game claim.
  const work = join(root, 'case-1039'), indexPath = join(root, 'completed.json'), hash = 'a'.repeat(64); mkdirSync(work);
  for (const file of ['case.sqlite', 'case.sqlite.bak']) writeFileSync(join(work, file), Buffer.from(`opaque contract bytes: ${file}\n`.repeat(50)));
  const result = { commandCount: 1039, databaseFiles: Object.fromEntries(['case.sqlite', 'case.sqlite.bak'].map(file => [file, fileEvidence(join(work, file))])) };
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
  assert.throws(() => archiveCompletedCase(work, { ...result, commandCount: undefined }, indexPath), /Only actual completed Death/);
}));


test('an unresolved phase successor never authorizes archival or raw deletion', () => workspace(root => {
  const { work, indexPath, result } = compressionFixture(root); writeFileSync(join(work, 'phase.json.next'), 'unresolved');
  assert.throws(() => archiveCompletedCase(work, result, indexPath), /Unresolved phase/);
  for (const file of Object.keys(result.databaseFiles)) assert.deepEqual(fileEvidence(join(work, file)), result.databaseFiles[file]);
}));

test('canonical hashes reject non-JSON values and preserve numeric keys consistently', () => {
  for (const value of [undefined, NaN, Infinity, () => {}, new Date(), { nested: undefined }]) assert.throws(() => stateHash(value));
  assert.equal(stateHash({ 10: 'ten', 2: 'two' }), stateHash({ 2: 'two', 10: 'ten' }));
  assert.equal(stateHash(-0), stateHash(0));
});
