import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyCultivatorCommand } from '../../src/domain/cultivator/index.js';
import { CULTIVATOR_ABILITY_IDS } from '../../src/domain/cultivator/types.js';
import {
  applyPhysicianCommand, createPhysicianState, isPhysicianAcquisitionCommand,
  projectPhysician, validatePhysicianCommand, validatePhysicianState,
} from '../../src/domain/physician/index.js';
import {
  PHYSICIAN_ABILITIES, PHYSICIAN_BOTTLE_IDS, PHYSICIAN_FORMULA_STATUS, PHYSICIAN_LABOUR_TASKS,
  PHYSICIAN_SOURCE_STATUS, PHYSICIAN_CONSUMPTION_RISK,
} from '../../src/domain/physician/content.js';
import { PHYSICIAN_ABILITY_IDS, PHYSICIAN_CASE_IDS, type PhysicianAcquisitionCommand, type PhysicianCommand } from '../../src/domain/physician/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('physician-acquisition', sliceDefaultCreationSelection, 'physician-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.physician = createPhysicianState();
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
function cultivator() {
  const s = ordinary(), c = context(s, 1).c;
  applyCultivatorCommand(s, { type: 'DISCOVER' }, c);
  applyCultivatorCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCultivatorCommand(s, { type: 'BUY_POTION', bottleId: s.cultivator.bottles[0]!.id }, c);
  applyCultivatorCommand(s, { type: 'CONSUME', bottleId: s.cultivator.bottles[0]!.id, confirmed: true }, c);
  // Acquisition isolation: the life suite owns the real S9 garden and digestion reports.
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries(CULTIVATOR_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: PhysicianAcquisitionCommand, roll = 20) { applyPhysicianCommand(s, command, context(s, roll).c); }
function taught(s = cultivator()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.physician.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of PHYSICIAN_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as PhysicianAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Acquisition owns originals, maturity and promotion. Life owns exact case transitions and actual CLOSE.
describe('Physician independent S8 acquisition', () => {
  it('starts with three separate G originals, untouched cases and no recipe', () => {
    const s = ordinary(), p = projectPhysician(s);
    expect(validatePhysicianState(s)).toBe(true);
    expect(s.physician.bottles.map(b => b.id)).toEqual([...PHYSICIAN_BOTTLE_IDS]);
    expect(s.physician.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.physician.cases)).toEqual([...PHYSICIAN_CASE_IDS]);
    expect(Object.values(s.physician.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.contactOpen && c.closes === 0)).toBe(true);
    expect(p).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    rejected(s, { type: 'LEARN_GUIDANCE' });
  });

  it('continues with the same original adult guide for180 and1AP without changing S9 history', () => {
    const s = cultivator(), old = JSON.stringify(s.cultivator), progression = JSON.stringify(s.progression), ctx = context(s);
    applyPhysicianCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.physician.guidanceKnown]).toEqual([9820, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的本作原创成年苗圃照料员伊芙·莫兰');
    expect(projectPhysician(s).supplies).toContain(PHYSICIAN_FORMULA_STATUS);
    expect(projectPhysician(s).risk).toContain(PHYSICIAN_CONSUMPTION_RISK);
    expect(JSON.stringify(s.cultivator)).toBe(old); expect(JSON.stringify(s.progression)).toBe(progression);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validatePhysicianState(s)).toBe(true);
  });

  it('requires exact bottle confirmation and does not let old bottles stand for new originals', () => {
    const s = prepared(), bottleId = PHYSICIAN_BOTTLE_IDS[0];
    for (const command of [
      { type: 'CONSUME', bottleId }, { type: 'CONSUME', bottleId, confirmed: false },
      { type: 'CONSUME', bottleId, confirmed: 'true' },
      { type: 'CONSUME', bottleId, confirmed: true, free: true },
      { type: 'CONSUME', bottleId: 'cultivator-potion-1', confirmed: true },
    ]) { expect(validatePhysicianCommand(command)).toBe(false); rejected(s, command); }
    rejected(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[1], confirmed: true });
    expect(s.physician.bottles[0]!.status).toBe('PLAYER');
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.progression.sequence).toBe(8);
  });

  it('delivers an original for1210 at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: PHYSICIAN_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.physician.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.physician.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validatePhysicianState(s)).toBe(true);
  });

  it('requires three real jobs per bottle before paying its remaining160', () => {
    const s = taught(), bottleId = PHYSICIAN_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 3; step += 1) {
      applyPhysicianCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.physician.bottles[0]!.labourSteps]).toEqual([9820, 38 - step, step + 1]);
      expect(projectPhysician(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(PHYSICIAN_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.physician.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 159; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 160; buy(s);
    expect([s.cash, s.actionsRemaining, s.physician.bottles[0]!.status]).toEqual([0, 36, 'PLAYER']);
  });

  it('allows early preparation but requires acting100 and four whole S9 weeks to consume', () => {
    const s = cultivator(); s.week = 5; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 8;
    rejected(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    apply(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.physician.promotionWeek]).toEqual([8, 5, 9]);
    expect(validatePhysicianState(s)).toBe(true);
  });

  it('blocks wrong channels, ended runs and both old and current open contacts atomically', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.cultivator.discovered = false; },
      s => { s.cultivator.guidanceKnown = false; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.cultivator.cases['shared-basket']!.contactOpen = true; },
      s => { s.physician.cases['unsafe-whisper']!.contactOpen = true; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
      expect(projectPhysician(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    }
    const s = cultivator(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: PHYSICIAN_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves four recoverable will12 tiers while preserving actual S9 mastery, history and resources', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify(s.cultivator), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectPhysician(s).bottles[0]!.chance;
      applyPhysicianCommand(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.physician.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['mother', success ? 8 : 9, 5, success ? 0 : 100]);
      expect([s.physician.promotionWeek, s.physician.cultivatorActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
      expect(JSON.stringify(s.cultivator)).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of CULTIVATOR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...CULTIVATOR_ABILITY_IDS, ...PHYSICIAN_ABILITY_IDS] : [...CULTIVATOR_ABILITY_IDS]);
      if (success) {
        for (const id of PHYSICIAN_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
        expect(projectSliceState(s).maxSpirituality).toBe(45);
      }
      expect(Object.values(s.physician.cases).every(c => !c.contactOpen && c.closes === 0)).toBe(true);
      expect(s.status).toBe('ACTIVE'); expect(validatePhysicianState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps attribute gains at500 and never grants higher-sequence abilities', () => {
    const s = prepared();
    Object.assign(s.character.coreStats, { physique: 500, perception: 499, will: 499, knowledge: 499 });
    apply(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(PHYSICIAN_ABILITY_IDS).toEqual(['mother.s8.limited-healing', 'mother.s8.condition-observation']);
    expect(projectPhysician(s).abilities).toEqual(PHYSICIAN_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });

  it('keeps severe rejection recoverable and requires restored health and mind before retry', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validatePhysicianState(s)).toBe(true);
    s.health = 100; s.mind = 100;
    apply(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[1], confirmed: true });
    expect(s.physician.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.physician.bottles[1]!.outcome).toBe('SUCCESS');
    expect(s.seer.pollution).toBe(100);
    expect(validatePhysicianState(s)).toBe(true);
  });

  it('retains held originals after promotion but forbids repeat acquisition', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true });
    expect(s.physician.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: PHYSICIAN_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: PHYSICIAN_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectPhysician(s).digestion).toContain('耕种者消化成果100/100已保留；医师扮演0/100');
    expect(validatePhysicianState(s)).toBe(true);
  });

  it('waits a real week after all failures before delivering three new payable originals', () => {
    const s = exhausted(), old = JSON.stringify(s.physician.bottles), s9 = JSON.stringify(s.cultivator), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.physician.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.physician.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validatePhysicianState(s)).toBe(true);
    s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.physician.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.physician.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify(s.cultivator)).toBe(s9);
    expect(s.physician.bottles.slice(3).map(b => b.id)).toEqual(['physician-potion-4', 'physician-potion-5', 'physician-potion-6']);
    expect(s.physician.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'physician-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'physician-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 160);
    apply(s, { type: 'CONSUME', bottleId: 'physician-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.physician.promotionWeek]).toEqual([5, 12]);
    expect(validatePhysicianState(s)).toBe(true);
  });

  it('does not refill automatically, supply before exhaustion or reuse old stock', () => {
    for (const s of [ordinary(), cultivator(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.physician.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    const supplied = resupplied(), old = JSON.stringify(supplied.physician.bottles.slice(0, 3));
    for (let i = 3; i < 6; i += 1) buy(supplied, i);
    for (let i = 3; i < 6; i += 1) { supplied.mind = 100; apply(supplied, { type: 'CONSUME', bottleId: supplied.physician.bottles[i]!.id, confirmed: true }, 80); }
    apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 13; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    expect(supplied.physician.bottles.map(b => b.id)).toEqual(Array.from({ length: 9 }, (_, i) => `physician-potion-${i + 1}`));
    expect(JSON.stringify(supplied.physician.bottles.slice(0, 3))).toBe(old);
    expect(validatePhysicianState(supplied)).toBe(true);
  });

  it('accepts exact commands and rejects fabricated promotion, bottle history and mastery', () => {
    const commands: PhysicianCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' }, { type: 'REFLECT' }, { type: 'BUY_KIT' },
      { type: 'POTION_WORK', bottleId: PHYSICIAN_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'physician-potion-99' },
      { type: 'CONSUME', bottleId: PHYSICIAN_BOTTLE_IDS[0], confirmed: true },
      ...PHYSICIAN_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'CLOSE', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['ABILITY', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validatePhysicianCommand(command)).toBe(true); if (!isPhysicianAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'PREPARE', caseId: 'unsafe-whisper', method: 'ATTEND' },
      { type: 'REPORT', caseId: 'unsafe-whisper', claim: 'CERTAIN' },
      { type: 'BUY_POTION', bottleId: 'physician-potion-01' },
    ]) expect(validatePhysicianCommand(command)).toBe(false);
    const valid = promoted();
    for (const change of [
      (s: SliceState) => { s.physician.cultivatorActingAtPromotion = 99; },
      (s: SliceState) => { s.physician.promotionWeek = 10; },
      (s: SliceState) => { s.physician.bottles[0]!.consumedWeek = 8; },
      (s: SliceState) => { s.physician.bottles[0]!.source = 'invented'; },
      (s: SliceState) => { delete s.progression.mastery[CULTIVATOR_ABILITY_IDS[0]]; },
      (s: SliceState) => { s.progression.mastery['mother.s7.plant-growth'] = 0; },
      (s: SliceState) => { s.physician.cases['unsafe-whisper']!.closes = -1; },
    ]) { const s = structuredClone(valid); change(s); expect(validatePhysicianState(s)).toBe(false); }
  });

  it('keeps verified chapter boundaries, G care and the wholly unknown recipe explicit', () => {
    for (const chapter of ['第三部第225章', '第三部第226章', '第二部第94章']) expect(PHYSICIAN_SOURCE_STATUS).toContain(chapter);
    for (const boundary of ['治疗牧师', '船上植物生长', '神父混杂失控', '巨龙相关神奇物品', '精确序列8治疗能力表', '本作原创G', '不复活', '不治愈污染', '序列7丰收祭司', '序列6生物学家']) expect(PHYSICIAN_SOURCE_STATUS).toContain(boundary);
    expect(PHYSICIAN_ABILITIES).toHaveLength(2);
    for (const fragment of ['完整配方尚未核实', '全部材料名称', '主辅分类', '数量与投料顺序', '不补造任何原料']) expect(PHYSICIAN_FORMULA_STATUS).toContain(fragment);
    expect(projectPhysician(promoted())).toMatchObject({ formulaKnown: false, formula: [], clinic: '' });
    const s = promoted(), c = s.physician.cases['unsafe-whisper']!;
    c.status = 'PREPARED'; c.method = 'ABILITY';
    expect(projectPhysician(s).insideCase).toBe(false);
    c.status = 'EXAMINED'; c.contactOpen = true;
    expect(projectPhysician(s).insideCase).toBe(true);
  });

  it('initializes real finite clinic stock without granting treatment on promotion', () => {
    const initial = { kitsBought: 0, dressings: 0, usedDressings: 0, patientHealth: 70, treated: false, referred: false };
    for (const s of [ordinary(), cultivator(), promoted()]) expect(s.physician.clinic).toEqual(initial);
    expect(validatePhysicianCommand({ type: 'BUY_KIT' })).toBe(true);
    expect(validatePhysicianCommand({ type: 'BUY_KIT', count: 3 })).toBe(false);
    expect(isPhysicianAcquisitionCommand({ type: 'BUY_KIT' })).toBe(false);
    rejected(promoted(), { type: 'BUY_KIT' });
  });

  it('rejects fabricated clinic stock and impossible health while leaving life history validation separate', () => {
    const valid = promoted();
    for (const change of [
      (s: SliceState) => { s.physician.clinic.dressings = 1; },
      (s: SliceState) => { s.physician.clinic.usedDressings = -1; },
      (s: SliceState) => { s.physician.clinic.kitsBought = 0.5; },
      (s: SliceState) => { s.physician.clinic.kitsBought = 2; s.physician.clinic.dressings = 6; },
      (s: SliceState) => { s.physician.clinic.patientHealth = 100; s.physician.clinic.treated = true; },
      (s: SliceState) => { s.physician.clinic.treated = true; },
      (s: SliceState) => { s.physician.clinic.patientHealth = 90; },
      (s: SliceState) => { Object.assign(s.physician.clinic, { invented: true }); },
    ]) { const s = structuredClone(valid); change(s); expect(validatePhysicianState(s)).toBe(false); }
    const stocked = structuredClone(valid);
    stocked.physician.clinic = { kitsBought: 2, dressings: 2, usedDressings: 4, patientHealth: 80, treated: true, referred: true };
    expect(validatePhysicianState(stocked)).toBe(true);
    const unpromoted = cultivator();
    unpromoted.physician.clinic = { kitsBought: 1, dressings: 3, usedDressings: 0, patientHealth: 70, treated: false, referred: false };
    expect(validatePhysicianState(unpromoted)).toBe(false);
  });
});
