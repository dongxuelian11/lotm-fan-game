import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createHangedManState, validateHangedManState } from '../../src/domain/hanged-man/index.js';
import { openHangedManRuntimeSession } from '../../src/domain/hanged-man/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';

const fresh = (): SliceState => createSliceRun('hangedMan-schema-run', sliceDefaultCreationSelection, 'hangedMan-schema-seed');
const legacy219 = () => {
  const { hangedMan: _root, ...state } = fresh();
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

  it('upgrades219 by adding only the empty root and format while preserving all old fields', () => {
    const source = legacy219(), before = structuredClone(source), current = migrateSliceState(source);
    expect(source).toStrictEqual(before);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(source), 'hangedMan'].sort());
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(current.hangedMan).toStrictEqual(createHangedManState());
    for (const [key, value] of Object.entries(source)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(current[key as keyof SliceState], `Changed original ${key}`).toStrictEqual(value);
    }
    expect(current.demoness).not.toBe(source.demoness);
    expect(() => assertValidSliceState(current)).not.toThrow();
  });

  it('rejects missing, altered, injected, unknown and future fields without repairing the input', () => {
    const current = fresh(), legacy = legacy219(), { hangedMan: _root, ...missing } = current;
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
