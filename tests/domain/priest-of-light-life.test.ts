import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyPriestOfLightCommand, createPriestOfLightState, validatePriestOfLightState } from '../../src/domain/priest-of-light/index.js';
import { applyPriestOfLightActivity, isPriestOfLightActivity, priestOfLightActions, priestOfLightCases, priestOfLightInside, priestOfLightPractice, projectPriestOfLightPractice, PRIEST_OF_LIGHT_ENVIRONMENT, validatePriestOfLightActivityCommand, validatePriestOfLightLife } from '../../src/domain/priest-of-light/life.js';
import { PRIEST_OF_LIGHT_ABILITY_IDS, PRIEST_OF_LIGHT_CASE_IDS, type PriestOfLightActivityCommand, type PriestOfLightCaseId } from '../../src/domain/priest-of-light/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[PRIEST_OF_LIGHT_ABILITY_IDS[0]] = Math.min(500, (s.progression.mastery[PRIEST_OF_LIGHT_ABILITY_IDS[0]] ?? 0) + amount);
  });
  return { ctx, award };
}
function notary(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/notary-v0810/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.priestOfLight = createPriestOfLightState();
  const week = s.notary.promotionWeek! + 12; s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function promoted() {
  const s = notary(), ctx = context(s).ctx, batchId = s.priestOfLight.batches[0]!.id;
  applyPriestOfLightCommand(s, { type: 'LEARN_FORMULA' }, ctx);
  applyPriestOfLightCommand(s, { type: 'BUY_MATERIALS', batchId }, ctx);
  applyPriestOfLightCommand(s, { type: 'BREW', batchId }, ctx);
  applyPriestOfLightCommand(s, { type: 'REQUEST_RITUAL' }, ctx); nextWeek(s);
  applyPriestOfLightCommand(s, { type: 'GO_RITUAL' }, ctx);
  applyPriestOfLightCommand(s, { type: 'BEGIN_RITUAL' }, ctx);
  applyPriestOfLightCommand(s, { type: 'CONSUME', bottleId: s.priestOfLight.bottles[0]!.id, confirmed: true }, ctx);
  applyPriestOfLightCommand(s, { type: 'END_RITUAL' }, ctx);
  applyPriestOfLightCommand(s, { type: 'RETURN_GUIDE' }, ctx);
  return s;
}
function act(s: SliceState, command: PriestOfLightActivityCommand, roll = 1) { const c = context(s, roll); applyPriestOfLightActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyPriestOfLightActivity(s, command as PriestOfLightActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: PriestOfLightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') { act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: PriestOfLightCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method);
  if (caseId === 'mixed-company' && method === 'ABILITY') act(s, { type: 'MOVE_LANTERN' });
  act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  if (s.priestOfLight.practice.lanternPosition === 'SHELTER') act(s, { type: 'RETURN_LANTERN' });
  return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const resources = (s: SliceState) => ({ health: s.health, mind: s.mind, spirit: s.spirituality, actions: s.actionsRemaining, cash: s.cash, mastery: { ...s.progression.mastery }, acting: s.progression.acting });

describe('Priest of Light finite original light, slate and friendly spirit', () => {
  it('hides life until actual promotion while an unpromoted ritual away is still inside', () => {
    const s = notary(); expect(priestOfLightActions(s)).toEqual([]); expect(priestOfLightCases(s)).toEqual([]); expect(priestOfLightPractice(s)).toBeNull();
    expect(validatePriestOfLightLife(s)).toBe(true);
    const ctx = context(s).ctx; applyPriestOfLightCommand(s, { type: 'LEARN_FORMULA' }, ctx); applyPriestOfLightCommand(s, { type: 'REQUEST_RITUAL' }, ctx); nextWeek(s);
    applyPriestOfLightCommand(s, { type: 'GO_RITUAL' }, ctx);
    expect(priestOfLightInside(s)).toBe(true); expect(validatePriestOfLightLife(s)).toBe(true);
    applyPriestOfLightCommand(s, { type: 'BEGIN_RITUAL' }, ctx); expect(priestOfLightInside(s)).toBe(true);
    s.actionsRemaining = 0; applyPriestOfLightCommand(s, { type: 'END_RITUAL' }, ctx); expect(priestOfLightInside(s)).toBe(true);
    applyPriestOfLightCommand(s, { type: 'RETURN_GUIDE' }, ctx); expect(priestOfLightInside(s)).toBe(false);
    const p = promoted(); expect(priestOfLightCases(p).map(c => c.id)).toEqual([...PRIEST_OF_LIGHT_CASE_IDS]);
    expect(priestOfLightCases(p).every(c => c.observations.length === 0)).toBe(true);
    expect(p.priestOfLight.practice).toEqual({ lanternPosition: 'NEAR', auraOpen: false, spiritDistressed: false, lightChecks: 0, trace: 'PRESENT', auraChecks: 0 });
    expect(projectPriestOfLightPractice(p)).toEqual(priestOfLightPractice(p)); expect(validatePriestOfLightState(p)).toBe(true);
    expect(PRIEST_OF_LIGHT_ENVIRONMENT).toContain('原创G'); expect(PRIEST_OF_LIGHT_ENVIRONMENT).toContain('友善灵体不自动免疫');
  });

  it('rejects invented targets, extra movement payloads and invalid methods atomically', () => {
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'purify-everyone' }, { type: 'PREPARE', caseId: 'mixed-company', method: 'IMMUNE_FRIENDS' }, { type: 'PERFORM', caseId: 'bounded-cleansing', target: 'person' }, { type: 'MOVE_LANTERN', caseId: 'mixed-company' }, { type: 'RETURN_LANTERN', teleport: true }, { type: 'CLEAR_SPIRIT', healing: true }, { type: 'CLOSE', caseId: 'mixed-company', returnMethod: 'FLIGHT' }, { type: 'REFLECT', reward: 100 }]) {
      expect(validatePriestOfLightActivityCommand(command)).toBe(false); reject(promoted(), command);
    }
    expect(isPriestOfLightActivity({ type: 'MOVE_LANTERN' })).toBe(true);
    expect(isPriestOfLightActivity({ type: 'END_RITUAL' })).toBe(false);
  });

  it('leaves prepared plans outside but preserves actual owner-led movement after a zero-action withdrawal', () => {
    const s = promoted(); reject(s, { type: 'MOVE_LANTERN' }); begin(s, 'mixed-company', 'ABILITY');
    expect(priestOfLightInside(s)).toBe(false); s.actionsRemaining = 0; const before = resources(s);
    const moved = act(s, { type: 'MOVE_LANTERN' }); expect(messages(moved)).toContain('亲自沿原8米普通步道'); expect(messages(moved)).toContain('其中真实灵体');
    expect(messages(moved)).toContain('放稳后自己沿原路走回2米近处');
    expect([s.priestOfLight.practice.lanternPosition, priestOfLightInside(s)]).toEqual(['SHELTER', true]); expect(validatePriestOfLightLife(s)).toBe(true);
    reject(s, { type: 'MOVE_LANTERN' }); reject(s, { type: 'OBSERVE', caseId: 'darkened-walk' });
    act(s, { type: 'WITHDRAW', caseId: 'mixed-company' });
    expect(s.priestOfLight.practice.lanternPosition).toBe('SHELTER'); expect(priestOfLightInside(s)).toBe(true); expect(validatePriestOfLightLife(s)).toBe(true);
    const returned = act(s, { type: 'RETURN_LANTERN' }); expect(messages(returned)).toContain('同一原8米普通步道'); expect(messages(returned)).toContain('同一原灯与栖灯搬回');
    expect(priestOfLightInside(s)).toBe(false); expect(resources(s)).toEqual(before); reject(s, { type: 'RETURN_LANTERN' });
  });

  it('actually distresses a nearby friendly spirit despite a passing roll and requires separate zero-AP stop and recovery', () => {
    const s = promoted(); begin(s, 'mixed-company', 'ABILITY'); s.actionsRemaining = 1;
    const before = resources(s), c = act(s, { type: 'PERFORM', caseId: 'mixed-company' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, before.spirit - 3]);
    expect(s.priestOfLight.practice).toMatchObject({ lanternPosition: 'NEAR', auraOpen: true, spiritDistressed: true, auraChecks: 1 });
    expect(s.priestOfLight.cases['mixed-company']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(messages(c)).toContain('友善身份没有让灵体自动免疫'); expect(messages(c)).toContain('没有死亡或被净化抹除');
    expect(validatePriestOfLightLife(s)).toBe(true); reject(s, { type: 'CLEAR_SPIRIT' }); reject(s, { type: 'RETURN_LANTERN' }); reject(s, { type: 'REPORT', caseId: 'mixed-company' });
    expect(priestOfLightActions(s).find(a => a.command.type === 'CLOSE')!.enabled).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'mixed-company' }); expect(s.priestOfLight.practice.spiritDistressed).toBe(true); expect(priestOfLightInside(s)).toBe(true);
    expect(priestOfLightActions(s).find(a => a.command.type === 'CLEAR_SPIRIT')!.enabled).toBe(true);
    const cleared = act(s, { type: 'CLEAR_SPIRIT' }); expect(messages(cleared)).toContain('普通安抚并实际等待'); expect(priestOfLightInside(s)).toBe(false);
    expect(resources(s)).toEqual({ ...before, spirit: before.spirit - 3, actions: 0 }); expect(validatePriestOfLightLife(s)).toBe(true);
    reject(s, { type: 'CLEAR_SPIRIT' }); s.actionsRemaining = 10; reject(s, { type: 'PREPARE', caseId: 'mixed-company', method: 'ORDINARY' });
    nextWeek(s); act(s, { type: 'PREPARE', caseId: 'mixed-company', method: 'ORDINARY' }); expect(validatePriestOfLightLife(s)).toBe(true);
  });

  it('requires real shelter, explicit stopping and actual return before the one successful aura reward', () => {
    const s = promoted(); begin(s, 'mixed-company', 'ABILITY'); act(s, { type: 'MOVE_LANTERN' }); s.actionsRemaining = 1;
    const before = resources(s); act(s, { type: 'PERFORM', caseId: 'mixed-company' });
    expect(s.priestOfLight.cases['mixed-company']).toMatchObject({ status: 'EXAMINED', outcome: 'SPIRIT_SHELTERED', contactOpen: true });
    expect(s.priestOfLight.practice).toMatchObject({ auraOpen: true, spiritDistressed: false, lanternPosition: 'SHELTER' }); expect(validatePriestOfLightLife(s)).toBe(true);
    reject(s, { type: 'RETURN_LANTERN' }); reject(s, { type: 'REPORT', caseId: 'mixed-company' });
    act(s, { type: 'CLOSE', caseId: 'mixed-company' }); expect(s.priestOfLight.practice.lanternPosition).toBe('SHELTER'); expect(priestOfLightInside(s)).toBe(true);
    expect(priestOfLightActions(s).find(a => a.command.type === 'RETURN_LANTERN')!.enabled).toBe(true);
    act(s, { type: 'RETURN_LANTERN' }); expect(priestOfLightInside(s)).toBe(false); expect(resources(s)).toEqual({ ...before, actions: 0, spirit: before.spirit - 3 });
    s.actionsRemaining = 1; const report = act(s, { type: 'REPORT', caseId: 'mixed-company' });
    expect(report.award).toHaveBeenCalledExactlyOnceWith('priest-of-light-case:mixed-company', 8); expect(s.progression.acting).toBe(25);
    expect(messages(report)).toContain('普通成年协作者没有因身份或争执被判为邪恶'); reject(s, { type: 'REPORT', caseId: 'mixed-company' });
    expect(validatePriestOfLightState(s)).toBe(true);
  });

  it('keeps failed sheltered aura costs and real locations until the free stop and return', () => {
    const s = promoted(); begin(s, 'mixed-company', 'ABILITY'); act(s, { type: 'MOVE_LANTERN' }); s.actionsRemaining = 1;
    const spirit = s.spirituality; act(s, { type: 'PERFORM', caseId: 'mixed-company' }, 100);
    expect(s.priestOfLight.practice).toMatchObject({ lanternPosition: 'SHELTER', spiritDistressed: false, auraOpen: true, auraChecks: 1 });
    expect(s.priestOfLight.cases['mixed-company'].status).toBe('OBSERVED'); expect(validatePriestOfLightLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'mixed-company' }); act(s, { type: 'RETURN_LANTERN' });
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([0, spirit - 3, 0]); expect(validatePriestOfLightState(s)).toBe(true);
    s.actionsRemaining = 10; reject(s, { type: 'PREPARE', caseId: 'mixed-company', method: 'ABILITY' }); nextWeek(s);
    act(s, { type: 'PREPARE', caseId: 'mixed-company', method: 'ABILITY' }); act(s, { type: 'MOVE_LANTERN' }); act(s, { type: 'PERFORM', caseId: 'mixed-company' });
    expect(s.priestOfLight.practice.auraChecks).toBe(2); expect(validatePriestOfLightLife(s)).toBe(true);
  });

  it('pays one spirituality for actual limited light, retaining failure and never healing or creating a domain', () => {
    const s = promoted(); begin(s, 'darkened-walk', 'ABILITY'); s.health = 72; s.mind = 81; s.spirituality = 0;
    reject(s, { type: 'PERFORM', caseId: 'darkened-walk' }); s.spirituality = 2; s.actionsRemaining = 1;
    const failed = act(s, { type: 'PERFORM', caseId: 'darkened-walk' }, 100);
    expect(failed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14);
    expect([s.spirituality, s.actionsRemaining, s.priestOfLight.practice.lightChecks, s.health, s.mind]).toEqual([1, 0, 1, 72, 81]);
    expect(s.priestOfLight.cases['darkened-walk']).toMatchObject({ status: 'OBSERVED', contactOpen: true });
    act(s, { type: 'CLOSE', caseId: 'darkened-walk' }); s.actionsRemaining = 10; reject(s, { type: 'PREPARE', caseId: 'darkened-walk', method: 'ABILITY' }); nextWeek(s);
    act(s, { type: 'PREPARE', caseId: 'darkened-walk', method: 'ABILITY' }); const passed = act(s, { type: 'PERFORM', caseId: 'darkened-walk' });
    expect(messages(passed)).toContain('核对夜间视物'); expect(messages(passed)).toContain('不生成无暗领域');
    expect(s.priestOfLight.practice.lightChecks).toBe(2); expect(s.spirituality).toBe(0);
    act(s, { type: 'CLOSE', caseId: 'darkened-walk' }); const report = act(s, { type: 'REPORT', caseId: 'darkened-walk' });
    expect(report.award).toHaveBeenCalledExactlyOnceWith('priest-of-light-case:darkened-walk', 8); expect([s.health, s.mind]).toEqual([72, 81]); expect(validatePriestOfLightState(s)).toBe(true);
  });

  it('reduces the same original finite slate trace only once and cannot refill it after success', () => {
    const s = promoted(); begin(s, 'bounded-cleansing', 'ABILITY'); s.spirituality = 1; reject(s, { type: 'PERFORM', caseId: 'bounded-cleansing' });
    s.spirituality = 4; s.actionsRemaining = 1; const failed = act(s, { type: 'PERFORM', caseId: 'bounded-cleansing' }, 100);
    expect(failed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect([s.spirituality, s.actionsRemaining, s.priestOfLight.practice.trace]).toEqual([2, 0, 'PRESENT']);
    act(s, { type: 'CLOSE', caseId: 'bounded-cleansing' }); s.actionsRemaining = 10;
    reject(s, { type: 'PREPARE', caseId: 'bounded-cleansing', method: 'ABILITY' }); nextWeek(s);
    act(s, { type: 'PREPARE', caseId: 'bounded-cleansing', method: 'ABILITY' }); const passed = act(s, { type: 'PERFORM', caseId: 'bounded-cleansing' });
    expect(messages(passed)).toContain('同一原石板SLATE'); expect(s.priestOfLight.practice.trace).toBe('REDUCED'); expect(s.spirituality).toBe(0);
    reject(s, { type: 'PERFORM', caseId: 'bounded-cleansing' }); reject(s, { type: 'REPORT', caseId: 'bounded-cleansing' });
    act(s, { type: 'CLOSE', caseId: 'bounded-cleansing' }); act(s, { type: 'REPORT', caseId: 'bounded-cleansing' });
    reject(s, { type: 'OBSERVE', caseId: 'bounded-cleansing' }); reject(s, { type: 'PREPARE', caseId: 'bounded-cleansing', method: 'ORDINARY' });
    expect(priestOfLightPractice(s)!.history.join(' ')).toContain('减弱一次'); expect(validatePriestOfLightState(s)).toBe(true);
    const forged = structuredClone(s); forged.priestOfLight.practice.trace = 'PRESENT'; expect(validatePriestOfLightLife(forged)).toBe(false);
  });

  it('ordinary sealing really contains and removes the original slate without claiming ability cleansing', () => {
    const s = promoted(), mastery = { ...s.progression.mastery }; s.spirituality = 0;
    const c = complete(s, 'bounded-cleansing'); expect(c.award).not.toHaveBeenCalled();
    expect(s.priestOfLight.practice.trace).toBe('SEALED'); expect(s.priestOfLight.cases['bounded-cleansing'].outcome).toBe('TRACE_SEALED');
    expect(messages(c)).toContain('由导师移回原保管处'); expect(messages(c)).toContain('原残留只是被普通封存，未被能力净化');
    expect(s.progression.mastery).toEqual(mastery); expect(validatePriestOfLightState(s)).toBe(true);
    const forged = structuredClone(s); forged.priestOfLight.practice.trace = 'REDUCED'; expect(validatePriestOfLightLife(forged)).toBe(false);
  });

  it('all three actual ordinary reports and reflection reach peaceful100 with no ability costs or rewards', () => {
    const s = promoted(), mastery = { ...s.progression.mastery }, inherited = structuredClone([s.bard, s.lightprayer, s.sunpriest, s.notary]), ap = s.actionsRemaining;
    s.spirituality = 0;
    for (const caseId of PRIEST_OF_LIGHT_CASE_IDS) { const c = complete(s, caseId); expect(c.award).not.toHaveBeenCalled(); }
    expect(s.progression.acting).toBe(75); act(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.actionsRemaining, s.spirituality]).toEqual([100, ap - 13, 0]); expect(s.progression.mastery).toEqual(mastery);
    expect(s.priestOfLight.practice).toEqual({ lanternPosition: 'NEAR', auraOpen: false, spiritDistressed: false, lightChecks: 0, trace: 'SEALED', auraChecks: 0 });
    expect([s.bard, s.lightprayer, s.sunpriest, s.notary]).toEqual(inherited); expect(s.priestOfLight.encounter.status).toBe('AVAILABLE');
    expect(validatePriestOfLightState(s)).toBe(true); reject(s, { type: 'REFLECT' });
    expect(PRIEST_OF_LIGHT_CASE_IDS.map(id => s.seer.completedSources.filter(source => source === `priest-of-light-case:${id}`).length)).toEqual([1, 1, 1]);
  });

  it('ordinary contact and owner-led return remain separate zero-action steps', () => {
    const s = promoted(); begin(s, 'mixed-company'); act(s, { type: 'MOVE_LANTERN' });
    const before = s.spirituality, c = act(s, { type: 'PERFORM', caseId: 'mixed-company' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 10); expect(s.spirituality).toBe(before);
    expect(s.priestOfLight.practice).toMatchObject({ auraOpen: false, auraChecks: 0, spiritDistressed: false });
    s.actionsRemaining = 0; act(s, { type: 'RETURN_LANTERN' });
    expect(s.priestOfLight.cases['mixed-company'].contactOpen).toBe(true); expect(priestOfLightInside(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'mixed-company' }); act(s, { type: 'CLOSE', caseId: 'mixed-company' });
    expect(priestOfLightInside(s)).toBe(false); expect(s.actionsRemaining).toBe(0); expect(validatePriestOfLightLife(s)).toBe(true);
    s.actionsRemaining = 1; const report = act(s, { type: 'REPORT', caseId: 'mixed-company' }); expect(report.award).not.toHaveBeenCalled();
    expect(validatePriestOfLightState(s)).toBe(true);
  });

  it('rejects forged light and aura counters, original trace changes, fake movement and extra practice fields', () => {
    const initial = promoted();
    for (const edit of [(s: SliceState) => { s.priestOfLight.practice.lightChecks = 1; }, (s: SliceState) => { s.priestOfLight.practice.auraChecks = 1; }, (s: SliceState) => { s.priestOfLight.practice.trace = 'REDUCED'; }, (s: SliceState) => { s.priestOfLight.practice.trace = 'SEALED'; }, (s: SliceState) => { s.priestOfLight.practice.lanternPosition = 'SHELTER'; }, (s: SliceState) => { s.priestOfLight.practice.spiritDistressed = true; }, (s: SliceState) => { s.priestOfLight.practice.auraOpen = true; }, (s: SliceState) => { Object.assign(s.priestOfLight.practice, { friendlyImmune: true }); }]) {
      const s = structuredClone(initial); edit(s); expect(validatePriestOfLightLife(s)).toBe(false);
    }
    act(initial, { type: 'OBSERVE', caseId: 'mixed-company' });
    const unmoved = structuredClone(initial); unmoved.priestOfLight.practice.lanternPosition = 'SHELTER'; expect(validatePriestOfLightLife(unmoved)).toBe(false);
    act(initial, { type: 'PREPARE', caseId: 'mixed-company', method: 'ABILITY' }); act(initial, { type: 'PERFORM', caseId: 'mixed-company' });
    const cleared = structuredClone(initial); cleared.priestOfLight.practice.spiritDistressed = false; expect(validatePriestOfLightLife(cleared)).toBe(false);
    const moved = structuredClone(initial); moved.priestOfLight.practice.lanternPosition = 'SHELTER'; expect(validatePriestOfLightLife(moved)).toBe(false);
    const closed = structuredClone(initial); closed.priestOfLight.practice.auraOpen = false; expect(validatePriestOfLightLife(closed)).toBe(false);
  });

  it('rejects forged success, duplicate report sources and acting without actual reports', () => {
    const s = promoted(); complete(s, 'darkened-walk'); expect(validatePriestOfLightLife(s)).toBe(true);
    const duplicate = structuredClone(s); duplicate.seer.completedSources.push('priest-of-light-case:darkened-walk'); expect(validatePriestOfLightLife(duplicate)).toBe(false);
    const wrong = structuredClone(s); wrong.priestOfLight.cases['darkened-walk'].outcome = 'LIGHT_CHECKED'; expect(validatePriestOfLightLife(wrong)).toBe(false);
    const noClose = structuredClone(s); noClose.priestOfLight.cases['darkened-walk'].closes = 0; expect(validatePriestOfLightLife(noClose)).toBe(false);
    const extraActing = structuredClone(s); extraActing.progression.acting = 100; expect(validatePriestOfLightLife(extraActing)).toBe(false);
    const falseReflection = structuredClone(s); falseReflection.priestOfLight.reflected = true; falseReflection.seer.completedSources.push('priest-of-light-reflection'); expect(validatePriestOfLightLife(falseReflection)).toBe(false);
  });
});
