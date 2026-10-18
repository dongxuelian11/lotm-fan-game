import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  hasDivineHandLock, resolveDivineHandOriginals, divineHandAcquisitionActions,
  divineHandAcquisitionBlock, validateDivineHandAcquisitionJournal, validateDivineHandSource, validateDivineHandState, resolveDivineHandOriginalsSnapshot,
} from '../../src/domain/divine-hand/index.js';
import { DIVINE_HAND_RECOVERY_SITE_ID } from '../../src/domain/divine-hand/content.js';
import type { DivineHandAcquisitionCommand } from '../../src/domain/divine-hand/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  ae, ordinary, originalWarriorRoots, prepareBottle, ready, rejectDivineHand,
} from './divine-hand-directed-helper.js';

const naturalPath = 'tests/fixtures/divine-hand-v01980/natural.json';
const originalId = (n: number) => `divine-hand-potion-${n}`;
const carrierId = 'divine-hand-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', n = 1): DivineHandAcquisitionCommand =>
  ({ type, bottleId: originalId(n) });
const digest = (value: unknown) => createHash('sha256').update(stableStringify(value)).digest('hex');
const journal = (s: SliceState) => s.divineHand.acquisitionJournal;
let threeFailures: SliceState;
let historicalRootsDigest: string;
let futureDraws: Map<number, number>;
let restoreFutureDraws: (() => void) | undefined;

/** CONTROLLED FUTURE FAILURE INJECTION, not another natural capture. Read the
 * preserved actual158 Glory prefix directly; no dead297 ending is replayed.
 * Its directed70 S3 provenance remains unchanged; this is a controlled future test.
 * Three future failures and one declared recovered-vessel success are controlled,
 * after each bottle is
 * legally prepared. The real stream still advances its cursor; the same scoped
 * map supplies validator replay until both tests finish. All other draws, the
 * seed, starting cursor and eight legacy histories remain untouched. New jobs,
 * wages, care, bills, preparations and failures use the public reducer. */
beforeAll(() => {
  const raw = readObjectEntry<SliceState>(naturalPath, 'prefixFinal');
  expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex'))
    .toBe('1908adb35d936bd5651ef7cd1ca9cbeffc55e3b3568ee21ff5798741ab3a2332');
  expect(raw).toMatchObject({ revision: 600, week: 146, health: 90, cash: 500,
    random: { seed: 'warrior-natural-v042', cursor: 475 },
    progression: { pathwayId: 'warrior', sequence: 2, acting: 100 } });
  historicalRootsDigest = digest(originalWarriorRoots(raw));
  futureDraws = new Map<number, number>();
  const originalNextInt = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor;
    const actual = originalNextInt.call(this, minimum, maximum);
    return this.seed === raw.random.seed && minimum === 1 && maximum === 100
      ? futureDraws.get(cursor) ?? actual : actual;
  });
  restoreFutureDraws = () => spy.mockRestore();
  let s = ready(ordinary(migrateSliceState(raw), undefined, true), {
    cash: 500, health: 100, mind: 100, spirituality: 120,
  });
  expect(s.divineHand.guidanceKnown).toBe(false);
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
    expect(futureDraws.has(s.random.cursor)).toBe(false);
    futureDraws.set(s.random.cursor, roll);
    s = ae(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    expect(s.divineHand.bottles[n - 1]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE', labourSteps: 5 });
    expect(s.progression.sequence).toBe(2);
  }
  expect(futureDraws.size).toBe(3);
  expect(journal(s).filter(e => e.command.type === 'CONSUME').map(e => e.cursorBefore))
    .toEqual([...futureDraws.keys()]);
  expect(s.divineHand.sourceScene!.random).toEqual(raw.random);
  expect(digest(originalWarriorRoots(s))).toBe(historicalRootsDigest);
  expect(createHash('sha256').update(JSON.stringify(raw)).digest('hex'))
    .toBe('1908adb35d936bd5651ef7cd1ca9cbeffc55e3b3568ee21ff5798741ab3a2332');
  expect(resolveDivineHandOriginals(s)?.characteristics.map(c => c.holder))
    .toEqual(['FAILED_REMNANT', 'FAILED_REMNANT', 'FAILED_REMNANT']);
  threeFailures = s;
}, 180_000);
afterAll(() => restoreFutureDraws?.());

