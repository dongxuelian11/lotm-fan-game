import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyArbiterCommand } from '../../src/domain/arbiter/index.js';
import { applyArbiterActivity } from '../../src/domain/arbiter/life.js';
import { ARBITER_ABILITY_IDS, ARBITER_CASE_IDS } from '../../src/domain/arbiter/types.js';
import {
  applySheriffCommand, createSheriffState, isSheriffAcquisitionCommand,
  projectSheriff, validateSheriffCommand, validateSheriffState,
} from '../../src/domain/sheriff/index.js';
import {
  SHERIFF_ABILITIES, SHERIFF_BOTTLE_IDS, SHERIFF_FORMULA_STATUS, SHERIFF_LABOUR_TASKS,
  SHERIFF_SOURCE_STATUS, SHERIFF_CONSUMPTION_RISK,
} from '../../src/domain/sheriff/content.js';
import { SHERIFF_ABILITY_IDS, SHERIFF_CASE_IDS, type SheriffAcquisitionCommand, type SheriffCommand } from '../../src/domain/sheriff/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('sheriff-acquisition', sliceDefaultCreationSelection, 'sheriff-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.sheriff = createSheriffState();
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
function arbiter() {
  const s = ordinary(), c = context(s, 1).c;
  applyArbiterCommand(s, { type: 'DISCOVER' }, c);
  applyArbiterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyArbiterCommand(s, { type: 'BUY_POTION', bottleId: s.arbiter.bottles[0]!.id }, c);
  applyArbiterCommand(s, { type: 'CONSUME', bottleId: s.arbiter.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[ARBITER_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of ARBITER_CASE_IDS) {
    applyArbiterActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyArbiterActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applyArbiterActivity(s, { type: 'PERFORM', caseId }, c, award);
    applyArbiterActivity(s, { type: 'CLOSE', caseId }, c, award);
    applyArbiterActivity(s, { type: 'REPORT', caseId }, c, award);
  }
  applyArbiterActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(ARBITER_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: SheriffAcquisitionCommand, roll = 20) { applySheriffCommand(s, command, context(s, roll).c); }
function taught(s = arbiter()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.sheriff.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of SHERIFF_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as SheriffAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Acquisition owns originals, maturity and promotion. Life owns exact case transitions and actual CLOSE.
describe('Sheriff independent S8 acquisition', () => {
  it('starts with three separate G originals, untouched cases and no recipe', () => {
    const s = ordinary(), p = projectSheriff(s);
    expect(validateSheriffState(s)).toBe(true);
    expect(s.sheriff.bottles.map(b => b.id)).toEqual([...SHERIFF_BOTTLE_IDS]);
    expect(s.sheriff.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.sheriff.cases)).toEqual([...SHERIFF_CASE_IDS]);
    expect(Object.values(s.sheriff.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.contactOpen && c.closes === 0)).toBe(true);
    expect(p).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('continues with the same original adult guide for180 and1AP without changing S9 history', () => {
    const s = arbiter(), old = JSON.stringify(s.arbiter), progression = JSON.stringify(s.progression), ctx = context(s);
    applySheriffCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.sheriff.guidanceKnown]).toEqual([9820, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的本作原创成年民间调解文书员薇娜·贝尔');
    expect(projectSheriff(s).supplies).toContain(SHERIFF_FORMULA_STATUS);
    expect(projectSheriff(s).risk).toContain(SHERIFF_CONSUMPTION_RISK);
    expect(JSON.stringify(s.arbiter)).toBe(old); expect(JSON.stringify(s.progression)).toBe(progression);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateSheriffState(s)).toBe(true);
  });

  it('requires exact bottle confirmation and does not let old bottles stand for new originals', () => {
    const s = prepared(), bottleId = SHERIFF_BOTTLE_IDS[0];
    for (const command of [
      { type: 'CONSUME', bottleId }, { type: 'CONSUME', bottleId, confirmed: false },
      { type: 'CONSUME', bottleId, confirmed: 'true' },
      { type: 'CONSUME', bottleId, confirmed: true, free: true },
      { type: 'CONSUME', bottleId: 'arbiter-potion-1', confirmed: true },
    ]) { expect(validateSheriffCommand(command)).toBe(false); rejected(s, command); }
    rejected(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[1], confirmed: true });
    expect(s.sheriff.bottles[0]!.status).toBe('PLAYER');
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.progression.sequence).toBe(8);
  });

  it('delivers an original for1210 at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: SHERIFF_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.sheriff.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.sheriff.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateSheriffState(s)).toBe(true);
  });

  it('requires three real jobs per bottle before paying its remaining160', () => {
    const s = taught(), bottleId = SHERIFF_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 3; step += 1) {
      applySheriffCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.sheriff.bottles[0]!.labourSteps]).toEqual([9820, 38 - step, step + 1]);
      expect(projectSheriff(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(SHERIFF_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.sheriff.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 159; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 160; buy(s);
    expect([s.cash, s.actionsRemaining, s.sheriff.bottles[0]!.status]).toEqual([0, 36, 'PLAYER']);
  });

  it('allows early preparation but requires acting100 and four whole S9 weeks to consume', () => {
    const s = arbiter(); s.week = 5; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 8;
    rejected(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    apply(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.sheriff.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateSheriffState(s)).toBe(true);
  });

  it('blocks wrong channels, ended runs and both old and current open contacts atomically', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.arbiter.discovered = false; },
      s => { s.arbiter.guidanceKnown = false; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.arbiter.cases['shared-yard']!.contactOpen = true; },
      s => { s.sheriff.cases['known-route']!.contactOpen = true; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
      expect(projectSheriff(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    }
    const s = arbiter(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: SHERIFF_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves four recoverable will12 tiers while preserving actual S9 mastery, history and resources', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify(s.arbiter), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectSheriff(s).bottles[0]!.chance;
      applySheriffCommand(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.sheriff.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['justiciar', success ? 8 : 9, 5, success ? 0 : 100]);
      expect([s.sheriff.promotionWeek, s.sheriff.arbiterActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
      expect(JSON.stringify(s.arbiter)).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of ARBITER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 2], ['perception', 2], ['will', 1], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS] : [...ARBITER_ABILITY_IDS]);
      if (success) {
        for (const id of SHERIFF_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
        expect(projectSliceState(s).maxSpirituality).toBe(45);
      }
      expect(Object.values(s.sheriff.cases).every(c => !c.contactOpen && c.closes === 0)).toBe(true);
      expect(s.status).toBe('ACTIVE'); expect(validateSheriffState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps attribute gains at500 and never grants higher-sequence abilities', () => {
    const s = prepared();
    Object.assign(s.character.coreStats, { physique: 500, perception: 499, will: 499, knowledge: 499 });
    apply(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(SHERIFF_ABILITY_IDS).toEqual(['justiciar.s8.trace-sensing', 'justiciar.s8.image-reconstruction']);
    expect(projectSheriff(s).abilities).toEqual(SHERIFF_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });

  it('keeps severe rejection recoverable and requires restored health and mind before retry', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateSheriffState(s)).toBe(true);
    s.health = 100; s.mind = 100;
    apply(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[1], confirmed: true });
    expect(s.sheriff.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.sheriff.bottles[1]!.outcome).toBe('SUCCESS');
    expect(s.seer.pollution).toBe(100);
    expect(validateSheriffState(s)).toBe(true);
  });

  it('retains held originals after promotion but forbids repeat acquisition', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true });
    expect(s.sheriff.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: SHERIFF_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: SHERIFF_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectSheriff(s).digestion).toContain('仲裁人消化成果100/100已保留；治安官扮演0/100');
    expect(validateSheriffState(s)).toBe(true);
  });

  it('waits a real week after all failures before delivering three new payable originals', () => {
    const s = exhausted(), old = JSON.stringify(s.sheriff.bottles), s9 = JSON.stringify(s.arbiter), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.sheriff.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.sheriff.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateSheriffState(s)).toBe(true);
    s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.sheriff.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.sheriff.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify(s.arbiter)).toBe(s9);
    expect(s.sheriff.bottles.slice(3).map(b => b.id)).toEqual(['sheriff-potion-4', 'sheriff-potion-5', 'sheriff-potion-6']);
    expect(s.sheriff.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'sheriff-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'sheriff-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 160);
    apply(s, { type: 'CONSUME', bottleId: 'sheriff-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.sheriff.promotionWeek]).toEqual([5, 12]);
    expect(validateSheriffState(s)).toBe(true);
  });

  it('does not refill automatically, supply before exhaustion or reuse old stock', () => {
    for (const s of [ordinary(), arbiter(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.sheriff.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    const supplied = resupplied(), old = JSON.stringify(supplied.sheriff.bottles.slice(0, 3));
    for (let i = 3; i < 6; i += 1) buy(supplied, i);
    for (let i = 3; i < 6; i += 1) { supplied.mind = 100; apply(supplied, { type: 'CONSUME', bottleId: supplied.sheriff.bottles[i]!.id, confirmed: true }, 80); }
    apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 13; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    expect(supplied.sheriff.bottles.map(b => b.id)).toEqual(Array.from({ length: 9 }, (_, i) => `sheriff-potion-${i + 1}`));
    expect(JSON.stringify(supplied.sheriff.bottles.slice(0, 3))).toBe(old);
    expect(validateSheriffState(supplied)).toBe(true);
  });

  it('accepts exact commands and rejects fabricated promotion, bottle history and mastery', () => {
    const commands: SheriffCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' },
      { type: 'POTION_WORK', bottleId: SHERIFF_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'sheriff-potion-99' },
      { type: 'CONSUME', bottleId: SHERIFF_BOTTLE_IDS[0], confirmed: true },
      ...SHERIFF_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['ABILITY', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateSheriffCommand(command)).toBe(true); if (!isSheriffAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'PREPARE', caseId: 'known-route', method: 'ATTEND' },
      { type: 'REPORT', caseId: 'known-route', claim: 'CERTAIN' },
      { type: 'BUY_POTION', bottleId: 'sheriff-potion-01' },
    ]) expect(validateSheriffCommand(command)).toBe(false);
    const valid = promoted();
    for (const change of [
      (s: SliceState) => { s.sheriff.arbiterActingAtPromotion = 99; },
      (s: SliceState) => { s.sheriff.promotionWeek = 10; },
      (s: SliceState) => { s.sheriff.bottles[0]!.consumedWeek = 8; },
      (s: SliceState) => { s.sheriff.bottles[0]!.source = 'invented'; },
      (s: SliceState) => { delete s.progression.mastery[ARBITER_ABILITY_IDS[0]]; },
      (s: SliceState) => { s.progression.mastery['justiciar.s7.mental-piercing'] = 0; },
      (s: SliceState) => { s.sheriff.cases['known-route']!.closes = -1; },
    ]) { const s = structuredClone(valid); change(s); expect(validateSheriffState(s)).toBe(false); }
  });

  it('keeps canon abilities, G interpretation and incomplete recipe boundaries explicit', () => {
    for (const chapter of ['第四部第31章', '第四部第126章', '第五部第53章']) expect(SHERIFF_SOURCE_STATUS).toContain(chapter);
    for (const boundary of ['见过的特征', '重构图像', '接近且没有有效屏蔽', '邪恶、混乱、疯狂', '道德判罪', '全域定位', '已知图像', '不能跨越过长间隔', '序列7审讯者', '序列6法官', '本作原创G', '不任命玩家为官方人员']) expect(SHERIFF_SOURCE_STATUS).toContain(boundary);
    expect(SHERIFF_ABILITIES).toHaveLength(2);
    for (const fragment of ['第二部第17章', '恐惧魔虫眼睛一对', '银白战熊右掌', '完整配方尚未核实', '不补造克数或辅材']) expect(SHERIFF_FORMULA_STATUS).toContain(fragment);
    expect(projectSheriff(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
    const s = promoted(), c = s.sheriff.cases['known-route']!;
    c.status = 'PREPARED'; c.method = 'ABILITY';
    expect(projectSheriff(s).insideCase).toBe(false);
    c.status = 'EXAMINED'; c.contactOpen = true;
    expect(projectSheriff(s).insideCase).toBe(true);
  });
});
