import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { applySeerCommand, type SeerContext } from '../../src/domain/seer/index.js';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types.js';
import { applyClownCommand } from '../../src/domain/clown/index.js';
import { CLOWN_ABILITY_IDS } from '../../src/domain/clown/types.js';
import { applyMagicianCommand, createMagicianState, projectMagician, validateMagicianAcquisitionCommand, validateMagicianCommand, validateMagicianState } from '../../src/domain/magician/index.js';
import { MAGICIAN_ABILITIES, MAGICIAN_FORMULA, MAGICIAN_FORMULA_SOURCE } from '../../src/domain/magician/content.js';
import { MAGICIAN_ABILITY_IDS, type MagicianAcquisitionCommand } from '../../src/domain/magician/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('magician-acquisition', sliceDefaultCreationSelection, 'magician-fixed-seed');
  s.activeEvent = null;
  s.eventQueue = [];
  s.week = 5;
  s.cash = 10000;
  s.actionsRemaining = 40;
  s.weeklyBudget = 40;
  s.magician = createMagicianState();
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
function state(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applySeerCommand(s, { type: 'DISCOVER' }, c);
  applySeerCommand(s, { type: 'LEARN_FORMULA' }, c);
  applySeerCommand(s, { type: 'BUY_MATERIALS', batchId: s.seer.batches[0]!.id }, c);
  applySeerCommand(s, { type: 'BREW', batchId: s.seer.batches[0]!.id }, c);
  applySeerCommand(s, { type: 'CONSUME', bottleId: s.seer.bottles[0]!.id, confirmed: true }, c);
  s.week = 11;
  s.progression.acting = 100;
  applyClownCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyClownCommand(s, { type: 'BUY_MATERIALS', batchId: s.clown.batches[0]!.id }, c);
  applyClownCommand(s, { type: 'BREW', batchId: s.clown.batches[0]!.id }, c);
  applyClownCommand(s, { type: 'CONSUME', bottleId: s.clown.bottles[0]!.id, confirmed: true }, c);
  s.week = 19;
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...SEER_ABILITY_IDS, ...CLOWN_ABILITY_IDS].map((id, index) => [id, 10 * index]));
  s.cash = 10000;
  s.health = 100;
  s.mind = 100;
  s.actionsRemaining = 40;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: MagicianAcquisitionCommand, roll = 20) { applyMagicianCommand(s, command, context(s, roll).c); }
function taught(s = state()) { apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.magician.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId });
  apply(s, { type: 'BREW', batchId });
  return s.magician.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: s.magician.bottles[0]!.id, confirmed: true }); return s; }
