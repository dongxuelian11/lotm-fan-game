import { describe, expect, it } from 'vitest';
import { assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateGloryState } from '../../src/domain/glory/index.js';
import { blockGloryLife, createGloryLifeState, hasGloryLifeLock, projectGloryLife, validateGloryActivityCommand, validateGloryLifeState, validateGlorySiteState } from '../../src/domain/glory/life.js';
import { ARMOR, BEARING, beginCase, closeCase, completeCase, currentAttempt, encounterReady, gl, lifeReady, oldWarriorRoots, practiced, promoted, rejectGlory, rejectIntent, walk } from './glory-directed-helper.js';

const valid = (s: SliceState) => { expect(validateGloryLifeState(s)).toBe(true); expect(validateGloryState(s)).toBe(true); assertValidSliceState(s); };
const mastery = (s: SliceState) => [s.progression.mastery[ARMOR], s.progression.mastery[BEARING]];
function armorReady(kind: 'SUCCESS' | 'ARMOR_FAILURE' = 'SUCCESS') {
  return gl(beginCase(lifeReady(kind), 'armor-temper'), { type: 'WEAR_PAD', caseId: 'armor-temper' });
}
function guardReady(kind: 'SUCCESS' | 'GUARD_FAILURE' = 'SUCCESS') {
  return beginCase(completeCase(lifeReady(kind), 'armor-temper'), 'close-guard');
}

