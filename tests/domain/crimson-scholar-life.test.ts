import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applySliceIntent } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks, formatGameDate } from '../../src/domain/game-calendar.js';
import { applyCrimsonScholarCommand, createCrimsonScholarState, projectCrimsonScholar, validateCrimsonScholarState } from '../../src/domain/crimson-scholar/index.js';
import { applyCrimsonScholarActivity, crimsonScholarActions, crimsonScholarCases, crimsonScholarInside, CRIMSON_SCHOLAR_ENVIRONMENT, validateCrimsonScholarLife } from '../../src/domain/crimson-scholar/life.js';
import { CRIMSON_SCHOLAR_ABILITY_IDS, CRIMSON_SCHOLAR_CASE_IDS, type CrimsonScholarActivityCommand, type CrimsonScholarCaseId } from '../../src/domain/crimson-scholar/types.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';

function context(s: SliceState, roll = 1) {
  const ctx: SeerContext = {
    roll: vi.fn(min => min), note: vi.fn(),
    check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })),
  };
  const award = vi.fn((source: string, amount: 5 | 8 | 25) => {
    if (s.seer.completedSources.includes(source)) return;
    s.seer.completedSources.push(source); s.progression.mastery[CRIMSON_SCHOLAR_ABILITY_IDS[0]]! += amount;
  });
  return { ctx, award };
}
function atWeek(s: SliceState, week: number) { s.date = addGameWeeks(s.date, week - s.week); s.week = week; }
function professor(): SliceState {
  const old = JSON.parse(readFileSync('tests/fixtures/potion-professor-v0770/natural.json', 'utf8')).final;
  const s = migrateSliceState(old); s.crimsonScholar = createCrimsonScholarState();
  atWeek(s, Math.max(s.week, s.potionProfessor.promotionWeek! + 12));
  s.activeEvent = null; s.eventQueue = []; s.pulse = 'NONE'; s.world.city = 'BACKLUND';
  s.cash = 30000; s.actionsRemaining = 100; s.weeklyBudget = 100; s.health = 100; s.mind = 100;
  s.spirituality = 80; s.seer.pollution = 0; s.character.coreStats.will = 26;
  return s;
}
function promoted(closeRitual = true): SliceState {
  const s = professor(), c = context(s).ctx;
  applyCrimsonScholarCommand(s, { type: 'LEARN_GUIDANCE' }, c);
  applyCrimsonScholarCommand(s, { type: 'BUY_POTION', bottleId: s.crimsonScholar.bottles[0]!.id }, c);
  applyCrimsonScholarCommand(s, { type: 'REQUEST_RITUAL' }, c);
  atWeek(s, s.crimsonScholar.ritual.announcements.find(event => event.id === s.crimsonScholar.ritual.reservedEventId)!.week);
  applyCrimsonScholarCommand(s, { type: 'BEGIN_RITUAL' }, c);
  applyCrimsonScholarCommand(s, { type: 'CONSUME', bottleId: s.crimsonScholar.bottles[0]!.id, confirmed: true }, c);
  if (closeRitual) applyCrimsonScholarCommand(s, { type: 'END_RITUAL' }, c);
  return s;
}
function act(s: SliceState, command: CrimsonScholarActivityCommand, roll = 1) { const c = context(s, roll); applyCrimsonScholarActivity(s, command, c.ctx, c.award); return c; }
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), c = context(s);
  expect(() => applyCrimsonScholarActivity(s, command as CrimsonScholarActivityCommand, c.ctx, c.award)).toThrow();
  expect(s).toEqual(before); expect(c.ctx.check).not.toHaveBeenCalled(); expect(c.award).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: CrimsonScholarCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method });
}
function complete(s: SliceState, caseId: CrimsonScholarCaseId, method: 'ABILITY' | 'ORDINARY' = 'ORDINARY') {
  begin(s, caseId, method); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'CLOSE', caseId });
  if (caseId === 'moonlight-route') act(s, { type: 'RETURN' });
  return act(s, { type: 'REPORT', caseId });
}
function readyRoute() { const s = promoted(); complete(s, 'full-moon'); complete(s, 'hidden-moon'); return s; }
const messages = (c: ReturnType<typeof context>) => vi.mocked(c.ctx.note).mock.calls.map(call => call.join(' ')).join(' ');
const oldAssets = (s: SliceState) => structuredClone([s.apothecary, s.tamer, s.vampire, s.potionProfessor, s.world, s.town]);

