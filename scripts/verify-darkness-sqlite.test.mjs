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
import { FORMAT, INPUT_FORMAT, PREFIX, BOUNDARY_LIMIT, archiveCompletedCase, assertFreeze, assertInputManifest, assertOutputPath, assertBoundarySelection, assertResumeManifest, claimAuditLock,
  assertCaptureStatus, assertCommandRows, assertGlobalPublic, assertPublicOnly, assertPublicAction, assertSelectionOutcome, assertVerifyOptions, boundaryKind, captureFileEvidence, fileEvidence, inspectCaptureInputs, parseOptions, readCapture, readCaptureBytes, safeRelativeFile, selectBoundaries, selectionOutcome, stateHash, verifyDarknessCapture } from './verify-darkness-sqlite.mjs';

// Contracts only: no game/dist imports, source fixtures, natural play or SQLite.
const sha = value => createHash('sha256').update(value).digest('hex');
const evidence = (file, digit = 'a') => ({ file, bytes: 5, sha256: digit.repeat(64) });
const freeze = files => ({ files, nodeVersion: 'v24.15.0', sha256: sha(JSON.stringify(files)) });
function workspace(run) {
  const root = mkdtempSync(join(tmpdir(), 'darkness-save-contract-'));
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('import is safe with an empty working directory and no compiled runtime', () => workspace(root => {
  execFileSync(process.execPath, ['--input-type=module', '--eval', `
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === 'node:sqlite' || specifier.includes('/dist/') || specifier.includes('/scripts/play/')) throw new Error('Forbidden runtime import');
      return next(specifier, context);
    } });
    await import(${JSON.stringify(new URL('./verify-darkness-sqlite.mjs', import.meta.url).href)});`], { cwd: root });
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

test('resume fingerprint binds complete inputs, runtime, verifier, selection and paths', () => {
  const manifest = { format: FORMAT, inputs: { format: INPUT_FORMAT, files: [evidence('checkpoint.json')] }, freeze: freeze([evidence('$natural-producer')]),
    runtimeFreeze: freeze([evidence('dist/current.js')]), verifier: evidence('verifier.mjs'), selected: [{ commandCount: 680 }], sourceDirectory: '/capture', repo: '/repo' };
  assertResumeManifest(manifest, structuredClone(manifest));
  for (const key of Object.keys(manifest)) assert.throws(() => assertResumeManifest(manifest, { ...manifest, [key]: null }));
});

const outcome = (overrides = {}) => ({ status: 'ACTIVE', promoted: false, arrivals: 0, ...overrides });
function boundary(commandCount, marker = 'actual') {
  return { commandCount, beforeLast: { marker }, lastIntent: { type: 'DARKNESS', command: {type: 'LEARN_GUIDANCE'} }, final: { marker }, public: { marker }, globalPublicSha256: 'a'.repeat(64), audit: { marker } };
}
function index(commandCount, kind = 'darkness-learn_guidance') { return { ...evidence(`boundary-${commandCount}-${kind}.json.gz`), commandCount, kind }; }
test('selected gzip boundaries must be unique exact producer files in increasing command order', () => {
  const entries = [index(680),index(681,'darkness-stabilize_promotion')];
  const selected = selectBoundaries(entries,item => boundary(item.commandCount));
  assert.deepEqual(selected.map(row => row.commandCount),[680,681]);
  assert.deepEqual(selected[0].files,[entries[0].file]); assert.deepEqual(selected[0].kinds,['darkness-learn_guidance']);
  assert.equal(selected[0].boundarySha256,stateHash(boundary(680)));
  for (const invalid of [[],[...entries].reverse(),[entries[0],entries[0]],[entries[0],index(681)],
    [entries[0],index(680,'darkness-stabilize_promotion')],[{...entries[0],file:'../boundary.json.gz'}],
    [{...entries[0],file:'boundary-680-darkness-learn_guidance.json'}],[index(679)]])
    assert.throws(() => selectBoundaries(invalid,item => boundary(item.commandCount)));
  assert.throws(() => selectBoundaries(entries,() => boundary(682)));
  assert.throws(() => selectBoundaries(entries,item => ({...boundary(item.commandCount),synthetic:true})));
  assert.throws(() => selectBoundaries(Array.from({length:26},(_,i) => index(680+i,`extra-${i}`)),item => boundary(item.commandCount)));
});
function semanticFixture() {
  const rows = [], selected = [], seen = new Set();
  const add = (command, kind = null, facts = outcome()) => {
    const commandCount = PREFIX + rows.length + 1;
    rows.push({commandCount,intent:{type:'DARKNESS',command},selectionOutcome:facts});
    if (kind && !seen.has(kind) && selected.length < BOUNDARY_LIMIT) { seen.add(kind); selected.push({commandCount,kinds:[kind]}); }
  };
  add({type:'LEARN_GUIDANCE'},'darkness-learn_guidance'); add({type:'WORK'});
  for (const type of ['SHIELD_FALSE_LIGHT','RELAY_INSTRUCTIONS','REPORT']) add({type:'EVACUATION',command:{type}},`evacuation-${type.toLowerCase()}`);
  for (const arrivals of [1,1,2,3,4]) add({type:'EVACUATION',command:{type:'WALK',to:110}},`evacuation-actual-arrival-${arrivals}`,outcome({arrivals}));
  for (const bottleId of ['misfortune-knight-potion-1','misfortune-knight-potion-2']) for (const type of ['INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS'])
    add({type:'MATERIAL',command:{type,bottleId}},`material-${type.toLowerCase()}-${bottleId}`);
  for (const step of ['CHAIN','VACANCY']) add({type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step}},`uniqueness-${step.toLowerCase()}`);
  for (const type of ['ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED']) add({type:'MATERIAL',command:{type}},`material-${type.toLowerCase()}`);
  add({type:'STABILIZE_PROMOTION'},'darkness-stabilize_promotion');
  add({type:'CONSUME'},'darkness-first-failed-dose'); add({type:'CONSUME'},'darkness-first-failed-dose');
  add({type:'CONSUME'},'darkness-actual-promotion',outcome({promoted:true})); add({type:'START_EPILOGUE'},'darkness-start_epilogue');
  for (const type of ['SHORT_CONCEALMENT','BOUNDED_MISFORTUNE_DIVERSION','REPORT']) add({type:'EPILOGUE',command:{type}},`epilogue-${type.toLowerCase()}`);
  // Taxonomy cap fixture only, not a possible natural run or fabricated success.
  add({type:'MATERIAL',command:{type:'INVESTIGATE_LEGACY_REMAINS',bottleId:'misfortune-knight-potion-3'}},'material-investigate_legacy_remains-misfortune-knight-potion-3');
  return {rows,selected};
}
test('complete ledger independently binds same originals, four arrivals, actual outcomes and max25 cap', () => {
  const {rows,selected} = semanticFixture(); assert.equal(selected.length,25); assertBoundarySelection(rows,selected);
  for (const item of selected) assert.throws(() => assertBoundarySelection(rows,selected.filter(row => row !== item)));
  assert.throws(() => assertBoundarySelection(rows,[...selected,selected.at(-1)]));
  assert.throws(() => assertBoundarySelection(rows,[...selected].reverse()));
  const changed = structuredClone(rows); changed[3].commandCount++; assert.throws(() => assertBoundarySelection(changed,selected));
  changed[3].commandCount--; changed.find(row => row.intent.command.type === 'CONSUME').selectionOutcome.promoted = true;
  assert.throws(() => assertBoundarySelection(changed,selected));
  assert.throws(() => boundaryKind({type:'DARKNESS',command:{type:'MATERIAL',command:{type:'RECOVER_LEGACY_REMAINS',bottleId:'new-bottle'}}},outcome()));
  assert.throws(() => boundaryKind({type:'DARKNESS',command:{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step:'INVENTED'}}},outcome()));
  assert.throws(() => boundaryKind({type:'PERFECTER',command:{type:'REST'}},outcome()));
});
test('selection requires only occurred transitions and never assumes future success or recovery', () => {
  const {rows,selected} = semanticFixture(); assertBoundarySelection(rows.slice(0,4),selected.filter(row => row.commandCount <= PREFIX+4));
  assert.throws(() => assertBoundarySelection(rows.slice(0,4),selected));
  for (const status of ['DEAD','SLICE_COMPLETE','REVIVAL_PENDING'])
    assert.equal(boundaryKind({type:'DARKNESS',command:{type:'CONSUME'}},outcome({status})),'darkness-actual-terminal-dose');
  assert.equal(boundaryKind({type:'DARKNESS',command:{type:'CONSUME'}},outcome()),'darkness-first-failed-dose');
  assert.equal(boundaryKind({type:'DARKNESS',command:{type:'CONSUME'}},outcome({promoted:true})),'darkness-actual-promotion');
});
test('selection outcome includes exactly public arrival count, promotion and actual status', () => {
  assertSelectionOutcome(outcome());
  const view = {status:'ACTIVE',darkness:{promoted:true,sections:[{id:'darkness-evacuation',lines:['已到达3/4；实际住民']}]},get random(){throw Error('private');}};
  assert.deepEqual(selectionOutcome(view),outcome({promoted:true,arrivals:3}));
  for (const value of [{status:'ACTIVE'}, {...outcome(),private:true},{...outcome(),status:'VICTORY'}, {...outcome(),promoted:1},{...outcome(),arrivals:5},{...outcome(),arrivals:-1}]) assert.throws(() => assertSelectionOutcome(value));
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
  const root = mkdtempSync(join(tmpdir(), 'darkness-empty-preflight-'));
  const hooks = registerHooks({ resolve(specifier, context, next) {
    assert(specifier !== 'node:sqlite' && !specifier.includes('/dist/') && !specifier.includes('/scripts/play/'), 'Preflight cannot import runtime');
    return next(specifier, context);
  } });
  try {
    const capture = join(root, 'capture'); mkdirSync(capture); const manifest = join(root, 'inputs.json');
    writeFileSync(manifest, JSON.stringify({ format: INPUT_FORMAT, files: [] }));
    const self = fileURLToPath(new URL('./verify-darkness-sqlite.mjs', import.meta.url));
    await assert.rejects(verifyDarknessCapture({ repo: dirname(dirname(self)), sourceDirectory: capture,
      inputManifest: manifest, inputManifestSha256: fileEvidence(manifest).sha256, freezeSha256: 'a'.repeat(64), verifierSha256: fileEvidence(self).sha256, preflight: true }), /Empty capture/);
    assert.deepEqual(readdirSync(root).sort(), ['capture', 'inputs.json']); assert.deepEqual(readdirSync(capture), []);
  } finally { hooks.deregister(); rmSync(root, { recursive: true, force: true }); }
});

test('CLI is explicit and rejects duplicate flags, ambiguous resume, and preflight writes', () => {
  assert.deepEqual(parseOptions(['--source-directory', 'capture', '--preflight']), { sourceDirectory: 'capture', preflight: true });
  assert.equal(parseOptions(['--expected-boundaries', '25']).expectedBoundaries, 25);
  assert.equal(parseOptions(['--remove-stale-lock-pid', '123']).removeStaleLockPid, 123);
  for (const args of [['--expected-boundaries', '26'], ['--expected-boundaries', '0'], ['--remove-stale-lock-pid', '-1'], ['--preflight', '--preflight'], ['--source-directory'],
    ['--source-directory', '--preflight'], ['--unknown', 'x'], ['--output-directory', 'a', '--resume-directory', 'a'], ['--preflight', '--output-directory', 'a']]) assert.throws(() => parseOptions(args));
});

test('help remains import-safe and describes original679 and exact compressed evidence', () => workspace(root => {
  const text = execFileSync(process.execPath, [fileURLToPath(new URL('./verify-darkness-sqlite.mjs', import.meta.url)), '--help'], { cwd: root, encoding: 'utf8' });
  assert.match(text, /Original679 alive and independent694 DEAD bytes stay exact/); assert.match(text,/future migration is not accepted as that capture freeze/); assert.doesNotMatch(text,/final-runtime-proof|skip/);
  assert.deepEqual(readdirSync(root), []);
}));

test('stable hashes preserve all values and arrays while ignoring record-key order', () => {
  assert.equal(stateHash({ b: [2, 1], a: { y: 2, x: 1 } }), stateHash({ a: { x: 1, y: 2 }, b: [2, 1] }));
  assert.notEqual(stateHash({ b: [2, 1] }), stateHash({ b: [1, 2] }));
});

test('compressed capture evidence binds both actual stored and full decoded original bytes', () => workspace(root => {
  const path = join(root,'checkpoint.json.gz'), value = { payload: { exact:'原始内容', values:[3,2,1] } };
  const raw = Buffer.from(JSON.stringify(value)), compressed = gzipSync(raw,{level:6}); writeFileSync(path,compressed);
  assert.deepEqual(readCapture(path),value); assert(readCaptureBytes(path).equals(raw));
  assert.deepEqual(captureFileEvidence(path),{bytes:compressed.length,sha256:sha(compressed),originalBytes:raw.length,originalSha256:sha(raw)});
  const manifest = inspectCaptureInputs(root); assertInputManifest(manifest,structuredClone(manifest));
  for (const key of ['bytes','sha256','originalBytes','originalSha256']) {
    const altered = structuredClone(manifest); altered.files[0][key] = typeof altered.files[0][key] === 'number' ? 1 : 'b'.repeat(64);
    assert.throws(() => assertInputManifest(altered,manifest));
  }
  const missing = structuredClone(manifest); delete missing.files[0].originalSha256; assert.throws(() => assertInputManifest(missing,manifest));
  writeFileSync(path,gzipSync(raw,{level:1}));
  assert.deepEqual(readCapture(path),value); assert.throws(() => assertInputManifest(inspectCaptureInputs(root),manifest),'Equivalent decoded JSON cannot conceal compressed-byte drift');
}));

test('capture transport rejects corrupt gzip, wrong suffix and changed decoded payload', () => workspace(root => {
  const path = join(root,'natural.json.gz'); writeFileSync(path,gzipSync(Buffer.from('{"exact":true}')));
  const original = inspectCaptureInputs(root);
  writeFileSync(path,gzipSync(Buffer.from('{"exact":false}'))); assert.throws(() => assertInputManifest(inspectCaptureInputs(root),original));
  writeFileSync(path,Buffer.from('{"exact":true}')); assert.throws(() => readCapture(path),/encoding/);
  writeFileSync(path,Buffer.from([0x1f,0x8b,0,0])); assert.throws(() => inspectCaptureInputs(root));
  const plain = join(root,'wrong.json'); writeFileSync(plain,gzipSync(Buffer.from('{}'))); assert.throws(() => readCapture(plain),/encoding/);
}));

test('death, legitimate slice completion and paused-life statuses retain their actual terminal reason', () => {
  for (const status of ['DEAD','SLICE_COMPLETE','REVIVAL_PENDING']) {
    const capture = {stage:'NATURAL_ACTUAL_TERMINAL',reason:`Actual runtime status ${status}`};
    const cp = {state:{status},policy:{reported:false},terminal:{...capture}};
    assertCaptureStatus(capture,cp,{paused:false,diagnostic:false});
    assert.throws(() => assertCaptureStatus(capture,{...cp,state:{status:'ACTIVE'}},{paused:false,diagnostic:false}));
    assert.throws(() => assertCaptureStatus({...capture,reason:'Forced success'},cp,{paused:false,diagnostic:false}));
  }
  for (const stage of ['MANUAL_PAUSE','PUBLIC_ACTION_BLOCKED','PUBLIC_STABILITY_BINDING_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC','PUBLIC_ORDINARY_EXIT_REACHED']) {
    const capture = {stage,reason:'Actual boundary'};
    const summary = {paused:stage === 'MANUAL_PAUSE',diagnostic:stage !== 'MANUAL_PAUSE'};
    assertCaptureStatus(capture,{state:{status:'ACTIVE'},policy:{reported:false},terminal:null},summary);
    assert.throws(() => assertCaptureStatus(capture,{state:{status:'ACTIVE'},policy:{reported:false},terminal:{...capture}},summary));
  }
  const capture = {stage:'NATURAL_FINITE_DARKNESS_REPORTED',reason:'Actual report'};
  assertCaptureStatus(capture,{state:{status:'ACTIVE'},policy:{reported:true},terminal:{...capture}},{paused:false,diagnostic:false});
  assert.throws(() => assertCaptureStatus(capture,{state:{status:'ACTIVE'},policy:{reported:false},terminal:{...capture}},{paused:false,diagnostic:false}));
});

test('selected chapter actions require exact public enablement, label and costs', () => {
  const command = {type:'CONSUME',confirmed:true}, action = {command,enabled:true,label:'实际独立服用',cost:'实际费用'};
  const view = {darkness:{actions:[action]}}, intent = {type:'DARKNESS',command}, audit = {publicLabel:action.label,publicCost:action.cost};
  assertPublicAction(view,intent,audit); assert.throws(() => assertPublicAction(view,intent,{...audit,publicCost:'免费'}));
  assert.throws(() => assertPublicAction(view,{...intent,type:'ACTION'},audit));
  action.enabled = false; assert.throws(() => assertPublicAction(view,intent,audit));
});
test('whole public and chapter privacy allow genuine labels and prices but reject hidden identities and RNG', () => {
  const state = {random:{seed:'actual-private-seed'},darkness:{source:{actorId:'actual-private-actor',historyDigest:'actual-private-history'}}};
  const allowed = {prices:{preparation:'100便士'},check:{modifiers:[{source:'真实修正'}]},source:'普通公开来源'};
  assertGlobalPublic(allowed,state); assertPublicOnly({prices:allowed.prices,check:allowed.check});
  assertGlobalPublic({divineHand:{life:{site:{guard:{actorId:null}}}},glory:{life:{site:{guard:{actorId:null}}}}},state);
  for (const key of ['random','seed','cursor','cursorBefore','randomReceipts','sourceDigest','historyDigest','actorId','custodianActorId'])
    assert.throws(() => assertGlobalPublic({other:{[key]:null}},state));
  for (const secret of [state.random.seed,state.darkness.source.actorId,state.darkness.source.historyDigest]) assert.throws(() => assertGlobalPublic({text:secret},state));
  assert.throws(() => assertGlobalPublic({source:{}},state)); assert.throws(() => assertPublicOnly({source:'not-a-typed-label'}));
  for (const key of ['seed','random','futureRoll','privateSource','frame','journal']) assert.throws(() => assertPublicOnly({[key]:null}));
});
test('API and CLI reject broad skip, deletion and alternate-runtime flags rather than ignore them', () => {
  assertVerifyOptions({preflight:true});
  for (const key of ['skipFreeze','skipIntegrity','allowRuntimeDrift','finalRuntimeProof','deleteIncomplete','force','allBoundaries']) {
    assert.throws(() => assertVerifyOptions({[key]:true}));
    assert.throws(() => parseOptions([`--${key}`,'true']));
  }
  for (const options of [{preflight:true,outputDirectory:'out'},{outputDirectory:'a',resumeDirectory:'a'},
    {expectedBoundaries:26},{expectedBoundaries:0},{removeStaleLockPid:0},{preflight:'true'}]) assert.throws(() => assertVerifyOptions(options));
});

function compressionFixture(root, phase = 'VERIFIED', indexed = true) {
  // Opaque byte fixtures test the evidence protocol, never a SQLite/game claim.
  const work = join(root, 'case-680'), indexPath = join(root, 'completed.json'), hash = 'a'.repeat(64); mkdirSync(work);
  for (const file of ['case.sqlite', 'case.sqlite.bak']) writeFileSync(join(work, file), Buffer.from(`opaque contract bytes: ${file}\n`.repeat(50)));
  const result = { commandCount: 680, databaseFiles: Object.fromEntries(['case.sqlite', 'case.sqlite.bak'].map(file => [file, fileEvidence(join(work, file))])) };
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
  assert.throws(() => archiveCompletedCase(work, { ...result, commandCount: undefined }, indexPath), /Only actual completed Darkness/);
}));

