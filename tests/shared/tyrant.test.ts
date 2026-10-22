import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, validateSlicePayload } from '../../src/domain/slice/validation.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
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
const file='tests/fixtures/thunder-god-v01930/boundary-step-701-action.json';
const sha='6d721f6e2376085b77026c8a9373fbed5b005ee8a2413d27cdf5f02a4303f708';
const addedAfter190=['pureWhiteAngel','paleEmperor','starKey','timeWorm','divineHand','apocalypseDemoness',
 'knowledgeEmperor','darkAngel','uncleanMonarch','abomination','mercurySnake','princeOfAbolition','handOfOrder',
 'natureWalker','fool','redPriest','visionary','perfecter','moon','darkness','whiteTower','tyrant','sun','death',
 'door','errorAscent','twilightGiant','demoness','hermit','hangedMan','abyss','chained','wheelOfFortune',
 'blackEmperor','justiciar','mother'] as const;
const raw=()=>{const bytes=readFileSync(file);expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha);return JSON.parse(bytes.toString('utf8')).final;};
const fresh=()=>createSliceRun('tyrant-schema',sliceDefaultCreationSelection,'tyrant-schema');
describe('Tyrant212 exact schema admission',()=>{
  it('rejects a missing, nonempty or extended current Death root', () => {
    const state = fresh(), { death: _missingDeath, ...missing } = state;
    for (const value of [missing, { ...state, death: null },
      { ...state, death: { ...state.death, guidanceKnown: true } },
      { ...state, death: { ...state.death, unexpectedField: true } }]) {
      const before = stableStringify(value);
      expect(() => migrateSliceState(value)).toThrow(); expect(stableStringify(value)).toBe(before);
    }
  });

 it('creates one strict empty current root and detached copy',()=>{const s=fresh(),before=stableStringify(s);assertValidSliceState(s);expect(s.tyrant).toEqual(createTyrantState());expect(s.sun).toEqual(createSunState());expect(s.death).toStrictEqual(createDeathState());expect([s.schemaVersion,s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);const copy=migrateSliceState(s);expect(copy).not.toBe(s);expect(copy.death).not.toBe(s.death);expect(stableStringify(copy)).toBe(before);});
 it('migrates genuine190 source preserving every original field and exactly36 named empty schema191–226 roots',()=>{
  const bytes=readFileSync(file),old=raw(),before=stableStringify(old),next=migrateSliceState(old),defaults=fresh();
  expect([old.schemaVersion,old.contentVersion]).toEqual([190,'thunder-god-v190']);
  expect([next.schemaVersion,next.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION,CURRENT_CONTENT_VERSION]);
  for(const root of addedAfter190)expect(Object.hasOwn(old,root)).toBe(false);
  expect(Object.keys(next).filter(k=>!Object.hasOwn(old,k)).sort()).toEqual([...addedAfter190].sort());
  expect(Object.keys(next).sort()).toEqual([...Object.keys(old),...addedAfter190].sort());
  for(const[k,v]of Object.entries(old)){
   if(k!=='schemaVersion'&&k!=='contentVersion')expect(stableStringify(next[k as keyof typeof next])).toBe(stableStringify(v));
  }
  for(const k of addedAfter190)expect(stableStringify(next[k])).toBe(stableStringify(defaults[k]));
  expect(next.sun).toEqual(createSunState());expect(next.death).toStrictEqual(createDeathState());
  assertEmptyDeathState(next);assertEmptyDoorState(next);assertEmptyErrorAscentState(next);assertEmptyTwilightGiantState(next);
  assertEmptyDemonessState(next);assertEmptyHermitState(next);assertEmptyHangedManState(next);assertEmptyAbyssState(next);
  assertEmptyChainedState(next);assertEmptyWheelOfFortuneState(next);assertEmptyBlackEmperorState(next);
  assertEmptyJusticiarState(next);assertEmptyMotherState(next);
  const originalFields={...next} as Record<string,unknown>;
  for(const root of addedAfter190)delete originalFields[root];
  originalFields.schemaVersion=old.schemaVersion;originalFields.contentVersion=old.contentVersion;
  expect(createHash('sha256').update(stableStringify(originalFields)).digest('hex'))
   .toBe(createHash('sha256').update(before).digest('hex'));
  expect(stableStringify(old)).toBe(before);expect(readFileSync(file).equals(bytes)).toBe(true);
  assertValidSliceState(next);expect(stableStringify(migrateSliceState(next))).toBe(stableStringify(next));
 },60_000);
 it('refuses future/missing/forged roots and bareS0 without actual history',()=>{const s=fresh();for(const patch of [{schemaVersion:CURRENT_SCHEMA_VERSION+1},{tyrant:null},{tyrant:{...s.tyrant,guidanceKnown:true}}])expect(()=>assertValidSliceState({...s,...patch})).toThrow();const missing={...s} as Record<string,unknown>;delete missing.tyrant;expect(()=>assertValidSliceState(missing)).toThrow();expect(()=>migrateSliceState({...raw(),tyrant:createTyrantState()})).toThrow();expect(()=>assertValidSliceState({...s,progression:{...s.progression,pathwayId:'tyrant',sequence:0}})).toThrow();},60_000);
 it('validates only typed commands without private authorization flags',()=>{expect(validateSlicePayload({type:'TYRANT',command:{type:'LEARN_GUIDANCE'}})).toBe(true);for(const command of [{type:'LEARN_GUIDANCE',skipValidation:true},{type:'CONSUME',compoundId:'x',confirmed:false},{type:'TRAVEL',to:'x',seed:'private'},{type:'UNKNOWN'}])expect(validateSlicePayload({type:'TYRANT',command})).toBe(false);});
});
