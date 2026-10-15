import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import {
  applyWarriorCommand, createWarriorState, isWarriorAcquisitionCommand, projectWarrior,
  validateWarriorCommand, validateWarriorState,
} from '../../src/domain/warrior/index.js';
import { WARRIOR_ABILITIES, WARRIOR_BOTTLE_IDS, WARRIOR_FORMULA_STATUS, WARRIOR_PRACTICE_CLUB, WARRIOR_SOURCE_STATUS } from '../../src/domain/warrior/content.js';
import { WARRIOR_ABILITY_IDS, WARRIOR_CASE_IDS, type WarriorAcquisitionCommand } from '../../src/domain/warrior/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('warrior-acquisition', sliceDefaultCreationSelection, 'warrior-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.warrior = createWarriorState();
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
function apply(s: SliceState, command: WarriorAcquisitionCommand, roll = 20) { applyWarriorCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.warrior.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of WARRIOR_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() {
  const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s;
}
function rejected(s: SliceState, command: WarriorAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Warrior finite finished-potion acquisition', () => {
  it('starts with three separate originals and untouched case state, exposing no undiscovered inventory', () => {
    const s = ordinary(), p = projectWarrior(s);
    expect(validateWarriorState(s)).toBe(true);
    expect(s.warrior.bottles.map(b => b.id)).toEqual([...WARRIOR_BOTTLE_IDS]);
    expect(s.warrior.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.warrior.cases)).toEqual([...WARRIOR_CASE_IDS]);
    expect(Object.values(s.warrior.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.outcome === 'NONE')).toBe(true);
    expect(s.warrior.reflected).toBe(false);
    expect(s.warrior.practiceClub).toEqual(WARRIOR_PRACTICE_CLUB);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], tool: null, environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('warrior-potion-');
    const separate = createWarriorState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['staff-drill']!.status = 'OBSERVED';
    separate.practiceClub.custodian = 'PLAYER';
    expect(s.warrior.bottles[0]!.labourSteps).toBe(0);
    expect(s.warrior.cases['staff-drill']!.status).toBe('AVAILABLE');
    expect(s.warrior.practiceClub.custodian).toBe('MENTOR');
  });

  it('charges discovery and guidance exactly, without magic, organization membership or a recipe', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyWarriorCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.warrior.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(projectWarrior(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: WARRIOR_BOTTLE_IDS[0] });
    applyWarriorCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.warrior.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectWarrior(s).supplies).toContain(WARRIOR_FORMULA_STATUS);
    expect(projectWarrior(s).formulaKnown).toBe(false);
    expect(projectWarrior(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateWarriorState(s)).toBe(true);
  });

  it('buys only the selected original for 660 pence and zero AP, with no partial labour discount', () => {
    const s = guided(), untouched = JSON.stringify(s.warrior.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: WARRIOR_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: WARRIOR_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.warrior.bottles.slice(1))).toBe(untouched);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateWarriorState(s)).toBe(true);
  });

  it('requires two real one-AP jobs on the same bottle, then 60 pence to transfer that original', () => {
    const s = guided(), bottle = s.warrior.bottles[0]!, ctx = context(s);
    applyWarriorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectWarrior(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyWarriorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成训练场器械点验', '完成沙袋与支架整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectWarrior(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectWarrior(s).actions.find(a => a.id === `buy-${WARRIOR_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.warrior.cases).toEqual(createWarriorState().cases);
    expect(validateWarriorState(s)).toBe(true);
  });

  it('rejects insufficient funds, unowned or foreign bottles and AP-consuming preparation atomically', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['warrior-potion-4', 'hunter-potion-1', 'savant-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: WARRIOR_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: WARRIOR_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: WARRIOR_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: WARRIOR_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: WARRIOR_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('allows early preparation but requires four completed ordinary weeks and independent confirmation', () => {
    const s = ordinary(); s.week = 1; guided(s); buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectWarrior(s).actions.find(a => a.id === `consume-${WARRIOR_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: false } as unknown as WarriorAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.warrior.bottles[0]).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateWarriorState(s)).toBe(true);
  });

  it('uses exactly one will difficulty-five check for all four recoverable promotion outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applyWarriorCommand(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.warrior.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'warrior' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(WARRIOR_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 4, perception: stats.perception + 1, will: stats.will + 1, knowledge: stats.knowledge } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateWarriorState(s)).toBe(true);
    }
  });

  it('never refills spirituality, caps enhanced stats, and preserves severe rejection for actual recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectWarrior(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.warrior.bottles[0]!.status).toBe('CONSUMED');
    expect(validateWarriorState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: WARRIOR_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.warrior.bottles[0]).toEqual(failed.warrior.bottles[0]);
  });

  it('retains unused originals and blocks second promotion or changing an already chosen pathway', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: WARRIOR_BOTTLE_IDS[2] });
    expect(s.warrior.bottles[1]!.status).toBe('PLAYER');
    expect(projectWarrior(s).actions.find(a => a.id === `consume-${WARRIOR_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared(), c = context(other).c;
    applySeerCommand(other, { type: 'DISCOVER' }, c);
    applySeerCommand(other, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(other, { type: 'BUY_MATERIALS', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'BREW', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'CONSUME', bottleId: other.seer.bottles[0]!.id, confirmed: true }, c);
    expect(other.progression.pathwayId).toBe('diviner');
    rejected(other, { type: 'CONSUME', bottleId: WARRIOR_BOTTLE_IDS[0], confirmed: true });
    expect(other.warrior.bottles[0]!.status).toBe('PLAYER');
    expect(validateWarriorState(other)).toBe(true);
    expect(validateWarriorState(s)).toBe(true);
  });

  it('only resupplies after all failures, an explicit paid-AP request, and a later actual week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectWarrior(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.warrior.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const requestCash = s.cash;
    s = applySliceIntent(s, { type: 'WARRIOR', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.warrior.resupply.requestedWeek]).toEqual([5, 1, requestCash, 5]);
    expect(JSON.stringify(s.warrior.bottles)).toBe(originals);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6); expect(s.date).not.toEqual(priorDate);
    expect(s.warrior.bottles).toHaveLength(3);
    const cash = s.cash, ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'WARRIOR', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap]);
    expect(s.warrior.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.warrior.bottles.slice(3).map(b => b.id)).toEqual(['warrior-potion-4', 'warrior-potion-5', 'warrior-potion-6']);
    expect(s.warrior.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    expect(JSON.stringify(s.warrior.bottles.slice(0, 3))).toBe(originals);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'warrior-potion-4', confirmed: true });
    buy(s, 3);
    expect(s.cash).toBe(cash - 660);
    apply(s, { type: 'CONSUME', bottleId: 'warrior-potion-4', confirmed: true });
    expect(s.progression.pathwayId).toBe('warrior');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.warrior.bottles.slice(0, 3))).toBe(originals);
    expect(validateWarriorState(s)).toBe(true);
  });

  it('rejects event, combat, city, lifecycle, health and mind blockers before changing any state', () => {
    for (const blocker of ['event', 'combat', 'city', 'dead', 'complete', 'health', 'mind']) {
      const s = guided();
      if (blocker === 'event') s.activeEvent = { id: 'blocked', instanceId: 'blocked-1' };
      if (blocker === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
      if (blocker === 'city') s.world.city = 'ELSEWHERE';
      if (blocker === 'dead') s.status = 'DEAD';
      if (blocker === 'complete') s.status = 'SLICE_COMPLETE';
      if (blocker === 'health') s.health = 0;
      if (blocker === 'mind') s.mind = 0;
      rejected(s, { type: 'BUY_POTION', bottleId: WARRIOR_BOTTLE_IDS[0] });
    }
  });

  it('conserves every earlier batch through a second requested delivery, without inherited labour credit', () => {
    const s = resupplied();
    s.health = 100; s.mind = 100;
    for (let index = 3; index < 6; index += 1) buy(s, index);
    for (const bottle of s.warrior.bottles.slice(3)) apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    const earlier = JSON.stringify(s.warrior.bottles), cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 7;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.warrior.resupply).toEqual({ requestedWeek: null, deliveries: 2 });
    expect(JSON.stringify(s.warrior.bottles.slice(0, 6))).toBe(earlier);
    expect(s.warrior.bottles.slice(6).map(bottle => bottle.id)).toEqual(['warrior-potion-7', 'warrior-potion-8', 'warrior-potion-9']);
    expect(s.warrior.bottles.slice(6).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第7周实收入库'))).toBe(true);
    expect(s.cash).toBe(cash);
    expect(s.seer.pollution).toBe(100);
    expect(validateWarriorState(s)).toBe(true);
    apply(s, { type: 'POTION_WORK', bottleId: 'warrior-potion-7' });
    apply(s, { type: 'POTION_WORK', bottleId: 'warrior-potion-7' });
    buy(s, 6);
    expect(s.cash).toBe(cash - 60);
    expect(projectWarrior(s).actions.find(action => action.id === 'buy-warrior-potion-8')!.cost).toContain('660便士');
    expect(validateWarriorState(s)).toBe(true);
  });

  it('accepts exact acquisition, activity and no-argument tool-return commands only', () => {
    for (const type of ['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'RETURN_TOOL']) expect(validateWarriorCommand({ type })).toBe(true);
    for (const type of ['POTION_WORK', 'BUY_POTION']) expect(validateWarriorCommand({ type, bottleId: 'warrior-potion-4' })).toBe(true);
    expect(validateWarriorCommand({ type: 'CONSUME', bottleId: 'warrior-potion-1', confirmed: true })).toBe(true);
    for (const caseId of WARRIOR_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'REPORT', 'WITHDRAW']) expect(validateWarriorCommand({ type, caseId })).toBe(true);
      for (const method of ['POWER', 'TEAM']) expect(validateWarriorCommand({ type: 'PREPARE', caseId, method })).toBe(true);
    }
    for (const invalid of [
      null, [], {}, { type: 'BREW' }, { type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS' },
      { type: 'DAWN_ARMOR' }, { type: 'LIGHT_STORM' }, { type: 'FEAR_IMMUNITY' }, { type: 'DISCOVER', free: true },
      { type: 'OBSERVE', caseId: 'unknown' }, { type: 'OBSERVE', caseId: 'yard-gate', force: true },
      { type: 'PREPARE', caseId: 'yard-gate', method: 'POWER', verified: true },
      { type: 'PREPARE', caseId: 'staff-drill', method: 'MAGIC' }, { type: 'PREPARE', caseId: 'staff-drill' },
      { type: 'PERFORM', caseId: 'staff-drill', method: 'POWER' },
      { type: 'REPORT', caseId: 'staff-drill', conclusion: 'CERTAIN' },
      { type: 'WITHDRAW', caseId: 'loaded-trolley', success: true },
      { type: 'RETURN_TOOL', caseId: 'staff-drill' }, { type: 'RETURN_TOOL', owner: 'PLAYER' },
      { type: 'REFLECT', caseId: 'yard-gate' },
      { type: 'BUY_POTION', bottleId: 'warrior-potion-0' }, { type: 'BUY_POTION', bottleId: 'warrior-potion-01' },
      { type: 'BUY_POTION', bottleId: 'warrior-potion-1000000000000000' },
      { type: 'BUY_POTION', bottleId: 'marauder-potion-1' }, { type: 'CONSUME', bottleId: 'warrior-potion-1' },
      { type: 'CONSUME', bottleId: 'warrior-potion-1', confirmed: false },
    ]) expect(validateWarriorCommand(invalid)).toBe(false);
    expect(isWarriorAcquisitionCommand({ type: 'DISCOVER' })).toBe(true);
    const s = guided();
    for (const command of [
      { type: 'REFLECT' }, { type: 'RETURN_TOOL' }, { type: 'OBSERVE', caseId: 'yard-gate' },
      { type: 'PREPARE', caseId: 'staff-drill', method: 'POWER' }, { type: 'PERFORM', caseId: 'staff-drill' },
      { type: 'REPORT', caseId: 'loaded-trolley' }, { type: 'WITHDRAW', caseId: 'yard-gate' },
    ] as const) {
      expect(isWarriorAcquisitionCommand(command)).toBe(false);
      rejected(s, command as unknown as WarriorAcquisitionCommand);
    }
    rejected(s, { type: 'BUY_POTION', bottleId: WARRIOR_BOTTLE_IDS[0], cost: 0 } as unknown as WarriorAcquisitionCommand);
  });

  it('labels original G training separately from sourced S9 strength and keeps public data detached', () => {
    const s = promoted(), before = JSON.stringify(s), p = projectWarrior(s);
    expect(p.story).toBe(WARRIOR_SOURCE_STATUS);
    expect(WARRIOR_SOURCE_STATUS).toContain('第一部第138章');
    expect(WARRIOR_SOURCE_STATUS).toContain('第七部第18章');
    expect(WARRIOR_SOURCE_STATUS).toContain('第七部第24章');
    expect(WARRIOR_SOURCE_STATUS).toContain('成年独立导师');
    expect(WARRIOR_SOURCE_STATUS).toContain('不是原著列出的三项独立超能力');
    expect(WARRIOR_SOURCE_STATUS).toContain('不自动精通所有武器');
    expect(WARRIOR_SOURCE_STATUS).toContain('不免疫恐惧');
    expect(WARRIOR_SOURCE_STATUS).toContain('不获得徒手防弹');
    expect(WARRIOR_SOURCE_STATUS).toContain('光之风暴不属于本阶段');
    expect(WARRIOR_ABILITIES.map(ability => ability.id)).toEqual([...WARRIOR_ABILITY_IDS]);
    expect(p.abilities.every(ability => ability.mastery === 0)).toBe(true);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.cases).toEqual([]); expect(p.tool).toBeNull(); expect(p.environment).toBe('');
    expect(p.supplies).toContain(WARRIOR_FORMULA_STATUS);
    expect(new Set(s.warrior.bottles.map(bottle => bottle.source)).size).toBe(3);
    expect(s.warrior.bottles.every(bottle => bottle.source.includes('未声称现场配制') && bottle.source.includes('不建立战神教会或其它组织身份'))).toBe(true);
    p.bottles[0]!.source = 'changed'; p.abilities[0]!.mastery = 499; p.actions.splice(0);
    expect(JSON.stringify(s)).toBe(before);
    s.progression.acting = 100;
    expect(projectWarrior(s).digestion).toContain('已消化');
  });

  it('rejects forged bottle identities, provenance, outcomes, acquisition dates and promoted abilities', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.warrior.discovered = false; },
      (s: SliceState) => { s.warrior.guidanceKnown = false; },
      (s: SliceState) => { s.warrior.bottles.pop(); },
      (s: SliceState) => { s.warrior.bottles[0]!.id = 'warrior-potion-2'; },
      (s: SliceState) => { s.warrior.bottles[0]!.source = 'fabricated formula'; },
      (s: SliceState) => { s.warrior.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.warrior.bottles[0]!.acquiredWeek = null; },
      (s: SliceState) => { s.warrior.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.warrior.bottles[0]!.outcome = null; },
      (s: SliceState) => { s.warrior.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.progression.mastery['warrior.s6.dawn-armor'] = 0; },
      (s: SliceState) => { delete s.progression.mastery['warrior.s9.arms']; },
      (s: SliceState) => { s.progression.mastery['warrior.s9.arms'] = 501; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateWarriorState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.warrior.resupply.deliveries = 0; },
      (s: SliceState) => { s.warrior.bottles[3]!.id = 'warrior-potion-7'; },
      (s: SliceState) => { s.warrior.bottles[3]!.source = s.warrior.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.warrior.bottles[4]!.source = s.warrior.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.warrior.bottles[0]!.status = 'PLAYER'; s.warrior.bottles[0]!.outcome = null; s.warrior.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.warrior.bottles[3]!.status = 'PLAYER'; s.warrior.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.warrior.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateWarriorState(s)).toBe(false); }
  });

  it('round-trips real acquisition states and forbids pre-promotion practice or club custody', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(validateWarriorState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
      expect(s.warrior.practiceClub).toEqual(WARRIOR_PRACTICE_CLUB);
      expect(projectWarrior(s).tool).toBeNull();
    }
    for (const mutate of [
      (s: SliceState) => { s.warrior.cases['yard-gate']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.warrior.cases['yard-gate']!.attemptWeek = 5; },
      (s: SliceState) => { s.warrior.cases['yard-gate']!.withdrawals = 1; },
      (s: SliceState) => { s.warrior.cases['yard-gate']!.method = 'POWER'; },
      (s: SliceState) => { s.warrior.cases['yard-gate']!.outcome = 'GATE_SECURED'; },
      (s: SliceState) => { s.warrior.reflected = true; },
      (s: SliceState) => { s.warrior.practiceClub.custodian = 'PLAYER'; s.warrior.practiceClub.location = 'player:hand'; },
      (s: SliceState) => { s.warrior.practiceClub.version = 3; },
      (s: SliceState) => { s.progression.mastery['warrior.s9.physique'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateWarriorState(s)).toBe(false); }
  });

  it('rejects malformed exact case and tool shapes without inventing life transitions', () => {
    const rawCase = (s: SliceState) => s.warrior.cases['staff-drill'] as unknown as Record<string, unknown>;
    const rawClub = (s: SliceState) => s.warrior.practiceClub as unknown as Record<string, unknown>;
    for (const mutate of [
      (s: SliceState) => { delete s.warrior.cases['staff-drill']; },
      (s: SliceState) => { s.warrior.cases['copy'] = { ...s.warrior.cases['staff-drill']! }; },
      (s: SliceState) => { rawCase(s).status = 'IMAGINED'; },
      (s: SliceState) => { rawCase(s).method = 'MAGIC'; },
      (s: SliceState) => { rawCase(s).outcome = 'INVENTED'; },
      (s: SliceState) => { rawCase(s).attemptWeek = 4; },
      (s: SliceState) => { rawCase(s).attemptWeek = 6; },
      (s: SliceState) => { rawCase(s).withdrawals = -1; },
      (s: SliceState) => { rawCase(s).withdrawals = 0.5; },
      (s: SliceState) => { rawCase(s).secret = 'unknown'; },
      (s: SliceState) => { delete rawCase(s).outcome; },
      (s: SliceState) => { rawClub(s).id = 'imagined-club'; },
      (s: SliceState) => { rawClub(s).owner = 'PLAYER'; },
      (s: SliceState) => { rawClub(s).custodian = 'REMOTE'; },
      (s: SliceState) => { rawClub(s).location = 'remote:hand'; },
      (s: SliceState) => { rawClub(s).location = 'player:hand'; },
      (s: SliceState) => { rawClub(s).version = 0; },
      (s: SliceState) => { rawClub(s).version = 1.5; },
      (s: SliceState) => { rawClub(s).version = Number.MAX_SAFE_INTEGER + 1; },
      (s: SliceState) => { rawClub(s).copy = true; },
      (s: SliceState) => { delete rawClub(s).owner; },
      (s: SliceState) => { (s.warrior as unknown as Record<string, unknown>).practiceClub = []; },
      (s: SliceState) => { (s.warrior as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateWarriorState(s)).toBe(false); }
  });
});
