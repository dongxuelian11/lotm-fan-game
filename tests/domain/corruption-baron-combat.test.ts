import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import {
  CORRUPTION_BARON_COUNT_WHEEL, corruptionBaronAbilityWheel, corruptionBaronActionCount,
  consumeCorruptionBaronWeakening, createCorruptionBaronRoundContext, currentCorruptionBaronCombatSource,
  drawCorruptionBaronAbility, finishCorruptionBaronCombatRound, isCorruptionBaron, resolveCorruptionBaronCombatAbility,
  type CorruptionBaronCombatSource, type CorruptionBaronMoveId,
} from '../../src/domain/corruption-baron/combat.js';
import * as baronCombat from '../../src/domain/corruption-baron/combat.js';
import { createCorruptionBaronState } from '../../src/domain/corruption-baron/index.js';
import { BRIBER_COUNT_WHEEL, briberAbilityWheel, currentBriberCombatSource, createBriberRoundContext,
  resolveBriberCombatAbility } from '../../src/domain/briber/combat.js';
import { BARBARIAN_COUNT_WHEEL, barbarianAbilityWheel } from '../../src/domain/barbarian/combat.js';
import { LAWYER_COUNT_WHEEL, lawyerAbilityWheel } from '../../src/domain/lawyer/combat.js';
import { applyLawyerCommand, createLawyerState } from '../../src/domain/lawyer/index.js';
import { applyBarbarianCommand, createBarbarianState } from '../../src/domain/barbarian/index.js';
import { applyBriberCommand, createBriberState } from '../../src/domain/briber/index.js';
import { applyBriberActivity } from '../../src/domain/briber/life.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const H = 'black-emperor.s8.enhanced-body', J = 'BODY_FOLLOWUP', B = 'black-emperor.s7.bribery-weakening';
const K = 'black-emperor.s6.distortion', R = 'black-emperor.s8.mental-resistance', A = 'ACCIDENT';
const insight = 'black-emperor.s9.weak-point-insight', ids = [H, J, B, K, R, A] as const;
/** Original S9 bottle and separately crafted/consumed S8/S7 bottles, plus purchased originals. */
function fixture(firstCase = false): SliceState {
  const state = createSliceRun('corruption-baron-combat-test', sliceDefaultCreationSelection, 'corruption-baron-combat');
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
  state.corruptionBaron = createCorruptionBaronState();
  state.progression.sequence = 6; state.progression.mastery[K] = 0;
  state.corruptionBaron.encounter = { status: 'FIGHTING', attemptWeek: state.week, startHistoryIndex: 0 };
  Object.assign(Object.values(state.corruptionBaron.cases)[0]!, { status: 'RESOLVED', method: 'ORDINARY' });
  state.arc.stage = firstCase ? 'COMBAT' : 'ENDED';
  state.combat!.encounterId = firstCase ? 'FIRST_CASE' : 'CORRUPTION_BARON_DISPUTE';
  state.spirituality = 80; state.town.clubLocation = 'SHOP';
  return state;
}
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-corruption-baron-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const value = rolls[cursor++];
    if (value === undefined || value < minimum || value > maximum) throw new Error('Unexpected random draw');
    return value;
  } };
}
function resolve(state: SliceState, id: CorruptionBaronMoveId, physical = 1,
  context = createCorruptionBaronRoundContext(state), source = currentCorruptionBaronCombatSource(state), random = fixedRolls()) {
  return resolveCorruptionBaronCombatAbility(state, id, physical, random, context, source);
}
function nextRound(state: SliceState): void {
  const round: SliceCombatRound = { round: state.combat!.round, stance: 'PREPARE', first: 'PLAYER',
    playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 665,
    enemyAdvantage: 114, winChance: 80, winner: 'PLAYER', consequence: '', consequenceWeights: null, retreat: 'NONE' };
  state.combatHistory.push(round); state.combat!.lastRound = round; state.combat!.round += 1;
}
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

