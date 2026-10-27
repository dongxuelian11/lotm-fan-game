import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedSunSlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyDeathState, assertEmptyDoorState } from '../helpers/empty-death-capture.js';
import { assertEmptyErrorAscentState } from '../helpers/empty-error-ascent-capture.js';
import { assertEmptyTwilightGiantState } from '../helpers/empty-twilight-giant-capture.js';
import { assertEmptyDemonessState } from '../helpers/empty-demoness-capture.js';
import { assertEmptyHermitState } from '../helpers/empty-hermit-capture.js';
import { assertEmptyHangedManState } from '../helpers/empty-hanged-man-capture.js';
import { assertEmptyAbyssState } from '../helpers/empty-abyss-capture.js';
import { assertEmptyChainedState } from '../helpers/empty-chained-capture.js';
import { assertEmptyWheelOfFortuneState } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState } from '../helpers/empty-mother-capture.js';
const CAPTURE='tests/fixtures/tyrant-v02150/action-702.json.gz';
const SHA='a0b1d05e83bf69c5763a4294acd7d7f949f578dbd68bba78c7bb18df1924d430';
const hash=(v:Buffer)=>createHash('sha256').update(v).digest('hex');
const same=(a:unknown,b:unknown)=>expect(stableStringify(a)).toBe(stableStringify(b));
const fresh=()=>createSliceRun('sun-schema',sliceDefaultCreationSelection,'sun-schema');
const raw=()=>JSON.parse(gunzipSync(readFileSync(CAPTURE)).toString('utf8')).beforeLast as Record<string,unknown>;
describe('Sun exact current schema and command boundary',()=>{
  it('rejects a missing, nonempty or extended current Death root', () => {
    const state = fresh(), { death: _missingDeath, ...missing } = state;
    for (const value of [missing, { ...state, death: null },
      { ...state, death: { ...state.death, guidanceKnown: true } },
      { ...state, death: { ...state.death, unexpectedField: true } }]) {
      const before = stableStringify(value);
      expect(() => migrateSliceState(value)).toThrow(); expect(stableStringify(value)).toBe(before);
    }
  });

 it('creates a detached strict empty root and preserves current version',()=>{
  const s=fresh(),before=stableStringify(s),copy=migrateSliceState(s);
  expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  same(s.sun,createSunState());same(s.death,createDeathState());same(copy,s);expect(copy.sun).not.toBe(s.sun);expect(copy.death).not.toBe(s.death);assertValidSliceState(copy);expect(stableStringify(s)).toBe(before);
 });
 it.each(['beforeLast','final'] as const)('migrates actual captured212 %s with only the named empty schema213–226 roots',key=>{
  const bytes=readFileSync(CAPTURE),s=JSON.parse(gunzipSync(bytes).toString('utf8'))[key] as Record<string,unknown>;
  expect(hash(bytes)).toBe(SHA);expect([s.schemaVersion,s.contentVersion]).toEqual([212,'tyrant-v212']);
  const addedRoots=['sun','death','door','errorAscent','twilightGiant','demoness','hermit','hangedMan',
   'abyss','chained','wheelOfFortune','blackEmperor','justiciar','mother'] as const;
  for(const root of addedRoots)expect(Object.hasOwn(s,root)).toBe(false);
  const before=stableStringify(s),copy=migrateSliceState(s);
  expect([copy.schemaVersion,copy.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  expect(Object.keys(copy).filter(k=>!Object.hasOwn(s,k)).sort()).toEqual([...addedRoots].sort());
  expect(Object.keys(copy).sort()).toEqual([...Object.keys(s),...addedRoots].sort());
  same(copy.sun,createSunState());same(copy.death,createDeathState());
  assertEmptyDeathState(copy);assertEmptyDoorState(copy);assertEmptyErrorAscentState(copy);assertEmptyTwilightGiantState(copy);
  assertEmptyDemonessState(copy);assertEmptyHermitState(copy);assertEmptyHangedManState(copy);assertEmptyAbyssState(copy);
  assertEmptyChainedState(copy);assertEmptyWheelOfFortuneState(copy);assertEmptyBlackEmperorState(copy);
  assertEmptyJusticiarState(copy);assertEmptyMotherState(copy);
  for(const [k,v]of Object.entries(s))if(!['schemaVersion','contentVersion'].includes(k))same(copy[k as keyof SliceState],v);
  const originalFields={...copy} as Record<string,unknown>;
  for(const root of addedRoots)delete originalFields[root];
  originalFields.schemaVersion=s.schemaVersion;originalFields.contentVersion=s.contentVersion;
  expect(hash(Buffer.from(stableStringify(originalFields)))).toBe(hash(Buffer.from(before)));
  same(migrateSliceState(copy),copy);expect(stableStringify(s)).toBe(before);expect(readFileSync(CAPTURE).equals(bytes)).toBe(true);
 },60_000);
 it('rejects future root in real212 and undeclared current fields without mutation',()=>{
  const s=fresh(),missing=structuredClone(s) as unknown as Record<string,unknown>;delete missing.sun;
  for(const v of [{...raw(),sun:createSunState()},{...raw(),sun:null},{...raw(),death:createDeathState()},{...raw(),death:null},missing,{...s,schemaVersion:CURRENT_SCHEMA_VERSION+1},{...s,contentVersion:'tyrant-v212'},
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
