import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createBlackEmperorState, validateBlackEmperorState } from '../../src/domain/black-emperor/index.js';
import { openBlackEmperorRuntimeSession } from '../../src/domain/black-emperor/owned-session.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState } from '../helpers/empty-mother-capture.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { BLACK_EMPEROR_SOURCE_FILE, blackEmperorHash, authenticBlackEmperorSource,
  assertBlackEmperorSourceUnmodified } from '../helpers/black-emperor-scenario.js';

const fresh = (): SliceState => createSliceRun('black-emperor-schema', sliceDefaultCreationSelection, 'black-emperor-schema-seed');
const ADDITIVE_ROOTS = ['blackEmperor', 'justiciar', 'mother'] as const;
const assertEmptyAdditiveRoots = (state: SliceState): void => {
  assertEmptyBlackEmperorState(state);
  assertEmptyJusticiarState(state);
  assertEmptyMotherState(state);
};
const legacy223 = () => {
  const current = fresh();
  assertEmptyAdditiveRoots(current);
  const { blackEmperor: _root, justiciar: _justiciar, mother: _mother, ...state } = current;
  return { ...state, schemaVersion: 223 as const, contentVersion: 'wheel-of-fortune-v223' as const };
};
const historicalFields = (state: object) => Object.fromEntries(Object.entries(state)
  .filter(([key]) => !['schemaVersion', 'contentVersion', ...ADDITIVE_ROOTS].includes(key)));

describe('BlackEmperor schema223 migration to current exact additive admission', () => {
  it('adds exactly empty blackEmperor, justiciar and mother roots and preserves every older field and input', () => {
    const state = fresh(), old = legacy223(), before = structuredClone(old);
    const historicalHash = blackEmperorHash(historicalFields(old));
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    assertEmptyAdditiveRoots(state);
    expect(validateBlackEmperorState(state)).toBe(true);
    expect(() => openBlackEmperorRuntimeSession(state)).toThrow();
    const migrated = migrateSliceState(old);
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(migrated).sort()).toEqual([...Object.keys(old), ...ADDITIVE_ROOTS].sort());
    assertEmptyAdditiveRoots(migrated);
    expect(blackEmperorHash(historicalFields(migrated))).toBe(historicalHash);
    for (const [key, value] of Object.entries(old)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(migrated[key as keyof SliceState], `Changed old root ${key}`).toStrictEqual(value);
    }
    expect(old).toStrictEqual(before);
    expect(migrated.wheelOfFortune).not.toBe(old.wheelOfFortune);
    expect(() => assertValidSliceState(migrated)).not.toThrow();
  });

  it('rejects missing or injected roots, future recovery and unsupported S0 markers', () => {
    const state = fresh(), old = legacy223(), { blackEmperor: _root, ...missing } = state;
    const invalids = [missing, { ...state, blackEmperor: undefined }, { ...state, blackEmperor: null },
      { ...state, blackEmperor: { ...state.blackEmperor, extra: undefined } },
      { ...state, mother: { ...state.mother, guidanceKnown: true } },
      { ...state, mother: { ...state.mother, extra: undefined } },
      { ...state, futureChapter: {} }, { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, { ...state, contentVersion: 'wheel-of-fortune-v223' },
      { ...old, blackEmperor: createBlackEmperorState() }, { ...old, blackEmperor: undefined },
      { ...old, mother: state.mother }, { ...old, mother: undefined },
      { ...old, wheelOfFortune: { ...old.wheelOfFortune, forged: true } },
      { ...old, princeOfAbolition: { ...old.princeOfAbolition, resupply: { ...old.princeOfAbolition.resupply, recovery: null } } },
      { ...old, princeOfAbolition: { ...old.princeOfAbolition, acquisitionJournal: [{ command: { type: 'REQUEST_RECOVERY_V1', bottleId: 'prince-of-abolition-potion-1' } }] } },
    ];
    for (const input of invalids) {
      const before = structuredClone(input);
      expect(() => migrateSliceState(input)).toThrow();
      expect(input).toStrictEqual(before);
    }
    for (const spirituality of [15, 150]) {
      const forged = fresh();
      forged.progression.pathwayId = 'black-emperor'; forged.progression.sequence = 0;
      forged.progression.acting = 100; forged.spirituality = spirituality;
      expect(validateBlackEmperorState(forged)).toBe(false);
      expect(() => assertValidSliceState(forged)).toThrow();
      expect(() => openBlackEmperorRuntimeSession(forged)).toThrow();
    }
    const guidance = fresh(); guidance.blackEmperor.guidanceKnown = true;
    expect(() => assertValidSliceState(guidance)).toThrow();
  });

  it('admits only narrow player commands and leaves the authentic924 endpoint unchanged', () => {
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'WORK' }, { type: 'REST' },
      { type: 'LEAVE_ORIGINAL_COURT' }, { type: 'CONSUME', compoundId: 'black-emperor-compound-1', confirmed: true }])
      expect(validateSlicePayload({ type: 'BLACK_EMPEROR', command })).toBe(true);
    for (const payload of [{ type: 'BLACK_EMPEROR', command: { type: 'REST', cash: 500 } },
      { type: 'BLACK_EMPEROR', command: { type: 'REST' }, skipValidation: true },
      { type: 'BLACK_EMPEROR', command: { type: 'CONSUME', compoundId: 'x', confirmed: true, roll: 1 } }])
      expect(validateSlicePayload(payload)).toBe(false);
    const raw = readObjectEntry<Record<string, unknown>>(BLACK_EMPEROR_SOURCE_FILE, 'final');
    const before = blackEmperorHash(raw), current = authenticBlackEmperorSource(), defaults = fresh();
    assertEmptyAdditiveRoots(current);
    expect(raw).toMatchObject({ schemaVersion: 202, contentVersion: 'prince-of-abolition-v202', revision: 925 });
    for (const [key, value] of Object.entries(raw)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(blackEmperorHash(current[key as keyof SliceState]), `Changed original924 ${key}`).toBe(blackEmperorHash(value));
    }
    const added = Object.keys(current).filter(key => !Object.hasOwn(raw, key));
    expect(added).toContain('blackEmperor');
    for (const key of added) expect(current[key as keyof SliceState]).toStrictEqual(defaults[key as keyof SliceState]);
    expect(blackEmperorHash(raw)).toBe(before);
    expect(() => assertValidSliceState(current)).not.toThrow();
    expect(() => openBlackEmperorRuntimeSession(current)).toThrow();
    assertBlackEmperorSourceUnmodified();
  }, 120_000);
});
