import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { gzipSync } from 'node:zlib';

// Pure contracts only: no capture/source reads, game/dist import, SQLite,
// builds, natural play, temporary files, databases or process inspection.
const guard = registerHooks({ resolve(specifier, context, next) {
  assert(specifier !== 'node:sqlite' && !specifier.includes('/dist/'), 'Pure verifier import cannot load the game or SQLite');
  return next(specifier, context);
} });
const audit = await import('./verify-sun-real-saves.mjs');
const producer = await import('./sun-stage.mjs');
guard.deregister();
const { FORMAT, INPUT_FORMAT, OUTPUT, PREFIX, BOUNDARY_LIMIT, CHECKS, actualReceipts, assertBoundarySelection,
  assertCaptureComplete, assertCaptureStatus, assertCompletedIndex, assertFreeze, assertInputManifest,
  assertResumeManifest, assertSelectionOutcome, assertVerifyOptions, boundaryKind, parseOptions,
  safeRelativeFile, selectBoundaries, shouldSubmitCommit, stable, stateHash, verifyPackedDatabase } = audit;
const sha = value => createHash('sha256').update(value).digest('hex');
const evidence = (file, digit = 'a') => ({file,bytes:5,sha256:digit.repeat(64)});
const facts = (overrides = {}) => ({status:'ACTIVE',sequence:1,promoted:false,guidance:true,...overrides});
const freeze = files => ({files,nodeVersion:'v24.15.0',sha256:sha(JSON.stringify(files))});
const boundary = commandCount => ({commandCount,beforeLast:{},lastIntent:{},final:{},randomBefore:{},randomAfter:{},
  publicBefore:{},public:{},globalPublicBefore:{},globalPublic:{},policyBefore:{},policyAfter:{},audit:{}});
const entry = (commandCount,kind='sun-learn_guidance') => ({...evidence(`action-${commandCount}.json.gz`),commandCount,kind});