describe('Corruption Baron exact S6 wheel and inherited routes', () => {
  it('uses only black-emperor6, six30/15/25/10/15/5 slots and detached10/15/25/30/20 counts', () => {
    const state = fixture(); expect(isCorruptionBaron(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(corruptionBaronAbilityWheel(null, state));
    expect(playerAbilityWheel(state, null).map(x => x.id)).toEqual(ids);
    expect(playerAbilityWheel(state, null).map(x => x.weight)).toEqual([30, 15, 25, 10, 15, 5]);
    expect(playerCountWheel(state)).toEqual(CORRUPTION_BARON_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 25, 30, 20]);
    playerAbilityWheel(state, null)[0]!.weight = 0; playerCountWheel(state)[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(30); expect(playerCountWheel(state)[0]!.weight).toBe(10);
    expect(Object.keys(state.progression.mastery).filter(x => x.includes('.s6.'))).toEqual([K]);
    state.progression.pathwayId = 'wheel'; expect(isCorruptionBaron(state)).toBe(false);
  });

  it('retains every count boundary and exact1.25 stance tickets with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [80, 4], [81, 5], [100, 5]] as const)
      expect(corruptionBaronActionCount(roll)).toBe(count);
    for (const stance of [null, 'ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosted = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2]
        : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const weights = [30, 15, 25, 10, 15, 5].map((weight, index) => weight * (boosted.includes(index) ? 5 : 4));
      const total = weights.reduce((sum, value) => sum + value, 0); let boundary = 0;
      corruptionBaronAbilityWheel(stance).forEach((entry, index) => {
        expect(entry.weight).toBe(total === 400 ? weights[index]! / 4 : weights[index]! / total * 100);
        const first = boundary + 1; boundary += weights[index]!; const random = fixedRolls(first, boundary);
        expect(drawCorruptionBaronAbility(random, stance)).toBe(ids[index]);
        expect(drawCorruptionBaronAbility(random, stance)).toBe(ids[index]); expect(random.cursor).toBe(2);
      });
    }
  });

  it('does not widen original lawyer/barbarian/briber routes, S7 source, budgets or accident coin', () => {
    const state = fixture(true);
    for (const [sequence, count, wheel] of [[9, LAWYER_COUNT_WHEEL, lawyerAbilityWheel],
      [8, BARBARIAN_COUNT_WHEEL, barbarianAbilityWheel], [7, BRIBER_COUNT_WHEEL, briberAbilityWheel]] as const) {
      state.progression.sequence = sequence; expect(isCorruptionBaron(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(count); expect(playerAbilityWheel(state, null)).toEqual(wheel(null, state));
      expect(currentCorruptionBaronCombatSource(state)).toBeNull();
    }
    expect(currentBriberCombatSource(state)).not.toBeNull();
    const context = createBriberRoundContext(state), random = fixedRolls(2);
    expect(resolveBriberCombatAbility(state, H, 1, random, context).selfGain).toBe(54 * 0.65);
    expect(resolveBriberCombatAbility(state, J, 1, random, context).selfGain).toBe(37.8 * 0.65);
    expect(resolveBriberCombatAbility(state, A, 1, random, context).selfGain).toBe(11.25);
    expect(random.cursor).toBe(1); state.combat!.encounterId = 'CORRUPTION_BARON_DISPUTE';
    expect(currentBriberCombatSource(state)).toBeNull(); state.progression.sequence = 6;
    expect(currentBriberCombatSource(state)).toBeNull();
    expect(resolveBriberCombatAbility(state, B, 1, fixedRolls(), createBriberRoundContext(state)).enemyReduction).toBe(0);
  });
});

describe('Corruption Baron six finite slots and real resources', () => {
  it('uses old body mastery for H59.15/J41.405, ignoring distortion mastery', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery[H] = mastery; state.progression.mastery[K] = 500;
      const f = 0.65 + 0.35 * mastery / 500, before = structuredClone(state), random = fixedRolls();
      expect(resolve(state, H, 0.8, undefined, undefined, random)).toMatchObject({ selfGain: 59.15 * f * 0.8, enemyReduction: 0, threatens: true });
      expect(resolve(state, J, 0.8, undefined, undefined, random)).toMatchObject({ selfGain: 41.405 * f * 0.8, enemyReduction: 0, threatens: true });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('only actual town HAND club substitutes16, never Vaughan ownership or a bag item', () => {
    for (const location of ['SHOP', 'BAG', 'HAND'] as const) {
      const state = fixture(); state.town.clubLocation = location; state.progression.mastery[H] = 500;
      const before = structuredClone(state);
      expect(resolve(state, H, 0.8).selfGain).toBe((location === 'HAND' ? 16 : 59.15) * 0.8);
      expect(resolve(state, J, 0.8).selfGain).toBe(41.405 * 0.8); expect(state).toEqual(before);
      if (location === 'HAND') expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
    }
  });

  it('K spends3 for46.475 times only new distortion mastery, without physical injury or forced will', () => {
    for (const mastery of [0, 100, 500]) {
      const state = fixture(); state.progression.mastery[K] = mastery; state.progression.mastery[H] = 500;
      state.health = 55; state.mind = 67; state.injuryRisk = 4; state.seer.pollution = 7;
      const before = structuredClone(state), random = fixedRolls();
      const effect = resolve(state, K, 0, undefined, undefined, random);
      expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 46.475 * (0.65 + 0.35 * mastery / 500), threatens: false });
      expect(effect.label).toContain('不强制服从'); expect(effect.label).toContain('不搬移人物或物件');
      before.spirituality -= 3; expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('B/K fallback at insufficient or nonfinite S spends nothing and preserves actual originals', () => {
    for (const spirituality of [0, 1, 2.99, Number.NaN, Infinity]) {
      const state = fixture(); state.spirituality = spirituality;
      state.progression.mastery[insight] = 100; state.progression.mastery[K] = 500;
      const before = structuredClone(state), context = createCorruptionBaronRoundContext(state);
      expect(resolve(state, B, 0.8, context).enemyReduction).toBe(36.45 * (0.65 + 0.35 * 100 / 500) * 0.8);
      expect(resolve(state, K, 0.8, context).enemyReduction).toBe(6 * 0.8);
      expect(context.pendingWeakening).toBeNull(); expect(state).toEqual(before);
    }
    const exact = fixture(); exact.spirituality = 3;
    expect(resolve(exact, K).enemyReduction).toBe(46.475 * 0.65); expect(exact.spirituality).toBe(0);
  });

  it('R ignores invented mental sources and A is fixed−16.25 with no RNG, payment or threat', () => {
    const state = fixture(); state.spirituality = 0; state.progression.mastery[R] = 500;
    Object.assign(state.combat!, { mentalAttack: true, forcedConsent: true, nextOutcome: 'PRIVATE_FUTURE' });
    const forbidden: ActionRandomStream = {
      get seed(): string { throw new Error('No seed inspection'); },
      get cursor(): number { throw new Error('No cursor inspection'); }, nextInt() { throw new Error('No invented draw'); },
    };
    const before = structuredClone(state), effect = resolve(state, R, 1, undefined, undefined, forbidden);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('没有正在使用的有来源精神攻击'); expect(effect.label).not.toContain('PRIVATE_FUTURE');
    expect(resolve(state, A, 0, undefined, undefined, forbidden)).toMatchObject({ selfGain: -16.25, enemyReduction: 0, threatens: false });
    expect(state).toEqual(before);
  });

  it('bounds malformed masteries and physical factors without letting body suppress nonphysical K', () => {
    for (const mastery of [-1, Number.NaN, Infinity, 900]) for (const physical of [-1, Number.NaN, Infinity, 0, 0.8, 1, 3]) {
      const state = fixture(); state.briber.gifts = [];
      state.progression.mastery = { [H]: mastery, [insight]: mastery, [K]: mastery };
      const factor = mastery === 900 ? 1 : 0.65, body = Number.isFinite(physical) ? Math.max(0, Math.min(1, physical)) : 0;
      expect(resolve(state, H, physical).selfGain).toBe(59.15 * factor * body);
      expect(resolve(state, J, physical).selfGain).toBe(41.405 * factor * body);
      expect(resolve(state, B, physical).enemyReduction).toBe(36.45 * factor * body);
      expect(resolve(state, K, physical).enemyReduction).toBe(46.475 * factor);
    }
  });
});

describe('Corruption Baron inherited original gifts and one-action pending effect', () => {
  it('gives one real S7-purchased original, spends3 once, has no immediate contribution or acceptance gate', () => {
    const state = fixture(), context = createCorruptionBaronRoundContext(state), before = structuredClone(state);
    expect(state.lawyer.bottles[0]!.status).toBe('CONSUMED'); expect(state.barbarian.bottles[0]!.status).toBe('CONSUMED');
    expect(state.briber.bottles[0]!.status).toBe('CONSUMED'); expect(state.briber.giftPacks).toBe(1);
    const effect = resolve(state, B, 0.8, context);
    expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(effect.label).toContain('无需对方自愿接住或收下'); expect(state.spirituality).toBe(77);
    expect(state.briber.gifts[0]).toEqual({ id: 'BR7-GIFT-1', location: 'GIVEN',
      destination: 'BATTLE:CORRUPTION_BARON_DISPUTE:GROUND', givenWeek: state.week });
    expect(state.briber.gifts.slice(1)).toEqual(before.briber.gifts.slice(1)); expect(state.briber.giftPacks).toBe(1);
    expect(context.pendingWeakening).toEqual({ giftId: 'BR7-GIFT-1', factor: 0.35 * 0.65 });
    expect(resolve(state, B, 0.8, context).enemyReduction).toBe(36.45 * 0.65 * 0.8);
    expect(state.spirituality).toBe(77); expect(state.briber.gifts.filter(g => g.location === 'GIVEN')).toHaveLength(1);
    expect(state.corruptionBaron).toEqual(before.corruptionBaron); expect(state.town).toEqual(before.town);
    expect(state.progression).toEqual(before.progression); expect(state.lawyer).toEqual(before.lawyer);
    expect(state.barbarian).toEqual(before.barbarian);
  });

  it('does not duplicate, return, borrow other-destination originals or synthesize from pack counters', () => {
    const state = fixture(); state.briber.gifts.forEach(g => { g.location = 'GIVEN'; g.destination = 'CASE:parting-gift:MIREI'; g.givenWeek = state.week; });
    state.briber.giftPacks = 100; Object.assign(state.combat!, { gift: true, enemyAccepted: true });
    const before = structuredClone(state), context = createCorruptionBaronRoundContext(state);
    expect(resolve(state, B, 1, context).label).toContain('没有实际持有的可赠原物');
    expect(context.pendingWeakening).toBeNull(); expect(state).toEqual(before);
  });

  it('only original bribery mastery controls pending strength, independent of new K and injured body', () => {
    for (const mastery of [-20, 0, 100, 500, 900, Number.NaN, Infinity]) {
      const state = fixture(); state.progression.mastery[B] = mastery; state.progression.mastery[K] = 500;
      const context = createCorruptionBaronRoundContext(state); resolve(state, B, 0, context);
      const bounded = Number.isFinite(mastery) ? Math.max(0, Math.min(500, mastery)) : 0;
      expect(context.pendingWeakening?.factor).toBe(0.35 * (0.65 + 0.35 * bounded / 500));
    }
  });

  it('weakens both actual contributions once, leaves OTHER alone and permits a later real original', () => {
    const state = fixture(); state.progression.mastery[B] = 500;
    const context = createCorruptionBaronRoundContext(state); resolve(state, B, 1, context);
    expect(consumeCorruptionBaronWeakening(state, context, 'OTHER', 16, 10)).toBeNull();
    const effect = consumeCorruptionBaronWeakening(state, context, 'PLAYER', 16, 10)!;
    expect(effect).toMatchObject({ selfGain: 16 * 0.65, enemyReduction: 10 * 0.65 });
    expect(effect.label).toContain('16→10.4'); expect(effect.label).toContain('10→6.5');
    expect(context.pendingWeakening).toBeNull(); expect(consumeCorruptionBaronWeakening(state, context, 'PLAYER', 16, 10)).toBeNull();
    resolve(state, B, 1, context); expect(context.pendingWeakening?.giftId).toBe('BR7-GIFT-2');
    expect(state.spirituality).toBe(74);
  });

  it('consumes a real MISS, expires unused effect at round end and never returns its original', () => {
    const state = fixture(), context = createCorruptionBaronRoundContext(state); resolve(state, B, 1, context);
    expect(consumeCorruptionBaronWeakening(state, context, 'PLAYER', 0, 0)).toMatchObject({ selfGain: 0, enemyReduction: 0 });
    expect(context.pendingWeakening).toBeNull(); expect(finishCorruptionBaronCombatRound(context)).toBeNull();
    resolve(state, B, 1, context); expect(finishCorruptionBaronCombatRound(context)).toContain('原物仍留在战场地面，不自动归还');
    expect(context.pendingWeakening).toBeNull(); expect(finishCorruptionBaronCombatRound(context)).toBeNull();
    expect(state.briber.gifts[1]!.location).toBe('GIVEN'); expect(state.spirituality).toBe(74);
  });

  it('cannot use a stale round, stolen custody, changed destination/week or nonexistent original', () => {
    for (const mutate of [
      (s: SliceState) => { nextRound(s); }, (s: SliceState) => { s.briber.gifts[0]!.location = 'PLAYER'; },
      (s: SliceState) => { s.briber.gifts[0]!.destination = 'BATTLE:FIRST_CASE:GROUND'; },
      (s: SliceState) => { s.briber.gifts[0]!.givenWeek = s.week - 1; }, (s: SliceState) => { s.briber.gifts = []; },
    ]) {
      const state = fixture(), context = createCorruptionBaronRoundContext(state); resolve(state, B, 1, context); mutate(state);
      const before = structuredClone(state); expect(consumeCorruptionBaronWeakening(state, context, 'PLAYER', 16, 0)).toBeNull();
      expect(state).toEqual(before);
    }
  });
});

describe('Corruption Baron current source and closed practice', () => {
  it('binds Vaughan and his own HAND club at2m with real open exit, retaining the carrier source', () => {
    const state = fixture();
    expect(currentCorruptionBaronCombatSource(state)).toMatchObject({ encounterId: 'CORRUPTION_BARON_DISPUTE',
      target: 'VAUGHN_SINGLE_ADULT_ORDINARY_HUMAN', nature: 'ORDINARY_HUMAN', weapon: 'VAUGHNS_OWN_ORDINARY_SHORT_CLUB',
      weaponLocation: 'HAND', distanceMetres: 2, bystanders: 'NONE', exit: 'ORIGINAL_OPEN_EXIT', pursuit: false });
    const first = fixture(true); expect(currentCorruptionBaronCombatSource(first)).toMatchObject({
      encounterId: 'FIRST_CASE', target: 'CURRENT_VISIBLE_ORDINARY_CARRIER' });
    const context = createCorruptionBaronRoundContext(first); resolve(first, B, 1, context);
    expect(first.briber.gifts[0]!.destination).toBe('BATTLE:FIRST_CASE:GROUND');
    expect(resolve(first, H, 1, context, currentCorruptionBaronCombatSource(state)).selfGain).toBe(0);
    state.corruptionBaron.practice = { clauseOrder: 'RESTORED', marker: 'STOPPED', route: 'FREE' };
    expect(currentCorruptionBaronCombatSource(state)).not.toBeNull();
  });

  it('rejects forged/stale run,revision,week,round,target,weapon,exit or arrival before payment/RNG', () => {
    const state = fixture(), source = currentCorruptionBaronCombatSource(state)!;
    const sources: (CorruptionBaronCombatSource | null)[] = [null, { ...source, runId: 'other' },
      { ...source, revision: source.revision + 1 }, { ...source, week: source.week + 1 }, { ...source, round: 2 },
      ...[{ target: 'UNKNOWN_BODY' }, { weapon: 'STOLEN_CLUB' }, { weaponLocation: 'GROUND' },
        { pursuit: true }, { bystanders: 'CROWD' }, { distanceMetres: 20 }, { startHistoryIndex: 1 },
        { attemptWeek: 0 }, { exit: 'CLOSED' }, { body: 'REMOTE' }, { encounterId: 'FIRST_CASE' }]
        .map(patch => ({ ...source, ...patch }) as unknown as CorruptionBaronCombatSource)];
    const before = structuredClone(state), context = createCorruptionBaronRoundContext(state), random = fixedRolls();
    for (const input of sources) for (const id of ids)
      expect(resolve(state, id, 1, context, input, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(state).toEqual(before); expect(context.pendingWeakening).toBeNull(); expect(random.cursor).toBe(0);
  });

  it('rejects death,absent opponent,unclosed practice,stale arrival or broken history with no mutation', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.mind = 0; },
      (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyHealth = 0; },
      (s: SliceState) => { s.combat!.enemyMind = 0; }, (s: SliceState) => { s.combat!.enemyHealth = Infinity; },
      (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.combat!.round = 0; }, (s: SliceState) => { s.combat!.round = 2; },
      (s: SliceState) => { s.corruptionBaron.encounter.status = 'AVAILABLE'; },
      (s: SliceState) => { s.corruptionBaron.encounter.attemptWeek = null; },
      (s: SliceState) => { s.corruptionBaron.encounter.startHistoryIndex = -1; },
      (s: SliceState) => { s.corruptionBaron.practice.clauseOrder = 'PENDING'; },
      (s: SliceState) => { s.corruptionBaron.practice.clauseOrder = 'ADJUSTED'; },
      (s: SliceState) => { s.corruptionBaron.practice.marker = 'ROLLING'; },
      (s: SliceState) => { s.corruptionBaron.practice.marker = 'SIDE_POCKET'; },
      (s: SliceState) => { s.corruptionBaron.practice.route = 'MOVING'; },
      (s: SliceState) => { s.corruptionBaron.practice.route = 'DIVERTED'; },
      (s: SliceState) => { Object.values(s.corruptionBaron.cases)[0]!.contactOpen = true; },
      (s: SliceState) => { Object.values(s.corruptionBaron.cases)[0]!.status = 'PREPARED'; },
      (s: SliceState) => { Object.values(s.corruptionBaron.cases)[0]!.status = 'AVAILABLE'; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.winner = null; },
      (s: SliceState) => { nextRound(s); s.combatHistory[0]!.retreat = 'SUCCESS'; },
    ]) {
      const state = fixture(), context = createCorruptionBaronRoundContext(state); mutate(state);
      const before = structuredClone(state), random = fixedRolls();
      expect(currentCorruptionBaronCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolve(state, id, 1, context, undefined, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
  });

  it('keeps FIRST_CASE presence gates rather than borrowing a completed courtyard or practice source', () => {
    for (const mutate of [
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.arc.stage = 'ENDED'; }, (s: SliceState) => { s.corruptionBaron.practice.route = 'MOVING'; },
    ]) {
      const state = fixture(true); mutate(state); const before = structuredClone(state);
      expect(currentCorruptionBaronCombatSource(state)).toBeNull();
      expect(() => resolveSliceCombatRound(state, 'ATTACK')).toThrow(); expect(state).toEqual(before);
    }
  });
});

describe('Corruption Baron actual alternating rounds and shared consequences', () => {
  it('uses core35/15/20/30,650/cap130/floor65,max80 and continuing-round regeneration8', () => {
    const state = fixture(); state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 72; scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(674.5); expect(state.spirituality).toBe(80);
    vi.restoreAllMocks(); const dry = fixture(); dry.spirituality = 0; scriptRolls(1, 1, 366, 400, 1);
    expect(resolveSliceCombatRound(dry, 'ATTACK').round.playerAdvantage).toBe(665 * 0.8); expect(dry.spirituality).toBe(8);
    vi.restoreAllMocks(); const cap = fixture(); cap.spirituality = 79;
    cap.character.coreStats = { physique: 1_000, perception: 1_000, will: 1_000, knowledge: 1_000 };
    scriptRolls(1, 1, 366, 400, 1); expect(resolveSliceCombatRound(cap, 'ATTACK').round.playerAdvantage).toBe(780);
    expect(cap.spirituality).toBe(80); vi.restoreAllMocks();
    vi.spyOn(baronCombat, 'resolveCorruptionBaronCombatAbility').mockReturnValue({
      label: 'controlled negative budget', selfGain: -10_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 366, 400, 1); expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(65);
  });

  it('draws H/J/B/K/R in five real slots and weakens only the next actual enemy action', () => {
    const state = fixture(); state.spirituality = 70; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 151, 1, 226, 1, 326, 366, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction]))
      .toEqual([[59.15 * 0.65, 0], [41.405 * 0.65, 0], [0, 0], [0, 46.475 * 0.65], [0, 0]]);
    expect(round.moves.filter(move => move.actor === 'ENEMY').map(move => move.selfGain)).toEqual([16, 16, 16 * (1 - 0.35 * 0.65)]);
    expect(round.moves[1]!.label).not.toContain('贿赂削弱'); expect(round.moves[5]!.label).toContain('16→12.36');
    expect(round.playerAdvantage).toBeCloseTo(665 + 59.15 * 0.65 + 41.405 * 0.65, 10);
    expect(round.enemyAdvantage).toBeCloseTo(114 + 32 + 16 * (1 - 0.35 * 0.65) - 46.475 * 0.65, 10);
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90); expect(state.spirituality).toBe(72);
    expect(state.corruptionBaron).toEqual(before.corruptionBaron); expect(state.world).toEqual(before.world);
    expect(state.progression).toEqual(before.progression); expect(state.town).toEqual(before.town);
    expect(Object.keys(state.combat!)).not.toContain('pendingWeakening'); expect(round.passiveLuck).toBeUndefined();
    expect(draws.mock.calls).toEqual([[1, 100], [1, 100], [1, 445], [1, 400], [1, 445], [1, 400],
      [1, 445], [1, 400], [1, 445], [1, 445], [1, 1_000_000], [1, 100]]);
    expect(state.random.cursor).toBe(before.random.cursor + 12);
  });

  it('applies pending to actual block/distance and consumes a zero-contribution MISS', () => {
    for (const [ticket, reduction] of [[161, 10 * (1 - 0.35 * 0.65)], [321, 8 * (1 - 0.35 * 0.65)], [400, 0]] as const) {
      const state = fixture(), draws = scriptRolls(1, 1, 226, ticket, 1);
      const { round } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[1]).toMatchObject({ selfGain: 0, enemyReduction: reduction });
      expect(round.moves[1]!.label).toContain('本次后失效'); expect(round.consequence).not.toContain('待用贿赂削弱已失效');
      expect(draws).toHaveBeenCalledTimes(5); vi.restoreAllMocks();
    }
  });

  it('repeated B after enemy slots end only defends and expires without refunds', () => {
    const state = fixture(); state.spirituality = 20;
    scriptRolls(100, 1, 366, 400, 226, 226, 226, 226, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => move.enemyReduction))
      .toEqual([0, 0, 36.45 * 0.65, 36.45 * 0.65, 36.45 * 0.65]);
    expect(state.briber.gifts.filter(gift => gift.location === 'GIVEN')).toHaveLength(1);
    expect(state.spirituality).toBe(25); expect(round.consequence).toContain('待用贿赂削弱已失效');
    expect(round.consequenceWeights).toBeNull(); expect(state.combat!.enemyStatus).toBe('RESISTING');
  });

  it('even initiative never weakens an earlier action or carries pending into a later round', () => {
    const state = fixture(); nextRound(state); state.spirituality = 10;
    scriptRolls(1, 1, 1, 226, 1); const first = resolveSliceCombatRound(state, 'ATTACK').round;
    expect(first.first).toBe('ENEMY'); expect(first.moves.map(move => move.actor)).toEqual(['ENEMY', 'PLAYER']);
    expect(first.moves[0]!.selfGain).toBe(16); expect(first.consequence).toContain('不追溯此前动作');
    state.combatHistory.push(first); vi.restoreAllMocks(); scriptRolls(1, 1, 366, 1, 1);
    const second = resolveSliceCombatRound(state, 'ATTACK').round;
    expect(second.moves[1]!.selfGain).toBe(16); expect(second.moves[1]!.label).not.toContain('贿赂削弱');
    expect(state.briber.gifts[0]!.location).toBe('GIVEN');
  });

  it('B/K/R/A cannot wound, drain mind, force surrender or draw an extra consequence', () => {
    for (const [ticket, gain] of [[226, 0], [326, 0], [366, 0], [445, -16.25]] as const) {
      const state = fixture(), draws = scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(gain); expect(round.consequenceWeights).toBeNull();
      expect(outcome).toBe('CONTINUE'); expect(draws).toHaveBeenCalledTimes(5);
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      vi.restoreAllMocks();
    }
  });

  it('H/J still share real surrender/death and terminal pending keeps its gifted original and cost', () => {
    for (const [ticket, consequence, outcome, health] of [[1, 66, 'ENEMY_SURRENDERED', 70], [151, 96, 'ENEMY_DEAD', 0]] as const) {
      const state = fixture(); state.spirituality = 10;
      const draws = scriptRolls(11, 1, ticket, 400, 226, 1, consequence);
      const result = resolveSliceCombatRound(state, 'ATTACK');
      expect(result.outcome).toBe(outcome); expect(state.combat!.enemyHealth).toBe(health);
      expect(result.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
      expect(result.round.consequence).toContain('待用贿赂削弱已失效'); expect(result.round.consequence).toContain('沃恩');
      expect(result.round.consequence).not.toContain('箱子'); expect(state.spirituality).toBe(7);
      expect(state.briber.gifts[0]!.location).toBe('GIVEN'); expect(draws).toHaveBeenCalledTimes(7);
      vi.restoreAllMocks();
    }
  });

  it('actual player death can follow a weakened attack and does not refund,heal or restore gifts', () => {
    const state = fixture(); state.health = 40; state.mind = 25; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    const draws = scriptRolls(1, 1, 226, 1, 1_000_000, 96), result = resolveSliceCombatRound(state, 'ATTACK');
    expect(result.round.moves[1]!.selfGain).toBe(16 * (1 - 0.35 * 0.65)); expect(result.outcome).toBe('PLAYER_DEAD');
    expect(state.health).toBe(0); expect(state.spirituality).toBe(2); expect(state.injuryRisk).toBe(2);
    expect(result.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.briber.gifts[0]!.destination).toBe('BATTLE:CORRUPTION_BARON_DISPUTE:GROUND');
    expect(draws).toHaveBeenCalledTimes(6); const dead = structuredClone(state);
    expect(resolve(state, K).enemyReduction).toBe(0); expect(state).toEqual(dead);
  });

  it('retreat follows real50% exit with no chase,player slot or gift/refund on success; failure still injures', () => {
    const state = fixture(); state.spirituality = 10; scriptRolls(1, 1, 226, 400, 1);
    const prior = resolveSliceCombatRound(state, 'ATTACK').round; state.combatHistory.push(prior); vi.restoreAllMocks();
    const gifts = structuredClone(state.briber.gifts), spirituality = state.spirituality;
    const draws = scriptRolls(100, 100, 400, 50); const result = resolveSliceCombatRound(state, 'RETREAT');
    expect(result.outcome).toBe('RETREATED'); expect(result.round.retreat).toBe('SUCCESS');
    expect(result.round.moves.map(m => m.actor)).toEqual(['ENEMY']); expect(state.briber.gifts).toEqual(gifts);
    expect(state.spirituality).toBe(spirituality); expect(result.round.consequence).toContain('原普通出口');
    expect(result.round.consequence).toContain('没有瞬移、移物或进入追逐'); expect(result.round.consequence).toContain('不退款、不归还');
    expect(draws).toHaveBeenCalledTimes(4); vi.restoreAllMocks();
    const failed = fixture(); failed.spirituality = 10; const before = structuredClone(failed.briber.gifts);
    const failedDraws = scriptRolls(1, 1, 51, 1, 1_000_000, 1), failure = resolveSliceCombatRound(failed, 'RETREAT');
    expect(failure.round.retreat).toBe('FAILURE'); expect(failure.round.moves).toHaveLength(1);
    expect(failed.health).toBe(90); expect(failed.spirituality).toBe(18); expect(failed.briber.gifts).toEqual(before);
    expect(failedDraws).toHaveBeenCalledTimes(6);
  });

  it('keeps original carrier terminal text and deterministically replays original custody across rounds', () => {
    const first = fixture(true); scriptRolls(1, 1, 1, 1, 1, 66);
    const result = resolveSliceCombatRound(first, 'ATTACK'); expect(result.outcome).toBe('ENEMY_SURRENDERED');
    expect(result.round.consequence).toContain('携铃者'); expect(result.round.consequence).toContain('箱子');
    expect(result.round.consequence).not.toContain('沃恩'); vi.restoreAllMocks();
    for (const firstCase of [false, true]) {
      const state = fixture(firstCase), restored = JSON.parse(JSON.stringify(state)) as SliceState;
      const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
      const one = [1, 1, 226, 1, 1], two = [1, 1, 400, 226, 1]; scriptRolls(...one, ...two, ...one, ...two);
      const a = resolveSliceCombatRound(state, 'ATTACK'); state.combatHistory.push(a.round);
      const b = resolveSliceCombatRound(state, 'ATTACK'); state.combatHistory.push(b.round);
      const ar = resolveSliceCombatRound(restored, 'ATTACK'); restored.combatHistory.push(ar.round);
      const br = resolveSliceCombatRound(restored, 'ATTACK'); restored.combatHistory.push(br.round);
      expect(a).toEqual(ar); expect(b).toEqual(br); expect(state).toEqual(restored);
      expect(state.briber.gifts.filter(g => g.location === 'GIVEN')).toHaveLength(2);
      expect(Object.keys(state.combat!)).not.toContain('pendingWeakening'); expect(forbidden).not.toHaveBeenCalled();
      vi.restoreAllMocks();
    }
  });
});
