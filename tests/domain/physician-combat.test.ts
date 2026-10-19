import { NATURE_WALKER_COUNT_WHEEL, natureWalkerAbilityWheel, currentNatureWalkerCombatSource } from '../../src/domain/nature-walker/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { PHYSICIAN_COUNT_WHEEL, currentPhysicianCombatSource, drawPhysicianAbility, isPhysician,
  physicianAbilityWheel, physicianActionCount, resolvePhysicianCombatAbility,
  type PhysicianCombatSource, type PhysicianMoveId } from '../../src/domain/physician/combat.js';
import { CULTIVATOR_COUNT_WHEEL, cultivatorAbilityWheel, currentCultivatorCombatSource } from '../../src/domain/cultivator/combat.js';
import * as physicianCombat from '../../src/domain/physician/combat.js';
import { MONSTER_COUNT_WHEEL, monsterAbilityWheel } from '../../src/domain/monster/combat.js';
import { MACHINE_COUNT_WHEEL, machineAbilityWheel } from '../../src/domain/machine/combat.js';
import { LUCKY_COUNT_WHEEL, luckyAbilityWheel } from '../../src/domain/lucky/combat.js';
import { PRISONER_COUNT_WHEEL, prisonerAbilityWheel } from '../../src/domain/prisoner/combat.js';
import { MADMAN_COUNT_WHEEL, madmanAbilityWheel } from '../../src/domain/madman/combat.js';
import { VAMPIRE_COUNT_WHEEL, vampireAbilityWheel } from '../../src/domain/vampire/combat.js';
import { WEREWOLF_COUNT_WHEEL, werewolfAbilityWheel } from '../../src/domain/werewolf/combat.js';
import { LAWYER_COUNT_WHEEL, lawyerAbilityWheel } from '../../src/domain/lawyer/combat.js';
import { BARBARIAN_COUNT_WHEEL, barbarianAbilityWheel } from '../../src/domain/barbarian/combat.js';
import { BRIBER_COUNT_WHEEL, briberAbilityWheel } from '../../src/domain/briber/combat.js';
import { ARBITER_COUNT_WHEEL, arbiterAbilityWheel } from '../../src/domain/arbiter/combat.js';
import { SHERIFF_COUNT_WHEEL, sheriffAbilityWheel } from '../../src/domain/sheriff/combat.js';
import { INTERROGATOR_COUNT_WHEEL, interrogatorAbilityWheel } from '../../src/domain/interrogator/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const observation = 'mother.s8.condition-observation', preparation = 'mother.s8.limited-healing';
const practice = 'mother.s9.careful-practice';
const ids = ['STRIKE', 'BODY_FOLLOWUP', observation, 'POSITION', preparation, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('physician-combat-test', sliceDefaultCreationSelection, 'physician-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'mother', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: PhysicianMoveId, physical = 1,
  source = currentPhysicianCombatSource(state)) {
  return resolvePhysicianCombatAbility(state, id, physical, stream(state), source);
}
/** Select exact tickets while retaining the real deterministic cursor and range checks. */
function scriptRolls(...rolls: number[]) {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let index = 0;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (
    this: DeterministicActionRandomStream, minimum, maximum,
  ) {
    original.call(this, minimum, maximum);
    const value = rolls[index++];
    if (value === undefined) throw new Error('Unexpected additional random draw');
    expect(value).toBeGreaterThanOrEqual(minimum); expect(value).toBeLessThanOrEqual(maximum);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Physician S8 exact G profile and strict dispatch', () => {
  it('uses 30/20/20/10/15/5 slots and independent 10/20/25/25/20 counts', () => {
    const state = fixture();
    expect(isPhysician(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(physicianAbilityWheel(null, state));
    expect(physicianAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(physicianAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(PHYSICIAN_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 20]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(PHYSICIAN_COUNT_WHEEL)).toBe(true);
    expect(PHYSICIAN_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
  });

  it('uses exact ×5/4 stance tickets, including both ordinary attacks, at every boundary', () => {
    for (const [stance, weights] of [
      [null, [120, 80, 80, 40, 60, 20]],
      ['ATTACK', [150, 100, 80, 40, 60, 20]],
      ['DEFEND', [120, 80, 100, 40, 60, 20]],
      ['CONTROL', [120, 80, 80, 50, 60, 20]],
      ['PREPARE', [120, 80, 80, 40, 75, 20]],
    ] as const) {
      const sum = weights.reduce<number>((total, n) => total + n, 0);
      expect(physicianAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => sum === 400 ? n / 4 : n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawPhysicianAbility(random, stance)).toBe(ids[index]);
        expect(drawPhysicianAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(physicianAbilityWheel('RETREAT')).toEqual(physicianAbilityWheel(null));
  });

  it('dispatches every count boundary with no additional RNG draw or enemy slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [100, 5]] as const) {
      expect(physicianActionCount(roll)).toBe(count);
      const state = fixture(), cursor = state.random.cursor;
      const draws = scriptRolls(roll, 1, 371, 400, ...Array<number>(count - 1).fill(371), 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect([round.playerCount, round.enemyCount]).toEqual([count, 1]);
      expect(round.moves.filter(move => move.actor === 'PLAYER')).toHaveLength(count);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(draws).toHaveBeenCalledTimes(count + 4); expect(state.random.cursor).toBe(cursor + count + 4);
      vi.restoreAllMocks();
    }
  });

  it('uses core30/30/15/25, tier300, cap60, floor30 and max45 with recovery4.5', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(323.5 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(4.5);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.weeklyBudget).toBe(before.weeklyBudget); expect(state.progression).toEqual(before.progression);
    expect(state.world).toEqual(before.world); expect(state.town).toEqual(before.town); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(4.5); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 44;
    scriptRolls(1, 1, 371, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(45); vi.restoreAllMocks();
    vi.spyOn(physicianCombat, 'resolvePhysicianCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(30);
  });

  it('keeps Cultivator S9 and existing Wheel and Chained profiles, with opened S1 and unopened S0 routed exactly', () => {
    const state = fixture(); state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(CULTIVATOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(cultivatorAbilityWheel('CONTROL', state));
    expect(currentPhysicianCombatSource(state)).toBeNull();
    state.progression.sequence = 8;
    expect(currentCultivatorCombatSource(state)).toBeNull();
    state.progression.sequence = 1;
    expect(currentNatureWalkerCombatSource(state)).toBeNull();
    expect(playerCountWheel(state)).toEqual(NATURE_WALKER_COUNT_WHEEL);
    expect(playerCountWheel(state)).toHaveLength(6);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(natureWalkerAbilityWheel(state, 'CONTROL'));
    expect(playerAbilityWheel(state, 'CONTROL')).not.toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    for (const sequence of [0, null] as const) {
      state.progression.sequence = sequence;
      expect(isPhysician(state)).toBe(false); expect(currentPhysicianCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    state.progression.pathwayId = 'wheel'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(MONSTER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(monsterAbilityWheel('CONTROL', state));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(MACHINE_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(machineAbilityWheel('CONTROL', state));
    state.progression.sequence = 7;
    expect(playerCountWheel(state)).toEqual(LUCKY_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(luckyAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'chained'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(PRISONER_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(prisonerAbilityWheel('CONTROL', state));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(MADMAN_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(madmanAbilityWheel('CONTROL', state));
    state.progression.sequence = 7;
    expect(playerCountWheel(state)).toEqual(WEREWOLF_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(werewolfAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'moon'; state.progression.sequence = 7;
    expect(playerCountWheel(state)).toEqual(VAMPIRE_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(vampireAbilityWheel('CONTROL'));
    expect(currentPhysicianCombatSource(state)).toBeNull();
  });

  it('keeps existing Black Emperor and Justiciar exact-sequence wheels unchanged', () => {
    const state = fixture();
    for (const [pathway, sequence, countWheel, abilityWheel] of [
      ['black-emperor', 9, LAWYER_COUNT_WHEEL, lawyerAbilityWheel],
      ['black-emperor', 8, BARBARIAN_COUNT_WHEEL, barbarianAbilityWheel],
      ['black-emperor', 7, BRIBER_COUNT_WHEEL, briberAbilityWheel],
      ['justiciar', 9, ARBITER_COUNT_WHEEL, arbiterAbilityWheel],
      ['justiciar', 8, SHERIFF_COUNT_WHEEL, sheriffAbilityWheel],
      ['justiciar', 7, INTERROGATOR_COUNT_WHEEL, interrogatorAbilityWheel],
    ] as const) {
      state.progression.pathwayId = pathway; state.progression.sequence = sequence;
      expect(playerCountWheel(state)).toEqual(countWheel);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(abilityWheel('CONTROL', state));
      expect(isPhysician(state)).toBe(false); expect(currentPhysicianCombatSource(state)).toBeNull();
    }
  });

  it('keeps unknown sequence rounds exactly on the ordinary fallback, including actual held gear', () => {
    for (const sequence of [1, 0, null] as const) {
      const state = fixture(); state.progression.sequence = sequence; state.town.clubLocation = 'HAND';
      state.progression.mastery = { [observation]: 500, [practice]: 500, [preparation]: 500,
        'mother.s7.plant-growth': 500, 'mother.s6.hybrids': 500 };
      const ordinary = structuredClone(state);
      ordinary.progression.pathwayId = null; ordinary.progression.sequence = null;
      expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(ordinary, 'CONTROL'));
      expect(state.random).toEqual(ordinary.random); expect(state.combat).toEqual(ordinary.combat);
      expect(state.health).toBe(ordinary.health); expect(state.spirituality).toBe(ordinary.spirituality);
      expect(state.town).toEqual(ordinary.town);
    }
  });

  it('refuses unrelated burst or fury policies before RNG or state mutation', () => {
    const state = fixture(), before = structuredClone(state);
    const draws = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt');
    expect(() => resolveSliceCombatRound(state, 'ATTACK', 'HOLD', 'BURST_FIRST')).toThrow('当前序列不能选择理智爆发策略');
    expect(() => resolveSliceCombatRound(state, 'ATTACK', 'RELEASE_FIRST')).toThrow('当前序列不能选择怒击策略');
    expect(state).toEqual(before); expect(draws).not.toHaveBeenCalled();
  });
});

describe('Physician ordinary body, visible condition observation and bounded healing', () => {
  it('uses 12/8.4f/21f/6 budgets with separate practice and observation mastery and zero spiritual cost', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [practice]: mastery, [observation]: mastery, [preparation]: mastery,
        STRIKE: 500, BODY_FOLLOWUP: 500, POSITION: 500, 'mother.s7.plant-growth': 500, 'mother.s6.hybrids': 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolvePhysicianCombatAbility(state, 'STRIKE', 0.8, random))
        .toMatchObject({ selfGain: 12 * 0.8, enemyReduction: 0, threatens: true });
      expect(resolvePhysicianCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random))
        .toMatchObject({ selfGain: 8.4 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolvePhysicianCombatAbility(state, observation, 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 21 * factor * 0.8, threatens: false });
      expect(resolvePhysicianCombatAbility(state, 'POSITION', 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
      expect(resolvePhysicianCombatAbility(state, preparation, 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const separate = fixture(); separate.progression.mastery = { [observation]: 0, [practice]: 500, [preparation]: 500 };
    expect(resolve(separate, observation).enemyReduction).toBe(21 * 0.65);
    expect(resolve(separate, 'BODY_FOLLOWUP').selfGain).toBe(8.4);
    separate.progression.mastery = { [observation]: 500, [practice]: 0, [preparation]: 500 };
    expect(resolve(separate, observation).enemyReduction).toBe(21);
    expect(resolve(separate, 'BODY_FOLLOWUP').selfGain).toBe(8.4 * 0.65);
  });

  it('bounds malformed practice and observation mastery and physical factors without new spiritual costs', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[observation] = mastery;
      state.progression.mastery[practice] = mastery;
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(8.4 * (mastery === 800 ? 1 : 0.65));
      expect(resolve(state, observation).enemyReduction).toBe(21 * (mastery === 800 ? 1 : 0.65));
      expect(resolve(state, 'STRIKE').selfGain).toBe(12);
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(), before = structuredClone(state);
      for (const id of ['STRIKE', 'BODY_FOLLOWUP', observation, 'POSITION'] as const) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(state).toEqual(before);
    }
    expect(resolve(fixture(), 'STRIKE', 3).selfGain).toBe(12);
  });

  it('only actual HAND club16 replaces H and leaves body J, ownership and custody unchanged', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.prisoner.cases['jammed-shutter']!.holding = true;
      Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand' });
      state.progression.mastery = { [practice]: 500, [observation]: 500, [preparation]: 500 };
      const before = structuredClone(state), random = stream(state);
      const source = { ...currentPhysicianCombatSource(state)!, heldTool: 'town-short-club', toolReady: true };
      expect(resolvePhysicianCombatAbility(state, 'STRIKE', 0.8, random, source).selfGain)
        .toBe((location === 'HAND' ? 16 : 12) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(8.4);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '普通近身打击');
      expect(resolvePhysicianCombatAbility(state, preparation, 1, random, source))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.town.clubLocation = 'HAND'; const source = currentPhysicianCombatSource(state);
    state.town.clubLocation = 'BAG'; expect(resolve(state, 'STRIKE', 1, source).selfGain).toBe(12);
  });

  it('only observes currently visible ordinary body signs without hidden diagnoses, truth or future randomness', () => {
    const state = fixture(); state.progression.mastery = { [observation]: 500, [preparation]: 500,
      'mother.s9.season-observation': 500, 'mother.s7.plant-growth': 500 };
    state.knowledge.push({ id: 'hidden-condition', week: state.week, title: '旧记录',
      text: 'PRIVATE_CONDITION HIDDEN_DIAGNOSIS FUTURE_WEATHER' });
    Object.assign(state.combat!, { hiddenDiagnosis: 'HIDDEN_DIAGNOSIS', secretTruth: 'SECRET_TRUTH' });
    const source = { ...currentPhysicianCombatSource(state)!, diagnosis: 'FORGED_DIAGNOSIS', toolReady: true };
    const before = structuredClone(state), random = stream(state);
    const effect = resolvePhysicianCombatAbility(state, observation, 1, random, source);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 21, threatens: false });
    expect(effect.label).toContain('仅据眼前普通对手已经可见的身体表现');
    expect(effect.label).toContain('不诊断隐藏病情、不读取秘密或真相');
    expect(effect.label).not.toMatch(/PRIVATE_CONDITION|HIDDEN_DIAGNOSIS|FUTURE_WEATHER|SECRET_TRUTH|FORGED_DIAGNOSIS/);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    const changed = structuredClone(state); changed.random.seed = 'changed-future'; changed.random.cursor = 39;
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect the seed'); },
      get cursor(): number { throw new Error('Do not inspect the cursor'); },
      nextInt() { throw new Error('Do not draw hidden conditions'); },
    };
    expect(resolvePhysicianCombatAbility(changed, observation, 1, forbidden)).toEqual(effect);
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).toEqual(ids);
    expect(resolve(state, 'POSITION').label).toContain('不催生根系或植物');
  });

  it('rejects undeclared and higher-stage move IDs without output, cost, mutation or RNG', () => {
    const state = fixture(), before = structuredClone(state), random = stream(state);
    for (const id of [practice, 'mother.s9.season-observation', 'mother.s9.cultivation-knowledge',
      'mother.s7.plant-growth', 'mother.s6.hybrids', 'SOUL_SUTURE', 'BLOOD_RECOVERY', 'FORECAST', 'HEAL']) {
      expect(resolvePhysicianCombatAbility(state, id as PhysicianMoveId, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('keeps both accident results at exactly ±7.5 without a physical attack or resource mutation', () => {
    for (const [roll, gain] of [[1, -7.5], [2, 7.5]] as const) {
      const state = fixture(), before = structuredClone(state), random = stream(state), draws = scriptRolls(roll);
      expect(resolvePhysicianCombatAbility(state, 'ACCIDENT', 0, random))
        .toMatchObject({ selfGain: gain, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(1);
      expect(draws).toHaveBeenCalledTimes(1); vi.restoreAllMocks();
    }
  });

  it('derives only the current ordinary body and refuses every stale or forged source', () => {
    const state = fixture(), source = currentPhysicianCombatSource(state)!;
    expect(source).toEqual({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    const invalid: (PhysicianCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as PhysicianCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolvePhysicianCombatAbility(state, id, 1, random, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('refuses absent, ended, invalid-health, wrong-pathway and unrelated encounters', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.health = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyHealth = Number.NaN; },
      (s: SliceState) => { s.combat!.enemyHealth = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.combat!.round = 0; }, (s: SliceState) => { s.combat!.round = 1.5; },
      (s: SliceState) => { s.combat!.round = Number.NaN; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'chained'; }, (s: SliceState) => { s.progression.pathwayId = null; },
      (s: SliceState) => { s.progression.sequence = 9; }, (s: SliceState) => { s.progression.sequence = 7; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentPhysicianCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolvePhysicianCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Physician shared rounds, injury, death, retreat and replay', () => {
  it('keeps five full-health self-care slots source-bound and nonthreatening, with no extra draws or resource loop', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.spirituality = 0;
    const before = structuredClone(state), draws = scriptRolls(100, 1, 321, 400, 321, 321, 321, 321, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    const moves = round.moves.filter(move => move.actor === 'PLAYER');
    expect(moves).toHaveLength(5);
    expect(moves.every(move => move.label.includes('当前健康已满'))).toBe(true);
    expect(moves.map(move => [move.selfGain, move.enemyReduction])).toEqual(Array(5).fill([0, 0]));
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(4.5); expect(state.health).toBe(100); expect(state.mind).toBe(100);
    expect(state.town).toEqual(before.town); expect(state.progression).toEqual(before.progression);
    expect(state.knowledge).toEqual(before.knowledge);
    expect(draws).toHaveBeenCalledTimes(9); expect(state.random.cursor).toBe(before.random.cursor + 9);
  });

  it('revalidates the captured source before every actual slot, including accident', () => {
    const state = fixture();
    const original = physicianCombat.resolvePhysicianCombatAbility;
    let calls = 0;
    const effects = vi.spyOn(physicianCombat, 'resolvePhysicianCombatAbility').mockImplementation((...args) => {
      const result = original(...args);
      calls += 1;
      if (calls === 1) state.world.carrierCanResist = false;
      return result;
    });
    const draws = scriptRolls(100, 1, 371, 400, 1, 151, 251, 431, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    const moves = round.moves.filter(move => move.actor === 'PLAYER');
    expect(moves).toHaveLength(5); expect(effects).toHaveBeenCalledTimes(5);
    expect(moves[0]!.label).toContain('当前健康已满');
    expect(moves.slice(1).every(move => move.label.includes('缺少本场'))).toBe(true);
    expect(moves.map(move => [move.selfGain, move.enemyReduction])).toEqual(Array(5).fill([0, 0]));
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat!.enemyHealth).toBe(100); expect(draws).toHaveBeenCalledTimes(9);
  });

  it('alternates five player slots and three unmodified enemy slots in the shared round', () => {
    const state = fixture(); state.spirituality = 20; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 251, 1, 331, 371, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[12, 0], [8.4 * 0.65, 0], [0, 21 * 0.65], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(315 * 0.9 + (12 + 8.4 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (21 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(24.5); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('preserves even-round initiative without treating enemy actions as healing sources', () => {
    const state = fixture(); state.combat!.round = 2;
    const draws = scriptRolls(100, 100, 400, 371, 400, 371, 400, 371, 371, 371, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').every(move => move.label.includes('当前健康已满'))).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
    expect(draws).toHaveBeenCalledTimes(11);
  });

  it('never permits injury from observation, position, healing or either unmodified accident outcome', () => {
    for (const [ticket, accident] of [[251, 0], [331, 0], [371, 0], [431, 1], [431, 2]] as const) {
      const state = fixture(); state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
      const draws = accident ? scriptRolls(1, 1, ticket, accident, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(accident === 1 ? -7.5 : accident === 2 ? 7.5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(accident ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('keeps real opponent attacks and mental penalties despite observation or ordinary footwork', () => {
    for (const ticket of [251, 331]) {
      const state = fixture(); state.mind = 25;
      const draws = scriptRolls(1, 100, ticket, 1, 1, 1, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
      expect(round.moves).toHaveLength(4); expect(round.playerAdvantage).toBe(315 * 0.8);
      expect(state.mind).toBe(25); expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(7);
      vi.restoreAllMocks();
    }
  });

  it('allows H and J to reach only the shared injury and surrender consequences', () => {
    for (const ticket of [1, 151]) {
      const state = fixture(); state.spirituality = 10;
      scriptRolls(1, 1, ticket, 400, 1, 66);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(outcome).toBe('ENEMY_SURRENDERED'); expect(round.moves).toHaveLength(2);
      expect(state.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(state.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(round.consequence).toContain('携铃者仍然活着'); expect(state.spirituality).toBe(10);
      vi.restoreAllMocks();
    }
  });

  it('retains enemy death only through the shared consequence draw after an actual attack', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(1, 1, 1, 400, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_DEAD'); expect(state.combat!.enemyHealth).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(6);
  });

  it('retains accumulated injury risk and real player death despite body observation or healing', () => {
    for (const ticket of [251, 371]) {
      const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
      state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
      state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
      const draws = scriptRolls(1, 1, ticket, 1, 1_000_000, 96);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
      expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
      expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(ticket === 371 ? 2 : 5);
      expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('keeps the ordinary exit and its 50% retreat boundary with no plant escape or guaranteed recovery', () => {
    const state = fixture(); state.spirituality = 10; state.town.clubLocation = 'HAND';
    const town = structuredClone(state.town), draws = scriptRolls(100, 100, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.moves).toEqual([]);
    expect(round.retreat).toBe('SUCCESS'); expect(state.spirituality).toBe(10);
    expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(3);
  });

  it('keeps failed retreat and subsequent real injury possible', () => {
    const state = fixture(); state.spirituality = 10;
    const draws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(round.retreat).toBe('FAILURE'); expect(round.moves).toHaveLength(1);
    expect(round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.spirituality).toBe(14.5);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('replays serialized state and original held gear from the same seed and cursor', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.town.clubLocation).toBe('HAND');
  });
});

describe('Physician actual limited self-care, integer health and unchanged consequences', () => {
  it('spends exactly 3 spirituality to heal floor(10f) at every mastery tier without advantage or RNG', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.health = 60; state.spirituality = 3; state.mind = 32;
      state.seer.pollution = 41; state.injuryRisk = 3;
      state.injuries = [{ id: 'prior-light', severity: 'LIGHT', acquiredRevision: 1, treatedRevision: null },
        { id: 'prior-heavy', severity: 'HEAVY', acquiredRevision: 2, treatedRevision: 3 }];
      state.progression.mastery = { [preparation]: mastery, [observation]: 500, [practice]: 500 };
      const before = structuredClone(state), recovered = Math.floor(10 * (0.65 + 0.35 * mastery / 500));
      const forbidden: ActionRandomStream = {
        get seed(): string { throw new Error('Healing must not inspect a seed'); },
        get cursor(): number { throw new Error('Healing must not inspect a cursor'); },
        nextInt() { throw new Error('Healing must not draw'); },
      };
      const effect = resolvePhysicianCombatAbility(state, preparation, 0, forbidden);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain(`消耗3灵性，实际恢复${recovered}健康（G）`);
      expect(effect.label).toContain('不清污染、不恢复精神、不能复活');
      expect(state).toEqual({ ...before, health: 60 + recovered, spirituality: 0 });
      expect(Number.isInteger(state.health)).toBe(true);
    }
  });

  it('uses only limited-healing mastery and safely bounds malformed mastery', () => {
    for (const [mastery, expected] of [[-50, 6], [Number.NaN, 6], [Number.POSITIVE_INFINITY, 6], [800, 10]] as const) {
      const state = fixture(); state.health = 60;
      state.progression.mastery = { [preparation]: mastery, [practice]: 500, [observation]: 500,
        'mother.s9.cultivation-knowledge': 500, 'chained.s7.regeneration': 500 };
      const before = structuredClone(state), random = stream(state);
      const effect = resolvePhysicianCombatAbility(state, preparation, 1, random);
      expect(effect.label).toContain(`实际恢复${expected}健康`);
      expect(state).toEqual({ ...before, health: 60 + expected, spirituality: 42 });
      expect(random.cursor).toBe(0);
    }
  });

  it('caps actual healing at missing health and charges each successful slot rather than each attempted slot', () => {
    const state = fixture(); state.health = 85; state.spirituality = 9;
    state.progression.mastery[preparation] = 500;
    const source = currentPhysicianCombatSource(state), random = stream(state), before = structuredClone(state);
    const first = resolvePhysicianCombatAbility(state, preparation, 1, random, source);
    expect(first.label).toContain('实际恢复10健康'); expect(state.health).toBe(95); expect(state.spirituality).toBe(6);
    const second = resolvePhysicianCombatAbility(state, preparation, 1, random, source);
    expect(second.label).toContain('实际恢复5健康'); expect(state.health).toBe(100); expect(state.spirituality).toBe(3);
    const third = resolvePhysicianCombatAbility(state, preparation, 1, random, source);
    expect(third.label).toContain('当前健康已满'); expect(state.health).toBe(100); expect(state.spirituality).toBe(3);
    for (const effect of [first, second, third]) {
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(state).toEqual({ ...before, health: 100, spirituality: 3 }); expect(random.cursor).toBe(0);
  });

  it('does not charge, draw, mutate, or substitute resources at full health or below 3 spirituality', () => {
    for (const [health, spirituality] of [[100, 45], [100, 0], [75, 0], [75, 2], [75, 2.9],
      [75, Number.NaN], [75, Number.POSITIVE_INFINITY], [75, -1]] as const) {
      const state = fixture(); state.health = health; state.spirituality = spirituality;
      const before = structuredClone(state), random = stream(state);
      const effect = resolvePhysicianCombatAbility(state, preparation, 1, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(effect.label).toContain('恢复0、消耗0'); expect(effect.label).toContain('不抽随机盘');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('cannot use an invalid or ended source to heal an otherwise injured and funded player', () => {
    for (const mutate of [
      (s: SliceState) => { s.revision += 1; }, (s: SliceState) => { s.week += 1; },
      (s: SliceState) => { s.combat!.round += 1; }, (s: SliceState) => { s.combat = null; },
      (s: SliceState) => { s.world.carrierCanResist = false; }, (s: SliceState) => { s.world.carrierAlive = false; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.status = 'DEAD'; },
    ]) {
      const state = fixture(); state.health = 40;
      const source = currentPhysicianCombatSource(state); mutate(state);
      const before = structuredClone(state), random = stream(state);
      expect(resolvePhysicianCombatAbility(state, preparation, 1, random, source))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('performs only three real heals with 9 spirituality across five R slots, before normal recovery', () => {
    const state = fixture(); state.health = 70; state.spirituality = 9; state.mind = 50; state.seer.pollution = 33;
    state.injuryRisk = 2;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    const before = structuredClone(state), draws = scriptRolls(100, 1, 321, 400, 321, 321, 321, 321, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    const moves = round.moves.filter(move => move.actor === 'PLAYER');
    expect(moves).toHaveLength(5); expect(moves.slice(0, 3).every(move => move.label.includes('实际恢复6健康'))).toBe(true);
    expect(moves.slice(3).every(move => move.label.includes('灵性不足3'))).toBe(true);
    expect(moves.map(move => [move.selfGain, move.enemyReduction])).toEqual(Array(5).fill([0, 0]));
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(state.health).toBe(88); expect(state.spirituality).toBe(4.5);
    expect(state.injuries).toEqual(before.injuries); expect(state.injuryRisk).toBe(2);
    expect(state.mind).toBe(50); expect(state.seer).toEqual(before.seer);
    expect(state.progression).toEqual(before.progression); expect(state.physician).toEqual(before.physician);
    expect(state.combat!.enemyHealth).toBe(100); expect(draws).toHaveBeenCalledTimes(9);
  });

  it('rechecks source after an actual heal and blocks later R slots without paying again', () => {
    const state = fixture(); state.health = 50; state.spirituality = 9;
    const original = physicianCombat.resolvePhysicianCombatAbility;
    let calls = 0;
    vi.spyOn(physicianCombat, 'resolvePhysicianCombatAbility').mockImplementation((...args) => {
      const effect = original(...args);
      if (++calls === 1) state.world.carrierCanResist = false;
      return effect;
    });
    const draws = scriptRolls(100, 1, 321, 400, 321, 321, 321, 321, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    const moves = round.moves.filter(move => move.actor === 'PLAYER');
    expect(moves[0]!.label).toContain('实际恢复6健康');
    expect(moves.slice(1).every(move => move.label.includes('缺少本场'))).toBe(true);
    expect(state.health).toBe(56); expect(state.spirituality).toBe(10.5);
    expect(calls).toBe(5); expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(9);
  });

  it('changes later physical-slot health factors without adding direct healing advantage or revising round base', () => {
    const state = fixture(); state.health = 75;
    const draws = scriptRolls(100, 1, 321, 400, 1, 121, 201, 281, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[0, 0], [12, 0], [8.4 * 0.65, 0], [0, 21 * 0.65], [0, 6]]);
    expect(round.playerAdvantage).toBe(315 * 0.95 + (12 + 8.4 * 0.65));
    expect(state.health).toBe(81); expect(state.spirituality).toBe(45);
    expect(state.combat!.enemyHealth).toBe(90); expect(outcome).toBe('CONTINUE');
    expect(draws).toHaveBeenCalledTimes(10);
  });

  it('replays actual capped healing from a serialized state without altering the seed or cursor', () => {
    const state = fixture(); state.health = 97; state.spirituality = 3; state.random.cursor = 12;
    state.progression.mastery[preparation] = 500;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const firstRandom = stream(state), restoredRandom = stream(restored);
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    const first = resolvePhysicianCombatAbility(state, preparation, 1, firstRandom);
    const replayed = resolvePhysicianCombatAbility(restored, preparation, 1, restoredRandom);
    expect(first).toEqual(replayed); expect(first.label).toContain('实际恢复3健康');
    expect(state).toEqual(restored); expect(state.health).toBe(100); expect(state.spirituality).toBe(0);
    expect(firstRandom.cursor).toBe(12); expect(restoredRandom.cursor).toBe(12);
    expect(state.random.cursor).toBe(12); expect(forbidden).not.toHaveBeenCalled();
  });

  it('does not remove accumulated injury risk after reaching full health before a real defeat', () => {
    const state = fixture(); state.health = 94; state.spirituality = 10; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const before = structuredClone(state), draws = scriptRolls(1, 1, 371, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[0]!.label).toContain('实际恢复6健康');
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0); expect(state.spirituality).toBe(7);
    expect(state.injuryRisk).toBe(2); expect(state.injuries).toEqual(before.injuries);
    const afterDeath = structuredClone(state), random = stream(state);
    expect(currentPhysicianCombatSource(state)).toBeNull();
    expect(resolvePhysicianCombatAbility(state, preparation, 1, random)).toMatchObject({
      selfGain: 0, enemyReduction: 0, threatens: false,
    });
    expect(state).toEqual(afterDeath); expect(random.cursor).toBe(state.random.cursor);
    expect(draws).toHaveBeenCalledTimes(6);
  });
});
