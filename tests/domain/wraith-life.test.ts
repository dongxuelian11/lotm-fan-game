import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { WEREWOLF_MOON_EVENTS } from '../../src/domain/werewolf/content.js';
import { syncWerewolfMoon } from '../../src/domain/werewolf/life.js';
import { applyZombieActivity, syncZombieMoon } from '../../src/domain/zombie/life.js';
import { applyWraithCommand, createWraithState, freshWraithPractice, projectWraith, validateWraithState } from '../../src/domain/wraith/index.js';
import { applyWraithActivity, isWraithActivity, syncWraithMoon, validateWraithLife, wraithActions, wraithCases, wraithInside, wraithPractice, WRAITH_ENVIRONMENT } from '../../src/domain/wraith/life.js';
import { WRAITH_ABILITY_IDS, WRAITH_CASE_IDS, type WraithActivityCommand, type WraithCaseId, type WraithCommand } from '../../src/domain/wraith/types.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[WRAITH_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function zombie(week = 57): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/zombie-v0900/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.wraith = createWraithState();
  setWeek(s, Math.max(s.week, week, s.zombie.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promote(s: SliceState) {
  const c = context(s).ctx;
  applyWraithCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyWraithCommand(s, { type: 'BUY_POTION', bottleId: s.wraith.bottles[0]!.id }, c);
  applyWraithCommand(s, { type: 'CONSUME', bottleId: s.wraith.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function promoted(week = 57) { return promote(zombie(week)); }
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 100; }
function act(s: SliceState, command: WraithActivityCommand, roll = 1) {
  const c = context(s, roll); applyWraithActivity(s, command, c.ctx, c.award); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyWraithActivity(s, command as WraithActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: WraithCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.wraith.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: WraithCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  act(s, { type: 'CLOSE', caseId }); return act(s, { type: 'REPORT', caseId });
}
function signal(method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  const s = promoted(); complete(s, 'reflected-room'); begin(s, 'willing-signal', method); return s;
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.prisoner, s.madman, s.werewolf, s.zombie, s.world, s.town, s.combatHistory]);

describe('Wraith original reflective endpoints, one body and bounded possession', () => {
  it('starts with two covered original mirrors and no movement, host, written note or hidden rewards', () => {
    const old = zombie();
    expect(wraithActions(old)).toEqual([]); expect(wraithCases(old)).toEqual([]);
    expect(wraithPractice(old)).toEqual(freshWraithPractice()); expect(validateWraithLife(old)).toBe(true);
    const s = promoted(); expect(s.wraith.practice).toEqual(freshWraithPractice());
    expect(wraithInside(s)).toBe(false); expect(wraithCases(s).map(p => p.id)).toEqual([...WRAITH_CASE_IDS]);
    expect(wraithCases(s).every(p => p.observations.length === 0)).toBe(true); expect(validateWraithState(s)).toBe(true);
    expect(WRAITH_ENVIRONMENT).toContain('原创G'); expect(WRAITH_ENVIRONMENT).toContain('极度虚弱');
    expect(wraithCases(s)[0]!.story).toContain('WF5-MIRROR-ROOM'); expect(wraithCases(s)[0]!.story).toContain('WF5-MIRROR-ALCOVE');
    const copy = wraithPractice(s); copy.host = 'NOLAN'; expect(s.wraith.practice.host).toBe('SELF');
  });

  it('rejects invented endpoints, hosts, props and ability-written accounts before spending or checking', () => {
    expect(isWraithActivity({ type: 'CLOSE', caseId: 'reflected-room' })).toBe(true);
    expect(isWraithActivity({ type: 'LEARN_GUIDANCE' })).toBe(false);
    expect(isWraithActivity(null as unknown as WraithCommand)).toBe(false);
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'unseen-mirror' }, { type: 'PREPARE', caseId: 'honest-account', method: 'ABILITY' }, { type: 'PERFORM', caseId: 'reflected-room', destination: 'OUTSIDE' }, { type: 'PERFORM', caseId: 'willing-signal', target: 'OTHER_ADULT' }, { type: 'CLOSE', caseId: 'willing-signal', keepControl: true }, { type: 'HANDLE_MOON', method: 'KILL' }, { type: 'REFLECT', extra: true }, { type: 'OBJECT_CURSE' }]) reject(promoted(), command);
  });

  it.each([
    { method: 'ABILITY' as const, roll: 1 }, { method: 'ABILITY' as const, roll: 100 },
    { method: 'ORDINARY' as const, roll: 1 }, { method: 'ORDINARY' as const, roll: 100 },
  ])('really arrives and returns along the original $method route at roll $roll', ({ method, roll }) => {
    const s = promoted(), old = originals(s); begin(s, 'reflected-room', method);
    s.actionsRemaining = 1; s.spirituality = method === 'ABILITY' ? 3 : 0;
    const result = act(s, { type: 'PERFORM', caseId: 'reflected-room' }, roll);
    expect(result.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', method === 'ABILITY' ? 14 : 10);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.wraith.practice).toEqual({ ...freshWraithPractice(), form: method === 'ABILITY' ? 'WRAITH' : 'HUMAN', node: 'ALCOVE', mirror: 'OPEN' });
    expect(s.wraith.cases['reflected-room']).toMatchObject({ status: roll === 1 ? 'EXAMINED' : 'OBSERVED', outcome: roll === 1 ? 'ROUTE_CHECKED' : 'NONE', contactOpen: true, closes: 0 });
    expect(messages(result)).toContain('真实反射端点'); expect(messages(result)).toContain('实际');
    expect(validateWraithState(s)).toBe(true); expect(wraithInside(s)).toBe(true);
    for (const command of [{ type: 'REPORT', caseId: 'reflected-room' }, { type: 'WITHDRAW', caseId: 'reflected-room' }, { type: 'PERFORM', caseId: 'reflected-room' }, { type: 'ENCOUNTER_FIGHT' }]) reject(s, command);
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow();
    expect(wraithActions(s).find(a => a.command.type === 'CLOSE')).toMatchObject({ enabled: true, cost: expect.stringContaining('0额外灵性') });
    s.mind = 0; s.health = 1; const close = act(s, { type: 'CLOSE', caseId: 'reflected-room' });
    expect(messages(close)).toContain(method === 'ABILITY' ? '实际跃回仍打开的WF5-MIRROR-ROOM' : '四米原侧廊实际步行返回ROOM');
    expect(messages(close)).toContain('原遮布重新盖好'); expect(s.wraith.practice).toEqual(freshWraithPractice());
    expect([s.actionsRemaining, s.spirituality, s.mind, s.health]).toEqual([0, 0, 0, 1]);
    expect(close.ctx.check).not.toHaveBeenCalled(); expect(close.award).not.toHaveBeenCalled();
    expect(wraithInside(s)).toBe(false); expect(validateWraithState(s)).toBe(true); expect(originals(s)).toEqual(old);
    reject(s, { type: 'CLOSE', caseId: 'reflected-room' });
  });

  it('does not return through a fabricated endpoint or close a missing real reflection', () => {
    const s = promoted(); begin(s, 'reflected-room', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'reflected-room' });
    for (const mutate of [
      (copy: SliceState) => { copy.wraith.practice.node = 'ROOM'; },
      (copy: SliceState) => { copy.wraith.practice.mirror = 'COVERED'; },
      (copy: SliceState) => { copy.wraith.practice.form = 'HUMAN'; },
      (copy: SliceState) => { copy.wraith.practice.host = 'NOLAN'; },
    ]) { const copy = structuredClone(s); mutate(copy); expect(validateWraithLife(copy)).toBe(false); reject(copy, { type: 'CLOSE', caseId: 'reflected-room' }); }
    act(s, { type: 'CLOSE', caseId: 'reflected-room' });
    const c = act(s, { type: 'REPORT', caseId: 'reflected-room' });
    expect(c.award).toHaveBeenCalledExactlyOnceWith('wraith-case:reflected-room', 8); expect(validateWraithState(s)).toBe(true);
  });

  it('keeps failed mirror costs and requires next real week to retry the same endpoints', () => {
    const s = promoted(); begin(s, 'reflected-room', 'ABILITY');
    act(s, { type: 'PERFORM', caseId: 'reflected-room' }, 100); act(s, { type: 'CLOSE', caseId: 'reflected-room' });
    reject(s, { type: 'REPORT', caseId: 'reflected-room' }); reject(s, { type: 'PREPARE', caseId: 'reflected-room', method: 'ORDINARY' });
    nextWeek(s); const c = complete(s, 'reflected-room');
    expect(c.award).not.toHaveBeenCalled(); expect(s.wraith.cases['reflected-room']!.closes).toBe(2);
    expect(s.wraith.practice).toEqual(freshWraithPractice()); expect(validateWraithState(s)).toBe(true);
  });

  it('really possesses original Nolan and raises his original flag, then exits at last AP and zero spirit', () => {
    const s = signal(), old = originals(s), mastery = structuredClone(s.progression.mastery);
    s.actionsRemaining = 1; s.spirituality = 3;
    const result = act(s, { type: 'PERFORM', caseId: 'willing-signal' });
    expect(result.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.wraith.practice).toEqual({ ...freshWraithPractice(), form: 'WRAITH', host: 'NOLAN', flag: 'RAISED' });
    expect(s.wraith.cases['willing-signal']).toMatchObject({ status: 'EXAMINED', outcome: 'SIGNAL_CHECKED', contactOpen: true });
    expect(messages(result)).toContain('实际进入同一位原诺兰体内'); expect(messages(result)).toContain('WF5-FLAG-1');
    expect(result.award).not.toHaveBeenCalled(); expect(s.progression.mastery).toEqual(mastery); expect(validateWraithState(s)).toBe(true);
    for (const command of [{ type: 'REPORT', caseId: 'willing-signal' }, { type: 'WITHDRAW', caseId: 'willing-signal' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'OBSERVE', caseId: 'honest-account' }]) reject(s, command);
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    s.mind = 0; const close = act(s, { type: 'CLOSE', caseId: 'willing-signal' });
    expect(messages(close)).toContain('实际退出同一位原诺兰'); expect(messages(close)).toContain('亲手把同一面WF5-FLAG-1实际放回原桌');
    expect(messages(close)).toContain('有限同意与联系实际结束'); expect(s.wraith.practice).toEqual(freshWraithPractice());
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(close.ctx.check).not.toHaveBeenCalled();
    expect(close.award).not.toHaveBeenCalled(); expect(wraithInside(s)).toBe(false); expect(originals(s)).toEqual(old);
    s.actionsRemaining = 1; s.mind = 100;
    const report = act(s, { type: 'REPORT', caseId: 'willing-signal' });
    expect(report.award).toHaveBeenCalledExactlyOnceWith('wraith-case:willing-signal', 8);
    expect(s.progression.acting).toBe(50); expect(validateWraithState(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'willing-signal' });
  });

  it('actually repels a paid possession, keeps flag on table and requires an explicit stop before next-week retry', () => {
    const s = signal(), old = originals(s); s.actionsRemaining = 1; s.spirituality = 3;
    const c = act(s, { type: 'PERFORM', caseId: 'willing-signal' }, 100);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); expect(s.wraith.practice).toEqual(freshWraithPractice());
    expect(s.wraith.cases['willing-signal']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(messages(c)).toContain('被排斥后实际在ROOM重新显形'); expect(wraithCases(s)[1]!.result).toContain('实际被排斥');
    expect(c.award).not.toHaveBeenCalled(); expect(wraithInside(s)).toBe(true); expect(validateWraithState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'willing-signal' }); reject(s, { type: 'WITHDRAW', caseId: 'willing-signal' });
    const close = act(s, { type: 'CLOSE', caseId: 'willing-signal' });
    expect(messages(close)).toContain('没有虚构第二次退出'); expect(messages(close)).toContain('始终在原桌TABLE');
    expect(wraithInside(s)).toBe(false); expect(originals(s)).toEqual(old);
    s.actionsRemaining = 10; reject(s, { type: 'PREPARE', caseId: 'willing-signal', method: 'ORDINARY' });
    nextWeek(s); const report = complete(s, 'willing-signal'); expect(report.award).not.toHaveBeenCalled();
    expect(s.wraith.cases['willing-signal']!.closes).toBe(2); expect(validateWraithState(s)).toBe(true);
  });

  it.each([1, 100])('uses original Nolan voluntary ordinary action at roll %i without creating a host', roll => {
    const s = signal('ORDINARY'), old = originals(s); s.spirituality = 0;
    const c = act(s, { type: 'PERFORM', caseId: 'willing-signal' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10);
    expect(s.wraith.practice).toEqual({ ...freshWraithPractice(), flag: 'RAISED' });
    expect(messages(c)).toContain('原诺兰本人听取普通请求后自愿亲手举起'); expect(validateWraithLife(s)).toBe(true);
    const close = act(s, { type: 'CLOSE', caseId: 'willing-signal' });
    expect(messages(close)).toContain('没有附身或虚构退出'); expect(s.wraith.practice).toEqual(freshWraithPractice());
    expect(s.spirituality).toBe(0); expect(originals(s)).toEqual(old);
    if (roll === 1) expect(act(s, { type: 'REPORT', caseId: 'willing-signal' }).award).not.toHaveBeenCalled();
  });

  it('writes and physically hands over the same original paper after failure and next-week correction', () => {
    const s = promoted(); complete(s, 'reflected-room'); complete(s, 'willing-signal'); begin(s, 'honest-account');
    const old = originals(s), spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'honest-account' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(spirit);
    expect(s.wraith.practice.note).toBe('WRITTEN'); expect(messages(c)).toContain('WF5-NOTE-1'); expect(validateWraithState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'honest-account' }); s.actionsRemaining = 0; s.spirituality = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'honest-account' });
    expect(messages(close)).toContain('亲手把已经写过的同一张WF5-NOTE-1实际交给原哈伦'); expect(messages(close)).toContain('失败文字也保留');
    expect(s.wraith.practice.note).toBe('HANDED_OVER'); expect(wraithInside(s)).toBe(false);
    nextWeek(s); begin(s, 'honest-account'); const retry = act(s, { type: 'PERFORM', caseId: 'honest-account' });
    expect(messages(retry)).toContain('哈伦亲手递来同一张WF5-NOTE-1'); expect(messages(retry)).toContain('之前的失败文字保留');
    act(s, { type: 'CLOSE', caseId: 'honest-account' }); expect(act(s, { type: 'REPORT', caseId: 'honest-account' }).award).not.toHaveBeenCalled();
    expect(s.wraith.cases['honest-account']!.closes).toBe(2); expect(originals(s)).toEqual(old); expect(validateWraithState(s)).toBe(true);
  });

  it('permits ordinary peaceful G100 without fake mastery, spiritual costs or rewriting old Zombie facts', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery), ap = s.actionsRemaining;
    s.spirituality = 0;
    for (const caseId of WRAITH_CASE_IDS) { expect(complete(s, caseId).award).not.toHaveBeenCalled(); expect(validateWraithState(s)).toBe(true); }
    const c = act(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.actionsRemaining, s.spirituality]).toEqual([100, ap - 13, 0]);
    expect(s.progression.mastery).toEqual(mastery); expect(c.award).not.toHaveBeenCalled();
    expect(s.wraith.practice).toEqual({ ...freshWraithPractice(), note: 'HANDED_OVER' });
    expect(messages(c)).toContain('不保证原著无风险消化或解除满月诅咒'); expect(originals(s)).toEqual(old); expect(validateWraithState(s)).toBe(true);
    expect(s.seer.completedSources.filter(source => source.startsWith('wraith-case:'))).toHaveLength(3);
    reject(s, { type: 'REFLECT' });
  });

  it('allows a zero-resource cancellation only before implementation and never refunds paid preparation', () => {
    const s = signal(); s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const old = originals(s);
    const c = act(s, { type: 'WITHDRAW', caseId: 'willing-signal' });
    expect(s.wraith.cases['willing-signal']).toMatchObject({ status: 'OBSERVED', method: null, contactOpen: false, withdrawals: 1 });
    expect(s.wraith.practice).toEqual(freshWraithPractice()); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(messages(c)).toContain('有限同意同时结束'); expect(originals(s)).toEqual(old); expect(validateWraithState(s)).toBe(true);
  });
});

