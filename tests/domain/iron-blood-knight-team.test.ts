import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SeerContext } from '../../src/domain/seer/index.js';
import { addGameWeeks } from '../../src/domain/game-calendar.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { resolveNormalCheck } from '../../src/resolution/normal-check.js';
import { createIronBloodKnightState } from '../../src/domain/iron-blood-knight/index.js';
import {
  applyIronBloodTeamCommand, blockIronBloodTeamCommand, canConsumeIronBloodRite, closeIronBloodRite,
  createIronBloodTeamState, findIronBloodMember, hasIronBloodRitualLock, ironBloodTeamActions,
  ironBloodTeamQualified, projectIronBloodTeam, validateIronBloodTeamCommand, validateIronBloodTeamState,
  IRON_BLOOD_COHORT_IDS, IRON_BLOOD_ROSTER, IRON_BLOOD_TEAM_ACTIVITIES, type IronBloodTeamCommand,
} from '../../src/domain/iron-blood-knight/team.js';

const previous = JSON.parse(readFileSync('tests/fixtures/reaper-v0960/natural.json', 'utf8'));
const context = (s: SliceState, roll = 1): SeerContext => ({ roll: vi.fn(min => min), note: vi.fn(), check: vi.fn((ability, difficulty) => resolveNormalCheck({ ability, baseAbility: s.character.coreStats[ability], difficulty, modifiers: [], roll })) });
/** Directed team unit fixture, never a replacement for the original natural RNG route. */
function ready(): SliceState {
  const s = migrateSliceState(structuredClone(previous.practiced)); s.ironBloodKnight = createIronBloodKnightState();
  s.ironBloodKnight.guidanceKnown = true; s.activeEvent = null; s.eventQueue = []; s.combat = null; s.pulse = 'NONE';
  s.world.city = 'BACKLUND'; s.actionsRemaining = 100; s.weeklyBudget = 100; s.cash = 30000; s.health = 100; s.mind = 100;
  s.character.coreStats.knowledge = 30; return s;
}
function act(s: SliceState, c: IronBloodTeamCommand, roll = 1) { const ctx = context(s, roll); applyIronBloodTeamCommand(s, c, ctx); expect(validateIronBloodTeamState(s)).toBe(true); return ctx; }
function reject(s: SliceState, c: unknown) { const before = structuredClone(s), ctx = context(s); expect(() => applyIronBloodTeamCommand(s, c as IronBloodTeamCommand, ctx)).toThrow(); expect(s).toEqual(before); expect(ctx.check).not.toHaveBeenCalled(); }
function nextWeek(s: SliceState, count = 1) { s.week += count; s.date = addGameWeeks(s.date, count); }
function experienced(): SliceState {
  const s = ready();
  for (const cohortId of IRON_BLOOD_COHORT_IDS) act(s, { type: 'JOIN_COHORT', cohortId });
  for (const [i, activity] of IRON_BLOOD_TEAM_ACTIVITIES.entries()) { if (i) nextWeek(s); for (const cohortId of IRON_BLOOD_COHORT_IDS) act(s, { type: 'TEAM_ACTIVITY', cohortId, activity }); }
  act(s, { type: 'FULL_EXERCISE' }); nextWeek(s); act(s, { type: 'FULL_EXERCISE' }); return s;
}
function qualified(): SliceState { const s = experienced(); nextWeek(s, 3); s.ironBloodKnight.bottles[0]!.status = 'PLAYER'; s.ironBloodKnight.bottles[0]!.acquiredWeek = s.week; return s; }

