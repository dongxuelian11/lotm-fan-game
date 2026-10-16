import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  ASTROLOGER_COUNT_WHEEL, astrologerAbilityWheel, astrologerActionCount, currentAstrologerCombatSource,
  currentRecorderCombatSource, drawAstrologerAbility, hasAstrologerCombat, isAstrologer, isRecorder,
  resolveAstrologerCombatAbility, storedRecorderCombatRecord,
  type AstrologerCombatSource, type AstrologerMoveId, type RecorderRoundContext,
} from '../../src/domain/astrologer/combat.js';
import type { RecorderRecord, RecorderSampleId } from '../../src/domain/recorder/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const release = 'door.s6.release', recording = 'door.s6.recording';
const opening = 'door.s9.door-opening', tricks = 'door.s8.tricks';
const ids = ['TRICK_ATTACK', 'BODY_FOLLOWUP', 'TRICK_COVER', 'SITE_PRESSURE', 'OBSERVE', 'ACCIDENT', release];
/** Synthetic current visit; the public paid arrival and actual recording checks have separate tests. */
function fixture(): SliceState {
  const state = createSliceRun('recorder-combat-test', sliceDefaultCreationSelection, 'recorder-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'door', sequence: 6,
    mastery: { [opening]: 500, [tricks]: 0, [recording]: 0, [release]: 0 }, acting: 0, promotionWeek: 1 };
  state.recorder.cases['missing-source']!.status = 'RESOLVED';
  state.recorder.cases['missing-source']!.outcome = 'LIMIT_REVIEWED';
  state.recorder.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week };
  state.combat = { encounterId: 'RECORDER_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function originalRecord(state: SliceState, sample: RecorderSampleId = 'FLASH'): RecorderRecord {
  const sourceDemoId = `recorder-demo-${state.recorder.demonstrations.length + 1}`;
  state.recorder.demonstrations.push({ id: sourceDemoId, sample, actor: sample === 'FLASH' ? 'NORA' : 'SAFF',
    week: state.week, revision: state.revision, success: true });
  const record: RecorderRecord = { id: `recorder-record-${state.recorder.records.length + 1}`, sample,
    sequence: sample === 'FLASH' ? 8 : 9, sourceDemoId, createdWeek: state.week,
    status: 'STORED', releasedWeek: null };
  state.recorder.records.push(record);
  return record;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: AstrologerMoveId, context: RecorderRoundContext = { recordingId: null, released: false },
  physical = 1, source = currentAstrologerCombatSource(state)) {
  return resolveAstrologerCombatAbility(state, id, physical, stream(state), source, context);
}
/** Select exact legal draws while advancing the production replay cursor. */
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

describe('Recorder S6 finite profile and original S7 defaults', () => {
  it('routes seven exact slots with inherited counts and detached public wheels', () => {
    const state = fixture();
    expect(isRecorder(state)).toBe(true); expect(isAstrologer(state)).toBe(false);
    expect(hasAstrologerCombat(state)).toBe(true);
    expect(playerAbilityWheel(state, null).map(item => item.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(item => item.weight)).toEqual([18, 12, 25, 15, 8, 5, 17]);
    expect(playerCountWheel(state)).toEqual(ASTROLOGER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(item => item.weight)).toEqual([10, 15, 20, 23, 20, 12]);
    expect(astrologerAbilityWheel(null).map(item => item.id)).toEqual(ids.slice(0, 6));
    expect(astrologerAbilityWheel(null).map(item => item.weight)).toEqual([18, 12, 32, 25, 8, 5]);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(astrologerAbilityWheel(stance, 6));
      expect(astrologerAbilityWheel(stance)).toEqual(astrologerAbilityWheel(stance, 7));
    }
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18); expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('draws both ends of every exact integer ticket interval without an extra draw', () => {
    for (const [stance, tickets] of [
      [null, [72, 48, 100, 60, 32, 20, 68]],
      ['ATTACK', [90, 60, 100, 60, 32, 20, 68]],
      ['DEFEND', [72, 48, 125, 60, 32, 20, 68]],
      ['CONTROL', [72, 48, 100, 75, 32, 20, 85]],
      ['PREPARE', [72, 48, 100, 60, 40, 20, 68]],
      ['RETREAT', [72, 48, 100, 60, 32, 20, 68]],
    ] as const) {
      const total = tickets.reduce<number>((sum, weight) => sum + weight, 0);
      expect(astrologerAbilityWheel(stance, 6).map(item => item.weight))
        .toEqual(tickets.map(weight => total === 400 ? weight / 4 : weight / total * 100));
      let boundary = 0;
      for (const [index, weight] of tickets.entries()) {
        const first = boundary + 1; boundary += weight;
        const random = stream(fixture()), draws = scriptRolls(first, boundary);
        expect(drawAstrologerAbility(random, stance, 6)).toBe(ids[index]);
        expect(drawAstrologerAbility(random, stance, 6)).toBe(ids[index]);
        expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); vi.restoreAllMocks();
      }
    }
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [45, 3],
      [46, 4], [68, 4], [69, 5], [88, 5], [89, 6], [100, 6]]) expect(astrologerActionCount(roll!)).toBe(count);
  });

  it('uses core30/25/30/15, base450, floor45, cap90, max80 and continuing recovery8', () => {
    const state = fixture(); state.spirituality = 72;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 281, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(473);
    expect(result.round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(80); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 281, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16); vi.restoreAllMocks();
    const floor = fixture(); floor.character.coreStats = { physique: -1000, perception: -1000, will: -1000, knowledge: -1000 };
    scriptRolls(1, 1, 281, 400, 1);
    expect(resolveSliceCombatRound(floor, 'PREPARE').round.playerAdvantage).toBe(45);
  });
});

