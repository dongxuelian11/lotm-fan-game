import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
const captureFixturePaths: Record<string, string> = {
  "conspirator-stage-natural": "tests/fixtures/conspirator-v0740/natural.json",
};
const read=(name:string)=>JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8'));
describe('conspirator actual shared route',()=>{
 it('retains original Hunter progression, actual S6 consumption and three different completed reports',()=>{
  const c=read('conspirator-stage-natural'),s=migrateSliceState(c.final);assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.conspirator.promotionWeek).toBeGreaterThanOrEqual(s.pyromaniac.promotionWeek!+12);
  expect(s.conspirator.pyromaniacActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.conspirator.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(projectSliceState(s).maxSpirituality).toBe(80);
  expect(s.conspirator.cases['rejected-detour']!.revised).toBe(true);
 });
 it.each(['promotion','refusal','open','close','report','combat'])('replays %s with original seed and full serialized state',key=>{
  const b=read(`conspirator-${key}-save-boundary`),after=applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent);
  expect(after).toEqual(migrateSliceState(b.final));assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps actual refusal and cost without drawing a success roll, then requires next week for revision',()=>{
  const b=read('conspirator-refusal-save-boundary');
  expect(b.final.random).toEqual(b.beforeLast.random);expect(b.final.spirituality).toBe(b.beforeLast.spirituality-3);
  expect(b.final.conspirator.cases['rejected-detour']).toMatchObject({status:'OBSERVED',contactOpen:true,revised:false});
  const closed=applySliceIntent(migrateSliceState(b.final),{type:'CONSPIRATOR',command:{type:'CLOSE',caseId:'rejected-detour'}});
  expect(closed.conspirator.cases['rejected-detour']!.notes).toEqual(b.final.conspirator.cases['rejected-detour'].notes);
  if(closed.week===b.final.week&&!closed.activeEvent)expect(()=>applySliceIntent(closed,{type:'CONSPIRATOR',command:{type:'PREPARE',caseId:'rejected-detour',method:'ABILITY'}})).toThrow();
 });
 it('settles actual original Oren without stealing his tool or changing former carrier history',()=>{
  const c=read('conspirator-stage-natural');expect(c.final.conspirator.encounter.status).not.toBe('FIGHTING');expect(c.final.combat).toBeNull();
  expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);
  expect(c.final.progression.acting).toBe(c.practiced.progression.acting);
 });
 it('migrates entire prior Faceless save including persistent appearance with existing fields unchanged',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/faceless-v0730/natural.json','utf8')).final;
  const bytes=JSON.stringify(old),current=migrateSliceState(old);expect(current.conspirator.promotionWeek).toBeNull();
  const{schemaVersion,contentVersion,...prior}=old;
  const facts=Object.fromEntries(Object.entries(current).filter(([key])=>Object.prototype.hasOwnProperty.call(prior,key)));expect(facts).toEqual(prior);
  assertValidSliceState(current);expect(JSON.stringify(old)).toBe(bytes);expect(migrateSliceState(current)).toEqual(current);
 });
});
