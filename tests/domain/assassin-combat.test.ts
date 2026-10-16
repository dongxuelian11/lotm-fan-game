import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { ASSASSIN_COUNT_WHEEL, assassinAbilityWheel, assassinActionCount, currentAssassinCombatSource,
  drawAssassinAbility, isAssassin, resolveAssassinCombatAbility,
  type AssassinCombatSource, type AssassinMoveId } from '../../src/domain/assassin/combat.js';
import * as assassinCombat from '../../src/domain/assassin/combat.js';
import { WARRIOR_COUNT_WHEEL, warriorAbilityWheel } from '../../src/domain/warrior/combat.js';
import { WEAPONMASTER_COUNT_WHEEL, weaponmasterAbilityWheel } from '../../src/domain/weaponmaster/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const burst = 'assassin.s9.burst', lightness = 'assassin.s9.lightness';
const vision = 'assassin.s9.vision', shadow = 'assassin.s9.shadow';
const ids = [burst, lightness, vision, shadow, 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('assassin-combat-test', sliceDefaultCreationSelection, 'assassin-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'demoness', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: AssassinMoveId, physical = 1,
  source = currentAssassinCombatSource(state)) {
  return resolveAssassinCombatAbility(state, id, physical, stream(state), source);
}
/** Script tickets without bypassing the production random cursor. */
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

describe('Assassin S9 exact D profile', () => {
  it('uses32/18/12/10/8/20 slots and independent15/20/25/25/15 counts', () => {
    const state = fixture();
    expect(isAssassin(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(assassinAbilityWheel(null, state));
    expect(assassinAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(assassinAbilityWheel(null).map(entry => entry.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    expect(playerCountWheel(state)).toEqual(ASSASSIN_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(32);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it('preserves every count boundary and consumes one random draw per ability slot', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [85, 4], [86, 5], [100, 5]]) expect(assassinActionCount(roll!)).toBe(count);
    let boundary = 0;
    for (const entry of assassinAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawAssassinAbility(random, null)).toBe(entry.id);
      expect(drawAssassinAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes exact ×1.25 stance tickets, including both physical attack slots', () => {
    for (const [stance, weights] of [
      ['ATTACK', [160, 90, 48, 40, 32, 80]],
      ['DEFEND', [128, 72, 60, 40, 32, 80]],
      ['CONTROL', [128, 72, 48, 50, 32, 80]],
      ['PREPARE', [128, 72, 48, 40, 40, 80]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(assassinAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawAssassinAbility(random, stance)).toBe(ids[index]);
        expect(drawAssassinAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(assassinAbilityWheel('RETREAT')).toEqual(assassinAbilityWheel(null));
  });

  it('uses core30/35/20/15, base200 and max30 with one continuing-round recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 339, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(222 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(3);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.weeklyBudget).toBe(before.weeklyBudget); expect(state.progression).toEqual(before.progression);
    expect(state.world).toEqual(before.world); expect(state.town).toEqual(before.town);
  });

  it('caps the core at40, status penalty at40 percent, and recovery at30', () => {
    const state = fixture(); state.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    state.health = 50; state.mind = 25; state.spirituality = 3;
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(state.spirituality).toBe(6); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 29;
    scriptRolls(1, 1, 339, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(30);
  });

  it('retains the S9 advantage floor20 after extreme negative contribution', () => {
    vi.spyOn(assassinCombat, 'resolveAssassinCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('does not unlock higher Demoness sequences or change neighboring profiles', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isAssassin(state)).toBe(false); expect(currentAssassinCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'warrior'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(WARRIOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(warriorAbilityWheel('CONTROL', state));
    state.progression.sequence = 7;
    expect(playerCountWheel(state)).toEqual(WEAPONMASTER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(weaponmasterAbilityWheel('CONTROL', state));
  });
});

describe('Assassin finite physical budgets, costs and source boundaries', () => {
  it('uses16f/11.2f/12f and the6f no-cover fallback at all six mastery nodes', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery = {
        [burst]: mastery, [lightness]: mastery, [vision]: mastery, [shadow]: mastery,
      };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveAssassinCombatAbility(state, burst, 0.8, random)).toMatchObject({
        selfGain: 16 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveAssassinCombatAbility(state, lightness, 0.8, random)).toMatchObject({
        selfGain: 11.2 * factor * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveAssassinCombatAbility(state, vision, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 12 * factor, threatens: false,
      });
      expect(resolveAssassinCombatAbility(state, shadow, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 6 * factor, threatens: false,
      });
      before.spirituality -= 1;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('reads each of the four own masteries without borrowing higher-sequence powers', () => {
    const state = fixture(); state.progression.mastery = {
      [burst]: 500, [lightness]: 300, [vision]: 100, [shadow]: 0,
      'demoness.s7.invisibility': 500, 'demoness.s7.black-flame': 500, 'demoness.s7.mirror-decoy': 500,
    };
    expect(resolve(state, burst).selfGain).toBe(16);
    expect(resolve(state, lightness).selfGain).toBe(11.2 * (0.65 + 0.35 * 300 / 500));
    expect(resolve(state, vision).enemyReduction).toBe(12 * (0.65 + 0.35 * 100 / 500));
    expect(resolve(state, shadow).enemyReduction).toBe(6 * 0.65);
    expect(assassinAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('bounds malformed mastery and physical factors, keeping zero output nonthreatening', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[burst] = mastery;
      expect(resolve(state, burst).selfGain).toBe(16 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery = { [burst]: 500, [lightness]: 500 };
    for (const id of [burst, lightness]) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(resolve(state, id, 3).selfGain).toBe(id === burst ? 16 : 11.2);
    }
  });

  it('pays1S only for a real burst and falls back to ordinary12 without overdraft', () => {
    for (const spirituality of [0, 0.5, 1, 1.5]) {
      const state = fixture(); state.spirituality = spirituality; state.progression.mastery[burst] = 500;
      const before = structuredClone(state), random = stream(state);
      const effect = resolveAssassinCombatAbility(state, burst, 0.8, random);
      expect(effect.selfGain).toBe((spirituality >= 1 ? 16 : 12) * 0.8);
      expect(effect.threatens).toBe(true);
      before.spirituality = spirituality >= 1 ? spirituality - 1 : spirituality;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.spirituality = 0; const before = structuredClone(state);
    for (const id of [lightness, vision, shadow, 'OBSERVE'] as const) resolve(state, id);
    expect(state).toEqual(before);
  });

  it('only actual Town HAND club replaces H with16 at0S and never stacks burst', () => {
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.progression.mastery[burst] = 0;
      const before = structuredClone(state), random = stream(state);
      const effect = resolveAssassinCombatAbility(state, burst, 0.8, random);
      expect(effect.selfGain).toBe((location === 'HAND' ? 16 : 16 * 0.65) * 0.8);
      expect(resolveAssassinCombatAbility(state, lightness, 0.8, random).selfGain).toBe(11.2 * 0.65 * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '蓄力爆发');
      before.spirituality -= location === 'HAND' ? 0 : 1;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.spirituality = 0; state.town.clubLocation = 'HAND';
    expect(resolve(state, burst).selfGain).toBe(16); expect(state.spirituality).toBe(0);
  });

  it('does not treat another pathway’s held practice club as assassin equipment', () => {
    const state = fixture(); state.town.clubLocation = 'SHOP';
    Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
    const before = structuredClone(state);
    expect(resolve(state, burst).selfGain).toBe(16 * 0.65);
    before.spirituality -= 1; expect(state).toEqual(before);
  });

  it('derives only the present first-case body, passage and original exit', () => {
    const state = fixture();
    expect(currentAssassinCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1,
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    state.knowledge.push({ id: 'old-secret', week: 1, title: '旧消息',
      text: 'PRIVATE_SECRET NEXT_ACTION DARK_COVER 黑焰 冰霜 镜替 身后敌人' });
    const before = structuredClone(state), observation = resolve(state, 'OBSERVE');
    expect(observation).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(observation.label).not.toMatch(/PRIVATE_SECRET|NEXT_ACTION|DARK_COVER|黑焰|冰霜|镜替|身后敌人/);
    expect(resolve(state, shadow).label).toContain('没有已核实暗处');
    expect(state).toEqual(before);
  });

  it('never invents dark cover from knowledge, another scene, mastery or supplied flags', () => {
    const state = fixture(); state.progression.mastery[shadow] = 500;
    state.knowledge.push({ id: 'shadow-practice', week: state.week, title: '别处暗处', text: 'DARK_COVER' });
    const source = { ...currentAssassinCombatSource(state)!, darkCover: true, invisible: true };
    const before = structuredClone(state), random = stream(state);
    expect(resolveAssassinCombatAbility(state, shadow, 1, random, source)).toMatchObject({
      selfGain: 0, enemyReduction: 6, threatens: false,
    });
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    expect(Object.keys(state.combat!)).not.toContain('invisible');
  });

  it('rejects stale and forged scene sources without costs, draws or hidden information', () => {
    const state = fixture(), source = currentAssassinCombatSource(state)!;
    const invalid: (AssassinCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_DARK_COVER' }) as unknown as AssassinCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolveAssassinCombatAbility(state, id, 1, random, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('does not act on ended, dead, absent, wrong-pathway or unrelated encounters', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentAssassinCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveAssassinCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Assassin shared injury, alternating actions, retreat and deterministic replay', () => {
  it('resolves five player slots against three ordinary enemy slots with exact costs', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 161, 1, 251, 1, 299, 339, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [16 * 0.65, 0], [11.2 * 0.65, 0], [0, 12 * 0.65], [0, 6 * 0.65], [0, 0],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(215 * 0.9 + (16 * 0.65 + 11.2 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (12 * 0.65 + 6 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(12); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('allows only the first burst to spend the final1S and recovers once after five actions', () => {
    const state = fixture(); state.spirituality = 1;
    const draws = scriptRolls(100, 1, 1, 400, 1, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.selfGain))
      .toEqual([16 * 0.65, 12, 12, 12, 12]);
    expect(state.spirituality).toBe(3); expect(outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(10);
  });

  it('switches first actor on even rounds while retaining independent count distributions', () => {
    const state = fixture(); state.combat!.round = 2;
    scriptRolls(100, 100, 400, 339, 400, 339, 400, 339, 339, 339, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
  });

  it('never authorizes injury from defense, footwork, observation or positive accident', () => {
    for (const ticket of [251, 299, 339, 371]) {
      const state = fixture(); const before = structuredClone(state.town);
      const draws = ticket === 371 ? scriptRolls(1, 1, ticket, 2, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(ticket === 371 ? 5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(before); expect(draws).toHaveBeenCalledTimes(ticket === 371 ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('applies a negative accident once without dropping or duplicating the held club', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; const before = structuredClone(state.town);
    scriptRolls(1, 1, 371, 1, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(210); expect(round.moves[0]!.selfGain).toBe(-5);
    expect(state.town).toEqual(before); expect(round.consequenceWeights).toBeNull();
  });

  it('keeps actual ordinary enemy attacks intact despite body defense or shadow fallback', () => {
    for (const ticket of [251, 299]) {
      const state = fixture(); state.mind = 25;
      const draws = scriptRolls(1, 100, ticket, 1, 1, 1, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
      expect(round.moves).toHaveLength(4); expect(round.playerAdvantage).toBe(215 * 0.8);
      expect(state.mind).toBe(25); expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(7);
      expect(state.combat!.navigatorWater).toBeUndefined(); expect(state.combat!.wrathCharge).toBeUndefined();
      vi.restoreAllMocks();
    }
  });

  it('lets H and J cause ordinary injuries and surrender without an automatic killing blow', () => {
    for (const ticket of [1, 161]) {
      const state = fixture(); state.progression.mastery[burst] = 500;
      scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves).toHaveLength(2);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(round.consequence).toContain('携铃者仍然活着'); expect(state.spirituality).toBe(ticket === 1 ? 29 : 30);
      vi.restoreAllMocks();
    }
  });

  it('retains enemy death only through the shared consequence draw after actual attack', () => {
    const state = fixture(); scriptRolls(1, 1, 1, 400, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_DEAD'); expect(state.combat!.enemyHealth).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.spirituality).toBe(29);
  });

  it('keeps player accumulated injury risk and real death despite defensive abilities', () => {
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 251, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5);
    expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(6);
  });

  it('retreats by the original ordinary exit without recovery, invisibility or item changes', () => {
    const state = fixture(); state.spirituality = 10; state.town.clubLocation = 'HAND';
    const town = structuredClone(state.town), draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('携铃者'); expect(round.retreat).toBe('SUCCESS');
    expect(state.spirituality).toBe(10); expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('keeps failed retreat and subsequent enemy injury possible', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(round.retreat).toBe('FAILURE'); expect(round.moves).toHaveLength(1);
    expect(round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.spirituality).toBe(13);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('replays serialized state, actual held gear and costs from the same seed and cursor', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.town.clubLocation).toBe('HAND');
  });
});
