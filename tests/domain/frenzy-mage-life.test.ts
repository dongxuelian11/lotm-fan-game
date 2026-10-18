import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createFrenzyMageState } from '../../src/domain/frenzy-mage/index.js';
import {
  advanceFrenzyMageClock, advanceFrenzyMageLifeClock, applyFrenzyMageActivity, blockFrenzyMageLife,
  createFrenzyMageLifeState, FRENZY_MAGE_CASE_IDS, frenzyMageLifeActions, hasFrenzyMageLifeLock,
  projectFrenzyMageLife, validateFrenzyMageActivityCommand, validateFrenzyMageLife,
  type FrenzyMageActivityCommand, type FrenzyMageCaseId,
} from '../../src/domain/frenzy-mage/life.js';

const ABILITY = 'black-emperor.s3.ordered-deviation';
/** Directed isolated fixtures. These fixed rolls do not claim natural promotion or natural success. */
function ready(): SliceState {
  const s = createSliceRun('frenzy-mage-life-directed', sliceDefaultCreationSelection, 'frenzy-mage-life-directed');
  s.frenzyMage = createFrenzyMageState(); s.week = 130; s.frenzyMage.promotionWeek = 129; s.frenzyMage.fallenEarlActingAtPromotion = 100;
  s.progression = { pathwayId: 'black-emperor', sequence: 3, acting: 0, promotionWeek: 129, mastery: { [ABILITY]: 0, 'black-emperor.s4.magnify': 24 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
const context = (s: SliceState, checkRoll = 1): SeerContext => ({
  roll: vi.fn(() => { throw new Error('Life scenes must never draw a second event or luck roll.'); }), note: vi.fn(),
  check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll: checkRoll })),
});
function act(s: SliceState, command: FrenzyMageActivityCommand, checkRoll = 1) { const ctx = context(s, checkRoll); applyFrenzyMageActivity(s, command, ctx); expect(validateFrenzyMageLife(s), command.type).toBe(true); return ctx; }
type PlainStep = Exclude<FrenzyMageActivityCommand['type'], 'PREPARE' | 'REFLECT' | 'CONFIRM_LIMITED'>;
function step(s: SliceState, caseId: FrenzyMageCaseId, type: PlainStep, checkRoll = 1) { return act(s, { type, caseId } as FrenzyMageActivityCommand, checkRoll); }
function reject(s: SliceState, command: FrenzyMageActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applyFrenzyMageActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: FrenzyMageCaseId) => s.frenzyMage.life.cases[id].attempts[0]!;
function start(s: SliceState, id: FrenzyMageCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'START_CASE'); }
function approach(s: SliceState, id: FrenzyMageCaseId) { step(s, id, 'GO_A'); step(s, id, 'CHECK_OBJECT'); }
function cast(s: SliceState, id: FrenzyMageCaseId, roll = 1) { approach(s, id); return step(s, id, 'PERFORM', roll); }
function finish(s: SliceState, id: FrenzyMageCaseId, report = true) {
  step(s, id, 'WALK_RESULT'); step(s, id, 'READ_RESULT');
  if (id === 'own-throw') { step(s, id, 'TAKE_OBJECT'); step(s, id, 'RETURN_A'); }
  else step(s, id, 'RETURN_PERSON');
  for (const type of ['RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE'] as const) step(s, id, type);
  if (report) step(s, id, 'REPORT_CASE');
}
function complete(s: SliceState, id: FrenzyMageCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', roll = 1) {
  start(s, id, method); cast(s, id, roll); if (id === 'withdrawn-route' && method === 'ABILITY') step(s, id, 'STOP_INPUT'); step(s, id, 'EXECUTE_ACTION'); finish(s, id);
}
function firstTwo(s: SliceState) { complete(s, 'courier-route', 'ORDINARY'); complete(s, 'withdrawn-route', 'ORDINARY'); }
function oldSources(s: SliceState) { return structuredClone({ lawyer: s.lawyer, barbarian: s.barbarian, briber: s.briber, corruptionBaron: s.corruptionBaron, mentorDisorder: s.mentorDisorder, fallenEarl: s.fallenEarl, winner: s.winner, character: s.character, world: s.world }); }

