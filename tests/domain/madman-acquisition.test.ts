import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyPrisonerCommand } from '../../src/domain/prisoner/index.js';
import { applyPrisonerActivity } from '../../src/domain/prisoner/life.js';
import { PRISONER_ABILITY_IDS, PRISONER_CASE_IDS } from '../../src/domain/prisoner/types.js';
import {
  applyMadmanCommand, createMadmanState, isMadmanAcquisitionCommand,
  projectMadman, validateMadmanCommand, validateMadmanState,
} from '../../src/domain/madman/index.js';
import {
  MADMAN_ABILITIES, MADMAN_BOTTLE_IDS, MADMAN_FORMULA_STATUS, MADMAN_LABOUR_TASKS,
  MADMAN_SOURCE_STATUS, MADMAN_CONSUMPTION_RISK, MADMAN_BURST_MIND_COST, MADMAN_BURST_SPIRITUALITY_COST,
} from '../../src/domain/madman/content.js';
import { MADMAN_ABILITY_IDS, MADMAN_CASE_IDS, type MadmanAcquisitionCommand, type MadmanCommand } from '../../src/domain/madman/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('madman-acquisition', sliceDefaultCreationSelection, 'madman-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 10000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 15;
  s.madman = createMadmanState();
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
function prisoner() {
  const s = ordinary(), c = context(s, 1).c;
  applyPrisonerCommand(s, { type: 'DISCOVER' }, c);
  applyPrisonerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPrisonerCommand(s, { type: 'BUY_POTION', bottleId: s.prisoner.bottles[0]!.id }, c);
  applyPrisonerCommand(s, { type: 'CONSUME', bottleId: s.prisoner.bottles[0]!.id, confirmed: true }, c);
  const award = (source: string, amount: 5 | 8 | 25) => {
    s.seer.completedSources.push(source);
    s.progression.mastery[PRISONER_ABILITY_IDS[0]]! += amount;
  };
  for (const caseId of PRISONER_CASE_IDS) {
    applyPrisonerActivity(s, { type: 'OBSERVE', caseId }, c, award);
    applyPrisonerActivity(s, { type: 'PREPARE', caseId, method: 'ORDINARY' }, c, award);
    applyPrisonerActivity(s, { type: 'PERFORM', caseId }, c, award);
    if (caseId === 'jammed-shutter') applyPrisonerActivity(s, { type: 'RETURN', caseId }, c, award);
    applyPrisonerActivity(s, { type: 'REPORT', caseId }, c, award);
  }
  applyPrisonerActivity(s, { type: 'REFLECT' }, c, award);
  s.progression.mastery = Object.fromEntries(PRISONER_ABILITY_IDS.map((id, index) => [id, index * 25]));
  s.week = 11; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 15;
  return s;
}
function apply(s: SliceState, command: MadmanAcquisitionCommand, roll = 20) { applyMadmanCommand(s, command, context(s, roll).c); }
function taught(s = prisoner()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.madman.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id });
  return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of MADMAN_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function resupplied() { const s = exhausted(); apply(s, { type: 'REQUEST_SUPPLY' }); s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' }); return s; }
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as MadmanAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

// Acquisition owns originals, maturity and promotion. Life owns exact case transitions and actual STOP.
describe('Madman independent S8 acquisition', () => {
  it('starts with three separate G originals, locked cases and no recipe or permanent personality state', () => {
    const s = ordinary(), p = projectMadman(s);
    expect(validateMadmanState(s)).toBe(true);
    expect(s.madman.bottles.map(b => b.id)).toEqual([...MADMAN_BOTTLE_IDS]);
    expect(s.madman.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.madman.cases)).toEqual([...MADMAN_CASE_IDS]);
    expect(Object.values(s.madman.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.burstOpen && c.stops === 0 && c.burstUses === 0)).toBe(true);
    expect(p).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    expect(s.madman).not.toHaveProperty('conscienceLost');
    expect(p).not.toHaveProperty('changeWarning');
    const other = createMadmanState(); other.bottles[0]!.labourSteps = 1; other.cases['stop-bell']!.burstUses = 1;
    expect(s.madman.bottles[0]!.labourSteps).toBe(0);
    expect(s.madman.cases['stop-bell']!.burstUses).toBe(0);
  });

  it('continues through Harlan’s known channel and pays 180 pence plus one AP only for guidance', () => {
    const s = prisoner(), old = JSON.stringify(s.prisoner), progression = JSON.stringify(s.progression), ctx = context(s);
    rejected(s, { type: 'BUY_POTION', bottleId: MADMAN_BOTTLE_IDS[0] });
    applyMadmanCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.madman.guidanceKnown]).toEqual([9820, 39, true]);
    expect(ctx.notes[0]!.text).toContain('已认识的');
    expect(ctx.notes[0]!.text).toContain('成年');
    expect(ctx.notes[0]!.text).toContain('哈伦·维斯');
    expect(projectMadman(s).supplies).toContain(MADMAN_FORMULA_STATUS);
    expect(JSON.stringify(s.prisoner)).toBe(old);
    expect(JSON.stringify(s.progression)).toBe(progression);
    rejected(s, { type: 'LEARN_GUIDANCE' });
    expect(validateMadmanState(s)).toBe(true);
  });

  it('discloses chosen current-reason costs without applying a burst during guidance or delivery', () => {
    const s = prisoner(), mind = s.mind, spirituality = s.spirituality;
    expect(projectMadman(s).story).toBe(MADMAN_SOURCE_STATUS);
    taught(s); buy(s);
    const before = JSON.stringify(s), p = projectMadman(s);
    expect(p.risk).toContain(MADMAN_CONSUMPTION_RISK);
    expect(p.bottles[0]!.command).toEqual({ type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    expect([s.mind, s.spirituality]).toEqual([mind, spirituality]);
    expect(Object.values(s.madman.cases).every(c => !c.burstOpen && c.burstUses === 0)).toBe(true);
    expect(JSON.stringify(s)).toBe(before);
    expect([s.progression.sequence, s.madman.promotionWeek]).toEqual([9, null]);
  });

  it('requires confirmation for the exact original and rejects an extra acceptance flag or unrelated fields', () => {
    const s = prepared(), bottleId = MADMAN_BOTTLE_IDS[0];
    for (const command of [
      { type: 'CONSUME', bottleId }, { type: 'CONSUME', bottleId, confirmed: false },
      { type: 'CONSUME', bottleId, confirmed: 'true' },
      { type: 'CONSUME', bottleId, confirmed: true, acceptedChange: true },
      { type: 'CONSUME', bottleId, confirmed: true, free: true },
      { type: 'CONSUME', bottleId: 'prisoner-potion-1', confirmed: true },
    ]) { expect(validateMadmanCommand(command)).toBe(false); rejected(s, command); }
    rejected(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[1], confirmed: true });
    expect(s.madman.bottles[0]!.status).toBe('PLAYER');
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(s.progression.sequence).toBe(8);
  });

  it('delivers an original for 1210 pence at zero AP without partial labour discounts', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: MADMAN_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.madman.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 1210, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 11, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.madman.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id });
    rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateMadmanState(s)).toBe(true);
  });

  it('requires three real jobs per bottle before paying its remaining 160 pence', () => {
    const s = taught(), bottleId = MADMAN_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 3; step += 1) {
      applyMadmanCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.madman.bottles[0]!.labourSteps]).toEqual([9820, 38 - step, step + 1]);
      expect(projectMadman(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 2 ? 160 : 1210}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(MADMAN_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.madman.bottles[1]!.labourSteps).toBe(0);
    rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 159; rejected(s, { type: 'BUY_POTION', bottleId });
    s.cash = 160; buy(s);
    expect([s.cash, s.actionsRemaining, s.madman.bottles[0]!.status]).toEqual([0, 36, 'PLAYER']);
  });

  it('permits early preparation but consumes only after acting100 and four whole S9 weeks', () => {
    const s = prisoner(); s.week = 5; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 8;
    rejected(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    s.week = 9; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100;
    apply(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.madman.promotionWeek]).toEqual([8, 5, 9]);
    expect(validateMadmanState(s)).toBe(true);
  });

  it('blocks invalid channels, ended runs, old borrowed objects and an open current practice atomically', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.prisoner.discovered = false; },
      s => { s.prisoner.guidanceKnown = false; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; },
      s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.prisoner.cases['jammed-shutter']!.holding = true; },
      s => { s.madman.cases['stop-bell']!.burstOpen = true; },
    ];
    for (const change of changes) {
      const s = prepared(); change(s);
      rejected(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
      expect(projectMadman(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    }
    const s = prisoner(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: MADMAN_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    expect(s.actionsRemaining).toBe(0);
  });

  it('resolves all four recoverable will12 tiers while preserving S9 history and current spirituality', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify(s.prisoner), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7;
      const chance = projectMadman(s).bottles[0]!.chance;
      applyMadmanCommand(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 12]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 15, difficulty: 12, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.madman.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 11, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['chained', success ? 8 : 9, 5, success ? 0 : 100]);
      expect([s.madman.promotionWeek, s.madman.prisonerActingAtPromotion]).toEqual(success ? [11, 100] : [null, null]);
      expect(JSON.stringify(s.prisoner)).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of PRISONER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 0]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS] : [...PRISONER_ABILITY_IDS]);
      if (success) {
        for (const id of MADMAN_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
        expect(projectSliceState(s).maxSpirituality).toBe(45);
      }
      expect(Object.values(s.madman.cases).every(c => !c.burstOpen && c.burstUses === 0)).toBe(true);
      expect(s.status).toBe('ACTIVE'); expect(validateMadmanState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps the three granted attributes at500 without raising knowledge or granting higher-sequence abilities', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 500;
    s.character.coreStats.knowledge = 499;
    apply(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(MADMAN_ABILITY_IDS).toEqual(['chained.s8.reason-sacrifice', 'chained.s8.mental-resistance']);
    expect(projectMadman(s).abilities).toEqual(MADMAN_ABILITIES.map(a => ({ ...a, mastery: 0 })));
  });

  it('keeps severe rejection recoverable and blocks retry until health and mind recover', () => {
    const s = taught(); buy(s); buy(s, 1); s.health = 10; s.mind = 20; s.seer.pollution = 90;
    apply(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true }, 100);
    expect([s.health, s.mind, s.seer.pollution, s.status]).toEqual([-10, -20, 100, 'ACTIVE']);
    rejected(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[1], confirmed: true });
    expect([s.progression.sequence, s.progression.acting]).toEqual([9, 100]);
    expect(validateMadmanState(s)).toBe(true);
    s.health = 100; s.mind = 100;
    apply(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[1], confirmed: true });
    expect(s.madman.bottles[0]!.outcome).toBe('GREAT_FAILURE');
    expect(s.madman.bottles[1]!.outcome).toBe('SUCCESS');
    expect(validateMadmanState(s)).toBe(true);
  });

  it('retains held originals after success but forbids repeat promotion and further acquisition', () => {
    const s = taught(); buy(s); buy(s, 1);
    apply(s, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true });
    expect(s.madman.bottles[1]!.status).toBe('PLAYER');
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: MADMAN_BOTTLE_IDS[2] }, { type: 'BUY_POTION', bottleId: MADMAN_BOTTLE_IDS[2] },
      { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectMadman(s).actions.filter(a => a.command.type === 'CONSUME').every(a => !a.enabled)).toBe(true);
    expect(validateMadmanState(s)).toBe(true);
  });

  it('waits a real week after all three failures before delivering three new payable originals', () => {
    const s = exhausted(), old = JSON.stringify(s.madman.bottles), s9 = JSON.stringify(s.prisoner), cash = s.cash;
    s.actionsRemaining = 1; apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.cash, s.madman.resupply.requestedWeek]).toEqual([0, cash, 11]);
    expect(s.madman.bottles).toHaveLength(3);
    rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    expect(validateMadmanState(s)).toBe(true);
    s.week = 12; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(s.madman.resupply).toEqual({ requestedWeek: null, deliveries: 1 });
    expect(JSON.stringify(s.madman.bottles.slice(0, 3))).toBe(old); expect(JSON.stringify(s.prisoner)).toBe(s9);
    expect(s.madman.bottles.slice(3).map(b => b.id)).toEqual(['madman-potion-4', 'madman-potion-5', 'madman-potion-6']);
    expect(s.madman.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.source.includes('第12周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'madman-potion-4', confirmed: true });
    rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 3;
    for (let i = 0; i < 3; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'madman-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 160);
    apply(s, { type: 'CONSUME', bottleId: 'madman-potion-4', confirmed: true });
    expect([s.progression.promotionWeek, s.madman.promotionWeek]).toEqual([5, 12]);
    expect(validateMadmanState(s)).toBe(true);
  });

  it('never refills automatically or supplies before exhaustion and never reuses previous stock', () => {
    for (const s of [ordinary(), prisoner(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10;
    expect(s.madman.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
    const supplied = resupplied(), old = JSON.stringify(supplied.madman.bottles.slice(0, 3));
    for (let i = 3; i < 6; i += 1) buy(supplied, i);
    for (let i = 3; i < 6; i += 1) { supplied.mind = 100; apply(supplied, { type: 'CONSUME', bottleId: supplied.madman.bottles[i]!.id, confirmed: true }, 80); }
    apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 13; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    expect(supplied.madman.bottles.map(b => b.id)).toEqual(Array.from({ length: 9 }, (_, i) => `madman-potion-${i + 1}`));
    expect(JSON.stringify(supplied.madman.bottles.slice(0, 3))).toBe(old);
    expect(validateMadmanState(supplied)).toBe(true);
  });

  it('validates exact declared commands and routes activity commands outside acquisition', () => {
    const commands: MadmanCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: MADMAN_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'madman-potion-99' },
      { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0], confirmed: true }, { type: 'REFLECT' },
      ...MADMAN_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'STOP', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['BURST', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateMadmanCommand(command)).toBe(true); if (!isMadmanAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'BUY_POTION', bottleId: 'prisoner-potion-1' },
      { type: 'BUY_POTION', bottleId: 'madman-potion-01' }, { type: 'CONSUME', bottleId: MADMAN_BOTTLE_IDS[0] },
      { type: 'PREPARE', caseId: 'stop-bell', method: 'BODY' }, { type: 'STOP', caseId: 'stop-bell', refund: true },
      { type: 'REPORT', caseId: 'stop-bell', claim: 'COMPLETE' }, { type: 'RETURN', caseId: 'stop-bell' },
      { type: 'STOP', caseId: 'jammed-shutter' }, { type: 'STAND_DOWN', caseId: 'stop-bell' },
    ]) { expect(validateMadmanCommand(command)).toBe(false); rejected(prepared(), command); }
  });

  it('rejects forged chronology, inherited mastery, extra state and malformed case counters', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.madman.bottles[0]!.id = 'prisoner-potion-1'; }, s => { s.madman.bottles[0]!.source = 'invented'; },
      s => { s.madman.bottles[0]!.labourSteps = 4; }, s => { s.madman.bottles[0]!.consumedWeek = 8; },
      s => { s.madman.prisonerActingAtPromotion = 99; }, s => { s.madman.promotionWeek = 10; },
      s => { delete s.progression.mastery[PRISONER_ABILITY_IDS[0]]; }, s => { s.progression.mastery['chained.s7.regeneration'] = 0; },
      s => { delete s.madman.cases['taunting-note']; }, s => { s.madman.resupply.deliveries = 1; },
      s => { s.madman.cases['stop-bell']!.stops = -1; }, s => { s.madman.cases['stop-bell']!.burstUses = 1.5; },
      s => { s.madman.cases['weighted-gate']!.attemptWeek = 10; },
      s => { Object.assign(s.madman, { conscienceLost: true }); },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateMadmanState(s)).toBe(false); }
    for (const change of [
      (s: SliceState) => { s.madman.cases['stop-bell']!.status = 'OBSERVED'; },
      (s: SliceState) => { s.madman.cases['stop-bell']!.burstUses = 1; },
      (s: SliceState) => { s.madman.prisonerActingAtPromotion = 100; },
    ]) { const s = ordinary(); change(s); expect(validateMadmanState(s)).toBe(false); }
  });

  it('rejects an invalid delivery date, mixed batch dates, backwards ownership and pending supply forgery', () => {
    const valid = resupplied();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.madman.bottles[3]!.source = s.madman.bottles[3]!.source.replace('第12周实收入库', '第11周实收入库'); },
      s => { s.week = 13; s.madman.bottles[4]!.source = s.madman.bottles[4]!.source.replace('第12周实收入库', '第13周实收入库'); },
      s => { s.madman.bottles[3]!.status = 'PLAYER'; s.madman.bottles[3]!.acquiredWeek = 11; },
      s => { s.madman.resupply.requestedWeek = 12; },
      s => { s.madman.bottles[0]!.consumedWeek = 12; },
      s => { s.madman.bottles[0]!.outcome = 'SUCCESS'; },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateMadmanState(s)).toBe(false); }
  });

  it('rejects malformed case and bottle records without throwing during save validation', () => {
    for (const replacement of [null, [], {}, { burstOpen: 'yes' }]) {
      const s = promoted(); (s.madman.cases as Record<string, unknown>)['stop-bell'] = replacement;
      expect(() => validateMadmanState(s)).not.toThrow(); expect(validateMadmanState(s)).toBe(false);
    }
    const s = resupplied(); (s.madman.bottles as unknown[])[0] = null;
    expect(() => validateMadmanState(s)).not.toThrow(); expect(validateMadmanState(s)).toBe(false);
  });

  it('projects actual open work independently of unexecuted burst preparation', () => {
    const s = promoted(), c = s.madman.cases['stop-bell']!;
    c.status = 'PREPARED'; c.method = 'BURST';
    expect(projectMadman(s).insideCase).toBe(false);
    c.status = 'EXAMINED'; c.burstOpen = true;
    expect(projectMadman(s).insideCase).toBe(true);
    c.burstOpen = false;
    expect(projectMadman(s).insideCase).toBe(false);
  });

  it('keeps canon, G growth, incomplete recipe and fictional diagnosis boundaries explicit', () => {
    expect(MADMAN_SOURCE_STATUS).toContain('第二部第118章《被诅咒者》');
    expect(MADMAN_SOURCE_STATUS).toContain('L59584–59620');
    expect(MADMAN_SOURCE_STATUS).toContain('第二部第117章');
    expect(MADMAN_SOURCE_STATUS).toContain('牺牲当下理智');
    expect(MADMAN_SOURCE_STATUS).toContain('部分精神干扰');
    expect(MADMAN_SOURCE_STATUS).toContain('失控风险');
    expect(MADMAN_SOURCE_STATUS).toContain('不是现实精神健康诊断');
    expect(MADMAN_SOURCE_STATUS).toContain('不保证成长就能消除诅咒');
    expect(MADMAN_SOURCE_STATUS).toContain('不下放序列7狼人的愈合和利爪');
    expect(MADMAN_SOURCE_STATUS).toContain('不下放序列6活尸的护甲与尸体控制');
    expect([MADMAN_BURST_MIND_COST, MADMAN_BURST_SPIRITUALITY_COST]).toEqual([10, 2]);
    expect(MADMAN_ABILITIES).toHaveLength(2);
    expect(MADMAN_ABILITIES[1]!.description).toContain('不是全精神免疫');
    expect(projectMadman(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
