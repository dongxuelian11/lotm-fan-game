import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState } from '../helpers/empty-mother-capture.js';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateWheelOfFortuneState } from '../../src/domain/wheel-of-fortune/index.js';
import { openWheelOfFortuneRuntimeSession } from '../../src/domain/wheel-of-fortune/owned-session.js';
import { assertEmptyWheelOfFortuneState } from '../helpers/empty-wheel-of-fortune-capture.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { WHEEL_OF_FORTUNE_SOURCE_FILE, wheelOfFortuneHash, authenticWheelOfFortuneSource,
  assertWheelOfFortuneSourceUnmodified } from '../helpers/wheel-of-fortune-scenario.js';

const fresh = (): SliceState => createSliceRun('wheel-of-fortune-schema', sliceDefaultCreationSelection, 'wheel-of-fortune-schema-seed');
const ADDITIVE_ROOTS = ['wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;
const assertEmptyAdditiveRoots = (state: SliceState): void => {
  assertEmptyWheelOfFortuneState(state); assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state); assertEmptyMotherState(state);
};
const legacy222 = () => {
  const current = fresh();
  assertEmptyAdditiveRoots(current);
  const { wheelOfFortune: _root, blackEmperor: _emperor, justiciar: _justiciar, mother: _mother, ...state } = current;
  return { ...state, schemaVersion: 222 as const, contentVersion: 'chained-v222' as const };
};

describe('WheelOfFortune schema223 exact additive admission', () => {
  it('adds exactly four empty roots to222 and preserves every older field and input', () => {
    const state = fresh(), old = legacy222(), before = structuredClone(old);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    assertEmptyAdditiveRoots(state);
    expect(validateWheelOfFortuneState(state)).toBe(true);
    expect(() => openWheelOfFortuneRuntimeSession(state)).toThrow();
    const migrated = migrateSliceState(old);
    expect(Object.keys(migrated).sort()).toEqual([...Object.keys(old), ...ADDITIVE_ROOTS].sort());
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    assertEmptyAdditiveRoots(migrated);
    for (const [key, value] of Object.entries(old)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(migrated[key as keyof SliceState], `Changed old root ${key}`).toStrictEqual(value);
    }
    expect(old).toStrictEqual(before);
    expect(migrated.chained).not.toBe(old.chained);
    expect(() => assertValidSliceState(migrated)).not.toThrow();
  });

  it('rejects missing or injected roots, future recovery and unsupported S0 markers', () => {
    const state = fresh(), old = legacy222(), { wheelOfFortune: _root, ...missing } = state;
    const invalids = [missing, { ...state, wheelOfFortune: undefined }, { ...state, wheelOfFortune: null },
      { ...state, wheelOfFortune: { ...state.wheelOfFortune, extra: undefined } },
      { ...state, futureChapter: {} }, { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, { ...state, contentVersion: 'chained-v222' },
      ...ADDITIVE_ROOTS.flatMap(key => [{ ...old, [key]: state[key] }, { ...old, [key]: undefined }]),
      { ...old, chained: { ...old.chained, forged: true } },
      { ...old, mercurySnake: { ...old.mercurySnake, resupply: { ...old.mercurySnake.resupply, recovery: null } } },
      { ...old, mercurySnake: { ...old.mercurySnake, acquisitionJournal: [{ command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'mercury-snake-potion-1' } }] } },
    ];
    for (const input of invalids) {
      const before = structuredClone(input);
      expect(() => migrateSliceState(input)).toThrow();
      expect(input).toStrictEqual(before);
    }
    for (const spirituality of [15, 150]) {
      const forged = fresh();
      forged.progression.pathwayId = 'wheel'; forged.progression.sequence = 0;
      forged.progression.acting = 100; forged.spirituality = spirituality;
      expect(validateWheelOfFortuneState(forged)).toBe(false);
      expect(() => assertValidSliceState(forged)).toThrow();
      expect(() => openWheelOfFortuneRuntimeSession(forged)).toThrow();
    }
    const guidance = fresh(); guidance.wheelOfFortune.guidanceKnown = true;
    expect(() => assertValidSliceState(guidance)).toThrow();
  });

  it('admits only narrow player commands and leaves the authentic841 endpoint unchanged', () => {
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'WORK' }, { type: 'REST' },
      { type: 'LEAVE_ORIGINAL_COURT' }, { type: 'CONSUME', compoundId: 'wheel-of-fortune-compound-1', confirmed: true }])
      expect(validateSlicePayload({ type: 'WHEEL_OF_FORTUNE', command })).toBe(true);
    for (const payload of [{ type: 'WHEEL_OF_FORTUNE', command: { type: 'REST', cash: 500 } },
      { type: 'WHEEL_OF_FORTUNE', command: { type: 'REST' }, skipValidation: true },
      { type: 'WHEEL_OF_FORTUNE', command: { type: 'CONSUME', compoundId: 'x', confirmed: true, roll: 1 } }])
      expect(validateSlicePayload(payload)).toBe(false);
    const raw = readObjectEntry<Record<string, unknown>>(WHEEL_OF_FORTUNE_SOURCE_FILE, 'final');
    const before = wheelOfFortuneHash(raw), current = authenticWheelOfFortuneSource(), defaults = fresh();
    expect(raw).toMatchObject({ schemaVersion: 201, contentVersion: 'mercury-snake-v201', revision: 842 });
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(wheelOfFortuneHash(current[key as keyof SliceState]), `Changed original841 ${key}`).toBe(wheelOfFortuneHash(value));
    }
    const added = Object.keys(current).filter(key => !Object.hasOwn(raw, key));
    expect(added.sort()).toEqual(['princeOfAbolition', 'handOfOrder', 'natureWalker', 'fool', 'redPriest',
      'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door',
      'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', 'chained', ...ADDITIVE_ROOTS].sort());
    assertEmptyAdditiveRoots(current);
    for (const key of added) expect(current[key as keyof SliceState]).toStrictEqual(defaults[key as keyof SliceState]);
    expect(wheelOfFortuneHash(raw)).toBe(before);
    expect(() => assertValidSliceState(current)).not.toThrow();
    expect(() => openWheelOfFortuneRuntimeSession(current)).toThrow();
    assertWheelOfFortuneSourceUnmodified();
  }, 120_000);
});