describe('Frenzy Mage directed finite expressed-action scenes, originals and current consent', () => {
  it('starts with one adult and one original of each item; title and boundaries explicitly identify the G extension', () => {
    const s = ready(), l = s.frenzyMage.life; expect(l).toEqual(createFrenzyMageLifeState()); expect(validateFrenzyMageLife(s)).toBe(true);
    expect(l.volunteer).toMatchObject({ id: 'FM3-DARIAN', age: 42, independentMind: true, location: 'A', health: 100, mind: 100 });
    expect(l.parcel).toMatchObject({ id: 'FM3-PARCEL', quantity: 1, massGrams: 400, owner: 'GUIDE', holder: 'GUIDE', location: 'START', confidential: false });
    expect(l.ball).toMatchObject({ id: 'FM3-PRACTICE-BALL', quantity: 1, massGrams: 80, soft: true }); expect(l.paper.text).toBe('从A到B');
    expect(projectFrenzyMageLife(s).story).toContain('原著直接依据'); expect(projectFrenzyMageLife(s).story).toContain('原创G'); expect(projectFrenzyMageLife(s).story).toContain('完整配方'); expect('luck' in l).toBe(false);
  });
  it('START_CASE locks the actual scene without moving or taking current consent', () => {
    const s = ready(); start(s, 'courier-route'); expect(hasFrenzyMageLifeLock(s)).toBe(true);
    expect(attempt(s, 'courier-route')).toMatchObject({ steps: [], abilityTier: null, actionExecutions: 0, actionResult: null, resolutionPaid: false, consent: 'UNASKED', expressedAction: null });
    expect(s.actionsRemaining).toBe(98); expect(s.frenzyMage.life.playerLocation).toBe('START'); expect(s.frenzyMage.life.parcel.location).toBe('START');
    reject(s, { type: 'PERFORM', caseId: 'courier-route' }); reject(s, { type: 'EXECUTE_ACTION', caseId: 'courier-route' }); reject(s, { type: 'LEAVE_CASE', caseId: 'courier-route' });
  });
  it('physically brings the same originals and guide from START to A before declaring the pending action', () => {
    const s = ready(); start(s, 'courier-route'); approach(s, 'courier-route'); const l = s.frenzyMage.life, a = attempt(s, 'courier-route');
    expect(l.guide).toMatchObject({ name: '米蕾·沃德', location: 'A' }); expect(l.parcel).toMatchObject({ location: 'A', holder: 'DARIAN', owner: 'GUIDE', handovers: 1 });
    expect(a.guideMoves).toEqual([{ from: 'START', to: 'A', mode: 'WALK', metres: 4, seconds: 4, itemIds: ['FM3-PARCEL', 'FM3-ROUTE-PAPER'] }]);
    expect(l.paper).toMatchObject({ holder: 'PLAYER', location: 'A', text: '从A到B' }); expect(a).toMatchObject({ consent: 'GRANTED', expressedAction: 'WALK_A_TO_B', elapsedSeconds: 6, actionExecutions: 0 });
  });
  it.each([1, 50])('directed successful roll %s arms only a later action; no second roll, movement or early mastery', roll => {
    const s = ready(); start(s, 'courier-route'); const ctx = cast(s, 'courier-route', roll), a = attempt(s, 'courier-route');
    expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 20); expect(ctx.roll).not.toHaveBeenCalled();
    expect(a).toMatchObject({ pendingRemainingSeconds: 30, modifierApplied: false, actionExecutions: 0, actionResult: null, spiritualitySpent: 5, mindSpent: 2 });
    expect(s.frenzyMage.life.volunteer.location).toBe('A'); expect(s.frenzyMage.life.parcel.location).toBe('A'); expect(s.progression.mastery[ABILITY]).toBe(0);
    const execution = step(s, 'courier-route', 'EXECUTE_ACTION'); expect(execution.check).not.toHaveBeenCalled(); expect(execution.roll).not.toHaveBeenCalled();
    expect(a).toMatchObject({ modifierApplied: true, actionExecutions: 1, actionResult: 'C', pendingRemainingSeconds: 0, inputActive: false, actionAtSecond: 12 });
    expect(s.frenzyMage.life.volunteer.location).toBe('C'); expect(s.frenzyMage.life.parcel.location).toBe('C'); expect(s.frenzyMage.life.playerLocation).toBe('A'); expect(s.frenzyMage.life.paper.text).toBe('从A到B');
    finish(s, 'courier-route'); expect(s.progression.mastery[ABILITY]).toBe(8); expect(a.personMoves.map(m => [m.from, m.to, m.metres])).toEqual([['A', 'C', 4], ['C', 'A', 4]]);
  });
  it.each([90, 100])('directed unsuccessful roll %s retains cost and finishes ordinarily without rechecking or paying another AP', roll => {
    const s = ready(); start(s, 'courier-route'); cast(s, 'courier-route', roll); const a = attempt(s, 'courier-route');
    expect(a.pendingRemainingSeconds).toBe(0); expect(s.spirituality).toBe(115); expect(s.mind).toBe(98); expect(s.actionsRemaining).toBe(97);
    reject(s, { type: 'PERFORM', caseId: 'courier-route' }); reject(s, { type: 'ORDINARY_CHECK', caseId: 'courier-route' }); step(s, 'courier-route', 'EXECUTE_ACTION'); finish(s, 'courier-route');
    expect(a).toMatchObject({ actionResult: 'B', modifierApplied: false, result: 'ORDINARY', resolutionActions: 1 }); expect(s.actionsRemaining).toBe(96); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('requires immediate STOP_INPUT after automatic withdrawal, preserving the current ordinary A-to-B intent', () => {
    const s = ready(); complete(s, 'courier-route', 'ORDINARY'); start(s, 'withdrawn-route'); cast(s, 'withdrawn-route'); const a = attempt(s, 'withdrawn-route');
    expect(a).toMatchObject({ consent: 'REVOKED', consentWithdrawn: true, abilityTier: 'GREAT_SUCCESS', pendingRemainingSeconds: 30, modifierApplied: false }); expect(s.frenzyMage.life.volunteer.willing).toBe(false);
    reject(s, { type: 'EXECUTE_ACTION', caseId: 'withdrawn-route' }); reject(s, { type: 'WAIT_EFFECT', caseId: 'withdrawn-route' }); step(s, 'withdrawn-route', 'STOP_INPUT');
    expect(a).toMatchObject({ pendingRemainingSeconds: 0, modifierCancelled: true, stopped: true }); step(s, 'withdrawn-route', 'EXECUTE_ACTION'); finish(s, 'withdrawn-route');
    expect(a).toMatchObject({ actionResult: 'B', modifierApplied: false, result: 'ORDINARY', spiritualitySpent: 5, mindSpent: 2 }); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('honours a fresh explicit withdrawal before the first courier moves and never retroactively restores an applied movement', () => {
    const s = ready(); start(s, 'courier-route'); cast(s, 'courier-route'); step(s, 'courier-route', 'WITHDRAW_CONSENT'); reject(s, { type: 'EXECUTE_ACTION', caseId: 'courier-route' });
    step(s, 'courier-route', 'STOP_INPUT'); step(s, 'courier-route', 'EXECUTE_ACTION'); finish(s, 'courier-route'); expect(attempt(s, 'courier-route').actionResult).toBe('B'); expect(s.progression.mastery[ABILITY]).toBe(0);
    const applied = ready(); start(applied, 'courier-route'); cast(applied, 'courier-route'); step(applied, 'courier-route', 'EXECUTE_ACTION'); step(applied, 'courier-route', 'STOP_INPUT');
    expect(applied.frenzyMage.life.volunteer.location).toBe('C'); expect(attempt(applied, 'courier-route').modifierApplied).toBe(true); expect(attempt(applied, 'courier-route').modifierCancelled).toBe(false);
    reject(applied, { type: 'WITHDRAW_CONSENT', caseId: 'courier-route' }); reject(applied, { type: 'EXECUTE_ACTION', caseId: 'courier-route' }); finish(applied, 'courier-route');
  });
  it('can use an entirely ordinary path after initial refusal without asking again or issuing any check', () => {
    const s = ready(); s.frenzyMage.life.volunteer.willing = false; start(s, 'courier-route'); approach(s, 'courier-route'); expect(attempt(s, 'courier-route').consent).toBe('DECLINED');
    reject(s, { type: 'PERFORM', caseId: 'courier-route' }); const ctx = step(s, 'courier-route', 'ORDINARY_CHECK'); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); step(s, 'courier-route', 'EXECUTE_ACTION'); finish(s, 'courier-route');
    expect(attempt(s, 'courier-route')).toMatchObject({ abilityTier: null, result: 'ORDINARY', actionResult: 'B', consent: 'DECLINED' }); expect([s.spirituality, s.mind]).toEqual([120, 100]);
  });
  it('waits exactly the current thirty seconds, expires unused influence and preserves the cost and first ordinary movement', () => {
    const s = ready(); start(s, 'courier-route'); cast(s, 'courier-route'); const before = s.frenzyMage.life.clockSeconds; step(s, 'courier-route', 'WAIT_EFFECT');
    expect(s.frenzyMage.life.clockSeconds).toBe(before + 30); expect(attempt(s, 'courier-route')).toMatchObject({ waitedSeconds: 30, waitCompleted: true, modifierExpired: true, pendingRemainingSeconds: 0, inputActive: false });
    reject(s, { type: 'WAIT_EFFECT', caseId: 'courier-route' }); step(s, 'courier-route', 'EXECUTE_ACTION'); finish(s, 'courier-route'); expect(attempt(s, 'courier-route').actionResult).toBe('B'); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.spirituality).toBe(115);
  });
  it('does not read or recall the person and parcel remotely; both actually walk the same return leg', () => {
    const s = ready(); start(s, 'courier-route'); cast(s, 'courier-route'); step(s, 'courier-route', 'EXECUTE_ACTION');
    reject(s, { type: 'READ_RESULT', caseId: 'courier-route' }); reject(s, { type: 'RETURN_PERSON', caseId: 'courier-route' }); reject(s, { type: 'RETURN_OBJECT', caseId: 'courier-route' });
    step(s, 'courier-route', 'WALK_RESULT'); expect(s.frenzyMage.life.paper.location).toBe('C'); step(s, 'courier-route', 'READ_RESULT'); step(s, 'courier-route', 'RETURN_PERSON');
    expect([s.frenzyMage.life.playerLocation, s.frenzyMage.life.volunteer.location, s.frenzyMage.life.parcel.location]).toEqual(['A', 'A', 'A']);
    expect(attempt(s, 'courier-route').playerMoves.at(-1)).toMatchObject({ from: 'C', to: 'A', metres: 4, itemIds: ['FM3-ROUTE-PAPER'] });
    for (const type of ['RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, 'courier-route', type);
    expect(s.frenzyMage.life.parcel).toMatchObject({ owner: 'GUIDE', holder: 'GUIDE', location: 'START', returns: 1 }); expect(attempt(s, 'courier-route').guideMoves).toHaveLength(2); expect(attempt(s, 'courier-route').elapsedSeconds).toBe(28);
  });
  it('throws the single original softball later, physically flies four metres, and requires pickup before the return leg', () => {
    const s = ready(); firstTwo(s); start(s, 'own-throw'); cast(s, 'own-throw'); const a = attempt(s, 'own-throw');
    expect(a.expressedAction).toBe('THROW_A_TO_B'); expect(s.frenzyMage.life.ball).toMatchObject({ holder: 'PLAYER', location: 'A', throws: 0 }); step(s, 'own-throw', 'EXECUTE_ACTION');
    expect(s.frenzyMage.life.ball).toMatchObject({ holder: 'PAD', location: 'C', throws: 1 }); expect(a.objectMoves.find(m => m.mode === 'THROW')).toEqual({ from: 'A', to: 'C', mode: 'THROW', metres: 4, seconds: 4, itemIds: ['FM3-PRACTICE-BALL'] });
    reject(s, { type: 'TAKE_OBJECT', caseId: 'own-throw' }); step(s, 'own-throw', 'WALK_RESULT'); step(s, 'own-throw', 'READ_RESULT'); reject(s, { type: 'RETURN_A', caseId: 'own-throw' });
    step(s, 'own-throw', 'TAKE_OBJECT'); step(s, 'own-throw', 'RETURN_A'); expect(a.playerMoves.at(-1)?.itemIds).toEqual(['FM3-ROUTE-PAPER', 'FM3-PRACTICE-BALL']);
    for (const type of ['RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, 'own-throw', type);
    expect(s.frenzyMage.life.ball).toMatchObject({ holder: 'GUIDE', owner: 'GUIDE', location: 'START', throws: 1, returns: 1 }); expect(a.elapsedSeconds).toBe(29); expect(s.progression.mastery[ABILITY]).toBe(8);
  });
  it('rejects a claim of guaranteed future outcomes without changing the first real throw or asking for a successful check', () => {
    const s = ready(); firstTwo(s); start(s, 'own-throw'); cast(s, 'own-throw', 100); step(s, 'own-throw', 'EXECUTE_ACTION');
    for (const type of ['WALK_RESULT', 'READ_RESULT', 'TAKE_OBJECT', 'RETURN_A'] as const) step(s, 'own-throw', type);
    const ctx = act(s, { type: 'CONFIRM_LIMITED', caseId: 'own-throw', claim: 'GUARANTEED' }); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled(); expect(attempt(s, 'own-throw')).toMatchObject({ rejectedClaims: 1, limitedConfirmed: false, actionResult: 'B', actionExecutions: 1 });
    act(s, { type: 'CONFIRM_LIMITED', caseId: 'own-throw', claim: 'LIMITED' }); for (const type of ['RETURN_OBJECT', 'RECORD_OUTCOME', 'RETURN_START', 'LEAVE_CASE', 'REPORT_CASE'] as const) step(s, 'own-throw', type);
    expect(attempt(s, 'own-throw').limitedConfirmed).toBe(true); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.frenzyMage.life.ball.throws).toBe(1);
  });
  it('completes all three ordinary cases and reflection for exactly 13 AP without touching any old root or luck', () => {
    const s = ready(), old = oldSources(s); for (const id of FRENZY_MAGE_CASE_IDS) complete(s, id, 'ORDINARY'); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect([s.spirituality, s.mind, s.progression.acting, s.progression.mastery[ABILITY]]).toEqual([120, 100, 100, 0]); expect(oldSources(s)).toEqual(old);
    expect(s.frenzyMage.life).toMatchObject({ playerTravelMetres: 48, guideTravelMetres: 24, clockSeconds: 85, reflected: true }); expect(hasFrenzyMageLifeLock(s)).toBe(false); expect(s.frenzyMage.life.parcel.returns).toBe(2); expect(s.frenzyMage.life.ball.returns).toBe(1);
  });
  it('records three paid directed successful checks but grants mastery only to the two actually applied actions', () => {
    const s = ready(), old = oldSources(s); for (const id of FRENZY_MAGE_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.spirituality, s.mind, s.progression.acting, s.progression.mastery[ABILITY]]).toEqual([87, 105, 94, 100, 16]); expect(oldSources(s)).toEqual(old);
    expect(FRENZY_MAGE_CASE_IDS.map(id => attempt(s, id).actionResult)).toEqual(['C', 'B', 'C']); expect(FRENZY_MAGE_CASE_IDS.map(id => attempt(s, id).abilityTier)).toEqual(['GREAT_SUCCESS', 'GREAT_SUCCESS', 'GREAT_SUCCESS']);
    expect(s.frenzyMage.life.paper.text).toBe('从A到B'); expect(s.progression.mastery['black-emperor.s4.magnify']).toBe(24);
  });
  it('keeps every already-paid physical cleanup available at zero AP, zero spirit and zero mind', () => {
    const s = ready(); start(s, 'courier-route'); cast(s, 'courier-route', 100); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    step(s, 'courier-route', 'EXECUTE_ACTION'); finish(s, 'courier-route', false); expect(hasFrenzyMageLifeLock(s)).toBe(false); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); reject(s, { type: 'REPORT_CASE', caseId: 'courier-route' });
  });
  it('offers ordinary fallback when resources are insufficient and forbids starting a prepare that cannot fund its one implementation AP', () => {
    const s = ready(); start(s, 'courier-route'); approach(s, 'courier-route'); s.spirituality = 4; s.mind = 1;
    reject(s, { type: 'PERFORM', caseId: 'courier-route' }); step(s, 'courier-route', 'ORDINARY_CHECK'); step(s, 'courier-route', 'EXECUTE_ACTION'); finish(s, 'courier-route'); expect([s.spirituality, s.mind]).toEqual([4, 1]);
    const poor = ready(); step(poor, 'courier-route', 'OBSERVE'); poor.actionsRemaining = 1; reject(poor, { type: 'PREPARE', caseId: 'courier-route', method: 'ORDINARY' });
  });
  it('cannot advance another scene, reopen a completed report or act after death; unstarted preparation can be withdrawn without refund', () => {
    const s = ready(); step(s, 'courier-route', 'OBSERVE'); act(s, { type: 'PREPARE', caseId: 'courier-route', method: 'ABILITY' }); step(s, 'courier-route', 'WITHDRAW'); expect(s.actionsRemaining).toBe(98); expect(s.frenzyMage.life.cases['courier-route'].withdrawals).toBe(1); expect(hasFrenzyMageLifeLock(s)).toBe(false);
    reject(s, { type: 'OBSERVE', caseId: 'withdrawn-route' }); act(s, { type: 'PREPARE', caseId: 'courier-route', method: 'ORDINARY' }); step(s, 'courier-route', 'START_CASE'); cast(s, 'courier-route'); step(s, 'courier-route', 'EXECUTE_ACTION'); finish(s, 'courier-route');
    reject(s, { type: 'START_CASE', caseId: 'courier-route' }); reject(s, { type: 'REPORT_CASE', caseId: 'courier-route' }); s.status = 'DEAD'; s.health = 0; reject(s, { type: 'OBSERVE', caseId: 'withdrawn-route' });
  });
  it('projects only typed domain-authorized commands and preserves honest pending-versus-applied facts', () => {
    const s = ready(); start(s, 'courier-route'); cast(s, 'courier-route'); const p = projectFrenzyMageLife(s);
    expect(p.currentAttempt).toMatchObject({ pendingRemainingSeconds: 30, actionExecutions: 0, modifierApplied: false }); expect(p.currentAttempt?.abilityCheck).toMatchObject({ roll: 1, chance: 70, difficulty: 20 }); expect(p.facts.join(' ')).toContain('待用偏转30秒');
    for (const a of frenzyMageLifeActions(s)) { expect(validateFrenzyMageActivityCommand(a.command)).toBe(true); expect(a.enabled).toBe(blockFrenzyMageLife(s, a.command) === null); }
  });
  it('rejects extra fields, luck/event commands, wrong-case return commands and supplied outcomes', () => {
    for (const bad of [{ type: 'PERFORM', caseId: 'courier-route', roll: 1 }, { type: 'EXECUTE_ACTION', caseId: 'courier-route', result: 'C' }, { type: 'REFLECT', caseId: 'courier-route' }, { type: 'ACCUMULATE' }, { type: 'DRAW_TAG', caseId: 'withdrawn-route' }, { type: 'RETURN_PERSON', caseId: 'own-throw' }, { type: 'TAKE_OBJECT', caseId: 'courier-route' }, { type: 'RETURN_A', caseId: 'courier-route' }, { type: 'WITHDRAW_CONSENT', caseId: 'own-throw' }, { type: 'CONFIRM_LIMITED', caseId: 'courier-route', claim: 'LIMITED' }]) expect(validateFrenzyMageActivityCommand(bad)).toBe(false);
  });
  it('replays and rejects forged original bodies, ownership, routes, clocks, fees, consent, duplicate actions, checks and mastery', () => {
    const s = ready(); for (const id of FRENZY_MAGE_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' });
    const mutations: ((v: SliceState) => void)[] = [
      v => { attempt(v, 'courier-route').actionResult = 'B'; }, v => { attempt(v, 'courier-route').actionExecutions = 2; }, v => { attempt(v, 'courier-route').modifierApplied = false; }, v => { attempt(v, 'courier-route').expressedAction = null; },
      v => { attempt(v, 'courier-route').spiritualitySpent = 0; }, v => { attempt(v, 'courier-route').mindSpent = 0; }, v => { attempt(v, 'courier-route').abilityCheck = { ...attempt(v, 'courier-route').abilityCheck!, chance: 100 }; }, v => { attempt(v, 'courier-route').abilityTier = 'FAILURE'; },
      v => { attempt(v, 'courier-route').personMoves[0]!.to = 'B'; }, v => { attempt(v, 'courier-route').playerMoves[1]!.metres = 0 as 4; }, v => { attempt(v, 'courier-route').guideMoves = []; }, v => { attempt(v, 'courier-route').objectMoves[0]!.itemIds = []; },
      v => { v.frenzyMage.life.parcel.location = 'C'; }, v => { v.frenzyMage.life.parcel.quantity = 2 as 1; }, v => { v.frenzyMage.life.parcel.massGrams = 401 as 400; }, v => { v.frenzyMage.life.volunteer.health = 99 as 100; }, v => { v.frenzyMage.life.volunteer.location = 'B'; },
      v => { v.frenzyMage.life.paper.text = '从A到C' as '从A到B'; }, v => { v.frenzyMage.life.paper.holder = 'PLAYER'; }, v => { v.frenzyMage.life.ball.throws = 2; }, v => { v.frenzyMage.life.ball.returns = 0; },
      v => { attempt(v, 'withdrawn-route').modifierApplied = true; }, v => { attempt(v, 'withdrawn-route').consent = 'GRANTED'; }, v => { attempt(v, 'withdrawn-route').modifierCancelled = false; }, v => { attempt(v, 'own-throw').objectTaken = false; }, v => { attempt(v, 'own-throw').limitedConfirmed = false; },
      v => { attempt(v, 'own-throw').steps.find(x => x.type === 'EXECUTE_ACTION')!.atSecond++; }, v => { Object.assign(attempt(v, 'own-throw').steps.find(x => x.type === 'EXECUTE_ACTION')!, { eventRoll: 1 }); },
      v => { v.frenzyMage.life.clockSeconds++; }, v => { v.progression.mastery[ABILITY] = 24; }, v => { Object.assign(v.frenzyMage.life, { luck: { stored: 3 } }); },
    ];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateFrenzyMageLife(copy)).toBe(false); }
  });
  it('accepts clock API alias but rejects unbacked increments or noninteger durations', () => {
    const s = ready(); expect(advanceFrenzyMageLifeClock).toBe(advanceFrenzyMageClock); expect(() => advanceFrenzyMageClock(s, -1)).toThrow(); expect(() => advanceFrenzyMageClock(s, 0.5)).toThrow(); advanceFrenzyMageClock(s, 60); expect(validateFrenzyMageLife(s)).toBe(false);
  });
});
