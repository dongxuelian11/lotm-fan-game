import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import {
  apocalypseDemonessAcquisitionBlock, apocalypseDemonessOriginals, apocalypseDemonessPromotionModifiers,
  invalidateApocalypseDemonessPromotionStability, projectApocalypseDemoness, projectApocalypseDemonessLastCheck,
  resolveApocalypseDemonessOriginals, validateApocalypseDemonessCommand, validateApocalypseDemonessState,
} from '../../src/domain/apocalypse-demoness/index.js';
import { APOCALYPSE_DEMONESS_ABILITY_IDS, APOCALYPSE_DEMONESS_SOURCE_KEYS } from '../../src/domain/apocalypse-demoness/types.js';
import { originalBottleId, recoverySource } from '../../src/domain/apocalypse-demoness/source.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  APOCALYPSE_ACTUAL688_PATH, APOCALYPSE_ACTUAL688_SHA256, APOCALYPSE_LEGACY854_PATH, APOCALYPSE_LEGACY854_SHA256,
  acquireRecoveredDose, apocalypseStep, controlledFutureDose, loadActual688, loadLegacy854, originalApocalypseId,
  recoveryBudget, recoveryStep,
} from '../helpers/apocalypse-original-recovery-scenario.js';

const hash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const oldRoots = (s: SliceState) => Object.fromEntries(APOCALYPSE_DEMONESS_SOURCE_KEYS.map(key => [key, s[key]]));
const consume = (bottleId: string) => ({ type: 'CONSUME', bottleId, confirmed: true } as const);
function reject(s: SliceState, command: unknown): void {
  const before = structuredClone(s);
  expect(() => applySliceIntent(s, { type: 'APOCALYPSE_DEMONESS', command } as SliceIntent)).toThrow();
  expect(s).toEqual(before);
}
const acquired = new Map<number, ReturnType<typeof acquireRecoveredDose>>();
function doseFor(ordinal: 1 | 2 | 3) {
  if (!acquired.has(ordinal)) acquired.set(ordinal, acquireRecoveredDose(loadActual688(), originalApocalypseId(ordinal)));
  return structuredClone(acquired.get(ordinal)!);
}
function supported(ordinal: 1 | 2 | 3, range: readonly [number, number] = [43, 68]) {
  const { state, bottleId } = doseFor(ordinal);
  const prepared = controlledFutureDose(state, bottleId, range);
  return { prepared, state: apocalypseStep(prepared, { type: 'STABILIZE_PROMOTION', bottleId }), bottleId };
}

