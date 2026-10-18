import { describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation.js';
import { createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyArbiterCommand } from '../../src/domain/arbiter/index.js';
import { ARBITER_ABILITY_IDS } from '../../src/domain/arbiter/types.js';
import { applySheriffCommand } from '../../src/domain/sheriff/index.js';
import { SHERIFF_ABILITY_IDS } from '../../src/domain/sheriff/types.js';
import { applyInterrogatorCommand } from '../../src/domain/interrogator/index.js';
import { INTERROGATOR_ABILITY_IDS } from '../../src/domain/interrogator/types.js';
import { applyJudgeCommand, createJudgeState, validateJudgeState } from '../../src/domain/judge/index.js';
import { applyJudgeActivity, judgeActions, judgeCases, judgeInside } from '../../src/domain/judge/life.js';
import { JUDGE_ABILITY_IDS, JUDGE_CASE_IDS, type JudgeAcquisitionCommand, type JudgeActivityCommand, type JudgeCaseId } from '../../src/domain/judge/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function ordinary(): SliceState {
  const s = createSliceRun('judge-stage', sliceDefaultCreationSelection, 'judge-fixed');
  s.activeEvent = null; s.eventQueue = []; s.week = 5; s.cash = 50000;
  s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.judge = createJudgeState(); return s;
}
function context(s: SliceState, roll = 1) {
  const c: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => { if (s.seer.completedSources.includes(source)) return; s.seer.completedSources.push(source); s.progression.mastery[JUDGE_ABILITY_IDS[0]]! += amount; });
  return { c, award };
}
/** Prior acting is a completed-history fixture; every original bottle is acquired through its real command. */
function interrogator(): SliceState {
  const s = ordinary(), c = context(s).c;
  applyArbiterCommand(s, { type: 'DISCOVER' }, c); applyArbiterCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyArbiterCommand(s, { type: 'BUY_POTION', bottleId: s.arbiter.bottles[0]!.id }, c); applyArbiterCommand(s, { type: 'CONSUME', bottleId: s.arbiter.bottles[0]!.id, confirmed: true }, c);
  s.week = 11; s.progression.acting = 100;
  applySheriffCommand(s, { type: 'LEARN_GUIDANCE' }, c); applySheriffCommand(s, { type: 'BUY_POTION', bottleId: s.sheriff.bottles[0]!.id }, c); applySheriffCommand(s, { type: 'CONSUME', bottleId: s.sheriff.bottles[0]!.id, confirmed: true }, c);
  s.week = 19; s.progression.acting = 100;
  applyInterrogatorCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyInterrogatorCommand(s, { type: 'BUY_POTION', bottleId: s.interrogator.bottles[0]!.id }, c); applyInterrogatorCommand(s, { type: 'CONSUME', bottleId: s.interrogator.bottles[0]!.id, confirmed: true }, c);
  s.week = 31; s.progression.acting = 100;
  s.progression.mastery = Object.fromEntries([...ARBITER_ABILITY_IDS, ...SHERIFF_ABILITY_IDS, ...INTERROGATOR_ABILITY_IDS].map((id, index) => [id, index * 7]));
  s.cash = 20000; s.actionsRemaining = 100; s.health = 100; s.mind = 100; s.spirituality = 31; s.character.coreStats.will = 25; s.character.coreStats.knowledge = 25;
  return s;
}
function acquisition(s: SliceState, command: JudgeAcquisitionCommand, roll = 1) { const ctx = context(s, roll); applyJudgeCommand(s, command, ctx.c); return ctx; }
function activity(s: SliceState, command: JudgeActivityCommand, roll = 1) { const ctx = context(s, roll); applyJudgeActivity(s, command, ctx.c, ctx.award); return ctx; }
function taught(s = interrogator()) { acquisition(s, { type: 'LEARN_GUIDANCE' }); return s; }
function buy(s: SliceState, index = 0) { const bottle = s.judge.bottles[index]!; acquisition(s, { type: 'BUY_POTION', bottleId: bottle.id }); return bottle; }
function prepared() { const s = taught(); buy(s); return s; }
function promoted() { const s = prepared(); acquisition(s, { type: 'CONSUME', bottleId: s.judge.bottles[0]!.id, confirmed: true }); return s; }
function rejectActivity(s: SliceState, command: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyJudgeActivity(s, command as JudgeActivityCommand, ctx.c, ctx.award)).toThrow(); expect(s).toEqual(before); expect(ctx.c.check).not.toHaveBeenCalled(); expect(ctx.award).not.toHaveBeenCalled(); }
function begin(s: SliceState, caseId: JudgeCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { activity(s, { type: 'OBSERVE', caseId }); activity(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: JudgeCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  begin(s, caseId, method); activity(s, { type: 'PERFORM', caseId }); activity(s, { type: 'CLOSE', caseId });
  activity(s, { type: 'REPORT', caseId });
}

describe('Judge real attempts, short effects and safe zero-AP endings', () => {
  it.each(JUDGE_CASE_IDS)('charges failed %s and permits actual ending at zero AP, spirituality and mind', id => {
    const s = promoted();
    for (const prior of JUDGE_CASE_IDS.slice(0, JUDGE_CASE_IDS.indexOf(id))) complete(s, prior, 'ORDINARY');
    begin(s, id); const ap = s.actionsRemaining, sp = s.spirituality, before = structuredClone(s.progression);
    const performed = activity(s, { type: 'PERFORM', caseId: id }, 100);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, sp - 3]);
    expect(s.judge.cases[id]).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(s.progression).toEqual(before); expect(performed.award).not.toHaveBeenCalled();
    if (id === 'calm-room') expect(s.judge.practice.audience).toBe('ADDRESSED');
    if (id === 'marked-line') expect(s.judge.practice).toMatchObject({ boundary: 'ATTEMPTED', lineTestedBy: 'BOTH' });
    if (id === 'shared-token') {
      expect(s.judge.practice).toMatchObject({ token: 'OUTSIDE_TABLE', tokenTestedBy: 'BOTH' });
      expect(judgeCases(s).find(p => p.id === id)!.result).toContain('台域外瑟恩手中');
    }
    expect(validateJudgeState(s)).toBe(true); expect(judgeInside(s)).toBe(true);
    rejectActivity(s, { type: 'REPORT', caseId: id }); rejectActivity(s, { type: 'REFLECT' }); rejectActivity(s, { type: 'ENCOUNTER_FIGHT' });
    const forgedWeek = structuredClone(s); forgedWeek.week += 1; expect(validateJudgeState(forgedWeek)).toBe(false);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; s.health = 1;
    expect(judgeActions(s).find(a => a.command.type === 'CLOSE')!.enabled).toBe(true);
    const closed = activity(s, { type: 'CLOSE', caseId: id });
    expect([s.actionsRemaining, s.spirituality, s.mind, s.health]).toEqual([0, 0, 0, 1]);
    expect(closed.c.check).not.toHaveBeenCalled(); expect(closed.award).not.toHaveBeenCalled(); expect(judgeInside(s)).toBe(false);
    if (id === 'calm-room') expect(s.judge.practice.audience).toBe('FREE');
    if (id === 'marked-line') expect(s.judge.practice.boundary).toBe('RELEASED');
    if (id === 'shared-token') { expect(s.judge.practice.token).toBe('RETURNED'); expect(closed.c.note).toHaveBeenCalledWith('实际结束本次有限实践', expect.stringContaining('亲手安全放回')); }
    expect(validateJudgeState(s)).toBe(true);
    s.actionsRemaining = 10; s.mind = 50;
    rejectActivity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' });
    s.week += 1; activity(s, { type: 'PREPARE', caseId: id, method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: id }); activity(s, { type: 'CLOSE', caseId: id }); activity(s, { type: 'REPORT', caseId: id });
    expect(s.judge.cases[id]!.closes).toBe(2); expect(validateJudgeState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('reaches paid peaceful 100 through three actual %s reports and reflection', method => {
    const s = promoted(), ap = s.actionsRemaining, sp = s.spirituality;
    for (const id of JUDGE_CASE_IDS) {
      begin(s, id, method); const before = s.spirituality;
      expect(judgeInside(s)).toBe(false); expect(validateJudgeState(s)).toBe(true);
      activity(s, { type: 'PERFORM', caseId: id });
      expect(s.spirituality).toBe(before - (method === 'ABILITY' ? 3 : 0));
      expect(s.judge.cases[id]).toMatchObject({ status: 'EXAMINED', contactOpen: true });
      if (id === 'marked-line') expect(s.judge.practice).toMatchObject({ boundary: 'HELD', lineTestedBy: 'BOTH' });
      if (id === 'shared-token') expect(s.judge.practice).toMatchObject({ token: 'HELD_ON_TABLE', tokenTestedBy: 'BOTH' });
      rejectActivity(s, { type: 'REPORT', caseId: id }); activity(s, { type: 'CLOSE', caseId: id }); activity(s, { type: 'REPORT', caseId: id });
      expect(validateJudgeState(s)).toBe(true);
    }
    activity(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.actionsRemaining, s.spirituality]).toEqual([100, ap - 13, sp - (method === 'ABILITY' ? 9 : 0)]);
    expect(s.judge.practice).toEqual({ audience: 'FREE', boundary: 'RELEASED', token: 'RETURNED', lineTestedBy: 'BOTH', tokenTestedBy: 'BOTH' });
    expect(s.progression.mastery[JUDGE_ABILITY_IDS[0]]).toBe(24); expect(s.progression.mastery[JUDGE_ABILITY_IDS[1]]).toBe(0);
    if (method === 'ORDINARY') expect(judgeCases(s).every(p => p.result!.includes('普通方法'))).toBe(true);
    rejectActivity(s, { type: 'REFLECT' }); rejectActivity(s, { type: 'REPORT', caseId: 'shared-token' }); expect(validateJudgeState(s)).toBe(true);
  });
  it.each(JUDGE_CASE_IDS)('keeps %s preparation stable across weeks and supports cancellation before any effect', id => {
    const s = promoted(); for (const prior of JUDGE_CASE_IDS.slice(0, JUDGE_CASE_IDS.indexOf(id))) complete(s, prior, 'ORDINARY');
    begin(s, id); const sp = s.spirituality, ap = s.actionsRemaining;
    expect(judgeInside(s)).toBe(false);
    if (id === 'calm-room') expect(s.judge.practice.audience).toBe('READY');
    if (id === 'marked-line') expect(s.judge.practice).toMatchObject({ boundary: 'CLEAR', lineTestedBy: 'NONE' });
    if (id === 'shared-token') expect(s.judge.practice).toMatchObject({ token: 'ON_TABLE', tokenTestedBy: 'NONE' });
    s.week += 1; expect(validateJudgeState(s)).toBe(true);
    const cancelled = activity(s, { type: 'WITHDRAW', caseId: id });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, sp]); expect(cancelled.c.check).not.toHaveBeenCalled(); expect(cancelled.award).not.toHaveBeenCalled();
    expect(s.judge.cases[id]).toMatchObject({ status: 'OBSERVED', method: null, attemptWeek: null, closes: 0, withdrawals: 1 }); expect(validateJudgeState(s)).toBe(true);
  });
  it.each(JUDGE_CASE_IDS)('withdraws open successful %s without pretending it never happened or retaining the report', id => {
    const s = promoted(); for (const prior of JUDGE_CASE_IDS.slice(0, JUDGE_CASE_IDS.indexOf(id))) complete(s, prior, 'ORDINARY');
    begin(s, id); activity(s, { type: 'PERFORM', caseId: id }); const ap = s.actionsRemaining, sp = s.spirituality, acting = s.progression.acting;
    activity(s, { type: 'WITHDRAW', caseId: id });
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([ap, sp, acting]);
    expect(s.judge.cases[id]).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: false, closes: 1, withdrawals: 1 });
    rejectActivity(s, { type: 'REPORT', caseId: id }); expect(validateJudgeState(s)).toBe(true);
  });
  it('blocks unpaid ability practice without mutation, then permits a real ordinary alternative', () => {
    const s = promoted(); begin(s, 'calm-room'); s.spirituality = 2;
    rejectActivity(s, { type: 'PERFORM', caseId: 'calm-room' }); activity(s, { type: 'WITHDRAW', caseId: 'calm-room' });
    activity(s, { type: 'PREPARE', caseId: 'calm-room', method: 'ORDINARY' }); activity(s, { type: 'PERFORM', caseId: 'calm-room' });
    expect(s.spirituality).toBe(2); activity(s, { type: 'CLOSE', caseId: 'calm-room' }); activity(s, { type: 'REPORT', caseId: 'calm-room' }); expect(validateJudgeState(s)).toBe(true);
  });
  it('requires preceding reports and rejects fabricated shared tests, future mastery, and escaped short effects', () => {
    const s = promoted(); rejectActivity(s, { type: 'OBSERVE', caseId: 'shared-token' }); rejectActivity(s, { type: 'OBSERVE', caseId: 'marked-line' });
    complete(s, 'calm-room'); begin(s, 'marked-line'); activity(s, { type: 'PERFORM', caseId: 'marked-line' });
    const oneSided = structuredClone(s); oneSided.judge.practice.lineTestedBy = 'NONE'; expect(validateJudgeState(oneSided)).toBe(false);
    const later = structuredClone(s); later.week += 1; expect(validateJudgeState(later)).toBe(false);
    const future = structuredClone(s); future.progression.mastery['justiciar.s5.punishment'] = 1; expect(validateJudgeState(future)).toBe(false);
  });
});
