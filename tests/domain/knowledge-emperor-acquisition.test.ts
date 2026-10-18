import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateSageState } from '../../src/domain/sage/index.js';
import { createKnowledgeEmperorState, knowledgeEmperorInheritedView, knowledgeEmperorAcquisitionBlock, knowledgeEmperorOriginals,
  projectKnowledgeEmperor, validateKnowledgeEmperorState, validateKnowledgeEmperorSource, validateKnowledgeEmperorAcquisitionJournal,
  KNOWLEDGE_EMPEROR_INHERITED_ABILITY_IDS } from '../../src/domain/knowledge-emperor/index.js';
import { KNOWLEDGE_EMPEROR_ABILITY_IDS, KNOWLEDGE_EMPEROR_PREPARATION_IDS } from '../../src/domain/knowledge-emperor/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { originalSage, directedInitial2, taught, prepared, promoted, prepareBottle, step, ke, ready, dose,
  rejectKnowledgeEmperor, rejectIntent, oldHermitRoots } from './knowledge-emperor-directed-helper.js';
const journal = (s: SliceState) => s.knowledgeEmperor.acquisitionJournal;

describe('Knowledge Emperor independent bottles and authenticated original archive', () => {
  it('starts with living40, actual two heavy wounds and only10 of the required12 Sage weeks', () => {
    const s = originalSage(); expect(s.knowledgeEmperor).toEqual(createKnowledgeEmperorState());
    expect(s.week - s.sage.promotionWeek!).toBe(10); expect(s.week - s.progression.promotionWeek!).toBeGreaterThan(12);
    rejectKnowledgeEmperor(s, dose);
    expect(knowledgeEmperorAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const n = ke(s, { type: 'LEARN_GUIDANCE' }), first = journal(n)[0]!;
    expect([first.before.cash - first.after.cash, first.before.actions - first.after.actions]).toEqual([500, 1]);
    expect(n.health).toBe(40); expect(n.injuries).toEqual(s.injuries); expect(n.character).toEqual(s.character);
    expect(n.knowledgeEmperor.sourceScene!.originals.site).toEqual(s.sage.encounter.currentSite);
    expect(n.knowledgeEmperor.sourceScene!.originals.site).not.toEqual(s.sage.life.site);
    expect(n.knowledgeEmperor.sourceScene!.originals.workshop).toEqual(s.scrollProfessor.workshop);
    expect(oldHermitRoots(n)).toEqual(oldHermitRoots(s)); assertValidSliceState(n);
  }, 120_000);
  it('real ordinary clinic payment treats the original heavy wounds and subsequent rest heals them', () => {
    const source = originalSage(), commands: SliceIntent[] = [];
    let s = step(source, { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' }, commands);
    expect(s.injuries).toEqual(source.injuries); expect(s.careKnown).toBe(true);
    s = step(s, { type: 'ACTION', action: 'REST' }, commands); expect(s.activeEvent?.id).toBe('LIFE-CARE-01');
    const before = s.cash, health = s.health;
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY' }, commands);
    expect(s.cash).toBe(before - 60); expect(s.health).toBe(health); expect(s.injuries).toHaveLength(2);
    expect(s.injuries.every(i => i.treatedRevision !== null)).toBe(true);
    s = ready(s, { health: 100, mind: 100, spirituality: 120, healed: true }, commands);
    expect(s.injuries).toEqual([]); expect(s.injuryRisk).toBe(0); expect(oldHermitRoots(s)).toEqual(oldHermitRoots(source));
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('each bottle uses five actual1AP jobs,1200p delivery and180p current-week preparation', () => {
    const s = prepared(), j = journal(s), work = j.filter(e => e.command.type === 'POTION_WORK');
    expect(work).toHaveLength(5); for (const e of work) expect([e.before.actions - e.after.actions, e.before.cash - e.after.cash]).toEqual([1, 0]);
    expect(j.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command.type === 'PREPARE_TASK' ? e.command.taskId : null)).toEqual([...KNOWLEDGE_EMPEROR_PREPARATION_IDS]);
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, preparation = j.at(-1)!;
    expect([buy.before.cash - buy.after.cash, buy.before.actions - buy.after.actions]).toEqual([1200, 0]);
    expect([preparation.before.cash - preparation.after.cash, preparation.before.actions - preparation.after.actions]).toEqual([180, 1]);
    expect(s.week).toBeGreaterThanOrEqual(154); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(s.knowledgeEmperor.bottles[1]!.labourSteps).toBe(0); expect(validateKnowledgeEmperorAcquisitionJournal(s)).toBe(true);
    rejectKnowledgeEmperor(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = ke(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining]).toEqual([s.cash, s.actionsRemaining]);
    expect(left.knowledgeEmperor.bottles[0]!.status).toBe('PLAYER'); rejectKnowledgeEmperor(left, dose); assertValidSliceState(left);
  }, 240_000);
  it('partial labour never discounts another or the same uncompleted bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = ke(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const before = s.cash; s = ke(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(before - s.cash).toBe(7200);
    rejectKnowledgeEmperor(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const second = s.cash; s = ke(s, { type: 'BUY_POTION', bottleId: 'knowledge-emperor-potion-2' }); expect(second - s.cash).toBe(7200);
    expect(s.knowledgeEmperor.bottles[0]!.labourSteps).toBe(4); expect(s.knowledgeEmperor.bottles[1]!.labourSteps).toBe(0);
  }, 120_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('replays the actual %s dose and preserves all spent costs', kind => {
    const before = prepared(kind), s = ke(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(kind); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.cursorAfter).toBe(e.cursorBefore + 1);
    expect(s.knowledgeEmperor.bottles[0]!.status).toBe('CONSUMED'); expect(s.knowledgeEmperor.preparedWeek).toBeNull();
    expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(oldHermitRoots(s)).toEqual(oldHermitRoots(before));
    const won = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(s.progression.sequence).toBe(won ? 1 : 2); expect(s.progression.acting).toBe(won ? 0 : 100);
    expect(s.mind).toBe(before.mind - (kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45));
    expect(s.health).toBe(before.health - (won ? 0 : kind === 'FAILURE' ? 15 : 25));
    expect(s.seer.pollution).toBe(won ? before.seer.pollution : kind === 'FAILURE' ? 30 : 60);
    for (const id of KNOWLEDGE_EMPEROR_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(before.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(won ? 15 : 13);
    for (const id of KNOWLEDGE_EMPEROR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(won ? 0 : undefined);
    expect(validateKnowledgeEmperorAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('promotes without altering13 old mastery values or old source stats used by historical validation', () => {
    const s = promoted(), source = originalSage(), view = knowledgeEmperorInheritedView(s), scene = s.knowledgeEmperor.sourceScene!;
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(5); expect(s.knowledgeEmperor.sageActingAtPromotion).toBe(100);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(source.character.coreStats[stat] + 1);
    expect(view.character.coreStats).toEqual(scene.character.coreStats); expect(view.progression.sequence).toBe(2); expect(view.health).toBe(40);
    expect(view.injuries).toEqual(source.injuries); expect(view.week).toBe(scene.week); expect(view.weeklyBudget).toBe(scene.finance.weeklyBudget);
    expect(validateSageState(view)).toBe(true); expect(validateKnowledgeEmperorSource(s)).toBe(true);
    expect(knowledgeEmperorOriginals(s)).toEqual(scene.originals); expect(s.knowledgeEmperor.life.site).toEqual(scene.originals.site);
    expect(s.knowledgeEmperor.encounter.workshop).toEqual(scene.originals.workshop);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
    const p = projectKnowledgeEmperor(s); expect(p.abilities).toHaveLength(15); expect(p.inheritedHistory.join('')).toContain('13项');
    expect(p.currentGender).toBe('FEMALE'); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
  }, 240_000);
  it('accounts for ordinary weekly billing after the last action, including adjacent next-week receipts', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = ke(initial, { type: 'LEARN_GUIDANCE' }); expect(s.week).toBe(initial.week + 1); expect(s.cash).toBe(initial.cash - 500 - 30);
    expect(s.actionsRemaining).toBe(3); expect(journal(s)[0]!.after.actions).toBe(0); assertValidSliceState(s);
    s = ke(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); expect(validateKnowledgeEmperorAcquisitionJournal(s)).toBe(true);
    const forged = structuredClone(s); forged.cash++; expect(validateKnowledgeEmperorState(forged)).toBe(false);
  }, 120_000);
  it('funds and prepares a bottle from actual651 without changing source resources, seed or old roots', () => {
    const source = originalSage(), commands: SliceIntent[] = [], s = prepareBottle(source, dose.bottleId, commands);
    expect(s.random).toEqual(source.random); expect(s.week).toBeGreaterThanOrEqual(154); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'WORK')).toBe(true);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toBe(true);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && c.choiceId === 'PAY')).toBe(true);
    expect(oldHermitRoots(s)).toEqual(oldHermitRoots(source)); expect(source.cash).toBe(770); expect(source.health).toBe(40); assertValidSliceState(s);
  }, 240_000);
  it('requires all three real failed bottles and a real following week for independent resupply', () => {
    const initial = directedInitial2('THREE_FAILURES'); initial.actionsRemaining = initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = ke(initial, { type: 'LEARN_GUIDANCE' }); rejectKnowledgeEmperor(s, { type: 'REQUEST_SUPPLY' });
    for (let number = 1; number <= 3; number++) {
      const bottleId = `knowledge-emperor-potion-${number}`; s = prepareBottle(s, bottleId); s = ke(s, { type: 'CONSUME', bottleId, confirmed: true });
      expect(s.progression.sequence).toBe(2);
    }
    s = ready(s, { ap: 2, cash: 100, health: 100, mind: 100 });
    const before = s.cash; s = ke(s, { type: 'REQUEST_SUPPLY' }); expect(s.cash).toBe(before - 100);
    const requested = s.knowledgeEmperor.resupply.requestedWeek!; rejectKnowledgeEmperor(s, { type: 'RECEIVE_SUPPLY' });
    s = ready(s, { afterWeek: requested }); s = ke(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.knowledgeEmperor.bottles).toHaveLength(6); expect(s.knowledgeEmperor.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
    expect(s.knowledgeEmperor.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true);
    expect(validateKnowledgeEmperorState(s)).toBe(true);
  }, 240_000);
  it('closes old actions and rejectsS0, wrong path and invented promotion state', () => {
    const s = promoted(); rejectIntent(s, { type: 'SAGE', command: { type: 'LEARN_GUIDANCE' } });
    rejectIntent(s, { type: 'SAGE', command: { type: 'PREPARE_ENCOUNTER' } }); rejectKnowledgeEmperor(s, dose);
    const zero = structuredClone(s); zero.progression.sequence = 0; expect(validateKnowledgeEmperorState(zero)).toBe(false);
    const other = structuredClone(s); other.progression.pathwayId = 'sun'; expect(validateKnowledgeEmperorState(other)).toBe(false);
    const fake = originalSage(); fake.progression.sequence = 1; expect(validateKnowledgeEmperorState(fake)).toBe(false);
  }, 240_000);
});

describe('Knowledge Emperor source, dose and budget tamper rejection', () => {
  const changes: [string, (s: SliceState) => void][] = [
    ['old site energy refill', s => { s.sage.encounter.currentSite!.playerEnergy++; }],
    ['old archive reading rewrite', s => { s.sage.life.site.archive.readings++; }],
    ['old workshop refill', s => { s.scrollProfessor.workshop.materials[0]!.status = 'HELD'; }],
    ['old mastery gift', s => { s.progression.mastery['hermit.s5.mystic-sight'] = 1; }],
    ['new mastery gift', s => { s.progression.mastery[KNOWLEDGE_EMPEROR_ABILITY_IDS[0]] = 1; }],
    ['source stats changed to current boost', s => { s.knowledgeEmperor.sourceScene!.character.coreStats = { ...s.character.coreStats }; }],
    ['source finance minted', s => { s.knowledgeEmperor.sourceScene!.finance.weeklyBudget++; }],
    ['same source workshop altered', s => { s.knowledgeEmperor.sourceScene!.originals.workshop.kitsBought++; }],
    ['dose check changed', s => { journal(s).at(-1)!.check!.roll++; }],
    ['paid preparation refunded', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.cash++; }],
    ['free labour', s => { journal(s).find(e => e.command.type === 'POTION_WORK')!.after.actions++; }],
    ['current cash minted', s => { s.cash++; }],
    ['identity changed', s => { s.character.gender = 'MALE'; }],
  ];
  it.each(changes)('rejects %s without mutating the reviewed state', (_name, change) => {
    const s = promoted(); change(s); const before = structuredClone(s);
    expect(validateKnowledgeEmperorState(s)).toBe(false); expect(s).toEqual(before);
  }, 240_000);
});
