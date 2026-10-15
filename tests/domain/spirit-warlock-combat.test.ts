import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createSpiritWarlockState } from '../../src/domain/spirit-warlock/index.js';
import { SPIRIT_WARLOCK_ABILITY_IDS } from '../../src/domain/spirit-warlock/types.js';
import { SPIRIT_WARLOCK_COUNT_WHEEL, currentSpiritWarlockCombatSource, drawSpiritWarlockAbility,
  finishSpiritWarlockCombatRound, isSpiritWarlock, spiritWarlockAbilityWheel, spiritWarlockActionCount,
  resolveSpiritWarlockCombatAbility, resolveSpiritWarlockEnemyAction,
  type SpiritWarlockCombatSource, type SpiritWarlockMoveId } from '../../src/domain/spirit-warlock/combat.js';
import * as spiritWarlockCombat from '../../src/domain/spirit-warlock/combat.js';
import { applySpiritWarlockEncounter, blockSpiritWarlockEncounter, hasSpiritWarlockDisputeOpponent,
  settleSpiritWarlockEncounter, validateSpiritWarlockEncounter } from '../../src/domain/spirit-warlock/encounter.js';
import { REAPER_COUNT_WHEEL } from '../../src/domain/reaper/combat.js';
import { NIGHTMARE_COUNT_WHEEL, nightmareAbilityWheel } from '../../src/domain/nightmare/combat.js';
import { MIDNIGHT_COUNT_WHEEL, midnightAbilityWheel } from '../../src/domain/midnight/combat.js';
import { SLEEPLESS_COUNT_WHEEL, sleeplessAbilityWheel } from '../../src/domain/sleepless/combat.js';
import { type SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Bounded engine fixtures, not evidence of a natural promotion or acquisition. */
function fixture(firstCase = false, recruited = true): SliceState {
  const s = createSliceRun('spirit-warlock-combat-test', sliceDefaultCreationSelection, 'spirit-warlock-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 30;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'darkness', sequence: 5,
    mastery: Object.fromEntries([...SPIRIT_WARLOCK_ABILITY_IDS, 'darkness.s7.dream-entry'].map(id => [id, 0])),
    acting: 25, promotionWeek: 27 };
  s.spiritWarlock = createSpiritWarlockState(); s.spiritWarlock.promotionWeek = 27;
  Object.assign(s.spiritWarlock.cases['listening-leaves']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 28, method: 'ORDINARY', outcome: 'LEAVES_CHECKED' });
  if (recruited) Object.assign(s.spiritWarlock.companion, { status: 'SEALED', invitedWeek: 29, acquiredWeek: 29 });
  else s.spiritWarlock.companion.status = 'AVAILABLE';
  s.spiritWarlock.encounter = { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0, pressure: 0, dreamLocked: false };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'SPIRIT_WARLOCK_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
const profile: readonly [SpiritWarlockMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['SECONDARY_STRIKE', 15, 'ATTACK'],
  ['darkness.s5.spirit-assistance', 20, 'DEFEND'], ['darkness.s7.dream-entry', 20, 'CONTROL'],
  ['darkness.s5.spirit-shelter', 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
const R = 'darkness.s5.spirit-shelter', B = 'darkness.s5.spirit-assistance', K = 'darkness.s7.dream-entry';
function ticket(id: SpiritWarlockMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-spirit-warlock', get cursor() { return cursor; }, nextInt(min, max) {
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
    const result = resolveSliceCombatRound(s, stance);
    s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length);
    return result;
  } finally { spy.mockRestore(); }
}
function effect(s: SliceState, id: SpiritWarlockMoveId, factor = 1,
  source: SpiritWarlockCombatSource | null = currentSpiritWarlockCombatSource(s), random = fixedRolls()) {
  return resolveSpiritWarlockCombatAbility(s, id, factor, random, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(recruited = true): SliceState {
  const s = fixture(false, recruited); s.combat = null; s.spiritWarlock.encounter = createSpiritWarlockState().encounter;
  s.actionsRemaining = 4; return s;
}
function locked(s: SliceState) {
  effect(s, K); effect(s, K, 1, currentSpiritWarlockCombatSource(s), fixedRolls(1));
  expect(s.spiritWarlock.encounter.dreamLocked).toBe(true);
}
afterEach(() => vi.restoreAllMocks());

describe('Spirit Warlock S5 actual acquired original spirit and inherited dream cooperation', () => {
  it('selects H30/J15/B20/K20/R10/A5 and the existing S5 1–6 distribution with exact stance tickets', () => {
    const s = fixture(); expect(isSpiritWarlock(s)).toBe(true);
    expect(SPIRIT_WARLOCK_COUNT_WHEEL).toEqual(REAPER_COUNT_WHEEL);
    expect(playerCountWheel(s).map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    expect(playerAbilityWheel(s, null).map(x => x.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(s, stance)).toEqual(spiritWarlockAbilityWheel(s, stance));
      const total = profile.reduce((sum, [, weight, preferred]) => sum + weight * (stance !== null && stance === preferred ? 5 : 4), 0);
      for (const [id, weight, preferred] of profile) {
        const start = ticket(id, stance), span = weight * (stance !== null && stance === preferred ? 5 : 4);
        expect(drawSpiritWarlockAbility(fixedRolls(start), s, stance)).toBe(id);
        expect(drawSpiritWarlockAbility(fixedRolls(start + span - 1), s, stance)).toBe(id);
        expect(playerAbilityWheel(s, stance).find(x => x.id === id)!.weight).toBeCloseTo(span / total * 100);
      }
    }
    expect([1, 10, 11, 25, 26, 50, 51, 75, 76, 90, 91, 100].map(spiritWarlockActionCount)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  });

  it('leaves old S9–6 darkness wheels and inherited control selection unchanged', () => {
    const s = fixture();
    for (const seq of [7, 6] as const) {
      s.progression.sequence = seq;
      expect(isSpiritWarlock(s)).toBe(false); expect(playerCountWheel(s)).toEqual(NIGHTMARE_COUNT_WHEEL);
      expect(playerAbilityWheel(s, null)).toEqual(nightmareAbilityWheel(null));
    }
    s.progression.sequence = 8; expect(playerCountWheel(s)).toEqual(MIDNIGHT_COUNT_WHEEL);
    expect(playerAbilityWheel(s, null)).toEqual(midnightAbilityWheel(null));
    s.progression.sequence = 9; expect(playerCountWheel(s)).toEqual(SLEEPLESS_COUNT_WHEEL);
    expect(playerAbilityWheel(s, null)).toEqual(sleeplessAbilityWheel(null));
  });

  it('retains the original carrier source and never substitutes Olin, Alan, their club or their courtyard', () => {
    const s = fixture(true), original = currentSpiritWarlockCombatSource(s)!;
    expect(original).toMatchObject({ encounterId: 'FIRST_CASE', target: 'ORIGINAL_LIVING_CARRIER',
      weapon: 'ORIGINAL_CARRIER_CLUB', space: 'ORIGINAL_FIRST_CASE', attemptWeek: null, startHistoryIndex: null });
    const own = currentSpiritWarlockCombatSource(fixture())!;
    expect(own).toMatchObject({ encounterId: 'SPIRIT_WARLOCK_DISPUTE', target: 'OLIN_SINGLE_ORDINARY_ADULT',
      weapon: 'OLIN_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_COURTYARD', distanceMetres: 2, pursuit: false });
    expect(effect(s, R, 1, own)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(s.spiritWarlock.companion.status).toBe('SEALED'); expect(s.spirituality).toBe(100);
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 70);
    expect(result.round.consequence).toContain('携铃者'); expect(result.round.consequence).not.toMatch(/奥林|阿兰|凯尔/);
  });

  it('rejects stale or substituted current source without spending, drawing, mutating or creating spirits', () => {
    for (const change of [
      (source: SpiritWarlockCombatSource) => { source.round += 1; },
      (source: SpiritWarlockCombatSource) => { source.week -= 1; },
      (source: SpiritWarlockCombatSource) => { source.revision += 1; },
      (source: SpiritWarlockCombatSource) => { source.enemyHealth -= 1; },
      (source: SpiritWarlockCombatSource) => { source.playerHealth -= 1; },
      (source: SpiritWarlockCombatSource) => { source.target = 'ORIGINAL_LIVING_CARRIER'; },
    ]) {
      const s = fixture(), source = currentSpiritWarlockCombatSource(s)!; change(source);
      const before = structuredClone(s);
      for (const [id] of profile) expect(effect(s, id, 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before);
    }
    for (const change of [
      (s: SliceState) => { s.spiritWarlock.encounter.attemptWeek = s.week - 1; },
      (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.spiritWarlock.practice.note = 'RECIPIENT'; },
      (s: SliceState) => { s.spiritWarlock.practice.dreamOpen = true; },
      (s: SliceState) => { s.spiritWarlock.cases['original-message']!.contactOpen = true; },
    ]) {
      const s = fixture(); change(s); const before = structuredClone(s);
      expect(currentSpiritWarlockCombatSource(s)).toBeNull(); expect(() => resolveSliceCombatRound(s, 'PREPARE')).toThrow();
      expect(s).toEqual(before);
    }
  });

  it('never grants a spirit at promotion; unacquired/released/forged or unaffordable R costs0 and yields0', () => {
    for (const status of ['UNMET', 'AVAILABLE', 'RELEASED'] as const) {
      const s = fixture(false, false); s.spiritWarlock.companion.status = status;
      const before = structuredClone(s.spiritWarlock.companion);
      expect(effect(s, R)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
      expect(s.spirituality).toBe(100); expect(s.spiritWarlock.companion).toEqual(before);
      expect(effect(s, B).enemyReduction).toBe(10); expect(s.spirituality).toBe(100);
    }
    const forged = fixture(); forged.spiritWarlock.companion.acquiredWeek = null;
    expect(effect(forged, R).selfGain).toBe(0); expect(forged.spiritWarlock.companion.status).toBe('SEALED');
    expect(forged.spirituality).toBe(100);
    const poor = fixture(); poor.spirituality = 1;
    expect(effect(poor, R).selfGain).toBe(0); expect(poor.spirituality).toBe(1); expect(poor.spiritWarlock.companion.deployments).toBe(0);
  });

  it('R costs actual2S and changes the same sealed spirit to DEPLOYED without immediate advantage or duplicate dispatch', () => {
    const s = fixture(); const acquired = s.spiritWarlock.companion.acquiredWeek;
    expect(effect(s, R)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(98);
    expect(s.spiritWarlock.companion).toMatchObject({ source: 'SW5-LEAF-1', status: 'DEPLOYED', deployments: 1, recalls: 0, acquiredWeek: acquired });
    const before = structuredClone(s); effect(s, R); expect(s).toEqual(before);
    expect(hasSpiritWarlockDisputeOpponent(s)).toBe(true);
    expect(effect(s, B)).toMatchObject({ selfGain: 0, enemyReduction: 18, threatens: false });
    expect(s.spirituality).toBe(96); expect(s.spiritWarlock.companion.deployments).toBe(1);
    s.spirituality = 1; expect(effect(s, B).enemyReduction).toBe(0); expect(s.spirituality).toBe(1);
  });

  it('requires two paid gradual K draws and Will14, then holds the original body without reading truth or making a wound', () => {
    const s = fixture(); s.spirituality = 20;
    expect(effect(s, K)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.spirituality).toBe(17); expect(s.spiritWarlock.encounter).toMatchObject({ pressure: 1, dreamLocked: false });
    const success = effect(s, K, 1, currentSpiritWarlockCombatSource(s), fixedRolls(1));
    expect(success.enemyReduction).toBeCloseTo(15.75 * 0.65); expect(success.threatens).toBe(false);
    expect(s.spirituality).toBe(14); expect(s.lastCheck?.difficulty).toBe(14);
    expect(s.spiritWarlock.encounter).toMatchObject({ pressure: 2, dreamLocked: true });
    expect(effect(s, K).enemyReduction).toBe(0); expect(s.spirituality).toBe(14);
    for (const armed of ['SHOP', 'HAND'] as const) {
      s.town.clubLocation = armed;
      expect(effect(s, 'STRIKE').selfGain).toBe(0); expect(effect(s, 'SECONDARY_STRIKE').selfGain).toBe(0);
      expect(effect(s, B).enemyReduction).toBe(0);
    }
    expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
  });

  it('lets the same actually deployed spirit assist while the owner remains dream-locked', () => {
    const s = fixture(); locked(s);
    expect(effect(s, R).selfGain).toBe(0); expect(s.spiritWarlock.companion.status).toBe('DEPLOYED');
    const before = s.spirituality, result = effect(s, B);
    expect(result.enemyReduction).toBe(18); expect(result.label).toContain('本体仍不能移动');
    expect(s.spirituality).toBe(before - 2); expect(s.spiritWarlock.encounter.dreamLocked).toBe(true);
    expect(effect(s, 'STRIKE').selfGain).toBe(0);
  });

  it('resolves original enemy resistance exactly once and retains each original drawn slot', () => {
    for (const [roll, resisted] of [[1, true], [100, false]] as const) {
      const s = fixture(); effect(s, R); locked(s);
      const response = resolveSpiritWarlockEnemyAction(s, fixedRolls(roll), true)!;
      expect(response.suppressed).toBe(!resisted); expect(response.physicalMultiplier).toBe(resisted ? 1.25 : 1);
      expect(response.label).toContain('奥林'); expect(s.spiritWarlock.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
      expect(s.spiritWarlock.companion.status).toBe('DEPLOYED');
      expect(resolveSpiritWarlockEnemyAction(s, fixedRolls(), true)).toBeNull();
    }
    const s = fixture(true); locked(s);
    const response = resolveSpiritWarlockEnemyAction(s, fixedRolls(100), false)!;
    expect(response.label).toContain('原携铃者'); expect(response.label).not.toContain('奥林');
  });

  it('preserves K failure cost and real shortage without pressure creation or free retry', () => {
    const s = fixture(); effect(s, K);
    expect(effect(s, K, 1, currentSpiritWarlockCombatSource(s), fixedRolls(100)).enemyReduction).toBe(0);
    expect(s.spirituality).toBe(94); expect(s.spiritWarlock.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    s.spirituality = 2; expect(effect(s, K).enemyReduction).toBe(0);
    expect(s.spirituality).toBe(2); expect(s.spiritWarlock.encounter.pressure).toBe(0);
  });

  it('runs one actual6-action round with R→K→K→B→blockedH→B and only the drawn original enemy action', () => {
    const s = fixture(); s.spirituality = 40;
    const result = recordedRound(s, 'CONTROL', 100, 1, ticket(R, 'CONTROL'), 400,
      ticket(K, 'CONTROL'), ticket(K, 'CONTROL'), 1, ticket(B, 'CONTROL'), ticket('STRIKE', 'CONTROL'), ticket(B, 'CONTROL'), 1);
    const player = result.round.moves.filter(m => m.actor === 'PLAYER');
    expect(player).toHaveLength(6); expect(result.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(1);
    expect(player.map(m => m.selfGain)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(player.map(m => m.enemyReduction)).toEqual([0, 0, 15.75 * 0.65, 18, 0, 18]);
    expect(result.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(38);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'DEPLOYED', deployments: 1, recalls: 0 });
    expect(s.spiritWarlock.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
    expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
    expect(validateSpiritWarlockEncounter(s)).toBe(true);
  });

  it('keeps inherited unfinished pressure across a continuing round, then releases on the real enemy response', () => {
    const s = fixture();
    recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 400, 1);
    expect(s.spiritWarlock.encounter).toMatchObject({ pressure: 1, dreamLocked: false });
    const next = recordedRound(s, 'CONTROL', 1, 86, 400, ticket(K, 'CONTROL'), 1, 1, 100, 1, 1);
    const enemies = next.round.moves.filter(m => m.actor === 'ENEMY');
    expect(enemies).toHaveLength(3); expect(enemies[1]!.selfGain).toBe(0); expect(enemies[1]!.label).toContain('抵抗继承梦境');
    expect(s.spiritWarlock.encounter).toMatchObject({ pressure: 0, dreamLocked: false });
  });

  it('uses original ownbody/tool HJ, core35/25/25/15, tier900/floor90, max100/regen10 and one fixed negative A draw', () => {
    const s = fixture();
    expect(effect(s, 'STRIKE', 0.8).selfGain).toBeCloseTo(9.6);
    s.town.clubLocation = 'HAND'; expect(effect(s, 'SECONDARY_STRIKE', 0.8).selfGain).toBeCloseTo(12.8);
    s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(922); expect(s.spirituality).toBe(100);
    const accident = fixture();
    const a = recordedRound(accident, 'PREPARE', 1, 1, ticket('ACCIDENT', 'PREPARE'), 400, 1);
    expect(a.round.moves[0]!.selfGain).toBe(-22.5); expect(accident.random.cursor).toBe(5);
    vi.spyOn(spiritWarlockCombat, 'resolveSpiritWarlockCombatAbility').mockReturnValue({
      label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false,
    });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1).round.playerAdvantage).toBe(90);
  });

  it('requires one closed actual report and paid1AP arrival, but does not require or manufacture recruitment', () => {
    const s = available(false), beforeSpirit = structuredClone(s.spiritWarlock.companion), world = structuredClone(s.world);
    expect(blockSpiritWarlockEncounter(s, { type: 'ENCOUNTER_FIGHT' })).toBeNull();
    applySpiritWarlockEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(3); expect(hasSpiritWarlockDisputeOpponent(s)).toBe(true);
    expect(s.spiritWarlock.companion).toEqual(beforeSpirit); expect(s.world).toEqual(world);
    expect(Object.keys(s.spiritWarlock.encounter).sort()).toEqual(['attemptWeek', 'dreamLocked', 'pressure', 'startHistoryIndex', 'status']);
    for (const change of [
      (s: SliceState) => { s.spiritWarlock.cases['listening-leaves']!.status = 'EXAMINED'; },
      (s: SliceState) => { s.spiritWarlock.cases['listening-leaves']!.closes = 0; },
      (s: SliceState) => { s.spiritWarlock.companion.status = 'DEPLOYED'; },
      (s: SliceState) => { s.spiritWarlock.practice.note = 'RECIPIENT'; },
      (s: SliceState) => { s.spiritWarlock.practice.dreamOpen = true; },
    ]) {
      const invalid = available(); change(invalid); const before = structuredClone(invalid);
      expect(() => applySpiritWarlockEncounter(invalid, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(invalid).toEqual(before);
    }
  });

  it('keeps ordinary talk refusal and next-week gate; successful ordinary talk grants no spirit or mastery', () => {
    const refused = available(); applySpiritWarlockEncounter(refused, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(refused.actionsRemaining).toBe(3); expect(refused.spiritWarlock.encounter.status).toBe('AVAILABLE');
    expect(blockSpiritWarlockEncounter(refused, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    expect(validateSpiritWarlockEncounter(refused)).toBe(true);
    applySpiritWarlockEncounter(refused, { type: 'ENCOUNTER_FIGHT' }, context()); expect(refused.actionsRemaining).toBe(2);
    const talk = available(false), before = structuredClone(talk.progression), companion = structuredClone(talk.spiritWarlock.companion);
    applySpiritWarlockEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.spiritWarlock.encounter.status).toBe('RESOLVED'); expect(talk.combat).toBeNull();
    expect(talk.progression).toEqual(before); expect(talk.spiritWarlock.companion).toEqual(companion);
    expect(validateSpiritWarlockEncounter(talk)).toBe(true);
  });

  it('settles real surrender/death with once25, recalling the same deployed spirit and clearing control without healing or note movement', () => {
    for (const terminal of [70, 100]) {
      const s = fixture(); effect(s, R); s.spirituality = 30;
      const practice = structuredClone(s.spiritWarlock.practice), world = structuredClone(s.world);
      const award = vi.fn((source: string, _amount: 5 | 8 | 25) => s.seer.completedSources.push(source));
      const result = recordedRound(s, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, terminal);
      expect(result.outcome).toBe(terminal === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('奥林'); expect(result.round.consequence).not.toMatch(/携铃者|箱子|阿兰/);
      expect(s.spiritWarlock.companion).toMatchObject({ source: 'SW5-LEAF-1', status: 'SEALED', deployments: 1, recalls: 1, acquiredWeek: 29 });
      settleSpiritWarlockEncounter(s, result.outcome, context(), award);
      expect(award).toHaveBeenCalledExactlyOnceWith('spirit-warlock-dispute', 25);
      expect(s.spirituality).toBe(30); expect(s.health).toBe(100); expect(s.spiritWarlock.companion.recalls).toBe(1);
      expect(s.spiritWarlock.practice).toEqual(practice); expect(s.world).toEqual(world); expect(s.combat).toBeNull();
      expect(s.spiritWarlock.encounter).toMatchObject({ status: 'RESOLVED', pressure: 0, dreamLocked: false });
      expect(validateSpiritWarlockEncounter(s)).toBe(true);
      expect(() => settleSpiritWarlockEncounter(s, result.outcome, context(), award)).toThrow(); expect(award).toHaveBeenCalledTimes(1);
    }
  });

  it('awards0 on first-action exit/player death, preserves injuries and clears actual deployment even in FIRST_CASE', () => {
    const reward = vi.fn(), retreat = fixture(); effect(retreat, R); locked(retreat); retreat.spirituality = 17;
    const r = recordedRound(retreat, 'RETREAT', 1, 1, 1);
    expect(r.round.consequence).toContain('实际原出口'); expect(r.round.consequence).toContain('没有瞬移、追逐');
    expect(r.round.moves).toHaveLength(1); expect(retreat.spirituality).toBe(17);
    settleSpiritWarlockEncounter(retreat, r.outcome, context(), reward); expect(reward).not.toHaveBeenCalled();
    expect(validateSpiritWarlockEncounter(retreat)).toBe(true); expect(retreat.spiritWarlock.companion.recalls).toBe(1);
    const dead = fixture(); effect(dead, R);
    const d = recordedRound(dead, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 100);
    expect(d.outcome).toBe('PLAYER_DEAD'); settleSpiritWarlockEncounter(dead, d.outcome, context(), reward); dead.status = 'DEAD';
    expect(reward).not.toHaveBeenCalled(); expect(dead.health).toBe(0); expect(validateSpiritWarlockEncounter(dead)).toBe(true);
    expect(dead.spiritWarlock.companion).toMatchObject({ status: 'SEALED', recalls: 1 });
    const first = fixture(true); effect(first, R); locked(first);
    recordedRound(first, 'RETREAT', 1, 1, 1);
    expect(first.spiritWarlock.companion).toMatchObject({ status: 'SEALED', recalls: 1 });
    expect(first.spiritWarlock.encounter).toMatchObject({ status: 'AVAILABLE', attemptWeek: null, pressure: 0, dreamLocked: false });
  });

  it('rejects forged terminal/reward/history while permitting later daily activity after real settlement', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settleSpiritWarlockEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(() => settleSpiritWarlockEncounter(s, 'INVENTED', context(), award)).toThrow(); expect(s).toEqual(before);
    for (const mutate of [
      (x: SliceState) => { x.spiritWarlock.encounter.attemptWeek = 20; },
      (x: SliceState) => { x.spiritWarlock.encounter.startHistoryIndex = -1; },
      (x: SliceState) => { x.spiritWarlock.encounter.pressure = 2; },
      (x: SliceState) => { x.seer.completedSources.push('spirit-warlock-dispute'); },
      (x: SliceState) => { x.seer.completedSources.push('spirit-warlock-dispute', 'spirit-warlock-dispute'); },
    ]) { const invalid = fixture(); mutate(invalid); expect(validateSpiritWarlockEncounter(invalid)).toBe(false); }
    const ended = available(); applySpiritWarlockEncounter(ended, { type: 'ENCOUNTER_TALK' }, context());
    ended.spiritWarlock.cases['original-message']!.status = 'PREPARED';
    expect(validateSpiritWarlockEncounter(ended)).toBe(true);
    const idle = createSliceRun('spirit-warlock-unpromoted-test', sliceDefaultCreationSelection, 'initial');
    expect(validateSpiritWarlockEncounter(idle)).toBe(true);
    expect(finishSpiritWarlockCombatRound(fixture(false, false), false)).toBeNull();
  });
});
