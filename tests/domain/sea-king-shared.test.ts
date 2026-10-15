import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { SEA_KING_ABILITY_IDS } from '../../src/domain/sea-king/types.js';
import { SEA_KING_CASE_IDS, createSeaKingLifeState } from '../../src/domain/sea-king/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  departureStart: SliceState; guidanceStart: SliceState; promoted: SliceState; practiced: SliceState;
  combatStart: SliceState; beforeLast: SliceState; final: SliceState;
}
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Capture => JSON.parse(readFileSync('tests/fixtures/cataclysm-priest-v01240/natural.json', 'utf8'));
function read(): Capture {
  const data: Capture = JSON.parse(readFileSync('tests/fixtures/sea-king-v01470/natural.json', 'utf8'));
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) if (data[key]) data[key] = migrateSliceState(data[key]);
  return data;
}
const originalRoots = ['sailor', 'rager', 'navigator', 'windBlessed', 'oceanSinger', 'cataclysmPriest'] as const;
function expectOriginals(state: SliceState, prior: SliceState) {
  for (const key of originalRoots) expect(state[key]).toEqual(prior[key]);
  expect(state.character.gender).toBe(prior.character.gender); expect(state.random.seed).toBe(prior.random.seed); expect(state.runId).toBe(prior.runId);
  expect(state.cataclysmPriest.encounter.enemy).toMatchObject({ id: 'CP4-BENEDICT', health: 0, mind: 100, status: 'DEAD', weaponId: 'CP4-BENEDICT-CLUB', weaponLocation: 'QUAY' });
  expect(state.cataclysmPriest.life).toMatchObject({ float: { location: 'BANK' }, rope: { durability: 90 }, tarp: { deployed: false }, tray: { capturedUnits: 1 }, stone: { scorchMarks: 1 } });
}

