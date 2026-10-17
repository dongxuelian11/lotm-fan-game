import {REAPER_COUNT_WHEEL} from '../../src/domain/reaper/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { HUNTER_COUNT_WHEEL, hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import { PYROMANIAC_COUNT_WHEEL, currentPyromaniacDangerSource, currentPyromaniacFireSource,
  isPyromaniac, pyromaniacAbilityWheel, resolvePyromaniacCombatAbility,
  type PyromaniacFireSource, type PyromaniacMoveId } from '../../src/domain/pyromaniac/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

/** Explicit combat fixture, not evidence of natural acquisition or campaign play. */
function fixture(sequence: 6 | 7 = 6): SliceState {
  const state = createSliceRun('conspirator-combat-fixture', sliceDefaultCreationSelection, 'conspirator-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hunter', sequence, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'ENDED';
  state.world.carrierAlive = false;
  state.world.carrierCanResist = false;
  Object.assign(state.conspirator.encounter, { status: 'FIGHTING', attemptWeek: state.week,
    startHistoryIndex: state.combatHistory.length });
  Object.assign(state.pyromaniac.encounter, { status: 'FIGHTING', surveyed: true, safeLane: true,
    attemptWeek: state.week, startHistoryIndex: state.combatHistory.length });
  state.combat = { encounterId: sequence === 6 ? 'CONSPIRATOR_DISPUTE' : 'PYROMANIAC_DISPUTE',
    round: 1, enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0,
    enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = sequence === 6 ? 80 : 60;
  return state;
}

function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: PyromaniacMoveId, factor = 1,
  source = currentPyromaniacFireSource(state)) {
  return resolvePyromaniacCombatAbility(state, id, factor, stream(state), source);
}
const fireMoves = [
  ['hunter.s7.flame-control', 2, 0, 18],
  ['hunter.s7.compressed-fireball', 3, 36, 0],
  ['hunter.s7.flame-lance', 3, 32, 0],
  ['hunter.s7.fire-raven', 2, 24, 0],
] as const;

/** Forced choices still consume the real stream; these are focused fixtures. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum);
    expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Conspirator S6 inherits only the established finite combat profile', () => {
  it('uses the exact S7 wheels with no automatic planning, persuasion or higher-sequence sector', () => {
    const state = fixture(), before = structuredClone(state);
    expect(isPyromaniac(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(PYROMANIAC_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(pyromaniacAbilityWheel('ATTACK'));
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).toEqual([
      'STRIKE', 'BLOCK', 'hunter.s9.physical-enhancement', 'EVADE', 'hunter.s9.hunting-instinct',
      'hunter.s8.provocation', 'hunter.s8.hostility-aura', ...fireMoves.map(([id]) => id), 'OBSERVE', 'MISS',
    ]);
    expect(playerAbilityWheel(state, null).some(entry => /s6|s5|jump|immunity|firearm/.test(entry.id))).toBe(false);
    expect(state).toEqual(before);
  });

  it('preserves original S9/S8/S7 routing, costs and G advantages', () => {
    const state = fixture();
    for (const [sequence, counts, abilities] of [
      [9, HUNTER_COUNT_WHEEL, hunterAbilityWheel('CONTROL')],
      [8, PROVOKER_COUNT_WHEEL, provokerAbilityWheel('CONTROL')],
      [7, PYROMANIAC_COUNT_WHEEL, pyromaniacAbilityWheel('CONTROL')],
    ] as const) {
      state.progression.sequence = sequence;
      expect(playerCountWheel(state)).toEqual(counts);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(abilities);
    }
    for (const [id, cost, selfGain, enemyReduction] of fireMoves) {
      const old = fixture(7);
      expect(resolve(old, id)).toMatchObject({ selfGain, enemyReduction });
      expect(old.spirituality).toBe(60 - cost);
      expect(resolve(old, 'STRIKE').selfGain).toBe(12);
      expect(resolve(old, 'hunter.s9.physical-enhancement').selfGain).toBe(28);
      expect(resolve(old, 'EVADE').enemyReduction).toBe(22);
    }
  });

  it.each(fireMoves)('%s spends exactly its inherited cost and does not mutate target or property',
    (id, cost, selfGain, enemyReduction) => {
      const state = fixture(), before = structuredClone(state);
      const random = stream(state);
      const effect = resolvePyromaniacCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain, enemyReduction, threatens: selfGain > 0, angersEnemy: false });
      expect(effect.label).toContain('奥伦');
      expect(effect.label).toContain('（G）');
      expect(effect.label).not.toMatch(/哈恩|携铃者|威斯|降智/);
      expect(state.spirituality).toBe(80 - cost);
      before.spirituality = state.spirituality;
      expect(state).toEqual(before);
      expect(random.cursor).toBe(0);
    });

  it('creates its own fire in only the current original 2m empty passage, with no lamp requirement', () => {
    const state = fixture();
    state.magician.lantern.prepared = false;
    state.magician.lantern.oilSpent = 0;
    state.pyromaniac.encounter.surveyed = false;
    state.pyromaniac.encounter.safeLane = false;
    expect(currentPyromaniacFireSource(state)).toEqual({ encounterId: 'CONSPIRATOR_DISPUTE', round: 1,
      attemptWeek: state.week, startHistoryIndex: 0, space: 'OPEN_PASSAGE',
      lane: 'EXISTING_EMPTY_PASSAGE', distanceMetres: 2, target: 'OREN_SINGLE_ADULT' });
    for (const [id] of fireMoves.slice(1)) {
      const effect = resolve(state, id);
      expect(effect.label).toContain('自身火焰');
      expect(effect.label).toContain('同场2米内一个成人目标');
      expect(effect.label).toContain('不穿墙、不追加范围伤害');
    }
    expect(state.magician.lantern.oilSpent).toBe(0);
    expect(state.world.carrierAlive).toBe(false);
    expect(state.combat!.enemyHealth).toBe(100);
  });

  it('rejects stale or substituted round, target, passage and attempt tokens without charging', () => {
    const state = fixture(), source = currentPyromaniacFireSource(state)!;
    const invalid = [null, { ...source, round: 2 }, { ...source, encounterId: 'PYROMANIAC_DISPUTE' },
      { ...source, distanceMetres: 6 }, { ...source, target: 'HAARN_SINGLE_ADULT' },
      { ...source, space: 'CLOSED_WAREHOUSE' }, { ...source, lane: 'THROUGH_CLOTH_CRATES' },
      { ...source, attemptWeek: state.week - 1 }, { ...source, startHistoryIndex: 1 }];
    for (const token of invalid) {
      const before = structuredClone(state), random = stream(state);
      const effect = resolvePyromaniacCombatAbility(state, 'hunter.s7.compressed-fireball', 1,
        random, token as PyromaniacFireSource | null);
      expect(effect).toMatchObject({ selfGain: 12, enemyReduction: 0, threatens: true });
      expect(effect.label).toContain('未施法、未耗灵性，不重抽');
      expect(state).toEqual(before);
      expect(random.cursor).toBe(0);
    }
  });

  it('invalidates fire and danger when this actual opponent, attempt or encounter ends', () => {
    const changes: ((state: SliceState) => void)[] = [
      state => { state.conspirator.encounter.status = 'RETREATED'; },
      state => { state.conspirator.encounter.status = 'RESOLVED'; },
      state => { state.conspirator.encounter.status = 'LOST'; },
      state => { state.conspirator.encounter.attemptWeek = null; },
      state => { state.conspirator.encounter.attemptWeek = state.week - 1; },
      state => { state.conspirator.encounter.startHistoryIndex = null; },
      state => { state.world.city = 'ELSEWHERE'; },
      state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.enemyStatus = 'DEAD'; },
      state => { state.combat!.enemyHealth = 0; },
      state => { state.health = 0; },
      state => { state.status = 'DEAD'; },
      state => { state.combat = null; },
    ];
    for (const change of changes) {
      const state = fixture(), source = currentPyromaniacFireSource(state);
      change(state); const before = structuredClone(state);
      expect(currentPyromaniacFireSource(state)).toBeNull();
      expect(currentPyromaniacDangerSource(state)).toBeNull();
      expect(resolve(state, 'hunter.s7.fire-raven', 1, source).selfGain).toBeLessThanOrEqual(12);
      expect(resolve(state, 'hunter.s9.hunting-instinct').enemyReduction).toBe(0);
      expect(state).toEqual(before);
    }
  });

  it('inherits physical and visible-threat effects without borrowing an old opponent fact or item', () => {
    const state = fixture(), before = structuredClone(state);
    expect(resolve(state, 'STRIKE', 0.8).selfGain).toBeCloseTo(9.6);
    expect(resolve(state, 'BLOCK').enemyReduction).toBe(10);
    expect(resolve(state, 'hunter.s9.physical-enhancement', 0.8).selfGain).toBeCloseTo(22.4);
    expect(resolve(state, 'EVADE').enemyReduction).toBe(22);
    expect(currentPyromaniacDangerSource(state)).toMatchObject({ encounterId: 'CONSPIRATOR_DISPUTE', round: 1 });
    expect(resolve(state, 'hunter.s9.hunting-instinct').enemyReduction).toBe(15);
    expect(state).toEqual(before);
    state.provoker.cases['queue-boast']!.status = 'COMPLETED';
    const random = stream(state), unchanged = structuredClone(state);
    for (const id of ['hunter.s8.provocation', 'hunter.s8.hostility-aura'] as const) {
      expect(resolvePyromaniacCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, angersEnemy: false });
    }
    expect(random.cursor).toBe(0);
    expect(state).toEqual(unchanged);
    state.combat!.encounterId = 'FIRST_CASE';
    expect(currentPyromaniacDangerSource(state)).toBeNull();
    expect(currentPyromaniacFireSource(state)).toBeNull();
  });

  it('uses current remaining spirituality, then one ordinary fallback with no redraw or negative cost', () => {
    const state = fixture(); state.spirituality = 2;
    expect(resolve(state, 'hunter.s7.compressed-fireball').selfGain).toBe(12);
    expect(state.spirituality).toBe(2);
    expect(resolve(state, 'hunter.s7.flame-control').enemyReduction).toBe(18);
    expect(state.spirituality).toBe(0);
    for (const [id] of fireMoves) {
      const random = stream(state), before = structuredClone(state);
      const effect = resolvePyromaniacCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain: id === 'hunter.s7.flame-control' ? 0 : 12,
        enemyReduction: id === 'hunter.s7.flame-control' ? 10 : 0 });
      expect(effect.label).toContain('灵性不足');
      expect(random.cursor).toBe(0);
      expect(state).toEqual(before);
    }
  });

  it('retains the one-spirituality known-Weiss check only in that actual inherited encounter', () => {
    const state = fixture();
    state.combat!.encounterId = 'PROVOKER_DISPUTE';
    state.provoker.encounter.status = 'FIGHTING';
    state.provoker.cases['queue-boast']!.status = 'OBSERVED';
    const random = stream(state), draws = scriptRolls(1);
    const effect = resolvePyromaniacCombatAbility(state, 'hunter.s8.provocation', 1, random);
    expect(effect).toMatchObject({ selfGain: 10, enemyReduction: 0, threatens: false, angersEnemy: true });
    expect(effect.label).toContain('威斯');
    expect(state.spirituality).toBe(79);
    expect(state.lastCheck?.roll).toBe(1);
    expect(state.combat!.enemyHealth).toBe(100);
    expect(state.combat!.enemyStatus).toBe('RESISTING');
    expect(random.cursor).toBe(1);
    expect(draws).toHaveBeenCalledTimes(1);
  });

  it('does not borrow the old S6 scene for S5, another pathway or an S7 claiming it', () => {
    for (const mode of ['S5', 'OTHER_PATHWAY', 'S7_NEW_SCENE'] as const) {
      const state = fixture();
      if (mode === 'S5') state.progression.sequence = 5;
      if (mode === 'OTHER_PATHWAY') state.progression.pathwayId = 'diviner';
      if (mode === 'S7_NEW_SCENE') state.progression.sequence = 7;
      const before = structuredClone(state);
      expect(currentPyromaniacFireSource(state)).toBeNull();
      expect(currentPyromaniacDangerSource(state)).toBeNull();
      expect(resolve(state, 'hunter.s7.flame-lance').selfGain).toBeLessThanOrEqual(12);
      if (mode === 'S5') {
        expect(isPyromaniac(state)).toBe(false);
        expect(playerCountWheel(state)).toEqual(REAPER_COUNT_WHEEL);
        expect(resolve(state, 'hunter.s9.physical-enhancement').selfGain).toBe(0);
      }
      expect(state).toEqual(before);
    }
  });

  it('resolves one ordinary round on the same S7 budget and caps S6 recovery at 80', () => {
    const state = fixture(); state.spirituality = 79;
    const town = structuredClone(state.town);
    const draws = scriptRolls(1, 1, 1, 400, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE');
    expect([round.playerCount, round.enemyCount]).toEqual([1, 1]);
    expect(round.moves).toHaveLength(2);
    expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', label: '普通打击', selfGain: 12 });
    expect(round.playerAdvantage).toBe(477);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(80);
    expect(state.combat!.enemyHealth).toBe(90);
    expect(state.town).toEqual(town);
    expect(state.world.carrierAlive).toBe(false);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('resolves one inherited fire round with cost3, ordinary injury and only 8 spirituality recovery', () => {
    const state = fixture(); state.spirituality = 70;
    const draws = scriptRolls(1, 1, 283, 400, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE');
    expect([round.playerCount, round.enemyCount]).toEqual([1, 1]);
    expect(round.moves).toHaveLength(2);
    expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 36 });
    expect(round.moves[0]!.label).toContain('压缩火球');
    expect(round.moves[0]!.label).toContain('奥伦');
    expect(round.playerAdvantage).toBe(501);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(75); // 70 - original cost3 + 10% of S6 G max80.
    expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(state.combat!.enemyStatus).toBe('RESISTING');
    expect(state.random.cursor).toBe(6);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('retains the ordinary exit without a fire jump, free attack or invented pursuit', () => {
    const state = fixture(); state.spirituality = 70;
    const enemy = structuredClone(state.combat), town = structuredClone(state.town), world = structuredClone(state.world);
    const draws = scriptRolls(1, 1, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED');
    expect(result.round.retreat).toBe('SUCCESS');
    expect(result.round.moves).toHaveLength(0);
    expect(result.round.consequence).toContain('奥伦');
    expect(result.round.consequence).not.toMatch(/携铃者|追逐|火焰跳跃/);
    expect(state.spirituality).toBe(70);
    expect(state.health).toBe(100);
    expect(state.combat!.enemyHealth).toBe(enemy!.enemyHealth);
    expect(state.combat!.enemyStatus).toBe(enemy!.enemyStatus);
    expect(state.town).toEqual(town);
    expect(state.world).toEqual(world);
    expect(draws).toHaveBeenCalledTimes(3);
  });

  it('names the actual surviving adult on surrender and still permits ordinary player death', () => {
    const state = fixture();
    scriptRolls(1, 1, 283, 400, 1, 70);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(result.round.consequence).toContain('奥伦');
    expect(result.round.consequence).not.toMatch(/携铃者|哈恩|箱子/);
    expect(state.spirituality).toBe(77);
    expect(currentPyromaniacFireSource(state)).toBeNull();
    vi.restoreAllMocks();
    const doomed = fixture();
    scriptRolls(1, 1, 452, 1, 1_000_000, 100);
    expect(resolveSliceCombatRound(doomed, 'ATTACK').outcome).toBe('PLAYER_DEAD');
    expect(doomed.health).toBe(0);
    expect(doomed.spirituality).toBe(80);
  });
});
