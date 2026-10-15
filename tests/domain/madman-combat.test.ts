import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { MADMAN_COUNT_WHEEL, currentMadmanCombatSource, drawMadmanAbility, isMadman,
  madmanAbilityWheel, madmanActionCount, resolveMadmanCombatAbility,
  type MadmanBurstPolicy, type MadmanCombatSource, type MadmanMoveId, type MadmanRoundPolicy,
} from '../../src/domain/madman/combat.js';
import * as madmanCombat from '../../src/domain/madman/combat.js';
import { PRISONER_COUNT_WHEEL, prisonerAbilityWheel } from '../../src/domain/prisoner/combat.js';
import { RAGER_COUNT_WHEEL, ragerAbilityWheel } from '../../src/domain/rager/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const body = 'chained.s9.prisoner-body', perception = 'chained.s9.keen-perception';
const sacrifice = 'chained.s8.reason-sacrifice', resistance = 'chained.s8.mental-resistance';
const ids = [body, 'BODY_FOLLOWUP', perception, 'POSITION', resistance, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('madman-combat-test', sliceDefaultCreationSelection, 'madman-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'chained', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function policy(choice: MadmanBurstPolicy = 'BURST_FIRST'): MadmanRoundPolicy {
  return { policy: choice, triggered: false, mentalCost: 0, spiritualCost: 0 };
}
function resolve(state: SliceState, id: MadmanMoveId, choice = policy('HOLD'), physical = 1,
  source = currentMadmanCombatSource(state)) {
  return resolveMadmanCombatAbility(state, id, physical, stream(state), choice, source);
}
/** Select actual tickets while retaining the production cursor and range checks. */
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

describe('Madman S8 exact G profile and round dispatch', () => {
  it('uses 30/20/20/10/15/5 slots, independent 10/20/25/25/20 counts and copied projections', () => {
    const state = fixture();
    expect(isMadman(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(madmanAbilityWheel(null, state));
    expect(madmanAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(madmanAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(MADMAN_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 20]);
    const wheel = playerAbilityWheel(state, null), count = playerCountWheel(state);
    wheel[0]!.weight = 0; count[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(MADMAN_COUNT_WHEEL)).toBe(true);
    expect(MADMAN_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
  });

  it('preserves all count and neutral ability boundaries with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [100, 5]]) expect(madmanActionCount(roll!)).toBe(count);
    let boundary = 0;
    for (const entry of madmanAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawMadmanAbility(random, null)).toBe(entry.id);
      expect(drawMadmanAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('keeps exact normalized ×1.25 stance tickets without changing counts', () => {
    for (const [stance, weights] of [
      ['ATTACK', [150, 100, 80, 40, 60, 20]],
      ['DEFEND', [120, 80, 100, 40, 60, 20]],
      ['CONTROL', [120, 80, 80, 50, 60, 20]],
      ['PREPARE', [120, 80, 80, 40, 75, 20]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(madmanAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawMadmanAbility(random, stance)).toBe(ids[index]);
        expect(drawMadmanAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(madmanAbilityWheel('RETREAT')).toEqual(madmanAbilityWheel(null));
  });

  it('dispatches each count boundary without adding burst, preparation or enemy slots', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [100, 5]] as const) {
      const state = fixture(), cursor = state.random.cursor;
      const draws = scriptRolls(roll, 1, 371, 400, ...Array<number>(count - 1).fill(371), 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(round.playerCount).toBe(count); expect(round.enemyCount).toBe(1);
      expect(round.moves).toHaveLength(count + 1);
      expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(count);
      expect(round.madmanBurst).toEqual(policy());
      expect(state.mind).toBe(100); expect(state.spirituality).toBe(45);
      expect(draws).toHaveBeenCalledTimes(count + 4); expect(state.random.cursor).toBe(cursor + count + 4);
      vi.restoreAllMocks();
    }
  });

  it('uses core35/35/15/15, base300, cap60, floor30 and max45 with normal recovery4.5', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(321 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(4.5);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
    vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(7.5); expect(capped.mind).toBe(25);
    vi.restoreAllMocks();
    vi.spyOn(madmanCombat, 'resolveMadmanCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(30);
  });

  it('keeps S9, unrelated S8 and unimplemented later sequences isolated', () => {
    const state = fixture(); state.progression.sequence = 9;
    expect(isMadman(state)).toBe(false); expect(currentMadmanCombatSource(state)).toBeNull();
    expect(playerCountWheel(state)).toEqual(PRISONER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(prisonerAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'tyrant'; state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(RAGER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ragerAbilityWheel('CONTROL'));
    for (const [pathwayId, sequence] of [[null, null], ['chained', 2]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isMadman(state)).toBe(false); expect(currentMadmanCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
  });
});

describe('Madman ordinary budgets and explicit single-action sacrifice', () => {
  it('uses exact27f/18.9f/17.1f/6 physical budgets and zero-cost ordinary actions', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [body]: mastery, [perception]: mastery, [sacrifice]: mastery, [resistance]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveMadmanCombatAbility(state, body, 0.8, random)).toMatchObject({ selfGain: 27 * factor * 0.8, threatens: true });
      expect(resolveMadmanCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random).selfGain).toBe(18.9 * factor * 0.8);
      expect(resolveMadmanCombatAbility(state, perception, 0.8, random).enemyReduction).toBe(17.1 * factor * 0.8);
      expect(resolveMadmanCombatAbility(state, 'POSITION', 0.8, random).enemyReduction).toBe(6 * 0.8);
      expect(resolveMadmanCombatAbility(state, resistance, 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('shares only inherited body mastery for H/J and independent perception for B', () => {
    const state = fixture(); state.progression.mastery = {
      [body]: 500, [perception]: 0, [sacrifice]: 500, [resistance]: 500,
      'chained.s9.improvised-combat': 500, BODY_FOLLOWUP: 0, POSITION: 500,
      'chained.s7.werewolf-form': 500, 'chained.s6.zombie-body': 500,
    };
    expect(resolve(state, body).selfGain).toBe(27);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(18.9);
    expect(resolve(state, perception).enemyReduction).toBe(17.1 * 0.65);
    expect(resolve(state, 'POSITION').enemyReduction).toBe(6);
    expect(madmanAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('bounds malformed mastery and physical factors without charging a zero contribution', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery = { [body]: mastery, [perception]: mastery, [sacrifice]: mastery };
      const factor = mastery === 800 ? 1 : 0.65;
      expect(resolve(state, body).selfGain).toBe(27 * factor);
      expect(resolve(state, perception).enemyReduction).toBe(17.1 * factor);
      expect(resolve(state, body, policy()).selfGain).toBe(27 * factor * (1 + 0.25 * factor));
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(), before = structuredClone(state), choice = policy();
      for (const id of [body, 'BODY_FOLLOWUP', perception, 'POSITION'] as const) {
        expect(resolve(state, id, choice, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(choice).toEqual(policy()); expect(state).toEqual(before);
    }
    const state = fixture(); state.progression.mastery[body] = 500;
    expect(resolve(state, body, policy('HOLD'), 3).selfGain).toBe(27);
  });

  it('uses only the first successful H/J, pays exactly10 mental and2S, and never buffs the base or later slots', () => {
    for (const first of [body, 'BODY_FOLLOWUP'] as const) for (const mastery of [0, 250, 500]) {
      const state = fixture(); state.spirituality = 10; state.progression.mastery[sacrifice] = mastery;
      const choice = policy(), random = stream(state), f = 0.65 + 0.35 * mastery / 500;
      const before = structuredClone(state);
      expect(resolveMadmanCombatAbility(state, first, 0.8, random, choice).selfGain)
        .toBe((first === body ? 27 : 18.9) * 0.65 * 0.8 * (1 + 0.25 * f));
      expect(choice).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
      expect(resolveMadmanCombatAbility(state, body, 0.8, random, choice).selfGain).toBe(27 * 0.65 * 0.8);
      expect(resolveMadmanCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random, choice).selfGain).toBe(18.9 * 0.65 * 0.8);
      expect(resolveMadmanCombatAbility(state, perception, 0.8, random, choice).enemyReduction).toBe(17.1 * 0.65 * 0.8);
      before.mind -= 10; before.spirituality -= 2;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('waits past non-attack slots or zero contribution and never prepays for a future hit', () => {
    const state = fixture(), before = structuredClone(state), choice = policy();
    for (const id of [perception, 'POSITION', resistance] as const) resolve(state, id, choice);
    resolve(state, body, choice, 0);
    expect(choice).toEqual(policy()); expect(state).toEqual(before);
    expect(resolve(state, 'BODY_FOLLOWUP', choice).selfGain).toBe(18.9 * 0.65 * (1 + 0.25 * 0.65));
    expect(choice.triggered).toBe(true); expect(state.mind).toBe(90); expect(state.spirituality).toBe(43);
  });

  it('retains ordinary attacks and all resources when either cost is unavailable', () => {
    for (const [mind, spirituality] of [[9, 45], [100, 1.99], [0, 0], [Number.NaN, 45], [100, Number.POSITIVE_INFINITY]]) {
      const state = fixture(); state.mind = mind!; state.spirituality = spirituality!;
      const before = structuredClone(state), choice = policy();
      for (const id of [body, 'BODY_FOLLOWUP'] as const) {
        const effect = resolve(state, id, choice);
        expect(effect.selfGain).toBe((id === body ? 27 : 18.9) * 0.65);
        expect(effect.label).toContain('保留当前资源');
      }
      expect(choice).toEqual(policy()); expect(state).toEqual(before);
    }
    const exact = fixture(); exact.mind = 10; exact.spirituality = 2;
    const choice = policy(), effect = resolve(exact, body, choice);
    expect(choice.triggered).toBe(true); expect(exact.mind).toBe(0); expect(exact.spirituality).toBe(0);
    expect(effect.label).toContain('余精神0、灵性0');
  });

  it('only actual HAND club16 replaces H, can receive the chosen burst, and never stacks body budgets', () => {
    for (const mastery of [0, 500]) for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery[body] = mastery; state.progression.mastery[sacrifice] = 500;
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), choice = policy();
      expect(resolve(state, body).selfGain).toBe(location === 'HAND' ? 16 : 27 * factor);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(18.9 * factor);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '强化身体打击');
      expect(resolve(state, body, choice).selfGain).toBe((location === 'HAND' ? 16 : 27 * factor) * 1.25);
      before.mind -= 10; before.spirituality -= 2;
      expect(state).toEqual(before);
    }
  });

  it('never upgrades a borrowed wooden spacer or forged source gear into a held combat weapon', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    const source = { ...currentMadmanCombatSource(state)!, heldTool: 'town-short-club', toolReady: true };
    state.town.clubLocation = 'BAG'; state.prisoner.cases['jammed-shutter']!.holding = true;
    Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
    const before = structuredClone(state);
    expect(resolve(state, body, policy('HOLD'), 1, source).selfGain).toBe(27 * 0.65);
    expect(state).toEqual(before);
  });

  it('keeps partial mental resistance descriptive against a real ordinary physical enemy', () => {
    const state = fixture(); state.progression.mastery[resistance] = 500;
    Object.assign(state.combat!, { secretMentalAttack: true, futureAction: 'HIDDEN_PSYCHIC_ATTACK' });
    const before = structuredClone(state), choice = policy(), random = stream(state);
    const forbidden = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt')
      .mockImplementation(() => { throw new Error('Do not inspect a future action'); });
    const effect = resolveMadmanCombatAbility(state, resistance, 1, random, choice);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('可抵御部分精神干扰，不是免疫');
    expect(effect.label).toContain('普通携铃者没有精神攻击');
    expect(effect.label).not.toContain('HIDDEN_PSYCHIC_ATTACK');
    expect(state).toEqual(before); expect(choice).toEqual(policy()); expect(forbidden).not.toHaveBeenCalled();
  });

  it('resolves ±7.5 accident once without charging, threatening, dropping gear or granting mastery', () => {
    for (const [roll, contribution] of [[1, -7.5], [2, 7.5]] as const) {
      const state = fixture(); state.town.clubLocation = 'HAND'; const before = structuredClone(state), choice = policy();
      const draws = scriptRolls(roll), random = stream(state);
      expect(resolveMadmanCombatAbility(state, 'ACCIDENT', 1, random, choice))
        .toMatchObject({ selfGain: contribution, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(choice).toEqual(policy());
      expect(draws).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
  });
});

describe('Madman current sources and policy isolation', () => {
  it('derives only the current ordinary opponent, body, passage and exit', () => {
    const state = fixture();
    expect(currentMadmanCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1,
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_REACHABLE_BODY',
      space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
  });

  it('rejects stale, missing and forged sources before RNG, contribution or cost', () => {
    const state = fixture(), source = currentMadmanCombatSource(state)!;
    const invalid: (MadmanCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as MadmanCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state), choice = policy();
      for (const id of ids) expect(resolveMadmanCombatAbility(state, id, 1, random, choice, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(choice).toEqual(policy()); expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('does not act on ended, dead, absent, wrong-sequence or unrelated encounters', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 9; }, (s: SliceState) => { s.progression.sequence = 7; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state), choice = policy();
      expect(currentMadmanCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveMadmanCombatAbility(state, id, 1, random, choice))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(choice).toEqual(policy());
    }
  });

  it('rejects invalid choice and wrong-profile BURST_FIRST before any state mutation or random draw', () => {
    for (const [pathwayId, sequence, choice] of [
      ['chained', 8, 'UNKNOWN'], ['chained', 9, 'BURST_FIRST'], ['chained', 5, 'BURST_FIRST'],
      ['hunter', 8, 'BURST_FIRST'], ['tyrant', 8, 'BURST_FIRST'],
      [null, null, 'BURST_FIRST'],
    ] as const) {
      const state = fixture(); state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      const before = structuredClone(state);
      const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(() => resolveSliceCombatRound(state, 'ATTACK', 'HOLD', choice as MadmanBurstPolicy)).toThrow();
      expect(state).toEqual(before); expect(draws).not.toHaveBeenCalled(); vi.restoreAllMocks();
    }
  });
});

describe('Madman shared round effects, injury, death, retreat and replay', () => {
  it('defaults to HOLD and only the explicit fourth-argument choice pays and boosts H', () => {
    const state = fixture(); state.spirituality = 10;
    const held = structuredClone(state), explicitHold = structuredClone(state), burst = structuredClone(state);
    scriptRolls(1, 1, 1, 400, 1, 1);
    const implicit = resolveSliceCombatRound(held, 'ATTACK'); vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 400, 1, 1);
    expect(resolveSliceCombatRound(explicitHold, 'ATTACK', 'HOLD', 'HOLD')).toEqual(implicit);
    expect(explicitHold).toEqual(held); expect(held.mind).toBe(100); expect(held.spirituality).toBe(14.5);
    expect(implicit.round.madmanBurst).toEqual(policy('HOLD')); vi.restoreAllMocks();
    const draws = scriptRolls(1, 1, 1, 400, 1, 1);
    const selected = resolveSliceCombatRound(burst, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect(selected.round.moves[0]!.selfGain).toBe(27 * 0.65 * (1 + 0.25 * 0.65));
    expect(selected.round.playerAdvantage).toBe(315 * 0.8 + selected.round.moves[0]!.selfGain);
    expect(selected.round.madmanBurst).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
    expect(burst.mind).toBe(90); expect(burst.spirituality).toBe(12.5);
    expect(selected.round.moves).toHaveLength(2); expect(draws).toHaveBeenCalledTimes(6);
  });

  it('triggers on the first eligible H after B, once only, with all five player and three enemy slots retained', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 251, 1, 1, 1, 151, 1, 1, 371, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [0, 17.1 * 0.65], [27 * 0.65 * (1 + 0.25 * 0.65), 0], [18.9 * 0.65, 0], [27 * 0.65, 0], [0, 0],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.enemyAdvantage).toBe(114 + 48 - 17.1 * 0.65);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.mind).toBe(90); expect(state.spirituality).toBe(12.5);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.prisoner).toEqual(before.prisoner); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('keeps short-club burst physical and leaves all ordinary enemy attacks active', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.progression.mastery[sacrifice] = 500;
    const town = structuredClone(state.town), draws = scriptRolls(1, 100, 1, 1, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect(round.moves[0]!.selfGain).toBe(20); expect(round.moves).toHaveLength(4);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(335); expect(state.mind).toBe(90); expect(state.town).toEqual(town);
    expect(draws).toHaveBeenCalledTimes(8);
  });

  it('keeps untriggered choice free with no eligible attack or insufficient resources', () => {
    for (const ticket of [251, 331, 371, 431]) {
      const state = fixture(); state.spirituality = 10;
      const draws = ticket === 431 ? scriptRolls(1, 1, ticket, 2, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(round.madmanBurst).toEqual(policy()); expect(round.consequenceWeights).toBeNull();
      expect(round.consequence).toContain('未支付理智爆发成本');
      expect(outcome).toBe('CONTINUE'); expect(state.mind).toBe(100); expect(state.spirituality).toBe(14.5);
      expect(state.combat!.enemyHealth).toBe(100); expect(draws).toHaveBeenCalledTimes(ticket === 431 ? 6 : 5);
      vi.restoreAllMocks();
    }
    for (const [mind, spirituality] of [[9, 10], [100, 1]] as const) {
      const state = fixture(); state.mind = mind; state.spirituality = spirituality;
      scriptRolls(1, 1, 1, 400, 1, 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(round.moves[0]!.selfGain).toBe(27 * 0.65); expect(round.madmanBurst).toEqual(policy());
      expect(state.mind).toBe(mind); expect(state.spirituality).toBe(spirituality + 4.5); vi.restoreAllMocks();
    }
  });

  it('preserves mental cost through round end and defaults the next round back to HOLD', () => {
    const state = fixture(); state.mind = 10; state.spirituality = 2;
    scriptRolls(1, 1, 1, 400, 1, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect(state.mind).toBe(0); expect(state.spirituality).toBe(4.5); expect(first.round.madmanBurst!.triggered).toBe(true);
    vi.restoreAllMocks();
    // Even rounds execute the real enemy slot first.
    scriptRolls(1, 1, 400, 1, 1, 1);
    const second = resolveSliceCombatRound(state, 'ATTACK');
    expect(second.round.first).toBe('ENEMY'); expect(second.round.madmanBurst).toEqual(policy('HOLD'));
    expect(second.round.moves[1]!.selfGain).toBe(27 * 0.65); expect(state.mind).toBe(0);
    expect(first.round.madmanBurst).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
  });

  it('keeps the shared injury, heavy surrender and enemy death draws after actual H/J attacks', () => {
    for (const [ticket, consequence, outcome, health] of [
      [1, 1, 'CONTINUE', 90], [151, 66, 'ENEMY_SURRENDERED', 70], [1, 96, 'ENEMY_DEAD', 0],
    ] as const) {
      const state = fixture(); state.spirituality = 10;
      const draws = scriptRolls(1, 1, ticket, 400, 1, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyHealth).toBe(health);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(state.mind).toBe(90); expect(state.spirituality).toBe(outcome === 'CONTINUE' ? 12.5 : 8);
      expect(result.round.moves).toHaveLength(2); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('keeps real player injury and death possible, with no protection from checking mental resistance', () => {
    for (const [consequence, health, outcome] of [[1, 30, 'CONTINUE'], [96, 0, 'PLAYER_DEAD']] as const) {
      const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
      state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
      const draws = scriptRolls(1, 1, 371, 1, 1_000_000, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(result.round.moves[1]!.selfGain).toBe(16); expect(result.outcome).toBe(outcome);
      expect(state.health).toBe(health); expect(state.injuryRisk).toBe(2); expect(state.mind).toBe(100);
      expect(result.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
      expect(result.round.madmanBurst).toEqual(policy()); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('does not refund a triggered burst when a real enemy action kills the player', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(1, 1, 1, 1, 1_000_000, 96);
    const result = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(state.mind).toBe(90); expect(state.spirituality).toBe(8); expect(result.round.madmanBurst!.triggered).toBe(true);
  });

  it('never triggers on successful retreat, failed retreat or even-round enemy-first retreat', () => {
    const state = fixture(); state.spirituality = 10; state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT', 'HOLD', 'BURST_FIRST');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]); expect(round.retreat).toBe('SUCCESS');
    expect(round.madmanBurst).toEqual(policy()); expect(round.consequence).toContain('撤退不触发理智爆发');
    expect(state.mind).toBe(100); expect(state.spirituality).toBe(10); expect(state.town).toEqual(town);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    for (const turn of [1, 2]) {
      const failed = fixture(); failed.combat!.round = turn; failed.spirituality = 10;
      const rolls = turn === 1 ? [1, 1, 51, 1, 1_000_000, 1] : [1, 1, 1, 51, 1_000_000, 1];
      const failedDraws = scriptRolls(...rolls);
      const result = resolveSliceCombatRound(failed, 'RETREAT', 'HOLD', 'BURST_FIRST');
      expect(result.round.retreat).toBe('FAILURE'); expect(result.round.moves).toHaveLength(1);
      expect(result.round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
      expect(result.round.madmanBurst).toEqual(policy()); expect(failed.mind).toBe(100);
      expect(failed.health).toBe(90); expect(failed.spirituality).toBe(14.5); expect(failedDraws).toHaveBeenCalledTimes(6);
      vi.restoreAllMocks();
    }
  });

  it('adds no madman record to an unchanged S9 or ordinary round', () => {
    for (const sequence of [9, null]) {
      const state = fixture(); state.progression.sequence = sequence;
      state.progression.pathwayId = sequence === 9 ? 'chained' : null;
      // ATTACK R for Prisoner; ordinary MISS for the unpowered profile.
      scriptRolls(1, 1, sequence === 9 ? 371 : 440, 400, 1);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.round.madmanBurst).toBeUndefined(); expect(state.lastCombatRound!.madmanBurst).toBeUndefined();
      vi.restoreAllMocks();
    }
  });

  it('replays serialized state, original gear, exact burst choice and cursor without global randomness', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    state.spirituality = 10; state.mind = 35;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL', 'HOLD', 'BURST_FIRST'))
      .toEqual(resolveSliceCombatRound(restored, 'CONTROL', 'HOLD', 'BURST_FIRST'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled(); expect(state.town.clubLocation).toBe('HAND');
  });
});
