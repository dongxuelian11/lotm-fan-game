import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  hasKnowledgeEmperorLock, knowledgeEmperorAcquisitionActions, knowledgeEmperorAcquisitionBlock,
  knowledgeEmperorCharacteristicId, projectKnowledgeEmperor, resolveKnowledgeEmperorOriginals,
  resolveKnowledgeEmperorOriginalsSnapshot, validateKnowledgeEmperorAcquisitionJournal,
  validateKnowledgeEmperorSource, validateKnowledgeEmperorState,
} from '../../src/domain/knowledge-emperor/index.js';
import { KNOWLEDGE_EMPEROR_RECOVERY_SITE_ID } from '../../src/domain/knowledge-emperor/content.js';
import type { KnowledgeEmperorAcquisitionCommand } from '../../src/domain/knowledge-emperor/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { ke, originalSage, originalHermitRoots, prepareBottle, ready, rejectKnowledgeEmperor } from './knowledge-emperor-directed-helper.js';

const originalId = (n: number) => `knowledge-emperor-potion-${n}`;
const carrierId = 'knowledge-emperor-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', n = 1): KnowledgeEmperorAcquisitionCommand => ({ type, bottleId: originalId(n) });
const digest = (v: unknown) => createHash('sha256').update(stableStringify(v)).digest('hex');
const journal = (s: SliceState) => s.knowledgeEmperor.acquisitionJournal;
let threeFailures: SliceState;
let originalRootsDigest: string;
const futureDraws = new Map<number, number>();
const preparedOriginals: SliceState[] = [];
let restoreFutureDraws: (() => void) | undefined;

/** Controlled FUTURE outcomes over the genuine 651-command Sage source. Only
 * each newly prepared S1 draw is overridden; the original seed, cursor, old
 * histories, wages, recovery, costs and actual weekly transitions stay intact.
 * This is not presented as another natural capture. */
beforeAll(() => {
  let s = originalSage();
  originalRootsDigest = digest(originalHermitRoots(s));
  const seed = s.random.seed, originalNextInt = DeterministicActionRandomStream.prototype.nextInt;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum: number, maximum: number,
  ) {
    const cursor = this.cursor, actual = originalNextInt.call(this, minimum, maximum);
    return this.seed === seed && minimum === 1 && maximum === 100 ? futureDraws.get(cursor) ?? actual : actual;
  });
  restoreFutureDraws = () => spy.mockRestore();
  for (const n of [1, 2, 3]) {
    s = prepareBottle(s, originalId(n));
    preparedOriginals.push(structuredClone(s));
    const input = { ability: 'will' as const, baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] };
    const roll = resolveNormalCheck({ ...input, roll: 50 }).chance + 1;
    expect(resolveNormalCheck({ ...input, roll }).tier).toBe('FAILURE');
    futureDraws.set(s.random.cursor, roll);
    s = ke(s, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
    expect(s.knowledgeEmperor.bottles[n - 1]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE', labourSteps: 5 });
  }
  expect(digest(originalHermitRoots(s))).toBe(originalRootsDigest);
  expect(resolveKnowledgeEmperorOriginals(s)?.characteristics.map(c => c.holder)).toEqual(['FAILED_REMNANT', 'FAILED_REMNANT', 'FAILED_REMNANT']);
  threeFailures = s;
}, 180_000);
afterAll(() => restoreFutureDraws?.());

function expectHistoryRetained(s: SliceState): void {
  expect(s.knowledgeEmperor.bottles.slice(0, 3)).toEqual(threeFailures.knowledgeEmperor.bottles);
  expect(journal(s).slice(0, journal(threeFailures).length)).toEqual(journal(threeFailures));
  expect(s.knowledgeEmperor.sourceHistory).toEqual(threeFailures.knowledgeEmperor.sourceHistory);
  expect(digest(originalHermitRoots(s))).toBe(originalRootsDigest);
  expect(journal(s).filter(e => e.command.type === 'BUY_POTION' && e.command.bottleId.startsWith('knowledge-emperor-potion-')).map(e => e.before.cash - e.after.cash)).toEqual([1200, 1200, 1200]);
  expect(journal(s).filter(e => e.command.type === 'PREPARE_PROMOTION').map(e => e.before.cash - e.after.cash)).toEqual([180, 180, 180]);
  expect(validateKnowledgeEmperorSource(s)).toBe(true);
  expect(validateKnowledgeEmperorAcquisitionJournal(s)).toBe(true);
  assertValidSliceState(s);
}

