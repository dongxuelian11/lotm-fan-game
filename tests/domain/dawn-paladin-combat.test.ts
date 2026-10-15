import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  DAWN_PALADIN_COUNT_WHEEL, consumeDawnPaladinArmor, currentDawnPaladinCombatSource,
  dawnPaladinAbilityWheel, dawnPaladinActionCount, drawDawnPaladinAbility,
  finishDawnPaladinCombatRound, isDawnPaladin, resolveDawnPaladinCombatAbility,
  type DawnPaladinCombatSource, type DawnPaladinMoveId,
} from '../../src/domain/dawn-paladin/combat.js';
import * as dawnCombat from '../../src/domain/dawn-paladin/combat.js';
import { WEAPONMASTER_COUNT_WHEEL, currentWeaponmasterCombatSource, resolveWeaponmasterCombatAbility,
  weaponmasterAbilityWheel } from '../../src/domain/weaponmaster/combat.js';
import { WARRIOR_COUNT_WHEEL, warriorAbilityWheel } from '../../src/domain/warrior/combat.js';
import { GLADIATOR_COUNT_WHEEL, gladiatorAbilityWheel } from '../../src/domain/gladiator/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'warrior.s6.dawn-weapon', J = 'warrior.s6.light-storm';
const B = 'warrior.s6.dawn-armor', K = 'warrior.s6.dawn-light';
const ids = [H, J, B, K, 'OBSERVE', 'ACCIDENT'] as const;

