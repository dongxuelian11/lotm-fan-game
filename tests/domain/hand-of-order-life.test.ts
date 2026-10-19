import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import {
  HAND_OF_ORDER_CASE_IDS, blockHandOfOrderLife, getHandOfOrderCurrentSite, handOfOrderLifeClosed,
  handOfOrderLifeMasteryGains, hasHandOfOrderLifeLock, projectHandOfOrderLife,
  replayHandOfOrderLifeRoot, replayHandOfOrderLifeGuardPlate, validateHandOfOrderActivityCommand,
  validateHandOfOrderLifeState, type HandOfOrderActivityCommand, type HandOfOrderCaseId,
} from '../../src/domain/hand-of-order/life.js';
import { hoo, oldJusticiarRoots, originalBalancer, promoted, promotedForLife, rejectHandOfOrder, rejectIntent, type DirectedLifeKind } from './hand-of-order-directed-helper.js';

const DIVISION = 'justiciar.s1.battlefield-division', AFTERMATH = 'justiciar.s1.aftermath-control';
const attempt = (s: SliceState, id: HandOfOrderCaseId) => s.handOfOrder.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, c: HandOfOrderActivityCommand): SliceState {
  const next = hoo(s, c); expect(validateHandOfOrderLifeState(next), JSON.stringify(c)).toBe(true); return next;
}
function rented(kind: DirectedLifeKind = 'DIVISION'): SliceState {
  return act(act(promotedForLife(kind), { type: 'EXIT_ORIGINAL' }), { type: 'RENT_ANNEX' });
}
function begin(s: SliceState, caseId: HandOfOrderCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', consent: 'CONSENT_MIRA' | 'DECLINE_PERMISSION' = 'CONSENT_MIRA'): SliceState {
  for (const c of [{ type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method }, { type: 'WALK', caseId, to: 'ANNEX_A' }, { type: 'CHECK_ORIGINALS', caseId }, { type: consent, caseId }, { type: 'SETUP_OBJECTS', caseId }] as HandOfOrderActivityCommand[]) s = act(s, c);
  return s;
}
function finish(s: SliceState, caseId: HandOfOrderCaseId, report = true): SliceState {
  if (caseId === 'withdrawn-boundary' && attempt(s, caseId).consent === 'GRANTED') s = act(s, { type: 'WITHDRAW_PERMISSION', caseId });
  if (caseId === 'measured-aftermath') {
    if (!attempt(s, caseId).impact) s = act(s, { type: 'ORDINARY_BRACE', caseId });
  } else {
    if (!attempt(s, caseId).handoverCompleted) s = act(s, { type: 'COMPLETE_HANDOVER', caseId });
    s = act(s, { type: 'WALK', caseId, to: 'ANNEX_B' }); s = act(s, { type: 'TAKE_OBJECT', caseId }); s = act(s, { type: 'WALK', caseId, to: 'ANNEX_A' });
  }
  for (const c of [{ type: 'RETURN_OBJECTS', caseId }, { type: 'WALK', caseId, to: 'OUTSIDE' }, { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }] as HandOfOrderActivityCommand[]) s = act(s, c);
  return report ? act(s, { type: 'REPORT', caseId }) : s;
}
const ordinary = (s: SliceState, id: HandOfOrderCaseId) => finish(begin(s, id, 'ORDINARY'), id);
function buffer(kind: DirectedLifeKind = 'AFTERMATH'): SliceState {
  let s = ordinary(rented(kind), 'paired-handover'); s = begin(s, 'measured-aftermath'); return act(s, { type: 'AFTERMATH_CONTROL', caseId: 'measured-aftermath' });
}

