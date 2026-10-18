import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyMysticismMagisterCommand, createMysticismMagisterState, validateMysticismMagisterState } from '../../src/domain/mysticism-magister/index.js';
import { applyMysticismMagisterActivity, mysticismMagisterActions, mysticismMagisterCases, mysticismMagisterInside, mysticismMagisterPractice, mysticismMagisterCrafts, MYSTICISM_MAGISTER_ENVIRONMENT, validateMysticismMagisterLife } from '../../src/domain/mysticism-magister/life.js';
import { MYSTICISM_MAGISTER_ABILITY_IDS, MYSTICISM_MAGISTER_CASE_IDS, type MysticismMagisterActivityCommand, type MysticismMagisterCaseId } from '../../src/domain/mysticism-magister/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[MYSTICISM_MAGISTER_ABILITY_IDS[0]] = Math.min(500, s.progression.mastery[MYSTICISM_MAGISTER_ABILITY_IDS[0]]! + amount);
  });
  return { ctx, award };
}
function polymath(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/polymath-v0790/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.mysticismMagister = createMysticismMagisterState();
  const week = s.polymath.promotionWeek! + 12; s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function promoted() {
  const s = polymath(), c = context(s).ctx, bottleId = s.mysticismMagister.bottles[0]!.id;
  applyMysticismMagisterCommand(s, { type: 'LEARN_GUIDANCE' }, c); applyMysticismMagisterCommand(s, { type: 'BUY_POTION', bottleId }, c);
  applyMysticismMagisterCommand(s, { type: 'CONSUME', bottleId, confirmed: true }, c); return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: MysticismMagisterActivityCommand, roll = 1) { const c = context(s, roll); applyMysticismMagisterActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyMysticismMagisterActivity(s, command as MysticismMagisterActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: MysticismMagisterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') { act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: MysticismMagisterCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  if (caseId === 'linked-dream') { act(s, { type: 'VERIFY_DREAM' }); act(s, { type: 'RETURN_TOKEN' }); }
  if (caseId === 'modest-craft' && method === 'ABILITY') act(s, { type: 'TEST_TOKEN', itemId: s.mysticismMagister.crafts[0]!.id });
  return act(s, { type: 'REPORT', caseId });
}
function dreamed() { const s = promoted(); complete(s, 'linked-dream'); return s; }
function crafted(method: 'ABILITY' | 'ORDINARY' = 'ABILITY') { const s = dreamed(); complete(s, 'modest-craft', method); return s; }
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');

describe('Mysticism Magister real original link, consumed material and independent teaching', () => {
  it('hides the new practice before promotion and exposes only the three authored finite stories', () => {
    const before = polymath(); expect(mysticismMagisterActions(before)).toEqual([]); expect(mysticismMagisterCases(before)).toEqual([]);
    expect(mysticismMagisterPractice(before)).toBeNull(); expect(mysticismMagisterCrafts(before)).toEqual([]); expect(validateMysticismMagisterLife(before)).toBe(true);
    const s = promoted(); expect(mysticismMagisterCases(s).map(c => c.id)).toEqual([...MYSTICISM_MAGISTER_CASE_IDS]);
    expect(mysticismMagisterCases(s).every(c => c.observations.length === 0)).toBe(true);
    expect(s.mysticismMagister.practice).toEqual({ token: 'OWNER', dreamOpen: false, dreamResult: 'NONE', dreamAttempts: 0, kitsUsed: 0, teachingChecks: 0 });
    expect(validateMysticismMagisterState(s)).toBe(true); expect(MYSTICISM_MAGISTER_ENVIRONMENT).toContain('原创G');
    expect(MYSTICISM_MAGISTER_ENVIRONMENT).toContain('个别原著千海里案例不是本阶段默认射程');
  });

  it('rejects invented IDs, extra fields, missing item IDs and unapproved command shapes before mutation', () => {
    for (const c of [null, {}, { type: 'OBSERVE', caseId: 'future' }, { type: 'PREPARE', caseId: 'linked-dream', method: 'NIGHTMARE' }, { type: 'PERFORM', caseId: 'linked-dream', teleport: true }, { type: 'RETURN_TOKEN', caseId: 'linked-dream' }, { type: 'VERIFY_DREAM', certain: true }, { type: 'MAKE_TOKEN', material: 'free' }, { type: 'TEST_TOKEN' }, { type: 'TEST_TOKEN', itemId: 'MM5-FLASH-0' }, { type: 'REFLECT', extra: true }]) reject(promoted(), c);
  });

  it('actually borrows the single cloth during preparation without opening a dream, and withdrawal never returns it', () => {
    const s = promoted(), ap = s.actionsRemaining; act(s, { type: 'OBSERVE', caseId: 'linked-dream' });
    const c = act(s, { type: 'PREPARE', caseId: 'linked-dream', method: 'ABILITY' });
    expect([s.actionsRemaining, s.mysticismMagister.practice.token, mysticismMagisterInside(s)]).toEqual([ap - 2, 'PLAYER', false]);
    expect(messages(c)).toContain('由他同意借出同一个MM5-CLOTH-1'); expect(messages(c)).toContain('40米');
    act(s, { type: 'WITHDRAW', caseId: 'linked-dream' }); expect(s.mysticismMagister.practice.token).toBe('PLAYER');
    nextWeek(s); expect(validateMysticismMagisterState(s)).toBe(true); s.actionsRemaining = 0;
    const returned = act(s, { type: 'RETURN_TOKEN' }); expect(s.mysticismMagister.practice.token).toBe('OWNER');
    expect(messages(returned)).toContain('亲手归还'); expect([s.actionsRemaining, s.progression.acting]).toEqual([0, 0]); reject(s, { type: 'RETURN_TOKEN' });
  });

  it('cannot use a returned cloth as a remote link and must really reborrow the same original', () => {
    const s = promoted(); begin(s, 'linked-dream', 'ABILITY'); act(s, { type: 'RETURN_TOKEN' });
    reject(s, { type: 'PERFORM', caseId: 'linked-dream' }); act(s, { type: 'WITHDRAW', caseId: 'linked-dream' });
    const c = act(s, { type: 'PREPARE', caseId: 'linked-dream', method: 'ABILITY' });
    expect(messages(c)).toContain('没有新造第二块衣角'); expect(s.mysticismMagister.practice.token).toBe('PLAYER'); expect(validateMysticismMagisterLife(s)).toBe(true);
  });

  it('pays four spirituality and establishes fresh consent and actual sleep before a body-stationary ritual', () => {
    const s = promoted(), old = structuredClone([s.reader, s.reasoner, s.detective, s.polymath, s.world, s.town]);
    begin(s, 'linked-dream', 'ABILITY'); nextWeek(s); const ap = s.actionsRemaining, spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'linked-dream' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 4]);
    expect(messages(c)).toContain(`第${s.week}真实周`); expect(messages(c)).toContain('他按本次约定实际入睡'); expect(messages(c)).toContain('原身体一直坐在原书房');
    expect(s.mysticismMagister.practice).toMatchObject({ token: 'PLAYER', dreamOpen: true, dreamResult: 'CLAIM', dreamAttempts: 1 });
    expect(s.mysticismMagister.cases['linked-dream']).toMatchObject({ status: 'EXAMINED', outcome: 'NONE', contactOpen: true });
    expect([s.reader, s.reasoner, s.detective, s.polymath, s.world, s.town]).toEqual(old);
    reject(s, { type: 'RETURN_TOKEN' }); reject(s, { type: 'VERIFY_DREAM' }); reject(s, { type: 'REPORT', caseId: 'linked-dream' }); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('retains failed ritual costs and an explicit zero-action dream exit, then permits an ordinary retry next real week', () => {
    const s = promoted(); begin(s, 'linked-dream', 'ABILITY'); s.actionsRemaining = 1; const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'linked-dream' }, 100);
    expect(s.mysticismMagister.practice).toMatchObject({ dreamOpen: true, dreamResult: 'NONE', dreamAttempts: 1 });
    expect([s.actionsRemaining, s.spirituality, mysticismMagisterInside(s)]).toEqual([0, spirit - 4, true]); reject(s, { type: 'RETURN_TOKEN' });
    act(s, { type: 'CLOSE', caseId: 'linked-dream' }); act(s, { type: 'RETURN_TOKEN' }); expect(mysticismMagisterInside(s)).toBe(false);
    s.actionsRemaining = 100; reject(s, { type: 'PREPARE', caseId: 'linked-dream', method: 'ORDINARY' }); nextWeek(s);
    act(s, { type: 'PREPARE', caseId: 'linked-dream', method: 'ORDINARY' }); act(s, { type: 'PERFORM', caseId: 'linked-dream' });
    expect(s.mysticismMagister.practice).toMatchObject({ token: 'PLAYER', dreamOpen: false, dreamResult: 'CLAIM', dreamAttempts: 1 });
    expect(s.spirituality).toBe(spirit - 4); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('requires separate actual awakening verification and cloth return, in either order, before the report', () => {
    for (const returnFirst of [true, false]) {
      const s = promoted(); begin(s, 'linked-dream', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'linked-dream' }); act(s, { type: 'CLOSE', caseId: 'linked-dream' });
      expect(s.mysticismMagister.practice.token).toBe('PLAYER'); const ap = s.actionsRemaining;
      if (returnFirst) { act(s, { type: 'RETURN_TOKEN' }); expect(s.mysticismMagister.practice.dreamResult).toBe('CLAIM'); }
      reject(s, { type: 'REPORT', caseId: 'linked-dream' }); const c = act(s, { type: 'VERIFY_DREAM' });
      expect(c.ctx.check).not.toHaveBeenCalled(); expect(messages(c)).toContain('醒着的他当面查看'); expect(messages(c)).toContain('第二行确为《港口纪事》');
      expect(s.actionsRemaining).toBe(ap - 1); expect(s.mysticismMagister.cases['linked-dream']!.outcome).toBe('DREAM_VERIFIED');
      if (!returnFirst) { reject(s, { type: 'REPORT', caseId: 'linked-dream' }); act(s, { type: 'RETURN_TOKEN' }); }
      act(s, { type: 'REPORT', caseId: 'linked-dream' }); reject(s, { type: 'VERIFY_DREAM' }); expect(validateMysticismMagisterState(s)).toBe(true);
    }
  });

  it('ordinary awake testimony still needs independent verification and never gives magical mastery', () => {
    const s = promoted(), old = { ...s.progression.mastery }; s.spirituality = 0; begin(s, 'linked-dream');
    const c = act(s, { type: 'PERFORM', caseId: 'linked-dream' }); expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10);
    expect(s.mysticismMagister.practice).toMatchObject({ dreamOpen: false, dreamResult: 'CLAIM', dreamAttempts: 0 }); expect(mysticismMagisterInside(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'linked-dream' }); act(s, { type: 'VERIFY_DREAM' }); act(s, { type: 'RETURN_TOKEN' });
    const report = act(s, { type: 'REPORT', caseId: 'linked-dream' }); expect(report.award).not.toHaveBeenCalled();
    expect(s.progression.mastery).toEqual(old); expect([s.spirituality, s.progression.acting]).toEqual([0, 25]);
    expect(s.seer.completedSources.filter(x => x === 'mysticism-magister-case:linked-dream')).toHaveLength(1);
  });

  it('gates each later story on the prior real report without silently completing outstanding steps', () => {
    const s = promoted(); reject(s, { type: 'OBSERVE', caseId: 'modest-craft' }); reject(s, { type: 'OBSERVE', caseId: 'careful-teaching' }); reject(s, { type: 'MAKE_TOKEN' });
    complete(s, 'linked-dream'); begin(s, 'modest-craft', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'modest-craft' }); act(s, { type: 'CLOSE', caseId: 'modest-craft' });
    reject(s, { type: 'REPORT', caseId: 'modest-craft' }); reject(s, { type: 'OBSERVE', caseId: 'careful-teaching' }); reject(s, { type: 'MAKE_TOKEN' });
    act(s, { type: 'TEST_TOKEN', itemId: s.mysticismMagister.crafts[0]!.id }); act(s, { type: 'REPORT', caseId: 'modest-craft' });
    act(s, { type: 'OBSERVE', caseId: 'careful-teaching' }); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('requires an actually learned old FLASH and exact paid resources before attempting magical manufacture', () => {
    const s = dreamed(); act(s, { type: 'OBSERVE', caseId: 'modest-craft' }); s.polymath.samples.FLASH.learnedWeek = null;
    reject(s, { type: 'PREPARE', caseId: 'modest-craft', method: 'ABILITY' });
    act(s, { type: 'PREPARE', caseId: 'modest-craft', method: 'ORDINARY' }); expect(s.mysticismMagister.practice.kitsUsed).toBe(0);
    const t = dreamed(); begin(t, 'modest-craft', 'ABILITY'); t.cash = 159; reject(t, { type: 'PERFORM', caseId: 'modest-craft' });
    t.cash = 160; t.spirituality = 3; reject(t, { type: 'PERFORM', caseId: 'modest-craft' });
    t.spirituality = 4; act(t, { type: 'PERFORM', caseId: 'modest-craft' }); expect([t.cash, t.spirituality, t.mysticismMagister.practice.kitsUsed]).toEqual([0, 0, 1]);
  });

  it('purchases and consumes a real material kit, fixes power at creation and retains the untested original after CLOSE', () => {
    const s = dreamed(), old = structuredClone(s.polymath); s.progression.mastery['reader.s5.material-imitation'] = 250;
    begin(s, 'modest-craft', 'ABILITY'); const cash = s.cash, spirit = s.spirituality, ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId: 'modest-craft' }); expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 16);
    expect([s.cash, s.spirituality, s.actionsRemaining]).toEqual([cash - 160, spirit - 4, ap - 1]);
    expect(s.mysticismMagister.crafts).toEqual([{ id: 'MM5-FLASH-1', sourceKitId: 'MM5-KIT-1', createdWeek: s.week, usedWeek: null, status: 'PLAYER', power: 0.825 }]);
    expect(s.mysticismMagister.cases['modest-craft']!.outcome).toBe('NONE'); reject(s, { type: 'TEST_TOKEN', itemId: 'MM5-FLASH-1' });
    act(s, { type: 'CLOSE', caseId: 'modest-craft' }); s.progression.mastery['reader.s5.material-imitation'] = 500;
    expect(s.mysticismMagister.crafts[0]!.power).toBe(0.825); expect(s.mysticismMagister.crafts[0]!.status).toBe('PLAYER');
    expect(s.polymath).toEqual(old); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('actually consumes the exact case item at zero AP before report and never charges creation spirituality twice', () => {
    const s = dreamed(); begin(s, 'modest-craft', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'modest-craft' }); act(s, { type: 'CLOSE', caseId: 'modest-craft' });
    const health = s.health, mind = s.mind, spirit = s.spirituality, cash = s.cash; s.actionsRemaining = 0; nextWeek(s);
    reject(s, { type: 'TEST_TOKEN', itemId: 'MM5-FLASH-2' }); const c = act(s, { type: 'TEST_TOKEN', itemId: 'MM5-FLASH-1' });
    expect(s.mysticismMagister.crafts[0]).toMatchObject({ status: 'CONSUMED', usedWeek: s.week });
    expect(s.mysticismMagister.cases['modest-craft']!.outcome).toBe('CRAFT_TESTED'); expect(c.ctx.check).not.toHaveBeenCalled();
    expect(messages(c)).toContain('三米外原私人试验凹间'); expect(messages(c)).toContain('实际启动并耗尽MM5-FLASH-1');
    expect([s.health, s.mind, s.spirituality, s.cash, s.actionsRemaining]).toEqual([health, mind, spirit, cash, 0]);
    reject(s, { type: 'TEST_TOKEN', itemId: 'MM5-FLASH-1' }); s.actionsRemaining = 1; act(s, { type: 'REPORT', caseId: 'modest-craft' });
    expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('failed magical craft burns its kit and next-week success has a matching source gap rather than a cloned free kit', () => {
    const s = dreamed(); begin(s, 'modest-craft', 'ABILITY'); const cash = s.cash, spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'modest-craft' }, 100); expect(s.mysticismMagister.crafts).toEqual([]); expect(s.mysticismMagister.practice.kitsUsed).toBe(1);
    expect([s.cash, s.spirituality]).toEqual([cash - 160, spirit - 4]); expect(mysticismMagisterInside(s)).toBe(true);
    reject(s, { type: 'TEST_TOKEN', itemId: 'MM5-FLASH-1' }); act(s, { type: 'CLOSE', caseId: 'modest-craft' });
    reject(s, { type: 'PREPARE', caseId: 'modest-craft', method: 'ABILITY' }); nextWeek(s);
    act(s, { type: 'PREPARE', caseId: 'modest-craft', method: 'ABILITY' }); act(s, { type: 'PERFORM', caseId: 'modest-craft' });
    expect(s.mysticismMagister.crafts[0]).toMatchObject({ id: 'MM5-FLASH-2', sourceKitId: 'MM5-KIT-2', status: 'PLAYER' });
    expect(s.mysticismMagister.practice.kitsUsed).toBe(2); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('ordinary paid paper fallback preserves a failed magical kit and creates no magical token or mastery', () => {
    const s = dreamed(); begin(s, 'modest-craft', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'modest-craft' }, 100); act(s, { type: 'CLOSE', caseId: 'modest-craft' }); nextWeek(s);
    act(s, { type: 'PREPARE', caseId: 'modest-craft', method: 'ORDINARY' }); const cash = s.cash, spirit = s.spirituality, old = { ...s.progression.mastery };
    act(s, { type: 'PERFORM', caseId: 'modest-craft' }); act(s, { type: 'CLOSE', caseId: 'modest-craft' }); const c = act(s, { type: 'REPORT', caseId: 'modest-craft' });
    expect([s.cash, s.spirituality, s.mysticismMagister.practice.kitsUsed]).toEqual([cash - 60, spirit, 1]);
    expect(s.mysticismMagister.crafts).toEqual([]); expect(c.award).not.toHaveBeenCalled(); expect(s.progression.mastery).toEqual(old); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('ordinary paper failure really consumes sixty pence and cannot be rerolled until a later week', () => {
    const s = dreamed(); begin(s, 'modest-craft'); s.cash = 59; reject(s, { type: 'PERFORM', caseId: 'modest-craft' }); s.cash = 60;
    act(s, { type: 'PERFORM', caseId: 'modest-craft' }, 100); expect([s.cash, s.mysticismMagister.practice.kitsUsed]).toEqual([0, 0]);
    expect(s.mysticismMagister.crafts).toEqual([]); act(s, { type: 'CLOSE', caseId: 'modest-craft' }); reject(s, { type: 'PREPARE', caseId: 'modest-craft', method: 'ORDINARY' });
    expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('optional post-report manufacture pays every attempt, retains failures and permits at most one attempt each real week', () => {
    const s = crafted(), caseItem = structuredClone(s.mysticismMagister.crafts[0]), cash = s.cash, spirit = s.spirituality, ap = s.actionsRemaining;
    act(s, { type: 'MAKE_TOKEN' }, 100); expect(s.mysticismMagister.craftAttemptWeek).toBe(s.week);
    expect([s.cash, s.spirituality, s.actionsRemaining]).toEqual([cash - 160, spirit - 4, ap - 1]);
    expect(s.mysticismMagister.crafts).toEqual([caseItem]); reject(s, { type: 'MAKE_TOKEN' }); nextWeek(s);
    act(s, { type: 'MAKE_TOKEN' }); expect(s.mysticismMagister.crafts[1]).toMatchObject({ id: 'MM5-FLASH-3', sourceKitId: 'MM5-KIT-3', status: 'PLAYER', createdWeek: s.week });
    expect(s.mysticismMagister.crafts[0]).toEqual(caseItem); expect(s.mysticismMagister.practice.kitsUsed).toBe(3);
    expect(mysticismMagisterInside(s)).toBe(false); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('post-ordinary-report manufacture is optional and blocked by unfinished preparation, events or combat', () => {
    const s = crafted('ORDINARY'); expect(s.mysticismMagister.crafts).toEqual([]); begin(s, 'careful-teaching'); reject(s, { type: 'MAKE_TOKEN' });
    act(s, { type: 'WITHDRAW', caseId: 'careful-teaching' }); s.activeEvent = { id: 'pending', instanceId: 'pending' }; reject(s, { type: 'MAKE_TOKEN' }); s.activeEvent = null;
    act(s, { type: 'MAKE_TOKEN' }); expect(s.mysticismMagister.crafts[0]).toMatchObject({ id: 'MM5-FLASH-1', status: 'PLAYER' });
    const item = structuredClone(s.mysticismMagister.crafts[0]!); act(s, { type: 'ENCOUNTER_FIGHT' }); reject(s, { type: 'TEST_TOKEN', itemId: item.id }); reject(s, { type: 'MAKE_TOKEN' });
    expect(s.mysticismMagister.crafts[0]).toEqual(item);
  });

  it('teaching actually demonstrates the player own previously learned flash and only checks the adult ordinary checklist', () => {
    const s = crafted('ORDINARY'), old = structuredClone([s.reader, s.reasoner, s.detective, s.polymath]);
    begin(s, 'careful-teaching', 'ABILITY'); const spirit = s.spirituality, c = act(s, { type: 'PERFORM', caseId: 'careful-teaching' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect(s.spirituality).toBe(spirit - 3);
    expect(messages(c)).toContain('塔莉娅本人'); expect(messages(c)).toContain('独立完成这一次普通'); expect(messages(c)).toContain('没有获得你的技能或位阶');
    expect(s.mysticismMagister.practice.teachingChecks).toBe(1); expect(s.mysticismMagister.crafts).toEqual([]);
    expect([s.reader, s.reasoner, s.detective, s.polymath]).toEqual(old); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('teaching failure spends the demonstration but grants no verification or skill, with ordinary recovery next week', () => {
    const s = crafted('ORDINARY'); begin(s, 'careful-teaching', 'ABILITY'); const spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'careful-teaching' }, 100); expect(s.spirituality).toBe(spirit - 3); expect(s.mysticismMagister.practice.teachingChecks).toBe(0);
    act(s, { type: 'CLOSE', caseId: 'careful-teaching' }); nextWeek(s); act(s, { type: 'PREPARE', caseId: 'careful-teaching', method: 'ORDINARY' });
    act(s, { type: 'PERFORM', caseId: 'careful-teaching' }); expect(s.mysticismMagister.practice.teachingChecks).toBe(1);
    expect(s.spirituality).toBe(spirit - 3); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('three ordinary reports and reflection reach acting100 with no new mastery, spiritual cost or optional crafts', () => {
    const s = promoted(), mastery = { ...s.progression.mastery }, old = structuredClone([s.reader, s.reasoner, s.detective, s.polymath, s.world, s.town]); s.spirituality = 0; const cash = s.cash;
    for (const id of MYSTICISM_MAGISTER_CASE_IDS) expect(complete(s, id).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(75); act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100);
    expect(s.progression.mastery).toEqual(mastery); expect([s.cash, s.spirituality]).toEqual([cash - 60, 0]);
    expect(s.mysticismMagister.crafts).toEqual([]); expect(s.mysticismMagister.craftAttemptWeek).toBeNull();
    expect([s.reader, s.reasoner, s.detective, s.polymath, s.world, s.town]).toEqual(old);
    expect(s.seer.completedSources.filter(x => x.startsWith('mysticism-magister-'))).toEqual(['mysticism-magister-case:linked-dream', 'mysticism-magister-case:modest-craft', 'mysticism-magister-case:careful-teaching', 'mysticism-magister-reflection']);
    for (const caseId of MYSTICISM_MAGISTER_CASE_IDS) reject(s, { type: 'REPORT', caseId }); reject(s, { type: 'REFLECT' }); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('only successful actual ability reports award existing-pool mastery once, never preparation, tests or reflection', () => {
    const s = promoted();
    for (const caseId of MYSTICISM_MAGISTER_CASE_IDS) expect(complete(s, caseId, 'ABILITY').award).toHaveBeenCalledExactlyOnceWith(`mysticism-magister-case:${caseId}`, 8);
    expect(s.progression.mastery[MYSTICISM_MAGISTER_ABILITY_IDS[0]]).toBe(24); expect(act(s, { type: 'REFLECT' }).award).not.toHaveBeenCalled();
    expect(s.progression.acting).toBe(100); expect(s.mysticismMagister.crafts[0]!.status).toBe('CONSUMED'); expect(validateMysticismMagisterState(s)).toBe(true);
  });

  it('exposes truthful detached projections for borrowed originals, unverified claims and consumed craft histories', () => {
    const s = promoted(); begin(s, 'linked-dream', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'linked-dream' });
    expect(mysticismMagisterCases(s)[0]!.result).toContain('这还不是已证实的事实'); expect(mysticismMagisterPractice(s)!.token).toContain('须实际归还');
    const p = mysticismMagisterPractice(s)!; p.token = 'invented'; expect(s.mysticismMagister.practice.token).toBe('PLAYER');
    const cases = mysticismMagisterCases(s); cases[0]!.observations.push('invented'); expect(mysticismMagisterCases(s)[0]!.observations).not.toContain('invented');
    const t = crafted(); const items = mysticismMagisterCrafts(t); expect(items[0]!.status).toContain('已实际消耗'); expect(items[0]!.source).toContain('MM5-KIT-1');
    items[0]!.source = 'invented'; expect(t.mysticismMagister.crafts[0]!.sourceKitId).toBe('MM5-KIT-1');
  });

  it('rejects forged dream facts, extra objects, wrong source pairs and duplicated rewards without throwing on malformed containers', () => {
    const s = crafted(); expect(validateMysticismMagisterLife(s)).toBe(true);
    const changes: ((t: SliceState) => void)[] = [
      t => { t.mysticismMagister.practice.token = 'PLAYER'; }, t => { t.mysticismMagister.practice.dreamOpen = true; },
      t => { t.mysticismMagister.practice.dreamResult = 'CLAIM'; }, t => { t.mysticismMagister.practice.kitsUsed = 0; },
      t => { t.mysticismMagister.practice.teachingChecks = 1; }, t => { Object.assign(t.mysticismMagister.practice, { clonedCloth: true }); },
      t => { t.mysticismMagister.crafts[0]!.sourceKitId = 'MM5-KIT-2'; }, t => { t.mysticismMagister.crafts[0]!.power = 1.01; },
      t => { t.mysticismMagister.crafts[0]!.usedWeek = null; }, t => { t.mysticismMagister.crafts[0]!.status = 'PLAYER'; t.mysticismMagister.crafts[0]!.usedWeek = null; },
      t => { t.mysticismMagister.crafts[0]!.createdWeek -= 1; }, t => { t.mysticismMagister.crafts.push(structuredClone(t.mysticismMagister.crafts[0]!)); },
      t => { t.mysticismMagister.craftAttemptWeek = t.week + 1; }, t => { t.mysticismMagister.cases['modest-craft']!.outcome = 'NONE'; },
      t => { t.mysticismMagister.cases['linked-dream']!.closes = 0; }, t => { t.seer.completedSources.push('mysticism-magister-case:modest-craft'); },
      t => { Object.assign(t.mysticismMagister, { practice: null }); }, t => { Object.assign(t.mysticismMagister, { crafts: null }); },
      t => { Object.assign(t.mysticismMagister.cases, { 'linked-dream': null }); }, t => { Object.assign(t.mysticismMagister, { craftAttemptWeek: undefined }); },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validateMysticismMagisterLife(t)).toBe(false); }
  });

  it('blocks interruptions and insufficient actions while keeping already-open ritual CLOSE available with zero resources', () => {
    for (const change of [(s: SliceState) => { s.world.city = 'TINGEN'; }, (s: SliceState) => { s.actionsRemaining = 0; }, (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.activeEvent = { id: 'pending', instanceId: 'pending' }; }]) { const s = promoted(); change(s); reject(s, { type: 'OBSERVE', caseId: 'linked-dream' }); }
    reject(polymath(), { type: 'OBSERVE', caseId: 'linked-dream' });
    const s = promoted(); begin(s, 'linked-dream', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'linked-dream' });
    s.actionsRemaining = 0; s.spirituality = 0; s.health = 0; s.mind = 0;
    const close = mysticismMagisterActions(s).find(a => a.command.type === 'CLOSE')!; expect(close.enabled).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'linked-dream' }); expect(mysticismMagisterInside(s)).toBe(false); expect(s.mysticismMagister.practice.token).toBe('PLAYER');
  });
});