/** Synthetic paid arrival and empty hands for isolated rule tests; public commands are tested separately. */
function fixture(): SliceState {
  const state = createSliceRun('dawn-combat-test', sliceDefaultCreationSelection, 'dawn-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'warrior', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  state.dawnPaladin.cases['marked-exit']!.status = 'RESOLVED';
  state.dawnPaladin.cases['marked-exit']!.outcome = 'MARKED_EXIT_USED';
  state.dawnPaladin.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week, swordReady: false, swordLostRound: null, armorReady: false, armorExpiresRound: null };
  state.combat = { encounterId: 'DAWN_PALADIN_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.town.clubLocation = 'SHOP';
  Object.assign(state.warrior.practiceClub, { custodian: 'MENTOR', location: 'training-rack' });
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-dawn-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: DawnPaladinMoveId, physical = 1,
  source: DawnPaladinCombatSource | null = currentDawnPaladinCombatSource(state), random = fixedRolls()) {
  return resolveDawnPaladinCombatAbility(state, id, physical, random, source);
}
/** A synthetic completed nonterminal round solely for isolated timing tests. */
function nextRound(state: SliceState): void {
  finishDawnPaladinCombatRound(state, true);
  const round: SliceCombatRound = { round: state.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 665,
    enemyAdvantage: 114, winChance: 80, winner: 'PLAYER', consequence: '本轮没有有效致伤动作',
    consequenceWeights: null, retreat: 'NONE' };
  state.combatHistory.push(round); state.combat!.lastRound = round; state.combat!.round += 1;
}
/** Script bounded production draws while keeping the actual replay cursor. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
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

describe('Dawn Paladin S6 exact profile and provenance', () => {
  it('routes six38/20/8/5/4/25 slots and five18/25/27/20/10 counts with detached wheels', () => {
    const state = fixture(); expect(isDawnPaladin(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(dawnPaladinAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([38, 20, 8, 5, 4, 25]);
    expect(playerCountWheel(state)).toEqual(DAWN_PALADIN_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([18, 25, 27, 20, 10]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(38); expect(playerCountWheel(state)[0]!.weight).toBe(18);
  });

  it('preserves exact count boundaries and one-draw neutral slot boundaries', () => {
    for (const [roll, count] of [[1, 1], [18, 1], [19, 2], [43, 2], [44, 3], [70, 3], [71, 4], [90, 4], [91, 5], [100, 5]]) {
      expect(dawnPaladinActionCount(roll!)).toBe(count);
    }
    for (const [roll, id] of [[1, H], [152, H], [153, J], [232, J], [233, B], [264, B],
      [265, K], [284, K], [285, 'OBSERVE'], [300, 'OBSERVE'], [301, 'ACCIDENT'], [400, 'ACCIDENT']] as const) {
      const random = fixedRolls(roll); expect(drawDawnPaladinAbility(random, null)).toBe(id); expect(random.cursor).toBe(1);
    }
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2] : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const tickets = [38, 20, 8, 5, 4, 25].map((x, index) => x * (boosted.includes(index) ? 5 : 4));
      const total = tickets.reduce((sum, x) => sum + x, 0);
      dawnPaladinAbilityWheel(stance).forEach((entry, index) => expect(entry.weight).toBeCloseTo(tickets[index]! / total * 100, 12));
    }
  });

  it('uses core45/20/25/10, tier650/cap130/floor65, max80 and continuation recovery8', () => {
    const state = fixture(); state.spirituality = 72;
    state.character.coreStats = { physique: 20, perception: 10, will: 40, knowledge: 30 };
    scriptRolls(1, 1, 270, 400, 1);
    const result = resolveSliceCombatRound(state, 'CONTROL');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(674);
    expect(state.spirituality).toBe(80); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 200, perception: 200, will: 200, knowledge: 200 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 270, 400, 1);
    expect(resolveSliceCombatRound(capped, 'CONTROL').round.playerAdvantage).toBe(468);
    expect(capped.spirituality).toBe(16); vi.restoreAllMocks();
    vi.spyOn(dawnCombat, 'resolveDawnPaladinCombatAbility').mockReturnValue({
      label: 'Controlled negative contribution', selfGain: -1000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 270, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'CONTROL').round.playerAdvantage).toBe(65);
  });

  it('requires the actual paid encounter, current week, closed cases and contiguous nonterminal history', () => {
    expect(currentDawnPaladinCombatSource(fixture())).toMatchObject({ encounterId: 'DAWN_PALADIN_DISPUTE',
      target: 'ROALD_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', distanceMetres: 2,
      bystanders: 'NONE', illusion: 'NONE', holyVulnerable: false, pursuit: false });
    const mutations: ((state: SliceState) => void)[] = [
      s => { s.combat!.encounterId = 'FIRST_CASE'; s.arc.stage = 'COMBAT'; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.health = 0; }, s => { s.mind = 0; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; }, s => { s.combat!.enemyHealth = 0; },
      s => { s.dawnPaladin.encounter.status = 'AVAILABLE'; }, s => { s.dawnPaladin.encounter.attemptWeek = null; },
      s => { s.dawnPaladin.encounter.startHistoryIndex = null; }, s => { s.combat!.round = 2; },
      s => { s.dawnPaladin.cases['marked-exit']!.contactOpen = true; },
      s => { s.dawnPaladin.cases['armor-test']!.status = 'PREPARED'; },
      s => { s.dawnPaladin.cases['marked-exit']!.status = 'AVAILABLE'; },
      s => { s.dawnPaladin.encounter.armorReady = true; s.dawnPaladin.encounter.armorExpiresRound = 8; },
      s => { s.dawnPaladin.encounter.swordReady = true; s.dawnPaladin.encounter.swordLostRound = 1; },
    ];
    for (const mutate of mutations) {
      const state = fixture(); mutate(state); const before = structuredClone(state);
      expect(currentDawnPaladinCombatSource(state)).toBeNull();
      expect(resolve(state, H)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
    const history = fixture(); nextRound(history);
    expect(currentDawnPaladinCombatSource(history)).not.toBeNull();
    history.combatHistory.at(-1)!.retreat = 'SUCCESS'; expect(currentDawnPaladinCombatSource(history)).toBeNull();
  });

  it('rejects stale or fabricated source fields before costs, random draws or gear mutations', () => {
    for (const field of ['runId', 'revision', 'week', 'round', 'attemptWeek', 'startHistoryIndex',
      'target', 'nature', 'weapon', 'space', 'distanceMetres', 'bystanders', 'illusion', 'holyVulnerable', 'pursuit'] as const) {
      const state = fixture(), source = currentDawnPaladinCombatSource(state)!;
      Object.assign(source, { [field]: 'forged' }); const before = structuredClone(state);
      for (const id of ids) expect(resolve(state, id, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before);
    }
  });
});

describe('Actual Dawn sword, spirit costs and finite storm', () => {
  it('starts without a sword and substitutes only actual ordinary body12 or held original club16', () => {
    const state = fixture(); state.progression.mastery[H] = 500;
    expect(resolve(state, H, 0.8).selfGain).toBe(12 * 0.8);
    expect(state.dawnPaladin.encounter.swordReady).toBe(false); expect(state.spirituality).toBe(80);
    state.town.clubLocation = 'HAND'; expect(resolve(state, H, 0.8).selfGain).toBe(16 * 0.8);
    state.town.clubLocation = 'BAG';
    Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand', version: 2 });
    const original = structuredClone(state.warrior.practiceClub);
    expect(resolve(state, H).selfGain).toBe(16); expect(state.warrior.practiceClub).toEqual(original);
  });

  it('will not silently stow either original club to condense a two-handed sword', () => {
    for (const townClub of [true, false]) {
      const state = fixture();
      if (townClub) state.town.clubLocation = 'HAND';
      else Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand', version: 2 });
      const before = structuredClone(state);
      expect(resolve(state, 'OBSERVE').label).toContain('占据手部'); expect(state).toEqual(before);
      state.dawnPaladin.encounter.swordReady = true;
      expect(currentDawnPaladinCombatSource(state)).toBeNull();
    }
  });

  it('pays3 only on real preparation, then2 per actual sword H without inherited two-stage damage', () => {
    const state = fixture(); const originalProgression = structuredClone(state.progression);
    expect(resolve(state, 'OBSERVE')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state.spirituality).toBe(77); expect(state.dawnPaladin.encounter.swordReady).toBe(true);
    expect(resolve(state, 'OBSERVE').selfGain).toBe(0); expect(state.spirituality).toBe(77);
    expect(resolve(state, H).selfGain).toBeCloseTo(65 * 1.7 * 0.65 * 0.65);
    expect(state.spirituality).toBe(75); expect(state.combat!.weaponmasterWeakPoint).toBeUndefined();
    expect(state.progression).toEqual(originalProgression);
  });

  it('applies each new ability own mastery and physical factor at all six nodes without holy bonus', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(), factor = 0.65 + 0.35 * mastery / 500;
      state.progression.mastery = { [H]: mastery, [J]: mastery, [B]: mastery,
        'warrior.s7.weak-point': 500, 'warrior.s7.weapons': 500, 'warrior.s9.physique': 500 };
      resolve(state, 'OBSERVE'); resolve(state, B);
      expect(resolve(state, B).enemyReduction).toBeCloseTo(65 * 0.5 * 0.65 * factor);
      expect(resolve(state, H, 0.8).selfGain).toBeCloseTo(65 * 1.7 * 0.65 * factor * 0.8);
      expect(resolve(state, J, 0.8).selfGain).toBeCloseTo(65 * 1.7 * 0.35 * factor * 0.8);
      expect(state.spirituality).toBe(68);
    }
  });

  it('storm consumes its actual sword and own armor; same-round R fails and later R pays3', () => {
    const state = fixture(); resolve(state, 'OBSERVE'); resolve(state, B);
    const effect = resolve(state, J);
    expect(effect.label).toContain('只有罗尔德一人'); expect(effect.label).toContain('冲散了自身现有光甲');
    expect(state.spirituality).toBe(70);
    expect(state.dawnPaladin.encounter).toMatchObject({ swordReady: false, swordLostRound: 1, armorReady: false, armorExpiresRound: null });
    expect(resolve(state, 'OBSERVE').label).toContain('本回合不能重凝'); expect(state.spirituality).toBe(70);
    expect(resolve(state, H).selfGain).toBe(12); expect(resolve(state, J).selfGain).toBe(8);
    nextRound(state); expect(resolve(state, 'OBSERVE').selfGain).toBe(0);
    expect(state.spirituality).toBe(67); expect(state.dawnPaladin.encounter.swordReady).toBe(true);
    expect(state.dawnPaladin.encounter.swordLostRound).toBe(1);
  });

  it('does not spend an unaffordable cost or produce phantom attacks or armor', () => {
    const empty = fixture(); empty.spirituality = 2;
    expect(resolve(empty, 'OBSERVE').selfGain).toBe(0); expect(empty.dawnPaladin.encounter.swordReady).toBe(false);
    expect(resolve(empty, B)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(empty.dawnPaladin.encounter.armorReady).toBe(false); expect(empty.spirituality).toBe(2);
    const equipped = fixture(); resolve(equipped, 'OBSERVE'); resolve(equipped, B); equipped.spirituality = 1;
    expect(resolve(equipped, H).selfGain).toBe(12); expect(equipped.spirituality).toBe(1);
    equipped.spirituality = 3; expect(resolve(equipped, J).selfGain).toBe(8);
    expect(equipped.spirituality).toBe(3);
    expect(equipped.dawnPaladin.encounter).toMatchObject({ swordReady: true, swordLostRound: null, armorReady: true, armorExpiresRound: 2 });
    const exact = fixture(); exact.spirituality = 3; resolve(exact, 'OBSERVE');
    expect(exact.spirituality).toBe(0); expect(exact.dawnPaladin.encounter.swordReady).toBe(true);
  });

  it('has no invented battle illusion, no preparation reward and no injury from either accident', () => {
    const state = fixture(); state.dawnPaladin.practice.illusionCreated = true;
    const before = structuredClone(state);
    expect(resolve(state, K)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(resolve(state, 'ACCIDENT', 1, undefined, fixedRolls(1))).toMatchObject({ selfGain: -16.25, threatens: false });
    expect(resolve(state, 'ACCIDENT', 1, undefined, fixedRolls(2))).toMatchObject({ selfGain: 16.25, threatens: false });
    expect(state).toEqual(before);
  });
});

describe('Dawn armor lifecycle and common consequence boundary', () => {
  it('creates one deferred physical protection, with no simultaneous reduction or repeat refresh', () => {
    const state = fixture(); const first = resolve(state, B);
    expect(first).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state.spirituality).toBe(77); expect(state.dawnPaladin.encounter.armorExpiresRound).toBe(2);
    const repeated = resolve(state, B);
    expect(repeated.enemyReduction).toBeCloseTo(21.125 * 0.65); expect(state.spirituality).toBe(77);
    nextRound(state); resolve(state, B);
    expect(state.dawnPaladin.encounter.armorExpiresRound).toBe(2); expect(state.spirituality).toBe(77);
  });

  it('consumes only one subsequent actual positive physical hit, never a suppressed slot or nonattack', () => {
    const state = fixture(); resolve(state, B);
    for (const id of ['OPENING', 'BLOCK', 'DISTANCE', 'MISS']) expect(consumeDawnPaladinArmor(state, id, 8)).toBeNull();
    expect(consumeDawnPaladinArmor(state, 'STRIKE', 16, true)).toBeNull();
    expect(consumeDawnPaladinArmor(state, 'STRIKE', 0)).toBeNull();
    expect(state.dawnPaladin.encounter.armorReady).toBe(true);
    expect(consumeDawnPaladinArmor(state, 'STRIKE', 16)?.physicalMultiplier).toBe(0.6);
    expect(state.dawnPaladin.encounter).toMatchObject({ armorReady: false, armorExpiresRound: null });
    expect(consumeDawnPaladinArmor(state, 'STRIKE', 16)).toBeNull(); expect(state.spirituality).toBe(77);
  });

  it('expires at the next round end and requires another paid B to rebuild', () => {
    const state = fixture(); resolve(state, B);
    expect(finishDawnPaladinCombatRound(state, true)).toBeNull(); expect(state.dawnPaladin.encounter.armorReady).toBe(true);
    nextRound(state); expect(state.combat!.round).toBe(2);
    expect(finishDawnPaladinCombatRound(state, true)).toContain('原定期限');
    expect(state.dawnPaladin.encounter.armorReady).toBe(false);
    nextRound(state); resolve(state, B);
    expect(state.dawnPaladin.encounter.armorExpiresRound).toBe(4); expect(state.spirituality).toBe(74);
  });

  it('applies armor to16 once in the common round without canceling the enemy move or taking extra RNG', () => {
    const state = fixture(); const rolls = scriptRolls(1, 1, 233, 1, 1);
    const result = resolveSliceCombatRound(state, 'DEFEND');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves).toHaveLength(2);
    expect(result.round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 0 });
    expect(result.round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 9.6, enemyReduction: 0 });
    expect(result.round.moves[1]!.label).toContain('光甲已消耗');
    expect(rolls).toHaveBeenCalledTimes(5); expect(state.injuries).toHaveLength(0);
  });

  it('armor never cancels the shared injury/death draw and terminal state gets no recovery', () => {
    for (const severity of [1, 100]) {
      const state = fixture(); const rolls = scriptRolls(1, 1, 233, 1, 1_000_000, severity);
      const result = resolveSliceCombatRound(state, 'DEFEND');
      expect(result.round.moves[1]!.selfGain).toBe(9.6); expect(rolls).toHaveBeenCalledTimes(6);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      if (severity === 1) {
        expect(result.outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.injuries).toHaveLength(1);
      } else {
        expect(result.outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0); expect(state.spirituality).toBe(77);
        expect(state.dawnPaladin.encounter).toMatchObject({ swordReady: false, swordLostRound: null, armorReady: false, armorExpiresRound: null });
      }
      vi.restoreAllMocks();
    }
  });

  it('actual paid preparation then H yields shared heavy injury and surrender, not automatic death', () => {
    const state = fixture(); const originalClub = structuredClone(state.warrior.practiceClub);
    scriptRolls(19, 1, 290, 400, 1, 1, 90);
    const result = resolveSliceCombatRound(state, 'CONTROL');
    expect(result.outcome).toBe('ENEMY_SURRENDERED'); expect(state.combat!.enemyHealth).toBe(70);
    expect(result.round.moves.map(x => x.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER']);
    expect(result.round.moves[0]!.selfGain).toBe(0); expect(result.round.moves[2]!.selfGain).toBeGreaterThan(0);
    expect(state.spirituality).toBe(75); expect(state.dawnPaladin.encounter.swordReady).toBe(false);
    expect(state.warrior.practiceClub).toEqual(originalClub); expect(result.round.consequence).toContain('原棍归属不变');
  });

  it('retreat clears prepared gear and markers, retains injuries and does not grant recovery or pursuit', () => {
    const state = fixture(); resolve(state, 'OBSERVE'); resolve(state, B);
    state.health = 90; state.injuries.push({ id: 'prior', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null });
    const injuries = structuredClone(state.injuries); scriptRolls(1, 1, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.consequence).toContain('没有瞬移或进入追逐');
    expect(state.spirituality).toBe(74); expect(state.health).toBe(90); expect(state.injuries).toEqual(injuries);
    expect(state.dawnPaladin.encounter).toMatchObject({ swordReady: false, swordLostRound: null, armorReady: false, armorExpiresRound: null });
  });
});

describe('Old warrior sequence compatibility', () => {
  it('preserves S9/S8/S7 wheel identities and the S7 two-stage mark exactly', () => {
    const state = fixture(); state.combat!.encounterId = 'FIRST_CASE'; state.arc.stage = 'COMBAT';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(WARRIOR_COUNT_WHEEL); expect(playerAbilityWheel(state, null)).toEqual(warriorAbilityWheel(null, state));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(GLADIATOR_COUNT_WHEEL); expect(playerAbilityWheel(state, null)).toEqual(gladiatorAbilityWheel(null, state));
    state.progression.sequence = 7;
    expect(playerCountWheel(state)).toEqual(WEAPONMASTER_COUNT_WHEEL); expect(playerAbilityWheel(state, null)).toEqual(weaponmasterAbilityWheel(null, state));
    Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
    state.combat!.weaponmasterWeakPoint = { observed: true, prepared: false };
    const source = currentWeaponmasterCombatSource(state), beforeDawn = structuredClone(state.dawnPaladin);
    expect(resolveWeaponmasterCombatAbility(state, 'warrior.s7.weapons', 1, fixedRolls(13), source).selfGain).toBe(0);
    expect(resolveWeaponmasterCombatAbility(state, 'warrior.s7.weapons', 1, fixedRolls(13), source).selfGain).toBe(420 * 0.65);
    expect(state.dawnPaladin).toEqual(beforeDawn);
  });
});
