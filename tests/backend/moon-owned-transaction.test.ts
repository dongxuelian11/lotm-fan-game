/** Explicit controlled S1 from unchanged full670 -> paid Moon guidance ->
 * private session. The declared S1 draw control remains active for strict replay.
 * This is not a natural success capture. Transaction faults never supply domain
 * authority, rewrite source evidence or control Moon outcomes. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteSliceStore } from '../../src/persistence/slice-store.js';
import { SliceApplication, type StoredSlice } from '../../src/application/slice-application.js';
import type { OwnedRepositoryDraft } from '../../src/application/slice-owned-runtime.js';
import { MemorySliceRepository } from '../../src/simulation/slice-browser-bridge.js';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { openMoonRuntimeSession } from '../../src/domain/moon/owned-session.js';
import { projectMoon } from '../../src/domain/moon/index.js';
import { MOON_FROZEN_SOURCE_KEYS } from '../../src/domain/moon/source.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { controlledMoonSource, installControlledMoonS1Promotion, assertUnmodifiedMoonRecoverySource } from '../helpers/moon-source.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';

const observed=vi.hoisted(()=>({opens:0,prepares:0,commits:0,revisions:[] as (()=>number)[]}));
vi.mock('../../src/domain/moon/owned-session.js',async importOriginal=>{
  const actual=await importOriginal<typeof import('../../src/domain/moon/owned-session.js')>();
  return {...actual,openMoonRuntimeSession:(input:unknown)=>{
    const session=actual.openMoonRuntimeSession(input);observed.opens++;observed.revisions.push(()=>session.inspect().revision);
    return Object.freeze({...session,
      prepare:(...args:Parameters<typeof session.prepare>)=>{observed.prepares++;return session.prepare(...args);},
      commit:(...args:Parameters<typeof session.commit>)=>{session.commit(...args);observed.commits++;},
    });
  }};
});
const now='2026-10-17T14:00:00.000Z';
const rest:SliceIntent={type:'MOON',command:{type:'REST'}};
let source:SliceState,initial:SliceState,expected:SliceState,expectedProjection:SliceProjection;
const dirs:string[]=[],stores:SqliteSliceStore[]=[];
function unwrap<T>(value:SliceResult<T>):T{if(!value.ok)throw Error(value.error.message);return value.value;}
function envelope(id='moon-owned-rest',state=initial,payload=rest):SliceEnvelope{return {intentId:id,runId:state.runId,expectedRevision:state.revision,payload:structuredClone(payload)};}
function disk(beforeWrite?:()=>void,state=initial){
  const dir=mkdtempSync(join(tmpdir(),'lotm-moon-owned-'));dirs.push(dir);const file=join(dir,'save.sqlite');
  const store=new SqliteSliceStore(file,{now:()=>now,...(beforeWrite?{beforeWrite}:{})});stores.push(store);
  store.repository.transaction(()=>{store.repository.put({state,updatedAt:now});store.repository.selectRun('previous-selected-slot');});
  if(state.moon.guidanceKnown)expect(store.repository.ownedHead(state.runId)?.revision).toBe(state.revision);
  else expect(store.repository.ownedHead(state.runId)).toBeNull();return {file,store};
}
function raw(file:string):string{const db=new DatabaseSync(file,{readOnly:true});try{return String(db.prepare('SELECT current_json FROM slice_runs WHERE id=?').get(initial.runId)!.current_json);}finally{db.close();}}
function stored(file:string):StoredSlice{return JSON.parse(JSON.parse(raw(file)).payload) as StoredSlice;}
function replaceRaw(file:string,value:StoredSlice):void{
  const payload=stableStringify(value),encoded=JSON.stringify({format:1,checksum:createHash('sha256').update(payload).digest('hex'),payload});
  const db=new DatabaseSync(file);try{db.prepare('UPDATE slice_runs SET current_json=? WHERE id=?').run(encoded,initial.runId);}finally{db.close();}
}
beforeAll(()=>{
  const seam=installControlledMoonS1Promotion();
  source=controlledMoonSource();initial=applySliceIntent(source,{type:'MOON',command:{type:'LEARN_GUIDANCE'}});
  expect(initial.moon.guidanceKnown).toBe(true);expect(initial.moon.source).not.toBeNull();
  expect(initial.cash).toBe(source.cash-100);expect(initial.actionsRemaining).toBe(source.actionsRemaining-1);
  expect(initial.random).toEqual(source.random);expect(initial.moon.journal).toEqual([]);
  for(const key of MOON_FROZEN_SOURCE_KEYS)expect(initial[key]).toEqual(source[key]);
  expected=applySliceIntent(initial,rest);expectedProjection=projectSliceState(expected);
  expect(expected.revision).toBe(initial.revision+1);expect(expected.actionsRemaining).toBe(initial.actionsRemaining-1);
  expect(expected.random).toEqual(initial.random);expect(expected.moon.journal).toHaveLength(1);
  expect(seam.substituted.length).toBeGreaterThan(0);
  expect(seam.substituted.every(draw=>draw.cursorBefore===318&&draw.cursorAfter===319&&draw.actual===57&&draw.controlled===1)).toBe(true);
  seam.restore();
},120_000);
beforeEach(()=>{installControlledMoonS1Promotion();observed.opens=0;observed.prepares=0;observed.commits=0;observed.revisions.length=0;});
afterEach(()=>{
  vi.restoreAllMocks();for(const store of stores.splice(0))store.close();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});
  observed.revisions.length=0;
});

describe('repository-owned Moon transactions from an explicitly controlled S1 continuation',()=>{
  it.each(['beforeWrite','commit'] as const)('keeps first guidance unowned across %s failure, then retries once and strictly reopens the paid source',failure=>{
    let fail=false,watch=false;
    const {file,store}=disk(()=>{
      if(watch)expect(store.repository.ownedHead(source.runId)).toBeNull();
      if(fail&&failure==='beforeWrite')throw Error('Injected initial Moon guidance beforeWrite failure');
    },source);
    const bytes=raw(file),selection=store.repository.activeRun();
    const request=envelope(`moon-guidance-${failure}`,source,{type:'MOON',command:{type:'LEARN_GUIDANCE'}});
    const requestBytes=stableStringify(request),exec=DatabaseSync.prototype.exec;
    const spy=vi.spyOn(DatabaseSync.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){
      if(watch&&sql==='COMMIT'){
        expect(store.repository.ownedHead(source.runId)).toBeNull();
        if(fail&&failure==='commit')throw Error('Injected initial Moon guidance COMMIT failure');
      }
      return exec.call(this,sql);
    });
    fail=true;watch=true;
    expect(store.submitIntent(request)).toMatchObject({ok:false,error:{code:'SAVE_FAILED'}});
    watch=false;
    expect(raw(file)).toBe(bytes);expect(store.repository.receipt(request.intentId)).toBeNull();
    expect(store.repository.activeRun()).toBe(selection);expect(store.repository.ownedHead(source.runId)).toBeNull();
    expect(stored(file).state).toEqual(source);expect(observed.prepares).toBe(0);expect(observed.commits).toBe(0);
    fail=false;watch=true;const receipt=unwrap(store.submitIntent(request));watch=false;spy.mockRestore();
    const projected=projectSliceState(initial);
    expect(receipt.state).toEqual(projected);expect(stored(file).state).toEqual(initial);
    expect(stored(file).state.random).toEqual(source.random);expect(stableStringify(request)).toBe(requestBytes);
    expect(store.repository.ownedHead(source.runId)?.revision).toBe(initial.revision);
    expect(unwrap(store.submitIntent(request))).toEqual({...receipt,replayed:true});
    const committed=raw(file);store.close();stores.splice(stores.indexOf(store),1);
    const reopened=new SqliteSliceStore(file,{now:()=>now});stores.push(reopened);
    expect(unwrap(reopened.loadRun(source.runId))).toEqual(projected);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(projected);
    expect(unwrap(reopened.submitIntent(request))).toEqual({...receipt,replayed:true});
    expect(raw(file)).toBe(committed);expect(stored(file).state).toEqual(initial);
    for(const key of MOON_FROZEN_SOURCE_KEYS)expect(stored(file).state[key]).toEqual(source[key]);
    assertUnmodifiedMoonRecoverySource();
  },60_000);

  it('publishes the new head only after durable SQLite COMMIT and does not reopen on each action',()=>{
    let watch=false;const {file,store}=disk(()=>{if(watch){expect(observed.commits).toBe(0);expect(observed.revisions.at(-1)!()).toBe(initial.revision);}});
    const opens=observed.opens,exec=DatabaseSync.prototype.exec;let commitsChecked=0;
    const spy=vi.spyOn(DatabaseSync.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){
      if(sql==='COMMIT'){expect(observed.commits).toBe(0);expect(observed.revisions.at(-1)!()).toBe(initial.revision);commitsChecked++;}
      const result=exec.call(this,sql);if(sql==='COMMIT')expect(observed.commits).toBe(0);return result;
    });
    watch=true;const receipt=unwrap(store.submitIntent(envelope()));watch=false;spy.mockRestore();
    expect(commitsChecked).toBe(1);expect(observed.opens).toBe(opens);expect(observed.commits).toBe(1);
    expect(stored(file).state).toEqual(expected);expect(receipt.state).toEqual(expectedProjection);
    expect(store.repository.ownedHead(initial.runId)?.revision).toBe(expected.revision);
    for(const key of MOON_FROZEN_SOURCE_KEYS)expect(stored(file).state[key]).toEqual(initial[key]);
  },60_000);
  it('checks duplicate, cross-run and stale-revision envelopes before preparation',()=>{
    const {file,store}=disk(),first=unwrap(store.submitIntent(envelope())),bytes=raw(file),prepares=observed.prepares;
    expect(unwrap(store.submitIntent(envelope()))).toEqual({...first,replayed:true});
    expect(store.submitIntent(envelope('moon-owned-rest',initial,{type:'MOON',command:{type:'WORK'}}))).toMatchObject({ok:false,error:{code:'DUPLICATE_INTENT_CONFLICT'}});
    expect(store.submitIntent(envelope('stale-rest'))).toMatchObject({ok:false,error:{code:'REVISION_CONFLICT'}});
    expect(store.submitIntent({...envelope('wrong-run'),runId:'different-run'})).toMatchObject({ok:false,error:{code:'RUN_NOT_FOUND'}});
    expect(observed.prepares).toBe(prepares);expect(observed.commits).toBe(1);expect(raw(file)).toBe(bytes);
  },60_000);
  it.each(['beforeWrite','receipt','commit'] as const)('rolls back %s failure and retries the exact intent once',failure=>{
    let fail=false;const {file,store}=disk(()=>{if(fail&&failure==='beforeWrite')throw Error('Injected beforeWrite failure');});
    const bytes=raw(file),selection=store.repository.activeRun();let restore:(()=>void)|undefined;
    if(failure==='receipt'){
      const put=store.repository.putReceipt.bind(store.repository),spy=vi.spyOn(store.repository,'putReceipt').mockImplementation((...args)=>{put(...args);throw Error('Injected receipt failure');});restore=()=>spy.mockRestore();
    }
    if(failure==='commit'){
      const exec=DatabaseSync.prototype.exec,spy=vi.spyOn(DatabaseSync.prototype,'exec').mockImplementation(function(this:DatabaseSync,sql:string){if(sql==='COMMIT')throw Error('Injected COMMIT failure');return exec.call(this,sql);});restore=()=>spy.mockRestore();
    }
    fail=true;expect(store.submitIntent(envelope())).toMatchObject({ok:false,error:{code:'SAVE_FAILED'}});
    expect(raw(file)).toBe(bytes);expect(store.repository.receipt('moon-owned-rest')).toBeNull();expect(store.repository.activeRun()).toBe(selection);
    expect(observed.commits).toBe(0);expect(store.repository.ownedHead(initial.runId)?.revision).toBe(initial.revision);
    fail=false;restore?.();const receipt=unwrap(store.submitIntent(envelope()));
    expect(stored(file).state).toEqual(expected);expect(unwrap(store.submitIntent(envelope()))).toEqual({...receipt,replayed:true});expect(observed.commits).toBe(1);
  },60_000);
  it('rejects copied, foreign-owner, wrong-run, stale and expired repository drafts',()=>{
    const first=disk().store,second=disk().store;let expired:OwnedRepositoryDraft;
    expect(()=>first.repository.prepareOwned(initial.runId,rest,initial.revision)).toThrow();
    first.repository.transaction(()=>{
      expect(()=>first.repository.prepareOwned('different-run',rest,initial.revision)).toThrow();
      expect(()=>first.repository.prepareOwned(initial.runId,rest,initial.revision+1)).toThrow();
      const draft=first.repository.prepareOwned(initial.runId,rest,initial.revision);expired=draft;
      expect(Object.isFrozen(draft)).toBe(true);expect(()=>first.repository.projectOwnedDraft({...draft})).toThrow();
      second.repository.transaction(()=>expect(()=>second.repository.putOwnedDraft(draft,now)).toThrow());
      first.repository.putOwnedDraft(draft,now);expect(()=>first.repository.putOwnedDraft(draft,now)).toThrow();
    });
    first.repository.transaction(()=>expect(()=>first.repository.projectOwnedDraft(expired!)).toThrow());
    expect(first.repository.ownedHead(initial.runId)?.revision).toBe(expected.revision);
    expect(second.repository.ownedHead(initial.runId)?.revision).toBe(initial.revision);
  },60_000);
  it('keeps detached session snapshots and domain drafts from conveying authority',()=>{
    const first=openMoonRuntimeSession(initial),second=openMoonRuntimeSession(initial),snapshot=first.snapshot();
    snapshot.revision++;snapshot.moon.source!.budget.cash++;expect(first.inspect().revision).toBe(initial.revision);
    const draft=first.prepare(rest,initial.revision),sibling=first.prepare(rest,initial.revision);
    expect(first.snapshotDraft(draft)).toEqual(expected);expect(first.projectDraft(draft)).toEqual(expectedProjection);
    expect(first.projectDraftMoon(draft)).toEqual(projectMoon(expected));
    const draftSnapshot=first.snapshotDraft(draft);draftSnapshot.moon.source!.budget.cash++;
    expect(first.snapshotDraft(draft)).toEqual(expected);expect(()=>second.commit(draft)).toThrow();
    expect(()=>first.commit({...draft})).toThrow();expect(()=>first.prepare(rest,initial.revision+1)).toThrow();
    first.commit(draft);expect(first.inspect().revision).toBe(expected.revision);expect(()=>first.commit(draft)).toThrow();
    expect(()=>first.commit(sibling)).toThrow();expect(()=>first.prepare({type:'PERFECTER',command:{type:'REST'}},expected.revision)).toThrow();
    expect(first.snapshot()).toEqual(expected);expect(first.project()).toEqual(expectedProjection);
    for(const field of ['source','frame','journal','engine','draft'])expect(first.projectMoon()).not.toHaveProperty(field);
  },60_000);
  it('strictly rejects checksum-valid forged source, lineage and original-partner replacements, then reopens restored bytes',()=>{
    const {file,store}=disk();
    const changes:((state:SliceState)=>void)[]=[
      state=>{state.moon.source!.budget.cash++;},
      state=>{state.moon.source!.random.cursor++;},
      state=>{state.moon.source!.originalPartner.stamina++;},
      state=>{state.beautyGoddess.bottles[3]!.recovery!.originalBottleId='beauty-goddess-potion-2';},
    ];
    for(const change of changes){
      const forged=structuredClone(initial);change(forged);replaceRaw(file,{state:forged,updatedAt:now});
      expect(()=>store.repository.ownedHead(initial.runId)).toThrow();
      replaceRaw(file,{state:initial,updatedAt:now});expect(store.repository.ownedHead(initial.runId)?.revision).toBe(initial.revision);
    }
    const receipt=unwrap(store.submitIntent(envelope()));expect(receipt.state).toEqual(expectedProjection);
  },60_000);
  it('retains all frozen Moon predecessor records and closes their actions across a real week change',()=>{
    const session=openMoonRuntimeSession(initial);
    const draft=session.prepare({type:'MOON',command:{type:'NEXT_WEEK'}},initial.revision);session.commit(draft);
    const state=session.snapshot(),projection=session.project();
    expect(state.week).toBe(initial.week+1);expect(projection.canAct).toBe(false);
    const closed=(value:unknown):void=>{
      if(!value||typeof value!=='object')return;
      if(Array.isArray(value)){value.forEach(closed);return;}
      const object=value as Record<string,unknown>;
      if(Array.isArray(object.actions))for(const action of object.actions)expect(action).toMatchObject({enabled:false,preferredAction:false});
      if('preferredActionId'in object)expect(object.preferredActionId).toBeNull();
      Object.values(object).forEach(closed);
    };
    for(const key of MOON_FROZEN_SOURCE_KEYS){expect(state[key]).toEqual(initial[key]);closed(projection[key]);}
    expect(()=>migrateSliceState(state)).not.toThrow();
    expect(()=>applySliceIntent(state,{type:'BEAUTY_GODDESS',command:{type:'LEARN_GUIDANCE'}})).toThrow();
  },60_000);
  it('reopens durable state through strict load with the same public projection and duplicate receipt',()=>{
    const {file,store}=disk(),receipt=unwrap(store.submitIntent(envelope()));store.close();stores.splice(stores.indexOf(store),1);
    const reopened=new SqliteSliceStore(file,{now:()=>now});stores.push(reopened);
    expect(unwrap(reopened.loadRun(initial.runId))).toEqual(expectedProjection);
    expect(unwrap(reopened.getBootstrap()).activeState).toEqual(expectedProjection);
    expect(unwrap(reopened.submitIntent(envelope()))).toEqual({...receipt,replayed:true});
    expect(stored(file).state).toEqual(expected);
  },60_000);
  it('uses the same transaction rollback, idempotency and current session in browser memory storage',()=>{
    const repository=new MemorySliceRepository();repository.transaction(()=>repository.put({state:initial,updatedAt:now}));
    expect(repository.ownedHead(initial.runId)?.revision).toBe(initial.revision);
    expect(()=>repository.transaction(()=>{const draft=repository.prepareOwned(initial.runId,rest,initial.revision);repository.putOwnedDraft(draft,now);throw Error('Injected memory rollback');})).toThrow();
    expect(repository.get(initial.runId)!.state).toEqual(initial);expect(repository.ownedHead(initial.runId)?.revision).toBe(initial.revision);
    const app=new SliceApplication(repository,'browser',()=> 'unused-identity',()=>now),receipt=unwrap(app.submitIntent(envelope()));
    expect(receipt.state).toEqual(expectedProjection);expect(unwrap(app.submitIntent(envelope()))).toEqual({...receipt,replayed:true});
    expect(repository.get(initial.runId)!.state).toEqual(expected);
  },60_000);
});
