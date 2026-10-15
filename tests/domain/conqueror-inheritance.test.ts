import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { SliceCombatRound, SliceState } from '../../src/domain/slice/types.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { validateSeerState, type SeerContext } from '../../src/domain/seer/index.js';
import { applyHunterCommand, createHunterState, projectHunter, validateHunterState } from '../../src/domain/hunter/index.js';
import { applyProvokerCommand, createProvokerState, projectProvoker, validateProvokerState } from '../../src/domain/provoker/index.js';
import { applyPyromaniacCommand, createPyromaniacState, projectPyromaniac, validatePyromaniacState } from '../../src/domain/pyromaniac/index.js';
import { applyConspiratorCommand, createConspiratorState, projectConspirator, validateConspiratorState } from '../../src/domain/conspirator/index.js';
import { applyReaperCommand, createReaperState, projectReaper, validateReaperState } from '../../src/domain/reaper/index.js';
import { applyIronBloodKnightCommand, createIronBloodKnightState, projectIronBloodKnight, validateIronBloodKnightState } from '../../src/domain/iron-blood-knight/index.js';
import { applyIronBloodTeamCommand, blockIronBloodTeamCommand, ironBloodTeamActions, validateIronBloodTeamState } from '../../src/domain/iron-blood-knight/team.js';
import { applyWarBishopCommand, createWarBishopState, projectWarBishop, validateWarBishopState } from '../../src/domain/war-bishop/index.js';
import { applyWeatherWarlockCommand, createWeatherWarlockState, hasWeatherWarlockHistory, isWeatherWarlock, projectWeatherWarlock, validateWeatherWarlockState } from '../../src/domain/weather-warlock/index.js';
import { applyWeatherWarlockActivity, weatherWarlockLifeActions } from '../../src/domain/weather-warlock/life.js';
import { applyWeatherWarlockEncounterCommand, validateWeatherWarlockEncounter } from '../../src/domain/weather-warlock/encounter.js';
import { isHunter } from '../../src/domain/hunter/combat.js';
import { isProvoker } from '../../src/domain/provoker/combat.js';
import { isPyromaniac } from '../../src/domain/pyromaniac/combat.js';
import { isReaper } from '../../src/domain/reaper/combat.js';
import { isIronBloodKnight } from '../../src/domain/iron-blood-knight/combat.js';
import { isWarBishop } from '../../src/domain/war-bishop/combat.js';
import { createConquerorState } from '../../src/domain/conqueror/index.js';
import { CONQUEROR_ABILITY_IDS } from '../../src/domain/conqueror/types.js';

const SOURCE = 'tests/fixtures/weather-warlock-v01650/natural.json';
const sourceBytes = readFileSync(SOURCE);
const captured = JSON.parse(sourceBytes.toString('utf8')) as { commands: unknown[]; prefixCount: number; final: SliceState };
const roots = ['hunter', 'provoker', 'pyromaniac', 'conspirator', 'reaper', 'ironBloodKnight', 'warBishop', 'weatherWarlock'] as const;
const validators = [validateHunterState, validateProvokerState, validatePyromaniacState, validateConspiratorState, validateReaperState, validateIronBloodKnightState, validateWarBishopState, validateWeatherWarlockState];
const projectors = [projectHunter, projectProvoker, projectPyromaniac, projectConspirator, projectReaper, projectIronBloodKnight, projectWarBishop, projectWeatherWarlock];
const creators = [createHunterState, createProvokerState, createPyromaniacState, createConspiratorState, createReaperState, createIronBloodKnightState, createWarBishopState, createWeatherWarlockState];
const original = (): SliceState => migrateSliceState(structuredClone(captured.final));
/** Directed ancestry-only S1 setup. It does not claim a valid Conqueror acquisition journal or natural promotion. */
function inherited(): SliceState {
  const s = original(); s.conqueror = createConquerorState();
  s.conqueror.promotionWeek = s.week;
  s.conqueror.weatherWarlockActingAtPromotion = s.progression.acting;
  s.progression.sequence = 1; s.progression.acting = 0;
  for (const id of CONQUEROR_ABILITY_IDS) s.progression.mastery[id] = 0;
  return s;
}
function context(): SeerContext {
  return { roll: vi.fn(min => min), note: vi.fn(), check: vi.fn(() => { throw new Error('An old-stage command must not reach a check.'); }) };
}
function expectOldValid(s: SliceState): void {
  for (const validate of [...validators, validateSeerState, validateIronBloodTeamState]) expect(validate(s), validate.name).toBe(true);
}
function rejectWithoutMutation(s: SliceState, action: () => void): void {
  const before = structuredClone(s); expect(action).toThrow(); expect(s).toEqual(before);
}

