import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyAssassinCommand } from '../../src/domain/assassin/index.js';
import { ASSASSIN_ABILITY_IDS } from '../../src/domain/assassin/types.js';
import { applyInstigatorCommand } from '../../src/domain/instigator/index.js';
import { INSTIGATOR_ABILITY_IDS } from '../../src/domain/instigator/types.js';
import {
  applyWitchCommand, createWitchState, isWitchAcquisitionCommand, projectWitch,
  validateWitchAcquisitionCommand, validateWitchCommand, validateWitchState,
} from '../../src/domain/witch/index.js';
import {
  WITCH_ABILITIES, WITCH_BODY_CHANGE, WITCH_FORMULA, WITCH_FORMULA_SOURCE, WITCH_SOURCE_STATUS,
} from '../../src/domain/witch/content.js';
import { WITCH_ABILITY_IDS, WITCH_CASE_IDS, type WitchAcquisitionCommand } from '../../src/domain/witch/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

// Elevated resources, fixed rolls and synthetic S8 digestion isolate acquisition contracts.
// This fixture is not a natural playthrough or an end-to-end save validation.
function ordinary(gender: 'MALE' | 'FEMALE' = 'FEMALE'): SliceState {
  const s = createSliceRun('witch-acquisition', { ...sliceDefaultCreationSelection, sex: gender }, 'witch-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.witch = createWitchState();
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
function instigator(gender: 'MALE' | 'FEMALE' = 'FEMALE'): SliceState {
  const s = ordinary(gender), c = context(s, 1).c;
  applyAssassinCommand(s, { type: 'DISCOVER' }, c);
  applyAssassinCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyAssassinCommand(s, { type: 'BUY_POTION', bottleId: s.assassin.bottles[0]!.id }, c);
  applyAssassinCommand(s, { type: 'CONSUME', bottleId: s.assassin.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyInstigatorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyInstigatorCommand(s, { type: 'BUY_POTION', bottleId: s.instigator.bottles[0]!.id }, c);
  applyInstigatorCommand(s, { type: 'CONSUME', bottleId: s.instigator.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...ASSASSIN_ABILITY_IDS, ...INSTIGATOR_ABILITY_IDS].map((id, index) => [id, index * 25]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: WitchAcquisitionCommand, roll = 20) { applyWitchCommand(s, command, context(s, roll).c); }
function taught(s = instigator()) { apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.witch.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
  return s.witch.bottles.at(-1)!;
}
const consume = (bottleId: string): WitchAcquisitionCommand => ({ type: 'CONSUME', bottleId, confirmed: true, bodyChangeAccepted: true });
function prepared(gender: 'MALE' | 'FEMALE' = 'FEMALE') { const s = taught(instigator(gender)); brew(s); return s; }
function promoted() { const s = prepared(); apply(s, consume(s.witch.bottles[0]!.id)); return s; }
function exhausted() { const s = taught(); for (let i = 0; i < 3; i += 1) apply(s, consume(brew(s, i).id), 80); return s; }
const clone = (s: SliceState): SliceState => JSON.parse(JSON.stringify(s)) as SliceState;
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as WitchAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}
const emptyTools = { kitsBought: 0, powderHeld: 0, powderUsed: 0, mirrorsHeld: 0, mirrorsUsed: 0, lastPurchaseWeek: null, mirrorPrepared: false };

describe('Witch source quantities and finite physical acquisition', () => {
  it('independently initializes three batches and hides undiscovered supply', () => {
    const s = ordinary(), p = projectWitch(s);
    expect(validateWitchState(s)).toBe(true);
    expect(p).toMatchObject({ discovered: false, formulaKnown: false, promoted: false, formula: [], actions: [], bottles: [], abilities: [], cases: [], supplies: '', tools: '', bodyChange: '', previousGender: null });
    expect(p.story).toBeUndefined();
    expect(JSON.stringify(p)).not.toMatch(/witch-batch|黑渊魔鱼|玛瑙孔雀|1950/);
    expect(s.witch.batches).toHaveLength(3);
    expect(s.witch.tools).toEqual(emptyTools);
    rejected(s, { type: 'LEARN_FORMULA' });
    const other = createWitchState(); other.batches[0]!.materials[0]!.quantity = 0; other.tools.kitsBought = 1;
    other.cases['shade-test']!.status = 'OBSERVED';
    expect(s.witch.batches[0]!.materials[0]!.quantity).toBe(1);
    expect(s.witch.tools).toEqual(emptyTools);
    expect(s.witch.cases['shade-test']!.status).toBe('AVAILABLE');
  });

  it('requires the S8 demoness pathway and both inherited mentor channels', () => {
    for (const mutate of [
      (s: SliceState) => { s.progression.sequence = 9; },
      (s: SliceState) => { s.progression.pathwayId = 'sun'; },
      (s: SliceState) => { s.assassin.discovered = false; },
      (s: SliceState) => { s.assassin.guidanceKnown = false; },
      (s: SliceState) => { s.instigator.guidanceKnown = false; },
    ]) { const s = instigator(); mutate(s); rejected(s, { type: 'LEARN_FORMULA' }); }
  });

  it('retains both unknown main amounts and all four exact auxiliaries, especially ten DROPS of narcissus', () => {
    expect(WITCH_FORMULA.map(({ name, quantity, unit }) => ({ name, quantity, unit }))).toEqual([
      { name: '黑渊魔鱼全部血液', quantity: null, unit: '全部' },
      { name: '玛瑙孔雀的蛋', quantity: null, unit: '原文未另列数量' },
      { name: '纯水', quantity: 80, unit: '毫升' },
      { name: '金色曼陀罗汁', quantity: 5, unit: '滴' },
      { name: '阴影蜥蜴鳞片', quantity: 3, unit: '枚' },
      { name: '水仙花汁', quantity: 10, unit: '滴' },
    ]);
    const s = instigator(), ctx = context(s), before = [s.cash, s.actionsRemaining];
    expect(projectWitch(s).bodyChange).toBe(WITCH_BODY_CHANGE);
    applyWitchCommand(s, { type: 'LEARN_FORMULA' }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([before[0]! - 240, before[1]! - 1]);
    expect(projectWitch(s).formula.slice(0, 2).every(m => m.quantity === null && m.note!.includes('本作G'))).toBe(true);
    expect(s.witch.batches[0]!.materials.slice(0, 2).map(m => [m.quantity, m.unit])).toEqual([[1, '份'], [1, '份']]);
    expect(WITCH_FORMULA_SOURCE).toContain('第一部第200章');
    expect(WITCH_FORMULA_SOURCE).toContain('逐项投料顺序未核定');
    expect(ctx.notes[0]!.text).toContain(WITCH_BODY_CHANGE);
    expect(s.witch.tools).toEqual(emptyTools);
    rejected(s, { type: 'LEARN_FORMULA' });
    expect(validateWitchState(s)).toBe(true);
  });

  it('charges purchase at zero AP and consumes exactly the six originals once when brewing', () => {
    const s = taught(), batch = s.witch.batches[0]!, before = [s.cash, s.actionsRemaining];
    const ids = batch.materials.map(m => m.id), untouched = JSON.stringify(s.witch.batches[1]);
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([before[0]! - 1950, before[1]]);
    expect(batch.materials.every(m => m.holder === 'PLAYER')).toBe(true);
    rejected(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    apply(s, { type: 'BREW', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([before[0]! - 2010, before[1]! - 1]);
    expect(batch.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.witch.bottles).toEqual([{ id: `${batch.id}:bottle`, batchId: batch.id, inputIds: ids, brewedWeek: 19, status: 'PREPARED', outcome: null }]);
    expect(JSON.stringify(s.witch.batches[1])).toBe(untouched);
    expect(s.witch.tools).toEqual(emptyTools);
    rejected(s, { type: 'BREW', batchId: batch.id });
    expect(validateWitchState(s)).toBe(true);
  });

  it('requires four genuine batch-specific work actions to replace only the 1800 main-material fee', () => {
    const s = taught(), batchId = s.witch.batches[0]!.id, ap = s.actionsRemaining, cash = s.cash;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectWitch(s).actions.find(a => a.id === `buy-${batchId}`)!.cost).toContain('1950便士');
    apply(s, { type: 'MATERIAL_WORK', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([cash, ap - 4]);
    rejected(s, { type: 'MATERIAL_WORK', batchId });
    apply(s, { type: 'BUY_MATERIALS', batchId });
    expect(s.cash).toBe(cash - 150);
    apply(s, { type: 'BREW', batchId });
    expect(s.cash).toBe(cash - 210);
    expect(projectWitch(s).actions.find(a => a.id === 'buy-witch-batch-2')!.cost).toContain('1950便士');
    expect(validateWitchState(s)).toBe(true);
  });

  it('rejects missing money, unacquired materials and changed source identity or units without mutation', () => {
    const s = taught(), batchId = s.witch.batches[0]!.id;
    rejected(s, { type: 'BREW', batchId });
    s.cash = 1949; rejected(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 2009; apply(s, { type: 'BUY_MATERIALS', batchId }); rejected(s, { type: 'BREW', batchId });
    s.cash = 60; const material = s.witch.batches[0]!.materials[5]!;
    material.unit = 'mL'; rejected(s, { type: 'BREW', batchId }); expect(validateWitchState(s)).toBe(false);
    material.unit = '滴'; material.source = 'invented'; rejected(s, { type: 'BREW', batchId });
  });
});

describe('Witch body-change consent and recoverable promotion', () => {
  it('rejects missing or false body acceptance before any mutation or random check', () => {
    const s = prepared('MALE'), bottleId = s.witch.bottles[0]!.id;
    for (const command of [
      { type: 'CONSUME', bottleId, confirmed: true },
      { type: 'CONSUME', bottleId, confirmed: true, bodyChangeAccepted: false },
      { type: 'CONSUME', bottleId, bodyChangeAccepted: true },
      { type: 'CONSUME', bottleId, confirmed: false, bodyChangeAccepted: true },
    ]) { expect(validateWitchCommand(command)).toBe(false); rejected(s, command); }
    expect(s.character.gender).toBe('MALE'); expect(s.witch.previousGender).toBeNull();
    expect(projectWitch(s).bodyChange).toContain('停留在序列8');
    expect(projectWitch(s).actions.filter(a => a.command.type === 'CONSUME').every(a => 'bodyChangeAccepted' in a.command && a.command.bodyChangeAccepted)).toBe(true);
  });

  it('permits early preparation but requires 100 digestion and eight whole S8 weeks for consumption', () => {
    const s = instigator(); s.week = 11; s.progression.acting = 0;
    taught(s); const bottle = brew(s); expect(validateWitchState(s)).toBe(true);
    rejected(s, consume(bottle.id));
    s.week = 18; s.progression.acting = 100;
    expect(projectWitch(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('7/8');
    rejected(s, consume(bottle.id));
    s.week = 19; s.progression.acting = 99; rejected(s, consume(bottle.id));
    s.progression.acting = 100; s.actionsRemaining = 0; apply(s, consume(bottle.id));
    expect([s.progression.promotionWeek, s.instigator.promotionWeek, s.witch.promotionWeek, s.actionsRemaining]).toEqual([5, 11, 19, 0]);
  });

  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s, with a single will18 check and gender change only on success', (roll, tier, mindCost, healthCost, pollution, success) => {
    const s = prepared('MALE'), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, ctx = context(s, roll);
    const inherited = JSON.stringify([s.assassin, s.instigator]), actions = s.actionsRemaining, cash = s.cash;
    const appearance = s.character.appearanceDescription, portrait = s.character.portraitId;
    s.spirituality = 7; const chance = projectWitch(s).bottles[0]!.chance;
    applyWitchCommand(s, consume(s.witch.bottles[0]!.id), ctx.c);
    expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance });
    expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 18, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash, s.status]).toEqual([100 - mindCost, 100 - healthCost, pollution, 7, actions, cash, 'ACTIVE']);
    expect(s.witch.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.progression.sequence, s.progression.acting, s.witch.promotionWeek, s.witch.instigatorActingAtPromotion]).toEqual(success ? [7, 0, 19, 100] : [8, 100, null, null]);
    expect([s.character.gender, s.witch.previousGender]).toEqual(success ? ['FEMALE', 'MALE'] : ['MALE', null]);
    expect([s.character.appearanceDescription, s.character.portraitId]).toEqual([appearance, portrait]);
    expect(JSON.stringify([s.assassin, s.instigator])).toBe(inherited);
    expect(s.progression.mastery).toEqual(success ? { ...mastery, ...Object.fromEntries(WITCH_ABILITY_IDS.map(id => [id, 0])) } : mastery);
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 1, perception: stats.perception + 2, will: stats.will + 2, knowledge: stats.knowledge + 1 } : stats);
    expect(s.witch.tools).toEqual(emptyTools);
    expect(validateWitchState(s)).toBe(true); rejected(s, consume(s.witch.bottles[0]!.id));
  });

  it('also records existing female characters and explains appearance/charm change without arbitrary face replacement', () => {
    const s = prepared('FEMALE'), ctx = context(s), appearance = s.character.appearanceDescription;
    applyWitchCommand(s, consume(s.witch.bottles[0]!.id), ctx.c);
    expect([s.character.gender, s.witch.previousGender, projectWitch(s).previousGender]).toEqual(['FEMALE', 'FEMALE', 'FEMALE']);
    expect(ctx.notes[0]!.text).toContain('原女性角色的外貌与魅力发生变化');
    expect(s.character.appearanceDescription).toBe(appearance);
    expect(WITCH_BODY_CHANGE).toContain('不推断现实玩家');
    expect(validateWitchState(s)).toBe(true);
  });

  it('caps stats and pollution and blocks repeated promotion while retaining unused bottles', () => {
    const bad = prepared(); bad.health = 1; bad.mind = 1; bad.seer.pollution = 90;
    apply(bad, consume(bad.witch.bottles[0]!.id), 100);
    expect([bad.health, bad.mind, bad.seer.pollution, bad.status]).toEqual([-19, -39, 100, 'ACTIVE']);
    rejected(bad, { type: 'BUY_MATERIALS', batchId: 'witch-batch-2' });
    expect(validateWitchState(bad)).toBe(true);
    const good = prepared(); brew(good, 1);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) good.character.coreStats[stat] = 499;
    good.spirituality = 0; apply(good, consume(good.witch.bottles[0]!.id), 1);
    expect(Object.values(good.character.coreStats)).toEqual([500, 500, 500, 500]); expect(good.spirituality).toBe(0);
    rejected(good, consume(good.witch.bottles[1]!.id));
    expect(good.witch.bottles[1]!.status).toBe('PREPARED'); expect(projectWitch(good).actions).toEqual([]);
    expect(validateWitchState(good)).toBe(true);
  });

  it.each([
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['open event', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects consumption when %s', (_label, mutate) => { const s = prepared(); mutate(s); rejected(s, consume(s.witch.bottles[0]!.id)); });
});

describe('Witch resupply and boundary validation', () => {
  it('preserves all failed originals and requires one action plus a real next week for three new full-cost batches', () => {
    const s = exhausted(), batches = JSON.stringify(s.witch.batches), bottles = JSON.stringify(s.witch.bottles);
    expect(new Set(s.witch.bottles.flatMap(b => b.inputIds)).size).toBe(18);
    expect(projectWitch(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.cash, s.actionsRemaining, s.witch.resupply.requestedWeek]).toEqual([cash, ap - 1, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateWitchState(s)).toBe(true);
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.witch.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.witch.batches).toHaveLength(6);
    expect(JSON.stringify(s.witch.batches.slice(0, 3))).toBe(batches); expect(JSON.stringify(s.witch.bottles)).toBe(bottles);
    expect(projectWitch(s).actions.find(a => a.id === 'buy-witch-batch-4')!.cost).toContain('1950便士');
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    expect(validateWitchState(clone(s))).toBe(true);
    s.mind = 100; apply(s, consume(brew(s, 3).id));
    expect(s.witch.promotionWeek).toBe(20); expect(validateWitchState(s)).toBe(true);
  });

  it('does not refill automatically, while any original remains, or after success', () => {
    for (const s of [ordinary(), instigator(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 20; expect(s.witch.batches).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('rejects corrupted lineage, quantities, chronology, inheritance, body history and tool balance', () => {
    const s = promoted(); expect(validateWitchState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.witch.batches[0]!.id = 'witch-batch-2'; },
      x => { x.witch.batches[0]!.labourSteps = 5; },
      x => { x.witch.batches[0]!.acquired = false; },
      x => { x.witch.batches[0]!.materials[0]!.quantity = 1; },
      x => { x.witch.batches[0]!.materials[0]!.source = 'invented'; },
      x => { x.witch.batches[0]!.materials[5]!.unit = '毫升'; },
      x => { x.witch.bottles[0]!.inputIds[0] = 'witch-batch-2:black-abyss-demonic-fish-blood'; },
      x => { x.witch.bottles[0]!.brewedWeek = 20; },
      x => { x.witch.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.witch.bottles.push({ ...x.witch.bottles[0]! }); },
      x => { x.witch.promotionWeek = 18; },
      x => { x.witch.instigatorActingAtPromotion = 99; },
      x => { x.witch.formulaKnown = false; },
      x => { x.witch.previousGender = null; },
      x => { x.character.gender = 'MALE'; },
      x => { x.witch.resupply.deliveries = 1; },
      x => { delete x.progression.mastery[ASSASSIN_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[INSTIGATOR_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[WITCH_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[WITCH_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['assassin.s6.spider-silk'] = 0; },
      x => { delete x.witch.cases['shade-test']; },
      x => { x.witch.cases['shade-test']!.attemptWeek = 18; },
      x => { x.witch.cases['shade-test']!.withdrawals = -1; },
      x => { x.witch.tools.powderHeld = 1; },
      x => { x.witch.tools.mirrorsUsed = 1; },
      x => { x.witch.tools.mirrorPrepared = true; },
      x => { x.witch.tools.lastPurchaseWeek = 19; },
    ];
    for (const mutate of mutations) { const broken = clone(s); mutate(broken); expect(validateWitchState(broken)).toBe(false); }
    s.witch.tools = { kitsBought: 1, powderHeld: 3, powderUsed: 0, mirrorsHeld: 1, mirrorsUsed: 0, lastPurchaseWeek: 19, mirrorPrepared: true };
    expect(validateWitchState(s)).toBe(true);
    s.witch.tools = { kitsBought: 1, powderHeld: 1, powderUsed: 2, mirrorsHeld: 0, mirrorsUsed: 1, lastPurchaseWeek: 19, mirrorPrepared: false };
    expect(validateWitchState(s)).toBe(true);
    s.witch.tools.mirrorPrepared = true; expect(validateWitchState(s)).toBe(false);
  });

  it('rejects malformed saved records without throwing and all premature activities or tools', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.witch, batches: [null, null, null] }, { ...s.witch, cases: null }, { ...s.witch, tools: null }]) {
      const broken = clone(s); broken.witch = value as unknown as SliceState['witch']; expect(validateWitchState(broken)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.witch.formulaKnown = true; },
      (x: SliceState) => { x.witch.reflected = true; },
      (x: SliceState) => { x.witch.cases['shade-test']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.witch.previousGender = 'MALE'; },
      (x: SliceState) => { x.progression.mastery[WITCH_ABILITY_IDS[0]] = 0; },
      (x: SliceState) => { x.witch.tools.kitsBought = 1; },
    ]) { const broken = clone(s); mutate(broken); expect(validateWitchState(broken)).toBe(false); }
  });

  it('accepts only exact command shapes and approved case/method IDs', () => {
    for (const command of [
      { type: 'LEARN_FORMULA' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'MATERIAL_WORK', batchId: 'witch-batch-1' }, { type: 'BUY_MATERIALS', batchId: 'witch-batch-99' },
      { type: 'BREW', batchId: 'witch-batch-1' }, consume('witch-batch-1:bottle'),
      { type: 'REFLECT' }, { type: 'BUY_SUPPLIES' }, { type: 'PREPARE_MIRROR' }, ...WITCH_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PERFORM', caseId }, { type: 'REPORT', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PREPARE', caseId, method: 'MAGIC' }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
      ]),
    ]) {
      expect(validateWitchCommand(command)).toBe(true);
      if (validateWitchCommand(command)) expect(isWitchAcquisitionCommand(command)).toBe(validateWitchAcquisitionCommand(command));
    }
    for (const command of [
      null, [], {}, { type: 'LEARN_GUIDANCE' }, { type: 'LEARN_FORMULA', free: true },
      { type: 'BUY_MATERIALS', batchId: 'witch-batch-0' }, { type: 'BREW', batchId: 'witch-batch-01' },
      { type: 'BUY_MATERIALS', batchId: 'witch-batch-1000000000000000' },
      { type: 'CONSUME', bottleId: 'witch-batch-1:bottle', confirmed: true },
      { ...consume('witch-batch-1:bottle'), guaranteed: true },
      { type: 'OBSERVE', caseId: '__proto__' }, { type: 'PERFORM', caseId: 'shade-test', reward: 100 },
      { type: 'PREPARE', caseId: 'shade-test', method: 'LIGHT' }, { type: 'REFLECT', caseId: 'shade-test' },
      { type: 'BUY_SUPPLIES', amount: 100 }, { type: 'PREPARE_MIRROR', free: true },
    ]) expect(validateWitchCommand(command)).toBe(false);
    const s = prepared(); rejected(s, { type: 'OBSERVE', caseId: 'shade-test' }); rejected(s, { type: 'BUY_SUPPLIES' });
  });

  it('documents source boundaries without inventing blood media, spider silk, disease or arbitrary shapechanging', () => {
    expect(WITCH_ABILITIES.map(a => a.id)).toEqual([...WITCH_ABILITY_IDS]); expect(WITCH_ABILITIES).toHaveLength(6);
    expect(WITCH_SOURCE_STATUS).toContain('第一部第123章');
    expect(WITCH_SOURCE_STATUS).toContain('真实血液媒介');
    expect(WITCH_SOURCE_STATUS).toContain('知道目标姓名或ID不能代替媒介');
    expect(WITCH_SOURCE_STATUS).toContain('不提前开放序列6蛛丝、序列5疾病、任意变脸');
    expect(projectWitch(promoted()).abilities).toEqual(WITCH_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });
});
