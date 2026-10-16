import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createWinnerState } from '../../src/domain/winner/index.js';
import {
  WINNER_COUNT_WHEEL, consumeWinnerStagger, currentWinnerCombatSource, drawWinnerAbility,
  drawWinnerPassiveLuck, finishWinnerCombatRound, isWinner, resolveWinnerCombatAbility,
  winnerAbilityWheel, winnerActionCount, type WinnerCombatSource, type WinnerMoveId, type WinnerLuckPolicy,
} from '../../src/domain/winner/combat.js';
import * as winnerCombat from '../../src/domain/winner/combat.js';
import {
  applyWinnerEncounter, blockWinnerEncounter, settleWinnerEncounter, validateWinnerEncounter,
} from '../../src/domain/winner/encounter.js';
import {
  CALAMITY_PRIEST_COUNT_WHEEL, calamityPriestAbilityWheel, currentCalamityPriestCombatSource,
  drawCalamityPriestPassiveLuck, resolveCalamityPriestCombatAbility,
} from '../../src/domain/calamity-priest/combat.js';
import { LUCKY_COUNT_WHEEL, luckyAbilityWheel, drawLuckyPassiveLuck } from '../../src/domain/lucky/combat.js';
import { MACHINE_COUNT_WHEEL, machineAbilityWheel } from '../../src/domain/machine/combat.js';
import { MONSTER_COUNT_WHEEL, monsterAbilityWheel } from '../../src/domain/monster/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const H = 'BODY_STRIKE', J = 'BODY_FOLLOWUP', B = 'wheel.s5.luck-reserve';
const K = 'wheel.s5.ill-fortune', R = 'OBSERVE', A = 'ACCIDENT';
const calculation = 'wheel.s8.calculation-control', passive = 'wheel.s7.passive-luck';
const oldB = 'wheel.s6.disaster-awareness', oldK = 'wheel.s6.mental-storm';
const profile: readonly [WinnerMoveId, number, SliceStance | null][] = [
  [H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], [A, 5, null],
];
/** Synthetic actual-arrival fixture; the natural scenario separately proves paid progression and accumulation. */
function fixture(): SliceState {
  const s = createSliceRun('winner-combat-test', sliceDefaultCreationSelection, 'winner-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24; s.arc.stage = 'ENDED';
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'wheel', sequence: 5, acting: 25, promotionWeek: 20,
    mastery: { [B]: 0, [K]: 0, [calculation]: 0, [passive]: 0, [oldB]: 0, [oldK]: 0 } };
  s.winner = createWinnerState(); s.winner.promotionWeek = 20;
  Object.assign(s.winner.cases['falling-counter']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 21, method: 'ORDINARY', outcome: 'COUNTER_CHECKED' });
  s.winner.luck = { stored: 3, accumulated: 3, spent: 0, lastAccumulateWeek: 22 };
  Object.assign(s.winner.encounter, { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 });
  s.combat = { encounterId: 'WINNER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 80; s.town.clubLocation = 'SHOP';
  return s;
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-winner', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++]; if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw'); return value;
  } };
}
function ticket(id: WinnerMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) { if (candidate === id) return start; start += weight * (stance !== null && stance === preferred ? 5 : 4); }
  throw new Error('Missing test ability');
}
function effect(s: SliceState, id: WinnerMoveId, random = fixedRolls(), policy: WinnerLuckPolicy = 'HOLD', physical = 1,
  source: WinnerCombatSource | null = currentWinnerCombatSource(s)) {
  return resolveWinnerCombatAbility(s, id, physical, random, source, policy);
}
function scriptedRound(s: SliceState, stance: SliceStance, values: number[], policy: WinnerLuckPolicy = 'HOLD') {
  const next = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    next.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error(`Unexpected random draw ${index}: ${value}, expected ${min}–${max}`); return value;
  });
  try {
    const result = resolveSliceCombatRound(s, stance, 'HOLD', 'HOLD', null, policy);
    s.combatHistory.push(structuredClone(result.round)); expect(spy).toHaveBeenCalledTimes(values.length); return result;
  } finally { spy.mockRestore(); }
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(s: SliceState): void { s.combat = null; s.winner.encounter = createWinnerState().encounter; }
afterEach(() => vi.restoreAllMocks());

