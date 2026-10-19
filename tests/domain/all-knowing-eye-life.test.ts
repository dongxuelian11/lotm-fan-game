import { resolveSliceWeeklyFinance } from '../../src/domain/slice/weekly-finance.js';
import { describe, expect, it } from 'vitest';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import {
  ALL_KNOWING_EYE_CASE_IDS, allKnowingEyeExpectedOriginals, allKnowingEyeLifeActions,
  allKnowingEyeLifeMasteryGains, allKnowingEyeOriginalSnapshot, blockAllKnowingEyeLife,
  createAllKnowingEyeLifeState, hasAllKnowingEyeLifeLock, projectAllKnowingEyeLife,
  validateAllKnowingEyeActivityCommand, validateAllKnowingEyeLifeState,
  type AllKnowingEyeActivityCommand, type AllKnowingEyeCaseId,
} from '../../src/domain/all-knowing-eye/life.js';
import { ae, originalWisdomAngel, promoted, ready, rejectAllKnowingEye } from './all-knowing-eye-directed-helper.js';

// All public branches use the explicitly migrated living 537-command source,
// original seed and actual ordinary work/recovery. No cursor search, forced
// outcome, historical rewrite, free AP/cash or replacement original is used.
const INSIGHT = 'reader.s1.bounded-insight', FORECAST = 'reader.s1.pending-forecast';
const succeeds = (t: string | null) => t === 'SUCCESS' || t === 'GREAT_SUCCESS';
const attempt = (s: SliceState, id: AllKnowingEyeCaseId = s.allKnowingEye.life.activeCase!) => s.allKnowingEye.life.cases[id].attempts.at(-1)!;
function act(s: SliceState, ...commands: AllKnowingEyeActivityCommand[]): SliceState {
  for (const command of commands) { const before = structuredClone(s); s = ae(s, command); expect(before.allKnowingEye.life.journal.length + 1).toBe(s.allKnowingEye.life.journal.length); expect(validateAllKnowingEyeLifeState(s), JSON.stringify(command)).toBe(true); assertValidSliceState(s); }
  return s;
}
function enter(s: SliceState, caseId: AllKnowingEyeCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY'): SliceState {
  s = act(ready(s), { type: 'OBSERVE', caseId });
  if (s.allKnowingEye.life.rig.purchasedWeek === null) s = act(ready(s, { cash: 30 }), { type: 'BUY_RIG' });
  s = ready(s, { ap: 1, cash: 10, mind: 10, spirituality: 10 });
  return act(s, { type: 'WALK_TO_ROOM' }, { type: 'INVITE', caseId, method }, { type: 'READ_SOURCE' },
    { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'TECHNICIAN' },
    { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' },
    { type: 'AGREE_RETURN' }, { type: 'ENTER_ROOM' }, { type: 'TAKE_PAPERS' }, { type: 'READ_FIRST' }, { type: 'READ_SECOND' });
}
function finish(s: SliceState, caseId: AllKnowingEyeCaseId): SliceState {
  if (s.allKnowingEye.life.pending) s = act(s, { type: 'STOP_METHOD' });
  if (s.allKnowingEye.life.rig.sliderLocation !== 'RIG') s = act(s, { type: 'RETRIEVE_SLIDER' });
  if (attempt(s).papersTaken && !attempt(s).papersReturned) s = act(s, { type: 'RETURN_PAPERS' });
  if (attempt(s).rigPlaced && !attempt(s).rigReturned) s = act(s, { type: 'RETURN_RIG' });
  s = act(s, { type: 'EXIT_ROOM' }, { type: 'LEAVE' });
  return act(ready(s), { type: 'REPORT', caseId });
}
function paper(s: SliceState): SliceState { return finish(act(enter(s, 'original-paper-check'), { type: 'OBSERVE_HANDOVER' }, { type: 'MANUAL_COMPARE' }), 'original-paper-check'); }
function slider(s: SliceState): SliceState { return finish(act(enter(s, 'pending-slider'), { type: 'PLACE_RIG' }, { type: 'COCK_SLIDER' }, { type: 'OBSERVE_SLIDER' }, { type: 'HAND_STOP' }), 'pending-slider'); }
function changed(s: SliceState): SliceState { return finish(act(enter(s, 'changed-conditions'), { type: 'PLACE_RIG' }, { type: 'COCK_SLIDER' }, { type: 'OBSERVE_SLIDER' }, { type: 'CHANGE_CONDITIONS' }, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' }, { type: 'HAND_STOP' }, { type: 'CLEAR_SIGHTLINE' }, { type: 'RETRIEVE_SLIDER' }), 'changed-conditions'); }
function expectedCheck(s: SliceState, ability: 'knowledge' | 'perception', difficulty: number, bonus = false) {
  const rng = new DeterministicActionRandomStream(s.random.seed, s.random.cursor);
  return resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty,
    modifiers: bonus ? [{ source: ability === 'knowledge' ? '本次原纸核验的有限洞察' : '本次可见滑块的有限预判', value: 10 }] : [], roll: rng.nextInt(1, 100) });
}

// Cache only real public progression; every test receives its own clone.
let paperCache: SliceState | undefined, sliderCache: SliceState | undefined;
const afterPaper = () => structuredClone(paperCache ??= paper(promoted()));
const afterSlider = () => structuredClone(sliderCache ??= slider(afterPaper()));

describe('All-Knowing Eye finite original paper and pending slider life', () => {
  it('initializes from the living source without replacing old people, papers, device or history', () => {
    const old = originalWisdomAngel(), s = promoted(), l = s.allKnowingEye.life;
    expect(l.sourceWeek).toBe(s.allKnowingEye.promotionWeek); expect(l.journal).toEqual([]);
    expect(l.playerLocation).toBe('OUTSIDE'); expect(l.maraPresent).toBe(false); expect(l.irena).toMatchObject({ id: 'AE1-IRENA-VALE', age: 41, alive: true, present: false, location: 'AWAY', travelMetres: 0 });
    expect(l.rig).toMatchObject({ id: 'AE1-SLIDER-1', stopBlockId: 'AE1-STOP-1', price: 30, owner: 'AE1-IRENA-VALE', purchasedWeek: null, location: 'SUPPLIER', powered: false });
    expect(s.wisdomAngel.life).toEqual(old.wisdomAngel.life); expect(allKnowingEyeExpectedOriginals(s)).toEqual(allKnowingEyeOriginalSnapshot(old));
    expect(s.wisdomAngel.encounter).toEqual(old.wisdomAngel.encounter); expect(s.mysticismMagister).toEqual(old.mysticismMagister);
    expect(s.wisdomAngel.life.device).toMatchObject({ charges: 0, filter: 'AMBER', conditionVersion: 2, demonstrations: 2, filterChanges: 1 });
    expect(s.wisdomAngel.life.papers.map(p => p.firstReadWeek)).toEqual([118, 118]); expect(createAllKnowingEyeLifeState().sourceWeek).toBeNull();
    expect(hasAllKnowingEyeLifeLock(s)).toBe(false); expect(validateAllKnowingEyeLifeState(s)).toBe(true);
  }, 120_000);

  it('completes all three ordinary cases with real payments, movement, returns and no new mastery', () => {
    let s = changed(afterSlider()); s = act(ready(s), { type: 'REFLECT' }); const l = s.allKnowingEye.life, old = originalWisdomAngel();
    expect(ALL_KNOWING_EYE_CASE_IDS.every(id => l.cases[id].status === 'RESOLVED' && l.cases[id].result === 'ORDINARY')).toBe(true);
    expect(l.journal.reduce((n, e) => n + e.before.cash - e.after.cash, 0)).toBe(60);
    expect(l.journal.reduce((n, e) => n + e.before.actions - e.after.actions, 0)).toBe(11);
    expect(l.journal.every(e => e.randomBefore === null && e.randomAfter === null && e.check === null)).toBe(true);
    expect(l.playerTravelMetres).toBe(48); expect(l.irena.travelMetres).toBe(48); expect(l.irena.present).toBe(false); expect(l.maraPresent).toBe(false);
    expect(s.wisdomAngel.life.playerTravelMetres).toBe(old.wisdomAngel.life.playerTravelMetres + 24);
    expect(s.wisdomAngel.life.mara.travelMetres).toBe(old.wisdomAngel.life.mara.travelMetres + 24);
    expect(s.wisdomAngel.life.clockSeconds).toBe(old.wisdomAngel.life.clockSeconds + l.elapsedSeconds);
    expect(s.wisdomAngel.life.papers).toEqual(old.wisdomAngel.life.papers); expect(s.wisdomAngel.life.device).toEqual(old.wisdomAngel.life.device);
    expect(s.wisdomAngel.life.cases).toEqual(old.wisdomAngel.life.cases); expect(s.wisdomAngel.life.journal).toEqual(old.wisdomAngel.life.journal);
    expect(l.rig).toMatchObject({ powered: false, owner: 'PLAYER', location: 'PLAYER', sliderLocation: 'RIG', stopBlockLocation: 'RIG', motion: 'STOPPED', direction: 'RIGHT', sightline: 'CLEAR', conditionVersion: 3, movements: 0, manualStops: 2 });
    expect(s.progression.acting).toBe(100); expect(allKnowingEyeLifeMasteryGains(s)).toEqual({ [INSIGHT]: 0, [FORECAST]: 0 });
    for (const [id, value] of Object.entries(old.progression.mastery)) expect(s.progression.mastery[id]).toBe(value);
    expect(hasAllKnowingEyeLifeLock(s)).toBe(false); rejectAllKnowingEye(s, { type: 'REFLECT' }); rejectAllKnowingEye(s, { type: 'BUY_RIG' });
  }, 120_000);

  it('requires fresh separate permission and physically returns at zero AP without borrowing old agreement', () => {
    let s = act(ready(promoted()), { type: 'OBSERVE', caseId: 'original-paper-check' });
    s = act(ready(s, { cash: 30 }), { type: 'BUY_RIG' }); s = ready(s, { ap: 1, cash: 10 });
    s = act(s, { type: 'WALK_TO_ROOM' }, { type: 'INVITE', caseId: 'original-paper-check', method: 'ABILITY' });
    rejectAllKnowingEye(s, { type: 'ENTER_ROOM' }); rejectAllKnowingEye(s, { type: 'CONSENT', permission: 'OWNER' });
    s = act(s, { type: 'READ_SOURCE' }, { type: 'CONSENT', permission: 'OWNER' }); rejectAllKnowingEye(s, { type: 'ENTER_ROOM' });
    s = act(s, { type: 'DECLINE_CONSENT', permission: 'TECHNICIAN' }); const before = structuredClone(s);
    rejectAllKnowingEye(s, { type: 'CONSENT', permission: 'TECHNICIAN' }); rejectAllKnowingEye(s, { type: 'BOUNDED_INSIGHT' });
    s = act(s, { type: 'LEAVE' }); expect(s.actionsRemaining).toBe(before.actionsRemaining); expect(s.spirituality).toBe(before.spirituality);
    expect(s.allKnowingEye.life.irena.present).toBe(false); expect(s.wisdomAngel.life.papers).toEqual(before.wisdomAngel.life.papers);
    s = act(ready(s), { type: 'REPORT', caseId: 'original-paper-check' }); expect(s.progression.mastery[INSIGHT]).toBe(0);
  }, 120_000);

  it('separates a paid bounded-insight cast from the next real independent verification and honest application', () => {
    let s = act(enter(promoted(), 'original-paper-check', 'ABILITY'), { type: 'OBSERVE_HANDOVER' });
    const before = structuredClone(s), cast = expectedCheck(s, 'knowledge', 18);
    s = act(s, { type: 'BOUNDED_INSIGHT' });
    expect(s.allKnowingEye.life.journal.at(-1)!.check).toEqual(cast); expect(s.spirituality).toBe(before.spirituality - 6); expect(s.mind).toBe(before.mind - 2);
    expect(attempt(s).insight.effects).toBe(0); expect(s.progression.mastery[INSIGHT]).toBe(0); expect(attempt(s).handoverVerified).toBe(false);
    if (succeeds(cast.tier)) expect(s.allKnowingEye.life.pending!.expiresAt - s.allKnowingEye.life.pending!.createdAt).toBe(30);
    else expect(attempt(s).insight).toMatchObject({ state: 'FAILED', successes: 0, effects: 0 });
    rejectAllKnowingEye(s, { type: 'BOUNDED_INSIGHT' });
    const verification = expectedCheck(s, 'knowledge', 20, succeeds(cast.tier)), cursor = s.random.cursor;
    s = act(s, { type: 'VERIFY_HANDOVER' }); expect(s.random.cursor).toBe(cursor + 1); expect(s.allKnowingEye.life.journal.at(-1)!.check).toEqual(verification);
    const applied = succeeds(cast.tier) && succeeds(verification.tier);
    expect(attempt(s).insight.effects).toBe(applied ? 1 : 0); expect(s.allKnowingEye.life.pending).toBeNull(); rejectAllKnowingEye(s, { type: 'VERIFY_HANDOVER' });
    if (!succeeds(verification.tier)) { expect(attempt(s).handoverVerified).toBe(false); s = act(s, { type: 'MANUAL_COMPARE' }); }
    s = finish(s, 'original-paper-check'); expect(s.progression.mastery[INSIGHT]).toBe(applied ? 8 : 0);
    expect(attempt(s, 'original-paper-check').handoverTier).toBe(verification.tier); expect(s.wisdomAngel.life.device.charges).toBe(0);
  }, 120_000);

  it('uses the real clock for an earned window and preserves a failed cast without free retries', () => {
    let s = act(enter(promoted(), 'original-paper-check', 'ABILITY'), { type: 'OBSERVE_HANDOVER' }, { type: 'BOUNDED_INSIGHT' });
    const paid = { s: s.spirituality, m: s.mind }, before = s.allKnowingEye.life.clockSeconds;
    if (s.allKnowingEye.life.pending) {
      s = act(s, { type: 'WAIT_WINDOW' }); expect(s.allKnowingEye.life.clockSeconds).toBe(before + 30); expect(attempt(s).insight.state).toBe('EXPIRED');
      rejectAllKnowingEye(s, { type: 'WAIT_WINDOW' }); expect(s.allKnowingEye.life.pending).toBeNull();
    } else { expect(attempt(s).insight.state).toBe('FAILED'); rejectAllKnowingEye(s, { type: 'WAIT_WINDOW' }); }
    rejectAllKnowingEye(s, { type: 'BOUNDED_INSIGHT' }); s = act(s, { type: 'MANUAL_COMPARE' });
    expect(s.spirituality).toBe(paid.s); expect(s.mind).toBe(paid.m); s = finish(s, 'original-paper-check'); expect(s.progression.mastery[INSIGHT]).toBe(0);
  }, 120_000);

  it('forecasts only a real visible pending movement and resolves a separate catch without replacing failed parts', () => {
    let s = enter(afterPaper(), 'pending-slider', 'ABILITY'); rejectAllKnowingEye(s, { type: 'PENDING_FORECAST' });
    s = act(s, { type: 'PLACE_RIG' }); rejectAllKnowingEye(s, { type: 'PENDING_FORECAST' });
    s = act(s, { type: 'COCK_SLIDER' }); rejectAllKnowingEye(s, { type: 'PENDING_FORECAST' });
    s = act(s, { type: 'OBSERVE_SLIDER' }); const before = structuredClone(s), cast = expectedCheck(s, 'perception', 18);
    s = act(s, { type: 'PENDING_FORECAST' }); expect(s.spirituality).toBe(before.spirituality - 8); expect(s.mind).toBe(before.mind - 3); expect(s.allKnowingEye.life.rig.movements).toBe(0);
    expect(s.allKnowingEye.life.journal.at(-1)!.source).toMatchObject({ sliderId: 'AE1-SLIDER-1', sightline: 'CLEAR', movement: 'COCKED', conditionVersion: 1 });
    const catchCheck = expectedCheck(s, 'perception', 20, succeeds(cast.tier)); s = act(s, { type: 'CATCH_SLIDER' });
    expect(s.allKnowingEye.life.journal.at(-1)!.check).toEqual(catchCheck); expect(s.allKnowingEye.life.rig.movements).toBe(1);
    expect(s.allKnowingEye.life.rig.sliderLocation).toBe(succeeds(catchCheck.tier) ? 'STOP_BLOCK' : 'FLOOR');
    expect(attempt(s).forecast.effects).toBe(succeeds(cast.tier) && succeeds(catchCheck.tier) ? 1 : 0);
    rejectAllKnowingEye(s, { type: 'CATCH_SLIDER' }); rejectAllKnowingEye(s, { type: 'RETURN_RIG' });
    const location = s.allKnowingEye.life.rig.sliderLocation; s = act(s, { type: 'RETRIEVE_SLIDER' });
    expect(s.allKnowingEye.life.journal.at(-1)!.elapsedSeconds).toBe(location === 'FLOOR' ? 4 : 2);
    s = finish(s, 'pending-slider'); expect(s.progression.mastery[FORECAST]).toBe(succeeds(cast.tier) && succeeds(catchCheck.tier) ? 8 : 0);
    expect(attempt(s, 'pending-slider').catchTier).toBe(catchCheck.tier);
  }, 120_000);

  it('invalidates prediction on actual changed direction, honors withdrawal, and safely cleans up at no AP cost', () => {
    let s = act(enter(afterSlider(), 'changed-conditions', 'ABILITY'), { type: 'PLACE_RIG' }, { type: 'COCK_SLIDER' }, { type: 'OBSERVE_SLIDER' }, { type: 'PENDING_FORECAST' });
    const paid = { s: s.spirituality, m: s.mind }, wasPending = s.allKnowingEye.life.pending !== null;
    s = act(s, { type: 'CHANGE_CONDITIONS' }); expect(s.allKnowingEye.life.rig).toMatchObject({ direction: 'RIGHT', sightline: 'SHUTTERED', conditionVersion: 2 });
    expect(s.allKnowingEye.life.pending).toBeNull(); expect(attempt(s).forecast.state).toBe(wasPending ? 'INVALIDATED' : 'FAILED');
    s = act(s, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' }); rejectAllKnowingEye(s, { type: 'PENDING_FORECAST' }); rejectAllKnowingEye(s, { type: 'CONSENT', permission: 'OWNER' }); rejectAllKnowingEye(s, { type: 'RETURN_RIG' });
    const ap = s.actionsRemaining, clock = s.allKnowingEye.life.clockSeconds, beforeExit=structuredClone(s);
    s = act(s, { type: 'ABORT' }); expect(s.allKnowingEye.life.journal.at(-1)!.after.actions).toBe(ap);
    if(ap===0){const finance=resolveSliceWeeklyFinance({...beforeExit,pulse:'BILL'}).state;expect(s.actionsRemaining).toBe(beforeExit.weeklyBudget);expect(s.week).toBe(beforeExit.week+1);expect(s.cash).toBe(finance.cash);expect(s.debts).toEqual(finance.debts);}else{expect(s.actionsRemaining).toBe(ap);expect(s.week).toBe(beforeExit.week);expect(s.cash).toBe(beforeExit.cash);} expect(s.allKnowingEye.life.clockSeconds).toBeGreaterThan(clock); expect(s.spirituality).toBe(paid.s); expect(s.mind).toBe(paid.m);
    expect(s.allKnowingEye.life.rig).toMatchObject({ location: 'PLAYER', sliderLocation: 'RIG', motion: 'STOPPED', sightline: 'CLEAR', conditionVersion: 3 });
    expect(s.allKnowingEye.life.irena).toMatchObject({ present: false, location: 'AWAY' }); expect(s.wisdomAngel.life.mara.location).toBe('EXIT'); expect(s.wisdomAngel.life.papers.every(p => p.location === 'TABLE')).toBe(true);
    s = act(ready(s), { type: 'REPORT', caseId: 'changed-conditions' }); expect(s.progression.mastery[FORECAST]).toBe(0); expect(attempt(s, 'changed-conditions').forecast.effects).toBe(0);
  }, 120_000);

  it('rejects forged costs, checks, source object changes, free recharge and future or missing receipts', () => {
    const s = act(enter(promoted(), 'original-paper-check', 'ABILITY'), { type: 'OBSERVE_HANDOVER' }, { type: 'BOUNDED_INSIGHT' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { v.wisdomAngel.life.device.charges = 1; }, v => { v.wisdomAngel.life.papers[0].text += '改写'; },
      v => { v.wisdomAngel.life.papers[0].firstReadWeek = v.week; }, v => { v.wisdomAngel.life.journal.pop(); },
      v => { v.allKnowingEye.life.rig.powered = true as false; }, v => { v.allKnowingEye.life.journal.at(-1)!.before.cash++; },
      v => { v.allKnowingEye.life.journal.at(-1)!.after.spirituality++; }, v => { v.allKnowingEye.life.journal.at(-1)!.randomAfter!++; },
      v => { const event = v.allKnowingEye.life.journal.at(-1)!; event.check = { ...event.check!, roll: event.check!.roll % 100 + 1 }; }, v => { v.allKnowingEye.life.journal.at(-1)!.revision = v.revision + 1; },
      v => { v.allKnowingEye.life.journal.at(-1)!.week = v.week + 1; }, v => { v.allKnowingEye.life.journal.pop(); },
      v => { v.allKnowingEye.life.clockSeconds++; }, v => { v.allKnowingEye.life.cases['original-paper-check'].attempts.at(-1)!.insight.effects = 1; },
    ];
    for (const mutate of mutations) { const forged = structuredClone(s); mutate(forged); expect(validateAllKnowingEyeLifeState(forged)).toBe(false); expect(() => assertValidSliceState(forged)).toThrow(); }
    expect(validateAllKnowingEyeActivityCommand({ type: 'PENDING_FORECAST', target: 'unseen' })).toBe(false);
    expect(validateAllKnowingEyeActivityCommand({ type: 'CONSENT', permission: 'OLD_PERMISSION' })).toBe(false);
    expect(validateAllKnowingEyeActivityCommand({ type: 'BUY_RIG', price: 0 })).toBe(false);
    const projection = projectAllKnowingEyeLife(s); expect(projection.device.charges).toBe(0); expect(projection.actions.length).toBeLessThan(12);
    expect(allKnowingEyeLifeActions(s).some(a => a.command.type === 'ABORT' && a.enabled && a.cleanup)).toBe(true);
    expect(blockAllKnowingEyeLife(s, { type: 'BOUNDED_INSIGHT' })).not.toBeNull();
  }, 120_000);
});
