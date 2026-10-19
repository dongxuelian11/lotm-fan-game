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
import { FORMAT, INPUT_FORMAT, PREFIX, BOUNDARY_LIMIT, archiveCompletedCase, assertFreeze, assertCaptureRuntimeFreeze, REVIEWED_PUBLIC_REPAIR, assertInputManifest, assertOutputPath, assertBoundarySelection, assertResumeManifest, claimAuditLock,
  assertCaptureStatus, assertPublicAction, assertSelectionOutcome, assertVerifyOptions, boundaryKind, captureFileEvidence, fileEvidence, inspectCaptureInputs, parseOptions, readCapture, readCaptureBytes, safeRelativeFile, selectBoundaries, selectionOutcome, stateHash, verifyMoonCapture } from './moon-stage-saves.mjs';

// Contracts only: no game/dist imports, source fixtures, natural play or SQLite.
const sha = value => createHash('sha256').update(value).digest('hex');
const evidence = (file, digit = 'a') => ({ file, bytes: 5, sha256: digit.repeat(64) });
const freeze = files => ({ files, nodeVersion: 'v24.15.0', sha256: sha(JSON.stringify(files)) });
function workspace(run) {
  const root = mkdtempSync(join(tmpdir(), 'moon-save-contract-'));
  try { return run(root); } finally { rmSync(root, { recursive: true, force: true }); }
}

