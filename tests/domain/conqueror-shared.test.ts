import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createConquerorState } from '../../src/domain/conqueror/index.js';
import { CONQUEROR_ABILITY_IDS } from '../../src/domain/conqueror/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/weather-warlock-v01650/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE,key);
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
const original=()=>entry<Record<string,unknown>>('final');
describe('Conqueror actual source and strict current schema',()=>{
 it('migrates the actual schema162 source without changing any existing field',()=>{
  const old=original(), bytes=stableStringify(old), s=migrateSliceState(old);
  expect([old.schemaVersion,old.contentVersion]).toEqual([162,'weather-warlock-v162']);
  expect(entry<SliceIntent[]>('commands')).toHaveLength(658);
  const defaults=createSliceRun(s.runId,entry<Parameters<typeof createSliceRun>[1]>('creation'),entry<string>('seed')) as unknown as Record<string,unknown>;
  const current=s as unknown as Record<string,unknown>, added=Object.keys(defaults).filter(k=>!Object.hasOwn(old,k));
  expect(added).toContain('conqueror');
  expect(Object.keys(current).filter(k=>!Object.hasOwn(old,k)).sort()).toEqual([...added].sort());
  for(const k of Object.keys(old))if(k!=='schemaVersion'&&k!=='contentVersion')same(current[k],old[k]);
  for(const k of added)same(current[k],defaults[k]);
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  same(s.conqueror,createConquerorState());same(migrateSliceState(s),s);
  expect(stableStringify(old)).toBe(bytes);assertValidSliceState(s);
 });
 it('retains all original21 masteries, six zeros,30 real members and the surrendered opponent',()=>{
  const old=entry<SliceState>('final'),s=migrateSliceState(old);
  expect(s).toMatchObject({status:'ACTIVE',revision:659,week:164,health:100,mind:100,spirituality:101,cash:576,actionsRemaining:2,injuryRisk:0,progression:{pathwayId:'hunter',sequence:2,acting:100}});
  expect(s.injuries).toEqual([]);same(s.progression,old.progression);same(s.character,old.character);
  expect(Object.keys(s.progression.mastery)).toHaveLength(21);expect(Object.values(s.progression.mastery).filter(v=>v===0)).toHaveLength(6);
  for(const id of CONQUEROR_ABILITY_IDS)expect(Object.hasOwn(s.progression.mastery,id)).toBe(false);
  expect(s.ironBloodKnight.team.members).toHaveLength(30);same(s.ironBloodKnight,old.ironBloodKnight);
  expect(s.ironBloodKnight.team.members.slice(0,5).map(m=>m.energy)).toEqual([5,5,5,5,6]);
  expect(s.ironBloodKnight.team.members.every(m=>!m.present&&m.location==='HOME')).toBe(true);
  same(s.weatherWarlock,old.weatherWarlock);expect(s.weatherWarlock.encounter.enemyStatus).toBe('SURRENDERED');
  same(s.combatHistory,old.combatHistory);same(s.chronicle,old.chronicle);
  expect(projectSliceState(s).maxSpirituality).toBe(120);
 });
 it('fails closed on missing current root, forged legacy root and future format',()=>{
  const old=original(),s=migrateSliceState(old),missing=structuredClone(s) as unknown as Record<string,unknown>;delete missing.conqueror;
  expect(()=>migrateSliceState(missing)).toThrow();expect(()=>assertValidSliceState(missing)).toThrow();
  const forged={...old,conqueror:createConquerorState()},before=stableStringify(forged);
  expect(()=>migrateSliceState(forged)).toThrow();expect(stableStringify(forged)).toBe(before);
  expect(()=>migrateSliceState({...s,schemaVersion:CURRENT_SCHEMA_VERSION+1})).toThrow();
  expect(()=>assertValidSliceState({...s,contentVersion:'unknown-future'})).toThrow();
 });
 it('validates exact public acquisition commands and rejects extra fields',()=>{
  expect(validateSlicePayload({type:'CONQUEROR',command:{type:'LEARN_GUIDANCE'}})).toBe(true);
  expect(validateSlicePayload({type:'CONQUEROR',command:{type:'LEARN_GUIDANCE',free:true}})).toBe(false);
  expect(validateSlicePayload({type:'CONQUEROR',command:{type:'CONSUME',bottleId:'conqueror-potion-1',confirmed:true}})).toBe(true);
  expect(validateSlicePayload({type:'CONQUEROR',command:{type:'CONSUME',bottleId:'conqueror-potion-1',confirmed:false}})).toBe(false);
 });
});
