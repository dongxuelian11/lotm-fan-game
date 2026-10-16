import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import {
  applySailorCommand, createSailorState, isSailorAcquisitionCommand, projectSailor,
  validateSailorCommand, validateSailorState,
} from '../../src/domain/sailor/index.js';
import { SAILOR_ABILITIES, SAILOR_BOTTLE_IDS, SAILOR_FORMULA_STATUS, SAILOR_SOURCE_STATUS } from '../../src/domain/sailor/content.js';
import { SAILOR_ABILITY_IDS, SAILOR_CASE_IDS, type SailorAcquisitionCommand } from '../../src/domain/sailor/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('sailor-acquisition', sliceDefaultCreationSelection, 'sailor-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.sailor = createSailorState();
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
function apply(s: SliceState, command: SailorAcquisitionCommand, roll = 20) { applySailorCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.sailor.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of SAILOR_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() {
  const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' }); return s;
}
function rejected(s: SliceState, command: SailorAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Sailor finite finished-potion acquisition', () => {
  it('starts with three separate originals and untouched case state, exposing no undiscovered inventory', () => {
    const s = ordinary(), p = projectSailor(s);
    expect(validateSailorState(s)).toBe(true);
    expect(s.sailor.bottles.map(b => b.id)).toEqual([...SAILOR_BOTTLE_IDS]);
    expect(s.sailor.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.sailor.cases)).toEqual([...SAILOR_CASE_IDS]);
    expect(Object.values(s.sailor.cases).every(w => w.status === 'AVAILABLE' && w.attemptWeek === null && w.withdrawals === 0 && w.method === null && w.rope === 'OWNER' && w.target === 'WAITING')).toBe(true);
    expect(s.sailor.reflected).toBe(false);
    expect(p).toMatchObject({ formulaKnown: false, formula: [], cases: [], environment: '', bottles: [], abilities: [] });
    expect(p.actions.map(a => a.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toContain('sailor-potion-');
    const separate = createSailorState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['rescue-drill']!.status = 'SURVEYED';
    expect(s.sailor.bottles[0]!.labourSteps).toBe(0);
    expect(s.sailor.cases['rescue-drill']!.status).toBe('AVAILABLE');
  });

  it('charges discovery and guidance exactly, without magic, organization membership or a recipe', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), world = JSON.stringify(s.world), ctx = context(s);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    applySailorCommand(s, { type: 'DISCOVER' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.sailor.discovered]).toEqual([39, 10000, true]);
    expect(ctx.notes[0]!.text).toContain('没有建立任何教会或组织身份');
    expect(projectSailor(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'BUY_POTION', bottleId: SAILOR_BOTTLE_IDS[0] });
    applySailorCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.actionsRemaining, s.cash, s.sailor.guidanceKnown]).toEqual([38, 9880, true]);
    expect(projectSailor(s).supplies).toContain(SAILOR_FORMULA_STATUS);
    expect(projectSailor(s).formulaKnown).toBe(false);
    expect(projectSailor(s).formula).toEqual([]);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.world)).toBe(world);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateSailorState(s)).toBe(true);
  });

  it('buys only the selected original for 660 pence and zero AP, with no partial labour discount', () => {
    const s = guided(), untouched = JSON.stringify(s.sailor.bottles.slice(1));
    apply(s, { type: 'POTION_WORK', bottleId: SAILOR_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(bottle).toMatchObject({ id: SAILOR_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null, labourSteps: 1 });
    expect(JSON.stringify(s.sailor.bottles.slice(1))).toBe(untouched);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateSailorState(s)).toBe(true);
  });

  it('requires two real one-AP jobs on the same bottle, then 60 pence to transfer that original', () => {
    const s = guided(), bottle = s.sailor.bottles[0]!, ctx = context(s);
    applySailorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([1, 9880, 37, 'SUPPLIER']);
    expect(projectSailor(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applySailorCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect(ctx.notes.map(n => n.title)).toEqual(['完成绳具清点', '完成码头护栏养护']);
    expect([bottle.labourSteps, s.cash, s.actionsRemaining, bottle.status]).toEqual([2, 9880, 36, 'SUPPLIER']);
    expect(projectSailor(s).actions.find(a => a.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectSailor(s).actions.find(a => a.id === `buy-${SAILOR_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(s.progression.mastery).toEqual({});
    expect(s.sailor.cases).toEqual(createSailorState().cases);
    expect(validateSailorState(s)).toBe(true);
  });

  it('rejects insufficient funds, unowned or foreign bottles and AP-consuming preparation atomically', () => {
    const s = ordinary(); s.actionsRemaining = 0; rejected(s, { type: 'DISCOVER' }); s.actionsRemaining = 40;
    apply(s, { type: 'DISCOVER' }); s.cash = 119; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000; s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' }); s.actionsRemaining = 40;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['sailor-potion-4', 'hunter-potion-1', 'savant-potion-1', 'seer-batch-1:bottle']) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659; rejected(s, { type: 'BUY_POTION', bottleId: SAILOR_BOTTLE_IDS[0] });
    s.actionsRemaining = 0; rejected(s, { type: 'POTION_WORK', bottleId: SAILOR_BOTTLE_IDS[0] }); s.actionsRemaining = 2;
    apply(s, { type: 'POTION_WORK', bottleId: SAILOR_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: SAILOR_BOTTLE_IDS[0] });
    s.cash = 59; rejected(s, { type: 'BUY_POTION', bottleId: SAILOR_BOTTLE_IDS[0] });
    s.cash = 60; buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([0, 0]);
  });

  it('allows early preparation but requires four completed ordinary weeks and independent confirmation', () => {
    const s = ordinary(); s.week = 1; guided(s); buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectSailor(s).actions.find(a => a.id === `consume-${SAILOR_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: false } as unknown as SailorAcquisitionCommand);
    rejected(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[1], confirmed: true });
    s.actionsRemaining = 0;
    apply(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true });
    expect(s.sailor.bottles[0]).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(s.actionsRemaining).toBe(0);
    expect(validateSailorState(s)).toBe(true);
  });

  it('uses exactly one will difficulty-five check for all four recoverable promotion outcomes', () => {
    for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, ctx = context(s, roll), ap = s.actionsRemaining, cash = s.cash;
      s.spirituality = 7;
      applySailorCommand(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 5]]);
      expect(ctx.draws).toEqual([]);
      expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
      expect(s.status).toBe('ACTIVE');
      expect(s.sailor.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
      expect(s.progression).toMatchObject({ pathwayId: success ? 'tyrant' : null, sequence: success ? 9 : null, promotionWeek: success ? 5 : null, acting: 0 });
      expect(s.progression.mastery).toEqual(success ? Object.fromEntries(SAILOR_ABILITY_IDS.map(id => [id, 0])) : {});
      expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 4, perception: stats.perception + 2, will: stats.will + 1, knowledge: stats.knowledge } : stats);
      expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
      expect(validateSailorState(s)).toBe(true);
    }
  });

  it('never refills spirituality, caps enhanced stats, and preserves severe rejection for actual recovery', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectSailor(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 499; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(s.spirituality).toBe(0);
    const failed = prepared(); failed.health = 1; failed.mind = 1;
    apply(failed, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([failed.health, failed.mind, failed.seer.pollution, failed.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(failed.sailor.bottles[0]!.status).toBe('CONSUMED');
    expect(validateSailorState(failed)).toBe(true);
    rejected(failed, { type: 'BUY_POTION', bottleId: SAILOR_BOTTLE_IDS[1] });
    const rested = applySliceIntent(failed, { type: 'ACTION', action: 'REST' });
    expect(rested.health).toBeGreaterThan(failed.health);
    expect(rested.mind).toBeGreaterThan(failed.mind);
    expect(rested.seer.pollution).toBe(40);
    expect(rested.sailor.bottles[0]).toEqual(failed.sailor.bottles[0]);
  });

  it('retains unused originals and blocks second promotion or changing an already chosen pathway', () => {
    const s = prepared(); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: SAILOR_BOTTLE_IDS[2] });
    expect(s.sailor.bottles[1]!.status).toBe('PLAYER');
    expect(projectSailor(s).actions.find(a => a.id === `consume-${SAILOR_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    const other = prepared(), c = context(other).c;
    applySeerCommand(other, { type: 'DISCOVER' }, c);
    applySeerCommand(other, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(other, { type: 'BUY_MATERIALS', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'BREW', batchId: other.seer.batches[0]!.id }, c);
    applySeerCommand(other, { type: 'CONSUME', bottleId: other.seer.bottles[0]!.id, confirmed: true }, c);
    expect(other.progression.pathwayId).toBe('diviner');
    rejected(other, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true });
    expect(other.sailor.bottles[0]!.status).toBe('PLAYER');
    expect(validateSailorState(other)).toBe(true);
    expect(validateSailorState(s)).toBe(true);
  });

  it('only resupplies after all failures, an explicit paid-AP request, and a later actual week', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    let s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(projectSailor(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const originals = JSON.stringify(s.sailor.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' }); s.actionsRemaining = 2;
    const requestCash = s.cash;
    s = applySliceIntent(s, { type: 'SAILOR', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.sailor.resupply.requestedWeek]).toEqual([5, 1, requestCash, 5]);
    expect(JSON.stringify(s.sailor.bottles)).toBe(originals);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6); expect(s.date).not.toEqual(priorDate);
    expect(s.sailor.bottles).toHaveLength(3);
    const cash = s.cash, ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'SAILOR', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap]);
    expect(s.sailor.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.sailor.bottles.slice(3).map(b => b.id)).toEqual(['sailor-potion-4', 'sailor-potion-5', 'sailor-potion-6']);
    expect(s.sailor.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第6周实收入库'))).toBe(true);
    expect(JSON.stringify(s.sailor.bottles.slice(0, 3))).toBe(originals);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'sailor-potion-4', confirmed: true });
    buy(s, 3);
    expect(s.cash).toBe(cash - 660);
    apply(s, { type: 'CONSUME', bottleId: 'sailor-potion-4', confirmed: true });
    expect(s.progression.pathwayId).toBe('tyrant');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.sailor.bottles.slice(0, 3))).toBe(originals);
    expect(validateSailorState(s)).toBe(true);
  });

  it('rejects event, combat, city, lifecycle, health and mind blockers before changing any state', () => {
    for (const blocker of ['event', 'combat', 'city', 'dead', 'complete', 'health', 'mind']) {
      const s = guided();
      if (blocker === 'event') s.activeEvent = { id: 'blocked', instanceId: 'blocked-1' };
      if (blocker === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
      if (blocker === 'city') s.world.city = 'ELSEWHERE';
      if (blocker === 'dead') s.status = 'DEAD';
      if (blocker === 'complete') s.status = 'SLICE_COMPLETE';
      if (blocker === 'health') s.health = 0;
      if (blocker === 'mind') s.mind = 0;
      rejected(s, { type: 'BUY_POTION', bottleId: SAILOR_BOTTLE_IDS[0] });
    }
  });

  it('accepts only exact acquisition and finite dockside commands, without a recipe or higher-sequence action', () => {
    for (const type of ['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'REFLECT']) expect(validateSailorCommand({ type })).toBe(true);
    for (const type of ['POTION_WORK', 'BUY_POTION']) expect(validateSailorCommand({ type, bottleId: 'sailor-potion-4' })).toBe(true);
    expect(validateSailorCommand({ type: 'CONSUME', bottleId: 'sailor-potion-1', confirmed: true })).toBe(true);
    for (const caseId of SAILOR_CASE_IDS) {
      for (const type of ['SURVEY', 'PREPARE', 'WITHDRAW']) expect(validateSailorCommand({ type, caseId })).toBe(true);
      for (const method of ['ABILITY', 'TEAM']) expect(validateSailorCommand({ type: 'PERFORM', caseId, method })).toBe(true);
    }
    for (const invalid of [
      null, [], {}, { type: 'BREW' }, { type: 'LEARN_FORMULA' }, { type: 'RAGE' }, { type: 'WATER_MAGIC' },
      { type: 'ENCOUNTER_FIGHT' }, { type: 'DISCOVER', free: true },
      { type: 'SURVEY', caseId: 'unknown' }, { type: 'SURVEY', caseId: 'moored-barrel', force: true },
      { type: 'PREPARE', caseId: 'wet-gangway', rope: 'invented' },
      { type: 'PERFORM', caseId: 'rescue-drill', method: 'INFINITE_BREATH' },
      { type: 'PERFORM', caseId: 'rescue-drill' }, { type: 'REFLECT', caseId: 'moored-barrel' },
      { type: 'WITHDRAW', caseId: 'rescue-drill', success: true },
      { type: 'BUY_POTION', bottleId: 'sailor-potion-0' }, { type: 'BUY_POTION', bottleId: 'sailor-potion-01' },
      { type: 'BUY_POTION', bottleId: 'reader-potion-1' }, { type: 'CONSUME', bottleId: 'sailor-potion-1' },
      { type: 'CONSUME', bottleId: 'sailor-potion-1', confirmed: false },
    ]) expect(validateSailorCommand(invalid)).toBe(false);
    expect(isSailorAcquisitionCommand({ type: 'DISCOVER' })).toBe(true);
    expect(isSailorAcquisitionCommand({ type: 'REFLECT' })).toBe(false);
    expect(isSailorAcquisitionCommand({ type: 'SURVEY', caseId: 'moored-barrel' })).toBe(false);
    expect(isSailorAcquisitionCommand({ type: 'PERFORM', caseId: 'rescue-drill', method: 'TEAM' })).toBe(false);
    const s = guided();
    for (const invalid of [
      { type: 'REFLECT' }, { type: 'SURVEY', caseId: 'moored-barrel' },
      { type: 'PREPARE', caseId: 'wet-gangway' }, { type: 'PERFORM', caseId: 'rescue-drill', method: 'ABILITY' },
      { type: 'WITHDRAW', caseId: 'moored-barrel' },
      { type: 'BUY_POTION', bottleId: SAILOR_BOTTLE_IDS[0], cost: 0 },
    ]) rejected(s, invalid as unknown as SailorAcquisitionCommand);
  });

  it('projects sourced S9 boundaries, no fabricated recipe or higher powers, and detached public data', () => {
    const s = prepared(); buy(s, 1); apply(s, { type: 'CONSUME', bottleId: SAILOR_BOTTLE_IDS[0], confirmed: true });
    const before = JSON.stringify(s), p = projectSailor(s), text = JSON.stringify(SAILOR_ABILITIES);
    expect(p.abilities.map(a => a.id)).toEqual([...SAILOR_ABILITY_IDS]);
    expect(p.story).toBe(SAILOR_SOURCE_STATUS);
    expect(p.story).toContain('第一部第6章');
    expect(p.story).toContain('至少十分钟');
    expect(p.story).toContain('本作原创G');
    expect(p.story).toContain('不是现实潜水建议');
    for (const boundary of ['实际水域', '滑腻幻鳞', '无限呼吸', '深水压免疫', '防弹', '原绳具', '序列8暴怒', '序列7水系法术', '风暴']) expect(text).toContain(boundary);
    expect(p.formulaKnown).toBe(false); expect(p.formula).toEqual([]);
    expect(p.risk).toContain('意志难度5'); expect(p.risk).toContain('不适用于战斗');
    expect(p.cases).toEqual([]); expect(p.acting).toBe(0);
    expect(Object.hasOwn(s.sailor, 'encounter')).toBe(false);
    p.abilities[0]!.mastery = 500; p.bottles[0]!.source = 'changed'; p.actions[0]!.label = 'changed';
    expect(JSON.stringify(s)).toBe(before);
  });

  it('rejects forged original identities, provenance, ownership, outcomes, delivery timing and abilities', () => {
    const base = promoted();
    for (const mutate of [
      (s: SliceState) => { s.sailor.discovered = false; },
      (s: SliceState) => { s.sailor.guidanceKnown = false; },
      (s: SliceState) => { s.sailor.bottles.pop(); },
      (s: SliceState) => { s.sailor.bottles[0]!.id = 'sailor-potion-2'; },
      (s: SliceState) => { s.sailor.bottles[0]!.source = 'fabricated formula'; },
      (s: SliceState) => { s.sailor.bottles[0]!.labourSteps = 3; },
      (s: SliceState) => { s.sailor.bottles[0]!.acquiredWeek = null; },
      (s: SliceState) => { s.sailor.bottles[0]!.consumedWeek = 4; },
      (s: SliceState) => { s.sailor.bottles[0]!.outcome = null; },
      (s: SliceState) => { s.sailor.bottles[0]!.status = 'PLAYER'; },
      (s: SliceState) => { s.progression.mastery['tyrant.s8.rage'] = 0; },
      (s: SliceState) => { delete s.progression.mastery['tyrant.s9.aquatic-affinity']; },
      (s: SliceState) => { s.progression.mastery['tyrant.s9.physique'] = 501; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.promotionWeek = 6; },
    ]) { const s = structuredClone(base); mutate(s); expect(validateSailorState(s)).toBe(false); }
    const delivery = resupplied();
    for (const mutate of [
      (s: SliceState) => { s.sailor.resupply.deliveries = 0; },
      (s: SliceState) => { s.sailor.bottles[3]!.id = 'sailor-potion-7'; },
      (s: SliceState) => { s.sailor.bottles[3]!.source = s.sailor.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (s: SliceState) => { s.week = 7; s.sailor.bottles[4]!.source = s.sailor.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (s: SliceState) => { s.sailor.bottles[0]!.status = 'PLAYER'; s.sailor.bottles[0]!.outcome = null; s.sailor.bottles[0]!.consumedWeek = null; },
      (s: SliceState) => { s.sailor.bottles[3]!.status = 'PLAYER'; s.sailor.bottles[3]!.acquiredWeek = 5; },
      (s: SliceState) => { s.sailor.resupply.requestedWeek = 6; },
    ]) { const s = structuredClone(delivery); mutate(s); expect(validateSailorState(s)).toBe(false); }
  });

  it('round-trips real states and rejects malformed or pre-promotion case activity', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) expect(validateSailorState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    for (const mutate of [
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.status = 'SURVEYED'; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.attemptWeek = 5; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.withdrawals = 1; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.method = 'ABILITY'; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.rope = 'ANCHORED'; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.target = 'SAFE'; },
      (s: SliceState) => { s.sailor.reflected = true; },
      (s: SliceState) => { s.progression.mastery['tyrant.s9.aquatic-affinity'] = 0; },
    ]) { const s = ordinary(); mutate(s); expect(validateSailorState(s)).toBe(false); }
    for (const mutate of [
      (s: SliceState) => { delete s.sailor.cases['rescue-drill']; },
      (s: SliceState) => { s.sailor.cases['invented'] = { status: 'AVAILABLE', attemptWeek: null, method: null, rope: 'OWNER', target: 'WAITING', withdrawals: 0 }; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.attemptWeek = 4; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.attemptWeek = 6; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.withdrawals = -1; },
      (s: SliceState) => { s.sailor.cases['rescue-drill']!.withdrawals = 0.5; },
      (s: SliceState) => { (s.sailor.cases['rescue-drill'] as unknown as Record<string, unknown>).method = 'INFINITE_BREATH'; },
      (s: SliceState) => { (s.sailor.cases['rescue-drill'] as unknown as Record<string, unknown>).status = 'IMAGINED'; },
      (s: SliceState) => { (s.sailor.cases['rescue-drill'] as unknown as Record<string, unknown>).rope = 'DUPLICATED'; },
      (s: SliceState) => { (s.sailor.cases['rescue-drill'] as unknown as Record<string, unknown>).target = 'TELEPORTED'; },
      (s: SliceState) => { (s.sailor.cases['rescue-drill'] as unknown as Record<string, unknown>).text = 'hidden page'; },
      (s: SliceState) => { (s.sailor as unknown as Record<string, unknown>).encounter = {}; },
      (s: SliceState) => { (s.sailor as unknown as Record<string, unknown>).formulaKnown = true; },
    ]) { const s = promoted(); mutate(s); expect(validateSailorState(s)).toBe(false); }
  });
});
