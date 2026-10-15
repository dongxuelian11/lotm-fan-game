import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel,
  playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createCrimsonScholarState } from '../../src/domain/crimson-scholar/index.js';
import { CRIMSON_SCHOLAR_ABILITY_IDS, CRIMSON_SCHOLAR_CASE_IDS } from '../../src/domain/crimson-scholar/types.js';
import { CRIMSON_SCHOLAR_COUNT_WHEEL, currentCrimsonScholarCombatSource, drawCrimsonScholarAbility,
  isCrimsonScholar, crimsonScholarAbilityWheel, crimsonScholarActionCount, resolveCrimsonScholarCombatAbility,
  type CrimsonScholarCombatSource, type CrimsonScholarMoveId } from '../../src/domain/crimson-scholar/combat.js';
import * as crimsonScholarCombat from '../../src/domain/crimson-scholar/combat.js';
import { applyCrimsonScholarEncounter, blockCrimsonScholarEncounter, hasCrimsonScholarDisputeOpponent,
  settleCrimsonScholarEncounter, validateCrimsonScholarEncounter } from '../../src/domain/crimson-scholar/encounter.js';
import { VAMPIRE_COUNT_WHEEL, vampireAbilityWheel, isVampire, resolveVampireCombatAbility, resolveCrimsonScholarVampireAbility } from '../../src/domain/vampire/combat.js';
import { REAPER_COUNT_WHEEL } from '../../src/domain/reaper/combat.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Bounded engine fixtures, never evidence of a natural promotion/playthrough. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('crimsonScholar-combat-test', sliceDefaultCreationSelection, 'crimsonScholar-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 22;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'moon', sequence: 5,
    mastery: Object.fromEntries(CRIMSON_SCHOLAR_ABILITY_IDS.map(id => [id, 0])), acting: 75, promotionWeek: 19 };
  s.crimsonScholar = createCrimsonScholarState(); s.crimsonScholar.promotionWeek = 19;
  for (const [id, outcome] of [['full-moon', 'FULL_MOON_CHECKED'],
    ['hidden-moon', 'HIDDEN_MOON_CHECKED'], ['moonlight-route', 'ROUTE_CHECKED']] as const) {
    Object.assign(s.crimsonScholar.cases[id]!, { status: 'RESOLVED', contactOpen: false, closes: 1,
      attemptWeek: 20, method: 'ORDINARY', outcome });
  }
  s.crimsonScholar.encounter = { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0, reassemblyRound: null };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'CRIMSON_SCHOLAR_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
