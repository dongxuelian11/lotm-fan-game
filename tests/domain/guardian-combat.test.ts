import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createGuardianState } from '../../src/domain/guardian/index.js';
import {
  GUARDIAN_COUNT_WHEEL, beginGuardianCombatRound, consumeGuardianDefense, currentGuardianCombatSource,
  drawGuardianAbility, finishGuardianCombatRound, guardianAbilityWheel, guardianActionCount, isGuardian,
  resolveGuardianCombatAbility, type GuardianCombatSource, type GuardianMoveId,
} from '../../src/domain/guardian/combat.js';
import * as guardianCombat from '../../src/domain/guardian/combat.js';
import { applyGuardianEncounter, blockGuardianEncounter, settleGuardianEncounter, validateGuardianEncounter } from '../../src/domain/guardian/encounter.js';
import { DAWN_PALADIN_COUNT_WHEEL, dawnPaladinAbilityWheel } from '../../src/domain/dawn-paladin/combat.js';
import { WEAPONMASTER_COUNT_WHEEL, weaponmasterAbilityWheel } from '../../src/domain/weaponmaster/combat.js';
import { GLADIATOR_COUNT_WHEEL, gladiatorAbilityWheel } from '../../src/domain/gladiator/combat.js';
import { WARRIOR_COUNT_WHEEL, warriorAbilityWheel } from '../../src/domain/warrior/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const H = 'warrior.s6.dawn-weapon', J = 'warrior.s6.light-storm', B = 'warrior.s5.guard-state', K = 'warrior.s5.damage-sharing';
const profile: readonly [GuardianMoveId, number, SliceStance | null][] = [
  [H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'],
  ['OBSERVE', 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
/** Synthetic actual arrival for isolated branches, not natural promotion evidence. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('guardian-combat-test', sliceDefaultCreationSelection, 'guardian-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'warrior', sequence: 5, mastery: { [B]: 0, [K]: 0 }, acting: 25, promotionWeek: 22 };
  s.guardian = createGuardianState(); s.guardian.promotionWeek = 22;
  Object.assign(s.guardian.cases['guarded-load']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'PROBE_REMOVED' });
  Object.assign(s.guardian.encounter, { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 });
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'GUARDIAN_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  Object.assign(s.warrior.practiceClub, { custodian: 'MENTOR', location: 'training-rack' });
  return s;
}
function ticket(id: GuardianMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-guardian', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw');
    return value;
  } };
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, min, max,
  ) {
    original.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw ' + index);
    return value;
  });
  try {
    const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length); return result;
  } finally { spy.mockRestore(); }
}
function effect(s: SliceState, id: GuardianMoveId, context = beginGuardianCombatRound(s, 'ATTACK'),
  random = fixedRolls(), physical = 1, source: GuardianCombatSource | null = currentGuardianCombatSource(s)) {
  return resolveGuardianCombatAbility(s, id, physical, random, context, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
afterEach(() => vi.restoreAllMocks());

describe('Guardian S5 finite profile and actual source', () => {
  it('routes a detached full six-slot wheel and six action counts', () => {
    const s = fixture(); expect(isGuardian(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(guardianAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(a => a.id)).toEqual(profile.map(a => a[0]));
    expect(playerAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(playerCountWheel(s)).toEqual(GUARDIAN_COUNT_WHEEL);
    expect(playerCountWheel(s).map(a => a.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    playerAbilityWheel(s, null)[0]!.weight = 0; playerCountWheel(s)[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30); expect(playerCountWheel(s)[0]!.weight).toBe(12);
    expect(playerAbilityWheel(s, 'DEFEND').every(a => a.label.includes('本轮全程放弃攻击'))).toBe(true);
  });
  it('keeps exact bounded draw/count boundaries and normalized stance weights', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [32, 2], [33, 3], [57, 3], [58, 4], [80, 4], [81, 5], [94, 5], [95, 6], [100, 6]]) expect(guardianActionCount(roll!)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((a, b) => a + b, 0);
      for (const [index, [id]] of profile.entries()) {
        const random = fixedRolls(ticket(id, stance)); expect(drawGuardianAbility(random, stance)).toBe(id); expect(random.cursor).toBe(1);
        expect(guardianAbilityWheel(stance)[index]!.weight).toBeCloseTo(weights[index]! / total * 100, 12);
      }
    }
  });
  it('uses warrior core45/20/25/10, tier900/floor90, max100 and recovery10', () => {
    const s = fixture(); s.spirituality = 90;
    s.character.coreStats = { physique: 20, perception: 10, will: 40, knowledge: 30 };
    const result = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 400, 1);
    expect(result.round.playerAdvantage).toBe(924); expect(result.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(100);
    const capped = fixture(); capped.character.coreStats = { physique: 200, perception: 200, will: 200, knowledge: 200 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 10;
    expect(recordedRound(capped, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 400, 1).round.playerAdvantage).toBe(648);
    expect(capped.spirituality).toBe(20);
    vi.spyOn(guardianCombat, 'resolveGuardianCombatAbility').mockReturnValue({ label: 'bounded floor test', selfGain: -5000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 400, 1).round.playerAdvantage).toBe(90);
  });
  it('requires the original Edwin arrival, actual closed report and no live ally or old practice', () => {
    const s = fixture(); expect(currentGuardianCombatSource(s)).toMatchObject({ target: 'EDWIN_SINGLE_ADULT_ORDINARY_HUMAN',
      weapon: 'EDWINS_OWN_ORDINARY_SHORT_CLUB', distanceMetres: 2, ally: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    for (const mutate of [
      (x: SliceState) => { x.guardian.encounter.attemptWeek = x.week - 1; },
      (x: SliceState) => { x.guardian.cases['guarded-load']!.closes = 0; },
      (x: SliceState) => { x.guardian.practice.allyPresent = true; x.guardian.practice.allyDistance = 2; },
      (x: SliceState) => { x.guardian.practice.guardActive = true; },
      (x: SliceState) => { x.dawnPaladin.practice.armorActive = true; },
      (x: SliceState) => { x.combat!.round = 2; },
    ]) { const bad = structuredClone(s); mutate(bad); expect(currentGuardianCombatSource(bad)).toBeNull(); expect(() => resolveSliceCombatRound(bad, 'ATTACK')).toThrow(); }
    const stale = currentGuardianCombatSource(s)!; s.revision += 1;
    expect(effect(s, H, beginGuardianCombatRound(s, 'ATTACK'), fixedRolls(), 1, stale)).toMatchObject({ selfGain: 0, threatens: false });
  });
  it('keeps the real first-case carrier and ordinary actions without borrowing Edwin gear', () => {
    const s = fixture(true), old = structuredClone(s.guardian.encounter);
    expect(currentGuardianCombatSource(s)).toMatchObject({ target: 'ORIGINAL_LIVING_CARRIER', encounterId: 'FIRST_CASE' });
    s.town.clubLocation = 'HAND'; expect(effect(s, H).selfGain).toBe(16); expect(effect(s, J).selfGain).toBe(8);
    expect(effect(s, 'OBSERVE').label).toContain('原携铃者'); expect(s.guardian.encounter).toEqual(old);
    const result = recordedRound(s, 'DEFEND', 1, 1, ticket(H, 'DEFEND'), 1, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.consequence).toContain('携铃者');
    expect(result.round.consequence).not.toContain('埃德温'); expect(s.combat!.enemyHealth).toBe(100);
    s.world.carrierAlive = false; expect(currentGuardianCombatSource(s)).toBeNull();
  });
  it('retains old warrior S9 to S6 wheels exactly', () => {
    const s = fixture();
    for (const [sequence, wheel, counts] of [[6, dawnPaladinAbilityWheel, DAWN_PALADIN_COUNT_WHEEL],
      [7, weaponmasterAbilityWheel, WEAPONMASTER_COUNT_WHEEL], [8, gladiatorAbilityWheel, GLADIATOR_COUNT_WHEEL],
      [9, warriorAbilityWheel, WARRIOR_COUNT_WHEEL]] as const) {
      s.progression.sequence = sequence; expect(playerAbilityWheel(s, null)).toEqual(wheel(null, s)); expect(playerCountWheel(s)).toEqual(counts);
    }
  });
});

describe('Guardian whole-round defense and real inherited costs', () => {
  it('pays once and makes both attack slots harmless, including an already prepared sword', () => {
    const s = fixture(); s.guardian.encounter.swordReady = true; s.spirituality = 80;
    const old = structuredClone(s.dawnPaladin), round = beginGuardianCombatRound(s, 'DEFEND');
    expect(s.spirituality).toBe(77);
    for (const id of [H, J] as const) expect(effect(s, id, round)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(77); expect(s.guardian.encounter.swordReady).toBe(true); expect(s.dawnPaladin).toEqual(old);
    expect(consumeGuardianDefense(s, round, 'STRIKE', 16)?.physicalMultiplier).toBe(0.35);
    expect(consumeGuardianDefense(s, round, 'OPENING', 8)).toBeNull();
    expect(consumeGuardianDefense(s, round, 'STRIKE', 16, true)).toBeNull();
  });
  it('never wounds, kills, surrenders or increases enemy risk when defensive advantage wins', () => {
    const s = fixture(); s.spirituality = 80; s.combat!.enemyHealth = 70; s.combat!.enemyRisk = 3;
    s.combat!.enemyInjuries.push({ id: 'old-enemy-injury', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    const before = structuredClone(s.combat!);
    const result = recordedRound(s, 'DEFEND', 1, 1, ticket(H, 'DEFEND'), 1, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.winner).toBe('PLAYER'); expect(result.round.consequenceWeights).toBeNull();
    expect(result.round.moves.find(m => m.actor === 'PLAYER')?.selfGain).toBe(0);
    expect(result.round.moves.find(m => m.actor === 'ENEMY')?.selfGain).toBeCloseTo(16 * 0.35);
    expect(s.combat).toMatchObject({ enemyHealth: before.enemyHealth, enemyInjuries: before.enemyInjuries, enemyRisk: before.enemyRisk, enemyStatus: 'RESISTING' });
    expect(s.spirituality).toBe(87); expect(result.round.consequence).toContain('整轮没有攻击');
  });
  it('offense has weaker defense, attacks legally, and unpaid defensive intent still forgoes attacks', () => {
    const s = fixture(), round = beginGuardianCombatRound(s, 'ATTACK');
    expect(effect(s, H, round)).toMatchObject({ selfGain: 12, threatens: true });
    expect(consumeGuardianDefense(s, round, 'STRIKE', 16)?.physicalMultiplier).toBe(0.75);
    const offense = recordedRound(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 1, 1, 1);
    expect(offense.round.moves.find(m => m.actor === 'ENEMY')?.selfGain).toBe(12); expect(s.combat!.enemyHealth).toBe(90);
    const poor = fixture(); poor.spirituality = 2; const unpaid = beginGuardianCombatRound(poor, 'DEFEND');
    expect(unpaid.paidGuard).toBe(false); expect(poor.spirituality).toBe(2);
    expect(effect(poor, H, unpaid).threatens).toBe(false); expect(effect(poor, J, unpaid).threatens).toBe(false);
    expect(consumeGuardianDefense(poor, unpaid, 'STRIKE', 16)?.physicalMultiplier).toBe(1);
  });
  it('K has no fabricated ally, no sharing and no spirituality charge; B uses its own mastery', () => {
    const s = fixture(), before = structuredClone(s.guardian.practice), round = beginGuardianCombatRound(s, 'ATTACK');
    expect(effect(s, K, round)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(effect(s, K, round).label).toContain('实际分担伤害0'); expect(s.spirituality).toBe(100); expect(s.guardian.practice).toEqual(before);
    expect(effect(s, B, round).enemyReduction).toBeCloseTo(35.1 * 0.65);
    s.progression.mastery[B] = 500; expect(effect(s, B, round).enemyReduction).toBeCloseTo(35.1);
  });
  it('requires actual empty hands to condense, exact inherited attack/storm costs and next-round recondensation', () => {
    const s = fixture(), old = structuredClone(s.dawnPaladin), round = beginGuardianCombatRound(s, 'ATTACK');
    s.town.clubLocation = 'HAND'; expect(effect(s, H, round).selfGain).toBe(16);
    expect(effect(s, 'OBSERVE', round).selfGain).toBe(0); expect(s.guardian.encounter.swordReady).toBe(false);
    s.town.clubLocation = 'SHOP'; expect(effect(s, H, round).selfGain).toBe(12);
    effect(s, 'OBSERVE', round); expect(s.spirituality).toBe(97); expect(s.guardian.encounter.swordReady).toBe(true);
    expect(effect(s, H, round).selfGain).toBeCloseTo(71.825 * 0.65); expect(s.spirituality).toBe(95);
    Object.assign(s.guardian.encounter, { armorReady: true, armorExpiresRound: 2 });
    expect(effect(s, J, round).selfGain).toBeCloseTo(38.675 * 0.65); expect(s.spirituality).toBe(91);
    expect(s.guardian.encounter).toMatchObject({ swordReady: false, swordLostRound: 1, armorReady: false, armorExpiresRound: null });
    expect(effect(s, 'OBSERVE', round).label).toContain('本回合不能重凝'); expect(s.spirituality).toBe(91);
    expect(effect(s, J, round).selfGain).toBe(8); expect(s.dawnPaladin).toEqual(old);
    const completed = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 400, 1);
    expect(completed.outcome).toBe('CONTINUE');
    effect(s, 'OBSERVE'); expect(s.spirituality).toBe(97); expect(s.guardian.encounter.swordReady).toBe(true);
  });
  it('never spends an unaffordable sword cost or builds phantom gear', () => {
    const s = fixture(); s.spirituality = 2; expect(effect(s, 'OBSERVE').selfGain).toBe(0);
    expect(s.guardian.encounter.swordReady).toBe(false); expect(s.spirituality).toBe(2);
    s.guardian.encounter.swordReady = true; s.spirituality = 1;
    expect(effect(s, H).selfGain).toBe(12); expect(effect(s, J).selfGain).toBe(8);
    expect(s.spirituality).toBe(1); expect(s.guardian.encounter.swordReady).toBe(true);
  });
  it('takes only the strongest armor multiplier and expires without changing the old S6 record', () => {
    for (const stance of ['ATTACK', 'DEFEND'] as const) {
      const s = fixture(), old = structuredClone(s.dawnPaladin), round = beginGuardianCombatRound(s, stance);
      Object.assign(s.guardian.encounter, { armorReady: true, armorExpiresRound: 2 });
      expect(consumeGuardianDefense(s, round, 'STRIKE', 16)?.physicalMultiplier).toBe(stance === 'DEFEND' ? 0.35 : 0.6);
      expect(s.guardian.encounter.armorReady).toBe(false); expect(s.dawnPaladin).toEqual(old);
      Object.assign(s.guardian.encounter, { armorReady: true, armorExpiresRound: 1 });
      expect(finishGuardianCombatRound(s, true)).toContain('消散'); expect(s.guardian.encounter.armorReady).toBe(false);
    }
  });
  it('accident ±22.5 is not an attack in either stance', () => {
    for (const stance of ['ATTACK', 'DEFEND'] as const) for (const roll of [1, 2]) {
      const s = fixture(), round = beginGuardianCombatRound(s, stance), before = s.spirituality;
      expect(effect(s, 'ACCIDENT', round, fixedRolls(roll))).toMatchObject({ selfGain: roll === 1 ? -22.5 : 22.5, threatens: false });
      expect(s.spirituality).toBe(before);
    }
  });
});

describe('Guardian consequences and finite encounter', () => {
  it('still takes real injury or death when guard loses and gets no terminal recovery', () => {
    for (const roll of [1, 100]) {
      const s = fixture(); s.spirituality = 80;
      const result = recordedRound(s, 'DEFEND', 1, 1, ticket(H, 'DEFEND'), 1, 1_000_000, roll);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(s.health).toBe(roll === 1 ? 90 : 0); expect(s.spirituality).toBe(roll === 1 ? 87 : 77);
      expect(result.outcome).toBe(roll === 1 ? 'CONTINUE' : 'PLAYER_DEAD'); expect(result.round.consequence).toContain('埃德温');
      if (roll === 100) {
        s.status = 'DEAD'; const award = vi.fn(); settleGuardianEncounter(s, result.outcome, context(), award);
        expect(award).not.toHaveBeenCalled(); expect(s.guardian.encounter.status).toBe('LOST'); expect(validateGuardianEncounter(s)).toBe(true);
      }
    }
  });
  it('actual offense can injure then end in surrender and award only once', () => {
    const s = fixture(), ctx = context(), awards: unknown[] = [];
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 400, 1, 70);
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(s.combat!.enemyHealth).toBe(70);
    expect(result.round.consequence).toContain('埃德温'); expect(result.round.consequence).not.toContain('携铃者');
    settleGuardianEncounter(s, result.outcome, ctx, (source, amount) => { awards.push([source, amount]); s.seer.completedSources.push(source); });
    expect(awards).toEqual([['guardian-dispute', 25]]); expect(s.guardian.encounter.status).toBe('RESOLVED');
    expect(validateGuardianEncounter(s)).toBe(true); expect(() => settleGuardianEncounter(s, result.outcome, ctx, vi.fn())).toThrow();
    expect(blockGuardianEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
  });
  it('records actual Edwin death without resurrection, duplicate opponent or resource recovery', () => {
    const s = fixture(); s.spirituality = 60;
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 400, 1, 100);
    expect(result.outcome).toBe('ENEMY_DEAD'); expect(s.combat!.enemyHealth).toBe(0); expect(s.spirituality).toBe(60);
    expect(result.round.consequence).toContain('埃德温'); const ctx = context();
    settleGuardianEncounter(s, result.outcome, ctx, () => {});
    expect(ctx.note).toHaveBeenCalledWith('原外院真实冲突结束', expect.stringContaining('埃德温在原战斗中真实死亡'));
    expect(blockGuardianEncounter(s, { type: 'ENCOUNTER_FIGHT' })).not.toBeNull();
  });
  it('real exit retains health and spirituality, clears only new temporary gear and earns no reward', () => {
    const s = fixture(), old = structuredClone(s.dawnPaladin), award = vi.fn(); s.spirituality = 73;
    s.guardian.encounter.swordReady = true;
    const result = recordedRound(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(s.spirituality).toBe(73); expect(s.health).toBe(100);
    expect(result.round.consequence).toContain('埃德温'); expect(result.round.consequence).toContain('原出口');
    settleGuardianEncounter(s, result.outcome, context(), award);
    expect(award).not.toHaveBeenCalled(); expect(s.guardian.encounter.status).toBe('RETREATED');
    expect(s.guardian.encounter.swordReady).toBe(false); expect(s.dawnPaladin).toEqual(old); expect(validateGuardianEncounter(s)).toBe(true);
  });
  it('requires physical closure, spends one arrival action, and permits ordinary peaceful resolution', () => {
    const s = fixture(); s.combat = null; s.guardian.encounter = createGuardianState().encounter; s.actionsRemaining = 2;
    s.guardian.practice.allyPresent = true; s.guardian.practice.allyDistance = 2;
    expect(blockGuardianEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toContain('同伴');
    s.guardian.practice.allyPresent = false; s.guardian.practice.allyDistance = null;
    applyGuardianEncounter(s, { type: 'ENCOUNTER_TALK' }, context());
    expect(s.actionsRemaining).toBe(1); expect(s.guardian.encounter.status).toBe('RESOLVED');
    expect(s.combat).toBeNull(); expect(s.seer.completedSources).not.toContain('guardian-dispute'); expect(validateGuardianEncounter(s)).toBe(true);
  });
  it('refuses an invented enemy ending after a defending win', () => {
    const s = fixture(); const result = recordedRound(s, 'DEFEND', 1, 1, ticket(H, 'DEFEND'), 400, 1);
    expect(result.outcome).toBe('CONTINUE'); s.combat!.enemyStatus = 'SURRENDERED';
    expect(() => settleGuardianEncounter(s, 'ENEMY_SURRENDERED', context(), vi.fn())).toThrow('不一致');
  });
});