describe('Current adult, scene and original stored provenance', () => {
  it('uses only the current Mir visit and never a FIRST_CASE carrier fallback', () => {
    const state = fixture(); state.world.carrierAlive = false; state.world.carrierCanResist = false;
    expect(currentRecorderCombatSource(state)).toMatchObject({ encounterId: 'RECORDER_DISPUTE',
      target: 'MIR_SINGLE_ORDINARY_ADULT', weapon: 'MIRS_ORDINARY_SHORT_CLUB', nature: 'ORDINARY_HUMAN',
      space: 'ORIGINAL_TEACHING_ROOM_OUTER_COURTYARD', lighting: 'ORIGINAL_FIXED_LAMPLIGHT',
      distanceMetres: 2, ground: 'CLEAR_ORDINARY_GROUND', bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    expect(currentAstrologerCombatSource(state)).toEqual(currentRecorderCombatSource(state));
    expect(resolve(state, 'SITE_PRESSURE').label).toContain('弥尔');
    expect(resolve(state, 'SITE_PRESSURE').label).not.toContain('携铃者');
    state.combat!.encounterId = 'FIRST_CASE'; state.arc.stage = 'COMBAT';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    const before = structuredClone(state), draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
    expect(currentAstrologerCombatSource(state)).toBeNull();
    expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow('来源无效');
    expect(draws).not.toHaveBeenCalled(); expect(state).toEqual(before);
  });

  it('rejects stale visits, noncurrent history and open or prepared daily scenes before RNG', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.recorder.encounter.status = 'AVAILABLE'; }, s => { s.recorder.encounter.attemptWeek = s.week - 1; },
      s => { s.recorder.encounter.startHistoryIndex = null; }, s => { s.recorder.encounter.startHistoryIndex = -1; },
      s => { s.recorder.encounter.startHistoryIndex = 1; }, s => { s.combat!.round = 2; },
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.recorder.cases['missing-source']!.status = 'AVAILABLE'; },
    ];
    for (const caseId of ['flash-screen', 'courage-task', 'missing-source']) {
      mutations.push(s => { s.recorder.cases[caseId]!.contactOpen = true; });
      mutations.push(s => { s.recorder.cases[caseId]!.status = 'PREPARED'; });
    }
    for (const mutate of mutations) {
      const state = fixture(); mutate(state); const before = structuredClone(state);
      const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(currentRecorderCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow('来源无效');
      expect(draws).not.toHaveBeenCalled(); expect(state).toEqual(before); vi.restoreAllMocks();
    }
    const state = fixture(); scriptRolls(1, 1, 281, 400, 1);
    state.combatHistory.push(structuredClone(resolveSliceCombatRound(state, 'PREPARE').round));
    expect(currentRecorderCombatSource(state)?.round).toBe(2); vi.restoreAllMocks();
    for (const mutate of [
      (s: SliceState) => { s.combatHistory[0]!.round = 2; },
      (s: SliceState) => { s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { s.combatHistory[0]!.retreat = 'SUCCESS'; },
    ]) {
      const invalid = structuredClone(state); mutate(invalid);
      const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(() => resolveSliceCombatRound(invalid, 'ATTACK')).toThrow('来源无效');
      expect(draws).not.toHaveBeenCalled(); vi.restoreAllMocks();
    }
  });

  it('rejects every forged source field and stale revision without consuming the selected record', () => {
    for (const key of Object.keys(currentRecorderCombatSource(fixture())!)) {
      const state = fixture(), record = originalRecord(state), source = currentRecorderCombatSource(state)!;
      const forged = { ...source, [key]: 'FORGED' } as unknown as AstrologerCombatSource;
      const before = structuredClone(state), random = stream(state), context = { recordingId: record.id, released: false };
      expect(resolveAstrologerCombatAbility(state, release, 1, random, forged, context))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(resolveAstrologerCombatAbility(state, 'TRICK_ATTACK', 1, random, forged).selfGain).toBe(0);
      expect(context.released).toBe(false); expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
    const state = fixture(), record = originalRecord(state), old = currentRecorderCombatSource(state)!;
    state.revision += 1;
    expect(resolve(state, release, { recordingId: record.id, released: false }, 1, old).enemyReduction).toBe(10);
    expect(record.status).toBe('STORED'); expect(state.spirituality).toBe(80);
  });

  it('rejects unknown, spent, forged, duplicated or source-less selections before any round RNG', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.recorder.records[0]!.status = 'RELEASED'; s.recorder.records[0]!.releasedWeek = s.week; },
      s => { s.recorder.records[0]!.releasedWeek = s.week; },
      s => { s.recorder.records[0]!.sequence = 9; },
      s => { s.recorder.records[0]!.createdWeek = s.week + 1; },
      s => { s.recorder.records[0]!.sourceDemoId = 'recorder-demo-999'; },
      s => { s.recorder.demonstrations[0]!.success = false; },
      s => { s.recorder.demonstrations[0]!.sample = 'COURAGE'; },
      s => { s.recorder.demonstrations[0]!.actor = 'SAFF'; },
      s => { s.recorder.demonstrations[0]!.revision = s.revision + 1; },
      s => { s.recorder.demonstrations[0]!.revision = 0; },
      s => { s.recorder.demonstrations[0]!.week = s.week + 1; },
      s => { s.recorder.records.push(structuredClone(s.recorder.records[0]!)); },
      s => { s.recorder.demonstrations.push(structuredClone(s.recorder.demonstrations[0]!)); },
      s => { s.recorder.records.push({ ...s.recorder.records[0]!, id: 'recorder-record-2' }); },
    ];
    for (const mutate of mutations) {
      const state = fixture(), record = originalRecord(state); mutate(state); const before = structuredClone(state);
      const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(storedRecorderCombatRecord(state, record.id)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'CONTROL', 'HOLD', 'HOLD', record.id)).toThrow('原记录无效');
      expect(draws).not.toHaveBeenCalled(); expect(state).toEqual(before); vi.restoreAllMocks();
    }
    for (const selection of ['', 'unknown', 'recorder-record-99']) {
      const state = fixture(); originalRecord(state); const before = structuredClone(state);
      const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
      expect(() => resolveSliceCombatRound(state, 'CONTROL', 'HOLD', 'HOLD', selection)).toThrow('原记录无效');
      expect(draws).not.toHaveBeenCalled(); expect(state).toEqual(before); vi.restoreAllMocks();
    }
    const old = fixture(); originalRecord(old); old.progression.sequence = 7; old.combat!.encounterId = 'FIRST_CASE';
    old.arc.stage = 'COMBAT'; old.world.carrierAlive = true; old.world.carrierCanResist = true;
    const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
    expect(() => resolveSliceCombatRound(old, 'CONTROL', 'HOLD', 'HOLD', 'recorder-record-1')).toThrow('原记录无效');
    expect(draws).not.toHaveBeenCalled();
  });
});

