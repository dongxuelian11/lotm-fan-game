import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { gzipSync } from 'node:zlib';

// Pure contract tests only: no fixtures, capture I/O, game modules, SQLite,
// builds, natural play, temporary directories or database mutation.
const guard = registerHooks({ resolve(specifier, context, next) {
  assert(specifier !== 'node:sqlite' && !specifier.includes('/dist/'), 'Pure verifier import cannot load the game or SQLite');
  return next(specifier, context);
} });
const audit = await import('./verify-tyrant-real-saves.mjs');
const producer = await import('./tyrant-stage.mjs');
const continuation = await import('./tyrant-stage-cooldown-v2.mjs');
guard.deregister();
const { FORMAT, INPUT_FORMAT, PREFIX, BOUNDARY_LIMIT, CHECKS, actualReceipts, assertBoundarySelection, assertCaptureComplete,
  assertCaptureStatus, assertCompletedIndex, assertFreeze, assertInputManifest, assertResumeManifest, assertSelectionOutcome,
  assertVerifyOptions, boundaryKind, parseOptions, safeRelativeFile, selectBoundaries, shouldSubmitCommit, stable, stateHash,
  verifyPackedDatabase } = audit;
const sha = value => createHash('sha256').update(value).digest('hex');
const evidence = (file, digit = 'a') => ({file,bytes:5,sha256:digit.repeat(64)});
const facts = (overrides = {}) => ({status:'ACTIVE',sequence:2,promoted:false,guidance:false,s1Reflected:false,...overrides});
const freeze = files => ({files,nodeVersion:'v24.15.0',sha256:sha(JSON.stringify(files))});
const boundary = commandCount => ({commandCount,beforeLast:{},lastIntent:{},final:{},randomBefore:{},randomAfter:{},
  publicBefore:{},public:{},globalPublicBefore:{},globalPublic:{},policyBefore:{},policyAfter:{},audit:{}});
const entry = (commandCount,kind='s1-request_recovery_v1') => ({...evidence(`action-${commandCount}.json.gz`),commandCount,kind});

