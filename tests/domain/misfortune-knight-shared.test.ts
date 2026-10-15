import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createMisfortuneKnightState } from '../../src/domain/misfortune-knight/index.js';
import { MISFORTUNE_KNIGHT_ABILITY_IDS, MISFORTUNE_KNIGHT_SOURCE_KEYS } from '../../src/domain/misfortune-knight/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE='tests/fixtures/concealment-servant-v01690/natural.json';
const PEACEFUL='tests/fixtures/concealment-servant-v01690/original-enemy-approach.json';
const entry=<T>(key:string):T=>readObjectEntry<T>(SOURCE,key);
const original=()=>readObjectEntry<Record<string,unknown>>(PEACEFUL,'beforeLast');
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
describe('Misfortune Knight actual peaceful boundary and strict schema',()=>{
 it('pins distinct original death and peaceful boundary without pretending the dead run continued',()=>{
  expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('b1edff5df12aa0b3a88aa16b2feee5ff63766ea15d4c7346b9ccb294f1c8c7b4');
  expect(createHash('sha256').update(readFileSync(PEACEFUL)).digest('hex')).toBe('667f41064ca3aedc76365a66a05bd26ec2fb47a20d6cbf74ffa744a88b778dba');
  const commands=entry<SliceIntent[]>('commands');expect(commands).toHaveLength(528);
  same(readObjectEntry(PEACEFUL,'lastIntent'),commands[518]);
  expect(entry('final')).toMatchObject({status:'DEAD',revision:529,health:0,random:{cursor:432}});
  expect(original()).toMatchObject({status:'ACTIVE',revision:519,random:{cursor:341}});
 });
 it('migrates genuine schema166 while preserving each old field and initializing only missing roots',()=>{
  const old=original(),bytes=stableStringify(old),s=migrateSliceState(old);
  expect([old.schemaVersion,old.contentVersion]).toEqual([166,'concealment-servant-v166']);
  const defaults=createSliceRun(s.runId,entry<Parameters<typeof createSliceRun>[1]>('creation'),entry<string>('seed')) as unknown as Record<string,unknown>;
  const current=s as unknown as Record<string,unknown>,added=Object.keys(defaults).filter(k=>!Object.hasOwn(old,k));
  expect(added).toContain('misfortuneKnight');expect(Object.keys(current).filter(k=>!Object.hasOwn(old,k)).sort()).toEqual([...added].sort());
  for(const k of Object.keys(old))if(k!=='schemaVersion'&&k!=='contentVersion')same(current[k],old[k]);
  for(const k of added)same(current[k],defaults[k]);
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  same(s.misfortuneKnight,createMisfortuneKnightState());same(migrateSliceState(s),s);expect(stableStringify(old)).toBe(bytes);assertValidSliceState(s);
 });
 it('retains healthy18-key source, five zeros, original sealed leaf and all historical opponents',()=>{
  const old=original() as unknown as SliceState,s=migrateSliceState(old);
  expect(s).toMatchObject({status:'ACTIVE',revision:519,week:121,health:100,mind:100,spirituality:120,cash:420,actionsRemaining:3,injuryRisk:0,progression:{pathwayId:'darkness',sequence:2,acting:100}});
  expect(s.injuries).toEqual([]);same(s.character,old.character);same(s.progression,old.progression);
  expect(Object.keys(s.progression.mastery)).toHaveLength(18);expect(Object.values(s.progression.mastery).filter(v=>v===0)).toHaveLength(5);
  for(const id of MISFORTUNE_KNIGHT_ABILITY_IDS)expect(Object.hasOwn(s.progression.mastery,id)).toBe(false);
  for(const key of MISFORTUNE_KNIGHT_SOURCE_KEYS)same(s[key],old[key]);
  expect(s.concealmentServant.encounter).toMatchObject({status:'AVAILABLE',enemyStatus:'RESISTING',approachWeek:null});same(s.combatHistory,old.combatHistory);same(s.chronicle,old.chronicle);
  expect(projectSliceState(s).maxSpirituality).toBe(120);
 });
 it('preserves the ordinary dead terminal and denies starting new acquisition there',()=>{
  const s=migrateSliceState(entry('final')),before=stableStringify(s);expect(s.status).toBe('DEAD');
  expect(()=>applySliceIntent(s,{type:'MISFORTUNE_KNIGHT',command:{type:'LEARN_GUIDANCE'}})).toThrow();expect(stableStringify(s)).toBe(before);
 });
 it('rejects missing current root, forged historical root and future formats',()=>{
  const old=original(),s=migrateSliceState(old),missing=structuredClone(s) as unknown as Record<string,unknown>;delete missing.misfortuneKnight;
  expect(()=>migrateSliceState(missing)).toThrow();expect(()=>assertValidSliceState(missing)).toThrow();
  const forged={...old,misfortuneKnight:createMisfortuneKnightState()},before=stableStringify(forged);expect(()=>migrateSliceState(forged)).toThrow();expect(stableStringify(forged)).toBe(before);
  expect(()=>migrateSliceState({...s,schemaVersion:CURRENT_SCHEMA_VERSION+1})).toThrow();expect(()=>assertValidSliceState({...s,contentVersion:'unknown-future'})).toThrow();
 });
 it('accepts exact commands and rejects free extras, unsupported transformations and missing confirmation',()=>{
  expect(validateSlicePayload({type:'MISFORTUNE_KNIGHT',command:{type:'LEARN_GUIDANCE'}})).toBe(true);
  expect(validateSlicePayload({type:'MISFORTUNE_KNIGHT',command:{type:'LEARN_GUIDANCE',free:true}})).toBe(false);
  expect(validateSlicePayload({type:'MISFORTUNE_KNIGHT',command:{type:'CONFIRM_TRANSFORMATION',confirmed:true}})).toBe(false);
  expect(validateSlicePayload({type:'MISFORTUNE_KNIGHT',command:{type:'CONSUME',bottleId:'misfortune-knight-potion-1',confirmed:true}})).toBe(true);
  expect(validateSlicePayload({type:'MISFORTUNE_KNIGHT',command:{type:'CONSUME',bottleId:'misfortune-knight-potion-1',confirmed:false}})).toBe(false);
 });
});
