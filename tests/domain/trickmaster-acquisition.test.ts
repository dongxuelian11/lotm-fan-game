import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyApprenticeCommand } from '../../src/domain/apprentice/index.js';
import { APPRENTICE_ABILITY_IDS } from '../../src/domain/apprentice/types.js';
import {
  applyTrickmasterCommand, createTrickmasterState, isTrickmasterAcquisitionCommand, projectTrickmaster,
  validateTrickmasterAcquisitionCommand, validateTrickmasterCommand, validateTrickmasterState,
} from '../../src/domain/trickmaster/index.js';
import { TRICKMASTER_ABILITIES, TRICKMASTER_FORMULA, TRICKMASTER_FORMULA_SOURCE, TRICKMASTER_GUIDE, TRICKMASTER_SOURCE_STATUS } from '../../src/domain/trickmaster/content.js';
import { TRICKMASTER_ABILITY_IDS, TRICKMASTER_CASE_IDS, type TrickmasterAcquisitionCommand } from '../../src/domain/trickmaster/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('trickmaster-acquisition', sliceDefaultCreationSelection, 'trickmaster-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.trickmaster = createTrickmasterState();
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
      s.lastCheck = result; return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, notes };
}
function apprentice(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyApprenticeCommand(s, { type: 'DISCOVER' }, c);
  applyApprenticeCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyApprenticeCommand(s, { type: 'BUY_POTION', bottleId: s.apprentice.bottles[0]!.id }, c);
  applyApprenticeCommand(s, { type: 'CONSUME', bottleId: s.apprentice.bottles[0]!.id, confirmed: true }, c);
  s.week = 9; s.progression.acting = 100; s.progression.mastery[APPRENTICE_ABILITY_IDS[0]] = 37;
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: TrickmasterAcquisitionCommand, roll = 20) { applyTrickmasterCommand(s, command, context(s, roll).c); }
function taught(s = apprentice()) { apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.trickmaster.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
  return s.trickmaster.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: s.trickmaster.bottles[0]!.id, confirmed: true }); return s; }
