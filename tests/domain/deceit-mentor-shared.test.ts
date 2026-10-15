import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { DECEIT_MENTOR_ABILITY_IDS } from '../../src/domain/deceit-mentor/types.js';
import { createDeceitMentorState, hasDeceitMentorLock } from '../../src/domain/deceit-mentor/index.js';
import { DECEIT_MENTOR_CASE_IDS, createDeceitMentorLifeState } from '../../src/domain/deceit-mentor/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  departureStart: SliceState; guidanceStart: SliceState; prepared: SliceState; promoted: SliceState; practiced: SliceState;
  combatStart: SliceState; beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState;
}
interface Original { creation: Parameters<typeof createSliceRun>[1]; seed: string; commands: SliceIntent[]; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/parasite-v01280/natural.json', 'utf8'));
function read(): Capture {
  const data: Capture = JSON.parse(readFileSync('tests/fixtures/deceit-mentor-v01510/natural.json', 'utf8'));
  for (const key of ['departureStart', 'guidanceStart', 'prepared', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) data[key] = migrateSliceState(data[key]);
  return data;
}
const originalRoots = ['marauder', 'swindler', 'cryptologist', 'fireThief', 'dreamStealer', 'parasite'] as const;
function expectOriginals(state: SliceState, prior: SliceState) {
  for (const key of originalRoots) expect(state[key]).toEqual(prior[key]);
  expect(state.character.gender).toBe(prior.character.gender); expect(state.random.seed).toBe(prior.random.seed); expect(state.runId).toBe(prior.runId);
  expect(state.parasite.life).toMatchObject({ host: { id: 'PR4-THOMAS', control: 'HOST', mode: 'NONE', awareness: 'AWARE' }, player: { presence: 'OUTSIDE', entries: 2, exits: 2 }, thought: { targetId: 'PR4-ALICE', pending: 'NONE', targetPaused: false, lastRelease: 'EXECUTED' } });
  expect(state.parasite.encounter).toMatchObject({ targetId: 'PR4-RALF-TOREN', enemyHealth: 70, enemySpirituality: 25, enemyStatus: 'SURRENDERED', weapon: { id: 'PR4-RALF-CLUB', owner: 'PR4-RALF-TOREN', location: 'YARD' }, borrowed: [] });
}

describe('Deceit Mentor complete natural Error prefix and actual public continuation', () => {
  it('replays new creation, all352 original public commands and every new command with unchanged seed and full prefix state', () => {
    const data = read(), prior = original();
    expect(prior.commands).toHaveLength(352); expect(data.prefixCount).toBe(352); expect(data.commands.length).toBeGreaterThan(352);
    expect(data.commands.slice(0, data.prefixCount)).toEqual(prior.commands); expect(data.creation).toEqual(prior.creation);
    expect(data.seed).toBe('marauder-natural-v038'); expect(data.seed).toBe(prior.seed);
    let state = createSliceRun(data.final.runId, data.creation, data.seed);
    for (const [index, command] of data.commands.entries()) {
      state = applySliceIntent(state, command);
      if (index + 1 === 352) { expect(state).toEqual(migrateSliceState(prior.final)); expect(state).toEqual(data.departureStart); }
    }
    assertValidSliceState(state); expect(state).toEqual(data.final); expectOriginals(state, prior.final);
  }, 30_000);

  it('migrates the complete living W92 state without healing or changing original history or next RNG', () => {
    const prior = original(), bytes = JSON.stringify(prior.final), state = migrateSliceState(prior.final);
    expect(state.schemaVersion).toBe(174); expect(state.contentVersion).toBe('calamity-demoness-v174');
    expect(state.deceitMentor).toEqual(createDeceitMentorState());
    expect(state).toMatchObject({ week: 92, health: 100, mind: 100, spirituality: 114, cash: 570, actionsRemaining: 3, progression: { sequence: 4, acting: 100 } });
    expect(state.parasite.promotionWeek).toBe(82); expectOriginals(state, prior.final);
    for (const [key, value] of Object.entries(prior.final)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((state as unknown as Record<string, unknown>)[key]).toEqual(value);
    expect(state.random).toEqual({ seed: 'marauder-natural-v038', cursor: 249 });
    expect(JSON.stringify(prior.final)).toBe(bytes); expect(migrateSliceState(state)).toEqual(state); assertValidSliceState(state);
  });

  it('preserves the complete inherited mastery pool and original windows on actual S3 success without refilling', () => {
    const state = read().promoted, prior = original().final; assertValidSliceState(state);
    expect(state.progression.sequence).toBe(3); expect(state.deceitMentor.parasiteActingAtPromotion).toBe(100);
    expect(state.deceitMentor.promotionWeek! - state.parasite.promotionWeek!).toBeGreaterThanOrEqual(12); expectOriginals(state, prior);
    for (const [id, mastery] of Object.entries(prior.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(state.progression.mastery).filter(id => !Object.hasOwn(prior.progression.mastery, id))).toEqual([...DECEIT_MENTOR_ABILITY_IDS]);
    expect(DECEIT_MENTOR_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    const visible = projectSliceState(state); expect(visible.parasite.acting).toBe(100);
    expect(visible.deceitMentor.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(state.progression.mastery).sort());
    expect(visible.deceitMentor).toMatchObject({ title: '欺瞒导师·错误序列3（有限规则欺瞒）', promoted: true, formulaKnown: false, formula: [], currentGender: 'FEMALE' });
    expect(state.deceitMentor.life).toEqual(createDeceitMentorLifeState());
    expect(state.deceitMentor.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, targetId: 'DM3-GIDEON' });
    expect(state.deceitMentor.bottles.filter(b => ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))).toHaveLength(1);
    const b = JSON.parse(readFileSync('tests/fixtures/deceit-mentor-v01510/boundaries.json', 'utf8')).promotion as Boundary;
    expect(state.spirituality).toBe(b.beforeLast.spirituality); expect(state.health).toBe(b.beforeLast.health); expect(state.character.gender).toBe(b.beforeLast.character.gender);
  });

  it('replays every real saved boundary, preserving immutable input, chosen RNG outcomes and all original people', () => {
    const boundaries = JSON.parse(readFileSync('tests/fixtures/deceit-mentor-v01510/boundaries.json', 'utf8')) as Record<string, Boundary>;
    for (const name of ['guidance', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week', 'promotion', 'reflection', 'combat-first', 'combat-terminal']) expect(boundaries[name]).toBeTruthy();
    for (const captured of Object.values(boundaries)) {
      const state = migrateSliceState(captured.beforeLast), expected = migrateSliceState(captured.final); assertValidSliceState(state); assertValidSliceState(expected);
      const stateBytes = JSON.stringify(state), intentBytes = JSON.stringify(captured.lastIntent);
      expect(applySliceIntent(state, captured.lastIntent)).toEqual(expected); expect(JSON.stringify(state)).toBe(stateBytes); expect(JSON.stringify(captured.lastIntent)).toBe(intentBytes);
      expectOriginals(expected, original().final);
    }
  }, 30_000);

  it('finishes three truthful reports and reflection100 without assuming natural ability successes', () => {
    const state = read().practiced; assertValidSliceState(state);
    expect(state.progression).toMatchObject({ pathwayId: 'error', sequence: 3, acting: 100 });
    expect(Object.keys(state.deceitMentor.life.cases)).toEqual([...DECEIT_MENTOR_CASE_IDS]);
    expect(Object.values(state.deceitMentor.life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(state.deceitMentor.life).toMatchObject({ reflected: true, playerLocation: 'START' });
    expect(hasDeceitMentorLock(state)).toBe(false); expectOriginals(state, original().final);
    expect(state.seer.completedSources).toContain('deceit-mentor-reflection');
  });

  it('keeps the independent enemy paid resources and actual terminal outcome without resetting old Ralf', () => {
    const state = read().final; assertValidSliceState(state); expect(state.combat).toBeNull(); expect(state.deceitMentor.encounter.terminal).not.toBeNull();
    const encounter = state.deceitMentor.encounter; expect(encounter.targetId).toBe('DM3-GIDEON');
    const rounds = state.combatHistory.filter(round => round.deceitMentorOutcome); expect(rounds.length).toBeGreaterThan(0);
    let paid = 0;
    for (const round of rounds) {
      const outcome = round.deceitMentorOutcome!;
      paid += outcome.enemyActions.reduce((total, action) => total + action.paidCost, 0); expect(outcome.enemySpirituality).toBe(120 - paid);
    }
    expect(encounter.enemySpirituality).toBe(120 - paid); expectOriginals(state, original().final);
    if (state.status === 'DEAD') { expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH'); }
    else { expect(state.health).toBeGreaterThan(0); expect(hasDeceitMentorLock(state)).toBe(false); }
  });

  it('cannot reopen S4 acquisition or create a stolen ability after S3', () => {
    const state = read().promoted, bytes = JSON.stringify(state);
    expect(() => applySliceIntent(state, { type: 'PARASITE', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    const oldActions = projectSliceState(state).parasite.actions;
    expect(oldActions.every(action => !action.enabled && !!action.reason)).toBe(true);
    expect(() => applySliceIntent(state, { type: 'PARASITE', command: { type: 'CONSUME', bottleId: state.parasite.bottles[0]!.id, confirmed: true } })).toThrow();
    expect(JSON.stringify(state)).toBe(bytes); expect(state.parasite.encounter.borrowed).toEqual([]);
  });

  it('retains any actual failed original bottles and their paid preparation chronology', () => {
    const state = read().promoted;
    for (const bottle of state.deceitMentor.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(bottle.consumedWeek).toBe(bottle.preparationWeek); expect(bottle.acquiredWeek).not.toBeNull(); expect(bottle.id).toMatch(/^deceit-mentor-potion-/);
      expect(bottle.consumedWeek).toBeGreaterThanOrEqual(state.parasite.promotionWeek! + 12); expect(bottle.consumedWeek).toBeLessThanOrEqual(state.deceitMentor.promotionWeek!);
    }
    expect(state.deceitMentor.preparedWeek).toBeNull(); expect(state.deceitMentor.preparations).toHaveLength(3);
  });

  it('keeps a separate same-natural-prefix peaceful branch when the optional combat branch dies', () => {
    const actual = read(); if (actual.final.status !== 'DEAD') return;
    expect(existsSync('tests/fixtures/deceit-mentor-v01510/peaceful.json')).toBe(true);
    const capture = JSON.parse(readFileSync('tests/fixtures/deceit-mentor-v01510/peaceful.json', 'utf8')) as Capture & { sharedPublicPrefix: number; branch: string };
    expect(capture.branch).toBe('BEFORE_OPTIONAL_FIGHT'); expect(capture.prefixCount).toBe(352); expect(capture.seed).toBe(actual.seed);
    expect(capture.commands.slice(0, capture.sharedPublicPrefix)).toEqual(actual.commands.slice(0, capture.sharedPublicPrefix));
    expect(actual.commands[capture.sharedPublicPrefix]).toEqual({ type: 'DECEIT_MENTOR', command: { type: 'ENCOUNTER_FIGHT' } });
    expect(capture.commands[capture.sharedPublicPrefix]).toEqual({ type: 'DECEIT_MENTOR', command: { type: 'LEAVE_ENCOUNTER' } });
    expect(capture.commands.at(-1)).toEqual({ type: 'ACTION', action: 'WORK' });
    let state = createSliceRun(capture.final.runId, capture.creation, capture.seed); for (const command of capture.commands) state = applySliceIntent(state, command);
    expect(state).toEqual(migrateSliceState(capture.final)); assertValidSliceState(state); expect(state.status).toBe('ACTIVE'); expect(state.health).toBeGreaterThan(0); expect(state.combat).toBeNull();
    expect(state.deceitMentor.encounter).toMatchObject({ status: 'RESOLVED', attemptWeek: null, terminal: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(state.combatHistory).toEqual(original().final.combatHistory); expectOriginals(state, original().final); expect(actual.final.status).toBe('DEAD');
  }, 30_000);
});
