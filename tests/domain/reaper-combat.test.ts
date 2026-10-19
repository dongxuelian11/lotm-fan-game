import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createReaperState } from '../../src/domain/reaper/index.js';
import { REAPER_COUNT_WHEEL, currentReaperCombatSource, drawReaperAbility, finishReaperCombatRound,
  isReaper, reaperAbilityWheel, reaperActionCount, resolveReaperCombatAbility,
  type ReaperCombatSource, type ReaperMoveId } from '../../src/domain/reaper/combat.js';
import * as reaperCombat from '../../src/domain/reaper/combat.js';
import { applyReaperEncounter, blockReaperEncounter, hasReaperDisputeOpponent,
  settleReaperEncounter, validateReaperEncounter } from '../../src/domain/reaper/encounter.js';
import { HUNTER_COUNT_WHEEL, hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import { PYROMANIAC_COUNT_WHEEL, currentPyromaniacFireSource, isPyromaniac, pyromaniacAbilityWheel,
  resolvePyromaniacCombatAbility, type PyromaniacFireSource } from '../../src/domain/pyromaniac/combat.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

/** Explicit bounded engine fixture; not a claimed natural promotion or playthrough. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('reaper-combat-test', sliceDefaultCreationSelection, 'reaper-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 20;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'hunter', sequence: 5,
    mastery: { 'hunter.s5.weakness-observation': 0, 'hunter.s5.precision-strike': 0 }, acting: 25, promotionWeek: 19 };
  s.reaper = createReaperState(); s.reaper.cases['timber-seam']!.status = 'RESOLVED';
  Object.assign(s.reaper.encounter, { status: firstCase ? 'AVAILABLE' : 'FIGHTING',
    attemptWeek: firstCase ? null : s.week, startHistoryIndex: firstCase ? null : 0 });
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED'; s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'REAPER_DISPUTE', round: 1,
    enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-reaper', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw');
    return value;
  } };
}
function scriptRolls(...values: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, min, max,
  ) {
    original.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error(`Unexpected random draw ${index}: ${String(value)} in ${min}..${max}`);
    return value;
  });
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const spy = scriptRolls(...values);
  try {
    const result = resolveSliceCombatRound(s, stance);
    s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length);
    return result;
  } finally { spy.mockRestore(); }
}
function effect(s: SliceState, id: ReaperMoveId, factor = 1,
  source: ReaperCombatSource | null = currentReaperCombatSource(s)) {
  return resolveReaperCombatAbility(s, id, factor, fixedRolls(), source);
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) =>
    resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
afterEach(() => vi.restoreAllMocks());

describe('Reaper S5 independent finite combat', () => {
  it('selects H20/J30/B15/K20/R10/A5 and keeps exact inherited action-count boundaries', () => {
    const s = fixture(); expect(isReaper(s)).toBe(true); expect(isPyromaniac(s)).toBe(false);
    expect(playerAbilityWheel(s, null)).toEqual(reaperAbilityWheel(s, null));
    expect(playerAbilityWheel(s, null).map(e => e.weight)).toEqual([20, 15, 5, 5, 5, 10, 5, 20, 10, 5]);
    expect(playerCountWheel(s)).toEqual(REAPER_COUNT_WHEEL);
    expect(Object.isFrozen(REAPER_COUNT_WHEEL)).toBe(true);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(reaperActionCount(roll!)).toBe(count);
    }
    const publicWheel = playerAbilityWheel(s, null); publicWheel[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(20);
  });

  it('draws one ticket per slot, including A, with exact stance multiplication and no second attack draw', () => {
    const s = fixture(), weights = [20, 15, 5, 5, 5, 10, 5, 20, 10, 5];
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1, 2, 3, 4] : stance === 'DEFEND' ? [5, 6]
        : stance === 'CONTROL' ? [7] : stance === 'PREPARE' ? [8] : [];
      const tickets = weights.map((n, i) => n * (boosted.includes(i) ? 5 : 4));
      const total = tickets.reduce((sum, n) => sum + n, 0); let boundary = 0;
      reaperAbilityWheel(s, stance).forEach((entry, i) => {
        expect(entry.weight).toBeCloseTo(tickets[i]! / total * 100, 12);
        const first = boundary + 1; boundary += tickets[i]!;
        const random = fixedRolls(first, boundary);
        expect(drawReaperAbility(random, s, stance)).toBe(entry.id);
        expect(drawReaperAbility(random, s, stance)).toBe(entry.id); expect(random.cursor).toBe(2);
      });
    }
  });

  it('leaves all S9–6 wheels and lower-sequence scene ownership unchanged', () => {
    for (const sequence of [9, 8, 7, 6] as const) {
      const s = fixture(true); s.progression.sequence = sequence;
      expect(isReaper(s)).toBe(false);
      expect(playerCountWheel(s)).toEqual(sequence === 9 ? HUNTER_COUNT_WHEEL : sequence === 8 ? PROVOKER_COUNT_WHEEL : PYROMANIAC_COUNT_WHEEL);
      expect(playerAbilityWheel(s, 'CONTROL')).toEqual(sequence === 9 ? hunterAbilityWheel('CONTROL')
        : sequence === 8 ? provokerAbilityWheel('CONTROL') : pyromaniacAbilityWheel('CONTROL'));
      expect(currentReaperCombatSource(s)).toBeNull();
      const before = structuredClone(s); expect(effect(s, 'hunter.s5.weakness-observation').selfGain).toBe(0); expect(s).toEqual(before);
    }
    const s = fixture(); s.combat!.encounterId = 'CONSPIRATOR_DISPUTE';
    Object.assign(s.conspirator.encounter, { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 });
    const before = structuredClone(s);
    expect(currentPyromaniacFireSource(s)).toBeNull();
    expect(resolvePyromaniacCombatAbility(s, 'hunter.s7.flame-lance', 1, fixedRolls()).selfGain).toBe(0);
    expect(s).toEqual(before);
  });

  it('requires the exact current living opponent and round, rejecting stale or substituted sources without cost', () => {
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.world.city = 'ELSEWHERE'; }, s => { s.combat!.enemyHealth = 0; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; }, s => { s.combat!.enemyMind = 0; },
      s => { s.reaper.encounter.status = 'RESOLVED'; }, s => { s.combat!.round = 2; },
      s => { s.reaper.cases['timber-seam']!.contactOpen = true; },
      s => { s.reaper.cases['moving-shutter']!.practice.windowOpen = true; },
      s => { s.combat!.encounterId = 'MARIONETTIST_DISPUTE'; },
    ];
    for (const mutate of mutations) {
      const s = fixture(), source = currentReaperCombatSource(s); mutate(s); const before = structuredClone(s);
      expect(currentReaperCombatSource(s)).toBeNull();
      expect(effect(s, 'hunter.s5.weakness-observation', 1, source)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
      expect(s).toEqual(before);
    }
    const s = fixture(), source = currentReaperCombatSource(s)!;
    for (const bad of [null, { ...source, distanceMetres: 50 }, { ...source, target: 'COPY' },
      { ...source, revision: s.revision + 1 }, { ...source, week: s.week + 1 }, { ...source, weaknessObservable: false }]) {
      const before = structuredClone(s);
      expect(effect(s, 'hunter.s5.weakness-observation', 1, bad as ReaperCombatSource | null).selfGain).toBe(0);
      expect(s).toEqual(before);
    }
  }, 15_000);

  it('R spends2S only on the real live original opponent, granting a window but no advantage or damage', () => {
    const s = fixture(), body = structuredClone(s.combat), world = structuredClone(s.world), random = fixedRolls();
    expect(resolveReaperCombatAbility(s, 'hunter.s5.weakness-observation', 1, random))
      .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false, angersEnemy: false });
    expect(s.spirituality).toBe(98);
    expect(s.reaper.encounter.weakness).toEqual({ sourceRound: 1, available: true, observations: 1, uses: 0 });
    expect(s.combat).toEqual(body); expect(s.world).toEqual(world); expect(random.cursor).toBe(0);
    effect(s, 'hunter.s5.weakness-observation');
    expect(s.reaper.encounter.weakness).toEqual({ sourceRound: 1, available: true, observations: 2, uses: 0 });
    expect(s.spirituality).toBe(96);
  });

  it('precision without a window is one conservative ordinary strike, never a free observation or reroll', () => {
    const s = fixture(), before = structuredClone(s);
    expect(effect(s, 'hunter.s5.precision-strike').selfGain).toBe(12); expect(s).toEqual(before);
    s.town.clubLocation = 'HAND';
    expect(effect(s, 'hunter.s5.precision-strike', 0.5).selfGain).toBe(8);
    expect(s.spirituality).toBe(100); expect(s.reaper.encounter.weakness.observations).toBe(0);
  });

  it('consumes one observed window exactly once with real2S and bounded mastery/physical G contribution', () => {
    const s = fixture(), body = structuredClone(s.combat); effect(s, 'hunter.s5.weakness-observation');
    expect(effect(s, 'hunter.s5.precision-strike').selfGain).toBeCloseTo(12 + 36 * 0.65);
    expect(s.spirituality).toBe(96);
    expect(s.reaper.encounter.weakness).toEqual({ sourceRound: null, available: false, observations: 1, uses: 1 });
    expect(effect(s, 'hunter.s5.precision-strike').selfGain).toBe(12); expect(s.spirituality).toBe(96);
    expect(s.combat).toEqual(body);
    effect(s, 'hunter.s5.weakness-observation'); s.progression.mastery['hunter.s5.precision-strike'] = 500;
    expect(effect(s, 'hunter.s5.precision-strike', 0.5).selfGain).toBe(24);
    expect(s.reaper.encounter.weakness.uses).toBe(2);
  });

  it('checks remaining spirituality for both stages without negative SP, unpaid windows or destroyed unused windows', () => {
    const s = fixture(); s.spirituality = 1;
    expect(effect(s, 'hunter.s5.weakness-observation').selfGain).toBe(0);
    expect(s.spirituality).toBe(1); expect(s.reaper.encounter.weakness.available).toBe(false);
    s.spirituality = 2; effect(s, 'hunter.s5.weakness-observation');
    expect(s.spirituality).toBe(0); expect(effect(s, 'hunter.s5.precision-strike').selfGain).toBe(12);
    expect(s.reaper.encounter.weakness.available).toBe(true); expect(s.reaper.encounter.weakness.uses).toBe(0);
    s.spirituality = 2; expect(effect(s, 'hunter.s5.precision-strike').selfGain).toBeCloseTo(35.4);
    expect(s.spirituality).toBe(0); expect(s.reaper.encounter.weakness.uses).toBe(1);
  });

  it('allows R then J in actual same-round slots, preserving the opponent action and shared injury draw', () => {
    const s = fixture(); s.spirituality = 80;
    const result = recordedRound(s, 'ATTACK', 11, 1, 391, 400, 101, 1, 1);
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerCount).toBe(2);
    expect(result.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(1);
    const playerMoves = result.round.moves.filter(m => m.actor === 'PLAYER');
    expect(playerMoves[0]!.selfGain).toBe(0); expect(playerMoves[1]!.selfGain).toBeCloseTo(35.4);
    expect(s.spirituality).toBe(86); expect(s.random.cursor).toBe(7);
    expect(s.combat!.enemyHealth).toBe(90); expect(s.combat!.enemyStatus).toBe('RESISTING');
    expect(s.reaper.encounter.weakness.uses).toBe(1); expect(validateReaperEncounter(s)).toBe(true);
  });

  it('retains a real window for the immediately following round, then expires it without a refund or free attack', () => {
    const usable = fixture();
    recordedRound(usable, 'PREPARE', 1, 1, 341, 400, 1);
    expect(usable.reaper.encounter.weakness.available).toBe(true);
    const used = recordedRound(usable, 'ATTACK', 1, 1, 400, 101, 1, 1);
    expect(used.round.moves.find(m => m.actor === 'PLAYER')!.selfGain).toBeCloseTo(35.4);
    expect(usable.reaper.encounter.weakness.uses).toBe(1);

    const expired = fixture(); expired.spirituality = 40;
    recordedRound(expired, 'PREPARE', 1, 1, 341, 400, 1);
    expect(expired.reaper.encounter.weakness.sourceRound).toBe(1);
    const pass = recordedRound(expired, 'CONTROL', 1, 1, 400, 261, 1);
    expect(pass.outcome).toBe('CONTINUE'); expect(pass.round.consequence).toContain('短窗口已到期');
    expect(expired.reaper.encounter.weakness).toEqual({ sourceRound: null, available: false, observations: 1, uses: 0 });
    expect(expired.spirituality).toBe(56); // 40 - observe2 + recover10 - fire2 + recover10.
    expect(effect(expired, 'hunter.s5.precision-strike').selfGain).toBe(12);
    expect(validateReaperEncounter(expired)).toBe(true);
  });

  it('does not fabricate a first-case weakness or borrow old practice, diviner paper, lamp or higher-sequence powers', () => {
    const s = fixture(true), before = structuredClone(s);
    expect(currentReaperCombatSource(s)?.weaknessObservable).toBe(false);
    expect(effect(s, 'hunter.s5.weakness-observation').label).toContain('旧首案');
    expect(effect(s, 'hunter.s5.precision-strike').selfGain).toBe(12);
    expect(effect(s, 'hunter.s7.compressed-fireball').selfGain).toBe(12);
    expect(s).toEqual(before);
    for (const id of ['diviner.s7.paper-weapon', 'diviner.s7.flame-jump', 'hunter.s4.fire-incarnation']) {
      expect(effect(s, id as ReaperMoveId)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
      expect(s).toEqual(before);
    }
  });

  it('inherits real hunter fire only through its own empty2m lane with original SP and no paper or lantern mutation', () => {
    const s = fixture(), clown = structuredClone(s.clown), magician = structuredClone(s.magician), body = structuredClone(s.combat);
    expect(currentPyromaniacFireSource(s)).toEqual({ encounterId: 'REAPER_DISPUTE', round: 1,
      attemptWeek: s.week, startHistoryIndex: 0, space: 'OPEN_STONE_COURTYARD',
      lane: 'EXISTING_EMPTY_STONE_LANE', distanceMetres: 2, target: 'RE5-VICK' });
    for (const [id, cost, gain, reduction] of [
      ['hunter.s7.flame-control', 2, 0, 18], ['hunter.s7.compressed-fireball', 3, 36, 0],
      ['hunter.s7.flame-lance', 3, 32, 0], ['hunter.s7.fire-raven', 2, 24, 0],
    ] as const) {
      const sp = s.spirituality, result = effect(s, id);
      expect(result).toMatchObject({ selfGain: gain, enemyReduction: reduction });
      expect(result.label).toContain('维克'); expect(result.label).toContain('自身火焰');
      expect(result.label).not.toMatch(/奥伦|哈恩|携铃者|威斯/); expect(s.spirituality).toBe(sp - cost);
    }
    expect(s.clown).toEqual(clown); expect(s.magician).toEqual(magician); expect(s.combat).toEqual(body);
    expect(effect(s, 'hunter.s9.physical-enhancement').selfGain).toBe(28);
    expect(effect(s, 'EVADE').enemyReduction).toBe(22);
    const stale = { ...currentPyromaniacFireSource(s)!, round: 2 };
    const sp = s.spirituality;
    expect(resolvePyromaniacCombatAbility(s, 'hunter.s7.flame-lance', 1, fixedRolls(), stale as PyromaniacFireSource).selfGain).toBe(12);
    expect(s.spirituality).toBe(sp);
  });

  it('uses finiteG base900/core35-30-20-15/floor90/S100/recovery10, and fixed single-slot A', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    const result = recordedRound(s, 'PREPARE', 1, 1, 341, 400, 1);
    expect(result.round.playerAdvantage).toBeCloseTo(921.5 * 0.8); expect(s.spirituality).toBe(10);
    const ceiling = fixture(); ceiling.spirituality = 99;
    recordedRound(ceiling, 'CONTROL', 1, 1, 261, 400, 1); expect(ceiling.spirituality).toBe(100);
    expect(effect(fixture(), 'ACCIDENT')).toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    const accident = fixture(); const a = recordedRound(accident, 'PREPARE', 1, 1, 410, 400, 1);
    expect(a.round.moves[0]!.selfGain).toBe(-22.5); expect(accident.random.cursor).toBe(5);
    vi.spyOn(reaperCombat, 'resolveReaperCombatAbility').mockReturnValue({ label: 'bounded-negative-fixture',
      selfGain: -10000, enemyReduction: 0, threatens: false, angersEnemy: false });
    const floor = recordedRound(fixture(), 'PREPARE', 1, 1, 341, 400, 1);
    expect(floor.round.playerAdvantage).toBe(90);
  });

  it('K preserves the opponent action, and ordinary surrender/death never become automatic precision kills', () => {
    const s = fixture(); const k = recordedRound(s, 'CONTROL', 1, 1, 261, 1, 1);
    expect(k.outcome).toBe('CONTINUE'); expect(k.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(1);
    expect(s.combat!.enemyHealth).toBe(100); expect(s.combat!.enemyStatus).toBe('RESISTING');
    const surrender = fixture(); const sr = recordedRound(surrender, 'ATTACK', 1, 1, 1, 400, 1, 70);
    expect(sr.outcome).toBe('ENEMY_SURRENDERED'); expect(sr.round.consequence).toContain('维克仍然活着');
    expect(surrender.combat!.enemyHealth).toBe(70);
    const dead = fixture(); const dr = recordedRound(dead, 'ATTACK', 1, 1, 1, 400, 1, 100);
    expect(dr.outcome).toBe('ENEMY_DEAD'); expect(dead.combat!.enemyHealth).toBe(0);
  });

  it('takes the actual rear exit, clears remaining window and retains costs without entering pursuit', () => {
    const s = fixture(); effect(s, 'hunter.s5.weakness-observation');
    const result = recordedRound(s, 'RETREAT', 1, 1, 1);
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toHaveLength(0);
    expect(result.round.consequence).toContain('实际后门'); expect(result.round.consequence).toContain('没有瞬移');
    expect(s.spirituality).toBe(98); expect(s.reaper.encounter.weakness.available).toBe(false);
    expect(s.combat!.enemyHealth).toBe(100); expect(s.world.carrierAlive).toBe(false);
    expect(finishReaperCombatRound(s, false)).toBeNull();
  });

  it('awards exactly one25 mastery for effective survival, and neither retreat nor player death awards anything', () => {
    for (const [terminalRoll, expected] of [[70, 'ENEMY_SURRENDERED'], [100, 'ENEMY_DEAD']] as const) {
      const s = fixture(), ctx = context(), award = vi.fn();
      const result = recordedRound(s, 'ATTACK', 1, 1, 1, 400, 1, terminalRoll);
      expect(result.outcome).toBe(expected); settleReaperEncounter(s, result.outcome, ctx, award);
      expect(award).toHaveBeenCalledExactlyOnceWith('reaper-dispute', 25);
      expect(s.reaper.encounter.status).toBe('RESOLVED'); expect(s.combat).toBeNull();
      expect(s.progression.acting).toBe(25); expect(validateReaperEncounter(s)).toBe(true);
      expect(() => settleReaperEncounter(s, result.outcome, ctx, award)).toThrow();
      expect(award).toHaveBeenCalledTimes(1);
    }
    const retreat = fixture(), retreatAward = vi.fn();
    const r = recordedRound(retreat, 'RETREAT', 1, 1, 1);
    settleReaperEncounter(retreat, r.outcome, context(), retreatAward);
    expect(retreatAward).not.toHaveBeenCalled(); expect(retreat.reaper.encounter.status).toBe('RETREATED');
    expect(validateReaperEncounter(retreat)).toBe(true);
    const dead = fixture(), deathAward = vi.fn();
    const d = recordedRound(dead, 'ATTACK', 1, 1, 450, 1, 1_000_000, 100);
    expect(d.outcome).toBe('PLAYER_DEAD'); settleReaperEncounter(dead, d.outcome, context(), deathAward);
    dead.status = 'DEAD'; expect(deathAward).not.toHaveBeenCalled(); expect(dead.health).toBe(0);
    expect(dead.reaper.encounter.status).toBe('LOST'); expect(validateReaperEncounter(dead)).toBe(true);
  });

  it('makes arrival cost1 action, preserves a real refusal, and never rewards ordinary talk or reopens a terminal scene', () => {
    const s = fixture(); s.combat = null; s.reaper.encounter = createReaperState().encounter;
    s.actionsRemaining = 4; const ctx = context(100);
    applyReaperEncounter(s, { type: 'ENCOUNTER_TALK' }, ctx);
    expect(s.actionsRemaining).toBe(3); expect(s.reaper.encounter.status).toBe('AVAILABLE');
    expect(blockReaperEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('本周已经交涉');
    expect(s.reaper.encounter.weakness.observations).toBe(0);
    applyReaperEncounter(s, { type: 'ENCOUNTER_FIGHT' }, ctx);
    expect(s.actionsRemaining).toBe(2); expect(hasReaperDisputeOpponent(s)).toBe(true);
    expect(s.combat!.encounterId).toBe('REAPER_DISPUTE'); expect(s.combat!.enemyHealth).toBe(100);
    const talk = fixture(); talk.combat = null; talk.reaper.encounter = createReaperState().encounter; talk.actionsRemaining = 4;
    const mastery = structuredClone(talk.progression.mastery);
    applyReaperEncounter(talk, { type: 'ENCOUNTER_TALK' }, context());
    expect(talk.reaper.encounter.status).toBe('RESOLVED'); expect(talk.progression.mastery).toEqual(mastery);
    expect(validateReaperEncounter(talk)).toBe(true);
    expect(blockReaperEncounter(talk, { type: 'ENCOUNTER_FIGHT' })).toContain('已有结果');
  });

  it('rejects fake results and invalid persisted windows without mutating the scene', () => {
    const s = fixture(), before = structuredClone(s), award = vi.fn();
    expect(() => settleReaperEncounter(s, 'ENEMY_SURRENDERED', context(), award)).toThrow();
    expect(s).toEqual(before); expect(award).not.toHaveBeenCalled();
    s.reaper.encounter.weakness = { sourceRound: 1, available: true, observations: 0, uses: 0 };
    expect(validateReaperEncounter(s)).toBe(false);
    s.reaper.encounter.weakness = { sourceRound: 20, available: true, observations: 1, uses: 0 };
    expect(validateReaperEncounter(s)).toBe(false);
    s.reaper.encounter.weakness = { sourceRound: null, available: false, observations: 1, uses: 2 };
    expect(validateReaperEncounter(s)).toBe(false);
  });
});
