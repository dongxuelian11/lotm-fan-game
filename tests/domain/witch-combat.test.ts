import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { WITCH_COUNT_WHEEL, drawWitchAbility, isWitch, resolveWitchCombatAbility,
  witchAbilityWheel, witchActionCount, type WitchMoveId } from '../../src/domain/witch/combat.js';
import * as witchCombat from '../../src/domain/witch/combat.js';
import { ASSASSIN_COUNT_WHEEL, assassinAbilityWheel, resolveAssassinCombatAbility } from '../../src/domain/assassin/combat.js';
import { INSTIGATOR_COUNT_WHEEL, instigatorAbilityWheel, resolveInstigatorCombatAbility } from '../../src/domain/instigator/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const flame = 'assassin.s7.black-flame', burst = 'assassin.s9.burst';
const substitute = 'assassin.s7.substitute', invisibility = 'assassin.s7.invisibility';
const frost = 'assassin.s7.frost', interference = 'assassin.s7.divination-interference';
const ids = [flame, burst, substitute, frost, interference, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('witch-combat-test', sliceDefaultCreationSelection, 'witch-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'demoness', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.witch.tools = { kitsBought: 1, powderHeld: 3, powderUsed: 0,
    mirrorsHeld: 1, mirrorsUsed: 0, lastPurchaseWeek: state.week, mirrorPrepared: false };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: WitchMoveId, physical = 1) {
  return resolveWitchCombatAbility(state, id, physical, stream(state));
}
/** Script decisions while retaining production cursor advancement. */
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
function expectToolBalance(state: SliceState) {
  const tools = state.witch.tools;
  expect(tools.powderHeld + tools.powderUsed).toBe(tools.kitsBought * 3);
  expect(tools.mirrorsHeld + tools.mirrorsUsed).toBe(tools.kitsBought);
}
afterEach(() => vi.restoreAllMocks());

