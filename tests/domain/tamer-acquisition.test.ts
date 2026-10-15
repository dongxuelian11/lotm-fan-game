import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyApothecaryCommand } from '../../src/domain/apothecary/index.js';
import { APOTHECARY_ABILITY_IDS } from '../../src/domain/apothecary/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyTamerCommand, createTamerState, projectTamer, validateTamerCommand, validateTamerState } from '../../src/domain/tamer/index.js';
import { TAMER_ABILITIES, TAMER_BOTTLE_IDS, TAMER_FORMULA_STATUS, TAMER_LABOUR_TASKS } from '../../src/domain/tamer/content.js';
import { TAMER_ABILITY_IDS, TAMER_ANIMAL_IDS, type TamerAcquisitionCommand } from '../../src/domain/tamer/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('tamer-acquisition', sliceDefaultCreationSelection, 'tamer-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.tamer = createTamerState();
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
function apothecary(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyApothecaryCommand(s, { type: 'DISCOVER' }, c);
  applyApothecaryCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyApothecaryCommand(s, { type: 'BUY_POTION', bottleId: s.apothecary.bottles[0]!.id }, c);
  applyApothecaryCommand(s, { type: 'CONSUME', bottleId: s.apothecary.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  for (const [id, patient] of Object.entries(s.apothecary.cases)) {
    patient.status = 'RESOLVED'; patient.choice = 'REFER';
    s.seer.completedSources.push(`apothecary-case:${id}`);
  }
  s.apothecary.reflected = true;
  s.seer.completedSources.push('apothecary-reflection');
  s.progression.mastery = Object.fromEntries(APOTHECARY_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: TamerAcquisitionCommand, roll = 20) { applyTamerCommand(s, command, context(s, roll).c); }
function taught(s = apothecary()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.tamer.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true });
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
function rejected(s: SliceState, command: TamerAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('separate, sourced sequence-eight finished bottles', () => {
  it('starts with three independent originals but exposes no supply or actions to ordinary people', () => {
    const s = ordinary(), p = projectTamer(s);
    expect(validateTamerState(s)).toBe(true);
    expect(s.tamer.bottles.map(bottle => bottle.id)).toEqual([...TAMER_BOTTLE_IDS]);
    expect(s.tamer.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], animals: [], companionName: null, supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/tamer-potion|1200|1370|序列8独立成品/);
    expect(s.tamer).not.toHaveProperty('batches');
    expect(Object.keys(s.tamer.animals)).toEqual([...TAMER_ANIMAL_IDS]);
    expect(Object.values(s.tamer.animals)).toEqual(Array.from({ length: 3 }, () => ({ observed: false, trained: false, helped: false, trainingAttemptWeek: null, helpAttemptWeek: null, location: 'HOME', foodPurchased: 0, foodHeld: 0, foodUsed: 0, foodWeek: null })));
    expect(s.tamer.companionId).toBe(null);
    const other = createTamerState();
    other.bottles[0]!.labourSteps = 3;
    other.animals['yard-hound']!.observed = true;
    expect(s.tamer.bottles[0]!.labourSteps).toBe(0);
    expect(s.tamer.animals['yard-hound']!.observed).toBe(false);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor without a second discovery, and charges exactly 180 pence and one action', () => {
    const s = apothecary(), oldApothecary = JSON.stringify(s.apothecary), oldProgression = JSON.stringify(s.progression), oldClown = JSON.stringify(s.clown);
    const p = projectTamer(s);
    expect(p.actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(p.bottles).toHaveLength(3);
    expect(p.bottles.every(bottle => bottle.source.includes('新') && bottle.source.includes('序列8') && bottle.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: TAMER_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: TAMER_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyTamerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.tamer.guidanceKnown]).toEqual([9820, 39, true]);
    expect(JSON.stringify(s.apothecary)).toBe(oldApothecary);
    expect(JSON.stringify(s.progression)).toBe(oldProgression);
    expect(JSON.stringify(s.clown)).toBe(oldClown);
    expect(projectTamer(s).formulaKnown).toBe(false);
    expect(projectTamer(s).formula).toEqual([]);
    expect(projectTamer(s).supplies).toContain(TAMER_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的药师存药');
    expect(validateTamerState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 1370 without an action to transfer only the chosen original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.tamer.bottles.slice(1)), oldApothecary = JSON.stringify(s.apothecary);
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8450, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.tamer.bottles.slice(1))).toBe(others);
    expect(JSON.stringify(s.apothecary)).toBe(oldApothecary);
    expect(s.tamer.bottles).toHaveLength(3);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateTamerState(s)).toBe(true);
  });

  it('requires three actual clinic jobs for a per-bottle credit and a remaining 170 cash payment', () => {
    const s = taught(), bottle = s.tamer.bottles[0]!, ctx = context(s), oldApothecary = JSON.stringify(s.apothecary);
    for (let index = 0; index < 3; index += 1) {
      applyTamerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectTamer(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 170 : 1370}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(TAMER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectTamer(s).actions.find(action => action.id === `buy-${TAMER_BOTTLE_IDS[1]}`)!.cost).toContain('1370便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9650, 36, 'PLAYER']);
    expect(JSON.stringify(s.apothecary)).toBe(oldApothecary);
    expect(validateTamerState(s)).toBe(true);
  });

  it.each([1, 2])('does not cash out or partially discount %i clinic jobs', count => {
    const s = taught(), bottleId = TAMER_BOTTLE_IDS[0];
    for (let index = 0; index < count; index += 1) apply(s, { type: 'POTION_WORK', bottleId });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(1370);
    rejected(s, { type: 'POTION_WORK', bottleId });
  });

  it('rejects insufficient money and foreign originals before mutating', () => {
    const s = apothecary();
    s.cash = 179;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    taught(s);
    for (const bottleId of ['tamer-potion-4', 'apothecary-potion-1', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 1369;
    rejected(s, { type: 'BUY_POTION', bottleId: TAMER_BOTTLE_IDS[0] });
    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: TAMER_BOTTLE_IDS[0] });
    s.cash = 169;
    rejected(s, { type: 'BUY_POTION', bottleId: TAMER_BOTTLE_IDS[0] });
    s.cash = 170;
    buy(s);
    expect(s.cash).toBe(0);
  });
});

describe('apothecary digestion, maturity and separate confirmation', () => {
  it('allows early preparation but requires both digestion100 and six whole weeks since the original apothecary promotion', () => {
    const s = apothecary();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = buy(s), command = { type: 'CONSUME', bottleId: bottle.id, confirmed: true } as const;
    expect(validateTamerState(s)).toBe(true);
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [5, 6, 7, 8, 9, 10]) {
      s.week = week;
      expect(projectTamer(s).actions.find(action => action.id === `consume-${bottle.id}`)!.reason).toContain(`${week - 5}/6`);
      rejected(s, command);
    }
    s.week = 11;
    s.progression.acting = 99;
    rejected(s, command);
    s.progression.acting = 100;
    rejected(s, { ...command, confirmed: false } as unknown as TamerAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[1], confirmed: true });
    apply(s, command);
    expect(s.tamer.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 11, status: 'CONSUMED' });
    expect([s.progression.promotionWeek, s.tamer.promotionWeek, s.tamer.apothecaryActingAtPromotion]).toEqual([5, 11, 100]);
    expect(validateTamerState(s)).toBe(true);
  });

  it('keeps unconsumed purchased bottles but blocks all additional preparation after success', () => {
    const s = taught();
    buy(s, 0); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true });
    expect(s.tamer.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' },
      { type: 'POTION_WORK', bottleId: TAMER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: TAMER_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ] satisfies TamerAcquisitionCommand[]) rejected(s, command);
    expect(projectTamer(s).actions.filter(action => action.command.type === 'CONSUME').every(action => !action.enabled)).toBe(true);
    expect(validateTamerState(s)).toBe(true);
  });

  it.each([
    ['other pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['missing old mentor', (s: SliceState) => { s.apothecary.discovered = false; }],
    ['missing old guidance', (s: SliceState) => { s.apothecary.guidanceKnown = false; }],
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('blocks consumption when %s without charging', (_label, mutate) => {
    const s = prepared();
    mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-action payment and confirmation but not labour or instruction', () => {
    const s = apothecary();
    s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1;
    taught(s);
    expect(s.actionsRemaining).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId: TAMER_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.progression.sequence).toBe(8);
  });
});

