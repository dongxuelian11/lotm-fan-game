import {migrateSliceState} from '../../src/domain/slice/migration.js';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { NIGHTMARE_COUNT_WHEEL, currentNightmareDreamSource, currentNightmareNightSource,
  drawNightmareAbility, finishNightmareCombatRound, isNightmare, nightmareAbilityWheel,
  nightmareActionCount, releaseNightmareDream, resolveNightmareCombatAbility,
  resolveNightmareEnemyAction, type NightmareMoveId,
  type NightmareNightSource } from '../../src/domain/nightmare/combat.js';
import { MIDNIGHT_COUNT_WHEEL, midnightAbilityWheel } from '../../src/domain/midnight/combat.js';
import { SLEEPLESS_COUNT_WHEEL, sleeplessAbilityWheel } from '../../src/domain/sleepless/combat.js';
import { currentClownDangerSource } from '../../src/domain/clown/combat.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('nightmare-combat-test', sliceDefaultCreationSelection, 'nightmare-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'darkness', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  Object.assign(state.nightmare.encounter, { status: 'FIGHTING', observed: true, bystanderCleared: true,
    attemptWeek: state.week, startHistoryIndex: state.combatHistory.length, pressure: 0, dreamLocked: false });
  state.combat = { encounterId: 'NIGHTMARE_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: NightmareMoveId, source = currentNightmareNightSource(state)) {
  return resolveNightmareCombatAbility(state, id, 1, stream(state), source);
}
/** Preserve each real cursor increment, then pin only that draw's returned value. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum);
    expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());
const physicalIds = ['darkness.s8.physical-training', 'darkness.s8.physical-follow-up',
  'darkness.s8.self-protection'] as const;
const ids = [...physicalIds, 'darkness.s7.dream-entry', 'OBSERVE', 'ACCIDENT'] as const;
const oldEncounters = ['FIRST_CASE', 'CLOWN_RESCUE', 'HUNTER_CARGO', 'PROVOKER_DISPUTE',
  'MAGICIAN_DISPUTE', 'PYROMANIAC_DISPUTE', 'PSYCHOLOGIST_DISPUTE', 'VAMPIRE_DISPUTE',
  'SLEEPLESS_WATCH', 'MIDNIGHT_DISPUTE'] as const;

describe('Nightmare S7 exact C profile and inherited physical budgets', () => {
  it('uses the approved six slots and five counts without mutating shared wheels', () => {
    const state = fixture();
    expect(isNightmare(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(NIGHTMARE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel).toEqual(nightmareAbilityWheel(null));
    expect(wheel.map(entry => entry.id)).toEqual(ids);
    expect(wheel.map(entry => entry.weight)).toEqual([20, 15, 20, 30, 8, 7]);
    wheel[0]!.weight = 0; const counts = playerCountWheel(state); counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it('preserves all action-count boundaries and exact neutral ability tickets', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3], [61, 4], [85, 4], [86, 5], [100, 5]]) {
      expect(nightmareActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of nightmareAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawNightmareAbility(random, null)).toBe(entry.id);
      expect(drawNightmareAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('biases only matching stance tickets by exactly ×1.25, never accidents', () => {
    for (const [stance, weights] of [
      ['ATTACK', [100, 75, 80, 120, 32, 28]], ['DEFEND', [80, 60, 100, 120, 32, 28]],
      ['CONTROL', [80, 60, 80, 150, 32, 28]], ['PREPARE', [80, 60, 80, 120, 40, 28]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(nightmareAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / total * 100));
      let boundary = 0;
      for (const [index, weight] of weights.entries()) {
        const first = boundary + 1; boundary += weight;
        scriptRolls(first, boundary); const random = stream(fixture());
        expect(drawNightmareAbility(random, stance)).toBe(ids[index]);
        expect(drawNightmareAbility(random, stance)).toBe(ids[index]); vi.restoreAllMocks();
      }
    }
    expect(nightmareAbilityWheel('RETREAT')).toEqual(nightmareAbilityWheel(null));
  });

  it('uses base450, core10/25/40/25, core cap90 and spirituality60 without a night base multiplier', () => {
    const state = fixture(); state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 376, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(478); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60); expect(state.nightmare.encounter.pressure).toBe(1);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(6);
  });

  it('scales the unrounded body budgets only with inherited physical-training mastery', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery['darkness.s8.physical-training'] = mastery;
      state.progression.mastery['darkness.s9.night-vigor'] = 500;
      state.progression.mastery['darkness.s7.dream-entry'] = 500;
      const before = structuredClone(state), random = stream(state), f = 0.65 + 0.35 * mastery / 500;
      expect(resolveNightmareCombatAbility(state, physicalIds[0], 1, random)).toMatchObject({ selfGain: 20.475 * f * 1.1, enemyReduction: 0, threatens: true });
      expect(resolveNightmareCombatAbility(state, physicalIds[1], 0.8, random)).toMatchObject({ selfGain: 11.025 * f * 1.1 * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveNightmareCombatAbility(state, physicalIds[2], 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 29.25 * f * 1.1, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('replaces only the primary slot with an actually held original club, without budget or night stacking', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    state.progression.mastery['darkness.s8.physical-training'] = 500;
    const random = stream(state);
    expect(resolveNightmareCombatAbility(state, physicalIds[0], 0.8, random).selfGain).toBe(12.8);
    expect(resolve(state, physicalIds[1]).selfGain).toBe(11.025 * 1.1);
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
    expect(random.cursor).toBe(0);
  });

  it('keeps accident ±11.25 unboosted and never authorizes a physical consequence', () => {
    for (const roll of [1, 2]) {
      const state = fixture(), before = structuredClone(state), random = stream(state);
      scriptRolls(roll);
      expect(resolveNightmareCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({
        selfGain: roll === 1 ? -11.25 : 11.25, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
  });
});

describe('current ordinary awake target, range and battle source', () => {
  it('binds only the observed current Kell body, authored night, ordinary exit and local six-metre range', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentNightmareNightSource(state)).toMatchObject({ encounterId: 'NIGHTMARE_DISPUTE',
      target: 'KELL_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY', origin: 'OBSERVED_AWAKE_BEFORE_PULL',
      time: 'SCHEDULED_NIGHT', space: 'OPEN_SMALL_COURTYARD', exit: 'ORDINARY_OPEN_EXIT',
      range: 'LOCAL_DREAM_AT_MOST_SIX_METRES', bystander: 'PORTER_WITHDRAWN' });
    expect(currentNightmareDreamSource(state)).toEqual(currentNightmareNightSource(state));
    expect(currentClownDangerSource(state)).toBeNull();
    for (const mutate of [
      (s: SliceState) => { s.nightmare.encounter.observed = false; },
      (s: SliceState) => { s.nightmare.encounter.status = 'RESOLVED'; },
      (s: SliceState) => { s.nightmare.encounter.attemptWeek = null; },
      (s: SliceState) => { s.nightmare.encounter.attemptWeek = s.week - 1; },
      (s: SliceState) => { s.nightmare.encounter.startHistoryIndex = null; },
      (s: SliceState) => { s.nightmare.encounter.startHistoryIndex = 1; },
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.pathwayId = 'moon'; },
    ]) {
      const candidate = fixture(); mutate(candidate);
      expect(currentNightmareNightSource(candidate)).toBeNull();
      expect(currentNightmareDreamSource(candidate)).toBeNull();
    }
  });

  it('clears stale or forged pressure/locks without costs, secret disclosure, checks or redraws', () => {
    const state = fixture(), source = currentNightmareNightSource(state)!;
    state.knowledge = [{ id: 'private', week: 1, title: 'SECRET', text: 'HIDDEN_TARGET_SECRET' }];
    const invalid: (NightmareNightSource | null)[] = [null, { ...source, round: 2 },
      { ...source, attemptWeek: source.attemptWeek + 1 }, { ...source, startHistoryIndex: 100 },
      ...(['target', 'body', 'origin', 'time', 'space', 'exit', 'range', 'bystander', 'aggression'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as NightmareNightSource)];
    for (const input of invalid) for (const id of ['OBSERVE', 'darkness.s7.dream-entry'] as const) {
      Object.assign(state.nightmare.encounter, { pressure: 2, dreamLocked: true });
      const before = structuredClone(state), random = stream(state);
      const effect = resolveNightmareCombatAbility(state, id, 1, random, input);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).not.toMatch(/HIDDEN_TARGET_SECRET|凯尔/);
      expect(state.spirituality).toBe(before.spirituality); expect(state.lastCheck).toEqual(before.lastCheck);
      expect(state.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      expect(random.cursor).toBe(0);
    }
  });

  it('requires actual bystander withdrawal for dreams but preserves the confirmed night for body slots', () => {
    const state = fixture(); state.nightmare.encounter.bystanderCleared = false;
    expect(currentNightmareNightSource(state)?.bystander).toBe('PORTER_PRESENT');
    expect(currentNightmareDreamSource(state)).toBeNull();
    expect(resolve(state, 'OBSERVE')).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(resolve(state, 'darkness.s7.dream-entry')).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(resolve(state, physicalIds[0]).selfGain).toBe(20.475 * 0.65 * 1.1);
    expect(state.spirituality).toBe(60); expect(state.nightmare.encounter.pressure).toBe(0);
  });

  it('never borrows old night geometry, targets or pressure in another encounter or week', () => {
    for (const encounterId of oldEncounters) {
      const state = fixture(); state.combat!.encounterId = encounterId;
      Object.assign(state.midnight.encounter, { observed: true, bystanderCleared: true,
        status: 'FIGHTING', attemptWeek: state.week, startHistoryIndex: 0 });
      Object.assign(state.nightmare.encounter, { pressure: 2, dreamLocked: true });
      const random = stream(state);
      expect(currentNightmareNightSource(state)).toBeNull();
      expect(resolveNightmareCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
      expect(resolve(state, physicalIds[0]).selfGain).toBe(20.475 * 0.65);
      expect(resolve(state, physicalIds[1]).selfGain).toBe(11.025 * 0.65);
      expect(resolve(state, physicalIds[2]).enemyReduction).toBe(29.25 * 0.65);
      expect(state.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      expect(state.spirituality).toBe(60); expect(random.cursor).toBe(0);
    }
    const stale = fixture(); Object.assign(stale.nightmare.encounter, { pressure: 2, dreamLocked: true });
    stale.week += 1; const random = stream(stale);
    expect(resolveNightmareEnemyAction(stale, random, true)).toBeNull();
    expect(stale.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    expect(random.cursor).toBe(0);
  });
});

describe('finite gradual awake pull and honest control costs', () => {
  it('requires two paid R preparations, each zero immediate contribution, before any control check', () => {
    const state = fixture(), random = stream(state);
    for (const pressure of [0, 1] as const) {
      expect(state.nightmare.encounter.pressure).toBe(pressure);
      expect(resolveNightmareCombatAbility(state, 'darkness.s7.dream-entry', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      const effect = resolveNightmareCombatAbility(state, 'OBSERVE', 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('仍按原次数行动');
      expect(state.nightmare.encounter.dreamLocked).toBe(false);
      expect(state.spirituality).toBe(60 - (pressure + 1) * 3);
    }
    expect(state.nightmare.encounter.pressure).toBe(2); expect(random.cursor).toBe(0);
    resolveNightmareCombatAbility(state, 'OBSERVE', 1, random);
    expect(state.spirituality).toBe(51); expect(state.nightmare.encounter.pressure).toBe(2);
  });

  it('spends exactly 4 and one will16 check, uses dream-entry mastery and resets pressure on failure', () => {
    for (const mastery of [0, 250, 500]) for (const roll of [1, 48, 49, 100]) {
      const state = fixture(); state.nightmare.encounter.pressure = 2; state.spirituality = 10;
      state.progression.mastery['darkness.s7.dream-entry'] = mastery;
      state.progression.mastery['darkness.s7.dream-discernment'] = 500;
      const random = stream(state), draws = scriptRolls(roll), success = roll <= 48;
      const effect = resolveNightmareCombatAbility(state, 'darkness.s7.dream-entry', 1, random);
      expect(effect).toMatchObject({ selfGain: 0,
        enemyReduction: success ? 15.75 * (0.65 + 0.35 * mastery / 500) * 1.1 : 0, threatens: false });
      expect(state.spirituality).toBe(6);
      expect(state.lastCheck).toMatchObject({ ability: 'will', baseAbility: 15, difficulty: 16, chance: 48, roll });
      expect(state.nightmare.encounter).toMatchObject({ pressure: success ? 2 : 0, dreamLocked: success });
      expect(draws).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
  });

  it('maintains an already locked target without new control, repeated fees or extra advantage', () => {
    const state = fixture(); state.nightmare.encounter.pressure = 2;
    const random = stream(state), draws = scriptRolls(1);
    expect(resolveNightmareCombatAbility(state, 'darkness.s7.dream-entry', 1, random).enemyReduction).toBe(15.75 * 0.65 * 1.1);
    expect(state.spirituality).toBe(56);
    for (const id of ['OBSERVE', 'darkness.s7.dream-entry'] as const) {
      const effect = resolveNightmareCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('维持现有梦境');
    }
    expect(state.spirituality).toBe(56); expect(state.nightmare.encounter.dreamLocked).toBe(true);
    expect(random.cursor).toBe(1); expect(draws).toHaveBeenCalledTimes(1);
  });

  it('retains prepared pressure when spirituality is insufficient and gives no free check or replacement', () => {
    for (const [id, cost] of [['OBSERVE', 3], ['darkness.s7.dream-entry', 4]] as const) {
      const state = fixture(); state.spirituality = cost - 0.1; state.nightmare.encounter.pressure = 2;
      const before = structuredClone(state), random = stream(state);
      expect(resolveNightmareCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('keeps original ordinary enemy actions active while pressure is merely building', () => {
    const state = fixture();
    // Three paid R slots keep the target awake; two actual enemy strikes still occur.
    scriptRolls(36, 46, 341, 1, 341, 1, 341, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.playerCount).toBe(3); expect(round.enemyCount).toBe(2);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').every(move => move.selfGain === 0 && move.enemyReduction === 0)).toBe(true);
    expect(state.nightmare.encounter).toMatchObject({ pressure: 2, dreamLocked: false });
    expect(state.spirituality).toBe(57); expect(state.combat!.enemyHealth).toBe(100);
    expect(round.consequenceWeights).toBeNull(); expect(state.random.cursor).toBe(8);
  });
});

describe('body immobility, one original enemy action and exposed caster', () => {
  it('blocks every subsequent physical slot, including an actual held club, without an extra draw', () => {
    for (const id of physicalIds) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      Object.assign(state.nightmare.encounter, { pressure: 2, dreamLocked: true });
      const before = structuredClone(state), random = stream(state);
      const effect = resolveNightmareCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('本体不能移动'); expect(effect.label).toContain('不重抽');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('uses one enemy will8 versus player-will normal check, then releases for either result', () => {
    for (const roll of [1, 36, 37, 100]) for (const physicalAttack of [true, false]) {
      const state = fixture(); Object.assign(state.nightmare.encounter, { pressure: 2, dreamLocked: true });
      const random = stream(state), draws = scriptRolls(roll);
      const response = resolveNightmareEnemyAction(state, random, physicalAttack);
      expect(response).toMatchObject({ suppressed: roll > 36, physicalMultiplier: roll <= 36 && physicalAttack ? 1.25 : 1 });
      expect(state.lastCheck).toMatchObject({ ability: 'will', baseAbility: 8, difficulty: 15, chance: 36, roll });
      expect(state.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      expect(state.spirituality).toBe(60); expect(draws).toHaveBeenCalledTimes(1);
      expect(resolveNightmareEnemyAction(state, random, physicalAttack)).toBeNull();
      expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
  });

  it('suppresses one original enemy strike but keeps the drawn count, action log and next original strike', () => {
    const state = fixture(); state.nightmare.encounter.pressure = 2;
    // One control slot, success; enemy's first drawn strike fails resistance; its second is unchanged.
    scriptRolls(1, 46, 221, 1, 1, 100, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(2);
    const enemies = round.moves.filter(move => move.actor === 'ENEMY');
    expect(enemies.map(move => move.selfGain)).toEqual([0, 16]);
    expect(enemies[0]!.label).toContain('原行动次数保留');
    expect(enemies[1]!.label).not.toContain('抵抗梦境');
    expect(round.moves).toHaveLength(3); expect(state.random.cursor).toBe(8);
    expect(state.combat!.enemyInjuries).toEqual([]); expect(round.consequenceWeights).toBeNull();
  });

  it('executes only the original resisted strike at ×1.25 caster exposure, with no added action', () => {
    const state = fixture(); state.nightmare.encounter.pressure = 2;
    scriptRolls(1, 46, 221, 1, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.enemyCount).toBe(2);
    const enemies = round.moves.filter(move => move.actor === 'ENEMY');
    expect(enemies.map(move => move.selfGain)).toEqual([20, 16]);
    expect(enemies[0]!.label).toContain('本体暴露'); expect(enemies[1]!.label).not.toContain('本体暴露');
    expect(round.moves).toHaveLength(3); expect(state.random.cursor).toBe(8);
  });

  it('suppresses an original block contribution too, and never turns nonattacks into exposed-caster strikes', () => {
    for (const resistRoll of [1, 100]) {
      const state = fixture(); state.nightmare.encounter.pressure = 2;
      scriptRolls(1, 1, 221, 1, 161, resistRoll, 1);
      const { round } = resolveSliceCombatRound(state, 'CONTROL');
      const enemy = round.moves.find(move => move.actor === 'ENEMY')!;
      expect(enemy.selfGain).toBe(0); expect(enemy.enemyReduction).toBe(resistRoll === 1 ? 10 : 0);
      expect(enemy.label).not.toContain('本体暴露'); expect(state.random.cursor).toBe(7);
      vi.restoreAllMocks();
    }
  });

  it('consumes a drawn physical slot after late-round control even when no enemy action remains', () => {
    const state = fixture(); state.nightmare.encounter.pressure = 2; state.town.clubLocation = 'HAND';
    // Three player actions: self-protection, control after the sole enemy move, blocked primary.
    scriptRolls(36, 1, 141, 400, 221, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    const player = round.moves.filter(move => move.actor === 'PLAYER');
    expect(player).toHaveLength(3); expect(player[2]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(player[2]!.label).toContain('本体不能移动'); expect(state.random.cursor).toBe(8);
    expect(state.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
  });

  it('releases the dream before the original successful or failed ordinary retreat rule', () => {
    for (const retreatRoll of [1, 100]) {
      const state = fixture(); Object.assign(state.nightmare.encounter, { pressure: 2, dreamLocked: true });
      const rolls = retreatRoll === 1 ? [1, 1, 1] : [1, 1, 100, 400, 1];
      scriptRolls(...rolls);
      const result = resolveSliceCombatRound(state, 'RETREAT');
      expect(result.round.moves[0]!.label).toContain('先解除梦境牵制');
      expect(result.round.retreat).toBe(retreatRoll === 1 ? 'SUCCESS' : 'FAILURE');
      expect(result.outcome).toBe(retreatRoll === 1 ? 'RETREATED' : 'CONTINUE');
      expect(state.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      expect(state.random.cursor).toBe(rolls.length); expect(state.health).toBe(100);
      vi.restoreAllMocks();
    }
  });

  it('preserves only unlocked pressure within a live battle, and clears all terminal or invalid state', () => {
    const state = fixture(); state.nightmare.encounter.pressure = 1;
    finishNightmareCombatRound(state, true);
    expect(state.nightmare.encounter.pressure).toBe(1);
    state.nightmare.encounter.dreamLocked = true; finishNightmareCombatRound(state, true);
    expect(state.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    state.nightmare.encounter.pressure = 2; finishNightmareCombatRound(state, false);
    expect(state.nightmare.encounter.pressure).toBe(0);
    state.nightmare.encounter.pressure = 2; state.combat = null; finishNightmareCombatRound(state, true);
    expect(state.nightmare.encounter.pressure).toBe(0);
    Object.assign(state.nightmare.encounter, { pressure: 2, dreamLocked: true }); releaseNightmareDream(state);
    expect(state.nightmare.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
  });
});

describe('deterministic replay and unchanged older profiles', () => {
  it('replays the complete round including checks, source mutations and cursor identically', () => {
    for (let seed = 0; seed < 12; seed += 1) {
      const state = fixture(); state.random.seed = `nightmare-replay-${seed}`;
      state.nightmare.encounter.pressure = 2;
      const replay = structuredClone(state);
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(replay, 'CONTROL'));
      expect(state).toEqual(replay);
    }
  });

  it('leaves S8/S9 and ordinary selection unchanged and gives no new Diviner danger source', () => {
    const state = fixture(); state.progression.sequence = 8;
    expect(isNightmare(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(MIDNIGHT_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(midnightAbilityWheel(null));
    state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(SLEEPLESS_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(sleeplessAbilityWheel(null));
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9], ['moon', 8], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isNightmare(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    expect(currentClownDangerSource(state)).toBeNull();
  });

  it('does not add dream mutations or RNG draws to an ordinary combat round', () => {
    const state = fixture(); state.progression.pathwayId = null; state.progression.sequence = null;
    state.combat!.encounterId = 'FIRST_CASE'; state.spirituality = 15;
    Object.assign(state.nightmare.encounter, { pressure: 2, dreamLocked: true });
    const before = structuredClone(state.nightmare);
    scriptRolls(1, 1, 440, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(115); expect(round.enemyAdvantage).toBe(114);
    expect(round.moves.map(move => move.label)).toEqual(['动作落空', '动作落空']);
    expect(state.nightmare).toEqual(before); expect(state.random.cursor).toBe(5);
  });
});


describe('actual negative-accident terminal-state regression', () => {
  it('replays the recorded original seed and intent through shared validation without discarding −11.25', () => {
    const recorded = JSON.parse(readFileSync(
      new URL('../fixtures/nightmare-v0220/negative-accident-boundary.json', import.meta.url), 'utf8',
    )) as { beforeLast: SliceState; lastIntent: SliceIntent };
    const before = migrateSliceState(recorded.beforeLast);
    const untouched=structuredClone(before);
    const originalRandom = { ...before.random };
    expect(() => assertValidSliceState(before)).not.toThrow();
    const result = applySliceIntent(before, recorded.lastIntent);
    expect(before).toEqual(untouched);
    expect(result.random.seed).toBe(originalRandom.seed);
    expect(result.random.cursor).toBeGreaterThan(originalRandom.cursor);
    expect(result.lastCombatRound!.moves.some(move => move.selfGain === -11.25)).toBe(true);
    expect(result.combatHistory.at(-1)).toEqual(result.lastCombatRound);
    expect(result.combat).toBeNull();
    expect(() => assertValidSliceState(result)).not.toThrow();
    expect(applySliceIntent(migrateSliceState(recorded.beforeLast), recorded.lastIntent)).toEqual(result);
  });
});
