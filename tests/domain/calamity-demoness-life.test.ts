import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateCalamityDemonessState } from '../../src/domain/calamity-demoness/index.js';
import { createCalamityDemonessLifeState, projectCalamityDemonessLife, validateCalamityDemonessActivityCommand, validateCalamityDemonessLifeState, validateCalamityDemonessSiteState } from '../../src/domain/calamity-demoness/life.js';
import { SCREEN, FLAME, beginCase, closeCase, completeCase, currentAttempt, encounterReady, cd, lifeReady, oldDemonessRoots, practiced, promoted, rejectCalamity, rejectIntent, walk } from './calamity-demoness-directed-helper.js';
const valid = (s: SliceState) => { expect(validateCalamityDemonessLifeState(s)).toBe(true); expect(validateCalamityDemonessState(s)).toBe(true); assertValidSliceState(s); };
const mastery = (s: SliceState) => [s.progression.mastery[SCREEN], s.progression.mastery[FLAME]];
function screenReady(kind: 'SUCCESS' | 'SCREEN_FAILURE' = 'SUCCESS') { return cd(walk(beginCase(lifeReady(kind), 'mirror-screen'), 'mirror-screen', 'A'), { type: 'INSTALL_PLATE', caseId: 'mirror-screen' }); }
function flamePrepared(kind: 'SUCCESS' | 'FLAME_FAILURE' = 'SUCCESS') { return beginCase(completeCase(lifeReady(kind), 'mirror-screen'), 'black-flame-channel'); }
function flameReady(kind: 'SUCCESS' | 'FLAME_FAILURE' = 'SUCCESS') {
  let s = cd(flamePrepared(kind), { type: 'MOVE_ADULTS_OUTSIDE', caseId: 'black-flame-channel' }); s = walk(s, 'black-flame-channel', 'BOX');
  s = cd(s, { type: 'INSTALL_PLATE', caseId: 'black-flame-channel' }); return cd(s, { type: 'CLOSE_BOX', caseId: 'black-flame-channel' });
}
describe('Calamity Demoness original people, paid finite life work and honest cleanup', () => {
  it('observes the exact original A/B and old source positions without copying portrait, parcel or register', () => {
    const before = lifeReady(), s = cd(before, { type: 'OBSERVE', caseId: 'mirror-screen' }), p = s.calamityDemoness.life.site, old = before.unagingDemoness.life;
    expect(promoted().calamityDemoness.life).toEqual(createCalamityDemonessLifeState());
    expect(p).toMatchObject({ siteId: 'CD2-GALLERY-ANNEX', playerLocation: 'ENTRY', playerTravelMetres: 8, playerEnergy: 92, clockSeconds: 12,
      vera: { id: 'UD3-VERA', age: 46, location: 'SOURCE_START', energy: 100, mirrorConsent: 'UNASKED' }, marcus: { id: 'UD3-MARCUS', age: 41, location: 'SOURCE_B', energy: 100, boxConsent: 'UNASKED' } });
    expect(p.mirrorA).toEqual(old.mirrorA); expect(p.mirrorB).toEqual(old.mirrorB);
    expect(p.source!.snapshot).toEqual({ siteId: old.siteId, vera: old.vera, marcus: old.marcus, mirrorA: old.mirrorA, mirrorB: old.mirrorB, playerLocation: old.playerLocation, playerTravelMetres: old.playerTravelMetres, clockSeconds: old.clockSeconds, entry: old.entry, shutter: old.shutter });
    expect(s.calamityDemoness.life.journal[0]!.inheritedScene).toEqual(p.source); expect(oldDemonessRoots(s)).toEqual(oldDemonessRoots(before));
    for (const key of ['portrait', 'parcel', 'register']) expect(p).not.toHaveProperty(key); valid(s);
  });
  it('requires actual2m/24m adult arrivals before either consent and one paid20p preparation', () => {
    const caseId = 'mirror-screen'; let s = cd(lifeReady(), { type: 'OBSERVE', caseId });
    rejectCalamity(s, { type: 'CONSENT_OWNER', caseId }); rejectCalamity(s, { type: 'CONSENT_OPERATOR', caseId });
    s = cd(s, { type: 'ARRIVE_VERA', caseId }); rejectCalamity(s, { type: 'ARRIVE_VERA', caseId }); rejectCalamity(s, { type: 'CONSENT_OWNER', caseId });
    s = cd(s, { type: 'ARRIVE_MARCUS', caseId }); rejectCalamity(s, { type: 'ARRIVE_MARCUS', caseId });
    expect(s.calamityDemoness.life.site).toMatchObject({ clockSeconds: 38, vera: { location: 'ENTRY', energy: 98, travelMetres: 2 }, marcus: { location: 'ENTRY', energy: 76, travelMetres: 24 } });
    s = cd(s, { type: 'CONSENT_OPERATOR', caseId }); rejectCalamity(s, { type: 'PREPARE', caseId, method: 'ABILITY' }); s = cd(s, { type: 'CONSENT_OWNER', caseId }); const before = structuredClone(s);
    s = cd(s, { type: 'PREPARE', caseId, method: 'ABILITY' }); expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 20, before.actionsRemaining - 1]);
    expect(s.calamityDemoness.life.site.plates[0]).toMatchObject({ id: 'CD2-PLATE-1', ownerId: 'PLAYER', status: 'PLAYER', location: 'PLAYER', charges: 1, paidPennies: 20 });
    expect(s.calamityDemoness.life.site.playerTravelMetres).toBe(8); rejectCalamity(s, { type: 'PREPARE', caseId, method: 'ABILITY' }); valid(s);
  });
  it('cannot cast remotely or without installation;6S/K20 buys only a30-second unspent window', () => {
    const caseId = 'mirror-screen', before = beginCase(lifeReady(), caseId); rejectCalamity(before, { type: 'INSTALL_PLATE', caseId }); rejectCalamity(before, { type: 'SCREEN_MIRROR', caseId });
    const ready = screenReady(), s = cd(ready, { type: 'SCREEN_MIRROR', caseId }), p = s.calamityDemoness.life.site;
    expect([s.spirituality, s.actionsRemaining, s.random.cursor]).toEqual([ready.spirituality - 6, ready.actionsRemaining - 1, ready.random.cursor + 1]);
    expect(p.screen).toEqual({ active: true, mirrorId: 'UD3-MIRROR-A', expiresAt: p.clockSeconds + 30, plateId: 'CD2-PLATE-1' });
    expect(currentAttempt(s)).toMatchObject({ window: 'ACTIVE', bufferedForce: 0, loadApplied: false, appliedAbilityIds: [] }); expect(mastery(s)).toEqual([0, 0]);
    expect(s.calamityDemoness.life.journal.at(-1)!.source).toMatchObject({ abilityId: SCREEN, cost: 6, difficulty: 20, coreStat: 'knowledge', actor: { pathwayId: 'demoness', sequence: 2 } });
    rejectCalamity(s, { type: 'SCREEN_MIRROR', caseId }); rejectIntent(s, { type: 'ACTION', action: 'REST' }); valid(s);
  });
  it('one actual load12→7 consumes the unique plate with wear5; only the subsequent report gives8', () => {
    const before = cd(screenReady(), { type: 'SCREEN_MIRROR', caseId: 'mirror-screen' }), s = cd(before, { type: 'APPLY_LOAD', caseId: 'mirror-screen' });
    expect(s.calamityDemoness.life.site.load).toMatchObject({ initialForce: 12, remainingLoads: 0, appliedLoads: 1, finalForce: 7, bufferedForce: 5 });
    expect(s.calamityDemoness.life.site.plates[0]).toMatchObject({ status: 'CONSUMED', charges: 0, wear: 5, location: 'A' });
    expect(currentAttempt(s)).toMatchObject({ window: 'APPLIED', bufferedForce: 5, appliedAbilityIds: [SCREEN] }); expect(mastery(s)).toEqual([0, 0]);
    expect(s.health).toBe(before.health); expect(s.calamityDemoness.life.site.playerEnergy).toBe(before.calamityDemoness.life.site.playerEnergy);
    rejectCalamity(s, { type: 'APPLY_LOAD', caseId: 'mirror-screen' }); const end = closeCase(s, 'mirror-screen'); expect(mastery(end)).toEqual([8, 0]); expect(end.progression.acting).toBe(25);
    expect(end.calamityDemoness.life.site.mirrorA).toEqual(before.unagingDemoness.life.mirrorA); expect(oldDemonessRoots(end)).toEqual(oldDemonessRoots(before)); valid(end);
  });
  it.each(['FAILED', 'EXPIRED'] as const)('a%s window retains6S cost and consumes the same plate plus5energy with no invented mastery', kind => {
    let s = cd(screenReady(kind === 'FAILED' ? 'SCREEN_FAILURE' : 'SUCCESS'), { type: 'SCREEN_MIRROR', caseId: 'mirror-screen' }); const spirit = s.spirituality;
    if (kind === 'EXPIRED') for (let n = 0; n < 3; n++) s = cd(s, { type: 'WAIT_10', caseId: 'mirror-screen' });
    expect(currentAttempt(s).window).toBe(kind); const energy = s.calamityDemoness.life.site.playerEnergy; s = cd(s, { type: 'APPLY_LOAD', caseId: 'mirror-screen' });
    expect(s.calamityDemoness.life.site.playerEnergy).toBe(energy - 5); expect(s.spirituality).toBe(spirit); expect(s.calamityDemoness.life.site.load).toMatchObject({ finalForce: 12, bufferedForce: 0 });
    expect(s.calamityDemoness.life.site.plates[0]).toMatchObject({ charges: 0, wear: 5 }); s = closeCase(s, 'mirror-screen'); expect(mastery(s)).toEqual([0, 0]); valid(s);
  });
  it('STOP refunds no costs, returns the unused original insert and earns no power mastery', () => {
    const active = cd(screenReady(), { type: 'SCREEN_MIRROR', caseId: 'mirror-screen' }), s = closeCase(active, 'mirror-screen');
    expect(currentAttempt(s, 'mirror-screen')).toMatchObject({ window: 'STOPPED', stopped: true, loadApplied: false, result: 'ORDINARY', appliedAbilityIds: [] });
    expect([s.cash, s.spirituality]).toEqual([active.cash, active.spirituality]); expect(s.calamityDemoness.life.site.plates[0]).toMatchObject({ status: 'RETURNED', charges: 1, wear: 0 }); expect(mastery(s)).toEqual([0, 0]); valid(s);
  });
  it('requires the one acquired fictional sealed residue, real box installation, lid and both adults outside', () => {
    const caseId = 'black-flame-channel'; let s = flamePrepared(); expect(s.calamityDemoness.life.site.residue).toMatchObject({ id: 'CD2-RESIDUE-1', quantity: 1, fictional: true, biological: false, sealed: true, origin: 'ADULT_WORKSHOP_CUSTODIAN', acquiredWithPlateId: 'CD2-PLATE-2', status: 'CONTAINED', location: 'PLAYER' });
    rejectCalamity(s, { type: 'CHANNEL_BLACK_FLAME', caseId }); s = cd(s, { type: 'MOVE_ADULTS_OUTSIDE', caseId }); s = walk(s, caseId, 'BOX'); s = cd(s, { type: 'INSTALL_PLATE', caseId });
    expect(s.calamityDemoness.life.site.box.state).toBe('OPEN'); rejectCalamity(s, { type: 'CHANNEL_BLACK_FLAME', caseId }); s = cd(s, { type: 'CLOSE_BOX', caseId });
    const before = structuredClone(s); s = cd(s, { type: 'CHANNEL_BLACK_FLAME', caseId });
    expect(s.calamityDemoness.life.site).toMatchObject({ box: { state: 'CLOSED', scorched: true, pulses: 1, pulseSeconds: 10 }, residue: { status: 'CONSUMED', location: 'BOX', sealed: true }, vera: { location: 'OUTSIDE' }, marcus: { location: 'OUTSIDE' } });
    expect(s.calamityDemoness.life.site.clockSeconds).toBe(before.calamityDemoness.life.site.clockSeconds + 10); expect(s.spirituality).toBe(before.spirituality - 6);
    expect(s.calamityDemoness.life.site.plates[1]).toMatchObject({ status: 'CONSUMED', charges: 0, scorched: true }); expect(mastery(s)).toEqual([8, 0]); rejectCalamity(s, { type: 'CHANNEL_BLACK_FLAME', caseId });
    s = closeCase(s, caseId); expect(mastery(s)).toEqual([8, 8]); expect(s.health).toBe(before.health); valid(s);
  });
  it('a paid failed flame leaves the same residue; actual collection, walk, adult return and handover are mandatory', () => {
    const caseId = 'black-flame-channel', before = flameReady('FLAME_FAILURE'); let s = cd(before, { type: 'CHANNEL_BLACK_FLAME', caseId });
    expect(currentAttempt(s).window).toBe('FAILED'); expect(s.spirituality).toBe(before.spirituality - 6); expect(s.calamityDemoness.life.site.residue).toMatchObject({ status: 'CONTAINED', location: 'BOX', sealed: true });
    rejectCalamity(s, { type: 'SEALED_HANDOVER', caseId }); rejectCalamity(s, { type: 'REMOVE_PLATE', caseId }); s = walk(s, caseId, 'ENTRY'); rejectCalamity(s, { type: 'RETURN_ADULTS', caseId }); rejectCalamity(s, { type: 'SEALED_HANDOVER', caseId });
    s = walk(s, caseId, 'BOX'); s = cd(s, { type: 'COLLECT_RESIDUE', caseId }); rejectCalamity(s, { type: 'COLLECT_RESIDUE', caseId }); s = cd(s, { type: 'REMOVE_PLATE', caseId }); s = walk(s, caseId, 'ENTRY');
    rejectCalamity(s, { type: 'SEALED_HANDOVER', caseId }); s = cd(s, { type: 'RETURN_ADULTS', caseId }); s = cd(s, { type: 'SEALED_HANDOVER', caseId }); rejectCalamity(s, { type: 'SEALED_HANDOVER', caseId });
    expect(s.calamityDemoness.life.site).toMatchObject({ residue: { id: 'CD2-RESIDUE-1', status: 'HANDED_OVER', location: 'CUSTODIAN', sealed: true }, box: { handovers: 1, pulses: 0, scorched: false } });
    s = closeCase(s, caseId); expect(mastery(s)).toEqual([8, 0]); expect(s.calamityDemoness.life.site.plates[1]).toMatchObject({ charges: 1, status: 'RETURNED', scorched: false }); valid(s);
  });
  it('ordinary load and sealed handover use paid unique items without checks or ability credit', () => {
    const before = lifeReady(); let s = completeCase(before, 'mirror-screen', 'ORDINARY'); s = completeCase(s, 'black-flame-channel', 'ORDINARY');
    expect(s.random).toEqual(before.random); expect(s.spirituality).toBe(before.spirituality); expect(s.cash).toBe(before.cash - 40); expect(mastery(s)).toEqual([0, 0]);
    expect(s.calamityDemoness.life.site.load.finalForce).toBe(12); expect(s.calamityDemoness.life.site.residue!.status).toBe('HANDED_OVER'); valid(s);
  });
  it('Vera withdraws before any cast; the ordinary8m route and real return remain independently permitted', () => {
    const caseId = 'revoked-window'; let s = beginCase(completeCase(completeCase(lifeReady(), 'mirror-screen'), 'black-flame-channel'), caseId); const before = structuredClone(s);
    s = cd(s, { type: 'WITHDRAW_PERMISSION', caseId }); expect(currentAttempt(s)).toMatchObject({ ownerConsent: 'WITHDRAWN', routeConsent: 'GRANTED', abilityTier: null });
    rejectCalamity(s, { type: 'SCREEN_MIRROR', caseId }); rejectCalamity(s, { type: 'INSTALL_PLATE', caseId }); s = cd(s, { type: 'STOP', caseId }); s = walk(s, caseId, 'A'); s = cd(s, { type: 'ORDINARY_ROUTE', caseId });
    rejectCalamity(s, { type: 'WALK', caseId, to: 'ENTRY' }); s = cd(s, { type: 'RETURN_ROUTE', caseId }); s = closeCase(s, caseId);
    expect([s.random.cursor, s.spirituality]).toEqual([before.random.cursor, before.spirituality]); expect(mastery(s)).toEqual([8, 8]); expect(s.calamityDemoness.life.site.plates[2]).toMatchObject({ status: 'RETURNED', charges: 1, wear: 0, paidPennies: 20 });
    expect(currentAttempt(s, caseId).playerMoves.filter(m => m.mode === 'ORDINARY_OUTER_ROUTE').map(m => [m.from, m.to, m.metres])).toEqual([['A', 'B', 8], ['B', 'A', 8]]); valid(s);
  });
  it('three reports25 plus reflection25 preserve finite72m/100energy and no scene reset or old-history edits', () => {
    const before = lifeReady(), s = practiced(), p = s.calamityDemoness.life.site;
    expect(s.progression.acting).toBe(100); expect(mastery(s)).toEqual([8, 8]); expect(s.cash).toBe(before.cash - 60); expect(s.spirituality).toBe(before.spirituality - 12);
    expect(p).toMatchObject({ playerTravelMetres: 72, playerEnergy: 28, playerLocation: 'ENTRY', vera: { travelMetres: 6, energy: 94 }, marcus: { travelMetres: 28, energy: 72 } });
    expect(p.plates.map(x => [x.id, x.status, x.charges, x.paidPennies])).toEqual([['CD2-PLATE-1', 'RETURNED', 0, 20], ['CD2-PLATE-2', 'RETURNED', 0, 20], ['CD2-PLATE-3', 'RETURNED', 1, 20]]);
    expect(s.calamityDemoness.life.journal.filter(e => e.command.type === 'REPORT')).toHaveLength(3); expect(oldDemonessRoots(s)).toEqual(oldDemonessRoots(before));
    rejectCalamity(s, { type: 'REFLECT' }); rejectCalamity(s, { type: 'OBSERVE', caseId: 'mirror-screen' }); valid(s);
  });
  it('reserves item-retrieval energy and provides zero-AP ordinary cancellation after preparation', () => {
    // Explicit SOURCE-ONLY current-budget boundary. This is not a persisted natural campaign.
    let s = lifeReady(); s.actionsRemaining = 3; s = beginCase(s, 'mirror-screen'); s = walk(s, 'mirror-screen', 'A'); s = cd(s, { type: 'INSTALL_PLATE', caseId: 'mirror-screen' }); s = cd(s, { type: 'SCREEN_MIRROR', caseId: 'mirror-screen' }); const cash = s.cash, spirit = s.spirituality;
    rejectCalamity(s, { type: 'SCREEN_MIRROR', caseId: 'mirror-screen' });
    let left = cd(s, { type: 'STOP', caseId: 'mirror-screen' }); left = cd(left, { type: 'REMOVE_PLATE', caseId: 'mirror-screen' }); left = walk(left, 'mirror-screen', 'ENTRY'); for (const type of ['RETURN_PLATE', 'INSPECT'] as const) left = cd(left, { type, caseId: 'mirror-screen' });
    expect([left.cash, left.spirituality, left.actionsRemaining]).toEqual([cash, spirit, 0]); left = cd(left, { type: 'WITHDRAW', caseId: 'mirror-screen' });
    // Closing the last lock may honestly settle the ordinary weekly bill and replenish weekly AP.
    expect(left.calamityDemoness.life.journal.at(-1)!.paid).toMatchObject({ actions: 0, pennies: 0, spirituality: 0 }); expect(left.cash).toBeLessThanOrEqual(cash); expect(left.spirituality).toBe(spirit); expect(mastery(left)).toEqual([0, 0]); expect(left.calamityDemoness.life.activeCase).toBeNull();
    const active = screenReady(); active.calamityDemoness.life.site.playerEnergy = 7; rejectCalamity(active, { type: 'WALK', caseId: 'mirror-screen', to: 'B' });
  });
  it('projects the later actual encounter scene while keeping the frozen life journal unchanged', () => {
    const s = encounterReady(), before = structuredClone(s), p = projectCalamityDemonessLife(s);
    const site = s.calamityDemoness.encounter.currentSite!;
    // Positive public-site contract: private provenance is retained only in the authoritative state.
    expect(p.site).toStrictEqual({
      siteId: site.siteId, introducedWeek: site.introducedWeek, introducedDate: site.introducedDate,
      clockSeconds: site.clockSeconds, playerLocation: site.playerLocation,
      playerTravelMetres: site.playerTravelMetres, playerEnergy: site.playerEnergy,
      vera: site.vera, marcus: site.marcus, mirrorA: site.mirrorA, mirrorB: site.mirrorB,
      load: site.load, box: site.box, residue: site.residue, screen: site.screen,
      plates: site.plates, actorMoves: site.actorMoves,
    });
    expect(p.site).not.toHaveProperty('source'); expect(site.source).not.toBeNull();
    expect(site.source).toStrictEqual(before.calamityDemoness.encounter.currentSite!.source);
    expect(p.site.playerLocation).toBe('YARD'); expect(s.calamityDemoness.life.site.playerLocation).toBe('ENTRY');
    p.site.playerEnergy--; p.site.mirrorA!.intact = false;
    expect(s.calamityDemoness.life.journal).toStrictEqual(before.calamityDemoness.life.journal);
    expect(s).toStrictEqual(before); rejectCalamity(s, { type: 'OBSERVE', caseId: 'mirror-screen' }); valid(s);
  });
  it.each([null, {}, { type: 'WALK', caseId: 'mirror-screen', to: 'YARD' }, { type: 'SCREEN_MIRROR', caseId: 'mirror-screen', free: true }, { type: 'TELEPORT_ANYWHERE', caseId: 'revoked-window' }, { type: 'REFLECT', caseId: 'mirror-screen' }])('rejects malformed/unavailable life command%#', command => { expect(validateCalamityDemonessActivityCommand(command)).toBe(false); rejectCalamity(lifeReady(), command); });
});
const mutations: [string, (s: SliceState) => void][] = [
  ['free energy', s => { s.calamityDemoness.life.site.playerEnergy++; }], ['erased walking', s => { s.calamityDemoness.life.site.playerTravelMetres--; }],
  ['duplicate residue', s => { Object.assign(s.calamityDemoness.life.site.residue!, { quantity: 2 }); }], ['box scorch removed', s => { s.calamityDemoness.life.site.box.scorched = false; }],
  ['plate refilled', s => { s.calamityDemoness.life.site.plates[0]!.charges = 1; }], ['free plate', s => { s.calamityDemoness.life.site.plates[0]!.paidPennies = 0; }],
  ['load reused', s => { s.calamityDemoness.life.site.load.remainingLoads = 1; }], ['different original mirror', s => { Object.assign(s.calamityDemoness.life.site.source!.snapshot.mirrorA, { id: 'COPY' }); }],
  ['historical location forged', s => { Object.assign(s.calamityDemoness.life.site.source!.snapshot.marcus, { location: 'START' }); }], ['adult travel erased', s => { s.calamityDemoness.life.site.marcus!.travelMetres = 0; }],
  ['adult current consent reset', s => { s.calamityDemoness.life.site.vera!.mirrorConsent = 'GRANTED'; }], ['arrival removed', s => { s.calamityDemoness.life.journal = s.calamityDemoness.life.journal.filter(e => e.command.type !== 'ARRIVE_MARCUS'); }],
  ['payment removed', s => { s.calamityDemoness.life.journal.find(e => e.command.type === 'PREPARE')!.paid.pennies = 0; }],
  ['check cursor changed', s => { s.calamityDemoness.life.journal.find(e => e.check)!.randomBefore!++; }], ['check replaced', s => { s.calamityDemoness.life.journal.find(e => e.check)!.check!.roll++; }],
  ['check source wrong difficulty', s => { Object.assign(s.calamityDemoness.life.journal.find(e => e.source)!.source!, { difficulty: 1 }); }],
  ['withdrawal reward', s => { s.calamityDemoness.life.cases['revoked-window'].attempts[0]!.appliedAbilityIds.push(SCREEN); }],
  ['closed snapshot changed', s => { s.calamityDemoness.life.cases['mirror-screen'].attempts[0]!.siteAtClose!.clockSeconds++; }],
  ['invented current mastery', s => { s.progression.mastery[FLAME]++; }], ['unknown journal key', s => { Object.assign(s.calamityDemoness.life.journal[0]!, { free: true }); }],
];
describe('Calamity Demoness strict life evidence', () => {
  it.each(mutations)('rejects%s', (_name, mutate) => { const s = practiced(); expect(validateCalamityDemonessLifeState(s)).toBe(true); mutate(s); expect(validateCalamityDemonessLifeState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow(); });
  it('cannot repair an original broken mirror by editing both current and copied source to agree', () => {
    const s = practiced(); s.calamityDemoness.life.site.mirrorA!.intact = false; s.calamityDemoness.life.site.source!.snapshot.mirrorA.intact = false;
    expect(validateCalamityDemonessSiteState(s.calamityDemoness.life.site)).toBe(true); expect(validateCalamityDemonessLifeState(s)).toBe(false); expect(s.unagingDemoness.life.mirrorA.intact).toBe(true);
  });
});
