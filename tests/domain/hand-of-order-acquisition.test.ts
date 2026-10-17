import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateBalancerState } from '../../src/domain/balancer/index.js';
import { createHandOfOrderState, handOfOrderInheritedView, handOfOrderAcquisitionBlock, handOfOrderOriginals,
  projectHandOfOrder, validateHandOfOrderState, validateHandOfOrderSource, validateHandOfOrderAcquisitionJournal } from '../../src/domain/hand-of-order/index.js';
import { HAND_OF_ORDER_INHERITED_ABILITY_IDS, HAND_OF_ORDER_ABILITY_IDS, HAND_OF_ORDER_PREPARATION_IDS } from '../../src/domain/hand-of-order/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { originalBalancer, directedInitial2, taught, prepared, promoted, prepareBottle, step, hoo, ready, dose,
  rejectHandOfOrder, rejectIntent, oldJusticiarRoots } from './hand-of-order-directed-helper.js';
const journal = (s: SliceState) => s.handOfOrder.acquisitionJournal;

describe('HandOfOrder independent acquisition and truthful S2 source', () => {
  it('starts nine of twelve weeks after realS2 promotion and freezes actual767-second originals without healing', () => {
    const s = originalBalancer(); expect(s.handOfOrder).toEqual(createHandOfOrderState());
    expect(s.week - s.balancer.promotionWeek!).toBe(9); expect(s.progression.promotionWeek).toBe(9); rejectHandOfOrder(s, dose);
    const n = hoo(s, { type: 'LEARN_GUIDANCE' }), receipt = journal(n)[0]!;
    expect([receipt.before.cash - receipt.after.cash, receipt.before.actions - receipt.after.actions]).toEqual([500, 1]);
    expect(n.health).toBe(60); expect(n.injuries).toEqual(s.injuries); expect(n.character).toEqual(s.character);
    expect(n.handOfOrder.sourceScene!.originals).toEqual({ site: s.chaosHunter.life, operation: s.balancer.life.operation, guardPlate: s.balancer.life.guardPlate });
    expect(n.handOfOrder.sourceScene!.originals.site).not.toEqual(s.balancer.life.source!.snapshot);
    expect(oldJusticiarRoots(n)).toEqual(oldJusticiarRoots(s)); expect('gifts' in n.handOfOrder).toBe(false); assertValidSliceState(n);
  }, 120_000);
  it('projects exact17 inherited entries including six zero skills before promotion with no private source or RNG', () => {
    for (const s of [originalBalancer(), taught()]) {
      const before = structuredClone(s), p = projectHandOfOrder(s);
      expect(p.abilities.map(a => a.id)).toEqual([...HAND_OF_ORDER_INHERITED_ABILITY_IDS]);
      for (const a of p.abilities) expect(a.mastery).toBe(s.progression.mastery[a.id]);
      expect(p.abilities.filter(a => a.mastery === 0)).toHaveLength(6); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
      expect(p.resources).toMatchObject({ health: s.health, mind: s.mind, spirituality: s.spirituality, maxSpirituality: 120 });
      const json = JSON.stringify(p);
      for (const secret of ['sourceScene', 'sourceHistory', 'historyDigest', 'identityDigest', 'randomCursor', 'randomSeed', 'weeklyBudget', 'acquisitionJournal', 'cursorBefore', 'cursorAfter']) expect(json).not.toContain(`"${secret}"`);
      expect(json).not.toContain(s.random.seed); expect('gifts' in p).toBe(false); expect(s).toEqual(before);
    }
  }, 120_000);
  it('charges five bottle-specific jobs, three preparations,1200p delivery and180p current-site check', () => {
    const s = prepared(), j = journal(s), work = j.filter(e => e.command.type === 'POTION_WORK');
    expect(work).toHaveLength(5); for (const e of work) expect([e.before.actions - e.after.actions, e.before.cash - e.after.cash]).toEqual([1, 0]);
    expect(j.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command.type === 'PREPARE_TASK' ? e.command.taskId : null)).toEqual([...HAND_OF_ORDER_PREPARATION_IDS]);
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, prep = j.at(-1)!;
    expect([buy.before.cash - buy.after.cash, buy.before.actions - buy.after.actions]).toEqual([1200, 0]);
    expect([prep.before.cash - prep.after.cash, prep.before.actions - prep.after.actions]).toEqual([180, 1]);
    expect(s.health).toBe(60); expect(s.injuries).toEqual(originalBalancer().injuries); expect(s.handOfOrder.bottles[1]!.labourSteps).toBe(0);
    rejectHandOfOrder(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = hoo(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining]).toEqual([s.cash, s.actionsRemaining]);
    expect(left.handOfOrder.bottles[0]!.status).toBe('PLAYER'); rejectHandOfOrder(left, dose); assertValidSliceState(left);
  }, 120_000);
  it('enforces all17 masteries, health/mind, realS2 elapsed weeks and completed old reports', () => {
    const missing = directedInitial2(), extra = directedInitial2(); delete missing.progression.mastery['justiciar.s5.punishment']; extra.progression.mastery['justiciar.s0.justiciar'] = 0;
    expect(handOfOrderAcquisitionBlock(missing, { type: 'LEARN_GUIDANCE' })).toContain('17项');
    expect(handOfOrderAcquisitionBlock(extra, { type: 'LEARN_GUIDANCE' })).toContain('17项');
    for (const [health, mind] of [[20, 100], [100, 40]] as const) { const s = prepared(); s.health = health; s.mind = mind; expect(handOfOrderAcquisitionBlock(s, dose)).toContain('健康>20且精神>40'); }
    let early = taught('SUCCESS', false); for (const taskId of HAND_OF_ORDER_PREPARATION_IDS) early = hoo(early, { type: 'PREPARE_TASK', taskId });
    early = hoo(early, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(handOfOrderAcquisitionBlock(early, { type: 'PREPARE_PROMOTION' })).toContain('9/12');
    const unfinished = directedInitial2(); unfinished.balancer.life.reflected = false; expect(handOfOrderAcquisitionBlock(unfinished, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
  }, 120_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('replays %s while keeping old wounds,17 masteries and all paid costs', kind => {
    const before = prepared(kind), s = hoo(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(kind); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.cursorAfter).toBe(e.cursorBefore + 1);
    expect(s.handOfOrder.bottles[0]!.status).toBe('CONSUMED'); expect(s.handOfOrder.preparedWeek).toBeNull();
    expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(s.injuryRisk).toBe(1); expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(before));
    const won = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(s.progression.sequence).toBe(won ? 1 : 2); expect(s.progression.acting).toBe(won ? 0 : 100);
    expect(s.mind).toBe(before.mind - (kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45));
    expect(s.health).toBe(before.health - (won ? 0 : kind === 'FAILURE' ? 15 : 25));
    expect(s.seer.pollution).toBe(won ? before.seer.pollution : kind === 'FAILURE' ? 30 : 60);
    for (const id of HAND_OF_ORDER_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(before.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(won ? 19 : 17);
    for (const id of HAND_OF_ORDER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(won ? 0 : undefined);
    expect(validateHandOfOrderAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 120_000);
  it('adds only two zero skills and one per core stat, keeps historical S2 body and does not refill spirituality', () => {
    const initial = directedInitial2(); initial.spirituality = 80; // Explicit pre-journal UNIT current-resource coverage.
    let s = hoo(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of HAND_OF_ORDER_PREPARATION_IDS) s = hoo(s, { type: 'PREPARE_TASK', taskId });
    s = hoo(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = hoo(s, { type: 'PREPARE_PROMOTION' }); s = hoo(s, dose);
    expect(s.spirituality).toBe(80); expect(s.health).toBe(60); expect(s.injuries).toEqual(initial.injuries);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(8); expect(s.character.coreStats).toEqual({ physique: 31, perception: 26, will: 26, knowledge: 22 });
    const view = handOfOrderInheritedView(s); expect(view.character).toEqual(initial.character); expect(view.progression.sequence).toBe(2); expect(validateBalancerState(view)).toBe(true);
    expect(validateHandOfOrderSource(s)).toBe(true); expect(handOfOrderOriginals(s)).toEqual(s.handOfOrder.sourceScene!.originals);
    expect(s.handOfOrder.life.site).toEqual(initial.chaosHunter.life); expect(s.handOfOrder.life.guardPlate).toEqual(initial.balancer.life.guardPlate);
    expect(projectHandOfOrder(s).abilities).toHaveLength(19); expect(projectSliceState(s).maxSpirituality).toBe(120); assertValidSliceState(s);
  }, 120_000);
  it('reconciles adjacent ordinary weekly bills and refuses minted tail cash', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3;
    let s = hoo(initial, { type: 'LEARN_GUIDANCE' }); expect(s.week).toBe(initial.week + 1); expect(s.cash).toBe(initial.cash - 530);
    s = hoo(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); expect(validateHandOfOrderAcquisitionJournal(s)).toBe(true);
    const bad = structuredClone(s); bad.cash++; expect(validateHandOfOrderState(bad)).toBe(false); assertValidSliceState(s);
  }, 120_000);
  it('uses public debt/bill resolution rather than inventing acquisition financing', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; initial.cash = 500;
    let s = hoo(initial, { type: 'LEARN_GUIDANCE' }); expect(s.activeEvent?.id).toBe('LIFE-BILL-01');
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY_PART' });
    const id = s.debts.at(-1)!.id; expect(s.debts.at(-1)).toMatchObject({ remaining: 30, weeklyPayment: 30, createdWeek: initial.week });
    s = step(s, { type: 'ACTION', action: 'WORK' }); s = hoo(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); s = hoo(s, { type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' });
    expect(s.cash).toBe(120); expect(s.debts.find(d => d.id === id)!.remaining).toBe(0); expect(validateHandOfOrderAcquisitionJournal(s)).toBe(true);
    const bad = structuredClone(s); bad.debts.find(d => d.id === id)!.remaining = 1; expect(validateHandOfOrderState(bad)).toBe(false);
  }, 120_000);
  it('allows a genuine0AP preparation exit with no refunds and the ordinary weekly bill', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 5;
    let s = hoo(initial, { type: 'LEARN_GUIDANCE' }); for (const taskId of HAND_OF_ORDER_PREPARATION_IDS) s = hoo(s, { type: 'PREPARE_TASK', taskId });
    s = hoo(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = hoo(s, { type: 'PREPARE_PROMOTION' }); expect(s.actionsRemaining).toBe(0);
    const n = hoo(s, { type: 'LEAVE_PREPARATION' }), receipt = journal(n).at(-1)!;
    expect(receipt.before).toEqual(receipt.after); expect(n.week).toBe(s.week + 1); expect(n.cash).toBe(s.cash - 30); expect(n.random).toEqual(s.random);
    expect(n.handOfOrder.bottles[0]!.status).toBe('PLAYER'); expect(n.injuries).toEqual(s.injuries); assertValidSliceState(n);
  }, 120_000);
  it('requires three genuine failures, paid request and actual next week for fresh independent bottles', () => {
    let s = taught('THREE_FAILURES'); rejectHandOfOrder(s, { type: 'REQUEST_SUPPLY' });
    for (let number = 1; number <= 3; number++) { const bottleId = `hand-of-order-potion-${number}`; s = prepareBottle(s, bottleId); s = hoo(s, { type: 'CONSUME', bottleId, confirmed: true }); expect(s.progression.sequence).toBe(2); }
    s = ready(s, { ap: 2, cash: 100, health: 100, mind: 100 }); const before = s.cash;
    s = hoo(s, { type: 'REQUEST_SUPPLY' }); expect(s.cash).toBe(before - 100); const requested = s.handOfOrder.resupply.requestedWeek!;
    rejectHandOfOrder(s, { type: 'RECEIVE_SUPPLY' }); s = ready(s, { afterWeek: requested }); s = hoo(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.handOfOrder.bottles).toHaveLength(6); expect(s.handOfOrder.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
    expect(s.handOfOrder.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('rejects tampered source receipts, random evidence and forgedS1/S0 states', () => {
    for (const mutate of [
      (s: SliceState) => { s.handOfOrder.acquisitionJournal[0]!.after.cash++; },
      (s: SliceState) => { s.handOfOrder.acquisitionJournal.at(-1)!.cursorAfter++; },
      (s: SliceState) => { s.handOfOrder.sourceScene!.originals.guardPlate.integrity = 100; },
      (s: SliceState) => { s.progression.sequence = 0; },
      (s: SliceState) => { s.handOfOrder.promotionWeek = null; },
    ]) { const s = promoted(); mutate(s); expect(validateHandOfOrderState(s), mutate.toString()).toBe(false); }
    const fake = originalBalancer(); fake.progression.sequence = 1; expect(validateHandOfOrderState(fake)).toBe(false);
  }, 120_000);
});