function exhausted() { const s = taught(); for (let i = 0; i < 3; i += 1) apply(s, { type: 'CONSUME', bottleId: brew(s, i).id, confirmed: true }, 80); return s; }
const clone = (s: SliceState): SliceState => JSON.parse(JSON.stringify(s)) as SliceState;
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as TrickmasterAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Trickmaster six-material formula and physical acquisition', () => {
  it('initializes independent hidden stocks and inactive scenes', () => {
    const s = ordinary(), p = projectTrickmaster(s);
    expect(validateTrickmasterState(s)).toBe(true);
    expect([p.discovered, p.formulaKnown, p.promoted]).toEqual([false, false, false]);
    expect([p.formula, p.actions, p.bottles, p.abilities, p.cases]).toEqual([[], [], [], [], []]);
    expect(p.supplies).toBe(''); expect(p.story).toBeUndefined();
    expect(JSON.stringify(p)).not.toMatch(/trickmaster-batch|食灵者|深海枪鱼|1150/);
    rejected(s, { type: 'LEARN_FORMULA' });
    const other = createTrickmasterState();
    other.batches[0]!.materials[0]!.quantity = 0; other.cupSurface = 'THIN_ICE'; other.signalUsed = true;
    other.cases['warm-cup']!.status = 'OBSERVED';
    expect(s.trickmaster.batches[0]!.materials[0]!.quantity).toBe(1);
    expect(s.trickmaster).toMatchObject({ cupSurface: 'WARM', signalUsed: false, walkwayCleared: false, reflected: false });
    expect(s.trickmaster.cases['warm-cup']!.status).toBe('AVAILABLE');
  });

  it.each([
    ['wrong sequence', (s: SliceState) => { s.progression.sequence = 7; }],
    ['wrong pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['unknown mentor', (s: SliceState) => { s.apprentice.discovered = false; }],
    ['missing prior guidance', (s: SliceState) => { s.apprentice.guidanceKnown = false; }],
  ])('requires the original S9 channel: %s', (_label, mutate) => {
    const s = apprentice(); mutate(s); expect(projectTrickmaster(s).actions).toEqual([]); rejected(s, { type: 'LEARN_FORMULA' });
  });

  it('charges 180 and one action, preserving the unquantified original stomach and G mixing order', () => {
    const s = apprentice(), inherited = JSON.stringify([s.apprentice, s.progression]); taught(s);
    expect([s.cash, s.actionsRemaining]).toEqual([9820, 39]);
    expect(JSON.stringify([s.apprentice, s.progression])).toBe(inherited);
    const formula = projectTrickmaster(s).formula;
    expect(formula[0]).toEqual({ name: '食灵者的胃袋', quantity: null, unit: '', note: '原著未给明确数量或重量；本作G每批供货1份。' });
    expect(formula.slice(1).map(m => `${m.name}:${m.quantity}${m.unit}`)).toEqual([
      '深海枪鱼血液:20mL', '鹅耳枥制作的精油:5mL', '线球草粉末:10g', '盛开的红栗花:1朵', '纯水:80mL',
    ]);
    expect(TRICKMASTER_FORMULA_SOURCE).toContain('第二部第131章《一掷千金》');
    expect(TRICKMASTER_FORMULA_SOURCE).toContain('确切投料顺序未核定');
    expect(TRICKMASTER_FORMULA_SOURCE).toContain('本作玩法改编G');
    expect(TRICKMASTER_GUIDE).toBe('独立档案锁匠诺拉·维恩');
    expect(validateTrickmasterState(s)).toBe(true); rejected(s, { type: 'LEARN_FORMULA' });
  });

  it('transfers a 1150-pence batch, then consumes exactly six originals for one 60-pence bottle', () => {
    const s = taught(), batch = s.trickmaster.batches[0]!, actions = s.actionsRemaining;
    expect(batch.materials.map(m => m.quantity)).toEqual([1, 20, 5, 10, 1, 80]);
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([8670, actions]);
    expect(batch.materials.every(m => m.holder === 'PLAYER')).toBe(true);
    const ctx = context(s); applyTrickmasterCommand(s, { type: 'BREW', batchId: batch.id }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, actions - 1]);
    expect(batch.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.trickmaster.bottles[0]).toMatchObject({ id: 'trickmaster-batch-1:bottle', batchId: batch.id, brewedWeek: 9, status: 'PREPARED', outcome: null });
    expect(s.trickmaster.bottles[0]!.inputIds).toEqual(TRICKMASTER_FORMULA.map(m => `${batch.id}:${m.id}`));
    expect(ctx.notes[0]!.text).toContain('具体操作次序采用本作G导师规程');
    expect(ctx.notes[0]!.text).toContain('胃袋的1份是本作G供货计量');
    rejected(s, { type: 'BREW', batchId: batch.id }); rejected(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect(validateTrickmasterState(s)).toBe(true);
  });

  it('requires three real labour actions for the batch-specific 1050 credit, still charging 100 plus 60', () => {
    const s = taught(), batchId = s.trickmaster.batches[0]!.id;
    for (let i = 1; i <= 3; i += 1) {
      apply(s, { type: 'MATERIAL_WORK', batchId });
      expect(s.trickmaster.batches[0]!.materials.every(m => m.holder === 'SUPPLIER')).toBe(true);
      expect(projectTrickmaster(s).actions.find(a => a.id === `buy-${batchId}`)!.cost).toContain(`${i === 3 ? 100 : 1150}便士`);
    }
    rejected(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectTrickmaster(s).actions.find(a => a.id === 'buy-trickmaster-batch-2')!.cost).toContain('1150便士');
    apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([9660, 35]);
    rejected(s, { type: 'MATERIAL_WORK', batchId }); expect(validateTrickmasterState(s)).toBe(true);
  });

  it.each([1, 2])('does not partially discount %i labour steps', steps => {
    const s = taught(), batchId = s.trickmaster.batches[0]!.id;
    for (let i = 0; i < steps; i += 1) apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash; apply(s, { type: 'BUY_MATERIALS', batchId }); expect(cash - s.cash).toBe(1150);
  });

  it('rejects insufficient money, missing stock, changed quantities, forged origin and mixed batches atomically', () => {
    const s = apprentice(); s.cash = 179; rejected(s, { type: 'LEARN_FORMULA' });
    s.cash = 10000; taught(s); const batchId = s.trickmaster.batches[0]!.id;
    rejected(s, { type: 'BREW', batchId }); rejected(s, { type: 'BUY_MATERIALS', batchId: 'trickmaster-batch-4' });
    s.cash = 1149; rejected(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 1209; apply(s, { type: 'BUY_MATERIALS', batchId }); rejected(s, { type: 'BREW', batchId });
    s.cash = 60; const material = s.trickmaster.batches[0]!.materials[0]!, source = material.source;
    material.source = 'invented'; rejected(s, { type: 'BREW', batchId });
    material.source = source; material.quantity = 2; rejected(s, { type: 'BREW', batchId });
    material.quantity = 1; material.id = 'trickmaster-batch-2:spirit-eater-stomach'; rejected(s, { type: 'BREW', batchId });
    expect(validateTrickmasterState(s)).toBe(false);
  });
});

