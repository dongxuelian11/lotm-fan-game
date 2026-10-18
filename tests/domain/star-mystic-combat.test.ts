import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceStance, SliceState } from '../../src/domain/slice/types.js';
import { createStarMysticState } from '../../src/domain/star-mystic/index.js';
import {
  STAR_MYSTIC_COUNT_WHEEL, consumeStarMysticCage, currentStarMysticCombatSource, drawStarMysticAbility,
  finishStarMysticCombatRound, isStarMystic, resolveStarMysticCombatAbility, starMysticAbilityWheel,
  starMysticActionCount, type StarMysticCombatSource, type StarMysticMoveId,
} from '../../src/domain/star-mystic/combat.js';
import * as starCombat from '../../src/domain/star-mystic/combat.js';
import { applyStarMysticEncounter, blockStarMysticEncounter, settleStarMysticEncounter, validateStarMysticEncounter } from '../../src/domain/star-mystic/encounter.js';
import { SCROLL_PROFESSOR_COUNT_WHEEL, resolveScrollProfessorCombatAbility, scrollProfessorAbilityWheel } from '../../src/domain/scroll-professor/combat.js';
import type { ScrollProfessorScroll } from '../../src/domain/scroll-professor/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

const H = 'hermit.s6.scrollcraft', J = 'BODY_FOLLOWUP', B = 'BRIEF_WARD';
const K = 'hermit.s5.star-cage', R = 'hermit.s5.mystic-sight', A = 'ACCIDENT';
const profile: readonly [StarMysticMoveId, number, SliceStance | null][] = [
  [H, 30, 'ATTACK'], [J, 15, 'ATTACK'], [B, 20, 'DEFEND'], [K, 20, 'CONTROL'], [R, 10, 'PREPARE'], [A, 5, null],
];
/** Isolated synthetic actual arrival; natural promotion and material creation are separately tested. */
function fixture(learned = false): SliceState {
  const s = createSliceRun('star-mystic-combat-test', sliceDefaultCreationSelection, 'star-mystic-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 24; s.arc.stage = 'ENDED';
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.progression = { pathwayId: 'hermit', sequence: 5, mastery: { [H]: 0, [K]: 0, [R]: 0,
    'hermit.s7.spellcraft': 0, 'hermit.s8.combat-study': 0 }, acting: 25, promotionWeek: 22 };
  s.starMystic = createStarMysticState(); s.starMystic.promotionWeek = 22;
  s.starMystic.practice.lenses = 'WORN';
  Object.assign(s.starMystic.cases['willing-cage']!, { status: 'RESOLVED', contactOpen: false,
    closes: 1, attemptWeek: 23, method: 'ORDINARY', outcome: 'BOUNDARY_CHECKED' });
  Object.assign(s.starMystic.encounter, { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 });
  s.combat = { encounterId: 'STAR_MYSTIC_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  for (const id of ['light-touch', 'brief-ward', 'blur-mark']) s.wizard.lessons[id] = { learned, attemptWeek: learned ? 1 : null };
  s.health = 100; s.mind = 100; s.spirituality = 80; s.town.clubLocation = 'SHOP';
  return s;
}
function original(s: SliceState, kind: ScrollProfessorScroll['kind'], makerSequence: 6 | 5 = 6, inscriptionMastery = 500): ScrollProfessorScroll {
  const w = s.scrollProfessor.workshop, n = w.scrolls.length + 1, createdWeek = makerSequence === 6 ? 20 : 23;
  const materialId = `scroll-professor-material-${n}`;
  w.materials.push({ id: materialId, acquiredWeek: createdWeek, status: 'SPENT', spentWeek: createdWeek });
  const scroll: ScrollProfessorScroll = { id: `scroll-professor-scroll-${n}`, kind, makerSequence,
    inscriptionMastery, materialId, createdWeek, status: 'HELD', usedWeek: null, authorized: true };
  w.scrolls.push(scroll); w.craftAttempts += 1; w.kitsBought = Math.ceil(n / 4); w.lastKitWeek = createdWeek;
  return scroll;
}
function fixedRolls(...values: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-star-mystic', get cursor() { return cursor; }, nextInt(min, max) {
    const value = values[cursor++]; if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw'); return value;
  } };
}
function ticket(id: StarMysticMoveId, stance: SliceStance | null): number {
  let start = 1;
  for (const [candidate, weight, preferred] of profile) { if (candidate === id) return start; start += weight * (stance !== null && stance === preferred ? 5 : 4); }
  throw new Error('Missing test ability');
}
function effect(s: SliceState, id: StarMysticMoveId, random = fixedRolls(), physical = 1, source: StarMysticCombatSource | null = currentStarMysticCombatSource(s)) {
  return resolveStarMysticCombatAbility(s, id, physical, random, source);
}
function recordedRound(s: SliceState, stance: SliceStance, ...values: number[]) {
  const next = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    next.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error('Unexpected random draw ' + index); return value;
  });
  try {
    const result = resolveSliceCombatRound(s, stance); s.combatHistory.push(structuredClone(result.round));
    expect(spy).toHaveBeenCalledTimes(values.length); return result;
  } finally { spy.mockRestore(); }
}
function context(roll = 1): SeerContext {
  return { roll: min => min, note: vi.fn(), check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }) };
}
afterEach(() => vi.restoreAllMocks());

