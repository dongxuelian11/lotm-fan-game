import { describe, expect, it } from 'vitest';
import { assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  STAR_KEY_CASE_IDS, createStarKeyLifeState, starKeyOriginalSnapshot, starKeyExpectedOriginals, starKeyLifeMasteryGains,
  hasStarKeyLifeLock, validateStarKeyActivityCommand, validateStarKeyLifeState, blockStarKeyLife, starKeyLifeActions, projectStarKeyLife,
  type StarKeyActivityCommand, type StarKeyCaseId,
} from '../../src/domain/star-key/life.js';
import { ae, ordinary, originalPlaneswalker, promoted, ready, rejectStarKey, rejectIntent } from './star-key-directed-helper.js';

// Public scenarios keep the genuine living701 source, its seed and every paid
// failure. Helpers progress only through actual public work, rest and potions.
const ENDPOINT = 'door.s1.endpoint-location', ANCHOR = 'door.s1.anchor-maintenance';
const succeeds = (v: string | null) => v === 'SUCCESS' || v === 'GREAT_SUCCESS';
const attempt = (s: SliceState, id: StarKeyCaseId = s.starKey.life.activeCase!) => s.starKey.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, ...commands: StarKeyActivityCommand[]): SliceState {
  for (const command of commands) {
    const before = structuredClone(s); s = ae(s, command);
    expect(s.starKey.life.journal.length).toBe(before.starKey.life.journal.length + 1);
    expect(validateStarKeyLifeState(s), JSON.stringify(command)).toBe(true); assertValidSliceState(s);
    expect(s.starKey.sourceHistory).toEqual(before.starKey.sourceHistory);
    expect(s.planeswalker.life.journal).toEqual(before.planeswalker.life.journal);
    expect(s.planeswalker.life.cases).toEqual(before.planeswalker.life.cases);
  }
  return s;
}
function invite(s: SliceState, caseId: StarKeyCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', lastAp = false): SliceState {
  s = act(ready(s), { type: 'OBSERVE', caseId });
  s = ready(s, { ap: 1, cash: 10, mind: 10, spirituality: 10 });
  if (lastAp) while (s.actionsRemaining > 1) s = ordinary(s);
  if (s.planeswalker.life.site.playerLocation === 'OUTSIDE') s = act(s, { type: 'WALK_TO_ROOM' });
  return act(s, { type: 'INVITE', caseId, method }, { type: 'READ_SOURCE' });
}
function enter(s: SliceState, caseId: StarKeyCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', lastAp = false): SliceState {
  return act(invite(s, caseId, method, lastAp), { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'OPERATOR' },
    { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' }, { type: 'AGREE_RETURN' }, { type: 'OPEN_DOOR' },
    { type: 'INSPECT_PADS' }, { type: 'READ_RETURN_MARKER' }, { type: 'TAKE_PARCEL' }, { type: 'WALK_NEAR' }, { type: 'OBSERVE_ENDPOINT' });
}
function finish(s: SliceState, id: StarKeyCaseId): SliceState {
  if (s.starKey.life.pending) s = act(s, { type: 'STOP_METHOD' });
  if (s.planeswalker.life.site.playerLocation !== 'ENTRY' || s.planeswalker.life.site.operatorLocation !== 'ENTRY') s = act(s, { type: 'WALK_ENTRY' });
  if (s.planeswalker.life.site.parcel.location === 'PLAYER') s = act(s, { type: 'RETURN_PARCEL' });
  if (s.planeswalker.life.site.door.state === 'OPEN') s = act(s, { type: 'CLOSE_DOOR' });
  s = act(s, { type: 'EXIT_ROOM' }, { type: 'LEAVE' });
  return act(ready(s), { type: 'REPORT', caseId: id });
}
function first(s: SliceState): SliceState {
  s = act(enter(s, 'endpoint-verification'), { type: 'WALK_VERIFY' });
  if (!attempt(s).walkVerified) s = act(s, { type: 'MANUAL_VERIFY' });
  return finish(s, 'endpoint-verification');
}
function second(s: SliceState): SliceState { return finish(act(enter(s, 'anchor-transfer'), { type: 'WALK_CARRY' }), 'anchor-transfer'); }
let firstCache: SliceState | undefined, secondCache: SliceState | undefined;
const afterFirst = () => structuredClone(firstCache ??= first(promoted()));
const afterSecond = () => structuredClone(secondCache ??= second(afterFirst()));
function expected(s: SliceState, command: 'ENDPOINT_LOCATION' | 'ANCHOR_MAINTENANCE' | 'WALK_VERIFY' | 'WALK_CARRY') {
  const endpoint = command === 'ENDPOINT_LOCATION' || command === 'WALK_VERIFY', power = command === 'ENDPOINT_LOCATION' || command === 'ANCHOR_MAINTENANCE';
  const bonus = !power && projectStarKeyLife(s).pendingUsable;
  const ability = endpoint ? 'perception' : 'knowledge', rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
  return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty: power ? 18 : 20,
    modifiers: bonus ? [{ source: endpoint ? '本次已观察端点的有限线索' : '本次已知两端的有限维系', value: 10 }] : [], roll: rng.nextInt(1, 100) });
}

