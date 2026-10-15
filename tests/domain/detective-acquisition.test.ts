import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyReaderCommand } from '../../src/domain/reader/index.js';
import { READER_ABILITY_IDS } from '../../src/domain/reader/types.js';
import { applyReasonerCommand } from '../../src/domain/reasoner/index.js';
import { REASONER_ABILITY_IDS } from '../../src/domain/reasoner/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyDetectiveCommand, createDetectiveState, isDetectiveAcquisitionCommand,
  projectDetective, validateDetectiveCommand, validateDetectiveState,
} from '../../src/domain/detective/index.js';
import { DETECTIVE_ABILITIES, DETECTIVE_BOTTLE_IDS, DETECTIVE_FORMULA_STATUS, DETECTIVE_LABOUR_TASKS } from '../../src/domain/detective/content.js';
import { DETECTIVE_ABILITY_IDS, DETECTIVE_CASE_IDS, type DetectiveAcquisitionCommand } from '../../src/domain/detective/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = DETECTIVE_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('detective-acquisition', sliceDefaultCreationSelection, 'detective-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.detective = createDetectiveState();
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
function reasoner(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyReaderCommand(s, { type: 'DISCOVER' }, c);
  applyReaderCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyReaderCommand(s, { type: 'BUY_POTION', bottleId: s.reader.bottles[0]!.id }, c);
  applyReaderCommand(s, { type: 'CONSUME', bottleId: s.reader.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyReasonerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyReasonerCommand(s, { type: 'BUY_POTION', bottleId: s.reasoner.bottles[0]!.id }, c);
  applyReasonerCommand(s, { type: 'CONSUME', bottleId: s.reasoner.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: DetectiveAcquisitionCommand, roll = 20) { applyDetectiveCommand(s, command, context(s, roll).c); }
function taught(s = reasoner()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.detective.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.detective.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as DetectiveAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('detective S7 independent finished-potion acquisition', () => {
  it('creates three sourced independent bottles and untouched activity reserves', () => {
    const s = ordinary(), other = createDetectiveState();
    expect(validateDetectiveState(s)).toBe(true);
    expect(s.detective.bottles.map(bottle => bottle.id)).toEqual([...DETECTIVE_BOTTLE_IDS]);
    expect(s.detective.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.detective).toMatchObject({ reflected: false, promotionWeek: null, reasonerActingAtPromotion: null });
    expect(Object.keys(s.detective.cases)).toEqual([...DETECTIVE_CASE_IDS]);
    expect(Object.values(s.detective.cases)).toEqual(DETECTIVE_CASE_IDS.map(() => ({ status: 'AVAILABLE', attemptWeek: null, plan: null, conclusion: null, mistakes: 0 })));
    other.bottles[0]!.labourSteps = 4; other.cases[DETECTIVE_CASE_IDS[0]]!.status = 'SURVEYED';
    expect([s.detective.bottles[0]!.labourSteps, s.detective.cases[DETECTIVE_CASE_IDS[0]]!.status]).toEqual([0, 'AVAILABLE']);
  });

  it('hides the future channel and rejects route skipping', () => {
    const s = ordinary(), p = projectDetective(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/detective-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const reader = reasoner(); reader.progression.sequence = 9;
    rejected(reader, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without a full recipe or lower-state changes', () => {
    const s = reasoner(), old = [JSON.stringify(s.reader), JSON.stringify(s.reasoner), JSON.stringify(s.progression)];
    expect(projectDetective(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.detective.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectDetective(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectDetective(s).supplies).toContain(DETECTIVE_FORMULA_STATUS);
    expect(projectDetective(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.reader), JSON.stringify(s.reasoner), JSON.stringify(s.progression)]).toEqual(old);
    expect(validateDetectiveState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original once', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.detective.bottles.slice(1));
    expect(buy(s)).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect([s.cash, s.actionsRemaining, JSON.stringify(s.detective.bottles.slice(1))]).toEqual([7750, ap, others]);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    expect(validateDetectiveState(s)).toBe(true);
  });

  it('only four real jobs on the selected bottle waive 1800 pence, never a partial refund', () => {
    for (const count of [1, 2, 3, 4]) {
      const s = taught(), ctx = context(s);
      for (let i = 0; i < count; i += 1) applyDetectiveCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.detective.bottles[0]!.labourSteps]).toEqual([9760, 39 - count, count]);
      expect(ctx.notes.map(note => note.title)).toEqual(DETECTIVE_LABOUR_TASKS.slice(0, count).map(task => `完成${task}`));
      expect(projectDetective(s).actions.find(action => action.id === `buy-${DETECTIVE_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
      if (count === 4) rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      buy(s);
      expect(s.cash).toBe(count === 4 ? 9550 : 7750);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash, foreign originals and forged confirmations without mutation', () => {
    const s = reasoner(); s.cash = 239; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['reader-potion-1', 'reasoner-potion-1', 'detective-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'CONSUME', bottleId: DETECTIVE_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('permits early preparation but requires S8 acting 100 and eight whole weeks since S8', () => {
    const s = reasoner(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command); s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectDetective(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.reasoner.promotionWeek, s.detective.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.detective.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validateDetectiveState(s)).toBe(true);
  });

  it('resolves all four will-18 tiers with real original consumption and recoverable guided costs', () => {
    for (const [roll, tier, sequence, mind, health, pollution] of [
      [1, 'GREAT_SUCCESS', 7, 95, 100, 0], [20, 'SUCCESS', 7, 90, 100, 0],
      [80, 'FAILURE', 8, 80, 90, 25], [99, 'GREAT_FAILURE', 8, 60, 80, 50],
    ] as const) {
      const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
      applyDetectiveCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]);
      expect(ctx.draws).toEqual([]);
      expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
      expect(s.detective.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect(validateDetectiveState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('inherits all six old masteries, resets only S7 acting, and raises the cap without a refill', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const old = [JSON.stringify(s.reader), JSON.stringify(s.reasoner), JSON.stringify(s.caseArchive)];
    s.spirituality = 9; consume(s);
    expect([s.detective.reasonerActingAtPromotion, s.progression.acting, s.spirituality]).toEqual([100, 0, 9]);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(DETECTIVE_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique + 2, perception: stats.perception + 3, will: stats.will + 2, knowledge: stats.knowledge + 3 });
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.reader), JSON.stringify(s.reasoner), JSON.stringify(s.caseArchive)]).toEqual(old);
    expect(projectDetective(s).abilities.map(ability => ability.id)).toEqual([...DETECTIVE_ABILITY_IDS]);
    const capped = prepared(); capped.character.coreStats = { physique: 500, perception: 499, will: 500, knowledge: 499 }; consume(capped, 1);
    expect(capped.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
  });

  it('blocks unavailable bodies, routes, locations, runs and ongoing events or combat', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.reader.discovered = false; },
      s => { s.reader.guidanceKnown = false; }, s => { s.reasoner.guidanceKnown = false; }, s => { s.reasoner.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.combat = {} as NonNullable<SliceState['combat']>; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }); }
  });

  it('requires AP for guidance and labour but allows purchase and consumption at zero AP', () => {
    const s = reasoner(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s); expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it('retains a failed original and old progression, then preserves spare originals after successful recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.detective.promotionWeek, s.detective.reasonerActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100; buy(s, 1); buy(s, 2); consume(s, 20, 1);
    expect(s.detective.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'GREAT_FAILURE'], ['CONSUMED', 'SUCCESS'], ['PLAYER', null]]);
    expect(s.seer.pollution).toBe(50);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: DETECTIVE_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: DETECTIVE_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: DETECTIVE_BOTTLE_IDS[2], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectDetective(s).actions.every(action => !action.enabled)).toBe(true);
    expect(validateDetectiveState(s)).toBe(true);
  });

  it('only restocks after all three failures and a real later week, keeping old bottles and all prices', () => {
    const s = taught(); rejected(s, { type: 'REQUEST_SUPPLY' });
    for (let index = 0; index < 3; index += 1) {
      buy(s, index); consume(s, 80, index);
      if (index < 2) rejected(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = JSON.stringify(s.detective.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.detective.bottles.length, s.detective.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.detective.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.detective.resupply.deliveries, s.detective.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.detective.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['detective-potion-4', 'SUPPLIER', 0], ['detective-potion-5', 'SUPPLIER', 0], ['detective-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectDetective(s).actions.find(action => action.id === 'buy-detective-potion-4')!.cost).toContain('2010便士');
    expect(validateDetectiveState(s)).toBe(true); rejected(s, { type: 'RECEIVE_SUPPLY' });
    const bad = clone(s); bad.detective.bottles[3]!.source = bad.detective.bottles[3]!.source.replace('第20周', '第19周');
    expect(validateDetectiveState(bad)).toBe(false);
  });

  it('rejects malformed stock, duplicate success, chronology and incomplete inherited abilities on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.detective.bottles[0]!.id = 'reasoner-potion-1'; }, s => { s.detective.bottles[0]!.source = 'unsourced'; },
      s => { s.detective.bottles[1]!.labourSteps = 5; }, s => { s.detective.promotionWeek = 18; },
      s => { s.detective.reasonerActingAtPromotion = 99; }, s => { delete s.progression.mastery[READER_ABILITY_IDS[0]]; },
      s => { delete s.progression.mastery[REASONER_ABILITY_IDS[0]]; },
      s => { s.detective.cases[DETECTIVE_CASE_IDS[0]]!.attemptWeek = 18; },
      s => { delete s.detective.cases[DETECTIVE_CASE_IDS[0]]; },
      s => { delete s.progression.mastery[DETECTIVE_ABILITY_IDS[0]]; },
      s => { s.progression.mastery[DETECTIVE_ABILITY_IDS[0]] = 501; },
      s => { s.progression.mastery['reader.s6.imitation'] = 0; },
      s => { s.detective.bottles[1] = { ...s.detective.bottles[0]!, id: DETECTIVE_BOTTLE_IDS[1], source: s.detective.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateDetectiveState(bad)).toBe(false); }
    const bad = clone(s); (bad.detective.bottles as unknown[])[0] = null; expect(validateDetectiveState(bad)).toBe(false);
    const beforePromotion = reasoner(); beforePromotion.detective.cases[DETECTIVE_CASE_IDS[0]]!.status = 'SURVEYED';
    expect(validateDetectiveState(beforePromotion)).toBe(false);
  });


  it('caps rejection and requires recovery without erasing failure records', () => {
    const s = prepared(); buy(s, 1);
    s.health = 10; s.mind = 20; s.seer.pollution = 90;
    consume(s, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    rejected(s, { type: 'CONSUME', bottleId: DETECTIVE_BOTTLE_IDS[1], confirmed: true });
    expect(validateDetectiveState(s)).toBe(true);
  });

  it('never replenishes automatically, reuses labour or gives credit for old originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    s.week += 10;
    expect(s.detective.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 4; apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining, s.detective.bottles[3]!.labourSteps]).toEqual([cash - 2010, actions, 0]);
    const old = JSON.stringify(s.detective.bottles.slice(0, 3));
    consume(s, 1, 3);
    expect(JSON.stringify(s.detective.bottles.slice(0, 3))).toBe(old);
    expect(s.detective.promotionWeek).toBe(30);
    expect(validateDetectiveState(s)).toBe(true);
  });

  it('rejects mismatched delivery counts, mixed dates and restoration of exhausted originals', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
    apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    for (const mutate of [
      (x: SliceState) => { x.detective.resupply.deliveries = 0; },
      (x: SliceState) => { x.detective.resupply.deliveries = 2; },
      (x: SliceState) => { x.detective.bottles[3]!.id = 'detective-potion-7'; },
      (x: SliceState) => { x.detective.bottles[0]!.status = 'PLAYER'; x.detective.bottles[0]!.consumedWeek = null; x.detective.bottles[0]!.outcome = null; },
      (x: SliceState) => { x.week = 21; x.detective.bottles[4]!.source = x.detective.bottles[4]!.source.replace('第20周', '第21周'); },
      (x: SliceState) => { x.detective.resupply.requestedWeek = 19; },
    ]) { const bad = clone(s); mutate(bad); expect(validateDetectiveState(bad)).toBe(false); }
    for (const value of [null, [], {}, { ...s.detective, extra: true }]) {
      const bad = clone(s); bad.detective = value as SliceState['detective'];
      expect(validateDetectiveState(bad)).toBe(false);
    }
  });

});

describe('detective exact command and canon boundaries', () => {
  it('accepts declared acquisition and activity payloads without sharing their entry points', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, { type: 'BUY_POTION', bottleId: 'detective-potion-999' },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' },
      ...DETECTIVE_CASE_IDS.flatMap(caseId => [
        { type: 'SURVEY', caseId },
        { type: 'RECONSTRUCT', caseId, plan: 'compare-traces' },
        { type: 'REPORT', caseId, conclusion: 'limited-account' },
      ]),
    ];
    for (const command of acquisition) { expect(validateDetectiveCommand(command)).toBe(true); expect(isDetectiveAcquisitionCommand(command)).toBe(true); }
    const s = prepared();
    for (const command of activities) { expect(validateDetectiveCommand(command)).toBe(true); expect(isDetectiveAcquisitionCommand(command)).toBe(false); rejected(s, command); }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' }, { type: 'COPY_ABILITY' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'reasoner-potion-1' },
    { type: 'BUY_POTION', bottleId: 'detective-potion-0' }, { type: 'BUY_POTION', bottleId: 'detective-potion-01' },
    { type: 'BUY_POTION', bottleId: 'detective-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
    { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, guaranteed: true },
    { type: 'SURVEY', caseId: 'invented' }, { type: 'SURVEY', caseId: '__proto__' },
    { type: 'RECONSTRUCT' }, { type: 'RECONSTRUCT', caseId: DETECTIVE_CASE_IDS[0] },
    { type: 'RECONSTRUCT', caseId: DETECTIVE_CASE_IDS[0], plan: '' },
    { type: 'RECONSTRUCT', caseId: DETECTIVE_CASE_IDS[0], plan: 'x'.repeat(81) },
    { type: 'RECONSTRUCT', caseId: DETECTIVE_CASE_IDS[0], plan: 'invent facts' },
    { type: 'REPORT', caseId: DETECTIVE_CASE_IDS[0], conclusion: '__proto__' },
    { type: 'REPORT', caseId: DETECTIVE_CASE_IDS[0], conclusion: 'limited', truth: true },
    { type: 'REPORT', caseId: DETECTIVE_CASE_IDS[0], conclusion: 1 },
    { type: 'REFLECT', caseId: DETECTIVE_CASE_IDS[0] },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateDetectiveCommand(command)).toBe(false);
    expect(isDetectiveAcquisitionCommand(command)).toBe(false);
    rejected(prepared(), command);
  });

  it('reserves exact case fields while leaving per-case choices and evidence semantics to life', () => {
    const s = prepared(); consume(s);
    const original = s.detective.cases[DETECTIVE_CASE_IDS[0]]!;
    for (const value of [
      null, {}, { ...original, extra: true }, { ...original, status: 'OMNISCIENT' },
      { ...original, plan: 12 }, { ...original, plan: '' }, { ...original, conclusion: '' },
      { ...original, mistakes: -1 }, { ...original, mistakes: 0.5 },
      { ...original, attemptWeek: 18 }, { ...original, attemptWeek: 20 }, { ...original, attemptWeek: 19.5 },
    ]) {
      const bad = clone(s); bad.detective.cases[DETECTIVE_CASE_IDS[0]] = value as SliceState['detective']['cases'][string];
      expect(validateDetectiveState(bad)).toBe(false);
    }
    s.detective.cases[DETECTIVE_CASE_IDS[0]] = { status: 'RECONSTRUCTED', attemptWeek: 19, plan: 'compare-traces', conclusion: null, mistakes: 1 };
    expect(validateDetectiveState(s)).toBe(true);
    const lower = reasoner(); lower.detective.cases[DETECTIVE_CASE_IDS[0]]!.mistakes = 1;
    expect(validateDetectiveState(lower)).toBe(false);
  });

  it('keeps reconstruction finite, weapon use physical and external S6 effects out of S7', () => {
    const s = prepared(), p = projectDetective(s);
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p).toMatchObject({ formulaKnown: false, formula: [] });
    expect(p.risk).toContain('本作G游戏平衡'); expect(p.risk).toContain('意志难度18');
    expect(p.risk).toContain('人类服药成为守知者后仍须扮演'); expect(p.risk).toContain('不会自动加入教会');
    expect(p.supplies).toContain('完整配方资料待核');
    expect(p.story).toContain('第二部第202、206章'); expect(p.story).toContain('第三部第46章');
    expect(DETECTIVE_ABILITIES.map(ability => ability.id)).toEqual([...DETECTIVE_ABILITY_IDS]);
    expect(DETECTIVE_ABILITIES[0]!.description).toContain('有限');
    expect(DETECTIVE_ABILITIES[0]!.description).toContain('缺口');
    expect(DETECTIVE_ABILITIES[0]!.description).toContain('重构可能出错');
    expect(DETECTIVE_ABILITIES[1]!.description).toContain('实际持有并装备');
    expect(DETECTIVE_ABILITIES[1]!.description).toContain('封印物2-081');
    expect(DETECTIVE_ABILITIES[1]!.description).toContain('序列6外部效果');
    expect(DETECTIVE_ABILITIES[2]!.description).toContain('不能瞬移');
    expect(DETECTIVE_ABILITIES[2]!.description).toContain('受伤仍会发生');
  });
});
