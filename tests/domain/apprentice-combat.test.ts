import { WANDERER_COUNT_WHEEL, wandererAbilityWheel } from '../../src/domain/wanderer/combat.js';
import { PLANESWALKER_COUNT_WHEEL, planeswalkerAbilityWheel } from '../../src/domain/planeswalker/combat.js';
import { TRAVELER_COUNT_WHEEL, travelerAbilityWheel } from '../../src/domain/traveler/combat.js';
import { SECRETS_SORCERER_COUNT_WHEEL, secretsSorcererAbilityWheel } from '../../src/domain/secrets-sorcerer/combat.js';
import { ASTROLOGER_COUNT_WHEEL, astrologerAbilityWheel } from '../../src/domain/astrologer/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { APPRENTICE_COUNT_WHEEL, apprenticeAbilityWheel, apprenticeActionCount,
  currentApprenticeCombatSource, drawApprenticeAbility, isApprentice,
  resolveApprenticeCombatAbility, type ApprenticeCombatSource, type ApprenticeMoveId,
} from '../../src/domain/apprentice/combat.js';
import { CORPSECOLLECTOR_COUNT_WHEEL, corpsecollectorAbilityWheel } from '../../src/domain/corpsecollector/combat.js';
import { BARD_COUNT_WHEEL, bardAbilityWheel } from '../../src/domain/bard/combat.js';
import { SAILOR_COUNT_WHEEL, sailorAbilityWheel } from '../../src/domain/sailor/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const opening = 'door.s9.door-opening';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', 'COVER', 'SITE_PRESSURE', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('apprentice-combat-test', sliceDefaultCreationSelection, 'apprentice-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'door', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 30;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: ApprenticeMoveId, physical = 1) {
  return resolveApprenticeCombatAbility(state, id, physical, stream(state));
}
/** Advance the actual random cursor while selecting exact shared-wheel tickets. */
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

