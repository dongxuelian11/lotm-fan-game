import { afterEach, describe, expect, it, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceStance, SliceState } from '../../src/domain/slice/types';
import {
  blockSilverKnightEncounter, currentSilverKnightHunt, SILVER_KNIGHT_SPECIES,
  validateSilverKnightEncounter, validateSilverKnightEncounterCommand,
  type SilverKnightEncounterCommand, type SilverKnightSpeciesId,
} from '../../src/domain/silver-knight/encounter';
import { validateSilverKnightRoundOutcome } from '../../src/domain/silver-knight/combat';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random';

interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const historicalPath = 'tests/fixtures/silver-knight-v01520/boundaries.json';
const originalRoots = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter'] as const;
const cache = new Map<string, Boundary>();
function boundary(key: string, path = historicalPath): Boundary {
  const id = `${path}:${key}`;
  if (!cache.has(id)) cache.set(id, readObjectEntry<Boundary>(path, key));
  return structuredClone(cache.get(id)!);
}
function initial(): SliceState {
  const s = migrateSliceState(boundary('rock_husk-investigate').beforeLast);
  assertValidSliceState(s);
  return s;
}
function submit(s: SliceState, command: SilverKnightEncounterCommand): SliceState {
  const next = applySliceIntent(s, { type: 'SILVER_KNIGHT', command });
  assertValidSliceState(next);
  return next;
}
function start(speciesId: SilverKnightSpeciesId = 'ROCK_HUSK', version?: 2): SliceState {
  const command: SilverKnightEncounterCommand = version === 2
    ? { type: 'INVESTIGATE_HUNT', speciesId, huntBehaviorVersion: 2 }
    : { type: 'INVESTIGATE_HUNT', speciesId };
  return submit(submit(initial(), command), { type: 'HUNT_FIGHT', speciesId });
}

/**
 * DIRECTED UNIT TEST ONLY. The starting saves are actual, unchanged boundaries.
 * These scripted draws are deliberately selected to exercise specific injury branches;
 * they are not a natural campaign, a new natural fixture, or evidence of natural success.
 * Each draw still calls the original stream once, preserving its real cursor consumption.
 * All state changes below use the same public command path as the game.
 */
function directedRound(s: SliceState, stance: SliceStance, ...values: number[]): SliceState {
  const original = DeterministicActionRandomStream.prototype.nextInt;
  let cursor = 0;
  const spy = vi.spyOn(DeterministicActionRandomStream.prototype, 'nextInt')
    .mockImplementation(function (this: DeterministicActionRandomStream, min, max) {
      original.call(this, min, max);
      const value = values[cursor++];
      if (value === undefined || value < min || value > max)
        throw new Error(`Unexpected directed draw ${cursor}: ${value}; expected ${min}..${max}`);
      return value;
    });
  try {
    const next = applySliceIntent(s, { type: 'COMBAT_ROUND', stance });
    expect(spy).toHaveBeenCalledTimes(values.length);
    expect(next.random).toEqual({ ...s.random, cursor: s.random.cursor + values.length });
    assertValidSliceState(next);
    return next;
  } finally { spy.mockRestore(); }
}
function heavy(s: SliceState, roll = 70): SliceState {
  // One actual dawn/ordinary strike and one enemy PRIMARY; player wins, HEAVY.
  return directedRound(s, 'ATTACK', 1, 1, 1, 1, 1, roll);
}
afterEach(() => vi.restoreAllMocks());

