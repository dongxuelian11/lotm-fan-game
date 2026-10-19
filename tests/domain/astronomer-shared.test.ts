import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';

const currentCapture=(capture:any)=>{for(const key of Object.keys(capture)){const value=capture[key];if(value&&typeof value==='object'&&Number.isInteger(value.schemaVersion))capture[key]=migrateSliceState(value);}return capture;};
const expectPriorFields=(next:any,old:any)=>{for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect(next[key]).toEqual(old[key]);};
const captureFixturePaths: Record<string, string> = {
  "astronomer-stage-natural": "tests/fixtures/astronomer-v0980/natural.json",
};
const read=(name:string)=>currentCapture(JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8')));
describe('Astronomer actual shared route',()=>{
 it('keeps all old Paragon facts including the original lamp with its client',()=>{
  const c=read('astronomer-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.astronomer.artisanActingAtPromotion).toBe(100);
  expect(s.astronomer.promotionWeek).toBeGreaterThanOrEqual(s.artisan.promotionWeek!+12);
  for(const key of ['savant','archaeologist','appraiser','artisan'] as const)expect(s[key]).toEqual(c.guidanceStart[key]);
  expect(s.artisan.workshop.lamp?.location).toBe('CLIENT');expect(projectSliceState(s).artisan.acting).toBe(100);expect(c.practiced.progression.acting).toBe(100);
  const oldIds=Object.keys(c.guidanceStart.progression.mastery),newIds=Object.keys(s.progression.mastery).filter(k=>!oldIds.includes(k));
  expect(newIds).toEqual(['paragon.s5.precision-focus']);expect(projectSliceState(s).astronomer.abilities).toHaveLength(oldIds.length+1);
  expect(Object.values(s.astronomer.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(s.astronomer.practice.instrumentOffset).toBe(0);expect(s.astronomer.practice.measurements).toBe(1);
  expect(s.astronomer.practice.observedWeek).toBeGreaterThan(s.astronomer.practice.calibratedWeek!);
 });
 it.each(['promotion','prepare','effect','close','report','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`astronomer-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);
  expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps current contact until a real zero-cost close',()=>{
  const b=read('astronomer-effect-save-boundary'),s=b.final as SliceState;
  expect(projectSliceState(s).astronomer.insideCase).toBe(true);expect(()=>applySliceIntent(s,{type:'ACTION',action:'REST'})).toThrow();
  const after=applySliceIntent(s,{type:'ASTRONOMER',command:{type:'CLOSE',caseId:'catalogue-check'}});
  expect(after.astronomer.cases['catalogue-check']!.contactOpen).toBe(false);expect(after.astronomer.cases['catalogue-check']!.closes).toBe(1);assertValidSliceState(after);
 });
 it('keeps its actual opponent separate from the old first-case carrier',()=>{
  const c=read('astronomer-stage-natural'),s=c.final as SliceState;
  expect(c.combatStart.combat.encounterId).toBe('ASTRONOMER_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.combatHistory.length).toBeGreaterThan(c.practiced.combatHistory.length);expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');assertValidSliceState(s);
 });
 it('migrates prior0.97 original dreams, body locations and feather unchanged',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/dreamwalker-v0970/natural.json','utf8')).final,current=migrateSliceState(old);
  expectPriorFields(current,old);
 });
});
