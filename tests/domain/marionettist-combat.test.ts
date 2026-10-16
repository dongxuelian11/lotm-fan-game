import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { createMarionettistState } from '../../src/domain/marionettist/index.js';
import { MARIONETTIST_COUNT_WHEEL, currentMarionettistCombatSource, drawMarionettistAbility,
  isMarionettist, marionettistAbilityWheel, marionettistActionCount, resolveMarionettistCombatAbility,
  type MarionettistCombatSource } from '../../src/domain/marionettist/combat.js';
import * as marionettistCombat from '../../src/domain/marionettist/combat.js';
import { MAGICIAN_COUNT_WHEEL, magicianAbilityWheel, resolveMagicianFigurineReplacement } from '../../src/domain/magician/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel } from '../../src/domain/clown/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

/** Bounded engine fixture, not a claimed natural playthrough or altered save. */
function fixture(firstCase = false): SliceState {
  const s = createSliceRun('marionettist-combat-test', sliceDefaultCreationSelection, 'marionettist-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 20;
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'diviner', sequence: 5, mastery: { 'diviner.s5.spirit-threads': 0,
    'diviner.s5.marionette-control': 0 }, acting: 25, promotionWeek: 19 };
  s.marionettist = createMarionettistState();
  s.marionettist.cases['living-lines'].status = 'RESOLVED';
  s.marionettist.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 };
  s.arc.stage = firstCase ? 'COMBAT' : 'ENDED'; s.world.carrierAlive = firstCase; s.world.carrierCanResist = firstCase;
  s.combat = { encounterId: firstCase ? 'FIRST_CASE' : 'MARIONETTIST_DISPUTE', round: 1, enemyHealth: 100,
    enemyMind: 100, enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  s.health = 100; s.mind = 100; s.spirituality = 100; s.town.clubLocation = 'SHOP';
  return s;
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0; return { seed: 'bounded-s5', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++]; if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw'); return value;
  } };
}
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const value = rolls[index++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw'); return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Marionettist S5 independent finite combat', () => {
  it('selects the independent H/J/B/K/R/A profile and preserves exact count boundaries', () => {
    const s = fixture(); expect(isMarionettist(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(marionettistAbilityWheel(s, null));
    const weights = [15, 7, 10, 3, 3, 2, 8, 8, 4, 25, 10, 5];
    playerAbilityWheel(s, null).forEach((entry, index) => expect(entry.weight).toBeCloseTo(weights[index]!, 12));
    expect(playerCountWheel(s)).toEqual(MARIONETTIST_COUNT_WHEEL);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) expect(marionettistActionCount(roll!)).toBe(count);
    const publicWheel = playerAbilityWheel(s, null); publicWheel[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(15);
    expect(Object.isFrozen(MARIONETTIST_COUNT_WHEEL)).toBe(true);
  });

  it('draws exactly one move per slot, including A, with exact stance multiplication', () => {
    const s = fixture(), originalTickets = [15, 7, 10, 3, 3, 2, 8, 8, 4, 25, 10, 5];
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1, 2, 3, 4, 5] : stance === 'DEFEND' ? [6, 7, 8] : stance === 'CONTROL' ? [9] : stance === 'PREPARE' ? [10] : [];
      const tickets = originalTickets.map((weight, i) => weight * (boosted.includes(i) ? 5 : 4));
      const total = tickets.reduce((sum, n) => sum + n, 0); let boundary = 0;
      marionettistAbilityWheel(s, stance).forEach((e, i) => {
        expect(e.weight).toBeCloseTo(tickets[i]! / total * 100, 12);
        const first = boundary + 1; boundary += tickets[i]!;
        const random = fixedRolls(first, boundary);
        expect(drawMarionettistAbility(random, s, stance)).toBe(e.id);
        expect(drawMarionettistAbility(random, s, stance)).toBe(e.id); expect(random.cursor).toBe(2);
      });
    }
  });

  it('keeps the S9–6 wheels and inherited S6 air/fire strength intact', () => {
    for (const sequence of [9, 8, 7, 6] as const) {
      const s = fixture(true); s.progression.sequence = sequence;
      expect(isMarionettist(s)).toBe(false);
      expect(playerCountWheel(s)).toEqual(sequence === 9 ? SEER_COUNT_WHEEL : sequence === 8 ? CLOWN_COUNT_WHEEL : MAGICIAN_COUNT_WHEEL);
      expect(playerAbilityWheel(s, 'CONTROL')).toEqual(sequence === 9 ? seerAbilityWheel('CONTROL') : sequence === 8 ? clownAbilityWheel('CONTROL') : magicianAbilityWheel(s, 'CONTROL'));
    }
    const s = fixture(); Object.assign(s.magician.lantern, { prepared: true, oilSpent: 1 });
    expect(resolveMarionettistCombatAbility(s, 'diviner.s7.air-bullet', 1).selfGain).toBe(60);
    expect(resolveMarionettistCombatAbility(s, 'diviner.s7.flame-control', 1).selfGain).toBe(31.2);
    expect(resolveMarionettistCombatAbility(s, 'diviner.s7.flame-jump', 1).enemyReduction).toBe(31.2);
    expect(s.spirituality).toBe(93); expect(s.world.carrierAlive).toBe(false);
  });

  it('uses original paper, real fire, once-per-wound transfer and prepared figurines', () => {
    const s = fixture(); s.clown.paperSheets = 1; const spent = s.clown.paperSpent;
    expect(resolveMarionettistCombatAbility(s, 'diviner.s7.paper-weapon', 1).selfGain).toBe(22);
    expect(s.clown.paperSheets).toBe(0); expect(s.clown.paperSpent).toBe(spent + 1);
    expect(resolveMarionettistCombatAbility(s, 'diviner.s8.paper-dagger', 1).selfGain).toBe(12);
    const sp = s.spirituality;
    expect(resolveMarionettistCombatAbility(s, 'diviner.s7.flame-control', 1).selfGain).toBe(0); expect(s.spirituality).toBe(sp);
    s.health = 40; s.injuryRisk = 3;
    s.injuries.push({ id: 'actual-old-wound', severity: 'HEAVY', acquiredRevision: 0, treatedRevision: null });
    expect(marionettistAbilityWheel(s, null).find(e => e.id === 'diviner.s7.damage-transfer')?.weight).toBe(8);
    expect(marionettistAbilityWheel(s, null).some(e => e.id === 'diviner.s8.balance')).toBe(false);
    resolveMarionettistCombatAbility(s, 'diviner.s7.damage-transfer', 1);
    expect(s.injuries[0]!.severity).toBe('LIGHT'); expect(s.health).toBe(40); expect(s.injuryRisk).toBe(3);
    expect(s.magician.damageTransfers).toEqual(['actual-old-wound']);
    s.magician.figurinesMade = 1; s.magician.figurinesHeld = 1;
    expect(resolveMagicianFigurineReplacement(s, 'DEATH')?.label).toContain('不是死后复活');
    expect(s.magician.figurinesUsed).toBe(1); expect(s.magician.figurinesHeld).toBe(0); expect(s.health).toBe(40);
  });

  it('requires exact current living-source identity; stale, dead, distant and foreign sources cost nothing', () => {
    const mutations: ((s: SliceState) => void)[] = [s => { s.world.city = 'ELSEWHERE'; }, s => { s.combat!.enemyHealth = 0; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; }, s => { s.marionettist.encounter.status = 'RESOLVED'; },
      s => { s.combat!.round = 2; }, s => { s.marionettist.cases['living-lines'].contactOpen = true; },
      s => { s.marionettist.ritual.location = 'COAST'; }, s => { s.combat!.encounterId = 'FACELESS_DISPUTE'; }];
    for (const mutate of mutations) {
      const s = fixture(), source = currentMarionettistCombatSource(s); mutate(s); const before = structuredClone(s);
      expect(currentMarionettistCombatSource(s)).toBeNull();
      expect(resolveMarionettistCombatAbility(s, 'diviner.s5.spirit-threads', 1, source).enemyReduction).toBe(0); expect(s).toEqual(before);
    }
    const s = fixture(), source = currentMarionettistCombatSource(s)!;
    for (const bad of [null, { ...source, distanceMetres: 101 }, { ...source, target: 'COPY' }, { ...source, revision: s.revision + 1 }]) {
      const before = structuredClone(s);
      expect(resolveMarionettistCombatAbility(s, 'diviner.s5.spirit-threads', 1, bad as MarionettistCombatSource | null).enemyReduction).toBe(0); expect(s).toEqual(before);
    }
  });

  it('K only weakens, R has no invented puppet, A has one fixed negative contribution', () => {
    const s = fixture(), body = structuredClone(s.combat), puppet = structuredClone(s.marionettist.puppet);
    const k = resolveMarionettistCombatAbility(s, 'diviner.s5.spirit-threads', 1);
    expect(k.enemyReduction).toBeCloseTo(23.4); expect(k.threatens).toBe(false); expect(s.spirituality).toBe(98);
    expect(s.combat).toEqual(body); expect(s.marionettist.puppet).toEqual(puppet);
    expect(resolveMarionettistCombatAbility(s, 'diviner.s5.marionette-control', 1)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(resolveMarionettistCombatAbility(s, 'ACCIDENT', 1)).toMatchObject({ selfGain: -22.5, enemyReduction: 0, threatens: false });
    expect(s.random.cursor).toBe(0); expect(s.spirituality).toBe(98);
    s.spirituality = 1; expect(resolveMarionettistCombatAbility(s, 'diviner.s5.spirit-threads', 1).enemyReduction).toBe(0); expect(s.spirituality).toBe(1);
  });

  it('uses G base900, core15/30/30/25, floor90, S100 and continuing regeneration10', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 0;
    scriptRolls(1, 1, 341, 400, 1);
    expect(resolveSliceCombatRound(s, 'PREPARE').round.playerAdvantage).toBeCloseTo(926.5 * 0.8);
    expect(s.spirituality).toBe(10); expect(s.random.cursor).toBe(5); vi.restoreAllMocks();
    const ceiling = fixture(); ceiling.spirituality = 99; scriptRolls(1, 1, 341, 400, 1);
    resolveSliceCombatRound(ceiling, 'PREPARE'); expect(ceiling.spirituality).toBe(100); vi.restoreAllMocks();
    vi.spyOn(marionettistCombat, 'resolveMarionettistCombatAbility').mockReturnValue({ label: 'engine-fixture-negative', selfGain: -10000, enemyReduction: 0, threatens: false });
    scriptRolls(1, 1, 341, 400, 1); expect(resolveSliceCombatRound(fixture(), 'PREPARE').round.playerAdvantage).toBe(90);
  });

  it('keeps an enemy action after K, keeps the original death result, and takes the actual exit', () => {
    const s = fixture(); scriptRolls(1, 1, 241, 1, 1);
    const result = resolveSliceCombatRound(s, 'CONTROL');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.moves.filter(m => m.actor === 'ENEMY')).toHaveLength(1);
    expect(s.combat!.enemyStatus).toBe('RESISTING'); expect(s.combat!.enemyHealth).toBe(100); vi.restoreAllMocks();
    const dead = fixture(); scriptRolls(1, 1, 1, 400, 1, 100);
    expect(resolveSliceCombatRound(dead, 'ATTACK').outcome).toBe('ENEMY_DEAD'); expect(dead.combat!.enemyHealth).toBe(0); vi.restoreAllMocks();
    const retreat = fixture(); scriptRolls(1, 1, 1);
    const escaped = resolveSliceCombatRound(retreat, 'RETREAT'); expect(escaped.outcome).toBe('RETREATED');
    expect(escaped.round.consequence).toContain('实际后门'); expect(retreat.combat!.enemyHealth).toBe(100);
  });
});
