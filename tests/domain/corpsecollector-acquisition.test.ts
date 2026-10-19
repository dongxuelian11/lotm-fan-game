import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import {
  applyCorpsecollectorCommand, createCorpsecollectorState, isCorpsecollectorAcquisitionCommand, projectCorpsecollector,
  validateCorpsecollectorCommand, validateCorpsecollectorState,
} from '../../src/domain/corpsecollector/index.js';
import { CORPSECOLLECTOR_ABILITIES, CORPSECOLLECTOR_BOTTLE_IDS, CORPSECOLLECTOR_FORMULA_STATUS, CORPSECOLLECTOR_SOURCE_STATUS } from '../../src/domain/corpsecollector/content.js';
import { CORPSECOLLECTOR_ABILITY_IDS, CORPSECOLLECTOR_CASE_IDS, type CorpsecollectorAcquisitionCommand } from '../../src/domain/corpsecollector/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('corpsecollector-acquisition', sliceDefaultCreationSelection, 'corpsecollector-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.corpsecollector = createCorpsecollectorState();
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
function apply(s: SliceState, command: CorpsecollectorAcquisitionCommand, roll = 20) { applyCorpsecollectorCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.corpsecollector.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of CORPSECOLLECTOR_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() {
  const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s;
}
function rejected(s: SliceState, command: CorpsecollectorAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Corpsecollector finite finished-potion acquisition', () => {
  it('starts with three separate originals and untouched case state, exposing no undiscovered inventory', () => {
    const s = ordinary(), p = projectCorpsecollector(s);
    expect(validateCorpsecollectorState(s)).toBe(true);
    expect(s.corpsecollector.bottles.map(b => b.id)).toEqual([...CORPSECOLLECTOR_BOTTLE_IDS]);
    expect(s.corpsecollector.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.corpsecollector.cases)).toEqual([...CORPSECOLLECTOR_CASE_IDS]);
    expect(Object.values(s.corpsecollector.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.mistakes === 0 && w.conclusion === null)).toBe(true);
    expect(s.corpsecollector.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('corpsecollector-potion-');
    const separate = createCorpsecollectorState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['quiet-passage']!.status = 'OBSERVED';
    expect(s.corpsecollector.bottles[0]!.labourSteps).toBe(0);
    expect(s.corpsecollector.cases['quiet-passage']!.status).toBe('AVAILABLE');
  });

  it('charges discovery and guidance exactly, without magic, organization membership or a recipe', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyCorpsecollectorCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.corpsecollector.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(projectCorpsecollector(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0] });
    applyCorpsecollectorCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.corpsecollector.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectCorpsecollector(s).supplies).toContain(CORPSECOLLECTOR_FORMULA_STATUS);
    expect(projectCorpsecollector(s).formulaKnown).toBe(false);
    expect(projectCorpsecollector(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateCorpsecollectorState(s)).toBe(true);
  });

  it('buys only the selected original for 660 pence and zero AP, with no partial labour discount', () => {
    const s = guided(), untouched = JSON.stringify(s.corpsecollector.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: CORPSECOLLECTOR_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.corpsecollector.bottles.slice(1))).toBe(untouched);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateCorpsecollectorState(s)).toBe(true);
  });

  it('requires two real one-AP jobs on the same bottle, then 60 pence to transfer that original', () => {
    const s = guided(), bottle = s.corpsecollector.bottles[0]!, ctx = context(s);
    applyCorpsecollectorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectCorpsecollector(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyCorpsecollectorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成原登记号核对', '完成殓房通道整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectCorpsecollector(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectCorpsecollector(s).actions.find(a => a.id === `buy-${CORPSECOLLECTOR_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.corpsecollector.cases).toEqual(createCorpsecollectorState().cases);
    expect(validateCorpsecollectorState(s)).toBe(true);
  });

  it('rejects insufficient funds, unowned or foreign bottles and AP-consuming preparation atomically', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['corpsecollector-potion-4', 'hunter-potion-1', 'savant-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('allows early preparation but requires four completed ordinary weeks and independent confirmation', () => {
    const s = ordinary(); s.week = 1; guided(s); buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectCorpsecollector(s).actions.find(a => a.id === `consume-${CORPSECOLLECTOR_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: false } as unknown as CorpsecollectorAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.corpsecollector.bottles[0]).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateCorpsecollectorState(s)).toBe(true);
  });

  it('uses exactly one will difficulty-five check for all four recoverable promotion outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applyCorpsecollectorCommand(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.corpsecollector.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'death' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(CORPSECOLLECTOR_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 2, perception: stats.perception + 2, will: stats.will + 2, knowledge: stats.knowledge + 1 } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateCorpsecollectorState(s)).toBe(true);
    }
  });

  it('never refills spirituality, caps enhanced stats, and preserves severe rejection for actual recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectCorpsecollector(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.corpsecollector.bottles[0]!.status).toBe('CONSUMED');
    expect(validateCorpsecollectorState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.corpsecollector.bottles[0]).toEqual(failed.corpsecollector.bottles[0]);
  });

  it('retains unused originals and blocks second promotion or changing an already chosen pathway', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[2] });
    expect(s.corpsecollector.bottles[1]!.status).toBe('PLAYER');
    expect(projectCorpsecollector(s).actions.find(a => a.id === `consume-${CORPSECOLLECTOR_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared(), c = context(other).c;
    applySeerCommand(other, { type: 'DISCOVER' }, c);
    applySeerCommand(other, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(other, { type: 'BUY_MATERIALS', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'BREW', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'CONSUME', bottleId: other.seer.bottles[0]!.id, confirmed: true }, c);
    expect(other.progression.pathwayId).toBe('diviner');
    rejected(other, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true });
    expect(other.corpsecollector.bottles[0]!.status).toBe('PLAYER');
    expect(validateCorpsecollectorState(other)).toBe(true);
    expect(validateCorpsecollectorState(s)).toBe(true);
  });

  it('only resupplies after all failures, an explicit paid-AP request, and a later actual week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectCorpsecollector(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.corpsecollector.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const requestCash = s.cash;
    s = applySliceIntent(s, { type: 'CORPSECOLLECTOR', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.corpsecollector.resupply.requestedWeek]).toEqual([5, 1, requestCash, 5]);
    expect(JSON.stringify(s.corpsecollector.bottles)).toBe(originals);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6); expect(s.date).not.toEqual(priorDate);
    expect(s.corpsecollector.bottles).toHaveLength(3);
    const cash = s.cash, ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'CORPSECOLLECTOR', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap]);
    expect(s.corpsecollector.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.corpsecollector.bottles.slice(3).map(b => b.id)).toEqual(['corpsecollector-potion-4', 'corpsecollector-potion-5', 'corpsecollector-potion-6']);
    expect(s.corpsecollector.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    expect(JSON.stringify(s.corpsecollector.bottles.slice(0, 3))).toBe(originals);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'corpsecollector-potion-4', confirmed: true });
    buy(s, 3);
    expect(s.cash).toBe(cash - 660);
    apply(s, { type: 'CONSUME', bottleId: 'corpsecollector-potion-4', confirmed: true });
    expect(s.progression.pathwayId).toBe('death');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.corpsecollector.bottles.slice(0, 3))).toBe(originals);
    expect(validateCorpsecollectorState(s)).toBe(true);
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
      rejected(s, { type: 'BUY_POTION', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0] });
    }
  });

  it('accepts exact acquisition and finite evidence commands, rejecting invented recipes and later powers', () => {
    for (const type of ['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT']) expect(validateCorpsecollectorCommand({ type })).toBe(true);
    for (const type of ['POTION_WORK', 'BUY_POTION']) expect(validateCorpsecollectorCommand({ type, bottleId: 'corpsecollector-potion-4' })).toBe(true);
    expect(validateCorpsecollectorCommand({ type: 'CONSUME', bottleId: 'corpsecollector-potion-1', confirmed: true })).toBe(true);
    for (const caseId of CORPSECOLLECTOR_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'WITHDRAW']) expect(validateCorpsecollectorCommand({ type, caseId })).toBe(true);
      for (const method of ['SIGHT', 'ORDINARY']) expect(validateCorpsecollectorCommand({ type: 'PREPARE', caseId, method })).toBe(true);
      for (const conclusion of ['LIMITED', 'CERTAIN']) expect(validateCorpsecollectorCommand({ type: 'REPORT', caseId, conclusion })).toBe(true);
    }
    for (const invalid of [
      null, [], {}, { type: 'BREW' }, { type: 'LEARN_FORMULA' }, { type: 'DEATH_EYE' }, { type: 'QUESTION_SPIRIT' },
      { type: 'IDENTIFY_KILLER' }, { type: 'RESURRECTION' }, { type: 'DISCOVER', free: true },
      { type: 'OBSERVE', caseId: 'unknown' }, { type: 'OBSERVE', caseId: 'unclaimed-body', force: true },
      { type: 'PREPARE', caseId: 'cold-storage', method: 'SIGHT', verified: true },
      { type: 'PREPARE', caseId: 'quiet-passage', method: 'FORCE' },
      { type: 'PREPARE', caseId: 'quiet-passage' },
      { type: 'PERFORM', caseId: 'unclaimed-body', method: 'SIGHT' },
      { type: 'PREPARE', caseId: 'unknown', method: 'ORDINARY' }, { type: 'REFLECT', caseId: 'unclaimed-body' },
      { type: 'REPORT', caseId: 'unknown', conclusion: 'LIMITED' },
      { type: 'REPORT', caseId: 'unclaimed-body' },
      { type: 'REPORT', caseId: 'unclaimed-body', conclusion: 'IDENTIFIED' },
      { type: 'REPORT', caseId: 'unclaimed-body', conclusion: 'CERTAIN', killer: 'invented' },
      { type: 'WITHDRAW', caseId: 'quiet-passage', success: true },
      { type: 'BUY_POTION', bottleId: 'corpsecollector-potion-0' }, { type: 'BUY_POTION', bottleId: 'corpsecollector-potion-01' },
      { type: 'BUY_POTION', bottleId: 'corpsecollector-potion-1000000000000000' },
      { type: 'BUY_POTION', bottleId: 'reader-potion-1' }, { type: 'CONSUME', bottleId: 'corpsecollector-potion-1' },
      { type: 'CONSUME', bottleId: 'corpsecollector-potion-1', confirmed: false },
    ]) expect(validateCorpsecollectorCommand(invalid)).toBe(false);
    expect(isCorpsecollectorAcquisitionCommand({ type: 'DISCOVER' })).toBe(true);
    expect(isCorpsecollectorAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    expect(isCorpsecollectorAcquisitionCommand({ type: 'OBSERVE', caseId: 'unclaimed-body' })).toBe(false);
    expect(isCorpsecollectorAcquisitionCommand({ type: 'REPORT', caseId: 'unclaimed-body', conclusion: 'LIMITED' })).toBe(false);
    const s = guided();
    for (const invalid of [
      { type: 'REFLECT' }, { type: 'OBSERVE', caseId: 'unclaimed-body' },
      { type: 'PREPARE', caseId: 'cold-storage', method: 'SIGHT' }, { type: 'PERFORM', caseId: 'quiet-passage' },
      { type: 'REPORT', caseId: 'quiet-passage', conclusion: 'LIMITED' },
      { type: 'WITHDRAW', caseId: 'unclaimed-body' },
      { type: 'BUY_POTION', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], cost: 0 },
    ]) rejected(s, invalid as unknown as CorpsecollectorAcquisitionCommand);
  });

  it('projects sourced S9 boundaries and detached public data without higher powers or organization binding', () => {
    const s = prepared(); buy(s, 1); apply(s, { type: 'CONSUME', bottleId: CORPSECOLLECTOR_BOTTLE_IDS[0], confirmed: true });
    const before = JSON.stringify(s), p = projectCorpsecollector(s), text = JSON.stringify(CORPSECOLLECTOR_ABILITIES);
    expect(p.abilities.map(a => a.id)).toEqual([...CORPSECOLLECTOR_ABILITY_IDS]);
    expect(p.story).toBe(CORPSECOLLECTOR_SOURCE_STATUS);
    for (const boundary of ['第四部第186章', '尸体特质', '较低体温', '无智慧亡灵', '误认作同类', '腐烂', '寒冷', '死亡气息', '天然灵视', '部分不死生物知识', '本作原创G', '成年独立导师', '伊芙琳·沃斯']) expect(p.story).toContain(boundary);
    for (const boundary of ['绝对毒素免疫', '所有幽灵友善', '识别凶手', '死亡之眼', '通灵问答', '复活', '原记录']) expect(text).toContain(boundary);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.risk).toContain('意志难度5'); expect(p.risk).toContain('不适用于战斗');
    expect(p.cases).toEqual([]); expect(p.acting).toBe(0);
    expect(Object.hasOwn(s.corpsecollector, 'encounter')).toBe(false);
    expect(Object.hasOwn(s.corpsecollector, 'promotionWeek')).toBe(false);
    p.abilities[0]!.mastery = 500; p.bottles[0]!.source = 'changed'; p.actions[0]!.label = 'changed';
    expect(JSON.stringify(s)).toBe(before);
  });

  it('keeps the one verified ingredient fragment unquantified and separate from a full manufacturing recipe', () => {
    const s = guided(), p = projectCorpsecollector(s);
    for (const fragment of ['风干的成年黑斑青蛙', '未核定数量、主辅材料分类', '完整配方仍未知', '不构成完整制造配方', '本作原创G']) expect(CORPSECOLLECTOR_FORMULA_STATUS).toContain(fragment);
    expect(CORPSECOLLECTOR_FORMULA_STATUS).not.toMatch(/黑斑青蛙[0-9一二三四五六七八九十]/);
    expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([]);
    expect(p.actions.some(action => ['LEARN_FORMULA', 'BUY_MATERIALS', 'BREW'].includes(action.command.type))).toBe(false);
    expect(new Set(s.corpsecollector.bottles.map(bottle => bottle.source)).size).toBe(3);
    expect(s.corpsecollector.bottles.every(bottle => bottle.source.includes('未声称现场配制') && bottle.source.includes('不建立黑夜教会、灵教团或其它组织身份'))).toBe(true);
  });

  it('rejects forged original identities, provenance, ownership, outcomes, delivery timing and abilities', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.corpsecollector.discovered = false; },
      (s: SliceState) => { s.corpsecollector.guidanceKnown = false; },
      (s: SliceState) => { s.corpsecollector.bottles.pop(); },
      (s: SliceState) => { s.corpsecollector.bottles[0]!.id = 'corpsecollector-potion-2'; },
      (s: SliceState) => { s.corpsecollector.bottles[0]!.source = 'fabricated formula'; },
      (s: SliceState) => { s.corpsecollector.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.corpsecollector.bottles[0]!.acquiredWeek = null; },
      (s: SliceState) => { s.corpsecollector.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.corpsecollector.bottles[0]!.outcome = null; },
      (s: SliceState) => { s.corpsecollector.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.progression.mastery['death.s8.death-eye'] = 0; },
      (s: SliceState) => { delete s.progression.mastery['death.s9.corpse-physique']; },
      (s: SliceState) => { s.progression.mastery['death.s9.spiritual-sight'] = 501; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateCorpsecollectorState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.corpsecollector.resupply.deliveries = 0; },
      (s: SliceState) => { s.corpsecollector.bottles[3]!.id = 'corpsecollector-potion-7'; },
      (s: SliceState) => { s.corpsecollector.bottles[3]!.source = s.corpsecollector.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.corpsecollector.bottles[4]!.source = s.corpsecollector.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.corpsecollector.bottles[0]!.status = 'PLAYER'; s.corpsecollector.bottles[0]!.outcome = null; s.corpsecollector.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.corpsecollector.bottles[3]!.status = 'PLAYER'; s.corpsecollector.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.corpsecollector.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateCorpsecollectorState(s)).toBe(false); }
  });

  it('round-trips real states and rejects malformed or pre-promotion case activity', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) expect(validateCorpsecollectorState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    for (const mutate of [
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.attemptWeek = 5; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.withdrawals = 1; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.method = 'SIGHT'; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.conclusion = 'LIMITED'; },
      (s: SliceState) => { s.corpsecollector.reflected = true; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.mistakes = 1; },
      (s: SliceState) => { s.progression.mastery['death.s9.corpse-physique'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateCorpsecollectorState(s)).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { delete s.corpsecollector.cases['quiet-passage']; },
      (s: SliceState) => { s.corpsecollector.cases['invented'] = { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, mistakes: 0, conclusion: null }; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.attemptWeek = 4; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.attemptWeek = 6; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.withdrawals = -1; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.withdrawals = 0.5; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.mistakes = -1; },
      (s: SliceState) => { s.corpsecollector.cases['quiet-passage']!.mistakes = 0.5; },
      (s: SliceState) => { (s.corpsecollector.cases['quiet-passage'] as unknown as Record<string, unknown>).method = 'FORCE'; },
      (s: SliceState) => { (s.corpsecollector.cases['quiet-passage'] as unknown as Record<string, unknown>).status = 'IMAGINED'; },
      (s: SliceState) => { (s.corpsecollector.cases['quiet-passage'] as unknown as Record<string, unknown>).conclusion = 'YES'; },
      (s: SliceState) => { (s.corpsecollector.cases['quiet-passage'] as unknown as Record<string, unknown>).method = false; },
      (s: SliceState) => { (s.corpsecollector.cases['quiet-passage'] as unknown as Record<string, unknown>).text = 'hidden page'; },
      (s: SliceState) => { (s.corpsecollector as unknown as Record<string, unknown>).encounter = {}; },
      (s: SliceState) => { (s.corpsecollector as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateCorpsecollectorState(s)).toBe(false); }
  });
});
