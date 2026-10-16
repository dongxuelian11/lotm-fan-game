import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createDivineHandState } from '../../src/domain/divine-hand/index.js';
import { DIVINE_HAND_ABILITY_IDS, DIVINE_HAND_SOURCE_KEYS } from '../../src/domain/divine-hand/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { originalGlory, gloryNaturalPath } from './divine-hand-directed-helper.js';
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));

describe('Divine Hand current format and genuine original continuity', () => {
  it('preserves every original173 field and initializes only genuinely missing roots', () => {
    const old = readObjectEntry<Record<string, unknown>>(gloryNaturalPath, 'final'), bytes = stableStringify(old), s = migrateSliceState(old);
    const creation = sliceDefaultCreationSelection;
    const defaults = createSliceRun(s.runId, creation, s.random.seed) as unknown as Record<string, unknown>, current = s as unknown as Record<string, unknown>;
    const added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k)); expect(added).toContain('divineHand');
    expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const k of Object.keys(old)) if (k !== 'schemaVersion' && k !== 'contentVersion') same(current[k], old[k]);
    for (const k of added) same(current[k], defaults[k]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.divineHand, createDivineHandState()); same(migrateSliceState(s), s); expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 60_000);
  it('retains20 real skills, four zeroes and the actual paid armor, pad and empty load', () => {
    const s = originalGlory(), raw = readObjectEntry<SliceState>(gloryNaturalPath, 'final');
    expect(Object.keys(s.progression.mastery)).toHaveLength(20); expect(Object.values(s.progression.mastery).filter(x => x === 0)).toHaveLength(4);
    for (const id of DIVINE_HAND_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of DIVINE_HAND_SOURCE_KEYS) same(s[key], raw[key]);
    expect(s.glory.life.site.armor?.integrity).toBe(60); expect(s.silverKnight.life.armor.integrity).toBe(65);
    expect(s.glory.life.site.armorSource?.snapshot.integrity).toBe(65);
    expect(s.glory.life.site.pads).toMatchObject({ remaining: 1, consumed: 1, location: 'BENCH' });
    expect(s.glory.life.site.load).toMatchObject({ remainingLoads: 0, appliedLoads: 1 });
    expect(s.glory.life.site.plates.map(p => [p.charges, p.location])).toEqual([[0, 'BENCH'], [0, 'BENCH'], [1, 'BENCH']]);
    same(s.injuries, raw.injuries); same(s.combatHistory, raw.combatHistory); same(s.character, raw.character);
    expect(s.health).toBe(90); expect(s.injuryRisk).toBe(0); expect(s.glory.life.site.playerEnergy).toBe(35);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 60_000);
  it('fails closed for missing current roots, forged old roots and unknown future formats', () => {
    const raw = readObjectEntry<Record<string, unknown>>(gloryNaturalPath, 'final'), s = originalGlory();
    const missing = structuredClone(s) as unknown as Record<string, unknown>; delete missing.divineHand;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...raw, divineHand: createDivineHandState() }, bytes = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(bytes);
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 60_000);
  it('requires exact command payload and independent bottle confirmation', () => {
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'PREPARE_TASK', taskId: 'PLAN_FINITE_LOAD' }, { type: 'CONSUME', bottleId: 'divine-hand-potion-1', confirmed: true }]) expect(validateSlicePayload({ type: 'DIVINE_HAND', command })).toBe(true);
    for (const command of [{ type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'LOCATE_ANYTHING' }, { type: 'CONSUME', bottleId: 'divine-hand-potion-1', confirmed: false }, { type: 'CONSUME', bottleId: 'glory-potion-2', confirmed: true }, { type: 'CONFIRM_TRANSFORMATION', confirmed: true }]) expect(validateSlicePayload({ type: 'DIVINE_HAND', command })).toBe(false);
  });
});
