import { describe, expect, it } from 'vitest';
import type { SliceState } from '../../src/domain/slice/types.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { applyWeatherWarlockCommand } from '../../src/domain/weather-warlock/index.js';
import {
  applyWeatherWarlockActivity, blockWeatherWarlockTeamInvite, createWeatherWarlockLifeState,
  hasWeatherWarlockLifeLock, projectWeatherWarlockLife, validateWeatherWarlockLife,
  WEATHER_WARLOCK_CASE_IDS, WEATHER_WARLOCK_MEMBER_IDS,
  type WeatherWarlockActivityCommand, type WeatherWarlockCaseId,
} from '../../src/domain/weather-warlock/life.js';
import { weatherContext, weatherLifeReady, weatherSnapshot } from './weather-warlock-test-fixture.js';

function act(s: SliceState, command: WeatherWarlockActivityCommand, roll = 1) {
  const ctx = weatherContext(s, roll); applyWeatherWarlockActivity(s, command, ctx);
  expect(validateWeatherWarlockLife(s)).toBe(true); return ctx;
}
function reject(s: SliceState, command: unknown) {
  const before = structuredClone(s), ctx = weatherContext(s);
  expect(() => applyWeatherWarlockActivity(s, command as WeatherWarlockActivityCommand, ctx)).toThrow();
  expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled();
}
function begin(s: SliceState, caseId: WeatherWarlockCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  act(s, { type: 'OBSERVE', caseId }); act(s, { type: 'PREPARE', caseId, method });
  act(s, { type: 'INVITE_TEAM', caseId }); act(s, { type: 'PERFORM', caseId }); act(s, { type: 'WARN_READ_EXIT' });
}
function close(s: SliceState, caseId: WeatherWarlockCaseId) {
  act(s, { type: 'RETURN_NEAR' }); act(s, { type: 'RETURN_TOOL' }); act(s, { type: 'DISMISS_TEAM' }); act(s, { type: 'CLOSE', caseId });
}
function ordinary(s: SliceState, caseId: WeatherWarlockCaseId) {
  begin(s, caseId, 'ORDINARY'); act(s, { type: 'ORDINARY_WORK' }); close(s, caseId); act(s, { type: 'REPORT', caseId });
}
/** Explicit paid existing team-rest command and true dated week, rather than silently restoring test energy. */
function recoverNextWeek(s: SliceState) {
  applyWeatherWarlockCommand(s, { type: 'REST_TEAM' }, weatherContext(s));
  s.week++; s.date = addGameWeeks(s.date, 1);
  applyWeatherWarlockCommand(s, { type: 'RECOVER_TEAM' }, weatherContext(s));
}
function reach(s: SliceState, target: WeatherWarlockCaseId) {
  for (const id of WEATHER_WARLOCK_CASE_IDS) { if (id === target) break; ordinary(s, id); recoverNextWeek(s); }
}
const totalWater = (s: SliceState) => {
  const p = s.weatherWarlock.life.practice;
  return p.reservoir.remainingMl + p.tray.liquidMl + p.tray.iceMl + p.basin.waterMl + p.fixture.wetMl + p.airborneMl + p.groundMl;
};
const caseReceipt = (s: SliceState, id: WeatherWarlockCaseId) => s.weatherWarlock.life.cases[id].attempts[0]!;

