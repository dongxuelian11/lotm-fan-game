import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyCriminalCommand } from '../../src/domain/criminal/index.js';
import { applyCriminalActivity } from '../../src/domain/criminal/life.js';
import { CRIMINAL_ABILITY_IDS, CRIMINAL_CASE_IDS } from '../../src/domain/criminal/types.js';
import {
  applyUnwingedCommand, createUnwingedState, isUnwingedAcquisitionCommand,
  projectUnwinged, validateUnwingedCommand, validateUnwingedState,
} from '../../src/domain/unwinged/index.js';
import {
  UNWINGED_ABILITIES, UNWINGED_BOTTLE_IDS, UNWINGED_FORMULA_STATUS,
  UNWINGED_LABOUR_TASKS, UNWINGED_SOURCE_STATUS, UNWINGED_CHANGE_WARNING, UNWINGED_CONSUMPTION_RISK,
} from '../../src/domain/unwinged/content.js';
import {
  UNWINGED_ABILITY_IDS, UNWINGED_CASE_IDS,
  type UnwingedAcquisitionCommand, type UnwingedCommand,
} from '../../src/domain/unwinged/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('unwinged-acquisition', sliceDefaultCreationSelection, 'unwinged-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.unwinged = createUnwingedState();
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
function criminal() {
  const s = ordinary(), c = context(s, 1).c;
  applyCriminalCommand(s, { type: 'DISCOVER' }, c);
  applyCriminalCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCriminalCommand(s, { type: 'BUY_POTION', bottleId: s.criminal.bottles[0]!.id }, c);
  applyCriminalCommand(s, { type: 'CONSUME', bottleId: s.criminal.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[CRIMINAL_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of CRIMINAL_CASE_IDS) {
    applyCriminalActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyCriminalActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applyCriminalActivity(s, { type: 'PERFORM', caseId }, c, award);
    applyCriminalActivity(s, { type: 'REPORT', caseId }, c, award);
  }
  applyCriminalActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(CRIMINAL_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: UnwingedAcquisitionCommand, roll = 20) {
  applyUnwingedCommand(s, command, context(s, roll).c);
}
function taught(s = criminal()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.unwinged.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of UNWINGED_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true, acceptedChange: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as UnwingedAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Focused acquisition coverage. Life owns exact case transitions and real STAND_DOWN behavior.
describe('Unwinged independent S8 acquisition', () => {
  it('starts with three separate G originals and locked cases, without a formula', () => {
    const s = ordinary(), projection = projectUnwinged(s);
    expect(validateUnwingedState(s)).toBe(true);
    expect(s.unwinged.bottles.map(b => b.id)).toEqual([...UNWINGED_BOTTLE_IDS]);
    expect(s.unwinged.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.unwinged.cases)).toEqual([...UNWINGED_CASE_IDS]);
    expect(Object.values(s.unwinged.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.urgeOpen && c.restraints === 0)).toBe(true);
    expect(projection).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false, conscienceLost: false, changeWarning: '' });
    const other = createUnwingedState(); other.bottles[0]!.labourSteps = 1;
    expect(s.unwinged.bottles[0]!.labourSteps).toBe(0);
  });

  it('continues through Rowan’s existing channel and charges 180 pence plus one AP for guidance only', () => {
    const s = criminal(), before = JSON.stringify(s.criminal), progression = JSON.stringify(s.progression), ctx = context(s);
    rejected(s, { type: 'BUY_POTION', bottleId: UNWINGED_BOTTLE_IDS[0] });
    applyUnwingedCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.unwinged.guidanceKnown]).toEqual([9820, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(ctx.notes[0]!.text).toContain('罗安·费里');
    expect(projectUnwinged(s).supplies).toContain(UNWINGED_FORMULA_STATUS);
    expect(JSON.stringify(s.criminal)).toBe(before);
    expect(JSON.stringify(s.progression)).toBe(progression);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateUnwingedState(s)).toBe(true);
  });

  it('discloses the fictional conscience change before purchase without applying it', () => {
    const s = criminal(), old = JSON.stringify(s.criminal), ctx = context(s);
    expect(projectUnwinged(s).changeWarning).toBe(UNWINGED_CHANGE_WARNING);
    expect(UNWINGED_CHANGE_WARNING).toContain('这名虚构角色将失去原有良知，恶欲加剧');
    expect(UNWINGED_CHANGE_WARNING).toContain('不描述或改变现实玩家的人格');
    expect(UNWINGED_CHANGE_WARNING).toContain('不会替玩家实施犯罪');
    expect(UNWINGED_CHANGE_WARNING).toContain('不能恢复原有良知');
    expect(UNWINGED_CONSUMPTION_RISK).toContain(UNWINGED_CHANGE_WARNING);
    applyUnwingedCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect(ctx.notes[0]!.text).toContain(UNWINGED_CHANGE_WARNING);
    buy(s);
    const before = JSON.stringify(s), projection = projectUnwinged(s);
    expect(projection.conscienceLost).toBe(false);
    expect(projection.risk).toContain(UNWINGED_CHANGE_WARNING);
    expect(projection.bottles[0]!.command).toEqual({ type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    // Viewing or cancelling the modal does not execute a domain command.
    expect(JSON.stringify(s)).toBe(before);
    expect(JSON.stringify(s.criminal)).toBe(old);
    expect([s.progression.sequence, s.unwinged.conscienceLost, s.unwinged.promotionWeek]).toEqual([9, false, null]);
  });

  it('requires both independent affirmations for this exact original and rejects extra fields atomically', () => {
    const s = prepared(), bottleId = UNWINGED_BOTTLE_IDS[0];
    for (const command of [
      { type: 'CONSUME', bottleId },
      { type: 'CONSUME', bottleId, confirmed: true },
      { type: 'CONSUME', bottleId, acceptedChange: true },
      { type: 'CONSUME', bottleId, confirmed: true, acceptedChange: false },
      { type: 'CONSUME', bottleId, confirmed: false, acceptedChange: true },
      { type: 'CONSUME', bottleId, confirmed: true, acceptedChange: 'true' },
      { type: 'CONSUME', bottleId, confirmed: true, bodyChangeAccepted: true },
      { type: 'CONSUME', bottleId, confirmed: true, acceptedChange: true, free: true },
      { type: 'CONSUME', bottleId: 'criminal-potion-1', confirmed: true, acceptedChange: true },
    ]) {
      expect(validateUnwingedCommand(command)).toBe(false);
      rejected(s, command);
    }
    rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[1], confirmed: true, acceptedChange: true });
    expect(s.unwinged.bottles[0]!.status).toBe('PLAYER');
    expect(s.unwinged.conscienceLost).toBe(false);
  });

  it('keeps conscience after a failed original and requires fresh explicit acceptance for its replacement', () => {
    const s = taught(); buy(s); buy(s, 1);
    const old = JSON.stringify(s.criminal), mastery = { ...s.progression.mastery };
    apply(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true }, 80);
    expect([s.unwinged.conscienceLost, s.unwinged.promotionWeek, s.progression.sequence]).toEqual([false, null, 9]);
    expect(s.progression.mastery).toEqual(mastery);
    rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[1], confirmed: true });
    apply(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[1], confirmed: true, acceptedChange: true });
    expect(s.unwinged.bottles.map(b => b.status)).toEqual(['CONSUMED', 'CONSUMED', 'SUPPLIER']);
    expect([s.unwinged.conscienceLost, s.unwinged.promotionWeek, s.progression.sequence]).toEqual([true, 11, 8]);
    expect(JSON.stringify(s.criminal)).toBe(old);
    expect(validateUnwingedState(s)).toBe(true);
  });

  it('delivers an original for 1210 pence at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: UNWINGED_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.unwinged.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.unwinged.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateUnwingedState(s)).toBe(true);
  });

  it('requires three real jobs per bottle before paying the remaining 160 pence', () => {
    const s = taught(), bottleId = UNWINGED_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 3; step += 1) {
      applyUnwingedCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.unwinged.bottles[0]!.labourSteps]).toEqual([9820, 38 - step, step + 1]);
      expect(projectUnwinged(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(UNWINGED_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.unwinged.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 159; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 160; buy(s);
    expect([s.cash, s.actionsRemaining, s.unwinged.bottles[0]!.status]).toEqual([0, 36, 'PLAYER']);
  });

  it('allows early preparation but requires acting100, four whole S9 weeks and confirmation', () => {
    const s = criminal(); s.week = 5; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    s.progression.acting = 100; s.week = 8;
    rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    s.progression.acting = 100;
    rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.unwinged.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateUnwingedState(s)).toBe(true);
  });

  it('blocks unavailable channels, ended runs, blockers and unrestored health without mutation', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.criminal.discovered = false; },
      s => { s.criminal.guidanceKnown = false; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.criminal.cases['found-pay']!.holding = true; },
      s => { s.unwinged.cases['cold-grip']!.urgeOpen = true; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true }); }
    const s = criminal(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: UNWINGED_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves all four tiers with one will12 check, no death draw, and unchanged S9 history', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify(s.criminal), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectUnwinged(s).bottles[0]!.chance;
      applyUnwingedCommand(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.unwinged.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['abyss', success ? 8 : 9, 5, success ? 0 : 100]);
      expect([s.unwinged.promotionWeek, s.unwinged.criminalActingAtPromotion, s.unwinged.conscienceLost]).toEqual(success ? [11, 100, true] : [null, null, false]);
      expect(JSON.stringify(s.criminal)).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of CRIMINAL_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 0], ['knowledge', 1]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS] : [...CRIMINAL_ABILITY_IDS]);
      if (success) { expect(s.progression.mastery[UNWINGED_ABILITY_IDS[0]]).toBe(0); expect(projectSliceState(s).maxSpirituality).toBe(45); }
      expect(s.status).toBe('ACTIVE'); expect(validateUnwingedState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    }
  });

  it('caps granted attributes at500, never raises will, and adds only inhuman body', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 499, knowledge: 500 });
    expect(UNWINGED_ABILITY_IDS).toEqual(['abyss.s8.inhuman-body']);
    expect(projectUnwinged(s).abilities).toEqual(UNWINGED_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });

  it('keeps severe rejection recoverable and cannot retry while resources are exhausted', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[1], confirmed: true, acceptedChange: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateUnwingedState(s)).toBe(true);
  });

  it('preserves held bottles after success but forbids repeat promotion and further supply work', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true });
    expect(s.unwinged.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: UNWINGED_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: UNWINGED_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[1], confirmed: true, acceptedChange: true },
    ]) rejected(s, command);
    expect(projectUnwinged(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateUnwingedState(s)).toBe(true);
  });

  it('requires exhaustion, one request AP and a later week before three new payable originals arrive', () => {
    const s = exhausted(), old = JSON.stringify(s.unwinged.bottles), s9 = JSON.stringify(s.criminal), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.unwinged.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.unwinged.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateUnwingedState(s)).toBe(true);
    s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.unwinged.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.unwinged.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify(s.criminal)).toBe(s9);
    expect(s.unwinged.bottles.slice(3).map(b => b.id)).toEqual(['unwinged-potion-4', 'unwinged-potion-5', 'unwinged-potion-6']);
    expect(s.unwinged.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'unwinged-potion-4', confirmed: true, acceptedChange: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'unwinged-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 160);
    apply(s, { type: 'CONSUME', bottleId: 'unwinged-potion-4', confirmed: true, acceptedChange: true });
    expect([s.progression.promotionWeek, s.unwinged.promotionWeek]).toEqual([5, 12]);
    expect(validateUnwingedState(s)).toBe(true);
  });

  it('never refills automatically or supplies while an original remains or promotion succeeded', () => {
    for (const s of [ordinary(), criminal(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.unwinged.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('validates exact declared commands and routes only acquisition commands here', () => {
    const commands: UnwingedCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: UNWINGED_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'unwinged-potion-99' },
      { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true }, { type: 'REFLECT' },
      ...UNWINGED_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'STAND_DOWN', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['BODY', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateUnwingedCommand(command)).toBe(true); if (!isUnwingedAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'BUY_POTION', bottleId: 'criminal-potion-1' },
      { type: 'BUY_POTION', bottleId: 'unwinged-potion-01' }, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0] },
      { type: 'PREPARE', caseId: 'cold-grip', method: 'MYSTIC' }, { type: 'LEAVE', caseId: 'cold-grip', guaranteed: true },
      { type: 'REPORT', caseId: 'cold-grip', claim: 'COMPLETE' }, { type: 'REPORT', caseId: 'cold-grip', claim: 'LIMITED' },
      { type: 'VERIFY', caseId: 'cold-grip', guaranteed: true }, { type: 'COVER', caseId: 'cold-grip' },
    ]) { expect(validateUnwingedCommand(command)).toBe(false); rejected(prepared(), command); }
  });

  it('rejects forged chronology, inherited mastery and malformed case shapes', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.unwinged.bottles[0]!.id = 'criminal-potion-1'; }, s => { s.unwinged.bottles[0]!.source = 'invented'; },
      s => { s.unwinged.bottles[0]!.labourSteps = 4; }, s => { s.unwinged.bottles[0]!.consumedWeek = 8; },
      s => { s.unwinged.criminalActingAtPromotion = 99; }, s => { s.unwinged.promotionWeek = 10; },
      s => { s.unwinged.conscienceLost = false; },
      s => { delete s.progression.mastery[CRIMINAL_ABILITY_IDS[0]]; }, s => { s.progression.mastery['abyss.s7.shadow'] = 0; },
      s => { delete s.unwinged.cases['false-claim']; }, s => { s.unwinged.resupply.deliveries = 1; },
      s => { s.unwinged.cases['cold-grip']!.restraints = -1; },
      s => { s.unwinged.cases['refused-price']!.attemptWeek = 10; },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateUnwingedState(s)).toBe(false); }
    const empty = ordinary(); empty.unwinged.cases['cold-grip']!.status = 'OBSERVED';
    expect(validateUnwingedState(empty)).toBe(false);
    const premature = prepared(); premature.unwinged.conscienceLost = true;
    expect(validateUnwingedState(premature)).toBe(false);
    const failed = prepared(); apply(failed, { type: 'CONSUME', bottleId: UNWINGED_BOTTLE_IDS[0], confirmed: true, acceptedChange: true }, 80);
    failed.unwinged.conscienceLost = true;
    expect(validateUnwingedState(failed)).toBe(false);
    const supplied = exhausted(); apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 12; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    supplied.unwinged.bottles[3]!.source = supplied.unwinged.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库');
    expect(validateUnwingedState(supplied)).toBe(false);
  });

  it('rejects malformed case and bottle records without throwing during save validation', () => {
    for (const replacement of [null, [], {}, { urgeOpen: 'yes' }]) {
      const s = promoted();
      (s.unwinged.cases as Record<string, unknown>)['cold-grip'] = replacement;
      expect(() => validateUnwingedState(s)).not.toThrow();
      expect(validateUnwingedState(s)).toBe(false);
    }
    const s = exhausted();
    apply(s, { type: 'REQUEST_SUPPLY' }); s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    (s.unwinged.bottles as unknown[])[0] = null;
    expect(() => validateUnwingedState(s)).not.toThrow();
    expect(validateUnwingedState(s)).toBe(false);
  });

  it('keeps the verified cost separate from unverified spells and G restraint growth', () => {
    expect(UNWINGED_SOURCE_STATUS).toContain('第二部第45章');
    expect(UNWINGED_SOURCE_STATUS).toContain('进一步非人化');
    expect(UNWINGED_SOURCE_STATUS).toContain('一些恶魔法术');
    expect(UNWINGED_SOURCE_STATUS).toContain('丧失原有良知、恶欲加剧');
    expect(UNWINGED_SOURCE_STATUS).toContain('不自动填入具体恶魔法术清单');
    expect(UNWINGED_SOURCE_STATUS).toContain('本作G扮演适配');
    expect(UNWINGED_SOURCE_STATUS).toContain('不是原著保证');
    expect(UNWINGED_ABILITIES).toHaveLength(1);
    expect(UNWINGED_ABILITIES[0]!.description).toContain('不是巨大化');
    expect(projectUnwinged(promoted())).toMatchObject({ formulaKnown: false, formula: [], conscienceLost: true });
  });
});
