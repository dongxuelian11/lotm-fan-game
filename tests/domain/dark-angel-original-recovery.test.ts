import { beforeAll, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  darkAngelAcquisitionActions, darkAngelAcquisitionBlock, darkAngelCharacteristicId, darkAngelOriginalBottlePrice,
  darkAngelPromotionModifiers, hasDarkAngelLock, projectDarkAngel, projectDarkAngelLastCheck,
  resolveDarkAngelOriginalsSnapshot, validateDarkAngelAcquisitionCommand, validateDarkAngelAcquisitionJournal,
  validateDarkAngelSource, validateDarkAngelState,
} from '../../src/domain/dark-angel/index.js';
import { DARK_ANGEL_RECOVERY_SITE_ID } from '../../src/domain/dark-angel/content.js';
import type { DarkAngelAcquisitionCommand } from '../../src/domain/dark-angel/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { da, oldHangedManRoots, prepareBottle, ready, rejectDarkAngel } from './dark-angel-directed-helper.js';

const boundary = 'tests/fixtures/dark-angel-v02010/boundary-consume-dark-angel-potion-3.json';
const originalId = (n: number) => `dark-angel-potion-${n}`;
const carrierId = 'dark-angel-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', bottleId = originalId(1)): DarkAngelAcquisitionCommand => ({ type, bottleId });
const journal = (s: SliceState) => s.darkAngel.acquisitionJournal;
let actualFailures: SliceState, supplier: SliceState, rawFailures: SliceState;
const preparedOriginals: SliceState[] = [];

/** Read the exact saved 723-command failure checkpoint. No old 824-command
 * route is regenerated and none of its three outcomes is replaced. */
beforeAll(() => {
  rawFailures = readObjectEntry<SliceState>(boundary, 'final');
  actualFailures = migrateSliceState(rawFailures);
  // The201 capture already contains the exact full615-command checkpoint.
  // Only these new S1 preparations run; the missing older fixture is not needed.
  let originals = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/dark-angel-v02010/natural.json', 'prefixFinal'));
  for (const n of [1, 2, 3]) {
    originals = prepareBottle(originals, originalId(n));
    preparedOriginals.push(structuredClone(originals));
    if (n < 3) originals = da(originals, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
  }
  let s = ready(structuredClone(actualFailures), { ap: 2, cash: 1500, health: 100, mind: 100, spirituality: 120 });
  s = da(s, recovery('REQUEST_RECOVERY_V1'));
  const requestedWeek = s.darkAngel.resupply.requestedWeek!;
  s = ready(s, { ap: 2, cash: 1300, afterWeek: requestedWeek });
  supplier = da(s, recovery('RECOVER_CHARACTERISTIC_V1'));
}, 240_000);

function expectOriginalHistory(s: SliceState): void {
  expect(s.darkAngel.bottles.slice(0, 3)).toEqual(actualFailures.darkAngel.bottles);
  expect(journal(s).slice(0, journal(actualFailures).length)).toEqual(journal(actualFailures));
  expect(s.darkAngel.sourceHistory).toEqual(actualFailures.darkAngel.sourceHistory);
  expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(actualFailures));
  expect(validateDarkAngelSource(s)).toBe(true);
  expect(validateDarkAngelAcquisitionJournal(s)).toBe(true);
  assertValidSliceState(s);
}

function ownedCarrier(): SliceState { return da(structuredClone(supplier), { type: 'BUY_POTION', bottleId: carrierId }); }
function preparedCarrier(): SliceState {
  const s = ready(ownedCarrier(), { ap: 1, cash: 300, health: 100, mind: 100, spirituality: 120 });
  return da(s, { type: 'PREPARE_PROMOTION' });
}
function withFutureRoll<T>(state: SliceState, roll: number, run: () => T): T {
  const seed = state.random.seed, cursor = state.random.cursor, next = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min: number, max: number) {
    const at = this.cursor, actual = next.call(this, min, max);
    return this.seed === seed && at === cursor && min === 1 && max === 100 ? roll : actual;
  });
  try { return run(); } finally { spy.mockRestore(); }
}

