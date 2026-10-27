import { beforeAll, describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  applyNatureWalkerAcquisition, createNatureWalkerState, natureWalkerAcquisitionActions,
  natureWalkerAcquisitionBlock, natureWalkerCharacteristicId, natureWalkerInheritedView,
  natureWalkerOriginalBottlePrice, projectNatureWalker, resolveNatureWalkerOriginalsSnapshot,
  validateNatureWalkerAcquisitionCommand, validateNatureWalkerAcquisitionJournal,
} from '../../src/domain/nature-walker/index.js';
import { NATURE_WALKER_CURRENT_CONSUMPTION_RISK, NATURE_WALKER_RECOVERY_SITE_ID, natureWalkerConsumptionRisk } from '../../src/domain/nature-walker/content.js';
import { NATURE_WALKER_PREPARATION_IDS, type NatureWalkerAcquisitionCommand } from '../../src/domain/nature-walker/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const originalId = (n: number) => `nature-walker-potion-${n}`;
const carrierId = 'nature-walker-recovery-1';
const recovery = (type: 'REQUEST_RECOVERY_V1' | 'RECOVER_CHARACTERISTIC_V1', bottleId = originalId(1)): NatureWalkerAcquisitionCommand => ({ type, bottleId });
let raw: SliceState, failed: SliceState, requested: SliceState, supplied: SliceState;

/** UNIT-only future acquisition branches. The captured955 and every predecessor
 * root remain read-only; no historical action sequence is regenerated. */
function initial(successAt: 1 | 2 | 3 | null): SliceState {
  const s = natureWalkerInheritedView(structuredClone(raw));
  s.schemaVersion = 226; s.natureWalker = createNatureWalkerState();
  const weeks = Math.max(0, s.barrenMatriarch.promotionWeek! + 12 - s.week);
  s.week += weeks; s.date = addGameWeeks(s.date, weeks); s.revision += 2;
  s.cash = 100000; s.actionsRemaining = s.weeklyBudget = 100; s.health = s.mind = 100;
  const chance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 4096; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    const rolls = Array.from({ length: successAt ?? 4 }, () => random.nextInt(1, 100));
    if (rolls.every((r, i) => successAt === i + 1 ? r > 5 && r <= chance : r > chance && r < 96)) { s.random.cursor = cursor; return s; }
  }
  throw Error('No bounded UNIT acquisition cursor.');
}
function run(s: SliceState, command: NatureWalkerAcquisitionCommand): SliceState {
  applyNatureWalkerAcquisition(s, command, {
    note() {}, roll() { throw Error('Unexpected non-potion random draw.'); },
    check(ability, difficulty) {
      const random = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: random.nextInt(1, 100) });
      s.random.cursor = random.cursor; return result;
    },
  });
  s.revision += 2; return s;
}
function threeOriginals(successAt: 1 | 2 | 3 | null): SliceState {
  const s = initial(successAt); run(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of NATURE_WALKER_PREPARATION_IDS) run(s, { type: 'PREPARE_TASK', taskId });
  for (let number = 1; number <= (successAt ?? 3); number++) {
    const bottleId = originalId(number);
    run(s, { type: 'BUY_POTION', bottleId }); run(s, { type: 'PREPARE_PROMOTION' }); run(s, { type: 'CONSUME', bottleId, confirmed: true });
  }
  return s;
}
beforeAll(() => {
  raw = readObjectEntry<SliceState>('tests/fixtures/nature-walker-v02070/natural.json', 'final');
  failed = threeOriginals(null); requested = run(structuredClone(failed), recovery('REQUEST_RECOVERY_V1'));
  supplied = structuredClone(requested); supplied.week++; supplied.date = addGameWeeks(supplied.date, 1); supplied.revision += 2;
  run(supplied, recovery('RECOVER_CHARACTERISTIC_V1'));
});

