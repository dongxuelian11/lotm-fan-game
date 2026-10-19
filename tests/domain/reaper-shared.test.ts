import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
const captureFixturePaths: Record<string, string> = {
  "reaper-stage-natural": "tests/fixtures/reaper-v0960/natural.json",
};
const read=(name:string)=>JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8'));
describe('Reaper actual shared route',()=>{
 it('keeps all old Hunter facts and adds only two S5 abilities after actual maturity',()=>{
  const c=read('reaper-stage-natural'),s=migrateSliceState(c.final);assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.reaper.conspiratorActingAtPromotion).toBe(100);
  expect(s.reaper.promotionWeek).toBeGreaterThanOrEqual(s.conspirator.promotionWeek!+12);
  expect(s.hunter).toEqual(c.guidanceStart.hunter);expect(s.provoker).toEqual(c.guidanceStart.provoker);
  expect(s.pyromaniac).toEqual(c.guidanceStart.pyromaniac);expect(s.conspirator).toEqual(c.guidanceStart.conspirator);
  expect(projectSliceState(s).conspirator.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['hunter.s5.weakness-observation','hunter.s5.precision-strike']);
  expect(projectSliceState(s).reaper.abilities).toHaveLength(oldIds.length+2);
  expect(Object.values(s.reaper.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen&&!r.practice.windowOpen)).toBe(true);
 });
 it.each(['promotion','prepare','signal','effect','close','report','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`reaper-${key}-save-boundary`),after=applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent);
  expect(after).toEqual(migrateSliceState(b.final));assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('requires the current actual shutter window and cannot keep it across ordinary life',()=>{
  const b=read('reaper-signal-save-boundary'),s=migrateSliceState(b.final),r=s.reaper.cases['moving-shutter']!;
  expect(r.practice.windowOpen).toBe(true);expect(projectSliceState(s).reaper.insideCase).toBe(true);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();
  const after=applySliceIntent(s,{type:'REAPER',command:{type:'WITHDRAW',caseId:'moving-shutter'}});
  expect(after.reaper.cases['moving-shutter']!.practice.windowOpen).toBe(false);
  expect(after.reaper.cases['moving-shutter']!.withdrawals).toBe(r.withdrawals+1);
  expect(after.spirituality).toBe(s.spirituality);assertValidSliceState(after);
 });
 it('keeps the independent enemy, original carrier history and honest real terminal outcome',()=>{
  const c=read('reaper-stage-natural'),s=migrateSliceState(c.final);
  expect(c.combatStart.combat.encounterId).toBe('REAPER_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.length).toBeGreaterThan(c.practiced.combatHistory.length);expect(s.reaper.encounter.weakness.available).toBe(false);
  expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');assertValidSliceState(s);
 });
 it('migrates all 0.95 facts including the original irreversible death unchanged',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/marionettist-v0950/natural.json','utf8')).final,bytes=JSON.stringify(old),current=migrateSliceState(old);
  const{schemaVersion,contentVersion,...prior}=old;
  const facts=Object.fromEntries(Object.entries(current).filter(([key])=>Object.prototype.hasOwnProperty.call(prior,key)));expect(facts).toEqual(prior);
  assertValidSliceState(current);expect(JSON.stringify(old)).toBe(bytes);expect(migrateSliceState(current)).toEqual(current);
 });
});
