import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyWarriorCommand } from '../../src/domain/warrior/index.js';
import { applyWarriorActivity } from '../../src/domain/warrior/life.js';
import { WARRIOR_ABILITY_IDS, WARRIOR_CASE_IDS } from '../../src/domain/warrior/types.js';
import { applyGladiatorCommand } from '../../src/domain/gladiator/index.js';
import { applyGladiatorActivity } from '../../src/domain/gladiator/life.js';
import { GLADIATOR_ABILITY_IDS, GLADIATOR_CASE_IDS } from '../../src/domain/gladiator/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyWeaponmasterCommand, createWeaponmasterState, isWeaponmasterAcquisitionCommand,
  projectWeaponmaster, validateWeaponmasterCommand, validateWeaponmasterState,
} from '../../src/domain/weaponmaster/index.js';
import {
  WEAPONMASTER_ABILITIES, WEAPONMASTER_BOTTLE_IDS, WEAPONMASTER_FORMULA_STATUS,
  WEAPONMASTER_GUIDE, WEAPONMASTER_LABOUR_TASKS, WEAPONMASTER_SOURCE_STATUS,
} from '../../src/domain/weaponmaster/content.js';
import { WEAPONMASTER_ABILITY_IDS, WEAPONMASTER_CASE_IDS, type WeaponmasterAcquisitionCommand } from '../../src/domain/weaponmaster/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const inheritedIds = [...WARRIOR_ABILITY_IDS, ...GLADIATOR_ABILITY_IDS];
function ordinary(): SliceState {
  const s = createSliceRun('weaponmaster-acquisition', sliceDefaultCreationSelection, 'weaponmaster-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 10000;
  s.actionsRemaining = 40; s.weeklyBudget = 40; s.character.coreStats.will = 15;
  s.weaponmaster = createWeaponmasterState();
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
function gladiator(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyWarriorCommand(s, { type: 'DISCOVER' }, c);
  applyWarriorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyWarriorCommand(s, { type: 'BUY_POTION', bottleId: s.warrior.bottles[0]!.id }, c);
  applyWarriorCommand(s, { type: 'CONSUME', bottleId: s.warrior.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source); s.progression.mastery[WARRIOR_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of WARRIOR_CASE_IDS) {
    applyWarriorActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyWarriorActivity(s, { type: 'PREPARE', caseId, method: 'TEAM' }, c, award);
    applyWarriorActivity(s, { type: 'PERFORM', caseId }, c, award);
    if (caseId === 'staff-drill') applyWarriorActivity(s, { type: 'RETURN_TOOL' }, c, award);
    applyWarriorActivity(s, { type: 'REPORT', caseId }, c, award);
  }
  applyWarriorActivity(s, { type: 'REFLECT' }, c, award);
  s.week = 11;
  applyGladiatorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyGladiatorCommand(s, { type: 'BUY_POTION', bottleId: s.gladiator.bottles[0]!.id }, c);
  applyGladiatorCommand(s, { type: 'CONSUME', bottleId: s.gladiator.bottles[0]!.id, confirmed: true }, c);
  for (const caseId of GLADIATOR_CASE_IDS) {
    applyGladiatorActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyGladiatorActivity(s, { type: 'PREPARE', caseId, method: 'TEAM' }, c, award);
    applyGladiatorActivity(s, { type: 'PERFORM', caseId }, c, award);
    applyGladiatorActivity(s, { type: 'REPORT', caseId }, c, award);
  }
  applyGladiatorActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(inheritedIds.map((id, index) => [id, index * 25]));
  s.week = 21; s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: WeaponmasterAcquisitionCommand, roll = 20) { applyWeaponmasterCommand(s, command, context(s, roll).c); }
function taught(s = gladiator()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.weaponmaster.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index++) {
    const bottle = buy(s, index); apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
  }
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as WeaponmasterAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;
const inherited = (s: SliceState) => JSON.stringify([s.warrior, s.gladiator, s.seer.completedSources]);

describe('independent Weaponmaster original-potion acquisition', () => {
  it('starts with three sealed S7 originals and hides all unearned supply', () => {
    const s = ordinary(), p = projectWeaponmaster(s);
    expect(validateWeaponmasterState(s)).toBe(true);
    expect(s.weaponmaster.bottles.map(b => b.id)).toEqual([...WEAPONMASTER_BOTTLE_IDS]);
    expect(s.weaponmaster.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, promoted: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], cases: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/weaponmaster-potion|1800|2010/);
    expect(Object.keys(s.weaponmaster)).toEqual(['guidanceKnown', 'bottles', 'resupply', 'promotionWeek', 'gladiatorActingAtPromotion', 'cases', 'reflected']);
    expect(Object.keys(s.weaponmaster.cases)).toEqual([...WEAPONMASTER_CASE_IDS]);
    expect(Object.values(s.weaponmaster.cases)).toEqual(Array.from({ length: 3 }, () => ({ status: 'AVAILABLE', attemptWeek: null, method: null, withdrawals: 0, outcome: 'NONE' })));
    const separate = createWeaponmasterState();
    separate.bottles[0]!.labourSteps = 4; separate.cases['weapon-fit']!.status = 'OBSERVED';
    expect(s.weaponmaster.bottles[0]!.labourSteps).toBe(0);
    expect(s.weaponmaster.cases['weapon-fit']!.status).toBe('AVAILABLE');
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('uses the existing mentor, charges 240 and one AP, and preserves prior facts', () => {
    const s = gladiator(), prior = inherited(s), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    expect(WEAPONMASTER_GUIDE).toContain('奥斯温·布莱克特');
    expect(projectWeaponmaster(s).actions.map(a => a.command.type)).toEqual(['LEARN_GUIDANCE']);
    expect(projectWeaponmaster(s).bottles.every(b => b.source.includes('新兵器训练成品') && b.source.includes('序列7') && b.source.includes('本作G'))).toBe(true);
    rejected(s, { type: 'BUY_POTION', bottleId: WEAPONMASTER_BOTTLE_IDS[0] });
    rejected(s, { type: 'POTION_WORK', bottleId: WEAPONMASTER_BOTTLE_IDS[0] });
    applyWeaponmasterCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.weaponmaster.guidanceKnown]).toEqual([9760, 39, true]);
    expect([inherited(s), JSON.stringify(s.progression), JSON.stringify(s.world)]).toEqual([prior, progression, world]);
    expect(projectWeaponmaster(s).supplies).toContain(WEAPONMASTER_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('不是原来的格斗家存药');
    expect(validateWeaponmasterState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 2010 and zero AP for the selected original without partial discounts', () => {
    const s = taught(), prior = inherited(s), others = JSON.stringify(s.weaponmaster.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: WEAPONMASTER_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([7750, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 21, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.weaponmaster.bottles.slice(1))).toBe(others); expect(inherited(s)).toBe(prior);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id }); rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateWeaponmasterState(s)).toBe(true);
  });

  it('requires four separate one-AP jobs for this bottle, then actually charges 210', () => {
    const s = taught(), bottle = s.weaponmaster.bottles[0]!, ctx = context(s);
    for (let index = 0; index < 4; index++) {
      applyWeaponmasterCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
      expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([index + 1, 'SUPPLIER', 9760, 38 - index]);
      expect(projectWeaponmaster(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain(`${index === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(WEAPONMASTER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectWeaponmaster(s).actions.find(a => a.id === `buy-${WEAPONMASTER_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([0, 35, 'PLAYER']);
    expect(validateWeaponmasterState(s)).toBe(true);
  });

  it('allows early preparation but requires 100 S8 acting and eight whole S8 weeks', () => {
    const s = gladiator(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
    s.week = 18; s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
    s.week = 19; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.gladiator.promotionWeek, s.weaponmaster.promotionWeek]).toEqual([7, 5, 11, 19]);
    expect(validateWeaponmasterState(s)).toBe(true);
  });

  it('retains held originals after success and prevents repeat acquisition or promotion', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
    expect(s.weaponmaster.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: WEAPONMASTER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: WEAPONMASTER_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectWeaponmaster(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateWeaponmasterState(s)).toBe(true);
  });

  it.each([
    ['wrong pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['still S9', (s: SliceState) => { s.progression.sequence = 9; }],
    ['unknown mentor', (s: SliceState) => { s.warrior.discovered = false; }],
    ['missing S9 guidance', (s: SliceState) => { s.warrior.guidanceKnown = false; }],
    ['missing S8 guidance', (s: SliceState) => { s.gladiator.guidanceKnown = false; }],
    ['missing S8 promotion', (s: SliceState) => { s.gladiator.promotionWeek = null; }],
    ['away from Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['open event', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }], ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects consumption without mutation when %s', (_label, mutate) => {
    const s = prepared(); mutate(s); rejected(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
  });

  it('allows zero-AP payment and confirmation while charging instruction and labour', () => {
    const s = gladiator(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: WEAPONMASTER_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
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
    const chance = projectWeaponmaster(s).bottles[0]!.chance;
    applyWeaponmasterCommand(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance });
    expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 18, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution]).toEqual([100 - mentalCost, 100 - healthCost, pollution]);
    expect([s.cash, s.actionsRemaining, s.spirituality]).toEqual([cash, ap, 7]);
    expect(s.weaponmaster.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 21, outcome: tier });
    expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['warrior', success ? 7 : 8, 5, success ? 0 : 100]);
    expect([s.weaponmaster.promotionWeek, s.weaponmaster.gladiatorActingAtPromotion]).toEqual(success ? [21, 100] : [null, null]);
    expect(s.status).toBe('ACTIVE'); expect(inherited(s)).toBe(old);
    for (const id of inheritedIds) expect(s.progression.mastery[id]).toBe(mastery[id]);
    for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 2], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
    expect(Object.keys(s.progression.mastery)).toEqual(success ? [...inheritedIds, ...WEAPONMASTER_ABILITY_IDS] : inheritedIds);
    if (success) {
      expect(s.progression.mastery['warrior.s7.weapons']).toBe(0);
      expect(s.progression.mastery['warrior.s7.weak-point']).toBe(0);
      expect(projectSliceState(s).maxSpirituality).toBe(60);
      expect(projectWeaponmaster(s).abilities).toEqual(WEAPONMASTER_ABILITIES.map(a => ({ ...a, mastery: 0 })));
    } else expect(projectWeaponmaster(s).abilities).toEqual([]);
    expect(validateWeaponmasterState(clone(s))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
  });

  it('caps attributes and grants exactly two new G practice categories', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(WEAPONMASTER_ABILITY_IDS).toEqual(['warrior.s7.weapons', 'warrior.s7.weak-point']);
    expect(Object.keys(s.progression.mastery)).toEqual([...inheritedIds, ...WEAPONMASTER_ABILITY_IDS]);
  });

  it('caps rejection at100 and requires recovery after severe failure before the next bottle', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: WEAPONMASTER_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    expect(validateWeaponmasterState(s)).toBe(true);
  });
});

describe('finite cross-week S7 resupply', () => {
  it('requires exhausted failed originals, one request AP, a later week, and fresh payment', () => {
    const s = exhausted(), originals = JSON.stringify(s.weaponmaster.bottles), old = inherited(s);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectWeaponmaster(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    s.actionsRemaining = 1; const cash = s.cash;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.weaponmaster.resupply.requestedWeek]).toEqual([0, cash, 21]);
    expect(s.weaponmaster.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(projectWeaponmaster(s).actions.find(a => a.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    expect(validateWeaponmasterState(s)).toBe(true);
    s.week = 22; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect([s.actionsRemaining, s.cash]).toEqual([0, cash]);
    expect(s.weaponmaster.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.weaponmaster.bottles.slice(0, 3))).toBe(originals); expect(inherited(s)).toBe(old);
    expect(s.weaponmaster.bottles.slice(3).map(b => b.id)).toEqual(['weaponmaster-potion-4', 'weaponmaster-potion-5', 'weaponmaster-potion-6']);
    expect(s.weaponmaster.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第22周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'weaponmaster-potion-4', confirmed: true });
    expect(validateWeaponmasterState(clone(s))).toBe(true);
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i++) apply(s, { type: 'POTION_WORK', bottleId: 'weaponmaster-potion-4' });
    buy(s, 3); expect([s.actionsRemaining, s.cash]).toEqual([0, cash - 210]);
    apply(s, { type: 'CONSUME', bottleId: 'weaponmaster-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.gladiator.promotionWeek, s.weaponmaster.promotionWeek]).toEqual([5, 11, 22]);
    expect(JSON.stringify(s.weaponmaster.bottles.slice(0, 3))).toBe(originals);
    expect(validateWeaponmasterState(s)).toBe(true);
  });

  it('cannot refill automatically or transfer prior sequence labour or bottle ownership', () => {
    for (const s of [ordinary(), gladiator(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10; expect(s.weaponmaster.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' }); s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const cash = s.cash; buy(s, 3); expect(s.cash).toBe(cash - 2010);
    expect(validateWeaponmasterState(s)).toBe(true);
  });
});

describe('Weaponmaster exact command and save boundaries', () => {
  it('validates every payload, including exact no-argument BORROW_TOOL and inherited RETURN_TOOL, without classifying it as acquisition', () => {
    const acquisition = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: 'weaponmaster-potion-1' }, { type: 'BUY_POTION', bottleId: 'weaponmaster-potion-999' },
      { type: 'CONSUME', bottleId: 'weaponmaster-potion-1', confirmed: true },
    ];
    const activities = [
      { type: 'REFLECT' }, { type: 'RETURN_TOOL' }, { type: 'BORROW_TOOL' },
      ...WEAPONMASTER_CASE_IDS.flatMap(caseId => ['OBSERVE', 'PERFORM', 'REPORT', 'WITHDRAW'].map(type => ({ type, caseId }))),
      ...WEAPONMASTER_CASE_IDS.flatMap(caseId => ['TECHNIQUE', 'TEAM'].map(method => ({ type: 'PREPARE', caseId, method }))),
    ];
    for (const command of [...acquisition, ...activities]) {
      expect(validateWeaponmasterCommand(command)).toBe(true);
      expect(isWeaponmasterAcquisitionCommand(command)).toBe(acquisition.includes(command));
    }
    for (const command of activities) rejected(prepared(), command);
    expect(isWeaponmasterAcquisitionCommand(null)).toBe(false);
  });

  it.each([
    null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
    { type: 'LEARN_GUIDANCE', free: true }, { type: 'REQUEST_SUPPLY', week: 2 }, { type: 'BUY_POTION' },
    { type: 'POTION_WORK', bottleId: 'gladiator-potion-1' }, { type: 'BUY_POTION', bottleId: 'weaponmaster-potion-0' },
    { type: 'BUY_POTION', bottleId: 'weaponmaster-potion-01' }, { type: 'BUY_POTION', bottleId: 'weaponmaster-potion-1000000000000000' },
    { type: 'CONSUME', bottleId: 'weaponmaster-potion-1' }, { type: 'CONSUME', bottleId: 'weaponmaster-potion-1', confirmed: false },
    { type: 'CONSUME', bottleId: 'weaponmaster-potion-1', confirmed: true, guaranteed: true },
    { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: '__proto__', method: 'TEAM' },
    { type: 'PREPARE', caseId: 'weapon-fit' }, { type: 'PREPARE', caseId: 'weapon-fit', method: 'MEMORY' },
    { type: 'PERFORM', caseId: 'weapon-fit', method: 'TECHNIQUE' }, { type: 'REPORT', caseId: 'weapon-fit', conclusion: 'LIMITED' },
    { type: 'REPORT', caseId: 'weapon-fit', conclusion: 'LIMITED', eraseMemory: true },
    { type: 'REPORT', caseId: 'weapon-fit', conclusion: 'ALL_KNOWN' }, { type: 'DISCLOSE', caseId: 'weapon-fit' },
    { type: 'WITHDRAW' }, { type: 'REFLECT', caseId: 'weapon-fit' }, { type: 'RETURN_TOOL', free: true },
    { type: 'BORROW_TOOL', caseId: 'weapon-fit' }, { type: 'BORROW_TOOL', version: 2 }, { type: 'RELEASE', caseId: 'weapon-fit' },
  ])('rejects malformed command %j without mutation', command => {
    expect(validateWeaponmasterCommand(command)).toBe(false); rejected(prepared(), command);
  });

  it('rejects bottle identity, source, work credit, chronology and inherited mastery forgery', () => {
    const s = promoted();
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.weaponmaster.bottles[0]!.id = 'gladiator-potion-1'; }, x => { x.weaponmaster.bottles[0]!.source = 'invented'; },
      x => { x.weaponmaster.bottles[0]!.labourSteps = 5; }, x => { x.weaponmaster.bottles[0]!.acquiredWeek = 10; },
      x => { x.weaponmaster.bottles[0]!.consumedWeek = 20; }, x => { x.weaponmaster.bottles[0]!.consumedWeek = 22; },
      x => { x.weaponmaster.bottles[0]!.outcome = 'FAILURE'; }, x => { x.weaponmaster.bottles[1]!.outcome = 'SUCCESS'; },
      x => { x.weaponmaster.bottles[1]!.acquiredWeek = 21; }, x => { x.weaponmaster.promotionWeek = 20; },
      x => { x.weaponmaster.gladiatorActingAtPromotion = 99; }, x => { x.gladiator.promotionWeek = 14; },
      x => { x.weaponmaster.guidanceKnown = false; }, x => { delete x.progression.mastery[WARRIOR_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[GLADIATOR_ABILITY_IDS[0]]; }, x => { delete x.progression.mastery[WEAPONMASTER_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[WEAPONMASTER_ABILITY_IDS[1]]; },
      x => { x.progression.mastery[WEAPONMASTER_ABILITY_IDS[0]] = 501; }, x => { x.progression.mastery['warrior.s6.dawn-armor'] = 0; },
      x => { x.weaponmaster.bottles.push({ ...x.weaponmaster.bottles[0]! }); }, x => { delete x.weaponmaster.cases['watch-handover']; },
      x => { (x.weaponmaster as unknown as Record<string, unknown>).formulaKnown = true; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateWeaponmasterState(bad)).toBe(false); }
  });

  it('rejects same-week or mixed-batch receipts and resurrected exhausted originals', () => {
    const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week++; apply(s, { type: 'RECEIVE_SUPPLY' });
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.weaponmaster.resupply.deliveries = 0; }, x => { x.weaponmaster.resupply.deliveries = 2; },
      x => { x.weaponmaster.bottles[3]!.id = 'weaponmaster-potion-7'; },
      x => { x.weaponmaster.bottles[3]!.source = x.weaponmaster.bottles[3]!.source.replace('第22周实收入库', '第21周实收入库'); },
      x => { x.week = 23; x.weaponmaster.bottles[4]!.source = x.weaponmaster.bottles[4]!.source.replace('第22周实收入库', '第23周实收入库'); },
      x => { x.weaponmaster.bottles[0]!.status = 'PLAYER'; x.weaponmaster.bottles[0]!.outcome = null; x.weaponmaster.bottles[0]!.consumedWeek = null; },
      x => { x.weaponmaster.bottles[3]!.status = 'PLAYER'; x.weaponmaster.bottles[3]!.acquiredWeek = 21; },
      x => { x.weaponmaster.resupply.requestedWeek = 22; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateWeaponmasterState(bad)).toBe(false); }
    const pending = exhausted(); apply(pending, { type: 'REQUEST_SUPPLY' }); pending.weaponmaster.resupply.requestedWeek = 20;
    expect(validateWeaponmasterState(pending)).toBe(false);
  });

  it('rejects malformed state without throwing and pre-promotion activity claims', () => {
    const s = ordinary();
    for (const raw of [null, [], {}, { ...s.weaponmaster, bottles: [null, null, null] }, { ...s.weaponmaster, cases: null }]) {
      const bad = clone(s); bad.weaponmaster = raw as unknown as SliceState['weaponmaster'];
      expect(validateWeaponmasterState(bad)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.weaponmaster.guidanceKnown = true; }, (x: SliceState) => { x.weaponmaster.reflected = true; },
      (x: SliceState) => { x.weaponmaster.cases['weapon-fit']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.progression.mastery[WEAPONMASTER_ABILITY_IDS[0]] = 0; },
    ]) { const bad = clone(s); mutate(bad); expect(validateWeaponmasterState(bad)).toBe(false); }
    const ready = promoted(), original = ready.weaponmaster.cases['weapon-fit']!;
    for (const raw of [null, {}, { ...original, unknown: true }, { ...original, status: 'OMNISCIENT' }, { ...original, method: 'PAST' }, { ...original, outcome: 'ALL_KNOWN' }, { ...original, withdrawals: -1 }, { ...original, attemptWeek: 20 }, { ...original, attemptWeek: 22 }]) {
      const bad = clone(ready); bad.weaponmaster.cases['weapon-fit'] = raw as unknown as SliceState['weaponmaster']['cases'][string];
      expect(validateWeaponmasterState(bad)).toBe(false);
    }
    ready.weaponmaster.cases['weapon-fit'] = { status: 'EXAMINED', method: 'TECHNIQUE', attemptWeek: 21, withdrawals: 1, outcome: 'FIT_CHECKED' };
    expect(validateWeaponmasterState(ready)).toBe(true);
  });

  it('separates canon from G, original objects, and unavailable S6 capabilities', () => {
    expect(WEAPONMASTER_ABILITIES.map(a => a.id)).toEqual(['warrior.s7.weapons', 'warrior.s7.weak-point']);
    expect(WEAPONMASTER_ABILITIES.every(a => a.description.startsWith('本作G实践分类'))).toBe(true);
    expect(WEAPONMASTER_ABILITIES[0]!.description).toContain('不自动精通所有武器');
    expect(WEAPONMASTER_ABILITIES[0]!.description).toContain('不改变借用器物所有权');
    expect(WEAPONMASTER_ABILITIES[1]!.description).toContain('不能发现不可见弱点');
    expect(WEAPONMASTER_SOURCE_STATUS).toContain('第一部第138章');
    expect(WEAPONMASTER_SOURCE_STATUS).toContain('第三部第184章约书亚的火球来自神奇手套');
    expect(WEAPONMASTER_SOURCE_STATUS).toContain('不提前开放序列6晨曦铠甲、能量长剑或光之风暴');
    expect(WEAPONMASTER_FORMULA_STATUS).toContain('完整配方尚未核实');
    const projection = projectWeaponmaster(promoted());
    expect(projection).toMatchObject({ formulaKnown: false, formula: [], cases: [], environment: '' });
    expect(projection).not.toHaveProperty('insideCase');
    expect(projection).not.toHaveProperty('secretPool');
  });
});