function expectHistoryRetained(s: SliceState): void {
  expect(s.divineHand.bottles.slice(0, 3)).toEqual(threeFailures.divineHand.bottles);
  expect(journal(s).slice(0, journal(threeFailures).length)).toEqual(journal(threeFailures));
  expect(s.divineHand.sourceHistory).toEqual(threeFailures.divineHand.sourceHistory);
  expect(digest(originalWarriorRoots(s))).toBe(historicalRootsDigest);
  const purchases = journal(s).filter(e => e.command.type === 'BUY_POTION' && e.command.bottleId.startsWith('divine-hand-potion-'));
  expect(purchases.map(e => e.before.cash - e.after.cash)).toEqual([1100, 1100, 1100]);
  expect(journal(s).filter(e => e.command.type === 'PREPARE_PROMOTION').map(e => e.before.cash - e.after.cash))
    .toEqual([150, 150, 150]);
  expect(validateDivineHandSource(s)).toBe(true);
  expect(validateDivineHandAcquisitionJournal(s)).toBe(true);
  assertValidSliceState(s);
}

describe('Divine Hand controlled future same-original recovery through legal actions', () => {
  it('pays 120/1 AP, waits an ordinary week, pays 30/1 AP and 900 for the same original; rejects early, duplicate and reused claims', () => {
    let s = ready(structuredClone(threeFailures), { ap: 2, cash: 1200 });
    const before = { cash: s.cash, ap: s.actionsRemaining, random: { ...s.random } };
    const failed = journal(s).find(e => e.command.type === 'CONSUME' && e.command.bottleId === originalId(1))!;
    s = ae(s, recovery('REQUEST_RECOVERY_V1'));
    const request = journal(s).at(-1)!, pending = structuredClone(s.divineHand.resupply.recovery!);
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 120, before.ap - 1]);
    expect(s.random).toEqual(before.random);
    expect(hasDivineHandLock(s)).toBe(false);
    expect(pending).toEqual({ version: 1, sourceBottleId: originalId(1), originalBottleId: originalId(1),
      characteristicId: 'TG220-DH-CHAR-1', requestedWeek: request.week, sourceReceiptRevision: failed.revision,
      siteId: DIVINE_HAND_RECOVERY_SITE_ID, custodian: 'TG220-DIVINE-HAND-SUPPLIER' });
    expect(request.recoverySite).toMatchObject({ sourceReceiptRevision: failed.revision,
      originals: s.divineHand.sourceScene!.originals,
      permission: { personId: 'TG220-DIVINE-HAND-SUPPLIER', week: request.week, revision: request.revision, purpose: 'INVESTIGATE' },
      custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect(divineHandAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1'))).toMatch(/真实周/);
    for (const command of [recovery('REQUEST_RECOVERY_V1'), recovery('REQUEST_RECOVERY_V1', 2),
      recovery('RECOVER_CHARACTERISTIC_V1'), recovery('RECOVER_CHARACTERISTIC_V1', 2)]) rejectDivineHand(s, command);

    s = ready(s, { ap: 2, cash: 930, afterWeek: pending.requestedWeek });
    const handoverCash = s.cash, handoverAP = s.actionsRemaining, handoverRandom = { ...s.random };
    s = ae(s, recovery('RECOVER_CHARACTERISTIC_V1'));
    const handover = journal(s).at(-1)!;
    expect(handover.week).toBeGreaterThan(pending.requestedWeek);
    expect([s.cash, s.actionsRemaining]).toEqual([handoverCash - 30, handoverAP - 1]);
    expect(s.random).toEqual(handoverRandom);
    expect(handover.recoverySite).toMatchObject({ originals: request.recoverySite!.originals,
      sourceReceiptRevision: failed.revision, characteristicId: 'TG220-DH-CHAR-1',
      permission: { personId: 'TG220-DIVINE-HAND-SUPPLIER', week: handover.week, revision: handover.revision, purpose: 'RECOVER' },
      custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(s.divineHand.bottles.map(b => b.id)).toEqual([originalId(1), originalId(2), originalId(3), carrierId]);
    expect(s.divineHand.bottles[3]).toMatchObject({ id: carrierId, status: 'SUPPLIER', labourSteps: 0,
      recovery: { ...pending, recoveredWeek: handover.week } });
    expect(s.divineHand.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    const originals = resolveDivineHandOriginals(s)!;
    expect(originals.characteristics).toHaveLength(3);
    expect(originals.characteristics.map(c => c.characteristicId)).toEqual(['TG220-DH-CHAR-1', 'TG220-DH-CHAR-2', 'TG220-DH-CHAR-3']);
    expect(originals.characteristics[0]).toMatchObject({ originalBottleId: originalId(1), latestBottleId: carrierId, holder: 'SUPPLIER',
      consumptionHistory: [{ bottleId: originalId(1), week: failed.week, revision: failed.revision, outcome: 'FAILURE' }] });
    expect(originals.embodiedOriginalBottleId).toBeNull();
    for (const command of [recovery('REQUEST_RECOVERY_V1'), recovery('RECOVER_CHARACTERISTIC_V1'),
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'BUY_POTION', bottleId: originalId(4) }]) rejectDivineHand(s, command);
    const cash = s.cash, ap = s.actionsRemaining;
    s = ae(s, { type: 'BUY_POTION', bottleId: carrierId });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 900, ap]);
    expect(resolveDivineHandOriginals(s)!.characteristics[0]!.holder).toBe('PLAYER');
    expectHistoryRetained(s);
    for (const change of [
      (bad: SliceState) => { journal(bad).find(e => e.recoverySite)!.recoverySite!.permission.personId = 'TG220-CELIA' as never; },
      (bad: SliceState) => { journal(bad).find(e => e.recoverySite)!.recoverySite!.originals.site.playerEnergy++; },
      (bad: SliceState) => { journal(bad).find(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1')!.after.cash++; },
      (bad: SliceState) => { bad.divineHand.bottles[3]!.recovery!.sourceReceiptRevision++; },
      (bad: SliceState) => { bad.divineHand.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (bad: SliceState) => { bad.divineHand.bottles[3]!.id = originalId(4); },
    ]) {
      const bad = structuredClone(s); change(bad);
      expect(validateDivineHandState(bad)).toBe(false);
      expect(resolveDivineHandOriginals(bad)).toBeNull();
    }
    const dead = structuredClone(s); dead.status = 'DEAD'; dead.health = 0;
    expect(divineHandAcquisitionBlock(dead, recovery('REQUEST_RECOVERY_V1', 2))).not.toBeNull();
  }, 60_000);

  it('requires five fresh 1 AP jobs for the 90 balance while all old jobs, failures and costs remain recorded', () => {
    let s = ready(structuredClone(threeFailures), { ap: 2, cash: 1200 });
    s = ae(s, recovery('REQUEST_RECOVERY_V1', 2));
    const requestedWeek = s.divineHand.resupply.requestedWeek!;
    s = ready(s, { ap: 2, cash: 930, afterWeek: requestedWeek });
    s = ae(s, recovery('RECOVER_CHARACTERISTIC_V1', 2));
    expect(s.divineHand.bottles[3]).toMatchObject({ labourSteps: 0,
      recovery: { originalBottleId: originalId(2), characteristicId: 'TG220-DH-CHAR-2' } });
    for (let n = 1; n <= 5; n++) {
      s = ae(ready(s, { ap: 2 }), { type: 'POTION_WORK', bottleId: carrierId });
      const event = journal(s).at(-1)!;
      expect(event.before.actions - event.after.actions).toBe(1);
      expect(event.after.cash).toBe(event.before.cash);
      expect(event.cursorAfter).toBe(event.cursorBefore);
      expect(s.divineHand.bottles[3]!.labourSteps).toBe(n);
      if (n === 4) expect(divineHandAcquisitionActions(s).find(a => a.command.type === 'BUY_POTION' && a.command.bottleId === carrierId)?.cost)
        .toBe('0行动 · 900便士');
    }
    rejectDivineHand(s, { type: 'POTION_WORK', bottleId: carrierId });
    const cash = s.cash, ap = s.actionsRemaining, random = { ...s.random };
    s = ae(s, { type: 'BUY_POTION', bottleId: carrierId });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 90, ap]);
    expect(s.random).toEqual(random);
    const future = journal(s).slice(journal(threeFailures).length);
    expect(future.reduce((total, e) => total + e.before.cash - e.after.cash, 0)).toBe(120 + 30 + 90);
    expect(future.reduce((total, e) => total + e.before.actions - e.after.actions, 0)).toBe(1 + 1 + 5);
    expect(future.filter(e => e.command.type === 'POTION_WORK')).toHaveLength(5);
    const originals = resolveDivineHandOriginals(s)!;
    expect(originals.characteristics).toHaveLength(3);
    expect(originals.characteristics[1]).toMatchObject({ characteristicId: 'TG220-DH-CHAR-2',
      originalBottleId: originalId(2), latestBottleId: carrierId, holder: 'PLAYER' });
    expect(s.divineHand.bottles[3]!.labourSteps).toBe(5);
    expectHistoryRetained(s);
    s = ready(s, { ap: 1, cash: 150, health: 100, mind: 100, spirituality: 120, pollution: 0 });
    s = ae(s, { type: 'PREPARE_PROMOTION' });
    const inheritedMastery = { ...s.progression.mastery }, sourceSite = structuredClone(s.glory.life.site);
    const body = { health: s.health, spirituality: s.spirituality, mind: s.mind };
    const cursor = s.random.cursor;
    // One explicitly controlled FUTURE success after the three original failures.
    // The same scoped draw is used by strict replay; the seed/cursor are not rewritten.
    futureDraws.set(cursor, 30);
    expect(resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: 30 }).tier).toBe('SUCCESS');
    s = ae(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
    expect(s.random.cursor).toBe(cursor + 1);
    expect(s.progression.sequence).toBe(1);
    expect(s.health).toBe(body.health); expect(s.spirituality).toBe(body.spirituality); expect(s.mind).toBe(body.mind - 15);
    expect(s.progression.mastery).toEqual({ ...inheritedMastery, 'warrior.s1.beam-stabilize': 0, 'warrior.s1.armor-convergence': 0 });
    expect(s.glory.life.site).toEqual(sourceSite);
    expect(resolveDivineHandOriginals(s)).toMatchObject({ embodiedOriginalBottleId: originalId(2), embodiedBottleId: carrierId });
    expect(resolveDivineHandOriginalsSnapshot(s.divineHand)).toMatchObject({ embodiedOriginalBottleId: originalId(2), embodiedBottleId: carrierId });
    expect(validateDivineHandState(s)).toBe(true);
    assertValidSliceState(s);
    rejectDivineHand(s, recovery('REQUEST_RECOVERY_V1', 3));
    const forged = structuredClone(s);
    journal(forged).find(e => e.command.type === 'CONSUME')!.check!.roll--;
    expect(validateDivineHandAcquisitionJournal(forged)).toBe(false);
  }, 60_000);
});
