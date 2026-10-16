import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyLawyerCommand } from '../../src/domain/lawyer/index.js';
import { LAWYER_ABILITY_IDS } from '../../src/domain/lawyer/types.js';
import {
  applyBarbarianCommand, createBarbarianState, isBarbarianAcquisitionCommand, projectBarbarian,
  validateBarbarianAcquisitionCommand, validateBarbarianCommand, validateBarbarianState,
} from '../../src/domain/barbarian/index.js';
import { BARBARIAN_ABILITIES, BARBARIAN_FORMULA, BARBARIAN_FORMULA_SOURCE, BARBARIAN_GUIDE, BARBARIAN_SOURCE_STATUS } from '../../src/domain/barbarian/content.js';
import { BARBARIAN_ABILITY_IDS, BARBARIAN_CASE_IDS, type BarbarianAcquisitionCommand } from '../../src/domain/barbarian/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('barbarian-acquisition', sliceDefaultCreationSelection, 'barbarian-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.barbarian = createBarbarianState();
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
function lawyer(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyLawyerCommand(s, { type: 'DISCOVER' }, c);
  applyLawyerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyLawyerCommand(s, { type: 'BUY_POTION', bottleId: s.lawyer.bottles[0]!.id }, c);
  applyLawyerCommand(s, { type: 'CONSUME', bottleId: s.lawyer.bottles[0]!.id, confirmed: true }, c);
  s.week = 9; s.progression.acting = 100; s.progression.mastery = Object.fromEntries(LAWYER_ABILITY_IDS.map((id, index) => [id, 37 + index]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: BarbarianAcquisitionCommand, roll = 20) { applyBarbarianCommand(s, command, context(s, roll).c); }
function taught(s = lawyer()) { apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.barbarian.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
  return s.barbarian.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: s.barbarian.bottles[0]!.id, confirmed: true }); return s; }
