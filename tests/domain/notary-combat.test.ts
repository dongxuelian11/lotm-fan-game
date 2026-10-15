import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  SUNPRIEST_COUNT_WHEEL, createNotaryRoundContext, currentNotaryCombatSource, currentSunpriestCombatSource,
  drawSunpriestAbility, finishNotaryCombatRound, hasSunpriestCombat, isNotary, isSunpriest,
  resolveSunpriestCombatAbility, sunpriestAbilityWheel, sunpriestActionCount,
  type NotaryRoundContext, type SunpriestCombatSource, type SunpriestMoveId,
} from '../../src/domain/sunpriest/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'sun.s7.holy-light', secondary = 'SUNPRIEST_LIGHTFIRE', certify = 'sun.s6.notarization';
const oath = 'sun.s7.sacred-oath', aura = 'sun.s7.sun-aura', water = 'sun.s7.holy-water';
const ids = [primary, secondary, oath, aura, water, 'ACCIDENT', certify];
/** Synthetic scene fixture. The paid producer is covered separately in the stage tests. */
function fixture(): SliceState {
  const state = createSliceRun('notary-combat-test', sliceDefaultCreationSelection, 'notary-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'sun', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  state.notary.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week };
  state.notary.contract = { signed: false, active: false, tool: 'TABLE', fulfilled: false };
  state.combat = { encounterId: 'NOTARY_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: SunpriestMoveId, context?: NotaryRoundContext,
  source = currentSunpriestCombatSource(state), physical = 1) {
  return resolveSunpriestCombatAbility(state, id, physical, stream(state), source, context);
}
/** Script actual results while retaining the production stream and cursor semantics. */
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

describe('Notary S6 finite profile, preserving the S7 default', () => {
  it('selects seven finite slots with no signed contract and retains exact inherited counts', () => {
    const state = fixture();
    expect(isNotary(state)).toBe(true); expect(isSunpriest(state)).toBe(false);
    expect(hasSunpriestCombat(state)).toBe(true);
    expect(playerAbilityWheel(state, null).map(item => item.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(item => item.weight)).toEqual([24, 18, 12, 10, 8, 13, 15]);
    expect(ids).not.toContain('sun.s6.signed-contract');
    expect(playerCountWheel(state)).toEqual(SUNPRIEST_COUNT_WHEEL);
    expect(playerCountWheel(state).map(item => item.weight)).toEqual([22, 28, 25, 17, 8]);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(sunpriestAbilityWheel(stance, 6));
      expect(sunpriestAbilityWheel(stance)).toEqual(sunpriestAbilityWheel(stance, 7));
    }
    expect(sunpriestAbilityWheel(null).map(item => item.weight)).toEqual([32, 18, 12, 10, 8, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0;
    playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(24);
    expect(playerCountWheel(state)[0]!.weight).toBe(22);
  });

  it('draws exact stance tickets including CONTROL certification without extra random draws', () => {
    for (const [stance, tickets] of [
      [null, [96, 72, 48, 40, 32, 52, 60]],
      ['ATTACK', [120, 90, 48, 40, 32, 52, 60]],
      ['DEFEND', [96, 72, 60, 40, 32, 52, 60]],
      ['CONTROL', [96, 72, 48, 50, 32, 52, 75]],
      ['PREPARE', [96, 72, 48, 40, 40, 52, 60]],
      ['RETREAT', [96, 72, 48, 40, 32, 52, 60]],
    ] as const) {
      const total = tickets.reduce<number>((sum, weight) => sum + weight, 0);
      expect(sunpriestAbilityWheel(stance, 6).map(item => item.weight))
        .toEqual(tickets.map(weight => total === 400 ? weight / 4 : weight / total * 100));
      let boundary = 0;
      for (const [index, weight] of tickets.entries()) {
        const first = boundary + 1; boundary += weight;
        const random = stream(fixture()), draws = scriptRolls(first, boundary);
        expect(drawSunpriestAbility(random, stance, 6)).toBe(ids[index]);
        expect(drawSunpriestAbility(random, stance, 6)).toBe(ids[index]);
        expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    for (const [roll, count] of [[1, 1], [22, 1], [23, 2], [50, 2], [51, 3], [75, 3], [76, 4], [92, 4], [93, 5], [100, 5]]) {
      expect(sunpriestActionCount(roll!)).toBe(count);
    }
  });

  it('uses G core30/25/30/15, base450, floor45, max80 and continuing recovery8', () => {
    const state = fixture(); state.spirituality = 72;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 257, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(473);
    expect(result.round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(80);
    vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 257, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16);
    vi.restoreAllMocks();
    const floor = fixture(); floor.character.coreStats = { physique: -1000, perception: -1000, will: -1000, knowledge: -1000 };
    scriptRolls(1, 1, 257, 400, 1);
    expect(resolveSliceCombatRound(floor, 'PREPARE').round.playerAdvantage).toBe(45);
  });

  it('preserves exact S7 first-case light and rejects S6 borrowing that old carrier', () => {
    const state = fixture(); state.arc.stage = 'COMBAT'; state.combat!.encounterId = 'FIRST_CASE';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    expect(currentSunpriestCombatSource(state)).toBeNull();
    expect(resolve(state, certify).enemyReduction).toBe(10);
    expect(resolve(state, primary).selfGain).toBe(0);
    state.progression.sequence = 7;
    expect(isSunpriest(state)).toBe(true); expect(isNotary(state)).toBe(false);
    expect(currentSunpriestCombatSource(state)).toMatchObject({ target: 'CURRENT_VISIBLE_ORDINARY_CARRIER' });
    expect(resolve(state, certify)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(resolve(state, primary).selfGain).toBe(35.1 * 0.65);
    expect(resolve(state, primary).label).toContain('普通携铃者没有太阳易伤');
    state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 339, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(476);
    expect(state.spirituality).toBe(60);
  });
});

describe('Current original chapel scene and certification scope', () => {
  it('derives one current ordinary adult with his own club, independent of old carrier state', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentNotaryCombatSource(state)).toMatchObject({ encounterId: 'NOTARY_DISPUTE',
      target: 'BREN_SINGLE_ORDINARY_ADULT', weapon: 'BRENS_ORDINARY_SHORT_CLUB', nature: 'ORDINARY_HUMAN',
      space: 'ORIGINAL_CHAPEL_WORKROOM_OUTER_COURTYARD', lighting: 'ORIGINAL_FIXED_LAMPLIGHT',
      sunVulnerable: false, distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE',
      exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    expect(currentSunpriestCombatSource(state)).toEqual(currentNotaryCombatSource(state));
    expect(resolve(state, primary).selfGain).toBe(35.1 * 0.65);
    expect(resolve(state, primary).label).toContain('布伦');
    expect(resolve(state, primary).label).not.toContain('携铃者');
  });

  it('rejects each forged source field, and a stale revision, without RNG or spending', () => {
    const source = currentSunpriestCombatSource(fixture())!;
    for (const key of Object.keys(source)) {
      const state = fixture(), random = stream(state), context = createNotaryRoundContext(state);
      const forged = { ...source, [key]: 'FORGED' } as unknown as SunpriestCombatSource;
      const before = structuredClone(state);
      expect(resolveSunpriestCombatAbility(state, certify, 1, random, forged, context))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(resolveSunpriestCombatAbility(state, primary, 1, random, forged, context).selfGain).toBe(0);
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(context.validityReady).toBe(false);
    }
    const state = fixture(), old = currentSunpriestCombatSource(state)!; state.revision += 1;
    expect(resolve(state, certify, undefined, old).enemyReduction).toBe(10);
    expect(state.spirituality).toBe(80);
  });

  it('rejects invalid visit, history, open/prepared scenes, held loan tools and active contracts before engine RNG', () => {
    for (const mutate of [
      (s: SliceState) => { s.notary.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.notary.encounter.attemptWeek = s.week - 1; },
      (s: SliceState) => { s.notary.encounter.startHistoryIndex = null; },
      (s: SliceState) => { s.notary.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.notary.encounter.startHistoryIndex = 1; },
      (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.notary.cases['limited-light'].contactOpen = true; },
      (s: SliceState) => { s.notary.cases['rejected-terms'].contactOpen = true; },
      (s: SliceState) => { s.notary.cases['signed-tool'].contactOpen = true; },
      (s: SliceState) => { s.notary.cases['limited-light'].status = 'PREPARED'; },
      (s: SliceState) => { s.notary.contract.tool = 'PLAYER'; },
      (s: SliceState) => { s.notary.contract.active = true; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state);
      const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(currentNotaryCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow('来源无效');
      expect(draws).not.toHaveBeenCalled(); expect(state).toEqual(before); vi.restoreAllMocks();
    }
  });

  it('leaves missing, terminal and wrong-sequence battles untouched', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; },
      (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.sequence = 7; },
      (s: SliceState) => { s.progression.pathwayId = 'tyrant'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentNotaryCombatSource(state)).toBeNull();
      expect(resolveSunpriestCombatAbility(state, certify, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Limited same-round certification of an actually performed spell', () => {
  it('spends exactly3S and one normal check for zero immediate gain, then boosts exactly one actual spell', () => {
    for (const [id, budget] of [[primary, 35.1], [secondary, 18.9]] as const) {
      const state = fixture(), random = stream(state), context = createNotaryRoundContext(state);
      const before = structuredClone(state), draw = scriptRolls(52);
      const certification = resolveSunpriestCombatAbility(state, certify, 1, random, undefined, context);
      expect(certification).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(certification.label).toContain('知识难度14检定52%');
      expect(certification.label).toContain('本槽即时贡献0，只限本回合');
      expect(context.validityReady).toBe(true); expect(state.spirituality).toBe(77);
      expect(random.cursor).toBe(1); expect(draw).toHaveBeenCalledTimes(1);
      expect(state.combat).toEqual(before.combat); expect(state.notary).toEqual(before.notary);
      expect(state.progression).toEqual(before.progression);
      const spell = resolveSunpriestCombatAbility(state, id, 1, random, undefined, context);
      expect(spell.selfGain).toBe(budget * 0.65 * 1.15); expect(spell.threatens).toBe(true);
      expect(spell.label).toContain('正向贡献×1.15'); expect(context.validityReady).toBe(false);
      expect(resolveSunpriestCombatAbility(state, id, 1, random, undefined, context).selfGain).toBe(budget * 0.65);
      expect(random.cursor).toBe(1); expect(finishNotaryCombatRound(context)).toBe(''); vi.restoreAllMocks();
    }
  });

  it('failed checks retain their cost, and success cannot stack or redraw while pending', () => {
    const state = fixture(), context = createNotaryRoundContext(state), random = stream(state);
    scriptRolls(53, 1);
    const failed = resolveSunpriestCombatAbility(state, certify, 1, random, undefined, context);
    expect(failed.label).toContain('失败'); expect(failed.selfGain).toBe(0);
    expect(state.spirituality).toBe(77); expect(context.validityReady).toBe(false);
    expect(resolveSunpriestCombatAbility(state, primary, 1, random, undefined, context).selfGain).toBe(35.1 * 0.65);
    resolveSunpriestCombatAbility(state, certify, 1, random, undefined, context);
    const before = structuredClone(state);
    expect(resolveSunpriestCombatAbility(state, certify, 1, random, undefined, context))
      .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(state).toEqual(before); expect(state.spirituality).toBe(74);
    expect(context.validityReady).toBe(true); expect(random.cursor).toBe(2);
  });

  it('insufficient spirituality falls back to ordinary guard without debt or random draws', () => {
    for (const spirituality of [0, 2, Number.NaN]) {
      const state = fixture(); state.spirituality = spirituality;
      const before = structuredClone(state), random = stream(state), context = createNotaryRoundContext(state);
      expect(resolveSunpriestCombatAbility(state, certify, 1, random, undefined, context))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0); expect(context.validityReady).toBe(false);
    }
  });

  it('never boosts ordinary held-club strikes, positive/negative accidents, guard, aura or preparation', () => {
    const state = fixture(), random = stream(state), context = createNotaryRoundContext(state);
    scriptRolls(1, 1, 2);
    resolveSunpriestCombatAbility(state, certify, 1, random, undefined, context);
    state.town.clubLocation = 'HAND';
    const club = resolveSunpriestCombatAbility(state, primary, 0.5, random, undefined, context);
    expect(club.selfGain).toBe(8); expect(club.label).toContain('持握原短棍');
    expect(resolveSunpriestCombatAbility(state, 'ACCIDENT', 1, random, undefined, context).selfGain).toBe(-11.25);
    expect(resolveSunpriestCombatAbility(state, 'ACCIDENT', 1, random, undefined, context).selfGain).toBe(11.25);
    expect(resolveSunpriestCombatAbility(state, oath, 1, random, undefined, context).enemyReduction).toBe(14.625 * 0.65);
    expect(resolveSunpriestCombatAbility(state, aura, 1, random, undefined, context).enemyReduction).toBe(7.875 * 0.65);
    expect(resolveSunpriestCombatAbility(state, water, 1, random, undefined, context).selfGain).toBe(0);
    expect(context.validityReady).toBe(true); expect(random.cursor).toBe(3);
    // Actual magical lightfire remains eligible even while the ordinary club is held.
    expect(resolveSunpriestCombatAbility(state, secondary, 1, random, undefined, context).selfGain).toBe(18.9 * 0.65 * 1.15);
    expect(context.validityReady).toBe(false); expect(state.notary.contract.active).toBe(false);
  });

  it('a default direct-call context cannot leak across calls and explicit context expires or goes stale', () => {
    const state = fixture(); scriptRolls(1, 1);
    resolve(state, certify);
    expect(resolve(state, primary).selfGain).toBe(35.1 * 0.65);
    const context = createNotaryRoundContext(state);
    resolve(state, certify, context);
    expect(finishNotaryCombatRound(context)).toContain('回合结束失效');
    expect(context.validityReady).toBe(false); expect(finishNotaryCombatRound(context)).toBe('');
    context.validityReady = true; state.revision += 1;
    expect(resolve(state, primary, context).selfGain).toBe(35.1 * 0.65);
    expect(resolve(state, certify, context).enemyReduction).toBe(10);
    expect(createNotaryRoundContext(state).validityReady).toBe(false);
  });
});

describe('Real engine order, expiry and ordinary physical consequences', () => {
  it('boosts only the later actual player spell and leaves the intervening enemy physical attack intact', () => {
    const state = fixture(), beforeContract = structuredClone(state.notary.contract);
    const cursor = state.random.cursor, draw = scriptRolls(23, 1, 400, 1, 1, 1, 1, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerCount).toBe(2);
    expect(result.round.enemyCount).toBe(1); expect(result.round.moves).toHaveLength(3);
    expect(result.round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 0 });
    expect(result.round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 16, enemyReduction: 0 });
    expect(result.round.moves[2]).toMatchObject({ actor: 'PLAYER', selfGain: 35.1 * 0.65 * 1.15 });
    expect(result.round.moves[2]!.label).toContain('正向贡献×1.15');
    expect(result.round.consequence).not.toContain('回合结束失效');
    expect(state.combat!.enemyHealth).toBe(90); expect(state.spirituality).toBe(80);
    expect(draw).toHaveBeenCalledTimes(8); expect(state.random.cursor - cursor).toBe(8);
    expect(state.notary.contract).toEqual(beforeContract);
    expect(JSON.stringify(state)).not.toContain('validityReady');
  });

  it('a last-slot success never retroactively boosts and expires before the next round', () => {
    const state = fixture(); state.spirituality = 30;
    scriptRolls(23, 1, 1, 400, 400, 1, 1, 1);
    const first = resolveSliceCombatRound(state, 'PREPARE');
    expect(first.round.moves[0]!.selfGain).toBe(35.1 * 0.65);
    expect(first.round.moves[2]!.selfGain).toBe(0);
    expect(first.round.consequence).toContain('回合结束失效');
    expect(state.spirituality).toBe(35); state.combatHistory.push(structuredClone(first.round));
    expect(currentNotaryCombatSource(state)?.round).toBe(2); vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 1, 1, 1);
    const second = resolveSliceCombatRound(state, 'PREPARE');
    expect(second.round.first).toBe('ENEMY');
    expect(second.round.moves[1]!.selfGain).toBe(35.1 * 0.65);
    expect(second.round.consequence).not.toContain('回合结束失效');
    expect(state.spirituality).toBe(43);
  });

  it('unused certification creates no threat, free attack or phantom contract', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(1, 1, 400, 1, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves).toHaveLength(2);
    expect(result.round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
    expect(result.round.consequence).toContain('回合结束失效'); expect(state.spirituality).toBe(15);
    expect(state.notary.contract).toEqual({ signed: false, active: false, tool: 'TABLE', fulfilled: false });
  });

  it('a paid certification still allows the actual enemy club to cause injury or death', () => {
    for (const [roll, outcome, health] of [[1, 'CONTINUE', 90], [100, 'PLAYER_DEAD', 0]] as const) {
      const state = fixture(); state.spirituality = 10;
      scriptRolls(1, 1, 400, 1, 1, 1_000_000, roll);
      const result = resolveSliceCombatRound(state, 'PREPARE');
      expect(result.outcome).toBe(outcome); expect(state.health).toBe(health);
      expect(result.round.moves[1]!.selfGain).toBe(16);
      expect(state.spirituality).toBe(outcome === 'CONTINUE' ? 15 : 7);
      expect(result.round.consequence).toContain('回合结束失效'); vi.restoreAllMocks();
    }
  });

  it('an actual boosted spell uses the original heavy/death branch and cannot force a signed contract', () => {
    for (const [roll, outcome, status] of [[70, 'ENEMY_SURRENDERED', 'SURRENDERED'], [100, 'ENEMY_DEAD', 'DEAD']] as const) {
      const state = fixture();
      scriptRolls(23, 1, 400, 1, 400, 1, 1, roll);
      const result = resolveSliceCombatRound(state, 'PREPARE');
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyStatus).toBe(status);
      expect(result.round.moves[2]!.selfGain).toBe(35.1 * 0.65 * 1.15);
      expect(state.spirituality).toBe(77); expect(result.round.consequence).toContain('布伦');
      expect(result.round.consequence).not.toContain('携铃者');
      expect(state.notary.contract.signed).toBe(false); expect(state.notary.contract.active).toBe(false);
      vi.restoreAllMocks();
    }
  });

  it('retreat uses the ordinary open exit, spends no certification and stops enemy actions', () => {
    const state = fixture(); state.spirituality = 12; scriptRolls(1, 100, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toHaveLength(0);
    expect(result.round.consequence).toContain('原小教堂工作间外空院的普通出口');
    expect(result.round.consequence).toContain('布伦'); expect(result.round.consequence).toContain('没有瞬移或进入追逐');
    expect(state.spirituality).toBe(12); expect(state.health).toBe(100);
  });
});
