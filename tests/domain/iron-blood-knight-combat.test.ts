import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import { playerAbilityWheel, playerCountWheel, resolveSliceCombatRound } from '../../src/domain/slice/combat.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createIronBloodKnightState } from '../../src/domain/iron-blood-knight/index.js';
import { applyIronBloodEncounterCommand } from '../../src/domain/iron-blood-knight/encounter.js';
import { beginIronBloodCombatRound, currentIronBloodCombatSource, drawIronBloodAbility,
  finishIronBloodCombatRound, IRON_BLOOD_COUNT_WHEEL, ironBloodAbilityWheel, ironBloodActionCount,
  resolveIronBloodCombatAbility, shareIronBloodHealthDamage, type IronBloodCombatSource,
  type IronBloodMoveId } from '../../src/domain/iron-blood-knight/combat.js';
import { hunterAbilityWheel } from '../../src/domain/hunter/combat.js';
import { provokerAbilityWheel } from '../../src/domain/provoker/combat.js';
import { pyromaniacAbilityWheel } from '../../src/domain/pyromaniac/combat.js';
import { reaperAbilityWheel } from '../../src/domain/reaper/combat.js';
import { bizarroSorcererAbilityWheel } from '../../src/domain/bizarro-sorcerer/combat.js';
import { DeterministicActionRandomStream, type ActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SeerContext } from '../../src/domain/seer/index.js';

const context: SeerContext = { note: () => {}, roll: min => min, check: () => { throw new Error('No check is needed'); } };
/** Narrow engine fixture, not a natural promotion or thirty-member ritual claim. */
function fixture(companions = true): SliceState {
  const s = createSliceRun('iron-blood-combat-test', sliceDefaultCreationSelection, 'iron-blood-combat');
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.week = 20; s.actionsRemaining = 3;
  s.progression = { pathwayId: 'hunter', sequence: 4, mastery: {}, acting: 0, promotionWeek: 19 };
  s.character.coreStats = { physique: 15, perception: 15, will: 15, knowledge: 15 };
  s.ironBloodKnight = createIronBloodKnightState(); s.ironBloodKnight.promotionWeek = 19; s.health = 100; s.mind = 100; s.spirituality = 120;
  for (const m of s.ironBloodKnight.team.members.slice(0, 2)) { m.joined = true; m.joinedWeek = 1; }
  applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_TALK' }, context);
  if (companions) applyIronBloodEncounterCommand(s, { type: 'CALL_COMPANIONS' }, context);
  applyIronBloodEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, context);
  s.town.clubLocation = 'SHOP'; return s;
}
const noRandom: ActionRandomStream = { seed: 'none', cursor: 0, nextInt: () => { throw new Error('Unexpected extra draw'); } };
function effect(s: SliceState, id: IronBloodMoveId, source: IronBloodCombatSource | null = currentIronBloodCombatSource(s)) {
  return resolveIronBloodCombatAbility(s, id, 1, noRandom, undefined, source);
}
function script(...values: number[]) {
  let index = 0; const original = DeterministicActionRandomStream.prototype.nextInt;
  return vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt').mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
    original.call(this, min, max); const value = values[index++];
    if (value === undefined || value < min || value > max) throw new Error(`Unexpected draw ${index}`);
    return value;
  });
}
afterEach(() => vi.restoreAllMocks());

