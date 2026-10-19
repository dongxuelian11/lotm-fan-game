import { describe, expect, it } from 'vitest';
import { stableStringify } from '../../src/domain/canonical.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceCombatRound, SlicePublicCombatRound, SliceState } from '../../src/domain/slice/types.js';
import {
  projectAttendantMysteriesAction, projectAttendantMysteriesCombat, projectAttendantMysteriesRoundOutcome,
  type AttendantMysteriesActionEvidence, type AttendantMysteriesRoundOutcome,
} from '../../src/domain/attendant-mysteries/combat.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/attendant-mysteries-v01860';
const FIXTURES = [
  'boundary-same-first-round-revalidated.json',
  'boundary-same-second-round-revalidated.json',
  'natural-battle.json',
] as const;
function captured(file: typeof FIXTURES[number]): SliceState {
  return migrateSliceState(readObjectEntry<unknown>(`${ROOT}/${file}`, 'final'));
}
function withoutActionReplay(a: AttendantMysteriesActionEvidence) {
  const { randomCursorBefore: _before, randomCursorAfter: _after, ...facts } = structuredClone(a);
  return facts;
}
function withoutOutcomeReplay(o: AttendantMysteriesRoundOutcome) {
  const { source: _source, randomCursorAfter: _cursor, playerActions, enemyActions, ...facts } = structuredClone(o);
  return { ...facts, playerActions: playerActions.map(withoutActionReplay), enemyActions: enemyActions.map(withoutActionReplay) };
}
function withoutRoundReplay(round: SliceCombatRound) {
  const { attendantMysteriesOutcome, ...facts } = structuredClone(round);
  if (!attendantMysteriesOutcome) throw new Error('Expected an original Attendant Mysteries round.');
  return { ...facts, attendantMysteriesOutcome: withoutOutcomeReplay(attendantMysteriesOutcome) };
}
function assertNoReplayData(value: unknown, path = ''): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((child, index) => assertNoReplayData(child, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    expect(['randomSeed', 'randomCursor', 'randomCursorBefore', 'randomCursorAfter', 'preparation', 'privateProbe'].includes(key), `${path}.${key}`).toBe(false);
    // A resolved check's public modifier label is deliberately named "source".
    if (key === 'source') expect(path, `${path}.${key}`).toMatch(/\.check\.modifiers\[\d+\]$/);
    assertNoReplayData(child, `${path}.${key}`);
  }
}
function objects(value: unknown, found = new Set<object>()): Set<object> {
  if (!value || typeof value !== 'object' || found.has(value)) return found;
  found.add(value); Object.values(value).forEach(child => objects(child, found)); return found;
}
function assertDetached(output: unknown, input: unknown): void {
  const originals = objects(input);
  for (const object of objects(output)) expect(originals.has(object), 'public objects must not alias their input').toBe(false);
}
function assertRound(actual: SlicePublicCombatRound | null, original: SliceCombatRound, name: string): void {
  expect(actual).toEqual(projectPlayerText(withoutRoundReplay(original), name));
  assertNoReplayData(actual!.attendantMysteriesOutcome);
  assertDetached(actual, original);
}

