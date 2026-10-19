import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createHermitState, validateHermitState } from '../../src/domain/hermit/index.js';
import { openHermitRuntimeSession } from '../../src/domain/hermit/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';

const fresh = (): SliceState => createSliceRun('hermit-schema-run', sliceDefaultCreationSelection, 'hermit-schema-seed');
const legacy218 = () => {
  const { hermit: _root, ...state } = fresh();
  return { ...state, schemaVersion: 218 as const, contentVersion: 'demoness-v218' as const };
};

describe('Hermit schema219 exact additive admission', () => {
  it('creates the precise empty current root without granting session authority', () => {
    const state = fresh();
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.hermit).toStrictEqual(createHermitState());
    expect(validateHermitState(state)).toBe(true);
    expect(() => assertValidSliceState(state)).not.toThrow();
    expect(() => openHermitRuntimeSession(state)).toThrow();
  });

  it('upgrades218 by adding only the empty root and format while preserving all old fields', () => {
    const source = legacy218(), before = structuredClone(source), current = migrateSliceState(source);
    expect(source).toStrictEqual(before);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(source), 'hermit'].sort());
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(current.hermit).toStrictEqual(createHermitState());
    for (const [key, value] of Object.entries(source)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(current[key as keyof SliceState], `Changed original ${key}`).toStrictEqual(value);
    }
    expect(current.demoness).not.toBe(source.demoness);
    expect(() => assertValidSliceState(current)).not.toThrow();
  });

  it('rejects missing, altered, injected, unknown and future fields without repairing the input', () => {
    const current = fresh(), legacy = legacy218(), { hermit: _root, ...missing } = current;
    for (const invalid of [
      missing,
      { ...current, hermit: undefined },
      { ...current, hermit: null },
      { ...current, hermit: { ...current.hermit, authority: true } },
      { ...current, hermit: { ...current.hermit, unknown: undefined } },
      { ...current, futureChapter: {} },
      { ...current, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
      { ...current, contentVersion: 'future-v219' },
      { ...current, contentVersion: 'demoness-v218' },
      { ...legacy, hermit: createHermitState() },
      { ...legacy, hermit: undefined },
      { ...legacy, futureChapter: {} },
      { ...legacy, contentVersion: CURRENT_CONTENT_VERSION },
      { ...legacy, demoness: { ...legacy.demoness, forged: true } },
    ]) {
      const before = structuredClone(invalid);
      expect(() => migrateSliceState(invalid)).toThrow();
      expect(invalid).toStrictEqual(before);
    }
  });

  it('rejects backdated recovery ownership extensions in218',()=>{
    const legacy=legacy218();
    for(const knowledgeEmperor of [
      {...legacy.knowledgeEmperor,resupply:{...legacy.knowledgeEmperor.resupply,recovery:null}},
      {...legacy.knowledgeEmperor,bottles:legacy.knowledgeEmperor.bottles.map((b,i)=>i===0?{...b,recovery:null}:b)},
    ])expect(()=>migrateSliceState({...legacy,knowledgeEmperor})).toThrow();
  });

  it('rejects forged guidance and Hermit S0 without a genuine chapter history', () => {
    const guidance = fresh(); guidance.hermit.guidanceKnown = true;
    expect(validateHermitState(guidance)).toBe(false);
    expect(() => assertValidSliceState(guidance)).toThrow();
    expect(() => openHermitRuntimeSession(guidance)).toThrow();
    for (const spirituality of [15, 150]) {
      const promoted = fresh();
      promoted.progression.pathwayId = 'hermit'; promoted.progression.sequence = 0;
      promoted.progression.acting = 100; promoted.spirituality = spirituality;
      expect(validateHermitState(promoted)).toBe(false);
      expect(() => assertValidSliceState(promoted)).toThrow();
      expect(() => migrateSliceState(promoted)).toThrow();
      expect(() => openHermitRuntimeSession(promoted)).toThrow();
    }
  });

  it('accepts exact typed intent but rejects host state, skip flags and injected resources', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'WORK' }, { type: 'REST' },
      { type: 'CLINIC' }, { type: 'NEXT_WEEK' }, { type: 'RETURN_ON_FOOT' },
      { type: 'STABILIZE_PROMOTION', compoundId: 'hermit-compound-1' },
      { type: 'CONSUME', compoundId: 'hermit-compound-1', confirmed: true },
    ]) expect(validateSlicePayload({ type: 'HERMIT', command })).toBe(true);
    for (const payload of [
      { type: 'HERMIT', command: { type: 'WORK', cash: 100 } },
      { type: 'HERMIT', command: { type: 'TRAVEL', to: 'NOT-A-PLACE' } },
      { type: 'HERMIT', command: { type: 'CONSUME', compoundId: 'hermit-compound-1', confirmed: false } },
      { type: 'HERMIT', command: { type: 'WORK' }, skipValidation: true },
      { type: 'HERMIT', command: { type: 'WORK' }, ownedHead: {} },
      { type: 'HERMIT', command: { type: 'WORK' }, source: {} },
      { type: 'HERMIT', command: { type: 'PASSAGE', command: { type: 'UNRECOGNIZED_ACTION' } } },
    ]) expect(validateSlicePayload(payload)).toBe(false);
  });
});