function ledgerFixture() {
  // Opaque hash-chain contract only; these are not game states or natural evidence.
  const initialPolicy = {phase:'DARKNESS_ENTRY',week:158,doses:0,carriers:[],epilogueAttempted:[],reported:false,ordinaryExitReason:null,loop:{key:null,repetitions:0}};
  const source = {random:{seed:'opaque-contract-seed',cursor:348}}, before = {random:source.random,week:158};
  const after = {random:{seed:source.random.seed,cursor:349},week:158};
  const command = {type:'DARKNESS',command:{type:'LEARN_GUIDANCE'}}, policy = {...initialPolicy,phase:'DARKNESS_EVACUATION_MATERIALS'};
  const row = {commandCount:680,intent:command,commandSha256:sha(JSON.stringify(command)),reason:'opaque reason',publicLabel:'opaque label',publicCost:'opaque cost',
    startedAt:'2026-10-17T00:00:00.000Z',elapsedMilliseconds:1,revision:681,week:158,
    beforeStateSha256:stateHash(before),afterStateSha256:stateHash(after),publicBeforeSha256:sha('chapter-before'),publicAfterSha256:sha('chapter-after'),
    globalPublicBeforeSha256:sha('global-before'),globalPublicAfterSha256:sha('global-after'),randomBefore:source.random,randomAfter:after.random,
    randomBeforeSha256:stateHash(source.random),randomAfterSha256:stateHash(after.random),policyBeforeSha256:stateHash(initialPolicy),policyAfterSha256:stateHash(policy),
    receipts:{checks:[],finance:[],notes:[]},selectionOutcome:outcome()};
  const cp = {commandCount:680,commands:[command],rows:[row],state:after,policy,initialStateSha256:row.beforeStateSha256,finalStateSha256:row.afterStateSha256,
    initialPublicSha256:row.publicBeforeSha256,publicStateSha256:row.publicAfterSha256,initialGlobalPublicSha256:row.globalPublicBeforeSha256,
    globalPublicStateSha256:row.globalPublicAfterSha256,initialRandomSha256:row.randomBeforeSha256};
  return {cp,source};
}
test('complete ledger binds independent chapter/global/private/RNG/policy chains and exact counts', () => {
  const {cp,source} = ledgerFixture(); assertCommandRows(cp,source);
  const edits = [c=>c.rows.pop(),c=>c.rows.push(c.rows[0]),c=>c.commands.push(c.commands[0]),c=>c.commandCount++,c=>c.rows[0].revision++,
    c=>c.rows[0].commandSha256='a'.repeat(64),c=>c.rows[0].beforeStateSha256='b'.repeat(64),c=>c.rows[0].afterStateSha256='c'.repeat(64),
    c=>c.rows[0].publicBeforeSha256=c.rows[0].globalPublicBeforeSha256,c=>c.rows[0].publicAfterSha256=c.rows[0].globalPublicAfterSha256,
    c=>c.rows[0].globalPublicBeforeSha256=c.rows[0].publicBeforeSha256,c=>c.rows[0].globalPublicAfterSha256=c.rows[0].publicAfterSha256,
    c=>delete c.rows[0].globalPublicAfterSha256,c=>c.rows[0].randomAfter.seed='rerolled',c=>c.rows[0].randomAfter.cursor=347,
    c=>c.rows[0].policyBeforeSha256='d'.repeat(64),c=>c.rows[0].policyAfterSha256='e'.repeat(64),c=>c.state.week=159];
  for (const edit of edits) { const changed=structuredClone(cp); edit(changed); assert.throws(()=>assertCommandRows(changed,source)); }
});
test('unknown phase successor never permits retiring completed raw database copies', () => workspace(root => {
  const {work,indexPath,result}=compressionFixture(root); writeFileSync(join(work,'phase.json.next'),'unknown successor');
  assert.throws(()=>archiveCompletedCase(work,result,indexPath),/Unresolved phase/);
  for (const file of Object.keys(result.databaseFiles)) assert.deepEqual(fileEvidence(join(work,file)),result.databaseFiles[file]);
  assert(!existsSync(join(work,'archive.json')));
}));
