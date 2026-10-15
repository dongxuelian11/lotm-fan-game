import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { MARAUDER_COUNT_WHEEL, currentMarauderCombatSource, drawMarauderAbility, isMarauder,
  marauderAbilityWheel, marauderActionCount, resolveMarauderCombatAbility,
  type MarauderCombatSource, type MarauderMoveId,
} from '../../src/domain/marauder/combat.js';
import * as marauderCombat from '../../src/domain/marauder/combat.js';
import { APPRENTICE_COUNT_WHEEL, apprenticeAbilityWheel } from '../../src/domain/apprentice/combat.js';
import { CORPSECOLLECTOR_COUNT_WHEEL, corpsecollectorAbilityWheel } from '../../src/domain/corpsecollector/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const agility = 'error.s9.agility', dexterity = 'error.s9.dexterity', theft = 'error.s9.theft';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', 'COVER', 'SITE_PRESSURE', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('marauder-combat-test', sliceDefaultCreationSelection, 'marauder-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'error', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: MarauderMoveId, physical = 1) {
  return resolveMarauderCombatAbility(state, id, physical, stream(state));
}
/** Advance the original cursor while selecting exact shared-wheel tickets. */
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

describe('Marauder S9 Error V1 profile and public routing', () => {
  it('exposes the exact six-slot and five-count distributions without mutable aliases', () => {
    const state = fixture();
    expect(isMarauder(state)).toBe(true);
    expect(marauderAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(marauderAbilityWheel(null).map(entry => entry.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    expect(playerAbilityWheel(state, null)).toEqual(marauderAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(MARAUDER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    expect(MARAUDER_COUNT_WHEEL.reduce((sum, entry) => sum + Number(entry.id) * entry.weight, 0) / 100).toBe(3.05);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(32);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it('preserves both endpoints of every count interval', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3], [61, 4], [85, 4], [86, 5], [100, 5]]) {
      expect(marauderActionCount(roll!)).toBe(count);
    }
  });

  it('draws exact neutral and x1.25 stance tickets with one draw per action', () => {
    for (const [stance, weights] of [
      [null, [128, 72, 48, 40, 32, 80]],
      ['ATTACK', [160, 90, 48, 40, 32, 80]],
      ['DEFEND', [128, 72, 60, 40, 32, 80]],
      ['CONTROL', [128, 72, 48, 50, 32, 80]],
      ['PREPARE', [128, 72, 48, 40, 40, 80]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(marauderAbilityWheel(stance).map(entry => entry.weight)).toEqual(
        weights.map(value => total === 400 ? value / 4 : value / total * 100),
      );
      let boundary = 0;
      for (const [index, weight] of weights.entries()) {
        const first = boundary + 1; boundary += weight;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawMarauderAbility(random, stance)).toBe(ids[index]);
        expect(drawMarauderAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
    }
    expect(marauderAbilityWheel('RETREAT')).toEqual(marauderAbilityWheel(null));
  });

  it('uses base200, core25/35/20/20, cap40, spirituality30 and original combined penalties', () => {
    const state = fixture(); state.spirituality = 29;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 339, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(223.5); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(30);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(6);
  });

  it('retains the S9 advantage floor at20 when accumulated contribution drops below it', () => {
    vi.spyOn(marauderCombat, 'resolveMarauderCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 1, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('keeps unimplemented Error levels ordinary and retains neighboring profiles', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null],  ['error', 1], ['error', 0], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isMarauder(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'door'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(APPRENTICE_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(apprenticeAbilityWheel('DEFEND'));
    state.progression.pathwayId = 'death';
    expect(playerCountWheel(state)).toEqual(CORPSECOLLECTOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(corpsecollectorAbilityWheel('DEFEND'));
  });
});

describe('real physical budgets with no imaginary combat theft', () => {
  it('uses unrounded7.8f/4.2f/3.9f/2.1f at all existing mastery nodes without costs', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture();
      state.progression.mastery = { [agility]: mastery, [dexterity]: mastery, [theft]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state);
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(7.8 * factor);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(4.2 * factor);
      expect(resolve(state, 'COVER')).toMatchObject({ selfGain: 0, enemyReduction: 3.9 * factor, threatens: false });
      expect(resolve(state, 'SITE_PRESSURE')).toMatchObject({ selfGain: 0, enemyReduction: 2.1 * factor, threatens: false });
      expect(state).toEqual(before);
    }
  });

  it('binds each physical ability to its actual mastery and never to theft mastery', () => {
    const state = fixture(); state.progression.mastery[agility] = 500;
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(7.8);
    expect(resolve(state, 'COVER').enemyReduction).toBe(3.9);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(4.2 * 0.65);
    expect(resolve(state, 'SITE_PRESSURE').enemyReduction).toBe(2.1 * 0.65);
    state.progression.mastery[agility] = 0; state.progression.mastery[dexterity] = 500;
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(7.8 * 0.65);
    expect(resolve(state, 'COVER').enemyReduction).toBe(3.9 * 0.65);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(4.2);
    expect(resolve(state, 'SITE_PRESSURE').enemyReduction).toBe(2.1);
    const effects = ids.map(id => resolve(state, id));
    state.progression.mastery[theft] = 500;
    expect(ids.map(id => resolve(state, id))).toEqual(effects);
  });

  it('clamps mastery and physical state and never grants a zero-damage threat', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery = { [agility]: mastery, [dexterity]: mastery };
      const factor = mastery === 800 ? 1 : 0.65;
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(7.8 * factor);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(4.2 * factor);
    }
    state.progression.mastery = { [agility]: 500, [dexterity]: 500 };
    for (const id of ['BODY_STRIKE', 'BODY_FOLLOWUP'] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(resolve(state, id, 3).selfGain).toBe(id === 'BODY_STRIKE' ? 7.8 : 4.2);
      expect(resolve(state, id, 0.8).selfGain).toBe((id === 'BODY_STRIKE' ? 7.8 : 4.2) * 0.8);
    }
  });

  it('uses only a currently held club16 replacement, with no doubled weapon contribution', () => {
    const state = fixture(); state.progression.mastery = { [agility]: 500, [dexterity]: 500 };
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      expect(resolve(state, 'BODY_STRIKE', 0.8).selfGain).toBe((location === 'HAND' ? 16 : 7.8) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(4.2 * 0.8);
      if (location === 'HAND') {
        expect(resolve(state, 'BODY_STRIKE').label).toContain('替换而不叠加主攻预算');
        expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
      }
    }
  });

  it('keeps physical actions available at low resources without spending or stealing anything', () => {
    const state = fixture(); state.health = 10; state.mind = 0; state.spirituality = 0;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    state.injuryRisk = 3; state.combat!.enemyMind = 15;
    state.progression.mastery = { [agility]: 500, [dexterity]: 500, [theft]: 500 };
    const before = structuredClone(state);
    expect(resolve(state, 'BODY_STRIKE', 0.8).selfGain).toBe(7.8 * 0.8);
    expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(4.2 * 0.8);
    expect(resolve(state, 'COVER').enemyReduction).toBe(3.9);
    const pressure = resolve(state, 'SITE_PRESSURE');
    expect(pressure).toMatchObject({ selfGain: 0, enemyReduction: 2.1, threatens: false });
    expect(pressure.label).toContain('本场没有已登记的可窃取实物');
    expect(pressure.label).toContain('没有发生窃取');
    expect(resolve(state, 'COVER').label).toContain('不保证免伤');
    expect(state).toEqual(before);
  });

  it('prepares at R0 and draws exact ±5 accidents without injury permission', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    const observe = resolveMarauderCombatAbility(state, 'OBSERVE', 1, random);
    expect(observe).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(observe.label).toContain('眼前动作空当'); expect(random.cursor).toBe(0);
    const draws = scriptRolls(1, 2);
    expect(resolveMarauderCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -5, enemyReduction: 0, threatens: false });
    expect(resolveMarauderCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 5, enemyReduction: 0, threatens: false });
    expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); expect(state).toEqual(before);
  });

  it('does not infer stealable items or hidden knowledge from narrative, old records or high-sequence mastery', () => {
    const state = fixture(), beforeEffects = ids.map(id => resolve(state, id));
    state.progression.mastery['error.s7.ability-theft'] = 500;
    state.progression.mastery['ordinary.weapon'] = 500;
    state.knowledge.push({ id: 'old-item', week: 1, title: '旧物记录', text: 'HIDDEN_OLD_ITEM' });
    state.world.bellHolder = 'CARRIER'; state.world.bellAtScene = true;
    state.world.bellFactKnown = false; state.world.transferKnown = false;
    const before = structuredClone(state);
    expect(ids.map(id => resolve(state, id))).toEqual(beforeEffects);
    expect(currentMarauderCombatSource(state)!.stealableItem).toBe('NONE');
    expect(state).toEqual(before);
  });
});

