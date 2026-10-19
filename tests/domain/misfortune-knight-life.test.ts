import { hasConcealmentServantLock } from '../../src/domain/concealment-servant/index.js';
import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { MISFORTUNE_KNIGHT_PREPARATION_IDS } from '../../src/domain/misfortune-knight/types.js';
import {
  createMisfortuneKnightLifeState, getMisfortuneKnightOriginals, hasMisfortuneKnightLifeLock, lifeAdultsAbsent,
  misfortuneKnightExpectedOriginals, misfortuneKnightLifeActions, misfortuneKnightLifeMasteryGains, misfortuneKnightLifeOriginalEvents,
  projectMisfortuneKnightLife, validateMisfortuneKnightActivityCommand, validateMisfortuneKnightLife,
  type MisfortuneKnightActivityCommand, type MisfortuneKnightCaseId,
} from '../../src/domain/misfortune-knight/life.js';
import { directedInitial2, dose, mk, originalConcealmentServant, rejectIntent, rejectMisfortuneKnight, step } from './misfortune-knight-directed-helper.js';

const GUIDED = 'darkness.s1.guided-mishap', GUARD = 'darkness.s1.bounded-night-guard';
const good = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
type CheckInput = { type: 'GUIDED_MISHAP' | 'CATCH_PARCEL' | 'BOUNDED_NIGHT_GUARD'; success: boolean; helped?: boolean };
const cache = new Map<string, SliceState>();
/** Explicit unit-only future-input selection happens before the new journal.
 * The shared loader migrates the actual living518 branch, separately from raw
 * schema166 fixture pins. No dead528 final is fabricated or revived here. */
