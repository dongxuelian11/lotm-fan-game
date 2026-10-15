import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSliceRun, applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { FEAR_BISHOP_ABILITY_IDS } from '../../src/domain/fear-bishop/types.js';
import { FEAR_BISHOP_CASE_IDS, createFearBishopLifeState } from '../../src/domain/fear-bishop/life.js';

interface Capture {
  creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[];
  departureStart: SliceState; guidanceStart: SliceState; promoted: SliceState; practiced: SliceState;
  combatStart: SliceState; beforeLast: SliceState; final: SliceState;
}
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const old = (): Capture => JSON.parse(readFileSync('tests/fixtures/nightwatcher-v01220/natural.json', 'utf8'));
function read(): Capture {
  const data: Capture = JSON.parse(readFileSync('tests/fixtures/fear-bishop-v01450/natural.json', 'utf8'));
  for (const key of ['departureStart', 'guidanceStart', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) if (data[key]) data[key] = migrateSliceState(data[key]);
  return data;
}
const originalRoots = ['sleepless', 'midnight', 'nightmare', 'soother', 'nightwatcher'] as const;
function expectOldRecords(state: SliceState, prior: SliceState) {
  for (const key of originalRoots) expect(state[key]).toEqual(prior[key]);
  const original = structuredClone(prior.spiritWarlock), current = structuredClone(state.spiritWarlock);
  const deployments = current.companion.deployments - original.companion.deployments;
  const recalls = current.companion.recalls - original.companion.recalls;
  expect(deployments).toBeGreaterThanOrEqual(0); expect(recalls).toBe(deployments);
  const rounds = state.combatHistory.slice(prior.combatHistory.length).filter(round => round.fearBishopOutcome);
  expect(deployments).toBe(rounds.reduce((sum, round) => sum + round.fearBishopOutcome!.playerActions.filter(action => action.spiritOperation === 'DEPLOY').length, 0));
  expect(recalls).toBe(rounds.filter(round => round.fearBishopOutcome!.recalled).length);
  current.companion.deployments = original.companion.deployments;
  current.companion.recalls = original.companion.recalls;
  expect(current).toEqual(original);
  expect(state.character.gender).toBe(prior.character.gender); expect(state.random.seed).toBe(prior.random.seed); expect(state.runId).toBe(prior.runId);
}

describe('Fear Bishop original public route and shared runtime', () => {
  it('replays all291 original commands and every new choice using the unchanged original seed', () => {
    const data = read(), prior = old();
    expect(prior.commands).toHaveLength(291); expect(data.prefixCount).toBe(291);
    expect(data.commands.slice(0, data.prefixCount)).toEqual(prior.commands); expect(data.seed).toBe(prior.seed);
    let state = createSliceRun(data.final.runId, data.creation, data.seed);
    for (const [index, command] of data.commands.entries()) {
      state = applySliceIntent(state, command);
      if (index + 1 === data.prefixCount) expect(state).toEqual(data.departureStart);
    }
    assertValidSliceState(state); expect(state).toEqual(data.final);
  }, 30_000);

  it('migrates the genuineW75 state to143 without changing the female body, dead Bram or original Leaf', () => {
    const prior = old(), bytes = JSON.stringify(prior.final), state = migrateSliceState(prior.final);
    expect(state.schemaVersion).toBe(175); expect(state.contentVersion).toBe('sage-v175');
    expect(state.fearBishop.promotionWeek).toBeNull(); expect(state.fearBishop.nightwatcherActingAtPromotion).toBeNull();
    for (const key of Object.keys(prior.final)) if (!['schemaVersion', 'contentVersion'].includes(key)) {
      expect((state as unknown as Record<string, unknown>)[key]).toEqual((prior.final as unknown as Record<string, unknown>)[key]);
    }
    expect(state).toMatchObject({ week: 75, health: 70, mind: 100, spirituality: 120, cash: 780, actionsRemaining: 1, character: { gender: 'FEMALE', coreStats: { physique: 28, perception: 26, will: 28, knowledge: 21 } } });
    expect(state.nightwatcher.promotionWeek).toBe(68);
    expect(state.nightwatcher.encounter.enemy).toMatchObject({ id: 'NW4-BRAM', health: 0, status: 'DEAD', weaponLocation: 'YARD' });
    expect(state.spiritWarlock.companion).toMatchObject({ source: 'SW5-LEAF-1', status: 'SEALED', acquiredWeek: 45, invitedWeek: 53, releases: 1, deployments: 10, recalls: 10 });
    expect(state.fearBishop.life).toEqual(createFearBishopLifeState());
    expect(JSON.stringify(prior.final)).toBe(bytes); assertValidSliceState(state);
  });

  it('retains all original mastery and exposes the inherited pool after independentS3 promotion', () => {
    const state = read().promoted, prior = old().final; assertValidSliceState(state);
    expect(state.progression.sequence).toBe(3); expect(state.fearBishop.nightwatcherActingAtPromotion).toBe(100);
    expect(state.fearBishop.promotionWeek! - state.nightwatcher.promotionWeek!).toBeGreaterThanOrEqual(12);
    expectOldRecords(state, prior); expect(state.spiritWarlock).toEqual(prior.spiritWarlock); expect(state.injuries).toEqual(prior.injuries);
    for (const [id, mastery] of Object.entries(prior.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(state.progression.mastery).filter(id => !Object.hasOwn(prior.progression.mastery, id))).toEqual([...FEAR_BISHOP_ABILITY_IDS]);
    expect(FEAR_BISHOP_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    const visible = projectSliceState(state);
    expect(visible.nightwatcher.acting).toBe(100);
    expect(visible.fearBishop.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(state.progression.mastery).sort());
    expect(visible.fearBishop).toMatchObject({ promoted: true, formulaKnown: false, formula: [], currentGender: 'FEMALE' });
    expect(state.fearBishop.life).toEqual(createFearBishopLifeState());
    expect(state.fearBishop.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, targetId: 'FB3-HARLAN' });
  });

  it('replays every actual saved boundary without mutating its original input', () => {
    const boundaries = JSON.parse(readFileSync('tests/fixtures/fear-bishop-v01450/boundaries.json', 'utf8')) as Record<string, Boundary>;
    for (const name of ['guidance', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week', 'consume-failure', 'promotion', 'contained-residue-ability-outcome', 'contained-residue-returned', 'stop-signal-ability-outcome', 'stop-signal-stopped', 'corridor-exit-ability-outcome', 'corridor-exit-returned', 'reflection', 'combat-first', 'combat-terminal', 'ordinary-life-after-exit']) expect(boundaries[name]).toBeTruthy();
    for (const captured of Object.values(boundaries)) {
      const state = migrateSliceState(captured.beforeLast), expected = migrateSliceState(captured.final);
      assertValidSliceState(state); assertValidSliceState(expected);
      const stateBytes = JSON.stringify(state), intentBytes = JSON.stringify(captured.lastIntent);
      expect(applySliceIntent(state, captured.lastIntent)).toEqual(expected);
      expect(JSON.stringify(state)).toBe(stateBytes); expect(JSON.stringify(captured.lastIntent)).toBe(intentBytes);
    }
  }, 30_000);

  it('completes three distinct practices with real original objects and a genuinely awake volunteer before reflection100', () => {
    const data = read(), state = data.practiced, prior = old().final; assertValidSliceState(state);
    expect(state.progression).toMatchObject({ pathwayId: 'darkness', sequence: 3, acting: 100 });
    const life = state.fearBishop.life;
    expect(Object.keys(life.cases)).toEqual([...FEAR_BISHOP_CASE_IDS]);
    expect(Object.values(life.cases).every(scene => scene.status === 'RESOLVED' && scene.returned && !scene.contactOpen && scene.attempts.every(attempt => attempt.closed))).toBe(true);
    expect(life.activeCase).toBeNull(); expect(life.playerLocation).toBe('EXIT'); expect(life.reflected).toBe(true);
    expect(life.container).toEqual({ id: 'FB3-GLASS-1', owner: 'FB3-EDITH', location: 'OWNER' });
    expect(life.lamp).toEqual({ id: 'FB3-LAMP', owner: 'FB3-EDITH', location: 'OWNER' });
    expect(life.tomas).toMatchObject({ id: 'FB3-TOMAS', age: 34, health: 100, state: 'AWAKE', location: 'EXIT', effectActive: false, remainingSeconds: 0 });
    expect(life.residue).toMatchObject({ id: 'FB3-RESIDUE-1', owner: 'FB3-EDITH', alive: false, conscious: false });
    expect(['DISSOLVED', 'SEALED']).toContain(life.residue.status);
    expect(['DISSOLVED', 'ISOLATED']).toContain(life.trace.status);
    expect(life.cases['contained-residue'].attempts.at(-1)).toMatchObject({ sourceRead: true, containerReturned: true, inspected: true });
    expect(life.cases['stop-signal'].attempts.at(-1)).toMatchObject({ consentWeek: life.cases['stop-signal'].attempts.at(-1)!.week, wakeConfirmed: true, volunteerLeft: true });
    expect(life.cases['corridor-exit'].attempts.at(-1)).toMatchObject({ sideRouteChecked: true, lampTaken: true, lampReturned: true, inspected: true });
    expect(life.playerTravelMetres).toBeGreaterThanOrEqual(20); expect(life.clockSeconds).toBeGreaterThan(0);
    expectOldRecords(state, prior); expect(state.spiritWarlock).toEqual(prior.spiritWarlock);
  });

  it('retains each real ability roll and its costs through ordinary cleanup without inventing a successful result', () => {
    const state = read().practiced, life = state.fearBishop.life;
    let mentalCost = 0;
    for (const [id, scene] of Object.entries(life.cases)) {
      expect(scene.attempts.filter(attempt => attempt.abilityTier !== null).length).toBeLessThanOrEqual(1);
      for (const attempt of scene.attempts) {
        expect(attempt.spiritualitySpent).toBe(attempt.abilityTier === null ? 0 : id === 'stop-signal' ? 5 : 6);
        mentalCost += attempt.mindSpent;
        if (attempt.abilityTier === 'FAILURE' || attempt.abilityTier === 'GREAT_FAILURE') expect(attempt.result).toBe('ORDINARY');
        if (id === 'stop-signal' && (attempt.abilityTier === 'SUCCESS' || attempt.abilityTier === 'GREAT_SUCCESS')) expect(attempt.mindSpent).toBe(2);
        if (id === 'contained-residue' && attempt.result === 'ABILITY') expect(life.residue.status).toBe('DISSOLVED');
        if (id === 'corridor-exit') {
          expect(attempt.route).toBe(attempt.result === 'ABILITY' ? 'CORRIDOR' : 'SIDE');
          expect(attempt.playerTravelMetres).toBeGreaterThanOrEqual(attempt.route === 'CORRIDOR' ? 16 : 24);
          expect(life.trace.status).toBe(attempt.result === 'ABILITY' ? 'DISSOLVED' : 'ISOLATED');
        }
      }
    }
    expect(life.tomas.mind).toBe(100 - mentalCost);
  });

  it('keeps actual independent enemy resources and the same original Leaf through the captured terminal branch', () => {
    const state = read().final, prior = old().final; assertValidSliceState(state);
    expect(state.combat).toBeNull(); expect(state.fearBishop.encounter.terminal).not.toBeNull();
    const encounter = state.fearBishop.encounter;
    expect(encounter.targetId).toBe('FB3-HARLAN');
    expect(encounter.enemySpirituality).toBe(120 - encounter.powerUses.DARK_BOLT * 5 - encounter.powerUses.WARD * 4 - encounter.powerUses.FOCUS * 4);
    const rounds = state.combatHistory.filter(round => round.fearBishopOutcome);
    expect(rounds.length).toBeGreaterThan(0);
    let enemyPaid = 0, previousLeaf = prior.spiritWarlock.companion;
    for (const round of rounds) {
      const outcome = round.fearBishopOutcome!;
      expect(outcome.source.companion).toEqual(previousLeaf);
      expect(outcome.source).toMatchObject({ targetId: 'FB3-HARLAN', enemyWeapon: 'FB3-HARLAN-CLUB', ordinaryExit: true, pursuit: false, distanceMetres: 2 });
      enemyPaid += outcome.enemyActions.reduce((total, action) => total + action.paidCost, 0);
      expect(outcome.enemySpirituality).toBe(120 - enemyPaid);
      const deployed = outcome.playerActions.filter(action => action.spiritOperation === 'DEPLOY');
      expect(deployed.length).toBeLessThanOrEqual(1);
      for (const action of deployed) expect(action).toMatchObject({ paidCost: 2, selfGain: 0, enemyReduction: 0 });
      for (const action of outcome.playerActions.filter(entry => entry.spiritOperation === 'ASSIST')) expect(action).toMatchObject({ paidCost: 2, enemyReduction: 22 });
      expect(outcome.companionAfter).toEqual({ ...outcome.source.companion, status: 'SEALED', deployments: outcome.source.companion.deployments + deployed.length, recalls: outcome.source.companion.recalls + deployed.length });
      previousLeaf = outcome.companionAfter;
    }
    expect(encounter.enemySpirituality).toBe(120 - enemyPaid);
    expect(state.spiritWarlock.companion).toEqual(previousLeaf);
    expectOldRecords(state, prior);
    expect(state.nightwatcher.encounter.enemy).toMatchObject({ id: 'NW4-BRAM', health: 0, status: 'DEAD', weaponId: 'NW4-BRAM-CLUB', weaponLocation: 'YARD' });
    expect(state.spiritWarlock.companion.source).toBe('SW5-LEAF-1'); expect(state.spiritWarlock.companion.status).toBe('SEALED');
    if (state.status === 'DEAD') { expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH'); }
    else { expect(state.health).toBeGreaterThan(0); expect(projectSliceState(state).fearBishop.insideCase).toBe(false); }
  });

  it('cannot reopen oldS4 acquisition afterS3 and preserves rejected public input', () => {
    const state = read().promoted, bytes = JSON.stringify(state);
    expect(() => applySliceIntent(state, { type: 'NIGHTWATCHER', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    expect(JSON.stringify(state)).toBe(bytes);
    expect(projectSliceState(state).nightwatcher.actions.filter(action => ['LEARN_GUIDANCE', 'POTION_WORK', 'BUY_POTION', 'CONSUME', 'REQUEST_SUPPLY', 'RECEIVE_SUPPLY'].includes(action.command.type))).toEqual([]);
  });
});
