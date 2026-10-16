import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { ARBITER_ABILITY_IDS } from '../../src/domain/arbiter/types.js';
import { applyPunishmentKnightCommand, createPunishmentKnightState, freshPunishmentKnightPractice, validatePunishmentKnightState } from '../../src/domain/punishment-knight/index.js';
import { applyPunishmentKnightActivity, isPunishmentKnightActivity, punishmentKnightActions, punishmentKnightCases, punishmentKnightInside, punishmentKnightPractice, validatePunishmentKnightLife, PUNISHMENT_KNIGHT_ENVIRONMENT } from '../../src/domain/punishment-knight/life.js';
import { PUNISHMENT_KNIGHT_ABILITY_IDS, PUNISHMENT_KNIGHT_CASE_IDS, type PunishmentKnightActivityCommand, type PunishmentKnightCaseId, type PunishmentKnightCommand } from '../../src/domain/punishment-knight/types.js';

const originalFinal = JSON.parse(readFileSync('tests/fixtures/judge-v0930/natural.json', 'utf8')).final;
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  // A deterministic known-pool selection deliberately chooses an inherited ability, not a new one.
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[ARBITER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function judge(): SliceState {
  const s = migrateSliceState(structuredClone(originalFinal)); s.punishmentKnight = createPunishmentKnightState();
  setWeek(s, Math.max(s.week, s.judge.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promoted() {
  const s = judge(), ctx = context(s).ctx;
  applyPunishmentKnightCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyPunishmentKnightCommand(s, { type: 'BUY_POTION', bottleId: s.punishmentKnight.bottles[0]!.id }, ctx);
  applyPunishmentKnightCommand(s, { type: 'CONSUME', bottleId: s.punishmentKnight.bottles[0]!.id, confirmed: true }, ctx);
  return s;
}
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 100; }
function act(s: SliceState, command: PunishmentKnightActivityCommand, roll = 1) {
  const c = context(s, roll); applyPunishmentKnightActivity(s, command, c.ctx, c.award); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyPunishmentKnightActivity(s, command as PunishmentKnightActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.ctx.note).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: PunishmentKnightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.punishmentKnight.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: PunishmentKnightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  act(s, { type: 'CLOSE', caseId }); return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.arbiter, s.sheriff, s.interrogator, s.judge, s.world, s.town, s.combatHistory, s.injuries, s.health, s.mind]);


describe('PunishmentKnight finite originals, real breach and consenting release', () => {
  it('opens only at exact sequence5 with independent original physical state', () => {
    const old = judge(); expect(punishmentKnightActions(old)).toEqual([]); expect(punishmentKnightCases(old)).toEqual([]);
    expect(validatePunishmentKnightLife(old)).toBe(true); reject(old, { type: 'OBSERVE', caseId: 'breach-and-pad' });
    const s = promoted(); expect(punishmentKnightPractice(s)).toEqual(freshPunishmentKnightPractice());
    expect(punishmentKnightInside(s)).toBe(false); expect(validatePunishmentKnightState(s)).toBe(true);
    expect(punishmentKnightCases(s)).toHaveLength(3); expect(PUNISHMENT_KNIGHT_ENVIRONMENT).toContain('刻意减弱');
    expect(PUNISHMENT_KNIGHT_ENVIRONMENT).toContain('不要求先战斗'); expect(PUNISHMENT_KNIGHT_ENVIRONMENT).toContain('已有知识池随机');
    const copy = punishmentKnightPractice(s); copy.pad = 'MAT'; expect(s.punishmentKnight.practice.pad).toBe('STAND');
  });

  it('observes an actual adult step before BREACHED and applies punishment only to the original safe pad', () => {
    const s = promoted(), old = originals(s); begin(s, 'breach-and-pad', 'ABILITY');
    expect(s.punishmentKnight.practice).toEqual(freshPunishmentKnightPractice()); expect(punishmentKnightInside(s)).toBe(false);
    s.actionsRemaining = 1; s.spirituality = 3;
    const c = act(s, { type: 'PERFORM', caseId: 'breach-and-pad' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(c.ctx.roll).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.punishmentKnight.practice).toEqual({ pad: 'MAT', partner: 'FREE', rule: 'BREACHED', note: 'BLANK' });
    expect(s.punishmentKnight.cases['breach-and-pad']).toMatchObject({ status: 'EXAMINED', outcome: 'PUNISHMENT_CHECKED', contactOpen: true, closes: 0 });
    const narration = messages(c); expect(narration).toContain('真实迈步跨过原线'); expect(narration).toContain('实际越线在先，才记BREACHED');
    expect(narration).toContain('随后你才只向同一PK5-SOFT-PAD-1'); expect(narration).toContain('阿伦不是攻击目标');
    expect(originals(s)).toEqual(old); expect(validatePunishmentKnightState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'breach-and-pad' }); reject(s, { type: 'WITHDRAW', caseId: 'breach-and-pad' });
    const close = act(s, { type: 'CLOSE', caseId: 'breach-and-pad' });
    expect(messages(close)).toContain('亲手从原安全垫扶起同一PK5-SOFT-PAD-1'); expect(messages(close)).toContain('拾起同一PK5-LINE-1收回原盒');
    expect(s.punishmentKnight.practice).toEqual(freshPunishmentKnightPractice()); expect(punishmentKnightInside(s)).toBe(false);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); expect(close.award).not.toHaveBeenCalled();
    s.actionsRemaining = 1; expect(act(s, { type: 'REPORT', caseId: 'breach-and-pad' }).award).toHaveBeenCalledExactlyOnceWith('punishment-knight-case:breach-and-pad', 8);
    expect(validatePunishmentKnightState(s)).toBe(true);
  });

  it('keeps the actual breach but not a successful punishment result after a paid failure', () => {
    const s = promoted(); begin(s, 'breach-and-pad', 'ABILITY'); const old = originals(s), before = structuredClone(s.progression);
    s.actionsRemaining = 1; s.spirituality = 3;
    const c = act(s, { type: 'PERFORM', caseId: 'breach-and-pad' }, 100);
    expect(s.punishmentKnight.practice).toEqual({ pad: 'STAND', partner: 'FREE', rule: 'BREACHED', note: 'BLANK' });
    expect(s.punishmentKnight.cases['breach-and-pad']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(s.progression).toEqual(before); expect(originals(s)).toEqual(old); expect(c.award).not.toHaveBeenCalled(); expect(validatePunishmentKnightState(s)).toBe(true);
    expect(messages(c)).toContain('实际越线不等于成功惩戒');
    s.mind = 0; s.health = 1;
    expect(punishmentKnightActions(s).find(a => a.id === 'breach-and-pad-close')).toMatchObject({ enabled: true });
    act(s, { type: 'CLOSE', caseId: 'breach-and-pad' }); expect([s.actionsRemaining, s.spirituality, s.mind, s.health]).toEqual([0, 0, 0, 1]);
    s.actionsRemaining = 10; s.mind = 50; reject(s, { type: 'PREPARE', caseId: 'breach-and-pad', method: 'ORDINARY' });
    nextWeek(s); complete(s, 'breach-and-pad'); expect(s.punishmentKnight.cases['breach-and-pad']!.closes).toBe(2); expect(validatePunishmentKnightState(s)).toBe(true);
  });

  it.each(['ABILITY', 'ORDINARY'] as const)('really releases and walks back after %s pause at zero resources', method => {
    const s = promoted(); complete(s, 'breach-and-pad'); begin(s, 'willing-pause', method); const old = originals(s);
    expect(s.punishmentKnight.practice.partner).toBe('FREE'); s.actionsRemaining = 1; s.spirituality = method === 'ABILITY' ? 3 : 0;
    const c = act(s, { type: 'PERFORM', caseId: 'willing-pause' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', method === 'ABILITY' ? 14 : 10);
    expect(s.punishmentKnight.practice.partner).toBe(method === 'ABILITY' ? 'HELD' : 'FREE'); expect(punishmentKnightInside(s)).toBe(true);
    expect(originals(s)).toEqual(old); expect(validatePunishmentKnightState(s)).toBe(true);
    s.mind = 0; s.health = 1;
    const close = act(s, { type: 'CLOSE', caseId: 'willing-pause' });
    expect(messages(close)).toContain('解除束缚并等候短效消退'); expect(messages(close)).toContain('沿原清楚短路实际走回原起点');
    expect(messages(close)).toContain('本次有限同意已经结束'); expect(s.punishmentKnight.practice.partner).toBe('FREE');
    expect([s.actionsRemaining, s.spirituality, s.health, s.mind]).toEqual([0, 0, 1, 0]); expect(close.ctx.check).not.toHaveBeenCalled(); expect(close.award).not.toHaveBeenCalled();
    expect(validatePunishmentKnightState(s)).toBe(true);
  });

  it('failed confinement remains free but still requires true closure before a next-week retry', () => {
    const s = promoted(); complete(s, 'breach-and-pad'); begin(s, 'willing-pause', 'ABILITY');
    const before = s.spirituality, c = act(s, { type: 'PERFORM', caseId: 'willing-pause' }, 100);
    expect(s.spirituality).toBe(before - 3); expect(s.punishmentKnight.practice.partner).toBe('FREE');
    expect(s.punishmentKnight.cases['willing-pause']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(messages(c)).toContain('不伪称已经囚禁'); reject(s, { type: 'ENCOUNTER_FIGHT' }); reject(s, { type: 'REPORT', caseId: 'willing-pause' });
    act(s, { type: 'CLOSE', caseId: 'willing-pause' }); reject(s, { type: 'PREPARE', caseId: 'willing-pause', method: 'ABILITY' });
    nextWeek(s); complete(s, 'willing-pause', 'ABILITY'); expect(validatePunishmentKnightState(s)).toBe(true);
  });

  it.each(PUNISHMENT_KNIGHT_CASE_IDS)('keeps %s preparation stable across weeks and permits zero-cost cancellation', id => {
    const s = promoted(); for (const prior of PUNISHMENT_KNIGHT_CASE_IDS.slice(0, PUNISHMENT_KNIGHT_CASE_IDS.indexOf(id))) complete(s, prior);
    const before = structuredClone(s.punishmentKnight.practice); begin(s, id, id === 'wound-record' ? 'ORDINARY' : 'ABILITY');
    expect(s.punishmentKnight.practice).toEqual(before); expect(punishmentKnightInside(s)).toBe(false);
    nextWeek(s); expect(validatePunishmentKnightState(s)).toBe(true); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const c = act(s, { type: 'WITHDRAW', caseId: id }); expect(s.punishmentKnight.practice).toEqual(before);
    expect(s.punishmentKnight.cases[id]).toMatchObject({ status: 'OBSERVED', method: null, attemptWeek: null, closes: 0, withdrawals: 1 });
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled(); expect(validatePunishmentKnightState(s)).toBe(true);
  });

  it('rejects unpaid ability without mutation and offers a genuine ordinary zero-spirit alternative', () => {
    const s = promoted(); begin(s, 'breach-and-pad', 'ABILITY'); s.spirituality = 2;
    reject(s, { type: 'PERFORM', caseId: 'breach-and-pad' }); act(s, { type: 'WITHDRAW', caseId: 'breach-and-pad' });
    begin(s, 'breach-and-pad'); const c = act(s, { type: 'PERFORM', caseId: 'breach-and-pad' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 12); expect(s.spirituality).toBe(2);
    expect(s.punishmentKnight.practice).toEqual({ pad: 'MAT', partner: 'FREE', rule: 'NONE', note: 'BLANK' });
    act(s, { type: 'CLOSE', caseId: 'breach-and-pad' }); expect(act(s, { type: 'REPORT', caseId: 'breach-and-pad' }).award).not.toHaveBeenCalled();
    expect(validatePunishmentKnightState(s)).toBe(true);
  });

  it('ordinary wound note works with no wounds, never offers ABILITY, and preserves failed writing through actual handover', () => {
    const s = promoted(); complete(s, 'breach-and-pad'); complete(s, 'willing-pause'); s.injuries = [];
    act(s, { type: 'OBSERVE', caseId: 'wound-record' });
    reject(s, { type: 'PREPARE', caseId: 'wound-record', method: 'ABILITY' });
    expect(punishmentKnightActions(s).some(a => a.id === 'wound-record-ability')).toBe(false);
    begin(s, 'wound-record'); s.actionsRemaining = 1; s.spirituality = 0;
    const before = structuredClone(s.progression), c = act(s, { type: 'PERFORM', caseId: 'wound-record' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(messages(c)).toContain('未观察到可记录伤势');
    expect(s.punishmentKnight.practice.note).toBe('WRITTEN'); expect(s.punishmentKnight.cases['wound-record']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(s.injuries).toEqual([]); expect(s.progression).toEqual(before); expect(validatePunishmentKnightState(s)).toBe(true);
    s.mind = 0; const close = act(s, { type: 'CLOSE', caseId: 'wound-record' });
    expect(messages(close)).toContain('同一张PK5-NOTE-1实际交回薇娜'); expect(s.punishmentKnight.practice.note).toBe('HANDED_OVER');
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(close.ctx.check).not.toHaveBeenCalled();
    s.mind = 50; nextWeek(s); begin(s, 'wound-record');
    const retry = act(s, { type: 'PERFORM', caseId: 'wound-record' }); expect(messages(retry)).toContain('之前失败文字保留');
    act(s, { type: 'CLOSE', caseId: 'wound-record' }); expect(act(s, { type: 'REPORT', caseId: 'wound-record' }).award).not.toHaveBeenCalled();
    expect(s.progression.mastery).toEqual(before.mastery); expect(validatePunishmentKnightState(s)).toBe(true);
  });

  it('copies only a real existing injury record without treating it or turning it into an enemy target', () => {
    const s = promoted(); complete(s, 'breach-and-pad'); complete(s, 'willing-pause');
    s.injuries = [{ id: 'actual-old-injury', severity: 'LIGHT', acquiredRevision: s.revision, treatedRevision: null }];
    const old = originals(s); begin(s, 'wound-record'); const c = act(s, { type: 'PERFORM', caseId: 'wound-record' });
    expect(messages(c)).toContain('actual-old-injury（轻伤，未治疗）'); expect(messages(c)).toContain('不拿玩家伤势当成针对他人的裁决来源');
    act(s, { type: 'CLOSE', caseId: 'wound-record' }); act(s, { type: 'REPORT', caseId: 'wound-record' });
    expect(originals(s)).toEqual(old); expect(PUNISHMENT_KNIGHT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
  });

  it.each(['ABILITY', 'ORDINARY'] as const)('reaches peaceful100 with %s first two cases and only actually used ability awards', method => {
    const s = promoted(), ap = s.actionsRemaining, sp = s.spirituality, old = originals(s), mastery = structuredClone(s.progression.mastery);
    for (const id of PUNISHMENT_KNIGHT_CASE_IDS) {
      const c = complete(s, id, id === 'wound-record' ? 'ORDINARY' : method);
      if (method === 'ABILITY' && id !== 'wound-record') expect(c.award).toHaveBeenCalledExactlyOnceWith(`punishment-knight-case:${id}`, 8);
      else expect(c.award).not.toHaveBeenCalled();
      expect(validatePunishmentKnightState(s)).toBe(true); reject(s, { type: 'REPORT', caseId: id });
    }
    act(s, { type: 'REFLECT' }); expect([s.progression.acting, s.actionsRemaining, s.spirituality]).toEqual([100, ap - 13, sp - (method === 'ABILITY' ? 6 : 0)]);
    expect(s.punishmentKnight.practice).toEqual({ pad: 'STAND', partner: 'FREE', rule: 'NONE', note: 'HANDED_OVER' });
    expect(s.progression.mastery[ARBITER_ABILITY_IDS[0]]).toBe(mastery[ARBITER_ABILITY_IDS[0]]! + (method === 'ABILITY' ? 16 : 0));
    expect(PUNISHMENT_KNIGHT_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([0, 0, 0]);
    expect(originals(s)).toEqual(old); expect(validatePunishmentKnightState(s)).toBe(true); reject(s, { type: 'REFLECT' });
  });

  it('rejects skipped reports, orphan physical effects, imagined breaches and cross-week confinement', () => {
    const s = promoted(); reject(s, { type: 'OBSERVE', caseId: 'willing-pause' }); reject(s, { type: 'OBSERVE', caseId: 'wound-record' });
    for (const mutate of [(x: SliceState) => { x.punishmentKnight.practice.pad = 'MAT'; }, (x: SliceState) => { x.punishmentKnight.practice.partner = 'HELD'; }, (x: SliceState) => { x.punishmentKnight.practice.rule = 'DECLARED'; }, (x: SliceState) => { x.punishmentKnight.practice.note = 'WRITTEN'; }]) {
      const fake = structuredClone(s); mutate(fake); expect(validatePunishmentKnightLife(fake)).toBe(false); expect(punishmentKnightInside(fake)).toBe(true);
    }
    begin(s, 'breach-and-pad', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'breach-and-pad' });
    const accused = structuredClone(s); accused.punishmentKnight.practice.rule = 'DECLARED'; expect(validatePunishmentKnightLife(accused)).toBe(false);
    const absent = structuredClone(s); absent.punishmentKnight.cases['breach-and-pad']!.contactOpen = false; expect(validatePunishmentKnightLife(absent)).toBe(false);
    const swapped = structuredClone(s); swapped.punishmentKnight.practice.pad = 'STAND'; reject(swapped, { type: 'CLOSE', caseId: 'breach-and-pad' });
    act(s, { type: 'CLOSE', caseId: 'breach-and-pad' }); act(s, { type: 'REPORT', caseId: 'breach-and-pad' });
    begin(s, 'willing-pause', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'willing-pause' });
    const later = structuredClone(s); nextWeek(later); expect(validatePunishmentKnightLife(later)).toBe(false); reject(later, { type: 'CLOSE', caseId: 'willing-pause' });
    const ordinary = structuredClone(s); ordinary.punishmentKnight.cases['willing-pause']!.method = 'ORDINARY'; expect(validatePunishmentKnightLife(ordinary)).toBe(false);
  });

  it('preserves exact physical state in serialization and stops public week rollover until actual close', () => {
    const s = promoted(); begin(s, 'breach-and-pad', 'ABILITY'); s.actionsRemaining = 1; const week = s.week;
    const performed = applySliceIntent(s, { type: 'PUNISHMENT_KNIGHT', command: { type: 'PERFORM', caseId: 'breach-and-pad' } });
    expect(performed.week).toBe(week); expect(performed.actionsRemaining).toBe(0); expect(performed.punishmentKnight.cases['breach-and-pad']!.contactOpen).toBe(true);
    const loaded = migrateSliceState(JSON.parse(JSON.stringify(performed))); expect(loaded.punishmentKnight).toEqual(performed.punishmentKnight);
    expect(validatePunishmentKnightState(loaded)).toBe(true);
    const closed = applySliceIntent(loaded, { type: 'PUNISHMENT_KNIGHT', command: { type: 'CLOSE', caseId: 'breach-and-pad' } });
    expect(closed.punishmentKnight.practice).toEqual(freshPunishmentKnightPractice()); expect(closed.week).toBe(week + 1);
  });

  it('does not recognize acquisition commands or malformed activity input as executable practice', () => {
    const s = promoted(); expect(isPunishmentKnightActivity({ type: 'LEARN_GUIDANCE' })).toBe(false);
    expect(isPunishmentKnightActivity(null as unknown as PunishmentKnightCommand)).toBe(false);
    for (const command of [null, { type: 'PREPARE', caseId: 'breach-and-pad', method: 'FAKE' }, { type: 'PERFORM', caseId: 'other' }, { type: 'REFLECT', extra: true }, { type: 'LEARN_GUIDANCE' }]) reject(s, command);
  });
});
