import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { ORDINARY_COUNT_WHEEL, ordinaryAbilityWheel, playerAbilityWheel, playerCountWheel,
  resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import { WEAPONMASTER_COUNT_WHEEL, currentWeaponmasterCombatSource, drawWeaponmasterAbility, isWeaponmaster,
  observeWeaponmasterEnemyAction, resolveWeaponmasterCombatAbility, weaponmasterAbilityWheel,
  weaponmasterActionCount, weaponmasterPlayerHoldsPracticeClub, weaponmasterPreparationSummary,
  type WeaponmasterCombatSource, type WeaponmasterMoveId } from '../../src/domain/weaponmaster/combat.js';
import * as weaponmasterCombat from '../../src/domain/weaponmaster/combat.js';
import { WARRIOR_COUNT_WHEEL, warriorAbilityWheel } from '../../src/domain/warrior/combat.js';
import { GLADIATOR_COUNT_WHEEL, gladiatorAbilityWheel } from '../../src/domain/gladiator/combat.js';
import { CRYPTOLOGIST_COUNT_WHEEL, cryptologistAbilityWheel } from '../../src/domain/cryptologist/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';

const physique = 'warrior.s9.physique', weapons = 'warrior.s7.weapons', weakPoint = 'warrior.s7.weak-point';
const restraint = 'warrior.s9.restraint';
const ids = [physique, weapons, restraint, 'POSITION', 'OBSERVE', 'ACCIDENT'] as const;
function fixture(): SliceState {
  const state = createSliceRun('weaponmaster-combat-test', sliceDefaultCreationSelection, 'weaponmaster-combat');
  state.activeEvent = null;
  state.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  state.progression = { pathwayId: 'warrior', sequence: 7, mastery: {}, acting: 0, promotionWeek: 1 };
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
function fixedRolls(...rolls: number[]): ActionRandomStream {
  let cursor = 0;
  return { seed: 'bounded-test', get cursor() { return cursor; }, nextInt(minimum, maximum) {
    const roll = rolls[cursor++];
    if (roll === undefined || roll < minimum || roll > maximum) throw new Error('Unexpected random draw');
    return roll;
  } };
}
function resolve(state: SliceState, id: WeaponmasterMoveId, physical = 1,
  source = currentWeaponmasterCombatSource(state), random: ActionRandomStream = fixedRolls(1)) {
  return resolveWeaponmasterCombatAbility(state, id, physical, random, source);
}
function heldPracticeClub(state: SliceState) {
  Object.assign(state.warrior.practiceClub, { custodian: 'PLAYER', location: 'player:hand', version: 2 });
}
function observed(state: SliceState) { observeWeaponmasterEnemyAction(state, 'STRIKE'); }
/** Script tickets while retaining the production random cursor and range checks. */
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

describe('Weaponmaster S7 exact M profile and budgets', () => {
  it('selects the six38/20/8/5/4/25 slots and independent22/28/25/17/8 counts', () => {
    const state = fixture();
    expect(isWeaponmaster(state)).toBe(true);
    expect(playerAbilityWheel(state, null)).toEqual(weaponmasterAbilityWheel(null, state));
    expect(weaponmasterAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
    expect(weaponmasterAbilityWheel(null).map(entry => entry.weight)).toEqual([38, 20, 8, 5, 4, 25]);
    expect(playerCountWheel(state)).toEqual(WEAPONMASTER_COUNT_WHEEL);
    expect(playerCountWheel(state).map(entry => entry.weight)).toEqual([22, 28, 25, 17, 8]);
    const wheel = playerAbilityWheel(state, null), counts = playerCountWheel(state);
    wheel[0]!.weight = 0; counts[0]!.weight = 0;
    expect(playerAbilityWheel(state, null)[0]!.weight).toBe(38);
    expect(playerCountWheel(state)[0]!.weight).toBe(22);
  });

  it('preserves every count and main-wheel threshold with one draw each', () => {
    for (const [roll, count] of [[1, 1], [22, 1], [23, 2], [50, 2], [51, 3], [75, 3], [76, 4], [92, 4], [93, 5], [100, 5]]) {
      expect(weaponmasterActionCount(roll!)).toBe(count);
    }
    for (const [roll, id] of [[1, physique], [152, physique], [153, weapons], [232, weapons],
      [233, restraint], [264, restraint], [265, 'POSITION'], [284, 'POSITION'],
      [285, 'OBSERVE'], [300, 'OBSERVE'], [301, 'ACCIDENT'], [400, 'ACCIDENT']] as const) {
      const random = fixedRolls(roll);
      expect(drawWeaponmasterAbility(random, null)).toBe(id); expect(random.cursor).toBe(1);
    }
  });

  it('applies exact1.25 stance tickets and does not change counts or J subchoice proportions', () => {
    for (const stance of ['ATTACK', 'DEFEND', 'CONTROL', 'PREPARE', 'RETREAT'] as const) {
      const boosts = stance === 'ATTACK' ? [0, 1] : stance === 'DEFEND' ? [2]
        : stance === 'CONTROL' ? [3] : stance === 'PREPARE' ? [4] : [];
      const tickets = [38, 20, 8, 5, 4, 25].map((weight, index) => weight * (boosts.includes(index) ? 5 : 4));
      const total = tickets.reduce((sum, value) => sum + value, 0), counts = new Map<string, number>();
      for (let roll = 1; roll <= total; roll += 1) {
        const id = drawWeaponmasterAbility(fixedRolls(roll), stance);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      expect(ids.map(id => counts.get(id))).toEqual(tickets);
      weaponmasterAbilityWheel(stance).forEach((entry, index) => expect(entry.weight).toBeCloseTo(tickets[index]! / total * 100, 12));
      expect(weaponmasterAbilityWheel(stance)[1]!.label).toContain('12/20、弱点8/20');
    }
  });

  it('uses a finite12:8 J subdraw, giving weak-point exactly8 percent of the neutral whole wheel', () => {
    let ordinary = 0, preparation = 0;
    for (let roll = 1; roll <= 20; roll += 1) {
      const state = fixture(); heldPracticeClub(state); observed(state);
      const random = fixedRolls(roll), effect = resolve(state, weapons, 1, currentWeaponmasterCombatSource(state), random);
      if (effect.label.includes('第一段')) preparation += 1; else ordinary += 1;
      expect(random.cursor).toBe(1);
      expect(state.combat!.weaponmasterWeakPoint!.prepared).toBe(roll > 12);
    }
    expect([ordinary, preparation]).toEqual([12, 8]);
    expect(weaponmasterAbilityWheel(null)[1]!.weight * preparation / 20).toBe(8);
  });

  it('uses67.5f/47.25f/18f/12.6f at six mastery nodes even at0 spirituality', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0;
      state.progression.mastery = { [physique]: mastery, [weapons]: mastery, [restraint]: mastery };
      const factor = 0.65 + 0.35 * mastery / 500, before = structuredClone(state);
      expect(resolve(state, physique, 0.8)).toMatchObject({ selfGain: 67.5 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolve(state, weapons, 0.8)).toMatchObject({ selfGain: 47.25 * factor * 0.8, enemyReduction: 0, threatens: true });
      expect(resolve(state, restraint, 0.8)).toMatchObject({ selfGain: 0, enemyReduction: 18 * factor, threatens: false });
      expect(resolve(state, 'POSITION', 0.8)).toMatchObject({ selfGain: 0, enemyReduction: 12.6 * factor, threatens: false });
      expect(resolve(state, 'OBSERVE')).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state).toEqual(before);
    }
  });

  it('maps S7 weapon and weak-point mastery independently, preserving four inherited records', () => {
    const state = fixture(); heldPracticeClub(state); observed(state);
    state.progression.mastery = { [physique]: 500, [weapons]: 250, [restraint]: 0, [weakPoint]: 100,
      'warrior.s9.arms': 400, 'warrior.s8.combat-skill': 500, 'warrior.s6.dawn-armor': 500 };
    const progression = structuredClone(state.progression);
    expect(resolve(state, weapons).selfGain).toBe(47.25 * (0.65 + 0.35 * 250 / 500));
    expect(resolve(state, 'POSITION').enemyReduction).toBe(12.6 * (0.65 + 0.35 * 250 / 500));
    expect(resolve(state, restraint).enemyReduction).toBe(18 * 0.65);
    expect(resolve(state, weapons, 1, undefined, fixedRolls(13)).selfGain).toBe(0);
    expect(resolve(state, weapons, 0.8, undefined, fixedRolls(20)).selfGain).toBe(420 * (0.65 + 0.35 * 100 / 500) * 0.8);
    expect(state.progression).toEqual(progression);
    expect(weaponmasterAbilityWheel(null).map(entry => entry.id)).toEqual(ids);
  });

  it('bounds invalid mastery and physical inputs and never threatens with zero output', () => {
    const state = fixture();
    for (const mastery of [-10, Number.NaN, Number.POSITIVE_INFINITY, 800]) {
      state.progression.mastery[physique] = mastery;
      expect(resolve(state, physique).selfGain).toBe(67.5 * (mastery === 800 ? 1 : 0.65));
    }
    state.progression.mastery = { [physique]: 500, [weapons]: 500 };
    for (const id of [physique, weapons] as const) {
      for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(resolve(state, id, physical)).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      }
      expect(resolve(state, id, 3).selfGain).toBe(id === physique ? 67.5 : 47.25);
    }
  });

  it('uses45/20/25/10 core,450 base,90 core cap,45 floor and60 spirituality maximum', () => {
    const state = fixture(); state.character.coreStats = { physique: 20, perception: 10, will: 40, knowledge: 30 };
    scriptRolls(1, 1, 343, 400, 1);
    expect(resolveSliceCombatRound(state, 'ATTACK').round.playerAdvantage).toBe(474);
    vi.restoreAllMocks();
    const limited = fixture(); limited.character.coreStats = { physique: 100, perception: 100, will: 100, knowledge: 100 };
    limited.health = 50; limited.mind = 25; limited.spirituality = 3;
    scriptRolls(1, 1, 343, 400, 1);
    expect(resolveSliceCombatRound(limited, 'ATTACK').round.playerAdvantage).toBe(324);
    expect(limited.spirituality).toBe(9);
    vi.restoreAllMocks();
    const full = fixture(); full.spirituality = 59;
    scriptRolls(1, 1, 343, 400, 1);
    resolveSliceCombatRound(full, 'ATTACK'); expect(full.spirituality).toBe(60);
    vi.restoreAllMocks();
    vi.spyOn(weaponmasterCombat, 'resolveWeaponmasterCombatAbility').mockReturnValue({
      label: 'controlled negative contribution', selfGain: -1_000, enemyReduction: 0, threatens: false,
    });
    scriptRolls(1, 1, 343, 400, 1);
    expect(resolveSliceCombatRound(fixture(), 'ATTACK').round.playerAdvantage).toBe(45);
  });

  it('keeps ordinary, Warrior9, Gladiator8 and unrelated S7 profiles unchanged', () => {
    const state = fixture();
    for (const [pathwayId, sequence] of [[null, null], ['warrior', 1], ['moon', 9], ['paragon', 9]] as const) {
      state.progression.pathwayId = pathwayId; state.progression.sequence = sequence;
      expect(isWeaponmaster(state)).toBe(false); expect(currentWeaponmasterCombatSource(state)).toBeNull();
      expect(playerCountWheel(state)).toEqual(ORDINARY_COUNT_WHEEL);
      expect(playerAbilityWheel(state, 'CONTROL')).toEqual(ordinaryAbilityWheel(false, 'CONTROL'));
      expect(weaponmasterPreparationSummary(state)).toBeNull();
    }
    state.progression.pathwayId = 'warrior'; state.progression.sequence = 9;
    expect(playerCountWheel(state)).toEqual(WARRIOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(warriorAbilityWheel('CONTROL', state));
    state.progression.sequence = 8;
    expect(playerCountWheel(state)).toEqual(GLADIATOR_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(gladiatorAbilityWheel('CONTROL', state));
    state.progression.pathwayId = 'error'; state.progression.sequence = 7;
    expect(playerCountWheel(state)).toEqual(CRYPTOLOGIST_COUNT_WHEEL);
    expect(playerAbilityWheel(state, 'CONTROL')).toEqual(cryptologistAbilityWheel('CONTROL', state));
  });
});

describe('Weaponmaster actual gear, evidence and two-stage mark boundaries', () => {
  it('uses ordinary16 only when the original town club or correctly held borrowed club replaces H', () => {
    const state = fixture(); state.progression.mastery[physique] = 500;
    for (const location of ['SHOP', 'BAG', 'HAND', 'BAG'] as const) {
      state.town.clubLocation = location; const before = structuredClone(state);
      expect(resolve(state, physique, 0.8).selfGain).toBe((location === 'HAND' ? 16 : 67.5) * 0.8);
      expect(state).toEqual(before);
    }
    heldPracticeClub(state); const original = structuredClone(state.warrior.practiceClub);
    expect(weaponmasterPlayerHoldsPracticeClub(state)).toBe(true);
    expect(resolve(state, physique).selfGain).toBe(16);
    expect(playerAbilityWheel(state, null)[0]!.label).toContain('奥斯温原练习短棍');
    state.town.clubLocation = 'HAND'; expect(resolve(state, physique).selfGain).toBe(16);
    expect(state.warrior.practiceClub).toEqual(original);
    state.town.clubLocation = 'BAG';
    for (const mismatch of [{ id: 'copy' }, { owner: '他人' }, { custodian: 'MENTOR' }, { location: 'training-rack' }]) {
      const candidate = structuredClone(state); Object.assign(candidate.warrior.practiceClub, mismatch);
      expect(weaponmasterPlayerHoldsPracticeClub(candidate)).toBe(false);
      expect(resolve(candidate, physique).selfGain).toBe(67.5);
    }
  });

  it('does not create evidence from future turns, old knowledge, OBSERVE or suppressed/nonattacking moves', () => {
    const state = fixture(); heldPracticeClub(state);
    state.knowledge.push({ id: 'old', week: 1, title: '旧记', text: 'PRIVATE_ANATOMY 隐藏弱点' });
    for (const id of ['BLOCK', 'DISTANCE', 'MISS', 'FORGED']) observeWeaponmasterEnemyAction(state, id);
    observeWeaponmasterEnemyAction(state, 'STRIKE', true);
    observeWeaponmasterEnemyAction(state, 'OPENING', true);
    resolve(state, 'OBSERVE');
    expect(state.combat!.weaponmasterWeakPoint).toBeUndefined();
    const before = structuredClone(state), effect = resolve(state, weapons, 1, undefined, fixedRolls(13));
    expect(effect).toMatchObject({ selfGain: 47.25 * 0.65, threatens: true });
    expect(effect.label).toContain('本场尚无已发生'); expect(effect.label).not.toMatch(/PRIVATE_ANATOMY|隐藏弱点/);
    expect(state).toEqual(before);
    expect(weaponmasterPreparationSummary(state)).toContain('须先看到');
  });

  it('only the two authored actual ordinary moves initialize the local evidence flag', () => {
    for (const id of ['STRIKE', 'OPENING']) {
      const state = fixture(); observeWeaponmasterEnemyAction(state, id);
      expect(state.combat!.weaponmasterWeakPoint).toEqual({ observed: true, prepared: false });
      expect(weaponmasterPreparationSummary(state)).toContain('未实际持有');
      heldPracticeClub(state);
      expect(weaponmasterPreparationSummary(state)).toContain('第一次合格命中');
    }
    const other = fixture(); other.progression.sequence = 8; observed(other);
    expect(other.combat!.weaponmasterWeakPoint).toBeUndefined();
  });

  it('first qualified hit stores0-gain preparation, second consumes it for420f at0 spirituality', () => {
    for (const mastery of [0, 100, 200, 300, 400, 500]) {
      const state = fixture(); state.spirituality = 0; heldPracticeClub(state); observed(state);
      state.progression.mastery[weakPoint] = mastery;
      const before = structuredClone(state), first = resolve(state, weapons, 0.8, undefined, fixedRolls(13));
      expect(first).toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(state.combat!.weaponmasterWeakPoint).toEqual({ observed: true, prepared: true });
      expect(weaponmasterPreparationSummary(state)).toContain('已准备');
      const second = resolve(state, weapons, 0.8, undefined, fixedRolls(20));
      expect(second.selfGain).toBe(420 * (0.65 + 0.35 * mastery / 500) * 0.8);
      expect(second).toMatchObject({ enemyReduction: 0, threatens: true });
      expect(second.label).toContain('不直接判死');
      expect(state.combat!.weaponmasterWeakPoint).toEqual({ observed: true, prepared: false });
      expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.enemyStatus).toBe('RESISTING');
      expect(state.warrior).toEqual(before.warrior); expect(state.world).toEqual(before.world);
      expect(state.progression).toEqual(before.progression); expect(state.spirituality).toBe(0);
    }
  });

  it('missing weapons cause ordinary J fallback without empty marks or hidden gear', () => {
    const state = fixture(); observed(state); state.progression.mastery[weapons] = 500;
    for (const location of ['SHOP', 'BAG'] as const) {
      state.town.clubLocation = location; const before = structuredClone(state);
      const effect = resolve(state, weapons, 0.8, undefined, fixedRolls(13));
      expect(effect.selfGain).toBe(47.25 * 0.8); expect(effect.label).toContain('未实际持有原短棍');
      expect(state).toEqual(before);
    }
    state.town.clubLocation = 'HAND';
    resolve(state, weapons, 1, undefined, fixedRolls(13));
    state.town.clubLocation = 'BAG'; const before = structuredClone(state);
    expect(resolve(state, weapons, 1, undefined, fixedRolls(13)).selfGain).toBe(47.25);
    expect(state).toEqual(before); expect(weaponmasterPreparationSummary(state)).toContain('当前不能兑现');
    state.town.clubLocation = 'HAND';
    expect(resolve(state, weapons, 1, undefined, fixedRolls(13)).selfGain).toBe(420 * 0.65);
    expect(state.combat!.weaponmasterWeakPoint!.prepared).toBe(false);
  });

  it('ordinary J and nonpositive physical conditions do not spend an existing weak-point mark', () => {
    const state = fixture(); heldPracticeClub(state); observed(state);
    resolve(state, weapons, 1, undefined, fixedRolls(13)); const before = structuredClone(state);
    expect(resolve(state, weapons, 1, undefined, fixedRolls(12)).selfGain).toBe(47.25 * 0.65);
    for (const physical of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(resolve(state, weapons, physical, undefined, fixedRolls(20)))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
    }
    expect(state).toEqual(before);
  });

  it('rejects transferred, stale or forged sources before random draws and mark changes', () => {
    const state = fixture(); heldPracticeClub(state); observed(state);
    resolve(state, weapons, 1, undefined, fixedRolls(13));
    const source = currentWeaponmasterCombatSource(state)!, before = structuredClone(state);
    const invalid: (WeaponmasterCombatSource | null)[] = [null,
      { ...source, runId: 'other-run' }, { ...source, revision: source.revision + 1 },
      { ...source, week: source.week + 1 }, { ...source, round: source.round + 1 },
      ...(['encounterId', 'target', 'nature', 'body', 'space', 'exit'] as const)
        .map(key => ({ ...source, [key]: 'FORGED' }) as unknown as WeaponmasterCombatSource)];
    for (const input of invalid) {
      const random = fixedRolls();
      for (const id of ids) expect(resolve(state, id, 1, input, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      expect(random.cursor).toBe(0); expect(state).toEqual(before);
    }
  });

  it('rechecks absent/dead/departed targets, encounter and player state before using any mark', () => {
    for (const mutate of [
      (s: SliceState) => { s.combat = null; }, (s: SliceState) => { s.health = 0; },
      (s: SliceState) => { s.health = Number.NaN; }, (s: SliceState) => { s.status = 'DEAD'; },
      (s: SliceState) => { s.combat!.enemyHealth = 0; }, (s: SliceState) => { s.combat!.enemyHealth = Number.NaN; },
      (s: SliceState) => { s.combat!.enemyStatus = 'DEAD'; }, (s: SliceState) => { s.combat!.enemyStatus = 'SURRENDERED'; },
      (s: SliceState) => { s.progression.sequence = 8; }, (s: SliceState) => { s.progression.pathwayId = 'hunter'; },
      (s: SliceState) => { s.arc.stage = 'C'; }, (s: SliceState) => { s.world.city = 'ELSEWHERE'; },
      (s: SliceState) => { s.world.carrierAlive = false; }, (s: SliceState) => { s.world.carrierCanResist = false; },
      (s: SliceState) => { s.combat!.encounterId = 'HUNTER_CARGO'; }, (s: SliceState) => { s.combat!.round = 0; },
    ]) {
      const state = fixture(); heldPracticeClub(state); observed(state);
      resolve(state, weapons, 1, undefined, fixedRolls(13));
      const source = currentWeaponmasterCombatSource(state)!; mutate(state);
      const before = structuredClone(state), random = fixedRolls();
      expect(currentWeaponmasterCombatSource(state)).toBeNull();
      for (const id of ids) expect(resolve(state, id, 1, source, random))
        .toMatchObject({ selfGain: 0, enemyReduction: 0, threatens: false });
      observeWeaponmasterEnemyAction(state, 'OPENING');
      expect(state).toEqual(before); expect(random.cursor).toBe(0);
    }
  });
});

describe('Weaponmaster shared rounds, consequences and replay', () => {
  it('fits five player actions against three enemy actions, with one paid subdraw and no extra hit', () => {
    const state = fixture(); state.spirituality = 0; const before = structuredClone(state);
    const draws = scriptRolls(100, 100, 1, 1, 191, 12, 1, 291, 1, 323, 343, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect([round.playerCount, round.enemyCount]).toEqual([5, 3]);
    expect(round.moves.map(move => move.actor)).toEqual(['PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'ENEMY', 'PLAYER', 'PLAYER']);
    expect(round.moves.filter(move => move.actor === 'PLAYER').map(move => [move.selfGain, move.enemyReduction])).toEqual([
      [67.5 * 0.65, 0], [47.25 * 0.65, 0], [0, 18 * 0.65], [0, 12.6 * 0.65], [0, 0],
    ]);
    expect(round.playerAdvantage).toBe(465 * 0.8 + (67.5 * 0.65 + 47.25 * 0.65));
    expect(round.enemyAdvantage).toBe(114 + 48 - (18 * 0.65 + 12.6 * 0.65));
    expect(outcome).toBe('CONTINUE'); expect(state.combat!.enemyHealth).toBe(90);
    expect(state.spirituality).toBe(6); expect(state.combat!.round).toBe(2);
    expect(state.progression).toEqual(before.progression); expect(state.warrior).toEqual(before.warrior);
    expect(state.world).toEqual(before.world); expect(state.actionsRemaining).toBe(before.actionsRemaining);
    expect(state.week).toBe(before.week); expect(state.weeklyBudget).toBe(before.weeklyBudget);
    expect(draws).toHaveBeenCalledTimes(13); expect(state.random.cursor).toBe(before.random.cursor + 13);
  });

  it('does not see a later enemy strike early: first fallback, actual enemy move, first mark, then release', () => {
    const state = fixture(); heldPracticeClub(state); state.spirituality = 0;
    const draws = scriptRolls(75, 1, 191, 13, 1, 191, 13, 191, 20, 1, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    const player = round.moves.filter(move => move.actor === 'PLAYER');
    expect(player.map(move => move.selfGain)).toEqual([47.25 * 0.65, 0, 420 * 0.65]);
    expect(player[0]!.label).toContain('本场尚无已发生'); expect(player[1]!.label).toContain('第一段');
    expect(player[2]!.label).toContain('标记已消耗');
    expect(round.moves).toHaveLength(4); expect(draws).toHaveBeenCalledTimes(11);
    expect(state.combat!.weaponmasterWeakPoint).toEqual({ observed: true, prepared: false });
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.combat!.enemyHealth).toBe(90); expect(outcome).toBe('CONTINUE');
  });

  it('holds the mark across real round boundaries, then consumes it without bypassing the common consequence wheel', () => {
    const state = fixture(); heldPracticeClub(state);
    scriptRolls(50, 1, 343, 1, 191, 13, 1);
    const first = resolveSliceCombatRound(state, 'ATTACK');
    expect(first.round.consequenceWeights).toBeNull(); expect(first.outcome).toBe('CONTINUE');
    expect(state.combat!.weaponmasterWeakPoint).toEqual({ observed: true, prepared: true });
    expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.round).toBe(2);
    vi.restoreAllMocks();
    scriptRolls(1, 1, 400, 191, 13, 1, 1);
    const second = resolveSliceCombatRound(state, 'ATTACK');
    expect(second.round.first).toBe('ENEMY'); expect(second.round.moves[1]!.selfGain).toBe(420 * 0.65);
    expect(second.round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(state.combat!.weaponmasterWeakPoint!.prepared).toBe(false);
    expect(state.combat!.enemyHealth).toBe(90); expect(second.outcome).toBe('CONTINUE');
  });

  it('never creates evidence from an ordinary miss and keeps0-gain actions nonthreatening', () => {
    for (const ticket of [291, 323, 343, 359]) {
      const state = fixture(); heldPracticeClub(state);
      const draws = ticket === 359 ? scriptRolls(1, 1, ticket, 2, 400, 1) : scriptRolls(1, 1, ticket, 400, 1);
      const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
      expect(round.moves[0]!.selfGain).toBe(ticket === 359 ? 11.25 : 0);
      expect(round.consequenceWeights).toBeNull(); expect(outcome).toBe('CONTINUE');
      expect(state.combat!.enemyHealth).toBe(100); expect(state.combat!.weaponmasterWeakPoint).toBeUndefined();
      expect(draws).toHaveBeenCalledTimes(ticket === 359 ? 6 : 5); vi.restoreAllMocks();
    }
  });

  it('applies either sign of11.25 accident once, with no resource or original-club changes', () => {
    for (const roll of [1, 2]) {
      const state = fixture(); heldPracticeClub(state); const before = structuredClone(state);
      const effect = resolve(state, 'ACCIDENT', 0.8, undefined, fixedRolls(roll));
      expect(effect.selfGain).toBe(roll === 1 ? -11.25 : 11.25); expect(effect.threatens).toBe(false);
      expect(state).toEqual(before);
    }
  });

  it('preserves real enemy attacks and injury risk and clears marks on player death', () => {
    const state = fixture(); heldPracticeClub(state); observed(state);
    state.combat!.weaponmasterWeakPoint!.prepared = true;
    const club = structuredClone(state.warrior.practiceClub);
    state.health = 40; state.spirituality = 5; state.injuryRisk = 1;
    state.injuries = [{ id: 'prior', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: 2 }];
    scriptRolls(1, 1, 291, 1, 1_000_000, 96);
    const { round, outcome } = resolveSliceCombatRound(state, 'ATTACK');
    expect(round.moves[1]!.selfGain).toBe(16); expect(round.moves[0]!.label).toContain('不能防弹');
    expect(outcome).toBe('PLAYER_DEAD'); expect(state.health).toBe(0);
    expect(round.consequenceWeights).toEqual({ light: 45, heavy: 30, death: 25 });
    expect(state.injuryRisk).toBe(2); expect(state.spirituality).toBe(5);
    expect(state.warrior.practiceClub).toEqual(club); expect(state.combat!.weaponmasterWeakPoint).toBeUndefined();
  });

  it('clears marks on enemy surrender, enemy death and successful ordinary retreat without creating equipment', () => {
    for (const kind of ['SURRENDER', 'DEATH', 'RETREAT'] as const) {
      const state = fixture(); heldPracticeClub(state); observed(state); state.spirituality = 0;
      state.combat!.weaponmasterWeakPoint!.prepared = true; const club = structuredClone(state.warrior.practiceClub);
      if (kind === 'RETREAT') scriptRolls(1, 1, 50);
      else scriptRolls(1, 1, 191, 13, 400, 1, kind === 'SURRENDER' ? 66 : 96);
      const { round, outcome } = resolveSliceCombatRound(state, kind === 'RETREAT' ? 'RETREAT' : 'ATTACK');
      expect(outcome).toBe(kind === 'RETREAT' ? 'RETREATED' : kind === 'SURRENDER' ? 'ENEMY_SURRENDERED' : 'ENEMY_DEAD');
      expect(state.combat!.weaponmasterWeakPoint).toBeUndefined(); expect(state.warrior.practiceClub).toEqual(club);
      expect(state.spirituality).toBe(0);
      if (kind === 'SURRENDER') { expect(state.combat!.enemyHealth).toBe(70); expect(round.consequence).toContain('仍然活着'); }
      if (kind === 'RETREAT') expect(round.moves).toEqual([]);
      vi.restoreAllMocks();
    }
  });

  it('failed retreat leaves a live mark available and still allows actual enemy damage', () => {
    const state = fixture(); heldPracticeClub(state); observed(state); state.combat!.weaponmasterWeakPoint!.prepared = true;
    scriptRolls(1, 1, 51, 1, 1_000_000, 1);
    const { round, outcome } = resolveSliceCombatRound(state, 'RETREAT');
    expect(round.retreat).toBe('FAILURE'); expect(round.moves).toHaveLength(1);
    expect(round.moves[0]).toMatchObject({ actor: 'ENEMY', selfGain: 16 });
    expect(outcome).toBe('CONTINUE'); expect(state.health).toBe(90);
    expect(state.combat!.weaponmasterWeakPoint!.prepared).toBe(true);
  });

  it('replays serialized prepared state from the same seed and cursor without Math.random or tool duplication', () => {
    const state = fixture(); heldPracticeClub(state); observed(state); state.random.cursor = 7; state.health = 70;
    state.combat!.weaponmasterWeakPoint!.prepared = true;
    const restored = JSON.parse(JSON.stringify(state)) as SliceState;
    const forbidden = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('forbidden'); });
    expect(resolveSliceCombatRound(state, 'ATTACK')).toEqual(resolveSliceCombatRound(restored, 'ATTACK'));
    expect(state).toEqual(restored); expect(forbidden).not.toHaveBeenCalled();
    expect(state.warrior.practiceClub).toMatchObject({ id: 'warrior-training-club',
      owner: '奥斯温·布莱克特', custodian: 'PLAYER', location: 'player:hand', version: 2 });
  });
});
