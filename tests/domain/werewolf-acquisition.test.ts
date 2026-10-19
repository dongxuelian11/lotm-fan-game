import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyPrisonerCommand } from '../../src/domain/prisoner/index.js';
import { PRISONER_ABILITY_IDS } from '../../src/domain/prisoner/types.js';
import { applyMadmanCommand } from '../../src/domain/madman/index.js';
import { MADMAN_ABILITY_IDS } from '../../src/domain/madman/types.js';
import {
  applyWerewolfCommand, createWerewolfState, isWerewolfAcquisitionCommand,
  projectWerewolf, validateWerewolfCommand, validateWerewolfState,
} from '../../src/domain/werewolf/index.js';
import {
  WEREWOLF_ABILITIES, WEREWOLF_BOTTLE_IDS, WEREWOLF_FORMULA_STATUS,
  WEREWOLF_LABOUR_TASKS, WEREWOLF_MOON_EVENTS, WEREWOLF_SOURCE_STATUS,
} from '../../src/domain/werewolf/content.js';
import {
  WEREWOLF_ABILITY_IDS, WEREWOLF_CASE_IDS,
  type WerewolfAcquisitionCommand, type WerewolfCommand,
} from '../../src/domain/werewolf/types.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { PublicCoreStatKey } from '../../src/shared/contracts.js';

