/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FoolPanel } from '../../src/renderer/FoolPanel.js';
import type { FoolProjection } from '../../src/domain/fool/types.js';

afterEach(cleanup);
/** UI-only fixture: a public view, not a generated natural game state. */
const value = (): FoolProjection => ({
  title: '愚者晋升准备', guidanceKnown: true, promoted: false,
  story: '原特性与独立封存的唯一性仍需真实交接。', nextStep: '先筹备当前费用。', risk: '服药失败会留下真实伤害，可能死亡。',
  resources: { health: 90, mind: 95, spirituality: 106, cash: '25便士', actionsRemaining: 3 },
  abilities: [{ id: 'diviner.s1.thread-regeneration', label: '灵体之线再生', mastery: 0, description: '原有能力的实际掌握保留。' }],
  actions: [
    { id: 'work', label: '做一班当代劳动', cost: '1行动，收入24便士', enabled: true, reason: null, command: { type: 'RECEPTION_WORK' }, preferredAction: true },
    { id: 'rest', label: '付费休养', cost: '1行动、8便士', enabled: true, reason: null, command: { type: 'RECEPTION_REST' } },
    { id: 'next-week', label: '度过七天', cost: '24便士', enabled: false, reason: '用完本周行动再推进真实七天。', command: { type: 'RECEPTION_NEXT_WEEK' } },
  ],
  sections: [{ id: 'materials', title: '原特性与唯一性', lines: ['本人已整合一份原特性。', '另外两份仍需按其实际去向处理。'] }], insideCase: false,
});
const disabled = (label: string): boolean => (screen.getByRole('button', { name: label }) as HTMLButtonElement).disabled;

describe('Fool public panel', () => {
  it('shows actual resources, risks, disabled reasons and zero-valued inherited mastery', () => {
    const onCommand = vi.fn(), view = render(<FoolPanel value={value()} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('heading', { name: '愚者晋升准备' })).toBeTruthy();
    expect(view.container.textContent).toContain('健康 90 · 精神 95 · 灵性 106 · 25便士 · 本周行动 3');
    expect(view.container.textContent).toContain('服药失败会留下真实伤害，可能死亡。');
    expect(view.container.textContent).toContain('用完本周行动再推进真实七天。');
    expect(view.container.textContent).toContain('灵体之线再生 · 熟练 0');
    expect(view.container.textContent).not.toMatch(/seed|cursor|receipt|候选|原创G|本作G/);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(disabled('度过七天')).toBe(true); fireEvent.click(screen.getByRole('button', { name: '度过七天' }));
    expect(onCommand).not.toHaveBeenCalled();
  });
  it('dispatches only the exact public intent once while its result is pending', () => {
    const onCommand = vi.fn(), initial = value(), view = render(<FoolPanel value={initial} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班当代劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '做一班当代劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '付费休养' }));
    expect(onCommand).toHaveBeenCalledOnce(); expect(onCommand).toHaveBeenCalledWith({ type: 'RECEPTION_WORK' });
    expect(disabled('付费休养')).toBe(true);
    view.rerender(<FoolPanel value={initial} busy onCommand={onCommand} />);
    const next = value(); next.resources.cash = '49便士'; next.resources.actionsRemaining = 2;
    view.rerender(<FoolPanel value={next} busy={false} onCommand={onCommand} />);
    expect(disabled('付费休养')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '付费休养' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'RECEPTION_REST' }); expect(onCommand).toHaveBeenCalledTimes(2);
  });
  it.each(['busy', 'blocked', 'error', 'dead'] as const)('does not dispatch while %s', reason => {
    const onCommand = vi.fn(), current = value(); if (reason === 'dead') current.resources.health = 0;
    render(<FoolPanel value={current} busy={reason === 'busy'} blocked={reason === 'blocked'} error={reason === 'error' ? '尚未确认保存结果。' : null} onCommand={onCommand} />);
    expect(disabled('做一班当代劳动')).toBe(true); fireEvent.click(screen.getByRole('button', { name: '做一班当代劳动' }));
    expect(onCommand).not.toHaveBeenCalled();
  });
  it('keeps newly promoted rescue choices exactly as provided by the public view', () => {
    const current = value(); current.promoted = true; current.title = '愚者 · 当前现场'; current.insideCase = true;
    current.abilities.push({ id: 'diviner.s0.momentary-blindness', label: '片刻盲愚', mastery: 0, description: '最多三秒，目标仍可抵抗。' });
    current.actions = [{ id: 'open-original-door', label: '打开原门', cost: '原门开启后仍须实际行走', enabled: true, reason: null, command: { type: 'ESCAPE', command: { type: 'OPEN_DOOR' } } }];
    const onCommand = vi.fn(); const view = render(<FoolPanel value={current} busy={false} onCommand={onCommand} />);
    expect(view.container.textContent).toContain('片刻盲愚 · 熟练 0');
    expect(screen.queryByRole('button', { name: '做一班当代劳动' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '打开原门' }));
    expect(onCommand).toHaveBeenCalledOnce(); expect(onCommand).toHaveBeenCalledWith({ type: 'ESCAPE', command: { type: 'OPEN_DOOR' } });
  });
});
