import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { READER_COUNT_WHEEL, currentReaderActionSource, drawReaderAbility, isReader,
  readerAbilityWheel, readerActionCount, resolveReaderCombatAbility,
  type ReaderActionSource, type ReaderMoveId } from '../../src/domain/reader/combat.js';
import { audienceAbilityWheel, AUDIENCE_COUNT_WHEEL } from '../../src/domain/audience/combat.js';
import { sleeplessAbilityWheel, SLEEPLESS_COUNT_WHEEL } from '../../src/domain/sleepless/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const primary = 'reader.s9.ritual-tool', secondary = 'reader.s9.prepared-talisman';
const protection = 'reader.s9.ritual-protection', identification = 'reader.s9.quick-identification';
const ids = [primary, secondary, protection, identification, 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('reader-combat-test', sliceDefaultCreationSelection, 'reader-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'white-tower', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 30;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: ReaderMoveId, source = currentReaderActionSource(state)) {
  return resolveReaderCombatAbility(state, id, 1, stream(state), source);
}
/** Script values while consuming the actual deterministic cursor. */
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
/** Source fixtures come from an actual resolved ordinary enemy action. */
function afterFirstRound(enemyRoll = 1): SliceState {
  const state = fixture();
  scriptRolls(1, 1, 349, enemyRoll, 1);
  const result = resolveSliceCombatRound(state, 'PREPARE');
  expect(result.outcome).toBe('CONTINUE');
  vi.restoreAllMocks();
  return state;
}
afterEach(() => vi.restoreAllMocks());

describe('Reader S9 confirmed White Tower combat profile', () => {
  it('selects the exact six-slot I profile and independent 45/35/20 count wheel', () => {
    const state = fixture();
    expect(isReader(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(readerAbilityWheel(null));
    expect(readerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(readerAbilityWheel(null).map(entry => entry.weight)).toEqual([18, 12, 32, 25, 8, 5]);
    expect(playerCountWheel(state)).toEqual(READER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([45, 35, 20]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18);
    expect(playerCountWheel(state)[0]!.weight).toBe(45);
  });

  it('preserves all boundaries, drawing exactly once for each ability', () => {
    for (const [roll, count] of [[1, 1], [45, 1], [46, 2], [80, 2], [81, 3], [100, 3]]) {
      expect(readerActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of readerAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draw = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawReaderAbility(random, null)).toBe(entry.id);
      expect(drawReaderAbility(random, null)).toBe(entry.id);
      expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes only the selected stance slots by exact ×1.25 integer tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [90, 60, 128, 100, 32, 20]],
      ['DEFEND', [72, 48, 160, 100, 32, 20]],
      ['CONTROL', [72, 48, 128, 125, 32, 20]],
      ['PREPARE', [72, 48, 128, 100, 40, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, value) => sum + value, 0);
      expect(readerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(n => n / total * 100));
    }
    expect(readerAbilityWheel('RETREAT')).toEqual(readerAbilityWheel(null));
  });

  it('uses base200, core10/30/20/40, cap40, spirituality30 and the existing status penalties', () => {
    const state = fixture(); state.spirituality = 29;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 379, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(229); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(30);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 379, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(6);
  });

  it('keeps existing ordinary, Audience and Sleepless wheels unchanged', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9], ['moon', 8], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isReader(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'audience'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(AUDIENCE_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(audienceAbilityWheel('CONTROL'));
    state.progression.pathwayId = 'darkness';
    expect(playerCountWheel(state)).toEqual(SLEEPLESS_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(sleeplessAbilityWheel('DEFEND'));
  });
});

describe('actual preparation, ordinary fallbacks and finite identification', () => {
  it('never invents prepared ritual/talisman effects, materials, costs or mastery', () => {
    const state = fixture(); state.spirituality = 0;
    state.progression.mastery = { 'reader.s9.memory': 500, 'reader.s9.understanding': 500,
      'reader.s9.ritual-procedure': 500 };
    const before = structuredClone(state), random = stream(state);
    expect(resolveReaderCombatAbility(state, primary, 0.8, random)).toMatchObject({ selfGain: 12 * 0.8, enemyReduction: 0, threatens: true });
    expect(resolveReaderCombatAbility(state, secondary, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 8, threatens: false });
    expect(resolveReaderCombatAbility(state, protection, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(resolveReaderCombatAbility(state, identification, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    for (const id of [primary, secondary, protection, identification] as const) {
      expect(resolveReaderCombatAbility(state, id, 1, random).label).toMatch(/改用.*不耗灵性.*不重抽/);
    }
    expect(random.cursor).toBe(0); expect(state).toEqual(before);
  });

  it('uses only the actually held short club, replacing rather than adding any ritual budget', () => {
    const state = fixture(); state.progression.mastery['reader.s9.ritual-procedure'] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      const before = structuredClone(state), random = stream(state), armed = location === 'HAND';
      const effect = resolveReaderCombatAbility(state, primary, 0.8, random);
      expect(effect.selfGain).toBe((armed ? 16 : 12) * 0.8);
      expect(effect.label).toContain('不叠加仪式预算');
      expect(resolveReaderCombatAbility(state, secondary, 1, random).selfGain).toBe(0);
      if (armed) expect(playerAbilityWheel(state, null)[0]!.label).toContain('持握原短棍');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const factor of [0, -1, Number.NaN]) {
      expect(resolveReaderCombatAbility(state, primary, factor, stream(state))).toMatchObject({ selfGain: 0, threatens: false });
    }
  });

  it('identifies the actual last ordinary action with unrounded 4.9f understanding and no extra check', () => {
    for (const mastery of [0, 250, 500]) {
      const state = afterFirstRound(); state.spirituality = 0;
      state.progression.mastery['reader.s9.understanding'] = mastery;
      const source = currentReaderActionSource(state)!;
      expect(source).toMatchObject({ runId: state.runId, encounterId: 'FIRST_CASE', round: 2,
        previousRound: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
        move: { actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 } });
      const before = structuredClone(state), random = stream(state);
      const effect = resolveReaderCombatAbility(state, identification, 1, random, source);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 4.9 * (0.65 + 0.35 * mastery / 500), threatens: false });
      expect(effect.label).toContain('上一轮已展示的「短棍打击」');
      expect(effect.label).toContain('自身优势+16、削减对手0');
      expect(state).toEqual(before); expect(random.cursor).toBe(before.random.cursor);
    }
  });

  it('does not add knowledge twice or convert memory/event records into combat powers', () => {
    const state = afterFirstRound(161);
    state.progression.mastery['reader.s9.understanding'] = 250;
    for (const knowledge of [0, 100, 500]) {
      state.character.coreStats.knowledge = knowledge;
      state.progression.mastery['reader.s9.memory'] = knowledge;
      state.progression.mastery['reader.s9.ritual-procedure'] = knowledge;
      state.knowledge = [{ id: 'unrelated-private', week: 1, title: 'SECRET', text: 'HIDDEN_TARGET_TRUTH' }];
      const before = structuredClone(state), effect = resolve(state, identification);
      expect(effect.enemyReduction).toBe(4.9 * 0.825);
      expect(effect.label).toContain('格挡护身'); expect(effect.label).not.toContain('HIDDEN_TARGET_TRUTH');
      expect(state).toEqual(before);
    }
  });

  it('keeps preparation at R0 and ±5 accidents on exactly one draw without damage permission', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    expect(resolveReaderCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0);
    const draws = scriptRolls(1, 2);
    expect(resolveReaderCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -5, enemyReduction: 0, threatens: false });
    expect(resolveReaderCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 5, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); expect(state).toEqual(before);
  });
});

describe('current encounter and previous-action source boundaries', () => {
  it('never uses unrelated global history when the actual current encounter has no prior round', () => {
    const old = afterFirstRound(), state = fixture();
    state.lastCombatRound = structuredClone(old.combat!.lastRound);
    state.combatHistory = [structuredClone(old.combat!.lastRound!)];
    state.knowledge = [{ id: 'old-reader', week: 1, title: '旧案', text: 'HIDDEN_PAST_ONLY' }];
    expect(currentReaderActionSource(state)).toBeNull();
    const effect = resolve(state, identification);
    expect(effect.enemyReduction).toBe(10); expect(effect.label).toContain('改用普通格挡护身');
    expect(effect.label).not.toContain('HIDDEN_PAST_ONLY');
    state.combat!.round = 2;
    expect(currentReaderActionSource(state)).toBeNull();
  });

  it('rejects stale, altered or cross-run snapshots instead of reading their text', () => {
    const state = afterFirstRound(), source = currentReaderActionSource(state)!;
    const invalid: (ReaderActionSource | null)[] = [null, { ...source, runId: 'another-run' },
      { ...source, revision: source.revision + 1 }, { ...source, week: source.week + 1 },
      { ...source, round: 3 }, { ...source, previousRound: 0 }, { ...source, previousWinner: 'ENEMY' },
      { ...source, previousRetreat: 'FAILURE' }, { ...source, enemyActionCount: 20 },
      { ...source, moveIndex: 100 },
      { ...source, target: 'HIDDEN_ENEMY' } as unknown as ReaderActionSource,
      { ...source, encounterId: 'HUNTER_CARGO' } as unknown as ReaderActionSource,
      { ...source, move: { ...source.move, label: 'HIDDEN_TARGET_TRUTH' } },
      { ...source, move: { ...source.move, actor: 'PLAYER' } },
      { ...source, move: { ...source.move, selfGain: 100 } },
      { ...source, move: { ...source.move, enemyReduction: 100 } }];
    for (const input of invalid) {
      const before = structuredClone(state), random = stream(state);
      const effect = resolveReaderCombatAbility(state, identification, 1, random, input);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(effect.label).not.toMatch(/HIDDEN_TARGET_TRUTH|HIDDEN_ENEMY/);
      expect(random.cursor).toBe(before.random.cursor); expect(state).toEqual(before);
    }
    source.move.label = 'ALTERED_COPY';
    expect(state.combat!.lastRound!.moves[1]!.label).toBe('短棍打击');
  });

  it('requires the live same-scene opponent and a completed immediately preceding ordinary action', () => {
    const mutations: ((state: SliceState) => void)[] = [
      s => { s.arc.stage = 'C'; }, s => { s.world.city = 'ELSEWHERE'; },
      s => { s.world.carrierAlive = false; }, s => { s.world.carrierCanResist = false; },
      s => { s.combat!.encounterId = 'HUNTER_CARGO'; }, s => { s.combat!.round = 3; },
      s => { s.combat!.lastRound = null; }, s => { s.combat!.lastRound!.winner = null; },
      s => { s.combat!.lastRound!.retreat = 'SUCCESS'; },
      s => { s.combat!.lastRound!.moves = s.combat!.lastRound!.moves.filter(m => m.actor === 'PLAYER'); },
      s => { s.combat!.lastRound!.moves[1]!.label = 'unknown-supernatural-action'; },
      s => { s.combat!.lastRound!.moves[1]!.selfGain = 500; },
    ];
    for (const mutate of mutations) {
      const state = afterFirstRound(), source = currentReaderActionSource(state)!;
      mutate(state); expect(currentReaderActionSource(state)).toBeNull();
      expect(resolve(state, identification, source)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    }
  });

  it('invalidates a prior source after the next round and never treats this round as foreknowledge', () => {
    const state = afterFirstRound(), source = currentReaderActionSource(state)!;
    // Round two is enemy-first: its block cannot become the Reader's source yet.
    scriptRolls(1, 1, 161, 249, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves[0]!.label).toBe('格挡护身');
    expect(round.moves[1]!.label).toContain('上一轮已展示的「短棍打击」');
    expect(currentReaderActionSource(state)!.move.label).toBe('格挡护身');
    expect(resolve(state, identification, source).enemyReduction).toBe(10);
  });

  it('never resolves any effect or consumes randomness in absent, ended or wrong-pathway combat', () => {
    for (const mutate of [
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.sequence = 8; },
      (s: SliceState) => { s.progression.pathwayId = 'audience'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentReaderActionSource(state)).toBeNull();
      for (const id of ids) expect(resolveReaderCombatAbility(state, id, 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('shared ordinary enemy, consequences and deterministic history', () => {
  it('retains enemy counts and every ordinary action without extra player actions or resources', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(1, 100, 151, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
    expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(1);
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 10 });
    expect(round.moves.slice(1).every(move => move.label === '短棍打击' && move.selfGain === 16)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(13); expect(state.week).toBe(before.week);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.progression).toEqual(before.progression); expect(draws).toHaveBeenCalledTimes(7);
    expect(state.combat!.lastRound).toEqual(round); expect(state.lastCombatRound).toEqual(round);
  });

  it('does not grant injury permission from R0, holding a club or a positive accident', () => {
    for (const slot of [379, 411]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 379 ? scriptRolls(1, 1, slot, 400, 1) : scriptRolls(1, 1, slot, 2, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 379 ? 0 : 5);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(slot === 379 ? 5 : 6); vi.restoreAllMocks();
    }
  });

  it('retains first-case physical surrender, injury risk and true death', () => {
    const attacking = fixture(); scriptRolls(1, 1, 1, 400, 1, 66);
    const attack = resolveSliceCombatRound(attacking, 'ATTACK');
    expect(attack.outcome).toBe('ENEMY_SURRENDERED');
    expect(attacking.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
    expect(attacking.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
    expect(attack.round.consequence).toContain('携铃者');
    vi.restoreAllMocks();
    const dying = fixture(); dying.health = 40; dying.spirituality = 5; dying.injuryRisk = 1;
    dying.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 151, 1, 1_000_000, 96);
    const death = resolveSliceCombatRound(dying, 'ATTACK');
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dying.health).toBe(0);
    expect(dying.spirituality).toBe(5); expect(dying.injuryRisk).toBe(2);
    expect(death.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
  });

  it('keeps the actual ordinary retreat and deterministic serialized replay without Math.random', () => {
    const retreating = fixture(); retreating.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const retreat = resolveSliceCombatRound(retreating, 'RETREAT');
    expect(retreat.outcome).toBe('RETREATED'); expect(retreat.round.moves).toEqual([]);
    expect(retreat.round.consequence).toContain('携铃者'); expect(retreating.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const state = afterFirstRound(); state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
  });
});
