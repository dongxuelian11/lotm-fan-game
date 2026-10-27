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

function observed(roll = 20) {
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
    check: (ability, difficulty) => resolveNormalCheck({ ability, baseAbility: 15, difficulty, modifiers: [], roll }),
    roll: min => min,
    note: () => {},
  };
  applySeerCommand(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'observe-sight' }, c);
  return { s, c };
}

describe('saved first-commission interpretation', () => {
  it('keeps the bookmark illustration decorative and identical across observed and delivered states', () => {
    const { s, c } = observed();
    const onCommand = vi.fn();
    const view = render(<SeerPanel seer={projectSeer(s)} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const illustration = view.container.querySelector('.seer-bookmark')!;
    expect(illustration.getAttribute('aria-hidden')).toBe('true');
    expect(illustration.getAttribute('focusable')).toBe('false');
    const drawing = illustration.innerHTML;
    applySeerCommand(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'report-bounded' }, c);
    view.rerender(<SeerPanel seer={projectSeer(s)} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(view.container.querySelector('.seer-bookmark')!.innerHTML).toBe(drawing);
    expect(screen.getByRole('region', { name: '当前委托' }).textContent).toContain('原物已归还');
    fireEvent.change(screen.getByLabelText('查看委托'), { target: { value: 'packing-list' } });
    expect(view.container.querySelector('.seer-bookmark')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

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

  it.each(['FAILED', 'DISPUTED'] as const)('reopens on an actionable commission after the first becomes %s this week', status => {
    const { s, c } = observed(status === 'FAILED' ? 99 : 20);
    if (status === 'DISPUTED') applySeerCommand(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'report-cause' }, c);
    s.actionsRemaining = 2;
    const onCommand = vi.fn();
    render(<SeerPanel seer={projectSeer(s)} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const story = screen.getByRole('region', { name: '当前委托' });
    expect(within(story).getByRole('heading', { name: '装箱单上少掉的一行' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '成长下一步' }).textContent).toContain('围绕两只已见纸箱占卜');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(['report-bounded', 'report-cause'] as const)('retains the saved %s reply, then navigates to another commission without spending', approachId => {
    const { s, c } = observed();
    s.actionsRemaining = 2;
    const onCommand = vi.fn();
    const props = { resources, busy: false, blocked: false, onCommand };
    const view = render(<SeerPanel seer={projectSeer(s)} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: approachId === 'report-bounded' ? /只说明观察所得/ : /断言先前的演示/ }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'PRACTICE', caseId: 'folded-bookmark', approachId });
    applySeerCommand(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId }, c);
    const seer = projectSeer(s), snapshot = JSON.stringify(seer);
    view.rerender(<SeerPanel seer={seer} {...props} />);
    const story = screen.getByRole('region', { name: '当前委托' });
    expect(within(story).getByRole('heading', { name: '书签折痕里的冷意' })).toBeTruthy();
    expect(story.textContent).toContain(approachId === 'report-bounded' ? '已交付' : '答复受到质疑');
    const next = within(story).getByRole('button', { name: '查看可处理委托：装箱单上少掉的一行' });
    fireEvent.click(next);
    const heading = within(story).getByRole('heading', { name: '装箱单上少掉的一行' });
    expect(document.activeElement).toBe(heading);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(seer)).toBe(snapshot);
  });

  it('keeps manually selected history readable and locks its next-case navigation while busy or blocked', () => {
    const { s, c } = observed();
    s.actionsRemaining = 2;
    applySeerCommand(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'report-bounded' }, c);
    const seer = projectSeer(s), onCommand = vi.fn();
    const view = render(<SeerPanel seer={seer} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    fireEvent.change(screen.getByLabelText('查看委托'), { target: { value: 'folded-bookmark' } });
    for (const lock of [{ busy: true, blocked: false }, { busy: false, blocked: true }]) {
      view.rerender(<SeerPanel seer={seer} resources={resources} {...lock} onCommand={onCommand} />);
      const next = screen.getByRole('button', { name: '查看可处理委托：装箱单上少掉的一行' }) as HTMLButtonElement;
      expect(next.disabled).toBe(true);
      fireEvent.click(next);
      expect(within(screen.getByRole('region', { name: '当前委托' })).getByRole('heading', { name: '书签折痕里的冷意' })).toBeTruthy();
    }
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('does not advertise an executable next case when no choices are enabled', () => {
    const { s, c } = observed();
    applySeerCommand(s, { type: 'PRACTICE', caseId: 'folded-bookmark', approachId: 'report-cause' }, c);
    render(<SeerPanel seer={projectSeer(s)} resources={resources} busy={false} blocked={false} onCommand={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /查看可处理委托/ })).toBeNull();
    expect(screen.getByRole('region', { name: '当前委托' }).textContent).toContain('答复受到质疑');
  });
});