function unchangedRejection(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as MagicianAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('six original magician ingredients and finite preparation', () => {
  it('hides the route from ordinary people and keeps default supplies independent', () => {
    const s = ordinary(), p = projectMagician(s);
    expect(validateMagicianState(s)).toBe(true);
    expect([p.discovered, p.formulaKnown, p.promoted]).toEqual([false, false, false]);
    expect([p.actions, p.formula, p.bottles, p.abilities, p.practices]).toEqual([[], [], [], [], []]);
    expect(JSON.stringify(p)).not.toMatch(/magician-batch|迷雾树人|邪纹黑豹|1800|仅有3批/);
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    const separate = createMagicianState();
    separate.batches[0]!.materials[0]!.quantity = 0;
    separate.practices.push('different');
    separate.lantern.oilStock = 0;
    expect(s.magician.batches[0]!.materials[0]!.quantity).toBe(60);
    expect(s.magician.practices).toEqual([]);
    expect(s.magician.lantern).toEqual({ oilStock: 6, oilHeld: 0, oilSpent: 0, prepared: false, deliveries: 0, lastSupplyWeek: null });
  });

  it('requires the diviner S8 route and its original guide', () => {
    for (const mutate of [
      (s: SliceState) => { s.progression.sequence = 9; },
      (s: SliceState) => { s.progression.pathwayId = 'audience'; },
      (s: SliceState) => { s.seer.discovered = false; },
      (s: SliceState) => { s.clown.formulaKnown = false; },
    ]) {
      const s = state(); mutate(s);
      expect(projectMagician(s).actions).toEqual([]);
      unchangedRejection(s, { type: 'LEARN_FORMULA' });
    }
  });

  it('charges one action and 240 pence for the verified six-ingredient formula', () => {
    const s = state(), oldSeer = JSON.stringify(s.seer), oldClown = JSON.stringify(s.clown), oldProgression = JSON.stringify(s.progression);
    expect(projectMagician(s).actions.map(a => a.command.type)).toEqual(['LEARN_FORMULA']);
    taught(s);
    expect([s.cash, s.actionsRemaining]).toEqual([9760, 39]);
    expect([JSON.stringify(s.seer), JSON.stringify(s.clown), JSON.stringify(s.progression)]).toEqual([oldSeer, oldClown, oldProgression]);
    expect(projectMagician(s).formula.map(m => `${m.name}:${m.quantity}${m.unit}`)).toEqual([
      '纯水:60mL', '迷雾树人汁液:30mL', '水形宝石粉末:3g', '迷幻草精油:4滴', '邪纹黑豹全部脊髓液:1份', '迷雾树人真实根茎:1块',
    ]);
    expect(MAGICIAN_FORMULA_SOURCE).toContain('第38章《收获》');
    expect(MAGICIAN_FORMULA_SOURCE).toContain('第82章《材料齐》');
    expect(MAGICIAN_FORMULA_SOURCE).toContain('原创游戏规则（G）');
    expect(validateMagicianState(s)).toBe(true);
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
  });

  it('allows early preparation but waits eight weeks from the actual clown promotion', () => {
    const s = state(); s.week = 11; s.progression.acting = 0;
    taught(s); const bottle = brew(s);
    expect(validateMagicianState(s)).toBe(true);
    unchangedRejection(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.progression.acting = 100; s.week = 18;
    expect(projectMagician(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('7/8');
    unchangedRejection(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 19; s.progression.acting = 99;
    expect(projectMagician(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('99/100');
    unchangedRejection(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.progression.acting = 100; const ap = s.actionsRemaining;
    apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(s.actionsRemaining).toBe(ap);
    expect([s.progression.promotionWeek, s.clown.promotionWeek, s.magician.promotionWeek]).toEqual([5, 11, 19]);
  });

  it('purchases one batch for 1950 and uses all six originals for its separate 60-pence bottle', () => {
    const s = taught(), batch = s.magician.batches[0]!, ap = s.actionsRemaining;
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([7810, ap]);
    expect(batch.materials.every(m => m.holder === 'PLAYER')).toBe(true);
    const ctx = context(s);
    applyMagicianCommand(s, { type: 'BREW', batchId: batch.id }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([7750, ap - 1]);
    expect(batch.materials.every(m => m.holder === 'CONSUMED' && m.quantity === 0)).toBe(true);
    expect(s.magician.bottles[0]!.inputIds).toEqual(MAGICIAN_FORMULA.map(m => `${batch.id}:${m.id}`));
    expect(ctx.notes[0]!.text).toContain('先放入四项辅材，再加入邪纹黑豹全部脊髓液，最后投入迷雾树人真实根茎');
    expect(s.magician.bottles[0]!.status).toBe('PREPARED');
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    unchangedRejection(s, { type: 'BREW', batchId: batch.id });
    expect(validateMagicianState(s)).toBe(true);
  });

  it('requires four separate actual work actions for this batch’s 1800-pence credit', () => {
    const s = taught(), batch = s.magician.batches[0]!;
    for (let index = 0; index < 4; index += 1) {
      apply(s, { type: 'MATERIAL_WORK', batchId: batch.id });
      expect(batch.labourSteps).toBe(index + 1);
      expect(batch.materials.every(m => m.holder === 'SUPPLIER')).toBe(true);
      expect(projectMagician(s).actions.find(a => a.id === `buy-${batch.id}`)!.cost).toContain(`${index === 3 ? 150 : 1950}便士`);
    }
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId: batch.id });
    expect(projectMagician(s).actions.find(a => a.id === 'buy-magician-batch-2')!.cost).toContain('1950便士');
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    apply(s, { type: 'BREW', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([9550, 34]);
    unchangedRejection(s, { type: 'MATERIAL_WORK', batchId: batch.id });
    expect(validateMagicianState(s)).toBe(true);
  });

  it.each([1, 2, 3])('does not discount %i partial work actions', count => {
    const s = taught(), batchId = s.magician.batches[0]!.id;
    for (let i = 0; i < count; i += 1) apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash;
    apply(s, { type: 'BUY_MATERIALS', batchId });
    expect(cash - s.cash).toBe(1950);
  });

  it('rejects insufficient funds, foreign batches, mismatched source and cross-batch materials before mutation', () => {
    const s = state(); s.cash = 239;
    unchangedRejection(s, { type: 'LEARN_FORMULA' });
    s.cash = 10000; taught(s); const batchId = s.magician.batches[0]!.id;
    unchangedRejection(s, { type: 'BREW', batchId });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'magician-batch-4' });
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: 'clown-batch-1' });
    s.cash = 1949; unchangedRejection(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 2009; apply(s, { type: 'BUY_MATERIALS', batchId });
    unchangedRejection(s, { type: 'BREW', batchId });
    s.cash = 60;
    const material = s.magician.batches[0]!.materials[5]!, source = material.source;
    material.source = 'unknown'; unchangedRejection(s, { type: 'BREW', batchId });
    material.source = source; material.id = 'magician-batch-2:mist-treant-true-root';
    unchangedRejection(s, { type: 'BREW', batchId });
    expect(validateMagicianState(s)).toBe(false);
  });
});

describe('confirmed S7 promotion and recovery', () => {
  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s at will difficulty 18 without erasing inherited history', (roll, tier, mentalCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, ap = s.actionsRemaining;
    const oldSeer = JSON.stringify({ ...s.seer, pollution: 0 }), oldClown = JSON.stringify(s.clown), ctx = context(s, roll);
    s.spirituality = 7;
    applyMagicianCommand(s, { type: 'CONSUME', bottleId: s.magician.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
    expect(s.magician.bottles[0]!).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.health, s.mind, s.seer.pollution, s.spirituality, s.actionsRemaining]).toEqual([100 - healthCost, 100 - mentalCost, pollution, 7, ap]);
    expect(s.status).toBe('ACTIVE');
    expect([s.progression.sequence, s.progression.acting, s.magician.promotionWeek, s.magician.clownActingAtPromotion]).toEqual(success ? [7, 0, 19, 100] : [8, 100, null, null]);
    expect([s.progression.promotionWeek, s.clown.promotionWeek]).toEqual([5, 11]);
    expect([JSON.stringify({ ...s.seer, pollution: 0 }), JSON.stringify(s.clown)]).toEqual([oldSeer, oldClown]);
    expect(s.progression.mastery).toEqual(success ? { ...mastery, ...Object.fromEntries(MAGICIAN_ABILITY_IDS.map(id => [id, 0])) } : mastery);
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 1, perception: stats.perception + 2, will: stats.will + 3, knowledge: stats.knowledge + 2 } : stats);
    expect(validateMagicianState(s)).toBe(true);
  });

  it('retains severe negative resources and original consumption without instant death', () => {
    const s = prepared(), mastery = { ...s.progression.mastery };
    s.health = 1; s.mind = 1;
    apply(s, { type: 'CONSUME', bottleId: s.magician.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-19, -39, 50, 'ACTIVE']);
    expect(s.progression.mastery).toEqual(mastery);
    unchangedRejection(s, { type: 'BUY_MATERIALS', batchId: s.magician.batches[1]!.id });
    expect(validateMagicianState(s)).toBe(true);
  });

  it('requires the selected unspent original and explicit confirmation, never repeating the stat grant', () => {
    const s = prepared(); brew(s, 1); const bottleId = s.magician.bottles[0]!.id;
    unchangedRejection(s, { type: 'CONSUME', bottleId, confirmed: false });
    unchangedRejection(s, { type: 'CONSUME', bottleId: s.clown.bottles[0]!.id, confirmed: true });
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    for (const command of [
      { type: 'CONSUME', bottleId, confirmed: true },
      { type: 'CONSUME', bottleId: s.magician.bottles[1]!.id, confirmed: true },
      { type: 'BUY_MATERIALS', batchId: s.magician.batches[2]!.id },
      { type: 'MATERIAL_WORK', batchId: s.magician.batches[2]!.id },
    ]) unchangedRejection(s, command);
    expect(s.magician.bottles[1]!.status).toBe('PREPARED');
    expect(projectMagician(s).actions).toEqual([]);
    expect(validateMagicianState(s)).toBe(true);
  });

  it('uses the actual normal-check probability and caps stats without refilling spirituality', () => {
    const s = prepared();
    for (const will of [0, 15, 500]) {
      s.character.coreStats.will = will;
      expect(projectMagician(s).bottles[0]!.chance).toBe(computeCheckChance({ baseAbility: will, difficulty: 18, modifiers: [] }));
    }
    s.character.coreStats.physique = 499; s.character.coreStats.perception = 499; s.character.coreStats.knowledge = 500; s.spirituality = 0;
    apply(s, { type: 'CONSUME', bottleId: s.magician.bottles[0]!.id, confirmed: true }, 1);
    expect(s.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(s.spirituality).toBe(0);
  });

  it('retains all three failures then requires a real next week and new full-price or worked-for originals', () => {
    const s = taught(); unchangedRejection(s, { type: 'REQUEST_SUPPLY' }); unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    for (let i = 0; i < 3; i += 1) {
      const bottle = brew(s, i);
      unchangedRejection(s, { type: 'REQUEST_SUPPLY' });
      apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true }, 80);
    }
    expect(new Set(s.magician.bottles.flatMap(b => b.inputIds)).size).toBe(18);
    expect(s.seer.pollution).toBe(75);
    expect(projectMagician(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const oldBatches = JSON.stringify(s.magician.batches), oldBottles = JSON.stringify(s.magician.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.cash, s.actionsRemaining, s.magician.resupply.requestedWeek]).toEqual([cash, ap - 1, 19]);
    unchangedRejection(s, { type: 'REQUEST_SUPPLY' }); unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateMagicianState(s)).toBe(true);
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.magician.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.magician.batches).toHaveLength(6);
    expect([JSON.stringify(s.magician.batches.slice(0, 3)), JSON.stringify(s.magician.bottles)]).toEqual([oldBatches, oldBottles]);
    expect(s.magician.batches.slice(3).every(b => !b.acquired && !b.brewed && b.labourSteps === 0 && b.materials.every(m => m.holder === 'SUPPLIER'))).toBe(true);
    unchangedRejection(s, { type: 'RECEIVE_SUPPLY' });
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'MATERIAL_WORK', batchId: 'magician-batch-4' });
    apply(s, { type: 'BUY_MATERIALS', batchId: 'magician-batch-4' }); apply(s, { type: 'BREW', batchId: 'magician-batch-4' });
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 210, ap - 6]);
    apply(s, { type: 'CONSUME', bottleId: 'magician-batch-4:bottle', confirmed: true }, 1);
    expect(s.progression.sequence).toBe(7); expect(validateMagicianState(s)).toBe(true);
    s.magician.batches[0]!.materials[0]!.source = 'rewritten old source';
    expect(validateMagicianState(s)).toBe(false);
  });
});

