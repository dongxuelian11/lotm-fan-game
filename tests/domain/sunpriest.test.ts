import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyBardCommand } from '../../src/domain/bard/index.js';
import { BARD_ABILITY_IDS } from '../../src/domain/bard/types.js';
import { applyLightprayerCommand } from '../../src/domain/lightprayer/index.js';
import { LIGHTPRAYER_ABILITY_IDS } from '../../src/domain/lightprayer/types.js';
import { applySunpriestCommand, createSunpriestState, isSunpriestAcquisitionCommand, projectSunpriest, validateSunpriestAcquisitionCommand, validateSunpriestCommand, validateSunpriestState } from '../../src/domain/sunpriest/index.js';
import { SUNPRIEST_ABILITIES, SUNPRIEST_FORMULA, SUNPRIEST_FORMULA_SOURCE, SUNPRIEST_SOURCE_STATUS } from '../../src/domain/sunpriest/content.js';
import { SUNPRIEST_ABILITY_IDS, SUNPRIEST_CASE_IDS, type SunpriestAcquisitionCommand } from '../../src/domain/sunpriest/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('sunpriest-acquisition', sliceDefaultCreationSelection, 'sunpriest-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.sunpriest = createSunpriestState();
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
function lightprayer(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyBardCommand(s, { type: 'DISCOVER' }, c);
  applyBardCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyBardCommand(s, { type: 'BUY_POTION', bottleId: s.bard.bottles[0]!.id }, c);
  applyBardCommand(s, { type: 'CONSUME', bottleId: s.bard.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyLightprayerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyLightprayerCommand(s, { type: 'BUY_POTION', bottleId: s.lightprayer.bottles[0]!.id }, c);
  applyLightprayerCommand(s, { type: 'CONSUME', bottleId: s.lightprayer.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...BARD_ABILITY_IDS, ...LIGHTPRAYER_ABILITY_IDS].map((id, index) => [id, index * 25]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: SunpriestAcquisitionCommand, roll = 20) { applySunpriestCommand(s, command, context(s, roll).c); }
function taught(s = lightprayer()) { apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.sunpriest.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
  return s.sunpriest.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: s.sunpriest.bottles[0]!.id, confirmed: true }); return s; }
function exhausted() { const s = taught(); for (let i = 0; i < 3; i += 1) apply(s, { type: 'CONSUME', bottleId: brew(s, i).id, confirmed: true }, 80); return s; }
const clone = (s: SliceState): SliceState => JSON.parse(JSON.stringify(s)) as SliceState;
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as SunpriestAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('sunpriest full formula and finite materials', () => {
  it('keeps undiscovered supplies hidden and independently initialized', () => {
    const s = ordinary(), p = projectSunpriest(s);
    expect(validateSunpriestState(s)).toBe(true);
    expect([p.discovered, p.formulaKnown, p.promoted]).toEqual([false, false, false]);
    expect([p.formula, p.actions, p.bottles, p.abilities, p.cases]).toEqual([[], [], [], [], []]);
    expect(p.supplies).toBe(''); expect(p.story).toBeUndefined();
    expect(JSON.stringify(p)).not.toMatch(/sunpriest-batch|黎明雄鸡|光辉契灵树|1950/);
    rejected(s, { type: 'LEARN_FORMULA' });
    const other = createSunpriestState();
    other.batches[0]!.materials[0]!.quantity = 0; other.holyWater.prepared = 1;
    other.cases['water-preparation']!.status = 'OBSERVED';
    expect(s.sunpriest.batches[0]!.materials[0]!.quantity).toBe(1);
    expect(s.sunpriest.holyWater).toEqual({ prepared: 0, held: 0, used: 0 });
    expect(s.sunpriest.cases['water-preparation']!.status).toBe('AVAILABLE');
  });

  it('requires the sun S8 pathway and the existing mentor channel', () => {
    for (const mutate of [
      (s: SliceState) => { s.progression.sequence = 9; },
      (s: SliceState) => { s.progression.pathwayId = 'diviner'; },
      (s: SliceState) => { s.bard.discovered = false; },
      (s: SliceState) => { s.bard.guidanceKnown = false; },
      (s: SliceState) => { s.lightprayer.guidanceKnown = false; },
    ]) { const s = lightprayer(); mutate(s); expect(projectSunpriest(s).actions).toEqual([]); rejected(s, { type: 'LEARN_FORMULA' }); }
  });

  it('charges 240 and one action for all six verified quantities while marking mixing order as G', () => {
    const s = lightprayer(), inherited = JSON.stringify([s.bard, s.lightprayer, s.progression]);
    taught(s);
    expect([s.cash, s.actionsRemaining]).toEqual([9760, 39]);
    expect(JSON.stringify([s.bard, s.lightprayer, s.progression])).toBe(inherited);
    expect(projectSunpriest(s).formula.map(m => `${m.name}:${m.quantity}${m.unit}`)).toEqual([
      '黎明雄鸡红冠:1朵', '光辉契灵树果实:1枚', '黎明雄鸡血:100mL', '太阳精油:10滴', '金手柑粉末:8g', '凝固熔浆:5g',
    ]);
    expect(SUNPRIEST_FORMULA_SOURCE).toMatch(/第三部第33章.*L93861/);
    expect(SUNPRIEST_FORMULA_SOURCE).toMatch(/确切投料顺序未核定/);
    expect(SUNPRIEST_FORMULA_SOURCE).toContain('本作玩法改编G');
    expect(validateSunpriestState(s)).toBe(true); rejected(s, { type: 'LEARN_FORMULA' });
  });

  it('pays 1950 for a physical batch and consumes exactly those six inputs for a separate bottle', () => {
    const s = taught(), batch = s.sunpriest.batches[0]!, actions = s.actionsRemaining;
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([7810, actions]);
    expect(batch.materials.every(m => m.holder === 'PLAYER')).toBe(true);
    const ctx = context(s); applySunpriestCommand(s, { type: 'BREW', batchId: batch.id }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([7750, actions - 1]);
    expect(batch.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.sunpriest.bottles[0]).toMatchObject({ id: 'sunpriest-batch-1:bottle', batchId: batch.id, brewedWeek: 19, status: 'PREPARED', outcome: null });
    expect(s.sunpriest.bottles[0]!.inputIds).toEqual(SUNPRIEST_FORMULA.map(m => `${batch.id}:${m.id}`));
    expect(ctx.notes[0]!.text).toContain('具体操作次序采用本作G导师规程');
    rejected(s, { type: 'BREW', batchId: batch.id }); rejected(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect(validateSunpriestState(s)).toBe(true);
  });

  it('requires four real labour actions for a batch-specific 1800 credit and still charges 150 plus 60', () => {
    const s = taught(), batchId = s.sunpriest.batches[0]!.id;
    for (let i = 1; i <= 4; i += 1) {
      apply(s, { type: 'MATERIAL_WORK', batchId });
      expect(s.sunpriest.batches[0]!.materials.every(m => m.holder === 'SUPPLIER')).toBe(true);
      expect(projectSunpriest(s).actions.find(a => a.id === `buy-${batchId}`)!.cost).toContain(`${i === 4 ? 150 : 1950}便士`);
    }
    rejected(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectSunpriest(s).actions.find(a => a.id === 'buy-sunpriest-batch-2')!.cost).toContain('1950便士');
    apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([9550, 34]);
    rejected(s, { type: 'MATERIAL_WORK', batchId }); expect(validateSunpriestState(s)).toBe(true);
  });

  it.each([1, 2, 3])('does not partially discount %i labour steps', steps => {
    const s = taught(), batchId = s.sunpriest.batches[0]!.id;
    for (let i = 0; i < steps; i += 1) apply(s, { type: 'MATERIAL_WORK', batchId });
    const cash = s.cash; apply(s, { type: 'BUY_MATERIALS', batchId }); expect(cash - s.cash).toBe(1950);
  });

  it('rejects missing money, missing materials, forged origin and cross-batch substitutions without mutation', () => {
    const s = lightprayer(); s.cash = 239; rejected(s, { type: 'LEARN_FORMULA' });
    s.cash = 10000; taught(s); const batchId = s.sunpriest.batches[0]!.id;
    rejected(s, { type: 'BREW', batchId }); rejected(s, { type: 'BUY_MATERIALS', batchId: 'sunpriest-batch-4' });
    s.cash = 1949; rejected(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 2009; apply(s, { type: 'BUY_MATERIALS', batchId }); rejected(s, { type: 'BREW', batchId });
    s.cash = 60; const material = s.sunpriest.batches[0]!.materials[0]!, source = material.source;
    material.source = 'invented'; rejected(s, { type: 'BREW', batchId });
    material.source = source; material.id = 'sunpriest-batch-2:dawn-rooster-red-comb'; rejected(s, { type: 'BREW', batchId });
    expect(validateSunpriestState(s)).toBe(false);
  });
});

describe('sunpriest promotion and recoverable outcomes', () => {
  it('allows early preparation but requires 100 digestion and eight complete weeks since S8', () => {
    const s = lightprayer(); s.week = 11; s.progression.acting = 0;
    taught(s); const bottle = brew(s); expect(validateSunpriestState(s)).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 18; s.progression.acting = 100;
    expect(projectSunpriest(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('7/8');
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 19; s.progression.acting = 99; rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.progression.acting = 100; s.actionsRemaining = 0; apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect([s.progression.promotionWeek, s.lightprayer.promotionWeek, s.sunpriest.promotionWeek, s.actionsRemaining]).toEqual([5, 11, 19, 0]);
  });

  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s with one will18 check and no death draw', (roll, tier, mindCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, ctx = context(s, roll);
    const inherited = JSON.stringify([s.bard, s.lightprayer]), actions = s.actionsRemaining, cash = s.cash;
    s.spirituality = 7; const chance = projectSunpriest(s).bottles[0]!.chance;
    applySunpriestCommand(s, { type: 'CONSUME', bottleId: s.sunpriest.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance });
    expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 18, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash, s.status]).toEqual([100 - mindCost, 100 - healthCost, pollution, 7, actions, cash, 'ACTIVE']);
    expect(s.sunpriest.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.progression.sequence, s.progression.acting, s.sunpriest.promotionWeek, s.sunpriest.lightprayerActingAtPromotion]).toEqual(success ? [7, 0, 19, 100] : [8, 100, null, null]);
    expect(JSON.stringify([s.bard, s.lightprayer])).toBe(inherited);
    expect(s.progression.mastery).toEqual(success ? { ...mastery, ...Object.fromEntries(SUNPRIEST_ABILITY_IDS.map(id => [id, 0])) } : mastery);
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 2, perception: stats.perception + 2, will: stats.will + 2, knowledge: stats.knowledge + 2 } : stats);
    expect(s.sunpriest.holyWater).toEqual({ prepared: 0, held: 0, used: 0 });
    expect(validateSunpriestState(s)).toBe(true); rejected(s, { type: 'CONSUME', bottleId: s.sunpriest.bottles[0]!.id, confirmed: true });
  });

  it('caps stats and pollution while preserving depletion, requiring recovery and preventing repeated stat grants', () => {
    const s = prepared(); s.health = 1; s.mind = 1; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: s.sunpriest.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-19, -39, 100, 'ACTIVE']);
    rejected(s, { type: 'BUY_MATERIALS', batchId: s.sunpriest.batches[1]!.id });
    expect(validateSunpriestState(s)).toBe(true);
    const good = prepared(); brew(good, 1);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) good.character.coreStats[stat] = 499;
    good.spirituality = 0; apply(good, { type: 'CONSUME', bottleId: good.sunpriest.bottles[0]!.id, confirmed: true }, 1);
    expect(Object.values(good.character.coreStats)).toEqual([500, 500, 500, 500]); expect(good.spirituality).toBe(0);
    rejected(good, { type: 'CONSUME', bottleId: good.sunpriest.bottles[1]!.id, confirmed: true });
    rejected(good, { type: 'BUY_MATERIALS', batchId: good.sunpriest.batches[2]!.id });
    expect(good.sunpriest.bottles[1]!.status).toBe('PREPARED'); expect(projectSunpriest(good).actions).toEqual([]);
    expect(validateSunpriestState(good)).toBe(true);
  });

  it.each([
    ['outside Backlund', (s: SliceState) => { s.world.city = 'ELSEWHERE'; }],
    ['dead run', (s: SliceState) => { s.status = 'DEAD'; }],
    ['ended run', (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }],
    ['event open', (s: SliceState) => { s.activeEvent = { id: 'test', instanceId: 'test' }; }],
    ['no health', (s: SliceState) => { s.health = 0; }],
    ['no mind', (s: SliceState) => { s.mind = 0; }],
  ])('rejects blocked consumption when %s', (_label, mutate) => {
    const s = prepared(); mutate(s); rejected(s, { type: 'CONSUME', bottleId: s.sunpriest.bottles[0]!.id, confirmed: true });
  });
});

