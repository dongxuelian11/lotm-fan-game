import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyApprenticeCommand } from '../../src/domain/apprentice/index.js';
import { APPRENTICE_ABILITY_IDS } from '../../src/domain/apprentice/types.js';
import { applyTrickmasterCommand } from '../../src/domain/trickmaster/index.js';
import { TRICKMASTER_ABILITY_IDS } from '../../src/domain/trickmaster/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyAstrologerCommand, createAstrologerState, isAstrologerAcquisitionCommand,
  projectAstrologer, validateAstrologerCommand, validateAstrologerState,
} from '../../src/domain/astrologer/index.js';
import { ASTROLOGER_ABILITIES, ASTROLOGER_BOTTLE_IDS, ASTROLOGER_FORMULA_STATUS, ASTROLOGER_LABOUR_TASKS } from '../../src/domain/astrologer/content.js';
import { ASTROLOGER_ABILITY_IDS, ASTROLOGER_CASE_IDS, type AstrologerAcquisitionCommand } from '../../src/domain/astrologer/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = ASTROLOGER_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('astrologer-acquisition', sliceDefaultCreationSelection, 'astrologer-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.astrologer = createAstrologerState();
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
function trickmaster(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyApprenticeCommand(s, { type: 'DISCOVER' }, c);
  applyApprenticeCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyApprenticeCommand(s, { type: 'BUY_POTION', bottleId: s.apprentice.bottles[0]!.id }, c);
  applyApprenticeCommand(s, { type: 'CONSUME', bottleId: s.apprentice.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyTrickmasterCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyTrickmasterCommand(s, { type: 'BUY_MATERIALS', batchId: s.trickmaster.batches[0]!.id }, c);
  applyTrickmasterCommand(s, { type: 'BREW', batchId: s.trickmaster.batches[0]!.id }, c);
  applyTrickmasterCommand(s, { type: 'CONSUME', bottleId: s.trickmaster.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...APPRENTICE_ABILITY_IDS, ...TRICKMASTER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: AstrologerAcquisitionCommand, roll = 20) { applyAstrologerCommand(s, command, context(s, roll).c); }
function taught(s = trickmaster()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.astrologer.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.astrologer.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as AstrologerAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('astrologer S7 independent finished-potion acquisition', () => {
  it('creates three sourced independent bottles and untouched activity reserves', () => {
    const s = ordinary(), other = createAstrologerState();
    expect(validateAstrologerState(s)).toBe(true);
    expect(s.astrologer.bottles.map(bottle => bottle.id)).toEqual([...ASTROLOGER_BOTTLE_IDS]);
    expect(s.astrologer.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.astrologer).toMatchObject({ reflected: false, promotionWeek: null, trickmasterActingAtPromotion: null, probe: { spirituality: 6, roll: null, chance: null, tier: null, interferenceApplied: false } });
    expect(Object.keys(s.astrologer.cases)).toEqual([...ASTROLOGER_CASE_IDS]);
    expect(Object.values(s.astrologer.cases)).toEqual(ASTROLOGER_CASE_IDS.map(() => ({ status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' })));
    other.bottles[0]!.labourSteps = 4; other.cases[ASTROLOGER_CASE_IDS[0]]!.status = 'OBSERVED';
    expect([s.astrologer.bottles[0]!.labourSteps, s.astrologer.cases[ASTROLOGER_CASE_IDS[0]]!.status]).toEqual([0, 'AVAILABLE']);
  });

  it('hides the future channel and rejects route skipping', () => {
    const s = ordinary(), p = projectAstrologer(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/astrologer-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const apprentice = trickmaster(); apprentice.progression.sequence = 9;
    rejected(apprentice, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without a full recipe or lower-state changes', () => {
    const s = trickmaster(), old = [JSON.stringify(s.apprentice), JSON.stringify(s.trickmaster), JSON.stringify(s.progression)];
    expect(projectAstrologer(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.astrologer.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectAstrologer(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectAstrologer(s).supplies).toContain(ASTROLOGER_FORMULA_STATUS);
    expect(projectAstrologer(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.apprentice), JSON.stringify(s.trickmaster), JSON.stringify(s.progression)]).toEqual(old);
    expect(validateAstrologerState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original once', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.astrologer.bottles.slice(1));
    expect(buy(s)).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect([s.cash, s.actionsRemaining, JSON.stringify(s.astrologer.bottles.slice(1))]).toEqual([7750, ap, others]);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    expect(validateAstrologerState(s)).toBe(true);
  });

  it('only four real jobs on the selected bottle waive 1800 pence, never a partial refund', () => {
    for (const count of [1, 2, 3, 4]) {
      const s = taught(), ctx = context(s);
      for (let i = 0; i < count; i += 1) applyAstrologerCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.astrologer.bottles[0]!.labourSteps]).toEqual([9760, 39 - count, count]);
      expect(ctx.notes.map(note => note.title)).toEqual(ASTROLOGER_LABOUR_TASKS.slice(0, count).map(task => `完成${task}`));
      expect(projectAstrologer(s).actions.find(action => action.id === `buy-${ASTROLOGER_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
      if (count === 4) rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      buy(s);
      expect(s.cash).toBe(count === 4 ? 9550 : 7750);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash, foreign originals and forged confirmations without mutation', () => {
    const s = trickmaster(); s.cash = 239; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['apprentice-potion-1', 'trickmaster-potion-1', 'astrologer-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'CONSUME', bottleId: ASTROLOGER_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('permits early preparation but requires S8 acting 100 and eight whole weeks since S8', () => {
    const s = trickmaster(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command); s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectAstrologer(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.trickmaster.promotionWeek, s.astrologer.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.astrologer.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validateAstrologerState(s)).toBe(true);
  });

  it('resolves all four will-18 tiers with real original consumption and recoverable guided costs', () => {
    for (const [roll, tier, sequence, mind, health, pollution] of [
      [1, 'GREAT_SUCCESS', 7, 95, 100, 0], [20, 'SUCCESS', 7, 90, 100, 0],
      [80, 'FAILURE', 8, 80, 90, 25], [99, 'GREAT_FAILURE', 8, 60, 80, 50],
    ] as const) {
      const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
      applyAstrologerCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]);
      expect(ctx.draws).toEqual([]);
      expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
      expect(s.astrologer.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect(validateAstrologerState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('inherits both old masteries, resets only S7 acting, and raises the cap without a refill', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const old = [JSON.stringify(s.apprentice), JSON.stringify(s.trickmaster), JSON.stringify(s.caseArchive)];
    s.spirituality = 9; consume(s);
    expect([s.astrologer.trickmasterActingAtPromotion, s.progression.acting, s.spirituality]).toEqual([100, 0, 9]);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(ASTROLOGER_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique + 1, perception: stats.perception + 3, will: stats.will + 2, knowledge: stats.knowledge + 1 });
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.apprentice), JSON.stringify(s.trickmaster), JSON.stringify(s.caseArchive)]).toEqual(old);
    expect(projectAstrologer(s).abilities.map(ability => ability.id)).toEqual([...ASTROLOGER_ABILITY_IDS]);
    const capped = prepared(); capped.character.coreStats = { physique: 500, perception: 499, will: 500, knowledge: 499 }; consume(capped, 1);
    expect(capped.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
  });

  it('blocks unavailable bodies, routes, locations, runs and ongoing events or combat', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.apprentice.discovered = false; },
      s => { s.apprentice.guidanceKnown = false; }, s => { s.trickmaster.formulaKnown = false; }, s => { s.trickmaster.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.combat = {} as NonNullable<SliceState['combat']>; },
      s => { s.apprentice.cases['locked-office']!.position = 'INSIDE'; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }); }
  });

  it('requires AP for guidance and labour but allows purchase and consumption at zero AP', () => {
    const s = trickmaster(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s); expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it('retains a failed original and old progression, then preserves spare originals after successful recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.astrologer.promotionWeek, s.astrologer.trickmasterActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100; buy(s, 1); buy(s, 2); consume(s, 20, 1);
    expect(s.astrologer.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'GREAT_FAILURE'], ['CONSUMED', 'SUCCESS'], ['PLAYER', null]]);
    expect(s.seer.pollution).toBe(50);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: ASTROLOGER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: ASTROLOGER_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: ASTROLOGER_BOTTLE_IDS[2], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectAstrologer(s).actions.every(action => !action.enabled)).toBe(true);
    expect(validateAstrologerState(s)).toBe(true);
  });

  it('only restocks after all three failures and a real later week, keeping old bottles and all prices', () => {
    const s = taught(); rejected(s, { type: 'REQUEST_SUPPLY' });
    for (let index = 0; index < 3; index += 1) {
      buy(s, index); consume(s, 80, index);
      if (index < 2) rejected(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = JSON.stringify(s.astrologer.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.astrologer.bottles.length, s.astrologer.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.astrologer.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.astrologer.resupply.deliveries, s.astrologer.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.astrologer.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['astrologer-potion-4', 'SUPPLIER', 0], ['astrologer-potion-5', 'SUPPLIER', 0], ['astrologer-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectAstrologer(s).actions.find(action => action.id === 'buy-astrologer-potion-4')!.cost).toContain('2010便士');
    expect(validateAstrologerState(s)).toBe(true); rejected(s, { type: 'RECEIVE_SUPPLY' });
    const bad = clone(s); bad.astrologer.bottles[3]!.source = bad.astrologer.bottles[3]!.source.replace('第20周', '第19周');
    expect(validateAstrologerState(bad)).toBe(false);
  });

  it('rejects malformed stock, duplicate success, chronology and incomplete inherited abilities on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.astrologer.bottles[0]!.id = 'trickmaster-potion-1'; }, s => { s.astrologer.bottles[0]!.source = 'unsourced'; },
      s => { s.astrologer.bottles[1]!.labourSteps = 5; }, s => { s.astrologer.promotionWeek = 18; },
      s => { s.astrologer.trickmasterActingAtPromotion = 99; }, s => { delete s.progression.mastery[APPRENTICE_ABILITY_IDS[0]]; },
      s => { delete s.progression.mastery[TRICKMASTER_ABILITY_IDS[0]]; },
      s => { s.astrologer.cases[ASTROLOGER_CASE_IDS[0]]!.attemptWeek = 18; },
      s => { delete s.astrologer.cases[ASTROLOGER_CASE_IDS[0]]; },
      s => { delete s.progression.mastery[ASTROLOGER_ABILITY_IDS[0]]; },
      s => { s.progression.mastery[ASTROLOGER_ABILITY_IDS[0]] = 501; },
      s => { s.progression.mastery['door.s6.recording'] = 0; },
      s => { s.astrologer.bottles[1] = { ...s.astrologer.bottles[0]!, id: ASTROLOGER_BOTTLE_IDS[1], source: s.astrologer.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateAstrologerState(bad)).toBe(false); }
    const bad = clone(s); (bad.astrologer.bottles as unknown[])[0] = null; expect(validateAstrologerState(bad)).toBe(false);
    const beforePromotion = trickmaster(); beforePromotion.astrologer.cases[ASTROLOGER_CASE_IDS[0]]!.status = 'OBSERVED';
    expect(validateAstrologerState(beforePromotion)).toBe(false);
  });


  it('caps rejection and requires recovery without erasing failure records', () => {
    const s = prepared(); buy(s, 1);
    s.health = 10; s.mind = 20; s.seer.pollution = 90;
    consume(s, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    rejected(s, { type: 'CONSUME', bottleId: ASTROLOGER_BOTTLE_IDS[1], confirmed: true });
    expect(validateAstrologerState(s)).toBe(true);
  });

  it('never replenishes automatically, reuses labour or gives credit for old originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    s.week += 10;
    expect(s.astrologer.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 4; apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining, s.astrologer.bottles[3]!.labourSteps]).toEqual([cash - 2010, actions, 0]);
    const old = JSON.stringify(s.astrologer.bottles.slice(0, 3));
    consume(s, 1, 3);
    expect(JSON.stringify(s.astrologer.bottles.slice(0, 3))).toBe(old);
    expect(s.astrologer.promotionWeek).toBe(30);
    expect(validateAstrologerState(s)).toBe(true);
  });

  it('rejects mismatched delivery counts, mixed dates and restoration of exhausted originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    for (const mutate of [
      (x: SliceState) => { x.astrologer.resupply.deliveries = 0; },
      (x: SliceState) => { x.astrologer.resupply.deliveries = 2; },
      (x: SliceState) => { x.astrologer.bottles[3]!.id = 'astrologer-potion-7'; },
      (x: SliceState) => { x.astrologer.bottles[0]!.status = 'PLAYER'; x.astrologer.bottles[0]!.consumedWeek = null; x.astrologer.bottles[0]!.outcome = null; },
      (x: SliceState) => { x.week = 21; x.astrologer.bottles[4]!.source = x.astrologer.bottles[4]!.source.replace('第20周', '第21周'); },
      (x: SliceState) => { x.astrologer.resupply.requestedWeek = 19; },
    ]) { const bad = clone(s); mutate(bad); expect(validateAstrologerState(bad)).toBe(false); }
    for (const value of [null, [], {}, { ...s.astrologer, extra: true }]) {
      const bad = clone(s); bad.astrologer = value as SliceState['astrologer'];
      expect(validateAstrologerState(bad)).toBe(false);
    }
  });

});

describe('astrologer exact intent and grounded astrology boundaries', () => {
  it('accepts only declared acquisition and finite activity payloads and separates their entry points', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, { type: 'BUY_POTION', bottleId: 'astrologer-potion-999' },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' },
      ...ASTROLOGER_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PERFORM', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PREPARE', caseId, method: 'STAR' }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
      ]),
    ];
    for (const command of acquisition) { expect(validateAstrologerCommand(command)).toBe(true); expect(isAstrologerAcquisitionCommand(command)).toBe(true); }
    const s = prepared();
    for (const command of activities) { expect(validateAstrologerCommand(command)).toBe(true); expect(isAstrologerAcquisitionCommand(command)).toBe(false); rejected(s, command); }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'trickmaster-potion-1' },
    { type: 'BUY_POTION', bottleId: 'astrologer-potion-0' }, { type: 'BUY_POTION', bottleId: 'astrologer-potion-01' },
    { type: 'BUY_POTION', bottleId: 'astrologer-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'OBSERVE', caseId: '__proto__' },
    { type: 'OBSERVE', caseId: 'portrait-pair', cleared: true }, { type: 'PREPARE' },
    { type: 'WITHDRAW', caseId: 'portrait-pair', free: true },
    { type: 'PREPARE', caseId: 'portrait-pair' }, { type: 'PREPARE', caseId: 'portrait-pair', method: 'SPIRIT' },
    { type: 'PREPARE', caseId: 'short-route', method: 'STAR', outcome: 'TRUTH' },
    { type: 'PREPARE', caseId: 'willing-probe', method: '__proto__' },
    { type: 'PERFORM', caseId: 'portrait-pair', method: 'STAR' },
    { type: 'REFLECT', caseId: 'portrait-pair' }, { type: 'REPORT', caseId: 'portrait-pair' },
    { type: 'REPORT', caseId: 'portrait-pair', conclusion: 'COMMAND' },
    { type: 'REPORT', caseId: 'portrait-pair', conclusion: 'LIMITED', verified: true },
    { type: 'REPORT', caseId: '__proto__', conclusion: 'COMPLETE' },
  ])('rejects malformed or undeclared intent %j without mutation', command => {
    expect(validateAstrologerCommand(command)).toBe(false);
    expect(isAstrologerAcquisitionCommand(command)).toBe(false);
    rejected(prepared(), command);
  });

  it('reserves exact finite case and probe shapes while leaving resolved semantics to life', () => {
    const s = prepared(); consume(s);
    const original = s.astrologer.cases['portrait-pair']!;
    for (const value of [
      null, {}, { ...original, automatic: true }, { ...original, status: 'OMNISCIENT' },
      { ...original, status: 'EXAMINED' }, { ...original, method: '' }, { ...original, method: 'SPIRIT' },
      { ...original, outcome: 'CERTAIN' }, { ...original, outcome: null },
      { ...original, attemptWeek: 18 }, { ...original, attemptWeek: 20 },
      { ...original, attemptWeek: 19.5 }, { ...original, withdrawals: -1 }, { ...original, withdrawals: 0.5 },
    ]) {
      const bad = clone(s); bad.astrologer.cases['portrait-pair'] = value as SliceState['astrologer']['cases'][string];
      expect(validateAstrologerState(bad)).toBe(false);
    }
    s.astrologer.cases['portrait-pair'] = { status: 'RESOLVED', attemptWeek: 19, method: 'STAR', withdrawals: 0, outcome: 'CORRELATED' };
    expect(validateAstrologerState(s)).toBe(true);
    const probe = { ...s.astrologer.probe };
    for (const value of [
      null, {}, { ...probe, actor: 'invented' }, { ...probe, spirituality: 7 }, { ...probe, spirituality: -1 },
      { ...probe, spirituality: 5.5 }, { ...probe, roll: 0 }, { ...probe, roll: 101 }, { ...probe, roll: 1.5 },
      { ...probe, chance: -1 }, { ...probe, chance: 101 }, { ...probe, tier: 'GUARANTEED' },
      { ...probe, interferenceApplied: 1 },
    ]) {
      const bad = clone(s); bad.astrologer.probe = value as SliceState['astrologer']['probe'];
      expect(validateAstrologerState(bad)).toBe(false);
    }
    s.astrologer.probe = { spirituality: 5, roll: 35, chance: 34, tier: 'FAILURE', interferenceApplied: true };
    expect(validateAstrologerState(s)).toBe(true);
    for (const mutate of [
      (x: SliceState) => { x.astrologer.probe.spirituality = 5; },
      (x: SliceState) => { x.astrologer.probe.roll = 1; },
      (x: SliceState) => { x.astrologer.probe.chance = 34; },
      (x: SliceState) => { x.astrologer.probe.tier = 'SUCCESS'; },
      (x: SliceState) => { x.astrologer.probe.interferenceApplied = true; },
      (x: SliceState) => { x.astrologer.reflected = true; },
    ]) { const lower = trickmaster(); mutate(lower); expect(validateAstrologerState(lower)).toBe(false); }
  });

  it('keeps unknown recipe and canonical S7 abilities separate from fabricated omniscience and higher powers', () => {
    const s = prepared(), p = projectAstrologer(s);
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p).toMatchObject({ formulaKnown: false, formula: [] });
    expect(p.risk).toContain('意志难度18'); expect(p.risk).toContain('本作G平衡设定');
    expect(p.supplies).toContain('完整配方尚未核定');
    expect(p.story).toContain('第四部第31章'); expect(p.story).toContain('本作玩法改编G');
    expect(p.story).toContain('第54章'); expect(p.story).toContain('第63章');
    expect(p.story).toContain('占星并非全知'); expect(p.story).toContain('危险直觉');
    expect(p.story).toContain('不提前开放序列6记录或复制法术');
    expect(p.story).toContain('不开放旅行与远距离传送');
    expect(ASTROLOGER_ABILITIES.map(ability => ability.id)).toEqual([...ASTROLOGER_ABILITY_IDS]);
    expect(ASTROLOGER_ABILITIES).toHaveLength(2);
    expect(ASTROLOGER_ABILITIES[0]!.description).toContain('自己的灵性');
    expect(ASTROLOGER_ABILITIES[0]!.description).toContain('水晶球辅助');
    expect(ASTROLOGER_ABILITIES[1]!.description).toContain('知情同意');
    expect(ASTROLOGER_ABILITIES[1]!.description).toContain('梅芙·柯林');
    expect(ASTROLOGER_ABILITIES[1]!.description).toContain('仍可能成功');
    expect(ASTROLOGER_FORMULA_STATUS).toContain('第三部第198章');
    expect(ASTROLOGER_FORMULA_STATUS).toContain('陨星水晶60g为求购量');
    expect(ASTROLOGER_FORMULA_STATUS).toContain('拉瓦章鱼血液结晶一份为交易表述且未给重量');
    expect(ASTROLOGER_FORMULA_STATUS).toContain('辅材与完整配方未核');
    expect(ASTROLOGER_FORMULA_STATUS).toContain('不开放片段配方的材料采购或调配');
    consume(s);
    expect(Object.keys(s.progression.mastery)).toHaveLength(4);
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/door\.s[0-6]\.|recording|teleport/);
  });
});
