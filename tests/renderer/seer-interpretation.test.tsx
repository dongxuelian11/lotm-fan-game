/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation';
import { createSliceRun } from '../../src/domain/slice';
import { applySeerCommand, projectSeer, type SeerContext } from '../../src/domain/seer';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types';
import { resolveNormalCheck } from '../../src/resolution/normal-check';
import { SeerPanel, type SeerResources } from '../../src/renderer/SeerPanel';

const resources: SeerResources = {
  health: 100, maxHealth: 100, mind: 90, maxMind: 100,
  spirituality: 10, maxSpirituality: 30, cash: '12便士', actionsRemaining: 0,
};
afterEach(cleanup);

function observed() {
  const s = createSliceRun('seer-choice-ui', sliceDefaultCreationSelection, 'seer-choice-ui');
  s.activeEvent = null;
  s.arc.stage = 'ENDED';
  s.week = 7;
  s.actionsRemaining = 1;
  s.seer.discovered = true;
  s.seer.formulaKnown = true;
  s.progression = { pathwayId: 'diviner', sequence: 9, promotionWeek: 5, acting: 0,
    mastery: Object.fromEntries(SEER_ABILITY_IDS.map(id => [id, 0])) };
  const c: SeerContext = {
    check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll: 20 }),
    roll: min => min,
    note: () => {},
  };
  applySeerCommand(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'sight' }, c);
  return { s, c };
}

describe('saved first-commission interpretation', () => {
  it('shows the observed evidence and exact two report commands after reopening, even with no actions left', () => {
    const { s } = observed();
    const restored = JSON.parse(JSON.stringify(s)) as typeof s;
    const onCommand = vi.fn();
    render(<SeerPanel seer={projectSeer(restored)} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const nextStep = screen.getByRole('region', { name: '成长下一步' });
    expect(nextStep.textContent).toContain('回应书签主人的追问');
    expect(nextStep.textContent).not.toContain('只说明观察所得');
    const story = screen.getByRole('region', { name: '当前委托' });
    expect(story.textContent).toContain('你没有看见它的来历');
    expect(story.textContent).toContain('观察已完成 · 等待解释');
    expect(within(story).getAllByRole('button')).toHaveLength(2);
    expect(within(story).queryByRole('button', { name: /开启灵视/ })).toBeNull();
    const bounded = within(story).getByRole('button', { name: /只说明观察所得/ }) as HTMLButtonElement;
    const cause = within(story).getByRole('button', { name: /断言先前的演示/ }) as HTMLButtonElement;
    expect(bounded.disabled).toBe(false);
    expect(cause.disabled).toBe(false);
    fireEvent.click(bounded);
    fireEvent.click(cause);
    expect(onCommand.mock.calls).toEqual([
      [{ type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'report-bounded' }],
      [{ type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'report-cause' }],
    ]);
  });

  it('keeps both report choices locked while their saved reply is in flight', () => {
    const { s } = observed(), onCommand = vi.fn();
    render(<SeerPanel seer={projectSeer(s)} resources={resources} busy blocked={false} onCommand={onCommand} />);
    const story = screen.getByRole('region', { name: '当前委托' });
    for (const button of within(story).getAllByRole('button')) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onCommand).not.toHaveBeenCalled();
  });
});
