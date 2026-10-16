import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import {
  APPRAISER_COUNT_WHEEL, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel,
  playerAbilityWheel, playerCountWheel, resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import { currentArtisanCombatSource, isArtisan } from '../../src/domain/artisan/combat.js';
import { applyArtisanEncounter, ARTISAN_ENCOUNTER_STORY } from '../../src/domain/artisan/encounter.js';
import { createArtisanState } from '../../src/domain/artisan/index.js';
import { ARTISAN_ABILITY_IDS } from '../../src/domain/artisan/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

/** Combat-only fixture. Promotion/material provenance is covered by the stage tests. */
function fixture(): SliceState {
  const state = createSliceRun('artisan-combat-test', sliceDefaultCreationSelection, 'artisan-combat');
  state.activeEvent = null;
  state.arc.stage = 'ENDED';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'paragon', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  state.artisan = createArtisanState();
  state.artisan.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week };
  state.combat = { encounterId: 'ARTISAN_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}

/** Prescribe choices while retaining the real deterministic stream and cursor consumption. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum);
    expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}

function encounterContext(): SeerContext {
  return { note: vi.fn(), roll: () => { throw new Error('A visit does not roll'); },
    check: () => { throw new Error('Starting a fight does not roll a negotiation'); } };
}

afterEach(() => vi.restoreAllMocks());

describe('Artisan S6 ordinary combat continuation', () => {
  it('inherits all S7 count sectors while ordinary foes retain their three-count template', () => {
    const state = fixture();
    expect(isArtisan(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(APPRAISER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 20, 15, 5]);
    const projected = playerCountWheel(state); projected[0]!.weight = 0;
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
    scriptRolls(96, 86, ...Array<number>(9).fill(400), 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect(outcome).toBe('CONTINUE');
    expect([round.playerCount, round.enemyCount]).toEqual([6, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(state.random.cursor).toBe(12);
    expect(ORDINARY_COUNT_WHEEL.map(entry => entry.weight)).toEqual([45, 40, 15]);
  });

  it('uses finite core30/25/30/15, tier450, capped core90 and the existing maximum status penalty', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 400, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.playerAdvantage).toBe(473);
    expect(round.enemyAdvantage).toBe(114);
    expect(round.winChance).toBeCloseTo(473 / 587 * 100);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 400, 400, 1);
    expect(resolveSliceCombatRound(capped, 'PREPARE').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16);
  });

  it('keeps every ordinary stance and resolves the same five published moves without manufacturing', () => {
    const state = fixture();
    state.progression.mastery = Object.fromEntries(ARTISAN_ABILITY_IDS.map(id => [id, 500]));
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(ordinaryAbilityWheel(false, stance));
    }
    expect(playerAbilityWheel(state, null).map(entry => entry.id))
      .toEqual(['STRIKE', 'BLOCK', 'OPENING', 'DISTANCE', 'MISS']);
    const before = structuredClone(state);
    scriptRolls(96, 1, 1, 400, 161, 241, 321, 400, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.label))
      .toEqual(['普通打击', '格挡护身', '寻找空当', '拉开距离', '动作落空', '普通打击']);
    expect(round.playerAdvantage).toBe(497);
    expect(round.enemyAdvantage).toBe(96);
    expect(state.progression).toEqual(before.progression);
    expect(state.artisan).toEqual(before.artisan);
    expect(state.town).toEqual(before.town);
    expect(state.world).toEqual(before.world);
    expect(state.character).toEqual(before.character);
  });

  it.each(['SHOP', 'BAG', 'HAND'] as const)('uses only the original ordinary club in HAND, not %s custody as a new item', location => {
    const state = fixture(); state.town.clubLocation = location;
    const town = structuredClone(state.town);
    scriptRolls(1, 1, 1, 400, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves[0]).toEqual({ actor: 'PLAYER', label: location === 'HAND' ? '短棍打击' : '普通打击',
      selfGain: location === 'HAND' ? 16 : 12, enemyReduction: 0 });
    expect(playerAbilityWheel(state, null)[0]!.label)
      .toBe(location === 'HAND' ? '持握原短棍打击' : '普通打击');
    expect(state.town).toEqual(town);
    expect(state.combat!.enemyHealth).toBe(90);
  });

  it.each([null, 'PLAYER', 'CLIENT'] as const)('never converts the %s lamp into an attack, control, defence or material source', location => {
    const state = fixture();
    if (location) state.artisan.workshop.lamp = { id: 'ART6-LAMP-1', createdWeek: state.week, charges: 3, location };
    const workshop = structuredClone(state.artisan.workshop);
    expect(playerAbilityWheel(state, null)).toEqual(ordinaryAbilityWheel(false, null));
    scriptRolls(1, 1, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves).toEqual([
      { actor: 'PLAYER', label: '普通打击', selfGain: 12, enemyReduction: 0 },
      { actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 },
    ]);
    expect(state.artisan.workshop).toEqual(workshop);
  });

  it('blocks daily manufacturing and buying materials while a real fight is active, without any mutation', () => {
    const state = fixture();
    for (const command of [{ type: 'BUY_KIT' },
      { type: 'PREPARE', caseId: 'limited-fabrication', method: 'ABILITY' },
      { type: 'PERFORM', caseId: 'limited-fabrication' },
      { type: 'PERFORM', caseId: 'client-handover' }] as const) {
      const before = structuredClone(state);
      expect(() => applySliceIntent(state, { type: 'ARTISAN', command })).toThrow();
      expect(state).toEqual(before);
    }
  });

  it('preserves the S7/S8/S9 counts, core weights, ordinary effects and resource ceilings', () => {
    for (const [sequence, maximum, advantage] of [[7, 60, 476], [8, 45, 325], [9, 30, 225]] as const) {
      const state = fixture(); state.progression.sequence = sequence;
      state.combat!.encounterId = 'FIRST_CASE'; state.arc.stage = 'COMBAT';
      state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
      state.spirituality = maximum - 1;
      expect(isArtisan(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(sequence === 7 ? APPRAISER_COUNT_WHEEL : ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'PREPARE')).toEqual(ordinaryAbilityWheel(false, 'PREPARE'));
      scriptRolls(1, 1, 400, 400, 1);
      expect(resolveSliceCombatRound(state, 'PREPARE').round.playerAdvantage).toBe(advantage);
      expect(state.spirituality).toBe(maximum);
      vi.restoreAllMocks();
    }
  });

  it.each([[0, 8], [40, 48], [72, 80], [79, 80], [80, 80]])('recovers %s to %s only after a complete continuing round', (before, after) => {
    const state = fixture(); state.spirituality = before;
    scriptRolls(1, 1, 400, 400, 1);
    expect(resolveSliceCombatRound(state, 'PREPARE').outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(after);
  });

  it('uses the real one-AP visit producer and its new adult scene even after the old carrier died', () => {
    const state = fixture(); state.combat = null;
    state.artisan.encounter = { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null };
    state.artisan.cases['reading-diagram']!.status = 'RESOLVED';
    state.world.carrierAlive = false; state.world.carrierCanResist = false;
    const world = structuredClone(state.world), actions = state.actionsRemaining;
    expect(currentArtisanCombatSource(state)).toBeNull();
    applyArtisanEncounter(state, { type: 'ENCOUNTER_FIGHT' }, encounterContext());
    expect(state.actionsRemaining).toBe(actions - 1);
    expect(currentArtisanCombatSource(state)).toEqual({ encounterId: 'ARTISAN_DISPUTE', round: 1,
      attemptWeek: state.week, startHistoryIndex: state.combatHistory.length,
      target: 'DEVIN_SINGLE_ADULT', weapon: 'DEVINS_ORDINARY_SHORT_CLUB',
      space: 'ORIGINAL_WORKSHOP_OUTER_COURTYARD', distanceMetres: 2,
      ground: 'ORDINARY', bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    expect(ARTISAN_ENCOUNTER_STORY).toContain('成年');
    expect(ARTISAN_ENCOUNTER_STORY).toContain('德文');
    expect(ARTISAN_ENCOUNTER_STORY).toContain('2米');
    expect(JSON.stringify(projectSliceState(state).combat)).toContain('德文');
    expect(state.world).toEqual(world);
  });

  it('rejects fabricated, stale and inactive courtyard contexts before consuming a random draw', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.artisan.encounter.status = 'AVAILABLE'; },
      state => { state.artisan.encounter.attemptWeek = null; },
      state => { state.artisan.encounter.attemptWeek = state.week - 1; },
      state => { state.artisan.encounter.startHistoryIndex = null; },
      state => { state.artisan.encounter.startHistoryIndex = -1; },
      state => { state.artisan.encounter.startHistoryIndex = 1; },
      state => { state.combat!.round = 2; },
      state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.enemyHealth = 0; },
      state => { state.world.city = 'ELSEWHERE'; },
      state => { state.progression.sequence = 7; },
      state => { state.health = 0; },
      state => { state.status = 'DEAD'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(); mutate(state);
      const before = structuredClone(state);
      expect(currentArtisanCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'PREPARE')).toThrow();
      expect(state).toEqual(before);
    }
    const old = fixture(); old.combat!.encounterId = 'FIRST_CASE';
    expect(currentArtisanCombatSource(old)).toBeNull();
  });

  it.each([
    ['ENEMY_SURRENDERED', 66], ['ENEMY_DEAD', 96],
  ] as const)('keeps %s real, names Devin, grants no terminal recovery and transfers no original item', (outcome, consequenceRoll) => {
    const state = fixture(); state.spirituality = 30;
    state.world.carrierAlive = false; state.world.carrierCanResist = false;
    const world = structuredClone(state.world), town = structuredClone(state.town), workshop = structuredClone(state.artisan.workshop);
    scriptRolls(1, 1, 1, 400, 1, consequenceRoll);
    const result = resolveSliceCombatRound(state, 'PREPARE');
    expect(result.outcome).toBe(outcome);
    expect(result.round.consequence).toContain('德文');
    expect(result.round.consequence).not.toMatch(/携铃者|箱子|罗温/);
    expect(state.combat!.enemyHealth).toBe(outcome === 'ENEMY_DEAD' ? 0 : 70);
    expect(state.combat!.enemyStatus).toBe(outcome === 'ENEMY_DEAD' ? 'DEAD' : 'SURRENDERED');
    expect(state.spirituality).toBe(30);
    expect(state.world).toEqual(world); expect(state.town).toEqual(town);
    expect(state.artisan.workshop).toEqual(workshop);
  });

  it('retains an ordinary enemy strike and actual player death without lamp rescue', () => {
    const state = fixture(); state.spirituality = 30;
    state.artisan.workshop.lamp = { id: 'ART6-LAMP-1', createdWeek: state.week, charges: 3, location: 'PLAYER' };
    const workshop = structuredClone(state.artisan.workshop);
    scriptRolls(1, 1, 400, 1, 1_000_000, 96);
    const result = applySliceIntent(state, { type: 'COMBAT_ROUND', stance: 'PREPARE' });
    expect(result.status).toBe('DEAD'); expect(result.health).toBe(0);
    expect(result.artisan.encounter.status).toBe('LOST'); expect(result.combat).toBeNull();
    expect(result.lastCombatRound!.moves[1]).toEqual({ actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 });
    expect(result.artisan.workshop).toEqual(workshop);
    expect(result.spirituality).toBe(30);
  });

  it('actually retreats through the original exit without pursuit, recovery, crafting or transferred items', () => {
    const state = fixture(); state.spirituality = 30;
    const world = structuredClone(state.world), town = structuredClone(state.town);
    scriptRolls(1, 1, 1);
    const result = applySliceIntent(state, { type: 'COMBAT_ROUND', stance: 'RETREAT' });
    expect(result.artisan.encounter.status).toBe('RETREATED'); expect(result.combat).toBeNull();
    expect(result.lastCombatRound!.retreat).toBe('SUCCESS');
    expect(result.lastCombatRound!.consequence).toContain('德文');
    expect(result.lastCombatRound!.moves).toEqual([]);
    expect(result.world).toEqual(world); expect(result.town).toEqual(town);
    expect(result.spirituality).toBe(30); expect(result.health).toBe(100);
  });

  it('replays a complete deterministic courtyard battle and maintains the exact history-bound source each round', () => {
    const play = () => {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const rounds: SliceCombatRound[] = [];
      let outcome: ReturnType<typeof resolveSliceCombatRound>['outcome'] = 'CONTINUE';
      while (outcome === 'CONTINUE' && rounds.length < 100) {
        expect(currentArtisanCombatSource(state)).not.toBeNull();
        const result = resolveSliceCombatRound(state, 'ATTACK');
        rounds.push(structuredClone(result.round)); state.combatHistory.push(structuredClone(result.round));
        outcome = result.outcome;
      }
      expect(outcome).not.toBe('CONTINUE');
      expect(rounds.length).toBeGreaterThan(0);
      expect(rounds.every(round => round.playerCount >= 1 && round.playerCount <= 6 &&
        round.enemyCount >= 1 && round.enemyCount <= 3 && round.playerAdvantage >= 45)).toBe(true);
      expect(rounds.flatMap(round => round.moves).every(move =>
        ['短棍打击', '格挡护身', '寻找空当', '拉开距离', '动作落空'].includes(move.label))).toBe(true);
      expect(state.town.clubLocation).toBe('HAND'); expect(state.progression.mastery).toEqual({});
      expect(state.spirituality).toBeLessThanOrEqual(80);
      return { state, rounds, outcome };
    };
    expect(play()).toEqual(play());
  });
});
