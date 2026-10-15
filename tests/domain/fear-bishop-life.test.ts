import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createFearBishopState } from '../../src/domain/fear-bishop/index.js';
import { FEAR_BISHOP_ABILITY_IDS } from '../../src/domain/fear-bishop/types.js';
import { applyFearBishopActivity, blockFearBishopLife, createFearBishopLifeState, FEAR_BISHOP_CASE_IDS, hasFearBishopLifeLock, projectFearBishopLife, validateFearBishopActivityCommand, validateFearBishopLife, type FearBishopActivityCommand, type FearBishopCaseId } from '../../src/domain/fear-bishop/life.js';
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Explicit isolated post-promotion state; natural acquisition belongs to the unchanged-seed public replay. */
function ready(): SliceState {
  const s = createSliceRun('fear-bishop-life', sliceDefaultCreationSelection, 'fear-bishop-life');
  s.fearBishop = createFearBishopState(); s.week = 20; s.fearBishop.promotionWeek = 19;
  s.progression = { pathwayId: 'darkness', sequence: 3, acting: 0, promotionWeek: 19, mastery: Object.fromEntries(FEAR_BISHOP_ABILITY_IDS.map(id => [id, 0])) };
  s.activeEvent = null; s.eventQueue = []; s.world.city = 'BACKLUND'; s.health = 100; s.mind = 100; s.spirituality = 120; s.actionsRemaining = 100; s.cash = 1000; s.character.coreStats = { physique: 30, perception: 30, will: 30, knowledge: 30 };
  return s;
}
function act(s: SliceState, command: FearBishopActivityCommand, roll = 1) { const ctx = context(s, roll); applyFearBishopActivity(s, command, ctx); expect(validateFearBishopLife(s), `${command.type}: ${JSON.stringify(s.fearBishop.life)}`).toBe(true); return ctx; }
function reject(s: SliceState, command: FearBishopActivityCommand) { const before = structuredClone(s); expect(() => applyFearBishopActivity(s, command, context(s))).toThrow(); expect(s).toEqual(before); }
function start(s: SliceState, caseId: FearBishopCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { if (s.fearBishop.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); act(s, { type: 'PERFORM', caseId }); }
function close(s: SliceState, caseId: FearBishopCaseId) { act(s, { type: 'INSPECT', caseId }); act(s, { type: 'CLOSE', caseId }); }
function residueSetup(s: SliceState) { for (const type of ['READ_SOURCE', 'CONSENT_OWNER', 'PLACE_RESIDUE', 'CLEAR_BYSTANDERS'] as const) act(s, { type, caseId: 'contained-residue' }); }
function residueReturn(s: SliceState) { if (s.fearBishop.life.residue.status === 'ON_BENCH') act(s, { type: 'SEAL_RESIDUE', caseId: 'contained-residue' }); act(s, { type: 'RETURN_PLAYER', caseId: 'contained-residue' }); act(s, { type: 'RETURN_CONTAINER', caseId: 'contained-residue' }); }
function volunteerSetup(s: SliceState) { act(s, { type: 'CONSENT', caseId: 'stop-signal' }); act(s, { type: 'AGREE_STOP', caseId: 'stop-signal' }); }
function volunteerReturn(s: SliceState) { const a = attempt(s, 'stop-signal'); if (a.stopAgreed && a.stoppedBy === null) act(s, { type: 'STOP', caseId: 'stop-signal', actor: 'TOMAS' }); if (s.fearBishop.life.tomas.state === 'DROWSY') act(s, { type: 'WAKE', caseId: 'stop-signal' }); act(s, { type: 'CONFIRM_WAKE', caseId: 'stop-signal' }); act(s, { type: 'LEAVE_VOLUNTEER', caseId: 'stop-signal' }); }
function corridorSetup(s: SliceState) { for (const type of ['CONSENT_OWNER', 'CHECK_SIDE_ROUTE', 'APPROACH_CORRIDOR'] as const) act(s, { type, caseId: 'corridor-exit' }); }
function corridorReturn(s: SliceState) { act(s, { type: 'RETURN_PLAYER', caseId: 'corridor-exit' }); act(s, { type: 'RETURN_LAMP', caseId: 'corridor-exit' }); }
function finish(s: SliceState, caseId: FearBishopCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY', roll = 1) {
  start(s, caseId, method);
  if (caseId === 'contained-residue') { residueSetup(s); if (method === 'ABILITY') act(s, { type: 'DISSOLVE', caseId }, roll); residueReturn(s); }
  else if (caseId === 'stop-signal') { volunteerSetup(s); if (method === 'ABILITY') act(s, { type: 'SLEEP_FEAR', caseId }, roll); if (s.fearBishop.life.tomas.state === 'AWAKE') act(s, { type: 'ORDINARY_STORY', caseId }); volunteerReturn(s); }
  else { corridorSetup(s); if (method === 'ABILITY') act(s, { type: 'DISSOLVE', caseId }, roll); if (s.fearBishop.life.trace.status === 'PRESENT') act(s, { type: 'ISOLATE_TRACE', caseId }); act(s, { type: s.fearBishop.life.trace.status === 'DISSOLVED' ? 'WALK_CORRIDOR' : 'WALK_SIDE', caseId }); act(s, { type: 'TAKE_LAMP', caseId }); corridorReturn(s); }
  close(s, caseId); act(s, { type: 'REPORT', caseId });
}
const attempt = (s: SliceState, id: FearBishopCaseId) => s.fearBishop.life.cases[id].attempts.at(-1)!;
function toVolunteer(s: SliceState) { finish(s, 'contained-residue'); start(s, 'stop-signal'); }
function toCorridor(s: SliceState) { finish(s, 'contained-residue'); finish(s, 'stop-signal'); start(s, 'corridor-exit'); }

describe('Fear Bishop finite original residue, willing adult and real ordinary exits', () => {
  it('creates unique sourceful nonliving targets, current adult people and detached public projections', () => {
    const s = ready(), l = s.fearBishop.life; expect(validateFearBishopLife(s)).toBe(true);
    expect(l.residue).toMatchObject({ id: 'FB3-RESIDUE-1', owner: 'FB3-EDITH', alive: false, conscious: false, status: 'CONTAINED' });
    expect(l.tomas).toMatchObject({ id: 'FB3-TOMAS', age: 34, health: 100, mind: 100, state: 'AWAKE' });
    expect(l.edith).toMatchObject({ id: 'FB3-EDITH', age: 46 });
    const view = projectFearBishopLife(s); view.residue.status = 'DISSOLVED'; view.tomas.mind = 0; view.cases[0]!.attempts.push({} as never);
    expect(l.residue.status).toBe('CONTAINED'); expect(l.tomas.mind).toBe(100); expect(l.cases['contained-residue'].attempts).toEqual([]);
  });
  it('requires actual source, current permission, placement and cleared bystanders before dissolution', () => {
    const s = ready(); start(s, 'contained-residue'); reject(s, { type: 'CONSENT_OWNER', caseId: 'contained-residue' }); reject(s, { type: 'DISSOLVE', caseId: 'contained-residue' });
    act(s, { type: 'READ_SOURCE', caseId: 'contained-residue' }); reject(s, { type: 'PLACE_RESIDUE', caseId: 'contained-residue' }); act(s, { type: 'CONSENT_OWNER', caseId: 'contained-residue' }); act(s, { type: 'PLACE_RESIDUE', caseId: 'contained-residue' }); reject(s, { type: 'DISSOLVE', caseId: 'contained-residue' }); act(s, { type: 'CLEAR_BYSTANDERS', caseId: 'contained-residue' });
    expect(attempt(s, 'contained-residue')).toMatchObject({ sourceRead: true, ownerConsent: 'GRANTED', residuePlaced: true, bystandersClear: true, playerTravelMetres: 2 });
  });
  it('irreversibly dissolves the same original and separately returns its empty original glass container', () => {
    const s = ready(), original = s.fearBishop.life.residue; start(s, 'contained-residue'); residueSetup(s); const ctx = act(s, { type: 'DISSOLVE', caseId: 'contained-residue' });
    expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect(s.spirituality).toBe(114); expect(s.fearBishop.life.residue).toBe(original); expect(original).toMatchObject({ status: 'DISSOLVED', location: 'NONE' });
    reject(s, { type: 'DISSOLVE', caseId: 'contained-residue' }); reject(s, { type: 'SEAL_RESIDUE', caseId: 'contained-residue' }); reject(s, { type: 'CLOSE', caseId: 'contained-residue' });
    act(s, { type: 'RETURN_PLAYER', caseId: 'contained-residue' }); reject(s, { type: 'CLOSE', caseId: 'contained-residue' }); act(s, { type: 'RETURN_CONTAINER', caseId: 'contained-residue' }); close(s, 'contained-residue'); act(s, { type: 'REPORT', caseId: 'contained-residue' });
    expect(original.status).toBe('DISSOLVED'); expect(s.fearBishop.life.container.location).toBe('OWNER'); expect(s.progression.mastery['darkness.s3.dark-dissolution']).toBe(8); expect(s.fearBishop.life.playerTravelMetres).toBe(4);
  });
  it('charges failed dissolution once, keeps the original on the bench and seals it without rerolling', () => {
    const s = ready(); start(s, 'contained-residue'); residueSetup(s); act(s, { type: 'DISSOLVE', caseId: 'contained-residue' }, 100);
    expect(s.spirituality).toBe(114); expect(s.fearBishop.life.residue).toMatchObject({ status: 'ON_BENCH', location: 'BENCH' }); reject(s, { type: 'DISSOLVE', caseId: 'contained-residue' }); reject(s, { type: 'RETURN_PLAYER', caseId: 'contained-residue' });
    residueReturn(s); close(s, 'contained-residue'); act(s, { type: 'REPORT', caseId: 'contained-residue' });
    expect(s.fearBishop.life.residue).toMatchObject({ id: 'FB3-RESIDUE-1', status: 'SEALED', location: 'CONTAINER' }); expect(attempt(s, 'contained-residue')).toMatchObject({ abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, result: 'ORDINARY' }); expect(s.progression.mastery['darkness.s3.dark-dissolution']).toBe(0);
  });
  it('allows ordinary residue cleanup at zero AP, spirituality and player mind without refunding anything', () => {
    const s = ready(); start(s, 'contained-residue'); residueSetup(s); act(s, { type: 'DISSOLVE', caseId: 'contained-residue' }, 100); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    residueReturn(s); close(s, 'contained-residue'); expect(hasFearBishopLifeLock(s)).toBe(false); expect(s).toMatchObject({ actionsRemaining: 0, spirituality: 0, mind: 0 }); reject(s, { type: 'REPORT', caseId: 'contained-residue' });
  });
  it('honors a current owner refusal without destroying or moving the original', () => {
    const s = ready(); s.fearBishop.life.edith.willing = false; start(s, 'contained-residue'); act(s, { type: 'READ_SOURCE', caseId: 'contained-residue' }); act(s, { type: 'CONSENT_OWNER', caseId: 'contained-residue' });
    reject(s, { type: 'PLACE_RESIDUE', caseId: 'contained-residue' }); reject(s, { type: 'DISSOLVE', caseId: 'contained-residue' }); close(s, 'contained-residue'); act(s, { type: 'REPORT', caseId: 'contained-residue' }); expect(s.fearBishop.life.residue.status).toBe('CONTAINED'); expect(s.spirituality).toBe(120); expect(s.progression.acting).toBe(25);
  });
  it('does not reuse the previous owner permission as the adult volunteer current consent', () => {
    const s = ready(); toVolunteer(s); expect(attempt(s, 'stop-signal').consent).toBe('UNASKED'); reject(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' }); act(s, { type: 'CONSENT', caseId: 'stop-signal' }); reject(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' }); act(s, { type: 'AGREE_STOP', caseId: 'stop-signal' });
    expect(blockFearBishopLife(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' })).toBeNull();
  });
  it('charges real volunteer mind, honors his immediate stop, then requires waking and actual exit', () => {
    const s = ready(); toVolunteer(s); volunteerSetup(s); const ctx = act(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' });
    expect(ctx.check).toHaveBeenCalledExactlyOnceWith('will', 18); expect(s.spirituality).toBe(115); expect(s.fearBishop.life.tomas).toMatchObject({ state: 'DROWSY', mind: 98, health: 100, effectActive: true, remainingSeconds: 10 }); const clock = s.fearBishop.life.clockSeconds;
    act(s, { type: 'STOP', caseId: 'stop-signal', actor: 'TOMAS' }); expect(s.fearBishop.life.clockSeconds).toBe(clock); expect(s.fearBishop.life.tomas).toMatchObject({ state: 'DROWSY', mind: 98, effectActive: false, remainingSeconds: 0 }); reject(s, { type: 'CONFIRM_WAKE', caseId: 'stop-signal' }); reject(s, { type: 'CLOSE', caseId: 'stop-signal' });
    act(s, { type: 'WAKE', caseId: 'stop-signal' }); act(s, { type: 'CONFIRM_WAKE', caseId: 'stop-signal' }); act(s, { type: 'LEAVE_VOLUNTEER', caseId: 'stop-signal' }); close(s, 'stop-signal'); act(s, { type: 'REPORT', caseId: 'stop-signal' });
    expect(s.fearBishop.life.tomas).toMatchObject({ state: 'AWAKE', mind: 98, health: 100, location: 'EXIT', travelMetres: 2 }); expect(s.progression.mastery['darkness.s3.sleep-fear']).toBe(8); expect(attempt(s, 'stop-signal').stoppedBy).toBe('TOMAS');
  });
  it('also honors player stop before any ability, with no later reactivation or forced participation', () => {
    const s = ready(); toVolunteer(s); volunteerSetup(s); act(s, { type: 'STOP', caseId: 'stop-signal', actor: 'PLAYER' }); reject(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' }); reject(s, { type: 'ORDINARY_STORY', caseId: 'stop-signal' }); volunteerReturn(s); close(s, 'stop-signal'); act(s, { type: 'REPORT', caseId: 'stop-signal' }); expect(s.fearBishop.life.tomas.mind).toBe(100); expect(s.progression.mastery['darkness.s3.sleep-fear']).toBe(0); expect(s.spirituality).toBe(120);
  });
  it('a failed short sleep spends spirituality but no volunteer mind and permits an honest ordinary story', () => {
    const s = ready(); toVolunteer(s); volunteerSetup(s); act(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' }, 100); expect(s.fearBishop.life.tomas).toMatchObject({ state: 'AWAKE', mind: 100 }); expect(s.spirituality).toBe(115); reject(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' }); act(s, { type: 'ORDINARY_STORY', caseId: 'stop-signal' }); volunteerReturn(s); close(s, 'stop-signal'); act(s, { type: 'REPORT', caseId: 'stop-signal' }); expect(attempt(s, 'stop-signal')).toMatchObject({ abilityTier: 'GREAT_FAILURE', mindSpent: 0, result: 'ORDINARY' }); expect(s.progression.mastery['darkness.s3.sleep-fear']).toBe(0);
  });
  it('waking and ordinary volunteer exit remain possible at zero AP and zero player resources', () => {
    const s = ready(); toVolunteer(s); volunteerSetup(s); act(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' }); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; volunteerReturn(s); close(s, 'stop-signal'); expect(hasFearBishopLifeLock(s)).toBe(false); expect(s.fearBishop.life.tomas.mind).toBe(98);
  });
  it('respects adult refusal and records actual awake ordinary exit without forcing the exercise', () => {
    const s = ready(); toVolunteer(s); s.fearBishop.life.tomas.willing = false; act(s, { type: 'CONSENT', caseId: 'stop-signal' }); reject(s, { type: 'AGREE_STOP', caseId: 'stop-signal' }); reject(s, { type: 'SLEEP_FEAR', caseId: 'stop-signal' }); volunteerReturn(s); close(s, 'stop-signal'); act(s, { type: 'REPORT', caseId: 'stop-signal' }); expect(s.fearBishop.life.tomas).toMatchObject({ location: 'EXIT', mind: 100 });
  });
  it('does not use an inherited invitation or summon a replacement for either limited life task', () => {
    const s = ready(), old = structuredClone(s.spiritWarlock); for (const id of FEAR_BISHOP_CASE_IDS) finish(s, id); expect(s.spiritWarlock).toEqual(old); expect(projectFearBishopLife(s).story).toContain('全图隐秘');
  });
  it('requires current lamp commission, original side route inspection and actual approach before dissolution', () => {
    const s = ready(); toCorridor(s); reject(s, { type: 'DISSOLVE', caseId: 'corridor-exit' }); reject(s, { type: 'APPROACH_CORRIDOR', caseId: 'corridor-exit' }); act(s, { type: 'CONSENT_OWNER', caseId: 'corridor-exit' }); act(s, { type: 'CHECK_SIDE_ROUTE', caseId: 'corridor-exit' }); reject(s, { type: 'DISSOLVE', caseId: 'corridor-exit' }); act(s, { type: 'APPROACH_CORRIDOR', caseId: 'corridor-exit' }); reject(s, { type: 'WALK_CORRIDOR', caseId: 'corridor-exit' }); reject(s, { type: 'WALK_SIDE', caseId: 'corridor-exit' }); expect(s.fearBishop.life.playerLocation).toBe('CORRIDOR_ENTRANCE');
  });
  it('success dissipates the same trace then requires 8m ordinary travel and the original lamp return', () => {
    const s = ready(); toCorridor(s); corridorSetup(s); const trace = s.fearBishop.life.trace, lamp = s.fearBishop.life.lamp; act(s, { type: 'DISSOLVE', caseId: 'corridor-exit' }); expect(trace.status).toBe('DISSOLVED'); expect(lamp.location).toBe('STORE'); reject(s, { type: 'TAKE_LAMP', caseId: 'corridor-exit' }); act(s, { type: 'WALK_CORRIDOR', caseId: 'corridor-exit' }); act(s, { type: 'TAKE_LAMP', caseId: 'corridor-exit' }); reject(s, { type: 'RETURN_LAMP', caseId: 'corridor-exit' }); corridorReturn(s); close(s, 'corridor-exit'); act(s, { type: 'REPORT', caseId: 'corridor-exit' });
    expect(s.fearBishop.life.trace).toBe(trace); expect(s.fearBishop.life.lamp).toBe(lamp); expect(trace.status).toBe('DISSOLVED'); expect(lamp).toMatchObject({ id: 'FB3-LAMP', owner: 'FB3-EDITH', location: 'OWNER' }); expect(attempt(s, 'corridor-exit')).toMatchObject({ playerTravelMetres: 18, route: 'CORRIDOR', lampTaken: true, lampReturned: true, result: 'ABILITY' }); expect(s.progression.mastery['darkness.s3.dark-dissolution']).toBe(8);
  });
  it('failed trace dissolution keeps cost, uses the real shutter and 12m side route, and never restores danger', () => {
    const s = ready(); toCorridor(s); corridorSetup(s); act(s, { type: 'DISSOLVE', caseId: 'corridor-exit' }, 100); reject(s, { type: 'DISSOLVE', caseId: 'corridor-exit' }); act(s, { type: 'ISOLATE_TRACE', caseId: 'corridor-exit' }); reject(s, { type: 'WALK_CORRIDOR', caseId: 'corridor-exit' }); act(s, { type: 'WALK_SIDE', caseId: 'corridor-exit' }); act(s, { type: 'TAKE_LAMP', caseId: 'corridor-exit' }); corridorReturn(s); close(s, 'corridor-exit'); act(s, { type: 'REPORT', caseId: 'corridor-exit' });
    expect(s.fearBishop.life.trace.status).toBe('ISOLATED'); expect(s.fearBishop.life.shutter.location).toBe('LOWERED'); expect(attempt(s, 'corridor-exit')).toMatchObject({ playerTravelMetres: 26, route: 'SIDE', abilityTier: 'GREAT_FAILURE', spiritualitySpent: 6, result: 'ORDINARY' }); expect(s.spirituality).toBe(114); expect(s.progression.mastery['darkness.s3.dark-dissolution']).toBe(0);
  });
  it('can abandon from the store through the walked ordinary side route with no resources', () => {
    const s = ready(); toCorridor(s); corridorSetup(s); act(s, { type: 'ISOLATE_TRACE', caseId: 'corridor-exit' }); act(s, { type: 'WALK_SIDE', caseId: 'corridor-exit' }); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; act(s, { type: 'RETURN_PLAYER', caseId: 'corridor-exit' }); close(s, 'corridor-exit'); expect(s.fearBishop.life.lamp.location).toBe('STORE'); expect(attempt(s, 'corridor-exit').playerTravelMetres).toBe(26); expect(hasFearBishopLifeLock(s)).toBe(false);
  });
  it('failed and abandoned trace work cannot be rerolled next week and keeps the same isolated trace', () => {
    const s = ready(); toCorridor(s); corridorSetup(s); act(s, { type: 'DISSOLVE', caseId: 'corridor-exit' }, 100); act(s, { type: 'ISOLATE_TRACE', caseId: 'corridor-exit' }); act(s, { type: 'RETURN_PLAYER', caseId: 'corridor-exit' }); close(s, 'corridor-exit'); const first = structuredClone(attempt(s, 'corridor-exit')); reject(s, { type: 'PREPARE', caseId: 'corridor-exit', method: 'ORDINARY' }); s.week++; reject(s, { type: 'PREPARE', caseId: 'corridor-exit', method: 'ABILITY' }); start(s, 'corridor-exit', 'ORDINARY'); corridorSetup(s); act(s, { type: 'WALK_SIDE', caseId: 'corridor-exit' }); act(s, { type: 'TAKE_LAMP', caseId: 'corridor-exit' }); corridorReturn(s); close(s, 'corridor-exit'); act(s, { type: 'REPORT', caseId: 'corridor-exit' }); expect(s.fearBishop.life.cases['corridor-exit'].attempts[0]).toEqual(first); expect(s.fearBishop.life.trace.status).toBe('ISOLATED'); expect(s.spirituality).toBe(114);
  });
  it('ordinary three-case route reaches acting100 while retaining original people and items with no ability mastery', () => {
    const s = ready(); for (const id of FEAR_BISHOP_CASE_IDS) finish(s, id); act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.spirituality).toBe(120); expect(s.actionsRemaining).toBe(87); expect(Object.values(s.progression.mastery)).toEqual([0, 0]); expect(s.fearBishop.life).toMatchObject({ playerLocation: 'EXIT', playerTravelMetres: 30, residue: { status: 'SEALED' }, container: { location: 'OWNER' }, tomas: { mind: 100, location: 'EXIT' }, trace: { status: 'ISOLATED' }, lamp: { location: 'OWNER' } }); reject(s, { type: 'REFLECT' }); reject(s, { type: 'REPORT', caseId: 'contained-residue' });
  });
  it('all three real successes grant only corresponding new mastery and preserve permanent consequences', () => {
    const s = ready(); for (const id of FEAR_BISHOP_CASE_IDS) finish(s, id, 'ABILITY'); act(s, { type: 'REFLECT' }); expect(s.progression.mastery).toEqual({ 'darkness.s3.dark-dissolution': 16, 'darkness.s3.sleep-fear': 8 }); expect(s.spirituality).toBe(103); expect(s.fearBishop.life).toMatchObject({ residue: { status: 'DISSOLVED' }, trace: { status: 'DISSOLVED' }, tomas: { mind: 98, state: 'AWAKE' }, lamp: { location: 'OWNER' } }); expect(hasFearBishopLifeLock(s)).toBe(false);
  });
  it('requires two AP to prepare, permits zero-AP cleanup and never refunds canceled preparation', () => {
    const s = ready(); act(s, { type: 'OBSERVE', caseId: 'contained-residue' }); s.actionsRemaining = 1; reject(s, { type: 'PREPARE', caseId: 'contained-residue', method: 'ABILITY' }); s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'contained-residue', method: 'ABILITY' }); expect(hasFearBishopLifeLock(s)).toBe(true); act(s, { type: 'WITHDRAW', caseId: 'contained-residue' }); expect(s.actionsRemaining).toBe(1); expect(hasFearBishopLifeLock(s)).toBe(false);
    s.actionsRemaining = 2; act(s, { type: 'PREPARE', caseId: 'contained-residue', method: 'ORDINARY' }); act(s, { type: 'PERFORM', caseId: 'contained-residue' }); residueSetup(s); residueReturn(s); close(s, 'contained-residue'); expect(s.actionsRemaining).toBe(0); expect(hasFearBishopLifeLock(s)).toBe(false);
  });
  it('exposes physical cleanup as enabled actions at zero resources and blocks unrelated case work', () => {
    const s = ready(); start(s, 'contained-residue'); residueSetup(s); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const view = projectFearBishopLife(s); expect(view.actions.find(x => x.command.type === 'SEAL_RESIDUE')?.enabled).toBe(true); expect(view.actions.find(x => x.command.type === 'DISSOLVE')?.enabled).toBe(false); reject(s, { type: 'OBSERVE', caseId: 'stop-signal' });
  });
  it('rejects forged identities, revived original targets, lost costs and premature results in persisted state', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.fearBishop.life.residue.id = 'COPY' as never; }, s => { s.fearBishop.life.residue.alive = true as never; }, s => { s.fearBishop.life.trace.conscious = true as never; }, s => { s.fearBishop.life.container.owner = 'PLAYER' as never; }, s => { s.fearBishop.life.tomas.age = 17 as never; }, s => { s.fearBishop.life.tomas.mind = 98; }, s => { s.fearBishop.life.lamp.location = 'OWNER'; }, s => { s.fearBishop.life.trace.status = 'DISSOLVED'; }];
    for (const change of changes) { const s = ready(); change(s); expect(validateFearBishopLife(s)).toBe(false); }
    const s = ready(); finish(s, 'contained-residue', 'ABILITY'); s.fearBishop.life.residue.status = 'CONTAINED'; s.fearBishop.life.residue.location = 'CONTAINER'; expect(validateFearBishopLife(s)).toBe(false);
  });
  it('rejects added payloads, arbitrary targets, invalid stop actors and repeated resolution commands', () => {
    for (const c of [{ type: 'DISSOLVE', caseId: 'contained-residue', target: 'LIVING_PERSON' }, { type: 'SLEEP_FEAR', caseId: 'stop-signal', readSecret: true }, { type: 'STOP', caseId: 'stop-signal', actor: 'UNKNOWN' }, { type: 'STOP', caseId: 'corridor-exit', actor: 'PLAYER' }, { type: 'PREPARE', caseId: 'contained-residue', method: 'OMNIPOTENT' }, { type: 'REFLECT', bonus: 100 }]) expect(validateFearBishopActivityCommand(c)).toBe(false);
    const s = ready(); reject(s, { type: 'REPORT', caseId: 'contained-residue' }); expect(validateFearBishopActivityCommand({ type: 'STOP', caseId: 'stop-signal', actor: 'TOMAS' })).toBe(true);
  });
  it('preserves a pristine life state before promotion and permits external battle time without changing life distances', () => {
    const s = ready(); s.fearBishop.promotionWeek = null; expect(validateFearBishopLife(s)).toBe(true); s.fearBishop.life.clockSeconds++; expect(validateFearBishopLife(s)).toBe(false); s.fearBishop.promotionWeek = 19; expect(validateFearBishopLife(s)).toBe(true); expect(createFearBishopLifeState().residue.status).toBe('CONTAINED');
  });
});
