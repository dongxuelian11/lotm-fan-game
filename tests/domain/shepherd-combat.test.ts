import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createShepherdState } from '../../src/domain/shepherd/index.js';
import { SHEPHERD_SPIRITS } from '../../src/domain/shepherd/content.js';
import { activateShepherdSpirit } from '../../src/domain/shepherd/life.js';
import {
  SHEPHERD_COUNT_WHEEL, consumeShepherdBlur, currentShepherdCombatSource, drawShepherdAbility,
  finishShepherdCombatRound, isShepherd, resolveShepherdCombatAbility, shepherdAbilityWheel,
  shepherdActionCount, type ShepherdCombatSource, type ShepherdMoveId,
} from '../../src/domain/shepherd/combat.js';
import * as shepherdCombat from '../../src/domain/shepherd/combat.js';
import { applyShepherdEncounter, blockShepherdEncounter, settleShepherdEncounter, validateShepherdEncounter } from '../../src/domain/shepherd/encounter.js';
import { ROSE_BISHOP_COUNT_WHEEL, resolveRoseBishopCombatAbility, roseBishopAbilityWheel } from '../../src/domain/rose-bishop/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const H = 'hanged-man.s5.borrowed-arts', J = 'BODY_FOLLOWUP', B = 'BORROWED_WARD';
const K = 'BORROWED_CONTROL', R = 'CHECK_GRAZING', A = 'ACCIDENT';
const IRIS = 'SH5-IRIS-1', CEDRIC = 'SH5-CEDRIC-1';
const profile: readonly [ShepherdMoveId, number, SliceStance | null][] = [
  [H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], [A, 5, null],
];
/** Synthetic actual arrival for bounded engine cases; no claim of a naturally grazed fixture. */
function fixture(active: string | null = IRIS): SliceState {
  const s = createSliceRun('shepherd-combat-test', sliceDefaultCreationSelection, 'shepherd-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24; s.arc.stage = 'ENDED';
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'hanged-man', sequence: 5,
    mastery: { 'hanged-man.s5.grazing': 0, [H]: 0, 'hanged-man.s6.flesh-shaping': 0, 'hanged-man.s6.self-renewal': 0 },
    acting: 25, promotionWeek: 22 };
  s.shepherd = createShepherdState(); s.shepherd.promotionWeek = 22;
  s.shepherd.grazing.met = true; s.shepherd.grazing.activeSpiritId = active;
  for (const spirit of s.shepherd.grazing.spirits) Object.assign(spirit, { status: 'GRAZED', acquiredWeek: 23, attemptWeek: 23,
    selectedAbilities: SHEPHERD_SPIRITS.find(x => x.id === spirit.id)!.knownAbilities.map(a => a.id) });
  Object.assign(s.shepherd.cases['paper-guidance']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'PAPER_CHECKED' });
  Object.assign(s.shepherd.encounter, { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 });
  s.combat = { encounterId: 'SHEPHERD_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 80; s.town.clubLocation = 'SHOP';
  return s;
}
function reserve(s: SliceState, points = 3): void {
  s.roseBishop.reserve = { points, max: 3, packetsBought: points, lastPurchaseWeek: 20, packets: Array.from({ length: points }, (_, i) => ({
    id: `rose-bishop-ration-${i + 1}`, acquiredWeek: 20, consumedWeek: 20, status: 'CONSUMED',
  })) };
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-shepherd', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++]; if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw'); return value;
  } };
}
function ticket(id: ShepherdMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) { if (candidate === id) return start; start += weight * (stance !== null && stance === preferred ? 5 : 4); }
  throw new Error('Missing test ability');
}
function effect(s: SliceState, id: ShepherdMoveId, random = fixedRolls(), physical = 1, source: ShepherdCombatSource | null = currentShepherdCombatSource(s)) {
  return resolveShepherdCombatAbility(s, id, physical, random, source);
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const next = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    next.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw ' + index); return value;
  });
  try {
    const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length); return result;
  } finally { spy.mockRestore(); }
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
afterEach(() => vi.restoreAllMocks());