describe('sunpriest resupply, validation and public boundaries', () => {
  it('preserves three failed batches and requires an action plus a real next week for three new full-cost batches', () => {
    const s = exhausted(), batches = JSON.stringify(s.sunpriest.batches), bottles = JSON.stringify(s.sunpriest.bottles);
    expect(new Set(s.sunpriest.bottles.flatMap(b => b.inputIds)).size).toBe(18);
    expect(projectSunpriest(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const cash = s.cash, actions = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.cash, s.actionsRemaining, s.sunpriest.resupply.requestedWeek]).toEqual([cash, actions - 1, 19]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateSunpriestState(s)).toBe(true);
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.sunpriest.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(s.sunpriest.batches).toHaveLength(6);
    expect(JSON.stringify(s.sunpriest.batches.slice(0, 3))).toBe(batches); expect(JSON.stringify(s.sunpriest.bottles)).toBe(bottles);
    expect(s.sunpriest.batches[3]).toMatchObject({ id: 'sunpriest-batch-4', labourSteps: 0, acquired: false, brewed: false });
    expect(projectSunpriest(s).actions.find(a => a.id === 'buy-sunpriest-batch-4')!.cost).toContain('1950便士');
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    expect(validateSunpriestState(clone(s))).toBe(true);
    s.mind = 100; const bottle = brew(s, 3); apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(s.sunpriest.promotionWeek).toBe(20); expect(validateSunpriestState(s)).toBe(true);
  });

  it('never refills automatically and rejects a request while any original remains or after success', () => {
    for (const s of [ordinary(), lightprayer(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 20; expect(s.sunpriest.batches).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('rejects corrupted identities, quantities, lineage, promotion chronology, mastery and holy-water conservation', () => {
    const s = promoted(); expect(validateSunpriestState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.sunpriest.batches[0]!.id = 'sunpriest-batch-2'; },
      x => { x.sunpriest.batches[0]!.labourSteps = 5; },
      x => { x.sunpriest.batches[0]!.acquired = false; },
      x => { x.sunpriest.batches[0]!.materials[0]!.quantity = 1; },
      x => { x.sunpriest.batches[0]!.materials[0]!.source = 'invented'; },
      x => { x.sunpriest.bottles[0]!.inputIds[0] = 'sunpriest-batch-2:dawn-rooster-red-comb'; },
      x => { x.sunpriest.bottles[0]!.brewedWeek = 20; },
      x => { x.sunpriest.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.sunpriest.bottles.push({ ...x.sunpriest.bottles[0]! }); },
      x => { x.sunpriest.promotionWeek = 18; },
      x => { x.sunpriest.lightprayerActingAtPromotion = 99; },
      x => { x.sunpriest.formulaKnown = false; },
      x => { x.sunpriest.resupply.deliveries = 1; },
      x => { delete x.progression.mastery[BARD_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[LIGHTPRAYER_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[SUNPRIEST_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[SUNPRIEST_ABILITY_IDS[0]] = 501; },
      x => { x.progression.mastery['sun.s6.notarization'] = 0; },
      x => { delete x.sunpriest.cases['water-preparation']; },
      x => { x.sunpriest.cases['water-preparation']!.attemptWeek = 18; },
      x => { x.sunpriest.cases['water-preparation']!.withdrawals = -1; },
      x => { x.sunpriest.holyWater.held = 1; },
      x => { x.sunpriest.holyWater.prepared = 2; x.sunpriest.holyWater.held = 2; },
    ];
    for (const mutate of mutations) { const broken = clone(s); mutate(broken); expect(validateSunpriestState(broken)).toBe(false); }
    s.sunpriest.holyWater = { prepared: 1, held: 1, used: 0 }; expect(validateSunpriestState(s)).toBe(true);
    s.sunpriest.holyWater = { prepared: 1, held: 0, used: 1 }; expect(validateSunpriestState(s)).toBe(true);
  });

  it('rejects malformed saved records without throwing and premature activities', () => {
    const s = ordinary();
    for (const value of [null, [], {}, { ...s.sunpriest, batches: [null, null, null] }, { ...s.sunpriest, cases: null }, { ...s.sunpriest, holyWater: null }]) {
      const broken = clone(s); broken.sunpriest = value as unknown as SliceState['sunpriest']; expect(validateSunpriestState(broken)).toBe(false);
    }
    for (const mutate of [
      (x: SliceState) => { x.sunpriest.formulaKnown = true; },
      (x: SliceState) => { x.sunpriest.reflected = true; },
      (x: SliceState) => { x.sunpriest.cases['water-preparation']!.status = 'OBSERVED'; },
      (x: SliceState) => { x.progression.mastery[SUNPRIEST_ABILITY_IDS[0]] = 0; },
      (x: SliceState) => { x.sunpriest.holyWater = { prepared: 1, held: 1, used: 0 }; },
    ]) { const broken = clone(s); mutate(broken); expect(validateSunpriestState(broken)).toBe(false); }
  });

  it('accepts only exact command shapes and finite case IDs/methods', () => {
    for (const command of [
      { type: 'LEARN_FORMULA' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'MATERIAL_WORK', batchId: 'sunpriest-batch-1' }, { type: 'BUY_MATERIALS', batchId: 'sunpriest-batch-99' },
      { type: 'BREW', batchId: 'sunpriest-batch-1' }, { type: 'CONSUME', bottleId: 'sunpriest-batch-1:bottle', confirmed: true },
      { type: 'REFLECT' }, ...SUNPRIEST_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PERFORM', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PREPARE', caseId, method: 'LIGHT' }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
      ]),
    ]) {
      expect(validateSunpriestCommand(command)).toBe(true);
      if (validateSunpriestCommand(command)) expect(isSunpriestAcquisitionCommand(command)).toBe(validateSunpriestAcquisitionCommand(command));
    }
    for (const command of [
      null, [], {}, { type: 'LEARN_GUIDANCE' }, { type: 'LEARN_FORMULA', free: true },
      { type: 'BUY_MATERIALS', batchId: 'sunpriest-batch-0' }, { type: 'BREW', batchId: 'sunpriest-batch-01' },
      { type: 'BUY_MATERIALS', batchId: 'sunpriest-batch-1000000000000000' },
      { type: 'CONSUME', bottleId: 'sunpriest-batch-1:bottle' },
      { type: 'CONSUME', bottleId: 'sunpriest-batch-1:bottle', confirmed: false },
      { type: 'CONSUME', bottleId: 'sunpriest-batch-1:bottle', confirmed: true, guaranteed: true },
      { type: 'OBSERVE', caseId: '__proto__' }, { type: 'PERFORM', caseId: 'water-preparation', reward: 100 },
      { type: 'PREPARE', caseId: 'water-preparation', method: 'ABILITY' }, { type: 'REFLECT', caseId: 'water-preparation' },
    ]) expect(validateSunpriestCommand(command)).toBe(false);
    const s = prepared(); rejected(s, { type: 'OBSERVE', caseId: 'water-preparation' }); rejected(s, { type: 'REFLECT' });
  });

  it('documents four G mastery groups without granting S6 notarization, revival or guaranteed high-pollution removal', () => {
    expect(SUNPRIEST_ABILITIES.map(a => a.id)).toEqual([...SUNPRIEST_ABILITY_IDS]);
    expect(SUNPRIEST_ABILITIES).toHaveLength(4);
    expect(SUNPRIEST_SOURCE_STATUS).toMatch(/光与火、恐惧免疫、神圣誓约、净化斩、太阳光环、神圣之光和制造圣水/);
    expect(SUNPRIEST_SOURCE_STATUS).toContain('本作将它们组合成四组掌握');
    expect(SUNPRIEST_SOURCE_STATUS).toContain('本阶段不提供序列6公证人的公证、复活或万能净化');
    expect(projectSunpriest(promoted()).abilities).toEqual(SUNPRIEST_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });
});
