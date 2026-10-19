import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyBlackKnightCommand, createBlackKnightState } from '../../src/domain/black-knight/index.js';
import { BLACK_KNIGHT_ABILITY_IDS, type BlackKnightAbilityId } from '../../src/domain/black-knight/types.js';
import {
  applyBlackKnightActivity, blackKnightActivityReason, blackKnightLifeActions, createBlackKnightLifeState,
  hasBlackKnightLifeLock, projectBlackKnightLife, validateBlackKnightActivityCommand, validateBlackKnightLife,
  BLACK_KNIGHT_CASE_IDS, BLACK_KNIGHT_SHADE_URGE, type BlackKnightActivityCommand, type BlackKnightCaseId,
} from '../../src/domain/black-knight/life.js';

// Directed domain coverage continues the original S5 save. These resources and rolls are not natural-play evidence.
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((id: BlackKnightAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function oldShepherd(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/shepherd-v01100/natural.json', 'utf8')).final);
  s.blackKnight = createBlackKnightState();
  const week = Math.max(s.week, s.shepherd.promotionWeek! + 12); s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND'; s.cash = 40000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100; s.spirituality = 100; s.seer.pollution = 0; s.character.coreStats.will = 28;
  return s;
}
function promoted() {
  const s = oldShepherd(), { ctx } = context(s);
  applyBlackKnightCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyBlackKnightCommand(s, { type: 'BUY_POTION', bottleId: 'black-knight-potion-1' }, ctx);
  applyBlackKnightCommand(s, { type: 'CONSUME', bottleId: 'black-knight-potion-1', confirmed: true }, ctx);
  return s;
}
function act(s: SliceState, command: BlackKnightActivityCommand, roll = 1) {
  const c = context(s, roll); applyBlackKnightActivity(s, command, c.ctx, c.award);
  expect(validateBlackKnightLife(s), `invalid after ${JSON.stringify(command)}`).toBe(true);
  return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyBlackKnightActivity(s, command as BlackKnightActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: BlackKnightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.blackKnight.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function finishCase(s: SliceState, caseId: BlackKnightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  if (caseId === 'one-spirit-account') act(s, { type: 'RETURN_ROUTE', caseId });
  act(s, { type: 'CLOSE', caseId }); act(s, { type: 'REPORT', caseId });
}
const nextWeek = (s: SliceState) => { s.week += 1; s.date = addGameWeeks(s.date, 1); s.actionsRemaining = 100; };
const oldHistory = (s: SliceState) => structuredClone([s.secretSupplicant, s.listener, s.shadowAscetic, s.roseBishop, s.shepherd, s.combatHistory, s.character]);
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(x => x.join(' ')).join(' ');
function shadeReady() {
  const s = promoted(); finishCase(s, 'shadow-boundary'); act(s, { type: 'BUY_SHADE_KIT' }); act(s, { type: 'ENTER_SHADE_ROOM' }); return s;
}
function spawned() {
  const s = shadeReady(); act(s, { type: 'SPAWN_SHADE', confirmed: true, acknowledgedUrge: BLACK_KNIGHT_SHADE_URGE }); return s;
}
function handedOver() {
  const s = spawned(); act(s, { type: 'CAPTURE_SHADE' }); act(s, { type: 'RETURN_SHADE_ROUTE' }); act(s, { type: 'HANDOFF_SHADE' }); return s;
}
function quarantined() {
  const s = spawned(); act(s, { type: 'CAPTURE_SHADE' }, 100); act(s, { type: 'CAPTURE_SHADE' }, 100); act(s, { type: 'SHADOW_EXIT' }); return s;
}
function reverseKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(reverseKeys);
  return v !== null && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v;
}

describe('Black Knight original finite life and independent fallen shadow', () => {
  it('starts pristine and dormant, exposing three distinct scenes only at4', () => {
    const old = oldShepherd(); expect(validateBlackKnightLife(old)).toBe(true); expect(blackKnightLifeActions(old)).toEqual([]);
    expect(projectBlackKnightLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null, shade: null });
    const s = promoted(); expect(s.blackKnight.life).toEqual(createBlackKnightLifeState()); expect(validateBlackKnightLife(s)).toBe(true);
    const p = projectBlackKnightLife(s); expect(p.cases.map(x => x.id)).toEqual([...BLACK_KNIGHT_CASE_IDS]); expect(new Set(p.cases.map(x => x.story)).size).toBe(3);
    expect(p.cases.every(x => x.observations.length === 0)).toBe(true); expect(p.shade?.status).toBe('NOT_CREATED');
  });

  it.each([null, {}, { type: 'OBSERVE', caseId: 'paper-guidance' }, { type: 'PREPARE', caseId: 'blade-panel', method: 'MURDER' }, { type: 'RETURN_ROUTE', caseId: 'shadow-boundary' }, { type: 'SPAWN_SHADE' }, { type: 'SPAWN_SHADE', confirmed: false, acknowledgedUrge: BLACK_KNIGHT_SHADE_URGE }, { type: 'SPAWN_SHADE', confirmed: true, acknowledgedUrge: 'purify' }, { type: 'SPAWN_SHADE', confirmed: true, acknowledgedUrge: BLACK_KNIGHT_SHADE_URGE, controlled: true }, { type: 'CAPTURE_SHADE', sealId: 'FREE' }, { type: 'SHADOW_EXIT', teleport: true }, { type: 'REFLECT', acting: 100 }])('rejects malformed or unbounded commands without side effects: %j', c => {
    expect(validateBlackKnightActivityCommand(c)).toBe(false); reject(promoted(), c);
  });

  it('permits all-ordinary100 without souls, own mastery, shade or old-history changes', () => {
    const s = promoted(); act(s, { type: 'ACTIVATE_SPIRIT', spiritId: null });
    const old = oldHistory(s), mastery = structuredClone(s.progression.mastery), ap = s.actionsRemaining, vitals = [s.health, s.mind, s.spirituality, s.cash, s.seer.pollution];
    for (const id of BLACK_KNIGHT_CASE_IDS) finishCase(s, id); act(s, { type: 'REFLECT' });
    expect(s.progression.acting).toBe(100); expect(s.actionsRemaining).toBe(ap - 13); expect(s.progression.mastery).toEqual(mastery); expect(oldHistory(s)).toEqual(old);
    expect([s.health, s.mind, s.spirituality, s.cash, s.seer.pollution]).toEqual(vitals); expect(s.blackKnight.life.panel).toMatchObject({ cuts: 0, notches: 1, toolLocation: 'GUIDE' });
    expect(s.blackKnight.life.card).toMatchObject({ location: 'TABLE', playerNode: 'DESK', walks: 2, distanceMetres: 2 }); expect(s.blackKnight.life.shade.creatureId).toBeNull();
    for (const id of BLACK_KNIGHT_CASE_IDS) reject(s, { type: 'REPORT', caseId: id }); reject(s, { type: 'REFLECT' });
  });

  it('requires prior reports and actual success, with no skipping by preparation or closure', () => {
    const s = promoted(); reject(s, { type: 'OBSERVE', caseId: 'blade-panel' }); reject(s, { type: 'REFLECT' });
    begin(s, 'shadow-boundary', 'ABILITY'); reject(s, { type: 'CLOSE', caseId: 'shadow-boundary' }); reject(s, { type: 'REPORT', caseId: 'shadow-boundary' }); reject(s, { type: 'BUY_SHADE_KIT' });
    act(s, { type: 'WITHDRAW', caseId: 'shadow-boundary' }); expect(s.progression.acting).toBe(0); expect(s.blackKnight.life.shadow.bound).toBe(false);
  });

  it('binds only the same lit two-metre shadow, actually releases it at0AP, and awards only a successful own report', () => {
    const s = promoted(), original = oldHistory(s); begin(s, 'shadow-boundary', 'ABILITY'); const sp = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'shadow-boundary' }); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 18); expect(s.spirituality).toBe(sp - 4);
    expect(s.blackKnight.life.shadow).toMatchObject({ lampId: 'BK4-LAMP-1', lampLit: true, distanceMetres: 2, bound: true, durationSeconds: 60, releases: 0 }); expect(hasBlackKnightLifeLock(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'shadow-boundary' }); s.actionsRemaining = 0; s.spirituality = 0;
    act(s, { type: 'CLOSE', caseId: 'shadow-boundary' }); expect(s.blackKnight.life.shadow).toMatchObject({ bound: false, durationSeconds: 0, releases: 1 }); expect(hasBlackKnightLifeLock(s)).toBe(false);
    s.actionsRemaining = 1; act(s, { type: 'REPORT', caseId: 'shadow-boundary' }); expect(s.progression.mastery['hanged-man.s4.shadow-command']).toBe(8); expect(oldHistory(s)).toEqual(original);
  });

  it('charges a resisted shadow attempt, retains the failure, and requires a paid retry next real week', () => {
    const s = promoted(); begin(s, 'shadow-boundary', 'ABILITY'); const ap = s.actionsRemaining, sp = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'shadow-boundary' }, 100); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, sp - 4]); expect(s.blackKnight.life.shadow.bound).toBe(false);
    act(s, { type: 'CLOSE', caseId: 'shadow-boundary' }); reject(s, { type: 'PREPARE', caseId: 'shadow-boundary', method: 'ABILITY' }); reject(s, { type: 'REPORT', caseId: 'shadow-boundary' });
    nextWeek(s); finishCase(s, 'shadow-boundary', 'ABILITY'); expect(s.spirituality).toBe(sp - 8); expect(s.blackKnight.life.cases['shadow-boundary'].attempts.map(x => x.success)).toEqual([false, true]);
    expect(s.progression.mastery['hanged-man.s4.shadow-command']).toBe(8); expect(s.progression.acting).toBe(25);
  });

  it('forms a real original-panel cut and returns the original tool without a pristine reset or kill reward', () => {
    const s = promoted(); finishCase(s, 'shadow-boundary'); begin(s, 'blade-panel', 'ABILITY'); const sp = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'blade-panel' }); expect(s.spirituality).toBe(sp - 5); expect(s.blackKnight.life.panel).toMatchObject({ id: 'BK4-PANEL-1', cuts: 1, notches: 0, bladeActive: true, toolLocation: 'PLAYER', clearBehind: true });
    s.actionsRemaining = 0; act(s, { type: 'CLOSE', caseId: 'blade-panel' }); expect(s.blackKnight.life.panel).toMatchObject({ cuts: 1, bladeActive: false, toolLocation: 'GUIDE' });
    s.actionsRemaining = 1; act(s, { type: 'REPORT', caseId: 'blade-panel' }); expect(s.progression.mastery['hanged-man.s4.flesh-soul-blade']).toBe(8); expect(s.blackKnight.life.panel.cuts).toBe(1);
  });

  it('leaves failed panel contact unpaid by any free reset and can close at zero action and spirit', () => {
    const s = promoted(); finishCase(s, 'shadow-boundary'); begin(s, 'blade-panel', 'ABILITY'); const sp = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'blade-panel' }, 100); expect(s.spirituality).toBe(sp - 5); expect(s.blackKnight.life.panel).toMatchObject({ cuts: 0, bladeActive: true, toolLocation: 'PLAYER' });
    s.actionsRemaining = 0; s.spirituality = 0; act(s, { type: 'CLOSE', caseId: 'blade-panel' }); expect(hasBlackKnightLifeLock(s)).toBe(false); expect(s.blackKnight.life.panel.toolLocation).toBe('GUIDE');
  });

  it('borrows only the original selected Iris skill, walks to fetch the same card, and preserves the active soul and release history', () => {
    const s = promoted(); finishCase(s, 'shadow-boundary', 'ABILITY'); finishCase(s, 'blade-panel', 'ABILITY');
    const original = oldHistory(s), sp = s.spirituality, active = s.shepherd.grazing.activeSpiritId; begin(s, 'one-spirit-account', 'ABILITY');
    const c = act(s, { type: 'PERFORM', caseId: 'one-spirit-account' }); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 14); expect(s.spirituality).toBe(sp - 2);
    expect(s.blackKnight.life.card).toMatchObject({ id: 'BK4-CARD-1', location: 'MARK', playerNode: 'DESK', walks: 0, borrowing: true });
    reject(s, { type: 'CLOSE', caseId: 'one-spirit-account' }); reject(s, { type: 'ACTIVATE_SPIRIT', spiritId: null });
    s.actionsRemaining = 0; act(s, { type: 'RETURN_ROUTE', caseId: 'one-spirit-account' }); act(s, { type: 'CLOSE', caseId: 'one-spirit-account' });
    expect(s.blackKnight.life.card).toMatchObject({ location: 'TABLE', playerNode: 'DESK', distanceMetres: 2, borrowing: false }); expect(s.shepherd.grazing.activeSpiritId).toBe(active);
    s.actionsRemaining = 1; const report = act(s, { type: 'REPORT', caseId: 'one-spirit-account' }); expect(report.award).not.toHaveBeenCalled(); expect(oldHistory(s)).toEqual(original);
    expect(s.shepherd.grazing.spirits.find(x => x.id === 'SH5-CEDRIC-1')?.status).toBe('RELEASED');
  });

  it('does not invent Iris or teleport the ordinary walker, including a failed ordinary placement', () => {
    const s = promoted(); finishCase(s, 'shadow-boundary'); finishCase(s, 'blade-panel'); act(s, { type: 'ACTIVATE_SPIRIT', spiritId: null });
    act(s, { type: 'OBSERVE', caseId: 'one-spirit-account' }); reject(s, { type: 'PREPARE', caseId: 'one-spirit-account', method: 'ABILITY' });
    begin(s, 'one-spirit-account'); act(s, { type: 'PERFORM', caseId: 'one-spirit-account' }, 100);
    expect(s.blackKnight.life.card).toMatchObject({ location: 'MARK', playerNode: 'MARK', distanceMetres: 1 }); reject(s, { type: 'CLOSE', caseId: 'one-spirit-account' });
    s.actionsRemaining = 0; act(s, { type: 'RETURN_ROUTE', caseId: 'one-spirit-account' }); act(s, { type: 'CLOSE', caseId: 'one-spirit-account' }); expect(hasBlackKnightLifeLock(s)).toBe(false);
    nextWeek(s); finishCase(s, 'one-spirit-account'); expect(s.blackKnight.life.card.distanceMetres).toBe(4); expect(s.shepherd.grazing.activeSpiritId).toBeNull();
  });

  it('lets a failed borrowed-card attempt close without inventing a trip or reactivating a soul', () => {
    const s = promoted(); finishCase(s, 'shadow-boundary'); finishCase(s, 'blade-panel'); begin(s, 'one-spirit-account', 'ABILITY');
    act(s, { type: 'PERFORM', caseId: 'one-spirit-account' }, 100); expect(s.blackKnight.life.card).toMatchObject({ location: 'TABLE', playerNode: 'DESK', walks: 0, borrowing: true });
    reject(s, { type: 'RETURN_ROUTE', caseId: 'one-spirit-account' }); s.actionsRemaining = 0; act(s, { type: 'CLOSE', caseId: 'one-spirit-account' }); expect(hasBlackKnightLifeLock(s)).toBe(false);
  });

  it('buys exactly one actual kit and allows actual two-metre entry and return before any spawn', () => {
    const s = promoted(); finishCase(s, 'shadow-boundary'); const cash = s.cash, ap = s.actionsRemaining;
    act(s, { type: 'BUY_SHADE_KIT' }); expect([s.cash, s.actionsRemaining]).toEqual([cash - 180, ap - 1]);
    expect(s.blackKnight.life.shade).toMatchObject({ caskId: 'BK4-CASK-1', caskStatus: 'EMPTY', emergencySealId: 'BK4-EXIT-SEAL-1', captureSeals: [{ id: 'BK4-SEAL-1', consumed: false }, { id: 'BK4-SEAL-2', consumed: false }] });
    reject(s, { type: 'BUY_SHADE_KIT' }); reject(s, { type: 'SPAWN_SHADE', confirmed: true, acknowledgedUrge: BLACK_KNIGHT_SHADE_URGE });
    s.actionsRemaining = 0; act(s, { type: 'ENTER_SHADE_ROOM' }); expect(hasBlackKnightLifeLock(s)).toBe(true); act(s, { type: 'RETURN_SHADE_ROUTE' });
    expect(hasBlackKnightLifeLock(s)).toBe(false); expect(s.blackKnight.life.shade).toMatchObject({ creatureId: null, playerNode: 'OUTSIDE', playerWalks: 2, playerDistanceMetres: 4 });
  });

  it('generates exactly one independent creature that autonomously walks and extinguishes the original lamp for actual costs', () => {
    const s = shadeReady(), original = oldHistory(s), before = [s.actionsRemaining, s.spirituality, s.mind, s.seer.pollution];
    const c = act(s, { type: 'SPAWN_SHADE', confirmed: true, acknowledgedUrge: BLACK_KNIGHT_SHADE_URGE }); expect(c.ctx.check).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.mind, s.seer.pollution]).toEqual([before[0]! - 1, before[1]! - 5, before[2]! - 5, before[3]]);
    expect(s.blackKnight.life.shade).toMatchObject({ creatureId: 'BK4-SHADE-1', status: 'LOOSE', controlled: false, creatureLocation: 'LAMP', creatureDistanceMetres: 2, lampExtinguished: true, roomStatus: 'OCCUPIED' });
    expect(s.blackKnight.life.shadow.lampLit).toBe(false); expect(s.progression.mastery['hanged-man.s4.fallen-shadow']).toBe(8); expect(oldHistory(s)).toEqual(original); expect(notes(c)).toContain('不是随从或宠物');
    reject(s, { type: 'SPAWN_SHADE', confirmed: true, acknowledgedUrge: BLACK_KNIGHT_SHADE_URGE }); reject(s, { type: 'RETURN_SHADE_ROUTE' });
  });

  it('captures the same creature using an actual seal, then separately walks and hands over the actual original cask', () => {
    const s = spawned(), sp = s.spirituality, ap = s.actionsRemaining; const c = act(s, { type: 'CAPTURE_SHADE' });
    expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 18); expect([s.spirituality, s.actionsRemaining]).toEqual([sp - 3, ap - 1]);
    expect(s.blackKnight.life.shade).toMatchObject({ status: 'SEALED', creatureId: 'BK4-SHADE-1', creatureLocation: 'CASK', caskId: 'BK4-CASK-1', caskStatus: 'SEALED', caskLocation: 'PLAYER', playerNode: 'ROOM', captureSeals: [{ id: 'BK4-SEAL-1', consumed: true }, { id: 'BK4-SEAL-2', consumed: false }] });
    reject(s, { type: 'HANDOFF_SHADE' }); s.actionsRemaining = 0; s.spirituality = 0;
    act(s, { type: 'RETURN_SHADE_ROUTE' }); expect(hasBlackKnightLifeLock(s)).toBe(true); expect(s.blackKnight.life.shade.playerDistanceMetres).toBe(4); expect(s.blackKnight.life.shade.handoffs).toBe(0);
    act(s, { type: 'HANDOFF_SHADE' }); expect(hasBlackKnightLifeLock(s)).toBe(false);
    expect(s.blackKnight.life.shade).toMatchObject({ status: 'TAKEN_AWAY', creatureId: 'BK4-SHADE-1', caskId: 'BK4-CASK-1', creatureLocation: 'BK4-STORE', caskLocation: 'BK4-STORE', caskStatus: 'HANDED_OVER', handoffs: 1, playerNode: 'OUTSIDE', roomStatus: 'CLEARED', emergencySealUsed: false });
    expect(s.blackKnight.life.shadow.lampLit).toBe(false); reject(s, { type: 'HANDOFF_SHADE' }); reject(s, { type: 'ENTER_SHADE_ROOM' });
  });

  it('retains damaged original glass, paid failed seals, actual autonomous distance and permanent same-creature quarantine', () => {
    const s = spawned(), sp = s.spirituality, mind = s.mind;
    act(s, { type: 'CAPTURE_SHADE' }, 100); expect(s.blackKnight.life.shade).toMatchObject({ glassHood: 'BROKEN', creatureLocation: 'INNER_DOOR', ordinaryDoor: 'CLEAR', creatureWalks: 2, creatureDistanceMetres: 3 });
    act(s, { type: 'CAPTURE_SHADE' }, 100); expect([s.spirituality, s.mind]).toEqual([sp - 6, mind - 6]); expect(s.blackKnight.life.shade.creatureDistanceMetres).toBe(3); expect(s.blackKnight.life.shade.captureSeals.every(x => x.consumed)).toBe(true);
    reject(s, { type: 'CAPTURE_SHADE' }); s.actionsRemaining = 0; s.spirituality = 0; const c = act(s, { type: 'SHADOW_EXIT' }); expect(notes(c)).toContain('普通步行两米');
    expect(s.blackKnight.life.shade).toMatchObject({ creatureId: 'BK4-SHADE-1', status: 'ISOLATED', creatureLocation: 'INNER_DOOR', glassHood: 'BROKEN', caskStatus: 'EMPTY', caskLocation: 'PLAYER', playerNode: 'OUTSIDE', playerDistanceMetres: 4, emergencySealUsed: true, ordinaryDoor: 'SEALED', roomStatus: 'QUARANTINED' });
    expect(hasBlackKnightLifeLock(s)).toBe(false); reject(s, { type: 'ENTER_SHADE_ROOM' }); reject(s, { type: 'SHADOW_EXIT' });
    nextWeek(s); finishCase(s, 'blade-panel'); finishCase(s, 'one-spirit-account'); act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.blackKnight.life.shade.status).toBe('ISOLATED');
  });

  it('supports choosing immediate emergency exit without captures, preserving the creature at the original lamp', () => {
    const s = spawned(); s.actionsRemaining = 0; s.mind = 1; s.spirituality = 0; act(s, { type: 'SHADOW_EXIT' });
    expect(s.blackKnight.life.shade).toMatchObject({ status: 'ISOLATED', creatureLocation: 'LAMP', captureAttempts: [], glassHood: 'INTACT', emergencySealUsed: true }); expect(s.blackKnight.life.shade.captureSeals.every(x => !x.consumed)).toBe(true);
  });

  it('caps capture-failure mental cost at1 without refunding spirit or actual seal', () => {
    const s = spawned(); s.mind = 2; const sp = s.spirituality; act(s, { type: 'CAPTURE_SHADE' }, 100);
    expect(s.mind).toBe(1); expect(s.spirituality).toBe(sp - 3); expect(s.blackKnight.life.shade.captureSeals[0]!.consumed).toBe(true); s.actionsRemaining = 0; act(s, { type: 'SHADOW_EXIT' });
  });

  it('does not teleport through a blocked ordinary exit or fake that INNER_DOOR is the player exit', () => {
    const s = spawned(); s.blackKnight.life.shade.ordinaryDoor = 'BLOCKED'; reject(s, { type: 'SHADOW_EXIT' }); expect(blackKnightActivityReason(s, { type: 'SHADOW_EXIT' })).toContain('不能'); expect(validateBlackKnightLife(s)).toBe(false);
    const captured = spawned(); act(captured, { type: 'CAPTURE_SHADE' }); captured.blackKnight.life.shade.ordinaryDoor = 'BLOCKED'; reject(captured, { type: 'RETURN_SHADE_ROUTE' });
  });

  it('shows finite costs, original identities, truthful locations and exact typed actions', () => {
    const s = quarantined(), p = projectBlackKnightLife(s);
    expect(p.shade?.status).toBe('ISOLATED'); expect(p.shade?.creature).toContain('BK4-SHADE-1'); expect(p.shade?.creature).toContain('仍留在同一原房间'); expect(p.shade?.room).toContain('永久隔离');
    expect(p.shade?.cost).toContain('180便士'); expect(p.shade?.kit).toContain('BK4-EXIT-SEAL-1已耗'); expect(p.shade?.route).toContain('4米'); expect(p.shade?.warning).toContain('不是宠物');
    expect(blackKnightLifeActions(s).every(a => validateBlackKnightActivityCommand(a.command))).toBe(true); expect(blackKnightLifeActions(s).find(a => a.command.type === 'OBSERVE' && a.command.caseId === 'blade-panel')?.enabled).toBe(true);
  });

  it('round-trips both outcomes, preserves property-order independence, and rejects forged original objects, costs, movements and rewards', () => {
    const end = handedOver(); expect(validateBlackKnightLife(JSON.parse(JSON.stringify(end)))).toBe(true); expect(validateBlackKnightLife(reverseKeys(end) as SliceState)).toBe(true); expect(stableStringify(reverseKeys(end))).toBe(stableStringify(end));
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.blackKnight.life.shadow.lampLit = true; }, s => { s.blackKnight.life.panel.cuts = 1; },
      s => { s.blackKnight.life.shade.creatureId = null; }, s => { s.blackKnight.life.shade.controlled = true as false; },
      s => { s.blackKnight.life.shade.caskId = 'COPY' as 'BK4-CASK-1'; }, s => { s.blackKnight.life.shade.captureSeals[0]!.consumed = false; },
      s => { s.blackKnight.life.shade.captureSeals.push({ id: 'BK4-SEAL-2', consumed: false }); },
      s => { s.blackKnight.life.shade.playerDistanceMetres = 0; }, s => { s.blackKnight.life.shade.handoffs = 0; },
      s => { s.blackKnight.life.shade.creatureDistanceMetres = 0; }, s => { s.blackKnight.life.shade.caskLocation = 'PLAYER'; },
      s => { s.blackKnight.life.shade.creatureLocation = 'NONE'; }, s => { s.blackKnight.life.shade.emergencySealUsed = true; },
      s => { s.blackKnight.life.cases['shadow-boundary'].closes = 0; }, s => { s.blackKnight.life.cases['shadow-boundary'].attempts[0]!.success = false; },
      s => { s.seer.completedSources.push('black-knight-shade-spawn'); }, s => { s.progression.acting = 100; },
      s => { (s.blackKnight.life.shade as unknown as Record<string, unknown>).pet = true; },
    ];
    for (const mutate of mutations) { const s = structuredClone(end); mutate(s); expect(validateBlackKnightLife(s)).toBe(false); }
    const q = quarantined(); expect(validateBlackKnightLife(JSON.parse(JSON.stringify(q)))).toBe(true);
    for (const mutate of [
      (s: SliceState) => { s.blackKnight.life.shade.emergencySealUsed = false; },
      (s: SliceState) => { s.blackKnight.life.shade.ordinaryDoor = 'CLEAR'; },
      (s: SliceState) => { s.blackKnight.life.shade.glassHood = 'INTACT'; },
      (s: SliceState) => { s.blackKnight.life.shade.status = 'NOT_CREATED'; },
      (s: SliceState) => { s.blackKnight.life.shade.playerNode = 'ROOM'; },
    ]) { const s = structuredClone(q); mutate(s); expect(validateBlackKnightLife(s)).toBe(false); }
  });

  it('never grants all three new masteries just for the mandatory life loop', () => {
    const s = promoted(); for (const id of BLACK_KNIGHT_CASE_IDS) finishCase(s, id, 'ABILITY'); act(s, { type: 'REFLECT' });
    expect(BLACK_KNIGHT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8, 0]); expect(s.blackKnight.life.shade.status).toBe('NOT_CREATED');
  });
});
