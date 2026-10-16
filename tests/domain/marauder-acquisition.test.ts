import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import {
  applyMarauderCommand, createMarauderState, isMarauderAcquisitionCommand, projectMarauder,
  validateMarauderCommand, validateMarauderState,
} from '../../src/domain/marauder/index.js';
import { MARAUDER_ABILITIES, MARAUDER_BOTTLE_IDS, MARAUDER_FORMULA_STATUS, MARAUDER_ORIGINALS, MARAUDER_SOURCE_STATUS } from '../../src/domain/marauder/content.js';
import { MARAUDER_ABILITY_IDS, MARAUDER_CASE_IDS, MARAUDER_ORIGINAL_IDS, type MarauderAcquisitionCommand } from '../../src/domain/marauder/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('marauder-acquisition', sliceDefaultCreationSelection, 'marauder-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.marauder = createMarauderState();
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
function apply(s: SliceState, command: MarauderAcquisitionCommand, roll = 20) { applyMarauderCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.marauder.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of MARAUDER_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() {
  const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s;
}
function rejected(s: SliceState, command: MarauderAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Marauder finite finished-potion acquisition', () => {
  it('starts with three separate originals and untouched case state, exposing no undiscovered inventory', () => {
    const s = ordinary(), p = projectMarauder(s);
    expect(validateMarauderState(s)).toBe(true);
    expect(s.marauder.bottles.map(b => b.id)).toEqual([...MARAUDER_BOTTLE_IDS]);
    expect(s.marauder.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.marauder.cases)).toEqual([...MARAUDER_CASE_IDS]);
    expect(Object.values(s.marauder.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.mistakes === 0 && w.conclusion === null && w.attention === 0)).toBe(true);
    expect(s.marauder.reflected).toBe(false);
    expect(Object.keys(s.marauder.originals)).toEqual([...MARAUDER_ORIGINAL_IDS]);
    expect(Object.values(s.marauder.originals)).toEqual(MARAUDER_ORIGINALS);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], originals: [], environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('marauder-potion-');
    const separate = createMarauderState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['sealed-dispatch']!.status = 'OBSERVED';
    separate.originals['training-token']!.custodian = 'PLAYER';
    expect(s.marauder.bottles[0]!.labourSteps).toBe(0);
    expect(s.marauder.cases['sealed-dispatch']!.status).toBe('AVAILABLE');
    expect(s.marauder.originals['training-token']!.custodian).toBe('HOLDER');
  });

  it('charges discovery and guidance exactly, without magic, organization membership or a recipe', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyMarauderCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.marauder.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(projectMarauder(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: MARAUDER_BOTTLE_IDS[0] });
    applyMarauderCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.marauder.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectMarauder(s).supplies).toContain(MARAUDER_FORMULA_STATUS);
    expect(projectMarauder(s).formulaKnown).toBe(false);
    expect(projectMarauder(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateMarauderState(s)).toBe(true);
  });

  it('buys only the selected original for 660 pence and zero AP, with no partial labour discount', () => {
    const s = guided(), untouched = JSON.stringify(s.marauder.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: MARAUDER_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: MARAUDER_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.marauder.bottles.slice(1))).toBe(untouched);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateMarauderState(s)).toBe(true);
  });

  it('requires two real one-AP jobs on the same bottle, then 60 pence to transfer that original', () => {
    const s = guided(), bottle = s.marauder.bottles[0]!, ctx = context(s);
    applyMarauderCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectMarauder(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyMarauderCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成失物编号核对', '完成交接清单整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectMarauder(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectMarauder(s).actions.find(a => a.id === `buy-${MARAUDER_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.marauder.cases).toEqual(createMarauderState().cases);
    expect(validateMarauderState(s)).toBe(true);
  });

  it('rejects insufficient funds, unowned or foreign bottles and AP-consuming preparation atomically', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['marauder-potion-4', 'hunter-potion-1', 'savant-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: MARAUDER_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: MARAUDER_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: MARAUDER_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: MARAUDER_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: MARAUDER_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('allows early preparation but requires four completed ordinary weeks and independent confirmation', () => {
    const s = ordinary(); s.week = 1; guided(s); buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectMarauder(s).actions.find(a => a.id === `consume-${MARAUDER_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: false } as unknown as MarauderAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true });
    expect(s.marauder.bottles[0]).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateMarauderState(s)).toBe(true);
  });

  it('uses exactly one will difficulty-five check for all four recoverable promotion outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applyMarauderCommand(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.marauder.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'error' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(MARAUDER_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 1, perception: stats.perception + 2, will: stats.will + 1, knowledge: stats.knowledge + 1 } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateMarauderState(s)).toBe(true);
    }
  });

  it('never refills spirituality, caps enhanced stats, and preserves severe rejection for actual recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectMarauder(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.marauder.bottles[0]!.status).toBe('CONSUMED');
    expect(validateMarauderState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: MARAUDER_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.marauder.bottles[0]).toEqual(failed.marauder.bottles[0]);
  });

  it('retains unused originals and blocks second promotion or changing an already chosen pathway', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: MARAUDER_BOTTLE_IDS[2] });
    expect(s.marauder.bottles[1]!.status).toBe('PLAYER');
    expect(projectMarauder(s).actions.find(a => a.id === `consume-${MARAUDER_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared(), c = context(other).c;
    applySeerCommand(other, { type: 'DISCOVER' }, c);
    applySeerCommand(other, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(other, { type: 'BUY_MATERIALS', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'BREW', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'CONSUME', bottleId: other.seer.bottles[0]!.id, confirmed: true }, c);
    expect(other.progression.pathwayId).toBe('diviner');
    rejected(other, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true });
    expect(other.marauder.bottles[0]!.status).toBe('PLAYER');
    expect(validateMarauderState(other)).toBe(true);
    expect(validateMarauderState(s)).toBe(true);
  });

  it('only resupplies after all failures, an explicit paid-AP request, and a later actual week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectMarauder(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.marauder.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const requestCash = s.cash;
    s = applySliceIntent(s, { type: 'MARAUDER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.marauder.resupply.requestedWeek]).toEqual([5, 1, requestCash, 5]);
    expect(JSON.stringify(s.marauder.bottles)).toBe(originals);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6); expect(s.date).not.toEqual(priorDate);
    expect(s.marauder.bottles).toHaveLength(3);
    const cash = s.cash, ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'MARAUDER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap]);
    expect(s.marauder.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.marauder.bottles.slice(3).map(b => b.id)).toEqual(['marauder-potion-4', 'marauder-potion-5', 'marauder-potion-6']);
    expect(s.marauder.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    expect(JSON.stringify(s.marauder.bottles.slice(0, 3))).toBe(originals);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'marauder-potion-4', confirmed: true });
    buy(s, 3);
    expect(s.cash).toBe(cash - 660);
    apply(s, { type: 'CONSUME', bottleId: 'marauder-potion-4', confirmed: true });
    expect(s.progression.pathwayId).toBe('error');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.marauder.bottles.slice(0, 3))).toBe(originals);
    expect(validateMarauderState(s)).toBe(true);
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
      rejected(s, { type: 'BUY_POTION', bottleId: MARAUDER_BOTTLE_IDS[0] });
    }
  });

  it('conserves every earlier batch through a second requested delivery, without inherited labour credit', () => {
    const s = resupplied();
    s.health = 100; s.mind = 100;
    for (let index = 3; index < 6; index += 1) buy(s, index);
    for (const bottle of s.marauder.bottles.slice(3)) apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    const earlier = JSON.stringify(s.marauder.bottles), cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 7;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.marauder.resupply).toEqual({ requestedWeek: null, deliveries: 2 });
    expect(JSON.stringify(s.marauder.bottles.slice(0, 6))).toBe(earlier);
    expect(s.marauder.bottles.slice(6).map(bottle => bottle.id)).toEqual(['marauder-potion-7', 'marauder-potion-8', 'marauder-potion-9']);
    expect(s.marauder.bottles.slice(6).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第7周实收入库'))).toBe(true);
    expect(s.cash).toBe(cash);
    expect(s.seer.pollution).toBe(100);
    expect(validateMarauderState(s)).toBe(true);
    apply(s, { type: 'POTION_WORK', bottleId: 'marauder-potion-7' });
    apply(s, { type: 'POTION_WORK', bottleId: 'marauder-potion-7' });
    buy(s, 6);
    expect(s.cash).toBe(cash - 60);
    expect(projectMarauder(s).actions.find(action => action.id === 'buy-marauder-potion-8')!.cost).toContain('660便士');
    expect(validateMarauderState(s)).toBe(true);
  });

  it('accepts exact acquisition and finite evidence commands, rejecting invented recipes and later powers', () => {
    for (const type of ['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT']) expect(validateMarauderCommand({ type })).toBe(true);
    for (const type of ['POTION_WORK', 'BUY_POTION']) expect(validateMarauderCommand({ type, bottleId: 'marauder-potion-4' })).toBe(true);
    expect(validateMarauderCommand({ type: 'CONSUME', bottleId: 'marauder-potion-1', confirmed: true })).toBe(true);
    for (const caseId of MARAUDER_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'RETURN', 'WITHDRAW']) expect(validateMarauderCommand({ type, caseId })).toBe(true);
      for (const method of ['DEXTERITY', 'ORDINARY']) expect(validateMarauderCommand({ type: 'PREPARE', caseId, method })).toBe(true);
      for (const conclusion of ['LIMITED', 'CERTAIN']) expect(validateMarauderCommand({ type: 'REPORT', caseId, conclusion })).toBe(true);
    }
    for (const invalid of [
      null, [], {}, { type: 'BREW' }, { type: 'LEARN_FORMULA' }, { type: 'READ_REMOTE_INVENTORY' }, { type: 'STEAL_ABILITY' },
      { type: 'STEAL_SPIRITUALITY' }, { type: 'SENSE_TREASURE' }, { type: 'DISCOVER', free: true },
      { type: 'OBSERVE', caseId: 'unknown' }, { type: 'OBSERVE', caseId: 'training-purse', force: true },
      { type: 'PREPARE', caseId: 'fallen-token', method: 'DEXTERITY', verified: true },
      { type: 'PREPARE', caseId: 'sealed-dispatch', method: 'FORCE' },
      { type: 'PREPARE', caseId: 'sealed-dispatch' },
      { type: 'PERFORM', caseId: 'training-purse', method: 'DEXTERITY' },
      { type: 'RETURN', caseId: 'unknown' }, { type: 'RETURN', caseId: 'training-purse', copy: true },
      { type: 'PREPARE', caseId: 'training-purse', method: 'DEXTERITY', originalId: 'imagined' },
      { type: 'PERFORM', caseId: 'sealed-dispatch', destination: 'Tingen' },
      { type: 'PREPARE', caseId: 'unknown', method: 'ORDINARY' }, { type: 'REFLECT', caseId: 'training-purse' },
      { type: 'REPORT', caseId: 'unknown', conclusion: 'LIMITED' },
      { type: 'REPORT', caseId: 'training-purse' },
      { type: 'REPORT', caseId: 'training-purse', conclusion: 'IDENTIFIED' },
      { type: 'REPORT', caseId: 'training-purse', conclusion: 'CERTAIN', contents: 'invented' },
      { type: 'WITHDRAW', caseId: 'sealed-dispatch', success: true },
      { type: 'BUY_POTION', bottleId: 'marauder-potion-0' }, { type: 'BUY_POTION', bottleId: 'marauder-potion-01' },
      { type: 'BUY_POTION', bottleId: 'marauder-potion-1000000000000000' },
      { type: 'BUY_POTION', bottleId: 'reader-potion-1' }, { type: 'CONSUME', bottleId: 'marauder-potion-1' },
      { type: 'CONSUME', bottleId: 'marauder-potion-1', confirmed: false },
    ]) expect(validateMarauderCommand(invalid)).toBe(false);
    expect(isMarauderAcquisitionCommand({ type: 'DISCOVER' })).toBe(true);
    expect(isMarauderAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    expect(isMarauderAcquisitionCommand({ type: 'RETURN', caseId: 'training-purse' })).toBe(false);
    expect(isMarauderAcquisitionCommand({ type: 'OBSERVE', caseId: 'training-purse' })).toBe(false);
    expect(isMarauderAcquisitionCommand({ type: 'REPORT', caseId: 'training-purse', conclusion: 'LIMITED' })).toBe(false);
    const s = guided();
    for (const invalid of [
      { type: 'REFLECT' }, { type: 'OBSERVE', caseId: 'training-purse' },
      { type: 'PREPARE', caseId: 'fallen-token', method: 'DEXTERITY' }, { type: 'PERFORM', caseId: 'sealed-dispatch' },
      { type: 'REPORT', caseId: 'sealed-dispatch', conclusion: 'LIMITED' },
      { type: 'WITHDRAW', caseId: 'training-purse' }, { type: 'RETURN', caseId: 'training-purse' },
      { type: 'BUY_POTION', bottleId: MARAUDER_BOTTLE_IDS[0], cost: 0 },
    ]) rejected(s, invalid as unknown as MarauderAcquisitionCommand);
  });

  it('projects sourced S9 boundaries and detached public data without higher powers or organization binding', () => {
    const s = prepared(); buy(s, 1); apply(s, { type: 'CONSUME', bottleId: MARAUDER_BOTTLE_IDS[0], confirmed: true });
    const before = JSON.stringify(s), p = projectMarauder(s), text = JSON.stringify(MARAUDER_ABILITIES);
    expect(p.abilities.map(a => a.id)).toEqual([...MARAUDER_ABILITY_IDS]);
    expect(p.story).toBe(MARAUDER_SOURCE_STATUS);
    for (const boundary of ['第一部第65章', '第二部第74章', '普通财物偷取', '速度与敏捷', '断指', '负面效果', '三个训练分类', '不能远程读取库存', '不能偷取非凡能力或灵性', '没有已核实的序列9宝物感应', '本作原创G', '成年独立导师', '艾德温·洛克']) expect(p.story).toContain(boundary);
    for (const boundary of ['速度与敏捷', '灵巧、稳定手指', '断指', '不视为偷盗者固有症状', '普通财物', '不转移所有权', '不能远程读取库存', '偷取非凡能力或灵性', '不把宝物感应当作已核实']) expect(text).toContain(boundary);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.risk).toContain('意志难度5'); expect(p.risk).toContain('不适用于战斗');
    expect(p.cases).toEqual([]); expect(p.originals).toEqual([]); expect(p.acting).toBe(0);
    expect(Object.hasOwn(p, 'insideCaseId')).toBe(false);
    expect(JSON.stringify(p)).not.toContain('sealed-letter');
    expect(Object.hasOwn(s.marauder, 'encounter')).toBe(false);
    expect(Object.hasOwn(s.marauder, 'promotionWeek')).toBe(false);
    p.abilities[0]!.mastery = 500; p.bottles[0]!.source = 'changed'; p.actions[0]!.label = 'changed';
    expect(JSON.stringify(s)).toBe(before);
  });

  it('keeps the unverified recipe unavailable and all source bottles independent of organizations', () => {
    const s = guided(), p = projectMarauder(s);
    for (const boundary of ['完整配方尚未核实', '材料名称、主辅分类、数量与投料顺序', '不构成完整制造配方', '本作原创G', '不编造任何原料']) expect(MARAUDER_FORMULA_STATUS).toContain(boundary);
    expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([]);
    expect(p.actions.some(action => ['LEARN_FORMULA', 'BUY_MATERIALS', 'BREW'].includes(action.command.type))).toBe(false);
    expect(new Set(s.marauder.bottles.map(bottle => bottle.source)).size).toBe(3);
    expect(s.marauder.bottles.every(bottle => bottle.source.includes('未声称现场配制') && bottle.source.includes('不建立任何家族或组织身份'))).toBe(true);
    expect(MARAUDER_ABILITIES.map(ability => ability.id)).toEqual([...MARAUDER_ABILITY_IDS]);
  });

  it('rejects forged original identities, provenance, ownership, outcomes, delivery timing and abilities', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.marauder.discovered = false; },
      (s: SliceState) => { s.marauder.guidanceKnown = false; },
      (s: SliceState) => { s.marauder.bottles.pop(); },
      (s: SliceState) => { s.marauder.bottles[0]!.id = 'marauder-potion-2'; },
      (s: SliceState) => { s.marauder.bottles[0]!.source = 'fabricated formula'; },
      (s: SliceState) => { s.marauder.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.marauder.bottles[0]!.acquiredWeek = null; },
      (s: SliceState) => { s.marauder.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.marauder.bottles[0]!.outcome = null; },
      (s: SliceState) => { s.marauder.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.progression.mastery['error.s6.ability-theft'] = 0; },
      (s: SliceState) => { delete s.progression.mastery['error.s9.dexterity']; },
      (s: SliceState) => { s.progression.mastery['error.s9.dexterity'] = 501; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateMarauderState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.marauder.resupply.deliveries = 0; },
      (s: SliceState) => { s.marauder.bottles[3]!.id = 'marauder-potion-7'; },
      (s: SliceState) => { s.marauder.bottles[3]!.source = s.marauder.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.marauder.bottles[4]!.source = s.marauder.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.marauder.bottles[0]!.status = 'PLAYER'; s.marauder.bottles[0]!.outcome = null; s.marauder.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.marauder.bottles[3]!.status = 'PLAYER'; s.marauder.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.marauder.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateMarauderState(s)).toBe(false); }
  });

  it('round-trips real states and rejects malformed or pre-promotion case activity', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) expect(validateMarauderState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    for (const mutate of [
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.attemptWeek = 5; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.withdrawals = 1; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.method = 'DEXTERITY'; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.conclusion = 'LIMITED'; },
      (s: SliceState) => { s.marauder.reflected = true; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.attention = 1; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.mistakes = 1; },
      (s: SliceState) => { s.progression.mastery['error.s9.dexterity'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateMarauderState(s)).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { delete s.marauder.cases['sealed-dispatch']; },
      (s: SliceState) => { s.marauder.cases['invented'] = { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, mistakes: 0, conclusion: null, attention: 0 }; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.attemptWeek = 4; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.attemptWeek = 6; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.withdrawals = -1; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.withdrawals = 0.5; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.mistakes = -1; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.mistakes = 0.5; },
      (s: SliceState) => { (s.marauder.cases['sealed-dispatch'] as unknown as Record<string, unknown>).method = 'FORCE'; },
      (s: SliceState) => { (s.marauder.cases['sealed-dispatch'] as unknown as Record<string, unknown>).status = 'IMAGINED'; },
      (s: SliceState) => { (s.marauder.cases['sealed-dispatch'] as unknown as Record<string, unknown>).conclusion = 'YES'; },
      (s: SliceState) => { (s.marauder.cases['sealed-dispatch'] as unknown as Record<string, unknown>).method = false; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.attention = -1; },
      (s: SliceState) => { s.marauder.cases['sealed-dispatch']!.attention = 0.5; },
      (s: SliceState) => { (s.marauder.cases['sealed-dispatch'] as unknown as Record<string, unknown>).attention = 'true'; },
      (s: SliceState) => { delete (s.marauder.cases['sealed-dispatch'] as unknown as Record<string, unknown>).attention; },
      (s: SliceState) => { (s.marauder.cases['sealed-dispatch'] as unknown as Record<string, unknown>).text = 'hidden page'; },
      (s: SliceState) => { (s.marauder as unknown as Record<string, unknown>).encounter = {}; },
      (s: SliceState) => { (s.marauder as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateMarauderState(s)).toBe(false); }
  });

  it('keeps the three real case objects untouched throughout potion acquisition and resupply', () => {
    const expected = createMarauderState().originals;
    for (const s of [ordinary(), guided(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(s.marauder.originals).toEqual(expected);
      expect(projectMarauder(s).originals).toEqual([]);
    }
    expect(expected['training-token']).toEqual({ id: 'training-token', owner: '艾德温·洛克', custodian: 'HOLDER', location: 'training-purse', version: 1, sealed: false });
    expect(expected['brass-token']).toEqual({ id: 'brass-token', owner: '维修员露茜', custodian: 'SITE', location: 'bench-gap', version: 1, sealed: false });
    expect(expected['sealed-letter']).toEqual({ id: 'sealed-letter', owner: '委托人安娜', custodian: 'HOLDER', location: 'dispatch-counter', version: 1, sealed: true });
  });

  it('rejects malformed original-object records before life relations are checked', () => {
    const rawOriginal = (s: SliceState) => s.marauder.originals['sealed-letter'] as unknown as Record<string, unknown>;
    for (const mutate of [
      (s: SliceState) => { delete s.marauder.originals['sealed-letter']; },
      (s: SliceState) => { s.marauder.originals['copy'] = { ...s.marauder.originals['sealed-letter']! }; },
      (s: SliceState) => { rawOriginal(s).id = 'training-token'; },
      (s: SliceState) => { rawOriginal(s).owner = ''; },
      (s: SliceState) => { rawOriginal(s).owner = '  '; },
      (s: SliceState) => { rawOriginal(s).owner = null; },
      (s: SliceState) => { rawOriginal(s).custodian = 'REMOTE'; },
      (s: SliceState) => { rawOriginal(s).custodian = null; },
      (s: SliceState) => { rawOriginal(s).location = ''; },
      (s: SliceState) => { rawOriginal(s).location = []; },
      (s: SliceState) => { rawOriginal(s).version = 0; },
      (s: SliceState) => { rawOriginal(s).version = -1; },
      (s: SliceState) => { rawOriginal(s).version = 1.5; },
      (s: SliceState) => { rawOriginal(s).version = Number.MAX_SAFE_INTEGER + 1; },
      (s: SliceState) => { rawOriginal(s).sealed = 'true'; },
      (s: SliceState) => { delete rawOriginal(s).sealed; },
      (s: SliceState) => { rawOriginal(s).contents = 'unseen text'; },
      (s: SliceState) => { (s.marauder as unknown as Record<string, unknown>).originals = []; },
    ]) {
      const s = promoted(); mutate(s); expect(validateMarauderState(s)).toBe(false);
    }
  });
});