// The shared helper explicitly migrates the complete raw 594-command fixture
// to CURRENT format. Directed RNG selection happens before new-stage journals;
// clinic payment and REST are real public actions, never patched body values.
describe('Hand of Order actual source, paid neighboring space and finite cooperation', () => {
  it('rejects extra command fields, old rooms, remote recipients and invented refill commands', () => {
    for (const command of [{ type: 'RENT_ANNEX', free: true }, { type: 'EXIT_ORIGINAL', metres: 0 }, { type: 'WALK', caseId: 'paired-handover', to: 'B' },
      { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover', target: 'UNKNOWN' }, { type: 'AFTERMATH_CONTROL', caseId: 'measured-aftermath', target: 'MIRA' },
      { type: 'ATTEMPT_HANDOVER', caseId: 'paired-handover', response: 'FORCE' }, { type: 'RESTORE_PLATE' }, { type: 'REFILL_SUPPORT' }]) expect(validateHandOfOrderActivityCommand(command)).toBe(false);
    rejectHandOfOrder(promoted(), { type: 'RENT_ANNEX' });
  });
  it('promotion copies actual final physical truth, not the earlier Balancer snapshot or original opponent', () => {
    const original = originalBalancer(), s = promoted(), l = s.handOfOrder.life;
    expect(l.source!.originals.site).toEqual(original.chaosHunter.life); expect(l.source!.originals.site).not.toEqual(original.balancer.life.source!.snapshot);
    expect(l.site).toEqual(original.chaosHunter.life); expect(l.guardPlate).toEqual(original.balancer.life.guardPlate);
    expect(l.operation).toEqual({ ...original.balancer.life.operation, pending: null, division: null, aftermath: null });
    expect(l.site).toMatchObject({ playerLocation: 'START', playerTravelMetres: 124, guideTravelMetres: 92, clockSeconds: 767, guide: { location: 'OUTSIDE' }, volunteer: { location: 'OUTSIDE', mind: 100, willing: false } });
    expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(original)); expect(s.health).toBe(60);
    expect(s.injuries).toEqual(original.injuries); expect(s.injuryRisk).toBe(1);
    expect(getHandOfOrderCurrentSite(original)).toEqual(original.chaosHunter.life);
    expect(l.annex.effortSpent).toBe(0); expect('energy' in l.site!.volunteer).toBe(false);
  });
  it('first moves the same body four actual metres, then pays once and physically places the separate annex', () => {
    const initial = promotedForLife(), outside = act(initial, { type: 'EXIT_ORIGINAL' }), s = act(outside, { type: 'RENT_ANNEX' });
    expect(outside.handOfOrder.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 128, guideTravelMetres: 92, clockSeconds: 771 });
    expect(outside.handOfOrder.life.guardPlate).toMatchObject({ id: 'BA2-GUARD-PLATE', holder: 'PLAYER', location: 'OUTSIDE', integrity: 65 });
    expect(outside.cash - s.cash).toBe(40); expect(outside.actionsRemaining - s.actionsRemaining).toBe(1);
    expect(s.handOfOrder.life.annex).toMatchObject({ paidWeek: s.week, supportPieces: 3, placementConsent: 'GRANTED', effortSpent: 0, volunteerTravelMetres: 8 });
    expect(s.handOfOrder.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 136, guideTravelMetres: 108, clockSeconds: 787 });
    expect(s.handOfOrder.life.site!.table).toEqual(initial.chaosHunter.life.table);
    expect(s.handOfOrder.life.movements.filter(m => m.actor === 'GUIDE').map(m => [m.from, m.to, m.metres])).toEqual([['OUTSIDE', 'ANNEX_A', 4], ['ANNEX_A', 'ANNEX_B', 4], ['ANNEX_B', 'ANNEX_A', 4], ['ANNEX_A', 'OUTSIDE', 4]]);
    expect(oldJusticiarRoots(s)).toEqual(oldJusticiarRoots(initial)); rejectHandOfOrder(s, { type: 'RENT_ANNEX' }); rejectHandOfOrder(s, { type: 'EXIT_ORIGINAL' });
  });
  it('fresh permission and actual independent waiting precede the pending handover', () => {
    let s = rented(); const caseId = 'paired-handover' as const;
    s = act(s, { type: 'OBSERVE', caseId }); s = act(s, { type: 'PREPARE', caseId, method: 'ABILITY' });
    expect(hasHandOfOrderLifeLock(s)).toBe(true); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    for (const type of ['CHECK_ORIGINALS', 'CONSENT_MIRA', 'SETUP_OBJECTS', 'BATTLEFIELD_DIVISION'] as const) rejectHandOfOrder(s, { type, caseId });
    s = act(s, { type: 'WALK', caseId, to: 'ANNEX_A' }); s = act(s, { type: 'CHECK_ORIGINALS', caseId }); s = act(s, { type: 'CONSENT_MIRA', caseId });
    rejectHandOfOrder(s, { type: 'BATTLEFIELD_DIVISION', caseId }); const before = structuredClone(s); s = act(s, { type: 'SETUP_OBJECTS', caseId });
    expect(s.handOfOrder.life.operation.pending).toMatchObject({ kind: 'HANDOVER', actor: 'GUIDE', target: 'CH3-MIRA', objectId: 'CH3-PARCEL', from: 'ANNEX_A', to: 'ANNEX_B', metres: 4, status: 'PENDING' });
    expect(s.handOfOrder.life.site!.parcel).toMatchObject({ holder: 'GUIDE', location: 'ANNEX_A', massGrams: 350 });
    expect(s.handOfOrder.life.site!.volunteer).toMatchObject({ location: 'ANNEX_B', mind: 99, health: 100, willing: true });
    expect(s.handOfOrder.life.annex.effortSpent).toBe(3); expect(s.handOfOrder.life.site!.clockSeconds - before.handOfOrder.life.site!.clockSeconds).toBe(5);
    expect(attempt(s, caseId).movements.at(-1)).toMatchObject({ actor: 'CH3-MIRA', from: 'ANNEX_A', to: 'ANNEX_B', metres: 4 });
    expect(s.progression.mastery[DIVISION]).toBe(0);
  });
  it('three ordinary cases keep both new skills zero, original history fixed and actual mind/plate costs', () => {
    const initial = rented(), history = oldJusticiarRoots(initial), beforeHealth = initial.health; let s = initial;
    for (const id of HAND_OF_ORDER_CASE_IDS) s = ordinary(s, id); s = act(s, { type: 'REFLECT' });
    expect(handOfOrderLifeClosed(s)).toBe(true); expect(hasHandOfOrderLifeLock(s)).toBe(false); expect(s.progression.acting).toBe(100);
    expect([s.progression.mastery[DIVISION], s.progression.mastery[AFTERMATH]]).toEqual([0, 0]); expect(handOfOrderLifeMasteryGains(s)).toEqual({ [DIVISION]: 0, [AFTERMATH]: 0 });
    expect(s.health).toBe(beforeHealth - 2); expect(s.handOfOrder.life.guardPlate!.integrity).toBe(50);
    expect(s.handOfOrder.life.site!.volunteer).toMatchObject({ health: 100, mind: 97, willing: false, location: 'OUTSIDE' });
    expect(s.handOfOrder.life.annex).toMatchObject({ effortSpent: 9, effortLimit: 9, supportPieces: 3 });
    expect(s.handOfOrder.life.site!.guide.location).toBe('OUTSIDE'); expect(s.handOfOrder.life.site!.playerLocation).toBe('OUTSIDE');
    for (const x of [s.handOfOrder.life.site!.parcel, s.handOfOrder.life.site!.paper, s.handOfOrder.life.site!.line]) expect(x).toMatchObject({ holder: 'GUIDE', location: 'OUTSIDE' });
    expect(oldJusticiarRoots(s)).toEqual(history); expect(s.handOfOrder.life.site!.cases).toEqual(initial.chaosHunter.life.cases); expect(s.handOfOrder.life.site!.table).toEqual(initial.chaosHunter.life.table);
    expect(replayHandOfOrderLifeRoot(s)).toEqual(s.handOfOrder.life.site); expect(replayHandOfOrderLifeGuardPlate(s)).toEqual(s.handOfOrder.life.guardPlate);
    rejectHandOfOrder(s, { type: 'OBSERVE', caseId: 'paired-handover' }); rejectHandOfOrder(s, { type: 'REFLECT' }); assertValidSliceState(s);
  });
  it('declining supernatural permission preserves the ordinary handover and never reasks', () => {
    let s = begin(rented(), 'paired-handover', 'ABILITY', 'DECLINE_PERMISSION');
    rejectHandOfOrder(s, { type: 'CONSENT_MIRA', caseId: 'paired-handover' }); rejectHandOfOrder(s, { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' });
    s = finish(s, 'paired-handover'); expect(s.progression.mastery[DIVISION]).toBe(0); expect(s.handOfOrder.life.annex.supportPieces).toBe(3);
  });
});