describe('Trickmaster promotion and recoverable outcomes', () => {
  it('allows early preparation but requires 100 digestion and four complete weeks after S9', () => {
    const s = apprentice(); s.week = 5; s.progression.acting = 0;
    taught(s); const bottle = brew(s); expect(validateTrickmasterState(s)).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 8; s.progression.acting = 100;
    expect(projectTrickmaster(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('3/4');
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 9; s.progression.acting = 99; rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.progression.acting = 100; s.actionsRemaining = 0; apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect([s.progression.promotionWeek, s.trickmaster.promotionWeek, s.actionsRemaining]).toEqual([5, 9, 0]);
  });

  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s with one will12 check and no instant-death draw', (roll, tier, mindCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, ctx = context(s, roll);
    const inherited = JSON.stringify(s.apprentice), actions = s.actionsRemaining, cash = s.cash;
    s.spirituality = 7; const chance = projectTrickmaster(s).bottles[0]!.chance;
    applyTrickmasterCommand(s, { type: 'CONSUME', bottleId: s.trickmaster.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance });
    expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash, s.status]).toEqual([100 - mindCost, 100 - healthCost, pollution, 7, actions, cash, 'ACTIVE']);
    expect(s.trickmaster.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.progression.sequence, s.progression.acting, s.trickmaster.promotionWeek, s.trickmaster.apprenticeActingAtPromotion]).toEqual(success ? [8, 0, 9, 100] : [9, 100, null, null]);
    expect(JSON.stringify(s.apprentice)).toBe(inherited);
    expect(s.progression.mastery).toEqual(success ? { ...mastery, 'door.s8.tricks': 0 } : mastery);
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 1, perception: stats.perception + 2, will: stats.will + 2, knowledge: stats.knowledge + 1 } : stats);
    expect(s.trickmaster).toMatchObject({ cupSurface: 'WARM', signalUsed: false, walkwayCleared: false });
    expect(validateTrickmasterState(s)).toBe(true); rejected(s, { type: 'CONSUME', bottleId: s.trickmaster.bottles[0]!.id, confirmed: true });
  });

  it('caps stats and pollution, preserves depleted health and spirituality, and prevents repeated stat grants', () => {
    const s = prepared(); s.health = 1; s.mind = 1; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: s.trickmaster.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-19, -39, 100, 'ACTIVE']);
    rejected(s, { type: 'BUY_MATERIALS', batchId: s.trickmaster.batches[1]!.id }); expect(validateTrickmasterState(s)).toBe(true);
    const good = prepared(); brew(good, 1);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) good.character.coreStats[stat] = 499;
    good.spirituality = 0; apply(good, { type: 'CONSUME', bottleId: good.trickmaster.bottles[0]!.id, confirmed: true }, 1);
    expect(Object.values(good.character.coreStats)).toEqual([500, 500, 500, 500]); expect(good.spirituality).toBe(0);
    rejected(good, { type: 'CONSUME', bottleId: good.trickmaster.bottles[1]!.id, confirmed: true });
    rejected(good, { type: 'BUY_MATERIALS', batchId: good.trickmaster.batches[2]!.id });
    expect(good.trickmaster.bottles[1]!.status).toBe('PREPARED'); expect(projectTrickmaster(good).actions).toEqual([]);
    expect(validateTrickmasterState(good)).toBe(true);
  });

  it.each([
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects blocked consumption when %s', (_label, mutate) => {
    const s = prepared(); mutate(s); rejected(s, { type: 'CONSUME', bottleId: s.trickmaster.bottles[0]!.id, confirmed: true });
  });
});

