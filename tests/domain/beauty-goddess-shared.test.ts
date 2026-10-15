import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createBeautyGoddessState } from '../../src/domain/beauty-goddess/index.js';
import { BEAUTY_GODDESS_ABILITY_IDS } from '../../src/domain/beauty-goddess/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/life-giver-v01680/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE,key);
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
const original=()=>entry<Record<string,unknown>>('final');
describe('BeautyGoddess actual source and strict current schema',()=>{
 it('migrates the actual schema165 source without changing any existing field',()=>{
  const old=original(), bytes=stableStringify(old), s=migrateSliceState(old);
  expect([old.schemaVersion,old.contentVersion]).toEqual([165,'life-giver-v165']);
  expect(entry<SliceIntent[]>('commands')).toHaveLength(572);
  const defaults=createSliceRun(s.runId,entry<Parameters<typeof createSliceRun>[1]>('creation'),entry<string>('seed')) as unknown as Record<string,unknown>;
  const current=s as unknown as Record<string,unknown>, added=Object.keys(defaults).filter(k=>!Object.hasOwn(old,k));
  expect(added).toContain('beautyGoddess');
  expect(Object.keys(current).filter(k=>!Object.hasOwn(old,k)).sort()).toEqual([...added].sort());
  for(const k of Object.keys(old))if(k!=='schemaVersion'&&k!=='contentVersion')same(current[k],old[k]);
  for(const k of added)same(current[k],defaults[k]);
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  same(s.beautyGoddess,createBeautyGoddessState());same(migrateSliceState(s),s);
  expect(stableStringify(old)).toBe(bytes);assertValidSliceState(s);
 });
 it('retains21 original masteries, seven zeros, three spent papers and the same independent guest',()=>{
  const old=entry<SliceState>('final'),s=migrateSliceState(old);
  expect(s).toMatchObject({status:'ACTIVE',revision:573,week:131,health:70,mind:100,spirituality:120,cash:634,actionsRemaining:3,injuryRisk:2,progression:{pathwayId:'moon',sequence:2,acting:100}});
  expect(s.injuries).toHaveLength(3);expect(s.injuries.every(w=>w.severity==='LIGHT'&&w.treatedRevision===null)).toBe(true);
  same(s.progression,old.progression);same(s.character,old.character);
  expect(Object.keys(s.progression.mastery)).toHaveLength(21);expect(Object.values(s.progression.mastery).filter(v=>v===0)).toHaveLength(7);
  for(const id of BEAUTY_GODDESS_ABILITY_IDS)expect(Object.hasOwn(s.progression.mastery,id)).toBe(false);
  for(const key of ['apothecary','tamer','vampire','potionProfessor','crimsonScholar','witchKing','summoningMaster','lifeGiver'] as const)same(s[key],old[key]);
  expect(s.witchKing.life.papers.map(p=>p.status)).toEqual(['CONSUMED','CONSUMED','CONSUMED']);
  expect(s.summoningMaster.life.partner).toMatchObject({id:'SM3-LUMEN',bodyId:'SM3-LUMEN-BODY',location:'HOME',health:100,mind:92,stamina:88});
  expect(s.lifeGiver.encounter.enemyStatus).toBe('RESISTING');
  same(s.combatHistory,old.combatHistory);same(s.chronicle,old.chronicle);expect(projectSliceState(s).maxSpirituality).toBe(120);
 });
 it('fails closed on missing current root, forged legacy root and future format',()=>{
  const old=original(),s=migrateSliceState(old),missing=structuredClone(s) as unknown as Record<string,unknown>;delete missing.beautyGoddess;
  expect(()=>migrateSliceState(missing)).toThrow();expect(()=>assertValidSliceState(missing)).toThrow();
  const forged={...old,beautyGoddess:createBeautyGoddessState()},before=stableStringify(forged);
  expect(()=>migrateSliceState(forged)).toThrow();expect(stableStringify(forged)).toBe(before);
  expect(()=>migrateSliceState({...s,schemaVersion:CURRENT_SCHEMA_VERSION+1})).toThrow();
  expect(()=>assertValidSliceState({...s,contentVersion:'unknown-future'})).toThrow();
 });
 it('validates exact public acquisition commands and rejects extra fields',()=>{
  expect(validateSlicePayload({type:'BEAUTY_GODDESS',command:{type:'LEARN_GUIDANCE'}})).toBe(true);
  expect(validateSlicePayload({type:'BEAUTY_GODDESS',command:{type:'CONFIRM_TRANSFORMATION',confirmed:true}})).toBe(true);
  expect(validateSlicePayload({type:'BEAUTY_GODDESS',command:{type:'CONFIRM_TRANSFORMATION',confirmed:false}})).toBe(false);
  expect(validateSlicePayload({type:'BEAUTY_GODDESS',command:{type:'LEARN_GUIDANCE',free:true}})).toBe(false);
  expect(validateSlicePayload({type:'BEAUTY_GODDESS',command:{type:'CONSUME',bottleId:'beauty-goddess-potion-1',confirmed:true}})).toBe(true);
  expect(validateSlicePayload({type:'BEAUTY_GODDESS',command:{type:'CONSUME',bottleId:'beauty-goddess-potion-1',confirmed:false}})).toBe(false);
 });
});
