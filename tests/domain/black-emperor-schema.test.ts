import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createBlackEmperorState, validateBlackEmperorState } from '../../src/domain/black-emperor/index.js';
import { openBlackEmperorRuntimeSession } from '../../src/domain/black-emperor/owned-session.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { BLACK_EMPEROR_SOURCE_FILE, blackEmperorHash, authenticBlackEmperorSource,
  assertBlackEmperorSourceUnmodified } from '../helpers/black-emperor-scenario.js';

const fresh = (): SliceState => createSliceRun('black-emperor-schema', sliceDefaultCreationSelection, 'black-emperor-schema-seed');
const legacy223 = () => {
  const { blackEmperor: _root, ...state } = fresh();
  return { ...state, schemaVersion: 223 as const, contentVersion: 'wheel-of-fortune-v223' as const };
};

describe('BlackEmperor schema224 exact additive admission', () => {
  it('adds one exact empty root and preserves every older field and input', () => {
    const state = fresh(), old = legacy223(), before = structuredClone(old);
    expect([state.schemaVersion, state.contentVersion]).toEqual([224, 'black-emperor-v224']);
    assertEmptyBlackEmperorState(state);
    expect(validateBlackEmperorState(state)).toBe(true);
    expect(() => openBlackEmperorRuntimeSession(state)).toThrow();
    const migrated = migrateSliceState(old);
    expect(Object.keys(migrated).sort()).toEqual([...Object.keys(old), 'blackEmperor'].sort());
    assertEmptyBlackEmperorState(migrated);
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
      { ...state, futureChapter: {} }, { ...state, schemaVersion: 225 }, { ...state, contentVersion: 'wheel-of-fortune-v223' },
      { ...old, blackEmperor: createBlackEmperorState() }, { ...old, blackEmperor: undefined },
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
