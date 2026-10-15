import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='wraith-stage-natural'?JSON.parse(readFileSync('tests/fixtures/wraith-v01120/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/wraith-v01120/boundaries.json','utf8'))[name.slice(7,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Wraith real public chain',()=>{
 it('retains original S6 facts and returns from the real mirror route and willing host',()=>{
  const c=read('wraith-stage-natural'),s=c.practiced as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);
  const old=c.promoted.zombie;expect(s.zombie).toEqual(old);
  expect(s.wraith.practice).toEqual({form:'HUMAN',node:'ROOM',mirror:'COVERED',host:'SELF',flag:'TABLE',note:'HANDED_OVER'});
  expect(Object.values(s.wraith.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(projectSliceState(s).wraith.insideCase).toBe(false);
 });
 it.each(['promotion','mirror','repulsion','possession','account','close','report','combat'])('replays actual %s and full save equality',key=>{
  const b=read(`wraith-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('preserves the distinct carrier and ends any temporary target hesitation',()=>{
  const c=read('wraith-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  expect(c.combatStart.combat.encounterId).toBe('WRAITH_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(s.wraith.encounter.staggerReady).toBe(false);expect(s.wraith.practice.host).toBe('SELF');
  expect(projectSliceState(s).wraith.abilities.filter(a=>a.id.startsWith('chained.s5.')).map(a=>a.id)).toEqual(['chained.s5.reflection-step','chained.s5.spirit-possession']);
 });
 it('migrates0.111 without rewriting prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/desire-apostle-v01110/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(175);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