function ordinary(): SliceState {
  const s = createSliceRun('werewolf-acquisition', sliceDefaultCreationSelection, 'werewolf-fixed-seed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5;
  s.cash = 20000; s.actionsRemaining = 40; s.weeklyBudget = 40;
  s.character.coreStats.will = 18;
  s.werewolf = createWerewolfState();
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
function madman() {
  const s = ordinary(), c = context(s, 1).c;
  applyPrisonerCommand(s, { type: 'DISCOVER' }, c);
  applyPrisonerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyPrisonerCommand(s, { type: 'BUY_POTION', bottleId: s.prisoner.bottles[0]!.id }, c);
  applyPrisonerCommand(s, { type: 'CONSUME', bottleId: s.prisoner.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100; s.week = 9;
  applyMadmanCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyMadmanCommand(s, { type: 'BUY_POTION', bottleId: s.madman.bottles[0]!.id }, c);
  applyMadmanCommand(s, { type: 'CONSUME', bottleId: s.madman.bottles[0]!.id, confirmed: true }, c);
  s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS].map((id, index) => [id, index * 25]));
  s.week = 17; s.cash = 10000; s.actionsRemaining = 40; s.health = 100; s.mind = 100;
  s.character.coreStats.will = 18;
  return s;
}
function apply(s: SliceState, command: WerewolfAcquisitionCommand, roll = 20) { applyWerewolfCommand(s, command, context(s, roll).c); }
function taught(s = madman()) { apply(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) {
  const bottle = s.werewolf.bottles[index]!;
  apply(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle;
}
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); apply(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true }); return s; }
function exhausted() {
  const s = taught();
  for (let index = 0; index < 3; index += 1) buy(s, index);
  for (const bottleId of WEREWOLF_BOTTLE_IDS) apply(s, { type: 'CONSUME', bottleId, confirmed: true }, 80);
  return s;
}
function rejected(s: SliceState, command: unknown) {
  const before = JSON.stringify(s);
  expect(() => apply(s, command as WerewolfAcquisitionCommand)).toThrow();
  expect(JSON.stringify(s)).toBe(before);
}

describe('Werewolf independent S7 acquisition', () => {
  it('starts with three separate original bottles and untouched practice cases, without a formula', () => {
    const s = ordinary(), projection = projectWerewolf(s);
    expect(validateWerewolfState(s)).toBe(true);
    expect(s.werewolf.bottles.map(b => b.id)).toEqual([...WEREWOLF_BOTTLE_IDS]);
    expect(s.werewolf.bottles.every(b => b.status === 'SUPPLIER' && b.labourSteps === 0 && b.acquiredWeek === null && b.consumedWeek === null && b.outcome === null)).toBe(true);
    expect(Object.keys(s.werewolf.cases)).toEqual([...WEREWOLF_CASE_IDS]);
    expect(Object.values(s.werewolf.cases).every(c => c.status === 'AVAILABLE' && c.method === null && c.attemptWeek === null && c.outcome === 'NONE' && !c.sceneOpen && c.returns === 0)).toBe(true);
    expect(projection).toMatchObject({ discovered: false, formulaKnown: false, formula: [], actions: [], bottles: [], cases: [], abilities: [], insideCase: false });
    expect(s.werewolf.moon).toEqual({ pendingWeek: null, history: [] });
    expect(s.werewolf).not.toHaveProperty('conscienceLost');
    expect(projection.moon).toEqual({ pending: false, summary: '', history: [] });
    const other = createWerewolfState(); other.bottles[0]!.labourSteps = 1; other.cases['existing-wound']!.sceneOpen = true;
    other.moon.history.push({ week: 32, method: 'GUARDED', mentalCost: 10 });
    expect(s.werewolf.bottles[0]!.labourSteps).toBe(0); expect(s.werewolf.cases['existing-wound']!.sceneOpen).toBe(false);
    expect(s.werewolf.moon.history).toEqual([]);
  });

  it('uses the existing adult Madman guide and charges 240 pence plus one AP only for guidance', () => {
    const s = madman(), old = JSON.stringify([s.prisoner, s.madman, s.progression]), ctx = context(s);
    rejected(s, { type: 'BUY_POTION', bottleId: WEREWOLF_BOTTLE_IDS[0] });
    applyWerewolfCommand(s, { type: 'LEARN_GUIDANCE' }, ctx.c);
    expect([s.cash, s.actionsRemaining, s.werewolf.guidanceKnown]).toEqual([9760, 39, true]);
    for (const text of ['通过已有疯子渠道', '成年', '哈伦·维斯']) expect(ctx.notes[0]!.text).toContain(text);
    expect(projectWerewolf(s).supplies).toContain(WEREWOLF_FORMULA_STATUS);
    expect(JSON.stringify([s.prisoner, s.madman, s.progression])).toBe(old);
    rejected(s, { type: 'LEARN_GUIDANCE' }); expect(validateWerewolfState(s)).toBe(true);
  });

  it('delivers an original for 2010 pence at zero AP with no partial labour discount', () => {
    const s = taught(); apply(s, { type: 'POTION_WORK', bottleId: WEREWOLF_BOTTLE_IDS[0] });
    const ap = s.actionsRemaining, cash = s.cash, others = JSON.stringify(s.werewolf.bottles.slice(1));
    const bottle = buy(s);
    expect([s.cash, s.actionsRemaining]).toEqual([cash - 2010, ap]);
    expect(bottle).toMatchObject({ status: 'PLAYER', acquiredWeek: 17, labourSteps: 1, consumedWeek: null, outcome: null });
    expect(JSON.stringify(s.werewolf.bottles.slice(1))).toBe(others);
    rejected(s, { type: 'BUY_POTION', bottleId: bottle.id }); rejected(s, { type: 'POTION_WORK', bottleId: bottle.id });
    expect(validateWerewolfState(s)).toBe(true);
  });

  it('requires four distinct jobs for that bottle before paying the remaining 210 pence', () => {
    const s = taught(), bottleId = WEREWOLF_BOTTLE_IDS[0], ctx = context(s);
    for (let step = 0; step < 4; step += 1) {
      applyWerewolfCommand(s, { type: 'POTION_WORK', bottleId }, ctx.c);
      expect([s.cash, s.actionsRemaining, s.werewolf.bottles[0]!.labourSteps]).toEqual([9760, 38 - step, step + 1]);
      expect(projectWerewolf(s).actions.find(a => a.id === `buy-${bottleId}`)!.cost).toContain(`${step === 3 ? 210 : 2010}便士`);
    }
    expect(ctx.notes.map(n => n.title)).toEqual(WEREWOLF_LABOUR_TASKS.map(task => `完成${task}`));
    expect(s.werewolf.bottles[1]!.labourSteps).toBe(0); rejected(s, { type: 'POTION_WORK', bottleId });
    s.cash = 209; rejected(s, { type: 'BUY_POTION', bottleId }); s.cash = 210; buy(s);
    expect([s.cash, s.actionsRemaining, s.werewolf.bottles[0]!.status]).toEqual([0, 35, 'PLAYER']);
  });

  it('allows early preparation but requires acting100, eight whole S8 weeks and confirmation', () => {
    const s = madman(); s.week = 9; s.progression.acting = 0; taught(s); buy(s);
    rejected(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; s.week = 16;
    rejected(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true });
    s.week = 17; s.progression.acting = 99;
    rejected(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true });
    s.progression.acting = 100; rejected(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0] });
    apply(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true });
    expect([s.progression.sequence, s.progression.promotionWeek, s.madman.promotionWeek, s.werewolf.promotionWeek]).toEqual([7, 5, 9, 17]);
    expect(validateWerewolfState(s)).toBe(true);
  });

  it('blocks unavailable channels, open prior effects, ended runs and unrestored health without mutation', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.progression.pathwayId = 'diviner'; }, s => { s.prisoner.discovered = false; },
      s => { s.prisoner.guidanceKnown = false; }, s => { s.madman.guidanceKnown = false; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.activeEvent = { id: 'test', instanceId: 'test' }; }, s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.prisoner.cases['jammed-shutter']!.holding = true; },
      s => { s.madman.cases['stop-bell']!.burstOpen = true; },
      s => { s.werewolf.cases['claw-mark']!.sceneOpen = true; },
      s => { s.werewolf.moon.pendingWeek = s.week; },
    ];
    for (const change of changes) { const s = prepared(); change(s); rejected(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true }); }
    const s = madman(); s.actionsRemaining = 0; rejected(s, { type: 'LEARN_GUIDANCE' });
    s.actionsRemaining = 1; taught(s); rejected(s, { type: 'POTION_WORK', bottleId: WEREWOLF_BOTTLE_IDS[0] });
    buy(s); apply(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true }); expect(s.actionsRemaining).toBe(0);
  });

  it('resolves all four tiers with one will18 check, no death draw, and unchanged S9/S8 histories', () => {
    for (const [roll, tier, mindCost, healthCost, pollution, success] of [
      [1, 'GREAT_SUCCESS', 5, 0, 0, true], [20, 'SUCCESS', 10, 0, 0, true],
      [80, 'FAILURE', 20, 10, 25, false], [100, 'GREAT_FAILURE', 40, 20, 50, false],
    ] as const) {
      const s = prepared(), stats = { ...s.character.coreStats }, old = JSON.stringify([s.prisoner, s.madman]), mastery = { ...s.progression.mastery };
      const sources = [...s.seer.completedSources], cash = s.cash, ap = s.actionsRemaining, ctx = context(s, roll);
      s.spirituality = 7; const chance = projectWerewolf(s).bottles[0]!.chance;
      applyWerewolfCommand(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true }, ctx.c);
      expect(ctx.checks).toEqual([['will', 18]]); expect(ctx.draws).toEqual([]);
      expect(chance).toBe(computeCheckChance({ baseAbility: 18, difficulty: 18, modifiers: [] }));
      expect(s.lastCheck).toMatchObject({ chance, tier });
      expect([s.mind, s.health, s.seer.pollution, s.cash, s.actionsRemaining, s.spirituality]).toEqual([100 - mindCost, 100 - healthCost, pollution, cash, ap, 7]);
      expect(s.werewolf.bottles[0]).toMatchObject({ status: 'CONSUMED', consumedWeek: 17, outcome: tier });
      expect([s.progression.pathwayId, s.progression.sequence, s.progression.promotionWeek, s.progression.acting]).toEqual(['chained', success ? 7 : 8, 5, success ? 0 : 100]);
      expect([s.werewolf.promotionWeek, s.werewolf.madmanActingAtPromotion]).toEqual(success ? [17, 100] : [null, null]);
      expect(JSON.stringify([s.prisoner, s.madman])).toBe(old); expect(s.seer.completedSources).toEqual(sources);
      for (const id of [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS]) expect(s.progression.mastery[id]).toBe(mastery[id]);
      for (const [stat, increase] of [['physique', 2], ['perception', 1], ['will', 1], ['knowledge', 0]] as const) expect(s.character.coreStats[stat]).toBe(stats[stat] + (success ? increase : 0));
      expect(Object.keys(s.progression.mastery)).toEqual(success ? [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS, ...WEREWOLF_ABILITY_IDS] : [...PRISONER_ABILITY_IDS, ...MADMAN_ABILITY_IDS]);
      if (success) { for (const id of WEREWOLF_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0); expect(projectSliceState(s).maxSpirituality).toBe(60); }
      expect(s.status).toBe('ACTIVE'); expect(validateWerewolfState(s)).toBe(true);
      rejected(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true });
    }
  });

  it('caps granted attributes at500 and never creates additional mastery bars or invented spells', () => {
    const s = prepared();
    for (const stat of ['physique', 'perception', 'will', 'knowledge'] as const) s.character.coreStats[stat] = 499;
    apply(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true });
    expect(s.character.coreStats).toMatchObject({ physique: 500, perception: 500, will: 500, knowledge: 499 });
    expect(projectWerewolf(s).abilities.map(a => a.id)).toEqual(['chained.s7.werewolf-body', 'chained.s7.regeneration', 'chained.s7.toxic-claws']);
  });

  it('retains unused originals after success but never permits duplicate preparation or consumption', () => {
    const s = prepared(); buy(s, 1); const held = structuredClone(s.werewolf.bottles[1]);
    apply(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true });
    expect(s.werewolf.bottles[1]).toEqual(held);
    for (const command of [
      { type: 'LEARN_GUIDANCE' }, { type: 'BUY_POTION', bottleId: WEREWOLF_BOTTLE_IDS[2] },
      { type: 'POTION_WORK', bottleId: WEREWOLF_BOTTLE_IDS[2] }, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[1], confirmed: true },
    ]) rejected(s, command);
    expect(projectWerewolf(s).actions.every(a => !a.enabled)).toBe(true); expect(validateWerewolfState(s)).toBe(true);
  });

  it('requests the next finite batch at1AP and receives three new identities only next real week', () => {
    const s = exhausted(), old = JSON.stringify(s.werewolf.bottles), cash = s.cash, ap = s.actionsRemaining;
    apply(s, { type: 'REQUEST_SUPPLY' });
    expect([s.actionsRemaining, s.werewolf.resupply.requestedWeek, s.werewolf.bottles.length]).toEqual([ap - 1, 17, 3]);
    rejected(s, { type: 'RECEIVE_SUPPLY' }); rejected(s, { type: 'REQUEST_SUPPLY' });
    s.week = 18; s.actionsRemaining = 0; apply(s, { type: 'RECEIVE_SUPPLY' });
    expect(JSON.stringify(s.werewolf.bottles.slice(0, 3))).toBe(old);
    expect([s.cash, s.actionsRemaining, s.werewolf.resupply.deliveries, s.werewolf.resupply.requestedWeek]).toEqual([cash, 0, 1, null]);
    expect(s.werewolf.bottles.slice(3).map(b => b.id)).toEqual(['werewolf-potion-4', 'werewolf-potion-5', 'werewolf-potion-6']);
    expect(s.werewolf.bottles.slice(3).every(b => b.status === 'SUPPLIER' && b.acquiredWeek === null && b.source.includes('第18周实收入库'))).toBe(true);
    rejected(s, { type: 'CONSUME', bottleId: 'werewolf-potion-4', confirmed: true }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    s.actionsRemaining = 4;
    for (let i = 0; i < 4; i += 1) apply(s, { type: 'POTION_WORK', bottleId: 'werewolf-potion-4' });
    buy(s, 3); expect(s.cash).toBe(cash - 210);
    apply(s, { type: 'CONSUME', bottleId: 'werewolf-potion-4', confirmed: true });
    expect([s.madman.promotionWeek, s.werewolf.promotionWeek]).toEqual([9, 18]); expect(validateWerewolfState(s)).toBe(true);
  });

  it('never refills automatically or supplies while an original remains or promotion succeeded', () => {
    for (const s of [ordinary(), madman(), taught(), prepared(), promoted()]) {
      rejected(s, { type: 'REQUEST_SUPPLY' }); rejected(s, { type: 'RECEIVE_SUPPLY' });
    }
    const s = exhausted(); s.week += 10; expect(s.werewolf.bottles).toHaveLength(3);
    s.actionsRemaining = 0; rejected(s, { type: 'REQUEST_SUPPLY' });
  });

  it('validates exact declared commands and routes activities separately from acquisition', () => {
    const commands: WerewolfCommand[] = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'POTION_WORK', bottleId: WEREWOLF_BOTTLE_IDS[0] }, { type: 'BUY_POTION', bottleId: 'werewolf-potion-99' },
      { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true }, { type: 'REFLECT' },
      { type: 'HANDLE_MOON', method: 'GUARDED' }, { type: 'HANDLE_MOON', method: 'ALONE' },
      ...WEREWOLF_CASE_IDS.flatMap(caseId => [
        ...(['OBSERVE', 'PERFORM', 'RETURN', 'REPORT', 'WITHDRAW'] as const).map(type => ({ type, caseId })),
        ...(['ABILITY', 'ORDINARY'] as const).map(method => ({ type: 'PREPARE' as const, caseId, method })),
      ]),
    ];
    for (const command of commands) { expect(validateWerewolfCommand(command)).toBe(true); if (!isWerewolfAcquisitionCommand(command)) rejected(prepared(), command); }
    for (const command of [
      null, [], {}, { type: 'DISCOVER' }, { type: 'LEARN_FORMULA' }, { type: 'BREW' },
      { type: 'LEARN_GUIDANCE', free: true }, { type: 'BUY_POTION', bottleId: 'madman-potion-1' },
      { type: 'BUY_POTION', bottleId: 'werewolf-potion-01' }, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0] },
      { type: 'PREPARE', caseId: 'existing-wound', method: 'TEAM' }, { type: 'CLOSE', caseId: 'claw-mark', refund: true },
      { type: 'REPORT', caseId: 'night-route', claim: 'COMPLETE' }, { type: 'REPORT', caseId: 'other' },
      { type: 'REPORT', caseId: 'night-route', claim: 'LIMITED', free: true }, { type: 'STOP', caseId: 'claw-mark' },
      { type: 'LEARN_SPELL', spellId: 'resurrection' }, { type: 'LEARN_SPELL', spellId: 'light-touch', mastered: true },
      { type: 'HANDLE_MOON' }, { type: 'HANDLE_MOON', method: 'CURE' },
      { type: 'HANDLE_MOON', method: 'GUARDED', free: true }, { type: 'HANDLE_MOON', method: 'ALONE', week: 20 },
    ]) { expect(validateWerewolfCommand(command)).toBe(false); expect(isWerewolfAcquisitionCommand(command)).toBe(false); rejected(prepared(), command); }
  });

  it('rejects forged bottle chronology, lost inherited mastery and malformed case shapes', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.werewolf.bottles[0]!.id = 'madman-potion-1'; }, s => { s.werewolf.bottles[0]!.source = 'invented'; },
      s => { s.werewolf.bottles[0]!.labourSteps = 5; }, s => { s.werewolf.bottles[0]!.consumedWeek = 16; },
      s => { s.werewolf.madmanActingAtPromotion = 99; }, s => { s.werewolf.promotionWeek = 16; },
      s => { delete s.progression.mastery[PRISONER_ABILITY_IDS[0]]; }, s => { delete s.progression.mastery[MADMAN_ABILITY_IDS[0]]; },
      s => { s.progression.mastery['chained.s6.iron-body'] = 0; }, s => { delete s.werewolf.cases['night-route']; },
      s => { s.werewolf.resupply.deliveries = 1; },
    ];
    for (const change of changes) { const s: SliceState = structuredClone(valid); change(s); expect(validateWerewolfState(s)).toBe(false); }
    const empty = ordinary(); empty.werewolf.cases['existing-wound']!.status = 'OBSERVED'; expect(validateWerewolfState(empty)).toBe(false);
    const supplied = exhausted(); apply(supplied, { type: 'REQUEST_SUPPLY' }); supplied.week = 18; apply(supplied, { type: 'RECEIVE_SUPPLY' });
    supplied.werewolf.bottles[3]!.source = supplied.werewolf.bottles[3]!.source.replace('第18周实收入库', '第17周实收入库'); expect(validateWerewolfState(supplied)).toBe(false);
  });

  it('validates exact practice case shape and mature activity chronology without inventing spell lessons', () => {
    const valid = promoted();
    const changes: ((s: SliceState) => void)[] = [
      s => { s.werewolf.cases['existing-wound']!.attemptWeek = 16; },
      s => { s.werewolf.cases['claw-mark']!.attemptWeek = 18; },
      s => { delete s.werewolf.cases['night-route']; },
      s => { (s.werewolf as unknown as Record<string, unknown>).lessons = {}; },
      s => { (s.werewolf.cases['existing-wound'] as unknown as Record<string, unknown>).sceneOpen = 'yes'; },
      s => { delete (s.werewolf.cases['existing-wound'] as unknown as Record<string, unknown>).sceneOpen; },
      s => { s.werewolf.cases['existing-wound']!.returns = -1; },
      s => { s.werewolf.cases['claw-mark']!.returns = 0.5; },
      s => { s.werewolf.cases['night-route']!.withdrawals = -1; },
    ];
    for (const mutate of changes) { const s = structuredClone(valid); mutate(s); expect(validateWerewolfState(s)).toBe(false); }
    const early = madman(); early.werewolf.cases['existing-wound']!.attemptWeek = 17; expect(validateWerewolfState(early)).toBe(false);
  });

  it('shows body change and unavoidable monthly curse before the sole bottle confirmation', () => {
    const s = prepared(), projection = projectWerewolf(s), bottleId = WEREWOLF_BOTTLE_IDS[0];
    const action = projection.actions.find(a => a.id === `consume-${bottleId}`)!;
    expect(action.command).toEqual({ type: 'CONSUME', bottleId, confirmed: true });
    expect(action.cost).toContain('狼人身体变化'); expect(action.cost).toContain('每月满月诅咒'); expect(action.cost).toContain('进阶排异风险');
    for (const risk of ['身体变化', '失去大部分理智', '黑毛', '嗜血', '节制或消化不能免除', '八场', '不按四周自动推算', '本作原创G']) expect(projection.risk).toContain(risk);
    rejected(s, { type: 'CONSUME', bottleId, confirmed: true, acceptedChange: true });
    rejected(s, { type: 'CONSUME', bottleId, confirmed: false });
    const prior = JSON.stringify(s.madman);
    apply(s, { type: 'CONSUME', bottleId, confirmed: true });
    expect(JSON.stringify(s.madman)).toBe(prior);
    expect(projectWerewolf(s).digestion).toContain('满月诅咒仍保留');
  });

  it('projects insideCase from actual contact rather than a prepared or merely examined status', () => {
    const s = promoted(), scene = s.werewolf.cases['claw-mark']!;
    scene.status = 'PREPARED'; scene.method = 'ABILITY';
    expect(projectWerewolf(s).insideCase).toBe(false);
    scene.sceneOpen = true; expect(projectWerewolf(s).insideCase).toBe(true);
    scene.sceneOpen = false; scene.status = 'EXAMINED'; expect(projectWerewolf(s).insideCase).toBe(false);
    s.week = 32; s.werewolf.moon.pendingWeek = 32;
    expect(projectWerewolf(s).insideCase).toBe(true);
    expect(projectWerewolf(s).moon.pending).toBe(true);
    s.werewolf.moon.pendingWeek = null;
    expect(projectWerewolf(s).insideCase).toBe(false);
  });

  it('accepts bounded recorded moon costs and projects independent historical records', () => {
    const s = promoted(); s.week = 41;
    s.werewolf.moon.history = [
      { week: 32, method: 'GUARDED', mentalCost: 10 },
      { week: 37, method: 'ALONE', mentalCost: 20 },
    ];
    s.werewolf.moon.pendingWeek = 41;
    expect(validateWerewolfState(s)).toBe(true);
    const projection = projectWerewolf(s);
    expect(projection.moon).toMatchObject({ pending: true, history: s.werewolf.moon.history });
    expect(projection.moon.summary).toContain('本作G');
    expect(projection.moon.summary).toContain('不能靠节制或消化消除');
    expect(projection.moon.summary).toContain('第41周');
    expect(projection.moon.summary).toContain(WEREWOLF_MOON_EVENTS[2].title);
    projection.moon.history[0]!.mentalCost = 0;
    expect(s.werewolf.moon.history[0]!.mentalCost).toBe(10);
    s.werewolf.moon.history[0]!.mentalCost = 0;
    s.werewolf.moon.history[1]!.mentalCost = 1;
    expect(validateWerewolfState(s)).toBe(true);
  });

  it('rejects malformed moon shapes, duplicate or unregistered weeks, unsupported methods and excessive costs', () => {
    const valid = promoted(); valid.week = 41;
    valid.werewolf.moon.history = [{ week: 32, method: 'GUARDED', mentalCost: 10 }];
    const invalid: unknown[] = [
      null, [], {}, { pendingWeek: null, history: [], free: true }, { pendingWeek: null, history: null },
      { pendingWeek: null, history: [null] },
      { pendingWeek: null, history: [{ week: 32, method: 'GUARDED', mentalCost: 10, cured: true }] },
      { pendingWeek: null, history: [{ week: 0, method: 'GUARDED', mentalCost: 10 }] },
      { pendingWeek: null, history: [{ week: 36, method: 'GUARDED', mentalCost: 10 }] },
      { pendingWeek: null, history: [{ week: 46, method: 'GUARDED', mentalCost: 10 }] },
      { pendingWeek: null, history: [{ week: 32.5, method: 'GUARDED', mentalCost: 10 }] },
      { pendingWeek: null, history: [{ week: 32, method: 'CURE', mentalCost: 10 }] },
      { pendingWeek: null, history: [{ week: 32, method: 'GUARDED', mentalCost: 11 }] },
      { pendingWeek: null, history: [{ week: 32, method: 'ALONE', mentalCost: 21 }] },
      { pendingWeek: null, history: [{ week: 32, method: 'ALONE', mentalCost: -1 }] },
      { pendingWeek: null, history: [{ week: 32, method: 'ALONE', mentalCost: 0.5 }] },
      { pendingWeek: null, history: [{ week: 32, method: 'ALONE', mentalCost: Number.NaN }] },
      { pendingWeek: null, history: [{ week: 32, method: 'GUARDED', mentalCost: 10 }, { week: 32, method: 'ALONE', mentalCost: 20 }] },
    ];
    for (const moon of invalid) {
      const s = structuredClone(valid); (s.werewolf as unknown as Record<string, unknown>).moon = moon;
      expect(validateWerewolfState(s)).toBe(false);
    }
  });

  it('requires the current pending registered event only after S7 and never duplicates a handled week', () => {
    const valid = promoted(); valid.week = 41;
    for (const pendingWeek of [0, 32, 37, 40, 42, 46, 41.5, Number.NaN]) {
      const s = structuredClone(valid); s.werewolf.moon.pendingWeek = pendingWeek;
      expect(validateWerewolfState(s)).toBe(false);
    }
    valid.werewolf.moon.pendingWeek = 41;
    expect(validateWerewolfState(valid)).toBe(true);
    valid.werewolf.moon.history = [{ week: 41, method: 'GUARDED', mentalCost: 10 }];
    expect(validateWerewolfState(valid)).toBe(false);
    valid.werewolf.moon.pendingWeek = null;
    expect(validateWerewolfState(valid)).toBe(true);
    const early = madman(); early.week = 32; early.werewolf.moon.pendingWeek = 32;
    expect(validateWerewolfState(early)).toBe(false);
    early.werewolf.moon.pendingWeek = null; early.werewolf.moon.history = [{ week: 32, method: 'ALONE', mentalCost: 20 }];
    expect(validateWerewolfState(early)).toBe(false);
    const unregistered = promoted(); unregistered.week = 36; unregistered.werewolf.moon.pendingWeek = 36;
    expect(validateWerewolfState(unregistered)).toBe(false);
  });

  it('leaves missing-event scheduling to life hooks instead of inventing a complete historical calendar', () => {
    const s = promoted(); s.week = 60;
    expect(validateWerewolfState(s)).toBe(true);
    s.werewolf.moon.history = [{ week: 51, method: 'ALONE', mentalCost: 0 }];
    expect(validateWerewolfState(s)).toBe(true);
    expect(projectWerewolf(s).moon.history).toEqual([{ week: 51, method: 'ALONE', mentalCost: 0 }]);
  });

  it('announces eight authored moon events and never extrapolates a lunar calendar after them', () => {
    expect(WEREWOLF_MOON_EVENTS.map(event => event.week)).toEqual([32, 37, 41, 46, 51, 55, 60, 65]);
    expect(WEREWOLF_MOON_EVENTS.map(event => event.id)).toEqual(Array.from({ length: 8 }, (_, index) => `wolf-moon-0${index + 1}`));
    expect(WEREWOLF_MOON_EVENTS.every(event => event.source === '本作原创城市月相告示事件')).toBe(true);
    const s = prepared();
    expect(projectWerewolf(s).moon.summary).toContain('第32周');
    expect(projectWerewolf(s).moon.summary).toContain(WEREWOLF_MOON_EVENTS[0].title);
    expect(projectWerewolf(s).moon.summary).toContain('不是原著月历');
    expect(projectWerewolf(s).moon.summary).toContain('不按四周自动推算');
    apply(s, { type: 'CONSUME', bottleId: WEREWOLF_BOTTLE_IDS[0], confirmed: true });
    s.week = 65; s.werewolf.moon.history = [{ week: 65, method: 'GUARDED', mentalCost: 10 }];
    expect(projectWerewolf(s).moon.summary).toContain('后续月相事件尚未展开，不代表诅咒消失');
    s.week = 70;
    expect(projectWerewolf(s).moon.summary).toContain('后续月相事件尚未展开，不代表诅咒消失');
  });

  it('keeps verified body, regeneration, claws and monthly curse separate from G growth and higher sequences', () => {
    for (const text of ['第二部第118章', '被诅咒者', 'L59584', '59620', '第二部第117章', '莎伦和马里奇的理念', 'L59463', '59481', '强大愈合力', '少数黑暗类法术', '具体法术名称尚未核实', '满月', '失去大部分理智', '黑毛', '嗜血', '本作原创G', '不保证成长就能免除诅咒', '序列6', '序列5', '毒素', '持续一定时间', '寿命短暂', '不实现感染、转化或后代控制']) expect(WEREWOLF_SOURCE_STATUS).toContain(text);
    expect(WEREWOLF_ABILITIES.map(a => a.id)).toEqual(['chained.s7.werewolf-body', 'chained.s7.regeneration', 'chained.s7.toxic-claws']);
    expect(projectWerewolf(promoted())).toMatchObject({ formulaKnown: false, formula: [] });
  });
});
