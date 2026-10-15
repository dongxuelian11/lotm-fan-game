import {FERRYMAN_COUNT_WHEEL,ferrymanAbilityWheel} from '../../src/domain/ferryman/combat.js';
import {DEATH_CONSUL_COUNT_WHEEL,deathConsulAbilityWheel} from '../../src/domain/death-consul/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { GRAVEDIGGER_COUNT_WHEEL, gravediggerAbilityWheel, gravediggerActionCount,
  currentGravediggerCombatSource, drawGravediggerAbility, isGravedigger,
  resolveGravediggerCombatAbility, type GravediggerCombatSource, type GravediggerMoveId,
} from '../../src/domain/gravedigger/combat.js';
import { CORPSECOLLECTOR_COUNT_WHEEL, corpsecollectorAbilityWheel, currentCorpsecollectorCombatSource,
  isCorpsecollector, resolveCorpsecollectorCombatAbility,
} from '../../src/domain/corpsecollector/combat.js';
import { BARD_COUNT_WHEEL, bardAbilityWheel } from '../../src/domain/bard/combat.js';
import { SAILOR_COUNT_WHEEL, sailorAbilityWheel } from '../../src/domain/sailor/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';

const physique = 'death.s9.corpse-physique';
const sight = 'death.s9.spiritual-sight', knowledge = 'death.s9.undead-knowledge';
const eye = 'death.s8.death-eye', contact = 'death.s8.spirit-contact';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', 'COVER', 'SITE_PRESSURE', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('gravedigger-combat-test', sliceDefaultCreationSelection, 'gravedigger-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'death', sequence: 8, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 45;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: GravediggerMoveId, physical = 1) {
  return resolveGravediggerCombatAbility(state, id, physical, stream(state));
}
/** Keep real cursor consumption while selecting exact shared-wheel boundaries. */
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

