import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyLawyerCommand, createLawyerState, isLawyerAcquisitionCommand, projectLawyer,
  validateLawyerCommand, validateLawyerState,
} from '../../src/domain/lawyer/index.js';
import { LAWYER_ABILITIES, LAWYER_BOTTLE_IDS, LAWYER_FORMULA_STATUS, LAWYER_SOURCE_STATUS } from '../../src/domain/lawyer/content.js';
import { LAWYER_ABILITY_IDS, LAWYER_CASE_IDS, type LawyerAcquisitionCommand } from '../../src/domain/lawyer/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('lawyer-acquisition', sliceDefaultCreationSelection, 'lawyer-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.lawyer = createLawyerState();
  return s;
}
function context(s: SliceState, checkRoll = 20) {
  const checks: [PublicCoreStatKey, number][] = [], draws: [number, number][] = [];
  const notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll(min, max) { draws.push([min, max]); return min; },
    check(ability, difficulty) {
      checks.push([ability, difficulty]);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll });
      s.lastCheck = result;
      return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, notes };
}
function apply(s: SliceState, command: LawyerAcquisitionCommand, roll = 20) { applyLawyerCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.lawyer.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of LAWYER_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: LawyerAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Lawyer finite finished-potion acquisition', () => {
  it('starts with three independent originals and untouched private cases, without a recipe', () => {
    const s = ordinary(), p = projectLawyer(s);
    expect(validateLawyerState(s)).toBe(true);
    expect(s.lawyer.bottles.map(b => b.id)).toEqual([...LAWYER_BOTTLE_IDS]);
    expect(s.lawyer.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.lawyer.cases)).toEqual([...LAWYER_CASE_IDS]);
    expect(Object.values(s.lawyer.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.outcome === 'NONE' && !w.contactOpen && w.closes === 0)).toBe(true);
    expect(s.lawyer.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], insideCase: false, environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('lawyer-potion-');
    expect(s.lawyer).not.toHaveProperty('draft');
    const separate = createLawyerState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['ambiguous-delivery']!.contactOpen = true;
    expect(s.lawyer.bottles[0]!.labourSteps).toBe(0);
    expect(s.lawyer.cases['ambiguous-delivery']!.contactOpen).toBe(false);
  });

  it('charges one AP for discovery and one AP plus 120 pence for guidance, granting no magic', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyLawyerCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.lawyer.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(projectLawyer(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: LAWYER_BOTTLE_IDS[0] });
    applyLawyerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.lawyer.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectLawyer(s).supplies).toContain(LAWYER_FORMULA_STATUS);
    expect(projectLawyer(s).formulaKnown).toBe(false);
    expect(projectLawyer(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateLawyerState(s)).toBe(true);
  });

  it('transfers exactly one original for 660 pence at zero AP without partial labour discounts', () => {
    const s = guided(), otherBottles = JSON.stringify(s.lawyer.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: LAWYER_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: LAWYER_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.lawyer.bottles.slice(1))).toBe(otherBottles);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateLawyerState(s)).toBe(true);
  });

  it('requires both real ordinary jobs on the same bottle, then 60 pence; no learned power or pollution', () => {
    const s = guided(), bottle = s.lawyer.bottles[0]!, ctx = context(s), pollution = s.seer.pollution;
    applyLawyerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectLawyer(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyLawyerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成普通契约副本核对', '完成契约铺回执整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectLawyer(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectLawyer(s).actions.find(a => a.id === `buy-${LAWYER_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.lawyer.cases).toEqual(createLawyerState().cases);
    expect(s.seer.pollution).toBe(pollution);
    expect(validateLawyerState(s)).toBe(true);
  });

  it('rejects insufficient funds, unavailable originals and insufficient AP before mutation', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['lawyer-potion-4', 'assassin-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: LAWYER_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: LAWYER_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: LAWYER_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: LAWYER_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: LAWYER_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('opens discovery only after four full ordinary weeks, with a separately confirmed potion', () => {
    const s = ordinary();
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(validateLawyerState(s)).toBe(true);
      expect(projectLawyer(s).actions[0]!.reason).toContain(`${week - 1}/4`);
      expect(projectLawyer(s).bottles).toEqual([]);
      rejected(s, { type: 'DISCOVER' });
      rejected(s, { type: 'LEARN_GUIDANCE' });
      rejected(s, { type: 'BUY_POTION', bottleId: LAWYER_BOTTLE_IDS[0] });
    }
    s.week = 5;
    expect(projectLawyer(s).actions[0]!.enabled).toBe(true);
    guided(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[0], confirmed: false } as unknown as LawyerAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[0], confirmed: true });
    expect(s.lawyer.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateLawyerState(s)).toBe(true);
  });

  it('uses one will difficulty-five check for each of the four recoverable outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applyLawyerCommand(s, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.lawyer.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'black-emperor' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(LAWYER_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique, perception: stats.perception + 1, will: stats.will + 1, knowledge: stats.knowledge + 2 } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateLawyerState(s)).toBe(true);
    }
  });

  it('caps stat increases without refilling spirituality and preserves rejected bottles through real recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectLawyer(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 499, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.lawyer.bottles[0]!.status).toBe('CONSUMED');
    expect(validateLawyerState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: LAWYER_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.lawyer.bottles[0]).toEqual(failed.lawyer.bottles[0]);
  });

  it('retains unused originals and prevents selecting another pathway after promotion', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: LAWYER_BOTTLE_IDS[2] });
    expect(s.lawyer.bottles[1]!.status).toBe('PLAYER');
    expect(projectLawyer(s).actions.find(a => a.id === `consume-${LAWYER_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared();
    other.progression.pathwayId = 'demoness'; other.progression.sequence = 9; other.progression.promotionWeek = 5;
    rejected(other, { type: 'CONSUME', bottleId: LAWYER_BOTTLE_IDS[0], confirmed: true });
    expect(other.lawyer.bottles[0]!.status).toBe('PLAYER');
    expect(validateLawyerState(s)).toBe(true);
  });

  it('resupplies only after all failures, an explicit one-AP request, and a later real week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectLawyer(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.lawyer.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'LAWYER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.lawyer.resupply.requestedWeek, s.actionsRemaining, s.cash]).toEqual([5, 1, cash]);
    expect(s.date).toEqual(priorDate);
    expect(s.lawyer.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6);
    s.activeEvent = null; s.eventQueue = [];
    const ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'LAWYER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.lawyer.resupply.deliveries, s.lawyer.resupply.requestedWeek, s.actionsRemaining]).toEqual([1, null, ap]);
    expect(JSON.stringify(s.lawyer.bottles.slice(0, 3))).toBe(originals);
    expect(s.lawyer.bottles.slice(3).map(b => b.id)).toEqual(['lawyer-potion-4', 'lawyer-potion-5', 'lawyer-potion-6']);
    expect(s.lawyer.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    buy(s, 3);
    apply(s, { type: 'CONSUME', bottleId: 'lawyer-potion-4', confirmed: true }, 1);
    expect(s.progression.pathwayId).toBe('black-emperor');
    expect(s.lawyer.bottles[3]).toMatchObject({ status: 'CONSUMED', acquiredWeek: 6, consumedWeek: 6, outcome: 'GREAT_SUCCESS' });
    expect(validateLawyerState(s)).toBe(true);
  });

  it('rejects event, combat, city, lifecycle, health, mind and open-contact blockers without mutation', () => {
    for (const blocker of ['event', 'combat', 'city', 'dead', 'complete', 'health', 'mind', 'open-contact']) {
      const s = guided();
      if (blocker === 'event') s.activeEvent = { id: 'blocked', instanceId: 'blocked-1' };
      if (blocker === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
      if (blocker === 'city') s.world.city = 'ELSEWHERE';
      if (blocker === 'dead') s.status = 'DEAD';
      if (blocker === 'complete') s.status = 'SLICE_COMPLETE';
      if (blocker === 'health') s.health = 0;
      if (blocker === 'mind') s.mind = 0;
      if (blocker === 'open-contact') s.lawyer.cases['ambiguous-delivery']!.contactOpen = true;
      rejected(s, { type: 'BUY_POTION', bottleId: LAWYER_BOTTLE_IDS[0] });
      rejected(s, { type: 'POTION_WORK', bottleId: LAWYER_BOTTLE_IDS[0] });
      expect(projectLawyer(s).actions.every(action => !action.enabled)).toBe(true);
    }
  });

  it('validates exact commands, evidence-only reports, both methods and actual closing', () => {
    for (const command of [
      { type: 'DISCOVER' }, { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'BUY_POTION', bottleId: 'lawyer-potion-4' }, { type: 'POTION_WORK', bottleId: 'lawyer-potion-1' },
      { type: 'CONSUME', bottleId: 'lawyer-potion-1', confirmed: true },
      { type: 'OBSERVE', caseId: 'duplicated-receipt' }, { type: 'PERFORM', caseId: 'closing-counter' },
      { type: 'PREPARE', caseId: 'closing-counter', method: 'ARGUMENT' }, { type: 'PREPARE', caseId: 'duplicated-receipt', method: 'ORDINARY' },
      { type: 'CLOSE', caseId: 'ambiguous-delivery' }, { type: 'WITHDRAW', caseId: 'ambiguous-delivery' },
      { type: 'REPORT', caseId: 'ambiguous-delivery' }, { type: 'REPORT', caseId: 'closing-counter' },
    ]) expect(validateLawyerCommand(command)).toBe(true);
    expect(isLawyerAcquisitionCommand({ type: 'BUY_POTION', bottleId: 'lawyer-potion-1' })).toBe(true);
    expect(isLawyerAcquisitionCommand({ type: 'CLOSE', caseId: 'ambiguous-delivery' })).toBe(false);
    for (const command of [
      null, [], {}, { type: 'REWRITE_RULE' }, { type: 'LEARN_FORMULA' }, { type: 'BREW', batchId: 'lawyer-potion-1' },
      { type: 'DISCOVER', free: true }, { type: 'BUY_POTION', bottleId: 'lawyer-potion-0' }, { type: 'BUY_POTION', bottleId: 'lawyer-potion-01' },
      { type: 'BUY_POTION', bottleId: 'lawyer-potion-1000000000000000' }, { type: 'BUY_POTION', bottleId: 'assassin-potion-1' },
      { type: 'CONSUME', bottleId: 'lawyer-potion-1' }, { type: 'CONSUME', bottleId: 'lawyer-potion-1', confirmed: false },
      { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'duplicated-receipt', method: 'ABILITY' },
      { type: 'PREPARE', caseId: 'ambiguous-delivery', method: 'COMPEL' },
      { type: 'REPORT' }, { type: 'REPORT', caseId: 'invented' }, { type: 'REPORT', caseId: 'duplicated-receipt', claim: 'CERTAIN' },
      { type: 'REPORT', caseId: 'duplicated-receipt', claim: 'LIMITED', truth: 'known' },
      { type: 'CLOSE', caseId: 'ambiguous-delivery', immune: true }, { type: 'RETURN', caseId: 'ambiguous-delivery' },
    ]) expect(validateLawyerCommand(command)).toBe(false);
    const s = prepared();
    rejected(s, { type: 'CLOSE', caseId: 'ambiguous-delivery' } as unknown as LawyerAcquisitionCommand);
  });

  it('keeps every new scene untouched before promotion and rejects malformed exact state shapes', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(validateLawyerState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
      expect(s.lawyer.cases).toEqual(createLawyerState().cases);
      expect(projectLawyer(s).cases).toEqual([]);
    }
    for (const mutate of [
      (s: SliceState) => { s.lawyer.cases['duplicated-receipt']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.lawyer.cases['duplicated-receipt']!.attemptWeek = 5; },
      (s: SliceState) => { s.lawyer.cases['duplicated-receipt']!.withdrawals = 1; },
      (s: SliceState) => { s.lawyer.cases['duplicated-receipt']!.method = 'ARGUMENT'; },
      (s: SliceState) => { s.lawyer.cases['duplicated-receipt']!.outcome = 'RECEIPT_MATCHED'; },
      (s: SliceState) => { s.lawyer.cases['ambiguous-delivery']!.contactOpen = true; },
      (s: SliceState) => { s.lawyer.cases['ambiguous-delivery']!.closes = 1; },
      (s: SliceState) => { s.lawyer.reflected = true; },
      (s: SliceState) => { s.progression.mastery['black-emperor.s9.rule-analysis'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateLawyerState(s)).toBe(false); }
    const rawCase = (s: SliceState) => s.lawyer.cases['ambiguous-delivery'] as unknown as Record<string, unknown>;
    for (const mutate of [
      (s: SliceState) => { delete s.lawyer.cases['ambiguous-delivery']; },
      (s: SliceState) => { s.lawyer.cases['copy'] = { ...s.lawyer.cases['ambiguous-delivery']! }; },
      (s: SliceState) => { rawCase(s).status = 'IMAGINED'; },
      (s: SliceState) => { rawCase(s).method = 'MAGIC'; },
      (s: SliceState) => { rawCase(s).outcome = 'TOKEN_COVERED'; },
      (s: SliceState) => { rawCase(s).contactOpen = 'true'; },
      (s: SliceState) => { rawCase(s).tookOriginal = 'true'; },
      (s: SliceState) => { rawCase(s).attemptWeek = 4; },
      (s: SliceState) => { rawCase(s).attemptWeek = 6; },
      (s: SliceState) => { rawCase(s).withdrawals = -1; },
      (s: SliceState) => { rawCase(s).closes = -1; },
      (s: SliceState) => { rawCase(s).closes = 0.5; },
      (s: SliceState) => { rawCase(s).closes = Number.MAX_SAFE_INTEGER + 1; },
      (s: SliceState) => { rawCase(s).overclaims = 0; },
      (s: SliceState) => { rawCase(s).secret = 'unknown'; },
      (s: SliceState) => { delete rawCase(s).contactOpen; },
      (s: SliceState) => { (s.lawyer as unknown as Record<string, unknown>).draft = {}; },
      (s: SliceState) => { (s.lawyer as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateLawyerState(s)).toBe(false); }
  });

  it('rejects forged provenance, invalid bottle history, missing success and future batch dates', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.lawyer.bottles[0]!.source = 'invented'; },
      (s: SliceState) => { s.lawyer.bottles[0]!.id = 'lawyer-potion-99'; },
      (s: SliceState) => { s.lawyer.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.lawyer.bottles[0]!.acquiredWeek = 4; },
      (s: SliceState) => { s.lawyer.bottles[0]!.acquiredWeek = 6; },
      (s: SliceState) => { s.lawyer.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.lawyer.bottles[0]!.outcome = 'FAILURE'; },
      (s: SliceState) => { s.lawyer.bottles[1]!.outcome = 'SUCCESS'; },
      (s: SliceState) => { s.lawyer.guidanceKnown = false; },
      (s: SliceState) => { s.lawyer.discovered = false; },
      (s: SliceState) => { delete s.progression.mastery['black-emperor.s9.rule-analysis']; },
      (s: SliceState) => { s.progression.mastery['black-emperor.s9.rule-analysis'] = 501; },
      (s: SliceState) => { s.progression.mastery['assassin.s9.vision'] = 0; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateLawyerState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.lawyer.resupply.deliveries = 0; },
      (s: SliceState) => { s.lawyer.bottles[3]!.id = 'lawyer-potion-7'; },
      (s: SliceState) => { s.lawyer.bottles[3]!.source = s.lawyer.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.lawyer.bottles[4]!.source = s.lawyer.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.lawyer.bottles[0]!.status = 'PLAYER'; s.lawyer.bottles[0]!.outcome = null; s.lawyer.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.lawyer.bottles[3]!.status = 'PLAYER'; s.lawyer.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.lawyer.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateLawyerState(s)).toBe(false); }
    const early = guided(); early.week = 4;
    expect(validateLawyerState(early)).toBe(false);
  });

  it('separates verified sequence-nine bounds from original supply and limited practice', () => {
    expect(LAWYER_ABILITIES.map(a => a.id)).toEqual([...LAWYER_ABILITY_IDS]);
    for (const boundary of [
      '第二部第110章', '开启咒文', '第五部第87章', '规则漏洞', '对手弱点', '口才与思维能力',
      '不自动获得真相', '不强制他人服从', '不改写现实',
      '序列8野蛮人的非凡体能与精神抗性', '序列7贿赂者的贿赂', '序列6腐化男爵的扭曲均不下放',
      '原创成年契约文书员', '米蕾·沃德', '本作原创G', '不自动建立王室',
    ]) expect(LAWYER_SOURCE_STATUS).toContain(boundary);
    const s = promoted(), p = projectLawyer(s);
    expect(p.abilities).toHaveLength(3);
    expect(p.abilities.every(a => a.mastery === 0)).toBe(true);
    expect(p.risk).toContain('只适用于本次指导服药');
    expect(p.risk).toContain('停止本次交涉不会抹除已经说过的话');
    expect(p.digestion).toContain('本作原创G');
    expect(p.formula).toEqual([]);
    expect(p).not.toHaveProperty('realityRewrite');
    expect(p).not.toHaveProperty('automaticTruth');
    expect(p).not.toHaveProperty('compulsion');
    expect(p.insideCase).toBe(false);
    s.lawyer.cases['ambiguous-delivery']!.contactOpen = true;
    expect(projectLawyer(s).insideCase).toBe(true);
    expect(projectLawyer(s).actions.every(a => !a.enabled)).toBe(true);
  });
});
