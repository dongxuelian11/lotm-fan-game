import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { createHandOfOrderState } from '../../src/domain/hand-of-order/index.js';
import { HAND_OF_ORDER_ABILITY_IDS, HAND_OF_ORDER_INHERITED_ABILITY_IDS, HAND_OF_ORDER_SOURCE_KEYS } from '../../src/domain/hand-of-order/types.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { HAND_OF_ORDER_CAPTURE_EVIDENCE as evidence } from './hand-of-order-capture-evidence.js';
import { HAND_OF_ORDER_SOURCE as SOURCE, HAND_OF_ORDER_RECOVERY as RECOVERY, HAND_OF_ORDER_DEATH as DEATH, HAND_OF_ORDER_SEED as SEED,
  HAND_OF_ORDER_PREFIX_COUNT as PREFIX, HAND_OF_ORDER_INHERITED_COUNT as INHERITED, HAND_OF_ORDER_COMMON_COUNT as COMMON, HAND_OF_ORDER_DEATH_COUNT as DEATH_COUNT,
  sourceEntry, captureFileHash, captureValueHash, insertionOrderHash, currentCapture, originalLivingPrefix, assertOriginalContinuity, sameCaptureValue as same } from './hand-of-order-capture-helper.js';

// Historical evidence is independent of whether this new natural continuation promotes or survives.
describe('Hand of Order authentic594 source, paid-recovery483 and separately preserved477 death', () => {
  it('pins untouched raw181/594, raw159/483 and raw158/477 evidence with an exact common474 branch', async () => {
    expect(await captureFileHash(SOURCE)).toBe(evidence.sourceSha256); expect(await captureFileHash(RECOVERY)).toBe(evidence.recoverySha256); expect(await captureFileHash(DEATH)).toBe(evidence.deathSha256);
    const commands = sourceEntry<SliceIntent[]>('commands'), recovered = readObjectEntry<SliceIntent[]>(RECOVERY, 'commands'), death = readObjectEntry<SliceIntent[]>(DEATH, 'commands');
    expect([commands.length, recovered.length, death.length, COMMON]).toEqual([594, 483, 477, 474]);
    expect(commands).toHaveLength(PREFIX); expect(recovered).toHaveLength(INHERITED); expect(death).toHaveLength(DEATH_COUNT);
    expect(sourceEntry('prefixCount')).toBe(INHERITED); expect(sourceEntry('prefixVerified')).toBe(true); expect(sourceEntry('seed')).toBe(SEED);
    same(commands.slice(0, INHERITED), recovered); same(recovered.slice(0, COMMON), death.slice(0, COMMON)); expect(recovered[COMMON]).not.toEqual(death[COMMON]);
    expect(insertionOrderHash(commands)).toBe(evidence.prefixSha256); expect(insertionOrderHash(recovered)).toBe(evidence.inheritedSha256);
    expect(sourceEntry('provenance')).toEqual({ kind: 'SAME_SEED_ORIGINAL_LIVING_BRANCH_PUBLIC_CONTINUATION', source: RECOVERY, sourceSha256: evidence.recoverySha256, newRandomChanges: false });
    expect(readObjectEntry(RECOVERY, 'provenance')).toMatchObject({ source: DEATH, originalDeathPreserved: true, originalCommands: 477, prefixCommands: 474, randomEdits: false, freeHealing: false });
    for (const [path, schema, content] of [[SOURCE, 181, 'balancer-v181'], [RECOVERY, 159, 'coffin-bearer-v159'], [DEATH, 158, 'chaos-hunter-v158']] as const) {
      expect(readObjectEntry(path, 'seed')).toBe(SEED); same(readObjectEntry(path, 'creation'), sourceEntry('creation'));
      for (const key of ['initial', 'final']) { const raw = readObjectEntry<SliceState>(path, key); expect([raw.schemaVersion, raw.contentVersion]).toEqual([schema, content]); }
    }
    same(currentCapture(sourceEntry('prefixFinal')), currentCapture(readObjectEntry(RECOVERY, 'final')));
    expect(readObjectEntry<SliceState>(DEATH, 'final')).toMatchObject({ status: 'DEAD', health: 0, revision: 478, ending: { kind: 'DEATH' }, random: { seed: SEED, cursor: 290 } });
  }, 120_000);

  it('explicitly migrates old formats to CURRENT without altering any historical root, injury, command or RNG', () => {
    for (const key of ['initial', 'prefixFinal', 'final']) {
      const raw = sourceEntry<Record<string, unknown>>(key), hash = captureValueHash(raw), s = currentCapture(raw), current = s as unknown as Record<string, unknown>;
      const defaults = createSliceRun(s.runId, sourceEntry<Parameters<typeof createSliceRun>[1]>('creation'), SEED) as unknown as Record<string, unknown>;
      const added = Object.keys(defaults).filter(k => !Object.hasOwn(raw, k));
      expect(added).toContain('handOfOrder'); expect(Object.keys(current).filter(k => !Object.hasOwn(raw, k)).sort()).toEqual([...added].sort());
      for (const k of Object.keys(raw)) if (k !== 'schemaVersion' && k !== 'contentVersion') same(current[k], raw[k]);
      for (const k of added) same(current[k], defaults[k]);
      expect([s.schemaVersion, s.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]); same(s.handOfOrder, createHandOfOrderState());
      same(migrateSliceState(s), s); expect(captureValueHash(raw)).toBe(hash); assertValidSliceState(s);
    }
  }, 120_000);

  it('retains exact17 masteries, both untreated wounds, real clock767 site, plate65 and original resisting Caspar', () => {
    const s = originalLivingPrefix();
    expect(s).toMatchObject({ runId: 'arbiter-rebuild-natural', status: 'ACTIVE', revision: 595, week: 135, health: 60, mind: 96, spirituality: 120, cash: 690, actionsRemaining: 3, injuryRisk: 1,
      date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 1, day: 22 }, random: { seed: SEED, cursor: 367 }, careKnown: true });
    expect(s.progression).toMatchObject({ sequence: 2, acting: 100, promotionWeek: 9 }); expect(s.balancer.promotionWeek).toBe(126);
    expect(s.character).toMatchObject({ name: '艾洛', gender: 'FEMALE', age: 26, weeklyWage: 180, coreStats: { physique: 30, perception: 25, will: 25, knowledge: 21 } });
    expect(Object.keys(s.progression.mastery)).toEqual([...HAND_OF_ORDER_INHERITED_ABILITY_IDS]); expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(6);
    for (const id of HAND_OF_ORDER_ABILITY_IDS) expect(Object.hasOwn(s.progression.mastery, id)).toBe(false);
    expect(s.progression.mastery['justiciar.s2.imbalance-sensing']).toBe(8); expect(s.progression.mastery['justiciar.s2.measured-resistance']).toBe(0);
    expect(s.injuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 590, null], ['HEAVY', 593, null]]); expect(s.seer.pollution).toBe(0);
    const p = s.chaosHunter.life;
    expect(p).toMatchObject({ playerLocation: 'START', clockSeconds: 767, playerTravelMetres: 124, guideTravelMetres: 92,
      guide: { name: '薇娜·贝尔', location: 'OUTSIDE' }, volunteer: { id: 'CH3-MIRA', age: 43, alive: true, willing: false, location: 'OUTSIDE', health: 100, mind: 100 } });
    expect(p).not.toEqual(s.balancer.life.source!.snapshot); expect(Object.hasOwn(p.volunteer, 'energy')).toBe(false);
    for (const object of [p.parcel, p.line, p.paper]) expect(object).toMatchObject({ owner: 'GUIDE', holder: 'GUIDE', location: 'OUTSIDE', quantity: 1 });
    expect(p.parcel.massGrams).toBe(350); expect(p.paper.text).toBe('本次从A到B的越线'); expect(p.table).toMatchObject({ id: 'CH3-TABLE-B', location: 'B' });
    expect(s.balancer.life.operation).toEqual({ door: 'OPEN', truth: null, effect: null });
    expect(s.balancer.life.guardPlate).toEqual({ id: 'BA2-GUARD-PLATE', owner: 'PLAYER', holder: 'PLAYER', location: 'START', integrity: 65, acquiredWeek: 126 });
    expect(s.balancer.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 90, enemyMind: 100, enemySpirituality: 67, enemyPosition: 'BETWEEN_A_AND_B', weaponLocation: 'HAND' });
    expect(s.balancer.encounter.enemyInjuries.map(i => [i.severity, i.acquiredRevision, i.treatedRevision])).toEqual([['LIGHT', 592, null]]);
    expect(s.chaosHunter.encounter.enemyStatus).toBe('SURRENDERED'); expect(s.imperativeMage.encounter.enemyStatus).toBe('SURRENDERED'); assertOriginalContinuity(s, s);
  }, 120_000);

  it('replays only the genuine common474 death tail and proves that the preserved original477 death cannot continue', () => {
    const raw = readObjectEntry<SliceState>(RECOVERY, 'initial'), hash = captureValueHash(raw), commands = readObjectEntry<SliceIntent[]>(DEATH, 'commands');
    expect(raw).toMatchObject({ status: 'ACTIVE', revision: 475, random: { seed: SEED, cursor: 274 } });
    let state = currentCapture(raw);
    for (const intent of commands.slice(COMMON)) { expect(state.status).toBe('ACTIVE'); state = applySliceIntent(state, intent); assertValidSliceState(state); }
    same(state, currentCapture(readObjectEntry(DEATH, 'final'))); expect(state).toMatchObject({ status: 'DEAD', health: 0, revision: 478, random: { seed: SEED, cursor: 290 } });
    expect(projectSliceState(state).canAct).toBe(false); const sealed = captureValueHash(state);
    for (const intent of [{ type: 'CONTINUE_LIFE' }, { type: 'ACTION', action: 'REST' }, { type: 'HAND_OF_ORDER', command: { type: 'LEARN_GUIDANCE' } }, { type: 'COMBAT_ROUND', stance: 'CONTROL' }] as SliceIntent[]) {
      expect(() => applySliceIntent(state, intent)).toThrow(); expect(captureValueHash(state)).toBe(sealed);
    }
    expect(captureValueHash(raw)).toBe(hash);
  }, 120_000);

  it('rejects future formats, forged old-schema new roots and missing CURRENT history without mutating the real source', () => {
    const s = originalLivingPrefix(), hash = captureValueHash(s);
    for (const key of [...HAND_OF_ORDER_SOURCE_KEYS, 'handOfOrder'] as const) { const invalid = structuredClone(s) as Partial<SliceState>; delete invalid[key]; expect(() => migrateSliceState(invalid), key).toThrow(); }
    expect(() => migrateSliceState({ ...s, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toThrow(); expect(() => migrateSliceState({ ...s, contentVersion: 'unknown-future-hand-of-order' })).toThrow();
    expect(() => migrateSliceState({ ...sourceEntry<Record<string, unknown>>('final'), handOfOrder: createHandOfOrderState() })).toThrow(); expect(captureValueHash(s)).toBe(hash);
  }, 120_000);
});
