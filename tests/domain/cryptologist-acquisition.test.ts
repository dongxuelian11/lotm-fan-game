import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyMarauderCommand } from '../../src/domain/marauder/index.js';
import { applyMarauderActivity } from '../../src/domain/marauder/life.js';
import { MARAUDER_ABILITY_IDS, MARAUDER_CASE_IDS } from '../../src/domain/marauder/types.js';
import { applySwindlerCommand } from '../../src/domain/swindler/index.js';
import { applySwindlerActivity } from '../../src/domain/swindler/life.js';
import { SWINDLER_ABILITY_IDS, SWINDLER_CASE_IDS } from '../../src/domain/swindler/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyCryptologistCommand, createCryptologistState, isCryptologistAcquisitionCommand,
  projectCryptologist, validateCryptologistCommand, validateCryptologistState,
} from '../../src/domain/cryptologist/index.js';
import {
  CRYPTOLOGIST_ABILITIES, CRYPTOLOGIST_BOTTLE_IDS, CRYPTOLOGIST_FORMULA_STATUS,
  CRYPTOLOGIST_GUIDE, CRYPTOLOGIST_LABOUR_TASKS, CRYPTOLOGIST_SOURCE_STATUS,
} from '../../src/domain/cryptologist/content.js';
import { CRYPTOLOGIST_ABILITY_IDS, CRYPTOLOGIST_CASE_IDS, type CryptologistAcquisitionCommand } from '../../src/domain/cryptologist/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const inheritedIds = [...MARAUDER_ABILITY_IDS, ...SWINDLER_ABILITY_IDS];
function ordinary(): SliceState {
  const s = createSliceRun('cryptologist-acquisition', sliceDefaultCreationSelection, 'cryptologist-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 10000;
  s.actionsRemaining = 40; s.weeklyBudget = 40; s.character.coreStats.will = 15;
  s.cryptologist = createCryptologistState();
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
      s.lastCheck = result; return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, notes };
}
function swindler(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyMarauderCommand(s, { type: 'DISCOVER' }, c);
  applyMarauderCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMarauderCommand(s, { type: 'BUY_POTION', bottleId: s.marauder.bottles[0]!.id }, c);
  applyMarauderCommand(s, { type: 'CONSUME', bottleId: s.marauder.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source); s.progression.mastery[MARAUDER_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of MARAUDER_CASE_IDS) {
    applyMarauderActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyMarauderActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applyMarauderActivity(s, { type: 'PERFORM', caseId }, c, award);
    applyMarauderActivity(s, { type: 'RETURN', caseId }, c, award);
    applyMarauderActivity(s, { type: 'REPORT', caseId, conclusion: 'LIMITED' }, c, award);
  }
  applyMarauderActivity(s, { type: 'REFLECT' }, c, award);
  s.week = 11;
  applySwindlerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySwindlerCommand(s, { type: 'BUY_POTION', bottleId: s.swindler.bottles[0]!.id }, c);
  applySwindlerCommand(s, { type: 'CONSUME', bottleId: s.swindler.bottles[0]!.id, confirmed: true }, c);
  for (const caseId of SWINDLER_CASE_IDS) {
    applySwindlerActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applySwindlerActivity(s, { type: 'PREPARE', caseId, method: 'PLAIN' }, c, award);
    applySwindlerActivity(s, { type: 'PERFORM', caseId }, c, award);
    applySwindlerActivity(s, { type: 'DISCLOSE', caseId }, c, award);
  }
  applySwindlerActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(inheritedIds.map((id, index) => [id, index * 25]));
  s.week = 21; s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: CryptologistAcquisitionCommand, roll = 20) { applyCryptologistCommand(s, command, context(s, roll).c); }
function taught(s = swindler()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.cryptologist.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index++) {
    const bottle = buy(s, index); apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
  }
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as CryptologistAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;
const inherited = (s: SliceState) => JSON.stringify([s.marauder, s.swindler, s.seer.completedSources]);

describe('independent Cryptologist original-potion acquisition', () => {
  it('starts with three sealed S7 originals and hides all unearned supply', () => {
    const s = ordinary(), p = projectCryptologist(s);
    expect(validateCryptologistState(s)).toBe(true);
    expect(s.cryptologist.bottles.map(b => b.id)).toEqual([...CRYPTOLOGIST_BOTTLE_IDS]);
    expect(s.cryptologist.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/cryptologist-potion|1800|2010/);
    expect(Object.keys(s.cryptologist)).toEqual(['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'swindlerActingAtPromotion', 'cases', 'reflected']);
    expect(Object.keys(s.cryptologist.cases)).toEqual([...CRYPTOLOGIST_CASE_IDS]);
    expect(Object.values(s.cryptologist.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' })));
    const separate = createCryptologistState();
    separate.bottles[0]!.labourSteps = 4; separate.cases['ledger-sequence']!.status = 'OBSERVED';
    expect(s.cryptologist.bottles[0]!.labourSteps).toBe(0);
    expect(s.cryptologist.cases['ledger-sequence']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor, charges 240 and one AP, and preserves prior facts', () => {
    const s = swindler(), prior = inherited(s), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    expect(CRYPTOLOGIST_GUIDE).toContain('艾德温·洛克');
    expect(projectCryptologist(s).actions.map(a => a.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(projectCryptologist(s).bottles.every(b => b.source.includes('新解密资料') && b.source.includes('序列7') && b.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0] });
    applyCryptologistCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.cryptologist.guidanceKnown]).toEqual([9760, 39, true]);
    expect([inherited(s), JSON.stringify(s.progression), JSON.stringify(s.world)]).toEqual([prior, progression, world]);
    expect(projectCryptologist(s).supplies).toContain(CRYPTOLOGIST_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的诈骗师存药');
    expect(validateCryptologistState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 2010 and zero AP for the selected original without partial discounts', () => {
    const s = taught(), prior = inherited(s), others = JSON.stringify(s.cryptologist.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([7750, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 21, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.cryptologist.bottles.slice(1))).toBe(others); expect(inherited(s)).toBe(prior);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id }); rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateCryptologistState(s)).toBe(true);
  });

  it('requires four separate one-AP jobs for this bottle, then actually charges 210', () => {
    const s = taught(), bottle = s.cryptologist.bottles[0]!, ctx = context(s);
    for (let index = 0; index < 4; index++) {
      applyCryptologistCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9760, 38 - index]);
      expect(projectCryptologist(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(CRYPTOLOGIST_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectCryptologist(s).actions.find(a => a.id === `buy-${CRYPTOLOGIST_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([0, 35, 'PLAYER']);
    expect(validateCryptologistState(s)).toBe(true);
  });

  it('allows early preparation but requires 100 S8 acting and eight whole S8 weeks', () => {
    const s = swindler(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
    s.week = 18; s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
    s.week = 19; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.swindler.promotionWeek, s.cryptologist.promotionWeek]).toEqual([7, 5, 11, 19]);
    expect(validateCryptologistState(s)).toBe(true);
  });

  it('retains held originals after success and prevents repeat acquisition or promotion', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
    expect(s.cryptologist.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: CRYPTOLOGIST_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: CRYPTOLOGIST_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectCryptologist(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateCryptologistState(s)).toBe(true);
  });

  it.each([
    ['wrong pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['still S9', (s: SliceState) => { s.progression.sequence = 9; }],
    ['unknown mentor', (s: SliceState) => { s.marauder.discovered = false; }],
    ['missing S9 guidance', (s: SliceState) => { s.marauder.guidanceKnown = false; }],
    ['missing S8 guidance', (s: SliceState) => { s.swindler.guidanceKnown = false; }],
    ['missing S8 promotion', (s: SliceState) => { s.swindler.promotionWeek = null; }],
    ['away from Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['open event', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }], ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects consumption without mutation when %s', (_label, mutate) => {
    const s = prepared(); mutate(s); rejected(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-AP payment and confirmation while charging instruction and labour', () => {
    const s = swindler(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
    expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });
});

describe('four-tier S7 promotion preserves S9/S8 and recoverable failure', () => {
  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s using one will18 check without a death draw', (roll, tier, mentalCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery };
    const old = inherited(s), ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    const chance = projectCryptologist(s).bottles[0]!.chance;
    applyCryptologistCommand(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance });
    expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 18, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.cryptologist.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 21, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['error', success ? 7 : 8, 5, success ? 0 : 100]);
    expect([s.cryptologist.promotionWeek, s.cryptologist.swindlerActingAtPromotion]).toEqual(success ? [21, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE'); expect(inherited(s)).toBe(old);
    for (const id of inheritedIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    for (const [stat, increase] of [['physique', 1], ['perception', 2], ['will', 1], ['knowledge', 3]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...inheritedIds, ...CRYPTOLOGIST_ABILITY_IDS] : inheritedIds);
    if (success) {
      expect(s.progression.mastery['error.s7.decryption']).toBe(0);
      expect(projectSliceState(s).maxSpirituality).toBe(60);
      expect(projectCryptologist(s).abilities).toEqual(CRYPTOLOGIST_ABILITIES.map(a => ({ ...a, mastery: 0 })));
    } else expect(projectCryptologist(s).abilities).toEqual([]);
    expect(validateCryptologistState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps attributes and grants only one new decryption ability', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(CRYPTOLOGIST_ABILITY_IDS).toEqual(['error.s7.decryption']);
    expect(Object.keys(s.progression.mastery)).toEqual([...inheritedIds, 'error.s7.decryption']);
  });

  it('caps rejection at100 and requires recovery after severe failure before the next bottle', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: CRYPTOLOGIST_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    expect(validateCryptologistState(s)).toBe(true);
  });
});

describe('finite cross-week S7 resupply', () => {
  it('requires exhausted failed originals, one request AP, a later week, and fresh payment', () => {
    const s = exhausted(), originals = JSON.stringify(s.cryptologist.bottles), old = inherited(s);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectCryptologist(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 1; const cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.cryptologist.resupply.requestedWeek]).toEqual([0, cash, 21]);
    expect(s.cryptologist.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(projectCryptologist(s).actions.find(a => a.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    expect(validateCryptologistState(s)).toBe(true);
    s.week = 22; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(s.cryptologist.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.cryptologist.bottles.slice(0, 3))).toBe(originals); expect(inherited(s)).toBe(old);
    expect(s.cryptologist.bottles.slice(3).map(b => b.id)).toEqual(['cryptologist-potion-4', 'cryptologist-potion-5', 'cryptologist-potion-6']);
    expect(s.cryptologist.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第22周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'cryptologist-potion-4', confirmed: true });
    expect(validateCryptologistState(clone(s))).toBe(true);
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: 'cryptologist-potion-4' });
    buy(s, 3); expect([s.actionsRemaining, s.cash]).toEqual([0, cash - 210]);
    apply(s, { type: 'CONSUME', bottleId: 'cryptologist-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.swindler.promotionWeek, s.cryptologist.promotionWeek]).toEqual([5, 11, 22]);
    expect(JSON.stringify(s.cryptologist.bottles.slice(0, 3))).toBe(originals);
    expect(validateCryptologistState(s)).toBe(true);
  });

  it('cannot refill automatically or transfer prior sequence labour or bottle ownership', () => {
    for (const s of [ordinary(), swindler(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10; expect(s.cryptologist.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' }); s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash; buy(s, 3); expect(s.cash).toBe(cash - 2010);
    expect(validateCryptologistState(s)).toBe(true);
  });
});

describe('Cryptologist exact command and save boundaries', () => {
  it('validates every payload, including exact inherited RETURN_TOOL, without classifying it as acquisition', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'cryptologist-potion-1' }, { type: 'BUY_POTION', bottleId: 'cryptologist-potion-999' },
      { type: 'CONSUME', bottleId: 'cryptologist-potion-1', confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' }, { type: 'RETURN_TOOL' },
      ...CRYPTOLOGIST_CASE_IDS.flatMap(caseId => ['OBSERVE', 'PERFORM', 'WITHDRAW'].map(type => ({ type, caseId }))),
      ...CRYPTOLOGIST_CASE_IDS.flatMap(caseId => ['DECRYPT', 'PLAIN'].map(method => ({ type: 'PREPARE', caseId, method }))),
      ...CRYPTOLOGIST_CASE_IDS.flatMap(caseId => ['LIMITED', 'CERTAIN'].map(conclusion => ({ type: 'REPORT', caseId, conclusion }))),
    ];
    for (const command of [...acquisition, ...activities]) {
      expect(validateCryptologistCommand(command)).toBe(true);
      expect(isCryptologistAcquisitionCommand(command)).toBe(acquisition.includes(command));
    }
    for (const command of activities) rejected(prepared(), command);
    expect(isCryptologistAcquisitionCommand(null)).toBe(false);
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 }, { type: 'BUY_POTION' },
    { type: 'POTION_WORK', bottleId: 'swindler-potion-1' }, { type: 'BUY_POTION', bottleId: 'cryptologist-potion-0' },
    { type: 'BUY_POTION', bottleId: 'cryptologist-potion-01' }, { type: 'BUY_POTION', bottleId: 'cryptologist-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'cryptologist-potion-1' }, { type: 'CONSUME', bottleId: 'cryptologist-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'cryptologist-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: '__proto__', method: 'PLAIN' },
    { type: 'PREPARE', caseId: 'ledger-sequence' }, { type: 'PREPARE', caseId: 'ledger-sequence', method: 'MEMORY' },
    { type: 'PERFORM', caseId: 'ledger-sequence', method: 'DECRYPT' }, { type: 'REPORT', caseId: 'ledger-sequence' },
    { type: 'REPORT', caseId: 'ledger-sequence', conclusion: 'LIMITED', eraseMemory: true },
    { type: 'REPORT', caseId: 'ledger-sequence', conclusion: 'ALL_KNOWN' }, { type: 'DISCLOSE', caseId: 'ledger-sequence' },
    { type: 'WITHDRAW' }, { type: 'REFLECT', caseId: 'ledger-sequence' }, { type: 'RETURN_TOOL', free: true },
  ])('rejects malformed command %j without mutation', command => {
    expect(validateCryptologistCommand(command)).toBe(false); rejected(prepared(), command);
  });

  it('rejects bottle identity, source, work credit, chronology and inherited mastery forgery', () => {
    const s = promoted();
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.cryptologist.bottles[0]!.id = 'swindler-potion-1'; }, x => { x.cryptologist.bottles[0]!.source = 'invented'; },
      x => { x.cryptologist.bottles[0]!.labourSteps = 5; }, x => { x.cryptologist.bottles[0]!.acquiredWeek = 10; },
      x => { x.cryptologist.bottles[0]!.consumedWeek = 20; }, x => { x.cryptologist.bottles[0]!.consumedWeek = 22; },
      x => { x.cryptologist.bottles[0]!.outcome = 'FAILURE'; }, x => { x.cryptologist.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.cryptologist.bottles[1]!.acquiredWeek = 21; }, x => { x.cryptologist.promotionWeek = 20; },
      x => { x.cryptologist.swindlerActingAtPromotion = 99; }, x => { x.swindler.promotionWeek = 14; },
      x => { x.cryptologist.guidanceKnown = false; }, x => { delete x.progression.mastery[MARAUDER_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[SWINDLER_ABILITY_IDS[0]]; }, x => { delete x.progression.mastery[CRYPTOLOGIST_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[CRYPTOLOGIST_ABILITY_IDS[0]] = 501; }, x => { x.progression.mastery['error.s6.ability-theft'] = 0; },
      x => { x.cryptologist.bottles.push({ ...x.cryptologist.bottles[0]! }); }, x => { delete x.cryptologist.cases['marked-rubbing']; },
      x => { (x.cryptologist as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateCryptologistState(bad)).toBe(false); }
  });

  it('rejects same-week or mixed-batch receipts and resurrected exhausted originals', () => {
    const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.cryptologist.resupply.deliveries = 0; }, x => { x.cryptologist.resupply.deliveries = 2; },
      x => { x.cryptologist.bottles[3]!.id = 'cryptologist-potion-7'; },
      x => { x.cryptologist.bottles[3]!.source = x.cryptologist.bottles[3]!.source.replace('第22周实收入库', '第21周实收入库'); },
      x => { x.week = 23; x.cryptologist.bottles[4]!.source = x.cryptologist.bottles[4]!.source.replace('第22周实收入库', '第23周实收入库'); },
      x => { x.cryptologist.bottles[0]!.status = 'PLAYER'; x.cryptologist.bottles[0]!.outcome = null; x.cryptologist.bottles[0]!.consumedWeek = null; },
      x => { x.cryptologist.bottles[3]!.status = 'PLAYER'; x.cryptologist.bottles[3]!.acquiredWeek = 21; },
      x => { x.cryptologist.resupply.requestedWeek = 22; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateCryptologistState(bad)).toBe(false); }
    const pending = exhausted(); apply(pending, { type: 'REQUEST_SUPPLY' }); pending.cryptologist.resupply.requestedWeek = 20;
    expect(validateCryptologistState(pending)).toBe(false);
  });

  it('rejects malformed state without throwing and pre-promotion activity claims', () => {
    const s = ordinary();
    for (const raw of [null, [], {}, { ...s.cryptologist, bottles: [null, null, null] }, { ...s.cryptologist, cases: null }]) {
      const bad = clone(s); bad.cryptologist = raw as unknown as SliceState['cryptologist'];
      expect(validateCryptologistState(bad)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.cryptologist.guidanceKnown = true; }, (x: SliceState) => { x.cryptologist.reflected = true; },
      (x: SliceState) => { x.cryptologist.cases['ledger-sequence']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.progression.mastery[CRYPTOLOGIST_ABILITY_IDS[0]] = 0; },
    ]) { const bad = clone(s); mutate(bad); expect(validateCryptologistState(bad)).toBe(false); }
    const ready = promoted(), original = ready.cryptologist.cases['ledger-sequence']!;
    for (const raw of [null, {}, { ...original, unknown: true }, { ...original, status: 'OMNISCIENT' }, { ...original, method: 'PAST' }, { ...original, outcome: 'ALL_KNOWN' }, { ...original, withdrawals: -1 }, { ...original, attemptWeek: 20 }, { ...original, attemptWeek: 22 }]) {
      const bad = clone(ready); bad.cryptologist.cases['ledger-sequence'] = raw as unknown as SliceState['cryptologist']['cases'][string];
      expect(validateCryptologistState(bad)).toBe(false);
    }
    ready.cryptologist.cases['ledger-sequence'] = { status: 'EXAMINED', method: 'DECRYPT', attemptWeek: 21, withdrawals: 1, outcome: 'ORDER_CORRECTED' };
    expect(validateCryptologistState(ready)).toBe(true);
  });

  it('separates canon from G and exposes no invented formula, secret pool, or power theft', () => {
    expect(CRYPTOLOGIST_ABILITIES.map(a => a.id)).toEqual(['error.s7.decryption']);
    expect(CRYPTOLOGIST_ABILITIES[0]!.description).toMatch(/实际接触.+已有经历/);
    expect(CRYPTOLOGIST_ABILITIES[0]!.description).toMatch(/不能看见未经历的过去/);
    expect(CRYPTOLOGIST_SOURCE_STATUS).toMatch(/第三部第215章/);
    expect(CRYPTOLOGIST_SOURCE_STATUS).toMatch(/第五部第35章/);
    expect(CRYPTOLOGIST_SOURCE_STATUS).toMatch(/第五部第85章/);
    expect(CRYPTOLOGIST_SOURCE_STATUS).toMatch(/不开放序列6盗火人/);
    expect(projectCryptologist(promoted())).toMatchObject({ formulaKnown: false, formula: [], cases: [], environment: '' });
    expect(projectCryptologist(promoted())).not.toHaveProperty('secretPool');
  });
});