const profile: readonly [CrimsonScholarMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['SECONDARY_STRIKE', 15, 'ATTACK'], ['moon.s7.dark-wings', 20, 'DEFEND'],
  ['moon.s7.abyss-shackles', 20, 'CONTROL'], ['moon.s5.moonlight-reassembly', 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: CrimsonScholarMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-crimsonScholar', get cursor() { return cursor; }, nextInt(min, max) {
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
function effect(s: SliceState, id: CrimsonScholarMoveId, factor = 1,
  source: CrimsonScholarCombatSource | null = currentCrimsonScholarCombatSource(s), random = fixedRolls()) {
  return resolveCrimsonScholarCombatAbility(s, id, factor, random, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(): SliceState {
  const s = fixture(); s.combat = null; s.crimsonScholar.encounter = createCrimsonScholarState().encounter;
  s.actionsRemaining = 4; return s;
}
afterEach(() => vi.restoreAllMocks());


const R = 'moon.s5.moonlight-reassembly' as const;
const B = 'moon.s7.dark-wings' as const;
const K = 'moon.s7.abyss-shackles' as const;

describe('Crimson Scholar S5 bounded own-body moonlight combat', () => {
  it('uses independent H30/J15/B20/K20/R10/A5 and aliases the existing ordinary 1–6 count wheel', () => {
    const s = fixture();
    expect(isCrimsonScholar(s)).toBe(true); expect(isVampire(s)).toBe(false);
    expect(CRIMSON_SCHOLAR_ABILITY_IDS).toEqual(['moon.s5.regional-moon', 'moon.s5.moonlight-step', R]);
    expect(playerAbilityWheel(s, null)).toEqual(crimsonScholarAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => [e.id, e.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(playerCountWheel(s)).toEqual(CRIMSON_SCHOLAR_COUNT_WHEEL);
    expect(CRIMSON_SCHOLAR_COUNT_WHEEL).toBe(REAPER_COUNT_WHEEL);
    expect(CRIMSON_SCHOLAR_COUNT_WHEEL.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(crimsonScholarActionCount(roll!)).toBe(count);
    }
    const copy = playerAbilityWheel(s, null); copy[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30);
  });

  it('uses one ticket, exact stance weighting and fixed accident without extra random draws', () => {
    const s = fixture();
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      crimsonScholarAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(weights[i]! / total * 100, 12);
        const first = boundary + 1; boundary += weights[i]!;
        const random = fixedRolls(first, boundary);
        expect(drawCrimsonScholarAbility(random, s, stance)).toBe(entry.id);
        expect(drawCrimsonScholarAbility(random, s, stance)).toBe(entry.id);
        expect(random.cursor).toBe(2);
      });
    }
    const before = structuredClone(s), random = fixedRolls();
    expect(effect(s, 'ACCIDENT', 1, currentCrimsonScholarCombatSource(s), random))
      .toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('preserves Moon S9–6 wheels, resource ceilings, base budgets and RNG counts', () => {
    for (const [sequence, maximum, advantage] of [[9, 30, 215], [8, 45, 315], [7, 60, 465], [6, 80, 465]] as const) {
      const s = fixture(true); s.progression.sequence = sequence; s.spirituality = maximum;
      expect(isCrimsonScholar(s)).toBe(false); expect(currentCrimsonScholarCombatSource(s)).toBeNull();
      expect(playerAbilityWheel(s, 'PREPARE')).toEqual(sequence <= 7 ? vampireAbilityWheel('PREPARE') : ordinaryAbilityWheel(false, 'PREPARE'));
      expect(playerCountWheel(s)).toEqual(sequence <= 7 ? VAMPIRE_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      const result = recordedRound(s, 'PREPARE', 1, 1, 400, 400, 1);
      expect(result.round.playerAdvantage).toBe(advantage); expect(s.spirituality).toBe(maximum);
      expect(s.random.cursor).toBe(5);
    }
  });

  it('pays6 once per current round to restore at most8 original health with no other body or advantage mutation', () => {
    for (const [health, healed] of [[1, 8], [80, 8], [99, 1]]) {
      const s = fixture(); s.health = health!; s.spirituality = 20; s.mind = 62;
      s.injuries = [{ id: 'original-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }]; s.injuryRisk = 3;
      const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, R, 1, currentCrimsonScholarCombatSource(s), random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s.health).toBe(health! + healed!); expect(s.spirituality).toBe(14);
      expect(s.crimsonScholar.encounter.reassemblyRound).toBe(1);
      before.health = health! + healed!; before.spirituality = 14; before.crimsonScholar.encounter.reassemblyRound = 1;
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
      const second = structuredClone(s); effect(s, R); expect(s).toEqual(second);
    }
  });

  it('returns explicit zero effect and zero cost at full/dead health, insufficient SP or no authored moonlight', () => {
    for (const mutate of [
      (s: SliceState) => { s.health = 100; },
      (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = 0.5; },
      (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.spirituality = 5; },
      (s: SliceState) => { s.spirituality = Number.NaN; },
      (s: SliceState) => { s.spirituality = 0; },
    ]) {
      const s = fixture(); s.health = 80; mutate(s); const before = structuredClone(s);
      const result = effect(s, R);
      expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(result.label).toContain('0效果'); expect(result.label).toContain('0消耗'); expect(s).toEqual(before);
    }
    const s = fixture(true); s.health = 80; const before = structuredClone(s);
    expect(effect(s, R).label).toContain('没有已核实的实际月光'); expect(s).toEqual(before);
  });

  it('inherits exact B3/−22 and K3/will14/−24 with resistance and no deleted actions or direct damage', () => {
    const s = fixture(), enemy = structuredClone(s.combat);
    expect(effect(s, B)).toMatchObject({ selfGain: 0, enemyReduction: 22, threatens: false });
    expect(s.spirituality).toBe(97); expect(s.combat).toEqual(enemy);
    for (const [roll, reduction] of [[1, 24], [100, 0]]) {
      const before = s.spirituality, random = fixedRolls(roll!);
      expect(effect(s, K, 1, currentCrimsonScholarCombatSource(s), random))
        .toMatchObject({ selfGain: 0, enemyReduction: reduction, threatens: false });
      expect(s.spirituality).toBe(before - 3); expect(random.cursor).toBe(1); expect(s.lastCheck?.difficulty).toBe(14);
      expect(s.combat).toEqual(enemy);
    }
    s.spirituality = 2;
    expect(effect(s, B).enemyReduction).toBe(10); expect(s.spirituality).toBe(2);
    expect(resolveVampireCombatAbility(s, B, 1, fixedRolls()).enemyReduction).toBe(0);
  });

  it('keeps FIRST_CASE source separate, never adds Sid, moonlight, a shadow or a resurrected carrier', () => {
    const s = fixture(true), world = structuredClone(s.world); s.health = 90;
    expect(currentCrimsonScholarCombatSource(s)).toMatchObject({ target: 'ORIGINAL_LIVING_CARRIER',
      space: 'ORIGINAL_FIRST_CASE', moonlight: 'NOT_AUTHORED', shadow: 'NOT_AUTHORED' });
    expect(effect(s, 'STRIKE').selfGain).toBe(12); expect(effect(s, R).selfGain).toBe(0);
    expect(effect(s, B).enemyReduction).toBe(10); expect(effect(s, K).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(100); expect(s.world).toEqual(world);
    s.world.carrierAlive = false; expect(currentCrimsonScholarCombatSource(s)).toBeNull();
    expect(effect(s, 'STRIKE').selfGain).toBe(0);
    expect(currentCrimsonScholarCombatSource(fixture())?.target).toBe('SID_SINGLE_ADULT');
  });

  it('rejects stale, forged, wrong-body and unfinished-practice sources before any mutation or RNG', () => {
    const s = fixture(), source = currentCrimsonScholarCombatSource(s)!;
    for (const patch of [{ week: 21 }, { round: 2 }, { revision: 999 }, { target: 'ORIGINAL_LIVING_CARRIER' },
      { moonlight: 'NOT_AUTHORED' }, { shadow: 'NOT_AUTHORED' }, { playerHealth: 80 }, { reassemblyRound: 1 }]) {
      const before = structuredClone(s), fake = { ...source, ...patch } as CrimsonScholarCombatSource;
      expect(effect(s, B, 1, fake).enemyReduction).toBe(0);
      expect(resolveCrimsonScholarVampireAbility(s, K, fixedRolls(), fake).enemyReduction).toBe(0);
      expect(s).toEqual(before);
    }
    for (const mutate of [
      (x: SliceState) => { x.crimsonScholar.encounter.attemptWeek = 21; },
      (x: SliceState) => { x.crimsonScholar.encounter.reassemblyRound = 2; },
      (x: SliceState) => { x.combat!.round = 2; },
      (x: SliceState) => { x.combat!.enemyStatus = 'SURRENDERED'; },
      (x: SliceState) => { x.crimsonScholar.practice.field = 'FULL'; },
      (x: SliceState) => { x.crimsonScholar.practice.location = 'END'; },
      (x: SliceState) => { x.crimsonScholar.ritual.activeVisitId = 1; },
      (x: SliceState) => { x.potionProfessor.laboratory.effects.quietStep = true; },
    ]) {
      const invalid = fixture(); mutate(invalid); const before = structuredClone(invalid);
      expect(currentCrimsonScholarCombatSource(invalid)).toBeNull();
      expect(() => resolveSliceCombatRound(invalid, 'PREPARE')).toThrow(); expect(invalid).toEqual(before);
    }
  });

  it('uses G core35/25/25/15, base900/floor90, SP100 and only continuing-round regen10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(922 * 0.8); expect(s.spirituality).toBe(10);
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1); expect(ceiling.spirituality).toBe(100);
    const accident = fixture();
    expect(recordedRound(accident, 'PREPARE', 1, 1, ticket('ACCIDENT', 'PREPARE'), 400, 1).round.moves[0]!.selfGain).toBe(-22.5);
    expect(accident.random.cursor).toBe(5);
    vi.spyOn(crimsonScholarCombat, 'resolveCrimsonScholarCombatAbility').mockReturnValue({ label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1).round.playerAdvantage).toBe(90);
  });

  it('retains every enemy action and clears the R marker at each real round so next-round R can heal again', () => {
    const s = fixture(); s.health = 80; s.spirituality = 20;
    const first = recordedRound(s, 'PREPARE', 11, 86, ticket(R, 'PREPARE'), 1, ticket(R, 'PREPARE'), 1, 1, 1);
    expect(first.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(3);
    expect(first.round.moves.filter(m => m.actor === 'PLAYER')).toHaveLength(2);
    expect(first.round.moves.filter(m => m.actor === 'PLAYER')[1]!.label).toContain('本轮已经重组一次');
    expect(s.health).toBe(88); expect(s.spirituality).toBe(24); expect(s.crimsonScholar.encounter.reassemblyRound).toBeNull();
    expect(first.outcome).toBe('CONTINUE'); expect(hasCrimsonScholarDisputeOpponent(s)).toBe(true);
    const next = recordedRound(s, 'PREPARE', 1, 1, 400, ticket(R, 'PREPARE'), 1);
    expect(next.round.moves[0]!.actor).toBe('ENEMY'); expect(s.health).toBe(96); expect(s.spirituality).toBe(28);
    expect(s.crimsonScholar.encounter.reassemblyRound).toBeNull(); expect(s.combat!.enemyHealth).toBe(100);
    expect(s.combat!.enemyMind).toBe(100); expect(s.combat!.enemyStatus).toBe('RESISTING');
  });

  it('requires all3 closed reports, original starting location, no field, ritual or old practice before paying night arrival1', () => {
    for (const id of CRIMSON_SCHOLAR_CASE_IDS) {
      const s = available(); s.crimsonScholar.cases[id]!.status = 'EXAMINED';
      expect(blockCrimsonScholarEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
    }
    for (const mutate of [
      (s: SliceState) => { s.crimsonScholar.cases['full-moon']!.contactOpen = true; },
      (s: SliceState) => { s.crimsonScholar.cases['hidden-moon']!.closes = 0; },
      (s: SliceState) => { s.crimsonScholar.practice.location = 'END'; },
      (s: SliceState) => { s.crimsonScholar.practice.field = 'HIDDEN'; },
      (s: SliceState) => { s.crimsonScholar.ritual.activeVisitId = 1; },
      (s: SliceState) => { s.potionProfessor.cases['quiet-passage']!.contactOpen = true; },
      (s: SliceState) => { s.crimsonScholar.encounter.reassemblyRound = 1; },
    ]) {
      const s = available(); mutate(s); const before = structuredClone(s);
      expect(() => applyCrimsonScholarEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s).toEqual(before);
    }
    const s = available(), world = structuredClone(s.world), laboratory = structuredClone(s.potionProfessor.laboratory), ctx = context();
    applyCrimsonScholarEncounter(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
    expect(s.actionsRemaining).toBe(3); expect(hasCrimsonScholarDisputeOpponent(s)).toBe(true);
    expect(currentCrimsonScholarCombatSource(s)).toMatchObject({ target: 'SID_SINGLE_ADULT', distanceMetres: 2,
      moonlight: 'CURRENT_AUTHORED_COURTYARD_MOONLIGHT', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    expect(s.world).toEqual(world); expect(s.potionProfessor.laboratory).toEqual(laboratory);
    expect(ctx.note).toHaveBeenCalledWith('实际走到原私人月照庭院', expect.stringContaining('约定在夜间实际到达'));
  });

  it('keeps ordinary refusal and same-week gate and resolves voluntary talk without rewards', () => {
    const refused = available(); applyCrimsonScholarEncounter(refused, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(refused.actionsRemaining).toBe(3); expect(refused.crimsonScholar.encounter.status).toBe('AVAILABLE');
    expect(blockCrimsonScholarEncounter(refused, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    expect(validateCrimsonScholarEncounter(refused)).toBe(true);
    applyCrimsonScholarEncounter(refused, { type: 'ENCOUNTER_FIGHT' }, context()); expect(refused.actionsRemaining).toBe(2);
    const talk = available(), progression = structuredClone(talk.progression);
    applyCrimsonScholarEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.crimsonScholar.encounter.status).toBe('RESOLVED'); expect(talk.progression).toEqual(progression);
    expect(talk.combat).toBeNull(); expect(validateCrimsonScholarEncounter(talk)).toBe(true);
  });

  it('settles actual original-adult surrender or death only once25 with no copied body, weapon, inventory or treatment', () => {
    for (const terminal of [70, 100]) {
      const s = fixture(), ctx = context(); s.spirituality = 30;
      const award = vi.fn((source: string, amount: 5 | 8 | 25) => awardSeerMastery(s, source, amount, ctx));
      const world = structuredClone(s.world), town = structuredClone(s.town), lab = structuredClone(s.potionProfessor.laboratory);
      const result = recordedRound(s, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, terminal);
      expect(result.outcome).toBe(terminal === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('西德'); expect(result.round.consequence).not.toMatch(/携铃者|箱子|霍伯/);
      expect(s.combat!.enemyHealth).toBe(terminal === 70 ? 70 : 0); expect(s.spirituality).toBe(30);
      settleCrimsonScholarEncounter(s, result.outcome, ctx, award);
      expect(award).toHaveBeenCalledExactlyOnceWith('crimson-scholar-dispute', 25);
      expect(s.crimsonScholar.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
      expect(s.crimsonScholar.encounter.reassemblyRound).toBeNull(); expect(s.progression.acting).toBe(75);
      expect(Object.values(s.progression.mastery).reduce((a, b) => a + b, 0)).toBe(25);
      expect(validateCrimsonScholarEncounter(s)).toBe(true); expect(s.world).toEqual(world); expect(s.town).toEqual(town);
      expect(s.potionProfessor.laboratory).toEqual(lab);
      expect(() => settleCrimsonScholarEncounter(s, result.outcome, ctx, award)).toThrow(); expect(award).toHaveBeenCalledTimes(1);
    }
  });

  it('gives retreat0 and cannot turn earlier real reassembly into a death override or resurrection', () => {
    const retreat = fixture(), award = vi.fn(); retreat.spirituality = 98;
    const r = recordedRound(retreat, 'RETREAT', 1, 1, 1);
    expect(r.round.moves).toHaveLength(0); expect(r.round.consequence).toContain('实际原出口');
    expect(r.round.consequence).toContain('没有瞬移、追逐'); expect(retreat.spirituality).toBe(98);
    settleCrimsonScholarEncounter(retreat, r.outcome, context(), award);
    expect(award).not.toHaveBeenCalled(); expect(validateCrimsonScholarEncounter(retreat)).toBe(true);
    const dead = fixture(); dead.health = 80; dead.spirituality = 20;
    const d = recordedRound(dead, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 1, 1_000_000, 100);
    expect(d.round.moves[0]!.label).toContain('健康恢复8'); expect(d.outcome).toBe('PLAYER_DEAD');
    expect(dead.health).toBe(0); expect(dead.spirituality).toBe(14); expect(dead.crimsonScholar.encounter.reassemblyRound).toBeNull();
    settleCrimsonScholarEncounter(dead, d.outcome, context(), award); dead.status = 'DEAD';
    expect(award).not.toHaveBeenCalled(); expect(validateCrimsonScholarEncounter(dead)).toBe(true);
    const before = structuredClone(dead); effect(dead, R); expect(dead).toEqual(before);
  });

  it('rejects forged terminal outcomes, stale round markers/history and duplicate or unearned reward records', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settleCrimsonScholarEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(() => settleCrimsonScholarEncounter(s, 'INVENTED', context(), award)).toThrow(); expect(s).toEqual(before);
    for (const mutate of [
      (x: SliceState) => { x.progression.sequence = 6; },
      (x: SliceState) => { x.crimsonScholar.encounter.attemptWeek = 18; },
      (x: SliceState) => { x.crimsonScholar.cases['full-moon']!.status = 'AVAILABLE'; },
      (x: SliceState) => { x.crimsonScholar.encounter.startHistoryIndex = -1; },
      (x: SliceState) => { x.crimsonScholar.encounter.reassemblyRound = 2; },
      (x: SliceState) => { x.seer.completedSources.push('crimson-scholar-dispute'); },
      (x: SliceState) => { x.seer.completedSources.push('crimson-scholar-dispute', 'crimson-scholar-dispute'); },
    ]) { const invalid = fixture(); mutate(invalid); expect(validateCrimsonScholarEncounter(invalid)).toBe(false); }
    const resolved = available(); applyCrimsonScholarEncounter(resolved, { type: 'ENCOUNTER_TALK' }, context());
    resolved.crimsonScholar.encounter.reassemblyRound = 1; expect(validateCrimsonScholarEncounter(resolved)).toBe(false);
    expect(validateCrimsonScholarEncounter(createSliceRun('crimson-initial-test', sliceDefaultCreationSelection, 'initial'))).toBe(true);
  });

  it('keeps the two new daily abilities out of the combat wheel and never supplies S4 powers or hidden equipment', () => {
    const s = fixture(), before = structuredClone(s);
    for (const id of ['moon.s5.regional-moon', 'moon.s5.moonlight-step', 'moon.s4.moonlight-paper', 'moon.s7.regeneration']) {
      expect(playerAbilityWheel(s, null).map(e => e.id)).not.toContain(id);
      expect(effect(s, id as CrimsonScholarMoveId)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before);
    }
    s.town.clubLocation = 'HAND'; expect(effect(s, 'STRIKE', 0.5).selfGain).toBe(8);
    s.town.clubLocation = 'SHOP'; expect(effect(s, 'SECONDARY_STRIKE', 0.5).selfGain).toBe(6);
    expect(effect(s, 'STRIKE', Number.NaN).selfGain).toBe(0);
  });
});
