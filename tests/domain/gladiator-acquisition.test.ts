import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyWarriorCommand } from '../../src/domain/warrior/index.js';
import { applyWarriorActivity } from '../../src/domain/warrior/life.js';
import { WARRIOR_ABILITY_IDS, WARRIOR_CASE_IDS } from '../../src/domain/warrior/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyGladiatorCommand, createGladiatorState, isGladiatorAcquisitionCommand, projectGladiator,
  validateGladiatorCommand, validateGladiatorState,
} from '../../src/domain/gladiator/index.js';
import {
  GLADIATOR_ABILITIES, GLADIATOR_BOTTLE_IDS, GLADIATOR_FORMULA_STATUS, GLADIATOR_GUIDE,
  GLADIATOR_LABOUR_TASKS, GLADIATOR_SOURCE_STATUS,
} from '../../src/domain/gladiator/content.js';
import { GLADIATOR_ABILITY_IDS, GLADIATOR_CASE_IDS, type GladiatorAcquisitionCommand } from '../../src/domain/gladiator/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('gladiator-acquisition', sliceDefaultCreationSelection, 'gladiator-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.gladiator = createGladiatorState();
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
function warrior(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyWarriorCommand(s, { type: 'DISCOVER' }, c);
  applyWarriorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyWarriorCommand(s, { type: 'BUY_POTION', bottleId: s.warrior.bottles[0]!.id }, c);
  applyWarriorCommand(s, { type: 'CONSUME', bottleId: s.warrior.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[WARRIOR_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of WARRIOR_CASE_IDS) {
    applyWarriorActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyWarriorActivity(s, { type: 'PREPARE', caseId, method: 'TEAM' }, c, award);
    applyWarriorActivity(s, { type: 'PERFORM', caseId }, c, award);
    if (caseId === 'staff-drill') applyWarriorActivity(s, { type: 'RETURN_TOOL' }, c, award);
    applyWarriorActivity(s, { type: 'REPORT', caseId }, c, award);
  }
  applyWarriorActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(WARRIOR_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11;
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: GladiatorAcquisitionCommand, roll = 20) { applyGladiatorCommand(s, command, context(s, roll).c); }
function taught(s = warrior()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.gladiator.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true }); return s; }
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
  expect(() => apply(s, command as GladiatorAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('independent Gladiator finished-potion acquisition', () => {
  it('starts with three sealed S8 originals and hides unearned supply and activities', () => {
    const s = ordinary(), p = projectGladiator(s);
    expect(validateGladiatorState(s)).toBe(true);
    expect(s.gladiator.bottles.map(b => b.id)).toEqual([...GLADIATOR_BOTTLE_IDS]);
    expect(s.gladiator.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', insideCase: false, supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/gladiator-potion|1050|1210/);
    expect(s.gladiator).not.toHaveProperty('originals');
    expect(s.gladiator).not.toHaveProperty('insideCase');
    expect(Object.keys(s.gladiator.cases)).toEqual([...GLADIATOR_CASE_IDS]);
    expect(Object.values(s.gladiator.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', contact: 'NONE' })));
    const separate = createGladiatorState();
    separate.bottles[0]!.labourSteps = 3;
    separate.cases['agreed-stop']!.status = 'OBSERVED';
    expect(s.gladiator.bottles[0]!.labourSteps).toBe(0);
    expect(s.gladiator.cases['agreed-stop']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing adult independent mentor and pays 180 plus one AP without altering S9 facts', () => {
    const s = warrior(), prior = JSON.stringify(s.warrior), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    expect(GLADIATOR_GUIDE).toContain('奥斯温·布莱克特');
    expect(projectGladiator(s).actions.map(a => a.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(projectGladiator(s).bottles).toHaveLength(3);
    expect(projectGladiator(s).bottles.every(b => b.source.includes('新进阶') && b.source.includes('序列8') && b.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: GLADIATOR_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: GLADIATOR_BOTTLE_IDS[0] });
    applyGladiatorCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.gladiator.guidanceKnown]).toEqual([9820, 39, true]);
    expect([JSON.stringify(s.warrior), JSON.stringify(s.progression), JSON.stringify(s.world)]).toEqual([prior, progression, world]);
    expect(projectGladiator(s).supplies).toContain(GLADIATOR_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的战士存药');
    expect(validateGladiatorState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 1210 and zero AP for only the selected original, without partial labour discounts', () => {
    const s = taught(), prior = JSON.stringify(s.warrior), otherBottles = JSON.stringify(s.gladiator.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: GLADIATOR_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.gladiator.bottles.slice(1))).toBe(otherBottles);
    expect(JSON.stringify(s.warrior)).toBe(prior);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateGladiatorState(s)).toBe(true);
  });

  it('requires three separate one-AP jobs for the chosen bottle and then pays 160', () => {
    const s = taught(), bottle = s.gladiator.bottles[0]!, ctx = context(s);
    for (let index = 0; index < 3; index += 1) {
      applyGladiatorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectGladiator(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(GLADIATOR_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectGladiator(s).actions.find(a => a.id === `buy-${GLADIATOR_BOTTLE_IDS[1]}`)!.cost).toContain('1210便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    s.cash = 159;
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    s.cash = 160;
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([0, 36, 'PLAYER']);
    expect(validateGladiatorState(s)).toBe(true);
  });

  it('can prepare early but needs 100 S9 acting and four whole S9 weeks for independent confirmation', () => {
    const s = warrior();
    s.week = 5;
    s.progression.acting = 0;
    taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
    s.week = 8; s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.gladiator.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateGladiatorState(s)).toBe(true);
  });

  it('retains held originals after success but forbids further acquisition or repeat promotion', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.gladiator.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: GLADIATOR_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: GLADIATOR_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectGladiator(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateGladiatorState(s)).toBe(true);
  });

  it('keeps the inherited physical training club at its original mentor and never performs its return', () => {
    const s = warrior(), priorTool = { ...s.warrior.practiceClub }, priorTown = JSON.stringify(s.town);
    expect(priorTool).toMatchObject({
      id: 'warrior-training-club', owner: '奥斯温·布莱克特', custodian: 'MENTOR', location: 'training-rack', version: 3,
    });
    taught(s);
    for (let job = 0; job < 3; job += 1) apply(s, { type: 'POTION_WORK', bottleId: GLADIATOR_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.warrior.practiceClub).toEqual(priorTool);
    expect(JSON.stringify(s.town)).toBe(priorTown);
    expect(validateGladiatorCommand({ type: 'RETURN_TOOL' })).toBe(true);
    expect(isGladiatorAcquisitionCommand({ type: 'RETURN_TOOL' })).toBe(false);
    rejected(s, { type: 'RETURN_TOOL' });
    expect(s.warrior.practiceClub).toEqual(priorTool);
  });

  it.each([
    ['wrong pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['unknown mentor', (s: SliceState) => { s.warrior.discovered = false; }],
    ['missing S9 guidance', (s: SliceState) => { s.warrior.guidanceKnown = false; }],
    ['away from Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['open event', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects consumption without mutation when %s', (_label, mutate) => {
    const s = prepared(); mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
  });

  it('permits zero-AP payment and confirmation, but charges instruction and labour', () => {
    const s = warrior(); s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s);
    rejected(s, { type: 'POTION_WORK', bottleId: GLADIATOR_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
    expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 8]);
  });
});

describe('four-tier Gladiator promotion preserves S9 and recoverable failure', () => {
  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s using one will12 check and no death draw', (roll, tier, mentalCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldWarrior = JSON.stringify(s.warrior), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectGladiator(s).bottles[0]!.chance;
    applyGladiatorCommand(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.gladiator.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['warrior', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.gladiator.promotionWeek, s.gladiator.warriorActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.warrior)).toBe(oldWarrior);
    for (const id of WARRIOR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 3], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS] : [...WARRIOR_ABILITY_IDS]);
    if (success) {
      expect(s.progression.mastery['warrior.s8.combat-skill']).toBe(0);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectGladiator(s).abilities).toEqual(GLADIATOR_ABILITIES.map(a => ({ ...a, mastery: 0 })));
    } else expect(projectGladiator(s).abilities).toEqual([]);
    expect(validateGladiatorState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps attributes and grants only the one original G combat-skill category', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(GLADIATOR_ABILITY_IDS).toEqual(['warrior.s8.combat-skill']);
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/memory|trust|dawn|storm|s7|s6/);
  });

  it('caps rejection at100, preserves severe failure and requires recovery for another bottle', () => {
    const s = taught(); buy(s); buy(s, 1);
    s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: GLADIATOR_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateGladiatorState(s)).toBe(true);
  });
});

describe('finite cross-week Gladiator resupply', () => {
  it('requires all failed originals, one request AP, a later week, and a fresh per-bottle payment', () => {
    const s = exhausted(), originals = JSON.stringify(s.gladiator.bottles), priorS9 = JSON.stringify(s.warrior);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectGladiator(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 1;
    const cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.gladiator.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.gladiator.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(projectGladiator(s).actions.find(a => a.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    expect(validateGladiatorState(s)).toBe(true);
    s.week = 12;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(s.gladiator.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.gladiator.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.warrior)).toBe(priorS9);
    expect(s.gladiator.bottles.slice(3).map(b => b.id)).toEqual(['gladiator-potion-4', 'gladiator-potion-5', 'gladiator-potion-6']);
    expect(s.gladiator.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'gladiator-potion-4', confirmed: true });
    expect(validateGladiatorState(clone(s))).toBe(true);
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i++) apply(s, { type: 'POTION_WORK', bottleId: 'gladiator-potion-4' });
    buy(s, 3);
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash - 160]);
    apply(s, { type: 'CONSUME', bottleId: 'gladiator-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.gladiator.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.gladiator.bottles.slice(0, 3))).toBe(originals);
    expect(validateGladiatorState(s)).toBe(true);
  });

  it('does not refill automatically, reuse S9 labour, or request with an unused bottle or prior success', () => {
    for (const s of [ordinary(), warrior(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.gladiator.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash; buy(s, 3);
    expect(s.cash).toBe(cash - 1210);
    expect(validateGladiatorState(s)).toBe(true);
  });
});

describe('Gladiator exact commands and save chronology', () => {
  it('accepts every declared payload and classifies acquisition separately', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'gladiator-potion-1' }, { type: 'BUY_POTION', bottleId: 'gladiator-potion-999' },
      { type: 'CONSUME', bottleId: 'gladiator-potion-1', confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' }, { type: 'RETURN_TOOL' }, ...GLADIATOR_CASE_IDS.flatMap(caseId => ['OBSERVE', 'PERFORM', 'RELEASE', 'REPORT', 'WITHDRAW'].map(type => ({ type, caseId }))),
      ...GLADIATOR_CASE_IDS.flatMap(caseId => ['TECHNIQUE', 'TEAM'].map(method => ({ type: 'PREPARE', caseId, method }))),
    ];
    for (const command of [...acquisition, ...activities]) {
      expect(validateGladiatorCommand(command)).toBe(true);
      if (validateGladiatorCommand(command)) expect(isGladiatorAcquisitionCommand(command)).toBe(acquisition.includes(command));
    }
    for (const command of activities) rejected(prepared(), command);
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'warrior-potion-1' },
    { type: 'BUY_POTION', bottleId: 'gladiator-potion-0' }, { type: 'BUY_POTION', bottleId: 'gladiator-potion-01' },
    { type: 'BUY_POTION', bottleId: 'gladiator-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'gladiator-potion-1' }, { type: 'CONSUME', bottleId: 'gladiator-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'gladiator-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: '__proto__', method: 'TEAM' },
    { type: 'PREPARE', caseId: 'agreed-stop' }, { type: 'PREPARE', caseId: 'agreed-stop', method: 'MEMORY' },
    { type: 'PERFORM', caseId: 'agreed-stop', method: 'TECHNIQUE' },
    { type: 'REPORT', caseId: 'agreed-stop', eraseMemory: true },
    { type: 'RELEASE' }, { type: 'RELEASE', caseId: 'agreed-stop', force: true },
    { type: 'RETURN_TOOL', caseId: 'agreed-stop' },
    { type: 'WITHDRAW' }, { type: 'REFLECT', caseId: 'agreed-stop' }, { type: 'RETURN_TOOL', free: true },
  ])('rejects malformed or undeclared command %j without mutation', command => {
    expect(validateGladiatorCommand(command)).toBe(false);
    rejected(prepared(), command);
  });

  it('rejects bottle identity, price-work, source, chronology and inherited mastery forgery', () => {
    const s = promoted();
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.gladiator.bottles[0]!.id = 'warrior-potion-1'; }, x => { x.gladiator.bottles[0]!.source = 'invented'; },
      x => { x.gladiator.bottles[0]!.labourSteps = 4; }, x => { x.gladiator.bottles[0]!.acquiredWeek = 4; },
      x => { x.gladiator.bottles[0]!.consumedWeek = 10; }, x => { x.gladiator.bottles[0]!.consumedWeek = 12; },
      x => { x.gladiator.bottles[0]!.outcome = 'FAILURE'; }, x => { x.gladiator.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.gladiator.bottles[1]!.acquiredWeek = 11; }, x => { x.gladiator.promotionWeek = 10; },
      x => { x.gladiator.warriorActingAtPromotion = 99; }, x => { x.progression.promotionWeek = 11; },
      x => { x.gladiator.guidanceKnown = false; }, x => { delete x.progression.mastery[WARRIOR_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[GLADIATOR_ABILITY_IDS[0]]; }, x => { x.progression.mastery[GLADIATOR_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['warrior.s8.fear-immunity'] = 0; }, x => { x.gladiator.bottles.push({ ...x.gladiator.bottles[0]! }); },
      x => { delete x.gladiator.cases['interrupted-round']; }, x => { (x.gladiator as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateGladiatorState(bad)).toBe(false); }
  });

  it('rejects same-week or mixed-batch receipts and resurrected exhausted originals', () => {
    const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.gladiator.resupply.deliveries = 0; }, x => { x.gladiator.resupply.deliveries = 2; },
      x => { x.gladiator.bottles[3]!.id = 'gladiator-potion-7'; },
      x => { x.gladiator.bottles[3]!.source = x.gladiator.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.gladiator.bottles[4]!.source = x.gladiator.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.gladiator.bottles[0]!.status = 'PLAYER'; x.gladiator.bottles[0]!.outcome = null; x.gladiator.bottles[0]!.consumedWeek = null; },
      x => { x.gladiator.bottles[3]!.status = 'PLAYER'; x.gladiator.bottles[3]!.acquiredWeek = 11; },
      x => { x.gladiator.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateGladiatorState(bad)).toBe(false); }
    const pending = exhausted(); apply(pending, { type: 'REQUEST_SUPPLY' }); pending.gladiator.resupply.requestedWeek = 10;
    expect(validateGladiatorState(pending)).toBe(false);
  });

  it('rejects malformed states without throwing and does not grant S8 activities before promotion', () => {
    const s = ordinary();
    for (const raw of [null, [], {}, { ...s.gladiator, bottles: [null, null, null] }, { ...s.gladiator, cases: null }]) {
      const bad = clone(s); bad.gladiator = raw as unknown as SliceState['gladiator'];
      expect(validateGladiatorState(bad)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.gladiator.guidanceKnown = true; }, (x: SliceState) => { x.gladiator.reflected = true; },
      (x: SliceState) => { x.gladiator.cases['agreed-stop']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.progression.mastery[GLADIATOR_ABILITY_IDS[0]] = 0; },
    ]) { const bad = clone(s); mutate(bad); expect(validateGladiatorState(bad)).toBe(false); }
    const ready = promoted(), original = ready.gladiator.cases['agreed-stop']!;
    for (const raw of [null, {}, { ...original, unknown: true }, { ...original, status: 'CONTROLLED' }, { ...original, method: 'MEMORY' }, { ...original, outcome: 'FORCED_TRUST' }, { ...original, contact: 'CONTROLLED' }, { ...original, contact: undefined }, { ...original, withdrawals: -1 }, { ...original, attemptWeek: 10 }, { ...original, attemptWeek: 12 }]) {
      const bad = clone(ready); bad.gladiator.cases['agreed-stop'] = raw as unknown as SliceState['gladiator']['cases'][string];
      expect(validateGladiatorState(bad)).toBe(false);
    }
    ready.gladiator.cases['agreed-stop'] = { status: 'EXAMINED', method: 'TECHNIQUE', attemptWeek: 11, withdrawals: 1, outcome: 'EXERCISE_ENDED', contact: 'ENGAGED' };
    expect(validateGladiatorState(ready)).toBe(true);
  });

  it('keeps canon and original gameplay separate and exposes no invented formula or extra power', () => {
    expect(GLADIATOR_ABILITIES.map(a => a.id)).toEqual(['warrior.s8.combat-skill']);
    expect(GLADIATOR_ABILITIES[0]!.description).toMatch(/本作G训练分类/);
    expect(GLADIATOR_ABILITIES[0]!.description).toMatch(/仍受精神影响与恐惧干扰/);
    expect(GLADIATOR_SOURCE_STATUS).toMatch(/第一部第138章/);
    expect(GLADIATOR_SOURCE_STATUS).toContain('古称角斗士');
    expect(GLADIATOR_SOURCE_STATUS).toMatch(/第三部第118章奥兹尔/);
    expect(GLADIATOR_SOURCE_STATUS).toMatch(/实际接触与松开步骤.+原创G/);
    expect(GLADIATOR_SOURCE_STATUS).toMatch(/不提前开放序列6晨曦铠甲/);
    expect(projectGladiator(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
