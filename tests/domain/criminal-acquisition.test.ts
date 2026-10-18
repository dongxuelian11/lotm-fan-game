import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyCriminalCommand, createCriminalState, isCriminalAcquisitionCommand, projectCriminal,
  validateCriminalCommand, validateCriminalState,
} from '../../src/domain/criminal/index.js';
import { CRIMINAL_ABILITIES, CRIMINAL_BOTTLE_IDS, CRIMINAL_FORMULA_STATUS, CRIMINAL_SOURCE_STATUS } from '../../src/domain/criminal/content.js';
import { CRIMINAL_ABILITY_IDS, CRIMINAL_CASE_IDS, type CriminalAcquisitionCommand } from '../../src/domain/criminal/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('criminal-acquisition', sliceDefaultCreationSelection, 'criminal-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.criminal = createCriminalState();
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
function apply(s: SliceState, command: CriminalAcquisitionCommand, roll = 20) { applyCriminalCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.criminal.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of CRIMINAL_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: CriminalAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Criminal finite finished-potion acquisition', () => {
  it('starts with three independent originals and untouched private cases, without a recipe', () => {
    const s = ordinary(), p = projectCriminal(s);
    expect(validateCriminalState(s)).toBe(true);
    expect(s.criminal.bottles.map(b => b.id)).toEqual([...CRIMINAL_BOTTLE_IDS]);
    expect(s.criminal.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.criminal.cases)).toEqual([...CRIMINAL_CASE_IDS]);
    expect(Object.values(s.criminal.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.outcome === 'NONE' && !w.holding && !w.tookOriginal && w.returns === 0)).toBe(true);
    expect(s.criminal.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], insideCase: false, environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('criminal-potion-');
    expect(s.criminal).not.toHaveProperty('draft');
    const separate = createCriminalState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['found-pay']!.holding = true;
    expect(s.criminal.bottles[0]!.labourSteps).toBe(0);
    expect(s.criminal.cases['found-pay']!.holding).toBe(false);
  });

  it('charges one AP for discovery and one AP plus 120 pence for guidance, granting no magic', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyCriminalCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.criminal.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(projectCriminal(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: CRIMINAL_BOTTLE_IDS[0] });
    applyCriminalCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.criminal.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectCriminal(s).supplies).toContain(CRIMINAL_FORMULA_STATUS);
    expect(projectCriminal(s).formulaKnown).toBe(false);
    expect(projectCriminal(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateCriminalState(s)).toBe(true);
  });

  it('transfers exactly one original for 660 pence at zero AP without partial labour discounts', () => {
    const s = guided(), otherBottles = JSON.stringify(s.criminal.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: CRIMINAL_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: CRIMINAL_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.criminal.bottles.slice(1))).toBe(otherBottles);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateCriminalState(s)).toBe(true);
  });

  it('requires both real ordinary jobs on the same bottle, then 60 pence; no learned power or pollution', () => {
    const s = guided(), bottle = s.criminal.bottles[0]!, ctx = context(s), pollution = s.seer.pollution;
    applyCriminalCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectCriminal(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyCriminalCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成普通旧物编号核对', '完成货架与空箱整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectCriminal(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectCriminal(s).actions.find(a => a.id === `buy-${CRIMINAL_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.criminal.cases).toEqual(createCriminalState().cases);
    expect(s.seer.pollution).toBe(pollution);
    expect(validateCriminalState(s)).toBe(true);
  });

  it('rejects insufficient funds, unavailable originals and insufficient AP before mutation', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['criminal-potion-4', 'assassin-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: CRIMINAL_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: CRIMINAL_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: CRIMINAL_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: CRIMINAL_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: CRIMINAL_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('permits preparation early, but requires four completed ordinary weeks and independent confirmation', () => {
    const s = ordinary(); s.week = 1; guided(s); buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectCriminal(s).actions.find(a => a.id === `consume-${CRIMINAL_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: false } as unknown as CriminalAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: true });
    expect(s.criminal.bottles[0]).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateCriminalState(s)).toBe(true);
  });

  it('uses one will difficulty-five check for each of the four recoverable outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applyCriminalCommand(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.criminal.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'abyss' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(CRIMINAL_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 2, perception: stats.perception + 1, will: stats.will, knowledge: stats.knowledge + 1 } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateCriminalState(s)).toBe(true);
    }
  });

  it('caps stat increases without refilling spirituality and preserves rejected bottles through real recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectCriminal(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.criminal.bottles[0]!.status).toBe('CONSUMED');
    expect(validateCriminalState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: CRIMINAL_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.criminal.bottles[0]).toEqual(failed.criminal.bottles[0]);
  });

  it('retains unused originals and prevents selecting another pathway after promotion', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: CRIMINAL_BOTTLE_IDS[2] });
    expect(s.criminal.bottles[1]!.status).toBe('PLAYER');
    expect(projectCriminal(s).actions.find(a => a.id === `consume-${CRIMINAL_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared();
    other.progression.pathwayId = 'demoness'; other.progression.sequence = 9; other.progression.promotionWeek = 5;
    rejected(other, { type: 'CONSUME', bottleId: CRIMINAL_BOTTLE_IDS[0], confirmed: true });
    expect(other.criminal.bottles[0]!.status).toBe('PLAYER');
    expect(validateCriminalState(s)).toBe(true);
  });

  it('resupplies only after all failures, an explicit one-AP request, and a later real week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectCriminal(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.criminal.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'CRIMINAL', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.criminal.resupply.requestedWeek, s.actionsRemaining, s.cash]).toEqual([5, 1, cash]);
    expect(s.date).toEqual(priorDate);
    expect(s.criminal.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6);
    s.activeEvent = null; s.eventQueue = [];
    const ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'CRIMINAL', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.criminal.resupply.deliveries, s.criminal.resupply.requestedWeek, s.actionsRemaining]).toEqual([1, null, ap]);
    expect(JSON.stringify(s.criminal.bottles.slice(0, 3))).toBe(originals);
    expect(s.criminal.bottles.slice(3).map(b => b.id)).toEqual(['criminal-potion-4', 'criminal-potion-5', 'criminal-potion-6']);
    expect(s.criminal.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    buy(s, 3);
    apply(s, { type: 'CONSUME', bottleId: 'criminal-potion-4', confirmed: true }, 1);
    expect(s.progression.pathwayId).toBe('abyss');
    expect(s.criminal.bottles[3]).toMatchObject({ status: 'CONSUMED', acquiredWeek: 6, consumedWeek: 6, outcome: 'GREAT_SUCCESS' });
    expect(validateCriminalState(s)).toBe(true);
  });

  it('rejects event, combat, city, lifecycle, health, mind and held-original blockers without mutation', () => {
    for (const blocker of ['event', 'combat', 'city', 'dead', 'complete', 'health', 'mind', 'held-original']) {
      const s = guided();
      if (blocker === 'event') s.activeEvent = { id: 'blocked', instanceId: 'blocked-1' };
      if (blocker === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
      if (blocker === 'city') s.world.city = 'ELSEWHERE';
      if (blocker === 'dead') s.status = 'DEAD';
      if (blocker === 'complete') s.status = 'SLICE_COMPLETE';
      if (blocker === 'health') s.health = 0;
      if (blocker === 'mind') s.mind = 0;
      if (blocker === 'held-original') s.criminal.cases['found-pay']!.holding = true;
      rejected(s, { type: 'BUY_POTION', bottleId: CRIMINAL_BOTTLE_IDS[0] });
      rejected(s, { type: 'POTION_WORK', bottleId: CRIMINAL_BOTTLE_IDS[0] });
      expect(projectCriminal(s).actions.every(action => !action.enabled)).toBe(true);
    }
  });

  it('validates exact commands, all preparation methods and actual return', () => {
    for (const command of [
      { type: 'DISCOVER' }, { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'BUY_POTION', bottleId: 'criminal-potion-4' }, { type: 'POTION_WORK', bottleId: 'criminal-potion-1' },
      { type: 'CONSUME', bottleId: 'criminal-potion-1', confirmed: true },
      { type: 'OBSERVE', caseId: 'hasty-job' }, { type: 'PERFORM', caseId: 'jammed-cart' },
      { type: 'PREPARE', caseId: 'jammed-cart', method: 'ABILITY' }, { type: 'PREPARE', caseId: 'hasty-job', method: 'ORDINARY' },
      { type: 'RETURN', caseId: 'found-pay' }, { type: 'WITHDRAW', caseId: 'found-pay' },
      { type: 'REPORT', caseId: 'found-pay' }, { type: 'REPORT', caseId: 'jammed-cart' },
      { type: 'PREPARE', caseId: 'found-pay', method: 'TAKE' },
    ]) expect(validateCriminalCommand(command)).toBe(true);
    expect(isCriminalAcquisitionCommand({ type: 'BUY_POTION', bottleId: 'criminal-potion-1' })).toBe(true);
    expect(isCriminalAcquisitionCommand({ type: 'RETURN', caseId: 'found-pay' })).toBe(false);
    for (const command of [
      null, [], {}, { type: 'READ_MIND' }, { type: 'LEARN_FORMULA' }, { type: 'BREW', batchId: 'criminal-potion-1' },
      { type: 'DISCOVER', free: true }, { type: 'BUY_POTION', bottleId: 'criminal-potion-0' }, { type: 'BUY_POTION', bottleId: 'criminal-potion-01' },
      { type: 'BUY_POTION', bottleId: 'criminal-potion-1000000000000000' }, { type: 'BUY_POTION', bottleId: 'assassin-potion-1' },
      { type: 'CONSUME', bottleId: 'criminal-potion-1' }, { type: 'CONSUME', bottleId: 'criminal-potion-1', confirmed: false },
      { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'hasty-job', method: 'SKILL' },
      { type: 'REPORT' }, { type: 'REPORT', caseId: 'hasty-job', claim: 'COMPLETE' },
      { type: 'RETURN', caseId: 'found-pay', immune: true },
    ]) expect(validateCriminalCommand(command)).toBe(false);
    const s = prepared();
    rejected(s, { type: 'RETURN', caseId: 'found-pay' } as unknown as CriminalAcquisitionCommand);
  });

  it('keeps every new scene untouched before promotion and rejects malformed exact state shapes', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(validateCriminalState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
      expect(s.criminal.cases).toEqual(createCriminalState().cases);
      expect(projectCriminal(s).cases).toEqual([]);
    }
    for (const mutate of [
      (s: SliceState) => { s.criminal.cases['hasty-job']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.criminal.cases['hasty-job']!.attemptWeek = 5; },
      (s: SliceState) => { s.criminal.cases['hasty-job']!.withdrawals = 1; },
      (s: SliceState) => { s.criminal.cases['hasty-job']!.method = 'ABILITY'; },
      (s: SliceState) => { s.criminal.cases['hasty-job']!.outcome = 'JOB_DECLINED'; },
      (s: SliceState) => { s.criminal.cases['found-pay']!.holding = true; },
      (s: SliceState) => { s.criminal.cases['found-pay']!.tookOriginal = true; },
      (s: SliceState) => { s.criminal.cases['found-pay']!.returns = 1; },
      (s: SliceState) => { s.criminal.reflected = true; },
      (s: SliceState) => { s.progression.mastery['abyss.s9.brute-force'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateCriminalState(s)).toBe(false); }
    const rawCase = (s: SliceState) => s.criminal.cases['found-pay'] as unknown as Record<string, unknown>;
    for (const mutate of [
      (s: SliceState) => { delete s.criminal.cases['found-pay']; },
      (s: SliceState) => { s.criminal.cases['copy'] = { ...s.criminal.cases['found-pay']! }; },
      (s: SliceState) => { rawCase(s).status = 'IMAGINED'; },
      (s: SliceState) => { rawCase(s).method = 'MAGIC'; },
      (s: SliceState) => { rawCase(s).outcome = 'TOKEN_COVERED'; },
      (s: SliceState) => { rawCase(s).holding = 'true'; },
      (s: SliceState) => { rawCase(s).tookOriginal = 'true'; },
      (s: SliceState) => { delete rawCase(s).tookOriginal; },
      (s: SliceState) => { s.criminal.cases['hasty-job']!.tookOriginal = true; },
      (s: SliceState) => { s.criminal.cases['jammed-cart']!.returns = 1; },
      (s: SliceState) => { s.criminal.cases['hasty-job']!.holding = true; },
      (s: SliceState) => { rawCase(s).attemptWeek = 4; },
      (s: SliceState) => { rawCase(s).attemptWeek = 6; },
      (s: SliceState) => { rawCase(s).withdrawals = -1; },
      (s: SliceState) => { rawCase(s).returns = -1; },
      (s: SliceState) => { rawCase(s).returns = 0.5; },
      (s: SliceState) => { rawCase(s).returns = Number.MAX_SAFE_INTEGER + 1; },
      (s: SliceState) => { rawCase(s).secret = 'unknown'; },
      (s: SliceState) => { delete rawCase(s).holding; },
      (s: SliceState) => { (s.criminal as unknown as Record<string, unknown>).draft = {}; },
      (s: SliceState) => { (s.criminal as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateCriminalState(s)).toBe(false); }
  });

  it('rejects forged provenance, invalid bottle history, missing success and future batch dates', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.criminal.bottles[0]!.source = 'invented'; },
      (s: SliceState) => { s.criminal.bottles[0]!.id = 'criminal-potion-99'; },
      (s: SliceState) => { s.criminal.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.criminal.bottles[0]!.acquiredWeek = 6; },
      (s: SliceState) => { s.criminal.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.criminal.bottles[0]!.outcome = 'FAILURE'; },
      (s: SliceState) => { s.criminal.bottles[1]!.outcome = 'SUCCESS'; },
      (s: SliceState) => { s.criminal.guidanceKnown = false; },
      (s: SliceState) => { s.criminal.discovered = false; },
      (s: SliceState) => { delete s.progression.mastery['abyss.s9.brute-force']; },
      (s: SliceState) => { s.progression.mastery['abyss.s9.brute-force'] = 501; },
      (s: SliceState) => { s.progression.mastery['assassin.s9.vision'] = 0; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateCriminalState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.criminal.resupply.deliveries = 0; },
      (s: SliceState) => { s.criminal.bottles[3]!.id = 'criminal-potion-7'; },
      (s: SliceState) => { s.criminal.bottles[3]!.source = s.criminal.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.criminal.bottles[4]!.source = s.criminal.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.criminal.bottles[0]!.status = 'PLAYER'; s.criminal.bottles[0]!.outcome = null; s.criminal.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.criminal.bottles[3]!.status = 'PLAYER'; s.criminal.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.criminal.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateCriminalState(s)).toBe(false); }
  });

  it('separates verified sequence-nine ability bounds from original G acting and supply', () => {
    expect(CRIMINAL_ABILITIES.map(a => a.id)).toEqual([...CRIMINAL_ABILITY_IDS]);
    expect(CRIMINAL_SOURCE_STATUS).toContain('第二部第45章');
    expect(CRIMINAL_SOURCE_STATUS).toContain('强健的身体、敏锐的直觉与犯罪相关才能');
    expect(CRIMINAL_SOURCE_STATUS).toContain('良知尚未泯灭');
    expect(CRIMINAL_SOURCE_STATUS).toContain('序列8');
    expect(CRIMINAL_SOURCE_STATUS).toContain('未逐一命名的魔类法术不下放');
    expect(CRIMINAL_SOURCE_STATUS).toContain('序列6恶魔的致命危险预知');
    expect(CRIMINAL_SOURCE_STATUS).toContain('毒素免疫、火焰与诅咒');
    expect(CRIMINAL_SOURCE_STATUS).toContain('敏锐直觉不是预知未来');
    expect(CRIMINAL_SOURCE_STATUS).toContain('原创成年旧货管理员');
    expect(CRIMINAL_SOURCE_STATUS).toContain('本作G扮演解释');
    expect(CRIMINAL_SOURCE_STATUS).toContain('不是原著保证善举可以无痛消化');
    expect(CRIMINAL_SOURCE_STATUS).toContain('后续序列7');
    expect(CRIMINAL_SOURCE_STATUS).toContain('不提供现实犯罪操作方法');
    const p = projectCriminal(promoted());
    expect(p.abilities).toHaveLength(3);
    expect(p.abilities.every(a => a.mastery === 0)).toBe(true);
    expect(p.risk).toContain('只适用于本次指导服药');
    expect(p.risk).toContain('序列9良知尚未泯灭');
    expect(p.digestion).toContain('本作原创G');
    expect(p.formula).toEqual([]);
    expect(p).not.toHaveProperty('dangerForecast');
  });
});
