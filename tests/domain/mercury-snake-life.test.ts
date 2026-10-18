import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { validateMercurySnakeState } from '../../src/domain/mercury-snake/index.js';
import { blockMercurySnakeLife, mercurySnakeLifeActions, mercurySnakeLifeClosed, mercurySnakeLifeMasteryGains, getMercurySnakeCurrentSite, hasMercurySnakeLifeLock,
  projectMercurySnakeLife, validateMercurySnakeActivityCommand, validateMercurySnakeCurrentSite, validateMercurySnakeLifeState, type MercurySnakeCaseId } from '../../src/domain/mercury-snake/life.js';
import { MERCURY_SNAKE_ABILITY_IDS } from '../../src/domain/mercury-snake/types.js';
import { ms, oldWheelRoots, originalFateProphet, promoted, promotedForLife, ready, rejectMercurySnake } from './mercury-snake-directed-helper.js';
const [RESTART, ANCHOR] = MERCURY_SNAKE_ABILITY_IDS;
const attempt = (s: SliceState, id: MercurySnakeCaseId) => s.mercurySnake.life.cases[id].attempts[0]!;
const piece = (s: SliceState, id: MercurySnakeCaseId) => s.mercurySnake.life.pieces.find(n => n.caseId === id)!;
function start(s: SliceState, id: MercurySnakeCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = ready(s, { ap: 2, cash: method === 'ABILITY' ? 20 : 0, mind: method === 'ABILITY' ? 8 : 0, spirituality: method === 'ABILITY' ? 16 : 0 });
  s = ms(s, { type: 'OBSERVE', caseId: id }); s = ms(s, { type: 'CONSENT', caseId: id, permission: 'OWNER' });
  if (method === 'ABILITY') s = ms(s, { type: 'CONSENT', caseId: id, permission: 'ABILITY' });
  s = ms(s, { type: 'INVITE', caseId: id });
  return ms(s, method === 'ABILITY' ? { type: 'PREPARE', caseId: id, method } : { type: 'START_ORDINARY', caseId: id });
}
function reach(s: SliceState, id: MercurySnakeCaseId): SliceState {
  for (const type of ['WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A'] as const) s = ms(s, { type, caseId: id });
  if (attempt(s, id).method === 'ABILITY') { s = ms(s, { type: 'PLACE_PIECE', caseId: id }); s = ms(s, { type: 'CAPTURE_MOMENT', caseId: id }); }
  return s;
}
function finish(s: SliceState, id: MercurySnakeCaseId, report = true): SliceState {
  if (s.mercurySnake.life.viewBlocked) s = ms(s, { type: 'RESTORE_VIEW', caseId: id });
  if (s.mercurySnake.life.site.cart.location === 'B') {
    if (s.mercurySnake.life.site.playerLocation === 'START') s = ms(s, { type: 'WALK_TO_A', caseId: id });
    if (s.mercurySnake.life.site.playerLocation === 'A') s = ms(s, { type: 'WALK_TO_B', caseId: id });
    s = ms(s, { type: 'PUSH_BACK', caseId: id });
  }
  if (s.mercurySnake.life.site.parcel.location === 'B') {
    if (s.mercurySnake.life.site.playerLocation === 'A') s = ms(s, { type: 'WALK_TO_B', caseId: id });
    s = ms(s, { type: 'RETURN_PARCEL', caseId: id });
  }
  if (s.mercurySnake.life.site.playerLocation === 'B') s = ms(s, { type: 'RETURN_TO_A', caseId: id });
  s = ms(s, { type: 'RETURN_OBJECT', caseId: id });
  if (piece(s, id)?.location === 'STAND') s = ms(s, { type: 'TAKE_PIECE', caseId: id });
  s = ms(s, { type: 'RETURN_TO_ENTRY', caseId: id });
  if (piece(s, id)) s = ms(s, { type: 'RETURN_PIECE', caseId: id });
  s = ms(s, { type: 'LEAVE', caseId: id });
  return report ? ms(ready(s), { type: 'REPORT', caseId: id }) : s;
}
function ordinary(s: SliceState, id: MercurySnakeCaseId): SliceState {
  s = reach(start(s, id, 'ORDINARY'), id); s = ms(s, { type: 'RELEASE_CART', caseId: id }); return finish(s, id);
}
function anchorReady(kind: 'ANCHOR' | 'ANCHOR_FAIL' = 'ANCHOR'): SliceState {
  let s = ordinary(promotedForLife(kind), 'cart-return'); s = reach(start(s, 'maintained-contact'), 'maintained-contact'); return s;
}

