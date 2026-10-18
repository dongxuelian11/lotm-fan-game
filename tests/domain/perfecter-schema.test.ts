import { assertEmptyErrorAscentState } from '../helpers/empty-error-ascent-capture.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { createPerfecterState } from '../../src/domain/perfecter/index.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { createDoorState } from '../../src/domain/door/index.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedPerfecterSlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
const fresh = () => createSliceRun('perfecter-schema', sliceDefaultCreationSelection, 'perfecter-schema');
const same = (a: unknown,b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const historicalCaptures = {
  205: {
    path: 'tests/fixtures/fool-v02080/natural.json', entry: 'final',
    sha256: '8bc3141286c3ecb603410d36c4f2111ea28b3a423b6f28c44127ef16aaf72959',
    contentVersion: 'fool-v205', revision: 2084,
  },
  206: {
    path: 'tests/fixtures/red-priest-v02090/planned1137/natural.json', entry: 'final',
    sha256: 'fc50408c3dbb087d46e441dfc5228993c1d65d750874cda81621e567e8930ac0',
    contentVersion: 'red-priest-v206', revision: 1138,
  },
  207: {
    path: 'tests/fixtures/visionary-v02100/boundary-660-learn_guidance.json', entry: 'beforeLast',
    sha256: '11268eb866d0842a91ca20fe2d2c7f032352050bcd39484231effc05260fb632',
    contentVersion: 'visionary-v207', revision: 660,
  },
} as const;
const introducedRoots = {
  205: ['redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent'],
  206: ['visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent'],
  207: ['perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent'],
} as const;
const historicalStates = new Map<205 | 206 | 207, Record<string, unknown>>();
function old(version: 205 | 206 | 207): Record<string, unknown> {
  let captured = historicalStates.get(version);
  if (!captured) {
    // Read exact published historical shapes, without downgrading current state.
    const source = historicalCaptures[version];
    expect(hash(readFileSync(source.path))).toBe(source.sha256);
    captured = readObjectEntry<Record<string, unknown>>(source.path, source.entry);
    expect([captured.schemaVersion, captured.contentVersion, captured.revision]).toEqual(
      [version, source.contentVersion, source.revision],
    );
    if (version === 205) expect(sha256Hex(stableStringify(captured))).toBe('66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a');
    for (const root of introducedRoots[version]) expect(Object.hasOwn(captured, root)).toBe(false);
    historicalStates.set(version, captured);
  }
  return structuredClone(captured);
}
describe('Perfecter exact current schema boundary', () => {
  it('creates one empty new root and a detached valid current save', () => {
    const state=fresh(), before=stableStringify(state), copy=migrateSliceState(state);
    expect([state.schemaVersion,state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
    same(state.perfecter,createPerfecterState());same(state.tyrant,createTyrantState());same(state.sun,createSunState());same(state.death,createDeathState());expect(state.door).toStrictEqual(createDoorState());assertEmptyErrorAscentState(state);same(state,copy);expect(copy).not.toBe(state);
    expect(copy.perfecter).not.toBe(state.perfecter);expect(copy.tyrant).not.toBe(state.tyrant);expect(copy.sun).not.toBe(state.sun);expect(copy.death).not.toBe(state.death);expect(copy.door).not.toBe(state.door);expect(copy.errorAscent).not.toBe(state.errorAscent);assertValidSliceState(copy);expect(stableStringify(state)).toBe(before);
  });
  for (const version of [205,206,207] as const) {
  it(`strictly preserves every old ${version} field and adds only missing defaults`, () => {
    const state=old(version), before=stableStringify(state), next=migrateSliceState(state), defaults=fresh();
    expect([next.schemaVersion,next.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
    const additions=Object.keys(next).filter(key=>!Object.hasOwn(state,key));
    expect(additions.sort()).toEqual([...introducedRoots[version]].sort());
    expect(Object.keys(next).sort()).toEqual([...Object.keys(state), ...introducedRoots[version]].sort());
    for(const [key,value] of Object.entries(state)) if(key!=='schemaVersion'&&key!=='contentVersion') same(next[key as keyof SliceState],value);
    for(const key of introducedRoots[version]) same(next[key],defaults[key]);
    same(next.tyrant,createTyrantState());same(next.sun,createSunState());same(next.death,createDeathState());expect(next.door).toStrictEqual(createDoorState());assertEmptyErrorAscentState(next);
    expect(stableStringify(state)).toBe(before);
    expect(hash(readFileSync(historicalCaptures[version].path))).toBe(historicalCaptures[version].sha256);
  }, version === 205 ? 60_000 : 5_000);
  }
  it('preserves the unchanged real 186 CE capture with only exact introduced current defaults',()=>{
    const bytes=readFileSync('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','utf8');
    expect(sha256Hex(bytes)).toBe('70b8843550d5a79abd5250377184ab5050a80cc1b7138f2a03ead788fb3bb8ef');
    const raw=readObjectEntry<Record<string,unknown>>('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','final');
    expect([raw.schemaVersion,raw.contentVersion,raw.revision,raw.week]).toEqual([186,'civilization-enlightener-v186',798,188]);
    const before=stableStringify(raw),next=migrateSliceState(raw),defaults=fresh();
    const additions = ['beautyGoddess', 'misfortuneKnight', 'allKnowingEye', 'thunderGod', 'pureWhiteAngel',
      'paleEmperor', 'starKey', 'timeWorm', 'divineHand', 'apocalypseDemoness', 'knowledgeEmperor', 'darkAngel',
      'uncleanMonarch', 'abomination', 'mercurySnake', 'princeOfAbolition', 'handOfOrder', 'natureWalker',
      'fool', 'redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent'] as const;
    expect([next.schemaVersion,next.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
    for(const key of additions) expect(Object.hasOwn(raw,key)).toBe(false);
    expect(Object.keys(next).filter(key=>!Object.hasOwn(raw,key)).sort()).toEqual([...additions].sort());
    expect(Object.keys(next).sort()).toEqual([...Object.keys(raw), ...additions].sort());
    for(const [key,value] of Object.entries(raw))if(key!=='schemaVersion'&&key!=='contentVersion')same(next[key as keyof SliceState],value);
    for(const key of additions)same(next[key],defaults[key]);
    same(next.perfecter,createPerfecterState());same(next.tyrant,createTyrantState());same(next.sun,createSunState());same(next.death,createDeathState());expect(next.door).toStrictEqual(createDoorState());assertEmptyErrorAscentState(next);expect(stableStringify(raw)).toBe(before);
    expect(sha256Hex(readFileSync('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','utf8'))).toBe('70b8843550d5a79abd5250377184ab5050a80cc1b7138f2a03ead788fb3bb8ef');
    expect(readFileSync('tests/fixtures/civilization-enlightener-v01890/boundary-ordinary-life-after-exit.json','utf8')).toBe(bytes);
  },60_000);
  for (const version of [205,206,207] as const) it(`rejects every introduced future root smuggled into ${version}`,()=>{
    const original=old(version),defaults=fresh();
    for(const root of introducedRoots[version]) for(const value of [defaults[root],{...defaults[root],guidanceKnown:true},null]){
      const state={...original,[root]:value},before=stableStringify(state);
      expect(()=>migrateSliceState(state)).toThrow();expect(stableStringify(state)).toBe(before);
    }
  }, version === 205 ? 10_000 : 5_000);
  it('rejects missing roots, unknown keys, invalid nested roots and mismatched versions',()=>{
    const state=fresh(), missing=structuredClone(state) as unknown as Record<string,unknown>;delete missing.perfecter;
    const missingTyrant=structuredClone(state) as unknown as Record<string,unknown>;delete missingTyrant.tyrant;
    for(const value of [missing,missingTyrant,{...state,schemaVersion:CURRENT_SCHEMA_VERSION+1},{...state,contentVersion:'unknown'},
      {...old(207),contentVersion:'red-priest-v206'}, {...old(206),contentVersion:'visionary-v207'},
      {...state,perfecter:{...state.perfecter,skipValidation:true}},{...state,tyrant:{...state.tyrant,skipValidation:true}},{...state,unknownAuthority:{}}]) {
      const before=stableStringify(value);expect(()=>migrateSliceState(value)).toThrow();expect(stableStringify(value)).toBe(before);
    }
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
