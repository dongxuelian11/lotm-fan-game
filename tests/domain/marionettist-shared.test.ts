import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const captureFixturePaths: Record<string, string> = {
  "marionettist-stage-natural": "tests/fixtures/marionettist-v0950/natural.json",
};
const read=(name:string)=>JSON.parse(readFileSync(captureFixturePaths[name] ?? `tests/fixtures/release-legacy-output-v0177/${name}.json`,'utf8'));
describe('Marionettist actual shared route',()=>{
 it('keeps all original Faceless history and performs the real appointed song before promotion',()=>{
  const c=read('marionettist-stage-natural'),s=migrateSliceState(c.final);assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.marionettist.facelessActingAtPromotion).toBe(100);
  expect(s.marionettist.promotionWeek).toBeGreaterThanOrEqual(s.faceless.promotionWeek!+12);
  expect(s.faceless).toEqual(c.guidanceStart.faceless);expect(projectSliceState(s).faceless.acting).toBe(100);
  expect(s.marionettist.ritual.visits).toBeGreaterThan(0);expect(s.marionettist.ritual.history.every(h=>h.visitWeek>h.requestedWeek&&h.returned)).toBe(true);
  expect(s.marionettist.ritual.location).toBe('CLUB');expect(s.marionettist.ritual.singing).toBe(false);
  expect(s.marionettist.bottles.filter(b=>b.status==='CONSUMED').every(b=>b.ritualVisit!==null)).toBe(true);
  expect(Object.values(s.marionettist.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen&&!r.initialControl)).toBe(true);
  expect(c.practiced.marionettist.puppet.target).toBeNull();expect(c.practiced.progression.acting).toBe(100);
  const p=projectSliceState(s).marionettist;expect(p.abilities).toHaveLength(23);expect(new Set(p.actions.map(a=>a.id)).size).toBe(p.actions.length);
 });
 it.each(['ritual','song','promotion','return','prepare','close','report','combat'])('replays actual %s with full save equality',key=>{
  const b=read(`marionettist-${key}-save-boundary`),after=applySliceIntent(migrateSliceState(b.beforeLast),b.lastIntent);
  expect(after).toEqual(migrateSliceState(b.final));assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('always allows actual return and stops the present song without restoring the consumed bottle',()=>{
  const b=read('marionettist-promotion-save-boundary'),s=migrateSliceState(b.final);
  expect(s.world.city).toBe('ELSEWHERE');expect(s.marionettist.ritual.singing).toBe(true);
  expect(()=>applySliceIntent(s,{type:'ACTION',action:'WORK'})).toThrow();
  const a=applySliceIntent(s,{type:'MARIONETTIST',command:{type:'RETURN_CLUB'}});
  expect(a.world.city).toBe('BACKLUND');expect(a.marionettist.ritual.singing).toBe(false);
  expect(a.marionettist.bottles).toEqual(s.marionettist.bottles);
 });
 it('keeps the independent opponent, original club and irreversible actual outcome',()=>{
  const c=read('marionettist-stage-natural'),s=c.final as SliceState,t=s.marionettist.puppet.target;
  expect(c.combatStart.combat.encounterId).toBe('MARIONETTIST_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(t?.id).toBe('MM5-DORN');expect(t?.club.id).toBe('MM5-DORN-CLUB');expect(t?.club.ownerId).toBe('MM5-DORN');
  expect(t?.health).toBe(c.fought.marionettist.puppet.target.health);expect(t?.injuries).toEqual(c.fought.marionettist.puppet.target.injuries);
  expect(s.combatHistory.at(-1)!.consequence).not.toContain('携铃者');
 });
 it('migrates complete 0.94 history without changing any existing fact',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/biologist-v0940/natural.json','utf8')).final,bytes=JSON.stringify(old),current=migrateSliceState(old);
  const{schemaVersion,contentVersion,...prior}=old;
  const facts=Object.fromEntries(Object.entries(current).filter(([key])=>Object.prototype.hasOwnProperty.call(prior,key)));expect(facts).toEqual(prior);
  assertValidSliceState(current);expect(JSON.stringify(old)).toBe(bytes);expect(migrateSliceState(current)).toEqual(current);
 });
});
