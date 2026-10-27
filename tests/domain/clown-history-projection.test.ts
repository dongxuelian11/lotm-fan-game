import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation';
import { createSliceRun, projectSliceState } from '../../src/domain/slice';

describe('read-only clown rescue battle provenance', () => {
  it.each([
    ['AVAILABLE', null], ['RESCUED', null],
    ['FIGHTING', 0], ['RESCUED', 0], ['RETREATED', 0], ['LOST', 0],
  ] as const)('projects %s with battle start %s without changing saved state', (status, startHistoryIndex) => {
    const state = createSliceRun('clown-history-projection', sliceDefaultCreationSelection, 'projection-seed');
    state.progression = { ...state.progression, pathwayId: 'diviner', sequence: 8 };
    state.clown.rescue.status = status;
    state.clown.rescue.startHistoryIndex = startHistoryIndex;
    const before = JSON.stringify(state);
    expect(projectSliceState(state).clown.rescueCombatStarted).toBe(startHistoryIndex !== null);
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([
    [null, null], ['diviner', 9], ['diviner', 7], ['reader', 0],
  ] as const)('does not add S8 presentation facts to %s sequence %s public captures', (pathwayId, sequence) => {
    const state = createSliceRun('clown-history-scope', sliceDefaultCreationSelection, 'projection-seed');
    state.progression = { ...state.progression, pathwayId, sequence };
    const before = JSON.stringify(state);
    expect(Object.hasOwn(projectSliceState(state).clown, 'rescueCombatStarted')).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });
});
