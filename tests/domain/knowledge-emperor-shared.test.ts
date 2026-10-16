import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stableStringify } from '../../src/domain/canonical.js';
import { createSliceRun, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { createKnowledgeEmperorState } from '../../src/domain/knowledge-emperor/index.js';
import { KNOWLEDGE_EMPEROR_ABILITY_IDS, KNOWLEDGE_EMPEROR_SOURCE_KEYS } from '../../src/domain/knowledge-emperor/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
const SOURCE = 'tests/fixtures/sage-v01780/natural.json';
const entry = <T>(key: string): T => readObjectEntry<T>(SOURCE, key);
const original = () => entry<Record<string, unknown>>('final');
const same = (a: unknown, b: unknown) => expect(stableStringify(a)).toBe(stableStringify(b));

describe('Knowledge Emperor exact migration and actual wounded Sage source', () => {
  it('pins651 actual commands and raw175 independently of the current output format', () => {
    expect(createHash('sha256').update(readFileSync(SOURCE)).digest('hex')).toBe('a0e37a9db792f8a6906efa92dbec3b13e0c1dff00ad9df492158b7d05b569766');
    expect(entry<SliceIntent[]>('commands')).toHaveLength(651);
    expect(original()).toMatchObject({ schemaVersion: 175, contentVersion: 'sage-v175', status: 'ACTIVE', revision: 652, week: 152,
      health: 40, mind: 98, spirituality: 120, cash: 770, actionsRemaining: 3, injuryRisk: 1, random: { seed: 'pryer-natural-v048', cursor: 340 } });
  }, 120_000);
  it('preserves every existing field and adds only genuinely missing roots', () => {
    const old = original(), bytes = stableStringify(old), s = migrateSliceState(old);
    const defaults = createSliceRun(s.runId, entry<Parameters<typeof createSliceRun>[1]>('creation'), entry<string>('seed')) as unknown as Record<string, unknown>;
    const current = s as unknown as Record<string, unknown>, added = Object.keys(defaults).filter(k => !Object.hasOwn(old, k));
    expect(added).toContain('knowledgeEmperor'); expect(Object.keys(current).filter(k => !Object.hasOwn(old, k)).sort()).toEqual([...added].sort());
    for (const key of Object.keys(old)) if (key !== 'schemaVersion' && key !== 'contentVersion') same(current[key], old[key]);
    for (const key of added) same(current[key], defaults[key]);
    expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
    same(s.knowledgeEmperor, createKnowledgeEmperorState()); same(migrateSliceState(s), s);
    expect(stableStringify(old)).toBe(bytes); assertValidSliceState(s);
  }, 120_000);
  it('retains13 original skills, three zeros, both heavy wounds and all eight actual roots', () => {
    const old = original() as unknown as SliceState, s = migrateSliceState(old);
    expect(s.injuries.map(i => [i.severity, i.treatedRevision])).toEqual([['HEAVY', null], ['HEAVY', null]]);
    same(s.character, old.character); same(s.progression, old.progression); same(s.injuries, old.injuries);
    expect(Object.keys(s.progression.mastery)).toHaveLength(13); expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(3);
    for (const id of KNOWLEDGE_EMPEROR_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    for (const key of KNOWLEDGE_EMPEROR_SOURCE_KEYS) same(s[key], old[key]);
    expect(s.sage.promotionWeek).toBe(142);
    expect(s.sage.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 100, enemyMind: 100, enemySpirituality: 77, weaponLocation: 'HAND' });
    expect(s.sage.encounter.currentSite).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: 30, clockSeconds: 510, playerTravelMetres: 66,
      formEnergySpent: 4, assimilationExposure: 4, iris: { energy: 78, travelMetres: 22, location: 'OUTSIDE' }, record: { location: 'OWNER', travelMetres: 72 } });
    expect(s.sage.encounter.currentSite!.materials.map(m => [m.status, m.location, m.wear])).toEqual([['RETURNED', 'OWNER', 2], ['RETURNED', 'OWNER', 2], ['RETURNED', 'OWNER', 4]]);
    same(s.combatHistory, old.combatHistory); same(s.chronicle, old.chronicle);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
  }, 120_000);
  it('rejects missing current roots, fabricated historical roots and future formats', () => {
    const old = original(), s = migrateSliceState(old), missing = structuredClone(s) as unknown as Record<string, unknown>;
    delete missing.knowledgeEmperor;
    expect(() => migrateSliceState(missing)).toThrow(); expect(() => assertValidSliceState(missing)).toThrow();
    const forged = { ...old, knowledgeEmperor: createKnowledgeEmperorState() }, before = stableStringify(forged);
    expect(() => migrateSliceState(forged)).toThrow(); expect(stableStringify(forged)).toBe(before);
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow();
    expect(() => assertValidSliceState({ ...s, contentVersion: 'unknown-future' })).toThrow();
  }, 120_000);
  it('accepts exact IDs and independently confirmed consumption only', () => {
    const payload = (command: unknown) => ({ type: 'KNOWLEDGE_EMPEROR', command });
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE' }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'LEARN_GUIDANCE', free: true }))).toBe(false);
    for (const taskId of ['VERIFY_ORIGINALS', 'VERIFY_KNOWLEDGE', 'CHECK_RETURN']) expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'PREPARE_TASK', taskId: 'LOCATE_TARGET' }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'knowledge-emperor-potion-1', confirmed: true }))).toBe(true);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'knowledge-emperor-potion-1', confirmed: false }))).toBe(false);
    expect(validateSlicePayload(payload({ type: 'CONSUME', bottleId: 'sage-potion-1', confirmed: true }))).toBe(false);
  });
});