describe('Conqueror1 retains the exact natural Hunter9–2 ancestry', () => {
  it('pins the actual 658-command source, including its 21 skills, six zero masteries, and tired original team', () => {
    expect(createHash('sha256').update(sourceBytes).digest('hex')).toBe('5c2a70429ae7760e2f1c2ab0ecc53ddb76909befe9988e957012ff86787747fc');
    expect(captured.commands).toHaveLength(658); expect(captured.prefixCount).toBe(543);
    const s = original(); expectOldValid(s);
    expect(s).toMatchObject({ status: 'ACTIVE', revision: 659, week: 164, date: { epoch: 'FIFTH_EPOCH', year: 1352, month: 8, day: 12 }, health: 100, mind: 100, spirituality: 101, cash: 576, actionsRemaining: 2, injuryRisk: 0, injuries: [], progression: { pathwayId: 'hunter', sequence: 2, acting: 100, promotionWeek: 9 } });
    expect(Object.keys(s.progression.mastery)).toHaveLength(21);
    expect(Object.values(s.progression.mastery).filter(value => value === 0)).toHaveLength(6);
    expect(s.combatHistory).toHaveLength(21); expect(s.chronicle).toHaveLength(1045);
    expect(s.ironBloodKnight.team.members).toHaveLength(30);
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual([5, 5, 5, 5, 6]);
    expect(s.ironBloodKnight.team.members.every(m => m.location === 'HOME' && !m.present)).toBe(true);
  });
  it('keeps every old root, all original masteries including zeros, bodies, history and resources unchanged at the ancestry boundary', () => {
    const before = original(), s = inherited(); expectOldValid(s);
    expect(Object.keys(s.progression.mastery)).toHaveLength(23);
    expect(CONQUEROR_ABILITY_IDS).toEqual(['hunter.s1.formation-momentum', 'hunter.s1.focused-flame']);
    for (const root of roots) expect(s[root], root).toEqual(before[root]);
    for (const [id, value] of Object.entries(before.progression.mastery)) expect(s.progression.mastery[id], id).toBe(value);
    for (const id of CONQUEROR_ABILITY_IDS) expect(s.progression.mastery[id]).toBe(0);
    for (const key of ['character', 'health', 'mind', 'spirituality', 'cash', 'actionsRemaining', 'injuries', 'injuryRisk', 'combatHistory', 'lastCombatRound', 'chronicle', 'seer'] as const) expect(s[key], key).toEqual(before[key]);
  });
  it('projects all eight earlier stages as completed history with no executable actions and independent historical acting', () => {
    const s = inherited(); s.progression.acting = 25;
    expect(isWeatherWarlock(s)).toBe(false); expect(hasWeatherWarlockHistory(s)).toBe(true);
    for (const project of projectors) expect(project(s), project.name).toMatchObject({ promoted: true, acting: 100, actions: [] });
    for (const active of [isHunter, isProvoker, isPyromaniac, isReaper, isIronBloodKnight, isWarBishop, isWeatherWarlock]) expect(active(s), active.name).toBe(false);
    expect(weatherWarlockLifeActions(s)).toEqual([]); expect(ironBloodTeamActions(s)).toEqual([]);
    s.conqueror.weatherWarlockActingAtPromotion = 99;
    expect(validateWeatherWarlockState(s)).toBe(false);
  });
  it('requires exactly 21 old plus two new ability IDs with integer mastery in 0–500', () => {
    for (const id of Object.keys(inherited().progression.mastery)) {
      const s = inherited(); delete s.progression.mastery[id];
      for (const validate of [...validators, validateSeerState]) expect(validate(s), `${validate.name}: missing ${id}`).toBe(false);
    }
    for (const value of [-1, 501, 0.5, Number.NaN]) {
      const s = inherited(); s.progression.mastery[CONQUEROR_ABILITY_IDS[0]] = value;
      for (const validate of [...validators, validateSeerState]) expect(validate(s), validate.name).toBe(false);
    }
    const extra = inherited(); extra.progression.mastery['hunter.s1.invented'] = 0;
    for (const validate of [...validators, validateSeerState]) expect(validate(extra), validate.name).toBe(false);
    const prior = original(); prior.progression.mastery[CONQUEROR_ABILITY_IDS[0]] = 0;
    for (const validate of [...validators, validateSeerState]) expect(validate(prior), `${validate.name}: premature S1`).toBe(false);
  });
  it('does not accept reset ancestry roots or changed bottle provenance', () => {
    for (const [index, root] of roots.entries()) {
      const reset = inherited(); Object.assign(reset, { [root]: creators[index]!() }); expect(validators[index]!(reset), `${root}: reset`).toBe(false);
      const changed = inherited(); changed[root].bottles[0]!.source += ' replacement'; expect(validators[index]!(changed), `${root}: source`).toBe(false);
    }
    const identity = inherited(); identity.ironBloodKnight.team.members[0]!.id = 'replacement'; expect(validateIronBloodTeamState(identity)).toBe(false);
    const cloned = inherited(); cloned.ironBloodKnight.team.members.push(structuredClone(cloned.ironBloodKnight.team.members[0]!)); expect(validateIronBloodTeamState(cloned)).toBe(false);
    const opponent = inherited(); opponent.weatherWarlock.encounter.enemyHealth = 100; expect(validateWeatherWarlockEncounter(opponent)).toBe(false);
  });
  it('blocks old purchase, potion, traps, practice, encounter and root-level team commands without mutation or checks', () => {
    const s = inherited(), c = context();
    const commands: Array<() => void> = [
      () => applyHunterCommand(s, { type: 'BUY_TRAP_KIT' }, c),
      () => applyHunterCommand(s, { type: 'BUY_POTION', bottleId: s.hunter.bottles[0]!.id }, c),
      () => applyProvokerCommand(s, { type: 'BUY_POTION', bottleId: s.provoker.bottles[0]!.id }, c),
      () => applyPyromaniacCommand(s, { type: 'BUY_POTION', bottleId: s.pyromaniac.bottles[0]!.id }, c),
      () => applyConspiratorCommand(s, { type: 'BUY_POTION', bottleId: s.conspirator.bottles[0]!.id }, c),
      () => applyReaperCommand(s, { type: 'BUY_POTION', bottleId: s.reaper.bottles[0]!.id }, c),
      () => applyIronBloodKnightCommand(s, { type: 'REST_TEAM' }, c),
      () => applyWarBishopCommand(s, { type: 'REST_TEAM' }, c),
      () => applyWeatherWarlockCommand(s, { type: 'REST_TEAM' }, c),
      () => applyWeatherWarlockCommand(s, { type: 'BUY_POTION', bottleId: s.weatherWarlock.bottles[1]!.id }, c),
      () => applyWeatherWarlockCommand(s, { type: 'CONSUME', bottleId: s.weatherWarlock.bottles[1]!.id, confirmed: true }, c),
      () => applyWeatherWarlockActivity(s, { type: 'OBSERVE', caseId: 'fog-corridor' }, c),
      () => applyWeatherWarlockEncounterCommand(s, { type: 'ENCOUNTER_FIGHT' }, c),
    ];
    for (const command of commands) rejectWithoutMutation(s, command);
    expect(c.check).not.toHaveBeenCalled();
  });
  it('allows only explicit underlying original-team recovery at S1, with paid delay and unchanged identities and histories', () => {
    const s = inherited(), c = context(), before = structuredClone(s.ironBloodKnight.team), cash = s.cash;
    expect(blockIronBloodTeamCommand(s, { type: 'REST_TEAM' })).toBeNull();
    applyIronBloodTeamCommand(s, { type: 'REST_TEAM' }, c);
    expect(s.cash).toBe(cash - 40); expect(s.ironBloodKnight.team.members).toEqual(before.members);
    rejectWithoutMutation(s, () => applyIronBloodTeamCommand(s, { type: 'RECOVER_TEAM' }, c));
    // Directed team helper test only: full natural week progression is covered by the new-life integration test.
    s.week++;
    applyIronBloodTeamCommand(s, { type: 'RECOVER_TEAM' }, c);
    expect(s.ironBloodKnight.team.members.slice(0, 5).map(m => m.energy)).toEqual([13, 13, 13, 13, 14]);
    expect(s.ironBloodKnight.team.members.every(m => m.location === 'HOME' && !m.present)).toBe(true);
    for (const [index, m] of s.ironBloodKnight.team.members.entries()) expect({ ...m, health: before.members[index]!.health, energy: before.members[index]!.energy }).toEqual(before.members[index]);
    for (const key of ['cohorts', 'exercises', 'firstJoinedWeek', 'rite', 'riteHistory'] as const) expect(s.ironBloodKnight.team[key]).toEqual(before[key]);
    for (const command of [{ type: 'JOIN_COHORT', cohortId: 'G1' }, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'WATCH' }, { type: 'FULL_EXERCISE' }, { type: 'PREPARE_RITE' }, { type: 'LEAVE_RITE' }] as const) expect(blockIronBloodTeamCommand(s, command)).not.toBeNull();
  });
  it('permits later S1 round history and current-player death without resetting old resolved opponents', () => {
    const s = inherited(), oldHistory = structuredClone(s.combatHistory), oldEnemy = structuredClone(s.weatherWarlock.encounter);
    // Ancestry validator isolation only. This is deliberately not a replay-proven Conqueror round fixture.
    const later: SliceCombatRound = { round: 1, stance: 'ATTACK', first: 'PLAYER', playerCount: 1, enemyCount: 1, playerCountRoll: 1, enemyCountRoll: 1, moves: [], playerAdvantage: 125, enemyAdvantage: 125, winChance: 50, winner: 'ENEMY', consequence: 'Directed later-stage ancestry check', consequenceWeights: null, retreat: 'NONE' };
    s.combatHistory.push(later); s.lastCombatRound = later;
    expectOldValid(s);
    s.health = 0; s.status = 'DEAD'; expectOldValid(s);
    expect(s.combatHistory.slice(0, oldHistory.length)).toEqual(oldHistory);
    expect(s.weatherWarlock.encounter).toEqual(oldEnemy);
  });
  it('never admits S0 or a reopened/dead historical S2 encounter as an inherited S1 state', () => {
    const s0 = inherited(); Object.assign(s0.progression, { sequence: 0 });
    for (const validate of [...validators, validateSeerState]) expect(validate(s0), validate.name).toBe(false);
    for (const status of ['READY', 'FIGHTING', 'LOST'] as const) {
      const s = inherited(); s.weatherWarlock.encounter.status = status; expect(validateWeatherWarlockEncounter(s)).toBe(false);
    }
  });
});
