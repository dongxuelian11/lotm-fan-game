import { beforeAll, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  uncleanMonarchAcquisitionActions, uncleanMonarchAcquisitionBlock, uncleanMonarchCharacteristicId, uncleanMonarchOriginalBottlePrice,
  uncleanMonarchPromotionModifiers, hasUncleanMonarchLock, projectUncleanMonarch, projectUncleanMonarchLastCheck,
  resolveUncleanMonarchOriginalsSnapshot, validateUncleanMonarchAcquisitionCommand, validateUncleanMonarchAcquisitionJournal,
  validateUncleanMonarchSource, validateUncleanMonarchState,
} from '../../src/domain/unclean-monarch/index.js';
import { UNCLEAN_MONARCH_RECOVERY_SITE_ID, uncleanMonarchPotionSource } from '../../src/domain/unclean-monarch/content.js';
import type { UncleanMonarchAcquisitionCommand } from '../../src/domain/unclean-monarch/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { um, directedInitialCursor, oldAbyssRoots, prepareBottle, ready, rejectUncleanMonarch } from './unclean-monarch-directed-helper.js';

const natural = 'tests/fixtures/unclean-monarch-v02020/natural.json';
const originalId = (n: number) => `unclean-monarch-potion-${n}`;
const carrierId = 'unclean-monarch-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', bottleId = originalId(1)): UncleanMonarchAcquisitionCommand => ({ type, bottleId });
const journal = (s: SliceState) => s.uncleanMonarch.acquisitionJournal;
let actualFailures: SliceState, supplier: SliceState, rawNatural: SliceState, currentNatural: SliceState;
const preparedOriginals: SliceState[] = [];

/** Read the existing natural final and living718 prefix only. The separate UNIT
 * branch selects three future original-seed failures before guidance exists;
 * its declared starting week/cash/cursor are never written to the raw capture.
 * All new costs, work, rests and subsequent weeks use actual public commands. */
