import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { PSYCHOLOGIST_COUNT_WHEEL, currentPsychologistMindSource, drawPsychologistAbility,
  isPsychologist, psychologistAbilityWheel, psychologistActionCount, resolvePsychologistCombatAbility,
  type PsychologistMindSource, type PsychologistMoveId } from '../../src/domain/psychologist/combat.js';
import { MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel,
  resolveMindreaderCombatAbility } from '../../src/domain/mindreader/combat.js';
import { AUDIENCE_COUNT_WHEEL, audienceAbilityWheel } from '../../src/domain/audience/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel, currentClownDangerSource } from '../../src/domain/clown/combat.js';
import { MAGICIAN_COUNT_WHEEL, magicianAbilityWheel } from '../../src/domain/magician/combat.js';
import { PYROMANIAC_COUNT_WHEEL, pyromaniacAbilityWheel } from '../../src/domain/pyromaniac/combat.js';
import { HUNTER_COUNT_WHEEL, hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('psychologist-combat-test', sliceDefaultCreationSelection, 'psychologist-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'audience', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  Object.assign(state.psychologist.encounter, { status: 'FIGHTING', observed: true,
    attemptWeek: state.week, startHistoryIndex: state.combatHistory.length });
  state.combat = { encounterId: 'PSYCHOLOGIST_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: PsychologistMoveId, source = currentPsychologistMindSource(state)) {
  return resolvePsychologistCombatAbility(state, id, 1, stream(state), source);
}
const mentalIds = ['audience.s7.awe', 'audience.s7.frenzy', 'audience.s7.suggestion', 'audience.s7.soothe'] as const;
/** Script values but consume the production deterministic stream and cursor. */
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
function previousRound(): SliceCombatRound {
  return { round: 1, stance: 'PREPARE', first: 'PLAYER', playerCount: 1, enemyCount: 1,
    playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'ENEMY', label: '格挡护身', selfGain: 0, enemyReduction: 10 }],
    playerAdvantage: 465, enemyAdvantage: 114, winChance: 465 / 579 * 100,
    winner: 'PLAYER', consequence: '未增加伤势', consequenceWeights: null, retreat: 'NONE' };
}
afterEach(() => vi.restoreAllMocks());