describe('public route and command boundaries', () => {
  it('blocks preparation during events, combat, death, travel or incapacity', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.status = 'DEAD'; }, s => { s.activeEvent = { id: 'test', instanceId: 'test-1' }; },
      s => { s.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null }; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.actionsRemaining = 0; },
    ];
    for (const mutate of mutations) { const s = state(); mutate(s); unchangedRejection(s, { type: 'LEARN_FORMULA' }); }
  });

  it('shows all nine bounded abilities, source-linked bottles and detached projection data', () => {
    const s = promoted(), before = JSON.stringify(s), p = projectMagician(s);
    expect(p.abilities.map(a => a.id)).toEqual([...MAGICIAN_ABILITY_IDS]);
    expect(MAGICIAN_ABILITIES).toHaveLength(9);
    const description = (id: string) => p.abilities.find(a => a.id === `diviner.s7.${id}`)!.description;
    expect(description('damage-transfer')).toContain('此人自己的身体内部转移一次');
    expect(description('damage-transfer')).toContain('不能转给另一个人');
    expect(description('flame-jump')).toContain('30米');
    expect(description('flame-jump')).toContain('真实存在的火焰');
    expect(description('flame-control')).toContain('完全消化之前不能凭空制造新的火焰流');
    expect(description('air-bullet')).toContain('接近左轮手枪');
    expect(description('paper-figurine')).toContain('事先用真实纸张剪好');
    expect(description('paper-figurine')).toContain('消耗纸人与灵性');
    expect(description('underwater-breathing')).toContain('水面下约5米');
    expect(description('illusion')).toContain('颜色、声音和气味');
    expect(description('illusion')).toContain('不直接控制心智');
    expect(description('bone-softening')).toContain('不是力场');
    expect(description('paper-weapon')).toContain('纸张暂时变成武器');
    expect(p.bottles[0]!.source).toContain(s.magician.bottles[0]!.id);
    expect(p.risk).toContain('意志难度18'); expect(p.risk).toContain('不适用于战斗');
    p.formula[0]!.quantity = 999; p.abilities[0]!.mastery = 500; p.bottles[0]!.source = 'changed';
    p.practices.push({ id: 'fake', title: 'fake', story: '', status: '' }); p.supplies.oilHeld = 99;
    expect(JSON.stringify(s)).toBe(before); expect(MAGICIAN_FORMULA[0]!.quantity).toBe(60);
  });

  it.each([
    null, {}, { type: 'DISCOVER' }, { type: 'BUY_PAPER' }, { type: 'LEARN_FORMULA', extra: true },
    { type: 'BUY_MATERIALS', batchId: 'clown-batch-1' }, { type: 'BUY_MATERIALS', batchId: 'magician-batch-01' },
    { type: 'CONSUME', bottleId: 'magician-batch-1:bottle', confirmed: false },
    { type: 'CONSUME', bottleId: 'magician-batch-1:bottle', confirmed: true, extra: 1 },
    { type: 'PRACTICE', practiceId: '' }, { type: 'TRANSFER_INJURY', injuryId: 'x'.repeat(201) },
    { type: 'REFLECT', confirmed: true },
  ])('rejects malformed command %j before mutation', command => {
    expect(validateMagicianCommand(command)).toBe(false); unchangedRejection(taught(), command);
  });

  it.each([
    { type: 'LEARN_FORMULA' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
    { type: 'MATERIAL_WORK', batchId: 'magician-batch-1' }, { type: 'BUY_MATERIALS', batchId: 'magician-batch-1' },
    { type: 'BREW', batchId: 'magician-batch-1' }, { type: 'CONSUME', bottleId: 'magician-batch-1:bottle', confirmed: true },
  ])('recognizes exact acquisition command %j', command => {
    expect(validateMagicianAcquisitionCommand(command)).toBe(true); expect(validateMagicianCommand(command)).toBe(true);
  });

  it.each([
    { type: 'BUY_OIL' }, { type: 'PREPARE_LANTERN' }, { type: 'PREPARE_FIGURINE' },
    { type: 'PRACTICE', practiceId: 'bounded-practice' }, { type: 'TRANSFER_INJURY', injuryId: 'real-injury' },
    { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'REFLECT' },
  ])('recognizes activity command %j but does not execute it in acquisition', command => {
    expect(validateMagicianCommand(command)).toBe(true); expect(validateMagicianAcquisitionCommand(command)).toBe(false);
    unchangedRejection(promoted(), command);
  });
});

