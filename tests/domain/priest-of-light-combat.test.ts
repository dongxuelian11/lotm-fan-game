import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createPriestOfLightState } from '../../src/domain/priest-of-light/index.js';
import { PRIEST_OF_LIGHT_ABILITY_IDS } from '../../src/domain/priest-of-light/types.js';
import { PRIEST_OF_LIGHT_COUNT_WHEEL, currentPriestOfLightCombatSource, drawPriestOfLightAbility,
  isPriestOfLight, priestOfLightAbilityWheel, priestOfLightActionCount, resolvePriestOfLightCombatAbility,
  type PriestOfLightCombatSource, type PriestOfLightMoveId } from '../../src/domain/priest-of-light/combat.js';
import * as priestCombat from '../../src/domain/priest-of-light/combat.js';
import { applyPriestOfLightEncounter, blockPriestOfLightEncounter, hasPriestOfLightDisputeOpponent,
  hasPriestOfLightOpenPractice, settlePriestOfLightEncounter, validatePriestOfLightEncounter } from '../../src/domain/priest-of-light/encounter.js';
import { SUNPRIEST_COUNT_WHEEL, sunpriestAbilityWheel } from '../../src/domain/sunpriest/combat.js';
import { REAPER_COUNT_WHEEL } from '../../src/domain/reaper/combat.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const K = 'sun.s5.holy-light', R = 'sun.s9.praise';
/** Bounded combat fixtures, not evidence of a naturally completed original ice ritual. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('priest-of-light-combat-test', sliceDefaultCreationSelection, 'priest-of-light-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'sun', sequence: 5,
    mastery: { [K]: 0, [R]: 0, 'sun.s5.purification-aura': 0 }, acting: 25, promotionWeek: 22 };
  s.priestOfLight = createPriestOfLightState(); s.priestOfLight.promotionWeek = 22;
  Object.assign(s.priestOfLight.cases['darkened-walk']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'LAMP_COMPARED' });
  s.priestOfLight.encounter = { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'PRIEST_OF_LIGHT_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
const profile: readonly [PriestOfLightMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['SECONDARY_STRIKE', 15, 'ATTACK'], ['EVADE', 20, 'DEFEND'],
  [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: PriestOfLightMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-priest-of-light', get cursor() { return cursor; }, nextInt(min, max) {
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
function effect(s: SliceState, id: PriestOfLightMoveId, factor = 1,
  source: PriestOfLightCombatSource | null = currentPriestOfLightCombatSource(s), random = fixedRolls()) {
  return resolvePriestOfLightCombatAbility(s, id, factor, random, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(): SliceState {
  const s = fixture(); s.combat = null; s.priestOfLight.encounter = createPriestOfLightState().encounter;
  s.actionsRemaining = 4; return s;
}
afterEach(() => vi.restoreAllMocks());

describe('Priest of Light S5 finite original combat', () => {
  it('selects H30/J15/B20/K20/R10/A5 and the standard 1–6 count distribution', () => {
    const s = fixture(); expect(isPriestOfLight(s)).toBe(true);
    expect(PRIEST_OF_LIGHT_ABILITY_IDS).toEqual([K, 'sun.s5.purification-aura']);
    expect(playerAbilityWheel(s, null)).toEqual(priestOfLightAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => [e.id, e.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(playerCountWheel(s)).toEqual(PRIEST_OF_LIGHT_COUNT_WHEEL);
    expect(PRIEST_OF_LIGHT_COUNT_WHEEL).toBe(REAPER_COUNT_WHEEL);
    expect(PRIEST_OF_LIGHT_COUNT_WHEEL.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(priestOfLightActionCount(roll!)).toBe(count);
    }
    const wheel = playerAbilityWheel(s, null); wheel[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30);
  });

  it('draws one integer ticket with exact stance weighting and fixed A−22.5 without another draw', () => {
    const s = fixture();
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      priestOfLightAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(weights[i]! / total * 100, 12);
        const first = boundary + 1; boundary += weights[i]!;
        const random = fixedRolls(first, boundary);
        expect(drawPriestOfLightAbility(random, s, stance)).toBe(entry.id);
        expect(drawPriestOfLightAbility(random, s, stance)).toBe(entry.id); expect(random.cursor).toBe(2);
      });
    }
    const before = structuredClone(s), random = fixedRolls();
    expect(effect(s, 'ACCIDENT', 1, currentPriestOfLightCombatSource(s), random))
      .toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('leaves the existing Notary S6 wheel and count unchanged', () => {
    const s = fixture(); s.progression.sequence = 6;
    expect(isPriestOfLight(s)).toBe(false); expect(currentPriestOfLightCombatSource(s)).toBeNull();
    expect(playerAbilityWheel(s, null)).toEqual(sunpriestAbilityWheel(null, 6));
    expect(playerCountWheel(s)).toEqual(SUNPRIEST_COUNT_WHEEL);
  });

  it('K spends4 for one knowledge14 check and scales only new holy-light mastery against a normal human', () => {
    for (const [learned, expected] of [[0, 15.6], [250, 19.8], [500, 24]]) {
      const s = fixture(); s.progression.mastery[K] = learned!; s.progression.mastery[R] = 500;
      s.progression.mastery['sun.s7.holy-light'] = 500; s.progression.mastery['sun.s5.purification-aura'] = 500;
      const before = structuredClone(s), random = fixedRolls(52, 53);
      const hit = effect(s, K, 1, currentPriestOfLightCombatSource(s), random);
      expect(hit.selfGain).toBeCloseTo(expected!); expect(hit).toMatchObject({ enemyReduction: 0, threatens: true });
      expect(hit.label).toContain('知识难度14检定52%'); expect(hit.label).toContain('共同胜负与后果盘');
      expect(hit.label).toContain('没有邪恶、亡灵或堕落标签加成');
      expect(effect(s, K, 1, currentPriestOfLightCombatSource(s), random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s.spirituality).toBe(92); expect(random.cursor).toBe(2);
      expect({ ...s, spirituality: before.spirituality }).toEqual(before);
    }
  });

  it('R spends2 on actual inherited singing, scales only old praise and makes no random draw', () => {
    for (const [learned, expected] of [[0, 5.2], [250, 6.6], [500, 8]]) {
      const s = fixture(); s.progression.mastery[R] = learned!; s.progression.mastery[K] = 500;
      s.progression.mastery['sun.s5.purification-aura'] = 500;
      const before = structuredClone(s), random = fixedRolls();
      const song = effect(s, R, 1, currentPriestOfLightCombatSource(s), random);
      expect(song.selfGain).toBeCloseTo(expected!); expect(song).toMatchObject({ enemyReduction: 0, threatens: false });
      expect(song.label).toContain('实际短促吟唱'); expect(song.label).toContain('不额外检定');
      expect(song.label).toContain('没有恢复灵性'); expect(song.label).toContain('本槽结束即止');
      expect(s.spirituality).toBe(98); expect(random.cursor).toBe(0);
      expect({ ...s, spirituality: before.spirituality }).toEqual(before);
    }
  });

  it('insufficient or nonfinite SP cannot draw, spend or produce holy light or inherited praise', () => {
    for (const [id, cost] of [[K, 4], [R, 2]] as const) for (const sp of [0, cost - 1, Number.NaN]) {
      const s = fixture(); s.spirituality = sp; const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, id, 1, currentPriestOfLightCombatSource(s), random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('B is ordinary−10 at every SP level and makes no spend, shield or random draw', () => {
    for (const sp of [0, 1, 2, 100, Number.NaN]) {
      const s = fixture(); s.spirituality = sp; const before = structuredClone(s), random = fixedRolls();
      const result = effect(s, 'EVADE', 1, currentPriestOfLightCombatSource(s), random);
      expect(result).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(result.label).toContain('普通避让'); expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('binds every action to the original target,2m,body,encounter,week and contiguous round', () => {
    const s = fixture(), source = currentPriestOfLightCombatSource(s)!;
    expect(source).toMatchObject({ target: 'KANE_SINGLE_ADULT', distanceMetres: 2,
      weapon: 'KANE_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_COURTYARD', attemptWeek: 24,
      startHistoryIndex: 0, playerBody: 'ORIGINAL_PLAYER_BODY', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false, sunVulnerable: false, spiritsPresent: false, alliesPresent: false });
    for (const bad of [null, { ...source, round: 2 }, { ...source, revision: 99 }, { ...source, week: 23 },
      { ...source, target: 'COPY' }, { ...source, distanceMetres: 40 }, { ...source, visible: false },
      { ...source, enemyHealth: 90 }, { ...source, playerMind: 70 }, { ...source, pursuit: true },
      { ...source, space: 'INVENTED_COURTYARD' }, { ...source, sunVulnerable: true },
      { ...source, spiritsPresent: true }, { ...source, alliesPresent: true }]) {
      const before = structuredClone(s), random = fixedRolls();
      for (const id of [K, R, 'EVADE', 'STRIKE'] as const) expect(effect(s, id, 1, bad as PriestOfLightCombatSource | null, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const mutate of [
      (x: SliceState) => { x.priestOfLight.encounter.attemptWeek = x.week - 1; },
      (x: SliceState) => { x.priestOfLight.encounter.startHistoryIndex = 1; },
      (x: SliceState) => { x.priestOfLight.encounter.status = 'AVAILABLE'; },
      (x: SliceState) => { x.combat!.round = 2; },
      (x: SliceState) => { x.combat!.enemyStatus = 'SURRENDERED'; },
      (x: SliceState) => { x.combat!.enemyMind = 0; },
      (x: SliceState) => { x.priestOfLight.practice.auraOpen = true; },
      (x: SliceState) => { x.priestOfLight.practice.spiritDistressed = true; },
      (x: SliceState) => { x.priestOfLight.practice.lanternPosition = 'SHELTER'; },
      (x: SliceState) => { x.priestOfLight.ritual.location = 'CHAMBER'; },
      (x: SliceState) => { x.priestOfLight.ritual.location = 'ICE'; },
      (x: SliceState) => { x.priestOfLight.cases['bounded-cleansing']!.contactOpen = true; },
      (x: SliceState) => { Object.values(x.notary.cases)[0]!.contactOpen = true; },
      (x: SliceState) => { x.notary.contract.active = true; },
      (x: SliceState) => { x.notary.contract.tool = 'PLAYER'; },
    ]) {
      const x = fixture(); mutate(x); const before = structuredClone(x);
      expect(currentPriestOfLightCombatSource(x)).toBeNull(); expect(effect(x, K).selfGain).toBe(0);
      expect(() => resolveSliceCombatRound(x, 'ATTACK')).toThrow(); expect(x).toEqual(before);
    }
  });

  it('preserves FIRST_CASE original carrier identity and never invents a courtyard, replaces or revives him', () => {
    const s = fixture(true), world = structuredClone(s.world);
    expect(currentPriestOfLightCombatSource(s)).toMatchObject({ target: 'ORIGINAL_LIVING_CARRIER',
      space: 'ORIGINAL_FIRST_CASE', weapon: 'ORIGINAL_CARRIER_CLUB', distanceMetres: 2,
      attemptWeek: null, startHistoryIndex: null });
    const result = effect(s, K, 1, currentPriestOfLightCombatSource(s), fixedRolls(1));
    expect(result.label).toContain('原携铃者'); expect(result.label).not.toContain('凯恩'); expect(s.world).toEqual(world);
    s.world.carrierAlive = false; const before = structuredClone(s);
    expect(effect(s, K).selfGain).toBe(0); expect(s).toEqual(before);
    const separate = fixture(); expect(separate.world.carrierAlive).toBe(false);
    expect(currentPriestOfLightCombatSource(separate)?.target).toBe('KANE_SINGLE_ADULT');
    const first = fixture(true);
    const terminal = recordedRound(first, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 70);
    expect(terminal.round.consequence).toContain('携铃者'); expect(terminal.round.consequence).not.toMatch(/凯恩|私人庭院/);
  });

  it('H/J use only own body or held original tool, and unsupported powers cannot mutate anything', () => {
    const s = fixture();
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      s.town.clubLocation = location; const before = structuredClone(s);
      for (const id of ['STRIKE', 'SECONDARY_STRIKE'] as const) {
        expect(effect(s, id, 0.5)).toMatchObject({ selfGain: location === 'HAND' ? 8 : 6, threatens: true });
        expect(effect(s, id, 0)).toMatchObject({ selfGain: 0, threatens: false });
      }
      expect(s).toEqual(before);
    }
    const before = structuredClone(s);
    for (const id of ['sun.s4.unshadowed-domain', 'sun.s4.characteristic-purification', 'sun.s5.resurrection',
      'sun.s5.purification-aura', 'sun.s5.all-immunity', 'sun.s5.friendly-spirit-kill']) {
      expect(effect(s, id as PriestOfLightMoveId)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(s).toEqual(before);
  });

  it('uses base900/core35-25-25-15/floor90/S100 and only continuing rounds recover10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(922 * 0.8); expect(s.spirituality).toBe(10);
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1); expect(ceiling.spirituality).toBe(100);
    vi.spyOn(priestCombat, 'resolvePriestOfLightCombatAbility').mockReturnValue({
      label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false,
    });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1).round.playerAdvantage).toBe(90);
  });

  it('inherited short song never damages, deletes enemy actions or automatically surrenders a target', () => {
    const s = fixture(); s.spirituality = 20;
    const first = recordedRound(s, 'PREPARE', 1, 86, ticket(R, 'PREPARE'), 1, 1, 1, 1);
    expect(first.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(3);
    expect(first.round.moves[0]!.selfGain).toBeCloseTo(5.2); expect(first.round.moves[0]!.enemyReduction).toBe(0);
    expect(s.spirituality).toBe(28);
    expect(s.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(first.outcome).toBe('CONTINUE'); expect(hasPriestOfLightDisputeOpponent(s)).toBe(true);
    expect(s.priestOfLight.practice.auraOpen).toBe(false); expect(s.combat).not.toHaveProperty('priestOfLightSong');
  });

  it('requires one real closed report and all actual body/aura/spirit departures to be complete, but allows a prepared plan', () => {
    for (const mutate of [
      (s: SliceState) => { s.priestOfLight.cases['darkened-walk']!.status = 'EXAMINED'; },
      (s: SliceState) => { s.priestOfLight.cases['darkened-walk']!.closes = 0; },
      (s: SliceState) => { s.priestOfLight.cases['bounded-cleansing']!.contactOpen = true; },
      (s: SliceState) => { s.priestOfLight.practice.auraOpen = true; },
      (s: SliceState) => { s.priestOfLight.practice.spiritDistressed = true; },
      (s: SliceState) => { s.priestOfLight.practice.lanternPosition = 'SHELTER'; },
      (s: SliceState) => { s.priestOfLight.ritual.location = 'ICE'; },
    ]) {
      const s = available(); mutate(s); const before = structuredClone(s);
      expect(() => applyPriestOfLightEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s).toEqual(before);
    }
    const s = available(); s.priestOfLight.cases['bounded-cleansing']!.status = 'PREPARED';
    const practice = structuredClone(s.priestOfLight.practice), ritual = structuredClone(s.priestOfLight.ritual), world = structuredClone(s.world);
    expect(hasPriestOfLightOpenPractice(s)).toBe(false);
    applyPriestOfLightEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(3); expect(hasPriestOfLightDisputeOpponent(s)).toBe(true);
    expect(Object.keys(s.priestOfLight.encounter).sort()).toEqual(['attemptWeek', 'startHistoryIndex', 'status']);
    expect(s.world).toEqual(world); expect(s.priestOfLight.practice).toEqual(practice); expect(s.priestOfLight.ritual).toEqual(ritual);
  });

  it('keeps ordinary refusal and peaceful success without rewards and permits later practice', () => {
    const refused = available(); applyPriestOfLightEncounter(refused, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(refused.actionsRemaining).toBe(3); expect(refused.priestOfLight.encounter.status).toBe('AVAILABLE');
    expect(blockPriestOfLightEncounter(refused, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    expect(validatePriestOfLightEncounter(refused)).toBe(true);
    applyPriestOfLightEncounter(refused, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(refused.actionsRemaining).toBe(2); expect(hasPriestOfLightDisputeOpponent(refused)).toBe(true);
    const talk = available(), progression = structuredClone(talk.progression);
    applyPriestOfLightEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.priestOfLight.encounter.status).toBe('RESOLVED'); expect(talk.progression).toEqual(progression);
    expect(talk.combat).toBeNull(); expect(validatePriestOfLightEncounter(talk)).toBe(true);
    talk.priestOfLight.cases['bounded-cleansing']!.contactOpen = true;
    expect(validatePriestOfLightEncounter(talk)).toBe(true);
  });

  it('real surrender and death award one25 and keep correct scene text, own objects and actual costs', () => {
    for (const terminal of [70, 100]) {
      const s = fixture(), ctx = context(), world = structuredClone(s.world), practice = structuredClone(s.priestOfLight.practice);
      const award = vi.fn((source: string, amount: 5 | 8 | 25) => awardSeerMastery(s, source, amount, ctx));
      s.spirituality = 30;
      const result = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 400, 1, terminal);
      expect(result.outcome).toBe(terminal === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('普通门房凯恩'); expect(result.round.consequence).not.toMatch(/携铃者|箱子|罗文|签署契约/);
      if (terminal === 70) expect(result.round.consequence).toContain('圣光与继承短吟没有强迫他的意愿');
      else expect(result.round.consequence).toContain('原私人庭院');
      expect(s.combat!.enemyHealth).toBe(terminal === 70 ? 70 : 0); expect(s.spirituality).toBe(26);
      settlePriestOfLightEncounter(s, result.outcome, ctx, award);
      expect(award).toHaveBeenCalledExactlyOnceWith('priest-of-light-dispute', 25);
      expect(s.priestOfLight.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
      expect(s.progression.acting).toBe(25); expect(validatePriestOfLightEncounter(s)).toBe(true);
      expect(s.world).toEqual(world); expect(s.priestOfLight.practice).toEqual(practice);
      expect(() => settlePriestOfLightEncounter(s, result.outcome, ctx, award)).toThrow(); expect(award).toHaveBeenCalledTimes(1);
    }
  });

  it('first-action retreat and player death award0, preserve costs and name the actual original exit', () => {
    const retreat = fixture(), reward = vi.fn(); retreat.spirituality = 98;
    const r = recordedRound(retreat, 'RETREAT', 1, 1, 1);
    expect(r.round.moves).toHaveLength(0); expect(r.round.consequence).toContain('实际原出口');
    expect(r.round.consequence).toContain('没有瞬移、追逐'); expect(r.round.consequence).toContain('普通门房凯恩');
    expect(r.round.consequence).not.toMatch(/携铃者|箱子|罗文/); expect(retreat.spirituality).toBe(98);
    settlePriestOfLightEncounter(retreat, r.outcome, context(), reward);
    expect(reward).not.toHaveBeenCalled(); expect(validatePriestOfLightEncounter(retreat)).toBe(true);
    const dead = fixture();
    const d = recordedRound(dead, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 100);
    expect(d.outcome).toBe('PLAYER_DEAD'); expect(d.round.consequence).toContain('原私人庭院');
    settlePriestOfLightEncounter(dead, d.outcome, context(), reward); dead.status = 'DEAD';
    expect(reward).not.toHaveBeenCalled(); expect(dead.health).toBe(0); expect(validatePriestOfLightEncounter(dead)).toBe(true);
  });

  it('health-zero death branches also retain actual courtyard context without altering FIRST_CASE text', () => {
    const enemy = fixture(); enemy.combat!.enemyHealth = 10;
    const e = recordedRound(enemy, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 1);
    expect(e.outcome).toBe('ENEMY_DEAD'); expect(e.round.consequence).toContain('原私人庭院健康降至0');
    expect(e.round.consequence).toContain('普通门房凯恩'); expect(e.round.consequence).not.toContain('携铃者');
    const player = fixture(); player.health = 10;
    const p = recordedRound(player, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 1);
    expect(p.outcome).toBe('PLAYER_DEAD'); expect(p.round.consequence).toContain('原私人庭院健康降至0');
    const old = fixture(true); old.combat!.enemyHealth = 10;
    const o = recordedRound(old, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 1);
    expect(o.round.consequence).toContain('携铃者'); expect(o.round.consequence).not.toContain('私人庭院');
  });

  it('rejects forged endings, stale arrival/history and duplicate or unearned rewards', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settlePriestOfLightEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(() => settlePriestOfLightEncounter(s, 'INVENTED', context(), award)).toThrow();
    expect(s).toEqual(before); expect(award).not.toHaveBeenCalled();
    for (const mutate of [
      (x: SliceState) => { x.progression.sequence = 6; },
      (x: SliceState) => { x.priestOfLight.encounter.attemptWeek = 21; },
      (x: SliceState) => { x.priestOfLight.cases['darkened-walk']!.status = 'AVAILABLE'; },
      (x: SliceState) => { x.priestOfLight.encounter.startHistoryIndex = -1; },
      (x: SliceState) => { x.seer.completedSources.push('priest-of-light-dispute'); },
      (x: SliceState) => { x.seer.completedSources.push('priest-of-light-dispute', 'priest-of-light-dispute'); },
    ]) { const invalid = fixture(); mutate(invalid); expect(validatePriestOfLightEncounter(invalid)).toBe(false); }
    expect(validatePriestOfLightEncounter(createSliceRun('priest-light-unpromoted', sliceDefaultCreationSelection, 'initial'))).toBe(true);
  });
});