test('import is safe with an empty working directory and no compiled runtime', () => workspace(root => {
  execFileSync(process.execPath, ['--input-type=module', '--eval', `
    import { registerHooks } from 'node:module';
    registerHooks({ resolve(specifier, context, next) {
      if (specifier === 'node:sqlite' || specifier.includes('/dist/') || specifier.includes('/scripts/play/')) throw new Error('Forbidden runtime import');
      return next(specifier, context);
    } });
    await import(${JSON.stringify(new URL('./moon-stage-saves.mjs', import.meta.url).href)});`], { cwd: root });
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

test('reviewed public repair accepts only its complete exact runtime and rejects any extra drift', () => {
  const captured = JSON.parse(readFileSync(new URL('../../tests/fixtures/moon-v02120/freeze.json', import.meta.url), 'utf8'));
  const patches = new Map(REVIEWED_PUBLIC_REPAIR.files.map(row => [row.file, row.after]));
  const current = { ...captured, files: captured.files.map(row => patches.has(row.file) ? { file: row.file, ...patches.get(row.file) } : row) };
  current.sha256 = sha(JSON.stringify(current.files));
  assert.equal(current.sha256, REVIEWED_PUBLIC_REPAIR.runtimeSha256);
  assertCaptureRuntimeFreeze(captured, current);
  assertCaptureRuntimeFreeze(captured, structuredClone(captured));
  const extra = structuredClone(current); extra.files[0].sha256 = 'f'.repeat(64); extra.sha256 = sha(JSON.stringify(extra.files));
  assert.throws(() => assertCaptureRuntimeFreeze(captured, extra));
  const omitted = structuredClone(current); omitted.files.pop(); omitted.sha256 = sha(JSON.stringify(omitted.files));
  assert.throws(() => assertCaptureRuntimeFreeze(captured, omitted));
  const wrongBefore = structuredClone(captured); wrongBefore.files[0].bytes++; wrongBefore.sha256 = sha(JSON.stringify(wrongBefore.files));
  assert.throws(() => assertCaptureRuntimeFreeze(wrongBefore, current));
  assert.throws(() => assertCaptureRuntimeFreeze(captured, { ...current, nodeVersion: 'v24.15.0' }));
});

test('resume fingerprint binds complete inputs, runtime, verifier, selection and paths', () => {
  const manifest = { format: FORMAT, inputs: { format: INPUT_FORMAT, files: [evidence('checkpoint.json')] }, freeze: freeze([evidence('$natural-producer')]),
    runtimeFreeze: freeze([evidence('dist/current.js')]), verifier: evidence('verifier.mjs'), selected: [{ commandCount: 671 }], sourceDirectory: '/capture', repo: '/repo' };
  assertResumeManifest(manifest, structuredClone(manifest));
  for (const key of Object.keys(manifest)) assert.throws(() => assertResumeManifest(manifest, { ...manifest, [key]: null }));
});

const outcome = (overrides = {}) => ({ status: 'ACTIVE', beautyPromoted: false, moonPromoted: false, ...overrides });
function boundary(commandCount, marker = 'actual') {
  return { commandCount, beforeLast: { marker }, lastIntent: { type: 'ACTION', action: 'REST' }, final: { marker }, public: { marker }, audit: { marker } };
}
function index(commandCount, kind = 'first-ordinary-rest') { return { ...evidence(`boundary-${commandCount}-${kind}.json.gz`), commandCount, kind }; }
test('selected gzip boundaries must be unique exact producer files in increasing command order', () => {
  const entries = [index(671),index(672,'first-ordinary-work')];
  const selected = selectBoundaries(entries,item => boundary(item.commandCount));
  assert.deepEqual(selected.map(row => row.commandCount),[671,672]);
  assert.deepEqual(selected[0].files,[entries[0].file]); assert.deepEqual(selected[0].kinds,['first-ordinary-rest']);
  assert.equal(selected[0].boundarySha256,stateHash(boundary(671)));
  for (const invalid of [[],[...entries].reverse(),[entries[0],entries[0]],[entries[0],index(672)],
    [entries[0],index(671,'first-ordinary-work')],[{...entries[0],file:'../boundary.json.gz'}],
    [{...entries[0],file:'boundary-671-first-ordinary-rest.json'}],[index(670)]])
    assert.throws(() => selectBoundaries(invalid,item => boundary(item.commandCount)));
  assert.throws(() => selectBoundaries(entries,() => boundary(673)));
  assert.throws(() => selectBoundaries(entries,item => ({...boundary(item.commandCount),synthetic:true})));
  assert.throws(() => selectBoundaries(Array.from({length:31},(_,i) => index(671+i,`extra-${i}`)),item => boundary(item.commandCount)));
});
function semanticFixture() {
  const rows = [], selected = [], seen = new Set();
  const add = (intent, kind = null, facts = outcome()) => {
    const commandCount = PREFIX + rows.length + 1;
    rows.push({ commandCount,intent,selectionOutcome:facts });
    if (kind && !seen.has(kind) && selected.length < BOUNDARY_LIMIT) { seen.add(kind); selected.push({commandCount,kinds:[kind]}); }
  };
  add({type:'ACTION',action:'REST'},'first-ordinary-rest'); add({type:'ACTION',action:'REST'});
  add({type:'ACTION',action:'WORK'},'first-ordinary-work'); add({type:'EVENT_CHOICE'},'first-original-finance-event');
  for (const type of ['REQUEST_RECOVERY_V1','RECOVER_CHARACTERISTIC_V1','POTION_WORK','BUY_POTION','PREPARE_PROMOTION','REFLECT'])
    add({type:'BEAUTY_GODDESS',command:{type}},`s1-${type.toLowerCase()}`);
  add({type:'BEAUTY_GODDESS',command:{type:'CONSUME'}},'s1-first-recovery-failure');
  add({type:'BEAUTY_GODDESS',command:{type:'CONSUME'}},'s1-actual-promotion',outcome({beautyPromoted:true}));
  add({type:'BEAUTY_GODDESS',command:{type:'INVITE'}});
  for (const type of ['LEARN_GUIDANCE','STABILIZE_PROMOTION','START_EPILOGUE']) add({type:'MOON',command:{type}},`moon-${type.toLowerCase()}`);
  for (const stationId of ['NORTH','REED','EAST']) for (const type of ['CONDUCT_SERVICE','VERIFY','REPAIR_DAMAGE'])
    add({type:'MOON',command:{type:'SERVICE',command:{type,stationId}}},`night-${stationId}-${type.toLowerCase()}`);
  for (const type of ['RECOVER_LEGACY_REMAINS','ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED'])
    add({type:'MOON',command:{type:'MATERIAL',command:{type}}},`moon-${type.toLowerCase()}`);
  add({type:'MOON',command:{type:'CONSUME'}},'moon-first-failed-dose');
  add({type:'MOON',command:{type:'CONSUME'}},'moon-actual-promotion',outcome({beautyPromoted:true,moonPromoted:true}));
  add({type:'MOON',command:{type:'EPILOGUE',command:{type:'REPORT'}}},'moon-finite-actual-report');
  return {rows,selected};
}
test('complete ledger independently binds selected recovery, actual outcomes, three stations and max30 cap', () => {
  const {rows,selected} = semanticFixture(); assert.equal(selected.length,30); assertBoundarySelection(rows,selected);
  for (const item of selected) assert.throws(() => assertBoundarySelection(rows,selected.filter(row => row !== item)));
  assert.throws(() => assertBoundarySelection(rows,[...selected,selected.at(-1)]));
  assert.throws(() => assertBoundarySelection(rows,[...selected].reverse()));
  const changed = structuredClone(rows); changed[3].commandCount++; assert.throws(() => assertBoundarySelection(changed,selected));
  changed[3].commandCount--; changed.find(row => row.intent.command?.type === 'CONSUME').selectionOutcome.beautyPromoted = true;
  assert.throws(() => assertBoundarySelection(changed,selected));
  assert.throws(() => boundaryKind({type:'BEAUTY_GODDESS',command:{type:'REQUEST_SUPPLY'}},outcome()));
  assert.throws(() => boundaryKind({type:'MOON',command:{type:'SERVICE',command:{type:'VERIFY',stationId:'INVENTED'}}},outcome()));
  assert.throws(() => boundaryKind({type:'PERFECTER',command:{type:'REST'}},outcome()));
});
test('selection requires only actual occurred transitions, never future success or recovery', () => {
  const {rows,selected} = semanticFixture(); assertBoundarySelection(rows.slice(0,4),selected.filter(row => row.commandCount <= 674));
  assert.throws(() => assertBoundarySelection(rows.slice(0,4),selected));
  for (const status of ['DEAD','SLICE_COMPLETE','REVIVAL_PENDING'])
    assert.equal(boundaryKind({type:'MOON',command:{type:'CONSUME'}},outcome({status})),'moon-actual-terminal-dose');
  assert.equal(boundaryKind({type:'MOON',command:{type:'CONSUME'}},outcome()),'moon-first-failed-dose');
  assert.equal(boundaryKind({type:'MOON',command:{type:'CONSUME'}},outcome({moonPromoted:true})),'moon-actual-promotion');
});
test('selection outcomes have exactly public minimal fields and require real boolean promotion values', () => {
  assertSelectionOutcome(outcome());
  const view = {status:'ACTIVE',beautyGoddess:{promoted:true},moon:{promoted:false},get random(){throw Error('private');}};
  assert.deepEqual(selectionOutcome(view),outcome({beautyPromoted:true}));
  for (const value of [{status:'ACTIVE'}, {...outcome(),private:true},{...outcome(),status:'VICTORY'}, {...outcome(),moonPromoted:1}]) assert.throws(() => assertSelectionOutcome(value));
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
  const root = mkdtempSync(join(tmpdir(), 'moon-empty-preflight-'));
  const hooks = registerHooks({ resolve(specifier, context, next) {
    assert(specifier !== 'node:sqlite' && !specifier.includes('/dist/') && !specifier.includes('/scripts/play/'), 'Preflight cannot import runtime');
    return next(specifier, context);
  } });
  try {
    const capture = join(root, 'capture'); mkdirSync(capture); const manifest = join(root, 'inputs.json');
    writeFileSync(manifest, JSON.stringify({ format: INPUT_FORMAT, files: [] }));
    const self = fileURLToPath(new URL('./moon-stage-saves.mjs', import.meta.url));
    await assert.rejects(verifyMoonCapture({ repo: dirname(dirname(dirname(self))), sourceDirectory: capture,
      inputManifest: manifest, inputManifestSha256: fileEvidence(manifest).sha256, freezeSha256: 'a'.repeat(64), verifierSha256: fileEvidence(self).sha256, preflight: true }), /Empty capture/);
    assert.deepEqual(readdirSync(root).sort(), ['capture', 'inputs.json']); assert.deepEqual(readdirSync(capture), []);
  } finally { hooks.deregister(); rmSync(root, { recursive: true, force: true }); }
});

test('CLI is explicit and rejects duplicate flags, ambiguous resume, and preflight writes', () => {
  assert.deepEqual(parseOptions(['--source-directory', 'capture', '--preflight']), { sourceDirectory: 'capture', preflight: true });
  assert.equal(parseOptions(['--expected-boundaries', '30']).expectedBoundaries, 30);
  assert.equal(parseOptions(['--remove-stale-lock-pid', '123']).removeStaleLockPid, 123);
  for (const args of [['--expected-boundaries', '31'], ['--expected-boundaries', '0'], ['--remove-stale-lock-pid', '-1'], ['--preflight', '--preflight'], ['--source-directory'],
    ['--source-directory', '--preflight'], ['--unknown', 'x'], ['--output-directory', 'a', '--resume-directory', 'a'], ['--preflight', '--output-directory', 'a']]) assert.throws(() => parseOptions(args));
});

test('help remains import-safe and describes original670 and exact compressed evidence', () => workspace(root => {
  const text = execFileSync(process.execPath, [fileURLToPath(new URL('./moon-stage-saves.mjs', import.meta.url)), '--help'], { cwd: root, encoding: 'utf8' });
  assert.match(text, /Original670 history is retained byte-for-byte/); assert.match(text,/archived912 and stage211 evidence are never inputs/); assert.doesNotMatch(text,/final-runtime-proof|skip/);
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
  for (const stage of ['MANUAL_PAUSE','PUBLIC_ACTION_BLOCKED','PUBLIC_STABILITY_BINDING_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC']) {
    const capture = {stage,reason:'Actual boundary'};
    const summary = {paused:stage === 'MANUAL_PAUSE',diagnostic:stage !== 'MANUAL_PAUSE'};
    assertCaptureStatus(capture,{state:{status:'ACTIVE'},policy:{reported:false},terminal:null},summary);
    assert.throws(() => assertCaptureStatus(capture,{state:{status:'ACTIVE'},policy:{reported:false},terminal:{...capture}},summary));
  }
  const capture = {stage:'NATURAL_FINITE_MOON_REPORTED',reason:'Actual report'};
  assertCaptureStatus(capture,{state:{status:'ACTIVE'},policy:{reported:true},terminal:{...capture}},{paused:false,diagnostic:false});
  assert.throws(() => assertCaptureStatus(capture,{state:{status:'ACTIVE'},policy:{reported:false},terminal:{...capture}},{paused:false,diagnostic:false}));
});

test('selected ordinary, event and chapter actions require exact public enablement, label and costs', () => {
  const ordinary = {publicLabel:'做本周原职业工作',publicCost:'1行动；真实工资、生活费与旧债照常结算'};
  assertPublicAction({canAct:true,wagePaid:false},{type:'ACTION',action:'WORK'},ordinary);
  assert.throws(() => assertPublicAction({canAct:true,wagePaid:true},{type:'ACTION',action:'WORK'},ordinary));
  assert.throws(() => assertPublicAction({canAct:false,wagePaid:false},{type:'ACTION',action:'WORK'},ordinary));
  const event = {activeEvent:{instanceId:'actual-event',choices:[{id:'PAY_PART',enabled:true,label:'支付实际账单'}]}};
  const intent = {type:'EVENT_CHOICE',eventInstanceId:'actual-event',choiceId:'PAY_PART'};
  const audit = {publicLabel:'支付实际账单',publicCost:'按当前公开事件结算实际费用与旧债'};
  assertPublicAction(event,intent,audit); assert.throws(() => assertPublicAction(event,{...intent,eventInstanceId:'other'},audit));
  for (const type of ['BEAUTY_GODDESS','MOON']) {
    const panel = type === 'MOON' ? 'moon' : 'beautyGoddess', command = {type:'CONSUME',confirmed:true};
    const action = {command,enabled:true,label:'实际独立服用',cost:'实际费用'}, view = {[panel]:{actions:[action]}};
    const receipt = {publicLabel:action.label,publicCost:action.cost}; assertPublicAction(view,{type,command},receipt);
    assert.throws(() => assertPublicAction(view,{type,command},{...receipt,publicCost:'免费'}));
    action.enabled = false; assert.throws(() => assertPublicAction(view,{type,command},receipt));
  }
});

test('API and CLI reject broad skip, deletion and alternate-runtime flags rather than ignore them', () => {
  assertVerifyOptions({preflight:true});
  for (const key of ['skipFreeze','skipIntegrity','allowRuntimeDrift','finalRuntimeProof','deleteIncomplete','force','allBoundaries']) {
    assert.throws(() => assertVerifyOptions({[key]:true}));
    assert.throws(() => parseOptions([`--${key}`,'true']));
  }
  for (const options of [{preflight:true,outputDirectory:'out'},{outputDirectory:'a',resumeDirectory:'a'},
    {expectedBoundaries:31},{expectedBoundaries:0},{removeStaleLockPid:0},{preflight:'true'}]) assert.throws(() => assertVerifyOptions(options));
});

function compressionFixture(root, phase = 'VERIFIED', indexed = true) {
  // Opaque byte fixtures test the evidence protocol, never a SQLite/game claim.
  const work = join(root, 'case-671'), indexPath = join(root, 'completed.json'), hash = 'a'.repeat(64); mkdirSync(work);
  for (const file of ['case.sqlite', 'case.sqlite.bak']) writeFileSync(join(work, file), Buffer.from(`opaque contract bytes: ${file}\n`.repeat(50)));
  const result = { commandCount: 671, databaseFiles: Object.fromEntries(['case.sqlite', 'case.sqlite.bak'].map(file => [file, fileEvidence(join(work, file))])) };
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
  assert.throws(() => archiveCompletedCase(work, { ...result, commandCount: undefined }, indexPath), /Only actual completed Moon/);
}));
