import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { applyMentorDisorderCommand, createMentorDisorderState, freshMentorDisorderPractice, validateMentorDisorderState } from '../../src/domain/mentor-disorder/index.js';
import { applyMentorDisorderActivity, isMentorDisorderActivity, mentorDisorderActions, mentorDisorderCases, mentorDisorderInside, mentorDisorderPractice, validateMentorDisorderLife, MENTOR_DISORDER_ENVIRONMENT } from '../../src/domain/mentor-disorder/life.js';
import { MENTOR_DISORDER_ABILITY_IDS, MENTOR_DISORDER_CASE_IDS, type MentorDisorderActivityCommand, type MentorDisorderCaseId, type MentorDisorderCommand } from '../../src/domain/mentor-disorder/types.js';

const originalFinal = JSON.parse(readFileSync('tests/fixtures/corruption-baron-v0920/natural.json', 'utf8')).final;
function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[MENTOR_DISORDER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function setWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function corruptionBaron(): SliceState {
  const s = migrateSliceState(structuredClone(originalFinal)); s.mentorDisorder = createMentorDisorderState();
  setWeek(s, Math.max(s.week, s.corruptionBaron.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26; s.character.coreStats.knowledge = 26;
  return s;
}
function promoted() {
  const s = corruptionBaron(), ctx = context(s).ctx;
  applyMentorDisorderCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyMentorDisorderCommand(s, { type: 'BUY_POTION', bottleId: s.mentorDisorder.bottles[0]!.id }, ctx);
  applyMentorDisorderCommand(s, { type: 'CONSUME', bottleId: s.mentorDisorder.bottles[0]!.id, confirmed: true }, ctx);
  return s;
}
function nextWeek(s: SliceState) { setWeek(s, s.week + 1); s.actionsRemaining = 100; }
function act(s: SliceState, command: MentorDisorderActivityCommand, roll = 1) {
  const c = context(s, roll); applyMentorDisorderActivity(s, command, c.ctx, c.award); return c;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyMentorDisorderActivity(s, command as MentorDisorderActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.ctx.note).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: MentorDisorderCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  if (s.mentorDisorder.cases[caseId]!.status === 'AVAILABLE') act(s, { type: 'OBSERVE', caseId });
  act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: MentorDisorderCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId });
  act(s, { type: 'CLOSE', caseId }); return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const originals = (s: SliceState) => structuredClone([s.lawyer, s.barbarian, s.briber, s.corruptionBaron, s.world, s.town, s.combatHistory]);

describe('Mentor of Disorder finite two-original-counter practice', () => {
  it('opens only after promotion and projects exact independent original practice without a resource bank', () => {
    const old = corruptionBaron();
    expect(mentorDisorderActions(old)).toEqual([]); expect(mentorDisorderCases(old)).toEqual([]); expect(validateMentorDisorderLife(old)).toBe(true);
    reject(old, { type: 'OBSERVE', caseId: 'paired-trays' });
    const s = promoted();
    expect(mentorDisorderPractice(s)).toEqual({ markers: 'SORTED', route: 'READY', note: 'BLANK' });
    expect(mentorDisorderPractice(s)).toEqual(freshMentorDisorderPractice()); expect(mentorDisorderInside(s)).toBe(false);
    expect(mentorDisorderCases(s).map(p => p.id)).toEqual([...MENTOR_DISORDER_CASE_IDS]); expect(validateMentorDisorderState(s)).toBe(true);
    const copy = mentorDisorderPractice(s); copy.markers = 'MIXED'; expect(s.mentorDisorder.practice.markers).toBe('SORTED');
    expect(s.mentorDisorder).not.toHaveProperty('luck'); expect(s.mentorDisorder).not.toHaveProperty('bank');
    expect(MENTOR_DISORDER_ENVIRONMENT).toContain('原创G'); expect(MENTOR_DISORDER_ENVIRONMENT).toContain('3灵性、知识14');
    expect(MENTOR_DISORDER_ENVIRONMENT).toContain('不提前取得序列4'); expect(MENTOR_DISORDER_ENVIRONMENT).toContain('三分钟自我混乱');
  });

  it('keeps both originals stable during preparation and only pays three spirit for one actual knowledge14 check', () => {
    const s = promoted(), old = originals(s); begin(s, 'paired-trays', 'ABILITY');
    expect(s.mentorDisorder.practice).toEqual(freshMentorDisorderPractice()); expect(mentorDisorderInside(s)).toBe(false);
    s.actionsRemaining = 1; s.spirituality = 3;
    const c = act(s, { type: 'PERFORM', caseId: 'paired-trays' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(c.ctx.roll).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]); expect(s.mentorDisorder.practice.markers).toBe('MIXED');
    expect(s.mentorDisorder.cases['paired-trays']).toMatchObject({ status: 'EXAMINED', outcome: 'TRAYS_CHECKED', contactOpen: true, closes: 0 });
    expect(messages(c)).toContain('同时启动同一MD5-RED-1与MD5-BLUE-1'); expect(messages(c)).toContain('各自连续滚道');
    expect(mentorDisorderInside(s)).toBe(true); expect(validateMentorDisorderState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'paired-trays' }); reject(s, { type: 'WITHDRAW', caseId: 'paired-trays' });
    expect(mentorDisorderActions(s).find(a => a.id === 'paired-trays-close')).toMatchObject({ enabled: true, cost: expect.stringContaining('0行动') });
    s.health = 70; s.mind = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'paired-trays' });
    expect(messages(close)).toContain('逐一按MD5-RED-1与MD5-BLUE-1核对'); expect(messages(close)).toContain('亲手从各自原盘收回原红、蓝分格');
    expect(s.mentorDisorder.practice.markers).toBe('SORTED'); expect(mentorDisorderInside(s)).toBe(false);
    expect([s.actionsRemaining, s.spirituality, s.health, s.mind]).toEqual([0, 0, 70, 0]);
    expect(close.ctx.check).not.toHaveBeenCalled(); expect(close.award).not.toHaveBeenCalled(); expect(originals(s)).toEqual(old);
    s.mind = 100; s.actionsRemaining = 1;
    expect(act(s, { type: 'REPORT', caseId: 'paired-trays' }).award).toHaveBeenCalledExactlyOnceWith('mentor-disorder-case:paired-trays', 8);
    expect(validateMentorDisorderState(s)).toBe(true); reject(s, { type: 'REPORT', caseId: 'paired-trays' });
  });

  it('retains both original counters and all paid costs on failure, then really closes before next-week retry', () => {
    const s = promoted(); begin(s, 'paired-trays', 'ABILITY'); s.actionsRemaining = 1; s.spirituality = 3;
    const old = originals(s), c = act(s, { type: 'PERFORM', caseId: 'paired-trays' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(c.award).not.toHaveBeenCalled();
    expect(s.mentorDisorder.cases['paired-trays']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(s.mentorDisorder.practice.markers).toBe('COLLECTED'); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(messages(c)).toContain('失败也保留并实际收拢原两筹'); expect(validateMentorDisorderState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'paired-trays' }); reject(s, { type: 'WITHDRAW', caseId: 'paired-trays' });
    act(s, { type: 'CLOSE', caseId: 'paired-trays' });
    expect(s.mentorDisorder.practice.markers).toBe('SORTED'); expect(s.spirituality).toBe(0);
    s.actionsRemaining = 10; reject(s, { type: 'PREPARE', caseId: 'paired-trays', method: 'ORDINARY' });
    nextWeek(s); expect(complete(s, 'paired-trays').award).not.toHaveBeenCalled();
    expect(s.mentorDisorder.cases['paired-trays']!.closes).toBe(2); expect(originals(s)).toEqual(old); expect(validateMentorDisorderState(s)).toBe(true);
  });

  it.each([1, 100])('ordinary roll %i operates original dividers only after stopping and never creates MIXED or mastery', roll => {
    const s = promoted(); begin(s, 'paired-trays'); s.spirituality = 0;
    const c = act(s, { type: 'PERFORM', caseId: 'paired-trays' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 12); expect(s.spirituality).toBe(0);
    expect(s.mentorDisorder.practice.markers).toBe('COLLECTED'); expect(c.award).not.toHaveBeenCalled();
    expect(messages(c)).toContain('先等两筹停止，再亲手操作原普通分隔片'); expect(messages(c)).toContain('不伪称魔法混乱');
    expect(s.mentorDisorder.cases['paired-trays']!.outcome).toBe(roll === 1 ? 'TRAYS_CHECKED' : 'NONE');
    act(s, { type: 'CLOSE', caseId: 'paired-trays' });
    if (roll === 1) expect(act(s, { type: 'REPORT', caseId: 'paired-trays' }).award).not.toHaveBeenCalled();
    else reject(s, { type: 'REPORT', caseId: 'paired-trays' });
    expect(validateMentorDisorderState(s)).toBe(true);
  });

  it('rechecks actual spirit at PERFORM and permits zero-action cancellation before ordinary preparation', () => {
    const s = promoted(); begin(s, 'paired-trays', 'ABILITY'); s.spirituality = 2;
    reject(s, { type: 'PERFORM', caseId: 'paired-trays' });
    expect(mentorDisorderActions(s).find(a => a.id === 'paired-trays-perform')).toMatchObject({ enabled: false, reason: expect.stringContaining('3灵性') });
    s.actionsRemaining = 0; s.mind = 0;
    const c = act(s, { type: 'WITHDRAW', caseId: 'paired-trays' });
    expect(s.mentorDisorder.cases['paired-trays']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, contactOpen: false, attemptWeek: null });
    expect(s.mentorDisorder.practice).toEqual(freshMentorDisorderPractice()); expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 2, 0]);
    expect(c.ctx.check).not.toHaveBeenCalled(); expect(validateMentorDisorderLife(s)).toBe(true);
    s.actionsRemaining = 10; s.mind = 100; s.spirituality = 0;
    expect(complete(s, 'paired-trays').award).not.toHaveBeenCalled(); expect(s.spirituality).toBe(0);
  });
});

