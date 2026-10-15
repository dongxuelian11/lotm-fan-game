import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { JUSTICE_MENTOR_ABILITY_IDS } from '../../src/domain/justice-mentor/types.js';
import { JUSTICE_MENTOR_CASE_IDS, createJusticeMentorLifeState } from '../../src/domain/justice-mentor/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  departureStart: SliceState; guidanceStart: SliceState; promoted: SliceState; practiced: SliceState;
  combatStart: SliceState; beforeLast: SliceState; final: SliceState;
}
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Capture => JSON.parse(readFileSync('tests/fixtures/unshadowed-v01250/natural.json', 'utf8'));
function read(): Capture {
  const data: Capture = JSON.parse(readFileSync('tests/fixtures/justice-mentor-v01480/natural.json', 'utf8'));
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) if (data[key]) data[key] = migrateSliceState(data[key]);
  return data;
}
const originalRoots = ['bard', 'lightprayer', 'sunpriest', 'notary', 'priestOfLight', 'unshadowed'] as const;
function expectOriginals(state: SliceState, prior: SliceState) {
  for (const key of originalRoots) expect(state[key]).toEqual(prior[key]);
  expect(state.character.gender).toBe(prior.character.gender); expect(state.random.seed).toBe(prior.random.seed); expect(state.runId).toBe(prior.runId);
  expect(state.unshadowed.encounter.enemy).toMatchObject({ id: 'UD4-EDMUND', health: 60, mind: 100, status: 'SURRENDERED', weaponId: 'UD4-EDMUND-CLUB', weaponLocation: 'COURTYARD' });
  expect(state.unshadowed.life).toMatchObject({ ally: { location: 'LOW', moves: 3, returns: 3 }, characteristic: { contamination: 0, containment: 'BENCH' }, tile: { scorchMarks: 1, coolingSeconds: 60, heat: 'COLD' } });
  expect(state.unshadowed.ritual).toMatchObject({ activeVisitId: null, playerLocation: 'OUTSIDE' });
  expect(state.unshadowed.ritual.visits[0]).toMatchObject({ phase: 'RETURNED', anchor: { location: 'RETURNED', felt: true }, vessel: { id: 'UD4-VESSEL-1', status: 'EMPTY' } });
}

