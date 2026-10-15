import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyArbiterCommand, createArbiterState, isArbiterAcquisitionCommand, projectArbiter,
  validateArbiterCommand, validateArbiterState,
} from '../../src/domain/arbiter/index.js';
import { ARBITER_ABILITIES, ARBITER_BOTTLE_IDS, ARBITER_FORMULA_STATUS, ARBITER_SOURCE_STATUS } from '../../src/domain/arbiter/content.js';
import { ARBITER_ABILITY_IDS, ARBITER_CASE_IDS, type ArbiterAcquisitionCommand } from '../../src/domain/arbiter/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('arbiter-acquisition', sliceDefaultCreationSelection, 'arbiter-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.arbiter = createArbiterState();
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
function apply(s: SliceState, command: ArbiterAcquisitionCommand, roll = 20) { applyArbiterCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.arbiter.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of ARBITER_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: ArbiterAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Arbiter finite finished-potion acquisition', () => {
  it('starts with three independent originals and untouched private cases, without a recipe', () => {
    const s = ordinary(), p = projectArbiter(s);
    expect(validateArbiterState(s)).toBe(true);
    expect(s.arbiter.bottles.map(b => b.id)).toEqual([...ARBITER_BOTTLE_IDS]);
    expect(s.arbiter.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.arbiter.cases)).toEqual([...ARBITER_CASE_IDS]);
    expect(Object.values(s.arbiter.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.outcome === 'NONE' && !w.contactOpen && w.closes === 0)).toBe(true);
    expect(s.arbiter.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], insideCase: false, environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('arbiter-potion-');
    expect(s.arbiter).not.toHaveProperty('draft');
    const separate = createArbiterState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['shared-yard']!.contactOpen = true;
    expect(s.arbiter.bottles[0]!.labourSteps).toBe(0);
    expect(s.arbiter.cases['shared-yard']!.contactOpen).toBe(false);
  });

  it('charges one AP for discovery and one AP plus 120 pence for guidance, granting no magic', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyArbiterCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.arbiter.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(projectArbiter(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: ARBITER_BOTTLE_IDS[0] });
    applyArbiterCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.arbiter.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectArbiter(s).supplies).toContain(ARBITER_FORMULA_STATUS);
    expect(projectArbiter(s).formulaKnown).toBe(false);
    expect(projectArbiter(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateArbiterState(s)).toBe(true);
  });

  it('transfers exactly one original for 660 pence at zero AP without partial labour discounts', () => {
    const s = guided(), otherBottles = JSON.stringify(s.arbiter.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: ARBITER_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: ARBITER_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.arbiter.bottles.slice(1))).toBe(otherBottles);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateArbiterState(s)).toBe(true);
  });

  it('requires both real ordinary jobs on the same bottle, then 60 pence; no learned power or pollution', () => {
    const s = guided(), bottle = s.arbiter.bottles[0]!, ctx = context(s), pollution = s.seer.pollution;
    const possessions = JSON.stringify(s.town), world = JSON.stringify(s.world);
    applyArbiterCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectArbiter(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyArbiterCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成普通调解记录核对', '完成调解处预约整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectArbiter(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectArbiter(s).actions.find(a => a.id === `buy-${ARBITER_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.arbiter.cases).toEqual(createArbiterState().cases);
    expect(s.seer.pollution).toBe(pollution);
    expect(JSON.stringify(s.town)).toBe(possessions);
    expect(JSON.stringify(s.world)).toBe(world);
    expect(ctx.notes[1]!.text).toContain('不赠送材料或工具');
    expect(validateArbiterState(s)).toBe(true);
  });

  it('rejects insufficient funds, unavailable originals and insufficient AP before mutation', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['arbiter-potion-4', 'assassin-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: ARBITER_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: ARBITER_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: ARBITER_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: ARBITER_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: ARBITER_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('opens discovery only after four full ordinary weeks, with a separately confirmed potion', () => {
    const s = ordinary();
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(validateArbiterState(s)).toBe(true);
      expect(projectArbiter(s).actions[0]!.reason).toContain(`${week - 1}/4`);
      expect(projectArbiter(s).bottles).toEqual([]);
      rejected(s, { type: 'DISCOVER' });
      rejected(s, { type: 'LEARN_GUIDANCE' });
      rejected(s, { type: 'BUY_POTION', bottleId: ARBITER_BOTTLE_IDS[0] });
    }
    s.week = 5;
    expect(projectArbiter(s).actions[0]!.enabled).toBe(true);
    guided(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[0], confirmed: false } as unknown as ArbiterAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[0], confirmed: true });
    expect(s.arbiter.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateArbiterState(s)).toBe(true);
  });

  it('uses one will difficulty-five check for each of the four recoverable outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      const possessions = JSON.stringify(s.town), world = JSON.stringify(s.world);
      s.spirituality = 7;
      applyArbiterCommand(s, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.arbiter.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'justiciar' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(ARBITER_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 2, perception: stats.perception + 1, will: stats.will + 1, knowledge: stats.knowledge } : stats);
      expect(JSON.stringify(s.town)).toBe(possessions);
      expect(JSON.stringify(s.world)).toBe(world);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateArbiterState(s)).toBe(true);
    }
  });

  it('caps stat increases without refilling spirituality and preserves rejected bottles through real recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectArbiter(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.arbiter.bottles[0]!.status).toBe('CONSUMED');
    expect(validateArbiterState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: ARBITER_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.arbiter.bottles[0]).toEqual(failed.arbiter.bottles[0]);
  });

  it('retains unused originals and prevents selecting another pathway after promotion', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: ARBITER_BOTTLE_IDS[2] });
    expect(s.arbiter.bottles[1]!.status).toBe('PLAYER');
    expect(projectArbiter(s).actions.find(a => a.id === `consume-${ARBITER_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared();
    other.progression.pathwayId = 'demoness'; other.progression.sequence = 9; other.progression.promotionWeek = 5;
    rejected(other, { type: 'CONSUME', bottleId: ARBITER_BOTTLE_IDS[0], confirmed: true });
    expect(other.arbiter.bottles[0]!.status).toBe('PLAYER');
    expect(validateArbiterState(s)).toBe(true);
  });

  it('resupplies only after all failures, an explicit one-AP request, and a later real week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectArbiter(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.arbiter.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'ARBITER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.arbiter.resupply.requestedWeek, s.actionsRemaining, s.cash]).toEqual([5, 1, cash]);
    expect(s.date).toEqual(priorDate);
    expect(s.arbiter.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6);
    s.activeEvent = null; s.eventQueue = [];
    const ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'ARBITER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.arbiter.resupply.deliveries, s.arbiter.resupply.requestedWeek, s.actionsRemaining]).toEqual([1, null, ap]);
    expect(JSON.stringify(s.arbiter.bottles.slice(0, 3))).toBe(originals);
    expect(s.arbiter.bottles.slice(3).map(b => b.id)).toEqual(['arbiter-potion-4', 'arbiter-potion-5', 'arbiter-potion-6']);
    expect(s.arbiter.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    buy(s, 3);
    apply(s, { type: 'CONSUME', bottleId: 'arbiter-potion-4', confirmed: true }, 1);
    expect(s.progression.pathwayId).toBe('justiciar');
    expect(s.arbiter.bottles[3]).toMatchObject({ status: 'CONSUMED', acquiredWeek: 6, consumedWeek: 6, outcome: 'GREAT_SUCCESS' });
    expect(validateArbiterState(s)).toBe(true);
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
      if (blocker === 'open-contact') s.arbiter.cases['shared-yard']!.contactOpen = true;
      rejected(s, { type: 'BUY_POTION', bottleId: ARBITER_BOTTLE_IDS[0] });
      rejected(s, { type: 'POTION_WORK', bottleId: ARBITER_BOTTLE_IDS[0] });
      expect(projectArbiter(s).actions.every(action => !action.enabled)).toBe(true);
    }
  });

  it('validates exact commands, evidence-only reports, both methods and actual closing', () => {
    for (const command of [
      { type: 'DISCOVER' }, { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'BUY_POTION', bottleId: 'arbiter-potion-4' }, { type: 'POTION_WORK', bottleId: 'arbiter-potion-1' },
      { type: 'CONSUME', bottleId: 'arbiter-potion-1', confirmed: true },
      { type: 'OBSERVE', caseId: 'noisy-work' }, { type: 'PERFORM', caseId: 'exit-dispute' },
      { type: 'PREPARE', caseId: 'exit-dispute', method: 'AUTHORITY' }, { type: 'PREPARE', caseId: 'noisy-work', method: 'ORDINARY' },
      { type: 'CLOSE', caseId: 'shared-yard' }, { type: 'WITHDRAW', caseId: 'shared-yard' },
      { type: 'REPORT', caseId: 'shared-yard' }, { type: 'REPORT', caseId: 'exit-dispute' },
    ]) expect(validateArbiterCommand(command)).toBe(true);
    expect(isArbiterAcquisitionCommand({ type: 'BUY_POTION', bottleId: 'arbiter-potion-1' })).toBe(true);
    expect(isArbiterAcquisitionCommand({ type: 'CLOSE', caseId: 'shared-yard' })).toBe(false);
    for (const command of [
      null, [], {}, { type: 'REWRITE_RULE' }, { type: 'PROHIBIT' }, { type: 'ASSIGN_GUILT' }, { type: 'LEARN_FORMULA' }, { type: 'BREW', batchId: 'arbiter-potion-1' },
      { type: 'DISCOVER', free: true }, { type: 'BUY_POTION', bottleId: 'arbiter-potion-0' }, { type: 'BUY_POTION', bottleId: 'arbiter-potion-01' },
      { type: 'BUY_POTION', bottleId: 'arbiter-potion-1000000000000000' }, { type: 'BUY_POTION', bottleId: 'assassin-potion-1' },
      { type: 'CONSUME', bottleId: 'arbiter-potion-1' }, { type: 'CONSUME', bottleId: 'arbiter-potion-1', confirmed: false },
      { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'noisy-work', method: 'ABILITY' },
      { type: 'PREPARE', caseId: 'shared-yard', method: 'COMPEL' }, { type: 'PREPARE', caseId: 'shared-yard', method: 'ARGUMENT' },
      { type: 'REPORT' }, { type: 'REPORT', caseId: 'invented' }, { type: 'REPORT', caseId: 'noisy-work', claim: 'CERTAIN' },
      { type: 'REPORT', caseId: 'noisy-work', claim: 'LIMITED', truth: 'known' },
      { type: 'CLOSE', caseId: 'shared-yard', immune: true }, { type: 'RETURN', caseId: 'shared-yard' },
    ]) expect(validateArbiterCommand(command)).toBe(false);
    const s = prepared();
    rejected(s, { type: 'CLOSE', caseId: 'shared-yard' } as unknown as ArbiterAcquisitionCommand);
  });

  it('keeps every new scene untouched before promotion and rejects malformed exact state shapes', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(validateArbiterState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
      expect(s.arbiter.cases).toEqual(createArbiterState().cases);
      expect(projectArbiter(s).cases).toEqual([]);
    }
    for (const mutate of [
      (s: SliceState) => { s.arbiter.cases['noisy-work']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.arbiter.cases['noisy-work']!.attemptWeek = 5; },
      (s: SliceState) => { s.arbiter.cases['noisy-work']!.withdrawals = 1; },
      (s: SliceState) => { s.arbiter.cases['noisy-work']!.method = 'AUTHORITY'; },
      (s: SliceState) => { s.arbiter.cases['noisy-work']!.outcome = 'VOLUME_AGREED'; },
      (s: SliceState) => { s.arbiter.cases['shared-yard']!.contactOpen = true; },
      (s: SliceState) => { s.arbiter.cases['shared-yard']!.closes = 1; },
      (s: SliceState) => { s.arbiter.reflected = true; },
      (s: SliceState) => { s.progression.mastery['justiciar.s9.authority'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateArbiterState(s)).toBe(false); }
    const rawCase = (s: SliceState) => s.arbiter.cases['shared-yard'] as unknown as Record<string, unknown>;
    for (const mutate of [
      (s: SliceState) => { delete s.arbiter.cases['shared-yard']; },
      (s: SliceState) => { s.arbiter.cases['copy'] = { ...s.arbiter.cases['shared-yard']! }; },
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
      (s: SliceState) => { (s.arbiter as unknown as Record<string, unknown>).draft = {}; },
      (s: SliceState) => { (s.arbiter as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateArbiterState(s)).toBe(false); }
  });

  it('rejects forged provenance, invalid bottle history, missing success and future batch dates', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.arbiter.bottles[0]!.source = 'invented'; },
      (s: SliceState) => { s.arbiter.bottles[0]!.id = 'arbiter-potion-99'; },
      (s: SliceState) => { s.arbiter.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.arbiter.bottles[0]!.acquiredWeek = 4; },
      (s: SliceState) => { s.arbiter.bottles[0]!.acquiredWeek = 6; },
      (s: SliceState) => { s.arbiter.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.arbiter.bottles[0]!.outcome = 'FAILURE'; },
      (s: SliceState) => { s.arbiter.bottles[1]!.outcome = 'SUCCESS'; },
      (s: SliceState) => { s.arbiter.guidanceKnown = false; },
      (s: SliceState) => { s.arbiter.discovered = false; },
      (s: SliceState) => { delete s.progression.mastery['justiciar.s9.authority']; },
      (s: SliceState) => { s.progression.mastery['justiciar.s9.authority'] = 501; },
      (s: SliceState) => { s.progression.mastery['assassin.s9.vision'] = 0; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateArbiterState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.arbiter.resupply.deliveries = 0; },
      (s: SliceState) => { s.arbiter.bottles[3]!.id = 'arbiter-potion-7'; },
      (s: SliceState) => { s.arbiter.bottles[3]!.source = s.arbiter.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.arbiter.bottles[4]!.source = s.arbiter.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.arbiter.bottles[0]!.status = 'PLAYER'; s.arbiter.bottles[0]!.outcome = null; s.arbiter.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.arbiter.bottles[3]!.status = 'PLAYER'; s.arbiter.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.arbiter.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateArbiterState(s)).toBe(false); }
    const early = guided(); early.week = 4;
    expect(validateArbiterState(early)).toBe(false);
  });

  it('separates verified sequence-nine bounds from original supply and limited practice', () => {
    expect(ARBITER_ABILITIES.map(a => a.id)).toEqual([...ARBITER_ABILITY_IDS]);
    for (const boundary of [
      '第一部第114章', '成员的标准', '令人信服的魅力', '权威', '出色格斗能力',
      '命令不等于必须服从', '不自动判定法律罪责', '不改写现实',
      '序列8治安官的图像追踪与有条件感应', '序列7审讯者的精神刺穿与审讯', '序列6法官的禁止均不下放',
      '原创成年民间调解文书员', '薇娜·贝尔', '本作原创G', '不自动建立王室',
      '不任命玩家为官方人员',
    ]) expect(ARBITER_SOURCE_STATUS).toContain(boundary);
    const s = promoted(), p = projectArbiter(s);
    expect(p.abilities).toHaveLength(3);
    expect(p.abilities.every(a => a.mastery === 0)).toBe(true);
    expect(p.risk).toContain('只适用于本次指导服药');
    expect(p.risk).toContain('停止本次交涉不会抹除已经说过的话');
    expect(p.digestion).toContain('本作原创G');
    expect(p.formula).toEqual([]);
    expect(p).not.toHaveProperty('realityRewrite');
    expect(p).not.toHaveProperty('automaticTruth');
    expect(p).not.toHaveProperty('compulsion');
    expect(p).not.toHaveProperty('officialAppointment');
    expect(p).not.toHaveProperty('automaticGuilt');
    expect(p.insideCase).toBe(false);
    s.arbiter.cases['shared-yard']!.contactOpen = true;
    expect(projectArbiter(s).insideCase).toBe(true);
    expect(projectArbiter(s).actions.every(a => !a.enabled)).toBe(true);
  });
});
