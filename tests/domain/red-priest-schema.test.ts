import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createFoolState, validateFoolState } from '../../src/domain/fool/index.js';
import { createRedPriestState, validateRedPriestState } from '../../src/domain/red-priest/index.js';
import { createVisionaryState, validateVisionaryState } from '../../src/domain/visionary/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedFoolSlice, openValidatedRedPriestSlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const fresh = (): SliceState => createSliceRun('red-priest-schema', sliceDefaultCreationSelection, 'red-priest-schema');
const same = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
function legacy(version: 203 | 204 | 205): Record<string, unknown> {
  const old = structuredClone(fresh()) as unknown as Record<string, unknown>;
  delete old.visionary;
  delete old.redPriest;
  if (version < 205) delete old.fool;
  if (version < 204) delete old.natureWalker;
  old.schemaVersion = version;
  old.contentVersion = version === 205 ? 'fool-v205' : version === 204 ? 'nature-walker-v204' : 'hand-of-order-v203';
  return old;
}

describe('Red Priest exact slice schema and migration boundary', () => {
  it('creates the exact current empty root and returns a detached current save', () => {
    const input = fresh(), bytes = stableStringify(input), copy = migrateSliceState(input);
    expect([input.schemaVersion, input.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(input.redPriest, createRedPriestState()); same(input, copy);
    expect(copy).not.toBe(input); expect(copy.redPriest).not.toBe(input.redPriest);
    expect(stableStringify(input)).toBe(bytes); assertValidSliceState(copy);
  });

  it('migrates 205 by adding only exact missing roots, preserving every old field', () => {
    const input = legacy(205), bytes = stableStringify(input), migrated = migrateSliceState(input);
    expect([input.schemaVersion, input.contentVersion]).toEqual([205, 'fool-v205']);
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(migrated).filter(key => !Object.hasOwn(input, key)).sort()).toEqual(['redPriest', 'visionary']);
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') same(migrated[key as keyof SliceState], value);
    }
    same(migrated.redPriest, createRedPriestState()); same(migrated.fool, input.fool);
    same(migrated.visionary, createVisionaryState());
    expect(stableStringify(input)).toBe(bytes);
  });

  it.each([203, 204] as const)('preserves the %i migration and adds only exact missing defaults', version => {
    const input = legacy(version), bytes = stableStringify(input), migrated = migrateSliceState(input), defaults = fresh();
    expect([input.schemaVersion, input.contentVersion]).toEqual([version, version === 204 ? 'nature-walker-v204' : 'hand-of-order-v203']);
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(migrated).filter(key => !Object.hasOwn(input, key)).sort()).toEqual(
      (version === 203 ? ['natureWalker', 'fool', 'redPriest', 'visionary'] : ['fool', 'redPriest', 'visionary']).sort(),
    );
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') same(migrated[key as keyof SliceState], value);
    }
    for (const key of Object.keys(migrated) as (keyof SliceState)[]) if (!Object.hasOwn(input, key)) same(migrated[key], defaults[key]);
    same(migrated.fool, createFoolState()); same(migrated.redPriest, createRedPriestState());
    same(migrated.visionary, createVisionaryState());
    expect(stableStringify(input)).toBe(bytes);
  });

  it.each([203, 204, 205] as const)('rejects a future root in legacy %i, even when it is empty', version => {
    const input = { ...legacy(version), redPriest: createRedPriestState() }, bytes = stableStringify(input);
    expect(() => migrateSliceState(input)).toThrow('Unexpected RedPriest state');
    expect(stableStringify(input)).toBe(bytes);
  });

  it.each([203, 204, 205] as const)('rejects a Visionary root smuggled into legacy %i, even when it is empty', version => {
    const input = { ...legacy(version), visionary: createVisionaryState() }, bytes = stableStringify(input);
    expect(() => migrateSliceState(input)).toThrow('Unexpected Visionary state');
    expect(stableStringify(input)).toBe(bytes);
  });

  it('rejects incorrect versions, unknown roots and missing current fields without repairs', () => {
    const current = fresh(), missing = structuredClone(current) as unknown as Record<string, unknown>;
    delete missing.redPriest;
    const badInputs = [missing, { ...legacy(205), contentVersion: 'fool-v204' },
      { ...current, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, { ...current, contentVersion: 'red-priest-v206' },
      { ...current, redPriest: { ...current.redPriest, skipValidation: true } },
      { ...legacy(205), unknownAuthority: {} }];
    for (const input of badInputs) {
      const bytes = stableStringify(input);
      expect(() => migrateSliceState(input)).toThrow(); expect(stableStringify(input)).toBe(bytes);
    }
  });

  it('permits an empty Fool root for other zero pathways but never fabricates their promotions', () => {
    const fake = fresh(); fake.progression.pathwayId = 'hunter'; fake.progression.sequence = 0;
    expect(validateFoolState(fake)).toBe(true); expect(validateRedPriestState(fake)).toBe(false);
    expect(() => assertValidSliceState(fake)).toThrow(); expect(() => openValidatedRedPriestSlice(fake)).toThrow();
    const other = structuredClone(fake); other.progression.pathwayId = 'audience';
    expect(validateFoolState(other)).toBe(true); expect(validateVisionaryState(other)).toBe(false);
    expect(() => assertValidSliceState(other)).toThrow();
    const diviner = structuredClone(fake); diviner.progression.pathwayId = 'diviner';
    expect(validateFoolState(diviner)).toBe(false); expect(() => assertValidSliceState(diviner)).toThrow();
  });

  it('never opens a retained head for an empty or supplied-source root', () => {
    const empty = fresh(), supplied = fresh();
    supplied.redPriest = { ...supplied.redPriest, guidanceKnown: true, source: {} } as SliceState['redPriest'];
    for (const input of [empty, supplied, {}, null]) {
      const bytes = stableStringify(input);
      expect(() => openValidatedRedPriestSlice(input)).toThrow();
      expect(() => openValidatedFoolSlice(input)).toThrow();
      expect(stableStringify(input)).toBe(bytes);
    }
  });

  it('accepts only exact public Red Priest intent fields', () => {
    const intent = { type: 'RED_PRIEST', command: { type: 'LEARN_GUIDANCE' } };
    expect(validateSlicePayload(intent)).toBe(true);
    expect(validateSlicePayload({ ...intent, engine: {} })).toBe(false);
    expect(validateSlicePayload({ ...intent, command: { type: 'LEARN_GUIDANCE', source: {} } })).toBe(false);
    expect(validateSlicePayload({ type: 'RED_PRIEST', command: { type: 'CONSUME', compoundId: 'original', confirmed: true, success: true } })).toBe(false);
  });
});
