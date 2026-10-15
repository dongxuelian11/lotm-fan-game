import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyMonsterCommand } from '../../src/domain/monster/index.js';
import { applyMonsterActivity } from '../../src/domain/monster/life.js';
import { MONSTER_ABILITY_IDS, MONSTER_CASE_IDS } from '../../src/domain/monster/types.js';
import {
  applyMachineCommand, createMachineState, isMachineAcquisitionCommand,
  projectMachine, validateMachineCommand, validateMachineState,
} from '../../src/domain/machine/index.js';
import {
  MACHINE_ABILITIES, MACHINE_BOTTLE_IDS, MACHINE_FORMULA_STATUS, MACHINE_LABOUR_TASKS,
  MACHINE_SOURCE_STATUS, MACHINE_CONSUMPTION_RISK,
} from '../../src/domain/machine/content.js';
import { MACHINE_ABILITY_IDS, MACHINE_CASE_IDS, type MachineAcquisitionCommand, type MachineCommand } from '../../src/domain/machine/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('machine-acquisition', sliceDefaultCreationSelection, 'machine-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.machine = createMachineState();
  return s;
}
function context(s: SliceState, roll = 20) {
  const checks: [PublicCoreStatKey, number][] = [], draws: [number, number][] = [];
  const notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll(min, max) { draws.push([min, max]); return min; },
    check(ability, difficulty) {
      checks.push([ability, difficulty]);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll });
      s.lastCheck = result;
      return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, notes };
}
function monster() {
  const s = ordinary(), c = context(s, 1).c;
  applyMonsterCommand(s, { type: 'DISCOVER' }, c);
  applyMonsterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMonsterCommand(s, { type: 'BUY_POTION', bottleId: s.monster.bottles[0]!.id }, c);
  applyMonsterCommand(s, { type: 'CONSUME', bottleId: s.monster.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[MONSTER_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of MONSTER_CASE_IDS) {
    applyMonsterActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyMonsterActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applyMonsterActivity(s, { type: 'PERFORM', caseId }, c, award);
    applyMonsterActivity(s, { type: 'CLOSE', caseId }, c, award);
    applyMonsterActivity(s, { type: 'REPORT', caseId, claim: 'LIMITED' }, c, award);
  }
  applyMonsterActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(MONSTER_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: MachineAcquisitionCommand, roll = 20) { applyMachineCommand(s, command, context(s, roll).c); }
function taught(s = monster()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.machine.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of MACHINE_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as MachineAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Acquisition owns originals, maturity and promotion. Life owns exact case transitions and actual CLOSE.
describe('Machine independent S8 acquisition', () => {
  it('starts with three separate G originals, untouched cases and no recipe', () => {
    const s = ordinary(), p = projectMachine(s);
    expect(validateMachineState(s)).toBe(true);
    expect(s.machine.bottles.map(b => b.id)).toEqual([...MACHINE_BOTTLE_IDS]);
    expect(s.machine.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.machine.cases)).toEqual([...MACHINE_CASE_IDS]);
    expect(Object.values(s.machine.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.contactOpen && c.closes === 0)).toBe(true);
    expect(p).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('continues with the same original adult guide for180 and1AP without changing S9 history', () => {
    const s = monster(), old = JSON.stringify(s.monster), progression = JSON.stringify(s.progression), ctx = context(s);
    applyMachineCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.machine.guidanceKnown]).toEqual([9820, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的本作原创成年报时铺记录员艾妲·芬恩');
    expect(projectMachine(s).supplies).toContain(MACHINE_FORMULA_STATUS);
    expect(projectMachine(s).risk).toContain(MACHINE_CONSUMPTION_RISK);
    expect(JSON.stringify(s.monster)).toBe(old); expect(JSON.stringify(s.progression)).toBe(progression);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateMachineState(s)).toBe(true);
  });

  it('requires exact bottle confirmation and does not let old bottles stand for new originals', () => {
    const s = prepared(), bottleId = MACHINE_BOTTLE_IDS[0];
    for (const command of [
      { type: 'CONSUME', bottleId }, { type: 'CONSUME', bottleId, confirmed: false },
      { type: 'CONSUME', bottleId, confirmed: 'true' },
      { type: 'CONSUME', bottleId, confirmed: true, free: true },
      { type: 'CONSUME', bottleId: 'monster-potion-1', confirmed: true },
    ]) { expect(validateMachineCommand(command)).toBe(false); rejected(s, command); }
    rejected(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[1], confirmed: true });
    expect(s.machine.bottles[0]!.status).toBe('PLAYER');
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.progression.sequence).toBe(8);
  });

  it('delivers an original for1210 at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: MACHINE_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.machine.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.machine.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateMachineState(s)).toBe(true);
  });

  it('requires three real jobs per bottle before paying its remaining160', () => {
    const s = taught(), bottleId = MACHINE_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 3; step += 1) {
      applyMachineCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.machine.bottles[0]!.labourSteps]).toEqual([9820, 38 - step, step + 1]);
      expect(projectMachine(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(MACHINE_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.machine.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 159; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 160; buy(s);
    expect([s.cash, s.actionsRemaining, s.machine.bottles[0]!.status]).toEqual([0, 36, 'PLAYER']);
  });

  it('allows early preparation but requires acting100 and four whole S9 weeks to consume', () => {
    const s = monster(); s.week = 5; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 8;
    rejected(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    apply(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.machine.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateMachineState(s)).toBe(true);
  });

  it('blocks wrong channels, ended runs and both old and current open contacts atomically', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.monster.discovered = false; },
      s => { s.monster.guidanceKnown = false; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.monster.cases['quiet-door']!.contactOpen = true; },
      s => { s.machine.cases['private-question']!.contactOpen = true; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
      expect(projectMachine(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    }
    const s = monster(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: MACHINE_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves four recoverable will12 tiers while preserving actual S9 mastery, history and resources', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify(s.monster), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectMachine(s).bottles[0]!.chance;
      applyMachineCommand(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.machine.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['wheel', success ? 8 : 9, 5, success ? 0 : 100]);
      expect([s.machine.promotionWeek, s.machine.monsterActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
      expect(JSON.stringify(s.monster)).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of MONSTER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 0], ['knowledge', 2]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...MONSTER_ABILITY_IDS, ...MACHINE_ABILITY_IDS] : [...MONSTER_ABILITY_IDS]);
      if (success) {
        for (const id of MACHINE_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
        expect(projectSliceState(s).maxSpirituality).toBe(45);
      }
      expect(Object.values(s.machine.cases).every(c => !c.contactOpen && c.closes === 0)).toBe(true);
      expect(s.status).toBe('ACTIVE'); expect(validateMachineState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps attribute gains at500 and never grants higher-sequence abilities', () => {
    const s = prepared();
    Object.assign(s.character.coreStats, { physique: 500, perception: 499, will: 499, knowledge: 499 });
    apply(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 499, knowledge: 500 });
    expect(MACHINE_ABILITY_IDS).toEqual(['wheel.s8.calculation-control', 'wheel.s8.divination-guard']);
    expect(projectMachine(s).abilities).toEqual(MACHINE_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });

  it('keeps severe rejection recoverable and requires restored health and mind before retry', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateMachineState(s)).toBe(true);
    s.health = 100; s.mind = 100;
    apply(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[1], confirmed: true });
    expect(s.machine.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.machine.bottles[1]!.outcome).toBe('SUCCESS');
    expect(s.seer.pollution).toBe(100);
    expect(validateMachineState(s)).toBe(true);
  });

  it('retains held originals after promotion but forbids repeat acquisition', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true });
    expect(s.machine.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: MACHINE_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: MACHINE_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectMachine(s).digestion).toContain('怪物消化成果100/100已保留；机器扮演0/100');
    expect(validateMachineState(s)).toBe(true);
  });

  it('waits a real week after all failures before delivering three new payable originals', () => {
    const s = exhausted(), old = JSON.stringify(s.machine.bottles), s9 = JSON.stringify(s.monster), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.machine.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.machine.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateMachineState(s)).toBe(true);
    s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.machine.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.machine.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify(s.monster)).toBe(s9);
    expect(s.machine.bottles.slice(3).map(b => b.id)).toEqual(['machine-potion-4', 'machine-potion-5', 'machine-potion-6']);
    expect(s.machine.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'machine-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'machine-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 160);
    apply(s, { type: 'CONSUME', bottleId: 'machine-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.machine.promotionWeek]).toEqual([5, 12]);
    expect(validateMachineState(s)).toBe(true);
  });

  it('does not refill automatically, supply before exhaustion or reuse old stock', () => {
    for (const s of [ordinary(), monster(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.machine.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    const supplied = resupplied(), old = JSON.stringify(supplied.machine.bottles.slice(0, 3));
    for (let i = 3; i < 6; i += 1) buy(supplied, i);
    for (let i = 3; i < 6; i += 1) { supplied.mind = 100; apply(supplied, { type: 'CONSUME', bottleId: supplied.machine.bottles[i]!.id, confirmed: true }, 80); }
    apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 13; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    expect(supplied.machine.bottles.map(b => b.id)).toEqual(Array.from({ length: 9 }, (_, i) => `machine-potion-${i + 1}`));
    expect(JSON.stringify(supplied.machine.bottles.slice(0, 3))).toBe(old);
    expect(validateMachineState(supplied)).toBe(true);
  });

  it('accepts exact commands and rejects fabricated promotion, bottle history and mastery', () => {
    const commands: MachineCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'POTION_WORK', bottleId: MACHINE_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'machine-potion-99' },
      { type: 'CONSUME', bottleId: MACHINE_BOTTLE_IDS[0], confirmed: true },
      ...MACHINE_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['ABILITY', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateMachineCommand(command)).toBe(true); if (!isMachineAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'PREPARE', caseId: 'private-question', method: 'ATTEND' },
      { type: 'REPORT', caseId: 'private-question', claim: 'CERTAIN' },
      { type: 'BUY_POTION', bottleId: 'machine-potion-01' },
    ]) expect(validateMachineCommand(command)).toBe(false);
    const valid = promoted();
    for (const change of [
      (s: SliceState) => { s.machine.monsterActingAtPromotion = 99; },
      (s: SliceState) => { s.machine.promotionWeek = 10; },
      (s: SliceState) => { s.machine.bottles[0]!.consumedWeek = 8; },
      (s: SliceState) => { s.machine.bottles[0]!.source = 'invented'; },
      (s: SliceState) => { delete s.progression.mastery[MONSTER_ABILITY_IDS[0]]; },
      (s: SliceState) => { s.progression.mastery['wheel.s7.luck'] = 0; },
      (s: SliceState) => { s.machine.cases['private-question']!.closes = -1; },
    ]) { const s = structuredClone(valid); change(s); expect(validateMachineState(s)).toBe(false); }
  });

  it('keeps canon abilities, G interpretation and incomplete recipe boundaries explicit', () => {
    expect(MACHINE_SOURCE_STATUS).toContain('第四部第178章');
    for (const boundary of ['强大计算能力', '精确控制', '身体素质提升', '格斗和射击天赋', '占卜和反占卜', '无限记忆', '自动制造', '完美命中', '万能反占卜', '序列7幸运儿', '本作原创G']) expect(MACHINE_SOURCE_STATUS).toContain(boundary);
    expect(MACHINE_ABILITIES).toHaveLength(2);
    expect(projectMachine(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
    const s = promoted(), c = s.machine.cases['private-question']!;
    c.status = 'PREPARED'; c.method = 'ABILITY';
    expect(projectMachine(s).insideCase).toBe(false);
    c.status = 'EXAMINED'; c.contactOpen = true;
    expect(projectMachine(s).insideCase).toBe(true);
  });
});
