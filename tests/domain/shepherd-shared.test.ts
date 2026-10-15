import { CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applySliceIntent,assertValidSliceState,projectSliceState} from '../../src/domain/slice/index.js';
import {migrateSliceState} from '../../src/domain/slice/migration.js';
import type {SliceState} from '../../src/domain/slice/types.js';
const read=(name:string)=>{const value=name==='shepherd-stage-natural'?JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/natural.json','utf8')):JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/boundaries.json','utf8'))[name.slice(9,-'-save-boundary'.length)];for(const key of Object.keys(value))if(value[key]?.schemaVersion)value[key]=migrateSliceState(value[key]);return value;};
describe('Shepherd real public chain',()=>{
 it('retains original S6 resources and obtains only the two actual bounded original souls',()=>{
  const c=read('shepherd-stage-natural'),s=c.practiced as SliceState;assertValidSliceState(s);
  expect(s.progression.sequence).toBe(5);expect(s.progression.acting).toBe(100);expect(s.roseBishop).toEqual(c.guidanceStart.roseBishop);
  expect(s.shepherd.practice).toEqual({paper:'TABLE',chorusOpen:false,note:'HANDED_OVER',playerNode:'DESK'});
  expect(s.shepherd.grazing.spirits.map(x=>[x.id,x.status,x.selectedAbilities])).toEqual([['SH5-IRIS-1','GRAZED',['light-touch','brief-ward','blur-mark']],['SH5-CEDRIC-1','GRAZED',['courage-song']]]);
  expect(Object.values(s.shepherd.cases).every(r=>r.status==='RESOLVED'&&!r.contactOpen)).toBe(true);
  expect(projectSliceState(s).shepherd.grazing?.capacity).toBe(7);expect(s.shepherd.grazing.spirits).toHaveLength(2);
 });
 it.each(['promotion','graze-iris','graze-cedric','activate','release','paper','chorus','account','close','combat'])('replays actual %s and full save equality',key=>{
  const b=read(`shepherd-${key}-save-boundary`),after=applySliceIntent(b.beforeLast,b.lastIntent);expect(after).toEqual(b.final);assertValidSliceState(after);expect(migrateSliceState(JSON.parse(JSON.stringify(after)))).toEqual(after);
 });
 it('preserves irreversible release, same round selection and independent carrier facts',()=>{
  const c=read('shepherd-stage-natural'),s=c.final as SliceState;assertValidSliceState(s);
  const soul=s.shepherd.grazing.spirits.find(x=>x.id==='SH5-CEDRIC-1')!;expect(soul.status).toBe('RELEASED');expect(soul.selectedAbilities).toEqual(['courage-song']);expect(s.shepherd.grazing.activeSpiritId).toBe('SH5-IRIS-1');
  expect(c.combatStart.combat.encounterId).toBe('SHEPHERD_DISPUTE');expect(s.world.carrierAlive).toBe(c.combatStart.world.carrierAlive);
  expect(()=>applySliceIntent(s,{type:'SHEPHERD',command:{type:'ACTIVATE_SPIRIT',spiritId:soul.id}})).toThrow();
  expect(projectSliceState(s).shepherd.abilities.filter(a=>a.id.startsWith('hanged-man.s5.')).map(a=>a.id)).toEqual(['hanged-man.s5.grazing','hanged-man.s5.borrowed-arts']);
 });
 it('rejects wrong-route or released round selection without modifying the input',()=>{
  const c=read('shepherd-stage-natural'),s=c.combatStart as SliceState,before=structuredClone(s);
  expect(()=>applySliceIntent(s,{type:'COMBAT_ROUND',stance:'CONTROL',shepherdSpiritId:'SH5-CEDRIC-1'})).toThrow();expect(s).toEqual(before);
 });
 it('migrates0.109 without rewriting any prior original facts',()=>{
  const old=JSON.parse(readFileSync('tests/fixtures/star-mystic-v01090/natural.json','utf8')).final,after=migrateSliceState(old);assertValidSliceState(after);expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  for(const key of Object.keys(old))if(!['schemaVersion','contentVersion'].includes(key))expect((after as unknown as Record<string,unknown>)[key]).toEqual(old[key]);expect(migrateSliceState(after)).toEqual(after);
 });
});
