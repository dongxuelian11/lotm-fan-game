import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyBardCommand } from '../../src/domain/bard/index.js';
import { BARD_ABILITY_IDS, BARD_CASE_IDS } from '../../src/domain/bard/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyLightprayerCommand, createLightprayerState, isLightprayerAcquisitionCommand, projectLightprayer, validateLightprayerCommand, validateLightprayerState } from '../../src/domain/lightprayer/index.js';
import { LIGHTPRAYER_ABILITIES, LIGHTPRAYER_BOTTLE_IDS, LIGHTPRAYER_FORMULA_STATUS, LIGHTPRAYER_LABOUR_TASKS } from '../../src/domain/lightprayer/content.js';
import { LIGHTPRAYER_ABILITY_IDS, LIGHTPRAYER_CASE_IDS, type LightprayerAcquisitionCommand } from '../../src/domain/lightprayer/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('lightprayer-acquisition', sliceDefaultCreationSelection, 'lightprayer-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.lightprayer = createLightprayerState();
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
function bard(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyBardCommand(s, { type: 'DISCOVER' }, c);
  applyBardCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyBardCommand(s, { type: 'BUY_POTION', bottleId: s.bard.bottles[0]!.id }, c);
  applyBardCommand(s, { type: 'CONSUME', bottleId: s.bard.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  for (const id of BARD_CASE_IDS) {
    s.bard.cases[id] = { status: 'RESOLVED', attemptWeek: 9, mode: 'TALK', consent: false, withdrawals: 0 };
    s.seer.completedSources.push(`bard-case:${id}`);
  }
  s.bard.reflected = true;
  s.seer.completedSources.push('bard-reflection');
  s.progression.mastery = Object.fromEntries(BARD_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: LightprayerAcquisitionCommand, roll = 20) { applyLightprayerCommand(s, command, context(s, roll).c); }
function taught(s = bard()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.lightprayer.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true });
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
function rejected(s: SliceState, command: LightprayerAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('separate, sourced sequence-eight finished bottles', () => {
  it('starts with three independent originals but exposes no supply or actions to ordinary people', () => {
    const s = ordinary(), p = projectLightprayer(s);
    expect(validateLightprayerState(s)).toBe(true);
    expect(s.lightprayer.bottles.map(bottle => bottle.id)).toEqual([...LIGHTPRAYER_BOTTLE_IDS]);
    expect(s.lightprayer.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/lightprayer-potion|1050|1210|序列8独立成品/);
    expect(s.lightprayer).not.toHaveProperty('batches');
    expect(Object.keys(s.lightprayer.cases)).toEqual([...LIGHTPRAYER_CASE_IDS]);
    expect(Object.values(s.lightprayer.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' })));
    expect(s.lightprayer.reflected).toBe(false);
    const other = createLightprayerState();
    other.bottles[0]!.labourSteps = 3;
    other.cases['shaded-label']!.status = 'OBSERVED';
    expect(s.lightprayer.bottles[0]!.labourSteps).toBe(0);
    expect(s.lightprayer.cases['shaded-label']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor without a second discovery, and charges exactly 180 pence and one action', () => {
    const s = bard(), oldBard = JSON.stringify(s.bard), oldProgression = JSON.stringify(s.progression), oldClown = JSON.stringify(s.clown);
    const p = projectLightprayer(s);
    expect(p.actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(p.bottles).toHaveLength(3);
    expect(p.bottles.every(bottle => bottle.source.includes('新') && bottle.source.includes('序列8') && bottle.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: LIGHTPRAYER_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: LIGHTPRAYER_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyLightprayerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.lightprayer.guidanceKnown]).toEqual([9820, 39, true]);
    expect(JSON.stringify(s.bard)).toBe(oldBard);
    expect(JSON.stringify(s.progression)).toBe(oldProgression);
    expect(JSON.stringify(s.clown)).toBe(oldClown);
    expect(projectLightprayer(s).formulaKnown).toBe(false);
    expect(projectLightprayer(s).formula).toEqual([]);
    expect(projectLightprayer(s).supplies).toContain(LIGHTPRAYER_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的歌颂者存药');
    expect(validateLightprayerState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 1210 without an action to transfer only the chosen original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.lightprayer.bottles.slice(1)), oldBard = JSON.stringify(s.bard);
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.lightprayer.bottles.slice(1))).toBe(others);
    expect(JSON.stringify(s.bard)).toBe(oldBard);
    expect(s.lightprayer.bottles).toHaveLength(3);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateLightprayerState(s)).toBe(true);
  });

  it('requires three actual supply-room jobs for a per-bottle credit and a remaining 160 cash payment', () => {
    const s = taught(), bottle = s.lightprayer.bottles[0]!, ctx = context(s), oldBard = JSON.stringify(s.bard);
    for (let index = 0; index < 3; index += 1) {
      applyLightprayerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectLightprayer(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(LIGHTPRAYER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectLightprayer(s).actions.find(action => action.id === `buy-${LIGHTPRAYER_BOTTLE_IDS[1]}`)!.cost).toContain('1210便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9660, 36, 'PLAYER']);
    expect(JSON.stringify(s.bard)).toBe(oldBard);
    expect(validateLightprayerState(s)).toBe(true);
  });

  it.each([1, 2])('does not cash out or partially discount %i supply-room jobs', count => {
    const s = taught(), bottleId = LIGHTPRAYER_BOTTLE_IDS[0];
    for (let index = 0; index < count; index += 1) apply(s, { type: 'POTION_WORK', bottleId });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(1210);
    rejected(s, { type: 'POTION_WORK', bottleId });
  });

  it('rejects insufficient money and foreign originals before mutating', () => {
    const s = bard();
    s.cash = 179;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    taught(s);
    for (const bottleId of ['lightprayer-potion-4', 'bard-potion-1', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 1209;
    rejected(s, { type: 'BUY_POTION', bottleId: LIGHTPRAYER_BOTTLE_IDS[0] });
    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: LIGHTPRAYER_BOTTLE_IDS[0] });
    s.cash = 159;
    rejected(s, { type: 'BUY_POTION', bottleId: LIGHTPRAYER_BOTTLE_IDS[0] });
    s.cash = 160;
    buy(s);
    expect(s.cash).toBe(0);
  });
});

describe('bard digestion, maturity and separate confirmation', () => {
  it('allows early preparation but requires both digestion100 and four whole weeks since the original bard promotion', () => {
    const s = bard();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = buy(s), command = { type: 'CONSUME', bottleId: bottle.id, confirmed: true } as const;
    expect(validateLightprayerState(s)).toBe(true);
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [5, 6, 7, 8]) {
      s.week = week;
      expect(projectLightprayer(s).actions.find(action => action.id === `consume-${bottle.id}`)!.reason).toContain(`${week - 5}/4`);
      rejected(s, command);
    }
    s.week = 9;
    s.progression.acting = 99;
    rejected(s, command);
    s.progression.acting = 100;
    rejected(s, { ...command, confirmed: false } as unknown as LightprayerAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[1], confirmed: true });
    apply(s, command);
    expect(s.lightprayer.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 9, status: 'CONSUMED' });
    expect([s.progression.promotionWeek, s.lightprayer.promotionWeek, s.lightprayer.bardActingAtPromotion]).toEqual([5, 9, 100]);
    expect(validateLightprayerState(s)).toBe(true);
  });

  it('keeps unconsumed purchased bottles but blocks all additional preparation after success', () => {
    const s = taught();
    buy(s, 0); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true });
    expect(s.lightprayer.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' },
      { type: 'POTION_WORK', bottleId: LIGHTPRAYER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: LIGHTPRAYER_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ] satisfies LightprayerAcquisitionCommand[]) rejected(s, command);
    expect(projectLightprayer(s).actions.filter(action => action.command.type === 'CONSUME').every(action => !action.enabled)).toBe(true);
    expect(validateLightprayerState(s)).toBe(true);
  });

  it.each([
    ['other pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['missing old mentor', (s: SliceState) => { s.bard.discovered = false; }],
    ['missing old guidance', (s: SliceState) => { s.bard.guidanceKnown = false; }],
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('blocks consumption when %s without charging', (_label, mutate) => {
    const s = prepared();
    mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-action payment and confirmation but not labour or instruction', () => {
    const s = bard();
    s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1;
    taught(s);
    expect(s.actionsRemaining).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId: LIGHTPRAYER_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.progression.sequence).toBe(8);
  });
});

describe('lightprayer four-tier guidance and preserved bard progression', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} from one will difficulty12 check with no instant-death draw`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldBard = JSON.stringify(s.bard), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectLightprayer(s).bottles[0]!.chance;
    applyLightprayerCommand(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.lightprayer.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['sun', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.lightprayer.promotionWeek, s.lightprayer.bardActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.bard)).toBe(oldBard);
    for (const id of BARD_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 1], ['perception', 2], ['will', 3], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS] : [...BARD_ABILITY_IDS]);
    if (success) {
      expect(LIGHTPRAYER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectLightprayer(s).abilities).toEqual(LIGHTPRAYER_ABILITIES.map(ability => ({ ...ability, mastery: 0 })));
    } else expect(projectLightprayer(s).abilities).toEqual([]);
    expect(validateLightprayerState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps enhanced attributes and never grants holy water or notarization or replaces inherited abilities', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/holy-water|notarization|s7|s6/);
  });

  it('caps rejection at100, preserves severe failures and requires recovery before another attempt', () => {
    const s = taught();
    buy(s); buy(s, 1);
    s.health = 10;
    s.mind = 20;
    s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[1], confirmed: true });
    expect(s.progression.sequence).toBe(9);
    expect(s.progression.acting).toBe(100);
    expect(validateLightprayerState(s)).toBe(true);
  });
});

describe('finite lightprayer resupply after failed originals', () => {
  it('requires exhaustion, a paid action and an actual next week before receiving another independent batch', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.lightprayer.bottles), oldBard = JSON.stringify(s.bard), priorDate = { ...s.date };
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(s.lightprayer.bottles).toHaveLength(3);
    expect(projectLightprayer(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'LIGHTPRAYER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.lightprayer.resupply.requestedWeek]).toEqual([11, 1, cash, 11]);
    expect(JSON.stringify(s.lightprayer.bottles)).toBe(originals);
    expect(projectLightprayer(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateLightprayerState(s)).toBe(true);

    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(12);
    expect(s.date).not.toEqual(priorDate);
    expect(s.lightprayer.bottles).toHaveLength(3);
    const receiptCash = s.cash, receiptActions = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'LIGHTPRAYER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash, receiptActions]);
    expect(s.lightprayer.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.lightprayer.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.bard)).toBe(oldBard);
    expect(s.lightprayer.bottles.slice(3).map(bottle => bottle.id)).toEqual(['lightprayer-potion-4', 'lightprayer-potion-5', 'lightprayer-potion-6']);
    expect(s.lightprayer.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第12周实收入库'))).toBe(true);
    expect(s.chronicle.some(record => record.title === '申请下一批祈光人魔药')).toBe(true);
    expect(s.chronicle.some(record => record.title === '下一批祈光人原瓶到货')).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'lightprayer-potion-4', confirmed: true });
    expect(validateLightprayerState(s)).toBe(true);

    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: 'lightprayer-potion-4' });
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash - 160, receiptActions - 3]);
    apply(s, { type: 'CONSUME', bottleId: 'lightprayer-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.lightprayer.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.lightprayer.bottles.slice(0, 3))).toBe(originals);
    expect(validateLightprayerState(clone(s))).toBe(true);
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('never replenishes automatically and rejects requests with any unused bottle or a prior success', () => {
    for (const s of [ordinary(), bard(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' });
      rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted();
    s.week += 20;
    expect(projectLightprayer(s).supplies).toContain('供应方剩余0瓶');
    expect(s.lightprayer.bottles).toHaveLength(3);
    s.actionsRemaining = 0;
    rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s.lightprayer.bottles).toHaveLength(3);
  });

  it('fresh stock carries full price and cannot reuse labour from earlier originals', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, actions]);
    expect(projectLightprayer(s).bottles[3]!.source).toContain('lightprayer-potion-4');
    expect(validateLightprayerState(s)).toBe(true);
  });
});

describe('lightprayer acquisition save invariants', () => {
  it('rejects tampered bottle identity, chronology, source, labour and promotion while preserving valid states', () => {
    const s = promoted();
    expect(validateLightprayerState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.lightprayer.bottles[0]!.id = 'bard-potion-1'; },
      x => { x.lightprayer.bottles[0]!.source = 'invented'; },
      x => { x.lightprayer.bottles[0]!.labourSteps = 4; },
      x => { x.lightprayer.bottles[0]!.acquiredWeek = 4; },
      x => { x.lightprayer.bottles[0]!.consumedWeek = 10; },
      x => { x.lightprayer.bottles[0]!.consumedWeek = 12; },
      x => { x.lightprayer.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.lightprayer.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.lightprayer.bottles[1]!.acquiredWeek = 11; },
      x => { x.lightprayer.promotionWeek = 10; },
      x => { x.lightprayer.bardActingAtPromotion = 99; },
      x => { x.progression.promotionWeek = 11; },
      x => { x.lightprayer.guidanceKnown = false; },
      x => { delete x.progression.mastery[BARD_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[LIGHTPRAYER_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[LIGHTPRAYER_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['sun.s7.holy-water'] = 0; },
      x => { x.lightprayer.bottles.push({ ...x.lightprayer.bottles[0]! }); },
      x => { delete x.lightprayer.cases['shaded-label']; },
      x => { (x.lightprayer as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateLightprayerState(corrupted)).toBe(false); }
  });

  it('rejects forged deliveries, same-week receipts, mixed batch dates and restored exhausted bottles', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.lightprayer.resupply.deliveries = 0; },
      x => { x.lightprayer.resupply.deliveries = 2; },
      x => { x.lightprayer.bottles[3]!.id = 'lightprayer-potion-7'; },
      x => { x.lightprayer.bottles[3]!.source = x.lightprayer.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.lightprayer.bottles[4]!.source = x.lightprayer.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.lightprayer.bottles[0]!.status = 'PLAYER'; x.lightprayer.bottles[0]!.outcome = null; x.lightprayer.bottles[0]!.consumedWeek = null; },
      x => { x.lightprayer.bottles[3]!.status = 'PLAYER'; x.lightprayer.bottles[3]!.acquiredWeek = 11; },
      x => { x.lightprayer.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateLightprayerState(corrupted)).toBe(false); }
    const pending = exhausted();
    apply(pending, { type: 'REQUEST_SUPPLY' });
    pending.lightprayer.resupply.requestedWeek = 10;
    expect(validateLightprayerState(pending)).toBe(false);
  });

  it('rejects malformed records without throwing and rejects premature adventure or mastery', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.lightprayer, bottles: [null, null, null] }, { ...s.lightprayer, cases: null }]) {
      const corrupted = clone(s);
      corrupted.lightprayer = value as unknown as SliceState['lightprayer'];
      expect(validateLightprayerState(corrupted)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.lightprayer.guidanceKnown = true; },
      (x: SliceState) => { x.lightprayer.reflected = true; },
      (x: SliceState) => { x.lightprayer.cases['shaded-label']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.progression.mastery[LIGHTPRAYER_ABILITY_IDS[0]] = 0; },
    ]) { const corrupted = clone(s); mutate(corrupted); expect(validateLightprayerState(corrupted)).toBe(false); }
  });
});


describe('lightprayer exact intent and case-state boundaries', () => {
  it('accepts only exact acquisition shapes and finite light-practice activity methods', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'lightprayer-potion-1' },
      { type: 'BUY_POTION', bottleId: 'lightprayer-potion-999' },
      { type: 'CONSUME', bottleId: 'lightprayer-potion-1', confirmed: true },
      { type: 'REFLECT' },
      ...LIGHTPRAYER_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PERFORM', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PREPARE', caseId, method: 'LIGHT' }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
      ]),
    ]) {
      expect(validateLightprayerCommand(command)).toBe(true);
      if (validateLightprayerCommand(command)) expect(isLightprayerAcquisitionCommand(command)).toBe(['LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'POTION_WORK', 'BUY_POTION', 'CONSUME'].includes(command.type));
    }
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'bard-potion-1' },
    { type: 'BUY_POTION', bottleId: 'lightprayer-potion-0' },
    { type: 'BUY_POTION', bottleId: 'lightprayer-potion-01' },
    { type: 'BUY_POTION', bottleId: 'lightprayer-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'lightprayer-potion-1' },
    { type: 'CONSUME', bottleId: 'lightprayer-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'lightprayer-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'OBSERVE', caseId: '__proto__' },
    { type: 'OBSERVE', caseId: 'shaded-label', cleared: true },
    { type: 'PREPARE' }, { type: 'WITHDRAW', caseId: 'shaded-label', free: true },
    { type: 'PREPARE', caseId: 'shaded-label' },
    { type: 'PREPARE', caseId: 'shaded-label', method: 'ABILITY' },
    { type: 'PREPARE', caseId: 'wick-lighting', method: 'LIGHT', outcome: 'LIT' },
    { type: 'PREPARE', caseId: 'storehouse-echo', method: '__proto__' },
    { type: 'PERFORM', caseId: 'shaded-label', method: 'LIGHT' },
    { type: 'REFLECT', caseId: 'shaded-label' },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateLightprayerCommand(command)).toBe(false);
  });

  it('cannot bypass acquisition with extra fields, brewing or activities', () => {
    const s = prepared();
    for (const command of [
      { type: 'BREW', bottleId: LIGHTPRAYER_BOTTLE_IDS[0] },
      { type: 'CONSUME', bottleId: LIGHTPRAYER_BOTTLE_IDS[0], confirmed: true, guaranteed: true },
      { type: 'OBSERVE', caseId: 'shaded-label' },
      { type: 'PREPARE', caseId: 'wick-lighting', method: 'LIGHT' },
      { type: 'PERFORM', caseId: 'storehouse-echo' },
      { type: 'WITHDRAW', caseId: 'storehouse-echo' },
      { type: 'REFLECT' },
    ]) rejected(s, command as unknown as LightprayerAcquisitionCommand);
  });

  it('validates case shapes while leaving light-practice safety transitions to the activity module', () => {
    const s = promoted(), original = s.lightprayer.cases['shaded-label']!;
    for (const value of [
      null, {}, { ...original, automatic: true }, { ...original, status: 'OMNIPOTENT' },
      { ...original, method: '' }, { ...original, method: 'ABILITY' },
      { ...original, outcome: 'CLEANSED' }, { ...original, outcome: null },
      { ...original, attemptWeek: 10 }, { ...original, attemptWeek: 12 },
      { ...original, attemptWeek: 11.5 }, { ...original, withdrawals: -1 },
      { ...original, withdrawals: 0.5 },
    ]) {
      const corrupted = clone(s);
      corrupted.lightprayer.cases['shaded-label'] = value as unknown as SliceState['lightprayer']['cases'][string];
      expect(validateLightprayerState(corrupted)).toBe(false);
    }
    s.lightprayer.cases['shaded-label'] = { status: 'RESOLVED', attemptWeek: 11, method: 'ORDINARY', withdrawals: 0, outcome: 'VERIFIED' };
    expect(validateLightprayerState(s)).toBe(true);
  });

  it('keeps incomplete recipe fragments separate from bounded source-backed abilities and excludes later sequences', () => {
    expect(LIGHTPRAYER_ABILITIES.map(ability => ability.id)).toEqual([...LIGHTPRAYER_ABILITY_IDS]);
    expect(LIGHTPRAYER_ABILITIES).toHaveLength(3);
    expect(LIGHTPRAYER_ABILITIES[0]!.description).toMatch(/本人在暗中视物/);
    expect(LIGHTPRAYER_ABILITIES[1]!.description).toMatch(/金色火焰点燃蜡烛/);
    expect(LIGHTPRAYER_ABILITIES[2]!.description).toMatch(/祈祷.*光柱.*污染肉条/);
    expect(LIGHTPRAYER_FORMULA_STATUS).toMatch(/第一部第140章.*第二部第25章/);
    expect(LIGHTPRAYER_FORMULA_STATUS).toContain('光辉石1块');
    expect(LIGHTPRAYER_FORMULA_STATUS).toContain('炽白之魂的粉末（数量未明）');
    expect(LIGHTPRAYER_FORMULA_STATUS).toContain('镜猬的血液、熔浆巨怪的心脏');
    expect(LIGHTPRAYER_FORMULA_STATUS).toContain('金边太阳花1朵、附子汁液3滴');
    expect(LIGHTPRAYER_FORMULA_STATUS).toContain('省略号');
    expect(LIGHTPRAYER_FORMULA_STATUS).toContain('不构成完整制造配方');
    const p = projectLightprayer(promoted());
    expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([]);
    expect(p.story).toMatch(/本作玩法改编G/);
    expect(p.story).toMatch(/序列7.*圣水、序列6.*公证不在本阶段/);
  });
});
