import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyReaderCommand } from '../../src/domain/reader/index.js';
import { READER_ABILITY_IDS, READER_CASE_IDS } from '../../src/domain/reader/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyReasonerCommand, createReasonerState, isReasonerAcquisitionCommand, projectReasoner, validateReasonerCommand, validateReasonerState } from '../../src/domain/reasoner/index.js';
import { REASONER_ABILITIES, REASONER_BOTTLE_IDS, REASONER_FORMULA_STATUS, REASONER_LABOUR_TASKS } from '../../src/domain/reasoner/content.js';
import { REASONER_ABILITY_IDS, REASONER_CASE_IDS, type ReasonerAcquisitionCommand } from '../../src/domain/reasoner/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('reasoner-acquisition', sliceDefaultCreationSelection, 'reasoner-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.reasoner = createReasonerState();
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
function reader(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyReaderCommand(s, { type: 'DISCOVER' }, c);
  applyReaderCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyReaderCommand(s, { type: 'BUY_POTION', bottleId: s.reader.bottles[0]!.id }, c);
  applyReaderCommand(s, { type: 'CONSUME', bottleId: s.reader.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  for (const id of READER_CASE_IDS) {
    s.reader.cases[id] = { status: 'RESOLVED', conclusion: 'LIMITED', mistakes: 0, attemptWeek: 9 };
    s.seer.completedSources.push(`reader-case:${id}`);
  }
  s.reader.reflected = true;
  s.seer.completedSources.push('reader-reflection');
  s.progression.mastery = Object.fromEntries(READER_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: ReasonerAcquisitionCommand, roll = 20) { applyReasonerCommand(s, command, context(s, roll).c); }
function taught(s = reader()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.reasoner.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true });
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
function rejected(s: SliceState, command: ReasonerAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('separate, sourced sequence-eight finished bottles', () => {
  it('starts with three independent originals but exposes no supply or actions to ordinary people', () => {
    const s = ordinary(), p = projectReasoner(s);
    expect(validateReasonerState(s)).toBe(true);
    expect(s.reasoner.bottles.map(bottle => bottle.id)).toEqual([...REASONER_BOTTLE_IDS]);
    expect(s.reasoner.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/reasoner-potion|1050|1210|序列8独立成品/);
    expect(s.reasoner).not.toHaveProperty('batches');
    expect(Object.keys(s.reasoner.cases)).toEqual([...REASONER_CASE_IDS]);
    expect(Object.values(s.reasoner.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, testId: null, conclusion: null, mistakes: 0 })));
    expect(s.reasoner.reflected).toBe(false);
    const other = createReasonerState();
    other.bottles[0]!.labourSteps = 3;
    other.cases['stair-footprints']!.status = 'EXAMINED';
    expect(s.reasoner.bottles[0]!.labourSteps).toBe(0);
    expect(s.reasoner.cases['stair-footprints']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor without a second discovery, and charges exactly 180 pence and one action', () => {
    const s = reader(), oldReader = JSON.stringify(s.reader), oldProgression = JSON.stringify(s.progression), oldClown = JSON.stringify(s.clown);
    const p = projectReasoner(s);
    expect(p.actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(p.bottles).toHaveLength(3);
    expect(p.bottles.every(bottle => bottle.source.includes('新') && bottle.source.includes('序列8') && bottle.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: REASONER_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: REASONER_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyReasonerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.reasoner.guidanceKnown]).toEqual([9820, 39, true]);
    expect(JSON.stringify(s.reader)).toBe(oldReader);
    expect(JSON.stringify(s.progression)).toBe(oldProgression);
    expect(JSON.stringify(s.clown)).toBe(oldClown);
    expect(projectReasoner(s).formulaKnown).toBe(false);
    expect(projectReasoner(s).formula).toEqual([]);
    expect(projectReasoner(s).supplies).toContain(REASONER_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的阅读者存药');
    expect(validateReasonerState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 1210 without an action to transfer only the chosen original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.reasoner.bottles.slice(1)), oldReader = JSON.stringify(s.reader);
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.reasoner.bottles.slice(1))).toBe(others);
    expect(JSON.stringify(s.reader)).toBe(oldReader);
    expect(s.reasoner.bottles).toHaveLength(3);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateReasonerState(s)).toBe(true);
  });

  it('requires three actual library jobs for a per-bottle credit and a remaining 160 cash payment', () => {
    const s = taught(), bottle = s.reasoner.bottles[0]!, ctx = context(s), oldReader = JSON.stringify(s.reader);
    for (let index = 0; index < 3; index += 1) {
      applyReasonerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectReasoner(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(REASONER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectReasoner(s).actions.find(action => action.id === `buy-${REASONER_BOTTLE_IDS[1]}`)!.cost).toContain('1210便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9660, 36, 'PLAYER']);
    expect(JSON.stringify(s.reader)).toBe(oldReader);
    expect(validateReasonerState(s)).toBe(true);
  });

  it.each([1, 2])('does not cash out or partially discount %i library jobs', count => {
    const s = taught(), bottleId = REASONER_BOTTLE_IDS[0];
    for (let index = 0; index < count; index += 1) apply(s, { type: 'POTION_WORK', bottleId });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(1210);
    rejected(s, { type: 'POTION_WORK', bottleId });
  });

  it('rejects insufficient money and foreign originals before mutating', () => {
    const s = reader();
    s.cash = 179;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    taught(s);
    for (const bottleId of ['reasoner-potion-4', 'reader-potion-1', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 1209;
    rejected(s, { type: 'BUY_POTION', bottleId: REASONER_BOTTLE_IDS[0] });
    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: REASONER_BOTTLE_IDS[0] });
    s.cash = 159;
    rejected(s, { type: 'BUY_POTION', bottleId: REASONER_BOTTLE_IDS[0] });
    s.cash = 160;
    buy(s);
    expect(s.cash).toBe(0);
  });
});

describe('reader digestion, maturity and separate confirmation', () => {
  it('allows early preparation but requires both digestion100 and four whole weeks since the original reader promotion', () => {
    const s = reader();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = buy(s), command = { type: 'CONSUME', bottleId: bottle.id, confirmed: true } as const;
    expect(validateReasonerState(s)).toBe(true);
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [5, 6, 7, 8]) {
      s.week = week;
      expect(projectReasoner(s).actions.find(action => action.id === `consume-${bottle.id}`)!.reason).toContain(`${week - 5}/4`);
      rejected(s, command);
    }
    s.week = 9;
    s.progression.acting = 99;
    rejected(s, command);
    s.progression.acting = 100;
    rejected(s, { ...command, confirmed: false } as unknown as ReasonerAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[1], confirmed: true });
    apply(s, command);
    expect(s.reasoner.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 9, status: 'CONSUMED' });
    expect([s.progression.promotionWeek, s.reasoner.promotionWeek, s.reasoner.readerActingAtPromotion]).toEqual([5, 9, 100]);
    expect(validateReasonerState(s)).toBe(true);
  });

  it('keeps unconsumed purchased bottles but blocks all additional preparation after success', () => {
    const s = taught();
    buy(s, 0); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true });
    expect(s.reasoner.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' },
      { type: 'POTION_WORK', bottleId: REASONER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: REASONER_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ] satisfies ReasonerAcquisitionCommand[]) rejected(s, command);
    expect(projectReasoner(s).actions.filter(action => action.command.type === 'CONSUME').every(action => !action.enabled)).toBe(true);
    expect(validateReasonerState(s)).toBe(true);
  });

  it.each([
    ['other pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['missing old mentor', (s: SliceState) => { s.reader.discovered = false; }],
    ['missing old guidance', (s: SliceState) => { s.reader.guidanceKnown = false; }],
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('blocks consumption when %s without charging', (_label, mutate) => {
    const s = prepared();
    mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-action payment and confirmation but not labour or instruction', () => {
    const s = reader();
    s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1;
    taught(s);
    expect(s.actionsRemaining).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId: REASONER_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.progression.sequence).toBe(8);
  });
});

describe('reasoner four-tier guidance and preserved reader progression', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} from one will difficulty12 check with no instant-death draw`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldReader = JSON.stringify(s.reader), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectReasoner(s).bottles[0]!.chance;
    applyReasonerCommand(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.reasoner.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['white-tower', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.reasoner.promotionWeek, s.reasoner.readerActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.reader)).toBe(oldReader);
    for (const id of READER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 1], ['perception', 3], ['will', 2], ['knowledge', 3]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...READER_ABILITY_IDS, ...REASONER_ABILITY_IDS] : [...READER_ABILITY_IDS]);
    if (success) {
      expect(REASONER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectReasoner(s).abilities).toEqual(REASONER_ABILITIES.map(ability => ({ ...ability, mastery: 0 })));
    } else expect(projectReasoner(s).abilities).toEqual([]);
    expect(validateReasonerState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps enhanced attributes and never grants imitation or unseen evidence or replaces inherited abilities', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/imitation|s7|s6/);
  });

  it('caps rejection at100, preserves severe failures and requires recovery before another attempt', () => {
    const s = taught();
    buy(s); buy(s, 1);
    s.health = 10;
    s.mind = 20;
    s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[1], confirmed: true });
    expect(s.progression.sequence).toBe(9);
    expect(s.progression.acting).toBe(100);
    expect(validateReasonerState(s)).toBe(true);
  });
});

describe('finite reasoner resupply after failed originals', () => {
  it('requires exhaustion, a paid action and an actual next week before receiving another independent batch', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.reasoner.bottles), oldReader = JSON.stringify(s.reader), priorDate = { ...s.date };
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(s.reasoner.bottles).toHaveLength(3);
    expect(projectReasoner(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'REASONER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.reasoner.resupply.requestedWeek]).toEqual([11, 1, cash, 11]);
    expect(JSON.stringify(s.reasoner.bottles)).toBe(originals);
    expect(projectReasoner(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateReasonerState(s)).toBe(true);

    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(12);
    expect(s.date).not.toEqual(priorDate);
    expect(s.reasoner.bottles).toHaveLength(3);
    const receiptCash = s.cash, receiptActions = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'REASONER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash, receiptActions]);
    expect(s.reasoner.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.reasoner.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.reader)).toBe(oldReader);
    expect(s.reasoner.bottles.slice(3).map(bottle => bottle.id)).toEqual(['reasoner-potion-4', 'reasoner-potion-5', 'reasoner-potion-6']);
    expect(s.reasoner.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第12周实收入库'))).toBe(true);
    expect(s.chronicle.some(record => record.title === '申请下一批推理学员魔药')).toBe(true);
    expect(s.chronicle.some(record => record.title === '下一批推理学员原瓶到货')).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'reasoner-potion-4', confirmed: true });
    expect(validateReasonerState(s)).toBe(true);

    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: 'reasoner-potion-4' });
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash - 160, receiptActions - 3]);
    apply(s, { type: 'CONSUME', bottleId: 'reasoner-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.reasoner.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.reasoner.bottles.slice(0, 3))).toBe(originals);
    expect(validateReasonerState(clone(s))).toBe(true);
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('never replenishes automatically and rejects requests with any unused bottle or a prior success', () => {
    for (const s of [ordinary(), reader(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' });
      rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted();
    s.week += 20;
    expect(projectReasoner(s).supplies).toContain('供应方剩余0瓶');
    expect(s.reasoner.bottles).toHaveLength(3);
    s.actionsRemaining = 0;
    rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s.reasoner.bottles).toHaveLength(3);
  });

  it('fresh stock carries full price and cannot reuse labour from earlier originals', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, actions]);
    expect(projectReasoner(s).bottles[3]!.source).toContain('reasoner-potion-4');
    expect(validateReasonerState(s)).toBe(true);
  });
});

describe('reasoner acquisition save invariants', () => {
  it('rejects tampered bottle identity, chronology, source, labour and promotion while preserving valid states', () => {
    const s = promoted();
    expect(validateReasonerState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.reasoner.bottles[0]!.id = 'reader-potion-1'; },
      x => { x.reasoner.bottles[0]!.source = 'invented'; },
      x => { x.reasoner.bottles[0]!.labourSteps = 4; },
      x => { x.reasoner.bottles[0]!.acquiredWeek = 4; },
      x => { x.reasoner.bottles[0]!.consumedWeek = 10; },
      x => { x.reasoner.bottles[0]!.consumedWeek = 12; },
      x => { x.reasoner.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.reasoner.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.reasoner.bottles[1]!.acquiredWeek = 11; },
      x => { x.reasoner.promotionWeek = 10; },
      x => { x.reasoner.readerActingAtPromotion = 99; },
      x => { x.progression.promotionWeek = 11; },
      x => { x.reasoner.guidanceKnown = false; },
      x => { delete x.progression.mastery[READER_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[REASONER_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[REASONER_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['reader.s6.imitation'] = 0; },
      x => { x.reasoner.bottles.push({ ...x.reasoner.bottles[0]! }); },
      x => { delete x.reasoner.cases['stair-footprints']; },
      x => { (x.reasoner as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateReasonerState(corrupted)).toBe(false); }
  });

  it('rejects forged deliveries, same-week receipts, mixed batch dates and restored exhausted bottles', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.reasoner.resupply.deliveries = 0; },
      x => { x.reasoner.resupply.deliveries = 2; },
      x => { x.reasoner.bottles[3]!.id = 'reasoner-potion-7'; },
      x => { x.reasoner.bottles[3]!.source = x.reasoner.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.reasoner.bottles[4]!.source = x.reasoner.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.reasoner.bottles[0]!.status = 'PLAYER'; x.reasoner.bottles[0]!.outcome = null; x.reasoner.bottles[0]!.consumedWeek = null; },
      x => { x.reasoner.bottles[3]!.status = 'PLAYER'; x.reasoner.bottles[3]!.acquiredWeek = 11; },
      x => { x.reasoner.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateReasonerState(corrupted)).toBe(false); }
    const pending = exhausted();
    apply(pending, { type: 'REQUEST_SUPPLY' });
    pending.reasoner.resupply.requestedWeek = 10;
    expect(validateReasonerState(pending)).toBe(false);
  });

  it('rejects malformed records without throwing and rejects premature adventure or mastery', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.reasoner, bottles: [null, null, null] }, { ...s.reasoner, cases: null }]) {
      const corrupted = clone(s);
      corrupted.reasoner = value as unknown as SliceState['reasoner'];
      expect(validateReasonerState(corrupted)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.reasoner.guidanceKnown = true; },
      (x: SliceState) => { x.reasoner.reflected = true; },
      (x: SliceState) => { x.reasoner.cases['stair-footprints']!.status = 'EXAMINED'; },
      (x: SliceState) => { x.progression.mastery[REASONER_ABILITY_IDS[0]] = 0; },
    ]) { const corrupted = clone(s); mutate(corrupted); expect(validateReasonerState(corrupted)).toBe(false); }
  });
});


describe('reasoner exact intent and case-state boundaries', () => {
  it('accepts only exact acquisition shapes and structurally valid activity identifiers', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'reasoner-potion-1' },
      { type: 'BUY_POTION', bottleId: 'reasoner-potion-999' },
      { type: 'CONSUME', bottleId: 'reasoner-potion-1', confirmed: true },
      { type: 'REFLECT' },
      ...REASONER_CASE_IDS.map(caseId => ({ type: 'EXAMINE', caseId })),
      { type: 'TEST', caseId: 'stair-footprints', testId: 'BOOT_SAMPLE' },
      { type: 'TEST', caseId: 'stair-footprints', testId: 'TIMING_LEDGER' },
      { type: 'TEST', caseId: 'swapped-invoice', testId: 'COUNTERFOIL' },
      { type: 'TEST', caseId: 'swapped-invoice', testId: 'CLIENT_CONFIRM' },
      { type: 'TEST', caseId: 'broken-window', testId: 'EDGE_INSPECTION' },
      { type: 'TEST', caseId: 'broken-window', testId: 'WEATHER_LOG' },
      ...['COPY_ERROR', 'AFTER_DELIVERY', 'POSSIBLE_WORKER', 'OUTSIDE_FORCE', 'UNRESOLVED', 'ACCUSE'].map(conclusion => ({ type: 'CONCLUDE', caseId: 'broken-window', conclusion })),
    ]) {
      expect(validateReasonerCommand(command)).toBe(true);
      if (validateReasonerCommand(command)) expect(isReasonerAcquisitionCommand(command)).toBe(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'POTION_WORK', 'BUY_POTION', 'CONSUME'].includes(command.type));
    }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'reader-potion-1' },
    { type: 'BUY_POTION', bottleId: 'reasoner-potion-0' },
    { type: 'BUY_POTION', bottleId: 'reasoner-potion-01' },
    { type: 'BUY_POTION', bottleId: 'reasoner-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'reasoner-potion-1' },
    { type: 'CONSUME', bottleId: 'reasoner-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'reasoner-potion-1', confirmed: true, guaranteed: true },
    { type: 'EXAMINE', caseId: 'invented' }, { type: 'EXAMINE', caseId: '__proto__' },
    { type: 'EXAMINE', caseId: 'stair-footprints', answer: 'ACCUSE' },
    { type: 'TEST', caseId: 'stair-footprints' },
    { type: 'TEST', caseId: 'stair-footprints', testId: '' },
    { type: 'TEST', caseId: 'stair-footprints', testId: 'BOOT_SAMPLE', free: true },
    { type: 'TEST', caseId: 'stair-footprints', testId: '   ' },
    { type: 'TEST', caseId: 'stair-footprints', testId: 'A'.repeat(81) },
    { type: 'CONCLUDE', caseId: 'broken-window' },
    { type: 'CONCLUDE', caseId: 'broken-window', conclusion: null },
    { type: 'CONCLUDE', caseId: 'broken-window', conclusion: '__proto__' },
    { type: 'CONCLUDE', caseId: 'broken-window', conclusion: 'UNRESOLVED', guaranteed: true },
    { type: 'REFLECT', caseId: 'stair-footprints' },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateReasonerCommand(command)).toBe(false);
  });

  it('cannot bypass acquisition with extra fields, brewing or activities', () => {
    const s = prepared();
    for (const command of [
      { type: 'BREW', bottleId: REASONER_BOTTLE_IDS[0] },
      { type: 'CONSUME', bottleId: REASONER_BOTTLE_IDS[0], confirmed: true, guaranteed: true },
      { type: 'EXAMINE', caseId: 'stair-footprints' },
      { type: 'TEST', caseId: 'stair-footprints', testId: 'BOOT_SAMPLE' },
      { type: 'CONCLUDE', caseId: 'stair-footprints', conclusion: 'UNRESOLVED' },
      { type: 'REFLECT' },
    ]) rejected(s, command as unknown as ReasonerAcquisitionCommand);
  });

  it('validates case shapes while leaving per-case evidence transitions to the activity module', () => {
    const s = promoted(), original = s.reasoner.cases['stair-footprints']!;
    for (const value of [
      null, {}, { ...original, automatic: true }, { ...original, status: 'OMNISCIENT' },
      { ...original, testId: '' }, { ...original, conclusion: 1 },
      { ...original, testId: '__proto__' }, { ...original, conclusion: 'A'.repeat(81) },
      { ...original, attemptWeek: 10 }, { ...original, attemptWeek: 12 },
      { ...original, attemptWeek: 11.5 }, { ...original, mistakes: -1 },
      { ...original, mistakes: 0.5 },
    ]) {
      const corrupted = clone(s);
      corrupted.reasoner.cases['stair-footprints'] = value as unknown as SliceState['reasoner']['cases'][string];
      expect(validateReasonerState(corrupted)).toBe(false);
    }
    s.reasoner.cases['stair-footprints'] = { status: 'RESOLVED', attemptWeek: 11, testId: 'BOOT_SAMPLE', conclusion: 'POSSIBLE_WORKER', mistakes: 0 };
    expect(validateReasonerState(s)).toBe(true);
  });

  it('labels the approved gameplay adaptation and never fabricates a recipe or omniscient result', () => {
    expect(REASONER_ABILITIES.map(ability => ability.id)).toEqual([...REASONER_ABILITY_IDS]);
    expect(REASONER_ABILITIES[0]!.description).toMatch(/获准/);
    expect(REASONER_ABILITIES[1]!.description).toMatch(/多个/);
    expect(REASONER_ABILITIES[1]!.description).toMatch(/错误/);
    expect(REASONER_ABILITIES[1]!.description).toMatch(/唯一事实/);
    expect(REASONER_ABILITIES[2]!.description).toMatch(/未新增可执行仪式/);
    const p = projectReasoner(promoted());
    expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([]);
    expect(p.story).toMatch(/本作玩法改编G/);
    expect(p.story).toMatch(/未独立证实/);
  });
});
