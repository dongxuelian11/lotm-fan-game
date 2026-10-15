import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import { applyApothecaryCommand, createApothecaryState, projectApothecary, validateApothecaryCommand, validateApothecaryState } from '../../src/domain/apothecary/index.js';
import { APOTHECARY_ABILITIES, APOTHECARY_BOTTLE_IDS, APOTHECARY_FORMULA_STATUS, APOTHECARY_CASES } from '../../src/domain/apothecary/content.js';
import { APOTHECARY_ABILITY_IDS, APOTHECARY_CASE_IDS, type ApothecaryAcquisitionCommand } from '../../src/domain/apothecary/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('apothecary-acquisition', sliceDefaultCreationSelection, 'apothecary-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.apothecary = createApothecaryState();
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
function apply(s: SliceState, command: ApothecaryAcquisitionCommand, roll = 20) { applyApothecaryCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.apothecary.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = guided();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of APOTHECARY_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() {
  const s = exhausted();
  apply(s, { type: 'REQUEST_SUPPLY' });
  s.week += 1;
  apply(s, { type: 'RECEIVE_SUPPLY' });
  return s;
}
function rejected(s: SliceState, command: ApothecaryAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('apothecary finite finished-potion acquisition', () => {
  it('starts with three independent originals, no known recipe, and three unexamined patients and no clinical stock', () => {
    const s = ordinary(), p = projectApothecary(s);
    expect(validateApothecaryState(s)).toBe(true);
    expect(s.apothecary.bottles.map(bottle => bottle.id)).toEqual([...APOTHECARY_BOTTLE_IDS]);
    expect(s.apothecary.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p.formulaKnown).toBe(false);
    expect(p.formula).toEqual([]);
    expect(p.bottles).toEqual([]);
    expect(p.abilities).toEqual([]);
    expect(p.cases).toEqual([]);
    expect(p.actions.map(action => action.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toMatch(/apothecary-potion|600便士|木楔|图纸|轴隙/);
    expect(Object.keys(s.apothecary.cases)).toEqual([...APOTHECARY_CASE_IDS]);
    expect(s.apothecary.cases).toEqual(Object.fromEntries(APOTHECARY_CASES.map(({ id, health, mind }) => [id, { status: 'AVAILABLE', choice: null, health, mind }])));
    expect(s.apothecary.clinic).toEqual({ purchased: 0, materials: 0, healing: 0, calming: 0, spent: 0, supplyWeek: null });
    expect(p.clinic).toEqual({ materials: 0, healing: 0, calming: 0, spent: 0 });
    expect(s.apothecary.reflected).toBe(false);
    expect(s.apothecary).not.toHaveProperty('batches');
    const separate = createApothecaryState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cases['workshop-cut']!.health = 100;
    separate.clinic.materials = 1;
    expect(s.apothecary.bottles[0]!.labourSteps).toBe(0);
    expect(s.apothecary.cases['workshop-cut']!.health).toBe(72);
    expect(s.apothecary.clinic.materials).toBe(0);
  });

  it('charges one AP for discovery and one AP plus 120 pence for guidance without granting knowledge or abilities', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), projects = JSON.stringify(s.apothecary.cases);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    rejected(s, { type: 'BUY_POTION', bottleId: APOTHECARY_BOTTLE_IDS[0] });
    apply(s, { type: 'DISCOVER' });
    expect([s.cash, s.actionsRemaining, s.apothecary.discovered]).toEqual([10000, 39, true]);
    expect(projectApothecary(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'POTION_WORK', bottleId: APOTHECARY_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyApothecaryCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.apothecary.guidanceKnown]).toEqual([9880, 38, true]);
    expect(projectApothecary(s).formulaKnown).toBe(false);
    expect(projectApothecary(s).formula).toEqual([]);
    expect(projectApothecary(s).supplies).toContain(APOTHECARY_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('完整配方资料待核');
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.apothecary.cases)).toBe(projects);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('pays 660 pence and zero AP for exactly the chosen existing original', () => {
    const s = guided(), ap = s.actionsRemaining, other = JSON.stringify(s.apothecary.bottles.slice(1)), projects = JSON.stringify(s.apothecary.cases);
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([9220, ap]);
    expect(bottle).toMatchObject({ id: APOTHECARY_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.apothecary.bottles.slice(1))).toBe(other);
    expect(JSON.stringify(s.apothecary.cases)).toBe(projects);
    expect(s.apothecary.bottles).toHaveLength(3);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('needs two actual jobs against the same bottle before its 600-pence discount', () => {
    const s = guided(), bottle = s.apothecary.bottles[0]!, ctx = context(s), projects = JSON.stringify(s.apothecary.cases);
    applyApothecaryCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([1, 'SUPPLIER', 9880, 37]);
    expect(projectApothecary(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyApothecaryCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([2, 'SUPPLIER', 9880, 36]);
    expect(ctx.notes.map(note => note.title)).toEqual(['完成诊所清点', '完成药材柜整理']);
    expect(projectApothecary(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectApothecary(s).actions.find(action => action.id === `buy-${APOTHECARY_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect(JSON.stringify(s.apothecary.cases)).toBe(projects);
    expect(s.progression.mastery).toEqual({});
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('does not cash out or partly discount a single job', () => {
    const s = guided();
    apply(s, { type: 'POTION_WORK', bottleId: APOTHECARY_BOTTLE_IDS[0] });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(660);
    rejected(s, { type: 'POTION_WORK', bottleId: APOTHECARY_BOTTLE_IDS[0] });
  });

  it('rejects missing funds and foreign or unavailable originals atomically', () => {
    const s = ordinary();
    apply(s, { type: 'DISCOVER' });
    s.cash = 119;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['apothecary-potion-4', 'hunter-potion-1', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659;
    rejected(s, { type: 'BUY_POTION', bottleId: APOTHECARY_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: APOTHECARY_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: APOTHECARY_BOTTLE_IDS[0] });
    s.cash = 59;
    rejected(s, { type: 'BUY_POTION', bottleId: APOTHECARY_BOTTLE_IDS[0] });
    s.cash = 60;
    buy(s);
    expect(s.cash).toBe(0);
  });

  it('can prepare early but requires four complete ordinary weeks and separate confirmation to consume', () => {
    const s = ordinary();
    s.week = 1;
    guided(s);
    buy(s);
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectApothecary(s).actions.find(action => action.id === `consume-${APOTHECARY_BOTTLE_IDS[0]}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: false } as unknown as ApothecaryAcquisitionCommand);
    apply(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true });
    expect(s.apothecary.bottles[0]!).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
    expect(validateApothecaryState(s)).toBe(true);
  });
});

describe('apothecary advancement uses ordinary four-tier checks', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} with one will difficulty-five check and exact costs`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll), projects = JSON.stringify(s.apothecary.cases);
    s.spirituality = 7;
    applyApothecaryCommand(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 5]]);
    expect(ctx.draws).toEqual([]);
    expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
    expect(s.apothecary.bottles[0]!).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
    expect(s.status).toBe('ACTIVE');
    expect(s.progression.pathwayId).toBe(success ? 'moon' : null);
    expect(s.progression.sequence).toBe(success ? 9 : null);
    expect(s.progression.promotionWeek).toBe(success ? 5 : null);
    expect(s.progression.acting).toBe(0);
    expect(s.progression.mastery).toEqual(success ? Object.fromEntries(APOTHECARY_ABILITY_IDS.map(id => [id, 0])) : {});
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique, perception: stats.perception + 3, will: stats.will + 3, knowledge: stats.knowledge + 4 } : stats);
    expect(JSON.stringify(s.apothecary.cases)).toBe(projects);
    expect(projectSliceState(s).maxSpirituality).toBe(success ? 30 : 15);
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('does not random-kill or restore an original on severe rejection', () => {
    const s = prepared();
    s.health = 1;
    s.mind = 1;
    apply(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(s.progression.pathwayId).toBe(null);
    expect(s.apothecary.bottles[0]!.status).toBe('CONSUMED');
    rejected(s, { type: 'BUY_POTION', bottleId: APOTHECARY_BOTTLE_IDS[1] });
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('preserves other originals and cannot award a second promotion', () => {
    const s = prepared();
    buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: APOTHECARY_BOTTLE_IDS[2] });
    rejected(s, { type: 'POTION_WORK', bottleId: APOTHECARY_BOTTLE_IDS[2] });
    expect(s.apothecary.bottles[1]!.status).toBe('PLAYER');
    expect(projectApothecary(s).actions.find(action => action.id === `consume-${APOTHECARY_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('allows preparing several channels as an ordinary person, then blocks changing from diviner', () => {
    const s = prepared(), c = context(s).c;
    applySeerCommand(s, { type: 'DISCOVER' }, c);
    applySeerCommand(s, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(s, { type: 'BUY_MATERIALS', batchId: s.seer.batches[0]!.id }, c);
    applySeerCommand(s, { type: 'BREW', batchId: s.seer.batches[0]!.id }, c);
    applySeerCommand(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true }, c);
    expect(s.progression.pathwayId).toBe('diviner');
    rejected(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true });
    expect(s.apothecary.bottles[0]!.status).toBe('PLAYER');
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('uses actual will chance, caps only the enhanced stats and never fills current spirituality', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectApothecary(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 498;
    s.character.coreStats.perception = 499;
    s.character.coreStats.knowledge = 498;
    s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 498, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
  });
});

describe('apothecary cross-week resupply after failed originals', () => {
  it('exhausts all three without refund, automatic stock, clinical materials or medicine gifts', () => {
    const s = exhausted();
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect(s.progression.pathwayId).toBe(null);
    expect(s.apothecary.bottles.every(bottle => bottle.status === 'CONSUMED')).toBe(true);
    expect(s.apothecary.cases).toEqual(createApothecaryState().cases);
    s.week += 20;
    expect(projectApothecary(s).supplies).toContain('供应方剩余0瓶');
    expect(projectApothecary(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    for (const bottleId of APOTHECARY_BOTTLE_IDS) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('waits for a real ordinary week and transfers new stock only after a separate receipt', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.apothecary.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 2;
    const cashBeforeRequest = s.cash;
    s = applySliceIntent(s, { type: 'APOTHECARY', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.apothecary.resupply.requestedWeek, s.apothecary.resupply.deliveries]).toEqual([5, 1, cashBeforeRequest, 5, 0]);
    expect(JSON.stringify(s.apothecary.bottles)).toBe(originals);
    expect(projectApothecary(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateApothecaryState(s)).toBe(true);
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6);
    expect(s.date).not.toEqual(priorDate);
    expect(s.apothecary.bottles).toHaveLength(3);
    expect(s.seer.pollution).toBe(65);
    const cash = s.cash, ap = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'APOTHECARY', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap]);
    expect(s.apothecary.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.apothecary.bottles.slice(0, 3))).toBe(originals);
    expect(s.apothecary.bottles.slice(3).map(bottle => bottle.id)).toEqual(['apothecary-potion-4', 'apothecary-potion-5', 'apothecary-potion-6']);
    expect(s.apothecary.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第6周实收入库'))).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'apothecary-potion-4', confirmed: true });
    apply(s, { type: 'POTION_WORK', bottleId: 'apothecary-potion-4' });
    apply(s, { type: 'POTION_WORK', bottleId: 'apothecary-potion-4' });
    apply(s, { type: 'BUY_POTION', bottleId: 'apothecary-potion-4' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 60, ap - 2]);
    apply(s, { type: 'CONSUME', bottleId: 'apothecary-potion-4', confirmed: true });
    expect(s.apothecary.bottles[3]!).toMatchObject({ status: 'CONSUMED', acquiredWeek: 6, consumedWeek: 6, outcome: 'SUCCESS' });
    expect(s.progression.pathwayId).toBe('moon');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.apothecary.bottles.slice(0, 3))).toBe(originals);
    expect(validateApothecaryState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
  });

  it('requires an AP, prior failed exhaustion, and no outstanding request', () => {
    for (const s of [ordinary(), guided(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' });
      rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted();
    s.actionsRemaining = 0;
    rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect(s.actionsRemaining).toBe(0);
    expect(s.apothecary.bottles).toHaveLength(3);
    s.actionsRemaining = 1;
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('does not carry a previous bottle labour credit into new stock', () => {
    const s = resupplied(), cash = s.cash, ap = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(projectApothecary(s).bottles[3]!.title).toContain('第4瓶');
    expect(projectApothecary(s).bottles[3]!.source).toContain('本作G供给');
    expect(validateApothecaryState(s)).toBe(true);
  });

  it('can recover from a second exhausted batch without restoring the old bottles', () => {
    const s = resupplied();
    s.health = 100;
    s.mind = 100;
    for (let index = 3; index < 6; index += 1) { buy(s, index); apply(s, { type: 'CONSUME', bottleId: s.apothecary.bottles[index]!.id, confirmed: true }, 80); }
    const originals = JSON.stringify(s.apothecary.bottles);
    apply(s, { type: 'REQUEST_SUPPLY' });
    s.week += 1;
    apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.apothecary.resupply.deliveries).toBe(2);
    expect(s.apothecary.bottles).toHaveLength(9);
    expect(JSON.stringify(s.apothecary.bottles.slice(0, 6))).toBe(originals);
    expect(s.apothecary.bottles[6]!.id).toBe('apothecary-potion-7');
    expect(validateApothecaryState(s)).toBe(true);
  });
});

describe('apothecary command boundaries and public projection', () => {
  it.each(['combat', 'event', 'city', 'dead', 'body', 'mind'] as const)('rejects acquisition during a %s blocker without mutation', blocker => {
    const s = guided();
    if (blocker === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    if (blocker === 'event') s.activeEvent = { id: 'test', instanceId: 'test-1' };
    if (blocker === 'city') s.world.city = 'ELSEWHERE';
    if (blocker === 'dead') s.status = 'DEAD';
    if (blocker === 'body') s.health = 0;
    if (blocker === 'mind') s.mind = 0;
    rejected(s, { type: 'BUY_POTION', bottleId: APOTHECARY_BOTTLE_IDS[0] });
  });

  it('requires AP for discovery, guidance and each job, while purchases consume none', () => {
    const first = ordinary(); first.actionsRemaining = 0;
    rejected(first, { type: 'DISCOVER' });
    const second = ordinary(); apply(second, { type: 'DISCOVER' }); second.actionsRemaining = 0;
    rejected(second, { type: 'LEARN_GUIDANCE' });
    const third = guided(); third.actionsRemaining = 0;
    rejected(third, { type: 'POTION_WORK', bottleId: APOTHECARY_BOTTLE_IDS[0] });
    buy(third);
    expect(third.actionsRemaining).toBe(0);
  });

  it('accepts exact acquisition and clinic commands but rejects smuggled keys or recipe fabrication', () => {
    for (const type of ['DISCOVER', 'LEARN_GUIDANCE', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY', 'BUY_SUPPLIES', 'USE_HEALING', 'REFLECT']) expect(validateApothecaryCommand({ type })).toBe(true);
    for (const type of ['POTION_WORK', 'BUY_POTION']) expect(validateApothecaryCommand({ type, bottleId: 'apothecary-potion-4' })).toBe(true);
    expect(validateApothecaryCommand({ type: 'CONSUME', bottleId: 'apothecary-potion-1', confirmed: true })).toBe(true);
    for (const kind of ['HEALING', 'CALMING']) expect(validateApothecaryCommand({ type: 'PREPARE_MEDICINE', kind })).toBe(true);
    for (const caseId of APOTHECARY_CASE_IDS) {
      expect(validateApothecaryCommand({ type: 'EXAMINE', caseId })).toBe(true);
      for (const choice of ['CARE', 'REFER']) expect(validateApothecaryCommand({ type: 'CARE', caseId, choice })).toBe(true);
    }
    for (const invalid of [null, [], {}, { type: 'BREW', batchId: 'apothecary-batch-1' }, { type: 'LEARN_FORMULA' }, { type: 'DISCOVER', secret: true }, { type: 'EXAMINE', caseId: 'unknown' }, { type: 'EXAMINE', caseId: 'workshop-cut', force: true }, { type: 'CARE', caseId: 'workshop-cut' }, { type: 'CARE', caseId: 'workshop-cut', choice: 'CURE' }, { type: 'PREPARE_MEDICINE', kind: 'REVIVAL' }, { type: 'PREPARE_MEDICINE', kind: 'HEALING', quantity: 100 }, { type: 'BUY_SUPPLIES', quantity: 100 }, { type: 'BUY_POTION', bottleId: 'apothecary-potion-0' }, { type: 'BUY_POTION', bottleId: 'apothecary-potion-01' }, { type: 'BUY_POTION', bottleId: 'hunter-potion-1' }, { type: 'CONSUME', bottleId: 'apothecary-potion-1' }, { type: 'CONSUME', bottleId: 'apothecary-potion-1', confirmed: false }]) expect(validateApothecaryCommand(invalid)).toBe(false);
    const s = guided();
    for (const invalid of [{ type: 'BREW' }, { type: 'EXAMINE', caseId: 'workshop-cut' }, { type: 'REFLECT' }, { type: 'BUY_POTION', bottleId: APOTHECARY_BOTTLE_IDS[0], cost: 0 }]) rejected(s, invalid as unknown as ApothecaryAcquisitionCommand);
  });

  it('exposes only the three bounded S9 abilities and detached primitive projections', () => {
    const s = prepared(); buy(s, 1); apply(s, { type: 'CONSUME', bottleId: APOTHECARY_BOTTLE_IDS[0], confirmed: true });
    const before = JSON.stringify(s), p = projectApothecary(s);
    expect(p.abilities.map(ability => ability.id)).toEqual([...APOTHECARY_ABILITY_IDS]);
    expect(APOTHECARY_ABILITIES).toHaveLength(3);
    expect(APOTHECARY_CASES.map(project => project.id)).toEqual([...APOTHECARY_CASE_IDS]);
    expect(JSON.stringify(APOTHECARY_ABILITIES)).toContain('观察不是绝对诊断');
    expect(JSON.stringify(APOTHECARY_ABILITIES)).toContain('不能复活、再生肢体或净化非凡污染');
    expect(JSON.stringify(APOTHECARY_ABILITIES)).toContain('强壮体魄与驯兽不是序列9能力');
    expect(APOTHECARY_FORMULA_STATUS).toContain('成年独角飞马的角（未记克重）');
    expect(APOTHECARY_FORMULA_STATUS).toContain('皇冠水母毒液结晶3克');
    expect(APOTHECARY_FORMULA_STATUS).toContain('辅助材料尚未核实');
    expect(p.formula).toEqual([]);
    expect(p.risk).toContain('意志难度5');
    expect(p.risk).toContain('不适用于战斗');
    expect(p.risk).toContain('只能选择一条');
    p.abilities[0]!.mastery = 500;
    p.bottles[0]!.source = 'changed';
    p.actions[0]!.label = 'changed';
    p.clinic.materials = 100;
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('apothecary source and save invariants', () => {
  it('accepts round-tripped owned bottles and recoverable failures', () => {
    for (const s of [ordinary(), prepared(), promoted(), exhausted(), resupplied()]) expect(validateApothecaryState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
  });

  it('rejects altered originals, forged guidance or ownership, impossible results and borrowed future abilities', () => {
    const base = promoted();
    for (const mutate of [
      (x: SliceState) => { x.apothecary.discovered = false; },
      (x: SliceState) => { x.apothecary.guidanceKnown = false; },
      (x: SliceState) => { x.apothecary.bottles.pop(); },
      (x: SliceState) => { x.apothecary.bottles[0]!.id = 'apothecary-potion-2'; },
      (x: SliceState) => { x.apothecary.bottles[0]!.source = 'invented recipe'; },
      (x: SliceState) => { x.apothecary.bottles[0]!.labourSteps = 3; },
      (x: SliceState) => { x.apothecary.bottles[0]!.acquiredWeek = null; },
      (x: SliceState) => { x.apothecary.bottles[0]!.consumedWeek = 4; },
      (x: SliceState) => { x.apothecary.bottles[0]!.outcome = null; },
      (x: SliceState) => { x.apothecary.bottles[0]!.status = 'PLAYER'; },
      (x: SliceState) => { x.apothecary.bottles[1]!.acquiredWeek = 5; },
      (x: SliceState) => { x.apothecary.bottles[1]!.outcome = 'SUCCESS'; },
      (x: SliceState) => { x.progression.mastery['moon.s8.beast-taming'] = 0; },
      (x: SliceState) => { delete x.progression.mastery['moon.s9.pharmacy']; },
      (x: SliceState) => { x.progression.mastery['moon.s9.toxin-resistance'] = 501; },
      (x: SliceState) => { x.progression.sequence = 8; },
      (x: SliceState) => { x.progression.promotionWeek = 6; },
      (x: SliceState) => { delete x.apothecary.cases['workshop-cut']; },
      (x: SliceState) => { x.apothecary.clinic.supplyWeek = 4; },
      (x: SliceState) => { (x.apothecary.cases['workshop-cut'] as unknown as Record<string, unknown>).diagnosis = 'OMNISCIENT'; },
      (x: SliceState) => { x.apothecary.cases['workshop-cut']!.health = 101; },
      (x: SliceState) => { x.apothecary.cases['workshop-cut']!.choice = 'CARE'; },
      (x: SliceState) => { x.apothecary.cases['workshop-cut']!.status = 'RESOLVED'; },
      (x: SliceState) => { x.apothecary.clinic.healing = -1; },
      (x: SliceState) => { x.apothecary.clinic.calming = 0.5; },
    ]) {
      const corrupted = JSON.parse(JSON.stringify(base)) as SliceState;
      mutate(corrupted);
      expect(validateApothecaryState(corrupted)).toBe(false);
    }
  });

  it('rejects invented delivery counts, premature stock, mixed dates and restoration of earlier originals', () => {
    const base = resupplied();
    for (const mutate of [
      (x: SliceState) => { x.apothecary.resupply.deliveries = 0; },
      (x: SliceState) => { x.apothecary.resupply.deliveries = 2; },
      (x: SliceState) => { x.apothecary.bottles[3]!.id = 'apothecary-potion-7'; },
      (x: SliceState) => { x.apothecary.bottles[3]!.source = x.apothecary.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (x: SliceState) => { x.week = 7; x.apothecary.bottles[4]!.source = x.apothecary.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (x: SliceState) => { x.apothecary.bottles[0]!.status = 'PLAYER'; x.apothecary.bottles[0]!.outcome = null; x.apothecary.bottles[0]!.consumedWeek = null; },
      (x: SliceState) => { x.apothecary.bottles[3]!.status = 'PLAYER'; x.apothecary.bottles[3]!.acquiredWeek = 5; },
      (x: SliceState) => { x.apothecary.resupply.requestedWeek = 6; },
    ]) {
      const corrupted = JSON.parse(JSON.stringify(base)) as SliceState;
      mutate(corrupted);
      expect(validateApothecaryState(corrupted)).toBe(false);
    }
    const pending = exhausted(); apply(pending, { type: 'REQUEST_SUPPLY' }); pending.apothecary.resupply.requestedWeek = 4;
    expect(validateApothecaryState(pending)).toBe(false);
  });

  it('does not allow ordinary characters to smuggle in medicines, clinical changes or reflection', () => {
    for (const mutate of [
      (x: SliceState) => { x.apothecary.cases['workshop-cut']!.status = 'EXAMINED'; },
      (x: SliceState) => { x.apothecary.cases['workshop-cut']!.health = 100; },
      (x: SliceState) => { x.apothecary.cases['night-fever']!.mind = 100; },
      (x: SliceState) => { x.apothecary.clinic.supplyWeek = 5; },
      (x: SliceState) => { x.apothecary.clinic.purchased = 1; },
      (x: SliceState) => { x.apothecary.clinic.materials = 1; },
      (x: SliceState) => { x.apothecary.clinic.healing = 1; },
      (x: SliceState) => { x.apothecary.clinic.calming = 1; },
      (x: SliceState) => { x.apothecary.clinic.spent = 1; },
      (x: SliceState) => { x.apothecary.reflected = true; },
      (x: SliceState) => { x.progression.mastery['moon.s9.pharmacy'] = 0; },
    ]) {
      const s = ordinary(); mutate(s); expect(validateApothecaryState(s)).toBe(false);
    }
  });
});
