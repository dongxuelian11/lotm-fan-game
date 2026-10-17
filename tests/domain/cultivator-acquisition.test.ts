import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyCultivatorCommand, createCultivatorState, isCultivatorAcquisitionCommand, projectCultivator,
  validateCultivatorCommand, validateCultivatorState,
} from '../../src/domain/cultivator/index.js';
import { CULTIVATOR_ABILITIES, CULTIVATOR_BOTTLE_IDS, CULTIVATOR_FORMULA_STATUS, CULTIVATOR_SOURCE_STATUS } from '../../src/domain/cultivator/content.js';
import { CULTIVATOR_ABILITY_IDS, CULTIVATOR_CASE_IDS, type CultivatorAcquisitionCommand } from '../../src/domain/cultivator/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('cultivator-acquisition', sliceDefaultCreationSelection, 'cultivator-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.cultivator = createCultivatorState();
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
function apply(s: SliceState, command: CultivatorAcquisitionCommand, roll = 20) { applyCultivatorCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.cultivator.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of CULTIVATOR_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: CultivatorAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Cultivator finite finished-potion acquisition', () => {
  it('starts with three independent originals and untouched private cases, without a recipe', () => {
    const s = ordinary(), p = projectCultivator(s);
    expect(validateCultivatorState(s)).toBe(true);
    expect(s.cultivator.bottles.map(b => b.id)).toEqual([...CULTIVATOR_BOTTLE_IDS]);
    expect(s.cultivator.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.cultivator.cases)).toEqual([...CULTIVATOR_CASE_IDS]);
    expect(Object.values(s.cultivator.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.outcome === 'NONE' && !w.contactOpen && w.closes === 0)).toBe(true);
    expect(s.cultivator.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], insideCase: false, environment: '', garden: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('cultivator-potion-');
    expect(s.cultivator).not.toHaveProperty('draft');
    const separate = createCultivatorState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['soil-record']!.contactOpen = true;
    expect(s.cultivator.bottles[0]!.labourSteps).toBe(0);
    expect(s.cultivator.cases['soil-record']!.contactOpen).toBe(false);
  });

  it('charges one AP for discovery and one AP plus 120 pence for guidance, granting no magic', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyCultivatorCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.cultivator.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(projectCultivator(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
    applyCultivatorCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.cultivator.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectCultivator(s).supplies).toContain(CULTIVATOR_FORMULA_STATUS);
    expect(projectCultivator(s).formulaKnown).toBe(false);
    expect(projectCultivator(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateCultivatorState(s)).toBe(true);
  });

  it('transfers exactly one original for 660 pence at zero AP without partial labour discounts', () => {
    const s = guided(), otherBottles = JSON.stringify(s.cultivator.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: CULTIVATOR_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.cultivator.bottles.slice(1))).toBe(otherBottles);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateCultivatorState(s)).toBe(true);
  });

  it('requires both real ordinary jobs on the same bottle, then 60 pence; no learned power or pollution', () => {
    const s = guided(), bottle = s.cultivator.bottles[0]!, ctx = context(s), pollution = s.seer.pollution;
    const possessions = JSON.stringify(s.town), world = JSON.stringify(s.world);
    applyCultivatorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectCultivator(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyCultivatorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成普通种子标签核对', '完成小苗圃用水记录整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectCultivator(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectCultivator(s).actions.find(a => a.id === `buy-${CULTIVATOR_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.cultivator.cases).toEqual(createCultivatorState().cases);
    expect(s.seer.pollution).toBe(pollution);
    expect(JSON.stringify(s.town)).toBe(possessions);
    expect(JSON.stringify(s.world)).toBe(world);
    expect(ctx.notes[1]!.text).toContain('不赠送材料或工具');
    expect(validateCultivatorState(s)).toBe(true);
  });

  it('rejects insufficient funds, unavailable originals and insufficient AP before mutation', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['cultivator-potion-4', 'assassin-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: CULTIVATOR_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('opens discovery only after four full ordinary weeks, with a separately confirmed potion', () => {
    const s = ordinary();
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(validateCultivatorState(s)).toBe(true);
      expect(projectCultivator(s).actions[0]!.reason).toContain(`${week - 1}/4`);
      expect(projectCultivator(s).bottles).toEqual([]);
      rejected(s, { type: 'DISCOVER' });
      rejected(s, { type: 'LEARN_GUIDANCE' });
      rejected(s, { type: 'BUY_POTION', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
    }
    s.week = 5;
    expect(projectCultivator(s).actions[0]!.enabled).toBe(true);
    guided(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[0], confirmed: false } as unknown as CultivatorAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.cultivator.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateCultivatorState(s)).toBe(true);
  });

  it('uses one will difficulty-five check for each of the four recoverable outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      const possessions = JSON.stringify(s.town), world = JSON.stringify(s.world);
      s.spirituality = 7;
      applyCultivatorCommand(s, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.cultivator.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'mother' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(CULTIVATOR_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 1, perception: stats.perception + 1, will: stats.will, knowledge: stats.knowledge + 2 } : stats);
      expect(JSON.stringify(s.town)).toBe(possessions);
      expect(JSON.stringify(s.world)).toBe(world);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateCultivatorState(s)).toBe(true);
    }
  });

  it('caps stat increases without refilling spirituality and preserves rejected bottles through real recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectCultivator(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.cultivator.bottles[0]!.status).toBe('CONSUMED');
    expect(validateCultivatorState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: CULTIVATOR_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.cultivator.bottles[0]).toEqual(failed.cultivator.bottles[0]);
  });

  it('retains unused originals and prevents selecting another pathway after promotion', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: CULTIVATOR_BOTTLE_IDS[2] });
    expect(s.cultivator.bottles[1]!.status).toBe('PLAYER');
    expect(projectCultivator(s).actions.find(a => a.id === `consume-${CULTIVATOR_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared();
    other.progression.pathwayId = 'demoness'; other.progression.sequence = 9; other.progression.promotionWeek = 5;
    rejected(other, { type: 'CONSUME', bottleId: CULTIVATOR_BOTTLE_IDS[0], confirmed: true });
    expect(other.cultivator.bottles[0]!.status).toBe('PLAYER');
    expect(validateCultivatorState(s)).toBe(true);
  });

  it('resupplies only after all failures, an explicit one-AP request, and a later real week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectCultivator(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.cultivator.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'CULTIVATOR', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.cultivator.resupply.requestedWeek, s.actionsRemaining, s.cash]).toEqual([5, 1, cash]);
    expect(s.date).toEqual(priorDate);
    expect(s.cultivator.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6);
    s.activeEvent = null; s.eventQueue = [];
    const ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'CULTIVATOR', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cultivator.resupply.deliveries, s.cultivator.resupply.requestedWeek, s.actionsRemaining]).toEqual([1, null, ap]);
    expect(JSON.stringify(s.cultivator.bottles.slice(0, 3))).toBe(originals);
    expect(s.cultivator.bottles.slice(3).map(b => b.id)).toEqual(['cultivator-potion-4', 'cultivator-potion-5', 'cultivator-potion-6']);
    expect(s.cultivator.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    buy(s, 3);
    apply(s, { type: 'CONSUME', bottleId: 'cultivator-potion-4', confirmed: true }, 1);
    expect(s.progression.pathwayId).toBe('mother');
    expect(s.cultivator.bottles[3]).toMatchObject({ status: 'CONSUMED', acquiredWeek: 6, consumedWeek: 6, outcome: 'GREAT_SUCCESS' });
    expect(validateCultivatorState(s)).toBe(true);
  });

  it('rejects event, combat, city, lifecycle, health, mind and open-contact blockers without mutation', () => {
    for (const blocker of ['event', 'combat', 'city', 'dead', 'complete', 'health', 'mind', 'open-contact']) {
      const s = guided();
      if (blocker === 'event') s.activeEvent = { id: 'blocked', instanceId: 'blocked-1' };
      if (blocker === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
      if (blocker === 'city') s.world.city = 'ELSEWHERE';
      if (blocker === 'dead') s.status = 'DEAD';
      if (blocker === 'complete') s.status = 'SLICE_COMPLETE';
      if (blocker === 'health') s.health = 0;
      if (blocker === 'mind') s.mind = 0;
      if (blocker === 'open-contact') s.cultivator.cases['soil-record']!.contactOpen = true;
      rejected(s, { type: 'BUY_POTION', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
      rejected(s, { type: 'POTION_WORK', bottleId: CULTIVATOR_BOTTLE_IDS[0] });
      expect(projectCultivator(s).actions.every(action => !action.enabled)).toBe(true);
    }
  });

  it('validates exact commands, evidence-only reports, both methods and actual closing', () => {
    for (const command of [
      { type: 'DISCOVER' }, { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'BUY_GARDEN' }, { type: 'CARE' }, { type: 'HARVEST' },
      { type: 'BUY_POTION', bottleId: 'cultivator-potion-4' }, { type: 'POTION_WORK', bottleId: 'cultivator-potion-1' },
      { type: 'CONSUME', bottleId: 'cultivator-potion-1', confirmed: true },
      { type: 'OBSERVE', caseId: 'seed-bed' }, { type: 'PERFORM', caseId: 'shared-basket' },
      { type: 'PREPARE', caseId: 'shared-basket', method: 'ABILITY' }, { type: 'PREPARE', caseId: 'seed-bed', method: 'ORDINARY' },
      { type: 'CLOSE', caseId: 'soil-record' }, { type: 'WITHDRAW', caseId: 'soil-record' },
      { type: 'REPORT', caseId: 'soil-record' }, { type: 'REPORT', caseId: 'shared-basket' },
    ]) expect(validateCultivatorCommand(command)).toBe(true);
    expect(isCultivatorAcquisitionCommand({ type: 'BUY_POTION', bottleId: 'cultivator-potion-1' })).toBe(true);
    expect(isCultivatorAcquisitionCommand({ type: 'CLOSE', caseId: 'soil-record' })).toBe(false);
    for (const type of ['BUY_GARDEN', 'CARE', 'HARVEST'] as const) {
      expect(isCultivatorAcquisitionCommand({ type })).toBe(false);
      rejected(prepared(), { type } as unknown as CultivatorAcquisitionCommand);
    }
    for (const command of [
      null, [], {}, { type: 'REWRITE_RULE' }, { type: 'PROHIBIT' }, { type: 'ASSIGN_GUILT' }, { type: 'LEARN_FORMULA' }, { type: 'BREW', batchId: 'cultivator-potion-1' },
      { type: 'DISCOVER', free: true }, { type: 'BUY_POTION', bottleId: 'cultivator-potion-0' }, { type: 'BUY_POTION', bottleId: 'cultivator-potion-01' },
      { type: 'BUY_POTION', bottleId: 'cultivator-potion-1000000000000000' }, { type: 'BUY_POTION', bottleId: 'assassin-potion-1' },
      { type: 'CONSUME', bottleId: 'cultivator-potion-1' }, { type: 'CONSUME', bottleId: 'cultivator-potion-1', confirmed: false },
      { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'seed-bed', method: 'AUTHORITY' },
      { type: 'BUY_GARDEN', free: true }, { type: 'CARE', water: 0 }, { type: 'HARVEST', produce: 99 },
      { type: 'GROW_INSTANTLY' }, { type: 'CONTROL_WEATHER' }, { type: 'HYBRIDIZE' },
      { type: 'PREPARE', caseId: 'soil-record', method: 'COMPEL' }, { type: 'PREPARE', caseId: 'soil-record', method: 'ARGUMENT' },
      { type: 'REPORT' }, { type: 'REPORT', caseId: 'invented' }, { type: 'REPORT', caseId: 'seed-bed', claim: 'CERTAIN' },
      { type: 'REPORT', caseId: 'seed-bed', claim: 'LIMITED', truth: 'known' },
      { type: 'CLOSE', caseId: 'soil-record', immune: true }, { type: 'RETURN', caseId: 'soil-record' },
    ]) expect(validateCultivatorCommand(command)).toBe(false);
    const s = prepared();
    rejected(s, { type: 'CLOSE', caseId: 'soil-record' } as unknown as CultivatorAcquisitionCommand);
  });

  it('keeps every new scene untouched before promotion and rejects malformed exact state shapes', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(validateCultivatorState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
      expect(s.cultivator.cases).toEqual(createCultivatorState().cases);
      expect(projectCultivator(s).cases).toEqual([]);
    }
    for (const mutate of [
      (s: SliceState) => { s.cultivator.cases['seed-bed']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.cultivator.cases['seed-bed']!.attemptWeek = 5; },
      (s: SliceState) => { s.cultivator.cases['seed-bed']!.withdrawals = 1; },
      (s: SliceState) => { s.cultivator.cases['seed-bed']!.method = 'ABILITY'; },
      (s: SliceState) => { s.cultivator.cases['seed-bed']!.outcome = 'GROWTH_RECORDED'; },
      (s: SliceState) => { s.cultivator.cases['soil-record']!.contactOpen = true; },
      (s: SliceState) => { s.cultivator.cases['soil-record']!.closes = 1; },
      (s: SliceState) => { s.cultivator.reflected = true; },
      (s: SliceState) => { s.progression.mastery['mother.s9.cultivation-knowledge'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateCultivatorState(s)).toBe(false); }
    const rawCase = (s: SliceState) => s.cultivator.cases['soil-record'] as unknown as Record<string, unknown>;
    for (const mutate of [
      (s: SliceState) => { delete s.cultivator.cases['soil-record']; },
      (s: SliceState) => { s.cultivator.cases['copy'] = { ...s.cultivator.cases['soil-record']! }; },
      (s: SliceState) => { rawCase(s).status = 'IMAGINED'; },
      (s: SliceState) => { rawCase(s).method = 'MAGIC'; },
      (s: SliceState) => { rawCase(s).outcome = 'TOKEN_COVERED'; },
      (s: SliceState) => { rawCase(s).contactOpen = 'true'; },
      (s: SliceState) => { rawCase(s).tookOriginal = 'true'; },
      (s: SliceState) => { rawCase(s).attemptWeek = 4; },
      (s: SliceState) => { rawCase(s).attemptWeek = 6; },
      (s: SliceState) => { rawCase(s).withdrawals = -1; },
      (s: SliceState) => { rawCase(s).closes = -1; },
      (s: SliceState) => { rawCase(s).closes = 0.5; },
      (s: SliceState) => { rawCase(s).closes = Number.MAX_SAFE_INTEGER + 1; },
      (s: SliceState) => { rawCase(s).overclaims = 0; },
      (s: SliceState) => { rawCase(s).secret = 'unknown'; },
      (s: SliceState) => { delete rawCase(s).contactOpen; },
      (s: SliceState) => { (s.cultivator as unknown as Record<string, unknown>).draft = {}; },
      (s: SliceState) => { (s.cultivator as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateCultivatorState(s)).toBe(false); }
  });

  it('rejects forged provenance, invalid bottle history, missing success and future batch dates', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.cultivator.bottles[0]!.source = 'invented'; },
      (s: SliceState) => { s.cultivator.bottles[0]!.id = 'cultivator-potion-99'; },
      (s: SliceState) => { s.cultivator.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.cultivator.bottles[0]!.acquiredWeek = 4; },
      (s: SliceState) => { s.cultivator.bottles[0]!.acquiredWeek = 6; },
      (s: SliceState) => { s.cultivator.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.cultivator.bottles[0]!.outcome = 'FAILURE'; },
      (s: SliceState) => { s.cultivator.bottles[1]!.outcome = 'SUCCESS'; },
      (s: SliceState) => { s.cultivator.guidanceKnown = false; },
      (s: SliceState) => { s.cultivator.discovered = false; },
      (s: SliceState) => { delete s.progression.mastery['mother.s9.cultivation-knowledge']; },
      (s: SliceState) => { s.progression.mastery['mother.s9.cultivation-knowledge'] = 501; },
      (s: SliceState) => { s.progression.mastery['assassin.s9.vision'] = 0; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateCultivatorState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.cultivator.resupply.deliveries = 0; },
      (s: SliceState) => { s.cultivator.bottles[3]!.id = 'cultivator-potion-7'; },
      (s: SliceState) => { s.cultivator.bottles[3]!.source = s.cultivator.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.cultivator.bottles[4]!.source = s.cultivator.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.cultivator.bottles[0]!.status = 'PLAYER'; s.cultivator.bottles[0]!.outcome = null; s.cultivator.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.cultivator.bottles[3]!.status = 'PLAYER'; s.cultivator.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.cultivator.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateCultivatorState(s)).toBe(false); }
    const early = guided(); early.week = 4;
    expect(validateCultivatorState(early)).toBe(false);
  });

  it('separates verified names from explicitly original, bounded S9 care and finite supplies', () => {
    expect(CULTIVATOR_ABILITIES.map(a => a.id)).toEqual([...CULTIVATOR_ABILITY_IDS]);
    for (const boundary of [
      '第三部第225章', '序列9耕种者→序列8医师→序列7丰收祭司', '第三部第226章',
      '回忆医师时期曾让植物生长', '不能据此把医师表现下放', '实际序列9能力表与完整配方尚未核实',
      '三项能力均为本作原创G', '不瞬间制造粮食', '不控制天气', '弗兰克序列6生物学家的杂交改造',
      '原创成年引导者', '伊芙·莫兰', '贝克兰德小苗圃', '不自动建立大地母神教会',
    ]) expect(CULTIVATOR_SOURCE_STATUS).toContain(boundary);
    expect(CULTIVATOR_ABILITIES.every(a => a.description.startsWith('本作原创G'))).toBe(true);
    expect(CULTIVATOR_FORMULA_STATUS).toContain('不是魔药配方或原料');
    const s = promoted(), p = projectCultivator(s);
    expect(p.abilities).toHaveLength(3);
    expect(p.abilities.every(a => a.mastery === 0)).toBe(true);
    expect(p.risk).toContain('只适用于本次指导服药');
    expect(p.risk).toContain('停止本次操作不会返还已经消耗的种子与水');
    expect(p.digestion).toContain('本作原创G');
    expect(p.formula).toEqual([]);
    expect(p).not.toHaveProperty('instantFood');
    expect(p).not.toHaveProperty('weatherControl');
    expect(p).not.toHaveProperty('hybridization');
    expect(p).not.toHaveProperty('automaticChurchMembership');
    expect(p.insideCase).toBe(false);
    s.cultivator.cases['soil-record']!.contactOpen = true;
    expect(projectCultivator(s).insideCase).toBe(true);
    expect(projectCultivator(s).actions.every(a => !a.enabled)).toBe(true);
  });

  it('starts with an independent, empty finite garden rather than free seeds or produce', () => {
    const s = ordinary();
    expect(s.cultivator.garden).toEqual({ suppliesBought: false, seeds: 0, water: 0, plantedWeek: null, caredWeek: null, harvestWeek: null, produce: 0, delivered: 0 });
    const separate = createCultivatorState();
    separate.garden.seeds = 3;
    expect(s.cultivator.garden.seeds).toBe(0);
    for (const state of [guided(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(state.cultivator.garden).toEqual(s.cultivator.garden);
      expect(validateCultivatorState(state)).toBe(true);
    }
  });

  it('checks exact garden fields, finite numeric ranges, promotion and basic date chronology', () => {
    const blank = createCultivatorState().garden;
    const purchased = promoted();
    purchased.week = 8;
    purchased.cultivator.garden = { ...blank, suppliesBought: true, seeds: 3, water: 2 };
    expect(validateCultivatorState(purchased)).toBe(true);
    const planted = structuredClone(purchased);
    planted.cultivator.garden = { ...blank, suppliesBought: true, water: 1, plantedWeek: 5 };
    expect(validateCultivatorState(planted)).toBe(true);
    const cared = structuredClone(planted);
    cared.cultivator.garden.water = 0;
    cared.cultivator.garden.caredWeek = 6;
    expect(validateCultivatorState(cared)).toBe(true);
    const harvested = structuredClone(cared);
    harvested.cultivator.garden.harvestWeek = 7;
    harvested.cultivator.garden.produce = 2;
    expect(validateCultivatorState(harvested)).toBe(true);
    const delivered = structuredClone(harvested);
    delivered.cultivator.garden.produce = 1;
    delivered.cultivator.garden.delivered = 1;
    expect(validateCultivatorState(delivered)).toBe(true);

    for (const [field, values] of [
      ['seeds', [-1, 4, 0.5, Number.NaN]], ['water', [-1, 3, 0.5]],
      ['produce', [-1, 3, Number.POSITIVE_INFINITY]], ['delivered', [-1, 2, 0.5]],
      ['suppliesBought', [0, 'true', null]],
    ] as const) for (const value of values) {
      const s = structuredClone(delivered);
      (s.cultivator.garden as unknown as Record<string, unknown>)[field] = value;
      expect(validateCultivatorState(s)).toBe(false);
    }
    for (const mutate of [
      (s: SliceState) => { delete (s.cultivator.garden as unknown as Record<string, unknown>).water; },
      (s: SliceState) => { (s.cultivator.garden as unknown as Record<string, unknown>).weather = 'rain'; },
      (s: SliceState) => { s.cultivator.garden.suppliesBought = false; },
      (s: SliceState) => { s.cultivator.garden.plantedWeek = 4; },
      (s: SliceState) => { s.cultivator.garden.plantedWeek = 9; },
      (s: SliceState) => { s.cultivator.garden.plantedWeek = null; },
      (s: SliceState) => { s.cultivator.garden.caredWeek = 5; },
      (s: SliceState) => { s.cultivator.garden.caredWeek = null; },
      (s: SliceState) => { s.cultivator.garden.caredWeek = 8; },
      (s: SliceState) => { s.cultivator.garden.harvestWeek = 6; },
      (s: SliceState) => { s.cultivator.garden.harvestWeek = null; },
      (s: SliceState) => { s.cultivator.garden.harvestWeek = 9; },
    ]) {
      const s = structuredClone(delivered); mutate(s);
      expect(validateCultivatorState(s)).toBe(false);
    }
    const unpromoted = guided();
    unpromoted.cultivator.garden = { ...purchased.cultivator.garden };
    expect(validateCultivatorState(unpromoted)).toBe(false);
  });
});
