import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createWraithState } from '../../src/domain/wraith/index.js';
import {
  WRAITH_COUNT_WHEEL, consumeWraithStagger, currentWraithCombatSource, drawWraithAbility,
  finishWraithCombatRound, isWraith, resolveWraithCombatAbility, wraithAbilityWheel, wraithActionCount,
  type WraithCombatSource, type WraithMoveId,
} from '../../src/domain/wraith/combat.js';
import * as wraithCombat from '../../src/domain/wraith/combat.js';
import {
  applyWraithEncounter, blockWraithEncounter, settleWraithEncounter, validateWraithEncounter,
} from '../../src/domain/wraith/encounter.js';
import { ZOMBIE_COUNT_WHEEL, currentZombieCombatSource, resolveZombieCombatAbility, zombieAbilityWheel } from '../../src/domain/zombie/combat.js';
import { WEREWOLF_COUNT_WHEEL, werewolfAbilityWheel } from '../../src/domain/werewolf/combat.js';
import { MADMAN_COUNT_WHEEL, madmanAbilityWheel, type MadmanBurstPolicy } from '../../src/domain/madman/combat.js';
import { PRISONER_COUNT_WHEEL, prisonerAbilityWheel } from '../../src/domain/prisoner/combat.js';
import { DESIRE_APOSTLE_COUNT_WHEEL, desireApostleAbilityWheel } from '../../src/domain/desire-apostle/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const H = 'SPIRIT_STRIKE', J = 'BODY_FOLLOWUP', B = 'GHOST_DODGE';
const K = 'chained.s5.spirit-possession', R = 'OBSERVE', A = 'ACCIDENT';
const STEEL = 'chained.s6.steel-body';
const profile: readonly [WraithMoveId, number, SliceStance | null][] = [
  [H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], [A, 5, null],
];
/** Synthetic actual arrival only. Natural fixtures separately cover acquisition and original reports. */
function fixture(): SliceState {
  const s = createSliceRun('wraith-combat-test', sliceDefaultCreationSelection, 'wraith-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24; s.arc.stage = 'ENDED';
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'chained', sequence: 5, acting: 25, promotionWeek: 22,
    mastery: { [K]: 0, 'chained.s5.reflection-step': 0, [STEEL]: 0, 'chained.s6.death-craft': 0,
      'chained.s7.regeneration': 0, 'chained.s8.reason-sacrifice': 0 } };
  s.wraith = createWraithState(); s.wraith.promotionWeek = 22;
  Object.assign(s.wraith.cases['reflected-room']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'ROUTE_CHECKED' });
  Object.assign(s.wraith.encounter, { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 });
  s.combat = { encounterId: 'WRAITH_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 80; s.town.clubLocation = 'SHOP';
  return s;
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-wraith', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++]; if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw'); return value;
  } };
}
function ticket(id: WraithMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) { if (candidate === id) return start; start += weight * (stance !== null && stance === preferred ? 5 : 4); }
  throw new Error('Missing test ability');
}
function effect(s: SliceState, id: WraithMoveId, random = fixedRolls(), physical = 1,
  source: WraithCombatSource | null = currentWraithCombatSource(s)) {
  return resolveWraithCombatAbility(s, id, physical, random, source);
}
function scriptedRound(s: SliceState, stance: SliceStance, values: number[], policy: MadmanBurstPolicy = 'HOLD') {
  const next = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    next.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error(`Unexpected random draw ${index}: ${value}, expected ${min}–${max}`); return value;
  });
  try {
    const result = resolveSliceCombatRound(s, stance, 'HOLD', policy); s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length); return result;
  } finally { spy.mockRestore(); }
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) { return scriptedRound(s, stance, values); }
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(s: SliceState): void { s.combat = null; s.wraith.encounter = createWraithState().encounter; }
afterEach(() => vi.restoreAllMocks());