describe('psychologist S7 finite profile', () => {
  it('uses six nonuniform counts, inherited abilities, real physical actions and four S7 combat sectors', () => {
    const state = fixture();
    expect(isPsychologist(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(PSYCHOLOGIST_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([15, 20, 25, 20, 15, 5]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel).toEqual(psychologistAbilityWheel(null));
    expect(wheel.map(x => x.id)).toEqual(['STRIKE', 'BLOCK', 'EVADE', 'audience.observation',
      'audience.behavior-analysis', 'audience.memory-deduction', 'audience.mind-reading', ...mentalIds, 'MISS']);
    expect(wheel.map(x => x.weight)).toEqual([8, 8, 8, 8, 6, 5, 5, 14, 16, 12, 8, 2]);
    expect(wheel.some(x => /mental-communication|hypnosis|control-mind|purify/.test(x.id))).toBe(false);
    wheel[0]!.weight = 0;
    const counts = playerCountWheel(state); counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(8);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
  });

  it('maps every count boundary exactly', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [80, 4], [81, 5], [95, 5], [96, 6], [100, 6]]) {
      expect(psychologistActionCount(roll!)).toBe(count);
    }
  });

  it('uses exact normalized stance tickets and one draw per ability', () => {
    const attackTickets = [40, 32, 32, 32, 24, 20, 20, 56, 80, 48, 32, 8];
    expect(psychologistAbilityWheel('ATTACK').map(x => x.weight)).toEqual(attackTickets.map(x => x / 424 * 100));
    let boundary = 0;
    for (const entry of psychologistAbilityWheel(null)) {
      const first = boundary + 1; boundary += Math.round(entry.weight * 4);
      scriptRolls(first, boundary);
      const random = stream(fixture());
      expect(drawPsychologistAbility(random, null)).toBe(entry.id);
      expect(drawPsychologistAbility(random, null)).toBe(entry.id);
      expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
  });

  it('uses tier450, core5/25/40/30, cap90 and max spirituality60 without changing enemy tier', () => {
    const state = fixture(); state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 424, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(479.5);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 424, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(12);
  });

  it('retains every earlier profile and does not create a clown source for the new person', () => {
    const state = fixture();
    const profiles = [
      ['audience', 8, MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel('CONTROL')],
      ['audience', 9, AUDIENCE_COUNT_WHEEL, audienceAbilityWheel('CONTROL')],
      ['hunter', 9, HUNTER_COUNT_WHEEL, hunterAbilityWheel('CONTROL')],
      ['hunter', 8, PROVOKER_COUNT_WHEEL, provokerAbilityWheel('CONTROL')],
      ['hunter', 7, PYROMANIAC_COUNT_WHEEL, pyromaniacAbilityWheel('CONTROL')],
      ['diviner', 9, SEER_COUNT_WHEEL, seerAbilityWheel('CONTROL')],
      ['diviner', 8, CLOWN_COUNT_WHEEL, clownAbilityWheel('CONTROL')],
      ['diviner', 7, MAGICIAN_COUNT_WHEEL, magicianAbilityWheel(state, 'CONTROL')],
      [null, null, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
    ] as const;
    for (const [pathwayId, sequence, counts, abilities] of profiles) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isPsychologist(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(counts);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(abilities);
    }
    expect(currentClownDangerSource(state)).toBeNull();
  });

  it('keeps ordinary attacks, block and inherited evade physical and scales strikes once', () => {
    const state = fixture(), random = stream(state);
    expect(resolvePsychologistCombatAbility(state, 'STRIKE', 0.8, random))
      .toMatchObject({ selfGain: 9.600000000000001, threatens: true, mentalPressure: false });
    expect(resolve(state, 'BLOCK')).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(resolve(state, 'EVADE')).toMatchObject({ selfGain: 0, enemyReduction: 18, threatens: false });
    state.town.clubLocation = 'HAND';
    expect(resolvePsychologistCombatAbility(state, 'STRIKE', 0.8, random))
      .toMatchObject({ selfGain: 12.8, threatens: true, mentalPressure: false });
    expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
    expect(state.spirituality).toBe(60); expect(random.cursor).toBe(0);
  });
});

describe('authored psychological source and finite costs', () => {
  it('requires observed, current, living, resisting, local and awake ordinary human facts', () => {
    expect(currentPsychologistMindSource(fixture())).toMatchObject({ encounterId: 'PSYCHOLOGIST_DISPUTE',
      target: 'BRYCE_SINGLE_AWAKE_ADULT', mind: 'ORDINARY_UNPROTECTED', space: 'PUBLIC_ROOM',
      aggression: 'VISIBLE_SHORT_CLUB_THREAT' });
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.psychologist.encounter.observed = false; },
      s => { s.psychologist.encounter.attemptWeek = null; },
      s => { s.psychologist.encounter.attemptWeek = s.week - 1; },
      s => { s.psychologist.encounter.startHistoryIndex = null; },
      s => { s.combat = null; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; },
      s => { s.combat!.enemyStatus = 'DEAD'; },
      s => { s.combat!.enemyHealth = 0; },
      s => { s.combat!.enemyMind = 0; },
      s => { s.world.city = 'ELSEWHERE'; },
      s => { s.status = 'DEAD'; },
      s => { s.health = 0; },
      s => { s.progression.sequence = 8; },
      s => { s.progression.pathwayId = 'diviner'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(); mutate(state);
      const before = structuredClone(state), random = stream(state);
      expect(currentPsychologistMindSource(state)).toBeNull();
      expect(resolvePsychologistCombatAbility(state, 'audience.s7.frenzy', 1, random).mentalPressure).toBe(false);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rejects forged and stale source identity before consuming spirituality or randomness', () => {
    const state = fixture(), source = currentPsychologistMindSource(state)!;
    const invalid: (PsychologistMindSource | null)[] = [null, { ...source, round: 2 },
      { ...source, attemptWeek: source.attemptWeek + 1 }, { ...source, startHistoryIndex: 100 },
      { ...source, target: 'SOMEONE_ELSE' } as unknown as PsychologistMindSource,
      { ...source, mind: 'PROTECTED' } as unknown as PsychologistMindSource,
      { ...source, space: 'OTHER_ROOM' } as unknown as PsychologistMindSource,
      { ...source, aggression: 'NONE' } as unknown as PsychologistMindSource];
    for (const input of invalid) {
      const before = structuredClone(state), random = stream(state);
      expect(resolvePsychologistCombatAbility(state, 'audience.s7.suggestion', 1, random, input))
        .toMatchObject({ enemyReduction: 10, threatens: false, mentalPressure: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('falls back on every old encounter without importing this target or drawing another action', () => {
    for (const encounterId of ['FIRST_CASE', 'CLOWN_RESCUE', 'HUNTER_CARGO', 'PROVOKER_DISPUTE',
      'MAGICIAN_DISPUTE', 'PYROMANIAC_DISPUTE'] as const) {
      for (const id of mentalIds) {
        const state = fixture(); state.combat!.encounterId = encounterId;
        const before = structuredClone(state), random = stream(state);
        const effect = resolvePsychologistCombatAbility(state, id, 1, random);
        expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false, mentalPressure: false });
        expect(effect.label).toContain('改用格挡护身');
        expect(state).toEqual(before); expect(random.cursor).toBe(0);
      }
    }
  });

  it('charges awe, frenzy and soothe once but mutates no health, mind, knowledge or consent directly', () => {
    for (const [id, cost, gain, reduction, pressure] of [
      ['audience.s7.awe', 2, 0, 22, false], ['audience.s7.frenzy', 3, 28, 0, true],
      ['audience.s7.soothe', 2, 0, 16, false],
    ] as const) {
      const state = fixture(), before = structuredClone(state), random = stream(state);
      const effect = resolvePsychologistCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain: gain, enemyReduction: reduction, threatens: false, mentalPressure: pressure });
      expect(state).toEqual({ ...before, spirituality: 60 - cost }); expect(random.cursor).toBe(0);
    }
  });

  it('uses a real will D14 check for suggestion, retaining success and failure costs', () => {
    for (const [roll, tier, reduction] of [[1, 'GREAT_SUCCESS', 18], [52, 'SUCCESS', 18],
      [53, 'FAILURE', 0], [100, 'GREAT_FAILURE', 0]] as const) {
      const state = fixture(), before = structuredClone(state), random = stream(state);
      scriptRolls(roll);
      const effect = resolvePsychologistCombatAbility(state, 'audience.s7.suggestion', 1, random);
      expect(effect).toMatchObject({ enemyReduction: reduction, threatens: false, mentalPressure: false });
      expect(state.lastCheck).toMatchObject({ ability: 'will', difficulty: 14, chance: 52, roll, tier });
      expect(state).toEqual({ ...before, spirituality: 58, lastCheck: state.lastCheck });
      expect(random.cursor).toBe(1); expect(effect.label).toContain('不删除行动');
      vi.restoreAllMocks();
    }
  });

  it('does not read, charge or redraw when spirituality is below each cost', () => {
    for (const id of mentalIds) {
      const state = fixture(); state.spirituality = id === 'audience.s7.frenzy' ? 2.5 : 1.5;
      const before = structuredClone(state), random = stream(state);
      const effect = resolvePsychologistCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ enemyReduction: 10, threatens: false, mentalPressure: false });
      expect(effect.label).toContain('灵性不足');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('retains the exact inherited first-case source, costs and previous-round evidence without changing progression', () => {
    const state = fixture(); state.combat!.encounterId = 'FIRST_CASE'; state.arc.stage = 'COMBAT';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    state.combat!.round = 2; state.combat!.lastRound = previousRound();
    for (const id of ['audience.observation', 'audience.behavior-analysis', 'audience.memory-deduction',
      'audience.mind-reading'] as const) {
      const inherited = structuredClone(state); inherited.progression.sequence = 8;
      const a = resolvePsychologistCombatAbility(state, id, 1, stream(state));
      const b = resolveMindreaderCombatAbility(inherited, id, 1, stream(inherited));
      expect(a).toEqual({ ...b, mentalPressure: false });
      expect(state.spirituality).toBe(inherited.spirituality);
      expect(state.lastCheck).toEqual(inherited.lastCheck); expect(state.progression.sequence).toBe(7);
    }
  });

  it('does not invent new-opponent thoughts or reuse unrelated global combat history', () => {
    const state = fixture(); state.combatHistory = [previousRound()]; state.lastCombatRound = previousRound();
    state.combat!.round = 2; state.combat!.lastRound = previousRound();
    state.knowledge = [{ id: 'hidden', week: 1, title: 'PRIVATE', text: 'SECRET' }];
    for (const id of ['audience.observation', 'audience.behavior-analysis', 'audience.memory-deduction',
      'audience.mind-reading'] as const) {
      const before = structuredClone(state), random = stream(state);
      const effect = resolvePsychologistCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ enemyReduction: 10, threatens: false, mentalPressure: false });
      expect(effect.label).not.toMatch(/SECRET|PRIVATE|此刻想守住/);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('mental consequences are not physical wounds or death', () => {
  it('maps all three shared outcome bands to 10/25/40 mental loss with the actual roll', () => {
    for (const [roll, damage] of [[1, 10], [65, 10], [66, 25], [95, 25], [96, 40], [100, 40]]) {
      const state = fixture();
      const draws = scriptRolls(1, 1, 257, 1, 1, roll!);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.label).toContain('狂乱'); expect(round.moves[1]!.label).toBe('短棍打击');
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(round.consequenceRoll).toBe(roll); expect(round.pendingConsequence).toBeUndefined();
      expect(state.combat).toMatchObject({ enemyMind: 100 - damage!, enemyHealth: 100,
        enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(round.consequence).toContain(`精神损耗${damage}`);
      expect(outcome).toBe('CONTINUE'); expect(state.spirituality).toBe(60);
      expect(draws).toHaveBeenCalledTimes(6); expect(state.random.cursor).toBe(6);
      vi.restoreAllMocks();
    }
  });

  it('never creates physical death even at 100% death-band weights and preserves existing injuries', () => {
    const state = fixture();
    state.combat!.enemyHealth = 5; state.combat!.enemyRisk = 9;
    state.combat!.enemyInjuries = [{ id: 'old', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    const injuries = structuredClone(state.combat!.enemyInjuries);
    scriptRolls(1, 1, 257, 400, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.consequenceWeights).toEqual({ light: 0, heavy: 0, death: 100 });
    expect(round.pendingConsequence).toBeUndefined(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 5, enemyMind: 60, enemyRisk: 10, enemyStatus: 'RESISTING' });
    expect(state.combat!.enemyInjuries).toEqual(injuries);
  });

  it('ends at mental40 by voluntary surrender without healing, control or terminal recovery', () => {
    const state = fixture(); state.spirituality = 10; state.combat!.enemyMind = 80;
    scriptRolls(1, 1, 257, 400, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_SURRENDERED');
    expect(state.combat).toMatchObject({ enemyMind: 40, enemyHealth: 100, enemyInjuries: [], enemyStatus: 'SURRENDERED' });
    expect(round.consequence).toContain('自行放下短棍'); expect(round.pendingConsequence).toBeUndefined();
    expect(state.spirituality).toBe(7);
  });

  it('does not attach mental damage to awe, soothe or even successful suggestion alone', () => {
    for (const [ticket, check] of [[201, false], [337, true], [385, false]] as const) {
      const state = fixture();
      const draws = scriptRolls(...(check ? [1, 1, ticket, 1, 1, 1] : [1, 1, ticket, 1, 1]));
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.consequenceWeights).toBeNull(); expect(round.consequenceRoll).toBeUndefined();
      expect(state.combat).toMatchObject({ enemyMind: 100, enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(outcome).toBe('CONTINUE'); expect(round.moves).toHaveLength(2);
      expect(draws).toHaveBeenCalledTimes(check ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('retains physical consequences when an actual player strike accompanies mental pressure', () => {
    const state = fixture();
    scriptRolls(16, 1, 257, 400, 1, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.map(x => x.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves[0]!.label).toContain('狂乱'); expect(round.moves[2]!.label).toBe('普通打击');
    expect(outcome).toBe('ENEMY_DEAD');
    expect(state.combat).toMatchObject({ enemyMind: 100, enemyHealth: 0, enemyStatus: 'DEAD' });
  });

  it('keeps real enemy physical death consequences after the player uses a mental ability', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(1, 1, 257, 1, 1_000_000, 96);
    const { outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(state.combat).toMatchObject({ enemyMind: 100, enemyHealth: 100, enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(7);
  });

  it('resets mental pressure every round and retains all enemy actions after suggestion', () => {
    const state = fixture();
    scriptRolls(1, 86, 337, 1, 1, 1, 1, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.enemyCount).toBe(3);
    expect(result.round.moves.filter(x => x.actor === 'ENEMY')).toHaveLength(3);
    expect(result.round.consequenceWeights).toBeNull();
    vi.restoreAllMocks();
    const repeated = fixture(); scriptRolls(1, 1, 257, 400, 1, 1);
    resolveSliceCombatRound(repeated, 'ATTACK');
    expect(repeated.combat!.enemyMind).toBe(90);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 424, 1);
    const next = resolveSliceCombatRound(repeated, 'ATTACK');
    expect(next.round.first).toBe('ENEMY'); expect(next.round.consequenceWeights).toBeNull();
    expect(repeated.combat!.enemyMind).toBe(90);
  });

  it('retreats through the same actual exit without a free mental action or resource recovery', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('布莱斯'); expect(state.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3);
  });

  it('replays serialized state through the same stream with no Math.random or new hidden information', () => {
    const state = fixture(); state.random.cursor = 7;
    const reloaded = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(reloaded, 'CONTROL'));
    expect(state).toEqual(reloaded); expect(forbidden).not.toHaveBeenCalled();
  });
});
