import { readObjectEntry } from '../helpers/read-object-entry.js';
/** Genuine CE capture -> paid guidance -> private Perfecter session. Fault
 * injection observes repository publication; it never supplies domain authority. */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
import { openPerfecterRuntimeSession } from '../../src/domain/perfecter/owned-session.js';
import { PERFECTER_FROZEN_SOURCE_KEYS } from '../../src/domain/perfecter/source.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceEnvelope, SliceResult } from '../../src/shared/slice-contracts.js';

const observed=vi.hoisted(()=>({opens:0,prepares:0,commits:0,revisions:[] as (()=>number)[]}));
vi.mock('../../src/domain/perfecter/owned-session.js',async importOriginal=>{
  const actual=await importOriginal<typeof import('../../src/domain/perfecter/owned-session.js')>();
  return {...actual,openPerfecterRuntimeSession:(input:unknown)=>{
    const session=actual.openPerfecterRuntimeSession(input);observed.opens++;observed.revisions.push(()=>session.inspect().revision);
    return Object.freeze({...session,
      prepare:(...args:Parameters<typeof session.prepare>)=>{observed.prepares++;return session.prepare(...args);},
      commit:(...args:Parameters<typeof session.commit>)=>{session.commit(...args);observed.commits++;},
    });
  }};
});
const now='2026-10-17T14:00:00.000Z';
const rest:SliceIntent={type:'PERFECTER',command:{type:'REST'}};
let initial:SliceState,expected:SliceState,expectedProjection:SliceProjection;
const dirs:string[]=[],stores:SqliteSliceStore[]=[];
function unwrap<T>(value:SliceResult<T>):T{if(!value.ok)throw Error(value.error.message);return value.value;}
function envelope(id='perfecter-owned-rest',state=initial,payload=rest):SliceEnvelope{return {intentId:id,runId:state.runId,expectedRevision:state.revision,payload:structuredClone(payload)};}
function disk(beforeWrite?:()=>void){
  const dir=mkdtempSync(join(tmpdir(),'lotm-perfecter-owned-'));dirs.push(dir);const file=join(dir,'save.sqlite');
  const store=new SqliteSliceStore(file,{now:()=>now,...(beforeWrite?{beforeWrite}:{})});stores.push(store);
  store.repository.transaction(()=>{store.repository.put({state:initial,updatedAt:now});store.repository.selectRun('previous-selected-slot');});
  expect(store.repository.ownedHead(initial.runId)?.revision).toBe(initial.revision);return {file,store};
}
function raw(file:string):string{const db=new DatabaseSync(file,{readOnly:true});try{return String(db.prepare('SELECT current_json FROM slice_runs WHERE id=?').get(initial.runId)!.current_json);}finally{db.close();}}
function stored(file:string):StoredSlice{return JSON.parse(JSON.parse(raw(file)).payload) as StoredSlice;}
function replaceRaw(file:string,value:StoredSlice):void{
  const payload=stableStringify(value),encoded=JSON.stringify({format:1,checksum:createHash('sha256').update(payload).digest('hex'),payload});
  const db=new DatabaseSync(file);try{db.prepare('UPDATE slice_runs SET current_json=? WHERE id=?').run(encoded,initial.runId);}finally{db.close();}
}
beforeAll(()=>{
  const bytes=readFileSync('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','utf8');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('70b8843550d5a79abd5250377184ab5050a80cc1b7138f2a03ead788fb3bb8ef');
  const legacy=readObjectEntry<SliceState>('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','final');
  expect([legacy.schemaVersion,legacy.contentVersion,legacy.revision,legacy.week,legacy.health,legacy.mind,legacy.spirituality,legacy.cash,legacy.actionsRemaining]).toEqual([186,'civilization-enlightener-v186',798,188,60,98,120,436,3]);
  const source=migrateSliceState(legacy);initial=applySliceIntent(source,{type:'PERFECTER',command:{type:'LEARN_GUIDANCE'}});
  expect(initial.perfecter.guidanceKnown).toBe(true);expect(initial.perfecter.source).not.toBeNull();
  for(const key of PERFECTER_FROZEN_SOURCE_KEYS)expect(initial[key]).toEqual(source[key]);
  expected=applySliceIntent(initial,rest);expectedProjection=projectSliceState(expected);
  expect(expected.revision).toBe(initial.revision+1);expect(expected.actionsRemaining).toBe(initial.actionsRemaining-1);
  expect(expected.random).toEqual(initial.random);expect(expected.perfecter.journal).toHaveLength(1);
},60_000);
beforeEach(()=>{observed.opens=0;observed.prepares=0;observed.commits=0;observed.revisions.length=0;});
afterEach(()=>{
  vi.restoreAllMocks();for(const store of stores.splice(0))store.close();for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});
  observed.revisions.length=0;
});

describe('repository-owned Perfecter transactions',()=>{
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
    for(const key of PERFECTER_FROZEN_SOURCE_KEYS)expect(stored(file).state[key]).toEqual(initial[key]);
  },60_000);
  it('checks duplicate, cross-run and stale-revision envelopes before preparation',()=>{
    const {file,store}=disk(),first=unwrap(store.submitIntent(envelope())),bytes=raw(file),prepares=observed.prepares;
    expect(unwrap(store.submitIntent(envelope()))).toEqual({...first,replayed:true});
    expect(store.submitIntent(envelope('perfecter-owned-rest',initial,{type:'PERFECTER',command:{type:'WORK'}}))).toMatchObject({ok:false,error:{code:'DUPLICATE_INTENT_CONFLICT'}});
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
    expect(raw(file)).toBe(bytes);expect(store.repository.receipt('perfecter-owned-rest')).toBeNull();expect(store.repository.activeRun()).toBe(selection);
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
    const first=openPerfecterRuntimeSession(initial),second=openPerfecterRuntimeSession(initial),snapshot=first.snapshot();
    snapshot.revision++;snapshot.perfecter.source!.budget.cash++;expect(first.inspect().revision).toBe(initial.revision);
    const draft=first.prepare(rest,initial.revision);expect(()=>second.commit(draft)).toThrow();
    expect(()=>first.commit({...draft})).toThrow();expect(()=>first.prepare(rest,initial.revision+1)).toThrow();
    first.commit(draft);expect(first.inspect().revision).toBe(expected.revision);expect(()=>first.commit(draft)).toThrow();
  },60_000);
  it('strictly rejects a checksum-valid forged source replacement, then reopens restored bytes',()=>{
    const {file,store}=disk(),forged=structuredClone(initial);forged.perfecter.source!.budget.cash++;
    replaceRaw(file,{state:forged,updatedAt:now});expect(()=>store.repository.ownedHead(initial.runId)).toThrow();
    replaceRaw(file,{state:initial,updatedAt:now});expect(store.repository.ownedHead(initial.runId)?.revision).toBe(initial.revision);
    const receipt=unwrap(store.submitIntent(envelope()));expect(receipt.state).toEqual(expectedProjection);
  },60_000);
  it('retains all frozen Paragon records and closes their actions across a real week change',()=>{
    const session=openPerfecterRuntimeSession(initial);
    const draft=session.prepare({type:'PERFECTER',command:{type:'NEXT_WEEK'}},initial.revision);session.commit(draft);
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
    for(const key of PERFECTER_FROZEN_SOURCE_KEYS){expect(state[key]).toEqual(initial[key]);closed(projection[key]);}
    expect(()=>migrateSliceState(state)).not.toThrow();
    expect(()=>applySliceIntent(state,{type:'CIVILIZATION_ENLIGHTENER',command:{type:'LEARN_GUIDANCE'}})).toThrow();
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