describe('Wraith finite announced moon replaces old curse without deleting history', () => {
  it('triggers only actual S5 on one of the original eight announced weeks', () => {
    const old = zombie(60); syncWraithMoon(old, context(old).ctx); expect(old.wraith.moon.pendingWeek).toBeNull();
    const s = promoted(); setWeek(s, 59); syncWraithMoon(s, context(s).ctx); expect(s.wraith.moon.pendingWeek).toBeNull();
    setWeek(s, 60); const c = context(s); syncWraithMoon(s, c.ctx);
    expect(s.wraith.moon.pendingWeek).toBe(60); expect(messages(c)).toContain('极度虚弱');
    expect(WEREWOLF_MOON_EVENTS.map(event => event.week)).toEqual([32, 37, 41, 46, 51, 55, 60, 65]);
    expect(s.werewolf.moon.pendingWeek).toBeNull(); expect(s.zombie.moon.pendingWeek).toBeNull(); expect(validateWraithState(s)).toBe(true);
  });

  it.each([{ method: 'GUARDED' as const, cost: 10 }, { method: 'ALONE' as const, cost: 20 }])('actually waits through $method weakness at zero AP and only pays its own mental cost', ({ method, cost }) => {
    const s = promoted(); complete(s, 'reflected-room'); setWeek(s, 60); const old = originals(s), c = context(s);
    syncWerewolfMoon(s, c.ctx); syncZombieMoon(s, c.ctx); syncWraithMoon(s, c.ctx);
    expect(s.wraith.moon.pendingWeek).toBe(60); expect(s.werewolf.moon.pendingWeek).toBeNull(); expect(s.zombie.moon.pendingWeek).toBeNull();
    expect(wraithInside(s)).toBe(true); expect(wraithActions(s).map(a => a.command.type)).toEqual(['HANDLE_MOON', 'HANDLE_MOON']);
    reject(s, { type: 'ENCOUNTER_FIGHT' }); reject(s, { type: 'OBSERVE', caseId: 'willing-signal' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'WORK' })).toThrow();
    s.actionsRemaining = 0;
    const before = { mind: s.mind, health: s.health, spirit: s.spirituality, progression: structuredClone(s.progression), week: s.week, date: { ...s.date } };
    const handled = act(s, { type: 'HANDLE_MOON', method });
    expect([s.actionsRemaining, s.mind, s.health, s.spirituality, s.week]).toEqual([0, before.mind - cost, before.health, before.spirit, before.week]);
    expect(s.date).toEqual(before.date); expect(s.progression).toEqual(before.progression); expect(originals(s)).toEqual(old);
    expect(s.wraith.moon).toEqual({ pendingWeek: null, history: [{ week: 60, method, mentalCost: cost }] });
    expect(messages(handled)).toContain('实际等过'); expect(messages(handled)).toContain('满月诅咒仍在'); expect(handled.award).not.toHaveBeenCalled(); expect(handled.ctx.check).not.toHaveBeenCalled();
    syncWraithMoon(s, c.ctx); expect(s.wraith.moon.pendingWeek).toBeNull(); reject(s, { type: 'HANDLE_MOON', method }); expect(validateWraithState(s)).toBe(true);
  });

  it('preserves an actually handled S6 episode when promotion happens during its same announced week', () => {
    const s = zombie(60), c = context(s);
    syncZombieMoon(s, c.ctx); expect(s.zombie.moon.pendingWeek).toBe(60);
    applyZombieActivity(s, { type: 'HANDLE_MOON', method: 'GUARDED' }, c.ctx, c.award);
    const old = originals(s); promote(s); const mind = s.mind;
    syncWraithMoon(s, context(s).ctx);
    expect(s.wraith.moon).toEqual({ pendingWeek: null, history: [] }); expect(s.mind).toBe(mind); expect(originals(s)).toEqual(old); expect(validateWraithState(s)).toBe(true);
    const forged = structuredClone(s); forged.wraith.moon.history.push({ week: 60, method: 'ALONE', mentalCost: 20 });
    expect(validateWraithLife(forged)).toBe(false);
  });

  it('waits for a real mirror return and active event closure before starting the same-week episode', () => {
    const s = promoted(); setWeek(s, 60); begin(s, 'reflected-room', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'reflected-room' });
    syncWraithMoon(s, context(s).ctx); expect(s.wraith.moon.pendingWeek).toBeNull();
    act(s, { type: 'CLOSE', caseId: 'reflected-room' });
    s.activeEvent = {} as NonNullable<SliceState['activeEvent']>;
    syncWraithMoon(s, context(s).ctx); expect(s.wraith.moon.pendingWeek).toBeNull();
    s.activeEvent = null; syncWraithMoon(s, context(s).ctx); expect(s.wraith.moon.pendingWeek).toBe(60); expect(validateWraithLife(s)).toBe(true);
  });

  it('defers during real combat and never extrapolates beyond the eight authored episodes', () => {
    const s = promoted(); complete(s, 'reflected-room'); setWeek(s, 60); act(s, { type: 'ENCOUNTER_FIGHT' });
    syncWraithMoon(s, context(s).ctx); expect(s.wraith.moon.pendingWeek).toBeNull(); expect(validateWraithState(s)).toBe(true);
    const later = promoted(); setWeek(later, 68); syncWraithMoon(later, context(later).ctx);
    expect(later.wraith.moon.pendingWeek).toBeNull(); expect(projectWraith(later).moon.summary).toContain('不代表诅咒消失');
  });

  it.each([0, 3])('keeps the player in their current location and spends only remaining mind %i', mind => {
    const s = promoted(); setWeek(s, 60); s.world.city = 'ELSEWHERE'; s.mind = mind; s.actionsRemaining = 0;
    syncWraithMoon(s, context(s).ctx);
    expect(wraithActions(s).find(a => a.command.type === 'HANDLE_MOON' && a.command.method === 'GUARDED')).toMatchObject({ enabled: false });
    reject(s, { type: 'HANDLE_MOON', method: 'GUARDED' }); const c = act(s, { type: 'HANDLE_MOON', method: 'ALONE' });
    expect([s.mind, s.actionsRemaining, s.world.city]).toEqual([0, 0, 'ELSEWHERE']);
    expect(s.wraith.moon.history).toEqual([{ week: 60, method: 'ALONE', mentalCost: mind }]);
    expect(messages(c)).toContain('当前实际地点'); expect(messages(c)).toContain('没有被传送到别处'); expect(validateWraithState(s)).toBe(true);
  });
});

