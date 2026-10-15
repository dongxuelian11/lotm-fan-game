import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createAttendantMysteriesState } from '../../src/domain/attendant-mysteries/index.js';
import { ATTENDANT_MYSTERIES_ABILITY_IDS } from '../../src/domain/attendant-mysteries/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

const SOURCE = 'tests/fixtures/miracle-worker-v01640/continuation.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const original = () => entry<Record<string, unknown>>('final');
const creation = () => entry<Parameters<typeof createSliceRun>[1]>('creation');
const same = (actual: unknown, expected: unknown, label?: string): void => {
  expect(stableStringify(actual), label).toBe(stableStringify(expected));
};

/** Uses the captured real schema161 source directly. No relabelled current save,
 * deleted legacy-root list, synthetic promotion, or edited old campaign facts. */
describe('Attendant of Mysteries shared format and actual S2 inheritance', () => {
  it('migrates the actual schema161 source to the current format, preserving every existing field and defaulting only newly introduced roots', () => {
    const old = original(), before = stableStringify(old);
    expect([old.schemaVersion, old.contentVersion]).toEqual([161, 'miracle-worker-v161']);
    expect(Object.hasOwn(old, 'attendantMysteries')).toBe(false);
    expect(entry<SliceIntent[]>('commands')).toHaveLength(1038);
    const s = migrateSliceState(old), current = s as unknown as Record<string, unknown>;
    const defaults = createSliceRun(s.runId, creation(), entry<string>('seed')) as unknown as Record<string, unknown>;
    const added = Object.keys(defaults).filter(key => !Object.hasOwn(old, key));
    expect(added).toContain('attendantMysteries');
    expect(Object.keys(current).filter(key => !Object.hasOwn(old, key)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) {
      if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key], `original field: ${key}`);
    }
    for (const key of added) same(current[key], defaults[key], `new default root: ${key}`);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.attendantMysteries, createAttendantMysteriesState());
    same(migrateSliceState(s), s, 'current-format migration is idempotent');
    expect(stableStringify(old)).toBe(before);
    assertValidSliceState(s);
  });

  it('rejects a missing current root, a forged root on the real legacy source, and future formats without repairing the input', () => {
    const old = original(), oldBytes = stableStringify(old), s = migrateSliceState(old);
    const missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.attendantMysteries;
    expect(missing.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(() => migrateSliceState(missing)).toThrow();
    expect(() => assertValidSliceState(missing)).toThrow();
    expect(Object.hasOwn(missing, 'attendantMysteries')).toBe(false);
    const forged = { ...old, attendantMysteries: createAttendantMysteriesState() }, forgedBytes = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow();
    expect(stableStringify(forged)).toBe(forgedBytes);
    const future = { ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }, futureBytes = stableStringify(future);
    expect(() => migrateSliceState(future)).toThrow();
    expect(() => assertValidSliceState(future)).toThrow();
    expect(stableStringify(future)).toBe(futureBytes);
    expect(stableStringify(old)).toBe(oldBytes);
  });

  it('retains all31 mastery values including14 zeros, original death and release, zero split worms and all four unused revivals', () => {
    const old = original(), s = migrateSliceState(old);
    expect(s).toMatchObject({ status: 'ACTIVE', revision: 1039, week: 15839, health: 100, mind: 99, spirituality: 108, cash: 358, actionsRemaining: 0,
      progression: { pathwayId: 'diviner', sequence: 2, acting: 100 } });
    same(s.progression, old.progression);
    expect(Object.keys(s.progression.mastery)).toHaveLength(31);
    expect(Object.values(s.progression.mastery).filter(value => value === 0)).toHaveLength(14);
    for (const id of ATTENDANT_MYSTERIES_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id), id).toBe(false);
    expect(s.bizarroSorcerer.life.worms).toEqual({ capacity: 50, split: 0, assigned: 0, recalled: 0, lost: 0 });
    expect(s.marionettist.puppet.target).toMatchObject({ id: 'MM5-DORN', alive: false, health: 0, status: 'DEAD', location: 'ORIGINAL_COURTYARD' });
    expect(s.marionettist.puppet.active).toBe(false);
    expect(s.bizarroSorcerer.life.mouse).toMatchObject({ id: 'BR4-MOUSE-1', alive: true, status: 'RELEASED', location: 'RELEASE_SITE', completeOutcome: 'FAILURE' });
    expect(s.miracleWorker.revival).toEqual({ allowance: 4, used: 0, pendingDeathId: null, records: [] });
    expect(s.miracleWorker.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', location: 'MW2-NORTH-DRAIN-STAIR', terminal: { outcome: 'ENEMY_SURRENDERED' } });
    expect(s.miracleWorker.life.reflected).toBe(true);
    expect(s.miracleWorker.life.activeCase).toBeNull();
    expect(Object.values(s.miracleWorker.life.cases).map(c => c.status)).toEqual(['RESOLVED', 'RESOLVED', 'RESOLVED']);
    same(s.combatHistory, old.combatHistory);
    same(s.character, old.character);
    expect(s.character.name).toBe(creation().displayName);
    assertValidSliceState(s);
  });

  it('naturally exposes the new public entry at the unchanged S2 source without granting guidance, promotion or free resources', () => {
    const s = migrateSliceState(original()), before = stableStringify(s), view = projectSliceState(s);
    expect(view.attendantMysteries).toMatchObject({ discovered: true, promoted: false, guidanceKnown: false, formulaKnown: false });
    expect(view.attendantMysteries.abilities).toEqual([]);
    const guidance = view.attendantMysteries.actions.find(action => action.command.type === 'LEARN_GUIDANCE');
    expect(guidance).toBeDefined();
    expect(guidance!.enabled).toBe(false); // The actual source has zero AP and only358 pennies.
    expect(guidance!.reason).not.toBeNull();
    const intent: SliceIntent = { type: 'ATTENDANT_MYSTERIES', command: guidance!.command };
    expect(validateSlicePayload(intent)).toBe(true);
    expect(() => applySliceIntent(s, intent)).toThrow();
    expect(() => applySliceIntent(s, { type: 'ATTENDANT_MYSTERIES', command: { type: 'CONSUME', bottleId: 'attendant-mysteries-batch-1:bottle', confirmed: true } })).toThrow();
    expect(s.progression.sequence).toBe(2);
    expect(s.attendantMysteries.promotionWeek).toBeNull();
    expect(s.attendantMysteries.acquisitionJournal).toEqual([]);
    same(s.attendantMysteries, createAttendantMysteriesState());
    expect(view.character.name).toBe(s.character.name);
    expect(stableStringify(s)).toBe(before);
    assertValidSliceState(s);
  });

  it('keeps a user-chosen character name through creation, current migration and public projection', () => {
    const name = '阿霁·自定姓名', selection = { ...creation(), displayName: name };
    const s: SliceState = createSliceRun('attendant-custom-name', selection, entry<string>('seed'));
    const before = stableStringify(s), migrated = migrateSliceState(s);
    expect(s.character.name).toBe(name);
    expect(migrated.character.name).toBe(name);
    expect(projectSliceState(migrated).character.name).toBe(name);
    same(migrated.attendantMysteries, createAttendantMysteriesState());
    same(migrated, s);
    expect(stableStringify(s)).toBe(before);
    assertValidSliceState(migrated);
  });
});
