import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { BEAUTY_GODDESS_PREPARATION_IDS } from '../../src/domain/beauty-goddess/types.js';
import {
  beautyGoddessExpectedPartner, beautyGoddessLifeActions, beautyGoddessLifeAdultsAbsent, beautyGoddessLifeOriginalEvents,
  createBeautyGoddessLifeState, hasBeautyGoddessLifeLock, projectBeautyGoddessLife, validateBeautyGoddessActivityCommand, validateBeautyGoddessLife,
  type BeautyGoddessActivityCommand, type BeautyGoddessCaseId,
} from '../../src/domain/beauty-goddess/life.js';
import { acknowledge, bg, directedInitial2, dose, moonLegacyKeys, originalLifeGiver, rejectBeautyGoddess, step } from './beauty-goddess-directed-helper.js';

const POISE = 'moon.s1.self-poise', MOONFORM = 'moon.s1.bounded-moonform';
const good = (tier: string) => tier === 'SUCCESS' || tier === 'GREAT_SUCCESS';
type CheckInput = { type: 'SELF_POISE' | 'PRECISION_PLACE' | 'BOUNDED_MOONFORM' | 'GUEST_CARRY'; success: boolean; helped?: boolean };
const cache = new Map<string, SliceState>();
/** Explicit directed unit inputs are selected before acquisition, never in the
 * middle of an attempt. Historical seed/rolls and the untouched actual572 source
 * stay intact. AP20 is declared here only to bound ordinary-week test duration. */
