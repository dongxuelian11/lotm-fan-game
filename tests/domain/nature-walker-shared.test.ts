import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createNatureWalkerState, natureWalkerInheritedView, validateNatureWalkerSource, validateNatureWalkerState } from '../../src/domain/nature-walker/index.js';
import { NATURE_WALKER_ABILITY_IDS, NATURE_WALKER_INHERITED_ABILITY_IDS, NATURE_WALKER_SOURCE_KEYS, NATURE_WALKER_PREPARATION_IDS } from '../../src/domain/nature-walker/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { barrenMatriarchNaturalPath, originalBarrenMatriarch, oldMotherRoots, taught, promoted, directedInitial2, nw, dose, step, rejectIntent } from './nature-walker-directed-helper.js';
const entry = <T>(key: string): T => readObjectEntry<T>(barrenMatriarchNaturalPath, key);

describe('NatureWalker exact current format and frozen Mother history', () => {
  it('adds only missing CURRENT defaults while preserving every original182 field', () => {
    const raw = entry<Record<string, unknown>>('final'), bytes = stableStringify(raw);
    expect([raw.schemaVersion, raw.contentVersion]).toEqual([182, 'barren-matriarch-v182']);
    expect(Object.hasOwn(raw, 'natureWalker')).toBe(false);
    const s = migrateSliceState(raw), defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(key => !Object.hasOwn(raw, key));
    expect(added).toContain('natureWalker'); expect(Object.keys(current).filter(key => !Object.hasOwn(raw, key)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(raw)) if (key !== 'schemaVersion' && key !== 'contentVersion') expect(stableStringify(current[key]), key).toBe(stableStringify(raw[key]));
    for (const key of added) expect(current[key], key).toEqual(defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(s.natureWalker).toEqual(createNatureWalkerState()); expect(migrateSliceState(s)).toEqual(s); expect(stableStringify(raw)).toBe(bytes);
    expect(Object.keys(s.progression.mastery)).toEqual([...NATURE_WALKER_INHERITED_ABILITY_IDS]); expect(Object.values(s.progression.mastery).filter(value => value === 0)).toHaveLength(3);
    for (const id of NATURE_WALKER_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    expect(s.injuries).toEqual([]); expect(s.character.gender).toBe('FEMALE'); assertValidSliceState(s);
  }, 30_000);

  it('rejects missing source/current roots, fabricated old-format new roots, fakeS1/S0 and future versions', () => {
    const raw = entry<Record<string, unknown>>('final'), s = originalBarrenMatriarch();
    for (const key of ['natureWalker', ...NATURE_WALKER_SOURCE_KEYS]) {
      const missing = structuredClone(s) as unknown as Record<string, unknown>; delete missing[key];
      const bytes = stableStringify(missing); expect(() => assertValidSliceState(missing), key).toThrow(); expect(() => migrateSliceState(missing), key).toThrow(); expect(stableStringify(missing)).toBe(bytes);
    }
    const forged = { ...raw, natureWalker: createNatureWalkerState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    for (const sequence of [1, 0] as const) { const bad = structuredClone(s); bad.progression.sequence = sequence; expect(validateNatureWalkerState(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow(); }
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => migrateSliceState({ ...s, contentVersion: 'nature-walker-v999' })).toThrow();
  }, 30_000);

  it('validates exact acquisition payloads with independent confirmation and no repeated feminization', () => {
    const payload = (command: unknown) => ({ type: 'NATURE_WALKER', command });
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE' }))).toBe(true); expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE', free: true }))).toBe(false);
    for (const taskId of NATURE_WALKER_PREPARATION_IDS) expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId: 'MARK_EXIT' }))).toBe(false);
    expect(validateSlicePayload(payload(dose))).toBe(true);
    for (const command of [{ ...dose, confirmed: false }, { ...dose, acceptFeminization: true }, { ...dose, bottleId: 'barren-matriarch-potion-1' }, { type: 'CONSUME', bottleId: dose.bottleId }]) expect(validateSlicePayload(payload(command))).toBe(false);
  });

  it('freezes all eight action surfaces at guidance and projects their authentic records read-only', () => {
    for (const s of [taught(), promoted()]) {
      const before = stableStringify(s), roots = oldMotherRoots(s), view = natureWalkerInheritedView(s);
      expect(view.progression).toMatchObject({ pathwayId: 'mother', sequence: 2, acting: 100, promotionWeek: 6 });
      expect(view.barrenMatriarch.promotionWeek).toBe(202); expect(view.character.coreStats).toEqual({ physique: 28, perception: 24, will: 23, knowledge: 24 });
      expect(view.natureWalker).toEqual(createNatureWalkerState()); expect(view.pulse).toBe('NONE'); expect(view.billAmount).toBe(0);
      for (const intent of [
        { type: 'CULTIVATOR', command: { type: 'LEARN_GUIDANCE' } }, { type: 'PHYSICIAN', command: { type: 'LEARN_GUIDANCE' } },
        { type: 'HARVESTPRIEST', command: { type: 'LEARN_GUIDANCE' } }, { type: 'BIOLOGIST', command: { type: 'LEARN_GUIDANCE' } },
        { type: 'DRUID', command: { type: 'LEARN_GUIDANCE' } }, { type: 'ANCIENT_ALCHEMIST', command: { type: 'LEARN_GUIDANCE' } },
        { type: 'COFFIN_BEARER', command: { type: 'REFLECT' } }, { type: 'BARREN_MATRIARCH', command: { type: 'PREPARE_ENCOUNTER' } },
      ] as SliceIntent[]) rejectIntent(s, intent);
      const projected = projectSliceState(s);
      const scan = (value: unknown): void => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(scan); return; }
        const object = value as Record<string, unknown>;
        if (Array.isArray(object.actions)) for (const action of object.actions as { enabled?: boolean }[]) expect(action.enabled).toBe(false);
        if ('preferredActionId' in object) expect(object.preferredActionId).toBeNull();
        for (const child of Object.values(object)) scan(child);
      };
      for (const key of NATURE_WALKER_SOURCE_KEYS) scan(projected[key]);
      expect(projected.barrenMatriarch.abilities).toHaveLength(15); expect(projected.barrenMatriarch.acting).toBe(100);
      expect(validateNatureWalkerSource(s)).toBe(true); expect(oldMotherRoots(s)).toEqual(roots); expect(stableStringify(s)).toBe(before);
    }
  }, 30_000);

  it('keeps ordinaryS1 WORK/REST on current finance and crosses0AP with the real bill while all eight source roots stay frozen', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 6;
    let s = nw(initial, { type: 'LEARN_GUIDANCE' }); for (const taskId of NATURE_WALKER_PREPARATION_IDS) s = nw(s, { type: 'PREPARE_TASK', taskId });
    s = nw(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = nw(s, { type: 'PREPARE_PROMOTION' }); s = nw(s, dose);
    expect(s.actionsRemaining).toBe(1); const roots = oldMotherRoots(s), scene = structuredClone(s.natureWalker.sourceScene), before = structuredClone(s);
    s = step(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(before.week + 1); expect(s.date).toEqual(addGameWeeks(before.date, 1)); expect(s.actionsRemaining).toBe(6); expect(s.cash).toBe(before.cash - 30); expect(s.pulse).toBe('NONE');
    expect(s.random).toEqual(before.random); expect(oldMotherRoots(s)).toEqual(roots); expect(s.natureWalker.sourceScene).toEqual(scene); assertValidSliceState(s);
    const worked = step(s, { type: 'ACTION', action: 'WORK' });
    expect(worked.week).toBe(s.week); expect(worked.actionsRemaining).toBe(s.actionsRemaining - 1); expect(worked.cash).toBe(s.cash + s.character.weeklyWage);
    expect(oldMotherRoots(worked)).toEqual(roots); expect(worked.natureWalker.sourceScene).toEqual(scene); expect(validateNatureWalkerSource(worked)).toBe(true); assertValidSliceState(worked);
  }, 30_000);
});