describe('Nature Walker finite original-characteristic recovery', () => {
  it('reads actual207/955 without changing its first success, other originals, costs or RNG', () => {
    const bytes = stableStringify(raw), snapshot = resolveNatureWalkerOriginalsSnapshot(raw.natureWalker);
    expect(raw.schemaVersion).toBe(204); expect(raw.revision).toBe(956);
    expect(snapshot).toMatchObject({ embodiedOriginalBottleId: originalId(1), embodiedBottleId: originalId(1),
      characteristics: [{ holder: 'EMBODIED' }, { holder: 'SUPPLIER' }, { holder: 'SUPPLIER' }] });
    expect(snapshot!.characteristics).toHaveLength(3); expect(raw.natureWalker.bottles).toHaveLength(3);
    expect(raw.natureWalker.bottles.slice(1).every(b => b.acquiredWeek === null && b.consumedWeek === null)).toBe(true);
    expect(stableStringify(raw)).toBe(bytes);
  });

  it.each([1, 2, 3] as const)('resolves a legitimate success on original%d with exactly three identities', number => {
    const s = threeOriginals(number), snapshot = resolveNatureWalkerOriginalsSnapshot(s.natureWalker)!;
    expect(validateNatureWalkerAcquisitionJournal(s)).toBe(true);
    expect(snapshot.embodiedOriginalBottleId).toBe(originalId(number));
    expect(snapshot.characteristics.map(c => c.holder)).toEqual([1, 2, 3].map(i => i < number ? 'FAILED_REMNANT' : i === number ? 'EMBODIED' : 'SUPPLIER'));
    expect(snapshot.characteristics.map(c => c.characteristicId)).toEqual([1, 2, 3].map(n => natureWalkerCharacteristicId(originalId(n))));
  });

  it('pays120 and30 across a real week with fresh permissions and a same-ID carrier', () => {
    const request = requested.natureWalker.acquisitionJournal.at(-1)!, handover = supplied.natureWalker.acquisitionJournal.at(-1)!;
    expect([request.before.cash - request.after.cash, request.before.actions - request.after.actions]).toEqual([120, 1]);
    expect([handover.before.cash - handover.after.cash, handover.before.actions - handover.after.actions]).toEqual([30, 1]);
    expect(request.recoverySite).toMatchObject({ siteId: NATURE_WALKER_RECOVERY_SITE_ID, originals: failed.natureWalker.sourceScene!.originals,
      permission: { personId: 'MO229-NATURE-WALKER-SUPPLIER', purpose: 'INVESTIGATE', week: request.week, revision: request.revision } });
    expect(handover.recoverySite).toMatchObject({ permission: { purpose: 'RECOVER', week: handover.week, revision: handover.revision }, custodyBefore: 'SEALED_WITH_CUSTODIAN', custodyAfter: 'SUPPLIER' });
    expect(handover.week).toBeGreaterThan(request.week); expect(supplied.random).toEqual(failed.random);
    expect(supplied.natureWalker.bottles.at(-1)).toMatchObject({ id: carrierId, status: 'SUPPLIER', labourSteps: 0,
      recovery: { originalBottleId: originalId(1), characteristicId: 'NW229-CHAR-1' } });
    expect(supplied.natureWalker.bottles.slice(0, 3)).toEqual(failed.natureWalker.bottles);
    expect(supplied.natureWalker.acquisitionJournal.slice(0, failed.natureWalker.acquisitionJournal.length)).toEqual(failed.natureWalker.acquisitionJournal);
    expect(supplied.natureWalker.sourceHistory).toEqual(failed.natureWalker.sourceHistory);
    expect(validateNatureWalkerAcquisitionJournal(supplied)).toBe(true);
    expect(resolveNatureWalkerOriginalsSnapshot(supplied.natureWalker)!.characteristics).toHaveLength(3);
  });

  it('blocks fourth-original commands, same-week handover, duplicate custody and moved original scene', () => {
    for (const type of ['REQUEST_SUPPLY', 'RECEIVE_SUPPLY']) expect(validateNatureWalkerAcquisitionCommand({ type })).toBe(false);
    expect(natureWalkerAcquisitionBlock(requested, recovery('RECOVER_CHARACTERISTIC_V1'))).toMatch(/真实周/);
    expect(natureWalkerAcquisitionBlock(requested, recovery('REQUEST_RECOVERY_V1', originalId(2)))).not.toBeNull();
    expect(natureWalkerAcquisitionBlock(supplied, recovery('REQUEST_RECOVERY_V1'))).not.toBeNull();
    const moved = structuredClone(failed); moved.coffinBearer.life.playerLocation = 'A';
    expect(natureWalkerAcquisitionBlock(moved, recovery('REQUEST_RECOVERY_V1'))).not.toBeNull();
    const backdated = Object.assign(structuredClone(requested), { schemaVersion: 225 });
    expect(validateNatureWalkerAcquisitionJournal(backdated)).toBe(false);
    expect(natureWalkerAcquisitionActions(failed).filter(a => a.command.type === 'REQUEST_RECOVERY_V1')).toHaveLength(3);
    expect(validateNatureWalkerAcquisitionCommand({ type: 'STABILIZE_PROMOTION', bottleId: carrierId })).toBe(false);
  });

  it('charges a new900p carrier or five fresh jobs plus90p and retains its failed remnant for recovery', () => {
    expect(natureWalkerOriginalBottlePrice(failed.natureWalker.bottles[0]!)).toBe(7200);
    expect(natureWalkerOriginalBottlePrice({ ...failed.natureWalker.bottles[0]!, labourSteps: 5 })).toBe(1200);
    expect(natureWalkerOriginalBottlePrice(supplied.natureWalker.bottles[3]!)).toBe(900);
    const s = structuredClone(supplied);
    for (let i = 0; i < 5; i++) run(s, { type: 'POTION_WORK', bottleId: carrierId });
    const cash = s.cash; run(s, { type: 'BUY_POTION', bottleId: carrierId }); expect(cash - s.cash).toBe(90);
    // Explicit UNIT-only intervening ordinary rest budget; acquisition replay verifies each exact charge.
    s.mind = s.health = 100; s.revision += 2;
    run(s, { type: 'PREPARE_PROMOTION' }); const cursor = s.random.cursor;
    run(s, { type: 'CONSUME', bottleId: carrierId, confirmed: true });
    expect(s.random.cursor).toBe(cursor + 1); expect(s.progression.sequence).toBe(2);
    expect(resolveNatureWalkerOriginalsSnapshot(s.natureWalker)!.characteristics[0]).toMatchObject({ latestBottleId: carrierId, holder: 'FAILED_REMNANT',
      consumptionHistory: [{ bottleId: originalId(1), outcome: 'FAILURE' }, { bottleId: carrierId, outcome: 'FAILURE' }] });
    run(s, recovery('REQUEST_RECOVERY_V1', carrierId)); s.week++; s.date = addGameWeeks(s.date, 1); s.revision += 2;
    run(s, recovery('RECOVER_CHARACTERISTIC_V1', carrierId));
    expect(s.natureWalker.bottles.at(-1)).toMatchObject({ id: 'nature-walker-recovery-2', recovery: { sourceBottleId: carrierId, originalBottleId: originalId(1) } });
    expect(validateNatureWalkerAcquisitionJournal(s)).toBe(true);
    expect(resolveNatureWalkerOriginalsSnapshot(s.natureWalker)!.characteristics).toHaveLength(3);
  });

  it('rejects forged recovery identities, permission and payment evidence without rewriting history', () => {
    for (const mutate of [
      (s: SliceState) => { s.natureWalker.bottles[3]!.recovery!.originalBottleId = originalId(2); },
      (s: SliceState) => { s.natureWalker.acquisitionJournal.at(-1)!.recoverySite!.permission.personId = 'GUIDE' as never; },
      (s: SliceState) => { s.natureWalker.acquisitionJournal.at(-1)!.after.cash++; },
    ]) { const s = structuredClone(supplied); mutate(s); expect(validateNatureWalkerAcquisitionJournal(s)).toBe(false); expect(resolveNatureWalkerOriginalsSnapshot(s.natureWalker)).toBeNull(); }
    const legacy = structuredClone(failed);
    for (let i = 4; i <= 6; i++) legacy.natureWalker.bottles.push({ ...createNatureWalkerState().bottles[0]!, id: originalId(i) });
    legacy.natureWalker.resupply.deliveries = 1; const bytes = stableStringify(legacy.natureWalker);
    expect(resolveNatureWalkerOriginalsSnapshot(legacy.natureWalker)).toBeNull();
    expect(natureWalkerAcquisitionBlock(legacy, recovery('REQUEST_RECOVERY_V1'))).toMatch(/守恒冲突/);
    expect(stableStringify(legacy.natureWalker)).toBe(bytes);
  });

  it('keeps archived risk wording immutable while current guidance explains finite recovery', () => {
    expect(natureWalkerConsumptionRisk()).toContain('申请独立三瓶');
    expect(NATURE_WALKER_CURRENT_CONSUMPTION_RISK).toContain('不再供应第四份原特性');
    expect(NATURE_WALKER_CURRENT_CONSUMPTION_RISK).not.toContain('申请独立三瓶');
    expect(projectNatureWalker(failed).risk).toBe(NATURE_WALKER_CURRENT_CONSUMPTION_RISK);
  });
});
