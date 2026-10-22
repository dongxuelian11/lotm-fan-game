import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  abominationAcquisitionBlock, abominationCharacteristicId, abominationOriginalBottlePrice,
  resolveAbominationOriginalsSnapshot, validateAbominationAcquisitionCommand,
  validateAbominationAcquisitionJournal, validateAbominationState,
} from '../../src/domain/abomination/index.js';
import { ABOMINATION_CURRENT_CONSUMPTION_RISK, ABOMINATION_RECOVERY_SITE_ID, abominationPotionSource } from '../../src/domain/abomination/content.js';
import type { AbominationAcquisitionCommand } from '../../src/domain/abomination/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { ab, directedInitial2, oldChainedRoots, prepareBottle, ready, rejectAbomination } from './abomination-directed-helper.js';

const natural = 'tests/fixtures/abomination-v02030/natural.json';
const originalId = (n: number) => `abomination-potion-${n}`;
const carrierId = 'abomination-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', bottleId = originalId(1)): AbominationAcquisitionCommand => ({ type, bottleId });
const journal = (s: SliceState) => s.abomination.acquisitionJournal;
let failures: SliceState, requested: SliceState, supplier: SliceState;

/** Declared UNIT-only selection before the new guidance journal. All subsequent
 * preparation, money, rest, failures and elapsed weeks use public commands.
 * Read the genuine predecessor checkpoint; never replay its 642 old commands. */
beforeAll(() => {
  let s = directedInitial2('THREE_FAILURES'); s.actionsRemaining = s.weeklyBudget = 3;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  let selected: number | null = null;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 4096; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    if (Array.from({ length: 4 }, () => random.nextInt(1, 100)).every(roll => roll > chance && roll < 96)) { selected = cursor; break; }
  }
  if (selected === null) throw Error('No declared four-failure UNIT cursor in the bounded original-seed search.');
  s.random.cursor = selected;
  for (const n of [1, 2, 3]) {
    s = prepareBottle(s, originalId(n), undefined, false);
    s = ab(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    expect(s.progression.sequence).toBe(2);
  }
  failures = structuredClone(s);
  s = ready(s, { ap: 2, cash: 1500, health: 100, mind: 100 });
  requested = ab(s, recovery('REQUEST_RECOVERY_V1'));
  s = ready(requested, { ap: 2, cash: 1300, afterWeek: requested.abomination.resupply.requestedWeek! });
  supplier = ab(s, recovery('RECOVER_CHARACTERISTIC_V1'));
}, 240_000);

/** An explicitly synthetic archived-format history, never the captured source.
 * Old independent4–6 remain readable but cannot become finite-original input. */
function legacyIndependentDelivery(): SliceState {
  const s = structuredClone(supplier), request = structuredClone(journal(requested).at(-1)!), delivery = structuredClone(journal(supplier).at(-1)!);
  delete request.recoverySite; delete delivery.recoverySite;
  request.command = { type: 'REQUEST_SUPPLY' }; request.after.cash = request.before.cash - 100;
  delivery.command = { type: 'RECEIVE_SUPPLY' }; delivery.before.cash += 20; delivery.after = structuredClone(delivery.before);
  s.abomination.acquisitionJournal = [...structuredClone(journal(failures)), request, delivery];
  s.abomination.bottles = [...structuredClone(failures.abomination.bottles), ...[4, 5, 6].map(n => ({
    id: originalId(n), source: abominationPotionSource(n, delivery.week), stockedWeek: delivery.week,
    labourSteps: 0, acquiredWeek: null, consumedWeek: null, preparationWeek: null, status: 'SUPPLIER' as const, outcome: null,
  }))];
  s.abomination.resupply = { requestedWeek: null, deliveries: 1 };
  s.cash = delivery.after.cash; s.actionsRemaining = delivery.after.actions; s.revision = delivery.revision + 2;
  return s;
}

