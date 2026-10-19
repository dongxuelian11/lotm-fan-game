import { assertEmptyErrorAscentState } from '../helpers/empty-error-ascent-capture.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createDoorState, validateDoorState } from '../../src/domain/door/index.js';
import { DOOR_HOME } from '../../src/domain/door/content.js';
import { openDoorRuntimeSession } from '../../src/domain/door/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { DOOR_SOURCE_FILE, DOOR_SOURCE_SHA, doorScenarioHash } from '../helpers/door-scenario.js';

const fresh = (): SliceState => createSliceRun('door-schema-run', sliceDefaultCreationSelection, 'door-schema-seed');
type OriginalStarKeySave = {
  schemaVersion: 193;
  contentVersion: 'star-key-v193';
  starKey: SliceState['starKey'];
  [key: string]: unknown;
};
let source: OriginalStarKeySave;
beforeAll(() => {
  expect(createHash('sha256').update(readFileSync(DOOR_SOURCE_FILE)).digest('hex')).toBe(DOOR_SOURCE_SHA);
  source = readObjectEntry<OriginalStarKeySave>(DOOR_SOURCE_FILE, 'final');
  expect([source.schemaVersion, source.contentVersion]).toEqual([193, 'star-key-v193']);
  expect(doorScenarioHash(source)).toBe('56ecbdddfdbfa82116aa8ea466d4195be0b98e4ccbcc49bea07f3f2cabfd1a5b');
});

describe('Door schema215 exact additive admission', () => {
  it('creates exactly the empty Door root in the current default run', () => {
    const state = fresh();
    expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(state.door).toEqual(createDoorState()); assertEmptyErrorAscentState(state);
    expect(validateDoorState(state)).toBe(true);
    expect(() => assertValidSliceState(state)).not.toThrow();
    // An empty root is a save field, never an owned-session authority.
    expect(() => openDoorRuntimeSession(state)).toThrow();
  });

  it('migrates authentic193 while preserving every original field and adding empty chapter roots', () => {
    const before = doorScenarioHash(source), current = migrateSliceState(source), defaults = fresh();
    expect(doorScenarioHash(source)).toBe(before);
    expect([current.schemaVersion, current.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    for (const [key, value] of Object.entries(source)) {
      if (key === 'schemaVersion' || key === 'contentVersion') continue;
      expect(doorScenarioHash(current[key as keyof SliceState]), `Changed original ${key}`).toBe(doorScenarioHash(value));
    }
    expect(current.door).toEqual(createDoorState()); assertEmptyErrorAscentState(current);
    for (const key of [
      'timeWorm', 'divineHand', 'apocalypseDemoness', 'knowledgeEmperor', 'darkAngel',
      'uncleanMonarch', 'abomination', 'mercurySnake', 'princeOfAbolition', 'handOfOrder',
      'natureWalker', 'fool', 'redPriest', 'visionary', 'perfecter', 'moon', 'darkness',
      'whiteTower', 'tyrant', 'sun', 'death', 'door', 'errorAscent',
    ] as const) {
      expect(Object.hasOwn(source, key), `Original193 unexpectedly contains ${key}`).toBe(false);
      expect(current[key], `Nonempty migrated ${key}`).toEqual(defaults[key]);
    }
    expect(current).not.toBe(source);
    expect(current.starKey).not.toBe(source.starKey);
    expect(() => assertValidSliceState(current)).not.toThrow();
  }, 120_000);

  it('rejects missing, injected, unknown and future-format roots without repairing them', () => {
    const state = fresh(), { door: _door, ...missing } = state;
    for (const invalid of [
      missing,
      { ...state, door: undefined },
      { ...state, door: { ...state.door, authority: true } },
      { ...state, futureChapter: {} },
      { ...state, schemaVersion: CURRENT_SCHEMA_VERSION + 1 },
      { ...state, contentVersion: `future-v${CURRENT_SCHEMA_VERSION + 1}` },
      { ...state, contentVersion: source.contentVersion },
      { ...source, door: createDoorState() },
      { ...source, contentVersion: CURRENT_CONTENT_VERSION },
    ]) expect(() => migrateSliceState(invalid)).toThrow();
  });

  it('does not backdate StarKey recovery evidence while upgrading a legacy save', () => {
    const starKey = source.starKey;
    for (const injected of [
      { ...starKey, resupply: { ...starKey.resupply, recovery: {} } },
      { ...starKey, bottles: [{ ...starKey.bottles[0], recovery: {} }] },
      { ...starKey, acquisitionJournal: [{ recoverySite: {} }] },
      { ...starKey, acquisitionJournal: [{ command: { type: 'REQUEST_RECOVERY_V1' } }] },
      { ...starKey, acquisitionJournal: [{ command: { type: 'RECOVER_CHARACTERISTIC_V1' } }] },
    ]) expect(() => migrateSliceState({ ...source, starKey: injected }))
      .toThrow('Unexpected StarKey recovery state in a legacy save');
  });

  it('rejects forged guidance or Door S0 even when all other current roots are empty', () => {
    const guidance = fresh();
    guidance.door.guidanceKnown = true;
    expect(validateDoorState(guidance)).toBe(false);
    expect(() => assertValidSliceState(guidance)).toThrow();
    expect(() => openDoorRuntimeSession(guidance)).toThrow();
    const promotion = fresh();
    promotion.progression.pathwayId = 'door';
    promotion.progression.sequence = 0;
    promotion.progression.acting = 100;
    promotion.spirituality = 150;
    expect(validateDoorState(promotion)).toBe(false);
    expect(() => assertValidSliceState(promotion)).toThrow();
    expect(() => migrateSliceState(promotion)).toThrow();
    expect(() => openDoorRuntimeSession(promotion)).toThrow();
  });

  it('accepts only exact player intent and never caller-provided state or permission', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'WORK' }, { type: 'RETURN_ON_FOOT' },
      { type: 'TRAVEL', to: DOOR_HOME },
      { type: 'CONSUME', compoundId: 'door-compound-1', confirmed: true },
    ]) expect(validateSlicePayload({ type: 'DOOR', command })).toBe(true);
    for (const payload of [
      { type: 'DOOR', command: { type: 'WORK', cash: 100 } },
      { type: 'DOOR', command: { type: 'TRAVEL', to: 'NOT-A-PLACE' } },
      { type: 'DOOR', command: { type: 'CONSUME', compoundId: 'door-compound-1', confirmed: false } },
      { type: 'DOOR', command: { type: 'WORK' }, skipValidation: true },
      { type: 'DOOR', command: { type: 'WORK' }, ownedHead: {} },
      { type: 'DOOR', command: { type: 'SERVICE', command: { type: 'ASK_PERMISSION', consent: 'ALLOW' } } },
    ]) expect(validateSlicePayload(payload)).toBe(false);
  });
});
