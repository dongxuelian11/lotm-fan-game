import { THREE_HEADED_TEMPLAR_COUNT_WHEEL, threeHeadedTemplarAbilityWheel, currentThreeHeadedTemplarCombatSource } from '../../src/domain/three-headed-templar/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { SECRET_SUPPLICANT_COUNT_WHEEL, drawSecretSupplicantAbility, isSecretSupplicant,
  resolveSecretSupplicantCombatAbility, secretSupplicantAbilityWheel, secretSupplicantActionCount,
  type SecretSupplicantMoveId } from '../../src/domain/secret-supplicant/combat.js';
import * as supplicantCombat from '../../src/domain/secret-supplicant/combat.js';
import { PRYER_COUNT_WHEEL, pryerAbilityWheel } from '../../src/domain/pryer/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const sense = 'hanged-man.s9.secret-sense', lore = 'hanged-man.s9.sacrificial-lore';
const ritual = 'hanged-man.s9.ritual-practice';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', sense, 'SITE_PRESSURE', ritual, 'ACCIDENT'] as const;

/** Synthetic combat-only fixture: this does not demonstrate natural acquisition or progression. */
function fixture(): SliceState {
  const state = createSliceRun('secret-supplicant-combat-test', sliceDefaultCreationSelection, 'supplicant-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hanged-man', sequence: 9,
    mastery: { [sense]: 0, [lore]: 0, [ritual]: 0 }, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: SecretSupplicantMoveId, physical = 1) {
  return resolveSecretSupplicantCombatAbility(state, id, physical, stream(state));
}
/** Synthetic tickets retain the production cursor and fail on any extra random draw. */
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

describe('Secret Supplicant S9 synthetic profile and G budgets', () => {
  it('uses its exact six-slot/count profile without unlocking higher sequences or replacing Pryer', () => {
    const state = fixture();
    expect(isSecretSupplicant(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(secretSupplicantAbilityWheel(null, state));
    expect(secretSupplicantAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(secretSupplicantAbilityWheel(null).map(entry => entry.weight)).toEqual([25, 15, 20, 10, 25, 5]);
    expect(playerCountWheel(state)).toEqual(SECRET_SUPPLICANT_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([25, 30, 25, 15, 5]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(25);
    expect(playerCountWheel(state)[0]!.weight).toBe(25);
    for (const [pathwayId, sequence] of [[null, null], ['hanged-man', 3], ['moon', 9], ['hanged-man', 2]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isSecretSupplicant(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(sequence === 3 ? THREE_HEADED_TEMPLAR_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sequence === 3 ? threeHeadedTemplarAbilityWheel(state, 'CONTROL') : ordinaryAbilityWheel(false, 'CONTROL'));
      expect(currentThreeHeadedTemplarCombatSource(state)).toBeNull();
    }
    state.progression.pathwayId = 'hermit'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(PRYER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(pryerAbilityWheel('CONTROL', state));
  });

  it('preserves every count boundary and exact ×1.25 stance ticket with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [25, 1], [26, 2], [55, 2], [56, 3], [80, 3],
      [81, 4], [95, 4], [96, 5], [100, 5]]) expect(secretSupplicantActionCount(roll!)).toBe(count);
    for (const [stance, weights] of [
      [null, [100, 60, 80, 40, 100, 20]],
      ['ATTACK', [125, 75, 80, 40, 100, 20]],
      ['DEFEND', [100, 60, 100, 40, 100, 20]],
      ['CONTROL', [100, 60, 80, 50, 100, 20]],
      ['PREPARE', [100, 60, 80, 40, 125, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, n) => sum + n, 0);
      expect(secretSupplicantAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => total === 400 ? n / 4 : n / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawSecretSupplicantAbility(random, stance)).toBe(ids[index]);
        expect(drawSecretSupplicantAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    expect(secretSupplicantAbilityWheel('RETREAT')).toEqual(secretSupplicantAbilityWheel(null));
  });

  it('uses core10/20/35/35, tier200, cap40, floor20 and recovery3 capped at30', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0;
    scriptRolls(1, 1, 321, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(229.5 * 0.8);
    expect(state.spirituality).toBe(3); vi.restoreAllMocks();
    const impaired = fixture();
    impaired.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    impaired.health = 50; impaired.mind = 25; impaired.spirituality = 3;
    scriptRolls(1, 1, 321, 400, 1);
    expect(resolveSliceCombatRound(impaired, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(impaired.spirituality).toBe(6); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 29;
    scriptRolls(1, 1, 321, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(30); vi.restoreAllMocks();
    vi.spyOn(supplicantCombat, 'resolveSecretSupplicantCombatAbility').mockReturnValue({
      label: 'synthetic negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 321, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('keeps H12/J8.4/B10/K6 physical and R0 at every mastery with zero cost or extra draws', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 0, 100, 200, 300, 400, 500, 800]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [sense]: mastery, [lore]: mastery, [ritual]: mastery,
        'hanged-man.s8.whispers': 500, 'hanged-man.s6.flesh': 500, 'hanged-man.s5.grazing': 500 };
      const before = structuredClone(state), random = stream(state);
      for (const [id, selfGain, enemyReduction, threatens] of [
        ['BODY_STRIKE', 12 * 0.8, 0, true], ['BODY_FOLLOWUP', 8.4 * 0.8, 0, true],
        [sense, 0, 10 * 0.8, false], ['SITE_PRESSURE', 0, 6 * 0.8, false], [ritual, 0, 0, false],
      ] as const) {
        expect(resolveSecretSupplicantCombatAbility(state, id, 0.8, random))
          .toMatchObject({ selfGain, enemyReduction, threatens });
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('bounds physical factors and never charges spirituality for the ordinary fallback', () => {
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 3]) {
      for (const spirituality of [0, 0.5, 1, 30, Number.NaN, Number.POSITIVE_INFINITY]) {
        const state = fixture(); state.spirituality = spirituality;
        const before = structuredClone(state), factor = physical === 3 ? 1 : 0;
        expect(resolve(state, 'BODY_STRIKE', physical)).toMatchObject({ selfGain: 12 * factor, threatens: factor > 0 });
        expect(resolve(state, 'BODY_FOLLOWUP', physical)).toMatchObject({ selfGain: 8.4 * factor, threatens: factor > 0 });
        expect(resolve(state, sense, physical)).toMatchObject({ enemyReduction: 10 * factor, threatens: false });
        expect(resolve(state, 'SITE_PRESSURE', physical)).toMatchObject({ enemyReduction: 6 * factor, threatens: false });
        expect(resolve(state, ritual, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(state).toEqual(before);
      }
    }
  });

  it('uses only the actual Town HAND club for the16physical replacement without weapon duplication', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.spirituality = 0;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const before = structuredClone(state), random = stream(state);
      expect(resolveSecretSupplicantCombatAbility(state, 'BODY_STRIKE', 0.8, random).selfGain)
        .toBe((location === 'HAND' ? 16 : 12) * 0.8);
      expect(resolveSecretSupplicantCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random).selfGain).toBe(8.4 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '普通身体/持握工具打击');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not invent a terrifying presence, altar, revelation or prepared ritual from knowledge', () => {
    const state = fixture(); state.progression.mastery = { [sense]: 500, [lore]: 500, [ritual]: 500 };
    Object.assign(state.secretSupplicant.cases['empty-bowl']!, { status: 'PREPARED', method: 'MYSTIC', attemptWeek: state.week });
    Object.assign(state.secretSupplicant.cases['covered-token']!, { status: 'RESOLVED', outcome: 'PRESENCE_NOTED', contactOpen: false });
    state.knowledge.push({ id: 'unrelated-note', week: state.week, title: '异地旧物间记录',
      text: 'PREPARED_RITUAL TERRIFYING_PRESENCE SECRET_TRUTH FUTURE_ACTION BLACK_BLOOD GRAZED_SOUL' });
    const before = structuredClone(state), random = stream(state);
    for (let repeat = 0; repeat < 5; repeat++) {
      const block = resolveSecretSupplicantCombatAbility(state, sense, 1, random);
      expect(block).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(block.label).toContain('本场没有已登记的神秘恐怖存在');
      expect(block.label).toContain('普通格挡护身');
      const prepare = resolveSecretSupplicantCombatAbility(state, ritual, 1, random);
      expect(prepare).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(prepare.label).toContain('没有已准备并获准使用的仪式器具与对象');
      expect(prepare.label).toContain('贡献0、消耗0');
      expect(block.label + prepare.label).not.toMatch(/PREPARED_RITUAL|TERRIFYING_PRESENCE|SECRET_TRUTH|FUTURE_ACTION|BLACK_BLOOD|GRAZED_SOUL/);
    }
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('guards every slot against dead, absent, surrendered and unrelated targets before any draw', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hermit'; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveSecretSupplicantCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Secret Supplicant synthetic rounds retain ordinary consequences and replay', () => {
  it('interleaves five slots with three ordinary attacks without new costs, entities or random tickets', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 126, 1, 201, 1, 281, 321, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[12, 0], [8.4, 0], [0, 10], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(215 * 0.9 + (12 + 8.4)); expect(round.enemyAdvantage).toBe(114 + 48 - 16);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(13); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.world).toEqual(before.world); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.week).toBe(before.week); expect(state.seer.pollution).toBe(before.seer.pollution);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('never turns ordinary defense, preparation or either accident into injury or pollution', () => {
    for (const [ticket, coin] of [[201, null], [281, null], [321, null], [421, 1], [421, 2]] as const) {
      const state = fixture(); const before = structuredClone(state);
      const draws = coin === null ? scriptRolls(1, 1, ticket, 400, 1) : scriptRolls(1, 1, ticket, coin, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(coin === null ? 0 : coin === 1 ? -5 : 5);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(before.town); expect(state.mind).toBe(before.mind);
      expect(state.seer.pollution).toBe(before.seer.pollution); expect(state.progression).toEqual(before.progression);
      expect(draws).toHaveBeenCalledTimes(coin === null ? 5 : 6); vi.restoreAllMocks();
    }
  });

  it('keeps even-round enemy first and five empty ritual slots empty through the whole round', () => {
    const state = fixture(); state.combat!.round = 2;
    const draws = scriptRolls(100, 100, 400, 321, 400, 321, 400, 321, 321, 321, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.playerAdvantage).toBe(215); expect(round.enemyAdvantage).toBe(114);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
    expect(draws).toHaveBeenCalledTimes(11);
  });

  it('uses the shared injury draw for ordinary H/J surrender and actual enemy death', () => {
    for (const [ticket, consequence] of [[1, 66], [126, 66], [1, 96]] as const) {
      const state = fixture(); scriptRolls(1, 1, ticket, 400, 1, consequence);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe(consequence === 96 ? 'ENEMY_DEAD' : 'ENEMY_SURRENDERED');
      expect(round.moves).toHaveLength(2);
      expect(state.combat!.enemyHealth).toBe(consequence === 96 ? 0 : 70);
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      if (consequence === 66) {
        expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
        expect(round.consequence).toContain('携铃者仍然活着');
      }
      expect(state.spirituality).toBe(30); vi.restoreAllMocks();
    }
  });

  it('retains accumulated player death risk with no invented flesh regeneration or ritual rescue', () => {
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.town.clubLocation = 'HAND'; const before = structuredClone(state);
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 201, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.enemyReduction).toBe(9); expect(round.moves[1]!.selfGain).toBe(16);
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5);
    expect(state.town).toEqual(before.town); expect(state.seer.pollution).toBe(before.seer.pollution);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('keeps ordinary retreat success and failure with recovery only for a continuing round', () => {
    const state = fixture(); state.spirituality = 10; const town = structuredClone(state.town);
    const successDraws = scriptRolls(100, 100, 50);
    const success = resolveSliceCombatRound(state, 'RETREAT');
    expect(success.outcome).toBe('RETREATED'); expect(success.round.moves).toEqual([]);
    expect(success.round.retreat).toBe('SUCCESS'); expect(state.spirituality).toBe(10);
    expect(state.town).toEqual(town); expect(successDraws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const failed = fixture(); failed.spirituality = 10;
    const failureDraws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const failure = resolveSliceCombatRound(failed, 'RETREAT');
    expect(failure.round.retreat).toBe('FAILURE'); expect(failure.round.moves).toHaveLength(1);
    expect(failure.round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(failure.outcome).toBe('CONTINUE'); expect(failed.health).toBe(90);
    expect(failed.spirituality).toBe(13); expect(failureDraws).toHaveBeenCalledTimes(6);
  });

  it('replays serialized synthetic combat from the same seed, cursor, held item and condition', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.town.clubLocation).toBe('HAND');
  });
});