function exhausted() { const s = taught(); for (let i = 0; i < 3; i += 1) apply(s, { type: 'CONSUME', bottleId: brew(s, i).id, confirmed: true }, 80); return s; }
const clone = (s: SliceState): SliceState => JSON.parse(JSON.stringify(s)) as SliceState;
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as BarbarianAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Barbarian six-material formula and physical acquisition', () => {
  it('initializes independent hidden stocks and inactive scenes', () => {
    const s = ordinary(), p = projectBarbarian(s);
    expect(validateBarbarianState(s)).toBe(true);
    expect([p.discovered, p.formulaKnown, p.promoted]).toEqual([false, false, false]);
    expect([p.formula, p.actions, p.bottles, p.abilities, p.cases]).toEqual([[], [], [], [], []]);
    expect(p.supplies).toBe(''); expect(p.story).toBeUndefined();
    expect(JSON.stringify(p)).not.toMatch(/barbarian-batch|狂化草|实心独角结晶|1150/);
    rejected(s, { type: 'LEARN_FORMULA' });
    const other = createBarbarianState();
    other.batches[0]!.materials[0]!.quantity = 0; other.cases['wedged-cart']!.contactOpen = true;
    other.cases['wedged-cart']!.status = 'OBSERVED';
    expect(s.barbarian.batches[0]!.materials[0]!.quantity).toBe(1);
    expect(s.barbarian).toMatchObject({ reflected: false });
    expect(s.barbarian.cases['wedged-cart']!).toMatchObject({ status: 'AVAILABLE', contactOpen: false, closes: 0 });
    expect(p.insideCase).toBe(false);
  });

  it.each([
    ['wrong sequence', (s: SliceState) => { s.progression.sequence = 7; }],
    ['wrong pathway', (s: SliceState) => { s.progression.pathwayId = 'diviner'; }],
    ['unknown mentor', (s: SliceState) => { s.lawyer.discovered = false; }],
    ['missing prior guidance', (s: SliceState) => { s.lawyer.guidanceKnown = false; }],
  ])('requires the original S9 channel: %s', (_label, mutate) => {
    const s = lawyer(); mutate(s); expect(projectBarbarian(s).actions).toEqual([]); rejected(s, { type: 'LEARN_FORMULA' });
  });

  it('charges 180 and one action, preserving the unquantified original horn crystal and G mixing order', () => {
    const s = lawyer(), inherited = JSON.stringify([s.lawyer, s.progression]); taught(s);
    expect([s.cash, s.actionsRemaining]).toEqual([9820, 39]);
    expect(JSON.stringify([s.lawyer, s.progression])).toBe(inherited);
    const formula = projectBarbarian(s).formula;
    expect(formula[1]).toEqual({ name: '大地犀牛的实心独角结晶', quantity: null, unit: '', note: '原著未给明确数量或重量；本作G每批供货1份。' });
    expect(formula.filter(m => m.quantity !== null).map(m => `${m.name}:${m.quantity}${m.unit}`)).toEqual([
      '狂化草:1株', '深纹胡桃:1个', '香蜂草:1株', '杨树皮浸泡纯露:10mL', '烈酒:100mL',
    ]);
    expect(BARBARIAN_FORMULA_SOURCE).toContain('第二部第121章《子弹》');
    expect(BARBARIAN_FORMULA_SOURCE).toContain('确切投料顺序未核定');
    expect(BARBARIAN_FORMULA_SOURCE).toContain('本作玩法改编G');
    expect(BARBARIAN_GUIDE).toBe('契约文书员米蕾·沃德');
    expect(validateBarbarianState(s)).toBe(true); rejected(s, { type: 'LEARN_FORMULA' });
  });

  it('transfers a 1150-pence batch, then consumes exactly six originals for one 60-pence bottle', () => {
    const s = taught(), batch = s.barbarian.batches[0]!, actions = s.actionsRemaining;
    expect(batch.materials.map(m => m.quantity)).toEqual([1, 1, 1, 1, 10, 100]);
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([8670, actions]);
    expect(batch.materials.every(m => m.holder === 'PLAYER')).toBe(true);
    const ctx = context(s); applyBarbarianCommand(s, { type: 'BREW', batchId: batch.id }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([8610, actions - 1]);
    expect(batch.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.barbarian.bottles[0]).toMatchObject({ id: 'barbarian-batch-1:bottle', batchId: batch.id, brewedWeek: 9, status: 'PREPARED', outcome: null });
    expect(s.barbarian.bottles[0]!.inputIds).toEqual(BARBARIAN_FORMULA.map(m => `${batch.id}:${m.id}`));
    expect(ctx.notes[0]!.text).toContain('具体操作次序采用本作G导师规程');
    expect(ctx.notes[0]!.text).toContain('实心独角结晶的1份是本作G供货计量');
    rejected(s, { type: 'BREW', batchId: batch.id }); rejected(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect(validateBarbarianState(s)).toBe(true);
  });

  it('requires three real labour actions for the batch-specific 1050 credit, still charging 100 plus 60', () => {
    const s = taught(), batchId = s.barbarian.batches[0]!.id;
    for (let i = 1; i <= 3; i += 1) {
      apply(s, { type: 'MATERIAL_WORK', batchId });
      expect(s.barbarian.batches[0]!.materials.every(m => m.holder === 'SUPPLIER')).toBe(true);
      expect(projectBarbarian(s).actions.find(a => a.id === `buy-${batchId}`)!.cost).toContain(`${i === 3 ? 100 : 1150}便士`);
    }
    rejected(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectBarbarian(s).actions.find(a => a.id === 'buy-barbarian-batch-2')!.cost).toContain('1150便士');
    apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([9660, 35]);
    rejected(s, { type: 'MATERIAL_WORK', batchId }); expect(validateBarbarianState(s)).toBe(true);
  });

  it.each([1, 2])('does not partially discount %i labour steps', steps => {
    const s = taught(), batchId = s.barbarian.batches[0]!.id;
    for (let i = 0; i < steps; i += 1) apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash; apply(s, { type: 'BUY_MATERIALS', batchId }); expect(cash - s.cash).toBe(1150);
  });

  it('rejects insufficient money, missing stock, changed quantities, forged origin and mixed batches atomically', () => {
    const s = lawyer(); s.cash = 179; rejected(s, { type: 'LEARN_FORMULA' });
    s.cash = 10000; taught(s); const batchId = s.barbarian.batches[0]!.id;
    rejected(s, { type: 'BREW', batchId }); rejected(s, { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-4' });
    s.cash = 1149; rejected(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 1209; apply(s, { type: 'BUY_MATERIALS', batchId }); rejected(s, { type: 'BREW', batchId });
    s.cash = 60; const material = s.barbarian.batches[0]!.materials[0]!, source = material.source;
    material.source = 'invented'; rejected(s, { type: 'BREW', batchId });
    material.source = source; material.quantity = 2; rejected(s, { type: 'BREW', batchId });
    material.quantity = 1; material.id = 'barbarian-batch-2:frenzy-grass'; rejected(s, { type: 'BREW', batchId });
    expect(validateBarbarianState(s)).toBe(false);
  });
});

describe('Barbarian promotion and recoverable outcomes', () => {
  it('allows early preparation but requires 100 digestion and four complete weeks after S9', () => {
    const s = lawyer(); s.week = 5; s.progression.acting = 0;
    taught(s); const bottle = brew(s); expect(validateBarbarianState(s)).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 8; s.progression.acting = 100;
    expect(projectBarbarian(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('3/4');
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 9; s.progression.acting = 99; rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.progression.acting = 100; s.actionsRemaining = 0; apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect([s.progression.promotionWeek, s.barbarian.promotionWeek, s.actionsRemaining]).toEqual([5, 9, 0]);
  });

  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s with one will12 check and no instant-death draw', (roll, tier, mindCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, ctx = context(s, roll);
    const inherited = JSON.stringify(s.lawyer), actions = s.actionsRemaining, cash = s.cash;
    s.spirituality = 7; const chance = projectBarbarian(s).bottles[0]!.chance;
    applyBarbarianCommand(s, { type: 'CONSUME', bottleId: s.barbarian.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance });
    expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash, s.status]).toEqual([100 - mindCost, 100 - healthCost, pollution, 7, actions, cash, 'ACTIVE']);
    expect(s.barbarian.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.progression.sequence, s.progression.acting, s.barbarian.promotionWeek, s.barbarian.lawyerActingAtPromotion]).toEqual(success ? [8, 0, 9, 100] : [9, 100, null, null]);
    expect(JSON.stringify(s.lawyer)).toBe(inherited);
    expect(s.progression.mastery).toEqual(success ? { ...mastery, 'black-emperor.s8.enhanced-body': 0, 'black-emperor.s8.mental-resistance': 0 } : mastery);
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 3, perception: stats.perception, will: stats.will + 2, knowledge: stats.knowledge } : stats);
    expect(Object.values(s.barbarian.cases).every(scene => scene.status === 'AVAILABLE' && !scene.contactOpen && scene.closes === 0)).toBe(true);
    expect(validateBarbarianState(s)).toBe(true); rejected(s, { type: 'CONSUME', bottleId: s.barbarian.bottles[0]!.id, confirmed: true });
  });

  it('caps stats and pollution, preserves depleted health and spirituality, and prevents repeated stat grants', () => {
    const s = prepared(); s.health = 1; s.mind = 1; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: s.barbarian.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-19, -39, 100, 'ACTIVE']);
    rejected(s, { type: 'BUY_MATERIALS', batchId: s.barbarian.batches[1]!.id }); expect(validateBarbarianState(s)).toBe(true);
    const good = prepared(); brew(good, 1);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) good.character.coreStats[stat] = 499;
    good.spirituality = 0; apply(good, { type: 'CONSUME', bottleId: good.barbarian.bottles[0]!.id, confirmed: true }, 1);
    expect(good.character.coreStats).toEqual({ physique: 500, perception: 499, will: 500, knowledge: 499 }); expect(good.spirituality).toBe(0);
    rejected(good, { type: 'CONSUME', bottleId: good.barbarian.bottles[1]!.id, confirmed: true });
    rejected(good, { type: 'BUY_MATERIALS', batchId: good.barbarian.batches[2]!.id });
    expect(good.barbarian.bottles[1]!.status).toBe('PREPARED'); expect(projectBarbarian(good).actions).toEqual([]);
    expect(validateBarbarianState(good)).toBe(true);
  });

  it('requires actual closure of original Lawyer contact before S8 preparation or consumption', () => {
    const s = lawyer(); s.lawyer.cases['ambiguous-delivery']!.contactOpen = true;
    rejected(s, { type: 'LEARN_FORMULA' });
    s.lawyer.cases['ambiguous-delivery']!.contactOpen = false;
    taught(s); const bottle = brew(s);
    s.lawyer.cases['duplicated-receipt']!.contactOpen = true;
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(bottle.status).toBe('PREPARED');
  });

  it.each([
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects blocked consumption when %s', (_label, mutate) => {
    const s = prepared(); mutate(s); rejected(s, { type: 'CONSUME', bottleId: s.barbarian.bottles[0]!.id, confirmed: true });
  });
});

