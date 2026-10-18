import { createErrorAscentState } from '../../src/domain/error-ascent/index.js';
import { assertEmptyErrorAscentState } from '../helpers/empty-error-ascent-capture.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createVisionaryState } from '../../src/domain/visionary/index.js';
import { createPerfecterState } from '../../src/domain/perfecter/index.js';
import { createMoonState } from '../../src/domain/moon/index.js';
import { createDarknessState } from '../../src/domain/darkness/index.js';
import { createWhiteTowerState } from '../../src/domain/white-tower/index.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { createDoorState } from '../../src/domain/door/index.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedVisionarySlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
const fresh = () => createSliceRun('visionary-schema', sliceDefaultCreationSelection, 'visionary-schema');
const same = (a: unknown,b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const historicalCaptures = {
  205: {
    path: 'tests/fixtures/fool-v02080/natural.json',
    sha256: '8bc3141286c3ecb603410d36c4f2111ea28b3a423b6f28c44127ef16aaf72959',
    contentVersion: 'fool-v205', revision: 2084,
  },
  206: {
    path: 'tests/fixtures/red-priest-v02090/planned1137/natural.json',
    sha256: 'fc50408c3dbb087d46e441dfc5228993c1d65d750874cda81621e567e8930ac0',
    contentVersion: 'red-priest-v206', revision: 1138,
  },
} as const;
const introducedRoots = {
  205: ['redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent'],
  206: ['visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent'],
} as const;
const historicalStates = new Map<205 | 206, Record<string, unknown>>();
function old(version: 205 | 206): Record<string, unknown> {
  let captured = historicalStates.get(version);
  if (!captured) {
    // Authenticate original published inputs; never relabel a fresh current save.
    const source = historicalCaptures[version];
    expect(hash(readFileSync(source.path))).toBe(source.sha256);
    captured = readObjectEntry<Record<string, unknown>>(source.path, 'final');
    expect([captured.schemaVersion, captured.contentVersion, captured.revision]).toEqual(
      [version, source.contentVersion, source.revision],
    );
    if (version === 205) expect(hash(stableStringify(captured))).toBe('66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a');
    for (const root of introducedRoots[version]) expect(Object.hasOwn(captured, root)).toBe(false);
    historicalStates.set(version, captured);
  }
  return structuredClone(captured);
}
describe('Visionary exact current schema boundary', () => {
  it('creates one exact empty root and a detached valid current save', () => {
    const state=fresh(), before=stableStringify(state), copy=migrateSliceState(state);
    expect([state.schemaVersion,state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
    same(state.visionary,createVisionaryState());same(state.tyrant,createTyrantState());same(state.sun,createSunState());same(state.death,createDeathState());expect(state.door).toStrictEqual(createDoorState());assertEmptyErrorAscentState(state);same(state,copy);expect(copy).not.toBe(state);
    expect(copy.visionary).not.toBe(state.visionary);expect(copy.tyrant).not.toBe(state.tyrant);expect(copy.sun).not.toBe(state.sun);expect(copy.death).not.toBe(state.death);expect(copy.door).not.toBe(state.door);expect(copy.errorAscent).not.toBe(state.errorAscent);assertValidSliceState(copy);expect(stableStringify(state)).toBe(before);
  });
  for (const version of [205,206] as const) {
  it(`strictly preserves every old ${version} field and adds only missing defaults`, () => {
    const state=old(version), before=stableStringify(state), next=migrateSliceState(state), defaults=fresh();
    expect([next.schemaVersion,next.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
    const additions=Object.keys(next).filter(k=>!Object.hasOwn(state,k));
    expect(additions.sort()).toEqual([...introducedRoots[version]].sort());
    expect(Object.keys(next).sort()).toEqual([...Object.keys(state), ...introducedRoots[version]].sort());
    for(const [key,value] of Object.entries(state)) if(key!=='schemaVersion'&&key!=='contentVersion') same(next[key as keyof SliceState],value);
    for(const key of introducedRoots[version]) same(next[key],defaults[key]);
    same(next.tyrant,createTyrantState());same(next.sun,createSunState());same(next.death,createDeathState());expect(next.door).toStrictEqual(createDoorState());assertEmptyErrorAscentState(next);
    expect(stableStringify(state)).toBe(before);
    expect(hash(readFileSync(historicalCaptures[version].path))).toBe(historicalCaptures[version].sha256);
  }, version === 205 ? 60_000 : 5_000);
  }
  it.each([
    [205, 'visionary'], [205, 'perfecter'], [205, 'moon'],
    [205, 'darkness'], [205, 'whiteTower'], [205, 'tyrant'], [205, 'sun'], [205, 'death'], [205, 'door'], [205, 'errorAscent'],
    [206, 'visionary'], [206, 'perfecter'], [206, 'moon'],
    [206, 'darkness'], [206, 'whiteTower'], [206, 'tyrant'], [206, 'sun'], [206, 'death'], [206, 'door'], [206, 'errorAscent'],
  ] as const)('rejects a future root smuggled into %i: %s',(version, root)=>{
    const defaults = { visionary: createVisionaryState(), perfecter: createPerfecterState(), moon: createMoonState(),
      darkness: createDarknessState(), whiteTower: createWhiteTowerState(), tyrant: createTyrantState(), sun: createSunState(), death: createDeathState(), door: createDoorState(), errorAscent: createErrorAscentState() };
    for (const value of [defaults[root], { ...defaults[root], guidanceKnown: true }, null]) {
      const state={...old(version),[root]:value},before=stableStringify(state);
      expect(()=>migrateSliceState(state)).toThrow();expect(stableStringify(state)).toBe(before);
    }
  });
  it('rejects missing or altered later roots without repairing the input',()=>{
    const state=fresh();
    for(const root of ['perfecter','moon','darkness','whiteTower','tyrant','sun','death','door','errorAscent'] as const){
      const { [root]: _missing, ...missing } = state;
      for(const value of [missing,{...state,[root]:{...state[root],guidanceKnown:true}},
        {...state,[root]:{...state[root],unexpectedField:true}}]){
        const before=stableStringify(value);expect(()=>migrateSliceState(value)).toThrow();expect(stableStringify(value)).toBe(before);
      }
    }
  });
  it('rejects missing current roots, unknown fields, mismatched and future formats',()=>{
    const state=fresh(), missing=structuredClone(state) as unknown as Record<string,unknown>;delete missing.visionary;
    for(const value of [missing,{...state,schemaVersion:CURRENT_SCHEMA_VERSION+1},{...state,contentVersion:'unknown'},
      {...old(206),contentVersion:'fool-v205'},{...state,visionary:{...state.visionary,skipValidation:true}},
      {...state,unknownAuthority:{}}]) {const before=stableStringify(value);expect(()=>migrateSliceState(value)).toThrow();expect(stableStringify(value)).toBe(before);}
  });
  it('rejects a missing or altered current Death root without repair', () => {
    const state = fresh(), { death: _missingDeath, ...missing } = state;
    for (const value of [missing, { ...state, death: null },
      { ...state, death: { ...state.death, guidanceKnown: true } },
      { ...state, death: { ...state.death, unexpectedField: true } }]) {
      const before = stableStringify(value);
      expect(() => migrateSliceState(value)).toThrow(); expect(stableStringify(value)).toBe(before);
    }
  });
  it('rejects a missing or altered current Door root without repair', () => {
    const state = fresh(), { door: _missingDoor, ...missing } = state;
    for (const value of [missing, { ...state, door: null },
      { ...state, door: { ...state.door, guidanceKnown: true } },
      { ...state, door: { ...state.door, unexpectedField: true } }]) {
      const before = stableStringify(value);
      expect(() => migrateSliceState(value)).toThrow(); expect(stableStringify(value)).toBe(before);
    }
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
