import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { validateChainedState } from '../../src/domain/chained/index.js';
import { openChainedRuntimeSession } from '../../src/domain/chained/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { assertEmptyChainedState } from '../helpers/empty-chained-capture.js';
import { assertEmptyWheelOfFortuneState } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState } from '../helpers/empty-mother-capture.js';
import { CHAINED_SOURCE_FILE, chainedHash, authenticChainedSource, assertChainedSourceUnmodified } from '../helpers/chained-scenario.js';

const fresh = (): SliceState => createSliceRun('chained-schema-run', sliceDefaultCreationSelection, 'chained-schema-seed');
const ADDITIVE_ROOTS = ['chained', 'wheelOfFortune', 'blackEmperor', 'justiciar', 'mother'] as const;
const assertEmptyAdditiveRoots = (state: SliceState): void => {
  assertEmptyChainedState(state);
  assertEmptyWheelOfFortuneState(state);
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
};
const historicalFields = (state: object) => Object.fromEntries(Object.entries(state)
  .filter(([key]) => !['schemaVersion', 'contentVersion', ...ADDITIVE_ROOTS].includes(key)));
const legacy221 = () => {
  const current = fresh();
  assertEmptyAdditiveRoots(current);
  const { chained: _root, wheelOfFortune: _wheel, blackEmperor: _emperor, justiciar: _justiciar, mother: _mother, ...state } = current;
  return { ...state, schemaVersion: 221 as const, contentVersion: 'abyss-v221' as const };
};

describe('Chained schema221 migration to current exact additive admission', () => {
  it('adds exactly five empty roots to221 without changing any older field', () => {
    const state = fresh(), source = legacy221(), before = chainedHash(source);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    const historicalHash = chainedHash(historicalFields(source));
    assertEmptyAdditiveRoots(state);
    expect(validateChainedState(state)).toBe(true);
    expect(() => openChainedRuntimeSession(state)).toThrow();
    const current = migrateSliceState(source);
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(current).sort()).toEqual([...Object.keys(source), ...ADDITIVE_ROOTS].sort());
    assertEmptyAdditiveRoots(current);
    expect(chainedHash(historicalFields(current))).toBe(historicalHash);
    for (const [key, value] of Object.entries(source)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(current[key as keyof SliceState], `Changed original ${key}`).toStrictEqual(value);
    }
    expect(chainedHash(source)).toBe(before);
    expect(current.abyss).not.toBe(source.abyss);
    expect(() => assertValidSliceState(current)).not.toThrow();
  });

  it('rejects missing, forged and prematurely injected roots without repairing input', () => {
    const state = fresh(), old = legacy221(), { chained: _root, ...missing } = state;
    for (const invalid of [missing, { ...state, chained: undefined }, { ...state, chained: null },
      { ...state, chained: { ...state.chained, extra: undefined } }, { ...state, futureChapter: {} },
      { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, { ...state, contentVersion: 'abyss-v221' },
      ...ADDITIVE_ROOTS.flatMap(key => [{ ...old, [key]: state[key] }, { ...old, [key]: undefined }]),
      { ...state, mother: { ...state.mother, guidanceKnown: true } },
      { ...state, mother: { ...state.mother, extra: undefined } },
      { ...old, abyss: { ...old.abyss, forged: true } },
      { ...old, abomination: { ...old.abomination, resupply: { ...old.abomination.resupply, recovery: null } } },
      { ...old, abomination: { ...old.abomination, acquisitionJournal: [{ command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'abomination-potion-1' } }] } },
    ]) {
      const before = structuredClone(invalid);
      expect(() => migrateSliceState(invalid)).toThrow();
      expect(invalid).toStrictEqual(before);
    }
    for (const spirituality of [15, 150]) {
      const forged = fresh();
      forged.progression.pathwayId = 'chained'; forged.progression.sequence = 0;
      forged.progression.acting = 100; forged.spirituality = spirituality;
      expect(validateChainedState(forged)).toBe(false);
      expect(() => assertValidSliceState(forged)).toThrow();
      expect(() => openChainedRuntimeSession(forged)).toThrow();
    }
    const guidance = fresh(); guidance.chained.guidanceKnown = true;
    expect(() => assertValidSliceState(guidance)).toThrow();
  });

  it('admits narrow commands and preserves every original778 source field', () => {
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'REST' }, { type: 'BIND_ROPE' },
      { type: 'CONSUME', compoundId: 'chained-compound-1', confirmed: true }])
      expect(validateSlicePayload({ type: 'CHAINED', command })).toBe(true);
    for (const payload of [{ type: 'CHAINED', command: { type: 'REST', cash: 500 } },
      { type: 'CHAINED', command: { type: 'REST' }, skipValidation: true },
      { type: 'CHAINED', command: { type: 'CONSUME', compoundId: 'x', confirmed: true, roll: 1 } }])
      expect(validateSlicePayload(payload)).toBe(false);
    const raw = readObjectEntry<Record<string, unknown>>(CHAINED_SOURCE_FILE, 'final'), before = chainedHash(raw);
    const current = authenticChainedSource(), defaults = fresh();
    expect(raw).toMatchObject({ schemaVersion: 200, contentVersion: 'abomination-v200', revision: 779 });
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(chainedHash(current[key as keyof SliceState]), `Changed source778 ${key}`).toBe(chainedHash(value));
    }
    const added = Object.keys(current).filter(key => !Object.hasOwn(raw, key));
    expect(added.sort()).toEqual([
      'mercurySnake', 'princeOfAbolition', 'handOfOrder', 'natureWalker', 'fool', 'redPriest',
      'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death',
      'door', 'errorAscent', 'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', ...ADDITIVE_ROOTS,
    ].sort());
    assertEmptyAdditiveRoots(current);
    for (const key of added) expect(current[key as keyof SliceState]).toStrictEqual(defaults[key as keyof SliceState]);
    expect(chainedHash(raw)).toBe(before);
    expect(() => assertValidSliceState(current)).not.toThrow();
    expect(() => openChainedRuntimeSession(current)).toThrow();
    assertChainedSourceUnmodified();
  }, 120_000);
});