describe('source-bound first-case actions', () => {
  it('authors only the current ordinary carrier, passage, no theft target and ordinary exit', () => {
    const state = fixture();
    expect(currentMarauderCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
      stealableItem: 'NONE', exit: 'EXISTING_ORDINARY_GROUND_EXIT' });
    expect(marauderAbilityWheel(null)[3]!.label).toContain('无可窃取物');
  });

  it('rejects stale or forged sources before effects and without echoing private fabricated data', () => {
    const state = fixture(), source = currentMarauderCombatSource(state)!;
    const tampered = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' }, { ...source, target: 'HIDDEN_TARGET' },
      { ...source, nature: 'SPIRIT' }, { ...source, body: 'UNREACHABLE_BODY' },
      { ...source, space: 'PAST_MARKET' }, { ...source, stealableItem: 'INVENTED_BELL' },
      { ...source, exit: 'INVENTED_ESCAPE' },
    ] as unknown as MarauderCombatSource[];
    for (const input of [null, ...tampered]) {
      const before = structuredClone(state), random = stream(state);
      for (const id of ids) {
        const effect = resolveMarauderCombatAbility(state, id, 1, random, input);
        expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(effect.label).not.toMatch(/HIDDEN_TARGET|INVENTED_BELL|INVENTED_ESCAPE/);
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('invalidates sources after location, lifecycle, sequence, encounter or round changes', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.status = 'DEAD'; }, state => { state.health = 0; },
      state => { state.arc.stage = 'C'; }, state => { state.world.city = 'ELSEWHERE'; },
      state => { state.world.carrierAlive = false; }, state => { state.world.carrierCanResist = false; },
      state => { state.combat!.enemyHealth = 0; }, state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.encounterId = 'CLOWN_RESCUE'; }, state => { state.combat = null; },
      state => { state.progression.sequence = 8; }, state => { state.progression.pathwayId = 'death'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), source = currentMarauderCombatSource(state)!;
      mutate(state); const before = structuredClone(state);
      expect(currentMarauderCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveMarauderCombatAbility(state, id, 1, stream(state), source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before);
    }
    const state = fixture(), source = currentMarauderCombatSource(state)!;
    state.combat!.round += 1;
    expect(resolveMarauderCombatAbility(state, 'BODY_STRIKE', 1, stream(state), source).selfGain).toBe(0);
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(7.8 * 0.65);
  });
});