describe('Explicit once-only actual release and inherited budgets', () => {
  it('consumes only the explicitly selected original FLASH for2S with finite reduction and no RNG', () => {
    const state = fixture(), first = originalRecord(state), selected = originalRecord(state), courage = originalRecord(state, 'COURAGE');
    const context = { recordingId: selected.id, released: false }, before = structuredClone(state.recorder), random = stream(state);
    const effect = resolveAstrologerCombatAbility(state, release, 1, random, currentRecorderCombatSource(state), context);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 12 * 0.65, threatens: false });
    expect(effect.label).toContain(selected.id); expect(effect.label).toContain('弥尔');
    expect(first.status).toBe('STORED'); expect(courage.status).toBe('STORED');
    expect(selected).toEqual({ ...before.records[1], status: 'RELEASED', releasedWeek: state.week });
    expect(state.recorder.demonstrations).toEqual(before.demonstrations); expect(state.spirituality).toBe(78);
    expect(context.released).toBe(true); expect(random.cursor).toBe(0);
  });

  it('uses release mastery only for COURAGE self support and clamps every mastery boundary', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500, -50, 800, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(), record = originalRecord(state, 'COURAGE');
      state.progression.mastery[release] = mastery; state.progression.mastery[recording] = 500;
      const factor = 0.65 + 0.35 * Math.max(0, Math.min(500, Number.isFinite(mastery) ? mastery : 0)) / 500;
      expect(resolve(state, release, { recordingId: record.id, released: false }, 0))
        .toMatchObject({ selfGain: 12 * factor, enemyReduction: 0, threatens: false });
      expect(state.spirituality).toBe(78); expect(record.status).toBe('RELEASED');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING', enemyInjuries: [] });
    }
  });

  it('cannot spend twice in one round even if a caller selects another stored original', () => {
    const state = fixture(), first = originalRecord(state), second = originalRecord(state, 'COURAGE');
    const context = { recordingId: first.id, released: false }, random = stream(state), source = currentRecorderCombatSource(state);
    resolveAstrologerCombatAbility(state, release, 1, random, source, context);
    context.recordingId = second.id;
    expect(resolveAstrologerCombatAbility(state, release, 1, random, source, context))
      .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(state.spirituality).toBe(78); expect(second.status).toBe('STORED'); expect(random.cursor).toBe(0);
  });

  it('defaults to HOLD with ordinary guard10 without spending records, spirituality or RNG', () => {
    const state = fixture(); originalRecord(state); const before = structuredClone(state), random = stream(state);
    expect(resolveAstrologerCombatAbility(state, release, 1, random))
      .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    scriptRolls(1, 1, 348, 400, 1);
    expect(resolveSliceCombatRound(state, 'CONTROL').round.moves[0]!.enemyReduction).toBe(10);
    expect(state.recorder).toEqual(before.recorder); expect(state.spirituality).toBe(80);
  });

  it('requires finite2S and a still-current selected original, without redrawing or a partial debit', () => {
    for (const spirituality of [0, 1, 1.999, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(), record = originalRecord(state); state.spirituality = spirituality;
      const before = structuredClone(state), random = stream(state), context = { recordingId: record.id, released: false };
      expect(resolveAstrologerCombatAbility(state, release, 1, random, currentRecorderCombatSource(state), context))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(state).toEqual(before); expect(context.released).toBe(false); expect(random.cursor).toBe(0);
    }
    const state = fixture(), record = originalRecord(state); state.spirituality = 2;
    expect(resolve(state, release, { recordingId: record.id, released: false }).enemyReduction).toBe(12 * 0.65);
    expect(state.spirituality).toBe(0); expect(record.status).toBe('RELEASED');
    expect(resolve(state, release, { recordingId: record.id, released: false }).enemyReduction).toBe(10);
  });

  it('keeps R0 informational and never records a spell, predicts a draw or prepares a future effect', () => {
    const state = fixture(); originalRecord(state); const before = structuredClone(state), random = stream(state);
    const observed = resolveAstrologerCombatAbility(state, 'OBSERVE', 1, random);
    expect(observed).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(observed.label).toContain('不读取未来行动'); expect(state).toEqual(before); expect(random.cursor).toBe(0);
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; }, (s: SliceState) => { s.progression.sequence = 7; },
    ]) {
      const invalid = fixture(), record = originalRecord(invalid); mutate(invalid); const snapshot = structuredClone(invalid);
      expect(resolve(invalid, release, { recordingId: record.id, released: false }))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(invalid).toEqual(snapshot);
    }
  });

  it('retains every inherited S7 effect budget and original held-club replacement exactly', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[opening] = mastery; state.progression.mastery[tricks] = mastery;
      const f = 0.65 + 0.35 * mastery / 500;
      expect(resolve(state, 'TRICK_ATTACK').selfGain).toBe(26.325 * f);
      expect(resolve(state, 'TRICK_COVER').enemyReduction).toBe(23.4 * f);
      expect(resolve(state, 'BODY_FOLLOWUP', undefined, 0.8).selfGain).toBe(14.175 * f * 0.8);
      expect(resolve(state, 'SITE_PRESSURE').enemyReduction).toBe(12.6 * f);
      expect(state.spirituality).toBe(76);
      state.spirituality = 0;
      expect(resolve(state, 'TRICK_ATTACK', undefined, 0.8).selfGain).toBe(6.5 * f * 0.8);
      expect(resolve(state, 'TRICK_COVER').enemyReduction).toBe(7.8 * f);
      state.town.clubLocation = 'HAND';
      expect(resolve(state, 'TRICK_ATTACK', undefined, 0.8).selfGain).toBe(16 * 0.8);
    }
    const state = fixture(); scriptRolls(1, 2);
    expect(resolve(state, 'ACCIDENT')).toMatchObject({ selfGain: -11.25, threatens: false });
    expect(resolve(state, 'ACCIDENT')).toMatchObject({ selfGain: 11.25, threatens: false });
  });
});

