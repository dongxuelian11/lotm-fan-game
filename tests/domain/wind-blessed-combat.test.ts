import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { NAVIGATOR_COUNT_WHEEL, consumeNavigatorWater, currentNavigatorCombatSource,
  currentWindBlessedCombatSource, drawNavigatorAbility, hasNavigatorCombat, isNavigator, isWindBlessed,
  navigatorAbilityWheel, navigatorActionCount, resolveNavigatorCombatAbility,
  type NavigatorCombatSource, type NavigatorMoveId } from '../../src/domain/navigator/combat.js';
import { currentRagerCombatSource, hasRagerWrath, isRager, resolveRagerCombatAbility,
  resolveRagerPhysicalAttack, resolveRagerPhysicalExchange, type RagerRoundPolicy } from '../../src/domain/rager/combat.js';
import { consumeSailorScales, currentSailorCombatSource, currentSailorScalesSource,
  resolveSailorCombatAbility } from '../../src/domain/sailor/combat.js';
import { applyWindBlessedEncounter } from '../../src/domain/wind-blessed/encounter.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'tyrant.s7.water-control', guard = 'NAVIGATOR_WATER_GUARD';
const bind = 'tyrant.s7.water-binding', navigation = 'tyrant.s7.navigation';
const blade = 'tyrant.s6.wind-blade', windGuard = 'tyrant.s6.wind-control';
const ids = [primary, 'NAVIGATOR_WAVE', guard, bind, navigation, 'ACCIDENT', blade, windGuard];
/** Deliberately synthetic combat fixture; a separate producer test pays for the actual visit. */
function fixture(): SliceState {
  const state = createSliceRun('wind-blessed-combat-test', sliceDefaultCreationSelection, 'wind-blessed-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'tyrant', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  state.windBlessed.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week };
  state.combat = { encounterId: 'WIND_BLESSED_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: NavigatorMoveId, policy?: RagerRoundPolicy,
  source = currentNavigatorCombatSource(state)) {
  return resolveNavigatorCombatAbility(state, id, 1, stream(state), policy, source);
}
/** Keep the production cursor semantics while specifying only this bounded round's actual draws. */
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

describe('Wind blessed S6 finite profile, preserving exact S7 defaults', () => {
  it('routes only S6 to the eight-slot wheel, retaining the S7 count wheel and daily-only flight', () => {
    const state = fixture();
    expect(isWindBlessed(state)).toBe(true); expect(isNavigator(state)).toBe(false);
    expect(hasNavigatorCombat(state)).toBe(true); expect(hasRagerWrath(state)).toBe(true);
    expect(isRager(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(NAVIGATOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([22, 28, 25, 17, 8]);
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([22, 13, 12, 10, 8, 15, 12, 8]);
    expect(ids).not.toContain('tyrant.s6.short-flight');
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(navigatorAbilityWheel(stance, 6));
      expect(navigatorAbilityWheel(stance)).toEqual(navigatorAbilityWheel(stance, 7));
    }
    expect(navigatorAbilityWheel(null).map(x => x.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0;
    playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(22);
    expect(playerCountWheel(state)[0]!.weight).toBe(22);
  });

  it('draws exact integer-ticket boundaries without extra RNG and retains the old action counts', () => {
    for (const [stance, tickets] of [
      [null, [88, 52, 48, 40, 32, 60, 48, 32]],
      ['ATTACK', [110, 65, 48, 40, 32, 60, 60, 32]],
      ['DEFEND', [88, 52, 60, 40, 32, 60, 48, 40]],
      ['CONTROL', [88, 52, 48, 50, 32, 60, 48, 32]],
      ['PREPARE', [88, 52, 48, 40, 40, 60, 48, 32]],
      ['RETREAT', [88, 52, 48, 40, 32, 60, 48, 32]],
    ] as const) {
      const total = tickets.reduce<number>((sum, weight) => sum + weight, 0);
      expect(navigatorAbilityWheel(stance, 6).map(x => x.weight))
        .toEqual(tickets.map(weight => total === 400 ? weight / 4 : weight / total * 100));
      let boundary = 0;
      for (const [index, weight] of tickets.entries()) {
        const first = boundary + 1; boundary += weight;
        const random = stream(fixture()), draws = scriptRolls(first, boundary);
        expect(drawNavigatorAbility(random, stance, 6)).toBe(ids[index]);
        expect(drawNavigatorAbility(random, stance, 6)).toBe(ids[index]);
        expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    for (const [roll, count] of [[1, 1], [22, 1], [23, 2], [50, 2], [51, 3], [75, 3], [76, 4], [92, 4], [93, 5], [100, 5]]) {
      expect(navigatorActionCount(roll!)).toBe(count);
    }
  });

  it('uses core30/25/30/15, tier450, cap90, max80 and continuing recovery8', () => {
    const state = fixture(); state.spirituality = 72;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 229, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(473);
    expect(result.round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(80);
    vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 229, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16);
  });
});

describe('Bounded wind costs and source-derived ordinary fallbacks', () => {
  it('pays3/2 for wind slots, clamps mastery, and never grants armor bypass, wrath, water, flight or free mastery', () => {
    for (const [level, bounded] of [[0, 0], [250, 250], [500, 500], [-50, 0], [900, 500], [Number.NaN, 0]]) {
      const state = fixture(), random = stream(state), policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
      state.progression.mastery[blade] = level!; state.progression.mastery[windGuard] = level!;
      state.combat!.wrathCharge = 3; state.spirituality = 5;
      const before = structuredClone(state), f = 0.65 + 0.35 * bounded! / 500;
      expect(resolveNavigatorCombatAbility(state, blade, 0, random, policy))
        .toMatchObject({ selfGain: 28 * f, enemyReduction: 0, threatens: true });
      expect(state.spirituality).toBe(2);
      expect(resolveNavigatorCombatAbility(state, windGuard, 0, random, policy))
        .toMatchObject({ selfGain: 0, enemyReduction: 14 * f, threatens: false });
      expect(state.spirituality).toBe(0); expect(random.cursor).toBe(0); expect(policy.released).toBe(false);
      expect(state.combat).toEqual(before.combat); expect(state.windBlessed).toEqual(before.windBlessed);
      expect(state.progression).toEqual(before.progression); expect(state.health).toBe(100);
    }
  });

  it('uses the same ordinary guard slot at insufficient resources without debt or redraw', () => {
    for (const [id, cost] of [[blade, 3], [windGuard, 2]] as const) {
      const state = fixture(); state.spirituality = cost - 1;
      const before = structuredClone(state), random = stream(state);
      const effect = resolveNavigatorCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(effect.label).toContain('普通格挡'); expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('derives every source detail from the actual new scene, independent of the old carrier', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentWindBlessedCombatSource(state)).toMatchObject({ encounterId: 'WIND_BLESSED_DISPUTE',
      target: 'RUEN_SINGLE_ORDINARY_ADULT', weapon: 'RUENS_ORDINARY_SHORT_CLUB',
      space: 'ORIGINAL_REPAIR_YARD_OUTER_COURTYARD', lighting: 'ORIGINAL_FIXED_LAMPLIGHT',
      distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE', pursuit: false });
    expect(currentNavigatorCombatSource(state)).toMatchObject({ needsBreath: true, canWrap: true, targetWill: 14 });
    expect(currentSailorScalesSource(state)).toEqual(currentRagerCombatSource(state));
    expect(currentSailorCombatSource(state)).toBeNull();
    expect(resolve(state, blade).selfGain).toBe(28 * 0.65);
  });

  it('rejects all stale or forged source fields without spending resources or establishing inherited effects', () => {
    const source = currentNavigatorCombatSource(fixture())!;
    for (const key of Object.keys(source)) {
      const state = fixture(), random = stream(state);
      const forged = { ...source, [key]: 'FORGED' } as unknown as NavigatorCombatSource;
      const before = structuredClone(state);
      expect(resolveNavigatorCombatAbility(state, blade, 1, random, undefined, forged))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(resolveNavigatorCombatAbility(state, bind, 1, random, undefined, forged).enemyReduction).toBe(0);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), old = currentNavigatorCombatSource(state)!; state.revision += 1;
    expect(resolve(state, windGuard, undefined, old).enemyReduction).toBe(10);
    expect(resolve(state, windGuard).enemyReduction).toBe(14 * 0.65);
  });

  it('rejects a missing visit, invalid round chain, open contact, platform position and wrong city before engine RNG', () => {
    for (const mutate of [
      (s: SliceState) => { s.windBlessed.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.windBlessed.encounter.attemptWeek = s.week - 1; },
      (s: SliceState) => { s.windBlessed.encounter.startHistoryIndex = null; },
      (s: SliceState) => { s.windBlessed.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.windBlessed.flight.position = 'LOW_PLATFORM'; },
      (s: SliceState) => { s.windBlessed.cases['crosswind-screen']!.contactOpen = true; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state);
      expect(currentWindBlessedCombatSource(state)).toBeNull(); expect(currentNavigatorCombatSource(state)).toBeNull();
      expect(currentRagerCombatSource(state)).toBeNull(); expect(currentSailorScalesSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow('来源无效'); expect(state).toEqual(before);
    }
  });

  it('leaves terminal, missing and wrong-sequence battles untouched without phantom wind effects', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; },
      (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentWindBlessedCombatSource(state)).toBeNull();
      for (const id of [blade, windGuard] as const) expect(resolveNavigatorCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not borrow first-case geometry for S6, while exact S7 first-case behavior remains intact', () => {
    const state = fixture(); state.arc.stage = 'COMBAT'; state.combat!.encounterId = 'FIRST_CASE';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    expect(currentNavigatorCombatSource(state)).toBeNull(); expect(currentRagerCombatSource(state)).toBeNull();
    expect(resolve(state, blade).enemyReduction).toBe(10); expect(state.spirituality).toBe(80);
    expect(resolve(state, primary).selfGain).toBe(0); expect(state.combat!.navigatorWater).toBeUndefined();
    state.progression.sequence = 7; state.spirituality = 59;
    expect(currentNavigatorCombatSource(state)).toMatchObject({ encounterId: 'FIRST_CASE', space: 'DRY_GROUND_PASSAGE' });
    expect(isNavigator(state)).toBe(true); expect(isWindBlessed(state)).toBe(false);
    expect(resolve(state, blade)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(resolve(state, primary).selfGain).toBe(38.025 * 0.65);
    expect(state.spirituality).toBe(59);
    delete state.combat!.navigatorWater;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(470.5);
    expect(state.spirituality).toBe(60);
  });
});

describe('Inherited water, wrath, scales and shared engine consequences', () => {
  it('retains actual water contest and once-only scales without invoking lower-sequence resolvers', () => {
    const state = fixture(), random = stream(state);
    expect(resolveRagerCombatAbility(state, 'tyrant.s8.fury', 1, random).selfGain).toBe(0);
    expect(resolveSailorCombatAbility(state, 'tyrant.s9.physique', 1, random).selfGain).toBe(0);
    resolve(state, bind); scriptRolls(1);
    expect(resolveNavigatorCombatAbility(state, bind, 1, random).label).toContain('目标抵抗失败');
    expect(consumeNavigatorWater(state, 'STRIKE', 16, 0)).toMatchObject({ suppressed: true, contributionMultiplier: 1 });
    vi.restoreAllMocks(); resolve(state, guard);
    expect(consumeSailorScales(state, 'MISS')).toBeNull();
    expect(consumeSailorScales(state, 'STRIKE')?.physicalMultiplier).toBe(0.75);
    expect(consumeSailorScales(state, 'STRIKE')).toBeNull();
  });

  it('releases wrath once only on the actual held original club, never on wind or water', () => {
    const state = fixture(); state.combat!.wrathCharge = 3;
    const policy: RagerRoundPolicy = { policy: 'RELEASE_FIRST', released: false };
    for (const id of [blade, windGuard, primary, 'NAVIGATOR_WAVE'] as const) resolve(state, id, policy);
    expect(state.combat!.wrathCharge).toBe(3); expect(policy.released).toBe(false);
    expect(resolveRagerPhysicalAttack(state, blade, 28, policy)).toEqual({ selfGain: 28, label: '' });
    state.town.clubLocation = 'HAND';
    expect(resolve(state, primary, policy).selfGain).toBe(16 * 1.4);
    expect(state.combat!.wrathCharge).toBe(1); expect(policy.released).toBe(true);
    resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', 16);
    resolveRagerPhysicalExchange(state, 'ENEMY', 'STRIKE', 16);
    expect(resolve(state, primary, policy).selfGain).toBe(16); expect(state.combat!.wrathCharge).toBe(3);
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
  });

  it('the real engine consumes inherited water and scales once on the original enemy strike and adds wrath', () => {
    const state = fixture(); state.combat!.navigatorWater = { soakedRemaining: 2, bound: true, skipNext: false };
    scriptRolls(1, 1, 141, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect(outcome).toBe('CONTINUE'); expect(round.moves).toHaveLength(2);
    expect(round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 9, enemyReduction: 0 });
    expect(round.moves[1]!.label).toContain('幻鳞防护已消耗'); expect(round.moves[1]!.label).toContain('水缚已消耗');
    expect(state.combat!.wrathCharge).toBe(1); expect(state.combat!.sailorScalesReady).toBeUndefined();
    expect(state.combat!.navigatorWater).toEqual({ soakedRemaining: 1, bound: false, skipNext: false });
    state.combatHistory.push(structuredClone(round));
    expect(currentWindBlessedCombatSource(state)?.round).toBe(2);
  });

  it('the paid wind guard cannot prevent real injury, and continuing recovery occurs after its cost', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(1, 1, 389, 1, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'DEFEND');
    expect(outcome).toBe('CONTINUE'); expect(round.moves[0]!.enemyReduction).toBe(14 * 0.65);
    expect(round.moves[1]!.selfGain).toBe(16); expect(state.health).toBe(90);
    expect(state.spirituality).toBe(16); expect(state.injuries).toHaveLength(1);
    expect(state.windBlessed.flight.position).toBe('GROUND');
  });

  it('a paid wind blade uses the same real heavy/death consequence and ordinary retreat never flies', () => {
    for (const [consequenceRoll, outcome] of [[70, 'ENEMY_SURRENDERED'], [100, 'ENEMY_DEAD']] as const) {
      const state = fixture(); state.combat!.wrathCharge = 3;
      scriptRolls(1, 1, 356, 400, 1, consequenceRoll);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome); expect(state.spirituality).toBe(77);
      expect(result.round.moves[0]!.selfGain).toBe(28 * 0.65);
      expect(result.round.consequence).toContain('鲁恩'); expect(state.combat!.wrathCharge).toBeUndefined();
      expect(state.windBlessed.flight.position).toBe('GROUND'); vi.restoreAllMocks();
    }
    const retreat = fixture(); retreat.spirituality = 12; scriptRolls(1, 100, 1);
    const result = resolveSliceCombatRound(retreat, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toHaveLength(0);
    expect(result.round.consequence).toContain('普通出口'); expect(result.round.consequence).toContain('没有使用飞行');
    expect(retreat.spirituality).toBe(12); expect(retreat.health).toBe(100);
  });

  it('the actual encounter producer supplies its paid current visit to the combat engine', () => {
    const state = fixture(); state.combat = null;
    state.windBlessed.encounter = { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null };
    state.windBlessed.cases['crosswind-screen']!.status = 'RESOLVED';
    const before = state.actionsRemaining;
    const ctx: SeerContext = { note: vi.fn(), roll: () => { throw new Error('Unexpected draw'); },
      check: () => { throw new Error('Fighting does not roll a conversation check'); } };
    applyWindBlessedEncounter(state, { type: 'ENCOUNTER_FIGHT' }, ctx);
    expect(state.actionsRemaining).toBe(before - 1); expect(currentWindBlessedCombatSource(state)).not.toBeNull();
    scriptRolls(1, 1, 229, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves[0]!.label).toContain('判断现场条件');
  });
});
