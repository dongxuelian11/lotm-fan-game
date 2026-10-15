import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { NIGHTMARE_COUNT_WHEEL, currentNightmareCombatSource, currentNightmareDreamSource,
  currentNightmareNightSource, currentSootherNightSource, drawNightmareAbility,
  finishNightmareCombatRound, hasNightmareCombat, isNightmare, nightmareAbilityWheel,
  nightmareActionCount, releaseNightmareDream, resolveNightmareCombatAbility,
  resolveNightmareEnemyAction, type NightmareCombatNightSource, type NightmareMoveId,
} from '../../src/domain/nightmare/combat.js';
import { MIDNIGHT_COUNT_WHEEL, midnightAbilityWheel } from '../../src/domain/midnight/combat.js';
import { SLEEPLESS_COUNT_WHEEL, sleeplessAbilityWheel } from '../../src/domain/sleepless/combat.js';
import { applySootherActivity } from '../../src/domain/soother/life.js';
import { settleSootherEncounter, SOOTHER_ENCOUNTER_STORY } from '../../src/domain/soother/encounter.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { SOOTHER_ABILITY_IDS } from '../../src/domain/soother/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

/** Combat-only fixture. The separate producer test exercises the actual paid arrival. */
function fixture(): SliceState {
  const state = createSliceRun('soother-combat-test', sliceDefaultCreationSelection, 'soother-combat');
  state.activeEvent = null;
  state.arc.stage = 'ENDED';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'darkness', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  Object.assign(state.soother.encounter, { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week, pressure: 0, dreamLocked: false });
  state.combat = { encounterId: 'SOOTHER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
/** Consume the actual stream, then pin each particular draw, with no added draws. */
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
function lifeContext(state: SliceState): SeerContext {
  return { note: vi.fn(), roll: () => { throw new Error('Unexpected extra life draw'); },
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability,
      baseAbility: state.character.coreStats[ability], difficulty, modifiers: [], roll: 1 })) };
}
function beforeVisit() {
  const state = fixture(); state.combat = null;
  state.soother.encounter = { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null,
    pressure: 0, dreamLocked: false };
  state.actionsRemaining = 5;
  const context = lifeContext(state);
  const award = vi.fn((source: string, _amount: 5 | 8 | 25) => state.seer.completedSources.push(source));
  return { state, context, award };
}
function completeOrdinaryReport(state: SliceState, context: SeerContext, award: (source: string, amount: 5 | 8 | 25) => void) {
  applySootherActivity(state, { type: 'OBSERVE', caseId: 'restless-wolf' }, context, award);
  applySootherActivity(state, { type: 'PREPARE', caseId: 'restless-wolf', method: 'ORDINARY' }, context, award);
  applySootherActivity(state, { type: 'PERFORM', caseId: 'restless-wolf' }, context, award);
  applySootherActivity(state, { type: 'CLOSE', caseId: 'restless-wolf' }, context, award);
  applySootherActivity(state, { type: 'REPORT', caseId: 'restless-wolf' }, context, award);
}
const physicalIds = ['darkness.s8.physical-training', 'darkness.s8.physical-follow-up',
  'darkness.s8.self-protection'] as const;
const moves: readonly NightmareMoveId[] = [...physicalIds, 'darkness.s7.dream-entry', 'OBSERVE', 'ACCIDENT'];
afterEach(() => vi.restoreAllMocks());

