import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import {
  applyAssassinCommand, createAssassinState, isAssassinAcquisitionCommand, projectAssassin,
  validateAssassinCommand, validateAssassinState,
} from '../../src/domain/assassin/index.js';
import { ASSASSIN_ABILITIES, ASSASSIN_BOTTLE_IDS, ASSASSIN_FORMULA_STATUS, ASSASSIN_ORIGINAL_DRAFT, ASSASSIN_SOURCE_STATUS } from '../../src/domain/assassin/content.js';
import { ASSASSIN_ABILITY_IDS, ASSASSIN_CASE_IDS, type AssassinAcquisitionCommand } from '../../src/domain/assassin/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('assassin-acquisition', sliceDefaultCreationSelection, 'assassin-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.assassin = createAssassinState();
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
function apply(s: SliceState, command: AssassinAcquisitionCommand, roll = 20) { applyAssassinCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.assassin.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of ASSASSIN_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() {
  const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s;
}
function rejected(s: SliceState, command: AssassinAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Assassin finite finished-potion acquisition', () => {
  it('starts with three separate originals and untouched case state, exposing no undiscovered inventory', () => {
    const s = ordinary(), p = projectAssassin(s);
    expect(validateAssassinState(s)).toBe(true);
    expect(s.assassin.bottles.map(b => b.id)).toEqual([...ASSASSIN_BOTTLE_IDS]);
    expect(s.assassin.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.assassin.cases)).toEqual([...ASSASSIN_CASE_IDS]);
    expect(Object.values(s.assassin.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.outcome === 'NONE' && w.position === 'START')).toBe(true);
    expect(s.assassin.reflected).toBe(false);
    expect(s.assassin.draft).toEqual(ASSASSIN_ORIGINAL_DRAFT);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], draft: null, insideCase: false, environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('assassin-potion-');
    const separate = createAssassinState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['upper-draft']!.status = 'OBSERVED';
    separate.draft.custodian = 'PLAYER';
    expect(s.assassin.bottles[0]!.labourSteps).toBe(0);
    expect(s.assassin.cases['upper-draft']!.status).toBe('AVAILABLE');
    expect(s.assassin.draft.custodian).toBe('NOAELA');
  });

  it('charges discovery and guidance exactly, without magic, organization membership or a recipe', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyAssassinCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.assassin.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(projectAssassin(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: ASSASSIN_BOTTLE_IDS[0] });
    applyAssassinCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.assassin.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectAssassin(s).supplies).toContain(ASSASSIN_FORMULA_STATUS);
    expect(projectAssassin(s).formulaKnown).toBe(false);
    expect(projectAssassin(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateAssassinState(s)).toBe(true);
  });

  it('buys only the selected original for 660 pence and zero AP, with no partial labour discount', () => {
    const s = guided(), untouched = JSON.stringify(s.assassin.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: ASSASSIN_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: ASSASSIN_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.assassin.bottles.slice(1))).toBe(untouched);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateAssassinState(s)).toBe(true);
  });

  it('requires two real one-AP jobs on the same bottle, then 60 pence to transfer that original', () => {
    const s = guided(), bottle = s.assassin.bottles[0]!, ctx = context(s);
    applyAssassinCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectAssassin(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyAssassinCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成灯具与软垫点验', '完成楼梯与练习区清理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectAssassin(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectAssassin(s).actions.find(a => a.id === `buy-${ASSASSIN_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.assassin.cases).toEqual(createAssassinState().cases);
    expect(validateAssassinState(s)).toBe(true);
  });

  it('rejects insufficient funds, unowned or foreign bottles and AP-consuming preparation atomically', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['assassin-potion-4', 'hunter-potion-1', 'savant-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: ASSASSIN_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: ASSASSIN_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: ASSASSIN_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: ASSASSIN_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: ASSASSIN_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('allows early preparation but requires four completed ordinary weeks and independent confirmation', () => {
    const s = ordinary(); s.week = 1; guided(s); buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectAssassin(s).actions.find(a => a.id === `consume-${ASSASSIN_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: false } as unknown as AssassinAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: true });
    expect(s.assassin.bottles[0]).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateAssassinState(s)).toBe(true);
  });

  it('uses exactly one will difficulty-five check for all four recoverable promotion outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applyAssassinCommand(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.assassin.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'demoness' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(ASSASSIN_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 2, perception: stats.perception + 2, will: stats.will + 1, knowledge: stats.knowledge } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateAssassinState(s)).toBe(true);
    }
  });

  it('never refills spirituality, caps enhanced stats, and preserves severe rejection for actual recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectAssassin(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.assassin.bottles[0]!.status).toBe('CONSUMED');
    expect(validateAssassinState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: ASSASSIN_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.assassin.bottles[0]).toEqual(failed.assassin.bottles[0]);
  });

  it('retains unused originals and blocks second promotion or changing an already chosen pathway', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: ASSASSIN_BOTTLE_IDS[2] });
    expect(s.assassin.bottles[1]!.status).toBe('PLAYER');
    expect(projectAssassin(s).actions.find(a => a.id === `consume-${ASSASSIN_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared(), c = context(other).c;
    applySeerCommand(other, { type: 'DISCOVER' }, c);
    applySeerCommand(other, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(other, { type: 'BUY_MATERIALS', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'BREW', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'CONSUME', bottleId: other.seer.bottles[0]!.id, confirmed: true }, c);
    expect(other.progression.pathwayId).toBe('diviner');
    rejected(other, { type: 'CONSUME', bottleId: ASSASSIN_BOTTLE_IDS[0], confirmed: true });
    expect(other.assassin.bottles[0]!.status).toBe('PLAYER');
    expect(validateAssassinState(other)).toBe(true);
    expect(validateAssassinState(s)).toBe(true);
  });

  it('only resupplies after all failures, an explicit paid-AP request, and a later actual week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectAssassin(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.assassin.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const requestCash = s.cash;
    s = applySliceIntent(s, { type: 'ASSASSIN', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.assassin.resupply.requestedWeek]).toEqual([5, 1, requestCash, 5]);
    expect(JSON.stringify(s.assassin.bottles)).toBe(originals);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6); expect(s.date).not.toEqual(priorDate);
    expect(s.assassin.bottles).toHaveLength(3);
    const cash = s.cash, ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'ASSASSIN', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap]);
    expect(s.assassin.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.assassin.bottles.slice(3).map(b => b.id)).toEqual(['assassin-potion-4', 'assassin-potion-5', 'assassin-potion-6']);
    expect(s.assassin.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    expect(JSON.stringify(s.assassin.bottles.slice(0, 3))).toBe(originals);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'assassin-potion-4', confirmed: true });
    buy(s, 3);
    expect(s.cash).toBe(cash - 660);
    apply(s, { type: 'CONSUME', bottleId: 'assassin-potion-4', confirmed: true });
    expect(s.progression.pathwayId).toBe('demoness');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.assassin.bottles.slice(0, 3))).toBe(originals);
    expect(validateAssassinState(s)).toBe(true);
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
      rejected(s, { type: 'BUY_POTION', bottleId: ASSASSIN_BOTTLE_IDS[0] });
    }
  });

  it('conserves every earlier batch through a second requested delivery, without inherited labour credit', () => {
    const s = resupplied();
    s.health = 100; s.mind = 100;
    for (let index = 3; index < 6; index += 1) buy(s, index);
    for (const bottle of s.assassin.bottles.slice(3)) apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    const earlier = JSON.stringify(s.assassin.bottles), cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 7;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.assassin.resupply).toEqual({ requestedWeek: null, deliveries: 2 });
    expect(JSON.stringify(s.assassin.bottles.slice(0, 6))).toBe(earlier);
    expect(s.assassin.bottles.slice(6).map(bottle => bottle.id)).toEqual(['assassin-potion-7', 'assassin-potion-8', 'assassin-potion-9']);
    expect(s.assassin.bottles.slice(6).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第7周实收入库'))).toBe(true);
    expect(s.cash).toBe(cash);
    expect(s.seer.pollution).toBe(100);
    expect(validateAssassinState(s)).toBe(true);
    apply(s, { type: 'POTION_WORK', bottleId: 'assassin-potion-7' });
    apply(s, { type: 'POTION_WORK', bottleId: 'assassin-potion-7' });
    buy(s, 6);
    expect(s.cash).toBe(cash - 60);
    expect(projectAssassin(s).actions.find(action => action.id === 'buy-assassin-potion-8')!.cost).toContain('660便士');
    expect(validateAssassinState(s)).toBe(true);
  });

  it('accepts exact acquisition, activity and explicit return-route commands only', () => {
    for (const type of ['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT']) expect(validateAssassinCommand({ type })).toBe(true);
    for (const type of ['POTION_WORK', 'BUY_POTION']) expect(validateAssassinCommand({ type, bottleId: 'assassin-potion-4' })).toBe(true);
    expect(validateAssassinCommand({ type: 'CONSUME', bottleId: 'assassin-potion-1', confirmed: true })).toBe(true);
    for (const caseId of ASSASSIN_CASE_IDS) {
      for (const type of ['OBSERVE', 'PERFORM', 'REPORT', 'WITHDRAW']) expect(validateAssassinCommand({ type, caseId })).toBe(true);
      for (const method of ['SKILL', 'ORDINARY']) expect(validateAssassinCommand({ type: 'PREPARE', caseId, method })).toBe(true);
      for (const route of ['LIGHTNESS', 'STAIRS']) expect(validateAssassinCommand({ type: 'RETURN', caseId, route })).toBe(true);
    }
    for (const invalid of [
      null, [], {}, { type: 'BREW' }, { type: 'LEARN_FORMULA' }, { type: 'BUY_MATERIALS' },
      { type: 'BLACK_FLAME' }, { type: 'FLIGHT' }, { type: 'INSTANT_KILL' }, { type: 'DISCOVER', free: true },
      { type: 'OBSERVE', caseId: 'unknown' }, { type: 'OBSERVE', caseId: 'dim-sign', force: true },
      { type: 'PREPARE', caseId: 'dim-sign', method: 'SKILL', verified: true },
      { type: 'PREPARE', caseId: 'upper-draft', method: 'MAGIC' }, { type: 'PREPARE', caseId: 'upper-draft' },
      { type: 'PERFORM', caseId: 'upper-draft', method: 'SKILL' },
      { type: 'REPORT', caseId: 'upper-draft', conclusion: 'CERTAIN' },
      { type: 'WITHDRAW', caseId: 'shadow-cross', success: true },
      { type: 'RETURN_TOOL' }, { type: 'RETURN', caseId: 'upper-draft' },
      { type: 'RETURN', caseId: 'upper-draft', route: 'FLY' },
      { type: 'RETURN', caseId: 'upper-draft', route: 'STAIRS', free: true },
      { type: 'RETURN', caseId: 'unknown', route: 'LIGHTNESS' },
      { type: 'REFLECT', caseId: 'dim-sign' },
      { type: 'BUY_POTION', bottleId: 'assassin-potion-0' }, { type: 'BUY_POTION', bottleId: 'assassin-potion-01' },
      { type: 'BUY_POTION', bottleId: 'assassin-potion-1000000000000000' },
      { type: 'BUY_POTION', bottleId: 'marauder-potion-1' }, { type: 'CONSUME', bottleId: 'assassin-potion-1' },
      { type: 'CONSUME', bottleId: 'assassin-potion-1', confirmed: false },
    ]) expect(validateAssassinCommand(invalid)).toBe(false);
    expect(isAssassinAcquisitionCommand({ type: 'DISCOVER' })).toBe(true);
    const s = guided();
    for (const command of [
      { type: 'REFLECT' }, { type: 'RETURN', caseId: 'upper-draft', route: 'STAIRS' }, { type: 'OBSERVE', caseId: 'dim-sign' },
      { type: 'PREPARE', caseId: 'upper-draft', method: 'SKILL' }, { type: 'PERFORM', caseId: 'upper-draft' },
      { type: 'REPORT', caseId: 'shadow-cross' }, { type: 'WITHDRAW', caseId: 'dim-sign' },
    ] as const) {
      expect(isAssassinAcquisitionCommand(command)).toBe(false);
      rejected(s, command as unknown as AssassinAcquisitionCommand);
    }
    rejected(s, { type: 'BUY_POTION', bottleId: ASSASSIN_BOTTLE_IDS[0], cost: 0 } as unknown as AssassinAcquisitionCommand);
  });

  it('keeps S9 source limits explicit, separates original G content and detaches public data', () => {
    const s = promoted(), before = JSON.stringify(s), p = projectAssassin(s);
    expect(p.story).toBe(ASSASSIN_SOURCE_STATUS);
    for (const text of ['第一部第65章', '成年独立导师', '短暂轻身', '鹰般视力与黑暗视觉', '藏入阴影', '敏捷步伐', '将全身力量集中为一击', '不是飞行', '不是绝对隐形', '不是必中或必杀', '身体转变不属于序列9']) expect(ASSASSIN_SOURCE_STATUS).toContain(text);
    expect(ASSASSIN_ABILITIES.map(ability => ability.id)).toEqual([...ASSASSIN_ABILITY_IDS]);
    expect(p.abilities.every(ability => ability.mastery === 0)).toBe(true);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.cases).toEqual([]); expect(p.draft).toBeNull(); expect(p.insideCase).toBe(false); expect(p.environment).toBe('');
    expect(p.supplies).toContain(ASSASSIN_FORMULA_STATUS);
    expect(new Set(s.assassin.bottles.map(bottle => bottle.source)).size).toBe(3);
    expect(s.assassin.bottles.every(bottle => bottle.source.includes('未声称现场配制') && bottle.source.includes('不建立魔女教派或其它组织身份'))).toBe(true);
    p.bottles[0]!.source = 'changed'; p.abilities[0]!.mastery = 499; p.actions.splice(0);
    expect(JSON.stringify(s)).toBe(before);
    s.progression.acting = 100;
    expect(projectAssassin(s).digestion).toContain('已消化');
  });

  it('rejects forged bottle identities, provenance, outcomes, acquisition dates and promoted abilities', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.assassin.discovered = false; },
      (s: SliceState) => { s.assassin.guidanceKnown = false; },
      (s: SliceState) => { s.assassin.bottles.pop(); },
      (s: SliceState) => { s.assassin.bottles[0]!.id = 'assassin-potion-2'; },
      (s: SliceState) => { s.assassin.bottles[0]!.source = 'fabricated formula'; },
      (s: SliceState) => { s.assassin.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.assassin.bottles[0]!.acquiredWeek = null; },
      (s: SliceState) => { s.assassin.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.assassin.bottles[0]!.outcome = null; },
      (s: SliceState) => { s.assassin.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.progression.mastery['assassin.s7.black-flame'] = 0; },
      (s: SliceState) => { delete s.progression.mastery['assassin.s9.shadow']; },
      (s: SliceState) => { s.progression.mastery['assassin.s9.shadow'] = 501; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateAssassinState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.assassin.resupply.deliveries = 0; },
      (s: SliceState) => { s.assassin.bottles[3]!.id = 'assassin-potion-7'; },
      (s: SliceState) => { s.assassin.bottles[3]!.source = s.assassin.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.assassin.bottles[4]!.source = s.assassin.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.assassin.bottles[0]!.status = 'PLAYER'; s.assassin.bottles[0]!.outcome = null; s.assassin.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.assassin.bottles[3]!.status = 'PLAYER'; s.assassin.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.assassin.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateAssassinState(s)).toBe(false); }
  });

  it('round-trips acquisition while preserving the original draft and forbidding pre-promotion practice', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(validateAssassinState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
      expect(s.assassin.draft).toEqual(ASSASSIN_ORIGINAL_DRAFT);
      expect(projectAssassin(s).draft).toBeNull();
    }
    for (const mutate of [
      (s: SliceState) => { s.assassin.cases['dim-sign']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.assassin.cases['dim-sign']!.attemptWeek = 5; },
      (s: SliceState) => { s.assassin.cases['dim-sign']!.withdrawals = 1; },
      (s: SliceState) => { s.assassin.cases['dim-sign']!.method = 'SKILL'; },
      (s: SliceState) => { s.assassin.cases['dim-sign']!.outcome = 'SIGN_CHECKED'; },
      (s: SliceState) => { s.assassin.reflected = true; },
      (s: SliceState) => { s.assassin.cases['upper-draft']!.position = 'UPPER'; },
      (s: SliceState) => { s.assassin.draft.custodian = 'PLAYER'; s.assassin.draft.location = 'player:hand'; },
      (s: SliceState) => { s.assassin.draft.version = 3; },
      (s: SliceState) => { s.progression.mastery['assassin.s9.lightness'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateAssassinState(s)).toBe(false); }
  });

  it('rejects malformed exact case, body and draft shapes without inventing life transitions', () => {
    const rawCase = (s: SliceState) => s.assassin.cases['upper-draft'] as unknown as Record<string, unknown>;
    const rawDraft = (s: SliceState) => s.assassin.draft as unknown as Record<string, unknown>;
    for (const mutate of [
      (s: SliceState) => { delete s.assassin.cases['upper-draft']; },
      (s: SliceState) => { s.assassin.cases['copy'] = { ...s.assassin.cases['upper-draft']! }; },
      (s: SliceState) => { rawCase(s).status = 'IMAGINED'; },
      (s: SliceState) => { rawCase(s).method = 'MAGIC'; },
      (s: SliceState) => { rawCase(s).outcome = 'INVENTED'; },
      (s: SliceState) => { rawCase(s).position = 'FLYING'; },
      (s: SliceState) => { rawCase(s).position = 'UPPER'; },
      (s: SliceState) => { s.assassin.cases['dim-sign']!.position = 'UPPER'; },
      (s: SliceState) => { rawCase(s).attemptWeek = 4; },
      (s: SliceState) => { rawCase(s).attemptWeek = 6; },
      (s: SliceState) => { rawCase(s).withdrawals = -1; },
      (s: SliceState) => { rawCase(s).withdrawals = 0.5; },
      (s: SliceState) => { rawCase(s).secret = 'unknown'; },
      (s: SliceState) => { delete rawCase(s).outcome; },
      (s: SliceState) => { rawDraft(s).id = 'imagined-draft'; },
      (s: SliceState) => { rawDraft(s).owner = 'PLAYER'; },
      (s: SliceState) => { rawDraft(s).custodian = 'REMOTE'; },
      (s: SliceState) => { rawDraft(s).location = 'remote:hand'; },
      (s: SliceState) => { rawDraft(s).location = 'player:hand'; },
      (s: SliceState) => { rawDraft(s).version = 0; },
      (s: SliceState) => { rawDraft(s).version = 1.5; },
      (s: SliceState) => { rawDraft(s).version = Number.MAX_SAFE_INTEGER + 1; },
      (s: SliceState) => { rawDraft(s).copy = true; },
      (s: SliceState) => { delete rawDraft(s).owner; },
      (s: SliceState) => { (s.assassin as unknown as Record<string, unknown>).draft = []; },
      (s: SliceState) => { (s.assassin as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateAssassinState(s)).toBe(false); }
  });
});
