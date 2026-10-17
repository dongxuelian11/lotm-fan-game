import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validatePlaneswalkerState } from '../../src/domain/planeswalker/index.js';
import { validatePlaneswalkerLife } from '../../src/domain/planeswalker/life.js';
import { validatePlaneswalkerSiteState } from '../../src/domain/planeswalker/resources.js';
import { promoted, beginCase, completeCase, practiced, pw, rejectPW, rejectIntent, oldDoorRoots } from './planeswalker-directed-helper.js';

import { actualSnapshot } from './planeswalker-fixture-helper.js';

const valid = (s: SliceState) => { expect(validatePlaneswalkerLife(s)).toBe(true); expect(validatePlaneswalkerState(s)).toBe(true); assertValidSliceState(s); };
const current = (s: SliceState) => s.planeswalker.life.cases[s.planeswalker.life.activeCase!].attempts.at(-1)!;

describe('Planeswalker conditional actual applications and shared original practice', () => {
  it('checks the already visited original endpoint, buys a new finite kit and carries the sole original parcel', () => {
    const before = promoted(), s = beginCase(before, 'symbolic-transit'), p = s.planeswalker.life.site;
    expect(p.verifiedEndpoint).toMatchObject({ planetId: 'WN3-REMOTE-WORLD', siteId: 'PW2-LAMP', coordinateId: 'PW2-LAMP-COORDINATE-REGISTER', returnMarkerId: 'PW2-LAMP-RETURN-MARKER', qualifiedWeek: before.planeswalker.ritual.sites['PW2-LAMP'].qualifiedWeek });
    expect(p).toMatchObject({ playerLocation: 'ENTRY', localPadsKnown: true, operatorId: 'PW2-MARA', operatorAge: 42,
      parcel: { id: 'PW2-PARCEL', quantity: 1, location: 'PLAYER', astralLegs: 0 }, kits: { 'symbolic-transit': { status: 'PLAYER', paidPennies: 20, protectionSeconds: 90, astralLegs: 0 } } });
    expect(oldDoorRoots(s)).toEqual(oldDoorRoots(before)); expect(s.planeswalker.ritual).toEqual(before.planeswalker.ritual); valid(s);
  }, 90_000);
  it('pays for a successful window without reporting travel or mastery until the body actually departs', () => {
    let s = beginCase(promoted(), 'symbolic-transit'); s = pw(s, { type: 'OPEN_DOOR', caseId: 'symbolic-transit' });
    const before = structuredClone(s); s = pw(s, { type: 'PERFORM', caseId: 'symbolic-transit' });
    expect(['SUCCESS', 'GREAT_SUCCESS']).toContain(current(s).abilityTier); expect(s.spirituality).toBe(before.spirituality - 8);
    expect(s.planeswalker.life.site.playerLocation).toBe('ENTRY'); expect(current(s).appliedAbilityIds).toEqual([]);
    expect(s.progression.mastery['door.s2.symbolic-transit']).toBe(0); expect(s.planeswalker.life.site.playerAstralLegs).toBe(0);
    const unspent = structuredClone(s); s = pw(s, { type: 'CLEANUP', caseId: 'symbolic-transit' }); s = pw(s, { type: 'REPORT', caseId: 'symbolic-transit' });
    expect(s.progression.mastery['door.s2.symbolic-transit']).toBe(0); expect(s.progression.acting).toBe(25);
    expect(s.planeswalker.life.site.kits['symbolic-transit'].protectionSeconds).toBe(90); expect(s.spirituality).toBe(unspent.spirituality); valid(s);
  });
  it('requires a real current marker and paid return, despite an expired outbound window or ordinary close', () => {
    let s = beginCase(promoted(), 'symbolic-transit');
    for (const type of ['OPEN_DOOR', 'PERFORM', 'DEPART'] as const) s = pw(s, { type, caseId: 'symbolic-transit' });
    expect(s.planeswalker.life.site).toMatchObject({ playerLocation: 'REMOTE', playerAstralLegs: 1, parcel: { location: 'PLAYER', astralLegs: 1 } });
    for (const type of ['CLEANUP', 'LEAVE', 'CLOSE', 'RETURN_PARCEL', 'ARCHIVE_KIT', 'OPEN_DOOR', 'RETURN_LOCAL'] as const) rejectPW(s, { type, caseId: 'symbolic-transit' });
    rejectIntent(s, { type: 'ACTION', action: 'REST' }); s = pw(s, { type: 'STOP', caseId: 'symbolic-transit' });
    expect(s.planeswalker.life.site.playerLocation).toBe('REMOTE'); s = pw(s, { type: 'READ_RETURN_MARKER', caseId: 'symbolic-transit' });
    const before = structuredClone(s); s = pw(s, { type: 'RETURN_LOCAL', caseId: 'symbolic-transit' });
    expect(s.spirituality).toBe(before.spirituality - 8); expect(s.seer.pollution).toBe(before.seer.pollution + 1);
    expect(current(s).moves.filter(m => m.mode === 'ASTRAL').map(m => [m.from, m.to, m.metres, m.originalBody, m.parcelId])).toEqual([
      ['ENTRY', 'REMOTE', null, true, 'PW2-PARCEL'], ['REMOTE', 'ENTRY', null, true, 'PW2-PARCEL'],
    ]); valid(s);
  });
  it('awards eight transit mastery only after actual outbound application, return, cleanup and report', () => {
    const before = promoted(), s = completeCase(before, 'symbolic-transit'), a = s.planeswalker.life.cases['symbolic-transit'].attempts[0]!;
    expect(a).toMatchObject({ closed: true, result: 'ABILITY', departed: true, returnedLocal: true, parcelReturned: true, kitArchived: true, spiritualitySpent: 16, penniesSpent: 20, protectionSpent: 20, playerAstralLegs: 2 });
    expect(a.appliedAbilityIds).toEqual(['door.s2.symbolic-transit']); expect(s.progression.mastery['door.s2.symbolic-transit']).toBe(8);
    expect(s.planeswalker.life.site.kits['symbolic-transit']).toMatchObject({ status: 'ARCHIVED', protectionSeconds: 70, astralLegs: 2 });
    expect(s.planeswalker.life.site.parcel).toMatchObject({ location: 'ENTRY_STAND', astralLegs: 2 });
    expect(s.planeswalker.ritual.offworldLegs).toBe(36); valid(s);
  });
  it('requires physical observation of the one original lamp and an actually open door for pattern application', () => {
    let s = beginCase(completeCase(promoted(), 'symbolic-transit'), 'pattern-reproduction');
    expect(s.planeswalker.life.site.lamp).toMatchObject({ oilRemaining: 2, shows: 1, patternKnown: true });
    rejectPW(s, { type: 'READ_PATTERN', caseId: 'pattern-reproduction' });
    s = pw(s, { type: 'PERFORM', caseId: 'pattern-reproduction' }); rejectPW(s, { type: 'APPLY_PATTERN', caseId: 'pattern-reproduction' });
    expect(s.planeswalker.life.site.screen).toMatchObject({ state: 'BLANK', applications: 0 });
    s = pw(s, { type: 'CLEANUP', caseId: 'pattern-reproduction' }); s = pw(s, { type: 'REPORT', caseId: 'pattern-reproduction' });
    expect(s.progression.mastery['door.s2.pattern-reproduction']).toBe(0); valid(s);
  });
  it('expires a successful pattern window without free renewal, application or mastery', () => {
    let s = beginCase(completeCase(promoted(), 'symbolic-transit'), 'pattern-reproduction');
    for (const type of ['OPEN_DOOR', 'PERFORM', 'WAIT_10', 'WAIT_10'] as const) s = pw(s, { type, caseId: 'pattern-reproduction' });
    expect(current(s).window).toBe('EXPIRED'); expect(s.planeswalker.life.site.effect.mode).toBe('OFF');
    rejectPW(s, { type: 'APPLY_PATTERN', caseId: 'pattern-reproduction' }); rejectPW(s, { type: 'PERFORM', caseId: 'pattern-reproduction' });
    s = pw(s, { type: 'CLEANUP', caseId: 'pattern-reproduction' }); s = pw(s, { type: 'REPORT', caseId: 'pattern-reproduction' });
    expect(s.progression.mastery['door.s2.pattern-reproduction']).toBe(0); valid(s);
  });
  it('uses the original screen for one four-second application then stops without creating material or permanent light', () => {
    const s = completeCase(completeCase(promoted(), 'symbolic-transit'), 'pattern-reproduction'), a = s.planeswalker.life.cases['pattern-reproduction'].attempts[0]!;
    expect(a).toMatchObject({ patternRead: true, patternApplied: true, result: 'ABILITY', spiritualitySpent: 7 });
    expect(a.appliedAbilityIds).toEqual(['door.s2.pattern-reproduction']); expect(s.progression.mastery['door.s2.pattern-reproduction']).toBe(8);
    expect(s.planeswalker.life.site).toMatchObject({ screen: { id: 'PW2-SCREEN', state: 'MATCHED', applications: 1 }, effect: { mode: 'OFF', expiresAt: null }, lamp: { shows: 1, oilRemaining: 2 } }); valid(s);
  });
  it('preserves the third paid kit and successful but unapplied window after current permission withdrawal', () => {
    let s = completeCase(completeCase(promoted(), 'symbolic-transit'), 'pattern-reproduction'); s = beginCase(s, 'withdrawn-transit');
    s = pw(s, { type: 'PERFORM', caseId: 'withdrawn-transit' }); const paid = structuredClone(s);
    rejectPW(s, { type: 'DEPART', caseId: 'withdrawn-transit' }); rejectPW(s, { type: 'CLEANUP', caseId: 'withdrawn-transit' });
    s = pw(s, { type: 'WITHDRAW_PERMISSION', caseId: 'withdrawn-transit' }); rejectPW(s, { type: 'DEPART', caseId: 'withdrawn-transit' });
    s = pw(s, { type: 'CLEANUP', caseId: 'withdrawn-transit' }); s = pw(s, { type: 'REPORT', caseId: 'withdrawn-transit' });
    expect(s.cash).toBeLessThanOrEqual(paid.cash); expect(s.spirituality).toBe(paid.spirituality);
    expect(s.planeswalker.life.cases['withdrawn-transit'].attempts[0]).toMatchObject({ permissionWithdrawn: true, departed: false, appliedAbilityIds: [], spiritualitySpent: 8, penniesSpent: 20 });
    expect(s.planeswalker.life.site.kits['withdrawn-transit']).toMatchObject({ status: 'ARCHIVED', protectionSeconds: 90, astralLegs: 0 });
    expect(s.progression.mastery['door.s2.symbolic-transit']).toBe(8); valid(s);
  });
  it('finishes three real reports and one reflection100 with original identities and exact8/8 mastery', () => {
    const s = practiced(); expect(s.progression.acting).toBe(100);
    expect([s.progression.mastery['door.s2.symbolic-transit'], s.progression.mastery['door.s2.pattern-reproduction']]).toEqual([8, 8]);
    expect(s.planeswalker.life.site).toMatchObject({ playerLocation: 'ENTRY', operatorLocation: 'ENTRY', operatorEnergy: 94, door: { state: 'CLOSED' }, parcel: { location: 'ENTRY_STAND' } });
    expect(Object.values(s.planeswalker.life.cases).every(c => c.status === 'RESOLVED' && !c.contactOpen)).toBe(true);
    rejectPW(s, { type: 'REFLECT' }); rejectPW(s, { type: 'OBSERVE', caseId: 'symbolic-transit' }); valid(s);
  }, 90_000);
});

