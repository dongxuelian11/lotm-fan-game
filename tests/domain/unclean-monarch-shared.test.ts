import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createUncleanMonarchState } from '../../src/domain/unclean-monarch/index.js';
import { UNCLEAN_MONARCH_ABILITY_IDS, UNCLEAN_MONARCH_SOURCE_KEYS } from '../../src/domain/unclean-monarch/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/blood-duke-v01800/natural.json';
const BOUNDARY = 'tests/fixtures/blood-duke-v01800/boundary-real-combat-preparation.json';
const OLDER = 'tests/fixtures/blatherer-v01560/natural.json';
const entry = <T>(path: string, key: string): T => readObjectEntry<T>(path, key);
const original = () => entry<Record<string, unknown>>(BOUNDARY, 'beforeLast');
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('Unclean Monarch exact living718 source and immutable terminal histories', () => {
  it('pins raw177 living718 separately from724 death and592 earlier death', () => {
    expect(sha(SOURCE)).toBe('7762560089c03487c1dd4432fd367998d4874c165e3cce8d012d200d56222363');
    expect(sha(BOUNDARY)).toBe('c9c82f892d21d1cf68d955d75220da06334a9bea7e99b106f41c83e06e152e2c');
    expect(sha(OLDER)).toBe('796a7efabb26d5db70a24eeb509d7bbe2d80aa33e864f2ff45eba65016abaf7b');
    const commands = entry<SliceIntent[]>(SOURCE, 'commands'), oldCommands = entry<SliceIntent[]>(OLDER, 'commands');
    expect(commands).toHaveLength(724); expect(oldCommands).toHaveLength(592);
    expect(commands.slice(0, 583)).toEqual(oldCommands.slice(0, 583));
    expect(commands[718]).toEqual(entry<SliceIntent>(BOUNDARY, 'lastIntent'));
    expect(original()).toMatchObject({ schemaVersion: 177, contentVersion: 'blood-duke-v177', status: 'ACTIVE', revision: 719, week: 181,
      health: 100, mind: 100, spirituality: 120, cash: 710, actionsRemaining: 3, injuryRisk: 0,
      date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 12, day: 9 }, random: { seed: 'criminal-natural-v054', cursor: 112 } });
    expect(entry<unknown>(SOURCE, 'final')).toMatchObject({ status: 'DEAD', revision: 725, health: 0, ending: { kind: 'DEATH' } });
    expect(entry<unknown>(OLDER, 'final')).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
  }, 120_000);
  it('preserves every source field and adds only genuinely missing current roots', () => {
    const old = original(), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>(SOURCE, 'creation'), entry<string>(SOURCE, 'seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('uncleanMonarch'); expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key]);
    for (const key of added) same(current[key], defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.uncleanMonarch, createUncleanMonarchState()); same(migrateSliceState(s), s);
    expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 120_000);
  it('retains16 skills including four zeros, actual live room and every old body', () => {
    const old = original() as unknown as SliceState, s = migrateSliceState(old);
    same(s.character, old.character); same(s.progression, old.progression); same(s.injuries, old.injuries);
    expect(s.injuries).toEqual([]); expect(Object.keys(s.progression.mastery)).toHaveLength(16);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(4);
    for (const id of ['abyss.s7.demonic-lore', 'abyss.s7.ritual-practice', 'abyss.s6.danger-premonition', 'abyss.s5.catalysis']) expect(s.progression.mastery[id]).toBe(0);
    for (const id of UNCLEAN_MONARCH_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of UNCLEAN_MONARCH_SOURCE_KEYS) same(s[key], old[key]);
    expect(s.progression.promotionWeek).toBe(5); expect(s.bloodDuke.promotionWeek).toBe(172);
    expect(s.blatherer.life).toMatchObject({ playerLocation: 'START', clockSeconds: 317, playerTravelMetres: 96,
      volunteer: { id: 'BL3-NORA', age: 46, location: 'A', willing: true, alive: true }, guide: { location: 'OUTSIDE', travelMetres: 24 },
      card: { id: 'BL3-CARD', location: 'NORA', travelMetres: 40 }, bell: { location: 'B' }, note: { location: 'B' } });
    expect(Object.hasOwn(s.blatherer.life.volunteer, 'energy')).toBe(false);
    expect(s.blatherer.life).not.toEqual(s.bloodDuke.life.source!.snapshot);
    expect(s.bloodDuke.life.operation).toEqual({ door: 'OPEN', inputActive: false, impulse: null, emotion: null, restraintUntil: null, hesitationUntil: null, bellRehearsals: 2 });
    expect(s.demon.strain).toBe(3); expect(s.unwinged.conscienceLost).toBe(true);
    expect(s.blatherer.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.bloodDuke.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'BD2-GARETH', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(s.devil.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 32 });
    expect(s.devil.encounter.enemyInjuries).toEqual(old.devil.encounter.enemyInjuries);
    same(s.combatHistory, old.combatHistory); same(s.chronicle, old.chronicle);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 120_000);
  it('rejects missing current roots, fabricated historical roots and future formats', () => {
    const old = original(), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.uncleanMonarch;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, uncleanMonarch: createUncleanMonarchState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    for (const key of UNCLEAN_MONARCH_SOURCE_KEYS) {
      const rootLoss = structuredClone(s) as unknown as Record<string, unknown>; delete rootLoss[key];
      expect(() => assertValidSliceState(rootLoss), key).toThrow();
    }
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 120_000);
  it('accepts exact IDs and independently confirmed consumption only', () => {
    const payload = (command: unknown) => ({ type: 'UNCLEAN_MONARCH', command });
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE' }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE', free: true }))).toBe(false);
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN']) expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId: 'CHECK_SPIRITS' }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'unclean-monarch-potion-1', confirmed: true }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'unclean-monarch-potion-1', confirmed: false }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'blood-duke-potion-1', confirmed: true }))).toBe(false);
  });
});
