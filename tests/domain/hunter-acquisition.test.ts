import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import { applyHunterCommand, createHunterState, projectHunter, validateHunterState } from '../../src/domain/hunter/index.js';
import { HUNTER_ABILITIES, HUNTER_BOTTLE_IDS, HUNTER_FORMULA_STATUS, HUNTER_TRAP_KIT } from '../../src/domain/hunter/content.js';
import { HUNTER_ABILITY_IDS, type HunterAcquisitionCommand } from '../../src/domain/hunter/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('hunter-acquisition', sliceDefaultCreationSelection, 'hunter-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.hunter = createHunterState();
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
function apply(s: SliceState, command: HunterAcquisitionCommand, roll = 20) { applyHunterCommand(s, command, context(s, roll).c); }
function guided(s = ordinary()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_GUIDANCE' });
  return s;
}
function buy(s: SliceState, index = 0) {
  const bottle = s.hunter.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = guided(); buy(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: s.hunter.bottles[0]!.id, confirmed: true });
  return s;
}
function rejected(s: SliceState, command: HunterAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('finite, sourced existing hunter potions', () => {
  it('starts with three independent supplier originals and no fabricated recipe or kit', () => {
    const s = ordinary(), p = projectHunter(s);
    expect(validateHunterState(s)).toBe(true);
    expect(s.hunter.bottles.map(bottle => bottle.id)).toEqual([...HUNTER_BOTTLE_IDS]);
    expect(s.hunter.bottles.every(bottle => bottle.status === 'SUPPLIER' && bottle.acquiredWeek === null && bottle.consumedWeek === null && bottle.outcome === null)).toBe(true);
    expect(p.bottles).toEqual([]);
    expect(p.formula).toEqual([]);
    expect(p.formulaKnown).toBe(false);
    expect(p.abilities).toEqual([]);
    expect(p.actions.map(action => action.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toMatch(/hunter-potion|600便士|深红色/);
    expect(s.hunter).not.toHaveProperty('batches');
    const separate = createHunterState();
    separate.bottles[0]!.labourSteps = 2;
    separate.cargo.enemyStatus = 'DEAD';
    expect(s.hunter.bottles[0]!.labourSteps).toBe(0);
    expect(s.hunter.cargo.enemyStatus).toBe('RESISTING');
    expect(s.hunter.cargo).toMatchObject({ originalId: 'milo-copper-crate', owner: 'cargo-owner-milo', holder: 'OWNER' });
  });

  it('charges one action for contact and one action plus 120 pence for guidance', () => {
    const s = ordinary(), progression = JSON.stringify(s.progression), seer = JSON.stringify(s.seer);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    rejected(s, { type: 'BUY_POTION', bottleId: HUNTER_BOTTLE_IDS[0] });
    apply(s, { type: 'DISCOVER' });
    expect([s.cash, s.actionsRemaining, s.hunter.discovered]).toEqual([10000, 39, true]);
    expect(projectHunter(s).bottles).toHaveLength(3);
    rejected(s, { type: 'DISCOVER' });
    rejected(s, { type: 'POTION_WORK', bottleId: HUNTER_BOTTLE_IDS[0] });
    const ctx = context(s);
    applyHunterCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.hunter.guidanceKnown]).toEqual([9880, 38, true]);
    expect(projectHunter(s).guidanceKnown).toBe(true);
    expect(projectHunter(s).formulaKnown).toBe(false);
    expect(projectHunter(s).formula).toEqual([]);
    expect(projectHunter(s).supplies).toContain(HUNTER_FORMULA_STATUS);
    expect(ctx.notes[0]!.text).toContain('完整配方资料待核');
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(JSON.stringify(s.seer)).toBe(seer);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateHunterState(s)).toBe(true);
  });

  it('pays 660 pence without AP to transfer exactly the selected existing original', () => {
    const s = guided(), ap = s.actionsRemaining, beforeOther = JSON.stringify(s.hunter.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([9220, ap]);
    expect(bottle).toMatchObject({ id: HUNTER_BOTTLE_IDS[0], status: 'PLAYER', acquiredWeek: 5, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.hunter.bottles.slice(1))).toBe(beforeOther);
    expect(s.hunter.bottles).toHaveLength(3);
    expect([s.hunter.trapStock, s.hunter.trapHeld]).toEqual([3, 0]);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateHunterState(s)).toBe(true);
  });

  it('requires two real warehouse jobs tied to one bottle before a 600-pence credit', () => {
    const s = guided(), bottle = s.hunter.bottles[0]!, ctx = context(s);
    applyHunterCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([1, 'SUPPLIER', 9880, 37]);
    expect(projectHunter(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain('660便士');
    applyHunterCommand(s, { type: 'POTION_WORK', bottleId: bottle.id }, ctx.c);
    expect([bottle.labourSteps, bottle.status, s.cash, s.actionsRemaining]).toEqual([2, 'SUPPLIER', 9880, 36]);
    expect(ctx.notes.map(note => note.title)).toEqual(['完成仓库巡检', '完成仓库整理']);
    expect(projectHunter(s).actions.find(action => action.id === `buy-${bottle.id}`)!.cost).toContain('60便士');
    expect(projectHunter(s).actions.find(action => action.id === `buy-${HUNTER_BOTTLE_IDS[1]}`)!.cost).toContain('660便士');
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    buy(s);
    expect([s.cash, s.actionsRemaining, bottle.status]).toEqual([9820, 36, 'PLAYER']);
    expect([s.hunter.trapStock, s.hunter.trapHeld]).toEqual([3, 0]);
    expect(validateHunterState(s)).toBe(true);
  });

  it('does not cash out or partly discount a single job', () => {
    const s = guided(), bottleId = HUNTER_BOTTLE_IDS[0];
    apply(s, { type: 'POTION_WORK', bottleId });
    const cash = s.cash;
    buy(s);
    expect(cash - s.cash).toBe(660);
    rejected(s, { type: 'POTION_WORK', bottleId });
  });

  it('rejects missing funds and foreign originals without any mutation', () => {
    const s = ordinary();
    apply(s, { type: 'DISCOVER' });
    s.cash = 119;
    rejected(s, { type: 'LEARN_GUIDANCE' });
    s.cash = 10000;
    apply(s, { type: 'LEARN_GUIDANCE' });
    for (const bottleId of ['hunter-potion-4', 'seer-batch-1:bottle', 'clown-batch-1:bottle']) {
      rejected(s, { type: 'POTION_WORK', bottleId });
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.cash = 659;
    rejected(s, { type: 'BUY_POTION', bottleId: HUNTER_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: HUNTER_BOTTLE_IDS[0] });
    apply(s, { type: 'POTION_WORK', bottleId: HUNTER_BOTTLE_IDS[0] });
    s.cash = 59;
    rejected(s, { type: 'BUY_POTION', bottleId: HUNTER_BOTTLE_IDS[0] });
    s.cash = 60;
    buy(s);
    expect(s.cash).toBe(0);
  });

  it('can prepare during ordinary life but consumes only an owned confirmed original from week five', () => {
    const s = ordinary();
    s.week = 1;
    guided(s);
    buy(s);
    const bottleId = HUNTER_BOTTLE_IDS[0];
    for (const week of [1, 2, 3, 4]) {
      s.week = week;
      expect(projectHunter(s).actions.find(action => action.id === `consume-${bottleId}`)!.reason).toContain(`${week - 1}/4`);
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    s.week = 5;
    rejected(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId, confirmed: false } as unknown as HunterAcquisitionCommand);
    expect(validateHunterState(s)).toBe(true);
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.hunter.bottles[0]!).toMatchObject({ acquiredWeek: 1, consumedWeek: 5, status: 'CONSUMED' });
  });

  it('exhausts all three originals without refund, automatic replenishment or trap gifts', () => {
    const s = guided();
    for (let index = 0; index < 3; index += 1) buy(s, index);
    for (const bottleId of HUNTER_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
    expect(s.hunter.bottles.every(bottle => bottle.status === 'CONSUMED')).toBe(true);
    expect(s.progression.pathwayId).toBe(null);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([70, 40, 75]);
    expect([s.hunter.trapStock, s.hunter.trapHeld]).toEqual([3, 0]);
    s.week += 20;
    expect(projectHunter(s).supplies).toContain('供应方剩余0瓶');
    expect(projectHunter(s).actions.map(action => action.command.type)).toEqual(['REQUEST_SUPPLY']);
    for (const bottleId of HUNTER_BOTTLE_IDS) {
      rejected(s, { type: 'BUY_POTION', bottleId });
      rejected(s, { type: 'CONSUME', bottleId, confirmed: true });
    }
    expect(validateHunterState(s)).toBe(true);
  });
});

describe('hunter resupply after all original attempts fail', () => {
  function exhausted() {
    const s = guided();
    for (let index = 0; index < 3; index += 1) buy(s, index);
    for (const bottleId of HUNTER_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
    return s;
  }

  it('requests after exhaustion, advances a real week, receives stock, pays through labour and independently consumes', () => {
    let s = exhausted();
    const originals = JSON.stringify(s.hunter.bottles), priorDate = { ...s.date };
    s.actionsRemaining = 2;
    const cashBeforeRequest = s.cash;
    s = applySliceIntent(s, { type: 'HUNTER', command: { type: 'REQUEST_SUPPLY' } });
    expect([s.week, s.actionsRemaining, s.cash, s.hunter.resupply.requestedWeek, s.hunter.resupply.deliveries]).toEqual([5, 1, cashBeforeRequest, 5, 0]);
    expect(JSON.stringify(s.hunter.bottles)).toBe(originals);
    expect(projectHunter(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(false);
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateHunterState(s)).toBe(true);

    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    expect(s.week).toBe(6);
    expect(s.date).not.toEqual(priorDate);
    expect(s.hunter.bottles).toHaveLength(3);
    expect(projectHunter(s).actions.find(action => action.command.type === 'RECEIVE_SUPPLY')!.enabled).toBe(true);
    const cashBeforeReceipt = s.cash, apBeforeReceipt = s.actionsRemaining;
    s = applySliceIntent(s, { type: 'HUNTER', command: { type: 'RECEIVE_SUPPLY' } });
    expect([s.cash, s.actionsRemaining]).toEqual([cashBeforeReceipt, apBeforeReceipt]);
    expect(s.hunter.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.hunter.bottles.slice(0, 3))).toBe(originals);
    expect(s.hunter.bottles.slice(3).map(bottle => bottle.id)).toEqual(['hunter-potion-4', 'hunter-potion-5', 'hunter-potion-6']);
    expect(s.hunter.bottles.slice(3).every(bottle => bottle.status === 'SUPPLIER' && bottle.labourSteps === 0 && bottle.acquiredWeek === null && bottle.source.includes('第6周实收入库'))).toBe(true);
    expect(s.chronicle.some(record => record.title === '申请下一批猎人魔药')).toBe(true);
    expect(s.chronicle.some(record => record.title === '下一批猎人原瓶到货')).toBe(true);
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    rejected(s, { type: 'CONSUME', bottleId: 'hunter-potion-4', confirmed: true });
    expect(validateHunterState(s)).toBe(true);

    apply(s, { type: 'POTION_WORK', bottleId: 'hunter-potion-4' });
    apply(s, { type: 'POTION_WORK', bottleId: 'hunter-potion-4' });
    apply(s, { type: 'BUY_POTION', bottleId: 'hunter-potion-4' });
    expect([s.cash, s.actionsRemaining]).toEqual([cashBeforeReceipt - 60, apBeforeReceipt - 2]);
    expect(s.hunter.bottles[3]!).toMatchObject({ status: 'PLAYER', acquiredWeek: 6, consumedWeek: null });
    const apBeforeConsumption = s.actionsRemaining;
    apply(s, { type: 'CONSUME', bottleId: 'hunter-potion-4', confirmed: true });
    expect(s.actionsRemaining).toBe(apBeforeConsumption);
    expect(s.hunter.bottles[3]!).toMatchObject({ status: 'CONSUMED', consumedWeek: 6, outcome: 'SUCCESS' });
    expect(s.progression.pathwayId).toBe('hunter');
    expect(s.progression.promotionWeek).toBe(6);
    expect(JSON.stringify(s.hunter.bottles.slice(0, 3))).toBe(originals);
    expect(validateHunterState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('requires an action and all known originals exhausted with no previous success', () => {
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
    expect(s.hunter.bottles).toHaveLength(3);
  });

  it('charges full price for fresh supplier originals when no new labour was done', () => {
    let s = exhausted();
    s.actionsRemaining = 2;
    s = applySliceIntent(s, { type: 'HUNTER', command: { type: 'REQUEST_SUPPLY' } });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    s = applySliceIntent(s, { type: 'HUNTER', command: { type: 'RECEIVE_SUPPLY' } });
    const cash = s.cash, ap = s.actionsRemaining;
    buy(s, 3);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 660, ap]);
    expect(projectHunter(s).bottles[3]!.title).toContain('第4瓶');
    expect(projectHunter(s).bottles[3]!.source).toContain('hunter-potion-4');
    expect(validateHunterState(s)).toBe(true);
  });

  it('rejects invented deliveries, same-week stock, mixed receipt dates and restored earlier originals', () => {
    let s = exhausted();
    s.actionsRemaining = 2;
    s = applySliceIntent(s, { type: 'HUNTER', command: { type: 'REQUEST_SUPPLY' } });
    s = applySliceIntent(s, { type: 'ACTION', action: 'REST' });
    s = applySliceIntent(s, { type: 'HUNTER', command: { type: 'RECEIVE_SUPPLY' } });
    for (const mutate of [
      (x: SliceState) => { x.hunter.resupply.deliveries = 0; },
      (x: SliceState) => { x.hunter.resupply.deliveries = 2; },
      (x: SliceState) => { x.hunter.bottles[3]!.id = 'hunter-potion-7'; },
      (x: SliceState) => { x.hunter.bottles[3]!.source = x.hunter.bottles[3]!.source.replace('第6周实收入库', '第5周实收入库'); },
      (x: SliceState) => { x.week = 7; x.hunter.bottles[4]!.source = x.hunter.bottles[4]!.source.replace('第6周实收入库', '第7周实收入库'); },
      (x: SliceState) => { x.hunter.bottles[0]!.status = 'PLAYER'; x.hunter.bottles[0]!.outcome = null; x.hunter.bottles[0]!.consumedWeek = null; },
      (x: SliceState) => { x.hunter.bottles[3]!.status = 'PLAYER'; x.hunter.bottles[3]!.acquiredWeek = 5; },
      (x: SliceState) => { x.hunter.resupply.requestedWeek = 6; },
    ]) {
      const corrupted = JSON.parse(JSON.stringify(s)) as SliceState;
      mutate(corrupted);
      expect(validateHunterState(corrupted)).toBe(false);
    }
    const pending = exhausted();
    apply(pending, { type: 'REQUEST_SUPPLY' });
    pending.hunter.resupply.requestedWeek = 4;
    expect(validateHunterState(pending)).toBe(false);
  });
});

describe('hunter advancement uses ordinary four-tier checks', () => {
  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} with one will difficulty-five check and exact costs`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, ap = s.actionsRemaining, cash = s.cash, ctx = context(s, roll);
    s.spirituality = 7;
    applyHunterCommand(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 5]]);
    expect(ctx.draws).toEqual([]);
    expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap, cash]);
    expect(s.hunter.bottles[0]!).toMatchObject({ status: 'CONSUMED', consumedWeek: 5, outcome: tier });
    expect(s.status).toBe('ACTIVE');
    expect(s.progression.pathwayId).toBe(success ? 'hunter' : null);
    expect(s.progression.sequence).toBe(success ? 9 : null);
    expect(s.progression.promotionWeek).toBe(success ? 5 : null);
    expect(s.progression.acting).toBe(0);
    expect(s.progression.mastery).toEqual(success ? Object.fromEntries(HUNTER_ABILITY_IDS.map(id => [id, 0])) : {});
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 5, perception: stats.perception + 3, will: stats.will + 1, knowledge: stats.knowledge + 2 } : stats);
    expect(validateHunterState(s)).toBe(true);
  });

  it('does not random-kill on severe rejection or reset the consumed bottle', () => {
    const s = prepared();
    s.health = 1;
    s.mind = 1;
    apply(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(s.progression.pathwayId).toBe(null);
    expect(s.hunter.bottles[0]!.status).toBe('CONSUMED');
    rejected(s, { type: 'BUY_POTION', bottleId: HUNTER_BOTTLE_IDS[1] });
    expect(validateHunterState(s)).toBe(true);
  });

  it('preserves other originals and cannot award a second hunter promotion', () => {
    const s = prepared();
    buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[1], confirmed: true });
    rejected(s, { type: 'BUY_POTION', bottleId: HUNTER_BOTTLE_IDS[2] });
    rejected(s, { type: 'POTION_WORK', bottleId: HUNTER_BOTTLE_IDS[2] });
    expect(s.hunter.bottles[1]!.status).toBe('PLAYER');
    expect(projectHunter(s).actions.find(action => action.id === `consume-${HUNTER_BOTTLE_IDS[1]}`)!.enabled).toBe(false);
    expect(validateHunterState(s)).toBe(true);
  });

  it('lets ordinary people know both channels, then blocks changing from diviner to hunter', () => {
    const s = prepared(), c = context(s).c;
    applySeerCommand(s, { type: 'DISCOVER' }, c);
    applySeerCommand(s, { type: 'LEARN_FORMULA' }, c);
    applySeerCommand(s, { type: 'BUY_MATERIALS', batchId: s.seer.batches[0]!.id }, c);
    applySeerCommand(s, { type: 'BREW', batchId: s.seer.batches[0]!.id }, c);
    applySeerCommand(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true }, c);
    expect(s.progression.pathwayId).toBe('diviner');
    rejected(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[0], confirmed: true });
    rejected(s, { type: 'BUY_TRAP_KIT' });
    expect(s.hunter.bottles[0]!.status).toBe('PLAYER');
    expect(validateHunterState(s)).toBe(true);
  });

  it('uses the real displayed chance, caps attributes and never fills current spirit', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectHunter(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.physique = 498;
    s.character.coreStats.perception = 499;
    s.character.coreStats.knowledge = 500;
    s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[0], confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
  });
});

describe('finite physical trap supplies and bounded hunter projection', () => {
  it('requires hunter advancement before buying any real trap supply', () => {
    const s = prepared();
    rejected(s, { type: 'BUY_TRAP_KIT' });
    expect(projectHunter(s).trapStock).toBe(0);
    apply(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[0], confirmed: true });
    const cash = s.cash, ap = s.actionsRemaining;
    for (let index = 1; index <= 3; index += 1) {
      apply(s, { type: 'BUY_TRAP_KIT' });
      expect([s.hunter.trapStock, s.hunter.trapHeld, s.hunter.trapDeployed, s.hunter.trapSpent]).toEqual([3 - index, index, 0, 0]);
      expect(s.cash).toBe(cash - index * 12);
    }
    expect(s.actionsRemaining).toBe(ap);
    rejected(s, { type: 'BUY_TRAP_KIT' });
    s.week += 10;
    expect(projectHunter(s).actions.find(action => action.command.type === 'BUY_TRAP_KIT')!.enabled).toBe(false);
    expect(validateHunterState(s)).toBe(true);
  });

  it('charges exactly 12 pence for one rope and one peg with no AP', () => {
    const s = promoted(), ap = s.actionsRemaining;
    s.cash = 11;
    rejected(s, { type: 'BUY_TRAP_KIT' });
    s.cash = 12;
    const ctx = context(s);
    applyHunterCommand(s, { type: 'BUY_TRAP_KIT' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.hunter.trapHeld]).toEqual([0, ap, 1]);
    expect(ctx.notes[0]!.text).toContain(HUNTER_TRAP_KIT);
    expect(projectHunter(s).actions.find(action => action.command.type === 'BUY_TRAP_KIT')!.cost).toContain(HUNTER_TRAP_KIT);
  });

  it.each(['combat', 'event', 'city', 'dead', 'body', 'mind'] as const)('cannot purchase during a %s blocker', blocker => {
    const s = promoted();
    if (blocker === 'combat') s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    if (blocker === 'event') s.activeEvent = { id: 'test', instanceId: 'test-1' };
    if (blocker === 'city') s.world.city = 'ELSEWHERE';
    if (blocker === 'dead') s.status = 'DEAD';
    if (blocker === 'body') s.health = 0;
    if (blocker === 'mind') s.mind = 0;
    rejected(s, { type: 'BUY_TRAP_KIT' });
  });

  it('requires an action for contact, guidance and each warehouse job', () => {
    const first = ordinary();
    first.actionsRemaining = 0;
    rejected(first, { type: 'DISCOVER' });
    const second = ordinary();
    apply(second, { type: 'DISCOVER' });
    second.actionsRemaining = 0;
    rejected(second, { type: 'LEARN_GUIDANCE' });
    const third = guided();
    third.actionsRemaining = 0;
    rejected(third, { type: 'POTION_WORK', bottleId: HUNTER_BOTTLE_IDS[0] });
    buy(third);
    expect(third.actionsRemaining).toBe(0);
  });

  it('shows only the four sequence-nine abilities and returns detached projections', () => {
    const s = promoted(), before = JSON.stringify(s), p = projectHunter(s);
    expect(p.abilities.map(ability => ability.id)).toEqual([...HUNTER_ABILITY_IDS]);
    expect(HUNTER_ABILITIES).toHaveLength(4);
    expect(JSON.stringify(HUNTER_ABILITIES)).not.toMatch(/s8|s7|挑衅|火焰/);
    expect(p.formula).toEqual([]);
    expect(p.risk).toContain('意志难度5');
    expect(p.risk).toContain('不适用于战斗');
    expect(p.risk).toContain('只能选择一条');
    p.abilities[0]!.mastery = 500;
    p.bottles[0]!.source = 'changed';
    p.actions[0]!.label = 'changed';
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('hunter original-bottle and real-trap save invariants', () => {
  it('accepts a JSON round trip with an independently held bottle', () => {
    const s = prepared();
    buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: HUNTER_BOTTLE_IDS[0], confirmed: true });
    apply(s, { type: 'BUY_TRAP_KIT' });
    const loaded = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateHunterState(loaded)).toBe(true);
    expect(loaded.hunter.bottles.map(bottle => bottle.status)).toEqual(['CONSUMED', 'PLAYER', 'SUPPLIER']);
  });

  it('accepts real stock transfers when deployed originals have a known location', () => {
    const s = promoted();
    apply(s, { type: 'BUY_TRAP_KIT' });
    s.hunter.trapHeld -= 1;
    s.hunter.trapDeployed += 1;
    s.hunter.trapLocation = 'FIRST_CASE';
    expect(validateHunterState(s)).toBe(true);
    s.hunter.trapDeployed -= 1;
    s.hunter.trapSpent += 1;
    s.hunter.trapLocation = null;
    expect(validateHunterState(s)).toBe(true);
  });

  const mutations: [string, (s: SliceState) => void][] = [
    ['duplicate original', s => { s.hunter.bottles.push({ ...s.hunter.bottles[0]! }); }],
    ['foreign original id', s => { s.hunter.bottles[1]!.id = 'seer-batch-1:bottle'; }],
    ['changed provenance', s => { s.hunter.bottles[0]!.source = 'unknown source'; }],
    ['restored consumed bottle', s => { s.hunter.bottles[0]!.status = 'PLAYER'; }],
    ['unrecorded original receipt', s => { s.hunter.bottles[0]!.acquiredWeek = null; }],
    ['future receipt', s => { s.hunter.bottles[0]!.acquiredWeek = s.week + 1; }],
    ['early consumption', s => { s.hunter.bottles[0]!.consumedWeek = 4; }],
    ['missing consumption', s => { s.hunter.bottles[0]!.consumedWeek = null; }],
    ['promotion week mismatch', s => { s.progression.promotionWeek = 6; s.week = 6; }],
    ['supplier consumption mark', s => { s.hunter.bottles[1]!.outcome = 'FAILURE'; }],
    ['excess labour', s => { s.hunter.bottles[1]!.labourSteps = 3; }],
    ['forgotten guidance', s => { s.hunter.guidanceKnown = false; }],
    ['forgotten contact', s => { s.hunter.discovered = false; }],
    ['missing ability', s => { delete s.progression.mastery['hunter.s9.tracking']; }],
    ['foreign ability', s => { s.progression.mastery['diviner.s9.divination'] = 1; }],
    ['overfilled mastery', s => { s.progression.mastery['hunter.s9.tracking'] = 501; }],
    ['minted trap', s => { s.hunter.trapHeld += 1; }],
    ['negative spent traps', s => { s.hunter.trapSpent = -1; }],
    ['unlocated trap', s => { s.hunter.trapStock -= 1; s.hunter.trapDeployed = 1; }],
    ['phantom trap location', s => { s.hunter.trapLocation = 'FIRST_CASE'; }],
    ['multiple deployed originals', s => { s.hunter.trapStock = 1; s.hunter.trapDeployed = 2; s.hunter.trapLocation = 'FIRST_CASE'; }],
    ['duplicate observations', s => { s.hunter.observations = ['same', 'same']; }],
    ['future practice attempt', s => { s.hunter.practiceAttempts['tracking'] = s.week + 1; }],
    ['future cargo attempt', s => { s.hunter.cargo.attemptWeek = s.week + 1; }],
    ['impossible cargo history', s => { s.hunter.cargo.startHistoryIndex = s.combatHistory.length + 1; }],
    ['changed cargo original', s => { (s.hunter.cargo as unknown as { originalId: string }).originalId = 'other-crate'; }],
    ['changed cargo owner', s => { (s.hunter.cargo as unknown as { owner: string }).owner = 'PLAYER'; }],
    ['transferred cargo', s => { (s.hunter.cargo as unknown as { holder: string }).holder = 'PLAYER'; }],
  ];
  it.each(mutations)('rejects %s', (_name, mutate) => {
    const s = promoted();
    mutate(s);
    expect(validateHunterState(s)).toBe(false);
  });

  it('rejects unearned hunter progress or trap holdings before promotion', () => {
    for (const mutate of [
      (s: SliceState) => { s.hunter.trapStock = 2; s.hunter.trapHeld = 1; },
      (s: SliceState) => { s.hunter.observations = ['tracking']; },
      (s: SliceState) => { s.hunter.practiceAttempts['tracking'] = s.week; },
      (s: SliceState) => { s.hunter.cargo.attemptWeek = s.week; },
      (s: SliceState) => { s.progression.mastery['hunter.s9.tracking'] = 0; },
    ]) {
      const s = prepared();
      mutate(s);
      expect(validateHunterState(s)).toBe(false);
    }
  });

  it('returns false for malformed nested saves instead of throwing', () => {
    const s = promoted();
    for (const hunter of [null, {}, { ...s.hunter, bottles: [null, null, null] }, { ...s.hunter, bottles: [null] }, { ...s.hunter, cargo: null }, { ...s.hunter, resupply: null }, { ...s.hunter, practiceAttempts: null }, { ...s.hunter, observations: null }]) {
      expect(validateHunterState({ ...s, hunter } as unknown as SliceState)).toBe(false);
    }
  });
});
