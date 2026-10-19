import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import { addGameDays } from '../../src/domain/game-calendar.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { createPlaneswalkerState, hasPlaneswalkerLock, projectPlaneswalker, validatePlaneswalkerState } from '../../src/domain/planeswalker/index.js';
import { PLANESWALKER_RITUAL_SITE_IDS, planeswalkerRitualQualified, validatePlaneswalkerRitual, validatePlaneswalkerRitualCommand } from '../../src/domain/planeswalker/ritual.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { peacefulStart, wandererPeacefulPath, oldDoorRoots, taught, pw, rejectPW, routePrepared, routeAway, returnAndClose, visit, freshWeek, qualificationCapture } from './planeswalker-directed-helper.js';

import { actualSnapshot } from './planeswalker-fixture-helper.js';

const activeVisit = (s: SliceState) => s.planeswalker.ritual.visits.find(v => v.id === s.planeswalker.ritual.activeVisitId)!;
const assertValid = (s: SliceState) => { expect(validatePlaneswalkerRitual(s)).toBe(true); expect(validatePlaneswalkerState(s)).toBe(true); assertValidSliceState(s); };

describe('Planeswalker real nine-place ritual from an explicitly directed S3 start', () => {
  it('migrates the exact208-command peaceful survivor without replenishing the previous failed trip', () => {
    const old = readObjectEntry<SliceState>(wandererPeacefulPath, 'final'), bytes = JSON.stringify(old), s = migrateSliceState(old);
    expect(readObjectEntry<unknown[]>(wandererPeacefulPath, 'commands')).toHaveLength(208);
    expect(readObjectEntry<{ kind: string }>(wandererPeacefulPath, 'provenance').kind).toBe('DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER');
    expect(s.planeswalker).toEqual(createPlaneswalkerState()); expect(oldDoorRoots(s)).toEqual(oldDoorRoots(old));
    expect(s).toMatchObject({ status: 'ACTIVE', week: 126, revision: 516, health: 100, mind: 100, spirituality: 120, cash: 540, actionsRemaining: 1,
      random: { seed: 'secrets-sorcerer-directed-24', cursor: 53 }, progression: { pathwayId: 'door', sequence: 3, acting: 100 } });
    expect(s.wanderer.life).toMatchObject({ suit: { protectionSeconds: 90 }, energy: { remaining: 1, spent: 1 }, packet: { location: 'REMOTE' } });
    expect(s.progression).toEqual(old.progression); expect(s.injuries).toEqual(old.injuries); expect(s.combatHistory).toEqual(old.combatHistory);
    expect(JSON.stringify(old)).toBe(bytes); assertValid(s);
  });
  it('creates nine separated original settlements, eighteen distinct adults and no earned qualification', () => {
    const s = peacefulStart(), sites = Object.values(s.planeswalker.ritual.sites);
    expect(sites.map(x => x.id)).toEqual([...PLANESWALKER_RITUAL_SITE_IDS]);
    expect(sites.map(x => x.coordinates.eastMetres)).toEqual([2000, 4000, 6000, 8000, 10000, 12000, 14000, 16000, 18000]);
    expect(new Set(sites.flatMap(x => [x.witness.id, x.reteller.id])).size).toBe(18);
    expect(sites.every(x => x.witness.age > 18 && x.reteller.age > 18 && x.witness.location === x.id && x.reteller.location === x.id)).toBe(true);
    expect(sites.every(x => x.record.entry === null && x.retelling === null && x.helpWeek === null && x.qualifiedWeek === null)).toBe(true);
    expect(planeswalkerRitualQualified(s)).toBe(false); expect(projectPlaneswalker(s).ritual.qualifiedSites).toBe(0);
  });
  it('pays for one identifiable new route kit without touching the original WN3 suit, packet or energy', () => {
    const before = taught(), s = pw(before, { type: 'PREPARE_ROUTE_KIT', siteId: 'PW2-COPPER' }), v = activeVisit(s);
    expect([s.cash, s.actionsRemaining, s.spirituality, s.random.cursor]).toEqual([before.cash - 30, before.actionsRemaining - 1, before.spirituality, before.random.cursor]);
    expect(v).toMatchObject({ purpose: 'HELP', phase: 'PREPARED', result: 'NONE', moves: [], paid: { actions: 1, pennies: 30, spirituality: 0 },
      kit: { id: 'PW2-VISIT-1-KIT', source: 'PW2-PAID-ROUTE-PROVIDER', location: 'LOCAL', suit: { protectionSeconds: 90, spentSeconds: 0 }, archivedWeek: null } });
    expect(v.kit.energy).toHaveLength(2); expect(v.kit.energy.every(x => x.status === 'UNUSED')).toBe(true);
    expect(oldDoorRoots(s)).toEqual(oldDoorRoots(before)); expect(before.planeswalker.ritual.visits).toEqual([]); assertValid(s);
  });
  it('allows paid local cancellation without refunds, refill, random checks or fabricated travel', () => {
    const prepared = routePrepared(taught()), s = pw(prepared, { type: 'CLOSE_ROUTE_KIT' }), v = s.planeswalker.ritual.visits[0]!;
    expect(v).toMatchObject({ phase: 'CLOSED', result: 'CANCELLED', moves: [], elapsedSeconds: 0, kit: { location: 'PROVIDER_ARCHIVE', archivedWeek: prepared.week } });
    expect([s.cash, s.spirituality, s.random.cursor]).toEqual([prepared.cash, prepared.spirituality, prepared.random.cursor]);
    expect(v.kit.suit.protectionSeconds).toBe(90); expect(v.kit.energy.every(x => x.status === 'UNUSED')).toBe(true);
    expect(hasPlaneswalkerLock(s)).toBe(false); rejectPW(s, { type: 'CLOSE_ROUTE_KIT' }); assertValid(s);
  });
  it('requires all three actual route checks and distinct explicit departure confirmation', () => {
    let s = pw(taught(), { type: 'PREPARE_ROUTE_KIT', siteId: 'PW2-COPPER' });
    for (const type of ['CHECK_ROUTE_COORDINATES', 'CHECK_ROUTE_PROTECTION', 'CHECK_ROUTE_RETURN'] as const) {
      rejectPW(s, { type: 'DEPART_RITUAL', confirmed: true }); s = pw(s, { type }); rejectPW(s, { type });
    }
    for (const c of [{ type: 'DEPART_RITUAL' }, { type: 'DEPART_RITUAL', confirmed: false }, { type: 'DEPART_RITUAL', confirmed: true, teleport: true }]) rejectPW(s, c);
    const after = pw(s, { type: 'DEPART_RITUAL', confirmed: true }); expect(after.planeswalker.ritual.playerLocation).toBe('PW2-COPPER'); assertValid(after);
  });
  it('moves the same body and kit out and back and separately consumes the two original energy pieces', () => {
    const before = routePrepared(taught()), away = pw(before, { type: 'DEPART_RITUAL', confirmed: true });
    expect(activeVisit(away)).toMatchObject({ phase: 'AWAY', paid: { spirituality: 8, energyPieces: 1, protectionSeconds: 10 }, kit: { location: 'PW2-COPPER', suit: { protectionSeconds: 80 } } });
    expect(away.spirituality).toBe(before.spirituality - 8); expect(away.seer.pollution).toBe(before.seer.pollution + 1);
    rejectPW(away, { type: 'RETURN_RITUAL' }); rejectPW(away, { type: 'CLOSE_ROUTE_KIT' });
    const end = returnAndClose(away), v = end.planeswalker.ritual.visits[0]!;
    expect(v.moves.map(m => [m.from, m.to, m.originalBody, m.kitId, m.seconds])).toEqual([
      ['LOCAL', 'PW2-COPPER', true, v.kit.id, 10], ['PW2-COPPER', 'LOCAL', true, v.kit.id, 10],
    ]);
    expect(v.moves[0]!.energyPieceId).not.toBe(v.moves[1]!.energyPieceId);
    expect(v.kit.energy.map(e => [e.status, e.consumedFor])).toEqual([['CONSUMED', 'OUTBOUND'], ['CONSUMED', 'RETURN']]);
    expect(v).toMatchObject({ result: 'INTERRUPTED', paid: { spirituality: 16, energyPieces: 2, protectionSeconds: 20, pollution: 2 }, kit: { suit: { protectionSeconds: 70 }, location: 'PROVIDER_ARCHIVE' } });
    expect(end.planeswalker.ritual).toMatchObject({ playerLocation: 'LOCAL', clockSeconds: 20, offworldLegs: 2, activeVisitId: null });
    expect(end.spirituality).toBe(before.spirituality - 16); expect(end.random.cursor).toBe(before.random.cursor + 1); assertValid(end);
  });
  it('records a failed outbound check at home, loses its real energy and resources, and cannot retry the same kit', () => {
    const before = routePrepared(taught('DEPARTURE_FAILURE')), failed = pw(before, { type: 'DEPART_RITUAL', confirmed: true }), v = activeVisit(failed);
    expect(v).toMatchObject({ phase: 'FAILED', departureTier: 'GREAT_FAILURE', moves: [], elapsedSeconds: 0, kit: { location: 'LOCAL', suit: { protectionSeconds: 90 } } });
    expect([failed.spirituality, failed.mind, failed.seer.pollution, failed.random.cursor]).toEqual([before.spirituality - 8, before.mind - 5, before.seer.pollution + 2, before.random.cursor + 1]);
    expect(v.kit.energy.map(x => x.status)).toEqual(['CONSUMED', 'UNUSED']); rejectPW(failed, { type: 'DEPART_RITUAL', confirmed: true });
    rejectPW(failed, { type: 'CONTACT_SETTLEMENT' }); rejectPW(failed, { type: 'RETURN_RITUAL' });
    const end = pw(failed, { type: 'CLOSE_ROUTE_KIT' }); expect(end.planeswalker.ritual.visits[0]!.result).toBe('OUTBOUND_FAILURE');
    expect(end.planeswalker.ritual.sites['PW2-COPPER'].helpWeek).toBeNull(); assertValid(end);
  });
  it('demands physical contact, changes the local original once, and does not immediately count help as legend', () => {
    let s = routeAway(taught()); rejectPW(s, { type: 'HELP_SETTLEMENT' }); rejectPW(s, { type: 'VERIFY_LEGEND' });
    s = pw(s, { type: 'CONTACT_SETTLEMENT' }); const before = structuredClone(s); s = pw(s, { type: 'HELP_SETTLEMENT' });
    const site = s.planeswalker.ritual.sites['PW2-COPPER'], v = activeVisit(s);
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 1); expect(site.object).toMatchObject({ condition: 'REPAIRED', location: site.id, changedByVisitId: v.id });
    expect(site.record.entry).toMatchObject({ visitId: v.id, witnessId: site.witness.id, objectId: site.object.id, week: s.week });
    expect(site.retelling).toBeNull(); expect(site.qualifiedWeek).toBeNull(); expect(projectPlaneswalker(s).ritual.qualifiedSites).toBe(0);
    rejectPW(s, { type: 'HELP_SETTLEMENT' }); rejectPW(s, { type: 'VERIFY_LEGEND' }); rejectPW(s, { type: 'PREPARE_PROMOTION' }); assertValid(s);
  });
  it('requires actual first return, a later real week, a second original visit and archival after local retelling', () => {
    let s = visit(taught(), 'PW2-COPPER'); const first = structuredClone(s.planeswalker.ritual.sites['PW2-COPPER']);
    rejectPW(s, { type: 'PREPARE_ROUTE_KIT', siteId: 'PW2-COPPER' }); s = freshWeek(s); s = routeAway(s);
    rejectPW(s, { type: 'VERIFY_LEGEND' }); s = pw(s, { type: 'CONTACT_SETTLEMENT' }); s = pw(s, { type: 'VERIFY_LEGEND' });
    const site = s.planeswalker.ritual.sites['PW2-COPPER'];
    expect(site.retelling).toMatchObject({ speakerId: site.reteller.id, heardFromId: site.witness.id, originalEntryId: first.record.entry!.id, originalObjectId: first.object.id });
    expect(site.record).toEqual(first.record); expect(site.object).toEqual(first.object); expect(site.qualifiedWeek).toBeNull();
    expect(projectPlaneswalker(s).ritual.qualifiedSites).toBe(0); rejectPW(s, { type: 'VERIFY_LEGEND' });
    s = pw(s, { type: 'CHECK_RITUAL_RETURN_MARKER' }); s = pw(s, { type: 'RETURN_RITUAL' });
    expect(projectPlaneswalker(s).ritual.qualifiedSites).toBe(0); s = pw(s, { type: 'CLOSE_ROUTE_KIT' });
    expect(projectPlaneswalker(s).ritual.qualifiedSites).toBe(1); expect(planeswalkerRitualQualified(s)).toBe(false);
    rejectPW(s, { type: 'PREPARE_ROUTE_KIT', siteId: 'PW2-COPPER' }); assertValid(s);
  });
  it('proves all nine places with eighteen real paid visits and thirty-six original-body legs', () => {
    const s = actualSnapshot('ritualQualified'), r = s.planeswalker.ritual;
    expect(r.visits.length).toBeGreaterThanOrEqual(18); expect(r.visits.filter(v => v.result === 'HELPED')).toHaveLength(9); expect(r.visits.filter(v => v.result === 'VERIFIED')).toHaveLength(9);
    expect(r).toMatchObject({ clockSeconds: 360, offworldLegs: 36, playerLocation: 'LOCAL', activeVisitId: null });
    const failures = r.visits.filter(v => v.result === 'OUTBOUND_FAILURE').length;
    expect(r.visits.length).toBe(18 + failures);
    expect(r.visits.reduce((n, v) => n + v.paid.pennies, 0)).toBe(540 + 30 * failures);
    expect(r.visits.reduce((n, v) => n + v.paid.spirituality, 0)).toBe(288 + 8 * failures);
    expect(r.visits.reduce((n, v) => n + v.paid.actions, 0)).toBe(36 + failures);
    expect(new Set(r.visits.flatMap(v => v.kit.energy.map(e => e.id))).size).toBe(2 * r.visits.length);
    for (const site of Object.values(r.sites)) {
      expect(site.verifiedWeek!).toBeGreaterThan(site.helpWeek!); expect(site.qualifiedWeek).toBe(site.verifiedWeek);
      expect(site.retelling!.originalEntryId).toBe(site.record.entry!.id); expect(site.retelling!.heardFromId).toBe(site.witness.id);
    }
    expect(planeswalkerRitualQualified(s)).toBe(true); expect(projectPlaneswalker(s).ritual.qualifiedSites).toBe(9); assertValid(s);
  }, 90_000);
  it('replays every directed public intent twice without mutating the source or changing its seed', () => {
    const capture = qualificationCapture(), initial = structuredClone(capture.initial); let s = initial;
    expect(initial.random.seed).toBe(peacefulStart().random.seed); expect(initial.random.cursor).toBeGreaterThanOrEqual(peacefulStart().random.cursor);
    for (const intent of capture.commands) { expect(validateSlicePayload(intent)).toBe(true); s = applySliceIntent(s, intent); }
    expect(s).toEqual(capture.final); expect(initial).toEqual(capture.initial); expect(oldDoorRoots(s)).toEqual(oldDoorRoots(initial)); assertValid(s);
  }, 90_000);
  it('projects cloned originals and current instructions without mutating authoritative state', () => {
    const s = actualSnapshot('ritualQualified'), before = structuredClone(s), view = projectPlaneswalker(s), full = projectSliceState(s);
    expect(full.planeswalker.ritual).toEqual(view.ritual); expect(view.ritual.risk).toContain('不能');
    view.ritual.sites[0]!.object.name = 'projection mutation'; view.ritual.visits[0]!.kit.suit.protectionSeconds = 999;
    expect(s).toEqual(before);
  });
  it.each([
    {}, { type: 'PREPARE_ROUTE_KIT' }, { type: 'PREPARE_ROUTE_KIT', siteId: 'WN3-REMOTE-DOCK' },
    { type: 'PREPARE_ROUTE_KIT', siteId: 'PW2-COPPER', free: true }, { type: 'HELP_SETTLEMENT', siteId: 'PW2-COPPER' },
    { type: 'DEPART_RITUAL' }, { type: 'DEPART_RITUAL', confirmed: false }, { type: 'DEPART_RITUAL', confirmed: true, originalBody: false },
    { type: 'CLOSE_ROUTE_KIT', teleport: true }, { type: 'VERIFY_LEGEND', confirmed: true },
  ])('rejects malformed or shortcut ritual command%j', command => {
    expect(validatePlaneswalkerRitualCommand(command)).toBe(false); rejectPW(taught(), command);
  });
});

