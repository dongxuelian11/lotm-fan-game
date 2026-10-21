import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, awardSeerMastery, createSeerState, emptyProgression, projectSeer, validateSeerState, type SeerContext } from '../../src/domain/seer/index.js';
import { SEER_FORMULA } from '../../src/domain/seer/content.js';
import { SEER_ABILITY_IDS, type SeerCommand } from '../../src/domain/seer/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function state(): SliceState {
  const s = createSliceRun('seer-acquisition', sliceDefaultCreationSelection, 'seer-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.cash = 5000;
  s.week = 5;
  s.actionsRemaining = 30;
  s.weeklyBudget = 30;
  s.progression = emptyProgression();
  s.seer = createSeerState();
  s.character.coreStats.will = 15;
  s.character.coreStats.knowledge = 15;
  return s;
}

function context(s: SliceState, checkRoll = 20, masteryTicket = 1) {
  const draws: [number, number][] = [];
  const checks: [PublicCoreStatKey, number][] = [];
  const notes: { title: string; text: string }[] = [];
  const c: SeerContext = {
    roll(min, max) { draws.push([min, max]); return Math.min(max, Math.max(min, masteryTicket)); },
    check(ability, difficulty) {
      checks.push([ability, difficulty]);
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll });
      s.lastCheck = result;
      return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, draws, checks, notes };
}

