import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { computeCheckChance, resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyWinnerCommand, createWinnerState, freshWinnerPractice, projectWinner, validateWinnerState } from '../../src/domain/winner/index.js';
import { applyWinnerActivity, isWinnerActivity, validateWinnerLife, winnerActions, winnerCases, winnerInside, winnerPractice, WINNER_ENVIRONMENT } from '../../src/domain/winner/life.js';
import { WINNER_ABILITY_IDS, WINNER_CASE_IDS, type WinnerActivityCommand, type WinnerCaseId, type WinnerCommand } from '../../src/domain/winner/types.js';

const originalFinal = JSON.parse(readFileSync('tests/fixtures/calamity-priest-v0910/natural.json', 'utf8')).final;
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[WINNER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function calamityPriest(): SliceState {
  const s = migrateSliceState(structuredClone(originalFinal)); s.winner = createWinnerState();
  setWeek(s, Math.max(s.week, s.calamityPriest.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promoted() {
  const s = calamityPriest(), c = context(s).ctx;
  applyWinnerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyWinnerCommand(s, { type: 'BUY_POTION', bottleId: s.winner.bottles[0]!.id }, c);
  applyWinnerCommand(s, { type: 'CONSUME', bottleId: s.winner.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 100; }
function act(s: SliceState, command: WinnerActivityCommand, roll = 1) {
  const c = context(s, roll); applyWinnerActivity(s, command, c.ctx, c.award); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWinnerActivity(s, command as WinnerActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: WinnerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.winner.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: WinnerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  act(s, { type: 'CLOSE', caseId }); return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.monster, s.machine, s.lucky, s.calamityPriest, s.world, s.town, s.combatHistory]);

describe('Winner finite actual-week accumulation and exact payment', () => {
  it('starts empty after promotion, preserves original objects and offers an ordinary alternative', () => {
    const old = calamityPriest();
    expect(winnerActions(old)).toEqual([]); expect(winnerCases(old)).toEqual([]); expect(validateWinnerLife(old)).toBe(true);
    reject(old, { type: 'ACCUMULATE' });
    const s = promoted();
    expect(s.winner.luck).toEqual({ stored: 0, accumulated: 0, spent: 0, lastAccumulateWeek: null });
    expect(winnerPractice(s)).toEqual(freshWinnerPractice()); expect(winnerInside(s)).toBe(false);
    expect(winnerCases(s).map(p => p.id)).toEqual([...WINNER_CASE_IDS]); expect(validateWinnerState(s)).toBe(true);
    const copy = winnerPractice(s); copy.counter = 'TRAY'; expect(s.winner.practice.counter).toBe('GUIDE');
    act(s, { type: 'OBSERVE', caseId: 'falling-counter' });
    reject(s, { type: 'PREPARE', caseId: 'falling-counter', method: 'ABILITY' });
    expect(winnerActions(s).find(a => a.id === 'falling-counter-ability')).toMatchObject({ enabled: false });
    expect(winnerActions(s).find(a => a.id === 'falling-counter-ordinary')).toMatchObject({ enabled: true });
    expect(projectWinner(s).luck).toMatchObject({ stored: 0, capacity: 3 });
    expect(WINNER_ENVIRONMENT).toContain('原创G'); expect(WINNER_ENVIRONMENT).toContain('原难度14');
  });

  it('really pays one action once per actual week, caps at three and never heals or refills automatically', () => {
    const s = promoted(), old = originals(s); s.health = 72; s.mind = 64; s.spirituality = 7;
    const ap = s.actionsRemaining, first = act(s, { type: 'ACCUMULATE' });
    expect([s.actionsRemaining, s.health, s.mind, s.spirituality]).toEqual([ap - 1, 72, 64, 7]);
    expect(first.ctx.check).not.toHaveBeenCalled(); expect(first.award).not.toHaveBeenCalled();
    expect(s.winner.luck).toEqual({ stored: 1, accumulated: 1, spent: 0, lastAccumulateWeek: s.week });
    reject(s, { type: 'ACCUMULATE' });
    nextWeek(s); expect(s.winner.luck.stored).toBe(1); act(s, { type: 'ACCUMULATE' });
    nextWeek(s); act(s, { type: 'ACCUMULATE' }); nextWeek(s); reject(s, { type: 'ACCUMULATE' });
    expect(s.winner.luck).toEqual({ stored: 3, accumulated: 3, spent: 0, lastAccumulateWeek: s.week - 1 });
    complete(s, 'falling-counter', 'ABILITY');
    expect(s.winner.luck.stored).toBe(2); act(s, { type: 'ACCUMULATE' });
    expect(s.winner.luck).toEqual({ stored: 3, accumulated: 4, spent: 1, lastAccumulateWeek: s.week });
    expect(originals(s)).toEqual(old); expect(validateWinnerState(s)).toBe(true);
    const empty = promoted(), before = structuredClone(empty.winner.luck);
    empty.actionsRemaining = 10; const rested = applySliceIntent(empty, { type: 'ACTION', action: 'REST' });
    expect(rested.winner.luck).toEqual(before);
  });

  it('blocks invented accumulation, wrong place, exhausted AP and existing contacts before mutations', () => {
    expect(isWinnerActivity({ type: 'ACCUMULATE' })).toBe(true);
    expect(isWinnerActivity({ type: 'LEARN_GUIDANCE' })).toBe(false);
    expect(isWinnerActivity(null as unknown as WinnerCommand)).toBe(false);
    for (const command of [null, {}, { type: 'ACCUMULATE', amount: 3 }, { type: 'ACCUMULATE', target: 'SELLA' }, { type: 'PERFORM', caseId: 'falling-counter', reroll: true }, { type: 'PREPARE', caseId: 'honest-account', method: 'ABILITY' }, { type: 'CLOSE', caseId: 'willing-aim', cleanseAll: true }, { type: 'REWRITE_PAST' }]) reject(promoted(), command);
    const s = promoted(); s.world.city = 'ELSEWHERE'; reject(s, { type: 'ACCUMULATE' });
    s.world.city = 'BACKLUND'; s.actionsRemaining = 0; reject(s, { type: 'ACCUMULATE' });
    s.actionsRemaining = 10; begin(s, 'falling-counter'); reject(s, { type: 'ACCUMULATE' });
    act(s, { type: 'PERFORM', caseId: 'falling-counter' }); reject(s, { type: 'ACCUMULATE' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
  });

  it('uses the same normal check once at knowledge9, providing G help without rewriting the rolled value', () => {
    const s = promoted(); s.character.coreStats.knowledge = 20;
    act(s, { type: 'ACCUMULATE' }); begin(s, 'falling-counter', 'ABILITY');
    const baseline = computeCheckChance({ baseAbility: 20, difficulty: 14, modifiers: [] });
    s.actionsRemaining = 1; s.spirituality = 2; const c = act(s, { type: 'PERFORM', caseId: 'falling-counter' }, 67);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 9);
    expect(vi.mocked(c.ctx.check).mock.results[0]!.value).toMatchObject({ roll: 67, chance: baseline + 10, tier: 'SUCCESS' });
    expect(c.ctx.roll).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.winner.luck.stored, s.winner.luck.spent]).toEqual([0, 0, 0, 1]);
    expect(s.winner.practice.counter).toBe('CAUGHT'); expect(winnerInside(s)).toBe(true);
    expect(winnerActions(s).find(a => a.id === 'falling-counter-close')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    s.mind = 0; const close = act(s, { type: 'CLOSE', caseId: 'falling-counter' });
    expect(messages(close)).toContain('亲手交回原艾妲'); expect(s.winner.practice.counter).toBe('GUIDE');
    expect([s.actionsRemaining, s.spirituality, s.mind, s.winner.luck.stored]).toEqual([0, 0, 0, 0]);
    expect(close.ctx.check).not.toHaveBeenCalled(); expect(close.award).not.toHaveBeenCalled(); expect(validateWinnerState(s)).toBe(true);
    s.mind = 100; s.actionsRemaining = 1;
    expect(act(s, { type: 'REPORT', caseId: 'falling-counter' }).award).toHaveBeenCalledExactlyOnceWith('winner-case:falling-counter', 8);
    reject(s, { type: 'REPORT', caseId: 'falling-counter' });
  });

  it('retains failed paid luck and the same original counter on its tray until actual zero-cost handback', () => {
    const s = promoted(); act(s, { type: 'ACCUMULATE' }); begin(s, 'falling-counter', 'ABILITY');
    s.actionsRemaining = 1; s.spirituality = 2; const old = originals(s), c = act(s, { type: 'PERFORM', caseId: 'falling-counter' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 9);
    expect(s.winner.cases['falling-counter']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(s.winner.practice.counter).toBe('TRAY'); expect(s.winner.luck).toMatchObject({ stored: 0, spent: 1, accumulated: 1 });
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    reject(s, { type: 'REPORT', caseId: 'falling-counter' }); reject(s, { type: 'WITHDRAW', caseId: 'falling-counter' });
    const close = act(s, { type: 'CLOSE', caseId: 'falling-counter' }); expect(messages(close)).toContain('从同一原软接物盘实际取出');
    s.actionsRemaining = 10; reject(s, { type: 'ACCUMULATE' }); reject(s, { type: 'PREPARE', caseId: 'falling-counter', method: 'ORDINARY' });
    nextWeek(s); const report = complete(s, 'falling-counter'); expect(report.award).not.toHaveBeenCalled();
    expect(s.winner.cases['falling-counter']!.closes).toBe(2); expect(s.winner.luck.stored).toBe(0);
    expect(originals(s)).toEqual(old); expect(validateWinnerState(s)).toBe(true);
  });

  it('rechecks actual reserve and spirit at PERFORM and permits cancellation without refund', () => {
    const s = promoted(); act(s, { type: 'ACCUMULATE' }); begin(s, 'falling-counter', 'ABILITY');
    s.spirituality = 1; reject(s, { type: 'PERFORM', caseId: 'falling-counter' });
    s.spirituality = 2; s.winner.luck.stored = 0; s.winner.luck.spent = 1; reject(s, { type: 'PERFORM', caseId: 'falling-counter' });
    s.actionsRemaining = 0; s.mind = 0; const c = act(s, { type: 'WITHDRAW', caseId: 'falling-counter' });
    expect(s.winner.cases['falling-counter']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, contactOpen: false });
    expect(s.winner.practice).toEqual(freshWinnerPractice()); expect(s.winner.luck.stored).toBe(0);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 2, 0]); expect(c.ctx.check).not.toHaveBeenCalled();
  });
});

describe('Winner original volunteer, note and honest reports', () => {
  it.each([1, 100])('pays for one limited ill-fortune attempt at roll %i and makes Sella retrieve her same ring', roll => {
    const s = promoted(); complete(s, 'falling-counter'); act(s, { type: 'ACCUMULATE' }); begin(s, 'willing-aim', 'ABILITY');
    s.actionsRemaining = 1; s.spirituality = 2; const old = originals(s), c = act(s, { type: 'PERFORM', caseId: 'willing-aim' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality, s.winner.luck.stored, s.winner.luck.spent]).toEqual([0, 0, 0, 1]);
    expect(s.winner.practice.ring).toBe('MAT'); expect(s.winner.cases['willing-aim']).toMatchObject({ contactOpen: true, status: roll === 1 ? 'EXAMINED' : 'OBSERVED', outcome: roll === 1 ? 'AIM_CHECKED' : 'NONE' });
    expect(c.award).not.toHaveBeenCalled(); expect(validateWinnerState(s)).toBe(true);
    reject(s, { type: 'ACCUMULATE' }); reject(s, { type: 'REPORT', caseId: 'willing-aim' });
    const close = act(s, { type: 'CLOSE', caseId: 'willing-aim' });
    expect(messages(close)).toContain('塞拉本人走到原软垫，亲手取回自己的同一枚WN5-RING-1');
    expect(messages(close)).toContain('不宣称清除'); expect(s.winner.practice.ring).toBe('OWNER');
    expect(winnerInside(s)).toBe(false); expect(originals(s)).toEqual(old); expect(validateWinnerState(s)).toBe(true);
    s.actionsRemaining = 10;
    if (roll === 1) expect(act(s, { type: 'REPORT', caseId: 'willing-aim' }).award).toHaveBeenCalledExactlyOnceWith('winner-case:willing-aim', 8);
    else { reject(s, { type: 'REPORT', caseId: 'willing-aim' }); reject(s, { type: 'PREPARE', caseId: 'willing-aim', method: 'ORDINARY' }); nextWeek(s); expect(complete(s, 'willing-aim').award).not.toHaveBeenCalled(); }
  });

  it('ordinary observation records the same actual ring without making Sella automatically fail', () => {
    const s = promoted(); complete(s, 'falling-counter'); begin(s, 'willing-aim'); s.spirituality = 0;
    const c = act(s, { type: 'PERFORM', caseId: 'willing-aim' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.winner.practice.ring).toBe('MAT');
    expect(messages(c)).toContain('普通观察不令她自动失手'); expect(winnerCases(s)[1]!.result).toContain('普通观察没有使她自动失手');
    act(s, { type: 'CLOSE', caseId: 'willing-aim' }); expect(act(s, { type: 'REPORT', caseId: 'willing-aim' }).award).not.toHaveBeenCalled();
    expect(s.spirituality).toBe(0); expect(s.winner.luck.spent).toBe(0); expect(validateWinnerState(s)).toBe(true);
  });

  it('writes on and actually hands over the same original note even after a failure', () => {
    const s = promoted(); complete(s, 'falling-counter'); complete(s, 'willing-aim'); begin(s, 'honest-account');
    const old = originals(s), c = act(s, { type: 'PERFORM', caseId: 'honest-account' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.winner.practice.note).toBe('WRITTEN');
    s.actionsRemaining = 0; s.spirituality = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'honest-account' });
    expect(messages(close)).toContain('同一张WN5-NOTE-1实际交给原艾妲'); expect(messages(close)).toContain('失败文字也保留');
    expect(s.winner.practice.note).toBe('HANDED_OVER'); expect(validateWinnerState(s)).toBe(true);
    nextWeek(s); begin(s, 'honest-account'); const retry = act(s, { type: 'PERFORM', caseId: 'honest-account' });
    expect(messages(retry)).toContain('艾妲亲手递来同一张WN5-NOTE-1'); expect(messages(retry)).toContain('之前的失败文字保留');
    act(s, { type: 'CLOSE', caseId: 'honest-account' }); expect(act(s, { type: 'REPORT', caseId: 'honest-account' }).award).not.toHaveBeenCalled();
    expect(s.winner.cases['honest-account']!.closes).toBe(2); expect(originals(s)).toEqual(old); expect(validateWinnerState(s)).toBe(true);
  });

  it('supports full ordinary G100 with exactly thirteen paid actions and no fake luck or ability mastery', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery), ap = s.actionsRemaining;
    s.spirituality = 0;
    for (const caseId of WINNER_CASE_IDS) { expect(complete(s, caseId).award).not.toHaveBeenCalled(); expect(validateWinnerState(s)).toBe(true); }
    const c = act(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.actionsRemaining, s.spirituality]).toEqual([100, ap - 13, 0]);
    expect(s.progression.mastery).toEqual(mastery); expect(s.winner.luck).toEqual({ stored: 0, accumulated: 0, spent: 0, lastAccumulateWeek: null });
    expect(s.winner.practice).toEqual({ ...freshWinnerPractice(), note: 'HANDED_OVER' });
    expect(c.award).not.toHaveBeenCalled(); expect(messages(c)).toContain('不自动补满幸运'); expect(originals(s)).toEqual(old);
    expect(s.seer.completedSources.filter(source => source.startsWith('winner-case:'))).toHaveLength(3);
    expect(validateWinnerState(s)).toBe(true); reject(s, { type: 'REFLECT' });
  });
});

describe('Winner original-object and finite-resource save validation', () => {
  it('rejects forged reserve, accumulation chronology, completed reports and missing actual objects', () => {
    const s = promoted(); act(s, { type: 'ACCUMULATE' }); begin(s, 'falling-counter', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'falling-counter' });
    const corruptions: ((copy: SliceState) => void)[] = [
      copy => { copy.winner.luck.stored = 1; },
      copy => { copy.winner.luck.spent = 0; copy.winner.luck.stored = 1; },
      copy => { copy.winner.luck.lastAccumulateWeek = null; },
      copy => { copy.winner.luck.lastAccumulateWeek = copy.week + 1; },
      copy => { copy.winner.luck.accumulated = 2; copy.winner.luck.stored = 1; },
      copy => { copy.winner.luck.accumulated = 5; copy.winner.luck.stored = 4; },
      copy => { copy.winner.practice.counter = 'GUIDE'; },
      copy => { copy.winner.practice.counter = 'TRAY'; },
      copy => { copy.winner.practice.ring = 'MAT'; },
      copy => { copy.winner.practice.note = 'HANDED_OVER'; },
      copy => { copy.winner.cases['falling-counter']!.contactOpen = false; },
      copy => { copy.winner.cases['falling-counter']!.attemptWeek = null; },
      copy => { copy.winner.cases['falling-counter']!.outcome = 'AIM_CHECKED'; },
      copy => { copy.progression.acting += 25; },
      copy => { copy.seer.completedSources.push('winner-case:falling-counter'); },
      copy => { (copy.winner.practice as unknown as Record<string, unknown>).owner = 'PLAYER'; },
    ];
    for (const corrupt of corruptions) { const copy = structuredClone(s); corrupt(copy); expect(validateWinnerLife(copy)).toBe(false); }
    const wrong = structuredClone(s); wrong.winner.practice.counter = 'GUIDE'; reject(wrong, { type: 'CLOSE', caseId: 'falling-counter' });
  });

  it('returns false for malformed save records without throwing or repairing them', () => {
    const s = promoted();
    for (const corrupt of [
      (copy: SliceState) => { (copy.winner as unknown as Record<string, unknown>).luck = null; },
      (copy: SliceState) => { (copy.winner as unknown as Record<string, unknown>).practice = []; },
      (copy: SliceState) => { (copy.winner.cases as unknown as Record<string, unknown>)['willing-aim'] = null; },
      (copy: SliceState) => { copy.winner.luck.accumulated = NaN; },
      (copy: SliceState) => { copy.winner.luck.spent = -1; },
      (copy: SliceState) => { copy.winner.luck.stored = 0.5; },
    ]) { const copy = structuredClone(s); corrupt(copy); expect(() => validateWinnerLife(copy)).not.toThrow(); expect(validateWinnerLife(copy)).toBe(false); }
  });
});
