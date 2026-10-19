import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyPuppetCommand, createPuppetState } from '../../src/domain/puppet/index.js';
import type { PuppetAbilityId } from '../../src/domain/puppet/types.js';
import {
  applyPuppetActivity, createPuppetLifeState, hasPuppetLifeLock, initializePuppetMoon,
  projectPuppetLife, puppetActivityReason, puppetLifeActions, syncPuppetMoon,
  validatePuppetActivityCommand, validatePuppetLife, PUPPET_CASE_IDS, PUPPET_MOON_RULE,
  type PuppetActivityCommand, type PuppetCaseId,
} from '../../src/domain/puppet/life.js';

// Directed unit fixtures are not claims of natural RNG success.
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((id: PuppetAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function previous(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/wraith-v01120/natural.json', 'utf8')).final);
  s.puppet = createPuppetState(); setWeek(s, Math.max(s.week, s.wraith.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 40000; s.health = 100; s.mind = 100; s.spirituality = 100;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function promoted() {
  const s = previous(), { ctx } = context(s);
  applyPuppetCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyPuppetCommand(s, { type: 'BUY_POTION', bottleId: 'puppet-potion-1' }, ctx);
  applyPuppetCommand(s, { type: 'CONSUME', bottleId: 'puppet-potion-1', confirmed: true }, ctx);
  expect(validatePuppetLife(s)).toBe(true); return s;
}
function act(s: SliceState, command: PuppetActivityCommand, roll = 1) {
  const c = context(s, roll); applyPuppetActivity(s, command, c.ctx, c.award);
  expect(validatePuppetLife(s), `invalid after ${JSON.stringify(command)}`).toBe(true); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyPuppetActivity(s, command as PuppetActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: PuppetCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.puppet.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function close(s: SliceState, caseId: PuppetCaseId) {
  const a = s.puppet.life.cases[caseId].attempts.at(-1)!;
  if (!a.returned) act(s, caseId === 'chosen-form' ? { type: 'RETURN_FORM_ROUTE', caseId } : { type: 'RETURN_ROUTE', caseId: 'moving-token' });
  if (!a.restored) act(s, { type: 'RESTORE_FORM', caseId: 'chosen-form' });
  return act(s, { type: 'CLOSE', caseId });
}
function finish(s: SliceState, caseId: PuppetCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); close(s, caseId); return act(s, { type: 'REPORT', caseId });
}
function formsReady() { const s = promoted(); finish(s, 'moving-token'); return s; }
function linkReady(method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const s = formsReady(); finish(s, 'chosen-form'); begin(s, 'reversible-link', method); return s;
}
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 100; s.mind = 100; s.spirituality = 100; }
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.prisoner, s.madman, s.werewolf, s.zombie, s.wraith, s.character, s.combatHistory, s.world, s.town]);

describe('Puppet same original objects, same body and reversible bounded links', () => {
  it('is dormant before promotion and initializes exactly two authored notices only after actual success', () => {
    const old = previous(), before = structuredClone(old.puppet.life);
    initializePuppetMoon(old); syncPuppetMoon(old, context(old).ctx);
    expect(old.puppet.life).toEqual(before); expect(before).toEqual(createPuppetLifeState());
    expect(validatePuppetLife(old)).toBe(true); expect(puppetLifeActions(old)).toEqual([]); expect(projectPuppetLife(old).practice).toBeNull();
    const s = promoted(), l = s.puppet.life;
    expect(l.moon.notices).toEqual([{ id: 'PU4-MOON-1', week: s.week + 3 }, { id: 'PU4-MOON-2', week: s.week + 8 }]);
    const saved = structuredClone(l); initializePuppetMoon(s); projectPuppetLife(s); expect(l).toEqual(saved);
    expect(l.token).toEqual(createPuppetLifeState().token); expect(l.body).toEqual(createPuppetLifeState().body);
    expect(projectPuppetLife(s).cases.map(c => c.id)).toEqual([...PUPPET_CASE_IDS]);
    expect(projectPuppetLife(s).cases.every(c => c.observations.length === 0)).toBe(true);
    expect(PUPPET_MOON_RULE).toContain('具体原著满月诅咒尚未核明'); expect(PUPPET_MOON_RULE).toContain('不是28天循环');
    expect(PUPPET_MOON_RULE).toContain('不能写成怨魂5必须吞食人类灵魂');
  });

  it.each([null, {}, { type: 'OBSERVE', caseId: 'old-mirror' }, { type: 'PERFORM', caseId: 'chosen-form', form: 'WOOD' }, { type: 'FORM_TRIAL', caseId: 'moving-token', form: 'WOOD' }, { type: 'FORM_TRIAL', caseId: 'chosen-form', form: 'ENEMY' }, { type: 'RETURN_ROUTE', caseId: 'reversible-link' }, { type: 'RESTORE_FORM', caseId: 'chosen-form', heal: true }, { type: 'WITHDRAW_CONSENT', caseId: 'moving-token' }, { type: 'HANDLE_MOON', method: 'CONSUME_SOUL' }, { type: 'REFLECT', reward: 100 }])('rejects invented activities before cost or RNG: %j', command => {
    expect(validatePuppetActivityCommand(command)).toBe(false); reject(promoted(), command);
  });

  it('completes a genuine ordinary G100 without mastery, hidden forms/links or rewriting old facts', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery), ap = s.actionsRemaining;
    const vitals = [s.health, s.mind, s.spirituality, s.cash, s.seer.pollution];
    for (const id of PUPPET_CASE_IDS) finish(s, id); act(s, { type: 'REFLECT' });
    expect(s.actionsRemaining).toBe(ap - 13); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery);
    expect([s.health, s.mind, s.spirituality, s.cash, s.seer.pollution]).toEqual(vitals); expect(originals(s)).toEqual(old);
    expect(s.puppet.life.token).toMatchObject({ id: 'PU4-TOKEN-1', owner: 'HARLAN', position: 'GUIDE', playerNode: 'NEAR', distanceMetres: 4, handovers: 1 });
    expect(s.puppet.life.body).toEqual(createPuppetLifeState().body); expect(s.puppet.life.link.state).toBe('NONE');
    expect(s.puppet.life.note).toMatchObject({ id: 'PU4-NOTE-1', holder: 'GUIDE', handovers: 1 });
    expect(s.puppet.life.note.writings[0]).toContain('没有测试伤害'); expect(hasPuppetLifeLock(s)).toBe(false);
    for (const id of PUPPET_CASE_IDS) reject(s, { type: 'REPORT', caseId: id }); reject(s, { type: 'REFLECT' });
  });

  it('keeps observation, preparations and free cancellation separate from real practice', () => {
    const s = promoted(); reject(s, { type: 'OBSERVE', caseId: 'chosen-form' }); reject(s, { type: 'REFLECT' });
    begin(s, 'moving-token', 'ABILITY'); expect(s.puppet.life.token.permission).toBe(true);
    const sp = s.spirituality; s.actionsRemaining = 0; act(s, { type: 'WITHDRAW', caseId: 'moving-token' });
    expect(s.puppet.life.token).toMatchObject({ permission: false, position: 'NEAR', distanceMetres: 0 });
    expect(s.spirituality).toBe(sp); expect(s.puppet.life.cases['moving-token'].attempts).toEqual([]);
    reject(s, { type: 'PERFORM', caseId: 'moving-token' }); reject(s, { type: 'WITHDRAW', caseId: 'moving-token' });
  });

  it.each([{ method: 'ABILITY' as const, roll: 1 }, { method: 'ABILITY' as const, roll: 100 }, { method: 'ORDINARY' as const, roll: 1 }, { method: 'ORDINARY' as const, roll: 100 }])('moves and returns exactly the same token with $method at roll $roll', ({ method, roll }) => {
    const s = promoted(), old = originals(s); begin(s, 'moving-token', method);
    s.actionsRemaining = 1; s.spirituality = method === 'ABILITY' ? 3 : 0;
    const result = act(s, { type: 'PERFORM', caseId: 'moving-token' }, roll);
    expect(result.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', method === 'ABILITY' ? 18 : 10);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); expect(hasPuppetLifeLock(s)).toBe(true);
    expect(s.puppet.life.token.position).toBe(method === 'ORDINARY' ? 'PLAYER' : roll === 1 ? 'FAR' : 'NEAR');
    expect(s.puppet.life.token.playerNode).toBe(method === 'ORDINARY' ? 'FAR' : 'NEAR');
    reject(s, { type: 'REPORT', caseId: 'moving-token' }); expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow();
    if (method === 'ORDINARY' || roll === 1) {
      reject(s, { type: 'CLOSE', caseId: 'moving-token' });
      expect(puppetLifeActions(s).find(a => a.command.type === 'RETURN_ROUTE')).toMatchObject({ enabled: true });
    }
    s.mind = 0; const ended = close(s, 'moving-token');
    expect(notes(ended)).toContain('同一PU4-TOKEN-1'); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    expect(s.puppet.life.token).toMatchObject({ position: 'GUIDE', playerNode: 'NEAR', owner: 'HARLAN', permission: false, distanceMetres: method === 'ABILITY' && roll === 100 ? 0 : 4, handovers: 1 });
    expect(hasPuppetLifeLock(s)).toBe(false); expect(originals(s)).toEqual(old); expect(ended.ctx.check).not.toHaveBeenCalled(); expect(ended.award).not.toHaveBeenCalled();
    reject(s, { type: 'RETURN_ROUTE', caseId: 'moving-token' }); reject(s, { type: 'CLOSE', caseId: 'moving-token' });
  });

  it('requires a real next week after failed token movement and retries the same original', () => {
    const s = promoted(); begin(s, 'moving-token', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'moving-token' }, 100); close(s, 'moving-token');
    reject(s, { type: 'PREPARE', caseId: 'moving-token', method: 'ABILITY' }); reject(s, { type: 'REPORT', caseId: 'moving-token' });
    nextWeek(s); const report = finish(s, 'moving-token', 'ABILITY');
    expect(report.award).toHaveBeenCalledExactlyOnceWith('chained.s4.object-motion', 8);
    expect(s.puppet.life.token).toMatchObject({ id: 'PU4-TOKEN-1', distanceMetres: 4, handovers: 2 });
    expect(s.puppet.life.cases['moving-token'].attempts.map(a => a.success)).toEqual([false, true]);
  });

  it.each(['WOOD', 'PAPER'] as const)('actually transforms own body to %s, requires real route and free restoration at last AP', form => {
    const s = formsReady(), old = originals(s); begin(s, 'chosen-form', 'ABILITY');
    reject(s, { type: 'PERFORM', caseId: 'chosen-form' }); s.actionsRemaining = 1; s.spirituality = 3;
    const trial = act(s, { type: 'FORM_TRIAL', caseId: 'chosen-form', form });
    expect(trial.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect(s.puppet.life.body).toMatchObject({ form, owner: 'SELF', node: 'DOOR', route: 'WAITING', distanceMetres: 0 });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    reject(s, { type: 'RESTORE_FORM', caseId: 'chosen-form' }); reject(s, { type: 'CLOSE', caseId: 'chosen-form' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    s.mind = 0; act(s, { type: 'RETURN_FORM_ROUTE', caseId: 'chosen-form' });
    expect(s.puppet.life.body).toMatchObject({ form, distanceMetres: 4, route: 'RETURNED' });
    reject(s, { type: 'RETURN_FORM_ROUTE', caseId: 'chosen-form' });
    expect(puppetLifeActions(s).find(a => a.command.type === 'RESTORE_FORM')).toMatchObject({ enabled: true });
    act(s, { type: 'RESTORE_FORM', caseId: 'chosen-form' }); close(s, 'chosen-form');
    expect(s.puppet.life.body).toMatchObject({ form: 'HUMAN', restorations: 1 }); expect(originals(s)).toEqual(old);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); reject(s, { type: 'REPORT', caseId: 'chosen-form' });
  });

  it('requires both separately paid successful forms and never repeats a successful form or reward', () => {
    const s = formsReady(), ap = s.actionsRemaining, sp = s.spirituality;
    for (const form of ['WOOD', 'PAPER'] as const) {
      begin(s, 'chosen-form', 'ABILITY');
      if (form === 'PAPER') {
        expect(puppetLifeActions(s).find(a => a.id === 'chosen-form-wood')).toMatchObject({ enabled: false });
        reject(s, { type: 'FORM_TRIAL', caseId: 'chosen-form', form: 'WOOD' });
      }
      act(s, { type: 'FORM_TRIAL', caseId: 'chosen-form', form }); close(s, 'chosen-form');
    }
    const report = act(s, { type: 'REPORT', caseId: 'chosen-form' });
    expect(s.actionsRemaining).toBe(ap - 6); expect(s.spirituality).toBe(sp - 6);
    expect(s.puppet.life.body).toMatchObject({ form: 'HUMAN', checked: { WOOD: true, PAPER: true }, distanceMetres: 8, restorations: 2 });
    expect(report.award).toHaveBeenCalledExactlyOnceWith('chained.s4.cursed-form', 8); expect(s.progression.mastery['chained.s4.cursed-form']).toBe(8);
    expect(notes(report)).toContain('累计八米'); reject(s, { type: 'REPORT', caseId: 'chosen-form' });
  });

  it('retains failed form cost without fake movement and allows only another untried form this week', () => {
    const s = formsReady(); begin(s, 'chosen-form', 'ABILITY'); const sp = s.spirituality;
    act(s, { type: 'FORM_TRIAL', caseId: 'chosen-form', form: 'WOOD' }, 100); close(s, 'chosen-form');
    expect(s.spirituality).toBe(sp - 3); expect(s.puppet.life.body).toMatchObject({ form: 'HUMAN', distanceMetres: 0, restorations: 0 });
    begin(s, 'chosen-form', 'ABILITY'); reject(s, { type: 'FORM_TRIAL', caseId: 'chosen-form', form: 'WOOD' });
    act(s, { type: 'FORM_TRIAL', caseId: 'chosen-form', form: 'PAPER' }); close(s, 'chosen-form');
    reject(s, { type: 'PREPARE', caseId: 'chosen-form', method: 'ABILITY' });
    nextWeek(s); begin(s, 'chosen-form', 'ABILITY'); act(s, { type: 'FORM_TRIAL', caseId: 'chosen-form', form: 'WOOD' }); close(s, 'chosen-form');
    act(s, { type: 'REPORT', caseId: 'chosen-form' });
    expect(s.puppet.life.cases['chosen-form'].attempts.map(a => a.success)).toEqual([false, true, true]); expect(s.puppet.life.body.distanceMetres).toBe(8);
  });

  it.each([false, true])('establishes a real limited link, then actually releases with withdrawal=%s and never hurts Nolan', withdraw => {
    const s = linkReady(), old = originals(s), health = s.health;
    s.actionsRemaining = 1; s.spirituality = 3; const result = act(s, { type: 'PERFORM', caseId: 'reversible-link' });
    expect(result.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect(s.puppet.life.link).toMatchObject({ state: 'LINKED', subjectId: 'NOLAN', consented: true, contactDistanceMetres: 2 });
    expect(s.puppet.life.note).toMatchObject({ id: 'PU4-NOTE-1', holder: 'PLAYER', handovers: 0 });
    expect(s.health).toBe(health); expect(originals(s)).toEqual(old); expect(result.award).not.toHaveBeenCalled();
    reject(s, { type: 'REPORT', caseId: 'reversible-link' }); s.mind = 0;
    if (withdraw) {
      act(s, { type: 'WITHDRAW_CONSENT', caseId: 'reversible-link' });
      expect(s.puppet.life.link).toMatchObject({ state: 'RELEASED', consented: false, consentWithdrawals: 1 });
      reject(s, { type: 'WITHDRAW_CONSENT', caseId: 'reversible-link' }); reject(s, { type: 'PERFORM', caseId: 'reversible-link' });
    }
    close(s, 'reversible-link'); expect(s.puppet.life.link).toMatchObject({ state: 'RELEASED', consented: false, releases: 1 });
    expect(s.puppet.life.note).toMatchObject({ holder: 'GUIDE', handovers: 1 }); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    expect(originals(s)).toEqual(old); s.mind = 100; s.actionsRemaining = 1;
    expect(act(s, { type: 'REPORT', caseId: 'reversible-link' }).award).toHaveBeenCalledExactlyOnceWith('chained.s4.curse-link', 8);
  });

  it('preserves failed link cost and same-paper text while a later ordinary retry creates no hidden link', () => {
    const s = linkReady(); act(s, { type: 'PERFORM', caseId: 'reversible-link' }, 100);
    expect(s.puppet.life.link).toMatchObject({ state: 'NONE', contactDistanceMetres: 2 });
    reject(s, { type: 'WITHDRAW_CONSENT', caseId: 'reversible-link' }); close(s, 'reversible-link');
    const first = s.puppet.life.note.writings[0]; reject(s, { type: 'PREPARE', caseId: 'reversible-link', method: 'ORDINARY' });
    nextWeek(s); const report = finish(s, 'reversible-link');
    expect(report.award).not.toHaveBeenCalled(); expect(s.puppet.life.note.writings[0]).toBe(first);
    expect(s.puppet.life.note).toMatchObject({ id: 'PU4-NOTE-1', handovers: 2, holder: 'GUIDE' }); expect(s.puppet.life.link.state).toBe('NONE');
  });
});

describe('Puppet finite authored moon notices, actual waits and saved original facts', () => {
  it.each(['GUARDED', 'ALONE'] as const)('handles one real due notice with %s, actual six hours and capped cost at zero AP', method => {
    const s = promoted(), old = originals(s); setWeek(s, s.puppet.promotionWeek! + 3);
    const ctx = context(s).ctx; syncPuppetMoon(s, ctx);
    expect(s.puppet.life.moon.pendingId).toBe('PU4-MOON-1'); expect(hasPuppetLifeLock(s)).toBe(true); expect(validatePuppetLife(s)).toBe(true);
    const frozen = structuredClone(s); syncPuppetMoon(s, ctx); projectPuppetLife(s); expect(s).toEqual(frozen);
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow(); reject(s, { type: 'OBSERVE', caseId: 'moving-token' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 3; const week = s.week, date = structuredClone(s.date);
    act(s, { type: 'HANDLE_MOON', method });
    expect(s.puppet.life.moon.history).toEqual([{ id: 'PU4-MOON-1', announcedWeek: week, week, method, mentalCost: 3, waitedHours: 6, deferred: false }]);
    expect([s.actionsRemaining, s.spirituality, s.mind, s.health, s.week]).toEqual([0, 0, 0, 100, week]); expect(s.date).toEqual(date); expect(s.status).toBe('ACTIVE');
    expect(s.puppet.life.moon.waitedHours).toBe(6); expect(originals(s)).toEqual(old); reject(s, { type: 'HANDLE_MOON', method });
  });

  it('defers the same announced event beyond its date until the actual contact closes', () => {
    const s = promoted(); setWeek(s, s.puppet.promotionWeek! + 4); begin(s, 'moving-token', 'ABILITY');
    act(s, { type: 'PERFORM', caseId: 'moving-token' }); syncPuppetMoon(s, context(s).ctx);
    expect(s.puppet.life.moon.pendingId).toBeNull(); close(s, 'moving-token'); syncPuppetMoon(s, context(s).ctx);
    expect(s.puppet.life.moon.pendingId).toBe('PU4-MOON-1'); act(s, { type: 'HANDLE_MOON', method: 'GUARDED' });
    expect(s.puppet.life.moon.history[0]).toMatchObject({ id: 'PU4-MOON-1', announcedWeek: s.puppet.promotionWeek! + 3, week: s.week, deferred: true, mentalCost: 8 });
  });

  it('does not create pending state during events or combat and catches up both original notices without renewal', () => {
    const s = promoted(); setWeek(s, s.puppet.promotionWeek! + 20);
    s.activeEvent = {} as NonNullable<SliceState['activeEvent']>; syncPuppetMoon(s, context(s).ctx); expect(s.puppet.life.moon.pendingId).toBeNull();
    s.activeEvent = null; s.combat = {} as NonNullable<SliceState['combat']>; syncPuppetMoon(s, context(s).ctx); expect(s.puppet.life.moon.pendingId).toBeNull(); s.combat = null;
    for (const id of ['PU4-MOON-1', 'PU4-MOON-2']) {
      syncPuppetMoon(s, context(s).ctx); expect(s.puppet.life.moon.pendingId).toBe(id); act(s, { type: 'HANDLE_MOON', method: 'ALONE' });
    }
    expect(s.puppet.life.moon.history.map(h => h.mentalCost)).toEqual([16, 16]); expect(s.puppet.life.moon.waitedHours).toBe(12);
    const moon = structuredClone(s.puppet.life.moon); setWeek(s, s.week + 100); syncPuppetMoon(s, context(s).ctx); expect(s.puppet.life.moon).toEqual(moon); expect(validatePuppetLife(s)).toBe(true);
    expect(projectPuppetLife(s).moon.notices.every(n => n.status === '已实际度过')).toBe(true);
  });

  it('requires original Harlan in Backlund for guarded waiting but allows actual solitary waiting in place', () => {
    const s = promoted(); setWeek(s, s.puppet.promotionWeek! + 3); s.world.city = 'TINGEN'; syncPuppetMoon(s, context(s).ctx);
    expect(puppetActivityReason(s, { type: 'HANDLE_MOON', method: 'GUARDED' })).toContain('只在贝克兰德');
    reject(s, { type: 'HANDLE_MOON', method: 'GUARDED' }); act(s, { type: 'HANDLE_MOON', method: 'ALONE' });
    expect(s.world.city).toBe('TINGEN'); expect(s.puppet.life.moon.history[0]?.mentalCost).toBe(16);
  });

  it('rejects fabricated original object, body, route, reward and moon state before mutation', () => {
    const s = formsReady(); begin(s, 'chosen-form', 'ABILITY'); act(s, { type: 'FORM_TRIAL', caseId: 'chosen-form', form: 'WOOD' });
    const mutations: ((copy: SliceState) => void)[] = [
      copy => { (copy.puppet.life.token as { id: string }).id = 'NEW-TOKEN'; },
      copy => { copy.puppet.life.token.distanceMetres += 2; },
      copy => { copy.puppet.life.body.owner = 'OTHER' as 'SELF'; },
      copy => { copy.puppet.life.body.form = 'HUMAN'; },
      copy => { copy.puppet.life.body.checked.PAPER = true; },
      copy => { copy.puppet.life.body.distanceMetres = 4; },
      copy => { copy.puppet.life.link.state = 'LINKED'; },
      copy => { copy.puppet.life.note.holder = 'PLAYER'; },
      copy => { copy.progression.acting = 100; },
      copy => { copy.puppet.life.moon.notices[0]!.week += 1; },
      copy => { copy.puppet.life.moon.waitedHours = 6; },
      copy => { copy.puppet.life.moon.pendingId = 'PU4-MOON-2'; },
    ];
    for (const mutate of mutations) {
      const copy = structuredClone(s); mutate(copy); expect(validatePuppetLife(copy)).toBe(false); reject(copy, { type: 'RETURN_FORM_ROUTE', caseId: 'chosen-form' });
    }
    close(s, 'chosen-form'); expect(validatePuppetLife(JSON.parse(JSON.stringify(s)) as SliceState)).toBe(true);
  });

  it('does not process old moon or fabricate an early, duplicate or third new moon record', () => {
    const s = promoted(); syncPuppetMoon(s, context(s).ctx); expect(s.puppet.life.moon.pendingId).toBeNull();
    reject(s, { type: 'HANDLE_MOON', method: 'ALONE' }); setWeek(s, s.puppet.promotionWeek! + 3); syncPuppetMoon(s, context(s).ctx); act(s, { type: 'HANDLE_MOON', method: 'GUARDED' });
    for (const mutate of [
      (copy: SliceState) => { copy.puppet.life.moon.history.push(structuredClone(copy.puppet.life.moon.history[0]!)); },
      (copy: SliceState) => { copy.puppet.life.moon.history[0]!.announcedWeek -= 1; },
      (copy: SliceState) => { copy.puppet.life.moon.history[0]!.week -= 1; },
      (copy: SliceState) => { copy.puppet.life.moon.history[0]!.mentalCost = 9; },
      (copy: SliceState) => { copy.puppet.life.moon.history[0]!.deferred = true; },
    ]) { const copy = structuredClone(s); mutate(copy); expect(validatePuppetLife(copy)).toBe(false); }
  });
});
