import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySavantCommand } from '../../src/domain/savant/index.js';
import { SAVANT_ABILITY_IDS } from '../../src/domain/savant/types.js';
import { applyArchaeologistCommand } from '../../src/domain/archaeologist/index.js';
import { ARCHAEOLOGIST_ABILITY_IDS } from '../../src/domain/archaeologist/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyAppraiserCommand, createAppraiserState, isAppraiserAcquisitionCommand,
  projectAppraiser, validateAppraiserCommand, validateAppraiserState,
} from '../../src/domain/appraiser/index.js';
import { APPRAISER_ABILITIES, APPRAISER_BOTTLE_IDS, APPRAISER_FORMULA_STATUS, APPRAISER_LABOUR_TASKS } from '../../src/domain/appraiser/content.js';
import { APPRAISER_ABILITY_IDS, APPRAISER_ITEM_IDS, type AppraiserAcquisitionCommand } from '../../src/domain/appraiser/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = APPRAISER_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('appraiser-acquisition', sliceDefaultCreationSelection, 'appraiser-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.appraiser = createAppraiserState();
  return s;
}
function context(s: SliceState, checkRoll = 20) {
  const checks: [PublicCoreStatKey, number][] = [], notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll(min) { return min; },
    check(ability, difficulty) {
      checks.push([ability, difficulty]);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll });
      s.lastCheck = result;
      return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, notes };
}
function archaeologist(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applySavantCommand(s, { type: 'DISCOVER' }, c);
  applySavantCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applySavantCommand(s, { type: 'BUY_POTION', bottleId: s.savant.bottles[0]!.id }, c);
  applySavantCommand(s, { type: 'CONSUME', bottleId: s.savant.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyArchaeologistCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyArchaeologistCommand(s, { type: 'BUY_POTION', bottleId: s.archaeologist.bottles[0]!.id }, c);
  applyArchaeologistCommand(s, { type: 'CONSUME', bottleId: s.archaeologist.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SAVANT_ABILITY_IDS, ...ARCHAEOLOGIST_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: AppraiserAcquisitionCommand, roll = 20) { applyAppraiserCommand(s, command, context(s, roll).c); }
function taught(s = archaeologist()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.appraiser.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.appraiser.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as AppraiserAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('appraiser S7 independent finished-potion acquisition', () => {
  it('creates three sourced independent bottles and untouched item cases', () => {
    const s = ordinary(), other = createAppraiserState();
    expect(validateAppraiserState(s)).toBe(true);
    expect(s.appraiser.bottles.map(bottle => bottle.id)).toEqual([...APPRAISER_BOTTLE_IDS]);
    expect(s.appraiser.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.appraiser).toMatchObject({ reflected: false, promotionWeek: null, archaeologistActingAtPromotion: null });
    expect(Object.keys(s.appraiser.cases)).toEqual([...APPRAISER_ITEM_IDS]);
    for (const id of APPRAISER_ITEM_IDS) expect(s.appraiser.cases[id]).toEqual({ status: 'AVAILABLE', attemptWeek: null, identifiedWeek: null, method: null, uses: 0 });
    other.bottles[0]!.labourSteps = 4; other.cases['echo-brooch'].uses = 1;
    expect([s.appraiser.bottles[0]!.labourSteps, s.appraiser.cases['echo-brooch'].uses]).toEqual([0, 0]);
  });

  it('hides the future channel and rejects route skipping', () => {
    const s = ordinary(), p = projectAppraiser(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], items: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/appraiser-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const savant = archaeologist(); savant.progression.sequence = 9;
    rejected(savant, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without a full recipe or lower-state changes', () => {
    const s = archaeologist(), old = [JSON.stringify(s.savant), JSON.stringify(s.archaeologist), JSON.stringify(s.progression)];
    expect(projectAppraiser(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.appraiser.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectAppraiser(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectAppraiser(s).supplies).toContain(APPRAISER_FORMULA_STATUS);
    expect(projectAppraiser(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.savant), JSON.stringify(s.archaeologist), JSON.stringify(s.progression)]).toEqual(old);
    expect(validateAppraiserState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original once', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.appraiser.bottles.slice(1));
    expect(buy(s)).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect([s.cash, s.actionsRemaining, JSON.stringify(s.appraiser.bottles.slice(1))]).toEqual([7750, ap, others]);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    expect(validateAppraiserState(s)).toBe(true);
  });

  it('only four real jobs on the selected bottle waive 1800 pence, never a partial refund', () => {
    for (const count of [1, 2, 3, 4]) {
      const s = taught(), ctx = context(s);
      for (let i = 0; i < count; i += 1) applyAppraiserCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.appraiser.bottles[0]!.labourSteps]).toEqual([9760, 39 - count, count]);
      expect(ctx.notes.map(note => note.title)).toEqual(APPRAISER_LABOUR_TASKS.slice(0, count).map(task => `完成${task}`));
      expect(projectAppraiser(s).actions.find(action => action.id === `buy-${APPRAISER_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
      if (count === 4) rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      buy(s);
      expect(s.cash).toBe(count === 4 ? 9550 : 7750);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash, foreign originals and forged confirmations without mutation', () => {
    const s = archaeologist(); s.cash = 239; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['savant-potion-1', 'archaeologist-potion-1', 'appraiser-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'CONSUME', bottleId: APPRAISER_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('permits early preparation but requires S8 acting 100 and eight whole weeks since S8', () => {
    const s = archaeologist(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command); s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectAppraiser(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.archaeologist.promotionWeek, s.appraiser.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.appraiser.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validateAppraiserState(s)).toBe(true);
  });

  it('resolves all four will-18 tiers with real original consumption and recoverable guided costs', () => {
    for (const [roll, tier, sequence, mind, health, pollution] of [
      [1, 'GREAT_SUCCESS', 7, 95, 100, 0], [20, 'SUCCESS', 7, 90, 100, 0],
      [80, 'FAILURE', 8, 80, 90, 25], [99, 'GREAT_FAILURE', 8, 60, 80, 50],
    ] as const) {
      const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
      applyAppraiserCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]);
      expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
      expect(s.appraiser.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect(validateAppraiserState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('inherits all six old masteries, resets only S7 acting, and raises the cap without a refill', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const old = [JSON.stringify(s.savant), JSON.stringify(s.archaeologist), JSON.stringify(s.caseArchive)];
    s.spirituality = 9; consume(s);
    expect([s.appraiser.archaeologistActingAtPromotion, s.progression.acting, s.spirituality]).toEqual([100, 0, 9]);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(APPRAISER_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique + 1, perception: stats.perception + 3, will: stats.will + 1, knowledge: stats.knowledge + 3 });
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.savant), JSON.stringify(s.archaeologist), JSON.stringify(s.caseArchive)]).toEqual(old);
    expect(projectAppraiser(s).abilities.map(ability => ability.id)).toEqual([...APPRAISER_ABILITY_IDS]);
    const capped = prepared(); capped.character.coreStats = { physique: 500, perception: 499, will: 500, knowledge: 499 }; consume(capped, 1);
    expect(capped.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
  });

  it('blocks unavailable bodies, routes, locations, runs and ongoing events or combat', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.savant.discovered = false; },
      s => { s.savant.guidanceKnown = false; }, s => { s.archaeologist.guidanceKnown = false; }, s => { s.archaeologist.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.combat = {} as NonNullable<SliceState['combat']>; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }); }
  });

  it('requires AP for guidance and labour but allows purchase and consumption at zero AP', () => {
    const s = archaeologist(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s); expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it('retains a failed original and old progression, then preserves spare originals after successful recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.appraiser.promotionWeek, s.appraiser.archaeologistActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100; buy(s, 1); buy(s, 2); consume(s, 20, 1);
    expect(s.appraiser.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'GREAT_FAILURE'], ['CONSUMED', 'SUCCESS'], ['PLAYER', null]]);
    expect(s.seer.pollution).toBe(50);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: APPRAISER_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: APPRAISER_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: APPRAISER_BOTTLE_IDS[2], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectAppraiser(s).actions.every(action => !action.enabled)).toBe(true);
    expect(validateAppraiserState(s)).toBe(true);
  });

  it('only restocks after all three failures and a real later week, keeping old bottles and all prices', () => {
    const s = taught(); rejected(s, { type: 'REQUEST_SUPPLY' });
    for (let index = 0; index < 3; index += 1) {
      buy(s, index); consume(s, 80, index);
      if (index < 2) rejected(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = JSON.stringify(s.appraiser.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.appraiser.bottles.length, s.appraiser.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.appraiser.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.appraiser.resupply.deliveries, s.appraiser.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.appraiser.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['appraiser-potion-4', 'SUPPLIER', 0], ['appraiser-potion-5', 'SUPPLIER', 0], ['appraiser-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectAppraiser(s).actions.find(action => action.id === 'buy-appraiser-potion-4')!.cost).toContain('2010便士');
    expect(validateAppraiserState(s)).toBe(true); rejected(s, { type: 'RECEIVE_SUPPLY' });
    const bad = clone(s); bad.appraiser.bottles[3]!.source = bad.appraiser.bottles[3]!.source.replace('第20周', '第19周');
    expect(validateAppraiserState(bad)).toBe(false);
  });

  it('rejects malformed stock, duplicate success, chronology and incomplete inherited abilities on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.appraiser.bottles[0]!.id = 'archaeologist-potion-1'; }, s => { s.appraiser.bottles[0]!.source = 'unsourced'; },
      s => { s.appraiser.bottles[1]!.labourSteps = 5; }, s => { s.appraiser.promotionWeek = 18; },
      s => { s.appraiser.archaeologistActingAtPromotion = 99; }, s => { delete s.progression.mastery[SAVANT_ABILITY_IDS[0]]; },
      s => { delete s.progression.mastery[ARCHAEOLOGIST_ABILITY_IDS[0]]; },
      s => { s.appraiser.cases['echo-brooch'].attemptWeek = 18; }, s => { s.appraiser.cases['warm-lamp'].identifiedWeek = 18; },
      s => { s.appraiser.cases['needle-box'].uses = -1; },
      s => { s.appraiser.bottles[1] = { ...s.appraiser.bottles[0]!, id: APPRAISER_BOTTLE_IDS[1], source: s.appraiser.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateAppraiserState(bad)).toBe(false); }
    const bad = clone(s); (bad.appraiser.bottles as unknown[])[0] = null; expect(validateAppraiserState(bad)).toBe(false);
    const beforePromotion = archaeologist(); beforePromotion.appraiser.cases['echo-brooch'].status = 'EXAMINED';
    expect(validateAppraiserState(beforePromotion)).toBe(false);
  });

  it('separates command boundaries and exposes only the three bounded G mastery tracks and real risk', () => {
    expect(isAppraiserAcquisitionCommand({ type: 'BUY_POTION', bottleId: FIRST_BOTTLE })).toBe(true);
    expect(isAppraiserAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    expect(validateAppraiserCommand({ type: 'REFLECT' })).toBe(true);
    for (const type of ['EXAMINE', 'IDENTIFY', 'TEST', 'REPORT']) {
      expect(validateAppraiserCommand({ type, itemId: 'echo-brooch' })).toBe(true);
      expect(isAppraiserAcquisitionCommand({ type, itemId: 'echo-brooch' })).toBe(false);
    }
    for (const bad of [
      { type: 'IDENTIFY', itemId: 'unknown' }, { type: 'EXAMINE', caseId: 'echo-brooch' },
      { type: 'TEST', itemId: 'echo-brooch', free: true }, { type: 'REPORT', itemId: 'needle-box', method: 'REPORT' },
      { type: 'REFLECT', free: true }, { type: 'COPY_ENEMY' }, { type: 'CRAFT_SUPERNATURAL' },
    ]) expect(validateAppraiserCommand(bad)).toBe(false);
    const s = prepared(), p = projectAppraiser(s);
    rejected(s, { type: 'EXAMINE', itemId: 'echo-brooch' });
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p.risk).toContain('本作G游戏平衡'); expect(p.risk).toContain('意志难度18');
    expect(APPRAISER_ABILITIES.map(ability => ability.id)).toEqual([...APPRAISER_ABILITY_IDS]);
    expect(APPRAISER_ABILITIES[0]!.description).toContain('大多数');
    expect(APPRAISER_ABILITIES[0]!.description).toContain('不会解析或复制敌人的能力');
    expect(APPRAISER_ABILITIES[1]!.description).toContain('不保证发现全部隐患');
    expect(APPRAISER_ABILITIES[2]!.description).toContain('不能免疫副作用');
    expect(APPRAISER_ABILITIES[2]!.description).toContain('不提前获得序列6');
    expect(p.formula).toEqual([]);
  });
});