describe('Mentor of Disorder finite consenting route and same original note', () => {
  it.each([1, 100])('pays for one current movement attempt at roll %i, preserves choice and needs actual original-route return', roll => {
    const s = promoted(); complete(s, 'paired-trays'); begin(s, 'willing-crossing', 'ABILITY');
    expect(s.mentorDisorder.practice.route).toBe('READY'); expect(mentorDisorderInside(s)).toBe(false);
    s.actionsRemaining = 1; s.spirituality = 3; const old = originals(s), c = act(s, { type: 'PERFORM', caseId: 'willing-crossing' }, roll);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect([s.actionsRemaining, s.spirituality]).toEqual([0, 0]);
    expect(s.mentorDisorder.practice.route).toBe('MARKED'); expect(s.mentorDisorder.cases['willing-crossing']).toMatchObject({ contactOpen: true, status: roll === 1 ? 'EXAMINED' : 'OBSERVED', outcome: roll === 1 ? 'ROUTE_CHECKED' : 'NONE' });
    expect(messages(c)).toContain('只有在他开始横向移动后'); expect(messages(c)).toContain('无论核对成败，他都依自己的选择');
    expect(c.award).not.toHaveBeenCalled(); expect(validateMentorDisorderState(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'willing-crossing' }); reject(s, { type: 'BUY_GIFTS' });
    s.mind = 0; const close = act(s, { type: 'CLOSE', caseId: 'willing-crossing' });
    expect(messages(close)).toContain('赛恩本人复核原路线，沿同一原路实际走回原起点');
    expect(messages(close)).toContain('亲手撤下同一MD5-ROUTE-MARKER并收回原盒'); expect(messages(close)).toContain('有限同意已经结束');
    expect(s.mentorDisorder.practice.route).toBe('FREE'); expect(mentorDisorderInside(s)).toBe(false);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]); expect(close.ctx.check).not.toHaveBeenCalled(); expect(close.award).not.toHaveBeenCalled();
    expect(originals(s)).toEqual(old); expect(validateMentorDisorderState(s)).toBe(true);
    s.actionsRemaining = 10; s.mind = 100;
    if (roll === 1) expect(act(s, { type: 'REPORT', caseId: 'willing-crossing' }).award).toHaveBeenCalledExactlyOnceWith('mentor-disorder-case:willing-crossing', 8);
    else {
      reject(s, { type: 'REPORT', caseId: 'willing-crossing' }); reject(s, { type: 'PERFORM', caseId: 'willing-crossing' });
      reject(s, { type: 'PREPARE', caseId: 'willing-crossing', method: 'ORDINARY' });
      nextWeek(s); const preparation = act(s, { type: 'PREPARE', caseId: 'willing-crossing', method: 'ORDINARY' });
      expect(messages(preparation)).toContain('赛恩本人当前同意'); expect(s.mentorDisorder.practice.route).toBe('READY');
      act(s, { type: 'PERFORM', caseId: 'willing-crossing' }); act(s, { type: 'CLOSE', caseId: 'willing-crossing' });
      expect(act(s, { type: 'REPORT', caseId: 'willing-crossing' }).award).not.toHaveBeenCalled();
      expect(s.mentorDisorder.cases['willing-crossing']!.closes).toBe(2);
    }
    expect(validateMentorDisorderState(s)).toBe(true);
  });

  it('ordinary route is actual verbal clarification and normal marked walking with no forced wrong step', () => {
    const s = promoted(); complete(s, 'paired-trays'); begin(s, 'willing-crossing'); s.spirituality = 0;
    const c = act(s, { type: 'PERFORM', caseId: 'willing-crossing' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.mentorDisorder.practice.route).toBe('MARKED');
    expect(messages(c)).toContain('普通指路不令他自动走错'); expect(mentorDisorderCases(s)[1]!.result).toContain('正常沿原标线行走');
    act(s, { type: 'CLOSE', caseId: 'willing-crossing' }); expect(act(s, { type: 'REPORT', caseId: 'willing-crossing' }).award).not.toHaveBeenCalled();
    expect(s.spirituality).toBe(0); expect(s.mentorDisorder.practice.route).toBe('FREE'); expect(validateMentorDisorderState(s)).toBe(true);
  });

  it('cancelling an unperformed route ends that finite consent and requires a real new preparation', () => {
    const s = promoted(); complete(s, 'paired-trays'); begin(s, 'willing-crossing', 'ABILITY');
    s.actionsRemaining = 0; s.spirituality = 0; const c = act(s, { type: 'WITHDRAW', caseId: 'willing-crossing' });
    expect(messages(c)).toContain('赛恩尚未起步，原标记仍在原盒'); expect(s.mentorDisorder.practice.route).toBe('FREE');
    expect(s.mentorDisorder.cases['willing-crossing']).toMatchObject({ attemptWeek: null, contactOpen: false, method: null, withdrawals: 1 });
    expect(mentorDisorderInside(s)).toBe(false); expect(validateMentorDisorderState(s)).toBe(true); reject(s, { type: 'PERFORM', caseId: 'willing-crossing' });
    nextWeek(s); begin(s, 'willing-crossing'); expect(s.mentorDisorder.practice.route).toBe('READY'); expect(validateMentorDisorderState(s)).toBe(true);
  });

  it('keeps failed writing on the same original paper and requires actual zero-action handover before retry', () => {
    const s = promoted(); complete(s, 'paired-trays'); complete(s, 'willing-crossing'); begin(s, 'honest-account');
    const old = originals(s), c = act(s, { type: 'PERFORM', caseId: 'honest-account' }, 100);
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.mentorDisorder.practice.note).toBe('WRITTEN');
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0;
    const close = act(s, { type: 'CLOSE', caseId: 'honest-account' });
    expect(messages(close)).toContain('同一张MD5-NOTE-1实际交给原核册员伊芙'); expect(messages(close)).toContain('失败文字也保留');
    expect(s.mentorDisorder.practice.note).toBe('HANDED_OVER'); expect(mentorDisorderInside(s)).toBe(false); expect(validateMentorDisorderState(s)).toBe(true);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 0, 0]);
    s.mind = 100; nextWeek(s); begin(s, 'honest-account'); const retry = act(s, { type: 'PERFORM', caseId: 'honest-account' });
    expect(messages(retry)).toContain('伊芙亲手递来同一张MD5-NOTE-1'); expect(messages(retry)).toContain('之前的失败文字保留');
    act(s, { type: 'CLOSE', caseId: 'honest-account' }); expect(act(s, { type: 'REPORT', caseId: 'honest-account' }).award).not.toHaveBeenCalled();
    expect(s.mentorDisorder.cases['honest-account']!.closes).toBe(2); expect(originals(s)).toEqual(old); expect(validateMentorDisorderState(s)).toBe(true);
  });

  it('supports all-ordinary G100 with exactly thirteen paid actions and no fake ability mastery', () => {
    const s = promoted(), old = originals(s), mastery = structuredClone(s.progression.mastery), ap = s.actionsRemaining;
    s.spirituality = 0;
    for (const caseId of MENTOR_DISORDER_CASE_IDS) { expect(complete(s, caseId).award).not.toHaveBeenCalled(); expect(validateMentorDisorderState(s)).toBe(true); }
    const c = act(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.actionsRemaining, s.spirituality]).toEqual([100, ap - 13, 0]);
    expect(s.progression.mastery).toEqual(mastery); expect(s.mentorDisorder.practice).toEqual({ markers: 'SORTED', route: 'FREE', note: 'HANDED_OVER' });
    expect(c.award).not.toHaveBeenCalled(); expect(messages(c)).toContain('不伪造能力掌握'); expect(originals(s)).toEqual(old);
    expect(s.seer.completedSources.filter(source => source.startsWith('mentor-disorder-case:'))).toHaveLength(3);
    expect(validateMentorDisorderState(s)).toBe(true); reject(s, { type: 'REFLECT' });
  });

  it('awards only two real successful ability reports and does not duplicate rewards on close or reflection', () => {
    const s = promoted(); const first = complete(s, 'paired-trays', 'ABILITY'), second = complete(s, 'willing-crossing', 'ABILITY');
    expect(first.award).toHaveBeenCalledExactlyOnceWith('mentor-disorder-case:paired-trays', 8);
    expect(second.award).toHaveBeenCalledExactlyOnceWith('mentor-disorder-case:willing-crossing', 8);
    expect(complete(s, 'honest-account').award).not.toHaveBeenCalled(); expect(act(s, { type: 'REFLECT' }).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(100); expect(s.progression.mastery[MENTOR_DISORDER_ABILITY_IDS[0]]).toBe(16);
    expect(validateMentorDisorderState(s)).toBe(true); reject(s, { type: 'CLOSE', caseId: 'willing-crossing' });
  });
});

