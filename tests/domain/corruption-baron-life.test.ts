import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyLawyerCommand } from '../../src/domain/lawyer/index.js';
import { LAWYER_ABILITY_IDS } from '../../src/domain/lawyer/types.js';
import { applyBarbarianCommand } from '../../src/domain/barbarian/index.js';
import { BARBARIAN_ABILITY_IDS } from '../../src/domain/barbarian/types.js';
import { applyBriberCommand } from '../../src/domain/briber/index.js';
import { BRIBER_ABILITY_IDS } from '../../src/domain/briber/types.js';
import { applyCorruptionBaronCommand, createCorruptionBaronState, projectCorruptionBaron, validateCorruptionBaronCommand, validateCorruptionBaronState } from '../../src/domain/corruption-baron/index.js';
import { applyCorruptionBaronActivity, corruptionBaronActions, corruptionBaronCases, corruptionBaronInside, validateCorruptionBaronLife } from '../../src/domain/corruption-baron/life.js';
import { hasCorruptionBaronDisputeOpponent, settleCorruptionBaronEncounter } from '../../src/domain/corruption-baron/encounter.js';
import { CORRUPTION_BARON_FORMULA_STATUS, CORRUPTION_BARON_SOURCE_STATUS } from '../../src/domain/corruption-baron/content.js';
import { CORRUPTION_BARON_ABILITY_IDS, CORRUPTION_BARON_CASE_IDS, type CorruptionBaronAcquisitionCommand, type CorruptionBaronActivityCommand, type CorruptionBaronCaseId } from '../../src/domain/corruption-baron/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('corruption-baron-stage', sliceDefaultCreationSelection, 'corruption-baron-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.corruptionBaron = createCorruptionBaronState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[CORRUPTION_BARON_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function briber(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyLawyerCommand(s, { type: 'DISCOVER' }, c); applyLawyerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyLawyerCommand(s, { type: 'BUY_POTION', bottleId: s.lawyer.bottles[0]!.id }, c); applyLawyerCommand(s, { type: 'CONSUME', bottleId: s.lawyer.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applyBarbarianCommand(s, { type: 'LEARN_FORMULA' }, c); applyBarbarianCommand(s, { type: 'BUY_MATERIALS', batchId: 'barbarian-batch-1' }, c); applyBarbarianCommand(s, { type: 'BREW', batchId: 'barbarian-batch-1' }, c); applyBarbarianCommand(s, { type: 'CONSUME', bottleId: s.barbarian.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyBriberCommand(s, { type: 'LEARN_FORMULA' }, c); applyBriberCommand(s, { type: 'BUY_MATERIALS', batchId: 'briber-batch-1' }, c); applyBriberCommand(s, { type: 'BREW', batchId: 'briber-batch-1' }, c); applyBriberCommand(s, { type: 'CONSUME', bottleId: s.briber.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...LAWYER_ABILITY_IDS, ...BARBARIAN_ABILITY_IDS, ...BRIBER_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: CorruptionBaronAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyCorruptionBaronCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: CorruptionBaronActivityCommand, roll = 1) { const ctx = context(s, roll); applyCorruptionBaronActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = briber()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.corruptionBaron.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.corruptionBaron.bottles[0]!.id, confirmed: true }); return s; }
function rejectAcquisition(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyCorruptionBaronCommand(s, command as CorruptionBaronAcquisitionCommand, ctx.c)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyCorruptionBaronActivity(s, command as CorruptionBaronActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function begin(s: SliceState, caseId: CorruptionBaronCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: CorruptionBaronCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}
function firstReport() { const s = promoted(); complete(s, 'clause-order'); return s; }

describe('CorruptionBaron actual originals, bounded distortion and zero-AP cleanup', () => {
  it.each(CORRUPTION_BARON_CASE_IDS)('keeps failed %s costs and contact until actual zero-AP CLOSE', id => {
    const s = promoted();
    for (const earlier of CORRUPTION_BARON_CASE_IDS.slice(0, CORRUPTION_BARON_CASE_IDS.indexOf(id))) complete(s, earlier, 'ORDINARY');
    begin(s, id); const ap = s.actionsRemaining, sp = s.spirituality, gifts = structuredClone(s.briber.gifts);
    activity(s, { type: 'PERFORM', caseId: id }, 100);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, sp - 3]);
    expect(s.corruptionBaron.cases[id]).toMatchObject({ status: 'OBSERVED', contactOpen: true, outcome: 'NONE' });
    expect(s.corruptionBaron.practice).toEqual({ clauseOrder: id === 'clause-order' ? 'PENDING' : 'RESTORED', marker: id === 'clause-order' ? 'CRADLED' : id === 'rolling-marker' ? 'ROLLING' : 'STOPPED', route: id === 'agreed-route' ? 'MOVING' : 'READY' });
    expect(validateCorruptionBaronState(s)).toBe(true); expect(corruptionBaronInside(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: id }); rejectActivity(s, { type: 'BUY_GIFTS' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; s.health = 1;
    const closed = activity(s, { type: 'CLOSE', caseId: id });
    expect([s.actionsRemaining, s.spirituality, s.health, s.mind]).toEqual([0, 0, 1, 0]);
    expect(closed.c.check).not.toHaveBeenCalled(); expect(closed.award).not.toHaveBeenCalled(); expect(s.briber.gifts).toEqual(gifts);
    expect(s.corruptionBaron.practice).toEqual({ clauseOrder: 'RESTORED', marker: id === 'clause-order' ? 'CRADLED' : 'STOPPED', route: id === 'agreed-route' ? 'FREE' : 'READY' });
    expect(validateCorruptionBaronState(s)).toBe(true); expect(corruptionBaronInside(s)).toBe(false);
    s.actionsRemaining = 10; s.mind = 50;
    rejectActivity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    activity(s, { type: 'PERFORM', caseId: id }); activity(s, { type: 'CLOSE', caseId: id }); activity(s, { type: 'REPORT', caseId: id });
    expect(s.corruptionBaron.cases[id]!.closes).toBe(2); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it.each(CORRUPTION_BARON_CASE_IDS)('WITHDRAW also actually ends active %s, abandons the result and keeps paid costs', id => {
    const s = promoted();
    for (const earlier of CORRUPTION_BARON_CASE_IDS.slice(0, CORRUPTION_BARON_CASE_IDS.indexOf(id))) complete(s, earlier, 'ORDINARY');
    begin(s, id); activity(s, { type: 'PERFORM', caseId: id });
    s.actionsRemaining = 0; s.mind = 0; s.spirituality = 0;
    const closed = activity(s, { type: 'WITHDRAW', caseId: id });
    expect(s.corruptionBaron.cases[id]).toMatchObject({ status: 'OBSERVED', contactOpen: false, outcome: 'NONE', method: null, withdrawals: 1, closes: 1, attemptWeek: s.week });
    expect(closed.c.check).not.toHaveBeenCalled(); expect(closed.award).not.toHaveBeenCalled(); expect(validateCorruptionBaronState(s)).toBe(true);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    s.actionsRemaining = 10; s.mind = 50; rejectActivity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it.each(CORRUPTION_BARON_CASE_IDS)('last-AP PREPARE for %s keeps stable original state across weeks', id => {
    const s = promoted();
    for (const earlier of CORRUPTION_BARON_CASE_IDS.slice(0, CORRUPTION_BARON_CASE_IDS.indexOf(id))) complete(s, earlier);
    activity(s, { type: 'OBSERVE', caseId: id }); s.actionsRemaining = 1; const sp = s.spirituality;
    activity(s, { type: 'PREPARE', caseId: id, method: 'ABILITY' });
    expect([s.actionsRemaining, s.spirituality, corruptionBaronInside(s)]).toEqual([0, sp, false]);
    expect(s.corruptionBaron.practice).toEqual({ clauseOrder: id === 'clause-order' ? 'ORIGINAL' : 'RESTORED', marker: id === 'agreed-route' ? 'STOPPED' : 'CRADLED', route: 'READY' });
    s.week += 1; expect(validateCorruptionBaronState(s)).toBe(true);
    const closed = activity(s, { type: 'WITHDRAW', caseId: id });
    expect(s.corruptionBaron.cases[id]).toMatchObject({ status: 'OBSERVED', withdrawals: 1, closes: 0, attemptWeek: null });
    expect(closed.c.check).not.toHaveBeenCalled(); expect(JSON.stringify(vi.mocked(closed.c.note).mock.calls)).toContain('尚未实施');
    expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('temporarily adjusts an existing spoken order, then truly restores the original order', () => {
    const s = promoted(); begin(s, 'clause-order');
    expect(s.corruptionBaron.practice.clauseOrder).toBe('ORIGINAL');
    const done = activity(s, { type: 'PERFORM', caseId: 'clause-order' });
    expect(s.corruptionBaron.practice.clauseOrder).toBe('ADJUSTED');
    expect(JSON.stringify(vi.mocked(done.c.note).mock.calls)).toContain('已说出的原安排');
    rejectActivity(s, { type: 'REPORT', caseId: 'clause-order' });
    const close = activity(s, { type: 'CLOSE', caseId: 'clause-order' });
    expect(close.c.note).toHaveBeenCalledWith('实际结束本次有限实践', expect.stringContaining('恢复原核册次序'));
    expect(s.corruptionBaron.practice.clauseOrder).toBe('RESTORED'); activity(s, { type: 'REPORT', caseId: 'clause-order' });
    expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('releases the original ball before paid distortion and retains continuous physical movement', () => {
    const s = firstReport(); begin(s, 'rolling-marker'); const town = structuredClone(s.town), gifts = structuredClone(s.briber.gifts), sp = s.spirituality;
    expect(s.corruptionBaron.practice.marker).toBe('CRADLED'); expect(corruptionBaronInside(s)).toBe(false);
    const done = activity(s, { type: 'PERFORM', caseId: 'rolling-marker' });
    expect([s.spirituality, s.corruptionBaron.practice.marker]).toEqual([sp - 3, 'SIDE_POCKET']);
    const calls = vi.mocked(done.c.note).mock.calls;
    expect(calls.findIndex(([, text]) => text.includes('先沿原滚道真实滚动'))).toBeLessThan(calls.findIndex(([title]) => title === '有限扭曲的成本已付'));
    expect(JSON.stringify(calls)).toContain('沿连续路径进入原侧袋');
    expect(corruptionBaronCases(s)[1]!.result).toContain('接触仍在'); rejectActivity(s, { type: 'PERFORM', caseId: 'rolling-marker' });
    activity(s, { type: 'CLOSE', caseId: 'rolling-marker' }); expect(s.corruptionBaron.practice.marker).toBe('STOPPED');
    expect(s.town).toEqual(town); expect(s.briber.gifts).toEqual(gifts); activity(s, { type: 'REPORT', caseId: 'rolling-marker' }); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('uses an adult volunteer already walking their route and actually waits for short effects to end', () => {
    const s = firstReport(); complete(s, 'rolling-marker'); begin(s, 'agreed-route');
    expect(s.corruptionBaron.practice.route).toBe('READY');
    const done = activity(s, { type: 'PERFORM', caseId: 'agreed-route' });
    expect(s.corruptionBaron.practice.route).toBe('DIVERTED');
    const notes = JSON.stringify(vi.mocked(done.c.note).mock.calls);
    expect(notes).toContain('再次确认赛恩自愿'); expect(notes).toContain('按已有递送意图实际起步');
    const closed = activity(s, { type: 'CLOSE', caseId: 'agreed-route' });
    expect(closed.c.note).toHaveBeenCalledWith('实际结束本次有限实践', expect.stringContaining('等候已有短效过去'));
    expect(s.corruptionBaron.practice.route).toBe('FREE'); activity(s, { type: 'REPORT', caseId: 'agreed-route' }); expect(validateCorruptionBaronState(s)).toBe(true);
  });
  it('allows genuinely ordinary zero-spirituality methods for all three reports and peaceful100', () => {
    const s = promoted(); s.spirituality = 0; const ap = s.actionsRemaining;
    for (const id of CORRUPTION_BARON_CASE_IDS) complete(s, id, 'ORDINARY'); activity(s, { type: 'REFLECT' });
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap - 13, 0, 100]);
    expect(s.corruptionBaron.practice).toEqual({ clauseOrder: 'RESTORED', marker: 'STOPPED', route: 'FREE' });
    expect(corruptionBaronCases(s).every(r => r.result!.includes('普通方法'))).toBe(true);
    expect(validateCorruptionBaronState(s)).toBe(true); rejectActivity(s, { type: 'REFLECT' });
  });
  it('purchases through the old gift service without duplicating state or returning given originals', () => {
    const s = promoted(); s.actionsRemaining = 0; const cash = s.cash, oldState = structuredClone(s.corruptionBaron), oldGifts = structuredClone(s.briber.gifts);
    const result = activity(s, { type: 'BUY_GIFTS' });
    expect(s.cash).toBe(cash - 60); expect(s.actionsRemaining).toBe(0); expect(s.corruptionBaron).toEqual(oldState);
    expect(s.briber.gifts.slice(0, oldGifts.length)).toEqual(oldGifts); expect(s.briber.gifts.slice(-3)).toEqual([1, 2, 3].map(n => ({ id: `BR7-GIFT-${oldGifts.length + n}`, location: 'PLAYER', destination: null, givenWeek: null })));
    expect(projectCorruptionBaron(s).gifts).toMatchObject({ held: 3, given: 0 });
    expect(Object.hasOwn(s.corruptionBaron, 'gifts')).toBe(false); expect(result.c.check).not.toHaveBeenCalled(); expect(result.award).not.toHaveBeenCalled();
    s.briber.gifts[0]!.location = 'GIVEN'; s.briber.gifts[0]!.destination = 'BATTLE:CORRUPTION_BARON_DISPUTE:GROUND'; s.briber.gifts[0]!.givenWeek = s.week;
    expect(projectCorruptionBaron(s).gifts).toMatchObject({ held: 2, given: 1 });
    expect(projectCorruptionBaron(s).gifts.summary).toContain('目标未自愿接下');
  });
  it('rejects an unaffordable gift purchase and insufficient spirituality atomically', () => {
    const s = promoted(); s.cash = 59; rejectActivity(s, { type: 'BUY_GIFTS' });
    begin(s, 'clause-order'); s.spirituality = 2; rejectActivity(s, { type: 'PERFORM', caseId: 'clause-order' });
    activity(s, { type: 'WITHDRAW', caseId: 'clause-order' }); activity(s, { type: 'PREPARE', caseId: 'clause-order', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'clause-order' }); expect(s.spirituality).toBe(2);
  });
  it('validates exact source-bound state, ordering and awards without importing higher sequence powers', () => {
    const s = promoted(); expect(validateCorruptionBaronLife(s)).toBe(true);
    expect(corruptionBaronActions(s).some(a => a.command.type === 'OBSERVE' && a.enabled)).toBe(true);
    for (const mutate of [
      (v: SliceState) => { v.corruptionBaron.practice.clauseOrder = 'RESTORED'; },
      (v: SliceState) => { v.corruptionBaron.practice.marker = 'ROLLING'; },
      (v: SliceState) => { v.corruptionBaron.practice.route = 'FREE'; },
      (v: SliceState) => { v.corruptionBaron.cases['agreed-route']!.status = 'OBSERVED'; },
      (v: SliceState) => { (v.corruptionBaron as unknown as Record<string, unknown>).magnify = 2; },
      (v: SliceState) => { (v.corruptionBaron.practice as unknown as Record<string, unknown>).teleported = true; },
    ]) { const forged = structuredClone(s); mutate(forged); expect(validateCorruptionBaronState(forged)).toBe(false); }
    expect(CORRUPTION_BARON_ABILITY_IDS).toEqual(['black-emperor.s6.distortion']);
  });
});
