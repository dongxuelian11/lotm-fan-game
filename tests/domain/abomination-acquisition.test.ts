import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateAncientEvilState } from '../../src/domain/ancient-evil/index.js';
import { createAbominationState, abominationInheritedView, abominationAcquisitionBlock, abominationOriginals,
  projectAbomination, validateAbominationState, validateAbominationSource, validateAbominationAcquisitionJournal,
  ABOMINATION_INHERITED_ABILITY_IDS } from '../../src/domain/abomination/index.js';
import { ABOMINATION_ABILITY_IDS, ABOMINATION_PREPARATION_IDS } from '../../src/domain/abomination/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { originalAncientEvil, directedInitial2, taught, prepared, promoted, prepareBottle, step, ab, ready, dose,
  rejectAbomination, rejectIntent, oldChainedRoots } from './abomination-directed-helper.js';
const journal = (s: SliceState) => s.abomination.acquisitionJournal;

describe('Abomination independent bottles and authenticated original room', () => {
  it('starts with whole642, no wounds and ten of the required12 Ancient Evil weeks', () => {
    const s = originalAncientEvil(); expect(s.abomination).toEqual(createAbominationState());
    expect(s.week - s.ancientEvil.promotionWeek!).toBe(10); expect(s.week - s.progression.promotionWeek!).toBeGreaterThan(12);
    rejectAbomination(s, dose);
    expect(abominationAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const n = ab(s, { type: 'LEARN_GUIDANCE' }), first = journal(n)[0]!;
    expect([first.before.cash - first.after.cash, first.before.actions - first.after.actions]).toEqual([500, 1]);
    expect(n.health).toBe(100); expect(n.injuries).toEqual([]); expect(n.character).toEqual(s.character);
    expect(n.abomination.sourceScene!.originals.site).toEqual(s.silentDisciple.life);
    expect(n.abomination.sourceScene!.originals.site).not.toEqual(s.ancientEvil.life.source!.snapshot);
    expect(n.abomination.sourceScene!.originals.operation).toEqual(s.ancientEvil.life.operation);
    expect(n.abomination.sourceScene!.originals.blocks).toEqual(s.ancientEvil.encounter.blocks);
    expect(oldChainedRoots(n)).toEqual(oldChainedRoots(s)); assertValidSliceState(n);
  }, 120_000);
  it('each bottle uses five actual1AP jobs,1200p delivery and180p current-week preparation', () => {
    const s = prepared(), j = journal(s), work = j.filter(e => e.command.type === 'POTION_WORK');
    expect(work).toHaveLength(5); for (const e of work) expect([e.before.actions - e.after.actions, e.before.cash - e.after.cash]).toEqual([1, 0]);
    expect(j.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command.type === 'PREPARE_TASK' ? e.command.taskId : null)).toEqual([...ABOMINATION_PREPARATION_IDS]);
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, preparation = j.at(-1)!;
    expect([buy.before.cash - buy.after.cash, buy.before.actions - buy.after.actions]).toEqual([1200, 0]);
    expect([preparation.before.cash - preparation.after.cash, preparation.before.actions - preparation.after.actions]).toEqual([180, 1]);
    expect(s.week).toBeGreaterThanOrEqual(150); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(s.abomination.bottles[1]!.labourSteps).toBe(0); expect(validateAbominationAcquisitionJournal(s)).toBe(true);
    rejectAbomination(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = ab(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining]).toEqual([s.cash, s.actionsRemaining]);
    expect(left.abomination.bottles[0]!.status).toBe('PLAYER'); rejectAbomination(left, dose); assertValidSliceState(left);
  }, 240_000);
  it('keeps the complete19-entry mastery gate and strict health/mind thresholds', () => {
    const source = directedInitial2(), missing = structuredClone(source), extra = structuredClone(source);
    delete missing.progression.mastery['chained.s7.toxic-claws'];
    extra.progression.mastery['chained.s0.chained-god'] = 0;
    expect(abominationAcquisitionBlock(missing, { type: 'LEARN_GUIDANCE' })).toContain('19项');
    expect(abominationAcquisitionBlock(extra, { type: 'LEARN_GUIDANCE' })).toContain('19项');
    for (const [health, mind] of [[20, 100], [100, 40]] as const) {
      const s = prepared(); s.health = health; s.mind = mind;
      expect(abominationAcquisitionBlock(s, dose)).toContain('健康>20且精神>40');
    }
    const undigested = prepared(); undigested.progression.acting = 99;
    expect(abominationAcquisitionBlock(undigested, dose)).toContain('99/100');
    const unfinished = directedInitial2(); unfinished.ancientEvil.life.reflected = false;
    expect(abominationAcquisitionBlock(unfinished, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    expect(ABOMINATION_INHERITED_ABILITY_IDS).toHaveLength(19);
  }, 240_000);
  it('allows a genuine0AP preparation exit without refund, bottle loss or hidden recovery', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 5; // Explicit pre-journal UNIT budget.
    let s = ab(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of ABOMINATION_PREPARATION_IDS) s = ab(s, { type: 'PREPARE_TASK', taskId });
    s = ab(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    s = ab(s, { type: 'PREPARE_PROMOTION' }); expect(s.actionsRemaining).toBe(0);
    const paid = structuredClone(s), n = ab(s, { type: 'LEAVE_PREPARATION' });
    const receipt = journal(n).at(-1)!;
    expect(receipt.command.type).toBe('LEAVE_PREPARATION'); expect(receipt.before).toEqual(receipt.after);
    expect(receipt.after.actions).toBe(0); expect(receipt.after.health).toBe(paid.health);
    expect(receipt.after.spirituality).toBe(paid.spirituality); expect(n.abomination.bottles[0]!.status).toBe('PLAYER');
    expect(n.abomination.preparedWeek).toBeNull(); expect(n.week).toBe(paid.week + 1);
    expect(n.cash).toBe(paid.cash - 30); expect(n.random).toEqual(paid.random);
    assertValidSliceState(n);
  }, 240_000);
  it('partial labour never discounts another or the same uncompleted bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = ab(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const before = s.cash; s = ab(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(before - s.cash).toBe(7200);
    rejectAbomination(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const second = s.cash; s = ab(s, { type: 'BUY_POTION', bottleId: 'abomination-potion-2' }); expect(second - s.cash).toBe(7200);
    expect(s.abomination.bottles[0]!.labourSteps).toBe(4); expect(s.abomination.bottles[1]!.labourSteps).toBe(0);
  }, 120_000);
  it('counts12 weeks from actual AncientEvil promotion and freezes old practice as soon as guidance is paid', () => {
    let s = taught('SUCCESS', false);
    expect(s.week).toBe(148); expect(s.progression.sequence).toBe(2);
    rejectIntent(s, { type: 'ANCIENT_EVIL', command: { type: 'OBSERVE', caseId: 'lasting-form' } });
    rejectIntent(s, { type: 'SILENT_DISCIPLE', command: { type: 'OBSERVE', caseId: 'original-body' } });
    for (const taskId of ABOMINATION_PREPARATION_IDS) s = ab(s, { type: 'PREPARE_TASK', taskId });
    s = ab(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(abominationAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('10/12');
    rejectAbomination(s, { type: 'PREPARE_PROMOTION' }); expect(s.abomination.bottles[0]!.status).toBe('PLAYER');
    const before = structuredClone(s); expect(validateAbominationState(s)).toBe(true); expect(s).toEqual(before);
  }, 120_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('replays the actual %s dose and preserves all spent costs', kind => {
    const before = prepared(kind), s = ab(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(kind); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.cursorAfter).toBe(e.cursorBefore + 1);
    expect(s.abomination.bottles[0]!.status).toBe('CONSUMED'); expect(s.abomination.preparedWeek).toBeNull();
    expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(oldChainedRoots(s)).toEqual(oldChainedRoots(before));
    const won = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(s.progression.sequence).toBe(won ? 1 : 2); expect(s.progression.acting).toBe(won ? 0 : 100);
    expect(s.mind).toBe(before.mind - (kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45));
    expect(s.health).toBe(before.health - (won ? 0 : kind === 'FAILURE' ? 15 : 25));
    expect(s.seer.pollution).toBe(won ? before.seer.pollution : kind === 'FAILURE' ? 30 : 60);
    for (const id of ABOMINATION_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(before.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(won ? 21 : 19);
    for (const id of ABOMINATION_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(won ? 0 : undefined);
    expect(validateAbominationAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('promotes without altering19 old mastery values or old source stats used by historical validation', () => {
    const s = promoted(), source = originalAncientEvil(), view = abominationInheritedView(s), scene = s.abomination.sourceScene!;
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(6); expect(s.abomination.ancientEvilActingAtPromotion).toBe(100);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(source.character.coreStats[stat] + 1);
    expect(view.character.coreStats).toEqual(scene.character.coreStats); expect(view.progression.sequence).toBe(2); expect(view.health).toBe(100);
    expect(view.injuries).toEqual(source.injuries); expect(view.week).toBe(scene.week); expect(view.weeklyBudget).toBe(scene.finance.weeklyBudget);
    expect(validateAncientEvilState(view)).toBe(true); expect(validateAbominationSource(s)).toBe(true);
    expect(abominationOriginals(s)).toEqual(scene.originals); expect(s.abomination.life.site).toEqual(scene.originals.site);
    expect(s.abomination.life.operation).toEqual(scene.originals.operation);
    expect(s.abomination.encounter.blocks).toEqual(scene.originals.blocks);
    expect(s.abomination.life.volunteerEffortSpent).toBe(0);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
    const p = projectAbomination(s); expect(p.abilities).toHaveLength(21); expect(p.inheritedHistory.join('')).toContain('19项');
    expect(p.currentGender).toBe('FEMALE'); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
  }, 240_000);
  it('accounts for ordinary weekly billing after the last action, including adjacent next-week receipts', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = ab(initial, { type: 'LEARN_GUIDANCE' }); expect(s.week).toBe(initial.week + 1); expect(s.cash).toBe(initial.cash - 500 - 30);
    expect(s.actionsRemaining).toBe(3); expect(journal(s)[0]!.after.actions).toBe(0); assertValidSliceState(s);
    s = ab(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); expect(validateAbominationAcquisitionJournal(s)).toBe(true);
    const forged = structuredClone(s); forged.cash++; expect(validateAbominationState(forged)).toBe(false);
  }, 120_000);
  it('reconciles an actual ordinary bill debt and its next-week payment', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; initial.cash = 500; // Explicit pre-journal UNIT budget.
    let s = ab(initial, { type: 'LEARN_GUIDANCE' });
    expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.cash).toBe(0);
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY_PART' });
    expect(s.debts.at(-1)).toMatchObject({ source: '生活应付款', remaining: 30, weeklyPayment: 30, createdWeek: initial.week });
    const debtId = s.debts.at(-1)!.id;
    s = step(s, { type: 'ACTION', action: 'WORK' }); expect(s.cash).toBe(180);
    s = ab(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' });
    s = ab(s, { type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' });
    expect(s.cash).toBe(120); expect(s.debts.find(d => d.id === debtId)!.remaining).toBe(0);
    expect(validateAbominationAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
    const forged = structuredClone(s); forged.debts.find(d => d.id === debtId)!.remaining = 1;
    expect(validateAbominationState(forged)).toBe(false);
  }, 240_000);
  it('promotion never fills current spirituality or changes old wounds or identity', () => {
    const initial = directedInitial2(); initial.spirituality = 80; // Explicit pre-journal UNIT current resource.
    let s = ab(initial, { type: 'LEARN_GUIDANCE' }); const source = structuredClone(s);
    for (const taskId of ABOMINATION_PREPARATION_IDS) s = ab(s, { type: 'PREPARE_TASK', taskId });
    s = ab(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ab(s, { type: 'PREPARE_PROMOTION' });
    s = ab(s, dose); expect(s.progression.sequence).toBe(1);
    expect(s.health).toBe(100); expect(s.spirituality).toBe(80); expect(s.injuries).toEqual(source.injuries);
    expect(s.injuryRisk).toBe(0); expect(s.character.gender).toBe('FEMALE'); expect(oldChainedRoots(s)).toEqual(oldChainedRoots(source));
    assertValidSliceState(s);
  }, 240_000);
  it('funds and prepares a bottle from actual642 without changing source resources, seed or old roots', () => {
    const source = originalAncientEvil(), commands: SliceIntent[] = [], s = prepareBottle(source, dose.bottleId, commands);
    expect(s.random).toEqual(source.random); expect(s.week).toBeGreaterThanOrEqual(150); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'WORK')).toBe(true);
    expect(source.careKnown).toBe(true); // Existing access stays known; no new clinic is required.
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toBe(false);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && (c.choiceId === 'PAY' || c.choiceId === 'CREDIT'))).toBe(false);
    expect(oldChainedRoots(s)).toEqual(oldChainedRoots(source)); expect(source.cash).toBe(730); expect(source.health).toBe(100); assertValidSliceState(s);
  }, 240_000);
  it('requires all three real failures and a real following week to recover the same original', () => {
    const initial = directedInitial2('THREE_FAILURES'); initial.actionsRemaining = initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = ab(initial, { type: 'LEARN_GUIDANCE' }); rejectAbomination(s, { type: 'REQUEST_SUPPLY' });
    for (let number = 1; number <= 3; number++) {
      const bottleId = `abomination-potion-${number}`; s = prepareBottle(s, bottleId); s = ab(s, { type: 'CONSUME', bottleId, confirmed: true });
      expect(s.progression.sequence).toBe(2);
    }
    s = ready(s, { ap: 2, cash: 150, health: 100, mind: 100 });
    const before = s.cash; s = ab(s, { type: 'REQUEST_RECOVERY_V1', bottleId: 'abomination-potion-1' }); expect(s.cash).toBe(before - 120);
    const requested = s.abomination.resupply.requestedWeek!; rejectAbomination(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'abomination-potion-1' });
    s = ready(s, { ap: 2, cash: 30, afterWeek: requested }); s = ab(s, { type: 'RECOVER_CHARACTERISTIC_V1', bottleId: 'abomination-potion-1' });
    expect(s.abomination.bottles).toHaveLength(4); expect(s.abomination.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
    expect(s.abomination.bottles[3]).toMatchObject({ id: 'abomination-recovery-1', status: 'SUPPLIER', labourSteps: 0, acquiredWeek: null,
      recovery: { sourceBottleId: 'abomination-potion-1', originalBottleId: 'abomination-potion-1', characteristicId: 'AB225-CHAR-1' } });
    expect(validateAbominationState(s)).toBe(true);
  }, 240_000);
  it('closes old actions and rejectsS0, wrong path and invented promotion state', () => {
    const s = promoted(); rejectIntent(s, { type: 'ANCIENT_EVIL', command: { type: 'LEARN_GUIDANCE' } });
    rejectIntent(s, { type: 'ANCIENT_EVIL', command: { type: 'PREPARE_ENCOUNTER' } }); rejectAbomination(s, dose);
    const zero = structuredClone(s); zero.progression.sequence = 0; expect(validateAbominationState(zero)).toBe(false);
    const other = structuredClone(s); other.progression.pathwayId = 'sun'; expect(validateAbominationState(other)).toBe(false);
    const fake = originalAncientEvil(); fake.progression.sequence = 1; expect(validateAbominationState(fake)).toBe(false);
  }, 240_000);
});

describe('Abomination source, dose and budget tamper rejection', () => {
  const changes: [string, (s: SliceState) => void][] = [
    ['old spent block replenished', s => { s.ancientEvil.encounter.blocks[0]!.status = 'READY'; }],
    ['old room travel rewrite', s => { s.silentDisciple.life.playerTravelMetres++; }],
    ['old dead body resurrected', s => { s.ancientEvil.encounter.enemyHealth = 100; }],
    ['old mastery gift', s => { s.progression.mastery['chained.s7.toxic-claws'] = 1; }],
    ['new mastery gift', s => { s.progression.mastery[ABOMINATION_ABILITY_IDS[0]] = 1; }],
    ['source stats changed to current boost', s => { s.abomination.sourceScene!.character.coreStats = { ...s.character.coreStats }; }],
    ['source finance minted', s => { s.abomination.sourceScene!.finance.weeklyBudget++; }],
    ['source changed to historical scene', s => { s.abomination.sourceScene!.originals.site = structuredClone(s.ancientEvil.life.source!.snapshot); }],
    ['old original note erased', s => { s.silentDisciple.life.note.records = []; }],
    ['old surrendered body restored', s => { s.silentDisciple.encounter.enemyHealth = 100; }],
    ['dose check changed', s => { journal(s).at(-1)!.check!.roll++; }],
    ['paid preparation refunded', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.cash++; }],
    ['free labour', s => { journal(s).find(e => e.command.type === 'POTION_WORK')!.after.actions++; }],
    ['current cash minted', s => { s.cash++; }],
    ['identity changed', s => { s.character.gender = 'MALE'; }],
  ];
  it.each(changes)('rejects %s without mutating the reviewed state', (_name, change) => {
    const s = promoted(); change(s); const before = structuredClone(s);
    expect(validateAbominationState(s)).toBe(false); expect(s).toEqual(before);
  }, 240_000);
});
