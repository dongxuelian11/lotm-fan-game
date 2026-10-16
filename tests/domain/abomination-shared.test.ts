import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createAbominationState } from '../../src/domain/abomination/index.js';
import { ABOMINATION_ABILITY_IDS, ABOMINATION_SOURCE_KEYS } from '../../src/domain/abomination/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/ancient-evil-v01810/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const original = () => entry<Record<string, unknown>>('final');
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));

describe('Abomination exact whole642 source and immutable histories', () => {
  it('pins the untouched raw178 whole source independently from current-format assertions', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('f005b8f8aa0b9d82f14919fbf668a56c4f5a63e1284be94c6f7155b94472c96f');
    expect(entry<SliceIntent[]>('commands')).toHaveLength(642);
    expect(original()).toMatchObject({ schemaVersion: 178, contentVersion: 'ancient-evil-v178', status: 'ACTIVE', revision: 643, week: 148,
      health: 100, mind: 97, spirituality: 105, cash: 730, actionsRemaining: 3, injuryRisk: 0,
      date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 4, day: 22 }, random: { seed: 'prisoner-natural-v057', cursor: 228 } });
  }, 120_000);
  it('preserves every source field and adds only genuinely missing current roots', () => {
    const old = original(), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('abomination'); expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key]);
    for (const key of added) same(current[key], defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.abomination, createAbominationState()); same(migrateSliceState(s), s);
    expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 120_000);
  it('retains19 skills with four zeros, original room, dead Lena, surrendered Calder and spent blocks', () => {
    const old = original() as unknown as SliceState, s = migrateSliceState(old);
    same(s.character, old.character); same(s.progression, old.progression); same(s.injuries, old.injuries);
    expect(s.injuries).toEqual([]); expect(Object.keys(s.progression.mastery)).toHaveLength(19);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(4);
    for (const id of ['chained.s7.toxic-claws', 'chained.s6.steel-body', 'chained.s6.death-craft', 'chained.s5.spirit-possession']) expect(s.progression.mastery[id]).toBe(0);
    for (const id of ABOMINATION_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of ABOMINATION_SOURCE_KEYS) same(s[key], old[key]);
    expect(s.progression.promotionWeek).toBe(6); expect(s.ancientEvil.promotionWeek).toBe(138);
    expect(s.silentDisciple.life).toMatchObject({ siteId: 'SD3-QUIET-ROOM', playerLocation: 'START', clockSeconds: 4026, playerTravelMetres: 112,
      volunteer: { id: 'SD3-ELSA', bodyId: 'SD3-ELSA', age: 43, location: 'OUTSIDE', willing: true, alive: true, form: 'HUMAN', health: 100, mind: 100, spirituality: 100 }, guide: { id: 'HARLAN', location: 'OUTSIDE' },
      clothing: { id: 'SD3-CLOTHES', location: 'ELSA', worn: true }, bag: { id: 'SD3-BAG', location: 'ELSA' }, tray: { id: 'SD3-TRAY', location: 'A', privacy: 'PRIVATE' }, note: { id: 'SD3-NOTE', location: 'B' } });
    expect(Object.hasOwn(s.silentDisciple.life.volunteer, 'energy')).toBe(false);
    expect(s.silentDisciple.life).not.toEqual(s.ancientEvil.life.source!.snapshot);
    expect(s.ancientEvil.life.operation).toEqual({ door: 'OPEN', inputActive: false, form: null });
    expect(s.ancientEvil.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'AE2-LENA', enemyStatus: 'DEAD', enemyHealth: 0, enemyMind: 100, enemySpirituality: 98, weaponLocation: 'COURT' });
    expect(s.ancientEvil.encounter.blocks).toHaveLength(3); expect(s.ancientEvil.encounter.blocks.every(b => b.status === 'SPENT' && b.location === 'TARGET_GROUND')).toBe(true);
    expect(s.silentDisciple.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'SD3-CALDER', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 116 });
    same(s.silentDisciple.encounter.enemyInjuries, old.silentDisciple.encounter.enemyInjuries);
    same(s.combatHistory, old.combatHistory); same(s.chronicle, old.chronicle);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 120_000);
  it('rejects missing current roots, fabricated old roots and future formats without destructive edits', () => {
    const old = original(), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.abomination;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, abomination: createAbominationState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    for (const key of ABOMINATION_SOURCE_KEYS) {
      const rootLoss = structuredClone(s) as unknown as Record<string, unknown>; delete rootLoss[key];
      expect(() => assertValidSliceState(rootLoss), key).toThrow();
    }
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 120_000);
  it('accepts exact IDs and independently confirmed consumption only', () => {
    const payload = (command: unknown) => ({ type: 'ABOMINATION', command });
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE' }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE', free: true }))).toBe(false);
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN']) expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId: 'CHECK_SPIRITS' }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'abomination-potion-1', confirmed: true }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'abomination-potion-1', confirmed: false }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'ancient-evil-potion-1', confirmed: true }))).toBe(false);
  });
});
