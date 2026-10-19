import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import {
  applySleeplessCommand, createSleeplessState, isSleeplessAcquisitionCommand, projectSleepless,
  validateSleeplessCommand, validateSleeplessState,
} from '../../src/domain/sleepless/index.js';
import { SLEEPLESS_ABILITIES, SLEEPLESS_BOTTLE_IDS, SLEEPLESS_FORMULA_STATUS } from '../../src/domain/sleepless/content.js';
import { SLEEPLESS_ABILITY_IDS, SLEEPLESS_WATCH_IDS, type SleeplessAcquisitionCommand } from '../../src/domain/sleepless/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('sleepless-acquisition', sliceDefaultCreationSelection, 'sleepless-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.sleepless = createSleeplessState();
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
function apply(s: SliceState, command: SleeplessAcquisitionCommand, roll = 20) { applySleeplessCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.sleepless.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of SLEEPLESS_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() {
  const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s;
}
function rejected(s: SliceState, command: SleeplessAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Sleepless finite finished-potion acquisition', () => {
  it('starts with three separate originals and untouched watch state, exposing no undiscovered inventory', () => {
    const s = ordinary(), p = projectSleepless(s);
    expect(validateSleeplessState(s)).toBe(true);
    expect(s.sleepless.bottles.map(b => b.id)).toEqual([...SLEEPLESS_BOTTLE_IDS]);
    expect(s.sleepless.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.sleepless.watches)).toEqual([...SLEEPLESS_WATCH_IDS]);
    expect(Object.values(s.sleepless.watches).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.method === null)).toBe(true);
    expect(s.sleepless.encounter).toEqual({ status: 'AVAILABLE', observed: false, night: false, attemptWeek: null, startHistoryIndex: null });
    expect(s.sleepless.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], watches: [], environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('sleepless-potion-');
    const separate = createSleeplessState();
    separate.bottles[0]!.labourSteps = 2;
    separate.watches['dark-stair'].status = 'SURVEYED';
    separate.encounter.observed = true;
    expect(s.sleepless.bottles[0]!.labourSteps).toBe(0);
    expect(s.sleepless.watches['dark-stair'].status).toBe('AVAILABLE');
    expect(s.sleepless.encounter.observed).toBe(false);
  });

  it('charges discovery and guidance exactly, without magic, organization membership or a recipe', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applySleeplessCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.sleepless.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(projectSleepless(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: SLEEPLESS_BOTTLE_IDS[0] });
    applySleeplessCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.sleepless.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectSleepless(s).supplies).toContain(SLEEPLESS_FORMULA_STATUS);
    expect(projectSleepless(s).formulaKnown).toBe(false);
    expect(projectSleepless(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateSleeplessState(s)).toBe(true);
  });

  it('buys only the selected original for 660 pence and zero AP, with no partial labour discount', () => {
    const s = guided(), untouched = JSON.stringify(s.sleepless.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: SLEEPLESS_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: SLEEPLESS_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.sleepless.bottles.slice(1))).toBe(untouched);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateSleeplessState(s)).toBe(true);
  });

  it('requires two real one-AP jobs on the same bottle, then 60 pence to transfer that original', () => {
    const s = guided(), bottle = s.sleepless.bottles[0]!, ctx = context(s);
    applySleeplessCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectSleepless(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applySleeplessCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成值班室清点', '完成交班登记']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectSleepless(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectSleepless(s).actions.find(a => a.id === `buy-${SLEEPLESS_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.sleepless.watches).toEqual(createSleeplessState().watches);
    expect(validateSleeplessState(s)).toBe(true);
  });

  it('rejects insufficient funds, unowned or foreign bottles and AP-consuming preparation atomically', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['sleepless-potion-4', 'hunter-potion-1', 'savant-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: SLEEPLESS_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: SLEEPLESS_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: SLEEPLESS_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: SLEEPLESS_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: SLEEPLESS_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('allows early preparation but requires four completed ordinary weeks and independent confirmation', () => {
    const s = ordinary(); s.week = 1; guided(s); buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectSleepless(s).actions.find(a => a.id === `consume-${SLEEPLESS_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: false } as unknown as SleeplessAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true });
    expect(s.sleepless.bottles[0]).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateSleeplessState(s)).toBe(true);
  });

  it('uses exactly one will difficulty-five check for all four recoverable promotion outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applySleeplessCommand(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.sleepless.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'darkness' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(SLEEPLESS_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 2, perception: stats.perception + 3, will: stats.will + 2, knowledge: stats.knowledge + 1 } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateSleeplessState(s)).toBe(true);
    }
  });

  it('never refills spirituality, caps enhanced stats, and preserves severe rejection for actual recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectSleepless(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.sleepless.bottles[0]!.status).toBe('CONSUMED');
    expect(validateSleeplessState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: SLEEPLESS_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.sleepless.bottles[0]).toEqual(failed.sleepless.bottles[0]);
  });

  it('retains unused originals and blocks second promotion or changing an already chosen pathway', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: SLEEPLESS_BOTTLE_IDS[2] });
    expect(s.sleepless.bottles[1]!.status).toBe('PLAYER');
    expect(projectSleepless(s).actions.find(a => a.id === `consume-${SLEEPLESS_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared(), c = context(other).c;
    applySeerCommand(other, { type: 'DISCOVER' }, c);
    applySeerCommand(other, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(other, { type: 'BUY_MATERIALS', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'BREW', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'CONSUME', bottleId: other.seer.bottles[0]!.id, confirmed: true }, c);
    expect(other.progression.pathwayId).toBe('diviner');
    rejected(other, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true });
    expect(other.sleepless.bottles[0]!.status).toBe('PLAYER');
    expect(validateSleeplessState(other)).toBe(true);
    expect(validateSleeplessState(s)).toBe(true);
  });

  it('only resupplies after all failures, an explicit paid-AP request, and a later actual week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectSleepless(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.sleepless.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const requestCash = s.cash;
    s = applySliceIntent(s, { type: 'SLEEPLESS', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.sleepless.resupply.requestedWeek]).toEqual([5, 1, requestCash, 5]);
    expect(JSON.stringify(s.sleepless.bottles)).toBe(originals);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6); expect(s.date).not.toEqual(priorDate);
    expect(s.sleepless.bottles).toHaveLength(3);
    const cash = s.cash, ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'SLEEPLESS', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap]);
    expect(s.sleepless.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.sleepless.bottles.slice(3).map(b => b.id)).toEqual(['sleepless-potion-4', 'sleepless-potion-5', 'sleepless-potion-6']);
    expect(s.sleepless.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    expect(JSON.stringify(s.sleepless.bottles.slice(0, 3))).toBe(originals);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'sleepless-potion-4', confirmed: true });
    buy(s, 3);
    expect(s.cash).toBe(cash - 660);
    apply(s, { type: 'CONSUME', bottleId: 'sleepless-potion-4', confirmed: true });
    expect(s.progression.pathwayId).toBe('darkness');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.sleepless.bottles.slice(0, 3))).toBe(originals);
    expect(validateSleeplessState(s)).toBe(true);
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
      rejected(s, { type: 'BUY_POTION', bottleId: SLEEPLESS_BOTTLE_IDS[0] });
    }
  });

  it('accepts only exact acquisition and watch commands, with no fabricated recipe or higher-sequence action', () => {
    for (const type of ['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT', 'OBSERVE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT']) expect(validateSleeplessCommand({ type })).toBe(true);
    for (const type of ['POTION_WORK', 'BUY_POTION']) expect(validateSleeplessCommand({ type, bottleId: 'sleepless-potion-4' })).toBe(true);
    expect(validateSleeplessCommand({ type: 'CONSUME', bottleId: 'sleepless-potion-1', confirmed: true })).toBe(true);
    for (const watchId of SLEEPLESS_WATCH_IDS) {
      expect(validateSleeplessCommand({ type: 'SURVEY', watchId })).toBe(true);
      for (const approach of ['OBSERVE', 'REPORT']) expect(validateSleeplessCommand({ type: 'WATCH', watchId, approach })).toBe(true);
    }
    for (const invalid of [null, [], {}, { type: 'BREW' }, { type: 'LEARN_FORMULA' }, { type: 'DREAM' }, { type: 'POEM' }, { type: 'DISCOVER', free: true }, { type: 'SURVEY', watchId: 'unknown' }, { type: 'SURVEY', watchId: 'dark-stair', force: true }, { type: 'WATCH', watchId: 'dark-stair', approach: 'HYPNOTIZE' }, { type: 'BUY_POTION', bottleId: 'sleepless-potion-0' }, { type: 'BUY_POTION', bottleId: 'sleepless-potion-01' }, { type: 'BUY_POTION', bottleId: 'savant-potion-1' }, { type: 'CONSUME', bottleId: 'sleepless-potion-1' }, { type: 'CONSUME', bottleId: 'sleepless-potion-1', confirmed: false }]) expect(validateSleeplessCommand(invalid)).toBe(false);
    expect(isSleeplessAcquisitionCommand({ type: 'DISCOVER' })).toBe(true);
    expect(isSleeplessAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    expect(isSleeplessAcquisitionCommand({ type: 'WATCH', watchId: 'dark-stair', approach: 'REPORT' })).toBe(false);
    const s = guided();
    for (const invalid of [{ type: 'REFLECT' }, { type: 'SURVEY', watchId: 'dark-stair' }, { type: 'BUY_POTION', bottleId: SLEEPLESS_BOTTLE_IDS[0], cost: 0 }]) rejected(s, invalid as unknown as SleeplessAcquisitionCommand);
  });

  it('projects three bounded S9 abilities, continued daytime rest and detached public data', () => {
    const s = prepared(); buy(s, 1); apply(s, { type: 'CONSUME', bottleId: SLEEPLESS_BOTTLE_IDS[0], confirmed: true });
    const before = JSON.stringify(s), p = projectSleepless(s), text = JSON.stringify(SLEEPLESS_ABILITIES);
    expect(p.abilities.map(a => a.id)).toEqual([...SLEEPLESS_ABILITY_IDS]);
    expect(text).toContain('白天仍需约三至四小时休息');
    expect(text).toContain('不逐小时模拟睡眠');
    expect(text).toContain('不能透视墙壁');
    expect(text).toContain('危险来源');
    expect(text).toContain('实际弹药或外部工具');
    expect(text).toContain('没有催眠诗歌或入梦能力');
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.risk).toContain('意志难度5'); expect(p.risk).toContain('不适用于战斗');
    expect(p.acting).toBe(0);
    p.abilities[0]!.mastery = 500; p.bottles[0]!.source = 'changed'; p.actions[0]!.label = 'changed';
    expect(JSON.stringify(s)).toBe(before);
  });

  it('rejects forged original identities, provenance, ownership, outcomes, delivery timing and abilities', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.sleepless.discovered = false; },
      (s: SliceState) => { s.sleepless.guidanceKnown = false; },
      (s: SliceState) => { s.sleepless.bottles.pop(); },
      (s: SliceState) => { s.sleepless.bottles[0]!.id = 'sleepless-potion-2'; },
      (s: SliceState) => { s.sleepless.bottles[0]!.source = 'fabricated formula'; },
      (s: SliceState) => { s.sleepless.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.sleepless.bottles[0]!.acquiredWeek = null; },
      (s: SliceState) => { s.sleepless.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.sleepless.bottles[0]!.outcome = null; },
      (s: SliceState) => { s.sleepless.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.progression.mastery['darkness.s8.poem'] = 0; },
      (s: SliceState) => { delete s.progression.mastery['darkness.s9.night-vision']; },
      (s: SliceState) => { s.progression.mastery['darkness.s9.night-vigor'] = 501; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateSleeplessState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.sleepless.resupply.deliveries = 0; },
      (s: SliceState) => { s.sleepless.bottles[3]!.id = 'sleepless-potion-7'; },
      (s: SliceState) => { s.sleepless.bottles[3]!.source = s.sleepless.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.sleepless.bottles[4]!.source = s.sleepless.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.sleepless.bottles[0]!.status = 'PLAYER'; s.sleepless.bottles[0]!.outcome = null; s.sleepless.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.sleepless.bottles[3]!.status = 'PLAYER'; s.sleepless.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.sleepless.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateSleeplessState(s)).toBe(false); }
  });

  it('round-trips real states and rejects malformed or pre-promotion watch and encounter activity', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) expect(validateSleeplessState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    for (const mutate of [
      (s: SliceState) => { s.sleepless.watches['dark-stair'].status = 'SURVEYED'; },
      (s: SliceState) => { s.sleepless.watches['dark-stair'].attemptWeek = 5; },
      (s: SliceState) => { s.sleepless.watches['dark-stair'].method = 'OBSERVE'; },
      (s: SliceState) => { s.sleepless.reflected = true; },
      (s: SliceState) => { s.sleepless.encounter.observed = true; },
      (s: SliceState) => { s.sleepless.encounter.night = true; },
      (s: SliceState) => { s.sleepless.encounter.status = 'FIGHTING'; },
      (s: SliceState) => { s.sleepless.encounter.attemptWeek = 5; },
      (s: SliceState) => { s.sleepless.encounter.startHistoryIndex = 0; },
      (s: SliceState) => { s.progression.mastery['darkness.s9.night-vision'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateSleeplessState(s)).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { delete (s.sleepless.watches as Record<string, unknown>)['dark-stair']; },
      (s: SliceState) => { s.sleepless.watches['dark-stair'].attemptWeek = 4; },
      (s: SliceState) => { (s.sleepless.watches['dark-stair'] as unknown as Record<string, unknown>).method = 'DREAM'; },
      (s: SliceState) => { s.sleepless.encounter.attemptWeek = 6; },
      (s: SliceState) => { s.sleepless.encounter.startHistoryIndex = 1; },
      (s: SliceState) => { (s.sleepless.encounter as unknown as Record<string, unknown>).night = 'ALWAYS'; },
      (s: SliceState) => { (s.sleepless as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateSleeplessState(s)).toBe(false); }
  });
});