describe('Silver Knight per-body hunt behavior v2, with untouched historical boundaries', () => {
  it('accepts only omitted or literal2 investigation versions at both public validators', () => {
    for (const command of [
      { type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK' },
      { type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK', huntBehaviorVersion: 2 },
    ]) {
      expect(validateSilverKnightEncounterCommand(command)).toBe(true);
      expect(validateSlicePayload({ type: 'SILVER_KNIGHT', command })).toBe(true);
    }
    const invalid: unknown[] = [
      ...[undefined, null, 0, 1, 3, '2', true].map(huntBehaviorVersion => ({
        type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK', huntBehaviorVersion,
      })),
      { type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK', huntBehaviorVersion: 2, free: true },
      { type: 'INVESTIGATE_HUNT', speciesId: 'DH4-CINDER-GUARD', huntBehaviorVersion: 2 },
      ...['PREPARE_HUNT', 'HUNT_FIGHT', 'COLLECT_REMAINS'].map(type => ({ type, speciesId: 'ROCK_HUSK', huntBehaviorVersion: 2 })),
      { type: 'ENCOUNTER_TALK', huntBehaviorVersion: 2 },
    ];
    for (const command of invalid) {
      expect(validateSilverKnightEncounterCommand(command)).toBe(false);
      expect(validateSlicePayload({ type: 'SILVER_KNIGHT', command })).toBe(false);
    }
  });

  it('projects current UI investigations as v2 without mutating unseen or historical bodies', () => {
    const before = initial(), snapshot = structuredClone(before);
    const view = projectSliceState(before).silverKnight;
    for (const actions of [view.actions, view.encounter.actions]) {
      const investigations = actions.filter(a => a.command.type === 'INVESTIGATE_HUNT');
      expect(investigations).toHaveLength(6);
      expect(investigations.every(a => 'huntBehaviorVersion' in a.command && a.command.huntBehaviorVersion === 2)).toBe(true);
    }
    expect(before).toEqual(snapshot);
    expect(before.silverKnight.encounter.hunts.every(b => !Object.hasOwn(b, 'huntBehaviorVersion'))).toBe(true);
    const action = view.encounter.actions.find(a => a.command.type === 'INVESTIGATE_HUNT' && a.command.speciesId === 'ROCK_HUSK')!;
    expect(action.enabled).toBe(true);
    const after = submit(before, action.command);
    expect(currentSilverKnightHunt(after, 'ROCK_HUSK')).toMatchObject({
      id: 'SK3-HUNT-ROCK_HUSK-1', status: 'TRACKED', huntBehaviorVersion: 2,
    });
    for (const species of SILVER_KNIGHT_SPECIES.filter(id => id !== 'ROCK_HUSK'))
      expect(currentSilverKnightHunt(after, species)).toEqual(currentSilverKnightHunt(before, species));
    expect(after.silverKnight.encounter.post).toEqual(before.silverKnight.encounter.post);
    for (const root of originalRoots) expect(after[root]).toEqual(before[root]);
    expect(after.random).toEqual(before.random);
  });

  it('replays old unversioned investigation and combat boundaries exactly without migration backfill', () => {
    for (const key of ['rock_husk-investigate', 'rock_husk-first', 'rock_husk-terminal']) {
      const raw = boundary(key), untouched = structuredClone(raw);
      const before = migrateSliceState(raw.beforeLast), expected = migrateSliceState(raw.final);
      expect(before.silverKnight.encounter).toEqual(raw.beforeLast.silverKnight.encounter);
      const after = applySliceIntent(before, raw.lastIntent);
      expect(after).toEqual(expected);
      expect(raw).toEqual(untouched);
      expect(after.silverKnight.encounter.hunts.every(b => !Object.hasOwn(b, 'huntBehaviorVersion'))).toBe(true);
      assertValidSliceState(after);
    }
  });

  it('cannot convert an already investigated old body by repeating investigation with v2', () => {
    const s = submit(initial(), { type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK' });
    const before = structuredClone(s);
    const command = { type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK', huntBehaviorVersion: 2 } as const;
    expect(blockSilverKnightEncounter(s, command)).not.toBeNull();
    expect(() => submit(s, command)).toThrow();
    expect(s).toEqual(before);
    expect(Object.hasOwn(currentSilverKnightHunt(s, 'ROCK_HUSK'), 'huntBehaviorVersion')).toBe(false);
  });

  it('preserves the two actual surrendered originals and writes v2 only on the next real sighting', () => {
    const raw = boundary('rock_husk-investigate', 'tests/fixtures/preparation-audit-v01630/silver-boundaries.json');
    const before = migrateSliceState(raw.beforeLast), bodies = structuredClone(before.silverKnight.encounter.hunts);
    const surrendered = bodies.filter(b => b.speciesId === 'ROCK_HUSK' && b.status === 'SURRENDERED');
    expect(surrendered).toHaveLength(2);
    for (const b of surrendered) {
      expect(b).toMatchObject({ enemyHealth: 70, enemyStatus: 'SURRENDERED', remainsId: null });
      expect(Object.hasOwn(b, 'huntBehaviorVersion')).toBe(false);
    }
    for (const type of ['HUNT_FIGHT', 'COLLECT_REMAINS'] as const) {
      expect(blockSilverKnightEncounter(before, { type, speciesId: 'ROCK_HUSK' })).not.toBeNull();
      expect(() => submit(before, { type, speciesId: 'ROCK_HUSK' })).toThrow();
    }
    const after = submit(before, { type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK', huntBehaviorVersion: 2 });
    expect(after.silverKnight.encounter.hunts.slice(0, bodies.length)).toEqual(bodies);
    expect(after.silverKnight.encounter.hunts).toHaveLength(bodies.length + 1);
    expect(currentSilverKnightHunt(after, 'ROCK_HUSK')).toMatchObject({
      id: 'SK3-HUNT-ROCK_HUSK-3', instance: 3, status: 'TRACKED', huntBehaviorVersion: 2,
      enemyHealth: 100, enemyStatus: 'RESISTING', remainsId: null,
    });
    expect(after.silverKnight.encounter.remains).toEqual(before.silverKnight.encounter.remains);
    expect(after.random).toEqual(before.random);
  });

  it.each(SILVER_KNIGHT_SPECIES)('%s v2 continues on positive-health HEAVY with the same draws, damage, risks and paid actions', species => {
    const modernStart = start(species, 2), oldStart = start(species);
    const modern = heavy(modernStart), historical = heavy(oldStart);
    const b = currentSilverKnightHunt(modern, species), oldBody = currentSilverKnightHunt(historical, species);
    const round = modern.lastCombatRound!, oldRound = historical.lastCombatRound!;
    const outcome = round.silverKnightOutcome!, oldOutcome = oldRound.silverKnightOutcome!;
    expect(b).toMatchObject({ huntBehaviorVersion: 2, status: 'FIGHTING', enemyStatus: 'RESISTING', enemyHealth: 70, enemyRisk: 0, remainsId: null });
    expect(b.enemyInjuries).toHaveLength(1);
    expect(b.enemyInjuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
    expect(b.attempts.at(-1)?.terminal).toBeNull();
    expect(modern.combat).toMatchObject({ enemyHealth: 70, enemyStatus: 'RESISTING', round: 2 });
    expect(outcome).toMatchObject({ continuing: true, source: { mode: 'HUNT', huntBehaviorVersion: 2 } });
    expect(oldBody).toMatchObject({ status: 'SURRENDERED', enemyStatus: 'SURRENDERED', enemyHealth: 70, remainsId: null });
    expect(oldBody.attempts.at(-1)?.terminal?.outcome).toBe('ENEMY_SURRENDERED');
    expect(Object.hasOwn(oldOutcome.source, 'huntBehaviorVersion')).toBe(false);
    expect(round.consequenceWeights).toEqual({ light: 65, heavy: 30, death: 5 });
    expect(round.consequenceWeights).toEqual(oldRound.consequenceWeights);
    expect(round.consequenceRoll).toBe(70);
    expect(round.winner).toBe('PLAYER');
    expect(outcome.playerActions).toEqual(oldOutcome.playerActions);
    expect(outcome.enemyActions).toEqual(oldOutcome.enemyActions);
    expect(outcome.playerSpiritualityAfter).toBe(oldOutcome.playerSpiritualityAfter);
    expect(outcome.enemyRiskAfter).toBe(oldOutcome.enemyRiskAfter);
    expect(outcome.enemyInjuriesAfter).toEqual(oldOutcome.enemyInjuriesAfter);
    expect(b.resources.enemySpirituality).toBe(oldBody.resources.enemySpirituality);
    expect(b.resources.spentSpirituality).toBe(oldBody.resources.spentSpirituality);
    expect(b.resources.powerUses).toEqual(oldBody.resources.powerUses);
    expect(modern.random).toEqual(historical.random);
    expect(modern.spirituality).toBe(Math.min(120, outcome.playerSpiritualityAfter + 12));
    expect(validateSilverKnightRoundOutcome(outcome)).toBe(true);
    expect(modern.silverKnight.encounter.remains).toEqual(modernStart.silverKnight.encounter.remains);
    expect(blockSilverKnightEncounter(modern, { type: 'COLLECT_REMAINS', speciesId: species })).not.toBeNull();
  });

  it('keeps actual post-promotion human HEAVY surrender and never creates hunt remains', () => {
    const raw = boundary('directed-post-first', 'tests/fixtures/silver-knight-v01520/directed-boundaries.json');
    const before = migrateSliceState(raw.beforeLast);
    assertValidSliceState(before);
    expect(before.combat).toMatchObject({ encounterId: 'SILVER_KNIGHT_DISPUTE', round: 1 });
    const after = heavy(before);
    expect(after.silverKnight.encounter.post).toMatchObject({
      id: 'SK3-LORCAN', speciesId: null, enemyHealth: 70, enemyStatus: 'SURRENDERED', status: 'SURRENDERED', remainsId: null,
    });
    expect(Object.hasOwn(after.silverKnight.encounter.post, 'huntBehaviorVersion')).toBe(false);
    expect(after.lastCombatRound!.silverKnightOutcome).toMatchObject({ continuing: false, source: { mode: 'POST' } });
    expect(after.silverKnight.encounter.remains).toEqual(before.silverKnight.encounter.remains);
  });

  it('actually retreats after v2 HEAVY and retries the same injured body with all spent resources retained', () => {
    const injured = heavy(start('ROCK_HUSK', 2)), before = currentSilverKnightHunt(injured, 'ROCK_HUSK');
    // Even round: actual enemy PRIMARY first, then successful ordinary ground retreat.
    const withdrawn = directedRound(injured, 'RETREAT', 1, 1, 1, 1);
    const saved = structuredClone(currentSilverKnightHunt(withdrawn, 'ROCK_HUSK'));
    expect(saved).toMatchObject({ id: before.id, huntBehaviorVersion: 2, status: 'RETREATED', enemyHealth: 70, enemyStatus: 'RESISTING' });
    expect(saved.enemyInjuries).toEqual(before.enemyInjuries);
    expect(saved.enemyRisk).toBe(before.enemyRisk);
    expect(saved.resources.enemySpirituality).toBe(before.resources.enemySpirituality - 6);
    expect(saved.resources.spentSpirituality).toBe(before.resources.spentSpirituality + 6);
    expect(saved.attempts.at(-1)?.terminal?.outcome).toBe('RETREATED');
    expect(withdrawn.silverKnight.encounter.scene.playerPosition).toBe('OUTSIDE');
    expect(withdrawn.health).toBe(injured.health);
    expect(withdrawn.injuries).toEqual(injured.injuries);
    const retry = submit(withdrawn, { type: 'HUNT_FIGHT', speciesId: 'ROCK_HUSK' });
    const same = currentSilverKnightHunt(retry, 'ROCK_HUSK');
    expect(same.id).toBe(saved.id);
    expect(same.resources).toEqual(saved.resources);
    expect(same.enemyInjuries).toEqual(saved.enemyInjuries);
    expect(same.enemyRisk).toBe(saved.enemyRisk);
    expect(same.attempts).toHaveLength(2);
    expect(retry.combat).toMatchObject({ round: 1, enemyHealth: 70, enemyStatus: 'RESISTING' });
  });

  it('collects a unique corpse only after an actual death-wheel outcome, retaining v2 provenance', () => {
    const started = start('ROCK_HUSK', 2);
    const dead = directedRound(started, 'ATTACK', 1, 1, 1, 1, 1, 100);
    expect(currentSilverKnightHunt(dead, 'ROCK_HUSK')).toMatchObject({ status: 'DEAD', enemyHealth: 0, enemyStatus: 'DEAD', huntBehaviorVersion: 2, remainsId: null });
    expect(dead.silverKnight.encounter.remains).toEqual([]);
    expect(dead.lastCombatRound!.consequenceRoll).toBe(100);
    const collected = submit(dead, { type: 'COLLECT_REMAINS', speciesId: 'ROCK_HUSK' });
    expect(collected.silverKnight.encounter.remains).toEqual([expect.objectContaining({
      instanceId: 'SK3-HUNT-ROCK_HUSK-1', outcome: 'ENEMY_DEAD', killedBy: 'PLAYER', status: 'OWNER_PLAYER',
    })]);
    expect(() => submit(collected, { type: 'COLLECT_REMAINS', speciesId: 'ROCK_HUSK' })).toThrow();
  });

  it('retains cumulative risk and dies when repeated real HEAVY damage reaches H0', () => {
    let s = start('ROCK_HUSK', 2);
    for (const [index, health] of [70, 40, 10, 0].entries()) {
      s = heavy(s, index === 3 ? 60 : 70);
      const b = currentSilverKnightHunt(s, 'ROCK_HUSK');
      expect(b.enemyHealth).toBe(health);
      expect(b.enemyRisk).toBe(index);
      expect(b.enemyInjuries).toHaveLength(index + 1);
      expect(b.enemyInjuries.every(i => i.severity === 'HEAVY')).toBe(true);
      expect(s.lastCombatRound!.consequenceWeights).toEqual({ light: 65 - index * 10, heavy: 30, death: 5 + index * 10 });
      expect(b.enemyStatus).toBe(health === 0 ? 'DEAD' : 'RESISTING');
    }
    expect(currentSilverKnightHunt(s, 'ROCK_HUSK').attempts.at(-1)?.terminal?.outcome).toBe('ENEMY_DEAD');
    expect(s.silverKnight.encounter.remains).toEqual([]);
    expect(blockSilverKnightEncounter(s, { type: 'COLLECT_REMAINS', speciesId: 'ROCK_HUSK' })).toBeNull();
  });

  it('rejects illegal saved versions, premature assignment, human assignment and history/body mismatch', () => {
    const tracked = submit(initial(), { type: 'INVESTIGATE_HUNT', speciesId: 'ROCK_HUSK', huntBehaviorVersion: 2 });
    for (const value of [undefined, null, 0, 1, 3, '2', true]) {
      const forged = structuredClone(tracked);
      Object.assign(currentSilverKnightHunt(forged, 'ROCK_HUSK'), { huntBehaviorVersion: value });
      expect(validateSilverKnightEncounter(forged)).toBe(false);
    }
    const unseen = initial();
    currentSilverKnightHunt(unseen, 'ROCK_HUSK').huntBehaviorVersion = 2;
    expect(validateSilverKnightEncounter(unseen)).toBe(false);
    const human = structuredClone(tracked);
    human.silverKnight.encounter.post.huntBehaviorVersion = 2;
    expect(validateSilverKnightEncounter(human)).toBe(false);
    const continued = heavy(start('ROCK_HUSK', 2));
    delete currentSilverKnightHunt(continued, 'ROCK_HUSK').huntBehaviorVersion;
    expect(validateSilverKnightEncounter(continued)).toBe(false);
    const surrendered = heavy(start());
    currentSilverKnightHunt(surrendered, 'ROCK_HUSK').huntBehaviorVersion = 2;
    expect(validateSilverKnightEncounter(surrendered)).toBe(false);
  });
});
