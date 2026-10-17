import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, applySliceIntent, projectSliceState } from '../../src/domain/slice/index.js';
import { createRedPriestSource, redPriestSourceBlock, validateRedPriestSource, RED_PRIEST_FROZEN_SOURCE_KEYS } from '../../src/domain/red-priest/source.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import type { SliceState } from '../../src/domain/slice/types.js';
const file='tests/fixtures/conqueror-v01870/natural.json';
const source=()=>migrateSliceState(readObjectEntry<unknown>(file,'final'));
const bytes=(v:unknown)=>stableStringify(v);
describe('Red Priest actual Conqueror inheritance',()=>{
 it('retains the actual 795-command living endpoint and all old zero masteries',()=>{
  const raw=readObjectEntry<SliceState>(file,'final'),s=source();
  expect(readObjectEntry<unknown[]>(file,'commands')).toHaveLength(795);
  expect(s).toMatchObject({revision:796,week:200,health:80,mind:100,spirituality:120,cash:536,actionsRemaining:3,status:'ACTIVE',date:{epoch:'FIFTH_EPOCH',year:1353,month:4,day:21},progression:{pathwayId:'hunter',sequence:1,acting:100}});
  expect(Object.keys(s.progression.mastery)).toHaveLength(23);
  expect(Object.values(s.progression.mastery).filter(x=>x===0)).toHaveLength(6);
  expect(s.injuries.map(x=>x.severity)).toEqual(['LIGHT','LIGHT']);
  for(const key of RED_PRIEST_FROZEN_SOURCE_KEYS)expect(bytes(s[key])).toBe(bytes(raw[key]));
  expect(bytes(s.progression)).toBe(bytes(raw.progression));
  expect(s.ironBloodKnight.team.members).toHaveLength(30);
  expect(s.ironBloodKnight.team.members.every(x=>x.location==='HOME'&&!x.present)).toBe(true);
  expect(s.ironBloodKnight.team.members.slice(0,5).map(x=>x.energy)).toEqual([7,7,7,7,8]);
  expect(redPriestSourceBlock(s)).toBeNull();
  assertValidSliceState(s);
 });
 it('seals three consumed originals, including both real failures, without issuing material',()=>{
  const s=source(),before=bytes(s),origin=createRedPriestSource(s);
  expect(origin.acquisition.bottles.map(x=>[x.id,x.status,x.outcome])).toEqual([
   ['conqueror-potion-1','CONSUMED','FAILURE'],['conqueror-potion-2','CONSUMED','FAILURE'],['conqueror-potion-3','CONSUMED','SUCCESS'],
  ]);
  expect(validateRedPriestSource(s,origin)).toBe(true);
  expect(s.redPriest.materials).toBeNull();expect(bytes(s)).toBe(before);
  const forged=structuredClone(origin);forged.budget.cash++;
  expect(validateRedPriestSource(s,forged)).toBe(false);
 });
 it('only the new public chapter can advance after the actual handoff',()=>{
  const s=source(),old=bytes(s),next=applySliceIntent(s,{type:'RED_PRIEST',command:{type:'LEARN_GUIDANCE'}});
  expect(bytes(s)).toBe(old);expect(next.revision).toBe(s.revision+1);
  expect(next.redPriest.guidanceKnown).toBe(true);
  for(const key of RED_PRIEST_FROZEN_SOURCE_KEYS)expect(bytes(next[key])).toBe(bytes(s[key]));
  expect(()=>applySliceIntent(next,{type:'CONQUEROR',command:{type:'LEARN_GUIDANCE'}})).toThrow();
  const view=projectSliceState(next);expect(view.redPriest.guidanceKnown).toBe(true);expect(view.canAct).toBe(false);
  expect(view.conqueror.actions.every(x=>!x.enabled)).toBe(true);
  for(const ability of view.redPriest.abilities)if(Object.hasOwn(s.progression.mastery,ability.id))expect(ability.mastery).toBe(s.progression.mastery[ability.id]);
  expect(view.redPriest.abilities.some(x=>x.id.startsWith('hunter.s0.'))).toBe(false);
  assertValidSliceState(next);
 });
 it('rejects a changed original ally, source RNG, and a fourth characteristic',()=>{
  const s=source(),origin=createRedPriestSource(s),changed=structuredClone(s);
  changed.ironBloodKnight.team.members[0]!.energy++;
  expect(validateRedPriestSource(changed,origin)).toBe(false);
  const badRandom=structuredClone(origin);badRandom.random.cursor++;
  expect(validateRedPriestSource(s,badRandom)).toBe(false);
  const extra=structuredClone(s);extra.conqueror.bottles.push({...extra.conqueror.bottles[2]!,id:'conqueror-potion-4'});
  expect(redPriestSourceBlock(extra)).not.toBeNull();
  expect(()=>createRedPriestSource(extra)).toThrow();
 });
});
