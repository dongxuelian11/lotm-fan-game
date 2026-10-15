import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySleeplessCommand } from '../../src/domain/sleepless/index.js';
import { SLEEPLESS_ABILITY_IDS, SLEEPLESS_WATCH_IDS } from '../../src/domain/sleepless/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyMidnightCommand, createMidnightState, isMidnightAcquisitionCommand, projectMidnight, validateMidnightCommand, validateMidnightState } from '../../src/domain/midnight/index.js';
import { MIDNIGHT_ABILITIES, MIDNIGHT_BOTTLE_IDS, MIDNIGHT_FORMULA_STATUS, MIDNIGHT_LABOUR_TASKS } from '../../src/domain/midnight/content.js';
import { MIDNIGHT_ABILITY_IDS, MIDNIGHT_CASE_IDS, type MidnightAcquisitionCommand } from '../../src/domain/midnight/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('midnight-acquisition', sliceDefaultCreationSelection, 'midnight-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.midnight = createMidnightState();
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
function sleepless(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applySleeplessCommand(s, { type: 'DISCOVER' }, c);
  applySleeplessCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySleeplessCommand(s, { type: 'BUY_POTION', bottleId: s.sleepless.bottles[0]!.id }, c);
  applySleeplessCommand(s, { type: 'CONSUME', bottleId: s.sleepless.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  for (const id of SLEEPLESS_WATCH_IDS) {
    s.sleepless.watches[id] = { status: 'RESOLVED', method: 'REPORT', attemptWeek: 9 };
    s.seer.completedSources.push(`sleepless-watch:${id}`);
  }
  s.sleepless.reflected = true;
  s.seer.completedSources.push('sleepless-reflection');
  s.progression.mastery = Object.fromEntries(SLEEPLESS_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: MidnightAcquisitionCommand, roll = 20) { applyMidnightCommand(s, command, context(s, roll).c); }
function taught(s = sleepless()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.midnight.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true });
  return s;
}
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) {
    const bottle = buy(s, index);
    apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
  }
  return s;
}
function rejected(s: SliceState, command: MidnightAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('separate, sourced sequence-eight finished bottles', () => {
  it('starts with three independent originals but exposes no supply or actions to ordinary people', () => {
    const s = ordinary(), p = projectMidnight(s);
    expect(validateMidnightState(s)).toBe(true);
    expect(s.midnight.bottles.map(bottle => bottle.id)).toEqual([...MIDNIGHT_BOTTLE_IDS]);
    expect(s.midnight.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/midnight-potion|1050|1210|序列8独立成品/);
    expect(s.midnight).not.toHaveProperty('batches');
    expect(Object.keys(s.midnight.cases)).toEqual([...MIDNIGHT_CASE_IDS]);
    expect(Object.values(s.midnight.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, method: null })));
    expect(s.midnight.encounter).toEqual({ status: 'AVAILABLE', observed: false, bystanderCleared: false, attemptWeek: null, startHistoryIndex: null });
    expect(s.midnight.reflected).toBe(false);
    const other = createMidnightState();
    other.bottles[0]!.labourSteps = 3;
    other.cases['sleepless-patient']!.status = 'OBSERVED';
    other.encounter.observed = true;
    expect(s.midnight.bottles[0]!.labourSteps).toBe(0);
    expect(s.midnight.cases['sleepless-patient']!.status).toBe('AVAILABLE');
    expect(s.midnight.encounter.observed).toBe(false);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor without a second discovery, and charges exactly 180 pence and one action', () => {
    const s = sleepless(), oldSleepless = JSON.stringify(s.sleepless), oldProgression = JSON.stringify(s.progression), oldClown = JSON.stringify(s.clown);
    const p = projectMidnight(s);
    expect(p.actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(p.bottles).toHaveLength(3);
    expect(p.bottles.every(bottle => bottle.source.includes('新') && bottle.source.includes('序列8') && bottle.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: MIDNIGHT_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: MIDNIGHT_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyMidnightCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.midnight.guidanceKnown]).toEqual([9820, 39, true]);
    expect(JSON.stringify(s.sleepless)).toBe(oldSleepless);
    expect(JSON.stringify(s.progression)).toBe(oldProgression);
    expect(JSON.stringify(s.clown)).toBe(oldClown);
    expect(projectMidnight(s).formulaKnown).toBe(false);
    expect(projectMidnight(s).formula).toEqual([]);
    expect(projectMidnight(s).supplies).toContain(MIDNIGHT_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的不眠者存药');
    expect(validateMidnightState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 1210 without an action to transfer only the chosen original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.midnight.bottles.slice(1)), oldSleepless = JSON.stringify(s.sleepless);
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.midnight.bottles.slice(1))).toBe(others);
    expect(JSON.stringify(s.sleepless)).toBe(oldSleepless);
    expect(s.midnight.bottles).toHaveLength(3);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateMidnightState(s)).toBe(true);
  });

  it('requires three actual duty-room jobs for a per-bottle credit and a remaining 160 cash payment', () => {
    const s = taught(), bottle = s.midnight.bottles[0]!, ctx = context(s), oldSleepless = JSON.stringify(s.sleepless);
    for (let index = 0; index < 3; index += 1) {
      applyMidnightCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectMidnight(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(MIDNIGHT_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectMidnight(s).actions.find(action => action.id === `buy-${MIDNIGHT_BOTTLE_IDS[1]}`)!.cost).toContain('1210便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9660, 36, 'PLAYER']);
    expect(JSON.stringify(s.sleepless)).toBe(oldSleepless);
    expect(validateMidnightState(s)).toBe(true);
  });

  it.each([1, 2])('does not cash out or partially discount %i duty-room jobs', count => {
    const s = taught(), bottleId = MIDNIGHT_BOTTLE_IDS[0];
    for (let index = 0; index < count; index += 1) apply(s, { type: 'POTION_WORK', bottleId });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(1210);
    rejected(s, { type: 'POTION_WORK', bottleId });
  });

  it('rejects insufficient money and foreign originals before mutating', () => {
    const s = sleepless();
    s.cash = 179;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    taught(s);
    for (const bottleId of ['midnight-potion-4', 'sleepless-potion-1', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 1209;
    rejected(s, { type: 'BUY_POTION', bottleId: MIDNIGHT_BOTTLE_IDS[0] });
    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: MIDNIGHT_BOTTLE_IDS[0] });
    s.cash = 159;
    rejected(s, { type: 'BUY_POTION', bottleId: MIDNIGHT_BOTTLE_IDS[0] });
    s.cash = 160;
    buy(s);
    expect(s.cash).toBe(0);
  });
});

describe('sleepless digestion, maturity and separate confirmation', () => {
  it('allows early preparation but requires both digestion100 and four whole weeks since the original sleepless promotion', () => {
    const s = sleepless();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = buy(s), command = { type: 'CONSUME', bottleId: bottle.id, confirmed: true } as const;
    expect(validateMidnightState(s)).toBe(true);
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [5, 6, 7, 8]) {
      s.week = week;
      expect(projectMidnight(s).actions.find(action => action.id === `consume-${bottle.id}`)!.reason).toContain(`${week - 5}/4`);
      rejected(s, command);
    }
    s.week = 9;
    s.progression.acting = 99;
    rejected(s, command);
    s.progression.acting = 100;
    rejected(s, { ...command, confirmed: false } as unknown as MidnightAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[1], confirmed: true });
    apply(s, command);
    expect(s.midnight.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 9, status: 'CONSUMED' });
    expect([s.progression.promotionWeek, s.midnight.promotionWeek, s.midnight.sleeplessActingAtPromotion]).toEqual([5, 9, 100]);
    expect(validateMidnightState(s)).toBe(true);
  });

  it('keeps unconsumed purchased bottles but blocks all additional preparation after success', () => {
    const s = taught();
    buy(s, 0); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true });
    expect(s.midnight.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' },
      { type: 'POTION_WORK', bottleId: MIDNIGHT_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: MIDNIGHT_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ] satisfies MidnightAcquisitionCommand[]) rejected(s, command);
    expect(projectMidnight(s).actions.filter(action => action.command.type === 'CONSUME').every(action => !action.enabled)).toBe(true);
    expect(validateMidnightState(s)).toBe(true);
  });

  it.each([
    ['other pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['missing old mentor', (s: SliceState) => { s.sleepless.discovered = false; }],
    ['missing old guidance', (s: SliceState) => { s.sleepless.guidanceKnown = false; }],
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('blocks consumption when %s without charging', (_label, mutate) => {
    const s = prepared();
    mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-action payment and confirmation but not labour or instruction', () => {
    const s = sleepless();
    s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1;
    taught(s);
    expect(s.actionsRemaining).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId: MIDNIGHT_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.progression.sequence).toBe(8);
  });
});

