import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import {
  ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound,
} from '../../src/domain/slice/combat.js';
import {
  VAMPIRE_COUNT_WHEEL, currentPotionProfessorCombatSource, currentVampireBodySource,
  drawVampireAbility, isVampire, resolveVampireCombatAbility, vampireAbilityWheel,
  vampireActionCount, type VampireBodySource, type VampireMoveId,
} from '../../src/domain/vampire/combat.js';
import { createPotionProfessorState } from '../../src/domain/potion-professor/index.js';
import { applyPotionProfessorEncounter, POTION_PROFESSOR_ENCOUNTER_STORY } from '../../src/domain/potion-professor/encounter.js';
import { POTION_PROFESSOR_ABILITY_IDS, POTION_PROFESSOR_ASSISTANCE_KINDS } from '../../src/domain/potion-professor/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

/** Combat fixture only. Promotion provenance and actual brewing belong to stage tests. */
function fixture(): SliceState {
  const state = createSliceRun('potion-professor-combat-test', sliceDefaultCreationSelection, 'potion-professor-combat');
  state.activeEvent = null;
  state.arc.stage = 'ENDED';
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'moon', sequence: 6, mastery: {}, acting: 0, promotionWeek: 1 };
  state.potionProfessor = createPotionProfessorState();
  state.potionProfessor.encounter = { status: 'FIGHTING', startHistoryIndex: state.combatHistory.length,
    attemptWeek: state.week };
  state.combat = { encounterId: 'POTION_PROFESSOR_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 80;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function encounterContext(): SeerContext {
  return { note: vi.fn(), roll: () => { throw new Error('A visit does not roll'); },
    check: () => { throw new Error('Starting a fight does not roll a negotiation'); } };
}
/** Override values while consuming the real deterministic stream, one draw per actual action. */
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
function carryAssistance(state: SliceState) {
  state.potionProfessor.laboratory.potions = POTION_PROFESSOR_ASSISTANCE_KINDS.map((kind, index) => ({
    id: `combat-fixture-assistance-${index + 1}`, kind, source: 'Explicit combat-only prepared-potion fixture',
    brewedWeek: state.week, status: 'PLAYER', usedWeek: null,
  }));
}
afterEach(() => vi.restoreAllMocks());

const inherited = ['moon.s7.abyss-shackles', 'moon.s7.dark-wings', 'moon.s7.regeneration'] as const;