describe('Soother S6 keeps the finite inherited Nightmare wheel', () => {
  it('retains every S7 count and slot, and adds no daily spirit or S5 sealing action', () => {
    const state = fixture();
    state.progression.mastery = Object.fromEntries(SOOTHER_ABILITY_IDS.map(id => [id, 500]));
    expect(isNightmare(state)).toBe(false); expect(hasNightmareCombat(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(NIGHTMARE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(nightmareAbilityWheel(stance));
    }
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).toEqual(moves);
    expect(playerAbilityWheel(state, null).map(entry => entry.weight)).toEqual([20, 15, 20, 30, 8, 7]);
    expect(playerAbilityWheel(state, null).some(entry => /s6|s5|spirit|seal/.test(entry.id))).toBe(false);
    const wheel = playerAbilityWheel(state, null); wheel[0]!.weight = 0;
    const count = playerCountWheel(state); count[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it('preserves exact count boundaries and single-draw ability tickets', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3], [61, 4], [85, 4], [86, 5], [100, 5]]) {
      expect(nightmareActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of nightmareAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      scriptRolls(first, boundary); const random = stream(fixture());
      expect(drawNightmareAbility(random, null)).toBe(entry.id);
      expect(drawNightmareAbility(random, null)).toBe(entry.id);
      expect(random.cursor).toBe(2); vi.restoreAllMocks();
    }
  });

  it('uses core30/25/30/15, tier450, capped core90 and max80 without changing S7 budgets', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 221, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.playerAdvantage).toBe(473); expect(round.enemyAdvantage).toBe(114);
    expect(round.winChance).toBeCloseTo(473 / 587 * 100);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 221, 400, 1);
    expect(resolveSliceCombatRound(capped, 'CONTROL').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16);
  });

  it.each([[0, 8], [40, 48], [72, 80], [79, 80], [80, 80]])('recovers %s to %s on CONTINUE only', (before, after) => {
    const state = fixture(); state.spirituality = before;
    scriptRolls(1, 1, 221, 400, 1);
    expect(resolveSliceCombatRound(state, 'CONTROL').outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(after);
  });

  it('keeps ordinary bodies, held original club and costs independent of daily spirit mastery', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery = Object.fromEntries(SOOTHER_ABILITY_IDS.map(id => [id, 500]));
      state.progression.mastery['darkness.s8.physical-training'] = 250;
      const random = stream(state), before = structuredClone(state), mastery = 0.825;
      expect(resolveNightmareCombatAbility(state, physicalIds[0], 0.8, random).selfGain)
        .toBe(location === 'HAND' ? 12.8 : 20.475 * mastery * 1.1 * 0.8);
      expect(resolveNightmareCombatAbility(state, physicalIds[1], 0.8, random).selfGain).toBe(11.025 * mastery * 1.1 * 0.8);
      expect(resolveNightmareCombatAbility(state, physicalIds[2], 0.8, random).enemyReduction).toBe(29.25 * mastery * 1.1);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('the current Alan body and original night remain encounter-local', () => {
  it('uses the actual report and one-AP encounter producer, rather than manufacturing a combat source', () => {
    const { state, context, award } = beforeVisit();
    const old = structuredClone(state.nightmare);
    expect(currentSootherNightSource(state)).toBeNull();
    expect(() => applySootherActivity(state, { type: 'ENCOUNTER_FIGHT' }, context, award)).toThrow();
    expect(state.actionsRemaining).toBe(5); expect(state.combat).toBeNull();
    completeOrdinaryReport(state, context, award);
    expect(state.soother.cases['restless-wolf']).toMatchObject({ status: 'RESOLVED',
      method: 'ORDINARY', outcome: 'WOLF_OBSERVED', contactOpen: false, closes: 1 });
    expect(state.actionsRemaining).toBe(1); expect(state.spirituality).toBe(80);
    expect(state.progression.acting).toBe(25); expect(award).toHaveBeenCalledWith('soother-case:restless-wolf', 8);
    applySootherActivity(state, { type: 'ENCOUNTER_FIGHT' }, context, award);
    expect(state.actionsRemaining).toBe(0); expect(state.progression.acting).toBe(25);
    expect(state.soother.encounter).toEqual({ status: 'FIGHTING', attemptWeek: state.week,
      startHistoryIndex: 0, pressure: 0, dreamLocked: false });
    expect(currentSootherNightSource(state)).not.toBeNull();
    expect(context.check).toHaveBeenCalledTimes(1); expect(state.nightmare).toEqual(old);
    expect(SOOTHER_ENCOUNTER_STORY).toContain('成年阿兰');
    expect(SOOTHER_ENCOUNTER_STORY).toContain('不是追逐');
  });

  it('requires the actual exit from contact, a completed report, and a remaining arrival action', () => {
    const { state, context, award } = beforeVisit();
    applySootherActivity(state, { type: 'OBSERVE', caseId: 'restless-wolf' }, context, award);
    applySootherActivity(state, { type: 'PREPARE', caseId: 'restless-wolf', method: 'ORDINARY' }, context, award);
    applySootherActivity(state, { type: 'PERFORM', caseId: 'restless-wolf' }, context, award);
    for (const command of [{ type: 'ENCOUNTER_FIGHT' }, { type: 'ENCOUNTER_TALK' }] as const) {
      const before = structuredClone(state);
      expect(() => applySootherActivity(state, command, context, award)).toThrow();
      expect(state).toEqual(before);
    }
    applySootherActivity(state, { type: 'CLOSE', caseId: 'restless-wolf' }, context, award);
    expect(() => applySootherActivity(state, { type: 'ENCOUNTER_FIGHT' }, context, award)).toThrow();
    applySootherActivity(state, { type: 'REPORT', caseId: 'restless-wolf' }, context, award);
    state.actionsRemaining = 0;
    const before = structuredClone(state);
    expect(() => applySootherActivity(state, { type: 'ENCOUNTER_FIGHT' }, context, award)).toThrow();
    expect(state).toEqual(before); expect(currentSootherNightSource(state)).toBeNull();
  });

  it('exposes only Alan, the actual two-metre clear night yard and the ordinary exit', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentSootherNightSource(state)).toMatchObject({ encounterId: 'SOOTHER_DISPUTE',
      target: 'ALAN_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY',
      weapon: 'ALANS_ORDINARY_SHORT_CLUB', origin: 'OBSERVED_AWAKE_BEFORE_PULL',
      time: 'SCHEDULED_NIGHT', lighting: 'ORIGINAL_FIXED_LAMPLIGHT', distanceMetres: 2,
      ground: 'CLEAR_ORDINARY_GROUND', exit: 'ORIGINAL_OPEN_EXIT', bystander: 'NONE', pursuit: false });
    expect(currentNightmareCombatSource(state)).toEqual(currentSootherNightSource(state));
    expect(currentNightmareDreamSource(state)).toEqual(currentSootherNightSource(state));
    expect(currentNightmareNightSource(state)).toBeNull();
  });

  it('rejects stale attempts, discontinuous history, inactive or absent ordinary targets before round draws', () => {
    for (const mutate of [
      (s: SliceState) => { s.week += 1; },
      (s: SliceState) => { s.soother.encounter.status = 'RESOLVED'; },
      (s: SliceState) => { s.soother.encounter.attemptWeek = null; },
      (s: SliceState) => { s.soother.encounter.startHistoryIndex = null; },
      (s: SliceState) => { s.soother.encounter.startHistoryIndex = 1; },
      (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state);
      expect(currentSootherNightSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'CONTROL')).toThrow();
      expect(state).toEqual(before);
    }
  });

  it('validates every source field and releases only this Soother attempt without charging or checking', () => {
    const state = fixture(), source = currentSootherNightSource(state)!;
    Object.assign(state.nightmare.encounter, { pressure: 2, dreamLocked: true });
    const oldEncounter = structuredClone(state.nightmare.encounter);
    const invalid: (NightmareCombatNightSource | null)[] = [null, { ...source, round: 2 },
      { ...source, attemptWeek: state.week + 1 }, { ...source, startHistoryIndex: 100 },
      ...(['target', 'body', 'origin', 'time', 'space', 'exit', 'range', 'bystander', 'aggression',
        'weapon', 'lighting', 'distanceMetres', 'ground', 'pursuit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as NightmareCombatNightSource)];
    for (const candidate of invalid) {
      Object.assign(state.soother.encounter, { pressure: 2, dreamLocked: true });
      const random = stream(state), spirituality = state.spirituality;
      expect(resolveNightmareCombatAbility(state, 'darkness.s7.dream-entry', 1, random, candidate))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state.soother.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      expect(state.nightmare.encounter).toEqual(oldEncounter);
      expect(state.spirituality).toBe(spirituality); expect(random.cursor).toBe(0);
    }
  });

  it('does not borrow a prior S7 night, target or lock for the ordinary first case or Alan', () => {
    const old = fixture(); old.progression.sequence = 7; old.combat!.encounterId = 'NIGHTMARE_DISPUTE';
    Object.assign(old.nightmare.encounter, { status: 'FIGHTING', observed: true, bystanderCleared: true,
      attemptWeek: old.week, startHistoryIndex: 0, pressure: 2, dreamLocked: true });
    const oldSource = currentNightmareNightSource(old)!;
    for (const encounterId of ['FIRST_CASE', 'NIGHTMARE_DISPUTE', 'SOOTHER_DISPUTE'] as const) {
      const state = fixture(); state.combat!.encounterId = encounterId;
      state.nightmare.encounter = structuredClone(old.nightmare.encounter);
      const random = stream(state), previous = structuredClone(state.nightmare.encounter);
      expect(resolveNightmareCombatAbility(state, 'darkness.s7.dream-entry', 1, random, oldSource).enemyReduction).toBe(0);
      expect(state.nightmare.encounter).toEqual(previous); expect(state.spirituality).toBe(80);
      if (encounterId !== 'SOOTHER_DISPUTE') {
        expect(currentNightmareCombatSource(state)).toBeNull();
        expect(resolveNightmareCombatAbility(state, 'OBSERVE', 1, random).enemyReduction).toBe(0);
        expect(resolveNightmareCombatAbility(state, physicalIds[0], 1, random).selfGain).toBe(20.475 * 0.65);
      }
      expect(random.cursor).toBe(0);
    }
  });
});

describe('inherited gradual dream control keeps real costs and the immobile caster', () => {
  it('pays two preparation costs and one successful check, writing only the present Soother state', () => {
    const state = fixture(), old = structuredClone(state.nightmare), random = stream(state);
    for (const pressure of [0, 1]) {
      expect(resolveNightmareCombatAbility(state, 'darkness.s7.dream-entry', 1, random).enemyReduction).toBe(0);
      const result = resolveNightmareCombatAbility(state, 'OBSERVE', 1, random);
      expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(result.label).toContain('阿兰仍按原次数行动');
      expect(state.soother.encounter.pressure).toBe(pressure + 1);
    }
    expect(state.spirituality).toBe(74); expect(random.cursor).toBe(0);
    scriptRolls(1);
    expect(resolveNightmareCombatAbility(state, 'darkness.s7.dream-entry', 1, random))
      .toMatchObject({ selfGain: 0, enemyReduction: 15.75 * 0.65 * 1.1, threatens: false });
    expect(state.spirituality).toBe(70); expect(random.cursor).toBe(1);
    expect(state.soother.encounter.dreamLocked).toBe(true);
    expect(state.nightmare).toEqual(old); expect(state.combat!.enemyHealth).toBe(100);
    expect(state.combat!.enemyMind).toBe(100); expect(state.combat!.enemyStatus).toBe('RESISTING');
  });

  it('requires the original spirituality costs and clears failed pressure without replacing the move', () => {
    for (const [id, cost] of [['OBSERVE', 3], ['darkness.s7.dream-entry', 4]] as const) {
      const state = fixture(); state.spirituality = cost - 0.1; state.soother.encounter.pressure = 2;
      const before = structuredClone(state), random = stream(state);
      expect(resolveNightmareCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.soother.encounter.pressure = 2; const random = stream(state);
    scriptRolls(100);
    expect(resolveNightmareCombatAbility(state, 'darkness.s7.dream-entry', 1, random).enemyReduction).toBe(0);
    expect(state.spirituality).toBe(76);
    expect(state.soother.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    expect(random.cursor).toBe(1);
  });

  it('blocks every drawn physical slot including a held club, with no redraw or maintenance advantage', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    Object.assign(state.soother.encounter, { pressure: 2, dreamLocked: true });
    const before = structuredClone(state), random = stream(state);
    for (const id of [...physicalIds, 'OBSERVE', 'darkness.s7.dream-entry'] as const) {
      const effect = resolveNightmareCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('本体不能移动'); expect(effect.label).toContain('不重抽');
    }
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it.each([1, 100])('lets Alan resist in one original enemy slot (%s), then clears control', roll => {
    const state = fixture(); Object.assign(state.soother.encounter, { pressure: 2, dreamLocked: true });
    const old = structuredClone(state.nightmare), random = stream(state);
    scriptRolls(roll);
    const response = resolveNightmareEnemyAction(state, random, true);
    expect(response).toMatchObject({ suppressed: roll === 100, physicalMultiplier: roll === 1 ? 1.25 : 1 });
    expect(response!.label).toContain('阿兰抵抗梦境'); expect(response!.label).not.toContain('凯尔');
    expect(state.soother.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    expect(state.nightmare).toEqual(old); expect(random.cursor).toBe(1);
    expect(resolveNightmareEnemyAction(state, random, true)).toBeNull();
    expect(random.cursor).toBe(1);
  });

  it('retains enemy action counts, suppresses only one original strike, and grants no physical consequence', () => {
    const state = fixture(); state.soother.encounter.pressure = 2;
    scriptRolls(1, 46, 221, 1, 1, 100, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect([round.playerCount, round.enemyCount, round.moves.length]).toEqual([1, 2, 3]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([0, 16]);
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.enemyInjuries).toEqual([]);
    expect(state.spirituality).toBe(80); expect(state.random.cursor).toBe(8);
  });

  it('retains unlocked pressure across actual committed rounds, clearing all terminal or invalid sources', () => {
    const state = fixture(); scriptRolls(36, 46, 341, 1, 341, 1, 341, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(state.soother.encounter).toMatchObject({ pressure: 2, dreamLocked: false });
    expect(state.spirituality).toBe(79);
    expect(currentSootherNightSource(state)).toBeNull(); // The caller has not committed this round yet.
    state.combatHistory.push(structuredClone(round));
    expect(currentSootherNightSource(state)).not.toBeNull();
    finishNightmareCombatRound(state, true); expect(state.soother.encounter.pressure).toBe(2);
    state.soother.encounter.dreamLocked = true; finishNightmareCombatRound(state, true);
    expect(state.soother.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    state.soother.encounter.pressure = 2; finishNightmareCombatRound(state, false);
    expect(state.soother.encounter.pressure).toBe(0);
    state.soother.encounter.pressure = 2; state.week += 1; finishNightmareCombatRound(state, true);
    expect(state.soother.encounter.pressure).toBe(0);
  });
});

describe('ordinary endings, withdrawal and old profiles remain real', () => {
  it('releases before the real ordinary exit and grants no recovery or reward on withdrawal', () => {
    const state = fixture(); state.spirituality = 41;
    Object.assign(state.soother.encounter, { pressure: 2, dreamLocked: true });
    const old = structuredClone(state.nightmare);
    scriptRolls(1, 1, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.retreat).toBe('SUCCESS');
    expect(result.round.moves[0]!.label).toContain('先解除梦境牵制');
    expect(result.round.consequence).toContain('原夜间值班室外空院的普通出口');
    expect(result.round.consequence).toContain('阿兰'); expect(result.round.consequence).not.toContain('凯尔');
    expect(state.soother.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    expect(state.spirituality).toBe(41); expect(state.progression.acting).toBe(0);
    expect(state.nightmare).toEqual(old); expect(state.health).toBe(100);
  });

  it.each([['ENEMY_SURRENDERED', 1, 70], ['ENEMY_DEAD', 1, 100], ['PLAYER_DEAD', 1_000_000, 100]] as const)
    ('keeps actual original physical consequence %s, with no magical reward or terminal recovery', (outcome, winnerRoll, consequenceRoll) => {
      const state = fixture(); state.spirituality = 41; state.soother.encounter.pressure = 1;
      const old = structuredClone(state.nightmare);
      scriptRolls(1, 1, 1, 1, winnerRoll, consequenceRoll);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome);
      expect(result.round.consequence).not.toContain('凯尔');
      if (outcome === 'ENEMY_SURRENDERED') {
        expect(result.round.consequence).toContain('阿兰仍然活着');
        expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
        expect(state.combat!.enemyInjuries).toHaveLength(1);
      } else if (outcome === 'ENEMY_DEAD') {
        expect(state.combat).toMatchObject({ enemyHealth: 0, enemyStatus: 'DEAD' });
      } else expect(state.health).toBe(0);
      expect(state.soother.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      expect(state.spirituality).toBe(41); expect(state.progression.acting).toBe(0);
      expect(state.nightmare).toEqual(old);
    });

  it('leaves the single valid battle25 award to domain settlement and never adds acting', () => {
    const { state, context, award } = beforeVisit();
    completeOrdinaryReport(state, context, award);
    applySootherActivity(state, { type: 'ENCOUNTER_FIGHT' }, context, award);
    award.mockClear();
    scriptRolls(1, 1, 1, 1, 1, 70);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(award).not.toHaveBeenCalled();
    state.combatHistory.push(structuredClone(result.round));
    settleSootherEncounter(state, result.outcome, context, award);
    expect(state.soother.encounter).toMatchObject({ status: 'RESOLVED', pressure: 0, dreamLocked: false });
    expect(state.combat).toBeNull(); expect(state.progression.acting).toBe(25);
    expect(award).toHaveBeenCalledExactlyOnceWith('soother-dispute', 25);
    expect(() => settleSootherEncounter(state, result.outcome, context, award)).toThrow();
    expect(award).toHaveBeenCalledTimes(1);
  });

  it('settles real player death without rescue, revival, spirit reward or recovered spirituality', () => {
    const { state, context, award } = beforeVisit();
    completeOrdinaryReport(state, context, award);
    applySootherActivity(state, { type: 'ENCOUNTER_FIGHT' }, context, award);
    state.spirituality = 41; award.mockClear();
    scriptRolls(1, 1, 1, 1, 1_000_000, 100);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    state.combatHistory.push(structuredClone(result.round));
    settleSootherEncounter(state, result.outcome, context, award);
    expect(state.health).toBe(0); expect(state.spirituality).toBe(41);
    expect(state.soother.encounter).toMatchObject({ status: 'LOST', pressure: 0, dreamLocked: false });
    expect(state.combat).toBeNull(); expect(award).not.toHaveBeenCalled();
    expect(state.progression.acting).toBe(25);
  });

  it('preserves the exact old S7 core/costs and the S8, S9 and ordinary profiles', () => {
    const state = fixture(); state.progression.sequence = 7; state.combat!.encounterId = 'NIGHTMARE_DISPUTE';
    state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    Object.assign(state.nightmare.encounter, { status: 'FIGHTING', observed: true, bystanderCleared: true,
      attemptWeek: state.week, startHistoryIndex: 0, pressure: 0, dreamLocked: false });
    const soother = structuredClone(state.soother);
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(478);
    expect(state.spirituality).toBe(60); expect(state.nightmare.encounter.pressure).toBe(1);
    expect(state.soother).toEqual(soother);
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(MIDNIGHT_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(midnightAbilityWheel(null));
    state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(SLEEPLESS_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(sleeplessAbilityWheel(null));
    state.progression.pathwayId = null; state.progression.sequence = null;
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(ordinaryAbilityWheel(false, null));
  });

  it('replays the current source, pressure, costs, resistance and cursor deterministically', () => {
    for (let seed = 0; seed < 4; seed += 1) {
      const state = fixture(); state.random.seed = `soother-replay-${seed}`;
      state.soother.encounter.pressure = 2;
      const replay = structuredClone(state);
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(replay, 'CONTROL'));
      expect(state).toEqual(replay);
      releaseNightmareDream(state); expect(state.soother.encounter.pressure).toBe(0);
    }
  });
});