describe('Wraith exact original practice and moon save boundaries', () => {
  it('rejects counterfeit body, host, flag, paper, attempt and report states', () => {
    const s = signal(); act(s, { type: 'PERFORM', caseId: 'willing-signal' });
    const corruptions: ((copy: SliceState) => void)[] = [
      copy => { copy.wraith.practice.form = 'HUMAN'; },
      copy => { copy.wraith.practice.node = 'ALCOVE'; },
      copy => { copy.wraith.practice.host = 'SELF'; },
      copy => { copy.wraith.practice.flag = 'TABLE'; },
      copy => { copy.wraith.practice.mirror = 'OPEN'; },
      copy => { copy.wraith.practice.note = 'WRITTEN'; },
      copy => { copy.wraith.cases['willing-signal']!.contactOpen = false; },
      copy => { copy.wraith.cases['willing-signal']!.attemptWeek = null; },
      copy => { copy.wraith.cases['willing-signal']!.outcome = 'ROUTE_CHECKED'; },
      copy => { copy.wraith.cases['willing-signal']!.status = 'OBSERVED'; },
      copy => { copy.wraith.cases['willing-signal']!.method = 'ORDINARY'; },
      copy => { copy.wraith.cases['willing-signal']!.closes = 1; },
      copy => { copy.progression.acting += 25; },
      copy => { copy.seer.completedSources.push('wraith-case:willing-signal'); },
      copy => { (copy.wraith.practice as unknown as Record<string, unknown>).owner = 'PLAYER'; },
    ];
    for (const corrupt of corruptions) { const copy = structuredClone(s); corrupt(copy); expect(validateWraithLife(copy)).toBe(false); }
  });

  it('rejects an unfinished contact disguised as a clean form and an impossible note handoff', () => {
    const repelled = signal(); act(repelled, { type: 'PERFORM', caseId: 'willing-signal' }, 100);
    expect(repelled.wraith.practice).toEqual(freshWraithPractice()); expect(wraithInside(repelled)).toBe(true);
    const counterfeit = structuredClone(repelled); counterfeit.wraith.cases['willing-signal']!.contactOpen = false;
    expect(validateWraithLife(counterfeit)).toBe(false);
    const s = promoted(); s.wraith.practice.note = 'HANDED_OVER'; expect(validateWraithLife(s)).toBe(false);
    s.wraith.practice.note = 'BLANK'; s.wraith.practice.host = 'NOLAN'; expect(wraithInside(s)).toBe(true); expect(validateWraithLife(s)).toBe(false);
  });

  it('rejects malformed, duplicated, unannounced and old-curse moon records without throwing', () => {
    const s = promoted(); setWeek(s, 60); syncWraithMoon(s, context(s).ctx); act(s, { type: 'HANDLE_MOON', method: 'GUARDED' });
    const corruptions: ((copy: SliceState) => void)[] = [
      copy => { copy.wraith.moon.pendingWeek = 60; },
      copy => { copy.wraith.moon.history.push({ week: 60, method: 'GUARDED', mentalCost: 10 }); },
      copy => { copy.wraith.moon.history[0]!.week = 59; },
      copy => { copy.wraith.moon.history[0]!.mentalCost = 11; },
      copy => { copy.wraith.moon.history[0]!.mentalCost = -1; },
      copy => { copy.zombie.moon.pendingWeek = 60; },
      copy => { copy.werewolf.moon.pendingWeek = 60; },
      copy => { (copy.wraith as unknown as Record<string, unknown>).moon = null; },
      copy => { (copy.wraith.moon as unknown as Record<string, unknown>).history = null; },
      copy => { (copy.wraith.moon.history as unknown[])[0] = null; },
      copy => { (copy.wraith.cases as unknown as Record<string, unknown>)['willing-signal'] = null; },
      copy => { (copy.wraith as unknown as Record<string, unknown>).practice = []; },
    ];
    for (const corrupt of corruptions) { const copy = structuredClone(s); corrupt(copy); expect(() => validateWraithLife(copy)).not.toThrow(); expect(validateWraithLife(copy)).toBe(false); }
  });
});
