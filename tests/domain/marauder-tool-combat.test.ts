import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ordinaryAbilityWheel, playerAbilityWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  currentMarauderCombatSource, marauderAbilityWheel, marauderEnemyArmed, marauderPlayerHoldsClub, marauderTheftChance,
  resolveMarauderCombatAbility, type MarauderCombatSource,
} from '../../src/domain/marauder/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('marauder-tool-combat', sliceDefaultCreationSelection, 'marauder-tool-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'error', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'C'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = false; state.world.carrierCanResist = false;
  state.marauder.dispute.stage = 'ACTIVE'; state.marauder.dispute.startHistoryIndex = 0;
  state.combat = { encounterId: 'MARAUDER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 30;
  return state;
}

function rolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'fixed-tools', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = values[cursor++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  } };
}

/** Preserve the production stream cursor while scripting complete round draws. */
function scriptRound(...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = values[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Marauder original tool source and direct physical theft', () => {
  it('binds the independent live scene without depending on first-case arc or carrier state', () => {
    const state = fixture();
    expect(currentMarauderCombatSource(state)).toMatchObject({
      encounterId: 'MARAUDER_DISPUTE', target: 'CURRENT_VISIBLE_ORDINARY_SIMON',
      nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'ORIGINAL_REPAIR_YARD',
      stealableItem: 'marauder-simon-club', exit: 'ORIGINAL_REPAIR_YARD_EXIT',
    });
    expect(marauderEnemyArmed(state)).toBe(true);
    expect(playerAbilityWheel(state, 'CONTROL')[3]!.label).toContain('窃取塞蒙手中原短棍');
    expect(playerAbilityWheel(state, 'CONTROL').map(entry => entry.weight)).toEqual(
      marauderAbilityWheel('CONTROL').map(entry => entry.weight),
    );
  });

  it('previews the exact current theft chance and failure response without spending a draw', () => {
    const state = fixture(); state.progression.mastery['error.s9.theft'] = 250;
    const before = structuredClone(state);
    expect(marauderTheftChance(state)).toBe(66);
    expect(playerAbilityWheel(state, 'CONTROL')[3]!.label).toBe(
      '窃取塞蒙手中原短棍（66% · 成功0即时贡献 · 失败下次敌打击+4仅本轮一次）',
    );
    expect(state).toEqual(before);
    expect(resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, rolls(66)).label).toContain('成功率66%');
  });

  it.each([5, 6, 66])('roll %i transfers only the same original, with no cost or immediate budget', roll => {
    const state = fixture(), originalWeapon = state.marauder.dispute.weapon;
    state.progression.mastery['error.s9.theft'] = 250;
    state.spirituality = 0;
    const before = structuredClone(state), random = rolls(roll);
    const effect = resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('原短棍转移成功');
    expect(effect.label).toContain('成功率66%'); expect(effect.label).toContain(`掷骰${roll}/100`);
    expect(effect.label).toContain(roll <= 5 ? '，大成功；' : '，成功；');
    expect(effect.label).toContain('marauder-simon-club v1→v2');
    expect(state.marauder.dispute.weapon).toBe(originalWeapon);
    before.marauder.dispute.weapon.custodian = 'PLAYER'; before.marauder.dispute.weapon.location = 'PLAYER_HAND';
    before.marauder.dispute.weapon.version = 2;
    expect(state).toEqual(before); expect(random.cursor).toBe(1);
    expect(marauderEnemyArmed(state)).toBe(false); expect(marauderPlayerHoldsClub(state)).toBe(true);
  });

  it.each([67, 95, 96, 100])('roll %i fails without changing custody, owner, version or resources', roll => {
    const state = fixture(); state.progression.mastery['error.s9.theft'] = 250;
    const before = structuredClone(state), random = rolls(roll);
    const effect = resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('成功率66%'); expect(effect.label).toContain(`掷骰${roll}/100`);
    expect(effect.label).toContain(roll >= 96 ? '，灾难；' : '，失败；');
    expect(effect.label).toContain('marauder-simon-club v1');
    before.marauder.dispute.attention += 1;
    expect(state).toEqual(before); expect(random.cursor).toBe(1); expect(marauderEnemyArmed(state)).toBe(true);
  });

  it('uses current perception and floor(theft mastery / 50), with the shared 5–95 chance limits', () => {
    for (const [perception, mastery, chance] of [[15, 49, 56], [15, 50, 58], [15, 500, 76], [0, 0, 26], [500, 500, 95]]) {
      const state = fixture(); state.character.coreStats.perception = perception!;
      state.progression.mastery['error.s9.theft'] = mastery!;
      expect(resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, rolls(6)).label).toContain(`成功率${chance}%`);
    }
  });

  it('does not reroll when the player is holding their own original club', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    state.progression.mastery['error.s9.dexterity'] = 500;
    const before = structuredClone(state), random = rolls();
    const effect = resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 2.1, threatens: false });
    expect(effect.label).toContain('自己的原短棍已占手');
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    expect(playerAbilityWheel(state, 'CONTROL')[3]!.label).toContain('当前无法窃取');
  });

  it.each([['SCENE', 'GROUND'], ['DESK', 'RETURN_DESK']] as const)(
    'uses the ordinary pressure fallback when the original is at %s/%s', (custodian, location) => {
      const state = fixture(); state.marauder.dispute.weapon.custodian = custodian;
      state.marauder.dispute.weapon.location = location;
      const before = structuredClone(state), random = rolls();
      const effect = resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 2.1 * 0.65, threatens: false });
      expect(effect.label).toContain('没有合格的可窃取物');
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(marauderEnemyArmed(state)).toBe(false);
    },
  );

  it('keeps its source valid after version changes and never duplicates an already-held original', () => {
    const state = fixture(), source = currentMarauderCombatSource(state)!;
    resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, rolls(6), source);
    const before = structuredClone(state), random = rolls();
    const repeat = resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, random, source);
    expect(repeat).toMatchObject({ selfGain: 0, enemyReduction: 2.1 * 0.65, threatens: false });
    expect(repeat.label).toContain('同一原短棍已经在你手中');
    expect(currentMarauderCombatSource(state)).toEqual(source);
    expect(resolveMarauderCombatAbility(state, 'BODY_STRIKE', 0.8, random, source)).toMatchObject({
      selfGain: 16 * 0.8, enemyReduction: 0, threatens: true,
    });
    expect(resolveMarauderCombatAbility(state, 'BODY_FOLLOWUP', 1, random, source).selfGain).toBe(4.2 * 0.65);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握塞蒙原短棍打击');
  });

  it('preserves the held original across encounters without turning first-case props into theft targets', () => {
    const state = fixture(); resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, rolls(6));
    state.marauder.dispute.stage = 'RESOLVED'; state.marauder.dispute.outcome = 'RETREATED';
    state.combat!.encounterId = 'FIRST_CASE'; state.arc.stage = 'COMBAT';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    const random = rolls();
    expect(marauderPlayerHoldsClub(state)).toBe(true); expect(marauderEnemyArmed(state)).toBe(true);
    expect(currentMarauderCombatSource(state)!.stealableItem).toBe('NONE');
    expect(resolveMarauderCombatAbility(state, 'BODY_STRIKE', 1, random).selfGain).toBe(16);
    expect(resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, random).enemyReduction).toBe(2.1 * 0.65);
    expect(random.cursor).toBe(0);
    state.town.clubLocation = 'HAND'; // Even a malformed dual-held fixture never stacks weapon contribution.
    expect(resolveMarauderCombatAbility(state, 'BODY_STRIKE', 1, random).selfGain).toBe(16);
  });

  it('rejects stale, hidden, unreachable, terminal or mismatched sources without rolls or transfer', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.status = 'DEAD'; }, state => { state.health = 0; },
      state => { state.world.city = 'ELSEWHERE'; }, state => { state.progression.sequence = 8; },
      state => { state.combat = null; }, state => { state.combat!.enemyHealth = 0; },
      state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.marauder.dispute.stage = 'UNSEEN'; },
      state => { state.marauder.dispute.stage = 'READY'; },
      state => { state.marauder.dispute.outcome = 'RETREATED'; },
      state => { state.combat!.round += 1; }, state => { state.revision += 1; },
      state => { state.combat!.encounterId = 'FIRST_CASE'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), source = currentMarauderCombatSource(state)!;
      mutate(state); const before = structuredClone(state), random = rolls();
      expect(resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, random, source)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), source = currentMarauderCombatSource(state)!;
    const hidden = { ...source, stealableItem: 'HIDDEN_INVENTORY' } as unknown as MarauderCombatSource;
    const effect = resolveMarauderCombatAbility(state, 'SITE_PRESSURE', 1, rolls(), hidden);
    expect(effect.enemyReduction).toBe(0); expect(effect.label).not.toContain('HIDDEN_INVENTORY');
  });
});

