import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  DRUID_COUNT_WHEEL, druidAbilityWheel, druidActionCount, currentDruidCombatSource,
  drawDruidAbility, isDruid, resolveDruidCombatAbility, type DruidCombatSource, type DruidMoveId,
} from '../../src/domain/druid/combat.js';
import * as druidCombat from '../../src/domain/druid/combat.js';
import { createDruidState } from '../../src/domain/druid/index.js';
import {
  applyDruidEncounter, blockDruidEncounter, hasDruidOpenPractice, settleDruidEncounter, validateDruidEncounter,
} from '../../src/domain/druid/encounter.js';
import { CULTIVATOR_COUNT_WHEEL, cultivatorAbilityWheel, currentCultivatorCombatSource } from '../../src/domain/cultivator/combat.js';
import { PHYSICIAN_COUNT_WHEEL, physicianAbilityWheel, currentPhysicianCombatSource } from '../../src/domain/physician/combat.js';
import { HARVESTPRIEST_COUNT_WHEEL, harvestpriestAbilityWheel, currentHarvestpriestCombatSource,
  resolveHarvestpriestCombatAbility } from '../../src/domain/harvestpriest/combat.js';
import { BIOLOGIST_COUNT_WHEEL, biologistAbilityWheel, currentBiologistCombatSource,
  resolveBiologistCombatAbility } from '../../src/domain/biologist/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';

const H = 'STRIKE', J = 'BODY_FOLLOWUP', B = 'mother.s6.specimen-study';
const K = 'mother.s5.ground-passage', R = 'mother.s7.life-support', A = 'ACCIDENT';
const practice = 'mother.s9.careful-practice', ids = [H, J, B, K, R, A] as const;
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('druid-combat-test', sliceDefaultCreationSelection, 'druid-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 3;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'mother', sequence: 5, mastery: {
    'mother.s9.cultivation-knowledge': 0, 'mother.s9.season-observation': 0, [practice]: 0,
    'mother.s8.condition-observation': 0, 'mother.s8.limited-healing': 0,
    'mother.s7.harvest-care': 0, [R]: 0, [B]: 0, 'mother.s6.controlled-trial': 0, [K]: 0,
  }, acting: 0, promotionWeek: 1 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = true; s.world.carrierCanResist = true;
  s.druid = createDruidState(); s.druid.promotionWeek = 1;
  if (!firstCase) {
    Object.assign(s.druid.cases['known-soil']!, { status: 'RESOLVED', method: 'ORDINARY',
      attemptWeek: 2, closes: 1, outcome: 'PASSAGE_CHECKED' });
    s.druid.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 };
  }
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'DRUID_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0,
    enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-druid-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(s: SliceState, id: DruidMoveId, physical = 1,
  source = currentDruidCombatSource(s), random = fixedRolls()) {
  return resolveDruidCombatAbility(s, id, physical, random, source);
}
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum); const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum); return value;
  });
}
function context(success = true): SeerContext {
  return { note: vi.fn(), roll: () => 1,
    check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 25, difficulty,
      modifiers: [], roll: success ? 1 : 99 }),
  };
}
afterEach(() => vi.restoreAllMocks());

