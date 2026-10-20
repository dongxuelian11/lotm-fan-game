import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import { getLifeGiverGuest, projectLifeGiverLife, returnLifeGiverGuestOrdinarily, validateLifeGiverActivityCommand, validateLifeGiverLife } from '../../src/domain/life-giver/life.js';
import { LIFE_GIVER_ABILITY_IDS } from '../../src/domain/life-giver/types.js';
import { arriveAndBorrow, attempt, beginCase, closeCase, directedLifeReady, guest, lifeGiverBoundary, lifeGiverSnapshot, lg, rejectLg, unitBudget } from './life-giver-test-fixture.js';
import type { SliceState } from '../../src/domain/slice/types.js';
const TIRED = 'tired-guest', WITHDRAWN = 'withdrawn-consent', BLOCKED = 'interrupted-link';
const VITALITY = 'moon.s2.bounded-vitality', SHELTER = 'moon.s2.shared-shelter';
function atBorrow() { return arriveAndBorrow(beginCase(directedLifeReady())); }

describe('Life Giver finite life support, current consent and authoritative original body', () => {
  it('pays separate observation/preparation/implementation actions and locks ordinary life', () => {
    let s = directedLifeReady(); const before = structuredClone(s);
    s = lg(s, { type: 'OBSERVE', caseId: TIRED }); expect(s.actionsRemaining).toBe(2);
    s = lg(s, { type: 'PREPARE', caseId: TIRED, method: 'ABILITY' }); expect(s.actionsRemaining).toBe(1);
    expect(s.cash).toBe(before.cash - 120); expect(s.lifeGiver.life.beads).toHaveLength(2);
    expect(s.lifeGiver.life.beads.map(b => [b.id, b.paidPennies, b.purpose, b.caseId, b.status])).toEqual([
      ['LG2-BEAD-1', 60, 'LIFE', TIRED, 'READY'], ['LG2-BEAD-2', 60, 'LIFE', TIRED, 'READY'],
    ]);
    s = lg(s, { type: 'PERFORM', caseId: TIRED }); expect(s.actionsRemaining).toBe(0); expect(s.week).toBe(before.week);
    expect(attempt(s)).toMatchObject({ consent: 'UNASKED', ownerConsent: false, arrived: false, elapsedSeconds: 0 });
    expect(projectSliceState(s).canAct).toBe(false); expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    rejectLg(s, { type: 'REST_GUEST' }); rejectLg(s, { type: 'CLOSE', caseId: TIRED });
  });

  it('returns both same unused paid beads on preparation cancellation without refund or guest movement', () => {
    let s = directedLifeReady(); s = lg(s, { type: 'OBSERVE', caseId: TIRED }); s = lg(s, { type: 'PREPARE', caseId: TIRED, method: 'ABILITY' });
    const before = structuredClone(s); s = lg(s, { type: 'WITHDRAW', caseId: TIRED });
    expect([s.cash, s.actionsRemaining, s.health, s.spirituality]).toEqual([before.cash, before.actionsRemaining, before.health, before.spirituality]);
    expect(guest(s)).toEqual(guest(before)); expect(s.lifeGiver.life.clockSeconds).toBe(2);
    expect(s.lifeGiver.life.beads.map(b => [b.id, b.location, b.status])).toEqual([['LG2-BEAD-1', 'RETURN_TRAY', 'READY'], ['LG2-BEAD-2', 'RETURN_TRAY', 'READY']]);
    expect(s.lifeGiver.life.cases[TIRED]).toMatchObject({ status: 'OBSERVED', withdrawals: 1, attempts: [] });
  });

  it('requires travel, same-body inspection and two separate present-scene permissions', () => {
    let s = beginCase(directedLifeReady()); const original = structuredClone(guest(s));
    expect(getLifeGiverGuest(s)).toBe(s.summoningMaster.life.partner);
    rejectLg(s, { type: 'CONSENT', caseId: TIRED }); rejectLg(s, { type: 'FETCH_GUEST', caseId: TIRED }); rejectLg(s, { type: 'BORROW_TOKEN', caseId: TIRED });
    s = lg(s, { type: 'VISIT_HOME', caseId: TIRED }); expect(s.lifeGiver.life.playerTravelMetres).toBe(30);
    expect(attempt(s).elapsedSeconds).toBe(30); expect(guest(s)).toEqual(original);
    s = lg(s, { type: 'CHECK_GUEST_ORIGIN', caseId: TIRED }); s = lg(s, { type: 'CONSENT', caseId: TIRED });
    expect(attempt(s).consent).toBe('GRANTED'); expect(attempt(s).ownerConsent).toBe(false);
    s = lg(s, { type: 'FETCH_GUEST', caseId: TIRED }); expect(guest(s).location).toBe('YARD');
    expect(guest(s).bodyId).toBe(original.bodyId); expect(guest(s).chime).toEqual(original.chime);
    expect(guest(s).ordinaryDistanceM).toBe(original.ordinaryDistanceM + 30); expect(s.lifeGiver.life.playerTravelMetres).toBe(60);
    rejectLg(s, { type: 'BORROW_TOKEN', caseId: TIRED });
    s = lg(s, { type: 'CONSENT_OWNER', caseId: TIRED }); s = lg(s, { type: 'BORROW_TOKEN', caseId: TIRED });
    expect(s.lifeGiver.life.token).toMatchObject({ id: 'LG2-MIRA-TOKEN', massGrams: 200, custodian: 'PLAYER', location: 'START' });
  });

  it('refuses vitality on a full guest, then records16 real fatigue from two physical carries', () => {
    let s = atBorrow(); const original = structuredClone(guest(s)), random = structuredClone(s.random);
    rejectLg(s, { type: 'VITALITY', caseId: TIRED }); expect(s.random).toEqual(random);
    s = lg(s, { type: 'GUEST_CARRY', caseId: TIRED }); expect(guest(s).stamina).toBe(original.stamina - 8);
    expect(s.lifeGiver.life.token.location).toBe('TABLE'); expect(attempt(s).guestOffsetMetres).toBe(2);
    s = lg(s, { type: 'GUEST_CARRY', caseId: TIRED });
    expect(guest(s).stamina).toBe(original.stamina - 16); expect(attempt(s)).toMatchObject({ guestTrips: 2, guestStaminaSpent: 16, guestOffsetMetres: 0, tokenBack: true });
    expect(guest(s).ordinaryDistanceM).toBe(original.ordinaryDistanceM + 4); rejectLg(s, { type: 'GUEST_CARRY', caseId: TIRED });
  });

  it.each([[1, true], [100, false]] as const)('pays6S and one unique original bead for vitality roll%s, including failure', (roll, success) => {
    let s = lifeGiverBoundary('tired-guest-vitality-outcome').beforeLast; const before = structuredClone(s);
    s = lg(s, { type: 'VITALITY', caseId: TIRED }, roll);
    expect(s.spirituality).toBe(before.spirituality - 6); expect(guest(s).stamina).toBe(guest(before).stamina + (success ? Math.min(12, 100 - guest(before).stamina) : 0));
    expect([guest(s).health, guest(s).mind, s.health, s.mind]).toEqual([guest(before).health, guest(before).mind, before.health, before.mind]);
    expect(s.injuries).toEqual(before.injuries); expect(s.injuryRisk).toBe(before.injuryRisk);
    expect(attempt(s).vitalityRestored).toBe(success ? 12 : 0); expect(attempt(s).spiritualitySpent).toBe(6);
    expect(s.lifeGiver.life.beads.filter(b => b.status === 'SPENT')).toHaveLength(1);
    expect(s.lifeGiver.life.beads.find(b => b.status === 'SPENT')).toMatchObject({ id: before.lifeGiver.life.beads[0]!.id, paidPennies: 60, abilityId: VITALITY, spentWeek: s.week, combatRound: null });
    expect(s.progression.mastery[VITALITY]).toBe(before.progression.mastery[VITALITY]! + (success ? 8 : 0));
    rejectLg(s, { type: 'VITALITY', caseId: TIRED });
  });

  it('awards shelter only on one actual shared carry, charging5 health and3 guest stamina at that moment', () => {
    let s = atBorrow(); const before = structuredClone(s); s = lg(s, { type: 'SHELTER', caseId: TIRED }, 1);
    expect([s.spirituality, s.health, guest(s).stamina]).toEqual([before.spirituality - 4, before.health, guest(before).stamina]);
    expect(attempt(s)).toMatchObject({ shelterStatus: 'ACTIVE', shelterRemainingSeconds: 15, shelterApplied: false }); expect(s.progression.mastery[SHELTER]).toBe(0);
    s = lg(s, { type: 'GUEST_CARRY', caseId: TIRED });
    expect([s.health, guest(s).stamina]).toEqual([before.health - 5, guest(before).stamina - 3]);
    expect(attempt(s)).toMatchObject({ shelterStatus: 'APPLIED', shelterRemainingSeconds: 0, shelterApplied: true, playerHealthSpent: 5, guestStaminaSpent: 3 });
    expect(s.progression.mastery[SHELTER]).toBe(8);
    s = lg(s, { type: 'GUEST_CARRY', caseId: TIRED }); expect(guest(s).stamina).toBe(guest(before).stamina - 11); expect(s.health).toBe(before.health - 5);
    rejectLg(s, { type: 'SHELTER', caseId: TIRED });
  });

  it('keeps failed shelter costs and ordinary fallback with no health debit or mastery', () => {
    let s = atBorrow(); const before = structuredClone(s); s = lg(s, { type: 'SHELTER', caseId: TIRED }, 100);
    expect(attempt(s)).toMatchObject({ shelterStatus: 'FAILED', shelterRemainingSeconds: 0, shelterApplied: false });
    expect(s.spirituality).toBe(before.spirituality - 4); expect(s.health).toBe(before.health);
    expect(s.lifeGiver.life.beads.filter(b => b.status === 'SPENT')).toHaveLength(1); rejectLg(s, { type: 'SHELTER', caseId: TIRED });
    s = lg(s, { type: 'CARRY_TOKEN', caseId: TIRED }); s = closeCase(s);
    expect(s.lifeGiver.life.cases[TIRED].result).toBe('ORDINARY'); expect(s.progression.mastery[SHELTER]).toBe(0);
    expect(s.health).toBe(before.health); expect(guest(s).stamina).toBe(guest(before).stamina);
  });

  it.each(['STOP_SHELTER', 'REVOKE_CONSENT', 'REVOKE_OWNER'] as const)('%s ends a successful unused window without healing, refunds or mastery', type => {
    let s = atBorrow(); s = lg(s, { type: 'SHELTER', caseId: TIRED }, 1); const before = structuredClone(s);
    s = lg(s, { type, caseId: TIRED }); expect(attempt(s).shelterStatus).toBe('STOPPED'); expect(attempt(s).shelterRemainingSeconds).toBe(0);
    expect([s.spirituality, s.health, s.cash]).toEqual([before.spirituality, before.health, before.cash]); expect(guest(s)).toEqual(guest(before));
    expect(s.lifeGiver.life.beads).toEqual(before.lifeGiver.life.beads); expect(s.progression.mastery[SHELTER]).toBe(0);
    if (type !== 'STOP_SHELTER') for (const command of ['VITALITY', 'SHELTER', 'GUEST_CARRY'] as const) rejectLg(s, { type: command, caseId: TIRED });
    if (type === 'REVOKE_OWNER') { rejectLg(s, { type: 'CARRY_TOKEN', caseId: TIRED }); rejectLg(s, { type: 'CONSENT_OWNER', caseId: TIRED }); }
    s = lg(s, { type: 'RETURN_TOKEN', caseId: TIRED }); s = closeCase(s);
    expect(guest(s).location).toBe('HOME'); expect(s.lifeGiver.life.token.location).toBe('OWNER');
  });

  it('expires the15-second window through actual waits and then charges ordinary carry cost', () => {
    let s = lg(atBorrow(), { type: 'SHELTER', caseId: TIRED }, 1); const before = structuredClone(s);
    s = lg(s, { type: 'WAIT', caseId: TIRED, seconds: 15 });
    expect(attempt(s).elapsedSeconds).toBe(attempt(before).elapsedSeconds + 15); expect(attempt(s).shelterStatus).toBe('EXPIRED');
    s = lg(s, { type: 'GUEST_CARRY', caseId: TIRED }); expect(guest(s).stamina).toBe(guest(before).stamina - 8); expect(s.health).toBe(before.health);
    expect(s.progression.mastery[SHELTER]).toBe(0); rejectLg(s, { type: 'WAIT', caseId: TIRED, seconds: 5 });
  });

  it('withdrawal stops a paid successful window and permits only ordinary return of the same people and objects', () => {
    let s = lifeGiverBoundary('withdrawn-consent-actual-stop').beforeLast;
    s = lg(s, { type: 'SHELTER', caseId: WITHDRAWN }, 1); const before = structuredClone(s);
    s = lg(s, { type: 'REVOKE_CONSENT', caseId: WITHDRAWN });
    expect(attempt(s, WITHDRAWN)).toMatchObject({ consent: 'REVOKED', revoked: true, shelterStatus: 'STOPPED' });
    for (const type of ['VITALITY', 'SHELTER', 'GUEST_CARRY'] as const) rejectLg(s, { type, caseId: WITHDRAWN });
    s = lg(s, { type: 'CARRY_TOKEN', caseId: WITHDRAWN }); s = closeCase(s, WITHDRAWN);
    expect(guest(s).stamina).toBe(guest(before).stamina); expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality);
    expect(attempt(s, WITHDRAWN)).toMatchObject({ closed: true, guestReturned: true, ordinaryCompleted: true, shelterApplied: false });
    expect(s.lifeGiver.life.cases[WITHDRAWN].result).toBe('ORDINARY');
  });

  it('physical obstruction interrupts shelter, blocks carry, and requires the same shutter to be cleared', () => {
    let s = lifeGiverBoundary('interrupted-link-shelter-outcome').beforeLast;
    s = lg(s, { type: 'SHELTER', caseId: BLOCKED }, 1); const before = structuredClone(s);
    s = lg(s, { type: 'BLOCK_PATH', caseId: BLOCKED });
    expect(s.lifeGiver.life.shutter).toEqual({ id: 'LG2-SHUTTER', location: 'LOWERED' }); expect(attempt(s, BLOCKED).shelterStatus).toBe('STOPPED');
    rejectLg(s, { type: 'GUEST_CARRY', caseId: BLOCKED }); rejectLg(s, { type: 'CARRY_TOKEN', caseId: BLOCKED }); rejectLg(s, { type: 'SHELTER', caseId: BLOCKED });
    s = lg(s, { type: 'CLEAR_PATH', caseId: BLOCKED }); s = lg(s, { type: 'CARRY_TOKEN', caseId: BLOCKED }); s = closeCase(s, BLOCKED);
    expect(attempt(s, BLOCKED)).toMatchObject({ obstructionObserved: true, cleared: true, ordinaryCompleted: true, shelterApplied: false });
    expect(s.health).toBe(before.health); expect(guest(s).stamina).toBe(guest(before).stamina); expect(s.progression.mastery[SHELTER]).toBe(0);
  });

  it('ordinary preparation creates no beads and completes a real124m player/60m guest return route', () => {
    let s = arriveAndBorrow(beginCase(directedLifeReady(), TIRED, 'ORDINARY')); const before = structuredClone(s);
    rejectLg(s, { type: 'SHELTER', caseId: TIRED }); s = lg(s, { type: 'CARRY_TOKEN', caseId: TIRED }); s = closeCase(s);
    expect(s.lifeGiver.life.beads).toEqual([]); expect(s.lifeGiver.life.cases[TIRED].result).toBe('ORDINARY');
    expect(attempt(s)).toMatchObject({ playerTravelMetres: 124, guestTravelMetres: 60, guestTrips: 0, ordinaryCompleted: true, guestReturned: true, closed: true });
    expect(s.spirituality).toBe(before.spirituality); expect(guest(s).stamina).toBe(guest(before).stamina); expect(LIFE_GIVER_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0]);
    // Windows run39354205666 measured 6.538s for this complete ordinary return route.
  }, 10_000);

  it('charges paid original HOME rest once in a later week without healing health or creating a body', () => {
    const b = lifeGiverBoundary('original-guest-paid-rest'), before = b.beforeLast, after = b.final;
    expect(b.lastIntent).toEqual({ type: 'LIFE_GIVER', command: { type: 'REST_GUEST' } });
    expect(after.cash).toBe(before.cash - 30); expect(after.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(guest(after)).toMatchObject({ id: guest(before).id, bodyId: guest(before).bodyId, location: 'HOME', health: guest(before).health, stamina: Math.min(100, guest(before).stamina + 30), mind: Math.min(100, guest(before).mind + 10) });
    expect(guest(after).chime).toEqual(guest(before).chime); expect(guest(after).restHistory).toHaveLength(guest(before).restHistory.length + 1);
    expect(guest(after).restHistory.at(-1)!.week).toBeGreaterThan(guest(before).restHistory.at(-1)!.week); rejectLg(after, { type: 'REST_GUEST' });
  });

  it('the narrow ordinary-return helper never moves or restores a dead original body', () => {
    // Explicit isolated helper branch, not a valid campaign or a natural death claim.
    const s = lifeGiverSnapshot('promoted'); guest(s).status = 'DEAD'; guest(s).health = 0; guest(s).location = 'YARD';
    const before = structuredClone(s); expect(returnLifeGiverGuestOrdinarily(s)).toBe(0); expect(s).toEqual(before);
  });

  it('reports and reflects exactly once with acting25 each, without extra mastery from reports', () => {
    const s = lifeGiverSnapshot('practiced'); expect(s.progression.acting).toBe(100); expect(s.lifeGiver.life.reflected).toBe(true);
    for (const id of [TIRED, WITHDRAWN, BLOCKED] as const) {
      const b = lifeGiverBoundary(`${id}-report`); expect(b.final.progression.acting).toBe(b.beforeLast.progression.acting + 25);
      expect(b.final.progression.mastery).toEqual(b.beforeLast.progression.mastery); expect(b.final.lifeGiver.life.cases[id].status).toBe('RESOLVED');
      rejectLg(unitBudget(b.final), { type: 'REPORT', caseId: id });
    }
    const b = lifeGiverBoundary('reflection'); expect(b.final.progression.acting).toBe(b.beforeLast.progression.acting + 25);
    expect(b.final.progression.mastery).toEqual(b.beforeLast.progression.mastery); rejectLg(unitBudget(s), { type: 'REFLECT' });
  });

  it('public life projections copy the sole current guest and cannot mutate saved originals', () => {
    const s = lifeGiverSnapshot('practiced'), before = structuredClone(s), p = projectLifeGiverLife(s);
    expect(p.partner).toEqual(guest(s)); p.partner.stamina = 0; p.beads[0]!.source = 'changed'; p.cases[0]!.attempts[0]!.consent = 'GRANTED';
    expect(s).toEqual(before);
  });

  it.each([{}, { type: 'CREATE_LIFE' }, { type: 'VITALITY', caseId: TIRED, free: true }, { type: 'PREPARE', caseId: TIRED, method: 'FREE' }, { type: 'WAIT', caseId: TIRED, seconds: 14 }, { type: 'CONSENT', caseId: 'original-token' }, { type: 'REST_GUEST', resurrect: true }, { type: 'PREPARE_PAPER', paperId: 'LG2-PAPER-1' }])('rejects malformed or invented life command %#', command => {
    expect(validateLifeGiverActivityCommand(command)).toBe(false); expect(validateSlicePayload({ type: 'LIFE_GIVER', command })).toBe(false);
  });

  it('rejects erased costs, forged checks/consent/mastery, duplicate bodies/beads and replay discontinuity', () => {
    const original = lifeGiverSnapshot('practiced');
    const corruptions: ((s: SliceState) => void)[] = [
      s => { s.lifeGiver.life.beads[0]!.source = 'free moon bead'; },
      s => { s.lifeGiver.life.beads[1]!.id = s.lifeGiver.life.beads[0]!.id; },
      s => { (s.lifeGiver.life.beads[0] as unknown as { paidPennies: number }).paidPennies = 0; },
      s => { s.lifeGiver.life.beads.find(b => b.status === 'SPENT')!.status = 'READY'; },
      s => { s.lifeGiver.life.ledger.find(e => e.command.type === 'PREPARE')!.after.cash += 120; },
      s => { s.lifeGiver.life.ledger.find(e => e.check !== null)!.check!.roll = 0; },
      s => { s.lifeGiver.life.ledger.find(e => e.command.type === 'VITALITY')!.after.spirituality += 6; },
      s => { s.lifeGiver.life.ledger.find(e => e.command.type === 'REVOKE_CONSENT')!.command = { type: 'CONSENT', caseId: WITHDRAWN }; },
      s => { s.lifeGiver.life.ledger.splice(1, 1); },
      s => { s.lifeGiver.life.ledger.find(e => e.command.type === 'VISIT_HOME')!.guestBefore.stamina--; },
      s => { s.lifeGiver.life.cases[WITHDRAWN].attempts[0]!.consent = 'GRANTED'; },
      s => { s.lifeGiver.life.cases[BLOCKED].attempts[0]!.shelterApplied = true; },
      s => { s.lifeGiver.life.playerTravelMetres++; }, s => { s.lifeGiver.life.clockSeconds++; },
      s => { s.lifeGiver.life.token.custodian = 'PLAYER'; }, s => { s.progression.mastery[SHELTER] = 8; },
      s => { (guest(s) as unknown as { bodyId: string }).bodyId = 'SM3-LUMEN-COPY'; },
      s => { s.lifeGiver.life.initialGuestAnchor!.stamina--; },
      s => { (s.lifeGiver.life as unknown as Record<string, unknown>).partner = structuredClone(guest(s)); },
    ];
    for (const [i, change] of corruptions.entries()) { const bad = structuredClone(original); change(bad); expect(validateLifeGiverLife(bad), `corruption ${i}`).toBe(false); expect(() => assertValidSliceState(bad), `corruption ${i}`).toThrow(); }
  });
});