describe('tamer four-tier guidance and preserved apothecary progression', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} from one will difficulty12 check with no instant-death draw`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldApothecary = JSON.stringify(s.apothecary), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectTamer(s).bottles[0]!.chance;
    applyTamerCommand(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.tamer.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['moon', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.tamer.promotionWeek, s.tamer.apothecaryActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.apothecary)).toBe(oldApothecary);
    for (const id of APOTHECARY_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 4], ['perception', 2], ['will', 1], ['knowledge', 0]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS] : [...APOTHECARY_ABILITY_IDS]);
    if (success) {
      expect(TAMER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectTamer(s).abilities).toEqual(TAMER_ABILITIES.map(ability => ({ ...ability, mastery: 0 })));
    } else expect(projectTamer(s).abilities).toEqual([]);
    expect(validateTamerState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps increased attributes and never grants sequence-seven regeneration or sequence-three summoning or replaces old abilities', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/regeneration|summon|s7|s3/);
  });

  it('caps rejection at100, preserves severe failures and requires recovery before another attempt', () => {
    const s = taught();
    buy(s); buy(s, 1);
    s.health = 10;
    s.mind = 20;
    s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[1], confirmed: true });
    expect(s.progression.sequence).toBe(9);
    expect(s.progression.acting).toBe(100);
    expect(validateTamerState(s)).toBe(true);
  });
});

describe('finite tamer resupply after failed originals', () => {
  it('requires exhaustion, a paid action and an actual next week before receiving another independent batch', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.tamer.bottles), oldApothecary = JSON.stringify(s.apothecary), priorDate = { ...s.date };
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(s.tamer.bottles).toHaveLength(3);
    expect(projectTamer(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'TAMER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.tamer.resupply.requestedWeek]).toEqual([11, 1, cash, 11]);
    expect(JSON.stringify(s.tamer.bottles)).toBe(originals);
    expect(projectTamer(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateTamerState(s)).toBe(true);

    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(12);
    expect(s.date).not.toEqual(priorDate);
    expect(s.tamer.bottles).toHaveLength(3);
    const receiptCash = s.cash, receiptActions = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'TAMER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash, receiptActions]);
    expect(s.tamer.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.tamer.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.apothecary)).toBe(oldApothecary);
    expect(s.tamer.bottles.slice(3).map(bottle => bottle.id)).toEqual(['tamer-potion-4', 'tamer-potion-5', 'tamer-potion-6']);
    expect(s.tamer.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第12周实收入库'))).toBe(true);
    expect(s.chronicle.some(record => record.title === '申请下一批驯兽师魔药')).toBe(true);
    expect(s.chronicle.some(record => record.title === '下一批驯兽师原瓶到货')).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'tamer-potion-4', confirmed: true });
    expect(validateTamerState(s)).toBe(true);

    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: 'tamer-potion-4' });
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash - 170, receiptActions - 3]);
    apply(s, { type: 'CONSUME', bottleId: 'tamer-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.tamer.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.tamer.bottles.slice(0, 3))).toBe(originals);
    expect(validateTamerState(clone(s))).toBe(true);
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('never replenishes automatically and rejects requests with any unused bottle or a prior success', () => {
    for (const s of [ordinary(), apothecary(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' });
      rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted();
    s.week += 20;
    expect(projectTamer(s).supplies).toContain('供应方剩余0瓶');
    expect(s.tamer.bottles).toHaveLength(3);
    s.actionsRemaining = 0;
    rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s.tamer.bottles).toHaveLength(3);
  });

  it('fresh stock carries full price and cannot reuse labour from earlier originals', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1370, actions]);
    expect(projectTamer(s).bottles[3]!.source).toContain('tamer-potion-4');
    expect(validateTamerState(s)).toBe(true);
  });
});

describe('tamer acquisition save invariants', () => {
  it('rejects tampered bottle identity, chronology, source, labour and promotion while preserving valid states', () => {
    const s = promoted();
    expect(validateTamerState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.tamer.bottles[0]!.id = 'apothecary-potion-1'; },
      x => { x.tamer.bottles[0]!.source = 'invented'; },
      x => { x.tamer.bottles[0]!.labourSteps = 4; },
      x => { x.tamer.bottles[0]!.acquiredWeek = 4; },
      x => { x.tamer.bottles[0]!.consumedWeek = 10; },
      x => { x.tamer.bottles[0]!.consumedWeek = 12; },
      x => { x.tamer.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.tamer.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.tamer.bottles[1]!.acquiredWeek = 11; },
      x => { x.tamer.promotionWeek = 10; },
      x => { x.tamer.apothecaryActingAtPromotion = 99; },
      x => { x.progression.promotionWeek = 11; },
      x => { x.tamer.guidanceKnown = false; },
      x => { delete x.progression.mastery[APOTHECARY_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[TAMER_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[TAMER_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['moon.s7.regeneration'] = 0; },
      x => { x.tamer.bottles.push({ ...x.tamer.bottles[0]! }); },
      x => { delete x.tamer.animals['yard-hound']; },
      x => { (x.tamer as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateTamerState(corrupted)).toBe(false); }
  });

  it('rejects forged deliveries, same-week receipts, mixed batch dates and restored exhausted bottles', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.tamer.resupply.deliveries = 0; },
      x => { x.tamer.resupply.deliveries = 2; },
      x => { x.tamer.bottles[3]!.id = 'tamer-potion-7'; },
      x => { x.tamer.bottles[3]!.source = x.tamer.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.tamer.bottles[4]!.source = x.tamer.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.tamer.bottles[0]!.status = 'PLAYER'; x.tamer.bottles[0]!.outcome = null; x.tamer.bottles[0]!.consumedWeek = null; },
      x => { x.tamer.bottles[3]!.status = 'PLAYER'; x.tamer.bottles[3]!.acquiredWeek = 11; },
      x => { x.tamer.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateTamerState(corrupted)).toBe(false); }
    const pending = exhausted();
    apply(pending, { type: 'REQUEST_SUPPLY' });
    pending.tamer.resupply.requestedWeek = 10;
    expect(validateTamerState(pending)).toBe(false);
  });

  it('rejects malformed records without throwing and rejects premature adventure or mastery', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.tamer, bottles: [null, null, null] }, { ...s.tamer, animals: null }]) {
      const corrupted = clone(s);
      corrupted.tamer = value as unknown as SliceState['tamer'];
      expect(validateTamerState(corrupted)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.tamer.guidanceKnown = true; },
      (x: SliceState) => { x.tamer.reflected = true; },
      (x: SliceState) => { x.tamer.animals['yard-hound']!.observed = true; },
      (x: SliceState) => { x.tamer.animals['hillside-goat']!.foodHeld = 1; },
      (x: SliceState) => { x.progression.mastery[TAMER_ABILITY_IDS[0]] = 0; },
    ]) { const corrupted = clone(s); mutate(corrupted); expect(validateTamerState(corrupted)).toBe(false); }
  });
});


describe('tamer exact intent boundary', () => {
  it('accepts only declared acquisition and animal activity payloads', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'tamer-potion-1' },
      { type: 'BUY_POTION', bottleId: 'tamer-potion-999' },
      { type: 'CONSUME', bottleId: 'tamer-potion-1', confirmed: true },
      { type: 'REFLECT' }, { type: 'RETURN_ANIMAL' },
      ...TAMER_ANIMAL_IDS.flatMap(animalId => ['OBSERVE', 'BUY_FEED', 'TRAIN', 'INVITE', 'ASSIST'].map(type => ({ type, animalId }))),
    ]) expect(validateTamerCommand(command)).toBe(true);
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'apothecary-potion-1' },
    { type: 'BUY_POTION', bottleId: 'tamer-potion-0' },
    { type: 'BUY_POTION', bottleId: 'tamer-potion-01' },
    { type: 'BUY_POTION', bottleId: 'tamer-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'tamer-potion-1' },
    { type: 'CONSUME', bottleId: 'tamer-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'tamer-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', animalId: 'invented' }, { type: 'TRAIN', animalId: '__proto__' },
    { type: 'BUY_FEED', animalId: 'yard-hound', quantity: 100 },
    { type: 'INVITE', animalId: 'yard-hound', permanent: true },
    { type: 'ASSIST' }, { type: 'RETURN_ANIMAL', animalId: 'yard-hound' },
    { type: 'REFLECT', animalId: 'yard-hound' },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateTamerCommand(command)).toBe(false);
  });

  it('cannot bypass the acquisition entry point with unknown, extra or activity commands', () => {
    const s = prepared();
    for (const command of [
      { type: 'BREW', bottleId: TAMER_BOTTLE_IDS[0] },
      { type: 'CONSUME', bottleId: TAMER_BOTTLE_IDS[0], confirmed: true, guaranteed: true },
      ...['OBSERVE', 'BUY_FEED', 'TRAIN', 'INVITE', 'ASSIST'].map(type => ({ type, animalId: TAMER_ANIMAL_IDS[0] })),
      { type: 'RETURN_ANIMAL' }, { type: 'REFLECT' },
    ]) rejected(s, command as unknown as TamerAcquisitionCommand);
  });

  it('rejects malformed animal fields but leaves promoted activity semantics to the animal validator', () => {
    const s = promoted(), animal = s.tamer.animals['yard-hound']!;
    for (const value of [
      null, {}, { ...animal, ownership: 'PLAYER' },
      { ...animal, observed: 'yes' }, { ...animal, location: 'SUMMONED' },
      { ...animal, trainingAttemptWeek: 12 }, { ...animal, helpAttemptWeek: 0 },
      { ...animal, foodPurchased: -1 }, { ...animal, foodHeld: 1.5 },
      { ...animal, foodUsed: Number.MAX_SAFE_INTEGER + 1 }, { ...animal, foodWeek: 12 },
    ]) {
      const corrupted = clone(s);
      corrupted.tamer.animals['yard-hound'] = value as unknown as SliceState['tamer']['animals'][string];
      expect(validateTamerState(corrupted)).toBe(false);
    }
    s.tamer.animals['yard-hound'] = { observed: true, trained: true, helped: false, trainingAttemptWeek: 11, helpAttemptWeek: null, location: 'WITH_PLAYER', foodPurchased: 1, foodHeld: 0, foodUsed: 1, foodWeek: 11 };
    s.tamer.companionId = 'yard-hound';
    expect(validateTamerState(s)).toBe(true);
    s.tamer.companionId = 'invented';
    expect(validateTamerState(s)).toBe(false);
  });
});
