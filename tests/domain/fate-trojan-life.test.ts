import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateFateTrojanState } from '../../src/domain/fate-trojan/index.js';
import { blockFateTrojanLife, createFateTrojanLifeState, hasFateTrojanLifeLock, projectFateTrojanLife,
  validateFateTrojanActivityCommand, validateFateTrojanLife, validateFateTrojanSiteState } from '../../src/domain/fate-trojan/life.js';
import { promoted, beginCase, completeCase, closeCase, practiced, ft, walk, currentAttempt, rejectFT, rejectIntent, oldErrorRoots, readyForActions } from './fate-trojan-directed-helper.js';
const LINK = 'error.s2.identity-link', FATE = 'error.s2.fate-assumption';
const mastery = (s: SliceState) => [s.progression.mastery[LINK], s.progression.mastery[FATE]];
const valid = (s: SliceState) => { expect(validateFateTrojanLife(s)).toBe(true); expect(validateFateTrojanState(s)).toBe(true); assertValidSliceState(s); };

describe('Fate Trojan directed public life, exact checks and unique original resources', () => {
  it('starts with three finite new cases while retaining the genuine old people and 451-command source', () => {
    const s = promoted(), old = oldErrorRoots(s); expect(s.fateTrojan.life).toEqual(createFateTrojanLifeState());
    const next = beginCase(s, 'identity-link');
    expect(next.fateTrojan.life.site).toMatchObject({ playerLocation: 'DESK', playerTravelMetres: 14, playerEnergy: 86,
      lina: { id: 'FT2-LINA', age: 39, location: 'DESK', energy: 100 }, victor: { id: 'FT2-VICTOR', age: 43, location: 'DESK', energy: 100 },
      cabinet: { id: 'FT2-CABINET', quantity: 1, recognitionHolder: 'OWNER' }, parcel: { id: 'FT2-PARCEL', quantity: 1, location: 'CABINET' } });
    expect(next.fateTrojan.life.site.seals).toEqual([{ id: 'FT2-SEAL:identity-link', caseId: 'identity-link', ownerId: 'FT2-LINA', quantity: 1, charges: 1, location: 'PLAYER', paidPennies: 20, preparedWeek: next.week }]);
    expect(oldErrorRoots(next)).toEqual(old); valid(next);
  });
  it('requires each current adult consent before the paid preparation and keeps actual observation travel', () => {
    let s = readyForActions(promoted());
    // Begin manually so both missing-current-consent edges remain visible.
    s = ft(s, { type: 'OBSERVE', caseId: 'identity-link' });
    expect(s.fateTrojan.life.site).toMatchObject({ playerLocation: 'ENTRY', playerTravelMetres: 12, playerEnergy: 88, clockSeconds: 16 });
    rejectFT(s, { type: 'PREPARE', caseId: 'identity-link', method: 'ABILITY' });
    s = ft(s, { type: 'CONSENT_OPERATOR', caseId: 'identity-link' }); rejectFT(s, { type: 'PREPARE', caseId: 'identity-link', method: 'ABILITY' });
    s = ft(s, { type: 'CONSENT_OWNER', caseId: 'identity-link' }); const before = structuredClone(s);
    s = ft(s, { type: 'PREPARE', caseId: 'identity-link', method: 'ABILITY' });
    expect(s.cash).toBe(before.cash - 20); expect(s.actionsRemaining).toBe(before.actionsRemaining - 1); expect(s.fateTrojan.life.site.clockSeconds).toBe(before.fateTrojan.life.site.clockSeconds + 6); valid(s);
  });
  it('pays 8 spirituality for a genuine successful twenty-second identity window and takes only the original link', () => {
    const before = beginCase(promoted(), 'identity-link'), s = ft(before, { type: 'TAKE_IDENTITY', caseId: 'identity-link' }), p = s.fateTrojan.life.site;
    expect(currentAttempt(s)).toMatchObject({ identityTaken: true, identityUsed: false, window: 'ACTIVE', appliedAbilityIds: [] });
    expect(p.link).toMatchObject({ holder: 'PLAYER', returnPending: true, windowExpiresAt: p.clockSeconds + 20 });
    expect(p.cabinet.recognitionHolder).toBe('PLAYER'); expect(projectFateTrojanLife(s).ownerCanOpenCabinet).toBe(false);
    expect(s.spirituality).toBe(before.spirituality - 8); expect(s.random.cursor).toBe(before.random.cursor + 1); expect(mastery(s)).toEqual([0, 0]);
    expect(p.victor).toEqual(before.fateTrojan.life.site.victor); expect(p.parcel).toEqual(before.fateTrojan.life.site.parcel); expect(s.character).toEqual(before.character);
    rejectFT(s, { type: 'TAKE_IDENTITY', caseId: 'identity-link' }); rejectFT(s, { type: 'OPEN_CABINET', caseId: 'identity-link' }); valid(s);
  });
  it('requires four actual opening seconds and accepts exactly four seconds remaining', () => {
    let s = ft(beginCase(promoted(), 'identity-link'), { type: 'TAKE_IDENTITY', caseId: 'identity-link' });
    for (const to of ['CABINET', 'ENTRY', 'CABINET'] as const) s = walk(s, 'identity-link', to);
    const before = structuredClone(s); expect(s.fateTrojan.life.site.link.windowExpiresAt! - s.fateTrojan.life.site.clockSeconds).toBe(4);
    s = ft(s, { type: 'OPEN_CABINET', caseId: 'identity-link' });
    expect(s.fateTrojan.life.site.clockSeconds).toBe(before.fateTrojan.life.site.clockSeconds + 4);
    expect(currentAttempt(s)).toMatchObject({ identityUsed: true, window: 'EXPIRED', appliedAbilityIds: [LINK] });
    expect(s.fateTrojan.life.site.cabinet).toMatchObject({ playerOpenings: 1, ownerOpenings: 0, open: true });
    expect(s.fateTrojan.life.site.link.returnPending).toBe(true); expect(mastery(s)).toEqual([0, 0]); valid(s);
  });
  it('rejects opening with only two seconds remaining without charging or restoring the expired obligation', () => {
    let s = ft(beginCase(promoted(), 'identity-link'), { type: 'TAKE_IDENTITY', caseId: 'identity-link' });
    s = ft(s, { type: 'WAIT_10', caseId: 'identity-link' }); s = walk(s, 'identity-link', 'ENTRY'); s = walk(s, 'identity-link', 'CABINET');
    expect(s.fateTrojan.life.site.link.windowExpiresAt! - s.fateTrojan.life.site.clockSeconds).toBe(2);
    rejectFT(s, { type: 'OPEN_CABINET', caseId: 'identity-link' });
    s = ft(s, { type: 'WAIT_10', caseId: 'identity-link' }); expect(currentAttempt(s).window).toBe('EXPIRED');
    expect(s.fateTrojan.life.site.link.returnPending).toBe(true); expect(projectFateTrojanLife(s).ownerCanOpenCabinet).toBe(false); valid(s);
  });
  it('requires a real walk back and four paid spirituality to return even after expiry and STOP', () => {
    let s = ft(beginCase(promoted(), 'identity-link'), { type: 'TAKE_IDENTITY', caseId: 'identity-link' });
    s = walk(s, 'identity-link', 'CABINET'); s = ft(s, { type: 'WAIT_10', caseId: 'identity-link' }); s = ft(s, { type: 'WAIT_10', caseId: 'identity-link' });
    s = ft(s, { type: 'STOP', caseId: 'identity-link' });
    for (const type of ['RETURN_LINK', 'RETURN_SEAL', 'LEAVE', 'CLOSE', 'WITHDRAW', 'INSPECT'] as const) rejectFT(s, { type, caseId: 'identity-link' });
    const before = structuredClone(s); s = walk(s, 'identity-link', 'DESK');
    expect(s.fateTrojan.life.site.playerTravelMetres).toBe(before.fateTrojan.life.site.playerTravelMetres + 4);
    expect(s.fateTrojan.life.site.playerEnergy).toBe(before.fateTrojan.life.site.playerEnergy - 4);
    const spirit = s.spirituality; s = ft(s, { type: 'RETURN_LINK', caseId: 'identity-link' });
    expect(s.spirituality).toBe(spirit - 4); expect(s.fateTrojan.life.site.link).toMatchObject({ holder: 'OWNER', returnPending: false, windowExpiresAt: null });
    s = closeCase(s, 'identity-link'); expect(mastery(s)).toEqual([0, 0]); expect(s.progression.acting).toBe(25); valid(s);
  });
  it('reserves return spirituality before taking the link, with no partial payment on rejection', () => {
    const s = beginCase(promoted(), 'identity-link');
    // Isolated guard input only: this altered budget is never accepted as a replayed state.
    const low = structuredClone(s); low.spirituality = 11;
    expect(blockFateTrojanLife(low, { type: 'TAKE_IDENTITY', caseId: 'identity-link' })).toMatch(/4/);
    low.spirituality = 12; expect(blockFateTrojanLife(low, { type: 'TAKE_IDENTITY', caseId: 'identity-link' })).toBeNull();
  });
  it('replays a genuine failed identity check, spends the seal and spirituality, and gains no identity mastery', () => {
    const before = beginCase(promoted('IDENTITY_FAILURE'), 'identity-link'); let s = ft(before, { type: 'TAKE_IDENTITY', caseId: 'identity-link' });
    expect(['FAILURE', 'GREAT_FAILURE']).toContain(currentAttempt(s).abilityTier); expect(s.spirituality).toBe(before.spirituality - 8);
    expect(s.fateTrojan.life.site.seals[0]!.charges).toBe(0); expect(s.fateTrojan.life.site.link.holder).toBe('OWNER');
    s = walk(s, 'identity-link', 'CABINET'); s = ft(s, { type: 'OPEN_CABINET', caseId: 'identity-link' });
    expect(s.fateTrojan.life.site.victor).toMatchObject({ location: 'DESK', energy: 92, travelMetres: 8 });
    s = closeCase(s, 'identity-link'); expect(mastery(s)).toEqual([0, 0]); expect(currentAttempt(s, 'identity-link').result).toBe('ORDINARY'); valid(s);
  });
  it('ordinary identity work uses the same owner body, full twelve seconds and no spell or invented link', () => {
    let s = beginCase(promoted(), 'identity-link', 'ORDINARY'); s = walk(s, 'identity-link', 'CABINET'); const before = structuredClone(s);
    s = ft(s, { type: 'OPEN_CABINET', caseId: 'identity-link' });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 1); expect(s.spirituality).toBe(before.spirituality); expect(s.random).toEqual(before.random);
    expect(s.fateTrojan.life.site.clockSeconds).toBe(before.fateTrojan.life.site.clockSeconds + 12);
    expect(s.fateTrojan.life.site.victor).toMatchObject({ location: 'DESK', travelMetres: 8, energy: 92 });
    expect(s.fateTrojan.life.site.cabinet).toMatchObject({ ownerOpenings: 1, playerOpenings: 0 });
    s = closeCase(s, 'identity-link'); expect(mastery(s)).toEqual([0, 0]); expect(s.fateTrojan.life.site.seals[0]!.charges).toBe(1); valid(s);
  });
  it('awards identity mastery only after true opening, physical return, inspection and report', () => {
    const s = completeCase(promoted(), 'identity-link'); expect(mastery(s)).toEqual([8, 0]);
    expect(currentAttempt(s, 'identity-link')).toMatchObject({ identityTaken: true, identityUsed: true, linkReturned: true, spiritualitySpent: 12, sealReturned: true, closed: true });
    expect(s.fateTrojan.life.site).toMatchObject({ playerLocation: 'ENTRY', playerTravelMetres: 24, playerEnergy: 76, cabinet: { open: false, recognitionHolder: 'OWNER' } }); valid(s);
  });
  it('taking fate moves neither parcel nor money nor bodily burden, and STOP cannot clear the assumed debt', () => {
    let s = beginCase(completeCase(promoted(), 'identity-link'), 'fate-assumption'); const before = structuredClone(s);
    s = ft(s, { type: 'TAKE_FATE', caseId: 'fate-assumption' });
    expect(s.fateTrojan.life.site.fate).toMatchObject({ status: 'ASSUMED', debtor: 'PLAYER', benefitRecipient: 'PLAYER', ownerRelieved: true, paidToPlayer: 0, incurredHealth: 0, incurredEnergy: 0 });
    expect(s.health).toBe(before.health); expect(s.cash).toBe(before.cash); expect(s.fateTrojan.life.site.parcel).toEqual(before.fateTrojan.life.site.parcel);
    expect(s.spirituality).toBe(before.spirituality - 8); s = ft(s, { type: 'STOP', caseId: 'fate-assumption' });
    for (const type of ['RETURN_SEAL', 'CLOSE_CABINET', 'LEAVE', 'CLOSE', 'WITHDRAW', 'INSPECT'] as const) rejectFT(s, { type, caseId: 'fate-assumption' });
    s = closeCase(s, 'fate-assumption'); expect(s.fateTrojan.life.site.fate.status).toBe('COMPLETED'); expect(mastery(s)).toEqual([8, 8]); valid(s);
  });
  it('physically carries the sole parcel eight metres and pays 5 health plus 5 burden-energy exactly once for 12 pennies', () => {
    let s = beginCase(completeCase(promoted(), 'identity-link'), 'fate-assumption'); s = ft(s, { type: 'TAKE_FATE', caseId: 'fate-assumption' });
    s = walk(s, 'fate-assumption', 'CABINET'); s = ft(s, { type: 'OPEN_CABINET', caseId: 'fate-assumption' }); const before = structuredClone(s);
    s = ft(s, { type: 'CARRY_PARCEL', caseId: 'fate-assumption' }); const p = s.fateTrojan.life.site;
    expect(s.health).toBe(before.health - 5); expect(s.cash).toBe(before.cash + 12); expect(p.playerEnergy).toBe(before.fateTrojan.life.site.playerEnergy - 13);
    expect(p.playerTravelMetres).toBe(before.fateTrojan.life.site.playerTravelMetres + 8); expect(p.clockSeconds).toBe(before.fateTrojan.life.site.clockSeconds + 8);
    expect(p.parcel).toMatchObject({ id: 'FT2-PARCEL', quantity: 1, location: 'OUTSIDE', ordinaryMetres: 8, carriedBy: 'PLAYER' });
    expect(p.fate).toMatchObject({ status: 'COMPLETED', escrowPennies: 0, paidToPlayer: 12, incurredHealth: 5, incurredEnergy: 5 });
    expect(currentAttempt(s).playerMoves.at(-1)).toEqual({ from: 'CABINET', to: 'OUTSIDE', mode: 'WALK', metres: 8, seconds: 8, parcelId: 'FT2-PARCEL' });
    rejectFT(s, { type: 'CARRY_PARCEL', caseId: 'fate-assumption' }); expect(mastery(s)).toEqual([8, 0]); s = closeCase(s, 'fate-assumption'); valid(s);
  });
  it('failed fate still pays eight spirituality and actual ordinary completion pays the same burden without fate mastery', () => {
    const first = completeCase(promoted('FATE_FAILURE'), 'identity-link'); let s = beginCase(first, 'fate-assumption');
    const before = structuredClone(s); s = ft(s, { type: 'TAKE_FATE', caseId: 'fate-assumption' });
    expect(['FAILURE', 'GREAT_FAILURE']).toContain(currentAttempt(s).abilityTier); expect(s.spirituality).toBe(before.spirituality - 8);
    expect(s.fateTrojan.life.site.fate).toMatchObject({ status: 'PENDING', debtor: 'OWNER', ownerRelieved: false });
    s = walk(s, 'fate-assumption', 'CABINET'); s = ft(s, { type: 'OPEN_CABINET', caseId: 'fate-assumption' }); s = ft(s, { type: 'CARRY_PARCEL', caseId: 'fate-assumption' });
    expect(s.health).toBe(before.health - 5); expect(s.cash).toBe(before.cash + 12); s = closeCase(s, 'fate-assumption'); expect(mastery(s)).toEqual([8, 0]); valid(s);
  });
  it('ordinary fate also uses a real action, health and energy, with no copied parcel or refilled benefit', () => {
    let s = beginCase(completeCase(promoted(), 'identity-link', 'ORDINARY'), 'fate-assumption', 'ORDINARY');
    s = walk(s, 'fate-assumption', 'CABINET'); s = ft(s, { type: 'OPEN_CABINET', caseId: 'fate-assumption' }); const before = structuredClone(s);
    s = ft(s, { type: 'CARRY_PARCEL', caseId: 'fate-assumption' }); expect(s.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(s.spirituality).toBe(before.spirituality); expect(s.random).toEqual(before.random); expect(s.health).toBe(before.health - 5); expect(s.cash).toBe(before.cash + 12);
    s = closeCase(s, 'fate-assumption'); expect(mastery(s)).toEqual([0, 0]); valid(s);
  });
  it('paid preparation survives current withdrawal, while the unused original seal returns and no spell is performed', () => {
    let s = completeCase(completeCase(promoted(), 'identity-link'), 'fate-assumption'); s = beginCase(s, 'revoked-link'); const paid = structuredClone(s);
    s = ft(s, { type: 'WITHDRAW_PERMISSION', caseId: 'revoked-link' });
    expect(currentAttempt(s)).toMatchObject({ permissionWithdrawn: true, ownerConsent: 'WITHDRAWN', abilityTier: null, appliedAbilityIds: [] });
    rejectFT(s, { type: 'TAKE_IDENTITY', caseId: 'revoked-link' }); rejectFT(s, { type: 'OPEN_CABINET', caseId: 'revoked-link' });
    s = closeCase(s, 'revoked-link'); expect(s.cash).toBe(paid.cash); expect(s.spirituality).toBe(paid.spirituality); expect(s.random).toEqual(paid.random);
    expect(s.fateTrojan.life.site.seals.at(-1)).toMatchObject({ id: 'FT2-SEAL:revoked-link', charges: 1, location: 'DESK', paidPennies: 20 }); expect(mastery(s)).toEqual([8, 8]); valid(s);
  });
  it('blocks unrelated rest, work, recovery and encounter while the original link or paid case remains open', () => {
    const s = ft(beginCase(promoted(), 'identity-link'), { type: 'TAKE_IDENTITY', caseId: 'identity-link' });
    expect(hasFateTrojanLifeLock(s)).toBe(true); expect(projectSliceState(s).recovery.locked).toBe(true);
    for (const action of ['REST', 'WORK'] as const) rejectIntent(s, { type: 'ACTION', action });
    rejectFT(s, { type: 'ENCOUNTER_TALK' }); rejectFT(s, { type: 'REFLECT' });
  });
  it('finishes three reports plus one reflection at 100 acting, with 8/8 mastery and no energy refill across cases', () => {
    const s = practiced(); expect(s.progression.acting).toBe(100); expect(mastery(s)).toEqual([8, 8]);
    expect(hasFateTrojanLifeLock(s)).toBe(false); expect(s.fateTrojan.life.site).toMatchObject({ playerLocation: 'ENTRY', playerTravelMetres: 80, playerEnergy: 15,
      cabinet: { open: false, recognitionHolder: 'OWNER', playerOpenings: 1, ownerOpenings: 1 }, victor: { energy: 92, travelMetres: 8 } });
    expect(s.fateTrojan.life.site.seals.map(x => [x.charges, x.location])).toEqual([[0, 'DESK'], [0, 'DESK'], [1, 'DESK']]);
    for (const e of s.fateTrojan.life.journal) {
      expect(e.budget.actionsBefore - e.budget.actionsAfter).toBe(e.paid.actions);
      expect(e.budget.spiritualityBefore - e.budget.spiritualityAfter).toBe(e.paid.spirituality);
      expect(e.budget.healthBefore - e.budget.healthAfter).toBe(e.paid.health);
      expect(e.budget.energyBefore - e.budget.energyAfter).toBe(e.paid.energy);
      expect(e.budget.cashAfter - e.budget.cashBefore).toBe(e.paid.cashGained - e.paid.pennies);
    }
    rejectFT(s, { type: 'REFLECT' }); rejectFT(s, { type: 'OBSERVE', caseId: 'identity-link' }); valid(s);
  });
  it('detaches every projected site, source, attempt and action without consuming a draw or mutating authoritative state', () => {
    const s = ft(beginCase(promoted(), 'identity-link'), { type: 'TAKE_IDENTITY', caseId: 'identity-link' }), before = structuredClone(s), view = projectFateTrojanLife(s);
    view.site.victor.energy = 0; view.site.link.returnPending = false; view.currentAttempt!.siteAtStart.playerEnergy = 0; view.cases[0]!.attempts[0]!.playerMoves.length = 0;
    expect(s).toEqual(before); expect(view.story).toContain('4灵性'); expect(view.environment).toContain('39岁');
  });
});