describe('Star Mystic exact S5 profile and real source', () => {
  it('routes only Hermit5 to detached30/15/20/20/10/5 and count12/20/25/23/14/6 wheels', () => {
    const s = fixture(); expect(isStarMystic(s)).toBe(true);
    expect(playerAbilityWheel(s, null)).toEqual(starMysticAbilityWheel(null, s));
    expect(playerAbilityWheel(s, null).map(a => a.id)).toEqual(profile.map(a => a[0]));
    expect(playerAbilityWheel(s, null).map(a => a.weight)).toEqual([30, 15, 20, 20, 10, 5]);
    expect(playerCountWheel(s)).toEqual(STAR_MYSTIC_COUNT_WHEEL);
    playerAbilityWheel(s, null)[0]!.weight = 0; playerCountWheel(s)[0]!.weight = 0;
    expect(playerAbilityWheel(s, null)[0]!.weight).toBe(30); expect(playerCountWheel(s)[0]!.weight).toBe(12);
    s.progression.pathwayId = 'paragon'; expect(isStarMystic(s)).toBe(false);
  });
  it('has exact count and integer stance-ticket boundaries with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [12, 1], [13, 2], [32, 2], [33, 3], [57, 3], [58, 4], [80, 4], [81, 5], [94, 5], [95, 6], [100, 6]]) expect(starMysticActionCount(roll!)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const weights = profile.map(([, w, preferred]) => w * (stance !== null && stance === preferred ? 5 : 4));
      const total = weights.reduce((a, b) => a + b, 0); let edge = 0;
      starMysticAbilityWheel(stance).forEach((entry, i) => {
        expect(entry.weight).toBe(total === 400 ? weights[i]! / 4 : weights[i]! / total * 100);
        const first = edge + 1; edge += weights[i]!; const r = fixedRolls(first, edge);
        expect(drawStarMysticAbility(r, stance)).toBe(profile[i]![0]); expect(drawStarMysticAbility(r, stance)).toBe(profile[i]![0]); expect(r.cursor).toBe(2);
      });
    }
  });
  it('retains exact old S6 wheel, action count, maker6 budget and free-resource behavior', () => {
    const s = fixture(true); s.progression.sequence = 6;
    Object.assign(s.scrollProfessor.cases['paper-target']!, { status: 'RESOLVED' });
    s.scrollProfessor.encounter = { status: 'FIGHTING', attemptWeek: s.week, startHistoryIndex: 0 };
    s.combat!.encounterId = 'SCROLL_PROFESSOR_DISPUTE';
    expect(playerAbilityWheel(s, null)).toEqual(scrollProfessorAbilityWheel(null, s));
    expect(playerCountWheel(s)).toEqual(SCROLL_PROFESSOR_COUNT_WHEEL);
    const scroll = original(s, 'IMPACT', 6, 100), before = structuredClone(s.starMystic);
    expect(resolveScrollProfessorCombatAbility(s, H, 1, fixedRolls()).selfGain).toBe(38.025 * 0.72);
    expect(scroll.status).toBe('USED'); expect(s.spirituality).toBe(79); expect(s.starMystic).toEqual(before);
    expect(currentStarMysticCombatSource(s)).toBeNull();
  });
  it('binds current body, own club, actual2m exit and rejects a forged source or FIRST_CASE before draws', () => {
    const s = fixture(), source = currentStarMysticCombatSource(s)!;
    expect(source).toMatchObject({ target: 'BRYCE_SINGLE_ADULT_ORDINARY_HUMAN', weapon: 'BRYCES_OWN_ORDINARY_SHORT_CLUB', distanceMetres: 2, ally: 'NONE', bystanders: 'NONE', pursuit: false });
    for (const key of Object.keys(source)) {
      const forged = { ...source, [key]: 'WRONG' } as unknown as StarMysticCombatSource, before = structuredClone(s), r = fixedRolls();
      for (const [id] of profile) expect(effect(s, id, r, 1, forged)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(s).toEqual(before); expect(r.cursor).toBe(0);
    }
    for (const mutate of [
      (v: SliceState) => { v.combat!.encounterId = 'FIRST_CASE'; }, (v: SliceState) => { v.world.city = 'ELSEWHERE'; },
      (v: SliceState) => { v.health = 0; }, (v: SliceState) => { v.mind = 0; }, (v: SliceState) => { v.combat!.enemyHealth = 0; },
      (v: SliceState) => { v.combat!.round = 2; }, (v: SliceState) => { v.starMystic.encounter.attemptWeek = 1; },
      (v: SliceState) => { v.starMystic.practice.screen = 'OPEN'; }, (v: SliceState) => { v.starMystic.practice.lenses = 'HELD'; },
      (v: SliceState) => { v.starMystic.practice.cageActive = true; }, (v: SliceState) => { v.starMystic.practice.companionNode = 'MARK'; },
      (v: SliceState) => { v.starMystic.practice.playerNode = 'COURTYARD'; }, (v: SliceState) => { v.starMystic.cases['veiled-marker']!.contactOpen = true; },
      (v: SliceState) => { v.starMystic.cases['veiled-marker']!.status = 'PREPARED'; }, (v: SliceState) => { v.starMystic.cases['willing-cage']!.closes = 0; },
    ]) {
      const copy = fixture(); original(copy, 'IMPACT'); mutate(copy); const before = structuredClone(copy);
      expect(currentStarMysticCombatSource(copy)).toBeNull(); expect(() => resolveSliceCombatRound(copy, 'ATTACK')).toThrow(); expect(copy).toEqual(before);
    }
  });
});

