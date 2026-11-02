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
    const projected = projectSliceState(state);
    expect(projected.clown.rescueCombatStarted).toBe(startHistoryIndex !== null);
    if (status === 'RESCUED' || status === 'RETREATED' || status === 'LOST') {
      expect(projected.clown.rescueOutcome).toBe(status);
      expect(projected.clown.actions.some(action => action.command.type === 'RESCUE_TALK' || action.command.type === 'RESCUE_FIGHT')).toBe(false);
    } else expect(Object.hasOwn(projected.clown, 'rescueOutcome')).toBe(false);
    if (status === 'RETREATED') {
      expect(projected.clown.story).toContain('没有替艾尔西解决冲突');
      expect(projected.clown.story).toContain('后续仍待确认');
      expect(projected.clown.story).toContain('不能再次介入');
    }
    if (status === 'LOST') expect(projected.clown.story).toContain('护送没有被记作完成');
    if (status === 'RESCUED') expect(projected.clown.story).toContain('艾尔西已带着原包裹离开');
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each([
    [null, null], ['diviner', 9], ['diviner', 7], ['reader', 0],
  ] as const)('does not add S8 presentation facts to %s sequence %s public captures', (pathwayId, sequence) => {
    const state = createSliceRun('clown-history-scope', sliceDefaultCreationSelection, 'projection-seed');
    state.progression = { ...state.progression, pathwayId, sequence };
    state.clown.rescue.status = 'RETREATED';
    const before = JSON.stringify(state);
    expect(Object.hasOwn(projectSliceState(state).clown, 'rescueCombatStarted')).toBe(false);
    expect(Object.hasOwn(projectSliceState(state).clown, 'rescueOutcome')).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });
});
