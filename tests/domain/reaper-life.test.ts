import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { applyReaperCommand, createReaperState, validateReaperState } from '../../src/domain/reaper/index.js';
import { applyReaperActivity, reaperActions, reaperCases, reaperInside, validateReaperLife } from '../../src/domain/reaper/life.js';
import { REAPER_ABILITY_IDS, REAPER_CASE_IDS, type ReaperActivityCommand, type ReaperCaseId } from '../../src/domain/reaper/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[REAPER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function promoted(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/conspirator-v0740/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.reaper = createReaperState(); s.week = s.conspirator.promotionWeek! + 12;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100;
  s.health = 100; s.mind = 100; s.spirituality = 40; s.seer.pollution = 0; s.character.coreStats.will = 26;
  const c = context(s).ctx;
  applyReaperCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyReaperCommand(s, { type: 'BUY_POTION', bottleId: s.reaper.bottles[0]!.id }, c);
  applyReaperCommand(s, { type: 'CONSUME', bottleId: s.reaper.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function act(s: SliceState, command: ReaperActivityCommand, roll = 1) { const c = context(s, roll); applyReaperActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyReaperActivity(s, command as ReaperActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: ReaperCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method });
}
function perform(s: SliceState, caseId: ReaperCaseId, roll = 1) {
  if (caseId === 'moving-shutter') act(s, { type: 'SIGNAL', caseId });
  return act(s, { type: 'PERFORM', caseId }, roll);
}
function complete(s: SliceState, caseId: ReaperCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); perform(s, caseId); act(s, { type: 'CLOSE', caseId }); act(s, { type: 'REPORT', caseId });
}