describe('Knowledge Emperor finite original recovery', () => {
  it('resolves the preserved actual source with original3 embodied and both failed remnants unrecovered', () => {
    const raw = readObjectEntry<SliceState>('tests/fixtures/knowledge-emperor-v02000/natural.json', 'final');
    expect(raw.knowledgeEmperor.bottles).toHaveLength(3);
    expect(resolveKnowledgeEmperorOriginalsSnapshot(raw.knowledgeEmperor)).toMatchObject({
      embodiedOriginalBottleId: originalId(3), embodiedBottleId: originalId(3),
      characteristics: [
        { characteristicId: 'KE222-CHAR-1', holder: 'FAILED_REMNANT', latestBottleId: originalId(1) },
        { characteristicId: 'KE222-CHAR-2', holder: 'FAILED_REMNANT', latestBottleId: originalId(2) },
        { characteristicId: 'KE222-CHAR-3', holder: 'EMBODIED', latestBottleId: originalId(3) },
      ],
    });
  });

  it.each([1, 2, 3])('supports a genuine controlled future success of original %s without renaming it', n => {
    const prepared = structuredClone(preparedOriginals[n - 1]!), cursor = prepared.random.cursor, failure = futureDraws.get(cursor)!;
    futureDraws.set(cursor, 30);
    try {
      const s = ke(prepared, { type: 'CONSUME', bottleId: originalId(n), confirmed: true });
      expect(resolveKnowledgeEmperorOriginals(s)).toMatchObject({ embodiedOriginalBottleId: originalId(n), embodiedBottleId: originalId(n) });
      expect(knowledgeEmperorCharacteristicId(originalId(n))).toBe(`KE222-CHAR-${n}`);
      assertValidSliceState(s);
    } finally { futureDraws.set(cursor, failure); }
  });

  it('pays for investigation, a real next week, handover and new ordinary drugs without creating original4', () => {
    let s = ready(structuredClone(threeFailures), { ap: 2, cash: 1200 });
    for (const command of [{ type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'BUY_POTION', bottleId: originalId(4) }]) rejectKnowledgeEmperor(s, command);
    const before = { cash: s.cash, ap: s.actionsRemaining, random: { ...s.random } };
    s = ke(s, recovery('REQUEST_RECOVERY_V1'));
    const request = journal(s).at(-1)!, pending = structuredClone(s.knowledgeEmperor.resupply.recovery!);
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 120, before.ap - 1]);
    expect(s.random).toEqual(before.random); expect(hasKnowledgeEmperorLock(s)).toBe(false);
    expect(request.recoverySite).toMatchObject({ originals: s.knowledgeEmperor.sourceScene!.originals,
      siteId: KNOWLEDGE_EMPEROR_RECOVERY_SITE_ID, originalBottleId: originalId(1), characteristicId: 'KE222-CHAR-1',
      permission: { personId: 'TG222-KNOWLEDGE-EMPEROR-SUPPLIER', week: request.week, revision: request.revision, purpose: 'INVESTIGATE' },
      custodyBefore: 'FAILED_REMNANT', custodyAfter: 'SEALED_WITH_CUSTODIAN' });
    expect(knowledgeEmperorAcquisitionBlock(s, recovery('RECOVER_CHARACTERISTIC_V1'))).toMatch(/真实周/);
    for (const command of [recovery('REQUEST_RECOVERY_V1'), recovery('REQUEST_RECOVERY_V1', 2), recovery('RECOVER_CHARACTERISTIC_V1'), recovery('RECOVER_CHARACTERISTIC_V1', 2)]) rejectKnowledgeEmperor(s, command);
    s = ready(s, { ap: 2, cash: 930, afterWeek: pending.requestedWeek });
    const cash = s.cash, ap = s.actionsRemaining, random = { ...s.random };
    s = ke(s, recovery('RECOVER_CHARACTERISTIC_V1'));
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 30, ap - 1]); expect(s.random).toEqual(random);
    expect(journal(s).at(-1)!.recoverySite).toMatchObject({ originals: request.recoverySite!.originals,
      sourceReceiptRevision: pending.sourceReceiptRevision, characteristicId: 'KE222-CHAR-1',
      permission: { purpose: 'RECOVER' }, custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(s.knowledgeEmperor.bottles.map(b => b.id)).toEqual([originalId(1), originalId(2), originalId(3), carrierId]);
    expect(s.knowledgeEmperor.bottles[3]).toMatchObject({ labourSteps: 0, status: 'SUPPLIER', recovery: { ...pending, recoveredWeek: journal(s).at(-1)!.week } });
    const purchaseCash = s.cash;
    s = ke(s, { type: 'BUY_POTION', bottleId: carrierId });
    expect(s.cash).toBe(purchaseCash - 900);
    expect(resolveKnowledgeEmperorOriginals(s)?.characteristics[0]).toMatchObject({ characteristicId: 'KE222-CHAR-1', latestBottleId: carrierId, holder: 'PLAYER' });
    expectHistoryRetained(s);
    for (const command of [recovery('REQUEST_RECOVERY_V1'), recovery('RECOVER_CHARACTERISTIC_V1'), { type: 'BUY_POTION', bottleId: originalId(4) }]) rejectKnowledgeEmperor(s, command);
    for (const mutate of [
      (bad: SliceState) => { journal(bad).find(e => e.recoverySite)!.recoverySite!.permission.personId = 'PM3-IRIS' as never; },
      (bad: SliceState) => { journal(bad).find(e => e.recoverySite)!.recoverySite!.originals.site.playerEnergy++; },
      (bad: SliceState) => { journal(bad).find(e => e.command.type === 'RECOVER_CHARACTERISTIC_V1')!.after.cash++; },
      (bad: SliceState) => { bad.knowledgeEmperor.bottles[3]!.recovery!.sourceReceiptRevision++; },
      (bad: SliceState) => { bad.knowledgeEmperor.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (bad: SliceState) => { bad.knowledgeEmperor.bottles[3]!.id = originalId(4); },
    ]) {
      const bad = structuredClone(s); mutate(bad);
      expect(validateKnowledgeEmperorState(bad)).toBe(false); expect(resolveKnowledgeEmperorOriginals(bad)).toBeNull();
    }
    const publicText = JSON.stringify(projectKnowledgeEmperor(s));
    for (const privateKey of ['sourceScene', 'sourceHistoryDigest', 'randomBefore', 'randomAfter', 'sourceReceiptRevision']) expect(publicText).not.toContain(`"${privateKey}"`);
  }, 90_000);

  it('charges five new jobs and 90 ordinary-drug balance before a fresh paid preparation and success', () => {
    let s = ready(structuredClone(threeFailures), { ap: 2, cash: 1200 });
    s = ke(s, recovery('REQUEST_RECOVERY_V1', 2));
    s = ready(s, { ap: 2, cash: 930, afterWeek: s.knowledgeEmperor.resupply.requestedWeek! });
    s = ke(s, recovery('RECOVER_CHARACTERISTIC_V1', 2));
    for (let n = 1; n <= 5; n++) {
      s = ke(ready(s, { ap: 2 }), { type: 'POTION_WORK', bottleId: carrierId });
      const event = journal(s).at(-1)!;
      expect(event.before.actions - event.after.actions).toBe(1); expect(event.before.cash).toBe(event.after.cash);
      expect(s.knowledgeEmperor.bottles[3]!.labourSteps).toBe(n);
      if (n === 4) expect(knowledgeEmperorAcquisitionActions(s).find(a => a.command.type === 'BUY_POTION' && a.command.bottleId === carrierId)?.cost).toBe('0行动 · 900便士');
    }
    rejectKnowledgeEmperor(s, { type: 'POTION_WORK', bottleId: carrierId });
    const cash = s.cash; s = ke(s, { type: 'BUY_POTION', bottleId: carrierId }); expect(s.cash).toBe(cash - 90);
    const future = journal(s).slice(journal(threeFailures).length);
    expect(future.reduce((n, e) => n + e.before.cash - e.after.cash, 0)).toBe(120 + 30 + 90);
    expect(future.reduce((n, e) => n + e.before.actions - e.after.actions, 0)).toBe(1 + 1 + 5);
    expectHistoryRetained(s);
    s = ready(s, { ap: 1, cash: 180, health: 100, mind: 100, spirituality: 120, pollution: 0 });
    s = ke(s, { type: 'PREPARE_PROMOTION' });
    const mastery = { ...s.progression.mastery }, randomCursor = s.random.cursor;
    futureDraws.set(randomCursor, 30);
    s = ke(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
    expect(s.random.cursor).toBe(randomCursor + 1);
    expect(s.progression.mastery).toEqual({ ...mastery, 'hermit.s1.knowledge-power': 0, 'hermit.s1.power-knowledge': 0 });
    expect(resolveKnowledgeEmperorOriginals(s)).toMatchObject({ embodiedOriginalBottleId: originalId(2), embodiedBottleId: carrierId });
    expect(resolveKnowledgeEmperorOriginalsSnapshot(s.knowledgeEmperor)?.characteristics).toHaveLength(3);
    assertValidSliceState(s);
    rejectKnowledgeEmperor(s, recovery('REQUEST_RECOVERY_V1', 3));
  }, 90_000);
});
