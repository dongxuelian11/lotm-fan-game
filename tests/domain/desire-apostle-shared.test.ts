import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='desire-apostle-stage-natural'?JSON.parse(readFileSync('tests/fixtures/desire-apostle-v01110/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/desire-apostle-v01110/boundaries.json','utf8'))[name.slice(15,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Desire Apostle real public chain',()=>{
 it('retains original S6 facts and closes the finite adult rehearsal with the original records',()=>{
  const c=read('desire-apostle-stage-natural'),s=c.practiced as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);expect(s.demon).toEqual(c.guidanceStart.demon);
  expect(s.desireApostle.practice).toEqual({emotion:'CALM',seed:'SPENT',pauseObserved:true,ledger:'GUIDE',note:'HANDED_OVER'});
  expect(Object.values(s.desireApostle.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(projectSliceState(s).desireApostle.insideCase).toBe(false);
 });
 it.each(['promotion','seed','catalysis','ledger','account','close','report','combat'])('replays actual %s and full save equality',key=>{
  const b=read(`desire-apostle-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('retains independent carrier facts and clears the temporary battle seed on exit',()=>{
  const c=read('desire-apostle-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(c.combatStart.combat.encounterId).toBe('DESIRE_APOSTLE_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.desireApostle.encounter.seedPlanted).toBe(false);expect(s.desireApostle.encounter.staggerReady).toBe(false);
  expect(projectSliceState(s).desireApostle.abilities.filter(a=>a.id.startsWith('abyss.s5.')).map(a=>a.id)).toEqual(['abyss.s5.emotion-seed','abyss.s5.catalysis']);
 });
 it('migrates0.110 without rewriting prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(175);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