test('import stays runtime-free and explicitly binds NEW216 original194 living853', () => {
  assert.equal(FORMAT,'NEW216_SUN_SELECTED_REAL_SQLITE_AUDIT_V1'); assert.equal(PREFIX,853); assert.equal(BOUNDARY_LIMIT,64);
  assert.equal(OUTPUT,'output/rebuild-0216/sqlite-natural-v1');
  assert.equal(audit.SOURCE,'tests/fixtures/pure-white-angel-v01940/natural.json');
  assert.equal(audit.SOURCE_SHA256,'3f13d554046ecffe3512bda22fb4cd14747be2b06dd6dd47185c025d7d9855f1');
  assert.equal(audit.SOURCE_STATE_SHA256,'98e3a20cedfe2fa9cec6be8645a6ea340592e497b6d4300b22d03f5476e4719a');
  assert.equal(audit.PREFIX_SHA256,'6a8dc284dffb34025d9709eb91328425420b4bd1417f61c5cfa091b66c0e65ce');
  assert(CHECKS.includes('beforeWrite-rollback')); assert(CHECKS.includes('COMMIT-rollback'));
  assert(CHECKS.includes('actual-death-seal-if-present')); assert(CHECKS.includes('duplicate-idempotent'));
});
test('canonical hashing matches Sun/runtime integer keys and rejects non-JSON values', () => {
  const value = {'10':'ten','2':'two',z:[-0,{b:1,a:2}],a:null};
  assert.equal(stable(value),producer.stable(value)); assert.equal(stateHash(value),producer.stateHash(value));
  assert.equal(stable(value),'{"2":"two","10":"ten","a":null,"z":[0,{"a":2,"b":1}]}');
  for (const value of [undefined,NaN,Infinity,new Date(),{secret:undefined}]) assert.throws(()=>stable(value));
});
test('CLI supports exact preflight, bounded invocations and resume without bypasses', () => {
  assert.deepEqual(parseOptions(['--preflight-only','--expected-boundaries','64']),{preflight:true,expectedBoundaries:64});
  assert.deepEqual(parseOptions(['--resume-directory','same','--limit','1']),{resumeDirectory:'same',limit:1});
  assert.deepEqual(parseOptions([]),{});
  for (const args of [['--skip'],['--seed','replacement'],['--source','other'],['--build'],['--force'],['--max-cases','1'],
    ['--preflight','--preflight-only'],['--expected-boundaries','65'],['--expected-boundaries','0'],['--expected-boundaries','1.5'],
    ['--output-directory','a','--resume-directory','b'],['--preflight','--output-directory','a'],['--preflight','--remove-stale-lock-pid','1'],
    ['--limit','0'],['--limit','65'],['--limit','-1'],['--limit','1.5'],['--limit','1','--limit','2'],['--preflight-only','--limit','1']])
    assert.throws(()=>parseOptions(args));
  assert.throws(()=>assertVerifyOptions({skipFailures:true})); assert.throws(()=>assertVerifyOptions({expectedBoundaries:65}));
});
test('capture manifests pin exact complete packed and original bytes, never a partial set', () => {
  const original = {format:INPUT_FORMAT,files:[evidence('a.json'),{...evidence('b.json.gz','b'),originalBytes:10,originalSha256:'c'.repeat(64)}]};
  assertInputManifest(original,structuredClone(original));
  for (const files of [[],original.files.slice(1),[...original.files].reverse(),[...original.files,evidence('c.json')],
    [original.files[0],original.files[0]],original.files.map(row=>({...row,bytes:6})),
    [original.files[0],{...original.files[1],originalSha256:'d'.repeat(64)}],
    [original.files[0],{...original.files[1],sha256:'e'.repeat(64)}]])
    assert.throws(()=>assertInputManifest({format:INPUT_FORMAT,files},original));
  for (const file of ['', '../secret','/absolute','C:/absolute','a/../b','./a','a//b','a\\b','a/','a\0b']) assert.throws(()=>safeRelativeFile(file));
});
test('frozen source, runtime, Node, producer, verifier, selection and paths cannot drift on resume', () => {
  const original = freeze([evidence('src/a.ts'),evidence('dist/a.js','b'),evidence('$natural-producer','c')]);
  assertFreeze(original,structuredClone(original));
  for (const changed of [freeze(original.files.slice(1)),freeze([...original.files].reverse()),freeze([...original.files,original.files[0]]),
    {...original,nodeVersion:'v24.16.0'},{...original,sha256:'e'.repeat(64)},{...original,skip:true}]) assert.throws(()=>assertFreeze(original,changed));
  const manifest = {format:FORMAT,freeze:original,verifier:evidence('verifier.mjs'),selected:[854],sourceDirectory:'/capture',repo:'/repo'};
  assertResumeManifest(manifest,structuredClone(manifest));
  for (const key of Object.keys(manifest)) assert.throws(()=>assertResumeManifest(manifest,{...manifest,[key]:null}));
});
function taxonomy() {
  const rows=[],selected=[],seen=new Set();
  const add = (command,outcome=facts()) => {
    const intent={type:'SUN',command}, commandCount=PREFIX+rows.length+1, kind=boundaryKind(intent,outcome);
    const previous=selected.map(row=>({kind:row.kinds[0],commandCount:row.commandCount}));
    assert.equal(producer.selectedBoundary(intent,outcome,previous),kind && !seen.has(kind) && selected.length<BOUNDARY_LIMIT ? kind : null);
    rows.push({commandCount,intent,selectionOutcome:outcome});
    if (kind && !seen.has(kind) && selected.length<BOUNDARY_LIMIT) {seen.add(kind);selected.push({commandCount,kinds:[kind]});}
  };
  for (const type of ['LEARN_GUIDANCE','WORK','REST','CLINIC','NEXT_WEEK','STABILIZE_PROMOTION','START_EPILOGUE','RETURN_ON_FOOT']) add({type});
  add({type:'REST'});
  for (const serviceId of ['one','two','three']) for (const type of ['FULFILL','RENEW','REVIEW_NEXT_WEEK']) add({type:'SERVICE',command:{type,serviceId}});
  for (const type of ['ACQUIRE_CHARACTERISTIC','INVESTIGATE_LEGACY_REMAINS','RECOVER_LEGACY_REMAINS','BUY_COMPOUND','SEAL_REMAINS','RECOVER_SEALED'])
    add({type:'MATERIAL',command:{type,bottleId:'pure-white-angel-potion-1'}});
  for (const step of ['CHAIN','VACANCY']) add({type:'MATERIAL',command:{type:'VERIFY_UNIQUENESS',step}});
  for (const compoundId of ['one','two','three']) add({type:'CONSUME',compoundId});
  add({type:'CONSUME',compoundId:'three'},facts({sequence:0,promoted:true}));
  for (const type of ['DIRECTED_RADIANCE','RADIANCE_WARD','REPORT']) add({type:'EPILOGUE',command:{type}});
  add({type:'CONSUME',compoundId:'three'},facts({status:'DEAD'}));
  // Opaque taxonomy-only values exercise the cap, never playable saves or natural evidence.
  for (let i=0;i<70;i++) add({type:'SERVICE',command:{type:'FULFILL',serviceId:`CONTRACT_${i}`}});
  return {rows,selected};
}
test('every first producer-selected boundary is required in exact order, with the cap preserved', () => {
  const {rows,selected}=taxonomy(); assert.equal(selected.length,64); assertBoundarySelection(rows,selected);
  for (const item of selected) assert.throws(()=>assertBoundarySelection(rows,selected.filter(row=>row!==item)));
  assert.throws(()=>assertBoundarySelection(rows,[...selected].reverse())); assert.throws(()=>assertBoundarySelection(rows,[...selected,selected[0]]));
  const changed=structuredClone(rows); changed[0].commandCount++; assert.throws(()=>assertBoundarySelection(changed,selected));
});
test('actual failed carrier, promotion and terminal remain distinct without fabricated success', () => {
  const intent={type:'SUN',command:{type:'CONSUME',compoundId:'first'}};
  assert.equal(boundaryKind(intent,facts()),'sun-failed-dose-first');
  assert.equal(boundaryKind(intent,facts({sequence:0,promoted:true})),'sun-actual-promotion');
  for (const status of ['DEAD','SLICE_COMPLETE','REVIVAL_PENDING']) assert.equal(boundaryKind(intent,facts({status})),'sun-actual-terminal');
  for (const value of [{},facts({sequence:2}),facts({status:'VICTORY'}),{...facts(),private:true},facts({guidance:1})]) assert.throws(()=>assertSelectionOutcome(value));
  assert.throws(()=>boundaryKind({type:'CREATE'},facts()));
});
test('boundary identity must be a unique actual full-action gzip file at its exact count', () => {
  const entries=[entry(854),entry(857,'sun-work')], selected=selectBoundaries(entries,item=>boundary(item.commandCount));
  assert.equal(selected[0].boundarySha256,stateHash(boundary(854)));
  for (const invalid of [[],[...entries].reverse(),[entries[0],entries[0]],[entries[0],entry(857)],
    [{...entries[0],file:'../action-854.json.gz'}],[entry(853)],Array.from({length:65},(_,i)=>entry(854+i,`kind-${i}`))])
    assert.throws(()=>selectBoundaries(invalid,item=>boundary(item.commandCount)));
  assert.throws(()=>selectBoundaries(entries,()=>boundary(855)));
});
test('paused, blocked, pending or inconsistent terminal capture cannot pass completion', () => {
  for (const stage of ['MANUAL_PAUSE','PUBLIC_ACTION_BLOCKED','PUBLIC_NO_PROGRESS_DIAGNOSTIC','NATURAL_FINITE_CARRIERS_UNAVAILABLE'])
    assert.throws(()=>assertCaptureComplete({stage,reason:'paused'},{terminal:null,pending:null}));
  for (const status of ['DEAD','SLICE_COMPLETE','REVIVAL_PENDING']) {
    const capture={stage:'NATURAL_ACTUAL_TERMINAL',reason:`Actual runtime status ${status}`}, cp={terminal:capture,pending:null,state:{status}};
    assertCaptureComplete(capture,cp); assertCaptureStatus(capture,cp,{paused:false,diagnostic:false});
    assert.throws(()=>assertCaptureComplete(capture,{...cp,pending:{}}));
    assert.throws(()=>assertCaptureComplete(capture,{...cp,state:{status:'ACTIVE'}}));
    assert.throws(()=>assertCaptureStatus(capture,cp,{paused:true,diagnostic:false}));
  }
  const capture={stage:'NATURAL_FINITE_SUN_REPORTED',reason:'Actually reported'}, cp={terminal:capture,pending:null,state:{status:'ACTIVE'},policy:{reported:true}};
  assertCaptureComplete(capture,cp);
  assert.throws(()=>assertCaptureComplete(capture,{...cp,policy:{reported:false}}));
});
test('completed index is an exact durable ordered prefix and a limit cannot claim completion', () => {
  const selected=[entry(854),entry(857,'sun-work')].map(item=>({commandCount:item.commandCount,kinds:[item.kind],files:[item.file],boundarySha256:'b'.repeat(64)}));
  const index={manifestSha256:'a'.repeat(64),results:[selected[0]],complete:false};
  assertCompletedIndex(index,index.manifestSha256,selected);
  for (const changed of [{...index,complete:true},{...index,results:[selected[1]]},{...index,results:[selected[0],selected[0]]},
    {...index,manifestSha256:'c'.repeat(64)}]) assert.throws(()=>assertCompletedIndex(changed,index.manifestSha256,selected));
  assertCompletedIndex({...index,results:selected,complete:true},index.manifestSha256,selected);
});
test('a saved post-COMMIT receipt is reconciled before any fresh original-intent submission', () => {
  const envelope={intentId:'new216-sun:854',runId:'same',expectedRevision:854,payload:{type:'SUN'}}, receipt={intentId:envelope.intentId,newRevision:855};
  const saved={fingerprint:stable(envelope),receipt};
  assert.equal(shouldSubmitCommit('COMMIT_ROLLBACK_VERIFIED',null,envelope,receipt),true);
  for (const phase of ['COMMIT_ROLLBACK_VERIFIED','COMMITTED','VERIFIED']) {
    assert.equal(shouldSubmitCommit(phase,structuredClone(saved),envelope,receipt),false);
    assert.throws(()=>shouldSubmitCommit(phase,{...saved,fingerprint:'other'},envelope,receipt));
    assert.throws(()=>shouldSubmitCommit(phase,{...saved,receipt:{...receipt,newRevision:856}},envelope,receipt));
  }
  for (const phase of ['ALLOCATED','BEFORE_SAVED','WRITE_ROLLBACK_VERIFIED','COMMITTED','VERIFIED']) assert.throws(()=>shouldSubmitCommit(phase,null,envelope,receipt));
});
test('actual receipts preserve first guidance and exact owned Sun journal entries', () => {
  const before={sun:{guidanceKnown:false,journal:[]},chronicle:['old']};
  const after={sun:{guidanceKnown:true,journal:[]},revision:855,chronicle:['old','new']};
  assert.deepEqual(actualReceipts(after,before),{checks:[],finance:[],notes:['new']});
  after.sun.journal.push({revision:855,randomReceipts:[{roll:60}],financeReceipts:[{cost:50}],notes:['actual']});
  assert.deepEqual(actualReceipts(after,before),{checks:[{roll:60}],finance:[{cost:50}],notes:['actual']});
  assert.throws(()=>actualReceipts({...after,revision:856},{...before,sun:{guidanceKnown:true,journal:[]}}));
});
test('public scans are exactly the producer guard and reject private field/value leaks', () => {
  assert.equal(audit.assertPublicOnly,producer.assertPublicOnly); assert.equal(audit.assertGlobalPublic,producer.assertGlobalPublic);
  audit.assertPublicOnly({source:'public label',check:{modifiers:[{source:'lawful'}]},prices:{preparation:100}});
  for (const value of [{random:{seed:'secret'}},{source:{actorId:'hidden'}},{cursor:1},{unrolledResult:2}]) assert.throws(()=>audit.assertPublicOnly(value));
  assert.throws(()=>audit.assertGlobalPublic({notes:'actual-secret-seed'},{random:{seed:'actual-secret-seed'},sun:{source:null}}));
});
test('gzip proves every original byte and packed hash, including cold archived resume', () => {
  const original=Buffer.from('opaque transport contract bytes\0with binary\xff'), packed=gzipSync(original), expected={bytes:original.length,sha256:sha(original)};
  assert.deepEqual(verifyPackedDatabase(original,packed,expected),{bytes:packed.length,sha256:sha(packed)});
  assert.deepEqual(verifyPackedDatabase(null,packed,expected),{bytes:packed.length,sha256:sha(packed)});
  assert.throws(()=>verifyPackedDatabase(Buffer.from('different'),packed,expected));
  assert.throws(()=>verifyPackedDatabase(null,gzipSync(Buffer.from('different')),expected));
  assert.throws(()=>verifyPackedDatabase(original,packed.subarray(0,packed.length-3),expected));
  assert.throws(()=>verifyPackedDatabase(original,packed,{...expected,sha256:'d'.repeat(64)}));
});

// Terminal save behavior is separately asserted even when the real natural run survives.
test('genuine death requires exact seal, non-actionable projection and ARCHIVED refusal', () => {
  const state={runId:'actual-dead-run',status:'DEAD'}, projection={canAct:false}, ids=[state.runId], blocked={ok:false,error:{code:'ARCHIVED'}};
  audit.assertDeathSeal(state,projection,ids,blocked);
  assert.throws(()=>audit.assertDeathSeal({...state,status:'SLICE_COMPLETE'},projection,ids,blocked));
  assert.throws(()=>audit.assertDeathSeal(state,{canAct:true},ids,blocked));
  for (const bad of [[],['other'],[state.runId,state.runId]]) assert.throws(()=>audit.assertDeathSeal(state,projection,bad,blocked));
  for (const bad of [{ok:true},{ok:false,error:{code:'SAVE_FAILED'}}]) assert.throws(()=>audit.assertDeathSeal(state,projection,ids,bad));
});
