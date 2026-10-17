import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { PSYCHOLOGIST_COUNT_WHEEL, currentPsychologistMindSource, drawPsychologistAbility,
  isPsychologist, psychologistAbilityWheel, resolvePsychologistCombatAbility,
  type PsychologistMindSource, type PsychologistMoveId } from '../../src/domain/psychologist/combat.js';
import { AUDIENCE_COUNT_WHEEL, audienceAbilityWheel } from '../../src/domain/audience/combat.js';
import { MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel } from '../../src/domain/mindreader/combat.js';
import type { SliceCombatRound, SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const profile: readonly [PsychologistMoveId, number, SliceStance | null][] = [
  ['STRIKE', 6, 'ATTACK'], ['BLOCK', 6, 'DEFEND'], ['EVADE', 6, 'DEFEND'],
  ['audience.observation', 6, 'PREPARE'], ['audience.behavior-analysis', 5, 'CONTROL'],
  ['audience.memory-deduction', 4, 'PREPARE'], ['audience.mind-reading', 4, 'CONTROL'],
  ['audience.s7.awe', 11, 'CONTROL'], ['audience.s7.frenzy', 12, 'ATTACK'],
  ['audience.s7.suggestion', 9, 'CONTROL'], ['audience.s7.soothe', 7, 'DEFEND'],
  ['audience.s6.combat-hypnosis', 14, 'CONTROL'], ['audience.s6.scales', 8, 'DEFEND'], ['MISS', 2, null],
];
const hypnosis = 'audience.s6.combat-hypnosis';
const scales = 'audience.s6.scales';
function fixture(): SliceState {
  const state = createSliceRun('hypnotist-combat-test', sliceDefaultCreationSelection, 'hypnotist-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'audience', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  state.hypnotist.encounter = { status: 'FIGHTING', attemptWeek: state.week,
    startHistoryIndex: state.combatHistory.length };
  state.combat = { encounterId: 'HYPNOTIST_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 80;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function ticket(id: PsychologistMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
/** Keep the real stream/cursor while choosing exact documented resolution bands. */
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
function resolve(state: SliceState, id: PsychologistMoveId, source = currentPsychologistMindSource(state)) {
  return resolvePsychologistCombatAbility(state, id, 1, stream(state), source);
}
function previousRound(): SliceCombatRound {
  return { round: 1, stance: 'PREPARE', first: 'PLAYER', playerCount: 1, enemyCount: 1,
    playerCountRoll: 1, enemyCountRoll: 1,
    moves: [{ actor: 'ENEMY', label: '格挡护身', selfGain: 0, enemyReduction: 10 }],
    playerAdvantage: 465, enemyAdvantage: 114, winChance: 465 / 579 * 100,
    winner: 'PLAYER', consequence: '未增加伤势', consequenceWeights: null, retreat: 'NONE' };
}
afterEach(() => vi.restoreAllMocks());

describe('hypnotist S6 finite inherited wheel', () => {
  it('retains all old abilities and adds only battle hypnosis and physical scales', () => {
    const state = fixture();
    expect(isPsychologist(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(PSYCHOLOGIST_COUNT_WHEEL);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel).toEqual(psychologistAbilityWheel(null, 6));
    expect(wheel.map(entry => [entry.id, entry.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(wheel.reduce((total, entry) => total + entry.weight, 0)).toBe(100);
    expect(wheel.map(entry => entry.id)).toContain('audience.s7.frenzy');
    expect(wheel.map(entry => entry.id)).not.toContain('audience.s6.hypnosis');
    expect(wheel.map(entry => entry.id)).not.toContain('audience.s6.psychological-invisibility');
    wheel[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(6);
  });

  it('normalizes each stance and draws both endpoints of every sector exactly once', () => {
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      expect(psychologistAbilityWheel(stance, 6).map(entry => entry.weight))
        .toEqual(weights.map(weight => total === 400 ? weight / 4 : weight / total * 100));
      let boundary = 0;
      for (let index = 0; index < profile.length; index += 1) {
        const first = boundary + 1;
        boundary += weights[index]!;
        scriptRolls(first, boundary);
        const random = stream(fixture());
        expect(drawPsychologistAbility(random, stance, 6)).toBe(profile[index]![0]);
        expect(drawPsychologistAbility(random, stance, 6)).toBe(profile[index]![0]);
        expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
    }
  });

  it('leaves default S7 and old S8/S9/ordinary profiles unchanged', () => {
    const old = fixture(); old.progression.sequence = 7;
    expect(playerAbilityWheel(old, null)).toEqual(psychologistAbilityWheel(null));
    expect(psychologistAbilityWheel(null).map(entry => entry.weight)).toEqual([8, 8, 8, 8, 6, 5, 5, 14, 16, 12, 8, 2]);
    expect(psychologistAbilityWheel(null).some(entry => entry.id.startsWith('audience.s6.'))).toBe(false);
    for (const [sequence, counts, wheel] of [
      [8, MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel(null)],
      [9, AUDIENCE_COUNT_WHEEL, audienceAbilityWheel(null)],
      [null, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, null)],
    ] as const) {
      old.progression.sequence = sequence;
      if (sequence === null) old.progression.pathwayId = null;
      expect(isPsychologist(old)).toBe(false);
      expect(playerCountWheel(old)).toEqual(counts);
      expect(playerAbilityWheel(old, null)).toEqual(wheel);
    }
  });

  it('uses G tier450, S6 core30/25/30/15, no global boost, and continuing recovery8 up to80', () => {
    for (const [spirituality, expected, advantage] of [[79, 80, 473], [30, 38, 425.7]] as const) {
      const state = fixture(); state.spirituality = spirituality;
      state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
      scriptRolls(1, 1, ticket('MISS', 'ATTACK'), 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.playerAdvantage).toBeCloseTo(advantage);
      expect(round.enemyAdvantage).toBe(114);
      expect(outcome).toBe('CONTINUE');
      expect(state.spirituality).toBe(expected);
      vi.restoreAllMocks();
    }
  });
});

describe('the real Rowan mind source stays tied to this encounter', () => {
  it('authors one awake ordinary adult two metres away with no bystander, old-life dependency or special protection', () => {
    const state = fixture();
    state.world.carrierAlive = false; state.world.carrierCanResist = false;
    state.psychologist.encounter.status = 'RESOLVED'; state.psychologist.encounter.observed = false;
    expect(currentPsychologistMindSource(state)).toEqual({ encounterId: 'HYPNOTIST_DISPUTE', round: 1,
      attemptWeek: state.week, startHistoryIndex: 0, target: 'ROWAN_SINGLE_AWAKE_ADULT',
      mind: 'ORDINARY_UNPROTECTED', space: 'EMPTY_CLUB_BACK_PASSAGE', distanceMetres: 2,
      bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', aggression: 'VISIBLE_SHORT_CLUB_THREAT' });
    expect(resolve(state, 'audience.s7.awe')).toMatchObject({ enemyReduction: 22, threatens: false });
    expect(state.spirituality).toBe(78);
  });

  it('requires live local opposition, S6, same week and the exact current history segment', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.hypnotist.encounter.status = 'AVAILABLE'; },
      state => { state.hypnotist.encounter.attemptWeek = null; },
      state => { state.hypnotist.encounter.attemptWeek = state.week - 1; },
      state => { state.hypnotist.encounter.startHistoryIndex = null; },
      state => { state.hypnotist.encounter.startHistoryIndex = -1; },
      state => { state.hypnotist.encounter.startHistoryIndex = 1; },
      state => { state.combatHistory.push(previousRound()); },
      state => { state.combat!.round = 2; },
      state => { state.combat = null; },
      state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.enemyStatus = 'DEAD'; },
      state => { state.combat!.enemyHealth = 0; },
      state => { state.combat!.enemyMind = 0; },
      state => { state.world.city = 'ELSEWHERE'; },
      state => { state.status = 'DEAD'; },
      state => { state.health = 0; },
      state => { state.progression.sequence = 7; },
      state => { state.progression.pathwayId = 'hunter'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(); mutate(state);
      const before = structuredClone(state), random = stream(state);
      expect(currentPsychologistMindSource(state)).toBeNull();
      expect(resolvePsychologistCombatAbility(state, hypnosis, 1, random).mentalPressure).toBe(false);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rejects forged or stale source details without spending or redrawing', () => {
    const state = fixture(), source = currentPsychologistMindSource(state)!;
    const changes = [{ round: 2 }, { attemptWeek: state.week + 1 }, { startHistoryIndex: 9 },
      { target: 'BRYCE_SINGLE_AWAKE_ADULT' }, { mind: 'PROTECTED' }, { space: 'PUBLIC_ROOM' },
      { distanceMetres: 20 }, { bystanders: 'CROWD' }, { exit: 'TELEPORT' }, { aggression: 'NONE' }];
    for (const invalid of [null, ...changes.map(change => ({ ...source, ...change }) as PsychologistMindSource)]) {
      const before = structuredClone(state), random = stream(state);
      const effect = resolvePsychologistCombatAbility(state, hypnosis, 1, random, invalid);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false, mentalPressure: false });
      expect(effect.label).toContain('不重抽');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('does not invent minds for other scenes or replace their older source rules', () => {
    for (const encounterId of ['FIRST_CASE', 'CONSPIRATOR_DISPUTE', 'FACELESS_DISPUTE', 'CLOWN_RESCUE'] as const) {
      const state = fixture(); state.combat!.encounterId = encounterId;
      const before = structuredClone(state), random = stream(state);
      expect(currentPsychologistMindSource(state)).toBeNull();
      expect(resolvePsychologistCombatAbility(state, hypnosis, 1, random)).toMatchObject({ enemyReduction: 10 });
      expect(resolvePsychologistCombatAbility(state, 'audience.s7.frenzy', 1, random).mentalPressure).toBe(false);
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const older = fixture(); older.combat!.encounterId = 'PSYCHOLOGIST_DISPUTE';
    older.psychologist.encounter.status = 'FIGHTING'; older.psychologist.encounter.observed = true;
    older.psychologist.encounter.attemptWeek = older.week; older.psychologist.encounter.startHistoryIndex = 0;
    expect(currentPsychologistMindSource(older)?.target).toBe('BRYCE_SINGLE_AWAKE_ADULT');
    expect(resolve(older, 'audience.s7.frenzy').label).toContain('布莱斯');
  });

  it('inherits observations and checked shallow thoughts only from Rowan and same-scene prior actions', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(resolve(state, 'audience.observation')).toMatchObject({ selfGain: 8, threatens: false });
    expect(resolve(state, 'audience.observation').label).toContain('约2米');
    expect(resolve(state, 'audience.behavior-analysis')).toMatchObject({ selfGain: 6 });
    state.lastCombatRound = previousRound();
    expect(resolve(state, 'audience.memory-deduction').selfGain).toBe(0);
    const prior = previousRound(); state.combatHistory.push(prior);
    state.combat!.round = 2; state.combat!.lastRound = prior;
    expect(resolve(state, 'audience.memory-deduction')).toMatchObject({ selfGain: 6, threatens: false });
    scriptRolls(1);
    const read = resolve(state, 'audience.mind-reading');
    expect(read.selfGain).toBe(10); expect(read.label).toContain('罗温');
    expect(read.label).not.toContain('携铃者'); expect(state.spirituality).toBe(79);
    expect(state.lastCheck).toMatchObject({ ability: 'perception', difficulty: 12, roll: 1 });
  });
});

describe('limited immediate S6 abilities', () => {
  it('checks ordinary resistance and retains all three spirituality on failure', () => {
    for (const [roll, tier, reduction] of [[1, 'GREAT_SUCCESS', 18], [52, 'SUCCESS', 18],
      [53, 'FAILURE', 0], [100, 'GREAT_FAILURE', 0]] as const) {
      const state = fixture(), before = structuredClone(state), random = stream(state);
      scriptRolls(roll);
      const effect = resolvePsychologistCombatAbility(state, hypnosis, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: reduction, threatens: false, mentalPressure: false });
      expect(state.lastCheck).toMatchObject({ ability: 'will', difficulty: 14, chance: 52, roll, tier });
      expect(state).toEqual({ ...before, spirituality: 77, lastCheck: state.lastCheck });
      expect(random.cursor).toBe(1);
      expect(effect.label).toContain(reduction > 0 ? '短暂迟疑后醒来' : '抵抗了引导');
      expect(effect.label).toContain('不指令自杀');
      vi.restoreAllMocks();
    }
  });

  it('uses only the selected new ability mastery and never scales every inherited effect', () => {
    const state = fixture(); state.progression.mastery = { [hypnosis]: 500, [scales]: 250,
      'audience.s7.awe': 500, 'audience.s7.frenzy': 500, 'audience.s6.hypnosis': 500,
      'audience.s6.psychological-invisibility': 500 };
    scriptRolls(1);
    expect(resolve(state, hypnosis).enemyReduction).toBe(36);
    expect(resolve(state, scales).enemyReduction).toBe(21);
    expect(resolve(state, 'audience.s7.awe').enemyReduction).toBe(22);
    expect(resolve(state, 'audience.s7.frenzy').selfGain).toBe(28);
    expect(resolve(state, 'STRIKE').selfGain).toBe(12);
    expect(state.spirituality).toBe(70);
  });

  it('spends two spirituality for finite physical protection without injury repair or extra damage', () => {
    const state = fixture(); state.injuries = [{ id: 'old', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }];
    state.health = 90; state.mind = 70;
    const before = structuredClone(state), random = stream(state);
    const effect = resolvePsychologistCombatAbility(state, scales, 1, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 14, threatens: false, mentalPressure: false });
    expect(effect.label).toContain('不抵挡精神攻击'); expect(effect.label).toContain('不改原伤势');
    expect(state).toEqual({ ...before, spirituality: 78 }); expect(random.cursor).toBe(0);
  });

  it('falls back to one ordinary defense on insufficient spirituality or an unavailable S6 ability', () => {
    for (const [id, available] of [[hypnosis, 2.5], [scales, 1.5]] as const) {
      const state = fixture(); state.spirituality = available;
      const before = structuredClone(state), random = stream(state);
      expect(resolvePsychologistCombatAbility(state, id, 1, random)).toMatchObject({ enemyReduction: 10, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const old = fixture(); old.progression.sequence = 7;
    const before = structuredClone(old);
    expect(resolve(old, scales).enemyReduction).toBe(10);
    expect(old).toEqual(before);
  });

  it('keeps real body/tool attacks physical and uses no invented or transferred object', () => {
    const state = fixture(), random = stream(state);
    expect(resolvePsychologistCombatAbility(state, 'STRIKE', 0.8, random))
      .toMatchObject({ selfGain: 12 * 0.8, threatens: true, mentalPressure: false });
    state.town.clubLocation = 'HAND';
    expect(resolvePsychologistCombatAbility(state, 'STRIKE', 0.8, random))
      .toMatchObject({ selfGain: 16 * 0.8, threatens: true, mentalPressure: false });
    expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
    expect(state.town.clubLocation).toBe('HAND'); expect(state.spirituality).toBe(80);
  });
});

describe('real shared rounds preserve physical risks and finite mental consequences', () => {
  it('resolves actual hypnosis success and resistance without removing any enemy action', () => {
    for (const [check, reduction] of [[1, 18], [100, 0]] as const) {
      const state = fixture(); state.spirituality = 20;
      const draws = scriptRolls(1, 86, ticket(hypnosis, 'CONTROL'), check, 1, 1, 1, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'CONTROL');
      expect(round.moves[0]!.label).toContain('短暂战斗催眠');
      expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
      expect(round.enemyAdvantage).toBe(114 + 3 * 16 - reduction);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [] });
      expect(state.spirituality).toBe(25); expect(draws).toHaveBeenCalledTimes(8);
      expect(Object.keys(state.hypnotist.encounter).sort()).toEqual(['attemptWeek', 'startHistoryIndex', 'status']);
      vi.restoreAllMocks();
    }
  });

  it('uses the ordinary fallback inside the real round for stale sources and depleted spirituality', () => {
    for (const missing of ['source', 'spirituality'] as const) {
      const state = fixture(); state.spirituality = missing === 'spirituality' ? 2 : 20;
      if (missing === 'source') state.hypnotist.encounter.attemptWeek = state.week - 1;
      scriptRolls(1, 1, ticket(hypnosis, 'CONTROL'), 400, 1);
      const { round } = resolveSliceCombatRound(state, 'CONTROL');
      expect(round.moves[0]!.label).toContain('改用格挡护身');
      expect(round.enemyAdvantage).toBe(104); expect(state.lastCheck).toBeNull();
      expect(state.spirituality).toBe(missing === 'spirituality' ? 10 : 28);
      vi.restoreAllMocks();
    }
  });

  it('does not carry hypnosis into the next round or mutate the original route and objects', () => {
    const state = fixture(), town = structuredClone(state.town);
    scriptRolls(1, 1, ticket(hypnosis, 'CONTROL'), 1, 400, 1);
    const first = resolveSliceCombatRound(state, 'CONTROL');
    state.combatHistory.push(first.round);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 400, ticket('MISS', 'CONTROL'), 1);
    const second = resolveSliceCombatRound(state, 'CONTROL');
    expect(second.round.enemyAdvantage).toBe(114);
    expect(second.round.consequenceWeights).toBeNull(); expect(state.town).toEqual(town);
  });

  it('resolves real scale defense without erasing an enemy strike or its death consequence', () => {
    const state = fixture(); state.spirituality = 20;
    scriptRolls(1, 1, ticket(scales, 'DEFEND'), 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'DEFEND');
    expect(round.moves[0]!.label).toContain('鳞片防护');
    expect(round.moves[1]!.label).toBe('短棍打击');
    expect(round.enemyAdvantage).toBe(116); expect(outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0); expect(state.spirituality).toBe(18);
  });

  it('retains ordinary heavy surrender and both physical death branches', () => {
    for (const [win, consequence, outcome] of [[1, 66, 'ENEMY_SURRENDERED'],
      [1, 96, 'ENEMY_DEAD'], [1_000_000, 96, 'PLAYER_DEAD']] as const) {
      const state = fixture(); state.spirituality = 20;
      scriptRolls(1, 1, ticket('STRIKE', 'ATTACK'), 1, win, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.round.moves[0]!.label).toBe('普通打击'); expect(result.outcome).toBe(outcome);
      if (outcome === 'ENEMY_SURRENDERED') {
        expect(state.combat).toMatchObject({ enemyHealth: 70, enemyMind: 100, enemyStatus: 'SURRENDERED' });
        expect(result.round.consequence).toContain('罗温仍然活着');
        expect(result.round.consequence).toContain('自行放下原短棍');
      } else if (outcome === 'ENEMY_DEAD') expect(state.combat!.enemyHealth).toBe(0);
      else expect(state.health).toBe(0);
      expect(state.spirituality).toBe(20);
      vi.restoreAllMocks();
    }
  });

  it('keeps pure inherited frenzy mental and ends in voluntary living surrender at mind40', () => {
    const state = fixture(); state.combat!.enemyMind = 80; state.spirituality = 20;
    state.combat!.enemyInjuries = [{ id: 'old', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null }];
    const injuries = structuredClone(state.combat!.enemyInjuries);
    scriptRolls(1, 1, ticket('audience.s7.frenzy', 'ATTACK'), 400, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves[0]!.label).toContain('罗温');
    expect(state.combat).toMatchObject({ enemyMind: 40, enemyHealth: 100, enemyInjuries: injuries, enemyStatus: 'SURRENDERED' });
    expect(round.consequence).toContain('自行放下短棍'); expect(round.consequence).toContain('没有成为受控者');
    expect(state.spirituality).toBe(17);
  });

  it('keeps the original exit and costs on retreat without chase, movement power or recovery', () => {
    const state = fixture(); state.spirituality = 20;
    const town = structuredClone(state.town);
    const draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.consequence).toContain('罗温'); expect(state.spirituality).toBe(20);
    expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('preserves Faceless and Conspirator opponent labels', () => {
    for (const [encounterId, name] of [['FACELESS_DISPUTE', '达恩'], ['CONSPIRATOR_DISPUTE', '奥伦']] as const) {
      const state = fixture(); state.combat!.encounterId = encounterId;
      scriptRolls(1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 66);
      const { round } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.consequence).toContain(`${name}仍然活着`);
      vi.restoreAllMocks();
    }
  });

  it('replays serialized rounds deterministically without a persistent control queue or hidden knowledge', () => {
    const state = fixture(); state.random.cursor = 7;
    const reloaded = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(reloaded, 'CONTROL'));
    expect(state).toEqual(reloaded); expect(forbidden).not.toHaveBeenCalled();
  });
});