function lifeState(checks: CheckInput[] = []): SliceState {
  const key = JSON.stringify(checks), cached = cache.get(key); if (cached) return structuredClone(cached);
  let s = directedInitial2(), selected: number | null = null; s.actionsRemaining = s.weeklyBudget = 20;
  for (let cursor = s.random.cursor; cursor < s.random.cursor + 8192; cursor++) {
    const random = new DeterministicActionRandomStream(s.random.seed, cursor);
    const promotion = resolveNormalCheck({ ability: 'will', baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [], roll: random.nextInt(1, 100) });
    if (promotion.tier !== 'SUCCESS') continue;
    let match = true;
    for (const input of checks) {
      const ability = input.type === 'SELF_POISE' ? 'will' : 'perception';
      const modifiers = input.helped ? [{ source: input.type === 'PRECISION_PLACE' ? '本人一次普通精细动作的辉映调息' : '原灯下这一次真实搬运的月辉定形', value: 10 }] : [];
      const result = resolveNormalCheck({ ability, baseAbility: input.type === 'GUEST_CARRY' ? 12 : s.character.coreStats[ability] + 1, difficulty: 18, modifiers, roll: random.nextInt(1, 100) });
      if (good(result.tier) !== input.success) { match = false; break; }
    }
    if (match) { selected = cursor; break; }
  }
  if (selected === null) throw new Error('No bounded declared life inputs found.');
  s.random.cursor = selected; assertValidSliceState(s); s = bg(s, { type: 'LEARN_GUIDANCE' });
  for (const taskId of BEAUTY_GODDESS_PREPARATION_IDS) s = bg(s, { type: 'PREPARE_TASK', taskId });
  s = bg(s, acknowledge); s = bg(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = bg(s, { type: 'PREPARE_PROMOTION' }); s = bg(s, dose);
  expect(s.progression.sequence).toBe(1); expect(validateBeautyGoddessLife(s)).toBe(true); cache.set(key, structuredClone(s)); return s;
}
function act(s: SliceState, ...commands: BeautyGoddessActivityCommand[]): SliceState {
  for (const command of commands) { s = bg(s, command); expect(validateBeautyGoddessLife(s), JSON.stringify(command)).toBe(true); expect(beautyGoddessExpectedPartner(s)).toEqual(s.summoningMaster.life.partner); }
  return s;
}
function enter(s: SliceState, caseId: BeautyGoddessCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  return act(s, { type: 'OBSERVE', caseId }, { type: 'INVITE', caseId, method }, { type: 'VISIT_HOME' }, { type: 'CONSENT', permission: 'GUEST' }, { type: 'CONSENT', permission: 'CARETAKER' },
    { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'SELF_POWER' }, { type: 'BORROW_WEIGHT' });
}
function lamp(s: SliceState, pieceId: 'BG1-MOON-PIECE-1' | 'BG1-MOON-PIECE-2' = 'BG1-MOON-PIECE-1'): SliceState {
  s = act(s, { type: 'BORROW_LAMP' });
  if (s.beautyGoddess.life.practice.lamp.oilPurchasedWeek === null) s = act(s, { type: 'BUY_OIL' });
  return act(s, { type: 'BUY_PIECE', pieceId }, { type: 'LIGHT_LAMP' }, { type: 'ARM_CROSSING' });
}
function finish(s: SliceState, caseId: BeautyGoddessCaseId): SliceState {
  if (s.beautyGoddess.life.practice.lamp.lit) s = act(s, { type: 'EXTINGUISH_LAMP' });
  if (s.beautyGoddess.life.practice.weight.holder !== 'BG1-DARIA42') s = act(s, { type: 'RETURN_WEIGHT' });
  if (s.beautyGoddess.life.practice.guestOffsetMetres === 2) s = act(s, { type: 'RETURN_GUEST' });
  if (s.beautyGoddess.life.practice.pieces.some(p => p.holder === 'PLAYER')) s = act(s, { type: 'RETURN_PIECES' });
  if (s.beautyGoddess.life.practice.lamp.holder === 'PLAYER') s = act(s, { type: 'RETURN_LAMP' });
  return act(s, { type: 'RETURN_HOME' }, { type: 'REPORT', caseId });
}
const ordinaryFirst = (s: SliceState) => finish(act(enter(s, 'steady-hands', 'ORDINARY'), { type: 'ORDINARY_PLACE' }), 'steady-hands');
function nextActualWeek(s: SliceState): SliceState {
  const week = s.week;
  for (let n = 0; n < 64 && s.week === week; n++) {
    if (s.activeEvent) {
      if (s.activeEvent.id !== 'LIFE-CARE-01') throw new Error(`Unexpected ordinary week event ${s.activeEvent.id}`);
      s = step(s, { type: 'EVENT_CHOICE', eventInstanceId: s.activeEvent.instanceId, choiceId: 'PAY' });
    } else s = step(s, { type: 'ACTION', action: 'REST' });
  }
  expect(s.week).toBeGreaterThan(week); return s;
}

describe('Beauty Goddess finite same-body glass-room life', () => {
  it('preserves the actual572 source, same adult guest and unique chime, old rests and all old materials', () => {
    const original = originalLifeGiver(), s = lifeState(), l = s.beautyGoddess.life;
    expect(l.sourcePartner).toEqual(original.summoningMaster.life.partner); expect(l.sourcePartner).toMatchObject({ health: 100, mind: 92, stamina: 88, ordinaryDistanceM: 334, gateCrossings: 5, location: 'HOME' });
    for (const key of moonLegacyKeys) expect(s[key]).toEqual(original[key]);
    expect(l.practice.caretaker).toEqual({ id: 'BG1-DARIA42', name: '达莉娅', age: 42, alive: true, willing: true, location: 'HOME' });
    expect(l.practice.weight).toMatchObject({ id: 'BG1-GLASS-WEIGHT', owner: 'BG1-DARIA42', holder: 'BG1-DARIA42', location: 'OWNER' });
    expect(l.practice.lamp).toMatchObject({ id: 'BG1-LAMP', owner: 'BG1-DARIA42', fuelSeconds: 0, oilPurchasedWeek: null, lit: false });
    expect(l.practice.pieces).toHaveLength(3); expect(new Set(l.practice.pieces.map(p => p.id)).size).toBe(3);
    expect(projectBeautyGoddessLife(s).currentConsents.every(c => !c.consented)).toBe(true); expect(beautyGoddessLifeAdultsAbsent(s)).toBe(true);
    expect(createBeautyGoddessLifeState().sourcePartner).toBeNull(); expect(s.progression.mastery[POISE]).toBe(0); expect(s.progression.mastery[MOONFORM]).toBe(0);
  }, 120_000);

  it('requires distinct fresh permissions and real60m access; self-poise only boosts one later real operation', () => {
    let s = lifeState([{ type: 'SELF_POISE', success: true }, { type: 'PRECISION_PLACE', success: true, helped: true }]); const before = structuredClone(s);
    rejectBeautyGoddess(s, { type: 'SELF_POISE' }); s = act(s, { type: 'OBSERVE', caseId: 'steady-hands' }, { type: 'INVITE', caseId: 'steady-hands', method: 'ABILITY' });
    rejectBeautyGoddess(s, { type: 'CONSENT', permission: 'GUEST' }); rejectBeautyGoddess(s, { type: 'BORROW_WEIGHT' });
    s = act(s, { type: 'VISIT_HOME' }); expect(s.beautyGoddess.life.practice.playerTravelMetres).toBe(60); expect(s.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    s = act(s, { type: 'CONSENT', permission: 'GUEST' }, { type: 'CONSENT', permission: 'CARETAKER' }); rejectBeautyGoddess(s, { type: 'BORROW_WEIGHT' });
    s = act(s, { type: 'CONSENT', permission: 'SELF_POWER' }, { type: 'BORROW_WEIGHT' }, { type: 'SELF_POISE' });
    expect(s.spirituality).toBe(before.spirituality - 6); expect(s.mind).toBe(before.mind - 2); expect(s.cash).toBe(before.cash - 20); expect(s.progression.mastery[POISE]).toBe(0);
    expect(s.beautyGoddess.life.practice.pendingPoise).toMatchObject({ bonus: 10 }); expect(s.beautyGoddess.life.cases['steady-hands'].result).toBe('NONE'); rejectBeautyGoddess(s, { type: 'SELF_POISE' });
    s = act(s, { type: 'PRECISION_PLACE' }); expect(s.beautyGoddess.life.cases['steady-hands']).toMatchObject({ poiseApplied: true, poiseEnd: 'APPLIED', result: 'ABILITY' });
    expect(s.beautyGoddess.life.practice.pendingPoise).toBeNull(); expect(s.lastCheck?.modifiers).toEqual([{ source: '本人一次普通精细动作的辉映调息', value: 10 }]); rejectBeautyGoddess(s, { type: 'PRECISION_PLACE' }); rejectBeautyGoddess(s, { type: 'RETURN_HOME' });
    s = finish(s, 'steady-hands'); expect(s.progression.mastery[POISE]).toBe(8); expect(s.progression.acting).toBe(25); expect(s.beautyGoddess.life.practice.playerTravelMetres).toBe(124);
    expect(s.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner); expect(hasBeautyGoddessLifeLock(s)).toBe(false);
  }, 120_000);

  it('retains failed casts and independent ordinary failures without injury, recast, free reward or lost physical object', () => {
    let s = lifeState([{ type: 'SELF_POISE', success: false }, { type: 'PRECISION_PLACE', success: false }]); const originalHealth = s.health;
    s = act(enter(s, 'steady-hands'), { type: 'SELF_POISE' }, { type: 'PRECISION_PLACE' });
    expect(s.beautyGoddess.life.cases['steady-hands']).toMatchObject({ poiseEnd: 'FAILED', result: 'NONE', poiseApplied: false });
    expect(s.beautyGoddess.life.practice.weight).toMatchObject({ holder: 'PAD', location: 'PAD' }); expect(s.health).toBe(originalHealth);
    rejectBeautyGoddess(s, { type: 'SELF_POISE' }); rejectBeautyGoddess(s, { type: 'PRECISION_PLACE' });
    s = finish(act(s, { type: 'ORDINARY_PLACE' }), 'steady-hands'); expect(s.progression.mastery[POISE]).toBe(0); expect(s.beautyGoddess.life.cases['steady-hands'].result).toBe('ORDINARY');
    expect(projectBeautyGoddessLife(s).cases[0]!.attempts[0]!.receipts.filter(r => r.outcome && !good(r.outcome))).toHaveLength(2);
  }, 120_000);

  it('expires a successful unused30s self window without a reward and preserves exact paid costs', () => {
    let s = lifeState([{ type: 'SELF_POISE', success: true }]); s = act(enter(s, 'steady-hands'), { type: 'SELF_POISE' }); const before = structuredClone(s);
    s = act(s, { type: 'WAIT_WINDOW' }); expect(s.beautyGoddess.life.journal.at(-1)?.elapsedSeconds).toBe(30); expect(s.beautyGoddess.life.cases['steady-hands'].poiseEnd).toBe('EXPIRED');
    expect(s.cash).toBe(before.cash); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.progression.mastery[POISE]).toBe(0); rejectBeautyGoddess(s, { type: 'SELF_POISE' });
    s = finish(act(s, { type: 'ORDINARY_PLACE' }), 'steady-hands'); expect(s.progression.mastery[POISE]).toBe(0);
  }, 120_000);

  it('uses the actual lamp/oil/paid piece and the same guest body for one applied two-metre crossing and return', () => {
    let s = lifeState([{ type: 'BOUNDED_MOONFORM', success: true }, { type: 'GUEST_CARRY', success: true, helped: true }]); s = ordinaryFirst(s); const before = structuredClone(s);
    s = enter(s, 'lit-crossing'); rejectBeautyGoddess(s, { type: 'BOUNDED_MOONFORM' }); s = lamp(s); rejectBeautyGoddess(s, { type: 'BUY_OIL' }); rejectBeautyGoddess(s, { type: 'BUY_PIECE', pieceId: 'BG1-MOON-PIECE-1' });
    s = act(s, { type: 'BOUNDED_MOONFORM' }); expect(s.beautyGoddess.life.practice.pieces[0]).toMatchObject({ status: 'SPENT', holder: 'PLAYER', price: 70 });
    expect(s.progression.mastery[MOONFORM]).toBe(0); expect(s.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner);
    s = act(s, { type: 'GUEST_CARRY' }); expect(s.summoningMaster.life.partner).toMatchObject({ stamina: 82, ordinaryDistanceM: 336, location: 'HOME', gateCrossings: 5 });
    expect(s.beautyGoddess.life.practice.guestOffsetMetres).toBe(2); expect(s.beautyGoddess.life.cases['lit-crossing']).toMatchObject({ moonformApplied: true, moonformEnd: 'APPLIED', result: 'ABILITY' });
    rejectBeautyGoddess(s, { type: 'GUEST_CARRY' }); rejectBeautyGoddess(s, { type: 'BOUNDED_MOONFORM' });
    s = finish(s, 'lit-crossing'); expect(s.summoningMaster.life.partner).toMatchObject({ stamina: 79, ordinaryDistanceM: 338, location: 'HOME', health: 100, mind: 92 });
    expect(s.summoningMaster.life.partner.chime).toEqual(before.summoningMaster.life.partner.chime); expect(s.summoningMaster.life.partner.restHistory).toEqual(before.summoningMaster.life.partner.restHistory);
    expect(s.cash).toBe(before.cash - 120); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 3); expect(s.progression.mastery[MOONFORM]).toBe(8);
    expect(s.beautyGoddess.life.practice.pieces[0]).toMatchObject({ status: 'SPENT', holder: 'RETURN_TRAY' }); expect(s.beautyGoddess.life.practice.lamp.fuelSeconds + s.beautyGoddess.life.practice.lamp.fuelBurnedSeconds).toBe(180);
    expect(beautyGoddessLifeOriginalEvents(s).filter(e => e.before.stamina !== e.after.stamina)).toHaveLength(2);
  }, 120_000);

  it('ends the same paid moon window on direct withdrawal or real30s expiry, without retroactive refunds or an application award', () => {
    let prepared = lifeState([{ type: 'BOUNDED_MOONFORM', success: true }]); prepared = lamp(enter(ordinaryFirst(prepared), 'lit-crossing')); prepared = act(prepared, { type: 'BOUNDED_MOONFORM' });
    const initialFuel = prepared.beautyGoddess.life.practice.lamp.fuelSeconds;
    for (const reason of ['WITHDRAWN', 'EXPIRED'] as const) {
      let s = structuredClone(prepared);
      s = reason === 'WITHDRAWN' ? act(s, { type: 'REVOKE_CONSENT', permission: 'CARETAKER' }) : act(s, { type: 'WAIT_WINDOW' });
      expect(s.beautyGoddess.life.cases['lit-crossing'].moonformEnd).toBe(reason); expect(s.beautyGoddess.life.practice.pendingMoonform).toBeNull();
      expect(s.spirituality).toBe(prepared.spirituality); expect(s.mind).toBe(prepared.mind); expect(s.cash).toBe(prepared.cash);
      expect(s.beautyGoddess.life.practice.lamp.fuelSeconds).toBe(initialFuel - (reason === 'EXPIRED' ? 30 : 1));
      expect(s.beautyGoddess.life.practice.pieces[0]).toMatchObject({ status: 'SPENT', holder: 'PLAYER' }); rejectBeautyGoddess(s, { type: 'BOUNDED_MOONFORM' });
      s = finish(act(s, { type: 'ORDINARY_PLACE' }), 'lit-crossing'); expect(s.progression.mastery[MOONFORM]).toBe(0);
      expect(s.summoningMaster.life.partner).toEqual(prepared.summoningMaster.life.partner);
    }
  }, 120_000);

  it('a failed independent crossing consumes the paid window and actual guest stamina, then permits ordinary pickup', () => {
    let s = lifeState([{ type: 'BOUNDED_MOONFORM', success: true }, { type: 'GUEST_CARRY', success: false, helped: true }]); s = lamp(enter(ordinaryFirst(s), 'lit-crossing'));
    s = act(s, { type: 'BOUNDED_MOONFORM' }, { type: 'GUEST_CARRY' }); expect(s.beautyGoddess.life.cases['lit-crossing']).toMatchObject({ moonformEnd: 'OPERATION_FAILED', result: 'NONE', moonformApplied: false });
    expect(s.beautyGoddess.life.practice.weight.holder).toBe('PAD'); expect(s.summoningMaster.life.partner.stamina).toBe(82);
    s = finish(act(s, { type: 'ORDINARY_PLACE' }), 'lit-crossing'); expect(s.summoningMaster.life.partner.stamina).toBe(79); expect(s.progression.mastery[MOONFORM]).toBe(0);
  }, 120_000);

  it('cancels future moonform on actual obscuration and withdrawal while preserving spent material, fuel and ordinary exits', () => {
    let s = lifeState([{ type: 'BOUNDED_MOONFORM', success: true }]); s = ordinaryFirst(s); s = finish(act(enter(s, 'lit-crossing', 'ORDINARY'), { type: 'ORDINARY_PLACE' }), 'lit-crossing');
    s = lamp(enter(s, 'withdrawn-moonlight')); s = act(s, { type: 'BOUNDED_MOONFORM' }); const before = structuredClone(s);
    s = act(s, { type: 'LOWER_SHUTTER' }); expect(s.beautyGoddess.life.cases['withdrawn-moonlight'].moonformEnd).toBe('OBSCURED'); expect(s.beautyGoddess.life.practice.pendingMoonform).toBeNull();
    s = act(s, { type: 'REVOKE_CONSENT', permission: 'GUEST' }); rejectBeautyGoddess(s, { type: 'CONSENT', permission: 'GUEST' }); rejectBeautyGoddess(s, { type: 'GUEST_CARRY' }); rejectBeautyGoddess(s, { type: 'BOUNDED_MOONFORM' }); rejectBeautyGoddess(s, { type: 'ORDINARY_PLACE' });
    expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.cash).toBe(before.cash); expect(s.beautyGoddess.life.practice.lamp.fuelSeconds).toBe(before.beautyGoddess.life.practice.lamp.fuelSeconds - 3);
    s = act(s, { type: 'RAISE_SHUTTER' }, { type: 'ORDINARY_PLACE' }); s = finish(s, 'withdrawn-moonlight'); s = act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery[MOONFORM]).toBe(0); expect(s.summoningMaster.life.partner).toEqual(before.summoningMaster.life.partner); expect(beautyGoddessLifeAdultsAbsent(s)).toBe(true);
    expect(s.beautyGoddess.life.practice).toMatchObject({ playerLocation: 'YARD', guestOffsetMetres: 0, ownerOffsetMetres: 0, playerTravelMetres: 372, weight: { holder: 'BG1-DARIA42' }, lamp: { holder: 'BG1-DARIA42', lit: false }, shutter: { position: 'RAISED' } });
  }, 120_000);

  it('retains an interrupted original attempt, permits only paid later-week ordinary resumption, and caps reinvitations', () => {
    let s = lifeState([{ type: 'SELF_POISE', success: false }]); s = act(enter(s, 'steady-hands'), { type: 'SELF_POISE' }, { type: 'ABORT' });
    const previous = structuredClone(s.beautyGoddess.life.journal), originalSpirituality = s.spirituality;
    expect(s.beautyGoddess.life.cases['steady-hands'].status).toBe('PAUSED'); expect(hasBeautyGoddessLifeLock(s)).toBe(false); rejectBeautyGoddess(s, { type: 'INVITE', caseId: 'steady-hands', method: 'ORDINARY' });
    s = nextActualWeek(s); rejectBeautyGoddess(s, { type: 'INVITE', caseId: 'steady-hands', method: 'ABILITY' }); const cash = s.cash;
    s = act(s, { type: 'INVITE', caseId: 'steady-hands', method: 'ORDINARY' }, { type: 'VISIT_HOME' }, { type: 'CONSENT', permission: 'GUEST' }, { type: 'CONSENT', permission: 'CARETAKER' }, { type: 'DECLINE_CONSENT', permission: 'SELF_POWER' }, { type: 'BORROW_WEIGHT' });
    expect(s.cash).toBe(cash - 20); expect(s.beautyGoddess.life.journal.slice(0, previous.length)).toEqual(previous); rejectBeautyGoddess(s, { type: 'SELF_POISE' });
    s = finish(act(s, { type: 'ORDINARY_PLACE' }), 'steady-hands'); expect(projectBeautyGoddessLife(s).cases[0]!.attempts).toHaveLength(2); expect(s.progression.mastery[POISE]).toBe(0); expect(originalSpirituality).toBeLessThan(120);
    // A separately declared unit case tests all three allowed paid re-invitations.
    let limited = act(enter(lifeState(), 'steady-hands', 'ORDINARY'), { type: 'ABORT' });
    for (let n = 0; n < 3; n++) { limited = nextActualWeek(limited); limited = act(limited, { type: 'INVITE', caseId: 'steady-hands', method: 'ORDINARY' }, { type: 'ABORT' }); }
    limited = nextActualWeek(limited); rejectBeautyGoddess(limited, { type: 'INVITE', caseId: 'steady-hands', method: 'ORDINARY' }); expect(limited.beautyGoddess.life.cases['steady-hands'].invitationWeeks).toHaveLength(4);
  }, 180_000);

  it('uses the existing paid rest formula on the original body, rejects same-week reuse, and permits a later real-week rest', () => {
    let s = ordinaryFirst(lifeState()); rejectBeautyGoddess(s, { type: 'REST_GUEST' }); s = act(s, { type: 'OBSERVE', caseId: 'lit-crossing' }); s = nextActualWeek(s); const before = structuredClone(s), oldRests = structuredClone(s.summoningMaster.life.partner.restHistory);
    s = act(s, { type: 'REST_GUEST' }); expect(s.cash).toBe(before.cash - 30); expect(s.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(s.summoningMaster.life.partner).toMatchObject({ stamina: 100, mind: 100, health: 100, location: 'HOME', ordinaryDistanceM: 334 }); expect(s.summoningMaster.life.partner.restHistory.slice(0, -1)).toEqual(oldRests);
    expect(s.summoningMaster.life.partner.restHistory.at(-1)).toEqual({ week: s.week, paidPennies: 30, staminaBefore: 88, staminaAfter: 100, mindBefore: 92, mindAfter: 100, healthUnchanged: 100 });
    expect(s.beautyGoddess.life.journal.at(-1)).toMatchObject({ playerWalkedMetres: 120, elapsedSeconds: 1920, guestStaminaSpent: 0 }); rejectBeautyGoddess(s, { type: 'REST_GUEST' });
    s = act(s, { type: 'INVITE', caseId: 'lit-crossing', method: 'ORDINARY' }, { type: 'VISIT_HOME' }, { type: 'CONSENT', permission: 'GUEST' }, { type: 'CONSENT', permission: 'CARETAKER' }, { type: 'DECLINE_CONSENT', permission: 'SELF_POWER' }, { type: 'BORROW_WEIGHT' }, { type: 'ARM_CROSSING' }, { type: 'GUEST_CARRY' });
    if (s.beautyGoddess.life.cases['lit-crossing'].result === 'NONE') s = act(s, { type: 'ORDINARY_PLACE' });
    s = act(s, { type: 'RETURN_WEIGHT' }, { type: 'RETURN_GUEST' }, { type: 'RETURN_HOME' }); expect(s.summoningMaster.life.partner.stamina).toBe(91); expect(s.week).toBe(s.beautyGoddess.life.practice.restWeek); rejectBeautyGoddess(s, { type: 'REST_GUEST' });
    s = nextActualWeek(s); const cash = s.cash; s = act(s, { type: 'REST_GUEST' }); expect(s.cash).toBe(cash - 30); expect(s.summoningMaster.life.partner.stamina).toBe(100); expect(s.summoningMaster.life.partner.restHistory).toHaveLength(oldRests.length + 2);
  }, 180_000);

  it('rejects invented pools, receipts, extra properties, material refunds, wrong seed and altered frozen anchors', () => {
    let s = lifeState([{ type: 'SELF_POISE', success: true }, { type: 'PRECISION_PLACE', success: true, helped: true }]); s = finish(act(enter(s, 'steady-hands'), { type: 'SELF_POISE' }, { type: 'PRECISION_PLACE' }), 'steady-hands');
    const mutations: ((copy: SliceState) => void)[] = [
      x => { x.summoningMaster.life.partner.stamina++; }, x => { x.summoningMaster.life.partner.ordinaryDistanceM++; }, x => { x.summoningMaster.life.partner.gateCrossings++; },
      x => { x.beautyGoddess.life.sourcePartner!.stamina++; x.summoningMaster.life.partner.stamina++; },
      x => { x.beautyGoddess.life.practice.playerTravelMetres--; }, x => { x.beautyGoddess.life.practice.weight.holder = 'PLAYER'; },
      x => { x.beautyGoddess.life.practice.lamp.fuelSeconds = 180; }, x => { x.beautyGoddess.life.journal[0]!.after.cash++; },
      x => { x.beautyGoddess.life.journal.find(r => r.command.type === 'SELF_POISE')!.outcome = 'FAILURE'; }, x => { x.random.seed += ':replacement'; },
      x => { x.beautyGoddess.life.journal.find(r => r.command.type === 'PRECISION_PLACE')!.guestAfter.stamina = 100; },
    ];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateBeautyGoddessLife(copy)).toBe(false); }
    expect(validateBeautyGoddessActivityCommand({ type: 'REST_GUEST', restored: 100 })).toBe(false); expect(validateBeautyGoddessActivityCommand({ type: 'BUY_PIECE', pieceId: 'LG2-BEAD-1' })).toBe(false);
    expect(validateBeautyGoddessActivityCommand({ type: 'CONSENT', permission: 'ROMANCE' })).toBe(false); expect(beautyGoddessLifeActions(s).some(a => a.enabled && a.preferredAction)).toBe(true);
  }, 120_000);
});
