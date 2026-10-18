import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateEntropyDukeState } from '../../src/domain/entropy-duke/index.js';
import { createPrinceOfAbolitionState, princeOfAbolitionInheritedView, princeOfAbolitionAcquisitionBlock, princeOfAbolitionOriginals,
  projectPrinceOfAbolition, validatePrinceOfAbolitionState, validatePrinceOfAbolitionSource, validatePrinceOfAbolitionAcquisitionJournal,
  PRINCE_OF_ABOLITION_INHERITED_ABILITY_IDS } from '../../src/domain/prince-of-abolition/index.js';
import { PRINCE_OF_ABOLITION_ABILITY_IDS, PRINCE_OF_ABOLITION_PREPARATION_IDS } from '../../src/domain/prince-of-abolition/types.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { originalEntropyDuke, directedInitial2, taught, prepared, promoted, prepareBottle, step, poa, ready, dose,
  rejectPrinceOfAbolition, rejectIntent, oldBlackEmperorRoots } from './prince-of-abolition-directed-helper.js';
const journal = (s: SliceState) => s.princeOfAbolition.acquisitionJournal;

describe('PrinceOfAbolition independent bottles and authenticated original delivery room', () => {
  it('starts with whole743, no wounds and ten of the required12 Entropy Duke weeks', () => {
    const s = originalEntropyDuke(); expect(s.princeOfAbolition).toEqual(createPrinceOfAbolitionState());
    expect(s.week - s.entropyDuke.promotionWeek!).toBe(10); expect(s.week - s.progression.promotionWeek!).toBeGreaterThan(12);
    rejectPrinceOfAbolition(s, dose);
    expect(princeOfAbolitionAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).not.toBeNull();
    const n = poa(s, { type: 'LEARN_GUIDANCE' }), first = journal(n)[0]!;
    expect([first.before.cash - first.after.cash, first.before.actions - first.after.actions]).toEqual([500, 1]);
    expect(n.health).toBe(100); expect(n.injuries).toEqual([]); expect(n.character).toEqual(s.character);
    expect(n.princeOfAbolition.sourceScene!.originals.site).toEqual(s.frenzyMage.life);
    expect(n.princeOfAbolition.sourceScene!.originals.site).not.toEqual(s.entropyDuke.life.source!.snapshot);
    expect(n.princeOfAbolition.sourceScene!.originals.operation).toEqual(s.entropyDuke.life.operation);
    expect(n.princeOfAbolition.sourceScene!.originals.gifts).toEqual(s.briber.gifts);
    expect(n.princeOfAbolition.gifts).toEqual(s.briber.gifts); expect(n.princeOfAbolition.gifts).not.toBe(n.briber.gifts);
    expect(oldBlackEmperorRoots(n)).toEqual(oldBlackEmperorRoots(s)); assertValidSliceState(n);
  }, 120_000);
  it('shows the actual14 inherited skills and one current gift stock before promotion without leaking private state', () => {
    for (const s of [originalEntropyDuke(), taught()]) {
      const before = structuredClone(s), p = projectPrinceOfAbolition(s);
      expect(p.abilities.map(a => a.id)).toEqual([...PRINCE_OF_ABOLITION_INHERITED_ABILITY_IDS]);
      for (const ability of p.abilities) expect(ability.mastery).toBe(s.progression.mastery[ability.id]);
      expect(p.abilities.some(a => PRINCE_OF_ABOLITION_ABILITY_IDS.includes(a.id as typeof PRINCE_OF_ABOLITION_ABILITY_IDS[number]))).toBe(false);
      expect(p.gifts).toEqual({ held: 3, given: 12, items: s.briber.gifts });
      expect(p.resources).toMatchObject({ health: s.health, mind: s.mind, spirituality: s.spirituality, maxSpirituality: 120, actionsRemaining: s.actionsRemaining });
      expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
      const serialized = JSON.stringify(p);
      for (const secret of ['sourceScene', 'sourceHistory', 'historyDigest', 'identityDigest', 'randomCursor', 'randomSeed', 'weeklyBudget', 'acquisitionJournal', 'cursorBefore', 'cursorAfter']) expect(serialized).not.toContain(`"${secret}"`);
      expect(serialized).not.toContain(s.random.seed); expect(s).toEqual(before);
    }
  }, 120_000);
  it('freezes all eight old action entries and never offers a second gift inventory', () => {
    const s = taught(), before = oldBlackEmperorRoots(s);
    const intents: SliceIntent[] = [
      { type: 'LAWYER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'BARBARIAN', command: { type: 'LEARN_FORMULA' } },
      { type: 'BRIBER', command: { type: 'BUY_GIFTS' } },
      { type: 'CORRUPTION_BARON', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'MENTOR_DISORDER', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'FALLEN_EARL', command: { type: 'LEARN_GUIDANCE' } },
      { type: 'FRENZY_MAGE', command: { type: 'OBSERVE', caseId: 'courier-route' } },
      { type: 'ENTROPY_DUKE', command: { type: 'OBSERVE', caseId: 'measured-throw' } },
    ];
    for (const intent of intents) rejectIntent(s, intent);
    expect(oldBlackEmperorRoots(s)).toEqual(before); expect(s.princeOfAbolition.gifts).toEqual(s.briber.gifts);
    expect(projectPrinceOfAbolition(s).gifts.items.filter(g => g.location === 'PLAYER').map(g => g.id)).toEqual(['BR7-GIFT-13', 'BR7-GIFT-14', 'BR7-GIFT-15']);
  }, 120_000);
  it('each bottle uses five actual1AP jobs,1200p delivery and180p current-week preparation', () => {
    const s = prepared(), j = journal(s), work = j.filter(e => e.command.type === 'POTION_WORK');
    expect(work).toHaveLength(5); for (const e of work) expect([e.before.actions - e.after.actions, e.before.cash - e.after.cash]).toEqual([1, 0]);
    expect(j.filter(e => e.command.type === 'PREPARE_TASK').map(e => e.command.type === 'PREPARE_TASK' ? e.command.taskId : null)).toEqual([...PRINCE_OF_ABOLITION_PREPARATION_IDS]);
    const buy = j.find(e => e.command.type === 'BUY_POTION')!, preparation = j.at(-1)!;
    expect([buy.before.cash - buy.after.cash, buy.before.actions - buy.after.actions]).toEqual([1200, 0]);
    expect([preparation.before.cash - preparation.after.cash, preparation.before.actions - preparation.after.actions]).toEqual([180, 1]);
    expect(s.week).toBeGreaterThanOrEqual(187); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(s.princeOfAbolition.bottles[1]!.labourSteps).toBe(0); expect(validatePrinceOfAbolitionAcquisitionJournal(s)).toBe(true);
    rejectPrinceOfAbolition(s, { type: 'POTION_WORK', bottleId: dose.bottleId }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const left = poa(s, { type: 'LEAVE_PREPARATION' }); expect([left.cash, left.actionsRemaining]).toEqual([s.cash, s.actionsRemaining]);
    expect(left.princeOfAbolition.bottles[0]!.status).toBe('PLAYER'); rejectPrinceOfAbolition(left, dose); assertValidSliceState(left);
  }, 240_000);
  it('keeps the complete14-entry mastery gate and strict health/mind thresholds', () => {
    const source = directedInitial2(), missing = structuredClone(source), extra = structuredClone(source);
    delete missing.progression.mastery['black-emperor.s7.bribery-weakening'];
    extra.progression.mastery['black-emperor.s0.black-emperor'] = 0;
    expect(princeOfAbolitionAcquisitionBlock(missing, { type: 'LEARN_GUIDANCE' })).toContain('14项');
    expect(princeOfAbolitionAcquisitionBlock(extra, { type: 'LEARN_GUIDANCE' })).toContain('14项');
    for (const [health, mind] of [[20, 100], [100, 40]] as const) {
      const s = prepared(); s.health = health; s.mind = mind;
      expect(princeOfAbolitionAcquisitionBlock(s, dose)).toContain('健康>20且精神>40');
    }
    const undigested = prepared(); undigested.progression.acting = 99;
    expect(princeOfAbolitionAcquisitionBlock(undigested, dose)).toContain('99/100');
    const unfinished = directedInitial2(); unfinished.entropyDuke.life.reflected = false;
    expect(princeOfAbolitionAcquisitionBlock(unfinished, { type: 'LEARN_GUIDANCE' })).not.toBeNull();
    expect(PRINCE_OF_ABOLITION_INHERITED_ABILITY_IDS).toHaveLength(14);
  }, 240_000);
  it('allows a genuine0AP preparation exit without refund, bottle loss or hidden recovery', () => {
    const initial = directedInitial2(); initial.actionsRemaining = initial.weeklyBudget = 5; // Explicit pre-journal UNIT budget.
    let s = poa(initial, { type: 'LEARN_GUIDANCE' });
    for (const taskId of PRINCE_OF_ABOLITION_PREPARATION_IDS) s = poa(s, { type: 'PREPARE_TASK', taskId });
    s = poa(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    s = poa(s, { type: 'PREPARE_PROMOTION' }); expect(s.actionsRemaining).toBe(0);
    const paid = structuredClone(s), n = poa(s, { type: 'LEAVE_PREPARATION' });
    const receipt = journal(n).at(-1)!;
    expect(receipt.command.type).toBe('LEAVE_PREPARATION'); expect(receipt.before).toEqual(receipt.after);
    expect(receipt.after.actions).toBe(0); expect(receipt.after.health).toBe(paid.health);
    expect(receipt.after.spirituality).toBe(paid.spirituality); expect(n.princeOfAbolition.bottles[0]!.status).toBe('PLAYER');
    expect(n.princeOfAbolition.preparedWeek).toBeNull(); expect(n.week).toBe(paid.week + 1);
    expect(n.cash).toBe(paid.cash - 30); expect(n.random).toEqual(paid.random);
    assertValidSliceState(n);
  }, 240_000);
  it('partial labour never discounts another or the same uncompleted bottle', () => {
    let s = taught(); for (let n = 0; n < 4; n++) s = poa(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const before = s.cash; s = poa(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); expect(before - s.cash).toBe(7200);
    rejectPrinceOfAbolition(s, { type: 'POTION_WORK', bottleId: dose.bottleId });
    const second = s.cash; s = poa(s, { type: 'BUY_POTION', bottleId: 'prince-of-abolition-potion-2' }); expect(second - s.cash).toBe(7200);
    expect(s.princeOfAbolition.bottles[0]!.labourSteps).toBe(4); expect(s.princeOfAbolition.bottles[1]!.labourSteps).toBe(0);
  }, 120_000);
  it('counts12 weeks from actual EntropyDuke promotion and freezes old practice as soon as guidance is paid', () => {
    let s = taught('SUCCESS', false);
    expect(s.week).toBe(185); expect(s.progression.sequence).toBe(2);
    rejectIntent(s, { type: 'ENTROPY_DUKE', command: { type: 'OBSERVE', caseId: 'lasting-flight' } });
    rejectIntent(s, { type: 'FRENZY_MAGE', command: { type: 'OBSERVE', caseId: 'courier-route' } });
    for (const taskId of PRINCE_OF_ABOLITION_PREPARATION_IDS) s = poa(s, { type: 'PREPARE_TASK', taskId });
    s = poa(s, { type: 'BUY_POTION', bottleId: dose.bottleId });
    expect(princeOfAbolitionAcquisitionBlock(s, { type: 'PREPARE_PROMOTION' })).toContain('10/12');
    rejectPrinceOfAbolition(s, { type: 'PREPARE_PROMOTION' }); expect(s.princeOfAbolition.bottles[0]!.status).toBe('PLAYER');
    const before = structuredClone(s); expect(validatePrinceOfAbolitionState(s)).toBe(true); expect(s).toEqual(before);
  }, 120_000);
  it.each(['GREAT_SUCCESS', 'SUCCESS', 'FAILURE', 'GREAT_FAILURE'] as const)('replays the actual %s dose and preserves all spent costs', kind => {
    const before = prepared(kind), s = poa(before, dose), e = journal(s).at(-1)!;
    expect(e.check!.tier).toBe(kind); expect(e.randomAfter).toBe(e.randomBefore! + 1); expect(e.cursorAfter).toBe(e.cursorBefore + 1);
    expect(s.princeOfAbolition.bottles[0]!.status).toBe('CONSUMED'); expect(s.princeOfAbolition.preparedWeek).toBeNull();
    expect(s.spirituality).toBe(before.spirituality); expect(s.injuries).toEqual(before.injuries); expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(before));
    const won = kind === 'SUCCESS' || kind === 'GREAT_SUCCESS';
    expect(s.progression.sequence).toBe(won ? 1 : 2); expect(s.progression.acting).toBe(won ? 0 : 100);
    expect(s.mind).toBe(before.mind - (kind === 'GREAT_SUCCESS' ? 8 : kind === 'SUCCESS' ? 15 : kind === 'FAILURE' ? 25 : 45));
    expect(s.health).toBe(before.health - (won ? 0 : kind === 'FAILURE' ? 15 : 25));
    expect(s.seer.pollution).toBe(won ? before.seer.pollution : kind === 'FAILURE' ? 30 : 60);
    for (const id of PRINCE_OF_ABOLITION_INHERITED_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(before.progression.mastery[id]);
    expect(Object.keys(s.progression.mastery)).toHaveLength(won ? 16 : 14);
    for (const id of PRINCE_OF_ABOLITION_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(won ? 0 : undefined);
    expect(validatePrinceOfAbolitionAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
  }, 240_000);
  it('promotes without altering14 old mastery values or old source stats used by historical validation', () => {
    const s = promoted(), source = originalEntropyDuke(), view = princeOfAbolitionInheritedView(s), scene = s.princeOfAbolition.sourceScene!;
    expect(Object.values(s.progression.mastery).filter(v => v === 0)).toHaveLength(5); expect(s.princeOfAbolition.entropyDukeActingAtPromotion).toBe(100);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) expect(s.character.coreStats[stat]).toBe(source.character.coreStats[stat] + 1);
    expect(view.character.coreStats).toEqual(scene.character.coreStats); expect(view.progression.sequence).toBe(2); expect(view.health).toBe(100);
    expect(view.injuries).toEqual(source.injuries); expect(view.week).toBe(scene.week); expect(view.weeklyBudget).toBe(scene.finance.weeklyBudget);
    expect(validateEntropyDukeState(view)).toBe(true); expect(validatePrinceOfAbolitionSource(s)).toBe(true);
    expect(princeOfAbolitionOriginals(s)).toEqual(scene.originals); expect(s.princeOfAbolition.life.site).toEqual(scene.originals.site);
    expect(s.princeOfAbolition.life.operation).toEqual(scene.originals.operation);
    expect(s.princeOfAbolition.gifts).toEqual(scene.originals.gifts);
    expect(s.princeOfAbolition.gifts.filter(g => g.location === 'PLAYER')).toHaveLength(3);
    expect(projectSliceState(s).maxSpirituality).toBe(120);
    const p = projectPrinceOfAbolition(s); expect(p.abilities).toHaveLength(16); expect(p.inheritedHistory.join('')).toContain('14项');
    expect(p.currentGender).toBe('FEMALE'); expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
  }, 240_000);
  it('accounts for ordinary weekly billing after the last action, including adjacent next-week receipts', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = poa(initial, { type: 'LEARN_GUIDANCE' }); expect(s.week).toBe(initial.week + 1); expect(s.cash).toBe(initial.cash - 500 - 30);
    expect(s.actionsRemaining).toBe(3); expect(journal(s)[0]!.after.actions).toBe(0); assertValidSliceState(s);
    s = poa(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' }); expect(validatePrinceOfAbolitionAcquisitionJournal(s)).toBe(true);
    const forged = structuredClone(s); forged.cash++; expect(validatePrinceOfAbolitionState(forged)).toBe(false);
  }, 120_000);
  it('reconciles an actual ordinary bill debt and its next-week payment', () => {
    const initial = directedInitial2(); initial.actionsRemaining = 1; initial.weeklyBudget = 3; initial.cash = 500; // Explicit pre-journal UNIT budget.
    let s = poa(initial, { type: 'LEARN_GUIDANCE' });
    expect(s.activeEvent?.id).toBe('LIFE-BILL-01'); expect(s.cash).toBe(0);
    s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent!.instanceId, choiceId: 'PAY_PART' });
    expect(s.debts.at(-1)).toMatchObject({ source: '生活应付款', remaining: 30, weeklyPayment: 30, createdWeek: initial.week });
    const debtId = s.debts.at(-1)!.id;
    s = step(s, { type: 'ACTION', action: 'WORK' }); expect(s.cash).toBe(180);
    s = poa(s, { type: 'PREPARE_TASK', taskId: 'VERIFY_ORIGINALS' });
    s = poa(s, { type: 'PREPARE_TASK', taskId: 'CHECK_LIMITS' });
    expect(s.cash).toBe(120); expect(s.debts.find(d => d.id === debtId)!.remaining).toBe(0);
    expect(validatePrinceOfAbolitionAcquisitionJournal(s)).toBe(true); assertValidSliceState(s);
    const forged = structuredClone(s); forged.debts.find(d => d.id === debtId)!.remaining = 1;
    expect(validatePrinceOfAbolitionState(forged)).toBe(false);
  }, 240_000);
  it('promotion never fills current spirituality or changes old wounds or identity', () => {
    const initial = directedInitial2(); initial.spirituality = 80; // Explicit pre-journal UNIT current resource.
    let s = poa(initial, { type: 'LEARN_GUIDANCE' }); const source = structuredClone(s);
    for (const taskId of PRINCE_OF_ABOLITION_PREPARATION_IDS) s = poa(s, { type: 'PREPARE_TASK', taskId });
    s = poa(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = poa(s, { type: 'PREPARE_PROMOTION' });
    s = poa(s, dose); expect(s.progression.sequence).toBe(1);
    expect(s.health).toBe(100); expect(s.spirituality).toBe(80); expect(s.injuries).toEqual(source.injuries);
    expect(s.injuryRisk).toBe(0); expect(s.character.gender).toBe('FEMALE'); expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(source));
    assertValidSliceState(s);
  }, 240_000);
  it('funds and prepares a bottle from actual743 without changing source resources, seed or old roots', () => {
    const source = originalEntropyDuke(), commands: SliceIntent[] = [], s = prepareBottle(source, dose.bottleId, commands);
    expect(s.random).toEqual(source.random); expect(s.week).toBeGreaterThanOrEqual(187); expect(s.health).toBe(100); expect(s.injuries).toEqual([]);
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'WORK')).toBe(true);
    expect(source.careKnown).toBe(true); // Existing access stays known; no new clinic is required.
    expect(commands.some(c => c.type === 'ACTION' && c.action === 'INVESTIGATE' && c.targetId === 'CARE-ACCESS-01')).toBe(false);
    expect(commands.some(c => c.type === 'EVENT_CHOICE' && (c.choiceId === 'PAY' || c.choiceId === 'CREDIT'))).toBe(false);
    expect(oldBlackEmperorRoots(s)).toEqual(oldBlackEmperorRoots(source)); expect(source.cash).toBe(800); expect(source.health).toBe(100); assertValidSliceState(s);
  }, 240_000);
  it('requires all three real failed bottles and a real following week for independent resupply', () => {
    const initial = directedInitial2('THREE_FAILURES'); initial.actionsRemaining = initial.weeklyBudget = 3; // Explicit pre-journal UNIT budget.
    let s = poa(initial, { type: 'LEARN_GUIDANCE' }); rejectPrinceOfAbolition(s, { type: 'REQUEST_SUPPLY' });
    for (let number = 1; number <= 3; number++) {
      const bottleId = `prince-of-abolition-potion-${number}`; s = prepareBottle(s, bottleId); s = poa(s, { type: 'CONSUME', bottleId, confirmed: true });
      expect(s.progression.sequence).toBe(2);
    }
    s = ready(s, { ap: 2, cash: 100, health: 100, mind: 100 });
    const before = s.cash; s = poa(s, { type: 'REQUEST_SUPPLY' }); expect(s.cash).toBe(before - 100);
    const requested = s.princeOfAbolition.resupply.requestedWeek!; rejectPrinceOfAbolition(s, { type: 'RECEIVE_SUPPLY' });
    s = ready(s, { afterWeek: requested }); s = poa(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.princeOfAbolition.bottles).toHaveLength(6); expect(s.princeOfAbolition.bottles.slice(0, 3).every(b => b.status === 'CONSUMED')).toBe(true);
    expect(s.princeOfAbolition.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null)).toBe(true);
    expect(validatePrinceOfAbolitionState(s)).toBe(true);
  }, 240_000);
  it('closes old actions and rejectsS0, wrong path and invented promotion state', () => {
    const s = promoted(); rejectIntent(s, { type: 'ENTROPY_DUKE', command: { type: 'LEARN_GUIDANCE' } });
    rejectIntent(s, { type: 'ENTROPY_DUKE', command: { type: 'PREPARE_ENCOUNTER' } }); rejectPrinceOfAbolition(s, dose);
    const zero = structuredClone(s); zero.progression.sequence = 0; expect(validatePrinceOfAbolitionState(zero)).toBe(false);
    const other = structuredClone(s); other.progression.pathwayId = 'sun'; expect(validatePrinceOfAbolitionState(other)).toBe(false);
    const fake = originalEntropyDuke(); fake.progression.sequence = 1; expect(validatePrinceOfAbolitionState(fake)).toBe(false);
  }, 240_000);
});

