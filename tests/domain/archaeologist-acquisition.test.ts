import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySavantCommand } from '../../src/domain/savant/index.js';
import { SAVANT_ABILITY_IDS } from '../../src/domain/savant/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyArchaeologistCommand, createArchaeologistState, projectArchaeologist, validateArchaeologistCommand, validateArchaeologistState } from '../../src/domain/archaeologist/index.js';
import { ARCHAEOLOGIST_ABILITIES, ARCHAEOLOGIST_BOTTLE_IDS, ARCHAEOLOGIST_FORMULA_STATUS, ARCHAEOLOGIST_LABOUR_TASKS } from '../../src/domain/archaeologist/content.js';
import { ARCHAEOLOGIST_ABILITY_IDS, ARCHAEOLOGIST_SITE_IDS, type ArchaeologistAcquisitionCommand } from '../../src/domain/archaeologist/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('archaeologist-acquisition', sliceDefaultCreationSelection, 'archaeologist-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.archaeologist = createArchaeologistState();
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
function savant(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applySavantCommand(s, { type: 'DISCOVER' }, c);
  applySavantCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySavantCommand(s, { type: 'BUY_POTION', bottleId: s.savant.bottles[0]!.id }, c);
  applySavantCommand(s, { type: 'CONSUME', bottleId: s.savant.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  for (const project of Object.values(s.savant.projects)) {
    project.status = 'DELIVERED'; project.materials = 'CONSUMED'; project.tool = 'WORKSHOP'; project.attemptWeek = 6;
  }
  s.savant.reflected = true;
  s.progression.mastery = Object.fromEntries(SAVANT_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: ArchaeologistAcquisitionCommand, roll = 20) { applyArchaeologistCommand(s, command, context(s, roll).c); }
function taught(s = savant()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.archaeologist.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true });
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
function rejected(s: SliceState, command: ArchaeologistAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('separate, sourced sequence-eight finished bottles', () => {
  it('starts with three independent originals but exposes no supply or actions to ordinary people', () => {
    const s = ordinary(), p = projectArchaeologist(s);
    expect(validateArchaeologistState(s)).toBe(true);
    expect(s.archaeologist.bottles.map(bottle => bottle.id)).toEqual([...ARCHAEOLOGIST_BOTTLE_IDS]);
    expect(s.archaeologist.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], sites: [], supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/archaeologist-potion|1200|1370|序列8独立成品/);
    expect(s.archaeologist).not.toHaveProperty('batches');
    expect(Object.keys(s.archaeologist.sites)).toEqual([...ARCHAEOLOGIST_SITE_IDS]);
    expect(Object.values(s.archaeologist.sites)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, approach: null })));
    const other = createArchaeologistState();
    other.bottles[0]!.labourSteps = 3;
    other.sites['cellar-arch']!.status = 'SURVEYED';
    expect(s.archaeologist.bottles[0]!.labourSteps).toBe(0);
    expect(s.archaeologist.sites['cellar-arch']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor without a second discovery, and charges exactly 180 pence and one action', () => {
    const s = savant(), oldSavant = JSON.stringify(s.savant), oldProgression = JSON.stringify(s.progression), oldClown = JSON.stringify(s.clown);
    const p = projectArchaeologist(s);
    expect(p.actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(p.bottles).toHaveLength(3);
    expect(p.bottles.every(bottle => bottle.source.includes('新') && bottle.source.includes('序列8') && bottle.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyArchaeologistCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.archaeologist.guidanceKnown]).toEqual([9820, 39, true]);
    expect(JSON.stringify(s.savant)).toBe(oldSavant);
    expect(JSON.stringify(s.progression)).toBe(oldProgression);
    expect(JSON.stringify(s.clown)).toBe(oldClown);
    expect(projectArchaeologist(s).formulaKnown).toBe(false);
    expect(projectArchaeologist(s).formula).toEqual([]);
    expect(projectArchaeologist(s).supplies).toContain(ARCHAEOLOGIST_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的通识者存药');
    expect(validateArchaeologistState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 1370 without an action to transfer only the chosen original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.archaeologist.bottles.slice(1)), oldSavant = JSON.stringify(s.savant);
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([8450, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.archaeologist.bottles.slice(1))).toBe(others);
    expect(JSON.stringify(s.savant)).toBe(oldSavant);
    expect(s.archaeologist.bottles).toHaveLength(3);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateArchaeologistState(s)).toBe(true);
  });

  it('requires three actual workshop jobs for a per-bottle credit and a remaining 170 cash payment', () => {
    const s = taught(), bottle = s.archaeologist.bottles[0]!, ctx = context(s), oldSavant = JSON.stringify(s.savant);
    for (let index = 0; index < 3; index += 1) {
      applyArchaeologistCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9820, 38 - index]);
      expect(projectArchaeologist(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 2 ? 170 : 1370}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(ARCHAEOLOGIST_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectArchaeologist(s).actions.find(action => action.id === `buy-${ARCHAEOLOGIST_BOTTLE_IDS[1]}`)!.cost).toContain('1370便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9650, 36, 'PLAYER']);
    expect(JSON.stringify(s.savant)).toBe(oldSavant);
    expect(validateArchaeologistState(s)).toBe(true);
  });

  it.each([1, 2])('does not cash out or partially discount %i workshop jobs', count => {
    const s = taught(), bottleId = ARCHAEOLOGIST_BOTTLE_IDS[0];
    for (let index = 0; index < count; index += 1) apply(s, { type: 'POTION_WORK', bottleId });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(1370);
    rejected(s, { type: 'POTION_WORK', bottleId });
  });

  it('rejects insufficient money and foreign originals before mutating', () => {
    const s = savant();
    s.cash = 179;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    taught(s);
    for (const bottleId of ['archaeologist-potion-4', 'savant-potion-1', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 1369;
    rejected(s, { type: 'BUY_POTION', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0] });
    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0] });
    s.cash = 169;
    rejected(s, { type: 'BUY_POTION', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0] });
    s.cash = 170;
    buy(s);
    expect(s.cash).toBe(0);
  });
});