describe('Iron Blood Knight S4 finite real combat', () => {
  it('selects its own 1–6 counts, real finite new slots and exact stance tickets', () => {
    const s = fixture(); expect(playerCountWheel(s)).toEqual(IRON_BLOOD_COUNT_WHEEL);
    expect(playerAbilityWheel(s, null)).toEqual(ironBloodAbilityWheel(s, null));
    expect(ironBloodAbilityWheel(s, null).map(e => e.weight)).toEqual([15, 5, 10, 10, 5, 5, 10, 5, 20, 5, 5, 5]);
    for (const [roll, count] of [[1, 1], [10, 1], [11, 2], [25, 2], [26, 3], [50, 3], [51, 4], [75, 4], [76, 5], [90, 5], [91, 6], [100, 6]]) expect(ironBloodActionCount(roll!)).toBe(count);
    const wheel = ironBloodAbilityWheel(s, 'ATTACK');
    expect(wheel.reduce((n, e) => n + e.weight, 0)).toBeCloseTo(100);
    const random: ActionRandomStream = { seed: 'first', cursor: 0, nextInt: min => min };
    expect(drawIronBloodAbility(random, s, 'ATTACK')).toBe('IRON_BLOOD_FLAME');
  });
  it('does not change old Hunter9–5 or Diviner4 wheels', () => {
    const s = fixture();
    for (const sequence of [9, 8, 7, 6, 5]) {
      s.progression.sequence = sequence;
      expect(playerAbilityWheel(s, 'CONTROL')).toEqual(sequence === 9 ? hunterAbilityWheel('CONTROL') : sequence === 8 ? provokerAbilityWheel('CONTROL')
        : sequence === 5 ? reaperAbilityWheel(s, 'CONTROL') : pyromaniacAbilityWheel('CONTROL'));
    }
    s.progression.pathwayId = 'diviner'; s.progression.sequence = 4;
    expect(playerAbilityWheel(s, 'CONTROL')).toEqual(bizarroSorcererAbilityWheel(s, 'CONTROL'));
  });
  it('charges actual flame/steel resources without immunity or permanent form', () => {
    const s = fixture(), body = structuredClone(s.ironBloodKnight.life.practice);
    expect(effect(s, 'IRON_BLOOD_STEEL')).toMatchObject({ selfGain: 0, enemyReduction: 18, threatens: false });
    expect(s.spirituality).toBe(117);
    expect(effect(s, 'IRON_BLOOD_FLAME')).toMatchObject({ selfGain: 55 * 0.65, enemyReduction: 0, threatens: true });
    expect(s.spirituality).toBe(113); expect(s.ironBloodKnight.life.practice).toEqual(body);
    s.spirituality = 2; expect(effect(s, 'IRON_BLOOD_FLAME').selfGain).toBe(12); expect(s.spirituality).toBe(2);
  });
  it('preserves old fire costs and the real inherited weakness window', () => {
    const s = fixture();
    for (const [id, cost, gain] of [['hunter.s7.compressed-fireball', 3, 36], ['hunter.s7.flame-lance', 3, 32], ['hunter.s7.fire-raven', 2, 24]] as const) {
      const before = s.spirituality; expect(effect(s, id).selfGain).toBe(gain); expect(s.spirituality).toBe(before - cost);
    }
    expect(effect(s, 'hunter.s7.flame-control').enemyReduction).toBe(18);
    expect(effect(s, 'hunter.s5.precision-strike').selfGain).toBe(12);
    const before = s.spirituality; expect(effect(s, 'hunter.s5.weakness-observation').selfGain).toBe(0);
    expect(effect(s, 'hunter.s5.precision-strike').selfGain).toBeCloseTo(12 + 36 * 0.65);
    expect(s.spirituality).toBe(before - 4); expect(s.ironBloodKnight.encounter.weakness.available).toBe(false);
  });
  it('rejects missing, stale or substituted original sources before paying', () => {
    const s = fixture(), source = currentIronBloodCombatSource(s)!;
    for (const bad of [null, { ...source, round: 2 }, { ...source, targetId: 'COPY' }, { ...source, weaponId: 'CLONE' }]) {
      const before = structuredClone(s);
      expect(effect(s, 'IRON_BLOOD_FLAME', bad as IronBloodCombatSource | null).selfGain).toBe(0); expect(s).toEqual(before);
    }
    s.combat!.encounterId = 'REAPER_DISPUTE'; expect(currentIronBloodCombatSource(s)).toBeNull();
  });
  it('borrows from only actual original01/02 and persists their paid energy', () => {
    const s = fixture(), m = s.ironBloodKnight.team.members, other = structuredClone(m.slice(2));
    const ctx = beginIronBloodCombatRound(s, 'HOLD');
    expect(resolveIronBloodCombatAbility(s, 'hunter.s4.comrade-link', 1, noRandom, ctx).selfGain).toBe(24);
    expect(m[0]!.energy).toBe(17); expect(m[1]!.energy).toBe(17); expect(m.slice(2)).toEqual(other);
    expect(s.spirituality).toBe(117); expect(ctx.outcome.payments.map(p => p.energyCost)).toEqual([3, 3]);
    finishIronBloodCombatRound(s, ctx, true); expect(m[0]!.energy).toBe(17); expect(s.ironBloodKnight.encounter.linkedMemberIds).toEqual([]);
    const solo = fixture(false), soloRound = beginIronBloodCombatRound(solo, 'SHARE_FIRST'), before = solo.spirituality;
    expect(resolveIronBloodCombatAbility(solo, 'hunter.s4.comrade-link', 1, noRandom, soloRound).selfGain).toBe(0);
    expect(solo.spirituality).toBe(before); expect(soloRound.outcome.payments).toEqual([]);
  });
  it('requires explicit per-round sharing, bounded actual damage and only one share', () => {
    const s = fixture(), members = s.ironBloodKnight.team.members;
    const hold = beginIronBloodCombatRound(s, 'HOLD'); expect(shareIronBloodHealthDamage(s, 30, hold, 'HEAVY').ownerDamage).toBe(30);
    const ctx = beginIronBloodCombatRound(s, 'SHARE_FIRST'); expect(shareIronBloodHealthDamage(s, 30, ctx, 'HEAVY').ownerDamage).toBe(24);
    expect(ctx.outcome.sharedHealthDamage).toBe(6); expect(members.slice(0, 2).map(m => m.health)).toEqual([95, 99]);
    expect(shareIronBloodHealthDamage(s, 30, ctx, 'HEAVY').ownerDamage).toBe(30); expect(ctx.outcome.sharedHealthDamage).toBe(6);
    const capped = fixture(), capRound = beginIronBloodCombatRound(capped, 'SHARE_FIRST');
    expect(shareIronBloodHealthDamage(capped, 100, capRound, 'HEAVY').ownerDamage).toBe(90); expect(capRound.outcome.sharedHealthDamage).toBe(10);
  });
  it('never shares a DEATH sector and removes low-health actual members from contact', () => {
    const s = fixture(), ctx = beginIronBloodCombatRound(s, 'SHARE_FIRST');
    expect(shareIronBloodHealthDamage(s, 100, ctx, 'DEATH').ownerDamage).toBe(100); expect(ctx.outcome.payments).toEqual([]);
    s.ironBloodKnight.team.members[0]!.health = 41;
    expect(shareIronBloodHealthDamage(s, 30, ctx, 'HEAVY').ownerDamage).toBe(24);
    expect(s.ironBloodKnight.team.members[0]).toMatchObject({ health: 36, present: false, location: 'HOME' });
    expect(s.ironBloodKnight.encounter.linkedMemberIds).not.toContain('IB4-01');
    const nearDeath = fixture(); nearDeath.health = 1;
    const end = beginIronBloodCombatRound(nearDeath, 'SHARE_FIRST');
    expect(shareIronBloodHealthDamage(nearDeath, 30, end, 'HEAVY').ownerDamage).toBe(1); expect(end.outcome.sharedHealthDamage).toBe(0);
  });
  it('uses S4 1250 core and a real shared injury while the next round defaults to HOLD', () => {
    const s = fixture(), spy = script(1, 1, 1, 1, 1_000_000, 1);
    const first = resolveSliceCombatRound(s, 'ATTACK', 'HOLD', 'HOLD', null, 'HOLD', 'SHARE_FIRST');
    expect(spy).toHaveBeenCalledTimes(6); spy.mockRestore();
    expect(first.outcome).toBe('CONTINUE'); expect(first.round.playerAdvantage).toBeCloseTo(1250 + 15 + 55 * 0.65);
    expect(s.health).toBe(92); expect(s.injuries).toHaveLength(1); expect(s.mind).toBe(100);
    expect(first.round.ironBloodOutcome).toMatchObject({ policy: 'SHARE_FIRST', sharedHealthDamage: 2, payments: [{ memberId: 'IB4-01', healthDamage: 2, energyCost: 0 }] });
    s.combatHistory.push(structuredClone(first.round));
    const nextSpy = script(1, 1, 1, 1, 1_000_000, 1);
    const next = resolveSliceCombatRound(s, 'ATTACK');
    expect(nextSpy).toHaveBeenCalledTimes(6); expect(next.round.ironBloodOutcome?.policy).toBe('HOLD');
    expect(s.health).toBe(82); expect(s.injuryRisk).toBe(1); expect(s.ironBloodKnight.team.members[0]!.health).toBe(98);
  });
  it('retains true DEATH and grants12 regeneration only on a continuing round', () => {
    const s = fixture(); s.spirituality = 80;
    const spy = script(1, 1, 1, 1, 1_000_000, 1);
    resolveSliceCombatRound(s, 'ATTACK'); expect(s.spirituality).toBe(88); spy.mockRestore();
    const doomed = fixture(), dead = script(1, 1, 1, 1, 1_000_000, 100);
    const result = resolveSliceCombatRound(doomed, 'ATTACK', 'HOLD', 'HOLD', null, 'HOLD', 'SHARE_FIRST');
    expect(dead).toHaveBeenCalledTimes(6); expect(result.outcome).toBe('PLAYER_DEAD'); expect(doomed.health).toBe(0);
    expect(doomed.spirituality).toBe(116); expect(result.round.ironBloodOutcome?.sharedHealthDamage).toBe(0);
    expect(doomed.ironBloodKnight.team.members.slice(0, 2).map(m => m.health)).toEqual([100, 100]);
  });
});
