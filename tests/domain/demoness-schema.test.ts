import { assertEmptyHermitState } from '../helpers/empty-hermit-capture.js';
import { assertEmptyHangedManState } from '../helpers/empty-hanged-man-capture.js';
import { assertEmptyAbyssState } from '../helpers/empty-abyss-capture.js';
import { assertEmptyChainedState } from '../helpers/empty-chained-capture.js';
import { assertEmptyWheelOfFortuneState } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState } from '../helpers/empty-mother-capture.js';
import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createDemonessState, validateDemonessState } from '../../src/domain/demoness/index.js';
import { openDemonessRuntimeSession } from '../../src/domain/demoness/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';

const fresh = (): SliceState => createSliceRun('demoness-schema-run', sliceDefaultCreationSelection, 'demoness-schema-seed');
const legacy217 = () => {
  const { demoness: _root, hermit: _hermit, hangedMan: _hangedMan, abyss: _abyss, chained: _chained,
    wheelOfFortune: _wheelOfFortune, blackEmperor: _blackEmperor, justiciar: _justiciar, mother: _mother, ...state } = fresh();
  return { ...state, schemaVersion: 217 as const, contentVersion: 'twilight-giant-v217' as const };
};

describe('Demoness schema218 exact additive admission', () => {
  it('creates the precise empty current root without granting session authority', () => {
    const state = fresh();
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.demoness).toStrictEqual(createDemonessState());
    expect(validateDemonessState(state)).toBe(true);
    expect(() => assertValidSliceState(state)).not.toThrow();
    expect(() => openDemonessRuntimeSession(state)).toThrow();
  });

  it('upgrades217 by adding only the explicit empty current roots and format while preserving all old fields', () => {
    const source = legacy217(), before = structuredClone(source), current = migrateSliceState(source);
    expect(source).toStrictEqual(before);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(source), 'demoness', 'hermit', 'hangedMan',
      'abyss', 'chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'].sort());
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(current.demoness).toStrictEqual(createDemonessState());
    assertEmptyHermitState(current); assertEmptyHangedManState(current); assertEmptyAbyssState(current); assertEmptyChainedState(current);
    assertEmptyWheelOfFortuneState(current); assertEmptyBlackEmperorState(current); assertEmptyJusticiarState(current); assertEmptyMotherState(current);
    for (const [key, value] of Object.entries(source)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(current[key as keyof SliceState], `Changed original ${key}`).toStrictEqual(value);
    }
    expect(current.twilightGiant).not.toBe(source.twilightGiant);
    expect(() => assertValidSliceState(current)).not.toThrow();
  });

  it('rejects missing, altered, injected, unknown and future fields without repairing the input', () => {
    const current = fresh(), legacy = legacy217(), { demoness: _root, ...missing } = current;
    for (const invalid of [
      missing,
      { ...current, demoness: undefined },
      { ...current, demoness: null },
      { ...current, demoness: { ...current.demoness, authority: true } },
      { ...current, demoness: { ...current.demoness, unknown: undefined } },
      { ...current, futureChapter: {} },
      { ...current, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
      { ...current, contentVersion: 'future-v219' },
      { ...current, contentVersion: 'twilight-giant-v217' },
      { ...legacy, demoness: createDemonessState() },
      { ...legacy, demoness: undefined },
      { ...legacy, futureChapter: {} },
      { ...legacy, contentVersion: CURRENT_CONTENT_VERSION },
      { ...legacy, twilightGiant: { ...legacy.twilightGiant, forged: true } },
    ]) {
      const before = structuredClone(invalid);
      expect(() => migrateSliceState(invalid)).toThrow();
      expect(invalid).toStrictEqual(before);
    }
  });

  it('cannot backdate same-original recovery or paid promotion support into217', () => {
    const legacy = legacy217();
    for (const apocalypseDemoness of [
      { ...legacy.apocalypseDemoness, promotionStability: { preparations: [] } },
      { ...legacy.apocalypseDemoness, resupply: { ...legacy.apocalypseDemoness.resupply, recovery: null } },
      { ...legacy.apocalypseDemoness, bottles: legacy.apocalypseDemoness.bottles.map((bottle, index) => index === 0 ? { ...bottle, recovery: null } : bottle) },
      { ...legacy.apocalypseDemoness, acquisitionJournal: [{ command: { type: 'STABILIZE_PROMOTION' } }] },
    ]) {
      const invalid = { ...legacy, apocalypseDemoness }, before = structuredClone(invalid);
      expect(() => migrateSliceState(invalid)).toThrow();
      expect(invalid).toStrictEqual(before);
    }
  });

  it('rejects forged guidance and Demoness S0 without a genuine chapter history', () => {
    const guidance = fresh(); guidance.demoness.guidanceKnown = true;
    expect(validateDemonessState(guidance)).toBe(false);
    expect(() => assertValidSliceState(guidance)).toThrow();
    expect(() => openDemonessRuntimeSession(guidance)).toThrow();
    for (const spirituality of [15, 150]) {
      const promoted = fresh();
      promoted.progression.pathwayId = 'demoness'; promoted.progression.sequence = 0;
      promoted.progression.acting = 100; promoted.spirituality = spirituality;
      expect(validateDemonessState(promoted)).toBe(false);
      expect(() => assertValidSliceState(promoted)).toThrow();
      expect(() => migrateSliceState(promoted)).toThrow();
      expect(() => openDemonessRuntimeSession(promoted)).toThrow();
    }
  });

  it('accepts exact typed intent but rejects host state, skip flags and injected resources', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'WORK' }, { type: 'REST' },
      { type: 'CLINIC' }, { type: 'NEXT_WEEK' }, { type: 'RETURN_ON_FOOT' },
      { type: 'STABILIZE_PROMOTION', compoundId: 'demoness-compound-1' },
      { type: 'CONSUME', compoundId: 'demoness-compound-1', confirmed: true },
    ]) expect(validateSlicePayload({ type: 'DEMONESS', command })).toBe(true);
    for (const payload of [
      { type: 'DEMONESS', command: { type: 'WORK', cash: 100 } },
      { type: 'DEMONESS', command: { type: 'TRAVEL', to: 'NOT-A-PLACE' } },
      { type: 'DEMONESS', command: { type: 'CONSUME', compoundId: 'demoness-compound-1', confirmed: false } },
      { type: 'DEMONESS', command: { type: 'WORK' }, skipValidation: true },
      { type: 'DEMONESS', command: { type: 'WORK' }, ownedHead: {} },
      { type: 'DEMONESS', command: { type: 'WORK' }, source: {} },
      { type: 'DEMONESS', command: { type: 'PASSAGE', command: { type: 'UNRECOGNIZED_ACTION' } } },
    ]) expect(validateSlicePayload(payload)).toBe(false);
  });
});