describe('midnight four-tier guidance and preserved sleepless progression', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} from one will difficulty12 check with no instant-death draw`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldSleepless = JSON.stringify(s.sleepless), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectMidnight(s).bottles[0]!.chance;
    applyMidnightCommand(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.midnight.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['darkness', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.midnight.promotionWeek, s.midnight.sleeplessActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.sleepless)).toBe(oldSleepless);
    for (const id of SLEEPLESS_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 2], ['perception', 2], ['will', 3], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...SLEEPLESS_ABILITY_IDS, ...MIDNIGHT_ABILITY_IDS] : [...SLEEPLESS_ABILITY_IDS]);
    if (success) {
      expect(MIDNIGHT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectMidnight(s).abilities).toEqual(MIDNIGHT_ABILITIES.map(ability => ({ ...ability, mastery: 0 })));
    } else expect(projectMidnight(s).abilities).toEqual([]);
    expect(validateMidnightState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps enhanced attributes and never grants dream entry or replaces inherited abilities', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/dream|s7|s3/);
  });

  it('caps rejection at100, preserves severe failures and requires recovery before another attempt', () => {
    const s = taught();
    buy(s); buy(s, 1);
    s.health = 10;
    s.mind = 20;
    s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[1], confirmed: true });
    expect(s.progression.sequence).toBe(9);
    expect(s.progression.acting).toBe(100);
    expect(validateMidnightState(s)).toBe(true);
  });
});

describe('finite midnight resupply after failed originals', () => {
  it('requires exhaustion, a paid action and an actual next week before receiving another independent batch', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.midnight.bottles), oldSleepless = JSON.stringify(s.sleepless), priorDate = { ...s.date };
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(s.midnight.bottles).toHaveLength(3);
    expect(projectMidnight(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'MIDNIGHT', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.midnight.resupply.requestedWeek]).toEqual([11, 1, cash, 11]);
    expect(JSON.stringify(s.midnight.bottles)).toBe(originals);
    expect(projectMidnight(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateMidnightState(s)).toBe(true);

    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(12);
    expect(s.date).not.toEqual(priorDate);
    expect(s.midnight.bottles).toHaveLength(3);
    const receiptCash = s.cash, receiptActions = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'MIDNIGHT', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash, receiptActions]);
    expect(s.midnight.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.midnight.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.sleepless)).toBe(oldSleepless);
    expect(s.midnight.bottles.slice(3).map(bottle => bottle.id)).toEqual(['midnight-potion-4', 'midnight-potion-5', 'midnight-potion-6']);
    expect(s.midnight.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第12周实收入库'))).toBe(true);
    expect(s.chronicle.some(record => record.title === '申请下一批午夜诗人魔药')).toBe(true);
    expect(s.chronicle.some(record => record.title === '下一批午夜诗人原瓶到货')).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'midnight-potion-4', confirmed: true });
    expect(validateMidnightState(s)).toBe(true);

    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: 'midnight-potion-4' });
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash - 160, receiptActions - 3]);
    apply(s, { type: 'CONSUME', bottleId: 'midnight-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.midnight.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.midnight.bottles.slice(0, 3))).toBe(originals);
    expect(validateMidnightState(clone(s))).toBe(true);
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('never replenishes automatically and rejects requests with any unused bottle or a prior success', () => {
    for (const s of [ordinary(), sleepless(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' });
      rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted();
    s.week += 20;
    expect(projectMidnight(s).supplies).toContain('供应方剩余0瓶');
    expect(s.midnight.bottles).toHaveLength(3);
    s.actionsRemaining = 0;
    rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s.midnight.bottles).toHaveLength(3);
  });

  it('fresh stock carries full price and cannot reuse labour from earlier originals', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, actions]);
    expect(projectMidnight(s).bottles[3]!.source).toContain('midnight-potion-4');
    expect(validateMidnightState(s)).toBe(true);
  });
});

describe('midnight acquisition save invariants', () => {
  it('rejects tampered bottle identity, chronology, source, labour and promotion while preserving valid states', () => {
    const s = promoted();
    expect(validateMidnightState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.midnight.bottles[0]!.id = 'sleepless-potion-1'; },
      x => { x.midnight.bottles[0]!.source = 'invented'; },
      x => { x.midnight.bottles[0]!.labourSteps = 4; },
      x => { x.midnight.bottles[0]!.acquiredWeek = 4; },
      x => { x.midnight.bottles[0]!.consumedWeek = 10; },
      x => { x.midnight.bottles[0]!.consumedWeek = 12; },
      x => { x.midnight.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.midnight.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.midnight.bottles[1]!.acquiredWeek = 11; },
      x => { x.midnight.promotionWeek = 10; },
      x => { x.midnight.sleeplessActingAtPromotion = 99; },
      x => { x.progression.promotionWeek = 11; },
      x => { x.midnight.guidanceKnown = false; },
      x => { delete x.progression.mastery[SLEEPLESS_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[MIDNIGHT_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[MIDNIGHT_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['darkness.s7.dream-entry'] = 0; },
      x => { x.midnight.bottles.push({ ...x.midnight.bottles[0]! }); },
      x => { delete x.midnight.cases['sleepless-patient']; },
      x => { (x.midnight as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateMidnightState(corrupted)).toBe(false); }
  });

  it('rejects forged deliveries, same-week receipts, mixed batch dates and restored exhausted bottles', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.midnight.resupply.deliveries = 0; },
      x => { x.midnight.resupply.deliveries = 2; },
      x => { x.midnight.bottles[3]!.id = 'midnight-potion-7'; },
      x => { x.midnight.bottles[3]!.source = x.midnight.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.midnight.bottles[4]!.source = x.midnight.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.midnight.bottles[0]!.status = 'PLAYER'; x.midnight.bottles[0]!.outcome = null; x.midnight.bottles[0]!.consumedWeek = null; },
      x => { x.midnight.bottles[3]!.status = 'PLAYER'; x.midnight.bottles[3]!.acquiredWeek = 11; },
      x => { x.midnight.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateMidnightState(corrupted)).toBe(false); }
    const pending = exhausted();
    apply(pending, { type: 'REQUEST_SUPPLY' });
    pending.midnight.resupply.requestedWeek = 10;
    expect(validateMidnightState(pending)).toBe(false);
  });

  it('rejects malformed records without throwing and rejects premature adventure or mastery', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.midnight, bottles: [null, null, null] }, { ...s.midnight, cases: null }]) {
      const corrupted = clone(s);
      corrupted.midnight = value as unknown as SliceState['midnight'];
      expect(validateMidnightState(corrupted)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.midnight.guidanceKnown = true; },
      (x: SliceState) => { x.midnight.reflected = true; },
      (x: SliceState) => { x.midnight.cases['sleepless-patient']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.midnight.encounter.bystanderCleared = true; },
      (x: SliceState) => { x.progression.mastery[MIDNIGHT_ABILITY_IDS[0]] = 0; },
    ]) { const corrupted = clone(s); mutate(corrupted); expect(validateMidnightState(corrupted)).toBe(false); }
  });
});


describe('midnight exact intent boundary', () => {
  it('accepts only declared acquisition and activity payloads', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'midnight-potion-1' },
      { type: 'BUY_POTION', bottleId: 'midnight-potion-999' },
      { type: 'CONSUME', bottleId: 'midnight-potion-1', confirmed: true },
      ...['REFLECT', 'OBSERVE_ENCOUNTER', 'CLEAR_BYSTANDER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].map(type => ({ type })),
      ...MIDNIGHT_CASE_IDS.flatMap(caseId => ['OBSERVE', 'PREPARE', 'WITHDRAW'].map(type => ({ type, caseId }))),
      ...MIDNIGHT_CASE_IDS.flatMap(caseId => ['POEM', 'TALK'].map(method => ({ type: 'PERFORM', caseId, method }))),
    ]) {
      expect(validateMidnightCommand(command)).toBe(true);
      if (validateMidnightCommand(command)) expect(isMidnightAcquisitionCommand(command)).toBe(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'POTION_WORK', 'BUY_POTION', 'CONSUME'].includes(command.type));
    }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'sleepless-potion-1' },
    { type: 'BUY_POTION', bottleId: 'midnight-potion-0' },
    { type: 'BUY_POTION', bottleId: 'midnight-potion-01' },
    { type: 'BUY_POTION', bottleId: 'midnight-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'midnight-potion-1' },
    { type: 'CONSUME', bottleId: 'midnight-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'midnight-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: '__proto__' },
    { type: 'PERFORM', caseId: 'sleepless-patient' },
    { type: 'PERFORM', caseId: 'sleepless-patient', method: 'DREAM' },
    { type: 'PERFORM', caseId: 'sleepless-patient', method: 'POEM', forced: true },
    { type: 'WITHDRAW' }, { type: 'REFLECT', caseId: 'sleepless-patient' },
    { type: 'CLEAR_BYSTANDER', free: true }, { type: 'ENCOUNTER_FIGHT', guaranteed: true },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateMidnightCommand(command)).toBe(false);
  });

  it('cannot bypass the acquisition entry point with unknown, extra or activity commands', () => {
    const s = prepared();
    for (const command of [
      { type: 'BREW', bottleId: MIDNIGHT_BOTTLE_IDS[0] },
      { type: 'CONSUME', bottleId: MIDNIGHT_BOTTLE_IDS[0], confirmed: true, guaranteed: true },
      ...['OBSERVE', 'PREPARE', 'WITHDRAW'].map(type => ({ type, caseId: MIDNIGHT_CASE_IDS[0] })),
      { type: 'PERFORM', caseId: MIDNIGHT_CASE_IDS[0], method: 'POEM' },
      ...['REFLECT', 'OBSERVE_ENCOUNTER', 'CLEAR_BYSTANDER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'].map(type => ({ type })),
    ]) rejected(s, command as unknown as MidnightAcquisitionCommand);
  });

  it('validates case and encounter shapes while leaving promoted activity history to its own module', () => {
    const s = promoted(), original = s.midnight.cases['sleepless-patient']!;
    for (const value of [
      null, {}, { ...original, automatic: true }, { ...original, status: 'CONTROLLED' },
      { ...original, method: 'DREAM' }, { ...original, attemptWeek: 10 },
      { ...original, attemptWeek: 12 }, { ...original, attemptWeek: 11.5 },
    ]) {
      const corrupted = clone(s);
      corrupted.midnight.cases['sleepless-patient'] = value as unknown as SliceState['midnight']['cases'][string];
      expect(validateMidnightState(corrupted)).toBe(false);
    }
    for (const value of [
      null, {}, { ...s.midnight.encounter, night: true },
      { ...s.midnight.encounter, status: 'CONTROLLED' }, { ...s.midnight.encounter, observed: 'yes' },
      { ...s.midnight.encounter, bystanderCleared: 'yes' }, { ...s.midnight.encounter, attemptWeek: 10 },
      { ...s.midnight.encounter, startHistoryIndex: 1 }, { ...s.midnight.encounter, startHistoryIndex: -1 },
    ]) {
      const corrupted = clone(s);
      corrupted.midnight.encounter = value as unknown as SliceState['midnight']['encounter'];
      expect(validateMidnightState(corrupted)).toBe(false);
    }
    s.midnight.cases['sleepless-patient'] = { status: 'RESOLVED', attemptWeek: 11, method: 'TALK' };
    s.midnight.encounter = { status: 'RESOLVED', observed: true, bystanderCleared: true, attemptWeek: 11, startHistoryIndex: null };
    expect(validateMidnightState(s)).toBe(true);
  });

  it('keeps canon boundaries in the supplied descriptions without fabricating recipes', () => {
    expect(MIDNIGHT_ABILITIES.map(a => a.id)).toEqual([...MIDNIGHT_ABILITY_IDS]);
    expect(MIDNIGHT_ABILITIES[0]!.description).toMatch(/出声/);
    expect(MIDNIGHT_ABILITIES[0]!.description).toMatch(/同伴/);
    expect(MIDNIGHT_ABILITIES[0]!.description).toMatch(/抵抗/);
    expect(MIDNIGHT_ABILITIES[0]!.description).toMatch(/打断/);
    expect(MIDNIGHT_ABILITIES[1]!.description).toMatch(/攀爬/);
    expect(projectMidnight(promoted()).formula).toEqual([]);
  });
});
