import { CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION } from '../helpers/current-save-format.js';
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState, SliceIntent } from '../../src/domain/slice/types.js';
import { WANDERER_ABILITY_IDS } from '../../src/domain/wanderer/types.js';
import { createWandererState, hasWandererLock } from '../../src/domain/wanderer/index.js';
import { WANDERER_CASE_IDS, createWandererLifeState } from '../../src/domain/wanderer/life.js';

interface Capture {
  provenance: { kind: string }; seed: string; prefixCount: number; commands: SliceIntent[]; initial: SliceState;
  departureStart: SliceState; guidanceStart: SliceState; prepared: SliceState; promoted: SliceState; practiced: SliceState;
  combatStart: SliceState; beforeLast: SliceState; final: SliceState;
}
interface Original {
  provenance: { kind: string; originalRandom: SliceState['random']; directedRandom: SliceState['random'] };
  commands: SliceIntent[]; sealed: SliceState; final: SliceState;
}
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = (): Original => JSON.parse(readFileSync('tests/fixtures/secrets-sorcerer-v01270/directed.json', 'utf8'));
function read(): Capture {
  const data: Capture = JSON.parse(readFileSync('tests/fixtures/wanderer-v01500/continued.json', 'utf8'));
  for (const key of ['initial', 'departureStart', 'guidanceStart', 'prepared', 'promoted', 'practiced', 'combatStart', 'beforeLast', 'final'] as const) data[key] = migrateSliceState(data[key]);
  return data;
}
const originalRoots = ['apprentice', 'trickmaster', 'astrologer', 'recorder', 'traveler', 'secretsSorcerer'] as const;
function expectOriginals(state: SliceState, prior: SliceState) {
  for (const key of originalRoots) expect(state[key]).toEqual(prior[key]);
  expect(state.character.gender).toBe(prior.character.gender); expect(state.random.seed).toBe(prior.random.seed); expect(state.runId).toBe(prior.runId);
  expect(state.secretsSorcerer.ritual.phase).toBe('CLOSED');
  expect(state.secretsSorcerer.ritual.targets.find(target => target.id === 'SS4-ARCH-A')).toMatchObject({ status: 'SEALED' });
  expect(state.secretsSorcerer.ritual.targets.find(target => target.id === 'SS4-ARCH-B')).toMatchObject({ status: 'LEFT_ALIVE' });
  expect(state.secretsSorcerer.ritual.cases.some(box => box.targetId === 'SS4-ARCH-A' && box.custody === 'ARCHIVE' && box.location === 'ARCHIVE')).toBe(true);
}

