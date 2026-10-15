import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import {
  applyApprenticeCommand, createApprenticeState, isApprenticeAcquisitionCommand, projectApprentice,
  validateApprenticeCommand, validateApprenticeState,
} from '../../src/domain/apprentice/index.js';
import { APPRENTICE_ABILITIES, APPRENTICE_BOTTLE_IDS, APPRENTICE_FORMULA_STATUS, APPRENTICE_SOURCE_STATUS } from '../../src/domain/apprentice/content.js';
import { APPRENTICE_ABILITY_IDS, APPRENTICE_CASE_IDS, type ApprenticeAcquisitionCommand } from '../../src/domain/apprentice/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('apprentice-acquisition', sliceDefaultCreationSelection, 'apprentice-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.apprentice = createApprenticeState();
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
function apply(s: SliceState, command: ApprenticeAcquisitionCommand, roll = 20) { applyApprenticeCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.apprentice.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of APPRENTICE_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() {
  const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s;
}
function rejected(s: SliceState, command: ApprenticeAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Apprentice finite finished-potion acquisition', () => {
  it('starts with three separate originals and untouched case state, exposing no undiscovered inventory', () => {
    const s = ordinary(), p = projectApprentice(s);
    expect(validateApprenticeState(s)).toBe(true);
    expect(s.apprentice.bottles.map(b => b.id)).toEqual([...APPRENTICE_BOTTLE_IDS]);
    expect(s.apprentice.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.apprentice.cases)).toEqual([...APPRENTICE_CASE_IDS]);
    expect(Object.values(s.apprentice.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.mistakes === 0 && w.conclusion === null && w.position === 'OUTSIDE' && w.ordinaryOpen === false)).toBe(true);
    expect(s.apprentice.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], insideCaseId: null, environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('apprentice-potion-');
    const separate = createApprenticeState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['waiting-courtyard']!.status = 'OBSERVED';
    expect(s.apprentice.bottles[0]!.labourSteps).toBe(0);
    expect(s.apprentice.cases['waiting-courtyard']!.status).toBe('AVAILABLE');
  });

  it('charges discovery and guidance exactly, without magic, organization membership or a recipe', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyApprenticeCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.apprentice.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(projectApprentice(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: APPRENTICE_BOTTLE_IDS[0] });
    applyApprenticeCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.apprentice.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectApprentice(s).supplies).toContain(APPRENTICE_FORMULA_STATUS);
    expect(projectApprentice(s).formulaKnown).toBe(false);
    expect(projectApprentice(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateApprenticeState(s)).toBe(true);
  });

  it('buys only the selected original for 660 pence and zero AP, with no partial labour discount', () => {
    const s = guided(), untouched = JSON.stringify(s.apprentice.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: APPRENTICE_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: APPRENTICE_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.apprentice.bottles.slice(1))).toBe(untouched);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateApprenticeState(s)).toBe(true);
  });

  it('requires two real one-AP jobs on the same bottle, then 60 pence to transfer that original', () => {
    const s = guided(), bottle = s.apprentice.bottles[0]!, ctx = context(s);
    applyApprenticeCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectApprentice(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyApprenticeCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成原钥匙编号核对', '完成档案通道整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectApprentice(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectApprentice(s).actions.find(a => a.id === `buy-${APPRENTICE_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.apprentice.cases).toEqual(createApprenticeState().cases);
    expect(validateApprenticeState(s)).toBe(true);
  });

  it('rejects insufficient funds, unowned or foreign bottles and AP-consuming preparation atomically', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['apprentice-potion-4', 'hunter-potion-1', 'savant-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: APPRENTICE_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: APPRENTICE_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: APPRENTICE_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: APPRENTICE_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: APPRENTICE_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('allows early preparation but requires four completed ordinary weeks and independent confirmation', () => {
    const s = ordinary(); s.week = 1; guided(s); buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectApprentice(s).actions.find(a => a.id === `consume-${APPRENTICE_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: false } as unknown as ApprenticeAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true });
    expect(s.apprentice.bottles[0]).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateApprenticeState(s)).toBe(true);
  });

  it('uses exactly one will difficulty-five check for all four recoverable promotion outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applyApprenticeCommand(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.apprentice.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'door' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(APPRENTICE_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique, perception: stats.perception + 2, will: stats.will + 2, knowledge: stats.knowledge + 1 } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateApprenticeState(s)).toBe(true);
    }
  });

  it('never refills spirituality, caps enhanced stats, and preserves severe rejection for actual recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectApprentice(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 499, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.apprentice.bottles[0]!.status).toBe('CONSUMED');
    expect(validateApprenticeState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: APPRENTICE_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.apprentice.bottles[0]).toEqual(failed.apprentice.bottles[0]);
  });

  it('retains unused originals and blocks second promotion or changing an already chosen pathway', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: APPRENTICE_BOTTLE_IDS[2] });
    expect(s.apprentice.bottles[1]!.status).toBe('PLAYER');
    expect(projectApprentice(s).actions.find(a => a.id === `consume-${APPRENTICE_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared(), c = context(other).c;
    applySeerCommand(other, { type: 'DISCOVER' }, c);
    applySeerCommand(other, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(other, { type: 'BUY_MATERIALS', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'BREW', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'CONSUME', bottleId: other.seer.bottles[0]!.id, confirmed: true }, c);
    expect(other.progression.pathwayId).toBe('diviner');
    rejected(other, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true });
    expect(other.apprentice.bottles[0]!.status).toBe('PLAYER');
    expect(validateApprenticeState(other)).toBe(true);
    expect(validateApprenticeState(s)).toBe(true);
  });

  it('only resupplies after all failures, an explicit paid-AP request, and a later actual week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectApprentice(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.apprentice.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const requestCash = s.cash;
    s = applySliceIntent(s, { type: 'APPRENTICE', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.apprentice.resupply.requestedWeek]).toEqual([5, 1, requestCash, 5]);
    expect(JSON.stringify(s.apprentice.bottles)).toBe(originals);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6); expect(s.date).not.toEqual(priorDate);
    expect(s.apprentice.bottles).toHaveLength(3);
    const cash = s.cash, ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'APPRENTICE', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap]);
    expect(s.apprentice.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.apprentice.bottles.slice(3).map(b => b.id)).toEqual(['apprentice-potion-4', 'apprentice-potion-5', 'apprentice-potion-6']);
    expect(s.apprentice.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    expect(JSON.stringify(s.apprentice.bottles.slice(0, 3))).toBe(originals);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'apprentice-potion-4', confirmed: true });
    buy(s, 3);
    expect(s.cash).toBe(cash - 660);
    apply(s, { type: 'CONSUME', bottleId: 'apprentice-potion-4', confirmed: true });
    expect(s.progression.pathwayId).toBe('door');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.apprentice.bottles.slice(0, 3))).toBe(originals);
    expect(validateApprenticeState(s)).toBe(true);
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
      rejected(s, { type: 'BUY_POTION', bottleId: APPRENTICE_BOTTLE_IDS[0] });
    }
  });

  it('conserves every earlier batch through a second requested delivery, without inherited labour credit', () => {
    const s = resupplied();
    s.health = 100; s.mind = 100;
    for (let index = 3; index < 6; index += 1) buy(s, index);
    for (const bottle of s.apprentice.bottles.slice(3)) apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    const earlier = JSON.stringify(s.apprentice.bottles), cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 7;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.apprentice.resupply).toEqual({ requestedWeek: null, deliveries: 2 });
    expect(JSON.stringify(s.apprentice.bottles.slice(0, 6))).toBe(earlier);
    expect(s.apprentice.bottles.slice(6).map(bottle => bottle.id)).toEqual(['apprentice-potion-7', 'apprentice-potion-8', 'apprentice-potion-9']);
    expect(s.apprentice.bottles.slice(6).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第7周实收入库'))).toBe(true);
    expect(s.cash).toBe(cash);
    expect(s.seer.pollution).toBe(100);
    expect(validateApprenticeState(s)).toBe(true);
    apply(s, { type: 'POTION_WORK', bottleId: 'apprentice-potion-7' });
    apply(s, { type: 'POTION_WORK', bottleId: 'apprentice-potion-7' });
    buy(s, 6);
    expect(s.cash).toBe(cash - 60);
    expect(projectApprentice(s).actions.find(action => action.id === 'buy-apprentice-potion-8')!.cost).toContain('660便士');
    expect(validateApprenticeState(s)).toBe(true);
  });

  it('projects the real inside case as typed data, without inferring movement from prose or an open ordinary door', () => {
    const s = promoted();
    expect(projectApprentice(s).insideCaseId).toBeNull();
    for (const caseId of APPRENTICE_CASE_IDS) {
      s.apprentice.cases[caseId]!.position = 'INSIDE';
      expect(projectApprentice(s).insideCaseId).toBe(caseId);
      s.apprentice.cases[caseId]!.position = 'OUTSIDE';
      s.apprentice.cases[caseId]!.ordinaryOpen = true;
      expect(projectApprentice(s).insideCaseId).toBeNull();
    }
  });

  it('accepts exact acquisition and finite evidence commands, rejecting invented recipes and later powers', () => {
    for (const type of ['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT']) expect(validateApprenticeCommand({ type })).toBe(true);
    for (const type of ['POTION_WORK', 'BUY_POTION']) expect(validateApprenticeCommand({ type, bottleId: 'apprentice-potion-4' })).toBe(true);
    expect(validateApprenticeCommand({ type: 'CONSUME', bottleId: 'apprentice-potion-1', confirmed: true })).toBe(true);
    for (const caseId of APPRENTICE_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'RETURN', 'WITHDRAW']) expect(validateApprenticeCommand({ type, caseId })).toBe(true);
      for (const method of ['DOOR', 'ORDINARY']) expect(validateApprenticeCommand({ type: 'PREPARE', caseId, method })).toBe(true);
      for (const conclusion of ['LIMITED', 'CERTAIN']) expect(validateApprenticeCommand({ type: 'REPORT', caseId, conclusion })).toBe(true);
    }
    for (const invalid of [
      null, [], {}, { type: 'BREW' }, { type: 'LEARN_FORMULA' }, { type: 'TELEPORT' }, { type: 'RECORD_SPELL' },
      { type: 'CARRY_COMPANION' }, { type: 'TRICK' }, { type: 'DISCOVER', free: true },
      { type: 'OBSERVE', caseId: 'unknown' }, { type: 'OBSERVE', caseId: 'locked-office', force: true },
      { type: 'PREPARE', caseId: 'thick-store', method: 'DOOR', verified: true },
      { type: 'PREPARE', caseId: 'waiting-courtyard', method: 'FORCE' },
      { type: 'PREPARE', caseId: 'waiting-courtyard' },
      { type: 'PERFORM', caseId: 'locked-office', method: 'DOOR' },
      { type: 'RETURN', caseId: 'unknown' }, { type: 'RETURN', caseId: 'locked-office', companion: true },
      { type: 'PREPARE', caseId: 'locked-office', method: 'DOOR', companion: 'Xio' },
      { type: 'PERFORM', caseId: 'waiting-courtyard', destination: 'Tingen' },
      { type: 'PREPARE', caseId: 'unknown', method: 'ORDINARY' }, { type: 'REFLECT', caseId: 'locked-office' },
      { type: 'REPORT', caseId: 'unknown', conclusion: 'LIMITED' },
      { type: 'REPORT', caseId: 'locked-office' },
      { type: 'REPORT', caseId: 'locked-office', conclusion: 'IDENTIFIED' },
      { type: 'REPORT', caseId: 'locked-office', conclusion: 'CERTAIN', allBarriers: true },
      { type: 'WITHDRAW', caseId: 'waiting-courtyard', success: true },
      { type: 'BUY_POTION', bottleId: 'apprentice-potion-0' }, { type: 'BUY_POTION', bottleId: 'apprentice-potion-01' },
      { type: 'BUY_POTION', bottleId: 'apprentice-potion-1000000000000000' },
      { type: 'BUY_POTION', bottleId: 'reader-potion-1' }, { type: 'CONSUME', bottleId: 'apprentice-potion-1' },
      { type: 'CONSUME', bottleId: 'apprentice-potion-1', confirmed: false },
    ]) expect(validateApprenticeCommand(invalid)).toBe(false);
    expect(isApprenticeAcquisitionCommand({ type: 'DISCOVER' })).toBe(true);
    expect(isApprenticeAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    expect(isApprenticeAcquisitionCommand({ type: 'RETURN', caseId: 'locked-office' })).toBe(false);
    expect(isApprenticeAcquisitionCommand({ type: 'OBSERVE', caseId: 'locked-office' })).toBe(false);
    expect(isApprenticeAcquisitionCommand({ type: 'REPORT', caseId: 'locked-office', conclusion: 'LIMITED' })).toBe(false);
    const s = guided();
    for (const invalid of [
      { type: 'REFLECT' }, { type: 'OBSERVE', caseId: 'locked-office' },
      { type: 'PREPARE', caseId: 'thick-store', method: 'DOOR' }, { type: 'PERFORM', caseId: 'waiting-courtyard' },
      { type: 'REPORT', caseId: 'waiting-courtyard', conclusion: 'LIMITED' },
      { type: 'WITHDRAW', caseId: 'locked-office' }, { type: 'RETURN', caseId: 'locked-office' },
      { type: 'BUY_POTION', bottleId: APPRENTICE_BOTTLE_IDS[0], cost: 0 },
    ]) rejected(s, invalid as unknown as ApprenticeAcquisitionCommand);
  });

  it('projects sourced S9 boundaries and detached public data without higher powers or organization binding', () => {
    const s = prepared(); buy(s, 1); apply(s, { type: 'CONSUME', bottleId: APPRENTICE_BOTTLE_IDS[0], confirmed: true });
    const before = JSON.stringify(s), p = projectApprentice(s), text = JSON.stringify(APPRENTICE_ABILITIES);
    expect(p.abilities.map(a => a.id)).toEqual([...APPRENTICE_ABILITY_IDS]);
    expect(p.story).toBe(APPRENTICE_SOURCE_STATUS);
    for (const boundary of ['第一部第107章', '佛尔思独自穿过', '不能带休', '不让同伴自动同行', '原门须从内侧实际开启', '厚度数值与负重上限尚未核定', '远距离传送', '记录法术', '序列8戏法', '本作原创G', '成年独立导师', '诺拉·维恩']) expect(p.story).toContain(boundary);
    for (const boundary of ['本人穿过', '不会自动开锁', '从内侧实际打开原门', '不能带休', '不携人穿越', '不远距离传送', '不记录法术', '序列8戏法', '普通退路']) expect(text).toContain(boundary);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.risk).toContain('意志难度5'); expect(p.risk).toContain('不适用于战斗');
    expect(p.cases).toEqual([]); expect(p.acting).toBe(0);
    expect(Object.hasOwn(s.apprentice, 'encounter')).toBe(false);
    expect(Object.hasOwn(s.apprentice, 'promotionWeek')).toBe(false);
    p.abilities[0]!.mastery = 500; p.bottles[0]!.source = 'changed'; p.actions[0]!.label = 'changed';
    expect(JSON.stringify(s)).toBe(before);
  });

  it('keeps the unverified recipe unavailable and all source bottles independent of organizations', () => {
    const s = guided(), p = projectApprentice(s);
    for (const boundary of ['完整配方尚未核实', '材料名称、主辅分类、数量与投料顺序', '不构成完整制造配方', '本作原创G', '不编造任何原料']) expect(APPRENTICE_FORMULA_STATUS).toContain(boundary);
    expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([]);
    expect(p.actions.some(action => ['LEARN_FORMULA', 'BUY_MATERIALS', 'BREW'].includes(action.command.type))).toBe(false);
    expect(new Set(s.apprentice.bottles.map(bottle => bottle.source)).size).toBe(3);
    expect(s.apprentice.bottles.every(bottle => bottle.source.includes('未声称现场配制') && bottle.source.includes('不建立任何家族或组织身份'))).toBe(true);
    expect(APPRENTICE_ABILITIES.map(ability => ability.id)).toEqual(['door.s9.door-opening']);
  });

  it('rejects forged original identities, provenance, ownership, outcomes, delivery timing and abilities', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.apprentice.discovered = false; },
      (s: SliceState) => { s.apprentice.guidanceKnown = false; },
      (s: SliceState) => { s.apprentice.bottles.pop(); },
      (s: SliceState) => { s.apprentice.bottles[0]!.id = 'apprentice-potion-2'; },
      (s: SliceState) => { s.apprentice.bottles[0]!.source = 'fabricated formula'; },
      (s: SliceState) => { s.apprentice.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.apprentice.bottles[0]!.acquiredWeek = null; },
      (s: SliceState) => { s.apprentice.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.apprentice.bottles[0]!.outcome = null; },
      (s: SliceState) => { s.apprentice.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.progression.mastery['door.s8.tricks'] = 0; },
      (s: SliceState) => { delete s.progression.mastery['door.s9.door-opening']; },
      (s: SliceState) => { s.progression.mastery['door.s9.door-opening'] = 501; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateApprenticeState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.apprentice.resupply.deliveries = 0; },
      (s: SliceState) => { s.apprentice.bottles[3]!.id = 'apprentice-potion-7'; },
      (s: SliceState) => { s.apprentice.bottles[3]!.source = s.apprentice.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.apprentice.bottles[4]!.source = s.apprentice.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.apprentice.bottles[0]!.status = 'PLAYER'; s.apprentice.bottles[0]!.outcome = null; s.apprentice.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.apprentice.bottles[3]!.status = 'PLAYER'; s.apprentice.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.apprentice.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateApprenticeState(s)).toBe(false); }
  });

  it('round-trips real states and rejects malformed or pre-promotion case activity', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) expect(validateApprenticeState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    for (const mutate of [
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.attemptWeek = 5; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.withdrawals = 1; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.method = 'DOOR'; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.conclusion = 'LIMITED'; },
      (s: SliceState) => { s.apprentice.reflected = true; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.position = 'INSIDE'; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.ordinaryOpen = true; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.mistakes = 1; },
      (s: SliceState) => { s.progression.mastery['door.s9.door-opening'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateApprenticeState(s)).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { delete s.apprentice.cases['waiting-courtyard']; },
      (s: SliceState) => { s.apprentice.cases['invented'] = { status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, mistakes: 0, conclusion: null, position: 'OUTSIDE', ordinaryOpen: false }; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.attemptWeek = 4; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.attemptWeek = 6; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.withdrawals = -1; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.withdrawals = 0.5; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.mistakes = -1; },
      (s: SliceState) => { s.apprentice.cases['waiting-courtyard']!.mistakes = 0.5; },
      (s: SliceState) => { (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).method = 'FORCE'; },
      (s: SliceState) => { (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).status = 'IMAGINED'; },
      (s: SliceState) => { (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).conclusion = 'YES'; },
      (s: SliceState) => { (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).method = false; },
      (s: SliceState) => { (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).position = 'TELEPORTED'; },
      (s: SliceState) => { (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).ordinaryOpen = 'true'; },
      (s: SliceState) => { delete (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).position; },
      (s: SliceState) => { delete (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).ordinaryOpen; },
      (s: SliceState) => { (s.apprentice.cases['waiting-courtyard'] as unknown as Record<string, unknown>).text = 'hidden page'; },
      (s: SliceState) => { (s.apprentice as unknown as Record<string, unknown>).encounter = {}; },
      (s: SliceState) => { (s.apprentice as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateApprenticeState(s)).toBe(false); }
  });
});
