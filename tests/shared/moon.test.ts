import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { createMoonState } from '../../src/domain/moon/index.js';
import { createDarknessState } from '../../src/domain/darkness/index.js';
import { createWhiteTowerState } from '../../src/domain/white-tower/index.js';
import { createTyrantState } from '../../src/domain/tyrant/index.js';
import { createSunState } from '../../src/domain/sun/index.js';
import { createDeathState } from '../../src/domain/death/index.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { assertValidSliceState, openValidatedMoonSlice, validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { assertEmptyDoorState } from '../helpers/empty-death-capture.js';
import { assertEmptyErrorAscentState } from '../helpers/empty-error-ascent-capture.js';
import { assertEmptyTwilightGiantState } from '../helpers/empty-twilight-giant-capture.js';
import { assertEmptyDemonessState } from '../helpers/empty-demoness-capture.js';
import { assertEmptyHermitState } from '../helpers/empty-hermit-capture.js';
import { assertEmptyHangedManState } from '../helpers/empty-hanged-man-capture.js';
import { assertEmptyAbyssState } from '../helpers/empty-abyss-capture.js';
import { assertEmptyChainedState } from '../helpers/empty-chained-capture.js';
import { assertEmptyWheelOfFortuneState } from '../helpers/empty-wheel-of-fortune-capture.js';
import { assertEmptyBlackEmperorState } from '../helpers/empty-black-emperor-capture.js';
import { assertEmptyJusticiarState } from '../helpers/empty-justiciar-capture.js';
import { assertEmptyMotherState } from '../helpers/empty-mother-capture.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const CAPTURE = 'tests/fixtures/perfecter-v02110/boundary-798-learn_guidance.json';
const CAPTURE_SHA256 = '7c713fd6b70b4fd6c6a5eb9d0abe1eb782912260673db9319ecc4f2fba64f4f7';
const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const same = (actual: unknown, expected: unknown) => expect(stableStringify(actual)).toBe(stableStringify(expected));
const fresh = () => createSliceRun('moon-schema', sliceDefaultCreationSelection, 'moon-schema');
const raw208 = () => readObjectEntry<Record<string, unknown>>(CAPTURE, 'beforeLast');