describe('Sea King verifiedS3 original public route and shared runtime', () => {
  it('replays all345 original commands and every new choice using the unchanged original seed', () => {
    const data = read(), prior = original();
    expect(prior.commands).toHaveLength(345); expect(data.prefixCount).toBe(345); expect(data.commands.length).toBeGreaterThan(345); expect(data.seed).toBe('sailor-natural-v026');
    expect(data.commands.slice(0, data.prefixCount)).toEqual(prior.commands); expect(data.seed).toBe(prior.seed);
    let state = createSliceRun(data.final.runId, data.creation, data.seed);
    for (const [index, command] of data.commands.entries()) { state = applySliceIntent(state, command); if (index + 1 === data.prefixCount) expect(state).toEqual(data.departureStart); }
    assertValidSliceState(state); expect(state).toEqual(data.final);
  }, 30_000);

  it('migrates the genuineW90 state to145 without altering original bodies, objects, coast damage or RNG', () => {
    const prior = original(), bytes = JSON.stringify(prior.final), state = migrateSliceState(prior.final);
    expect(state.schemaVersion).toBe(174); expect(state.contentVersion).toBe('calamity-demoness-v174');
    expect(state.seaKing.promotionWeek).toBeNull(); expect(state.seaKing.cataclysmPriestActingAtPromotion).toBeNull();
    for (const key of Object.keys(prior.final)) if (!['schemaVersion', 'contentVersion'].includes(key)) expect((state as unknown as Record<string, unknown>)[key]).toEqual(key === 'longChapter' ? { ...prior.final.longChapter, handoff: null } : (prior.final as unknown as Record<string, unknown>)[key]);
    expect(state).toMatchObject({ week: 90, health: 100, mind: 100, spirituality: 110, cash: 590, actionsRemaining: 1, character: { age: 26, gender: 'FEMALE', coreStats: { physique: 32, perception: 25, will: 25, knowledge: 19 } } });
    expect(state.cataclysmPriest.promotionWeek).toBe(84); expectOriginals(state, prior.final);
    expect(state.cataclysmPriest.ritual.visits[0]!.site).toMatchObject({ gauge: 'BROKEN', lowerWalkway: 'WASHED_OUT', earthquakeOccurred: true });
    expect(state.seaKing.life).toEqual(createSeaKingLifeState()); expect(JSON.stringify(prior.final)).toBe(bytes); assertValidSliceState(state);
  });

  it('retains old mastery and exposes the full inherited pool after independentS3 promotion', () => {
    const state = read().promoted, prior = original().final; assertValidSliceState(state);
    expect(state.progression.sequence).toBe(3); expect(state.seaKing.cataclysmPriestActingAtPromotion).toBe(100);
    expect(state.seaKing.promotionWeek! - state.cataclysmPriest.promotionWeek!).toBeGreaterThanOrEqual(12); expectOriginals(state, prior); expect(state.injuries).toEqual(prior.injuries);
    for (const [id, mastery] of Object.entries(prior.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(state.progression.mastery).filter(id => !Object.hasOwn(prior.progression.mastery, id))).toEqual([...SEA_KING_ABILITY_IDS]);
    expect(SEA_KING_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0, 0]);
    const visible = projectSliceState(state); expect(visible.cataclysmPriest.acting).toBe(100);
    expect(visible.seaKing.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(state.progression.mastery).sort());
    expect(visible.seaKing).toMatchObject({ title: '海王·暴君序列3（有限海域）', promoted: true, formulaKnown: false, formula: [], currentGender: 'FEMALE' });
    expect(state.seaKing.life).toEqual(createSeaKingLifeState());
    expect(state.seaKing.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, targetId: 'SK3-QUENTIN', waterSource: 'SEAWATER' });
    expect(state.seaKing.bottles.filter(b => ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))).toHaveLength(1);
    for (const bottle of state.seaKing.bottles.filter(b => b.status === 'CONSUMED')) { expect(bottle.consumedWeek).toBe(bottle.preparationWeek); expect(bottle.acquiredWeek).not.toBeNull(); expect(bottle.id).toMatch(/^sea-king-potion-/); }
  });

  it('replays every actual saved boundary without mutating input, the original seed or old histories', () => {
    const boundaries = JSON.parse(readFileSync('tests/fixtures/sea-king-v01470/boundaries.json', 'utf8')) as Record<string, Boundary>;
    for (const name of ['guidance', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week', 'promotion', 'reflection', 'combat-first', 'combat-terminal']) expect(boundaries[name]).toBeTruthy();
    for (const captured of Object.values(boundaries)) {
      const state = migrateSliceState(captured.beforeLast), expected = migrateSliceState(captured.final); assertValidSliceState(state); assertValidSliceState(expected);
      const stateBytes = JSON.stringify(state), intentBytes = JSON.stringify(captured.lastIntent);
      expect(applySliceIntent(state, captured.lastIntent)).toEqual(expected); expect(JSON.stringify(state)).toBe(stateBytes); expect(JSON.stringify(captured.lastIntent)).toBe(intentBytes);
      expectOriginals(expected, original().final);
    }
  }, 30_000);

  it('finishes three finite sea scenes and reflection100 with every active contact closed', () => {
    const state = read().practiced, prior = original().final; assertValidSliceState(state);
    expect(state.progression).toMatchObject({ pathwayId: 'tyrant', sequence: 3, acting: 100 });
    expect(Object.keys(state.seaKing.life.cases)).toEqual([...SEA_KING_CASE_IDS]);
    expect(Object.values(state.seaKing.life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(state.seaKing.life.reflected).toBe(true); expect(projectSliceState(state).seaKing.insideCase).toBe(false); expectOriginals(state, prior);
    expect(state.seer.completedSources).toContain('sea-king-reflection');
  });

  it('preserves independent enemy resources and the actual terminal result without reviving Benedict', () => {
    const state = read().final, prior = original().final; assertValidSliceState(state);
    expect(state.combat).toBeNull(); expect(state.seaKing.encounter.terminal).not.toBeNull();
    const encounter = state.seaKing.encounter; expect(encounter.targetId).toBe('SK3-QUENTIN');
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.WIND * 5 - encounter.powerUses.WATER_WARD * 4 - encounter.powerUses.FOCUS * 4);
    const rounds = state.combatHistory.filter(round => round.seaKingOutcome); expect(rounds.length).toBeGreaterThan(0);
    let paid = 0;
    for (const round of rounds) {
      const outcome = round.seaKingOutcome!; expect(outcome.source).toMatchObject({ targetId: 'SK3-QUENTIN', enemyWeapon: 'SK3-QUENTIN-CLUB', ordinaryExit: true, pursuit: false, distanceMetres: 2 });
      paid += outcome.enemyActions.reduce((total, action) => total + action.paidCost, 0); expect(outcome.enemySpirituality).toBe(120 - paid);
    }
    expect(encounter.enemySpirituality).toBe(120 - paid); expectOriginals(state, prior);
    if (state.status === 'DEAD') { expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH'); }
    else { expect(state.health).toBeGreaterThan(0); expect(projectSliceState(state).seaKing.insideCase).toBe(false); }
  });

  it('cannot reopen oldS4 acquisition afterS3 and keeps rejected public input unchanged', () => {
    const state = read().promoted, bytes = JSON.stringify(state);
    expect(() => applySliceIntent(state, { type: 'CATACLYSM_PRIEST', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    expect(JSON.stringify(state)).toBe(bytes); expect(projectSliceState(state).cataclysmPriest.actions).toEqual([]);
  });

  it('keeps all natural failed bottles consumed with their original preparation and chronology', () => {
    const state = read().promoted, prior = original().final;
    for (const bottle of state.seaKing.bottles.filter(b => ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''))) {
      expect(bottle.status).toBe('CONSUMED'); expect(bottle.consumedWeek).toBe(bottle.preparationWeek);
      expect(bottle.consumedWeek).toBeGreaterThanOrEqual(prior.cataclysmPriest.promotionWeek! + 12); expect(bottle.consumedWeek).toBeLessThanOrEqual(state.seaKing.promotionWeek!);
    }
    expect(state.seaKing.preparedWeek).toBeNull(); expect(state.seaKing.preparations).toHaveLength(3);
  });

  it('uses an independent same-prefix peaceful route if the actual combat branch dies', () => {
    const actual = read(); if (actual.final.status !== 'DEAD') return;
    expect(existsSync('tests/fixtures/sea-king-v01470/peaceful.json')).toBe(true);
    const capture = JSON.parse(readFileSync('tests/fixtures/sea-king-v01470/peaceful.json', 'utf8')) as Capture & { sharedPublicPrefix: number; branch: string };
    expect(capture.branch).toBe('BEFORE_OPTIONAL_FIGHT'); expect(capture.prefixCount).toBe(345); expect(capture.seed).toBe(original().seed);
    expect(capture.commands.slice(0, capture.sharedPublicPrefix)).toEqual(actual.commands.slice(0, capture.sharedPublicPrefix));
    expect(actual.commands[capture.sharedPublicPrefix]).toEqual({ type: 'SEA_KING', command: { type: 'ENCOUNTER_FIGHT' } });
    expect(capture.commands[capture.sharedPublicPrefix]).toEqual({ type: 'SEA_KING', command: { type: 'LEAVE_ENCOUNTER' } });
    expect(capture.commands.at(-1)).toEqual({ type: 'ACTION', action: 'WORK' });
    let state = createSliceRun(capture.final.runId, capture.creation, capture.seed); for (const command of capture.commands) state = applySliceIntent(state, command);
    expect(state).toEqual(migrateSliceState(capture.final)); assertValidSliceState(state); expect(state.status).toBe('ACTIVE'); expect(state.health).toBeGreaterThan(0); expect(state.combat).toBeNull();
    expect(state.seaKing.encounter).toMatchObject({ status: 'RESOLVED', attemptWeek: null, terminal: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(state.combatHistory).toEqual(original().final.combatHistory); expectOriginals(state, original().final); expect(actual.final.status).toBe('DEAD');
  }, 30_000);
});
