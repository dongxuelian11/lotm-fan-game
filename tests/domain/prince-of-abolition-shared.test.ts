import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createPrinceOfAbolitionState } from '../../src/domain/prince-of-abolition/index.js';
import { PRINCE_OF_ABOLITION_ABILITY_IDS, PRINCE_OF_ABOLITION_SOURCE_KEYS } from '../../src/domain/prince-of-abolition/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/entropy-duke-v01830/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const original = () => entry<Record<string, unknown>>('final');
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));

describe('PrinceOfAbolition exact whole743 source and immutable histories', () => {
  it('pins the untouched raw180 whole source independently from current-format assertions', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('3dbb2166121b85a02883455a5604df7c44a50ce6102d7dd65d5c9720b4ed32f1');
    expect(entry<SliceIntent[]>('commands')).toHaveLength(743);
    expect(entry<number>('prefixCount')).toBe(555); expect(entry<boolean>('prefixVerified')).toBe(true);
    expect(entry<string>('seed')).toBe('lawyer-natural-v063');
    expect(original()).toMatchObject({ schemaVersion: 180, contentVersion: 'entropy-duke-v180', status: 'ACTIVE', revision: 744, week: 185,
      health: 100, mind: 95, spirituality: 94, cash: 800, actionsRemaining: 3, injuryRisk: 0,
      date: { epoch: 'FIFTH_EPOCH', year: 1353, month: 1, day: 6 }, random: { seed: 'lawyer-natural-v063', cursor: 228 } });
  }, 120_000);
  it('preserves every source field and adds only genuinely missing current roots', () => {
    const old = original(), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('princeOfAbolition'); expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key]);
    for (const key of added) same(current[key], defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.princeOfAbolition, createPrinceOfAbolitionState()); same(migrateSliceState(s), s);
    expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 120_000);
  it('retains all14 values, three zeros, original objects, dead Marlow and surrendered Oswin', () => {
    const old = original() as unknown as SliceState, s = migrateSliceState(old);
    same(s.character, old.character); same(s.progression, old.progression); same(s.injuries, old.injuries);
    expect(s.injuries).toEqual([]); expect(Object.keys(s.progression.mastery)).toHaveLength(14);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(3);
    for (const id of ['black-emperor.s7.bribery-weakening', 'black-emperor.s5.disorder', 'black-emperor.s3.ordered-deviation']) expect(s.progression.mastery[id]).toBe(0);
    for (const id of ['black-emperor.s2.action-amplification', 'black-emperor.s2.effect-prolongation']) expect(s.progression.mastery[id]).toBe(8);
    for (const id of PRINCE_OF_ABOLITION_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of PRINCE_OF_ABOLITION_SOURCE_KEYS) same(s[key], old[key]);
    expect(s.progression.promotionWeek).toBe(6); expect(s.entropyDuke.promotionWeek).toBe(175);
    expect(s.character.coreStats).toEqual({ physique: 29, perception: 23, will: 25, knowledge: 23 });
    expect(s.frenzyMage.life).toMatchObject({ siteId: 'FM3-DELIVERY-PRACTICE', playerLocation: 'START', clockSeconds: 449, playerTravelMetres: 120, guideTravelMetres: 52,
      guide: { id: 'GUIDE', name: '米蕾·沃德', location: 'OUTSIDE' }, volunteer: { id: 'FM3-DARIAN', age: 42, location: 'OUTSIDE', willing: true, alive: true, independentMind: true, health: 100, mind: 100, injuries: [] },
      parcel: { id: 'FM3-PARCEL', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, massGrams: 400 },
      ball: { id: 'FM3-PRACTICE-BALL', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, massGrams: 80 },
      paper: { id: 'FM3-ROUTE-PAPER', owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1, text: '从A到B' } });
    expect(s.frenzyMage.life.pads).toEqual([{ id: 'FM3-PAD-B', location: 'B', padded: true, people: 0 }, { id: 'FM3-PAD-C', location: 'C', padded: true, people: 0 }]);
    for (const person of [s.frenzyMage.life.guide, s.frenzyMage.life.volunteer]) expect(Object.hasOwn(person, 'energy')).toBe(false);
    expect(Object.hasOwn(s.frenzyMage.life.guide, 'mind')).toBe(false);
    expect(s.frenzyMage.life).not.toEqual(s.entropyDuke.life.source!.snapshot);
    expect(s.entropyDuke.life.source!.snapshot.clockSeconds).toBe(85); expect(s.entropyDuke.encounter.startRoot!.clockSeconds).toBe(249);
    expect(s.entropyDuke.life.operation).toEqual({ door: 'OPEN', inputActive: false, flight: null });
    expect(s.entropyDuke.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'ED2-OSWIN', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 85, weaponLocation: 'HAND', enemyPosition: 'BETWEEN_A_AND_B', enemyRisk: 1 });
    expect(s.entropyDuke.encounter.enemyInjuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 741, null], ['HEAVY', 743, null]]);
    expect(s.fallenEarl.encounter).toMatchObject({ enemyStatus: 'DEAD', enemyHealth: 0 });
    expect(s.briber.gifts).toHaveLength(15); expect(s.briber.gifts.filter(g => g.location === 'GIVEN')).toHaveLength(12);
    expect(s.briber.gifts.filter(g => g.location === 'PLAYER').map(g => g.id)).toEqual(['BR7-GIFT-13', 'BR7-GIFT-14', 'BR7-GIFT-15']);
    expect(s.entropyDuke.bottles.map(b => [b.status, b.outcome])).toEqual([['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'FAILURE'], ['CONSUMED', 'GREAT_SUCCESS'], ['SUPPLIER', null], ['SUPPLIER', null]]);
    same(s.combatHistory, old.combatHistory); same(s.chronicle, old.chronicle);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 120_000);
  it('rejects missing current roots, fabricated old roots and future formats without destructive edits', () => {
    const old = original(), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.princeOfAbolition;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, princeOfAbolition: createPrinceOfAbolitionState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    for (const key of PRINCE_OF_ABOLITION_SOURCE_KEYS) {
      const rootLoss = structuredClone(s) as unknown as Record<string, unknown>; delete rootLoss[key];
      expect(() => assertValidSliceState(rootLoss), key).toThrow();
    }
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 120_000);
  it('accepts exact IDs and independently confirmed consumption only', () => {
    const payload = (command: unknown) => ({ type: 'PRINCE_OF_ABOLITION', command });
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE' }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE', free: true }))).toBe(false);
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN']) expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId: 'CHECK_SPIRITS' }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'prince-of-abolition-potion-1', confirmed: true }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'prince-of-abolition-potion-1', confirmed: false }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'entropy-duke-potion-1', confirmed: true }))).toBe(false);
  });
});
