import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createPaleEmperorState } from '../../src/domain/pale-emperor/index.js';
import { PALE_EMPEROR_ABILITY_IDS, PALE_EMPEROR_SOURCE_KEYS } from '../../src/domain/pale-emperor/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/death-consul-v01730/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const original = () => entry<Record<string, unknown>>('final');
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
describe('Pale Emperor strict migration and genuine wounded source', () => {
  it('pins815 actual commands and raw170 independently of current schema', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('283fa4554282597027a6e65f2a31c561750769fb3f93343e570abebac11fdee9');
    expect(entry<SliceIntent[]>('commands')).toHaveLength(815);
    expect(original()).toMatchObject({ schemaVersion: 170, contentVersion: 'death-consul-v170', status: 'ACTIVE', revision: 816, week: 3290,
      health: 20, mind: 100, spirituality: 95, cash: 34, actionsRemaining: 1, injuryRisk: 6, random: { seed: 'corpsecollector-natural-v032', cursor: 359 } });
  }, 120_000);
  it('preserves every existing field and initializes only genuinely missing roots', () => {
    const old = original(), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('paleEmperor');
    expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key]);
    for (const key of added) same(current[key], defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.paleEmperor, createPaleEmperorState()); same(migrateSliceState(s), s);
    expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 120_000);
  it('retains17 original skills, five zeros, four wounds and all original outcomes', () => {
    const old = original() as unknown as SliceState, s = migrateSliceState(old);
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    same(s.character, old.character); same(s.progression, old.progression); same(s.injuries, old.injuries);
    expect(Object.keys(s.progression.mastery)).toHaveLength(17); expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(5);
    for (const id of PALE_EMPEROR_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of PALE_EMPEROR_SOURCE_KEYS) same(s[key], old[key]);
    expect(s.deathConsul.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 80 });
    expect(s.undying.encounter).toMatchObject({ status: 'AVAILABLE', enemy: { health: 100, status: 'RESISTING' } });
    expect(s.undying.lifecycle.experiencedCycles).toBe(1);
    expect(s.deathConsul.promotionWeek).toBe(3284);
    same(s.combatHistory, old.combatHistory); same(s.chronicle, old.chronicle);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 120_000);
  it('rejects missing current roots, fabricated historical roots and future formats', () => {
    const old = original(), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.paleEmperor;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, paleEmperor: createPaleEmperorState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 120_000);
  it('accepts only exact preparation IDs, exact bottles and independent confirmation', () => {
    expect(validateSlicePayload({ type: 'PALE_EMPEROR', command: { type: 'LEARN_GUIDANCE' } })).toBe(true);
    expect(validateSlicePayload({ type: 'PALE_EMPEROR', command: { type: 'LEARN_GUIDANCE', free: true } })).toBe(false);
    expect(validateSlicePayload({ type: 'PALE_EMPEROR', command: { type: 'CONFIRM_TRANSFORMATION', confirmed: true } })).toBe(false);
    expect(validateSlicePayload({ type: 'PALE_EMPEROR', command: { type: 'PREPARE_TASK', taskId: 'VERIFY_RESIDUAL' } })).toBe(true);
    expect(validateSlicePayload({ type: 'PALE_EMPEROR', command: { type: 'PREPARE_TASK', taskId: 'LOCATE_TARGET' } })).toBe(false);
    expect(validateSlicePayload({ type: 'PALE_EMPEROR', command: { type: 'CONSUME', bottleId: 'pale-emperor-potion-1', confirmed: true } })).toBe(true);
    expect(validateSlicePayload({ type: 'PALE_EMPEROR', command: { type: 'CONSUME', bottleId: 'pale-emperor-potion-1', confirmed: false } })).toBe(false);
  });
});