function apply(s: SliceState, command: SeerCommand, checkRoll = 20) { applySeerCommand(s, command, context(s, checkRoll).c); }
function taught(s = state()) {
  apply(s, { type: 'DISCOVER' });
  apply(s, { type: 'LEARN_FORMULA' });
  return s;
}
function brew(s: SliceState, index = 0) {
  const batchId = s.seer.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId });
  apply(s, { type: 'BREW', batchId });
  return s.seer.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true });
  return s;
}
function unchangedRejection(s: SliceState, command: SeerCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('finite, original-source seer acquisition', () => {
  it('keeps formula, supply and ability inventory private before discovery', () => {
    const s = state(), p = projectSeer(s);
    expect(validateSeerState(s)).toBe(true);
    expect(p.formula).toEqual([]);
    expect(p.bottles).toEqual([]);
    expect(p.abilities).toEqual([]);
    expect(p.actions.map(action => action.command.type)).toEqual(['DISCOVER']);
    expect(JSON.stringify(p)).not.toMatch(/seer-batch|拉瓦|星水晶|供应方剩余|仅有3批/);
    expect(s.seer.batches).toHaveLength(3);
    const independent = createSeerState();
    independent.batches[0]!.materials[0]!.quantity = 0;
    expect(s.seer.batches[0]!.materials[0]!.quantity).toBe(100);
  });

  it('uses an ordinary one-action visit without granting supernatural powers', () => {
    const s = state(), stats = { ...s.character.coreStats }, cash = s.cash;
    apply(s, { type: 'DISCOVER' });
    expect(s.actionsRemaining).toBe(29);
    expect(s.cash).toBe(cash);
    expect(s.character.coreStats).toEqual(stats);
    expect(s.progression).toEqual(emptyProgression());
    expect(projectSeer(s).formula).toEqual([]);
    expect(projectSeer(s).risk).toContain('仅有3批');
    unchangedRejection(s, { type: 'DISCOVER' });
  });

  it('teaches the seven sourced quantities for exactly 120 pence and one action', () => {
    const s = taught(), p = projectSeer(s);
    expect([s.cash, s.actionsRemaining]).toEqual([4880, 28]);
    expect(p.formula.map(item => `${item.name}:${item.quantity}${item.unit}`)).toEqual([
      '纯水:100mL', '夜香草汁液:13滴', '金薄荷叶:7片', '毒堇汁:3滴', '龙血草粉末:9g', '拉瓦章鱼血:10mL', '星水晶:50g',
    ]);
    expect(s.seer.batches[0]!.materials[5]!.source).toContain('避光');
    expect(p.abilities).toEqual([]);
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    expect(validateSeerState(s)).toBe(true);
  });

  it('pays 660 once for a whole batch, then 60 and one action for its own bottle', () => {
    const s = taught(), batch = s.seer.batches[0]!, ap = s.actionsRemaining;
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([4220, ap]);
    expect(batch.materials.every(item => item.holder === 'PLAYER')).toBe(true);
    apply(s, { type: 'BREW', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([4160, ap - 1]);
    expect(batch.materials.every(item => item.holder === 'CONSUMED' && item.quantity === 0)).toBe(true);
    expect(s.seer.bottles[0]!.inputIds).toEqual(batch.materials.map(item => item.id));
    expect(s.seer.bottles[0]!.status).toBe('PREPARED');
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    unchangedRejection(s, { type: 'BREW', batchId: batch.id });
    expect(validateSeerState(s)).toBe(true);
  });

  it('exchanges two real one-action tasks for this batch’s 600 pence main fee only', () => {
    const s = taught(), batchId = s.seer.batches[0]!.id;
    apply(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectSeer(s).actions.find(action => action.id === `buy-${batchId}`)?.cost).toContain('660便士');
    apply(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectSeer(s).actions.find(action => action.id === `buy-${batchId}`)?.cost).toContain('60便士');
    expect(s.seer.batches[0]!.materials.every(item => item.holder === 'SUPPLIER')).toBe(true);
    apply(s, { type: 'BUY_MATERIALS', batchId });
    apply(s, { type: 'BREW', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([4760, 25]);
    expect(s.seer.batches[1]!.labourSteps).toBe(0);
    expect(projectSeer(s).actions.find(action => action.id === 'buy-seer-batch-2')?.cost).toContain('660便士');
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId });
  });

  it('does not cash out partial labour, backdate credit, or consume nonexistent stock', () => {
    const s = taught(), batchId = s.seer.batches[0]!.id;
    apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    expect(cash - s.cash).toBe(660);
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'seer-batch-4' });
    s.seer.batches[0]!.materials[0]!.quantity = 99;
    unchangedRejection(s, { type: 'BREW', batchId });
    expect(validateSeerState(s)).toBe(false);
  });

  it('rejects insufficient money or missing prerequisites before charging anything', () => {
    const s = state();
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    apply(s, { type: 'DISCOVER' });
    s.cash = 119;
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    s.cash = 1000;
    apply(s, { type: 'LEARN_FORMULA' });
    const batchId = s.seer.batches[0]!.id;
    unchangedRejection(s, { type: 'BREW', batchId });
    s.cash = 659;
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 719;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    unchangedRejection(s, { type: 'BREW', batchId });
  });

  it('keeps the original three batches consumed until an explicit later supply delivery', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) brew(s, index);
    expect(new Set(s.seer.bottles.map(bottle => bottle.id)).size).toBe(3);
    expect(new Set(s.seer.bottles.flatMap(bottle => bottle.inputIds)).size).toBe(21);
    for (const bottle of s.seer.bottles) apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    expect(s.seer.bottles.every(bottle => bottle.status === 'CONSUMED')).toBe(true);
    expect(s.seer.pollution).toBe(75);
    s.week += 10;
    expect(projectSeer(s).risk).toContain('供应方剩余0批');
    expect(projectSeer(s).actions.map(a=>a.command.type)).toEqual(['REQUEST_SUPPLY']);expect(s.seer.batches).toHaveLength(3);
    expect(validateSeerState(s)).toBe(true);
  });
});

