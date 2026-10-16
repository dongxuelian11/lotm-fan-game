import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateFateProphetState } from '../../src/domain/fate-prophet/index.js';
import { createMercurySnakeState, mercurySnakeInheritedView, mercurySnakeAcquisitionBlock, mercurySnakeOriginals,
  projectMercurySnake, validateMercurySnakeState, validateMercurySnakeSource, validateMercurySnakeAcquisitionJournal,
  MERCURY_SNAKE_INHERITED_ABILITY_IDS } from '../../src/domain/mercury-snake/index.js';
import { MERCURY_SNAKE_ABILITY_IDS, MERCURY_SNAKE_PREPARATION_IDS } from '../../src/domain/mercury-snake/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { originalFateProphet, directedInitial2, taught, prepared, promoted, prepareBottle, step, ms, ready, dose,
  rejectMercurySnake, rejectIntent, oldWheelRoots } from './mercury-snake-directed-helper.js';
const journal = (s: SliceState) => s.mercurySnake.acquisitionJournal;
const originalLuck = { stored: 0, lastAccumulateWeek: 176, accumulated: 14, spent: 14 };

describe('Mercury Snake independent bottles and original workshop', () => {
  it('starts from whole703 with original LIGHT injury, zero stored luck and11/12 S2 weeks', () => {
    const s = originalFateProphet(); expect(s.mercurySnake).toEqual(createMercurySnakeState());
    expect(s.week - s.fateProphet.promotionWeek!).toBe(11); expect(s.week - s.progression.promotionWeek!).toBeGreaterThan(12);
    rejectMercurySnake(s, dose); expect(mercurySnakeAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const n = ms(s, { type: 'LEARN_GUIDANCE' }), first = journal(n)[0]!;
    expect([first.before.cash - first.after.cash, first.before.actions - first.after.actions]).toEqual([500, 1]);
    expect(n.health).toBe(90); expect(n.injuries).toEqual(s.injuries); expect(n.character).toEqual(s.character);
    expect(n.mercurySnake.sourceScene!.originals.site).toEqual(s.chaosWalker.life);
    expect(n.mercurySnake.sourceScene!.originals.site).not.toEqual(s.fateProphet.life.source!.snapshot);
    expect(n.mercurySnake.sourceScene!.originals.operation).toEqual(s.fateProphet.life.operation);
    expect(n.mercurySnake.sourceScene!.originals.luck).toEqual(originalLuck); expect(n.mercurySnake.luck).toEqual(originalLuck);
    expect(first.before.luck).toEqual(first.after.luck); expect(first.after.luck).toEqual(originalLuck);
    expect(oldWheelRoots(n)).toEqual(oldWheelRoots(s)); assertValidSliceState(n);
  }, 120_000);
  it('charges five actual1AP jobs,1200p delivery and180p current-week preparation for one bottle', () => {
    const s = prepared(), j = journal(s), work = j.filter(e => e.command.type === 'POTION_WORK');
    expect(work).toHaveLength(5); for (const e of work) expect([e.before.actions - e.after.actions, e.before.cash - e.after.cash]).toEqual([1, 0]);
    expect(j.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command.type === 'PREPARE_TASK' ? e.command.taskId : null)).toEqual([...MERCURY_SNAKE_PREPARATION_IDS]);
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, preparation = j.at(-1)!;
    expect([buy.before.cash - buy.after.cash, buy.before.actions - buy.after.actions]).toEqual([1200, 0]);
    expect([preparation.before.cash - preparation.after.cash, preparation.before.actions - preparation.after.actions]).toEqual([180, 1]);
    expect(s.week).toBeGreaterThanOrEqual(178); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(s.mercurySnake.bottles[1]!.labourSteps).toBe(0); expect(validateMercurySnakeAcquisitionJournal(s)).toBe(true);
    for (const event of j) expect(event.before.luck).toEqual(event.after.luck);
    rejectMercurySnake(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = ms(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining]).toEqual([s.cash, s.actionsRemaining]);
    expect(left.mercurySnake.bottles[0]!.status).toBe('PLAYER'); rejectMercurySnake(left, dose); assertValidSliceState(left);
  }, 240_000);
  it('requires all17 inherited entries including the six zeros and strict health/mind thresholds', () => {
    const source = directedInitial2(), missing = structuredClone(source), extra = structuredClone(source);
    delete missing.progression.mastery['wheel.s2.hazard-adjustment']; extra.progression.mastery['wheel.s0.fate-opportunity'] = 0;
    expect(mercurySnakeAcquisitionBlock(missing, { type: 'LEARN_GUIDANCE' })).toContain('17项');
    expect(mercurySnakeAcquisitionBlock(extra, { type: 'LEARN_GUIDANCE' })).toContain('17项');
    for (const [health, mind] of [[20, 100], [100, 40]] as const) {
      const s = prepared(); s.health = health; s.mind = mind; expect(mercurySnakeAcquisitionBlock(s, dose)).toContain('健康>20且精神>40');
    }
    const undigested = prepared(); undigested.progression.acting = 99; expect(mercurySnakeAcquisitionBlock(undigested, dose)).toContain('99/100');
    const unfinished = directedInitial2(); unfinished.fateProphet.life.reflected = false;
    expect(mercurySnakeAcquisitionBlock(unfinished, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    expect(MERCURY_SNAKE_INHERITED_ABILITY_IDS).toHaveLength(17);
  }, 240_000);
  it('allows genuine0AP preparation exit while retaining paid costs and ordinary weekly billing', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 5; // Explicit pre-journal UNIT budget.
    let s = ms(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of MERCURY_SNAKE_PREPARATION_IDS) s = ms(s, { type: 'PREPARE_TASK', taskId });
    s = ms(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ms(s, { type: 'PREPARE_PROMOTION' }); expect(s.actionsRemaining).toBe(0);
    const paid = structuredClone(s), n = ms(s, { type: 'LEAVE_PREPARATION' }), receipt = journal(n).at(-1)!;
    expect(receipt.before).toEqual(receipt.after); expect(receipt.after.actions).toBe(0);
    expect(receipt.after.health).toBe(paid.health); expect(receipt.after.spirituality).toBe(paid.spirituality);
    expect(n.mercurySnake.bottles[0]!.status).toBe('PLAYER'); expect(n.mercurySnake.preparedWeek).toBeNull();
    expect(n.week).toBe(paid.week + 1); expect(n.cash).toBe(paid.cash - 30); expect(n.random).toEqual(paid.random);
    expect(n.mercurySnake.luck).toEqual(originalLuck); expect(n.injuries).toEqual(paid.injuries); assertValidSliceState(n);
  }, 240_000);
  it('never grants a discount for partial labour on this or another bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = ms(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const before = s.cash; s = ms(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(before - s.cash).toBe(7200);
    rejectMercurySnake(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const second = s.cash; s = ms(s, { type: 'BUY_POTION', bottleId: 'mercury-snake-potion-2' }); expect(second - s.cash).toBe(7200);
    expect(s.mercurySnake.bottles[0]!.labourSteps).toBe(4); expect(s.mercurySnake.bottles[1]!.labourSteps).toBe(0);
  }, 120_000);
  it('drinks the independently confirmed original at real0AP and settles only the ordinary bill', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 5; // Explicit pre-journal UNIT budget.
    let s = ms(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of MERCURY_SNAKE_PREPARATION_IDS) s = ms(s, { type: 'PREPARE_TASK', taskId });
    s = ms(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ms(s, { type: 'PREPARE_PROMOTION' });
    expect(s.actionsRemaining).toBe(0); const before = structuredClone(s); s = ms(s, dose);
    const event = journal(s).at(-1)!; expect([event.before.actions, event.after.actions]).toEqual([0, 0]);
    expect(event.after.cash).toBe(event.before.cash); expect(event.after.luck).toEqual(event.before.luck);
    expect(s.progression.sequence).toBe(1); expect(s.week).toBe(before.week + 1); expect(s.cash).toBe(before.cash - 30);
    expect(s.injuries).toEqual(before.injuries); expect(s.spirituality).toBe(before.spirituality); assertValidSliceState(s);
  }, 120_000);
  it('counts12 real weeks from S2 promotion and freezes old commands after paid guidance', () => {
    let s = taught('SUCCESS', false); expect(s.week).toBe(177); expect(s.progression.sequence).toBe(2);
    rejectIntent(s, { type: 'FATE_PROPHET', command: { type: 'ACCUMULATE' } });
    rejectIntent(s, { type: 'CHAOS_WALKER', command: { type: 'OBSERVE', caseId: 'cart-fork' } });
    for (const taskId of MERCURY_SNAKE_PREPARATION_IDS) s = ms(s, { type: 'PREPARE_TASK', taskId });
    s = ms(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(mercurySnakeAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('11/12');
    rejectMercurySnake(s, { type: 'PREPARE_PROMOTION' }); expect(s.mercurySnake.bottles[0]!.status).toBe('PLAYER');
    const before = structuredClone(s); expect(validateMercurySnakeState(s)).toBe(true); expect(s).toEqual(before);
  }, 120_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('replays %s with one actual draw and unchanged luck ledger', kind => {
    const before = prepared(kind), s = ms(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(kind); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.cursorAfter).toBe(e.cursorBefore + 1);
    expect(s.mercurySnake.bottles[0]!.status).toBe('CONSUMED'); expect(s.mercurySnake.preparedWeek).toBeNull();
    expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(oldWheelRoots(s)).toEqual(oldWheelRoots(before));
    expect(s.mercurySnake.luck).toEqual(originalLuck); expect(e.before.luck).toEqual(e.after.luck);
    const won = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(s.progression.sequence).toBe(won ? 1 : 2); expect(s.progression.acting).toBe(won ? 0 : 100);
    expect(s.mind).toBe(before.mind - (kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45));
    expect(s.health).toBe(before.health - (won ? 0 : kind === 'FAILURE' ? 15 : 25));
    expect(s.seer.pollution).toBe(won ? before.seer.pollution : kind === 'FAILURE' ? 30 : 60);
    for (const id of MERCURY_SNAKE_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(before.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(won ? 19 : 17);
    for (const id of MERCURY_SNAKE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(won ? 0 : undefined);
    expect(validateMercurySnakeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('keeps17 old mastery values and six old zeros while initializing both new skills at0', () => {
    const s = promoted(), source = originalFateProphet(), view = mercurySnakeInheritedView(s), scene = s.mercurySnake.sourceScene!;
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(8); expect(s.mercurySnake.fateProphetActingAtPromotion).toBe(100);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(source.character.coreStats[stat] + 1);
    expect(view.character.coreStats).toEqual(scene.character.coreStats); expect(view.progression.sequence).toBe(2); expect(view.health).toBe(scene.budget.health);
    expect(view.injuries).toEqual(scene.budget.injuries); expect(view.week).toBe(scene.week); expect(view.weeklyBudget).toBe(scene.finance.weeklyBudget);
    expect(validateFateProphetState(view)).toBe(true); expect(validateMercurySnakeSource(s)).toBe(true);
    expect(mercurySnakeOriginals(s)).toEqual(scene.originals); expect(s.mercurySnake.life.site).toEqual(scene.originals.site);
    expect(s.mercurySnake.life.operation).toEqual(scene.originals.operation); expect(s.mercurySnake.luck).toEqual(scene.originals.luck);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
    const p = projectMercurySnake(s); expect(p.abilities).toHaveLength(19); expect(p.inheritedHistory.join('')).toContain('17项');
    expect(p.currentGender).toBe('FEMALE'); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]); expect(p.luck).toEqual({ ...originalLuck, capacity: 3 });
  }, 240_000);
  it('reconciles actual weekly bills between adjacent acquisition receipts', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = ms(initial, { type: 'LEARN_GUIDANCE' }); expect(s.week).toBe(initial.week + 1); expect(s.cash).toBe(initial.cash - 500 - 30);
    expect(s.actionsRemaining).toBe(3); expect(journal(s)[0]!.after.actions).toBe(0); assertValidSliceState(s);
    s = ms(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); expect(validateMercurySnakeAcquisitionJournal(s)).toBe(true);
    const forged = structuredClone(s); forged.cash++; expect(validateMercurySnakeState(forged)).toBe(false);
  }, 120_000);
  it('reconciles an ordinary bill debt and its next-week real payment', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; initial.cash = 500; // Explicit pre-journal UNIT budget.
    let s = ms(initial, { type: 'LEARN_GUIDANCE' }); expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.cash).toBe(0);
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY_PART' });
    expect(s.debts.at(-1)).toMatchObject({ source: '生活应付款', remaining: 30, weeklyPayment: 30, createdWeek: initial.week });
    const debtId = s.debts.at(-1)!.id; s = step(s, { type: 'ACTION', action: 'WORK' }); expect(s.cash).toBe(180);
    s = ms(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); s = ms(s, { type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' });
    expect(s.cash).toBe(120); expect(s.debts.find(d => d.id === debtId)!.remaining).toBe(0);
    expect(validateMercurySnakeAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
    const forged = structuredClone(s); forged.debts.find(d => d.id === debtId)!.remaining = 1; expect(validateMercurySnakeState(forged)).toBe(false);
  }, 240_000);
  it('never fills current spirituality, heals old wounds or changes identity on promotion', () => {
    const initial = directedInitial2(); initial.spirituality = 80; // Explicit pre-journal UNIT current resource.
    let s = ms(initial, { type: 'LEARN_GUIDANCE' }); const source = structuredClone(s);
    for (const taskId of MERCURY_SNAKE_PREPARATION_IDS) s = ms(s, { type: 'PREPARE_TASK', taskId });
    s = ms(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ms(s, { type: 'PREPARE_PROMOTION' }); s = ms(s, dose);
    expect(s.progression.sequence).toBe(1); expect(s.health).toBe(90); expect(s.spirituality).toBe(80); expect(s.injuries).toEqual(source.injuries);
    expect(s.injuryRisk).toBe(0); expect(s.character.gender).toBe('FEMALE'); expect(oldWheelRoots(s)).toEqual(oldWheelRoots(source));
    expect(s.mercurySnake.luck).toEqual(originalLuck); assertValidSliceState(s);
  }, 240_000);
  it('prepares from actual703 through normal work/rest without compulsory paid clinic or random edits', () => {
    const source = originalFateProphet(), commands: SliceIntent[] = [], s = prepareBottle(source, dose.bottleId, commands);
    expect(s.random).toEqual(source.random); expect(s.week).toBeGreaterThanOrEqual(178); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'WORK')).toBe(true);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'REST')).toBe(true);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toBe(false);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && (c.choiceId === 'PAY' || c.choiceId === 'CREDIT'))).toBe(false);
    expect(oldWheelRoots(s)).toEqual(oldWheelRoots(source)); expect(source.cash).toBe(1060); expect(source.health).toBe(90);
    expect(s.mercurySnake.luck).toEqual(originalLuck); assertValidSliceState(s);
  }, 240_000);
  it('requires three independent actual failures and the next real week for resupply', () => {
    const initial = directedInitial2('THREE_FAILURES'); initial.actionsRemaining = initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = ms(initial, { type: 'LEARN_GUIDANCE' }); rejectMercurySnake(s, { type: 'REQUEST_SUPPLY' });
    for (let number = 1; number <= 3; number++) {
      const bottleId = `mercury-snake-potion-${number}`; s = prepareBottle(s, bottleId); s = ms(s, { type: 'CONSUME', bottleId, confirmed: true }); expect(s.progression.sequence).toBe(2);
    }
    s = ready(s, { ap: 2, cash: 100, health: 100, mind: 100 });
    const before = s.cash; s = ms(s, { type: 'REQUEST_SUPPLY' }); expect(s.cash).toBe(before - 100);
    const requested = s.mercurySnake.resupply.requestedWeek!; rejectMercurySnake(s, { type: 'RECEIVE_SUPPLY' });
    s = ready(s, { afterWeek: requested }); s = ms(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.mercurySnake.bottles).toHaveLength(6); expect(s.mercurySnake.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
    expect(s.mercurySnake.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true);
    expect(s.mercurySnake.bottles.slice(3).map(b => b.id)).toEqual(['mercury-snake-potion-4', 'mercury-snake-potion-5', 'mercury-snake-potion-6']);
    expect(s.mercurySnake.luck).toEqual(originalLuck); expect(validateMercurySnakeState(s)).toBe(true);
  }, 240_000);
  it('rejects old commands, S0, wrong pathway and fabricated promotion', () => {
    const s = promoted(); rejectIntent(s, { type: 'FATE_PROPHET', command: { type: 'LEARN_GUIDANCE' } });
    rejectIntent(s, { type: 'FATE_PROPHET', command: { type: 'PREPARE_ENCOUNTER' } }); rejectMercurySnake(s, dose);
    const zero = structuredClone(s); zero.progression.sequence = 0; expect(validateMercurySnakeState(zero)).toBe(false);
    const other = structuredClone(s); other.progression.pathwayId = 'sun'; expect(validateMercurySnakeState(other)).toBe(false);
    const fake = originalFateProphet(); fake.progression.sequence = 1; expect(validateMercurySnakeState(fake)).toBe(false);
  }, 240_000);
});

describe('Mercury Snake source, dose, mastery and luck tamper rejection', () => {
  const changes: [string, (s: SliceState) => void][] = [
    ['old room travel rewrite', s => { s.chaosWalker.life.playerTravelMetres++; }],
    ['old clock rewind', s => { s.chaosWalker.life.clockSeconds = 0; }],
    ['old surrendered health restored', s => { s.fateProphet.encounter.enemyHealth = 100; }],
    ['old surrendered wounds erased', s => { s.fateProphet.encounter.enemyInjuries = []; }],
    ['old zero mastery gift', s => { s.progression.mastery['wheel.s2.hazard-adjustment'] = 1; }],
    ['new mastery gift', s => { s.progression.mastery[MERCURY_SNAKE_ABILITY_IDS[0]] = 1; }],
    ['source stats changed to current boost', s => { s.mercurySnake.sourceScene!.character.coreStats = { ...s.character.coreStats }; }],
    ['source finance minted', s => { s.mercurySnake.sourceScene!.finance.weeklyBudget++; }],
    ['source replaced by stale S2 snapshot', s => { s.mercurySnake.sourceScene!.originals.site = structuredClone(s.fateProphet.life.source!.snapshot); }],
    ['original released counter erased', s => { s.chaosWalker.life.cart.releases = 0; }],
    ['old luck ledger refill', s => { s.winner.luck.stored++; s.winner.luck.accumulated++; }],
    ['new luck ledger refill', s => { s.mercurySnake.luck.stored++; s.mercurySnake.luck.accumulated++; }],
    ['new luck spend reset', s => { s.mercurySnake.luck.spent = 0; s.mercurySnake.luck.accumulated = 0; }],
    ['source luck replaced', s => { s.mercurySnake.sourceScene!.originals.luck.lastAccumulateWeek = null; }],
    ['dose check changed', s => { journal(s).at(-1)!.check!.roll++; }],
    ['paid preparation refunded', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.cash++; }],
    ['free labour', s => { journal(s).find(e => e.command.type === 'POTION_WORK')!.after.actions++; }],
    ['dose secretly refills luck', s => { journal(s).at(-1)!.after.luck.stored++; journal(s).at(-1)!.after.luck.accumulated++; }],
    ['current cash minted', s => { s.cash++; }],
    ['identity changed', s => { s.character.gender = 'MALE'; }],
  ];
  it.each(changes)('rejects %s without mutating the reviewed state', (_name, change) => {
    const s = promoted(); change(s); const before = structuredClone(s);
    expect(validateMercurySnakeState(s)).toBe(false); expect(s).toEqual(before);
  }, 240_000);
});
