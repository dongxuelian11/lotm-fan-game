import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyCriminalCommand } from '../../src/domain/criminal/index.js';
import { CRIMINAL_ABILITY_IDS } from '../../src/domain/criminal/types.js';
import { applyUnwingedCommand } from '../../src/domain/unwinged/index.js';
import { UNWINGED_ABILITY_IDS } from '../../src/domain/unwinged/types.js';
import {
  applySerialKillerCommand, createSerialKillerState, isSerialKillerAcquisitionCommand,
  projectSerialKiller, validateSerialKillerCommand, validateSerialKillerState,
} from '../../src/domain/serial-killer/index.js';
import {
  SERIAL_KILLER_ABILITIES, SERIAL_KILLER_BOTTLE_IDS, SERIAL_KILLER_FORMULA_STATUS,
  SERIAL_KILLER_LABOUR_TASKS, SERIAL_KILLER_SOURCE_STATUS,
} from '../../src/domain/serial-killer/content.js';
import {
  SERIAL_KILLER_ABILITY_IDS, SERIAL_KILLER_CASE_IDS,
  type SerialKillerAcquisitionCommand, type SerialKillerCommand,
} from '../../src/domain/serial-killer/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('serial-killer-acquisition', sliceDefaultCreationSelection, 'serial-killer-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 20000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 18;
  s.serialKiller = createSerialKillerState();
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
/** Real prior potion identities, with the already-completed S9/S8 acting supplied as an acquisition fixture. */
function unwinged() {
  const s = ordinary(), c = context(s, 1).c;
  applyCriminalCommand(s, { type: 'DISCOVER' }, c);
  applyCriminalCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCriminalCommand(s, { type: 'BUY_POTION', bottleId: s.criminal.bottles[0]!.id }, c);
  applyCriminalCommand(s, { type: 'CONSUME', bottleId: s.criminal.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100; s.week = 9;
  applyUnwingedCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyUnwingedCommand(s, { type: 'BUY_POTION', bottleId: s.unwinged.bottles[0]!.id }, c);
  applyUnwingedCommand(s, { type: 'CONSUME', bottleId: s.unwinged.bottles[0]!.id, confirmed: true, acceptedChange: true }, c);
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS].map((id, index) => [id, index * 25]));
  s.week = 17; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 18;
  return s;
}
function apply(s: SliceState, command: SerialKillerAcquisitionCommand, roll = 20) { applySerialKillerCommand(s, command, context(s, roll).c); }
function taught(s = unwinged()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.serialKiller.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of SERIAL_KILLER_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as SerialKillerAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('SerialKiller independent S7 acquisition', () => {
  it('starts with three separate original bottles and untouched ritual cases, without a formula', () => {
    const s = ordinary(), projection = projectSerialKiller(s);
    expect(validateSerialKillerState(s)).toBe(true);
    expect(s.serialKiller.bottles.map(b => b.id)).toEqual([...SERIAL_KILLER_BOTTLE_IDS]);
    expect(s.serialKiller.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.serialKiller.cases)).toEqual([...SERIAL_KILLER_CASE_IDS]);
    expect(Object.values(s.serialKiller.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.contactOpen && c.closures === 0 && c.overclaims === 0)).toBe(true);
    expect(projection).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    const other = createSerialKillerState(); other.bottles[0]!.labourSteps = 1; other.cases['sealed-index']!.contactOpen = true;
    expect(s.serialKiller.bottles[0]!.labourSteps).toBe(0); expect(s.serialKiller.cases['sealed-index']!.contactOpen).toBe(false);
  });

  it('uses the existing adult Unwinged guide and charges 240 pence plus one AP only for guidance', () => {
    const s = unwinged(), old = JSON.stringify([s.criminal, s.unwinged, s.progression]), ctx = context(s);
    rejected(s, { type: 'BUY_POTION', bottleId: SERIAL_KILLER_BOTTLE_IDS[0] });
    applySerialKillerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.serialKiller.guidanceKnown]).toEqual([9760, 39, true]);
    for (const text of ['通过已有折翼天使渠道', '成年', '罗安·费里']) expect(ctx.notes[0]!.text).toContain(text);
    expect(projectSerialKiller(s).supplies).toContain(SERIAL_KILLER_FORMULA_STATUS);
    expect(JSON.stringify([s.criminal, s.unwinged, s.progression])).toBe(old);
    rejected(s, { type: 'LEARN_GUIDANCE' }); expect(validateSerialKillerState(s)).toBe(true);
  });

  it('delivers an original for 2010 pence at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: SERIAL_KILLER_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.serialKiller.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 2010, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 17, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.serialKiller.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id }); rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateSerialKillerState(s)).toBe(true);
  });

  it('requires four distinct jobs for that bottle before paying the remaining 210 pence', () => {
    const s = taught(), bottleId = SERIAL_KILLER_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 4; step += 1) {
      applySerialKillerCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.serialKiller.bottles[0]!.labourSteps]).toEqual([9760, 38 - step, step + 1]);
      expect(projectSerialKiller(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(SERIAL_KILLER_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.serialKiller.bottles[1]!.labourSteps).toBe(0); rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId }); s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, s.serialKiller.bottles[0]!.status]).toEqual([0, 35, 'PLAYER']);
  });

  it('allows early preparation but requires acting100, eight whole S8 weeks and confirmation', () => {
    const s = unwinged(); s.week = 9; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 16;
    rejected(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true });
    s.week = 17; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; rejected(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.unwinged.promotionWeek, s.serialKiller.promotionWeek]).toEqual([7, 5, 9, 17]);
    expect(validateSerialKillerState(s)).toBe(true);
  });

  it('blocks unavailable channels, open prior effects, ended runs and unrestored health without mutation', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.criminal.discovered = false; },
      s => { s.criminal.guidanceKnown = false; }, s => { s.unwinged.guidanceKnown = false; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; }, s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.criminal.cases['found-pay']!.holding = true; },
      s => { s.unwinged.cases['cold-grip']!.urgeOpen = true; },
      s => { s.unwinged.conscienceLost = false; },
      s => { s.serialKiller.cases['empty-circle']!.contactOpen = true; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true }); }
    const s = unwinged(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: SERIAL_KILLER_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true }); expect(s.actionsRemaining).toBe(0);
  });

  it('resolves all four tiers with one will18 check, no death draw, and unchanged S9/S8 histories', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify([s.criminal, s.unwinged]), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7; const chance = projectSerialKiller(s).bottles[0]!.chance;
      applySerialKillerCommand(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 18, difficulty: 18, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.serialKiller.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 17, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['abyss', success ? 7 : 8, 5, success ? 0 : 100]);
      expect([s.serialKiller.promotionWeek, s.serialKiller.unwingedActingAtPromotion]).toEqual(success ? [17, 100] : [null, null]);
      expect(JSON.stringify([s.criminal, s.unwinged])).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      expect(s.unwinged.conscienceLost).toBe(true);
      for (const id of [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS]) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 1], ['perception', 1], ['will', 1], ['knowledge', 2]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS, ...SERIAL_KILLER_ABILITY_IDS] : [...CRIMINAL_ABILITY_IDS, ...UNWINGED_ABILITY_IDS]);
      if (success) { for (const id of SERIAL_KILLER_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0); expect(projectSliceState(s).maxSpirituality).toBe(60); }
      expect(s.status).toBe('ACTIVE'); expect(validateSerialKillerState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps granted attributes at500 and never creates additional mastery bars or invented spells', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 500 });
    expect(projectSerialKiller(s).abilities.map(a => a.id)).toEqual(['abyss.s7.demonic-lore', 'abyss.s7.ritual-practice']);
  });

  it('retains unused originals after success but never permits duplicate preparation or consumption', () => {
    const s = prepared(); buy(s, 1); const held = structuredClone(s.serialKiller.bottles[1]);
    apply(s, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true });
    expect(s.serialKiller.bottles[1]).toEqual(held);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'BUY_POTION', bottleId: SERIAL_KILLER_BOTTLE_IDS[2] },
      { type: 'POTION_WORK', bottleId: SERIAL_KILLER_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectSerialKiller(s).actions.every(a => !a.enabled)).toBe(true); expect(validateSerialKillerState(s)).toBe(true);
  });

  it('requests the next finite batch at1AP and receives three new identities only next real week', () => {
    const s = exhausted(), old = JSON.stringify(s.serialKiller.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.serialKiller.resupply.requestedWeek, s.serialKiller.bottles.length]).toEqual([ap - 1, 17, 3]);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    s.week = 18; s.actionsRemaining = 0; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.serialKiller.bottles.slice(0, 3))).toBe(old);
    expect([s.cash, s.actionsRemaining, s.serialKiller.resupply.deliveries, s.serialKiller.resupply.requestedWeek]).toEqual([cash, 0, 1, null]);
    expect(s.serialKiller.bottles.slice(3).map(b => b.id)).toEqual(['serial-killer-potion-4', 'serial-killer-potion-5', 'serial-killer-potion-6']);
    expect(s.serialKiller.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.acquiredWeek === null && b.source.includes('第18周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'serial-killer-potion-4', confirmed: true }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'serial-killer-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 210);
    apply(s, { type: 'CONSUME', bottleId: 'serial-killer-potion-4', confirmed: true });
    expect([s.unwinged.promotionWeek, s.serialKiller.promotionWeek]).toEqual([9, 18]); expect(validateSerialKillerState(s)).toBe(true);
  });

  it('never refills automatically or supplies while an original remains or promotion succeeded', () => {
    for (const s of [ordinary(), unwinged(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10; expect(s.serialKiller.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('validates exact declared commands and routes activities separately from acquisition', () => {
    const commands: SerialKillerCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: SERIAL_KILLER_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'serial-killer-potion-99' },
      { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0], confirmed: true }, { type: 'REFLECT' },
      ...SERIAL_KILLER_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'CLOSE', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['RITUAL', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
        ...(['LIMITED', 'CERTAIN'] as const).map(claim => ({ type: 'REPORT' as const, caseId, claim })),
      ]),
    ];
    for (const command of commands) { expect(validateSerialKillerCommand(command)).toBe(true); if (!isSerialKillerAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'BUY_POTION', bottleId: 'unwinged-potion-1' },
      { type: 'BUY_POTION', bottleId: 'serial-killer-potion-01' }, { type: 'CONSUME', bottleId: SERIAL_KILLER_BOTTLE_IDS[0] },
      { type: 'PREPARE', caseId: 'sealed-index', method: 'TEAM' }, { type: 'CLOSE', caseId: 'empty-circle', refund: true },
      { type: 'REPORT', caseId: 'false-dedication', claim: 'COMPLETE' }, { type: 'REPORT', caseId: 'false-dedication' },
      { type: 'REPORT', caseId: 'false-dedication', claim: 'LIMITED', free: true }, { type: 'STOP', caseId: 'empty-circle' },
      { type: 'LEARN_SPELL', spellId: 'resurrection' }, { type: 'LEARN_SPELL', spellId: 'light-touch', mastered: true },
    ]) { expect(validateSerialKillerCommand(command)).toBe(false); expect(isSerialKillerAcquisitionCommand(command)).toBe(false); rejected(prepared(), command); }
  });

  it('rejects forged bottle chronology, lost inherited mastery and malformed case shapes', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.serialKiller.bottles[0]!.id = 'unwinged-potion-1'; }, s => { s.serialKiller.bottles[0]!.source = 'invented'; },
      s => { s.serialKiller.bottles[0]!.labourSteps = 5; }, s => { s.serialKiller.bottles[0]!.consumedWeek = 16; },
      s => { s.serialKiller.unwingedActingAtPromotion = 99; }, s => { s.serialKiller.promotionWeek = 16; },
      s => { delete s.progression.mastery[CRIMINAL_ABILITY_IDS[0]]; }, s => { delete s.progression.mastery[UNWINGED_ABILITY_IDS[0]]; },
      s => { s.progression.mastery['abyss.s6.danger-sense'] = 0; }, s => { delete s.serialKiller.cases['false-dedication']; },
      s => { s.serialKiller.resupply.deliveries = 1; },
      s => { s.unwinged.conscienceLost = false; },
      s => { (s.unwinged as unknown as Record<string, unknown>).conscienceLost = 'true'; },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateSerialKillerState(s)).toBe(false); }
    const empty = ordinary(); empty.serialKiller.cases['sealed-index']!.status = 'OBSERVED'; expect(validateSerialKillerState(empty)).toBe(false);
    const supplied = exhausted(); apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 18; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    supplied.serialKiller.bottles[3]!.source = supplied.serialKiller.bottles[3]!.source.replace('第18周实收入库', '第17周实收入库'); expect(validateSerialKillerState(supplied)).toBe(false);
  });

  it('validates exact ritual case shape and mature activity chronology without inventing spell lessons', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.serialKiller.cases['sealed-index']!.attemptWeek = 16; },
      s => { s.serialKiller.cases['empty-circle']!.attemptWeek = 18; },
      s => { delete s.serialKiller.cases['false-dedication']; },
      s => { (s.serialKiller as unknown as Record<string, unknown>).lessons = {}; },
      s => { (s.serialKiller.cases['sealed-index'] as unknown as Record<string, unknown>).contactOpen = 'yes'; },
      s => { delete (s.serialKiller.cases['sealed-index'] as unknown as Record<string, unknown>).contactOpen; },
      s => { s.serialKiller.cases['sealed-index']!.closures = -1; },
      s => { s.serialKiller.cases['empty-circle']!.overclaims = 0.5; },
      s => { s.serialKiller.cases['false-dedication']!.withdrawals = -1; },
    ];
    for (const mutate of changes) { const s = structuredClone(valid); mutate(s); expect(validateSerialKillerState(s)).toBe(false); }
    const early = unwinged(); early.serialKiller.cases['sealed-index']!.attemptWeek = 17; expect(validateSerialKillerState(early)).toBe(false);
  });

  it('shows prior conscience loss and advancing risks while requiring only this bottle confirmation', () => {
    const s = prepared(), projection = projectSerialKiller(s), bottleId = SERIAL_KILLER_BOTTLE_IDS[0];
    const action = projection.actions.find(a => a.id === `consume-${bottleId}`)!;
    expect(s.unwinged.conscienceLost).toBe(true);
    expect(action.command).toEqual({ type: 'CONSUME', bottleId, confirmed: true });
    expect(action.cost).toContain('良知丧失保留'); expect(action.cost).toContain('进阶排异风险');
    expect(projection.risk).toContain('已经失去原有良知');
    rejected(s, { type: 'CONSUME', bottleId, confirmed: true, acceptedChange: true });
    rejected(s, { type: 'CONSUME', bottleId, confirmed: false });
    const prior = JSON.stringify(s.unwinged);
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(JSON.stringify(s.unwinged)).toBe(prior);
    expect(projectSerialKiller(s).digestion).toContain('良知丧失仍保留');
  });

  it('projects insideCase from actual contact rather than a prepared or merely examined status', () => {
    const s = promoted(), scene = s.serialKiller.cases['empty-circle']!;
    scene.status = 'PREPARED'; scene.method = 'RITUAL';
    expect(projectSerialKiller(s).insideCase).toBe(false);
    scene.contactOpen = true; expect(projectSerialKiller(s).insideCase).toBe(true);
    scene.contactOpen = false; scene.status = 'EXAMINED'; expect(projectSerialKiller(s).insideCase).toBe(false);
  });

  it('separates source-supported knowledge and rituals from costly G digestion without higher-sequence spells', () => {
    for (const text of ['第二部第45章', '杀人案', 'L46883', 'L46893', '第二部第92章', '侦探交流会', 'L55170', 'L55178', '克莱恩推断', '单靠时间推进', '本作原创G', '不是原著保证', '第二部第98章', '序列6', '序列5']) expect(SERIAL_KILLER_SOURCE_STATUS).toContain(text);
    expect(SERIAL_KILLER_ABILITIES.map(a => a.id)).toEqual(['abyss.s7.demonic-lore', 'abyss.s7.ritual-practice']);
    expect(SERIAL_KILLER_ABILITIES[0]!.description).toContain('有限');
    expect(SERIAL_KILLER_ABILITIES[1]!.description).toContain('实际退出');
    expect(projectSerialKiller(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