test('import is runtime-free and the audit is explicitly rebuilt NEW215 from original701', () => {
  assert.equal(FORMAT,'NEW215_TYRANT_SELECTED_REAL_SQLITE_AUDIT_V1'); assert.equal(PREFIX,701); assert.equal(BOUNDARY_LIMIT,64);
  assert.equal(audit.SOURCE,'tests/fixtures/thunder-god-v01930/boundary-step-701-action.json');
  assert.equal(audit.SOURCE_SHA256,'6d721f6e2376085b77026c8a9373fbed5b005ee8a2413d27cdf5f02a4303f708');
  assert.equal(continuation.CONTINUATION_835.commandCount,835); assert.equal(continuation.CONTINUATION_835.newCommands,134);
  assert.equal(continuation.CONTINUATION_835.producerSha256,'33696eed2c892db28ebe49d989c7971e06a0eddcd01da359228e99a9f2b5eb58');
  assert.equal(continuation.POLICY.id,'NEW215_SAME_THREE_ORIGINALS_PUBLIC_REBUILD_COOLDOWN_V2');
  assert(CHECKS.includes('COMMIT-rollback')); assert(CHECKS.includes('actual-death-seal-if-present'));
});
test('CLI has no bypass, partial-selection, source, seed, draw, runtime or build override', () => {
  assert.deepEqual(parseOptions(['--preflight','--expected-boundaries','64']),{preflight:true,expectedBoundaries:64});
  for (const args of [['--skip'],['--seed','replacement'],['--max-cases','1'],['--source','other'],['--build'],['--force'],
    ['--preflight','--preflight'],['--expected-boundaries','65'],['--expected-boundaries','0'],['--expected-boundaries','1.5'],
    ['--output-directory','a','--resume-directory','b'],['--preflight','--output-directory','a'],['--preflight','--remove-stale-lock-pid','1']])
    assert.throws(()=>parseOptions(args));
  assert.throws(()=>assertVerifyOptions({skipFailures:true})); assert.throws(()=>assertVerifyOptions({expectedBoundaries:65}));
});
test('exact original and compressed capture file sets are pinned, ordered and nonempty', () => {
  const original = {format:INPUT_FORMAT,files:[evidence('a.json'),{...evidence('b.json.gz','b'),originalBytes:10,originalSha256:'c'.repeat(64)}]};
  assertInputManifest(original,structuredClone(original));
  for (const files of [[],original.files.slice(1),[...original.files].reverse(),[...original.files,evidence('c.json')],
    [original.files[0],original.files[0]],original.files.map(row=>({...row,bytes:6})),
    [original.files[0],{...original.files[1],originalSha256:'d'.repeat(64)}]])
    assert.throws(()=>assertInputManifest({format:INPUT_FORMAT,files},original));
  for (const file of ['', '../secret','/absolute','C:/absolute','a/../b','./a','a//b','a\\b','a/','a\0b']) assert.throws(()=>safeRelativeFile(file));
});
test('runtime freeze and resume require exact source, Node, producer, script, selection and paths', () => {
  const original = freeze([evidence('src/a.ts'),evidence('dist/a.js','b'),evidence('$natural-producer','c')]);
  assertFreeze(original,structuredClone(original));
  assert.throws(()=>continuation.assertOnlyProducerFreezeChanged(original,original,evidence('$natural-producer')),'Only pinned actual835 may admit the fixed producer-only delta');
  for (const changed of [freeze(original.files.slice(1)),freeze([...original.files].reverse()),freeze([...original.files,original.files[0]]),
    {...original,nodeVersion:'v24.16.0'},{...original,sha256:'e'.repeat(64)},{...original,skip:true}]) assert.throws(()=>assertFreeze(original,changed));
  const manifest = {format:FORMAT,freeze:original,verifier:evidence('verifier.mjs'),selected:[702],sourceDirectory:'/capture',repo:'/repo'};
  assertResumeManifest(manifest,structuredClone(manifest));
  for (const key of Object.keys(manifest)) assert.throws(()=>assertResumeManifest(manifest,{...manifest,[key]:null}));
});
function taxonomy() {
  const rows=[],selected=[],seen=new Set();
  const add = (intent,outcome=facts()) => {
    const commandCount=PREFIX+rows.length+1, kind=boundaryKind(intent,outcome);
    const previous=selected.map(row=>({kind:row.kinds[0],commandCount:row.commandCount}));
    assert.equal(producer.selectedBoundary(intent,outcome,previous),kind && !seen.has(kind) && selected.length<BOUNDARY_LIMIT ? kind : null);
    rows.push({commandCount,intent,selectionOutcome:outcome});
    if (kind && !seen.has(kind) && selected.length<BOUNDARY_LIMIT) {seen.add(kind);selected.push({commandCount,kinds:[kind]});}
  };
  for (const type of ['REQUEST_RECOVERY_V1','RECOVER_CHARACTERISTIC_V1','BUY_POTION','PREPARE_PROMOTION','STABILIZE_PROMOTION','REFLECT'])
    add({type:'THUNDER_GOD',command:{type,bottleId:'thunder-god-potion-1'}});
  add({type:'THUNDER_GOD',command:{type:'CONSUME'}},facts({sequence:1}));
  for (const caseId of ['FIRST','SECOND','THIRD']) add({type:'THUNDER_GOD',command:{type:'REPORT',caseId}});
  add({type:'ACTION',action:'REST'}); add({type:'EVENT_CHOICE',choiceId:'PAY'});
  for (const type of ['LEARN_GUIDANCE','CLINIC','STABILIZE_PROMOTION','START_EPILOGUE']) add({type:'TYRANT',command:{type}});
  for (const coastId of ['one','two','three']) for (const type of ['FULFILL','RENEW','REVIEW_NEXT_WEEK','LOAD_TRANSFER','DELIVER_TRANSFER'])
    add({type:'TYRANT',command:{type:'COAST',command:{type,coastId}}});
  for (const type of ['ACQUIRE_CHARACTERISTIC','INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS','ACQUIRE_UNIQUENESS','COMPOSE_POTION','SEAL_REMAINS','RECOVER_SEALED'])
    add({type:'TYRANT',command:{type:'MATERIAL',command:{type,bottleId:'thunder-god-potion-1'}}});
  for (const step of ['CHAIN','VACANCY']) add({type:'TYRANT',command:{type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step}}});
  add({type:'TYRANT',command:{type:'CONSUME'}}); add({type:'TYRANT',command:{type:'CONSUME'}});
  add({type:'TYRANT',command:{type:'CONSUME'}},facts({sequence:0,promoted:true}));
  for (const type of ['DIVERT_WATER','RELEASE_ENERGY','REPORT']) add({type:'TYRANT',command:{type:'EPILOGUE',command:{type}}});
  // Opaque taxonomy-only values exercise the cap, never substitute natural evidence.
  for (let i=0;i<70;i++) add({type:'TYRANT',command:{type:'CHALLENGE',command:{type:`CONTRACT_${i}`}}});
  return {rows,selected};
}
test('all first producer-selected action boundaries are required exactly once and capped at64', () => {
  const {rows,selected}=taxonomy(); assert.equal(selected.length,64); assertBoundarySelection(rows,selected);
  for (const item of selected) assert.throws(()=>assertBoundarySelection(rows,selected.filter(row=>row!==item)));
  assert.throws(()=>assertBoundarySelection(rows,[...selected].reverse())); assert.throws(()=>assertBoundarySelection(rows,[...selected,selected[0]]));
  const changed=structuredClone(rows); changed[0].commandCount++; assert.throws(()=>assertBoundarySelection(changed,selected));
});
test('selection retains actual S1 and S0 failure, promotion or terminal without inventing success', () => {
  assert.equal(boundaryKind({type:'THUNDER_GOD',command:{type:'CONSUME'}},facts()),'s1-first-recovered-dose-failure');
  assert.equal(boundaryKind({type:'THUNDER_GOD',command:{type:'CONSUME'}},facts({sequence:1})),'s1-actual-promotion');
  assert.equal(boundaryKind({type:'TYRANT',command:{type:'CONSUME'}},facts()),'tyrant-first-failed-dose');
  for (const status of ['DEAD','SLICE_COMPLETE','REVIVAL_PENDING']) {
    assert.equal(boundaryKind({type:'TYRANT',command:{type:'CONSUME'}},facts({status})),'tyrant-actual-terminal');
    assert.equal(boundaryKind({type:'THUNDER_GOD',command:{type:'CONSUME'}},facts({status})),'thunder_god-actual-terminal');
  }
  for (const value of [{},facts({sequence:3}),facts({status:'VICTORY'}),{...facts(),private:true},facts({guidance:1})]) assert.throws(()=>assertSelectionOutcome(value));
});
test('selected capture identities must be exact unique action files and ordered counts', () => {
  const entries=[entry(702),entry(705,'s1-recover_characteristic_v1')], selected=selectBoundaries(entries,item=>boundary(item.commandCount));
  assert.equal(selected[0].boundarySha256,stateHash(boundary(702)));
  for (const invalid of [[],[...entries].reverse(),[entries[0],entries[0]],[entries[0],entry(705)],
    [{...entries[0],file:'../action-702.json.gz'}],[entry(701)],Array.from({length:65},(_,i)=>entry(702+i,`kind-${i}`))])
    assert.throws(()=>selectBoundaries(invalid,item=>boundary(item.commandCount)));
  assert.throws(()=>selectBoundaries(entries,()=>boundary(703)));
});
test('paused/diagnostic/pending captures cannot be labeled complete and death stays distinct', () => {
  for (const stage of ['MANUAL_PAUSE','PUBLIC_ACTION_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC'])
    assert.throws(()=>assertCaptureComplete({stage,reason:'paused'},{terminal:null,pending:null}));
  const capture={stage:'NATURAL_ACTUAL_TERMINAL',reason:'Actual runtime status DEAD'}, cp={terminal:capture,pending:null,state:{status:'DEAD'}};
  assertCaptureComplete(capture,cp); assertCaptureStatus(capture,cp,{paused:false,diagnostic:false});
  assert.throws(()=>assertCaptureComplete(capture,{...cp,pending:{}}));
  assert.throws(()=>assertCaptureStatus(capture,{...cp,state:{status:'ACTIVE'}},{paused:false,diagnostic:false}));
});
test('completed index is an exact durable ordered prefix and cannot claim premature completion', () => {
  const selected=[entry(702),entry(705,'s1-recover_characteristic_v1')].map(item=>({commandCount:item.commandCount,kinds:[item.kind],files:[item.file],boundarySha256:'b'.repeat(64)}));
  const index={manifestSha256:'a'.repeat(64),results:[selected[0]],complete:false};
  assertCompletedIndex(index,index.manifestSha256,selected);
  for (const changed of [{...index,complete:true},{...index,results:[selected[1]]},{...index,results:[selected[0],selected[0]]},
    {...index,manifestSha256:'c'.repeat(64)}]) assert.throws(()=>assertCompletedIndex(changed,index.manifestSha256,selected));
});
test('a receipt recovered after COMMIT is checked before any fresh submission', () => {
  const envelope={intentId:'new215-tyrant:702',runId:'same',expectedRevision:702,payload:{type:'THUNDER_GOD'}}, receipt={intentId:envelope.intentId,newRevision:703};
  const saved={fingerprint:stable(envelope),receipt};
  assert.equal(shouldSubmitCommit('COMMIT_ROLLBACK_VERIFIED',null,envelope,receipt),true);
  for (const phase of ['COMMIT_ROLLBACK_VERIFIED','COMMITTED','VERIFIED']) {
    assert.equal(shouldSubmitCommit(phase,structuredClone(saved),envelope,receipt),false);
    assert.throws(()=>shouldSubmitCommit(phase,{...saved,fingerprint:'other'},envelope,receipt));
    assert.throws(()=>shouldSubmitCommit(phase,{...saved,receipt:{...receipt,newRevision:704}},envelope,receipt));
  }
  for (const phase of ['ALLOCATED','BEFORE_SAVED','WRITE_ROLLBACK_VERIFIED','COMMITTED','VERIFIED']) assert.throws(()=>shouldSubmitCommit(phase,null,envelope,receipt));
});
test('actual receipts cover both pre-Tyrant S1 acquisition/life and owned Tyrant journals', () => {
  const before={tyrant:{journal:[]},thunderGod:{acquisitionJournal:[{old:true}],life:{journal:[]}},chronicle:['old']};
  const after={...structuredClone(before),revision:703,chronicle:['old','new']};
  after.thunderGod.acquisitionJournal.push({check:{roll:36},paid:120}); after.thunderGod.life.journal.push({check:{roll:40}});
  assert.deepEqual(actualReceipts(after,before),{checks:[{roll:36},{roll:40}],acquisition:[{check:{roll:36},paid:120}],life:[{check:{roll:40}}],finance:[],notes:['new']});
  after.tyrant.journal.push({revision:703,randomReceipts:[{roll:60}],financeReceipts:[{cost:50}],notes:['actual']});
  assert.deepEqual(actualReceipts(after,before),{checks:[{roll:60}],finance:[{cost:50}],notes:['actual']});
});
test('gzip proof binds all original bytes and packed hash, including cold archived resume', () => {
  const original=Buffer.from('opaque transport contract bytes\0with binary\xff'), packed=gzipSync(original), expected={bytes:original.length,sha256:sha(original)};
  assert.deepEqual(verifyPackedDatabase(original,packed,expected),{bytes:packed.length,sha256:sha(packed)});
  assert.deepEqual(verifyPackedDatabase(null,packed,expected),{bytes:packed.length,sha256:sha(packed)});
  assert.throws(()=>verifyPackedDatabase(Buffer.from('different'),packed,expected));
  assert.throws(()=>verifyPackedDatabase(null,gzipSync(Buffer.from('different')),expected));
  assert.throws(()=>verifyPackedDatabase(original,packed.subarray(0,packed.length-3),expected));
  assert.throws(()=>verifyPackedDatabase(original,packed,{...expected,sha256:'d'.repeat(64)}));
});