describe('Shepherd exact S5 profile and real encounter source', () => {
  it('routes only Hanged Man5 to detached30/15/20/20/10/5 and count12/20/25/23/14/6 wheels', () => {
    const s = fixture(); expect(isShepherd(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(shepherdAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(a => a.id)).toEqual(profile.map(a => a[0]));
    expect(playerAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(playerCountWheel(s)).toEqual(SHEPHERD_COUNT_WHEEL);
    playerAbilityWheel(s, null)[0]!.weight = 0; playerCountWheel(s)[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30); expect(playerCountWheel(s)[0]!.weight).toBe(12);
    s.progression.pathwayId = 'sun'; expect(isShepherd(s)).toBe(false);
  });
  it('uses exact count and integer stance-ticket boundaries with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [32, 2], [33, 3], [57, 3], [58, 4], [80, 4], [81, 5], [94, 5], [95, 6], [100, 6]]) expect(shepherdActionCount(roll!)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, w, preferred]) => w * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((a, b) => a + b, 0); let edge = 0;
      shepherdAbilityWheel(stance).forEach((entry, i) => {
        expect(entry.weight).toBe(total === 400 ? weights[i]! / 4 : weights[i]! / total * 100);
        const first = edge + 1; edge += weights[i]!; const r = fixedRolls(first, edge);
        expect(drawShepherdAbility(r, stance)).toBe(entry.id); expect(drawShepherdAbility(r, stance)).toBe(entry.id); expect(r.cursor).toBe(2);
      });
    }
  });
  it('leaves the exact old S6 wheel and own reserve budgets unchanged', () => {
    const s = fixture(); s.progression.sequence = 6;
    Object.assign(s.roseBishop.cases['ring-release']!, { status: 'RESOLVED' });
    s.roseBishop.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 };
    s.combat!.encounterId = 'ROSE_BISHOP_DISPUTE'; reserve(s);
    expect(playerAbilityWheel(s, null)).toEqual(roseBishopAbilityWheel(null, s)); expect(playerCountWheel(s)).toEqual(ROSE_BISHOP_COUNT_WHEEL);
    const old = structuredClone(s.shepherd);
    expect(resolveRoseBishopCombatAbility(s, 'hanged-man.s6.flesh-shaping', 1, fixedRolls()).selfGain).toBe(50.7 * 0.65);
    expect(s.spirituality).toBe(78); expect(s.roseBishop.reserve.points).toBe(2); expect(s.shepherd).toEqual(old); expect(currentShepherdCombatSource(s)).toBeNull();
  });
  it('binds Elton own club, actual2m daylight exit and rejects every forged source field without draws', () => {
    const s = fixture(), source = currentShepherdCombatSource(s)!;
    expect(source).toMatchObject({ target: 'ELTON_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'ELTONS_OWN_ORDINARY_SHORT_CLUB', distanceMetres: 2, daylight: true, ally: 'NONE', bystanders: 'NONE', pursuit: false });
    for (const key of Object.keys(source)) {
      const forged = { ...source, [key]: 'WRONG' } as unknown as ShepherdCombatSource, before = structuredClone(s), r = fixedRolls();
      for (const [id] of profile) expect(effect(s, id, r, 1, forged)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
    for (const mutate of [
      (v: SliceState) => { v.combat!.encounterId = 'FIRST_CASE'; }, (v: SliceState) => { v.combat!.encounterId = 'ROSE_BISHOP_DISPUTE'; },
      (v: SliceState) => { v.world.city = 'ELSEWHERE'; }, (v: SliceState) => { v.health = 0; }, (v: SliceState) => { v.mind = 0; },
      (v: SliceState) => { v.combat!.enemyHealth = 0; }, (v: SliceState) => { v.combat!.round = 2; },
      (v: SliceState) => { v.shepherd.encounter.attemptWeek = 1; }, (v: SliceState) => { v.shepherd.practice.paper = 'MARK'; },
      (v: SliceState) => { v.shepherd.practice.chorusOpen = true; }, (v: SliceState) => { v.shepherd.practice.note = 'WRITTEN'; },
      (v: SliceState) => { v.shepherd.practice.playerNode = 'MARK'; }, (v: SliceState) => { v.shepherd.cases['paper-guidance']!.contactOpen = true; },
      (v: SliceState) => { v.shepherd.cases['willing-chorus']!.status = 'PREPARED'; }, (v: SliceState) => { v.shepherd.cases['paper-guidance']!.closes = 0; },
      (v: SliceState) => { v.roseBishop.practice.shape = 'SLIM_HAND'; },
    ]) {
      const copy = fixture(); mutate(copy); const before = structuredClone(copy);
      expect(currentShepherdCombatSource(copy)).toBeNull(); expect(() => resolveSliceCombatRound(copy, 'ATTACK')).toThrow(); expect(copy).toEqual(before);
    }
  });
});

describe('Shepherd current one-soul selected methods and inherited own fallback', () => {
  it('borrows only selected current Iris methods, pays ownS and never copies wizard lessons or old reserve', () => {
    const s = fixture(); reserve(s); s.progression.mastery[H] = 500;
    const wizard = structuredClone(s.wizard), originalReserve = structuredClone(s.roseBishop.reserve), souls = structuredClone(s.shepherd.grazing);
    expect(effect(s, H).selfGain).toBe(38.025); expect(effect(s, B).enemyReduction).toBe(30); expect(s.spirituality).toBe(76);
    expect(s.wizard).toEqual(wizard); expect(s.roseBishop.reserve).toEqual(originalReserve); expect(s.shepherd.grazing).toEqual(souls);
    expect(effect(s, J).selfGain).toBe(27.3 * 0.65); expect(s.spirituality).toBe(76);
  });
  it('actual boundary switching consumes no action, spirit, time or random draw and does not release either soul', () => {
    const s = fixture(), before = structuredClone(s), ctx = context();
    activateShepherdSpirit(s, CEDRIC, ctx);
    expect(s.shepherd.grazing.activeSpiritId).toBe(CEDRIC); expect(s.shepherd.grazing.spirits).toEqual(before.shepherd.grazing.spirits);
    expect(s.actionsRemaining).toBe(before.actionsRemaining); expect(s.spirituality).toBe(before.spirituality); expect(s.week).toBe(before.week); expect(s.random).toEqual(before.random);
    activateShepherdSpirit(s, null, ctx); expect(s.shepherd.grazing.activeSpiritId).toBeNull();
    activateShepherdSpirit(s, IRIS, ctx); expect(s.shepherd.grazing.activeSpiritId).toBe(IRIS); expect(s.shepherd.grazing.spirits).toEqual(before.shepherd.grazing.spirits);
  });
  it('re-reads actual active identity each move and never borrows inactive Iris methods while Cedric is selected', () => {
    const s = fixture(); s.progression.mastery[H] = 500;
    expect(effect(s, H).selfGain).toBe(38.025);
    s.shepherd.grazing.activeSpiritId = CEDRIC; const beforeK = s.spirituality;
    expect(effect(s, H).selfGain).toBe(12); expect(effect(s, B).enemyReduction).toBe(10); expect(s.spirituality).toBe(beforeK);
    expect(effect(s, K, fixedRolls(1))).toMatchObject({ selfGain: 24, enemyReduction: 0, threatens: false });
    expect(s.shepherd.encounter.blurReady).toBe(false); expect(s.spirituality).toBe(beforeK - 2);
    s.shepherd.grazing.activeSpiritId = null; const noSoul = structuredClone(s);
    expect(effect(s, K)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); effect(s, R); expect(s).toEqual(noSoul);
  });
  it('does not use unselected, released, future, duplicated, unknown-origin or cross-source methods even at500 mastery', () => {
    for (const mutate of [
      (s: SliceState) => { s.shepherd.grazing.met = false; },
      (s: SliceState) => { s.shepherd.grazing.spirits[0]!.selectedAbilities = ['blur-mark']; },
      (s: SliceState) => { Object.assign(s.shepherd.grazing.spirits[0]!, { status: 'RELEASED', releasedWeek: 24 }); },
      (s: SliceState) => { s.shepherd.grazing.spirits[0]!.acquiredWeek = 25; },
      (s: SliceState) => { s.shepherd.grazing.spirits[0]!.selectedAbilities = ['light-touch', 'light-touch']; },
      (s: SliceState) => { s.shepherd.grazing.spirits[0]!.selectedAbilities = ['light-touch', 'courage-song']; },
      (s: SliceState) => { s.shepherd.grazing.spirits.push({ ...s.shepherd.grazing.spirits[0]! }); },
      (s: SliceState) => { s.shepherd.grazing.spirits[0]!.id = 'MADE-UP'; s.shepherd.grazing.activeSpiritId = 'MADE-UP'; },
      (s: SliceState) => { s.shepherd.grazing.activeSpiritId = CEDRIC; s.shepherd.grazing.spirits[1]!.selectedAbilities = ['light-touch']; },
    ]) {
      const s = fixture(); mutate(s); s.progression.mastery[H] = 500; const before = structuredClone(s);
      expect(effect(s, H).selfGain).toBe(12); expect(s).toEqual(before);
    }
  });
  it('uses inherited own club first then actual paid flesh/body fallback and keeps consumed packet records', () => {
    const s = fixture(null); reserve(s); s.progression.mastery['hanged-man.s6.flesh-shaping'] = 500;
    s.town.clubLocation = 'HAND'; expect(effect(s, H, fixedRolls(), 0.8).selfGain).toBe(16 * 0.8); expect(s.spirituality).toBe(80);
    s.town.clubLocation = 'SHOP'; const packets = structuredClone(s.roseBishop.reserve.packets);
    expect(effect(s, H, fixedRolls(), 0.8).selfGain).toBe(50.7 * 0.8); expect(s.spirituality).toBe(78); expect(s.roseBishop.reserve.points).toBe(2);
    expect(s.roseBishop.reserve.packets).toEqual(packets); s.spirituality = 1;
    expect(effect(s, H).selfGain).toBe(12); expect(s.spirituality).toBe(1); expect(s.roseBishop.reserve.points).toBe(2);
    const held = fixture(null); reserve(held, 1); Object.assign(held.roseBishop.reserve.packets[0]!, { status: 'HELD', consumedWeek: null });
    expect(effect(held, H).selfGain).toBe(12); expect(held.roseBishop.reserve.points).toBe(1); expect(held.spirituality).toBe(80);
  });
  it('pays inherited3S1reserve healing only when no payable ward, capsH100 and retains injuries/risk/mind', () => {
    const s = fixture(null); reserve(s); s.health = 95; s.injuryRisk = 3;
    s.injuries.push({ id: 'original-injury', severity: 'LIGHT', acquiredRevision: 0, treatedRevision: null });
    const injuries = structuredClone(s.injuries); expect(effect(s, B)).toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false });
    expect(s.health).toBe(100); expect(s.spirituality).toBe(77); expect(s.roseBishop.reserve.points).toBe(2); expect(s.injuries).toEqual(injuries); expect(s.injuryRisk).toBe(3); expect(s.mind).toBe(100);
    expect(effect(s, B).enemyReduction).toBe(10); expect(s.spirituality).toBe(77);
    s.health = 90; s.shepherd.grazing.activeSpiritId = IRIS; expect(effect(s, B).enemyReduction).toBe(30 * 0.65); expect(s.health).toBe(90); expect(s.roseBishop.reserve.points).toBe(2);
  });
  it('only a later positive ordinarySTRIKE consumes blur once, with no health, immediate gain, stacking or carryover', () => {
    const s = fixture(), original = structuredClone(s.combat); expect(effect(s, K, fixedRolls(1))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.shepherd.encounter.blurReady).toBe(true); expect(s.spirituality).toBe(78); effect(s, K); expect(s.spirituality).toBe(78);
    for (const [id, gain, suppressed] of [['BLOCK', 16, false], ['STRIKE', 0, false], ['STRIKE', -1, false], ['STRIKE', 16, true]] as const) expect(consumeShepherdBlur(s, id, gain, suppressed)).toBeNull();
    expect(consumeShepherdBlur(s, 'STRIKE', 16)?.physicalMultiplier).toBe(0.8); expect(consumeShepherdBlur(s, 'STRIKE', 16)).toBeNull(); expect(s.combat).toEqual(original);
    effect(s, K, fixedRolls(1)); const souls = structuredClone(s.shepherd.grazing); expect(finishShepherdCombatRound(s)).toContain('本轮结束');
    expect(s.shepherd.encounter.blurReady).toBe(false); expect(s.shepherd.grazing).toEqual(souls); expect(s.spirituality).toBe(76);
  });
  it('failed K still pays, insufficientS never draws, R only inspects and A is fixed without coin toss', () => {
    for (const id of [IRIS, CEDRIC]) {
      const s = fixture(id); expect(effect(s, K, fixedRolls(100))).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(s.spirituality).toBe(78);
      s.spirituality = 1; const before = structuredClone(s), r = fixedRolls(); effect(s, K, r); effect(s, R, r); expect(effect(s, A, r).selfGain).toBe(-22.5);
      expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
  });
});

describe('Shepherd shared rounds and irreversible real outcomes', () => {
  it('uses inherited core50/20/20/10, tier900/floor90/max100 and continuing recovery10 without extraA draws', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 90;
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket(A, 'ATTACK'), 400, 1);
    expect(result.round.playerAdvantage).toBe(919 - 22.5); expect(result.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(100); expect(result.round.consequenceWeights).toBeNull();
    const dry = fixture(); dry.spirituality = 0;
    expect(recordedRound(dry, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(915 * 0.8); expect(dry.spirituality).toBe(10);
    const cap = fixture(); cap.spirituality = 100; cap.character.coreStats = { physique: 1000, perception: 1000, will: 1000, knowledge: 1000 };
    expect(recordedRound(cap, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(1080);
    vi.spyOn(shepherdCombat, 'resolveShepherdCombatAbility').mockReturnValue({ label: 'controlled floor', selfGain: -10000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'ATTACK', 1, 1, ticket(A, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(90);
  });
  it('IrisK weakens only the following original club attack and does not permit control-only injury', () => {
    const s = fixture(), souls = structuredClone(s.shepherd.grazing);
    const { round, outcome } = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1);
    expect(outcome).toBe('CONTINUE'); expect(round.moves.map(m => m.selfGain)).toEqual([0, 16 * 0.8]); expect(round.moves[1]!.label).toContain('×0.8');
    expect(round.consequenceWeights).toBeNull(); expect(s.combat!.enemyHealth).toBe(100); expect(s.spirituality).toBe(88);
    expect(s.shepherd.encounter.blurReady).toBe(false); expect(s.shepherd.grazing).toEqual(souls);
  });
  it('an entire Cedric round never uses inactiveIrisH/B and R never changes active soul', () => {
    const s = fixture(CEDRIC), original = structuredClone(s.shepherd.grazing);
    const { round } = recordedRound(s, 'CONTROL', 58, 1, ticket(H, 'CONTROL'), 400, ticket(B, 'CONTROL'), ticket(K, 'CONTROL'), 1, ticket(R, 'CONTROL'), 1, 1);
    expect(round.playerCount).toBe(4); expect(round.moves.filter(m => m.actor === 'PLAYER').map(m => [m.selfGain, m.enemyReduction])).toEqual([[12, 0], [0, 10], [24 * 0.65, 0], [0, 0]]);
    expect(s.shepherd.grazing).toEqual(original); expect(s.spirituality).toBe(88);
  });
  it('pays1AP for real arrival, retains ordinary refusal, and grants no talk reward or free souls', () => {
    const s = fixture(); s.combat = null; s.shepherd.encounter = { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, blurReady: false };
    const souls = structuredClone(s.shepherd.grazing); s.actionsRemaining = 2;
    applyShepherdEncounter(s, { type: 'ENCOUNTER_TALK' }, context(100)); expect(s.actionsRemaining).toBe(1); expect(s.shepherd.encounter.status).toBe('AVAILABLE');
    expect(blockShepherdEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('本周');
    applyShepherdEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context()); expect(s.actionsRemaining).toBe(0); expect(currentShepherdCombatSource(s)).not.toBeNull(); expect(s.shepherd.grazing).toEqual(souls);
    const peaceful = fixture(); peaceful.combat = null; peaceful.shepherd.encounter = { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, blurReady: false };
    const before = structuredClone(peaceful.progression); applyShepherdEncounter(peaceful, { type: 'ENCOUNTER_TALK' }, context()); expect(peaceful.shepherd.encounter.status).toBe('RESOLVED'); expect(peaceful.progression).toEqual(before);
  });
  it('ordinary retreat keeps actual souls/current selection, reserve and real exit with no regeneration or reward', () => {
    const s = fixture(); reserve(s); s.spirituality = 61; const award = vi.fn(), souls = structuredClone(s.shepherd.grazing), stock = structuredClone(s.roseBishop.reserve);
    const result = recordedRound(s, 'RETREAT', 100, 100, 1); expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.consequence).toContain('埃尔顿'); expect(result.round.consequence).toContain('实际原出口');
    settleShepherdEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(s.spirituality).toBe(61);
    expect(s.shepherd.grazing).toEqual(souls); expect(s.roseBishop.reserve).toEqual(stock); expect(s.shepherd.encounter.status).toBe('RETREATED'); expect(validateShepherdEncounter(s)).toBe(true);
  });
  it('effective survival awards once; enemy death is real and never captures a soul or copies his club', () => {
    for (const roll of [70, 100]) {
      const s = fixture(), souls = structuredClone(s.shepherd.grazing), awards: [string, number][] = [];
      const result = recordedRound(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 400, 1, roll);
      expect(result.outcome).toBe(roll === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD'); expect(result.round.consequence).toContain('埃尔顿'); expect(s.spirituality).toBe(78);
      const health = s.combat!.enemyHealth;
      settleShepherdEncounter(s, result.outcome, context(), (source, amount) => { awards.push([source, amount]); s.seer.completedSources.push(source); });
      expect(awards).toEqual([['shepherd-dispute', 25]]); expect(s.shepherd.grazing).toEqual(souls); expect(s.shepherd.grazing.spirits).toHaveLength(2); expect(s.town.clubLocation).toBe('SHOP');
      expect(s.progression.acting).toBe(25); expect(s.combat).toBeNull(); expect(validateShepherdEncounter(s)).toBe(true);
      if (roll === 100) expect(health).toBe(0); expect(() => settleShepherdEncounter(s, result.outcome, context(), vi.fn())).toThrow();
    }
  });
  it('player death has no reward, resurrection, soul replacement or refund and rejects forged endings', () => {
    const s = fixture(), award = vi.fn(), souls = structuredClone(s.shepherd.grazing);
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket(K, 'ATTACK'), 1, 1, 1000000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(result.round.consequence).toContain('埃尔顿'); expect(s.health).toBe(0); expect(s.spirituality).toBe(78); expect(s.shepherd.encounter.blurReady).toBe(false); s.status = 'DEAD';
    settleShepherdEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(s.shepherd.grazing).toEqual(souls); expect(s.shepherd.encounter.status).toBe('LOST'); expect(validateShepherdEncounter(s)).toBe(true);
    const forged = fixture(); expect(() => settleShepherdEncounter(forged, 'ENEMY_SURRENDERED', context(), vi.fn())).toThrow('不一致');
  });
  it('same state replays exactly, leaving current selection and fixed source identities unchanged', () => {
    const s = fixture(); reserve(s); const replay = structuredClone(s);
    expect(resolveSliceCombatRound(s, 'CONTROL')).toEqual(resolveSliceCombatRound(replay, 'CONTROL')); expect(s).toEqual(replay);
  });
});
