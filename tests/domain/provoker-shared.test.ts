import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,createSliceRun,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState,SliceIntent} from '../../src/domain/slice/types.js';
const capture=()=>JSON.parse(readFileSync(new URL('../fixtures/provoker-v070/natural.json',import.meta.url),'utf8'));
describe('Provoker actual playable continuity',()=>{
 it('replays every actual public command, keeping both generations of hunter skills',{ tags: ['historical-replay'] }, ()=>{const c=capture();let s=createSliceRun(c.final.runId,c.creation,c.seed);for(const intent of c.commands){s=applySliceIntent(s,intent);assertValidSliceState(s);}expect(s).toEqual(migrateSliceState(c.final));expect(s.progression.sequence).toBe(8);expect(Object.keys(s.progression.mastery)).toHaveLength(6);expect(projectSliceState(s).provoker.abilities).toHaveLength(6);expect(projectSliceState(s).hunter.acting).toBe(100);expect(projectSliceState(s).clown.abilities).toEqual([]);});
 it('preserves the actual 0.6.0 prior history while adding only the new unopened supply',()=>{const old=JSON.parse(readFileSync(new URL('../fixtures/hunter-v060/natural.json',import.meta.url),'utf8')).final;const bytes=JSON.stringify(old),next=migrateSliceState(old);const {schemaVersion,contentVersion,...previous}=old;const facts=Object.fromEntries(Object.entries(next).filter(([key])=>Object.prototype.hasOwnProperty.call(previous,key)));expect(facts).toEqual(previous);expect(next.provoker.bottles.every(b=>b.status==='SUPPLIER')).toBe(true);assertValidSliceState(next);expect(JSON.stringify(old)).toBe(bytes);expect(migrateSliceState(next)).toEqual(next);});
 it('refuses to act on unobserved personal weaknesses and keeps the rejected input intact',()=>{const s:SliceState=migrateSliceState(capture().promoted),bytes=JSON.stringify(s);expect(()=>applySliceIntent(s,{type:'PROVOKER',command:{type:'CHOOSE',caseId:'queue-boast',choice:'CHALLENGE'}})).toThrow(/观察/);expect(JSON.stringify(s)).toBe(bytes);expect(()=>applySliceIntent(s,{type:'CLOWN',command:{type:'PRACTICE',practiceId:'balance-rehearsal'}})).toThrow();});
 it('can resolve all three scenes and the dispute through ordinary peaceful choices and still digest',()=>{
  let s:SliceState=migrateSliceState(capture().promoted);
  const go=(i:SliceIntent)=>{s=applySliceIntent(s,i);assertValidSliceState(s);};
  const clear=()=>{while(s.activeEvent){const e=projectSliceState(s).activeEvent!;const id=e.id==='LIFE-BILL-01'?'PAY_PART':e.id==='DEBT-NOTICE-01'?'DECLINE':e.id==='DEBT-SETTLE-01'?'DEFER':e.id==='LIFE-CARE-01'?'DECLINE':null;if(!id)throw Error(e.id);go({type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}};
  const ordinary=()=>{clear();go({type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});clear();};
  for(const caseId of ['invoice-claim','queue-boast','yard-hound']){
   clear();go({type:'PROVOKER',command:{type:'OBSERVE',caseId}});clear();
   for(let n=0;n<50&&s.provoker.cases[caseId]!.status!=='COMPLETED';n++){
    if(s.provoker.cases[caseId]!.attemptWeek===s.week){ordinary();continue;}
    go({type:'PROVOKER',command:{type:'CHOOSE',caseId,choice:caseId==='yard-hound'?'WAIT':'DEESCALATE'}});clear();
   }
   expect(s.provoker.cases[caseId]!.status).toBe('COMPLETED');
  }
  for(let n=0;n<50&&s.provoker.encounter.status!=='RESOLVED';n++){
   if(s.provoker.encounter.attemptWeek===s.week){ordinary();continue;}
   go({type:'PROVOKER',command:{type:'ENCOUNTER_TALK'}});clear();
  }
  expect(s.provoker.encounter.startHistoryIndex).toBeNull();expect(s.progression.acting).toBe(80);
  go({type:'PROVOKER',command:{type:'REFLECT'}});expect(s.progression.acting).toBe(100);expect(s.combat).toBeNull();expect(()=>applySliceIntent(s,{type:'PROVOKER',command:{type:'REFLECT'}})).toThrow();expect(migrateSliceState(JSON.parse(JSON.stringify(s)))).toEqual(s);
 });
});