describe('shared enemy, injury, retreat and deterministic replay', () => {
  it('preserves every ordinary enemy action after either evasion or ordinary pressure', () => {
    for (const slot of [251, 299]) {
      for (const [roll, label, selfGain, enemyReduction] of [
        [1, '短棍打击', 16, 0], [161, '格挡护身', 0, 10], [241, '寻找空当', 8, 0],
        [321, '拉开距离', 0, 8], [381, '动作落空', 0, 0],
      ] as const) {
        const state = fixture(); state.progression.mastery = { [agility]: 500, [dexterity]: 500 };
        scriptRolls(1, 1, slot, roll, 1);
        const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
        expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: slot === 251 ? 3.9 : 2.1 });
        expect(round.moves[1]).toEqual({ actor: 'ENEMY', label, selfGain, enemyReduction });
        expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
        expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
        vi.restoreAllMocks();
      }
    }
  });

  it('keeps counts independent, interleaves actual actors and grants only ordinary round recovery', () => {
    const state = fixture(); state.spirituality = 0; const before = structuredClone(state);
    const draws = scriptRolls(1, 100, 299, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'ENEMY', 'ENEMY']);
    expect(round.moves.slice(1).every(move => move.label === '短棍打击' && move.selfGain === 16)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(3); expect(state.week).toBe(before.week);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
    expect(state.town).toEqual(before.town); expect(state.knowledge).toEqual(before.knowledge);
    expect(draws).toHaveBeenCalledTimes(7); expect(state.random.cursor).toBe(before.random.cursor + 7);
    expect(state.combat!.lastRound).toEqual(round); expect(state.lastCombatRound).toEqual(round);
    vi.restoreAllMocks();
    state.combat!.round = 2;
    scriptRolls(100, 46, 400, 339, 400, 339, 339, 339, 339, 1);
    const second = resolveSliceCombatRound(state, 'ATTACK').round;
    expect(second.first).toBe('ENEMY'); expect(second.playerCount).toBe(5); expect(second.enemyCount).toBe(2);
    expect(second.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER', 'PLAYER']);
    expect(second.moves.every(move => move.selfGain === 0 && move.enemyReduction === 0)).toBe(true);
    expect(second.playerAdvantage).toBeCloseTo(215 * 0.8);
  });

  it('applies the shared health bands to real attacks without adding a physical resource fee', () => {
    for (const [health, physical] of [[100, 1], [75, 0.95], [50, 0.9], [25, 0.8]]) {
      const state = fixture(); state.health = health!; state.spirituality = 0;
      state.progression.mastery[agility] = 500;
      scriptRolls(1, 1, 1, 400, 1, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(7.8 * physical!);
      expect(state.spirituality).toBe(3); expect(outcome).toBe('CONTINUE');
      vi.restoreAllMocks();
    }
  });

  it('does not permit injury from evasion, pressure, observation or positive accidents while armed', () => {
    for (const slot of [251, 299, 339, 371]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 371 ? scriptRolls(1, 1, slot, 2, 400, 1) : scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 371 ? 5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(slot === 371 ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('retains actual attack injury/surrender and final player death after an ordinary club attack', () => {
    for (const slot of [1, 161]) {
      const attacking = fixture(); scriptRolls(1, 1, slot, 400, 1, 66);
      const attack = resolveSliceCombatRound(attacking, 'ATTACK');
      expect(attack.outcome).toBe('ENEMY_SURRENDERED');
      expect(attacking.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(attacking.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      vi.restoreAllMocks();
    }
    const dying = fixture(); dying.health = 40; dying.spirituality = 5; dying.injuryRisk = 1;
    dying.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 251, 1, 1_000_000, 96);
    const death = resolveSliceCombatRound(dying, 'ATTACK');
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dying.health).toBe(0);
    expect(death.round.moves[1]!.selfGain).toBe(16);
    expect(dying.spirituality).toBe(5); expect(dying.injuryRisk).toBe(2);
    expect(death.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(death.round.consequence).toContain('最终死亡');
  });

  it('uses the unchanged50% ordinary retreat without stealing distance or gaining extra escape actions', () => {
    const state = fixture(); state.spirituality = 10; state.progression.mastery[agility] = 500;
    const draws = scriptRolls(100, 100, 50);
    const retreat = resolveSliceCombatRound(state, 'RETREAT');
    expect(retreat.outcome).toBe('RETREATED'); expect(retreat.round.moves).toEqual([]);
    expect(retreat.round.playerCount).toBe(5); expect(retreat.round.enemyCount).toBe(3);
    expect(retreat.round.consequence).toContain('携铃者'); expect(state.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const blocked = fixture(); scriptRolls(1, 1, 51, 400, 1);
    const failed = resolveSliceCombatRound(blocked, 'RETREAT');
    expect(failed.outcome).toBe('CONTINUE'); expect(failed.round.retreat).toBe('FAILURE');
    expect(failed.round.moves).toEqual([{ actor: 'ENEMY', label: '动作落空', selfGain: 0, enemyReduction: 0 }]);
  });

  it('replays exact JSON state, round history and random cursor without Math.random', () => {
    const state = fixture(); state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
  });
});