describe('Moon exact current schema and public command boundary', () => {
  it('rejects a missing, nonempty or extended current Death root', () => {
    const state = fresh(), { death: _missingDeath, ...missing } = state;
    for (const value of [missing, { ...state, death: null },
      { ...state, death: { ...state.death, guidanceKnown: true } },
      { ...state, death: { ...state.death, unexpectedField: true } }]) {
      const before = stableStringify(value);
      expect(() => migrateSliceState(value)).toThrow(); expect(stableStringify(value)).toBe(before);
    }
  });

  it('creates one empty Moon root and a detached strictly valid current save', () => {
    const state = fresh(), before = stableStringify(state), copy = migrateSliceState(state);
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.moon).toStrictEqual(createMoonState());
    expect(state.darkness).toStrictEqual(createDarknessState());
    expect(state.whiteTower).toStrictEqual(createWhiteTowerState());
    expect(state.tyrant).toStrictEqual(createTyrantState());
    expect(state.sun).toStrictEqual(createSunState());expect(state.death).toStrictEqual(createDeathState());
    same(copy, state);
    expect(copy).not.toBe(state); expect(copy.moon).not.toBe(state.moon);
    expect(copy.darkness).not.toBe(state.darkness); expect(copy.whiteTower).not.toBe(state.whiteTower);
    expect(copy.tyrant).not.toBe(state.tyrant); expect(copy.sun).not.toBe(state.sun);expect(copy.death).not.toBe(state.death);
    assertValidSliceState(copy); expect(stableStringify(state)).toBe(before);
  });

  it.each(['beforeLast', 'final'] as const)('migrates actual captured208 %s by adding exactly the named empty schema209–226 roots and preserving every old field and raw byte', key => {
    const bytes = readFileSync(CAPTURE), raw = readObjectEntry<Record<string, unknown>>(CAPTURE, key);
    expect(hash(bytes)).toBe(CAPTURE_SHA256);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([208, 'perfecter-v208']);
    const addedRoots = ['moon', 'darkness', 'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent',
      'twilightGiant', 'demoness', 'hermit', 'hangedMan', 'abyss', 'chained', 'wheelOfFortune',
      'blackEmperor', 'justiciar', 'mother'] as const;
    for (const root of addedRoots) expect(Object.hasOwn(raw, root)).toBe(false);
    const before = stableStringify(raw), next = migrateSliceState(raw);
    expect([next.schemaVersion, next.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(Object.keys(next).filter(field => !Object.hasOwn(raw, field)).sort()).toEqual([...addedRoots].sort());
    expect(Object.keys(next).sort()).toEqual([...Object.keys(raw), ...addedRoots].sort());
    for (const [field, value] of Object.entries(raw)) {
      if (field !== 'schemaVersion' && field !== 'contentVersion') same(next[field as keyof SliceState], value);
    }
    expect(next.moon).toStrictEqual(createMoonState());
    expect(next.darkness).toStrictEqual(createDarknessState());
    expect(next.whiteTower).toStrictEqual(createWhiteTowerState());
    expect(next.tyrant).toStrictEqual(createTyrantState());
    expect(next.sun).toStrictEqual(createSunState());expect(next.death).toStrictEqual(createDeathState());
    assertEmptyDoorState(next); assertEmptyErrorAscentState(next); assertEmptyTwilightGiantState(next);
    assertEmptyDemonessState(next); assertEmptyHermitState(next); assertEmptyHangedManState(next);
    assertEmptyAbyssState(next); assertEmptyChainedState(next); assertEmptyWheelOfFortuneState(next);
    assertEmptyBlackEmperorState(next); assertEmptyJusticiarState(next); assertEmptyMotherState(next);
    same(migrateSliceState(next), next);
    expect(stableStringify(raw)).toBe(before);
    expect(hash(readFileSync(CAPTURE))).toBe(CAPTURE_SHA256);
    expect(readFileSync(CAPTURE).equals(bytes)).toBe(true);
  }, 60_000);

  it.each([
    ['moon', createMoonState()], ['darkness', createDarknessState()], ['whiteTower', createWhiteTowerState()],
    ['tyrant', createTyrantState()], ['sun', createSunState()], ['death', createDeathState()],
  ] as const)('rejects a future %s root in actual208 rather than silently discarding it', (key, empty) => {
    const original = raw208();
    for (const root of [empty, { ...empty, guidanceKnown: true }, null]) {
      const raw = { ...original, [key]: root }, before = stableStringify(raw);
      expect(() => migrateSliceState(raw)).toThrow(); expect(stableStringify(raw)).toBe(before);
    }
  }, 60_000);

  it('rejects missing roots, unknown authority, invalid nested roots and version mismatches without mutation', () => {
    const state = fresh(), missing = structuredClone(state) as unknown as Record<string, unknown>;
    delete missing.moon;
    const missingDarkness = structuredClone(state) as unknown as Record<string, unknown>;
    const missingWhiteTower = structuredClone(state) as unknown as Record<string, unknown>;
    const missingTyrant = structuredClone(state) as unknown as Record<string, unknown>;
    delete missingDarkness.darkness; delete missingWhiteTower.whiteTower;
    delete missingTyrant.tyrant;
    for (const value of [missing, missingDarkness, missingWhiteTower, missingTyrant,
      { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
      { ...state, contentVersion: 'perfecter-v208' },
      { ...raw208(), contentVersion: CURRENT_CONTENT_VERSION },
      { ...state, moon: { ...state.moon, skipValidation: true } },
      { ...state, moon: { ...state.moon, journal: [{ type: 'SUCCESS' }] } },
      { ...state, darkness: { ...state.darkness, skipValidation: true } },
      { ...state, whiteTower: null },
      { ...state, whiteTower: { ...state.whiteTower, guidanceKnown: true } },
      { ...state, whiteTower: { ...state.whiteTower, skipValidation: true } },
      { ...state, whiteTower: { ...state.whiteTower, journal: [{ type: 'SUCCESS' }] } },
      { ...state, whiteTower: { ...state.whiteTower, promotionStability: { preparations: [], skipValidation: true } } },
      { ...state, tyrant: null },
      { ...state, tyrant: { ...state.tyrant, guidanceKnown: true } },
      { ...state, tyrant: { ...state.tyrant, skipValidation: true } },
      { ...state, callerAuthority: {} },
    ]) {
      const before = stableStringify(value);
      expect(() => migrateSliceState(value)).toThrow(); expect(stableStringify(value)).toBe(before);
    }
  });

  it('cannot mint an owned Moon head or S0 authority from empty or caller-authored roots', () => {
    const state = fresh(), fake = structuredClone(state);
    fake.progression.pathwayId = 'moon'; fake.progression.sequence = 0; fake.spirituality = 150;
    expect(() => assertValidSliceState(fake)).toThrow();
    for (const value of [state, fake, { ...state, moon: { ...state.moon, guidanceKnown: true, source: {} } }, null]) {
      expect(() => openValidatedMoonSlice(value)).toThrow();
    }
  });

  it('accepts exact public commands and rejects supplied sources, outcomes, costs and private handles', () => {
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'REST' }, { type: 'NEXT_WEEK' },
      { type: 'CONSUME', compoundId: 'moon-compound-1', confirmed: true }]) {
      expect(validateSlicePayload({ type: 'MOON', command })).toBe(true);
    }
    for (const value of [
      { type: 'MOON', command: { type: 'LEARN_GUIDANCE' }, engine: {} },
      { type: 'MOON', command: { type: 'LEARN_GUIDANCE', source: {} } },
      { type: 'MOON', command: { type: 'REST', cash: 1000 } },
      { type: 'MOON', command: { type: 'CONSUME', compoundId: 'moon-compound-1', confirmed: true, success: true } },
      { type: 'MOON', command: { type: 'CONSUME', compoundId: 'moon-compound-1', confirmed: false } },
      { type: 'MOON', command: { type: 'REST' }, skipValidation: true },
      { type: 'MOON', command: { type: 'MATERIAL', command: { type: 'ACQUIRE_CHARACTERISTIC', characteristicId: 'invented', price: 0 } } },
    ]) expect(validateSlicePayload(value)).toBe(false);
  });
});