describe('Mentor of Disorder command boundaries, inherited supply and finite save validation', () => {
  it('rejects malformed commands, premature cases and forbidden expanded effects before changing state', () => {
    expect(isMentorDisorderActivity({ type: 'BUY_GIFTS' })).toBe(true);
    expect(isMentorDisorderActivity({ type: 'LEARN_GUIDANCE' })).toBe(false);
    expect(isMentorDisorderActivity(null as unknown as MentorDisorderCommand)).toBe(false);
    for (const command of [null, {}, { type: 'ACCUMULATE' }, { type: 'PERFORM', caseId: 'paired-trays', reroll: true }, { type: 'PREPARE', caseId: 'honest-account', method: 'ABILITY' }, { type: 'CLOSE', caseId: 'willing-crossing', teleport: true }, { type: 'REWRITE_WORLD' }, { type: 'GIFT' }, { type: 'MAGNIFY' }, { type: 'EXPLOIT' }, { type: 'OBSERVE', caseId: 'willing-crossing' }, { type: 'OBSERVE', caseId: 'honest-account' }]) reject(promoted(), command);
    const s = promoted(); s.world.city = 'ELSEWHERE'; reject(s, { type: 'OBSERVE', caseId: 'paired-trays' });
    s.world.city = 'BACKLUND'; s.actionsRemaining = 0; reject(s, { type: 'OBSERVE', caseId: 'paired-trays' });
    s.actionsRemaining = 10; begin(s, 'paired-trays'); reject(s, { type: 'REFLECT' }); reject(s, { type: 'BUY_GIFTS' });
    act(s, { type: 'PERFORM', caseId: 'paired-trays' });
    expect(() => applySliceIntent(s, { type: 'ACTION', action: 'REST' })).toThrow();
    reject(s, { type: 'ENCOUNTER_FIGHT' });
    act(s, { type: 'CLOSE', caseId: 'paired-trays' }); expect(mentorDisorderInside(s)).toBe(false);
  });

  it('delegates S5 supply to three new original briber gifts, with no action, refill or returned old gifts', () => {
    const s = promoted(), gifts = structuredClone(s.briber.gifts), packs = s.briber.giftPacks;
    const before = structuredClone(s.mentorDisorder), cash = s.cash;
    s.actionsRemaining = 0; s.spirituality = 0; const c = act(s, { type: 'BUY_GIFTS' });
    expect([s.actionsRemaining, s.spirituality, s.cash]).toEqual([0, 0, cash - 60]); expect(s.briber.giftPacks).toBe(packs + 1);
    expect(s.briber.gifts.slice(0, gifts.length)).toEqual(gifts); expect(s.briber.gifts).toHaveLength(gifts.length + 3);
    expect(new Set(s.briber.gifts.map(gift => gift.id)).size).toBe(s.briber.gifts.length);
    for (const gift of s.briber.gifts.slice(gifts.length)) expect(gift).toMatchObject({ location: 'PLAYER', destination: null, givenWeek: null });
    expect(s.mentorDisorder).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
    s.cash = 59; reject(s, { type: 'BUY_GIFTS' });
  });

  it('rejects forged original objects, paid-contact chronology, report sources and copied extra fields', () => {
    const s = promoted(); begin(s, 'paired-trays', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'paired-trays' });
    const corruptions: ((copy: SliceState) => void)[] = [
      copy => { copy.mentorDisorder.practice.markers = 'SORTED'; },
      copy => { copy.mentorDisorder.practice.markers = 'COLLECTED'; },
      copy => { copy.mentorDisorder.practice.route = 'MARKED'; },
      copy => { copy.mentorDisorder.practice.note = 'HANDED_OVER'; },
      copy => { copy.mentorDisorder.cases['paired-trays']!.contactOpen = false; },
      copy => { copy.mentorDisorder.cases['paired-trays']!.attemptWeek = null; },
      copy => { copy.mentorDisorder.cases['paired-trays']!.attemptWeek = copy.week - 1; },
      copy => { copy.mentorDisorder.cases['paired-trays']!.outcome = 'ROUTE_CHECKED'; },
      copy => { copy.mentorDisorder.cases['paired-trays']!.method = 'ORDINARY'; },
      copy => { copy.mentorDisorder.cases['paired-trays']!.closes = 1; },
      copy => { copy.progression.acting += 25; },
      copy => { copy.seer.completedSources.push('mentor-disorder-case:paired-trays'); },
      copy => { (copy.mentorDisorder.practice as unknown as Record<string, unknown>).owner = 'PLAYER'; },
      copy => { (copy.mentorDisorder.cases as unknown as Record<string, unknown>)['fourth-case'] = {}; },
    ];
    for (const corrupt of corruptions) { const copy = structuredClone(s); corrupt(copy); expect(validateMentorDisorderLife(copy)).toBe(false); }
    const wrong = structuredClone(s); wrong.mentorDisorder.practice.markers = 'SORTED'; reject(wrong, { type: 'CLOSE', caseId: 'paired-trays' });
  });

  it('rejects a returned route or paper without actual closure, and does not reinterpret ordinary collection as confusion', () => {
    const s = promoted(); complete(s, 'paired-trays'); begin(s, 'willing-crossing'); act(s, { type: 'PERFORM', caseId: 'willing-crossing' });
    const free = structuredClone(s); free.mentorDisorder.practice.route = 'FREE'; expect(validateMentorDisorderLife(free)).toBe(false); reject(free, { type: 'CLOSE', caseId: 'willing-crossing' });
    const ready = structuredClone(s); ready.mentorDisorder.practice.route = 'READY'; expect(validateMentorDisorderLife(ready)).toBe(false);
    act(s, { type: 'CLOSE', caseId: 'willing-crossing' }); act(s, { type: 'REPORT', caseId: 'willing-crossing' });
    begin(s, 'honest-account'); act(s, { type: 'PERFORM', caseId: 'honest-account' });
    const handed = structuredClone(s); handed.mentorDisorder.practice.note = 'HANDED_OVER'; expect(validateMentorDisorderLife(handed)).toBe(false); reject(handed, { type: 'CLOSE', caseId: 'honest-account' });
    const magic = structuredClone(s); magic.mentorDisorder.cases['honest-account']!.method = 'ABILITY'; expect(validateMentorDisorderLife(magic)).toBe(false);
    const ordinary = promoted(); begin(ordinary, 'paired-trays'); act(ordinary, { type: 'PERFORM', caseId: 'paired-trays' });
    ordinary.mentorDisorder.practice.markers = 'MIXED'; expect(validateMentorDisorderLife(ordinary)).toBe(false);
  });

  it('returns false for malformed save records without throwing or repairing them', () => {
    const s = promoted();
    for (const corrupt of [
      (copy: SliceState) => { (copy as unknown as Record<string, unknown>).mentorDisorder = null; },
      (copy: SliceState) => { (copy.mentorDisorder as unknown as Record<string, unknown>).practice = []; },
      (copy: SliceState) => { (copy.mentorDisorder.cases as unknown as Record<string, unknown>)['willing-crossing'] = null; },
      (copy: SliceState) => { copy.mentorDisorder.cases['paired-trays']!.closes = NaN; },
      (copy: SliceState) => { copy.mentorDisorder.cases['paired-trays']!.withdrawals = -1; },
      (copy: SliceState) => { copy.mentorDisorder.cases['paired-trays']!.closes = 0.5; },
    ]) {
      const copy = structuredClone(s); corrupt(copy); const before = structuredClone(copy);
      expect(() => validateMentorDisorderLife(copy)).not.toThrow(); expect(validateMentorDisorderLife(copy)).toBe(false); expect(copy).toEqual(before);
    }
  });
});
