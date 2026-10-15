import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyDreamStealerCommand, createDreamStealerState, validateDreamStealerState } from '../../src/domain/dream-stealer/index.js';
import { applyDreamStealerActivity, isDreamStealerActivity, dreamStealerActions, dreamStealerCases, dreamStealerInside, dreamStealerPractice, DREAM_STEALER_ENVIRONMENT, validateDreamStealerLife } from '../../src/domain/dream-stealer/life.js';
import { DREAM_STEALER_ABILITY_IDS, DREAM_STEALER_CASE_IDS, type DreamStealerActivityCommand, type DreamStealerCaseId, type DreamStealerCommand } from '../../src/domain/dream-stealer/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[DREAM_STEALER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function fireThief(): SliceState {
  const previous = JSON.parse(readFileSync('tests/fixtures/fire-thief-v0840/natural.json', 'utf8')).final;
  const s = migrateSliceState(previous); s.dreamStealer = createDreamStealerState();
  const week = Math.max(s.week, s.fireThief.promotionWeek! + 12);
  s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function promoted(): SliceState {
  const s = fireThief(), c = context(s).ctx;
  applyDreamStealerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyDreamStealerCommand(s, { type: 'BUY_POTION', bottleId: s.dreamStealer.bottles[0]!.id }, c);
  applyDreamStealerCommand(s, { type: 'CONSUME', bottleId: s.dreamStealer.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: DreamStealerActivityCommand, roll = 1) { const c = context(s, roll); applyDreamStealerActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyDreamStealerActivity(s, command as DreamStealerActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: DreamStealerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.dreamStealer.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: DreamStealerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.marauder, s.swindler, s.cryptologist, s.fireThief, s.world, s.town, s.combatHistory]);
const initialPractice = { playerPose: 'STANDING', targetPaused: false, targetRecovered: true, token: 'TARGET_DESK', thefts: 0, executions: 0, recoveries: 0, tokenMoves: 0 };

describe('DreamStealer current intention, immediate own-body action and real recovery', () => {
  it('starts with standing bodies and the one target-owned disc, without changing prior loans', () => {
    const old = fireThief();
    expect(dreamStealerActions(old)).toEqual([]); expect(dreamStealerCases(old)).toEqual([]);
    expect(dreamStealerPractice(old)).toBeNull(); expect(validateDreamStealerLife(old)).toBe(true);
    const s = promoted();
    expect(s.dreamStealer.practice).toEqual(initialPractice);
    expect(dreamStealerCases(s).map(p => p.id)).toEqual([...DREAM_STEALER_CASE_IDS]);
    expect(dreamStealerCases(s).every(p => p.observations.length === 0)).toBe(true);
    expect(dreamStealerInside(s)).toBe(false); expect(validateDreamStealerState(s)).toBe(true);
    expect(DREAM_STEALER_ENVIRONMENT).toContain('同一行动中立即'); expect(DREAM_STEALER_ENVIRONMENT).toContain('原创G');
    expect(dreamStealerCases(s)[0]!.story).toContain('瑟蕾·芬恩'); expect(dreamStealerCases(s)[1]!.story).toContain('诺汀·布莱尔');
  });

  it('accepts only exact activity shapes and rejects deferred execution, fake targets and extra fields before costs', () => {
    for (const type of ['REFLECT', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) expect(isDreamStealerActivity({ type })).toBe(true);
    expect(isDreamStealerActivity({ type: 'LEARN_GUIDANCE' })).toBe(false);
    expect(isDreamStealerActivity(null as unknown as DreamStealerCommand)).toBe(false);
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'announced-seat', method: 'STORE' }, { type: 'OBSERVE', caseId: 'intended-reach', target: 'clone' }, { type: 'PERFORM', caseId: 'announced-seat', defer: true }, { type: 'CLOSE', caseId: 'intended-reach', teleport: true }, { type: 'REPORT', caseId: 'empty-performance', ability: true }, { type: 'WITHDRAW', caseId: 'announced-seat', refund: true }, { type: 'REFLECT', extra: true }, { type: 'EXECUTE_STORED' }, { type: 'STEAL_DREAM' }]) reject(promoted(), command);
  });

  it('observation and consent preparation never pause the target, move a body or create a stored thought', () => {
    const s = promoted(), old = originals(s), spirit = s.spirituality;
    for (const caseId of DREAM_STEALER_CASE_IDS) act(s, { type: 'OBSERVE', caseId });
    begin(s, 'announced-seat', 'ABILITY');
    expect(s.dreamStealer.practice).toEqual(initialPractice); expect(dreamStealerInside(s)).toBe(false);
    expect(s.spirituality).toBe(spirit); expect(originals(s)).toEqual(old); expect(validateDreamStealerLife(s)).toBe(true);
    reject(s, { type: 'PREPARE', caseId: 'intended-reach', method: 'ABILITY' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const c = act(s, { type: 'WITHDRAW', caseId: 'announced-seat' });
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
    expect(s.dreamStealer.practice).toEqual(initialPractice);
    expect(s.dreamStealer.cases['announced-seat']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(validateDreamStealerLife(s)).toBe(true);
  });

  it('successful seat theft immediately seats the player in their own chair within the same paid action', () => {
    const s = promoted(); begin(s, 'announced-seat', 'ABILITY');
    const old = originals(s), ap = s.actionsRemaining, spirit = s.spirituality, mastery = structuredClone(s.progression.mastery);
    const c = act(s, { type: 'PERFORM', caseId: 'announced-seat' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, playerPose: 'SEATED', targetPaused: true, targetRecovered: false, thefts: 1, executions: 1 });
    expect(s.dreamStealer.cases['announced-seat']).toMatchObject({ status: 'EXAMINED', outcome: 'SEAT_CHECKED', contactOpen: true });
    expect(messages(c)).toContain('自己的原椅'); expect(messages(c)).toContain('同一个已付行动内立即');
    expect(s.progression.mastery).toEqual(mastery); expect(c.award).not.toHaveBeenCalled(); expect(originals(s)).toEqual(old);
    expect(dreamStealerInside(s)).toBe(true); expect(validateDreamStealerLife(s)).toBe(true);
    for (const command of [{ type: 'PERFORM', caseId: 'announced-seat' }, { type: 'WITHDRAW', caseId: 'announced-seat' }, { type: 'REPORT', caseId: 'announced-seat' }, { type: 'OBSERVE', caseId: 'intended-reach' }, { type: 'ENCOUNTER_FIGHT' }]) reject(s, command);
  });

  it('zero-resource seat closure actually passes the G interval, restores the decision and ordinarily rises once', () => {
    const s = promoted(); begin(s, 'announced-seat', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'announced-seat' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const old = originals(s), c = act(s, { type: 'CLOSE', caseId: 'announced-seat' });
    expect(messages(c)).toContain('实际经过原创G十秒'); expect(messages(c)).toContain('各自普通从自己的原椅起身'); expect(messages(c)).toContain('自由拒绝');
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, thefts: 1, executions: 1, recoveries: 1 });
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled(); expect(originals(s)).toEqual(old);
    expect(dreamStealerInside(s)).toBe(false); expect(validateDreamStealerLife(s)).toBe(true); reject(s, { type: 'CLOSE', caseId: 'announced-seat' });
  });

  it('failed seat theft leaves the player standing and the target really seated without cancelling cost', () => {
    const s = promoted(); begin(s, 'announced-seat', 'ABILITY'); const ap = s.actionsRemaining, spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'announced-seat' }, 100);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]); expect(s.dreamStealer.practice).toEqual(initialPractice);
    expect(messages(c)).toContain('瑟蕾已按原念头普通坐下'); expect(messages(c)).toContain('你仍站立');
    expect(s.dreamStealer.cases['announced-seat']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true, attemptWeek: s.week });
    expect(dreamStealerInside(s)).toBe(true); expect(validateDreamStealerLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'announced-seat' }); expect(s.dreamStealer.practice.recoveries).toBe(0);
    reject(s, { type: 'PREPARE', caseId: 'announced-seat', method: 'ORDINARY' });
    nextWeek(s); complete(s, 'announced-seat'); expect(s.dreamStealer.cases['announced-seat']!.closes).toBe(2); expect(validateDreamStealerLife(s)).toBe(true);
  });

  it('successful reach theft immediately reaches the player own empty desk and leaves the original disc untouched', () => {
    const s = promoted(); begin(s, 'intended-reach', 'ABILITY'); const old = originals(s), spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'intended-reach' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 3);
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, playerPose: 'REACHING', targetPaused: true, targetRecovered: false, thefts: 1, executions: 1 });
    expect(messages(c)).toContain('自己的空桌'); expect(messages(c)).toContain('没取得原木片'); expect(messages(c)).toContain('没取得勇气能力');
    expect(originals(s)).toEqual(old); expect(validateDreamStealerLife(s)).toBe(true);
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const close = act(s, { type: 'CLOSE', caseId: 'intended-reach' });
    expect(messages(close)).toContain('自由完成这次伸手'); expect(messages(close)).toContain('亲手把同一枚DS5-TOKEN-1放回');
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, thefts: 1, executions: 1, recoveries: 1, tokenMoves: 2 });
    expect(dreamStealerInside(s)).toBe(false); expect(validateDreamStealerLife(s)).toBe(true); expect(originals(s)).toEqual(old);
  });

  it('failed reach theft keeps the actual original disc in its owner hand until he physically replaces it', () => {
    const s = promoted(); begin(s, 'intended-reach', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'intended-reach' }, 100);
    expect(s.spirituality).toBe(spirit - 3); expect(s.dreamStealer.practice).toEqual({ ...initialPractice, token: 'TARGET_HAND', tokenMoves: 1 });
    expect(dreamStealerInside(s)).toBe(true); expect(validateDreamStealerLife(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'intended-reach' });
    const c = act(s, { type: 'CLOSE', caseId: 'intended-reach' });
    expect(messages(c)).toContain('亲手把同一枚DS5-TOKEN-1放回'); expect(s.dreamStealer.practice).toEqual({ ...initialPractice, tokenMoves: 2 });
    expect(validateDreamStealerLife(s)).toBe(true); reject(s, { type: 'PREPARE', caseId: 'intended-reach', method: 'ABILITY' });
    nextWeek(s); complete(s, 'intended-reach', 'ABILITY');
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, thefts: 1, executions: 1, recoveries: 1, tokenMoves: 4 }); expect(validateDreamStealerLife(s)).toBe(true);
  });

  it.each(['announced-seat', 'intended-reach'] as const)('ordinary %s uses real voluntary motions and zero spirit even on check failure', caseId => {
    const s = promoted(); s.spirituality = 0; begin(s, caseId); const old = originals(s), ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, 0]);
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, playerPose: caseId === 'announced-seat' ? 'SEATED' : 'REACHING', token: caseId === 'intended-reach' ? 'TARGET_HAND' : 'TARGET_DESK', tokenMoves: caseId === 'intended-reach' ? 1 : 0 });
    expect(s.dreamStealer.cases[caseId]!.status).toBe('OBSERVED'); expect(c.award).not.toHaveBeenCalled(); expect(validateDreamStealerLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId }); expect(s.dreamStealer.practice).toEqual({ ...initialPractice, tokenMoves: caseId === 'intended-reach' ? 2 : 0 });
    expect(originals(s)).toEqual(old); expect(validateDreamStealerLife(s)).toBe(true);
  });

  it('no-mind case offers no ability command, pool or spirituality cost and reports only the real mechanism', () => {
    const s = promoted(); s.spirituality = 0; act(s, { type: 'OBSERVE', caseId: 'empty-performance' });
    expect(dreamStealerActions(s).some(a => a.command.type === 'PREPARE' && a.command.caseId === 'empty-performance' && a.command.method === 'ABILITY')).toBe(false);
    reject(s, { type: 'PREPARE', caseId: 'empty-performance', method: 'ABILITY' });
    begin(s, 'empty-performance'); const c = act(s, { type: 'PERFORM', caseId: 'empty-performance' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(0); expect(s.dreamStealer.practice).toEqual(initialPractice);
    expect(messages(c)).toContain('机械连接'); expect(messages(c)).toContain('没有自己的心智');
    expect(s.dreamStealer.cases['empty-performance']).toMatchObject({ status: 'EXAMINED', outcome: 'NO_MIND_CHECKED', contactOpen: true });
    expect(dreamStealerInside(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'empty-performance' }); act(s, { type: 'CLOSE', caseId: 'empty-performance' });
    const report = act(s, { type: 'REPORT', caseId: 'empty-performance' }); expect(report.award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(25); expect(validateDreamStealerLife(s)).toBe(true);
  });

  it('all ordinary reports and reflection reach acting100 without any theft or ability mastery reward', () => {
    const s = promoted(), mastery = structuredClone(s.progression.mastery), old = originals(s); s.spirituality = 0;
    for (const caseId of DREAM_STEALER_CASE_IDS) expect(complete(s, caseId).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(75); const reflection = act(s, { type: 'REFLECT' });
    expect(reflection.award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(mastery);
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, tokenMoves: 2 });
    expect(s.seer.completedSources.filter(x => x.startsWith('dream-stealer-'))).toEqual([...DREAM_STEALER_CASE_IDS.map(id => `dream-stealer-case:${id}`), 'dream-stealer-reflection']);
    expect(originals(s)).toEqual(old); expect(validateDreamStealerState(s)).toBe(true);
    for (const caseId of DREAM_STEALER_CASE_IDS) { reject(s, { type: 'PERFORM', caseId }); reject(s, { type: 'REPORT', caseId }); }
    reject(s, { type: 'REFLECT' });
  });

  it('each actual ability report awards the existing known pool once and cannot reward a fake mechanical theft', () => {
    const s = promoted(), old = originals(s);
    for (const caseId of ['announced-seat', 'intended-reach'] as const) {
      const c = complete(s, caseId, 'ABILITY'); expect(c.award).toHaveBeenCalledExactlyOnceWith(`dream-stealer-case:${caseId}`, 8); reject(s, { type: 'REPORT', caseId });
    }
    expect(complete(s, 'empty-performance').award).not.toHaveBeenCalled(); act(s, { type: 'REFLECT' });
    expect(s.progression.mastery[DREAM_STEALER_ABILITY_IDS[0]]).toBe(16); expect(s.progression.acting).toBe(100);
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, thefts: 2, executions: 2, recoveries: 2, tokenMoves: 2 });
    expect(originals(s)).toEqual(old); expect(validateDreamStealerState(s)).toBe(true);
  });

  it('failed ordinary attempt may later prepare and withdraw ability without retroactively adding thefts', () => {
    const s = promoted(); begin(s, 'intended-reach'); act(s, { type: 'PERFORM', caseId: 'intended-reach' }, 100); act(s, { type: 'CLOSE', caseId: 'intended-reach' }); nextWeek(s);
    begin(s, 'intended-reach', 'ABILITY'); expect(validateDreamStealerLife(s)).toBe(true); act(s, { type: 'WITHDRAW', caseId: 'intended-reach' });
    expect(s.dreamStealer.practice).toEqual({ ...initialPractice, tokenMoves: 2 }); expect(validateDreamStealerLife(s)).toBe(true);
    complete(s, 'intended-reach', 'ABILITY'); expect(s.dreamStealer.practice).toEqual({ ...initialPractice, thefts: 1, executions: 1, recoveries: 1, tokenMoves: 4 }); expect(validateDreamStealerLife(s)).toBe(true);
  });

  it('public last-AP preparation immediately pulses without creating a paused target', () => {
    const s = promoted(); act(s, { type: 'OBSERVE', caseId: 'announced-seat' }); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, next = applySliceIntent(s, { type: 'DREAM_STEALER', command: { type: 'PREPARE', caseId: 'announced-seat', method: 'ABILITY' } });
    expect(next.week).toBe(week + 1); expect(next.dreamStealer.cases['announced-seat']!.status).toBe('PREPARED');
    expect(next.dreamStealer.practice).toEqual(initialPractice); expect(dreamStealerInside(next)).toBe(false);
  });

  it.each(['announced-seat', 'intended-reach', 'empty-performance'] as const)('public last-AP %s contact holds the same week until actual zero-AP closure', caseId => {
    const s = promoted(); begin(s, caseId); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, performed = applySliceIntent(s, { type: 'DREAM_STEALER', command: { type: 'PERFORM', caseId } });
    expect([performed.week, performed.actionsRemaining]).toEqual([week, 0]); expect(dreamStealerInside(performed)).toBe(true);
    expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'REST' })).toThrow();
    const closed = applySliceIntent(performed, { type: 'DREAM_STEALER', command: { type: 'CLOSE', caseId } });
    expect(closed.week).toBe(week + 1); expect(dreamStealerInside(closed)).toBe(false);
    expect(closed.dreamStealer.practice).toEqual({ ...initialPractice, tokenMoves: caseId === 'intended-reach' ? 2 : 0 });
  });

  it('projects detached current-body, target, original-token and historical strings without stored choices', () => {
    const s = promoted(); begin(s, 'intended-reach', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'intended-reach' });
    const cases = dreamStealerCases(s), practice = dreamStealerPractice(s)!;
    expect(practice.pose).toContain('自己的空桌'); expect(practice.target).toContain('暂忘'); expect(practice.token).toContain('诺汀原桌'); expect(practice.history.join(' ')).toContain('立即自身执行1次');
    expect(new Set(cases.map(c => c.story)).size).toBe(3); expect(cases.find(c => c.id === 'intended-reach')!.result).toContain('没取得原木片');
    practice.history.push('invented'); cases[0]!.observations.push('invented'); practice.token = 'copied';
    expect(dreamStealerPractice(s)!.history).not.toContain('invented'); expect(dreamStealerCases(s)[0]!.observations).not.toContain('invented'); expect(s.dreamStealer.practice.token).toBe('TARGET_DESK');
    const actions = dreamStealerActions(s); expect(actions.find(a => a.command.type === 'CLOSE')!.enabled).toBe(true); expect(actions.find(a => a.command.type === 'REPORT')!.enabled).toBe(false);
    act(s, { type: 'CLOSE', caseId: 'intended-reach' }); expect(dreamStealerCases(s)[1]!.result).toContain('本次实施记录'); expect(dreamStealerPractice(s)!.target).toContain('可自由决定');
  });

  it('rejects forged own-body deferral, mental permanence, copied items, unrecovered targets and duplicate rewards', () => {
    const initial = promoted(); expect(validateDreamStealerLife(initial)).toBe(true);
    const changes: ((s: SliceState) => void)[] = [
      s => { Object.assign(s.dreamStealer.practice, { storedThought: true }); }, s => { s.dreamStealer.practice.playerPose = 'SEATED'; },
      s => { s.dreamStealer.practice.targetPaused = true; }, s => { s.dreamStealer.practice.targetRecovered = false; },
      s => { s.dreamStealer.practice.token = 'TARGET_HAND'; }, s => { s.dreamStealer.practice.tokenMoves = 2; },
      s => { s.dreamStealer.practice.thefts = 1; }, s => { s.dreamStealer.practice.executions = 1; }, s => { s.dreamStealer.practice.recoveries = 1; },
      s => { Object.assign(s.dreamStealer, { practice: null }); }, s => { Object.assign(s.dreamStealer.cases, { 'announced-seat': null }); },
    ];
    for (const change of changes) { const s = structuredClone(initial); change(s); expect(validateDreamStealerLife(s)).toBe(false); }
    const active = promoted(); begin(active, 'intended-reach', 'ABILITY'); act(active, { type: 'PERFORM', caseId: 'intended-reach' });
    for (const change of [((s: SliceState) => { s.dreamStealer.practice.executions = 0; }), (s: SliceState) => { s.dreamStealer.practice.playerPose = 'STANDING'; }, (s: SliceState) => { s.dreamStealer.practice.recoveries = 1; }, (s: SliceState) => { s.dreamStealer.practice.token = 'TARGET_HAND'; }, (s: SliceState) => { s.dreamStealer.practice.tokenMoves = 1; }, (s: SliceState) => { s.dreamStealer.cases['intended-reach']!.contactOpen = false; }]) {
      const s = structuredClone(active); change(s); expect(validateDreamStealerLife(s)).toBe(false);
    }
    const finished = promoted(); complete(finished, 'announced-seat', 'ABILITY'); complete(finished, 'intended-reach', 'ABILITY'); complete(finished, 'empty-performance');
    for (const change of [((s: SliceState) => { s.dreamStealer.practice.recoveries = 1; }), (s: SliceState) => { s.dreamStealer.practice.tokenMoves = 0; }, (s: SliceState) => { s.dreamStealer.cases['empty-performance']!.method = 'ABILITY'; }, (s: SliceState) => { s.dreamStealer.cases['intended-reach']!.outcome = 'SEAT_CHECKED'; }, (s: SliceState) => { s.dreamStealer.cases['announced-seat']!.closes = 0; }, (s: SliceState) => { s.seer.completedSources.push('dream-stealer-case:announced-seat'); }, (s: SliceState) => { s.progression.acting = 100; }]) {
      const s = structuredClone(finished); change(s); expect(validateDreamStealerLife(s)).toBe(false);
    }
  });

  it('blocks low resources, interruptions, remote closure and premature encounters without mutation', () => {
    for (const change of [((s: SliceState) => { s.world.city = 'TINGEN'; }), (s: SliceState) => { s.actionsRemaining = 0; }, (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.activeEvent = { id: 'pending', instanceId: 'pending' }; }]) {
      const s = promoted(); change(s); reject(s, { type: 'OBSERVE', caseId: 'announced-seat' });
    }
    reject(fireThief(), { type: 'OBSERVE', caseId: 'announced-seat' });
    const s = promoted(); begin(s, 'announced-seat', 'ABILITY'); s.spirituality = 2; reject(s, { type: 'PERFORM', caseId: 'announced-seat' });
    act(s, { type: 'WITHDRAW', caseId: 'announced-seat' }); reject(s, { type: 'ENCOUNTER_FIGHT' }); reject(s, { type: 'ENCOUNTER_TALK' }); reject(s, { type: 'REFLECT' });
    complete(s, 'announced-seat'); expect(dreamStealerActions(s).find(a => a.command.type === 'ENCOUNTER_TALK')!.enabled).toBe(true);
    begin(s, 'intended-reach'); act(s, { type: 'PERFORM', caseId: 'intended-reach' }); s.world.city = 'TINGEN'; reject(s, { type: 'CLOSE', caseId: 'intended-reach' });
  });
});