describe('Wanderer explicitly directed S4 prefix followed by actual public continuation', () => {
  it('starts only at the historically declared directed RNG and replays all60 old plus all new public commands', () => {
    const data = read(), prior = original();
    expect(prior.provenance.kind).toBe('DIRECTED_PROMOTION_THEN_PUBLIC_COMMANDS');
    expect(data.provenance.kind).toBe('DIRECTED_S4_PREFIX_THEN_PUBLIC_WANDERER');
    expect(prior.commands).toHaveLength(60); expect(data.prefixCount).toBe(60); expect(data.commands.length).toBeGreaterThan(60);
    expect(data.commands.slice(0, data.prefixCount)).toEqual(prior.commands);
    const start = migrateSliceState(prior.sealed); start.random = structuredClone(prior.provenance.directedRandom);
    expect(data.initial).toEqual(start); expect(data.seed).toBe(prior.provenance.directedRandom.seed);
    expect(prior.provenance.originalRandom).toEqual({ seed: 'apprentice-natural-v035', cursor: 219 });
    let state = structuredClone(data.initial);
    for (const [index, command] of data.commands.entries()) {
      state = applySliceIntent(state, command);
      if (index + 1 === 60) { expect(state).toEqual(data.departureStart); expectOriginals(state, prior.final); }
    }
    assertValidSliceState(state); expect(state).toEqual(data.final);
  }, 30_000);

  it('migrates the actual W92 result without healing, rewriting old sources or retroactively making it natural', () => {
    const prior = original(), bytes = JSON.stringify(prior.final), state = migrateSliceState(prior.final);
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION); expect(state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
    expect(state.wanderer).toEqual(createWandererState());
    expect(state).toMatchObject({ week: 92, health: 40, mind: 100, spirituality: 120, cash: 560, actionsRemaining: 3, progression: { sequence: 4, acting: 100 } });
    expect(state.secretsSorcerer.promotionWeek).toBe(80); expectOriginals(state, prior.final);
    expect(state.random).toEqual(prior.final.random); expect(state.injuries).toEqual(prior.final.injuries); expect(state.combatHistory).toEqual(prior.final.combatHistory);
    expect(JSON.stringify(prior.final)).toBe(bytes); assertValidSliceState(state);
  });

  it.each(['natural-first-death.json', 'natural-failure.json'])('keeps old natural failure %s dead and unpromoted instead of treating it as the new start', filename => {
    const prior = JSON.parse(readFileSync(`tests/fixtures/secrets-sorcerer-v01270/${filename}`, 'utf8'));
    const state = migrateSliceState(prior.final);
    expect(state.status).toBe('DEAD'); expect(state.health).toBe(0); expect(state.progression.sequence).toBe(5);
    expect(state.secretsSorcerer.promotionWeek).toBeNull(); expect(state.wanderer.promotionWeek).toBeNull();
    expect(state.random).toEqual(prior.final.random); expect(state.secretsSorcerer).toEqual(prior.final.secretsSorcerer); assertValidSliceState(state);
  });

  it('preserves the entire inherited pool, recorded abilities and original objects when the separate S3 bottle succeeds', () => {
    const state = read().promoted, prior = original().final; assertValidSliceState(state);
    expect(state.progression.sequence).toBe(3); expect(state.wanderer.secretsSorcererActingAtPromotion).toBe(100);
    expect(state.wanderer.promotionWeek! - state.secretsSorcerer.promotionWeek!).toBeGreaterThanOrEqual(12); expectOriginals(state, prior);
    for (const [id, mastery] of Object.entries(prior.progression.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
    expect(Object.keys(state.progression.mastery).filter(id => !Object.hasOwn(prior.progression.mastery, id))).toEqual([...WANDERER_ABILITY_IDS]);
    expect(WANDERER_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    const visible = projectSliceState(state); expect(visible.secretsSorcerer.acting).toBe(100);
    expect(visible.wanderer.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(state.progression.mastery).sort());
    expect(visible.wanderer).toMatchObject({ title: '漫游者·门序列3（有限离世往返）', promoted: true, formulaKnown: false, formula: [], currentGender: 'FEMALE' });
    expect(state.wanderer.life).toEqual(createWandererLifeState());
    expect(state.wanderer.encounter).toMatchObject({ status: 'AVAILABLE', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, targetId: 'WN3-CASSIAN' });
    expect(state.wanderer.bottles.filter(b => ['SUCCESS', 'GREAT_SUCCESS'].includes(b.outcome ?? ''))).toHaveLength(1);
    for (const bottle of state.wanderer.bottles.filter(b => b.status === 'CONSUMED')) {
      expect(bottle.consumedWeek).toBe(bottle.preparationWeek); expect(bottle.acquiredWeek).not.toBeNull(); expect(bottle.id).toMatch(/^wanderer-potion-/);
    }
  });

  it('replays every actual saved boundary with immutable input and original identities', () => {
    const boundaries = JSON.parse(readFileSync('tests/fixtures/wanderer-v01500/boundaries.json', 'utf8')) as Record<string, Boundary>;
    for (const name of ['guidance', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week', 'promotion', 'reflection', 'combat-first', 'combat-terminal']) expect(boundaries[name]).toBeTruthy();
    for (const captured of Object.values(boundaries)) {
      const state = migrateSliceState(captured.beforeLast), expected = migrateSliceState(captured.final); assertValidSliceState(state); assertValidSliceState(expected);
      const stateBytes = JSON.stringify(state), intentBytes = JSON.stringify(captured.lastIntent);
      expect(applySliceIntent(state, captured.lastIntent)).toEqual(expected); expect(JSON.stringify(state)).toBe(stateBytes); expect(JSON.stringify(captured.lastIntent)).toBe(intentBytes);
      expectOriginals(expected, original().final);
    }
  }, 30_000);

  it('completes three truthful reports and reflection100 with the same body back and all permits closed', () => {
    const state = read().practiced; assertValidSliceState(state);
    expect(state.progression).toMatchObject({ pathwayId: 'door', sequence: 3, acting: 100 });
    expect(Object.keys(state.wanderer.life.cases)).toEqual([...WANDERER_CASE_IDS]);
    expect(Object.values(state.wanderer.life.cases).every(scene => scene.status === 'RESOLVED' && !scene.contactOpen)).toBe(true);
    expect(state.wanderer.life).toMatchObject({ reflected: true, playerLocation: 'START' });
    expect(hasWandererLock(state)).toBe(false); expectOriginals(state, original().final);
    expect(state.seer.completedSources).toContain('wanderer-reflection');
  });

  it('keeps independently paid enemy resources and the actual terminal outcome without healing the old original B', () => {
    const state = read().final; assertValidSliceState(state); expect(state.combat).toBeNull(); expect(state.wanderer.encounter.terminal).not.toBeNull();
    const encounter = state.wanderer.encounter; expect(encounter.targetId).toBe('WN3-CASSIAN');
    const rounds = state.combatHistory.filter(round => round.wandererOutcome); expect(rounds.length).toBeGreaterThan(0);
    let paid = 0;
    for (const round of rounds) {
      const outcome = round.wandererOutcome!;
      paid += outcome.enemyActions.reduce((total, action) => total + action.paidCost, 0); expect(outcome.enemySpirituality).toBe(120 - paid);
    }
    expect(encounter.enemySpirituality).toBe(120 - paid); expectOriginals(state, original().final);
    if (state.status === 'DEAD') { expect(state.health).toBe(0); expect(state.ending?.kind).toBe('DEATH'); }
    else { expect(state.health).toBeGreaterThan(0); expect(hasWandererLock(state)).toBe(false); }
  });

  it('cannot reopen old S4 acquisition after S3 and cannot create free recorded abilities', () => {
    const state = read().promoted, bytes = JSON.stringify(state);
    expect(() => applySliceIntent(state, { type: 'SECRETS_SORCERER', command: { type: 'LEARN_GUIDANCE' } })).toThrow();
    const oldActions = projectSliceState(state).secretsSorcerer.actions;
    expect(oldActions.every(action => !action.enabled && !!action.reason)).toBe(true);
    expect(() => applySliceIntent(state, { type: 'SECRETS_SORCERER', command: { type: 'CONSUME', bottleId: state.secretsSorcerer.bottles[0]!.id, confirmed: true } })).toThrow();
    expect(JSON.stringify(state)).toBe(bytes); expect(state.recorder.records).toEqual(original().final.recorder.records);
  });

  it('retains every actual failed bottle and its paid preparation chronology', () => {
    const state = read().promoted;
    for (const bottle of state.wanderer.bottles.filter(b => ['FAILURE', 'GREAT_FAILURE'].includes(b.outcome ?? ''))) {
      expect(bottle.status).toBe('CONSUMED'); expect(bottle.consumedWeek).toBe(bottle.preparationWeek);
      expect(bottle.consumedWeek).toBeGreaterThanOrEqual(state.secretsSorcerer.promotionWeek! + 12); expect(bottle.consumedWeek).toBeLessThanOrEqual(state.wanderer.promotionWeek!);
    }
    expect(state.wanderer.preparedWeek).toBeNull(); expect(state.wanderer.preparations).toHaveLength(3);
  });

  it('replays the separately declared offworld success from the real predeparture boundary with only its explicit RNG change', { tags: ['historical-replay'] }, () => {
    const data = JSON.parse(readFileSync('tests/fixtures/wanderer-v01500/offworld-directed.json', 'utf8')) as {
      provenance: { kind: string; originalRandom: SliceState['random']; directedRandom: SliceState['random'] };
      initial: SliceState; commands: SliceIntent[]; final: SliceState;
    };
    const boundaries = JSON.parse(readFileSync('tests/fixtures/wanderer-v01500/boundaries.json', 'utf8')) as Record<string, Boundary>;
    const source = migrateSliceState(boundaries['offworld-depart']!.beforeLast), originalBytes = JSON.stringify(source);
    expect(data.provenance.kind).toBe('DIRECTED_OFFWORLD_SUCCESS_FROM_ACTUAL_PREDEPARTURE');
    expect(data.provenance.originalRandom).toEqual(source.random);
    expect(data.provenance.directedRandom).toEqual({ seed: 'secrets-sorcerer-directed-24', cursor: 0 });
    const expectedStart = structuredClone(source); expectedStart.random = structuredClone(data.provenance.directedRandom);
    expect(migrateSliceState(data.initial)).toEqual(expectedStart);
    expect(data.commands.map(command => command.type === 'WANDERER' ? command.command.type : command.type)).toEqual([
      'DEPART', 'CHECK_RETURN_MARKER', 'VIEW_HORIZON', 'TAKE_PACKET', 'RETURN_LOCAL', 'RETURN_PLAYER', 'RETURN_SUIT', 'INSPECT', 'CLOSE',
    ]);
    let state = migrateSliceState(data.initial);
    for (const command of data.commands) { state = applySliceIntent(state, command); assertValidSliceState(state); }
    expect(state).toEqual(migrateSliceState(data.final)); expect(JSON.stringify(source)).toBe(originalBytes);
    expect(state.wanderer.life).toMatchObject({ playerLocation: 'START', packet: { id: 'WN3-PACKET', location: 'PLAYER', offworldLegs: 1 }, suit: { id: 'WN3-SUIT', location: 'OWNER', protectionSeconds: 70 }, energy: { remaining: 0, spent: 2 } });
    expect(state.spirituality).toBe(source.spirituality - 16); expect(state.mind).toBe(source.mind - 6); expect(state.seer.pollution).toBe(source.seer.pollution + 3);
    const attempt = state.wanderer.life.cases['offworld-visit'].attempts.at(-1)!;
    expect(attempt).toMatchObject({ departed: true, returnedLocal: true, packetTaken: true, horizonViewed: true, closed: true, failedDeparture: false });
    expect(attempt.playerMoves.filter(move => move.mode === 'STAR_WANDERING').map(move => [move.from, move.to, move.metres, move.seconds])).toEqual([['PAD', 'REMOTE', null, 10], ['REMOTE', 'PAD', null, 10]]);
    for (const key of originalRoots) expect(state[key]).toEqual(source[key]);
  });

  it('does not overwrite the continued departure failure, untouched remote packet or actual later death with targeted success', () => {
    const continued = read(), targeted = JSON.parse(readFileSync('tests/fixtures/wanderer-v01500/offworld-directed.json', 'utf8'));
    const boundaries = JSON.parse(readFileSync('tests/fixtures/wanderer-v01500/boundaries.json', 'utf8')) as Record<string, Boundary>;
    const failed = migrateSliceState(boundaries['offworld-depart']!.final);
    expect(failed.wanderer.life).toMatchObject({ playerLocation: 'PAD', packet: { location: 'REMOTE' }, energy: { remaining: 1, spent: 1 } });
    expect(failed.wanderer.life.cases['offworld-visit'].attempts.at(-1)).toMatchObject({ departed: false, failedDeparture: true, abilityTier: 'FAILURE', mindLost: 5, pollutionAdded: 2 });
    expect(continued.practiced.wanderer.life.cases['offworld-visit']).toMatchObject({ status: 'RESOLVED', result: 'ORDINARY' });
    expect(continued.practiced.wanderer.life.packet.location).toBe('REMOTE'); expect(continued.practiced.progression.mastery['door.s3.star-wandering']).toBe(0);
    expect(continued.final.status).toBe('DEAD'); expect(continued.final.health).toBe(0); expect(continued.final.wanderer.encounter.terminal?.outcome).toBe('PLAYER_DEAD');
    expect(targeted.final.status).toBe('ACTIVE'); expect(targeted.final.wanderer.life.packet.location).toBe('PLAYER');
    expect(targeted.provenance.kind).not.toBe(continued.provenance.kind); expect(targeted.initial.random).not.toEqual(targeted.provenance.originalRandom);
  });

  it('uses a separate same-prefix peaceful continuation if the optional combat branch dies', () => {
    const actual = read(); if (actual.final.status !== 'DEAD') return;
    expect(existsSync('tests/fixtures/wanderer-v01500/peaceful.json')).toBe(true);
    const capture = JSON.parse(readFileSync('tests/fixtures/wanderer-v01500/peaceful.json', 'utf8')) as Capture & { sharedPublicPrefix: number; branch: string };
    expect(capture.branch).toBe('BEFORE_OPTIONAL_FIGHT'); expect(capture.prefixCount).toBe(60); expect(capture.seed).toBe(actual.seed);
    expect(capture.commands.slice(0, capture.sharedPublicPrefix)).toEqual(actual.commands.slice(0, capture.sharedPublicPrefix));
    expect(actual.commands[capture.sharedPublicPrefix]).toEqual({ type: 'WANDERER', command: { type: 'ENCOUNTER_FIGHT' } });
    expect(capture.commands[capture.sharedPublicPrefix]).toEqual({ type: 'WANDERER', command: { type: 'LEAVE_ENCOUNTER' } });
    expect(capture.commands.at(-1)).toEqual({ type: 'ACTION', action: 'WORK' });
    let state = migrateSliceState(capture.initial); for (const command of capture.commands) state = applySliceIntent(state, command);
    expect(state).toEqual(migrateSliceState(capture.final)); assertValidSliceState(state); expect(state.status).toBe('ACTIVE'); expect(state.health).toBeGreaterThan(0); expect(state.combat).toBeNull();
    expect(state.wanderer.encounter).toMatchObject({ status: 'RESOLVED', attemptWeek: null, terminal: null, enemyHealth: 100, enemyMind: 100, enemySpirituality: 120, weaponLocation: 'HAND' });
    expect(state.combatHistory).toEqual(original().final.combatHistory); expectOriginals(state, original().final); expect(actual.final.status).toBe('DEAD');
  }, 30_000);
});
