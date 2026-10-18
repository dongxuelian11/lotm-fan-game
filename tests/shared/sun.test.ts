import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedSunSlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
const CAPTURE='tests/fixtures/tyrant-v02150/action-702.json.gz';
const SHA='a0b1d05e83bf69c5763a4294acd7d7f949f578dbd68bba78c7bb18df1924d430';
const hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
const fresh=()=>createSliceRun('sun-schema',sliceDefaultCreationSelection,'sun-schema');
const raw=()=>JSON.parse(gunzipSync(readFileSync(CAPTURE)).toString('utf8')).beforeLast as Record<string,unknown>;
describe('Sun exact current schema and command boundary',()=>{
 it('creates a detached strict empty root and preserves current version',()=>{
  const s=fresh(),before=stableStringify(s),copy=migrateSliceState(s);
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  same(s.sun,createSunState());same(copy,s);expect(copy.sun).not.toBe(s.sun);assertValidSliceState(copy);expect(stableStringify(s)).toBe(before);
 });
 it.each(['beforeLast','final'] as const)('migrates actual captured212 %s with only the named empty Sun root',key=>{
  const bytes=readFileSync(CAPTURE),s=JSON.parse(gunzipSync(bytes).toString('utf8'))[key] as Record<string,unknown>;
  expect(hash(bytes)).toBe(SHA);expect([s.schemaVersion,s.contentVersion]).toEqual([212,'tyrant-v212']);
  const before=stableStringify(s),copy=migrateSliceState(s);
  expect(Object.keys(copy).filter(k=>!Object.hasOwn(s,k))).toEqual(['sun']);same(copy.sun,createSunState());
  for(const [k,v]of Object.entries(s))if(!['schemaVersion','contentVersion'].includes(k))same(copy[k as keyof SliceState],v);
  same(migrateSliceState(copy),copy);expect(stableStringify(s)).toBe(before);expect(readFileSync(CAPTURE).equals(bytes)).toBe(true);
 },60_000);
 it('rejects future root in real212 and undeclared current fields without mutation',()=>{
  const s=fresh(),missing=structuredClone(s) as unknown as Record<string,unknown>;delete missing.sun;
  for(const v of [{...raw(),sun:createSunState()},{...raw(),sun:null},missing,{...s,schemaVersion:214},{...s,contentVersion:'tyrant-v212'},
   {...s,sun:{...s.sun,skipValidation:true}},{...s,unrecognizedAuthority:{}}]){
   const before=stableStringify(v);expect(()=>migrateSliceState(v)).toThrow();expect(stableStringify(v)).toBe(before);
  }
 },60_000);
 it('cannot mint S0 or a private head from a caller authored root',()=>{
  const s=fresh(),fake=structuredClone(s);fake.progression.pathwayId='sun';fake.progression.sequence=0;fake.spirituality=150;
  expect(()=>assertValidSliceState(fake)).toThrow();for(const v of [s,fake,{...s,sun:{...s.sun,guidanceKnown:true,source:{}}},null])expect(()=>openValidatedSunSlice(v)).toThrow();
 });
 it('accepts only exact commands and never supplied outcomes, prices or private handles',()=>{
  for(const command of [{type:'LEARN_GUIDANCE'},{type:'REST'},{type:'NEXT_WEEK'},
   {type:'SERVICE',command:{type:'RETURN_ON_FOOT',serviceId:'washhouse-heat'}},
   {type:'CONSUME',compoundId:'sun-compound-1',confirmed:true}])expect(validateSlicePayload({type:'SUN',command})).toBe(true);
  for(const value of [{type:'SUN',command:{type:'LEARN_GUIDANCE'},engine:{}},{type:'SUN',command:{type:'LEARN_GUIDANCE',source:{}}},
   {type:'SUN',command:{type:'REST',cash:1000}},{type:'SUN',command:{type:'CONSUME',compoundId:'sun-compound-1',confirmed:true,success:true}},
   {type:'SUN',command:{type:'CONSUME',compoundId:'sun-compound-1',confirmed:false}},
   {type:'SUN',command:{type:'SERVICE',command:{type:'RUN_HEAT_SERVICE',serviceId:'washhouse-heat',outcome:'SUCCESS'}}}])expect(validateSlicePayload(value)).toBe(false);
 });
});
