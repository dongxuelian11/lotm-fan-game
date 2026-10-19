import { beforeAll, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  createHandOfOrderState, handOfOrderAcquisitionActions, handOfOrderAcquisitionBlock,
  handOfOrderCharacteristicId, handOfOrderOriginalBottlePrice, handOfOrderPromotionModifiers,
  hasHandOfOrderLock, projectHandOfOrder, projectHandOfOrderLastCheck,
  resolveHandOfOrderOriginalsSnapshot, validateHandOfOrderAcquisitionCommand,
  validateHandOfOrderAcquisitionJournal, validateHandOfOrderSource, validateHandOfOrderState,
} from '../../src/domain/hand-of-order/index.js';
import { HAND_OF_ORDER_RECOVERY_SITE_ID } from '../../src/domain/hand-of-order/content.js';
import { HAND_OF_ORDER_ABILITY_IDS, type HandOfOrderAcquisitionCommand, type HandOfOrderState } from '../../src/domain/hand-of-order/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { hoo, oldJusticiarRoots, ready, rejectHandOfOrder } from './hand-of-order-directed-helper.js';

const boundary = 'tests/fixtures/hand-of-order-v02060/boundary-step-706-action.json';
const originalId = (n: number) => `hand-of-order-potion-${n}`;
const carrierId = 'hand-of-order-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', bottleId = originalId(1)): HandOfOrderAcquisitionCommand => ({ type, bottleId });
const journal = (s: SliceState) => s.handOfOrder.acquisitionJournal;
let raw: SliceState, failures: SliceState, requested: SliceState, supplier: SliceState, prepared: SliceState;

/** Read the exact706 boundary. Only the new recovery route runs; none of the
 * old706 inputs, original RNG or three actual failures is regenerated. */
beforeAll(() => {
  raw = readObjectEntry<SliceState>(boundary, 'final'); failures = migrateSliceState(raw);
  requested = hoo(failures, recovery('REQUEST_RECOVERY_V1'));
  supplier = hoo(ready(requested, { ap: 2, cash: 30, afterWeek: requested.handOfOrder.resupply.requestedWeek! }), recovery('RECOVER_CHARACTERISTIC_V1'));
  let s = supplier;
  for (let n = 0; n < 5; n++) s = hoo(ready(s), { type: 'POTION_WORK', bottleId: carrierId });
  s = ready(s, { ap: 2, cash: 330, health: 100, mind: 100, spirituality: 120 });
  s = hoo(s, { type: 'BUY_POTION', bottleId: carrierId });
  prepared = hoo(s, { type: 'PREPARE_PROMOTION' });
}, 60_000);

function unchangedOriginals(s: SliceState): void {
  expect(s.handOfOrder.bottles.slice(0, 3)).toEqual(raw.handOfOrder.bottles);
  expect(journal(s).slice(0, journal(raw).length)).toEqual(journal(raw));
  expect(s.handOfOrder.sourceHistory).toEqual(raw.handOfOrder.sourceHistory);
  expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(raw));
  expect(s.handOfOrder.sourceScene).toEqual(raw.handOfOrder.sourceScene);
  expect(validateHandOfOrderAcquisitionJournal(s)).toBe(true);
}
function withFutureRoll<T>(s: SliceState, roll: number, run: () => T): T {
  const next = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min: number, max: number) {
    const cursor = this.cursor, actual = next.call(this, min, max);
    return this.seed === s.random.seed && cursor === s.random.cursor && min === 1 && max === 100 ? roll : actual;
  });
  try { return run(); } finally { spy.mockRestore(); }
}

/** Synthetic lineage-only terminal branches from exact paid preparation
 * prefixes. They are not source saves and never overwrite captured outcomes. */
