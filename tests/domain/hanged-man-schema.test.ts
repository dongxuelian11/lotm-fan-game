import { assertEmptyHangedManState } from '../helpers/empty-hanged-man-capture.js';
import { assertEmptyAbyssState } from '../helpers/empty-abyss-capture.js';
import { assertEmptyChainedState } from '../helpers/empty-chained-capture.js';
import { assertEmptyWheelOfFortuneState } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState } from '../helpers/empty-mother-capture.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createAbyssState } from '../../src/domain/abyss/index.js';
import { createHangedManState, validateHangedManState } from '../../src/domain/hanged-man/index.js';
import { openHangedManRuntimeSession } from '../../src/domain/hanged-man/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';

const fresh = (): SliceState => createSliceRun('hangedMan-schema-run', sliceDefaultCreationSelection, 'hangedMan-schema-seed');
const ADDITIVE_ROOTS = ['hangedMan', 'abyss', 'chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;
const stateHash = (state: unknown): string => sha256Hex(stableStringify(state));
const historicalFields = (state: object) => Object.fromEntries(Object.entries(state)
  .filter(([key]) => !['schemaVersion', 'contentVersion', ...ADDITIVE_ROOTS].includes(key)));
const assertEmptyAdditiveRoots = (state: SliceState): void => {
  assertEmptyHangedManState(state);
  assertEmptyAbyssState(state);
  assertEmptyChainedState(state);
  assertEmptyWheelOfFortuneState(state);
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
};
const legacy219 = () => {
  const current = fresh();
  assertEmptyAdditiveRoots(current);
  const { hangedMan: _root, abyss: _abyss, chained: _chained, wheelOfFortune: _wheelOfFortune,
    blackEmperor: _blackEmperor, justiciar: _justiciar, mother: _mother, ...state } = current;
  return { ...state, schemaVersion: 219 as const, contentVersion: 'hermit-v219' as const };
};

describe('HangedMan schema220 exact additive admission', () => {
  it('creates the precise empty current root without granting session authority', () => {
    const state = fresh();
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.hangedMan).toStrictEqual(createHangedManState());
    expect(validateHangedManState(state)).toBe(true);
    expect(() => assertValidSliceState(state)).not.toThrow();
    expect(() => openHangedManRuntimeSession(state)).toThrow();
  });

  it('upgrades219 by adding only seven explicit empty roots and format while preserving every old-field hash', () => {
    const source = legacy219(), before = structuredClone(source), originalFieldsHash = stateHash(historicalFields(source));
    const current = migrateSliceState(source);
    assertEmptyAdditiveRoots(current);
    expect(stateHash(historicalFields(current))).toBe(originalFieldsHash);
    expect(source).toStrictEqual(before);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(source), ...ADDITIVE_ROOTS].sort());
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(current.hangedMan).toStrictEqual(createHangedManState());
    expect(current.abyss).toStrictEqual(createAbyssState());
    for (const [key, value] of Object.entries(source)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(stateHash(current[key as keyof SliceState]), `Changed original ${key}`).toBe(stateHash(value));
    }
    expect(current.demoness).not.toBe(source.demoness);
    expect(() => assertValidSliceState(current)).not.toThrow();
  });

  it('rejects missing, altered, injected, unknown and future fields without repairing the input', () => {
    const current = fresh(), legacy = legacy219(), { hangedMan: _root, ...missing } = current;
    for (const root of ADDITIVE_ROOTS) {
      for (const value of [current[root], undefined, null, { ...current[root], guidanceKnown: true }]) {
        const invalid = { ...legacy, [root]: value }, before = structuredClone(invalid);
        expect(() => migrateSliceState(invalid), `Injected legacy219 root ${root}`).toThrow();
        expect(invalid).toStrictEqual(before);
      }
    }
    for (const invalid of [
      missing,
      { ...current, hangedMan: undefined },
      { ...current, hangedMan: null },
      { ...current, hangedMan: { ...current.hangedMan, authority: true } },
      { ...current, hangedMan: { ...current.hangedMan, unknown: undefined } },
      { ...current, futureChapter: {} },
      { ...current, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
      { ...current, contentVersion: 'future-v219' },
      { ...current, contentVersion: 'hermit-v219' },
      { ...legacy, hangedMan: createHangedManState() },
      { ...legacy, hangedMan: undefined },
      { ...legacy, futureChapter: {} },
      { ...legacy, contentVersion: CURRENT_CONTENT_VERSION },
      { ...legacy, demoness: { ...legacy.demoness, forged: true } },
    ]) {
      const before = structuredClone(invalid);
      expect(() => migrateSliceState(invalid)).toThrow();
      expect(invalid).toStrictEqual(before);
    }
  });

  it('rejects backdated recovery ownership extensions in219',()=>{
    const legacy=legacy219();
    for(const darkAngel of [
      {...legacy.darkAngel,resupply:{...legacy.darkAngel.resupply,recovery:null}},
      {...legacy.darkAngel,bottles:legacy.darkAngel.bottles.map((b,i)=>i===0?{...b,recovery:null}:b)},
    ])expect(()=>migrateSliceState({...legacy,darkAngel})).toThrow();
  });

  it('rejects forged guidance and HangedMan S0 without a genuine chapter history', () => {
    const guidance = fresh(); guidance.hangedMan.guidanceKnown = true;
    expect(validateHangedManState(guidance)).toBe(false);
    expect(() => assertValidSliceState(guidance)).toThrow();
    expect(() => openHangedManRuntimeSession(guidance)).toThrow();
    for (const spirituality of [15, 150]) {
      const promoted = fresh();
      promoted.progression.pathwayId = 'hanged-man'; promoted.progression.sequence = 0;
      promoted.progression.acting = 100; promoted.spirituality = spirituality;
      expect(validateHangedManState(promoted)).toBe(false);
      expect(() => assertValidSliceState(promoted)).toThrow();
      expect(() => migrateSliceState(promoted)).toThrow();
      expect(() => openHangedManRuntimeSession(promoted)).toThrow();
    }
  });

  it('accepts exact typed intent but rejects host state, skip flags and injected resources', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'WORK' }, { type: 'REST' },
      { type: 'CLINIC' }, { type: 'NEXT_WEEK' }, { type: 'RETURN_ON_FOOT' },
      { type: 'STABILIZE_PROMOTION', compoundId: 'hangedMan-compound-1' },
      { type: 'CONSUME', compoundId: 'hangedMan-compound-1', confirmed: true },
    ]) expect(validateSlicePayload({ type: 'HANGED_MAN', command })).toBe(true);
    for (const payload of [
      { type: 'HANGED_MAN', command: { type: 'WORK', cash: 100 } },
      { type: 'HANGED_MAN', command: { type: 'TRAVEL', to: 'NOT-A-PLACE' } },
      { type: 'HANGED_MAN', command: { type: 'CONSUME', compoundId: 'hangedMan-compound-1', confirmed: false } },
      { type: 'HANGED_MAN', command: { type: 'WORK' }, skipValidation: true },
      { type: 'HANGED_MAN', command: { type: 'WORK' }, ownedHead: {} },
      { type: 'HANGED_MAN', command: { type: 'WORK' }, source: {} },
      { type: 'HANGED_MAN', command: { type: 'PASSAGE', command: { type: 'UNRECOGNIZED_ACTION' } } },
    ]) expect(validateSlicePayload(payload)).toBe(false);
  });
});
