import { readObjectEntry } from '../helpers/read-object-entry.js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { createPerfecterState } from '../../src/domain/perfecter/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedPerfecterSlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
const fresh = () => createSliceRun('perfecter-schema', sliceDefaultCreationSelection, 'perfecter-schema');
const same = (a: unknown,b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
function old(version: 205 | 206 | 207): Record<string, unknown> {
  const value = structuredClone(fresh()) as unknown as Record<string, unknown>;
  delete value.perfecter;
  if (version < 207) delete value.visionary;
  if (version < 206) delete value.redPriest;
  value.schemaVersion=version;
  value.contentVersion=version===207?'visionary-v207':version===206?'red-priest-v206':'fool-v205';
  return value;
}
describe('Perfecter exact current schema boundary', () => {
  it('creates one empty new root and a detached valid current save', () => {
    const state=fresh(), before=stableStringify(state), copy=migrateSliceState(state);
    expect([state.schemaVersion,state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
    same(state.perfecter,createPerfecterState());same(state,copy);expect(copy).not.toBe(state);
    expect(copy.perfecter).not.toBe(state.perfecter);assertValidSliceState(copy);expect(stableStringify(state)).toBe(before);
  });
  it.each([205,206,207] as const)('strictly preserves every old %i field and adds only missing defaults', version => {
    const state=old(version), before=stableStringify(state), next=migrateSliceState(state), defaults=fresh();
    const additions=Object.keys(next).filter(key=>!Object.hasOwn(state,key));
    expect(additions.sort()).toEqual((version===205?['perfecter','redPriest','visionary']:version===206?['perfecter','visionary']:['perfecter']).sort());
    for(const [key,value] of Object.entries(state)) if(key!=='schemaVersion'&&key!=='contentVersion') same(next[key as keyof SliceState],value);
    for(const key of additions) same(next[key as keyof SliceState],defaults[key as keyof SliceState]);
    expect(stableStringify(state)).toBe(before);
  });
  it('preserves the unchanged real 186 CE capture through the 207 boundary',()=>{
    const bytes=readFileSync('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','utf8');
    expect(sha256Hex(bytes)).toBe('70b8843550d5a79abd5250377184ab5050a80cc1b7138f2a03ead788fb3bb8ef');
    const raw=readObjectEntry<Record<string,unknown>>('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','final');
    expect([raw.schemaVersion,raw.contentVersion,raw.revision,raw.week]).toEqual([186,'civilization-enlightener-v186',798,188]);
    const legacy=migrateSliceState(raw) as unknown as Record<string,unknown>;
    delete legacy.perfecter;legacy.schemaVersion=207;legacy.contentVersion='visionary-v207';
    const before=stableStringify(legacy),next=migrateSliceState(legacy);
    expect(Object.keys(next).filter(key=>!Object.hasOwn(legacy,key))).toEqual(['perfecter']);
    for(const [key,value] of Object.entries(raw))if(key!=='schemaVersion'&&key!=='contentVersion')same(next[key as keyof SliceState],value);
    for(const [key,value] of Object.entries(legacy))if(key!=='schemaVersion'&&key!=='contentVersion')same(next[key as keyof SliceState],value);
    same(next.perfecter,createPerfecterState());expect(stableStringify(legacy)).toBe(before);
    expect(readFileSync('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','utf8')).toBe(bytes);
  },60_000);
  it.each([205,206,207] as const)('rejects a future Perfecter root smuggled into %i',version=>{
    const state={...old(version),perfecter:createPerfecterState()},before=stableStringify(state);
    expect(()=>migrateSliceState(state)).toThrow();expect(stableStringify(state)).toBe(before);
  });
  it('rejects missing roots, unknown keys, invalid nested roots and mismatched versions',()=>{
    const state=fresh(), missing=structuredClone(state) as unknown as Record<string,unknown>;delete missing.perfecter;
    for(const value of [missing,{...state,schemaVersion:CURRENT_SCHEMA_VERSION+1},{...state,contentVersion:'unknown'},
      {...old(207),contentVersion:'red-priest-v206'}, {...old(206),contentVersion:'visionary-v207'},
      {...state,perfecter:{...state.perfecter,skipValidation:true}},{...state,unknownAuthority:{}}]) {
      const before=stableStringify(value);expect(()=>migrateSliceState(value)).toThrow();expect(stableStringify(value)).toBe(before);
    }
  });
  it('cannot mint an owned head or S0 authority from an empty or caller-supplied root',()=>{
    const state=fresh(),fake=structuredClone(state);fake.progression.pathwayId='paragon';fake.progression.sequence=0;fake.spirituality=150;
    expect(()=>assertValidSliceState(fake)).toThrow();
    for(const value of [state,fake,{...state,perfecter:{...state.perfecter,guidanceKnown:true,source:{}}},null])expect(()=>openValidatedPerfecterSlice(value)).toThrow();
  });
  it('accepts only exact public Perfecter commands, with no caller authority fields',()=>{
    expect(validateSlicePayload({type:'PERFECTER',command:{type:'LEARN_GUIDANCE'}})).toBe(true);
    expect(validateSlicePayload({type:'PERFECTER',command:{type:'REST'}})).toBe(true);
    for(const value of [{type:'PERFECTER',command:{type:'LEARN_GUIDANCE'},engine:{}},
      {type:'PERFECTER',command:{type:'LEARN_GUIDANCE',source:{}}},
      {type:'PERFECTER',command:{type:'CONSUME',compoundId:'original',confirmed:true,success:true}},
      {type:'PERFECTER',command:{type:'REST'},skipValidation:true}])expect(validateSlicePayload(value)).toBe(false);
  });
});