describe('Witch S7 exact profile and inherited sequence isolation', () => {
  it('uses30/15/25/15/10/5 slots and independent10/15/25/30/20 counts', () => {
    const state = fixture();
    expect(isWitch(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(witchAbilityWheel(null, state));
    expect(witchAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(witchAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 15, 25, 15, 10, 5]);
    expect(playerCountWheel(state)).toEqual(WITCH_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 25, 30, 20]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('keeps each count boundary and consumes one draw per ability slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3],
      [51, 4], [80, 4], [81, 5], [100, 5]]) expect(witchActionCount(roll!)).toBe(count);
    let boundary = 0;
    for (const entry of witchAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawWitchAbility(random, null)).toBe(entry.id);
      expect(drawWitchAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes the exact ×1.25 stance ticket ratios without extra slots', () => {
    for (const [stance, weights] of [
      ['ATTACK', [150, 75, 100, 60, 40, 20]],
      ['DEFEND', [120, 60, 125, 60, 40, 20]],
      ['CONTROL', [120, 60, 100, 75, 40, 20]],
      ['PREPARE', [120, 60, 100, 60, 50, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, n) => sum + n, 0);
      expect(witchAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index++) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawWitchAbility(random, stance)).toBe(ids[index]);
        expect(drawWitchAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    expect(witchAbilityWheel('RETREAT')).toEqual(witchAbilityWheel(null));
  });

  it('uses core20/15/30/35, base450, max60 and one continuing-round recovery', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 386, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(478 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(6);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.weeklyBudget).toBe(before.weeklyBudget); expect(state.progression).toEqual(before.progression);
    expect(state.world).toEqual(before.world); expect(state.town).toEqual(before.town);
    expect(state.witch).toEqual(before.witch);
  });

  it('caps the core at90, total status penalty at40 percent and recovery at60', () => {
    const state = fixture(); state.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    state.health = 50; state.mind = 25; state.spirituality = 3;
    scriptRolls(1, 1, 386, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(state.spirituality).toBe(9); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 59;
    scriptRolls(1, 1, 386, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(60);
  });

  it('retains the S7 advantage floor45', () => {
    vi.spyOn(witchCombat, 'resolveWitchCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 386, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('keeps S9/S8 budgets separate and does not unlock S6/S5 or unrelated magic', () => {
    const state = fixture(); state.progression.sequence = 9;
    expect(isWitch(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(ASSASSIN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(assassinAbilityWheel(null, state));
    expect(resolveAssassinCombatAbility(state, burst, 1, stream(state)).selfGain).toBe(16 * 0.65);
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(INSTIGATOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(instigatorAbilityWheel(null, state));
    expect(resolveInstigatorCombatAbility(state, burst, 1, stream(state)).selfGain).toBe(27 * 0.65);
    for (const [pathwayId, sequence] of [[null, null], ['demoness', 1], ['moon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isWitch(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    expect(ids.join(' ')).not.toMatch(/s6|s5|disease|silk|charm|curse/);
  });
});

describe('Witch finite spell budgets, real consumables and source boundaries', () => {
  it('uses45f/31.5f/54f/37.8f, physical factor only for inherited burst, and exact spell costs', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.witch.tools.mirrorPrepared = true;
      state.progression.mastery = { [flame]: mastery, [burst]: mastery, [substitute]: mastery,
        [invisibility]: mastery, [frost]: mastery, [interference]: mastery };
      const f = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveWitchCombatAbility(state, flame, 0.8, random)).toMatchObject({
        selfGain: 45 * f, enemyReduction: 0, threatens: true,
      });
      expect(resolveWitchCombatAbility(state, burst, 0.8, random)).toMatchObject({
        selfGain: 31.5 * f * 0.8, enemyReduction: 0, threatens: true,
      });
      expect(resolveWitchCombatAbility(state, substitute, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 54 * f, threatens: false,
      });
      expect(resolveWitchCombatAbility(state, frost, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 37.8 * f, threatens: false,
      });
      expect(resolveWitchCombatAbility(state, interference, 0.8, random)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      before.spirituality -= 8;
      before.witch.tools.mirrorsHeld -= 1; before.witch.tools.mirrorsUsed += 1;
      before.witch.tools.mirrorPrepared = false;
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expectToolBalance(state);
    }
  });

  it('uses each own mastery, preserves the four Assassin and one Instigator values, and gives no black-magic bonus', () => {
    const state = fixture(); state.witch.tools.mirrorPrepared = true;
    state.progression.mastery = { [flame]: 500, [burst]: 300, [substitute]: 100, [invisibility]: 400, [frost]: 0,
      [interference]: 500, 'assassin.s7.black-magic': 500,
      'assassin.s9.lightness': 275, 'assassin.s9.vision': 150, 'assassin.s9.shadow': 75, 'assassin.s8.instigation': 320 };
    const oldMastery = structuredClone(state.progression.mastery);
    expect(resolve(state, flame).selfGain).toBe(45);
    expect(resolve(state, burst).selfGain).toBe(31.5 * (0.65 + 0.35 * 300 / 500));
    expect(resolve(state, substitute).enemyReduction).toBe(54 * (0.65 + 0.35 * 100 / 500));
    expect(resolve(state, substitute).enemyReduction).toBe(27 * (0.65 + 0.35 * 400 / 500));
    expect(resolve(state, frost).enemyReduction).toBe(37.8 * 0.65);
    expect(resolve(state, interference).enemyReduction).toBe(0);
    expect(state.progression.mastery).toEqual(oldMastery);
  });

  it('spends the armed original mirror once, then original powder, then falls back without creating inventory', () => {
    const state = fixture(); state.witch.tools.mirrorPrepared = true;
    state.progression.mastery[substitute] = 500; state.progression.mastery[invisibility] = 500;
    expect(playerAbilityWheel(state, null)[2]!.label).toContain('3灵性＋1面原镜');
    expect(resolve(state, substitute).enemyReduction).toBe(54);
    expect(state.witch.tools).toMatchObject({ mirrorsHeld: 0, mirrorsUsed: 1, mirrorPrepared: false, powderHeld: 3 });
    for (let dose = 1; dose <= 3; dose++) {
      expect(playerAbilityWheel(state, null)[2]!.label).toContain('2灵性＋1剂原粉');
      expect(resolve(state, substitute).enemyReduction).toBe(27);
      expect(state.witch.tools.powderHeld).toBe(3 - dose); expect(state.witch.tools.powderUsed).toBe(dose);
      expectToolBalance(state);
    }
    expect(state.spirituality).toBe(51);
    const exhausted = structuredClone(state);
    expect(playerAbilityWheel(state, null)[2]!.label).toContain('普通避让（0灵性');
    expect(resolve(state, substitute, 0.8).enemyReduction).toBe(8);
    expect(state).toEqual(exhausted);
  });

  it('never treats mere possession, a practice note or an invented medium as an armed mirror', () => {
    const state = fixture();
    state.knowledge.push({ id: 'old-mirror-note', week: state.week, title: '别处的镜替练习记录',
      text: 'mirrorPrepared=true；已有血媒介的旧记录并不等于本场持有原物' });
    const before = structuredClone(state);
    expect(resolve(state, substitute).enemyReduction).toBe(27 * 0.65);
    before.spirituality -= 2; before.witch.tools.powderHeld -= 1; before.witch.tools.powderUsed += 1;
    expect(state).toEqual(before); expect(state.witch.tools.mirrorPrepared).toBe(false);
    expect(state.witch.tools.mirrorsHeld).toBe(1); expectToolBalance(state);
  });

  it('preserves a prepared mirror when3S is unavailable and uses only a payable real powder dose', () => {
    for (const spirituality of [0, 1, 1.5, 2, 2.5]) {
      const state = fixture(); state.witch.tools.mirrorPrepared = true; state.spirituality = spirituality;
      const effect = resolve(state, substitute, 0.8);
      expect(effect.enemyReduction).toBe(spirituality >= 2 ? 27 * 0.65 : 8);
      expect(state.spirituality).toBe(spirituality >= 2 ? spirituality - 2 : spirituality);
      expect(state.witch.tools).toMatchObject({ mirrorPrepared: true, mirrorsHeld: 1, mirrorsUsed: 0,
        powderHeld: spirituality >= 2 ? 2 : 3, powderUsed: spirituality >= 2 ? 1 : 0 });
      expectToolBalance(state);
    }
    const noPowder = fixture(); noPowder.witch.tools.mirrorPrepared = true; noPowder.spirituality = 2;
    noPowder.witch.tools.powderHeld = 0; noPowder.witch.tools.powderUsed = 3;
    const before = structuredClone(noPowder);
    expect(resolve(noPowder, substitute, 0.8).enemyReduction).toBe(8);
    expect(noPowder).toEqual(before);
  });

  it('rejects missing, fractional or nonfinite held consumables without inventing doses', () => {
    for (const held of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.witch.tools.mirrorPrepared = true;
      state.witch.tools.mirrorsHeld = held; state.witch.tools.powderHeld = held;
      const before = structuredClone(state);
      expect(resolve(state, substitute, 0.8)).toMatchObject({ enemyReduction: 8, selfGain: 0, threatens: false });
      expect(state).toEqual(before);
    }
  });

  it('uses finite ordinary fallbacks and charges nothing until full spirituality is available', () => {
    for (const id of [flame, burst, frost] as const) {
      const cost = id === burst ? 1 : 2;
      for (const spirituality of [0, cost - 0.5, cost, cost + 0.5]) {
        const state = fixture(); state.spirituality = spirituality;
        const before = structuredClone(state), effect = resolve(state, id, 0.8);
        const f = 0.65;
        if (id === frost) expect(effect).toMatchObject({ selfGain: 0,
          enemyReduction: spirituality >= cost ? 37.8 * f : 6 * 0.8, threatens: false });
        else expect(effect).toMatchObject({ enemyReduction: 0, threatens: true,
          selfGain: spirituality >= cost ? id === flame ? 45 * f : 31.5 * f * 0.8 : 12 * 0.8 });
        if (spirituality >= cost) before.spirituality -= cost;
        expect(state).toEqual(before);
      }
    }
    for (const spirituality of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = spirituality;
      const before = structuredClone(state);
      expect(resolve(state, flame, 0.8).selfGain).toBe(12 * 0.8);
      expect(resolve(state, burst, 0.8).selfGain).toBe(12 * 0.8);
      expect(resolve(state, frost, 0.8).enemyReduction).toBe(6 * 0.8);
      expect(resolve(state, substitute, 0.8).enemyReduction).toBe(8);
      expect(state).toEqual(before);
    }
  });

  it('lets the actual town club replace only H with ordinary16 and0S, without stealing or stacking', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.progression.mastery[flame] = 500;
    state.progression.mastery[burst] = 500;
    const before = structuredClone(state);
    expect(playerAbilityWheel(state, null)[0]!.label).toContain('普通16替换黑焰');
    expect(resolve(state, flame, 0.8).selfGain).toBe(16 * 0.8); expect(state).toEqual(before);
    expect(resolve(state, burst, 0.8).selfGain).toBe(31.5 * 0.8);
    before.spirituality -= 1; expect(state).toEqual(before);
    state.town.clubLocation = 'BAG';
    expect(resolve(state, flame, 0.8).selfGain).toBe(45);
    expect(state.town.clubLocation).toBe('BAG');
  });

  it('clamps malformed masteries and physical factors without granting extra contribution', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[flame] = mastery;
      expect(resolve(state, flame).selfGain).toBe(45 * (mastery === 800 ? 1 : 0.65));
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture();
      expect(resolve(state, burst, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      state.spirituality = 0;
      expect(resolve(state, flame, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(resolve(state, substitute, physical).enemyReduction).toBe(0);
      expect(resolve(state, frost, physical).enemyReduction).toBe(0);
    }
    const state = fixture(); state.progression.mastery[burst] = 500;
    expect(resolve(state, burst, 3).selfGain).toBe(31.5);
  });

  it('permits direct near black flame without a blood medium but never fabricates remote curse or divination', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    const flameEffect = resolveWitchCombatAbility(state, flame, 1, random);
    expect(flameEffect.selfGain).toBe(45 * 0.65); expect(flameEffect.label).toContain('近距离黑焰');
    expect(flameEffect.label).toContain('没有生成血液媒介');
    const noSource = resolveWitchCombatAbility(state, interference, 1, random);
    expect(noSource).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(noSource.label).toContain('没有合法干扰目标');
    before.spirituality -= 2;
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('rejects every slot outside the actual live resisting FIRST_CASE opponent before spending or drawing', () => {
    const invalid: ((state: SliceState) => void)[] = [
      state => { state.progression.sequence = 8; },
      state => { state.progression.pathwayId = 'hunter'; },
      state => { state.status = 'DEAD'; }, state => { state.status = 'SLICE_COMPLETE'; },
      state => { state.health = 0; }, state => { state.health = Number.NaN; },
      state => { state.world.city = 'ELSEWHERE'; }, state => { state.arc.stage = 'ENDED'; },
      state => { state.combat = null; }, state => { state.combat!.enemyHealth = 0; },
      state => { state.combat!.enemyHealth = Number.NaN; },
      state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.encounterId = 'HUNTER_CARGO'; },
      state => { state.world.carrierAlive = false; }, state => { state.world.carrierCanResist = false; },
      state => { state.combat!.round = 0; },
    ];
    for (const mutate of invalid) {
      const state = fixture(); state.witch.tools.mirrorPrepared = true; mutate(state);
      const before = structuredClone(state), random = stream(state);
      for (const id of ids) expect(resolveWitchCombatAbility(state, id, 1, random)).toMatchObject({
        selfGain: 0, enemyReduction: 0, threatens: false,
      });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Witch ordinary first-case consequences and replay', () => {
  it('keeps R and both accidents nonthreatening and consumes only the authored accident sign draw', () => {
    for (const [ticket, accident] of [[386, null], [426, 1], [426, 2]] as const) {
      const state = fixture(), before = structuredClone(state);
      const draws = accident === null ? scriptRolls(1, 1, ticket, 400, 1)
        : scriptRolls(1, 1, ticket, accident, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(accident === null ? 0 : accident === 1 ? -11.25 : 11.25);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(before.town); expect(state.witch).toEqual(before.witch);
      expect(draws).toHaveBeenCalledTimes(accident === null ? 5 : 6); vi.restoreAllMocks();
    }
  });

  it('H and J still require shared consequence draws and can produce heavy injury and surrender', () => {
    for (const ticket of [1, 151]) {
      const state = fixture(); scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves).toHaveLength(2);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(round.consequence).toContain('携铃者仍然活着'); expect(state.spirituality).toBe(ticket === 1 ? 58 : 59);
      vi.restoreAllMocks();
    }
  });

  it('B and K are common reductions and neither skips the three real enemy actions nor undoes injury', () => {
    for (const ticket of [226, 326]) {
      const state = fixture(); state.witch.tools.mirrorPrepared = true; state.spirituality = 10;
      scriptRolls(1, 100, ticket, 1, 1, 1, 1_000_000, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
      expect(round.moves[0]!.enemyReduction).toBe((ticket === 226 ? 54 : 37.8) * 0.65);
      expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(70);
      expect(state.injuries).toHaveLength(1); expect(state.injuries[0]!.severity).toBe('HEAVY');
      expect(state.spirituality).toBe(ticket === 226 ? 13 : 14);
      expect(state.witch.tools.mirrorsUsed).toBe(ticket === 226 ? 1 : 0);
      expectToolBalance(state); vi.restoreAllMocks();
    }
  });

  it('repeated B slots consume each original once and never rearm another held mirror', () => {
    const state = fixture(); state.witch.tools.mirrorPrepared = true;
    scriptRolls(81, 1, 226, 400, 226, 226, 226, 226, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerCount).toBe(5); expect(round.enemyCount).toBe(1);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.enemyReduction))
      .toEqual([54 * 0.65, 27 * 0.65, 27 * 0.65, 27 * 0.65, 10]);
    expect(state.witch.tools).toMatchObject({ mirrorsHeld: 0, mirrorsUsed: 1, mirrorPrepared: false,
      powderHeld: 0, powderUsed: 3 });
    expect(state.spirituality).toBe(57); expectToolBalance(state); vi.restoreAllMocks();
    const held = fixture(); held.witch.tools.kitsBought = 2;
    held.witch.tools.mirrorsHeld = 2; held.witch.tools.powderHeld = 6;
    held.witch.tools.mirrorPrepared = true;
    expect(resolve(held, substitute).enemyReduction).toBe(54 * 0.65);
    expect(resolve(held, substitute).enemyReduction).toBe(27 * 0.65);
    expect(held.witch.tools).toMatchObject({ mirrorsHeld: 1, mirrorsUsed: 1, mirrorPrepared: false });
    expectToolBalance(held);
  });

  it('cannot resurrect or cancel the shared death branch after a mirror is actually consumed', () => {
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.witch.tools.mirrorPrepared = true;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const oldInjuries = structuredClone(state.injuries);
    scriptRolls(1, 1, 226, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(2); expect(state.injuries).toEqual(oldInjuries);
    expect(state.witch.tools).toMatchObject({ mirrorsHeld: 0, mirrorsUsed: 1, mirrorPrepared: false });
    expectToolBalance(state);
  });

  it('retains actual enemy death after a threatening attack and ordinary retreat without free magic', () => {
    const attack = fixture(); scriptRolls(1, 1, 1, 400, 1, 96);
    expect(resolveSliceCombatRound(attack, 'ATTACK').outcome).toBe('ENEMY_DEAD');
    expect(attack.combat!.enemyHealth).toBe(0); expect(attack.spirituality).toBe(58); vi.restoreAllMocks();
    const state = fixture(); state.witch.tools.mirrorPrepared = true; state.spirituality = 10;
    const before = structuredClone(state), draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.retreat).toBe('SUCCESS'); expect(state.spirituality).toBe(10);
    expect(state.witch).toEqual(before.witch); expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const failure = fixture(); failure.spirituality = 10;
    scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(failure, 'RETREAT');
    expect(result.round.retreat).toBe('FAILURE'); expect(result.round.moves).toHaveLength(1);
    expect(result.round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(result.outcome).toBe('CONTINUE'); expect(failure.health).toBe(90); expect(failure.spirituality).toBe(16);
  });

  it('replays serialized S7 state, actual prepared tools and round costs from the same seed/cursor', () => {
    const state = fixture(); state.witch.tools.mirrorPrepared = true; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'DEFEND')).toEqual(resolveSliceCombatRound(restored, 'DEFEND'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled(); expectToolBalance(state);
  });
});