describe('Druid S5 exact G profile and unchanged inherited gates', () => {
  it('selects only mother5, exposes six detached slots and exactly one new mastery', () => {
    const s = fixture(); expect(isDruid(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(druidAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(e => e.id)).toEqual(ids);
    expect(playerAbilityWheel(s, null).map(e => e.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(playerCountWheel(s)).toEqual(DRUID_COUNT_WHEEL);
    expect(playerCountWheel(s).map(e => e.weight)).toEqual([12, 20, 25, 23, 14, 6]);
    playerAbilityWheel(s, null)[0]!.weight = 0; playerCountWheel(s)[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30); expect(playerCountWheel(s)[0]!.weight).toBe(12);
    expect(Object.isFrozen(DRUID_COUNT_WHEEL)).toBe(true); expect(DRUID_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    expect(Object.keys(s.progression.mastery).filter(id => id.includes('.s5.'))).toEqual([K]);
    s.progression.pathwayId = 'moon'; expect(isDruid(s)).toBe(false);
  });
  it('preserves exact count boundaries and 1.25 stance tickets with one slot draw', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [32, 2], [33, 3], [57, 3], [58, 4], [80, 4], [81, 5], [94, 5], [95, 6], [100, 6]] as const)
      expect(druidActionCount(roll)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2] : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [30, 15, 25, 10, 15, 5].map((w, i) => w * (boosted.includes(i) ? 5 : 4));
      const total = weights.reduce((a, b) => a + b, 0); let boundary = 0;
      druidAbilityWheel(stance).forEach((entry, i) => {
        expect(entry.weight).toBe(total === 400 ? weights[i]! / 4 : weights[i]! / total * 100);
        const first = boundary + 1; boundary += weights[i]!; const random = fixedRolls(first, boundary);
        expect(drawDruidAbility(random, stance)).toBe(ids[i]); expect(drawDruidAbility(random, stance)).toBe(ids[i]);
        expect(random.cursor).toBe(2);
      });
    }
  });
  it('uses inherited core20/15/20/45 with tier900 cap180 floor90 S100 and continuing regen10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    s.spirituality = 0; scriptRolls(1, 1, 321, 400, 1);
    expect(resolveSliceCombatRound(s, 'PREPARE').round.playerAdvantage).toBe(929 * 0.8);
    expect(s.spirituality).toBe(10); expect(s.random.cursor).toBe(5); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 321, 400, 1); expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(1080 * 0.6); vi.restoreAllMocks();
    const ceiling = fixture(); ceiling.spirituality = 99;
    scriptRolls(1, 1, 321, 400, 1); resolveSliceCombatRound(ceiling, 'PREPARE'); expect(ceiling.spirituality).toBe(100); vi.restoreAllMocks();
    vi.spyOn(druidCombat, 'resolveDruidCombatAbility').mockReturnValue({ label: 'test-negative', selfGain: -10_000, enemyReduction: 0, threatens: false });
    scriptRolls(1, 1, 321, 400, 1); expect(resolveSliceCombatRound(fixture(), 'PREPARE').round.playerAdvantage).toBe(90);
  });
  it('leaves S9–6 wheels, original sources and S7 signed accident RNG unchanged', () => {
    for (const [sequence, counts, wheel, source] of [
      [9, CULTIVATOR_COUNT_WHEEL, cultivatorAbilityWheel, currentCultivatorCombatSource],
      [8, PHYSICIAN_COUNT_WHEEL, physicianAbilityWheel, currentPhysicianCombatSource],
      [7, HARVESTPRIEST_COUNT_WHEEL, harvestpriestAbilityWheel, currentHarvestpriestCombatSource],
      [6, BIOLOGIST_COUNT_WHEEL, biologistAbilityWheel, currentBiologistCombatSource],
    ] as const) {
      const s = fixture(true); s.progression.sequence = sequence;
      expect(isDruid(s)).toBe(false); expect(currentDruidCombatSource(s)).toBeNull();
      expect(playerCountWheel(s)).toEqual(counts); expect(playerAbilityWheel(s, 'CONTROL')).toEqual(wheel('CONTROL', s));
      expect(source(s)).not.toBeNull(); s.combat!.encounterId = 'DRUID_DISPUTE'; expect(source(s)).toBeNull();
    }
    const old7 = fixture(true); old7.progression.sequence = 7; old7.spirituality = 60;
    const random = fixedRolls(2); expect(resolveHarvestpriestCombatAbility(old7, A, 1, random).selfGain).toBe(11.25); expect(random.cursor).toBe(1);
    const old6 = fixture(true); old6.progression.sequence = 6; old6.spirituality = 80;
    const untouched = structuredClone(old6), noDraw = fixedRolls();
    expect(resolveBiologistCombatAbility(old6, 'mother.s6.controlled-trial', 1, noDraw).enemyReduction).toBe(6);
    expect(resolveBiologistCombatAbility(old6, A, 1, noDraw).selfGain).toBe(-16.25);
    expect(old6).toEqual(untouched); expect(noDraw.cursor).toBe(0);
  });
});

