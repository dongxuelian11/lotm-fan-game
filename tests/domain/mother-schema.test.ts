import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createMotherState, validateMotherState } from '../../src/domain/mother/index.js';
import { openMotherRuntimeSession } from '../../src/domain/mother/owned-session.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { MOTHER_SOURCE_FILE, motherHash, authenticMotherPredecessor, assertMotherSourceUnmodified } from '../helpers/mother-scenario.js';
const fresh=()=>createSliceRun('mother-schema',sliceDefaultCreationSelection,'mother-schema-seed');
const legacy225=()=>{const {mother:_root,...state}=fresh();return {...state,schemaVersion:225 as const,contentVersion:'justiciar-v225' as const};};
describe('Mother226 exact additive migration',()=>{
 it('adds only the empty Mother root and preserves all previous roots',()=>{
  const state=fresh(),old=legacy225(),before=structuredClone(old),m=migrateSliceState(old);
  expect([state.schemaVersion,state.contentVersion]).toEqual([226,'mother-v226']);
  expect(state.mother).toEqual(createMotherState());expect(m.mother).toEqual(createMotherState());
  expect(Object.keys(m).sort()).toEqual([...Object.keys(old),'mother'].sort());
  for(const [k,v]of Object.entries(old))if(!['schemaVersion','contentVersion'].includes(k))expect(m[k as keyof SliceState],k).toStrictEqual(v);
  expect(old).toEqual(before);expect(validateMotherState(m)).toBe(true);expect(()=>assertValidSliceState(m)).not.toThrow();expect(()=>openMotherRuntimeSession(m)).toThrow();
 });
 it('rejects forged S0, missing current roots and backdated recovery evidence',()=>{
  const state=fresh(),old=legacy225(),{mother:_root,...missing}=state;
  for(const value of [missing,{...state,mother:null},{...state,mother:{...state.mother,forged:true}},{...old,mother:createMotherState()},
   {...old,natureWalker:{...old.natureWalker,resupply:{...old.natureWalker.resupply,recovery:null}}},
   {...state,schemaVersion:227},{...state,contentVersion:'justiciar-v225'}])expect(()=>migrateSliceState(value)).toThrow();
  const fake=fresh();fake.progression.pathwayId='mother';fake.progression.sequence=0;fake.spirituality=150;
  expect(validateMotherState(fake)).toBe(false);expect(()=>assertValidSliceState(fake)).toThrow();expect(()=>openMotherRuntimeSession(fake)).toThrow();
  expect(validateSlicePayload({type:'MOTHER',command:{type:'REST'}})).toBe(true);
  expect(validateSlicePayload({type:'MOTHER',command:{type:'REST',cash:500}})).toBe(false);
 });
 it('preserves the exact955 living source including H40, original plants, injuries and RNG',()=>{
  const raw=readObjectEntry<Record<string,unknown>>(MOTHER_SOURCE_FILE,'final'),before=motherHash(raw),current=authenticMotherPredecessor(),defaults=fresh();
  expect(raw).toMatchObject({revision:956,health:40,progression:{sequence:1},natureWalker:{promotionWeek:221,resupply:{requestedWeek:null,deliveries:0}}});
  for(const [k,v]of Object.entries(raw))if(!['schemaVersion','contentVersion'].includes(k))expect(motherHash(current[k as keyof SliceState]),k).toBe(motherHash(v));
  for(const k of Object.keys(current).filter(k=>!Object.hasOwn(raw,k)))expect(current[k as keyof SliceState]).toEqual(defaults[k as keyof SliceState]);
  expect(motherHash(raw)).toBe(before);expect(()=>assertValidSliceState(current)).not.toThrow();assertMotherSourceUnmodified();
 },120_000);
});