const completedMutations: [string, (s: SliceState) => void][] = [
  ['provider identity', s => { s.planeswalker.ritual.provider.age++; }],
  ['missing ninth site', s => { delete (s.planeswalker.ritual.sites as Partial<typeof s.planeswalker.ritual.sites>)['PW2-STONE']; }],
  ['relabelled original object', s => { s.planeswalker.ritual.sites['PW2-COPPER'].object.name = 'replacement'; }],
  ['relocated original', s => { s.planeswalker.ritual.sites['PW2-COPPER'].object.location = 'PW2-SALT'; }],
  ['original witness identity', s => { s.planeswalker.ritual.sites['PW2-COPPER'].witness.name = 'substitute'; }],
  ['one person tells their own legend', s => { const site = s.planeswalker.ritual.sites['PW2-COPPER']; site.retelling!.speakerId = site.witness.id; }],
  ['unrelated initial record', s => { s.planeswalker.ritual.sites['PW2-COPPER'].retelling!.originalEntryId = 'OTHER-BOOK'; }],
  ['unearned record text', s => { s.planeswalker.ritual.sites['PW2-COPPER'].record.entry!.text += ' invented'; }],
  ['same-week verification', s => { const site = s.planeswalker.ritual.sites['PW2-COPPER']; site.verifiedWeek = site.helpWeek; }],
  ['unearned qualification counter', s => { s.planeswalker.ritual.sites['PW2-COPPER'].qualifiedWeek!++; }],
  ['route source coordinates', s => { s.planeswalker.ritual.sites['PW2-COPPER'].coordinates.eastMetres++; }],
  ['remote return marker', s => { s.planeswalker.ritual.sites['PW2-COPPER'].returnMarker.id = 'REPLACEMENT'; }],
  ['free suit refill', s => { s.planeswalker.ritual.visits[0]!.kit.suit.protectionSeconds = 90; }],
  ['free energy refill', s => { s.planeswalker.ritual.visits[0]!.kit.energy[0]!.status = 'UNUSED'; }],
  ['same original energy used twice', s => { const v = s.planeswalker.ritual.visits[0]!; v.moves[1]!.energyPieceId = v.moves[0]!.energyPieceId; }],
  ['body projection substituted', s => { Object.assign(s.planeswalker.ritual.visits[0]!.moves[0]!, { originalBody: false }); }],
  ['missing real return', s => { s.planeswalker.ritual.visits[0]!.moves.pop(); }],
  ['unpaid route cost', s => { s.planeswalker.ritual.visits[0]!.paid.pennies = 0; }],
  ['forged total legs', s => { s.planeswalker.ritual.offworldLegs++; }],
  ['forged total time', s => { s.planeswalker.ritual.clockSeconds++; }],
  ['not archived in original week', s => { s.planeswalker.ritual.visits[0]!.kit.archivedWeek!++; }],
  ['missing journal action', s => { s.planeswalker.ritual.journal.splice(1, 1); }],
  ['help before original resident contact', s => { const j = s.planeswalker.ritual.journal, n = j.findIndex(e => e.command.type === 'HELP_SETTLEMENT'); [j[n - 1], j[n]] = [j[n]!, j[n - 1]!]; }],
  ['free event payment', s => { s.planeswalker.ritual.journal[0]!.after.cash++; }],
  ['forged prepayment budget', s => { s.planeswalker.ritual.journal[1]!.before.spirituality--; }],
  ['journal original object evidence', s => { s.planeswalker.ritual.journal[0]!.evidence.objectId = 'OTHER'; }],
  ['journal original body evidence', s => { s.planeswalker.ritual.journal[0]!.evidence.bodyLocation = 'PW2-COPPER'; }],
  ['wrong calendar day', s => { const e = s.planeswalker.ritual.journal[1]!; e.date = addGameDays(e.date, 1); }],
  ['RNG cursor consumption', s => { s.planeswalker.ritual.journal.find(e => e.check)!.randomAfter++; }],
  ['RNG roll substitution', s => { const c = s.planeswalker.ritual.journal.find(e => e.check)!.check!; c.roll = c.roll === 1 ? 2 : 1; }],
  ['knowledge substitution', s => { s.planeswalker.ritual.journal.find(e => e.check)!.knowledge--; }],
  ['unrecorded extra property', s => { Object.assign(s.planeswalker.ritual.visits[0]!, { automaticReturn: true }); }],
];
describe('Planeswalker strict reconstruction rejects provenance and resource mutations', () => {
  it.each(completedMutations)('rejects%s rather than trusting completion counters', (_name, mutate) => {
    const s = actualSnapshot('ritualQualified'); mutate(s); expect(validatePlaneswalkerRitual(s)).toBe(false); expect(validatePlaneswalkerState(s)).toBe(false);
    expect(() => assertValidSliceState(s)).toThrow();
  });
  it.each([
    ['cash', (s: SliceState) => { s.cash++; }], ['spirit', (s: SliceState) => { s.spirituality++; }],
    ['mind', (s: SliceState) => { s.mind--; }], ['health', (s: SliceState) => { s.health--; }],
    ['actions', (s: SliceState) => { s.actionsRemaining++; }], ['pollution', (s: SliceState) => { s.seer.pollution++; }],
    ['random', (s: SliceState) => { s.random.cursor++; }], ['week', (s: SliceState) => { s.week++; s.date = addGameDays(s.date, 7); }],
  ] as const)('ties the open original-body visit to live%s', (_name, mutate) => {
    const s = routeAway(taught()); mutate(s); expect(validatePlaneswalkerRitual(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects a counter-only set of nine apparent legends without any journal or physical visit', () => {
    const s = taught();
    for (const site of Object.values(s.planeswalker.ritual.sites)) { site.helpWeek = s.week; site.verifiedWeek = s.week; site.qualifiedWeek = s.week; }
    expect(planeswalkerRitualQualified(s)).toBe(false); expect(validatePlaneswalkerRitual(s)).toBe(false); rejectPW(s, { type: 'PREPARE_PROMOTION' });
  });
});
