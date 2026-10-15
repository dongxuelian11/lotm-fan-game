import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  SPIRITMEDIUM_COUNT_WHEEL, currentSpiritGuideCombatSource, currentSpiritmediumCombatSource,
  drawSpiritmediumAbility, hasSpiritmediumCombat, isSpiritGuide, isSpiritmedium,
  resolveSpiritmediumCombatAbility, spiritmediumAbilityWheel, spiritmediumActionCount,
  type SpiritmediumCombatSource, type SpiritmediumMoveId,
} from '../../src/domain/spiritmedium/combat.js';
import { SPIRIT_GUIDE_ABILITY_IDS } from '../../src/domain/spirit-guide/types.js';
import { SPIRITMEDIUM_ABILITY_IDS } from '../../src/domain/spiritmedium/types.js';
import { GRAVEDIGGER_ABILITY_IDS } from '../../src/domain/gravedigger/types.js';
import { CORPSECOLLECTOR_ABILITY_IDS } from '../../src/domain/corpsecollector/types.js';
import { settleSpiritGuideEncounter } from '../../src/domain/spirit-guide/encounter.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const deadWords = 'death.s6.dead-words', recruitment = 'death.s6.spirit-recruitment';
const physique = 'death.s9.corpse-physique';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', 'COVER', 'SITE_PRESSURE', 'RITUAL_PREPARATION', 'ACCIDENT', deadWords];
/** Synthetic current visit. Paid arrival and daily reports are covered by stage tests. */
function fixture(): SliceState {
  const state = createSliceRun('spirit-guide-combat-test', sliceDefaultCreationSelection, 'spirit-guide-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'death', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  state.spiritGuide.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week };
  state.combat = { encounterId: 'SPIRIT_GUIDE_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: SpiritmediumMoveId, physical = 1,
  source = currentSpiritmediumCombatSource(state)) {
  return resolveSpiritmediumCombatAbility(state, id, physical, stream(state), source);
}
/** Select precise outcomes while preserving production stream advancement. */
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

describe('Spirit Guide S6 profile and unchanged S7 default', () => {
  it('routes seven bounded slots, inherited counts and the original six-slot S7 default', () => {
    const state = fixture();
    expect(isSpiritGuide(state)).toBe(true); expect(isSpiritmedium(state)).toBe(false);
    expect(hasSpiritmediumCombat(state)).toBe(true);
    expect(playerAbilityWheel(state, null).map(item => item.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(item => item.weight)).toEqual([20, 15, 20, 10, 10, 7, 18]);
    expect(ids).not.toContain(recruitment);
    expect(playerCountWheel(state)).toEqual(SPIRITMEDIUM_COUNT_WHEEL);
    expect(playerCountWheel(state).map(item => item.weight)).toEqual([22, 28, 25, 17, 8]);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(spiritmediumAbilityWheel(stance, 6));
      expect(spiritmediumAbilityWheel(stance)).toEqual(spiritmediumAbilityWheel(stance, 7));
    }
    expect(spiritmediumAbilityWheel(null).map(item => item.weight)).toEqual([20, 15, 20, 23, 15, 7]);
    expect(spiritmediumAbilityWheel(null).map(item => item.id)).toEqual(ids.slice(0, 6));
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20); expect(playerCountWheel(state)[0]!.weight).toBe(22);
  });

  it('draws exact integer stance tickets, including both CONTROL slots, with one draw each', () => {
    for (const [stance, tickets] of [
      [null, [80, 60, 80, 40, 40, 28, 72]],
      ['ATTACK', [100, 75, 80, 40, 40, 28, 72]],
      ['DEFEND', [80, 60, 100, 40, 40, 28, 72]],
      ['CONTROL', [80, 60, 80, 50, 40, 28, 90]],
      ['PREPARE', [80, 60, 80, 40, 50, 28, 72]],
      ['RETREAT', [80, 60, 80, 40, 40, 28, 72]],
    ] as const) {
      const total = tickets.reduce<number>((sum, weight) => sum + weight, 0);
      expect(spiritmediumAbilityWheel(stance, 6).map(item => item.weight))
        .toEqual(tickets.map(weight => total === 400 ? weight / 4 : weight / total * 100));
      let boundary = 0;
      for (const [index, weight] of tickets.entries()) {
        const first = boundary + 1; boundary += weight;
        const random = stream(fixture()), draws = scriptRolls(first, boundary);
        expect(drawSpiritmediumAbility(random, stance, 6)).toBe(ids[index]);
        expect(drawSpiritmediumAbility(random, stance, 6)).toBe(ids[index]);
        expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    for (const [roll, count] of [[1, 1], [22, 1], [23, 2], [50, 2], [51, 3], [75, 3], [76, 4], [92, 4], [93, 5], [100, 5]]) {
      expect(spiritmediumActionCount(roll!)).toBe(count);
    }
  });

  it('uses G core30/25/30/15, base450, floor45, cap90, max80 and continuing recovery8', () => {
    const state = fixture(); state.spirituality = 72;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 261, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(473);
    expect(result.round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(80);
    vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 261, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16); vi.restoreAllMocks();
    const floor = fixture(); floor.character.coreStats = { physique: -1000, perception: -1000, will: -1000, knowledge: -1000 };
    scriptRolls(1, 1, 261, 400, 1);
    expect(resolveSliceCombatRound(floor, 'PREPARE').round.playerAdvantage).toBe(45);
  });

  it('preserves S7 first-case budgets and rejects reusing its carrier at S6 before engine RNG', () => {
    const state = fixture(); state.arc.stage = 'COMBAT'; state.combat!.encounterId = 'FIRST_CASE';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    expect(currentSpiritmediumCombatSource(state)).toBeNull();
    expect(resolve(state, deadWords).enemyReduction).toBe(10); expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(0);
    const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
    expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow('来源无效'); expect(draws).not.toHaveBeenCalled();
    vi.restoreAllMocks(); state.progression.sequence = 7;
    expect(isSpiritmedium(state)).toBe(true); expect(isSpiritGuide(state)).toBe(false);
    expect(currentSpiritmediumCombatSource(state)).toMatchObject({ target: 'CURRENT_VISIBLE_ORDINARY_CARRIER' });
    expect(resolve(state, deadWords)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(23.4 * 0.65);
    expect(resolve(state, 'BODY_STRIKE').label).toContain('普通携铃者');
    state.spirituality = 59; state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(476.5);
    expect(state.spirituality).toBe(60);
  });
});

describe('Current authored ordinary adult and actual scene', () => {
  it('identifies Dean and his ordinary human spirit without using old carrier facts', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentSpiritGuideCombatSource(state)).toMatchObject({ encounterId: 'SPIRIT_GUIDE_DISPUTE',
      target: 'DEAN_SINGLE_ORDINARY_ADULT', weapon: 'DEANS_ORDINARY_SHORT_CLUB', nature: 'ORDINARY_HUMAN',
      humanSpirit: 'CURRENT_ORDINARY_HUMAN_SPIRIT', targetWill: 14,
      space: 'ORIGINAL_MEMORIAL_WORKROOM_OUTER_COURTYARD', lighting: 'ORIGINAL_FIXED_LAMPLIGHT',
      sunVulnerable: false, undead: 'NONE', spiritWorldTarget: 'NONE', localSpirit: 'NONE', borrowableSpirit: 'NONE',
      distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    expect(state.combat!.enemyMind).toBe(100);
    expect(currentSpiritmediumCombatSource(state)).toEqual(currentSpiritGuideCombatSource(state));
    expect(resolve(state, 'BODY_STRIKE').label).toContain('迪恩');
    expect(resolve(state, 'BODY_STRIKE').label).not.toContain('携铃者');
  });

  it('rejects every forged source field and stale revision without spending or drawing', () => {
    const source = currentSpiritGuideCombatSource(fixture())!;
    for (const key of Object.keys(source)) {
      const state = fixture(), random = stream(state), before = structuredClone(state);
      const forged = { ...source, [key]: 'FORGED' } as unknown as SpiritmediumCombatSource;
      expect(resolveSpiritmediumCombatAbility(state, deadWords, 1, random, forged))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(resolveSpiritmediumCombatAbility(state, 'BODY_STRIKE', 1, random, forged).selfGain).toBe(0);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), old = currentSpiritGuideCombatSource(state)!; state.revision += 1;
    expect(resolve(state, deadWords, 1, old).enemyReduction).toBe(10); expect(state.spirituality).toBe(80);
  });

  it('rejects invalid visits, week/history links and every open or prepared daily scene before engine RNG', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.spiritGuide.encounter.status = 'AVAILABLE'; },
      s => { s.spiritGuide.encounter.attemptWeek = s.week - 1; },
      s => { s.spiritGuide.encounter.startHistoryIndex = null; },
      s => { s.spiritGuide.encounter.startHistoryIndex = -1; },
      s => { s.spiritGuide.encounter.startHistoryIndex = 1; },
      s => { s.combat!.round = 2; },
      s => { s.world.city = 'ELSEWHERE'; },
    ];
    for (const caseId of ['messenger-terms', 'short-delivery', 'restless-echo']) {
      mutations.push(s => { s.spiritGuide.cases[caseId]!.contactOpen = true; });
      mutations.push(s => { s.spiritGuide.cases[caseId]!.status = 'PREPARED'; });
    }
    for (const mutate of mutations) {
      const state = fixture(); mutate(state); const before = structuredClone(state);
      const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(currentSpiritGuideCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow('来源无效');
      expect(draws).not.toHaveBeenCalled(); expect(state).toEqual(before); vi.restoreAllMocks();
    }
    const state = fixture(); scriptRolls(1, 1, 261, 400, 1);
    const first = resolveSliceCombatRound(state, 'PREPARE'); state.combatHistory.push(structuredClone(first.round));
    expect(currentSpiritGuideCombatSource(state)?.round).toBe(2); vi.restoreAllMocks();
    for (const mutate of [
      (s: SliceState) => { s.combatHistory[0]!.round = 2; },
      (s: SliceState) => { s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { s.combatHistory[0]!.retreat = 'SUCCESS'; },
    ]) {
      const invalid = structuredClone(state); mutate(invalid); const before = structuredClone(invalid);
      const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(() => resolveSliceCombatRound(invalid, 'ATTACK')).toThrow('来源无效');
      expect(draws).not.toHaveBeenCalled(); expect(invalid).toEqual(before); vi.restoreAllMocks();
    }
  });

  it('leaves missing, terminal and wrong-sequence battles untouched', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.sequence = 7; }, (s: SliceState) => { s.progression.pathwayId = 'sun'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentSpiritGuideCombatSource(state)).toBeNull();
      expect(resolveSpiritmediumCombatAbility(state, deadWords, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Limited dead words and inherited ordinary actions', () => {
  it('spends exactly3S and one production-stream will14 check for a finite nonphysical reduction', () => {
    const state = fixture(), random = stream(state), before = structuredClone(state), draws = scriptRolls(52);
    const effect = resolveSpiritmediumCombatAbility(state, deadWords, 1, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 16 * 0.65, threatens: false });
    expect(effect.label).toContain('意志难度14检定52%'); expect(effect.label).toContain('实抽52/100，成功');
    expect(effect.label).toContain('不直接损伤身体、不触发即死、不强迫服从');
    expect(state.spirituality).toBe(77); expect(random.cursor).toBe(1); expect(draws).toHaveBeenCalledTimes(1);
    expect(state.combat).toEqual(before.combat); expect(state.spiritGuide).toEqual(before.spiritGuide);
    expect(state.progression).toEqual(before.progression);
  });

  it('keeps the full paid cost when the normal check fails, including great failure', () => {
    for (const roll of [53, 100]) {
      const state = fixture(), random = stream(state); scriptRolls(roll);
      expect(resolveSpiritmediumCombatAbility(state, deadWords, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state.spirituality).toBe(77); expect(random.cursor).toBe(1);
      expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.enemyMind).toBe(100);
      expect(state.combat!.enemyStatus).toBe('RESISTING'); vi.restoreAllMocks();
    }
  });

  it('falls back to ordinary guard10 for absent source or insufficient finite spirituality without RNG', () => {
    for (const spirituality of [0, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = spirituality; const before = structuredClone(state), random = stream(state);
      expect(resolveSpiritmediumCombatAbility(state, deadWords, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), random = stream(state), before = structuredClone(state);
    expect(resolveSpiritmediumCombatAbility(state, deadWords, 1, random, null).enemyReduction).toBe(10);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('scales only with dead-words mastery, clamps it and never scales spirit pressure as a physical blow', () => {
    for (const mastery of [0, 25, 100, 200, 300, 400, 500, 800, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.progression.mastery[deadWords] = mastery;
      for (const id of [...CORPSECOLLECTOR_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, recruitment]) {
        state.progression.mastery[id] = 500;
      }
      const factor = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
      scriptRolls(1);
      expect(resolve(state, deadWords, 0)).toMatchObject({ selfGain: 0, enemyReduction: 16 * factor, threatens: false });
      expect(state.spirituality).toBe(77); vi.restoreAllMocks();
    }
  });

  it('keeps all inherited ordinary budgets and no death-eye weakness on this human spirit', () => {
    const state = fixture(); state.progression.mastery[physique] = 500;
    state.progression.mastery[deadWords] = 500; state.progression.mastery[recruitment] = 500;
    expect(resolve(state, 'BODY_STRIKE', 0.8).selfGain).toBe(23.4 * 0.8);
    expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(12.6 * 0.8);
    expect(resolve(state, 'COVER').enemyReduction).toBe(26.325);
    expect(resolve(state, 'SITE_PRESSURE').enemyReduction).toBe(14.175);
    expect(resolve(state, 'SITE_PRESSURE').label).toContain('死亡之眼无适用对象');
    state.town.clubLocation = 'HAND';
    expect(resolve(state, 'BODY_STRIKE', 0.8).selfGain).toBe(16 * 0.8);
    expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(12.6 * 0.8);
    scriptRolls(1, 2);
    expect(resolve(state, 'ACCIDENT')).toMatchObject({ selfGain: -11.25, threatens: false });
    expect(resolve(state, 'ACCIDENT')).toMatchObject({ selfGain: 11.25, threatens: false });
    expect(state.spirituality).toBe(80);
  });

  it('does not turn the daily recruited messenger or an original delivered letter into a combat helper', () => {
    const state = fixture(); state.spiritGuide.messenger = {
      recruited: true, deliveries: 1, letter: 'RECIPIENT', replyReceived: true, feePaid: 24,
    };
    const messenger = structuredClone(state.spiritGuide.messenger), before = structuredClone(state);
    const ritual = resolve(state, 'RITUAL_PREPARATION');
    expect(ritual).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(ritual.label).toContain('只同意一次相邻房间送信');
    expect(ritual.label).toContain('不用于攻击、掩护撤退或挡伤'); expect(state).toEqual(before);
    scriptRolls(1, 1, 261, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.round.moves).toHaveLength(2); expect(result.round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(1);
    expect(result.round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
    expect(state.spiritGuide.messenger).toEqual(messenger);
  });
});

describe('Real shared engine consequences and original mastery award', () => {
  it('a successful dead-words slot never injures, kills or forces the ordinary opponent to obey', () => {
    const state = fixture(); state.spirituality = 10; const cursor = state.random.cursor;
    const draws = scriptRolls(1, 1, 400, 1, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves).toHaveLength(2);
    expect(result.round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 16 * 0.65 });
    expect(result.round.consequenceWeights).toBeNull(); expect(result.round.consequence).toContain('迪恩');
    expect(result.round.consequence).not.toContain('携铃者');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(15); expect(draws).toHaveBeenCalledTimes(6); expect(state.random.cursor - cursor).toBe(6);
  });

  it('each actual drawn slot pays and checks independently, without adding actions or persistent obedience', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(23, 1, 400, 1, 400, 400, 53, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.round.playerCount).toBe(2); expect(result.round.enemyCount).toBe(1);
    expect(result.round.moves).toHaveLength(3);
    expect(result.round.moves[0]!.enemyReduction).toBe(16 * 0.65);
    expect(result.round.moves[2]!.enemyReduction).toBe(0); expect(result.round.moves[2]!.label).toContain('失败');
    expect(state.spirituality).toBe(12); expect(state.combat!.enemyStatus).toBe('RESISTING');
    state.combatHistory.push(structuredClone(result.round));
    expect(currentSpiritGuideCombatSource(state)?.round).toBe(2);
  });

  it('the actual enemy ordinary club can still injure or kill after paid dead words', () => {
    for (const [roll, outcome, health] of [[1, 'CONTINUE', 90], [100, 'PLAYER_DEAD', 0]] as const) {
      const state = fixture(); state.spirituality = 10;
      state.spiritGuide.messenger.recruited = true;
      const messenger = structuredClone(state.spiritGuide.messenger);
      scriptRolls(1, 1, 400, 1, 1, 1_000_000, roll);
      const result = resolveSliceCombatRound(state, 'PREPARE');
      expect(result.outcome).toBe(outcome); expect(state.health).toBe(health);
      expect(result.round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
      expect(result.round.moves[1]!.label).toContain('短棍打击');
      expect(state.spirituality).toBe(outcome === 'CONTINUE' ? 15 : 7);
      expect(state.spiritGuide.messenger).toEqual(messenger); vi.restoreAllMocks();
    }
  });

  it('actual inherited body attacks retain ordinary heavy/death outcomes with Dean labels', () => {
    for (const [roll, outcome, status] of [[70, 'ENEMY_SURRENDERED', 'SURRENDERED'], [100, 'ENEMY_DEAD', 'DEAD']] as const) {
      const state = fixture(); scriptRolls(1, 1, 1, 400, 1, roll);
      const result = resolveSliceCombatRound(state, 'PREPARE');
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyStatus).toBe(status);
      expect(result.round.moves[0]!.selfGain).toBe(23.4 * 0.65);
      expect(result.round.consequence).toContain('迪恩'); expect(result.round.consequence).not.toContain('携铃者');
      expect(state.spirituality).toBe(80); vi.restoreAllMocks();
    }
  });

  it('retreat uses only the original ordinary exit, with no messenger help, spell cost or later attacks', () => {
    const state = fixture(); state.spirituality = 12; state.spiritGuide.messenger.recruited = true;
    const messenger = structuredClone(state.spiritGuide.messenger); scriptRolls(1, 100, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toHaveLength(0);
    expect(result.round.consequence).toContain('原纪念工作室外空院的普通出口');
    expect(result.round.consequence).toContain('迪恩'); expect(result.round.consequence).toContain('没有瞬移或进入追逐');
    expect(state.spirituality).toBe(12); expect(state.health).toBe(100);
    expect(state.spiritGuide.messenger).toEqual(messenger);
  });

  it('awards one original mastery25 packet across inherited and S6 known abilities, never repeating it', () => {
    const state = fixture();
    const known = [...SPIRIT_GUIDE_ABILITY_IDS, ...SPIRITMEDIUM_ABILITY_IDS, ...GRAVEDIGGER_ABILITY_IDS, ...CORPSECOLLECTOR_ABILITY_IDS];
    state.progression.mastery = Object.fromEntries(known.map(id => [id, 0]));
    const random = stream(state), context: SeerContext = {
      roll: (min, max) => random.nextInt(min, max), note: vi.fn(), check: () => { throw new Error('No normal check expected'); },
    };
    scriptRolls(1, 1, 1, 400, 1, 70, 6);
    const result = resolveSliceCombatRound(state, 'PREPARE'); state.combatHistory.push(structuredClone(result.round));
    settleSpiritGuideEncounter(state, result.outcome, context,
      (source, amount) => awardSeerMastery(state, source, amount, context));
    expect(state.progression.mastery[deadWords]).toBe(25);
    expect(Object.values(state.progression.mastery).reduce((sum, value) => sum + value, 0)).toBe(25);
    expect(state.seer.completedSources.filter(source => source === 'spirit-guide-dispute')).toHaveLength(1);
    expect(state.spiritGuide.encounter.status).toBe('RESOLVED'); expect(state.progression.acting).toBe(0);
    const before = structuredClone(state), cursor = random.cursor;
    awardSeerMastery(state, 'spirit-guide-dispute', 25, context);
    expect(state).toEqual(before); expect(random.cursor).toBe(cursor);
    expect(() => settleSpiritGuideEncounter(state, result.outcome, context, () => undefined)).toThrow();
  });
});
