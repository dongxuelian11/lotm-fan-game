import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { APPRAISER_COUNT_WHEEL, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel,
  playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createAstronomerState } from '../../src/domain/astronomer/index.js';
import { ASTRONOMER_ABILITY_IDS, ASTRONOMER_CASE_IDS } from '../../src/domain/astronomer/types.js';
import { ASTRONOMER_COUNT_WHEEL, currentAstronomerCombatSource, drawAstronomerAbility,
  isAstronomer, astronomerAbilityWheel, astronomerActionCount, resolveAstronomerCombatAbility,
  type AstronomerCombatSource, type AstronomerMoveId } from '../../src/domain/astronomer/combat.js';
import * as astronomerCombat from '../../src/domain/astronomer/combat.js';
import { applyAstronomerEncounter, blockAstronomerEncounter, hasAstronomerDisputeOpponent,
  settleAstronomerEncounter, validateAstronomerEncounter } from '../../src/domain/astronomer/encounter.js';
import { REAPER_COUNT_WHEEL } from '../../src/domain/reaper/combat.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Bounded engine fixtures, never evidence of a natural promotion/playthrough. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('astronomer-combat-test', sliceDefaultCreationSelection, 'astronomer-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 22;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'paragon', sequence: 5,
    mastery: { 'paragon.s5.precision-focus': 0 }, acting: 75, promotionWeek: 19 };
  s.astronomer = createAstronomerState(); s.astronomer.promotionWeek = 19;
  for (const [id, outcome] of [['catalogue-check', 'CATALOGUE_CHECKED'],
    ['instrument-drift', 'INSTRUMENT_ALIGNED'], ['night-measurement', 'MEASUREMENT_CHECKED']] as const) {
    Object.assign(s.astronomer.cases[id]!, { status: 'RESOLVED', contactOpen: false, closes: 1,
      attemptWeek: id === 'night-measurement' ? 21 : 20, method: 'ORDINARY', outcome });
  }
  s.astronomer.practice = { instrumentOffset: 0, calibratedWeek: 20, observedWeek: 21, measurements: 1 };
  s.astronomer.encounter = { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'ASTRONOMER_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  s.artisan.workshop.lamp = { id: 'ART6-LAMP-1', createdWeek: 10, charges: 2, location: 'CLIENT' };
  return s;
}
const profile: readonly [AstronomerMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['SECONDARY_STRIKE', 25, 'ATTACK'], ['EVADE', 20, 'DEFEND'],
  ['DISTANCE', 10, 'CONTROL'], ['paragon.s5.precision-focus', 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: AstronomerMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-astronomer', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw');
    return value;
  } };
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, min, max,
  ) {
    original.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw ' + index);
    return value;
  });
  try {
    const result = resolveSliceCombatRound(s, stance);
    s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length);
    return result;
  } finally { spy.mockRestore(); }
}
function effect(s: SliceState, id: AstronomerMoveId, factor = 1,
  source: AstronomerCombatSource | null = currentAstronomerCombatSource(s), random = fixedRolls()) {
  return resolveAstronomerCombatAbility(s, id, factor, random, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(): SliceState {
  const s = fixture(); s.combat = null; s.astronomer.encounter = createAstronomerState().encounter;
  s.actionsRemaining = 4; return s;
}
afterEach(() => vi.restoreAllMocks());

describe('Astronomer S5 bounded personal G combat', () => {
  it('selects independent H30/J25/B20/K10/R10/A5 and explicitly aliases the ordinary 1–6 count distribution', () => {
    const s = fixture();
    expect(isAstronomer(s)).toBe(true);
    expect(ASTRONOMER_ABILITY_IDS).toEqual(['paragon.s5.precision-focus']);
    expect(playerAbilityWheel(s, null)).toEqual(astronomerAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => [e.id, e.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(playerCountWheel(s)).toEqual(ASTRONOMER_COUNT_WHEEL);
    expect(ASTRONOMER_COUNT_WHEEL).toBe(REAPER_COUNT_WHEEL);
    expect(ASTRONOMER_COUNT_WHEEL.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(Object.isFrozen(ASTRONOMER_COUNT_WHEEL)).toBe(true);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(astronomerActionCount(roll!)).toBe(count);
    }
    const wheel = playerAbilityWheel(s, null); wheel[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30);
  });

  it('draws exactly one ticket per action, with exact stance weighting and one fixed accident', () => {
    const s = fixture();
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      astronomerAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(weights[i]! / total * 100, 12);
        const first = boundary + 1; boundary += weights[i]!;
        const random = fixedRolls(first, boundary);
        expect(drawAstronomerAbility(random, s, stance)).toBe(entry.id);
        expect(drawAstronomerAbility(random, s, stance)).toBe(entry.id);
        expect(random.cursor).toBe(2);
      });
    }
    const before = structuredClone(s), random = fixedRolls();
    expect(effect(s, 'ACCIDENT', 1, currentAstronomerCombatSource(s), random))
      .toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('retains Paragon S9–6 ordinary wheels, resource ceilings, base budgets and RNG counts', () => {
    for (const [sequence, maximum, advantage] of [[9, 30, 215], [8, 45, 315], [7, 60, 465], [6, 80, 465]] as const) {
      const s = fixture(true); s.progression.sequence = sequence; s.spirituality = maximum;
      expect(isAstronomer(s)).toBe(false); expect(currentAstronomerCombatSource(s)).toBeNull();
      expect(playerAbilityWheel(s, 'PREPARE')).toEqual(ordinaryAbilityWheel(false, 'PREPARE'));
      expect(playerCountWheel(s)).toEqual(sequence <= 7 ? APPRAISER_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      const result = recordedRound(s, 'PREPARE', 1, 1, 400, 400, 1);
      expect(result.round.playerAdvantage).toBe(advantage); expect(s.spirituality).toBe(maximum);
      expect(s.random.cursor).toBe(5);
      expect(result.round.moves.map(m => m.label)).toEqual(['动作落空', '动作落空']);
    }
  });

  it('pays exactly2 for finite own-focus +12×only-its-mastery with no hidden enemy information or persistent buff', () => {
    for (const [mastery, gain] of [[0, 7.8], [250, 9.9], [500, 12], [900, 12], [-10, 7.8]]) {
      const s = fixture(); s.progression.mastery['paragon.s5.precision-focus'] = mastery!;
      s.progression.mastery['paragon.s6.spiritual-craft'] = 500;
      const before = structuredClone(s), random = fixedRolls();
      const result = effect(s, 'paragon.s5.precision-focus', 1, currentAstronomerCombatSource(s), random);
      expect(result.selfGain).toBeCloseTo(gain!); expect(result.threatens).toBe(false);
      expect(result.enemyReduction).toBe(0); expect(result.label).toContain('原创G');
      expect(result.label).toContain('不预知下一步'); expect(s.spirituality).toBe(98);
      before.spirituality = 98; expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('returns explicit0 at zero/insufficient/invalid SP, with no free effect, fallback action or random draw', () => {
    for (const sp of [0, 1, Number.NaN]) {
      const s = fixture(); s.spirituality = sp; const before = structuredClone(s), random = fixedRolls();
      const result = effect(s, 'paragon.s5.precision-focus', 1, currentAstronomerCombatSource(s), random);
      expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(result.label).toContain('0效果'); expect(result.label).toContain('不重抽');
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rejects unimplemented star, weather, gravity and S4 powers without touching the client lamp or original instruments', () => {
    const s = fixture(), before = structuredClone(s), random = fixedRolls();
    for (const id of ['paragon.s5.star-beam', 'paragon.s5.weather', 'paragon.s5.gravity',
      'paragon.s4.animation', 'paragon.s6.spiritual-craft', 'ART6-LAMP-1']) {
      expect(effect(s, id as AstronomerMoveId, 1, currentAstronomerCombatSource(s), random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
    expect(s.artisan.workshop.lamp).toMatchObject({ id: 'ART6-LAMP-1', location: 'CLIENT', charges: 2 });
  });

  it('uses the actual body or own held ordinary club for both strikes, with ordinary dodge and control only', () => {
    const s = fixture(); const workshop = structuredClone(s.artisan.workshop);
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      s.town.clubLocation = location; const town = structuredClone(s.town);
      for (const id of ['STRIKE', 'SECONDARY_STRIKE'] as const) {
        expect(effect(s, id, 0.5)).toMatchObject({ selfGain: location === 'HAND' ? 8 : 6, threatens: true });
        expect(effect(s, id, 0)).toMatchObject({ selfGain: 0, threatens: false });
      }
      expect(s.town).toEqual(town);
    }
    expect(effect(s, 'EVADE').enemyReduction).toBe(10);
    expect(effect(s, 'DISTANCE').enemyReduction).toBe(8);
    expect(s.artisan.workshop).toEqual(workshop); expect(s.spirituality).toBe(100);
  });

  it('binds source to the actual adult, current original bodies, encounter, attempt week and contiguous round', () => {
    const s = fixture(), source = currentAstronomerCombatSource(s)!;
    expect(source).toMatchObject({ target: 'HOBER_SINGLE_ADULT', distanceMetres: 2,
      weapon: 'HOBER_ORIGINAL_CLUB', space: 'ORIGINAL_OBSERVATORY_OUTER_COURTYARD',
      playerBody: 'ORIGINAL_PLAYER_BODY', playerHealth: 100, enemyHealth: 100,
      attemptWeek: 22, startHistoryIndex: 0, exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    for (const bad of [null, { ...source, round: 2 }, { ...source, revision: 99 },
      { ...source, target: 'COPY' }, { ...source, playerHealth: 90 }, { ...source, enemyMind: 70 },
      { ...source, space: 'ORIGINAL_FIRST_CASE' }, { ...source, pursuit: true }]) {
      const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, 'paragon.s5.precision-focus', 1, bad as AstronomerCombatSource | null, random).selfGain).toBe(0);
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const change of [
      (x: SliceState) => { x.astronomer.encounter.attemptWeek = x.week - 1; },
      (x: SliceState) => { x.astronomer.encounter.status = 'AVAILABLE'; },
      (x: SliceState) => { x.astronomer.encounter.startHistoryIndex = 1; },
      (x: SliceState) => { x.combat!.round = 2; },
      (x: SliceState) => { x.combat!.enemyStatus = 'SURRENDERED'; },
      (x: SliceState) => { x.combat!.enemyMind = 0; },
      (x: SliceState) => { x.astronomer.cases['night-measurement']!.contactOpen = true; },
      (x: SliceState) => { x.artisan.cases['reading-diagram']!.contactOpen = true; },
    ]) {
      const invalid = fixture(); change(invalid); const before = structuredClone(invalid);
      expect(currentAstronomerCombatSource(invalid)).toBeNull();
      expect(() => resolveSliceCombatRound(invalid, 'PREPARE')).toThrow(); expect(invalid).toEqual(before);
    }
    s.health = 90;
    expect(effect(s, 'paragon.s5.precision-focus', 1, source).selfGain).toBe(0);
  });

  it('keeps a narrowly authored live first-case source separate from Hober and never revives the old carrier', () => {
    const s = fixture(true), world = structuredClone(s.world);
    expect(currentAstronomerCombatSource(s)).toMatchObject({ target: 'ORIGINAL_LIVING_CARRIER',
      space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null });
    expect(effect(s, 'paragon.s5.precision-focus').selfGain).toBeCloseTo(7.8);
    expect(s.world).toEqual(world);
    s.world.carrierAlive = false;
    expect(currentAstronomerCombatSource(s)).toBeNull();
    expect(effect(s, 'STRIKE').selfGain).toBe(0);
    const other = fixture(); expect(other.world.carrierAlive).toBe(false);
    expect(currentAstronomerCombatSource(other)?.target).toBe('HOBER_SINGLE_ADULT');
    expect(effect(other, 'STRIKE').label).not.toMatch(/携铃者|德文|马斯/);
  });

  it('uses finite G base900/core30-30-25-15/floor90/S100/continuing recovery10 and fixed A−22.5', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket('paragon.s5.precision-focus', 'PREPARE'), 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(922.5 * 0.8); expect(s.spirituality).toBe(10);
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'PREPARE', 1, 1, ticket('paragon.s5.precision-focus', 'PREPARE'), 400, 1);
    expect(ceiling.spirituality).toBe(100);
    const accident = fixture();
    const a = recordedRound(accident, 'PREPARE', 1, 1, ticket('ACCIDENT', 'PREPARE'), 400, 1);
    expect(a.round.moves[0]!.selfGain).toBe(-22.5); expect(accident.random.cursor).toBe(5);
    vi.spyOn(astronomerCombat, 'resolveAstronomerCombatAbility').mockReturnValue({
      label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false,
    });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, ticket('paragon.s5.precision-focus', 'PREPARE'), 400, 1).round.playerAdvantage).toBe(90);
  });

  it('keeps every real enemy action and never turns focus into an attack, mind damage or forced surrender', () => {
    const s = fixture(); s.spirituality = 20;
    const first = recordedRound(s, 'PREPARE', 1, 86, ticket('paragon.s5.precision-focus', 'PREPARE'), 1, 1, 1, 1);
    expect(first.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(3);
    expect(first.round.moves[0]!.selfGain).toBeCloseTo(7.8); expect(s.spirituality).toBe(28);
    expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(first.outcome).toBe('CONTINUE'); expect(hasAstronomerDisputeOpponent(s)).toBe(true);
    const next = recordedRound(s, 'PREPARE', 1, 1, 400, ticket('ACCIDENT', 'PREPARE'), 1);
    expect(next.round.moves[0]!.actor).toBe('ENEMY'); expect(next.outcome).toBe('CONTINUE');
    expect(next.round.playerAdvantage).toBeCloseTo(915 * 0.9 - 22.5);
    expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyMind).toBe(100);
  });

  it('requires all3 completed closed reports and the actual zero-offset cross-week measurement before paying arrival1', () => {
    for (const id of ASTRONOMER_CASE_IDS) {
      const s = available(); s.astronomer.cases[id]!.status = 'EXAMINED';
      expect(blockAstronomerEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    }
    for (const change of [
      (s: SliceState) => { s.astronomer.cases['catalogue-check']!.contactOpen = true; },
      (s: SliceState) => { s.astronomer.cases['instrument-drift']!.closes = 0; },
      (s: SliceState) => { s.astronomer.practice.instrumentOffset = 2; },
      (s: SliceState) => { s.astronomer.practice.measurements = 0; },
      (s: SliceState) => { s.astronomer.practice.observedWeek = 20; },
      (s: SliceState) => { s.astronomer.practice.calibratedWeek = null; },
    ]) {
      const s = available(); change(s); const before = structuredClone(s);
      expect(() => applyAstronomerEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow();
      expect(s).toEqual(before);
    }
    const s = available(), world = structuredClone(s.world), workshop = structuredClone(s.artisan.workshop);
    applyAstronomerEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(3); expect(hasAstronomerDisputeOpponent(s)).toBe(true);
    expect(Object.keys(s.astronomer.encounter).sort()).toEqual(['attemptWeek', 'startHistoryIndex', 'status']);
    expect(s.world).toEqual(world); expect(s.artisan.workshop).toEqual(workshop);
  });

  it('preserves actual ordinary talk refusal, same-week gate and peaceful success without extra rewards', () => {
    const refused = available(); applyAstronomerEncounter(refused, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(refused.actionsRemaining).toBe(3); expect(refused.astronomer.encounter.status).toBe('AVAILABLE');
    expect(blockAstronomerEncounter(refused, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    expect(validateAstronomerEncounter(refused)).toBe(true);
    applyAstronomerEncounter(refused, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(refused.actionsRemaining).toBe(2); expect(hasAstronomerDisputeOpponent(refused)).toBe(true);
    const talk = available(), progression = structuredClone(talk.progression), ctx = context();
    applyAstronomerEncounter(talk, { type: 'ENCOUNTER_TALK' }, ctx);
    expect(talk.astronomer.encounter.status).toBe('RESOLVED'); expect(talk.progression).toEqual(progression);
    expect(talk.combat).toBeNull(); expect(validateAstronomerEncounter(talk)).toBe(true);
    expect(blockAstronomerEncounter(talk, { type: 'ENCOUNTER_FIGHT' })).toContain('已有结果');
  });

  it('settles actual surrender/death once25, while first-action exit and actual player death award0', () => {
    for (const terminal of [70, 100]) {
      const s = fixture(), ctx = context();
      const award = vi.fn((source: string, amount: 5 | 8 | 25) => awardSeerMastery(s, source, amount, ctx));
      const workshop = structuredClone(s.artisan.workshop), world = structuredClone(s.world);
      s.spirituality = 30;
      const result = recordedRound(s, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, terminal);
      expect(result.outcome).toBe(terminal === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('霍伯'); expect(result.round.consequence).not.toMatch(/携铃者|箱子|马斯/);
      expect(s.combat!.enemyHealth).toBe(terminal === 70 ? 70 : 0); expect(s.spirituality).toBe(30);
      settleAstronomerEncounter(s, result.outcome, ctx, award);
      expect(award).toHaveBeenCalledExactlyOnceWith('astronomer-dispute', 25);
      expect(s.astronomer.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
      expect(s.progression.mastery['paragon.s5.precision-focus']).toBe(25); expect(s.progression.acting).toBe(75);
      expect(validateAstronomerEncounter(s)).toBe(true); expect(s.world).toEqual(world); expect(s.artisan.workshop).toEqual(workshop);
      expect(() => settleAstronomerEncounter(s, result.outcome, ctx, award)).toThrow(); expect(award).toHaveBeenCalledTimes(1);
    }
    const retreat = fixture(), reward = vi.fn(); retreat.spirituality = 98;
    const r = recordedRound(retreat, 'RETREAT', 1, 1, 1);
    expect(r.round.moves).toHaveLength(0); expect(r.round.consequence).toContain('实际原出口');
    expect(r.round.consequence).toContain('没有瞬移、追逐'); expect(retreat.spirituality).toBe(98);
    settleAstronomerEncounter(retreat, r.outcome, context(), reward);
    expect(reward).not.toHaveBeenCalled(); expect(validateAstronomerEncounter(retreat)).toBe(true);
    const dead = fixture(), lamp = structuredClone(dead.artisan.workshop.lamp);
    const d = recordedRound(dead, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 100);
    expect(d.outcome).toBe('PLAYER_DEAD'); settleAstronomerEncounter(dead, d.outcome, context(), reward);
    dead.status = 'DEAD';
    expect(reward).not.toHaveBeenCalled(); expect(dead.health).toBe(0); expect(dead.artisan.workshop.lamp).toEqual(lamp);
    expect(validateAstronomerEncounter(dead)).toBe(true);
  });

  it('rejects forged terminal outcomes, premature reports, stale histories and duplicate/unearned rewards', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settleAstronomerEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(() => settleAstronomerEncounter(s, 'INVENTED', context(), award)).toThrow();
    expect(s).toEqual(before); expect(award).not.toHaveBeenCalled();
    for (const mutate of [
      (x: SliceState) => { x.progression.sequence = 6; },
      (x: SliceState) => { x.astronomer.encounter.attemptWeek = 18; },
      (x: SliceState) => { x.astronomer.cases['catalogue-check']!.status = 'AVAILABLE'; },
      (x: SliceState) => { x.astronomer.practice.measurements = 2; },
      (x: SliceState) => { x.astronomer.encounter.startHistoryIndex = -1; },
      (x: SliceState) => { x.seer.completedSources.push('astronomer-dispute'); },
      (x: SliceState) => { x.seer.completedSources.push('astronomer-dispute', 'astronomer-dispute'); },
    ]) {
      const invalid = fixture(); mutate(invalid); expect(validateAstronomerEncounter(invalid)).toBe(false);
    }
    const old = createSliceRun('astronomer-unpromoted-test', sliceDefaultCreationSelection, 'initial');
    expect(validateAstronomerEncounter(old)).toBe(true);
  });
});
