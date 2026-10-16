import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const captureFixturePaths: Record<string, string> = {
  "hypnotist-stage-natural": "tests/fixtures/hypnotist-v0750/natural.json",
};
const read=(name:string)=>JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8'));
describe('hypnotist actual shared route',()=>{
 it('retains original Audience progression, actual S6 consumption and three different completed reports',()=>{
  const c=read('hypnotist-stage-natural'),s=migrateSliceState(c.final);assertValidSliceState(s);
  expect(s.progression.sequence).toBe(6);expect(s.hypnotist.promotionWeek).toBeGreaterThanOrEqual(s.psychologist.promotionWeek!+12);
  expect(s.hypnotist.psychologistActingAtPromotion).toBe(100);expect(s.progression.acting).toBe(100);
  expect(Object.values(s.hypnotist.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(projectSliceState(s).maxSpirituality).toBe(80);
  expect(s.hypnotist.cases['protected-choice']!.revised).toBe(true);
 });
 it.each(['promotion','refusal','open','close','report','combat'])('replays %s with original seed and full serialized state',key=>{
  const b=read(`hypnotist-${key}-save-boundary`),after=applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent);
  expect(after).toEqual(migrateSliceState(b.final));assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('keeps actual refusal and cost without drawing a success roll, then requires next week for revision',()=>{
  const b=read('hypnotist-refusal-save-boundary');
  expect(b.final.random).toEqual(b.beforeLast.random);expect(b.final.spirituality).toBe(b.beforeLast.spirituality-3);
  expect(b.final.hypnotist.cases['protected-choice']).toMatchObject({status:'OBSERVED',contactOpen:true,revised:false});
  const closed=applySliceIntent(migrateSliceState(b.final),{type:'HYPNOTIST',command:{type:'CLOSE',caseId:'protected-choice'}});
  expect(closed.hypnotist.cases['protected-choice']!.notes).toEqual(b.final.hypnotist.cases['protected-choice'].notes);
  if(closed.week===b.final.week&&!closed.activeEvent)expect(()=>applySliceIntent(closed,{type:'HYPNOTIST',command:{type:'PREPARE',caseId:'protected-choice',method:'ABILITY'}})).toThrow();
 });
 it('settles actual original Rowan without stealing his tool or changing former carrier history',()=>{
  const c=read('hypnotist-stage-natural');expect(c.final.hypnotist.encounter.status).not.toBe('FIGHTING');expect(c.final.combat).toBeNull();
  expect(c.final.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);expect(c.final.town.clubLocation).toBe(c.combatStart.town.clubLocation);
  expect(c.final.progression.acting).toBe(c.practiced.progression.acting);
 });
 it('migrates entire prior Conspirator save including original refusals with existing fields unchanged',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/conspirator-v0740/natural.json','utf8')).final;
  const current=migrateSliceState(old);expect(current.hypnotist.promotionWeek).toBeNull();
  const original=JSON.stringify(old);for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((current as unknown as Record<string,unknown>)[key]).toEqual(old[key]);assertValidSliceState(current);expect(migrateSliceState(current)).toEqual(current);expect(JSON.stringify(old)).toBe(original);
 });
});
