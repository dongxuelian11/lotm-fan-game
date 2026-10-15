import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySailorCommand } from '../../src/domain/sailor/index.js';
import { SAILOR_ABILITY_IDS, SAILOR_CASE_IDS } from '../../src/domain/sailor/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyRagerCommand, createRagerState, isRagerAcquisitionCommand, projectRager, validateRagerCommand, validateRagerState } from '../../src/domain/rager/index.js';
import { RAGER_ABILITIES, RAGER_BOTTLE_IDS, RAGER_FORMULA_STATUS, RAGER_LABOUR_TASKS } from '../../src/domain/rager/content.js';
import { RAGER_ABILITY_IDS, RAGER_CASE_IDS, type RagerAcquisitionCommand } from '../../src/domain/rager/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('rager-acquisition', sliceDefaultCreationSelection, 'rager-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.rager = createRagerState();
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
function sailor(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applySailorCommand(s, { type: 'DISCOVER' }, c);
  applySailorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySailorCommand(s, { type: 'BUY_POTION', bottleId: s.sailor.bottles[0]!.id }, c);
  applySailorCommand(s, { type: 'CONSUME', bottleId: s.sailor.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  for (const id of SAILOR_CASE_IDS) {
    s.sailor.cases[id] = { status: 'RESOLVED', attemptWeek: 9, method: 'TEAM', rope: 'RETURNED', target: 'SAFE', withdrawals: 0 };
    s.seer.completedSources.push(`sailor-case:${id}`);
  }
  s.sailor.reflected = true;
  s.seer.completedSources.push('sailor-reflection');
  s.progression.mastery = Object.fromEntries(SAILOR_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: RagerAcquisitionCommand, roll = 20) { applyRagerCommand(s, command, context(s, roll).c); }
function taught(s = sailor()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.rager.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true });
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
function rejected(s: SliceState, command: RagerAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('separate, sourced sequence-eight finished bottles', () => {
  it('starts with three independent originals but exposes no supply or actions to ordinary people', () => {
    const s = ordinary(), p = projectRager(s);
    expect(validateRagerState(s)).toBe(true);
    expect(s.rager.bottles.map(bottle => bottle.id)).toEqual([...RAGER_BOTTLE_IDS]);
    expect(s.rager.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/rager-potion|1050|1210|序列8独立成品/);
    expect(s.rager).not.toHaveProperty('batches');
    expect(Object.keys(s.rager.cases)).toEqual([...RAGER_CASE_IDS]);
    expect(Object.values(s.rager.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, method: null, bystandersCleared: false, damage: false, withdrawals: 0 })));
    expect(s.rager.reflected).toBe(false);
    const other = createRagerState();
    other.bottles[0]!.labourSteps = 3;
    other.cases['jammed-capstan']!.status = 'OBSERVED';
    expect(s.rager.bottles[0]!.labourSteps).toBe(0);
    expect(s.rager.cases['jammed-capstan']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor without a second discovery, and charges exactly 180 pence and one action', () => {
    const s = sailor(), oldSailor = JSON.stringify(s.sailor), oldProgression = JSON.stringify(s.progression), oldClown = JSON.stringify(s.clown);
    const p = projectRager(s);
    expect(p.actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(p.bottles).toHaveLength(3);
    expect(p.bottles.every(bottle => bottle.source.includes('新') && bottle.source.includes('序列8') && bottle.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: RAGER_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: RAGER_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyRagerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.rager.guidanceKnown]).toEqual([9820, 39, true]);
    expect(JSON.stringify(s.sailor)).toBe(oldSailor);
    expect(JSON.stringify(s.progression)).toBe(oldProgression);
    expect(JSON.stringify(s.clown)).toBe(oldClown);
    expect(projectRager(s).formulaKnown).toBe(false);
    expect(projectRager(s).formula).toEqual([]);
    expect(projectRager(s).supplies).toContain(RAGER_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的水手存药');
    expect(validateRagerState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 1210 without an action to transfer only the chosen original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.rager.bottles.slice(1)), oldSailor = JSON.stringify(s.sailor);
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.rager.bottles.slice(1))).toBe(others);
    expect(JSON.stringify(s.sailor)).toBe(oldSailor);
    expect(s.rager.bottles).toHaveLength(3);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateRagerState(s)).toBe(true);
  });

  it('requires three actual repair-station jobs for a per-bottle credit and a remaining 160 cash payment', () => {
    const s = taught(), bottle = s.rager.bottles[0]!, ctx = context(s), oldSailor = JSON.stringify(s.sailor);
    for (let index = 0; index < 3; index += 1) {
      applyRagerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectRager(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(RAGER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectRager(s).actions.find(action => action.id === `buy-${RAGER_BOTTLE_IDS[1]}`)!.cost).toContain('1210便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9660, 36, 'PLAYER']);
    expect(JSON.stringify(s.sailor)).toBe(oldSailor);
    expect(validateRagerState(s)).toBe(true);
  });

  it.each([1, 2])('does not cash out or partially discount %i repair-station jobs', count => {
    const s = taught(), bottleId = RAGER_BOTTLE_IDS[0];
    for (let index = 0; index < count; index += 1) apply(s, { type: 'POTION_WORK', bottleId });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(1210);
    rejected(s, { type: 'POTION_WORK', bottleId });
  });

  it('rejects insufficient money and foreign originals before mutating', () => {
    const s = sailor();
    s.cash = 179;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    taught(s);
    for (const bottleId of ['rager-potion-4', 'sailor-potion-1', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 1209;
    rejected(s, { type: 'BUY_POTION', bottleId: RAGER_BOTTLE_IDS[0] });
    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: RAGER_BOTTLE_IDS[0] });
    s.cash = 159;
    rejected(s, { type: 'BUY_POTION', bottleId: RAGER_BOTTLE_IDS[0] });
    s.cash = 160;
    buy(s);
    expect(s.cash).toBe(0);
  });
});

describe('sailor digestion, maturity and separate confirmation', () => {
  it('allows early preparation but requires both digestion100 and four whole weeks since the original sailor promotion', () => {
    const s = sailor();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = buy(s), command = { type: 'CONSUME', bottleId: bottle.id, confirmed: true } as const;
    expect(validateRagerState(s)).toBe(true);
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [5, 6, 7, 8]) {
      s.week = week;
      expect(projectRager(s).actions.find(action => action.id === `consume-${bottle.id}`)!.reason).toContain(`${week - 5}/4`);
      rejected(s, command);
    }
    s.week = 9;
    s.progression.acting = 99;
    rejected(s, command);
    s.progression.acting = 100;
    rejected(s, { ...command, confirmed: false } as unknown as RagerAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[1], confirmed: true });
    apply(s, command);
    expect(s.rager.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 9, status: 'CONSUMED' });
    expect([s.progression.promotionWeek, s.rager.promotionWeek, s.rager.sailorActingAtPromotion]).toEqual([5, 9, 100]);
    expect(validateRagerState(s)).toBe(true);
  });

  it('keeps unconsumed purchased bottles but blocks all additional preparation after success', () => {
    const s = taught();
    buy(s, 0); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true });
    expect(s.rager.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' },
      { type: 'POTION_WORK', bottleId: RAGER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: RAGER_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ] satisfies RagerAcquisitionCommand[]) rejected(s, command);
    expect(projectRager(s).actions.filter(action => action.command.type === 'CONSUME').every(action => !action.enabled)).toBe(true);
    expect(validateRagerState(s)).toBe(true);
  });

  it.each([
    ['other pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['missing old mentor', (s: SliceState) => { s.sailor.discovered = false; }],
    ['missing old guidance', (s: SliceState) => { s.sailor.guidanceKnown = false; }],
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('blocks consumption when %s without charging', (_label, mutate) => {
    const s = prepared();
    mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-action payment and confirmation but not labour or instruction', () => {
    const s = sailor();
    s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1;
    taught(s);
    expect(s.actionsRemaining).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId: RAGER_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.progression.sequence).toBe(8);
  });
});

describe('rager four-tier guidance and preserved sailor progression', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} from one will difficulty12 check with no instant-death draw`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldSailor = JSON.stringify(s.sailor), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectRager(s).bottles[0]!.chance;
    applyRagerCommand(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.rager.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['tyrant', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.rager.promotionWeek, s.rager.sailorActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.sailor)).toBe(oldSailor);
    for (const id of SAILOR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 3], ['perception', 2], ['will', 2], ['knowledge', 0]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...SAILOR_ABILITY_IDS, ...RAGER_ABILITY_IDS] : [...SAILOR_ABILITY_IDS]);
    if (success) {
      expect(RAGER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectRager(s).abilities).toEqual(RAGER_ABILITIES.map(ability => ({ ...ability, mastery: 0 })));
    } else expect(projectRager(s).abilities).toEqual([]);
    expect(validateRagerState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps enhanced attributes and never grants water magic or invulnerability or replaces inherited abilities', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/water-magic|s7|s6/);
  });

  it('caps rejection at100, preserves severe failures and requires recovery before another attempt', () => {
    const s = taught();
    buy(s); buy(s, 1);
    s.health = 10;
    s.mind = 20;
    s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[1], confirmed: true });
    expect(s.progression.sequence).toBe(9);
    expect(s.progression.acting).toBe(100);
    expect(validateRagerState(s)).toBe(true);
  });
});

describe('finite rager resupply after failed originals', () => {
  it('requires exhaustion, a paid action and an actual next week before receiving another independent batch', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.rager.bottles), oldSailor = JSON.stringify(s.sailor), priorDate = { ...s.date };
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(s.rager.bottles).toHaveLength(3);
    expect(projectRager(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'RAGER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.rager.resupply.requestedWeek]).toEqual([11, 1, cash, 11]);
    expect(JSON.stringify(s.rager.bottles)).toBe(originals);
    expect(projectRager(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateRagerState(s)).toBe(true);

    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(12);
    expect(s.date).not.toEqual(priorDate);
    expect(s.rager.bottles).toHaveLength(3);
    const receiptCash = s.cash, receiptActions = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'RAGER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash, receiptActions]);
    expect(s.rager.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.rager.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.sailor)).toBe(oldSailor);
    expect(s.rager.bottles.slice(3).map(bottle => bottle.id)).toEqual(['rager-potion-4', 'rager-potion-5', 'rager-potion-6']);
    expect(s.rager.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第12周实收入库'))).toBe(true);
    expect(s.chronicle.some(record => record.title === '申请下一批暴怒之民魔药')).toBe(true);
    expect(s.chronicle.some(record => record.title === '下一批暴怒之民原瓶到货')).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'rager-potion-4', confirmed: true });
    expect(validateRagerState(s)).toBe(true);

    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: 'rager-potion-4' });
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash - 160, receiptActions - 3]);
    apply(s, { type: 'CONSUME', bottleId: 'rager-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.rager.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.rager.bottles.slice(0, 3))).toBe(originals);
    expect(validateRagerState(clone(s))).toBe(true);
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('never replenishes automatically and rejects requests with any unused bottle or a prior success', () => {
    for (const s of [ordinary(), sailor(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' });
      rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted();
    s.week += 20;
    expect(projectRager(s).supplies).toContain('供应方剩余0瓶');
    expect(s.rager.bottles).toHaveLength(3);
    s.actionsRemaining = 0;
    rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s.rager.bottles).toHaveLength(3);
  });

  it('fresh stock carries full price and cannot reuse labour from earlier originals', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, actions]);
    expect(projectRager(s).bottles[3]!.source).toContain('rager-potion-4');
    expect(validateRagerState(s)).toBe(true);
  });
});

describe('rager acquisition save invariants', () => {
  it('rejects tampered bottle identity, chronology, source, labour and promotion while preserving valid states', () => {
    const s = promoted();
    expect(validateRagerState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.rager.bottles[0]!.id = 'sailor-potion-1'; },
      x => { x.rager.bottles[0]!.source = 'invented'; },
      x => { x.rager.bottles[0]!.labourSteps = 4; },
      x => { x.rager.bottles[0]!.acquiredWeek = 4; },
      x => { x.rager.bottles[0]!.consumedWeek = 10; },
      x => { x.rager.bottles[0]!.consumedWeek = 12; },
      x => { x.rager.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.rager.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.rager.bottles[1]!.acquiredWeek = 11; },
      x => { x.rager.promotionWeek = 10; },
      x => { x.rager.sailorActingAtPromotion = 99; },
      x => { x.progression.promotionWeek = 11; },
      x => { x.rager.guidanceKnown = false; },
      x => { delete x.progression.mastery[SAILOR_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[RAGER_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[RAGER_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['tyrant.s7.water-magic'] = 0; },
      x => { x.rager.bottles.push({ ...x.rager.bottles[0]! }); },
      x => { delete x.rager.cases['jammed-capstan']; },
      x => { (x.rager as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateRagerState(corrupted)).toBe(false); }
  });

  it('rejects forged deliveries, same-week receipts, mixed batch dates and restored exhausted bottles', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.rager.resupply.deliveries = 0; },
      x => { x.rager.resupply.deliveries = 2; },
      x => { x.rager.bottles[3]!.id = 'rager-potion-7'; },
      x => { x.rager.bottles[3]!.source = x.rager.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.rager.bottles[4]!.source = x.rager.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.rager.bottles[0]!.status = 'PLAYER'; x.rager.bottles[0]!.outcome = null; x.rager.bottles[0]!.consumedWeek = null; },
      x => { x.rager.bottles[3]!.status = 'PLAYER'; x.rager.bottles[3]!.acquiredWeek = 11; },
      x => { x.rager.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateRagerState(corrupted)).toBe(false); }
    const pending = exhausted();
    apply(pending, { type: 'REQUEST_SUPPLY' });
    pending.rager.resupply.requestedWeek = 10;
    expect(validateRagerState(pending)).toBe(false);
  });

  it('rejects malformed records without throwing and rejects premature adventure or mastery', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.rager, bottles: [null, null, null] }, { ...s.rager, cases: null }]) {
      const corrupted = clone(s);
      corrupted.rager = value as unknown as SliceState['rager'];
      expect(validateRagerState(corrupted)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.rager.guidanceKnown = true; },
      (x: SliceState) => { x.rager.reflected = true; },
      (x: SliceState) => { x.rager.cases['jammed-capstan']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.progression.mastery[RAGER_ABILITY_IDS[0]] = 0; },
    ]) { const corrupted = clone(s); mutate(corrupted); expect(validateRagerState(corrupted)).toBe(false); }
  });
});


describe('rager exact intent and case-state boundaries', () => {
  it('accepts only exact acquisition shapes and finite dockside activity methods', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'rager-potion-1' },
      { type: 'BUY_POTION', bottleId: 'rager-potion-999' },
      { type: 'CONSUME', bottleId: 'rager-potion-1', confirmed: true },
      { type: 'REFLECT' },
      ...RAGER_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PERFORM', caseId, method: 'BURST' }, { type: 'PERFORM', caseId, method: 'TEAM' },
      ]),
    ]) {
      expect(validateRagerCommand(command)).toBe(true);
      if (validateRagerCommand(command)) expect(isRagerAcquisitionCommand(command)).toBe(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'POTION_WORK', 'BUY_POTION', 'CONSUME'].includes(command.type));
    }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'sailor-potion-1' },
    { type: 'BUY_POTION', bottleId: 'rager-potion-0' },
    { type: 'BUY_POTION', bottleId: 'rager-potion-01' },
    { type: 'BUY_POTION', bottleId: 'rager-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'rager-potion-1' },
    { type: 'CONSUME', bottleId: 'rager-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'rager-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'OBSERVE', caseId: '__proto__' },
    { type: 'OBSERVE', caseId: 'jammed-capstan', cleared: true },
    { type: 'PREPARE' }, { type: 'WITHDRAW', caseId: 'jammed-capstan', free: true },
    { type: 'PERFORM', caseId: 'jammed-capstan' },
    { type: 'PERFORM', caseId: 'jammed-capstan', method: 'ABILITY' },
    { type: 'PERFORM', caseId: 'falling-cargo', method: 'BURST', damage: false },
    { type: 'PERFORM', caseId: 'crowded-quay', method: '__proto__' },
    { type: 'REFLECT', caseId: 'jammed-capstan' },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateRagerCommand(command)).toBe(false);
  });

  it('cannot bypass acquisition with extra fields, brewing or activities', () => {
    const s = prepared();
    for (const command of [
      { type: 'BREW', bottleId: RAGER_BOTTLE_IDS[0] },
      { type: 'CONSUME', bottleId: RAGER_BOTTLE_IDS[0], confirmed: true, guaranteed: true },
      { type: 'OBSERVE', caseId: 'jammed-capstan' },
      { type: 'PREPARE', caseId: 'falling-cargo' },
      { type: 'PERFORM', caseId: 'crowded-quay', method: 'TEAM' },
      { type: 'WITHDRAW', caseId: 'crowded-quay' },
      { type: 'REFLECT' },
    ]) rejected(s, command as unknown as RagerAcquisitionCommand);
  });

  it('validates case shapes while leaving dockside safety transitions to the activity module', () => {
    const s = promoted(), original = s.rager.cases['jammed-capstan']!;
    for (const value of [
      null, {}, { ...original, automatic: true }, { ...original, status: 'OMNIPOTENT' },
      { ...original, method: '' }, { ...original, method: 'ABILITY' },
      { ...original, bystandersCleared: 1 }, { ...original, damage: null },
      { ...original, attemptWeek: 10 }, { ...original, attemptWeek: 12 },
      { ...original, attemptWeek: 11.5 }, { ...original, withdrawals: -1 },
      { ...original, withdrawals: 0.5 },
    ]) {
      const corrupted = clone(s);
      corrupted.rager.cases['jammed-capstan'] = value as unknown as SliceState['rager']['cases'][string];
      expect(validateRagerState(corrupted)).toBe(false);
    }
    s.rager.cases['jammed-capstan'] = { status: 'RESOLVED', attemptWeek: 11, method: 'TEAM', bystandersCleared: true, damage: false, withdrawals: 0 };
    expect(validateRagerState(s)).toBe(true);
  });

  it('records bounded anger, retained judgment and teamwork without fabricating a recipe or higher-sequence power', () => {
    expect(RAGER_ABILITIES.map(ability => ability.id)).toEqual([...RAGER_ABILITY_IDS]);
    expect(RAGER_ABILITIES).toHaveLength(2);
    expect(RAGER_ABILITIES[0]!.description).toMatch(/力量与速度爆发/);
    expect(RAGER_ABILITIES[0]!.description).toMatch(/同伴/);
    expect(RAGER_ABILITIES[0]!.description).toMatch(/普通一拳并非必然致命/);
    expect(RAGER_ABILITIES[0]!.description).toMatch(/不要求饮酒/);
    expect(RAGER_ABILITIES[1]!.description).toMatch(/玩法G/);
    expect(RAGER_ABILITIES[1]!.description).toMatch(/仍会受伤/);
    const p = projectRager(promoted());
    expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([]);
    expect(p.story).toMatch(/第65章/);
    expect(p.story).toMatch(/第129章/);
    expect(p.story).toMatch(/暴怒不等同疯狂/);
    expect(p.story).toMatch(/序列7水系法术不在本阶段/);
  });
});
