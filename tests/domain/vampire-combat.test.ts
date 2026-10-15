import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { VAMPIRE_COUNT_WHEEL, currentVampireBodySource, drawVampireAbility, isVampire,
  resolveVampireCombatAbility, vampireAbilityWheel, vampireActionCount,
  type VampireBodySource, type VampireMoveId } from '../../src/domain/vampire/combat.js';
import { currentClownDangerSource } from '../../src/domain/clown/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('vampire-combat-test', sliceDefaultCreationSelection, 'vampire-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'moon', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  Object.assign(state.vampire.encounter, { status: 'FIGHTING', observed: true,
    attemptWeek: state.week, startHistoryIndex: state.combatHistory.length });
  state.combat = { encounterId: 'VAMPIRE_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: VampireMoveId, source = currentVampireBodySource(state)) {
  return resolveVampireCombatAbility(state, id, 1, stream(state), source);
}
/** Override values but consume and verify the actual deterministic stream. */
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

const sceneIds = ['moon.s7.abyss-shackles', 'moon.s7.dark-wings'] as const;
const supernaturalIds = [...sceneIds, 'moon.s7.regeneration'] as const;

describe('vampire S7 finite combat profile', () => {
  it('uses the exact seven G sectors and six counts without scent, claws, medicines or animal actions', () => {
    const state = fixture();
    expect(isVampire(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(VAMPIRE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 15, 5]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel).toEqual(vampireAbilityWheel(null));
    expect(wheel.map(entry => entry.id)).toEqual(['STRIKE', 'BLOCK', 'DISTANCE', ...supernaturalIds, 'MISS']);
    expect(wheel.map(entry => entry.weight)).toEqual([25, 15, 10, 20, 15, 10, 5]);
    expect(wheel.reduce((sum, entry) => sum + entry.weight, 0)).toBe(100);
    expect(wheel.some(entry => /blood-scent|claw|medicine|bat|animal|summon/.test(entry.id))).toBe(false);
    wheel[0]!.weight = 0;
    const counts = playerCountWheel(state); counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(25);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('maps all exact count boundaries and each ability ticket with no redraw', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [95, 5], [96, 6], [100, 6]]) {
      expect(vampireActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of vampireAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      scriptRolls(first, boundary);
      const random = stream(fixture());
      expect(drawVampireAbility(random, null)).toBe(entry.id);
      expect(drawVampireAbility(random, null)).toBe(entry.id);
      expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
  });

  it('preserves exact stance normalization without assigning blood scent an extra slot', () => {
    const attack = [125, 60, 40, 80, 60, 40, 20];
    const control = [100, 60, 40, 100, 60, 40, 20];
    const defend = [100, 75, 40, 80, 75, 50, 20];
    expect(vampireAbilityWheel('ATTACK').map(entry => entry.weight)).toEqual(attack.map(n => n / 425 * 100));
    expect(vampireAbilityWheel('CONTROL').map(entry => entry.weight)).toEqual(control.map(n => n / 420 * 100));
    expect(vampireAbilityWheel('DEFEND').map(entry => entry.weight)).toEqual(defend.map(n => n / 440 * 100));
    expect(vampireAbilityWheel('RETREAT')).toEqual(vampireAbilityWheel(null));
  });

  it('uses tier450, core20/30/30/20, core cap90 and spirituality60, retaining the ordinary enemy', () => {
    const state = fixture(); state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 425, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(475);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 425, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(12);
  });

  it('retains old apothecary, tamer and ordinary profiles without importing an animal or a clown source', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [['moon', 9], ['moon', 8], [null, null]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isVampire(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
      state.town.clubLocation = 'HAND';
      expect(playerAbilityWheel(state, 'CONTROL')[0]).toMatchObject({ id: 'STRIKE', label: '持握原短棍打击' });
      state.town.clubLocation = 'SHOP';
    }
    expect(currentClownDangerSource(state)).toBeNull();
  });

  it('requires the actual held town club, applies its 16 once and scales only a physical strike', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      const before = structuredClone(state), random = stream(state);
      expect(resolveVampireCombatAbility(state, 'STRIKE', 0.8, random)).toMatchObject({
        selfGain: (location === 'HAND' ? 16 : 12) * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolve(state, 'BLOCK')).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(resolve(state, 'DISTANCE')).toMatchObject({ selfGain: 0, enemyReduction: 8, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      if (location === 'HAND') expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
    }
    const state = fixture(); state.town.clubLocation = 'HAND'; state.health = 50;
    scriptRolls(1, 1, 1, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]).toMatchObject({ label: '持握原短棍打击', selfGain: 14.4 });
    expect(state.town.clubLocation).toBe('HAND');
  });
});

describe('authored body, lamplight and space source', () => {
  it('requires current observed living resisting local facts, independent of the old carrier', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentVampireBodySource(state)).toMatchObject({ encounterId: 'VAMPIRE_DISPUTE',
      target: 'BROOK_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY', space: 'LAMPLIT_OPEN_YARD',
      shadow: 'VISIBLE_LAMPLIT_SHADOW', aggression: 'VISIBLE_SHORT_CLUB_THREAT' });
    const mutations: ((state: SliceState) => void)[] = [
      s => { s.vampire.encounter.observed = false; },
      s => { s.vampire.encounter.status = 'RESOLVED'; },
      s => { s.vampire.encounter.attemptWeek = null; },
      s => { s.vampire.encounter.attemptWeek = s.week - 1; },
      s => { s.vampire.encounter.startHistoryIndex = null; },
      s => { s.combat = null; },
      s => { s.combat!.enemyHealth = 0; },
      s => { s.combat!.enemyStatus = 'DEAD'; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; },
      s => { s.world.city = 'ELSEWHERE'; },
      s => { s.health = 0; },
      s => { s.status = 'DEAD'; },
      s => { s.progression.sequence = 8; },
      s => { s.progression.pathwayId = 'audience'; },
    ];
    for (const mutate of mutations) {
      const candidate = fixture(); mutate(candidate);
      const before = structuredClone(candidate), random = stream(candidate);
      expect(currentVampireBodySource(candidate)).toBeNull();
      expect(resolveVampireCombatAbility(candidate, 'moon.s7.abyss-shackles', 1, random).threatens).toBe(false);
      expect(candidate).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rejects stale or forged source identity without charging, revealing hidden facts or redrawing', () => {
    const state = fixture(), source = currentVampireBodySource(state)!;
    state.knowledge = [{ id: 'private', week: 1, title: 'SECRET', text: 'HIDDEN_TARGET_SECRET' }];
    const invalid: (VampireBodySource | null)[] = [null, { ...source, round: 2 },
      { ...source, attemptWeek: source.attemptWeek + 1 }, { ...source, startHistoryIndex: 100 },
      { ...source, target: 'SOMEONE_ELSE' } as unknown as VampireBodySource,
      { ...source, body: 'OLD_BODY' } as unknown as VampireBodySource,
      { ...source, shadow: 'UNSEEN_SHADOW' } as unknown as VampireBodySource,
      { ...source, space: 'OTHER_ROOM' } as unknown as VampireBodySource,
      { ...source, aggression: 'NONE' } as unknown as VampireBodySource];
    for (const input of invalid) for (const id of sceneIds) {
      const before = structuredClone(state), random = stream(state);
      const effect = resolveVampireCombatAbility(state, id, 1, random, input);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(effect.label).toContain('改用格挡护身'); expect(effect.label).not.toContain('HIDDEN_TARGET_SECRET');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('never reuses the new scene shadow or flying space in any older encounter', () => {
    for (const encounterId of ['FIRST_CASE', 'CLOWN_RESCUE', 'HUNTER_CARGO', 'PROVOKER_DISPUTE',
      'MAGICIAN_DISPUTE', 'PYROMANIAC_DISPUTE', 'PSYCHOLOGIST_DISPUTE'] as const) {
      const state = fixture(); state.combat!.encounterId = encounterId;
      for (const id of sceneIds) {
        const before = structuredClone(state), random = stream(state);
        expect(resolveVampireCombatAbility(state, id, 1, random)).toMatchObject({
          selfGain: 0, enemyReduction: 10, threatens: false,
        });
        expect(state).toEqual(before); expect(random.cursor).toBe(0);
      }
    }
  });

  it('runs one real will D14 for shackles and retains cost and lastCheck on all outcomes', () => {
    for (const [roll, tier, reduction] of [[1, 'GREAT_SUCCESS', 24], [52, 'SUCCESS', 24],
      [53, 'FAILURE', 0], [100, 'GREAT_FAILURE', 0]] as const) {
      const state = fixture(), before = structuredClone(state), random = stream(state);
      scriptRolls(roll);
      const effect = resolveVampireCombatAbility(state, 'moon.s7.abyss-shackles', 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: reduction, threatens: false });
      expect(effect.label).toContain('不删除行动');
      expect(state.lastCheck).toMatchObject({ ability: 'will', difficulty: 14, chance: 52, roll, tier });
      expect(state).toEqual({ ...before, spirituality: 57, lastCheck: state.lastCheck });
      expect(random.cursor).toBe(1);
      vi.restoreAllMocks();
    }
  });

  it('charges wings once without damage, relocation, automatic retreat or an additional action', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    const effect = resolveVampireCombatAbility(state, 'moon.s7.dark-wings', 0.8, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 22, threatens: false });
    expect(effect.label).toContain('仍在原现场');
    expect(state).toEqual({ ...before, spirituality: 57 }); expect(random.cursor).toBe(0);
  });

  it('falls back without cost or another RNG draw whenever any ability lacks its 3 spirituality', () => {
    for (const id of supernaturalIds) {
      const state = fixture(); state.spirituality = 2.5; state.health = 50;
      const before = structuredClone(state), random = stream(state);
      const effect = resolveVampireCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(effect.label).toContain('灵性不足3');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('bounded regeneration and unchanged physical consequences', () => {
  it('heals only six, caps at100 and preserves every injury, treatment, risk and other resource', () => {
    for (const [health, expected] of [[1, 7], [50, 56], [97, 100], [99, 100]]) {
      const state = fixture(); state.health = health!; state.mind = 70; state.injuryRisk = 4;
      state.injuries = [
        { id: 'untreated', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null },
        { id: 'treated', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: 2 },
      ];
      const before = structuredClone(state), random = stream(state);
      expect(resolveVampireCombatAbility(state, 'moon.s7.regeneration', 1, random, null))
        .toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false });
      expect(state).toEqual({ ...before, health: expected, spirituality: 57 }); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.health = 1;
    for (let i = 0; i < 20; i++) resolve(state, 'moon.s7.regeneration');
    expect(state.health).toBe(100); expect(state.spirituality).toBe(9);
  });

  it('does not charge at full health and never resurrects or changes an ended encounter', () => {
    const healthy = fixture(), before = structuredClone(healthy), random = stream(healthy);
    expect(resolveVampireCombatAbility(healthy, 'moon.s7.regeneration', 1, random))
      .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(healthy).toEqual(before); expect(random.cursor).toBe(0);
    const mutations: ((state: SliceState) => void)[] = [
      s => { s.health = 0; }, s => { s.status = 'DEAD'; }, s => { s.status = 'SLICE_COMPLETE'; },
      s => { s.combat = null; }, s => { s.combat!.enemyHealth = 0; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(); state.health = 50; mutate(state);
      const saved = structuredClone(state), rng = stream(state);
      expect(resolveVampireCombatAbility(state, 'moon.s7.regeneration', 1, rng))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(saved); expect(rng.cursor).toBe(0);
    }
  });

  it('keeps all actual enemy actions after successful shackles and grants no physical consequence', () => {
    const state = fixture();
    const draws = scriptRolls(1, 86, 226, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
    expect(round.moves[0]).toMatchObject({ enemyReduction: 24, selfGain: 0 });
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(60); expect(draws).toHaveBeenCalledTimes(8);
  });

  it('uses a paid regeneration at most until full health within six real actions and does not deal harm', () => {
    const state = fixture(); state.health = 95;
    const draws = scriptRolls(100, 1, 366, 400, 366, 366, 366, 366, 366, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(6); expect(round.moves).toHaveLength(7);
    expect(round.moves[0]!.selfGain).toBe(8);
    expect(round.moves.filter(move => move.actor === 'PLAYER').slice(1)
      .every(move => move.enemyReduction === 10 && move.selfGain === 0)).toBe(true);
    expect(state.health).toBe(100); expect(state.spirituality).toBe(60);
    expect(state.combat!.enemyHealth).toBe(100);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(10);
  });

  it('retains real physical injury, surrender and death instead of immunity or posthumous healing', () => {
    const attacking = fixture(); scriptRolls(1, 1, 1, 400, 1, 66);
    const attack = resolveSliceCombatRound(attacking, 'ATTACK');
    expect(attack.outcome).toBe('ENEMY_SURRENDERED');
    expect(attacking.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
    expect(attacking.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
    expect(attack.round.consequence).toContain('布鲁克仍然活着');
    vi.restoreAllMocks();
    const dying = fixture(); dying.health = 40;
    scriptRolls(1, 1, 366, 1, 1_000_000, 96);
    const death = resolveSliceCombatRound(dying, 'ATTACK');
    expect(death.round.moves[0]!.label).toContain('健康恢复6');
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dying.health).toBe(0);
    expect(dying.spirituality).toBe(57);
    expect(death.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(resolve(dying, 'moon.s7.regeneration').selfGain).toBe(0);
    expect(dying.health).toBe(0); expect(dying.spirituality).toBe(57);
  });

  it('uses the same ordinary retreat and replays serialized state without Math.random', () => {
    const retreating = fixture(); retreating.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(retreating, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('布鲁克'); expect(retreating.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3);
    vi.restoreAllMocks();
    const state = fixture(); state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
  });
});
