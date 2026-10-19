import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyApothecaryCommand } from '../../src/domain/apothecary/index.js';
import { APOTHECARY_ABILITY_IDS } from '../../src/domain/apothecary/types.js';
import { applyTamerCommand } from '../../src/domain/tamer/index.js';
import { TAMER_ABILITY_IDS } from '../../src/domain/tamer/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyVampireCommand, createVampireState, isVampireAcquisitionCommand,
  projectVampire, validateVampireCommand, validateVampireState,
} from '../../src/domain/vampire/index.js';
import { VAMPIRE_ABILITIES, VAMPIRE_BOTTLE_IDS, VAMPIRE_FORMULA_STATUS, VAMPIRE_LABOUR_TASKS } from '../../src/domain/vampire/content.js';
import { VAMPIRE_ABILITY_IDS, VAMPIRE_PRACTICE_IDS, type VampireAcquisitionCommand } from '../../src/domain/vampire/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = VAMPIRE_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('vampire-acquisition', sliceDefaultCreationSelection, 'vampire-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.vampire = createVampireState();
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
function tamer(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyApothecaryCommand(s, { type: 'DISCOVER' }, c);
  applyApothecaryCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyApothecaryCommand(s, { type: 'BUY_POTION', bottleId: s.apothecary.bottles[0]!.id }, c);
  applyApothecaryCommand(s, { type: 'CONSUME', bottleId: s.apothecary.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyTamerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyTamerCommand(s, { type: 'BUY_POTION', bottleId: s.tamer.bottles[0]!.id }, c);
  applyTamerCommand(s, { type: 'CONSUME', bottleId: s.tamer.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...APOTHECARY_ABILITY_IDS, ...TAMER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: VampireAcquisitionCommand, roll = 20) { applyVampireCommand(s, command, context(s, roll).c); }
function taught(s = tamer()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.vampire.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.vampire.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as VampireAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('vampire S7 independent finished-potion acquisition', () => {
  it('creates three sourced independent bottles and untouched activity reserves', () => {
    const s = ordinary(), other = createVampireState();
    expect(validateVampireState(s)).toBe(true);
    expect(s.vampire.bottles.map(bottle => bottle.id)).toEqual([...VAMPIRE_BOTTLE_IDS]);
    expect(s.vampire.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.vampire).toMatchObject({ reflected: false, promotionWeek: null, tamerActingAtPromotion: null });
    expect(s.vampire).toMatchObject({
      practices: [], practiceAttempts: {},
      blood: { held: 0, bought: 0, consumed: 0, lastPurchaseWeek: null, purchasedThisWeek: 0, lastFedWeek: null },
      regenerationWeek: null, encounter: { status: 'AVAILABLE', observed: false, attemptWeek: null, startHistoryIndex: null },
    });
    other.bottles[0]!.labourSteps = 4; other.practices.push('blood-samples'); other.blood.held = 1;
    expect([s.vampire.bottles[0]!.labourSteps, s.vampire.practices.length, s.vampire.blood.held]).toEqual([0, 0, 0]);
  });

  it('hides the future channel and rejects route skipping', () => {
    const s = ordinary(), p = projectVampire(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], practices: [], environment: '', bloodSummary: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/vampire-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const apothecary = tamer(); apothecary.progression.sequence = 9;
    rejected(apothecary, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without a full recipe or lower-state changes', () => {
    const s = tamer(), old = [JSON.stringify(s.apothecary), JSON.stringify(s.tamer), JSON.stringify(s.progression)];
    expect(projectVampire(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.vampire.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectVampire(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectVampire(s).supplies).toContain(VAMPIRE_FORMULA_STATUS);
    expect(projectVampire(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.apothecary), JSON.stringify(s.tamer), JSON.stringify(s.progression)]).toEqual(old);
    expect(validateVampireState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original once', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.vampire.bottles.slice(1));
    expect(buy(s)).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect([s.cash, s.actionsRemaining, JSON.stringify(s.vampire.bottles.slice(1))]).toEqual([7750, ap, others]);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    expect(validateVampireState(s)).toBe(true);
  });

  it('only four real jobs on the selected bottle waive 1800 pence, never a partial refund', () => {
    for (const count of [1, 2, 3, 4]) {
      const s = taught(), ctx = context(s);
      for (let i = 0; i < count; i += 1) applyVampireCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.vampire.bottles[0]!.labourSteps]).toEqual([9760, 39 - count, count]);
      expect(ctx.notes.map(note => note.title)).toEqual(VAMPIRE_LABOUR_TASKS.slice(0, count).map(task => `完成${task}`));
      expect(projectVampire(s).actions.find(action => action.id === `buy-${VAMPIRE_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
      if (count === 4) rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      buy(s);
      expect(s.cash).toBe(count === 4 ? 9550 : 7750);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash, foreign originals and forged confirmations without mutation', () => {
    const s = tamer(); s.cash = 239; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['apothecary-potion-1', 'tamer-potion-1', 'vampire-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE }, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'CONSUME', bottleId: VAMPIRE_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('permits early preparation but requires S8 acting 100 and eight whole weeks since S8', () => {
    const s = tamer(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command); s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectVampire(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.tamer.promotionWeek, s.vampire.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.vampire.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validateVampireState(s)).toBe(true);
  });

  it('resolves all four will-18 tiers with real original consumption and recoverable guided costs', () => {
    for (const [roll, tier, sequence, mind, health, pollution] of [
      [1, 'GREAT_SUCCESS', 7, 95, 100, 0], [20, 'SUCCESS', 7, 90, 100, 0],
      [80, 'FAILURE', 8, 80, 90, 25], [99, 'GREAT_FAILURE', 8, 60, 80, 50],
    ] as const) {
      const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
      applyVampireCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]);
      expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
      expect(s.vampire.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect(validateVampireState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('inherits all six old masteries, resets only S7 acting, and raises the cap without a refill', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const old = [JSON.stringify(s.apothecary), JSON.stringify(s.tamer), JSON.stringify(s.caseArchive)];
    s.spirituality = 9; consume(s);
    expect([s.vampire.tamerActingAtPromotion, s.progression.acting, s.spirituality]).toEqual([100, 0, 9]);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(VAMPIRE_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique + 3, perception: stats.perception + 2, will: stats.will + 2, knowledge: stats.knowledge + 1 });
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.apothecary), JSON.stringify(s.tamer), JSON.stringify(s.caseArchive)]).toEqual(old);
    expect(projectVampire(s).abilities.map(ability => ability.id)).toEqual([...VAMPIRE_ABILITY_IDS]);
    const capped = prepared(); capped.character.coreStats = { physique: 500, perception: 499, will: 500, knowledge: 499 }; consume(capped, 1);
    expect(capped.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
  });

  it('blocks unavailable bodies, routes, locations, runs and ongoing events or combat', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.apothecary.discovered = false; },
      s => { s.apothecary.guidanceKnown = false; }, s => { s.tamer.guidanceKnown = false; }, s => { s.tamer.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.combat = {} as NonNullable<SliceState['combat']>; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }); }
  });

  it('requires AP for guidance and labour but allows purchase and consumption at zero AP', () => {
    const s = tamer(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s); expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it('retains a failed original and old progression, then preserves spare originals after successful recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.vampire.promotionWeek, s.vampire.tamerActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100; buy(s, 1); buy(s, 2); consume(s, 20, 1);
    expect(s.vampire.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'GREAT_FAILURE'], ['CONSUMED', 'SUCCESS'], ['PLAYER', null]]);
    expect(s.seer.pollution).toBe(50);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: VAMPIRE_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: VAMPIRE_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: VAMPIRE_BOTTLE_IDS[2], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectVampire(s).actions.every(action => !action.enabled)).toBe(true);
    expect(validateVampireState(s)).toBe(true);
  });

  it('only restocks after all three failures and a real later week, keeping old bottles and all prices', () => {
    const s = taught(); rejected(s, { type: 'REQUEST_SUPPLY' });
    for (let index = 0; index < 3; index += 1) {
      buy(s, index); consume(s, 80, index);
      if (index < 2) rejected(s, { type: 'REQUEST_SUPPLY' });
    }
    const originals = JSON.stringify(s.vampire.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.vampire.bottles.length, s.vampire.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.vampire.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.vampire.resupply.deliveries, s.vampire.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.vampire.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['vampire-potion-4', 'SUPPLIER', 0], ['vampire-potion-5', 'SUPPLIER', 0], ['vampire-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectVampire(s).actions.find(action => action.id === 'buy-vampire-potion-4')!.cost).toContain('2010便士');
    expect(validateVampireState(s)).toBe(true); rejected(s, { type: 'RECEIVE_SUPPLY' });
    const bad = clone(s); bad.vampire.bottles[3]!.source = bad.vampire.bottles[3]!.source.replace('第20周', '第19周');
    expect(validateVampireState(bad)).toBe(false);
  });

  it('rejects malformed stock, duplicate success, chronology and incomplete inherited abilities on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.vampire.bottles[0]!.id = 'tamer-potion-1'; }, s => { s.vampire.bottles[0]!.source = 'unsourced'; },
      s => { s.vampire.bottles[1]!.labourSteps = 5; }, s => { s.vampire.promotionWeek = 18; },
      s => { s.vampire.tamerActingAtPromotion = 99; }, s => { delete s.progression.mastery[APOTHECARY_ABILITY_IDS[0]]; },
      s => { delete s.progression.mastery[TAMER_ABILITY_IDS[0]]; },
      s => { s.vampire.practiceAttempts['blood-samples'] = 18; }, s => { s.vampire.blood.lastFedWeek = 18; },
      s => { s.vampire.blood.held = -1; }, s => { s.vampire.regenerationWeek = 18; },
      s => { s.vampire.practices = ['unknown']; }, s => { s.vampire.encounter.startHistoryIndex = -1; },
      s => { s.vampire.bottles[1] = { ...s.vampire.bottles[0]!, id: VAMPIRE_BOTTLE_IDS[1], source: s.vampire.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validateVampireState(bad)).toBe(false); }
    const bad = clone(s); (bad.vampire.bottles as unknown[])[0] = null; expect(validateVampireState(bad)).toBe(false);
    const beforePromotion = tamer(); beforePromotion.vampire.encounter.observed = true;
    expect(validateVampireState(beforePromotion)).toBe(false);
  });

  it('separates strict activity commands and exposes only bounded S7 abilities and known formula facts', () => {
    expect(isVampireAcquisitionCommand({ type: 'BUY_POTION', bottleId: FIRST_BOTTLE })).toBe(true);
    expect(isVampireAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    for (const type of ['BUY_BLOOD', 'FEED', 'REGENERATE', 'REFLECT', 'OBSERVE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT']) {
      expect(validateVampireCommand({ type })).toBe(true);
      expect(isVampireAcquisitionCommand({ type })).toBe(false);
    }
    for (const practiceId of VAMPIRE_PRACTICE_IDS) expect(validateVampireCommand({ type: 'PRACTICE', practiceId })).toBe(true);
    for (const bad of [
      { type: 'PRACTICE', practiceId: 'unknown' }, { type: 'PRACTICE', itemId: 'blood-samples' },
      { type: 'PRACTICE', practiceId: 'blood-samples', free: true }, { type: 'BUY_BLOOD', amount: 2 },
      { type: 'FEED', target: 'bystander' }, { type: 'REFLECT', free: true }, { type: 'BREW' },
      { type: 'LEARN_FORMULA' }, { type: 'BITE_TO_PROMOTE' }, { type: 'REVIVE' }, null, [],
    ]) expect(validateVampireCommand(bad)).toBe(false);
    const s = prepared(), p = projectVampire(s);
    rejected(s, { type: 'PRACTICE', practiceId: 'blood-samples' });
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p.risk).toContain('本作G游戏平衡'); expect(p.risk).toContain('意志难度18');
    expect(p.risk).toContain('人类服药成为吸血鬼后仍须扮演');
    expect(p.supplies).toContain('血源精华'); expect(p.supplies).toContain('数量与辅助材料未知');
    expect(VAMPIRE_ABILITIES.map(ability => ability.id)).toEqual([...VAMPIRE_ABILITY_IDS]);
    expect(VAMPIRE_ABILITIES[0]!.description).toContain('动物血并非完全等价替代');
    expect(VAMPIRE_ABILITIES[0]!.description).toContain('自愿成年供给者');
    expect(VAMPIRE_ABILITIES[1]!.description).toContain('不是永久控制');
    expect(VAMPIRE_ABILITIES[2]!.description).toContain('并非接触阳光便立即死亡');
    expect(VAMPIRE_ABILITIES[3]!.description).toContain('仍可被杀死');
    expect(p.formula).toEqual([]);
  });

  it('requires safely returning the actual animal before any preparation or consumption', () => {
    const early = tamer(); early.tamer.companionId = 'yard-hound'; early.tamer.animals['yard-hound']!.location = 'WITH_PLAYER';
    const originalAnimal = JSON.stringify(early.tamer);
    rejected(early, { type: 'LEARN_GUIDANCE' });
    expect(projectVampire(early).actions[0]!.reason).toContain('安全回到原主人');
    expect(JSON.stringify(early.tamer)).toBe(originalAnimal);
    const s = prepared(); s.tamer.companionId = 'yard-hound'; s.tamer.animals['yard-hound']!.location = 'WITH_PLAYER';
    for (const command of [
      { type: 'POTION_WORK', bottleId: VAMPIRE_BOTTLE_IDS[1] },
      { type: 'BUY_POTION', bottleId: VAMPIRE_BOTTLE_IDS[1] },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(s.tamer.animals['yard-hound']!.location).toBe('WITH_PLAYER');
    s.tamer.companionId = null; s.tamer.animals['yard-hound']!.location = 'HOME';
    consume(s); expect(s.progression.sequence).toBe(7);
    expect(s.tamer.animals['yard-hound']!.location).toBe('HOME');
  });
});
