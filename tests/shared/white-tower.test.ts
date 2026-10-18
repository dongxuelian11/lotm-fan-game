import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createWhiteTowerState } from '../../src/domain/white-tower/index.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedWhiteTowerSlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';


const CAPTURE = 'tests/fixtures/darkness-v02130/boundary-680-darkness-learn_guidance.json.gz';
const CAPTURE_SHA256 = '244055724e180d9629adc945354f0e5cbe5c9624fcbe06d765f0b95264dfc1f0';
const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const same = (actual: unknown, expected: unknown) => expect(stableStringify(actual)).toBe(stableStringify(expected));
const fresh = () => createSliceRun('whiteTower-schema', sliceDefaultCreationSelection, 'whiteTower-schema');
const raw210 = () => JSON.parse(gunzipSync(readFileSync(CAPTURE)).toString('utf8')).beforeLast as Record<string, unknown>;

describe('WhiteTower exact current schema and public command boundary', () => {
  it('creates one empty WhiteTower root and a detached strictly valid current save', () => {
    const state = fresh(), before = stableStringify(state), copy = migrateSliceState(state);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(state.whiteTower, createWhiteTowerState()); same(state.tyrant, createTyrantState()); same(copy, state);
    expect(copy).not.toBe(state); expect(copy.whiteTower).not.toBe(state.whiteTower);
    expect(copy.tyrant).not.toBe(state.tyrant);
    assertValidSliceState(copy); expect(stableStringify(state)).toBe(before);
  });

  it.each(['beforeLast', 'final'] as const)('migrates actual captured210 %s by adding exactly empty WhiteTower and Tyrant and preserving every old field and raw byte', key => {
    const bytes = readFileSync(CAPTURE), raw = JSON.parse(gunzipSync(readFileSync(CAPTURE)).toString('utf8'))[key] as Record<string, unknown>;
    expect(hash(bytes)).toBe(CAPTURE_SHA256);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([210, 'darkness-v210']);
    expect(Object.hasOwn(raw, 'whiteTower')).toBe(false); expect(Object.hasOwn(raw, 'tyrant')).toBe(false);
    const before = stableStringify(raw), next = migrateSliceState(raw);
    expect([next.schemaVersion, next.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(next).filter(field => !Object.hasOwn(raw, field)).sort()).toEqual(['tyrant', 'whiteTower']);
    expect(Object.keys(next).sort()).toEqual([...Object.keys(raw), 'whiteTower', 'tyrant'].sort());
    for (const [field, value] of Object.entries(raw)) {
      if (field !== 'schemaVersion' && field !== 'contentVersion') same(next[field as keyof SliceState], value);
    }
    same(next.whiteTower, createWhiteTowerState()); same(next.tyrant, createTyrantState()); same(migrateSliceState(next), next);
    expect(stableStringify(raw)).toBe(before);
    expect(hash(readFileSync(CAPTURE))).toBe(CAPTURE_SHA256);
    expect(readFileSync(CAPTURE).equals(bytes)).toBe(true);
  }, 60_000);

  it.each([
    ['whiteTower', createWhiteTowerState()], ['tyrant', createTyrantState()],
  ] as const)('rejects a future %s root in actual210 rather than silently discarding it', (key, empty) => {
    for (const root of [empty, { ...empty, guidanceKnown: true }, null]) {
      const raw = { ...raw210(), [key]: root }, before = stableStringify(raw);
      expect(() => migrateSliceState(raw)).toThrow(); expect(stableStringify(raw)).toBe(before);
    }
  }, 60_000);

  it('rejects missing roots, unknown authority, invalid nested roots and version mismatches without mutation', () => {
    const state = fresh(), missing = structuredClone(state) as unknown as Record<string, unknown>;
    delete missing.whiteTower;
    const missingTyrant = structuredClone(state) as unknown as Record<string, unknown>;
    delete missingTyrant.tyrant;
    for (const value of [missing, missingTyrant,
      { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
      { ...state, contentVersion: 'darkness-v210' },
      { ...raw210(), contentVersion: CURRENT_CONTENT_VERSION },
      { ...state, whiteTower: { ...state.whiteTower, skipValidation: true } },
      { ...state, whiteTower: { ...state.whiteTower, journal: [{ type: 'SUCCESS' }] } },
      { ...state, tyrant: { ...state.tyrant, skipValidation: true } },
      { ...state, callerAuthority: {} },
    ]) {
      const before = stableStringify(value);
      expect(() => migrateSliceState(value)).toThrow(); expect(stableStringify(value)).toBe(before);
    }
  });

  it('cannot mint an owned WhiteTower head or S0 authority from empty or caller-authored roots', () => {
    const state = fresh(), fake = structuredClone(state);
    fake.progression.pathwayId = 'white-tower'; fake.progression.sequence = 0; fake.spirituality = 150;
    expect(() => assertValidSliceState(fake)).toThrow();
    for (const value of [state, fake, { ...state, whiteTower: { ...state.whiteTower, guidanceKnown: true, source: {} } }, null]) {
      expect(() => openValidatedWhiteTowerSlice(value)).toThrow();
    }
  });

  it('accepts exact public commands and rejects supplied sources, outcomes, costs and private handles', () => {
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'REST' }, { type: 'NEXT_WEEK' },
      { type: 'CONSUME', compoundId: 'white-tower-compound-1', confirmed: true }]) {
      expect(validateSlicePayload({ type: 'WHITE_TOWER', command })).toBe(true);
    }
    for (const value of [
      { type: 'WHITE_TOWER', command: { type: 'LEARN_GUIDANCE' }, engine: {} },
      { type: 'WHITE_TOWER', command: { type: 'LEARN_GUIDANCE', source: {} } },
      { type: 'WHITE_TOWER', command: { type: 'REST', cash: 1000 } },
      { type: 'WHITE_TOWER', command: { type: 'CONSUME', compoundId: 'white-tower-compound-1', confirmed: true, success: true } },
      { type: 'WHITE_TOWER', command: { type: 'CONSUME', compoundId: 'white-tower-compound-1', confirmed: false } },
      { type: 'WHITE_TOWER', command: { type: 'REST' }, skipValidation: true },
      { type: 'WHITE_TOWER', command: { type: 'MATERIAL', command: { type: 'ACQUIRE_CHARACTERISTIC', characteristicId: 'invented', price: 0 } } },
    ]) expect(validateSlicePayload(value)).toBe(false);
  });
});
