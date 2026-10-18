import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createDoorState, validateDoorState } from '../../src/domain/door/index.js';
import { DOOR_HOME } from '../../src/domain/door/content.js';
import { openDoorRuntimeSession } from '../../src/domain/door/owned-session.js';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState } from '../../src/domain/slice/types.js';

const fresh = (): SliceState => createSliceRun('door-schema-run', sliceDefaultCreationSelection, 'door-schema-seed');
const previousFormat = () => {
  const { door: _door, ...state } = fresh();
  return { ...state, schemaVersion: 214 as const, contentVersion: 'death-v214' as const };
};

describe('Door schema215 exact additive admission', () => {
  it('creates exactly the empty Door root in the current default run', () => {
    const state = fresh();
    expect([state.schemaVersion, state.contentVersion]).toEqual([215, 'door-v215']);
    expect(state.door).toEqual(createDoorState());
    expect(validateDoorState(state)).toBe(true);
    expect(() => assertValidSliceState(state)).not.toThrow();
    // An empty root is a save field, never an owned-session authority.
    expect(() => openDoorRuntimeSession(state)).toThrow();
  });

  it('migrates exact214 by adding only the empty Door root and current format', () => {
    const previous = previousFormat(), before = structuredClone(previous);
    const current = migrateSliceState(previous);
    expect(previous).toEqual(before);
    expect(current).toEqual({ ...previous, schemaVersion: 215, contentVersion: 'door-v215', door: createDoorState() });
    expect(current).not.toBe(previous);
    expect(current.death).not.toBe(previous.death);
    expect(() => assertValidSliceState(current)).not.toThrow();
  });

  it('rejects missing, injected, unknown and future-format roots without repairing them', () => {
    const state = fresh(), { door: _door, ...missing } = state;
    for (const invalid of [
      missing,
      { ...state, door: undefined },
      { ...state, door: { ...state.door, authority: true } },
      { ...state, futureChapter: {} },
      { ...state, schemaVersion: 216 },
      { ...state, contentVersion: 'door-v216' },
      { ...state, contentVersion: 'death-v214' },
      { ...previousFormat(), door: createDoorState() },
      { ...previousFormat(), contentVersion: 'door-v215' },
    ]) expect(() => migrateSliceState(invalid)).toThrow();
  });

  it('does not backdate StarKey recovery evidence while upgrading a legacy save', () => {
    const previous = previousFormat(), starKey = previous.starKey;
    for (const injected of [
      { ...starKey, resupply: { ...starKey.resupply, recovery: {} } },
      { ...starKey, bottles: [{ ...starKey.bottles[0], recovery: {} }] },
      { ...starKey, acquisitionJournal: [{ recoverySite: {} }] },
      { ...starKey, acquisitionJournal: [{ command: { type: 'REQUEST_RECOVERY_V1' } }] },
      { ...starKey, acquisitionJournal: [{ command: { type: 'RECOVER_CHARACTERISTIC_V1' } }] },
    ]) expect(() => migrateSliceState({ ...previous, starKey: injected }))
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