describe('Crimson Scholar finite original moon fields, actual body travel and bounded reassembly', () => {
  it('hides new cases before promotion and projects exact independent current practice', () => {
    const before = professor(); expect(crimsonScholarCases(before)).toEqual([]); expect(crimsonScholarActions(before)).toEqual([]);
    expect(projectCrimsonScholar(before).practice).toBeNull(); expect(validateCrimsonScholarLife(before)).toBe(true);
    const s = promoted(), p = projectCrimsonScholar(s);
    expect(crimsonScholarCases(s).map(c => c.id)).toEqual([...CRIMSON_SCHOLAR_CASE_IDS]);
    expect(crimsonScholarCases(s).every(c => c.observations.length === 0)).toBe(true);
    expect(p.practice).toEqual({ field: 'NONE', location: 'START', outboundTrips: 0, returns: 0, reassemblies: 0, reassembledWeek: null });
    p.practice!.field = 'FULL'; expect(s.crimsonScholar.practice.field).toBe('NONE');
    expect(CRIMSON_SCHOLAR_ENVIRONMENT).toContain('前两项使用同一原5米区'); expect(CRIMSON_SCHOLAR_ENVIRONMENT).toContain('另一个原10米');
    expect(CRIMSON_SCHOLAR_ENVIRONMENT).toContain('不保证突破任意封锁'); expect(validateCrimsonScholarState(s)).toBe(true);
  });

  it('keeps the actual promotion visit inside and rejects every life shortcut until END_RITUAL', () => {
    const s = promoted(false); expect(crimsonScholarInside(s)).toBe(true);
    for (const c of [{ type: 'OBSERVE', caseId: 'full-moon' }, { type: 'CLOSE', caseId: 'full-moon' }, { type: 'RETURN' }, { type: 'REASSEMBLE' }, { type: 'ENCOUNTER_TALK' }]) reject(s, c);
    expect(crimsonScholarActions(s).every(a => !a.enabled)).toBe(true);
    applyCrimsonScholarCommand(s, { type: 'END_RITUAL' }, context(s).ctx);
    expect(crimsonScholarInside(s)).toBe(false); act(s, { type: 'OBSERVE', caseId: 'full-moon' });
    expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('rejects invented command fields, destinations, passengers and methods without mutation or RNG', () => {
    for (const c of [null, {}, { type: 'OBSERVE', caseId: 'invented' }, { type: 'PREPARE', caseId: 'full-moon', method: 'GLOBAL_MOON' }, { type: 'PERFORM', caseId: 'moonlight-route', destination: 'CITY' }, { type: 'RETURN', caseId: 'moonlight-route' }, { type: 'RETURN', passenger: '伊莲' }, { type: 'REASSEMBLE', target: '伊莲' }, { type: 'CLOSE', caseId: 'full-moon', heal: true }, { type: 'REFLECT', extra: true }, { type: 'ENCOUNTER_FIGHT', moonPaper: true }]) reject(promoted(), c);
  });

  it('requires real observation, preparation, closure and the two original reports before route work', () => {
    const s = promoted(); reject(s, { type: 'PERFORM', caseId: 'full-moon' }); reject(s, { type: 'OBSERVE', caseId: 'hidden-moon' });
    begin(s, 'full-moon'); reject(s, { type: 'OBSERVE', caseId: 'moonlight-route' }); reject(s, { type: 'ENCOUNTER_FIGHT' });
    act(s, { type: 'PERFORM', caseId: 'full-moon' }); reject(s, { type: 'REPORT', caseId: 'full-moon' });
    act(s, { type: 'CLOSE', caseId: 'full-moon' }); reject(s, { type: 'OBSERVE', caseId: 'hidden-moon' });
    act(s, { type: 'REPORT', caseId: 'full-moon' }); reject(s, { type: 'OBSERVE', caseId: 'moonlight-route' });
    complete(s, 'hidden-moon'); act(s, { type: 'OBSERVE', caseId: 'moonlight-route' });
    expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('pays for a real dated regional full moon without changing world moon, old blood or potions', () => {
    const s = promoted(), old = oldAssets(s), date = structuredClone(s.date); begin(s, 'full-moon', 'ABILITY');
    const ap = s.actionsRemaining, spirit = s.spirituality, c = act(s, { type: 'PERFORM', caseId: 'full-moon' });
    expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 14); expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.crimsonScholar.practice).toMatchObject({ field: 'FULL', location: 'START', outboundTrips: 0 });
    expect(s.crimsonScholar.cases['full-moon']).toMatchObject({ status: 'EXAMINED', outcome: 'FULL_MOON_CHECKED', contactOpen: true });
    expect(messages(c)).toContain(formatGameDate(s.date) + '夜间'); expect(messages(c)).toContain('原5米区'); expect(messages(c)).toContain('成年伊莲');
    expect(s.date).toEqual(date); expect(oldAssets(s)).toEqual(old); expect(c.award).not.toHaveBeenCalled(); expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('separates actual hidden-moon ability from ordinary original-shade comparisons', () => {
    for (const method of ['ABILITY', 'ORDINARY'] as const) {
      const s = promoted(); complete(s, 'full-moon'); begin(s, 'hidden-moon', method);
      const old = oldAssets(s), spirit = s.spirituality, c = act(s, { type: 'PERFORM', caseId: 'hidden-moon' });
      expect(s.spirituality).toBe(spirit - (method === 'ABILITY' ? 3 : 0)); expect(s.crimsonScholar.practice.field).toBe(method === 'ABILITY' ? 'HIDDEN' : 'NONE');
      expect(c.ctx.check).toHaveBeenCalledWith('knowledge', method === 'ABILITY' ? 14 : 10);
      expect(messages(c)).toContain(method === 'ABILITY' ? '原5米区隐月' : '没有非凡隐月或月场');
      if (method === 'ORDINARY') expect(messages(c)).toContain('板始终留在原处并归她');
      expect(oldAssets(s)).toEqual(old); reject(s, { type: 'REASSEMBLE' });
      act(s, { type: 'CLOSE', caseId: 'hidden-moon' }); expect(s.crimsonScholar.practice.field).toBe('NONE'); expect(validateCrimsonScholarLife(s)).toBe(true);
    }
  });

  it('failed abilities retain actual field and cost until closure, then require a later real week', () => {
    const s = promoted(); begin(s, 'full-moon', 'ABILITY'); const ap = s.actionsRemaining, spirit = s.spirituality;
    act(s, { type: 'PERFORM', caseId: 'full-moon' }, 100);
    expect([s.actionsRemaining, s.spirituality]).toEqual([ap - 1, spirit - 3]);
    expect(s.crimsonScholar.cases['full-moon']).toMatchObject({ status: 'OBSERVED', outcome: 'NONE', contactOpen: true, attemptWeek: s.week });
    expect(s.crimsonScholar.practice.field).toBe('FULL'); reject(s, { type: 'WITHDRAW', caseId: 'full-moon' }); reject(s, { type: 'REPORT', caseId: 'full-moon' });
    act(s, { type: 'CLOSE', caseId: 'full-moon' }); reject(s, { type: 'PREPARE', caseId: 'full-moon', method: 'ORDINARY' });
    atWeek(s, s.week + 1); act(s, { type: 'PREPARE', caseId: 'full-moon', method: 'ORDINARY' }); act(s, { type: 'PERFORM', caseId: 'full-moon' });
    expect(s.crimsonScholar.practice.field).toBe('NONE'); expect(s.spirituality).toBe(spirit - 3); expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('cancels unperformed preparation at zero AP or mind and never refunds costs or performs an effect', () => {
    const s = promoted(); begin(s, 'full-moon', 'ABILITY'); s.spirituality = 2;
    reject(s, { type: 'PERFORM', caseId: 'full-moon' }); s.actionsRemaining = 0; s.mind = 0;
    const c = act(s, { type: 'WITHDRAW', caseId: 'full-moon' }); expect(c.ctx.check).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.mind]).toEqual([0, 2, 0]);
    expect(s.crimsonScholar.cases['full-moon']).toMatchObject({ status: 'OBSERVED', method: null, withdrawals: 1, attemptWeek: null });
    expect(s.crimsonScholar.practice.field).toBe('NONE'); reject(s, { type: 'WITHDRAW', caseId: 'full-moon' }); expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('successful moonlight step actually reaches END in the separate original10m area and CLOSE leaves it there', () => {
    const s = readyRoute(); begin(s, 'moonlight-route', 'ABILITY'); const spirit = s.spirituality;
    const c = act(s, { type: 'PERFORM', caseId: 'moonlight-route' }); expect(s.spirituality).toBe(spirit - 6);
    expect(messages(c)).toContain('原10米通路区'); expect(messages(c)).toContain('3用于');
    expect(s.crimsonScholar.practice).toMatchObject({ field: 'FULL', location: 'END', outboundTrips: 1, returns: 0 });
    reject(s, { type: 'RETURN' }); reject(s, { type: 'REPORT', caseId: 'moonlight-route' });
    act(s, { type: 'CLOSE', caseId: 'moonlight-route' });
    expect(s.crimsonScholar.practice).toMatchObject({ field: 'NONE', location: 'END', outboundTrips: 1, returns: 0 });
    expect(crimsonScholarInside(s)).toBe(true); expect(projectCrimsonScholar(s).insideCase).toBe(true); reject(s, { type: 'REPORT', caseId: 'moonlight-route' });
    expect(crimsonScholarCases(s).find(p => p.id === 'moonlight-route')!.contactOpen).toContain('仍在END');
    act(s, { type: 'RETURN' }); expect(s.crimsonScholar.practice).toMatchObject({ location: 'START', outboundTrips: 1, returns: 1 });
    expect(crimsonScholarInside(s)).toBe(false); reject(s, { type: 'RETURN' }); act(s, { type: 'REPORT', caseId: 'moonlight-route' }); expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('failed moonlight step spends all six spirit but keeps the actual body at START with no fake trip', () => {
    const s = readyRoute(); begin(s, 'moonlight-route', 'ABILITY'); const spirit = s.spirituality, ap = s.actionsRemaining;
    const c = act(s, { type: 'PERFORM', caseId: 'moonlight-route' }, 100);
    expect([s.spirituality, s.actionsRemaining]).toEqual([spirit - 6, ap - 1]); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 14);
    expect(s.crimsonScholar.practice).toMatchObject({ field: 'FULL', location: 'START', outboundTrips: 0, returns: 0 });
    expect(s.crimsonScholar.cases['moonlight-route']!.outcome).toBe('NONE'); reject(s, { type: 'RETURN' });
    act(s, { type: 'CLOSE', caseId: 'moonlight-route' }); expect(crimsonScholarInside(s)).toBe(false); reject(s, { type: 'RETURN' });
    expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('ordinary unsuccessful route comparison still walks to END and counts every real out-and-back on retry', () => {
    const s = readyRoute(); s.spirituality = 0; begin(s, 'moonlight-route');
    const c = act(s, { type: 'PERFORM', caseId: 'moonlight-route' }, 100); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 10);
    expect(s.crimsonScholar.practice).toMatchObject({ field: 'NONE', location: 'END', outboundTrips: 1, returns: 0 });
    expect(s.crimsonScholar.cases['moonlight-route']!.status).toBe('OBSERVED'); expect(validateCrimsonScholarLife(s)).toBe(true);
    act(s, { type: 'CLOSE', caseId: 'moonlight-route' }); reject(s, { type: 'PREPARE', caseId: 'moonlight-route', method: 'ORDINARY' });
    act(s, { type: 'RETURN' }); reject(s, { type: 'PREPARE', caseId: 'moonlight-route', method: 'ORDINARY' });
    atWeek(s, s.week + 1); act(s, { type: 'PREPARE', caseId: 'moonlight-route', method: 'ORDINARY' }); act(s, { type: 'PERFORM', caseId: 'moonlight-route' });
    expect(s.crimsonScholar.practice).toMatchObject({ field: 'NONE', location: 'END', outboundTrips: 2, returns: 1 });
    act(s, { type: 'CLOSE', caseId: 'moonlight-route' }); act(s, { type: 'RETURN' }); act(s, { type: 'REPORT', caseId: 'moonlight-route' });
    expect(s.crimsonScholar.practice.returns).toBe(2); expect(s.spirituality).toBe(0); expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('optional successful reassembly heals at most10 only at its current body position and preserves every old resource', () => {
    for (const health of [74, 95]) {
      const s = readyRoute(); begin(s, 'moonlight-route', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'moonlight-route' }); s.health = health;
      s.injuries = [{ id: 'existing-wound', severity: 'HEAVY', acquiredRevision: 1, treatedRevision: null }];
      const old = oldAssets(s), injuries = structuredClone(s.injuries), mind = s.mind, spirit = s.spirituality, ap = s.actionsRemaining, acting = s.progression.acting;
      const c = act(s, { type: 'REASSEMBLE' }); expect(c.ctx.check).toHaveBeenCalledWith('knowledge', 14);
      expect([s.health, s.spirituality, s.actionsRemaining, s.mind, s.progression.acting]).toEqual([Math.min(100, health + 10), spirit - 8, ap - 1, mind, acting]);
      expect(s.crimsonScholar.practice).toMatchObject({ field: 'FULL', location: 'END', outboundTrips: 1, returns: 0, reassemblies: 1, reassembledWeek: s.week });
      expect(s.injuries).toEqual(injuries); expect(oldAssets(s)).toEqual(old); expect(c.award).not.toHaveBeenCalled(); reject(s, { type: 'REASSEMBLE' }); expect(validateCrimsonScholarLife(s)).toBe(true);
    }
  });

  it('reassembly needs current FULL, living injury, resources and one real weekly attempt even on failure', () => {
    const fresh = promoted(); fresh.health = 80; reject(fresh, { type: 'REASSEMBLE' });
    for (const change of [ (s: SliceState) => { s.health = 100; }, (s: SliceState) => { s.health = 0; }, (s: SliceState) => { s.status = 'DEAD'; }, (s: SliceState) => { s.spirituality = 7; }, (s: SliceState) => { s.actionsRemaining = 0; }, (s: SliceState) => { s.mind = 0; }, (s: SliceState) => { s.activeEvent = { id: 'pending', instanceId: 'pending' }; } ]) {
      const s = promoted(); begin(s, 'full-moon', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'full-moon' }); s.health = 80; change(s); reject(s, { type: 'REASSEMBLE' });
    }
    const s = promoted(); begin(s, 'full-moon', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'full-moon' }, 100); s.health = 80;
    const spirit = s.spirituality, ap = s.actionsRemaining; act(s, { type: 'REASSEMBLE' }, 100);
    expect([s.health, s.spirituality, s.actionsRemaining]).toEqual([80, spirit - 8, ap - 1]);
    expect(s.crimsonScholar.practice).toMatchObject({ reassemblies: 1, reassembledWeek: s.week }); reject(s, { type: 'REASSEMBLE' });
    act(s, { type: 'CLOSE', caseId: 'full-moon' }); atWeek(s, s.week + 1);
    act(s, { type: 'PREPARE', caseId: 'full-moon', method: 'ABILITY' }); act(s, { type: 'PERFORM', caseId: 'full-moon' }); act(s, { type: 'REASSEMBLE' });
    expect(s.health).toBe(90); expect(s.crimsonScholar.practice.reassemblies).toBe(2); expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('zero-action closure and return remain usable with no AP, spirit or mind and do not heal or refund', () => {
    const s = readyRoute(); begin(s, 'moonlight-route', 'ABILITY'); act(s, { type: 'PERFORM', caseId: 'moonlight-route' });
    s.actionsRemaining = 0; s.spirituality = 0; s.mind = 0; s.health = 70; const week = s.week;
    const closed = act(s, { type: 'CLOSE', caseId: 'moonlight-route' }); expect(closed.ctx.check).not.toHaveBeenCalled();
    expect(s.crimsonScholar.practice).toMatchObject({ field: 'NONE', location: 'END' });
    const returned = act(s, { type: 'RETURN' }); expect(returned.ctx.check).not.toHaveBeenCalled();
    expect([s.actionsRemaining, s.spirituality, s.mind, s.health, s.week]).toEqual([0, 0, 0, 70, week]);
    expect(crimsonScholarInside(s)).toBe(false); reject(s, { type: 'REPORT', caseId: 'moonlight-route' }); expect(validateCrimsonScholarLife(s)).toBe(true);
  });

  it('all three ordinary reports plus reflection reach100 without reassembly, self-harm or free old supplies', () => {
    const s = promoted(), old = oldAssets(s); s.spirituality = 0;
    for (const caseId of CRIMSON_SCHOLAR_CASE_IDS) {
      const c = complete(s, caseId); expect(c.award).toHaveBeenCalledExactlyOnceWith(`crimson-scholar-case:${caseId}`, 8);
      expect(crimsonScholarCases(s).find(p => p.id === caseId)!.result).toContain('没有');
    }
    expect(s.progression.acting).toBe(75); expect(s.progression.mastery[CRIMSON_SCHOLAR_ABILITY_IDS[0]]).toBe(24);
    const c = act(s, { type: 'REFLECT' }); expect(c.award).not.toHaveBeenCalled(); expect(s.progression.acting).toBe(100);
    expect(s.crimsonScholar.practice).toEqual({ field: 'NONE', location: 'START', outboundTrips: 1, returns: 1, reassemblies: 0, reassembledWeek: null });
    expect([s.health, s.spirituality]).toEqual([100, 0]); expect(oldAssets(s)).toEqual(old);
    for (const caseId of CRIMSON_SCHOLAR_CASE_IDS) reject(s, { type: 'REPORT', caseId }); reject(s, { type: 'REFLECT' }); expect(validateCrimsonScholarState(s)).toBe(true);
  });

  it('public last-AP route holds the same real week through CLOSE until the body actually RETURNs', () => {
    const s = readyRoute(); begin(s, 'moonlight-route'); s.actionsRemaining = 1; s.weeklyBudget = 3; s.debts = [];
    const week = s.week, performed = applySliceIntent(s, { type: 'CRIMSON_SCHOLAR', command: { type: 'PERFORM', caseId: 'moonlight-route' } });
    expect([performed.week, performed.actionsRemaining, crimsonScholarInside(performed)]).toEqual([week, 0, true]);
    expect(performed.crimsonScholar.practice.location).toBe('END'); expect(() => applySliceIntent(performed, { type: 'ACTION', action: 'WORK' })).toThrow();
    const closed = applySliceIntent(performed, { type: 'CRIMSON_SCHOLAR', command: { type: 'CLOSE', caseId: 'moonlight-route' } });
    expect([closed.week, closed.actionsRemaining, crimsonScholarInside(closed)]).toEqual([week, 0, true]);
    expect(() => applySliceIntent(closed, { type: 'ACTION', action: 'REST' })).toThrow();
    const returned = applySliceIntent(closed, { type: 'CRIMSON_SCHOLAR', command: { type: 'RETURN' } });
    expect(returned.week).toBe(week + 1); expect(crimsonScholarInside(returned)).toBe(false); expect(returned.crimsonScholar.practice).toMatchObject({ field: 'NONE', location: 'START', outboundTrips: 1, returns: 1 });
  });

  it('rejects forged field, movement, chronology, reassembly and duplicate growth while retaining real ordinary-failure travel', () => {
    const s = readyRoute(); complete(s, 'moonlight-route'); expect(validateCrimsonScholarLife(s)).toBe(true);
    const changes: ((t: SliceState) => void)[] = [
      t => { t.crimsonScholar.practice.field = 'FULL'; }, t => { t.crimsonScholar.practice.location = 'END'; },
      t => { t.crimsonScholar.practice.outboundTrips = 2; }, t => { t.crimsonScholar.practice.returns = 0; },
      t => { t.crimsonScholar.practice.reassemblies = 1; t.crimsonScholar.practice.reassembledWeek = t.week; },
      t => { t.crimsonScholar.practice.reassembledWeek = t.week; }, t => { Object.assign(t.crimsonScholar.practice, { passenger: '伊莲' }); },
      t => { t.crimsonScholar.cases['moonlight-route']!.outcome = 'FULL_MOON_CHECKED'; },
      t => { t.crimsonScholar.cases['moonlight-route']!.closes = 0; }, t => { t.crimsonScholar.cases['moonlight-route']!.contactOpen = true; },
      t => { t.crimsonScholar.cases['hidden-moon']!.attemptWeek! -= 1; },
      t => { t.seer.completedSources.push('crimson-scholar-case:moonlight-route'); }, t => { t.progression.acting = 100; },
      t => { Object.assign(t.crimsonScholar, { practice: null }); }, t => { Object.assign(t.crimsonScholar.cases, { 'full-moon': null }); },
    ];
    for (const change of changes) { const t = structuredClone(s); change(t); expect(validateCrimsonScholarLife(t)).toBe(false); }
    const initial = promoted(); initial.crimsonScholar.cases['full-moon']!.status = 'OBSERVED'; initial.crimsonScholar.cases['full-moon']!.method = 'ABILITY'; expect(validateCrimsonScholarLife(initial)).toBe(false);
  });

  it('blocks unavailable worlds, exhausted actors and unfinished encounters and copies public case observations', () => {
    const changes: ((s: SliceState) => void)[] = [s => { s.world.city = 'TINGEN'; }, s => { s.actionsRemaining = 0; }, s => { s.health = 0; }, s => { s.mind = 0; }, s => { s.status = 'DEAD'; }, s => { s.activeEvent = { id: 'pending', instanceId: 'pending' }; }];
    for (const change of changes) { const s = promoted(); change(s); reject(s, { type: 'OBSERVE', caseId: 'full-moon' }); }
    reject(professor(), { type: 'OBSERVE', caseId: 'full-moon' });
    const s = readyRoute(); reject(s, { type: 'ENCOUNTER_TALK' }); reject(s, { type: 'ENCOUNTER_FIGHT' }); reject(s, { type: 'REFLECT' });
    begin(s, 'moonlight-route'); const cases = crimsonScholarCases(s); cases[2]!.observations.push('invented'); expect(crimsonScholarCases(s)[2]!.observations).not.toContain('invented');
    expect(cases[2]!.story).toContain('不把前两项5米区暗中放大'); expect(cases[2]!.observations.join(' ')).toContain('不保证逃离任意陷阱');
  });
});