describe('Mercury Snake finite original workshop life and exact replay', () => {
  it('starts with the exact actual703 site, original owners and real luck, never an old snapshot or invented energy', () => {
    const original = originalFateProphet(), s = promoted();
    expect(projectMercurySnakeLife(original).site).toEqual(original.chaosWalker.life);
    expect(s.mercurySnake.life.site).toEqual(original.chaosWalker.life); expect(s.mercurySnake.life.site).not.toBe(s.chaosWalker.life);
    expect(s.mercurySnake.life.site).toMatchObject({ playerLocation: 'START', playerTravelMetres: 124, guideTravelMetres: 20, clockSeconds: 713,
      guide: { id: 'GUIDE', location: 'OUTSIDE' }, volunteer: { id: 'CW3-VERA', age: 39, location: 'OUTSIDE', health: 100, mind: 100, spirituality: 100 },
      cart: { owner: 'GUIDE', location: 'A', releases: 3, returns: 3 }, parcel: { owner: 'GUIDE', massGrams: 400, sealed: true, location: 'CW3-CART' }, pouch: { owner: 'CW3-VERA' } });
    expect(s.mercurySnake.life.operation).toEqual(original.fateProphet.life.operation); expect(s.mercurySnake.life.pieces).toEqual([]); expect(s.mercurySnake.life.volunteerMindSpent).toBe(0);
    expect(s.mercurySnake.luck).toEqual(original.winner.luck); expect(s.mercurySnake.luck).toEqual({ stored: 0, accumulated: 14, spent: 14, lastAccumulateWeek: 176 });
    expect('mind' in s.mercurySnake.life.site.guide).toBe(false); expect('energy' in s.mercurySnake.life.site.volunteer).toBe(false); expect(validateMercurySnakeLifeState(s)).toBe(true);
  }, 120_000);
  it('requires current owner/ability consent and invitation before purchase, then records both adults walking8m and player12m', () => {
    let s = ms(promoted(), { type: 'OBSERVE', caseId: 'cart-return' });
    rejectMercurySnake(s, { type: 'PREPARE', caseId: 'cart-return', method: 'ABILITY' });
    for (const permission of ['OWNER', 'ABILITY'] as const) s = ms(s, { type: 'CONSENT', caseId: 'cart-return', permission });
    rejectMercurySnake(s, { type: 'PREPARE', caseId: 'cart-return', method: 'ABILITY' });
    s = ms(s, { type: 'INVITE', caseId: 'cart-return' }); expect(s.mercurySnake.life.site.guide.location).toBe('OUTSIDE'); expect(s.mercurySnake.life.site.volunteer.location).toBe('OUTSIDE');
    const before = structuredClone(s); s = ms(s, { type: 'PREPARE', caseId: 'cart-return', method: 'ABILITY' });
    expect([s.cash, s.actionsRemaining]).toEqual([before.cash - 20, before.actionsRemaining - 1]);
    expect(piece(s, 'cart-return')).toMatchObject({ id: 'MS1-PIECE-1', initialCharges: 1, charges: 1, wear: 0, returnUses: 0, anchorUses: 0, location: 'HAND' });
    s = reach(s, 'cart-return'); const walk = s.mercurySnake.life.journal.find(e => e.command.type === 'WALK_TO_A')!;
    expect(walk.moves).toEqual([
      { actorId: 'GUIDE', from: 'OUTSIDE', to: 'START', mode: 'WALK', metres: 4, seconds: 4, itemIds: [] },
      { actorId: 'GUIDE', from: 'START', to: 'A', mode: 'WALK', metres: 4, seconds: 4, itemIds: [] },
      { actorId: 'CW3-VERA', from: 'OUTSIDE', to: 'START', mode: 'WALK', metres: 4, seconds: 4, itemIds: ['CW3-POUCH', 'CW3-TAG-A', 'CW3-TAG-B'] },
      { actorId: 'CW3-VERA', from: 'START', to: 'A', mode: 'WALK', metres: 4, seconds: 4, itemIds: ['CW3-POUCH', 'CW3-TAG-A', 'CW3-TAG-B'] },
      { actorId: 'PLAYER', from: 'START', to: 'A', mode: 'WALK', metres: 4, seconds: 4, itemIds: ['MS1-PIECE-1'] },
    ]); expect(walk.elapsedSeconds).toBe(20);
    expect(attempt(s, 'cart-return')).toMatchObject({ playerTravelMetres: 12, guideTravelMetres: 8, volunteerTravelMetres: 8, volunteerMindSpent: 1 });
    expect(s.mercurySnake.life.site.volunteer.mind).toBe(99); expect(s.mercurySnake.life.site.pouch).toEqual(before.mercurySnake.life.site.pouch);
    expect(oldWheelRoots(s)).toEqual(oldWheelRoots(before)); expect(validateMercurySnakeLifeState(s)).toBe(true);
  }, 180_000);
  it('captures only two exact objects and returns only their positions, retaining8S2M, fees, clock, release history and original roots', () => {
    let s = reach(start(promotedForLife('RESTART'), 'cart-return'), 'cart-return'); const capture = structuredClone(s.mercurySnake.life.captured!), roots = oldWheelRoots(s);
    expect(Object.keys(capture).sort()).toEqual(['id', 'caseId', 'pieceId', 'capturedAt', 'expiresAt', 'conditionVersion', 'permissionVersion', 'valid', 'capturedLocation', 'cart', 'parcel', 'parcelLocation'].sort());
    expect(capture.cart).toMatchObject({ id: 'CW3-CART', owner: 'GUIDE', quantity: 1, releases: 3, returns: 3 });
    expect(capture.parcel).toEqual({ id: 'CW3-PARCEL', owner: 'GUIDE', quantity: 1, massGrams: 400, sealed: true });
    s = ms(s, { type: 'RELEASE_CART', caseId: 'cart-return' }); const before = structuredClone(s);
    expect(s.mercurySnake.life.site.cart).toMatchObject({ location: 'B', releases: 4, returns: 3 }); expect(s.mercurySnake.life.site.clockSeconds).toBe(capture.capturedAt + 4);
    s = ms(s, { type: 'LOCAL_RESTART', caseId: 'cart-return' });
    expect([s.spirituality, s.mind, s.cash, s.actionsRemaining, s.health]).toEqual([before.spirituality - 8, before.mind - 2, before.cash, before.actionsRemaining, before.health]);
    expect(s.injuries).toEqual(before.injuries); expect(s.date).toEqual(before.date); expect(s.week).toBe(before.week); expect(s.random.cursor).toBe(before.random.cursor + 1); expect(s.mercurySnake.luck).toEqual(before.mercurySnake.luck);
    expect(s.mercurySnake.life.site.clockSeconds).toBe(before.mercurySnake.life.site.clockSeconds + 1); expect(s.mercurySnake.life.site.cart).toMatchObject({ location: 'A', releases: 4, returns: 4 });
    expect(s.mercurySnake.life.site.parcel).toEqual(before.mercurySnake.life.site.parcel); expect(s.mercurySnake.life.site.disc).toEqual(before.mercurySnake.life.site.disc);
    expect(s.mercurySnake.life.journal.at(-1)!.moves).toEqual([{ actorId: 'CW3-CART', from: 'B', to: 'A', mode: 'RESTART', metres: 4, seconds: 1, itemIds: ['CW3-CART', 'CW3-PARCEL'] }]);
    expect(piece(s, 'cart-return')).toMatchObject({ charges: 0, wear: 1, returnUses: 1, anchorUses: 0 }); expect(attempt(s, 'cart-return').appliedAbilityIds).toEqual([RESTART]);
    rejectMercurySnake(s, { type: 'LOCAL_RESTART', caseId: 'cart-return' }); s = finish(s, 'cart-return'); expect(s.progression.mastery[RESTART]).toBe(8); expect(s.progression.mastery[ANCHOR]).toBe(0);
    expect(oldWheelRoots(s)).toEqual(roots); rejectMercurySnake(s, { type: 'REPORT', caseId: 'cart-return' }); assertValidSliceState(s);
  }, 180_000);
  it('failed restart retains8S4M and does not spend a charge or turn an ordinary push into mastery', () => {
    let s = reach(start(promotedForLife('RESTART_FAIL'), 'cart-return'), 'cart-return'); s = ms(s, { type: 'RELEASE_CART', caseId: 'cart-return' }); const before = structuredClone(s);
    s = ms(s, { type: 'LOCAL_RESTART', caseId: 'cart-return' }); expect([s.spirituality, s.mind]).toEqual([before.spirituality - 8, before.mind - 4]);
    expect(s.mercurySnake.life.site.cart.location).toBe('B'); expect(piece(s, 'cart-return')).toMatchObject({ charges: 1, wear: 0, returnUses: 0 });
    s = finish(s, 'cart-return'); expect(attempt(s, 'cart-return')).toMatchObject({ returnKind: 'ORDINARY', restartApplied: false, result: 'ORDINARY' });
    expect(s.progression.mastery[RESTART]).toBe(0); expect(s.progression.acting).toBe(25); expect(s.mercurySnake.life.site.clockSeconds).toBeGreaterThan(before.mercurySnake.life.site.clockSeconds);
  }, 180_000);
  it('buys two finite charges before anchoring; real20s maintenance never pays for the separately cast return', () => {
    let s = anchorReady(); const bought = s.mercurySnake.life.journal.find(e => e.command.type === 'PREPARE' && e.command.caseId === 'maintained-contact')!;
    expect(bought.paid).toMatchObject({ actions: 1, pennies: 20 }); expect(piece(s, 'maintained-contact')).toMatchObject({ initialCharges: 2, charges: 2, returnUses: 0, anchorUses: 0 });
    const before = structuredClone(s); s = ms(s, { type: 'MOMENT_ANCHOR', caseId: 'maintained-contact' });
    expect([s.spirituality, s.mind]).toEqual([before.spirituality - 8, before.mind - 2]); expect(s.mercurySnake.life.pending!.expiresAt - s.mercurySnake.life.pending!.createdAt).toBe(20);
    expect(s.mercurySnake.life.site.cart.location).toBe('A'); expect(piece(s, 'maintained-contact').charges).toBe(2); expect(attempt(s, 'maintained-contact').appliedAbilityIds).toEqual([]);
    rejectMercurySnake(s, { type: 'MOMENT_ANCHOR', caseId: 'maintained-contact' });
    s = ms(s, { type: 'WAIT_10', caseId: 'maintained-contact' }); s = ms(s, { type: 'RELEASE_CART', caseId: 'maintained-contact' }); expect(s.mercurySnake.life.captured!.expiresAt).toBeLessThan(s.mercurySnake.life.site.clockSeconds);
    expect(s.mercurySnake.life.site.cart.location).toBe('B'); s = ms(s, { type: 'LOCAL_RESTART', caseId: 'maintained-contact' });
    expect([s.spirituality, s.mind]).toEqual([before.spirituality - 16, before.mind - 4]); expect(piece(s, 'maintained-contact')).toMatchObject({ charges: 0, wear: 2, returnUses: 1, anchorUses: 1 });
    expect(attempt(s, 'maintained-contact')).toMatchObject({ restartApplied: true, anchorApplied: true }); expect(s.mercurySnake.life.pending).toBeNull();
    s = finish(s, 'maintained-contact'); expect(mercurySnakeLifeMasteryGains(s)).toEqual({ [RESTART]: 8, [ANCHOR]: 8 }); assertValidSliceState(s);
  }, 240_000);
  it('an unused successful anchor consumes no charge, grants no return and earns no mastery', () => {
    let s = anchorReady(); s = ms(s, { type: 'MOMENT_ANCHOR', caseId: 'maintained-contact' }); const clock = s.mercurySnake.life.site.clockSeconds, spirit = s.spirituality, mind = s.mind;
    s = ms(s, { type: 'WAIT_10', caseId: 'maintained-contact' }); s = ms(s, { type: 'WAIT_10', caseId: 'maintained-contact' });
    expect(s.mercurySnake.life.site.clockSeconds).toBe(clock + 20); expect(s.mercurySnake.life.pending).toBeNull(); expect(s.mercurySnake.life.captured!.valid).toBe(false);
    expect([s.spirituality, s.mind]).toEqual([spirit, mind]); s = ms(s, { type: 'RELEASE_CART', caseId: 'maintained-contact' }); s = ms(s, { type: 'LOCAL_RESTART', caseId: 'maintained-contact' });
    expect([s.spirituality, s.mind]).toEqual([spirit - 8, mind - 4]); expect(s.mercurySnake.life.site.cart.location).toBe('B'); s = finish(s, 'maintained-contact');
    expect(piece(s, 'maintained-contact')).toMatchObject({ charges: 2, wear: 0, returnUses: 0, anchorUses: 0 }); expect(mercurySnakeLifeMasteryGains(s)).toEqual({ [RESTART]: 0, [ANCHOR]: 0 });
  }, 240_000);
  it('failed anchor pays8S4M without refreshing the relation, spending a charge or granting a free return', () => {
    let s = anchorReady('ANCHOR_FAIL'); const before = structuredClone(s); s = ms(s, { type: 'MOMENT_ANCHOR', caseId: 'maintained-contact' });
    expect([s.spirituality, s.mind]).toEqual([before.spirituality - 8, before.mind - 4]); expect(s.mercurySnake.life.pending).toBeNull();
    expect(s.mercurySnake.life.captured!.expiresAt).toBe(before.mercurySnake.life.captured!.expiresAt); expect(piece(s, 'maintained-contact')).toMatchObject({ charges: 2, wear: 0 });
    s = ms(s, { type: 'RELEASE_CART', caseId: 'maintained-contact' }); expect(s.mercurySnake.life.site.cart.location).toBe('B'); s = finish(s, 'maintained-contact');
    expect(mercurySnakeLifeMasteryGains(s)).toEqual({ [RESTART]: 0, [ANCHOR]: 0 }); expect(attempt(s, 'maintained-contact').returnKind).toBe('ORDINARY');
  }, 240_000);
  it('removed original parcel stays atB through a paid failed restart; ordinary cart push cannot manufacture or carry it remotely', () => {
    let s = reach(start(promotedForLife('RESTART'), 'cart-return'), 'cart-return'); s = ms(s, { type: 'RELEASE_CART', caseId: 'cart-return' });
    for (const type of ['WALK_TO_B', 'REMOVE_PARCEL', 'RETURN_TO_A'] as const) s = ms(s, { type, caseId: 'cart-return' }); const before = structuredClone(s);
    s = ms(s, { type: 'LOCAL_RESTART', caseId: 'cart-return' }); expect(s.mercurySnake.life.site.cart.location).toBe('B'); expect(s.mercurySnake.life.site.parcel.location).toBe('B'); expect(s.mind).toBe(before.mind - 4);
    s = ms(s, { type: 'WALK_TO_B', caseId: 'cart-return' }); s = ms(s, { type: 'PUSH_BACK', caseId: 'cart-return' });
    expect(s.mercurySnake.life.site).toMatchObject({ playerLocation: 'A', cart: { location: 'A' }, parcel: { location: 'B' } });
    expect(s.mercurySnake.life.journal.at(-1)!.moves.every(move => !move.itemIds.includes('CW3-PARCEL'))).toBe(true); rejectMercurySnake(s, { type: 'RETURN_OBJECT', caseId: 'cart-return' });
    s = ms(s, { type: 'WALK_TO_B', caseId: 'cart-return' }); s = ms(s, { type: 'RETURN_PARCEL', caseId: 'cart-return' });
    expect(s.mercurySnake.life.journal.at(-1)!.moves[0]).toMatchObject({ actorId: 'CW3-PARCEL', from: 'B', to: 'A', mode: 'CARRY', metres: 4, itemIds: ['CW3-PARCEL'] });
    s = finish(s, 'cart-return'); expect(s.progression.mastery[RESTART]).toBe(0); expect(oldWheelRoots(s)).toEqual(oldWheelRoots(before));
  }, 180_000);
  it('out-of-range, occlusion, actual movement and expiry invalidate the captured relation without undoing any external fact', () => {
    for (const kind of ['RANGE', 'OCCLUDE', 'MOVE', 'EXPIRE'] as const) {
      let s = reach(start(promotedForLife('RESTART'), 'cart-return'), 'cart-return'); s = ms(s, { type: 'RELEASE_CART', caseId: 'cart-return' });
      s = ms(s, { type: kind === 'RANGE' ? 'STEP_BACK' : kind === 'OCCLUDE' ? 'OCCLUDE' : kind === 'MOVE' ? 'WALK_TO_B' : 'WAIT_10', caseId: 'cart-return' });
      const before = structuredClone(s); s = ms(s, { type: 'LOCAL_RESTART', caseId: 'cart-return' });
      expect(s.mind).toBe(before.mind - 4); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mercurySnake.life.site.cart).toMatchObject({ location: 'B', releases: 4, returns: 3 });
      expect(piece(s, 'cart-return').charges).toBe(1); expect(s.mercurySnake.life.site.clockSeconds).toBe(before.mercurySnake.life.site.clockSeconds + 1);
      s = finish(s, 'cart-return'); expect(s.progression.mastery[RESTART]).toBe(0); expect(validateMercurySnakeState(s)).toBe(true);
    }
  }, 300_000);
  it('case3 withdraws after a real anchor attempt; paid costs remain and ordinary return never awards either skill', () => {
    let s = ordinary(ordinary(promotedForLife('RESTART'), 'cart-return'), 'maintained-contact'); s = reach(start(s, 'withdrawn-contact'), 'withdrawn-contact');
    s = ms(s, { type: 'MOMENT_ANCHOR', caseId: 'withdrawn-contact' }); const before = structuredClone(s);
    s = ms(s, { type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-contact', permission: 'ABILITY' }); expect(s.mercurySnake.life.pending).toBeNull();
    rejectMercurySnake(s, { type: 'LOCAL_RESTART', caseId: 'withdrawn-contact' }); rejectMercurySnake(s, { type: 'CONSENT', caseId: 'withdrawn-contact', permission: 'ABILITY' });
    s = ms(s, { type: 'RELEASE_CART', caseId: 'withdrawn-contact' }); s = finish(s, 'withdrawn-contact'); s = ms(s, { type: 'REFLECT' });
    expect([s.spirituality, s.mind]).toEqual([before.spirituality, before.mind]); expect(piece(s, 'withdrawn-contact')).toMatchObject({ charges: 1, wear: 0, anchorUses: 0, returnUses: 0 });
    expect(mercurySnakeLifeMasteryGains(s)).toEqual({ [RESTART]: 0, [ANCHOR]: 0 }); expect(s.progression.acting).toBe(100); expect(mercurySnakeLifeClosed(s)).toBe(true);
    const projection = projectMercurySnakeLife(s); expect(projection.preferredActionId).toBeNull(); expect(projection.nextStep).toContain('三案已收尾'); expect(projection.actions.some(a => /休息/.test(a.label))).toBe(false);
  }, 240_000);
  it('permits rejection and ordinary method before any purchase, including0AP cleanup and exact real weekly settlement', () => {
    let s = promotedForLife('RESTART', { actions: 6 });
    s = ms(s, { type: 'OBSERVE', caseId: 'cart-return' }); expect(s.actionsRemaining).toBe(0);
    s = ms(s, { type: 'CONSENT', caseId: 'cart-return', permission: 'OWNER' }); s = ms(s, { type: 'WITHDRAW_CONSENT', caseId: 'cart-return', permission: 'ABILITY' }); s = ms(s, { type: 'INVITE', caseId: 'cart-return' });
    expect(blockMercurySnakeLife(s, { type: 'START_ORDINARY', caseId: 'cart-return' })).toBeNull(); s = ms(s, { type: 'START_ORDINARY', caseId: 'cart-return' });
    s = reach(s, 'cart-return'); s = ms(s, { type: 'RELEASE_CART', caseId: 'cart-return' }); const before = structuredClone(s);
    s = ms(s, { type: 'ABORT', caseId: 'cart-return' }); expect(s.mercurySnake.life.pieces).toEqual([]); expect(hasMercurySnakeLifeLock(s)).toBe(false);
    const e = s.mercurySnake.life.journal.at(-1)!; expect(e.paid).toMatchObject({ actions: 0, pennies: 0, spirituality: 0, mind: 0 });
    const finance = resolveSliceWeeklyFinance({ ...e.finance, cash: e.after.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
    expect(s.cash).toBe(finance.state.cash); expect(s.mercurySnake.life.site.clockSeconds).toBeGreaterThan(before.mercurySnake.life.site.clockSeconds); expect(getMercurySnakeCurrentSite(s).playerLocation).toBe('START');
    expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); expect(s.progression.mastery[RESTART]).toBe(0); expect(validateMercurySnakeLifeState(s)).toBe(true);
  }, 180_000);
  it('stopping after an actual supernatural return never undoes that return or refunds its finite charge', () => {
    let s = reach(start(promotedForLife('RESTART'), 'cart-return'), 'cart-return'); s = ms(s, { type: 'RELEASE_CART', caseId: 'cart-return' }); s = ms(s, { type: 'LOCAL_RESTART', caseId: 'cart-return' });
    const before = structuredClone(s); s = ms(s, { type: 'WITHDRAW_CONSENT', caseId: 'cart-return', permission: 'ABILITY' }); s = ms(s, { type: 'ABORT', caseId: 'cart-return' });
    expect(s.mercurySnake.life.site.cart).toEqual({ ...before.mercurySnake.life.site.cart, control: 'GUIDE' }); expect(piece(s, 'cart-return')).toMatchObject({ charges: 0, returnUses: 1, wear: 1 });
    expect(attempt(s, 'cart-return').restartApplied).toBe(true); expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind); s = ms(s, { type: 'REPORT', caseId: 'cart-return' }); expect(s.progression.mastery[RESTART]).toBe(8);
  }, 180_000);
  it('finishes a paid case at true0AP by ordinary motion, retaining the purchase, finite use and current finance', () => {
    let s = reach(start(promotedForLife('RESTART', { actions: 7 }), 'cart-return'), 'cart-return');
    expect(s.actionsRemaining).toBe(0); s = ms(s, { type: 'RELEASE_CART', caseId: 'cart-return' }); s = ms(s, { type: 'LOCAL_RESTART', caseId: 'cart-return' });
    const before = structuredClone(s); s = finish(s, 'cart-return', false); const e = s.mercurySnake.life.journal.at(-1)!;
    expect(e.command.type).toBe('LEAVE'); expect(e.before.actions).toBe(0); expect(e.after.actions).toBe(0); expect(e.paid.actions).toBe(0);
    expect(s.mercurySnake.life.site.playerLocation).toBe('START'); expect(hasMercurySnakeLifeLock(s)).toBe(false); expect(piece(s, 'cart-return')).toMatchObject({ location: 'RETURNED', charges: 0, wear: 1, returnUses: 1 });
    expect(attempt(s, 'cart-return')).toMatchObject({ closed: true, returned: true, restartApplied: true }); expect(s.progression.mastery[RESTART]).toBe(0);
    expect(s.mind).toBe(before.mind); expect(s.spirituality).toBe(before.spirituality); expect(s.mercurySnake.life.site.clockSeconds).toBeGreaterThan(before.mercurySnake.life.site.clockSeconds);
    const finance = resolveSliceWeeklyFinance({ ...e.finance, cash: e.after.cash, week: e.week, revision: e.revision, pulse: 'BILL', billAmount: 0 });
    expect(s.cash).toBe(finance.state.cash); expect(s.week).toBe(e.week + (finance.eventId === null && finance.state.pulse === 'ADVANCE' ? 1 : 0)); expect(validateMercurySnakeLifeState(s)).toBe(true);
  }, 180_000);
  it('optional accumulation changes the sole new-root ledger1AP once per real week, never a historical store or a free refill', () => {
    let s = promoted(); const before = structuredClone(s), roots = oldWheelRoots(s); s = ms(s, { type: 'ACCUMULATE' });
    expect(s.actionsRemaining).toBe(before.actionsRemaining - 1); expect(s.mercurySnake.luck).toEqual({ stored: 1, accumulated: 15, spent: 14, lastAccumulateWeek: s.week });
    expect(s.winner.luck).toEqual(before.winner.luck); expect(oldWheelRoots(s)).toEqual(roots); rejectMercurySnake(s, { type: 'ACCUMULATE' }); expect(validateMercurySnakeLifeState(s)).toBe(true);
    const gift = promoted(); gift.mercurySnake.luck.stored = 1; gift.mercurySnake.luck.accumulated++; expect(validateMercurySnakeLifeState(gift)).toBe(false);
  }, 120_000);
  it('replays costs, exact two-object identities, consent, deadlines, clock and finite use counters; forged history fails closed', () => {
    let s = reach(start(promotedForLife('RESTART'), 'cart-return'), 'cart-return'); s = ms(s, { type: 'RELEASE_CART', caseId: 'cart-return' }); s = ms(s, { type: 'LOCAL_RESTART', caseId: 'cart-return' });
    const changes: ((x: SliceState) => void)[] = [
      x => { x.mercurySnake.life.site.clockSeconds--; }, x => { x.mercurySnake.life.site.cart.releases--; }, x => { x.mercurySnake.life.site.parcel.quantity = 2 as 1; },
      x => { x.mercurySnake.life.site.parcel.owner = 'CW3-VERA' as 'GUIDE'; }, x => { x.mercurySnake.life.site.parcel.id = 'COPY' as 'CW3-PARCEL'; },
      x => { piece(x, 'cart-return').charges++; }, x => { piece(x, 'cart-return').returnUses = 0; }, x => { x.mercurySnake.life.captured!.expiresAt += 100; },
      x => { x.mercurySnake.life.journal.at(-1)!.after.spirituality += 8; }, x => { x.mercurySnake.life.journal.at(-1)!.moves[0]!.itemIds.pop(); },
      x => { x.mercurySnake.life.site.volunteer.mind = 100; }, x => { x.mercurySnake.life.cases['cart-return'].permission.ABILITY = 'UNASKED'; },
    ];
    for (const change of changes) { const x = structuredClone(s); change(x); expect(validateMercurySnakeLifeState(x), change.toString()).toBe(false); }
    const absent = structuredClone(s); delete (absent.mercurySnake.life.site as unknown as Record<string, unknown>).parcel; expect(validateMercurySnakeLifeState(absent)).toBe(false);
    expect(validateMercurySnakeCurrentSite(s.mercurySnake.life.site, s.mercurySnake.sourceScene!.originals)).toBe(true); expect(mercurySnakeLifeActions(s).filter(a => a.preferredAction)).toHaveLength(1);
    expect(validateMercurySnakeActivityCommand({ type: 'LOCAL_RESTART', caseId: 'cart-return', restoreHealth: true })).toBe(false); expect(validateMercurySnakeActivityCommand({ type: 'REVIVE', caseId: 'cart-return' })).toBe(false);
  }, 180_000);
});