function originalSuccessSnapshot(n: number): HandOfOrderState {
  const snapshot = structuredClone(raw.handOfOrder), at = snapshot.acquisitionJournal.findIndex(e => e.command.type === 'CONSUME' && e.command.bottleId === originalId(n));
  snapshot.acquisitionJournal = snapshot.acquisitionJournal.slice(0, at + 1);
  const event = snapshot.acquisitionJournal.at(-1)!;
  event.check = resolveNormalCheck({ ability: 'will', baseAbility: event.before.coreStats.will, difficulty: 30, modifiers: [], roll: 30 });
  event.after = structuredClone(event.before); event.after.sequence = 1; event.after.acting = 0; event.after.mind -= 15;
  event.after.completedSources.push('justiciar-s1');
  for (const id of HAND_OF_ORDER_ABILITY_IDS) event.after.mastery[id] = 0;
  for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) event.after.coreStats[stat]++;
  snapshot.promotionWeek = event.week; snapshot.balancerActingAtPromotion = 100;
  snapshot.bottles.forEach((b, i) => {
    if (i === n - 1) b.outcome = 'SUCCESS';
    if (i >= n) { b.labourSteps = 0; b.acquiredWeek = b.consumedWeek = b.preparationWeek = null; b.outcome = null; b.status = 'SUPPLIER'; }
  });
  return snapshot;
}

