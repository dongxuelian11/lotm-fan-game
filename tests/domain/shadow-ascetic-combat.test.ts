import { THREE_HEADED_TEMPLAR_COUNT_WHEEL, threeHeadedTemplarAbilityWheel, currentThreeHeadedTemplarCombatSource } from '../../src/domain/three-headed-templar/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { SHADOW_ASCETIC_COUNT_WHEEL, drawShadowAsceticAbility, isShadowAscetic,
  resolveShadowAsceticCombatAbility, shadowAsceticAbilityWheel, shadowAsceticActionCount,
  type ShadowAsceticMoveId } from '../../src/domain/shadow-ascetic/combat.js';
import * as shadowAsceticCombat from '../../src/domain/shadow-ascetic/combat.js';
import { LISTENER_COUNT_WHEEL, isListener, listenerAbilityWheel } from '../../src/domain/listener/combat.js';
import { SECRET_SUPPLICANT_COUNT_WHEEL, isSecretSupplicant, secretSupplicantAbilityWheel }
  from '../../src/domain/secret-supplicant/combat.js';
import { PRYER_COUNT_WHEEL, pryerAbilityWheel } from '../../src/domain/pryer/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const sense = 'hanged-man.s9.secret-sense', lore = 'hanged-man.s9.sacrificial-lore';
const ritual = 'hanged-man.s9.ritual-practice', listening = 'hanged-man.s8.whisper-listening';
const shadow = 'hanged-man.s7.shadow-concealment';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', sense, shadow, listening, 'ACCIDENT'] as const;

