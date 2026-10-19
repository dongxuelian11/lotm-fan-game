import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  BRIBER_COUNT_WHEEL, briberAbilityWheel, briberActionCount, consumeBriberWeakening,
  createBriberRoundContext, currentBriberCombatSource, drawBriberAbility, finishBriberCombatRound,
  isBriber, resolveBriberCombatAbility, type BriberCombatSource, type BriberMoveId,
} from '../../src/domain/briber/combat.js';
import * as briberCombat from '../../src/domain/briber/combat.js';
import { BARBARIAN_COUNT_WHEEL, barbarianAbilityWheel } from '../../src/domain/barbarian/combat.js';
import { LAWYER_COUNT_WHEEL, lawyerAbilityWheel } from '../../src/domain/lawyer/combat.js';
import { applyLawyerCommand, createLawyerState } from '../../src/domain/lawyer/index.js';
import { applyBarbarianCommand, createBarbarianState } from '../../src/domain/barbarian/index.js';
import { applyBriberCommand, createBriberState } from '../../src/domain/briber/index.js';
import { applyBriberActivity } from '../../src/domain/briber/life.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const body = 'black-emperor.s8.enhanced-body', insight = 'black-emperor.s9.weak-point-insight';
const bribery = 'black-emperor.s7.bribery-weakening', resistance = 'black-emperor.s8.mental-resistance';
const ids = [body, 'BODY_FOLLOWUP', bribery, 'POSITION', resistance, 'ACCIDENT'] as const;
/** Original S9 bottle and separately crafted/consumed S8/S7 bottles, plus purchased originals. */
function fixture(): SliceState {
  const state = createSliceRun('briber-combat-test', sliceDefaultCreationSelection, 'briber-combat');
  state.activeEvent = null; state.eventQueue = []; state.world.city = 'BACKLUND';
  state.week = 5; state.cash = 10_000; state.actionsRemaining = 40; state.weeklyBudget = 40;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.lawyer = createLawyerState(); state.barbarian = createBarbarianState(); state.briber = createBriberState();
  const context: SeerContext = {
    roll: minimum => minimum, note() {},
    check: (ability, difficulty) => resolveNormalCheck({ ability,
      baseAbility: state.character.coreStats[ability], difficulty, modifiers: [], roll: 20 }),
  };
  applyLawyerCommand(state, { type: 'DISCOVER' }, context);
  applyLawyerCommand(state, { type: 'LEARN_GUIDANCE' }, context);
  applyLawyerCommand(state, { type: 'BUY_POTION', bottleId: 'lawyer-potion-1' }, context);
  applyLawyerCommand(state, { type: 'CONSUME', bottleId: 'lawyer-potion-1', confirmed: true }, context);
  state.progression.acting = 100; state.week += 4;
  applyBarbarianCommand(state, { type: 'LEARN_FORMULA' }, context);
  applyBarbarianCommand(state, { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-1' }, context);
  applyBarbarianCommand(state, { type: 'BREW', batchId: 'barbarian-batch-1' }, context);
  applyBarbarianCommand(state, { type: 'CONSUME', bottleId: 'barbarian-batch-1:bottle', confirmed: true }, context);
  state.progression.acting = 100; state.week += 8;
  applyBriberCommand(state, { type: 'LEARN_FORMULA' }, context);
  applyBriberCommand(state, { type: 'BUY_MATERIALS', batchId: 'briber-batch-1' }, context);
  applyBriberCommand(state, { type: 'BREW', batchId: 'briber-batch-1' }, context);
  applyBriberCommand(state, { type: 'CONSUME', bottleId: 'briber-batch-1:bottle', confirmed: true }, context);
  applyBriberActivity(state, { type: 'BUY_GIFTS' }, context, () => {});
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.arc.stage = 'COMBAT'; state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.health = 100; state.mind = 100; state.spirituality = 60;
  return state;
}
const stream = (state: SliceState) => new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
function resolve(state: SliceState, id: BriberMoveId, physical = 1, context = createBriberRoundContext(state),
  source = currentBriberCombatSource(state)) {
  return resolveBriberCombatAbility(state, id, physical, stream(state), context, source);
}
/** Exact rolls advance the real deterministic cursor; no seed lookahead. */
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

describe('Briber S7 profile and inherited routes', () => {
  it('selects the S7 six-slot wheel while keeping actual S8 and S9 dispatch', () => {
    const state = fixture(); expect(isBriber(state)).toBe(true);
    expect(state.lawyer.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS' });
    expect(state.barbarian.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS' });
    expect(state.briber.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS' });
    expect(Object.keys(state.progression.mastery).sort()).toEqual([
      'black-emperor.s9.rule-analysis', 'black-emperor.s9.persuasive-argument', insight, body, resistance, bribery,
    ].sort());
    expect(playerAbilityWheel(state, null)).toEqual(briberAbilityWheel(null, state));
    expect(briberAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(briberAbilityWheel(null).map(entry => entry.weight)).toEqual([30, 20, 20, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(BRIBER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([10, 20, 25, 25, 20]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.isFrozen(BRIBER_COUNT_WHEEL)).toBe(true);
    expect(BRIBER_COUNT_WHEEL.every(Object.isFrozen)).toBe(true);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [30, 2], [31, 3], [55, 3],
      [56, 4], [80, 4], [81, 5], [100, 5]] as const) expect(briberActionCount(roll)).toBe(count);
    state.progression.sequence = 8;
    expect(isBriber(state)).toBe(false); expect(currentBriberCombatSource(state)).toBeNull();
    expect(playerAbilityWheel(state, 'ATTACK')).toEqual(barbarianAbilityWheel('ATTACK', state));
    expect(playerCountWheel(state)).toEqual(BARBARIAN_COUNT_WHEEL);
    state.progression.sequence = 9;
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(lawyerAbilityWheel('DEFEND', state));
    expect(playerCountWheel(state)).toEqual(LAWYER_COUNT_WHEEL);
  });

  it('uses exact stance ×5/4 tickets with one draw per slot and no gift draw', () => {
    for (const [stance, weights] of [
      [null, [120, 80, 80, 40, 60, 20]], ['ATTACK', [150, 100, 80, 40, 60, 20]],
      ['DEFEND', [120, 80, 100, 40, 60, 20]], ['CONTROL', [120, 80, 80, 50, 60, 20]],
      ['PREPARE', [120, 80, 80, 40, 75, 20]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(briberAbilityWheel(stance).map(entry => entry.weight))
        .toEqual(weights.map(weight => total === 400 ? weight / 4 : weight / total * 100));
    }
    const draws = scriptRolls(1, 150, 151, 250, 251, 330, 331, 370, 371, 430, 431, 450);
    const random = stream(fixture());
    expect(Array.from({ length: 12 }, () => drawBriberAbility(random, 'ATTACK'))).toEqual(ids.flatMap(id => [id, id]));
    expect(draws).toHaveBeenCalledTimes(12); expect(random.cursor).toBe(12);
    expect(briberAbilityWheel('RETREAT')).toEqual(briberAbilityWheel(null));
  });

  it('uses core30/40/15/15, tier450, cap90, floor45, max60 and recovery6', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 0; scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(471.5 * 0.8);
    expect(state.spirituality).toBe(6); vi.restoreAllMocks();
    const capped = fixture(); capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 0;
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(6); vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 59; scriptRolls(1, 1, 371, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(60); vi.restoreAllMocks();
    vi.spyOn(briberCombat, 'resolveBriberCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 371, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('uses inherited H54f/J37.8f, fallback B36.45f, ordinary K6 and inapplicable R0', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [body]: mastery, [insight]: mastery, [bribery]: 500, [resistance]: 500,
        BODY_FOLLOWUP: 500, POSITION: 500, 'black-emperor.s6.distortion': 500 };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = stream(state);
      const context = createBriberRoundContext(state);
      for (const [id, selfGain, enemyReduction, threatens] of [
        [body, 54 * factor * 0.8, 0, true], ['BODY_FOLLOWUP', 37.8 * factor * 0.8, 0, true],
        [bribery, 0, 36.45 * factor * 0.8, false], ['POSITION', 0, 6 * 0.8, false], [resistance, 0, 0, false],
      ] as const) expect(resolveBriberCombatAbility(state, id, 0.8, random, context))
        .toMatchObject({ selfGain, enemyReduction, threatens });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('only an actually held original club replaces H, without stacking inherited strength', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location;
      state.progression.mastery[body] = 500;
      const before = structuredClone(state);
      expect(resolve(state, body, 0.8).selfGain).toBe((location === 'HAND' ? 16 : 54) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(37.8 * 0.8);
      expect(briberAbilityWheel(null, state)[0]!.label).toBe(location === 'HAND' ? '持握原短棍打击' : '贿赂者继承强化身体打击');
      expect(state).toEqual(before);
    }
  });

  it('clamps mastery and physical inputs without inventing a mental attack or high-sequence power', () => {
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      const state = fixture(); state.progression.mastery[body] = mastery;
      const factor = mastery === 800 ? 1 : 0.65;
      expect(resolve(state, body).selfGain).toBe(54 * factor);
      for (const physical of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(resolve(state, body, physical).selfGain).toBe(0);
      expect(resolve(state, body, 2).selfGain).toBe(54 * factor);
    }
    const state = fixture(); state.mind = 40; state.spirituality = 0;
    Object.assign(state.combat!, { mentalAttack: true, agreedTerms: 'PRIVATE_TERMS', forcedConsent: true });
    const before = structuredClone(state);
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('No seed inspection'); },
      get cursor(): number { throw new Error('No cursor inspection'); },
      nextInt() { throw new Error('No invented mental attack draw'); },
    };
    const effect = resolveBriberCombatAbility(state, resistance, 1, forbidden, createBriberRoundContext(state));
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('没有正在使用的有来源精神攻击');
    expect(effect.label).not.toContain('PRIVATE_TERMS'); expect(state).toEqual(before);
  });
});

describe('Briber original gift, source and one-action pending state', () => {
  it('gives exactly one purchased original and spends exactly 3 once, with no immediate contribution', () => {
    const state = fixture(), context = createBriberRoundContext(state), before = structuredClone(state);
    const random = stream(state);
    expect(state.briber.gifts.map(gift => gift.id)).toEqual(['BR7-GIFT-1', 'BR7-GIFT-2', 'BR7-GIFT-3']);
    const first = resolveBriberCombatAbility(state, bribery, 1, random, context);
    expect(first).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(first.label).toContain('无需对方自愿接住或收下');
    expect(state.spirituality).toBe(57);
    expect(state.briber.gifts[0]).toEqual({ id: 'BR7-GIFT-1', location: 'GIVEN',
      destination: 'BATTLE:FIRST_CASE:GROUND', givenWeek: state.week });
    expect(state.briber.gifts.slice(1)).toEqual(before.briber.gifts.slice(1));
    expect(state.briber.giftPacks).toBe(before.briber.giftPacks);
    expect(context.pendingWeakening).toEqual({ giftId: 'BR7-GIFT-1', factor: 0.35 * 0.65 });
    const second = resolveBriberCombatAbility(state, bribery, 1, random, context);
    expect(second.enemyReduction).toBe(36.45 * 0.65); expect(second.label).toContain('不重复赠礼或支付');
    expect(state.spirituality).toBe(57); expect(state.briber.gifts.filter(gift => gift.location === 'GIVEN')).toHaveLength(1);
    expect(state.town).toEqual(before.town); expect(state.progression).toEqual(before.progression);
    expect(state.health).toBe(before.health); expect(state.mind).toBe(before.mind);
    expect(random.cursor).toBe(0);
  });

  it('does not pay or manufacture a gift without both an actual PLAYER original and 3 spirituality', () => {
    for (const spirituality of [0, 2.99, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.spirituality = spirituality;
      const before = structuredClone(state), context = createBriberRoundContext(state);
      expect(resolve(state, bribery, 1, context).enemyReduction).toBe(36.45 * 0.65);
      expect(context.pendingWeakening).toBeNull(); expect(state).toEqual(before);
    }
    const state = fixture(); state.briber.gifts = []; state.briber.giftPacks = 100;
    Object.assign(state.combat!, { gift: true, enemyAccepted: true });
    const before = structuredClone(state), context = createBriberRoundContext(state);
    expect(resolve(state, bribery, 1, context).label).toContain('没有实际持有的可赠原物');
    expect(context.pendingWeakening).toBeNull(); expect(state).toEqual(before);
    const exactly = fixture(); exactly.spirituality = 3;
    expect(resolve(exactly, bribery).enemyReduction).toBe(0); expect(exactly.spirituality).toBe(0);
  });

  it('uses only bribery mastery for the deferred factor and does not multiply it by bodily injury', () => {
    for (const mastery of [-20, 0, 100, 500, 900, Number.NaN, Number.POSITIVE_INFINITY]) {
      const state = fixture(); state.progression.mastery[bribery] = mastery;
      state.progression.mastery[body] = 500; state.progression.mastery[insight] = 500;
      const context = createBriberRoundContext(state);
      resolve(state, bribery, 0.8, context);
      const bounded = Number.isFinite(mastery) ? Math.max(0, Math.min(500, mastery)) : 0;
      expect(context.pendingWeakening?.factor).toBe(0.35 * (0.65 + 0.35 * bounded / 500));
    }
  });

  it('weakens both actual contributions for one player-targeted action and permits later original gifts', () => {
    const state = fixture(); state.progression.mastery[bribery] = 500;
    const context = createBriberRoundContext(state); resolve(state, bribery, 1, context);
    expect(consumeBriberWeakening(state, context, 'OTHER', 16, 10)).toBeNull();
    expect(context.pendingWeakening).not.toBeNull();
    const response = consumeBriberWeakening(state, context, 'PLAYER', 16, 10)!;
    expect(response).toMatchObject({ selfGain: 16 * 0.65, enemyReduction: 10 * 0.65 });
    expect(response.label).toContain('16→10.4'); expect(response.label).toContain('10→6.5');
    expect(context.pendingWeakening).toBeNull();
    expect(consumeBriberWeakening(state, context, 'PLAYER', 16, 10)).toBeNull();
    resolve(state, bribery, 1, context);
    expect(context.pendingWeakening?.giftId).toBe('BR7-GIFT-2'); expect(state.spirituality).toBe(54);
    expect(state.briber.gifts.filter(gift => gift.location === 'GIVEN')).toHaveLength(2);
  });

  it('consumes a pending effect on a real MISS with zero contribution and expires unused effects', () => {
    const state = fixture(), context = createBriberRoundContext(state);
    resolve(state, bribery, 1, context);
    expect(consumeBriberWeakening(state, context, 'PLAYER', 0, 0)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(context.pendingWeakening).toBeNull(); expect(finishBriberCombatRound(context)).toBeNull();
    resolve(state, bribery, 1, context);
    expect(finishBriberCombatRound(context)).toContain('原物仍留在战场地面，不自动归还');
    expect(context.pendingWeakening).toBeNull(); expect(finishBriberCombatRound(context)).toBeNull();
    expect(state.briber.gifts[1]!.location).toBe('GIVEN'); expect(state.spirituality).toBe(54);
  });

  it('requires current present source before paying, including round identity and all inherited actions', () => {
    const state = fixture(), source = currentBriberCombatSource(state)!;
    const invalid: (BriberCombatSource | null)[] = [null, { ...source, runId: 'other' },
      { ...source, revision: source.revision + 1 }, { ...source, week: source.week - 1 }, { ...source, round: 2 },
      ...(['encounterId', 'target', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as BriberCombatSource)];
    const before = structuredClone(state), random = stream(state), context = createBriberRoundContext(state);
    for (const input of invalid) for (const id of ids)
      expect(resolveBriberCombatAbility(state, id, 1, random, context, input))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state).toEqual(before); expect(context.pendingWeakening).toBeNull(); expect(random.cursor).toBe(0);
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.status = 'SLICE_COMPLETE'; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.health = Number.POSITIVE_INFINITY; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyHealth = Number.NaN; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; }, (s: SliceState) => { s.combat!.round = 0; },
      (s: SliceState) => { s.world.carrierCanResist = false; }, (s: SliceState) => { s.world.carrierAlive = false; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; },
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.progression.pathwayId = 'wheel'; },
    ]) {
      const ended = fixture(), staleContext = createBriberRoundContext(ended); mutate(ended);
      const beforeEnded = structuredClone(ended), noDraws = stream(ended);
      expect(currentBriberCombatSource(ended)).toBeNull();
      for (const id of ids) expect(resolveBriberCombatAbility(ended, id, 1, noDraws, staleContext))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(ended).toEqual(beforeEnded); expect(noDraws.cursor).toBe(0);
    }
  });

  it('never lets an old round or a no-longer-given original trigger its pending effect', () => {
    const state = fixture(), context = createBriberRoundContext(state);
    resolve(state, bribery, 1, context); state.combat!.round += 1;
    expect(consumeBriberWeakening(state, context, 'PLAYER', 16, 0)).toBeNull();
    const before = structuredClone(state);
    expect(resolve(state, bribery, 1, context).enemyReduction).toBe(0); expect(state).toEqual(before);
    state.combat!.round -= 1; state.briber.gifts[0]!.destination = 'OTHER';
    expect(consumeBriberWeakening(state, context, 'PLAYER', 16, 0)).toBeNull();
  });
});

describe('Briber actual alternating rounds, expiry and shared outcomes', () => {
  it('weakens exactly the next real action and logs original→actual without changing slot counts', () => {
    const state = fixture(); state.spirituality = 10;
    const before = structuredClone(state), draws = scriptRolls(100, 100, 251, 1, 371, 161, 371, 321, 371, 371, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[16 * (1 - 0.35 * 0.65), 0], [0, 10], [0, 8]]);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(round.moves[1]!.label).toContain('16→12.36');
    expect(round.moves[3]!.label).not.toContain('贿赂削弱'); expect(round.moves[5]!.label).not.toContain('贿赂削弱');
    expect(round.playerAdvantage).toBe(465 * 0.8 - 18);
    expect(round.enemyAdvantage).toBe(114 + 16 * (1 - 0.35 * 0.65));
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(13); expect(state.health).toBe(100); expect(state.combat!.enemyHealth).toBe(100);
    expect(state.progression).toEqual(before.progression); expect(state.lawyer).toEqual(before.lawyer);
    expect(state.barbarian).toEqual(before.barbarian); expect(state.town).toEqual(before.town);
    expect(state.week).toBe(before.week); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(Object.keys(state.combat!).sort()).toEqual(Object.keys(before.combat!).sort());
    expect(draws).toHaveBeenCalledTimes(11); expect(state.random.cursor).toBe(before.random.cursor + 11);
  });

  it('applies weakening to actual defense pressure too, while the next MISS consumes it', () => {
    for (const [enemyTicket, expectedReduction] of [[161, 10 * (1 - 0.35 * 0.65)], [321, 8 * (1 - 0.35 * 0.65)], [400, 0]] as const) {
      const state = fixture(); const draws = scriptRolls(1, 1, 251, enemyTicket, 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[1]).toMatchObject({ selfGain: 0, enemyReduction: expectedReduction });
      expect(round.moves[1]!.label).toContain('本次后失效'); expect(round.consequence).not.toContain('待用贿赂削弱已失效');
      expect(round.moves).toHaveLength(2); expect(draws).toHaveBeenCalledTimes(5); vi.restoreAllMocks();
    }
  });

  it('spends only once while pending and does not buy control with repeated B after enemy slots run out', () => {
    const state = fixture(); state.spirituality = 20;
    scriptRolls(100, 1, 371, 400, 251, 251, 251, 251, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    const playerMoves = round.moves.filter(move => move.actor === 'PLAYER');
    expect(playerMoves.map(move => move.enemyReduction)).toEqual([0, 0, 36.45 * 0.65, 36.45 * 0.65, 36.45 * 0.65]);
    expect(state.briber.gifts.filter(gift => gift.location === 'GIVEN')).toHaveLength(1);
    expect(state.spirituality).toBe(23); expect(round.consequence).toContain('待用贿赂削弱已失效');
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyStatus).toBe('RESISTING');
  });

  it('does not retroactively weaken an earlier enemy turn and carries nothing into the next round', () => {
    const state = fixture(); state.combat!.round = 2; state.spirituality = 10;
    scriptRolls(1, 1, 1, 251, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK').round;
    expect(first.first).toBe('ENEMY'); expect(first.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER']);
    expect(first.moves[0]!.selfGain).toBe(16); expect(first.enemyAdvantage).toBe(130);
    expect(first.consequence).toContain('不追溯此前动作'); expect(state.spirituality).toBe(13);
    vi.restoreAllMocks(); scriptRolls(1, 1, 371, 1, 1);
    const next = resolveSliceCombatRound(state, 'ATTACK').round;
    expect(next.moves[1]!.selfGain).toBe(16); expect(next.moves[1]!.label).not.toContain('贿赂削弱');
    expect(state.briber.gifts[0]!.location).toBe('GIVEN');
  });

  it('never gives B/K/R or ±11.25 accident permission to injure or kill', () => {
    for (const [ticket, accident] of [[251, 0], [331, 0], [371, 0], [431, 1], [431, 2]] as const) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = accident ? scriptRolls(1, 1, ticket, accident, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(accident === 1 ? -11.25 : accident === 2 ? 11.25 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(accident ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('keeps H/J on the shared injury, surrender and death draw with no terminal recovery', () => {
    for (const [ticket, consequenceRoll, outcome, health] of [[1, 66, 'ENEMY_SURRENDERED', 70], [151, 96, 'ENEMY_DEAD', 0]] as const) {
      const state = fixture(); state.spirituality = 10;
      const draws = scriptRolls(1, 1, ticket, 400, 1, consequenceRoll);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyHealth).toBe(health);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(state.spirituality).toBe(10); expect(draws).toHaveBeenCalledTimes(6); vi.restoreAllMocks();
    }
  });

  it('still permits real player death after a weakened strike, retaining its given original and cost', () => {
    const state = fixture(); state.health = 40; state.mind = 25; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 251, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16 * (1 - 0.35 * 0.65));
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0); expect(state.spirituality).toBe(2);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.briber.gifts[0]!.destination).toBe('BATTLE:FIRST_CASE:GROUND');
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('expires terminal pending effects and retains ground originals after surrender or death', () => {
    for (const consequence of [66, 96]) {
      const state = fixture(); state.spirituality = 10;
      scriptRolls(11, 1, 1, 400, 251, 1, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(consequence === 66 ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(result.round.consequence).toContain('待用贿赂削弱已失效');
      expect(state.spirituality).toBe(7); expect(state.briber.gifts[0]!.location).toBe('GIVEN');
      expect(Object.keys(state.combat!)).not.toContain('pendingWeakening'); vi.restoreAllMocks();
    }
  });

  it('keeps the ordinary 50% retreat and never gives, refunds or returns originals on retreat', () => {
    const state = fixture(); state.spirituality = 10;
    scriptRolls(1, 1, 251, 400, 1); resolveSliceCombatRound(state, 'ATTACK'); vi.restoreAllMocks();
    const gifts = structuredClone(state.briber.gifts), spirituality = state.spirituality;
    // Even round: an enemy MISS occurs before the player's existing retreat slot.
    const draws = scriptRolls(100, 100, 400, 50);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(outcome).toBe('RETREATED'); expect(round.retreat).toBe('SUCCESS');
    expect(state.briber.gifts).toEqual(gifts); expect(state.spirituality).toBe(spirituality);
    expect(draws).toHaveBeenCalledTimes(4); vi.restoreAllMocks();
    const failed = fixture(); failed.spirituality = 10; const before = structuredClone(failed.briber.gifts);
    const failureDraws = scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const result = resolveSliceCombatRound(failed, 'RETREAT');
    expect(result.round.retreat).toBe('FAILURE'); expect(result.round.moves).toHaveLength(1);
    expect(result.outcome).toBe('CONTINUE'); expect(failed.health).toBe(90); expect(failed.spirituality).toBe(16);
    expect(failed.briber.gifts).toEqual(before); expect(failureDraws).toHaveBeenCalledTimes(6);
  });

  it('replays serialized original custody and multiple seeded rounds without any persisted pending flag', () => {
    const state = fixture(); state.random.cursor = 7; state.town.clubLocation = 'HAND'; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    const oneRound = [1, 1, 251, 1, 1], secondRound = [1, 1, 400, 251, 1];
    scriptRolls(...oneRound, ...secondRound, ...oneRound, ...secondRound);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    const second = resolveSliceCombatRound(state, 'ATTACK');
    expect(first).toEqual(resolveSliceCombatRound(restored, 'ATTACK'));
    expect(second).toEqual(resolveSliceCombatRound(restored, 'ATTACK'));
    expect(first.round.moves[1]!.label).toContain('贿赂削弱');
    expect(second.round.consequence).toContain('待用贿赂削弱已失效');
    expect(state.briber.gifts.filter(gift => gift.location === 'GIVEN')).toHaveLength(2);
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(Object.keys(state.combat!)).not.toContain('pendingWeakening');
    expect(state.town.clubLocation).toBe('HAND');
  });
});