beforeAll(() => {
  rawNatural = readObjectEntry<SliceState>(natural, 'final');
  currentNatural = migrateSliceState(rawNatural);
  let s = migrateSliceState(readObjectEntry<unknown>(natural, 'prefixFinal'));
  const weeks = Math.max(0, s.bloodDuke.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameWeeks(s.date, weeks); s.cash = 100000;
  s.random.cursor = directedInitialCursor(s, 'THREE_FAILURES');
  // Keep the source's real weekly budget3; no post-guidance resource assignment.
  for (const n of [1, 2, 3]) {
    s = prepareBottle(s, originalId(n), undefined, false);
    preparedOriginals.push(structuredClone(s));
    s = um(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    expect(s.progression.sequence).toBe(2);
  }
  actualFailures = structuredClone(s);
  s = ready(s, { ap: 2, cash: 1500, health: 100, mind: 100, spirituality: 120 });
  s = um(s, recovery('REQUEST_RECOVERY_V1'));
  const requestedWeek = s.uncleanMonarch.resupply.requestedWeek!;
  s = ready(s, { ap: 2, cash: 1300, afterWeek: requestedWeek });
  supplier = um(s, recovery('RECOVER_CHARACTERISTIC_V1'));
}, 240_000);

/** Synthetic legacy-format UNIT history, not a replacement natural capture.
 * The old paid100 request and zero-action three-vessel delivery remain readable,
 * while current command admission and the finite-original resolver reject them. */
function legacyIndependentDelivery(): SliceState {
  const s = structuredClone(supplier), request = structuredClone(journal(s).find(e => e.command.type === 'REQUEST_RECOVERY_V1')!),
    delivery = structuredClone(journal(s).find(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1')!);
  delete request.recoverySite; delete delivery.recoverySite;
  request.command = { type: 'REQUEST_SUPPLY' }; request.after.cash = request.before.cash - 100;
  delivery.command = { type: 'RECEIVE_SUPPLY' }; delivery.before.cash += 20; delivery.after = structuredClone(delivery.before);
  s.uncleanMonarch.acquisitionJournal = [...structuredClone(journal(actualFailures)), request, delivery];
  s.uncleanMonarch.bottles = [...structuredClone(actualFailures.uncleanMonarch.bottles), ...[4, 5, 6].map(n => ({
    id: originalId(n), source: uncleanMonarchPotionSource(n, delivery.week), stockedWeek: delivery.week,
    labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER' as const, outcome: null,
  }))];
  s.uncleanMonarch.resupply = { requestedWeek: null, deliveries: 1 };
  s.cash = delivery.after.cash; s.actionsRemaining = delivery.after.actions;
  // This unit snapshot is after an intervening command; it does not reuse the
  // recovery handover's latest-note adjacency assertion for a legacy delivery.
  s.revision = delivery.revision + 2;
  return s;
}

function expectOriginalHistory(s: SliceState): void {
  expect(s.uncleanMonarch.bottles.slice(0, 3)).toEqual(actualFailures.uncleanMonarch.bottles);
  expect(journal(s).slice(0, journal(actualFailures).length)).toEqual(journal(actualFailures));
  expect(s.uncleanMonarch.sourceHistory).toEqual(actualFailures.uncleanMonarch.sourceHistory);
  expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(actualFailures));
  expect(validateUncleanMonarchSource(s)).toBe(true);
  expect(validateUncleanMonarchAcquisitionJournal(s)).toBe(true);
  assertValidSliceState(s);
}

function ownedCarrier(): SliceState { return um(structuredClone(supplier), { type: 'BUY_POTION', bottleId: carrierId }); }
function preparedCarrier(): SliceState {
  const s = ready(ownedCarrier(), { ap: 1, cash: 300, health: 100, mind: 100, spirituality: 120 });
  return um(s, { type: 'PREPARE_PROMOTION' });
}
function withFutureRoll<T>(state: SliceState, roll: number, run: () => T): T {
  const seed = state.random.seed, cursor = state.random.cursor, next = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min: number, max: number) {
    const at = this.cursor, actual = next.call(this, min, max);
    return this.seed === seed && at === cursor && min === 1 && max === 100 ? roll : actual;
  });
  try { return run(); } finally { spy.mockRestore(); }
}

describe('Unclean Monarch finite originals and future paid support', () => {
  it('retains the exact natural first-bottle success, two suppliers and original RNG without relabeling', () => {
    expect(rawNatural).toMatchObject({ revision: 822, week: 198, status: 'ACTIVE', random: { seed: 'criminal-natural-v054', cursor: 145 } });
    expect(rawNatural.uncleanMonarch.bottles.map(b => [b.id, b.status, b.outcome])).toEqual([
      [originalId(1), 'CONSUMED', 'GREAT_SUCCESS'], [originalId(2), 'SUPPLIER', null], [originalId(3), 'SUPPLIER', null],
    ]);
    expect(journal(rawNatural).filter(e => e.command.type === 'CONSUME')).toMatchObject([{ revision: 755, week: 192, check: { roll: 5, chance: 34, tier: 'GREAT_SUCCESS' } }]);
    expect(currentNatural.uncleanMonarch).toEqual(rawNatural.uncleanMonarch);
    expect(currentNatural.random).toEqual(rawNatural.random);
    expect(validateUncleanMonarchState(currentNatural)).toBe(true);
    expect(resolveUncleanMonarchOriginalsSnapshot(currentNatural.uncleanMonarch)).toMatchObject({
      embodiedOriginalBottleId: originalId(1), embodiedBottleId: originalId(1),
      characteristics: [1, 2, 3].map(n => ({ characteristicId: `UM224-CHAR-${n}`, originalBottleId: originalId(n), latestBottleId: originalId(n), holder: n === 1 ? 'EMBODIED' : 'SUPPLIER' })),
    });
    expect(resolveUncleanMonarchOriginalsSnapshot(actualFailures.uncleanMonarch)).toMatchObject({ embodiedOriginalBottleId: null,
      characteristics: [1, 2, 3].map(n => ({ originalBottleId: originalId(n), holder: 'FAILED_REMNANT' })),
    });
    expectOriginalHistory(actualFailures);
  });

  it.each([1, 2, 3])('accepts future original%s success and preserves supplier or failed-residual identities', n => {
    const before = structuredClone(preparedOriginals[n - 1]!);
    withFutureRoll(before, 30, () => {
      const s = um(before, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
      expect(s.progression.sequence).toBe(1);
      const originals = resolveUncleanMonarchOriginalsSnapshot(s.uncleanMonarch)!;
      expect(originals.embodiedOriginalBottleId).toBe(originalId(n));
      expect(originals.characteristics.map(c => c.holder)).toEqual([1, 2, 3].map(i => i < n ? 'FAILED_REMNANT' : i === n ? 'EMBODIED' : 'SUPPLIER'));
      expect(originals.characteristics).toHaveLength(3);
      expect(uncleanMonarchCharacteristicId(originalId(n))).toBe(`UM224-CHAR-${n}`);
      assertValidSliceState(s);
    });
  }, 60_000);

  it('pays120 investigation and a later real week30 handover, with fresh permission and one original lineage', () => {
    const events = journal(supplier).filter(e => e.recoverySite), request = events[0]!, handover = events[1]!;
    expect([request.before.cash - request.after.cash, request.before.actions - request.after.actions]).toEqual([120, 1]);
    expect([handover.before.cash - handover.after.cash, handover.before.actions - handover.after.actions]).toEqual([30, 1]);
    expect(handover.week).toBeGreaterThan(request.week);
    expect(handover.cursorBefore).toBe(handover.cursorAfter);
    expect(request.recoverySite).toMatchObject({ siteId: UNCLEAN_MONARCH_RECOVERY_SITE_ID, originalBottleId: originalId(1), characteristicId: 'UM224-CHAR-1',
      originals: supplier.uncleanMonarch.sourceScene!.originals, permission: { personId: 'TG224-UNCLEAN-MONARCH-SUPPLIER', purpose: 'INVESTIGATE', week: request.week, revision: request.revision },
      custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect(handover.recoverySite).toMatchObject({ permission: { purpose: 'RECOVER', week: handover.week, revision: handover.revision }, custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(supplier.uncleanMonarch.bottles.map(b => b.id)).toEqual([originalId(1), originalId(2), originalId(3), carrierId]);
    expect(supplier.uncleanMonarch.bottles[3]).toMatchObject({ status: 'SUPPLIER', labourSteps: 0, recovery: { originalBottleId: originalId(1), sourceBottleId: originalId(1), characteristicId: 'UM224-CHAR-1' } });
    expect(resolveUncleanMonarchOriginalsSnapshot(supplier.uncleanMonarch)!.characteristics[0]).toMatchObject({ holder: 'SUPPLIER', latestBottleId: carrierId });
    expectOriginalHistory(supplier);
  });

  it('rejects same-week handover, duplicate custody, unknown originals and all current new-independent supply commands', () => {
    let s = ready(structuredClone(actualFailures), { ap: 2, cash: 150 });
    s = um(s, recovery('REQUEST_RECOVERY_V1'));
    expect(hasUncleanMonarchLock(s)).toBe(false);
    expect(uncleanMonarchAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1'))).toMatch(/真实周/);
    for (const command of [recovery('RECOVER_CHARACTERISTIC_V1'), recovery('REQUEST_RECOVERY_V1', originalId(2)), recovery('RECOVER_CHARACTERISTIC_V1', originalId(2))]) rejectUncleanMonarch(s, command);
    for (const command of [{ type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }]) expect(validateUncleanMonarchAcquisitionCommand(command)).toBe(false);
    for (const command of [recovery('REQUEST_RECOVERY_V1'), { type: 'BUY_POTION', bottleId: originalId(4) }]) rejectUncleanMonarch(supplier, command);
    expect(uncleanMonarchAcquisitionActions(actualFailures).filter(a => a.command.type === 'REQUEST_RECOVERY_V1')).toHaveLength(3);
  }, 60_000);

  it('charges900 for a recovered carrier or90 after five new independent labour actions', () => {
    const original = supplier.uncleanMonarch.bottles[0]!, carrier = supplier.uncleanMonarch.bottles[3]!;
    expect(uncleanMonarchOriginalBottlePrice(original)).toBe(7200);
    expect(uncleanMonarchOriginalBottlePrice({ ...original, labourSteps: 5 })).toBe(1200);
    expect(uncleanMonarchOriginalBottlePrice({ ...original, labourSteps: 0 })).toBe(7200);
    expect(uncleanMonarchOriginalBottlePrice(carrier)).toBe(900);
    const bought = ownedCarrier(); expect(supplier.cash - bought.cash).toBe(900);
    let s = structuredClone(supplier);
    for (let n = 0; n < 5; n++) s = um(ready(s), { type: 'POTION_WORK', bottleId: carrierId });
    expect(uncleanMonarchOriginalBottlePrice(s.uncleanMonarch.bottles[3]!)).toBe(90);
    const cash = s.cash; s = um(s, { type: 'BUY_POTION', bottleId: carrierId });
    expect(s.cash).toBe(cash - 90);
    expect(journal(s).filter(e => e.command.type === 'POTION_WORK' && e.command.bottleId === carrierId)).toHaveLength(5);
    expectOriginalHistory(s);
  }, 60_000);

  it('offers optional same-bottle same-week support34→60 and spends60p8S6M without another action or draw', () => {
    const prepared = preparedCarrier(), random = { ...prepared.random };
    expect(projectUncleanMonarch(prepared).bottles.find(b => b.id === carrierId)?.chance).toBe(34);
    const s = um(prepared, { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    expect([prepared.cash - s.cash, prepared.spirituality - s.spirituality, prepared.mind - s.mind, prepared.actionsRemaining - s.actionsRemaining]).toEqual([60, 8, 6, 0]);
    expect(s.random).toEqual(random);
    expect(projectUncleanMonarch(s).bottles.find(b => b.id === carrierId)?.chance).toBe(60);
    expect(s.character.coreStats.will).toBe(22);
    expect(Object.hasOwn(s.uncleanMonarch, 'promotionStability')).toBe(false);
    rejectUncleanMonarch(s, { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    expectOriginalHistory(s);
    withFutureRoll(s, 50, () => {
      const promoted = um(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
      expect(promoted.random.cursor).toBe(s.random.cursor + 1);
      expect(journal(promoted).at(-1)!.check).toMatchObject({ baseAbility: 22, effectiveAbility: 35, chance: 60, roll: 50, tier: 'SUCCESS' });
      expect(projectUncleanMonarchLastCheck(promoted)).toEqual(journal(promoted).at(-1)!.check);
      expect(resolveUncleanMonarchOriginalsSnapshot(promoted.uncleanMonarch)).toMatchObject({ embodiedOriginalBottleId: originalId(1), embodiedBottleId: carrierId });
      expect(uncleanMonarchPromotionModifiers(promoted, carrierId)).toEqual([]);
      expectOriginalHistory(promoted);
    });
  }, 60_000);

  it('cannot transfer support to another bottle, place, week, identity or fresh preparation', () => {
    const paid = um(preparedCarrier(), { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    expect(uncleanMonarchPromotionModifiers(paid, originalId(2))).toEqual([]);
    for (const mutate of [
      (s: SliceState) => { s.week++; s.date = addGameWeeks(s.date, 1); },
      (s: SliceState) => { s.blatherer.life.playerLocation = 'A'; },
      (s: SliceState) => { s.character.name += '另一个人'; },
      (s: SliceState) => { s.uncleanMonarch.sourceHistory!.blatherer.life.playerTravelMetres++; },
    ]) { const bad = structuredClone(paid); mutate(bad); expect(uncleanMonarchPromotionModifiers(bad, carrierId)).toEqual([]); expect(validateUncleanMonarchState(bad)).toBe(false); }
    let s = um(paid, { type: 'LEAVE_PREPARATION' });
    expect(uncleanMonarchPromotionModifiers(s, carrierId)).toEqual([]);
    const supportCount = journal(s).filter(e => e.command.type === 'STABILIZE_PROMOTION').length;
    s = um(ready(s, { ap: 1, cash: 180 }), { type: 'PREPARE_PROMOTION' });
    expect(projectUncleanMonarch(s).bottles.find(b => b.id === carrierId)?.chance).toBe(34);
    expect(journal(s).filter(e => e.command.type === 'STABILIZE_PROMOTION')).toHaveLength(supportCount);
    expect(validateUncleanMonarchAcquisitionJournal(s)).toBe(true);
  }, 60_000);

  it('keeps a failed recovered dose as a paid remnant and retries that exact original, never original4', () => {
    const prepared = preparedCarrier();
    withFutureRoll(prepared, 84, () => {
      let s = um(prepared, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
      expect(s.progression.sequence).toBe(2);
      expect(resolveUncleanMonarchOriginalsSnapshot(s.uncleanMonarch)!.characteristics[0]).toMatchObject({ holder: 'FAILED_REMNANT', latestBottleId: carrierId,
        consumptionHistory: [{ bottleId: originalId(1), outcome: 'FAILURE' }, { bottleId: carrierId, outcome: 'FAILURE' }] });
      s = um(ready(s, { ap: 2, cash: 150 }), recovery('REQUEST_RECOVERY_V1', carrierId));
      s = ready(s, { ap: 1, cash: 30, afterWeek: s.uncleanMonarch.resupply.requestedWeek! });
      s = um(s, recovery('RECOVER_CHARACTERISTIC_V1', carrierId));
      expect(s.uncleanMonarch.bottles.at(-1)).toMatchObject({ id: 'unclean-monarch-recovery-2', recovery: { originalBottleId: originalId(1), sourceBottleId: carrierId, characteristicId: 'UM224-CHAR-1' } });
      expect(resolveUncleanMonarchOriginalsSnapshot(s.uncleanMonarch)!.characteristics).toHaveLength(3);
      expectOriginalHistory(s);
    });
  }, 60_000);

  it('rejects forged identity, free custody or fee receipts, while retaining old independent4+ history read-only', () => {
    for (const mutate of [
      (s: SliceState) => { s.uncleanMonarch.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (s: SliceState) => { s.uncleanMonarch.bottles[3]!.id = originalId(4); },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.permission.personId = 'BL3-NORA' as never; },
      (s: SliceState) => { journal(s).find(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1')!.after.cash++; },
    ]) { const bad = structuredClone(supplier); mutate(bad); expect(validateUncleanMonarchState(bad)).toBe(false); expect(resolveUncleanMonarchOriginalsSnapshot(bad.uncleanMonarch)).toBeNull(); }
    const legacy = legacyIndependentDelivery(), bytes = stableStringify(legacy.uncleanMonarch);
    expect(validateUncleanMonarchState(legacy)).toBe(true);
    expect(resolveUncleanMonarchOriginalsSnapshot(legacy.uncleanMonarch)).toBeNull();
    expect(stableStringify(legacy.uncleanMonarch)).toBe(bytes);
    expect(legacy.uncleanMonarch.bottles[3]).toMatchObject({ id: originalId(4), status: 'SUPPLIER', outcome: null });
    expect(uncleanMonarchAcquisitionBlock(legacy, { type: 'BUY_POTION', bottleId: originalId(4) })).toMatch(/守恒冲突/);
    const text = JSON.stringify(projectUncleanMonarch(supplier));
    for (const key of ['sourceScene', 'sourceHistoryDigest', 'randomBefore', 'randomAfter', 'sourceReceiptRevision', 'seed', 'cursor']) expect(text).not.toContain(`"${key}"`);
  }, 60_000);
});
