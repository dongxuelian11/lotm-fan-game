import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyMarauderCommand } from '../../src/domain/marauder/index.js';
import { applyMarauderActivity } from '../../src/domain/marauder/life.js';
import { MARAUDER_ABILITY_IDS, MARAUDER_CASE_IDS } from '../../src/domain/marauder/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applySwindlerCommand, createSwindlerState, isSwindlerAcquisitionCommand, projectSwindler,
  validateSwindlerCommand, validateSwindlerState,
} from '../../src/domain/swindler/index.js';
import {
  SWINDLER_ABILITIES, SWINDLER_BOTTLE_IDS, SWINDLER_FORMULA_STATUS, SWINDLER_GUIDE,
  SWINDLER_LABOUR_TASKS, SWINDLER_SOURCE_STATUS,
} from '../../src/domain/swindler/content.js';
import { SWINDLER_ABILITY_IDS, SWINDLER_CASE_IDS, type SwindlerAcquisitionCommand } from '../../src/domain/swindler/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('swindler-acquisition', sliceDefaultCreationSelection, 'swindler-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.swindler = createSwindlerState();
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
function marauder(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyMarauderCommand(s, { type: 'DISCOVER' }, c);
  applyMarauderCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMarauderCommand(s, { type: 'BUY_POTION', bottleId: s.marauder.bottles[0]!.id }, c);
  applyMarauderCommand(s, { type: 'CONSUME', bottleId: s.marauder.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[MARAUDER_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of MARAUDER_CASE_IDS) {
    applyMarauderActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyMarauderActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applyMarauderActivity(s, { type: 'PERFORM', caseId }, c, award);
    applyMarauderActivity(s, { type: 'RETURN', caseId }, c, award);
    applyMarauderActivity(s, { type: 'REPORT', caseId, conclusion: 'LIMITED' }, c, award);
  }
  applyMarauderActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(MARAUDER_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11;
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: SwindlerAcquisitionCommand, roll = 20) { applySwindlerCommand(s, command, context(s, roll).c); }
function taught(s = marauder()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.swindler.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) {
    const bottle = buy(s, index);
    apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
  }
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as SwindlerAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('independent Swindler finished-potion acquisition', () => {
  it('starts with three sealed S8 originals and hides unearned supply and activities', () => {
    const s = ordinary(), p = projectSwindler(s);
    expect(validateSwindlerState(s)).toBe(true);
    expect(s.swindler.bottles.map(b => b.id)).toEqual([...SWINDLER_BOTTLE_IDS]);
    expect(s.swindler.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/swindler-potion|1050|1210/);
    expect(s.swindler).not.toHaveProperty('originals');
    expect(s.swindler).not.toHaveProperty('insideCase');
    expect(Object.keys(s.swindler.cases)).toEqual([...SWINDLER_CASE_IDS]);
    expect(Object.values(s.swindler.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' })));
    const separate = createSwindlerState();
    separate.bottles[0]!.labourSteps = 3;
    separate.cases['rehearsed-message']!.status = 'OBSERVED';
    expect(s.swindler.bottles[0]!.labourSteps).toBe(0);
    expect(s.swindler.cases['rehearsed-message']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing adult independent mentor and pays 180 plus one AP without altering S9 facts', () => {
    const s = marauder(), prior = JSON.stringify(s.marauder), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    expect(SWINDLER_GUIDE).toContain('艾德温·洛克');
    expect(projectSwindler(s).actions.map(a => a.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(projectSwindler(s).bottles).toHaveLength(3);
    expect(projectSwindler(s).bottles.every(b => b.source.includes('新进阶') && b.source.includes('序列8') && b.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: SWINDLER_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: SWINDLER_BOTTLE_IDS[0] });
    applySwindlerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.swindler.guidanceKnown]).toEqual([9820, 39, true]);
    expect([JSON.stringify(s.marauder), JSON.stringify(s.progression), JSON.stringify(s.world)]).toEqual([prior, progression, world]);
    expect(projectSwindler(s).supplies).toContain(SWINDLER_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的偷盗者存药');
    expect(validateSwindlerState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 1210 and zero AP for only the selected original, without partial labour discounts', () => {
    const s = taught(), prior = JSON.stringify(s.marauder), otherBottles = JSON.stringify(s.swindler.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: SWINDLER_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.swindler.bottles.slice(1))).toBe(otherBottles);
    expect(JSON.stringify(s.marauder)).toBe(prior);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateSwindlerState(s)).toBe(true);
  });

  it('requires three separate one-AP jobs for the chosen bottle and then pays 160', () => {
    const s = taught(), bottle = s.swindler.bottles[0]!, ctx = context(s);
    for (let index = 0; index < 3; index += 1) {
      applySwindlerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectSwindler(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(SWINDLER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectSwindler(s).actions.find(a => a.id === `buy-${SWINDLER_BOTTLE_IDS[1]}`)!.cost).toContain('1210便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    s.cash = 159;
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    s.cash = 160;
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([0, 36, 'PLAYER']);
    expect(validateSwindlerState(s)).toBe(true);
  });

  it('can prepare early but needs 100 S9 acting and four whole S9 weeks for independent confirmation', () => {
    const s = marauder();
    s.week = 5;
    s.progression.acting = 0;
    taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
    s.week = 8; s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.swindler.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateSwindlerState(s)).toBe(true);
  });

  it('retains held originals after success but forbids further acquisition or repeat promotion', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
    expect(s.swindler.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: SWINDLER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: SWINDLER_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectSwindler(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateSwindlerState(s)).toBe(true);
  });

  it.each([
    ['wrong pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['unknown mentor', (s: SliceState) => { s.marauder.discovered = false; }],
    ['missing S9 guidance', (s: SliceState) => { s.marauder.guidanceKnown = false; }],
    ['away from Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['open event', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects consumption without mutation when %s', (_label, mutate) => {
    const s = prepared(); mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
  });

  it('permits zero-AP payment and confirmation, but charges instruction and labour', () => {
    const s = marauder(); s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s);
    rejected(s, { type: 'POTION_WORK', bottleId: SWINDLER_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
    expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 8]);
  });
});

describe('four-tier Swindler promotion preserves S9 and recoverable failure', () => {
  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s using one will12 check and no death draw', (roll, tier, mentalCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldMarauder = JSON.stringify(s.marauder), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectSwindler(s).bottles[0]!.chance;
    applySwindlerCommand(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.swindler.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['error', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.swindler.promotionWeek, s.swindler.marauderActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.marauder)).toBe(oldMarauder);
    for (const id of MARAUDER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 1], ['perception', 2], ['will', 2], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS] : [...MARAUDER_ABILITY_IDS]);
    if (success) {
      expect(s.progression.mastery['error.s8.deceit']).toBe(0);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectSwindler(s).abilities).toEqual(SWINDLER_ABILITIES.map(a => ({ ...a, mastery: 0 })));
    } else expect(projectSwindler(s).abilities).toEqual([]);
    expect(validateSwindlerState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps attributes and grants only deceit, with eloquence and planning under the same mastery', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(SWINDLER_ABILITY_IDS).toEqual(['error.s8.deceit']);
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/memory|trust|eloquence|planning|s7|time/);
  });

  it('caps rejection at100, preserves severe failure and requires recovery for another bottle', () => {
    const s = taught(); buy(s); buy(s, 1);
    s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: SWINDLER_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateSwindlerState(s)).toBe(true);
  });
});

describe('finite cross-week Swindler resupply', () => {
  it('requires all failed originals, one request AP, a later week, and a fresh per-bottle payment', () => {
    const s = exhausted(), originals = JSON.stringify(s.swindler.bottles), priorS9 = JSON.stringify(s.marauder);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectSwindler(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 1;
    const cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.swindler.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.swindler.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(projectSwindler(s).actions.find(a => a.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    expect(validateSwindlerState(s)).toBe(true);
    s.week = 12;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(s.swindler.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.swindler.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.marauder)).toBe(priorS9);
    expect(s.swindler.bottles.slice(3).map(b => b.id)).toEqual(['swindler-potion-4', 'swindler-potion-5', 'swindler-potion-6']);
    expect(s.swindler.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'swindler-potion-4', confirmed: true });
    expect(validateSwindlerState(clone(s))).toBe(true);
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i++) apply(s, { type: 'POTION_WORK', bottleId: 'swindler-potion-4' });
    buy(s, 3);
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash - 160]);
    apply(s, { type: 'CONSUME', bottleId: 'swindler-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.swindler.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.swindler.bottles.slice(0, 3))).toBe(originals);
    expect(validateSwindlerState(s)).toBe(true);
  });

  it('does not refill automatically, reuse S9 labour, or request with an unused bottle or prior success', () => {
    for (const s of [ordinary(), marauder(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.swindler.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash; buy(s, 3);
    expect(s.cash).toBe(cash - 1210);
    expect(validateSwindlerState(s)).toBe(true);
  });
});

describe('Swindler exact commands and save chronology', () => {
  it('accepts every declared payload and classifies acquisition separately', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'swindler-potion-1' }, { type: 'BUY_POTION', bottleId: 'swindler-potion-999' },
      { type: 'CONSUME', bottleId: 'swindler-potion-1', confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' }, { type: 'RETURN_TOOL' }, ...SWINDLER_CASE_IDS.flatMap(caseId => ['OBSERVE', 'PERFORM', 'DISCLOSE', 'WITHDRAW'].map(type => ({ type, caseId }))),
      ...SWINDLER_CASE_IDS.flatMap(caseId => ['MISDIRECT', 'PLAIN'].map(method => ({ type: 'PREPARE', caseId, method }))),
    ];
    for (const command of [...acquisition, ...activities]) {
      expect(validateSwindlerCommand(command)).toBe(true);
      if (validateSwindlerCommand(command)) expect(isSwindlerAcquisitionCommand(command)).toBe(acquisition.includes(command));
    }
    for (const command of activities) rejected(prepared(), command);
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'marauder-potion-1' },
    { type: 'BUY_POTION', bottleId: 'swindler-potion-0' }, { type: 'BUY_POTION', bottleId: 'swindler-potion-01' },
    { type: 'BUY_POTION', bottleId: 'swindler-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'swindler-potion-1' }, { type: 'CONSUME', bottleId: 'swindler-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'swindler-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: '__proto__', method: 'PLAIN' },
    { type: 'PREPARE', caseId: 'rehearsed-message' }, { type: 'PREPARE', caseId: 'rehearsed-message', method: 'MEMORY' },
    { type: 'PERFORM', caseId: 'rehearsed-message', method: 'MISDIRECT' },
    { type: 'DISCLOSE', caseId: 'rehearsed-message', eraseMemory: true },
    { type: 'WITHDRAW' }, { type: 'REFLECT', caseId: 'rehearsed-message' }, { type: 'RETURN_TOOL', free: true },
  ])('rejects malformed or undeclared command %j without mutation', command => {
    expect(validateSwindlerCommand(command)).toBe(false);
    rejected(prepared(), command);
  });

  it('rejects bottle identity, price-work, source, chronology and inherited mastery forgery', () => {
    const s = promoted();
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.swindler.bottles[0]!.id = 'marauder-potion-1'; }, x => { x.swindler.bottles[0]!.source = 'invented'; },
      x => { x.swindler.bottles[0]!.labourSteps = 4; }, x => { x.swindler.bottles[0]!.acquiredWeek = 4; },
      x => { x.swindler.bottles[0]!.consumedWeek = 10; }, x => { x.swindler.bottles[0]!.consumedWeek = 12; },
      x => { x.swindler.bottles[0]!.outcome = 'FAILURE'; }, x => { x.swindler.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.swindler.bottles[1]!.acquiredWeek = 11; }, x => { x.swindler.promotionWeek = 10; },
      x => { x.swindler.marauderActingAtPromotion = 99; }, x => { x.progression.promotionWeek = 11; },
      x => { x.swindler.guidanceKnown = false; }, x => { delete x.progression.mastery[MARAUDER_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[SWINDLER_ABILITY_IDS[0]]; }, x => { x.progression.mastery[SWINDLER_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['error.s8.memory-rewrite'] = 0; }, x => { x.swindler.bottles.push({ ...x.swindler.bottles[0]! }); },
      x => { delete x.swindler.cases['marked-decoy']; }, x => { (x.swindler as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateSwindlerState(bad)).toBe(false); }
  });

  it('rejects same-week or mixed-batch receipts and resurrected exhausted originals', () => {
    const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.swindler.resupply.deliveries = 0; }, x => { x.swindler.resupply.deliveries = 2; },
      x => { x.swindler.bottles[3]!.id = 'swindler-potion-7'; },
      x => { x.swindler.bottles[3]!.source = x.swindler.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.swindler.bottles[4]!.source = x.swindler.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.swindler.bottles[0]!.status = 'PLAYER'; x.swindler.bottles[0]!.outcome = null; x.swindler.bottles[0]!.consumedWeek = null; },
      x => { x.swindler.bottles[3]!.status = 'PLAYER'; x.swindler.bottles[3]!.acquiredWeek = 11; },
      x => { x.swindler.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateSwindlerState(bad)).toBe(false); }
    const pending = exhausted(); apply(pending, { type: 'REQUEST_SUPPLY' }); pending.swindler.resupply.requestedWeek = 10;
    expect(validateSwindlerState(pending)).toBe(false);
  });

  it('rejects malformed states without throwing and does not grant S8 activities before promotion', () => {
    const s = ordinary();
    for (const raw of [null, [], {}, { ...s.swindler, bottles: [null, null, null] }, { ...s.swindler, cases: null }]) {
      const bad = clone(s); bad.swindler = raw as unknown as SliceState['swindler'];
      expect(validateSwindlerState(bad)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.swindler.guidanceKnown = true; }, (x: SliceState) => { x.swindler.reflected = true; },
      (x: SliceState) => { x.swindler.cases['rehearsed-message']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.progression.mastery[SWINDLER_ABILITY_IDS[0]] = 0; },
    ]) { const bad = clone(s); mutate(bad); expect(validateSwindlerState(bad)).toBe(false); }
    const ready = promoted(), original = ready.swindler.cases['rehearsed-message']!;
    for (const raw of [null, {}, { ...original, unknown: true }, { ...original, status: 'CONTROLLED' }, { ...original, method: 'MEMORY' }, { ...original, outcome: 'FORCED_TRUST' }, { ...original, withdrawals: -1 }, { ...original, attemptWeek: 10 }, { ...original, attemptWeek: 12 }]) {
      const bad = clone(ready); bad.swindler.cases['rehearsed-message'] = raw as unknown as SliceState['swindler']['cases'][string];
      expect(validateSwindlerState(bad)).toBe(false);
    }
    ready.swindler.cases['rehearsed-message'] = { status: 'EXAMINED', method: 'MISDIRECT', attemptWeek: 11, withdrawals: 1, outcome: 'NOTICE_SHIFTED' };
    expect(validateSwindlerState(ready)).toBe(true);
  });

  it('keeps canon and original gameplay separate and exposes no invented formula or extra power', () => {
    expect(SWINDLER_ABILITIES.map(a => a.id)).toEqual(['error.s8.deceit']);
    expect(SWINDLER_ABILITIES[0]!.description).toMatch(/口才与谋划/);
    expect(SWINDLER_ABILITIES[0]!.description).toMatch(/不能强制信任或改写记忆/);
    expect(SWINDLER_SOURCE_STATUS).toMatch(/第一部第65、175章/);
    expect(SWINDLER_SOURCE_STATUS).toMatch(/第八部第19章/);
    expect(SWINDLER_SOURCE_STATUS).toMatch(/时间转移.+玩法G/);
    expect(projectSwindler(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