describe('Star Key original PW2 finite life', () => {
  it('constructs hidden current roots and initializes the genuine ENTRY site without gifts or movement', () => {
    const fresh = createSliceRun('star-key-life-hidden', sliceDefaultCreationSelection, 'star-key-life-hidden');
    expect(fresh.starKey.life).toEqual(createStarKeyLifeState()); expect(starKeyLifeActions(fresh)).toEqual([]); assertValidSliceState(fresh);
    const old = originalPlaneswalker(), s = promoted();
    expect(s.starKey.life).toMatchObject({ sourceWeek: s.starKey.promotionWeek, playerLocation: 'ENTRY', clockSeconds: 211, playerTravelMetres: 0, maraTravelMetres: 0, journal: [] });
    expect(starKeyOriginalSnapshot(s)).toEqual({ site: old.planeswalker.life.site }); expect(starKeyExpectedOriginals(s)).toEqual(starKeyOriginalSnapshot(s));
    expect(s.planeswalker.life.site).toMatchObject({ operatorEnergy: 94, operatorConsent: 'WITHDRAWN', operatorConsentWeek: 198,
      parcel: { id: 'PW2-PARCEL', quantity: 1, location: 'ENTRY_STAND', ordinaryMetres: 8, astralLegs: 2 }, lamp: { oilRemaining: 2, shows: 1 }, screen: { state: 'BLANK', applications: 0 } });
    expect(s.wanderer.life.packet.location).toBe('REMOTE'); expect(hasStarKeyLifeLock(s)).toBe(false); expect(validateStarKeyLifeState(s)).toBe(true);
    rejectStarKey(s, { type: 'WALK_TO_ROOM' });
  }, 120_000);

  it('completes all three with real ordinary travel, one original parcel and no unearned mastery', () => {
    let s = act(enter(afterSecond(), 'withdrawn-return'), { type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' });
    s = finish(s, 'withdrawn-return'); s = act(ready(s), { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(STAR_KEY_CASE_IDS.every(id => s.starKey.life.cases[id].status === 'RESOLVED')).toBe(true);
    expect(starKeyLifeMasteryGains(s)).toEqual({ [ENDPOINT]: 0, [ANCHOR]: 0 });
    expect(s.planeswalker.life.site).toMatchObject({ playerLocation: 'OUTSIDE', operatorLocation: 'OUTSIDE', operatorEnergy: 80,
      parcel: { quantity: 1, location: 'ENTRY_STAND', astralLegs: 2 }, lamp: { oilRemaining: 2, shows: 1 }, screen: { state: 'BLANK', applications: 0 },
      effect: { mode: 'OFF', expiresAt: null }, kits: { 'symbolic-transit': { protectionSeconds: 70 }, 'withdrawn-transit': { protectionSeconds: 90 } } });
    const source = s.starKey.sourceScene!.originals.site, events = s.starKey.life.journal;
    expect(s.planeswalker.life.site.playerMetres - source.playerMetres).toBe(events.reduce((n, e) => n + e.playerWalkedMetres, 0));
    expect(s.planeswalker.life.site.operatorMetres - source.operatorMetres).toBe(events.reduce((n, e) => n + e.maraWalkedMetres, 0));
    expect(source.operatorEnergy - s.planeswalker.life.site.operatorEnergy).toBe(events.reduce((n, e) => n + e.operatorEnergySpent, 0));
    expect(s.planeswalker.life.site.parcel.ordinaryMetres - source.parcel.ordinaryMetres).toBe(events.flatMap(e => e.moves).filter(m => m.parcelId !== null).reduce((n, m) => n + m.metres, 0));
    expect(events.flatMap(e => e.moves).every(m => m.mode === 'WALK' && m.originalBody && m.seconds === m.metres)).toBe(true);
    expect(hasStarKeyLifeLock(s)).toBe(false); rejectStarKey(s, { type: 'REFLECT' });
  }, 120_000);

  it('requires fresh owner/operator/ability decisions and makes refusal a real physical exit', () => {
    let s = invite(promoted(), 'endpoint-verification', 'ABILITY');
    expect(s.planeswalker.life.site.operatorConsent).toBe('UNASKED'); expect(attempt(s).permission).toEqual({ owner: 'UNASKED', operator: 'UNASKED', ability: 'UNASKED' });
    rejectStarKey(s, { type: 'ENDPOINT_LOCATION' }); rejectStarKey(s, { type: 'TAKE_PARCEL' });
    s = act(s, { type: 'CONSENT', permission: 'OWNER' }, { type: 'DECLINE_CONSENT', permission: 'OPERATOR' });
    rejectStarKey(s, { type: 'CONSENT', permission: 'OPERATOR' }); const before = structuredClone(s);
    s = act(s, { type: 'EXIT_ROOM' }, { type: 'LEAVE' });
    expect(s.planeswalker.life.site.playerMetres - before.planeswalker.life.site.playerMetres).toBe(2);
    expect(s.planeswalker.life.site.operatorMetres - before.planeswalker.life.site.operatorMetres).toBe(2);
    expect(s.planeswalker.life.site.operatorEnergy).toBe(before.planeswalker.life.site.operatorEnergy - 1);
    expect(s.spirituality).toBe(before.spirituality); expect(s.mind).toBe(before.mind);
    s = act(ready(s), { type: 'REPORT', caseId: 'endpoint-verification' }); expect(s.progression.mastery[ENDPOINT]).toBe(0);
  }, 120_000);

  it('charges the real endpoint cast and separates its20s clue from the next real4m check', () => {
    let s = enter(promoted(), 'endpoint-verification', 'ABILITY'); const before = structuredClone(s), cast = expected(s, 'ENDPOINT_LOCATION');
    s = act(s, { type: 'ENDPOINT_LOCATION' });
    expect(s.starKey.life.journal.at(-1)!.check).toEqual(cast); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 2);
    expect(s.planeswalker.life.site.playerLocation).toBe('NEAR'); expect(s.planeswalker.life.site.parcel.location).toBe('PLAYER');
    expect(s.planeswalker.life.site.playerMetres).toBe(before.planeswalker.life.site.playerMetres);
    expect(attempt(s).endpoint.effects).toBe(0); expect(s.progression.mastery[ENDPOINT]).toBe(0); expect(attempt(s).walkVerified).toBe(false);
    if (succeeds(cast.tier)) { expect(s.starKey.life.pending!.expiresAt - s.starKey.life.pending!.createdAt).toBe(20); expect(projectStarKeyLife(s).pendingUsable).toBe(true); }
    else expect(attempt(s).endpoint).toMatchObject({ state: 'FAILED', successes: 0, effects: 0, clue: null });
    rejectStarKey(s, { type: 'ENDPOINT_LOCATION' });
    const check = expected(s, 'WALK_VERIFY'), physical = structuredClone(s.planeswalker.life.site);
    s = act(s, { type: 'WALK_VERIFY' });
    expect(s.starKey.life.journal.at(-1)!.check).toEqual(check); expect(s.planeswalker.life.site.playerMetres).toBe(physical.playerMetres + 4);
    expect(s.planeswalker.life.site.parcel.ordinaryMetres).toBe(physical.parcel.ordinaryMetres + 4); expect(s.planeswalker.life.site.playerLocation).toBe('FAR');
    const applied = succeeds(cast.tier) && succeeds(check.tier); expect(attempt(s).endpoint.effects).toBe(applied ? 1 : 0); expect(s.starKey.life.pending).toBeNull();
    rejectStarKey(s, { type: 'WALK_VERIFY' }); if (!attempt(s).walkVerified) s = act(s, { type: 'MANUAL_VERIFY' });
    s = finish(s, 'endpoint-verification'); expect(s.progression.mastery[ENDPOINT]).toBe(applied ? 8 : 0);
  }, 120_000);

  it('charges anchor maintenance and physically carries the unique original even when its independent check fails', () => {
    let s = enter(afterFirst(), 'anchor-transfer', 'ABILITY'); const before = structuredClone(s), cast = expected(s, 'ANCHOR_MAINTENANCE');
    s = act(s, { type: 'ANCHOR_MAINTENANCE' }); expect(s.spirituality).toBe(before.spirituality - 7); expect(s.mind).toBe(before.mind - 2);
    expect(s.starKey.life.journal.at(-1)!.check).toEqual(cast); expect(attempt(s).anchor.effects).toBe(0); expect(attempt(s).walkCarried).toBe(false);
    const check = expected(s, 'WALK_CARRY'), physical = structuredClone(s.planeswalker.life.site); s = act(s, { type: 'WALK_CARRY' });
    expect(s.starKey.life.journal.at(-1)!.check).toEqual(check); expect(attempt(s).walkCarried).toBe(true);
    expect(s.planeswalker.life.site).toMatchObject({ playerLocation: 'FAR', parcel: { id: 'PW2-PARCEL', quantity: 1, location: 'PLAYER' } });
    expect(s.planeswalker.life.site.playerMetres - physical.playerMetres).toBe(4); expect(s.planeswalker.life.site.parcel.ordinaryMetres - physical.parcel.ordinaryMetres).toBe(4);
    const applied = succeeds(cast.tier) && succeeds(check.tier); expect(attempt(s).anchor.effects).toBe(applied ? 1 : 0);
    rejectStarKey(s, { type: 'ANCHOR_MAINTENANCE' }); rejectStarKey(s, { type: 'WALK_CARRY' }); s = finish(s, 'anchor-transfer'); expect(s.progression.mastery[ANCHOR]).toBe(applied ? 8 : 0);
  }, 120_000);

  it('expires or hides a window without moving bodies, refunding costs or restoring the old clue', () => {
    for (const change of ['WAIT_WINDOW', 'CLOSE_DOOR'] as const) {
      let s = act(enter(promoted(), 'endpoint-verification', 'ABILITY'), { type: 'ENDPOINT_LOCATION' });
      const paid = { spirituality: s.spirituality, mind: s.mind }, physical = structuredClone(s.planeswalker.life.site), wasActive = s.starKey.life.pending !== null;
      if (change === 'WAIT_WINDOW' && !wasActive) { expect(attempt(s).endpoint.state).toBe('FAILED'); rejectStarKey(s, { type: change }); continue; }
      s = act(s, { type: change }); expect(s.starKey.life.pending).toBeNull(); expect(projectStarKeyLife(s).pendingUsable).toBe(false);
      expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind); expect(s.planeswalker.life.site.playerLocation).toBe(physical.playerLocation);
      expect(s.planeswalker.life.site.parcel).toEqual(physical.parcel); expect(s.planeswalker.life.site.playerMetres).toBe(physical.playerMetres);
      if (wasActive) expect(attempt(s).endpoint.state).toBe(change === 'WAIT_WINDOW' ? 'EXPIRED' : 'INVALIDATED');
      rejectStarKey(s, { type: 'ENDPOINT_LOCATION' });
      if (change === 'CLOSE_DOOR') { rejectStarKey(s, { type: 'WALK_VERIFY' }); s = act(s, { type: 'OPEN_DOOR' }, { type: 'OBSERVE_ENDPOINT' }); expect(projectStarKeyLife(s).pendingUsable).toBe(false); }
      s = act(s, { type: 'WALK_VERIFY' }); expect(attempt(s).endpoint.effects).toBe(0);
    }
  }, 120_000);

  it('withdraws immediately, retains costs and returns by actual ordinary routes at zeroAP', () => {
    let s = act(enter(afterSecond(), 'withdrawn-return', 'ABILITY', true), { type: 'ANCHOR_MAINTENANCE' });
    expect(s.actionsRemaining).toBe(0); const beforeWithdrawal = structuredClone(s);
    s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'OPERATOR' }); expect(s.starKey.life.pending).toBeNull();
    expect(s.planeswalker.life.site.playerLocation).toBe('NEAR'); expect(s.planeswalker.life.site.parcel.location).toBe('PLAYER');
    expect(s.planeswalker.life.site.operatorConsent).toBe('WITHDRAWN'); expect(s.planeswalker.life.site.operatorConsentWeek).toBe(s.week);
    rejectStarKey(s, { type: 'ANCHOR_MAINTENANCE' }); rejectStarKey(s, { type: 'WALK_CARRY' }); rejectIntent(s, { type: 'ACTION', action: 'REST' });
    const before = structuredClone(s), paid = { spirituality: s.spirituality, mind: s.mind };
    s = act(s, { type: 'ABORT' }); const receipt = s.starKey.life.journal.at(-1)!;
    expect(receipt.before.actions).toBe(0); expect(receipt.after.actions).toBe(0); expect(receipt.playerWalkedMetres).toBe(8); expect(receipt.maraWalkedMetres).toBe(4); expect(receipt.operatorEnergySpent).toBe(2);
    expect(receipt.elapsedSeconds).toBe(16); expect(s.spirituality).toBe(paid.spirituality); expect(s.mind).toBe(paid.mind);
    expect(s.planeswalker.life.site.parcel.ordinaryMetres - before.planeswalker.life.site.parcel.ordinaryMetres).toBe(2);
    expect(s.planeswalker.life.site).toMatchObject({ playerLocation: 'OUTSIDE', operatorLocation: 'OUTSIDE', parcel: { location: 'ENTRY_STAND' }, door: { state: 'CLOSED' } });
    const finance = resolveSliceWeeklyFinance({ ...before, pulse: 'BILL' }).state;
    expect(s.week).toBe(before.week + 1); expect(s.actionsRemaining).toBe(before.weeklyBudget); expect(s.cash).toBe(finance.cash); expect(s.debts).toEqual(finance.debts);
    expect(attempt(s, 'withdrawn-return').anchor.effects).toBe(0); expect(beforeWithdrawal.spirituality).toBe(s.spirituality);
    const forged = structuredClone(s); forged.cash++; expect(validateStarKeyLifeState(forged)).toBe(false);
    const forgedFinance = structuredClone(s); forgedFinance.weeklyBudget++; expect(validateStarKeyLifeState(forgedFinance)).toBe(false);
    s = act(ready(s), { type: 'REPORT', caseId: 'withdrawn-return' }); expect(s.progression.mastery[ANCHOR]).toBe(0);
  }, 120_000);

  it('rejects source/history, movement, resources, costs, checks, finance and future-receipt tampering', () => {
    const s = act(enter(promoted(), 'endpoint-verification', 'ABILITY'), { type: 'ENDPOINT_LOCATION' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.planeswalker.life.site.operatorEnergy = 100; }, v => { v.planeswalker.life.site.parcel.location = 'ENTRY_STAND'; },
      v => { v.planeswalker.life.site.parcel.quantity = 2 as 1; }, v => { v.planeswalker.life.site.playerMetres++; },
      v => { v.planeswalker.life.site.lamp.oilRemaining++; }, v => { v.planeswalker.life.site.kits['symbolic-transit'].protectionSeconds = 90; },
      v => { v.planeswalker.life.journal.pop(); }, v => { v.starKey.sourceHistory!.planeswalker.life.site.operatorEnergy++; },
      v => { v.starKey.life.journal.at(-1)!.before.cash++; }, v => { v.starKey.life.journal.at(-1)!.after.spirituality++; },
      v => { v.starKey.life.journal.at(-1)!.randomAfter!++; }, v => { v.starKey.life.journal.at(-1)!.finance.weeklyBudget++; },
      v => { v.starKey.life.journal.at(-1)!.source!.conditionVersion++; }, v => { v.starKey.life.journal.at(-1)!.revision = v.revision + 1; },
      v => { v.starKey.life.journal.at(-1)!.week = v.week + 1; }, v => { v.starKey.life.journal.pop(); },
      v => { v.starKey.life.conditionVersion++; }, v => { v.starKey.life.clockSeconds++; },
      v => { attempt(v).endpoint.effects = 1; }, v => { const e = v.starKey.life.journal.at(-1)!; e.check = { ...e.check!, roll: e.check!.roll % 100 + 1 }; },
    ];
    for (const mutate of mutations) { const bad = structuredClone(s); mutate(bad); expect(validateStarKeyLifeState(bad)).toBe(false); expect(() => assertValidSliceState(bad)).toThrow(); }
    expect(blockStarKeyLife(s, { type: 'ENDPOINT_LOCATION' })).not.toBeNull();
  }, 120_000);

  it('keeps commands exact and the main action, optional withdrawal and zeroAP cleanup visible', () => {
    for (const c of [{ type: 'ENDPOINT_LOCATION', target: 'UNSEEN' }, { type: 'CONSENT', permission: 'OLD_PERMISSION' }, { type: 'INVITE', caseId: 'anchor-transfer', method: 'FREE' },
      { type: 'RETURN_PARCEL', teleport: true }, { type: 'BUY_MARKERS', free: true }, { type: 'FREE_REMOTE_RETURN' }, { type: 'REFILL_LAMP' }]) expect(validateStarKeyActivityCommand(c)).toBe(false);
    const s = enter(promoted(), 'endpoint-verification', 'ABILITY'), view = projectStarKeyLife(s);
    expect(view.actions.length).toBeLessThan(12); expect(view.preferredActionId).not.toBeNull();
    expect(view.actions.some(a => a.command.type === 'ABORT' && a.enabled && a.cleanup && a.cost.startsWith('0行动'))).toBe(true);
    expect(view.site.operatorEnergy).toBe(92); expect(view.site.lamp.oilRemaining).toBe(2); expect(view.site.parcel.quantity).toBe(1);
    expect(view.pendingUsable).toBe(false); expect(view.pendingRemainingSeconds).toBe(0);
  }, 120_000);
});
