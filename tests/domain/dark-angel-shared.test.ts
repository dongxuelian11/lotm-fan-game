import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createDarkAngelState } from '../../src/domain/dark-angel/index.js';
import { DARK_ANGEL_ABILITY_IDS, DARK_ANGEL_SOURCE_KEYS } from '../../src/domain/dark-angel/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/elder-v01790/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const original = () => entry<Record<string, unknown>>('final');
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));

describe('Dark Angel exact migration and actual wounded Elder source', () => {
  it('pins615 actual commands and raw176 independently of the current output format', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('06a23ce47295f72e78428f19d2559d6aab833dc978c58ce560f564c0e1d37b3a');
    expect(entry<SliceIntent[]>('commands')).toHaveLength(615);
    expect(original()).toMatchObject({ schemaVersion: 176, contentVersion: 'elder-v176', status: 'ACTIVE', revision: 616, week: 145,
      health: 60, mind: 94, spirituality: 118, cash: 818, actionsRemaining: 3, injuryRisk: 1, random: { seed: 'secret-supplicant-natural-v051', cursor: 353 } });
  }, 120_000);
  it('preserves every existing field and adds only genuinely missing roots', () => {
    const old = original(), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('darkAngel'); expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key]);
    for (const key of added) same(current[key], defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.darkAngel, createDarkAngelState()); same(migrateSliceState(s), s);
    expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 120_000);
  it('retains15 original skills, two zeros, light/heavy wounds and all eight actual roots', () => {
    const old = original() as unknown as SliceState, s = migrateSliceState(old);
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['HEAVY', null]]);
    same(s.character, old.character); same(s.progression, old.progression); same(s.injuries, old.injuries);
    expect(Object.keys(s.progression.mastery)).toHaveLength(15); expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(2);
    expect(s.progression.mastery['hanged-man.s6.flesh-shaping']).toBe(0); expect(s.progression.mastery['hanged-man.s5.borrowed-arts']).toBe(0);
    for (const id of DARK_ANGEL_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of DARK_ANGEL_SOURCE_KEYS) same(s[key], old[key]);
    expect(s.elder.promotionWeek).toBe(135);
    expect(s.elder.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 100, enemySpirituality: 90, weaponLocation: 'HAND', enemyPosition: 'A' });
    expect(s.threeHeadedTemplar.life).toMatchObject({ playerLocation: 'START', clockSeconds: 933, playerTravelMetres: 88,
      owner: { location: 'OUTSIDE', willing: true }, card: { location: 'TABLE', travelMetres: 40 }, lamp: { on: false }, shutter: { state: 'CLOSED' },
      spirits: { 'THT3-HELENA': { status: 'GRAZED', location: 'INTERNAL', spirituality: 18, integrity: 60, interrupted: true },
        'THT3-ROLAND': { status: 'GRAZED', location: 'INTERNAL', spirituality: 21, integrity: 100 } } });
    expect(s.elder.life.operation.materials.map(m => [m.status, m.location, m.charges, m.spentCharges])).toEqual([['RETURNED', 'OWNER', 1, 1], ['RETURNED', 'OWNER', 1, 1], ['RETURNED', 'OWNER', 0, 2]]);
    expect(s.elder.life.operation).toMatchObject({ contained: true, residualPressure: 3, sealWear: 5, focus: null, suppressedUntil: null });
    expect(s.roseBishop.reserve.points).toBe(1); expect(s.roseBishop.reserve.packets).toHaveLength(6);
    expect(s.roseBishop.reserve.packets.every(packet => packet.status === 'CONSUMED')).toBe(true);
    expect(s.shepherd.grazing.spirits.find(spirit => spirit.id === 'SH5-CEDRIC-1')).toMatchObject({ status: 'RELEASED', releasedWeek: 64 });
    same(s.combatHistory, old.combatHistory); same(s.chronicle, old.chronicle);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 120_000);
  it('rejects missing current roots, fabricated historical roots and future formats', () => {
    const old = original(), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.darkAngel;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, darkAngel: createDarkAngelState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 120_000);
  it('accepts exact IDs and independently confirmed consumption only', () => {
    const payload = (command: unknown) => ({ type: 'DARK_ANGEL', command });
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE' }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE', free: true }))).toBe(false);
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_SPIRITS', 'CHECK_RETURN']) expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId: 'LOCATE_TARGET' }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'dark-angel-potion-1', confirmed: true }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'dark-angel-potion-1', confirmed: false }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'elder-potion-1', confirmed: true }))).toBe(false);
  });
});