describe('Winner exact profile and old wheel inheritance', () => {
  it('routes only actual wheel5 to detached six-slot and six-count wheels', () => {
    const s = fixture(); expect(isWinner(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(winnerAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(x => x.id)).toEqual(profile.map(x => x[0]));
    expect(playerAbilityWheel(s, null).map(x => x.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(playerCountWheel(s)).toEqual(WINNER_COUNT_WHEEL);
    expect(playerCountWheel(s).map(x => x.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    playerAbilityWheel(s, null)[0]!.weight = 0; playerCountWheel(s)[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30); expect(playerCountWheel(s)[0]!.weight).toBe(12);
    s.progression.sequence = 4; expect(isWinner(s)).toBe(false); expect(currentWinnerCombatSource(s)).toBeNull();
    s.progression.sequence = 5; s.progression.pathwayId = 'chained'; expect(isWinner(s)).toBe(false);
  });
  it('preserves every count boundary and exact1.25 stance tickets using one slot draw', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [32, 2], [33, 3], [57, 3], [58, 4], [80, 4], [81, 5], [94, 5], [95, 6], [100, 6]] as const) expect(winnerActionCount(roll)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && preferred === stance ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      winnerAbilityWheel(stance).forEach((entry, i) => {
        expect(entry.weight).toBe(total === 400 ? weights[i]! / 4 : weights[i]! / total * 100);
        const first = boundary + 1; boundary += weights[i]!;
        const r = fixedRolls(first, boundary); expect(drawWinnerAbility(r, stance)).toBe(profile[i]![0]); expect(drawWinnerAbility(r, stance)).toBe(profile[i]![0]); expect(r.cursor).toBe(2);
      });
    }
  });
  it('keeps wheel9–6 public profiles and their original source gates unchanged', () => {
    const s = fixture();
    for (const [sequence, count, wheel] of [[9, MONSTER_COUNT_WHEEL, monsterAbilityWheel], [8, MACHINE_COUNT_WHEEL, machineAbilityWheel], [7, LUCKY_COUNT_WHEEL, luckyAbilityWheel], [6, CALAMITY_PRIEST_COUNT_WHEEL, calamityPriestAbilityWheel]] as const) {
      s.progression.sequence = sequence;
      expect(playerCountWheel(s)).toEqual(count); expect(playerAbilityWheel(s, null)).toEqual(wheel(null, s));
      expect(currentWinnerCombatSource(s)).toBeNull(); expect(drawWinnerPassiveLuck(s, 'ATTACK', 1, fixedRolls())).toBeNull();
    }
    s.combat!.encounterId = 'CALAMITY_PRIEST_DISPUTE';
    s.calamityPriest.encounter = { status: 'FIGHTING', startHistoryIndex: 0, attemptWeek: s.week };
    Object.assign(Object.values(s.calamityPriest.cases)[0]!, { status: 'RESOLVED', method: 'ORDINARY' });
    expect(currentCalamityPriestCombatSource(s)).not.toBeNull();
    s.spirituality = 0;
    expect(resolveCalamityPriestCombatAbility(s, oldB, 1, fixedRolls()).enemyReduction).toBe(10);
    expect(resolveCalamityPriestCombatAbility(s, oldK, 1, fixedRolls()).enemyReduction).toBe(6);
    expect(drawCalamityPriestPassiveLuck(s, 'ATTACK', 1, fixedRolls(25))).toEqual({ roll: 25, triggered: true, bonus: 45 * 0.65 });
    s.progression.sequence = 5; expect(drawCalamityPriestPassiveLuck(s, 'ATTACK', 1, fixedRolls())).toBeNull(); expect(drawLuckyPassiveLuck(s, 'ATTACK', 1, fixedRolls())).toBeNull();
  });
  it('inherits H/J body budgets and held-original-club replacement without charging the bank', () => {
    const s = fixture(), r = fixedRolls(), before = structuredClone(s); s.progression.mastery[calculation] = 100; before.progression.mastery[calculation] = 100;
    expect(effect(s, H, r, 'SPEND_FIRST', 0.8)).toMatchObject({ selfGain: 18 * 0.8, enemyReduction: 0, threatens: true });
    expect(effect(s, J, r, 'SPEND_FIRST', 0.8).selfGain).toBe(22.75 * 0.72 * 0.8); expect(s).toEqual(before);
    s.town.clubLocation = 'HAND'; expect(effect(s, H, r, 'SPEND_FIRST', 0.8).selfGain).toBe(16 * 0.8); expect(r.cursor).toBe(0); expect(s.winner.luck.stored).toBe(3);
  });
  it('R observes current reserve without accumulation or oracle, and A is fixed−22.5 despite a full bank', () => {
    const s = fixture(), before = structuredClone(s), r = fixedRolls();
    expect(effect(s, R, r, 'SPEND_FIRST')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect(s, R).label).toContain('当前积运3/3'); expect(effect(s, A, r, 'SPEND_FIRST').selfGain).toBe(-22.5);
    expect(s).toEqual(before); expect(r.cursor).toBe(0);
  });
});

describe('Winner finite voluntary paid bank and exact enemy strike', () => {
  it('HOLD defaults to the actual inherited3S budgets and never spends accumulated luck', () => {
    const s = fixture(), luck = structuredClone(s.winner.luck); s.progression.mastery[oldB] = 100; s.progression.mastery[oldK] = 200;
    expect(effect(s, B, fixedRolls(), 'HOLD', 0.8).enemyReduction).toBe(42.25 * 0.72 * 0.8);
    expect(effect(s, K).enemyReduction).toBe(42.25 * 0.79); expect(s.spirituality).toBe(74);
    expect(s.winner.luck).toEqual(luck); expect(s.winner.encounter.lastLuckRound).toBeNull();
  });
  it('only the first eligible B/K spends exactly1bank+2S, with no hidden random draw for B', () => {
    const s = fixture(), r = fixedRolls();
    for (const id of [H, J, R, A] as const) effect(s, id, r, 'SPEND_FIRST');
    expect(s.winner.luck.stored).toBe(3); expect(effect(s, B, r, 'SPEND_FIRST', 0).enemyReduction).toBe(24);
    expect(s.spirituality).toBe(78); expect(s.winner.luck).toEqual({ stored: 2, accumulated: 3, spent: 1, lastAccumulateWeek: 22 }); expect(s.winner.encounter.lastLuckRound).toBe(1);
    expect(effect(s, K, r, 'SPEND_FIRST').enemyReduction).toBe(42.25 * 0.65); expect(s.spirituality).toBe(75); expect(s.winner.luck.stored).toBe(2); expect(r.cursor).toBe(0);
  });
  it('empty bank falls back to inherited3S; insufficient spirituality uses only S5 ordinary8/0', () => {
    const empty = fixture(); empty.winner.luck = { stored: 0, accumulated: 0, spent: 0, lastAccumulateWeek: null };
    expect(effect(empty, B, fixedRolls(), 'SPEND_FIRST').enemyReduction).toBe(42.25 * 0.65);
    expect(effect(empty, K, fixedRolls(), 'SPEND_FIRST').enemyReduction).toBe(42.25 * 0.65); expect(empty.spirituality).toBe(74); expect(empty.winner.encounter.lastLuckRound).toBeNull();
    const dry = fixture(); dry.spirituality = 1; const before = structuredClone(dry);
    expect(effect(dry, B, fixedRolls(), 'SPEND_FIRST', 0.8).enemyReduction).toBe(8 * 0.8);
    expect(effect(dry, K, fixedRolls(), 'SPEND_FIRST')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(dry).toEqual(before);
    dry.spirituality = 2; effect(dry, B, fixedRolls(), 'SPEND_FIRST'); expect(dry.spirituality).toBe(0); expect(dry.winner.luck.stored).toBe(2);
  });
  it('K pays before one knowledge14 check; success is pending and failure remains paid', () => {
    for (const [roll, success] of [[52, true], [53, false]] as const) {
      const s = fixture(), before = structuredClone(s); let draws = 0;
      const r: ActionRandomStream = { seed: 'payment-order', cursor: 0, nextInt(min, max) {
        draws += 1; expect([min, max]).toEqual([1, 100]); expect(s.spirituality).toBe(78); expect(s.winner.luck.stored).toBe(2); expect(s.winner.encounter.lastLuckRound).toBe(1); return roll;
      } };
      const result = effect(s, K, r, 'SPEND_FIRST'); expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(result.label).toContain(success ? '厄运成功' : '厄运失败'); expect(draws).toBe(1);
      before.spirituality = 78; before.winner.luck.stored = 2; before.winner.luck.spent = 1; before.winner.encounter.lastLuckRound = 1; before.winner.encounter.staggerReady = success; expect(s).toEqual(before);
      effect(s, K, fixedRolls(), 'SPEND_FIRST'); expect(s.winner.luck.spent).toBe(1); expect(s.spirituality).toBe(75);
    }
  });
  it('rejects a fabricated bank rather than counting it as paid luck', () => {
    for (const tamper of [(s: SliceState) => { s.winner.luck.accumulated = 0; }, (s: SliceState) => { s.winner.luck.stored = 4; }, (s: SliceState) => { s.winner.luck.lastAccumulateWeek = null; }]) {
      const s = fixture(); tamper(s); const luck = structuredClone(s.winner.luck);
      expect(effect(s, B, fixedRolls(), 'SPEND_FIRST').label).toContain('继承'); expect(s.winner.luck).toEqual(luck); expect(s.winner.encounter.lastLuckRound).toBeNull();
    }
  });
  it('consumes only the next positive actual ordinary STRIKE and does not stack or affect any earlier action', () => {
    const s = fixture(); expect(consumeWinnerStagger(s, 'STRIKE', 16)).toBeNull(); effect(s, K, fixedRolls(1), 'SPEND_FIRST');
    for (const [id, amount, suppressed] of [['BLOCK', 0, false], ['OPENING', 8, false], ['MISS', 0, false], ['STRIKE', 16, true], ['STRIKE', 0, false], ['STRIKE', -1, false], ['STRIKE', Number.NaN, false]] as const) {
      expect(consumeWinnerStagger(s, id, amount, suppressed)).toBeNull(); expect(s.winner.encounter.staggerReady).toBe(true);
    }
    expect(consumeWinnerStagger(s, 'STRIKE', 16)).toMatchObject({ physicalMultiplier: 0.5 }); expect(consumeWinnerStagger(s, 'STRIKE', 16)).toBeNull();
    expect(s.combat!.enemyHealth).toBe(100); expect(s.health).toBe(100); expect(s.winner.luck.stored).toBe(2);
  });
  it('expires pending K at round or terminal cleanup without refund, refill or persisted future benefit', () => {
    const s = fixture(); effect(s, K, fixedRolls(1), 'SPEND_FIRST'); expect(validateWinnerEncounter(s)).toBe(false);
    expect(finishWinnerCombatRound(s)).toContain('已到期'); expect(s.winner.encounter).toMatchObject({ staggerReady: false, lastLuckRound: 1 });
    expect(s.spirituality).toBe(78); expect(s.winner.luck.stored).toBe(2); expect(finishWinnerCombatRound(s)).toBeNull();
    expect(validateWinnerEncounter(s)).toBe(false); // A direct helper call is not a persisted recorded round.
  });
  it('requires this exact living Aldry scene, continuous history and all actual practice closures', () => {
    const source = currentWinnerCombatSource(fixture())!;
    expect(source).toMatchObject({ target: 'ALDRY_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'ALDRYS_OWN_ORDINARY_SHORT_CLUB', distanceMetres: 2, daylight: true, bystanders: 'NONE', pursuit: false, disasterTrigger: false });
    const changes: ((s: SliceState) => void)[] = [
      s => { s.combat!.encounterId = 'FIRST_CASE'; }, s => { s.combat!.enemyHealth = 0; }, s => { s.combat!.enemyMind = 0; }, s => { s.combat!.enemyStatus = 'DEAD'; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.status = 'DEAD'; }, s => { s.world.city = 'TINGEN'; },
      s => { s.combat!.round = 2; }, s => { s.winner.encounter.attemptWeek = s.week - 1; }, s => { s.winner.practice.counter = 'TRAY'; },
      s => { s.winner.practice.ring = 'MAT'; }, s => { s.winner.practice.note = 'WRITTEN'; }, s => { s.winner.cases['willing-aim']!.contactOpen = true; },
      s => { s.calamityPriest.practice.board = 'FALLEN'; }, s => { s.winner.cases['falling-counter']!.closes = 0; },
    ];
    for (const change of changes) {
      const s = fixture(); change(s); const before = structuredClone(s), r = fixedRolls(); expect(currentWinnerCombatSource(s)).toBeNull();
      for (const [id] of profile) expect(effect(s, id, r, 'SPEND_FIRST', 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(drawWinnerPassiveLuck(s, 'ATTACK', 1, r, source)).toBeNull(); expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
    const s = fixture(), before = structuredClone(s);
    for (const bad of [null, { ...source, round: 2 }, { ...source, target: 'FAKE_TARGET' } as unknown as WinnerCombatSource]) expect(effect(s, K, fixedRolls(), 'SPEND_FIRST', 1, bad).enemyReduction).toBe(0);
    expect(s).toEqual(before);
  });
});

describe('Winner separate inherited passive and exact common-round integration', () => {
  it('retains d100≤25 and45×old passive mastery×physical without touching stored luck', () => {
    for (const [roll, triggered] of [[1, true], [25, true], [26, false], [100, false]] as const) {
      const s = fixture(); s.progression.mastery[passive] = 100; s.progression.mastery[B] = 500; const before = structuredClone(s), r = fixedRolls(roll);
      expect(drawWinnerPassiveLuck(s, 'ATTACK', 0.8, r)).toEqual({ roll, triggered, bonus: triggered ? 45 * 0.72 * 0.8 : 0 }); expect(s).toEqual(before); expect(r.cursor).toBe(1);
    }
    expect(drawWinnerPassiveLuck(fixture(), 'RETREAT', 1, fixedRolls())).toBeNull();
  });
  it('draws passive before both counts exactly once, using its old bonus regardless of bank policy', () => {
    const s = fixture(); const result = scriptedRound(s, 'PREPARE', [25, 1, 1, ticket(R, 'PREPARE'), 400, 1], 'SPEND_FIRST');
    expect(result.round.passiveLuck).toEqual({ roll: 25, triggered: true, bonus: 45 * 0.65 }); expect(result.round.playerCountRoll).toBe(1); expect(result.round.enemyCountRoll).toBe(1);
    expect(result.round.playerAdvantage).toBe(915 + 45 * 0.65); expect(s.winner.luck.stored).toBe(3); expect(s.winner.encounter.lastLuckRound).toBeNull();
  });
  it('uses inherited core15/20/40/25, tier900/floor90/max100 and10S continuing recovery', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100;
    expect(scriptedRound(s, 'ATTACK', [100, 1, 1, ticket(A, 'ATTACK'), 400, 1]).round.playerAdvantage).toBe(927.5 - 22.5);
    const dry = fixture(); dry.spirituality = 0;
    expect(scriptedRound(dry, 'ATTACK', [100, 1, 1, ticket(R, 'ATTACK'), 400, 1]).round.playerAdvantage).toBe(915 * 0.8); expect(dry.spirituality).toBe(10);
    const cap = fixture(); cap.spirituality = 100; cap.character.coreStats = { physique: 1000, perception: 1000, will: 1000, knowledge: 1000 };
    expect(scriptedRound(cap, 'ATTACK', [100, 1, 1, ticket(R, 'ATTACK'), 400, 1]).round.playerAdvantage).toBe(1080); expect(cap.spirituality).toBe(100);
    vi.spyOn(winnerCombat, 'resolveWinnerCombatAbility').mockReturnValue({ label: 'controlled floor', selfGain: -10000, enemyReduction: 0, threatens: false });
    expect(scriptedRound(fixture(), 'ATTACK', [100, 1, 1, ticket(A, 'ATTACK'), 400, 1]).round.playerAdvantage).toBe(90);
  });
  it('first K halves only the later original club strike once and cannot injure Aldry by itself', () => {
    const s = fixture(); const result = scriptedRound(s, 'CONTROL', [100, 33, 46, ticket(K, 'CONTROL'), 1, 1, ticket(R, 'CONTROL'), 1, ticket(R, 'CONTROL'), 1], 'SPEND_FIRST');
    expect(result.round.moves.map(m => m.selfGain)).toEqual([0, 8, 0, 16, 0]); expect(result.round.moves[1]!.label).toContain('×0.5');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequenceWeights).toBeNull(); expect(s.combat!.enemyHealth).toBe(100); expect(s.winner.luck.stored).toBe(2); expect(s.spirituality).toBe(88); expect(validateWinnerEncounter(s)).toBe(true);
  });
  it('B and K share one planned spend and the later K pays only its inherited3S without another luck check', () => {
    const s = fixture(); const result = scriptedRound(s, 'CONTROL', [100, 13, 1, ticket(B, 'CONTROL'), 400, ticket(K, 'CONTROL'), 1], 'SPEND_FIRST');
    expect(result.round.moves[0]!.enemyReduction).toBe(24); expect(result.round.moves[2]!.enemyReduction).toBe(42.25 * 0.65);
    expect(s.spirituality).toBe(85); expect(s.winner.luck.spent).toBe(1); expect(s.winner.encounter.lastLuckRound).toBe(1); expect(validateWinnerEncounter(s)).toBe(true);
  });
  it('late K expires without retroactive benefit, next-round first strike is full, and a fresh paid attempt is allowed', () => {
    const s = fixture(); const first = scriptedRound(s, 'CONTROL', [100, 13, 1, ticket(R, 'CONTROL'), 1, ticket(K, 'CONTROL'), 1, 1], 'SPEND_FIRST');
    expect(first.round.moves[1]!.selfGain).toBe(16); expect(first.round.consequence).toContain('已到期'); expect(s.winner.encounter.staggerReady).toBe(false); expect(validateWinnerEncounter(s)).toBe(true);
    const second = scriptedRound(s, 'CONTROL', [100, 1, 1, 1, ticket(K, 'CONTROL'), 100, 1], 'SPEND_FIRST');
    expect(second.round.moves[0]!.selfGain).toBe(16); expect(second.round.moves[1]!.label).toContain('厄运失败'); expect(s.winner.luck.stored).toBe(1); expect(s.winner.encounter.lastLuckRound).toBe(2); expect(validateWinnerEncounter(s)).toBe(true);
  });
  it('B does not suppress attacks or prevent shared injury despite a bank and a favorable inherited passive', () => {
    const s = fixture(); const result = scriptedRound(s, 'DEFEND', [1, 1, 1, ticket(B, 'DEFEND'), 1, 1000000, 1], 'SPEND_FIRST');
    expect(result.round.moves.map(m => m.selfGain)).toEqual([0, 16]); expect(result.round.moves[0]!.enemyReduction).toBe(24); expect(s.health).toBe(90); expect(s.injuries).toHaveLength(1); expect(s.winner.luck.stored).toBe(2); expect(s.spirituality).toBe(88);
  });
  it('defaults common-round policy to HOLD, rejects invalid or non-winner spending, and replays deterministically', () => {
    const s = fixture(), copy = structuredClone(s); expect(resolveSliceCombatRound(s, 'CONTROL')).toEqual(resolveSliceCombatRound(copy, 'CONTROL', 'HOLD', 'HOLD', null, 'HOLD')); expect(s).toEqual(copy); expect(s.winner.luck.spent).toBe(0);
    expect(() => resolveSliceCombatRound(fixture(), 'CONTROL', 'HOLD', 'HOLD', null, 'REROLL' as WinnerLuckPolicy)).toThrow('积运策略无效');
    const other = fixture(); other.progression.pathwayId = null; other.progression.sequence = null; other.combat!.encounterId = 'FIRST_CASE';
    expect(() => resolveSliceCombatRound(other, 'CONTROL', 'HOLD', 'HOLD', null, 'SPEND_FIRST')).toThrow('当前序列不能选择积运策略');
  });
});

describe('Winner actual encounter, terminal results and persisted round record', () => {
  it('arrival costs1AP without refilling, refusal persists, and ordinary peaceful agreement gives no reward', () => {
    const s = fixture(); available(s); s.actionsRemaining = 2; s.winner.luck = { stored: 0, accumulated: 0, spent: 0, lastAccumulateWeek: null };
    applyWinnerEncounter(s, { type: 'ENCOUNTER_TALK' }, context(100)); expect(s.actionsRemaining).toBe(1); expect(blockWinnerEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('本周'); expect(validateWinnerEncounter(s)).toBe(true);
    applyWinnerEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context()); expect(s.actionsRemaining).toBe(0); expect(s.winner.luck.stored).toBe(0); expect(currentWinnerCombatSource(s)).not.toBeNull(); expect(validateWinnerEncounter(s)).toBe(true);
    const peaceful = fixture(); available(peaceful); const progression = structuredClone(peaceful.progression), luck = structuredClone(peaceful.winner.luck);
    applyWinnerEncounter(peaceful, { type: 'ENCOUNTER_TALK' }, context()); expect(peaceful.winner.encounter.status).toBe('RESOLVED'); expect(peaceful.progression).toEqual(progression); expect(peaceful.winner.luck).toEqual(luck); expect(validateWinnerEncounter(peaceful)).toBe(true);
  });
  it('real original-exit retreat skips passive and bank spending, retains spent resources and awards nothing', () => {
    const s = fixture(); scriptedRound(s, 'CONTROL', [100, 1, 1, ticket(K, 'CONTROL'), 1, 400, 1], 'SPEND_FIRST');
    const spirituality = s.spirituality, luck = structuredClone(s.winner.luck), award = vi.fn();
    const result = scriptedRound(s, 'RETREAT', [100, 100, 400, 1], 'SPEND_FIRST');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.passiveLuck).toBeUndefined(); expect(result.round.consequence).toContain('奥德里'); expect(result.round.consequence).toContain('没有追逐'); expect(s.spirituality).toBe(spirituality); expect(s.winner.luck).toEqual(luck);
    settleWinnerEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(s.combat).toBeNull(); expect(s.winner.encounter.status).toBe('RETREATED'); expect(validateWinnerEncounter(s)).toBe(true);
  });
  it('surrender or death comes from shared actual body attack, preserves original custody, and rewards effective survival once', () => {
    for (const roll of [70, 100]) {
      const s = fixture(), awards: [string, number][] = [];
      const result = scriptedRound(s, 'CONTROL', [100, 13, 1, ticket(K, 'CONTROL'), 1, 400, ticket(H, 'CONTROL'), 1, roll], 'SPEND_FIRST');
      expect(result.outcome).toBe(roll === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD'); expect(result.round.consequence).toContain('奥德里'); expect(result.round.consequence).not.toContain('携铃者'); expect(s.spirituality).toBe(78); expect(s.winner.luck.stored).toBe(2); expect(s.winner.encounter.staggerReady).toBe(false);
      settleWinnerEncounter(s, result.outcome, context(), (source, amount) => { awards.push([source, amount]); s.seer.completedSources.push(source); });
      expect(awards).toEqual([['winner-dispute', 25]]); expect(s.town.clubLocation).toBe('SHOP'); expect(s.progression.acting).toBe(25); expect(s.combat).toBeNull(); expect(validateWinnerEncounter(s)).toBe(true); expect(() => settleWinnerEncounter(s, result.outcome, context(), vi.fn())).toThrow();
    }
  });
  it('player death retains paid cost and clears pending effect with no guarantee, resurrection or reward', () => {
    const s = fixture(), award = vi.fn(); const result = scriptedRound(s, 'CONTROL', [1, 1, 1, ticket(K, 'CONTROL'), 1, 1, 1000000, 100], 'SPEND_FIRST');
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(78); expect(s.winner.luck.stored).toBe(2); expect(s.winner.encounter.staggerReady).toBe(false); s.status = 'DEAD';
    settleWinnerEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(validateWinnerEncounter(s)).toBe(true);
    expect(() => settleWinnerEncounter(fixture(), 'ENEMY_SURRENDERED', context(), vi.fn())).toThrow('不一致');
  });
  it('rejects unrecorded or duplicate paid rounds and persisted pending strike effects', () => {
    const s = fixture(); expect(validateWinnerEncounter(s)).toBe(true); s.winner.encounter.lastLuckRound = 1; expect(validateWinnerEncounter(s)).toBe(false);
    s.winner.encounter.lastLuckRound = null; s.winner.encounter.staggerReady = true; expect(validateWinnerEncounter(s)).toBe(false);
    const recorded = fixture(); scriptedRound(recorded, 'DEFEND', [100, 1, 1, ticket(B, 'DEFEND'), 400, 1], 'SPEND_FIRST'); expect(validateWinnerEncounter(recorded)).toBe(true);
    recorded.combatHistory[0]!.moves.push(structuredClone(recorded.combatHistory[0]!.moves[0]!)); expect(validateWinnerEncounter(recorded)).toBe(false);
  });
});