describe('Full round persistence and real enemy consequences', () => {
  it('selection alone reserves nothing and preserves the original when no release slot occurs', () => {
    const state = fixture(), record = originalRecord(state), before = structuredClone(state.recorder);
    const draws = scriptRolls(1, 1, 281, 400, 1);
    const result = resolveSliceCombatRound(state, 'PREPARE', 'HOLD', 'HOLD', record.id);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves).toHaveLength(2);
    expect(state.recorder).toEqual(before); expect(draws).toHaveBeenCalledTimes(5);
  });

  it('uses a single local once flag across two release slots with no release-success draw', () => {
    const state = fixture(), record = originalRecord(state); state.spirituality = 10;
    const draws = scriptRolls(11, 1, 348, 400, 348, 1);
    const result = resolveSliceCombatRound(state, 'CONTROL', 'HOLD', 'HOLD', record.id);
    expect(result.round.playerCount).toBe(2); expect(result.round.moves).toHaveLength(3);
    expect(result.round.moves[0]!.enemyReduction).toBe(12 * 0.65);
    expect(result.round.moves[2]!.enemyReduction).toBe(10);
    expect(state.spirituality).toBe(16); expect(draws).toHaveBeenCalledTimes(6); expect(state.random.cursor).toBe(6);
    expect(record.status).toBe('RELEASED'); expect(result.round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.enemyStatus).toBe('RESISTING');
  });

  it('keeps the consumed record after genuine injury or death, and never restores it on the next round or retreat', () => {
    for (const [roll, outcome, health] of [[1, 'CONTINUE', 90], [100, 'PLAYER_DEAD', 0]] as const) {
      const state = fixture(), record = originalRecord(state); state.spirituality = 10;
      const draws = scriptRolls(1, 1, 348, 1, 1_000_000, roll);
      const result = resolveSliceCombatRound(state, 'CONTROL', 'HOLD', 'HOLD', record.id);
      expect(result.outcome).toBe(outcome); expect(state.health).toBe(health);
      expect(result.round.moves[1]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
      expect(record.status).toBe('RELEASED'); expect(record.releasedWeek).toBe(state.week);
      expect(state.spirituality).toBe(outcome === 'CONTINUE' ? 16 : 8); expect(draws).toHaveBeenCalledTimes(6);
      vi.restoreAllMocks();
      if (outcome === 'CONTINUE') {
        state.combatHistory.push(structuredClone(result.round));
        const before = structuredClone(state), rejectedDraws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
        expect(() => resolveSliceCombatRound(state, 'CONTROL', 'HOLD', 'HOLD', record.id)).toThrow('原记录无效');
        expect(rejectedDraws).not.toHaveBeenCalled(); expect(state).toEqual(before); vi.restoreAllMocks();
        scriptRolls(1, 1, 400, 348, 1);
        state.combatHistory.push(structuredClone(resolveSliceCombatRound(state, 'CONTROL').round));
        expect(record.status).toBe('RELEASED'); vi.restoreAllMocks();
        scriptRolls(1, 1, 1);
        const retreat = resolveSliceCombatRound(state, 'RETREAT');
        expect(retreat.outcome).toBe('RETREATED'); expect(retreat.round.consequence).toContain('原教学室外空院');
        expect(retreat.round.consequence).toContain('弥尔'); expect(record.status).toBe('RELEASED');
        expect(state.health).toBe(90); vi.restoreAllMocks();
      }
    }
  });

  it('permits actual inherited attack consequences, including enemy death, with no forced release or revival', () => {
    for (const [roll, outcome, enemyStatus] of [[100, 'ENEMY_DEAD', 'DEAD'], [80, 'ENEMY_SURRENDERED', 'SURRENDERED']] as const) {
      const state = fixture(), record = originalRecord(state); state.town.clubLocation = 'HAND';
      const draws = scriptRolls(1, 1, 1, 400, 1, roll);
      const result = resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'HOLD', record.id);
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyStatus).toBe(enemyStatus);
      expect(state.combat!.enemyHealth).toBe(outcome === 'ENEMY_DEAD' ? 0 : 70);
      expect(result.round.consequence).toContain('弥尔'); expect(result.round.consequence).not.toContain('携铃者');
      expect(record.status).toBe('STORED'); expect(state.town.clubLocation).toBe('HAND');
      expect(state.health).toBe(100); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });
});