describe('Weather Warlock original five-person finite-water life practice', () => {
  it('starts from real natural promotion with the same original roster and all older objects untouched', () => {
    const s = weatherLifeReady(), original = weatherSnapshot('promoted');
    expect(s.ironBloodKnight).toEqual(original.ironBloodKnight); expect(s.warBishop).toEqual(original.warBishop);
    expect(s.weatherWarlock.life).toEqual(createWeatherWarlockLifeState()); expect(totalWater(s)).toBe(6000);
    expect(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true);
    expect(validateWeatherWarlockLife(s)).toBe(true); expect(validateWeatherWarlockLife(JSON.parse(stableStringify(s)))).toBe(true);
  });

  it('charges the one actual invitation on the original five references without copying 25 bystanders', () => {
    const s = weatherLifeReady(), original = s.ironBloodKnight.team.members[0]!, before = structuredClone(s.ironBloodKnight), ap = s.actionsRemaining, cash = s.cash;
    act(s, { type: 'OBSERVE', caseId: 'fog-corridor' }); act(s, { type: 'PREPARE', caseId: 'fog-corridor', method: 'ABILITY' });
    expect(original.present).toBe(false); reject(s, { type: 'PERFORM', caseId: 'fog-corridor' });
    act(s, { type: 'INVITE_TEAM', caseId: 'fog-corridor' });
    expect([s.actionsRemaining, s.cash]).toEqual([ap - 3, cash - 40]); expect(s.ironBloodKnight.team.members[0]).toBe(original);
    expect(s.ironBloodKnight.team.members.filter(m => m.present).map(m => m.id)).toEqual([...WEATHER_WARLOCK_MEMBER_IDS]);
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual(before.team.members.slice(0, 5).map(m => m.energy - 1));
    expect(s.ironBloodKnight.team.members.slice(5)).toEqual(before.team.members.slice(5));
    expect(s.ironBloodKnight.life).toEqual(before.life); expect(s.ironBloodKnight.encounter).toEqual(before.encounter);
    expect(totalWater(s)).toBe(6000); reject(s, { type: 'INVITE_TEAM', caseId: 'fog-corridor' });
  });

  it.each(['refusal', 'health', 'energy', 'already-away'] as const)('rejects %s before spending invitation AP or cash', condition => {
    const s = weatherLifeReady(); act(s, { type: 'OBSERVE', caseId: 'fog-corridor' }); act(s, { type: 'PREPARE', caseId: 'fog-corridor', method: 'ABILITY' });
    const m = s.ironBloodKnight.team.members[0]!;
    if (condition === 'refusal') m.willing = false;
    if (condition === 'health') m.health = 49;
    if (condition === 'energy') m.energy = 5;
    if (condition === 'already-away') { m.present = true; m.location = 'YARD'; }
    reject(s, { type: 'INVITE_TEAM', caseId: 'fog-corridor' });
  });

  it('requires prior warning and exposes owner plus every original body to the same fog before genuine cleanup', () => {
    const s = weatherLifeReady(), original = structuredClone(s.warBishop), energy = s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy), spirit = s.spirituality;
    act(s, { type: 'OBSERVE', caseId: 'fog-corridor' }); act(s, { type: 'PREPARE', caseId: 'fog-corridor', method: 'ABILITY' });
    act(s, { type: 'INVITE_TEAM', caseId: 'fog-corridor' }); act(s, { type: 'PERFORM', caseId: 'fog-corridor' });
    reject(s, { type: 'CAST_WEATHER' }); act(s, { type: 'WARN_READ_EXIT' });
    const ctx = act(s, { type: 'CAST_WEATHER' }); expect(ctx.check).toHaveBeenCalledExactlyOnceWith('knowledge', 16);
    expect(s.weatherWarlock.life.practice.weather).toEqual({ effect: 'FOG', remainingSeconds: 20, visibilityMetres: 1, affectedBodyIds: ['PLAYER', ...WEATHER_WARLOCK_MEMBER_IDS] });
    expect(s.weatherWarlock.life.practice).toMatchObject({ airborneMl: 500, reservoir: { remainingMl: 5500 } });
    expect(caseReceipt(s, 'fog-corridor').evidence.result).toBe('NONE');
    for (const type of ['CAST_WEATHER', 'WARN_READ_EXIT', 'RETURN_NEAR', 'RETURN_TOOL', 'DISMISS_TEAM'] as const) reject(s, { type });
    act(s, { type: 'INSPECT_WEATHER' }); expect(caseReceipt(s, 'fog-corridor').evidence.result).toBe('ABILITY');
    reject(s, { type: 'REPORT', caseId: 'fog-corridor' }); act(s, { type: 'STOP_WEATHER' });
    expect(s.weatherWarlock.life.practice).toMatchObject({ airborneMl: 0, basin: { waterMl: 500 }, weather: { effect: 'NONE', visibilityMetres: 4 } });
    expect(s.spirituality).toBe(spirit - 6); close(s, 'fog-corridor'); act(s, { type: 'REPORT', caseId: 'fog-corridor' });
    expect(caseReceipt(s, 'fog-corridor').evidence).toMatchObject({ elapsedSeconds: 96, ownerWalkedMetres: 8, toolTravelMetres: 8, closed: true, dismissed: true, spiritualitySpent: 6 });
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual(energy.map(e => e - 5));
    expect(s.progression.mastery['hunter.s2.battle-fog']).toBe(8); expect(totalWater(s)).toBe(6000);
    expect(s.warBishop).toEqual(original); expect(hasWeatherWarlockLifeLock(s)).toBe(false);
  });

  it('can stop an unobserved successful field but must still produce a real ordinary result before reporting', () => {
    const s = weatherLifeReady(); begin(s, 'fog-corridor'); act(s, { type: 'CAST_WEATHER' }); act(s, { type: 'STOP_WEATHER' });
    reject(s, { type: 'INSPECT_WEATHER' }); reject(s, { type: 'RETURN_NEAR' });
    act(s, { type: 'ORDINARY_WORK' }); close(s, 'fog-corridor'); act(s, { type: 'REPORT', caseId: 'fog-corridor' });
    expect(caseReceipt(s, 'fog-corridor').evidence).toMatchObject({ abilityAttempted: true, effectObserved: false, result: 'ORDINARY' });
    expect(s.progression.mastery['hunter.s2.battle-fog']).toBe(0); expect(totalWater(s)).toBe(6000);
  });

  it('has a zero-spirit ordinary fallback without rerolling or creating water after a rejected cast', () => {
    const s = weatherLifeReady(); s.spirituality = 0; begin(s, 'fog-corridor');
    reject(s, { type: 'CAST_WEATHER' }); act(s, { type: 'ORDINARY_WORK' }); close(s, 'fog-corridor'); act(s, { type: 'REPORT', caseId: 'fog-corridor' });
    expect(caseReceipt(s, 'fog-corridor')).toMatchObject({ outcome: null, evidence: { result: 'ORDINARY', abilityAttempted: false, spiritualitySpent: 0 } });
    expect(s.weatherWarlock.life.practice.reservoir.remainingMl).toBe(6000); expect(s.spirituality).toBe(0);
    expect(s.progression.mastery['hunter.s2.battle-fog']).toBe(0);
  });

  it('preserves the same 1000 ml, original tray and real small injuries after failed frost and melting', () => {
    const s = weatherLifeReady(); reach(s, 'frost-tray'); const health = s.health, members = s.ironBloodKnight.team.members.slice(0, 5).map(m => m.health), spirit = s.spirituality;
    begin(s, 'frost-tray'); expect(s.weatherWarlock.life.practice.tray).toEqual({ id: 'WW2-TRAY-1', liquidMl: 1000, iceMl: 0 });
    const ctx = act(s, { type: 'CAST_WEATHER' }, 100); expect(ctx.check).toHaveBeenCalledTimes(1);
    expect(s.weatherWarlock.life.practice.tray).toEqual({ id: 'WW2-TRAY-1', liquidMl: 750, iceMl: 250 });
    expect(s.health).toBe(health - 1); expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.health)).toEqual(members.map(h => h - 1));
    act(s, { type: 'INSPECT_WEATHER' }); act(s, { type: 'STOP_WEATHER' });
    expect(s.weatherWarlock.life.practice.tray).toEqual({ id: 'WW2-TRAY-1', liquidMl: 1000, iceMl: 0 });
    reject(s, { type: 'CAST_WEATHER' }); act(s, { type: 'ORDINARY_WORK' }); close(s, 'frost-tray'); act(s, { type: 'REPORT', caseId: 'frost-tray' });
    expect(s.health).toBe(health - 1); expect(s.spirituality).toBe(spirit - 8); expect(s.progression.mastery['hunter.s2.frost']).toBe(0);
    expect(caseReceipt(s, 'frost-tray').evidence).toMatchObject({ failed: true, result: 'ORDINARY', spiritualitySpent: 8, ownerDamage: 1, elapsedSeconds: 111 });
    expect(totalWater(s)).toBe(6000); expect(s.weatherWarlock.life.practice.tools.find(t => t.caseId === 'frost-tray')).toMatchObject({ id: 'WW2-TRAY-1', holder: 'RACK' });
  });

  it('keeps original wet and damaged wood while ordinary cleanup collects the failed rain water', () => {
    const s = weatherLifeReady(); reach(s, 'wind-rain'); begin(s, 'wind-rain'); act(s, { type: 'CAST_WEATHER' }, 100);
    expect(s.weatherWarlock.life.practice).toMatchObject({ basin: { waterMl: 1000 }, groundMl: 800, fixture: { id: 'WW2-FIXTURE-1', wetMl: 200, damaged: true }, reservoir: { remainingMl: 3000 } });
    expect(totalWater(s)).toBe(6000); act(s, { type: 'STOP_WEATHER' });
    expect(s.weatherWarlock.life.practice.fixture).toMatchObject({ wetMl: 200, damaged: true });
    act(s, { type: 'ORDINARY_WORK' }); close(s, 'wind-rain'); act(s, { type: 'REPORT', caseId: 'wind-rain' });
    expect(s.weatherWarlock.life.practice).toMatchObject({ basin: { waterMl: 1800 }, groundMl: 0, fixture: { wetMl: 200, damaged: true }, tray: { liquidMl: 1000 }, reservoir: { remainingMl: 3000 } });
    expect(totalWater(s)).toBe(6000); expect(s.progression.mastery['hunter.s2.storm']).toBe(0);
    reject(s, { type: 'PREPARE', caseId: 'wind-rain', method: 'ABILITY' });
  });

  it('allows all three actual ordinary comparisons plus reflection with no invented weather mastery', () => {
    const s = weatherLifeReady(), before = structuredClone(s.progression.mastery), spirit = s.spirituality;
    for (const id of WEATHER_WARLOCK_CASE_IDS) { if (id !== 'fog-corridor') recoverNextWeek(s); ordinary(s, id); }
    act(s, { type: 'REFLECT' }); expect(s.progression.acting).toBe(100); expect(s.progression.mastery).toEqual(before); expect(s.spirituality).toBe(spirit);
    expect(s.weatherWarlock.life.practice).toMatchObject({ reservoir: { remainingMl: 3000 }, tray: { liquidMl: 1000 }, basin: { waterMl: 2000 }, fixture: { damaged: false, wetMl: 0 } });
    expect(totalWater(s)).toBe(6000); expect(s.ironBloodKnight.team.members.every(m => !m.present)).toBe(true); reject(s, { type: 'REFLECT' });
  });

  it('reserves invitation AP, permits no-refund withdrawal, and completes physical cleanup at zero AP', () => {
    const s = weatherLifeReady(); act(s, { type: 'OBSERVE', caseId: 'fog-corridor' }); s.actionsRemaining = 1;
    reject(s, { type: 'PREPARE', caseId: 'fog-corridor', method: 'ABILITY' }); s.actionsRemaining = 2;
    act(s, { type: 'PREPARE', caseId: 'fog-corridor', method: 'ABILITY' }); act(s, { type: 'WITHDRAW', caseId: 'fog-corridor' });
    expect(s.actionsRemaining).toBe(1); expect(hasWeatherWarlockLifeLock(s)).toBe(false); s.actionsRemaining = 2;
    act(s, { type: 'PREPARE', caseId: 'fog-corridor', method: 'ORDINARY' }); act(s, { type: 'INVITE_TEAM', caseId: 'fog-corridor' });
    expect(s.actionsRemaining).toBe(0); act(s, { type: 'PERFORM', caseId: 'fog-corridor' }); act(s, { type: 'WARN_READ_EXIT' }); act(s, { type: 'ORDINARY_WORK' }); close(s, 'fog-corridor');
    expect(s.actionsRemaining).toBe(0); expect(hasWeatherWarlockLifeLock(s)).toBe(false); reject(s, { type: 'REPORT', caseId: 'fog-corridor' });
  });

  it('does not reuse an original weekly invitation across life and encounter scenes', () => {
    const s = weatherLifeReady(); ordinary(s, 'fog-corridor'); expect(blockWeatherWarlockTeamInvite(s)).toContain('真实周');
    act(s, { type: 'OBSERVE', caseId: 'frost-tray' }); act(s, { type: 'PREPARE', caseId: 'frost-tray', method: 'ORDINARY' });
    reject(s, { type: 'INVITE_TEAM', caseId: 'frost-tray' }); act(s, { type: 'WITHDRAW', caseId: 'frost-tray' });
    recoverNextWeek(s); expect(blockWeatherWarlockTeamInvite(s)).toBeNull();
    s.weatherWarlock.encounter.invitedWeek = s.week; expect(blockWeatherWarlockTeamInvite(s)).toContain('真实周');
  });

  it('rejects conservation-preserving water teleport, copied bodies, free exemptions, forged receipts and tool replacement', () => {
    const s = weatherLifeReady(); begin(s, 'fog-corridor'); act(s, { type: 'CAST_WEATHER' });
    const edits: ((x: SliceState) => void)[] = [
      x => { x.weatherWarlock.life.practice.reservoir.remainingMl += 500; x.weatherWarlock.life.practice.airborneMl = 0; },
      x => { (x.weatherWarlock.life as unknown as Record<string, unknown>).members = [{ id: 'COPY', health: 100 }]; },
      x => { x.weatherWarlock.life.practice.weather.affectedBodyIds.pop(); },
      x => { x.weatherWarlock.life.practice.weather.visibilityMetres = 4; },
      x => { x.weatherWarlock.life.practice.tools[0]!.id = 'IB4-OLD-TOOL'; },
      x => { caseReceipt(x, 'fog-corridor').evidence.spiritualitySpent = 0; },
      x => { caseReceipt(x, 'fog-corridor').steps.push('CAST_WEATHER'); },
      x => { x.ironBloodKnight.team.members[0]!.energy++; },
    ];
    for (const edit of edits) { const bad = structuredClone(s); edit(bad); expect(validateWeatherWarlockLife(bad)).toBe(false); }
    const reordered = JSON.parse(stableStringify(s)) as SliceState;
    expect(validateWeatherWarlockLife(reordered)).toBe(true); expect(projectWeatherWarlockLife(reordered)).toEqual(projectWeatherWarlockLife(s));
  });
});
