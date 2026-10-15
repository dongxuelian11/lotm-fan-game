import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  ZOMBIE_COUNT_WHEEL, currentZombieCombatSource, drawZombieAbility, isZombie,
  resolveZombieCombatAbility, zombieAbilityWheel, zombieActionCount, type ZombieCombatSource, type ZombieMoveId,
} from '../../src/domain/zombie/combat.js';
import * as zombieCombat from '../../src/domain/zombie/combat.js';
import { PRISONER_COUNT_WHEEL, prisonerAbilityWheel } from '../../src/domain/prisoner/combat.js';
import { MADMAN_COUNT_WHEEL, madmanAbilityWheel } from '../../src/domain/madman/combat.js';
import { WEREWOLF_COUNT_WHEEL, currentWerewolfCombatSource, resolveWerewolfCombatAbility, werewolfAbilityWheel }
  from '../../src/domain/werewolf/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'chained.s6.death-craft', J = 'BODY_FOLLOWUP', B = 'chained.s6.steel-body';
const K = 'POSITION', R = 'chained.s7.regeneration', A = 'ACCIDENT';
const ids = [H, J, B, K, R, A] as const;

/** Combat-arrival fixture only; growth tests cover original paid commands. */
function fixture(firstCase = false): SliceState {
  const state = createSliceRun('zombie-combat-test', sliceDefaultCreationSelection, 'zombie-combat');
  state.activeEvent = null; state.arc.stage = firstCase ? 'COMBAT' : 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'chained', sequence: 6, acting: 0, promotionWeek: 1,
    mastery: { [H]: 0, [B]: 0, [R]: 0, 'chained.s9.prisoner-body': 0, 'chained.s9.keen-perception': 0,
      'chained.s9.improvised-combat': 0, 'chained.s8.reason-sacrifice': 0, 'chained.s7.werewolf-body': 0 } };
  Object.assign(Object.values(state.zombie.cases)[0]!, { status: 'RESOLVED', method: 'ORDINARY' });
  state.zombie.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length, attemptWeek: state.week };
  state.zombie.practice = { body: 'NORMAL', cold: 'NONE', spirit: 'ABSENT' }; state.zombie.moon.pendingWeek = null;
  state.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'ZOMBIE_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.health = 100; state.mind = 100; state.spirituality = 80; state.town.clubLocation = 'SHOP';
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-zombie-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: ZombieMoveId, physical = 1,
  source: ZombieCombatSource | null = currentZombieCombatSource(state), random = fixedRolls()) {
  return resolveZombieCombatAbility(state, id, physical, random, source);
}
function nextRound(state: SliceState): void {
  const round: SliceCombatRound = { round: state.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 665,
    enemyAdvantage: 114, winChance: 80, winner: 'PLAYER', consequence: '本轮没有有效致伤动作',
    consequenceWeights: null, retreat: 'NONE' };
  state.combatHistory.push(round); state.combat!.lastRound = round; state.combat!.round += 1;
}
function scriptRolls(...rolls: number[]) {
  const originalNext = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    originalNext.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Zombie exact S6 candidate profile', () => {
  it('routes only chained6 to detached30/15/25/10/15/5 and10/15/25/30/20 wheels', () => {
    const state = fixture(); expect(isZombie(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(zombieAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(ZOMBIE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 25, 30, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30); expect(playerCountWheel(state)[0]!.weight).toBe(10);
    state.progression.pathwayId = 'abyss'; expect(isZombie(state)).toBe(false);
  });

  it('retains every count boundary and exact1.25 stance tickets with one draw per selected slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [80, 4], [81, 5], [100, 5]]) {
      expect(zombieActionCount(roll!)).toBe(count);
    }
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2]
        : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [30, 15, 25, 10, 15, 5].map((weight, index) => weight * (boosted.includes(index) ? 5 : 4));
      const total = weights.reduce((sum, value) => sum + value, 0); let boundary = 0;
      zombieAbilityWheel(stance).forEach((entry, index) => {
        expect(entry.weight).toBe(total === 400 ? weights[index]! / 4 : weights[index]! / total * 100);
        const first = boundary + 1; boundary += weights[index]!;
        const random = fixedRolls(first, boundary);
        expect(drawZombieAbility(random, stance)).toBe(ids[index]);
        expect(drawZombieAbility(random, stance)).toBe(ids[index]); expect(random.cursor).toBe(2);
      });
    }
  });

  it('preserves old chained9–7 wheels, body budgets, mastery-scaled recovery and accident coin', () => {
    const state = fixture(true);
    for (const [sequence, count, wheel] of [
      [9, PRISONER_COUNT_WHEEL, prisonerAbilityWheel], [8, MADMAN_COUNT_WHEEL, madmanAbilityWheel],
      [7, WEREWOLF_COUNT_WHEEL, werewolfAbilityWheel],
    ] as const) {
      state.progression.sequence = sequence; expect(isZombie(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(count); expect(playerAbilityWheel(state, null)).toEqual(wheel(null, state));
      expect(currentZombieCombatSource(state)).toBeNull();
    }
    expect(currentWerewolfCombatSource(state)).not.toBeNull();
    expect(resolveWerewolfCombatAbility(state, 'chained.s7.werewolf-body', 1, fixedRolls()).selfGain).toBe(54 * 0.65);
    expect(resolveWerewolfCombatAbility(state, J, 1, fixedRolls()).selfGain).toBe(37.8 * 0.65);
    const random = fixedRolls(2);
    expect(resolveWerewolfCombatAbility(state, A, 1, random).selfGain).toBe(11.25); expect(random.cursor).toBe(1);
    state.health = 70; state.spirituality = 60;
    expect(resolveWerewolfCombatAbility(state, R, 1, fixedRolls()).selfGain).toBe(0);
    expect(state.health).toBe(76); expect(state.spirituality).toBe(57);
  });
});

