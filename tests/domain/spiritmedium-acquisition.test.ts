import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyCorpsecollectorCommand } from '../../src/domain/corpsecollector/index.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../../src/domain/corpsecollector/types.js';
import { applyGravediggerCommand } from '../../src/domain/gravedigger/index.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../../src/domain/gravedigger/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applySpiritmediumCommand, createSpiritmediumState, isSpiritmediumAcquisitionCommand,
  projectSpiritmedium, validateSpiritmediumCommand, validateSpiritmediumState,
} from '../../src/domain/spiritmedium/index.js';
import { SPIRITMEDIUM_ABILITIES, SPIRITMEDIUM_BOTTLE_IDS, SPIRITMEDIUM_FORMULA_STATUS, SPIRITMEDIUM_LABOUR_TASKS } from '../../src/domain/spiritmedium/content.js';
import { SPIRITMEDIUM_ABILITY_IDS, SPIRITMEDIUM_CASE_IDS, type SpiritmediumAcquisitionCommand } from '../../src/domain/spiritmedium/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = SPIRITMEDIUM_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('spiritmedium-acquisition', sliceDefaultCreationSelection, 'spiritmedium-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.spiritmedium = createSpiritmediumState();
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
function gravedigger(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyCorpsecollectorCommand(s, { type: 'DISCOVER' }, c);
  applyCorpsecollectorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCorpsecollectorCommand(s, { type: 'BUY_POTION', bottleId: s.corpsecollector.bottles[0]!.id }, c);
  applyCorpsecollectorCommand(s, { type: 'CONSUME', bottleId: s.corpsecollector.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyGravediggerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyGravediggerCommand(s, { type: 'BUY_POTION', bottleId: s.gravedigger.bottles[0]!.id }, c);
  applyGravediggerCommand(s, { type: 'CONSUME', bottleId: s.gravedigger.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: SpiritmediumAcquisitionCommand, roll = 20) { applySpiritmediumCommand(s, command, context(s, roll).c); }
function taught(s = gravedigger()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.spiritmedium.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.spiritmedium.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as SpiritmediumAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('spiritmedium S7 independent finished-potion acquisition', () => {
  it('creates three sourced independent bottles and untouched activity reserves', () => {
    const s = ordinary(), other = createSpiritmediumState();
    expect(validateSpiritmediumState(s)).toBe(true);
    expect(s.spiritmedium.bottles.map(bottle => bottle.id)).toEqual([...SPIRITMEDIUM_BOTTLE_IDS]);
    expect(s.spiritmedium.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.spiritmedium).toMatchObject({ reflected: false, promotionWeek: null, gravediggerActingAtPromotion: null, cardLocation: 'TABLE' });
    expect(Object.keys(s.spiritmedium.cases)).toEqual([...SPIRITMEDIUM_CASE_IDS]);
    expect(Object.values(s.spiritmedium.cases)).toEqual(SPIRITMEDIUM_CASE_IDS.map(() => ({ status: 'AVAILABLE', attemptWeek: null, method: null, mistakes: 0, withdrawals: 0, conclusion: null })));
    other.bottles[0]!.labourSteps = 4; other.cases[SPIRITMEDIUM_CASE_IDS[0]]!.status = 'OBSERVED';
    expect([s.spiritmedium.bottles[0]!.labourSteps, s.spiritmedium.cases[SPIRITMEDIUM_CASE_IDS[0]]!.status]).toEqual([0, 'AVAILABLE']);
  });

  it('hides the future channel and rejects route skipping', () => {
    const s = ordinary(), p = projectSpiritmedium(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/spiritmedium-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const corpsecollector = gravedigger(); corpsecollector.progression.sequence = 9;
    rejected(corpsecollector, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without a full recipe or lower-state changes', () => {
    const s = gravedigger(), old = [JSON.stringify(s.corpsecollector), JSON.stringify(s.gravedigger), JSON.stringify(s.progression)];
    expect(projectSpiritmedium(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.spiritmedium.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectSpiritmedium(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectSpiritmedium(s).supplies).toContain(SPIRITMEDIUM_FORMULA_STATUS);
    expect(projectSpiritmedium(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.corpsecollector), JSON.stringify(s.gravedigger), JSON.stringify(s.progression)]).toEqual(old);
    expect(validateSpiritmediumState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original once', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.spiritmedium.bottles.slice(1));
    expect(buy(s)).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect([s.cash, s.actionsRemaining, JSON.stringify(s.spiritmedium.bottles.slice(1))]).toEqual([7750, ap, others]);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    expect(validateSpiritmediumState(s)).toBe(true);
  });

  it('only four real jobs on the selected bottle waive 1800 pence, never a partial refund', () => {
    for (const count of [1, 2, 3, 4]) {
      const s = taught(), ctx = context(s);
      for (let i = 0; i < count; i += 1) applySpiritmediumCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.spiritmedium.bottles[0]!.labourSteps]).toEqual([9760, 39 - count, count]);
      expect(ctx.notes.map(note => note.title)).toEqual(SPIRITMEDIUM_LABOUR_TASKS.slice(0, count).map(task => `完成${task}`));
      expect(projectSpiritmedium(s).actions.find(action => action.id === `buy-${SPIRITMEDIUM_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
      if (count === 4) rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      buy(s);
      expect(s.cash).toBe(count === 4 ? 9550 : 7750);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash, foreign originals and forged confirmations without mutation', () => {
    const s = gravedigger(); s.cash = 239; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['corpsecollector-potion-1', 'gravedigger-potion-1', 'spiritmedium-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'CONSUME', bottleId: SPIRITMEDIUM_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('permits early preparation but requires S8 acting 100 and eight whole weeks since S8', () => {
    const s = gravedigger(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command); s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectSpiritmedium(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.gravedigger.promotionWeek, s.spiritmedium.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.spiritmedium.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validateSpiritmediumState(s)).toBe(true);
  });

  it('resolves all four will-18 tiers with real original consumption and recoverable guided costs', () => {
    for (const [roll, tier, sequence, mind, health, pollution] of [
      [1, 'GREAT_SUCCESS', 7, 95, 100, 0], [20, 'SUCCESS', 7, 90, 100, 0],
      [80, 'FAILURE', 8, 80, 90, 25], [99, 'GREAT_FAILURE', 8, 60, 80, 50],
    ] as const) {
      const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
      applySpiritmediumCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]);
      expect(ctx.draws).toEqual([]);
      expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
      expect(s.spiritmedium.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect(validateSpiritmediumState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('inherits all five old masteries, resets only S7 acting, and raises the cap without a refill', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const old = [JSON.stringify(s.corpsecollector), JSON.stringify(s.gravedigger), JSON.stringify(s.caseArchive)];
    s.spirituality = 9; consume(s);
    expect([s.spiritmedium.gravediggerActingAtPromotion, s.progression.acting, s.spirituality]).toEqual([100, 0, 9]);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(SPIRITMEDIUM_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique + 2, perception: stats.perception + 2, will: stats.will + 2, knowledge: stats.knowledge + 1 });
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.corpsecollector), JSON.stringify(s.gravedigger), JSON.stringify(s.caseArchive)]).toEqual(old);
    expect(projectSpiritmedium(s).abilities.map(ability => ability.id)).toEqual([...SPIRITMEDIUM_ABILITY_IDS]);
    const capped = prepared(); capped.character.coreStats = { physique: 500, perception: 499, will: 500, knowledge: 499 }; consume(capped, 1);
    expect(capped.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
  });

  it('blocks unavailable bodies, routes, locations, runs and ongoing events or combat', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.corpsecollector.discovered = false; },
      s => { s.corpsecollector.guidanceKnown = false; }, s => { s.gravedigger.guidanceKnown = false; }, s => { s.gravedigger.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.combat = {} as NonNullable<SliceState['combat']>; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }); }
  });

  it('requires AP for guidance and labour but allows purchase and consumption at zero AP', () => {
    const s = gravedigger(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s); expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it('retains a failed original and old progression, then preserves spare originals after successful recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.spiritmedium.promotionWeek, s.spiritmedium.gravediggerActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100; buy(s, 1); buy(s, 2); consume(s, 20, 1);
    expect(s.spiritmedium.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'GREAT_FAILURE'], ['CONSUMED', 'SUCCESS'], ['PLAYER', null]]);
    expect(s.seer.pollution).toBe(50);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: SPIRITMEDIUM_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: SPIRITMEDIUM_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: SPIRITMEDIUM_BOTTLE_IDS[2], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectSpiritmedium(s).actions.every(action => !action.enabled)).toBe(true);
    expect(validateSpiritmediumState(s)).toBe(true);
  });

  it('only restocks after all three failures and a real later week, keeping old bottles and all prices', () => {
    const s = taught(); rejected(s, { type: 'REQUEST_SUPPLY' });
    for (let index = 0; index < 3; index += 1) {
      buy(s, index); consume(s, 80, index);
      if (index < 2) rejected(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = JSON.stringify(s.spiritmedium.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.spiritmedium.bottles.length, s.spiritmedium.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.spiritmedium.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.spiritmedium.resupply.deliveries, s.spiritmedium.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.spiritmedium.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['spiritmedium-potion-4', 'SUPPLIER', 0], ['spiritmedium-potion-5', 'SUPPLIER', 0], ['spiritmedium-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectSpiritmedium(s).actions.find(action => action.id === 'buy-spiritmedium-potion-4')!.cost).toContain('2010便士');
    expect(validateSpiritmediumState(s)).toBe(true); rejected(s, { type: 'RECEIVE_SUPPLY' });
    const bad = clone(s); bad.spiritmedium.bottles[3]!.source = bad.spiritmedium.bottles[3]!.source.replace('第20周', '第19周');
    expect(validateSpiritmediumState(bad)).toBe(false);
  });

  it('rejects malformed stock, duplicate success, chronology and incomplete inherited abilities on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.spiritmedium.bottles[0]!.id = 'gravedigger-potion-1'; }, s => { s.spiritmedium.bottles[0]!.source = 'unsourced'; },
      s => { s.spiritmedium.bottles[1]!.labourSteps = 5; }, s => { s.spiritmedium.promotionWeek = 18; },
      s => { s.spiritmedium.gravediggerActingAtPromotion = 99; }, s => { delete s.progression.mastery[CORPSECOLLECTOR_ABILITY_IDS[0]]; },
      s => { delete s.progression.mastery[GRAVEDIGGER_ABILITY_IDS[0]]; },
      s => { s.spiritmedium.cases[SPIRITMEDIUM_CASE_IDS[0]]!.attemptWeek = 18; },
      s => { delete s.spiritmedium.cases[SPIRITMEDIUM_CASE_IDS[0]]; },
      s => { delete s.progression.mastery[SPIRITMEDIUM_ABILITY_IDS[0]]; },
      s => { s.progression.mastery[SPIRITMEDIUM_ABILITY_IDS[0]] = 501; },
      s => { s.progression.mastery['death.s6.wind'] = 0; },
      s => { s.spiritmedium.bottles[1] = { ...s.spiritmedium.bottles[0]!, id: SPIRITMEDIUM_BOTTLE_IDS[1], source: s.spiritmedium.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateSpiritmediumState(bad)).toBe(false); }
    const bad = clone(s); (bad.spiritmedium.bottles as unknown[])[0] = null; expect(validateSpiritmediumState(bad)).toBe(false);
    const beforePromotion = gravedigger(); beforePromotion.spiritmedium.cases[SPIRITMEDIUM_CASE_IDS[0]]!.status = 'OBSERVED';
    expect(validateSpiritmediumState(beforePromotion)).toBe(false);
  });


  it('caps rejection and requires recovery without erasing failure records', () => {
    const s = prepared(); buy(s, 1);
    s.health = 10; s.mind = 20; s.seer.pollution = 90;
    consume(s, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    rejected(s, { type: 'CONSUME', bottleId: SPIRITMEDIUM_BOTTLE_IDS[1], confirmed: true });
    expect(validateSpiritmediumState(s)).toBe(true);
  });

  it('never replenishes automatically, reuses labour or gives credit for old originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    s.week += 10;
    expect(s.spiritmedium.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 4; apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining, s.spiritmedium.bottles[3]!.labourSteps]).toEqual([cash - 2010, actions, 0]);
    const old = JSON.stringify(s.spiritmedium.bottles.slice(0, 3));
    consume(s, 1, 3);
    expect(JSON.stringify(s.spiritmedium.bottles.slice(0, 3))).toBe(old);
    expect(s.spiritmedium.promotionWeek).toBe(30);
    expect(validateSpiritmediumState(s)).toBe(true);
  });

  it('rejects mismatched delivery counts, mixed dates and restoration of exhausted originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    for (const mutate of [
      (x: SliceState) => { x.spiritmedium.resupply.deliveries = 0; },
      (x: SliceState) => { x.spiritmedium.resupply.deliveries = 2; },
      (x: SliceState) => { x.spiritmedium.bottles[3]!.id = 'spiritmedium-potion-7'; },
      (x: SliceState) => { x.spiritmedium.bottles[0]!.status = 'PLAYER'; x.spiritmedium.bottles[0]!.consumedWeek = null; x.spiritmedium.bottles[0]!.outcome = null; },
      (x: SliceState) => { x.week = 21; x.spiritmedium.bottles[4]!.source = x.spiritmedium.bottles[4]!.source.replace('第20周', '第21周'); },
      (x: SliceState) => { x.spiritmedium.resupply.requestedWeek = 19; },
    ]) { const bad = clone(s); mutate(bad); expect(validateSpiritmediumState(bad)).toBe(false); }
    for (const value of [null, [], {}, { ...s.spiritmedium, extra: true }]) {
      const bad = clone(s); bad.spiritmedium = value as SliceState['spiritmedium'];
      expect(validateSpiritmediumState(bad)).toBe(false);
    }
  });

});

describe('spiritmedium exact intent and grounded spirit boundaries', () => {
  it('accepts only declared acquisition and finite activity payloads and separates their entry points', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, { type: 'BUY_POTION', bottleId: 'spiritmedium-potion-999' },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' },
      ...SPIRITMEDIUM_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PERFORM', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PREPARE', caseId, method: 'RITUAL' }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
        { type: 'REPORT', caseId, conclusion: 'LIMITED' }, { type: 'REPORT', caseId, conclusion: 'COMPLETE' },
      ]),
    ];
    for (const command of acquisition) { expect(validateSpiritmediumCommand(command)).toBe(true); expect(isSpiritmediumAcquisitionCommand(command)).toBe(true); }
    const s = prepared();
    for (const command of activities) { expect(validateSpiritmediumCommand(command)).toBe(true); expect(isSpiritmediumAcquisitionCommand(command)).toBe(false); rejected(s, command); }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'gravedigger-potion-1' },
    { type: 'BUY_POTION', bottleId: 'spiritmedium-potion-0' }, { type: 'BUY_POTION', bottleId: 'spiritmedium-potion-01' },
    { type: 'BUY_POTION', bottleId: 'spiritmedium-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'OBSERVE', caseId: '__proto__' },
    { type: 'OBSERVE', caseId: 'lamp-spirit', cleared: true }, { type: 'PREPARE' },
    { type: 'WITHDRAW', caseId: 'lamp-spirit', free: true },
    { type: 'PREPARE', caseId: 'lamp-spirit' }, { type: 'PREPARE', caseId: 'lamp-spirit', method: 'SPIRIT' },
    { type: 'PREPARE', caseId: 'memento-question', method: 'RITUAL', outcome: 'TRUTH' },
    { type: 'PREPARE', caseId: 'wind-assistance', method: '__proto__' },
    { type: 'PERFORM', caseId: 'lamp-spirit', method: 'RITUAL' },
    { type: 'REFLECT', caseId: 'lamp-spirit' }, { type: 'REPORT', caseId: 'lamp-spirit' },
    { type: 'REPORT', caseId: 'lamp-spirit', conclusion: 'COMMAND' },
    { type: 'REPORT', caseId: 'lamp-spirit', conclusion: 'LIMITED', verified: true },
    { type: 'REPORT', caseId: '__proto__', conclusion: 'COMPLETE' },
  ])('rejects malformed or undeclared intent %j without mutation', command => {
    expect(validateSpiritmediumCommand(command)).toBe(false);
    expect(isSpiritmediumAcquisitionCommand(command)).toBe(false);
    rejected(prepared(), command);
  });

  it('reserves exact finite case shapes while leaving movement and report semantics to life', () => {
    const s = prepared(); consume(s);
    const original = s.spiritmedium.cases['lamp-spirit']!;
    for (const value of [
      null, {}, { ...original, automatic: true }, { ...original, status: 'OMNISCIENT' },
      { ...original, method: '' }, { ...original, method: 'SPIRIT' },
      { ...original, conclusion: 'CERTAIN' }, { ...original, conclusion: 'COMMAND' },
      { ...original, mistakes: -1 }, { ...original, mistakes: 1.5 },
      { ...original, attemptWeek: 18 }, { ...original, attemptWeek: 20 },
      { ...original, attemptWeek: 19.5 }, { ...original, withdrawals: -1 },
      { ...original, withdrawals: 0.5 },
    ]) {
      const bad = clone(s); bad.spiritmedium.cases['lamp-spirit'] = value as SliceState['spiritmedium']['cases'][string];
      expect(validateSpiritmediumState(bad)).toBe(false);
    }
    s.spiritmedium.cases['lamp-spirit'] = { status: 'EXAMINED', attemptWeek: 19, method: 'RITUAL', withdrawals: 0, mistakes: 1, conclusion: 'COMPLETE' };
    expect(validateSpiritmediumState(s)).toBe(true);
    s.spiritmedium.cardLocation = 'TRAY';
    expect(validateSpiritmediumState(s)).toBe(true);
    for (const value of [null, '', 'PLAYER', 'DESTROYED', 1]) {
      const bad = clone(s); bad.spiritmedium.cardLocation = value as SliceState['spiritmedium']['cardLocation'];
      expect(validateSpiritmediumState(bad)).toBe(false);
    }
    const lower = gravedigger(); lower.spiritmedium.cardLocation = 'TRAY';
    expect(validateSpiritmediumState(lower)).toBe(false);
  });

  it('keeps unknown recipe and canonical S7 abilities separate from fabricated omniscience and higher powers', () => {
    const s = prepared(), p = projectSpiritmedium(s);
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p).toMatchObject({ formulaKnown: false, formula: [] });
    expect(p.risk).toContain('意志难度18'); expect(p.risk).toContain('本作G平衡设定');
    expect(p.supplies).toContain('完整配方尚未核定');
    expect(p.story).toContain('第四部第186章'); expect(p.story).toContain('本作玩法改编G');
    expect(p.story).toContain('可理解的真实回答不等于全部真相');
    expect(p.story).toContain('片段缺失与污染危险');
    expect(p.story).toContain('序列6才扩展到灵界招募信使与高强度亡者之语');
    expect(p.story).toContain('序列5的冥界之门也未提前下放');
    expect(SPIRITMEDIUM_ABILITIES.map(ability => ability.id)).toEqual([...SPIRITMEDIUM_ABILITY_IDS]);
    expect(SPIRITMEDIUM_ABILITIES).toHaveLength(3);
    expect(SPIRITMEDIUM_ABILITIES[0]!.description).toContain('灵相关仪式');
    expect(SPIRITMEDIUM_ABILITIES[1]!.description).toContain('现实中的自然灵与徘徊亡魂');
    expect(SPIRITMEDIUM_ABILITIES[1]!.description).toContain('可理解的真实回答不等于全部真相');
    expect(SPIRITMEDIUM_ABILITIES[2]!.description).toContain('有限控制、驱使自然灵');
    expect(SPIRITMEDIUM_ABILITIES[2]!.description).toContain('不从灵界招募信使');
    expect(SPIRITMEDIUM_FORMULA_STATUS).toContain('不沿用收尸人材料片段或掘墓人成品来源');
    consume(s);
    expect(Object.keys(s.progression.mastery)).toHaveLength(8);
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/death\.s[0-6]\.|messenger|underworld/);
  });
});