describe('Barbarian replenishment, validation and public boundaries', () => {
  it('keeps all failed originals and requires one action plus a real next week for three new full-cost batches', () => {
    const s = exhausted(), batches = JSON.stringify(s.barbarian.batches), bottles = JSON.stringify(s.barbarian.bottles);
    expect(new Set(s.barbarian.bottles.flatMap(b => b.inputIds)).size).toBe(18);
    expect(projectBarbarian(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const cash = s.cash, actions = s.actionsRemaining; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.cash, s.actionsRemaining, s.barbarian.resupply.requestedWeek]).toEqual([cash, actions - 1, 9]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' }); expect(validateBarbarianState(s)).toBe(true);
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.barbarian.resupply).toEqual({ requestedWeek: null, deliveries: 1 }); expect(s.barbarian.batches).toHaveLength(6);
    expect(JSON.stringify(s.barbarian.batches.slice(0, 3))).toBe(batches); expect(JSON.stringify(s.barbarian.bottles)).toBe(bottles);
    expect(s.barbarian.batches[3]).toMatchObject({ id: 'barbarian-batch-4', labourSteps: 0, acquired: false, brewed: false });
    expect(projectBarbarian(s).actions.find(a => a.id === 'buy-barbarian-batch-4')!.cost).toContain('1150便士');
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' }); expect(validateBarbarianState(clone(s))).toBe(true);
    s.mind = 100; const bottle = brew(s, 3); apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(s.barbarian.promotionWeek).toBe(10); expect(validateBarbarianState(s)).toBe(true);
  });

  it('does not replenish automatically or while any original remains or after promotion', () => {
    for (const s of [ordinary(), lawyer(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 20; expect(s.barbarian.batches).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('rejects forged lineage, promotion chronology, mastery and malformed records', () => {
    const s = promoted(); expect(validateBarbarianState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.barbarian.batches[0]!.id = 'barbarian-batch-2'; },
      x => { x.barbarian.batches[0]!.labourSteps = 4; },
      x => { x.barbarian.batches[0]!.acquired = false; },
      x => { x.barbarian.batches[0]!.materials[0]!.quantity = 1; },
      x => { x.barbarian.batches[0]!.materials[0]!.source = 'invented'; },
      x => { x.barbarian.bottles[0]!.inputIds[0] = 'barbarian-batch-2:frenzy-grass'; },
      x => { x.barbarian.bottles[0]!.brewedWeek = 10; },
      x => { x.barbarian.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.barbarian.bottles.push({ ...x.barbarian.bottles[0]! }); },
      x => { x.barbarian.promotionWeek = 8; },
      x => { x.barbarian.lawyerActingAtPromotion = 99; },
      x => { x.barbarian.formulaKnown = false; },
      x => { x.barbarian.resupply.deliveries = 1; },
      x => { delete x.progression.mastery[LAWYER_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[BARBARIAN_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[BARBARIAN_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['black-emperor.s6.distortion'] = 0; },
      x => { delete x.barbarian.cases['wedged-cart']; },
      x => { x.barbarian.cases['wedged-cart']!.attemptWeek = 8; },
      x => { x.barbarian.cases['wedged-cart']!.withdrawals = -1; },
      x => { x.barbarian.cases['wedged-cart']!.closes = -1; },
      x => { x.barbarian.cases['wedged-cart']!.method = 'ARGUMENT' as never; },
      x => { x.barbarian.cases['wedged-cart']!.contactOpen = 1 as never; },
    ];
    for (const mutate of mutations) { const broken = clone(s); mutate(broken); expect(validateBarbarianState(broken)).toBe(false); }
    for (const value of [null, [], {}, { ...s.barbarian, batches: [null, null, null] }, { ...s.barbarian, bottles: [null] }, { ...s.barbarian, cases: null }, { ...s.barbarian, reflected: 1 }, { ...s.barbarian, formulaKnown: 1 }]) {
      const broken = clone(s); broken.barbarian = value as unknown as SliceState['barbarian']; expect(validateBarbarianState(broken)).toBe(false);
    }
    const prior = lawyer(); prior.barbarian.cases['wedged-cart']!.contactOpen = true; expect(validateBarbarianState(prior)).toBe(false);
  });

  it('accepts only exact command shapes and the finite scene IDs and methods', () => {
    for (const command of [
      { type: 'LEARN_FORMULA' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'MATERIAL_WORK', batchId: 'barbarian-batch-1' }, { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-99' },
      { type: 'BREW', batchId: 'barbarian-batch-1' }, { type: 'CONSUME', bottleId: 'barbarian-batch-1:bottle', confirmed: true },
      { type: 'REFLECT' }, ...BARBARIAN_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PERFORM', caseId }, { type: 'CLOSE', caseId }, { type: 'REPORT', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PREPARE', caseId, method: 'ABILITY' }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
      ]),
    ]) {
      expect(validateBarbarianCommand(command)).toBe(true);
      if (validateBarbarianCommand(command)) expect(isBarbarianAcquisitionCommand(command)).toBe(validateBarbarianAcquisitionCommand(command));
    }
    for (const command of [
      null, [], {}, { type: 'LEARN_GUIDANCE' }, { type: 'LEARN_FORMULA', free: true },
      { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-0' }, { type: 'BREW', batchId: 'barbarian-batch-01' },
      { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-1000000000000000' },
      { type: 'CONSUME', bottleId: 'barbarian-batch-1:bottle' }, { type: 'CONSUME', bottleId: 'barbarian-batch-1:bottle', confirmed: false },
      { type: 'CONSUME', bottleId: 'barbarian-batch-1:bottle', confirmed: true, guaranteed: true },
      { type: 'OBSERVE', caseId: '__proto__' }, { type: 'PERFORM', caseId: 'wedged-cart', reward: 100 },
      { type: 'PREPARE', caseId: 'wedged-cart', method: 'LIGHT' }, { type: 'REFLECT', caseId: 'wedged-cart' },
    ]) expect(validateBarbarianCommand(command)).toBe(false);
    const s = prepared(); rejected(s, { type: 'OBSERVE', caseId: 'wedged-cart' }); rejected(s, { type: 'REFLECT' });
  });

  it('keeps the two bounded S8 groups separate and excludes S7 bribery and S6 distortion', () => {
    expect(BARBARIAN_ABILITIES.map(a => a.id)).toEqual(['black-emperor.s8.enhanced-body', 'black-emperor.s8.mental-resistance']);
    expect(BARBARIAN_SOURCE_STATUS).toContain('非凡力量');
    expect(BARBARIAN_SOURCE_STATUS).toContain('精神抗性不等于精神影响免疫');
    expect(BARBARIAN_SOURCE_STATUS).toContain('序列7贿赂者的贿赂');
    expect(BARBARIAN_SOURCE_STATUS).toContain('序列6腐化男爵的扭曲');
    expect(BARBARIAN_SOURCE_STATUS).toContain('本作玩法G');
    expect(projectBarbarian(promoted()).abilities).toEqual(BARBARIAN_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });
});
