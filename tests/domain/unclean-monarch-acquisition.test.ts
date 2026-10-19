import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateBloodDukeState } from '../../src/domain/blood-duke/index.js';
import { createUncleanMonarchState, uncleanMonarchInheritedView, uncleanMonarchAcquisitionBlock, uncleanMonarchOriginals,
  projectUncleanMonarch, validateUncleanMonarchState, validateUncleanMonarchSource, validateUncleanMonarchAcquisitionJournal,
  UNCLEAN_MONARCH_INHERITED_ABILITY_IDS } from '../../src/domain/unclean-monarch/index.js';
import { UNCLEAN_MONARCH_ABILITY_IDS, UNCLEAN_MONARCH_PREPARATION_IDS } from '../../src/domain/unclean-monarch/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { originalBloodDuke, directedInitial2, taught, prepared, promoted, prepareBottle, step, um, ready, dose,
  rejectUncleanMonarch, rejectIntent, oldAbyssRoots } from './unclean-monarch-directed-helper.js';
const journal = (s: SliceState) => s.uncleanMonarch.acquisitionJournal;

describe('Unclean Monarch independent bottles and authenticated original room', () => {
  it('starts with living718, no wounds and nine of the required12 Blood Duke weeks', () => {
    const s = originalBloodDuke(); expect(s.uncleanMonarch).toEqual(createUncleanMonarchState());
    expect(s.week - s.bloodDuke.promotionWeek!).toBe(9); expect(s.week - s.progression.promotionWeek!).toBeGreaterThan(12);
    rejectUncleanMonarch(s, dose);
    expect(uncleanMonarchAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const n = um(s, { type: 'LEARN_GUIDANCE' }), first = journal(n)[0]!;
    expect([first.before.cash - first.after.cash, first.before.actions - first.after.actions]).toEqual([500, 1]);
    expect(n.health).toBe(100); expect(n.injuries).toEqual([]); expect(n.character).toEqual(s.character);
    expect(n.uncleanMonarch.sourceScene!.originals.site).toEqual(s.blatherer.life);
    expect(n.uncleanMonarch.sourceScene!.originals.site).not.toEqual(s.bloodDuke.life.source!.snapshot);
    expect(n.uncleanMonarch.sourceScene!.originals.operation).toEqual(s.bloodDuke.life.operation);
    expect(n.uncleanMonarch.sourceScene!.originals.strain).toBe(3);
    expect(oldAbyssRoots(n)).toEqual(oldAbyssRoots(s)); assertValidSliceState(n);
  }, 120_000);
  it('each bottle uses five actual1AP jobs,1200p delivery and180p current-week preparation', () => {
    const s = prepared(), j = journal(s), work = j.filter(e => e.command.type === 'POTION_WORK');
    expect(work).toHaveLength(5); for (const e of work) expect([e.before.actions - e.after.actions, e.before.cash - e.after.cash]).toEqual([1, 0]);
    expect(j.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command.type === 'PREPARE_TASK' ? e.command.taskId : null)).toEqual([...UNCLEAN_MONARCH_PREPARATION_IDS]);
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, preparation = j.at(-1)!;
    expect([buy.before.cash - buy.after.cash, buy.before.actions - buy.after.actions]).toEqual([1200, 0]);
    expect([preparation.before.cash - preparation.after.cash, preparation.before.actions - preparation.after.actions]).toEqual([180, 1]);
    expect(s.week).toBeGreaterThanOrEqual(184); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(s.uncleanMonarch.bottles[1]!.labourSteps).toBe(0); expect(validateUncleanMonarchAcquisitionJournal(s)).toBe(true);
    rejectUncleanMonarch(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = um(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining]).toEqual([s.cash, s.actionsRemaining]);
    expect(left.uncleanMonarch.bottles[0]!.status).toBe('PLAYER'); rejectUncleanMonarch(left, dose); assertValidSliceState(left);
  }, 240_000);
  it('keeps the complete16-entry mastery gate and strict health/mind thresholds', () => {
    const source = directedInitial2(), missing = structuredClone(source), extra = structuredClone(source);
    delete missing.progression.mastery['abyss.s7.demonic-lore'];
    extra.progression.mastery['abyss.s0.abyss'] = 0;
    expect(uncleanMonarchAcquisitionBlock(missing, { type: 'LEARN_GUIDANCE' })).toContain('16项');
    expect(uncleanMonarchAcquisitionBlock(extra, { type: 'LEARN_GUIDANCE' })).toContain('16项');
    for (const [health, mind] of [[20, 100], [100, 40]] as const) {
      const s = prepared(); s.health = health; s.mind = mind;
      expect(uncleanMonarchAcquisitionBlock(s, dose)).toContain('健康>20且精神>40');
    }
    const undigested = prepared(); undigested.progression.acting = 99;
    expect(uncleanMonarchAcquisitionBlock(undigested, dose)).toContain('99/100');
    const unfinished = directedInitial2(); unfinished.bloodDuke.life.reflected = false;
    expect(uncleanMonarchAcquisitionBlock(unfinished, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    expect(UNCLEAN_MONARCH_INHERITED_ABILITY_IDS).toHaveLength(16);
  }, 240_000);
  it('partial labour never discounts another or the same uncompleted bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = um(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const before = s.cash; s = um(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(before - s.cash).toBe(7200);
    rejectUncleanMonarch(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const second = s.cash; s = um(s, { type: 'BUY_POTION', bottleId: 'unclean-monarch-potion-2' }); expect(second - s.cash).toBe(7200);
    expect(s.uncleanMonarch.bottles[0]!.labourSteps).toBe(4); expect(s.uncleanMonarch.bottles[1]!.labourSteps).toBe(0);
  }, 120_000);
  it('counts12 weeks from actual BloodDuke promotion and freezes old practice as soon as guidance is paid', () => {
    let s = taught('SUCCESS', false);
    expect(s.week).toBe(181); expect(s.progression.sequence).toBe(2);
    rejectIntent(s, { type: 'BLOOD_DUKE', command: { type: 'OBSERVE', caseId: 'door-restraint' } });
    rejectIntent(s, { type: 'BLATHERER', command: { type: 'OBSERVE', caseId: 'conflicting-bell' } });
    for (const taskId of UNCLEAN_MONARCH_PREPARATION_IDS) s = um(s, { type: 'PREPARE_TASK', taskId });
    s = um(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(uncleanMonarchAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('9/12');
    rejectUncleanMonarch(s, { type: 'PREPARE_PROMOTION' }); expect(s.uncleanMonarch.bottles[0]!.status).toBe('PLAYER');
    const before = structuredClone(s); expect(validateUncleanMonarchState(s)).toBe(true); expect(s).toEqual(before);
  }, 120_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('replays the actual %s dose and preserves all spent costs', kind => {
    const before = prepared(kind), s = um(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(kind); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.cursorAfter).toBe(e.cursorBefore + 1);
    expect(s.uncleanMonarch.bottles[0]!.status).toBe('CONSUMED'); expect(s.uncleanMonarch.preparedWeek).toBeNull();
    expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(before));
    const won = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(s.progression.sequence).toBe(won ? 1 : 2); expect(s.progression.acting).toBe(won ? 0 : 100);
    expect(s.mind).toBe(before.mind - (kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45));
    expect(s.health).toBe(before.health - (won ? 0 : kind === 'FAILURE' ? 15 : 25));
    expect(s.seer.pollution).toBe(won ? before.seer.pollution : kind === 'FAILURE' ? 30 : 60);
    for (const id of UNCLEAN_MONARCH_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(before.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(won ? 18 : 16);
    for (const id of UNCLEAN_MONARCH_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(won ? 0 : undefined);
    expect(validateUncleanMonarchAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('promotes without altering16 old mastery values or old source stats used by historical validation', () => {
    const s = promoted(), source = originalBloodDuke(), view = uncleanMonarchInheritedView(s), scene = s.uncleanMonarch.sourceScene!;
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(6); expect(s.uncleanMonarch.bloodDukeActingAtPromotion).toBe(100);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(source.character.coreStats[stat] + 1);
    expect(view.character.coreStats).toEqual(scene.character.coreStats); expect(view.progression.sequence).toBe(2); expect(view.health).toBe(100);
    expect(view.injuries).toEqual(source.injuries); expect(view.week).toBe(scene.week); expect(view.weeklyBudget).toBe(scene.finance.weeklyBudget);
    expect(validateBloodDukeState(view)).toBe(true); expect(validateUncleanMonarchSource(s)).toBe(true);
    expect(uncleanMonarchOriginals(s)).toEqual(scene.originals); expect(s.uncleanMonarch.life.site).toEqual(scene.originals.site);
    expect(s.uncleanMonarch.life.operation).toEqual(scene.originals.operation);
    expect(s.uncleanMonarch.encounter.strain).toBe(scene.originals.strain);
    expect(s.uncleanMonarch.life.volunteerEffortSpent).toBe(0);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
    const p = projectUncleanMonarch(s); expect(p.abilities).toHaveLength(18); expect(p.inheritedHistory.join('')).toContain('16项');
    expect(p.currentGender).toBe('FEMALE'); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
  }, 240_000);
  it('accounts for ordinary weekly billing after the last action, including adjacent next-week receipts', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = um(initial, { type: 'LEARN_GUIDANCE' }); expect(s.week).toBe(initial.week + 1); expect(s.cash).toBe(initial.cash - 500 - 30);
    expect(s.actionsRemaining).toBe(3); expect(journal(s)[0]!.after.actions).toBe(0); assertValidSliceState(s);
    s = um(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); expect(validateUncleanMonarchAcquisitionJournal(s)).toBe(true);
    const forged = structuredClone(s); forged.cash++; expect(validateUncleanMonarchState(forged)).toBe(false);
  }, 120_000);
  it('reconciles an actual ordinary bill debt and its next-week payment', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; initial.cash = 500; // Explicit pre-journal UNIT budget.
    let s = um(initial, { type: 'LEARN_GUIDANCE' });
    expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.cash).toBe(0);
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY_PART' });
    expect(s.debts.at(-1)).toMatchObject({ source: '生活应付款', remaining: 30, weeklyPayment: 30, createdWeek: initial.week });
    const debtId = s.debts.at(-1)!.id;
    s = step(s, { type: 'ACTION', action: 'WORK' }); expect(s.cash).toBe(180);
    s = um(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' });
    s = um(s, { type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' });
    expect(s.cash).toBe(120); expect(s.debts.find(d => d.id === debtId)!.remaining).toBe(0);
    expect(validateUncleanMonarchAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
    const forged = structuredClone(s); forged.debts.find(d => d.id === debtId)!.remaining = 1;
    expect(validateUncleanMonarchState(forged)).toBe(false);
  }, 240_000);
  it('promotion never fills current spirituality or changes old wounds or identity', () => {
    const initial = directedInitial2(); initial.spirituality = 80; // Explicit pre-journal UNIT current resource.
    let s = um(initial, { type: 'LEARN_GUIDANCE' }); const source = structuredClone(s);
    for (const taskId of UNCLEAN_MONARCH_PREPARATION_IDS) s = um(s, { type: 'PREPARE_TASK', taskId });
    s = um(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = um(s, { type: 'PREPARE_PROMOTION' });
    s = um(s, dose); expect(s.progression.sequence).toBe(1);
    expect(s.health).toBe(100); expect(s.spirituality).toBe(80); expect(s.injuries).toEqual(source.injuries);
    expect(s.injuryRisk).toBe(0); expect(s.character.gender).toBe('FEMALE'); expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(source));
    assertValidSliceState(s);
  }, 240_000);
  it('funds and prepares a bottle from actual718 without changing source resources, seed or old roots', () => {
    const source = originalBloodDuke(), commands: SliceIntent[] = [], s = prepareBottle(source, dose.bottleId, commands);
    expect(s.random).toEqual(source.random); expect(s.week).toBeGreaterThanOrEqual(184); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'WORK')).toBe(true);
    expect(source.careKnown).toBe(false);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toBe(false);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && (c.choiceId === 'PAY' || c.choiceId === 'CREDIT'))).toBe(false);
    expect(oldAbyssRoots(s)).toEqual(oldAbyssRoots(source)); expect(source.cash).toBe(710); expect(source.health).toBe(100); assertValidSliceState(s);
  }, 240_000);
  it('preserves all three real failures and rejects new independent fourth-to-sixth supply', () => {
    const initial = directedInitial2('THREE_FAILURES'); initial.actionsRemaining = initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = um(initial, { type: 'LEARN_GUIDANCE' }); rejectUncleanMonarch(s, { type: 'REQUEST_SUPPLY' });
    for (let number = 1; number <= 3; number++) {
      const bottleId = `unclean-monarch-potion-${number}`; s = prepareBottle(s, bottleId); s = um(s, { type: 'CONSUME', bottleId, confirmed: true });
      expect(s.progression.sequence).toBe(2);
    }
    s = ready(s, { ap: 2, cash: 100, health: 100, mind: 100 });
    const before = structuredClone(s);
    rejectUncleanMonarch(s, { type: 'REQUEST_SUPPLY' });
    rejectUncleanMonarch(s, { type: 'RECEIVE_SUPPLY' });
    expect(s).toEqual(before);
    expect(s.uncleanMonarch.bottles).toHaveLength(3);
    expect(s.uncleanMonarch.bottles.every(b => b.status === 'CONSUMED' && b.outcome === 'FAILURE')).toBe(true);
    expect(validateUncleanMonarchState(s)).toBe(true);
  }, 240_000);
  it('closes old actions and rejectsS0, wrong path and invented promotion state', () => {
    const s = promoted(); rejectIntent(s, { type: 'BLOOD_DUKE', command: { type: 'LEARN_GUIDANCE' } });
    rejectIntent(s, { type: 'BLOOD_DUKE', command: { type: 'PREPARE_ENCOUNTER' } }); rejectUncleanMonarch(s, dose);
    const zero = structuredClone(s); zero.progression.sequence = 0; expect(validateUncleanMonarchState(zero)).toBe(false);
    const other = structuredClone(s); other.progression.pathwayId = 'sun'; expect(validateUncleanMonarchState(other)).toBe(false);
    const fake = originalBloodDuke(); fake.progression.sequence = 1; expect(validateUncleanMonarchState(fake)).toBe(false);
  }, 240_000);
});

describe('Unclean Monarch source, dose and budget tamper rejection', () => {
  const changes: [string, (s: SliceState) => void][] = [
    ['old strain reset', s => { s.demon.strain = 0; }],
    ['old card travel rewrite', s => { s.blatherer.life.card.travelMetres++; }],
    ['old conscience restored', s => { s.unwinged.conscienceLost = false; }],
    ['old mastery gift', s => { s.progression.mastery['abyss.s7.demonic-lore'] = 1; }],
    ['new mastery gift', s => { s.progression.mastery[UNCLEAN_MONARCH_ABILITY_IDS[0]] = 1; }],
    ['source stats changed to current boost', s => { s.uncleanMonarch.sourceScene!.character.coreStats = { ...s.character.coreStats }; }],
    ['source finance minted', s => { s.uncleanMonarch.sourceScene!.finance.weeklyBudget++; }],
    ['source changed to historical scene', s => { s.uncleanMonarch.sourceScene!.originals.site = structuredClone(s.bloodDuke.life.source!.snapshot); }],
    ['old bell rehearsal erased', s => { s.bloodDuke.life.operation.bellRehearsals = 0; }],
    ['old surrendered body restored', s => { s.devil.encounter.enemyHealth = 100; }],
    ['dose check changed', s => { journal(s).at(-1)!.check!.roll++; }],
    ['paid preparation refunded', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.cash++; }],
    ['free labour', s => { journal(s).find(e => e.command.type === 'POTION_WORK')!.after.actions++; }],
    ['current cash minted', s => { s.cash++; }],
    ['identity changed', s => { s.character.gender = 'MALE'; }],
  ];
  it.each(changes)('rejects %s without mutating the reviewed state', (_name, change) => {
    const s = promoted(); change(s); const before = structuredClone(s);
    expect(validateUncleanMonarchState(s)).toBe(false); expect(s).toEqual(before);
  }, 240_000);
});