describe('Wraith exact S5 profile and original Bevan source', () => {
  it('routes only chained5 to detached30/15/20/20/10/5 and12/20/25/23/14/6 wheels', () => {
    const s = fixture(); expect(isWraith(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(wraithAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(a => a.id)).toEqual(profile.map(a => a[0]));
    expect(playerAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(playerCountWheel(s)).toEqual(WRAITH_COUNT_WHEEL);
    expect(playerCountWheel(s).map(a => a.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    playerCountWheel(s)[0]!.weight = 0; playerAbilityWheel(s, null)[0]!.weight = 0;
    expect(playerCountWheel(s)[0]!.weight).toBe(12); expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30);
    s.progression.pathwayId = 'abyss'; expect(isWraith(s)).toBe(false);
    expect(playerCountWheel(s)).toEqual(DESIRE_APOSTLE_COUNT_WHEEL);
    expect(playerAbilityWheel(s, null)).toEqual(desireApostleAbilityWheel(null, s));
  });
  it('keeps exact count boundaries and1.25 stance ticket boosts with only one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [32, 2], [33, 3], [57, 3], [58, 4], [80, 4], [81, 5], [94, 5], [95, 6], [100, 6]]) expect(wraithActionCount(roll!)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, weight) => sum + weight, 0); let edge = 0;
      wraithAbilityWheel(stance).forEach((entry, i) => {
        expect(entry.weight).toBe(total === 400 ? weights[i]! / 4 : weights[i]! / total * 100);
        const first = edge + 1; edge += weights[i]!; const r = fixedRolls(first, edge);
        expect(drawWraithAbility(r, stance)).toBe(entry.id); expect(drawWraithAbility(r, stance)).toBe(entry.id); expect(r.cursor).toBe(2);
      });
    }
  });
  it('preserves exact old chained9–6 routing, cold/steel budgets and actual healing', () => {
    const s = fixture();
    for (const [sequence, count, wheel] of [[9, PRISONER_COUNT_WHEEL, prisonerAbilityWheel], [8, MADMAN_COUNT_WHEEL, madmanAbilityWheel],
      [7, WEREWOLF_COUNT_WHEEL, werewolfAbilityWheel], [6, ZOMBIE_COUNT_WHEEL, zombieAbilityWheel]] as const) {
      s.progression.sequence = sequence; expect(isWraith(s)).toBe(false);
      expect(playerCountWheel(s)).toEqual(count); expect(playerAbilityWheel(s, null)).toEqual(wheel(null, s));
      expect(currentWraithCombatSource(s)).toBeNull();
    }
    s.combat!.encounterId = 'FIRST_CASE'; s.arc.stage = 'COMBAT'; s.world.carrierAlive = true; s.world.carrierCanResist = true;
    expect(currentZombieCombatSource(s)).not.toBeNull();
    expect(resolveZombieCombatAbility(s, 'chained.s6.death-craft', 0.8, fixedRolls()).selfGain).toBe(59.15 * 0.65);
    expect(resolveZombieCombatAbility(s, J, 0.8, fixedRolls()).selfGain).toBe(31.85 * 0.65 * 0.8);
    expect(resolveZombieCombatAbility(s, STEEL, 0.8, fixedRolls()).enemyReduction).toBe(59.15 * 0.65 * 0.8);
    s.health = 70; expect(resolveZombieCombatAbility(s, 'chained.s7.regeneration', 1, fixedRolls()).selfGain).toBe(0);
    expect(s.health).toBe(80); expect(s.spirituality).toBe(71);
  });
  it('binds Bevan, his own original club, real2m daylight yard and no second mirror endpoint', () => {
    const s = fixture(), source = currentWraithCombatSource(s)!;
    expect(source).toMatchObject({ target: 'BEVAN_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'BEVANS_OWN_ORDINARY_SHORT_CLUB',
      weaponLocation: 'HAND', distanceMetres: 2, daylight: true, bystanders: 'NONE', pursuit: false,
      secondReflectiveEndpoint: 'NONE_REGISTERED', exit: 'ORIGINAL_OPEN_EXIT' });
    for (const key of Object.keys(source)) {
      const forged = { ...source, [key]: 'WRONG' } as unknown as WraithCombatSource, before = structuredClone(s), r = fixedRolls();
      for (const [id] of profile) expect(effect(s, id, r, 1, forged)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(consumeWraithStagger(s, 'STRIKE', 16, false, forged)).toBeNull(); expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
  });
  it('rejects stale, other-scene, dead, lunar and unclosed-practice sources without mutation or RNG', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.revision += 1; }, s => { s.week += 1; }, s => { s.combat!.round += 1; },
      s => { s.combat!.encounterId = 'ZOMBIE_DISPUTE'; }, s => { s.combat!.encounterId = 'FIRST_CASE'; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; }, s => { s.combat!.enemyHealth = 0; }, s => { s.combat!.enemyMind = 0; },
      s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.status = 'DEAD'; },
      s => { s.wraith.moon.pendingWeek = s.week; }, s => { s.wraith.practice.form = 'WRAITH'; },
      s => { s.wraith.practice.node = 'ALCOVE'; }, s => { s.wraith.practice.host = 'NOLAN'; },
      s => { s.wraith.practice.mirror = 'OPEN'; }, s => { s.wraith.practice.flag = 'RAISED'; },
      s => { s.wraith.practice.note = 'WRITTEN'; }, s => { s.wraith.cases['willing-signal']!.contactOpen = true; },
      s => { s.zombie.practice.spirit = 'PRESENT'; }, s => { s.wraith.encounter.attemptWeek = 1; },
      s => { s.wraith.encounter.startHistoryIndex = 1; }, s => { s.world.city = 'ELSEWHERE'; },
    ];
    for (const mutate of mutations) {
      const s = fixture(), source = currentWraithCombatSource(s); mutate(s); const before = structuredClone(s), r = fixedRolls();
      for (const [id] of profile) expect(effect(s, id, r, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
    const blocked = fixture(); blocked.wraith.moon.pendingWeek = blocked.week;
    expect(() => resolveSliceCombatRound(blocked, 'ATTACK')).toThrow('来源无效');
  });
});

describe('Wraith finite spiritual and inherited bodily actions', () => {
  it('H pays3S for54.925×new mastery without physical scaling or direct damage', () => {
    for (const mastery of [0, 100, 500]) {
      const s = fixture(); s.progression.mastery[K] = mastery; s.progression.mastery[STEEL] = 500;
      const before = structuredClone(s), r = fixedRolls();
      expect(effect(s, H, r, 0.8)).toMatchObject({ selfGain: 54.925 * (0.65 + 0.35 * mastery / 500), enemyReduction: 0, threatens: true });
      before.spirituality -= 3; expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
  });
  it('J inherits only steel mastery and physical factor, while R cannot create a reflection endpoint', () => {
    const s = fixture(); s.progression.mastery[STEEL] = 100; s.progression.mastery[K] = 500;
    const before = structuredClone(s), r = fixedRolls();
    expect(effect(s, J, r, 0.8).selfGain).toBe(29.575 * 0.72 * 0.8);
    const observed = effect(s, R, r); expect(observed).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(observed.label).toContain('没有登记可用的第二反光端点'); expect(s).toEqual(before); expect(r.cursor).toBe(0);
  });
  it('B pays2S for fixed17.55 then fully manifests, with no stateful ghost body or immunity', () => {
    for (const physical of [0, 0.8, 1]) {
      const s = fixture(); s.health = 60; s.mind = 70; s.injuryRisk = 3; s.seer.pollution = 8;
      s.injuries.push({ id: 'old-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
      const before = structuredClone(s), r = fixedRolls(), result = effect(s, B, r, physical);
      expect(result).toMatchObject({ selfGain: 0, enemyReduction: 17.55, threatens: false });
      expect(result.label).toContain('同一动作内完整显形'); expect(result.label).toContain('不跨槽无敌');
      before.spirituality -= 2; expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
  });
  it('prioritizes only the actually held player club, never borrows Bevan’s club or stacks H', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const s = fixture(); s.town.clubLocation = location; s.progression.mastery[K] = 500;
      const town = structuredClone(s.town), opponent = structuredClone(s.combat);
      expect(effect(s, H, fixedRolls(), 0.8).selfGain).toBe(location === 'HAND' ? 16 * 0.8 : 54.925);
      expect(s.spirituality).toBe(location === 'HAND' ? 80 : 77); expect(s.town).toEqual(town); expect(s.combat).toEqual(opponent);
      if (location === 'HAND') expect(wraithAbilityWheel(null, s)[0]!.label).toContain('不叠加');
    }
  });
  it('uses insufficient-S ordinary fallbacks without partial payments, redraws or forged possession attempts', () => {
    for (const spirituality of [0, 1, Number.NaN, Infinity]) {
      const s = fixture(); s.spirituality = spirituality; const before = structuredClone(s), r = fixedRolls();
      expect(effect(s, H, r, 0.8).selfGain).toBe(12 * 0.8);
      expect(effect(s, B, r, 0.8).enemyReduction).toBe(8 * 0.8);
      expect(effect(s, K, r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
    const two = fixture(); two.spirituality = 2;
    expect(effect(two, H).selfGain).toBe(12); expect(effect(two, K).selfGain).toBe(0); expect(two.spirituality).toBe(2);
    expect(effect(two, B).enemyReduction).toBe(17.55); expect(two.spirituality).toBe(0);
  });
  it('bounds malformed masteries and body factors and keeps fixed negative A without another draw', () => {
    for (const mastery of [-1, Number.NaN, Infinity, 900]) {
      const s = fixture(); s.progression.mastery[K] = mastery; s.progression.mastery[STEEL] = mastery;
      const factor = mastery === 900 ? 1 : 0.65;
      expect(effect(s, H, fixedRolls(), Number.NaN).selfGain).toBe(54.925 * factor);
      expect(effect(s, J, fixedRolls(), 2).selfGain).toBe(29.575 * factor);
      expect(effect(s, J, fixedRolls(), -1).selfGain).toBe(0);
    }
    const s = fixture(), before = structuredClone(s), r = fixedRolls();
    expect(effect(s, A, r)).toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false }); expect(s).toEqual(before); expect(r.cursor).toBe(0);
  });
  it('retains explicit paid reason sacrifice only for the first valid physical attack, never H or K', () => {
    const s = fixture(); s.progression.mastery['chained.s8.reason-sacrifice'] = 100;
    const policy = { policy: 'BURST_FIRST' as const, triggered: false, mentalCost: 0, spiritualCost: 0 };
    const source = currentWraithCombatSource(s);
    expect(resolveWraithCombatAbility(s, H, 0.8, fixedRolls(), source, policy).selfGain).toBe(54.925 * 0.65);
    expect(policy.triggered).toBe(false); expect(s.mind).toBe(100);
    expect(resolveWraithCombatAbility(s, K, 1, fixedRolls(1), source, policy).selfGain).toBe(0); expect(policy.triggered).toBe(false);
    expect(resolveWraithCombatAbility(s, J, 0.8, fixedRolls(), source, policy).selfGain).toBe(29.575 * 0.65 * 0.8 * (1 + 0.25 * 0.72));
    expect(s.spirituality).toBe(72); expect(s.mind).toBe(90); expect(policy).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
    expect(resolveWraithCombatAbility(s, J, 0.8, fixedRolls(), source, policy).selfGain).toBe(29.575 * 0.65 * 0.8);
    expect(s.spirituality).toBe(72); expect(s.mind).toBe(90);
  });
});

describe('Wraith resistible same-action possession and one-strike residual hesitation', () => {
  it('successful K pays before its only roll, explicitly exits, and preserves original people/items and practice', () => {
    const s = fixture(), before = structuredClone(s); let draws = 0;
    const r: ActionRandomStream = { seed: 'payment-order', cursor: 0, nextInt(min, max) {
      draws += 1; expect([min, max]).toEqual([1, 100]); expect(s.spirituality).toBe(77); expect(s.wraith.encounter.lastPossessionRound).toBe(1); return 1;
    } };
    const result = effect(s, K, r); expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.label).toContain('明确退出'); expect(result.label).toContain('完整显形'); expect(result.label).toContain('不是持续附身'); expect(draws).toBe(1);
    before.spirituality = 77; before.wraith.encounter.lastPossessionRound = 1; before.wraith.encounter.staggerReady = true;
    expect(s).toEqual(before);
    expect(effect(s, K).label).toContain('本轮已经尝试'); expect(s.spirituality).toBe(77);
  });
  it('repelled K pays full3S, records attempt and leaves no host or hesitation, with no same-round retry', () => {
    const s = fixture(), before = structuredClone(s), r = fixedRolls(100);
    const result = effect(s, K, r); expect(result.label).toContain('抗拒并排斥'); expect(result.label).toContain('被排出并完整显形');
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    before.spirituality = 77; before.wraith.encounter.lastPossessionRound = 1;
    expect(s).toEqual(before); expect(r.cursor).toBe(1); expect(effect(s, K).label).toContain('本轮已经尝试'); expect(s).toEqual(before);
  });
  it('consumes only the next actually executed positive ordinary STRIKE, never defense, suppression or zero', () => {
    const s = fixture(); effect(s, K, fixedRolls(1));
    for (const [id, contribution, suppressed] of [['BLOCK', 0, false], ['OPENING', 8, false], ['DISTANCE', 0, false], ['MISS', 0, false], ['STRIKE', 16, true], ['STRIKE', 0, false], ['STRIKE', Number.NaN, false]] as const) {
      expect(consumeWraithStagger(s, id, contribution, suppressed)).toBeNull(); expect(s.wraith.encounter.staggerReady).toBe(true);
    }
    expect(consumeWraithStagger(s, 'STRIKE', 16)).toMatchObject({ physicalMultiplier: 0.5 });
    expect(s.wraith.encounter.staggerReady).toBe(false); expect(consumeWraithStagger(s, 'STRIKE', 16)).toBeNull();
    expect(s.wraith.practice).toEqual(createWraithState().practice); expect(s.combat!.enemyHealth).toBe(100);
  });
  it('expires unused hesitation at every round end without refund and rejects persisted ongoing effects', () => {
    const s = fixture(); effect(s, K, fixedRolls(1)); expect(validateWraithEncounter(s)).toBe(false);
    expect(finishWraithCombatRound(s)).toContain('迟疑到期'); expect(s.wraith.encounter.staggerReady).toBe(false);
    expect(s.spirituality).toBe(77); expect(s.wraith.encounter.lastPossessionRound).toBe(1); expect(finishWraithCombatRound(s)).toBeNull();
    expect(validateWraithEncounter(s)).toBe(false); // An unrecorded direct helper call is not a persisted round.
  });
});

describe('Wraith common round, actual encounter and terminal consequences', () => {
  it('uses inherited core50/20/15/15, tier900/floor90/max100 and only continuing-round10S recovery', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 100;
    expect(recordedRound(s, 'ATTACK', 1, 1, ticket(A, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(919.5 - 22.5);
    const dry = fixture(); dry.spirituality = 0;
    expect(recordedRound(dry, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(915 * 0.8); expect(dry.spirituality).toBe(10);
    const cap = fixture(); cap.spirituality = 100; cap.character.coreStats = { physique: 1000, perception: 1000, will: 1000, knowledge: 1000 };
    expect(recordedRound(cap, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(1080); expect(cap.spirituality).toBe(100);
    vi.spyOn(wraithCombat, 'resolveWraithCombatAbility').mockReturnValue({ label: 'controlled floor', selfGain: -10000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'ATTACK', 1, 1, ticket(A, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(90);
  });
  it('one real K weakens only the later original Bevan club strike and cannot injure him on its own', () => {
    const s = fixture(); const result = recordedRound(s, 'CONTROL', 33, 46, ticket(K, 'CONTROL'), 1, 161, ticket(K, 'CONTROL'), 1, ticket(R, 'CONTROL'), 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves.map(m => m.selfGain)).toEqual([0, 0, 0, 8, 0]);
    expect(result.round.moves[3]!.label).toContain('×0.5'); expect(result.round.consequenceWeights).toBeNull();
    expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyStatus).toBe('RESISTING'); expect(s.spirituality).toBe(87);
    expect(s.wraith.encounter).toMatchObject({ staggerReady: false, lastPossessionRound: 1 }); expect(validateWraithEncounter(s)).toBe(true);
  });
  it('unused K expires, second-round enemy first strike is whole, and a later round can try again', () => {
    const s = fixture(); const first = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 400, 1);
    expect(first.round.consequence).toContain('迟疑到期'); expect(s.wraith.encounter.staggerReady).toBe(false); expect(validateWraithEncounter(s)).toBe(true);
    const second = recordedRound(s, 'CONTROL', 1, 1, 1, ticket(K, 'CONTROL'), 100, 1);
    expect(second.round.moves[0]!.selfGain).toBe(16); expect(second.round.moves[1]!.label).toContain('有限附身失败');
    expect(s.wraith.encounter).toMatchObject({ lastPossessionRound: 2, staggerReady: false }); expect(validateWraithEncounter(s)).toBe(true);
  });
  it('B does not suppress the later enemy strike or prevent shared real damage', () => {
    const s = fixture(); const result = recordedRound(s, 'DEFEND', 1, 1, ticket(B, 'DEFEND'), 1, 1000000, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves.map(m => m.selfGain)).toEqual([0, 16]);
    expect(result.round.moves[0]!.enemyReduction).toBe(17.55); expect(s.health).toBe(90); expect(s.injuries).toHaveLength(1);
    expect(s.spirituality).toBe(88); expect(s.wraith.practice.form).toBe('HUMAN');
  });
  it('public common policy defaults HOLD and explicit burst charges once while preserving injury rules', () => {
    const hold = fixture(); const first = recordedRound(hold, 'ATTACK', 1, 1, ticket(J, 'ATTACK'), 400, 1, 1);
    expect(first.round.madmanBurst).toEqual({ policy: 'HOLD', triggered: false, mentalCost: 0, spiritualCost: 0 }); expect(hold.mind).toBe(100);
    const s = fixture(); const result = scriptedRound(s, 'ATTACK', [13, 1, ticket(H, 'ATTACK'), 400, ticket(J, 'ATTACK'), 1, 1], 'BURST_FIRST');
    expect(result.round.madmanBurst).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
    expect(s.mind).toBe(90); expect(s.spirituality).toBe(85); expect(result.round.moves[0]!.selfGain).toBe(54.925 * 0.65);
  });
  it('arrival costs1AP, refusal persists, peaceful resolution gives no reward and moon blocks either start', () => {
    const s = fixture(); available(s); s.actionsRemaining = 2;
    applyWraithEncounter(s, { type: 'ENCOUNTER_TALK' }, context(100)); expect(s.actionsRemaining).toBe(1);
    expect(s.wraith.encounter.status).toBe('AVAILABLE'); expect(blockWraithEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('本周');
    expect(validateWraithEncounter(s)).toBe(true); const ctx = context(); applyWraithEncounter(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
    expect(s.actionsRemaining).toBe(0); expect(currentWraithCombatSource(s)).not.toBeNull(); expect(validateWraithEncounter(s)).toBe(true);
    expect(ctx.note).toHaveBeenCalledWith('贝文原外院的有限冲突', expect.stringContaining('第二反光端点'));
    const peaceful = fixture(); available(peaceful); const before = structuredClone(peaceful.progression);
    applyWraithEncounter(peaceful, { type: 'ENCOUNTER_TALK' }, context()); expect(peaceful.wraith.encounter.status).toBe('RESOLVED'); expect(peaceful.progression).toEqual(before); expect(validateWraithEncounter(peaceful)).toBe(true);
    const moon = fixture(); available(moon); moon.wraith.moon.pendingWeek = moon.week;
    for (const type of ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) expect(blockWraithEncounter(moon, { type })).toContain('极度虚弱');
  });
  it('real original-exit retreat preserves costs and moon history without terminal regen, pursuit or reward', () => {
    const s = fixture(); recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 400, 1);
    const spirituality = s.spirituality, award = vi.fn(), moon = structuredClone(s.wraith.moon);
    const result = recordedRound(s, 'RETREAT', 100, 100, 400, 1);
    expect(result.outcome).toBe('RETREATED'); expect(result.round.consequence).toContain('贝文'); expect(result.round.consequence).toContain('实际原出口');
    expect(result.round.consequence).toContain('没有追逐'); expect(s.spirituality).toBe(spirituality); expect(s.wraith.moon).toEqual(moon);
    settleWraithEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(s.wraith.encounter.status).toBe('RETREATED'); expect(s.combat).toBeNull(); expect(validateWraithEncounter(s)).toBe(true);
  });
  it('enemy surrender/death follow real shared H consequences, preserve original custody and award surviving effective participation once', () => {
    for (const roll of [70, 100]) {
      const s = fixture(), awards: [string, number][] = [];
      const result = recordedRound(s, 'CONTROL', 13, 1, ticket(K, 'CONTROL'), 1, 400, ticket(H, 'CONTROL'), 1, roll);
      expect(result.outcome).toBe(roll === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD'); expect(result.round.consequence).toContain('贝文'); expect(s.spirituality).toBe(74);
      expect(s.wraith.encounter).toMatchObject({ staggerReady: false, lastPossessionRound: 1 });
      if (roll === 100) expect(s.combat!.enemyHealth).toBe(0);
      settleWraithEncounter(s, result.outcome, context(), (source, amount) => { awards.push([source, amount]); s.seer.completedSources.push(source); });
      expect(awards).toEqual([['wraith-dispute', 25]]); expect(s.town.clubLocation).toBe('SHOP'); expect(s.progression.acting).toBe(25);
      expect(s.combat).toBeNull(); expect(validateWraithEncounter(s)).toBe(true); expect(() => settleWraithEncounter(s, result.outcome, context(), vi.fn())).toThrow();
    }
  });
  it('player death clears hesitation after actual same-action exit, with no refund, revival or award', () => {
    const s = fixture(), award = vi.fn(); const result = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1000000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(result.round.consequence).toContain('贝文'); expect(s.health).toBe(0); expect(s.spirituality).toBe(77);
    expect(s.wraith.encounter).toMatchObject({ staggerReady: false, lastPossessionRound: 1 }); expect(s.wraith.practice.form).toBe('HUMAN'); s.status = 'DEAD';
    settleWraithEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(validateWraithEncounter(s)).toBe(true);
    expect(() => settleWraithEncounter(fixture(), 'ENEMY_SURRENDERED', context(), vi.fn())).toThrow('不一致');
  });
  it('rejects fabricated persisted possession rounds/effects and deterministically replays actual common combat', () => {
    const s = fixture(); expect(validateWraithEncounter(s)).toBe(true);
    s.wraith.encounter.lastPossessionRound = 1; expect(validateWraithEncounter(s)).toBe(false);
    s.wraith.encounter.lastPossessionRound = null; s.wraith.encounter.staggerReady = true; expect(validateWraithEncounter(s)).toBe(false);
    const original = fixture(), copy = structuredClone(original);
    expect(resolveSliceCombatRound(original, 'CONTROL')).toEqual(resolveSliceCombatRound(copy, 'CONTROL')); expect(original).toEqual(copy);
  });
});