describe('Potion Professor S6 finite inherited combat', () => {
  it('publishes the exact S7 wheel and count distribution with no S6 daily medicine or teaching slot', () => {
    const state = fixture();
    state.progression.mastery = Object.fromEntries(POTION_PROFESSOR_ABILITY_IDS.map(id => [id, 500]));
    expect(isVampire(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(VAMPIRE_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 15, 5]);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      expect(playerAbilityWheel(state, stance)).toEqual(vampireAbilityWheel(stance));
    }
    const wheel = playerAbilityWheel(state, null);
    expect(wheel.map(entry => entry.id)).toEqual(['STRIKE', 'BLOCK', 'DISTANCE', ...inherited, 'MISS']);
    expect(wheel.map(entry => entry.weight)).toEqual([25, 15, 10, 20, 15, 10, 5]);
    expect(wheel.some(entry => /s6|s5|potion|teaching|sun-water|claw|bat|summon/.test(entry.id))).toBe(false);
    wheel[0]!.weight = 0;
    const count = playerCountWheel(state); count[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(25);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('uses the published ability tickets and all count boundaries without a second medicine draw', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [95, 5], [96, 6], [100, 6]]) {
      expect(vampireActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of vampireAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      scriptRolls(first, boundary);
      const random = stream(fixture());
      expect(drawVampireAbility(random, null)).toBe(entry.id);
      expect(drawVampireAbility(random, null)).toBe(entry.id);
      expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    const state = fixture();
    scriptRolls(100, 100, ...Array<number>(9).fill(400), 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([6, 3]);
    expect(round.moves).toHaveLength(9);
    expect(ORDINARY_COUNT_WHEEL.map(entry => entry.weight)).toEqual([45, 40, 15]);
    expect(state.random.cursor).toBe(12);
  });

  it('uses core30/25/30/15 and tier450 with capped core90, the ordinary foe and no S6 multiplier', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 425, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(473);
    expect(round.enemyAdvantage).toBe(114);
    expect(round.winChance).toBeCloseTo(473 / 587 * 100);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 8;
    scriptRolls(1, 1, 425, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(16);
  });

  it.each([[0, 8], [40, 48], [72, 80], [79, 80], [80, 80]])('recovers %s to %s only on CONTINUE', (before, after) => {
    const state = fixture(); state.spirituality = before;
    scriptRolls(1, 1, 425, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(after);
  });

  it.each(['SHOP', 'BAG', 'HAND'] as const)('keeps ordinary body and real held-club effects at %s custody', location => {
    const state = fixture(); state.town.clubLocation = location;
    const before = structuredClone(state), random = stream(state);
    expect(resolveVampireCombatAbility(state, 'STRIKE', 0.8, random)).toMatchObject({
      selfGain: (location === 'HAND' ? 16 : 12) * 0.8, enemyReduction: 0, threatens: true,
    });
    expect(resolveVampireCombatAbility(state, 'BLOCK', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    expect(resolveVampireCombatAbility(state, 'DISTANCE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 8, threatens: false });
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it.each([false, true])('never auto-uses or borrows effects from assistance inventory (carrying=%s)', carrying => {
    const state = fixture(); if (carrying) carryAssistance(state);
    const laboratory = structuredClone(state.potionProfessor.laboratory);
    expect(playerAbilityWheel(state, null)).toEqual(vampireAbilityWheel(null));
    scriptRolls(1, 1, 1, 1, 1, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves).toEqual([
      { actor: 'PLAYER', label: '普通打击', selfGain: 12, enemyReduction: 0 },
      { actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 },
    ]);
    expect(state.potionProfessor.laboratory).toEqual(laboratory);
    expect(state.spirituality).toBe(80);
  });

  it('rejects daily medicine, teaching and S5 moonlight actions without costs or free effects', () => {
    const state = fixture(); carryAssistance(state);
    for (const id of [...POTION_PROFESSOR_ABILITY_IDS, 'moon.s5.full-moon', 'moon.s5.moonlight-form',
      'moon.s5.teleport-reassembly', 'moon.s6.sun-water']) {
      const before = structuredClone(state), random = stream(state);
      expect(resolveVampireCombatAbility(state, id as VampireMoveId, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    Object.assign(state.progression, { sequence: 0 }); // S4 through S1 have dedicated routes; S0 remains unsupported runtime input.
    expect(isVampire(state)).toBe(false);
    expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, null)).toEqual(ordinaryAbilityWheel(false, null));
    expect(resolveVampireCombatAbility(state, 'moon.s7.dark-wings', 1, stream(state)).enemyReduction).toBe(0);
  });

  it('blocks brewing, buying and self-administering daily preparations while this fight is active', () => {
    const state = fixture(); carryAssistance(state);
    for (const command of [{ type: 'BUY_KIT' }, { type: 'BREW_ASSISTANCE', kind: 'QUIET_STEP' },
      { type: 'PREPARE', caseId: 'quiet-passage', method: 'ABILITY' },
      { type: 'PERFORM', caseId: 'separate-signals' }] as const) {
      const before = structuredClone(state);
      expect(() => applySliceIntent(state, { type: 'POTION_PROFESSOR', command })).toThrow();
      expect(state).toEqual(before);
    }
  });

  it('retains S7 original core20/30/30/20, max60/recovery6 and all old move numbers', () => {
    const state = fixture(); state.progression.sequence = 7;
    state.combat!.encounterId = 'VAMPIRE_DISPUTE';
    Object.assign(state.vampire.encounter, { status: 'FIGHTING', observed: true,
      startHistoryIndex: state.combatHistory.length, attemptWeek: state.week });
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 59;
    expect(isVampire(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(VAMPIRE_COUNT_WHEEL);
    expect(currentVampireBodySource(state)?.target).toBe('BROOK_SINGLE_ORDINARY_ADULT');
    scriptRolls(1, 1, 425, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(475);
    expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    state.spirituality = 6;
    scriptRolls(1, 1, 400, 425, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(12);
  });
});

describe('Real night-pharmacy courtyard and current original shadow', () => {
  it('uses the real one-AP producer, with Evan two metres away and no old carrier or Brook dependency', () => {
    const state = fixture(); state.combat = null;
    state.potionProfessor.encounter = { status: 'AVAILABLE', startHistoryIndex: null, attemptWeek: null };
    state.potionProfessor.cases['quiet-passage']!.status = 'RESOLVED';
    state.world.carrierAlive = false; state.world.carrierCanResist = false;
    state.vampire.encounter = { status: 'LOST', observed: false, startHistoryIndex: null, attemptWeek: null };
    const world = structuredClone(state.world), vampire = structuredClone(state.vampire), actions = state.actionsRemaining;
    expect(currentPotionProfessorCombatSource(state)).toBeNull();
    applyPotionProfessorEncounter(state, { type: 'ENCOUNTER_FIGHT' }, encounterContext());
    expect(state.actionsRemaining).toBe(actions - 1);
    expect(currentPotionProfessorCombatSource(state)).toEqual({
      encounterId: 'POTION_PROFESSOR_DISPUTE', round: 1,
      attemptWeek: state.week, startHistoryIndex: state.combatHistory.length,
      target: 'EVAN_SINGLE_ORDINARY_ADULT', body: 'CURRENT_VISIBLE_BODY', weapon: 'EVANS_ORDINARY_SHORT_CLUB',
      space: 'ORIGINAL_NIGHT_PHARMACY_OUTER_COURTYARD', lighting: 'ORIGINAL_FIXED_LAMPLIGHT',
      shadow: 'EVANS_VISIBLE_ORIGINAL_SHADOW', aggression: 'VISIBLE_SHORT_CLUB_THREAT',
      distanceMetres: 2, ground: 'ORDINARY', bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false,
    });
    expect(currentVampireBodySource(state)).toEqual(currentPotionProfessorCombatSource(state));
    expect(POTION_PROFESSOR_ENCOUNTER_STORY).toContain('成年');
    expect(POTION_PROFESSOR_ENCOUNTER_STORY).toContain('艾文');
    expect(POTION_PROFESSOR_ENCOUNTER_STORY).toContain('2米');
    expect(POTION_PROFESSOR_ENCOUNTER_STORY).toContain('原固定照明');
    expect(JSON.stringify(projectSliceState(state).combat)).toContain('艾文');
    expect(state.world).toEqual(world); expect(state.vampire).toEqual(vampire);
  });

  it('cannot visit with active support-potion effects or an unfinished consented contact', () => {
    for (const effect of ['quietStep', 'odorVeil', 'bodyVeil', 'clothVeil'] as const) {
      const state = fixture(); state.combat = null;
      state.potionProfessor.encounter.status = 'AVAILABLE';
      state.potionProfessor.cases['quiet-passage']!.status = 'RESOLVED';
      state.potionProfessor.laboratory.effects[effect] = true;
      const before = structuredClone(state);
      expect(() => applyPotionProfessorEncounter(state, { type: 'ENCOUNTER_FIGHT' }, encounterContext())).toThrow();
      expect(state).toEqual(before);
    }
    const state = fixture(); state.combat = null; state.potionProfessor.encounter.status = 'AVAILABLE';
    state.potionProfessor.cases['quiet-passage']!.status = 'RESOLVED';
    state.potionProfessor.cases['separate-signals']!.contactOpen = true;
    const before = structuredClone(state);
    expect(() => applyPotionProfessorEncounter(state, { type: 'ENCOUNTER_FIGHT' }, encounterContext())).toThrow();
    expect(state).toEqual(before);
  });

  it('rejects stale, fabricated or ended scene context before any combat mutation or random draw', () => {
    const mutations: ((state: SliceState) => void)[] = [
      s => { s.potionProfessor.encounter.status = 'AVAILABLE'; },
      s => { s.potionProfessor.encounter.attemptWeek = null; },
      s => { s.potionProfessor.encounter.attemptWeek = s.week - 1; },
      s => { s.potionProfessor.encounter.startHistoryIndex = null; },
      s => { s.potionProfessor.encounter.startHistoryIndex = -1; },
      s => { s.potionProfessor.encounter.startHistoryIndex = 1; },
      s => { s.combat!.round = 2; },
      s => { s.combat!.round = 0; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; },
      s => { s.combat!.enemyHealth = 0; },
      s => { s.world.city = 'ELSEWHERE'; },
      s => { s.progression.sequence = 7; },
      s => { s.progression.pathwayId = 'audience'; },
      s => { s.health = 0; }, s => { s.status = 'DEAD'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(); mutate(state);
      const before = structuredClone(state);
      expect(currentPotionProfessorCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow();
      expect(state).toEqual(before);
    }
  });

  it('does not substitute old, unseen, distant, walled or bystander-filled geometry for the original source', () => {
    const state = fixture(), source = currentPotionProfessorCombatSource(state)!;
    const invalid: (VampireBodySource | null)[] = [null, ...[
      { round: 2 }, { attemptWeek: state.week + 1 }, { startHistoryIndex: 1 },
      { target: 'BROOK_SINGLE_ORDINARY_ADULT' }, { body: 'OTHER_BODY' },
      { weapon: 'CARRIERS_CLUB' }, { lighting: 'NO_LIGHT' }, { shadow: 'UNSEEN_SHADOW' },
      { space: 'OTHER_ROOM' }, { distanceMetres: 200 }, { ground: 'WALL_TOP' },
      { bystanders: 'CROWD' }, { exit: 'THROUGH_WALL' }, { pursuit: true }, { aggression: 'NONE' },
    ].map(change => ({ ...source, ...change }) as unknown as VampireBodySource)];
    for (const supplied of invalid) for (const id of ['moon.s7.abyss-shackles', 'moon.s7.dark-wings'] as const) {
      const before = structuredClone(state), random = stream(state);
      expect(resolveVampireCombatAbility(state, id, 1, random, supplied))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    for (const encounterId of ['FIRST_CASE', 'VAMPIRE_DISPUTE'] as const) {
      state.combat!.encounterId = encounterId;
      expect(currentVampireBodySource(state)).toBeNull();
      expect(resolveVampireCombatAbility(state, 'moon.s7.dark-wings', 1, stream(state), source).enemyReduction).toBe(10);
    }
  });

  it('pays the original three spirituality and performs the same real will check against Evan’s present body', () => {
    for (const [roll, tier, reduction] of [[1, 'GREAT_SUCCESS', 24], [52, 'SUCCESS', 24],
      [53, 'FAILURE', 0], [100, 'GREAT_FAILURE', 0]] as const) {
      const state = fixture(), random = stream(state), before = structuredClone(state);
      scriptRolls(roll);
      const effect = resolveVampireCombatAbility(state, 'moon.s7.abyss-shackles', 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: reduction, threatens: false });
      expect(effect.label).not.toMatch(/布鲁克|携铃者/);
      if (reduction) expect(effect.label).toContain('艾文本人的原影');
      expect(state.lastCheck).toMatchObject({ ability: 'will', difficulty: 14, chance: 52, roll, tier });
      expect(state).toEqual({ ...before, spirituality: 77, lastCheck: state.lastCheck });
      expect(random.cursor).toBe(1);
      vi.restoreAllMocks();
    }
  });

  it('uses the actual courtyard wing-step without crossing walls, moving anyone or automatically retreating', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    const effect = resolveVampireCombatAbility(state, 'moon.s7.dark-wings', 0.8, random);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 22, threatens: false });
    expect(effect.label).toContain('原药房'); expect(effect.label).toContain('不飞越墙壁');
    expect(state).toEqual({ ...before, spirituality: 77 }); expect(random.cursor).toBe(0);
  });

  it('retains every enemy action after successful shackles and does not turn shadow control into an injury', () => {
    const state = fixture(); state.spirituality = 30;
    const draws = scriptRolls(1, 86, 226, 1, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([1, 3]);
    expect(round.moves.filter(move => move.actor === 'ENEMY')).toHaveLength(3);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 24 });
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(35); expect(draws).toHaveBeenCalledTimes(8);
  });

  it('keeps finite regeneration6/+8, injury and risk records; insufficient resources still fall back once', () => {
    const state = fixture(); state.health = 50; state.spirituality = 30; state.injuryRisk = 4;
    state.injuries = [{ id: 'old-injury', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    const before = structuredClone(state), random = stream(state);
    expect(resolveVampireCombatAbility(state, 'moon.s7.regeneration', 1, random, null))
      .toMatchObject({ selfGain: 8, enemyReduction: 0, threatens: false });
    expect(state).toEqual({ ...before, health: 56, spirituality: 27 }); expect(random.cursor).toBe(0);
    for (const id of inherited) {
      state.spirituality = 2.5;
      const saved = structuredClone(state), rng = stream(state);
      expect(resolveVampireCombatAbility(state, id, 1, rng))
        .toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
      expect(state).toEqual(saved); expect(rng.cursor).toBe(0);
    }
  });
});

describe('Ordinary consequences remain authoritative', () => {
  it.each([['ENEMY_SURRENDERED', 66], ['ENEMY_DEAD', 96]] as const)('keeps %s real, without terminal recovery or item transfer', (outcome, roll) => {
    const state = fixture(); state.spirituality = 30; carryAssistance(state);
    state.world.carrierAlive = false; state.world.carrierCanResist = false;
    const world = structuredClone(state.world), town = structuredClone(state.town);
    const laboratory = structuredClone(state.potionProfessor.laboratory), vampire = structuredClone(state.vampire);
    scriptRolls(1, 1, 1, 400, 1, roll);
    const result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.outcome).toBe(outcome);
    expect(result.round.consequence).toContain('艾文');
    expect(result.round.consequence).not.toMatch(/携铃者|布鲁克|箱子/);
    expect(state.combat!.enemyHealth).toBe(outcome === 'ENEMY_DEAD' ? 0 : 70);
    expect(state.combat!.enemyStatus).toBe(outcome === 'ENEMY_DEAD' ? 'DEAD' : 'SURRENDERED');
    expect(state.spirituality).toBe(30);
    expect(state.world).toEqual(world); expect(state.town).toEqual(town);
    expect(state.potionProfessor.laboratory).toEqual(laboratory); expect(state.vampire).toEqual(vampire);
  });

  it('settles ordinary player death without inventory rescue, regeneration after death or a reward', () => {
    const state = fixture(); state.health = 40; state.spirituality = 30; carryAssistance(state);
    const laboratory = structuredClone(state.potionProfessor.laboratory);
    scriptRolls(1, 1, 366, 1, 1_000_000, 96);
    const result = applySliceIntent(state, { type: 'COMBAT_ROUND', stance: 'ATTACK' });
    expect(result.lastCombatRound!.moves[0]!.label).toContain('健康恢复6');
    expect(result.lastCombatRound!.moves[1]).toEqual({ actor: 'ENEMY', label: '短棍打击', selfGain: 16, enemyReduction: 0 });
    expect(result.status).toBe('DEAD'); expect(result.health).toBe(0);
    expect(result.combat).toBeNull(); expect(result.potionProfessor.encounter.status).toBe('LOST');
    expect(result.potionProfessor.laboratory).toEqual(laboratory); expect(result.spirituality).toBe(27);
    expect(result.progression.mastery).toEqual({});
    expect(resolveVampireCombatAbility(result, 'moon.s7.regeneration', 1, stream(result)).selfGain).toBe(0);
  });

  it('settles a real surrender with the single domain-owned battle25 award and no acting credit', () => {
    const state = fixture(); state.spirituality = 30;
    state.progression.mastery = Object.fromEntries(POTION_PROFESSOR_ABILITY_IDS.map(id => [id, 0]));
    scriptRolls(1, 1, 1, 400, 1, 66, 1);
    const result = applySliceIntent(state, { type: 'COMBAT_ROUND', stance: 'ATTACK' });
    expect(result.potionProfessor.encounter.status).toBe('RESOLVED'); expect(result.combat).toBeNull();
    expect(result.lastCombatRound!.consequence).toContain('艾文仍然活着');
    expect(Object.values(result.progression.mastery).reduce((sum, value) => sum + value, 0)).toBe(25);
    expect(result.progression.acting).toBe(0); expect(result.spirituality).toBe(30);
    const saved = structuredClone(result);
    expect(() => applySliceIntent(result, { type: 'COMBAT_ROUND', stance: 'ATTACK' })).toThrow();
    expect(result).toEqual(saved);
  });

  it('retreats through the real ordinary exit with no pursuit, auto-use, recovery or reward', () => {
    const state = fixture(); state.spirituality = 30; carryAssistance(state);
    const world = structuredClone(state.world), town = structuredClone(state.town);
    const laboratory = structuredClone(state.potionProfessor.laboratory);
    const draws = scriptRolls(100, 100, 50);
    const result = applySliceIntent(state, { type: 'COMBAT_ROUND', stance: 'RETREAT' });
    expect(result.potionProfessor.encounter.status).toBe('RETREATED'); expect(result.combat).toBeNull();
    expect(result.lastCombatRound!.retreat).toBe('SUCCESS'); expect(result.lastCombatRound!.moves).toEqual([]);
    expect(result.lastCombatRound!.consequence).toContain('实际出口');
    expect(result.lastCombatRound!.consequence).toContain('艾文');
    expect(result.world).toEqual(world); expect(result.town).toEqual(town);
    expect(result.potionProfessor.laboratory).toEqual(laboratory);
    expect(result.spirituality).toBe(30); expect(result.health).toBe(100);
    expect(result.progression.mastery).toEqual({}); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('replays a complete finite fight and binds each later source to its committed history', () => {
    const play = () => {
      const state = fixture(); state.town.clubLocation = 'HAND'; carryAssistance(state);
      const laboratory = structuredClone(state.potionProfessor.laboratory);
      const rounds: SliceCombatRound[] = [];
      let outcome: ReturnType<typeof resolveSliceCombatRound>['outcome'] = 'CONTINUE';
      while (outcome === 'CONTINUE' && rounds.length < 100) {
        expect(currentPotionProfessorCombatSource(state)).not.toBeNull();
        const result = resolveSliceCombatRound(state, 'ATTACK');
        rounds.push(structuredClone(result.round)); state.combatHistory.push(structuredClone(result.round));
        outcome = result.outcome;
      }
      expect(outcome).not.toBe('CONTINUE');
      expect(rounds.every(round => round.playerCount >= 1 && round.playerCount <= 6 &&
        round.enemyCount >= 1 && round.enemyCount <= 3 && round.playerAdvantage >= 45)).toBe(true);
      expect(state.potionProfessor.laboratory).toEqual(laboratory); expect(state.town.clubLocation).toBe('HAND');
      expect(state.spirituality).toBeLessThanOrEqual(80);
      return { state, rounds, outcome };
    };
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(play()).toEqual(play()); expect(forbidden).not.toHaveBeenCalled();
  });
});
