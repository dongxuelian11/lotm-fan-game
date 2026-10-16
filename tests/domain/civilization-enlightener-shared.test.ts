import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createCivilizationEnlightenerState } from '../../src/domain/civilization-enlightener/index.js';
import { CIVILIZATION_ENLIGHTENER_ABILITY_IDS } from '../../src/domain/civilization-enlightener/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/knowledge-mentor-v01670/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE,key);
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
const original=()=>entry<Record<string,unknown>>('final');
describe('CivilizationEnlightener actual source and strict current schema',()=>{
 it('migrates the actual schema164 source without changing any existing field',()=>{
  const old=original(), bytes=stableStringify(old), s=migrateSliceState(old);
  expect([old.schemaVersion,old.contentVersion]).toEqual([164,'knowledge-mentor-v164']);
  expect(entry<SliceIntent[]>('commands')).toHaveLength(691);
  const defaults=createSliceRun(s.runId,entry<Parameters<typeof createSliceRun>[1]>('creation'),entry<string>('seed')) as unknown as Record<string,unknown>;
  const current=s as unknown as Record<string,unknown>, added=Object.keys(defaults).filter(k=>!Object.hasOwn(old,k));
  expect(added).toContain('civilizationEnlightener');
  expect(Object.keys(current).filter(k=>!Object.hasOwn(old,k)).sort()).toEqual([...added].sort());
  for(const k of Object.keys(old))if(k!=='schemaVersion'&&k!=='contentVersion')same(current[k],old[k]);
  for(const k of added)same(current[k],defaults[k]);
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  same(s.civilizationEnlightener,createCivilizationEnlightenerState());same(migrateSliceState(s),s);
  expect(stableStringify(old)).toBe(bytes);assertValidSliceState(s);
 });
 it('retains all original19 masteries, seven zeros and the original depleted devices',()=>{
  const old=entry<SliceState>('final'),s=migrateSliceState(old);
  expect(s).toMatchObject({status:'ACTIVE',revision:692,week:169,health:70,mind:99,spirituality:113,cash:576,actionsRemaining:3,injuryRisk:0,progression:{pathwayId:'paragon',sequence:2,acting:100}});
  expect(s.injuries).toHaveLength(1);expect(s.injuries[0]).toMatchObject({severity:"HEAVY",treatedRevision:null});same(s.progression,old.progression);same(s.character,old.character);
  expect(Object.keys(s.progression.mastery)).toHaveLength(19);expect(Object.values(s.progression.mastery).filter(v=>v===0)).toHaveLength(7);
  for(const id of CIVILIZATION_ENLIGHTENER_ABILITY_IDS)expect(Object.hasOwn(s.progression.mastery,id)).toBe(false);
  same(s.knowledgeMentor,old.knowledgeMentor);expect(s.knowledgeMentor.encounter.enemyStatus).toBe('DEAD');same(s.alchemist,old.alchemist);expect(s.alchemist.life.creations.map(x=>[x.id,x.charge,x.durability])).toEqual([['AL4-BOX-1',0,100],['AL4-FRAME-1',0,90]]);expect(s.arcaneScholar.encounter.enemyStatus).toBe('SURRENDERED');
  same(s.combatHistory,old.combatHistory);same(s.chronicle,old.chronicle);
  expect(projectSliceState(s).maxSpirituality).toBe(120);
 });
 it('fails closed on missing current root, forged legacy root and future format',()=>{
  const old=original(),s=migrateSliceState(old),missing=structuredClone(s) as unknown as Record<string,unknown>;delete missing.civilizationEnlightener;
  expect(()=>migrateSliceState(missing)).toThrow();expect(()=>assertValidSliceState(missing)).toThrow();
  const forged={...old,civilizationEnlightener:createCivilizationEnlightenerState()},before=stableStringify(forged);
  expect(()=>migrateSliceState(forged)).toThrow();expect(stableStringify(forged)).toBe(before);
  expect(()=>migrateSliceState({...s,schemaVersion:CURRENT_SCHEMA_VERSION+1})).toThrow();
  expect(()=>assertValidSliceState({...s,contentVersion:'unknown-future'})).toThrow();
 });
 it('validates exact public acquisition commands and rejects extra fields',()=>{
  expect(validateSlicePayload({type:'CIVILIZATION_ENLIGHTENER',command:{type:'LEARN_GUIDANCE'}})).toBe(true);
  expect(validateSlicePayload({type:'CIVILIZATION_ENLIGHTENER',command:{type:'LEARN_GUIDANCE',free:true}})).toBe(false);
  expect(validateSlicePayload({type:'CIVILIZATION_ENLIGHTENER',command:{type:'CONSUME',bottleId:'civilization-enlightener-potion-1',confirmed:true}})).toBe(true);
  expect(validateSlicePayload({type:'CIVILIZATION_ENLIGHTENER',command:{type:'CONSUME',bottleId:'civilization-enlightener-potion-1',confirmed:false}})).toBe(false);
 });
});
