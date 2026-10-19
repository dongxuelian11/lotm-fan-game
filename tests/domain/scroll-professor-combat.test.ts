import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  SCROLL_PROFESSOR_COUNT_WHEEL, currentScrollProfessorCombatSource, drawScrollProfessorAbility,
  isScrollProfessor, resolveScrollProfessorCombatAbility, scrollProfessorAbilityWheel, scrollProfessorActionCount,
  type ScrollProfessorCombatSource, type ScrollProfessorMoveId,
} from '../../src/domain/scroll-professor/combat.js';
import * as scrollCombat from '../../src/domain/scroll-professor/combat.js';
import { WIZARD_COUNT_WHEEL, resolveWizardCombatAbility, wizardAbilityWheel } from '../../src/domain/wizard/combat.js';
import { COMBAT_SCHOLAR_COUNT_WHEEL, combatScholarAbilityWheel } from '../../src/domain/combat-scholar/combat.js';
import { PRYER_COUNT_WHEEL, pryerAbilityWheel } from '../../src/domain/pryer/combat.js';
import type { ScrollProfessorScroll } from '../../src/domain/scroll-professor/types.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'hermit.s6.scrollcraft', J = 'BODY_FOLLOWUP', B = 'BRIEF_WARD', K = 'BLUR_MARK';
const R = 'hermit.s9.ritual-lore', A = 'ACCIDENT';
const spellcraft = 'hermit.s7.spellcraft', training = 'hermit.s8.combat-study', vision = 'hermit.s9.spirit-vision';
const ids = [H, J, B, K, R, A] as const;

