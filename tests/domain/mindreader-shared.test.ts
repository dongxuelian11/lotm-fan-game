import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,createSliceRun,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const capture=()=>{const c=JSON.parse(readFileSync(new URL('../fixtures/release-legacy-output-v0177/mindreader-current-v0170.json',import.meta.url),'utf8'));for(const key of ['final','promoted','socialFinal'])if(c[key])c[key]=migrateSliceState(c[key]);return c;};
describe('Mindreader playable progression',()=>{
 it('replays actual public growth and encounter preserving S9 history',()=>{const c=capture();let s=createSliceRun(c.final.runId,c.creation,c.seed);for(const i of c.commands){s=applySliceIntent(s,i);assertValidSliceState(s);}expect(s).toEqual(c.final);expect(c.socialFinal.progression.acting).toBe(100);expect(Object.keys(s.progression.mastery)).toHaveLength(4);expect(projectSliceState(s).audience.acting).toBe(100);expect(projectSliceState(s).audience.actions).toEqual([]);expect(projectSliceState(s).mindreader.abilities).toHaveLength(4);});
 it('adds unopened materials to 0.8 while preserving every previous field',()=>{const old=JSON.parse(readFileSync(new URL('../fixtures/audience-v080/peaceful.json',import.meta.url),'utf8')).final;const bytes=JSON.stringify(old),next=migrateSliceState(old);const{schemaVersion:a,contentVersion:b,...previous}=old;for(const key of Object.keys(previous))expect((next as unknown as Record<string,unknown>)[key]).toEqual(previous[key]);assertValidSliceState(next);expect(JSON.stringify(old)).toBe(bytes);expect(next.mindreader.formulaKnown).toBe(false);expect(migrateSliceState(next)).toEqual(next);});
 it('does not read remotely or reveal an unread scene',()=>{const s:SliceState=capture().promoted,before=structuredClone(s);expect(()=>applySliceIntent(s,{type:'MINDREADER',command:{type:'READ',caseId:'lost-key'}})).toThrow(/到场/);expect(s).toEqual(before);expect(projectSliceState(s).mindreader.scenes.every(x=>x.impression.includes('尚未读到'))).toBe(true);});
 it('keeps old reading distinct from current knowledge and sealed letters unopened',()=>{const s:SliceState=capture().socialFinal,p=projectSliceState(s).mindreader;expect(p.scenes.every(x=>x.impression.includes('周留下的读取记录'))).toBe(true);expect(p.scenes.find(x=>x.id==='harbor-message')!.dialogue).toContain('私信内容和收件人的想法仍未知');expect(s.world).toEqual(capture().promoted.world);expect(()=>applySliceIntent(s,{type:'MINDREADER',command:{type:'READ',caseId:'harbor-message'}})).toThrow(/结果/);});
 it('rejects deleting actual reading reward history',()=>{const s:SliceState=capture().socialFinal;s.seer.completedSources=s.seer.completedSources.filter(x=>x!=='mindreader-reading:lost-key');expect(()=>assertValidSliceState(s)).toThrow();});
 it('keeps S9 social commands disabled after S8 promotion',()=>{const s:SliceState=capture().promoted;expect(projectSliceState(s).audience.actions).toEqual([]);expect(()=>applySliceIntent(s,{type:'AUDIENCE',command:{type:'REFLECT'}})).toThrow();});
 it('can complete the social arc by ordinary conversation without reading minds',()=>{
  let s:SliceState=capture().promoted;
  const clear=()=>{while(s.activeEvent){const id=s.activeEvent.id==='LIFE-BILL-01'?'PAY_PART':s.activeEvent.id==='DEBT-NOTICE-01'?'DECLINE':s.activeEvent.id==='DEBT-SETTLE-01'?'DEFER':null;if(!id)throw Error(s.activeEvent.id);s=applySliceIntent(s,{type:'EVENT_CHOICE',eventInstanceId:s.activeEvent.instanceId,choiceId:id});}};
  for(const caseId of ['lost-key','curtain-call','harbor-message']){clear();s=applySliceIntent(s,{type:'MINDREADER',command:{type:'OBSERVE',caseId}});clear();
   for(let n=0;n<50&&s.mindreader.cases[caseId]!.status!=='RESOLVED';n++){if(s.mindreader.cases[caseId]!.attemptWeek===s.week)s=applySliceIntent(s,{type:'ACTION',action:s.wagePaidWeek===s.week?'REST':'WORK'});else s=applySliceIntent(s,{type:'MINDREADER',command:{type:'DISCUSS',caseId,approach:'ASK'}});clear();assertValidSliceState(s);}
   expect(s.mindreader.cases[caseId]!.status).toBe('RESOLVED');
  }
  s=applySliceIntent(s,{type:'MINDREADER',command:{type:'REFLECT'}});expect(s.progression.acting).toBe(100);expect(Object.values(s.mindreader.cases).every(x=>!x.readSucceeded&&x.readWeek===null)).toBe(true);expect(s.combatHistory).toEqual([]);
 });

 it('does not leak the unread red-cord thought through an ordinary question label',()=>{let s:SliceState=capture().promoted;s=applySliceIntent(s,{type:'MINDREADER',command:{type:'OBSERVE',caseId:'lost-key'}});const p=projectSliceState(s).mindreader;expect(p.actions.filter(a=>'caseId'in a.command&&a.command.caseId==='lost-key').map(a=>a.label).join()).not.toContain('红绳');expect(p.scenes.find(x=>x.id==='lost-key')!.impression).toContain('尚未读到');});

});
