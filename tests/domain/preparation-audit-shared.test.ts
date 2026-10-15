import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createSliceRun,applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState,SliceIntent} from '../../src/domain/slice/types.js';
import {readObjectEntry} from '../helpers/read-object-entry.js';
const root='tests/fixtures/preparation-audit-v01630/';
interface Boundary{beforeLast:SliceState;lastIntent:SliceIntent;final:SliceState}
const entry=<T>(file:string,key:string)=>readObjectEntry<T>(`${root}${file}.json`,key);
describe('Finite actual preparation observations and separately versioned future wild bodies',()=>{
 for(const name of ['door','silver','silver-v2'])it(`${name}: replays all public commands with original seed and exact final`,()=>{
  const file=`${name}-natural`,final=entry<SliceState>(file,'final'),creation=entry<Parameters<typeof createSliceRun>[1]>(file,'creation'),seed=entry<string>(file,'seed'),commands=entry<SliceIntent[]>(file,'commands');
  let s=createSliceRun(final.runId,creation,seed);for(const c of commands)s=applySliceIntent(s,c);
  expect(s).toEqual(migrateSliceState(final));assertValidSliceState(s);
  expect(s.random.seed).toBe(seed);expect(entry<boolean>(file,'prefixVerified')).toBe(true);
 },60000);
 for(const name of ['door','silver','silver-v2'])it(`${name}: saved transition boundaries remain deterministic and immutable`,()=>{
  const boundaries=JSON.parse(readFileSync(`${root}${name}-boundaries.json`,'utf8')) as Record<string,Boundary>;
  for(const b of Object.values(boundaries)){
   const before=migrateSliceState(b.beforeLast),snapshot=JSON.stringify(before);assertValidSliceState(before);
   expect(applySliceIntent(before,b.lastIntent)).toEqual(migrateSliceState(b.final));expect(JSON.stringify(before)).toBe(snapshot);
  }
 },60000);
 it('Door retains one failed teaching, actual surviving retreat and both earlier source consequences',()=>{
  const teaching=entry<{sample:string;week:number;demonstration:{success:boolean};addedRecords:unknown[]}[]>('door-natural','teaching');
  expect(teaching.map(t=>[t.sample,t.demonstration.success])).toEqual([['FLASH',true],['COURAGE',true],['FLASH',false]]);
  expect(teaching[2]!.week).toBeGreaterThan(teaching[0]!.week);expect(teaching[2]!.addedRecords).toEqual([]);
  const s=entry<SliceState>('door-natural','final');expect(s).toMatchObject({status:'ACTIVE',health:30,progression:{sequence:5}});
  expect(s.secretsSorcerer.ritual.attempts.at(-1)).toMatchObject({outcome:'RETREATED',captureAttempts:0,consumedBottleId:null});
  expect(s.secretsSorcerer.bottles[0]).toMatchObject({status:'CONSUMED',outcome:'FAILURE'});expect(s.secretsSorcerer.ritual.targets[0]!.status).toBe('SEALED');
  const originalBytes=JSON.stringify(s),current=migrateSliceState(s);assertValidSliceState(current);
  for(const [key,value] of Object.entries(s))if(!['schemaVersion','contentVersion'].includes(key))expect((current as unknown as Record<string,unknown>)[key]).toEqual(value);
  const currentBytes=JSON.stringify(current);expect(projectSliceState(current).canAct).toBe(true);
  expect(JSON.stringify(s)).toBe(originalBytes);expect(JSON.stringify(current)).toBe(currentBytes);expect(migrateSliceState(current)).toEqual(current);expect(entry<{final:SliceState}>('door-natural','originalResult').final.status).toBe('DEAD');
 });
 it('Original 425-command death and new 476-command death each retain actual independent bodies and treatment',()=>{
  const old=entry<SliceState>('silver-natural','final'),s=entry<SliceState>('silver-v2-natural','final');
  expect(old.status).toBe('DEAD');expect(s.status).toBe('DEAD');expect(old.silverKnight.encounter.remains).toEqual([]);
  expect(s.silverKnight.encounter.remains.map(r=>r.speciesId)).toEqual(['EMBER_WING','MIST_ANTLER','THORN_SHADOW']);
  expect(s.silverKnight.promotionWeek).toBeNull();expect(s.silverKnight.ritual.attempts).toEqual([]);
  for(const id of ['SK3-HUNT-ROCK_HUSK-1','SK3-HUNT-ROCK_HUSK-2']){
   const body=s.silverKnight.encounter.hunts.find(h=>h.id===id)!;expect(body).toEqual(old.silverKnight.encounter.hunts.find(h=>h.id===id));expect(body).toMatchObject({status:'SURRENDERED',enemyHealth:70,remainsId:null});expect(body.huntBehaviorVersion).toBeUndefined();
  }
  const rock=s.silverKnight.encounter.hunts.find(h=>h.id==='SK3-HUNT-ROCK_HUSK-3')!;expect(rock).toMatchObject({status:'RETREATED',enemyHealth:40,huntBehaviorVersion:2,remainsId:null});
  expect(s.silverKnight.encounter.hunts.find(h=>h.speciesId==='FROST_SPINE')!.status).toBe('UNSEEN');
  const medical=entry<{treatmentCostPence:number;healedRevision:number}[]>('silver-v2-natural','medical');expect(medical).toHaveLength(3);expect(medical.every(m=>m.treatmentCostPence===60&&m.healedRevision>0)).toBe(true);
  const originalBytes=JSON.stringify(s),current=migrateSliceState(s);assertValidSliceState(current);
  for(const [key,value] of Object.entries(s))if(!['schemaVersion','contentVersion'].includes(key))expect((current as unknown as Record<string,unknown>)[key]).toEqual(value);
  const currentBytes=JSON.stringify(current);expect(projectSliceState(current).canAct).toBe(false);
  expect(JSON.stringify(s)).toBe(originalBytes);expect(JSON.stringify(current)).toBe(currentBytes);expect(migrateSliceState(current)).toEqual(current);
 });
});