describe('PrinceOfAbolition source, dose and budget tamper rejection', () => {
  const changes: [string, (s: SliceState) => void][] = [
    ['old already given gift restored', s => { s.briber.gifts[0]!.location = 'PLAYER'; s.briber.gifts[0]!.destination = null; s.briber.gifts[0]!.givenWeek = null; }],
    ['old room travel rewrite', s => { s.frenzyMage.life.playerTravelMetres++; }],
    ['old dead body resurrected', s => { s.fallenEarl.encounter.enemyHealth = 100; }],
    ['old mastery gift', s => { s.progression.mastery['black-emperor.s7.bribery-weakening'] = 1; }],
    ['new mastery gift', s => { s.progression.mastery[PRINCE_OF_ABOLITION_ABILITY_IDS[0]] = 1; }],
    ['source stats changed to current boost', s => { s.princeOfAbolition.sourceScene!.character.coreStats = { ...s.character.coreStats }; }],
    ['source finance minted', s => { s.princeOfAbolition.sourceScene!.finance.weeklyBudget++; }],
    ['source changed to historical scene', s => { s.princeOfAbolition.sourceScene!.originals.site = structuredClone(s.entropyDuke.life.source!.snapshot); }],
    ['old original paper altered', s => { (s.frenzyMage.life.paper as { text: string }).text = '从A到C'; }],
    ['old surrendered body restored', s => { s.entropyDuke.encounter.enemyHealth = 100; }],
    ['dose check changed', s => { journal(s).at(-1)!.check!.roll++; }],
    ['paid preparation refunded', s => { journal(s).find(e => e.command.type === 'PREPARE_PROMOTION')!.after.cash++; }],
    ['free labour', s => { journal(s).find(e => e.command.type === 'POTION_WORK')!.after.actions++; }],
    ['current cash minted', s => { s.cash++; }],
    ['live original gift resurrected', s => { s.princeOfAbolition.gifts[0]!.location = 'PLAYER'; s.princeOfAbolition.gifts[0]!.destination = null; s.princeOfAbolition.gifts[0]!.givenWeek = null; }],
    ['live gift removed without actual action', s => { s.princeOfAbolition.gifts.pop(); }],
    ['new invented gift', s => { s.princeOfAbolition.gifts.push({ id: 'BR7-GIFT-16', location: 'PLAYER', destination: null, givenWeek: null }); }],
    ['receipt date outside actual world week', s => { journal(s).at(-1)!.date.year++; }],
    ['receipt fake pathway', s => { (journal(s).at(-1)!.actor as { pathwayId: string }).pathwayId = 'chained'; }],
    ['receipt fake actual promotion origin', s => { journal(s).at(-1)!.actor.entropyDukePromotionWeek = 6; }],
    ['receipt wrong draw cursor', s => { journal(s).at(-1)!.cursorBefore++; }],
    ['receipt extra hidden field', s => { (journal(s).at(-1)! as unknown as Record<string, unknown>).free = true; }],
    ['receipt gift budget changed', s => { journal(s).at(-1)!.before.gifts.pop(); }],
    ['receipt finance changed between adjacent commands', s => { journal(s).at(-1)!.finance.weeklyBudget++; }],
    ['source old history changed', s => { s.princeOfAbolition.sourceHistory!.briber.gifts.pop(); }],
    ['source old battle checksum changed', s => { s.princeOfAbolition.sourceScene!.combatHistoryDigest = '0'.repeat(64); }],
    ['identity changed', s => { s.character.gender = 'MALE'; }],
  ];
  it.each(changes)('rejects %s without mutating the reviewed state', (_name, change) => {
    const s = promoted(); change(s); const before = structuredClone(s);
    expect(validatePrinceOfAbolitionState(s)).toBe(false); expect(s).toEqual(before);
  }, 240_000);
});