describe('savant digestion, maturity and separate confirmation', () => {
  it('allows early preparation but requires both digestion100 and six whole weeks since the original savant promotion', () => {
    const s = savant();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = buy(s), command = { type: 'CONSUME', bottleId: bottle.id, confirmed: true } as const;
    expect(validateArchaeologistState(s)).toBe(true);
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [5, 6, 7, 8, 9, 10]) {
      s.week = week;
      expect(projectArchaeologist(s).actions.find(action => action.id === `consume-${bottle.id}`)!.reason).toContain(`${week - 5}/6`);
      rejected(s, command);
    }
    s.week = 11;
    s.progression.acting = 99;
    rejected(s, command);
    s.progression.acting = 100;
    rejected(s, { ...command, confirmed: false } as unknown as ArchaeologistAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[1], confirmed: true });
    apply(s, command);
    expect(s.archaeologist.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 11, status: 'CONSUMED' });
    expect([s.progression.promotionWeek, s.archaeologist.promotionWeek, s.archaeologist.savantActingAtPromotion]).toEqual([5, 11, 100]);
    expect(validateArchaeologistState(s)).toBe(true);
  });

  it('keeps unconsumed purchased bottles but blocks all additional preparation after success', () => {
    const s = taught();
    buy(s, 0); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true });
    expect(s.archaeologist.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' },
      { type: 'POTION_WORK', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ] satisfies ArchaeologistAcquisitionCommand[]) rejected(s, command);
    expect(projectArchaeologist(s).actions.filter(action => action.command.type === 'CONSUME').every(action => !action.enabled)).toBe(true);
    expect(validateArchaeologistState(s)).toBe(true);
  });

  it.each([
    ['other pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['missing old mentor', (s: SliceState) => { s.savant.discovered = false; }],
    ['missing old guidance', (s: SliceState) => { s.savant.guidanceKnown = false; }],
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('blocks consumption when %s without charging', (_label, mutate) => {
    const s = prepared();
    mutate(s);
    rejected(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-action payment and confirmation but not labour or instruction', () => {
    const s = savant();
    s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1;
    taught(s);
    expect(s.actionsRemaining).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0] });
    buy(s);
    apply(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
    expect(s.progression.sequence).toBe(8);
  });
});

