import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySailorCommand } from '../../src/domain/sailor/index.js';
import { SAILOR_ABILITY_IDS } from '../../src/domain/sailor/types.js';
import { applyRagerCommand } from '../../src/domain/rager/index.js';
import { RAGER_ABILITY_IDS } from '../../src/domain/rager/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyNavigatorCommand, createNavigatorState, isNavigatorAcquisitionCommand,
  projectNavigator, validateNavigatorCommand, validateNavigatorState,
} from '../../src/domain/navigator/index.js';
import { NAVIGATOR_ABILITIES, NAVIGATOR_BOTTLE_IDS, NAVIGATOR_FORMULA_STATUS, NAVIGATOR_LABOUR_TASKS } from '../../src/domain/navigator/content.js';
import { NAVIGATOR_ABILITY_IDS, NAVIGATOR_CASE_IDS, NAVIGATOR_PLAN_IDS, type NavigatorAcquisitionCommand } from '../../src/domain/navigator/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = NAVIGATOR_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('navigator-acquisition', sliceDefaultCreationSelection, 'navigator-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.navigator = createNavigatorState();
  return s;
}
function context(s: SliceState, checkRoll = 20) {
  const checks: [PublicCoreStatKey, number][] = [], draws: [number, number][] = [], notes: { title: string; text: string }[] = [];
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
function rager(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applySailorCommand(s, { type: 'DISCOVER' }, c);
  applySailorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySailorCommand(s, { type: 'BUY_POTION', bottleId: s.sailor.bottles[0]!.id }, c);
  applySailorCommand(s, { type: 'CONSUME', bottleId: s.sailor.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyRagerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyRagerCommand(s, { type: 'BUY_POTION', bottleId: s.rager.bottles[0]!.id }, c);
  applyRagerCommand(s, { type: 'CONSUME', bottleId: s.rager.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: NavigatorAcquisitionCommand, roll = 20) { applyNavigatorCommand(s, command, context(s, roll).c); }
function taught(s = rager()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.navigator.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.navigator.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as NavigatorAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('navigator S7 independent finished-potion acquisition', () => {
  it('creates three sourced independent bottles and untouched activity reserves', () => {
    const s = ordinary(), other = createNavigatorState();
    expect(validateNavigatorState(s)).toBe(true);
    expect(s.navigator.bottles.map(bottle => bottle.id)).toEqual([...NAVIGATOR_BOTTLE_IDS]);
    expect(s.navigator.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.navigator).toMatchObject({ reflected: false, promotionWeek: null, ragerActingAtPromotion: null });
    expect(Object.keys(s.navigator.cases)).toEqual([...NAVIGATOR_CASE_IDS]);
    expect(Object.values(s.navigator.cases)).toEqual(NAVIGATOR_CASE_IDS.map(() => ({ status: 'AVAILABLE', attemptWeek: null, planId: null, mistakes: 0, withdrawals: 0 })));
    other.bottles[0]!.labourSteps = 4; other.cases[NAVIGATOR_CASE_IDS[0]]!.status = 'SURVEYED';
    expect([s.navigator.bottles[0]!.labourSteps, s.navigator.cases[NAVIGATOR_CASE_IDS[0]]!.status]).toEqual([0, 'AVAILABLE']);
  });

  it('hides the future channel and rejects route skipping', () => {
    const s = ordinary(), p = projectNavigator(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/navigator-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const sailor = rager(); sailor.progression.sequence = 9;
    rejected(sailor, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without a full recipe or lower-state changes', () => {
    const s = rager(), old = [JSON.stringify(s.sailor), JSON.stringify(s.rager), JSON.stringify(s.progression)];
    expect(projectNavigator(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.navigator.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectNavigator(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectNavigator(s).supplies).toContain(NAVIGATOR_FORMULA_STATUS);
    expect(projectNavigator(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.sailor), JSON.stringify(s.rager), JSON.stringify(s.progression)]).toEqual(old);
    expect(validateNavigatorState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original once', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.navigator.bottles.slice(1));
    expect(buy(s)).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect([s.cash, s.actionsRemaining, JSON.stringify(s.navigator.bottles.slice(1))]).toEqual([7750, ap, others]);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    expect(validateNavigatorState(s)).toBe(true);
  });

  it('only four real jobs on the selected bottle waive 1800 pence, never a partial refund', () => {
    for (const count of [1, 2, 3, 4]) {
      const s = taught(), ctx = context(s);
      for (let i = 0; i < count; i += 1) applyNavigatorCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.navigator.bottles[0]!.labourSteps]).toEqual([9760, 39 - count, count]);
      expect(ctx.notes.map(note => note.title)).toEqual(NAVIGATOR_LABOUR_TASKS.slice(0, count).map(task => `完成${task}`));
      expect(projectNavigator(s).actions.find(action => action.id === `buy-${NAVIGATOR_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
      if (count === 4) rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      buy(s);
      expect(s.cash).toBe(count === 4 ? 9550 : 7750);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash, foreign originals and forged confirmations without mutation', () => {
    const s = rager(); s.cash = 239; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['sailor-potion-1', 'rager-potion-1', 'navigator-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'CONSUME', bottleId: NAVIGATOR_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('permits early preparation but requires S8 acting 100 and eight whole weeks since S8', () => {
    const s = rager(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command); s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectNavigator(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.rager.promotionWeek, s.navigator.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.navigator.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validateNavigatorState(s)).toBe(true);
  });

  it('resolves all four will-18 tiers with real original consumption and recoverable guided costs', () => {
    for (const [roll, tier, sequence, mind, health, pollution] of [
      [1, 'GREAT_SUCCESS', 7, 95, 100, 0], [20, 'SUCCESS', 7, 90, 100, 0],
      [80, 'FAILURE', 8, 80, 90, 25], [99, 'GREAT_FAILURE', 8, 60, 80, 50],
    ] as const) {
      const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
      applyNavigatorCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]);
      expect(ctx.draws).toEqual([]);
      expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
      expect(s.navigator.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect(validateNavigatorState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('inherits all five old masteries, resets only S7 acting, and raises the cap without a refill', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const old = [JSON.stringify(s.sailor), JSON.stringify(s.rager), JSON.stringify(s.caseArchive)];
    s.spirituality = 9; consume(s);
    expect([s.navigator.ragerActingAtPromotion, s.progression.acting, s.spirituality]).toEqual([100, 0, 9]);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(NAVIGATOR_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique + 2, perception: stats.perception + 2, will: stats.will + 3, knowledge: stats.knowledge + 1 });
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.sailor), JSON.stringify(s.rager), JSON.stringify(s.caseArchive)]).toEqual(old);
    expect(projectNavigator(s).abilities.map(ability => ability.id)).toEqual([...NAVIGATOR_ABILITY_IDS]);
    const capped = prepared(); capped.character.coreStats = { physique: 500, perception: 499, will: 500, knowledge: 499 }; consume(capped, 1);
    expect(capped.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
  });

  it('blocks unavailable bodies, routes, locations, runs and ongoing events or combat', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.sailor.discovered = false; },
      s => { s.sailor.guidanceKnown = false; }, s => { s.rager.guidanceKnown = false; }, s => { s.rager.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.combat = {} as NonNullable<SliceState['combat']>; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }); }
  });

  it('requires AP for guidance and labour but allows purchase and consumption at zero AP', () => {
    const s = rager(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s); expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it('retains a failed original and old progression, then preserves spare originals after successful recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.navigator.promotionWeek, s.navigator.ragerActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100; buy(s, 1); buy(s, 2); consume(s, 20, 1);
    expect(s.navigator.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'GREAT_FAILURE'], ['CONSUMED', 'SUCCESS'], ['PLAYER', null]]);
    expect(s.seer.pollution).toBe(50);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: NAVIGATOR_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: NAVIGATOR_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: NAVIGATOR_BOTTLE_IDS[2], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectNavigator(s).actions.every(action => !action.enabled)).toBe(true);
    expect(validateNavigatorState(s)).toBe(true);
  });

  it('only restocks after all three failures and a real later week, keeping old bottles and all prices', () => {
    const s = taught(); rejected(s, { type: 'REQUEST_SUPPLY' });
    for (let index = 0; index < 3; index += 1) {
      buy(s, index); consume(s, 80, index);
      if (index < 2) rejected(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = JSON.stringify(s.navigator.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.navigator.bottles.length, s.navigator.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.navigator.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.navigator.resupply.deliveries, s.navigator.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.navigator.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['navigator-potion-4', 'SUPPLIER', 0], ['navigator-potion-5', 'SUPPLIER', 0], ['navigator-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectNavigator(s).actions.find(action => action.id === 'buy-navigator-potion-4')!.cost).toContain('2010便士');
    expect(validateNavigatorState(s)).toBe(true); rejected(s, { type: 'RECEIVE_SUPPLY' });
    const bad = clone(s); bad.navigator.bottles[3]!.source = bad.navigator.bottles[3]!.source.replace('第20周', '第19周');
    expect(validateNavigatorState(bad)).toBe(false);
  });

  it('rejects malformed stock, duplicate success, chronology and incomplete inherited abilities on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.navigator.bottles[0]!.id = 'rager-potion-1'; }, s => { s.navigator.bottles[0]!.source = 'unsourced'; },
      s => { s.navigator.bottles[1]!.labourSteps = 5; }, s => { s.navigator.promotionWeek = 18; },
      s => { s.navigator.ragerActingAtPromotion = 99; }, s => { delete s.progression.mastery[SAILOR_ABILITY_IDS[0]]; },
      s => { delete s.progression.mastery[RAGER_ABILITY_IDS[0]]; },
      s => { s.navigator.cases[NAVIGATOR_CASE_IDS[0]]!.attemptWeek = 18; },
      s => { delete s.navigator.cases[NAVIGATOR_CASE_IDS[0]]; },
      s => { delete s.progression.mastery[NAVIGATOR_ABILITY_IDS[0]]; },
      s => { s.progression.mastery[NAVIGATOR_ABILITY_IDS[0]] = 501; },
      s => { s.progression.mastery['tyrant.s6.wind'] = 0; },
      s => { s.navigator.bottles[1] = { ...s.navigator.bottles[0]!, id: NAVIGATOR_BOTTLE_IDS[1], source: s.navigator.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateNavigatorState(bad)).toBe(false); }
    const bad = clone(s); (bad.navigator.bottles as unknown[])[0] = null; expect(validateNavigatorState(bad)).toBe(false);
    const beforePromotion = rager(); beforePromotion.navigator.cases[NAVIGATOR_CASE_IDS[0]]!.status = 'SURVEYED';
    expect(validateNavigatorState(beforePromotion)).toBe(false);
  });


  it('caps rejection and requires recovery without erasing failure records', () => {
    const s = prepared(); buy(s, 1);
    s.health = 10; s.mind = 20; s.seer.pollution = 90;
    consume(s, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    rejected(s, { type: 'CONSUME', bottleId: NAVIGATOR_BOTTLE_IDS[1], confirmed: true });
    expect(validateNavigatorState(s)).toBe(true);
  });

  it('never replenishes automatically, reuses labour or gives credit for old originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    s.week += 10;
    expect(s.navigator.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 4; apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining, s.navigator.bottles[3]!.labourSteps]).toEqual([cash - 2010, actions, 0]);
    const old = JSON.stringify(s.navigator.bottles.slice(0, 3));
    consume(s, 1, 3);
    expect(JSON.stringify(s.navigator.bottles.slice(0, 3))).toBe(old);
    expect(s.navigator.promotionWeek).toBe(30);
    expect(validateNavigatorState(s)).toBe(true);
  });

  it('rejects mismatched delivery counts, mixed dates and restoration of exhausted originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    for (const mutate of [
      (x: SliceState) => { x.navigator.resupply.deliveries = 0; },
      (x: SliceState) => { x.navigator.resupply.deliveries = 2; },
      (x: SliceState) => { x.navigator.bottles[3]!.id = 'navigator-potion-7'; },
      (x: SliceState) => { x.navigator.bottles[0]!.status = 'PLAYER'; x.navigator.bottles[0]!.consumedWeek = null; x.navigator.bottles[0]!.outcome = null; },
      (x: SliceState) => { x.week = 21; x.navigator.bottles[4]!.source = x.navigator.bottles[4]!.source.replace('第20周', '第21周'); },
      (x: SliceState) => { x.navigator.resupply.requestedWeek = 19; },
    ]) { const bad = clone(s); mutate(bad); expect(validateNavigatorState(bad)).toBe(false); }
    for (const value of [null, [], {}, { ...s.navigator, extra: true }]) {
      const bad = clone(s); bad.navigator = value as SliceState['navigator'];
      expect(validateNavigatorState(bad)).toBe(false);
    }
  });

});

describe('navigator exact command and canon boundaries', () => {
  it('accepts declared acquisition and activity payloads without sharing their entry points', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, { type: 'BUY_POTION', bottleId: 'navigator-potion-999' },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' },
      ...NAVIGATOR_CASE_IDS.flatMap(caseId => [
        { type: 'SURVEY', caseId },
        ...NAVIGATOR_PLAN_IDS[caseId].map(planId => ({ type: 'PLAN', caseId, planId })),
        { type: 'PERFORM', caseId }, { type: 'WITHDRAW', caseId },
      ]),
    ];
    for (const command of acquisition) { expect(validateNavigatorCommand(command)).toBe(true); expect(isNavigatorAcquisitionCommand(command)).toBe(true); }
    const s = prepared();
    for (const command of activities) { expect(validateNavigatorCommand(command)).toBe(true); expect(isNavigatorAcquisitionCommand(command)).toBe(false); rejected(s, command); }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' }, { type: 'COPY_ABILITY' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'rager-potion-1' },
    { type: 'BUY_POTION', bottleId: 'navigator-potion-0' }, { type: 'BUY_POTION', bottleId: 'navigator-potion-01' },
    { type: 'BUY_POTION', bottleId: 'navigator-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, guaranteed: true },
    { type: 'SURVEY', caseId: 'invented' }, { type: 'SURVEY', caseId: '__proto__' },
    { type: 'PLAN' }, { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0] },
    { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0], planId: '' },
    { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0], planId: 'x'.repeat(81) },
    { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0], planId: 'invent facts' },
    { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0], planId: '__proto__' },
    { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0], planId: 'SHORE_GUIDE', truth: true },
    { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0], planId: 1 },
    { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0], planId: 'INSHORE_RETURN' },
    { type: 'PLAN', caseId: NAVIGATOR_CASE_IDS[0], planId: 'compare-traces' },
    { type: 'PERFORM', caseId: NAVIGATOR_CASE_IDS[0], planId: 'SHORE_GUIDE' },
    { type: 'PERFORM', caseId: NAVIGATOR_CASE_IDS[0], method: 'ABILITY' },
    { type: 'WITHDRAW', caseId: NAVIGATOR_CASE_IDS[0], free: true },
    { type: 'REFLECT', caseId: NAVIGATOR_CASE_IDS[0] },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateNavigatorCommand(command)).toBe(false);
    expect(isNavigatorAcquisitionCommand(command)).toBe(false);
    rejected(prepared(), command);
  });

  it('reserves exact case fields while leaving per-case choices and evidence semantics to life', () => {
    const s = prepared(); consume(s);
    const original = s.navigator.cases[NAVIGATOR_CASE_IDS[0]]!;
    for (const value of [
      null, {}, { ...original, extra: true }, { ...original, status: 'OMNISCIENT' },
      { ...original, planId: 12 }, { ...original, planId: '' }, { ...original, planId: 'INSHORE_RETURN' },
      { ...original, mistakes: -1 }, { ...original, mistakes: 0.5 },
      { ...original, withdrawals: -1 }, { ...original, withdrawals: 0.5 },
      { ...original, attemptWeek: 18 }, { ...original, attemptWeek: 20 }, { ...original, attemptWeek: 19.5 },
    ]) {
      const bad = clone(s); bad.navigator.cases[NAVIGATOR_CASE_IDS[0]] = value as SliceState['navigator']['cases'][string];
      expect(validateNavigatorState(bad)).toBe(false);
    }
    s.navigator.cases[NAVIGATOR_CASE_IDS[0]] = { status: 'PLANNED', attemptWeek: 19, planId: 'SHORE_GUIDE', mistakes: 1, withdrawals: 0 };
    expect(validateNavigatorState(s)).toBe(true);
    const lower = rager(); lower.navigator.cases[NAVIGATOR_CASE_IDS[0]]!.mistakes = 1;
    expect(validateNavigatorState(lower)).toBe(false);
  });

  it('separates sourced maritime intuition and finite water magic from gameplay G', () => {
    const s = prepared(), p = projectNavigator(s);
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p).toMatchObject({ formulaKnown: false, formula: [] });
    expect(p.risk).toContain('本作G游戏平衡'); expect(p.risk).toContain('意志难度18');
    expect(p.risk).toContain('人类服药成为航海家后仍须扮演'); expect(p.risk).toContain('不会自动加入教会');
    expect(p.supplies).toContain('完整配方资料待核');
    expect(p.story).toContain('第一部第65章'); expect(p.story).toContain('第一部第157章');
    expect(p.story).toContain('第二部第153章'); expect(p.story).toContain('完全消化');
    expect(p.story).toContain('不是固定上限'); expect(p.story).toContain('安全保证');
    expect(NAVIGATOR_ABILITIES.map(ability => ability.id)).toEqual([...NAVIGATOR_ABILITY_IDS]);
    expect(NAVIGATOR_ABILITIES[0]!.description).toContain('磁场、海流、风与云');
    expect(NAVIGATOR_ABILITIES[0]!.description).toContain('超过半小时');
    expect(NAVIGATOR_ABILITIES[0]!.description).toContain('不等于永久水下呼吸');
    expect(NAVIGATOR_ABILITIES[1]!.description).toContain('实际存在');
    expect(NAVIGATOR_ABILITIES[1]!.description).toContain('玩法G');
    expect(NAVIGATOR_ABILITIES[1]!.description).toContain('刚晋升者');
    expect(NAVIGATOR_ABILITIES[2]!.description).toContain('窒息实时对抗');
    expect(NAVIGATOR_ABILITIES[2]!.description).toContain('水膜不是供气泡');
    expect(NAVIGATOR_ABILITIES[2]!.description).toContain('无辜者');
  });
});
