import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applySliceIntent, assertValidSliceState, createSliceRun } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';

interface HistoricalCapture {
  creation: Parameters<typeof createSliceRun>[1];
  seed: string;
  commands: SliceIntent[];
  final: Pick<SliceState, 'runId' | 'chronicle' | 'caseArchive' | 'arc' | 'seer'>;
}

const capture = JSON.parse(readFileSync(
  new URL('../fixtures/ancient-scholar-v01400/natural.json', import.meta.url), 'utf8',
)) as HistoricalCapture;

describe('historical Seer commands keep their recorded meaning', () => {
  it('replays the first 43 recorded commands with exact stored prose and immediate legacy delivery', () => {
    // Keep the frozen capture untouched: no migration, prose normalization or new projected commands.
    const commands = capture.commands.slice(0, 43);
    const chronicle = capture.final.chronicle.slice(0, 69);
    expect(commands).toHaveLength(43);
    expect(commands[42]).toEqual({
      type: 'SEER', command: { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'sight' },
    });

    let state = createSliceRun(capture.final.runId, capture.creation, capture.seed);
    for (const [index, command] of commands.slice(0, 42).entries()) {
      state = applySliceIntent(state, command);
      if (index === 2) expect(state.lastResult).toEqual(chronicle[3]);
      if (index === 15) {
        expect(state.lastResult).toEqual(chronicle[24]);
        expect(state.progression.pathwayId).toBeNull();
        expect(state.seer.bottles[0]!.outcome).toBe('FAILURE');
      }
      if (index === 23) {
        expect(state.lastResult).toEqual(chronicle[36]);
        expect(state.progression.pathwayId).toBe('diviner');
        expect(state.seer.bottles[1]!.outcome).toBe('SUCCESS');
      }
      if (index === 34) {
        expect(state.status).toBe('SLICE_COMPLETE');
        expect(state.ending).toEqual(capture.final.caseArchive[0]);
      }
    }

    const before = state;
    expect(before.chronicle).toEqual(chronicle.slice(0, 67));
    expect(before.random).toEqual({ seed: capture.seed, cursor: 28 });
    expect(before.progression.acting).toBe(44);
    expect(before.progression.mastery['diviner.s9.spiritual-sight']).toBe(0);
    expect(before.seer.practice.cases[0]).toMatchObject({
      status: 'FAILED', attemptWeek: 9, outcome: 'FAILURE', approachId: 'sight',
    });

    const after = applySliceIntent(before, commands[42]!);
    assertValidSliceState(after);
    expect(after.chronicle).toEqual(chronicle);
    expect(after.chronicle).toHaveLength(69);
    expect(after.chronicle.slice(-2).map(record => record.id)).toEqual(['record-44-67', 'record-44-68']);
    expect(after.lastResult).toEqual(chronicle[68]);
    expect(after.lastCheck).toEqual({
      ability: 'perception', baseAbility: 19, modifiers: [], effectiveAbility: 19,
      difficulty: 10, chance: 68, roll: 20, tier: 'SUCCESS',
    });
    expect(after.seer.practice.cases[0]).toEqual(capture.final.seer.practice.cases[0]);
    expect(after.seer.practice.cases[0]!.status).toBe('COMPLETED');
    expect(after.cash).toBe(before.cash + 12);
    expect(after.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(after.spirituality).toBe(before.spirituality - 2);
    expect(after.progression.acting).toBe(56);
    expect(after.progression.mastery).toEqual({ ...before.progression.mastery, 'diviner.s9.spiritual-sight': 8 });
    expect(after.random).toEqual({ seed: capture.seed, cursor: 30 });
    expect(after.seer.completedSources).toEqual([...before.seer.completedSources, 'seer-practice:folded-bookmark']);

    expect(after.status).toBe('ACTIVE');
    expect(after.ending).toBeNull();
    expect(after.caseArchive).toEqual(capture.final.caseArchive);
    expect(after.caseArchive).toEqual(before.caseArchive);
    expect(after.arc).toEqual(capture.final.arc);
    expect(after.arc).toEqual(before.arc);
    expect(after.arc.workers).toBe('SOME_SAVED');
    expect(after.world).toEqual(before.world);
    expect(after.combatHistory).toEqual(before.combatHistory);
  });
});
