import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyPryerCommand } from '../../src/domain/pryer/index.js';
import { applyPryerActivity } from '../../src/domain/pryer/life.js';
import { PRYER_ABILITY_IDS, PRYER_CASE_IDS } from '../../src/domain/pryer/types.js';
import {
  applyCombatScholarCommand, createCombatScholarState, isCombatScholarAcquisitionCommand,
  projectCombatScholar, validateCombatScholarCommand, validateCombatScholarState,
} from '../../src/domain/combat-scholar/index.js';
import {
  COMBAT_SCHOLAR_ABILITIES, COMBAT_SCHOLAR_BOTTLE_IDS, COMBAT_SCHOLAR_FORMULA_STATUS,
  COMBAT_SCHOLAR_LABOUR_TASKS, COMBAT_SCHOLAR_SOURCE_STATUS,
} from '../../src/domain/combat-scholar/content.js';
import {
  COMBAT_SCHOLAR_ABILITY_IDS, COMBAT_SCHOLAR_CASE_IDS,
  type CombatScholarAcquisitionCommand, type CombatScholarCommand,
} from '../../src/domain/combat-scholar/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('combat-scholar-acquisition', sliceDefaultCreationSelection, 'scholar-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.combatScholar = createCombatScholarState();
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
function pryer() {
  const s = ordinary(), c = context(s, 1).c;
  applyPryerCommand(s, { type: 'DISCOVER' }, c);
  applyPryerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPryerCommand(s, { type: 'BUY_POTION', bottleId: s.pryer.bottles[0]!.id }, c);
  applyPryerCommand(s, { type: 'CONSUME', bottleId: s.pryer.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[PRYER_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of PRYER_CASE_IDS) {
    applyPryerActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyPryerActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applyPryerActivity(s, { type: 'PERFORM', caseId }, c, award);
    if (caseId === 'intrusive-page') applyPryerActivity(s, { type: 'CLOSE', caseId }, c, award);
    applyPryerActivity(s, { type: 'REPORT', caseId, claim: 'LIMITED' }, c, award);
  }
  applyPryerActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(PRYER_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: CombatScholarAcquisitionCommand, roll = 20) {
  applyCombatScholarCommand(s, command, context(s, roll).c);
}
function taught(s = pryer()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.combatScholar.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of COMBAT_SCHOLAR_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as CombatScholarAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Focused acquisition coverage. Life owns exact case transitions and real STOP behavior.
describe('Combat Scholar independent S8 acquisition', () => {
  it('starts with three separate G originals and locked cases, without a formula', () => {
    const s = ordinary(), projection = projectCombatScholar(s);
    expect(validateCombatScholarState(s)).toBe(true);
    expect(s.combatScholar.bottles.map(b => b.id)).toEqual([...COMBAT_SCHOLAR_BOTTLE_IDS]);
    expect(s.combatScholar.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.combatScholar.cases)).toEqual([...COMBAT_SCHOLAR_CASE_IDS]);
    expect(Object.values(s.combatScholar.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.exerciseOpen)).toBe(true);
    expect(projection).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    const other = createCombatScholarState(); other.bottles[0]!.labourSteps = 1;
    expect(s.combatScholar.bottles[0]!.labourSteps).toBe(0);
  });

  it('uses Lina’s introduction and charges 180 pence plus one AP for guidance only', () => {
    const s = pryer(), before = JSON.stringify(s.pryer), progression = JSON.stringify(s.progression), ctx = context(s);
    rejected(s, { type: 'BUY_POTION', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0] });
    applyCombatScholarCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.combatScholar.guidanceKnown]).toEqual([9820, 39, true]);
    expect(ctx.notes[0]!.text).toContain('经莉奈·安瑟介绍');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(ctx.notes[0]!.text).toContain('塔文·里德');
    expect(projectCombatScholar(s).supplies).toContain(COMBAT_SCHOLAR_FORMULA_STATUS);
    expect(JSON.stringify(s.pryer)).toBe(before);
    expect(JSON.stringify(s.progression)).toBe(progression);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateCombatScholarState(s)).toBe(true);
  });

  it('delivers an original for 1210 pence at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.combatScholar.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.combatScholar.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateCombatScholarState(s)).toBe(true);
  });

  it('requires three real jobs per bottle before paying the remaining 160 pence', () => {
    const s = taught(), bottleId = COMBAT_SCHOLAR_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 3; step += 1) {
      applyCombatScholarCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.combatScholar.bottles[0]!.labourSteps]).toEqual([9820, 38 - step, step + 1]);
      expect(projectCombatScholar(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(COMBAT_SCHOLAR_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.combatScholar.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 159; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 160; buy(s);
    expect([s.cash, s.actionsRemaining, s.combatScholar.bottles[0]!.status]).toEqual([0, 36, 'PLAYER']);
  });

  it('allows early preparation but requires acting100, four whole S9 weeks and confirmation', () => {
    const s = pryer(); s.week = 5; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 8;
    rejected(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.combatScholar.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateCombatScholarState(s)).toBe(true);
  });

  it('blocks unavailable channels, ended runs, blockers and unrestored health without mutation', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.pryer.discovered = false; },
      s => { s.pryer.guidanceKnown = false; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.pryer.cases['intrusive-page']!.readingOpen = true; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true }); }
    const s = pryer(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves all four tiers with one will12 check, no death draw, and unchanged S9 history', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify(s.pryer), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectCombatScholar(s).bottles[0]!.chance;
      applyCombatScholarCommand(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.combatScholar.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['hermit', success ? 8 : 9, 5, success ? 0 : 100]);
      expect([s.combatScholar.promotionWeek, s.combatScholar.pryerActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
      expect(JSON.stringify(s.pryer)).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of PRYER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 1], ['knowledge', 0]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...PRYER_ABILITY_IDS, ...COMBAT_SCHOLAR_ABILITY_IDS] : [...PRYER_ABILITY_IDS]);
      if (success) { expect(s.progression.mastery[COMBAT_SCHOLAR_ABILITY_IDS[0]]).toBe(0); expect(projectSliceState(s).maxSpirituality).toBe(45); }
      expect(s.status).toBe('ACTIVE'); expect(validateCombatScholarState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps granted attributes at500, never raises knowledge, and adds only the one G category', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(COMBAT_SCHOLAR_ABILITY_IDS).toEqual(['hermit.s8.combat-study']);
    expect(projectCombatScholar(s).abilities).toEqual(COMBAT_SCHOLAR_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });

  it('keeps severe rejection recoverable and cannot retry while resources are exhausted', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateCombatScholarState(s)).toBe(true);
  });

  it('preserves held bottles after success but forbids repeat promotion and further supply work', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true });
    expect(s.combatScholar.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectCombatScholar(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateCombatScholarState(s)).toBe(true);
  });

  it('requires exhaustion, one request AP and a later week before three new payable originals arrive', () => {
    const s = exhausted(), old = JSON.stringify(s.combatScholar.bottles), s9 = JSON.stringify(s.pryer), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.combatScholar.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.combatScholar.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateCombatScholarState(s)).toBe(true);
    s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.combatScholar.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.combatScholar.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify(s.pryer)).toBe(s9);
    expect(s.combatScholar.bottles.slice(3).map(b => b.id)).toEqual(['combat-scholar-potion-4', 'combat-scholar-potion-5', 'combat-scholar-potion-6']);
    expect(s.combatScholar.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'combat-scholar-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'combat-scholar-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 160);
    apply(s, { type: 'CONSUME', bottleId: 'combat-scholar-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.combatScholar.promotionWeek]).toEqual([5, 12]);
    expect(validateCombatScholarState(s)).toBe(true);
  });

  it('never refills automatically or supplies while an original remains or promotion succeeded', () => {
    for (const s of [ordinary(), pryer(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.combatScholar.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('validates exact declared commands and routes only acquisition commands here', () => {
    const commands: CombatScholarCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'combat-scholar-potion-99' },
      { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0], confirmed: true }, { type: 'REFLECT' },
      ...COMBAT_SCHOLAR_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'STOP', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['OBSERVED', 'MEMORIZED', 'TEAM'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateCombatScholarCommand(command)).toBe(true); if (!isCombatScholarAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'BUY_POTION', bottleId: 'pryer-potion-1' },
      { type: 'BUY_POTION', bottleId: 'combat-scholar-potion-01' }, { type: 'CONSUME', bottleId: COMBAT_SCHOLAR_BOTTLE_IDS[0] },
      { type: 'PREPARE', caseId: 'counter-study', method: 'MYSTIC' }, { type: 'STOP', caseId: 'counter-study', guaranteed: true },
      { type: 'REPORT', caseId: 'counter-study', claim: 'COMPLETE' }, { type: 'CLOSE', caseId: 'counter-study' },
    ]) { expect(validateCombatScholarCommand(command)).toBe(false); rejected(prepared(), command); }
  });

  it('rejects forged chronology, inherited mastery and malformed case shapes', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.combatScholar.bottles[0]!.id = 'pryer-potion-1'; }, s => { s.combatScholar.bottles[0]!.source = 'invented'; },
      s => { s.combatScholar.bottles[0]!.labourSteps = 4; }, s => { s.combatScholar.bottles[0]!.consumedWeek = 8; },
      s => { s.combatScholar.pryerActingAtPromotion = 99; }, s => { s.combatScholar.promotionWeek = 10; },
      s => { delete s.progression.mastery[PRYER_ABILITY_IDS[0]]; }, s => { s.progression.mastery['hermit.s7.spell'] = 0; },
      s => { delete s.combatScholar.cases['halted-exercise']; }, s => { s.combatScholar.resupply.deliveries = 1; },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateCombatScholarState(s)).toBe(false); }
    const empty = ordinary(); empty.combatScholar.cases['counter-study']!.status = 'OBSERVED';
    expect(validateCombatScholarState(empty)).toBe(false);
    const supplied = exhausted(); apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 12; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    supplied.combatScholar.bottles[3]!.source = supplied.combatScholar.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库');
    expect(validateCombatScholarState(supplied)).toBe(false);
  });

  it('separates the verified name from G training and discloses the unverified formula', () => {
    expect(COMBAT_SCHOLAR_SOURCE_STATUS).toContain('第一部第81章');
    expect(COMBAT_SCHOLAR_SOURCE_STATUS).toContain('L15063');
    expect(COMBAT_SCHOLAR_SOURCE_STATUS).toContain('仅确认序列8格斗学者名称');
    expect(COMBAT_SCHOLAR_SOURCE_STATUS).toContain('具体动作表与完整配方尚未核实');
    expect(COMBAT_SCHOLAR_SOURCE_STATUS).toContain('不将该章前段对小丑敏捷的描述归给格斗学者');
    expect(COMBAT_SCHOLAR_SOURCE_STATUS).toContain('不提前开放巫师法术');
    expect(COMBAT_SCHOLAR_ABILITIES[0]!.description).toContain('本作G训练分类');
    expect(projectCombatScholar(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
