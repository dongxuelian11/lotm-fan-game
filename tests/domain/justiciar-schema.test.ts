import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createMotherState } from '../../src/domain/mother/index.js';
import { CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { createJusticiarState, validateJusticiarState } from '../../src/domain/justiciar/index.js';
import { openJusticiarRuntimeSession } from '../../src/domain/justiciar/owned-session.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { JUSTICIAR_SOURCE_FILE, justiciarHash, authenticJusticiarPredecessor, assertJusticiarSourceUnmodified } from '../helpers/justiciar-scenario.js';
const fresh=()=>createSliceRun('justiciar-schema',sliceDefaultCreationSelection,'justiciar-schema-seed');
const legacy224=()=>{const {justiciar:_root,mother:_mother,...state}=fresh();return {...state,schemaVersion:224 as const,contentVersion:'black-emperor-v224' as const};};
describe('Justiciar225 exact additive migration',()=>{
 it('adds exactly empty justiciar and retains all old fields',()=>{
  const state=fresh(),old=legacy224(),before=structuredClone(old),m=migrateSliceState(old);
  expect([state.schemaVersion,state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  expect(state.mother).toEqual(createMotherState());expect(m.mother).toEqual(createMotherState());expect(state.justiciar).toEqual(createJusticiarState());expect(m.justiciar).toEqual(createJusticiarState());
  expect(Object.keys(m).sort()).toEqual([...Object.keys(old),'justiciar','mother'].sort());
  for(const [k,v]of Object.entries(old))if(!['schemaVersion','contentVersion'].includes(k))expect(m[k as keyof SliceState],k).toStrictEqual(v);
  expect(old).toEqual(before);expect(validateJusticiarState(m)).toBe(true);expect(()=>assertValidSliceState(m)).not.toThrow();expect(()=>openJusticiarRuntimeSession(m)).toThrow();
 });
 it('rejects fabricated current or backdated chapter/recovery authority',()=>{
  const state=fresh(),old=legacy224(),{justiciar:_root,...missing}=state;
  for(const value of [missing,{...state,justiciar:null},{...state,justiciar:{...state.justiciar,forged:true}},{...old,justiciar:createJusticiarState()},
   {...old,handOfOrder:{...old.handOfOrder,resupply:{...old.handOfOrder.resupply,recovery:null}}},
   {...state,schemaVersion:CURRENT_SCHEMA_VERSION+1},{...state,contentVersion:'black-emperor-v224'}])expect(()=>migrateSliceState(value)).toThrow();
  const fake=fresh();fake.progression.pathwayId='justiciar';fake.progression.sequence=0;fake.spirituality=150;
  expect(validateJusticiarState(fake)).toBe(false);expect(()=>assertValidSliceState(fake)).toThrow();expect(()=>openJusticiarRuntimeSession(fake)).toThrow();
  expect(validateSlicePayload({type:'JUSTICIAR',command:{type:'REST'}})).toBe(true);
  expect(validateSlicePayload({type:'JUSTICIAR',command:{type:'REST',cash:500}})).toBe(false);
 });
 it('strictly preserves the actual706 pre-fourth living source',()=>{
  const raw=readObjectEntry<Record<string,unknown>>(JUSTICIAR_SOURCE_FILE,'final'),before=justiciarHash(raw),current=authenticJusticiarPredecessor(),defaults=fresh();
  expect(raw).toMatchObject({revision:707,progression:{sequence:2},handOfOrder:{resupply:{requestedWeek:null,deliveries:0}}});
  for(const [k,v]of Object.entries(raw))if(!['schemaVersion','contentVersion'].includes(k))expect(justiciarHash(current[k as keyof SliceState]),k).toBe(justiciarHash(v));
  for(const k of Object.keys(current).filter(k=>!Object.hasOwn(raw,k)))expect(current[k as keyof SliceState]).toEqual(defaults[k as keyof SliceState]);
  expect(justiciarHash(raw)).toBe(before);expect(()=>assertValidSliceState(current)).not.toThrow();assertJusticiarSourceUnmodified();
 },120_000);
});
