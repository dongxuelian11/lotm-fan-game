import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  hasTimeWormLock, resolveTimeWormOriginals, timeWormAcquisitionActions,
  timeWormAcquisitionBlock, validateTimeWormAcquisitionJournal, validateTimeWormSource,
} from '../../src/domain/time-worm/index.js';
import { TIME_WORM_RECOVERY_SITE_ID } from '../../src/domain/time-worm/content.js';
import type { TimeWormAcquisitionCommand } from '../../src/domain/time-worm/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  ae, ordinary, originalErrorRoots, prepareBottle, ready, rejectTimeWorm,
} from './time-worm-directed-helper.js';

const naturalPath = 'tests/fixtures/time-worm-v01970/natural.json';
const originalId = (n: number) => `time-worm-potion-${n}`;
const carrierId = 'time-worm-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', n = 1): TimeWormAcquisitionCommand =>
  ({ type, bottleId: originalId(n) });
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const journal = (s: SliceState) => s.timeWorm.acquisitionJournal;
let threeFailures: SliceState;
let historicalRootsDigest: string;
let restoreFutureDraws: (() => void) | undefined;

/** CONTROLLED FUTURE FAILURE INJECTION, not another natural capture. Read the
 * preserved actual551 prefix directly; the separate v175 package is not needed.
 * Only the three future consumption draws are overridden, after each bottle is
 * legally prepared. The real stream still advances its cursor; the same scoped
 * map supplies validator replay until both tests finish. All other draws, the
 * seed, starting cursor and eight legacy histories remain untouched. New jobs,
 * wages, care, bills, preparations and failures use the public reducer. */
beforeAll(() => {
  const raw = readObjectEntry<SliceState>(naturalPath, 'prefixFinal');
  expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex'))
    .toBe('c6f1aa074a01229bb1041e07e792c5e7839e449df8cd6a26ed6e1e569db54380');
  expect(raw).toMatchObject({ revision: 552, week: 127, health: 40, cash: 472,
    random: { seed: 'marauder-natural-v038', cursor: 361 },
    progression: { pathwayId: 'error', sequence: 2, acting: 100 } });
  historicalRootsDigest = digest(originalErrorRoots(raw));
  const futureFailureRolls = new Map<number, number>();
  const originalNextInt = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor;
    const actual = originalNextInt.call(this, minimum, maximum);
    return this.seed === raw.random.seed && minimum === 1 && maximum === 100
      ? futureFailureRolls.get(cursor) ?? actual : actual;
  });
  restoreFutureDraws = () => spy.mockRestore();
  let s = ready(ordinary(migrateSliceState(raw), undefined, true), {
    cash: 500, health: 100, mind: 100, spirituality: 120,
  });
  expect(s.timeWorm.guidanceKnown).toBe(false);
  expect(journal(s)).toEqual([]);
  expect(s.random).toEqual(raw.random);
  assertValidSliceState(s);
  s = ae(s, { type: 'LEARN_GUIDANCE' });
  for (const n of [1, 2, 3]) {
    s = prepareBottle(s, originalId(n));
    const input = { ability: 'will' as const, baseAbility: s.character.coreStats.will,
      difficulty: 30, modifiers: [] };
    const roll = resolveNormalCheck({ ...input, roll: 50 }).chance + 1;
    expect(roll).toBeLessThan(96);
    expect(resolveNormalCheck({ ...input, roll }).tier).toBe('FAILURE');
    expect(s.random.cursor).toBeGreaterThanOrEqual(raw.random.cursor);
    expect(futureFailureRolls.has(s.random.cursor)).toBe(false);
    futureFailureRolls.set(s.random.cursor, roll);
    s = ae(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    expect(s.timeWorm.bottles[n - 1]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE', labourSteps: 5 });
    expect(s.progression.sequence).toBe(2);
  }
  expect(futureFailureRolls.size).toBe(3);
  expect(journal(s).filter(e => e.command.type === 'CONSUME').map(e => e.cursorBefore))
    .toEqual([...futureFailureRolls.keys()]);
  expect(s.timeWorm.sourceScene!.random).toEqual(raw.random);
  expect(digest(originalErrorRoots(s))).toBe(historicalRootsDigest);
  expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex'))
    .toBe('c6f1aa074a01229bb1041e07e792c5e7839e449df8cd6a26ed6e1e569db54380');
  expect(resolveTimeWormOriginals(s)?.characteristics.map(c => c.holder))
    .toEqual(['FAILED_REMNANT', 'FAILED_REMNANT', 'FAILED_REMNANT']);
  threeFailures = s;
}, 180_000);
afterAll(() => restoreFutureDraws?.());