const mutations: [string, (s: SliceState) => void][] = [
  ['source actor name', s => { s.fateTrojan.life.journal.find(e => e.source)!.source!.actor.name += ' Copy'; }],
  ['source actor gender', s => { s.fateTrojan.life.journal.find(e => e.source)!.source!.actor.gender = 'OTHER'; }],
  ['source sequence', s => { Object.assign(s.fateTrojan.life.journal.find(e => e.source)!.source!.actor, { sequence: 3 }); }],
  ['source location', s => { s.fateTrojan.life.journal.find(e => e.source)!.source!.site.playerLocation = 'CABINET'; }],
  ['source knowledge', s => { s.fateTrojan.life.journal.find(e => e.source)!.source!.baseAbility++; }],
  ['source consent week', s => { s.fateTrojan.life.journal.find(e => e.source)!.source!.ownerConsentWeek--; }],
  ['same-shape actor age', s => { Object.assign(s.fateTrojan.life.site.victor, { age: 44 }); }],
  ['same-shape cabinet identity', s => { Object.assign(s.fateTrojan.life.site.cabinet, { id: 'COPY' }); }],
  ['copied parcel', s => { Object.assign(s.fateTrojan.life.site.parcel, { quantity: 2 }); }],
  ['free health payment', s => { s.fateTrojan.life.journal.find(e => e.command.type === 'CARRY_PARCEL')!.budget.healthAfter++; }],
  ['free energy burden', s => { s.fateTrojan.life.journal.find(e => e.command.type === 'CARRY_PARCEL')!.paid.energy--; }],
  ['refunded seal', s => { s.fateTrojan.life.journal.find(e => e.command.type === 'PREPARE')!.budget.cashAfter += 20; }],
  ['refunded link return', s => { s.fateTrojan.life.journal.find(e => e.command.type === 'RETURN_LINK')!.paid.spirituality = 0; }],
  ['extra escrow payment', s => { s.fateTrojan.life.site.fate.paidToPlayer = 24; }],
  ['refilled unique seal', s => { s.fateTrojan.life.site.seals[0]!.charges = 1; }],
  ['unrecorded player walk', s => { s.fateTrojan.life.site.playerTravelMetres++; }],
  ['unrecorded owner walk', s => { s.fateTrojan.life.site.victor.travelMetres++; }],
  ['free actor energy', s => { s.fateTrojan.life.site.victor.energy++; }],
  ['changed clock', s => { s.fateTrojan.life.site.clockSeconds++; }],
  ['changed check roll', s => { const c = s.fateTrojan.life.journal.find(e => e.check)!.check!; c.roll = c.roll === 1 ? 2 : 1; }],
  ['changed random cursor', s => { s.fateTrojan.life.journal.find(e => e.check)!.randomAfter!++; }],
  ['erased actual return', s => { s.fateTrojan.life.journal = s.fateTrojan.life.journal.filter(e => e.command.type !== 'RETURN_LINK'); }],
  ['duplicate receipt', s => { s.fateTrojan.life.journal.push(structuredClone(s.fateTrojan.life.journal.at(-1)!)); }],
  ['forged original attempt snapshot', s => { currentAttempt(s, 'identity-link').siteAtStart.playerEnergy++; }],
  ['withdrawal erased', s => { currentAttempt(s, 'revoked-link').permissionWithdrawn = false; }],
  ['unearned mastery', s => { s.progression.mastery[LINK]!++; }],
  ['unearned acting', s => { s.progression.acting--; }],
  ['extra live field', s => { Object.assign(s.fateTrojan.life.site, { remoteReturn: true }); }],
];
describe('Fate Trojan exact ordered life provenance', () => {
  it.each(mutations)('rejects %s', (_name, mutate) => {
    const s = practiced(); mutate(s); expect(validateFateTrojanLife(s)).toBe(false); expect(validateFateTrojanState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects stale live budgets and a future-week contact', () => {
    const s = beginCase(promoted(), 'identity-link');
    for (const key of ['cash', 'health', 'mind', 'spirituality', 'actionsRemaining', 'week'] as const) {
      const bad = structuredClone(s); bad[key]++; expect(validateFateTrojanLife(bad), key).toBe(false);
    }
  });
  it('rejects invented teleport/restore commands and extra ignored command fields', () => {
    for (const c of [null, { type: 'WALK', caseId: 'identity-link', to: 'YARD' }, { type: 'RETURN_LINK', caseId: 'identity-link', free: true },
      { type: 'RESTORE_IDENTITY', caseId: 'identity-link' }, { type: 'TAKE_FATE', caseId: 'unknown' }, { type: 'REFLECT', caseId: 'identity-link' }]) expect(validateFateTrojanActivityCommand(c)).toBe(false);
    const p = structuredClone(practiced().fateTrojan.life.site); Object.assign(p.parcel, { deliveredBy: 'COPY' }); expect(validateFateTrojanSiteState(p)).toBe(false);
  });
});