describe('Gravedigger S8 Death V2 profile', () => {
  it('routes exact 20/15/20/30/8/7 slots and independent 30/30/25/15 counts', () => {
    const state = fixture();
    expect(isGravedigger(state)).toBe(true);
    expect(gravediggerAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(gravediggerAbilityWheel(null).map(entry => entry.weight)).toEqual([20, 15, 20, 30, 8, 7]);
    expect(playerAbilityWheel(state, null)).toEqual(gravediggerAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(GRAVEDIGGER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([30, 30, 25, 15]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20);
    expect(playerCountWheel(state)[0]!.weight).toBe(30);
  });

  it('preserves every action-count and ability boundary with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [30, 1], [31, 2], [60, 2], [61, 3], [85, 3], [86, 4], [100, 4]]) {
      expect(gravediggerActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of gravediggerAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draw = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawGravediggerAbility(random, null)).toBe(entry.id);
      expect(drawGravediggerAbility(random, null)).toBe(entry.id);
      expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes only the chosen stance using exact ×1.25 integer tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [100, 75, 80, 120, 32, 28]],
      ['DEFEND', [80, 60, 100, 120, 32, 28]],
      ['CONTROL', [80, 60, 80, 150, 32, 28]],
      ['PREPARE', [80, 60, 80, 120, 40, 28]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(gravediggerAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(value => value / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawGravediggerAbility(random, stance)).toBe(ids[index]);
        expect(drawGravediggerAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
    }
    expect(gravediggerAbilityWheel('RETREAT')).toEqual(gravediggerAbilityWheel(null));
  });

  it('uses base300, core20/30/25/25, cap60 and spirituality45 with shared penalties', () => {
    const state = fixture(); state.spirituality = 44;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 376, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(325.5); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(45);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(216);
    expect(capped.spirituality).toBe(7.5);
  });

  it('uses the S8 defensive floor30 even for a malformed negative-core input', () => {
    const state = fixture();
    state.character.coreStats = { physique: -1000, perception: -1000, will: -1000, knowledge: -1000 };
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(30);
  });

  it('keeps the S9 profile and inherited mastery separate from the S8 combat route', () => {
    const state = fixture(); state.progression.mastery[physique] = 500;
    expect(isCorpsecollector(state)).toBe(false);
    expect(currentCorpsecollectorCombatSource(state)).toBeNull();
    expect(resolveCorpsecollectorCombatAbility(state, 'BODY_STRIKE', 1, stream(state)).selfGain).toBe(0);
    state.progression.sequence = 9;
    expect(isGravedigger(state)).toBe(false); expect(isCorpsecollector(state)).toBe(true);
    expect(currentGravediggerCombatSource(state)).toBeNull();
    expect(playerCountWheel(state)).toEqual(CORPSECOLLECTOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([35, 30, 20, 15]);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(corpsecollectorAbilityWheel('CONTROL'));
    expect(resolveCorpsecollectorCombatAbility(state, 'BODY_STRIKE', 1, stream(state)).selfGain).toBe(6.5);
    expect(resolveCorpsecollectorCombatAbility(state, 'BODY_FOLLOWUP', 1, stream(state)).selfGain).toBe(3.5);
    expect(resolveCorpsecollectorCombatAbility(state, 'COVER', 1, stream(state)).enemyReduction).toBe(7.8);
    expect(resolveCorpsecollectorCombatAbility(state, 'SITE_PRESSURE', 1, stream(state)).enemyReduction).toBe(4.2);
  });

  it('does not change ordinary, Sun S9 or Tyrant S9 profiles', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isGravedigger(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    for(const sequence of [3,2]as const){state.progression.pathwayId='death';state.progression.sequence=sequence;expect(isGravedigger(state)).toBe(false);expect(playerCountWheel(state)).toEqual(sequence===3?FERRYMAN_COUNT_WHEEL:DEATH_CONSUL_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(sequence===3?ferrymanAbilityWheel(state,'CONTROL'):deathConsulAbilityWheel(state,'CONTROL'));}
    state.progression.pathwayId = 'sun'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(BARD_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(bardAbilityWheel('DEFEND'));
    state.progression.pathwayId = 'tyrant';
    expect(playerCountWheel(state)).toEqual(SAILOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sailorAbilityWheel('CONTROL'));
  });
});

describe('actual body, ordinary self-protection and limited knowledge', () => {
  it('uses unrounded 11.7f/6.3f/15.6f/8.4f at the six actual mastery nodes', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[physique] = mastery;
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state);
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(11.7 * factor);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(6.3 * factor);
      expect(resolve(state, 'COVER')).toMatchObject({ selfGain: 0, enemyReduction: 15.6 * factor, threatens: false });
      expect(resolve(state, 'SITE_PRESSURE')).toMatchObject({ selfGain: 0, enemyReduction: 8.4 * factor, threatens: false });
      expect(state).toEqual(before);
    }
  });

  it('clamps physique mastery and physical factors without turning zero attacks into a threat', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[physique] = mastery;
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(11.7 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery[physique] = 500;
    for (const id of ['BODY_STRIKE', 'BODY_FOLLOWUP'] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(resolve(state, id, 3).selfGain).toBe(id === 'BODY_STRIKE' ? 11.7 : 6.3);
      expect(resolve(state, id, 0.8).selfGain).toBe((id === 'BODY_STRIKE' ? 11.7 : 6.3) * 0.8);
    }
  });

  it('only the club currently in HAND replaces H with16 and never adds to H or J', () => {
    const state = fixture(); state.progression.mastery[physique] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      expect(resolve(state, 'BODY_STRIKE', 0.8).selfGain).toBe((location === 'HAND' ? 16 : 11.7) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(6.3 * 0.8);
      if (location === 'HAND') {
        expect(resolve(state, 'BODY_STRIKE').label).toContain('替换而不叠加主攻预算');
        expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
      }
    }
  });

  it('keeps death-eye, spirit contact, sight and knowledge out of ordinary-human attack and control', () => {
    const state = fixture();
    const ordinary = ids.slice(0, 5).map(id => resolve(state, id));
    state.progression.mastery[sight] = 500; state.progression.mastery[knowledge] = 500;
    state.progression.mastery[eye] = 500; state.progression.mastery[contact] = 500;
    state.knowledge.push({ id: 'old-mortuary-record', week: 1, title: '旧现场', text: 'HIDDEN_OLD_GHOST' });
    const before = structuredClone(state);
    expect(ids.slice(0, 5).map(id => resolve(state, id))).toEqual(ordinary);
    expect(gravediggerAbilityWheel(null).map(entry => entry.id)).not.toContain(sight);
    expect(gravediggerAbilityWheel(null).map(entry => entry.id)).not.toContain(knowledge);
    expect(gravediggerAbilityWheel(null).map(entry => entry.id)).not.toContain(eye);
    expect(gravediggerAbilityWheel(null).map(entry => entry.id)).not.toContain(contact);
    expect(resolve(state, 'SITE_PRESSURE').label).toContain('普通牵制，死亡之眼无适用对象');
    expect(resolve(state, 'OBSERVE').label).toContain('本次贡献0');
    expect(state).toEqual(before);
  });

  it('never borrows eye or spirit-contact mastery when physique is missing', () => {
    const state = fixture();
    state.progression.mastery = { [eye]: 500, [contact]: 500, [sight]: 500, [knowledge]: 500,
      BODY_STRIKE: 500, SITE_PRESSURE: 500 };
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(11.7 * 0.65);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(6.3 * 0.65);
    expect(resolve(state, 'COVER').enemyReduction).toBe(15.6 * 0.65);
    expect(resolve(state, 'SITE_PRESSURE').enemyReduction).toBe(8.4 * 0.65);
    expect(resolve(state, 'BODY_FOLLOWUP').label).toContain('灵体接触不转化为幽灵伤害');
  });

  it('does not heal, change mind, remove contamination, grant immunity or create a summoned actor', () => {
    const state = fixture(); state.health = 70; state.mind = 40; state.spirituality = 0;
    state.injuries = [{ id: 'old-injury', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    state.injuryRisk = 3; state.combat!.enemyMind = 15;
    state.progression.mastery[physique] = 500;
    const before = structuredClone(state), random = stream(state);
    for (const id of ['COVER', 'SITE_PRESSURE', 'OBSERVE'] as const) {
      expect(resolveGravediggerCombatAbility(state, id, 1, random).threatens).toBe(false);
    }
    expect(resolve(state, 'COVER').label).toContain('普通短棍仍可伤人');
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('prepares at zero and draws exact ±7.5 accidents without injury permission', () => {
    const state = fixture(), random = stream(state), before = structuredClone(state);
    expect(resolveGravediggerCombatAbility(state, 'OBSERVE', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0);
    const draws = scriptRolls(1, 2);
    expect(resolveGravediggerCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -7.5, enemyReduction: 0, threatens: false });
    expect(resolveGravediggerCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 7.5, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); expect(state).toEqual(before);
  });
});

describe('current source cannot manufacture a cold, decay or undead threat', () => {
  it('authors only the existing reachable ordinary carrier and no matching resistance threat', () => {
    const state = fixture();
    expect(currentGravediggerCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
      coldThreat: 'NONE', decayThreat: 'NONE', undead: 'NONE', spiritWorldTarget: 'NONE' });
    expect(gravediggerAbilityWheel(null).filter(entry => entry.id === 'COVER')).toHaveLength(1);
    expect(gravediggerAbilityWheel(null).filter(entry => entry.id === 'SITE_PRESSURE')).toEqual([
      { id: 'SITE_PRESSURE', label: '普通牵制，死亡之眼无适用对象', weight: 30 },
    ]);
    expect(resolve(state, 'COVER').label).toContain('没有寒冷或腐烂来源');
  });

  it('rejects stale and forged sources rather than converting them into immunity or spirits', () => {
    const state = fixture(), source = currentGravediggerCombatSource(state)!;
    const tampered = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' }, { ...source, target: 'HIDDEN_OLD_GHOST' },
      { ...source, nature: 'UNDEAD' }, { ...source, body: 'UNREACHABLE_SPIRIT' },
      { ...source, space: 'PAST_MORTUARY' }, { ...source, coldThreat: 'COLD' },
      { ...source, decayThreat: 'DECAY' }, { ...source, undead: 'FREE_ARMY' },
      { ...source, spiritWorldTarget: 'HIDDEN_OLD_GHOST' },
    ] as unknown as GravediggerCombatSource[];
    for (const input of [null, ...tampered]) {
      const before = structuredClone(state), random = stream(state);
      for (const id of ids) {
        const effect = resolveGravediggerCombatAbility(state, id, 1, random, input);
        expect(effect).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
        expect(effect.label).not.toMatch(/HIDDEN_OLD_GHOST|FREE_ARMY/);
      }
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });

  it('invalidates the source on location, lifecycle, round, pathway or opponent changes', () => {
    const mutations: ((state: SliceState) => void)[] = [
      state => { state.status = 'DEAD'; }, state => { state.health = 0; },
      state => { state.arc.stage = 'C'; }, state => { state.world.city = 'ELSEWHERE'; },
      state => { state.world.carrierAlive = false; }, state => { state.world.carrierCanResist = false; },
      state => { state.combat!.enemyHealth = 0; }, state => { state.combat!.enemyStatus = 'SURRENDERED'; },
      state => { state.combat!.encounterId = 'CLOWN_RESCUE'; }, state => { state.combat = null; },
      state => { state.progression.sequence = 9; }, state => { state.progression.pathwayId = 'sun'; },
    ];
    for (const mutate of mutations) {
      const state = fixture(), source = currentGravediggerCombatSource(state)!;
      mutate(state); const random = stream(state), before = structuredClone(state);
      expect(currentGravediggerCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveGravediggerCombatAbility(state, id, 1, random, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), source = currentGravediggerCombatSource(state)!;
    state.combat!.round += 1;
    expect(resolveGravediggerCombatAbility(state, 'BODY_STRIKE', 1, stream(state), source).selfGain).toBe(0);
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(11.7 * 0.65);
  });
});

describe('shared ordinary enemy, consequences and deterministic replay', () => {
  it('preserves all ordinary enemy actions including the normal16 short-club strike', () => {
    for (const [roll, label, selfGain, enemyReduction] of [
      [1, '短棍打击', 16, 0], [161, '格挡护身', 0, 10], [241, '寻找空当', 8, 0],
      [321, '拉开距离', 0, 8], [381, '动作落空', 0, 0],
    ] as const) {
      const state = fixture(); state.progression.mastery[physique] = 500;
      scriptRolls(1, 1, 176, roll, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 15.6 });
      expect(round.moves[1]).toEqual({ actor: 'ENEMY', label, selfGain, enemyReduction });
      expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyMind: 100, enemyStatus: 'RESISTING' });
      vi.restoreAllMocks();
    }
  });

  it('keeps enemy counts, turn order, regular recovery and shared history without new actions', () => {
    const state = fixture(); state.spirituality = 10; const before = structuredClone(state);
    const draws = scriptRolls(1, 100, 176, 1, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(1); expect(round.enemyCount).toBe(3);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'ENEMY', 'ENEMY']);
    expect(round.moves.slice(1).every(move => move.label === '短棍打击' && move.selfGain === 16)).toBe(true);
    expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
    expect(state.spirituality).toBe(14.5); expect(state.week).toBe(before.week);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.progression).toEqual(before.progression); expect(draws).toHaveBeenCalledTimes(7);
    expect(state.combat!.lastRound).toEqual(round); expect(state.lastCombatRound).toEqual(round);
  });

  it('does not grant physical injury from cover, ordinary K, R0 or a positive accident even while armed', () => {
    for (const slot of [176, 256, 376, 408]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 408 ? scriptRolls(1, 1, slot, 2, 400, 1) : scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 408 ? 7.5 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat).toMatchObject({ enemyHealth: 100, enemyInjuries: [], enemyStatus: 'RESISTING' });
      expect(draws).toHaveBeenCalledTimes(slot === 408 ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('uses ordinary K before H without creating a human weakness mark or multiplying the next attack', () => {
    const state = fixture(); state.progression.mastery = { [physique]: 500, [eye]: 500, [contact]: 500 };
    const draws = scriptRolls(31, 1, 256, 400, 1, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(2); expect(round.enemyCount).toBe(1);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER']);
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 8.4 });
    expect(round.moves[0]!.label).toContain('死亡之眼无适用对象');
    expect(round.moves[2]).toMatchObject({ selfGain: 11.7, enemyReduction: 0 });
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.combat!.enemyMind).toBe(100); expect(state.combat!.enemyInjuries).toHaveLength(1);
    expect(state.progression.mastery).toEqual({ [physique]: 500, [eye]: 500, [contact]: 500 });
    expect(draws).toHaveBeenCalledTimes(7);
  });

  it('retains actual H/J injury, physical surrender and final player death from an ordinary weapon', () => {
    for (const slot of [1, 101]) {
      const attacking = fixture(); scriptRolls(1, 1, slot, 400, 1, 66);
      const attack = resolveSliceCombatRound(attacking, 'ATTACK');
      expect(attack.outcome).toBe('ENEMY_SURRENDERED');
      expect(attacking.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED' });
      expect(attacking.combat!.enemyInjuries[0]!.severity).toBe('HEAVY');
      vi.restoreAllMocks();
    }
    const dying = fixture(); dying.health = 40; dying.spirituality = 5; dying.injuryRisk = 1;
    dying.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 176, 1, 1_000_000, 96);
    const death = resolveSliceCombatRound(dying, 'ATTACK');
    expect(death.outcome).toBe('PLAYER_DEAD'); expect(dying.health).toBe(0);
    expect(death.round.moves[1]!.selfGain).toBe(16);
    expect(dying.spirituality).toBe(5); expect(dying.injuryRisk).toBe(2);
    expect(death.round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(death.round.consequence).toContain('最终死亡');
  });

  it('uses the actual ordinary retreat and deterministic JSON replay without Math.random', () => {
    const retreating = fixture(); retreating.spirituality = 10;
    const draws = scriptRolls(100, 100, 50);
    const retreat = resolveSliceCombatRound(retreating, 'RETREAT');
    expect(retreat.outcome).toBe('RETREATED'); expect(retreat.round.moves).toEqual([]);
    expect(retreat.round.consequence).toContain('携铃者'); expect(retreating.spirituality).toBe(10);
    expect(draws).toHaveBeenCalledTimes(3); vi.restoreAllMocks();
    const state = fixture(); state.random.cursor = 7; state.health = 70;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'CONTROL')).toEqual(resolveSliceCombatRound(restored, 'CONTROL'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
  });
});