describe('Trickmaster replenishment, validation and public boundaries', () => {
  it('keeps all failed originals and requires one action plus a real next week for three new full-cost batches', () => {
    const s = exhausted(), batches = JSON.stringify(s.trickmaster.batches), bottles = JSON.stringify(s.trickmaster.bottles);
    expect(new Set(s.trickmaster.bottles.flatMap(b => b.inputIds)).size).toBe(18);
    expect(projectTrickmaster(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const cash = s.cash, actions = s.actionsRemaining; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.cash, s.actionsRemaining, s.trickmaster.resupply.requestedWeek]).toEqual([cash, actions - 1, 9]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' }); expect(validateTrickmasterState(s)).toBe(true);
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.trickmaster.resupply).toEqual({ requestedWeek: null, deliveries: 1 }); expect(s.trickmaster.batches).toHaveLength(6);
    expect(JSON.stringify(s.trickmaster.batches.slice(0, 3))).toBe(batches); expect(JSON.stringify(s.trickmaster.bottles)).toBe(bottles);
    expect(s.trickmaster.batches[3]).toMatchObject({ id: 'trickmaster-batch-4', labourSteps: 0, acquired: false, brewed: false });
    expect(projectTrickmaster(s).actions.find(a => a.id === 'buy-trickmaster-batch-4')!.cost).toContain('1150便士');
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' }); expect(validateTrickmasterState(clone(s))).toBe(true);
    s.mind = 100; const bottle = brew(s, 3); apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(s.trickmaster.promotionWeek).toBe(10); expect(validateTrickmasterState(s)).toBe(true);
  });

  it('does not replenish automatically or while any original remains or after promotion', () => {
    for (const s of [ordinary(), apprentice(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 20; expect(s.trickmaster.batches).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('rejects forged lineage, promotion chronology, mastery and malformed records', () => {
    const s = promoted(); expect(validateTrickmasterState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.trickmaster.batches[0]!.id = 'trickmaster-batch-2'; },
      x => { x.trickmaster.batches[0]!.labourSteps = 4; },
      x => { x.trickmaster.batches[0]!.acquired = false; },
      x => { x.trickmaster.batches[0]!.materials[0]!.quantity = 1; },
      x => { x.trickmaster.batches[0]!.materials[0]!.source = 'invented'; },
      x => { x.trickmaster.bottles[0]!.inputIds[0] = 'trickmaster-batch-2:spirit-eater-stomach'; },
      x => { x.trickmaster.bottles[0]!.brewedWeek = 10; },
      x => { x.trickmaster.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.trickmaster.bottles.push({ ...x.trickmaster.bottles[0]! }); },
      x => { x.trickmaster.promotionWeek = 8; },
      x => { x.trickmaster.apprenticeActingAtPromotion = 99; },
      x => { x.trickmaster.formulaKnown = false; },
      x => { x.trickmaster.resupply.deliveries = 1; },
      x => { delete x.progression.mastery[APPRENTICE_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[TRICKMASTER_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[TRICKMASTER_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['door.s6.recording'] = 0; },
      x => { delete x.trickmaster.cases['warm-cup']; },
      x => { x.trickmaster.cases['warm-cup']!.attemptWeek = 8; },
      x => { x.trickmaster.cases['warm-cup']!.withdrawals = -1; },
    ];
    for (const mutate of mutations) { const broken = clone(s); mutate(broken); expect(validateTrickmasterState(broken)).toBe(false); }
    for (const value of [null, [], {}, { ...s.trickmaster, batches: [null, null, null] }, { ...s.trickmaster, bottles: [null] }, { ...s.trickmaster, cases: null }, { ...s.trickmaster, cupSurface: 'FROZEN_SOLID' }, { ...s.trickmaster, signalUsed: 1 }]) {
      const broken = clone(s); broken.trickmaster = value as unknown as SliceState['trickmaster']; expect(validateTrickmasterState(broken)).toBe(false);
    }
    const prior = apprentice(); prior.trickmaster.cupSurface = 'THIN_ICE'; expect(validateTrickmasterState(prior)).toBe(false);
  });

  it('accepts only exact command shapes and the finite scene IDs and methods', () => {
    for (const command of [
      { type: 'LEARN_FORMULA' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'MATERIAL_WORK', batchId: 'trickmaster-batch-1' }, { type: 'BUY_MATERIALS', batchId: 'trickmaster-batch-99' },
      { type: 'BREW', batchId: 'trickmaster-batch-1' }, { type: 'CONSUME', bottleId: 'trickmaster-batch-1:bottle', confirmed: true },
      { type: 'REFLECT' }, ...TRICKMASTER_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PERFORM', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PREPARE', caseId, method: 'TRICK' }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
      ]),
    ]) {
      expect(validateTrickmasterCommand(command)).toBe(true);
      if (validateTrickmasterCommand(command)) expect(isTrickmasterAcquisitionCommand(command)).toBe(validateTrickmasterAcquisitionCommand(command));
    }
    for (const command of [
      null, [], {}, { type: 'LEARN_GUIDANCE' }, { type: 'LEARN_FORMULA', free: true },
      { type: 'BUY_MATERIALS', batchId: 'trickmaster-batch-0' }, { type: 'BREW', batchId: 'trickmaster-batch-01' },
      { type: 'BUY_MATERIALS', batchId: 'trickmaster-batch-1000000000000000' },
      { type: 'CONSUME', bottleId: 'trickmaster-batch-1:bottle' }, { type: 'CONSUME', bottleId: 'trickmaster-batch-1:bottle', confirmed: false },
      { type: 'CONSUME', bottleId: 'trickmaster-batch-1:bottle', confirmed: true, guaranteed: true },
      { type: 'OBSERVE', caseId: '__proto__' }, { type: 'PERFORM', caseId: 'warm-cup', reward: 100 },
      { type: 'PREPARE', caseId: 'warm-cup', method: 'LIGHT' }, { type: 'REFLECT', caseId: 'warm-cup' },
    ]) expect(validateTrickmasterCommand(command)).toBe(false);
    const s = prepared(); rejected(s, { type: 'OBSERVE', caseId: 'warm-cup' }); rejected(s, { type: 'REFLECT' });
  });

  it('documents one shared low-power group without exhaustive spell-list or S6 recording/travel claims', () => {
    expect(TRICKMASTER_ABILITIES.map(a => a.id)).toEqual(['door.s8.tricks']);
    expect(TRICKMASTER_SOURCE_STATUS).toContain('第三部第60章《戒严的拜亚姆》');
    expect(TRICKMASTER_SOURCE_STATUS).toContain('造雾、造风、闪光、冻结、电击、绊倒');
    expect(TRICKMASTER_SOURCE_STATUS).toContain('不是完整法术清单');
    expect(TRICKMASTER_SOURCE_STATUS).toContain('薄冰');
    expect(TRICKMASTER_SOURCE_STATUS).toContain('不增加序列6记录法术、旅行或远距离传送');
    expect(projectTrickmaster(promoted()).abilities).toEqual(TRICKMASTER_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });
});
