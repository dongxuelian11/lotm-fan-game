import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types.js';
import { applyClownCommand, createClownState, projectClown, validateClownState } from '../../src/domain/clown/index.js';
import { CLOWN_ABILITIES, CLOWN_FORMULA } from '../../src/domain/clown/content.js';
import { CLOWN_ABILITY_IDS, type ClownAcquisitionCommand } from '../../src/domain/clown/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('clown-acquisition', sliceDefaultCreationSelection, 'clown-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.clown = createClownState();
  return s;
}

function context(s: SliceState, checkRoll = 20) {
  const checks: [PublicCoreStatKey, number][] = [];
  const draws: [number, number][] = [];
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

function state(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applySeerCommand(s, { type: 'DISCOVER' }, c);
  applySeerCommand(s, { type: 'LEARN_FORMULA' }, c);
  applySeerCommand(s, { type: 'BUY_MATERIALS', batchId: s.seer.batches[0]!.id }, c);
  applySeerCommand(s, { type: 'BREW', batchId: s.seer.batches[0]!.id }, c);
  applySeerCommand(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries(SEER_ABILITY_IDS.map((id, index) => [id, 25 * index]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: ClownAcquisitionCommand, roll = 20) { applyClownCommand(s, command, context(s, roll).c); }
function taught(s = state()) { apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.clown.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId });
  apply(s, { type: 'BREW', batchId });
  return s.clown.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() {
  const s = prepared();
  apply(s, { type: 'CONSUME', bottleId: s.clown.bottles[0]!.id, confirmed: true });
  return s;
}
function unchangedRejection(s: SliceState, command: ClownAcquisitionCommand) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('sourced small-batch clown acquisition', () => {
  it('keeps formula, abilities and supply details hidden from ordinary people', () => {
    const s = ordinary(), p = projectClown(s);
    expect(validateClownState(s)).toBe(true);
    expect(p.discovered).toBe(false);
    expect(p.actions).toEqual([]);
    expect(p.formula).toEqual([]);
    expect(p.bottles).toEqual([]);
    expect(p.abilities).toEqual([]);
    expect(JSON.stringify(p)).not.toMatch(/clown-batch|霍纳奇斯|人脸玫瑰|1200|仅有3批/);
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    unchangedRejection(s, { type: 'BUY_PAPER' });
    const separate = createClownState();
    separate.batches[0]!.materials[0]!.quantity = 0;
    separate.rescue.enemyStatus = 'DEAD';
    expect(s.clown.batches[0]!.materials[0]!.quantity).toBe(80);
    expect(s.clown.rescue.enemyStatus).toBe('RESISTING');
  });

  it('uses the existing mentor, charging 180 pence and one action without a second discovery', () => {
    const s = state(), oldSeer = JSON.stringify(s.seer), progression = JSON.stringify(s.progression);
    expect(projectClown(s).actions.map(action => action.command.type)).toEqual(['LEARN_FORMULA']);
    expect(projectClown(s).formula).toEqual([]);
    apply(s, { type: 'LEARN_FORMULA' });
    expect([s.cash, s.actionsRemaining]).toEqual([9820, 39]);
    expect(JSON.stringify(s.seer)).toBe(oldSeer);
    expect(JSON.stringify(s.progression)).toBe(progression);
    expect(projectClown(s).formula.map(item => `${item.name}:${item.quantity}${item.unit}`)).toEqual([
      '纯水:80mL', '曼陀罗汁液:5滴', '黑边太阳花粉末:7g', '金斗篷草粉末:10g', '毒堇汁:3滴',
      '完整人脸玫瑰:1朵', '成年霍纳奇斯灰山羊独角结晶:1枚',
    ]);
    expect(validateClownState(s)).toBe(true);
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
  });

  it('allows preparation before digestion and the six-week minimum are complete', () => {
    const s = state();
    s.week = 5;
    s.progression.acting = 0;
    taught(s);
    const bottle = brew(s);
    expect(bottle.status).toBe('PREPARED');
    unchangedRejection(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(validateClownState(s)).toBe(true);
  });

  it('buys all seven originals once for 1290, then consumes them in order for an 80-pence bottle', () => {
    const s = taught(), batch = s.clown.batches[0]!, ap = s.actionsRemaining;
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([8530, ap]);
    expect(batch.materials.every(item => item.holder === 'PLAYER')).toBe(true);
    const ctx = context(s);
    applyClownCommand(s, { type: 'BREW', batchId: batch.id }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([8450, ap - 1]);
    expect(batch.materials.every(item => item.holder === 'CONSUMED' && item.quantity === 0)).toBe(true);
    expect(s.clown.bottles[0]!.inputIds).toEqual(CLOWN_FORMULA.map(item => `${batch.id}:${item.id}`));
    expect(ctx.notes[0]!.text).toContain('五项辅材依次加入，再投入完整人脸玫瑰，最后加入独角结晶');
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    unchangedRejection(s, { type: 'BREW', batchId: batch.id });
    expect(validateClownState(s)).toBe(true);
  });

  it('requires three actual tasks for only this batch’s 1200-pence main-material credit', () => {
    const s = taught(), batch = s.clown.batches[0]!;
    for (let index = 0; index < 3; index += 1) {
      apply(s, { type: 'MATERIAL_WORK', batchId: batch.id });
      expect(batch.labourSteps).toBe(index + 1);
      expect(batch.materials.every(item => item.holder === 'SUPPLIER')).toBe(true);
      expect(projectClown(s).actions.find(action => action.id === `buy-${batch.id}`)!.cost).toContain(`${index === 2 ? 90 : 1290}便士`);
    }
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId: batch.id });
    expect(projectClown(s).actions.find(action => action.id === 'buy-clown-batch-2')!.cost).toContain('1290便士');
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    apply(s, { type: 'BREW', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([9650, 35]);
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId: batch.id });
    expect(validateClownState(s)).toBe(true);
  });

  it.each([1, 2])('does not discount or cash out %i partial labour tasks', count => {
    const s = taught(), batchId = s.clown.batches[0]!.id;
    for (let index = 0; index < count; index += 1) apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    expect(cash - s.cash).toBe(1290);
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId });
  });

  it('rejects missing funds, unavailable batches and mismatched ingredients before mutation', () => {
    const s = state();
    s.cash = 179;
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    s.cash = 10000;
    taught(s);
    const batchId = s.clown.batches[0]!.id;
    unchangedRejection(s, { type: 'BREW', batchId });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'clown-batch-4' });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'seer-batch-1' });
    s.cash = 1289;
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 1369;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    unchangedRejection(s, { type: 'BREW', batchId });
    s.cash = 80;
    s.clown.batches[0]!.materials[5]!.id = 'clown-batch-2:human-faced-rose';
    unchangedRejection(s, { type: 'BREW', batchId });
    expect(validateClownState(s)).toBe(false);
  });

  it('exhausts exactly three independent bottles with no refill or restored ingredients', () => {
    const s = taught();
    for (let index = 0; index < 3; index += 1) brew(s, index);
    expect(new Set(s.clown.bottles.flatMap(bottle => bottle.inputIds)).size).toBe(21);
    for (const bottle of s.clown.bottles) apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    expect(s.clown.bottles.every(bottle => bottle.status === 'CONSUMED')).toBe(true);
    expect(s.seer.pollution).toBe(75);
    s.week += 10;
    expect(projectClown(s).risk).toContain('供应方剩余0批');
    expect(projectClown(s).actions.map(a=>a.command.type)).toEqual(['REQUEST_SUPPLY']);expect(s.clown.batches).toHaveLength(3);
    expect(s.progression.sequence).toBe(9);
    expect(validateClownState(s)).toBe(true);
  });
});