describe('Dark Angel finite originals and future paid support', () => {
  it('retains the exact three natural failures, costs, original RNG and pollution30', () => {
    expect(rawFailures).toMatchObject({ revision: 724, week: 178, random: { seed: 'secret-supplicant-natural-v051', cursor: 356 }, seer: { pollution: 30 } });
    expect(rawFailures.darkAngel.bottles.map(b => [b.id, b.outcome])).toEqual([1, 2, 3].map(n => [originalId(n), 'FAILURE']));
    expect(rawFailures.darkAngel.acquisitionJournal.filter(e => e.command.type === 'CONSUME').map(e => e.check?.roll)).toEqual([46, 65, 84]);
    expect(actualFailures.darkAngel).toEqual(rawFailures.darkAngel);
    expect(resolveDarkAngelOriginalsSnapshot(actualFailures.darkAngel)).toMatchObject({
      embodiedOriginalBottleId: null, embodiedBottleId: null,
      characteristics: [1, 2, 3].map(n => ({ characteristicId: `DA223-CHAR-${n}`, originalBottleId: originalId(n), latestBottleId: originalId(n), holder: 'FAILED_REMNANT' })),
    });
    expectOriginalHistory(actualFailures);
  });

  it.each([1, 2, 3])('accepts future original%s success and preserves supplier or failed-residual identities', n => {
    const before = structuredClone(preparedOriginals[n - 1]!);
    withFutureRoll(before, 30, () => {
      const s = da(before, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
      expect(s.progression.sequence).toBe(1);
      const originals = resolveDarkAngelOriginalsSnapshot(s.darkAngel)!;
      expect(originals.embodiedOriginalBottleId).toBe(originalId(n));
      expect(originals.characteristics.map(c => c.holder)).toEqual([1, 2, 3].map(i => i < n ? 'FAILED_REMNANT' : i === n ? 'EMBODIED' : 'SUPPLIER'));
      expect(originals.characteristics).toHaveLength(3);
      expect(darkAngelCharacteristicId(originalId(n))).toBe(`DA223-CHAR-${n}`);
      assertValidSliceState(s);
    });
  }, 60_000);

  it('pays120 investigation and a later real week30 handover, with fresh permission and one original lineage', () => {
    const events = journal(supplier).filter(e => e.recoverySite), request = events[0]!, handover = events[1]!;
    expect([request.before.cash - request.after.cash, request.before.actions - request.after.actions]).toEqual([120, 1]);
    expect([handover.before.cash - handover.after.cash, handover.before.actions - handover.after.actions]).toEqual([30, 1]);
    expect(handover.week).toBeGreaterThan(request.week);
    expect(handover.cursorBefore).toBe(handover.cursorAfter);
    expect(request.recoverySite).toMatchObject({ siteId: DARK_ANGEL_RECOVERY_SITE_ID, originalBottleId: originalId(1), characteristicId: 'DA223-CHAR-1',
      originals: supplier.darkAngel.sourceScene!.originals, permission: { personId: 'TG223-DARK-ANGEL-SUPPLIER', purpose: 'INVESTIGATE', week: request.week, revision: request.revision },
      custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect(handover.recoverySite).toMatchObject({ permission: { purpose: 'RECOVER', week: handover.week, revision: handover.revision }, custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(supplier.darkAngel.bottles.map(b => b.id)).toEqual([originalId(1), originalId(2), originalId(3), carrierId]);
    expect(supplier.darkAngel.bottles[3]).toMatchObject({ status: 'SUPPLIER', labourSteps: 0, recovery: { originalBottleId: originalId(1), sourceBottleId: originalId(1), characteristicId: 'DA223-CHAR-1' } });
    expect(resolveDarkAngelOriginalsSnapshot(supplier.darkAngel)!.characteristics[0]).toMatchObject({ holder: 'SUPPLIER', latestBottleId: carrierId });
    expectOriginalHistory(supplier);
  });

  it('rejects same-week handover, duplicate custody, unknown originals and all current new-independent supply commands', () => {
    let s = ready(structuredClone(actualFailures), { ap: 2, cash: 150 });
    s = da(s, recovery('REQUEST_RECOVERY_V1'));
    expect(hasDarkAngelLock(s)).toBe(false);
    expect(darkAngelAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1'))).toMatch(/真实周/);
    for (const command of [recovery('RECOVER_CHARACTERISTIC_V1'), recovery('REQUEST_RECOVERY_V1', originalId(2)), recovery('RECOVER_CHARACTERISTIC_V1', originalId(2))]) rejectDarkAngel(s, command);
    for (const command of [{ type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }]) expect(validateDarkAngelAcquisitionCommand(command)).toBe(false);
    for (const command of [recovery('REQUEST_RECOVERY_V1'), { type: 'BUY_POTION', bottleId: originalId(4) }]) rejectDarkAngel(supplier, command);
    expect(darkAngelAcquisitionActions(actualFailures).filter(a => a.command.type === 'REQUEST_RECOVERY_V1')).toHaveLength(3);
  }, 60_000);

  it('charges900 for a recovered carrier or90 after five new independent labour actions', () => {
    const original = supplier.darkAngel.bottles[0]!, carrier = supplier.darkAngel.bottles[3]!;
    expect(darkAngelOriginalBottlePrice(original)).toBe(1200);
    expect(darkAngelOriginalBottlePrice({ ...original, labourSteps: 0 })).toBe(7200);
    expect(darkAngelOriginalBottlePrice(carrier)).toBe(900);
    const bought = ownedCarrier(); expect(supplier.cash - bought.cash).toBe(900);
    let s = structuredClone(supplier);
    for (let n = 0; n < 5; n++) s = da(ready(s), { type: 'POTION_WORK', bottleId: carrierId });
    expect(darkAngelOriginalBottlePrice(s.darkAngel.bottles[3]!)).toBe(90);
    const cash = s.cash; s = da(s, { type: 'BUY_POTION', bottleId: carrierId });
    expect(s.cash).toBe(cash - 90);
    expect(journal(s).filter(e => e.command.type === 'POTION_WORK' && e.command.bottleId === carrierId)).toHaveLength(5);
    expectOriginalHistory(s);
  }, 60_000);

  it('offers optional same-bottle same-week support44→70 and spends60p8S6M without another action or draw', () => {
    const prepared = preparedCarrier(), random = { ...prepared.random };
    expect(projectDarkAngel(prepared).bottles.find(b => b.id === carrierId)?.chance).toBe(44);
    const s = da(prepared, { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    expect([prepared.cash - s.cash, prepared.spirituality - s.spirituality, prepared.mind - s.mind, prepared.actionsRemaining - s.actionsRemaining]).toEqual([60, 8, 6, 0]);
    expect(s.random).toEqual(random);
    expect(projectDarkAngel(s).bottles.find(b => b.id === carrierId)?.chance).toBe(70);
    expect(s.character.coreStats.will).toBe(27);
    expect(Object.hasOwn(s.darkAngel, 'promotionStability')).toBe(false);
    rejectDarkAngel(s, { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    expectOriginalHistory(s);
    withFutureRoll(s, 60, () => {
      const promoted = da(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
      expect(promoted.random.cursor).toBe(s.random.cursor + 1);
      expect(journal(promoted).at(-1)!.check).toMatchObject({ baseAbility: 27, effectiveAbility: 40, chance: 70, roll: 60, tier: 'SUCCESS' });
      expect(projectDarkAngelLastCheck(promoted)).toEqual(journal(promoted).at(-1)!.check);
      expect(resolveDarkAngelOriginalsSnapshot(promoted.darkAngel)).toMatchObject({ embodiedOriginalBottleId: originalId(1), embodiedBottleId: carrierId });
      expect(darkAngelPromotionModifiers(promoted, carrierId)).toEqual([]);
      expectOriginalHistory(promoted);
    });
  }, 60_000);

  it('cannot transfer support to another bottle, place, week, identity or fresh preparation', () => {
    const paid = da(preparedCarrier(), { type: 'STABILIZE_PROMOTION', bottleId: carrierId });
    expect(darkAngelPromotionModifiers(paid, originalId(2))).toEqual([]);
    for (const mutate of [
      (s: SliceState) => { s.week++; s.date = addGameWeeks(s.date, 1); },
      (s: SliceState) => { s.threeHeadedTemplar.life.playerLocation = 'A'; },
      (s: SliceState) => { s.character.name += '另一个人'; },
      (s: SliceState) => { s.darkAngel.sourceHistory!.roseBishop.reserve.points++; },
    ]) { const bad = structuredClone(paid); mutate(bad); expect(darkAngelPromotionModifiers(bad, carrierId)).toEqual([]); expect(validateDarkAngelState(bad)).toBe(false); }
    let s = da(paid, { type: 'LEAVE_PREPARATION' });
    expect(darkAngelPromotionModifiers(s, carrierId)).toEqual([]);
    const supportCount = journal(s).filter(e => e.command.type === 'STABILIZE_PROMOTION').length;
    s = da(ready(s, { ap: 1, cash: 180 }), { type: 'PREPARE_PROMOTION' });
    expect(projectDarkAngel(s).bottles.find(b => b.id === carrierId)?.chance).toBe(44);
    expect(journal(s).filter(e => e.command.type === 'STABILIZE_PROMOTION')).toHaveLength(supportCount);
    expect(validateDarkAngelAcquisitionJournal(s)).toBe(true);
  }, 60_000);

  it('keeps a failed recovered dose as a paid remnant and retries that exact original, never original4', () => {
    const prepared = preparedCarrier();
    withFutureRoll(prepared, 84, () => {
      let s = da(prepared, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
      expect(s.progression.sequence).toBe(2);
      expect(resolveDarkAngelOriginalsSnapshot(s.darkAngel)!.characteristics[0]).toMatchObject({ holder: 'FAILED_REMNANT', latestBottleId: carrierId,
        consumptionHistory: [{ bottleId: originalId(1), outcome: 'FAILURE' }, { bottleId: carrierId, outcome: 'FAILURE' }] });
      s = da(ready(s, { ap: 2, cash: 150 }), recovery('REQUEST_RECOVERY_V1', carrierId));
      s = ready(s, { ap: 1, cash: 30, afterWeek: s.darkAngel.resupply.requestedWeek! });
      s = da(s, recovery('RECOVER_CHARACTERISTIC_V1', carrierId));
      expect(s.darkAngel.bottles.at(-1)).toMatchObject({ id: 'dark-angel-recovery-2', recovery: { originalBottleId: originalId(1), sourceBottleId: carrierId, characteristicId: 'DA223-CHAR-1' } });
      expect(resolveDarkAngelOriginalsSnapshot(s.darkAngel)!.characteristics).toHaveLength(3);
      expectOriginalHistory(s);
    });
  }, 60_000);

  it('rejects forged identity, free custody or fee receipts, while retaining old independent4+ history read-only', () => {
    for (const mutate of [
      (s: SliceState) => { s.darkAngel.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (s: SliceState) => { s.darkAngel.bottles[3]!.id = originalId(4); },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.permission.personId = 'THT3-MARA' as never; },
      (s: SliceState) => { journal(s).find(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1')!.after.cash++; },
    ]) { const bad = structuredClone(supplier); mutate(bad); expect(validateDarkAngelState(bad)).toBe(false); expect(resolveDarkAngelOriginalsSnapshot(bad.darkAngel)).toBeNull(); }
    const legacyRaw = readObjectEntry<SliceState>('tests/fixtures/dark-angel-v02010/natural.json', 'final'), bytes = stableStringify(legacyRaw.darkAngel);
    const legacy = migrateSliceState(legacyRaw);
    expect(validateDarkAngelState(legacy)).toBe(true);
    expect(resolveDarkAngelOriginalsSnapshot(legacy.darkAngel)).toBeNull();
    expect(stableStringify(legacy.darkAngel)).toBe(bytes);
    expect(legacy.darkAngel.bottles[3]).toMatchObject({ id: originalId(4), outcome: 'GREAT_SUCCESS' });
    const text = JSON.stringify(projectDarkAngel(supplier));
    for (const key of ['sourceScene', 'sourceHistoryDigest', 'randomBefore', 'randomAfter', 'sourceReceiptRevision']) expect(text).not.toContain(`"${key}"`);
  }, 60_000);
});
