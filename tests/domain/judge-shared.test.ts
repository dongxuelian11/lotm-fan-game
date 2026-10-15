import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='judge-stage-natural'?JSON.parse(readFileSync('tests/fixtures/judge-v0930/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/judge-v0930/boundaries.json','utf8'))[name.slice(6,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Judge actual shared route',()=>{
 it('preserves actual old statements and completes bounded rules without creating official identity',()=>{
  const c=read('judge-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.judge.promotionWeek).toBeGreaterThanOrEqual(s.interrogator.promotionWeek!+12);
  expect(s.judge.interrogatorActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(s.interrogator.cases).toEqual(c.guidanceStart.interrogator.cases);expect(projectSliceState(s).interrogator.acting).toBe(100);
  expect(Object.values(s.judge.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.judge.practice).toEqual({audience:'FREE',boundary:'RELEASED',token:'RETURNED',lineTestedBy:'BOTH',tokenTestedBy:'BOTH'});
  const p=projectSliceState(s).judge;expect(new Set(p.actions.map(a=>a.id)).size).toBe(p.actions.length);expect(p.abilities).toHaveLength(9);
 });
 it.each(['promotion','prepare','boundary','close','report','combat'])('replays actual %s with complete save equality',key=>{
  const b=read(`judge-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('preserves the active rule and paid ability until its actual end',()=>{
  const b=read('judge-boundary-save-boundary'),s=b.final as SliceState;
  expect(s.spirituality).toBe(b.beforeLast.spirituality-3);expect(s.judge.cases['marked-line']!.contactOpen).toBe(true);
  expect(s.judge.practice.lineTestedBy).toBe('BOTH');expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const after=applySliceIntent(s,{type:'JUDGE',command:{type:'CLOSE',caseId:'marked-line'}});
  expect(after.judge.cases['marked-line']!.contactOpen).toBe(false);expect(after.judge.practice.boundary).toBe('RELEASED');
 });
 it('keeps the independent opponent and does not bring a practice prop into combat',()=>{
  const c=read('judge-stage-natural'),s=c.final as SliceState;
  expect(s.judge.practice).toEqual(c.combatStart.judge.practice);expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.at(-1)!.consequence).toContain('埃文');expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');
 });
 it('migrates complete0.92 Corruption Baron history and original gifts without losing any fact',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/corruption-baron-v0920/natural.json','utf8')).final,current=migrateSliceState(old);
  const{judge:_,schemaVersion:__,contentVersion:___,...facts}=current;
  const{schemaVersion:____,contentVersion:_____,...prior}=old;for(const key of Object.keys(prior))expect((current as unknown as Record<string,unknown>)[key]).toEqual(prior[key]);
 });
});