describe('one-bottle advancement with inherited seer progress', () => {
  it('requires both digestion and six elapsed weeks, plus explicit bottle confirmation', () => {
    const s = prepared(), bottleId = s.clown.bottles[0]!.id;
    s.week = 10;
    expect(projectClown(s).actions.find(action => action.command.type === 'CONSUME')!.reason).toContain('5/6');
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
    s.week = 11;
    s.progression.acting = 99;
    expect(projectClown(s).actions.find(action => action.command.type === 'CONSUME')!.reason).toContain('99/100');
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
    s.progression.acting = 100;
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: false } as unknown as ClownAcquisitionCommand);
    unchangedRejection(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true });
    const ap = s.actionsRemaining;
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.actionsRemaining).toBe(ap);
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: true });
  });

  for (const [roll, tier, mentalCost, healthCost, pollution, success] of [
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const) it(`resolves ${tier} through will difficulty 12 with exact retained costs`, () => {
    const s = prepared(), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, ap = s.actionsRemaining;
    const oldSeer = JSON.stringify({ ...s.seer, pollution: 0 }), ctx = context(s, roll);
    s.spirituality = 7;
    applyClownCommand(s, { type: 'CONSUME', bottleId: s.clown.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]);
    expect(ctx.draws).toEqual([]);
    expect(s.clown.bottles[0]!).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap]);
    expect(s.status).toBe('ACTIVE');
    expect(s.progression.promotionWeek).toBe(5);
    expect(s.progression.sequence).toBe(success ? 8 : 9);
    expect(s.progression.acting).toBe(success ? 0 : 100);
    expect(s.clown.promotionWeek).toBe(success ? 11 : null);
    expect(s.clown.seerActingAtPromotion).toBe(success ? 100 : null);
    expect(JSON.stringify({ ...s.seer, pollution: 0 })).toBe(oldSeer);
    expect(s.progression.mastery).toMatchObject(mastery);
    expect(s.progression.mastery).toEqual(success ? { ...mastery, ...Object.fromEntries(CLOWN_ABILITY_IDS.map(id => [id, 0])) } : mastery);
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 6, perception: stats.perception + 4, will: stats.will + 2, knowledge: stats.knowledge + 1 } : stats);
    expect(validateClownState(s)).toBe(true);
  });

  it('retains severe negative resources without random death, free retry, or loss of S9 mastery', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    s.health = 1;
    s.mind = 1;
    apply(s, { type: 'CONSUME', bottleId: s.clown.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution]).toEqual([-19, -39, 50]);
    expect(s.status).toBe('ACTIVE');
    expect(s.progression.mastery).toEqual(mastery);
    expect(s.progression.acting).toBe(100);
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: s.clown.batches[1]!.id });
    expect(validateClownState(s)).toBe(true);
  });

  it('prevents multiple rewards even when extra original bottles remain prepared', () => {
    const s = prepared();
    brew(s, 1);
    apply(s, { type: 'CONSUME', bottleId: s.clown.bottles[0]!.id, confirmed: true });
    unchangedRejection(s, { type: 'CONSUME', bottleId: s.clown.bottles[1]!.id, confirmed: true });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: s.clown.batches[2]!.id });
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId: s.clown.batches[2]!.id });
    expect(s.clown.bottles[1]!.status).toBe('PREPARED');
    expect(projectClown(s).actions.every(action => action.command.type === 'BUY_PAPER')).toBe(true);
    expect(validateClownState(s)).toBe(true);
  });

  it('uses actual normal-check chances, caps attributes and never restores current spirit', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectClown(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 12, modifiers: [] }));
    }
    s.character.coreStats.physique = 498;
    s.character.coreStats.perception = 499;
    s.character.coreStats.knowledge = 500;
    s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: s.clown.bottles[0]!.id, confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
  });
});

