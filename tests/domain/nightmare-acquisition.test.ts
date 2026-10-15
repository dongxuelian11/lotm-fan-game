import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySleeplessCommand } from '../../src/domain/sleepless/index.js';
import { SLEEPLESS_ABILITY_IDS } from '../../src/domain/sleepless/types.js';
import { applyMidnightCommand } from '../../src/domain/midnight/index.js';
import { MIDNIGHT_ABILITY_IDS } from '../../src/domain/midnight/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyNightmareCommand, createNightmareState, isNightmareAcquisitionCommand,
  projectNightmare, validateNightmareCommand, validateNightmareState,
} from '../../src/domain/nightmare/index.js';
import { NIGHTMARE_ABILITIES, NIGHTMARE_BOTTLE_IDS, NIGHTMARE_FORMULA_STATUS, NIGHTMARE_LABOUR_TASKS } from '../../src/domain/nightmare/content.js';
import { NIGHTMARE_ABILITY_IDS, NIGHTMARE_CASE_IDS, type NightmareAcquisitionCommand } from '../../src/domain/nightmare/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = NIGHTMARE_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('nightmare-acquisition', sliceDefaultCreationSelection, 'nightmare-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.nightmare = createNightmareState();
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
function midnight(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applySleeplessCommand(s, { type: 'DISCOVER' }, c);
  applySleeplessCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySleeplessCommand(s, { type: 'BUY_POTION', bottleId: s.sleepless.bottles[0]!.id }, c);
  applySleeplessCommand(s, { type: 'CONSUME', bottleId: s.sleepless.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyMidnightCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMidnightCommand(s, { type: 'BUY_POTION', bottleId: s.midnight.bottles[0]!.id }, c);
  applyMidnightCommand(s, { type: 'CONSUME', bottleId: s.midnight.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: NightmareAcquisitionCommand, roll = 20) { applyNightmareCommand(s, command, context(s, roll).c); }
function taught(s = midnight()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.nightmare.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.nightmare.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as NightmareAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('nightmare S7 independent finished-potion acquisition', () => {
  it('creates three sourced independent bottles and untouched activity reserves', () => {
    const s = ordinary(), other = createNightmareState();
    expect(validateNightmareState(s)).toBe(true);
    expect(s.nightmare.bottles.map(bottle => bottle.id)).toEqual([...NIGHTMARE_BOTTLE_IDS]);
    expect(s.nightmare.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.nightmare).toMatchObject({ reflected: false, promotionWeek: null, midnightActingAtPromotion: null });
    expect(s.nightmare).toMatchObject({
      encounter: { status: 'AVAILABLE', observed: false, bystanderCleared: false, attemptWeek: null, startHistoryIndex: null, pressure: 0, dreamLocked: false },
    });
    expect(Object.keys(s.nightmare.cases)).toEqual([...NIGHTMARE_CASE_IDS]);
    expect(Object.values(s.nightmare.cases)).toEqual(NIGHTMARE_CASE_IDS.map(() => ({ status: 'AVAILABLE', attemptWeek: null, dreamRecord: null })));
    other.bottles[0]!.labourSteps = 4; other.cases[NIGHTMARE_CASE_IDS[0]]!.status = 'OBSERVED'; other.encounter.observed = true;
    expect([s.nightmare.bottles[0]!.labourSteps, s.nightmare.cases[NIGHTMARE_CASE_IDS[0]]!.status, s.nightmare.encounter.observed]).toEqual([0, 'AVAILABLE', false]);
  });

  it('hides the future channel and rejects route skipping', () => {
    const s = ordinary(), p = projectNightmare(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/nightmare-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const sleepless = midnight(); sleepless.progression.sequence = 9;
    rejected(sleepless, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without a full recipe or lower-state changes', () => {
    const s = midnight(), old = [JSON.stringify(s.sleepless), JSON.stringify(s.midnight), JSON.stringify(s.progression)];
    expect(projectNightmare(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.nightmare.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectNightmare(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectNightmare(s).supplies).toContain(NIGHTMARE_FORMULA_STATUS);
    expect(projectNightmare(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.sleepless), JSON.stringify(s.midnight), JSON.stringify(s.progression)]).toEqual(old);
    expect(validateNightmareState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original once', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.nightmare.bottles.slice(1));
    expect(buy(s)).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect([s.cash, s.actionsRemaining, JSON.stringify(s.nightmare.bottles.slice(1))]).toEqual([7750, ap, others]);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    expect(validateNightmareState(s)).toBe(true);
  });

  it('only four real jobs on the selected bottle waive 1800 pence, never a partial refund', () => {
    for (const count of [1, 2, 3, 4]) {
      const s = taught(), ctx = context(s);
      for (let i = 0; i < count; i += 1) applyNightmareCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.nightmare.bottles[0]!.labourSteps]).toEqual([9760, 39 - count, count]);
      expect(ctx.notes.map(note => note.title)).toEqual(NIGHTMARE_LABOUR_TASKS.slice(0, count).map(task => `完成${task}`));
      expect(projectNightmare(s).actions.find(action => action.id === `buy-${NIGHTMARE_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
      if (count === 4) rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      buy(s);
      expect(s.cash).toBe(count === 4 ? 9550 : 7750);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash, foreign originals and forged confirmations without mutation', () => {
    const s = midnight(); s.cash = 239; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['sleepless-potion-1', 'midnight-potion-1', 'nightmare-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'CONSUME', bottleId: NIGHTMARE_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('permits early preparation but requires S8 acting 100 and eight whole weeks since S8', () => {
    const s = midnight(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command); s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectNightmare(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.midnight.promotionWeek, s.nightmare.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.nightmare.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validateNightmareState(s)).toBe(true);
  });

  it('resolves all four will-18 tiers with real original consumption and recoverable guided costs', () => {
    for (const [roll, tier, sequence, mind, health, pollution] of [
      [1, 'GREAT_SUCCESS', 7, 95, 100, 0], [20, 'SUCCESS', 7, 90, 100, 0],
      [80, 'FAILURE', 8, 80, 90, 25], [99, 'GREAT_FAILURE', 8, 60, 80, 50],
    ] as const) {
      const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
      applyNightmareCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]);
      expect(ctx.draws).toEqual([]);
      expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
      expect(s.nightmare.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect(validateNightmareState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('inherits all five old masteries, resets only S7 acting, and raises the cap without a refill', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const old = [JSON.stringify(s.sleepless), JSON.stringify(s.midnight), JSON.stringify(s.caseArchive)];
    s.spirituality = 9; consume(s);
    expect([s.nightmare.midnightActingAtPromotion, s.progression.acting, s.spirituality]).toEqual([100, 0, 9]);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(NIGHTMARE_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique + 1, perception: stats.perception + 2, will: stats.will + 4, knowledge: stats.knowledge + 1 });
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.sleepless), JSON.stringify(s.midnight), JSON.stringify(s.caseArchive)]).toEqual(old);
    expect(projectNightmare(s).abilities.map(ability => ability.id)).toEqual([...NIGHTMARE_ABILITY_IDS]);
    const capped = prepared(); capped.character.coreStats = { physique: 500, perception: 499, will: 500, knowledge: 499 }; consume(capped, 1);
    expect(capped.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
  });

  it('blocks unavailable bodies, routes, locations, runs and ongoing events or combat', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.sleepless.discovered = false; },
      s => { s.sleepless.guidanceKnown = false; }, s => { s.midnight.guidanceKnown = false; }, s => { s.midnight.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.combat = {} as NonNullable<SliceState['combat']>; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }); }
  });

  it('requires AP for guidance and labour but allows purchase and consumption at zero AP', () => {
    const s = midnight(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s); expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it('retains a failed original and old progression, then preserves spare originals after successful recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.nightmare.promotionWeek, s.nightmare.midnightActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100; buy(s, 1); buy(s, 2); consume(s, 20, 1);
    expect(s.nightmare.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'GREAT_FAILURE'], ['CONSUMED', 'SUCCESS'], ['PLAYER', null]]);
    expect(s.seer.pollution).toBe(50);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: NIGHTMARE_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: NIGHTMARE_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: NIGHTMARE_BOTTLE_IDS[2], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectNightmare(s).actions.every(action => !action.enabled)).toBe(true);
    expect(validateNightmareState(s)).toBe(true);
  });

  it('only restocks after all three failures and a real later week, keeping old bottles and all prices', () => {
    const s = taught(); rejected(s, { type: 'REQUEST_SUPPLY' });
    for (let index = 0; index < 3; index += 1) {
      buy(s, index); consume(s, 80, index);
      if (index < 2) rejected(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = JSON.stringify(s.nightmare.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.nightmare.bottles.length, s.nightmare.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.nightmare.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.nightmare.resupply.deliveries, s.nightmare.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.nightmare.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['nightmare-potion-4', 'SUPPLIER', 0], ['nightmare-potion-5', 'SUPPLIER', 0], ['nightmare-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectNightmare(s).actions.find(action => action.id === 'buy-nightmare-potion-4')!.cost).toContain('2010便士');
    expect(validateNightmareState(s)).toBe(true); rejected(s, { type: 'RECEIVE_SUPPLY' });
    const bad = clone(s); bad.nightmare.bottles[3]!.source = bad.nightmare.bottles[3]!.source.replace('第20周', '第19周');
    expect(validateNightmareState(bad)).toBe(false);
  });

  it('rejects malformed stock, duplicate success, chronology and incomplete inherited abilities on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.nightmare.bottles[0]!.id = 'midnight-potion-1'; }, s => { s.nightmare.bottles[0]!.source = 'unsourced'; },
      s => { s.nightmare.bottles[1]!.labourSteps = 5; }, s => { s.nightmare.promotionWeek = 18; },
      s => { s.nightmare.midnightActingAtPromotion = 99; }, s => { delete s.progression.mastery[SLEEPLESS_ABILITY_IDS[0]]; },
      s => { delete s.progression.mastery[MIDNIGHT_ABILITY_IDS[0]]; },
      s => { s.nightmare.cases[NIGHTMARE_CASE_IDS[0]]!.attemptWeek = 18; },
      s => { delete s.nightmare.cases[NIGHTMARE_CASE_IDS[0]]; },
      s => { s.nightmare.encounter.startHistoryIndex = -1; },
      s => { s.nightmare.encounter.pressure = 3 as 2; },
      s => { s.nightmare.encounter.dreamLocked = 'yes' as unknown as boolean; },
      s => { delete s.progression.mastery[NIGHTMARE_ABILITY_IDS[0]]; },
      s => { s.progression.mastery[NIGHTMARE_ABILITY_IDS[0]] = 501; },
      s => { s.progression.mastery['darkness.s6.requiem'] = 0; },
      s => { s.nightmare.bottles[1] = { ...s.nightmare.bottles[0]!, id: NIGHTMARE_BOTTLE_IDS[1], source: s.nightmare.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateNightmareState(bad)).toBe(false); }
    const bad = clone(s); (bad.nightmare.bottles as unknown[])[0] = null; expect(validateNightmareState(bad)).toBe(false);
    const beforePromotion = midnight(); beforePromotion.nightmare.encounter.observed = true;
    expect(validateNightmareState(beforePromotion)).toBe(false);
  });


  it('caps rejection and requires recovery without erasing failure records', () => {
    const s = prepared(); buy(s, 1);
    s.health = 10; s.mind = 20; s.seer.pollution = 90;
    consume(s, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    rejected(s, { type: 'CONSUME', bottleId: NIGHTMARE_BOTTLE_IDS[1], confirmed: true });
    expect(validateNightmareState(s)).toBe(true);
  });

  it('never replenishes automatically, reuses labour or gives credit for old originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    s.week += 10;
    expect(s.nightmare.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 4; apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining, s.nightmare.bottles[3]!.labourSteps]).toEqual([cash - 2010, actions, 0]);
    const old = JSON.stringify(s.nightmare.bottles.slice(0, 3));
    consume(s, 1, 3);
    expect(JSON.stringify(s.nightmare.bottles.slice(0, 3))).toBe(old);
    expect(s.nightmare.promotionWeek).toBe(30);
    expect(validateNightmareState(s)).toBe(true);
  });

  it('rejects mismatched delivery counts, mixed dates and restoration of exhausted originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    for (const mutate of [
      (x: SliceState) => { x.nightmare.resupply.deliveries = 0; },
      (x: SliceState) => { x.nightmare.resupply.deliveries = 2; },
      (x: SliceState) => { x.nightmare.bottles[3]!.id = 'nightmare-potion-7'; },
      (x: SliceState) => { x.nightmare.bottles[0]!.status = 'PLAYER'; x.nightmare.bottles[0]!.consumedWeek = null; x.nightmare.bottles[0]!.outcome = null; },
      (x: SliceState) => { x.week = 21; x.nightmare.bottles[4]!.source = x.nightmare.bottles[4]!.source.replace('第20周', '第21周'); },
      (x: SliceState) => { x.nightmare.resupply.requestedWeek = 19; },
    ]) { const bad = clone(s); mutate(bad); expect(validateNightmareState(bad)).toBe(false); }
    for (const value of [null, [], {}, { ...s.nightmare, extra: true }]) {
      const bad = clone(s); bad.nightmare = value as SliceState['nightmare'];
      expect(validateNightmareState(bad)).toBe(false);
    }
  });

  it('reserves exact case and encounter fields while leaving promoted activity semantics to life', () => {
    const s = prepared(); consume(s);
    const original = s.nightmare.cases[NIGHTMARE_CASE_IDS[0]]!;
    for (const value of [
      null, {}, { ...original, extra: true }, { ...original, status: 'CONTROLLED' },
      { ...original, dreamRecord: 12 }, { ...original, dreamRecord: '' },
      { ...original, attemptWeek: 18 }, { ...original, attemptWeek: 20 }, { ...original, attemptWeek: 19.5 },
    ]) {
      const bad = clone(s); bad.nightmare.cases[NIGHTMARE_CASE_IDS[0]] = value as SliceState['nightmare']['cases'][string];
      expect(validateNightmareState(bad)).toBe(false);
    }
    for (const value of [
      null, {}, { ...s.nightmare.encounter, extra: true }, { ...s.nightmare.encounter, status: 'CONTROLLED' },
      { ...s.nightmare.encounter, observed: 1 }, { ...s.nightmare.encounter, bystanderCleared: 'yes' },
      { ...s.nightmare.encounter, pressure: -1 }, { ...s.nightmare.encounter, pressure: 1.5 },
      { ...s.nightmare.encounter, dreamLocked: null }, { ...s.nightmare.encounter, attemptWeek: 18 },
      { ...s.nightmare.encounter, startHistoryIndex: 1 },
    ]) {
      const bad = clone(s); bad.nightmare.encounter = value as SliceState['nightmare']['encounter'];
      expect(validateNightmareState(bad)).toBe(false);
    }
    s.nightmare.cases[NIGHTMARE_CASE_IDS[0]] = { status: 'DREAM_RECORDED', attemptWeek: 19, dreamRecord: 'A reported dream, awaiting waking cross-check.' };
    s.nightmare.encounter = { status: 'RESOLVED', observed: true, bystanderCleared: true, attemptWeek: 19, startHistoryIndex: null, pressure: 0, dreamLocked: false };
    expect(validateNightmareState(s)).toBe(true);
    const lower = midnight(); lower.nightmare.encounter.pressure = 1;
    expect(validateNightmareState(lower)).toBe(false);
  });
});

describe('nightmare exact command and canon boundaries', () => {
  it('accepts declared acquisition and activity payloads without sharing their entry points', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, { type: 'BUY_POTION', bottleId: 'nightmare-potion-999' },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true },
    ];
    const activities = [
      ...['REFLECT', 'OBSERVE_ENCOUNTER', 'CLEAR_BYSTANDER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].map(type => ({ type })),
      ...NIGHTMARE_CASE_IDS.flatMap(caseId => ['OBSERVE', 'PREPARE', 'SESSION', 'VERIFY', 'WITHDRAW'].map(type => ({ type, caseId }))),
    ];
    for (const command of acquisition) { expect(validateNightmareCommand(command)).toBe(true); expect(isNightmareAcquisitionCommand(command)).toBe(true); }
    const s = prepared();
    for (const command of activities) { expect(validateNightmareCommand(command)).toBe(true); expect(isNightmareAcquisitionCommand(command)).toBe(false); rejected(s, command); }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' }, { type: 'CALL_SPIRIT' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'midnight-potion-1' },
    { type: 'BUY_POTION', bottleId: 'nightmare-potion-0' }, { type: 'BUY_POTION', bottleId: 'nightmare-potion-01' },
    { type: 'BUY_POTION', bottleId: 'nightmare-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: '__proto__' },
    { type: 'SESSION' }, { type: 'SESSION', caseId: NIGHTMARE_CASE_IDS[0], method: 'FORCE' },
    { type: 'VERIFY', caseId: NIGHTMARE_CASE_IDS[0], truth: true }, { type: 'WITHDRAW' },
    { type: 'PERFORM', caseId: NIGHTMARE_CASE_IDS[0], method: 'POEM' },
    { type: 'REFLECT', caseId: NIGHTMARE_CASE_IDS[0] }, { type: 'CLEAR_BYSTANDER', free: true },
    { type: 'ENCOUNTER_FIGHT', guaranteed: true },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateNightmareCommand(command)).toBe(false);
    expect(isNightmareAcquisitionCommand(command)).toBe(false);
    rejected(prepared(), command);
  });

  it('keeps dream claims bounded, distinguishes asleep and awake targets, and never invents a recipe', () => {
    const s = prepared(), p = projectNightmare(s);
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p).toMatchObject({ formulaKnown: false, formula: [] });
    expect(p.risk).toContain('本作G游戏平衡'); expect(p.risk).toContain('意志难度18');
    expect(p.risk).toContain('人类服药成为梦魇后仍须扮演'); expect(p.risk).toContain('不会自动加入教会');
    expect(p.supplies).toContain('完整配方资料待核');
    expect(NIGHTMARE_ABILITIES.map(ability => ability.id)).toEqual([...NIGHTMARE_ABILITY_IDS]);
    expect(NIGHTMARE_ABILITIES[0]!.description).toContain('已睡者');
    expect(NIGHTMARE_ABILITIES[0]!.description).toContain('清醒目标逐步');
    expect(NIGHTMARE_ABILITIES[0]!.description).toContain('本体不能移动');
    expect(NIGHTMARE_ABILITIES[0]!.description).toContain('特殊物品的例外');
    expect(NIGHTMARE_ABILITIES[0]!.description).toContain('不是新晋序列7');
    expect(NIGHTMARE_ABILITIES[1]!.description).toContain('欺骗');
    expect(NIGHTMARE_ABILITIES[1]!.description).toContain('醒来交叉核实');
    expect(NIGHTMARE_ABILITIES[1]!.description).toContain('不是真相神谕');
    expect(NIGHTMARE_ABILITIES[1]!.description).toContain('没有序列6');
    expect(NIGHTMARE_ABILITIES[1]!.description).toContain('序列5的外部灵体');
  });
});