describe('Glory real same-armor practice, finite originals and current adult consent', () => {
  it('starts with empty new evidence and introduces the original65-integrity armor only through actual observation', () => {
    const s = promoted(), original = structuredClone(s.silverKnight.life.armor); expect(s.glory.life).toEqual(createGloryLifeState());
    const next = gl(lifeReady(), { type: 'OBSERVE', caseId: 'armor-temper' });
    expect(next.glory.life.site).toMatchObject({ siteId: 'GL2-REPAIR-ROOM', playerLocation: 'ENTRY', playerTravelMetres: 4, playerEnergy: 96, clockSeconds: 8,
      celia: { id: 'GL2-CELIA', age: 41, alive: true, location: 'BENCH', energy: 100 }, evan: { id: 'GL2-EVAN', age: 36, alive: true, location: 'BENCH', energy: 100 },
      armor: original, armorWorn: false, armorSource: { root: 'silverKnight.life.armor', promotionWeek: s.silverKnight.promotionWeek, actor: 'PLAYER', at: 'ENTRY', snapshot: original } });
    expect(next.glory.life.journal[0]!.inheritedArmor).toEqual(next.glory.life.site.armorSource); expect(next.silverKnight.life.armor).toEqual(original); valid(next);
  });
  it('requires both current consents, charges20+1AP, and walks two actual metres to prepare', () => {
    let s = gl(lifeReady(), { type: 'OBSERVE', caseId: 'armor-temper' });
    rejectGlory(s, { type: 'PREPARE', caseId: 'armor-temper', method: 'ABILITY' });
    s = gl(s, { type: 'CONSENT_OPERATOR', caseId: 'armor-temper' }); rejectGlory(s, { type: 'PREPARE', caseId: 'armor-temper', method: 'ABILITY' });
    s = gl(s, { type: 'CONSENT_OWNER', caseId: 'armor-temper' }); const before = structuredClone(s);
    s = gl(s, { type: 'PREPARE', caseId: 'armor-temper', method: 'ABILITY' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 20, before.actionsRemaining - 1]);
    expect(s.glory.life.site).toMatchObject({ playerLocation: 'BENCH', playerTravelMetres: 6, playerEnergy: 94, clockSeconds: 18, pads: { remaining: 2, consumed: 0, worn: false } });
    expect(s.glory.life.site.plates).toEqual([{ id: 'GL2-PLATE:armor-temper', caseId: 'armor-temper', ownerId: 'PLAYER', quantity: 1, charges: 1, location: 'PLAYER', paidPennies: 20, preparedWeek: s.week }]);
    expect(currentAttempt(s).playerMoves).toEqual([{ from: 'ENTRY', to: 'BENCH', mode: 'WALK', metres: 2, seconds: 2, actorId: 'PLAYER' }]); valid(s);
  });
  it('spends6S/K20 for a30-second window only after dressing the same armor and actual pads', () => {
    const ready = beginCase(lifeReady(), 'armor-temper'); rejectGlory(ready, { type: 'TEMPER_ARMOR', caseId: 'armor-temper' });
    const dressed = gl(ready, { type: 'WEAR_PAD', caseId: 'armor-temper' }), s = gl(dressed, { type: 'TEMPER_ARMOR', caseId: 'armor-temper' });
    expect(s.glory.life.site).toMatchObject({ armor: { id: 'SK3-LIFE-ARMOR', integrity: 65 }, armorWorn: true, pads: { worn: true, location: 'PLAYER', remaining: 2 }, temper: { active: true, expiresAt: s.glory.life.site.clockSeconds + 30 } });
    expect(s.spirituality).toBe(dressed.spirituality - 6); expect(s.actionsRemaining).toBe(dressed.actionsRemaining - 1); expect(s.random.cursor).toBe(dressed.random.cursor + 1);
    expect(s.glory.life.journal.at(-1)!.source).toMatchObject({ abilityId: ARMOR, cost: 6, difficulty: 20, coreStat: 'knowledge', actor: { gender: 'FEMALE', sequence: 2 } });
    expect(currentAttempt(s)).toMatchObject({ window: 'ACTIVE', armorWear: 0, loadApplied: false, appliedAbilityIds: [] }); expect(mastery(s)).toEqual([0, 0]);
    rejectGlory(s, { type: 'TEMPER_ARMOR', caseId: 'armor-temper' }); rejectGlory(s, { type: 'WALK', caseId: 'armor-temper', to: 'BRIDGE' }); valid(s);
  });
  it('one real load consumes one of two pads and wears the same armor65→60 even on successful protection', () => {
    const before = gl(armorReady(), { type: 'TEMPER_ARMOR', caseId: 'armor-temper' }), old = oldWarriorRoots(before), s = gl(before, { type: 'APPLY_LOAD', caseId: 'armor-temper' });
    expect(currentAttempt(s)).toMatchObject({ window: 'APPLIED', armorWear: 5, loadApplied: true, appliedAbilityIds: [ARMOR] });
    expect(s.glory.life.site).toMatchObject({ armor: { id: 'SK3-LIFE-ARMOR', integrity: 60 }, pads: { remaining: 1, consumed: 1 }, load: { remainingLoads: 0, appliedLoads: 1 }, temper: { active: false, expiresAt: null } });
    expect(s.silverKnight.life.armor.integrity).toBe(65); expect(oldWarriorRoots(s)).toEqual(old); expect(mastery(s)).toEqual([0, 0]);
    rejectGlory(s, { type: 'APPLY_LOAD', caseId: 'armor-temper' }); rejectGlory(s, { type: 'WEAR_PAD', caseId: 'armor-temper' });
    const closed = closeCase(s, 'armor-temper'); expect(mastery(closed)).toEqual([8, 0]); expect(closed.progression.acting).toBe(25);
    expect(closed.glory.life.site).toMatchObject({ armor: { integrity: 60 }, armorWorn: false, pads: { remaining: 1, consumed: 1, worn: false, location: 'BENCH' } }); valid(closed);
  });
  it('paid failed armor preparation retains6S cost and ordinary load consumes a pad without invented mastery', () => {
    const before = armorReady('ARMOR_FAILURE'), failed = gl(before, { type: 'TEMPER_ARMOR', caseId: 'armor-temper' });
    expect(currentAttempt(failed).window).toBe('FAILED'); expect(failed.spirituality).toBe(before.spirituality - 6);
    const loaded = gl(failed, { type: 'APPLY_LOAD', caseId: 'armor-temper' }), s = closeCase(loaded, 'armor-temper');
    expect(s.glory.life.site.armor!.integrity).toBe(65); expect(s.glory.life.site.pads).toMatchObject({ remaining: 1, consumed: 1 });
    expect(s.glory.life.cases['armor-temper'].result).toBe('ORDINARY'); expect(mastery(s)).toEqual([0, 0]); expect(s.progression.acting).toBe(25); valid(s);
  });
  it('armor expiration at30 seconds and STOP preserve costs, original integrity and the ordinary padded route', () => {
    let s = gl(armorReady(), { type: 'TEMPER_ARMOR', caseId: 'armor-temper' }); const spirit = s.spirituality;
    for (let n = 0; n < 3; n++) s = gl(s, { type: 'WAIT_10', caseId: 'armor-temper' });
    expect(currentAttempt(s).window).toBe('EXPIRED'); expect(s.glory.life.site.temper.active).toBe(false); expect(s.spirituality).toBe(spirit);
    s = gl(s, { type: 'APPLY_LOAD', caseId: 'armor-temper' }); expect(currentAttempt(s).armorWear).toBe(0); s = closeCase(s, 'armor-temper'); expect(mastery(s)).toEqual([0, 0]); valid(s);
    const active = gl(armorReady(), { type: 'TEMPER_ARMOR', caseId: 'armor-temper' }), stopped = gl(active, { type: 'STOP', caseId: 'armor-temper' });
    expect(currentAttempt(stopped).window).toBe('STOPPED'); expect(stopped.spirituality).toBe(active.spirituality); expect(stopped.glory.life.site.armor!.integrity).toBe(65); valid(closeCase(stopped, 'armor-temper'));
  });
  it('allows ordinary padded work with no cast, no spirit cost, no refill and no ability reward', () => {
    const before = lifeReady(), s = completeCase(before, 'armor-temper', 'ORDINARY');
    expect(s.spirituality).toBe(before.spirituality); expect(s.glory.life.site.armor!.integrity).toBe(65); expect(s.glory.life.site.pads).toMatchObject({ remaining: 1, consumed: 1 });
    expect(currentAttempt(s, 'armor-temper')).toMatchObject({ method: 'ORDINARY', result: 'ORDINARY', abilityTier: null, armorWear: 0, spiritualitySpent: 0 }); expect(mastery(s)).toEqual([0, 0]); valid(s);
  });
  it('preparing one nearby consenting adult does not move either body or pay the later5H burden', () => {
    const before = guardReady(), s = gl(before, { type: 'RAISE_GUARD', caseId: 'close-guard' });
    expect(currentAttempt(s)).toMatchObject({ actorId: 'GL2-EVAN', window: 'ACTIVE', healthSpent: 0, crossed: false, appliedAbilityIds: [] });
    expect(s.glory.life.site.guard).toMatchObject({ active: true, actorId: 'GL2-EVAN', sharedHealth: 0, sharedEnergy: 0 });
    expect(s.health).toBe(before.health); expect(s.spirituality).toBe(before.spirituality - 6);
    expect(s.glory.life.site.evan).toEqual(before.glory.life.site.evan); expect(s.glory.life.site.celia).toEqual(before.glory.life.site.celia);
    expect(s.glory.life.site.playerLocation).toBe('BENCH'); expect(s.glory.life.site.playerEnergy).toBe(before.glory.life.site.playerEnergy);
    expect(s.glory.life.journal.at(-1)!.source).toMatchObject({ abilityId: BEARING, difficulty: 20, coreStat: 'will', cost: 6 }); valid(s);
  });
  it('actual6m crossing alone pays player5H+extra5energy and moves the one original adult on his own feet', () => {
    const before = gl(guardReady(), { type: 'RAISE_GUARD', caseId: 'close-guard' }), p = before.glory.life.site;
    const s = gl(before, { type: 'CROSS_BRIDGE', caseId: 'close-guard' }), a = currentAttempt(s), q = s.glory.life.site;
    expect(s.health).toBe(before.health - 5); expect(s.spirituality).toBe(before.spirituality); expect(s.actionsRemaining).toBe(before.actionsRemaining);
    expect(q).toMatchObject({ playerLocation: 'BRIDGE', playerEnergy: p.playerEnergy - 11, playerTravelMetres: p.playerTravelMetres + 6, clockSeconds: p.clockSeconds + 6,
      evan: { id: 'GL2-EVAN', location: 'BRIDGE', energy: p.evan.energy - 6, travelMetres: p.evan.travelMetres + 6 }, guard: { active: false, actorId: null, sharedHealth: 5, sharedEnergy: 5 } });
    expect(q.celia).toEqual(p.celia); expect(a).toMatchObject({ crossed: true, crossingMethod: 'BRIDGE', healthSpent: 5, appliedAbilityIds: [BEARING] });
    expect(a.actorMoves).toEqual([{ from: 'BENCH', to: 'BRIDGE', mode: 'BRIDGE', metres: 6, seconds: 6, actorId: 'GL2-EVAN' }]);
    expect(mastery(s)).toEqual([8, 0]); rejectGlory(s, { type: 'CROSS_BRIDGE', caseId: 'close-guard' }); rejectGlory(s, { type: 'WALK', caseId: 'close-guard', to: 'ENTRY' });
    const returned = gl(s, { type: 'RETURN_ACTOR', caseId: 'close-guard' });
    expect(returned.glory.life.site.evan).toMatchObject({ location: 'BENCH', energy: p.evan.energy - 14, travelMetres: p.evan.travelMetres + 14 });
    expect(returned.glory.life.site.playerEnergy).toBe(p.playerEnergy - 19); expect(returned.health).toBe(s.health);
    const closed = closeCase(returned, 'close-guard'); expect(mastery(closed)).toEqual([8, 8]); valid(closed);
  });
  it('failed close guard spends6S but takes no5H and leaves the actual8m ordinary sidepath open', () => {
    const before = guardReady('GUARD_FAILURE'), failed = gl(before, { type: 'RAISE_GUARD', caseId: 'close-guard' });
    expect(currentAttempt(failed).window).toBe('FAILED'); expect(failed.health).toBe(before.health); expect(failed.spirituality).toBe(before.spirituality - 6);
    rejectGlory(failed, { type: 'CROSS_BRIDGE', caseId: 'close-guard' }); const crossed = gl(failed, { type: 'ORDINARY_CROSS', caseId: 'close-guard' });
    expect(crossed.health).toBe(before.health); expect(crossed.glory.life.site.playerEnergy).toBe(failed.glory.life.site.playerEnergy - 8);
    expect(currentAttempt(crossed)).toMatchObject({ crossingMethod: 'SIDE_PATH', healthSpent: 0, appliedAbilityIds: [] });
    const s = closeCase(crossed, 'close-guard'); expect(mastery(s)).toEqual([8, 0]); expect(s.glory.life.site.evan).toMatchObject({ location: 'BENCH', energy: 84, travelMetres: 16 }); valid(s);
  });
  it('expires close guard after30 seconds without paying unperformed health or moving a remote actor', () => {
    let s = gl(guardReady(), { type: 'RAISE_GUARD', caseId: 'close-guard' }); const h = s.health, actor = structuredClone(s.glory.life.site.evan);
    for (let n = 0; n < 3; n++) s = gl(s, { type: 'WAIT_10', caseId: 'close-guard' });
    expect(currentAttempt(s).window).toBe('EXPIRED'); expect(s.health).toBe(h); expect(s.glory.life.site.evan).toEqual(actor); rejectGlory(s, { type: 'CROSS_BRIDGE', caseId: 'close-guard' });
    s = gl(s, { type: 'ORDINARY_CROSS', caseId: 'close-guard' }); valid(closeCase(s, 'close-guard'));
  });
  it('revocation before any cast preserves separate ordinary-route consent and returns the same paid unused plate', () => {
    const previous = completeCase(completeCase(lifeReady(), 'armor-temper'), 'close-guard'); let s = beginCase(previous, 'revoked-crossing'); const paid = structuredClone(s);
    rejectGlory(s, { type: 'ORDINARY_CROSS', caseId: 'revoked-crossing' }); s = gl(s, { type: 'WITHDRAW_PERMISSION', caseId: 'revoked-crossing' });
    expect(currentAttempt(s)).toMatchObject({ permissionWithdrawn: true, ownerConsent: 'WITHDRAWN', routeConsent: 'GRANTED', abilityTier: null });
    rejectGlory(s, { type: 'RAISE_GUARD', caseId: 'revoked-crossing' }); rejectGlory(s, { type: 'ORDINARY_CROSS', caseId: 'revoked-crossing' });
    s = gl(s, { type: 'STOP', caseId: 'revoked-crossing' }); s = gl(s, { type: 'ORDINARY_CROSS', caseId: 'revoked-crossing' });
    expect(s.glory.life.site.celia).toMatchObject({ id: 'GL2-CELIA', location: 'BRIDGE', energy: 92, travelMetres: 8 }); expect(s.glory.life.site.evan).toEqual(paid.glory.life.site.evan);
    s = closeCase(s, 'revoked-crossing'); expect(currentAttempt(s, 'revoked-crossing')).toMatchObject({ result: 'ORDINARY', healthSpent: 0, spiritualitySpent: 0, appliedAbilityIds: [], actorReturned: true, plateReturned: true });
    expect(s.glory.life.site.plates.at(-1)).toMatchObject({ id: 'GL2-PLATE:revoked-crossing', charges: 1, location: 'BENCH', paidPennies: 20 });
    expect([s.cash, s.spirituality, s.health]).toEqual([paid.cash, paid.spirituality, paid.health]); expect(mastery(s)).toEqual([8, 8]); valid(s);
  });
  it('all cases retain one finite100-energy ledger, three20p costs, one consumed pad and same armor60', () => {
    const before = lifeReady(), s = practiced(), p = s.glory.life.site;
    expect(p).toMatchObject({ playerLocation: 'ENTRY', playerTravelMetres: 54, playerEnergy: 41, armor: { integrity: 60 },
      pads: { remaining: 1, consumed: 1, location: 'BENCH' }, celia: { energy: 84, travelMetres: 16 }, evan: { energy: 86, travelMetres: 14 }, bridge: { crossings: 1, ordinaryCrossings: 1 } });
    expect([s.cash, s.spirituality, s.health]).toEqual([before.cash - 60, before.spirituality - 12, before.health - 5]);
    expect(s.progression.acting).toBe(100); expect(mastery(s)).toEqual([8, 8]); expect(p.plates.map(x => x.charges)).toEqual([0, 0, 1]);
    expect(oldWarriorRoots(s)).toEqual(oldWarriorRoots(before)); expect(hasGloryLifeLock(s)).toBe(false);
    for (const caseId of ['armor-temper', 'close-guard', 'revoked-crossing'] as const) { rejectGlory(s, { type: 'OBSERVE', caseId }); rejectGlory(s, { type: 'REPORT', caseId }); }
    rejectGlory(s, { type: 'REFLECT' }); valid(s);
  });
  it('ordinary-only cases retain real cost/travel and grant100 acting with zero mastery', () => {
    let s = lifeReady(); for (const id of ['armor-temper', 'close-guard', 'revoked-crossing'] as const) s = completeCase(s, id, id === 'revoked-crossing' ? 'ABILITY' : 'ORDINARY');
    s = gl(s, { type: 'REFLECT' }); expect(mastery(s)).toEqual([0, 0]); expect(s.progression.acting).toBe(100); expect(s.glory.life.site.armor!.integrity).toBe(65);
    expect(s.glory.life.site).toMatchObject({ playerTravelMetres: 56, playerEnergy: 44, bridge: { crossings: 0, ordinaryCrossings: 2 } }); valid(s);
  });
  it('real repeated walking can exhaust elective movement while preserving a safe two-metre ordinary return', () => {
    let s = beginCase(lifeReady(), 'armor-temper', 'ORDINARY');
    // No edited resources: each twelve-metre loop is two actual six-metre walks with a plate-return reserve.
    for (let n = 0; n < 7; n++) { s = walk(s, 'armor-temper', 'BRIDGE'); s = walk(s, 'armor-temper', 'BENCH'); }
    expect(s.glory.life.site.playerEnergy).toBe(10); rejectGlory(s, { type: 'WALK', caseId: 'armor-temper', to: 'BRIDGE' });
    s = closeCase(s, 'armor-temper'); expect(s.glory.life.site.playerEnergy).toBe(8); expect(s.glory.life.site.playerLocation).toBe('ENTRY'); valid(s);
  });
  it('locks ordinary work, rest and other cases during contact and never reopens life after yard approach', () => {
    const s = armorReady(); expect(hasGloryLifeLock(s)).toBe(true);
    rejectIntent(s, { type: 'ACTION', action: 'WORK' }); rejectIntent(s, { type: 'ACTION', action: 'REST' }); rejectGlory(s, { type: 'OBSERVE', caseId: 'close-guard' });
    const yard = encounterReady(); expect(projectGloryLife(yard).actions).toEqual([]); rejectGlory(yard, { type: 'OBSERVE', caseId: 'armor-temper' }); valid(yard);
  });
  it('projects historical65 separately from the current same-ID60 and returns detached records', () => {
    const s = practiced(), before = structuredClone(s), p = projectGloryLife(s);
    expect(p).toMatchObject({ historicalArmorIntegrity: 65, currentArmorIntegrity: 60, armorIdentity: 'SK3-LIFE-ARMOR' }); expect(projectSliceState(s).glory.life.currentArmorIntegrity).toBe(60);
    p.site.armor!.integrity = 100; p.cases[0]!.attempts[0]!.armorWear = 0; expect(s).toEqual(before);
  });
  it('affordability gates do not secretly refill an exhausted source-only player budget', () => {
    // Isolated gate inputs only, not persisted or asserted to be valid complete life journals.
    const s = armorReady(), before = structuredClone(s); s.spirituality = 5;
    expect(blockGloryLife(s, { type: 'TEMPER_ARMOR', caseId: 'armor-temper' })).not.toBeNull(); expect(s.spirituality).toBe(5); expect(s.glory.life).toEqual(before.glory.life);
  });
  it.each([{ type: 'WALK', caseId: 'close-guard', to: 'YARD' }, { type: 'RAISE_GUARD', caseId: 'close-guard', actorId: 'NEW-ALLY' }, { type: 'REFLECT', free: true }, { type: 'PREPARE', caseId: 'armor-temper', method: 'FREE' }])('rejects extra ownership/route fields%o', c => expect(validateGloryActivityCommand(c)).toBe(false));
});

