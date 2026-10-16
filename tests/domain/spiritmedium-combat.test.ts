import {FERRYMAN_COUNT_WHEEL,ferrymanAbilityWheel} from '../../src/domain/ferryman/combat.js';
import {DEATH_CONSUL_COUNT_WHEEL,deathConsulAbilityWheel} from '../../src/domain/death-consul/combat.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { SPIRITMEDIUM_COUNT_WHEEL, spiritmediumAbilityWheel, spiritmediumActionCount,
  currentSpiritmediumCombatSource, drawSpiritmediumAbility, isSpiritmedium,
  resolveSpiritmediumCombatAbility, type SpiritmediumCombatSource, type SpiritmediumMoveId,
} from '../../src/domain/spiritmedium/combat.js';
import { GRAVEDIGGER_COUNT_WHEEL, gravediggerAbilityWheel, currentGravediggerCombatSource,
  isGravedigger, resolveGravediggerCombatAbility } from '../../src/domain/gravedigger/combat.js';
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
const ritual = 'death.s7.spirit-ritual', communication = 'death.s7.spirit-communication';
const borrowing = 'death.s7.spirit-borrowing';
const ids = ['BODY_STRIKE', 'BODY_FOLLOWUP', 'COVER', 'SITE_PRESSURE', 'RITUAL_PREPARATION', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('spiritmedium-combat-test', sliceDefaultCreationSelection, 'spiritmedium-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'death', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
  state.arc.stage = 'COMBAT'; state.world.city = 'BACKLUND';
  state.world.carrierAlive = true; state.world.carrierCanResist = true;
  state.combat = { encounterId: 'FIRST_CASE', round: 1, enemyHealth: 100, enemyMind: 100,
    enemyInjuries: [], enemyRisk: 0, enemyStatus: 'RESISTING', lastRound: null };
  state.spirituality = 60;
  return state;
}
function stream(state: SliceState) {
  return new DeterministicActionRandomStream(state.random.seed, state.random.cursor);
}
function resolve(state: SliceState, id: SpiritmediumMoveId, physical = 1) {
  return resolveSpiritmediumCombatAbility(state, id, physical, stream(state));
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

describe('Spiritmedium S7 Death V2 profile', () => {
  it('routes exact 20/15/20/23/15/7 slots and independent 22/28/25/17/8 counts', () => {
    const state = fixture();
    expect(isSpiritmedium(state)).toBe(true);
    expect(spiritmediumAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(spiritmediumAbilityWheel(null).map(entry => entry.weight)).toEqual([20, 15, 20, 23, 15, 7]);
    expect(playerAbilityWheel(state, null)).toEqual(spiritmediumAbilityWheel(null));
    expect(playerCountWheel(state)).toEqual(SPIRITMEDIUM_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([22, 28, 25, 17, 8]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(20);
    expect(playerCountWheel(state)[0]!.weight).toBe(22);
  });

  it('preserves every action-count and ability boundary with one draw per slot', () => {
    for (const [roll, count] of [[1, 1], [22, 1], [23, 2], [50, 2], [51, 3], [75, 3], [76, 4], [92, 4], [93, 5], [100, 5]]) {
      expect(spiritmediumActionCount(roll!)).toBe(count);
    }
    let boundary = 0;
    for (const entry of spiritmediumAbilityWheel(null)) {
      const first = boundary + 1; boundary += entry.weight * 4;
      const draw = scriptRolls(first, boundary), random = stream(fixture());
      expect(drawSpiritmediumAbility(random, null)).toBe(entry.id);
      expect(drawSpiritmediumAbility(random, null)).toBe(entry.id);
      expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
      vi.restoreAllMocks();
    }
    expect(boundary).toBe(400);
  });

  it('normalizes only the chosen stance using exact ×1.25 integer tickets', () => {
    for (const [stance, weights] of [
      ['ATTACK', [100, 75, 80, 92, 60, 28]],
      ['DEFEND', [80, 60, 100, 92, 60, 28]],
      ['CONTROL', [80, 60, 80, 115, 60, 28]],
      ['PREPARE', [80, 60, 80, 92, 75, 28]],
    ] as const) {
      const total = weights.reduce<number>((sum, weight) => sum + weight, 0);
      expect(spiritmediumAbilityWheel(stance).map(entry => entry.weight)).toEqual(weights.map(value => value / total * 100));
      let boundary = 0;
      for (let index = 0; index < weights.length; index += 1) {
        const first = boundary + 1; boundary += weights[index]!;
        const draw = scriptRolls(first, boundary), random = stream(fixture());
        expect(drawSpiritmediumAbility(random, stance)).toBe(ids[index]);
        expect(drawSpiritmediumAbility(random, stance)).toBe(ids[index]);
        expect(draw).toHaveBeenCalledTimes(2); expect(random.cursor).toBe(2);
        vi.restoreAllMocks();
      }
    }
    expect(spiritmediumAbilityWheel('RETREAT')).toEqual(spiritmediumAbilityWheel(null));
  });

  it('uses base450, core15/30/30/25, cap90 and spirituality60 with shared penalties', () => {
    const state = fixture(); state.spirituality = 59;
    state.character.coreStats = { physique: 10, perception: 20, will: 30, knowledge: 40 };
    scriptRolls(1, 1, 376, 400, 1);
    const { round } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerAdvantage).toBe(476.5); expect(round.enemyAdvantage).toBe(114);
    expect(state.spirituality).toBe(60);
    vi.restoreAllMocks();
    const capped = fixture();
    capped.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    capped.health = 50; capped.mind = 25; capped.spirituality = 3;
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(capped, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(capped.spirituality).toBe(9);
  });

  it('uses the S7 defensive floor45 even for a malformed negative-core input', () => {
    const state = fixture();
    state.character.coreStats = { physique: -1000, perception: -1000, will: -1000, knowledge: -1000 };
    scriptRolls(1, 1, 376, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('keeps the S9 profile and inherited mastery separate from the S7 combat route', () => {
    const state = fixture(); state.progression.mastery[physique] = 500;
    expect(isCorpsecollector(state)).toBe(false);
    expect(currentCorpsecollectorCombatSource(state)).toBeNull();
    expect(resolveCorpsecollectorCombatAbility(state, 'BODY_STRIKE', 1, stream(state)).selfGain).toBe(0);
    state.progression.sequence = 9;
    expect(isSpiritmedium(state)).toBe(false); expect(isCorpsecollector(state)).toBe(true);
    expect(currentSpiritmediumCombatSource(state)).toBeNull();
    expect(playerCountWheel(state)).toEqual(CORPSECOLLECTOR_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([35, 30, 20, 15]);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(corpsecollectorAbilityWheel('CONTROL'));
    expect(resolveCorpsecollectorCombatAbility(state, 'BODY_STRIKE', 1, stream(state)).selfGain).toBe(6.5);
    expect(resolveCorpsecollectorCombatAbility(state, 'BODY_FOLLOWUP', 1, stream(state)).selfGain).toBe(3.5);
    expect(resolveCorpsecollectorCombatAbility(state, 'COVER', 1, stream(state)).enemyReduction).toBe(7.8);
    expect(resolveCorpsecollectorCombatAbility(state, 'SITE_PRESSURE', 1, stream(state)).enemyReduction).toBe(4.2);
  });

  it('retains the exact S8 profile and prevents double-paying its inherited actions at S7', () => {
    const state = fixture(); state.progression.mastery[physique] = 500;
    expect(isGravedigger(state)).toBe(false);
    expect(currentGravediggerCombatSource(state)).toBeNull();
    expect(resolveGravediggerCombatAbility(state, 'BODY_STRIKE', 1, stream(state)))
      .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    state.progression.sequence = 8;
    expect(isSpiritmedium(state)).toBe(false); expect(isGravedigger(state)).toBe(true);
    expect(currentSpiritmediumCombatSource(state)).toBeNull();
    expect(resolve(state, 'BODY_STRIKE')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(playerCountWheel(state)).toEqual(GRAVEDIGGER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([30, 30, 25, 15]);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(gravediggerAbilityWheel('CONTROL'));
    expect(gravediggerAbilityWheel(null).map(entry => entry.weight)).toEqual([20, 15, 20, 30, 8, 7]);
    expect(resolveGravediggerCombatAbility(state, 'BODY_STRIKE', 1, stream(state)).selfGain).toBe(11.7);
    expect(resolveGravediggerCombatAbility(state, 'BODY_FOLLOWUP', 1, stream(state)).selfGain).toBe(6.3);
    expect(resolveGravediggerCombatAbility(state, 'COVER', 1, stream(state)).enemyReduction).toBe(15.6);
    expect(resolveGravediggerCombatAbility(state, 'SITE_PRESSURE', 1, stream(state)).enemyReduction).toBe(8.4);
  });

  it('does not change ordinary, Sun S9 or Tyrant S9 profiles', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isSpiritmedium(state)).toBe(false); expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
    }
    for(const sequence of [3,2]as const){state.progression.pathwayId='death';state.progression.sequence=sequence;expect(isSpiritmedium(state)).toBe(false);expect(playerCountWheel(state)).toEqual(sequence===3?FERRYMAN_COUNT_WHEEL:DEATH_CONSUL_COUNT_WHEEL);expect(playerAbilityWheel(state,'CONTROL')).toEqual(sequence===3?ferrymanAbilityWheel(state,'CONTROL'):deathConsulAbilityWheel(state,'CONTROL'));}
    state.progression.pathwayId = 'sun'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(BARD_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'DEFEND')).toEqual(bardAbilityWheel('DEFEND'));
    state.progression.pathwayId = 'tyrant';
    expect(playerCountWheel(state)).toEqual(SAILOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(sailorAbilityWheel('CONTROL'));
  });
});

describe('actual body, ordinary self-protection and limited knowledge', () => {
  it('uses unrounded 23.4f/12.6f/26.325f/14.175f at the six actual mastery nodes', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.progression.mastery[physique] = mastery;
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state);
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(23.4 * factor);
      expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(12.6 * factor);
      expect(resolve(state, 'COVER')).toMatchObject({ selfGain: 0, enemyReduction: 26.325 * factor, threatens: false });
      expect(resolve(state, 'SITE_PRESSURE')).toMatchObject({ selfGain: 0, enemyReduction: 14.175 * factor, threatens: false });
      expect(state).toEqual(before);
    }
  });

  it('clamps physique mastery and physical factors without turning zero attacks into a threat', () => {
    const state = fixture();
    for (const mastery of [-50, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[physique] = mastery;
      expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(23.4 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery[physique] = 500;
    for (const id of ['BODY_STRIKE', 'BODY_FOLLOWUP'] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(resolve(state, id, 3).selfGain).toBe(id === 'BODY_STRIKE' ? 23.4 : 12.6);
      expect(resolve(state, id, 0.8).selfGain).toBe((id === 'BODY_STRIKE' ? 23.4 : 12.6) * 0.8);
    }
  });

  it('only the club currently in HAND replaces H with16 and never adds to H or J', () => {
    const state = fixture(); state.progression.mastery[physique] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location;
      expect(resolve(state, 'BODY_STRIKE', 0.8).selfGain).toBe((location === 'HAND' ? 16 : 23.4) * 0.8);
      expect(resolve(state, 'BODY_FOLLOWUP', 0.8).selfGain).toBe(12.6 * 0.8);
      if (location === 'HAND') {
        expect(resolve(state, 'BODY_STRIKE').label).toContain('替换而不叠加主攻预算');
        expect(playerAbilityWheel(state, null)[0]!.label).toBe('持握原短棍打击');
      }
    }
  });

  it('keeps ritual, communication, borrowing, death-eye and sight out of ordinary-human attack and control', () => {
    const state = fixture();
    const ordinary = ids.slice(0, 5).map(id => resolve(state, id));
    state.progression.mastery[sight] = 500; state.progression.mastery[knowledge] = 500;
    state.progression.mastery[eye] = 500; state.progression.mastery[contact] = 500;
    state.progression.mastery[ritual] = 500; state.progression.mastery[communication] = 500;
    state.progression.mastery[borrowing] = 500;
    state.knowledge.push({ id: 'old-mortuary-record', week: 1, title: '旧现场', text: 'HIDDEN_OLD_GHOST' });
    const before = structuredClone(state);
    expect(ids.slice(0, 5).map(id => resolve(state, id))).toEqual(ordinary);
    expect(spiritmediumAbilityWheel(null).map(entry => entry.id)).not.toContain(sight);
    expect(spiritmediumAbilityWheel(null).map(entry => entry.id)).not.toContain(knowledge);
    expect(spiritmediumAbilityWheel(null).map(entry => entry.id)).not.toContain(eye);
    expect(spiritmediumAbilityWheel(null).map(entry => entry.id)).not.toContain(contact);
    for (const id of [ritual, communication, borrowing]) {
      expect(spiritmediumAbilityWheel(null).map(entry => entry.id)).not.toContain(id);
    }
    expect(resolve(state, 'SITE_PRESSURE').label).toContain('普通牵制，死亡之眼无适用对象');
    expect(resolve(state, 'RITUAL_PREPARATION').label).toContain('本次贡献0');
    expect(resolve(state, 'RITUAL_PREPARATION').label).toContain('现场没有既存可沟通、可借力的原灵');
    expect(resolve(state, 'RITUAL_PREPARATION').label).toContain('不搬入生活现场的灵或纸签借力');
    expect(state).toEqual(before);
  });

  it('never carries completed life rituals, original spirits or the moved paper into FIRST_CASE', () => {
    const state = fixture(), source = currentSpiritmediumCombatSource(state);
    const ordinary = ids.slice(0, 5).map(id => resolve(state, id));
    for (const caseId of ['lamp-spirit', 'memento-question', 'wind-assistance']) {
      state.spiritmedium.cases[caseId] = { status: 'RESOLVED', attemptWeek: state.week,
        method: 'RITUAL', mistakes: 0, conclusion: 'LIMITED', withdrawals: 0 };
    }
    state.spiritmedium.cardLocation = 'TRAY'; state.spiritmedium.reflected = true;
    state.progression.mastery[ritual] = 500; state.progression.mastery[communication] = 500;
    state.progression.mastery[borrowing] = 500;
    const before = structuredClone(state), random = stream(state);
    expect(currentSpiritmediumCombatSource(state)).toEqual(source);
    expect(ids.slice(0, 5).map(id => resolveSpiritmediumCombatAbility(state, id, 1, random))).toEqual(ordinary);
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
    expect(state.spiritmedium.cardLocation).toBe('TRAY');
    expect(resolve(state, 'RITUAL_PREPARATION')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
  });

  it('never substitutes S7 ritual, borrowing or inherited spirit mastery when physique is missing', () => {
    const state = fixture();
    state.progression.mastery = { [eye]: 500, [contact]: 500, [sight]: 500, [knowledge]: 500,
      [ritual]: 500, [communication]: 500, [borrowing]: 500,
      BODY_STRIKE: 500, SITE_PRESSURE: 500 };
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(23.4 * 0.65);
    expect(resolve(state, 'BODY_FOLLOWUP').selfGain).toBe(12.6 * 0.65);
    expect(resolve(state, 'COVER').enemyReduction).toBe(26.325 * 0.65);
    expect(resolve(state, 'SITE_PRESSURE').enemyReduction).toBe(14.175 * 0.65);
    expect(resolve(state, 'BODY_FOLLOWUP').label).toContain('现场无可借力原灵');
  });

  it('does not heal, change mind, remove contamination, grant immunity or create a summoned actor', () => {
    const state = fixture(); state.health = 70; state.mind = 40; state.spirituality = 0;
    state.injuries = [{ id: 'old-injury', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
    state.injuryRisk = 3; state.combat!.enemyMind = 15;
    state.progression.mastery[physique] = 500;
    const before = structuredClone(state), random = stream(state);
    for (const id of ['COVER', 'SITE_PRESSURE', 'RITUAL_PREPARATION'] as const) {
      expect(resolveSpiritmediumCombatAbility(state, id, 1, random).threatens).toBe(false);
    }
    expect(resolve(state, 'COVER').label).toContain('普通短棍仍可伤人');
    expect(state).toEqual(before); expect(random.cursor).toBe(0);
  });

  it('prepares at zero and draws exact ±11.25 accidents without injury permission', () => {
    const state = fixture(), random = stream(state), before = structuredClone(state);
    expect(resolveSpiritmediumCombatAbility(state, 'RITUAL_PREPARATION', 1, random)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(0);
    const draws = scriptRolls(1, 2);
    expect(resolveSpiritmediumCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: -11.25, enemyReduction: 0, threatens: false });
    expect(resolveSpiritmediumCombatAbility(state, 'ACCIDENT', 1, random)).toMatchObject({ selfGain: 11.25, enemyReduction: 0, threatens: false });
    expect(random.cursor).toBe(2); expect(draws).toHaveBeenCalledTimes(2); expect(state).toEqual(before);
  });
});

describe('current source cannot manufacture a cold, decay or undead threat', () => {
  it('authors only the existing reachable ordinary carrier and no matching resistance threat', () => {
    const state = fixture();
    expect(currentSpiritmediumCombatSource(state)).toEqual({ runId: state.runId, revision: state.revision,
      week: state.week, encounterId: 'FIRST_CASE', round: 1, target: 'CURRENT_VISIBLE_ORDINARY_CARRIER',
      nature: 'ORDINARY_HUMAN', body: 'CURRENT_REACHABLE_BODY', space: 'DRY_GROUND_PASSAGE',
      coldThreat: 'NONE', decayThreat: 'NONE', undead: 'NONE', spiritWorldTarget: 'NONE',
      localSpirit: 'NONE', borrowableSpirit: 'NONE' });
    expect(spiritmediumAbilityWheel(null).filter(entry => entry.id === 'COVER')).toHaveLength(1);
    expect(spiritmediumAbilityWheel(null).filter(entry => entry.id === 'SITE_PRESSURE')).toEqual([
      { id: 'SITE_PRESSURE', label: '普通牵制，死亡之眼无适用对象', weight: 23 },
    ]);
    expect(resolve(state, 'COVER').label).toContain('没有寒冷或腐烂来源');
  });

  it('rejects stale and forged sources rather than converting them into immunity or spirits', () => {
    const state = fixture(), source = currentSpiritmediumCombatSource(state)!;
    const tampered = [
      { ...source, runId: 'other' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: 2 },
      { ...source, encounterId: 'CLOWN_RESCUE' }, { ...source, target: 'HIDDEN_OLD_GHOST' },
      { ...source, nature: 'UNDEAD' }, { ...source, body: 'UNREACHABLE_SPIRIT' },
      { ...source, space: 'PAST_MORTUARY' }, { ...source, coldThreat: 'COLD' },
      { ...source, decayThreat: 'DECAY' }, { ...source, undead: 'FREE_ARMY' },
      { ...source, spiritWorldTarget: 'HIDDEN_OLD_GHOST' },
      { ...source, localSpirit: 'HIDDEN_OLD_GHOST' }, { ...source, borrowableSpirit: 'FREE_ARMY' },
    ] as unknown as SpiritmediumCombatSource[];
    for (const input of [null, ...tampered]) {
      const before = structuredClone(state), random = stream(state);
      for (const id of ids) {
        const effect = resolveSpiritmediumCombatAbility(state, id, 1, random, input);
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
      const state = fixture(), source = currentSpiritmediumCombatSource(state)!;
      mutate(state); const random = stream(state), before = structuredClone(state);
      expect(currentSpiritmediumCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolveSpiritmediumCombatAbility(state, id, 1, random, source)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
    const state = fixture(), source = currentSpiritmediumCombatSource(state)!;
    state.combat!.round += 1;
    expect(resolveSpiritmediumCombatAbility(state, 'BODY_STRIKE', 1, stream(state), source).selfGain).toBe(0);
    expect(resolve(state, 'BODY_STRIKE').selfGain).toBe(23.4 * 0.65);
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
      expect(round.moves[0]).toMatchObject({ actor: 'PLAYER', selfGain: 0, enemyReduction: 26.325 });
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
    expect(state.spirituality).toBe(16); expect(state.week).toBe(before.week);
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(state.progression).toEqual(before.progression); expect(draws).toHaveBeenCalledTimes(7);
    expect(state.combat!.lastRound).toEqual(round); expect(state.lastCombatRound).toEqual(round);
  });

  it('executes all five S7 slots while preserving alternating enemy-first order in round two', () => {
    const state = fixture(); state.combat!.round = 2; state.spirituality = 10;
    const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 400, 376, 400, 376, 400, 376, 376, 376, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.playerCount).toBe(5); expect(round.enemyCount).toBe(3); expect(round.first).toBe('ENEMY');
    expect(round.moves.map(move => move.actor)).toEqual([
      'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER', 'PLAYER',
    ]);
    expect(round.moves.every(move => move.selfGain === 0 && move.enemyReduction === 0)).toBe(true);
    expect(outcome).toBe('CONTINUE'); expect(round.consequenceWeights).toBeNull();
    expect(state.spirituality).toBe(16); expect(state.combat!.round).toBe(3);
    expect(state.spiritmedium).toEqual(before.spiritmedium);
    expect(draws).toHaveBeenCalledTimes(11);
  });

  it('does not grant physical injury from cover, ordinary K, R0 or a positive accident even while armed', () => {
    for (const slot of [176, 256, 376, 408]) {
      const state = fixture(); state.town.clubLocation = 'HAND';
      const draws = slot === 408 ? scriptRolls(1, 1, slot, 2, 400, 1) : scriptRolls(1, 1, slot, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(slot === 408 ? 11.25 : 0);
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
    expect(round.moves[0]).toMatchObject({ selfGain: 0, enemyReduction: 14.175 });
    expect(round.moves[0]!.label).toContain('死亡之眼无适用对象');
    expect(round.moves[2]).toMatchObject({ selfGain: 23.4, enemyReduction: 0 });
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

  it('permits actual physical enemy death without creating a recruitable dead ally', () => {
    const state = fixture(), lifeBefore = structuredClone(state.spiritmedium);
    state.spirituality = 10;
    scriptRolls(1, 1, 1, 400, 1, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(outcome).toBe('ENEMY_DEAD');
    expect(round.moves[0]!.label).toContain('实际身体攻击');
    expect(state.combat).toMatchObject({ enemyHealth: 0, enemyStatus: 'DEAD' });
    expect(round.consequence).toContain('最终死亡');
    expect(state.spirituality).toBe(10); expect(state.spiritmedium).toEqual(lifeBefore);
    expect(currentSpiritmediumCombatSource(state)).toBeNull();
    expect(resolve(state, 'RITUAL_PREPARATION')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
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