function expectOldOriginals(s: SliceState): void {
  expect(s.abomination.bottles.slice(0, 3)).toEqual(failures.abomination.bottles);
  expect(journal(s).slice(0, journal(failures).length)).toEqual(journal(failures));
  expect(s.abomination.sourceHistory).toEqual(failures.abomination.sourceHistory);
  expect(oldChainedRoots(s)).toEqual(oldChainedRoots(failures));
  expect(validateAbominationAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
}

describe('Abomination finite originals and paid recovery', () => {
  it('reads the untouched actual778 source with failed1, embodied2 and unbought3', () => {
    expect(createHash('sha256').update(readFileSync(natural)).digest('hex')).toBe('0d99439f4e950a633e20fdba372fb0e59beb41982ccff5fe6a27fd2834adf442');
    const source = readObjectEntry<SliceState>(natural, 'final'), before = stableStringify(source.abomination);
    const originals = resolveAbominationOriginalsSnapshot(source.abomination)!;
    expect(originals).toMatchObject({ embodiedOriginalBottleId: originalId(2), embodiedBottleId: originalId(2), characteristics: [
      { characteristicId: 'AB225-CHAR-1', originalBottleId: originalId(1), latestBottleId: originalId(1), holder: 'FAILED_REMNANT', consumptionHistory: [{ bottleId: originalId(1), revision: 679, week: 159, outcome: 'FAILURE' }] },
      { characteristicId: 'AB225-CHAR-2', originalBottleId: originalId(2), holder: 'EMBODIED', consumptionHistory: [{ bottleId: originalId(2), revision: 711, week: 169, outcome: 'SUCCESS' }] },
      { characteristicId: 'AB225-CHAR-3', originalBottleId: originalId(3), holder: 'SUPPLIER', consumptionHistory: [] },
    ] });
    expect(originals.characteristics[0]).not.toHaveProperty('location');
    expect(source.abomination.bottles.every(b => !Object.hasOwn(b, 'recovery'))).toBe(true);
    expect(stableStringify(source.abomination)).toBe(before);
    const oldGuidance = source.chronicle.find(e => e.title === '听取神孽独立成品与专业准备指导')!;
    expect(oldGuidance).toMatchObject({ id: 'record-644-1052', week: 148 });
    expect(oldGuidance.text).toContain('申请独立三瓶');
    expect(ABOMINATION_CURRENT_CONSUMPTION_RISK).toContain('不再供应第四份原特性');
    expect(ABOMINATION_CURRENT_CONSUMPTION_RISK).not.toContain('申请独立三瓶');
  });

  it.each([1, 2, 3])('supports original%s as the actual success with a genuinely paid held peer', n => {
    let s = directedInitial2('SUCCESS');
    s = ab(s, { type: 'LEARN_GUIDANCE' });
    const peer = n % 3 + 1;
    s = ab(s, { type: 'BUY_POTION', bottleId: originalId(peer) });
    s = prepareBottle(s, originalId(n), undefined, false);
    s = ab(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    const originals = resolveAbominationOriginalsSnapshot(s.abomination)!;
    expect(originals.embodiedOriginalBottleId).toBe(originalId(n));
    expect(originals.characteristics).toHaveLength(3);
    expect(originals.characteristics.find(c => c.originalBottleId === originalId(peer))!.holder).toBe('PLAYER');
    expect(originals.characteristics.filter(c => c.holder === 'SUPPLIER')).toHaveLength(1);
    expect(originals.characteristics[n - 1]!.characteristicId).toBe(abominationCharacteristicId(originalId(n)));
    expect(validateAbominationAcquisitionJournal(s)).toBe(true);
  }, 120_000);

  it('requires a new paid inspection, fresh permission and a real later-week handover', () => {
    const inspection = journal(requested).at(-1)!, handover = journal(supplier).at(-1)!;
    expect([inspection.before.cash - inspection.after.cash, inspection.before.actions - inspection.after.actions]).toEqual([120, 1]);
    expect(inspection.recoverySite).toMatchObject({ siteId: ABOMINATION_RECOVERY_SITE_ID, sourceReceiptRevision: journal(failures).find(e => e.command.type === 'CONSUME')!.revision,
      originalBottleId: originalId(1), characteristicId: 'AB225-CHAR-1', permission: { personId: 'TG225-ABOMINATION-SUPPLIER', purpose: 'INVESTIGATE', week: inspection.week, revision: inspection.revision }, custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect([handover.before.cash - handover.after.cash, handover.before.actions - handover.after.actions]).toEqual([30, 1]);
    expect(handover.week).toBeGreaterThan(inspection.week);
    expect(handover.recoverySite).toMatchObject({ permission: { purpose: 'RECOVER', week: handover.week, revision: handover.revision }, custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(abominationAcquisitionBlock(requested, recovery('RECOVER_CHARACTERISTIC_V1'))).toContain('真实周');
    rejectAbomination(requested, recovery('RECOVER_CHARACTERISTIC_V1'));
    rejectAbomination(requested, recovery('RECOVER_CHARACTERISTIC_V1', originalId(2)));
    rejectAbomination(supplier, recovery('REQUEST_RECOVERY_V1'));
    expect(supplier.abomination.bottles).toHaveLength(4);
    expect(supplier.abomination.bottles[3]).toMatchObject({ id: carrierId, status: 'SUPPLIER', acquiredWeek: null, recovery: { originalBottleId: originalId(1), sourceBottleId: originalId(1), characteristicId: 'AB225-CHAR-1' } });
    expect(resolveAbominationOriginalsSnapshot(supplier.abomination)!.characteristics).toHaveLength(3);
    expectOldOriginals(supplier);
  });

  it('repays liquid and preparation, then preserves another real failure and recovers that same remnant', () => {
    let s = structuredClone(supplier);
    expect(abominationOriginalBottlePrice(s.abomination.bottles[3]!)).toBe(900);
    for (let n = 0; n < 5; n++) s = ab(ready(s), { type: 'POTION_WORK', bottleId: carrierId });
    expect(abominationOriginalBottlePrice(s.abomination.bottles[3]!)).toBe(90);
    s = ready(s, { ap: 2, cash: 300, health: 100, mind: 100, spirituality: 120, pollution: 0 });
    s = ab(s, { type: 'BUY_POTION', bottleId: carrierId });
    const delivery = journal(s).at(-1)!; expect(delivery.before.cash - delivery.after.cash).toBe(90);
    s = ab(s, { type: 'PREPARE_PROMOTION' });
    const preparation = journal(s).at(-1)!; expect(preparation.before.cash - preparation.after.cash).toBe(180);
    s = ab(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
    expect(s.progression.sequence).toBe(2);
    expect(journal(s).at(-1)!.check?.tier).toBe('FAILURE');
    expect(resolveAbominationOriginalsSnapshot(s.abomination)!.characteristics[0]).toMatchObject({ holder: 'FAILED_REMNANT', latestBottleId: carrierId });
    expect(resolveAbominationOriginalsSnapshot(s.abomination)!.characteristics[0]!.consumptionHistory).toHaveLength(2);
    s = ab(ready(s, { ap: 2, cash: 150 }), recovery('REQUEST_RECOVERY_V1', carrierId));
    s = ready(s, { ap: 2, cash: 30, afterWeek: s.abomination.resupply.requestedWeek! });
    s = ab(s, recovery('RECOVER_CHARACTERISTIC_V1', carrierId));
    expect(s.abomination.bottles.at(-1)).toMatchObject({ id: 'abomination-recovery-2', recovery: { originalBottleId: originalId(1), sourceBottleId: carrierId, characteristicId: 'AB225-CHAR-1' } });
    expect(resolveAbominationOriginalsSnapshot(s.abomination)!.characteristics).toHaveLength(3);
    expectOldOriginals(s);
  }, 120_000);

  it('rejects forged receipts, wrong custody, closed original route and independent fourth originals', () => {
    for (const mutate of [
      (s: SliceState) => { s.abomination.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.sourceReceiptRevision++; },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.permission.personId = 'SD3-ELSA' as never; },
      (s: SliceState) => { journal(s).find(e => e.recoverySite)!.recoverySite!.custodyBefore = 'SEALED_WITH_CUSTODIAN'; },
      (s: SliceState) => { journal(s).at(-1)!.after.cash++; },
    ]) {
      const bad = structuredClone(supplier); mutate(bad);
      expect(validateAbominationState(bad)).toBe(false); expect(resolveAbominationOriginalsSnapshot(bad.abomination)).toBeNull();
    }
    const blocked = structuredClone(failures); blocked.ancientEvil.life.operation.door = 'CLOSED';
    expect(abominationAcquisitionBlock(blocked, recovery('REQUEST_RECOVERY_V1'))).not.toBeNull();
    expect(validateAbominationAcquisitionCommand({ type: 'REQUEST_SUPPLY' })).toBe(false);
    expect(validateAbominationAcquisitionCommand({ type: 'RECEIVE_SUPPLY' })).toBe(false);
    const legacy = legacyIndependentDelivery();
    expect(validateAbominationState(legacy)).toBe(true);
    expect(resolveAbominationOriginalsSnapshot(legacy.abomination)).toBeNull();
  });
});
