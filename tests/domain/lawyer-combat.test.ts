import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { LAWYER_COUNT_WHEEL, currentLawyerCombatSource, drawLawyerAbility, isLawyer,
  lawyerAbilityWheel, lawyerActionCount, resolveLawyerCombatAbility,
  type LawyerCombatSource, type LawyerMoveId } from '../../src/domain/lawyer/combat.js';
import * as lawyerCombat from '../../src/domain/lawyer/combat.js';
import { MONSTER_COUNT_WHEEL, monsterAbilityWheel } from '../../src/domain/monster/combat.js';
import { MACHINE_COUNT_WHEEL, machineAbilityWheel } from '../../src/domain/machine/combat.js';
import { LUCKY_COUNT_WHEEL, luckyAbilityWheel } from '../../src/domain/lucky/combat.js';
import { PRISONER_COUNT_WHEEL, prisonerAbilityWheel } from '../../src/domain/prisoner/combat.js';
import { MADMAN_COUNT_WHEEL, madmanAbilityWheel } from '../../src/domain/madman/combat.js';
import { WEREWOLF_COUNT_WHEEL, werewolfAbilityWheel } from '../../src/domain/werewolf/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const insight = 'black-emperor.s9.weak-point-insight', analysis = 'black-emperor.s9.rule-analysis';
const persuasion = 'black-emperor.s9.persuasive-argument';
const ids = ['STRIKE', 'BODY_FOLLOWUP', insight, 'POSITION', analysis, 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('lawyer-combat-test', sliceDefaultCreationSelection, 'lawyer-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'black-emperor', sequence: 9, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 30;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: LawyerMoveId, physical = 1,
  source = currentLawyerCombatSource(state)) {
  return resolveLawyerCombatAbility(state, id, physical, stream(state), source);
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

describe('Lawyer S9 exact G profile and strict dispatch', () => {
  it('uses 30/20/20/10/15/5 slots and independent 15/20/25/25/15 counts', () => {
    const state = fixture();
    expect(isLawyer(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(lawyerAbilityWheel(null, state));
    expect(lawyerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(lawyerAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(LAWYER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([15, 20, 25, 25, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(15);
    expect(Object.isFrozen(LAWYER_COUNT_WHEEL)).toBe(true);
    expect(LAWYER_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
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
      expect(lawyerAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(n => sum === 400 ? n / 4 : n / sum * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draws = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawLawyerAbility(random, stance)).toBe(ids[index]);
        expect(drawLawyerAbility(random, stance)).toBe(ids[index]);
        expect(draws).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2); vi.restoreAllMocks();
      }
      expect(boundary).toBe(sum);
    }
    expect(lawyerAbilityWheel('RETREAT')).toEqual(lawyerAbilityWheel(null));
  });

  it('dispatches every count boundary with no additional RNG draw or enemy slot', () => {
    for (const [roll, count] of [[1, 1], [15, 1], [16, 2], [35, 2], [36, 3], [60, 3],
      [61, 4], [85, 4], [86, 5], [100, 5]] as const) {
      expect(lawyerActionCount(roll)).toBe(count);
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

  it('uses core25/45/15/15, tier200, cap40, floor20 and max30 with recovery3', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; const before = structuredClone(state);
    scriptRolls(1, 1, 371, 400, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('CONTINUE'); expect(round.playerAdvantage).toBe(222 * 0.8);
    expect(round.enemyAdvantage).toBe(114); expect(state.spirituality).toBe(3);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.weeklyBudget).toBe(before.weeklyBudget); expect(state.progression).toEqual(before.progression);
    expect(state.world).toEqual(before.world); expect(state.town).toEqual(before.town); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(144);
    expect(capped.spirituality).toBe(3); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 29;
    scriptRolls(1, 1, 371, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(30); vi.restoreAllMocks();
    vi.spyOn(lawyerCombat, 'resolveLawyerCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(20);
  });

  it('leaves unimplemented Black Emperor sequences ordinary and preserves all Wheel and Chained profiles', () => {
    const state = fixture();
    for (const sequence of [2, null] as const) {
      state.progression.sequence = sequence;
      expect(isLawyer(state)).toBe(false); expect(currentLawyerCombatSource(state)).toBeNull();
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
  });

  it('keeps unknown sequence rounds exactly on the ordinary fallback, including actual held gear', () => {
    for (const sequence of [2, null] as const) {
      const state = fixture(); state.progression.sequence = sequence; state.town.clubLocation = 'HAND';
      state.progression.mastery = { [insight]: 500, [persuasion]: 500, [analysis]: 500,
        'black-emperor.s8.physical-strength': 500, 'black-emperor.s7.bribery': 500 };
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

describe('Lawyer ordinary body, observed weaknesses and unavailable negotiable rules', () => {
  it('uses 12/8.4/18f/6 budgets, no body mastery and zero spiritual cost at all nodes', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [persuasion]: mastery, [insight]: mastery, [analysis]: mastery,
        STRIKE: 500, BODY_FOLLOWUP: 500, POSITION: 500, 'black-emperor.s8.physical-strength': 500, 'black-emperor.s7.bribery': 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      expect(resolveLawyerCombatAbility(state, 'STRIKE', 0.8, random))
        .toMatchObject({ selfGain: 12 * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveLawyerCombatAbility(state, 'BODY_FOLLOWUP', 0.8, random))
        .toMatchObject({ selfGain: 8.4 * 0.8, enemyReduction: 0, threatens: true });
      expect(resolveLawyerCombatAbility(state, insight, 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 18 * factor * 0.8, threatens: false });
      expect(resolveLawyerCombatAbility(state, 'POSITION', 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 6 * 0.8, threatens: false });
      expect(resolveLawyerCombatAbility(state, analysis, 0.8, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const separate = fixture(); separate.progression.mastery = { [insight]: 0, [persuasion]: 500, [analysis]: 500 };
    expect(resolve(separate, insight).enemyReduction).toBe(18 * 0.65);
  });

  it('bounds malformed insight mastery and physical factors without new spiritual costs', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[insight] = mastery;
      expect(resolve(state, insight).enemyReduction).toBe(18 * (mastery === 800 ? 1 : 0.65));
      expect(resolve(state, 'STRIKE').selfGain).toBe(12);
    }
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(), before = structuredClone(state);
      for (const id of ['STRIKE', 'BODY_FOLLOWUP', insight, 'POSITION'] as const) {
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
      state.progression.mastery = { [persuasion]: 500, [insight]: 500, [analysis]: 500 };
      const before = structuredClone(state), random = stream(state);
      const source = { ...currentLawyerCombatSource(state)!, heldTool: 'town-short-club', toolReady: true };
      expect(resolveLawyerCombatAbility(state, 'STRIKE', 0.8, random, source).selfGain)
        .toBe((location === 'HAND' ? 16 : 12) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(8.4);
      expect(playerAbilityWheel(state, null)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '普通近身打击');
      expect(resolveLawyerCombatAbility(state, analysis, 1, random, source))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(); state.town.clubLocation = 'HAND'; const source = currentLawyerCombatSource(state);
    state.town.clubLocation = 'BAG'; expect(resolve(state, 'STRIKE', 1, source).selfGain).toBe(12);
  });

  it('never invents agreement, negotiable terms, consent, hidden facts or future information', () => {
    const state = fixture(); state.progression.mastery = { [persuasion]: 500, [insight]: 500, [analysis]: 500,
      'black-emperor.s7.bribery': 500, 'black-emperor.s6.distortion': 500 };
    state.knowledge.push({ id: 'unrelated-terms', week: state.week, title: '旧记录',
      text: 'PRIVATE_TERMS IMPLIED_CONSENT FUTURE_ROLL' });
    Object.assign(state.combat!, { agreedTerms: 'PRIVATE_TERMS', forcedConsent: true, futureResult: 'FUTURE_ROLL' });
    const source = { ...currentLawyerCombatSource(state)!, agreedTerms: 'PRIVATE_TERMS', consent: true };
    const before = structuredClone(state), random = stream(state);
    const effect = resolveLawyerCombatAbility(state, analysis, 1, random, source);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    for (const text of ['没有可协商条款或已达成协议', '不能凭空制造规则漏洞',
      '贡献0、消耗0', '不造成伤害', '不保证胜利', '不强制同意', '说服不是精神控制']) expect(effect.label).toContain(text);
    expect(effect.label).not.toMatch(/PRIVATE_TERMS|IMPLIED_CONSENT|FUTURE_ROLL/);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    const changed = structuredClone(state); changed.random.seed = 'changed-future'; changed.random.cursor = 39;
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('Do not inspect the seed'); },
      get cursor(): number { throw new Error('Do not inspect the cursor'); },
      nextInt() { throw new Error('Do not draw agreement or a prediction'); },
    };
    for (const id of [insight, analysis] as const) {
      expect(resolveLawyerCombatAbility(changed, id, 1, forbidden)).toEqual(resolve(state, id));
    }
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(entry => entry.id)).not.toContain(persuasion);
    expect(resolve(state, 'POSITION').label).toContain('不以口才强制同意');
  });

  it('derives only the current ordinary body and refuses every stale or forged source', () => {
    const state = fixture(), source = currentLawyerCombatSource(state)!;
    expect(source).toEqual({ runId: state.runId, revision: state.revision, week: state.week,
      encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE', exit: 'ORDINARY_OPEN_EXIT' });
    const invalid: (LawyerCombatSource | null)[] = [null,
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED_SECRET' }) as unknown as LawyerCombatSource)];
    const before = structuredClone(state);
    for (const input of invalid) {
      const random = stream(state);
      for (const id of ids) expect(resolveLawyerCombatAbility(state, id, 1, random, input))
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
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.pathwayId = 'chained'; }, (s: SliceState) => { s.progression.pathwayId = null; },
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.progression.sequence = 7; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
    ]) {
      const state = fixture(); mutate(state); const before = structuredClone(state), random = stream(state);
      expect(currentLawyerCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveLawyerCombatAbility(state, id, 1, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Lawyer shared rounds, injury, death, retreat and replay', () => {
  it('keeps five rule-analysis slots source-bound and nonthreatening, with no extra draws or resource loop', () => {
    const state = fixture(); state.town.clubLocation = 'HAND'; state.spirituality = 0;
    const before = structuredClone(state), draws = scriptRolls(100, 1, 321, 400, 321, 321, 321, 321, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'PREPARE');
    const moves = round.moves.filter(move => move.actor === 'PLAYER');
    expect(moves).toHaveLength(5);
    expect(moves.every(move => move.label.includes('没有可协商条款或已达成协议'))).toBe(true);
    expect(moves.map(move => [move.selfGain, move.enemyReduction])).toEqual(Array(5).fill([0, 0]));
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
    expect(state.spirituality).toBe(3); expect(state.health).toBe(100); expect(state.mind).toBe(100);
    expect(state.town).toEqual(before.town); expect(state.progression).toEqual(before.progression);
    expect(state.knowledge).toEqual(before.knowledge);
    expect(draws).toHaveBeenCalledTimes(9); expect(state.random.cursor).toBe(before.random.cursor + 9);
  });

  it('alternates five player slots and three unmodified enemy slots in the shared round', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 251, 1, 331, 371, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[12, 0], [8.4, 0], [0, 18 * 0.65], [0, 6], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
    expect(round.playerAdvantage).toBe(215 * 0.9 + (12 + 8.4));
    expect(round.enemyAdvantage).toBe(114 + 48 - (18 * 0.65 + 6));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(13); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.week).toBe(before.week);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(12); expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('preserves even-round initiative without treating enemy actions as agreement', () => {
    const state = fixture(); state.combat!.round = 2;
    const draws = scriptRolls(100, 100, 400, 371, 400, 371, 400, 371, 371, 371, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.first).toBe('ENEMY'); expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.filter(move => move.actor === 'PLAYER').every(move => move.label.includes('不能凭空制造规则漏洞'))).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyHealth).toBe(100);
    expect(draws).toHaveBeenCalledTimes(11);
  });

  it('never permits injury from insight, position, analysis or either unmodified accident outcome', () => {
    for (const [ticket, accident] of [[251, 0], [331, 0], [371, 0], [431, 1], [431, 2]] as const) {
      const state = fixture(); state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
      const draws = accident ? scriptRolls(1, 1, ticket, accident, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(accident === 1 ? -5 : accident === 2 ? 5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(accident ? 6 : 5);
      vi.restoreAllMocks();
    }
  });

  it('keeps real opponent attacks and mental penalties despite insight or ordinary footwork', () => {
    for (const ticket of [251, 331]) {
      const state = fixture(); state.mind = 25;
      const draws = scriptRolls(1, 100, ticket, 1, 1, 1, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16]);
      expect(round.moves).toHaveLength(4); expect(round.playerAdvantage).toBe(215 * 0.8);
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

  it('retains accumulated injury risk and real player death despite weak-point insight or analysis', () => {
    for (const ticket of [251, 371]) {
      const state = fixture(); state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
      state.town.clubLocation = 'HAND'; const town = structuredClone(state.town);
      state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
      const draws = scriptRolls(1, 1, ticket, 1, 1_000_000, 96);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[1]!.selfGain).toBe(16); expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
      expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
      expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5);
      expect(state.town).toEqual(town); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('keeps the ordinary exit and its 50% retreat boundary with no guaranteed consent or recovery', () => {
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
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90); expect(state.spirituality).toBe(13);
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
