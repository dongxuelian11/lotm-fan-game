import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createMercurySnakeState } from '../../src/domain/mercury-snake/index.js';
import { MERCURY_SNAKE_ABILITY_IDS, MERCURY_SNAKE_SOURCE_KEYS } from '../../src/domain/mercury-snake/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/fate-prophet-v01820/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const original = () => entry<Record<string, unknown>>('final');
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));

describe('Mercury Snake genuine whole703 source and immutable histories', () => {
  it('pins raw179 independently from CURRENT migration, without silently relabelling old bytes', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('52688eebc9ef8bf3d548195aa174b1f04a517adcce5d2fc6a3bef57a901f86cb');
    expect(entry<SliceIntent[]>('commands')).toHaveLength(703);
    expect(original()).toMatchObject({ schemaVersion: 179, contentVersion: 'fate-prophet-v179', status: 'ACTIVE', revision: 704, week: 177,
      health: 90, mind: 95, spirituality: 119, cash: 1060, actionsRemaining: 2, injuryRisk: 0,
      date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 11, day: 11 }, random: { seed: 'monster-natural-v060', cursor: 269 } });
  }, 120_000);
  it('preserves every historical field and adds only genuinely missing CURRENT roots', () => {
    const old = original(), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('mercurySnake'); expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key]);
    for (const key of added) same(current[key], defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.mercurySnake, createMercurySnakeState()); same(migrateSliceState(s), s);
    expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 120_000);
  it('retains17 skills and six zeros, original luck, light injury and surrendered Rowan', () => {
    const old = original() as unknown as SliceState, s = migrateSliceState(old);
    same(s.character, old.character); same(s.progression, old.progression); same(s.injuries, old.injuries);
    expect(s.injuries).toEqual([{ id: 'monster-rebuild-natural:combat:2:PLAYER:702:0', severity: 'LIGHT', acquiredRevision: 702, treatedRevision: null }]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(6);
    for (const id of ['wheel.s7.passive-luck', 'wheel.s6.disaster-awareness', 'wheel.s6.disaster-attraction', 'wheel.s5.luck-reserve', 'wheel.s5.ill-fortune', 'wheel.s2.hazard-adjustment']) expect(s.progression.mastery[id]).toBe(0);
    for (const id of MERCURY_SNAKE_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    expect(MERCURY_SNAKE_SOURCE_KEYS).toEqual(['monster', 'machine', 'lucky', 'calamityPriest', 'winner', 'misfortuneMage', 'chaosWalker', 'fateProphet']);
    for (const key of MERCURY_SNAKE_SOURCE_KEYS) same(s[key], old[key]);
    expect(s.progression.promotionWeek).toBe(6); expect(s.fateProphet.promotionWeek).toBe(166); expect(s.week - s.fateProphet.promotionWeek!).toBe(11);
    expect(s.winner.luck).toEqual({ stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 });
    expect(s.chaosWalker.life).toMatchObject({ siteId: 'CW3-MECHANICAL-WORKSHOP', playerLocation: 'START', clockSeconds: 713, playerTravelMetres: 124,
      volunteer: { id: 'CW3-VERA', age: 39, location: 'OUTSIDE', willing: true, alive: true, health: 100, mind: 100, spirituality: 100 }, guide: { id: 'GUIDE', location: 'OUTSIDE' },
      cart: { id: 'CW3-CART', owner: 'GUIDE', location: 'A', releases: 3, returns: 3 }, parcel: { id: 'CW3-PARCEL', owner: 'GUIDE', location: 'CW3-CART', massGrams: 400, sealed: true },
      disc: { id: 'CW3-DISC', location: 'A', pointer: 'A' }, pouch: { id: 'CW3-POUCH', owner: 'CW3-VERA', location: 'VERA' } });
    expect(s.chaosWalker.life.tags.map(t => [t.id, t.location, t.owner])).toEqual([['CW3-TAG-A', 'POUCH', 'CW3-VERA'], ['CW3-TAG-B', 'POUCH', 'CW3-VERA']]);
    expect(Object.hasOwn(s.chaosWalker.life.volunteer, 'energy')).toBe(false); expect(Object.hasOwn(s.chaosWalker.life.guide, 'mind')).toBe(false);
    expect(s.chaosWalker.life).not.toEqual(s.fateProphet.life.source!.snapshot);
    same(s.fateProphet.life.operation, old.fateProphet.life.operation);
    expect(s.fateProphet.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'FP2-ROWAN', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 83 });
    same(s.fateProphet.encounter.enemyInjuries, old.fateProphet.encounter.enemyInjuries);
    expect(s.fateProphet.encounter.enemyInjuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY']);
    same(s.combatHistory, old.combatHistory); same(s.chronicle, old.chronicle); expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 120_000);
  it('rejects missing CURRENT roots, fabricated old roots and future formats without edits', () => {
    const old = original(), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.mercurySnake;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, mercurySnake: createMercurySnakeState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    for (const key of MERCURY_SNAKE_SOURCE_KEYS) {
      const rootLoss = structuredClone(s) as unknown as Record<string, unknown>; delete rootLoss[key];
      expect(() => assertValidSliceState(rootLoss), key).toThrow();
    }
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 120_000);
  it('accepts exact potion IDs and independent confirmed consumption only', () => {
    const payload = (command: unknown) => ({ type: 'MERCURY_SNAKE', command });
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE' }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE', free: true }))).toBe(false);
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN']) expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId: 'CHECK_SPIRITS' }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'mercury-snake-potion-1', confirmed: true }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'mercury-snake-potion-1', confirmed: false }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'fate-prophet-potion-1', confirmed: true }))).toBe(false);
  });
});
