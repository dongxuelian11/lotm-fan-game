import { assertEmptyHermitState } from '../helpers/empty-hermit-capture.js';
import { assertEmptyHangedManState } from '../helpers/empty-hanged-man-capture.js';
import { assertEmptyAbyssState } from '../helpers/empty-abyss-capture.js';
import { assertEmptyChainedState } from '../helpers/empty-chained-capture.js';
import { assertEmptyWheelOfFortuneState } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState } from '../helpers/empty-mother-capture.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyDemonessState } from '../helpers/empty-demoness-capture.js';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createTwilightGiantState, validateTwilightGiantState } from '../../src/domain/twilight-giant/index.js';
import { openTwilightGiantRuntimeSession } from '../../src/domain/twilight-giant/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';

const fresh = (): SliceState => createSliceRun('twilight-schema-run', sliceDefaultCreationSelection, 'twilight-schema-seed');
const ADDITIVE_ROOTS = ['twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', 'chained',
  'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;
const assertEmptyAdditiveRoots = (state: SliceState): void => {
  expect(state.twilightGiant).toStrictEqual(createTwilightGiantState()); assertEmptyDemonessState(state);
  assertEmptyHermitState(state); assertEmptyHangedManState(state); assertEmptyAbyssState(state); assertEmptyChainedState(state);
  assertEmptyWheelOfFortuneState(state); assertEmptyBlackEmperorState(state); assertEmptyJusticiarState(state); assertEmptyMotherState(state);
};
const legacy216 = () => {
  const current = fresh();
  assertEmptyAdditiveRoots(current);
  const { twilightGiant: _root, demoness: _demoness, hermit: _hermit, hangedMan: _hangedMan, abyss: _abyss,
    chained: _chained, wheelOfFortune: _wheel, blackEmperor: _emperor, justiciar: _justiciar, mother: _mother, ...state } = current;
  return { ...state, schemaVersion: 216 as const, contentVersion: 'error-ascent-v216' as const };
};

describe('TwilightGiant schema217 exact additive admission', () => {
  it('creates the precise empty current root without granting session authority', () => {
    const state = fresh();
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.twilightGiant).toStrictEqual(createTwilightGiantState());
    expect(validateTwilightGiantState(state)).toBe(true);
    expect(() => assertValidSliceState(state)).not.toThrow();
    expect(() => openTwilightGiantRuntimeSession(state)).toThrow();
  });

  it('upgrades216 by adding only the explicit empty roots and format while preserving all old fields', () => {
    const source = legacy216(), before = structuredClone(source), current = migrateSliceState(source);
    expect(source).toStrictEqual(before);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(source), ...ADDITIVE_ROOTS].sort());
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(current.twilightGiant).toStrictEqual(createTwilightGiantState());
    assertEmptyAdditiveRoots(current);
    for (const [key, value] of Object.entries(source)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(current[key as keyof SliceState], `Changed original ${key}`).toStrictEqual(value);
    }
    expect(current.errorAscent).not.toBe(source.errorAscent);
    expect(() => assertValidSliceState(current)).not.toThrow();
  });

  it('rejects missing, altered, injected, unknown and future fields without repairing the input', () => {
    const current = fresh(), legacy = legacy216(), { twilightGiant: _root, ...missing } = current;
    for (const invalid of [
      missing,
      { ...current, twilightGiant: undefined },
      { ...current, twilightGiant: null },
      { ...current, twilightGiant: { ...current.twilightGiant, authority: true } },
      { ...current, twilightGiant: { ...current.twilightGiant, unknown: undefined } },
      { ...current, futureChapter: {} },
      { ...current, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
      { ...current, contentVersion: `future-v${CURRENT_SCHEMA_VERSION + 1}` },
      { ...current, contentVersion: 'error-ascent-v216' },
      ...ADDITIVE_ROOTS.flatMap(key => [{ ...legacy, [key]: current[key] }, { ...legacy, [key]: undefined }]),
      { ...legacy, futureChapter: {} },
      { ...legacy, contentVersion: 'twilight-giant-v217' },
      { ...legacy, errorAscent: { ...legacy.errorAscent, forged: true } },
    ]) {
      const before = structuredClone(invalid);
      expect(() => migrateSliceState(invalid)).toThrow();
      expect(invalid).toStrictEqual(before);
    }
  });

  it('rejects forged guidance and warrior S0 without a genuine chapter history', () => {
    const guidance = fresh(); guidance.twilightGiant.guidanceKnown = true;
    expect(validateTwilightGiantState(guidance)).toBe(false);
    expect(() => assertValidSliceState(guidance)).toThrow();
    expect(() => openTwilightGiantRuntimeSession(guidance)).toThrow();
    for (const spirituality of [15, 150]) {
      const promoted = fresh();
      promoted.progression.pathwayId = 'warrior'; promoted.progression.sequence = 0;
      promoted.progression.acting = 100; promoted.spirituality = spirituality;
      expect(validateTwilightGiantState(promoted)).toBe(false);
      expect(() => assertValidSliceState(promoted)).toThrow();
      expect(() => migrateSliceState(promoted)).toThrow();
      expect(() => openTwilightGiantRuntimeSession(promoted)).toThrow();
    }
  });

  it('accepts exact typed intent but rejects host state, skip flags and injected resources', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'WORK' }, { type: 'REST' },
      { type: 'CLINIC' }, { type: 'NEXT_WEEK' }, { type: 'RETURN_ON_FOOT' },
      { type: 'STABILIZE_PROMOTION', compoundId: 'twilight-giant-compound-1' },
      { type: 'CONSUME', compoundId: 'twilight-giant-compound-1', confirmed: true },
    ]) expect(validateSlicePayload({ type: 'TWILIGHT_GIANT', command })).toBe(true);
    for (const payload of [
      { type: 'TWILIGHT_GIANT', command: { type: 'WORK', cash: 100 } },
      { type: 'TWILIGHT_GIANT', command: { type: 'TRAVEL', to: 'NOT-A-PLACE' } },
      { type: 'TWILIGHT_GIANT', command: { type: 'CONSUME', compoundId: 'twilight-giant-compound-1', confirmed: false } },
      { type: 'TWILIGHT_GIANT', command: { type: 'WORK' }, skipValidation: true },
      { type: 'TWILIGHT_GIANT', command: { type: 'WORK' }, ownedHead: {} },
      { type: 'TWILIGHT_GIANT', command: { type: 'WORK' }, source: {} },
      { type: 'TWILIGHT_GIANT', command: { type: 'WORKS', command: { type: 'UNRECOGNIZED_ACTION' } } },
    ]) expect(validateSlicePayload(payload)).toBe(false);
  });
});