describe('Star Mystic inherited originals and finite present focus', () => {
  it('burns real authorized maker6 and maker5 originals once using sealed original mastery, never stronger S5 budgets', () => {
    const s = fixture(true), impact = original(s, 'IMPACT', 6, 100), ward = original(s, 'WARD', 5, 500);
    s.progression.mastery[H] = 500; s.progression.mastery['hermit.s7.spellcraft'] = 500;
    const materials = structuredClone(s.scrollProfessor.workshop.materials), lessons = structuredClone(s.wizard);
    expect(effect(s, H).selfGain).toBe(38.025 * 0.72); expect(effect(s, B).enemyReduction).toBe(42.25);
    expect([impact.status, ward.status]).toEqual(['USED', 'USED']); expect([impact.makerSequence, ward.makerSequence]).toEqual([6, 5]); expect(s.spirituality).toBe(78);
    expect(effect(s, H).selfGain).toBe(38.025); expect(effect(s, B).enemyReduction).toBe(42.25); expect(s.spirituality).toBe(74);
    expect(s.scrollProfessor.workshop.materials).toEqual(materials); expect(s.wizard).toEqual(lessons); expect(s.scrollProfessor.workshop.scrolls).toHaveLength(2);
  });
  it('does not burn unauthorized, copied, malformed or unbacked originals, and never learns spells from mastery', () => {
    for (const mutate of [
      (_: SliceState, scroll: ScrollProfessorScroll) => { scroll.authorized = false; },
      (s: SliceState, scroll: ScrollProfessorScroll) => { s.scrollProfessor.workshop.scrolls.push({ ...scroll }); },
      (s: SliceState, scroll: ScrollProfessorScroll) => { s.scrollProfessor.workshop.scrolls.push({ ...scroll, id: 'scroll-professor-scroll-2' }); },
      (s: SliceState) => { s.scrollProfessor.workshop.materials[0]!.status = 'HELD'; },
      (s: SliceState) => { s.scrollProfessor.workshop.materials[0]!.spentWeek = null; },
      (_: SliceState, scroll: ScrollProfessorScroll) => { Object.assign(scroll, { makerSequence: 4 }); },
      (_: SliceState, scroll: ScrollProfessorScroll) => { scroll.inscriptionMastery = 501; },
    ]) {
      const s = fixture(), scroll = original(s, 'IMPACT'); mutate(s, scroll); s.progression.mastery[H] = 500; s.progression.mastery['hermit.s7.spellcraft'] = 500;
      const before = structuredClone(s); expect(effect(s, H, fixedRolls(), 0.8).selfGain).toBe(12 * 0.8); expect(s).toEqual(before);
    }
    const s = fixture(); s.town.clubLocation = 'HAND';
    expect(effect(s, H).selfGain).toBe(16); expect(effect(s, B).enemyReduction).toBe(10);
    const scroll = original(s, 'IMPACT'); expect(effect(s, H).selfGain).toBe(38.025); expect(scroll.status).toBe('USED');
  });
  it('requires real owned WORN lenses for3S2M focus, never repeats, and spends +5 once on actual K', () => {
    const s = fixture(), r = fixedRolls(57); const before = structuredClone(s);
    expect(effect(s, R, r)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(s.starMystic.practice.lenses).toBe('HELD'); expect(s.starMystic.encounter.focused).toBe(true); expect(s.spirituality).toBe(77); expect(s.mind).toBe(98);
    effect(s, R, r); expect(s.spirituality).toBe(77); expect(s.mind).toBe(98); expect(r.cursor).toBe(0);
    const cage = effect(s, K, r); expect(cage.label).toContain('阈值57'); expect(cage.threatens).toBe(false);
    expect(s.spirituality).toBe(74); expect(s.starMystic.practice.lenses).toBe('WORN'); expect(s.starMystic.encounter).toMatchObject({ focused: false, cageReady: true });
    expect(s.progression).toEqual(before.progression); expect(s.wizard).toEqual(before.wizard); expect(s.combat).toEqual(before.combat);
    effect(s, K, r); expect(s.spirituality).toBe(74); expect(r.cursor).toBe(1);
    finishStarMysticCombatRound(s); effect(s, K, fixedRolls(57)); expect(s.starMystic.encounter.cageReady).toBe(false); expect(s.spirituality).toBe(71);
  });
  it('no lens or insufficient resources only observes; cage can work without lenses and failure pays once', () => {
    const s = fixture(); s.starMystic.practice.lenses = 'SUPPLIER'; const before = structuredClone(s);
    effect(s, R); expect(s).toEqual(before); effect(s, K, fixedRolls(1)); expect(s.starMystic.encounter.cageReady).toBe(true); expect(s.starMystic.practice.lenses).toBe('SUPPLIER');
    finishStarMysticCombatRound(s); effect(s, K, fixedRolls(100)); expect(s.starMystic.encounter.cageReady).toBe(false); expect(s.spirituality).toBe(74);
    for (const resource of [0, 1, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      const dry = fixture(); dry.spirituality = resource; const snapshot = structuredClone(dry);
      effect(dry, R); effect(dry, K); expect(dry).toEqual(snapshot);
    }
    const tired = fixture(); tired.mind = 2; effect(tired, R); expect(tired.mind).toBe(2); expect(tired.spirituality).toBe(80);
  });
  it('only the next actual positive STRIKE is halved; no direct health damage, block suppression, stack or carryover', () => {
    const s = fixture(); effect(s, K, fixedRolls(1)); const c = structuredClone(s.combat);
    for (const [id, gain, suppressed] of [['BLOCK', 16, false], ['STRIKE', 0, false], ['STRIKE', -1, false], ['STRIKE', 16, true]] as const) expect(consumeStarMysticCage(s, id, gain, suppressed)).toBeNull();
    expect(s.starMystic.encounter.cageReady).toBe(true);
    expect(consumeStarMysticCage(s, 'STRIKE', 16)?.physicalMultiplier).toBe(0.5); expect(consumeStarMysticCage(s, 'STRIKE', 16)).toBeNull(); expect(s.combat).toEqual(c);
    effect(s, R); effect(s, K, fixedRolls(1)); finishStarMysticCombatRound(s);
    expect(s.starMystic.encounter).toMatchObject({ focused: false, cageReady: false }); expect(s.starMystic.practice.lenses).toBe('WORN'); expect(consumeStarMysticCage(s, 'STRIKE', 16)).toBeNull();
    effect(s, R); expect(finishStarMysticCombatRound(s)).toContain('戴回'); expect(s.spirituality).toBe(68); expect(s.mind).toBe(96);
  });
});

describe('Star Mystic shared rounds and irreversible outcomes', () => {
  it('uses inherited core10/30/25/35, tier900/floor90/max100 and continuing recovery10; A has no extra coin', () => {
    const s = fixture(); s.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 }; s.spirituality = 90;
    const result = recordedRound(s, 'ATTACK', 1, 1, ticket(A, 'ATTACK'), 400, 1);
    expect(result.round.playerAdvantage).toBe(928.5 - 22.5); expect(result.outcome).toBe('CONTINUE'); expect(s.spirituality).toBe(100); expect(result.round.consequenceWeights).toBeNull();
    const dry = fixture(); dry.spirituality = 0;
    expect(recordedRound(dry, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(915 * 0.8); expect(dry.spirituality).toBe(10);
    const cap = fixture(); cap.spirituality = 100; cap.starMystic.practice.lenses = 'SUPPLIER'; cap.character.coreStats = { physique: 1000, perception: 1000, will: 1000, knowledge: 1000 };
    expect(recordedRound(cap, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(1080);
    vi.spyOn(starCombat, 'resolveStarMysticCombatAbility').mockReturnValue({ label: 'controlled floor', selfGain: -10000, enemyReduction: 0, threatens: false });
    expect(recordedRound(fixture(), 'ATTACK', 1, 1, ticket(A, 'ATTACK'), 400, 1).round.playerAdvantage).toBe(90);
  });
  it('direct K uses no scroll and halves only its later strike, without permitting cage-only injury', () => {
    const s = fixture(), unused = original(s, 'IMPACT');
    const { round, outcome } = recordedRound(s, 'CONTROL', 1, 1, ticket(K, 'CONTROL'), 1, 1, 1);
    expect(outcome).toBe('CONTINUE'); expect(round.moves.map(m => m.selfGain)).toEqual([0, 8]); expect(round.moves[1]!.label).toContain('×0.5');
    expect(round.consequenceWeights).toBeNull(); expect(s.combat!.enemyHealth).toBe(100); expect(unused.status).toBe('HELD'); expect(s.spirituality).toBe(87); expect(s.starMystic.encounter.cageReady).toBe(false);
  });
  it('R then K waits through a real enemy block, consumes57% focus and halves the following actual strike', () => {
    const s = fixture(); const { round } = recordedRound(s, 'CONTROL', 13, 46, ticket(R, 'CONTROL'), 161, ticket(K, 'CONTROL'), 57, 1, 1);
    expect(round.moves.map(m => m.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY']); expect(round.moves[3]!.selfGain).toBe(8);
    expect(round.moves[2]!.label).toContain('阈值57'); expect(s.mind).toBe(98); expect(s.spirituality).toBe(84); expect(s.starMystic.practice.lenses).toBe('WORN');
  });
  it('pays1AP to arrive, preserves ordinary refusal and grants no talk reward', () => {
    const s = fixture(); s.combat = null; s.starMystic.encounter = { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, focused: false, cageReady: false };
    s.actionsRemaining = 2; applyStarMysticEncounter(s, { type: 'ENCOUNTER_TALK' }, context(100)); expect(s.actionsRemaining).toBe(1); expect(s.starMystic.encounter.status).toBe('AVAILABLE');
    expect(blockStarMysticEncounter(s, { type: 'ENCOUNTER_TALK' })).toContain('本周');
    applyStarMysticEncounter(s, { type: 'ENCOUNTER_FIGHT' }, context()); expect(s.actionsRemaining).toBe(0); expect(currentStarMysticCombatSource(s)).not.toBeNull();
    const peaceful = fixture(); peaceful.combat = null; peaceful.starMystic.encounter = { status: 'AVAILABLE', attemptWeek: null, startHistoryIndex: null, focused: false, cageReady: false };
    const before = structuredClone(peaceful.progression); applyStarMysticEncounter(peaceful, { type: 'ENCOUNTER_TALK' }, context()); expect(peaceful.starMystic.encounter.status).toBe('RESOLVED'); expect(peaceful.progression).toEqual(before);
  });
  it('ordinary first retreat preserves stock, costs and real exit; no regeneration or reward', () => {
    const s = fixture(), scroll = original(s, 'IMPACT'); s.spirituality = 61; const award = vi.fn();
    const result = recordedRound(s, 'RETREAT', 100, 100, 1); expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]); expect(result.round.consequence).toContain('布莱斯'); expect(result.round.consequence).toContain('实际原出口');
    settleStarMysticEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(s.spirituality).toBe(61); expect(scroll.status).toBe('HELD'); expect(s.starMystic.encounter.status).toBe('RETREATED'); expect(validateStarMysticEncounter(s)).toBe(true);
  });
  it('effective survival rewards once; original enemy death remains death and unused stock is not replenished', () => {
    for (const roll of [70, 100]) {
      const s = fixture(), scroll = original(s, 'IMPACT'), awards: [string, number][] = [];
      const result = recordedRound(s, 'ATTACK', 1, 1, ticket(H, 'ATTACK'), 400, 1, roll);
      expect(result.outcome).toBe(roll === 70 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD'); expect(result.round.consequence).toContain('布莱斯'); expect(s.spirituality).toBe(79);
      const health = s.combat!.enemyHealth;
      settleStarMysticEncounter(s, result.outcome, context(), (source, amount) => { awards.push([source, amount]); s.seer.completedSources.push(source); });
      expect(awards).toEqual([['star-mystic-dispute', 25]]); expect(scroll.status).toBe('USED'); expect(s.progression.acting).toBe(25); expect(s.combat).toBeNull(); expect(validateStarMysticEncounter(s)).toBe(true);
      if (roll === 100) expect(health).toBe(0); expect(() => settleStarMysticEncounter(s, result.outcome, context(), vi.fn())).toThrow();
    }
  });
  it('player death has no reward, resurrection or refund; forged terminal results are rejected', () => {
    const s = fixture(), award = vi.fn(); const result = recordedRound(s, 'ATTACK', 1, 1, ticket(R, 'ATTACK'), 1, 1000000, 100);
    expect(result.outcome).toBe('PLAYER_DEAD'); expect(result.round.consequence).toContain('布莱斯'); expect(s.health).toBe(0); expect(s.spirituality).toBe(77); expect(s.mind).toBe(98); expect(s.starMystic.practice.lenses).toBe('WORN'); s.status = 'DEAD';
    settleStarMysticEncounter(s, result.outcome, context(), award); expect(award).not.toHaveBeenCalled(); expect(s.starMystic.encounter.status).toBe('LOST'); expect(validateStarMysticEncounter(s)).toBe(true);
    const forged = fixture(); expect(() => settleStarMysticEncounter(forged, 'ENEMY_SURRENDERED', context(), vi.fn())).toThrow('不一致');
  });
  it('same state replays exactly with real original stock and no future draw inspection', () => {
    const s = fixture(true); original(s, 'IMPACT', 6, 100); original(s, 'WARD', 5, 200); const replay = structuredClone(s);
    expect(resolveSliceCombatRound(s, 'CONTROL')).toEqual(resolveSliceCombatRound(replay, 'CONTROL')); expect(s).toEqual(replay);
  });
});
