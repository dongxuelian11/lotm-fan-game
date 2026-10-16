import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createTravelerState } from '../../src/domain/traveler/index.js';
import { TRAVELER_ABILITY_IDS } from '../../src/domain/traveler/types.js';
import { TRAVELER_COUNT_WHEEL, createTravelerRecorderRound, currentTravelerCombatSource, drawTravelerAbility,
  travelerAbilityWheel, travelerActionCount, isTraveler, resolveTravelerCombatAbility,
  type TravelerCombatSource, type TravelerMoveId } from '../../src/domain/traveler/combat.js';
import * as travelerCombat from '../../src/domain/traveler/combat.js';
import { applyTravelerEncounter, blockTravelerEncounter, hasTravelerDisputeOpponent,
  hasTravelerOpenPractice, settleTravelerEncounter, validateTravelerEncounter } from '../../src/domain/traveler/encounter.js';
import { ASTROLOGER_COUNT_WHEEL, astrologerAbilityWheel, currentRecorderCombatSource,
  resolveAstrologerCombatAbility, storedRecorderCombatRecord, type RecorderRoundContext } from '../../src/domain/astrologer/combat.js';
import { REAPER_COUNT_WHEEL } from '../../src/domain/reaper/combat.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const K = 'door.s5.travel', R = 'door.s6.release';
/** Bounded combat fixtures; not evidence of a naturally completed promotion. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('traveler-combat-test', sliceDefaultCreationSelection, 'traveler-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24; s.revision = 10;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'door', sequence: 5, mastery: { [K]: 0, [R]: 0, 'door.s5.invisible-hand': 0 }, acting: 25, promotionWeek: 22 };
  s.traveler = createTravelerState(); s.traveler.promotionWeek = 22;
  Object.assign(s.traveler.cases['known-landing']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'LANDING_CHECKED' });
  s.traveler.encounter = { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'TRAVELER_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
function addRecord(s: SliceState, sample: 'FLASH' | 'COURAGE' = 'FLASH') {
  const n = s.recorder.records.length + 1;
  s.recorder.demonstrations.push({ id: `recorder-demo-${n}`, sample, actor: sample === 'FLASH' ? 'NORA' : 'SAFF', week: 21, revision: 5, success: true });
  s.recorder.records.push({ id: `recorder-record-${n}`, sample, sequence: sample === 'FLASH' ? 8 : 9,
    status: 'STORED', sourceDemoId: `recorder-demo-${n}`, createdWeek: 21, releasedWeek: null });
}
const profile: readonly [TravelerMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['SECONDARY_STRIKE', 15, 'ATTACK'], ['EVADE', 20, 'DEFEND'],
  [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: TravelerMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-traveler', get cursor() { return cursor; }, nextInt(min, max) {
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
function effect(s: SliceState, id: TravelerMoveId, factor = 1,
  source: TravelerCombatSource | null = currentTravelerCombatSource(s), random = fixedRolls(),
  recorderRound: RecorderRoundContext = createTravelerRecorderRound(s)) {
  return resolveTravelerCombatAbility(s, id, factor, random, source, recorderRound);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(): SliceState {
  const s = fixture(); s.combat = null; s.traveler.encounter = createTravelerState().encounter;
  s.actionsRemaining = 4; return s;
}
afterEach(() => vi.restoreAllMocks());

describe('Traveler S5 finite original combat', () => {
  it('selects H30/J15/B20/K20/R10/A5 and exact S5 1–6 count tickets', () => {
    const s = fixture(); expect(isTraveler(s)).toBe(true);
    expect(TRAVELER_ABILITY_IDS).toEqual([K, 'door.s5.invisible-hand']);
    expect(playerAbilityWheel(s, null)).toEqual(travelerAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => [e.id, e.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(playerCountWheel(s)).toEqual(TRAVELER_COUNT_WHEEL); expect(TRAVELER_COUNT_WHEEL).toBe(REAPER_COUNT_WHEEL);
    expect(TRAVELER_COUNT_WHEEL.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) expect(travelerActionCount(roll!)).toBe(count);
    const wheel = playerAbilityWheel(s, null); wheel[0]!.weight = 0; expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      travelerAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(weights[i]! / total * 100, 12);
        const first = boundary + 1; boundary += weights[i]!; const random = fixedRolls(first, boundary);
        expect(drawTravelerAbility(random, s, stance)).toBe(entry.id); expect(drawTravelerAbility(random, s, stance)).toBe(entry.id);
        expect(random.cursor).toBe(2);
      });
    }
  });

  it('K pays2+2 once for a will14 check and both real body/equipment movements', () => {
    for (const [learned, expected] of [[0, 10.4], [250, 13.2], [500, 16]]) {
      const s = fixture(); s.town.clubLocation = 'HAND'; s.progression.mastery[K] = learned!;
      s.progression.mastery['door.s5.invisible-hand'] = 500; s.progression.mastery[R] = 500;
      const before = structuredClone(s), random = fixedRolls(52, 53);
      const success = effect(s, K, 1, currentTravelerCombatSource(s), random);
      expect(success.enemyReduction).toBeCloseTo(expected!); expect(success.threatens).toBe(true);
      expect(success.label).toContain('意志难度14检定52%'); expect(success.label).toContain('已付去程2灵性与返程2灵性');
      expect(success.label).toContain('抵达已核实的侧面2米净空落点'); expect(success.label).toContain('同一原装备经灵界实际返回原交手点');
      expect(effect(s, K, 1, currentTravelerCombatSource(s), random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s.spirituality).toBe(92); expect(random.cursor).toBe(2);
      expect({ ...s, spirituality: before.spirituality }).toEqual(before);
    }
  });

  it('FIRST_CASE has no fabricated landing, distance or paid K and retains the carrier', () => {
    const s = fixture(true), before = structuredClone(s), random = fixedRolls();
    expect(currentTravelerCombatSource(s)).toMatchObject({ target: 'ORIGINAL_LIVING_CARRIER', landing: 'NONE_VERIFIED', distanceMetres: null, bystanders: 'UNSPECIFIED' });
    const result = effect(s, K, 1, currentTravelerCombatSource(s), random);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.label).toContain('首案没有新增核实'); expect(s).toEqual(before); expect(random.cursor).toBe(0);
    const round = recordedRound(s, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 70);
    expect(round.round.consequence).toContain('携铃者'); expect(round.round.consequence).not.toMatch(/贝兰|私人厅/);
  });

  it('rejects nonfinite or insufficient K budget without partial travel or random draw', () => {
    for (const sp of [0, 2, 3, Number.NaN]) {
      const s = fixture(); s.spirituality = sp; const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, K, 1, currentTravelerCombatSource(s), random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('R consumes only the first real inherited sample once, preserving identity and demonstrations', () => {
    for (const sample of ['FLASH', 'COURAGE'] as const) {
      const s = fixture(); addRecord(s, sample); addRecord(s, sample);
      const before = structuredClone(s.recorder), round = createTravelerRecorderRound(s), random = fixedRolls();
      expect(round.recordingId).toBe('recorder-record-1');
      const first = effect(s, R, 1, currentTravelerCombatSource(s), random, round);
      expect(first.threatens).toBe(false); expect(first.enemyReduction).toBeCloseTo(sample === 'FLASH' ? 7.8 : 0);
      expect(first.selfGain).toBeCloseTo(sample === 'COURAGE' ? 7.8 : 0);
      expect(first.label).toContain('recorder-record-1'); if (sample === 'FLASH') expect(first.label).toContain('贝兰');
      expect(effect(s, R, 1, currentTravelerCombatSource(s), random, round)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s.spirituality).toBe(98); expect(random.cursor).toBe(0); expect(round.released).toBe(true);
      expect(s.recorder.records[0]).toEqual({ ...before.records[0], status: 'RELEASED', releasedWeek: 24 });
      expect(s.recorder.records[1]).toEqual(before.records[1]);
      expect({ ...s.recorder, records: before.records }).toEqual(before);
      expect(storedRecorderCombatRecord(s, 'recorder-record-1')).toBeNull();
    }
  });

  it('invalid or absent original records and insufficient R resources grant0 and cost0', () => {
    for (const mutate of [
      (s: SliceState) => { s.recorder.demonstrations[0]!.success = false; },
      (s: SliceState) => { s.recorder.demonstrations[0]!.actor = 'SAFF'; },
      (s: SliceState) => { s.recorder.demonstrations[0]!.revision = s.revision + 1; },
      (s: SliceState) => { s.recorder.records[0]!.releasedWeek = 22; },
      (s: SliceState) => { s.recorder.records[0]!.status = 'RELEASED'; },
      (s: SliceState) => { s.recorder.records.push(structuredClone(s.recorder.records[0]!)); },
      (s: SliceState) => { s.recorder.demonstrations = []; },
      (s: SliceState) => { s.spirituality = 1; },
      (s: SliceState) => { s.spirituality = Number.NaN; },
    ]) {
      const s = fixture(); addRecord(s); mutate(s); const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, R, 1, currentTravelerCombatSource(s), random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
    const empty = fixture(), before = structuredClone(empty); expect(effect(empty, R).enemyReduction).toBe(0); expect(empty).toEqual(before);
  });

  it('keeps old S6 explicit release semantics, sources and S7 wheels intact', () => {
    const s = fixture(); addRecord(s); s.progression.sequence = 6;
    s.combat!.encounterId = 'RECORDER_DISPUTE';
    s.recorder.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 };
    s.recorder.cases['flash-screen']!.status = 'RESOLVED';
    const round = { recordingId: 'recorder-record-1', released: false };
    expect(currentRecorderCombatSource(s)).not.toBeNull();
    expect(resolveAstrologerCombatAbility(s, R, 1, fixedRolls(), currentRecorderCombatSource(s), round).enemyReduction).toBeCloseTo(7.8);
    expect(resolveAstrologerCombatAbility(s, R, 1, fixedRolls(), currentRecorderCombatSource(s), round).enemyReduction).toBe(10);
    expect(s.spirituality).toBe(98);
    for (const sequence of [6, 7]) {
      s.progression.sequence = sequence; expect(isTraveler(s)).toBe(false); expect(currentTravelerCombatSource(s)).toBeNull();
      expect(playerAbilityWheel(s, null)).toEqual(astrologerAbilityWheel(null, sequence)); expect(playerCountWheel(s)).toEqual(ASTROLOGER_COUNT_WHEEL);
    }
  });

  it('rejects stale or forged scene, body, equipment and round provenance before any payment', () => {
    for (const mutate of [
      (s: SliceState) => { s.revision += 1; }, (s: SliceState) => { s.week += 1; },
      (s: SliceState) => { s.town.clubLocation = 'HAND'; }, (s: SliceState) => { s.combat!.round += 1; },
      (s: SliceState) => { s.traveler.encounter.attemptWeek = 23; },
      (s: SliceState) => { s.traveler.practice.position = 'LANDING'; },
      (s: SliceState) => { s.traveler.practice.card = 'PLAYER'; },
      (s: SliceState) => { s.traveler.practice.consent = true; },
      (s: SliceState) => { s.traveler.practice.companionPosition = 'LANDING'; },
      (s: SliceState) => { s.traveler.ritual.at = 'BRONZE_STEPS'; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.world.city = 'TINGEN'; },
    ]) {
      const s = fixture(); addRecord(s); const source = currentTravelerCombatSource(s); mutate(s);
      const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, K, 1, source, random).enemyReduction).toBe(0); expect(effect(s, R, 1, source, random).enemyReduction).toBe(0);
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
    const s = fixture(), source = currentTravelerCombatSource(s)!;
    expect(effect(s, K, 1, { ...source, landing: 'NONE_VERIFIED' }).enemyReduction).toBe(0);
  });

  it('H/J use the same owned body/tool, B stays ordinary and A makes no extra draw', () => {
    const s = fixture();
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      s.town.clubLocation = location; const before = structuredClone(s);
      for (const id of ['STRIKE', 'SECONDARY_STRIKE'] as const) expect(effect(s, id, 0.5).selfGain).toBe(location === 'HAND' ? 8 : 6);
      expect(effect(s, 'EVADE').enemyReduction).toBe(10); expect(effect(s, 'ACCIDENT').selfGain).toBe(-22.5);
      for (const id of ['door.s5.invisible-hand', 'door.s4.secret-space', 'door.s4.banishment']) expect(effect(s, id as TravelerMoveId)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before);
    }
  });

  it('uses900/core35-25-25-15/floor90, S100 and continuing-only regeneration10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(922 * 0.8); expect(s.spirituality).toBe(10);
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1); expect(ceiling.spirituality).toBe(100);
    vi.spyOn(travelerCombat, 'resolveTravelerCombatAbility').mockReturnValue({ label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1).round.playerAdvantage).toBe(90);
  });

  it('multiple R draws consume one original per round and preserve all ordinary enemy actions', () => {
    const s = fixture(); addRecord(s); addRecord(s); s.spirituality = 20;
    const r = ticket(R, 'PREPARE');
    const result = recordedRound(s, 'PREPARE', 91, 1, r, 1, r, r, r, r, r, 1);
    expect(result.round.moves.filter(m => m.actor === 'PLAYER')).toHaveLength(6);
    expect(result.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(1);
    expect(result.round.moves.find(m => m.actor === 'ENEMY')).toMatchObject({ selfGain: 16, label: '短棍打击' });
    expect(s.recorder.records.map(x => x.status)).toEqual(['RELEASED', 'STORED']); expect(s.spirituality).toBe(28);
    expect(result.outcome).toBe('CONTINUE'); expect(hasTravelerDisputeOpponent(s)).toBe(true);
  });

  it('requires an actual closed report and real cleanup before paid arrival', () => {
    for (const mutate of [
      (s: SliceState) => { s.traveler.cases['known-landing']!.status = 'EXAMINED'; },
      (s: SliceState) => { s.traveler.cases['known-landing']!.closes = 0; },
      (s: SliceState) => { s.traveler.cases['offered-card']!.status = 'PREPARED'; },
      (s: SliceState) => { s.recorder.cases['flash-screen']!.contactOpen = true; },
      (s: SliceState) => { s.traveler.practice.card = 'PLAYER'; },
      (s: SliceState) => { s.traveler.practice.consent = true; },
      (s: SliceState) => { s.traveler.practice.companionPosition = 'LANDING'; },
    ]) {
      const s = available(); mutate(s); const before = structuredClone(s);
      expect(() => applyTravelerEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s).toEqual(before);
    }
    const s = available(), before = structuredClone(s); expect(hasTravelerOpenPractice(s)).toBe(false);
    applyTravelerEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(3); expect(hasTravelerDisputeOpponent(s)).toBe(true);
    expect(s.world).toEqual(before.world); expect(s.town).toEqual(before.town); expect(s.recorder).toEqual(before.recorder);
    expect(s.traveler.practice).toEqual(before.traveler.practice); expect(s.traveler.ritual).toEqual(before.traveler.ritual);
  });

  it('ordinary refusal is retained and peaceful success grants no reward', () => {
    const refused = available(); applyTravelerEncounter(refused, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(refused.actionsRemaining).toBe(3); expect(refused.traveler.encounter.status).toBe('AVAILABLE');
    expect(blockTravelerEncounter(refused, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉'); expect(validateTravelerEncounter(refused)).toBe(true);
    applyTravelerEncounter(refused, { type: 'ENCOUNTER_FIGHT' }, context()); expect(refused.actionsRemaining).toBe(2);
    const talk = available(), progression = structuredClone(talk.progression);
    applyTravelerEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.traveler.encounter.status).toBe('RESOLVED'); expect(talk.progression).toEqual(progression);
    expect(talk.combat).toBeNull(); expect(validateTravelerEncounter(talk)).toBe(true);
  });

  it('real surrender and enemy death award one25 with exact Belan outcomes and no world replacement', () => {
    for (const terminal of [70, 100]) {
      const s = fixture(), ctx = context(), world = structuredClone(s.world), practice = structuredClone(s.traveler.practice);
      const award = vi.fn((source: string, amount: 5 | 8 | 25) => awardSeerMastery(s, source, amount, ctx)); s.spirituality = 30;
      const result = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 400, 1, terminal);
      expect(result.outcome).toBe(terminal === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('贝兰'); expect(result.round.consequence).not.toMatch(/携铃者|弥尔|洛克|箱子/);
      expect(s.combat!.enemyHealth).toBe(terminal === 70 ? 70 : 0); expect(s.spirituality).toBe(26);
      settleTravelerEncounter(s, result.outcome, ctx, award);
      expect(award).toHaveBeenCalledExactlyOnceWith('traveler-dispute', 25); expect(validateTravelerEncounter(s)).toBe(true);
      expect(s.traveler.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull(); expect(s.progression.acting).toBe(25);
      expect(s.world).toEqual(world); expect(s.traveler.practice).toEqual(practice);
      expect(() => settleTravelerEncounter(s, result.outcome, ctx, award)).toThrow(); expect(award).toHaveBeenCalledTimes(1);
    }
  });

  it('first-slot retreat grants0, preserves records and physically leaves by the original exit', () => {
    const s = fixture(); addRecord(s); const reward = vi.fn(), before = structuredClone(s); s.spirituality = 98;
    const result = recordedRound(s, 'RETREAT', 1, 1, 1);
    expect(result.round.moves).toHaveLength(0); expect(result.round.consequence).toContain('实际普通出口'); expect(result.round.consequence).toContain('贝兰');
    expect(s.spirituality).toBe(98); settleTravelerEncounter(s, result.outcome, context(), reward);
    expect(reward).not.toHaveBeenCalled(); expect(validateTravelerEncounter(s)).toBe(true); expect(s.recorder).toEqual(before.recorder);
  });

  it('actual player death and health-zero branches have no forced win, free transport or record refund', () => {
    const s = fixture(); addRecord(s); s.spirituality = 20; const reward = vi.fn(), world = structuredClone(s.world);
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 1, 1_000_000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(result.round.consequence).toContain('贝兰'); expect(s.spirituality).toBe(18);
    expect(s.recorder.records[0]!.status).toBe('RELEASED'); expect(s.world).toEqual(world);
    settleTravelerEncounter(s, result.outcome, context(), reward); s.status = 'DEAD';
    expect(reward).not.toHaveBeenCalled(); expect(s.health).toBe(0); expect(validateTravelerEncounter(s)).toBe(true);
    const enemy = fixture(); enemy.combat!.enemyHealth = 10;
    const e = recordedRound(enemy, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 1);
    expect(e.outcome).toBe('ENEMY_DEAD'); expect(e.round.consequence).toContain('贝兰'); expect(e.round.consequence).toContain('健康降至0');
  });

  it('rejects forged terminal outcomes, stale histories and duplicate or unearned awards', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settleTravelerEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(() => settleTravelerEncounter(s, 'INVENTED', context(), award)).toThrow(); expect(s).toEqual(before); expect(award).not.toHaveBeenCalled();
    for (const mutate of [
      (s: SliceState) => { s.progression.sequence = 6; },
      (s: SliceState) => { s.traveler.encounter.attemptWeek = 21; },
      (s: SliceState) => { s.traveler.cases['known-landing']!.status = 'AVAILABLE'; },
      (s: SliceState) => { s.traveler.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.seer.completedSources.push('traveler-dispute'); },
      (s: SliceState) => { s.seer.completedSources.push('traveler-dispute', 'traveler-dispute'); },
    ]) { const invalid = fixture(); mutate(invalid); expect(validateTravelerEncounter(invalid)).toBe(false); }
    expect(validateTravelerEncounter(createSliceRun('traveler-unpromoted', sliceDefaultCreationSelection, 'initial'))).toBe(true);
  });
});
