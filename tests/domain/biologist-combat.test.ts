import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  BIOLOGIST_COUNT_WHEEL, biologistAbilityWheel, biologistActionCount, currentBiologistCombatSource,
  drawBiologistAbility, isBiologist, resolveBiologistCombatAbility,
  type BiologistCombatSource, type BiologistMoveId,
} from '../../src/domain/biologist/combat.js';
import * as biologistCombat from '../../src/domain/biologist/combat.js';
import { createBiologistState } from '../../src/domain/biologist/index.js';
import { settleBiologistEncounter } from '../../src/domain/biologist/encounter.js';
import { CULTIVATOR_COUNT_WHEEL, cultivatorAbilityWheel, currentCultivatorCombatSource } from '../../src/domain/cultivator/combat.js';
import { PHYSICIAN_COUNT_WHEEL, physicianAbilityWheel, currentPhysicianCombatSource } from '../../src/domain/physician/combat.js';
import { HARVESTPRIEST_COUNT_WHEEL, harvestpriestAbilityWheel, currentHarvestpriestCombatSource,
  resolveHarvestpriestCombatAbility } from '../../src/domain/harvestpriest/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'STRIKE', J = 'BODY_FOLLOWUP', B = 'mother.s6.specimen-study';
const K = 'mother.s6.controlled-trial', R = 'mother.s7.life-support', A = 'ACCIDENT';
const practice = 'mother.s9.careful-practice', ids = [H, J, B, K, R, A] as const;
function fixture(firstCase = false): SliceState {
  const state = createSliceRun('biologist-combat-test', sliceDefaultCreationSelection, 'biologist-combat');
  state.activeEvent = null; state.eventQueue = []; state.world.city = 'BACKLUND'; state.week = 3;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'mother', sequence: 6, mastery: {
    'mother.s9.cultivation-knowledge': 0, 'mother.s9.season-observation': 0, [practice]: 0,
    'mother.s8.condition-observation': 0, 'mother.s8.limited-healing': 0,
    'mother.s7.harvest-care': 0, [R]: 0, [B]: 0, [K]: 0,
  }, acting: 0, promotionWeek: 1 };
  state.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.biologist = createBiologistState();
  state.biologist.encounter = { status: 'FIGHTING', attemptWeek: state.week, startHistoryIndex: 0 };
  if (!firstCase) {
    state.biologist.practice = { sampleRecorded: true, warningsRecorded: true };
    state.biologist.trial = { careWeek: state.week - 1, verifiedWeek: state.week, waterUsed: 1, location: 'OWNER', status: 'RETURNED' };
    for (const [id, record] of Object.entries(state.biologist.cases)) Object.assign(record, {
      status: 'RESOLVED', method: 'ORDINARY', closes: 1,
      outcome: id === 'sample-record' ? 'SAMPLE_RECORDED' : id === 'paired-seedling' ? 'TRIAL_RECORDED' : 'RETURN_RECORDED',
    });
  }
  state.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'BIOLOGIST_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0,
    enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80; state.town.clubLocation = 'SHOP';
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-biologist-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: BiologistMoveId, physical = 1,
  source = currentBiologistCombatSource(state), random = fixedRolls()) {
  return resolveBiologistCombatAbility(state, id, physical, random, source);
}
/** Preserve real cursor advances and reject surplus draws. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Biologist finite G profile and inherited rules', () => {
  it('selects mother6 and exact six slots/counts with detached public wheels', () => {
    const state = fixture(); expect(isBiologist(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(biologistAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(entry => entry.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(BIOLOGIST_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 25, 30, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30); expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(BIOLOGIST_COUNT_WHEEL)).toBe(true); expect(BIOLOGIST_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    expect(Object.keys(state.progression.mastery).filter(id => id.includes('.s6.')).sort()).toEqual([B, K].sort());
    state.progression.pathwayId = 'moon'; expect(isBiologist(state)).toBe(false);
  });

  it('preserves each count boundary and exact1.25 stance tickets with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [80, 4], [81, 5], [100, 5]] as const)
      expect(biologistActionCount(roll)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2] : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [30, 15, 25, 10, 15, 5].map((weight, index) => weight * (boosted.includes(index) ? 5 : 4));
      const total = weights.reduce((sum, value) => sum + value, 0); let boundary = 0;
      biologistAbilityWheel(stance).forEach((entry, index) => {
        expect(entry.weight).toBe(total === 400 ? weights[index]! / 4 : weights[index]! / total * 100);
        const first = boundary + 1; boundary += weights[index]!;
        const random = fixedRolls(first, boundary);
        expect(drawBiologistAbility(random, stance)).toBe(ids[index]); expect(drawBiologistAbility(random, stance)).toBe(ids[index]);
        expect(random.cursor).toBe(2);
      });
      expect(boundary).toBe(total);
    }
  });

  it('uses G core20/15/20/45, base650, cap130, floor65, max80 and continuing regeneration8', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; scriptRolls(1, 1, 321, 400, 1);
    expect(resolveSliceCombatRound(state, 'PREPARE').round.playerAdvantage).toBe(679 * 0.8);
    expect(state.spirituality).toBe(8); expect(state.random.cursor).toBe(5); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 321, 400, 1); expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(780 * 0.6); vi.restoreAllMocks();
    const ceiling = fixture(); ceiling.spirituality = 79;
    scriptRolls(1, 1, 321, 400, 1); resolveSliceCombatRound(ceiling, 'PREPARE'); expect(ceiling.spirituality).toBe(80); vi.restoreAllMocks();
    vi.spyOn(biologistCombat, 'resolveBiologistCombatAbility').mockReturnValue({ label: 'test-negative', selfGain: -10_000, enemyReduction: 0, threatens: false });
    scriptRolls(1, 1, 321, 400, 1); expect(resolveSliceCombatRound(fixture(), 'PREPARE').round.playerAdvantage).toBe(65);
  });

  it('leaves exact mother9–7 wheels, FIRST_CASE-only gates and S7 signed-accident RNG unchanged', () => {
    for (const [sequence, counts, wheel, source] of [
      [9, CULTIVATOR_COUNT_WHEEL, cultivatorAbilityWheel, currentCultivatorCombatSource],
      [8, PHYSICIAN_COUNT_WHEEL, physicianAbilityWheel, currentPhysicianCombatSource],
      [7, HARVESTPRIEST_COUNT_WHEEL, harvestpriestAbilityWheel, currentHarvestpriestCombatSource],
    ] as const) {
      const state = fixture(true); state.progression.sequence = sequence;
      expect(isBiologist(state)).toBe(false); expect(currentBiologistCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(counts); expect(playerAbilityWheel(state, 'CONTROL')).toEqual(wheel('CONTROL', state));
      expect(source(state)).not.toBeNull(); state.combat!.encounterId = 'BIOLOGIST_DISPUTE'; expect(source(state)).toBeNull();
    }
    const old = fixture(true); old.progression.sequence = 7; old.spirituality = 60;
    const random = fixedRolls(2); expect(resolveHarvestpriestCombatAbility(old, A, 1, random).selfGain).toBe(11.25);
    expect(random.cursor).toBe(1);
    scriptRolls(1, 1, 396, 2, 400, 1);
    expect(resolveSliceCombatRound(old, 'PREPARE').round.playerAdvantage).toBe(476.25);
    expect(old.random.cursor).toBe(6); expect(old.spirituality).toBe(60);
  });
});

describe('Biologist original ordinary body, source and observation boundaries', () => {
  it('H uses actual town HAND16 otherwise body12, while J uses only inherited careful-practice8.4f', () => {
    for (const mastery of [0, 100, 500]) for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.progression.mastery[practice] = mastery;
      state.progression.mastery[B] = 500; state.progression.mastery[K] = 500; state.town.clubLocation = location;
      const before = structuredClone(state), f = 0.65 + 0.35 * mastery / 500;
      expect(resolve(state, H, 0.8)).toMatchObject({ selfGain: (location === 'HAND' ? 16 : 12) * 0.8, enemyReduction: 0, threatens: true });
      expect(resolve(state, J, 0.8)).toMatchObject({ selfGain: 8.4 * f * 0.8, enemyReduction: 0, threatens: true });
      expect(state).toEqual(before);
    }
  });

  it('B reads no hidden weakness, disease, future or carrier secrets; K never borrows greenhouse plants', () => {
    const state = fixture(); state.spirituality = 0;
    state.progression.mastery[B] = 100; state.progression.mastery[K] = 500;
    state.progression.mastery['mother.s8.condition-observation'] = 500;
    const untouched = structuredClone(state), forbidden = () => { throw new Error('Hidden oracle read'); };
    for (const key of ['hiddenWeakness', 'hiddenDisease', 'futureAction']) Object.defineProperty(state.combat!, key, { get: forbidden });
    for (const key of ['carrierSecret', 'hiddenDiagnosis', 'futureEvents']) Object.defineProperty(state.world, key, { get: forbidden });
    const random = fixedRolls();
    expect(resolve(state, B, 0.8, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 42.25 * 0.72 * 0.8, threatens: false });
    expect(resolve(state, B).label).toContain('不读取隐藏弱点、病情、秘密或未来');
    const effect = resolve(state, K, 0.8, undefined, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
    expect(effect.label).toContain('温室原苗留在原处'); expect(effect.label).toContain('无额外魔法');
    expect(state.biologist).toEqual(untouched.biologist); expect(state.town).toEqual(untouched.town);
    expect(state.progression).toEqual(untouched.progression); expect(state.spirituality).toBe(0); expect(random.cursor).toBe(0);
  });

  it('closed WAITING/VERIFIED plants remain in the greenhouse and cannot become a battle spell', () => {
    for (const status of ['WAITING', 'VERIFIED'] as const) {
      const state = fixture(); state.biologist.trial.status = status; state.biologist.trial.location = 'BENCH';
      const before = structuredClone(state), random = fixedRolls();
      expect(currentBiologistCombatSource(state)).not.toBeNull();
      expect(resolve(state, K, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 6, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      state.biologist.cases['paired-seedling']!.contactOpen = true;
      expect(currentBiologistCombatSource(state)).toBeNull();
      expect(resolve(state, K)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
  });

  it('bounds malformed mastery/body factors without reading other new or inherited mastery', () => {
    for (const [mastery, physical, f, body] of [[Number.NaN, Number.NaN, 0.65, 0], [-1, -1, 0.65, 0],
      [Infinity, Infinity, 0.65, 0], [900, 3, 1, 1], [100, 0.8, 0.72, 0.8]] as const) {
      const state = fixture(); state.progression.mastery[practice] = mastery; state.progression.mastery[B] = mastery;
      state.progression.mastery[K] = 500; state.progression.mastery['mother.s8.condition-observation'] = 500;
      expect(resolve(state, H, physical).selfGain).toBe(12 * body);
      expect(resolve(state, J, physical).selfGain).toBe(8.4 * f * body);
      expect(resolve(state, B, physical).enemyReduction).toBe(42.25 * f * body);
      expect(resolve(state, K, physical).enemyReduction).toBe(6 * body);
    }
  });

  it('A is fixed−16.25 with no additional draw, cost or wound threat', () => {
    const state = fixture(); const before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, A, 0, undefined, random)).toMatchObject({ selfGain: -16.25, enemyReduction: 0, threatens: false });
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('returns zero for stale or forged original source and blocks invalid battle before any RNG', () => {
    const state = fixture(), source = currentBiologistCombatSource(state)!;
    expect(source).toMatchObject({ encounterId: 'BIOLOGIST_DISPUTE', target: 'LORNE_SINGLE_ADULT_ORDINARY_HUMAN',
      weapon: 'LORNES_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', distanceMetres: 2,
      space: 'ORIGINAL_CLEAR_COURTYARD', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    for (const patch of [{ revision: state.revision + 1 }, { round: 2 }, { weaponLocation: 'BAG' },
      { target: 'GREENHOUSE_SEEDLING' }, { distanceMetres: 20 }, { pursuit: true }, { exit: 'BLOCKED' }]) {
      const random = fixedRolls(), before = structuredClone(state);
      for (const id of ids) expect(resolve(state, id, 1, { ...source, ...patch } as BiologistCombatSource, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const mutate of [
      (s: SliceState) => { s.biologist.cases['sample-record']!.contactOpen = true; },
      (s: SliceState) => { s.biologist.cases['sample-record']!.status = 'PREPARED'; },
      (s: SliceState) => { s.biologist.encounter.attemptWeek = s.week - 1; },
      (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.health = 0; },
    ]) {
      const invalid = fixture(); mutate(invalid); const before = structuredClone(invalid);
      expect(currentBiologistCombatSource(invalid)).toBeNull();
      expect(() => resolveSliceCombatRound(invalid, 'ATTACK')).toThrow(); expect(invalid).toEqual(before);
    }
  });

  it('keeps FIRST_CASE its own actual carrier source and rechecks every slot without extra draws', () => {
    const state = fixture(true); expect(currentBiologistCombatSource(state)).toMatchObject({ encounterId: 'FIRST_CASE', target: 'CURRENT_VISIBLE_ORDINARY_CARRIER' });
    state.health = 50; state.spirituality = 12;
    const original = biologistCombat.resolveBiologistCombatAbility; let calls = 0;
    vi.spyOn(biologistCombat, 'resolveBiologistCombatAbility').mockImplementation((...args) => {
      const effect = original(...args); if (++calls === 1) state.world.carrierCanResist = false; return effect;
    });
    const draws = scriptRolls(100, 1, 321, 400, 1, 121, 181, 396, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual(Array(5).fill([0, 0]));
    expect(round.moves.filter(move => move.actor === 'PLAYER').slice(1).every(move => move.label.includes('缺少本场'))).toBe(true);
    expect(state.health).toBe(59); expect(state.spirituality).toBe(16); expect(calls).toBe(5); expect(draws).toHaveBeenCalledTimes(9);
  });
});

describe('Biologist inherited recovery stays finite and cannot erase death risk', () => {
  it('uses original life-support mastery only, heals floor15f for4S and never gives advantage or RNG', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.health = 60; state.spirituality = 4; state.mind = 32; state.seer.pollution = 41;
      state.injuryRisk = 3; state.injuries = [{ id: 'old-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
      state.progression.mastery[R] = mastery; state.progression.mastery[B] = 500; state.progression.mastery[K] = 500;
      const before = structuredClone(state), recovered = Math.floor(15 * (0.65 + 0.35 * mastery / 500)), random = fixedRolls();
      expect(resolve(state, R, 0, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual({ ...before, health: 60 + recovered, spirituality: 0 }); expect(random.cursor).toBe(0);
    }
  });

  it('caps recovery at missing health, full health costs0, insufficient S and dead sources stay unchanged', () => {
    const state = fixture(); state.health = 80; state.spirituality = 12; state.progression.mastery[R] = 500;
    resolve(state, R); expect(state.health).toBe(95); expect(state.spirituality).toBe(8);
    resolve(state, R); expect(state.health).toBe(100); expect(state.spirituality).toBe(4);
    expect(resolve(state, R).label).toContain('当前健康已满'); expect(state.spirituality).toBe(4);
    for (const [health, spirituality] of [[75, 0], [75, 3.9], [75, Number.NaN], [75, Infinity], [0, 80], [100, 80]] as const) {
      const unchanged = fixture(); unchanged.health = health; unchanged.spirituality = spirituality;
      const before = structuredClone(unchanged), random = fixedRolls();
      expect(resolve(unchanged, R, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(unchanged).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('heals only three times with12S across five real R slots before ordinary continuing recovery', () => {
    const state = fixture(); state.health = 60; state.spirituality = 12;
    const draws = scriptRolls(100, 1, 321, 400, 321, 321, 321, 321, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    const moves = round.moves.filter(move => move.actor === 'PLAYER');
    expect(moves.slice(0, 3).every(move => move.label.includes('实际恢复9健康'))).toBe(true);
    expect(moves.slice(3).every(move => move.label.includes('灵性不足4'))).toBe(true);
    expect(moves.map(move => [move.selfGain, move.enemyReduction])).toEqual(Array(5).fill([0, 0]));
    expect(state.health).toBe(87); expect(state.spirituality).toBe(8); expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(9);
  });

  it('a real heal changes later physical factors but never revises the starting base or injury history', () => {
    const state = fixture(); state.health = 75; state.spirituality = 20;
    state.injuryRisk = 1; state.injuries = [{ id: 'old-light', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }];
    const before = structuredClone(state), draws = scriptRolls(100, 1, 321, 400, 1, 121, 181, 281, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[0, 0], [12, 0], [8.4 * 0.65, 0], [0, 42.25 * 0.65], [0, 6]]);
    expect(round.playerAdvantage).toBe(665 * 0.75 + 12 + 8.4 * 0.65);
    expect(state.health).toBe(84); expect(state.spirituality).toBe(24);
    expect(state.injuries).toEqual(before.injuries); expect(state.injuryRisk).toBe(1); expect(draws).toHaveBeenCalledTimes(10);
  });
});

// PREPARE tickets: H1–120/J121–180/B181–280/K281–320/R321–395/A396–415.
describe('Biologist actual alternating rounds and terminal exits', () => {
  it('alternates five player/three ordinary enemy slots and never suppresses real enemy attacks', () => {
    const state = fixture(); state.spirituality = 20; const originals = structuredClone({ town: state.town, biologist: state.biologist });
    const draws = scriptRolls(100, 100, 1, 1, 121, 1, 181, 1, 281, 321, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[12, 0], [8.4 * 0.65, 0], [0, 42.25 * 0.65], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(665 * 0.8 + 12 + 8.4 * 0.65);
    expect(round.enemyAdvantage).toBe(114 + 48 - (42.25 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90); expect(state.spirituality).toBe(28);
    expect({ town: state.town, biologist: state.biologist }).toEqual(originals); expect(draws).toHaveBeenCalledTimes(12);
    state.combatHistory.push(round); vi.restoreAllMocks();
    const nextDraws = scriptRolls(1, 1, 400, 321, 1);
    const next = resolveSliceCombatRound(state, 'PREPARE');
    expect(next.round.first).toBe('ENEMY'); expect(next.round.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER']);
    expect(nextDraws).toHaveBeenCalledTimes(5);
  });

  it('B/K/R/A never create physical wounds and a real H/J uses the unchanged shared consequence draw', () => {
    for (const ticket of [181, 281, 321, 396]) {
      const state = fixture(), draws = scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
      expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
      expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(5); vi.restoreAllMocks();
    }
    for (const ticket of [1, 121]) {
      const state = fixture(); state.spirituality = 10;
      const draws = scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 }); expect(round.consequence).toContain('洛恩仍然活着');
      expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('a capped heal cannot erase injury risk or avert the real player death branch and never revives', () => {
    const state = fixture(); state.health = 94; state.spirituality = 10; state.injuryRisk = 1;
    state.injuries = [{ id: 'old-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const before = structuredClone(state), draws = scriptRolls(1, 1, 321, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves[0]!.label).toContain('实际恢复6健康'); expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0); expect(state.spirituality).toBe(6);
    expect(state.injuryRisk).toBe(2); expect(state.injuries).toEqual(before.injuries); expect(draws).toHaveBeenCalledTimes(6);
    const dead = structuredClone(state); expect(resolve(state, R)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(state).toEqual(dead);
  });

  it('preserves the original exit50/51 boundary, no pursuit or terminal regeneration, and settles once', () => {
    const ctx = { note: vi.fn(), roll: () => 1, check: () => { throw new Error('No check'); } } satisfies SeerContext;
    const state = fixture(); state.spirituality = 10;
    const originals = structuredClone({ town: state.town, trial: state.biologist.trial }), draws = scriptRolls(100, 100, 50);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]); expect(result.round.consequence).toContain('没有瞬移、移物或进入追逐');
    expect(result.round.consequence).toContain('原苗木仍在原温室'); expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(3);
    state.combatHistory.push(result.round); const award = vi.fn(); settleBiologistEncounter(state, result.outcome, ctx, award);
    expect(state.combat).toBeNull(); expect(state.biologist.encounter.status).toBe('RETREATED'); expect(award).not.toHaveBeenCalled();
    expect({ town: state.town, trial: state.biologist.trial }).toEqual(originals);
    expect(() => settleBiologistEncounter(state, result.outcome, ctx, award)).toThrow(); vi.restoreAllMocks();
    const failed = fixture(); failed.spirituality = 10; const failedDraws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const response = resolveSliceCombatRound(failed, 'RETREAT');
    expect(response.round.retreat).toBe('FAILURE'); expect(response.round.moves).toHaveLength(1);
    expect(response.round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(failed.health).toBe(90); expect(failed.spirituality).toBe(18); expect(failedDraws).toHaveBeenCalledTimes(6);
  });

  it('preserves real enemy death and exact serialized deterministic replay', () => {
    const state = fixture(); state.spirituality = 10; const draws = scriptRolls(1, 1, 1, 400, 1, 96);
    expect(resolveSliceCombatRound(state, 'PREPARE').outcome).toBe('ENEMY_DEAD');
    expect(state.combat!.enemyHealth).toBe(0); expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    const replay = fixture(); replay.town.clubLocation = 'HAND'; replay.health = 70; replay.random.cursor = 7;
    const restored = JSON.parse(JSON.stringify(replay)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Math.random is forbidden'); });
    expect(resolveSliceCombatRound(replay, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(replay).toEqual(restored); expect(forbidden).not.toHaveBeenCalled(); expect(replay.town.clubLocation).toBe('HAND');
  });
});