describe('Attendant Mysteries resolved public round allowlists', () => {
  it.each(FIXTURES)('keeps every public fact and hides replay data at all available entrances: %s', file => {
    // Migrate the real captured state; do not regenerate its campaign or alter any resource/RNG.
    const state = captured(file), before = stableStringify(state), view = projectSliceState(state);
    const original = state.lastCombatRound!, outcome = original.attendantMysteriesOutcome!;
    expect(outcome.source.randomSeed).toBe(state.random.seed);
    expect(outcome.source.preparation.randomSeed).toBe(state.random.seed);
    assertRound(view.lastCombatRound, original, state.character.name);
    for (const [index, round] of state.combatHistory.entries()) {
      if (round.attendantMysteriesOutcome) assertRound(view.combatHistory[index]!, round, state.character.name);
    }
    if (state.combat) {
      expect(state.combat.encounterId).toBe('ATTENDANT_MYSTERIES_DISPUTE');
      assertRound(view.combat!.lastRound, state.combat.lastRound!, state.character.name);
      expect(view.combat!.attendantMysteries).toEqual(projectPlayerText(projectAttendantMysteriesCombat(state), state.character.name));
      assertNoReplayData(view.combat!.attendantMysteries);
    } else {
      expect(file).toBe('natural-battle.json'); expect(view.combat).toBeNull();
      expect(state.attendantMysteries.encounter.terminal?.historyIndex).toBe(state.combatHistory.length - 1);
    }
    // The same helper also supports the existing terminal history fallback.
    const panel = projectAttendantMysteriesCombat(state);
    expect(panel.lastActionSequence).toEqual([...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order).map(withoutActionReplay));
    expect(panel.remnant).toEqual(state.attendantMysteries.encounter.remnant);
    expect(panel.powerUses).toEqual(state.attendantMysteries.encounter.powerUses);
    assertNoReplayData(panel); assertDetached(panel, state);
    expect(projectAttendantMysteriesRoundOutcome(outcome)).toEqual(withoutOutcomeReplay(outcome));
    expect(stableStringify(state)).toBe(before);
  }, 20_000);

  it('keeps resolved checks, public modifier sources, actual costs and original material facts', () => {
    const state = captured('natural-battle.json'), outcome = state.lastCombatRound!.attendantMysteriesOutcome!;
    const original = outcome.playerActions.find(action => action.check !== null && action.segmentId !== null)!;
    expect(original).toBeDefined();
    const actual = projectAttendantMysteriesAction(original);
    expect(actual).toEqual(withoutActionReplay(original));
    expect(actual).toMatchObject({ paidCost: 6, mindCost: 1, segmentId: 'AM1-REMNANT-1-SEGMENT-1' });
    expect(actual.sourceId).toBe(original.sourceId);
    expect(actual.remnantAfter.alive).toBe(false);
    expect(actual.remnantAfter.segments.find(segment => segment.id === actual.segmentId)?.status).toBe('SPENT');
    expect(actual.check).toEqual(original.check);
    // The capture has no modifiers. Exercise the public modifier shape on a detached helper input only.
    const withModifier = structuredClone(original);
    withModifier.check = { ...withModifier.check!, modifiers: [{ source: '已发生检定的公开修正说明', value: 0 }] };
    const before = stableStringify(withModifier), projected = projectAttendantMysteriesAction(withModifier);
    expect(projected.check!.modifiers).toEqual([{ source: '已发生检定的公开修正说明', value: 0 }]);
    assertNoReplayData({ action: projected }); assertDetached(projected, withModifier);
    expect(stableStringify(withModifier)).toBe(before);
  });

  it('does not copy unknown nested replay additions through known public objects', () => {
    const state = captured('natural-battle.json');
    const outcome = structuredClone(state.lastCombatRound!.attendantMysteriesOutcome!);
    const addPrivate = (value: object) => Object.assign(value, { privateProbe: { randomSeed: 'not-public' } });
    addPrivate(outcome); addPrivate(outcome.rootAfter); addPrivate(outcome.remnantAfter); addPrivate(outcome.remnantAfter.segments[0]!);
    addPrivate(outcome.powerUses); addPrivate(outcome.masteryAfter);
    for (const injury of [...outcome.enemyInjuries, ...outcome.playerInjuriesAfter]) addPrivate(injury);
    for (const pending of outcome.expiredPending) addPrivate(pending);
    for (const action of [...outcome.playerActions, ...outcome.enemyActions]) {
      addPrivate(action); addPrivate(action.remnantBefore); addPrivate(action.remnantAfter);
      for (const segment of [...action.remnantBefore.segments, ...action.remnantAfter.segments]) addPrivate(segment);
      for (const pending of [...action.pendingBefore, ...action.pendingAfter]) addPrivate(pending);
      if (action.check) {
        addPrivate(action.check);
        action.check = { ...action.check, modifiers: [{ source: '公开说明仍保留', value: 0 }] }; addPrivate(action.check.modifiers[0]!);
      }
    }
    const before = stableStringify(outcome), projected = projectAttendantMysteriesRoundOutcome(outcome);
    assertNoReplayData(projected); assertDetached(projected, outcome);
    expect(projected.playerActions.find(action => action.check)?.check?.modifiers).toEqual([{ source: '公开说明仍保留', value: 0 }]);
    expect(stableStringify(outcome)).toBe(before);
  });

  it('returns detached nested facts for outcomes, action sequences and repeated projections', () => {
    const state = captured('boundary-same-second-round-revalidated.json'), before = stableStringify(state);
    const outcome = state.lastCombatRound!.attendantMysteriesOutcome!, projected = projectAttendantMysteriesRoundOutcome(outcome);
    const panel = projectAttendantMysteriesCombat(state), secondPanel = projectAttendantMysteriesCombat(state);
    assertDetached(projected, outcome); assertDetached(panel, state); assertDetached(secondPanel, panel);
    assertDetached(projected, panel);
    projected.rootAfter.clockSeconds++; projected.remnantAfter.segments[0]!.status = 'SPENT';
    projected.powerUses.ARC_BOLT++; projected.playerInjuriesAfter[0]!.treatedRevision = state.revision;
    panel.lastActionSequence[0]!.label = 'changed only in this projection';
    Object.assign(panel.lastActionSequence.find(action => action.check)!.check!, { roll: 1 });
    panel.lastActionSequence.find(action => action.pendingAfter.length)!.pendingAfter[0]!.remaining = 1;
    panel.remnant.segments[0]!.status = 'SPENT'; panel.countWheel[0]!.weight = 0;
    expect(projectAttendantMysteriesCombat(state)).toEqual(secondPanel);
    expect(stableStringify(state)).toBe(before);
  });
});
