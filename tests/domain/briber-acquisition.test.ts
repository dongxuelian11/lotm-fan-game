import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyLawyerCommand } from '../../src/domain/lawyer/index.js';
import { LAWYER_ABILITY_IDS } from '../../src/domain/lawyer/types.js';
import { applyBarbarianCommand } from '../../src/domain/barbarian/index.js';
import { BARBARIAN_ABILITY_IDS } from '../../src/domain/barbarian/types.js';
import {
  applyBriberCommand, createBriberState, isBriberAcquisitionCommand, projectBriber,
  validateBriberAcquisitionCommand, validateBriberCommand, validateBriberState,
} from '../../src/domain/briber/index.js';
import { BRIBER_ABILITIES, BRIBER_FORMULA, BRIBER_FORMULA_SOURCE, BRIBER_GUIDE, BRIBER_PRICES, BRIBER_SOURCE_STATUS } from '../../src/domain/briber/content.js';
import { BRIBER_ABILITY_IDS, BRIBER_CASE_IDS, type BriberAcquisitionCommand } from '../../src/domain/briber/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('briber-acquisition', sliceDefaultCreationSelection, 'briber-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.briber = createBriberState();
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
function barbarian(): SliceState {
  const s = ordinary(), c = context(s, 1).c;
  applyLawyerCommand(s, { type: 'DISCOVER' }, c);
  applyLawyerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyLawyerCommand(s, { type: 'BUY_POTION', bottleId: s.lawyer.bottles[0]!.id }, c);
  applyLawyerCommand(s, { type: 'CONSUME', bottleId: s.lawyer.bottles[0]!.id, confirmed: true }, c);
  s.week = 9; s.progression.acting = 100;
  applyBarbarianCommand(s, { type: 'LEARN_FORMULA' }, c);
  applyBarbarianCommand(s, { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-1' }, c);
  applyBarbarianCommand(s, { type: 'BREW', batchId: 'barbarian-batch-1' }, c);
  applyBarbarianCommand(s, { type: 'CONSUME', bottleId: 'barbarian-batch-1:bottle', confirmed: true }, c);
  s.week = 17; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS].map((id, i) => [id, 37 + i]));
  s.cash = 10000; s.health = 100; s.mind = 100; s.actionsRemaining = 40; s.character.coreStats.will = 25;
  return s;
}
function apply(s: SliceState, command: BriberAcquisitionCommand, roll = 20) { applyBriberCommand(s, command, context(s, roll).c); }
function taught(s = barbarian()) { apply(s, { type: 'LEARN_FORMULA' }); return s; }
function brew(s: SliceState, index = 0) {
  const batchId = s.briber.batches[index]!.id;
  apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
  return s.briber.bottles.at(-1)!;
}
function prepared() { const s = taught(); brew(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: s.briber.bottles[0]!.id, confirmed: true }); return s; }
function exhausted() { const s = taught(); for (let i = 0; i < 3; i += 1) apply(s, { type: 'CONSUME', bottleId: brew(s, i).id, confirmed: true }, 80); return s; }
const clone = (s: SliceState): SliceState => JSON.parse(JSON.stringify(s)) as SliceState;
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as BriberAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Briber exact formula and original batch acquisition', () => {
  it('initializes hidden independent three-batch stocks, inactive cases and no gifts', () => {
    const s = ordinary(), p = projectBriber(s);
    expect(validateBriberState(s)).toBe(true);
    expect([p.discovered, p.formulaKnown, p.promoted]).toEqual([false, false, false]);
    expect([p.formula, p.actions, p.bottles, p.abilities, p.cases]).toEqual([[], [], [], [], []]);
    expect(p.gifts).toEqual({ held: 0, given: 0, summary: '' });
    expect(p.supplies).toBe(''); expect(p.story).toBeUndefined();
    expect(JSON.stringify(p)).not.toMatch(/briber-batch|哭泣婴儿|怪脸大麻|1950/);
    rejected(s, { type: 'LEARN_FORMULA' });
    const other = createBriberState(); other.batches[0]!.materials[0]!.quantity = 0;
    other.cases['volunteered-test']!.contactOpen = true;
    expect(s.briber.batches[0]!.materials[0]!.quantity).toBe(1);
    expect(s.briber).toMatchObject({ gifts: [], giftPacks: 0, reflected: false });
    expect(s.briber.cases['volunteered-test']).toMatchObject({ status: 'AVAILABLE', contactOpen: false, closes: 0 });
  });

  it('requires S8 and the same original mentor channel', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.progression.sequence = 9; }, s => { s.progression.pathwayId = 'diviner'; },
      s => { s.lawyer.discovered = false; }, s => { s.lawyer.guidanceKnown = false; },
    ];
    for (const mutate of mutations) { const s = barbarian(); mutate(s); expect(projectBriber(s).actions).toEqual([]); rejected(s, { type: 'LEARN_FORMULA' }); }
  });

  it('charges 240 and one action for the six source ingredients without inventing crystal weight or order', () => {
    const s = barbarian(), inherited = JSON.stringify([s.lawyer, s.barbarian, s.progression]); taught(s);
    expect([s.cash, s.actionsRemaining]).toEqual([9760, 39]);
    expect(JSON.stringify([s.lawyer, s.barbarian, s.progression])).toBe(inherited);
    expect(projectBriber(s).formula).toEqual([
      { name: '“哭泣婴儿”花', quantity: 1, unit: '朵' },
      { name: '怪脸大麻结晶', quantity: null, unit: '', note: '原著未给明确数量或重量；本作G每批供货1份。' },
      { name: '金色曼陀罗汁', quantity: 5, unit: '滴' }, { name: '黑色曼陀罗汁', quantity: 5, unit: '滴' },
      { name: '迷幻草精油', quantity: 4, unit: '滴' }, { name: '红葡萄酒', quantity: 80, unit: 'mL' },
    ]);
    expect(BRIBER_FORMULA_SOURCE).toContain('第二部第131章《一掷千金》');
    expect(BRIBER_FORMULA_SOURCE).toContain('确切投料顺序未核定');
    expect(BRIBER_FORMULA_SOURCE).toContain('本作玩法改编G');
    expect(BRIBER_GUIDE).toBe('契约文书员米蕾·沃德');
    expect(validateBriberState(s)).toBe(true); rejected(s, { type: 'LEARN_FORMULA' });
  });

  it('charges 1950 plus 60, consuming exactly six original materials into one unique bottle', () => {
    const s = taught(), batch = s.briber.batches[0]!, actions = s.actionsRemaining;
    expect(batch.materials.map(m => m.quantity)).toEqual([1, 1, 5, 5, 4, 80]);
    expect(BRIBER_PRICES.mainMaterials + BRIBER_PRICES.auxiliaryMaterials + BRIBER_PRICES.brewing).toBe(2010);
    apply(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect([s.cash, s.actionsRemaining]).toEqual([7810, actions]);
    expect(batch.materials.every(m => m.holder === 'PLAYER')).toBe(true);
    const ctx = context(s); applyBriberCommand(s, { type: 'BREW', batchId: batch.id }, ctx.c);
    expect([s.cash, s.actionsRemaining]).toEqual([7750, actions - 1]);
    expect(batch.materials.every(m => m.quantity === 0 && m.holder === 'CONSUMED')).toBe(true);
    expect(s.briber.bottles[0]).toMatchObject({ id: 'briber-batch-1:bottle', batchId: batch.id, brewedWeek: 17, status: 'PREPARED', outcome: null });
    expect(s.briber.bottles[0]!.inputIds).toEqual(BRIBER_FORMULA.map(m => `${batch.id}:${m.id}`));
    expect(ctx.notes[0]!.text).toContain('具体操作次序采用本作G导师规程');
    expect(ctx.notes[0]!.text).toContain('怪脸大麻结晶的1份是本作G供货计量');
    rejected(s, { type: 'BREW', batchId: batch.id }); rejected(s, { type: 'BUY_MATERIALS', batchId: batch.id });
    expect(validateBriberState(s)).toBe(true);
  });

  it('requires four real per-batch labour actions for the 1800 credit and preserves the 150 plus 60 costs', () => {
    const s = taught(), batchId = s.briber.batches[0]!.id;
    for (let i = 1; i <= 4; i += 1) {
      apply(s, { type: 'MATERIAL_WORK', batchId });
      expect(s.briber.batches[0]!.materials.every(m => m.holder === 'SUPPLIER')).toBe(true);
      expect(projectBriber(s).actions.find(a => a.id === `buy-${batchId}`)!.cost).toContain(`${i === 4 ? 150 : 1950}便士`);
    }
    rejected(s, { type: 'MATERIAL_WORK', batchId });
    expect(projectBriber(s).actions.find(a => a.id === 'buy-briber-batch-2')!.cost).toContain('1950便士');
    apply(s, { type: 'BUY_MATERIALS', batchId }); apply(s, { type: 'BREW', batchId });
    expect([s.cash, s.actionsRemaining]).toEqual([9550, 34]);
    rejected(s, { type: 'MATERIAL_WORK', batchId }); expect(validateBriberState(s)).toBe(true);
    for (const steps of [1, 2, 3]) {
      const partial = taught(), id = partial.briber.batches[0]!.id;
      for (let i = 0; i < steps; i += 1) apply(partial, { type: 'MATERIAL_WORK', batchId: id });
      const cash = partial.cash; apply(partial, { type: 'BUY_MATERIALS', batchId: id }); expect(cash - partial.cash).toBe(1950);
    }
  });

  it('rejects missing funds, incomplete material quantities, forged origins and mixed batches without mutation', () => {
    const s = barbarian(); s.cash = 239; rejected(s, { type: 'LEARN_FORMULA' });
    s.cash = 10000; taught(s); const batchId = s.briber.batches[0]!.id;
    rejected(s, { type: 'BREW', batchId }); rejected(s, { type: 'BUY_MATERIALS', batchId: 'briber-batch-4' });
    s.cash = 1949; rejected(s, { type: 'BUY_MATERIALS', batchId });
    s.cash = 2009; apply(s, { type: 'BUY_MATERIALS', batchId }); rejected(s, { type: 'BREW', batchId });
    s.cash = 60; const material = s.briber.batches[0]!.materials[0]!, source = material.source;
    material.source = 'invented'; rejected(s, { type: 'BREW', batchId });
    material.source = source; material.quantity = 2; rejected(s, { type: 'BREW', batchId });
    material.quantity = 1; material.id = 'briber-batch-2:weeping-baby-flower'; rejected(s, { type: 'BREW', batchId });
    expect(validateBriberState(s)).toBe(false);
  });
});