describe('real paper supply and safe public projections', () => {
  it('buys ten actual sheets for ten pence without AP and stops after thirty', () => {
    const s = promoted(), cash = s.cash, ap = s.actionsRemaining;
    for (let index = 0; index < 3; index += 1) apply(s, { type: 'BUY_PAPER' });
    expect([s.cash, s.actionsRemaining, s.clown.paperStock, s.clown.paperSheets, s.clown.paperSpent]).toEqual([cash - 30, ap, 0, 30, 0]);
    unchangedRejection(s, { type: 'BUY_PAPER' });
    s.week += 10;
    expect(projectClown(s).actions.find(action => action.command.type === 'BUY_PAPER')!.enabled).toBe(false);
    expect(validateClownState(s)).toBe(true);
  });

  it('charges only for a final partial pack and accounts for already-spent paper', () => {
    const s = promoted();
    s.clown.paperStock = 7;
    s.clown.paperSheets = 13;
    s.clown.paperSpent = 10;
    s.cash = 6;
    unchangedRejection(s, { type: 'BUY_PAPER' });
    s.cash = 7;
    apply(s, { type: 'BUY_PAPER' });
    expect([s.cash, s.clown.paperStock, s.clown.paperSheets, s.clown.paperSpent]).toEqual([0, 0, 20, 10]);
    expect(validateClownState(s)).toBe(true);
  });

  it('cannot buy paper in combat, an event, another city, or an ended run', () => {
    const s = promoted();
    s.combat = { encounterId: 'CLOWN_RESCUE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
    unchangedRejection(s, { type: 'BUY_PAPER' });
    s.combat = null;
    s.activeEvent = { id: 'test', instanceId: 'test-1' };
    unchangedRejection(s, { type: 'BUY_PAPER' });
    s.activeEvent = null;
    s.world.city = 'ELSEWHERE';
    unchangedRejection(s, { type: 'BUY_PAPER' });
    s.world.city = 'BACKLUND';
    s.status = 'DEAD';
    unchangedRejection(s, { type: 'BUY_PAPER' });
  });

  it('shows the five S8 abilities without S7 powers and returns detached display data', () => {
    const s = promoted(), before = JSON.stringify(s), p = projectClown(s);
    expect(p.abilities.map(item => item.id)).toEqual([...CLOWN_ABILITY_IDS]);
    expect(CLOWN_ABILITIES).toHaveLength(5);
    expect(JSON.stringify(CLOWN_ABILITIES)).not.toMatch(/s7|快速施法|焰火|火焰/);
    expect(p.bottles[0]!.source).toContain(s.clown.bottles[0]!.id);
    expect(p.risk).toContain('意志难度12');
    expect(p.risk).toContain('灾难');
    expect(p.risk).toContain('不适用于战斗');
    p.formula[0]!.quantity = 999;
    p.abilities[0]!.mastery = 500;
    p.bottles[0]!.source = 'changed';
    p.actions[0]!.label = 'changed';
    expect(JSON.stringify(s)).toBe(before);
    expect(CLOWN_FORMULA[0].quantity).toBe(80);
  });
});

describe('clown save invariants', () => {
  it('accepts a JSON round trip while preserving both promotion weeks', () => {
    const s = promoted();
    apply(s, { type: 'BUY_PAPER' });
    const loaded = JSON.parse(JSON.stringify(s)) as SliceState;
    expect(validateClownState(loaded)).toBe(true);
    expect([loaded.progression.promotionWeek, loaded.clown.promotionWeek]).toEqual([5, 11]);
  });

  const mutations: [string, (s: SliceState) => void][] = [
    ['duplicate bottle', s => { s.clown.bottles.push({ ...s.clown.bottles[0]! }); }],
    ['restored consumed material', s => { s.clown.batches[0]!.materials[0]!.quantity = 80; }],
    ['transferred consumed material', s => { s.clown.batches[0]!.materials[0]!.holder = 'PLAYER'; }],
    ['mixed bottle provenance', s => { s.clown.bottles[0]!.inputIds[0] = 'seer-batch-1:pure-water'; }],
    ['prepared successful bottle', s => { s.clown.bottles[0]!.status = 'PREPARED'; }],
    ['early S8 promotion', s => { s.clown.promotionWeek = 10; }],
    ['forgotten S9 digestion', s => { s.clown.seerActingAtPromotion = 99; }],
    ['forgotten formula', s => { s.clown.formulaKnown = false; }],
    ['minted paper', s => { s.clown.paperSheets = 1; }],
    ['negative paper spend', s => { s.clown.paperSpent = -1; }],
    ['unknown paper mastery', s => { delete s.progression.mastery['diviner.s8.paper-dagger']; }],
    ['duplicate practices', s => { s.clown.practices = ['same', 'same']; }],
  ];
  it.each(mutations)('rejects %s', (_name, mutate) => {
    const s = promoted();
    mutate(s);
    expect(validateClownState(s)).toBe(false);
  });

  it('rejects S8 marks and paper in an unpromoted state', () => {
    for (const mutate of [
      (s: SliceState) => { s.clown.promotionWeek = 11; },
      (s: SliceState) => { s.clown.seerActingAtPromotion = 100; },
      (s: SliceState) => { s.clown.paperStock = 20; s.clown.paperSheets = 10; },
      (s: SliceState) => { s.progression.mastery['diviner.s8.body-control'] = 0; },
    ]) {
      const s = state();
      mutate(s);
      expect(validateClownState(s)).toBe(false);
    }
  });

  it('returns false rather than throwing for malformed nested save data', () => {
    const s = promoted();
    for (const clown of [null, {}, { ...s.clown, batches: [null, null, null] }, { ...s.clown, bottles: [null] }, { ...s.clown, rescue: null }, { ...s.clown, trainingAttempts: null }]) {
      expect(validateClownState({ ...s, clown } as unknown as SliceState)).toBe(false);
    }
  });
});
