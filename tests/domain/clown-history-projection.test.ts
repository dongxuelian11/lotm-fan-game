import { describe, expect, it } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation';
import { createSliceRun, projectSliceState } from '../../src/domain/slice';

describe('read-only clown rescue battle provenance', () => {
  it.each([
    ['AVAILABLE', null], ['RESCUED', null],
    ['FIGHTING', 0], ['RESCUED', 0], ['RETREATED', 0], ['LOST', 0],
  ] as const)('projects %s with battle start %s without changing saved state', (status, startHistoryIndex) => {
    const state = createSliceRun('clown-history-projection', sliceDefaultCreationSelection, 'projection-seed');
    state.clown.rescue.status = status;
    state.clown.rescue.startHistoryIndex = startHistoryIndex;
    const before = JSON.stringify(state);
    expect(projectSliceState(state).clown.rescueCombatStarted).toBe(startHistoryIndex !== null);
    expect(JSON.stringify(state)).toBe(before);
  });
});