describe('Reaper three different finite practices', () => {
  it('exposes exactly the three original cases after promotion, with no invented equipment', () => {
    const s = promoted(); expect(reaperCases(s).map(c => c.id)).toEqual([...REAPER_CASE_IDS]);
    expect(reaperCases(s).every(c => c.observations.length === 0)).toBe(true);
    expect(reaperCases(s).find(c => c.id === 'moving-shutter')!.story).toContain('伊沃');
    expect(reaperCases(s).find(c => c.id === 'timber-seam')!.story).toContain('原件不会交付');
    expect(validateReaperState(s)).toBe(true);
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('requires actual timber observation, preparation and close before a report: %s', method => {
    const s = promoted(), spirit = s.spirituality, cash = s.cash, town = structuredClone(s.town);
    reject(s, { type: 'PERFORM', caseId: 'timber-seam' }); begin(s, 'timber-seam', method);
    reject(s, { type: 'OBSERVE', caseId: 'guarded-flame' });
    const c = perform(s, 'timber-seam'); expect(c.ctx.check).toHaveBeenCalledWith(method === 'ABILITY' ? 'perception' : 'knowledge', method === 'ABILITY' ? 14 : 10);
    expect([s.reaper.cases['timber-seam']!.outcome, reaperInside(s)]).toEqual(['SEAM_CHECKED', true]);
    reject(s, { type: 'REPORT', caseId: 'timber-seam' }); act(s, { type: 'CLOSE', caseId: 'timber-seam' });
    act(s, { type: 'REPORT', caseId: 'timber-seam' });
    expect([s.spirituality, s.progression.acting, s.cash]).toEqual([spirit - (method === 'ABILITY' ? 3 : 0), 25, cash]);
    expect(s.town).toEqual(town); expect(validateReaperState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'timber-seam' });
  });
  it('preparation does not create a swing window; an independent zero-action signal does', () => {
    const s = promoted(); begin(s, 'moving-shutter', 'ABILITY');
    expect(s.reaper.cases['moving-shutter']!.practice).toMatchObject({ signals: 0, windowUses: 0, windowOpen: false });
    reject(s, { type: 'PERFORM', caseId: 'moving-shutter' });
    expect(reaperActions(s).find(a => a.id === 'moving-shutter-perform')!.enabled).toBe(false);
    const ap = s.actionsRemaining, spirit = s.spirituality, c = act(s, { type: 'SIGNAL', caseId: 'moving-shutter' });
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap, spirit]); expect(c.ctx.check).not.toHaveBeenCalled();
    expect(s.reaper.cases['moving-shutter']!.practice).toMatchObject({ signals: 1, windowUses: 0, windowOpen: true });
    expect(reaperInside(s)).toBe(true); expect(validateReaperState(s)).toBe(true);
    reject(s, { type: 'SIGNAL', caseId: 'moving-shutter' }); reject(s, { type: 'CLOSE', caseId: 'moving-shutter' });
    reject(s, { type: 'OBSERVE', caseId: 'guarded-flame' }); reject(s, { type: 'ENCOUNTER_TALK' });
  });
  it('cannot start a live swing at zero remaining action', () => {
    const s = promoted(); begin(s, 'moving-shutter'); s.actionsRemaining = 0;
    reject(s, { type: 'SIGNAL', caseId: 'moving-shutter' });
    expect(reaperActions(s).find(a => a.id === 'moving-shutter-signal')!.reason).toContain('保有1行动');
    act(s, { type: 'WITHDRAW', caseId: 'moving-shutter' }); expect(s.actionsRemaining).toBe(0);
  });
  it('consumes even a failed real swing once, keeps its note, and requires next-week preparation and a new signal', () => {
    const s = promoted(); begin(s, 'moving-shutter', 'ABILITY'); const spirit = s.spirituality, mind = s.mind;
    perform(s, 'moving-shutter', 100);
    const r = s.reaper.cases['moving-shutter']!;
    expect(r).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true, practice: { attempts: 1, signals: 1, windowUses: 1, windowOpen: false } });
    expect([s.spirituality, s.mind, s.progression.acting]).toEqual([spirit - 3, mind - 5, 0]);
    const oldNotes = [...r.notes]; expect(oldNotes[0]).toContain('GREAT_FAILURE'); expect(oldNotes[0]).toContain('窗口已消耗');
    reject(s, { type: 'SIGNAL', caseId: 'moving-shutter' }); reject(s, { type: 'PERFORM', caseId: 'moving-shutter' });
    act(s, { type: 'CLOSE', caseId: 'moving-shutter' }); reject(s, { type: 'PREPARE', caseId: 'moving-shutter', method: 'ORDINARY' });
    s.week++; act(s, { type: 'PREPARE', caseId: 'moving-shutter', method: 'ORDINARY' });
    reject(s, { type: 'PERFORM', caseId: 'moving-shutter' }); perform(s, 'moving-shutter');
    expect(r.notes.slice(0, 1)).toEqual(oldNotes); expect(r.practice).toMatchObject({ attempts: 2, signals: 2, windowUses: 2, windowOpen: false });
    act(s, { type: 'CLOSE', caseId: 'moving-shutter' }); act(s, { type: 'REPORT', caseId: 'moving-shutter' });
    expect(validateReaperState(s)).toBe(true);
  });
  it('withdrawal really stops an opened window, does not roll or refund, and cannot reuse it', () => {
    const s = promoted(); begin(s, 'moving-shutter', 'ABILITY'); act(s, { type: 'SIGNAL', caseId: 'moving-shutter' });
    const before = [s.actionsRemaining, s.spirituality, s.health, s.mind], c = act(s, { type: 'WITHDRAW', caseId: 'moving-shutter' });
    expect([s.actionsRemaining, s.spirituality, s.health, s.mind]).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled();
    expect(s.reaper.cases['moving-shutter']!).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, practice: { signals: 1, windowUses: 0, windowOpen: false } });
    expect(reaperInside(s)).toBe(false); act(s, { type: 'PREPARE', caseId: 'moving-shutter', method: 'ORDINARY' });
    reject(s, { type: 'PERFORM', caseId: 'moving-shutter' }); expect(validateReaperState(s)).toBe(true);
    act(s, { type: 'SIGNAL', caseId: 'moving-shutter' }); expect(s.reaper.cases['moving-shutter']!.practice.signals).toBe(2);
  });
  it('allows zero-spirit ordinary fallback only after canceling the live capability preparation', () => {
    const s = promoted(); begin(s, 'moving-shutter', 'ABILITY'); s.spirituality = 0; act(s, { type: 'SIGNAL', caseId: 'moving-shutter' });
    reject(s, { type: 'PERFORM', caseId: 'moving-shutter' }); act(s, { type: 'WITHDRAW', caseId: 'moving-shutter' });
    act(s, { type: 'PREPARE', caseId: 'moving-shutter', method: 'ORDINARY' }); perform(s, 'moving-shutter');
    expect(s.spirituality).toBe(0); expect(s.reaper.cases['moving-shutter']!.outcome).toBe('WINDOW_CHECKED');
    expect(reaperCases(s).find(c => c.id === 'moving-shutter')!.result).toContain('没有施放精准打击');
  });
  it.each(['ABILITY', 'ORDINARY'] as const)('actually clears the original guarded range before %s practice and does not invent a fire result', method => {
    const s = promoted(), spirit = s.spirituality, original = structuredClone(s.town); begin(s, 'guarded-flame', method);
    expect(s.reaper.cases['guarded-flame']!.practice.siteCleared).toBe(false);
    const c = perform(s, 'guarded-flame');
    expect(c.ctx.note).toHaveBeenCalledWith('实际清空原隔离靶道', expect.stringContaining('伊沃实际退到原隔离线外'));
    expect(s.reaper.cases['guarded-flame']!.practice.siteCleared).toBe(true);
    expect(s.spirituality).toBe(spirit - (method === 'ABILITY' ? 4 : 0));
    const result = reaperCases(s).find(c => c.id === 'guarded-flame')!.result!;
    expect(result).toContain(method === 'ABILITY' ? '完成有限火焰投射' : '没有点火');
    act(s, { type: 'CLOSE', caseId: 'guarded-flame' }); expect(s.reaper.cases['guarded-flame']!.practice.siteCleared).toBe(false);
    act(s, { type: 'REPORT', caseId: 'guarded-flame' }); expect(s.town).toEqual(original); expect(validateReaperState(s)).toBe(true);
  });
  it('charges all four spirituality on a failed flame attempt, preserves its record, and really closes', () => {
    const s = promoted(); begin(s, 'guarded-flame', 'ABILITY'); const spirit = s.spirituality;
    perform(s, 'guarded-flame', 100); expect(s.spirituality).toBe(spirit - 4);
    expect(s.reaper.cases['guarded-flame']!).toMatchObject({ status: 'OBSERVED', contactOpen: true, practice: { siteCleared: true } });
    expect(s.reaper.cases['guarded-flame']!.notes[0]).toContain('FAILURE');
    act(s, { type: 'CLOSE', caseId: 'guarded-flame' }); expect(s.reaper.cases['guarded-flame']!.practice.siteCleared).toBe(false);
    expect(validateReaperState(s)).toBe(true);
  });
  it('reaches acting100 through three ordinary reports and one reflection without battle or a false ability claim', () => {
    const s = promoted(), spirit = s.spirituality, prior = structuredClone([s.hunter, s.provoker, s.pyromaniac, s.conspirator]);
    reject(s, { type: 'REFLECT' });
    for (const id of REAPER_CASE_IDS) { complete(s, id); expect(validateReaperState(s)).toBe(true); }
    expect(s.progression.acting).toBe(75); act(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.spirituality, s.reaper.encounter.status]).toEqual([100, spirit, 'AVAILABLE']);
    expect(s.progression.mastery[REAPER_ABILITY_IDS[0]]).toBe(24);
    expect([s.hunter, s.provoker, s.pyromaniac, s.conspirator]).toEqual(prior); expect(validateReaperState(s)).toBe(true);
    reject(s, { type: 'REFLECT' });
  });
  it('holds the last action at the actual practice until zero-action close, then advances the real shared week', () => {
    const s = promoted(); begin(s, 'moving-shutter'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const signaled = applySliceIntent(s, { type: 'REAPER', command: { type: 'SIGNAL', caseId: 'moving-shutter' } });
    expect([signaled.week, signaled.actionsRemaining]).toEqual([s.week, 1]);
    expect(() => applySliceIntent(signaled, { type: 'ACTION', action: 'REST' })).toThrow();
    const performed = applySliceIntent(signaled, { type: 'REAPER', command: { type: 'PERFORM', caseId: 'moving-shutter' } });
    expect([performed.week, performed.actionsRemaining, performed.cash]).toEqual([s.week, 0, s.cash]); expect(reaperInside(performed)).toBe(true);
    const closed = applySliceIntent(performed, { type: 'REAPER', command: { type: 'CLOSE', caseId: 'moving-shutter' } });
    expect(closed.week).toBe(s.week + 1); expect(reaperInside(closed)).toBe(false);
  });
  it('rejects forged windows, missing failed records, undone consumption, and duplicate growth sources', () => {
    const s = promoted(); begin(s, 'moving-shutter'); perform(s, 'moving-shutter', 100); act(s, { type: 'CLOSE', caseId: 'moving-shutter' });
    const changes: ((t: SliceState) => void)[] = [
      t => { t.reaper.cases['moving-shutter']!.notes = []; },
      t => { t.reaper.cases['moving-shutter']!.practice.windowOpen = true; },
      t => { t.reaper.cases['moving-shutter']!.practice.windowUses = 0; },
      t => { t.reaper.cases['moving-shutter']!.practice.signals = 0; },
      t => { t.reaper.cases['moving-shutter']!.closes = 0; },
      t => { t.reaper.cases['timber-seam']!.practice.siteCleared = true; },
      t => { t.seer.completedSources.push('reaper-case:moving-shutter'); },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validateReaperLife(t)).toBe(false); }
  });
  it('makes completed record and reflection source counts exact and non-repeatable', () => {
    const s = promoted(); for (const id of REAPER_CASE_IDS) complete(s, id); act(s, { type: 'REFLECT' });
    for (const source of ['reaper-case:timber-seam', 'reaper-reflection']) {
      const t = structuredClone(s); t.seer.completedSources.push(source); expect(validateReaperLife(t)).toBe(false);
    }
    const t = structuredClone(s); t.reaper.cases['guarded-flame']!.notes[0] = '普通核查也施放了火焰'; expect(validateReaperLife(t)).toBe(false);
  });
});