describe('Hand of Order same-three-characteristic recovery', () => {
  it('preserves actual706 and its ordinary40% failures without adding a root or RNG field', () => {
    expect(raw).toMatchObject({ schemaVersion: 203, revision: 707, week: 169, status: 'ACTIVE', health: 93, mind: 85, spirituality: 120, cash: 190, actionsRemaining: 2,
      random: { seed: 'arbiter-natural-v066', cursor: 370 }, character: { coreStats: { will: 25 } }, seer: { pollution: 20 } });
    expect(failures.handOfOrder).toEqual(raw.handOfOrder);
    expect(journal(raw).filter(e => e.command.type === 'CONSUME').map(e => [e.check?.roll, e.check?.chance, e.check?.tier])).toEqual([[46, 40, 'FAILURE'], [61, 40, 'FAILURE'], [80, 40, 'FAILURE']]);
    expect(raw.handOfOrder.resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    expect(createHandOfOrderState().resupply).toEqual({ requestedWeek: null, deliveries: 0 });
    expect(resolveHandOfOrderOriginalsSnapshot(failures.handOfOrder)).toMatchObject({ embodiedBottleId: null, characteristics: [1, 2, 3].map(n => ({ characteristicId: `HOO228-CHAR-${n}`, originalBottleId: originalId(n), holder: 'FAILED_REMNANT' })) });
    expect(validateHandOfOrderSource(failures)).toBe(true); unchangedOriginals(failures); assertValidSliceState(failures);
  });

  it('actually pays120 then30 across a real week with separate permissions and one original lineage', () => {
    const request = journal(requested).at(-1)!, handover = journal(supplier).at(-1)!;
    expect([request.before.cash - request.after.cash, request.before.actions - request.after.actions]).toEqual([120, 1]);
    expect([handover.before.cash - handover.after.cash, handover.before.actions - handover.after.actions]).toEqual([30, 1]);
    expect(handover.week).toBeGreaterThan(request.week); expect(handover.cursorBefore).toBe(handover.cursorAfter);
    expect(request.recoverySite).toMatchObject({ siteId: HAND_OF_ORDER_RECOVERY_SITE_ID, originals: raw.handOfOrder.sourceScene!.originals,
      permission: { personId: 'JU228-HAND-OF-ORDER-SUPPLIER', purpose: 'INVESTIGATE', week: request.week, revision: request.revision }, custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect(handover.recoverySite).toMatchObject({ permission: { purpose: 'RECOVER', week: handover.week, revision: handover.revision }, custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(supplier.handOfOrder.bottles.at(-1)).toMatchObject({ id: carrierId, status: 'SUPPLIER', labourSteps: 0, recovery: { originalBottleId: originalId(1), characteristicId: 'HOO228-CHAR-1' } });
    expect(resolveHandOfOrderOriginalsSnapshot(supplier.handOfOrder)!.characteristics).toHaveLength(3); unchangedOriginals(supplier);
  });

  it('blocks fourth-independent supplies, same-week handover, duplicate custody and changed original room', () => {
    expect(hasHandOfOrderLock(requested)).toBe(false);
    expect(handOfOrderAcquisitionBlock(requested, recovery('RECOVER_CHARACTERISTIC_V1'))).toMatch(/真实周/);
    for (const command of [{ type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }]) expect(validateHandOfOrderAcquisitionCommand(command)).toBe(false);
    for (const command of [recovery('RECOVER_CHARACTERISTIC_V1'), recovery('REQUEST_RECOVERY_V1', originalId(2))]) rejectHandOfOrder(requested, command);
    rejectHandOfOrder(supplier, recovery('REQUEST_RECOVERY_V1'));
    const moved = structuredClone(failures); moved.chaosHunter.life.playerLocation = 'A';
    expect(handOfOrderAcquisitionBlock(moved, recovery('REQUEST_RECOVERY_V1'))).not.toBeNull();
    expect(handOfOrderAcquisitionActions(failures).filter(a => a.command.type === 'REQUEST_RECOVERY_V1')).toHaveLength(3);
  });

  it('keeps original prices and charges900 or five new labour actions plus90 for the recovered carrier', () => {
    expect(handOfOrderOriginalBottlePrice(supplier.handOfOrder.bottles[0]!)).toBe(1200);
    expect(handOfOrderOriginalBottlePrice({ ...supplier.handOfOrder.bottles[0]!, labourSteps: 0 })).toBe(7200);
    expect(handOfOrderOriginalBottlePrice(supplier.handOfOrder.bottles[3]!)).toBe(900);
    const paid = journal(prepared).find(e => e.command.type === 'BUY_POTION' && e.command.bottleId === carrierId)!;
    expect(paid.before.cash - paid.after.cash).toBe(90);
    expect(journal(prepared).filter(e => e.command.type === 'POTION_WORK' && e.command.bottleId === carrierId)).toHaveLength(5);
    expect(handOfOrderOriginalBottlePrice(prepared.handOfOrder.bottles[3]!)).toBe(90); unchangedOriginals(prepared);
  });

  it('pays optional60p8S6M for actual40→70, with one authoritative result and exactly one consumed draw', () => {
    expect(projectHandOfOrder(prepared).bottles.find(b => b.id === carrierId)?.chance).toBe(40);
    const s = hoo(prepared, { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    expect([prepared.cash - s.cash, prepared.spirituality - s.spirituality, prepared.mind - s.mind, prepared.actionsRemaining - s.actionsRemaining]).toEqual([60, 8, 6, 0]);
    expect(s.random).toEqual(prepared.random); expect(s.character.coreStats.will).toBe(25);
    expect(projectHandOfOrder(s).bottles.find(b => b.id === carrierId)?.chance).toBe(70);
    rejectHandOfOrder(s, { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    withFutureRoll(s, 60, () => {
      const promoted = hoo(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
      expect(journal(promoted).at(-1)!.check).toMatchObject({ baseAbility: 25, effectiveAbility: 40, chance: 70, roll: 60, tier: 'SUCCESS' });
      expect(projectHandOfOrderLastCheck(promoted)).toEqual(journal(promoted).at(-1)!.check);
      expect(promoted.random.cursor).toBe(s.random.cursor + 1);
      expect(resolveHandOfOrderOriginalsSnapshot(promoted.handOfOrder)).toMatchObject({ embodiedOriginalBottleId: originalId(1), embodiedBottleId: carrierId });
      expect(handOfOrderPromotionModifiers(promoted, carrierId)).toEqual([]); unchangedOriginals(promoted); assertValidSliceState(promoted);
    });
  });

  it('does not transfer support between bottles, identities, rooms, weeks or fresh preparation', () => {
    const paid = hoo(prepared, { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    expect(handOfOrderPromotionModifiers(paid, originalId(2))).toEqual([]);
    for (const mutate of [
      (s: SliceState) => { s.week++; s.date = addGameWeeks(s.date, 1); },
      (s: SliceState) => { s.chaosHunter.life.playerLocation = 'A'; },
      (s: SliceState) => { s.character.name += '另一个人'; },
      (s: SliceState) => { s.handOfOrder.sourceHistory!.balancer.life.guardPlate.integrity++; },
    ]) { const bad = structuredClone(paid); mutate(bad); expect(handOfOrderPromotionModifiers(bad, carrierId)).toEqual([]); expect(validateHandOfOrderState(bad)).toBe(false); }
    const left = hoo(paid, { type: 'LEAVE_PREPARATION' }); expect(handOfOrderPromotionModifiers(left, carrierId)).toEqual([]);
    const fresh = hoo(ready(left, { ap: 2, cash: 180 }), { type: 'PREPARE_PROMOTION' });
    expect(projectHandOfOrder(fresh).bottles.find(b => b.id === carrierId)?.chance).toBe(40);
    const text = JSON.stringify(projectHandOfOrder(paid));
    for (const key of ['sourceScene', 'sourceHistoryDigest', 'sourceReceiptRevision', 'randomBefore', 'randomAfter']) expect(text).not.toContain(`"${key}"`);
  }, 60_000);

  it('retains a failed recovered dose and can recover that same remnant again while rejecting forged custody', () => {
    withFutureRoll(prepared, 84, () => {
      let s = hoo(prepared, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
      expect(resolveHandOfOrderOriginalsSnapshot(s.handOfOrder)!.characteristics[0]).toMatchObject({ holder: 'FAILED_REMNANT', latestBottleId: carrierId,
        consumptionHistory: [{ bottleId: originalId(1), outcome: 'FAILURE' }, { bottleId: carrierId, outcome: 'FAILURE' }] });
      s = hoo(ready(s, { ap: 2, cash: 150 }), recovery('REQUEST_RECOVERY_V1', carrierId));
      s = hoo(ready(s, { ap: 2, cash: 30, afterWeek: s.handOfOrder.resupply.requestedWeek! }), recovery('RECOVER_CHARACTERISTIC_V1', carrierId));
      expect(s.handOfOrder.bottles.at(-1)).toMatchObject({ id: 'hand-of-order-recovery-2', recovery: { originalBottleId: originalId(1), sourceBottleId: carrierId } }); unchangedOriginals(s);
    });
    for (const mutate of [
      (s: SliceState) => { s.handOfOrder.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.permission.personId = 'GUIDE' as never; },
      (s: SliceState) => { journal(s).at(-1)!.after.cash++; },
    ]) { const bad = structuredClone(supplier); mutate(bad); expect(validateHandOfOrderState(bad)).toBe(false); expect(resolveHandOfOrderOriginalsSnapshot(bad.handOfOrder)).toBeNull(); }
  }, 60_000);

  it('resolves each first-three success position and retains old independent4 history read-only', () => {
    const bytes = stableStringify(raw.handOfOrder);
    for (const n of [1, 2, 3]) {
      const snapshot = originalSuccessSnapshot(n), originals = resolveHandOfOrderOriginalsSnapshot(snapshot)!;
      expect(originals.embodiedOriginalBottleId).toBe(originalId(n));
      expect(originals.characteristics.map(c => c.holder)).toEqual([1, 2, 3].map(i => i < n ? 'FAILED_REMNANT' : i === n ? 'EMBODIED' : 'SUPPLIER'));
      expect(handOfOrderCharacteristicId(originalId(n))).toBe(`HOO228-CHAR-${n}`);
    }
    expect(stableStringify(raw.handOfOrder)).toBe(bytes);
    // Read the old801 result once, never replay its commands or repair its fourth original.
    const legacyRaw = readObjectEntry<SliceState>('tests/fixtures/hand-of-order-v02060/natural.json', 'final'), legacy = migrateSliceState(legacyRaw);
    expect(legacy.handOfOrder).toEqual(legacyRaw.handOfOrder);
    expect(legacy.handOfOrder.bottles[3]).toMatchObject({ id: originalId(4), outcome: 'GREAT_SUCCESS' });
    expect(validateHandOfOrderState(legacy)).toBe(true); expect(resolveHandOfOrderOriginalsSnapshot(legacy.handOfOrder)).toBeNull();
  }, 60_000);
});