const lifeMutations: [string, (s: SliceState) => void][] = [
  ['current armor reset100', s => { s.glory.life.site.armor!.integrity = 100; }], ['copied armor ID', s => { Object.assign(s.glory.life.site.armor!, { id: 'COPY' }); }],
  ['source armor reset100', s => { s.glory.life.site.armorSource!.snapshot.integrity = 100; }], ['source promotion week', s => { s.glory.life.site.armorSource!.promotionWeek++; }],
  ['original old armor changed', s => { s.silverKnight.life.armor.integrity--; }], ['free pad refill', s => { s.glory.life.site.pads.remaining++; }],
  ['load reused', s => { s.glory.life.site.load.remainingLoads = 1; }], ['paid plate charge restored', s => { s.glory.life.site.plates[0]!.charges = 1; }],
  ['adult teleport', s => { s.glory.life.site.evan.location = 'BRIDGE'; }], ['adult energy refill', s => { s.glory.life.site.evan.energy++; }],
  ['extra adult', s => { Object.assign(s.glory.life.site, { ally: structuredClone(s.glory.life.site.evan) }); }], ['player energy refill', s => { s.glory.life.site.playerEnergy++; }],
  ['player metres', s => { s.glory.life.site.playerTravelMetres--; }], ['clock', s => { s.glory.life.site.clockSeconds--; }],
  ['bridge personal health erased', s => { s.glory.life.cases['close-guard'].attempts[0]!.healthSpent = 0; }],
  ['actor return erased', s => { s.glory.life.cases['close-guard'].attempts[0]!.actorMoves.pop(); }], ['past consent forged', s => { s.glory.life.cases['revoked-crossing'].attempts[0]!.ownerConsent = 'GRANTED'; }],
  ['journal payment', s => { s.glory.life.journal.find(e => e.command.type === 'PREPARE')!.paid.pennies--; }],
  ['journal health refund', s => { s.glory.life.journal.find(e => e.command.type === 'CROSS_BRIDGE')!.budget.healthAfter++; }],
  ['check cursor', s => { s.glory.life.journal.find(e => e.source)!.randomBefore!++; }], ['check roll', s => { s.glory.life.journal.find(e => e.source)!.check!.roll++; }],
  ['check current gender', s => { s.glory.life.journal.find(e => e.source)!.source!.actor.gender = 'MALE'; }],
  ['check target substitution', s => { s.glory.life.journal.find(e => e.command.type === 'RAISE_GUARD')!.source!.site.evan.id = 'GL2-CELIA'; }],
  ['extra journal field', s => { Object.assign(s.glory.life.journal[0]!, { free: true }); }], ['free mastery', s => { s.progression.mastery[BEARING]!++; }],
];
describe('Glory strict same-body/source/consent/cost journal replay', () => {
  it.each(lifeMutations)('rejects %s', (_name, mutate) => {
    const s = practiced(); expect(validateGloryLifeState(s)).toBe(true); mutate(s);
    expect(validateGloryLifeState(s)).toBe(false); expect(validateGloryState(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });
  it('rejects malformed raw site shape without treating it as a fresh site', () => {
    const p = practiced().glory.life.site; expect(validateGlorySiteState(p)).toBe(true); Object.assign(p, { freeReset: true }); expect(validateGlorySiteState(p)).toBe(false);
  });
});
