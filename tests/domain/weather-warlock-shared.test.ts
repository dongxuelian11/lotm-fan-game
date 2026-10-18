import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSlicePayload } from '../../src/domain/slice/validation.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { applyWeatherWarlockCommand, createWeatherWarlockState, projectWeatherWarlock, validateWeatherWarlockCommand, validateWeatherWarlockState } from '../../src/domain/weather-warlock/index.js';
import { validateWeatherWarlockActivityCommand } from '../../src/domain/weather-warlock/life.js';
import { validateWeatherWarlockEncounter, validateWeatherWarlockEncounterCommand } from '../../src/domain/weather-warlock/encounter.js';
import { validateWeatherWarlockRoundOutcome, validWeatherWarlockTerrain } from '../../src/domain/weather-warlock/combat.js';
import { WEATHER_WARLOCK_ABILITY_IDS } from '../../src/domain/weather-warlock/types.js';
import { weatherContext, weatherFixturePath, weatherSnapshot } from './weather-warlock-test-fixture.js';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const priorPath = 'tests/fixtures/war-bishop-v01410/peaceful-exit.json';

describe('Weather Warlock natural public route, exact intent boundary and old terminal preservation', () => {
  it('replays the same seed and exact living peaceful-exit prefix through the complete public route', () => {
    const data = read(weatherFixturePath), prior = read(priorPath);
    expect(data.seed).toBe(prior.seed); expect(data.prefixCount).toBe(prior.commands.length);
    expect(data.commands.slice(0, data.prefixCount)).toEqual(prior.commands);
    expect(prior.sourcePrefixCount).toBe(541); expect(data.departureStart.warBishop.encounter).toEqual(prior.final.warBishop.encounter);
    let s = createSliceRun(data.final.runId, data.creation, data.seed);
    for (const command of data.commands) s = applySliceIntent(s, command);
    assertValidSliceState(s); expect(s).toEqual(migrateSliceState(data.final));
    expect(s.progression.sequence).toBe(2); expect(s.health).toBeGreaterThan(0);
  }, 30000);

  it('replays each actual persisted boundary once without mutating its original input', () => {
    const boundaries = read('tests/fixtures/weather-warlock-v01650/boundaries.json') as Record<string, { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }>;
    expect(Object.keys(boundaries).length).toBeGreaterThanOrEqual(18);
    for (const boundary of Object.values(boundaries)) {
      const before = migrateSliceState(boundary.beforeLast), expected = migrateSliceState(boundary.final), bytes = JSON.stringify(before);
      assertValidSliceState(before); assertValidSliceState(expected);
      expect(applySliceIntent(before, boundary.lastIntent)).toEqual(expected); expect(JSON.stringify(before)).toBe(bytes);
    }
  }, 30000);

  it('migrates the original S3 death without reviving the owner, enemy, original roster or objects', () => {
    const original = read('tests/fixtures/war-bishop-v01410/natural.json').final, bytes = JSON.stringify(original);
    expect(original.status).toBe('DEAD'); expect(original.health).toBe(0); expect(original.warBishop.encounter.terminal.outcome).toBe('PLAYER_DEAD');
    const s = migrateSliceState(original); assertValidSliceState(s);
    expect(s.weatherWarlock).toEqual(createWeatherWarlockState()); expect(s.warBishop).toEqual(original.warBishop);
    expect(s.ironBloodKnight).toEqual(original.ironBloodKnight); expect(s.progression).toEqual(original.progression);
    expect(s.health).toBe(0); expect(s.status).toBe('DEAD'); expect(s.combatHistory).toEqual(original.combatHistory);
    const before = structuredClone(s);
    for (const command of [{ type: 'LEARN_GUIDANCE' }, { type: 'OBSERVE', caseId: 'fog-corridor' }, { type: 'ENCOUNTER_TALK' }] as const)
      expect(() => applySliceIntent(s, { type: 'WEATHER_WARLOCK', command })).toThrow();
    expect(s).toEqual(before); expect(JSON.stringify(original)).toBe(bytes);
  });

  it('preserves original S3 history, old unused bottles, original bodies and inherited mastery at real S2 promotion', () => {
    const before = weatherSnapshot('departureStart'), promoted = weatherSnapshot('promoted'); assertValidSliceState(promoted);
    for (const key of ['hunter', 'provoker', 'pyromaniac', 'conspirator', 'reaper', 'ironBloodKnight', 'warBishop'] as const) expect(promoted[key]).toEqual(before[key]);
    expect(promoted.character.gender).toBe(before.character.gender); expect(promoted.ironBloodKnight.originalGender).toBe(before.ironBloodKnight.originalGender);
    for (const [id, value] of Object.entries(before.progression.mastery)) expect(promoted.progression.mastery[id]).toBe(value);
    expect(Object.keys(promoted.progression.mastery).filter(id => !Object.hasOwn(before.progression.mastery, id))).toEqual([...WEATHER_WARLOCK_ABILITY_IDS]);
    expect(WEATHER_WARLOCK_ABILITY_IDS.map(id => promoted.progression.mastery[id])).toEqual([0, 0, 0]);
    expect(promoted.weatherWarlock.bottles.slice(0, 2).map(b => [b.status, b.outcome])).toEqual([['CONSUMED', 'FAILURE'], ['CONSUMED', 'SUCCESS']]);
    expect(promoted.weatherWarlock.warBishopActingAtPromotion).toBe(100);
    expect(projectWeatherWarlock(promoted).resources).toMatchObject({ maxSpirituality: 120, spirituality: 120 });
    expect(projectSliceState(promoted).warBishop.acting).toBe(100);
  });

  it('records genuine failure, water, injuries and original-object cleanup in the natural three-case path', () => {
    const s = weatherSnapshot('practiced'); assertValidSliceState(s);
    expect(s.progression.acting).toBe(100); expect(s.weatherWarlock.life.reflected).toBe(true);
    const cases = s.weatherWarlock.life.cases;
    expect(cases['fog-corridor'].result).toBe('ABILITY'); expect(cases['frost-tray'].result).toBe('ORDINARY'); expect(cases['wind-rain'].result).toBe('ORDINARY');
    expect(cases['frost-tray'].attempts[0]!.outcome).toBe('GREAT_FAILURE'); expect(cases['wind-rain'].attempts[0]!.outcome).toBe('FAILURE');
    expect(WEATHER_WARLOCK_ABILITY_IDS.map(id => s.progression.mastery[id])).toEqual([8, 0, 0]);
    expect(s.weatherWarlock.life.practice).toMatchObject({ reservoir: { remainingMl: 2500 }, tray: { liquidMl: 1000, iceMl: 0 }, basin: { waterMl: 2300 }, fixture: { wetMl: 200, damaged: true }, groundMl: 0, airborneMl: 0 });
    expect(s.ironBloodKnight.team.members.filter(m => m.present)).toEqual([]);
    expect(Object.values(cases).every(c => c.status === 'RESOLVED' && c.attempts.length === 1 && c.closes === 1)).toBe(true);
  });

  it('retains actual independent enemy depletion, real surrender and damaged original terrain after ordinary life resumes', () => {
    const s = weatherSnapshot('final'); assertValidSliceState(s);
    expect(s.combat).toBeNull(); expect(s.weatherWarlock.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', weaponLocation: 'YARD', terminal: { outcome: 'ENEMY_SURRENDERED' } });
    expect(s.weatherWarlock.encounter.terrain).toEqual({ waterLitres: 36, wet: true, fixtureDamage: 1, weatherUses: { FOG: 0, FROST: 0, STORM: 1 } });
    expect(validateWeatherWarlockEncounter(s)).toBe(true);
    for (const r of s.combatHistory.filter(r => r.weatherWarlockOutcome)) expect(validateWeatherWarlockRoundOutcome(r.weatherWarlockOutcome)).toBe(true);
    expect(s.warBishop.encounter).toEqual(weatherSnapshot('departureStart').warBishop.encounter);
    expect(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true);
  });

  it('rejects a coherent but historically unrelated terrain replacement at the encounter boundary', () => {
    const s = weatherSnapshot('final');
    s.weatherWarlock.encounter.terrain = { waterLitres: 40, wet: false, fixtureDamage: 0, weatherUses: { FOG: 0, FROST: 0, STORM: 0 } };
    expect(validWeatherWarlockTerrain(s.weatherWarlock.encounter.terrain)).toBe(true);
    expect(validateWeatherWarlockEncounter(s)).toBe(false); expect(() => assertValidSliceState(s)).toThrow();
  });

  it('accepts only exact public command shapes, including the independent consume confirmation', () => {
    const commands = [
      { type: 'LEARN_GUIDANCE' }, { type: 'REQUEST_SUPPLY' }, { type: 'RECEIVE_SUPPLY' },
      { type: 'PREPARE_PROMOTION' }, { type: 'LEAVE_PREPARATION' },
      { type: 'PREPARE_TASK', taskId: 'INSPECT_ROUTE' },
      { type: 'POTION_WORK', bottleId: 'weather-warlock-potion-1' }, { type: 'BUY_POTION', bottleId: 'weather-warlock-potion-2' },
      { type: 'CONSUME', bottleId: 'weather-warlock-potion-2', confirmed: true },
      { type: 'REST_TEAM' }, { type: 'RECOVER_TEAM' },
      { type: 'OBSERVE', caseId: 'fog-corridor' }, { type: 'PREPARE', caseId: 'frost-tray', method: 'ORDINARY' },
      { type: 'INVITE_TEAM', caseId: 'wind-rain' }, { type: 'PERFORM', caseId: 'fog-corridor' },
      { type: 'WARN_READ_EXIT' }, { type: 'CAST_WEATHER' }, { type: 'INSPECT_WEATHER' }, { type: 'STOP_WEATHER' },
      { type: 'ORDINARY_WORK' }, { type: 'RETURN_NEAR' }, { type: 'RETURN_TOOL' }, { type: 'DISMISS_TEAM' },
      { type: 'CLOSE', caseId: 'fog-corridor' }, { type: 'REPORT', caseId: 'fog-corridor' }, { type: 'REFLECT' },
      { type: 'ENCOUNTER_TALK' }, { type: 'CALL_COMPANIONS' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'LEAVE_ENCOUNTER' },
    ];
    for (const command of commands) {
      expect(validateWeatherWarlockCommand(command)).toBe(true);
      expect(validateSlicePayload({ type: 'WEATHER_WARLOCK', command })).toBe(true);
      expect(validateWeatherWarlockCommand({ ...command, free: true })).toBe(false);
      expect(validateSlicePayload({ type: 'WEATHER_WARLOCK', command, trusted: true })).toBe(false);
    }
  });

  it.each([
    null, {}, [], { type: 'WEATHER_CONTROL' }, { type: 'CAST_WEATHER', target: 'ENEMY_ONLY' },
    { type: 'CAST_WEATHER', field: 'FREE_STORM' }, { type: 'INVITE_TEAM', caseId: 'fog-corridor', memberIds: ['IB4-06'] },
    { type: 'PREPARE', caseId: 'fog-corridor', method: 'ABILITY_SUCCESS' }, { type: 'OBSERVE', caseId: 'old-fog' },
    { type: 'PREPARE_TASK', taskId: 'CONTINENTAL_WAR' }, { type: 'BUY_POTION', bottleId: 'war-bishop-potion-1' },
    { type: 'BUY_POTION', bottleId: 'weather-warlock-potion-0' }, { type: 'BUY_POTION', bottleId: 'weather-warlock-potion-01' },
    { type: 'CONSUME', bottleId: 'weather-warlock-potion-1' }, { type: 'CONSUME', bottleId: 'weather-warlock-potion-1', confirmed: false },
    { type: 'REST_TEAM', heal: true }, { type: 'CALL_COMPANIONS', copies: 30 }, { type: 'REFILL_WATER' }, { type: 'REVIVE' },
  ])('rejects hidden or forged entry%# without mutation or random check', command => {
    expect(validateWeatherWarlockCommand(command)).toBe(false);
    expect(validateSlicePayload({ type: 'WEATHER_WARLOCK', command })).toBe(false);
    const s = weatherSnapshot('promoted'), before = structuredClone(s), ctx = weatherContext(s);
    expect(() => applyWeatherWarlockCommand(s, command as never, ctx)).toThrow(); expect(s).toEqual(before);
    expect(ctx.check).not.toHaveBeenCalled(); expect(ctx.roll).not.toHaveBeenCalled();
  });

  it('does not accept life actions or encounter actions with undeclared case/body fields', () => {
    expect(validateWeatherWarlockActivityCommand({ type: 'CAST_WEATHER', caseId: 'fog-corridor' })).toBe(false);
    expect(validateWeatherWarlockEncounterCommand({ type: 'CALL_COMPANIONS', memberIds: ['IB4-01'] })).toBe(false);
    expect(validateWeatherWarlockEncounterCommand({ type: 'LEAVE_ENCOUNTER', teleport: true })).toBe(false);
    const s = weatherSnapshot('promoted'); s.progression.pathwayId = 'diviner';
    expect(projectWeatherWarlock(s).discovered).toBe(false); expect(projectWeatherWarlock(s).actions).toEqual([]);
    expect(() => applyWeatherWarlockCommand(s, { type: 'OBSERVE', caseId: 'fog-corridor' }, weatherContext(s))).toThrow();
  });

  it('keeps canonical serialization independent of object key ordering', () => {
    const s = weatherSnapshot('final'), reordered = JSON.parse(stableStringify(s)) as SliceState;
    expect(validateWeatherWarlockState(reordered)).toBe(true); expect(projectWeatherWarlock(reordered)).toEqual(projectWeatherWarlock(s));
    expect(() => assertValidSliceState(reordered)).not.toThrow();
  });
});