describe('Iron Blood Knight finite original thirty-member comradeship', () => {
  it('starts with exactly thirty distinct named adults, six groups of five, no arrival or growth', () => {
    const t = createIronBloodTeamState(); expect(t.members).toHaveLength(30); expect(new Set(t.members.map(m => m.id)).size).toBe(30);
    expect(new Set(t.members.map(m => m.name)).size).toBe(30); expect(t.members.every(m => m.age >= 18 && !m.joined && !m.present && m.location === 'HOME' && m.experience === 0)).toBe(true);
    for (const id of IRON_BLOOD_COHORT_IDS) expect(t.members.filter(m => m.cohortId === id)).toHaveLength(5);
    expect(t.members.map(m => m.id)).toEqual(IRON_BLOOD_ROSTER.map(m => m.id));
  });
  it('requires each actual group to join and never purchases membership or grants lesson credit', () => {
    const s = ready(), ap = s.actionsRemaining, cash = s.cash; reject(s, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'RESCUE' });
    act(s, { type: 'JOIN_COHORT', cohortId: 'G1' }); expect(s.actionsRemaining).toBe(ap - 1); expect(s.cash).toBe(cash);
    expect(s.ironBloodKnight.team.members.filter(m => m.joined)).toHaveLength(5); expect(s.ironBloodKnight.team.members.every(m => m.experience === 0 && !m.present)).toBe(true);
    reject(s, { type: 'JOIN_COHORT', cohortId: 'G1' }); reject(s, { type: 'PREPARE_RITE' });
  });
  it('records distinct real weekly shared successes, with failure fatigue and no fake growth', () => {
    const s = ready(); act(s, { type: 'JOIN_COHORT', cohortId: 'G1' }); const cash = s.cash, mind = s.mind;
    act(s, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'RESCUE' }, 100);
    expect(s.cash).toBe(cash - 20); expect(s.mind).toBe(mind - 2); expect(findIronBloodMember(s, 'IB4-01')).toMatchObject({ energy: 18, experience: 0, present: false });
    reject(s, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'RESCUE' }); reject(s, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'WATCH' });
    nextWeek(s); act(s, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'RESCUE' }); nextWeek(s);
    reject(s, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'RESCUE' }); act(s, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'WATCH' });
    nextWeek(s); act(s, { type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'SIGNALS' });
    expect(findIronBloodMember(s, 'IB4-01')!.cohortActivities.map(a => a.activity)).toEqual(['RESCUE', 'WATCH', 'SIGNALS']);
    expect(new Set(findIronBloodMember(s, 'IB4-01')!.cohortActivities.map(a => a.week)).size).toBe(3);
    expect(s.ironBloodKnight.team.cohorts[0]!.attempts).toHaveLength(4);
  });
  it('lets independent original cohorts work in the same week rather than a global free-count counter', () => {
    const s = ready(); for (const cohortId of ['G1', 'G2'] as const) { act(s, { type: 'JOIN_COHORT', cohortId }); act(s, { type: 'TEAM_ACTIVITY', cohortId, activity: 'RESCUE' }); }
    expect(s.ironBloodKnight.team.members.filter(m => m.experience === 1)).toHaveLength(10); expect(s.ironBloodKnight.team.members.filter(m => m.experience === 0)).toHaveLength(20);
    reject(s, { type: 'FULL_EXERCISE' });
  });
  it('requires two actual thirty-body exercises in different weeks and at least six weeks', () => {
    const s = experienced(); expect(s.ironBloodKnight.team.exercises).toHaveLength(2); expect(s.ironBloodKnight.team.members.every(m => m.experience === 5 && m.exerciseWeeks.length === 2)).toBe(true);
    expect(ironBloodTeamQualified(s)).toBe(false); reject(s, { type: 'PREPARE_RITE' }); reject(s, { type: 'FULL_EXERCISE' });
    nextWeek(s, 3); expect(ironBloodTeamQualified(s)).toBe(true); reject(s, { type: 'PREPARE_RITE' });
    s.ironBloodKnight.bottles[0]!.status = 'PLAYER'; act(s, { type: 'PREPARE_RITE' }); expect(canConsumeIronBloodRite(s)).toBe(true);
  });
  it('charges failed whole exercises and does not replace their actual participants', () => {
    const s = ready(); for (const cohortId of IRON_BLOOD_COHORT_IDS) act(s, { type: 'JOIN_COHORT', cohortId });
    for (const activity of IRON_BLOOD_TEAM_ACTIVITIES) { for (const cohortId of IRON_BLOOD_COHORT_IDS) act(s, { type: 'TEAM_ACTIVITY', cohortId, activity }); nextWeek(s); }
    const mind = s.mind, cash = s.cash; act(s, { type: 'FULL_EXERCISE' }, 100);
    expect(s.mind).toBe(mind - 3); expect(s.cash).toBe(cash - 60); expect(s.ironBloodKnight.team.members.every(m => m.energy === 18 && m.experience === 3)).toBe(true);
    expect(s.ironBloodKnight.team.exercises[0]!.participantIds).toEqual(IRON_BLOOD_ROSTER.map(m => m.id)); reject(s, { type: 'FULL_EXERCISE' });
    nextWeek(s); act(s, { type: 'FULL_EXERCISE' }); expect(s.ironBloodKnight.team.members.every(m => m.energy === 18 && m.experience === 4)).toBe(true);
  });
  it('current injury or consent blocks new rites without erasing old comradeship', () => {
    const s = qualified(), m = findIronBloodMember(s, 'IB4-01')!, history = structuredClone(m.cohortActivities); m.health = 60;
    expect(validateIronBloodTeamState(s)).toBe(true); expect(ironBloodTeamQualified(s)).toBe(true); reject(s, { type: 'PREPARE_RITE' });
    m.health = 100; m.willing = false; reject(s, { type: 'PREPARE_RITE' }); expect(m.cohortActivities).toEqual(history); m.willing = true;
    act(s, { type: 'PREPARE_RITE' }); m.willing = false; expect(canConsumeIronBloodRite(s)).toBe(false); m.willing = true;
  });
  it('actual last-AP gathering and zero-resource exit preserve histories and charge each fresh rite', () => {
    const s = qualified(), cash = s.cash, teamHistory = structuredClone(s.ironBloodKnight.team.members.map(m => m.cohortActivities)); s.actionsRemaining = 1;
    act(s, { type: 'PREPARE_RITE' }); expect(s.actionsRemaining).toBe(0); expect(s.cash).toBe(cash - 120); expect(hasIronBloodRitualLock(s)).toBe(true);
    expect(s.ironBloodKnight.team.members.every(m => m.present && m.location === 'YARD')).toBe(true);
    s.health = 0; s.mind = 0; act(s, { type: 'LEAVE_RITE' }); expect(s.ironBloodKnight.team.members.every(m => !m.present && m.location === 'HOME')).toBe(true);
    expect(s.ironBloodKnight.team.members.map(m => m.cohortActivities)).toEqual(teamHistory); expect(s.cash).toBe(cash - 120);
    s.health = 100; s.mind = 100; s.actionsRemaining = 1; act(s, { type: 'PREPARE_RITE' }); expect(s.cash).toBe(cash - 240); expect(s.ironBloodKnight.team.rite!.id).toBe('IB4-RITE-2');
    const originalIds = [...s.ironBloodKnight.team.rite!.participantIds]; closeIronBloodRite(s, 'original-bottle-2');
    expect(s.ironBloodKnight.team.riteHistory[1]).toMatchObject({ consumedBottleId: 'original-bottle-2', participantIds: originalIds, arrivedWeek: s.week });
    expect(canConsumeIronBloodRite(s)).toBe(false); expect(validateIronBloodTeamState(s)).toBe(true);
  });
  it('paid recovery waits a real week and is bounded, leaving willingness and histories unchanged', () => {
    const s = qualified(), m = findIronBloodMember(s, 'IB4-01')!; m.health = 51; m.energy = 1; m.willing = false; s.actionsRemaining = 0;
    const before = structuredClone(m.cohortActivities), cash = s.cash; act(s, { type: 'REST_TEAM' }); expect(s.cash).toBe(cash - 40); expect(m.health).toBe(51);
    reject(s, { type: 'RECOVER_TEAM' }); reject(s, { type: 'REST_TEAM' }); nextWeek(s); act(s, { type: 'RECOVER_TEAM' });
    expect(m).toMatchObject({ health: 71, energy: 9, willing: false, present: false }); expect(m.cohortActivities).toEqual(before);
    reject(s, { type: 'RECOVER_TEAM' }); act(s, { type: 'REST_TEAM' }); nextWeek(s, 10); act(s, { type: 'RECOVER_TEAM' }); expect(m).toMatchObject({ health: 91, energy: 17 });
  });
  it('blocks team work during a ready encounter even with no summoned members', () => {
    const s = ready(); s.ironBloodKnight.encounter.status = 'READY'; reject(s, { type: 'JOIN_COHORT', cohortId: 'G1' });
    expect(blockIronBloodTeamCommand(s, { type: 'JOIN_COHORT', cohortId: 'G1' })).toContain('现场');
  });
  it('public projection includes the six original rosters and cannot mutate authoritative history', () => {
    const s = qualified(), view = projectIronBloodTeam(s); expect(view.cohorts).toHaveLength(6); expect(view.qualified).toBe(true);
    expect(view.cohorts[0]!.successfulActivities).toHaveLength(3); expect(view.exerciseWeeks).toHaveLength(2); view.cohorts[0]!.members[0]!.health = 1;
    expect(findIronBloodMember(s, 'IB4-01')!.health).toBe(100); expect(ironBloodTeamActions(s).some(a => a.command.type === 'PREPARE_RITE' && a.enabled)).toBe(true);
  });
  it('validates semantic values after SQLite key sorting and rejects forged people or experiences', () => {
    const s = qualified(); expect(validateIronBloodTeamState(JSON.parse(stableStringify(s)))).toBe(true);
    const altered = structuredClone(s); altered.ironBloodKnight.team.members[0]!.age = 17; expect(validateIronBloodTeamState(altered)).toBe(false);
    const duplicated = structuredClone(s); duplicated.ironBloodKnight.team.members[1]!.id = 'IB4-01'; expect(validateIronBloodTeamState(duplicated)).toBe(false);
    const forged = structuredClone(s); forged.ironBloodKnight.team.cohorts[0]!.attempts[0]!.week++; expect(validateIronBloodTeamState(forged)).toBe(false);
    const preGuidance = structuredClone(s); preGuidance.ironBloodKnight.guidanceKnown = false; expect(validateIronBloodTeamState(preGuidance)).toBe(false);
    expect(validateIronBloodTeamCommand({ type: 'JOIN_COHORT', cohortId: 'G7' })).toBe(false); expect(validateIronBloodTeamCommand({ type: 'TEAM_ACTIVITY', cohortId: 'G1', activity: 'RESCUE', count: 30 })).toBe(false);
  });
});
