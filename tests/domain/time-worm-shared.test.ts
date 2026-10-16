import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState, createSliceRun, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createTimeWormState } from '../../src/domain/time-worm/index.js';
import { TIME_WORM_ABILITY_IDS, TIME_WORM_SOURCE_KEYS } from '../../src/domain/time-worm/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { originalFateTrojan, fateTrojanNaturalPath } from './time-worm-directed-helper.js';
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));

describe('Time Worm current format and genuine original continuity', () => {
  it('preserves every original172 field and initializes only genuinely missing roots', () => {
    const old = readObjectEntry<Record<string, unknown>>(fateTrojanNaturalPath, 'final'), bytes = stableStringify(old), s = migrateSliceState(old);
    const creation = readObjectEntry<Parameters<typeof createSliceRun>[1]>(fateTrojanNaturalPath, 'creation');
    const defaults = createSliceRun(s.runId, creation, s.random.seed) as unknown as Record<string, unknown>, current = s as unknown as Record<string, unknown>;
    const added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k)); expect(added).toContain('timeWorm');
    expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const k of Object.keys(old)) if (k !== 'schemaVersion' && k !== 'contentVersion') same(current[k], old[k]);
    for (const k of added) same(current[k], defaults[k]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.timeWorm, createTimeWormState()); same(migrateSliceState(s), s); expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 60_000);
  it('retains all14 real skills, one zero, all injuries and the fulfilled original parcel', () => {
    const s = originalFateTrojan(), raw = readObjectEntry<SliceState>(fateTrojanNaturalPath, 'final');
    expect(Object.keys(s.progression.mastery)).toHaveLength(14); expect(Object.values(s.progression.mastery).filter(x => x === 0)).toHaveLength(1);
    for (const id of TIME_WORM_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of TIME_WORM_SOURCE_KEYS) same(s[key], raw[key]);
    expect(s.fateTrojan.life.site.parcel.location).toBe('OUTSIDE'); expect(s.fateTrojan.life.site.fate.status).toBe('COMPLETED');
    expect(s.parasite.life.host).toMatchObject({ mode: 'NONE', control: 'HOST' });
    same(s.injuries, raw.injuries); same(s.combatHistory, raw.combatHistory); same(s.character, raw.character);
    expect(s.health).toBe(40); expect(s.injuryRisk).toBe(2); expect(s.fateTrojan.life.site.playerEnergy).toBe(9);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 60_000);
  it('fails closed for missing current roots, forged old roots and unknown future formats', () => {
    const raw = readObjectEntry<Record<string, unknown>>(fateTrojanNaturalPath, 'final'), s = originalFateTrojan();
    const missing = structuredClone(s) as unknown as Record<string, unknown>; delete missing.timeWorm;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...raw, timeWorm: createTimeWormState() }, bytes = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(bytes);
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 60_000);
  it('requires exact command payload and independent bottle confirmation', () => {
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'PREPARE_TASK', taskId: 'DECLARE_PENDING_ACTION' }, { type: 'CONSUME', bottleId: 'time-worm-potion-1', confirmed: true }]) expect(validateSlicePayload({ type: 'TIME_WORM', command })).toBe(true);
    for (const command of [{ type: 'LEARN_GUIDANCE', free: true }, { type: 'PREPARE_TASK', taskId: 'LOCATE_ANYTHING' }, { type: 'CONSUME', bottleId: 'time-worm-potion-1', confirmed: false }, { type: 'CONSUME', bottleId: 'fate-trojan-potion-2', confirmed: true }, { type: 'CONFIRM_TRANSFORMATION', confirmed: true }]) expect(validateSlicePayload({ type: 'TIME_WORM', command })).toBe(false);
  });
});
