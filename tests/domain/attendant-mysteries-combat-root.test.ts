import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { applySliceIntent, assertValidSliceState, projectSliceState, validateSlicePayload } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { validateAttendantMysteriesCombatRound } from '../../src/domain/attendant-mysteries/combat.js';
import { attendantMysteriesSourceDigest } from '../../src/domain/attendant-mysteries/ritual.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const BOUNDARIES = {
  first: 'tests/fixtures/attendant-mysteries-v01860/boundary-same-first-round-revalidated.json',
  second: 'tests/fixtures/attendant-mysteries-v01860/boundary-same-second-round-revalidated.json',
} as const;
const entry = <T>(key: string, which: keyof typeof BOUNDARIES = 'first'): T => readObjectEntry<T>(BOUNDARIES[which], key);
const same = (actual: unknown, expected: unknown, label?: string): void => {
  expect(stableStringify(actual), label).toBe(stableStringify(expected));
};
function state(key: 'beforeLast' | 'final', which: keyof typeof BOUNDARIES = 'first'): SliceState {
  const value = migrateSliceState(entry<unknown>(key, which));
  assertValidSliceState(value);
  return value;
}
function mutateCurrentRounds(s: SliceState, mutate: (round: SliceCombatRound) => void): void {
  const rounds = new Set([s.combat!.lastRound, s.lastCombatRound, s.combatHistory.at(-1)]);
  for (const round of rounds) { expect(round).toBeTruthy(); mutate(round!); }
}

/** The exact first two natural battle boundaries, with no new creation, cursor search,
 * source replacement, reroll, repaired resources or deleted ordinary history. */