/** Synthetic paid arrival; actual workshop commands are covered by growth tests. */
function fixture(learned = false): SliceState {
  const state = createSliceRun('scroll-combat-test', sliceDefaultCreationSelection, 'scroll-combat');
  state.activeEvent = null; state.arc.stage = 'ENDED'; state.world.city = 'BACKLUND';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hermit', sequence: 6, acting: 0, promotionWeek: 1,
    mastery: { [H]: 0, [spellcraft]: 0, [training]: 0, [vision]: 0, [R]: 0, 'hermit.s9.occult-study': 0 } };
  for (const id of ['light-touch', 'brief-ward', 'blur-mark']) {
    state.wizard.lessons[id] = { learned, attemptWeek: learned ? state.week : null };
    if (learned) state.seer.completedSources.push(`wizard-learning:${id}`);
  }
  Object.assign(state.scrollProfessor.cases['paper-target']!, { status: 'RESOLVED', outcome: 'PAPER_VERIFIED', method: 'ORDINARY' });
  state.scrollProfessor.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length, attemptWeek: state.week };
  state.combat = { encounterId: 'SCROLL_PROFESSOR_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80; state.town.clubLocation = 'SHOP';
  return state;
}
function original(state: SliceState, kind: ScrollProfessorScroll['kind'], inscriptionMastery = 0,
  authorized = true): ScrollProfessorScroll {
  const workshop = state.scrollProfessor.workshop, n = workshop.scrolls.length + 1;
  const materialId = `scroll-professor-material-${n}`;
  workshop.materials.push({ id: materialId, acquiredWeek: state.week, status: 'SPENT', spentWeek: state.week });
  const scroll: ScrollProfessorScroll = { id: `scroll-professor-scroll-${n}`, kind, makerSequence: 6,
    inscriptionMastery, materialId, createdWeek: state.week, status: 'HELD', usedWeek: null, authorized };
  workshop.scrolls.push(scroll); workshop.craftAttempts += 1;
  workshop.kitsBought = Math.ceil(n / 4); workshop.lastKitWeek = state.week;
  return scroll;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-scroll-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: ScrollProfessorMoveId, physical = 1,
  source: ScrollProfessorCombatSource | null = currentScrollProfessorCombatSource(state), random = fixedRolls()) {
  return resolveScrollProfessorCombatAbility(state, id, physical, random, source);
}
function nextRound(state: SliceState): void {
  const round: SliceCombatRound = { round: state.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 665,
    enemyAdvantage: 114, winChance: 80, winner: 'PLAYER', consequence: '本轮没有有效致伤动作',
    consequenceWeights: null, retreat: 'NONE' };
  state.combatHistory.push(round); state.combat!.lastRound = round; state.combat!.round += 1;
}
/** Advance the real replay cursor, while making the relevant outcome explicit. */
function scriptRolls(...rolls: number[]) {
  const originalNext = DeterministicActionRandomStream.prototype.nextInt; let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    originalNext.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Scroll Professor exact S6 candidate profile', () => {
  it('routes only hermit6 to detached six18/14/16/14/30/8 and count30/32/25/13 wheels', () => {
    const state = fixture(); expect(isScrollProfessor(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(scrollProfessorAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([18, 14, 16, 14, 30, 8]);
    expect(playerCountWheel(state)).toEqual(SCROLL_PROFESSOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([30, 32, 25, 13]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(18); expect(playerCountWheel(state)[0]!.weight).toBe(30);
    state.progression.pathwayId = 'door'; expect(isScrollProfessor(state)).toBe(false);
  });

  it('preserves every count and stance ticket boundary with exactly one slot draw', () => {
    for (const [roll, count] of [[1, 1], [30, 1], [31, 2], [62, 2], [63, 3], [87, 3], [88, 4], [100, 4]]) {
      expect(scrollProfessorActionCount(roll!)).toBe(count);
    }
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2]
        : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [18, 14, 16, 14, 30, 8].map((x, index) => x * (boosted.includes(index) ? 5 : 4));
      const total = weights.reduce((sum, x) => sum + x, 0); let boundary = 0;
      scrollProfessorAbilityWheel(stance).forEach((entry, index) => {
        expect(entry.weight).toBe(total === 400 ? weights[index]! / 4 : weights[index]! / total * 100);
        const first = boundary + 1; boundary += weights[index]!;
        const random = fixedRolls(first, boundary);
        expect(drawScrollProfessorAbility(random, stance)).toBe(ids[index]);
        expect(drawScrollProfessorAbility(random, stance)).toBe(ids[index]); expect(random.cursor).toBe(2);
      });
    }
  });

  it('retains each original S9–S7 wheel, count and learned S7 budget', () => {
    const state = fixture(true);
    for (const [sequence, count, wheel] of [
      [9, PRYER_COUNT_WHEEL, pryerAbilityWheel], [8, COMBAT_SCHOLAR_COUNT_WHEEL, combatScholarAbilityWheel],
      [7, WIZARD_COUNT_WHEEL, wizardAbilityWheel],
    ] as const) {
      state.progression.sequence = sequence;
      expect(isScrollProfessor(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(count);
      expect(playerAbilityWheel(state, null)).toEqual(wheel(null, state));
      expect(currentScrollProfessorCombatSource(state)).toBeNull();
    }
    state.arc.stage = 'COMBAT'; state.combat!.encounterId = 'FIRST_CASE';
    state.world.carrierAlive = true; state.world.carrierCanResist = true;
    expect(resolveWizardCombatAbility(state, spellcraft, 1, fixedRolls()).selfGain).toBe(45 * 0.65);
  });
});

describe('Scroll Professor finite original scroll activation', () => {
  it('burns each authorized matching original once at1S using fixed inscription mastery, never current mastery', () => {
    const state = fixture(true), impact = original(state, 'IMPACT', 100), ward = original(state, 'WARD', 500);
    for (const id of Object.keys(state.progression.mastery)) state.progression.mastery[id] = 500;
    const before = structuredClone(state), random = fixedRolls();
    expect(resolve(state, H, 0, undefined, random)).toMatchObject({ selfGain: 38.025 * 0.72, enemyReduction: 0, threatens: true });
    expect(resolve(state, B, 0, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 42.25, threatens: false });
    for (const scroll of [impact, ward]) expect(scroll).toMatchObject({ status: 'USED', usedWeek: state.week, authorized: false });
    expect(state.spirituality).toBe(78); expect(random.cursor).toBe(0);
    expect(state.scrollProfessor.workshop.materials).toEqual(before.scrollProfessor.workshop.materials);
    expect(state.progression).toEqual(before.progression); expect(state.wizard).toEqual(before.wizard);
    expect(state.scrollProfessor.workshop.scrolls).toHaveLength(2);
    expect(resolve(state, H).selfGain).toBe(38.025); expect(resolve(state, B).enemyReduction).toBe(42.25);
    expect(state.spirituality).toBe(74); // The second pair are separately paid learned spells, not duplicate originals.
  });

  it('uses material-backed stored originals across weeks without rewriting sealed mastery', () => {
    const state = fixture(), impact = original(state, 'IMPACT', 200);
    state.week += 2; state.scrollProfessor.encounter.attemptWeek = state.week;
    state.progression.mastery[H] = 500;
    expect(resolve(state, H).selfGain).toBe(38.025 * (0.65 + 0.35 * 200 / 500));
    expect(impact.inscriptionMastery).toBe(200); expect(impact.createdWeek).toBe(state.week - 2);
    expect(impact.usedWeek).toBe(state.week); expect(state.spirituality).toBe(79);
  });

  it('does not choose an unauthorized original, a wrong-kind original or a second copy of the same material', () => {
    const mutations: ((state: SliceState, scroll: ScrollProfessorScroll) => void)[] = [
      (_, scroll) => { scroll.authorized = false; }, (_, scroll) => { scroll.kind = 'WARD'; },
      (_, scroll) => { scroll.status = 'USED'; scroll.usedWeek = 1; },
      (state, scroll) => { state.scrollProfessor.workshop.scrolls.push({ ...scroll }); },
      (state, scroll) => { state.scrollProfessor.workshop.scrolls.push({ ...scroll, id: 'scroll-professor-scroll-2' }); },
      (state) => { state.scrollProfessor.workshop.materials.length = 0; },
      (state) => { state.scrollProfessor.workshop.materials[0]!.status = 'HELD'; },
      (state) => { state.scrollProfessor.workshop.materials[0]!.spentWeek = null; },
      (state) => { state.scrollProfessor.workshop.materials.push({ ...state.scrollProfessor.workshop.materials[0]! }); },
      (_, scroll) => { scroll.id = ''; }, (_, scroll) => { scroll.createdWeek = 999; },
      (_, scroll) => { Object.assign(scroll, { makerSequence: 7 }); },
      (_, scroll) => { Object.assign(scroll, { authorized: undefined }); },
      (state, scroll) => { scroll.materialId = ''; state.scrollProfessor.workshop.materials[0]!.id = ''; },
      (_, scroll) => { scroll.inscriptionMastery = Number.NaN; }, (_, scroll) => { scroll.inscriptionMastery = 501; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), scroll = original(state, 'IMPACT', 500); mutate(state, scroll);
      const before = structuredClone(state);
      expect(resolve(state, H, 0.8).selfGain).toBe(12 * 0.8);
      expect(state).toEqual(before);
    }
  });

  it('only consumes selected originals, in existing order, without granting authorizations or refilling stock', () => {
    const state = fixture(), held = original(state, 'IMPACT', 0, false);
    const selected = original(state, 'IMPACT', 100, true), ward = original(state, 'WARD', 500, true);
    expect(resolve(state, H).selfGain).toBe(38.025 * 0.72);
    expect(selected.status).toBe('USED'); expect(held.status).toBe('HELD'); expect(held.authorized).toBe(false);
    expect(ward.status).toBe('HELD');
    expect(resolve(state, H).selfGain).toBe(12); expect(state.spirituality).toBe(79);
    expect(state.scrollProfessor.workshop.scrolls).toHaveLength(3);
  });

  it('with no learned spells, mastery alone never teaches H/B/K and each fallback pays only its actual cost', () => {
    const state = fixture();
    for (const id of Object.keys(state.progression.mastery)) state.progression.mastery[id] = 500;
    for (const lesson of Object.values(state.wizard.lessons)) lesson.attemptWeek = state.week;
    const before = structuredClone(state);
    expect(resolve(state, H, 0.8).selfGain).toBe(12 * 0.8);
    expect(resolve(state, J, 0.8).selfGain).toBe(20.475 * 0.8);
    expect(resolve(state, B, 0.8).enemyReduction).toBe(21.125);
    expect(resolve(state, K, 0.8).enemyReduction).toBe(18.9 * 0.8);
    before.spirituality -= 1; expect(state).toEqual(before);
  });

  it('uses learned H38.025/B42.25/K22.75 with only actual spellcraft and2S per independent action', () => {
    for (const mastery of [0, 100, 500]) {
      const state = fixture(true); state.progression.mastery[spellcraft] = mastery;
      state.progression.mastery[H] = 500; state.progression.mastery[training] = 500;
      state.progression.mastery[vision] = 500;
      const before = structuredClone(state), factor = 0.65 + 0.35 * mastery / 500;
      expect(resolve(state, H, 0).selfGain).toBe(38.025 * factor);
      expect(resolve(state, B, 0).enemyReduction).toBe(42.25 * factor);
      expect(resolve(state, K, 0).enemyReduction).toBe(22.75 * factor);
      expect(resolve(state, J, 0.8).selfGain).toBe(20.475 * 0.8);
      before.spirituality -= 6; expect(state).toEqual(before);
    }
  });

  it('handles low/fractional/nonfinite spirituality without spending missing originals or overdrawing', () => {
    for (const spirituality of [0, 0.5, 1, 1.5, 2, Number.NaN, Number.POSITIVE_INFINITY]) {
      for (const id of [H, B, K] as const) {
        const state = fixture(true); state.spirituality = spirituality;
        const scroll = original(state, id === B ? 'WARD' : 'IMPACT', 500);
        state.progression.mastery[training] = 500;
        const canScroll = id !== K && Number.isFinite(spirituality) && spirituality >= 1;
        const canSpell = Number.isFinite(spirituality) && spirituality >= 2;
        const effect = resolve(state, id, 0.8);
        expect(id === H ? effect.selfGain : effect.enemyReduction).toBe(id === H
          ? canScroll ? 38.025 : 12 * 0.8
          : id === B ? canScroll ? 42.25 : 10 * 0.8
          : canSpell ? 22.75 * 0.65 : 18.9 * 0.8);
        expect(state.spirituality).toBe(canScroll ? spirituality - 1 : id === K && canSpell ? spirituality - 2 : spirituality);
        expect(scroll.status).toBe(canScroll ? 'USED' : 'HELD');
      }
    }
    const state = fixture(true); state.spirituality = 1;
    expect(resolve(state, B).enemyReduction).toBe(21.125 * 0.65); expect(state.spirituality).toBe(0);
  });

  it('only Town HAND replaces H with16physical and leaves even an authorized original untouched', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(true), scroll = original(state, 'IMPACT', 500); state.town.clubLocation = location;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      expect(resolve(state, H, 0.8).selfGain).toBe(location === 'HAND' ? 16 * 0.8 : 38.025);
      expect(state.spirituality).toBe(location === 'HAND' ? 80 : 79);
      expect(scroll.status).toBe(location === 'HAND' ? 'HELD' : 'USED');
      if (location === 'HAND') expect(playerAbilityWheel(state, null)[0]!.label).toContain('不燃毁卷轴');
    }
  });

  it('R only inspects current originals and A is fixed−16.25 with no sign draw, stock change or extra attack', () => {
    const state = fixture(true); original(state, 'IMPACT', 500); original(state, 'WARD', 500, false);
    const before = structuredClone(state), random = fixedRolls();
    for (let n = 0; n < 4; n++) {
      const preparation = resolve(state, R, 1, undefined, random);
      expect(preparation).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(preparation.label).toContain('scroll-professor-scroll-1');
      expect(preparation.label).not.toContain('scroll-professor-scroll-2');
      expect(resolve(state, A, 1, undefined, random)).toMatchObject({ selfGain: -16.25, enemyReduction: 0, threatens: false });
    }
    expect(random.cursor).toBe(0); expect(state).toEqual(before);
  });
});

describe('Scroll Professor current encounter provenance', () => {
  it('binds source to current run, revision, week, history, round and the single reachable adult', () => {
    const state = fixture(), source = currentScrollProfessorCombatSource(state);
    expect(source).toMatchObject({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'SCROLL_PROFESSOR_DISPUTE', target: 'KARL_SINGLE_ADULT_ORDINARY_HUMAN',
      weapon: 'KARLS_OWN_ORDINARY_SHORT_CLUB', body: 'CURRENT_REACHABLE_BODY', distanceMetres: 2,
      bystanders: 'NONE', pursuit: false });
    for (const mutation of [
      (s: SliceState) => { s.revision += 1; }, (s: SliceState) => { s.runId += '-other'; },
      (s: SliceState) => { s.week += 1; s.scrollProfessor.encounter.attemptWeek = s.week; },
      (s: SliceState) => nextRound(s),
    ]) {
      const copy = structuredClone(state); original(copy, 'IMPACT', 500); mutation(copy);
      const before = structuredClone(copy), random = fixedRolls();
      for (const id of ids) expect(resolve(copy, id, 1, source, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(copy).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('rejects stale arrival, pending contact, foreign scene, missing history and nonliving body before any draw or burn', () => {
    for (const mutate of [
      (s: SliceState) => { s.progression.sequence = 7; }, (s: SliceState) => { s.progression.pathwayId = 'door'; },
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.mind = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyHealth = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.combat!.enemyMind = 0; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.combat!.encounterId = 'FIRST_CASE'; s.arc.stage = 'COMBAT'; },
      (s: SliceState) => { s.world.city = 'ELSEWHERE'; }, (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.scrollProfessor.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.scrollProfessor.encounter.attemptWeek = null; },
      (s: SliceState) => { s.scrollProfessor.encounter.startHistoryIndex = null; },
      (s: SliceState) => { s.scrollProfessor.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.scrollProfessor.cases['paper-target']!.contactOpen = true; },
      (s: SliceState) => { s.scrollProfessor.cases['soft-ward']!.status = 'PREPARED'; },
      (s: SliceState) => { s.scrollProfessor.cases['paper-target']!.status = 'AVAILABLE'; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.retreat = 'SUCCESS'; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.round = 3; },
    ]) {
      const state = fixture(true); original(state, 'IMPACT', 500); original(state, 'WARD', 500);
      mutate(state); const before = structuredClone(state), random = fixedRolls();
      expect(currentScrollProfessorCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolve(state, id, 1, undefined, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
  });
});

describe('Scroll Professor uses shared complete rounds', () => {
  it('uses core10/30/25/35, tier650/cap130/floor65, max80 and continuation recovery8', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 72;
    scriptRolls(1, 1, 281, 400, 1);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe('CONTINUE'); expect(result.round.playerAdvantage).toBe(678.5);
    expect(state.spirituality).toBe(80); vi.restoreAllMocks();
    const dry = fixture(); dry.spirituality = 0;
    scriptRolls(1, 1, 281, 400, 1);
    expect(resolveSliceCombatRound(dry, 'ATTACK').round.playerAdvantage).toBe(665 * 0.8);
    expect(dry.spirituality).toBe(8); vi.restoreAllMocks();
    const cap = fixture(); cap.spirituality = 79;
    cap.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    scriptRolls(1, 1, 281, 400, 1);
    expect(resolveSliceCombatRound(cap, 'ATTACK').round.playerAdvantage).toBe(780);
    expect(cap.spirituality).toBe(80); vi.restoreAllMocks();
    vi.spyOn(scrollCombat, 'resolveScrollProfessorCombatAbility').mockReturnValue({
      label: 'controlled negative budget', selfGain: -10_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 281, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(65);
  });

  it('burns once in a four-slot round, falls back independently, keeps all three enemy actions and common injury', () => {
    const state = fixture(true), impact = original(state, 'IMPACT', 500), ward = original(state, 'WARD', 500);
    state.spirituality = 70;
    const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 1, 1, 161, 1, 281, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([4, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[38.025, 0], [38.025 * 0.65, 0], [0, 42.25], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(665 + (38.025 + 38.025 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - 42.25);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(74); expect([impact.status, ward.status]).toEqual(['USED', 'USED']);
    expect(state.scrollProfessor.workshop.materials).toEqual(before.scrollProfessor.workshop.materials);
    expect(state.progression).toEqual(before.progression); expect(state.wizard).toEqual(before.wizard);
    expect(draws).toHaveBeenCalledTimes(11); expect(state.random.cursor).toBe(11);
  });

  it('fixed negative A does not consume an extra random coin or create an injury threat', () => {
    const state = fixture(); const before = structuredClone(state);
    const draws = scriptRolls(1, 1, 432, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: -16.25, enemyReduction: 0 });
    expect(round.playerAdvantage).toBe(665 - 16.25); expect(round.consequenceWeights).toBeNull();
    expect(state.combat!.enemyHealth).toBe(100); expect(state.scrollProfessor).toEqual(before.scrollProfessor);
    expect(draws).toHaveBeenCalledTimes(5); expect(state.random.cursor).toBe(5);
  });

  it('ordinary successful retreat preserves unused stock, ends future enemy attacks and gives no regeneration', () => {
    const state = fixture(), scroll = original(state, 'IMPACT', 500); state.spirituality = 61;
    const before = structuredClone(state.scrollProfessor.workshop), draws = scriptRolls(100, 100, 1);
    const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.moves).toEqual([]);
    expect(result.round.consequence).toContain('原普通出口'); expect(result.round.consequence).toContain('没有瞬移或进入追逐');
    expect(state.scrollProfessor.workshop).toEqual(before); expect(scroll.status).toBe('HELD');
    expect(state.spirituality).toBe(61); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('replays same-state rounds exactly, including finite originals and cursor', () => {
    const state = fixture(true); original(state, 'IMPACT', 100); original(state, 'WARD', 200);
    const replay = structuredClone(state);
    expect(resolveSliceCombatRound(state, 'ATTACK')).toEqual(resolveSliceCombatRound(replay, 'ATTACK'));
    expect(state).toEqual(replay);
  });
});
