import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateBarrenMatriarchState } from '../../src/domain/barren-matriarch/index.js';
import { createNatureWalkerState, natureWalkerInheritedView, natureWalkerAcquisitionBlock, natureWalkerOriginals,
  projectNatureWalker, validateNatureWalkerState, validateNatureWalkerSource, validateNatureWalkerAcquisitionJournal } from '../../src/domain/nature-walker/index.js';
import { NATURE_WALKER_INHERITED_ABILITY_IDS, NATURE_WALKER_ABILITY_IDS, NATURE_WALKER_PREPARATION_IDS } from '../../src/domain/nature-walker/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { originalBarrenMatriarch, directedInitial2, taught, prepared, promoted, prepareBottle, step, nw, ready, dose,
  rejectNatureWalker, rejectIntent, oldMotherRoots } from './nature-walker-directed-helper.js';
const journal = (s: SliceState) => s.natureWalker.acquisitionJournal;

describe('NatureWalker independent acquisition and truthful S2 source', () => {
  it('starts ten of twelve weeks after realS2 promotion and freezes actual834-second originals without healing', () => {
    const s = originalBarrenMatriarch(); expect(s.natureWalker).toEqual(createNatureWalkerState());
    expect(s.week - s.barrenMatriarch.promotionWeek!).toBe(10); expect(s.progression.promotionWeek).toBe(6); rejectNatureWalker(s, dose);
    const n = nw(s, { type: 'LEARN_GUIDANCE' }), receipt = journal(n)[0]!;
    expect([receipt.before.cash - receipt.after.cash, receipt.before.actions - receipt.after.actions]).toEqual([500, 1]);
    expect(n.health).toBe(100); expect(n.character.gender).toBe('FEMALE'); expect(n.injuries).toEqual(s.injuries); expect(n.character).toEqual(s.character);
    expect(n.natureWalker.sourceScene!.originals).toEqual({ site: s.coffinBearer.life, operation: s.barrenMatriarch.life.operation, rootPad: s.barrenMatriarch.life.rootPad });
    expect(n.natureWalker.sourceScene!.originals.site).not.toEqual(s.barrenMatriarch.life.source!.snapshot);
    expect(oldMotherRoots(n)).toEqual(oldMotherRoots(s)); expect('gifts' in n.natureWalker).toBe(false); assertValidSliceState(n);
  }, 30_000);
  it('projects exact15 inherited entries including three zero skills before promotion with no private source or RNG', () => {
    for (const s of [originalBarrenMatriarch(), taught()]) {
      const before = structuredClone(s), p = projectNatureWalker(s);
      expect(p.abilities.map(a => a.id)).toEqual([...NATURE_WALKER_INHERITED_ABILITY_IDS]);
      for (const a of p.abilities) expect(a.mastery).toBe(s.progression.mastery[a.id]);
      expect(p.abilities.filter(a => a.mastery === 0)).toHaveLength(3); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
      expect(p.resources).toMatchObject({ health: s.health, mind: s.mind, spirituality: s.spirituality, maxSpirituality: 120 });
      const json = JSON.stringify(p);
      for (const secret of ['sourceScene', 'sourceHistory', 'historyDigest', 'identityDigest', 'randomCursor', 'randomSeed', 'weeklyBudget', 'acquisitionJournal', 'cursorBefore', 'cursorAfter', 'truth', 'preparationRoll', 'sourceSeed']) expect(json).not.toContain(`"${secret}"`);
      expect(p.encounter.preparation).toBeNull(); expect(json).not.toContain(s.random.seed); expect('gifts' in p).toBe(false); expect(s).toEqual(before);
    }
  }, 30_000);
  it('charges five bottle-specific jobs, three preparations,1200p delivery and180p current-site check', () => {
    const s = prepared(), j = journal(s), work = j.filter(e => e.command.type === 'POTION_WORK');
    expect(work).toHaveLength(5); for (const e of work) expect([e.before.actions - e.after.actions, e.before.cash - e.after.cash]).toEqual([1, 0]);
    expect(j.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command.type === 'PREPARE_TASK' ? e.command.taskId : null)).toEqual([...NATURE_WALKER_PREPARATION_IDS]);
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, prep = j.at(-1)!;
    expect([buy.before.cash - buy.after.cash, buy.before.actions - buy.after.actions]).toEqual([1200, 0]);
    expect([prep.before.cash - prep.after.cash, prep.before.actions - prep.after.actions]).toEqual([180, 1]);
    expect(s.health).toBe(100); expect(s.injuries).toEqual(originalBarrenMatriarch().injuries); expect(s.natureWalker.bottles[1]!.labourSteps).toBe(0);
    rejectNatureWalker(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = nw(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining]).toEqual([s.cash, s.actionsRemaining]);
    expect(left.natureWalker.bottles[0]!.status).toBe('PLAYER'); rejectNatureWalker(left, dose); assertValidSliceState(left);
  }, 30_000);
  it('enforces all15 masteries, health/mind, realS2 elapsed weeks and completed old reports', () => {
    const missing = directedInitial2(), extra = directedInitial2(); delete missing.progression.mastery['mother.s5.ground-passage']; extra.progression.mastery['mother.s0.mother'] = 0;
    expect(natureWalkerAcquisitionBlock(missing, { type: 'LEARN_GUIDANCE' })).toContain('15项');
    expect(natureWalkerAcquisitionBlock(extra, { type: 'LEARN_GUIDANCE' })).toContain('15项');
    for (const [health, mind] of [[20, 100], [100, 40]] as const) { const s = prepared(); s.health = health; s.mind = mind; expect(natureWalkerAcquisitionBlock(s, dose)).toContain('健康>20且精神>40'); }
    let early = taught('SUCCESS', false); for (const taskId of NATURE_WALKER_PREPARATION_IDS) early = nw(early, { type: 'PREPARE_TASK', taskId });
    early = nw(early, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(natureWalkerAcquisitionBlock(early, { type: 'PREPARE_PROMOTION' })).toContain('10/12');
    const unfinished = directedInitial2(); unfinished.barrenMatriarch.life.reflected = false; expect(natureWalkerAcquisitionBlock(unfinished, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
  }, 30_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('replays %s while keeping actual body,15 masteries and all paid costs', kind => {
    const before = prepared(kind), s = nw(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(kind); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.cursorAfter).toBe(e.cursorBefore + 1);
    expect(s.natureWalker.bottles[0]!.status).toBe('CONSUMED'); expect(s.natureWalker.preparedWeek).toBeNull();
    expect(s.character.gender).toBe(before.character.gender); expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(s.injuryRisk).toBe(0); expect(oldMotherRoots(s)).toEqual(oldMotherRoots(before));
    const won = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(s.progression.sequence).toBe(won ? 1 : 2); expect(s.progression.acting).toBe(won ? 0 : 100);
    expect(s.mind).toBe(before.mind - (kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45));
    expect(s.health).toBe(before.health - (won ? 0 : kind === 'FAILURE' ? 15 : 25));
    expect(s.seer.pollution).toBe(won ? before.seer.pollution : kind === 'FAILURE' ? 30 : 60);
    for (const id of NATURE_WALKER_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(before.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(won ? 17 : 15);
    for (const id of NATURE_WALKER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(won ? 0 : undefined);
    expect(validateNatureWalkerAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 30_000);
  it('adds only two zero skills and one per core stat, keeps historical S2 body and does not refill spirituality', () => {
    const initial = directedInitial2(); initial.spirituality = 80; // Explicit pre-journal UNIT current-resource coverage.
    let s = nw(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of NATURE_WALKER_PREPARATION_IDS) s = nw(s, { type: 'PREPARE_TASK', taskId });
    s = nw(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = nw(s, { type: 'PREPARE_PROMOTION' }); s = nw(s, dose);
    expect(s.spirituality).toBe(80); expect(s.health).toBe(100); expect(s.injuries).toEqual(initial.injuries);
    expect(Object.values(s.progression.mastery).filter(n => n === 0)).toHaveLength(5); expect(s.character.coreStats).toEqual({ physique: 29, perception: 25, will: 24, knowledge: 25 });
    const view = natureWalkerInheritedView(s); expect(view.character).toEqual(initial.character); expect(view.progression.sequence).toBe(2); expect(validateBarrenMatriarchState(view)).toBe(true);
    expect(validateNatureWalkerSource(s)).toBe(true); expect(natureWalkerOriginals(s)).toEqual(s.natureWalker.sourceScene!.originals);
    expect(s.natureWalker.life.site).toMatchObject(initial.coffinBearer.life); expect(s.natureWalker.life.rootPad).toEqual(initial.barrenMatriarch.life.rootPad);
    expect(projectNatureWalker(s).abilities).toHaveLength(17); expect(projectSliceState(s).maxSpirituality).toBe(120); assertValidSliceState(s);
  }, 30_000);
  it('reconciles adjacent ordinary weekly bills and refuses minted tail cash', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3;
    let s = nw(initial, { type: 'LEARN_GUIDANCE' }); expect(s.week).toBe(initial.week + 1); expect(s.cash).toBe(initial.cash - 530);
    s = nw(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); expect(validateNatureWalkerAcquisitionJournal(s)).toBe(true);
    const bad = structuredClone(s); bad.cash++; expect(validateNatureWalkerState(bad)).toBe(false); assertValidSliceState(s);
  }, 30_000);
  it('uses public debt/bill resolution rather than inventing acquisition financing', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; initial.cash = 500;
    let s = nw(initial, { type: 'LEARN_GUIDANCE' }); expect(s.activeEvent?.id).toBe('LIFE-BILL-01');
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY_PART' });
    const id = s.debts.at(-1)!.id; expect(s.debts.at(-1)).toMatchObject({ remaining: 30, weeklyPayment: 30, createdWeek: initial.week });
    s = step(s, { type: 'ACTION', action: 'WORK' }); s = nw(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); s = nw(s, { type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' });
    expect(s.cash).toBe(120); expect(s.debts.find(d => d.id === id)!.remaining).toBe(0); expect(validateNatureWalkerAcquisitionJournal(s)).toBe(true);
    const bad = structuredClone(s); bad.debts.find(d => d.id === id)!.remaining = 1; expect(validateNatureWalkerState(bad)).toBe(false);
  }, 30_000);
  it('allows a genuine0AP preparation exit with no refunds and the ordinary weekly bill', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 5;
    let s = nw(initial, { type: 'LEARN_GUIDANCE' }); for (const taskId of NATURE_WALKER_PREPARATION_IDS) s = nw(s, { type: 'PREPARE_TASK', taskId });
    s = nw(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = nw(s, { type: 'PREPARE_PROMOTION' }); expect(s.actionsRemaining).toBe(0);
    const n = nw(s, { type: 'LEAVE_PREPARATION' }), receipt = journal(n).at(-1)!;
    expect(receipt.before).toEqual(receipt.after); expect(n.week).toBe(s.week + 1); expect(n.cash).toBe(s.cash - 30); expect(n.random).toEqual(s.random);
    expect(n.natureWalker.bottles[0]!.status).toBe('PLAYER'); expect(n.injuries).toEqual(s.injuries); assertValidSliceState(n);
  }, 30_000);
  it('requires three genuine failures, paid request and actual next week for fresh independent bottles', () => {
    const initial = directedInitial2('THREE_FAILURES'); initial.actionsRemaining = initial.weeklyBudget = 3;
    let s = nw(initial, { type: 'LEARN_GUIDANCE' }); rejectNatureWalker(s, { type: 'REQUEST_SUPPLY' });
    for (let number = 1; number <= 3; number++) { const bottleId = `nature-walker-potion-${number}`; s = prepareBottle(s, bottleId); s = nw(s, { type: 'CONSUME', bottleId, confirmed: true }); expect(s.progression.sequence).toBe(2); }
    s = ready(s, { ap: 2, cash: 100, health: 100, mind: 100 }); const before = s.cash;
    s = nw(s, { type: 'REQUEST_SUPPLY' }); expect(s.cash).toBe(before - 100); const requested = s.natureWalker.resupply.requestedWeek!;
    rejectNatureWalker(s, { type: 'RECEIVE_SUPPLY' }); s = ready(s, { afterWeek: requested }); s = nw(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.natureWalker.bottles).toHaveLength(6); expect(s.natureWalker.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
    expect(s.natureWalker.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true); assertValidSliceState(s);
  }, 30_000);
  it('rejects tampered source receipts, random evidence and forgedS1/S0 states', () => {
    for (const mutate of [
      (s: SliceState) => { s.natureWalker.acquisitionJournal[0]!.after.cash++; },
      (s: SliceState) => { s.natureWalker.acquisitionJournal.at(-1)!.cursorAfter++; },
      (s: SliceState) => { s.natureWalker.sourceScene!.originals.rootPad.integrity = 65; },
      (s: SliceState) => { s.natureWalker.sourceHistory!.coffinBearer.life.guard.segments[0]!.status = 'UNUSED'; },
      (s: SliceState) => { s.coffinBearer.life.samples[0]!.vitality++; },
      (s: SliceState) => { s.progression.sequence = 0; },
      (s: SliceState) => { s.natureWalker.promotionWeek = null; },
    ]) { const s = promoted(); mutate(s); expect(validateNatureWalkerState(s), mutate.toString()).toBe(false); }
    const fake = originalBarrenMatriarch(); fake.progression.sequence = 1; expect(validateNatureWalkerState(fake)).toBe(false);
  }, 30_000);
});
