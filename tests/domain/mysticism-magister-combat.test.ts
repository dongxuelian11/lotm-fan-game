import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createMysticismMagisterState } from '../../src/domain/mysticism-magister/index.js';
import { MYSTICISM_MAGISTER_ABILITY_IDS } from '../../src/domain/mysticism-magister/types.js';
import { MYSTICISM_MAGISTER_COUNT_WHEEL, currentMysticismMagisterCombatSource, drawMysticismMagisterAbility,
  isMysticismMagister, mysticismMagisterAbilityWheel, mysticismMagisterActionCount, resolveMysticismMagisterCombatAbility,
  type MysticismMagisterCombatSource, type MysticismMagisterMoveId } from '../../src/domain/mysticism-magister/combat.js';
import * as magisterCombat from '../../src/domain/mysticism-magister/combat.js';
import { applyMysticismMagisterEncounter, blockMysticismMagisterEncounter, hasMysticismMagisterDisputeOpponent,
  settleMysticismMagisterEncounter, validateMysticismMagisterEncounter } from '../../src/domain/mysticism-magister/encounter.js';
import { DETECTIVE_COUNT_WHEEL, detectiveAbilityWheel, resolveDetectiveCombatAbility } from '../../src/domain/detective/combat.js';
import { REAPER_COUNT_WHEEL } from '../../src/domain/reaper/combat.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const K = 'reader.s6.limited-imitation', R = 'reader.s5.material-imitation';
/** Bounded engine fixtures, not evidence of a natural promotion or item manufacture. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('mysticism-magister-combat-test', sliceDefaultCreationSelection, 'mysticism-magister-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'white-tower', sequence: 5,
    mastery: { [K]: 0, 'reader.s5.secret-ritual': 0, [R]: 0 }, acting: 25, promotionWeek: 22 };
  s.mysticismMagister = createMysticismMagisterState(); s.mysticismMagister.promotionWeek = 22;
  Object.assign(s.mysticismMagister.cases['careful-teaching']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'LESSON_CHECKED' });
  s.polymath.samples.FLASH = { observedWeek: 15, understoodWeek: 16, learnedWeek: 17, analysisAttemptWeek: 16 };
  s.mysticismMagister.encounter = { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'MYSTICISM_MAGISTER_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
function craft(s: SliceState, n = 1, power = 0.65, createdWeek = 23): void {
  // Bounded optional-stock fixture; the life suite covers the actual trial-item producer/test/report.
  Object.assign(s.mysticismMagister.cases['modest-craft']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'CRAFT_TESTED' });
  s.mysticismMagister.practice.kitsUsed = Math.max(n, s.mysticismMagister.practice.kitsUsed);
  s.mysticismMagister.crafts.push({ id: `MM5-FLASH-${n}`, sourceKitId: `MM5-KIT-${n}`,
    createdWeek, usedWeek: null, status: 'PLAYER', power });
}
const profile: readonly [MysticismMagisterMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['SECONDARY_STRIKE', 15, 'ATTACK'], ['EVADE', 20, 'DEFEND'],
  [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: MysticismMagisterMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-mysticism-magister', get cursor() { return cursor; }, nextInt(min, max) {
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
function effect(s: SliceState, id: MysticismMagisterMoveId, factor = 1,
  source: MysticismMagisterCombatSource | null = currentMysticismMagisterCombatSource(s), random = fixedRolls()) {
  return resolveMysticismMagisterCombatAbility(s, id, factor, random, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(): SliceState {
  const s = fixture(); s.combat = null; s.mysticismMagister.encounter = createMysticismMagisterState().encounter;
  s.actionsRemaining = 4; return s;
}
afterEach(() => vi.restoreAllMocks());

describe('Mysticism Magister S5 finite original combat', () => {
  it('selects H30/J15/B20/K20/R10/A5 and the ordinary 1–6 count distribution', () => {
    const s = fixture(); expect(isMysticismMagister(s)).toBe(true);
    expect(MYSTICISM_MAGISTER_ABILITY_IDS).toEqual(['reader.s5.secret-ritual', R]);
    expect(playerAbilityWheel(s, null)).toEqual(mysticismMagisterAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => [e.id, e.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(playerCountWheel(s)).toEqual(MYSTICISM_MAGISTER_COUNT_WHEEL);
    expect(MYSTICISM_MAGISTER_COUNT_WHEEL).toBe(REAPER_COUNT_WHEEL);
    expect(MYSTICISM_MAGISTER_COUNT_WHEEL.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(mysticismMagisterActionCount(roll!)).toBe(count);
    }
    const wheel = playerAbilityWheel(s, null); wheel[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30);
  });

  it('draws one integer ticket with exact stance weighting and fixed A−22.5 without a second draw', () => {
    const s = fixture();
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      mysticismMagisterAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(weights[i]! / total * 100, 12);
        const first = boundary + 1; boundary += weights[i]!;
        const random = fixedRolls(first, boundary);
        expect(drawMysticismMagisterAbility(random, s, stance)).toBe(entry.id);
        expect(drawMysticismMagisterAbility(random, s, stance)).toBe(entry.id); expect(random.cursor).toBe(2);
      });
    }
    const before = structuredClone(s), random = fixedRolls();
    expect(effect(s, 'ACCIDENT', 1, currentMysticismMagisterCombatSource(s), random))
      .toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('retains the original S6 wheel, difficulty18, factor8–16 and resource cost', () => {
    const s = fixture(); s.progression.sequence = 6; s.spirituality = 80;
    s.mysticismMagister.encounter = createMysticismMagisterState().encounter;
    s.combat!.encounterId = 'POLYMATH_DISPUTE';
    s.polymath.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 };
    expect(isMysticismMagister(s)).toBe(false); expect(currentMysticismMagisterCombatSource(s)).toBeNull();
    expect(playerAbilityWheel(s, null)).toEqual(detectiveAbilityWheel(null, 6));
    expect(playerCountWheel(s)).toEqual(DETECTIVE_COUNT_WHEEL);
    const random = fixedRolls(44, 45);
    expect(resolveDetectiveCombatAbility(s, K, 1, random)).toMatchObject({ enemyReduction: 8, threatens: false });
    expect(resolveDetectiveCombatAbility(s, K, 1, random).enemyReduction).toBe(0);
    expect(s.spirituality).toBe(76); expect(random.cursor).toBe(2);
  });

  it('K pays2 on success or failure and uses only old imitation mastery with knowledge14', () => {
    for (const [mastery, reduction] of [[0, 7.8], [250, 9.9], [500, 12], [900, 12], [-10, 7.8]]) {
      const s = fixture(); s.progression.mastery[K] = mastery!;
      s.progression.mastery[R] = 500; s.progression.mastery['reader.s5.secret-ritual'] = 500;
      const samples = structuredClone(s.polymath.samples), crafts = structuredClone(s.mysticismMagister.crafts);
      const random = fixedRolls(52, 53);
      const success = effect(s, K, 1, currentMysticismMagisterCombatSource(s), random);
      expect(success.enemyReduction).toBeCloseTo(reduction!); expect(success.threatens).toBe(false);
      expect(success.label).toContain('知识难度14检定52%，成功'); expect(s.spirituality).toBe(98);
      expect(effect(s, K, 1, currentMysticismMagisterCombatSource(s), random).enemyReduction).toBe(0);
      expect(s.spirituality).toBe(96); expect(random.cursor).toBe(2);
      expect(s.polymath.samples).toEqual(samples); expect(s.mysticismMagister.crafts).toEqual(crafts);
      expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    }
  });

  it('K has zero cost/effect for an unlearned, future or invalid original FLASH sample or insufficient SP', () => {
    for (const mutate of [
      (s: SliceState) => { s.polymath.samples.FLASH.learnedWeek = null; },
      (s: SliceState) => { s.polymath.samples.FLASH.learnedWeek = s.week + 1; },
      (s: SliceState) => { s.polymath.samples.FLASH.analysisAttemptWeek = null; },
      (s: SliceState) => { s.polymath.samples.FLASH.observedWeek = 20; },
      (s: SliceState) => { s.spirituality = 1; },
      (s: SliceState) => { s.spirituality = Number.NaN; },
    ]) {
      const s = fixture(); mutate(s); const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, K, 1, currentMysticismMagisterCombatSource(s), random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('R consumes the oldest actual PLAYER original once, uses stored power and no additional SP or draw', () => {
    const s = fixture(); craft(s, 3, 0.9, 24); craft(s, 1, 0.65, 22); craft(s, 2, 0.8, 23);
    s.spirituality = 0; s.progression.mastery[R] = 500; const samples = structuredClone(s.polymath.samples);
    const random = fixedRolls(), source = currentMysticismMagisterCombatSource(s);
    for (const [n, power, remaining] of [[1, 0.65, 2], [2, 0.8, 1], [3, 0.9, 0]]) {
      const result = effect(s, R, 1, source, random);
      expect(result.enemyReduction).toBeCloseTo(18 * power!); expect(result.threatens).toBe(false);
      expect(result.label).toContain(`MM5-FLASH-${n}`); expect(result.label).toContain(`尚持有${remaining}件`);
      expect(s.mysticismMagister.crafts.find(c => c.id === `MM5-FLASH-${n}`))
        .toMatchObject({ status: 'CONSUMED', usedWeek: s.week, power });
    }
    const before = structuredClone(s); expect(effect(s, R).enemyReduction).toBe(0);
    expect(s).toEqual(before); expect(s.spirituality).toBe(0); expect(random.cursor).toBe(0);
    expect(s.polymath.samples).toEqual(samples); expect(s.mysticismMagister.practice.kitsUsed).toBe(3);
  });

  it('R preserves the mandatory pre-report prototype for its actual safety test after another report unlocks combat', () => {
    const s = fixture(); craft(s);
    Object.assign(s.mysticismMagister.cases['modest-craft']!, { status: 'EXAMINED', method: 'ABILITY', outcome: 'NONE' });
    expect(s.mysticismMagister.cases['careful-teaching']!.status).toBe('RESOLVED');
    expect(hasMysticismMagisterDisputeOpponent(s)).toBe(true);
    const before = structuredClone(s), random = fixedRolls();
    const result = effect(s, R, 1, currentMysticismMagisterCombatSource(s), random);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.label).toContain('原试作品须保留');
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
    expect(s.mysticismMagister.crafts[0]).toMatchObject({ status: 'PLAYER', usedWeek: null });
  });

  it('R cannot consume invented, mismatched, duplicate, future, non-owned or already-consumed originals', () => {
    for (const mutate of [
      (s: SliceState) => { s.mysticismMagister.crafts[0]!.id = 'INVENTED'; },
      (s: SliceState) => { s.mysticismMagister.crafts[0]!.sourceKitId = 'MM5-KIT-2'; },
      (s: SliceState) => { s.mysticismMagister.practice.kitsUsed = 0; },
      (s: SliceState) => { s.mysticismMagister.crafts[0]!.createdWeek = s.week + 1; },
      (s: SliceState) => { s.mysticismMagister.crafts[0]!.power = 2; },
      (s: SliceState) => { s.mysticismMagister.crafts[0]!.status = 'CONSUMED'; s.mysticismMagister.crafts[0]!.usedWeek = 23; },
      (s: SliceState) => { s.mysticismMagister.crafts.push({ ...s.mysticismMagister.crafts[0]! }); },
    ]) {
      const s = fixture(); craft(s); mutate(s); const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, R, 1, currentMysticismMagisterCombatSource(s), random).enemyReduction).toBe(0);
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('binds all effects and item consumption to the original target,2m,body,encounter,week and contiguous round', () => {
    const s = fixture(); craft(s); const source = currentMysticismMagisterCombatSource(s)!;
    expect(source).toMatchObject({ target: 'ROWAN_SINGLE_ADULT', distanceMetres: 2,
      weapon: 'ROWAN_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_WORKYARD', attemptWeek: 24,
      startHistoryIndex: 0, playerBody: 'ORIGINAL_PLAYER_BODY', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    for (const bad of [null, { ...source, round: 2 }, { ...source, revision: 99 }, { ...source, week: 23 },
      { ...source, target: 'COPY' }, { ...source, distanceMetres: 40 }, { ...source, visible: false },
      { ...source, enemyHealth: 90 }, { ...source, playerMind: 70 }, { ...source, pursuit: true }]) {
      const before = structuredClone(s), random = fixedRolls();
      for (const id of [K, R, 'STRIKE'] as const) expect(effect(s, id, 1, bad as MysticismMagisterCombatSource | null, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const mutate of [
      (x: SliceState) => { x.mysticismMagister.encounter.attemptWeek = x.week - 1; },
      (x: SliceState) => { x.mysticismMagister.encounter.startHistoryIndex = 1; },
      (x: SliceState) => { x.mysticismMagister.encounter.status = 'AVAILABLE'; },
      (x: SliceState) => { x.combat!.round = 2; },
      (x: SliceState) => { x.combat!.enemyStatus = 'SURRENDERED'; },
      (x: SliceState) => { x.combat!.enemyMind = 0; },
      (x: SliceState) => { x.mysticismMagister.practice.dreamOpen = true; },
      (x: SliceState) => { x.mysticismMagister.cases['linked-dream']!.contactOpen = true; },
      (x: SliceState) => { x.polymath.cases['flash-study']!.contactOpen = true; },
    ]) {
      const invalid = fixture(); craft(invalid); mutate(invalid); const before = structuredClone(invalid);
      expect(currentMysticismMagisterCombatSource(invalid)).toBeNull();
      expect(() => resolveSliceCombatRound(invalid, 'PREPARE')).toThrow(); expect(invalid).toEqual(before);
    }
  });

  it('preserves FIRST_CASE original carrier identity and never supplies Rowan or revives a dead target', () => {
    const s = fixture(true); craft(s); const world = structuredClone(s.world);
    expect(currentMysticismMagisterCombatSource(s)).toMatchObject({ target: 'ORIGINAL_LIVING_CARRIER',
      space: 'ORIGINAL_FIRST_CASE', weapon: 'ORIGINAL_CARRIER_CLUB', distanceMetres: 2,
      attemptWeek: null, startHistoryIndex: null });
    const result = effect(s, R); expect(result.label).toContain('原携铃者'); expect(result.label).not.toContain('罗文');
    expect(s.world).toEqual(world); craft(s, 2); s.world.carrierAlive = false;
    const before = structuredClone(s); expect(effect(s, R).enemyReduction).toBe(0); expect(s).toEqual(before);
    const separate = fixture(); expect(separate.world.carrierAlive).toBe(false);
    expect(currentMysticismMagisterCombatSource(separate)?.target).toBe('ROWAN_SINGLE_ADULT');
  });

  it('uses real own body/tool for H/J, ordinaryB and rejects instant dream, unlearned spells and S4 powers', () => {
    const s = fixture();
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      s.town.clubLocation = location; const before = structuredClone(s);
      for (const id of ['STRIKE', 'SECONDARY_STRIKE'] as const) {
        expect(effect(s, id, 0.5)).toMatchObject({ selfGain: location === 'HAND' ? 8 : 6, threatens: true });
        expect(effect(s, id, 0)).toMatchObject({ selfGain: 0, threatens: false });
      }
      expect(effect(s, 'EVADE').enemyReduction).toBe(10); expect(s).toEqual(before);
    }
    craft(s); const before = structuredClone(s);
    for (const id of ['reader.s5.secret-ritual', 'reader.s5.holy-light', 'reader.s5.instant-dream',
      'reader.s4.prophecy', 'reader.s6.analysis', 'FROST', 'COURAGE', 'MM5-CLOTH-1']) {
      expect(effect(s, id as MysticismMagisterMoveId)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(s).toEqual(before);
  });

  it('uses base900/core35-25-25-15/floor90/S100, and only continuing rounds recover10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(922 * 0.8); expect(s.spirituality).toBe(10);
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1); expect(ceiling.spirituality).toBe(100);
    vi.spyOn(magisterCombat, 'resolveMysticismMagisterCombatAbility').mockReturnValue({
      label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false,
    });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1).round.playerAdvantage).toBe(90);
  });

  it('logs actualK/R resource effects without deleting enemy actions or granting damage or forced surrender', () => {
    const s = fixture(); s.spirituality = 20;
    const first = recordedRound(s, 'CONTROL', 1, 86, ticket(K, 'CONTROL'), 1, 1, 1, 1, 1);
    expect(first.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(3);
    expect(first.round.moves[0]!.enemyReduction).toBeCloseTo(7.8); expect(s.spirituality).toBe(28);
    expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(first.outcome).toBe('CONTINUE'); expect(hasMysticismMagisterDisputeOpponent(s)).toBe(true);
    const prepared = fixture(); craft(prepared); prepared.spirituality = 0;
    const used = recordedRound(prepared, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1);
    expect(used.round.moves[0]!.label).toContain('MM5-FLASH-1'); expect(used.round.moves[0]!.enemyReduction).toBeCloseTo(11.7);
    expect(prepared.spirituality).toBe(10); expect(prepared.mysticismMagister.crafts[0]!.status).toBe('CONSUMED');
    expect(prepared.combat!.enemyHealth).toBe(100); expect(prepared.combat!.enemyMind).toBe(100);
  });

  it('requires one real report and active-contact closure, charges1arrival, and keeps prepared plans and cloth originals', () => {
    for (const mutate of [
      (s: SliceState) => { s.mysticismMagister.cases['careful-teaching']!.status = 'EXAMINED'; },
      (s: SliceState) => { s.mysticismMagister.cases['careful-teaching']!.closes = 0; },
      (s: SliceState) => { s.mysticismMagister.cases['linked-dream']!.contactOpen = true; },
      (s: SliceState) => { s.mysticismMagister.practice.dreamOpen = true; },
    ]) {
      const s = available(); mutate(s); const before = structuredClone(s);
      expect(() => applyMysticismMagisterEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s).toEqual(before);
    }
    const s = available(); s.mysticismMagister.cases['linked-dream']!.status = 'PREPARED';
    s.mysticismMagister.practice.token = 'PLAYER'; craft(s); const inventory = structuredClone(s.mysticismMagister.crafts);
    const practice = structuredClone(s.mysticismMagister.practice), world = structuredClone(s.world);
    applyMysticismMagisterEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(3); expect(hasMysticismMagisterDisputeOpponent(s)).toBe(true);
    expect(Object.keys(s.mysticismMagister.encounter).sort()).toEqual(['attemptWeek', 'startHistoryIndex', 'status']);
    expect(s.world).toEqual(world); expect(s.mysticismMagister.crafts).toEqual(inventory); expect(s.mysticismMagister.practice).toEqual(practice);
  });

  it('preserves ordinary refusal and peaceful success without rewards, and allows subsequent practice', () => {
    const refused = available(); applyMysticismMagisterEncounter(refused, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(refused.actionsRemaining).toBe(3); expect(refused.mysticismMagister.encounter.status).toBe('AVAILABLE');
    expect(blockMysticismMagisterEncounter(refused, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    expect(validateMysticismMagisterEncounter(refused)).toBe(true);
    applyMysticismMagisterEncounter(refused, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(refused.actionsRemaining).toBe(2); expect(hasMysticismMagisterDisputeOpponent(refused)).toBe(true);
    const talk = available(), progression = structuredClone(talk.progression);
    applyMysticismMagisterEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.mysticismMagister.encounter.status).toBe('RESOLVED'); expect(talk.progression).toEqual(progression);
    expect(talk.combat).toBeNull(); expect(validateMysticismMagisterEncounter(talk)).toBe(true);
    talk.mysticismMagister.cases['linked-dream']!.contactOpen = true;
    expect(validateMysticismMagisterEncounter(talk)).toBe(true);
  });

  it('settles real surrender/death once25; first-action exit and actual player death award0 without item refill', () => {
    for (const terminal of [70, 100]) {
      const s = fixture(), ctx = context(); craft(s); effect(s, R);
      const inventory = structuredClone(s.mysticismMagister.crafts), world = structuredClone(s.world);
      const award = vi.fn((source: string, amount: 5 | 8 | 25) => awardSeerMastery(s, source, amount, ctx));
      s.spirituality = 30;
      const result = recordedRound(s, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, terminal);
      expect(result.outcome).toBe(terminal === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('罗文'); expect(result.round.consequence).not.toMatch(/携铃者|箱子|伊恩/);
      if (terminal === 70) expect(result.round.consequence).toBe('持自己原普通短棍的罗文受到重伤，健康减少30。罗文仍然活着，自行停止抵抗并放下自己的原普通短棍投降；原棍归属不变，有限闪光没有强迫他的意愿。');
      expect(s.combat!.enemyHealth).toBe(terminal === 70 ? 70 : 0); expect(s.spirituality).toBe(30);
      settleMysticismMagisterEncounter(s, result.outcome, ctx, award);
      expect(award).toHaveBeenCalledExactlyOnceWith('mysticism-magister-dispute', 25);
      expect(s.mysticismMagister.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
      expect(s.progression.acting).toBe(25); expect(validateMysticismMagisterEncounter(s)).toBe(true);
      expect(s.world).toEqual(world); expect(s.mysticismMagister.crafts).toEqual(inventory);
      expect(() => settleMysticismMagisterEncounter(s, result.outcome, ctx, award)).toThrow(); expect(award).toHaveBeenCalledTimes(1);
    }
    const retreat = fixture(), reward = vi.fn(); craft(retreat); retreat.spirituality = 98;
    const original = structuredClone(retreat.mysticismMagister.crafts), r = recordedRound(retreat, 'RETREAT', 1, 1, 1);
    expect(r.round.moves).toHaveLength(0); expect(r.round.consequence).toContain('实际原出口');
    expect(r.round.consequence).toContain('没有瞬移、追逐'); expect(retreat.spirituality).toBe(98);
    settleMysticismMagisterEncounter(retreat, r.outcome, context(), reward);
    expect(reward).not.toHaveBeenCalled(); expect(validateMysticismMagisterEncounter(retreat)).toBe(true);
    expect(retreat.mysticismMagister.crafts).toEqual(original);
    const dead = fixture(); craft(dead); const items = structuredClone(dead.mysticismMagister.crafts);
    const d = recordedRound(dead, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 100);
    expect(d.outcome).toBe('PLAYER_DEAD'); settleMysticismMagisterEncounter(dead, d.outcome, context(), reward); dead.status = 'DEAD';
    expect(reward).not.toHaveBeenCalled(); expect(dead.health).toBe(0); expect(dead.mysticismMagister.crafts).toEqual(items);
    expect(validateMysticismMagisterEncounter(dead)).toBe(true);
  });

  it('rejects forged terminal outcomes, stale histories and duplicate/unearned rewards', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settleMysticismMagisterEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(() => settleMysticismMagisterEncounter(s, 'INVENTED', context(), award)).toThrow();
    expect(s).toEqual(before); expect(award).not.toHaveBeenCalled();
    for (const mutate of [
      (x: SliceState) => { x.progression.sequence = 6; },
      (x: SliceState) => { x.mysticismMagister.encounter.attemptWeek = 21; },
      (x: SliceState) => { x.mysticismMagister.cases['careful-teaching']!.status = 'AVAILABLE'; },
      (x: SliceState) => { x.mysticismMagister.encounter.startHistoryIndex = -1; },
      (x: SliceState) => { x.seer.completedSources.push('mysticism-magister-dispute'); },
      (x: SliceState) => { x.seer.completedSources.push('mysticism-magister-dispute', 'mysticism-magister-dispute'); },
    ]) { const invalid = fixture(); mutate(invalid); expect(validateMysticismMagisterEncounter(invalid)).toBe(false); }
    expect(validateMysticismMagisterEncounter(createSliceRun('magister-unpromoted', sliceDefaultCreationSelection, 'initial'))).toBe(true);
  });
});
