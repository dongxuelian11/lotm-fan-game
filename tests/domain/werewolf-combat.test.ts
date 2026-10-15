import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { WEREWOLF_COUNT_WHEEL, currentWerewolfCombatSource, drawWerewolfAbility, isWerewolf,
  werewolfAbilityWheel, werewolfActionCount, resolveWerewolfCombatAbility,
  type WerewolfCombatSource, type WerewolfMoveId, type WerewolfRoundContext,
} from '../../src/domain/werewolf/combat.js';
import * as werewolfCombat from '../../src/domain/werewolf/combat.js';
import { MADMAN_COUNT_WHEEL, currentMadmanCombatSource, isMadman, madmanAbilityWheel,
  type MadmanBurstPolicy, type MadmanRoundPolicy,
} from '../../src/domain/madman/combat.js';
import { PRISONER_COUNT_WHEEL, prisonerAbilityWheel } from '../../src/domain/prisoner/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const body = 'chained.s7.werewolf-body', regeneration = 'chained.s7.regeneration';
const perception = 'chained.s9.keen-perception', sacrifice = 'chained.s8.reason-sacrifice';
const ids = [body, 'BODY_FOLLOWUP', perception, 'POSITION', regeneration, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('werewolf-combat-test', sliceDefaultCreationSelection, 'werewolf-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'chained', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function policy(choice: MadmanBurstPolicy = 'BURST_FIRST'): MadmanRoundPolicy {
  return { policy: choice, triggered: false, mentalCost: 0, spiritualCost: 0 };
}
function resolve(state: SliceState, id: WerewolfMoveId, context: WerewolfRoundContext = { regenUsed: false },
  choice = policy('HOLD'), physical = 1, source = currentWerewolfCombatSource(state)) {
  return resolveWerewolfCombatAbility(state, id, physical, stream(state), context, choice, source);
}
/** Select actual tickets while retaining production cursor and range checks. */
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

describe('Werewolf S7 exact G profile and strict dispatch', () => {
  it('uses independent 10/15/25/30/20 counts and 30/20/20/10/15/5 slots', () => {
    const state = fixture();
    expect(isWerewolf(state)).toBe(true); expect(isMadman(state)).toBe(false);
    expect(currentMadmanCombatSource(state)).toBeNull();
    expect(playerAbilityWheel(state, null)).toEqual(werewolfAbilityWheel(null, state));
    expect(werewolfAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(werewolfAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(WEREWOLF_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 25, 30, 20]);
    const wheel = playerAbilityWheel(state, null), count = playerCountWheel(state);
    wheel[0]!.weight = 0; count[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(WEREWOLF_COUNT_WHEEL)).toBe(true);
    expect(WEREWOLF_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
  });

  it('retains exact normalized stance tickets and each neutral and stance boundary', () => {
    for (const [stance, weights] of [
      [null, [120, 80, 80, 40, 60, 20]],
      ['ATTACK', [150, 100, 80, 40, 60, 20]],
      ['DEFEND', [120, 80, 100, 40, 60, 20]],
      ['CONTROL', [120, 80, 80, 50, 60, 20]],
      ['PREPARE', [120, 80, 80, 40, 75, 20]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(werewolfAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => sum === 400 ? n / 4 : n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawWerewolfAbility(random, stance)).toBe(ids[index]);
        expect(drawWerewolfAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(werewolfAbilityWheel('RETREAT')).toEqual(werewolfAbilityWheel(null));
  });

  it('dispatches every count boundary without extra recovery, burst or enemy slots', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3],
      [51, 4], [80, 4], [81, 5], [100, 5]] as const) {
      expect(werewolfActionCount(roll)).toBe(count);
      const state = fixture(), cursor = state.random.cursor;
      const draws = scriptRolls(roll, 1, 371, 400, ...Array<number>(count - 1).fill(371), 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(round.playerCount).toBe(count); expect(round.enemyCount).toBe(1);
      expect(round.moves).toHaveLength(count + 1); expect(round.madmanBurst).toEqual(policy());
      expect(state.health).toBe(100); expect(state.mind).toBe(100); expect(state.spirituality).toBe(60);
      expect(draws).toHaveBeenCalledTimes(count + 4); expect(state.random.cursor).toBe(cursor + count + 4);
      vi.restoreAllMocks();
    }
  });

  it('uses core35/35/15/15, tier450, cap90, floor45 and max60 with recovery6', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(471 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(6);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.progression).toEqual(before.progression); expect(state.world).toEqual(before.world);
    vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(6); expect(capped.health).toBe(50); vi.restoreAllMocks();
    vi.spyOn(werewolfCombat, 'resolveWerewolfCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('keeps earlier profiles and unimplemented S1 separate', () => {
    const state = fixture(); state.progression.sequence = 8;
    expect(currentWerewolfCombatSource(state)).toBeNull(); expect(isMadman(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(MADMAN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(madmanAbilityWheel('CONTROL', state));
    state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(PRISONER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(prisonerAbilityWheel('CONTROL', state));
    state.progression.sequence = 1;
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
  });
});

describe('Werewolf physical budgets and inherited single-action sacrifice', () => {
  it('uses exact54f/37.8f/36f/6 budgets, separate mastery and no toxic-claw bonus', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [body]: mastery, [perception]: mastery,
        'chained.s9.prisoner-body': 500, 'chained.s7.toxic-claws': 500, 'chained.s8.mental-resistance': 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveWerewolfCombatAbility(state, body, 0.8, random)).toMatchObject({ selfGain: 54 * factor * 0.8, threatens: true });
      expect(resolveWerewolfCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random).selfGain).toBe(37.8 * factor * 0.8);
      expect(resolveWerewolfCombatAbility(state, perception, 0.8, random).enemyReduction).toBe(36 * factor * 0.8);
      expect(resolveWerewolfCombatAbility(state, 'POSITION', 0.8, random).enemyReduction).toBe(6 * 0.8);
      expect(resolve(state, body).label).toContain('实际伤害由共同伤势盘结算');
      expect(resolve(state, body).label).toContain('不自动结算毒素、麻痹或转化');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const separate = fixture(); separate.progression.mastery = { [body]: 500, [perception]: 0 };
    expect(resolve(separate, body).selfGain).toBe(54);
    expect(resolve(separate, perception).enemyReduction).toBe(36 * 0.65);
  });

  it('bounds malformed mastery and physical factors without paying for zero contribution', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery = { [body]: mastery, [perception]: mastery };
      const factor = mastery === 800 ? 1 : 0.65;
      expect(resolve(state, body).selfGain).toBe(54 * factor);
      expect(resolve(state, perception).enemyReduction).toBe(36 * factor);
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(), before = structuredClone(state), choice = policy();
      for (const id of [body, 'BODY_FOLLOWUP', perception, 'POSITION'] as const) {
        expect(resolve(state, id, { regenUsed: false }, choice, physical))
          .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(choice).toEqual(policy()); expect(state).toEqual(before);
    }
    expect(resolve(fixture(), body, { regenUsed: false }, policy('HOLD'), 3).selfGain).toBe(54 * 0.65);
  });

  it('pays inherited10 mental and2S once for the first eligible H/J only', () => {
    for (const first of [body, 'BODY_FOLLOWUP'] as const) for (const mastery of [0, 250, 500]) {
      const state = fixture(); state.spirituality = 10; state.progression.mastery[sacrifice] = mastery;
      const choice = policy(), context = { regenUsed: false }, f = 0.65 + 0.35 * mastery / 500;
      const before = structuredClone(state);
      for (const id of [perception, 'POSITION', regeneration] as const) resolve(state, id, context, choice);
      expect(choice.triggered).toBe(false);
      expect(resolve(state, first, context, choice, 0.8).selfGain)
        .toBe((first === body ? 54 : 37.8) * 0.65 * 0.8 * (1 + 0.25 * f));
      expect(choice).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
      expect(resolve(state, body, context, choice).selfGain).toBe(54 * 0.65);
      expect(resolve(state, 'BODY_FOLLOWUP', context, choice).selfGain).toBe(37.8 * 0.65);
      before.mind -= 10; before.spirituality -= 2;
      expect(state).toEqual(before); expect(context.regenUsed).toBe(false);
    }
  });

  it('falls back to ordinary physical attacks when either burst resource is insufficient', () => {
    for (const [mind, spirituality] of [[9, 60], [100, 1.99], [0, 0], [Number.NaN, 60], [100, Number.POSITIVE_INFINITY]]) {
      const state = fixture(); state.mind = mind!; state.spirituality = spirituality!;
      const before = structuredClone(state), choice = policy();
      expect(resolve(state, body, { regenUsed: false }, choice).selfGain).toBe(54 * 0.65);
      expect(choice).toEqual(policy()); expect(state).toEqual(before);
    }
    const state = fixture(); state.mind = 10; state.spirituality = 2; const choice = policy();
    resolve(state, body, { regenUsed: false }, choice);
    expect(state.mind).toBe(0); expect(state.spirituality).toBe(0); expect(choice.triggered).toBe(true);
  });

  it('only actual HAND club16 replaces H and preserves original custody and borrowed props', () => {
    for (const mastery of [0, 500]) for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery[body] = mastery; state.progression.mastery[sacrifice] = 500;
      state.prisoner.cases['jammed-shutter']!.holding = true;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state);
      const source = { ...currentWerewolfCombatSource(state)!, heldTool: 'town-short-club', toolReady: true };
      expect(resolve(state, body, { regenUsed: false }, policy('HOLD'), 1, source).selfGain)
        .toBe(location === 'HAND' ? 16 : 54 * factor);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(37.8 * factor);
      expect(playerAbilityWheel(state, null)[0]!.label)
        .toBe(location === 'HAND' ? '持握原短棍打击' : '狼人身体与毒爪威胁');
      expect(resolve(state, body, { regenUsed: false }, policy()).selfGain)
        .toBe((location === 'HAND' ? 16 : 54 * factor) * 1.25);
      before.mind -= 10; before.spirituality -= 2; expect(state).toEqual(before);
    }
  });

  it('draws ±11.25 accident once without poison, costs, injury or mastery', () => {
    for (const [roll, contribution] of [[1, -11.25], [2, 11.25]] as const) {
      const state = fixture(), before = structuredClone(state), choice = policy(), context = { regenUsed: false };
      const draws = scriptRolls(roll), random = stream(state);
      expect(resolveWerewolfCombatAbility(state, 'ACCIDENT', 1, random, context, choice))
        .toMatchObject({ selfGain: contribution, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(choice).toEqual(policy()); expect(context.regenUsed).toBe(false);
      expect(draws).toHaveBeenCalledTimes(1); expect(random.cursor).toBe(1); vi.restoreAllMocks();
    }
  });
});

describe('Werewolf limited paid recovery and live source guards', () => {
  it('restores floor10f for3S once per real round and preserves injuries and death risk', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.health = 40; state.spirituality = 3; state.injuryRisk = 4;
      state.injuries = [{ id: 'old-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
      state.progression.mastery[regeneration] = mastery;
      const before = structuredClone(state), context = { regenUsed: false }, choice = policy();
      const recovered = Math.floor(10 * (0.65 + 0.35 * mastery / 500));
      const effect = resolve(state, regeneration, context, choice, 0);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain(`实际恢复${recovered}健康`);
      before.health += recovered; before.spirituality -= 3; expect(state).toEqual(before);
      expect(context.regenUsed).toBe(true); expect(choice).toEqual(policy());
      state.spirituality = 60; const after = structuredClone(state);
      expect(resolve(state, regeneration, context, choice).label).toContain('本轮已经实际恢复一次');
      expect(state).toEqual(after);
    }
  });

  it('caps actual recovery at100, charges nothing at full health or insufficientS, and never revives', () => {
    for (const [health, spirituality, expectedHealth, expectedS, used] of [
      [99, 3, 100, 0, true], [95, 10, 100, 7, true], [100, 60, 100, 60, false],
      [70, 2.99, 70, 2.99, false], [70, 0, 70, 0, false], [0, 60, 0, 60, false],
    ] as const) {
      const state = fixture(); state.health = health; state.spirituality = spirituality;
      const context = { regenUsed: false }; resolve(state, regeneration, context);
      expect(state.health).toBe(expectedHealth); expect(state.spirituality).toBe(expectedS);
      expect(context.regenUsed).toBe(used);
    }
    const state = fixture(); state.status = 'DEAD'; state.health = 20;
    const before = structuredClone(state); resolve(state, regeneration); expect(state).toEqual(before);
  });

  it('rejects stale, missing or forged scene evidence before draws and either payment', () => {
    const state = fixture(); state.health = 40; const source = currentWerewolfCombatSource(state)!;
    expect(source).toEqual({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    const invalid: (WerewolfCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as WerewolfCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state), choice = policy(), context = { regenUsed: false };
      for (const id of ids) expect(resolveWerewolfCombatAbility(state, id, 1, random, context, choice, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(choice).toEqual(policy());
      expect(context.regenUsed).toBe(false);
    }
  });

  it('rejects ended, dead, absent, wrong-sequence or unrelated encounters', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.progression.sequence = 6; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      const context = { regenUsed: false }, choice = policy(); expect(currentWerewolfCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveWerewolfCombatAbility(state, id, 1, random, context, choice))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(choice).toEqual(policy());
      expect(context.regenUsed).toBe(false);
    }
  });
});

describe('Werewolf shared rounds, risk, resources, retreat and replay', () => {
  it('defaults to HOLD and only the fourth-argument choice pays the inherited cost', () => {
    const state = fixture(); state.spirituality = 10;
    const held = structuredClone(state), explicitHold = structuredClone(state), burst = structuredClone(state);
    scriptRolls(1, 1, 1, 400, 1, 1);
    const implicit = resolveSliceCombatRound(held, 'ATTACK'); vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 400, 1, 1);
    expect(resolveSliceCombatRound(explicitHold, 'ATTACK', 'HOLD', 'HOLD')).toEqual(implicit);
    expect(explicitHold).toEqual(held); expect(held.mind).toBe(100); expect(held.spirituality).toBe(16);
    expect(implicit.round.madmanBurst).toEqual(policy('HOLD')); vi.restoreAllMocks();
    const draws = scriptRolls(1, 1, 1, 400, 1, 1);
    const selected = resolveSliceCombatRound(burst, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect(selected.round.moves[0]!.selfGain).toBe(54 * 0.65 * (1 + 0.25 * 0.65));
    expect(selected.round.playerAdvantage).toBe(465 * 0.8 + selected.round.moves[0]!.selfGain);
    expect(selected.round.madmanBurst).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
    expect(burst.mind).toBe(90); expect(burst.spirituality).toBe(14);
    expect(selected.round.moves).toHaveLength(2); expect(draws).toHaveBeenCalledTimes(6);
  });

  it('rejects invalid or wrong-path policies before mutation and random draws', () => {
    for (const [pathwayId, sequence, choice] of [
      ['chained', 7, 'UNKNOWN'], ['chained', 9, 'BURST_FIRST'], ['chained', 5, 'BURST_FIRST'],
      ['hunter', 7, 'BURST_FIRST'], ['tyrant', 8, 'BURST_FIRST'], [null, null, 'BURST_FIRST'],
    ] as const) {
      const state = fixture(); state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      const before = structuredClone(state), draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(() => resolveSliceCombatRound(state, 'ATTACK', 'HOLD', choice as MadmanBurstPolicy)).toThrow();
      expect(state).toEqual(before); expect(draws).not.toHaveBeenCalled(); vi.restoreAllMocks();
    }
  });

  it('keeps all five player and three real enemy slots, with one paid burst after B', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 251, 1, 1, 1, 151, 1, 1, 371, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [0, 36 * 0.65], [54 * 0.65 * (1 + 0.25 * 0.65), 0], [37.8 * 0.65, 0], [54 * 0.65, 0], [0, 0],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.enemyAdvantage).toBe(114 + 48 - 36 * 0.65);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.mind).toBe(90); expect(state.spirituality).toBe(14);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.prisoner).toEqual(before.prisoner); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('charges regeneration once across repeated R slots and resets only for a new round', () => {
    const state = fixture(); state.health = 40; state.spirituality = 10;
    const before = structuredClone(state);
    scriptRolls(100, 100, 371, 400, 371, 400, 371, 400, 371, 371, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect(state.health).toBe(46); expect(state.spirituality).toBe(13); expect(state.mind).toBe(100);
    expect(first.round.madmanBurst).toEqual(policy()); expect(first.round.moves).toHaveLength(8);
    expect(first.round.moves.filter(move => move.label.includes('本轮已经实际恢复一次'))).toHaveLength(4);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(Object.keys(state).sort()).toEqual(Object.keys(before).sort()); vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 371, 1);
    const second = resolveSliceCombatRound(state, 'ATTACK');
    expect(second.round.first).toBe('ENEMY'); expect(state.health).toBe(52); expect(state.spirituality).toBe(16);
    expect(second.round.madmanBurst).toEqual(policy('HOLD'));
  });

  it('shares actual spirituality in action order, without prepaying recovery or burst', () => {
    for (const recoveryFirst of [true, false]) {
      const state = fixture(); state.health = 70; state.spirituality = 4;
      scriptRolls(11, 1, recoveryFirst ? 371 : 1, 400, recoveryFirst ? 1 : 371, 1, 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(state.health).toBe(recoveryFirst ? 76 : 70);
      expect(state.spirituality).toBe(recoveryFirst ? 7 : 8);
      expect(state.mind).toBe(recoveryFirst ? 100 : 90);
      expect(round.madmanBurst!.triggered).toBe(!recoveryFirst);
      expect(round.moves[recoveryFirst ? 2 : 0]!.selfGain)
        .toBe(recoveryFirst ? 54 * 0.65 : 54 * 0.65 * 0.95 * (1 + 0.25 * 0.65));
      vi.restoreAllMocks();
    }
  });

  it('uses the common wound table after claw threats, including surrender and real death', () => {
    for (const [ticket, consequence, outcome, health] of [
      [1, 1, 'CONTINUE', 90], [151, 66, 'ENEMY_SURRENDERED', 70], [1, 96, 'ENEMY_DEAD', 0],
    ] as const) {
      const state = fixture(); state.spirituality = 10;
      const draws = scriptRolls(1, 1, ticket, 400, 1, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyHealth).toBe(health);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(state.mind).toBe(90); expect(state.spirituality).toBe(outcome === 'CONTINUE' ? 14 : 8);
      expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('retains injury risk and possible player death even after successful recovery', () => {
    for (const [consequence, health, outcome] of [[1, 36, 'CONTINUE'], [96, 0, 'PLAYER_DEAD']] as const) {
      const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
      state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
      const originalInjury = structuredClone(state.injuries[0]);
      const draws = scriptRolls(1, 1, 371, 1, 1_000_000, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
      expect(result.round.moves[1]!.selfGain).toBe(16); expect(result.outcome).toBe(outcome);
      expect(state.health).toBe(health); expect(state.injuryRisk).toBe(2); expect(state.injuries[0]).toEqual(originalInjury);
      expect(state.spirituality).toBe(outcome === 'CONTINUE' ? 8 : 2); expect(state.mind).toBe(100);
      expect(result.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
      expect(result.round.madmanBurst).toEqual(policy()); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('never refunds a paid burst on death or turns a missed claw opportunity into poison', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(1, 1, 1, 1, 1_000_000, 96);
    expect(resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST').outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0); expect(state.combat!.enemyHealth).toBe(100);
    expect(state.mind).toBe(90); expect(state.spirituality).toBe(8);
  });

  it('never heals or bursts on successful retreat or either failed-retreat turn order', () => {
    const state = fixture(); state.health = 70; state.spirituality = 10;
    state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT', 'HOLD', 'BURST_FIRST');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]); expect(round.retreat).toBe('SUCCESS');
    expect(round.madmanBurst).toEqual(policy()); expect(round.consequence).toContain('撤退不触发理智爆发');
    expect(state.health).toBe(70); expect(state.mind).toBe(100); expect(state.spirituality).toBe(10);
    expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    for (const turn of [1, 2]) {
      const failed = fixture(); failed.combat!.round = turn; failed.spirituality = 10;
      const rolls = turn === 1 ? [1, 1, 51, 1, 1_000_000, 1] : [1, 1, 1, 51, 1_000_000, 1];
      const failedDraws = scriptRolls(...rolls);
      const result = resolveSliceCombatRound(failed, 'RETREAT', 'HOLD', 'BURST_FIRST');
      expect(result.round.retreat).toBe('FAILURE'); expect(result.round.moves).toHaveLength(1);
      expect(result.round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
      expect(result.round.madmanBurst).toEqual(policy()); expect(failed.mind).toBe(100);
      expect(failed.health).toBe(90); expect(failed.spirituality).toBe(16);
      expect(failedDraws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('replays serialized injuries, gear, resources, choices and cursor without global randomness', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7;
    state.health = 70; state.spirituality = 10; state.mind = 35; state.injuryRisk = 2;
    state.injuries = [{ id: 'old', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }];
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'PREPARE', 'HOLD', 'BURST_FIRST'))
      .toEqual(resolveSliceCombatRound(restored, 'PREPARE', 'HOLD', 'BURST_FIRST'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled(); expect(state.town.clubLocation).toBe('HAND');
  });
});