describe('Marauder tool changes in the shared interleaved combat loop', () => {
  it('disarms immediately, preserves counts, and uses the stolen original only on a later real player attack', () => {
    const state = fixture(), draws = scriptRound(16, 46, 249, 6, 1, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.playerCount).toBe(2); expect(round.enemyCount).toBe(2);
    expect(round.moves.map(move => [move.actor, move.selfGain, move.enemyReduction])).toEqual([
      ['PLAYER', 0, 0], ['ENEMY', 12, 0], ['PLAYER', 16, 0], ['ENEMY', 12, 0],
    ]);
    expect(round.moves[0]!.label).toContain('原短棍转移成功');
    expect(round.moves[1]!.label).toBe('普通打击');
    expect(round.moves[2]!.label).toContain('marauder-simon-club v2');
    expect(state.marauder.dispute.weapon).toMatchObject({ owner: '塞蒙', custodian: 'PLAYER', version: 2 });
    expect(draws).toHaveBeenCalledTimes(9); expect(state.random.cursor).toBe(9);
  });

  it('never injures or surrenders the opponent solely from successful zero-contribution theft', () => {
    const state = fixture(); scriptRound(1, 100, 249, 6, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves).toHaveLength(4);
    expect(round.moves.slice(1).map(move => move.selfGain)).toEqual([12, 12, 12]);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
  });

  it('leaves an earlier enemy strike armed on enemy-first rounds and disarms only subsequent strikes', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRound(1, 46, 1, 249, 6, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves.map(move => [move.actor, move.selfGain])).toEqual([
      ['ENEMY', 16], ['PLAYER', 0], ['ENEMY', 12],
    ]);
    expect(round.moves[0]!.label).toBe('短棍打击'); expect(round.moves[2]!.label).toBe('普通打击');
  });

  it('keeps failed-theft reaction through a block, consumes it on one actual strike, and adds no move', () => {
    const state = fixture(), draws = scriptRound(1, 100, 249, 100, 161, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves.map(move => [move.actor, move.selfGain, move.enemyReduction])).toEqual([
      ['PLAYER', 0, 0], ['ENEMY', 0, 10], ['ENEMY', 20, 0], ['ENEMY', 16, 0],
    ]);
    expect(round.moves[2]!.label).toContain('反击+4'); expect(round.moves[3]!.label).toBe('短棍打击');
    expect(state.marauder.dispute.attention).toBe(1); expect(state.marauder.dispute.weapon.version).toBe(1);
    expect(draws).toHaveBeenCalledTimes(8);
  });

  it('never stacks two pending failures and consumes the response using current weapon possession', () => {
    const state = fixture();
    scriptRound(36, 100, 249, 100, 161, 249, 100, 161, 249, 6, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(state.marauder.dispute.attention).toBe(2);
    expect(round.moves.map(move => move.selfGain)).toEqual([0, 0, 0, 0, 0, 16]);
    expect(round.moves[5]!.label).toContain('普通打击'); expect(round.moves[5]!.label).toContain('反击+4');
    expect(state.marauder.dispute.weapon.custodian).toBe('PLAYER');
  });

  it('expires unused failure response at round end instead of recreating it from accumulated attention', () => {
    const state = fixture(); scriptRound(1, 1, 249, 100, 161, 1);
    const first = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(first.consequence).toContain('反击机会已失效'); expect(state.marauder.dispute.attention).toBe(1);
    vi.restoreAllMocks(); scriptRound(1, 1, 1, 299, 1);
    const next = resolveSliceCombatRound(state, 'CONTROL').round;
    expect(next.moves[0]).toEqual({ actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 });
    expect(state.marauder.dispute.attention).toBe(1);
  });

  it('retains all ordinary enemy weights and non-strike effects after transfer', () => {
    for (const [roll, label, selfGain, enemyReduction] of [
      [161, '格挡护身', 0, 10], [241, '寻找空当', 8, 0],
      [321, '拉开距离', 0, 8], [381, '动作落空', 0, 0],
    ] as const) {
      const state = fixture(); scriptRound(1, 1, 249, 6, roll, 1);
      const { round } = resolveSliceCombatRound(state, 'CONTROL');
      expect(round.moves[1]).toEqual({ actor: 'ENEMY', label, selfGain, enemyReduction });
      expect(ordinaryAbilityWheel(marauderEnemyArmed(state), null).map(entry => entry.weight)).toEqual([40, 20, 20, 15, 5]);
      vi.restoreAllMocks();
    }
  });

  it('replays complete round state, original custody/version and failure attention deterministically', () => {
    const left = fixture(), right = structuredClone(left);
    for (let index = 0; index < 3; index += 1) {
      if (left.health <= 0 || left.combat!.enemyStatus !== 'RESISTING') break;
      expect(resolveSliceCombatRound(left, 'CONTROL')).toEqual(resolveSliceCombatRound(right, 'CONTROL'));
      expect(left).toEqual(right);
    }
  });
});
