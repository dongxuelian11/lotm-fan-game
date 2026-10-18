import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createHandOfOrderState } from '../../src/domain/hand-of-order/index.js';
import { HAND_OF_ORDER_ABILITY_IDS, HAND_OF_ORDER_INHERITED_ABILITY_IDS, HAND_OF_ORDER_SOURCE_KEYS } from '../../src/domain/hand-of-order/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/balancer-v01840/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);

describe('HandOfOrder exact whole594 source and current-format migration', () => {
  it('pins raw181 source independently of the moving current format', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('e9437ca076c8f9779f8586970308b03032d4b67a13b0588809966818bda264e1');
    expect(entry<SliceIntent[]>('commands')).toHaveLength(594);
    expect(entry<number>('prefixCount')).toBe(483); expect(entry<boolean>('prefixVerified')).toBe(true);
    expect(entry<string>('seed')).toBe('arbiter-natural-v066');
    expect(entry<SliceState>('final')).toMatchObject({ schemaVersion: 181, contentVersion: 'balancer-v181', status: 'ACTIVE', revision: 595, week: 135,
      health: 60, mind: 96, spirituality: 120, cash: 690, actionsRemaining: 3, injuryRisk: 1,
      date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 22 }, random: { seed: 'arbiter-natural-v066', cursor: 367 } });
  }, 120_000);
  it('adds only missing current roots and preserves all raw fields, source wounds and random state', () => {
    const old = entry<Record<string, unknown>>('final'), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('handOfOrder'); expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') expect(stableStringify(current[key]), key).toBe(stableStringify(old[key]));
    for (const key of added) expect(current[key], key).toEqual(defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    expect(s.handOfOrder).toEqual(createHandOfOrderState()); expect(migrateSliceState(s)).toEqual(s); expect(stableStringify(old)).toBe(bytes);
    expect(s.injuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 590, null], ['HEAVY', 593, null]]);
    expect(Object.keys(s.progression.mastery)).toEqual([...HAND_OF_ORDER_INHERITED_ABILITY_IDS]);
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(6);
    for (const id of HAND_OF_ORDER_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    assertValidSliceState(s);
  }, 120_000);
  it('rejects loss or fabrication of current/source roots without destructive migration', () => {
    const old = entry<Record<string, unknown>>('final'), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.handOfOrder;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, handOfOrder: createHandOfOrderState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    for (const key of HAND_OF_ORDER_SOURCE_KEYS) {
      const bad = structuredClone(s) as unknown as Record<string, unknown>; delete bad[key]; expect(() => assertValidSliceState(bad), key).toThrow();
    }
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
  }, 120_000);
  it('validates exact acquisition payloads and requires a distinct confirmed dose', () => {
    const payload = (command: unknown) => ({ type: 'HAND_OF_ORDER', command });
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE' }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE', free: true }))).toBe(false);
    for (const taskId of ['VERIFY_ORIGINALS', 'CHECK_LIMITS', 'CHECK_RETURN']) expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId: 'MARK_EXIT' }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'hand-of-order-potion-1', confirmed: true }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'hand-of-order-potion-1', confirmed: false }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'balancer-potion-1', confirmed: true }))).toBe(false);
  });
});
