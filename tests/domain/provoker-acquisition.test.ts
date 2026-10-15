import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyHunterCommand } from '../../src/domain/hunter/index.js';
import { HUNTER_ABILITY_IDS } from '../../src/domain/hunter/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyProvokerCommand, createProvokerState, projectProvoker, validateProvokerState } from '../../src/domain/provoker/index.js';
import { PROVOKER_ABILITIES, PROVOKER_BOTTLE_IDS, PROVOKER_FORMULA_STATUS, PROVOKER_LABOUR_TASKS } from '../../src/domain/provoker/content.js';
import { PROVOKER_ABILITY_IDS, PROVOKER_CASE_IDS, type ProvokerAcquisitionCommand } from '../../src/domain/provoker/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('provoker-acquisition', sliceDefaultCreationSelection, 'provoker-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.provoker = createProvokerState();
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
function hunter(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyHunterCommand(s, { type: 'DISCOVER' }, c);
  applyHunterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyHunterCommand(s, { type: 'BUY_POTION', bottleId: s.hunter.bottles[0]!.id }, c);
  applyHunterCommand(s, { type: 'CONSUME', bottleId: s.hunter.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries(HUNTER_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: ProvokerAcquisitionCommand, roll = 20) { applyProvokerCommand(s, command, context(s, roll).c); }
function taught(s = hunter()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.provoker.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[0], confirmed: true });
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
function rejected(s: SliceState, command: ProvokerAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('separate, sourced sequence-eight finished bottles', () => {
  it('starts with three independent originals but exposes no supply or actions to ordinary people', () => {
    const s = ordinary(), p = projectProvoker(s);
    expect(validateProvokerState(s)).toBe(true);
    expect(s.provoker.bottles.map(bottle => bottle.id)).toEqual([...PROVOKER_BOTTLE_IDS]);
    expect(s.provoker.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/provoker-potion|1200|1370|序列8独立成品/);
    expect(s.provoker).not.toHaveProperty('batches');
    expect(Object.keys(s.provoker.cases)).toEqual([...PROVOKER_CASE_IDS]);
    expect(s.provoker.encounter).toEqual({ status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, enemyStatus: 'RESISTING' });
    const other = createProvokerState();
    other.bottles[0]!.labourSteps = 3;
    other.cases['invoice-claim']!.status = 'OBSERVED';
    other.encounter.enemyStatus = 'DEAD';
    expect(s.provoker.bottles[0]!.labourSteps).toBe(0);
    expect(s.provoker.cases['invoice-claim']!.status).toBe('AVAILABLE');
    expect(s.provoker.encounter.enemyStatus).toBe('RESISTING');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor without a second discovery, and charges exactly 180 pence and one action', () => {
    const s = hunter(), oldHunter = JSON.stringify(s.hunter), oldProgression = JSON.stringify(s.progression), oldClown = JSON.stringify(s.clown);
    const p = projectProvoker(s);
    expect(p.actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(p.bottles).toHaveLength(3);
    expect(p.bottles.every(bottle => bottle.source.includes('新') && bottle.source.includes('序列8') && bottle.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: PROVOKER_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: PROVOKER_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyProvokerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.provoker.guidanceKnown]).toEqual([9820, 39, true]);
    expect(JSON.stringify(s.hunter)).toBe(oldHunter);
    expect(JSON.stringify(s.progression)).toBe(oldProgression);
    expect(JSON.stringify(s.clown)).toBe(oldClown);
    expect(projectProvoker(s).formulaKnown).toBe(false);
    expect(projectProvoker(s).formula).toEqual([]);
    expect(projectProvoker(s).supplies).toContain(PROVOKER_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的猎人存药');
    expect(validateProvokerState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 1370 without an action to transfer only the chosen original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.provoker.bottles.slice(1)), oldHunter = JSON.stringify(s.hunter);
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8450, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.provoker.bottles.slice(1))).toBe(others);
    expect(JSON.stringify(s.hunter)).toBe(oldHunter);
    expect(s.provoker.bottles).toHaveLength(3);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateProvokerState(s)).toBe(true);
  });

  it('requires three actual warehouse jobs for a per-bottle credit and a remaining 170 cash payment', () => {
    const s = taught(), bottle = s.provoker.bottles[0]!, ctx = context(s), oldHunter = JSON.stringify(s.hunter);
    for (let index = 0; index < 3; index += 1) {
      applyProvokerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectProvoker(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 170 : 1370}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(PROVOKER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectProvoker(s).actions.find(action => action.id === `buy-${PROVOKER_BOTTLE_IDS[1]}`)!.cost).toContain('1370便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9650, 36, 'PLAYER']);
    expect(JSON.stringify(s.hunter)).toBe(oldHunter);
    expect(validateProvokerState(s)).toBe(true);
  });

  it.each([1, 2])('does not cash out or partially discount %i warehouse jobs', count => {
    const s = taught(), bottleId = PROVOKER_BOTTLE_IDS[0];
    for (let index = 0; index < count; index += 1) apply(s, { type: 'POTION_WORK', bottleId });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(1370);
    rejected(s, { type: 'POTION_WORK', bottleId });
  });

  it('rejects insufficient money and foreign originals before mutating', () => {
    const s = hunter();
    s.cash = 179;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    taught(s);
    for (const bottleId of ['provoker-potion-4', 'hunter-potion-1', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 1369;
    rejected(s, { type: 'BUY_POTION', bottleId: PROVOKER_BOTTLE_IDS[0] });
    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: PROVOKER_BOTTLE_IDS[0] });
    s.cash = 169;
    rejected(s, { type: 'BUY_POTION', bottleId: PROVOKER_BOTTLE_IDS[0] });
    s.cash = 170;
    buy(s);
    expect(s.cash).toBe(0);
  });
});

describe('hunter digestion, maturity and separate confirmation', () => {
  it('allows early preparation but requires both digestion100 and six whole weeks since the original hunter promotion', () => {
    const s = hunter();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = buy(s), command = { type: 'CONSUME', bottleId: bottle.id, confirmed: true } as const;
    expect(validateProvokerState(s)).toBe(true);
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [5, 6, 7, 8, 9, 10]) {
      s.week = week;
      expect(projectProvoker(s).actions.find(action => action.id === `consume-${bottle.id}`)!.reason).toContain(`${week - 5}/6`);
      rejected(s, command);
    }
    s.week = 11;
    s.progression.acting = 99;
    rejected(s, command);
    s.progression.acting = 100;
    rejected(s, { ...command, confirmed: false } as unknown as ProvokerAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[1], confirmed: true });
    apply(s, command);
    expect(s.provoker.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 11, status: 'CONSUMED' });
    expect([s.progression.promotionWeek, s.provoker.promotionWeek, s.provoker.hunterActingAtPromotion]).toEqual([5, 11, 100]);
    expect(validateProvokerState(s)).toBe(true);
  });

  it('keeps unconsumed purchased bottles but blocks all additional preparation after success', () => {
    const s = taught();
    buy(s, 0); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[0], confirmed: true });
    expect(s.provoker.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' },
      { type: 'POTION_WORK', bottleId: PROVOKER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: PROVOKER_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ] satisfies ProvokerAcquisitionCommand[]) rejected(s, command);
    expect(projectProvoker(s).actions.filter(action => action.command.type === 'CONSUME').every(action => !action.enabled)).toBe(true);
    expect(validateProvokerState(s)).toBe(true);
  });

  it.each([
    ['other pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['missing old mentor', (s: SliceState) => { s.hunter.discovered = false; }],
    ['missing old guidance', (s: SliceState) => { s.hunter.guidanceKnown = false; }],
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('blocks consumption when %s without charging', (_label, mutate) => {
    const s = prepared();
    mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-action payment and confirmation but not labour or instruction', () => {
    const s = hunter();
    s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1;
    taught(s);
    expect(s.actionsRemaining).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId: PROVOKER_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.progression.sequence).toBe(8);
  });
});

describe('provoker four-tier guidance and preserved hunter progression', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} from one will difficulty12 check with no instant-death draw`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldHunter = JSON.stringify(s.hunter), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectProvoker(s).bottles[0]!.chance;
    applyProvokerCommand(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.provoker.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['hunter', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.provoker.promotionWeek, s.provoker.hunterActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.hunter)).toBe(oldHunter);
    for (const id of HUNTER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 2], ['perception', 2], ['will', 3], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS] : [...HUNTER_ABILITY_IDS]);
    if (success) {
      expect(PROVOKER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectProvoker(s).abilities).toEqual(PROVOKER_ABILITIES.map(ability => ({ ...ability, mastery: 0 })));
    } else expect(projectProvoker(s).abilities).toEqual([]);
    expect(validateProvokerState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps increased attributes and never grants sequence-seven fire or replaces old abilities', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[0], confirmed: true });
    expect(Object.values(s.character.coreStats)).toEqual([500, 500, 500, 500]);
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/fire|flame|s7/);
  });

  it('caps rejection at100, preserves severe failures and requires recovery before another attempt', () => {
    const s = taught();
    buy(s); buy(s, 1);
    s.health = 10;
    s.mind = 20;
    s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: PROVOKER_BOTTLE_IDS[1], confirmed: true });
    expect(s.progression.sequence).toBe(9);
    expect(s.progression.acting).toBe(100);
    expect(validateProvokerState(s)).toBe(true);
  });
});

describe('finite provoker resupply after failed originals', () => {
  it('requires exhaustion, a paid action and an actual next week before receiving another independent batch', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.provoker.bottles), oldHunter = JSON.stringify(s.hunter), priorDate = { ...s.date };
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(s.provoker.bottles).toHaveLength(3);
    expect(projectProvoker(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'PROVOKER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.provoker.resupply.requestedWeek]).toEqual([11, 1, cash, 11]);
    expect(JSON.stringify(s.provoker.bottles)).toBe(originals);
    expect(projectProvoker(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateProvokerState(s)).toBe(true);

    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(12);
    expect(s.date).not.toEqual(priorDate);
    expect(s.provoker.bottles).toHaveLength(3);
    const receiptCash = s.cash, receiptActions = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'PROVOKER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash, receiptActions]);
    expect(s.provoker.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.provoker.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.hunter)).toBe(oldHunter);
    expect(s.provoker.bottles.slice(3).map(bottle => bottle.id)).toEqual(['provoker-potion-4', 'provoker-potion-5', 'provoker-potion-6']);
    expect(s.provoker.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第12周实收入库'))).toBe(true);
    expect(s.chronicle.some(record => record.title === '申请下一批挑衅者魔药')).toBe(true);
    expect(s.chronicle.some(record => record.title === '下一批挑衅者原瓶到货')).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'provoker-potion-4', confirmed: true });
    expect(validateProvokerState(s)).toBe(true);

    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: 'provoker-potion-4' });
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash - 170, receiptActions - 3]);
    apply(s, { type: 'CONSUME', bottleId: 'provoker-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.provoker.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.provoker.bottles.slice(0, 3))).toBe(originals);
    expect(validateProvokerState(clone(s))).toBe(true);
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('never replenishes automatically and rejects requests with any unused bottle or a prior success', () => {
    for (const s of [ordinary(), hunter(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' });
      rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted();
    s.week += 20;
    expect(projectProvoker(s).supplies).toContain('供应方剩余0瓶');
    expect(s.provoker.bottles).toHaveLength(3);
    s.actionsRemaining = 0;
    rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s.provoker.bottles).toHaveLength(3);
  });

  it('fresh stock carries full price and cannot reuse labour from earlier originals', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1370, actions]);
    expect(projectProvoker(s).bottles[3]!.source).toContain('provoker-potion-4');
    expect(validateProvokerState(s)).toBe(true);
  });
});

describe('provoker acquisition save invariants', () => {
  it('rejects tampered bottle identity, chronology, source, labour and promotion while preserving valid states', () => {
    const s = promoted();
    expect(validateProvokerState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.provoker.bottles[0]!.id = 'hunter-potion-1'; },
      x => { x.provoker.bottles[0]!.source = 'invented'; },
      x => { x.provoker.bottles[0]!.labourSteps = 4; },
      x => { x.provoker.bottles[0]!.acquiredWeek = 4; },
      x => { x.provoker.bottles[0]!.consumedWeek = 10; },
      x => { x.provoker.bottles[0]!.consumedWeek = 12; },
      x => { x.provoker.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.provoker.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.provoker.bottles[1]!.acquiredWeek = 11; },
      x => { x.provoker.promotionWeek = 10; },
      x => { x.provoker.hunterActingAtPromotion = 99; },
      x => { x.progression.promotionWeek = 11; },
      x => { x.provoker.guidanceKnown = false; },
      x => { delete x.progression.mastery[HUNTER_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[PROVOKER_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[PROVOKER_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['hunter.s7.fire'] = 0; },
      x => { x.provoker.bottles.push({ ...x.provoker.bottles[0]! }); },
      x => { delete x.provoker.cases['invoice-claim']; },
      x => { (x.provoker as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateProvokerState(corrupted)).toBe(false); }
  });

  it('rejects forged deliveries, same-week receipts, mixed batch dates and restored exhausted bottles', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.provoker.resupply.deliveries = 0; },
      x => { x.provoker.resupply.deliveries = 2; },
      x => { x.provoker.bottles[3]!.id = 'provoker-potion-7'; },
      x => { x.provoker.bottles[3]!.source = x.provoker.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.provoker.bottles[4]!.source = x.provoker.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.provoker.bottles[0]!.status = 'PLAYER'; x.provoker.bottles[0]!.outcome = null; x.provoker.bottles[0]!.consumedWeek = null; },
      x => { x.provoker.bottles[3]!.status = 'PLAYER'; x.provoker.bottles[3]!.acquiredWeek = 11; },
      x => { x.provoker.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateProvokerState(corrupted)).toBe(false); }
    const pending = exhausted();
    apply(pending, { type: 'REQUEST_SUPPLY' });
    pending.provoker.resupply.requestedWeek = 10;
    expect(validateProvokerState(pending)).toBe(false);
  });

  it('rejects malformed records without throwing and rejects premature adventure or mastery', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.provoker, bottles: [null, null, null] }, { ...s.provoker, cases: null }]) {
      const corrupted = clone(s);
      corrupted.provoker = value as unknown as SliceState['provoker'];
      expect(validateProvokerState(corrupted)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.provoker.guidanceKnown = true; },
      (x: SliceState) => { x.provoker.reflected = true; },
      (x: SliceState) => { x.provoker.cases['invoice-claim']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.provoker.encounter.status = 'FIGHTING'; },
      (x: SliceState) => { x.progression.mastery[PROVOKER_ABILITY_IDS[0]] = 0; },
    ]) { const corrupted = clone(s); mutate(corrupted); expect(validateProvokerState(corrupted)).toBe(false); }
  });
});