describe('one-bottle promotion and honest risk', () => {
  it('waits until week five and requires separate confirmation without charging AP', () => {
    const s = prepared(), bottleId = s.seer.bottles[0]!.id;
    s.week = 4;
    const offer = projectSeer(s).actions.find(action => action.command.type === 'CONSUME')!;
    expect(offer.enabled).toBe(false);
    expect(offer.reason).toContain('3/4');
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
    s.week = 5;
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: false } as unknown as SeerCommand);
    const ap = s.actionsRemaining;
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.actionsRemaining).toBe(ap);
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
  });

  for (const [roll, tier, mentalCost, healthCost, pollution, isPromoted] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [98, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} with the original bottle and exact costs`, () => {
    const s = prepared(), before = { ...s.character.coreStats }, ap = s.actionsRemaining;
    s.spirituality = 7;
    const ctx = context(s, roll);
    applySeerCommand(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 5]]);
    expect(ctx.draws).toEqual([]);
    expect(s.seer.bottles[0]!.status).toBe('CONSUMED');
    expect(s.seer.bottles[0]!.outcome).toBe(tier);
    expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap]);
    expect(s.status).toBe('ACTIVE');
    expect(projectSeer(s).promoted).toBe(isPromoted);
    expect(s.character.coreStats).toEqual(isPromoted ? { ...before, perception: before.perception + 3, will: before.will + 2, knowledge: before.knowledge + 3 } : before);
    expect(Object.keys(s.progression.mastery)).toEqual(isPromoted ? [...SEER_ABILITY_IDS] : []);
    expect(Object.values(s.progression.mastery).every(value => value === 0)).toBe(true);
    expect(validateSeerState(s)).toBe(true);
  });

  it('retains the full severe penalty even below zero, without inventing death or a free retry', () => {
    const s = prepared();
    s.health = 1; s.mind = 1;
    apply(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([-19, -39, 50]);
    expect(s.status).toBe('ACTIVE');
    expect(s.progression.pathwayId).toBeNull();
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: s.seer.batches[1]!.id });
    expect(validateSeerState(s)).toBe(true);
  });

  it('uses the real normal-check chance and does not change it to an advertised fixed chance', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectSeer(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 5, modifiers: [] }));
    }
    s.character.coreStats.perception = 499;
    s.character.coreStats.knowledge = 500;
    apply(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true }, 1);
    expect(s.character.coreStats).toMatchObject({ perception: 500, will: 500, knowledge: 500 });
  });

  it('publishes detached formula, commands, abilities and original-bottle descriptions', () => {
    const s = promoted(), before = JSON.stringify(s), p = projectSeer(s);
    expect(p.bottles[0]!.source).toBe('占卜俱乐部指导者调配台，第5周；仅由seer-batch-1的七项材料调配，原瓶seer-batch-1:bottle');
    p.formula[0]!.quantity = 999;
    p.abilities[0]!.mastery = 500;
    p.bottles[0]!.source = 'different';
    expect(JSON.stringify(s)).toBe(before);
    expect(SEER_FORMULA[0].quantity).toBe(100);
  });
});

describe('known-target divination and one-packet mastery', () => {
  for (const roll of [1, 20, 80, 100]) it(`divination roll ${roll} spends 1 AP and 3 spirit whether it succeeds or not`, () => {
    const s = promoted(), beforeAp = s.actionsRemaining, beforeSpirit = s.spirituality, ctx = context(s, roll);
    applySeerCommand(s, { type: 'DIVINE', targetId: 'FIRST_CASE' }, ctx.c);
    expect([s.actionsRemaining, s.spirituality]).toEqual([beforeAp - 1, beforeSpirit - 3]);
    expect(ctx.checks).toEqual([['knowledge', 12]]);
    if (roll <= 20) {
      expect(s.seer.omen).toEqual({ targetId: 'FIRST_CASE', createdWeek: 5, used: false });
      expect(Object.values(s.progression.mastery).reduce((sum, value) => sum + value, 0)).toBe(8);
      expect(ctx.draws).toEqual([[1, 20]]);
      unchangedRejection(s, { type: 'DIVINE', targetId: 'FIRST_CASE' });
    } else {
      expect(s.seer.omen).toBeNull();
      expect(ctx.draws).toEqual([]);
      expect(s.seer.completedSources).toEqual([]);
    }
    expect(validateSeerState(s)).toBe(true);
  });

  it('never treats a secret or completed case as a divination target and never spends absent spirit', () => {
    const ordinary = taught();
    unchangedRejection(ordinary, { type: 'DIVINE', targetId: 'FIRST_CASE' });
    const s = promoted();
    unchangedRejection(s, { type: 'DIVINE', targetId: 'UNKNOWN_SECRET' } as unknown as SeerCommand);
    s.spirituality = 2.9;
    unchangedRejection(s, { type: 'DIVINE', targetId: 'FIRST_CASE' });
    s.spirituality = 10; s.arc.stage = 'ENDED';
    unchangedRejection(s, { type: 'DIVINE', targetId: 'FIRST_CASE' });
  });

  it('can replace a used omen but never farms a second reward for its source', () => {
    const s = promoted();
    apply(s, { type: 'DIVINE', targetId: 'FIRST_CASE' });
    s.seer.omen!.used = true;
    const before = { ...s.progression.mastery }, ctx = context(s);
    applySeerCommand(s, { type: 'DIVINE', targetId: 'FIRST_CASE' }, ctx.c);
    expect(s.seer.omen!.used).toBe(false);
    expect(s.progression.mastery).toEqual(before);
    expect(s.seer.completedSources).toEqual(['first-case-divination']);
    expect(ctx.draws).toEqual([]);
  });

  it('weights the whole known pool by mastery tier, selecting only one ability', () => {
    const s = promoted();
    const [a, b, c, d] = SEER_ABILITY_IDS;
    s.progression.mastery = { [a]: 0, [b]: 100, [c]: 200, [d]: 400 };
    const ctx = context(s, 20, 10);
    awardSeerMastery(s, 'case-inspection', 8, ctx.c);
    expect(ctx.draws).toEqual([[1, 13]]);
    expect(s.progression.mastery).toEqual({ [a]: 0, [b]: 100, [c]: 208, [d]: 400 });
    expect(s.progression.acting).toBe(0);
    awardSeerMastery(s, 'case-inspection', 8, ctx.c);
    expect(ctx.draws).toHaveLength(1);
  });

  for (const value of [0, 99, 100, 199, 200, 299, 300, 399, 400, 499]) it(`uses the correct candidate weight at mastery ${value}`, () => {
    const s = promoted(), [a, b, c, d] = SEER_ABILITY_IDS;
    s.progression.mastery = { [a]: value, [b]: 500, [c]: 500, [d]: 500 };
    const ctx = context(s);
    awardSeerMastery(s, `study-${value}`, 5, ctx.c);
    expect(ctx.draws).toEqual([[1, 5 - Math.floor(value / 100)]]);
    expect(s.progression.mastery[a]).toBe(Math.min(500, value + 5));
  });

  it('drops overflow at 500 without rerolling and records a fully capped source once', () => {
    const s = promoted(), [a, b, c, d] = SEER_ABILITY_IDS;
    s.progression.mastery = { [a]: 490, [b]: 500, [c]: 500, [d]: 500 };
    const ctx = context(s);
    awardSeerMastery(s, 'first-case-combat', 25, ctx.c);
    expect(s.progression.mastery[a]).toBe(500);
    expect(ctx.draws).toEqual([[1, 1]]);
    awardSeerMastery(s, 'all-capped-study', 5, ctx.c);
    expect(ctx.draws).toHaveLength(1);
    expect(s.seer.completedSources).toEqual(['first-case-combat', 'all-capped-study']);
    expect(validateSeerState(s)).toBe(true);
  });

  it('never stores ordinary skills or gives ordinary characters an ability packet', () => {
    const s = taught(), ctx = context(s);
    awardSeerMastery(s, 'ordinary-work', 5, ctx.c);
    expect(s.progression.mastery).toEqual({});
    expect(s.seer.completedSources).toEqual([]);
    expect(ctx.draws).toEqual([]);
  });
});

describe('local save continuity checks', () => {
  it('accepts a real JSON round trip and rejects duplicate or impossible bottle ownership', () => {
    const s = promoted();
    expect(validateSeerState(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
    for (const mutate of [
      (v: SliceState) => { v.seer.bottles.push({ ...v.seer.bottles[0]! }); },
      (v: SliceState) => { v.seer.batches[0]!.materials[0]!.quantity = 100; },
      (v: SliceState) => { v.seer.batches[0]!.materials[0]!.holder = 'PLAYER'; },
      (v: SliceState) => { v.seer.bottles[0]!.inputIds[0] = 'seer-batch-2:pure-water'; },
      (v: SliceState) => { v.seer.bottles[0]!.status = 'PREPARED'; },
      (v: SliceState) => { v.progression.promotionWeek = 4; },
      (v: SliceState) => { v.progression.mastery['ordinary.punch'] = 100; },
      (v: SliceState) => { v.seer.completedSources = ['same', 'same']; },
      (v: SliceState) => { v.seer.formulaKnown = false; },
    ]) {
      const invalid = JSON.parse(JSON.stringify(s)) as SliceState;
      mutate(invalid);
      expect(validateSeerState(invalid)).toBe(false);
    }
  });

  it('does not throw on malformed nested saved data', () => {
    const s = state();
    for (const malformed of [null, {}, { ...s.seer, batches: [null, null, null] }, { ...s.seer, bottles: [null] }]) {
      const invalid = { ...s, seer: malformed } as unknown as SliceState;
      expect(validateSeerState(invalid)).toBe(false);
    }
  });
});

describe('first potion story and resolved-case guidance', () => {
  for (const roll of [1, 20, 90, 100]) it(`keeps potion roll ${roll} consequences and historical persisted prose`, () => {
    const s = prepared(), ctx = context(s, roll);
    s.arc.stage = 'ENDED';
    const bottle = s.seer.bottles[0]!;
    expect(projectSeer(s).bottles[0]!.source).toBe('占卜俱乐部指导者调配台，第5周；仅由seer-batch-1的七项材料调配，原瓶seer-batch-1:bottle');
    applySeerCommand(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, ctx.c);
    const text = ctx.notes.at(-1)!.text;
    expect(text).toMatch(/^原瓶seer-batch-1:bottle已耗尽。意志判定/);
    expect(text).not.toContain('马洛·里德');
    expect(ctx.checks).toEqual([['will', 5]]);
    expect(bottle.status).toBe('CONSUMED');
    if (roll <= 20) {
      expect(text).toBe(`原瓶seer-batch-1:bottle已耗尽。意志判定${roll}/${s.lastCheck!.chance}，${roll === 1 ? '大成功' : '成功'}：精神−${roll === 1 ? 5 : 10}，感知+3、意志+2、知识+3。四项非凡能力从0掌握开始，灵性上限提高到30，当前灵性没有补满。`);
      expect(s.progression.sequence).toBe(9);
    } else {
      expect(text).toBe(`原瓶seer-batch-1:bottle已耗尽。意志判定${roll}/${s.lastCheck!.chance}，${roll === 100 ? '灾难' : '失败'}：精神−${roll === 100 ? 40 : 20}、健康−${roll === 100 ? 20 : 10}、排异+${roll === 100 ? 50 : 25}。你仍是普通人。指导者处理了现场，未发生死亡；需要休养，重试须另备一瓶。`);
      expect(s.progression.pathwayId).toBeNull();
      expect(s.seer.pollution).toBe(roll === 100 ? 50 : 25);
    }
    expect(validateSeerState(s)).toBe(true);
  });

  it('replaces obsolete first-case divination guidance with existing commissions without rewriting the old omen', () => {
    const s = promoted();
    apply(s, { type: 'DIVINE', targetId: 'FIRST_CASE' });
    s.arc.stage = 'ENDED';
    const before = JSON.stringify(s.seer.omen), p = projectSeer(s);
    expect(p.actions.some(action => action.command.type === 'DIVINE')).toBe(false);
    const description = p.abilities.find(ability => ability.id === 'diviner.s9.divination')!.description;
    expect(description).toContain('装箱单与行程委托');
    expect(description).not.toContain('下一次首案判定');
    expect(p.risk).not.toContain('当前保有一枚');
    expect(p.practice.body).toContain('首案已收尾');
    expect(JSON.stringify(s.seer.omen)).toBe(before);
  });
});
