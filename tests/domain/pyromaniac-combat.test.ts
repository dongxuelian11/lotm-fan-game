import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { PYROMANIAC_COUNT_WHEEL, currentPyromaniacDangerSource, currentPyromaniacFireSource,
  drawPyromaniacAbility, isPyromaniac, pyromaniacAbilityWheel, pyromaniacActionCount,
  resolvePyromaniacCombatAbility, type PyromaniacFireSource,
  type PyromaniacMoveId } from '../../src/domain/pyromaniac/combat.js';
import { createPyromaniacState } from '../../src/domain/pyromaniac/index.js';
import { HUNTER_COUNT_WHEEL, hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { PROVOKER_COUNT_WHEEL, provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import { SEER_COUNT_WHEEL, seerAbilityWheel } from '../../src/domain/seer/combat.js';
import { CLOWN_COUNT_WHEEL, clownAbilityWheel, currentClownDangerSource } from '../../src/domain/clown/combat.js';
import { MAGICIAN_COUNT_WHEEL, magicianAbilityWheel } from '../../src/domain/magician/combat.js';
import { AUDIENCE_COUNT_WHEEL, audienceAbilityWheel } from '../../src/domain/audience/combat.js';
import { MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel } from '../../src/domain/mindreader/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

function fixture(): SliceState {
  const state = createSliceRun('pyromaniac-combat-test', sliceDefaultCreationSelection, 'pyromaniac-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'hunter', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.pyromaniac = createPyromaniacState();
  Object.assign(state.pyromaniac.encounter, { status: 'FIGHTING', surveyed: true, safeLane: true,
    attemptWeek: state.week, startHistoryIndex: state.combatHistory.length });
  state.combat = { encounterId: 'PYROMANIAC_DISPUTE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: PyromaniacMoveId, factor = 1, source = currentPyromaniacFireSource(state)) {
  return resolvePyromaniacCombatAbility(state, id, factor, stream(state), source);
}
const fireIds = ['hunter.s7.flame-control', 'hunter.s7.compressed-fireball',
  'hunter.s7.flame-lance', 'hunter.s7.fire-raven'] as const;
/** Prescribe exact results while advancing the same production stream/cursor. */
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
afterEach(() => vi.restoreAllMocks());

describe('Pyromaniac S7 finite combat profile', () => {
  it('has six nonuniform action counts and only the explicit immediate sectors', () => {
    const state = fixture();
    expect(isPyromaniac(state)).toBe(true);
    expect(playerCountWheel(state)).toEqual(PYROMANIAC_COUNT_WHEEL);
    expect(playerCountWheel(state).map(x => x.weight)).toEqual([10, 15, 25, 25, 15, 10]);
    const wheel = playerAbilityWheel(state, null);
    expect(wheel).toEqual(pyromaniacAbilityWheel(null));
    const weights = [8, 8, 14, 8, 7, 8, 2, 10, 14, 10, 6, 3, 2];
    wheel.forEach((entry, index) => expect(entry.weight).toBeCloseTo(weights[index]!));
    expect(wheel.map(x => x.id)).toEqual(['STRIKE', 'BLOCK', 'hunter.s9.physical-enhancement', 'EVADE',
      'hunter.s9.hunting-instinct', 'hunter.s8.provocation', 'hunter.s8.hostility-aura', ...fireIds, 'OBSERVE', 'MISS']);
    expect(wheel.some(x => /jump|immunity|bullet|trap|tracking/.test(x.id))).toBe(false);
    wheel[0]!.weight = 0;
    const counts = playerCountWheel(state); counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(8);
    expect(playerCountWheel(state)[0]!.weight).toBe(10);
  });

  it('maps every exact count boundary to one through six actions', () => {
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3],
      [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) {
      expect(pyromaniacActionCount(roll!)).toBe(count);
    }
  });

  it('uses exact ×1.25 stance tickets and one draw per selected action', () => {
    const attackTickets = [40, 32, 70, 32, 28, 32, 8, 40, 70, 50, 30, 12, 8];
    expect(pyromaniacAbilityWheel('ATTACK').map(x => x.weight)).toEqual(attackTickets.map(x => x / 452 * 100));
    const neutral = pyromaniacAbilityWheel(null);
    let boundary = 0;
    for (const entry of neutral) {
      const first = boundary + 1; boundary += Math.round(entry.weight * 4);
      scriptRolls(first, boundary);
      const random = stream(fixture());
      expect(drawPyromaniacAbility(random, null)).toBe(entry.id);
      expect(drawPyromaniacAbility(random, null)).toBe(entry.id);
      expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
  });

  it('uses base450, core30/25/30/15, cap90 and max spirituality60 without buffing the enemy', () => {
    const state = fixture();
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    state.spirituality = 59;
    scriptRolls(1, 1, 452, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(473);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 6;
    scriptRolls(1, 1, 452, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(12);
  });

  it('retains ordinary strikes/block and exact inherited physical health scaling', () => {
    const state = fixture();
    expect(resolve(state, 'STRIKE', 0.8).selfGain).toBeCloseTo(9.6);
    expect(resolve(state, 'STRIKE', 0.8).threatens).toBe(true);
    expect(resolve(state, 'BLOCK')).toMatchObject({ selfGain: 0, enemyReduction: 10, threatens: false });
    state.town.clubLocation = 'HAND';
    expect(resolve(state, 'STRIKE', 0.8)).toMatchObject({ selfGain: 12.8, threatens: true });
    expect(resolve(state, 'STRIKE').label).toContain('持握原短棍');
    expect(resolve(state, 'hunter.s9.physical-enhancement', 0.8).selfGain).toBeCloseTo(22.4);
    expect(resolve(state, 'EVADE').enemyReduction).toBe(22);
    expect(state.spirituality).toBe(60);
  });

  it('preserves all earlier progression-selected wheels and the ordinary enemy', () => {
    const state = fixture();
    const profiles = [
      ['hunter', 9, HUNTER_COUNT_WHEEL, hunterAbilityWheel('CONTROL')],
      ['hunter', 8, PROVOKER_COUNT_WHEEL, provokerAbilityWheel('CONTROL')],
      ['diviner', 9, SEER_COUNT_WHEEL, seerAbilityWheel('CONTROL')],
      ['diviner', 8, CLOWN_COUNT_WHEEL, clownAbilityWheel('CONTROL')],
      ['diviner', 7, MAGICIAN_COUNT_WHEEL, magicianAbilityWheel(state, 'CONTROL')],
      ['audience', 9, AUDIENCE_COUNT_WHEEL, audienceAbilityWheel('CONTROL')],
      ['audience', 8, MINDREADER_COUNT_WHEEL, mindreaderAbilityWheel('CONTROL')],
      [null, null, ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel(false, 'CONTROL')],
    ] as const;
    for (const [pathwayId, sequence, counts, abilities] of profiles) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isPyromaniac(state)).toBe(false);
      expect(playerCountWheel(state)).toEqual(counts);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(abilities);
    }
    expect(ordinaryAbilityWheel(true, null).map(x => x.weight)).toEqual([40, 20, 20, 15, 5]);
    expect(currentClownDangerSource(state)).toBeNull();
  });
});

describe('authored safe fire and finite spirituality', () => {
  it('spends each spell cost exactly once and never directly mutates enemy health or cargo', () => {
    for (const [index, id] of fireIds.entries()) {
      const state = fixture(), before = structuredClone(state);
      const effect = resolve(state, id);
      expect(effect).toMatchObject({ selfGain: [0, 36, 32, 24][index], enemyReduction: index === 0 ? 18 : 0,
        threatens: index !== 0, angersEnemy: false });
      expect(state.spirituality).toBe(60 - [2, 3, 3, 2][index]!);
      before.spirituality = state.spirituality;
      expect(state).toEqual(before);
      expect(effect.label).toContain('（G）');
    }
  });

  it('creates its own fire without a lamp and reports the finite single-target boundary', () => {
    const state = fixture();
    state.magician.lantern.prepared = false; state.magician.lantern.oilSpent = 0;
    expect(currentPyromaniacFireSource(state)).toMatchObject({ encounterId: 'PYROMANIAC_DISPUTE',
      distanceMetres: 6, space: 'OPEN_BRICK_COURTYARD', lane: 'OWNER_CLEARED_CLOTH_CRATES', target: 'HAARN_SINGLE_ADULT' });
    for (const id of fireIds.slice(1)) {
      const effect = resolve(state, id);
      expect(effect.label).toContain('自身火焰');
      expect(effect.label).toContain('一个成人目标');
      expect(effect.label).toContain('不穿墙、不追加范围伤害');
    }
    expect(state.magician.lantern.oilSpent).toBe(0);
    expect(state.combat!.enemyHealth).toBe(100);
  });

  it('does not ignite cargo when the owner has not cleared the lane', () => {
    for (const id of fireIds) {
      const state = fixture(); state.pyromaniac.encounter.safeLane = false;
      const before = structuredClone(state), effect = resolve(state, id);
      expect(currentPyromaniacFireSource(state)).toBeNull();
      expect(effect).toMatchObject({ selfGain: id === fireIds[0] ? 0 : 12,
        enemyReduction: id === fireIds[0] ? 10 : 0, threatens: id !== fireIds[0] });
      expect(effect.label).toContain('未施法、未耗灵性，不重抽');
      expect(state).toEqual(before);
    }
  });

  it('rejects unsurveyed, departed, stopped and other-attempt sources', () => {
    const changes: ((s: SliceState) => void)[] = [
      s => { s.pyromaniac.encounter.surveyed = false; },
      s => { s.pyromaniac.encounter.status = 'RETREATED'; },
      s => { s.pyromaniac.encounter.attemptWeek = null; },
      s => { s.pyromaniac.encounter.attemptWeek = s.week - 1; },
      s => { s.pyromaniac.encounter.startHistoryIndex = null; },
      s => { s.world.city = 'ELSEWHERE'; },
      s => { s.combat!.enemyStatus = 'SURRENDERED'; },
      s => { s.combat!.enemyHealth = 0; },
    ];
    for (const change of changes) {
      const state = fixture(), source = currentPyromaniacFireSource(state);
      change(state); const before = structuredClone(state);
      expect(currentPyromaniacFireSource(state)).toBeNull();
      expect(resolve(state, 'hunter.s7.compressed-fireball', 1, source).selfGain).toBeLessThanOrEqual(12);
      expect(state).toEqual(before);
    }
  });

  it('rejects stale or forged round, geometry, target and attempt tokens without charging', () => {
    const state = fixture(), source = currentPyromaniacFireSource(state)!;
    const stale = [ { ...source, round: 2 }, { ...source, distanceMetres: 7 },
      { ...source, space: 'CLOSED_WAREHOUSE' }, { ...source, lane: 'THROUGH_CLOTH_CRATES' },
      { ...source, target: 'UNSEEN_GROUP' }, { ...source, encounterId: 'FIRST_CASE' },
      { ...source, attemptWeek: state.week + 1 }, { ...source, startHistoryIndex: source.startHistoryIndex + 1 } ];
    for (const invalid of stale) {
      const effect = resolve(state, 'hunter.s7.compressed-fireball', 1, invalid as PyromaniacFireSource);
      expect(effect.selfGain).toBe(12);
      expect(effect.label).toContain('未施法');
      expect(state.spirituality).toBe(60);
    }
  });

  it('does not invent a safe fire corridor for first-case, old cargo, or Weiss disputes', () => {
    for (const encounterId of ['FIRST_CASE', 'HUNTER_CARGO', 'PROVOKER_DISPUTE'] as const) {
      const state = fixture(); state.combat!.encounterId = encounterId;
      state.arc.stage = 'COMBAT'; state.world.carrierAlive = true; state.world.carrierCanResist = true;
      state.hunter.cargo.status = 'FIGHTING'; state.provoker.encounter.status = 'FIGHTING';
      expect(currentPyromaniacFireSource(state)).toBeNull();
      expect(resolve(state, 'hunter.s7.fire-raven').selfGain).toBe(12);
      expect(state.spirituality).toBe(60);
    }
  });

  it('cannot act with another profile, no fight, a dead player, or a finished run', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.progression.sequence = 8; },
      s => { s.combat = null; }, s => { s.health = 0; }, s => { s.status = 'DEAD'; }];
    for (const change of changes) {
      const state = fixture(); change(state); const before = structuredClone(state);
      for (const id of [...fireIds, 'STRIKE', 'hunter.s9.physical-enhancement'] as const) {
        expect(resolve(state, id)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(state).toEqual(before);
    }
  });

  it('at zero spirituality uses one ordinary fallback and no additional random draw', () => {
    const state = fixture(); state.spirituality = 0;
    for (const id of fireIds) {
      const random = stream(state), effect = resolvePyromaniacCombatAbility(state, id, 1, random);
      expect(effect).toMatchObject({ selfGain: id === fireIds[0] ? 0 : 12,
        enemyReduction: id === fireIds[0] ? 10 : 0, threatens: id !== fireIds[0] });
      expect(effect.label).toContain('灵性不足');
      expect(random.cursor).toBe(0);
      expect(state.spirituality).toBe(0);
    }
  });

  it('uses the current exact remaining resource rather than a round-start promise', () => {
    const state = fixture(); state.spirituality = 2;
    expect(resolve(state, 'hunter.s7.compressed-fireball').selfGain).toBe(12);
    expect(state.spirituality).toBe(2);
    expect(resolve(state, 'hunter.s7.flame-control').enemyReduction).toBe(18);
    expect(state.spirituality).toBe(0);
    expect(resolve(state, 'hunter.s7.fire-raven').selfGain).toBe(12);
    state.spirituality = 3;
    expect(resolve(state, 'hunter.s7.flame-lance').selfGain).toBe(32);
    expect(state.spirituality).toBe(0);
  });
});

describe('inherited facts and the shared round stream', () => {
  it('binds instinct to actual visible club sources and rejects stale or unrelated ones', () => {
    const state = fixture(), source = currentPyromaniacDangerSource(state)!;
    expect(resolve(state, 'hunter.s9.hunting-instinct').enemyReduction).toBe(15);
    expect(resolvePyromaniacCombatAbility(state, 'hunter.s9.hunting-instinct', 1, stream(state), null,
      { ...source, round: 2 }).enemyReduction).toBe(0);
    state.combat!.encounterId = 'HUNTER_CARGO'; state.hunter.cargo.status = 'FIGHTING';
    expect(resolve(state, 'hunter.s9.hunting-instinct').enemyReduction).toBe(15);
    expect(resolvePyromaniacCombatAbility(state, 'hunter.s9.hunting-instinct', 1, stream(state), null, source).enemyReduction).toBe(0);
    state.hunter.cargo.status = 'RETREATED';
    expect(currentPyromaniacDangerSource(state)).toBeNull();
  });

  it('never reuses Weiss secrets or an animal aura to control Haarn', () => {
    const state = fixture();
    state.provoker.cases['queue-boast']!.status = 'COMPLETED'; state.provoker.encounter.status = 'FIGHTING';
    const random = stream(state), before = structuredClone(state);
    expect(resolvePyromaniacCombatAbility(state, 'hunter.s8.provocation', 1, random))
      .toMatchObject({ selfGain: 0, enemyReduction: 0, angersEnemy: false });
    expect(resolvePyromaniacCombatAbility(state, 'hunter.s8.hostility-aura', 1, random))
      .toMatchObject({ selfGain: 0, enemyReduction: 0, angersEnemy: false });
    expect(random.cursor).toBe(0);
    expect(state).toEqual(before);
  });

  it('retains the genuine Weiss check in the same stream, affecting only his later ordinary draw', () => {
    const state = fixture(); state.combat!.encounterId = 'PROVOKER_DISPUTE';
    state.provoker.encounter.status = 'FIGHTING'; state.provoker.cases['queue-boast']!.status = 'OBSERVED';
    const draws = scriptRolls(1, 1, 188, 1, 180, 1);
    const { round } = resolveSliceCombatRound(state, 'CONTROL');
    expect(round.moves).toHaveLength(2);
    expect(round.moves[0]!.label).toContain('威斯');
    expect(round.moves[0]!.selfGain).toBe(10);
    expect(round.moves[1]!.label).toBe('短棍打击');
    expect(state.lastCheck?.roll).toBe(1);
    expect(state.random.cursor).toBe(6);
    expect(draws).toHaveBeenCalledTimes(6);
  });

  it('alternates six player actions with only three ordinary enemy actions and one injury draw', () => {
    const state = fixture();
    const draws = scriptRolls(91, 86, 283, 400, 283, 400, 283, 400, 283, 283, 283, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([6, 3]);
    expect(round.moves.map(x => x.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER']);
    expect(round.playerAdvantage).toBe(681);
    expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(48);
    expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(state.random.cursor).toBe(13);
    expect(draws).toHaveBeenCalledTimes(13);
    expect(outcome).toBe('CONTINUE');
  });

  it('replays identical seeds and does not generate extra raven or mastery actions', () => {
    const left = fixture(), right = structuredClone(left);
    expect(resolveSliceCombatRound(left, 'ATTACK')).toEqual(resolveSliceCombatRound(right, 'ATTACK'));
    expect(left).toEqual(right);
    const state = fixture();
    state.progression.mastery = Object.fromEntries(fireIds.map(id => [id, 500]));
    scriptRolls(1, 1, 403, 400, 1, 1, 1, 1, 400, 452, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    expect(first.round.moves[0]!.label).toContain('不产生独立或跨轮行动');
    const next = resolveSliceCombatRound(state, 'ATTACK');
    expect(next.round.moves).toHaveLength(2);
    expect(next.round.playerAdvantage).toBe(465);
    expect(next.round.moves.some(x => /火鸦/.test(x.label))).toBe(false);
  });

  it('names the actual surrendering opponent and grants no automatic immunity or revival', () => {
    const state = fixture();
    scriptRolls(1, 1, 283, 400, 1, 70);
    const surrender = resolveSliceCombatRound(state, 'ATTACK');
    expect(surrender.outcome).toBe('ENEMY_SURRENDERED');
    expect(surrender.round.consequence).toContain('短棍阻拦者哈恩仍然活着');
    expect(surrender.round.consequence).not.toMatch(/携铃者|威斯/);
    expect(state.spirituality).toBe(57);
    vi.restoreAllMocks();
    const doomed = fixture();
    scriptRolls(1, 1, 452, 1, 1_000_000, 100);
    expect(resolveSliceCombatRound(doomed, 'ATTACK').outcome).toBe('PLAYER_DEAD');
    expect(doomed.health).toBe(0);
    expect(doomed.spirituality).toBe(60);
  });
});