function lifeState(checks: CheckInput[] = [], actions = 20): SliceState {
  const key = JSON.stringify({ checks, actions }), cached = cache.get(key); if (cached) return structuredClone(cached);
  let s = directedInitial2(), selected: number | null = null; s.actionsRemaining = s.weeklyBudget = actions;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 8192; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    const promotion = resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) });
    if (promotion.tier !== 'SUCCESS') continue;
    let match = true;
    for (const input of checks) {
      const ability = input.type === 'GUIDED_MISHAP' ? 'will' : input.type === 'BOUNDED_NIGHT_GUARD' ? 'knowledge' : 'perception';
      const result = resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability] + 1, difficulty: 18,
        modifiers: input.helped ? [{ source: '这一次尚未发生的原盒接取', value: 10 }] : [], roll: random.nextInt(1, 100) });
      if (good(result.tier) !== input.success) { match = false; break; }
    }
    if (match) { selected = cursor; break; }
  }
  if (selected === null) throw new Error('No bounded declared life input found.');
  s.random.cursor = selected; assertValidSliceState(s); s = mk(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of MISFORTUNE_KNIGHT_PREPARATION_IDS) s = mk(s, { type: 'PREPARE_TASK', taskId });
  s = mk(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = mk(s, { type: 'PREPARE_PROMOTION' }); s = mk(s, dose);
  expect(s.progression.sequence).toBe(1); expect(validateMisfortuneKnightLife(s)).toBe(true); cache.set(key, structuredClone(s)); return s;
}
function act(s: SliceState, ...commands: MisfortuneKnightActivityCommand[]): SliceState {
  for (const command of commands) {
    s = mk(s, command); expect(validateMisfortuneKnightLife(s), JSON.stringify(command)).toBe(true);
    expect(misfortuneKnightExpectedOriginals(s)).toEqual(getMisfortuneKnightOriginals(s));
    expect(s.spiritWarlock.companion).toEqual(s.misfortuneKnight.life.sourceCompanion);
    expect(s.spiritWarlock.companion).toMatchObject({ status: 'SEALED', source: 'SW5-LEAF-1', deployments: 12, recalls: 12 });
  }
  return s;
}
function enter(s: SliceState, caseId: MisfortuneKnightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  return act(s, { type: 'OBSERVE', caseId }, { type: 'INVITE', caseId, method }, { type: 'VISIT_ROOM' },
    { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'TECHNICIAN' },
    { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'SELF_POWER' }, { type: 'SETUP_TOOLS' }, { type: 'BORROW_BOX' });
}
function finish(s: SliceState, caseId: MisfortuneKnightCaseId): SliceState {
  if (s.misfortuneKnight.life.practice.rig.weightState === 'ARMED') s = act(s, { type: 'STOP_RELEASE' });
  if (s.concealmentServant.life.room.doorBlocked) s = act(s, { type: 'CLEAR_DOOR' });
  if (s.misfortuneKnight.life.practice.boxHolder !== 'START') s = act(s, { type: 'RETURN_BOX' });
  if (s.misfortuneKnight.life.practice.plate.holder === 'PLAYER') s = act(s, { type: 'RETURN_PLATE' });
  if (s.misfortuneKnight.life.practice.rig.borrowed) s = act(s, { type: 'RETURN_TOOLS' });
  return act(s, { type: 'RETURN_HOME' }, { type: 'REPORT', caseId });
}
const ordinaryFirst = (s: SliceState) => finish(act(enter(s, 'pending-parcel', 'ORDINARY'), { type: 'ORDINARY_CARRY' }), 'pending-parcel');
const ordinarySecond = (s: SliceState) => finish(act(enter(s, 'personal-dark-guard', 'ORDINARY'), { type: 'ORDINARY_CARRY' }), 'personal-dark-guard');
const armGuard = (s: SliceState) => act(s, { type: 'BORROW_PLATE' }, { type: 'ARM_IMPACT' });
function nextActualWeek(s: SliceState): SliceState {
  const week = s.week;
  for (let n = 0; n < 128 && s.week === week; n++) {
    if (s.activeEvent) { if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected event ${s.activeEvent.id}`); s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'PAY' }); }
    else s = step(s, { type: 'ACTION', action: 'REST' });
  }
  expect(s.week).toBeGreaterThan(week); return s;
}

describe('Misfortune Knight finite life in the same original6m room', () => {
  it('uses the migrated living518 source, preserving original people, box, paper, weak trace, old outcomes and sealed leaf', () => {
    const original = originalConcealmentServant(), s = lifeState(), l = s.misfortuneKnight.life;
    expect(l.sourceOriginals).toEqual(getMisfortuneKnightOriginals(original));
    expect(l.sourceOriginals).toMatchObject({ playerLocation: 'EXIT', playerTravelMetres: 44, clockSeconds: 156,
      erin: { id: 'CS2-ERIN', name: '艾琳', age: 38, alive: true, location: 'EXIT', travelMetres: 60 },
      box: { id: 'CS2-CASE-1', owner: 'CS2-ERIN', location: 'START', travelMetres: 8 },
      trace: { exists: true, alive: false, conscious: false, searches: 2, delayedSearches: 1, totalDelaySeconds: 20 } });
    expect('massKg' in s.concealmentServant.life.box).toBe(false);
    expect(l.practice.technician).toEqual({ id: 'MK1-MILO44', name: '米洛', age: 44, alive: true, health: 100, mind: 100, location: 'EXIT', offsetMetres: 6 });
    expect(l.practice.plate).toMatchObject({ id: 'MK1-WOOD-PLATE', owner: 'MK1-MILO44', integrity: 65, wear: 0, holder: 'OWNER' });
    expect(l.practice.tray.id).toBe('MK1-TRAY'); expect(l.practice.rig.weightState).toBe('OWNER');
    expect(s.spiritWarlock).toEqual(original.spiritWarlock); expect(s.nightwatcher.encounter.enemy.status).toBe('DEAD');
    expect(s.fearBishop.encounter.enemyStatus).toBe('SURRENDERED'); expect(s.concealmentServant.encounter).toEqual(original.concealmentServant.encounter);
    expect(s.concealmentServant.life.cases).toEqual(original.concealmentServant.life.cases); expect(s.concealmentServant.life.journal).toEqual(original.concealmentServant.life.journal);
    expect(projectMisfortuneKnightLife(s).currentConsents.every(c => !c.consented)).toBe(true); expect(lifeAdultsAbsent(s)).toBe(true);
    expect(createMisfortuneKnightLifeState().sourceOriginals).toBeNull(); expect(s.progression.mastery[GUIDED]).toBe(0); expect(s.progression.mastery[GUARD]).toBe(0);
  }, 120_000);

  it('requires separate fresh permissions and real40m access before preparing one actual original-box motion', () => {
    let s = lifeState([{ type: 'GUIDED_MISHAP', success: true }, { type: 'CATCH_PARCEL', success: true, helped: true }]); const before = structuredClone(s);
    rejectMisfortuneKnight(s, { type: 'GUIDED_MISHAP' }); s = act(s, { type: 'OBSERVE', caseId: 'pending-parcel' }, { type: 'INVITE', caseId: 'pending-parcel', method: 'ABILITY' });
    rejectMisfortuneKnight(s, { type: 'CONSENT', permission: 'OWNER' }); rejectMisfortuneKnight(s, { type: 'SETUP_TOOLS' });
    s = act(s, { type: 'VISIT_ROOM' }); expect(s.misfortuneKnight.life.practice.playerTravelMetres).toBe(40);
    expect(s.concealmentServant.life.playerTravelMetres).toBe(before.concealmentServant.life.playerTravelMetres + 40);
    s = act(s, { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'TECHNICIAN' }); rejectMisfortuneKnight(s, { type: 'SETUP_TOOLS' });
    s = act(s, { type: 'CONSENT', permission: 'SELF_POWER' }, { type: 'SETUP_TOOLS' }, { type: 'BORROW_BOX' });
    rejectMisfortuneKnight(s, { type: 'GUIDED_MISHAP' }); s = act(s, { type: 'ARM_PARCEL' }, { type: 'GUIDED_MISHAP' });
    expect(s.spirituality).toBe(before.spirituality - 6); expect(s.mind).toBe(before.mind - 2); expect(s.cash).toBe(before.cash - 20);
    expect(s.misfortuneKnight.life.practice.pendingGuided).toMatchObject({ bonus: 10 }); expect(s.misfortuneKnight.life.practice.boxHolder).toBe('BOARD');
    expect(s.concealmentServant.life.box.travelMetres).toBe(before.concealmentServant.life.box.travelMetres); expect(s.progression.mastery[GUIDED]).toBe(0);
    rejectMisfortuneKnight(s, { type: 'GUIDED_MISHAP' }); s = act(s, { type: 'CATCH_PARCEL' });
    expect(s.lastCheck?.modifiers).toEqual([{ source: '这一次尚未发生的原盒接取', value: 10 }]);
    expect(s.misfortuneKnight.life.cases['pending-parcel']).toMatchObject({ guidedApplied: true, guidedEnd: 'APPLIED', result: 'ABILITY' });
    expect(s.concealmentServant.life.box.travelMetres).toBe(before.concealmentServant.life.box.travelMetres + 2); rejectMisfortuneKnight(s, { type: 'CATCH_PARCEL' }); rejectMisfortuneKnight(s, { type: 'RETURN_HOME' });
    s = finish(s, 'pending-parcel'); expect(s.progression.mastery[GUIDED]).toBe(8); expect(s.progression.acting).toBe(25); expect(hasMisfortuneKnightLifeLock(s)).toBe(false);
    expect(s.concealmentServant.life.box).toEqual({ ...before.concealmentServant.life.box, travelMetres: before.concealmentServant.life.box.travelMetres + 4 });
    expect(s.concealmentServant.life.erin).toEqual(before.concealmentServant.life.erin); expect(s.concealmentServant.life.page).toEqual(before.concealmentServant.life.page);
    expect(s.concealmentServant.life.trace).toEqual(before.concealmentServant.life.trace); expect(s.misfortuneKnight.life.practice.playerTravelMetres).toBeGreaterThan(80);
    expect(misfortuneKnightLifeMasteryGains(s)).toEqual({ [GUIDED]: 8, [GUARD]: 0 });
  }, 120_000);

  it('retains failed casting and independent catching failures with a real soft-pad object and no free retry or injury', () => {
    let s = lifeState([{ type: 'GUIDED_MISHAP', success: false }, { type: 'CATCH_PARCEL', success: false }]); const health = s.health;
    s = act(enter(s, 'pending-parcel'), { type: 'ARM_PARCEL' }, { type: 'GUIDED_MISHAP' }, { type: 'CATCH_PARCEL' });
    expect(s.misfortuneKnight.life.cases['pending-parcel']).toMatchObject({ guidedEnd: 'FAILED', result: 'NONE', guidedApplied: false });
    expect(s.misfortuneKnight.life.practice).toMatchObject({ boxHolder: 'PAD', boxOffsetMetres: 2 }); expect(s.health).toBe(health);
    expect(s.concealmentServant.life.box).toMatchObject({ id: 'CS2-CASE-1', location: 'TABLE', travelMetres: 10 });
    rejectMisfortuneKnight(s, { type: 'GUIDED_MISHAP' }); rejectMisfortuneKnight(s, { type: 'CATCH_PARCEL' });
    s = finish(act(s, { type: 'ORDINARY_CARRY' }), 'pending-parcel'); expect(s.progression.mastery[GUIDED]).toBe(0);
    expect(projectMisfortuneKnightLife(s).cases[0]!.attempts[0]!.receipts.filter(r => r.outcome && !good(r.outcome))).toHaveLength(2);
  }, 120_000);

  it('keeps a successful cast but failed ordinary catch distinct, consuming the window without applied mastery', () => {
    let s = lifeState([{ type: 'GUIDED_MISHAP', success: true }, { type: 'CATCH_PARCEL', success: false, helped: true }]);
    s = act(enter(s, 'pending-parcel'), { type: 'ARM_PARCEL' }, { type: 'GUIDED_MISHAP' }, { type: 'CATCH_PARCEL' });
    expect(s.misfortuneKnight.life.cases['pending-parcel']).toMatchObject({ guidedEnd: 'OPERATION_FAILED', guidedApplied: false, result: 'NONE' });
    expect(s.misfortuneKnight.life.practice.pendingGuided).toBeNull(); s = finish(act(s, { type: 'ORDINARY_CARRY' }), 'pending-parcel');
    expect(s.progression.mastery[GUIDED]).toBe(0); expect(s.misfortuneKnight.life.practice.boxHolder).toBe('START');
  }, 120_000);

  it('expires or physically steps out of an unused guided window without refunds, recasting or retroactive help', () => {
    const prepared = act(enter(lifeState([{ type: 'GUIDED_MISHAP', success: true }]), 'pending-parcel'), { type: 'ARM_PARCEL' }, { type: 'GUIDED_MISHAP' });
    for (const reason of ['EXPIRED', 'STEPPED_OUT'] as const) {
      let s = structuredClone(prepared), before = structuredClone(s);
      s = reason === 'EXPIRED' ? act(s, { type: 'WAIT_WINDOW' }) : act(s, { type: 'WALK_TO', metres: 6 });
      expect(s.misfortuneKnight.life.cases['pending-parcel'].guidedEnd).toBe(reason); expect(s.misfortuneKnight.life.practice.pendingGuided).toBeNull();
      expect(s.misfortuneKnight.life.journal.at(-1)?.elapsedSeconds).toBe(reason === 'EXPIRED' ? 30 : 4);
      expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.cash).toBe(before.cash); expect(s.progression.mastery[GUIDED]).toBe(0);
      rejectMisfortuneKnight(s, { type: 'GUIDED_MISHAP' });
      if (reason === 'STEPPED_OUT') { rejectMisfortuneKnight(s, { type: 'CATCH_PARCEL' }); s = act(s, { type: 'WALK_TO', metres: 2 }); expect(s.misfortuneKnight.life.practice.pendingGuided).toBeNull(); }
      s = finish(act(s, { type: 'ORDINARY_CARRY' }), 'pending-parcel'); expect(s.progression.mastery[GUIDED]).toBe(0);
    }
    expect(prepared.misfortuneKnight.life.practice.pendingGuided).not.toBeNull();
  }, 120_000);

  it('arms a real unreleased weight and uses the same finite wood plate before one genuinely applied light impact', () => {
    let s = ordinaryFirst(lifeState([{ type: 'BOUNDED_NIGHT_GUARD', success: true }])); const before = structuredClone(s);
    s = enter(s, 'personal-dark-guard'); rejectMisfortuneKnight(s, { type: 'BOUNDED_NIGHT_GUARD' });
    s = act(s, { type: 'BORROW_PLATE' }); rejectMisfortuneKnight(s, { type: 'BOUNDED_NIGHT_GUARD' });
    s = act(s, { type: 'ARM_IMPACT' }, { type: 'BOUNDED_NIGHT_GUARD' });
    expect(s.misfortuneKnight.life.practice.plate).toMatchObject({ holder: 'PLAYER', integrity: 55, wear: 10, impacts: 0 });
    expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 3); expect(s.progression.mastery[GUARD]).toBe(0);
    expect(s.misfortuneKnight.life.practice.rig).toMatchObject({ weightState: 'ARMED', releases: 0, remainingForce: 0, absorbedForce: 0 });
    rejectMisfortuneKnight(s, { type: 'BOUNDED_NIGHT_GUARD' }); rejectMisfortuneKnight(s, { type: 'RETURN_PLATE' });
    s = act(s, { type: 'RELEASE_WEIGHT' }); expect(s.misfortuneKnight.life.cases['personal-dark-guard']).toMatchObject({ guardEnd: 'APPLIED', guardApplied: true, result: 'ABILITY' });
    expect(s.misfortuneKnight.life.practice.rig).toMatchObject({ weightState: 'STOPPED', releases: 1, remainingForce: 0, absorbedForce: 10 });
    expect(s.misfortuneKnight.life.journal.at(-1)).toMatchObject({ releasedForce: 10, absorbedForce: 10, plateWear: 0 }); rejectMisfortuneKnight(s, { type: 'RELEASE_WEIGHT' });
    s = finish(s, 'personal-dark-guard'); expect(s.progression.mastery[GUARD]).toBe(8); expect(s.health).toBe(before.health);
    expect(s.concealmentServant.life.erin).toEqual(before.concealmentServant.life.erin); expect(s.misfortuneKnight.life.practice.technician).toEqual(before.misfortuneKnight.life.practice.technician);
    expect(s.misfortuneKnight.life.practice.plate).toMatchObject({ integrity: 55, wear: 10, holder: 'OWNER', impacts: 1 });
    expect(misfortuneKnightLifeMasteryGains(s)).toEqual({ [GUIDED]: 0, [GUARD]: 8 });
  }, 120_000);

  it('retains guard failure costs and visible plate wear, then requires actual manual stopping of the released weight', () => {
    let s = armGuard(enter(ordinaryFirst(lifeState([{ type: 'BOUNDED_NIGHT_GUARD', success: false }])), 'personal-dark-guard'));
    const before = structuredClone(s); s = act(s, { type: 'BOUNDED_NIGHT_GUARD' }, { type: 'RELEASE_WEIGHT' });
    expect(s.misfortuneKnight.life.cases['personal-dark-guard']).toMatchObject({ guardEnd: 'FAILED', guardApplied: false, result: 'NONE' });
    expect(s.misfortuneKnight.life.practice.plate).toMatchObject({ integrity: 55, wear: 10, impacts: 1 }); expect(s.misfortuneKnight.life.practice.rig).toMatchObject({ weightState: 'RELEASED', remainingForce: 10, absorbedForce: 0 });
    expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 3);
    rejectMisfortuneKnight(s, { type: 'RETURN_PLATE' }); rejectMisfortuneKnight(s, { type: 'RETURN_TOOLS' }); rejectMisfortuneKnight(s, { type: 'ORDINARY_CARRY' }); rejectMisfortuneKnight(s, { type: 'WALK_TO', metres: 6 });
    s = act(s, { type: 'MANUAL_STOP' }); expect(s.misfortuneKnight.life.practice.rig).toMatchObject({ weightState: 'STOPPED', remainingForce: 0 });
    s = finish(s, 'personal-dark-guard'); expect(s.progression.mastery[GUARD]).toBe(0); expect(s.misfortuneKnight.life.practice.plate.integrity).toBe(55);
  }, 120_000);

  it('expires or revokes paid guard preparation without releasing the weight or silently repairing the original plate', () => {
    const prepared = act(armGuard(enter(ordinaryFirst(lifeState([{ type: 'BOUNDED_NIGHT_GUARD', success: true }])), 'personal-dark-guard')), { type: 'BOUNDED_NIGHT_GUARD' });
    for (const reason of ['EXPIRED', 'WITHDRAWN'] as const) {
      let s = structuredClone(prepared);
      s = reason === 'EXPIRED' ? act(s, { type: 'WAIT_WINDOW' }) : act(s, { type: 'REVOKE_CONSENT', permission: 'TECHNICIAN' });
      expect(s.misfortuneKnight.life.cases['personal-dark-guard'].guardEnd).toBe(reason); expect(s.misfortuneKnight.life.practice.pendingGuard).toBeNull();
      expect(s.misfortuneKnight.life.practice.rig).toMatchObject({ weightState: 'ARMED', releases: 0 }); expect(s.misfortuneKnight.life.practice.plate.integrity).toBe(55);
      expect(s.spirituality).toBe(prepared.spirituality); expect(s.mind).toBe(prepared.mind); rejectMisfortuneKnight(s, { type: 'BOUNDED_NIGHT_GUARD' });
      s = act(s, { type: 'STOP_RELEASE' }, { type: 'ORDINARY_CARRY' }); s = finish(s, 'personal-dark-guard'); expect(s.progression.mastery[GUARD]).toBe(0);
      expect(s.misfortuneKnight.life.practice.plate).toMatchObject({ integrity: 55, wear: 10, impacts: 0, holder: 'OWNER' });
    }
  }, 120_000);

  it('really obstructs the original door and withdraws after paid preparation, then stops, clears, returns and walks out', () => {
    let s = ordinarySecond(ordinaryFirst(lifeState([{ type: 'BOUNDED_NIGHT_GUARD', success: true }]))); const old = originalConcealmentServant();
    s = act(armGuard(enter(s, 'withdrawn-path')), { type: 'BOUNDED_NIGHT_GUARD' }); const before = structuredClone(s);
    s = act(s, { type: 'BLOCK_DOOR' }); expect(s.concealmentServant.life.room.doorBlocked).toBe(true); expect(s.misfortuneKnight.life.cases['withdrawn-path'].guardEnd).toBe('BLOCKED');
    s = act(s, { type: 'REVOKE_CONSENT', permission: 'OWNER' }); rejectMisfortuneKnight(s, { type: 'CONSENT', permission: 'OWNER' }); rejectMisfortuneKnight(s, { type: 'RELEASE_WEIGHT' }); rejectMisfortuneKnight(s, { type: 'ORDINARY_CARRY' });
    expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.cash).toBe(before.cash);
    s = act(s, { type: 'STOP_RELEASE' }, { type: 'CLEAR_DOOR' }, { type: 'ORDINARY_CARRY' }); s = finish(s, 'withdrawn-path'); s = act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery[GUARD]).toBe(0); expect(s.progression.mastery[GUIDED]).toBe(0);
    expect(s.misfortuneKnight.life.practice).toMatchObject({ playerLocation: 'YARD', playerOffsetMetres: 6, boxHolder: 'START', tray: { location: 'OWNER' }, plate: { holder: 'OWNER', integrity: 55, wear: 10 }, rig: { borrowed: false, weightState: 'OWNER', releases: 0 } });
    expect(s.concealmentServant.life.room).toEqual(old.concealmentServant.life.room); expect(s.concealmentServant.life.erin).toEqual(old.concealmentServant.life.erin);
    expect(s.concealmentServant.life.cases).toEqual(old.concealmentServant.life.cases); expect(s.concealmentServant.life.journal).toEqual(old.concealmentServant.life.journal); expect(s.concealmentServant.life.trace).toEqual(old.concealmentServant.life.trace);
    expect(lifeAdultsAbsent(s)).toBe(true); expect(misfortuneKnightLifeOriginalEvents(s).some(e => !e.before.room.doorBlocked && e.after.room.doorBlocked)).toBe(true);
  }, 120_000);

  it('finishes all three ordinary routes and reflection through the offered actions without spells or replacement objects', () => {
    let s = lifeState(); const before = structuredClone(s);
    for (let n = 0; n < 120 && !s.misfortuneKnight.life.reflected; n++) {
      const actions = misfortuneKnightLifeActions(s), invite = actions.find(a => a.enabled && a.command.type === 'INVITE' && a.command.method === 'ORDINARY');
      const next = invite ?? actions.find(a => a.enabled && a.preferredAction) ?? actions.find(a => a.enabled);
      if (!next) throw new Error('Ordinary projected route has no next step.');
      expect(['GUIDED_MISHAP', 'BOUNDED_NIGHT_GUARD', 'CATCH_PARCEL', 'RELEASE_WEIGHT']).not.toContain(next.command.type);
      s = act(s, next.command as MisfortuneKnightActivityCommand);
    }
    expect(s.misfortuneKnight.life.reflected).toBe(true); expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    expect(s.cash).toBe(before.cash - 60); expect(s.actionsRemaining).toBe(before.actionsRemaining - 10); expect(s.progression.mastery[GUIDED]).toBe(0); expect(s.progression.mastery[GUARD]).toBe(0);
    expect(s.misfortuneKnight.life.practice.plate).toMatchObject({ integrity: 65, wear: 0, impacts: 0 }); expect(s.spiritWarlock).toEqual(before.spiritWarlock);
    expect(s.concealmentServant.life.box.travelMetres).toBe(before.concealmentServant.life.box.travelMetres + 12); expect(lifeAdultsAbsent(s)).toBe(true);
  }, 120_000);

  it('honours owner refusal and keeps AP0 ordinary cleanup, actual movement and safe exits available', () => {
    let declined = act(lifeState(), { type: 'OBSERVE', caseId: 'pending-parcel' }, { type: 'INVITE', caseId: 'pending-parcel', method: 'ABILITY' }, { type: 'VISIT_ROOM' }, { type: 'DECLINE_CONSENT', permission: 'OWNER' });
    rejectMisfortuneKnight(declined, { type: 'CONSENT', permission: 'OWNER' }); rejectMisfortuneKnight(declined, { type: 'SETUP_TOOLS' });
    const cost = declined.cash; declined = act(declined, { type: 'ABORT' }); expect(declined.cash).toBe(cost); expect(declined.misfortuneKnight.life.practice.playerTravelMetres).toBe(80); expect(hasMisfortuneKnightLifeLock(declined)).toBe(false);
    let s = enter(lifeState([], 7), 'pending-parcel', 'ORDINARY'); expect(s.actionsRemaining).toBe(0); const week = s.week;
    rejectIntent(s, { type: 'ACTION', action: 'REST' }); expect(hasMisfortuneKnightLifeLock(s)).toBe(true); expect(hasConcealmentServantLock(s)).toBe(false); rejectIntent(s, { type: 'CONCEALMENT_SERVANT', command: { type: 'REFLECT' } });
    s = act(s, { type: 'ORDINARY_CARRY' }, { type: 'RETURN_BOX' }, { type: 'RETURN_TOOLS' }); expect(s.week).toBe(week); expect(s.actionsRemaining).toBe(0);
    s = act(s, { type: 'RETURN_HOME' }); expect(hasMisfortuneKnightLifeLock(s)).toBe(false); expect(s.misfortuneKnight.life.cases['pending-parcel'].status).toBe('EXAMINED');
    expect(s.misfortuneKnight.life.practice.playerTravelMetres).toBeGreaterThan(80); expect(s.concealmentServant.life.box.location).toBe('START');
  }, 120_000);

  it('keeps interrupted failure history and costs, requiring a paid later-week ordinary resumption', () => {
    let s = act(enter(lifeState([{ type: 'GUIDED_MISHAP', success: false }]), 'pending-parcel'), { type: 'ARM_PARCEL' }, { type: 'GUIDED_MISHAP' }, { type: 'ABORT' });
    const previous = structuredClone(s.misfortuneKnight.life.journal); expect(s.misfortuneKnight.life.cases['pending-parcel'].status).toBe('PAUSED'); expect(hasMisfortuneKnightLifeLock(s)).toBe(false);
    rejectMisfortuneKnight(s, { type: 'INVITE', caseId: 'pending-parcel', method: 'ORDINARY' }); s = nextActualWeek(s); const cash = s.cash;
    rejectMisfortuneKnight(s, { type: 'INVITE', caseId: 'pending-parcel', method: 'ABILITY' });
    s = act(s, { type: 'INVITE', caseId: 'pending-parcel', method: 'ORDINARY' }, { type: 'VISIT_ROOM' }, { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'TECHNICIAN' }, { type: 'DECLINE_CONSENT', permission: 'SELF_POWER' }, { type: 'SETUP_TOOLS' }, { type: 'BORROW_BOX' });
    expect(s.cash).toBe(cash - 20); expect(s.misfortuneKnight.life.journal.slice(0, previous.length)).toEqual(previous); rejectMisfortuneKnight(s, { type: 'GUIDED_MISHAP' });
    s = finish(act(s, { type: 'ORDINARY_CARRY' }), 'pending-parcel'); expect(projectMisfortuneKnightLife(s).cases[0]!.attempts).toHaveLength(2); expect(s.progression.mastery[GUIDED]).toBe(0);
  }, 120_000);

  it('rejects forged costs, clock, movement, random checks, plate restoration, source clones and old-leaf changes', () => {
    const base = act(armGuard(enter(ordinaryFirst(lifeState([{ type: 'BOUNDED_NIGHT_GUARD', success: true }])), 'personal-dark-guard')), { type: 'BOUNDED_NIGHT_GUARD' });
    const corruptions: ((s: SliceState) => void)[] = [
      s => { s.misfortuneKnight.life.practice.plate.integrity = 65; },
      s => { s.misfortuneKnight.life.practice.plate.wear = 0; },
      s => { s.misfortuneKnight.life.practice.playerTravelMetres++; },
      s => { s.concealmentServant.life.box.travelMetres++; },
      s => { s.concealmentServant.life.clockSeconds++; },
      s => { s.misfortuneKnight.life.journal.at(-1)!.after.spirituality++; },
      s => { s.misfortuneKnight.life.journal.at(-1)!.plateWear = 0; },
      s => { s.misfortuneKnight.life.journal.at(-1)!.randomAfter!++; },
      s => { s.misfortuneKnight.life.journal.at(-1)!.check = { ...s.misfortuneKnight.life.journal.at(-1)!.check!, roll: 100 }; },
      s => { s.misfortuneKnight.life.sourceOriginals!.box.travelMetres++; },
      s => { s.misfortuneKnight.life.journal.at(-1)!.originalsAfter.erin.travelMetres++; },
      s => { s.misfortuneKnight.life.journal.at(-1)!.companion.deployments++; },
      s => { s.spiritWarlock.companion.deployments++; },
      s => { s.concealmentServant.life.trace.searches++; },
    ];
    for (const corrupt of corruptions) { const changed = structuredClone(base); corrupt(changed); expect(validateMisfortuneKnightLife(changed)).toBe(false); expect(() => assertValidSliceState(changed)).toThrow(); }
    expect(validateMisfortuneKnightLife(base)).toBe(true); expect(base.misfortuneKnight.life.practice.plate.integrity).toBe(55);
  }, 120_000);

  it('accepts only exact commands and leaves originals untouched when invalid work is rejected', () => {
    const s = lifeState();
    for (const command of [{ type: 'GUIDED_MISHAP', roll: 1 }, { type: 'WALK_TO', metres: 3 }, { type: 'CONSENT', permission: 'SPIRIT' }, { type: 'INVITE', caseId: 'pending-parcel', method: 'FREE' }, { type: 'REPAIR_PLATE' }, { type: 'SUMMON_TRACE' }]) {
      expect(validateMisfortuneKnightActivityCommand(command)).toBe(false); rejectMisfortuneKnight(s, command);
    }
    expect(validateMisfortuneKnightActivityCommand({ type: 'WALK_TO', metres: 4 })).toBe(true);
    rejectMisfortuneKnight(s, { type: 'REPORT', caseId: 'pending-parcel' }); rejectMisfortuneKnight(s, { type: 'REFLECT' });
    expect(s.concealmentServant.life).toEqual(originalConcealmentServant().concealmentServant.life);
  }, 120_000);
});
