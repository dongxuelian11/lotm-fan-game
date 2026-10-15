import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  CALAMITY_PRIEST_COUNT_WHEEL, calamityPriestAbilityWheel, calamityPriestActionCount,
  currentCalamityPriestCombatSource, drawCalamityPriestAbility, drawCalamityPriestPassiveLuck,
  isCalamityPriest, resolveCalamityPriestCombatAbility,
  type CalamityPriestCombatSource, type CalamityPriestMoveId,
} from '../../src/domain/calamity-priest/combat.js';
import * as calamityCombat from '../../src/domain/calamity-priest/combat.js';
import { MONSTER_COUNT_WHEEL, monsterAbilityWheel } from '../../src/domain/monster/combat.js';
import { MACHINE_COUNT_WHEEL, machineAbilityWheel } from '../../src/domain/machine/combat.js';
import { LUCKY_COUNT_WHEEL, currentLuckyCombatSource, drawLuckyPassiveLuck,
  luckyAbilityWheel, resolveLuckyCombatAbility } from '../../src/domain/lucky/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'BODY_STRIKE', J = 'BODY_FOLLOWUP', B = 'wheel.s6.disaster-awareness';
const K = 'wheel.s6.mental-storm', R = 'wheel.s6.disaster-attraction', A = 'ACCIDENT';
const calculation = 'wheel.s8.calculation-control', intuition = 'wheel.s9.danger-intuition';
const passive = 'wheel.s7.passive-luck', ids = [H, J, B, K, R, A] as const;

/** Arrival fixture only. Original paid progression/arrival lives in growth tests. */
function fixture(firstCase = false): SliceState {
  const state = createSliceRun('calamity-priest-combat-test', sliceDefaultCreationSelection, 'calamity-priest-combat');
  state.activeEvent = null; state.arc.stage = firstCase ? 'COMBAT' : 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'wheel', sequence: 6, acting: 0, promotionWeek: 1,
    mastery: { [B]: 0, [K]: 0, [R]: 0, [calculation]: 0, [intuition]: 0, [passive]: 0,
      'wheel.s8.divination-guard': 0, 'wheel.s9.spirit-perception': 0 } };
  Object.assign(Object.values(state.calamityPriest.cases)[0]!, { status: 'RESOLVED', method: 'ORDINARY' });
  state.calamityPriest.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length, attemptWeek: state.week };
  state.calamityPriest.practice = { hazard: 'UNASSESSED', board: 'RESTING', contact: 'NONE' };
  state.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'CALAMITY_PRIEST_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.health = 100; state.mind = 100; state.spirituality = 80; state.town.clubLocation = 'SHOP';
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-calamity-priest-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: CalamityPriestMoveId, physical = 1,
  source: CalamityPriestCombatSource | null = currentCalamityPriestCombatSource(state), random = fixedRolls()) {
  return resolveCalamityPriestCombatAbility(state, id, physical, random, source);
}
function nextRound(state: SliceState): void {
  const round: SliceCombatRound = { round: state.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 665,
    enemyAdvantage: 114, winChance: 80, winner: 'PLAYER', consequence: '', consequenceWeights: null, retreat: 'NONE' };
  state.combatHistory.push(round); state.combat!.lastRound = round; state.combat!.round += 1;
}
/** Keep exact ranges and cursor advancement while specifying each real draw. */
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