describe('Druid inherited bodies and one completed local ground maneuver', () => {
  it('retains ordinary H12/held16, J8.4f and B42.25f without new mastery cross-scaling', () => {
    for (const mastery of [0, 100, 500]) for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const s = fixture(), f = 0.65 + 0.35 * mastery / 500;
      s.progression.mastery[practice] = mastery; s.progression.mastery[B] = mastery;
      s.progression.mastery[K] = 500; s.progression.mastery['mother.s6.controlled-trial'] = 500; s.town.clubLocation = location;
      const before = structuredClone(s);
      expect(resolve(s, H, 0.8)).toMatchObject({ selfGain: (location === 'HAND' ? 16 : 12) * 0.8, enemyReduction: 0, threatens: true });
      expect(resolve(s, J, 0.8)).toMatchObject({ selfGain: 8.4 * f * 0.8, enemyReduction: 0, threatens: true });
      expect(resolve(s, B, 0.8)).toMatchObject({ selfGain: 0, enemyReduction: 42.25 * f * 0.8, threatens: false });
      expect(s).toEqual(before);
    }
  });
  it('B reads no hidden oracle and A is fixed−22.5 with no additional draw', () => {
    const s = fixture(), before = structuredClone(s), random = fixedRolls();
    const forbidden = () => { throw new Error('Hidden oracle read'); };
    for (const key of ['hiddenWeakness', 'hiddenDisease', 'futureAction']) Object.defineProperty(s.combat!, key, { get: forbidden });
    for (const key of ['carrierSecret', 'hiddenDiagnosis', 'futureEvents']) Object.defineProperty(s.world, key, { get: forbidden });
    expect(resolve(s, B, 1, undefined, random).enemyReduction).toBe(42.25 * 0.65);
    expect(resolve(s, A, 0, undefined, random)).toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });
  it('K pays3S then exactly one knowledge14 check, actually dips/resurfaces and stores no underground state', () => {
    for (const mastery of [0, 100, 500]) {
      const s = fixture(); s.spirituality = 3; s.progression.mastery[K] = mastery;
      const before = structuredClone(s), chance = computeCheckChance({ ability: 'knowledge', baseAbility: 15, difficulty: 14, modifiers: [] });
      const random = fixedRolls(chance), effect = resolve(s, K, 0.8, undefined, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 58.5 * (0.65 + 0.35 * mastery / 500) * 0.8, threatens: false });
      expect(effect.label).toContain('实际沉入'); expect(effect.label).toContain('总长不超过1米');
      expect(effect.label).toContain('再出到同一已知净空落脚处'); expect(effect.label).toContain('壤土随后恢复稳定');
      expect(effect.label).toContain('3灵性覆盖这一连续且已完成的完整动作');
      expect(s).toEqual({ ...before, spirituality: 0 }); expect(random.cursor).toBe(1);
    }
  });
  it('failed K spends3S and leaves the body at its original surface without reduction or refund', () => {
    const s = fixture(); s.spirituality = 3; const before = structuredClone(s);
    const chance = computeCheckChance({ ability: 'knowledge', baseAbility: 15, difficulty: 14, modifiers: [] });
    const random = fixedRolls(chance + 1), effect = resolve(s, K, 1, undefined, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('原身体留在原已知地面'); expect(s).toEqual({ ...before, spirituality: 0 }); expect(random.cursor).toBe(1);
  });
  it('FIRST_CASE never upgrades unknown dry ground, and insufficient S falls back with no draw or charge', () => {
    for (const firstCase of [true, false]) for (const spirituality of firstCase ? [0, 3, 100] : [0, 2.9, Number.NaN, Infinity]) {
      const s = fixture(firstCase); s.spirituality = spirituality; s.progression.mastery[K] = 500;
      const before = structuredClone(s), random = fixedRolls(), effect = resolve(s, K, 0.8, undefined, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
      expect(effect.label).toContain('普通走位'); if (firstCase) expect(effect.label).toContain('土质未知');
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
  it('bounds malformed mastery/body factors while paying for each actual known-soil attempt', () => {
    for (const [mastery, physical, f, body] of [[Number.NaN, Number.NaN, 0.65, 0], [-1, -1, 0.65, 0],
      [Infinity, Infinity, 0.65, 0], [900, 3, 1, 1], [100, 0.8, 0.72, 0.8]] as const) {
      const s = fixture(); s.progression.mastery[practice] = mastery; s.progression.mastery[B] = mastery; s.progression.mastery[K] = mastery;
      expect(resolve(s, H, physical).selfGain).toBe(12 * body);
      expect(resolve(s, J, physical).selfGain).toBe(8.4 * f * body);
      expect(resolve(s, B, physical).enemyReduction).toBe(42.25 * f * body);
      expect(resolve(s, K, physical, undefined, fixedRolls(1)).enemyReduction).toBe(58.5 * f * body); expect(s.spirituality).toBe(97);
    }
  });
  it('rejects stale, forged or absent scene sources with zero costs and zero RNG', () => {
    const s = fixture(), source = currentDruidCombatSource(s)!;
    expect(source).toMatchObject({ encounterId: 'DRUID_DISPUTE', target: 'MAREN_SINGLE_ADULT_ORDINARY_HUMAN',
      weapon: 'MARENS_OWN_ORDINARY_SHORT_CLUB', weaponLocation: 'HAND', distanceMetres: 2,
      space: 'ORIGINAL_KNOWN_GARDEN_EDGE', ground: 'KNOWN_SHALLOW_ORDINARY_LOAM', exit: 'ORIGINAL_CLEAR_DRY_SIDEPATH_EXIT', pursuit: false });
    for (const patch of [{ revision: s.revision + 1 }, { round: 2 }, { weaponLocation: 'BAG' }, { ground: 'UNKNOWN' },
      { target: 'GREENHOUSE_SEEDLING' }, { distanceMetres: 20 }, { pursuit: true }, { exit: 'BLOCKED' }]) {
      const random = fixedRolls(), before = structuredClone(s);
      for (const id of ids) expect(resolve(s, id, 1, { ...source, ...patch } as DruidCombatSource, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
    expect(resolve(s, K, 1, null)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
  });
  it('blocks new and inherited open practice, stale encounters and dead bodies before any round RNG', () => {
    for (const mutate of [
      (s: SliceState) => { s.druid.practice.position = 'FAR'; },
      (s: SliceState) => { s.druid.practice.soil = 'SOFTENED'; },
      (s: SliceState) => { s.druid.practice.marker = 'NEAR'; },
      (s: SliceState) => { s.druid.practice.seedlings = 'OBSERVED'; },
      (s: SliceState) => { s.druid.practice.note = 'WRITTEN'; },
      (s: SliceState) => { s.druid.cases['known-soil']!.contactOpen = true; },
      (s: SliceState) => { s.biologist.cases['sample-record']!.status = 'PREPARED'; },
      (s: SliceState) => { Object.values(s.physician.cases)[0]!.contactOpen = true; },
      (s: SliceState) => { s.druid.encounter.attemptWeek = s.week - 1; },
      (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.health = 0; },
    ]) {
      const invalid = fixture(); mutate(invalid); const before = structuredClone(invalid);
      expect(currentDruidCombatSource(invalid)).toBeNull(); expect(() => resolveSliceCombatRound(invalid, 'ATTACK')).toThrow(); expect(invalid).toEqual(before);
    }
  });
  it('rechecks the actual source every slot without charging later invalid K attempts', () => {
    const s = fixture(); const original = druidCombat.resolveDruidCombatAbility; let calls = 0;
    vi.spyOn(druidCombat, 'resolveDruidCombatAbility').mockImplementation((...args) => {
      const effect = original(...args); if (++calls === 1) s.druid.practice.marker = 'NEAR'; return effect;
    });
    const draws = scriptRolls(100, 1, 281, 1, 400, 281, 281, 281, 281, 281, 1);
    const { round } = resolveSliceCombatRound(s, 'PREPARE');
    const moves = round.moves.filter(m => m.actor === 'PLAYER');
    expect(moves[0]!.enemyReduction).toBe(58.5 * 0.65); expect(moves.slice(1).every(m => m.label.includes('缺少本场'))).toBe(true);
    expect(s.spirituality).toBe(100); expect(calls).toBe(6); expect(draws).toHaveBeenCalledTimes(11);
  });
  it('R retains floor15f recovery for4S, actual health cap and all injury/pollution history', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const s = fixture(); s.health = 60; s.spirituality = 4; s.mind = 32; s.seer.pollution = 41;
      s.injuryRisk = 3; s.injuries = [{ id: 'old-heavy', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
      s.progression.mastery[R] = mastery; s.progression.mastery[K] = 500;
      const before = structuredClone(s), random = fixedRolls();
      expect(resolve(s, R, 0, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual({ ...before, health: 60 + Math.floor(15 * (0.65 + 0.35 * mastery / 500)), spirituality: 0 }); expect(random.cursor).toBe(0);
    }
    const capped = fixture(); capped.health = 99; capped.spirituality = 8;
    resolve(capped, R); expect(capped.health).toBe(100); expect(capped.spirituality).toBe(4);
    resolve(capped, R); expect(capped.spirituality).toBe(4);
    for (const [health, spirituality] of [[75, 0], [75, 3.9], [75, Number.NaN], [75, Infinity], [0, 100]] as const) {
      const s = fixture(); s.health = health; s.spirituality = spirituality; const before = structuredClone(s);
      expect(resolve(s, R)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(s).toEqual(before);
    }
  });
});

// PREPARE tickets H1–120/J121–180/B181–280/K281–320/R321–395/A396–415.
describe('Druid actual alternating rounds and finite terminal scene', () => {
  it('alternates six real player slots with three ordinary armed enemy slots; ground movement cancels none', () => {
    const s = fixture(); s.spirituality = 20; const original = structuredClone({ town: s.town, druid: s.druid });
    const draws = scriptRolls(100, 100, 1, 1, 121, 1, 181, 1, 281, 1, 321, 396, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(s, 'PREPARE');
    expect([round.playerCount, round.enemyCount]).toEqual([6, 3]);
    expect(round.moves.map(m => m.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(m => m.actor === 'PLAYER').map(m => [m.selfGain, m.enemyReduction]))
      .toEqual([[12, 0], [8.4 * 0.65, 0], [0, 42.25 * 0.65], [0, 58.5 * 0.65], [0, 0], [-22.5, 0]]);
    expect(round.moves.filter(m => m.actor === 'ENEMY').map(m => m.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(915 * 0.8 + 12 + 8.4 * 0.65 - 22.5);
    expect(round.enemyAdvantage).toBe(114 + 48 - (42.25 * 0.65 + 58.5 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(s.combat!.enemyHealth).toBe(90); expect(s.spirituality).toBe(27);
    expect({ town: s.town, druid: s.druid }).toEqual(original); expect(draws).toHaveBeenCalledTimes(14);
    s.combatHistory.push(round); vi.restoreAllMocks(); const nextDraws = scriptRolls(1, 1, 400, 321, 1);
    const next = resolveSliceCombatRound(s, 'PREPARE'); expect(next.round.first).toBe('ENEMY');
    expect(next.round.moves.map(m => m.actor)).toEqual(['ENEMY', 'PLAYER']); expect(nextDraws).toHaveBeenCalledTimes(5);
  });
  it('six K slots pay once per complete maneuver and exhausted resources give only ordinary movement', () => {
    const s = fixture(); s.spirituality = 9; const before = structuredClone(s.druid.practice);
    const draws = scriptRolls(100, 1, 281, 1, 400, 281, 1, 281, 1, 281, 281, 281, 1);
    const { round, outcome } = resolveSliceCombatRound(s, 'PREPARE');
    const moves = round.moves.filter(m => m.actor === 'PLAYER');
    expect(moves.slice(0, 3).every(m => m.label.includes('再出到同一已知净空落脚处'))).toBe(true);
    expect(moves.slice(0, 3).map(m => m.enemyReduction)).toEqual(Array(3).fill(58.5 * 0.65));
    expect(moves.slice(3).map(m => m.enemyReduction)).toEqual([6, 6, 6]);
    expect(moves.slice(3).every(m => m.label.includes('灵性不足3'))).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(s.combat!.enemyHealth).toBe(100);
    expect(outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(10); expect(s.druid.practice).toEqual(before);
    expect(draws).toHaveBeenCalledTimes(13);
  });
  it('six R slots cannot turn12S into more than three real heals before normal regen', () => {
    const s = fixture(); s.health = 60; s.spirituality = 12;
    const draws = scriptRolls(100, 1, 321, 400, 321, 321, 321, 321, 321, 1);
    const result = resolveSliceCombatRound(s, 'PREPARE'); const moves = result.round.moves.filter(m => m.actor === 'PLAYER');
    expect(moves.slice(0, 3).every(m => m.label.includes('实际恢复9健康'))).toBe(true);
    expect(moves.slice(3).every(m => m.label.includes('灵性不足4'))).toBe(true);
    expect(moves.every(m => m.selfGain === 0 && m.enemyReduction === 0)).toBe(true);
    expect(s.health).toBe(87); expect(s.spirituality).toBe(10); expect(result.outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(10);
  });
  it('B/K/R/A cannot wound; only actual ordinary H/J opens the unchanged shared consequence draw', () => {
    for (const ticket of [181, 281, 321, 396]) {
      const s = fixture(), draws = scriptRolls(1, 1, ticket, ...(ticket === 281 ? [1] : []), 400, 1);
      const { round, outcome } = resolveSliceCombatRound(s, 'PREPARE');
      expect(round.consequenceWeights).toBeNull(); expect(s.combat!.enemyHealth).toBe(100); expect(outcome).toBe('CONTINUE');
      expect(draws).toHaveBeenCalledTimes(ticket === 281 ? 6 : 5); vi.restoreAllMocks();
    }
    for (const ticket of [1, 121]) {
      const s = fixture(); s.spirituality = 10; const draws = scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(s, 'PREPARE');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(s.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 }); expect(round.consequence).toContain('马伦仍然活着');
      expect(round.consequence).not.toMatch(/携铃者|箱子/); expect(s.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });
  it('successful K does not prevent real player death and never persists underground immunity', () => {
    const s = fixture(); s.spirituality = 10; const original = structuredClone(s.druid.practice);
    const draws = scriptRolls(1, 1, 281, 1, 1, 1_000_000, 96);
    const result = resolveSliceCombatRound(s, 'PREPARE');
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.health).toBe(0); expect(s.spirituality).toBe(7);
    expect(result.round.moves[0]!.label).toContain('再出到同一已知净空落脚处'); expect(result.round.consequence).toContain('马伦');
    expect(result.round.consequence).not.toMatch(/携铃者|箱子/); expect(s.druid.practice).toEqual(original); expect(draws).toHaveBeenCalledTimes(7);
    const dead = structuredClone(s); expect(resolve(s, R)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false }); expect(s).toEqual(dead);
  });
  it('actual light injury, health-zero death and enemy death all retain Maren and real ground facts', () => {
    for (const [health, consequence, expected] of [[100, 1, 'CONTINUE'], [10, 1, 'PLAYER_DEAD']] as const) {
      const s = fixture(); s.health = health; s.spirituality = 10;
      scriptRolls(1, 1, 396, 1, 1_000_000, consequence); const result = resolveSliceCombatRound(s, 'PREPARE');
      expect(result.outcome).toBe(expected); expect(result.round.consequence).toContain('马伦'); expect(result.round.consequence).not.toMatch(/携铃者|箱子/);
      expect(s.health).toBe(health - 10); vi.restoreAllMocks();
    }
    const s = fixture(); s.spirituality = 10; scriptRolls(1, 1, 1, 400, 1, 96);
    const result = resolveSliceCombatRound(s, 'PREPARE'); expect(result.outcome).toBe('ENEMY_DEAD');
    expect(result.round.consequence).toContain('马伦'); expect(result.round.consequence).toContain('原身体');
    expect(s.combat!.enemyHealth).toBe(0); expect(s.spirituality).toBe(10);
  });
  it('ordinary sidepath exit retains50/51 boundary, no free ground escape, terminal regen or repeated settlement', () => {
    const ctx = context(), s = fixture(); s.spirituality = 10; const original = structuredClone({ town: s.town, practice: s.druid.practice });
    const draws = scriptRolls(100, 100, 50); const result = resolveSliceCombatRound(s, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.consequence).toContain('原干燥普通侧路'); expect(result.round.consequence).toContain('马伦');
    expect(result.round.consequence).not.toMatch(/携铃者|箱子/); expect(s.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(3);
    s.combatHistory.push(result.round); const award = vi.fn(); settleDruidEncounter(s, result.outcome, ctx, award);
    expect(s.combat).toBeNull(); expect(s.druid.encounter.status).toBe('RETREATED'); expect(award).not.toHaveBeenCalled();
    expect({ town: s.town, practice: s.druid.practice }).toEqual(original); expect(validateDruidEncounter(s)).toBe(true);
    expect(() => settleDruidEncounter(s, result.outcome, ctx, award)).toThrow(); vi.restoreAllMocks();
    const failed = fixture(); failed.spirituality = 10; const failedDraws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const response = resolveSliceCombatRound(failed, 'RETREAT'); expect(response.round.retreat).toBe('FAILURE');
    expect(response.round.moves).toHaveLength(1); expect(response.round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(failed.health).toBe(90); expect(failed.spirituality).toBe(20); expect(failedDraws).toHaveBeenCalledTimes(6);
  });
  it('round RNG and actual charged maneuvers replay exactly after serialization without Math.random', () => {
    const s = fixture(); s.town.clubLocation = 'HAND'; s.health = 70; s.random.cursor = 7;
    const restored = JSON.parse(JSON.stringify(s)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Math.random is forbidden'); });
    expect(resolveSliceCombatRound(s, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(s).toEqual(restored); expect(forbidden).not.toHaveBeenCalled(); expect(s.town.clubLocation).toBe('HAND');
  });
  it('requires actual report and physical closure before arrival, and ordinary talk uses1AP with no magic or reward', () => {
    const s = fixture(); s.combat = null; s.druid.encounter = { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null };
    s.actionsRemaining = 3; s.druid.practice.marker = 'NEAR'; expect(hasDruidOpenPractice(s)).toBe(true);
    expect(blockDruidEncounter(s, { type: 'ENCOUNTER_TALK' })).not.toBeNull(); s.druid.practice.marker = 'BOX';
    const ctx = context(false); applyDruidEncounter(s, { type: 'ENCOUNTER_TALK' }, ctx);
    expect(s.actionsRemaining).toBe(2); expect(s.druid.encounter.status).toBe('AVAILABLE');
    expect(blockDruidEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('本周已经');
    s.week += 1; const before = structuredClone({ town: s.town, progression: s.progression });
    applyDruidEncounter(s, { type: 'ENCOUNTER_TALK' }, context()); expect(s.druid.encounter.status).toBe('RESOLVED');
    expect(s.actionsRemaining).toBe(1); expect({ town: s.town, progression: s.progression }).toEqual(before);
    expect(s.spirituality).toBe(100); expect(validateDruidEncounter(s)).toBe(true);
  });
  it('settles only matching real terminal history and gives effective living participation25 once', () => {
    const s = fixture(), ctx = context(), award = vi.fn();
    expect(() => settleDruidEncounter(s, 'ENEMY_SURRENDERED', ctx, award)).toThrow();
    scriptRolls(1, 1, 1, 400, 1, 66); const result = resolveSliceCombatRound(s, 'PREPARE'); s.combatHistory.push(result.round);
    const forged = structuredClone(s); forged.combat!.enemyStatus = 'RESISTING';
    expect(() => settleDruidEncounter(forged, result.outcome, ctx, award)).toThrow(); expect(award).not.toHaveBeenCalled();
    settleDruidEncounter(s, result.outcome, ctx, award); expect(award).toHaveBeenCalledExactlyOnceWith('druid-dispute', 25);
    expect(validateDruidEncounter(s)).toBe(true); expect(() => settleDruidEncounter(s, result.outcome, ctx, award)).toThrow();
    s.seer.completedSources.push('druid-dispute', 'druid-dispute'); expect(validateDruidEncounter(s)).toBe(false);
  });
});
