import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createUnagingDemonessState } from '../../src/domain/unaging-demoness/index.js';
import { advanceUnagingDemonessLifeClock, applyUnagingDemonessActivity, blockUnagingDemonessLife, createUnagingDemonessLifeState, hasUnagingDemonessLifeLock, projectUnagingDemonessLife, UNAGING_DEMONESS_CASE_IDS, unagingDemonessLifeActions, validateUnagingDemonessActivityCommand, validateUnagingDemonessLife, type UnagingDemonessActivityCommand, type UnagingDemonessCaseId } from '../../src/domain/unaging-demoness/life.js';

const ABILITY = 'assassin.s3.mirror-passage';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Explicitly directed, isolated life fixture; does not claim natural promotion. */
function ready(): SliceState {
  const s = createSliceRun('unaging-life', sliceDefaultCreationSelection, 'unaging-life');
  s.unagingDemoness = createUnagingDemonessState(); s.week = 110; s.unagingDemoness.promotionWeek = 109; s.unagingDemoness.despairActingAtPromotion = 100;
  s.progression = { pathwayId: 'demoness', sequence: 3, acting: 0, promotionWeek: 109, mastery: { [ABILITY]: 0, 'assassin.s4.plague': 17, 'assassin.s7.black-flame': 0 } };
  s.activeEvent = null; s.eventQueue = []; s.combat = null; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.injuries = [];
  s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 }; return s;
}
function act(s: SliceState, command: UnagingDemonessActivityCommand, roll = 1) { const ctx = context(s, roll); applyUnagingDemonessActivity(s, command, ctx); expect(validateUnagingDemonessLife(s), `${command.type}: ${JSON.stringify(s.unagingDemoness.life)}`).toBe(true); return ctx; }
function step(s: SliceState, caseId: UnagingDemonessCaseId, type: Exclude<UnagingDemonessActivityCommand['type'], 'PREPARE' | 'REFLECT'>, roll = 1) { return act(s, { type, caseId } as UnagingDemonessActivityCommand, roll); }
function reject(s: SliceState, command: UnagingDemonessActivityCommand) { const before = structuredClone(s), ctx = context(s); expect(() => applyUnagingDemonessActivity(s, command, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
const attempt = (s: SliceState, id: UnagingDemonessCaseId) => s.unagingDemoness.life.cases[id].attempts.at(-1)!;
function start(s: SliceState, id: UnagingDemonessCaseId, method: 'ABILITY' | 'ORDINARY' = id === 'dated-record' ? 'ORDINARY' : 'ABILITY') { step(s, id, 'OBSERVE'); act(s, { type: 'PREPARE', caseId: id, method }); step(s, id, 'PERFORM'); }
function borrow(s: SliceState, id: UnagingDemonessCaseId, method: 'ABILITY' | 'ORDINARY' = id === 'dated-record' ? 'ORDINARY' : 'ABILITY') { start(s, id, method); step(s, id, 'CONSENT_OWNER'); step(s, id, 'TAKE_ITEM'); }
function close(s: SliceState, id: UnagingDemonessCaseId) { for (const type of ['RETURN_START', 'RETURN_ITEM', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, id, type); }
function dated(s: SliceState) { const id = 'dated-record'; borrow(s, id); for (const type of ['READ_OLD', 'LISTEN_CURRENT', 'GO_A', 'WRITE_RECORD'] as const) step(s, id, type); close(s, id); }
function arrive(s: SliceState, id: 'mirror-parcel' | 'blocked-exit', method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { borrow(s, id, method); for (const type of ['GO_A', 'CONSENT_OBSERVER', 'CHECK_MIRRORS'] as const) step(s, id, type); }
function parcel(s: SliceState, enterRoll = 1, exitRoll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'mirror-parcel'; arrive(s, id, method);
  if (method === 'ABILITY') { step(s, id, 'ENTER_A', enterRoll); if (attempt(s, id).entered) { step(s, id, 'WALK_INNER_B'); step(s, id, 'EXIT_B', exitRoll); if (!attempt(s, id).exitedB) { step(s, id, 'RETURN_INNER_A'); step(s, id, 'RETURN_ENTRY'); } } }
  if (s.unagingDemoness.life.playerLocation === 'A') step(s, id, 'WALK_B'); step(s, id, 'DELIVER_PARCEL'); step(s, id, 'RETURN_A'); close(s, id);
}
function blocked(s: SliceState, enterRoll = 1, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const id = 'blocked-exit'; arrive(s, id, method); step(s, id, 'CLOSE_SHUTTER');
  if (method === 'ABILITY') { step(s, id, 'ENTER_A', enterRoll); if (attempt(s, id).entered) { for (const type of ['WALK_INNER_B', 'CHECK_BLOCKED', 'RETURN_INNER_A', 'RETURN_ENTRY'] as const) step(s, id, type); } }
  step(s, id, 'WALK_B'); if (!attempt(s, id).blockedObserved) step(s, id, 'CHECK_BLOCKED'); step(s, id, 'OPEN_SHUTTER'); step(s, id, 'RETURN_A'); close(s, id);
}

describe('Unaging Demoness same-body finite original life', () => {
  it('has one original of each item, two actual mirrors, consenting adults and one shutter test', () => {
    const s = ready(), l = s.unagingDemoness.life; expect(validateUnagingDemonessLife(s)).toBe(true); expect(l).toEqual(createUnagingDemonessLifeState());
    expect(l.vera).toMatchObject({ id: 'UD3-VERA', age: 46, location: 'START' }); expect(l.marcus).toMatchObject({ id: 'UD3-MARCUS', age: 41, location: 'B' });
    expect(l.parcel).toMatchObject({ id: 'UD3-PARCEL', quantity: 1, massGrams: 800, location: 'OWNER' }); expect(l.mirrorA).toMatchObject({ location: 'A', intact: true }); expect(l.mirrorB).toMatchObject({ location: 'B', intact: true }); expect(l.shutter).toMatchObject({ state: 'OPEN', remainingTests: 1, operator: 'UD3-MARCUS' });
  });
  it('requires old source then current spoken explanation and real four-metre walking, without a false power reward', () => {
    const s = ready(), character = structuredClone(s.character); borrow(s, 'dated-record'); reject(s, { type: 'LISTEN_CURRENT', caseId: 'dated-record' }); reject(s, { type: 'GO_A', caseId: 'dated-record' });
    step(s, 'dated-record', 'READ_OLD'); step(s, 'dated-record', 'LISTEN_CURRENT'); step(s, 'dated-record', 'GO_A'); const ctx = step(s, 'dated-record', 'WRITE_RECORD'); expect(ctx.check).not.toHaveBeenCalled(); reject(s, { type: 'CLOSE', caseId: 'dated-record' }); close(s, 'dated-record');
    expect(s.unagingDemoness.life.register).toMatchObject({ id: 'UD3-REGISTER', location: 'A', written: true, oldNameRead: '维瑞娜·肖', oldDateRead: { epoch: 'FIFTH_EPOCH', year: 1330, month: 5, day: 14 }, writtenDate: s.date }); expect(s.unagingDemoness.life.portrait).toMatchObject({ location: 'OWNER', travelMetres: 8 }); expect(s.character).toEqual(character); expect(s.spirituality).toBe(120); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('pays two separate six-spirituality rolls and carries the same package through real inner steps', () => {
    const s = ready(); dated(s); arrive(s, 'mirror-parcel'); const first = step(s, 'mirror-parcel', 'ENTER_A'); expect(first.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(114); expect(s.unagingDemoness.life.playerLocation).toBe('INNER_A'); expect(s.unagingDemoness.life.entry).toMatchObject({ held: true, returnStepsRemaining: 1 });
    reject(s, { type: 'EXIT_B', caseId: 'mirror-parcel' }); reject(s, { type: 'DELIVER_PARCEL', caseId: 'mirror-parcel' }); step(s, 'mirror-parcel', 'WALK_INNER_B'); const second = step(s, 'mirror-parcel', 'EXIT_B'); expect(second.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(108); expect(s.unagingDemoness.life.playerLocation).toBe('B'); expect(s.unagingDemoness.life.entry.held).toBe(false);
    step(s, 'mirror-parcel', 'DELIVER_PARCEL'); expect(s.unagingDemoness.life.parcel).toMatchObject({ location: 'RECEIVER', travelMetres: 12 }); expect(s.unagingDemoness.life.receipt.location).toBe('PLAYER'); expect(s.progression.mastery[ABILITY]).toBe(0);
    reject(s, { type: 'RETURN_START', caseId: 'mirror-parcel' }); step(s, 'mirror-parcel', 'RETURN_A'); expect(projectUnagingDemonessLife(s).nextStep).toContain('实际走回START'); expect(unagingDemonessLifeActions(s).some(v => v.command.type === 'WALK_B')).toBe(false); close(s, 'mirror-parcel'); expect(s.progression.mastery[ABILITY]).toBe(8); expect(s.unagingDemoness.life.receipt).toMatchObject({ location: 'OWNER', travelMetres: 22 });
    expect(attempt(s, 'mirror-parcel').playerMoves.map(m => [m.from, m.to, m.metres])).toEqual([['START', 'A', 4], ['A', 'INNER_A', 1], ['INNER_A', 'INNER_B', 6], ['INNER_B', 'B', 1], ['B', 'A', 18], ['A', 'START', 4]]);
  });
  it('keeps a failed entry at A and permits ordinary physical delivery without mastery or refund', () => {
    const s = ready(); dated(s); parcel(s, 100); const a = attempt(s, 'mirror-parcel'); expect(a).toMatchObject({ entryTier: 'GREAT_FAILURE', entered: false, exitTier: null, result: 'ORDINARY', spiritualitySpent: 6, playerTravelMetres: 44 }); expect(s.spirituality).toBe(114); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.unagingDemoness.life.parcel).toMatchObject({ location: 'RECEIVER', travelMetres: 22 });
  });
  it('keeps a failed B exit in INNER_B until six metres back and one original entry step out', () => {
    const s = ready(); dated(s); arrive(s, 'mirror-parcel'); step(s, 'mirror-parcel', 'ENTER_A'); step(s, 'mirror-parcel', 'WALK_INNER_B'); step(s, 'mirror-parcel', 'EXIT_B', 100);
    expect(s.unagingDemoness.life.playerLocation).toBe('INNER_B'); expect(s.unagingDemoness.life.parcel.location).toBe('PLAYER'); expect(s.spirituality).toBe(108); reject(s, { type: 'RETURN_ENTRY', caseId: 'mirror-parcel' }); reject(s, { type: 'RETURN_START', caseId: 'mirror-parcel' }); reject(s, { type: 'EXIT_B', caseId: 'mirror-parcel' });
    step(s, 'mirror-parcel', 'RETURN_INNER_A'); expect(s.unagingDemoness.life.playerLocation).toBe('INNER_A'); step(s, 'mirror-parcel', 'RETURN_ENTRY'); expect(s.unagingDemoness.life.playerLocation).toBe('A'); expect(s.unagingDemoness.life.entry).toMatchObject({ held: false, returnStepsRemaining: 0 }); expect(s.spirituality).toBe(108); reject(s, { type: 'ENTER_A', caseId: 'mirror-parcel' });
    for (const type of ['WALK_B', 'DELIVER_PARCEL', 'RETURN_A'] as const) step(s, 'mirror-parcel', type); close(s, 'mirror-parcel'); expect(attempt(s, 'mirror-parcel')).toMatchObject({ spiritualitySpent: 12, playerTravelMetres: 58, result: 'ORDINARY' }); expect(s.progression.mastery[ABILITY]).toBe(0);
  });
  it('retains safe actual return at zero spirituality, zero AP and zero mind without free remote teleport', () => {
    const s = ready(); dated(s); arrive(s, 'mirror-parcel'); step(s, 'mirror-parcel', 'ENTER_A'); step(s, 'mirror-parcel', 'WALK_INNER_B'); s.spirituality = 0; s.actionsRemaining = 0; s.mind = 0;
    reject(s, { type: 'EXIT_B', caseId: 'mirror-parcel' }); step(s, 'mirror-parcel', 'STOP_CONTACT'); reject(s, { type: 'WITHDRAW', caseId: 'mirror-parcel' });
    for (const type of ['RETURN_INNER_A', 'RETURN_ENTRY', 'RETURN_START', 'RETURN_ITEM', 'INSPECT', 'WITHDRAW'] as const) step(s, 'mirror-parcel', type);
    expect(s.spirituality).toBe(0); expect(s.actionsRemaining).toBe(0); expect(hasUnagingDemonessLifeLock(s)).toBe(false); expect(s.unagingDemoness.life.parcel).toMatchObject({ location: 'OWNER', travelMetres: 22 }); expect(attempt(s, 'mirror-parcel').result).toBe('ORDINARY');
  });
  it('requires actual local take-back before redelivery and never teleports the receiver-held package', () => {
    const s = ready(); dated(s); arrive(s, 'mirror-parcel', 'ORDINARY'); step(s, 'mirror-parcel', 'WALK_B'); step(s, 'mirror-parcel', 'DELIVER_PARCEL'); step(s, 'mirror-parcel', 'TAKE_BACK_PARCEL'); expect(s.unagingDemoness.life.parcel.location).toBe('PLAYER'); expect(s.unagingDemoness.life.receipt.location).toBe('RECEIVER'); reject(s, { type: 'RETURN_A', caseId: 'mirror-parcel' }); step(s, 'mirror-parcel', 'DELIVER_PARCEL'); step(s, 'mirror-parcel', 'RETURN_A'); reject(s, { type: 'TAKE_BACK_PARCEL', caseId: 'mirror-parcel' }); close(s, 'mirror-parcel'); expect(attempt(s, 'mirror-parcel')).toMatchObject({ handovers: 2, parcelRetrievals: 1, result: 'ORDINARY' });
  });
  it('closes the original B shutter once and demands actual inner return plus outside request to its operator', () => {
    const s = ready(); dated(s); parcel(s); arrive(s, 'blocked-exit'); step(s, 'blocked-exit', 'CLOSE_SHUTTER'); expect(s.unagingDemoness.life.shutter).toMatchObject({ state: 'CLOSED', remainingTests: 0, closures: 1 }); step(s, 'blocked-exit', 'ENTER_A'); step(s, 'blocked-exit', 'WALK_INNER_B'); step(s, 'blocked-exit', 'CHECK_BLOCKED');
    reject(s, { type: 'EXIT_B', caseId: 'blocked-exit' } as UnagingDemonessActivityCommand); reject(s, { type: 'OPEN_SHUTTER', caseId: 'blocked-exit' }); reject(s, { type: 'CLOSE', caseId: 'blocked-exit' }); for (const type of ['RETURN_INNER_A', 'RETURN_ENTRY'] as const) step(s, 'blocked-exit', type);
    expect(s.unagingDemoness.life.shutter.state).toBe('CLOSED'); reject(s, { type: 'RETURN_START', caseId: 'blocked-exit' }); reject(s, { type: 'OPEN_SHUTTER', caseId: 'blocked-exit' }); step(s, 'blocked-exit', 'WALK_B'); step(s, 'blocked-exit', 'OPEN_SHUTTER'); expect(s.unagingDemoness.life.shutter).toMatchObject({ state: 'OPEN', remainingTests: 0, reopenings: 1 }); step(s, 'blocked-exit', 'RETURN_A'); close(s, 'blocked-exit'); expect(s.progression.mastery[ABILITY]).toBe(16); expect(s.unagingDemoness.life.testSign).toMatchObject({ signed: true, location: 'OWNER', travelMetres: 58 });
  });
  it('uses the ordinary shutter route after a failed entry and does not invent a successful ability', () => {
    const s = ready(); dated(s); parcel(s, 100); blocked(s, 100); expect(attempt(s, 'blocked-exit')).toMatchObject({ entryTier: 'GREAT_FAILURE', entered: false, blockedObserved: true, shutterOpened: true, result: 'ORDINARY', playerTravelMetres: 44 }); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.unagingDemoness.life.shutter.remainingTests).toBe(0);
  });
  it('requires explicit consent each case and never rolls over an original owner refusal', () => {
    const s = ready(); start(s, 'dated-record'); s.unagingDemoness.life.vera.willing = false; const ctx = step(s, 'dated-record', 'CONSENT_OWNER'); expect(ctx.check).not.toHaveBeenCalled(); expect(attempt(s, 'dated-record').ownerConsent).toBe('DECLINED'); reject(s, { type: 'TAKE_ITEM', caseId: 'dated-record' }); for (const type of ['STOP_CONTACT', 'INSPECT', 'CLOSE', 'REPORT'] as const) step(s, 'dated-record', type); expect(s.unagingDemoness.life.playerTravelMetres).toBe(0); expect(s.unagingDemoness.life.portrait.location).toBe('OWNER');
    s.unagingDemoness.life.vera.willing = true; start(s, 'mirror-parcel'); reject(s, { type: 'TAKE_ITEM', caseId: 'mirror-parcel' }); expect(attempt(s, 'mirror-parcel').ownerConsent).toBe('UNASKED');
  });
  it('honors the actual observer refusal and permits real ordinary return', () => {
    const s = ready(); dated(s); borrow(s, 'mirror-parcel'); step(s, 'mirror-parcel', 'GO_A'); s.unagingDemoness.life.marcus.willing = false; const ctx = step(s, 'mirror-parcel', 'CONSENT_OBSERVER'); expect(ctx.check).not.toHaveBeenCalled(); reject(s, { type: 'CHECK_MIRRORS', caseId: 'mirror-parcel' }); reject(s, { type: 'ENTER_A', caseId: 'mirror-parcel' }); step(s, 'mirror-parcel', 'STOP_CONTACT'); close(s, 'mirror-parcel'); expect(s.unagingDemoness.life.parcel).toMatchObject({ location: 'OWNER', travelMetres: 8 }); expect(s.spirituality).toBe(120);
  });
  it('still requires reopening the real closed shutter after withdrawal of consent', () => {
    const s = ready(); dated(s); parcel(s); arrive(s, 'blocked-exit'); step(s, 'blocked-exit', 'CLOSE_SHUTTER'); s.unagingDemoness.life.vera.willing = false; s.unagingDemoness.life.marcus.willing = false; s.actionsRemaining = 0; s.spirituality = 0;
    step(s, 'blocked-exit', 'STOP_CONTACT'); reject(s, { type: 'CLOSE', caseId: 'blocked-exit' }); reject(s, { type: 'RETURN_START', caseId: 'blocked-exit' }); for (const type of ['WALK_B', 'OPEN_SHUTTER', 'RETURN_A', 'RETURN_START', 'RETURN_ITEM', 'INSPECT', 'WITHDRAW'] as const) step(s, 'blocked-exit', type); expect(hasUnagingDemonessLifeLock(s)).toBe(false); expect(s.unagingDemoness.life.shutter).toMatchObject({ state: 'OPEN', remainingTests: 0 }); expect(attempt(s, 'blocked-exit').result).toBe('ORDINARY');
  });
  it('completes the thirteen AP route with eighteen spirituality, finite rewards and untouched old six roots', () => {
    const s = ready(), old = structuredClone({ assassin: s.assassin, instigator: s.instigator, witch: s.witch, pleasure: s.pleasure, pain: s.pain, despair: s.despair }), character = structuredClone(s.character); dated(s); parcel(s); blocked(s); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(102); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toMatchObject({ [ABILITY]: 16, 'assassin.s4.plague': 17, 'assassin.s7.black-flame': 0 }); expect(s.character).toEqual(character); expect({ assassin: s.assassin, instigator: s.instigator, witch: s.witch, pleasure: s.pleasure, pain: s.pain, despair: s.despair }).toEqual(old);
    expect(s.unagingDemoness.life.playerTravelMetres).toBe(100); expect(s.unagingDemoness.life.clockSeconds).toBe(UNAGING_DEMONESS_CASE_IDS.reduce((n, id) => n + attempt(s, id).elapsedSeconds, 0)); expect(hasUnagingDemonessLifeLock(s)).toBe(false); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'mirror-parcel' });
  });
  it('allows all three ordinary cases at zero spirituality without new ability reward', () => {
    const s = ready(); s.spirituality = 0; dated(s); parcel(s, 1, 1, 'ORDINARY'); blocked(s, 1, 'ORDINARY'); act(s, { type: 'REFLECT' }); expect(s.actionsRemaining).toBe(87); expect(s.spirituality).toBe(0); expect(s.progression.acting).toBe(100); expect(s.progression.mastery[ABILITY]).toBe(0); expect(s.unagingDemoness.life.playerTravelMetres).toBe(96); expect(s.unagingDemoness.life.shutter.remainingTests).toBe(0);
  });
  it('projects insufficient B-exit spirituality with the actual available six-metre return step', () => {
    const s = ready(); dated(s); arrive(s, 'mirror-parcel'); step(s, 'mirror-parcel', 'ENTER_A'); step(s, 'mirror-parcel', 'WALK_INNER_B'); s.spirituality = 5; const actions = unagingDemonessLifeActions(s); expect(actions.find(a => a.command.type === 'EXIT_B')).toMatchObject({ enabled: false }); expect(actions.find(a => a.command.type === 'RETURN_INNER_A')).toMatchObject({ enabled: true }); expect(projectUnagingDemonessLife(s).nextStep).toContain('走回INNER_A'); expect(s.spirituality).toBe(5);
  });
  it('requires AP reserve, supports cancellation without refund and keeps dead body location', () => {
    const s = ready(); step(s, 'dated-record', 'OBSERVE'); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'dated-record', method: 'ORDINARY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'dated-record', method: 'ORDINARY' }); step(s, 'dated-record', 'WITHDRAW'); expect(s.actionsRemaining).toBe(1); expect(hasUnagingDemonessLifeLock(s)).toBe(false);
    s.actionsRemaining = 10; act(s, { type: 'PREPARE', caseId: 'dated-record', method: 'ORDINARY' }); step(s, 'dated-record', 'PERFORM'); step(s, 'dated-record', 'CONSENT_OWNER'); step(s, 'dated-record', 'TAKE_ITEM'); s.health = 0; s.status = 'DEAD'; expect(validateUnagingDemonessLife(s)).toBe(true); reject(s, { type: 'RETURN_ITEM', caseId: 'dated-record' }); expect(s.unagingDemoness.life.portrait.location).toBe('PLAYER');
  });
  it('round trips active inner location, original resources and complete epoch-bearing dates', () => {
    const s = ready(); dated(s); arrive(s, 'mirror-parcel'); step(s, 'mirror-parcel', 'ENTER_A'); step(s, 'mirror-parcel', 'WALK_INNER_B'); const loaded = JSON.parse(JSON.stringify(s)) as SliceState; expect(validateUnagingDemonessLife(loaded)).toBe(true); expect(loaded.unagingDemoness.life).toEqual(s.unagingDemoness.life); step(loaded, 'mirror-parcel', 'EXIT_B'); expect(loaded.unagingDemoness.life.playerLocation).toBe('B'); delete (loaded.unagingDemoness.life.introducedDate as Partial<NonNullable<typeof loaded.unagingDemoness.life.introducedDate>>).epoch; expect(validateUnagingDemonessLife(loaded)).toBe(false);
  });
  it('includes actual sixty-second combat rounds before introduction and after life or death', () => {
    const s = ready(); s.unagingDemoness.promotionWeek = null; s.progression.sequence = 4; s.combatHistory.push({ unagingDemonessOutcome: { elapsedSeconds: 60 } } as unknown as SliceState['combatHistory'][number]); advanceUnagingDemonessLifeClock(s, 60); expect(validateUnagingDemonessLife(s)).toBe(true); expect(s.unagingDemoness.life.introducedDate).toBeNull(); s.unagingDemoness.promotionWeek = 109; s.progression.sequence = 3; dated(s); parcel(s); blocked(s); act(s, { type: 'REFLECT' }); s.combatHistory.push({ unagingDemonessOutcome: { elapsedSeconds: 60 } } as unknown as SliceState['combatHistory'][number]); advanceUnagingDemonessLifeClock(s, 60); s.status = 'DEAD'; s.health = 0; expect(validateUnagingDemonessLife(s)).toBe(true); s.unagingDemoness.life.clockSeconds--; expect(validateUnagingDemonessLife(s)).toBe(false);
  });
  it('returns detached projections with original facts, costs and actual location-aware controls', () => {
    const s = ready(); expect(unagingDemonessLifeActions(s).map(a => a.command.type)).toEqual(['OBSERVE']); dated(s); arrive(s, 'mirror-parcel'); const view = projectUnagingDemonessLife(s); expect(view.facts.join(' ')).toContain('UD3-SHUTTER'); expect(view.facts.join(' ')).toContain('UD3-PARCEL'); expect(view.nextStep).toContain('尝试本体进入'); view.parcel.travelMetres = 999; view.currentAttempt!.playerMoves[0]!.metres = 999; view.cases[0]!.attempts[0]!.steps[0]!.veraWilling = false; expect(s.unagingDemoness.life.parcel.travelMetres).toBe(4); expect(attempt(s, 'mirror-parcel').playerMoves[0]!.metres).toBe(4); expect(attempt(s, 'dated-record').steps[0]!.veraWilling).toBe(true);
  });
  it('rejects copied objects, fake return, refilled shutter, forged costs, records, routes and rewards', () => {
    const s = ready(); dated(s); parcel(s); blocked(s); act(s, { type: 'REFLECT' });
    const mutations: ((v: SliceState) => void)[] = [v => { (v.unagingDemoness.life.parcel as { quantity: number }).quantity = 2; }, v => { v.unagingDemoness.life.parcel.location = 'OWNER'; }, v => { v.unagingDemoness.life.parcel.travelMetres = 0; }, v => { v.unagingDemoness.life.shutter.remainingTests = 1; }, v => { v.unagingDemoness.life.shutter.reopenings = 0; }, v => { v.unagingDemoness.life.entry.held = true; }, v => { v.unagingDemoness.life.playerLocation = 'INNER_B'; }, v => { v.unagingDemoness.life.register.oldNameRead = '伪造人物'; }, v => { v.unagingDemoness.life.register.oldDateRead!.year++; }, v => { v.unagingDemoness.life.clockSeconds++; }, v => { attempt(v, 'mirror-parcel').spiritualitySpent = 6; }, v => { attempt(v, 'mirror-parcel').playerMoves[2]!.metres = 0; }, v => { attempt(v, 'blocked-exit').steps = []; }, v => { attempt(v, 'dated-record').result = 'ABILITY'; }, v => { v.seer.completedSources.push('unaging-demoness-reflection'); }, v => { v.progression.acting = 99; }];
    for (const mutate of mutations) { const copy = structuredClone(s); mutate(copy); expect(validateUnagingDemonessLife(copy)).toBe(false); }
  });
  it('rejects invalid tiers, impossible dates, nonintegral clocks and unsupported new magic', () => {
    const s = ready(); dated(s); parcel(s); const bad = structuredClone(s); (attempt(bad, 'mirror-parcel').steps.find(v => v.type === 'ENTER_A') as { tier: string }).tier = 'AUTO_SUCCESS'; expect(validateUnagingDemonessLife(bad)).toBe(false); const date = structuredClone(s); date.unagingDemoness.life.introducedDate = { epoch: 'FIFTH_EPOCH', year: 1351, month: 2, day: 30 }; expect(validateUnagingDemonessLife(date)).toBe(false); expect(() => advanceUnagingDemonessLifeClock(s, -1)).toThrow(); s.combatHistory.push({ unagingDemonessOutcome: { elapsedSeconds: 0.5 } } as unknown as SliceState['combatHistory'][number]); expect(validateUnagingDemonessLife(s)).toBe(false);
    for (const command of [{ type: 'PREPARE', caseId: 'dated-record', method: 'ABILITY' }, { type: 'EXIT_B', caseId: 'blocked-exit' }, { type: 'REFLECT', caseId: 'dated-record' }, { type: 'ENTER_A', caseId: 'mirror-parcel', target: 'ANY_GLOBAL_MIRROR' }, { type: 'RESURRECT', caseId: 'mirror-parcel' }, { type: 'READ_MIND', caseId: 'dated-record' }, { type: 'OPEN_SHUTTER', caseId: 'mirror-parcel' }, { type: 'CONSENT_OWNER', caseId: 'dated-record', forced: true }]) expect(validateUnagingDemonessActivityCommand(command)).toBe(false);
    const stage = ready(); expect(blockUnagingDemonessLife(stage, { type: 'OBSERVE', caseId: 'mirror-parcel' })).not.toBeNull(); stage.progression.sequence = 4; reject(stage, { type: 'OBSERVE', caseId: 'dated-record' }); stage.progression.sequence = 2; reject(stage, { type: 'OBSERVE', caseId: 'dated-record' }); stage.progression.sequence = 3; stage.progression.pathwayId = 'error'; reject(stage, { type: 'OBSERVE', caseId: 'dated-record' });
  });
});