describe('Calamity Priest exact S6 candidate profile and inherited boundaries', () => {
  it('routes only wheel6 to detached30/15/25/10/15/5 and10/15/25/30/20 wheels', () => {
    const state = fixture(); expect(isCalamityPriest(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(calamityPriestAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(CALAMITY_PRIEST_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 25, 30, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30); expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(playerAbilityWheel(state, null).some(entry => entry.id === passive)).toBe(false);
    state.progression.pathwayId = 'chained'; expect(isCalamityPriest(state)).toBe(false);
  });

  it('retains every count boundary and exact1.25 stance tickets with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [80, 4], [81, 5], [100, 5]] as const) {
      expect(calamityPriestActionCount(roll)).toBe(count);
    }
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2]
        : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [30, 15, 25, 10, 15, 5].map((weight, index) => weight * (boosted.includes(index) ? 5 : 4));
      const total = weights.reduce((sum, value) => sum + value, 0); let boundary = 0;
      calamityPriestAbilityWheel(stance).forEach((entry, index) => {
        expect(entry.weight).toBe(total === 400 ? weights[index]! / 4 : weights[index]! / total * 100);
        const first = boundary + 1; boundary += weights[index]!;
        const random = fixedRolls(first, boundary);
        expect(drawCalamityPriestAbility(random, stance)).toBe(ids[index]);
        expect(drawCalamityPriestAbility(random, stance)).toBe(ids[index]); expect(random.cursor).toBe(2);
      });
    }
  });

  it('preserves old wheel9–7 wheels, S7 body budgets, passive draw and accident coin', () => {
    const state = fixture(true);
    for (const [sequence, count, wheel] of [
      [9, MONSTER_COUNT_WHEEL, monsterAbilityWheel], [8, MACHINE_COUNT_WHEEL, machineAbilityWheel],
      [7, LUCKY_COUNT_WHEEL, luckyAbilityWheel],
    ] as const) {
      state.progression.sequence = sequence; expect(isCalamityPriest(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(count); expect(playerAbilityWheel(state, null)).toEqual(wheel(null, state));
      expect(currentCalamityPriestCombatSource(state)).toBeNull();
      expect(drawCalamityPriestPassiveLuck(state, 'ATTACK', 1, fixedRolls())).toBeNull();
    }
    expect(currentLuckyCombatSource(state)).not.toBeNull();
    expect(resolveLuckyCombatAbility(state, calculation, 1, fixedRolls()).selfGain).toBe(27 * 0.65);
    expect(resolveLuckyCombatAbility(state, J, 1, fixedRolls()).selfGain).toBe(18.9 * 0.65);
    const random = fixedRolls(25, 2);
    expect(drawLuckyPassiveLuck(state, 'ATTACK', 1, random)).toEqual({ roll: 25, triggered: true, bonus: 45 * 0.65 });
    expect(resolveLuckyCombatAbility(state, A, 1, random).selfGain).toBe(7.5); expect(random.cursor).toBe(2);
    state.progression.sequence = 6;
    expect(currentLuckyCombatSource(state)).toBeNull();
    expect(drawLuckyPassiveLuck(state, 'ATTACK', 1, fixedRolls())).toBeNull();
  });
});

describe('Calamity Priest finite slots, costs and actual tools', () => {
  it('keeps free H18 and J22.75 on inherited calculation mastery, separate from S6 mastery', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [calculation]: mastery, [B]: 500, [K]: 500, [R]: 500, [passive]: 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = fixedRolls();
      expect(resolve(state, H, 0.8, undefined, random)).toMatchObject({ selfGain: 18 * 0.8, enemyReduction: 0, threatens: true });
      expect(resolve(state, J, 0.8, undefined, random)).toMatchObject({ selfGain: 22.75 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('only actual town HAND club replaces H16 without cost, stacking or ownership transfer', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.progression.mastery[calculation] = 500;
      const before = structuredClone(state);
      expect(resolve(state, H, 0.8).selfGain).toBe((location === 'HAND' ? 16 : 18) * 0.8);
      expect(resolve(state, J, 0.8).selfGain).toBe(22.75 * 0.8); expect(state).toEqual(before);
      if (location === 'HAND') {
        expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
        expect(resolve(state, H, 0.8).label).toContain('不叠加');
      }
    }
  });

  it('pays B3S for42.25 awarenessf times body and K3S for42.25 stormf without body scaling', () => {
    for (const mastery of [0, 100, 500]) {
      const state = fixture(); state.progression.mastery[B] = mastery; state.progression.mastery[K] = 500 - mastery;
      const before = structuredClone(state), random = fixedRolls();
      expect(resolve(state, B, 0.8, undefined, random)).toMatchObject({ selfGain: 0,
        enemyReduction: 42.25 * (0.65 + 0.35 * mastery / 500) * 0.8, threatens: false });
      expect(state.spirituality).toBe(77);
      expect(resolve(state, K, 0.8, undefined, random)).toMatchObject({ selfGain: 0,
        enemyReduction: 42.25 * (0.65 + 0.35 * (500 - mastery) / 500), threatens: false });
      expect(state.spirituality).toBe(74); before.spirituality = 74;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('falls back to B10 and K6 at insufficient or nonfinite S with no partial payment or redraw', () => {
    for (const spirituality of [0, 1, 2, 2.99, Number.NaN, Infinity]) {
      const state = fixture(); state.spirituality = spirituality; const before = structuredClone(state), random = fixedRolls();
      expect(resolve(state, B, 0.8, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 10 * 0.8, threatens: false });
      expect(resolve(state, K, 0.8, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const exact = fixture(); exact.spirituality = 3;
    expect(resolve(exact, K).enemyReduction).toBe(42.25 * 0.65); expect(exact.spirituality).toBe(0);
    expect(resolve(exact, B).enemyReduction).toBe(10); expect(exact.spirituality).toBe(0);
  });

  it('K is finite nonphysical pressure only, without health/mind/injury/risk/consent mutations', () => {
    const state = fixture(); state.health = 55; state.mind = 67; state.injuryRisk = 4; state.seer.pollution = 7;
    state.injuries.push({ id: 'old-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    state.progression.mastery[K] = 500; const before = structuredClone(state);
    const effect = resolve(state, K, 0);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 42.25, threatens: false });
    expect(effect.label).toContain('不额外造成身体伤害'); expect(effect.label).toContain('不强迫供述');
    before.spirituality -= 3; expect(state).toEqual(before);
  });

  it('R cannot borrow the practice board, a held club, alleged hidden hazard or future RNG', () => {
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect future RNG'); },
      get cursor(): number { throw new Error('Do not inspect future RNG'); },
      nextInt() { throw new Error('Do not draw a hidden hazard'); },
    };
    for (const board of ['RESTING', 'SECURED'] as const) {
      const state = fixture(); state.calamityPriest.practice.board = board; state.town.clubLocation = 'HAND';
      state.progression.mastery[R] = 500;
      const source = { ...currentCalamityPriestCombatSource(state)!, hiddenHazard: true,
        futureDisaster: 'PRIVATE_FUTURE_RESULT', practiceObject: 'PRACTICE_BOARD' };
      const before = structuredClone(state), effect = resolve(state, R, 1, source, forbidden);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('没有合格松动物或可引动灾祸'); expect(effect.label).not.toContain('PRIVATE_FUTURE');
      expect(state).toEqual(before);
    }
  });

  it('fixed A−16.25 never flips a coin, charges resources or threatens physical injury', () => {
    const state = fixture(), before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, A, 0, undefined, random)).toMatchObject({ selfGain: -16.25, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0); expect(state).toEqual(before);
  });

  it('bounds malformed masteries/body factors while retaining finite nonphysical storm', () => {
    for (const mastery of [-1, Number.NaN, Infinity, 900]) {
      for (const physical of [-1, Number.NaN, Infinity, 0, 0.8, 1, 3]) {
        const state = fixture(); state.progression.mastery = { [calculation]: mastery, [B]: mastery, [K]: mastery };
        const factor = mastery === 900 ? 1 : 0.65, body = Number.isFinite(physical) ? Math.max(0, Math.min(1, physical)) : 0;
        expect(resolve(state, H, physical).selfGain).toBe(18 * body);
        expect(resolve(state, J, physical).selfGain).toBe(22.75 * factor * body);
        expect(resolve(state, B, physical).enemyReduction).toBe(42.25 * factor * body);
        expect(resolve(state, K, physical).enemyReduction).toBe(42.25 * factor);
      }
    }
  });
});

describe('Calamity Priest current opponent and closed-practice source boundary', () => {
  it('binds actual adult杜兰, his own HAND club,2m, empty courtyard, real exit and no disaster', () => {
    const state = fixture();
    expect(currentCalamityPriestCombatSource(state)).toMatchObject({ encounterId: 'CALAMITY_PRIEST_DISPUTE',
      target: 'DURAN_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'DURANS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND',
      distanceMetres: 2, bystanders: 'NONE', pursuit: false, looseObjectSource: false, disasterTrigger: false,
      practiceBoardPresent: false });
    const firstCase = fixture(true), world = structuredClone(firstCase.world);
    expect(currentCalamityPriestCombatSource(firstCase)).toMatchObject({ encounterId: 'FIRST_CASE',
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', disasterTrigger: false });
    expect(resolve(firstCase, H).selfGain).toBe(18); expect(firstCase.world).toEqual(world);
    expect(resolve(firstCase, H, 1, currentCalamityPriestCombatSource(state)).selfGain).toBe(0);
  });

  it('refuses old run/revision/week/round snapshots and forged opponent, tool or disaster sources', () => {
    const state = fixture(), source = currentCalamityPriestCombatSource(state)!;
    const inputs: (CalamityPriestCombatSource | null)[] = [null, { ...source, runId: 'other' },
      { ...source, revision: source.revision + 1 }, { ...source, week: source.week + 1 }, { ...source, round: 2 },
      ...[{ target: 'UNKNOWN_BODY' }, { weapon: 'STOLEN_CLUB' }, { weaponLocation: 'GROUND' },
        { pursuit: true }, { bystanders: 'CROWD' }, { distanceMetres: 20 }, { startHistoryIndex: 1 },
        { looseObjectSource: true }, { disasterTrigger: true }, { practiceBoardPresent: true }]
        .map(patch => ({ ...source, ...patch }) as unknown as CalamityPriestCombatSource)];
    const before = structuredClone(state), random = fixedRolls();
    for (const input of inputs) {
      for (const id of ids) expect(resolve(state, id, 1, input, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(drawCalamityPriestPassiveLuck(state, 'ATTACK', 1, random, input)).toBeNull();
    }
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('rejects absent/dead targets, active practice, stale arrival and broken history before RNG', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.mind = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyMind = 0; }, (s: SliceState) => { s.combat!.enemyHealth = Infinity; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.combat!.round = 0; }, (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.calamityPriest.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.calamityPriest.encounter.attemptWeek = null; },
      (s: SliceState) => { s.calamityPriest.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.calamityPriest.practice.hazard = 'NOTICED'; },
      (s: SliceState) => { s.calamityPriest.practice.board = 'UNSTABLE'; },
      (s: SliceState) => { s.calamityPriest.practice.board = 'FALLEN'; },
      (s: SliceState) => { s.calamityPriest.practice.contact = 'FOCUSED'; },
      (s: SliceState) => { Object.values(s.calamityPriest.cases)[0]!.contactOpen = true; },
      (s: SliceState) => { Object.values(s.calamityPriest.cases)[0]!.status = 'PREPARED'; },
      (s: SliceState) => { Object.values(s.calamityPriest.cases)[0]!.status = 'AVAILABLE'; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.retreat = 'SUCCESS'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = fixedRolls();
      expect(currentCalamityPriestCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolve(state, id, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(drawCalamityPriestPassiveLuck(state, 'ATTACK', 1, random)).toBeNull();
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
  });

  it('preserves FIRST_CASE carrier gates and accepts only actually secured/released practice', () => {
    for (const mutate of [
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.arc.stage = 'ENDED'; }, (s: SliceState) => { s.calamityPriest.practice.board = 'UNSTABLE'; },
    ]) {
      const state = fixture(true); mutate(state); const before = structuredClone(state);
      expect(currentCalamityPriestCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
    const state = fixture(); state.calamityPriest.practice = { hazard: 'SECURED', board: 'SECURED', contact: 'RELEASED' };
    expect(currentCalamityPriestCombatSource(state)).toMatchObject({ practiceBoardPresent: false, disasterTrigger: false });
    expect(resolve(state, R).selfGain).toBe(0);
  });
});

describe('Calamity Priest inherited finite once-per-round passive luck', () => {
  it('keeps inclusive25, every non-retreat stance, exact old mastery and no state change', () => {
    const state = fixture(); state.progression.mastery[passive] = 500;
    const before = structuredClone(state), draws = scriptRolls(1, 25, 26, 100);
    const random = new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
    expect(drawCalamityPriestPassiveLuck(state, 'ATTACK', 1, random)).toEqual({ roll: 1, triggered: true, bonus: 45 });
    expect(drawCalamityPriestPassiveLuck(state, 'DEFEND', 1, random)).toEqual({ roll: 25, triggered: true, bonus: 45 });
    expect(drawCalamityPriestPassiveLuck(state, 'CONTROL', 1, random)).toEqual({ roll: 26, triggered: false, bonus: 0 });
    expect(drawCalamityPriestPassiveLuck(state, 'PREPARE', 1, random)).toEqual({ roll: 100, triggered: false, bonus: 0 });
    expect(drawCalamityPriestPassiveLuck(state, 'RETREAT', 1, random)).toBeNull();
    expect(draws.mock.calls).toEqual(Array(4).fill([1, 100])); expect(random.cursor).toBe(4); expect(state).toEqual(before);
  });

  it('never reads RNG state or borrows new mastery, stores luck, creates debt or exceeds45', () => {
    const random: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect seed'); },
      get cursor(): number { throw new Error('Do not inspect cursor'); }, nextInt: vi.fn(() => 25),
    };
    for (const mastery of [-1, Number.NaN, Infinity, 0, 100, 500, 900]) {
      for (const physical of [-1, Number.NaN, Infinity, 0, 0.8, 1, 3]) {
        const state = fixture(); state.progression.mastery = { [passive]: mastery, [B]: 500, [K]: 500, [R]: 500 };
        const before = structuredClone(state), luck = drawCalamityPriestPassiveLuck(state, 'ATTACK', physical, random)!;
        const factor = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
        const body = Number.isFinite(physical) ? Math.max(0, Math.min(1, physical)) : 0;
        expect(luck.bonus).toBe(45 * factor * body); expect(luck.bonus).toBeGreaterThanOrEqual(0); expect(luck.bonus).toBeLessThanOrEqual(45);
        expect(state).toEqual(before);
      }
    }
    expect(random.nextInt).toHaveBeenCalledTimes(49);
  });
});

describe('Calamity Priest shared complete rounds and real exit', () => {
  it('uses core15/20/40/25,650/cap130/floor65,max80 and continuing-round regeneration8', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 72; scriptRolls(26, 1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(677.5); expect(state.spirituality).toBe(80);
    vi.restoreAllMocks(); const dry = fixture(); dry.spirituality = 0; scriptRolls(26, 1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(dry, 'ATTACK').round.playerAdvantage).toBe(665 * 0.8); expect(dry.spirituality).toBe(8);
    vi.restoreAllMocks(); const cap = fixture(); cap.spirituality = 79;
    cap.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    scriptRolls(26, 1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(cap, 'ATTACK').round.playerAdvantage).toBe(780); expect(cap.spirituality).toBe(80);
    vi.restoreAllMocks(); vi.spyOn(calamityCombat, 'resolveCalamityPriestCombatAbility').mockReturnValue({
      label: 'controlled negative budget', selfGain: -10_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(26, 1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(65);
  });

  it('draws luck once before both counts, then H/J/B/K/R and every enemy slot without bonus actions', () => {
    const state = fixture(); state.spirituality = 70; const before = structuredClone(state);
    const draws = scriptRolls(25, 100, 100, 1, 1, 151, 1, 226, 1, 326, 366, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.passiveLuck).toEqual({ roll: 25, triggered: true, bonus: 45 * 0.65 });
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[18, 0], [22.75 * 0.65, 0], [0, 42.25 * 0.65], [0, 42.25 * 0.65], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBeCloseTo(665 + 45 * 0.65 + 18 + 22.75 * 0.65, 10);
    expect(round.enemyAdvantage).toBeCloseTo(162 - 2 * 42.25 * 0.65, 10);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90); expect(state.combat!.enemyMind).toBe(100);
    expect(state.spirituality).toBe(72); expect(state.calamityPriest).toEqual(before.calamityPriest); expect(state.world).toEqual(before.world);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(round.consequence).toContain('25/100'); expect(round.consequence).toContain('健康减少10');
    expect(draws.mock.calls).toEqual([[1, 100], [1, 100], [1, 100], [1, 445], [1, 400],
      [1, 445], [1, 400], [1, 445], [1, 400], [1, 445], [1, 445], [1, 1_000_000], [1, 100]]);
    expect(state.random.cursor).toBe(13);
  });

  it('keeps even-round enemy initiative and nontriggered luck without rerolls or debt', () => {
    const state = fixture(); nextRound(state);
    const draws = scriptRolls(26, 1, 1, 1, 366, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect(round.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER']);
    expect(round.passiveLuck).toEqual({ roll: 26, triggered: false, bonus: 0 });
    expect(round.playerAdvantage).toBe(665); expect(round.consequence).toContain('幸运贡献0');
    expect(draws).toHaveBeenCalledTimes(6); expect(round.consequenceWeights).toBeNull();
  });

  it('K-only finite pressure cannot inflict physical wounds, reduce mind, force surrender or add a consequence draw', () => {
    const state = fixture(); state.spirituality = 70;
    const draws = scriptRolls(25, 1, 100, 281, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 42.25 * 0.65 });
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
    expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined();
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(outcome).toBe('CONTINUE'); expect(state.spirituality).toBe(75); expect(draws).toHaveBeenCalledTimes(8);
  });

  it('paid B is not injury immunity and0S B/K fallbacks leave all enemy actions intact', () => {
    const state = fixture(); state.spirituality = 70;
    scriptRolls(26, 1, 1, 181, 1, 1_000_000, 1);
    expect(resolveSliceCombatRound(state, 'DEFEND').outcome).toBe('CONTINUE');
    expect(state.health).toBe(90); expect(state.injuries).toHaveLength(1); expect(state.spirituality).toBe(75);
    vi.restoreAllMocks(); const dry = fixture(); dry.spirituality = 0;
    scriptRolls(26, 100, 100, 1, 1, 151, 1, 226, 1, 326, 366, 1, 1);
    const { round } = resolveSliceCombatRound(dry, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[18, 0], [22.75 * 0.65, 0], [0, 10], [0, 6], [0, 0]]);
    expect(dry.spirituality).toBe(8); expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
  });

  it('R-only never creates a hazard and fixed A adds no coin or physical injury draw', () => {
    for (const [roll, contribution] of [[366, 0], [445, -16.25]] as const) {
      const state = fixture(); const before = structuredClone(state), draws = scriptRolls(26, 1, 1, roll, 400, 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.playerAdvantage).toBe(665 + contribution); expect(round.consequenceWeights).toBeNull();
      expect(state.combat!.enemyHealth).toBe(100); expect(state.calamityPriest).toEqual(before.calamityPriest);
      expect(draws).toHaveBeenCalledTimes(6); expect(state.random.cursor).toBe(6); vi.restoreAllMocks();
    }
  });

  it('actual surrender/death retain B costs, injuries and no terminal regeneration or guaranteed luck rescue', () => {
    for (const [winner, severity, outcome] of [[1, 66, 'ENEMY_SURRENDERED'], [1, 100, 'ENEMY_DEAD'],
      [1_000_000, 100, 'PLAYER_DEAD']] as const) {
      const state = fixture(); state.spirituality = 70; const world = structuredClone(state.world);
      scriptRolls(25, 11, 1, 226, 1, 1, winner, severity);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome); expect(state.spirituality).toBe(67); expect(state.world).toEqual(world);
      expect(result.round.passiveLuck?.triggered).toBe(true);
      if (outcome === 'ENEMY_SURRENDERED') {
        expect(result.round.consequence).toContain('杜兰'); expect(result.round.consequence).toContain('自己的原普通短棍');
        expect(result.round.consequence).not.toContain('箱子'); expect(state.combat!.enemyStatus).toBe('SURRENDERED');
      } else if (outcome === 'PLAYER_DEAD') {
        expect(state.health).toBe(0); const dead = structuredClone(state);
        expect(resolve(state, R).selfGain).toBe(0); expect(state).toEqual(dead);
      } else expect(state.combat!.enemyHealth).toBe(0);
      vi.restoreAllMocks();
    }
  });

  it('retreat never draws luck or player abilities, grants no healing/refill and has no chase', () => {
    const state = fixture(); state.spirituality = 61; state.health = 70;
    const before = structuredClone(state), draws = scriptRolls(100, 100, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]); expect(result.round.passiveLuck).toBeUndefined();
    expect(result.round.consequence).toContain('原普通出口'); expect(result.round.consequence).toContain('没有瞬移或进入追逐');
    expect(result.round.consequence).toContain('杜兰'); expect(state.calamityPriest).toEqual(before.calamityPriest);
    expect(state.world).toEqual(before.world); expect(state.spirituality).toBe(61); expect(state.health).toBe(70);
    expect(draws.mock.calls).toEqual([[1, 100], [1, 100], [1, 100]]);
  });

  it('failed retreat likewise draws no luck and cannot erase actual ordinary defeat or wounds', () => {
    const state = fixture(); state.spirituality = 61; const draws = scriptRolls(100, 1, 100, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.round.retreat).toBe('FAILURE'); expect(result.round.passiveLuck).toBeUndefined();
    expect(result.round.moves.map(move => move.actor)).toEqual(['ENEMY']);
    expect(state.health).toBe(90); expect(state.injuries).toHaveLength(1); expect(draws).toHaveBeenCalledTimes(6);
  });

  it('preserves original FIRST_CASE terminal text and exactly replays complete source/cost/RNG state', () => {
    const state = fixture(true); scriptRolls(26, 1, 1, 1, 1, 1, 66);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(result.round.consequence).toContain('携铃者');
    expect(result.round.consequence).toContain('箱子'); expect(result.round.consequence).not.toContain('杜兰');
    vi.restoreAllMocks();
    for (const firstCase of [false, true]) {
      const original = fixture(firstCase); original.health = 85; const replay = structuredClone(original);
      expect(resolveSliceCombatRound(original, 'ATTACK')).toEqual(resolveSliceCombatRound(replay, 'ATTACK'));
      expect(original).toEqual(replay);
    }
  });
});