describe('Attendant Mysteries original first two root save boundaries', () => {
  it('replays the unchanged original intent to the same complete state and leaves the source intact', () => {
    const before = state('beforeLast'), intent = entry<SliceIntent>('lastIntent'), expected = state('final');
    const beforeBytes = stableStringify(before), intentBytes = stableStringify(intent);
    expect(intent).toEqual({ type: 'COMBAT_ROUND', stance: 'DEFEND' });
    expect(validateSlicePayload(intent)).toBe(true);
    expect(before.combat).toMatchObject({ encounterId: 'ATTENDANT_MYSTERIES_DISPUTE', round: 1 });
    expect(before).toMatchObject({ revision: 1864, health: 100, random: { seed: 'seer-rebuild-first', cursor: 900 } });
    const first = applySliceIntent(before, intent), second = applySliceIntent(structuredClone(before), structuredClone(intent));
    same(first, expected, 'complete state equals the unchanged natural result');
    same(second, first, 'same boundary and same intent');
    expect(stableStringify(before)).toBe(beforeBytes); expect(stableStringify(intent)).toBe(intentBytes);
    expect(first).toMatchObject({ revision: 1865, health: 90, mind: 100, spirituality: 120, random: { seed: 'seer-rebuild-first', cursor: 912 } });
    expect(first.lastCombatRound).toMatchObject({ round: 1, stance: 'DEFEND', winner: 'ENEMY', consequenceDomain: 'BODY', consequenceRoll: 27 });
    expect(validateAttendantMysteriesCombatRound(first.lastCombatRound!)).toBe(true);
    assertValidSliceState(first); assertValidSliceState(second);
  });

  it('preserves the canonical saved state and public projection across JSON storage and migration', () => {
    const before = state('beforeLast'), intent = entry<SliceIntent>('lastIntent'), expected = state('final');
    const actual = applySliceIntent(before, intent), saved = stableStringify(actual);
    const restored: unknown = JSON.parse(saved); assertValidSliceState(restored);
    same(restored, expected); expect(stableStringify(restored)).toBe(saved);
    same(projectSliceState(actual), projectSliceState(expected), 'original public projection');
    same(projectSliceState(restored), projectSliceState(actual), 'restored public projection');
    const migrated = migrateSliceState(restored); assertValidSliceState(migrated);
    same(migrated, actual, 'current-format migration must not repair the battle');
    same(projectSliceState(migrated), projectSliceState(actual));
  }, 10_000);

  it('keeps the real ordinary history, all old rounds, original town and life resources unchanged', () => {
    const before = state('beforeLast'), after = state('final');
    for (const key of ['seer', 'clown', 'magician', 'faceless', 'marionettist', 'bizarroSorcerer', 'ancientScholar', 'miracleWorker'] as const) same(after[key], before[key], key);
    same(after.character, before.character);
    for (const key of ['life', 'town', 'townJournal', 'acquisitionJournal', 'reception', 'batches', 'bottles', 'resupply', 'preparation'] as const) same(after.attendantMysteries[key], before.attendantMysteries[key], key);
    expect(attendantMysteriesSourceDigest(after)).toBe(attendantMysteriesSourceDigest(before));
    expect(after.combatHistory).toHaveLength(before.combatHistory.length + 1);
    same(after.combatHistory.slice(0, before.combatHistory.length), before.combatHistory, 'sealed ordinary combat prefix');
    same(after.combatHistory.at(-1), after.lastCombatRound);
    same(after.combat!.lastRound, after.lastCombatRound);
    expect([after.runId, after.random.seed, after.week, after.cash, after.actionsRemaining]).toEqual([before.runId, before.random.seed, before.week, before.cash, before.actionsRemaining]);
    same(after.date, before.date);
  });

  it('replays the original second round with five actual enemy slots and no invented consequence domain', () => {
    const before = state('beforeLast', 'second'), intent = entry<SliceIntent>('lastIntent', 'second'), expected = state('final', 'second');
    same(before, state('final'), 'second round starts at the exact original first result');
    const beforeBytes = stableStringify(before), intentBytes = stableStringify(intent);
    expect(intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' }); expect(validateSlicePayload(intent)).toBe(true);
    const actual = applySliceIntent(before, intent), repeated = applySliceIntent(structuredClone(before), structuredClone(intent));
    same(actual, expected); same(repeated, actual);
    expect(stableStringify(before)).toBe(beforeBytes); expect(stableStringify(intent)).toBe(intentBytes);
    expect(actual).toMatchObject({ revision: 1866, health: 90, mind: 98, spirituality: 120, random: { seed: 'seer-rebuild-first', cursor: 922 } });
    expect(actual.lastCombatRound).toMatchObject({ round: 2, stance: 'CONTROL', winner: 'PLAYER', playerCount: 1, enemyCount: 5, consequenceWeights: null });
    expect(actual.lastCombatRound!.moves).toHaveLength(6);
    expect(Object.hasOwn(actual.lastCombatRound!, 'consequenceDomain')).toBe(false);
    expect(Object.hasOwn(actual.lastCombatRound!, 'consequenceRoll')).toBe(false);
    expect(validateAttendantMysteriesCombatRound(actual.lastCombatRound!)).toBe(true); assertValidSliceState(actual);
    const saved = stableStringify(actual), restored: unknown = JSON.parse(saved); assertValidSliceState(restored);
    same(restored, expected); same(migrateSliceState(restored), actual);
    same(projectSliceState(actual), projectSliceState(expected)); same(projectSliceState(restored), projectSliceState(actual));
    for (const key of ['seer', 'clown', 'magician', 'faceless', 'marionettist', 'bizarroSorcerer', 'ancientScholar', 'miracleWorker'] as const) same(actual[key], before[key], key);
    for (const key of ['life', 'town', 'townJournal', 'acquisitionJournal', 'reception', 'batches', 'bottles', 'resupply', 'preparation'] as const) same(actual.attendantMysteries[key], before.attendantMysteries[key], key);
    same(actual.combatHistory.slice(0, before.combatHistory.length), before.combatHistory);
    expect(attendantMysteriesSourceDigest(actual)).toBe(attendantMysteriesSourceDigest(before));
  }, 10_000);

  it.each(['in-range-six-enemies', 'over-limit-seven-enemies', 'over-limit-thirteen-moves'] as const)('keeps exact replay and the six-slot bound against %s forgery', kind => {
    const forged = state('final', 'second');
    mutateCurrentRounds(forged, round => {
      if (kind === 'in-range-six-enemies') round.enemyCount = 6;
      else if (kind === 'over-limit-seven-enemies') round.enemyCount = 7;
      else round.moves = Array.from({ length: 13 }, (_, i) => structuredClone(round.moves[i % round.moves.length]!));
    });
    const before = stableStringify(forged);
    expect(validateAttendantMysteriesCombatRound(forged.lastCombatRound!)).toBe(false);
    expect(() => assertValidSliceState(forged)).toThrow(TypeError); expect(stableStringify(forged)).toBe(before);
  });

  const forgeries: { label: string; mutate: (round: SliceCombatRound) => void }[] = [
    { label: 'changed mental consequence', mutate: r => { r.consequenceDomain = 'MENTAL'; } },
    { label: 'unsupported consequence enum', mutate: r => { (r as unknown as Record<string, unknown>).consequenceDomain = 'ARC'; } },
    { label: 'missing original outcome', mutate: r => { delete r.attendantMysteriesOutcome; } },
    { label: 'extra unrecognized field', mutate: r => { (r as unknown as Record<string, unknown>).freeRecovery = 10; } },
    { label: 'altered original source cursor', mutate: r => { r.attendantMysteriesOutcome!.source.randomCursor++; } },
    { label: 'altered original health consequence', mutate: r => { r.attendantMysteriesOutcome!.playerHealthAfter++; } },
  ];
  it.each(forgeries)('rejects $label without repairing the forged input', ({ mutate }) => {
    const forged = state('final'); mutateCurrentRounds(forged, mutate); const before = stableStringify(forged);
    expect(() => assertValidSliceState(forged)).toThrow(TypeError);
    expect(stableStringify(forged)).toBe(before);
  });

  it('does not authorize a newly invented consequenceDomain on the original Miracle Worker round', () => {
    const original = state('beforeLast'), forged = structuredClone(original);
    expect(forged.lastCombatRound!.miracleWorkerOutcome).toBeDefined();
    expect(Object.hasOwn(forged.lastCombatRound!, 'consequenceDomain')).toBe(false);
    forged.lastCombatRound!.consequenceDomain = 'BODY'; const before = stableStringify(forged);
    expect(() => assertValidSliceState(forged)).toThrow(TypeError);
    expect(stableStringify(forged)).toBe(before); assertValidSliceState(original);
  });
});