const mutations: [string, (s: SliceState) => void][] = [
  ['new original parcel', s => { Object.assign(s.planeswalker.life.site.parcel, { id: 'COPY' }); }],
  ['changed operator age', s => { Object.assign(s.planeswalker.life.site, { operatorAge: 43 }); }],
  ['refilled original lamp', s => { s.planeswalker.life.site.lamp.oilRemaining = 3; }],
  ['refilled archived route suit', s => { s.planeswalker.life.site.kits['symbolic-transit'].protectionSeconds = 90; }],
  ['changed verified endpoint', s => { s.planeswalker.life.site.verifiedEndpoint!.siteId = 'UNVISITED'; }],
  ['fake astral metres', s => { s.planeswalker.life.cases['symbolic-transit'].attempts[0]!.moves.find(m => m.mode === 'ASTRAL')!.metres = 4; }],
  ['free return budget', s => { s.planeswalker.life.journal.find(e => e.command.type === 'RETURN_LOCAL')!.after.spirituality++; }],
  ['fake local lamp observation', s => { s.planeswalker.life.journal.find(e => e.command.type === 'READ_PATTERN')!.endpoint.siteId = 'OTHER'; }],
  ['rewritten original source snapshot', s => { s.planeswalker.life.journal.find(e => e.source)!.source!.site.parcel.location = 'ENTRY_STAND'; }],
  ['invented check roll', s => { const c = s.planeswalker.life.journal.find(e => e.check)!.check!; c.roll = c.roll === 1 ? 2 : 1; }],
  ['missing actual departure', s => { s.planeswalker.life.journal = s.planeswalker.life.journal.filter(e => e.command.type !== 'DEPART'); }],
  ['reward for withdrawn success', s => { s.progression.mastery['door.s2.symbolic-transit'] = 16; }],
  ['invented extra report', s => { s.progression.acting = 99; }],
  ['erased withdrawal', s => { s.planeswalker.life.cases['withdrawn-transit'].attempts[0]!.permissionWithdrawn = false; }],
  ['new operator energy', s => { s.planeswalker.life.site.operatorEnergy++; }],
];
describe('Planeswalker complete life journal reconstruction', () => {
  it.each(mutations)('rejects%s', (_name, mutate) => {
    const s = actualSnapshot('practiced'); mutate(s); expect(validatePlaneswalkerLife(s)).toBe(false); expect(validatePlaneswalkerState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects loose unknown properties even on otherwise valid current scene resources', () => {
    const s = actualSnapshot('practiced'); Object.assign(s.planeswalker.life.site, { freeReturn: true }); expect(validatePlaneswalkerSiteState(s.planeswalker.life.site)).toBe(false);
  });
});