describe('Briber promotion, failure and finite resupply', () => {
  it('allows preparation before maturity but gates consumption on S8 digestion and eight complete S8 weeks', () => {
    const s = barbarian(); s.week = 9; s.progression.acting = 0;
    taught(s); const bottle = brew(s); expect(validateBriberState(s)).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 16; s.progression.acting = 100;
    expect(projectBriber(s).actions.find(a => a.command.type === 'CONSUME')!.reason).toContain('7/8');
    rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.week = 17; s.progression.acting = 99; rejected(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    s.progression.acting = 100; s.actionsRemaining = 0; apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect([s.progression.promotionWeek, s.barbarian.promotionWeek, s.briber.promotionWeek, s.actionsRemaining]).toEqual([5, 9, 17, 0]);
  });

  it.each([
    [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
    [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
  ] as const)('resolves roll %i as %s with exactly one will18 check, preserving all five inherited abilities', (roll, tier, mindCost, healthCost, pollution, success) => {
    const s = prepared(), stats = { ...s.character.coreStats }, mastery = { ...s.progression.mastery }, ctx = context(s, roll);
    const inherited = JSON.stringify([s.lawyer, s.barbarian]), actions = s.actionsRemaining, cash = s.cash;
    s.spirituality = 7; const chance = projectBriber(s).bottles[0]!.chance;
    applyBriberCommand(s, { type: 'CONSUME', bottleId: s.briber.bottles[0]!.id, confirmed: true }, ctx.c);
    expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
    expect(s.lastCheck).toMatchObject({ tier, chance });
    expect(chance).toBe(computeCheckChance({ baseAbility: 25, difficulty: 18, modifiers: [] }));
    expect([s.mind, s.health, s.seer.pollution, s.spirituality, s.actionsRemaining, s.cash, s.status]).toEqual([100 - mindCost, 100 - healthCost, pollution, 7, actions, cash, 'ACTIVE']);
    expect(s.briber.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: tier });
    expect([s.progression.sequence, s.progression.acting, s.briber.promotionWeek, s.briber.barbarianActingAtPromotion]).toEqual(success ? [7, 0, 17, 100] : [8, 100, null, null]);
    expect(JSON.stringify([s.lawyer, s.barbarian])).toBe(inherited);
    expect(s.progression.mastery).toEqual(success ? { ...mastery, 'black-emperor.s7.bribery-weakening': 0 } : mastery);
    expect(s.character.coreStats).toEqual(success ? { physique: stats.physique + 1, perception: stats.perception + 1, will: stats.will + 1, knowledge: stats.knowledge + 1 } : stats);
    expect(s.briber.gifts).toEqual([]); expect(s.briber.giftPacks).toBe(0);
    expect(validateBriberState(s)).toBe(true); rejected(s, { type: 'CONSUME', bottleId: s.briber.bottles[0]!.id, confirmed: true });
  });

  it('caps stats and rejection pollution without refilling spirituality or granting promotion twice', () => {
    const s = prepared(); s.health = 1; s.mind = 1; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: s.briber.bottles[0]!.id, confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-19, -39, 100, 'ACTIVE']);
    expect(validateBriberState(s)).toBe(true);
    const good = prepared(); brew(good, 1);
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) good.character.coreStats[stat] = 499;
    good.spirituality = 0; apply(good, { type: 'CONSUME', bottleId: good.briber.bottles[0]!.id, confirmed: true }, 1);
    expect(good.character.coreStats).toEqual({ physique: 500, perception: 500, will: 500, knowledge: 500 }); expect(good.spirituality).toBe(0);
    rejected(good, { type: 'CONSUME', bottleId: good.briber.bottles[1]!.id, confirmed: true });
    rejected(good, { type: 'BUY_MATERIALS', batchId: good.briber.batches[2]!.id });
    expect(good.briber.bottles[1]!.status).toBe('PREPARED'); expect(projectBriber(good).actions).toEqual([]);
    expect(validateBriberState(good)).toBe(true);
  });

  it('requires closure of both inherited stages and respects event, health, city and run blocks', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.lawyer.cases['ambiguous-delivery']!.contactOpen = true; },
      s => { s.barbarian.cases['wedged-cart']!.contactOpen = true; },
      s => { s.briber.cases['volunteered-test']!.contactOpen = true; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; }, s => { s.health = 0; }, s => { s.mind = 0; },
    ];
    for (const mutate of mutations) { const s = prepared(); mutate(s); rejected(s, { type: 'CONSUME', bottleId: s.briber.bottles[0]!.id, confirmed: true }); }
  });

  it('preserves failed originals and requires one action and the next real week for three new full-cost batches', () => {
    const s = exhausted(), batches = JSON.stringify(s.briber.batches), bottles = JSON.stringify(s.briber.bottles);
    expect(new Set(s.briber.bottles.flatMap(b => b.inputIds)).size).toBe(18);
    expect(projectBriber(s).actions.map(a => a.command.type)).toEqual(['REQUEST_SUPPLY']);
    const cash = s.cash, actions = s.actionsRemaining; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.cash, s.actionsRemaining, s.briber.resupply.requestedWeek]).toEqual([cash, actions - 1, 17]);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' }); expect(validateBriberState(s)).toBe(true);
    s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.briber.resupply).toEqual({ requestedWeek: null, deliveries: 1 }); expect(s.briber.batches).toHaveLength(6);
    expect(JSON.stringify(s.briber.batches.slice(0, 3))).toBe(batches); expect(JSON.stringify(s.briber.bottles)).toBe(bottles);
    expect(s.briber.batches[3]).toMatchObject({ id: 'briber-batch-4', labourSteps: 0, acquired: false, brewed: false });
    expect(projectBriber(s).actions.find(a => a.id === 'buy-briber-batch-4')!.cost).toContain('1950便士');
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' }); expect(validateBriberState(clone(s))).toBe(true);
    s.mind = 100; const bottle = brew(s, 3); apply(s, { type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(s.briber.promotionWeek).toBe(18); expect(validateBriberState(s)).toBe(true);
  });

  it('never replenishes automatically, before all original bottles fail, or after promotion', () => {
    for (const s of [ordinary(), barbarian(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 20; expect(s.briber.batches).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });
});

describe('Briber strict records, commands and source boundaries', () => {
  it('rejects forged lineage, chronology, inherited mastery, over-credit and malformed records', () => {
    const s = promoted(); expect(validateBriberState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.briber.batches[0]!.id = 'briber-batch-2'; }, x => { x.briber.batches[0]!.labourSteps = 5; },
      x => { x.briber.batches[0]!.acquired = false; }, x => { x.briber.batches[0]!.materials[0]!.quantity = 1; },
      x => { x.briber.batches[0]!.materials[0]!.source = 'invented'; },
      x => { x.briber.bottles[0]!.inputIds[0] = 'briber-batch-2:weeping-baby-flower'; },
      x => { x.briber.bottles[0]!.brewedWeek = 18; }, x => { x.briber.bottles[0]!.outcome = 'FAILURE'; },
      x => { x.briber.bottles.push({ ...x.briber.bottles[0]! }); }, x => { x.briber.promotionWeek = 16; },
      x => { x.briber.barbarianActingAtPromotion = 99; }, x => { x.briber.formulaKnown = false; },
      x => { x.briber.resupply.deliveries = 1; }, x => { delete x.progression.mastery[LAWYER_ABILITY_IDS[0]]; },
      x => { delete x.progression.mastery[BARBARIAN_ABILITY_IDS[0]]; }, x => { delete x.progression.mastery[BRIBER_ABILITY_IDS[0]]; },
      x => { x.progression.mastery[BRIBER_ABILITY_IDS[0]] = 501; }, x => { x.progression.mastery['black-emperor.s6.distortion'] = 0; },
      x => { delete x.briber.cases['volunteered-test']; }, x => { x.briber.cases['volunteered-test']!.attemptWeek = 16; },
      x => { x.briber.cases['volunteered-test']!.closes = -1; }, x => { x.briber.cases['volunteered-test']!.method = 'ARGUMENT' as never; },
    ];
    for (const mutate of mutations) { const broken = clone(s); mutate(broken); expect(validateBriberState(broken)).toBe(false); }
    for (const value of [null, [], {}, { ...s.briber, batches: [null, null, null] }, { ...s.briber, bottles: [null] }, { ...s.briber, cases: null }, { ...s.briber, gifts: [null] }, { ...s.briber, giftPacks: -1 }]) {
      const broken = clone(s); broken.briber = value as unknown as SliceState['briber']; expect(validateBriberState(broken)).toBe(false);
    }
  });

  it('validates each numbered physical gift, pack conservation and irreversible destination records', () => {
    const s = promoted(); s.briber.giftPacks = 1;
    s.briber.gifts = [1, 2, 3].map(n => ({ id: `BR7-GIFT-${n}`, location: 'PLAYER', destination: null, givenWeek: null }));
    expect(validateBriberState(s)).toBe(true);
    s.briber.gifts[0] = { id: 'BR7-GIFT-1', location: 'GIVEN', destination: 'BATTLE:FIRST_CASE:GROUND', givenWeek: 17 };
    expect(validateBriberState(s)).toBe(true);
    const mutations: ((x: SliceState) => void)[] = [
      x => { x.briber.giftPacks = 2; }, x => { x.briber.gifts[1]!.id = 'BR7-GIFT-1'; },
      x => { x.briber.gifts[0]!.givenWeek = 16; }, x => { x.briber.gifts[0]!.givenWeek = 18; },
      x => { x.briber.gifts[0]!.destination = null; }, x => { x.briber.gifts[0]!.location = 'PLAYER'; },
      x => { x.briber.gifts[1]!.givenWeek = 17; },
    ];
    for (const mutate of mutations) { const broken = clone(s); mutate(broken); expect(validateBriberState(broken)).toBe(false); }
    const early = barbarian(); early.briber.giftPacks = 1; early.briber.gifts = clone(s).briber.gifts;
    expect(validateBriberState(early)).toBe(false);
  });

  it('accepts only exact finite commands and routes BUY_GIFTS away from acquisition', () => {
    for (const command of [
      { type: 'LEARN_FORMULA' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'MATERIAL_WORK', batchId: 'briber-batch-1' }, { type: 'BUY_MATERIALS', batchId: 'briber-batch-99' },
      { type: 'BREW', batchId: 'briber-batch-1' }, { type: 'CONSUME', bottleId: 'briber-batch-1:bottle', confirmed: true },
      { type: 'REFLECT' }, { type: 'BUY_GIFTS' }, ...BRIBER_CASE_IDS.flatMap(caseId => [
        { type: 'OBSERVE', caseId }, { type: 'PERFORM', caseId }, { type: 'CLOSE', caseId }, { type: 'REPORT', caseId }, { type: 'WITHDRAW', caseId },
        { type: 'PREPARE', caseId, method: 'ABILITY' }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
      ]),
    ]) {
      expect(validateBriberCommand(command)).toBe(true);
      if (validateBriberCommand(command)) expect(isBriberAcquisitionCommand(command)).toBe(validateBriberAcquisitionCommand(command));
    }
    for (const command of [
      null, [], {}, { type: 'LEARN_GUIDANCE' }, { type: 'LEARN_FORMULA', free: true }, { type: 'BUY_GIFTS', count: 3 },
      { type: 'BUY_MATERIALS', batchId: 'briber-batch-0' }, { type: 'BREW', batchId: 'briber-batch-01' },
      { type: 'BUY_MATERIALS', batchId: 'briber-batch-1000000000000000' },
      { type: 'CONSUME', bottleId: 'briber-batch-1:bottle' }, { type: 'CONSUME', bottleId: 'briber-batch-1:bottle', confirmed: false },
      { type: 'CONSUME', bottleId: 'briber-batch-1:bottle', confirmed: true, guaranteed: true },
      { type: 'OBSERVE', caseId: '__proto__' }, { type: 'PERFORM', caseId: 'volunteered-test', reward: 100 },
      { type: 'PREPARE', caseId: 'volunteered-test', method: 'LIGHT' }, { type: 'REFLECT', caseId: 'volunteered-test' },
    ]) expect(validateBriberCommand(command)).toBe(false);
    const s = prepared(); rejected(s, { type: 'BUY_GIFTS' }); rejected(s, { type: 'OBSERVE', caseId: 'volunteered-test' });
  });

  it('adds only weakening, distinguishes source giving from catching and leaves higher sequences out', () => {
    expect(BRIBER_ABILITIES.map(a => a.id)).toEqual(['black-emperor.s7.bribery-weakening']);
    expect(BRIBER_SOURCE_STATUS).toContain('第三部第117章');
    expect(BRIBER_SOURCE_STATUS).toContain('攻击、防御与控制');
    expect(BRIBER_SOURCE_STATUS).toContain('酒杯被躲开仍产生削弱');
    expect(BRIBER_SOURCE_STATUS).toContain('不能把目标接住物品或喝下酒液写成原著必需条件');
    expect(BRIBER_SOURCE_STATUS).toContain('序列6扭曲'); expect(BRIBER_SOURCE_STATUS).toContain('序列5混乱');
    expect(BRIBER_SOURCE_STATUS).toContain('本作玩法G');
    expect(projectBriber(promoted()).abilities).toEqual(BRIBER_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });
});
