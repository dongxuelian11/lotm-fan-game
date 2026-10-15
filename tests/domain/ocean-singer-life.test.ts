import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { applyOceanSingerCommand, createOceanSingerState, validateOceanSingerState } from '../../src/domain/ocean-singer/index.js';
import { applyOceanSingerActivity, oceanSingerActions, oceanSingerCases, oceanSingerInside, oceanSingerPractice, OCEAN_SINGER_ENVIRONMENT, validateOceanSingerLife } from '../../src/domain/ocean-singer/life.js';
import { OCEAN_SINGER_ABILITY_IDS, OCEAN_SINGER_CASE_IDS, type OceanSingerActivityCommand, type OceanSingerCaseId } from '../../src/domain/ocean-singer/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source);
    s.progression.mastery[OCEAN_SINGER_ABILITY_IDS[0]] = Math.min(500, (s.progression.mastery[OCEAN_SINGER_ABILITY_IDS[0]] ?? 0) + amount);
  });
  return { ctx, award };
}
function windBlessed(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/wind-blessed-v0800/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.oceanSinger = createOceanSingerState();
  const week = s.windBlessed.promotionWeek! + 12; s.date = addGameWeeks(s.date, week - s.week); s.week = week;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function promoted() {
  const s = windBlessed(), ctx = context(s).ctx, bottleId = s.oceanSinger.bottles[0]!.id;
  applyOceanSingerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx);
  applyOceanSingerCommand(s, { type: 'BUY_POTION', bottleId }, ctx);
  applyOceanSingerCommand(s, { type: 'REQUEST_RITUAL' }, ctx); nextWeek(s);
  applyOceanSingerCommand(s, { type: 'GO_RITUAL' }, ctx);
  applyOceanSingerCommand(s, { type: 'ENTER_RITUAL' }, ctx);
  applyOceanSingerCommand(s, { type: 'CONSUME', bottleId, confirmed: true }, ctx);
  applyOceanSingerCommand(s, { type: 'EXIT_RITUAL' }, ctx);
  applyOceanSingerCommand(s, { type: 'RETURN_DOCK' }, ctx);
  return s;
}
function act(s: SliceState, command: OceanSingerActivityCommand, roll = 1) { const c = context(s, roll); applyOceanSingerActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyOceanSingerActivity(s, command as OceanSingerActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: OceanSingerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') { act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method }); }
function complete(s: SliceState, caseId: OceanSingerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method);
  if (caseId === 'tidal-observation') nextWeek(s);
  if (caseId === 'warned-rehearsal' && method === 'ABILITY') act(s, { type: 'MOVE_ALLY' });
  act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  if (s.oceanSinger.practice.allyPosition === 'SHELTER') act(s, { type: 'RETURN_ALLY' });
  return act(s, { type: 'REPORT', caseId });
}
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');

describe('Ocean Singer finite real companions, lightning and cross-week water flow', () => {
  it('hides practice before promotion, but still treats an unpromoted coastal ritual as inside', () => {
    const s = windBlessed(); expect(oceanSingerActions(s)).toEqual([]); expect(oceanSingerCases(s)).toEqual([]); expect(oceanSingerPractice(s)).toBeNull();
    expect(validateOceanSingerLife(s)).toBe(true);
    const ctx = context(s).ctx; applyOceanSingerCommand(s, { type: 'LEARN_GUIDANCE' }, ctx); applyOceanSingerCommand(s, { type: 'REQUEST_RITUAL' }, ctx); nextWeek(s);
    applyOceanSingerCommand(s, { type: 'GO_RITUAL' }, ctx);
    expect(oceanSingerInside(s)).toBe(true); expect(validateOceanSingerLife(s)).toBe(true);
    applyOceanSingerCommand(s, { type: 'RETURN_DOCK' }, ctx); expect(oceanSingerInside(s)).toBe(false);
    const p = promoted(); expect(oceanSingerCases(p).map(c => c.id)).toEqual([...OCEAN_SINGER_CASE_IDS]);
    expect(oceanSingerCases(p).every(c => c.observations.length === 0)).toBe(true);
    expect(p.oceanSinger.practice).toEqual({ allyPosition: 'NEAR', songOpen: false, allyAffected: false, songChecks: 0, lightningMarks: 0, tideObservedWeek: null, tideVerified: false });
    expect(validateOceanSingerState(p)).toBe(true); expect(OCEAN_SINGER_ENVIRONMENT).toContain('原创G');
  });

  it('rejects invented commands, extra movement payloads and invalid methods without mutation', () => {
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'ocean' }, { type: 'PREPARE', caseId: 'warned-rehearsal', method: 'CONTROL' }, { type: 'PERFORM', caseId: 'lightning-target', target: 'person' }, { type: 'MOVE_ALLY', caseId: 'warned-rehearsal' }, { type: 'RETURN_ALLY', teleport: true }, { type: 'CLEAR_ALLY', healing: true }, { type: 'CLOSE', caseId: 'warned-rehearsal', returnMethod: 'FLIGHT' }, { type: 'REFLECT', reward: 100 }]) reject(promoted(), command);
  });

  it('a prepared plan is outside, while real accepted eight-metre movement remains outstanding after withdrawal', () => {
    const s = promoted(); reject(s, { type: 'MOVE_ALLY' }); begin(s, 'warned-rehearsal', 'ABILITY');
    expect(oceanSingerInside(s)).toBe(false); s.actionsRemaining = 0;
    const moved = act(s, { type: 'MOVE_ALLY' }); expect(messages(moved)).toContain('她接受后沿原8米普通步道实际走到');
    expect([s.actionsRemaining, s.oceanSinger.practice.allyPosition, oceanSingerInside(s)]).toEqual([0, 'SHELTER', true]);
    reject(s, { type: 'MOVE_ALLY' }); act(s, { type: 'WITHDRAW', caseId: 'warned-rehearsal' });
    expect(s.oceanSinger.practice.allyPosition).toBe('SHELTER'); expect(oceanSingerInside(s)).toBe(true); expect(validateOceanSingerLife(s)).toBe(true);
    const returned = act(s, { type: 'RETURN_ALLY' }); expect(messages(returned)).toContain('同一原8米普通步道实际走回');
    expect([s.actionsRemaining, s.oceanSinger.practice.allyPosition, oceanSingerInside(s), s.progression.acting]).toEqual([0, 'NEAR', false, 0]);
    reject(s, { type: 'RETURN_ALLY' });
  });

  it('a near ally is actually distracted even with a passing song roll, and last-AP close and clearing stay distinct', () => {
    const s = promoted(); begin(s, 'warned-rehearsal', 'ABILITY'); s.actionsRemaining = 1;
    const before = { spirit: s.spirituality, health: s.health, mind: s.mind, mastery: { ...s.progression.mastery } }, c = act(s, { type: 'PERFORM', caseId: 'warned-rehearsal' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('will', 14);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, before.spirit - 3]);
    expect(s.oceanSinger.practice).toMatchObject({ allyPosition: 'NEAR', songOpen: true, allyAffected: true, songChecks: 1 });
    expect(s.oceanSinger.cases['warned-rehearsal']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true });
    expect(messages(c)).toContain('即使遮耳或身为同伴也未被自动排除'); reject(s, { type: 'CLEAR_ALLY' }); reject(s, { type: 'RETURN_ALLY' });
    expect(oceanSingerActions(s).find(a => a.command.type === 'CLOSE')!.enabled).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'warned-rehearsal' }); expect(s.oceanSinger.practice.allyAffected).toBe(true); expect(oceanSingerInside(s)).toBe(true);
    expect(oceanSingerActions(s).find(a => a.command.type === 'CLEAR_ALLY')!.enabled).toBe(true);
    act(s, { type: 'CLEAR_ALLY' }); expect(oceanSingerInside(s)).toBe(false);
    expect([s.actionsRemaining, s.health, s.mind, s.progression.mastery, s.progression.acting]).toEqual([0, before.health, before.mind, before.mastery, 0]);
    reject(s, { type: 'CLEAR_ALLY' }); s.actionsRemaining = 10; reject(s, { type: 'PREPARE', caseId: 'warned-rehearsal', method: 'ORDINARY' });
    nextWeek(s); act(s, { type: 'PREPARE', caseId: 'warned-rehearsal', method: 'ORDINARY' }); expect(validateOceanSingerState(s)).toBe(true);
  });

  it('sheltered song success still needs separate stopping and actual return before its one reward', () => {
    const s = promoted(); begin(s, 'warned-rehearsal', 'ABILITY'); act(s, { type: 'MOVE_ALLY' });
    s.actionsRemaining = 1; const spirit = s.spirituality; act(s, { type: 'PERFORM', caseId: 'warned-rehearsal' });
    expect(s.oceanSinger.cases['warned-rehearsal']).toMatchObject({ status: 'EXAMINED', outcome: 'ALLY_SHELTERED', contactOpen: true });
    expect(s.oceanSinger.practice.allyAffected).toBe(false); reject(s, { type: 'RETURN_ALLY' });
    act(s, { type: 'CLOSE', caseId: 'warned-rehearsal' }); expect(s.oceanSinger.practice.allyPosition).toBe('SHELTER'); expect(oceanSingerInside(s)).toBe(true);
    expect(oceanSingerActions(s).find(a => a.command.type === 'RETURN_ALLY')!.enabled).toBe(true);
    act(s, { type: 'RETURN_ALLY' }); expect(oceanSingerInside(s)).toBe(false);
    expect([s.actionsRemaining, s.spirituality]).toEqual([0, spirit - 3]); s.actionsRemaining = 1;
    const report = act(s, { type: 'REPORT', caseId: 'warned-rehearsal' }); expect(report.award).toHaveBeenCalledExactlyOnceWith('ocean-singer-case:warned-rehearsal', 8);
    expect(s.progression.acting).toBe(25); reject(s, { type: 'REPORT', caseId: 'warned-rehearsal' }); expect(validateOceanSingerState(s)).toBe(true);
  });

  it('a failed sheltered short song retains cost, location and zero-AP exits before a next-week retry', () => {
    const s = promoted(); begin(s, 'warned-rehearsal', 'ABILITY'); act(s, { type: 'MOVE_ALLY' }); s.actionsRemaining = 1;
    const spirit = s.spirituality; act(s, { type: 'PERFORM', caseId: 'warned-rehearsal' }, 100);
    expect(s.oceanSinger.practice).toMatchObject({ allyPosition: 'SHELTER', allyAffected: false, songOpen: true, songChecks: 1 });
    expect(s.oceanSinger.cases['warned-rehearsal']!.status).toBe('OBSERVED');
    act(s, { type: 'CLOSE', caseId: 'warned-rehearsal' }); act(s, { type: 'RETURN_ALLY' });
    expect([s.actionsRemaining, s.spirituality, s.progression.acting]).toEqual([0, spirit - 3, 0]); expect(validateOceanSingerState(s)).toBe(true);
  });

  it('one low lightning attempt costs four, can fail, and grants exactly one fixed-target mark on later success', () => {
    const s = promoted(); begin(s, 'lightning-target', 'ABILITY'); s.spirituality = 3; reject(s, { type: 'PERFORM', caseId: 'lightning-target' });
    s.spirituality = 8; s.actionsRemaining = 1; const failed = act(s, { type: 'PERFORM', caseId: 'lightning-target' }, 100);
    expect(failed.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect([s.spirituality, s.actionsRemaining, s.oceanSinger.practice.lightningMarks]).toEqual([4, 0, 0]);
    act(s, { type: 'CLOSE', caseId: 'lightning-target' }); s.actionsRemaining = 10;
    reject(s, { type: 'PREPARE', caseId: 'lightning-target', method: 'ABILITY' }); nextWeek(s);
    act(s, { type: 'PREPARE', caseId: 'lightning-target', method: 'ABILITY' }); const passed = act(s, { type: 'PERFORM', caseId: 'lightning-target' });
    expect(messages(passed)).toContain('同一块3米外原湿炭靶'); expect(s.oceanSinger.practice.lightningMarks).toBe(1); expect(s.spirituality).toBe(0);
    act(s, { type: 'CLOSE', caseId: 'lightning-target' }); act(s, { type: 'REPORT', caseId: 'lightning-target' });
    reject(s, { type: 'PERFORM', caseId: 'lightning-target' }); expect(validateOceanSingerState(s)).toBe(true);
  });

  it('records the real tide observation week, waits without open contact, then actually uses inherited water flow', () => {
    const s = promoted(), inherited = structuredClone([s.sailor, s.rager, s.navigator, s.windBlessed]); begin(s, 'tidal-observation', 'ABILITY');
    const observed = s.week, spirit = s.spirituality; expect(s.oceanSinger.practice.tideObservedWeek).toBe(observed); expect(oceanSingerInside(s)).toBe(false);
    reject(s, { type: 'PERFORM', caseId: 'tidal-observation' });
    const waiting = oceanSingerActions(s).find(a => a.command.type === 'PERFORM')!; expect(waiting.enabled).toBe(false); expect(waiting.reason).toContain('之后的真实周');
    expect(oceanSingerPractice(s)!.history.join(' ')).toContain('仍须等待之后真实周');
    nextWeek(s); s.actionsRemaining = 1; const c = act(s, { type: 'PERFORM', caseId: 'tidal-observation' });
    expect(c.ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 14); expect([s.actionsRemaining, s.spirituality]).toEqual([0, spirit - 2]);
    expect(messages(c)).toContain(`第${observed}周的原观察`); expect(messages(c)).toContain('拨动一股有限小水流'); expect(messages(c)).toContain('没有潜水');
    expect(s.oceanSinger.practice).toMatchObject({ tideObservedWeek: observed, tideVerified: true });
    act(s, { type: 'CLOSE', caseId: 'tidal-observation' }); expect(oceanSingerInside(s)).toBe(false);
    expect([s.sailor, s.rager, s.navigator, s.windBlessed]).toEqual(inherited); s.actionsRemaining = 1;
    act(s, { type: 'REPORT', caseId: 'tidal-observation' }); expect(validateOceanSingerState(s)).toBe(true);
  });

  it('all three actual ordinary reports and reflection reach peaceful100 with no magic mastery or ability effects', () => {
    const s = promoted(), mastery = { ...s.progression.mastery }, ap = s.actionsRemaining; s.spirituality = 0;
    for (const caseId of OCEAN_SINGER_CASE_IDS) {
      const c = complete(s, caseId); expect(c.award).not.toHaveBeenCalled();
    }
    expect(s.progression.acting).toBe(75); act(s, { type: 'REFLECT' });
    expect([s.progression.acting, s.actionsRemaining, s.spirituality]).toEqual([100, ap - 13, 0]);
    expect(s.progression.mastery).toEqual(mastery); expect(s.oceanSinger.practice).toMatchObject({ allyPosition: 'NEAR', songOpen: false, allyAffected: false, songChecks: 0, lightningMarks: 0, tideVerified: true });
    expect(s.oceanSinger.encounter.status).toBe('AVAILABLE'); expect(validateOceanSingerState(s)).toBe(true); reject(s, { type: 'REFLECT' });
    expect(OCEAN_SINGER_CASE_IDS.map(id => s.seer.completedSources.filter(source => source === `ocean-singer-case:${id}`).length)).toEqual([1, 1, 1]);
  });

  it('ordinary contact can end and the companion can return independently without silently closing the other step', () => {
    const s = promoted(); begin(s, 'warned-rehearsal'); act(s, { type: 'MOVE_ALLY' }); act(s, { type: 'PERFORM', caseId: 'warned-rehearsal' });
    act(s, { type: 'RETURN_ALLY' }); expect(s.oceanSinger.cases['warned-rehearsal']!.contactOpen).toBe(true); expect(oceanSingerInside(s)).toBe(true);
    reject(s, { type: 'REPORT', caseId: 'warned-rehearsal' }); act(s, { type: 'CLOSE', caseId: 'warned-rehearsal' });
    const c = act(s, { type: 'REPORT', caseId: 'warned-rehearsal' }); expect(c.award).not.toHaveBeenCalled(); expect(validateOceanSingerState(s)).toBe(true);
  });

  it('rejects forged success, cleared open song, impossible marks and same-week tidal comparison in saved life state', () => {
    const initial = promoted();
    for (const edit of [(s: SliceState) => { s.oceanSinger.practice.songChecks = 1; }, (s: SliceState) => { s.oceanSinger.practice.lightningMarks = 1; }, (s: SliceState) => { s.oceanSinger.practice.tideVerified = true; }, (s: SliceState) => { s.oceanSinger.practice.allyPosition = 'SHELTER'; }, (s: SliceState) => { s.oceanSinger.practice.tideObservedWeek = s.week; }]) {
      const s = structuredClone(initial); edit(s); expect(validateOceanSingerLife(s)).toBe(false);
    }
    begin(initial, 'warned-rehearsal', 'ABILITY'); act(initial, { type: 'PERFORM', caseId: 'warned-rehearsal' });
    const cleared = structuredClone(initial); cleared.oceanSinger.practice.allyAffected = false; expect(validateOceanSingerLife(cleared)).toBe(false);
    const moved = structuredClone(initial); moved.oceanSinger.practice.allyPosition = 'SHELTER'; expect(validateOceanSingerLife(moved)).toBe(false);
    const tide = promoted(); complete(tide, 'tidal-observation'); tide.oceanSinger.practice.tideObservedWeek = tide.oceanSinger.cases['tidal-observation']!.attemptWeek;
    expect(validateOceanSingerLife(tide)).toBe(false);
  });
});
