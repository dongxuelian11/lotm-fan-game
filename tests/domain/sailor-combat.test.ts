import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { SAILOR_COUNT_WHEEL, consumeSailorScales, currentSailorCombatSource, drawSailorAbility, isSailor,
  resolveSailorCombatAbility, sailorAbilityWheel, sailorActionCount,
  type SailorCombatSource, type SailorMoveId } from '../../src/domain/sailor/combat.js';
import { RAGER_COUNT_WHEEL, ragerAbilityWheel } from '../../src/domain/rager/combat.js';
import { NAVIGATOR_COUNT_WHEEL, navigatorAbilityWheel } from '../../src/domain/navigator/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { HUNTER_COUNT_WHEEL, hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import { AUDIENCE_COUNT_WHEEL, audienceAbilityWheel } from '../../src/domain/audience/combat.js';
import { MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel } from '../../src/domain/mindreader/combat.js';
import { SLEEPLESS_COUNT_WHEEL, sleeplessAbilityWheel } from '../../src/domain/sleepless/combat.js';
import { MIDNIGHT_COUNT_WHEEL, midnightAbilityWheel } from '../../src/domain/midnight/combat.js';
import { NIGHTMARE_COUNT_WHEEL, nightmareAbilityWheel } from '../../src/domain/nightmare/combat.js';
import { READER_COUNT_WHEEL, readerAbilityWheel } from '../../src/domain/reader/combat.js';
import { REASONER_COUNT_WHEEL, reasonerAbilityWheel } from '../../src/domain/reasoner/combat.js';
import { DETECTIVE_COUNT_WHEEL, detectiveAbilityWheel } from '../../src/domain/detective/combat.js';
import { VAMPIRE_COUNT_WHEEL, vampireAbilityWheel } from '../../src/domain/vampire/combat.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacAbilityWheel } from '../../src/domain/pyromaniac/combat.js';
import { PSYCHOLOGIST_COUNT_WHEEL, psychologistAbilityWheel } from '../../src/domain/psychologist/combat.js';
import { MAGICIAN_COUNT_WHEEL, magicianAbilityWheel } from '../../src/domain/magician/combat.js';
import { APPRAISER_COUNT_WHEEL } from '../../src/domain/slice/combat.js';
import type { SliceState, SliceWheelEntry } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'tyrant.s9.physique', secondary = 'tyrant.s9.aquatic-affinity';
const protection = 'tyrant.s9.balance';
const ids = [primary, secondary, protection, 'GRIP', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('sailor-combat-test', sliceDefaultCreationSelection, 'sailor-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'tyrant', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
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
function resolve(state: SliceState, id: SailorMoveId, source = currentSailorCombatSource(state)) {
  return resolveSailorCombatAbility(state, id, 1, stream(state), source);
}
/** Script values while advancing the actual deterministic cursor. */
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

describe('Sailor S9 exact Tyrant M combat profile', () => {
  it('selects the six confirmed weights and independent 35/30/20/15 count wheel', () => {
    const state = fixture();
    expect(isSailor(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(sailorAbilityWheel(null));
    expect(sailorAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(sailorAbilityWheel(null).map(entry => entry.weight)).toEqual([38, 20, 8, 5, 4, 25]);
    expect(playerCountWheel(state)).toEqual(SAILOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([35, 30, 20, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(38);
    expect(playerCountWheel(state)[0]!.weight).toBe(35);
  });

  it('preserves every count/slot boundary and uses one draw per ability', () => {
    for (const [roll, count] of [[1, 1], [35, 1], [36, 2], [65, 2], [66, 3], [85, 3], [86, 4], [100, 4]]) {
      expect(sailorActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of sailorAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draws = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawSailorAbility(random, null)).toBe(entry.id);
      expect(drawSailorAbility(random, null)).toBe(entry.id);
      expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('only applies the existing normalized ×1.25 stance tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [190, 100, 32, 20, 16, 100]],
      ['DEFEND', [152, 80, 40, 20, 16, 100]],
      ['CONTROL', [152, 80, 32, 25, 16, 100]],
      ['PREPARE', [152, 80, 32, 20, 20, 100]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(sailorAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / sum * 100));
    }
    expect(sailorAbilityWheel('RETREAT')).toEqual(sailorAbilityWheel(null));
  });

  it('uses base200, core45/25/20/10, core cap40 and spirituality30 without scene multipliers', () => {
    const state = fixture(); state.spirituality = 29;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 343, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(219.5); expect(round.enemyAdvantage).toBe(114);
    expect(round.winChance).toBe(219.5 / 333.5 * 100); expect(state.spirituality).toBe(30);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 343, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(6);
  });

  it('does not change existing pathway wheels or borrow S9 for Tyrant higher sequences', () => {
    const state = fixture();
    const profiles: [SliceState['progression']['pathwayId'], SliceState['progression']['sequence'],
      readonly SliceWheelEntry[], SliceWheelEntry[]][] = [
      [null, null, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
      ['diviner', 9, SEER_COUNT_WHEEL, seerAbilityWheel('CONTROL')],
      ['diviner', 8, CLOWN_COUNT_WHEEL, clownAbilityWheel('CONTROL')],
      ['diviner', 7, MAGICIAN_COUNT_WHEEL, magicianAbilityWheel(state, 'CONTROL')],
      ['hunter', 9, HUNTER_COUNT_WHEEL, hunterAbilityWheel('CONTROL')],
      ['hunter', 8, PROVOKER_COUNT_WHEEL, provokerAbilityWheel('CONTROL')],
      ['hunter', 7, PYROMANIAC_COUNT_WHEEL, pyromaniacAbilityWheel('CONTROL')],
      ['audience', 9, AUDIENCE_COUNT_WHEEL, audienceAbilityWheel('CONTROL')],
      ['audience', 8, MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel('CONTROL')],
      ['audience', 7, PSYCHOLOGIST_COUNT_WHEEL, psychologistAbilityWheel('CONTROL')],
      ['paragon', 9, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
      ['paragon', 8, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
      ['paragon', 7, APPRAISER_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
      ['moon', 9, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
      ['moon', 8, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
      ['moon', 7, VAMPIRE_COUNT_WHEEL, vampireAbilityWheel('CONTROL')],
      ['darkness', 9, SLEEPLESS_COUNT_WHEEL, sleeplessAbilityWheel('CONTROL')],
      ['darkness', 8, MIDNIGHT_COUNT_WHEEL, midnightAbilityWheel('CONTROL')],
      ['darkness', 7, NIGHTMARE_COUNT_WHEEL, nightmareAbilityWheel('CONTROL')],
      ['white-tower', 9, READER_COUNT_WHEEL, readerAbilityWheel('CONTROL')],
      ['white-tower', 8, REASONER_COUNT_WHEEL, reasonerAbilityWheel('CONTROL')],
      ['white-tower', 7, DETECTIVE_COUNT_WHEEL, detectiveAbilityWheel('CONTROL')],
      ['tyrant', 8, RAGER_COUNT_WHEEL, ragerAbilityWheel('CONTROL')],
      ['tyrant', 7, NAVIGATOR_COUNT_WHEEL, navigatorAbilityWheel('CONTROL')],
    ];
    for (const [pathwayId, sequence, counts, wheel] of profiles) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isSailor(state)).toBe(false); expect(currentSailorCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(counts); expect(playerAbilityWheel(state, 'CONTROL')).toEqual(wheel);
    }
  });

  it('uses exact unrounded mastery budgets without body ability cost or free mastery', () => {
    for (const mastery of [0, 250, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [primary]: mastery, [secondary]: mastery, [protection]: mastery };
      const before = structuredClone(state), random = stream(state), f = 0.65 + 0.35 * mastery / 500;
      expect(resolveSailorCombatAbility(state, primary, 0.8, random)).toMatchObject({ selfGain: 14.3 * f * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveSailorCombatAbility(state, protection, 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 2.6 * f, threatens: false });
      expect(resolveSailorCombatAbility(state, 'GRIP', 0.8, random)).toMatchObject({ selfGain: 0, enemyReduction: 1.4 * f, threatens: false });
      // The secondary 7.7f is conditional; mastery alone never creates water or a throwable.
      expect(resolveSailorCombatAbility(state, secondary, 0.8, random)).toMatchObject({ selfGain: 12 * 0.8, enemyReduction: 0, threatens: true });
      before.combat!.sailorScalesReady = true;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('reads only the corresponding stable ability mastery and bounds malformed factors safely', () => {
    const state = fixture();
    state.progression.mastery = { [primary]: 500, [secondary]: 500, [protection]: 0, 'tyrant.s8.rage': 500 };
    expect(resolve(state, primary).selfGain).toBe(14.3);
    expect(resolve(state, protection).enemyReduction).toBe(2.6 * 0.65);
    expect(resolve(state, 'GRIP').enemyReduction).toBe(1.4);
    for (const value of [-100, Number.NaN, Number.POSITIVE_INFINITY]) {
      state.progression.mastery[primary] = value;
      expect(resolve(state, primary).selfGain).toBe(14.3 * 0.65);
    }
    state.progression.mastery[primary] = 1000;
    expect(resolve(state, primary).selfGain).toBe(14.3);
    for (const id of [primary, secondary]) {
      for (const physical of [0, -1, Number.NaN]) {
        expect(resolveSailorCombatAbility(state, id, physical, stream(state))).toMatchObject({ selfGain: 0, threatens: false });
      }
      expect(resolveSailorCombatAbility(state, id, 10, stream(state)).selfGain).toBe(id === primary ? 14.3 : 12);
    }
  });
});

describe('current ordinary dry-ground source and physical equipment', () => {
  it('derives only the current visible ordinary first-case carrier, dry ground and no throwable', () => {
    const state = fixture();
    expect(currentSailorCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1,
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', body: 'CURRENT_VISIBLE_BODY',
      space: 'DRY_GROUND_PASSAGE', water: 'NONE', throwable: 'NONE', exit: 'ORDINARY_OPEN_EXIT' });
    for (const mutate of [
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const candidate = fixture(); mutate(candidate);
      const before = structuredClone(candidate), random = stream(candidate);
      expect(currentSailorCombatSource(candidate)).toBeNull();
      expect(resolveSailorCombatAbility(candidate, 'GRIP', 1, random)).toMatchObject({ enemyReduction: 10, selfGain: 0, threatens: false });
      expect(resolveSailorCombatAbility(candidate, secondary, 1, random).selfGain).toBe(12);
      expect(resolveSailorCombatAbility(candidate, protection, 1, random).enemyReduction).toBe(2.6 * 0.65);
      expect(candidate.combat!.sailorScalesReady).toBeUndefined();
      expect(candidate).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rejects stale or forged source fields without consulting hidden or historical facts', () => {
    const state = fixture(), source = currentSailorCombatSource(state)!;
    state.knowledge = [{ id: 'past-water', week: 1, title: '过去水域', text: 'OPEN_WATER UNDERWATER SHIP_DECK PRIVATE_SECRET' }];
    const invalid: (SailorCombatSource | null)[] = [null,
      { ...source, runId: 'another-run' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'water', 'throwable', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as SailorCombatSource)];
    for (const input of invalid) {
      const before = structuredClone(state), random = stream(state);
      const effect = resolveSailorCombatAbility(state, 'GRIP', 1, random, input);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(effect.label).toContain('改用普通格挡护身'); expect(effect.label).not.toMatch(/PRIVATE_SECRET|携铃者/);
      expect(resolveSailorCombatAbility(state, secondary, 1, random, input).selfGain).toBe(12);
      expect(resolveSailorCombatAbility(state, 'OBSERVE', 1, random, input)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(resolveSailorCombatAbility(state, protection, 1, random, input).enemyReduction).toBe(2.6 * 0.65);
      expect(state.combat!.sailorScalesReady).toBeUndefined();
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not import old night or water observations, grant water attacks, or charge spirituality', () => {
    const state = fixture(); state.spirituality = 0;
    state.sleepless.encounter.night = true;
    state.knowledge = [{ id: 'old-water', week: 1, title: '先前救援', text: 'OPEN_WATER UNDERWATER，曾在夜间下水。' }];
    const before = structuredClone(state);
    expect(resolve(state, primary).selfGain).toBe(14.3 * 0.65);
    const fallback = resolve(state, secondary);
    expect(fallback.selfGain).toBe(12); expect(fallback.label).toContain('这里是干地');
    expect(fallback.label).toContain('没有可用投掷物'); expect(fallback.label).toContain('普通徒手打击');
    expect(resolve(state, protection).enemyReduction).toBe(2.6 * 0.65);
    expect(resolve(state, protection).label).toContain('不能防弹');
    before.combat!.sailorScalesReady = true;
    expect(state).toEqual(before);
  });

  it('uses the real held town club once, with no additive primary or secondary budget', () => {
    const state = fixture(); state.progression.mastery[primary] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const before = structuredClone(state), random = stream(state), held = location === 'HAND';
      expect(resolveSailorCombatAbility(state, primary, 0.8, random).selfGain).toBe((held ? 16 : 14.3) * 0.8);
      expect(resolveSailorCombatAbility(state, secondary, 0.8, random).selfGain).toBe((held ? 16 : 12) * 0.8);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(held ? '持握原短棍打击' : '水手体术');
      if (held) expect(resolve(state, primary).label).toContain('不叠加体术预算');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('keeps R0 and ±5 accident results actual, unboosted and non-threatening without losing equipment', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    state.progression.mastery[primary] = 500; state.progression.mastery[protection] = 500;
    const before = structuredClone(state), random = stream(state);
    expect(resolveSailorCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0);
    const draws = scriptRolls(1, 2);
    expect(resolveSailorCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -5, enemyReduction: 0, threatens: false });
    expect(resolveSailorCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 5, enemyReduction: 0, threatens: false });
    expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); expect(state).toEqual(before);
  });

  it('does not act or draw for absent, ended, dead or wrong-pathway combat', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.progression.sequence = 8; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentSailorCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveSailorCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('confirmed V2 single-use phantom scales', () => {
  it('arms once, refreshes without stacking, and consumes only on a real ordinary impact', () => {
    const state = fixture(), random = stream(state);
    for (let index = 0; index < 2; index += 1) {
      expect(resolveSailorCombatAbility(state, protection, 1, random).enemyReduction).toBe(2.6 * 0.65);
      expect(state.combat!.sailorScalesReady).toBe(true);
    }
    for (const move of ['OPENING', 'BLOCK', 'DISTANCE', 'MISS'] as const) {
      expect(consumeSailorScales(state, move)).toBeNull();
      expect(state.combat!.sailorScalesReady).toBe(true);
    }
    expect(consumeSailorScales(state, 'STRIKE')).toMatchObject({ physicalMultiplier: 0.75 });
    expect(state.combat!.sailorScalesReady).toBeUndefined();
    expect(consumeSailorScales(state, 'STRIKE')).toBeNull();
    expect(state.spirituality).toBe(30); expect(random.cursor).toBe(0);
  });

  it('does not apply phantom scales to absent, stale or other-pathway opponents', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
      (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.progression.pathwayId = 'darkness'; },
      (s: SliceState) => { s.progression.sequence = 6; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; },
    ]) {
      const state = fixture(); state.combat!.sailorScalesReady = true; mutate(state);
      const before = structuredClone(state);
      expect(consumeSailorScales(state, 'STRIKE')).toBeNull(); expect(state).toEqual(before);
    }
  });

  it('persists across a complete round and JSON, then reduces only the next actual enemy strike', () => {
    const state = fixture();
    scriptRolls(1, 1, 291, 300, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    expect(first.outcome).toBe('CONTINUE'); expect(first.round.moves[1]!.selfGain).toBe(8);
    expect(state.combat!.sailorScalesReady).toBe(true);
    vi.restoreAllMocks();
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    // Enemy goes first in round 2; no additional player activation is needed.
    scriptRolls(1, 1, 1, 343, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK');
    expect(next.round.first).toBe('ENEMY'); expect(next.round.moves[0]!.selfGain).toBe(12);
    expect(next.round.moves[0]!.label).toContain('幻鳞防护已消耗');
    expect(state.combat!.sailorScalesReady).toBeUndefined();
    vi.restoreAllMocks();
    scriptRolls(1, 1, 1, 343, 1);
    expect(resolveSliceCombatRound(restored, 'ATTACK')).toEqual(next); expect(restored).toEqual(state);
  });

  it('clears unused scales when the encounter ends by surrender or ordinary retreat', () => {
    const winning = fixture(); winning.combat!.sailorScalesReady = true;
    scriptRolls(1, 1, 1, 400, 1, 66);
    expect(resolveSliceCombatRound(winning, 'ATTACK').outcome).toBe('ENEMY_SURRENDERED');
    expect(winning.combat!.sailorScalesReady).toBeUndefined();
    vi.restoreAllMocks();
    const retreating = fixture(); retreating.combat!.sailorScalesReady = true;
    scriptRolls(1, 1, 1);
    expect(resolveSliceCombatRound(retreating, 'RETREAT').outcome).toBe('RETREATED');
    expect(retreating.combat!.sailorScalesReady).toBeUndefined();
  });
});

describe('full Sailor first-case rounds retain shared consequences', () => {
  it('resolves all four S9 actions against independent ordinary enemy counts without AP or extra turns', () => {
    const state = fixture(); state.spirituality = 10;
    const before = structuredClone(state);
    // 4 / 3 actions: primary, secondary fallback, self-defense, grip; all enemy strikes.
    const draws = scriptRolls(100, 100, 1, 1, 191, 1, 291, 1, 323, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [14.3 * 0.65, 0], [12, 0], [0, 2.6 * 0.65], [0, 1.4 * 0.65],
    ]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 12]);
    expect(round.moves[5]!.label).toContain('幻鳞防护已消耗');
    expect(round.playerAdvantage).toBe(215 * 0.9 + (14.3 * 0.65 + 12));
    expect(round.enemyAdvantage).toBe(114 + 44 - (2.6 * 0.65 + 1.4 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(13); expect(state.combat!.round).toBe(2);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.week).toBe(before.week); expect(state.progression).toEqual(before.progression);
    expect(draws).toHaveBeenCalledTimes(11); expect(state.random.cursor).toBe(before.random.cursor + 11);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
  });

  it('does not permit physical injury from self-defense, grip, preparation or a positive accident', () => {
    for (const slot of [291, 323, 343, 359]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 359 ? scriptRolls(1, 1, slot, 2, 400, 1) : scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 359 ? 5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town.clubLocation).toBe('HAND'); expect(draws).toHaveBeenCalledTimes(slot === 359 ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('applies a negative accident once to real advantage and does not add equipment-loss state', () => {
    const state = fixture(); state.town.clubLocation = 'HAND';
    scriptRolls(1, 1, 359, 1, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(210); expect(round.moves[0]!.selfGain).toBe(-5);
    expect(state.town.clubLocation).toBe('HAND'); expect(round.consequenceWeights).toBeNull();
  });

  it('keeps one fallback action and every enemy action when the ordinary source is missing', () => {
    const state = fixture(); state.world.carrierCanResist = false;
    const draws = scriptRolls(1, 100, 323, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(1);
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 10 });
    expect(round.moves[0]!.label).toContain('普通格挡护身');
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(7);
  });

  it('allows actual primary and secondary physical attacks to cause ordinary injury or surrender', () => {
    for (const slot of [1, 191]) {
      const state = fixture();
      scriptRolls(1, 1, slot, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED');
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(round.consequence).toContain('携铃者仍然活着');
      vi.restoreAllMocks();
    }
  });

  it('keeps the ordinary enemy strike, injury risk and death despite phantom-scale self-defense', () => {
    const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 291, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(12); expect(round.moves[1]!.label).toContain('短棍打击');
    expect(round.moves[1]!.label).toContain('幻鳞防护已消耗');
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('uses the ordinary exit for retreat, without water movement or round-end recovery', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('携铃者'); expect(round.retreat).toBe('SUCCESS');
    expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('replays serialized S9 state with the same cursor and no global random source', () => {
    const state = fixture(); state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
  });
});