describe('Justice Mentor verifiedS3 original public route and shared runtime', () => {
  it('replays all440 original commands and every new choice using the unchanged original seed', () => {
    const data = read(), prior = original();
    expect(prior.commands).toHaveLength(440); expect(data.prefixCount).toBe(440); expect(data.commands.length).toBeGreaterThan(440); expect(data.seed).toBe('bard-natural-v029');
    expect(data.commands.slice(0, data.prefixCount)).toEqual(prior.commands); expect(data.seed).toBe(prior.seed);
    let state = createSliceRun(data.final.runId, data.creation, data.seed);
    for (const [index, command] of data.commands.entries()) { state = applySliceIntent(state, command); if (index + 1 === data.prefixCount) expect(state).toEqual(data.departureStart); }
    assertValidSliceState(state); expect(state).toEqual(data.final);
  }, 30_000);

  it('migrates the genuineW111 state to146 without altering original bodies, objects, emotion return or RNG', () => {
    const prior = original(), bytes = JSON.stringify(prior.final), state = migrateSliceState(prior.final);
    expect(state.schemaVersion).toBe(177); expect(state.contentVersion).toBe('blood-duke-v177');
    expect(state.justiceMentor.promotionWeek).toBeNull(); expect(state.justiceMentor.unshadowedActingAtPromotion).toBeNull();
    for (const key of Object.keys(prior.final)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((state as unknown as Record<string, unknown>)[key]).toEqual(key === 'longChapter' ? { ...prior.final.longChapter, handoff: null } : (prior.final as unknown as Record<string, unknown>)[key]);
    expect(state).toMatchObject({ week: 111, health: 100, mind: 100, spirituality: 110, cash: 160, actionsRemaining: 1, character: { age: 26, gender: 'FEMALE', coreStats: { physique: 28, perception: 24, will: 27, knowledge: 22 } } });
    expect(state.unshadowed.promotionWeek).toBe(104); expectOriginals(state, prior.final);
    expect(state.justiceMentor.life).toEqual(createJusticeMentorLifeState()); expect(JSON.stringify(prior.final)).toBe(bytes); assertValidSliceState(state);
  });

  it('retains old mastery and exposes the full inherited pool after independentS3 promotion', () => {
    const state = read().promoted, prior = original().final; assertValidSliceState(state);
    expect(state.progression.sequence).toBe(3); expect(state.justiceMentor.unshadowedActingAtPromotion).toBe(100);
    expect(state.justiceMentor.promotionWeek! - state.unshadowed.promotionWeek!).toBeGreaterThanOrEqual(12); expectOriginals(state, prior); expect(state.injuries).toEqual(prior.injuries);
    for (const [id, mastery] of Object.entries(prior.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(state.progression.mastery).filter(id => !Object.hasOwn(prior.progression.mastery, id))).toEqual([...JUSTICE_MENTOR_ABILITY_IDS]);
    expect(JUSTICE_MENTOR_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    const visible = projectSliceState(state); expect(visible.unshadowed.acting).toBe(100);
    expect(visible.justiceMentor.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(state.progression.mastery).sort());
    expect(visible.justiceMentor).toMatchObject({ title: '正义导师·太阳序列3（合作与核实）', promoted: true, formulaKnown: false, formula: [], currentGender: 'FEMALE' });
    expect(state.justiceMentor.life).toEqual(createJusticeMentorLifeState());
    expect(state.justiceMentor.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, targetId: 'JM3-CORWIN' });
    expect(state.justiceMentor.bottles.filter(b => ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))).toHaveLength(1);
    for (const bottle of state.justiceMentor.bottles.filter(b => b.status === 'CONSUMED')) { expect(bottle.consumedWeek).toBe(bottle.preparationWeek); expect(bottle.acquiredWeek).not.toBeNull(); expect(bottle.id).toMatch(/^justice-mentor-potion-/); }
  });

  it('replays every actual saved boundary without mutating input, the original seed or old histories', () => {
    const boundaries = JSON.parse(readFileSync('tests/fixtures/justice-mentor-v01480/boundaries.json', 'utf8')) as Record<string, Boundary>;
    for (const name of ['guidance', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week', 'promotion', 'reflection', 'combat-first', 'combat-terminal']) expect(boundaries[name]).toBeTruthy();
    for (const captured of Object.values(boundaries)) {
      const state = migrateSliceState(captured.beforeLast), expected = migrateSliceState(captured.final); assertValidSliceState(state); assertValidSliceState(expected);
      const stateBytes = JSON.stringify(state), intentBytes = JSON.stringify(captured.lastIntent);
      expect(applySliceIntent(state, captured.lastIntent)).toEqual(expected); expect(JSON.stringify(state)).toBe(stateBytes); expect(JSON.stringify(captured.lastIntent)).toBe(intentBytes);
      expectOriginals(expected, original().final);
    }
  }, 30_000);

  it('finishes three finite cooperative and evidence scenes and reflection100 with every active contact closed', () => {
    const state = read().practiced, prior = original().final; assertValidSliceState(state);
    expect(state.progression).toMatchObject({ pathwayId: 'sun', sequence: 3, acting: 100 });
    expect(Object.keys(state.justiceMentor.life.cases)).toEqual([...JUSTICE_MENTOR_CASE_IDS]);
    expect(Object.values(state.justiceMentor.life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(state.justiceMentor.life.reflected).toBe(true); expect(projectSliceState(state).justiceMentor.insideCase).toBe(false); expectOriginals(state, prior);
    expect(state.seer.completedSources).toContain('justice-mentor-reflection');
  });

  it('preserves independent enemy resources and the actual terminal result without healing surrendered Edmund', () => {
    const state = read().final, prior = original().final; assertValidSliceState(state);
    expect(state.combat).toBeNull(); expect(state.justiceMentor.encounter.terminal).not.toBeNull();
    const encounter = state.justiceMentor.encounter; expect(encounter.targetId).toBe('JM3-CORWIN');
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.LIGHT_STRIKE * 5 - encounter.powerUses.LIGHT_WARD * 4 - encounter.powerUses.FOCUS * 4);
    const rounds = state.combatHistory.filter(round => round.justiceMentorOutcome); expect(rounds.length).toBeGreaterThan(0);
    let paid = 0;
    for (const round of rounds) {
      const outcome = round.justiceMentorOutcome!; expect(outcome.source).toMatchObject({ targetId: 'JM3-CORWIN', enemyWeapon: 'JM3-CORWIN-CLUB', ordinaryExit: true, pursuit: false, distanceMetres: 2, selfEncouragementOnly: true, clearanceConfirmed: true, thirdPartiesInArea: 0, automaticAllyImmunity: false });
      paid += outcome.enemyActions.reduce((total, action) => total + action.paidCost, 0); expect(outcome.enemySpirituality).toBe(120 - paid);
    }
    expect(encounter.enemySpirituality).toBe(120 - paid); expectOriginals(state, prior);
    if (state.status === 'DEAD') { expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH'); }
    else { expect(state.health).toBeGreaterThan(0); expect(projectSliceState(state).justiceMentor.insideCase).toBe(false); }
  });

  it('cannot reopen oldS4 acquisition afterS3 and keeps rejected public input unchanged', () => {
    const state = read().promoted, bytes = JSON.stringify(state);
    expect(() => applySliceIntent(state, { type: 'UNSHADOWED', command: { type: 'LEARN_FORMULA' } })).toThrow();
    expect(JSON.stringify(state)).toBe(bytes); expect(projectSliceState(state).unshadowed.actions).toEqual([]);
  });

  it('keeps all natural failed bottles consumed with their original preparation and chronology', () => {
    const state = read().promoted, prior = original().final;
    for (const bottle of state.justiceMentor.bottles.filter(b => ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''))) {
      expect(bottle.status).toBe('CONSUMED'); expect(bottle.consumedWeek).toBe(bottle.preparationWeek);
      expect(bottle.consumedWeek).toBeGreaterThanOrEqual(prior.unshadowed.promotionWeek! + 12); expect(bottle.consumedWeek).toBeLessThanOrEqual(state.justiceMentor.promotionWeek!);
    }
    expect(state.justiceMentor.preparedWeek).toBeNull(); expect(state.justiceMentor.preparations).toHaveLength(3);
  });

  it('uses an independent same-prefix peaceful route if the actual combat branch dies', () => {
    const actual = read(); if (actual.final.status !== 'DEAD') return;
    expect(existsSync('tests/fixtures/justice-mentor-v01480/peaceful.json')).toBe(true);
    const capture = JSON.parse(readFileSync('tests/fixtures/justice-mentor-v01480/peaceful.json', 'utf8')) as Capture & { sharedPublicPrefix: number; branch: string };
    expect(capture.branch).toBe('BEFORE_OPTIONAL_FIGHT'); expect(capture.prefixCount).toBe(440); expect(capture.seed).toBe(original().seed);
    expect(capture.commands.slice(0, capture.sharedPublicPrefix)).toEqual(actual.commands.slice(0, capture.sharedPublicPrefix));
    expect(actual.commands[capture.sharedPublicPrefix]).toEqual({ type: 'JUSTICE_MENTOR', command: { type: 'ENCOUNTER_FIGHT' } });
    expect(capture.commands[capture.sharedPublicPrefix]).toEqual({ type: 'JUSTICE_MENTOR', command: { type: 'LEAVE_ENCOUNTER' } });
    expect(capture.commands.at(-1)).toEqual({ type: 'ACTION', action: 'WORK' });
    let state = createSliceRun(capture.final.runId, capture.creation, capture.seed); for (const command of capture.commands) state = applySliceIntent(state, command);
    expect(state).toEqual(migrateSliceState(capture.final)); assertValidSliceState(state); expect(state.status).toBe('ACTIVE'); expect(state.health).toBeGreaterThan(0); expect(state.combat).toBeNull();
    expect(state.justiceMentor.encounter).toMatchObject({ status: 'RESOLVED', attemptWeek: null, terminal: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(state.combatHistory).toEqual(original().final.combatHistory); expectOriginals(state, original().final); expect(actual.final.status).toBe('DEAD');
  }, 30_000);
});