describe('Hand of Order finite division, real resistance and fresh withdrawal', () => {
  it('a successful cast spends 8S/2M/1AP/one piece but only actual pending application and report earn8', () => {
    const before = begin(rented(), 'paired-handover'); let s = act(before, { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' });
    expect([before.spirituality - s.spirituality, before.mind - s.mind, before.actionsRemaining - s.actionsRemaining]).toEqual([8, 2, 1]);
    expect(s.handOfOrder.life.annex.supportPieces).toBe(2); expect(s.progression.mastery[DIVISION]).toBe(0);
    const effect = s.handOfOrder.life.operation.division!; expect(effect.expiresAt - effect.createdAt).toBe(20); expect(effect.remainingUses).toBe(1);
    expect(s.handOfOrder.life.journal.at(-1)!.source).toMatchObject({ difficulty: 18, coreStat: 'knowledge', supportPiecesBefore: 3, objectId: 'CH3-PARCEL', plateId: null });
    rejectHandOfOrder(s, { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' });
    s = act(s, { type: 'ATTEMPT_HANDOVER', caseId: 'paired-handover', response: 'COOPERATE' });
    expect(attempt(s, 'paired-handover').divisionOutcome).toBe('STOPPED'); expect(s.handOfOrder.life.operation.division).toBeNull();
    expect(s.handOfOrder.life.site!.parcel).toMatchObject({ holder: 'GUIDE', location: 'ANNEX_A' }); expect(s.handOfOrder.life.site!.guide.location).toBe('ANNEX_A');
    expect(s.handOfOrder.life.operation.pending!.status).toBe('PENDING'); expect(s.progression.mastery[DIVISION]).toBe(0);
    rejectHandOfOrder(s, { type: 'ATTEMPT_HANDOVER', caseId: 'paired-handover', response: 'COOPERATE' });
    s = finish(s, 'paired-handover', false); expect(s.progression.mastery[DIVISION]).toBe(0);
    s = act(s, { type: 'REPORT', caseId: 'paired-handover' }); expect(s.progression.mastery[DIVISION]).toBe(8); expect(s.progression.mastery[AFTERMATH]).toBe(0);
    rejectHandOfOrder(s, { type: 'REPORT', caseId: 'paired-handover' });
  });
  it('an actual cooperative adult can resist a successful boundary and complete normal four-metre movement', () => {
    let s = act(begin(rented(), 'paired-handover'), { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' }); const before = structuredClone(s);
    s = act(s, { type: 'ATTEMPT_HANDOVER', caseId: 'paired-handover', response: 'RESIST' });
    expect(attempt(s, 'paired-handover')).toMatchObject({ divisionOutcome: 'RESISTED', handoverCompleted: true, appliedAbilityIds: [] });
    expect(s.handOfOrder.life.site!.parcel).toMatchObject({ holder: 'VOLUNTEER', location: 'ANNEX_B' });
    expect(s.handOfOrder.life.site!.guideTravelMetres - before.handOfOrder.life.site!.guideTravelMetres).toBe(8);
    expect([s.spirituality, s.mind, s.handOfOrder.life.annex.supportPieces]).toEqual([before.spirituality, before.mind, 2]);
    s = finish(s, 'paired-handover'); expect(s.progression.mastery[DIVISION]).toBe(0);
  });
  it('failure pays8S/4M/one piece and the pending handover proceeds ordinarily without mastery', () => {
    const before = begin(rented('DIVISION_FAIL'), 'paired-handover'); let s = act(before, { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' });
    expect([before.spirituality - s.spirituality, before.mind - s.mind]).toEqual([8, 4]); expect(s.handOfOrder.life.operation.division).toBeNull();
    s = act(s, { type: 'ATTEMPT_HANDOVER', caseId: 'paired-handover', response: 'COOPERATE' }); expect(attempt(s, 'paired-handover').divisionOutcome).toBe('PROCEEDED');
    s = finish(s, 'paired-handover'); expect(s.progression.mastery[DIVISION]).toBe(0);
  });
  it('ordinary handover may replace unused successful division, forfeiting application reward without refund', () => {
    let s = act(begin(rented(), 'paired-handover'), { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' }); const resources = [s.spirituality, s.mind];
    s = finish(s, 'paired-handover'); expect([s.spirituality, s.mind]).toEqual(resources); expect(s.progression.mastery[DIVISION]).toBe(0); expect(attempt(s, 'paired-handover').effectStopped).toBe(true);
  });
  it('the20-second window actually expires and cannot be recharged or applied retrospectively', () => {
    let s = act(begin(rented(), 'paired-handover'), { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' }); const expiry = s.handOfOrder.life.operation.division!.expiresAt;
    s = act(s, { type: 'WAIT_EFFECT', caseId: 'paired-handover' }); expect(s.handOfOrder.life.site!.clockSeconds).toBe(expiry); expect(attempt(s, 'paired-handover')).toMatchObject({ effectExpired: true, waitedSeconds: 20 });
    rejectHandOfOrder(s, { type: 'WAIT_EFFECT', caseId: 'paired-handover' }); rejectHandOfOrder(s, { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' });
    s = finish(s, 'paired-handover'); expect(s.progression.mastery[DIVISION]).toBe(0);
  });
  it('withdrawal is fresh, precedes pending execution, immediately cancels a paid boundary and earns no mastery', () => {
    let s = ordinary(ordinary(rented(), 'paired-handover'), 'measured-aftermath'); s = begin(s, 'withdrawn-boundary');
    expect(attempt(s, 'withdrawn-boundary').permissionWithdrawn).toBe(false); expect(s.handOfOrder.life.annex.effortSpent).toBe(9);
    s = act(s, { type: 'BATTLEFIELD_DIVISION', caseId: 'withdrawn-boundary' }); const before = structuredClone(s);
    rejectHandOfOrder(s, { type: 'ATTEMPT_HANDOVER', caseId: 'withdrawn-boundary', response: 'COOPERATE' }); rejectHandOfOrder(s, { type: 'COMPLETE_HANDOVER', caseId: 'withdrawn-boundary' });
    s = act(s, { type: 'WITHDRAW_PERMISSION', caseId: 'withdrawn-boundary' }); expect(s.handOfOrder.life.operation.division).toBeNull();
    expect(s.handOfOrder.life.operation.pending!.status).toBe('PENDING'); expect([s.spirituality, s.mind]).toEqual([before.spirituality, before.mind]);
    rejectHandOfOrder(s, { type: 'BATTLEFIELD_DIVISION', caseId: 'withdrawn-boundary' }); s = finish(s, 'withdrawn-boundary');
    expect(attempt(s, 'withdrawn-boundary')).toMatchObject({ permissionWithdrawn: true, appliedAbilityIds: [], objectsReturned: true, closed: true });
    expect(s.progression.mastery[DIVISION]).toBe(0); expect(s.handOfOrder.life.site!.volunteer.mind).toBe(97);
  });
});

describe('Hand of Order bounded own aftermath, physical costs and ordinary exits', () => {
  it('successful aftermath buffers one actual visible own impulse5→2, wears the same plate15 and awards only on report', () => {
    let s = buffer(), before = structuredClone(s); expect(s.handOfOrder.life.operation.aftermath).not.toBeNull(); expect(s.handOfOrder.life.guardPlate!.integrity).toBe(65);
    s = act(s, { type: 'APPLY_IMPACT', caseId: 'measured-aftermath' });
    expect(before.health - s.health).toBe(2); expect(s.handOfOrder.life.guardPlate!.integrity).toBe(50);
    expect(attempt(s, 'measured-aftermath').impact).toMatchObject({ actor: 'PLAYER', target: 'PLAYER', massGrams: 350, baseHealthLoss: 5, healthLoss: 2, plateWear: 15, aftermathApplied: true });
    expect(s.handOfOrder.life.operation.aftermath).toBeNull(); expect(s.progression.mastery[AFTERMATH]).toBe(0);
    rejectHandOfOrder(s, { type: 'APPLY_IMPACT', caseId: 'measured-aftermath' }); s = finish(s, 'measured-aftermath'); expect(s.progression.mastery[AFTERMATH]).toBe(8);
    expect(s.balancer.life.guardPlate.integrity).toBe(65); expect(s.handOfOrder.life.source!.originals.guardPlate.integrity).toBe(65);
  });
  it('failed aftermath keeps8S/4M/one piece and an unbuffered real impulse takes5H/15plate', () => {
    let s = buffer('AFTERMATH_FAIL'), before = structuredClone(s); expect(s.handOfOrder.life.operation.aftermath).toBeNull();
    expect(attempt(s, 'measured-aftermath')).toMatchObject({ spiritualitySpent: 8, mindSpent: 4 });
    s = act(s, { type: 'APPLY_IMPACT', caseId: 'measured-aftermath' }); expect(before.health - s.health).toBe(5); expect(s.handOfOrder.life.guardPlate!.integrity).toBe(50);
    s = finish(s, 'measured-aftermath'); expect(s.progression.mastery[AFTERMATH]).toBe(0);
  });
  it('expiry retains costs; ordinary brace uses2H/15plate and never supernatural mastery', () => {
    let s = buffer(); const expiry = s.handOfOrder.life.operation.aftermath!.expiresAt, resources = [s.spirituality, s.mind], health = s.health;
    s = act(s, { type: 'WAIT_EFFECT', caseId: 'measured-aftermath' }); expect(s.handOfOrder.life.site!.clockSeconds).toBe(expiry);
    s = finish(s, 'measured-aftermath'); expect([s.spirituality, s.mind]).toEqual(resources); expect(s.health).toBe(health - 2); expect(s.handOfOrder.life.guardPlate!.integrity).toBe(50);
    expect(attempt(s, 'measured-aftermath').impact).toMatchObject({ mode: 'ORDINARY_BRACE', aftermathApplied: false, healthLoss: 2 }); expect(s.progression.mastery[AFTERMATH]).toBe(0);
  });
  it.each(['STOP', 'WITHDRAW_PERMISSION'] as const)('%s cancels unused aftermath, preserves payment, and permits safe ordinary cancellation', type => {
    let s = buffer(); const resources = [s.health, s.spirituality, s.mind], plate = s.handOfOrder.life.guardPlate!.integrity;
    s = act(s, { type, caseId: 'measured-aftermath' }); expect(s.handOfOrder.life.operation.aftermath).toBeNull();
    rejectHandOfOrder(s, { type: 'AFTERMATH_CONTROL', caseId: 'measured-aftermath' }); rejectHandOfOrder(s, { type: 'APPLY_IMPACT', caseId: 'measured-aftermath' });
    s = act(s, { type: 'CANCEL_IMPULSE', caseId: 'measured-aftermath' }); s = finish(s, 'measured-aftermath');
    expect([s.health, s.spirituality, s.mind]).toEqual(resources); expect(s.handOfOrder.life.guardPlate!.integrity).toBe(plate); expect(s.progression.mastery[AFTERMATH]).toBe(0);
    expect(attempt(s, 'measured-aftermath').impact).toMatchObject({ mode: 'CANCELLED', healthLoss: 0, plateWear: 0, aftermathApplied: false });
  });
  it('always offers ordinary physical exit without teleporting people or returning objects remotely', () => {
    let s = act(begin(rented(), 'paired-handover'), { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' }); const before = structuredClone(s);
    s = act(s, { type: 'WALK', caseId: 'paired-handover', to: 'OUTSIDE' });
    expect(s.handOfOrder.life.site!.playerTravelMetres - before.handOfOrder.life.site!.playerTravelMetres).toBe(4); expect(s.handOfOrder.life.guardPlate!.location).toBe('OUTSIDE');
    expect(s.handOfOrder.life.site!.guide.location).toBe('ANNEX_A'); expect(s.handOfOrder.life.site!.parcel.location).toBe('ANNEX_A'); expect(s.handOfOrder.life.site!.volunteer.location).toBe('ANNEX_B');
    expect(s.handOfOrder.life.operation.division).toBeNull(); expect(attempt(s, 'paired-handover').stopped).toBe(true);
    rejectHandOfOrder(s, { type: 'RETURN_OBJECTS', caseId: 'paired-handover' }); rejectHandOfOrder(s, { type: 'REPORT', caseId: 'paired-handover' });
    s = act(s, { type: 'WALK', caseId: 'paired-handover', to: 'ANNEX_A' }); s = finish(s, 'paired-handover'); expect(s.progression.mastery[DIVISION]).toBe(0);
  });
  it('resource and worn-plate gates do not charge or lock zero-cost cancellation, movement, return and close', () => {
    const setup = begin(ordinary(rented('AFTERMATH'), 'paired-handover'), 'measured-aftermath'), low = structuredClone(setup);
    // Explicit gate-only invalid-resource probes, never campaign inputs or saved histories.
    low.spirituality = 0; low.mind = 0; low.actionsRemaining = 0; low.handOfOrder.life.guardPlate!.integrity = 0;
    expect(blockHandOfOrderLife(low, { type: 'AFTERMATH_CONTROL', caseId: 'measured-aftermath' })).not.toBeNull();
    expect(blockHandOfOrderLife(low, { type: 'CANCEL_IMPULSE', caseId: 'measured-aftermath' })).toBeNull(); expect(blockHandOfOrderLife(low, { type: 'STOP', caseId: 'measured-aftermath' })).toBeNull();
    expect(blockHandOfOrderLife(low, { type: 'WALK', caseId: 'measured-aftermath', to: 'OUTSIDE' })).toBeNull();
    expect(low.handOfOrder.life.annex.supportPieces).toBe(3); expect(low.handOfOrder.life.journal).toEqual(setup.handOfOrder.life.journal);
    const returned = finish(act(setup, { type: 'CANCEL_IMPULSE', caseId: 'measured-aftermath' }), 'measured-aftermath'); expect(returned.handOfOrder.life.guardPlate!.integrity).toBe(65);
  });
});

describe('Hand of Order exact replay and public allowlists', () => {
  const mutations: [string, (s: SliceState) => void][] = [
    ['actual clock', s => { s.handOfOrder.life.site!.clockSeconds++; }],
    ['actual travel', s => { s.handOfOrder.life.site!.playerTravelMetres += 4; }],
    ['original table copied to annex', s => { (s.handOfOrder.life.site!.table as unknown as { location: string }).location = 'ANNEX_B'; }],
    ['old case history', s => { s.handOfOrder.life.site!.cases['paired-line'].closes++; }],
    ['source plate healing', s => { s.handOfOrder.life.source!.originals.guardPlate.integrity--; }],
    ['current plate healing', s => { s.handOfOrder.life.guardPlate!.integrity++; }],
    ['refund spirituality', s => { s.spirituality += 8; }],
    ['refund mental cost', s => { s.mind += 2; }],
    ['refund support piece', s => { s.handOfOrder.life.annex.supportPieces++; }],
    ['invented energy', s => { (s.handOfOrder.life.site!.volunteer as unknown as Record<string, unknown>).energy = 100; }],
    ['ignored cooperation', s => { s.handOfOrder.life.annex.effortSpent = 0; }],
    ['ignored volunteer mental cost', s => { s.handOfOrder.life.site!.volunteer.mind = 100; }],
    ['unbounded window', s => { s.handOfOrder.life.operation.division!.expiresAt += 60; }],
    ['unknown pending object', s => { (s.handOfOrder.life.operation.pending as unknown as { objectId: string }).objectId = 'UNKNOWN'; }],
    ['fake check', s => { s.handOfOrder.life.journal.at(-1)!.check!.roll = s.handOfOrder.life.journal.at(-1)!.check!.roll === 1 ? 2 : 1; }],
    ['forged costs', s => { s.handOfOrder.life.journal.at(-1)!.paid.spirituality = 0; }],
    ['forged budget', s => { s.handOfOrder.life.journal.at(-1)!.after.health++; }],
    ['hidden source expansion', s => { (s.handOfOrder.life.journal.at(-1)!.source as unknown as Record<string, unknown>).allFutureObjects = true; }],
  ];
  it.each(mutations)('rejects %s without repairing the saved truth', (_label, mutate) => {
    const s = act(begin(rented(), 'paired-handover'), { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' }); mutate(s); const raw = structuredClone(s);
    expect(validateHandOfOrderLifeState(s)).toBe(false); expect(s).toEqual(raw);
  });
  it('public projection exposes explicit player facts and only public fields, with no source journals or RNG', () => {
    const s = act(begin(rented(), 'paired-handover'), { type: 'BATTLEFIELD_DIVISION', caseId: 'paired-handover' }), p = projectHandOfOrderLife(s);
    const forbidden = new Set(['source', 'originals', 'sourceHistory', 'journal', 'random', 'randomBefore', 'randomAfter', 'randomCursor', 'seed', 'cursor', 'preparationRoll', 'movements', 'check']);
    const visit = (v: unknown): void => { if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') for (const [key, value] of Object.entries(v)) { expect(forbidden.has(key), key).toBe(false); visit(value); } }; visit(p);
    expect(p.annex).toMatchObject({ paid: true, supportPieces: 2, effortSpent: 3, effortLimit: 9, volunteerMind: 99 }); expect(p.pendingAction).toContain('尚未完成'); expect(p.effectRemainingSeconds).toBe(20);
    expect(p.site.table).toContain('旧房'); expect(p.site.parcel).toContain('薇娜'); expect(p.site.volunteer).toContain('米拉'); expect(p.guardPlate.integrity).toBe(65);
    expect(p.actions.find(a => a.id === p.preferredActionId)?.command).toEqual({ type: 'ATTEMPT_HANDOVER', caseId: 'paired-handover', response: 'COOPERATE' });
    p.currentAttempt!.evidence.push('changed public view'); expect(attempt(s, 'paired-handover').evidence).not.toContain('changed public view');
  });
});