describe('same-original Apocalypse recovery, immutable actual688 and legacy854', () => {
  it('migrates the actual failed original-three boundary without adding recovery facts or changing any old receipt', () => {
    expect(hash(APOCALYPSE_ACTUAL688_PATH)).toBe(APOCALYPSE_ACTUAL688_SHA256);
    const raw = readObjectEntry<SliceState>(APOCALYPSE_ACTUAL688_PATH, 'final'), s = loadActual688();
    expect(s).toMatchObject({ revision: 689, week: 174, status: 'ACTIVE', health: 83, mind: 65, spirituality: 120,
      cash: 230, actionsRemaining: 2, random: { seed: 'assassin-natural-v045', cursor: 210 }, character: { gender: 'FEMALE' },
      progression: { pathwayId: 'demoness', sequence: 2, acting: 100 }, seer: { pollution: 50 } });
    expect(s.apocalypseDemoness).toEqual(raw.apocalypseDemoness);
    expect(oldRoots(s)).toEqual(oldRoots(raw));
    expect(s.apocalypseDemoness.bottles).toHaveLength(3);
    expect(s.apocalypseDemoness.bottles.map(b => b.outcome)).toEqual(['FAILURE', 'FAILURE', 'GREAT_FAILURE']);
    expect(s.apocalypseDemoness.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    expect(s.apocalypseDemoness.acquisitionJournal.filter(e => e.command.type === 'CONSUME').map(e => [e.check!.chance, e.check!.roll])).toEqual([[42, 62], [42, 77], [42, 96]]);
    expect(apocalypseDemonessOriginals(s)).toEqual(s.apocalypseDemoness.sourceScene!.originals);
    expect(apocalypseDemonessOriginals(s).site).toMatchObject({ playerLocation: 'OUTSIDE', playerEnergy: 22, playerTravelMetres: 78, clockSeconds: 407,
      vera: { location: 'OUTSIDE', energy: 92 }, marcus: { location: 'OUTSIDE', energy: 70, age: 41 } });
    expect(s.calamityDemoness.life.site).toMatchObject({ playerLocation: 'ENTRY', playerEnergy: 28 });
    expect(validateApocalypseDemonessState(s)).toBe(true);
  }, 60_000);

  it('clears pollution50 only through five actual REST actions and pays both weekly living bills', () => {
    const before = loadActual688(); let s = before;
    for (let n = 1; n <= 5; n++) {
      s = recoveryStep(s, { type: 'ACTION', action: 'REST' });
      expect(s.seer.pollution).toBe(50 - n * 10);
    }
    expect(s).toMatchObject({ week: 176, revision: 694, cash: 170, actionsRemaining: 3 });
    expect(s.random).toEqual(before.random);
    expect(s.apocalypseDemoness).toEqual(before.apocalypseDemoness);
    expect(oldRoots(s)).toEqual(oldRoots(before));
    const bills = s.chronicle.slice(before.chronicle.length).filter(e => e.title === '本周生活费');
    expect(bills).toHaveLength(2); expect(bills.every(e => e.text.includes('30便士'))).toBe(true);
  }, 60_000);

  it('requires a paid current investigation, a later real week and the authoritative original exit', () => {
    const base = loadActual688(), id = originalApocalypseId(3);
    reject(base, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: id });
    for (const type of ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY']) expect(validateApocalypseDemonessCommand({ type })).toBe(false);
    const pending = apocalypseStep(base, { type: 'REQUEST_RECOVERY_V1', bottleId: id });
    expect(pending.cash).toBe(base.cash - 120); expect(pending.actionsRemaining).toBe(base.actionsRemaining - 1);
    expect(pending.random).toEqual(base.random);
    expect(pending.apocalypseDemoness.bottles).toEqual(base.apocalypseDemoness.bottles);
    expect(pending.apocalypseDemoness.acquisitionJournal.at(-1)!.recoverySite).toMatchObject({
      sourceBottleId: id, originalBottleId: id, characteristicId: `${id}:characteristic`, custodyBefore: 'FAILED_REMNANT', custodyAfter: 'FAILED_REMNANT',
      permission: { personId: 'UD3-MARCUS', week: base.week, revision: base.revision, purpose: 'INVESTIGATE' },
    });
    reject(pending, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: id });
    reject(pending, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: originalApocalypseId(1) });
    reject(pending, { type: 'REQUEST_RECOVERY_V1', bottleId: id });
    const nextWeek = recoveryBudget(pending, { afterWeek: pending.week });
    const recovered = apocalypseStep(nextWeek, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: id });
    expect(recovered.apocalypseDemoness.bottles).toHaveLength(4);
    const newBottle = recovered.apocalypseDemoness.bottles.at(-1)!;
    expect(newBottle).toMatchObject({ labourSteps: 0, status: 'SUPPLIER', acquiredWeek: null,
      recovery: { originalBottleId: id, sourceBottleId: id, requestedWeek: pending.week, recoveredWeek: nextWeek.week } });
    expect(recoverySource(recovered.apocalypseDemoness, id)).toBeNull();
    reject(recovered, { type: 'REQUEST_RECOVERY_V1', bottleId: id });
    expect(originalBottleId(recovered.apocalypseDemoness, newBottle)).toBe(id);
    expect(validateApocalypseDemonessState(recovered)).toBe(true);
    for (const mutate of [
      (s: SliceState) => { s.calamityDemoness.encounter.currentSite = structuredClone(s.calamityDemoness.life.site); },
      (s: SliceState) => { s.calamityDemoness.encounter.currentSite!.marcus!.willing = false; },
      (s: SliceState) => { const e = s.apocalypseDemoness.acquisitionJournal.find(e => e.command.type === 'CONSUME' && e.command.bottleId === id)!; e.check = { ...e.check!, tier: 'SUCCESS' }; },
    ]) {
      const tampered = structuredClone(base); mutate(tampered);
      expect(apocalypseDemonessAcquisitionBlock(tampered, { type: 'REQUEST_RECOVERY_V1', bottleId: id })).not.toBeNull();
    }
    const crossed = structuredClone(recovered); crossed.apocalypseDemoness.bottles.at(-1)!.recovery!.originalBottleId = originalApocalypseId(1);
    expect(validateApocalypseDemonessState(crossed)).toBe(false);
  }, 60_000);

  it.each([1, 2, 3] as const)('maps a controlled future success back to original%s while preserving all three genuine failures', ordinal => {
    const baseline = loadActual688(), { prepared, state: paid, bottleId } = supported(ordinal);
    expect(paid.cash).toBe(prepared.cash - 60); expect(paid.spirituality).toBe(prepared.spirituality - 8); expect(paid.mind).toBe(prepared.mind - 6);
    expect(paid.actionsRemaining).toBe(prepared.actionsRemaining);
    expect(projectApocalypseDemoness(paid).bottles.find(b => b.id === bottleId)!.chance).toBe(68);
    expect(projectApocalypseDemoness(paid).bottles.slice(0, 3).map(b => b.chance)).toEqual([42, 42, 42]);
    reject(paid, { type: 'STABILIZE_PROMOTION', bottleId });
    const s = apocalypseStep(paid, consume(bottleId));
    const result = resolveApocalypseDemonessOriginals(s)!;
    expect(result.characteristics).toHaveLength(3);
    expect(result).toMatchObject({ embodiedOriginalBottleId: originalApocalypseId(ordinal), embodiedBottleId: bottleId });
    expect(result.characteristics[ordinal - 1]).toMatchObject({ holder: 'EMBODIED', latestBottleId: bottleId });
    expect(s.apocalypseDemoness.bottles.slice(0, 3)).toEqual(baseline.apocalypseDemoness.bottles);
    expect(s.apocalypseDemoness.acquisitionJournal.slice(0, baseline.apocalypseDemoness.acquisitionJournal.length)).toEqual(baseline.apocalypseDemoness.acquisitionJournal);
    expect(s.apocalypseDemoness.sourceScene).toEqual(baseline.apocalypseDemoness.sourceScene);
    expect(oldRoots(s)).toEqual(oldRoots(baseline));
    expect(s.progression).toMatchObject({ pathwayId: 'demoness', sequence: 1, acting: 0 });
    expect(APOCALYPSE_DEMONESS_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    expect(Object.keys(baseline.progression.mastery).every(id => s.progression.mastery[id] === baseline.progression.mastery[id])).toBe(true);
    expect(s.apocalypseDemoness.life).toMatchObject({ reflected: false, activeCase: null, journal: [] });
    expect(s.apocalypseDemoness.life.site).toEqual(baseline.apocalypseDemoness.sourceScene!.originals.site);
    const journalCheck = s.apocalypseDemoness.acquisitionJournal.at(-1)!.check!;
    expect(journalCheck).toMatchObject({ chance: 68, tier: 'SUCCESS' });
    expect(s.lastCheck).toMatchObject({ chance: 42, tier: 'FAILURE' });
    expect(projectApocalypseDemonessLastCheck(s)).toEqual(journalCheck);
    expect(projectSliceState(s).lastCheck).toEqual(journalCheck);
    expect(s.apocalypseDemoness.promotionStability!.preparations.at(-1)!.status).toBe('SPENT');
    assertValidSliceState(s);
  }, 60_000);

  it('invalidates same-bottle support on exit or week/actor/site changes without restoring paid resources', () => {
    const { state: paid, bottleId } = supported(3);
    expect(apocalypseDemonessPromotionModifiers(paid, originalApocalypseId(1))).toEqual([]);
    for (const change of [
      (s: SliceState) => { s.week++; },
      (s: SliceState) => { s.character.name = 'Different actor'; },
      (s: SliceState) => { s.world.city = 'TINGEN'; },
    ]) { const s = structuredClone(paid); change(s); expect(apocalypseDemonessPromotionModifiers(s, bottleId)).toEqual([]); }
    const left = apocalypseStep(paid, { type: 'LEAVE_PREPARATION' });
    expect(left.apocalypseDemoness.promotionStability!.preparations.at(-1)!.status).toBe('INVALIDATED');
    expect(left.cash).toBeLessThanOrEqual(paid.cash); expect(left.spirituality).toBe(paid.spirituality); expect(left.mind).toBe(paid.mind);
    expect(apocalypseDemonessPromotionModifiers(left, bottleId)).toEqual([]);
    const forced = structuredClone(paid); invalidateApocalypseDemonessPromotionStability(forced);
    expect(apocalypseDemonessPromotionModifiers(forced, bottleId)).toEqual([]);
    expect(forced.cash).toBe(paid.cash);
  }, 60_000);

  it('retains a controlled future failure, then permits only its latest same-original remnant to be recovered again', () => {
    const { state: paid, bottleId } = supported(3, [69, 95]);
    let s = apocalypseStep(paid, consume(bottleId));
    expect(s.progression.sequence).toBe(2);
    expect(s.apocalypseDemoness.bottles.at(-1)).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE' });
    expect(s.apocalypseDemoness.promotionStability!.preparations.at(-1)!.status).toBe('SPENT');
    const oldBottles = structuredClone(s.apocalypseDemoness.bottles);
    expect(recoverySource(s.apocalypseDemoness, originalApocalypseId(3))).toBeNull();
    expect(recoverySource(s.apocalypseDemoness, bottleId)?.originalBottleId).toBe(originalApocalypseId(3));
    s = recoveryBudget(s, { cash: 150, mind: 47, health: 21 });
    s = apocalypseStep(s, { type: 'REQUEST_RECOVERY_V1', bottleId });
    const requestedWeek = s.apocalypseDemoness.resupply.recovery!.requestedWeek;
    s = recoveryBudget(s, { afterWeek: requestedWeek });
    s = apocalypseStep(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId });
    expect(s.apocalypseDemoness.bottles.slice(0, 4)).toEqual(oldBottles);
    expect(s.apocalypseDemoness.bottles.at(-1)!.recovery).toMatchObject({ sourceBottleId: bottleId, originalBottleId: originalApocalypseId(3) });
    expect(resolveApocalypseDemonessOriginals(s)!.characteristics).toHaveLength(3);
    expect(validateApocalypseDemonessState(s)).toBe(true);
  }, 60_000);

  it('keeps legacy854 fully readable without relabelling its independent fourth-through-sixth sources', () => {
    expect(hash(APOCALYPSE_LEGACY854_PATH)).toBe(APOCALYPSE_LEGACY854_SHA256);
    const raw = readObjectEntry<SliceState>(APOCALYPSE_LEGACY854_PATH, 'final'), s = loadLegacy854();
    expect(s.apocalypseDemoness).toEqual(raw.apocalypseDemoness);
    expect(s.apocalypseDemoness.bottles).toHaveLength(6);
    expect(s.apocalypseDemoness.bottles[5]).toMatchObject({ id: 'apocalypse-demoness-potion-6', outcome: 'SUCCESS' });
    expect(s.apocalypseDemoness.bottles.slice(3).every(b => b.recovery === undefined)).toBe(true);
    expect(validateApocalypseDemonessState(s)).toBe(true);
    expect(resolveApocalypseDemonessOriginals(s)).toBeNull();
    expect(projectApocalypseDemoness(s).actions).toEqual([]);
    reject(s, { type: 'RECOVER_ENERGY' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow();
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    assertValidSliceState(s);
  }, 60_000);
});
