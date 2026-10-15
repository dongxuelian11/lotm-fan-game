import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import {
  applyPrisonerCommand, createPrisonerState, isPrisonerAcquisitionCommand, projectPrisoner,
  validatePrisonerCommand, validatePrisonerState,
} from '../../src/domain/prisoner/index.js';
import { PRISONER_ABILITIES, PRISONER_BOTTLE_IDS, PRISONER_FORMULA_STATUS, PRISONER_SOURCE_STATUS } from '../../src/domain/prisoner/content.js';
import { PRISONER_ABILITY_IDS, PRISONER_CASE_IDS, type PrisonerAcquisitionCommand } from '../../src/domain/prisoner/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('prisoner-acquisition', sliceDefaultCreationSelection, 'prisoner-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.prisoner = createPrisonerState();
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
function apply(s: SliceState, command: PrisonerAcquisitionCommand, roll = 20) { applyPrisonerCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.prisoner.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of PRISONER_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: PrisonerAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Prisoner finite finished-potion acquisition', () => {
  it('starts with three independent originals and untouched private cases, without a recipe', () => {
    const s = ordinary(), p = projectPrisoner(s);
    expect(validatePrisonerState(s)).toBe(true);
    expect(s.prisoner.bottles.map(b => b.id)).toEqual([...PRISONER_BOTTLE_IDS]);
    expect(s.prisoner.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.prisoner.cases)).toEqual([...PRISONER_CASE_IDS]);
    expect(Object.values(s.prisoner.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.outcome === 'NONE' && !w.holding && w.returns === 0)).toBe(true);
    expect(s.prisoner.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], insideCase: false, environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('prisoner-potion-');
    expect(s.prisoner).not.toHaveProperty('draft');
    const separate = createPrisonerState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['jammed-shutter']!.holding = true;
    expect(s.prisoner.bottles[0]!.labourSteps).toBe(0);
    expect(s.prisoner.cases['jammed-shutter']!.holding).toBe(false);
  });

  it('charges one AP for discovery and one AP plus 120 pence for guidance, granting no magic', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applyPrisonerCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.prisoner.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(projectPrisoner(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: PRISONER_BOTTLE_IDS[0] });
    applyPrisonerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.prisoner.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectPrisoner(s).supplies).toContain(PRISONER_FORMULA_STATUS);
    expect(projectPrisoner(s).formulaKnown).toBe(false);
    expect(projectPrisoner(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validatePrisonerState(s)).toBe(true);
  });

  it('transfers exactly one original for 660 pence at zero AP without partial labour discounts', () => {
    const s = guided(), otherBottles = JSON.stringify(s.prisoner.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: PRISONER_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: PRISONER_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.prisoner.bottles.slice(1))).toBe(otherBottles);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validatePrisonerState(s)).toBe(true);
  });

  it('requires both real ordinary jobs on the same bottle, then 60 pence; no learned power or pollution', () => {
    const s = guided(), bottle = s.prisoner.bottles[0]!, ctx = context(s), pollution = s.seer.pollution;
    applyPrisonerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectPrisoner(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyPrisonerCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成普通工具编号核对', '完成工作台与空箱整理']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectPrisoner(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectPrisoner(s).actions.find(a => a.id === `buy-${PRISONER_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.prisoner.cases).toEqual(createPrisonerState().cases);
    expect(s.seer.pollution).toBe(pollution);
    expect(validatePrisonerState(s)).toBe(true);
  });

  it('rejects insufficient funds, unavailable originals and insufficient AP before mutation', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['prisoner-potion-4', 'assassin-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: PRISONER_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: PRISONER_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: PRISONER_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: PRISONER_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: PRISONER_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('opens discovery only after four full ordinary weeks, with a separately confirmed potion', () => {
    const s = ordinary();
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(validatePrisonerState(s)).toBe(true);
      expect(projectPrisoner(s).actions[0]!.reason).toContain(`${week - 1}/4`);
      expect(projectPrisoner(s).bottles).toEqual([]);
      rejected(s, { type: 'DISCOVER' });
      rejected(s, { type: 'LEARN_GUIDANCE' });
      rejected(s, { type: 'BUY_POTION', bottleId: PRISONER_BOTTLE_IDS[0] });
    }
    s.week = 5;
    expect(projectPrisoner(s).actions[0]!.enabled).toBe(true);
    guided(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[0], confirmed: false } as unknown as PrisonerAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[0], confirmed: true });
    expect(s.prisoner.bottles[0]).toMatchObject({ acquiredWeek: 5, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validatePrisonerState(s)).toBe(true);
  });

  it('uses one will difficulty-five check for each of the four recoverable outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applyPrisonerCommand(s, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.prisoner.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'chained' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(PRISONER_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 2, perception: stats.perception + 1, will: stats.will + 1, knowledge: stats.knowledge } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validatePrisonerState(s)).toBe(true);
    }
  });

  it('caps stat increases without refilling spirituality and preserves rejected bottles through real recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectPrisoner(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.prisoner.bottles[0]!.status).toBe('CONSUMED');
    expect(validatePrisonerState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: PRISONER_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.prisoner.bottles[0]).toEqual(failed.prisoner.bottles[0]);
  });

  it('retains unused originals and prevents selecting another pathway after promotion', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: PRISONER_BOTTLE_IDS[2] });
    expect(s.prisoner.bottles[1]!.status).toBe('PLAYER');
    expect(projectPrisoner(s).actions.find(a => a.id === `consume-${PRISONER_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared();
    other.progression.pathwayId = 'demoness'; other.progression.sequence = 9; other.progression.promotionWeek = 5;
    rejected(other, { type: 'CONSUME', bottleId: PRISONER_BOTTLE_IDS[0], confirmed: true });
    expect(other.prisoner.bottles[0]!.status).toBe('PLAYER');
    expect(validatePrisonerState(s)).toBe(true);
  });

  it('resupplies only after all failures, an explicit one-AP request, and a later real week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectPrisoner(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.prisoner.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const cash = s.cash;
    s = applySliceIntent(s, { type: 'PRISONER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.prisoner.resupply.requestedWeek, s.actionsRemaining, s.cash]).toEqual([5, 1, cash]);
    expect(s.date).toEqual(priorDate);
    expect(s.prisoner.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6);
    s.activeEvent = null; s.eventQueue = [];
    const ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'PRISONER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.prisoner.resupply.deliveries, s.prisoner.resupply.requestedWeek, s.actionsRemaining]).toEqual([1, null, ap]);
    expect(JSON.stringify(s.prisoner.bottles.slice(0, 3))).toBe(originals);
    expect(s.prisoner.bottles.slice(3).map(b => b.id)).toEqual(['prisoner-potion-4', 'prisoner-potion-5', 'prisoner-potion-6']);
    expect(s.prisoner.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    buy(s, 3);
    apply(s, { type: 'CONSUME', bottleId: 'prisoner-potion-4', confirmed: true }, 1);
    expect(s.progression.pathwayId).toBe('chained');
    expect(s.prisoner.bottles[3]).toMatchObject({ status: 'CONSUMED', acquiredWeek: 6, consumedWeek: 6, outcome: 'GREAT_SUCCESS' });
    expect(validatePrisonerState(s)).toBe(true);
  });

  it('rejects event, combat, city, lifecycle, health, mind and held-original blockers without mutation', () => {
    for (const blocker of ['event', 'combat', 'city', 'dead', 'complete', 'health', 'mind', 'held-original']) {
      const s = guided();
      if (blocker === 'event') s.activeEvent = { id: 'blocked', instanceId: 'blocked-1' };
      if (blocker === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
      if (blocker === 'city') s.world.city = 'ELSEWHERE';
      if (blocker === 'dead') s.status = 'DEAD';
      if (blocker === 'complete') s.status = 'SLICE_COMPLETE';
      if (blocker === 'health') s.health = 0;
      if (blocker === 'mind') s.mind = 0;
      if (blocker === 'held-original') s.prisoner.cases['jammed-shutter']!.holding = true;
      rejected(s, { type: 'BUY_POTION', bottleId: PRISONER_BOTTLE_IDS[0] });
      rejected(s, { type: 'POTION_WORK', bottleId: PRISONER_BOTTLE_IDS[0] });
      expect(projectPrisoner(s).actions.every(action => !action.enabled)).toBe(true);
    }
  });

  it('validates exact commands, all preparation methods and actual return', () => {
    for (const command of [
      { type: 'DISCOVER' }, { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'BUY_POTION', bottleId: 'prisoner-potion-4' }, { type: 'POTION_WORK', bottleId: 'prisoner-potion-1' },
      { type: 'CONSUME', bottleId: 'prisoner-potion-1', confirmed: true },
      { type: 'OBSERVE', caseId: 'echo-room' }, { type: 'PERFORM', caseId: 'shared-exit' },
      { type: 'PREPARE', caseId: 'shared-exit', method: 'ABILITY' }, { type: 'PREPARE', caseId: 'echo-room', method: 'ORDINARY' },
      { type: 'RETURN', caseId: 'jammed-shutter' }, { type: 'WITHDRAW', caseId: 'jammed-shutter' },
      { type: 'REPORT', caseId: 'jammed-shutter' }, { type: 'REPORT', caseId: 'shared-exit' },
    ]) expect(validatePrisonerCommand(command)).toBe(true);
    expect(isPrisonerAcquisitionCommand({ type: 'BUY_POTION', bottleId: 'prisoner-potion-1' })).toBe(true);
    expect(isPrisonerAcquisitionCommand({ type: 'RETURN', caseId: 'jammed-shutter' })).toBe(false);
    for (const command of [
      null, [], {}, { type: 'READ_MIND' }, { type: 'LEARN_FORMULA' }, { type: 'BREW', batchId: 'prisoner-potion-1' },
      { type: 'DISCOVER', free: true }, { type: 'BUY_POTION', bottleId: 'prisoner-potion-0' }, { type: 'BUY_POTION', bottleId: 'prisoner-potion-01' },
      { type: 'BUY_POTION', bottleId: 'prisoner-potion-1000000000000000' }, { type: 'BUY_POTION', bottleId: 'assassin-potion-1' },
      { type: 'CONSUME', bottleId: 'prisoner-potion-1' }, { type: 'CONSUME', bottleId: 'prisoner-potion-1', confirmed: false },
      { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'echo-room', method: 'SKILL' },
      { type: 'PREPARE', caseId: 'jammed-shutter', method: 'TAKE' },
      { type: 'REPORT' }, { type: 'REPORT', caseId: 'echo-room', claim: 'COMPLETE' },
      { type: 'RETURN', caseId: 'jammed-shutter', immune: true },
    ]) expect(validatePrisonerCommand(command)).toBe(false);
    const s = prepared();
    rejected(s, { type: 'RETURN', caseId: 'jammed-shutter' } as unknown as PrisonerAcquisitionCommand);
  });

  it('keeps every new scene untouched before promotion and rejects malformed exact state shapes', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) {
      expect(validatePrisonerState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
      expect(s.prisoner.cases).toEqual(createPrisonerState().cases);
      expect(projectPrisoner(s).cases).toEqual([]);
    }
    for (const mutate of [
      (s: SliceState) => { s.prisoner.cases['echo-room']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.prisoner.cases['echo-room']!.attemptWeek = 5; },
      (s: SliceState) => { s.prisoner.cases['echo-room']!.withdrawals = 1; },
      (s: SliceState) => { s.prisoner.cases['echo-room']!.method = 'ABILITY'; },
      (s: SliceState) => { s.prisoner.cases['echo-room']!.outcome = 'DRAFT_IDENTIFIED'; },
      (s: SliceState) => { s.prisoner.cases['jammed-shutter']!.holding = true; },
      (s: SliceState) => { s.prisoner.cases['jammed-shutter']!.returns = 1; },
      (s: SliceState) => { s.prisoner.reflected = true; },
      (s: SliceState) => { s.progression.mastery['chained.s9.prisoner-body'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validatePrisonerState(s)).toBe(false); }
    const rawCase = (s: SliceState) => s.prisoner.cases['jammed-shutter'] as unknown as Record<string, unknown>;
    for (const mutate of [
      (s: SliceState) => { delete s.prisoner.cases['jammed-shutter']; },
      (s: SliceState) => { s.prisoner.cases['copy'] = { ...s.prisoner.cases['jammed-shutter']! }; },
      (s: SliceState) => { rawCase(s).status = 'IMAGINED'; },
      (s: SliceState) => { rawCase(s).method = 'MAGIC'; },
      (s: SliceState) => { rawCase(s).outcome = 'TOKEN_COVERED'; },
      (s: SliceState) => { rawCase(s).holding = 'true'; },
      (s: SliceState) => { rawCase(s).tookOriginal = 'true'; },
      (s: SliceState) => { s.prisoner.cases['shared-exit']!.returns = 1; },
      (s: SliceState) => { s.prisoner.cases['echo-room']!.holding = true; },
      (s: SliceState) => { rawCase(s).attemptWeek = 4; },
      (s: SliceState) => { rawCase(s).attemptWeek = 6; },
      (s: SliceState) => { rawCase(s).withdrawals = -1; },
      (s: SliceState) => { rawCase(s).returns = -1; },
      (s: SliceState) => { rawCase(s).returns = 0.5; },
      (s: SliceState) => { rawCase(s).returns = Number.MAX_SAFE_INTEGER + 1; },
      (s: SliceState) => { rawCase(s).secret = 'unknown'; },
      (s: SliceState) => { delete rawCase(s).holding; },
      (s: SliceState) => { (s.prisoner as unknown as Record<string, unknown>).draft = {}; },
      (s: SliceState) => { (s.prisoner as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validatePrisonerState(s)).toBe(false); }
  });

  it('rejects forged provenance, invalid bottle history, missing success and future batch dates', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.prisoner.bottles[0]!.source = 'invented'; },
      (s: SliceState) => { s.prisoner.bottles[0]!.id = 'prisoner-potion-99'; },
      (s: SliceState) => { s.prisoner.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.prisoner.bottles[0]!.acquiredWeek = 4; },
      (s: SliceState) => { s.prisoner.bottles[0]!.acquiredWeek = 6; },
      (s: SliceState) => { s.prisoner.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.prisoner.bottles[0]!.outcome = 'FAILURE'; },
      (s: SliceState) => { s.prisoner.bottles[1]!.outcome = 'SUCCESS'; },
      (s: SliceState) => { s.prisoner.guidanceKnown = false; },
      (s: SliceState) => { s.prisoner.discovered = false; },
      (s: SliceState) => { delete s.progression.mastery['chained.s9.prisoner-body']; },
      (s: SliceState) => { s.progression.mastery['chained.s9.prisoner-body'] = 501; },
      (s: SliceState) => { s.progression.mastery['assassin.s9.vision'] = 0; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validatePrisonerState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.prisoner.resupply.deliveries = 0; },
      (s: SliceState) => { s.prisoner.bottles[3]!.id = 'prisoner-potion-7'; },
      (s: SliceState) => { s.prisoner.bottles[3]!.source = s.prisoner.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.prisoner.bottles[4]!.source = s.prisoner.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.prisoner.bottles[0]!.status = 'PLAYER'; s.prisoner.bottles[0]!.outcome = null; s.prisoner.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.prisoner.bottles[3]!.status = 'PLAYER'; s.prisoner.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.prisoner.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validatePrisonerState(s)).toBe(false); }
    const early = guided(); early.week = 4;
    expect(validatePrisonerState(early)).toBe(false);
  });

  it('separates verified sequence-nine bounds from G supply, ordinary objects and temperance', () => {
    expect(PRISONER_ABILITIES.map(a => a.id)).toEqual([...PRISONER_ABILITY_IDS]);
    for (const boundary of [
      '第二部第118章《被诅咒者》', 'L59584–59620', '强壮身体、敏锐感知', '普通物品',
      '第二部第117章《莎伦和马里奇的理念》', 'L59463–59481', '节制、不伤害',
      '不保证成长就能消除诅咒', '序列8', '当前理智', '精神抵抗',
      '序列7狼人的愈合和利爪', '序列6活尸的护甲与尸体控制',
      '虚构序列名称', '不自动判定玩家犯罪', '关进监狱',
      '原创成年旧工坊管理员', '哈伦·维斯', '不自动建立玫瑰学派',
    ]) expect(PRISONER_SOURCE_STATUS).toContain(boundary);
    const s = promoted(), p = projectPrisoner(s);
    expect(p.abilities).toHaveLength(3);
    expect(p.abilities.every(a => a.mastery === 0)).toBe(true);
    expect(p.risk).toContain('只适用于本次指导服药');
    expect(p.risk).toContain('不保证消除诅咒');
    expect(p.digestion).toContain('本作原创G');
    expect(p.formula).toEqual([]);
    expect(p).not.toHaveProperty('dangerForecast');
    expect(p).not.toHaveProperty('madness');
    expect(p.insideCase).toBe(false);
    s.prisoner.cases['jammed-shutter']!.holding = true;
    expect(projectPrisoner(s).insideCase).toBe(true);
    expect(projectPrisoner(s).actions.every(a => !a.enabled)).toBe(true);
  });
});
