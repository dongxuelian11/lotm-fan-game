import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyCultivatorCommand } from '../../src/domain/cultivator/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../../src/domain/cultivator/types.js';
import { applyPhysicianCommand } from '../../src/domain/physician/index.js';
import { PHYSICIAN_ABILITY_IDS } from '../../src/domain/physician/types.js';
import {
  applyHarvestpriestCommand, createHarvestpriestState, isHarvestpriestAcquisitionCommand,
  projectHarvestpriest, validateHarvestpriestCommand, validateHarvestpriestState,
} from '../../src/domain/harvestpriest/index.js';
import {
  HARVESTPRIEST_ABILITIES, HARVESTPRIEST_BOTTLE_IDS, HARVESTPRIEST_CONSUMPTION_RISK, HARVESTPRIEST_FORMULA_STATUS,
  HARVESTPRIEST_LABOUR_TASKS, HARVESTPRIEST_SOURCE_STATUS,
} from '../../src/domain/harvestpriest/content.js';
import { HARVESTPRIEST_ABILITY_IDS, HARVESTPRIEST_CASE_IDS, type HarvestpriestAcquisitionCommand, type HarvestpriestCommand } from '../../src/domain/harvestpriest/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

const OLD_IDS = [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS];
function ordinary(): SliceState {
  const s = createSliceRun('harvestpriest-acquisition', sliceDefaultCreationSelection, 'harvestpriest-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 20000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 18;
  s.harvestpriest = createHarvestpriestState();
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
      s.lastCheck = result; return result;
    },
    note(title, text) { notes.push({ title, text }); },
  };
  return { c, checks, draws, notes };
}
/** Real prior bottles and promotion weeks; completed earlier acting is an acquisition fixture. */
function physician() {
  const s = ordinary(), c = context(s, 1).c;
  applyCultivatorCommand(s, { type: 'DISCOVER' }, c);
  applyCultivatorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCultivatorCommand(s, { type: 'BUY_POTION', bottleId: s.cultivator.bottles[0]!.id }, c);
  applyCultivatorCommand(s, { type: 'CONSUME', bottleId: s.cultivator.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100; s.week = 11;
  applyPhysicianCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPhysicianCommand(s, { type: 'BUY_POTION', bottleId: s.physician.bottles[0]!.id }, c);
  applyPhysicianCommand(s, { type: 'CONSUME', bottleId: s.physician.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries(OLD_IDS.map((id, index) => [id, index * 25]));
  s.week = 19; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 18;
  return s;
}
function apply(s: SliceState, command: HarvestpriestAcquisitionCommand, roll = 20) { applyHarvestpriestCommand(s, command, context(s, roll).c); }
function taught(s = physician()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.harvestpriest.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of HARVESTPRIEST_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as HarvestpriestAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Acquisition owns bottle identity, maturity and promotion; life owns actual plot care, finite distribution and CLOSE.
describe('Harvestpriest independent S7 acquisition', () => {
  it('starts with three separate original bottles, untouched cases and no known recipe', () => {
    const s = ordinary(), p = projectHarvestpriest(s);
    expect(validateHarvestpriestState(s)).toBe(true);
    expect(s.harvestpriest.bottles.map(b => b.id)).toEqual([...HARVESTPRIEST_BOTTLE_IDS]);
    expect(s.harvestpriest.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.harvestpriest.cases)).toEqual([...HARVESTPRIEST_CASE_IDS]);
    expect(s.harvestpriest.plot).toEqual({ waterPacks: 0, water: 0, waterUsed: 0, careWeek: null, harvestWeek: null, produce: 0, delivered: 0, planRecorded: false });
    expect(Object.values(s.harvestpriest.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.contactOpen && c.closes === 0)).toBe(true);
    expect(p).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('continues the same adult guide for240 and1AP without rewriting either earlier stage', () => {
    const s = physician(), prior = JSON.stringify([s.cultivator, s.physician, s.progression]), ctx = context(s);
    applyHarvestpriestCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.harvestpriest.guidanceKnown]).toEqual([9760, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的本作原创成年苗圃照料员伊芙·莫兰');
    expect(projectHarvestpriest(s).supplies).toContain(HARVESTPRIEST_FORMULA_STATUS);
    expect(projectHarvestpriest(s).risk).toContain(HARVESTPRIEST_CONSUMPTION_RISK);
    expect(JSON.stringify([s.cultivator, s.physician, s.progression])).toBe(prior);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateHarvestpriestState(s)).toBe(true);
  });

  it('requires confirmation for the exact owned S7 original, never an earlier bottle', () => {
    const s = prepared(), bottleId = HARVESTPRIEST_BOTTLE_IDS[0];
    for (const command of [
      { type: 'CONSUME', bottleId }, { type: 'CONSUME', bottleId, confirmed: false },
      { type: 'CONSUME', bottleId, confirmed: 'true' },
      { type: 'CONSUME', bottleId: 'cultivator-potion-1', confirmed: true },
      { type: 'CONSUME', bottleId: 'physician-potion-1', confirmed: true },
    ]) { expect(validateHarvestpriestCommand(command)).toBe(false); rejected(s, command); }
    rejected(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[1], confirmed: true });
    expect(s.harvestpriest.bottles[0]!.status).toBe('PLAYER');
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.progression.sequence).toBe(7);
  });

  it('charges2010 at zero AP and does not partially redeem unfinished jobs', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: HARVESTPRIEST_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.harvestpriest.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 2010, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 19, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.harvestpriest.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateHarvestpriestState(s)).toBe(true);
  });

  it('requires four separate jobs for this bottle before paying its remaining210', () => {
    const s = taught(), bottleId = HARVESTPRIEST_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 4; step += 1) {
      applyHarvestpriestCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.harvestpriest.bottles[0]!.labourSteps]).toEqual([9760, 38 - step, step + 1]);
      expect(projectHarvestpriest(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(HARVESTPRIEST_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.harvestpriest.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, s.harvestpriest.bottles[0]!.status]).toEqual([0, 35, 'PLAYER']);
  });

  it('permits preparation early but counts eight full weeks from Physician promotion', () => {
    const s = physician(); s.week = 11; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 18;
    expect(s.progression.promotionWeek).toBe(5);
    expect(s.physician.promotionWeek).toBe(11);
    rejected(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
    s.week = 19; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    apply(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.physician.promotionWeek, s.harvestpriest.promotionWeek]).toEqual([7, 5, 11, 19]);
    expect(validateHarvestpriestState(s)).toBe(true);
  });

  it('blocks all three open contacts, lost channels and unavailable actions without spending', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.cultivator.cases['soil-record']!.contactOpen = true; },
      s => { s.physician.cases['minor-cut']!.contactOpen = true; },
      s => { s.harvestpriest.cases['wilting-bed']!.contactOpen = true; },
      s => { s.physician.guidanceKnown = false; }, s => { s.cultivator.discovered = false; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
      expect(projectHarvestpriest(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    }
    const s = physician(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: HARVESTPRIEST_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves the four will18 tiers and preserves five old IDs, histories and current spirit', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, prior = JSON.stringify([s.cultivator, s.physician]), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectHarvestpriest(s).bottles[0]!.chance;
      applyHarvestpriestCommand(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 18, difficulty: 18, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.harvestpriest.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 19, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['mother', success ? 7 : 8, 5, success ? 0 : 100]);
      expect([s.harvestpriest.promotionWeek, s.harvestpriest.physicianActingAtPromotion]).toEqual(success ? [19, 100] : [null, null]);
      expect(JSON.stringify([s.cultivator, s.physician])).toBe(prior); expect(s.seer.completedSources).toEqual(sources);
      for (const id of OLD_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...OLD_IDS, ...HARVESTPRIEST_ABILITY_IDS] : OLD_IDS);
      if (success) {
        for (const id of HARVESTPRIEST_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
        expect(projectSliceState(s).maxSpirituality).toBe(60);
      }
      expect(Object.values(s.harvestpriest.cases).every(c => !c.contactOpen && c.closes === 0)).toBe(true);
      expect(s.status).toBe('ACTIVE'); expect(validateHarvestpriestState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps gains at500 and exposes both limited S7 abilities without higher powers', () => {
    const s = prepared(); Object.assign(s.character.coreStats, { physique: 499, perception: 499, will: 499, knowledge: 499 });
    apply(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(HARVESTPRIEST_ABILITY_IDS).toEqual(['mother.s7.harvest-care', 'mother.s7.life-support']);
    expect(projectHarvestpriest(s).abilities).toEqual(HARVESTPRIEST_ABILITIES.map(a => ({ ...a, mastery: 0 })));
    expect(projectHarvestpriest(s)).toMatchObject({ formulaKnown: false, formula: [], cases: [] });
    for (const boundary of ['第三部第225章', '仅核实序列7名称', '丰收照料', '生命支持', '序列6生物学家的杂交改造', '生命手杖', '明确允许', '六株已接近采收期的原菜苗', '一次有限三份收成', '下一真实周', '本作原创G']) expect(HARVESTPRIEST_SOURCE_STATUS).toContain(boundary);
    for (const fragment of ['完整配方尚未核实', '全部材料名称', '主辅分类', '数量与投料顺序', '配方列表保持空且未知', '不补造任何原料', '30便士购买的2份普通灌溉水']) expect(HARVESTPRIEST_FORMULA_STATUS).toContain(fragment);
    expect(HARVESTPRIEST_ABILITIES[1]!.description).toContain('不保证治疗失控');
  });

  it('keeps severe guided rejection recoverable and requires rest plus another original', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([8, 100]);
    expect(validateHarvestpriestState(s)).toBe(true);
    s.health = 100; s.mind = 100;
    apply(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[1], confirmed: true });
    expect(s.harvestpriest.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.harvestpriest.bottles[1]!.outcome).toBe('SUCCESS');
    expect(s.seer.pollution).toBe(100);
    expect(validateHarvestpriestState(s)).toBe(true);
  });

  it('retains held originals after promotion while closing further acquisition', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true });
    expect(s.harvestpriest.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: HARVESTPRIEST_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: HARVESTPRIEST_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectHarvestpriest(s).digestion).toContain('医师消化成果100/100已保留；丰收祭司扮演0/100');
    expect(validateHarvestpriestState(s)).toBe(true);
  });

  it('waits a real week after exhaustion and delivers three separate payable originals', () => {
    const s = exhausted(), old = JSON.stringify(s.harvestpriest.bottles), prior = JSON.stringify([s.cultivator, s.physician]), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.harvestpriest.resupply.requestedWeek]).toEqual([0, cash, 19]);
    expect(s.harvestpriest.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateHarvestpriestState(s)).toBe(true);
    s.week = 20; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.harvestpriest.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.harvestpriest.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify([s.cultivator, s.physician])).toBe(prior);
    expect(s.harvestpriest.bottles.slice(3).map(b => b.id)).toEqual(['harvestpriest-potion-4', 'harvestpriest-potion-5', 'harvestpriest-potion-6']);
    expect(s.harvestpriest.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第20周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'harvestpriest-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'harvestpriest-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 210);
    apply(s, { type: 'CONSUME', bottleId: 'harvestpriest-potion-4', confirmed: true });
    expect([s.physician.promotionWeek, s.harvestpriest.promotionWeek]).toEqual([11, 20]);
    expect(validateHarvestpriestState(s)).toBe(true);
  });

  it('never refills automatically or lets existing originals coexist with a new batch', () => {
    for (const s of [ordinary(), physician(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.harvestpriest.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' }); s.week += 1; apply(s, { type: 'RECEIVE_SUPPLY' });
    rejected(s, { type: 'REQUEST_SUPPLY' });
    expect(s.harvestpriest.bottles).toHaveLength(6);
    expect(validateHarvestpriestState(s)).toBe(true);
  });

  it('accepts exact acquisition and finite plot commands without formula or higher abilities', () => {
    const commands: HarvestpriestCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' }, { type: 'BUY_WATER' }, { type: 'HARVEST' },
      { type: 'POTION_WORK', bottleId: HARVESTPRIEST_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'harvestpriest-potion-99' },
      { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true },
      ...HARVESTPRIEST_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['ABILITY', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) {
      expect(validateHarvestpriestCommand(command)).toBe(true);
      if (!isHarvestpriestAcquisitionCommand(command)) rejected(prepared(), command);
    }
    for (const command of [
      { type: 'LEARN_FORMULA' }, { type: 'BREW' }, { type: 'HYBRIDIZE' }, { type: 'REGROW' }, { type: 'CONTROL_WEATHER' },
      { type: 'PREPARE', caseId: 'wilting-bed', method: 'HYBRIDIZE' },
      { type: 'PERFORM', caseId: 'wilting-bed', unlimitedYield: true },
      { type: 'CONSUME', bottleId: HARVESTPRIEST_BOTTLE_IDS[0], confirmed: true, free: true },
      { type: 'BUY_POTION', bottleId: 'harvestpriest-potion-01' },
      { type: 'BUY_WATER', quantity: 2 }, { type: 'HARVEST', caseId: 'wilting-bed' },
      { type: 'BUY_WATER', free: true }, { type: 'HARVEST', regrow: true },
    ]) expect(validateHarvestpriestCommand(command)).toBe(false);
  });

  it('validates prior promotion provenance, exact mastery and case shape', () => {
    const valid = promoted();
    for (const change of [
      (s: SliceState) => { s.harvestpriest.physicianActingAtPromotion = 99; },
      (s: SliceState) => { s.harvestpriest.promotionWeek = 18; },
      (s: SliceState) => { s.harvestpriest.bottles[0]!.consumedWeek = 18; },
      (s: SliceState) => { s.harvestpriest.bottles[0]!.source = 'converted physician bottle'; },
      (s: SliceState) => { delete s.progression.mastery[PHYSICIAN_ABILITY_IDS[0]]; },
      (s: SliceState) => { delete s.progression.mastery[CULTIVATOR_ABILITY_IDS[0]]; },
      (s: SliceState) => { s.progression.mastery['mother.s6.crossbreeding'] = 0; },
      (s: SliceState) => { s.harvestpriest.cases['wilting-bed']!.closes = -1; },
      (s: SliceState) => { s.harvestpriest.cases['wilting-bed']!.attemptWeek = 18; },
      (s: SliceState) => { Object.assign(s.harvestpriest, { cultivatorActingAtPromotion: 100 }); },
      (s: SliceState) => { Object.assign(s.harvestpriest.cases['wilting-bed']!, { unlimitedYield: true }); },
    ]) { const s = structuredClone(valid); change(s); expect(validateHarvestpriestState(s)).toBe(false); }
    const r = valid.harvestpriest.cases['wilting-bed']!;
    Object.assign(r, { status: 'EXAMINED', attemptWeek: 19, method: 'ABILITY', outcome: 'BED_SUPPORTED', contactOpen: true });
    expect(validateHarvestpriestState(valid)).toBe(true);
    expect(projectHarvestpriest(valid).insideCase).toBe(true);
    r.contactOpen = false; r.closes = 1;
    expect(validateHarvestpriestState(valid)).toBe(true);
    expect(projectHarvestpriest(valid).insideCase).toBe(false);
  });

  it('rejects forged supply provenance, chronology and malformed records without throwing', () => {
    const supplied = exhausted();
    apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 20;
    apply(supplied, { type: 'RECEIVE_SUPPLY' });
    for (const change of [
      (s: SliceState) => { s.harvestpriest.bottles[3]!.source = s.harvestpriest.bottles[0]!.source; },
      (s: SliceState) => { s.harvestpriest.bottles[3]!.labourSteps = 5; },
      (s: SliceState) => { s.harvestpriest.bottles[3]!.id = 'harvestpriest-potion-1'; },
      (s: SliceState) => { s.harvestpriest.bottles[0]!.consumedWeek = 20; },
      (s: SliceState) => { s.harvestpriest.resupply.deliveries = 0; },
      (s: SliceState) => { s.harvestpriest.resupply.requestedWeek = 20; },
      (s: SliceState) => { s.harvestpriest.bottles[0] = null as never; },
      (s: SliceState) => { s.harvestpriest.cases['wilting-bed'] = null as never; },
      (s: SliceState) => { s.harvestpriest.reflected = true; },
    ]) {
      const s = structuredClone(supplied); change(s);
      expect(() => validateHarvestpriestState(s)).not.toThrow();
      expect(validateHarvestpriestState(s)).toBe(false);
    }
    expect(validateHarvestpriestState(supplied)).toBe(true);
  });
  it('keeps plot stock conserved, production finite and harvest chronology bounded', () => {
    const valid = promoted(); valid.week = 20;
    Object.assign(valid.harvestpriest.plot, { waterPacks: 1, water: 1, waterUsed: 1, careWeek: 19, harvestWeek: 20, produce: 2, delivered: 1 });
    expect(validateHarvestpriestState(valid)).toBe(true);
    for (const change of [
      (s: SliceState) => { s.harvestpriest.plot.waterPacks = -1; },
      (s: SliceState) => { s.harvestpriest.plot.water = 2; },
      (s: SliceState) => { s.harvestpriest.plot.water = -1; },
      (s: SliceState) => { s.harvestpriest.plot.waterUsed = 0.5; },
      (s: SliceState) => { s.harvestpriest.plot.produce = 3; },
      (s: SliceState) => { s.harvestpriest.plot.delivered = 4; },
      (s: SliceState) => { s.harvestpriest.plot.careWeek = 18; },
      (s: SliceState) => { s.harvestpriest.plot.careWeek = null; },
      (s: SliceState) => { s.harvestpriest.plot.harvestWeek = 19; },
      (s: SliceState) => { s.harvestpriest.plot.harvestWeek = 21; },
      (s: SliceState) => { s.harvestpriest.plot.harvestWeek = null; },
      (s: SliceState) => { s.harvestpriest.plot.planRecorded = 'yes' as never; },
      (s: SliceState) => { Object.assign(s.harvestpriest.plot, { plants: 12 }); },
      (s: SliceState) => { s.harvestpriest.plot = null as never; },
    ]) {
      const s = structuredClone(valid); change(s);
      expect(() => validateHarvestpriestState(s)).not.toThrow();
      expect(validateHarvestpriestState(s)).toBe(false);
    }
    const untouched = prepared(); untouched.harvestpriest.plot.waterPacks = 1; untouched.harvestpriest.plot.water = 2;
    expect(validateHarvestpriestState(untouched)).toBe(false);
  });

});
