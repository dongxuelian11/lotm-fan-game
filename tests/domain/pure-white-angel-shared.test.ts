import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createPureWhiteAngelState } from '../../src/domain/pure-white-angel/index.js';
import { PURE_WHITE_ANGEL_ABILITY_IDS, PURE_WHITE_ANGEL_SOURCE_KEYS } from '../../src/domain/pure-white-angel/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/light-seeker-v01720/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const original = () => entry<Record<string, unknown>>('final');
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));
describe('Pure White Angel strict migration and genuine wounded source', () => {
  it('pins729 actual commands and raw169 independently of current schema', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('0a06e9fa84a0b384aea3bf7bb79a7e72b2620ec113ad517bee2af14df35ae556');
    expect(entry<SliceIntent[]>('commands')).toHaveLength(729);
    expect(original()).toMatchObject({ schemaVersion: 169, contentVersion: 'light-seeker-v169', status: 'ACTIVE', revision: 730, week: 175,
      health: 50, mind: 100, spirituality: 87, cash: 540, actionsRemaining: 3, injuryRisk: 3, random: { seed: 'bard-natural-v029', cursor: 356 } });
  }, 120_000);
  it('preserves every existing field and initializes only genuinely missing roots', () => {
    const old = original(), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('pureWhiteAngel');
    expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key]);
    for (const key of added) same(current[key], defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.pureWhiteAngel, createPureWhiteAngelState()); same(migrateSliceState(s), s);
    expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 120_000);
  it('retains20 original skills, five zeros, three wounds and all original outcomes', () => {
    const old = original() as unknown as SliceState, s = migrateSliceState(old);
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    same(s.character, old.character); same(s.progression, old.progression); same(s.injuries, old.injuries);
    expect(Object.keys(s.progression.mastery)).toHaveLength(20); expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(5);
    for (const id of PURE_WHITE_ANGEL_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of PURE_WHITE_ANGEL_SOURCE_KEYS) same(s[key], old[key]);
    expect(s.lightSeeker.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'DEAD', enemyHealth: 0 });
    same(s.combatHistory, old.combatHistory); same(s.chronicle, old.chronicle);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 120_000);
  it('rejects missing current roots, fabricated historical roots and future formats', () => {
    const old = original(), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.pureWhiteAngel;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, pureWhiteAngel: createPureWhiteAngelState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 120_000);
  it('accepts only exact preparation IDs, exact bottles and independent confirmation', () => {
    expect(validateSlicePayload({ type: 'PURE_WHITE_ANGEL', command: { type: 'LEARN_GUIDANCE' } })).toBe(true);
    expect(validateSlicePayload({ type: 'PURE_WHITE_ANGEL', command: { type: 'LEARN_GUIDANCE', free: true } })).toBe(false);
    expect(validateSlicePayload({ type: 'PURE_WHITE_ANGEL', command: { type: 'CONFIRM_TRANSFORMATION', confirmed: true } })).toBe(false);
    expect(validateSlicePayload({ type: 'PURE_WHITE_ANGEL', command: { type: 'PREPARE_TASK', taskId: 'VERIFY_TARGET' } })).toBe(true);
    expect(validateSlicePayload({ type: 'PURE_WHITE_ANGEL', command: { type: 'PREPARE_TASK', taskId: 'LOCATE_TARGET' } })).toBe(false);
    expect(validateSlicePayload({ type: 'PURE_WHITE_ANGEL', command: { type: 'CONSUME', bottleId: 'pure-white-angel-potion-1', confirmed: true } })).toBe(true);
    expect(validateSlicePayload({ type: 'PURE_WHITE_ANGEL', command: { type: 'CONSUME', bottleId: 'pure-white-angel-potion-1', confirmed: false } })).toBe(false);
  });
});