function expectHistoryRetained(s: SliceState): void {
  expect(s.timeWorm.bottles.slice(0, 3)).toEqual(threeFailures.timeWorm.bottles);
  expect(journal(s).slice(0, journal(threeFailures).length)).toEqual(journal(threeFailures));
  expect(s.timeWorm.sourceHistory).toEqual(threeFailures.timeWorm.sourceHistory);
  expect(digest(originalErrorRoots(s))).toBe(historicalRootsDigest);
  const purchases = journal(s).filter(e => e.command.type === 'BUY_POTION' && e.command.bottleId.startsWith('time-worm-potion-'));
  expect(purchases.map(e => e.before.cash - e.after.cash)).toEqual([1100, 1100, 1100]);
  expect(journal(s).filter(e => e.command.type === 'PREPARE_PROMOTION').map(e => e.before.cash - e.after.cash))
    .toEqual([150, 150, 150]);
  expect(validateTimeWormSource(s)).toBe(true);
  expect(validateTimeWormAcquisitionJournal(s)).toBe(true);
  assertValidSliceState(s);
}

describe('Time Worm controlled future same-original recovery through legal actions', () => {
  it('pays 120/1 AP, waits an ordinary week, pays 30/1 AP and 900 for the same original; rejects early, duplicate and reused claims', () => {
    let s = ready(structuredClone(threeFailures), { ap: 2, cash: 1200 });
    const before = { cash: s.cash, ap: s.actionsRemaining, random: { ...s.random } };
    const failed = journal(s).find(e => e.command.type === 'CONSUME' && e.command.bottleId === originalId(1))!;
    s = ae(s, recovery('REQUEST_RECOVERY_V1'));
    const request = journal(s).at(-1)!, pending = structuredClone(s.timeWorm.resupply.recovery!);
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 120, before.ap - 1]);
    expect(s.random).toEqual(before.random);
    expect(hasTimeWormLock(s)).toBe(false);
    expect(pending).toEqual({ version: 1, sourceBottleId: originalId(1), originalBottleId: originalId(1),
      characteristicId: 'ER0-TW-CHAR-1', requestedWeek: request.week, sourceReceiptRevision: failed.revision,
      siteId: TIME_WORM_RECOVERY_SITE_ID, custodian: 'ER0-TIME-WORM-SUPPLIER' });
    expect(request.recoverySite).toMatchObject({ sourceReceiptRevision: failed.revision,
      originals: s.timeWorm.sourceScene!.originals,
      permission: { personId: 'ER0-TIME-WORM-SUPPLIER', week: request.week, revision: request.revision, purpose: 'INVESTIGATE' },
      custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect(timeWormAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1'))).toMatch(/真实周/);
    for (const command of [recovery('REQUEST_RECOVERY_V1'), recovery('REQUEST_RECOVERY_V1', 2),
      recovery('RECOVER_CHARACTERISTIC_V1'), recovery('RECOVER_CHARACTERISTIC_V1', 2)]) rejectTimeWorm(s, command);

    s = ready(s, { ap: 2, cash: 930, afterWeek: pending.requestedWeek });
    const handoverCash = s.cash, handoverAP = s.actionsRemaining, handoverRandom = { ...s.random };
    s = ae(s, recovery('RECOVER_CHARACTERISTIC_V1'));
    const handover = journal(s).at(-1)!;
    expect(handover.week).toBeGreaterThan(pending.requestedWeek);
    expect([s.cash, s.actionsRemaining]).toEqual([handoverCash - 30, handoverAP - 1]);
    expect(s.random).toEqual(handoverRandom);
    expect(handover.recoverySite).toMatchObject({ originals: request.recoverySite!.originals,
      sourceReceiptRevision: failed.revision, characteristicId: 'ER0-TW-CHAR-1',
      permission: { personId: 'ER0-TIME-WORM-SUPPLIER', week: handover.week, revision: handover.revision, purpose: 'RECOVER' },
      custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(s.timeWorm.bottles.map(b => b.id)).toEqual([originalId(1), originalId(2), originalId(3), carrierId]);
    expect(s.timeWorm.bottles[3]).toMatchObject({ id: carrierId, status: 'SUPPLIER', labourSteps: 0,
      recovery: { ...pending, recoveredWeek: handover.week } });
    expect(s.timeWorm.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    const originals = resolveTimeWormOriginals(s)!;
    expect(originals.characteristics).toHaveLength(3);
    expect(originals.characteristics.map(c => c.characteristicId)).toEqual(['ER0-TW-CHAR-1', 'ER0-TW-CHAR-2', 'ER0-TW-CHAR-3']);
    expect(originals.characteristics[0]).toMatchObject({ originalBottleId: originalId(1), latestBottleId: carrierId, holder: 'SUPPLIER',
      consumptionHistory: [{ bottleId: originalId(1), week: failed.week, revision: failed.revision, outcome: 'FAILURE' }] });
    expect(originals.embodiedOriginalBottleId).toBeNull();
    for (const command of [recovery('REQUEST_RECOVERY_V1'), recovery('RECOVER_CHARACTERISTIC_V1'),
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'BUY_POTION', bottleId: originalId(4) }]) rejectTimeWorm(s, command);
    const cash = s.cash, ap = s.actionsRemaining;
    s = ae(s, { type: 'BUY_POTION', bottleId: carrierId });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 900, ap]);
    expect(resolveTimeWormOriginals(s)!.characteristics[0]!.holder).toBe('PLAYER');
    expectHistoryRetained(s);
  }, 60_000);

  it('requires five fresh 1 AP jobs for the 90 balance while all old jobs, failures and costs remain recorded', () => {
    let s = ready(structuredClone(threeFailures), { ap: 2, cash: 1200 });
    s = ae(s, recovery('REQUEST_RECOVERY_V1', 2));
    const requestedWeek = s.timeWorm.resupply.requestedWeek!;
    s = ready(s, { ap: 2, cash: 930, afterWeek: requestedWeek });
    s = ae(s, recovery('RECOVER_CHARACTERISTIC_V1', 2));
    expect(s.timeWorm.bottles[3]).toMatchObject({ labourSteps: 0,
      recovery: { originalBottleId: originalId(2), characteristicId: 'ER0-TW-CHAR-2' } });
    for (let n = 1; n <= 5; n++) {
      s = ae(ready(s, { ap: 2 }), { type: 'POTION_WORK', bottleId: carrierId });
      const event = journal(s).at(-1)!;
      expect(event.before.actions - event.after.actions).toBe(1);
      expect(event.after.cash).toBe(event.before.cash);
      expect(event.cursorAfter).toBe(event.cursorBefore);
      expect(s.timeWorm.bottles[3]!.labourSteps).toBe(n);
      if (n === 4) expect(timeWormAcquisitionActions(s).find(a => a.command.type === 'BUY_POTION' && a.command.bottleId === carrierId)?.cost)
        .toBe('0行动 · 900便士');
    }
    rejectTimeWorm(s, { type: 'POTION_WORK', bottleId: carrierId });
    const cash = s.cash, ap = s.actionsRemaining, random = { ...s.random };
    s = ae(s, { type: 'BUY_POTION', bottleId: carrierId });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 90, ap]);
    expect(s.random).toEqual(random);
    const future = journal(s).slice(journal(threeFailures).length);
    expect(future.reduce((total, e) => total + e.before.cash - e.after.cash, 0)).toBe(120 + 30 + 90);
    expect(future.reduce((total, e) => total + e.before.actions - e.after.actions, 0)).toBe(1 + 1 + 5);
    expect(future.filter(e => e.command.type === 'POTION_WORK')).toHaveLength(5);
    const originals = resolveTimeWormOriginals(s)!;
    expect(originals.characteristics).toHaveLength(3);
    expect(originals.characteristics[1]).toMatchObject({ characteristicId: 'ER0-TW-CHAR-2',
      originalBottleId: originalId(2), latestBottleId: carrierId, holder: 'PLAYER' });
    expect(s.timeWorm.bottles[3]!.labourSteps).toBe(5);
    expectHistoryRetained(s);
  }, 60_000);
});
