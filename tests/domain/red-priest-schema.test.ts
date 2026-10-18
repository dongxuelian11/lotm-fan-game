import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { createFoolState, validateFoolState } from '../../src/domain/fool/index.js';
import { createRedPriestState, validateRedPriestState } from '../../src/domain/red-priest/index.js';
import { createVisionaryState, validateVisionaryState } from '../../src/domain/visionary/index.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedFoolSlice, openValidatedRedPriestSlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const fresh = (): SliceState => createSliceRun('red-priest-schema', sliceDefaultCreationSelection, 'red-priest-schema');
const same = (a: unknown, b: unknown): void => expect(stableStringify(a)).toBe(stableStringify(b));
const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const foolCapture = {
  path: 'tests/fixtures/fool-v02080/natural.json',
  sha256: '8bc3141286c3ecb603410d36c4f2111ea28b3a423b6f28c44127ef16aaf72959',
};
const historicalSnapshots = {
  203: {
    path: 'tests/fixtures/hand-of-order-v02060/snapshot-departure.json',
    sha256: '9642a97ab35ccde9af313abd2a588f8d8cb15ed707fd75fd47b0ee5f8261e38e',
    contentVersion: 'hand-of-order-v203', revision: 595, week: 135,
  },
  204: {
    path: 'tests/fixtures/nature-walker-v02070/snapshot-departure.json',
    sha256: 'bea36d46cfb943ef508bf6ee948f1f8c3845c6f82dee32258c128c4f0d41679e',
    contentVersion: 'nature-walker-v204', revision: 852, week: 212,
  },
} as const;
const introducedRoots = {
  203: ['natureWalker', 'fool', 'redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant'],
  204: ['fool', 'redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant'],
  205: ['redPriest', 'visionary', 'perfecter', 'moon', 'darkness', 'whiteTower', 'tyrant'],
} as const;
const historicalStates = new Map<203 | 204 | 205, Record<string, unknown>>();
function legacy(version: 203 | 204 | 205): Record<string, unknown> {
  let captured = historicalStates.get(version);
  if (!captured) {
    // Original inputs are recoverable from the published test-inputs manifest.
    // Read their actual historical shape; never downgrade a fresh current save.
    if (version === 205) {
      // Stream only the final state, not the large natural capture's other trees.
      expect(hash(readFileSync(foolCapture.path))).toBe(foolCapture.sha256);
      captured = readObjectEntry<Record<string, unknown>>(foolCapture.path, 'final');
      expect(sha256Hex(stableStringify(captured))).toBe('66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a');
      expect([captured.schemaVersion, captured.contentVersion, captured.revision, captured.week]).toEqual([205, 'fool-v205', 2084, 16006]);
    } else {
      const source = historicalSnapshots[version], bytes = readFileSync(source.path, 'utf8');
      expect(sha256Hex(bytes)).toBe(source.sha256);
      captured = JSON.parse(bytes) as Record<string, unknown>;
      expect([captured.schemaVersion, captured.contentVersion, captured.revision, captured.week]).toEqual(
        [version, source.contentVersion, source.revision, source.week],
      );
    }
    for (const root of introducedRoots[version]) expect(Object.hasOwn(captured, root)).toBe(false);
    historicalStates.set(version, captured);
  }
  return structuredClone(captured);
}

describe('Red Priest exact slice schema and migration boundary', () => {
  it('creates the exact current empty root and returns a detached current save', () => {
    const input = fresh(), bytes = stableStringify(input), copy = migrateSliceState(input);
    expect([input.schemaVersion, input.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(input.redPriest, createRedPriestState()); same(input.tyrant, createTyrantState()); same(input, copy);
    expect(copy).not.toBe(input); expect(copy.redPriest).not.toBe(input.redPriest);
    expect(copy.tyrant).not.toBe(input.tyrant);
    expect(stableStringify(input)).toBe(bytes); assertValidSliceState(copy);
  });

  it('migrates 205 by adding only exact missing roots, preserving every old field', () => {
    const input = legacy(205), bytes = stableStringify(input), migrated = migrateSliceState(input), defaults = fresh();
    expect([input.schemaVersion, input.contentVersion]).toEqual([205, 'fool-v205']);
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    const additions = Object.keys(migrated).filter(key => !Object.hasOwn(input, key));
    expect(additions.sort()).toEqual([...introducedRoots[205]].sort());
    expect(Object.keys(migrated).sort()).toEqual([...Object.keys(input), ...introducedRoots[205]].sort());
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') same(migrated[key as keyof SliceState], value);
    }
    for (const key of introducedRoots[205]) same(migrated[key], defaults[key]);
    same(migrated.redPriest, createRedPriestState()); same(migrated.fool, input.fool);
    same(migrated.visionary, createVisionaryState()); same(migrated.tyrant, createTyrantState());
    expect(stableStringify(input)).toBe(bytes);
    expect(hash(readFileSync(foolCapture.path))).toBe(foolCapture.sha256);
  }, 120_000);

  it.each([203, 204] as const)('preserves the %i migration and adds only exact missing defaults', version => {
    const input = legacy(version), bytes = stableStringify(input), migrated = migrateSliceState(input), defaults = fresh();
    expect([input.schemaVersion, input.contentVersion]).toEqual([version, version === 204 ? 'nature-walker-v204' : 'hand-of-order-v203']);
    expect([migrated.schemaVersion, migrated.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(migrated).filter(key => !Object.hasOwn(input, key)).sort()).toEqual(
      [...introducedRoots[version]].sort(),
    );
    expect(Object.keys(migrated).sort()).toEqual([...Object.keys(input), ...introducedRoots[version]].sort());
    for (const [key, value] of Object.entries(input)) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') same(migrated[key as keyof SliceState], value);
    }
    for (const key of introducedRoots[version]) same(migrated[key], defaults[key]);
    same(migrated.fool, createFoolState()); same(migrated.redPriest, createRedPriestState());
    same(migrated.visionary, createVisionaryState()); same(migrated.tyrant, createTyrantState());
    expect(stableStringify(input)).toBe(bytes);
    expect(hash(readFileSync(historicalSnapshots[version].path))).toBe(historicalSnapshots[version].sha256);
  }, 60_000);

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

  it.each([203, 204, 205] as const)('rejects a Tyrant root smuggled into legacy %i without discarding it', version => {
    const original = legacy(version), empty = createTyrantState();
    for (const tyrant of [empty, { ...empty, guidanceKnown: true }, null]) {
      const input = { ...original, tyrant }, bytes = stableStringify(input);
      expect(() => migrateSliceState(input)).toThrow('Unexpected Tyrant state');
      expect(stableStringify(input)).toBe(bytes);
    }
  });

  it('rejects incorrect versions, unknown roots and missing current fields without repairs', () => {
    const current = fresh(), missing = structuredClone(current) as unknown as Record<string, unknown>;
    delete missing.redPriest;
    const missingTyrant = structuredClone(current) as unknown as Record<string, unknown>;
    delete missingTyrant.tyrant;
    const badInputs = [missing, missingTyrant, { ...legacy(205), contentVersion: 'fool-v204' },
      { ...current, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, { ...current, contentVersion: 'red-priest-v206' },
      { ...current, redPriest: { ...current.redPriest, skipValidation: true } },
      { ...current, tyrant: { ...current.tyrant, skipValidation: true } },
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
