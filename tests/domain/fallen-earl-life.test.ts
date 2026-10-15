import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyFallenEarlCommand, createFallenEarlState } from '../../src/domain/fallen-earl/index.js';
import { FALLEN_EARL_ABILITY_IDS, type FallenEarlAbilityId } from '../../src/domain/fallen-earl/types.js';
import {
  applyFallenEarlActivity, createFallenEarlLifeState, hasFallenEarlLifeLock,
  projectFallenEarlLife, fallenEarlActivityReason, fallenEarlLifeActions,
  validateFallenEarlActivityCommand, validateFallenEarlLife,
  FALLEN_EARL_CASE_IDS, FALLEN_EARL_LIFE_ENVIRONMENT,
  type FallenEarlActivityCommand, type FallenEarlCaseId,
} from '../../src/domain/fallen-earl/life.js';

// Directed unit fixtures continue the actual old story. Fixed rolls do not claim natural-play success.
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((id: FallenEarlAbilityId, amount = 8) => { s.progression.mastery[id] = (s.progression.mastery[id] ?? 0) + amount; });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function previous(): SliceState {
  const s = migrateSliceState(JSON.parse(readFileSync('tests/fixtures/mentor-disorder-v01140/natural.json', 'utf8')).final);
  s.fallenEarl = createFallenEarlState(); setWeek(s, Math.max(s.week, s.mentorDisorder.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 40000; s.health = 100; s.mind = 100; s.spirituality = 100;
  s.character.coreStats.will = 28; s.character.coreStats.knowledge = 28;
  return s;
}
function promoted() {
  const s = previous(), { ctx } = context(s);
  applyFallenEarlCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyFallenEarlCommand(s, { type: 'BUY_POTION', bottleId: 'fallen-earl-potion-1' }, ctx);
  applyFallenEarlCommand(s, { type: 'CONSUME', bottleId: 'fallen-earl-potion-1', confirmed: true }, ctx);
  expect(validateFallenEarlLife(s)).toBe(true); return s;
}
function act(s: SliceState, command: FallenEarlActivityCommand, roll = 1) {
  const c = context(s, roll); applyFallenEarlActivity(s, command, c.ctx, c.award);
  expect(validateFallenEarlLife(s), `invalid after ${JSON.stringify(command)}`).toBe(true); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyFallenEarlActivity(s, command as FallenEarlActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: FallenEarlCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.fallenEarl.life.cases[caseId].status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function close(s: SliceState, caseId: FallenEarlCaseId) {
  const a = s.fallenEarl.life.cases[caseId].attempts.at(-1)!;
  if (!a.cleaned) {
    if (caseId === 'willing-pause') act(s, { type: 'WAIT_RECOVERY', caseId });
    if (caseId === 'own-push') act(s, { type: 'RETURN_CRATE', caseId });
    if (caseId === 'short-rise') act(s, { type: 'LAND', caseId });
  }
  return act(s, { type: 'CLOSE', caseId });
}
function finish(s: SliceState, caseId: FallenEarlCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); close(s, caseId); return act(s, { type: 'REPORT', caseId });
}
function ready(caseId: FallenEarlCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const s = promoted();
  for (const id of FALLEN_EARL_CASE_IDS) { if (id === caseId) break; finish(s, id); }
  begin(s, caseId, method); return s;
}
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 100; s.mind = 100; s.spirituality = 100; }
const notes = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
function originals(s: SliceState) { return structuredClone([s.lawyer, s.barbarian, s.briber, s.corruptionBaron, s.mentorDisorder, s.character, s.combatHistory, s.world, s.town]); }

describe('Fallen Earl finite life, original people and actual ordinary exits', () => {
  it('stays dormant before promotion and projects three source-bounded G practices without a second gift inventory', () => {
    const old = previous();
    expect(validateFallenEarlLife(old)).toBe(true); expect(fallenEarlLifeActions(old)).toEqual([]);
    expect(projectFallenEarlLife(old)).toEqual({ cases: [], insideCase: false, environment: '', practice: null });
    expect(old.fallenEarl.life).toEqual(createFallenEarlLifeState());
    const s = promoted(), before = structuredClone(s), p = projectFallenEarlLife(s);
    expect(p.cases.map(c => c.id)).toEqual([...FALLEN_EARL_CASE_IDS]); expect(p.cases.every(c => c.observations.length === 0)).toBe(true);
    expect(s).toEqual(before); expect(Object.hasOwn(s.fallenEarl.life, 'gifts')).toBe(false);
    for (const phrase of ['原创G', '完整配方与晋升仪式仍未知', '准备不施法', '不开放神话形态', '唯一贿赂礼物库存不改']) expect(FALLEN_EARL_LIFE_ENVIRONMENT).toContain(phrase);
  });

  it('finishes all three ordinary cases and reflection for thirteen real actions, no ability mastery and no old story changes', () => {
    const s = promoted(), old = originals(s), ap = s.actionsRemaining, spirit = s.spirituality;
    for (const id of FALLEN_EARL_CASE_IDS) expect(finish(s, id).award).not.toHaveBeenCalled();
    act(s, { type: 'REFLECT' }); expect(ap - s.actionsRemaining).toBe(13); expect(s.spirituality).toBe(spirit);
    expect(s.progression.acting).toBe(100); expect(FALLEN_EARL_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
    expect(s.fallenEarl.life.clerk).toMatchObject({ person: 'ORIGINAL_EVE', position: 'ORIGINAL_DESK', independentMind: true, effect: 'NONE', remainingSeconds: 0, elapsedSeconds: 0, confirmations: 1 });
    expect(s.fallenEarl.life.crate).toMatchObject({ id: 'FE4-CRATE-1', holder: 'GUIDE', positionMetres: 0, distanceMetres: 2, handovers: 1 });
    expect(s.fallenEarl.life.pad).toMatchObject({ id: 'FE4-PAD-1', holder: 'GUIDE', bodyState: 'GROUNDED', remainingSeconds: 0, elapsedSeconds: 1, handovers: 1 });
    expect(originals(s)).toEqual(old); expect(hasFallenEarlLifeLock(s)).toBe(false);
    for (const id of FALLEN_EARL_CASE_IDS) reject(s, { type: 'REPORT', caseId: id }); reject(s, { type: 'REFLECT' });
  });

  it('pays eleven spirituality across three actual ability trials and awards each new mastery only on its one closed report', () => {
    const s = promoted(), old = originals(s), spirit = s.spirituality;
    for (const [index, id] of FALLEN_EARL_CASE_IDS.entries()) {
      begin(s, id, 'ABILITY'); const performed = act(s, { type: 'PERFORM', caseId: id });
      expect(performed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 18); expect(performed.award).not.toHaveBeenCalled();
      reject(s, { type: 'REPORT', caseId: id }); close(s, id);
      expect(act(s, { type: 'REPORT', caseId: id }).award).toHaveBeenCalledExactlyOnceWith(FALLEN_EARL_ABILITY_IDS[index], 8);
    }
    act(s, { type: 'REFLECT' }); expect(s.spirituality).toBe(spirit - 11);
    expect(FALLEN_EARL_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 8, 8]);
    expect(s.fallenEarl.life.clerk.elapsedSeconds).toBe(30); expect(s.fallenEarl.life.pad.elapsedSeconds).toBe(4); expect(originals(s)).toEqual(old);
  });

  it.each(FALLEN_EARL_CASE_IDS)('preparing %s on the last action opens no contact or effect and can be cancelled without implementation cost', caseId => {
    const s = promoted();
    for (const id of FALLEN_EARL_CASE_IDS) { if (id === caseId) break; finish(s, id); }
    act(s, { type: 'OBSERVE', caseId }); const old = originals(s); s.actionsRemaining = 1;
    act(s, { type: 'PREPARE', caseId, method: 'ABILITY' });
    expect(s.actionsRemaining).toBe(0); expect(hasFallenEarlLifeLock(s)).toBe(false);
    expect(s.fallenEarl.life.clerk.effect).toBe('NONE'); expect(s.fallenEarl.life.crate.holder).toBe('GUIDE'); expect(s.fallenEarl.life.pad.bodyState).toBe('GROUNDED');
    s.spirituality = 0; reject(s, { type: 'PERFORM', caseId });
    act(s, { type: 'WITHDRAW', caseId });
    expect(s.fallenEarl.life.cases[caseId]).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, attempts: [] });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); expect(originals(s)).toEqual(old);
  });

  it('rechecks the original person after a prepared real-week boundary rather than treating preparation as permanent consent', () => {
    const s = ready('willing-pause'), week = s.week;
    expect(hasFallenEarlLifeLock(s)).toBe(false); nextWeek(s);
    expect(notes(act(s, { type: 'PERFORM', caseId: 'willing-pause' }))).toContain('当面重新确认原伊芙');
    expect(s.fallenEarl.life.cases['willing-pause'].attempts[0]?.week).toBe(week + 1); close(s, 'willing-pause');
  });

  it('withdraws consent before performance without applying a state or charging implementation, and requires new preparation', () => {
    const s = ready('willing-pause'), spirit = s.spirituality;
    s.actionsRemaining = 0; act(s, { type: 'WITHDRAW_CONSENT', caseId: 'willing-pause' });
    expect(s.fallenEarl.life.clerk).toMatchObject({ consented: false, effect: 'NONE', remainingSeconds: 0, elapsedSeconds: 0, consentWithdrawals: 1, cancelledConsents: 1 });
    expect(s.fallenEarl.life.cases['willing-pause'].attempts).toEqual([]); expect(s.spirituality).toBe(spirit);
    reject(s, { type: 'PERFORM', caseId: 'willing-pause' }); reject(s, { type: 'WITHDRAW_CONSENT', caseId: 'willing-pause' });
    nextWeek(s); begin(s, 'willing-pause', 'ORDINARY'); act(s, { type: 'PERFORM', caseId: 'willing-pause' }); close(s, 'willing-pause');
  });

  it('withdrawal after successful bestow preserves thirty real seconds until natural recovery, even at zero action and spirit', () => {
    const s = ready('willing-pause'), old = originals(s), health = s.health;
    s.actionsRemaining = 1; s.spirituality = 4; act(s, { type: 'PERFORM', caseId: 'willing-pause' });
    expect(s.fallenEarl.life.clerk).toMatchObject({ effect: 'LACK_ENTHUSIASM', remainingSeconds: 30, elapsedSeconds: 0 });
    act(s, { type: 'WITHDRAW_CONSENT', caseId: 'willing-pause' });
    expect(s.fallenEarl.life.clerk).toMatchObject({ consented: false, effect: 'LACK_ENTHUSIASM', remainingSeconds: 30 });
    expect(s.fallenEarl.life.cases['willing-pause'].attempts[0]).toMatchObject({ consentWithdrawn: true, spiritualityCost: 4, cleaned: false, closed: false });
    reject(s, { type: 'CLOSE', caseId: 'willing-pause' }); reject(s, { type: 'WITHDRAW', caseId: 'willing-pause' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    s.mind = 0; const waited = act(s, { type: 'WAIT_RECOVERY', caseId: 'willing-pause' });
    expect(waited.ctx.check).not.toHaveBeenCalled(); expect(s.fallenEarl.life.clerk).toMatchObject({ effect: 'NONE', remainingSeconds: 0, elapsedSeconds: 30 });
    reject(s, { type: 'WAIT_RECOVERY', caseId: 'willing-pause' }); expect(hasFallenEarlLifeLock(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'willing-pause' }); expect(hasFallenEarlLifeLock(s)).toBe(false);
    expect([s.actionsRemaining, s.spirituality, s.health, s.mind]).toEqual([0, 0, health, 0]); expect(originals(s)).toEqual(old);
  });

  it('retains paid resisted bestow with no effect or fake waiting, then retries only in the next real week', () => {
    const s = ready('willing-pause'), spirit = s.spirituality;
    const result = act(s, { type: 'PERFORM', caseId: 'willing-pause' }, 100);
    expect(notes(result)).toContain('RESISTED'); expect(s.spirituality).toBe(spirit - 4);
    expect(s.fallenEarl.life.clerk).toMatchObject({ effect: 'NONE', remainingSeconds: 0, elapsedSeconds: 0 });
    expect(notes(act(s, { type: 'WAIT_RECOVERY', caseId: 'willing-pause' }))).toContain('实际经过0秒');
    act(s, { type: 'CLOSE', caseId: 'willing-pause' }); reject(s, { type: 'REPORT', caseId: 'willing-pause' }); reject(s, { type: 'PREPARE', caseId: 'willing-pause', method: 'ABILITY' });
    nextWeek(s); finish(s, 'willing-pause', 'ABILITY');
    expect(s.fallenEarl.life.cases['willing-pause'].attempts.map(a => [a.success, a.outcome, a.spiritualityCost, a.elapsedSeconds])).toEqual([[false, 'RESISTED', 4, 0], [true, 'LACK_ENTHUSIASM', 4, 30]]);
    expect(s.fallenEarl.life.clerk.confirmations).toBe(2);
  });

  it.each([1, 100])('ordinary pause at roll %s preserves independent choice, costs no spirituality and can close without a fabricated timer', roll => {
    const s = ready('willing-pause', 'ORDINARY'), spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'willing-pause' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(spirit);
    expect(s.fallenEarl.life.cases['willing-pause'].attempts[0]).toMatchObject({ outcome: 'FREE_PAUSE', success: roll === 1, spiritualityCost: 0 });
    act(s, { type: 'CLOSE', caseId: 'willing-pause' }); expect(s.fallenEarl.life.clerk).toMatchObject({ independentMind: true, position: 'ORIGINAL_DESK', elapsedSeconds: 0, effect: 'NONE' });
    if (roll === 1) expect(act(s, { type: 'REPORT', caseId: 'willing-pause' }).award).not.toHaveBeenCalled();
    else reject(s, { type: 'REPORT', caseId: 'willing-pause' });
  });

  it.each([['ABILITY', 1, 1, 4], ['ABILITY', 100, 0, 4], ['ORDINARY', 1, 1, 0], ['ORDINARY', 100, 0, 0]] as const)('%s push at roll %s moves the same crate to %s metres and costs %s spirit', (method, roll, metres, spiritCost) => {
    const s = ready('own-push', method), old = originals(s), before = s.spirituality;
    s.actionsRemaining = 1; const c = act(s, { type: 'PERFORM', caseId: 'own-push' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', method === 'ABILITY' ? 18 : 10); expect(s.spirituality).toBe(before - spiritCost);
    expect(s.fallenEarl.life.crate).toMatchObject({ id: 'FE4-CRATE-1', holder: 'FLOOR', positionMetres: metres, distanceMetres: 0, handovers: 0 });
    reject(s, { type: 'CLOSE', caseId: 'own-push' }); reject(s, { type: 'REPORT', caseId: 'own-push' });
    s.spirituality = 0; s.mind = 0; act(s, { type: 'RETURN_CRATE', caseId: 'own-push' });
    expect(s.fallenEarl.life.crate).toMatchObject({ holder: 'FLOOR', positionMetres: 0, distanceMetres: metres * 2, handovers: 0 });
    expect(hasFallenEarlLifeLock(s)).toBe(true); reject(s, { type: 'RETURN_CRATE', caseId: 'own-push' });
    expect(fallenEarlLifeActions(s).some(a => a.command.type === 'RETURN_CRATE' && a.enabled)).toBe(false);
    act(s, { type: 'CLOSE', caseId: 'own-push' }); expect(s.fallenEarl.life.crate).toMatchObject({ holder: 'GUIDE', handovers: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(originals(s)).toEqual(old);
  });

  it('reuses the same original crate after failed paid push, retaining zero failed distance and two successful metres', () => {
    const s = ready('own-push'); act(s, { type: 'PERFORM', caseId: 'own-push' }, 100); close(s, 'own-push');
    reject(s, { type: 'PREPARE', caseId: 'own-push', method: 'ORDINARY' }); nextWeek(s); finish(s, 'own-push', 'ABILITY');
    expect(s.fallenEarl.life.crate).toMatchObject({ id: 'FE4-CRATE-1', owner: 'GUIDE', distanceMetres: 2, handovers: 2 });
    expect(s.fallenEarl.life.cases['own-push'].attempts.map(a => [a.success, a.spiritualityCost, a.distanceMetres])).toEqual([[false, 4, 0], [true, 4, 2]]);
  });

  it.each([['ABILITY', 1, 4, 3], ['ABILITY', 100, 1, 3], ['ORDINARY', 1, 1, 0], ['ORDINARY', 100, 1, 0]] as const)('%s low jump at roll %s actually remains for %s seconds and costs %s spirit', (method, roll, seconds, spiritCost) => {
    const s = ready('short-rise', method), old = originals(s), before = s.spirituality;
    s.actionsRemaining = 1; const c = act(s, { type: 'PERFORM', caseId: 'short-rise' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', method === 'ABILITY' ? 18 : 10); expect(s.spirituality).toBe(before - spiritCost);
    expect(s.fallenEarl.life.pad).toMatchObject({ id: 'FE4-PAD-1', holder: 'FLOOR', positionMetres: 0, body: 'PLAYER_ORIGINAL', footwear: 'PLAYER_ORIGINAL', bodyState: seconds === 4 ? 'IN_AIR_EXTENDED' : 'IN_AIR_ORDINARY', remainingSeconds: seconds, elapsedSeconds: 0 });
    reject(s, { type: 'CLOSE', caseId: 'short-rise' }); reject(s, { type: 'PERFORM', caseId: 'short-rise' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow();
    s.spirituality = 0; s.mind = 0; const landed = act(s, { type: 'LAND', caseId: 'short-rise' });
    expect(landed.ctx.check).not.toHaveBeenCalled(); expect(s.fallenEarl.life.pad).toMatchObject({ holder: 'FLOOR', bodyState: 'GROUNDED', remainingSeconds: 0, elapsedSeconds: seconds, handovers: 0 });
    expect(hasFallenEarlLifeLock(s)).toBe(true); reject(s, { type: 'LAND', caseId: 'short-rise' });
    expect(fallenEarlLifeActions(s).some(a => a.command.type === 'LAND' && a.enabled)).toBe(false);
    act(s, { type: 'CLOSE', caseId: 'short-rise' }); expect(s.fallenEarl.life.pad).toMatchObject({ holder: 'GUIDE', handovers: 1, positionMetres: 0 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(originals(s)).toEqual(old);
  });

  it('preserves one-second failed low jump before next-week success and four-second original-pad landing', () => {
    const s = ready('short-rise'); act(s, { type: 'PERFORM', caseId: 'short-rise' }, 100); close(s, 'short-rise');
    reject(s, { type: 'REPORT', caseId: 'short-rise' }); reject(s, { type: 'PREPARE', caseId: 'short-rise', method: 'ABILITY' });
    nextWeek(s); finish(s, 'short-rise', 'ABILITY');
    expect(s.fallenEarl.life.pad).toMatchObject({ id: 'FE4-PAD-1', elapsedSeconds: 5, handovers: 2, body: 'PLAYER_ORIGINAL', footwear: 'PLAYER_ORIGINAL' });
    expect(s.fallenEarl.life.cases['short-rise'].attempts.map(a => [a.success, a.spiritualityCost, a.elapsedSeconds])).toEqual([[false, 3, 1], [true, 3, 4]]);
  });

  it('requires the actual guide city, active player and closed earlier contacts before starting another practice', () => {
    const base = promoted();
    const mutations: ((s: SliceState) => void)[] = [
      s => { s.world.city = 'TINGEN'; }, s => { s.mentorDisorder.guidanceKnown = false; }, s => { s.fallenEarl.guidanceKnown = false; },
      s => { s.activeEvent = {} as NonNullable<SliceState['activeEvent']>; }, s => { s.combat = {} as NonNullable<SliceState['combat']>; },
      s => { s.mentorDisorder.cases['paired-trays']!.contactOpen = true; }, s => { s.mentorDisorder.practice.route = 'MARKED'; },
      s => { s.briber.cases['volunteered-test']!.status = 'PREPARED'; }, s => { s.health = 0; }, s => { s.mind = 0; },
    ];
    for (const mutate of mutations) { const s = structuredClone(base); mutate(s); reject(s, { type: 'OBSERVE', caseId: 'willing-pause' }); }
    reject(base, { type: 'OBSERVE', caseId: 'own-push' }); reject(base, { type: 'REFLECT' });
  });

  it('projects remaining time and unfinished original handover without changing state or offering repeated cleanup', () => {
    const s = ready('short-rise'); act(s, { type: 'PERFORM', caseId: 'short-rise' }); const before = structuredClone(s);
    const projection = projectFallenEarlLife(s);
    expect(projection.insideCase).toBe(true); expect(projection.practice?.pad).toContain('剩余4秒');
    expect(projection.cases[2]?.result).toContain('尚须0行动实际收束'); expect(s).toEqual(before);
    act(s, { type: 'LAND', caseId: 'short-rise' });
    expect(fallenEarlLifeActions(s).some(a => a.command.type === 'CLOSE' && a.enabled)).toBe(true);
    expect(fallenEarlLifeActions(s).some(a => a.command.type === 'LAND')).toBe(false);
    expect(fallenEarlActivityReason(s, { type: 'REPORT', caseId: 'short-rise' })).not.toBeNull();
  });

  it('accepts only bounded scene-specific commands and keeps one state instance independent from another', () => {
    const good: FallenEarlActivityCommand[] = [
      { type: 'PREPARE', caseId: 'willing-pause', method: 'ABILITY' }, { type: 'WAIT_RECOVERY', caseId: 'willing-pause' },
      { type: 'WITHDRAW_CONSENT', caseId: 'willing-pause' }, { type: 'RETURN_CRATE', caseId: 'own-push' },
      { type: 'LAND', caseId: 'short-rise' }, { type: 'REFLECT' },
    ];
    expect(good.every(validateFallenEarlActivityCommand)).toBe(true);
    for (const command of [null, {}, { type: 'WAIT_RECOVERY', caseId: 'short-rise' }, { type: 'RETURN_CRATE', caseId: 'willing-pause' }, { type: 'LAND', caseId: 'own-push' }, { type: 'PERFORM', caseId: 'short-rise', seconds: 999 }, { type: 'REFLECT', caseId: 'own-push' }, { type: 'PREPARE', caseId: 'own-push', method: 'OTHER' }]) expect(validateFallenEarlActivityCommand(command)).toBe(false);
    const a = createFallenEarlLifeState(), b = createFallenEarlLifeState(); a.clerk.consented = true; a.crate.distanceMetres = 2;
    expect(b).toEqual(createFallenEarlLifeState());
  });
});
