/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProvokerAction, ProvokerChoice, ProvokerProjection } from '../../src/domain/provoker/types';
import { ProvokerPanel } from '../../src/renderer/ProvokerPanel';
import { provokerChoiceCommonNote, provokerChoicePreview } from '../../src/renderer/provoker-choice-preview';
const abilityCost = '1行动 · 2灵性 · 可能被拒绝；人的冲突可能导致推搡受伤';
const ordinaryCost = '1行动 · 0灵性 · 沿真实普通方法解决，不保证成功';
const resources = { health: 80, maxHealth: 100, mind: 80, maxMind: 100, spirituality: 10, maxSpirituality: 45, cash: '100便士', actionsRemaining: 3 };
function action(caseId: string, choice: ProvokerChoice): ProvokerAction {
  return { id: choice, label: `公开选择${choice}`, cost: choice === 'CHALLENGE' || choice === 'ATTRACT' ? abilityCost : ordinaryCost, enabled: true, reason: null, command: { type: 'CHOOSE', caseId, choice } };
}
function projection(caseId: string, actions: ProvokerAction[]): ProvokerProjection {
  return { title: '挑衅者', discovered: true, guidanceKnown: true, promoted: true, formulaKnown: false, formula: [], supplies: '', cases: [{ id: caseId, title: '已观察的情境', story: '已经亲见的公开事实。' }], actions, bottles: [], abilities: [], acting: 0, digestion: '', pollution: 0, risk: '' };
}
afterEach(cleanup);
describe('public choice-specific checks and risks', () => {
  it.each(['invoice-claim', 'queue-boast', 'yard-hound'])('%s displays the two existing choices without mutating intents or projection', caseId => {
    const dog = caseId === 'yard-hound';
    const actions = [action(caseId, dog ? 'ATTRACT' : 'CHALLENGE'), action(caseId, dog ? 'WAIT' : 'DEESCALATE')];
    const p = projection(caseId, actions), original = JSON.stringify(p), onCommand = vi.fn();
    const { rerender } = render(<ProvokerPanel provoker={p} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    const group = screen.getByRole('group', { name: '当前情境行动' });
    expect(within(group).getByText(dog ? '感知难度12 · 失败精神−5' : '意志难度14 · 失败健康−4、精神−5')).toBeTruthy();
    expect(within(group).getByText(dog ? '感知难度14 · 失败不额外扣健康或精神' : '知识难度12 · 失败不额外扣健康或精神')).toBeTruthy();
    expect(within(group).getByText('1行动 · 2灵性')).toBeTruthy(); expect(within(group).getByText(ordinaryCost)).toBeTruthy();
    expect(group.textContent).not.toContain('人的冲突'); expect(group.textContent).not.toContain('无损失');
    expect(screen.getAllByText(provokerChoiceCommonNote)).toHaveLength(1);
    for (const a of actions) { fireEvent.click(within(group).getByRole('button', { name: new RegExp(a.label) })); expect(onCommand).toHaveBeenLastCalledWith(a.command); }
    expect(JSON.stringify(p)).toBe(original);
    const disabled = { ...p, actions: actions.map(a => ({ ...a, enabled: false, reason: '本周已经试过，留出时间后再来。' })) };
    rerender(<ProvokerPanel provoker={disabled} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    for (const button of within(group).getAllByRole('button')) { expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button); }
    expect(onCommand).toHaveBeenCalledTimes(2);
    expect(within(group).getAllByText('本周已经试过，留出时间后再来。')).toHaveLength(2);
    rerender(<ProvokerPanel provoker={{ ...p, actions: [] }} resources={resources} busy={false} blocked={false} onCommand={onCommand} />);
    expect(screen.queryByText(provokerChoiceCommonNote)).toBeNull();
  });
  it('does not add previews for unknown cases, mismatched choices or other commands', () => {
    expect(provokerChoicePreview(action('future-case', 'CHALLENGE'))).toBeNull();
    expect(provokerChoicePreview(action('yard-hound', 'CHALLENGE'))).toBeNull();
    expect(provokerChoicePreview(action('invoice-claim', 'WAIT'))).toBeNull();
    expect(provokerChoicePreview({ ...action('yard-hound', 'WAIT'), command: { type: 'OBSERVE', caseId: 'yard-hound' } })).toBeNull();
    expect(provokerChoicePreview({ ...action('yard-hound', 'WAIT'), command: { type: 'REFLECT' } })).toBeNull();
  });
  it('preserves unknown cost text rather than inferring resource costs', () => {
    const a = { ...action('yard-hound', 'ATTRACT'), cost: '原投影自定义成本 · 3灵性' };
    expect(provokerChoicePreview(a)?.cost).toBe(a.cost);
    const b = { ...a, cost: abilityCost + '；附加条件' };
    expect(provokerChoicePreview(b)?.cost).toBe(b.cost);
  });
});
