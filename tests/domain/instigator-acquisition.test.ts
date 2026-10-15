import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyAssassinCommand } from '../../src/domain/assassin/index.js';
import { applyAssassinActivity } from '../../src/domain/assassin/life.js';
import { ASSASSIN_ABILITY_IDS, ASSASSIN_CASE_IDS } from '../../src/domain/assassin/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyInstigatorCommand, createInstigatorState, isInstigatorAcquisitionCommand, projectInstigator,
  validateInstigatorCommand, validateInstigatorState,
} from '../../src/domain/instigator/index.js';
import {
  INSTIGATOR_ABILITIES, INSTIGATOR_BOTTLE_IDS, INSTIGATOR_FORMULA_STATUS, INSTIGATOR_GUIDE,
  INSTIGATOR_LABOUR_TASKS, INSTIGATOR_SOURCE_STATUS,
} from '../../src/domain/instigator/content.js';
import { INSTIGATOR_ABILITY_IDS, INSTIGATOR_CASE_IDS, type InstigatorAcquisitionCommand } from '../../src/domain/instigator/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

// Synthetic acquisition fixture: elevated cash/AP and fixed rolls isolate domain boundaries.
// This is not a naturally played save or an end-to-end seed verification.
function ordinary(): SliceState {
  const s = createSliceRun('instigator-acquisition', sliceDefaultCreationSelection, 'instigator-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.instigator = createInstigatorState();
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
function assassin(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyAssassinCommand(s, { type: 'DISCOVER' }, c);
  applyAssassinCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyAssassinCommand(s, { type: 'BUY_POTION', bottleId: s.assassin.bottles[0]!.id }, c);
  applyAssassinCommand(s, { type: 'CONSUME', bottleId: s.assassin.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[ASSASSIN_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of ASSASSIN_CASE_IDS) {
    applyAssassinActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyAssassinActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applyAssassinActivity(s, { type: 'PERFORM', caseId }, c, award);
    if (caseId === 'upper-draft') applyAssassinActivity(s, { type: 'RETURN', caseId, route: 'STAIRS' }, c, award);
    applyAssassinActivity(s, { type: 'REPORT', caseId }, c, award);
  }
  applyAssassinActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(ASSASSIN_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11;
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: InstigatorAcquisitionCommand, roll = 20) { applyInstigatorCommand(s, command, context(s, roll).c); }
function taught(s = assassin()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.instigator.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true }); return s; }
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
  expect(() => apply(s, command as InstigatorAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('independent Instigator finished-potion acquisition', () => {
  it('starts with three sealed S8 originals and hides unearned supply and activities', () => {
    const s = ordinary(), p = projectInstigator(s);
    expect(validateInstigatorState(s)).toBe(true);
    expect(s.instigator.bottles.map(b => b.id)).toEqual([...INSTIGATOR_BOTTLE_IDS]);
    expect(s.instigator.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', insideCase: false, supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/instigator-potion|1050|1210/);
    expect(s.instigator).not.toHaveProperty('originals');
    expect(s.instigator).not.toHaveProperty('insideCase');
    expect(Object.keys(s.instigator.cases)).toEqual([...INSTIGATOR_CASE_IDS]);
    expect(Object.values(s.instigator.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE', tension: 'CALM' })));
    const separate = createInstigatorState();
    separate.bottles[0]!.labourSteps = 3;
    separate.cases['queue-grievance']!.status = 'OBSERVED';
    expect(s.instigator.bottles[0]!.labourSteps).toBe(0);
    expect(s.instigator.cases['queue-grievance']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing adult independent mentor and pays 180 plus one AP without altering S9 facts', () => {
    const s = assassin(), prior = JSON.stringify(s.assassin), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    expect(INSTIGATOR_GUIDE).toContain('诺艾拉·温瑟');
    expect(projectInstigator(s).actions.map(a => a.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(projectInstigator(s).bottles).toHaveLength(3);
    expect(projectInstigator(s).bottles.every(b => b.source.includes('新进阶') && b.source.includes('序列8') && b.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: INSTIGATOR_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: INSTIGATOR_BOTTLE_IDS[0] });
    applyInstigatorCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.instigator.guidanceKnown]).toEqual([9820, 39, true]);
    expect([JSON.stringify(s.assassin), JSON.stringify(s.progression), JSON.stringify(s.world)]).toEqual([prior, progression, world]);
    expect(projectInstigator(s).supplies).toContain(INSTIGATOR_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的刺客存药');
    expect(validateInstigatorState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 1210 and zero AP for only the selected original, without partial labour discounts', () => {
    const s = taught(), prior = JSON.stringify(s.assassin), otherBottles = JSON.stringify(s.instigator.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: INSTIGATOR_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.instigator.bottles.slice(1))).toBe(otherBottles);
    expect(JSON.stringify(s.assassin)).toBe(prior);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateInstigatorState(s)).toBe(true);
  });

  it('requires three separate one-AP jobs for the chosen bottle and then pays 160', () => {
    const s = taught(), bottle = s.instigator.bottles[0]!, ctx = context(s);
    for (let index = 0; index < 3; index += 1) {
      applyInstigatorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectInstigator(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(INSTIGATOR_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectInstigator(s).actions.find(a => a.id === `buy-${INSTIGATOR_BOTTLE_IDS[1]}`)!.cost).toContain('1210便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    s.cash = 159;
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    s.cash = 160;
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([0, 36, 'PLAYER']);
    expect(validateInstigatorState(s)).toBe(true);
  });

  it('can prepare early but needs 100 S9 acting and four whole S9 weeks for independent confirmation', () => {
    const s = assassin();
    s.week = 5;
    s.progression.acting = 0;
    taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
    s.week = 8; s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.instigator.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateInstigatorState(s)).toBe(true);
  });

  it('retains held originals after success but forbids further acquisition or repeat promotion', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.instigator.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: INSTIGATOR_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: INSTIGATOR_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectInstigator(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateInstigatorState(s)).toBe(true);
  });

  it('preserves the actual original draft and completed S9 reports through acquisition', () => {
    const s = assassin(), priorDraft = { ...s.assassin.draft }, priorS9 = JSON.stringify(s.assassin), priorTown = JSON.stringify(s.town);
    expect(priorDraft).toMatchObject({
      id: 'assassin-original-draft', owner: '诺艾拉·温瑟', custodian: 'NOAELA', location: 'author-desk', version: 4,
    });
    taught(s);
    for (let job = 0; job < 3; job += 1) apply(s, { type: 'POTION_WORK', bottleId: INSTIGATOR_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.assassin.draft).toEqual(priorDraft);
    expect(JSON.stringify(s.assassin)).toBe(priorS9);
    expect(JSON.stringify(s.town)).toBe(priorTown);
    expect(validateInstigatorCommand({ type: 'RETURN', caseId: 'upper-draft', route: 'STAIRS' })).toBe(false);
    rejected(s, { type: 'RETURN', caseId: 'upper-draft', route: 'STAIRS' });
    expect(s.assassin.draft).toEqual(priorDraft);
  });

  it.each([
    ['wrong pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['unknown mentor', (s: SliceState) => { s.assassin.discovered = false; }],
    ['missing S9 guidance', (s: SliceState) => { s.assassin.guidanceKnown = false; }],
    ['away from Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['open event', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects consumption without mutation when %s', (_label, mutate) => {
    const s = prepared(); mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
  });

  it('permits zero-AP payment and confirmation, but charges instruction and labour', () => {
    const s = assassin(); s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s);
    rejected(s, { type: 'POTION_WORK', bottleId: INSTIGATOR_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
    expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 8]);
  });
});

describe('four-tier Instigator promotion preserves S9 and recoverable failure', () => {
  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s using one will12 check and no death draw', (roll, tier, mentalCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldAssassin = JSON.stringify(s.assassin), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectInstigator(s).bottles[0]!.chance;
    applyInstigatorCommand(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.instigator.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['demoness', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.instigator.promotionWeek, s.instigator.assassinActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.assassin)).toBe(oldAssassin);
    for (const id of ASSASSIN_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 2], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS] : [...ASSASSIN_ABILITY_IDS]);
    if (success) {
      expect(s.progression.mastery['assassin.s8.instigation']).toBe(0);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectInstigator(s).abilities).toEqual(INSTIGATOR_ABILITIES.map(a => ({ ...a, mastery: 0 })));
    } else expect(projectInstigator(s).abilities).toEqual([]);
    expect(validateInstigatorState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps attributes and grants only bounded instigation while retaining four S9 ability IDs', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(INSTIGATOR_ABILITY_IDS).toEqual(['assassin.s8.instigation']);
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/memory|trust|dawn|storm|s7|s6/);
  });

  it('caps rejection at100, preserves severe failure and requires recovery for another bottle', () => {
    const s = taught(); buy(s); buy(s, 1);
    s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: INSTIGATOR_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateInstigatorState(s)).toBe(true);
  });
});

describe('finite cross-week Instigator resupply', () => {
  it('requires all failed originals, one request AP, a later week, and a fresh per-bottle payment', () => {
    const s = exhausted(), originals = JSON.stringify(s.instigator.bottles), priorS9 = JSON.stringify(s.assassin);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectInstigator(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 1;
    const cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.instigator.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.instigator.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(projectInstigator(s).actions.find(a => a.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    expect(validateInstigatorState(s)).toBe(true);
    s.week = 12;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(s.instigator.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.instigator.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.assassin)).toBe(priorS9);
    expect(s.instigator.bottles.slice(3).map(b => b.id)).toEqual(['instigator-potion-4', 'instigator-potion-5', 'instigator-potion-6']);
    expect(s.instigator.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'instigator-potion-4', confirmed: true });
    expect(validateInstigatorState(clone(s))).toBe(true);
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i++) apply(s, { type: 'POTION_WORK', bottleId: 'instigator-potion-4' });
    buy(s, 3);
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash - 160]);
    apply(s, { type: 'CONSUME', bottleId: 'instigator-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.instigator.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.instigator.bottles.slice(0, 3))).toBe(originals);
    expect(validateInstigatorState(s)).toBe(true);
  });

  it('does not refill automatically, reuse S9 labour, or request with an unused bottle or prior success', () => {
    for (const s of [ordinary(), assassin(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.instigator.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash; buy(s, 3);
    expect(s.cash).toBe(cash - 1210);
    expect(validateInstigatorState(s)).toBe(true);
  });
});

describe('Instigator exact commands and save chronology', () => {
  it('accepts every declared payload and classifies acquisition separately', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'instigator-potion-1' }, { type: 'BUY_POTION', bottleId: 'instigator-potion-999' },
      { type: 'CONSUME', bottleId: 'instigator-potion-1', confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' }, ...INSTIGATOR_CASE_IDS.flatMap(caseId => ['OBSERVE', 'PERFORM', 'SETTLE', 'REPORT', 'WITHDRAW'].map(type => ({ type, caseId }))),
      ...INSTIGATOR_CASE_IDS.flatMap(caseId => ['INCITE', 'PLAIN'].map(method => ({ type: 'PREPARE', caseId, method }))),
    ];
    for (const command of [...acquisition, ...activities]) {
      expect(validateInstigatorCommand(command)).toBe(true);
      if (validateInstigatorCommand(command)) expect(isInstigatorAcquisitionCommand(command)).toBe(acquisition.includes(command));
    }
    for (const command of activities) rejected(prepared(), command);
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'assassin-potion-1' },
    { type: 'BUY_POTION', bottleId: 'instigator-potion-0' }, { type: 'BUY_POTION', bottleId: 'instigator-potion-01' },
    { type: 'BUY_POTION', bottleId: 'instigator-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'instigator-potion-1' }, { type: 'CONSUME', bottleId: 'instigator-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'instigator-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: '__proto__', method: 'PLAIN' },
    { type: 'PREPARE', caseId: 'queue-grievance' }, { type: 'PREPARE', caseId: 'queue-grievance', method: 'MEMORY' },
    { type: 'PERFORM', caseId: 'queue-grievance', method: 'INCITE' },
    { type: 'REPORT', caseId: 'queue-grievance', eraseMemory: true },
    { type: 'SETTLE' }, { type: 'SETTLE', caseId: 'queue-grievance', force: true },
    { type: 'RETURN_TOOL', caseId: 'queue-grievance' },
    { type: 'WITHDRAW' }, { type: 'REFLECT', caseId: 'queue-grievance' }, { type: 'RETURN_TOOL', free: true },
  ])('rejects malformed or undeclared command %j without mutation', command => {
    expect(validateInstigatorCommand(command)).toBe(false);
    rejected(prepared(), command);
  });

  it('rejects bottle identity, price-work, source, chronology and inherited mastery forgery', () => {
    const s = promoted();
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.instigator.bottles[0]!.id = 'assassin-potion-1'; }, x => { x.instigator.bottles[0]!.source = 'invented'; },
      x => { x.instigator.bottles[0]!.labourSteps = 4; }, x => { x.instigator.bottles[0]!.acquiredWeek = 4; },
      x => { x.instigator.bottles[0]!.consumedWeek = 10; }, x => { x.instigator.bottles[0]!.consumedWeek = 12; },
      x => { x.instigator.bottles[0]!.outcome = 'FAILURE'; }, x => { x.instigator.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.instigator.bottles[1]!.acquiredWeek = 11; }, x => { x.instigator.promotionWeek = 10; },
      x => { x.instigator.assassinActingAtPromotion = 99; }, x => { x.progression.promotionWeek = 11; },
      x => { x.instigator.guidanceKnown = false; }, x => { delete x.progression.mastery[ASSASSIN_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[INSTIGATOR_ABILITY_IDS[0]]; }, x => { x.progression.mastery[INSTIGATOR_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['assassin.s8.fear-immunity'] = 0; }, x => { x.instigator.bottles.push({ ...x.instigator.bottles[0]! }); },
      x => { delete x.instigator.cases['stage-rivalry']; }, x => { (x.instigator as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateInstigatorState(bad)).toBe(false); }
  });

  it('rejects same-week or mixed-batch receipts and resurrected exhausted originals', () => {
    const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.instigator.resupply.deliveries = 0; }, x => { x.instigator.resupply.deliveries = 2; },
      x => { x.instigator.bottles[3]!.id = 'instigator-potion-7'; },
      x => { x.instigator.bottles[3]!.source = x.instigator.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.instigator.bottles[4]!.source = x.instigator.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.instigator.bottles[0]!.status = 'PLAYER'; x.instigator.bottles[0]!.outcome = null; x.instigator.bottles[0]!.consumedWeek = null; },
      x => { x.instigator.bottles[3]!.status = 'PLAYER'; x.instigator.bottles[3]!.acquiredWeek = 11; },
      x => { x.instigator.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateInstigatorState(bad)).toBe(false); }
    const pending = exhausted(); apply(pending, { type: 'REQUEST_SUPPLY' }); pending.instigator.resupply.requestedWeek = 10;
    expect(validateInstigatorState(pending)).toBe(false);
  });

  it('rejects malformed states without throwing and does not grant S8 activities before promotion', () => {
    const s = ordinary();
    for (const raw of [null, [], {}, { ...s.instigator, bottles: [null, null, null] }, { ...s.instigator, cases: null }]) {
      const bad = clone(s); bad.instigator = raw as unknown as SliceState['instigator'];
      expect(validateInstigatorState(bad)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.instigator.guidanceKnown = true; }, (x: SliceState) => { x.instigator.reflected = true; },
      (x: SliceState) => { x.instigator.cases['queue-grievance']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.progression.mastery[INSTIGATOR_ABILITY_IDS[0]] = 0; },
    ]) { const bad = clone(s); mutate(bad); expect(validateInstigatorState(bad)).toBe(false); }
    const ready = promoted(), original = ready.instigator.cases['queue-grievance']!;
    for (const raw of [null, {}, { ...original, unknown: true }, { ...original, status: 'CONTROLLED' }, { ...original, method: 'MEMORY' }, { ...original, outcome: 'FORCED_TRUST' }, { ...original, tension: 'CONTROLLED' }, { ...original, tension: undefined }, { ...original, withdrawals: -1 }, { ...original, attemptWeek: 10 }, { ...original, attemptWeek: 12 }]) {
      const bad = clone(ready); bad.instigator.cases['queue-grievance'] = raw as unknown as SliceState['instigator']['cases'][string];
      expect(validateInstigatorState(bad)).toBe(false);
    }
    ready.instigator.cases['queue-grievance'] = { status: 'EXAMINED', method: 'INCITE', attemptWeek: 11, withdrawals: 1, outcome: 'QUEUE_HEARD', tension: 'HEATED' };
    expect(validateInstigatorState(ready)).toBe(true);
  });

  it('keeps canon and original gameplay separate and exposes no invented formula or extra power', () => {
    expect(INSTIGATOR_ABILITIES.map(a => a.id)).toEqual(['assassin.s8.instigation']);
    expect(INSTIGATOR_ABILITIES[0]!.description).toContain('已有的恶欲、动摇与矛盾');
    expect(INSTIGATOR_ABILITIES[0]!.description).toContain('不强制控制');
    expect(INSTIGATOR_SOURCE_STATUS).toContain('第一部第65章');
    expect(INSTIGATOR_SOURCE_STATUS).toContain('真实升温与平息步骤');
    expect(INSTIGATOR_SOURCE_STATUS).toContain('本作原创G');
    expect(INSTIGATOR_SOURCE_STATUS).toContain('不提前开放序列7的身体转变、隐形、黑焰');
    expect(projectInstigator(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
