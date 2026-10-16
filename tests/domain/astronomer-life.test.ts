import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks, formatGameDate } from '../../src/domain/game-calendar.js';
import { applyAstronomerCommand, createAstronomerState, projectAstronomer, validateAstronomerState } from '../../src/domain/astronomer/index.js';
import { applyAstronomerActivity, astronomerActions, astronomerCases, astronomerInside, ASTRONOMER_ENVIRONMENT, validateAstronomerLife } from '../../src/domain/astronomer/life.js';
import { ASTRONOMER_ABILITY_IDS, ASTRONOMER_CASE_IDS, type AstronomerActivityCommand, type AstronomerCaseId } from '../../src/domain/astronomer/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[ASTRONOMER_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function artisan(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/artisan-v0760/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.astronomer = createAstronomerState();
  const nextWeek = s.artisan.promotionWeek! + 12;
  s.date = addGameWeeks(s.date, nextWeek - s.week); s.week = nextWeek;
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 50; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function promoted(): SliceState {
  const s = artisan(), c = context(s).ctx;
  applyAstronomerCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyAstronomerCommand(s, { type: 'BUY_POTION', bottleId: s.astronomer.bottles[0]!.id }, c);
  applyAstronomerCommand(s, { type: 'CONSUME', bottleId: s.astronomer.bottles[0]!.id, confirmed: true }, c);
  return s;
}
function nextWeek(s: SliceState) { s.week += 1; s.date = addGameWeeks(s.date, 1); }
function act(s: SliceState, command: AstronomerActivityCommand, roll = 1) { const c = context(s, roll); applyAstronomerActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyAstronomerActivity(s, command as AstronomerActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: AstronomerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: AstronomerCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  return act(s, { type: 'REPORT', caseId });
}
function catalogue() { const s = promoted(); complete(s, 'catalogue-check'); return s; }
function calibrated() { const s = catalogue(); complete(s, 'instrument-drift'); return s; }
function measured() { const s = calibrated(); nextWeek(s); complete(s, 'night-measurement'); return s; }
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');

describe('Astronomer original papers, real manual calibration and later night observation', () => {
  it('hides cases and exact practice before promotion, then shows only initial original state', () => {
    const before = artisan(); expect(astronomerCases(before)).toEqual([]); expect(astronomerActions(before)).toEqual([]);
    expect(projectAstronomer(before).practice).toBeNull(); expect(validateAstronomerLife(before)).toBe(true);
    const s = promoted(); expect(astronomerCases(s).map(c => c.id)).toEqual([...ASTRONOMER_CASE_IDS]);
    expect(astronomerCases(s).every(c => c.observations.length === 0)).toBe(true);
    expect(projectAstronomer(s).practice).toEqual({ instrumentOffset: 2, calibratedWeek: null, observedWeek: null, measurements: 0 });
    expect(validateAstronomerState(s)).toBe(true); expect(ASTRONOMER_ENVIRONMENT).toContain('原创G');
    expect(ASTRONOMER_ENVIRONMENT).toContain('白昼暗室不能替代');
  });

  it('rejects invented cases, methods and extra command fields without paying or rolling', () => {
    for (const command of [null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'catalogue-check', method: 'PROPHECY' }, { type: 'PERFORM', caseId: 'instrument-drift', offset: 0 }, { type: 'CLOSE', caseId: 'catalogue-check', refund: true }, { type: 'REPORT', caseId: 'night-measurement', night: true }, { type: 'REFLECT', extra: true }, { type: 'ENCOUNTER_FIGHT', weapon: 'ART6-LAMP-1' }]) reject(promoted(), command);
  });

  it('requires actual observation, closure and report before the next distinct case', () => {
    const s = promoted(); reject(s, { type: 'PERFORM', caseId: 'catalogue-check' }); reject(s, { type: 'OBSERVE', caseId: 'instrument-drift' });
    begin(s, 'catalogue-check'); reject(s, { type: 'OBSERVE', caseId: 'night-measurement' }); reject(s, { type: 'ENCOUNTER_FIGHT' });
    act(s, { type: 'PERFORM', caseId: 'catalogue-check' }); reject(s, { type: 'REPORT', caseId: 'catalogue-check' });
    act(s, { type: 'CLOSE', caseId: 'catalogue-check' }); reject(s, { type: 'OBSERVE', caseId: 'instrument-drift' });
    act(s, { type: 'REPORT', caseId: 'catalogue-check' }); act(s, { type: 'OBSERVE', caseId: 'instrument-drift' });
    expect(s.astronomer.cases['instrument-drift']!.status).toBe('OBSERVED'); expect(validateAstronomerLife(s)).toBe(true);
  });

  it('uses two original papers for a finite ordinary transcription result, without touching the instrument', () => {
    const s = promoted(); s.spirituality = 0; begin(s, 'catalogue-check'); const ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId: 'catalogue-check' });
    expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 10); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, 0]);
    expect(messages(c)).toContain('抄成18'); expect(messages(c)).toContain('底本为16'); expect(messages(c)).toContain('普通方法');
    expect(s.astronomer.cases['catalogue-check']).toMatchObject({ status: 'EXAMINED', outcome: 'CATALOGUE_CHECKED', contactOpen: true });
    expect(s.astronomer.practice).toEqual({ instrumentOffset: 2, calibratedWeek: null, observedWeek: null, measurements: 0 });
    expect(s.progression.acting).toBe(0); expect(c.award).not.toHaveBeenCalled(); expect(validateAstronomerState(s)).toBe(true);
  });

  it('pays exactly two spirituality for successful G focus and never borrows the delivered artisan lamp', () => {
    const s = promoted(), old = structuredClone([s.savant, s.archaeologist, s.appraiser, s.artisan, s.world, s.town]);
    begin(s, 'catalogue-check', 'ABILITY'); const spirit = s.spirituality, mind = s.mind;
    const c = act(s, { type: 'PERFORM', caseId: 'catalogue-check' });
    expect(c.ctx.check).toHaveBeenCalledWith('will', 14); expect([s.spirituality, s.mind]).toEqual([spirit - 2, mind]);
    expect(messages(c)).toContain('原创G短时专注');
    expect(s.artisan.workshop.lamp).toMatchObject({ id: 'ART6-LAMP-1', charges: 2, location: 'CLIENT' });
    expect([s.savant, s.archaeologist, s.appraiser, s.artisan, s.world, s.town]).toEqual(old);
  });

  it('changes the original offset only after owner-authorized successful manual calibration and retains it before report', () => {
    const s = catalogue(), original = structuredClone(s.artisan); begin(s, 'instrument-drift', 'ABILITY');
    expect(s.astronomer.practice.instrumentOffset).toBe(2); const spirit = s.spirituality, week = s.week;
    const c = act(s, { type: 'PERFORM', caseId: 'instrument-drift' });
    expect(c.ctx.check).toHaveBeenCalledWith('will', 14); expect(s.spirituality).toBe(spirit - 3);
    expect(messages(c)).toContain('梅瑞狄斯'); expect(messages(c)).toContain('当面确认'); expect(messages(c)).toContain('亲手握持普通螺丝刀');
    expect(s.astronomer.practice).toEqual({ instrumentOffset: 0, calibratedWeek: week, observedWeek: null, measurements: 0 });
    expect(s.astronomer.cases['instrument-drift']!.status).toBe('EXAMINED'); expect(s.progression.acting).toBe(25);
    reject(s, { type: 'OBSERVE', caseId: 'night-measurement' }); act(s, { type: 'CLOSE', caseId: 'instrument-drift' });
    nextWeek(s); reject(s, { type: 'OBSERVE', caseId: 'night-measurement' });
    act(s, { type: 'REPORT', caseId: 'instrument-drift' }); expect(s.astronomer.practice.calibratedWeek).toBe(week);
    expect(s.artisan).toEqual(original); expect(validateAstronomerState(s)).toBe(true);
  });

  it('ordinary failed calibration leaves offset two and costs an action, then succeeds by hand next week', () => {
    const s = catalogue(); s.spirituality = 0; begin(s, 'instrument-drift'); const ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId: 'instrument-drift' }, 100);
    expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 10); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, 0]);
    expect(s.astronomer.practice).toEqual({ instrumentOffset: 2, calibratedWeek: null, observedWeek: null, measurements: 0 });
    act(s, { type: 'CLOSE', caseId: 'instrument-drift' }); reject(s, { type: 'PREPARE', caseId: 'instrument-drift', method: 'ORDINARY' });
    nextWeek(s); act(s, { type: 'PREPARE', caseId: 'instrument-drift', method: 'ORDINARY' });
    act(s, { type: 'PERFORM', caseId: 'instrument-drift' }); expect(s.astronomer.practice).toMatchObject({ instrumentOffset: 0, calibratedWeek: s.week });
    act(s, { type: 'CLOSE', caseId: 'instrument-drift' }); expect(s.astronomer.cases['instrument-drift']!.closes).toBe(2);
    expect(validateAstronomerState(s)).toBe(true);
  });

  it('failed ability attempts keep actual costs and require both exit and a later real week', () => {
    const s = promoted(); begin(s, 'catalogue-check', 'ABILITY'); const ap = s.actionsRemaining, spirit = s.spirituality, mind = s.mind;
    act(s, { type: 'PERFORM', caseId: 'catalogue-check' }, 100);
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([ap - 1, spirit - 2, mind]);
    expect(s.astronomer.cases['catalogue-check']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', attemptWeek: s.week, contactOpen: true });
    reject(s, { type: 'PREPARE', caseId: 'catalogue-check', method: 'ORDINARY' }); reject(s, { type: 'WITHDRAW', caseId: 'catalogue-check' });
    act(s, { type: 'CLOSE', caseId: 'catalogue-check' }); reject(s, { type: 'PREPARE', caseId: 'catalogue-check', method: 'ORDINARY' });
    nextWeek(s); act(s, { type: 'PREPARE', caseId: 'catalogue-check', method: 'ORDINARY' });
    act(s, { type: 'PERFORM', caseId: 'catalogue-check' }); expect(s.spirituality).toBe(spirit - 2); expect(validateAstronomerState(s)).toBe(true);
  });

  it('cancels an unperformed preparation at zero AP and mind without refunding spent preparation', () => {
    const s = catalogue(); begin(s, 'instrument-drift', 'ABILITY'); s.spirituality = 2;
    reject(s, { type: 'PERFORM', caseId: 'instrument-drift' }); s.actionsRemaining = 0; s.mind = 0;
    const c = act(s, { type: 'WITHDRAW', caseId: 'instrument-drift' }); expect(c.ctx.check).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 2, 0]);
    expect(s.astronomer.cases['instrument-drift']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, attemptWeek: null });
    expect(s.astronomer.practice.instrumentOffset).toBe(2); reject(s, { type: 'WITHDRAW', caseId: 'instrument-drift' });
    expect(validateAstronomerLife(s)).toBe(true);
  });

  it('closes the actual scene with zero AP, spirit and mind without undoing calibration or healing', () => {
    const s = catalogue(); begin(s, 'instrument-drift'); act(s, { type: 'PERFORM', caseId: 'instrument-drift' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; const practice = structuredClone(s.astronomer.practice), week = s.week;
    const c = act(s, { type: 'CLOSE', caseId: 'instrument-drift' }); expect(c.ctx.check).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.mind, s.week]).toEqual([0, 0, 0, week]);
    expect(s.astronomer.practice).toEqual(practice); expect(astronomerInside(s)).toBe(false);
    reject(s, { type: 'CLOSE', caseId: 'instrument-drift' }); reject(s, { type: 'REPORT', caseId: 'instrument-drift' });
    expect(validateAstronomerState(s)).toBe(true);
  });

  it('cannot rush the night case in the calibration week and spends the later action on a real dated night visit', () => {
    const s = calibrated(), calibrationWeek = s.week;
    reject(s, { type: 'OBSERVE', caseId: 'night-measurement' });
    const locked = astronomerActions(s).find(a => a.command.type === 'OBSERVE' && a.command.caseId === 'night-measurement')!;
    expect(locked.enabled).toBe(false); expect(locked.reason).toContain('下一真实周');
    nextWeek(s); s.spirituality = 0; begin(s, 'night-measurement'); const ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId: 'night-measurement' });
    expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 10); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, 0]);
    expect(messages(c)).toContain(formatGameDate(s.date) + '夜间'); expect(messages(c)).toContain('1行动已包含这次夜间到访');
    expect(messages(c)).toContain('不把白昼暗室当成夜晚');
    expect(s.astronomer.practice).toEqual({ instrumentOffset: 0, calibratedWeek: calibrationWeek, observedWeek: s.week, measurements: 1 });
    expect(validateAstronomerState(s)).toBe(true);
  });

  it('a failed real night visit pays focus but retains the original calibration for next-week retry', () => {
    const s = calibrated(), calibrationWeek = s.week; nextWeek(s); begin(s, 'night-measurement', 'ABILITY');
    const spirit = s.spirituality, mind = s.mind, ap = s.actionsRemaining, failedWeek = s.week;
    const c = act(s, { type: 'PERFORM', caseId: 'night-measurement' }, 100);
    expect(c.ctx.check).toHaveBeenCalledWith('will', 14); expect([s.spirituality, s.mind, s.actionsRemaining]).toEqual([spirit - 2, mind, ap - 1]);
    expect(messages(c)).toContain('夜间到访与读数尝试确实发生');
    expect(s.astronomer.practice).toEqual({ instrumentOffset: 0, calibratedWeek: calibrationWeek, observedWeek: null, measurements: 0 });
    act(s, { type: 'CLOSE', caseId: 'night-measurement' }); reject(s, { type: 'PREPARE', caseId: 'night-measurement', method: 'ORDINARY' });
    nextWeek(s); act(s, { type: 'PREPARE', caseId: 'night-measurement', method: 'ORDINARY' }); act(s, { type: 'PERFORM', caseId: 'night-measurement' });
    expect(s.astronomer.practice).toEqual({ instrumentOffset: 0, calibratedWeek: calibrationWeek, observedWeek: failedWeek + 1, measurements: 1 });
    expect(s.spirituality).toBe(spirit - 2); expect(validateAstronomerState(s)).toBe(true);
  });

  it('all three ordinary reports award only three existing-pool eights and a final reflection reaches acting100', () => {
    const s = promoted(), old = structuredClone([s.savant, s.archaeologist, s.appraiser, s.artisan, s.world, s.town]); s.spirituality = 0;
    const first = complete(s, 'catalogue-check'), second = complete(s, 'instrument-drift'); nextWeek(s); const third = complete(s, 'night-measurement');
    for (const [c, id] of [[first, 'catalogue-check'], [second, 'instrument-drift'], [third, 'night-measurement']] as const) expect(c.award).toHaveBeenCalledExactlyOnceWith(`astronomer-case:${id}`, 8);
    expect(s.progression.acting).toBe(75); expect(s.progression.mastery[ASTRONOMER_ABILITY_IDS[0]]).toBe(24);
    const reflect = act(s, { type: 'REFLECT' }); expect(reflect.award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(100);
    expect(s.seer.completedSources.filter(x => x.startsWith('astronomer-'))).toEqual(['astronomer-case:catalogue-check', 'astronomer-case:instrument-drift', 'astronomer-case:night-measurement', 'astronomer-reflection']);
    expect([s.savant, s.archaeologist, s.appraiser, s.artisan, s.world, s.town]).toEqual(old); expect(s.spirituality).toBe(0);
    for (const caseId of ASTRONOMER_CASE_IDS) { reject(s, { type: 'PERFORM', caseId }); reject(s, { type: 'REPORT', caseId }); }
    reject(s, { type: 'REFLECT' }); expect(validateAstronomerState(s)).toBe(true);
  });

  it('the public last-action implementation holds its actual week until zero-action CLOSE', () => {
    const s = promoted(); begin(s, 'catalogue-check'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, performed = applySliceIntent(s, { type: 'ASTRONOMER', command: { type: 'PERFORM', caseId: 'catalogue-check' } });
    expect([performed.week, performed.actionsRemaining, astronomerInside(performed)]).toEqual([week, 0, true]);
    expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'WORK' })).toThrow();
    const closed = applySliceIntent(performed, { type: 'ASTRONOMER', command: { type: 'CLOSE', caseId: 'catalogue-check' } });
    expect(closed.week).toBe(week + 1); expect(astronomerInside(closed)).toBe(false); expect(closed.astronomer.cases['catalogue-check']!.closes).toBe(1);
  });

  it('projects exact current offset and real weeks without sharing mutable projection references', () => {
    const s = catalogue(); begin(s, 'instrument-drift'); act(s, { type: 'PERFORM', caseId: 'instrument-drift' });
    const p = projectAstronomer(s), cases = astronomerCases(s), calibrationWeek = s.week;
    expect(p.practice).toEqual(s.astronomer.practice); p.practice!.instrumentOffset = 2;
    expect(s.astronomer.practice.instrumentOffset).toBe(0);
    expect(cases.find(c => c.id === 'instrument-drift')!.result).toContain(`第${calibrationWeek}周已亲手校准`);
    expect(cases.find(c => c.id === 'catalogue-check')!.observations.join(' ')).toContain('当前偏移0格');
    cases[0]!.observations.push('invented'); expect(astronomerCases(s)[0]!.observations).not.toContain('invented');
    act(s, { type: 'CLOSE', caseId: 'instrument-drift' }); act(s, { type: 'REPORT', caseId: 'instrument-drift' });
    nextWeek(s); complete(s, 'night-measurement');
    expect(astronomerCases(s).find(c => c.id === 'night-measurement')!.result).toContain(`第${s.week}周已完成夜测`);
  });

  it('rejects forged offsets, same-week measurements, extra assets, case outcomes and duplicate growth sources', () => {
    const s = measured(); expect(validateAstronomerLife(s)).toBe(true);
    const changes: ((t: SliceState) => void)[] = [
      t => { t.astronomer.practice.instrumentOffset = 2; },
      t => { t.astronomer.practice.calibratedWeek! -= 1; },
      t => { t.astronomer.practice.observedWeek = t.astronomer.practice.calibratedWeek; },
      t => { t.astronomer.practice.measurements = 2; },
      t => { Object.assign(t.astronomer.practice, { clonedInstrument: true }); },
      t => { t.astronomer.cases['instrument-drift']!.outcome = 'CATALOGUE_CHECKED'; },
      t => { t.astronomer.cases['night-measurement']!.attemptWeek = t.astronomer.practice.calibratedWeek; },
      t => { t.astronomer.cases['night-measurement']!.closes = 0; },
      t => { t.astronomer.cases['night-measurement']!.contactOpen = true; },
      t => { t.seer.completedSources.push('astronomer-case:night-measurement'); },
      t => { t.progression.acting = 100; },
      t => { Object.assign(t.astronomer, { practice: null }); },
      t => { Object.assign(t.astronomer.cases, { 'night-measurement': null }); },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validateAstronomerLife(t)).toBe(false); }
    const initial = promoted(); initial.astronomer.cases['catalogue-check']!.status = 'OBSERVED'; initial.astronomer.cases['catalogue-check']!.method = 'ABILITY';
    expect(validateAstronomerLife(initial)).toBe(false);
  });

  it('blocks environmental interruptions and early encounters without silently performing any case', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.world.city = 'TINGEN'; }, s => { s.actionsRemaining = 0; }, s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.status = 'DEAD'; }, s => { s.activeEvent = { id: 'pending', instanceId: 'pending' }; }];
    for (const change of changes) { const s = promoted(); change(s); reject(s, { type: 'OBSERVE', caseId: 'catalogue-check' }); }
    reject(artisan(), { type: 'OBSERVE', caseId: 'catalogue-check' });
    const s = calibrated(); reject(s, { type: 'ENCOUNTER_TALK' }); reject(s, { type: 'ENCOUNTER_FIGHT' }); reject(s, { type: 'REFLECT' });
    nextWeek(s); complete(s, 'night-measurement');
    expect(astronomerActions(s).find(a => a.command.type === 'ENCOUNTER_TALK')!.enabled).toBe(true);
  });
});