describe('magician original-batch and inherited-state invariants', () => {
  it('accepts a JSON round trip preserving all three promotion weeks', () => {
    const loaded = JSON.parse(JSON.stringify(promoted())) as SliceState;
    expect(validateMagicianState(loaded)).toBe(true);
    expect([loaded.progression.promotionWeek, loaded.clown.promotionWeek, loaded.magician.promotionWeek]).toEqual([5, 11, 19]);
  });

  const mutations: [string, (s: SliceState) => void][] = [
    ['duplicate bottle', s => { s.magician.bottles.push({ ...s.magician.bottles[0]! }); }],
    ['restored consumed material', s => { s.magician.batches[0]!.materials[0]!.quantity = 60; }],
    ['transferred consumed material', s => { s.magician.batches[0]!.materials[0]!.holder = 'PLAYER'; }],
    ['invented material source', s => { s.magician.batches[0]!.materials[0]!.source = 'unknown'; }],
    ['invented root mass', s => { s.magician.batches[0]!.materials[5]!.unit = 'g'; }],
    ['invented panther volume', s => { s.magician.batches[0]!.materials[4]!.unit = 'mL'; }],
    ['mixed bottle inputs', s => { s.magician.bottles[0]!.inputIds[0] = 'clown-batch-1:pure-water'; }],
    ['reversed mixing order', s => { s.magician.bottles[0]!.inputIds.reverse(); }],
    ['prepared success', s => { s.magician.bottles[0]!.status = 'PREPARED'; }],
    ['early promotion', s => { s.magician.promotionWeek = 18; }],
    ['forgotten S8 digestion', s => { s.magician.clownActingAtPromotion = 99; }],
    ['forgotten formula', s => { s.magician.formulaKnown = false; }],
    ['absent new mastery', s => { delete s.progression.mastery['diviner.s7.air-bullet']; }],
    ['unknown higher mastery', s => { s.progression.mastery['diviner.s6.face-change'] = 0; }],
    ['missing S9 mastery', s => { delete s.progression.mastery['diviner.s9.divination']; }],
    ['missing S8 mastery', s => { delete s.progression.mastery['diviner.s8.balance']; }],
    ['duplicate practice', s => { s.magician.practices = ['same', 'same']; }],
    ['practice before promotion', s => { s.magician.practiceAttempts['some-practice'] = 18; }],
    ['duplicate wound transfer', s => { s.magician.damageTransfers = ['injury-1', 'injury-1']; }],
    ['minted figurine', s => { s.magician.figurinesHeld = 1; }],
    ['figurine without real paper', s => { s.magician.figurinesMade = 1; s.magician.figurinesHeld = 1; }],
    ['minted oil', s => { s.magician.lantern.oilHeld = 1; }],
    ['fire without spent oil', s => { s.magician.lantern.prepared = true; }],
    ['unrequested resupply', s => { s.magician.resupply.deliveries = 1; }],
  ];
  it.each(mutations)('rejects %s', (_name, mutate) => { const s = promoted(); mutate(s); expect(validateMagicianState(s)).toBe(false); });

  it('accepts actually conserved prepared props without demanding unspent lantern oil', () => {
    const s = promoted();
    s.clown.paperStock = 29; s.clown.paperSpent = 1;
    s.magician.figurinesMade = 1; s.magician.figurinesHeld = 1;
    s.magician.lantern = { oilStock: 5, oilHeld: 0, oilSpent: 1, prepared: true, deliveries: 0, lastSupplyWeek: 19 };
    expect(validateMagicianState(s)).toBe(true);
    s.magician.figurinesHeld = 0; s.magician.figurinesUsed = 1; s.magician.lantern.prepared = false;
    expect(validateMagicianState(s)).toBe(true);
  });

  it('conserves later oil deliveries with actual purchase weeks and no reset of spent oil', () => {
    const s = promoted(); s.week = 20;
    s.magician.lantern = { oilStock: 5, oilHeld: 6, oilSpent: 1, prepared: true, deliveries: 1, lastSupplyWeek: 20 };
    expect(validateMagicianState(s)).toBe(true);
    s.magician.lantern.lastSupplyWeek = 19;
    expect(validateMagicianState(s)).toBe(false);
    s.magician.lantern.lastSupplyWeek = 20; s.magician.lantern.oilSpent = 0;
    expect(validateMagicianState(s)).toBe(false);
  });

  it('rejects S7 markers or activity before real promotion', () => {
    for (const mutate of [
      (s: SliceState) => { s.magician.promotionWeek = 19; },
      (s: SliceState) => { s.magician.clownActingAtPromotion = 100; },
      (s: SliceState) => { s.progression.mastery['diviner.s7.air-bullet'] = 0; },
      (s: SliceState) => { s.magician.practices = ['attempt']; },
      (s: SliceState) => { s.magician.reflected = true; },
      (s: SliceState) => { s.magician.encounter.status = 'RESOLVED'; },
      (s: SliceState) => { s.magician.lantern = { oilStock: 5, oilHeld: 1, oilSpent: 0, prepared: false, deliveries: 0, lastSupplyWeek: 19 }; },
    ]) { const s = state(); mutate(s); expect(validateMagicianState(s)).toBe(false); }
  });

  it('returns false for malformed nested data rather than dereferencing it', () => {
    const s = promoted();
    for (const magician of [
      null, {}, { ...s.magician, batches: [null, null, null] }, { ...s.magician, bottles: [null] },
      { ...s.magician, batches: [{ ...s.magician.batches[0]!, materials: [null, null, null, null, null, null] }, ...s.magician.batches.slice(1)] },
      { ...s.magician, resupply: null }, { ...s.magician, lantern: null }, { ...s.magician, practiceAttempts: null },
      { ...s.magician, encounter: null }, { ...s.magician, practices: null }, { ...s.magician, damageTransfers: null },
    ]) expect(validateMagicianState({ ...s, magician } as unknown as SliceState)).toBe(false);
  });
});