describe('Apprentice S9 Door V1 profile', () => {
  it('uses the exact six slots and the independent five-count distribution', () => {
    const state = fixture();
    expect(isApprentice(state)).toBe(true);
    expect(apprenticeAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(apprenticeAbilityWheel(null).map(entry => entry.weight)).toEqual([24, 14, 12, 8, 10, 32]);
    expect(playerAbilityWheel(state, null)).toEqual(apprenticeAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(APPRENTICE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    expect(APPRENTICE_COUNT_WHEEL.reduce((sum, entry) => sum + Number(entry.id) * entry.weight, 0) / 100).toBe(3.05);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(24);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it('preserves both ends of every action-count interval', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3], [61, 4], [85, 4], [86, 5], [100, 5]]) {
      expect(apprenticeActionCount(roll!)).toBe(count);
    }
  });

  it('draws exact neutral and stance ticket boundaries, with one draw per slot', () => {
    for (const [stance, weights] of [
      [null, [96, 56, 48, 32, 40, 128]],
      ['ATTACK', [120, 70, 48, 32, 40, 128]],
      ['DEFEND', [96, 56, 60, 32, 40, 128]],
      ['CONTROL', [96, 56, 48, 40, 40, 128]],
      ['PREPARE', [96, 56, 48, 32, 50, 128]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(apprenticeAbilityWheel(stance).map(entry => entry.weight)).toEqual(
        weights.map(value => total === 400 ? value / 4 : value / total * 100),
      );
      let boundary = 0;
      for (const [index, weight] of weights.entries()) {
        const first = boundary + 1; boundary += weight;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawApprenticeAbility(random, stance)).toBe(ids[index]);
        expect(drawApprenticeAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    expect(apprenticeAbilityWheel('RETREAT')).toEqual(apprenticeAbilityWheel(null));
  });

  it('uses base200, core20/40/20/20, cap40 and spirituality30 with shared penalties', () => {
    const state = fixture(); state.spirituality = 29;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 271, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(224); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(30);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 271, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(6);
  });

  it('routes no other sequence into Apprentice and leaves old profiles unchanged', () => {
    const state = fixture();
    // Former future sequences now use their own current profiles, never this old profile.
    state.progression.pathwayId='door';state.progression.sequence=6;expect(isApprentice(state)).toBe(false);expect(playerCountWheel(state)).toEqual(ASTROLOGER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(astrologerAbilityWheel('CONTROL',6));
    state.progression.pathwayId='door';state.progression.sequence=3;expect(isApprentice(state)).toBe(false);expect(playerCountWheel(state)).toEqual(WANDERER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(wandererAbilityWheel(state,'CONTROL'));
    state.progression.sequence=2;expect(isApprentice(state)).toBe(false);expect(playerCountWheel(state)).toEqual(PLANESWALKER_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(planeswalkerAbilityWheel(state,'CONTROL'));
    for (const [pathwayId, sequence] of [[null, null], ['door', 1], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isApprentice(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'death'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(CORPSECOLLECTOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(corpsecollectorAbilityWheel('DEFEND'));
    state.progression.pathwayId = 'sun';
    expect(playerCountWheel(state)).toEqual(BARD_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(bardAbilityWheel('DEFEND'));
    state.progression.pathwayId = 'tyrant';
    expect(playerCountWheel(state)).toEqual(SAILOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sailorAbilityWheel('CONTROL'));
  });
});

describe('actual ordinary body, current weapon and blocked door-slot fallbacks', () => {
  it('uses unrounded 6.5f/3.5f/7.8f/4.2f at all six existing mastery nodes', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[opening] = mastery;
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state);
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(6.5 * factor);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(3.5 * factor);
      expect(resolve(state, 'COVER')).toMatchObject({ selfGain: 0, enemyReduction: 7.8 * factor, threatens: false });
      expect(resolve(state, 'SITE_PRESSURE')).toMatchObject({ selfGain: 0, enemyReduction: 4.2 * factor, threatens: false });
      expect(state).toEqual(before);
    }
  });

  it('clamps mastery and physical state without creating ordinary proficiency or zero-damage threats', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[opening] = mastery;
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(6.5 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery[opening] = 500;
    for (const id of ['BODY_STRIKE', 'BODY_FOLLOWUP'] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(resolve(state, id, 3).selfGain).toBe(id === 'BODY_STRIKE' ? 6.5 : 3.5);
      expect(resolve(state, id, 0.8).selfGain).toBe((id === 'BODY_STRIKE' ? 6.5 : 3.5) * 0.8);
    }
    expect(Object.keys(state.progression.mastery)).toEqual([opening]);
  });

  it('replaces only H with the current HAND club16 and never doubles a weapon budget', () => {
    const state = fixture(); state.progression.mastery[opening] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      expect(resolve(state, 'BODY_STRIKE', 0.8).selfGain).toBe((location === 'HAND' ? 16 : 6.5) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(3.5 * 0.8);
      if (location === 'HAND') {
        expect(resolve(state, 'BODY_STRIKE').label).toContain('替换而不叠加主攻预算');
        expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
      }
    }
  });

  it('states why door protection is unavailable and creates no protection, spell, companion or resource', () => {
    const state = fixture(); state.health = 70; state.mind = 40; state.spirituality = 0;
    state.injuries = [{ id: 'old-injury', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    state.injuryRisk = 3; state.combat!.enemyMind = 15;
    state.progression.mastery[opening] = 500;
    const before = structuredClone(state), random = stream(state);
    for (const id of ['COVER', 'SITE_PRESSURE', 'OBSERVE'] as const) {
      expect(resolveApprenticeCombatAbility(state, id, 1, random).threatens).toBe(false);
    }
    expect(resolve(state, 'COVER').label).toContain('本场没有可穿过的原门或薄隔断');
    expect(resolve(state, 'COVER').label).toContain('后续短棍攻击不被无效化');
    expect(resolve(state, 'SITE_PRESSURE').label).toContain('普通控制槽减势');
    expect(resolve(state, 'OBSERVE').label).toContain('本次贡献0');
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('ignores higher-sequence, invented ordinary mastery and past passage knowledge', () => {
    const state = fixture(), beforeEffects = ids.slice(0, 5).map(id => resolve(state, id));
    state.progression.mastery['door.s8.trick'] = 500;
    state.progression.mastery['door.s6.record'] = 500;
    state.progression.mastery['ordinary.weapon'] = 500;
    state.knowledge.push({ id: 'old-door', week: 1, title: '旧现场门', text: 'HIDDEN_PAST_PASSAGE' });
    const before = structuredClone(state);
    expect(ids.slice(0, 5).map(id => resolve(state, id))).toEqual(beforeEffects);
    expect(currentApprenticeCombatSource(state)!.doorPath).toBe('NONE');
    expect(state).toEqual(before);
  });

  it('prepares at zero and draws exact ±5 accidents with no injury permission', () => {
    const state = fixture(), random = stream(state), before = structuredClone(state);
    expect(resolveApprenticeCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0);
    const draws = scriptRolls(1, 2);
    expect(resolveApprenticeCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -5, enemyReduction: 0, threatens: false });
    expect(resolveApprenticeCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 5, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); expect(state).toEqual(before);
  });
});

describe('current-source validation never manufactures a wall or a distant exit', () => {
  it('authors only the existing ordinary carrier, open passage and ordinary exit', () => {
    const state = fixture();
    expect(currentApprenticeCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
      doorPath: 'NONE', exit: 'EXISTING_ORDINARY_GROUND_EXIT', companion: 'NONE' });
    expect(apprenticeAbilityWheel(null).filter(entry => entry.id === 'COVER')).toHaveLength(1);
    expect(apprenticeAbilityWheel(null)[2]!.label).toContain('本场不能开门');
  });

  it('rejects stale and forged sources before effects or extra random draws', () => {
    const state = fixture(), source = currentApprenticeCombatSource(state)!;
    const tampered = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' }, { ...source, target: 'HIDDEN_TARGET' },
      { ...source, nature: 'SPIRIT' }, { ...source, body: 'UNREACHABLE_BODY' },
      { ...source, space: 'PAST_WORKSHOP' }, { ...source, doorPath: 'INVENTED_THIN_WALL' },
      { ...source, exit: 'DISTANT_TELEPORT' }, { ...source, companion: 'INVENTED_ALLY' },
    ] as unknown as ApprenticeCombatSource[];
    for (const input of [null, ...tampered]) {
      const before = structuredClone(state), random = stream(state);
      for (const id of ids) {
        const effect = resolveApprenticeCombatAbility(state, id, 1, random, input);
        expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(effect.label).not.toMatch(/HIDDEN_TARGET|INVENTED_ALLY|DISTANT_TELEPORT/);
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('invalidates sources after lifecycle, location, sequence or opponent changes', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.status = 'DEAD'; }, state => { state.health = 0; },
      state => { state.arc.stage = 'C'; }, state => { state.world.city = 'ELSEWHERE'; },
      state => { state.world.carrierAlive = false; }, state => { state.world.carrierCanResist = false; },
      state => { state.combat!.enemyHealth = 0; }, state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.encounterId = 'CLOWN_RESCUE'; }, state => { state.combat = null; },
      state => { state.progression.sequence = 8; }, state => { state.progression.pathwayId = 'death'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), source = currentApprenticeCombatSource(state)!;
      mutate(state); const random = stream(state), before = structuredClone(state);
      expect(currentApprenticeCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveApprenticeCombatAbility(state, id, 1, random, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), source = currentApprenticeCombatSource(state)!;
    state.combat!.round += 1;
    expect(resolveApprenticeCombatAbility(state, 'BODY_STRIKE', 1, stream(state), source).selfGain).toBe(0);
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(6.5 * 0.65);
  });
});

describe('shared ordinary enemy, consequences and deterministic replay', () => {
  it('preserves every ordinary enemy action, including club16 after the fallback B slot', () => {
    for (const [roll, label, selfGain, enemyReduction] of [
      [1, '短棍打击', 16, 0], [161, '格挡护身', 0, 10], [241, '寻找空当', 8, 0],
      [321, '拉开距离', 0, 8], [381, '动作落空', 0, 0],
    ] as const) {
      const state = fixture(); state.progression.mastery[opening] = 500;
      scriptRolls(1, 1, 191, roll, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 7.8 });
      expect(round.moves[1]).toEqual({ actor: 'ENEMY', label, selfGain, enemyReduction });
      expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
      vi.restoreAllMocks();
    }
  });

  it('keeps enemy counts, turn order, ordinary recovery and history without extra movement actions', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(1, 100, 191, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'ENEMY', 'ENEMY']);
    expect(round.moves.slice(1).every(move => move.label === '短棍打击' && move.selfGain === 16)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(13); expect(state.week).toBe(before.week);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.progression).toEqual(before.progression); expect(draws).toHaveBeenCalledTimes(7);
    expect(state.combat!.lastRound).toEqual(round); expect(state.lastCombatRound).toEqual(round);
  });

  it('does not grant injury from B, K, R0 or a positive accident while armed', () => {
    for (const slot of [191, 239, 271, 311]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 311 ? scriptRolls(1, 1, slot, 2, 400, 1) : scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 311 ? 5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(slot === 311 ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('retains H/J physical injury, surrender and final player death after an ordinary attack', () => {
    for (const slot of [1, 121]) {
      const attacking = fixture(); scriptRolls(1, 1, slot, 400, 1, 66);
      const attack = resolveSliceCombatRound(attacking, 'ATTACK');
      expect(attack.outcome).toBe('ENEMY_SURRENDERED');
      expect(attacking.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(attacking.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      vi.restoreAllMocks();
    }
    const dying = fixture(); dying.health = 40; dying.spirituality = 5; dying.injuryRisk = 1;
    dying.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 191, 1, 1_000_000, 96);
    const death = resolveSliceCombatRound(dying, 'ATTACK');
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dying.health).toBe(0);
    expect(death.round.moves[1]!.selfGain).toBe(16);
    expect(dying.spirituality).toBe(5); expect(dying.injuryRisk).toBe(2);
    expect(death.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(death.round.consequence).toContain('最终死亡');
  });

  it('takes the existing ordinary retreat without creating a portal or improving its chance', () => {
    const state = fixture(); state.spirituality = 10; state.progression.mastery[opening] = 500;
    const draws = scriptRolls(100, 100, 50);
    const retreat = resolveSliceCombatRound(state, 'RETREAT');
    expect(retreat.outcome).toBe('RETREATED'); expect(retreat.round.moves).toEqual([]);
    expect(retreat.round.playerCount).toBe(5); expect(retreat.round.enemyCount).toBe(3);
    expect(retreat.round.consequence).toContain('携铃者'); expect(state.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const blocked = fixture();
    scriptRolls(1, 1, 51, 400, 1);
    const failed = resolveSliceCombatRound(blocked, 'RETREAT');
    expect(failed.outcome).toBe('CONTINUE'); expect(failed.round.retreat).toBe('FAILURE');
    expect(failed.round.moves).toEqual([{ actor: 'ENEMY', label: '动作落空', selfGain: 0, enemyReduction: 0 }]);
  });

  it('replays exact JSON state and random cursor without Math.random', () => {
    const state = fixture(); state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
  });
});
