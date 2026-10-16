import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateElderState } from '../../src/domain/elder/index.js';
import { createDarkAngelState, darkAngelInheritedView, darkAngelAcquisitionBlock, darkAngelOriginals,
  projectDarkAngel, validateDarkAngelState, validateDarkAngelSource, validateDarkAngelAcquisitionJournal,
  DARK_ANGEL_INHERITED_ABILITY_IDS } from '../../src/domain/dark-angel/index.js';
import { DARK_ANGEL_ABILITY_IDS, DARK_ANGEL_PREPARATION_IDS } from '../../src/domain/dark-angel/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { originalElder, directedInitial2, taught, prepared, promoted, prepareBottle, step, da, ready, dose,
  rejectDarkAngel, rejectIntent, oldHangedManRoots } from './dark-angel-directed-helper.js';
const journal = (s: SliceState) => s.darkAngel.acquisitionJournal;

describe('Dark Angel independent bottles and authenticated original court', () => {
  it('starts with living60, actual light/heavy wounds and only10 of the required12 Elder weeks', () => {
    const s = originalElder(); expect(s.darkAngel).toEqual(createDarkAngelState());
    expect(s.week - s.elder.promotionWeek!).toBe(10); expect(s.week - s.progression.promotionWeek!).toBeGreaterThan(12);
    rejectDarkAngel(s, dose);
    expect(darkAngelAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const n = da(s, { type: 'LEARN_GUIDANCE' }), first = journal(n)[0]!;
    expect([first.before.cash - first.after.cash, first.before.actions - first.after.actions]).toEqual([500, 1]);
    expect(n.health).toBe(60); expect(n.injuries).toEqual(s.injuries); expect(n.character).toEqual(s.character);
    expect(n.darkAngel.sourceScene!.originals.site).toEqual(s.threeHeadedTemplar.life);
    expect(n.darkAngel.sourceScene!.originals.operation).toEqual(s.elder.life.operation);
    expect(n.darkAngel.sourceScene!.originals.grazing).toEqual(s.shepherd.grazing);
    expect(n.darkAngel.sourceScene!.originals.reserve).toEqual(s.roseBishop.reserve);
    expect(oldHangedManRoots(n)).toEqual(oldHangedManRoots(s)); assertValidSliceState(n);
  }, 120_000);
  it('real ordinary clinic payment treats the original heavy wounds and subsequent rest heals them', () => {
    const source = originalElder(), commands: SliceIntent[] = [];
    expect(source.careKnown).toBe(true);
    let s = step(source, { type: 'ACTION', action: 'REST' }, commands); expect(s.activeEvent?.id).toBe('LIFE-CARE-01');
    expect(s.injuries).toEqual(source.injuries); expect(s.careKnown).toBe(true);
    const before = s.cash, health = s.health;
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY' }, commands);
    expect(s.cash).toBe(before - 60); expect(s.health).toBe(health); expect(s.injuries).toHaveLength(2);
    expect(s.injuries.filter(i => i.severity === 'HEAVY').every(i => i.treatedRevision !== null)).toBe(true);
    expect(s.injuries.find(i => i.severity === 'LIGHT')?.treatedRevision).toBeNull();
    s = ready(s, { health: 100, mind: 100, spirituality: 120, healed: true }, commands);
    expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0); expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(source));
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('each bottle uses five actual1AP jobs,1200p delivery and180p current-week preparation', () => {
    const s = prepared(), j = journal(s), work = j.filter(e => e.command.type === 'POTION_WORK');
    expect(work).toHaveLength(5); for (const e of work) expect([e.before.actions - e.after.actions, e.before.cash - e.after.cash]).toEqual([1, 0]);
    expect(j.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command.type === 'PREPARE_TASK' ? e.command.taskId : null)).toEqual([...DARK_ANGEL_PREPARATION_IDS]);
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, preparation = j.at(-1)!;
    expect([buy.before.cash - buy.after.cash, buy.before.actions - buy.after.actions]).toEqual([1200, 0]);
    expect([preparation.before.cash - preparation.after.cash, preparation.before.actions - preparation.after.actions]).toEqual([180, 1]);
    expect(s.week).toBeGreaterThanOrEqual(147); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(s.darkAngel.bottles[1]!.labourSteps).toBe(0); expect(validateDarkAngelAcquisitionJournal(s)).toBe(true);
    rejectDarkAngel(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = da(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining]).toEqual([s.cash, s.actionsRemaining]);
    expect(left.darkAngel.bottles[0]!.status).toBe('PLAYER'); rejectDarkAngel(left, dose); assertValidSliceState(left);
  }, 240_000);
  it('partial labour never discounts another or the same uncompleted bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = da(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const before = s.cash; s = da(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(before - s.cash).toBe(7200);
    rejectDarkAngel(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const second = s.cash; s = da(s, { type: 'BUY_POTION', bottleId: 'dark-angel-potion-2' }); expect(second - s.cash).toBe(7200);
    expect(s.darkAngel.bottles[0]!.labourSteps).toBe(4); expect(s.darkAngel.bottles[1]!.labourSteps).toBe(0);
  }, 120_000);
  it('counts12 weeks from actual Elder promotion and freezes old practice as soon as guidance is paid', () => {
    let s = taught('SUCCESS', false);
    expect(s.week).toBe(145); expect(s.progression.sequence).toBe(2);
    rejectIntent(s, { type: 'ELDER', command: { type: 'OBSERVE', caseId: 'sealed-whisper' } });
    rejectIntent(s, { type: 'THREE_HEADED_TEMPLAR', command: { type: 'REST_SPIRIT', spiritId: 'THT3-HELENA' } });
    for (const taskId of DARK_ANGEL_PREPARATION_IDS) s = da(s, { type: 'PREPARE_TASK', taskId });
    s = da(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(darkAngelAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('10/12');
    rejectDarkAngel(s, { type: 'PREPARE_PROMOTION' }); expect(s.darkAngel.bottles[0]!.status).toBe('PLAYER');
    const before = structuredClone(s); expect(validateDarkAngelState(s)).toBe(true); expect(s).toEqual(before);
  }, 120_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('replays the actual %s dose and preserves all spent costs', kind => {
    const before = prepared(kind), s = da(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(kind); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.cursorAfter).toBe(e.cursorBefore + 1);
    expect(s.darkAngel.bottles[0]!.status).toBe('CONSUMED'); expect(s.darkAngel.preparedWeek).toBeNull();
    expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(before));
    const won = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(s.progression.sequence).toBe(won ? 1 : 2); expect(s.progression.acting).toBe(won ? 0 : 100);
    expect(s.mind).toBe(before.mind - (kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45));
    expect(s.health).toBe(before.health - (won ? 0 : kind === 'FAILURE' ? 15 : 25));
    expect(s.seer.pollution).toBe(won ? before.seer.pollution : kind === 'FAILURE' ? 30 : 60);
    for (const id of DARK_ANGEL_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(before.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(won ? 17 : 15);
    for (const id of DARK_ANGEL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(won ? 0 : undefined);
    expect(validateDarkAngelAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('promotes without altering15 old mastery values or old source stats used by historical validation', () => {
    const s = promoted(), source = originalElder(), view = darkAngelInheritedView(s), scene = s.darkAngel.sourceScene!;
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(4); expect(s.darkAngel.elderActingAtPromotion).toBe(100);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(source.character.coreStats[stat] + 1);
    expect(view.character.coreStats).toEqual(scene.character.coreStats); expect(view.progression.sequence).toBe(2); expect(view.health).toBe(60);
    expect(view.injuries).toEqual(source.injuries); expect(view.week).toBe(scene.week); expect(view.weeklyBudget).toBe(scene.finance.weeklyBudget);
    expect(validateElderState(view)).toBe(true); expect(validateDarkAngelSource(s)).toBe(true);
    expect(darkAngelOriginals(s)).toEqual(scene.originals); expect(s.darkAngel.life.site).toEqual(scene.originals.site);
    expect(s.darkAngel.life.operation).toEqual(scene.originals.operation);
    expect(s.darkAngel.encounter.grazing).toEqual(scene.originals.grazing);
    expect(s.darkAngel.encounter.reserve).toEqual(scene.originals.reserve);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
    const p = projectDarkAngel(s); expect(p.abilities).toHaveLength(17); expect(p.inheritedHistory.join('')).toContain('15项');
    expect(p.currentGender).toBe('FEMALE'); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
  }, 240_000);
  it('accounts for ordinary weekly billing after the last action, including adjacent next-week receipts', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = da(initial, { type: 'LEARN_GUIDANCE' }); expect(s.week).toBe(initial.week + 1); expect(s.cash).toBe(initial.cash - 500 - 30);
    expect(s.actionsRemaining).toBe(3); expect(journal(s)[0]!.after.actions).toBe(0); assertValidSliceState(s);
    s = da(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); expect(validateDarkAngelAcquisitionJournal(s)).toBe(true);
    const forged = structuredClone(s); forged.cash++; expect(validateDarkAngelState(forged)).toBe(false);
  }, 120_000);
  it('reconciles a real clinic-credit debt instead of requiring an artificially debt-free actor', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 2; initial.weeklyBudget = 3; // Pre-journal UNIT action budget only.
    expect(initial.careKnown).toBe(true);
    let s = step(initial, { type: 'ACTION', action: 'REST' }); expect(s.activeEvent?.id).toBe('LIFE-CARE-01');
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'CREDIT' });
    expect(s.debts.at(-1)).toMatchObject({ source: '诊疗点医疗欠款', remaining: 60, weeklyPayment: 12, createdWeek: initial.week });
    const cash = s.cash; s = da(s, { type: 'LEARN_GUIDANCE' });
    expect(s.cash).toBe(cash - 500 - 30); expect(s.debts.at(-1)!.remaining).toBe(60);
    for (const taskId of DARK_ANGEL_PREPARATION_IDS) s = da(s, { type: 'PREPARE_TASK', taskId });
    expect(s.cash).toBe(cash - 500 - 30 - 30 - 12); expect(s.debts.at(-1)!.remaining).toBe(48);
    expect(validateDarkAngelAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
    const forged = structuredClone(s); forged.debts.at(-1)!.remaining--;
    expect(validateDarkAngelState(forged)).toBe(false);
  }, 240_000);
  it('promotion itself never treats an existing light or heavy wound or refills current spirituality', () => {
    let s = taught(); const source = structuredClone(s);
    for (const taskId of DARK_ANGEL_PREPARATION_IDS) s = da(s, { type: 'PREPARE_TASK', taskId });
    s = da(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = da(s, { type: 'PREPARE_PROMOTION' });
    s = da(s, dose); expect(s.progression.sequence).toBe(1);
    expect(s.health).toBe(60); expect(s.spirituality).toBe(118); expect(s.injuries).toEqual(source.injuries);
    expect(s.injuryRisk).toBe(1); expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(source));
    assertValidSliceState(s);
  }, 240_000);
  it('funds and prepares a bottle from actual615 without changing source resources, seed or old roots', () => {
    const source = originalElder(), commands: SliceIntent[] = [], s = prepareBottle(source, dose.bottleId, commands);
    expect(s.random).toEqual(source.random); expect(s.week).toBeGreaterThanOrEqual(147); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'WORK')).toBe(true);
    expect(source.careKnown).toBe(true);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toBe(false);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toBe(true);
    expect(oldHangedManRoots(s)).toEqual(oldHangedManRoots(source)); expect(source.cash).toBe(818); expect(source.health).toBe(60); assertValidSliceState(s);
  }, 240_000);
  it('requires all three real failed bottles and a real following week for independent resupply', () => {
    const initial = directedInitial2('THREE_FAILURES'); initial.actionsRemaining = initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = da(initial, { type: 'LEARN_GUIDANCE' }); rejectDarkAngel(s, { type: 'REQUEST_SUPPLY' });
    for (let number = 1; number <= 3; number++) {
      const bottleId = `dark-angel-potion-${number}`; s = prepareBottle(s, bottleId); s = da(s, { type: 'CONSUME', bottleId, confirmed: true });
      expect(s.progression.sequence).toBe(2);
    }
    s = ready(s, { ap: 2, cash: 100, health: 100, mind: 100 });
    const before = s.cash; s = da(s, { type: 'REQUEST_SUPPLY' }); expect(s.cash).toBe(before - 100);
    const requested = s.darkAngel.resupply.requestedWeek!; rejectDarkAngel(s, { type: 'RECEIVE_SUPPLY' });
    s = ready(s, { afterWeek: requested }); s = da(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.darkAngel.bottles).toHaveLength(6); expect(s.darkAngel.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
    expect(s.darkAngel.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true);
    expect(validateDarkAngelState(s)).toBe(true);
  }, 240_000);
  it('closes old actions and rejectsS0, wrong path and invented promotion state', () => {
    const s = promoted(); rejectIntent(s, { type: 'ELDER', command: { type: 'LEARN_GUIDANCE' } });
    rejectIntent(s, { type: 'ELDER', command: { type: 'PREPARE_ENCOUNTER' } }); rejectDarkAngel(s, dose);
    const zero = structuredClone(s); zero.progression.sequence = 0; expect(validateDarkAngelState(zero)).toBe(false);
    const other = structuredClone(s); other.progression.pathwayId = 'sun'; expect(validateDarkAngelState(other)).toBe(false);
    const fake = originalElder(); fake.progression.sequence = 1; expect(validateDarkAngelState(fake)).toBe(false);
  }, 240_000);
});

describe('Dark Angel source, dose and budget tamper rejection', () => {
  const changes: [string, (s: SliceState) => void][] = [
    ['old spirit refill', s => { s.threeHeadedTemplar.life.spirits['THT3-HELENA'].spirituality++; }],
    ['old card travel rewrite', s => { s.threeHeadedTemplar.life.card.travelMetres++; }],
    ['old reserve refill', s => { s.roseBishop.reserve.points++; }],
    ['old mastery gift', s => { s.progression.mastery['hanged-man.s6.flesh-shaping'] = 1; }],
    ['new mastery gift', s => { s.progression.mastery[DARK_ANGEL_ABILITY_IDS[0]] = 1; }],
    ['source stats changed to current boost', s => { s.darkAngel.sourceScene!.character.coreStats = { ...s.character.coreStats }; }],
    ['source finance minted', s => { s.darkAngel.sourceScene!.finance.weeklyBudget++; }],
    ['same source spirit altered', s => { s.darkAngel.sourceScene!.originals.site.spirits['THT3-ROLAND'].integrity--; }],
    ['old seal charges restored', s => { s.elder.life.operation.materials[2]!.charges++; }],
    ['old released soul restored', s => { s.shepherd.grazing.spirits[1]!.status = 'GRAZED'; }],
    ['dose check changed', s => { journal(s).at(-1)!.check!.roll++; }],
    ['paid preparation refunded', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.cash++; }],
    ['free labour', s => { journal(s).find(e => e.command.type === 'POTION_WORK')!.after.actions++; }],
    ['current cash minted', s => { s.cash++; }],
    ['identity changed', s => { s.character.gender = 'MALE'; }],
  ];
  it.each(changes)('rejects %s without mutating the reviewed state', (_name, change) => {
    const s = promoted(); change(s); const before = structuredClone(s);
    expect(validateDarkAngelState(s)).toBe(false); expect(s).toEqual(before);
  }, 240_000);
});
