import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createVisionaryState } from '../../src/domain/visionary/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedVisionarySlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
const fresh = () => createSliceRun('visionary-schema', sliceDefaultCreationSelection, 'visionary-schema');
const same = (a: unknown,b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
function old(version: 205 | 206): Record<string, unknown> {
  const value = structuredClone(fresh()) as unknown as Record<string, unknown>;
  delete value.visionary;
  if(version === 205) delete value.redPriest;
  value.schemaVersion=version; value.contentVersion=version === 205 ? 'fool-v205':'red-priest-v206';
  return value;
}
describe('Visionary exact current schema boundary', () => {
  it('creates one exact empty root and a detached valid current save', () => {
    const state=fresh(), before=stableStringify(state), copy=migrateSliceState(state);
    expect([state.schemaVersion,state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
    same(state.visionary,createVisionaryState());same(state,copy);expect(copy).not.toBe(state);
    expect(copy.visionary).not.toBe(state.visionary);assertValidSliceState(copy);expect(stableStringify(state)).toBe(before);
  });
  it.each([205,206] as const)('strictly preserves every old %i field and adds only missing defaults', version => {
    const state=old(version), before=stableStringify(state), next=migrateSliceState(state), defaults=fresh();
    const additions=Object.keys(next).filter(k=>!Object.hasOwn(state,k));
    expect(additions.sort()).toEqual((version===205?['redPriest','visionary']:['visionary']).sort());
    for(const [key,value] of Object.entries(state)) if(key!=='schemaVersion'&&key!=='contentVersion') same(next[key as keyof SliceState],value);
    for(const key of additions) same(next[key as keyof SliceState],defaults[key as keyof SliceState]);
    expect(stableStringify(state)).toBe(before);
  });
  it.each([205,206] as const)('rejects a future root smuggled into %i',version=>{
    const state={...old(version),visionary:createVisionaryState()},before=stableStringify(state);
    expect(()=>migrateSliceState(state)).toThrow();expect(stableStringify(state)).toBe(before);
  });
  it('rejects missing current roots, unknown fields, mismatched and future formats',()=>{
    const state=fresh(), missing=structuredClone(state) as unknown as Record<string,unknown>;delete missing.visionary;
    for(const value of [missing,{...state,schemaVersion:CURRENT_SCHEMA_VERSION+1},{...state,contentVersion:'unknown'},
      {...old(206),contentVersion:'fool-v205'},{...state,visionary:{...state.visionary,skipValidation:true}},
      {...state,unknownAuthority:{}}]) {const before=stableStringify(value);expect(()=>migrateSliceState(value)).toThrow();expect(stableStringify(value)).toBe(before);}
  });
  it('does not create a retained head or promotion from an empty or supplied root',()=>{
    const state=fresh(),fake=structuredClone(state);fake.progression.pathwayId='audience';fake.progression.sequence=0;
    expect(()=>assertValidSliceState(fake)).toThrow();
    for(const value of [state,fake,{...state,visionary:{...state.visionary,guidanceKnown:true,source:{}}},null]) expect(()=>openValidatedVisionarySlice(value)).toThrow();
  });
  it('accepts only exact public command fields without caller authority',()=>{
    expect(validateSlicePayload({type:'VISIONARY',command:{type:'LEARN_GUIDANCE'}})).toBe(true);
    for(const value of [{type:'VISIONARY',command:{type:'LEARN_GUIDANCE'},engine:{}},
      {type:'VISIONARY',command:{type:'LEARN_GUIDANCE',source:{}}},
      {type:'VISIONARY',command:{type:'CONSUME',compoundId:'original',confirmed:true,success:true}}]) expect(validateSlicePayload(value)).toBe(false);
  });
});
