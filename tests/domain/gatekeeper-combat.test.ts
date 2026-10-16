import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createGatekeeperState } from '../../src/domain/gatekeeper/index.js';
import { GATEKEEPER_ABILITY_IDS } from '../../src/domain/gatekeeper/types.js';
import { GATEKEEPER_COUNT_WHEEL, currentGatekeeperCombatSource, drawGatekeeperAbility,
  gatekeeperAbilityWheel, gatekeeperActionCount, hasGatekeeperResidentSpirit, isGatekeeper,
  releaseGatekeeperSpiritOnDeath, resolveGatekeeperCombatAbility,
  type GatekeeperCombatSource, type GatekeeperMoveId } from '../../src/domain/gatekeeper/combat.js';
import * as gatekeeperCombat from '../../src/domain/gatekeeper/combat.js';
import { applyGatekeeperEncounter, blockGatekeeperEncounter, hasGatekeeperDisputeOpponent,
  hasGatekeeperOpenPractice, settleGatekeeperEncounter, validateGatekeeperEncounter } from '../../src/domain/gatekeeper/encounter.js';
import { SPIRITMEDIUM_COUNT_WHEEL, spiritmediumAbilityWheel } from '../../src/domain/spiritmedium/combat.js';
import { REAPER_COUNT_WHEEL } from '../../src/domain/reaper/combat.js';
import { awardSeerMastery, type SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const K = 'death.s5.underworld-door', R = 'death.s5.inner-underworld';
/** Bounded combat fixtures, not evidence of a naturally completed promotion or agreement. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('gatekeeper-combat-test', sliceDefaultCreationSelection, 'gatekeeper-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'death', sequence: 5, mastery: { [K]: 0, [R]: 0 }, acting: 25, promotionWeek: 22 };
  s.gatekeeper = createGatekeeperState(); s.gatekeeper.promotionWeek = 22;
  Object.assign(s.gatekeeper.cases['resting-place']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'RESTING_CHECKED' });
  s.gatekeeper.encounter = { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'GATEKEEPER_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
function resident(s = fixture()): SliceState {
  s.gatekeeper.companion = { source: 'SG6-GRAY-FEATHER', status: 'INSIDE', agreementWeek: 23,
    entries: 1, releases: 0, deployments: 0, recalls: 0, feePaid: 12 };
  s.gatekeeper.inviteAttemptWeek = 23;
  return s;
}
const profile: readonly [GatekeeperMoveId, number, SliceStance | null][] = [
  ['STRIKE', 30, 'ATTACK'], ['SECONDARY_STRIKE', 15, 'ATTACK'], ['EVADE', 20, 'DEFEND'],
  [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], ['ACCIDENT', 5, null],
];
function ticket(id: GatekeeperMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) {
    if (candidate === id) return start;
    start += weight * (stance !== null && stance === preferred ? 5 : 4);
  }
  throw new Error('Missing test ability');
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-gatekeeper', get cursor() { return cursor; }, nextInt(min, max) {
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
function effect(s: SliceState, id: GatekeeperMoveId, factor = 1,
  source: GatekeeperCombatSource | null = currentGatekeeperCombatSource(s), random = fixedRolls()) {
  return resolveGatekeeperCombatAbility(s, id, factor, random, source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
function available(): SliceState {
  const s = fixture(); s.combat = null; s.gatekeeper.encounter = createGatekeeperState().encounter;
  s.actionsRemaining = 4; return s;
}
afterEach(() => vi.restoreAllMocks());

describe('Gatekeeper S5 finite original combat', () => {
  it('selects H30/J15/B20/K20/R10/A5 and the standard 1–6 count distribution', () => {
    const s = fixture(); expect(isGatekeeper(s)).toBe(true);
    expect(GATEKEEPER_ABILITY_IDS).toEqual([R, K]);
    expect(playerAbilityWheel(s, null)).toEqual(gatekeeperAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => [e.id, e.weight])).toEqual(profile.map(([id, weight]) => [id, weight]));
    expect(playerCountWheel(s)).toEqual(GATEKEEPER_COUNT_WHEEL);
    expect(GATEKEEPER_COUNT_WHEEL).toBe(REAPER_COUNT_WHEEL);
    expect(GATEKEEPER_COUNT_WHEEL.map(e => e.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(gatekeeperActionCount(roll!)).toBe(count);
    }
    const wheel = playerAbilityWheel(s, null); wheel[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30);
  });

  it('draws one exact integer ticket per slot and fixed A−22.5 without another random draw', () => {
    const s = fixture();
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, weight, preferred]) => weight * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((sum, n) => sum + n, 0); let boundary = 0;
      gatekeeperAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(weights[i]! / total * 100, 12);
        const first = boundary + 1; boundary += weights[i]!;
        const random = fixedRolls(first, boundary);
        expect(drawGatekeeperAbility(random, s, stance)).toBe(entry.id);
        expect(drawGatekeeperAbility(random, s, stance)).toBe(entry.id); expect(random.cursor).toBe(2);
      });
    }
    const before = structuredClone(s), random = fixedRolls();
    expect(effect(s, 'ACCIDENT', 1, currentGatekeeperCombatSource(s), random))
      .toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('leaves the existing Spirit Guide S6 and Spiritmedium S7 wheels unchanged', () => {
    for (const sequence of [6, 7]) {
      const s = fixture(); s.progression.sequence = sequence;
      expect(isGatekeeper(s)).toBe(false); expect(currentGatekeeperCombatSource(s)).toBeNull();
      expect(playerAbilityWheel(s, null)).toEqual(spiritmediumAbilityWheel(null, sequence));
      expect(playerCountWheel(s)).toEqual(SPIRITMEDIUM_COUNT_WHEEL);
    }
  });

  it('K pays4 for exactly one will14 resisted check and only scales new door mastery', () => {
    for (const [learned, expected] of [[0, 11.7], [250, 14.85], [500, 18]]) {
      const s = fixture(); s.progression.mastery[K] = learned!; s.progression.mastery[R] = 500;
      s.progression.mastery['death.s6.dead-words'] = 500;
      const before = structuredClone(s), random = fixedRolls(52, 53);
      const hit = effect(s, K, 1, currentGatekeeperCombatSource(s), random);
      expect(hit.enemyReduction).toBeCloseTo(expected!); expect(hit).toMatchObject({ selfGain: 0, threatens: true });
      expect(hit.label).toContain('意志难度14检定52%'); expect(hit.label).toContain('共同胜负与后果盘');
      expect(hit.label).toContain('当次实际行动内停止维持并完全关门');
      expect(hit.label).toContain('原持有关系不变'); expect(hit.label).toContain('可抵抗牵引');
      expect(effect(s, K, 1, currentGatekeeperCombatSource(s), random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s.spirituality).toBe(92); expect(random.cursor).toBe(2);
      expect({ ...s, spirituality: before.spirituality }).toEqual(before);
      expect(s.gatekeeper.practice.gateOpen).toBe(false);
    }
  });

  it('R spends3 only with the same actual resident and deploys/returns once within its one action', () => {
    for (const [learned, expected] of [[0, 7.8], [250, 9.9], [500, 12]]) {
      const s = resident(); s.progression.mastery[R] = learned!; s.progression.mastery[K] = 500;
      s.progression.mastery['death.s6.spirit-recruitment'] = 500;
      const before = structuredClone(s), random = fixedRolls();
      const result = effect(s, R, 1, currentGatekeeperCombatSource(s), random);
      expect(result.enemyReduction).toBeCloseTo(expected!); expect(result).toMatchObject({ selfGain: 0, threatens: true });
      expect(result.label).toContain('同一原灰羽'); expect(result.label).toContain('实际返回同一原身体内');
      expect(result.label).toContain('没有额外自主行动'); expect(random.cursor).toBe(0);
      expect(s.spirituality).toBe(97); expect(s.gatekeeper.companion).toEqual({ ...before.gatekeeper.companion, deployments: 1, recalls: 1 });
      const normalized = structuredClone(s); normalized.spirituality = before.spirituality;
      normalized.gatekeeper.companion = before.gatekeeper.companion;
      expect(normalized).toEqual(before);
    }
  });

  it('old letter recruitment never grants the new entry or free combat permission', () => {
    const s = fixture(); Object.assign(s.spiritGuide.messenger, { recruited: true, deliveries: 1, letter: 'RECIPIENT', replyReceived: true, feePaid: 12 });
    const before = structuredClone(s), random = fixedRolls();
    expect(hasGatekeeperResidentSpirit(s)).toBe(false);
    const result = effect(s, R, 1, currentGatekeeperCombatSource(s), random);
    expect(result).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(result.label).toContain('旧单封信约定不授权参战'); expect(result.label).toContain('普通准备');
    expect(s).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('rejects forged inside spirit, stale agreement or unsettled deployment without spending', () => {
    for (const mutate of [
      (s: SliceState) => { s.gatekeeper.companion.agreementWeek = null; },
      (s: SliceState) => { s.gatekeeper.companion.agreementWeek = 21; },
      (s: SliceState) => { s.gatekeeper.companion.agreementWeek = 25; },
      (s: SliceState) => { s.gatekeeper.companion.entries = 0; },
      (s: SliceState) => { s.gatekeeper.companion.releases = 1; },
      (s: SliceState) => { s.gatekeeper.companion.feePaid = 0; },
      (s: SliceState) => { s.gatekeeper.companion.deployments = 1; },
      (s: SliceState) => { s.gatekeeper.companion.status = 'DEPLOYED'; },
      (s: SliceState) => { s.gatekeeper.companion.source = 'CLONE' as 'SG6-GRAY-FEATHER'; },
    ]) {
      const s = resident(); mutate(s); const before = structuredClone(s), random = fixedRolls();
      expect(hasGatekeeperResidentSpirit(s)).toBe(false);
      expect(effect(s, R, 1, currentGatekeeperCombatSource(s), random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('insufficient/nonfinite SP does not deploy, open, spend or draw a check', () => {
    for (const [id, cost] of [[K, 4], [R, 3]] as const) for (const sp of [0, cost - 1, Number.NaN]) {
      const s = resident(); s.spirituality = sp; const before = structuredClone(s), random = fixedRolls();
      expect(effect(s, id, 1, currentGatekeeperCombatSource(s), random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('B remains ordinary−10, without SP, shields, immunity or random draws', () => {
    for (const sp of [0, 1, 2, 100, Number.NaN]) {
      const s = fixture(); s.spirituality = sp; const before = structuredClone(s), random = fixedRolls();
      const result = effect(s, 'EVADE', 1, currentGatekeeperCombatSource(s), random);
      expect(result).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(result.label).toContain('普通避让'); expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('binds actions to original person,2m,body,scene and the actual spirit snapshot', () => {
    const s = resident(), source = currentGatekeeperCombatSource(s)!;
    expect(source).toMatchObject({ target: 'LOCKE_SINGLE_ADULT', distanceMetres: 2,
      weapon: 'LOCKE_ORIGINAL_CLUB', space: 'ORIGINAL_EMPTY_PRIVATE_COURTYARD', attemptWeek: 24,
      startHistoryIndex: 0, playerBody: 'ORIGINAL_PLAYER_BODY', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false,
      companionSource: 'SG6-GRAY-FEATHER', companionStatus: 'INSIDE', entries: 1, feePaid: 12 });
    for (const bad of [null, { ...source, round: 2 }, { ...source, revision: 99 }, { ...source, week: 23 },
      { ...source, target: 'COPY' }, { ...source, distanceMetres: 40 }, { ...source, visible: false },
      { ...source, enemyHealth: 90 }, { ...source, playerMind: 70 }, { ...source, pursuit: true },
      { ...source, space: 'INVENTED_COURTYARD' }, { ...source, companionSource: 'CLONE' },
      { ...source, agreementWeek: 22 }, { ...source, recalls: 1 }]) {
      const before = structuredClone(s), random = fixedRolls();
      for (const id of [K, R, 'EVADE', 'STRIKE'] as const) expect(effect(s, id, 1, bad as GatekeeperCombatSource | null, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(random.cursor).toBe(0);
    }
    effect(s, R); const after = structuredClone(s);
    expect(effect(s, R, 1, source).enemyReduction).toBe(0); expect(s).toEqual(after);
  });

  it('rejects stale actual arrival, noncontiguous history and unclosed practice before rolling', () => {
    for (const mutate of [
      (s: SliceState) => { s.gatekeeper.encounter.attemptWeek = s.week - 1; },
      (s: SliceState) => { s.gatekeeper.encounter.startHistoryIndex = 1; },
      (s: SliceState) => { s.gatekeeper.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.enemyMind = 0; },
      (s: SliceState) => { s.gatekeeper.practice.gateOpen = true; },
      (s: SliceState) => { s.gatekeeper.practice.marker = 'RECIPIENT'; },
      (s: SliceState) => { s.gatekeeper.companion.status = 'DEPLOYED'; },
      (s: SliceState) => { s.gatekeeper.cases['shared-task']!.contactOpen = true; },
      (s: SliceState) => { Object.values(s.spiritGuide.cases)[0]!.contactOpen = true; },
    ]) {
      const s = fixture(); mutate(s); const before = structuredClone(s);
      expect(currentGatekeeperCombatSource(s)).toBeNull(); expect(effect(s, K).enemyReduction).toBe(0);
      expect(() => resolveSliceCombatRound(s, 'ATTACK')).toThrow(); expect(s).toEqual(before);
    }
  });

  it('preserves FIRST_CASE carrier and tools without replacing or reviving them', () => {
    const s = fixture(true), world = structuredClone(s.world);
    expect(currentGatekeeperCombatSource(s)).toMatchObject({ target: 'ORIGINAL_LIVING_CARRIER',
      space: 'ORIGINAL_FIRST_CASE', weapon: 'ORIGINAL_CARRIER_CLUB', distanceMetres: 2,
      attemptWeek: null, startHistoryIndex: null });
    const result = effect(s, K, 1, currentGatekeeperCombatSource(s), fixedRolls(1));
    expect(result.label).toContain('原携铃者'); expect(result.label).not.toContain('洛克'); expect(s.world).toEqual(world);
    s.world.carrierAlive = false; const before = structuredClone(s);
    expect(effect(s, K).enemyReduction).toBe(0); expect(s).toEqual(before);
    const separate = fixture(); expect(separate.world.carrierAlive).toBe(false);
    expect(currentGatekeeperCombatSource(separate)?.target).toBe('LOCKE_SINGLE_ADULT');
    const first = fixture(true);
    const terminal = recordedRound(first, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 70);
    expect(terminal.round.consequence).toContain('携铃者'); expect(terminal.round.consequence).not.toMatch(/洛克|私人庭院/);
  });

  it('H/J use only the original player body or owned held tool and unknown powers do nothing', () => {
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
    for (const id of ['death.s4.undying', 'death.s5.resurrection', 'death.s5.permanent-banishment',
      'death.s5.free-army', 'death.s5.ludwell-ring', 'death.s6.dead-words']) {
      expect(effect(s, id as GatekeeperMoveId)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(s).toEqual(before);
  });

  it('uses base900/core35-25-25-15/floor90/S100 and only continuing rounds regenerate10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(922 * 0.8); expect(s.spirituality).toBe(10);
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1); expect(ceiling.spirituality).toBe(100);
    vi.spyOn(gatekeeperCombat, 'resolveGatekeeperCombatAbility').mockReturnValue({
      label: 'bounded-negative-fixture', selfGain: -10000, enemyReduction: 0, threatens: false,
    });
    expect(recordedRound(fixture(), 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 400, 1).round.playerAdvantage).toBe(90);
  });

  it('R preserves every enemy action and grants no autonomous spirit action', () => {
    const s = resident(); s.spirituality = 20;
    const first = recordedRound(s, 'PREPARE', 1, 86, ticket(R, 'PREPARE'), 1, 1, 1, 1, 1);
    expect(first.round.moves.filter(m => m.actor === 'PLAYER')).toHaveLength(1);
    expect(first.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(3);
    expect(first.round.moves[0]!.selfGain).toBe(0); expect(first.round.moves[0]!.enemyReduction).toBeCloseTo(7.8);
    expect(s.spirituality).toBe(27); expect(first.outcome).toBe('CONTINUE');
    expect(s.gatekeeper.companion).toMatchObject({ status: 'INSIDE', deployments: 1, recalls: 1, entries: 1, releases: 0 });
    expect(hasGatekeeperDisputeOpponent(s)).toBe(true); expect(s.gatekeeper.practice.gateOpen).toBe(false);
    expect(s.combat).not.toHaveProperty('gatekeeperSpiritAction');
  });

  it('requires one actual closed report and cleanup, but permits resting INSIDE or a prepared plan', () => {
    for (const mutate of [
      (s: SliceState) => { s.gatekeeper.cases['resting-place']!.status = 'EXAMINED'; },
      (s: SliceState) => { s.gatekeeper.cases['resting-place']!.closes = 0; },
      (s: SliceState) => { s.gatekeeper.cases['shared-task']!.contactOpen = true; },
      (s: SliceState) => { s.gatekeeper.practice.gateOpen = true; },
      (s: SliceState) => { s.gatekeeper.practice.marker = 'RECIPIENT'; },
      (s: SliceState) => { s.gatekeeper.companion.status = 'DEPLOYED'; },
    ]) {
      const s = available(); mutate(s); const before = structuredClone(s);
      expect(() => applyGatekeeperEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context())).toThrow(); expect(s).toEqual(before);
    }
    const s = resident(available()); s.gatekeeper.cases['shared-task']!.status = 'PREPARED';
    s.spiritGuide.messenger.letter = 'RECIPIENT';
    const practice = structuredClone(s.gatekeeper.practice), companion = structuredClone(s.gatekeeper.companion), old = structuredClone(s.spiritGuide), world = structuredClone(s.world);
    expect(hasGatekeeperOpenPractice(s)).toBe(false);
    applyGatekeeperEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(s.actionsRemaining).toBe(3); expect(hasGatekeeperDisputeOpponent(s)).toBe(true);
    expect(Object.keys(s.gatekeeper.encounter).sort()).toEqual(['attemptWeek', 'startHistoryIndex', 'status']);
    expect(s.world).toEqual(world); expect(s.gatekeeper.practice).toEqual(practice);
    expect(s.gatekeeper.companion).toEqual(companion); expect(s.spiritGuide).toEqual(old);
  });

  it('keeps ordinary refusal and peaceful success without rewards or forced agreement', () => {
    const refused = available(); applyGatekeeperEncounter(refused, { type: 'ENCOUNTER_TALK' }, context(100));
    expect(refused.actionsRemaining).toBe(3); expect(refused.gatekeeper.encounter.status).toBe('AVAILABLE');
    expect(blockGatekeeperEncounter(refused, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    expect(validateGatekeeperEncounter(refused)).toBe(true);
    applyGatekeeperEncounter(refused, { type: 'ENCOUNTER_FIGHT' }, context());
    expect(refused.actionsRemaining).toBe(2); expect(hasGatekeeperDisputeOpponent(refused)).toBe(true);
    const talk = available(), progression = structuredClone(talk.progression);
    applyGatekeeperEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.gatekeeper.encounter.status).toBe('RESOLVED'); expect(talk.progression).toEqual(progression);
    expect(talk.combat).toBeNull(); expect(validateGatekeeperEncounter(talk)).toBe(true);
    talk.gatekeeper.cases['shared-task']!.contactOpen = true; expect(validateGatekeeperEncounter(talk)).toBe(true);
  });

  it('real surrender and death award one25 and preserve original scene, spirit and tool custody', () => {
    for (const terminal of [70, 100]) {
      const s = resident(), ctx = context(), world = structuredClone(s.world), practice = structuredClone(s.gatekeeper.practice), spirit = structuredClone(s.gatekeeper.companion);
      const award = vi.fn((source: string, amount: 5 | 8 | 25) => awardSeerMastery(s, source, amount, ctx));
      s.spirituality = 30;
      const result = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 400, 1, terminal);
      expect(result.outcome).toBe(terminal === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('旧纪念院看守洛克'); expect(result.round.consequence).not.toMatch(/携铃者|箱子|凯恩|迪恩|签署契约/);
      if (terminal === 70) expect(result.round.consequence).toContain('没有强迫他的意愿');
      else expect(result.round.consequence).toContain('原私人庭院');
      expect(s.combat!.enemyHealth).toBe(terminal === 70 ? 70 : 0); expect(s.spirituality).toBe(26);
      settleGatekeeperEncounter(s, result.outcome, ctx, award);
      expect(award).toHaveBeenCalledExactlyOnceWith('gatekeeper-dispute', 25);
      expect(s.gatekeeper.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
      expect(s.progression.acting).toBe(25); expect(validateGatekeeperEncounter(s)).toBe(true);
      expect(s.world).toEqual(world); expect(s.gatekeeper.practice).toEqual(practice); expect(s.gatekeeper.companion).toEqual(spirit);
      expect(() => settleGatekeeperEncounter(s, result.outcome, ctx, award)).toThrow(); expect(award).toHaveBeenCalledTimes(1);
    }
  });

  it('first-slot retreat gives0 reward and retains the actual body-held spirit with paid costs', () => {
    const s = resident(), reward = vi.fn(), spirit = structuredClone(s.gatekeeper.companion); s.spirituality = 98;
    const result = recordedRound(s, 'RETREAT', 1, 1, 1);
    expect(result.round.moves).toHaveLength(0); expect(result.round.consequence).toContain('实际原出口');
    expect(result.round.consequence).toContain('没有瞬移、追逐'); expect(result.round.consequence).toContain('洛克');
    expect(result.round.consequence).not.toMatch(/携铃者|箱子|凯恩|迪恩/); expect(s.spirituality).toBe(98);
    settleGatekeeperEncounter(s, result.outcome, context(), reward);
    expect(reward).not.toHaveBeenCalled(); expect(validateGatekeeperEncounter(s)).toBe(true);
    expect(s.gatekeeper.companion).toEqual(spirit);
  });

  it('player terminal death releases actual INSIDE spirit beside original corpse, never homewarps', () => {
    const s = resident(), reward = vi.fn(), world = structuredClone(s.world);
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(result.round.consequence).toContain('原私人庭院');
    expect(result.round.consequence).toContain('当前战场离开玩家原尸体'); expect(result.round.consequence).toContain('没有自动返回工作室');
    expect(s.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', entries: 1, releases: 1, deployments: 0, recalls: 0, feePaid: 12 });
    expect(s.world).toEqual(world); const spirit = structuredClone(s.gatekeeper.companion);
    expect(releaseGatekeeperSpiritOnDeath(s)).toBeNull(); expect(s.gatekeeper.companion).toEqual(spirit);
    settleGatekeeperEncounter(s, result.outcome, context(), reward); s.status = 'DEAD';
    expect(reward).not.toHaveBeenCalled(); expect(s.health).toBe(0); expect(validateGatekeeperEncounter(s)).toBe(true);
  });

  it('death after actual R assistance keeps deployment/recall history and pays3 without terminal regen', () => {
    const s = resident(); s.spirituality = 20;
    const result = recordedRound(s, 'PREPARE', 1, 1, ticket(R, 'PREPARE'), 1, 1_000_000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(s.spirituality).toBe(17);
    expect(s.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', entries: 1, releases: 1, deployments: 1, recalls: 1 });
    expect(result.round.moves.filter(m => m.actor === 'PLAYER')).toHaveLength(1);
  });

  it('health-zero and FIRST_CASE death branches release here, while absent spirits create no new release', () => {
    const enemy = fixture(); enemy.combat!.enemyHealth = 10;
    const e = recordedRound(enemy, 'ATTACK', 1, 1, ticket('STRIKE', 'ATTACK'), 400, 1, 1);
    expect(e.outcome).toBe('ENEMY_DEAD'); expect(e.round.consequence).toContain('原私人庭院健康降至0');
    expect(e.round.consequence).toContain('洛克'); expect(e.round.consequence).not.toContain('携铃者');
    const player = resident(); player.health = 10;
    const p = recordedRound(player, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 1);
    expect(p.outcome).toBe('PLAYER_DEAD'); expect(p.round.consequence).toContain('原私人庭院健康降至0');
    expect(player.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', releases: 1 });
    const first = resident(fixture(true));
    const f = recordedRound(first, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 100);
    expect(f.outcome).toBe('PLAYER_DEAD'); expect(f.round.consequence).toContain('当前战场');
    expect(f.round.consequence).not.toMatch(/洛克|私人庭院/);
    expect(first.gatekeeper.companion).toMatchObject({ status: 'OUTSIDE', releases: 1 });
    const absent = fixture(), before = structuredClone(absent.gatekeeper.companion);
    recordedRound(absent, 'ATTACK', 1, 1, ticket('ACCIDENT', 'ATTACK'), 1, 1_000_000, 100);
    expect(absent.gatekeeper.companion).toEqual(before);
  });

  it('rejects forged endings, stale history and duplicate or unearned rewards', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settleGatekeeperEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(() => settleGatekeeperEncounter(s, 'INVENTED', context(), award)).toThrow();
    expect(s).toEqual(before); expect(award).not.toHaveBeenCalled();
    for (const mutate of [
      (s: SliceState) => { s.progression.sequence = 6; },
      (s: SliceState) => { s.gatekeeper.encounter.attemptWeek = 21; },
      (s: SliceState) => { s.gatekeeper.cases['resting-place']!.status = 'AVAILABLE'; },
      (s: SliceState) => { s.gatekeeper.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.seer.completedSources.push('gatekeeper-dispute'); },
      (s: SliceState) => { s.seer.completedSources.push('gatekeeper-dispute', 'gatekeeper-dispute'); },
    ]) { const invalid = fixture(); mutate(invalid); expect(validateGatekeeperEncounter(invalid)).toBe(false); }
    expect(validateGatekeeperEncounter(createSliceRun('gatekeeper-unpromoted', sliceDefaultCreationSelection, 'initial'))).toBe(true);
  });
});
