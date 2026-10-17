import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='demon-stage-natural'?JSON.parse(readFileSync('tests/fixtures/demon-v0890/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/demon-v0890/boundaries.json','utf8'))[name.slice(6,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Demon finite shared route',()=>{
 it('retains actual earlier G histories, confirmed evidence and neutral final body',()=>{
  const c=read('demon-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.demon.promotionWeek).toBeGreaterThanOrEqual(s.serialKiller.promotionWeek!+12);
  expect(s.demon.serialKillerActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.serialKiller.cases).toEqual(c.guidanceStart.serialKiller.cases);
  expect(Object.values(s.demon.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.demon.practice.body).toBe('NORMAL');expect(s.demon.practice.flame).not.toBe('LIT');
  expect(s.demon.threat).toMatchObject({verified:true,avoided:true,active:false});
  expect(new Set(projectSliceState(s).demon.actions.map(a=>a.id)).size).toBe(projectSliceState(s).demon.actions.length);
 });
 it.each(['promotion','effect','verify','compose','close','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`demon-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('requires a real verification after premonition rather than exposing a hidden plan',()=>{
  const b=read('demon-verify-save-boundary'),s=b.beforeLast as SliceState;
  expect(s.demon.threat.verified).toBe(false);expect(b.final.demon.threat.verified).toBe(true);
  expect(Object.hasOwn(projectSliceState(s).demon,'threat')).toBe(false);
  expect(()=>applySliceIntent(s,{type:'DEMON',command:{type:'REPORT',caseId:'loading-lane'}})).toThrow();
 });
 it('requires actual zero-AP closure and keeps the paid ability load',()=>{
  const b=read('demon-effect-save-boundary'),s=b.final as SliceState,caseId=b.lastIntent.command.caseId;
  expect(s.demon.strain).toBe(b.beforeLast.demon.strain+1);expect(s.demon.cases[caseId]!.contactOpen).toBe(true);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'DEMON',command:{type:'CLOSE',caseId}});
  expect(projectSliceState(after).demon.insideCase).toBe(false);expect(after.demon.practice.body).toBe('NORMAL');expect(after.demon.practice.flame).not.toBe('LIT');expect(after.demon.strain).toBe(s.demon.strain);
 });
 it('keeps old carrier facts and the real independent opponent',()=>{
  const c=read('demon-stage-natural'),s=c.final as SliceState;expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.at(-1)!.consequence).toContain('莫顿');expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');
 });
 it('migrates complete RoseBishop history without discarding originals or paid reserve',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/rose-bishop-v0880/natural.json','utf8')).final,current=migrateSliceState(old);
  const{demon:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const key of Object.keys(prior))expect((current as unknown as Record<string,unknown>)[key]).toEqual(prior[key]);
 });
});