/** Synthetic combat-only fixture: this does not demonstrate natural acquisition or progression. */
function fixture(): SliceState {
  const state = createSliceRun('shadow-ascetic-combat-test', sliceDefaultCreationSelection, 'shadow-ascetic-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hanged-man', sequence: 7,
    mastery: { [sense]: 0, [lore]: 0, [ritual]: 0, [listening]: 0, [shadow]: 0 }, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: ShadowAsceticMoveId, physical = 1) {
  return resolveShadowAsceticCombatAbility(state, id, physical, stream(state));
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

describe('Shadow Ascetic S7 synthetic profile and G budgets', () => {
  it('uses its exact six-slot/count profile without unlocking higher sequences or replacing Pryer', () => {
    const state = fixture();
    expect(isShadowAscetic(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(shadowAsceticAbilityWheel(null, state));
    expect(shadowAsceticAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(shadowAsceticAbilityWheel(null).map(entry => entry.weight)).toEqual([25, 15, 20, 15, 20, 5]);
    expect(playerCountWheel(state)).toEqual(SHADOW_ASCETIC_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 25, 30, 20]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(25);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    for (const [pathwayId, sequence] of [[null, null], ['hanged-man', 3], ['moon', 9], ['hanged-man', 2]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isShadowAscetic(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(sequence === 3 ? THREE_HEADED_TEMPLAR_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sequence === 3 ? threeHeadedTemplarAbilityWheel(state, 'CONTROL') : ordinaryAbilityWheel(false, 'CONTROL'));
      expect(currentThreeHeadedTemplarCombatSource(state)).toBeNull();
    }
    state.progression.pathwayId = 'hanged-man'; state.progression.sequence = 8;
    expect(isShadowAscetic(state)).toBe(false); expect(isListener(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(LISTENER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(listenerAbilityWheel('CONTROL', state));
    state.progression.sequence = 9;
    expect(isShadowAscetic(state)).toBe(false); expect(isSecretSupplicant(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(SECRET_SUPPLICANT_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'PREPARE')).toEqual(secretSupplicantAbilityWheel('PREPARE', state));
    state.progression.pathwayId = 'hermit'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(PRYER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(pryerAbilityWheel('CONTROL', state));
  });

  it('preserves every count boundary and exact ×1.25 stance ticket with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3],
      [51, 4], [80, 4], [81, 5], [100, 5]]) expect(shadowAsceticActionCount(roll!)).toBe(count);
    for (const [stance, weights] of [
      [null, [100, 60, 80, 60, 80, 20]],
      ['ATTACK', [125, 75, 80, 60, 80, 20]],
      ['DEFEND', [100, 60, 100, 60, 80, 20]],
      ['CONTROL', [100, 60, 80, 75, 80, 20]],
      ['PREPARE', [100, 60, 80, 60, 100, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, n) => sum + n, 0);
      expect(shadowAsceticAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => total === 400 ? n / 4 : n / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawShadowAsceticAbility(random, stance)).toBe(ids[index]);
        expect(drawShadowAsceticAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
      expect(boundary).toBe(total);
    }
    expect(shadowAsceticAbilityWheel('RETREAT')).toEqual(shadowAsceticAbilityWheel(null));
  });

  it('uses core15/25/25/35, tier450, core cap90, floor45 and recovery6 capped at60', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0;
    scriptRolls(1, 1, 341, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(478 * 0.8);
    expect(state.spirituality).toBe(6); vi.restoreAllMocks();
    const impaired = fixture();
    impaired.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    impaired.health = 50; impaired.mind = 25; impaired.spirituality = 3;
    scriptRolls(1, 1, 341, 400, 1);
    expect(resolveSliceCombatRound(impaired, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(impaired.spirituality).toBe(9); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 59;
    scriptRolls(1, 1, 341, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(60); vi.restoreAllMocks();
    vi.spyOn(shadowAsceticCombat, 'resolveShadowAsceticCombatAbility').mockReturnValue({
      label: 'synthetic negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 341, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('keeps H12/J8.4/B10/K6 physical and R0 at every mastery with zero cost or extra draws', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 0, 100, 200, 300, 400, 500, 800]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [sense]: mastery, [lore]: mastery, [ritual]: mastery, [listening]: mastery, [shadow]: mastery,
        'hanged-man.s8.unverified-gift': 500, 'hanged-man.s6.flesh': 500, 'hanged-man.s5.grazing': 500 };
      const before = structuredClone(state), random = stream(state);
      for (const [id, selfGain, enemyReduction, threatens] of [
        ['BODY_STRIKE', 12 * 0.8, 0, true], ['BODY_FOLLOWUP', 8.4 * 0.8, 0, true],
        [sense, 0, 10 * 0.8, false], [shadow, 0, 6 * 0.8, false], [listening, 0, 0, false],
      ] as const) {
        expect(resolveShadowAsceticCombatAbility(state, id, 0.8, random))
          .toMatchObject({ selfGain, enemyReduction, threatens });
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('bounds physical factors and never turns insufficient spirituality into free listening or gifts', () => {
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 3]) {
      for (const spirituality of [0, 0.5, 1, 60, Number.NaN, Number.POSITIVE_INFINITY]) {
        const state = fixture(); state.spirituality = spirituality;
        const before = structuredClone(state), factor = physical === 3 ? 1 : 0;
        expect(resolve(state, 'BODY_STRIKE', physical)).toMatchObject({ selfGain: 12 * factor, threatens: factor > 0 });
        expect(resolve(state, 'BODY_FOLLOWUP', physical)).toMatchObject({ selfGain: 8.4 * factor, threatens: factor > 0 });
        expect(resolve(state, sense, physical)).toMatchObject({ enemyReduction: 10 * factor, threatens: false });
        expect(resolve(state, shadow, physical)).toMatchObject({ enemyReduction: 6 * factor, threatens: false });
        expect(resolve(state, listening, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(state).toEqual(before);
      }
    }
  });

  it('uses only the actual Town HAND club for the16physical replacement without weapon duplication', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.spirituality = 0;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const before = structuredClone(state), random = stream(state);
      expect(resolveShadowAsceticCombatAbility(state, 'BODY_STRIKE', 0.8, random).selfGain)
        .toBe((location === 'HAND' ? 16 : 12) * 0.8);
      expect(resolveShadowAsceticCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random).selfGain).toBe(8.4 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '普通身体/持握工具打击');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not move world contact or ritual knowledge into FIRST_CASE or invent voices and gifts', () => {
    const state = fixture(); state.progression.mastery = { [sense]: 500, [lore]: 500, [ritual]: 500, [listening]: 500, [shadow]: 500 };
    Object.assign(state.secretSupplicant.cases['empty-bowl']!, { status: 'PREPARED', method: 'MYSTIC', attemptWeek: state.week });
    Object.assign(state.secretSupplicant.cases['covered-token']!, { status: 'RESOLVED', outcome: 'PRESENCE_NOTED', contactOpen: false });
    Object.assign(state.listener.cases['broken-phrase']!, { status: 'RESOLVED', method: 'LISTEN',
      outcome: 'FRAGMENT_RETAINED', attemptWeek: state.week, contactOpen: false, verified: true });
    Object.assign(state.listener.cases['room-exit']!, { status: 'RESOLVED', method: 'LISTEN',
      outcome: 'DISTANCE_CHECKED', attemptWeek: state.week, contactOpen: false, verified: true });
    state.knowledge.push({ id: 'unrelated-note', week: state.week, title: '异地旧物间记录',
      text: 'PREPARED_RITUAL TERRIFYING_PRESENCE SECRET_TRUTH FUTURE_ACTION BLACK_BLOOD GRAZED_SOUL' });
    const before = structuredClone(state), random = stream(state);
    for (let repeat = 0; repeat < 5; repeat++) {
      const block = resolveShadowAsceticCombatAbility(state, sense, 1, random);
      expect(block).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(block.label).toContain('本场没有已登记的神秘恐怖存在');
      expect(block.label).toContain('普通格挡护身');
      const prepare = resolveShadowAsceticCombatAbility(state, listening, 1, random);
      expect(prepare).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(prepare.label).toContain('未登记对应隐秘存在的在场耳语来源');
      expect(prepare.label).toContain('贡献0、消耗0');
      expect(prepare.label).toContain('不额外抽盘');
      expect(block.label + prepare.label).not.toMatch(/PREPARED_RITUAL|TERRIFYING_PRESENCE|SECRET_TRUTH|FUTURE_ACTION|BLACK_BLOOD|GRAZED_SOUL/);
    }
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('does not import hidden practice state, mastery or claims into FIRST_CASE shadow cover', () => {
    // Deliberately inconsistent synthetic state checks the combat boundary, not
    // the natural practice exit gate: each real practice record claims hidden.
    const state = fixture(); state.spirituality = 60; state.progression.mastery[shadow] = 500;
    for (const id of ['lamp-shift', 'blocked-alcove', 'agreed-watch']) {
      Object.assign(state.shadowAscetic.cases[id]!, { status: 'EXAMINED', method: 'SHADOW',
        attemptWeek: state.week, shadowOpen: true, hidden: true });
    }
    state.knowledge.push({ id: 'shadow-claim', week: state.week, title: '异地练习记录',
      text: 'USABLE_SHADOW HIDDEN IMMUNE SHADOW_TELEPORT SHADOW_CLONE SHADOW_WEAPON' });
    const before = structuredClone(state), random = stream(state);
    for (let repeat = 0; repeat < 5; repeat++) {
      const effect = resolveShadowAsceticCombatAbility(state, shadow, 0.8, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
      expect(effect.label).toContain('首案现场没有已登记的可用阴影');
      expect(effect.label).toContain('普通走位牵制');
      expect(effect.label).toContain('消耗0');
      expect(effect.label).toContain('不取消对手行动');
      expect(effect.label).not.toMatch(/USABLE_SHADOW|HIDDEN|IMMUNE|SHADOW_TELEPORT|SHADOW_CLONE|SHADOW_WEAPON/);
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
      (s: SliceState) => { s.progression.sequence = 9; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.sequence = 6; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveShadowAsceticCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Shadow Ascetic synthetic rounds retain ordinary consequences and replay', () => {
  it('interleaves five slots with three ordinary attacks without new costs, entities or random tickets', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 126, 1, 201, 1, 281, 341, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[12, 0], [8.4, 0], [0, 10], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(465 * 0.8 + (12 + 8.4)); expect(round.enemyAdvantage).toBe(114 + 48 - 16);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(16); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.shadowAscetic).toEqual(before.shadowAscetic);
    expect(state.listener).toEqual(before.listener); expect(state.secretSupplicant).toEqual(before.secretSupplicant);
    expect(state.world).toEqual(before.world); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.week).toBe(before.week); expect(state.seer.pollution).toBe(before.seer.pollution);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('never turns ordinary defense, preparation or either accident into injury or pollution', () => {
    for (const [ticket, coin] of [[201, null], [281, null], [341, null], [421, 1], [421, 2]] as const) {
      const state = fixture(); const before = structuredClone(state);
      const draws = coin === null ? scriptRolls(1, 1, ticket, 400, 1) : scriptRolls(1, 1, ticket, coin, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(coin === null ? 0 : coin === 1 ? -11.25 : 11.25);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(before.town); expect(state.mind).toBe(before.mind);
      expect(state.seer.pollution).toBe(before.seer.pollution); expect(state.progression).toEqual(before.progression);
      expect(draws).toHaveBeenCalledTimes(coin === null ? 5 : 6); vi.restoreAllMocks();
    }
  });

  it('keeps even-round enemy first and five empty listening slots empty through the whole round', () => {
    const state = fixture(); state.combat!.round = 2;
    const draws = scriptRolls(100, 100, 400, 341, 400, 341, 400, 341, 341, 341, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.playerAdvantage).toBe(465); expect(round.enemyAdvantage).toBe(114);
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
      expect(state.spirituality).toBe(60); vi.restoreAllMocks();
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

  it('keeps an actual enemy strike and shared death consequence after a no-shadow control slot', () => {
    const state = fixture(); state.progression.mastery[shadow] = 500;
    Object.assign(state.shadowAscetic.cases['agreed-watch']!, { status: 'EXAMINED', method: 'SHADOW',
      attemptWeek: state.week, shadowOpen: true, hidden: true });
    const before = structuredClone(state);
    const draws = scriptRolls(1, 1, 241, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves).toHaveLength(2);
    expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 6 });
    expect(round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 16, enemyReduction: 0 });
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(state.shadowAscetic).toEqual(before.shadowAscetic);
    expect(state.spirituality).toBe(before.spirituality);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
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
    expect(failed.spirituality).toBe(16); expect(failureDraws).toHaveBeenCalledTimes(6);
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