describe('Zombie finite slot budgets, costs and inherited real-health recovery', () => {
  it('pays H3S immediately for59.15 death-craftf, without physical scaling or direct injury', () => {
    for (const mastery of [0, 100, 500]) {
      const state = fixture(); state.progression.mastery[H] = mastery; state.progression.mastery[B] = 500;
      const practice = structuredClone(state.zombie.practice), random = fixedRolls();
      expect(resolve(state, H, 0.8, undefined, random)).toMatchObject({
        selfGain: 59.15 * (0.65 + 0.35 * mastery / 500), enemyReduction: 0, threatens: true,
      });
      expect(state.spirituality).toBe(77); expect(state.zombie.practice).toEqual(practice); expect(random.cursor).toBe(0);
      expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.enemyStatus).toBe('RESISTING');
    }
  });

  it('prioritizes only the actual HAND town club over H and does not change J or custody', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery[H] = 500; state.progression.mastery[B] = 100;
      const town = structuredClone(state.town), opponent = structuredClone(state.combat);
      expect(resolve(state, H, 0.8).selfGain).toBe(location === 'HAND' ? 16 * 0.8 : 59.15);
      expect(resolve(state, J, 0.8).selfGain).toBe(31.85 * 0.72 * 0.8);
      expect(state.spirituality).toBe(location === 'HAND' ? 80 : 77);
      expect(state.town).toEqual(town); expect(state.combat).toEqual(opponent);
      if (location === 'HAND') expect(playerAbilityWheel(state, null)[0]!.label).toContain('不叠加寒冷');
    }
  });

  it('falls back at0S or insufficient/nonfinite S without partial payment or another random draw', () => {
    for (const spirituality of [0, 1, 2, 2.99, Number.NaN, Infinity]) {
      const state = fixture(); state.spirituality = spirituality; state.health = 70;
      const before = structuredClone(state), random = fixedRolls();
      expect(resolve(state, H, 0.8, undefined, random).selfGain).toBe(12 * 0.8);
      expect(resolve(state, B, 0.8, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 10 * 0.8, threatens: false });
      expect(resolve(state, R, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('pays H/B/R in selected order with exact3S costs and no automatic refund', () => {
    const state = fixture(); state.spirituality = 9; state.health = 70;
    expect(resolve(state, H).selfGain).toBe(59.15 * 0.65); expect(state.spirituality).toBe(6);
    expect(resolve(state, B).enemyReduction).toBe(59.15 * 0.65); expect(state.spirituality).toBe(3);
    expect(resolve(state, R).selfGain).toBe(0); expect(state.health).toBe(80); expect(state.spirituality).toBe(0);
    const before = structuredClone(state);
    expect(resolve(state, H).selfGain).toBe(12); expect(resolve(state, B).enemyReduction).toBe(10);
    expect(resolve(state, R).selfGain).toBe(0); expect(state).toEqual(before);
  });

  it('keeps B to this slot and preserves health, mind, pollution, injuries, risk and normal practice', () => {
    const state = fixture(); state.health = 55; state.mind = 67; state.injuryRisk = 4; state.seer.pollution = 7;
    state.progression.mastery[B] = 100; state.progression.mastery[H] = 500;
    state.injuries.push({ id: 'prior-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    const before = structuredClone(state), random = fixedRolls();
    const effect = resolve(state, B, 0.8, undefined, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 59.15 * 0.72 * 0.8, threatens: false });
    expect(effect.label).toContain('不是常驻免疫'); expect(effect.label).toContain('太阳');
    expect(state.spirituality).toBe(77); before.spirituality = 77;
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('heals exactly10 real health to100 with0 battle contribution and no injury/risk/mind/pollution erasure', () => {
    for (const [health, spirituality, expectedHealth, expectedS] of [
      [70, 3, 80, 0], [95, 10, 100, 7], [99, 3, 100, 0], [100, 80, 100, 80],
      [70, 2, 70, 2], [0, 80, 0, 80],
    ]) {
      const state = fixture(); state.health = health!; state.spirituality = spirituality!;
      state.mind = 57; state.seer.pollution = 7; state.injuryRisk = 4;
      state.injuries.push({ id: 'old-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
      state.progression.mastery[R] = 0;
      const before = structuredClone(state), random = fixedRolls();
      expect(resolve(state, R, 0.8, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      before.health = expectedHealth!; before.spirituality = expectedS!;
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('uses free J31.85 steel-bodyf, K6 and fixed A−16.25 without source ghosts, S5 or hidden draws', () => {
    const state = fixture(); state.spirituality = 0; state.progression.mastery[B] = 100;
    state.progression.mastery[H] = 500; const before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, J, 0.8, undefined, random).selfGain).toBe(31.85 * 0.72 * 0.8);
    const position = resolve(state, K, 0.8, undefined, random);
    expect(position).toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
    expect(position.label).toContain('没有可用幽魂来源'); expect(position.label).toContain('不使用序列5');
    expect(resolve(state, A, 1, undefined, random)).toMatchObject({ selfGain: -16.25, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0); expect(state).toEqual(before);
  });

  it('bounds malformed masteries and body factors without changing the spell into a body attack', () => {
    for (const mastery of [-1, Number.NaN, Infinity, 900]) {
      const state = fixture(); state.progression.mastery[H] = mastery; state.progression.mastery[B] = mastery;
      const factor = mastery === 900 ? 1 : 0.65;
      expect(resolve(state, H, Number.NaN).selfGain).toBe(59.15 * factor);
      expect(resolve(state, J, 2).selfGain).toBe(31.85 * factor);
      expect(resolve(state, B, -1).enemyReduction).toBe(0);
    }
  });
});

describe('Zombie inherited explicit reason-sacrifice policy', () => {
  it('never bursts the cold spell and pays once on the first later physical J without another draw', () => {
    const state = fixture(); state.progression.mastery['chained.s8.reason-sacrifice'] = 100;
    const policy = { policy: 'BURST_FIRST' as const, triggered: false, mentalCost: 0, spiritualCost: 0 };
    const random = fixedRolls(), source = currentZombieCombatSource(state);
    expect(resolveZombieCombatAbility(state, H, 0.8, random, source, policy).selfGain).toBe(59.15 * 0.65);
    expect(state.spirituality).toBe(77); expect(state.mind).toBe(100); expect(policy.triggered).toBe(false);
    expect(resolveZombieCombatAbility(state, J, 0.8, random, source, policy).selfGain)
      .toBe(31.85 * 0.65 * 0.8 * (1 + 0.25 * 0.72));
    expect(state.spirituality).toBe(75); expect(state.mind).toBe(90);
    expect(policy).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
    expect(resolveZombieCombatAbility(state, J, 0.8, random, source, policy).selfGain).toBe(31.85 * 0.65 * 0.8);
    expect(state.spirituality).toBe(75); expect(state.mind).toBe(90); expect(random.cursor).toBe(0);
  });

  it('can burst an actually held club or ordinary insufficient-cold fallback with their own budget', () => {
    for (const held of [false, true]) {
      const state = fixture(); state.town.clubLocation = held ? 'HAND' : 'BAG'; state.spirituality = 2;
      const policy = { policy: 'BURST_FIRST' as const, triggered: false, mentalCost: 0, spiritualCost: 0 };
      const random = fixedRolls();
      expect(resolveZombieCombatAbility(state, H, 0.8, random, currentZombieCombatSource(state), policy).selfGain)
        .toBe((held ? 16 : 12) * 0.8 * (1 + 0.25 * 0.65));
      expect(state.mind).toBe(90); expect(state.spirituality).toBe(0); expect(policy.triggered).toBe(true);
      expect(state.town.clubLocation).toBe(held ? 'HAND' : 'BAG'); expect(random.cursor).toBe(0);
    }
  });

  it('does not charge a burst for invalid source, zero physical contribution, or insufficient M/S', () => {
    for (const [mind, spirituality, physical, sourceValid] of [
      [9, 80, 1, true], [100, 1, 1, true], [100, 80, 0, true], [100, 80, 1, false],
    ] as const) {
      const state = fixture(); state.mind = mind; state.spirituality = spirituality;
      const before = structuredClone(state);
      const policy = { policy: 'BURST_FIRST' as const, triggered: false, mentalCost: 0, spiritualCost: 0 };
      const result = resolveZombieCombatAbility(state, J, physical, fixedRolls(),
        sourceValid ? currentZombieCombatSource(state) : null, policy);
      expect(result.selfGain).toBe(sourceValid ? 31.85 * 0.65 * physical : 0);
      expect(policy.triggered).toBe(false); expect(state).toEqual(before);
    }
  });

  it('keeps burst selection on shared full rounds, separate from cold costs and continuing recovery', () => {
    const state = fixture(); state.spirituality = 70;
    const draws = scriptRolls(26, 1, 1, 400, 151, 151, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect(outcome).toBe('CONTINUE');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.selfGain))
      .toEqual([59.15 * 0.65, 31.85 * 0.65 * (1 + 0.25 * 0.65), 31.85 * 0.65]);
    expect(round.madmanBurst).toEqual({ policy: 'BURST_FIRST', triggered: true, mentalCost: 10, spiritualCost: 2 });
    expect(state.mind).toBe(90); expect(state.spirituality).toBe(73); expect(draws).toHaveBeenCalledTimes(8);
    vi.restoreAllMocks(); const coldOnly = fixture(); coldOnly.spirituality = 70;
    scriptRolls(1, 1, 1, 400, 1, 1);
    const result = resolveSliceCombatRound(coldOnly, 'ATTACK', 'HOLD', 'BURST_FIRST');
    expect(result.round.madmanBurst).toEqual({ policy: 'BURST_FIRST', triggered: false, mentalCost: 0, spiritualCost: 0 });
    expect(coldOnly.mind).toBe(100); expect(coldOnly.spirituality).toBe(75);
    expect(result.round.consequence).toContain('未支付理智爆发成本');
  });

  it('retreat never triggers the selected burst or adds resource recovery', () => {
    const state = fixture(); state.spirituality = 70; scriptRolls(1, 1, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT', 'HOLD', 'BURST_FIRST');
    expect(result.outcome).toBe('RETREATED'); expect(state.mind).toBe(100); expect(state.spirituality).toBe(70);
    expect(result.round.madmanBurst).toEqual({ policy: 'BURST_FIRST', triggered: false, mentalCost: 0, spiritualCost: 0 });
  });
});

describe('Zombie living current sources and closed-practice boundary', () => {
  it('binds real adult里德, his own HAND club,2m, clear courtyard, original exit and no ghost', () => {
    const state = fixture();
    expect(currentZombieCombatSource(state)).toMatchObject({ encounterId: 'ZOMBIE_DISPUTE',
      target: 'REED_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'REEDS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND',
      distanceMetres: 2, bystanders: 'NONE', pursuit: false, activeGhostSource: false });
    const firstCase = fixture(true), carrier = structuredClone(firstCase.world);
    expect(currentZombieCombatSource(firstCase)).toMatchObject({ encounterId: 'FIRST_CASE',
      target: 'CURRENT_VISIBLE_ORDINARY_CARRIER', activeGhostSource: false });
    expect(resolve(firstCase, H).selfGain).toBe(59.15 * 0.65); expect(firstCase.world).toEqual(carrier);
    expect(resolve(firstCase, H, 1, currentZombieCombatSource(state)).selfGain).toBe(0);
  });

  it('refuses source snapshots from an old run, revision, week, round or invented scene', () => {
    const state = fixture(), source = currentZombieCombatSource(state)!;
    for (const mutate of [
      (s: SliceState) => { s.runId += '-other'; }, (s: SliceState) => { s.revision += 1; },
      (s: SliceState) => { s.week += 1; s.zombie.encounter.attemptWeek = s.week; },
      (s: SliceState) => nextRound(s),
    ]) {
      const changed = structuredClone(state); mutate(changed); const before = structuredClone(changed);
      for (const id of ids) expect(resolve(changed, id, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(changed).toEqual(before);
    }
    for (const patch of [{ activeGhostSource: true }, { target: 'UNKNOWN_BODY' }, { weapon: 'STOLEN_CLUB' },
      { weaponLocation: 'GROUND' }, { pursuit: true }, { bystanders: 'CROWD' }, { distanceMetres: 20 }]) {
      const altered = { ...source, ...patch } as unknown as ZombieCombatSource;
      const before = structuredClone(state), random = fixedRolls();
      for (const id of ids) expect(resolve(state, id, 1, altered, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rejects dead or absent targets, pending moon, active practice, stale arrival and broken history before RNG', () => {
    for (const mutate of [
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.health = Number.NaN; },
      (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyMind = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.zombie.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.zombie.encounter.attemptWeek = null; },
      (s: SliceState) => { s.zombie.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.zombie.moon.pendingWeek = s.week; },
      (s: SliceState) => { s.zombie.practice.body = 'BRACED'; },
      (s: SliceState) => { s.zombie.practice.cold = 'ICED'; },
      (s: SliceState) => { s.zombie.practice.spirit = 'PRESENT'; },
      (s: SliceState) => { Object.values(s.zombie.cases)[0]!.contactOpen = true; },
      (s: SliceState) => { Object.values(s.zombie.cases)[0]!.status = 'PREPARED'; },
      (s: SliceState) => { Object.values(s.zombie.cases)[0]!.status = 'AVAILABLE'; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.retreat = 'SUCCESS'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = fixedRolls();
      expect(currentZombieCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolve(state, id, 1, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
  });

  it('keeps FIRST_CASE live-source checks and does not bypass pending moon or open practice', () => {
    for (const mutate of [
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.arc.stage = 'ENDED'; }, (s: SliceState) => { s.zombie.moon.pendingWeek = s.week; },
      (s: SliceState) => { s.zombie.practice.spirit = 'PRESENT'; },
    ]) {
      const state = fixture(true); mutate(state); const before = structuredClone(state);
      expect(currentZombieCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
  });

  it('accepts actually thawed cold and released practice spirit without bringing either into combat', () => {
    const state = fixture(); state.zombie.practice.cold = 'THAWED'; state.zombie.practice.spirit = 'RELEASED';
    const practice = structuredClone(state.zombie.practice);
    expect(currentZombieCombatSource(state)).not.toBeNull(); expect(resolve(state, H).selfGain).toBe(59.15 * 0.65);
    expect(currentZombieCombatSource(state)!.activeGhostSource).toBe(false); expect(state.zombie.practice).toEqual(practice);
  });
});

describe('Zombie shared complete rounds', () => {
  it('uses core50/20/15/15, tier650/cap130/floor65, max80 and continuing-round regeneration8', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 72; scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(669.5);
    expect(state.spirituality).toBe(80); vi.restoreAllMocks();
    const dry = fixture(); dry.spirituality = 0; scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(dry, 'ATTACK').round.playerAdvantage).toBe(665 * 0.8);
    expect(dry.spirituality).toBe(8); vi.restoreAllMocks();
    const cap = fixture(); cap.spirituality = 79;
    cap.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(cap, 'ATTACK').round.playerAdvantage).toBe(780); expect(cap.spirituality).toBe(80);
    vi.restoreAllMocks(); vi.spyOn(zombieCombat, 'resolveZombieCombatAbility').mockReturnValue({
      label: 'controlled negative budget', selfGain: -10_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(65);
  });

  it('resolves the full H/B/H/K/R sequence with exact costs and all ordinary enemy actions', () => {
    const state = fixture(); state.spirituality = 70; const zombie = structuredClone(state.zombie), world = structuredClone(state.world);
    const draws = scriptRolls(100, 100, 1, 1, 226, 1, 1, 1, 326, 366, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[59.15 * 0.65, 0], [0, 59.15 * 0.65], [59.15 * 0.65, 0], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(665 + (59.15 * 0.65 + 59.15 * 0.65));
    expect(round.enemyAdvantage).toBe(162 - (59.15 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90); expect(state.health).toBe(100);
    expect(state.spirituality).toBe(69); expect(state.zombie).toEqual(zombie); expect(state.world).toEqual(world);
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(12);
  });

  it('lets0S finish an ordinary fallback round with no prepaid cold or steel immunity', () => {
    const state = fixture(); state.spirituality = 0;
    scriptRolls(100, 100, 1, 1, 226, 1, 1, 1, 326, 366, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(state.spirituality).toBe(8);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[12, 0], [0, 10], [12, 0], [0, 6], [0, 0]]);
    expect(state.zombie.practice).toEqual({ body: 'NORMAL', cold: 'NONE', spirit: 'ABSENT' });
  });

  it('does not make B a wound or a permanent shield against an ordinary lost-round injury', () => {
    const state = fixture(); state.spirituality = 70; scriptRolls(1, 1, 181, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'DEFEND');
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.spirituality).toBe(75);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 59.15 * 0.65 });
    vi.restoreAllMocks(); const lost = fixture(); lost.spirituality = 70;
    scriptRolls(1, 1, 181, 1, 1_000_000, 1);
    expect(resolveSliceCombatRound(lost, 'DEFEND').outcome).toBe('CONTINUE');
    expect(lost.health).toBe(90); expect(lost.injuries).toHaveLength(1); expect(lost.spirituality).toBe(75);
  });

  it('R alone restores real health but gives0 threat/advantage and keeps three enemy actions', () => {
    const state = fixture(); state.health = 70; state.spirituality = 70; state.injuryRisk = 3;
    state.injuries.push({ id: 'old-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    const injuries = structuredClone(state.injuries), draws = scriptRolls(1, 100, 321, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.playerAdvantage).toBe(665 * 0.95); expect(round.enemyAdvantage).toBe(162);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
    expect(state.health).toBe(80); expect(state.spirituality).toBe(75); expect(state.injuryRisk).toBe(3);
    expect(state.injuries).toEqual(injuries); expect(draws).toHaveBeenCalledTimes(7);
  });

  it('uses the current healed body coefficient on a later J, without recomputing round-start base', () => {
    const state = fixture(); state.health = 70; state.spirituality = 70;
    const draws = scriptRolls(11, 1, 321, 400, 121, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.selfGain)).toEqual([0, 31.85 * 0.65]);
    expect(round.playerAdvantage).toBe(665 * 0.95 + 31.85 * 0.65); expect(state.health).toBe(80);
    expect(state.spirituality).toBe(75); expect(draws).toHaveBeenCalledTimes(7);
  });

  it('fixed negative A has no coin draw, resource cost or injury threat', () => {
    const state = fixture(); const zombie = structuredClone(state.zombie);
    const draws = scriptRolls(1, 1, 445, 400, 1); const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(665 - 16.25); expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.zombie).toEqual(zombie);
    expect(draws).toHaveBeenCalledTimes(5); expect(state.random.cursor).toBe(5);
  });

  it('final surrender/death preserve paid costs and injuries without revival or final regeneration', () => {
    for (const [winner, severity, outcome] of [[1, 66, 'ENEMY_SURRENDERED'], [1, 100, 'ENEMY_DEAD'],
      [1_000_000, 100, 'PLAYER_DEAD']] as const) {
      const state = fixture(); state.spirituality = 70; const world = structuredClone(state.world);
      scriptRolls(1, 1, 1, 1, winner, severity);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome); expect(state.spirituality).toBe(67); expect(state.world).toEqual(world);
      if (outcome === 'ENEMY_SURRENDERED') {
        expect(result.round.consequence).toContain('里德'); expect(result.round.consequence).toContain('自己的原普通短棍');
        expect(result.round.consequence).not.toContain('箱子'); expect(state.combat!.enemyStatus).toBe('SURRENDERED');
      } else if (outcome === 'PLAYER_DEAD') {
        expect(state.health).toBe(0); const dead = structuredClone(state);
        expect(resolve(state, R).selfGain).toBe(0); expect(state).toEqual(dead);
      } else { expect(state.combat!.enemyHealth).toBe(0); expect(result.round.consequence).toContain('里德'); }
      vi.restoreAllMocks();
    }
  });

  it('real-exit retreat stops later actions with no chase, healing, refill or carrier mutation', () => {
    const state = fixture(); state.spirituality = 61; state.health = 70;
    const zombie = structuredClone(state.zombie), world = structuredClone(state.world);
    const draws = scriptRolls(100, 100, 1); const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.consequence).toContain('原普通出口'); expect(result.round.consequence).toContain('没有瞬移或进入追逐');
    expect(result.round.consequence).toContain('里德'); expect(state.zombie).toEqual(zombie); expect(state.world).toEqual(world);
    expect(state.spirituality).toBe(61); expect(state.health).toBe(70); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('supports the old FIRST_CASE without rewriting carrier-specific terminal text', () => {
    const state = fixture(true); state.spirituality = 70; scriptRolls(1, 1, 1, 1, 1, 66);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(result.round.consequence).toContain('携铃者');
    expect(result.round.consequence).toContain('箱子'); expect(result.round.consequence).not.toContain('里德');
    expect(state.spirituality).toBe(67);
  });

  it('replays identical real sources, costs, health and random cursors exactly', () => {
    for (const firstCase of [false, true]) {
      const state = fixture(firstCase); state.health = 85; const replay = structuredClone(state);
      expect(resolveSliceCombatRound(state, 'ATTACK')).toEqual(resolveSliceCombatRound(replay, 'ATTACK'));
      expect(state).toEqual(replay);
    }
  });
});
