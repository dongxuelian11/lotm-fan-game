/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation';
import { createSliceRun } from '../../src/domain/slice';
import { projectSeer } from '../../src/domain/seer';
import { SEER_ABILITY_IDS } from '../../src/domain/seer/types';
import { SeerCaseIllustration } from '../../src/renderer/SeerCaseIllustration';
import { SeerPanel, type SeerResources } from '../../src/renderer/SeerPanel';

const cases = ['packing-list', 'loose-display', 'copied-warning'] as const;
const resources: SeerResources = {
  health: 100, maxHealth: 100, mind: 90, maxMind: 100,
  spirituality: 20, maxSpirituality: 30, cash: '12便士', actionsRemaining: 2,
};
afterEach(cleanup);

function projection() {
  const state = createSliceRun('seer-art-ui', sliceDefaultCreationSelection, 'seer-art-ui');
  state.activeEvent = null;
  state.arc.stage = 'ENDED';
  state.week = 7;
  state.actionsRemaining = 2;
  state.seer.discovered = true;
  state.seer.formulaKnown = true;
  state.progression = { pathwayId: 'diviner', sequence: 9, promotionWeek: 5, acting: 0,
    mastery: Object.fromEntries(SEER_ABILITY_IDS.map(id => [id, 0])) };
  return projectSeer(state);
}

describe('original seer case material studies', () => {
  it.each(cases)('%s is decorative, non-interactive and contains no readable clue', caseId => {
    const { container } = render(<SeerCaseIllustration caseId={caseId} />);
    const art = container.querySelector('svg')!;
    expect(art.getAttribute('data-case-art')).toBe(caseId);
    expect(art.getAttribute('aria-hidden')).toBe('true');
    expect(art.getAttribute('focusable')).toBe('false');
    expect(art.textContent).toBe('');
    expect(art.querySelector('text, title, a, image, use, foreignObject, animate, script')).toBeNull();
    expect(art.getAttribute('tabindex')).toBeNull();
  });

  it('keeps unknown commissions unillustrated rather than inventing their evidence', () => {
    const { container } = render(<SeerCaseIllustration caseId="unknown-case" />);
    expect(container.innerHTML).toBe('');
  });

  it('switches between all four material studies without commands or projection changes', () => {
    const seer = projection(), snapshot = JSON.stringify(seer), onCommand = vi.fn();
    const { container } = render(<SeerPanel seer={seer} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(container.querySelector('.seer-bookmark')).not.toBeNull();
    for (const caseId of [...cases, ...cases].reverse()) {
      fireEvent.change(screen.getByLabelText('查看委托'), { target: { value: caseId } });
      const entry = seer.practice.cases.find(item => item.id === caseId)!;
      const region = screen.getByRole('region', { name: '当前委托' });
      expect(within(region).getByRole('heading', { name: entry.title })).toBeTruthy();
      expect(region.querySelectorAll('svg')).toHaveLength(1);
      expect(region.querySelector('svg')!.getAttribute('data-case-art')).toBe(caseId);
      expect(container.querySelector('.seer-bookmark')).toBeNull();
      expect(region.textContent).toContain(entry.body);
    }
    fireEvent.change(screen.getByLabelText('查看委托'), { target: { value: 'folded-bookmark' } });
    expect(container.querySelector('.seer-bookmark')).not.toBeNull();
    expect(container.querySelector('.seer-case-illustration')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    expect(JSON.stringify(seer)).toBe(snapshot);
  });

  it.each(cases)('%s stays visually identical after completion and on reopening', caseId => {
    const seer = projection(), onCommand = vi.fn();
    const props = { resources, busy: false, blocked: false, onCommand };
    const view = render(<SeerPanel seer={seer} {...props} />);
    fireEvent.change(screen.getByLabelText('查看委托'), { target: { value: caseId } });
    const drawing = view.container.querySelector('[data-case-art]')!.outerHTML;
    const completed = structuredClone(seer);
    const entry = completed.practice.cases.find(item => item.id === caseId)!;
    entry.status = '已完成 · 原物已归还';
    entry.choices = [];
    view.rerender(<SeerPanel seer={completed} {...props} />);
    expect(view.container.querySelector('[data-case-art]')!.outerHTML).toBe(drawing);
    view.unmount();
    const reopened = render(<SeerPanel seer={completed} {...props} />);
    fireEvent.change(screen.getByLabelText('查看委托'), { target: { value: caseId } });
    expect(reopened.container.querySelector('[data-case-art]')!.outerHTML).toBe(drawing);
    expect(onCommand).not.toHaveBeenCalled();
  });
});
