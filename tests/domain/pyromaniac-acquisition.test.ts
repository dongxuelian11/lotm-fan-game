import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applyHunterCommand } from '../../src/domain/hunter/index.js';
import { HUNTER_ABILITY_IDS } from '../../src/domain/hunter/types.js';
import { applyProvokerCommand } from '../../src/domain/provoker/index.js';
import { PROVOKER_ABILITY_IDS } from '../../src/domain/provoker/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyPyromaniacCommand, createPyromaniacState, isPyromaniacAcquisitionCommand,
  projectPyromaniac, validatePyromaniacCommand, validatePyromaniacState,
} from '../../src/domain/pyromaniac/index.js';
import { PYROMANIAC_ABILITIES, PYROMANIAC_BOTTLE_IDS, PYROMANIAC_FORMULA_STATUS, PYROMANIAC_LABOUR_TASKS } from '../../src/domain/pyromaniac/content.js';
import { PYROMANIAC_ABILITY_IDS, type PyromaniacAcquisitionCommand } from '../../src/domain/pyromaniac/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const FIRST_BOTTLE = PYROMANIAC_BOTTLE_IDS[0];
function ordinary(): SliceState {
  const s = createSliceRun('pyromaniac-acquisition', sliceDefaultCreationSelection, 'pyromaniac-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.pyromaniac = createPyromaniacState();
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
function provoker(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyHunterCommand(s, { type: 'DISCOVER' }, c);
  applyHunterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyHunterCommand(s, { type: 'BUY_POTION', bottleId: s.hunter.bottles[0]!.id }, c);
  applyHunterCommand(s, { type: 'CONSUME', bottleId: s.hunter.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyProvokerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyProvokerCommand(s, { type: 'BUY_POTION', bottleId: s.provoker.bottles[0]!.id }, c);
  applyProvokerCommand(s, { type: 'CONSUME', bottleId: s.provoker.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...HUNTER_ABILITY_IDS, ...PROVOKER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 20;
  return s;
}
function apply(s: SliceState, command: PyromaniacAcquisitionCommand, roll = 20) { applyPyromaniacCommand(s, command, context(s, roll).c); }
function taught(s = provoker()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.pyromaniac.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function consume(s: SliceState, roll = 20, index = 0) { apply(s, { type: 'CONSUME', bottleId: s.pyromaniac.bottles[index]!.id, confirmed: true }, roll); }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as PyromaniacAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) { buy(s, index); consume(s, 80, index); }
  return s;
}
const clone = (s: SliceState) => JSON.parse(JSON.stringify(s)) as SliceState;

describe('S7 independent finished-potion acquisition', () => {
  it('starts with three independent sourced originals and no activity progress', () => {
    const s = ordinary(), other = createPyromaniacState();
    expect(validatePyromaniacState(s)).toBe(true);
    expect(s.pyromaniac.bottles.map(bottle => bottle.id)).toEqual([...PYROMANIAC_BOTTLE_IDS]);
    expect(s.pyromaniac.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(s.pyromaniac).toMatchObject({ practices: [], practiceAttempts: {}, reflected: false, promotionWeek: null, provokerActingAtPromotion: null, encounter: { status: 'AVAILABLE', surveyed: false, safeLane: false, attemptWeek: null, startHistoryIndex: null } });
    other.bottles[0]!.labourSteps = 4; other.practices.push('flame-control'); other.encounter.safeLane = true;
    expect(s.pyromaniac.bottles[0]!.labourSteps).toBe(0);
    expect(s.pyromaniac.practices).toEqual([]);
    expect(s.pyromaniac.encounter.safeLane).toBe(false);
  });

  it('hides the future channel from ordinary people and prevents route skipping', () => {
    const s = ordinary(), p = projectPyromaniac(s);
    expect(p).toMatchObject({ discovered: false, guidanceKnown: false, formulaKnown: false, formula: [], bottles: [], actions: [], abilities: [], practices: [], environment: '', supplies: '' });
    expect(JSON.stringify(p)).not.toMatch(/pyromaniac-potion|2010|1800/);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    const hunter = provoker(); hunter.progression.sequence = 9;
    rejected(hunter, { type: 'LEARN_GUIDANCE' });
  });

  it('charges 240 pence and one action for guidance without revealing an invented formula', () => {
    const s = provoker(), oldHunter = JSON.stringify(s.hunter), oldProvoker = JSON.stringify(s.provoker), oldProgression = JSON.stringify(s.progression);
    expect(projectPyromaniac(s).actions.map(action => action.command.type)).toEqual(['LEARN_GUIDANCE']);
    rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    taught(s);
    expect([s.cash, s.actionsRemaining, s.pyromaniac.guidanceKnown]).toEqual([9760, 39, true]);
    expect(projectPyromaniac(s)).toMatchObject({ formulaKnown: false, formula: [] });
    expect(projectPyromaniac(s).supplies).toContain(PYROMANIAC_FORMULA_STATUS);
    expect(projectPyromaniac(s).bottles.every(bottle => bottle.source.includes('序列7') && bottle.source.includes('本作G'))).toBe(true);
    expect([JSON.stringify(s.hunter), JSON.stringify(s.provoker), JSON.stringify(s.progression)]).toEqual([oldHunter, oldProvoker, oldProgression]);
    expect(validatePyromaniacState(s)).toBe(true);
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('pays 2010 pence with zero action to transfer exactly the selected original', () => {
    const s = taught(), ap = s.actionsRemaining, others = JSON.stringify(s.pyromaniac.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([7750, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.pyromaniac.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validatePyromaniacState(s)).toBe(true);
  });

  it('requires four real actions on this bottle before the 1800 credit and 210 cash payment', () => {
    const s = taught(), ctx = context(s);
    for (let index = 0; index < 4; index += 1) {
      applyPyromaniacCommand(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.pyromaniac.bottles[0]!.labourSteps]).toEqual([9760, 38 - index, index + 1]);
      expect(projectPyromaniac(s).actions.find(action => action.id === `buy-${FIRST_BOTTLE}`)!.cost).toContain(`${index === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(note => note.title)).toEqual(PYROMANIAC_LABOUR_TASKS.map(task => `完成${task}`));
    expect(projectPyromaniac(s).actions.find(action => action.id === `buy-${PYROMANIAC_BOTTLE_IDS[1]}`)!.cost).toContain('2010便士');
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s);
    expect([s.cash, s.actionsRemaining, s.pyromaniac.bottles[0]!.status]).toEqual([9550, 35, 'PLAYER']);
  });

  it('never partially refunds one, two or three completed jobs', () => {
    for (const count of [1, 2, 3]) {
      const s = taught();
      for (let i = 0; i < count; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
      const cash = s.cash;
      buy(s);
      expect(cash - s.cash).toBe(2010);
      rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    }
  });

  it('rejects insufficient cash and foreign or nonexistent originals before mutation', () => {
    const s = provoker(); s.cash = 239;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; taught(s);
    for (const bottleId of ['hunter-potion-1', 'provoker-potion-1', 'pyromaniac-potion-4']) rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 2009; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId: FIRST_BOTTLE });
    s.cash = 210; buy(s); expect(s.cash).toBe(0);
  });

  it('allows preparation early but measures eight whole weeks from S8, not the S9 promotion', () => {
    const s = provoker(); s.week = 11; s.progression.acting = 0;
    taught(s); buy(s);
    const command = { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true } as const;
    rejected(s, command);
    s.progression.acting = 100;
    for (const week of [11, 16, 18]) {
      s.week = week;
      expect(projectPyromaniac(s).actions.find(action => action.id === `consume-${FIRST_BOTTLE}`)!.reason).toContain(`${week - 11}/8`);
      rejected(s, command);
    }
    s.week = 19; s.progression.acting = 99; rejected(s, command);
    s.progression.acting = 100; apply(s, command);
    expect([s.progression.promotionWeek, s.provoker.promotionWeek, s.pyromaniac.promotionWeek]).toEqual([5, 11, 19]);
    expect(s.pyromaniac.bottles[0]).toMatchObject({ acquiredWeek: 11, consumedWeek: 19 });
    expect(validatePyromaniacState(s)).toBe(true);
  });

  it('requires separate exact confirmation and rejects forged commands without mutation', () => {
    const s = prepared();
    for (const command of [
      { type: 'CONSUME', bottleId: FIRST_BOTTLE },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: false },
      { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true, bonus: 1 },
      { type: 'BREW' }, { type: 'PRACTICE', practiceId: 'flame-control' },
      { type: 'CONSUME', bottleId: PYROMANIAC_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
  });

  it('blocks unavailable bodies, routes, locations, runs and active events', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.hunter.discovered = false; },
      s => { s.provoker.guidanceKnown = false; }, s => { s.provoker.promotionWeek = null; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; },
      s => { s.status = 'SLICE_COMPLETE'; }, s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
    }
  });

  it('requires AP for guidance and labour but permits payment and consumption at zero AP', () => {
    const s = provoker(); s.actionsRemaining = 0;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s);
    rejected(s, { type: 'POTION_WORK', bottleId: FIRST_BOTTLE });
    buy(s); consume(s);
    expect([s.actionsRemaining, s.progression.sequence]).toEqual([0, 7]);
  });

  it.each([
    [1, 'GREAT_SUCCESS', 7, 95, 100, 0],
    [20, 'SUCCESS', 7, 90, 100, 0],
    [80, 'FAILURE', 8, 80, 90, 25],
    [99, 'GREAT_FAILURE', 8, 60, 80, 50],
  ] as const)('resolves roll %i as %s with a consumed original and the guided recoverable consequences', (roll, tier, sequence, mind, health, pollution) => {
    const s = prepared(), ctx = context(s, roll), ap = s.actionsRemaining;
    applyPyromaniacCommand(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 18]]);
    expect([s.progression.sequence, s.mind, s.health, s.seer.pollution, s.status, s.actionsRemaining]).toEqual([sequence, mind, health, pollution, 'ACTIVE', ap]);
    expect(s.pyromaniac.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
    expect(validatePyromaniacState(s)).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: FIRST_BOTTLE, confirmed: true });
  });

  it('inherits all six mastered abilities and records S8 digestion while resetting only S7 acting', () => {
    const s = prepared(), stats = { ...s.character.coreStats }, oldMastery = { ...s.progression.mastery };
    const oldHunter = JSON.stringify(s.hunter), oldProvoker = JSON.stringify(s.provoker), oldArchive = JSON.stringify(s.caseArchive);
    s.spirituality = 9; consume(s);
    expect(s.pyromaniac.provokerActingAtPromotion).toBe(100);
    expect(s.progression.acting).toBe(0);
    expect(s.progression.mastery).toEqual({ ...oldMastery, ...Object.fromEntries(PYROMANIAC_ABILITY_IDS.map(id => [id, 0])) });
    expect(s.character.coreStats).toEqual({ physique: stats.physique + 2, perception: stats.perception + 1, will: stats.will + 3, knowledge: stats.knowledge + 1 });
    expect(s.spirituality).toBe(9);
    expect(projectSliceState(s).maxSpirituality).toBe(60);
    expect([JSON.stringify(s.hunter), JSON.stringify(s.provoker), JSON.stringify(s.caseArchive)]).toEqual([oldHunter, oldProvoker, oldArchive]);
    expect(projectPyromaniac(s).abilities.map(ability => ability.id)).toEqual([...PYROMANIAC_ABILITY_IDS]);
  });

  it('keeps failures and earlier progression intact so another original can be used after recovery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    consume(s, 99);
    expect([s.progression.acting, s.pyromaniac.promotionWeek, s.pyromaniac.provokerActingAtPromotion]).toEqual([100, null, null]);
    expect(s.progression.mastery).toEqual(mastery);
    s.mind = 100; s.health = 100;
    buy(s, 1); consume(s, 20, 1);
    expect(s.pyromaniac.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.pyromaniac.bottles[1]!.outcome).toBe('SUCCESS');
    expect(s.seer.pollution).toBe(50);
    expect(validatePyromaniacState(s)).toBe(true);
  });

  it('keeps spare bottles after promotion but blocks further preparation or consumption', () => {
    const s = taught(); buy(s); buy(s, 1); consume(s);
    expect(s.pyromaniac.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'POTION_WORK', bottleId: PYROMANIAC_BOTTLE_IDS[2] },
      { type: 'BUY_POTION', bottleId: PYROMANIAC_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: PYROMANIAC_BOTTLE_IDS[1], confirmed: true },
      { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    ]) rejected(s, command);
    expect(projectPyromaniac(s).actions.every(action => !action.enabled)).toBe(true);
  });

  it('only restocks after all failures and a real later week, without giving away the next bottles', () => {
    const s = exhausted(), originals = JSON.stringify(s.pyromaniac.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.pyromaniac.bottles.length, s.pyromaniac.resupply.requestedWeek]).toEqual([ap - 1, 3, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.pyromaniac.bottles.slice(0, 3))).toBe(originals);
    expect([s.cash, s.actionsRemaining, s.pyromaniac.resupply.deliveries, s.pyromaniac.resupply.requestedWeek]).toEqual([cash, ap - 1, 1, null]);
    expect(s.pyromaniac.bottles.slice(3).map(bottle => [bottle.id, bottle.status, bottle.labourSteps])).toEqual([
      ['pyromaniac-potion-4', 'SUPPLIER', 0], ['pyromaniac-potion-5', 'SUPPLIER', 0], ['pyromaniac-potion-6', 'SUPPLIER', 0],
    ]);
    expect(projectPyromaniac(s).actions.find(action => action.id === 'buy-pyromaniac-potion-4')!.cost).toContain('2010便士');
    expect(validatePyromaniacState(s)).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
  });

  it('does not restock while any original remains unconsumed', () => {
    const s = taught();
    rejected(s, { type: 'REQUEST_SUPPLY' });
    buy(s); consume(s, 80); buy(s, 1); consume(s, 80, 1);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    expect(s.pyromaniac.bottles).toHaveLength(3);
  });

  it('rejects invalid bottle identity, duplicated promotion and shortened maturation on load', () => {
    const s = prepared(); consume(s);
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.pyromaniac.bottles[0]!.id = 'provoker-potion-1'; },
      s => { s.pyromaniac.bottles[0]!.source = 'unsourced substitute'; },
      s => { s.pyromaniac.bottles[1]!.labourSteps = 5; },
      s => { s.pyromaniac.promotionWeek = 18; },
      s => { s.pyromaniac.provokerActingAtPromotion = 99; },
      s => { delete s.progression.mastery[HUNTER_ABILITY_IDS[0]]; },
      s => { s.pyromaniac.bottles[1] = { ...s.pyromaniac.bottles[0]!, id: PYROMANIAC_BOTTLE_IDS[1], source: s.pyromaniac.bottles[1]!.source }; },
    ];
    for (const mutate of mutations) { const bad = clone(s); mutate(bad); expect(validatePyromaniacState(bad)).toBe(false); }
    const bad = clone(s); (bad.pyromaniac.bottles as unknown[])[0] = null;
    expect(validatePyromaniacState(bad)).toBe(false);
  });

  it('keeps command boundaries separate and projects the exact G risk and current will chance', () => {
    expect(isPyromaniacAcquisitionCommand({ type: 'BUY_POTION', bottleId: FIRST_BOTTLE })).toBe(true);
    expect(isPyromaniacAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    for (const type of ['SURVEY_ENCOUNTER', 'CLEAR_LANE', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'REFLECT']) expect(validatePyromaniacCommand({ type })).toBe(true);
    expect(validatePyromaniacCommand({ type: 'PRACTICE', practiceId: 'flame-control' })).toBe(true);
    expect(validatePyromaniacCommand({ type: 'PRACTICE', practiceId: '' })).toBe(false);
    expect(validatePyromaniacCommand({ type: 'CLEAR_LANE', free: true })).toBe(false);
    const s = prepared(), p = projectPyromaniac(s);
    expect(p.bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 18, modifiers: [] }));
    expect(p.risk).toContain('本作G游戏平衡');
    expect(p.risk).toContain('意志难度18');
    expect(PYROMANIAC_ABILITIES.map(ability => ability.id)).toEqual([...PYROMANIAC_ABILITY_IDS]);
    expect(PYROMANIAC_ABILITIES.some(ability => /jump|teleport/.test(ability.id))).toBe(false);
  });
});