describe('archaeologist four-tier guidance and preserved savant progression', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} from one will difficulty12 check with no instant-death draw`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldSavant = JSON.stringify(s.savant), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const displayedChance = projectArchaeologist(s).bottles[0]!.chance;
    applyArchaeologistCommand(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance: displayedChance });
    expect(displayedChance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.archaeologist.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['paragon', success ? 8 : 9, 5, success ? 0 : 100]);
    expect([s.archaeologist.promotionWeek, s.archaeologist.savantActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE');
    expect(JSON.stringify(s.savant)).toBe(oldSavant);
    for (const id of SAVANT_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(oldMastery[id]);
    for (const [stat, increase] of [['physique', 3], ['perception', 2], ['will', 0], ['knowledge', 2]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS] : [...SAVANT_ABILITY_IDS]);
    if (success) {
      expect(ARCHAEOLOGIST_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
      expect(projectSliceState(s).maxSpirituality).toBe(45);
      expect(projectArchaeologist(s).abilities).toEqual(ARCHAEOLOGIST_ABILITIES.map(ability => ({ ...ability, mastery: 0 })));
    } else expect(projectArchaeologist(s).abilities).toEqual([]);
    expect(validateArchaeologistState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps increased attributes and never grants sequence-seven appraisal or sequence-six enchanted crafting or replaces old abilities', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 499, knowledge: 500 });
    expect(JSON.stringify(s.progression.mastery)).not.toMatch(/appraise|enchant|s7|s6/);
  });

  it('caps rejection at100, preserves severe failures and requires recovery before another attempt', () => {
    const s = taught();
    buy(s); buy(s, 1);
    s.health = 10;
    s.mind = 20;
    s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[1], confirmed: true });
    expect(s.progression.sequence).toBe(9);
    expect(s.progression.acting).toBe(100);
    expect(validateArchaeologistState(s)).toBe(true);
  });
});

describe('finite archaeologist resupply after failed originals', () => {
  it('requires exhaustion, a paid action and an actual next week before receiving another independent batch', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.archaeologist.bottles), oldSavant = JSON.stringify(s.savant), priorDate = { ...s.date };
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(s.archaeologist.bottles).toHaveLength(3);
    expect(projectArchaeologist(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'ARCHAEOLOGIST', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.archaeologist.resupply.requestedWeek]).toEqual([11, 1, cash, 11]);
    expect(JSON.stringify(s.archaeologist.bottles)).toBe(originals);
    expect(projectArchaeologist(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateArchaeologistState(s)).toBe(true);

    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(12);
    expect(s.date).not.toEqual(priorDate);
    expect(s.archaeologist.bottles).toHaveLength(3);
    const receiptCash = s.cash, receiptActions = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'ARCHAEOLOGIST', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash, receiptActions]);
    expect(s.archaeologist.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.archaeologist.bottles.slice(0, 3))).toBe(originals);
    expect(JSON.stringify(s.savant)).toBe(oldSavant);
    expect(s.archaeologist.bottles.slice(3).map(bottle => bottle.id)).toEqual(['archaeologist-potion-4', 'archaeologist-potion-5', 'archaeologist-potion-6']);
    expect(s.archaeologist.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第12周实收入库'))).toBe(true);
    expect(s.chronicle.some(record => record.title === '申请下一批考古学家魔药')).toBe(true);
    expect(s.chronicle.some(record => record.title === '下一批考古学家原瓶到货')).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'archaeologist-potion-4', confirmed: true });
    expect(validateArchaeologistState(s)).toBe(true);

    for (let index = 0; index < 3; index += 1) apply(s, { type: 'POTION_WORK', bottleId: 'archaeologist-potion-4' });
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([receiptCash - 170, receiptActions - 3]);
    apply(s, { type: 'CONSUME', bottleId: 'archaeologist-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.archaeologist.promotionWeek]).toEqual([5, 12]);
    expect(JSON.stringify(s.archaeologist.bottles.slice(0, 3))).toBe(originals);
    expect(validateArchaeologistState(clone(s))).toBe(true);
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('never replenishes automatically and rejects requests with any unused bottle or a prior success', () => {
    for (const s of [ordinary(), savant(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' });
      rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted();
    s.week += 20;
    expect(projectArchaeologist(s).supplies).toContain('供应方剩余0瓶');
    expect(s.archaeologist.bottles).toHaveLength(3);
    s.actionsRemaining = 0;
    rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s.archaeologist.bottles).toHaveLength(3);
  });

  it('fresh stock carries full price and cannot reuse labour from earlier originals', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash, actions = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1370, actions]);
    expect(projectArchaeologist(s).bottles[3]!.source).toContain('archaeologist-potion-4');
    expect(validateArchaeologistState(s)).toBe(true);
  });
});

describe('archaeologist acquisition save invariants', () => {
  it('rejects tampered bottle identity, chronology, source, labour and promotion while preserving valid states', () => {
    const s = promoted();
    expect(validateArchaeologistState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.archaeologist.bottles[0]!.id = 'savant-potion-1'; },
      x => { x.archaeologist.bottles[0]!.source = 'invented'; },
      x => { x.archaeologist.bottles[0]!.labourSteps = 4; },
      x => { x.archaeologist.bottles[0]!.acquiredWeek = 4; },
      x => { x.archaeologist.bottles[0]!.consumedWeek = 10; },
      x => { x.archaeologist.bottles[0]!.consumedWeek = 12; },
      x => { x.archaeologist.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.archaeologist.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.archaeologist.bottles[1]!.acquiredWeek = 11; },
      x => { x.archaeologist.promotionWeek = 10; },
      x => { x.archaeologist.savantActingAtPromotion = 99; },
      x => { x.progression.promotionWeek = 11; },
      x => { x.archaeologist.guidanceKnown = false; },
      x => { delete x.progression.mastery[SAVANT_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[ARCHAEOLOGIST_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[ARCHAEOLOGIST_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['paragon.s7.appraise'] = 0; },
      x => { x.archaeologist.bottles.push({ ...x.archaeologist.bottles[0]! }); },
      x => { delete x.archaeologist.sites['cellar-arch']; },
      x => { (x.archaeologist as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateArchaeologistState(corrupted)).toBe(false); }
  });

  it('rejects forged deliveries, same-week receipts, mixed batch dates and restored exhausted bottles', () => {
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.archaeologist.resupply.deliveries = 0; },
      x => { x.archaeologist.resupply.deliveries = 2; },
      x => { x.archaeologist.bottles[3]!.id = 'archaeologist-potion-7'; },
      x => { x.archaeologist.bottles[3]!.source = x.archaeologist.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      x => { x.week = 13; x.archaeologist.bottles[4]!.source = x.archaeologist.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      x => { x.archaeologist.bottles[0]!.status = 'PLAYER'; x.archaeologist.bottles[0]!.outcome = null; x.archaeologist.bottles[0]!.consumedWeek = null; },
      x => { x.archaeologist.bottles[3]!.status = 'PLAYER'; x.archaeologist.bottles[3]!.acquiredWeek = 11; },
      x => { x.archaeologist.resupply.requestedWeek = 12; },
    ];
    for (const mutate of mutations) { const corrupted = clone(s); mutate(corrupted); expect(validateArchaeologistState(corrupted)).toBe(false); }
    const pending = exhausted();
    apply(pending, { type: 'REQUEST_SUPPLY' });
    pending.archaeologist.resupply.requestedWeek = 10;
    expect(validateArchaeologistState(pending)).toBe(false);
  });

  it('rejects malformed records without throwing and rejects premature adventure or mastery', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.archaeologist, bottles: [null, null, null] }, { ...s.archaeologist, sites: null }]) {
      const corrupted = clone(s);
      corrupted.archaeologist = value as unknown as SliceState['archaeologist'];
      expect(validateArchaeologistState(corrupted)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.archaeologist.guidanceKnown = true; },
      (x: SliceState) => { x.archaeologist.reflected = true; },
      (x: SliceState) => { x.archaeologist.sites['cellar-arch']!.status = 'SURVEYED'; },
      (x: SliceState) => { x.archaeologist.sites['old-waypost']!.approach = 'COMPARE'; },
      (x: SliceState) => { x.progression.mastery[ARCHAEOLOGIST_ABILITY_IDS[0]] = 0; },
    ]) { const corrupted = clone(s); mutate(corrupted); expect(validateArchaeologistState(corrupted)).toBe(false); }
  });
});


describe('archaeologist exact intent boundary', () => {
  it('accepts only declared acquisition and activity payloads', () => {
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'archaeologist-potion-1' },
      { type: 'BUY_POTION', bottleId: 'archaeologist-potion-999' },
      { type: 'CONSUME', bottleId: 'archaeologist-potion-1', confirmed: true },
      { type: 'REFLECT' },
      ...ARCHAEOLOGIST_SITE_IDS.flatMap(siteId => [
        { type: 'SURVEY', siteId }, { type: 'EXPLORE', siteId, approach: 'COMPARE' }, { type: 'EXPLORE', siteId, approach: 'CAREFUL' },
      ]),
    ]) expect(validateArchaeologistCommand(command)).toBe(true);
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 },
    { type: 'BUY_POTION' }, { type: 'POTION_WORK', bottleId: 'savant-potion-1' },
    { type: 'BUY_POTION', bottleId: 'archaeologist-potion-0' },
    { type: 'BUY_POTION', bottleId: 'archaeologist-potion-01' },
    { type: 'BUY_POTION', bottleId: 'archaeologist-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'archaeologist-potion-1' },
    { type: 'CONSUME', bottleId: 'archaeologist-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'archaeologist-potion-1', confirmed: true, guaranteed: true },
    { type: 'SURVEY', siteId: 'invented' }, { type: 'SURVEY', siteId: 'cellar-arch', approach: 'COMPARE' },
    { type: 'EXPLORE', siteId: 'cellar-arch' }, { type: 'EXPLORE', siteId: 'cellar-arch', approach: 'STEAL' },
    { type: 'REFLECT', siteId: 'cellar-arch' },
  ])('rejects malformed or undeclared intent %j', command => {
    expect(validateArchaeologistCommand(command)).toBe(false);
  });

  it('cannot bypass the acquisition entry point with unknown, extra or activity commands', () => {
    const s = prepared();
    for (const command of [
      { type: 'BREW', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0] },
      { type: 'CONSUME', bottleId: ARCHAEOLOGIST_BOTTLE_IDS[0], confirmed: true, guaranteed: true },
      { type: 'SURVEY', siteId: ARCHAEOLOGIST_SITE_IDS[0] },
      { type: 'EXPLORE', siteId: ARCHAEOLOGIST_SITE_IDS[0], approach: 'COMPARE' },
      { type: 'REFLECT' },
    ]) rejected(s, command as unknown as ArchaeologistAcquisitionCommand);
  });

  it('rejects malformed site fields but leaves promoted activity semantics to the activity validator', () => {
    const s = promoted();
    for (const value of [
      null, {}, { status: 'AVAILABLE', attemptWeek: null, approach: null, treasure: 1 },
      { status: 'UNKNOWN', attemptWeek: null, approach: null },
      { status: 'SURVEYED', attemptWeek: 12, approach: null },
      { status: 'SURVEYED', attemptWeek: null, approach: 'FORCE' },
    ]) {
      const corrupted = clone(s);
      corrupted.archaeologist.sites['cellar-arch'] = value as unknown as SliceState['archaeologist']['sites'][string];
      expect(validateArchaeologistState(corrupted)).toBe(false);
    }
    s.archaeologist.sites['cellar-arch'] = { status: 'RESOLVED', attemptWeek: 11, approach: 'CAREFUL' };
    expect(validateArchaeologistState(s)).toBe(true);
  });
});
