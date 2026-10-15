/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecoveryNotice } from '../../src/renderer/RecoveryNotice';
import type { SliceRecoveryProjection } from '../../src/domain/slice/medical';

// Typed public display fixture, not a persisted campaign or a natural outcome.
function recovery(patch: Partial<SliceRecoveryProjection> = {}): SliceRecoveryProjection {
  const enabled = { enabled: true, reason: null };
  return {
    needsAttention: true, stage: 'DISCOVER_CARE', injuryCount: 1,
    untreatedHeavyCount: 1, treatedHeavyCount: 0, lightCount: 0, injuryRisk: 2,
    healthFullWithInjuries: true,
    summary: '未治疗重伤1处 · 已处置待康复重伤0处 · 轻伤0处 · 累计风险2。健康100仍不等于伤势痊愈。',
    guidance: '先核实普通诊疗点，处置之后还须后来一次休养。',
    careKnown: false, careAvailable: null, invitedThisWeek: false,
    treatmentCost: 60, healingHealthThreshold: 80, cashShortfall: 0,
    workIncomeThisWeek: 180, aidStatus: 'NONE', locked: false, blockedReason: null,
    nextLoss: {
      label: '下次败北进入伤势分支时的条件权重',
      explanation: '仅在下一次败北并进入伤势后果分支时适用，不是每回合死亡概率。',
      weights: { light: 35, heavy: 30, death: 35 },
    },
    actions: {
      rest: enabled, discover: enabled, work: enabled,
      aid: { enabled: false, reason: '没有待交付委托', targetId: null },
      pay: { enabled: false, reason: '先打开处置事件' },
      credit: { enabled: false, reason: '先打开处置事件' },
    },
    nextAction: { kind: 'INVESTIGATE', label: '查看普通诊疗点', targetId: 'CARE-ACCESS-01', ...enabled },
    ...patch,
  };
}
afterEach(cleanup);

describe('RecoveryNotice read-only public guidance', () => {
  it('shows full health with an untreated wound and visible conditional weights without a folded detail', () => {
    const value = recovery(), before = structuredClone(value), onNavigate = vi.fn();
    render(<RecoveryNotice value={value} onNavigate={onNavigate} />);
    const notice = screen.getByRole('region', { name: '伤势与恢复路线' });
    expect(notice.textContent).toContain('未治疗重伤1处');
    expect(notice.textContent).toContain('健康100仍不等于伤势痊愈');
    const wheel = within(notice).getByText(/条件权重：轻伤 35% · 重伤 30% · 死亡 35%/);
    expect(wheel.closest('details')).toBeNull();
    expect(notice.textContent).toContain('不是每回合死亡概率');
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.click(within(notice).getByRole('button', { name: '查看普通诊疗点' }));
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(value).toEqual(before);
  });

  it('renders the supplied wheel rather than deriving another one from injury count', () => {
    const value = recovery({ nextLoss: { ...recovery().nextLoss, weights: { light: 55, heavy: 30, death: 15 } } });
    render(<RecoveryNotice value={value} compact />);
    expect(screen.getByText(/轻伤 55% · 重伤 30% · 死亡 15%/)).toBeTruthy();
    expect(screen.queryByText(/轻伤 35%/)).toBeNull();
    expect(screen.getByRole('region', { name: '伤势与恢复路线' }).textContent).toContain('普通休养不会解除未治疗重伤');
  });

  it.each(['busy', 'locked', 'disabled'] as const)('keeps %s navigation inert without changing projected state', mode => {
    const value = recovery(mode === 'locked' ? { locked: true, blockedReason: '先按当前现场原路退出。' }
      : mode === 'disabled' ? { nextAction: { ...recovery().nextAction, enabled: false, reason: '当前调查不可用' } } : {});
    const before = structuredClone(value), onNavigate = vi.fn();
    render(<RecoveryNotice value={value} busy={mode === 'busy'} onNavigate={onNavigate} />);
    const notice = screen.getByRole('region', { name: '伤势与恢复路线' });
    const button = within(notice).getByRole('button', { name: '查看普通诊疗点' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true); fireEvent.click(button);
    expect(onNavigate).not.toHaveBeenCalled(); expect(value).toEqual(before);
    if (mode === 'locked') expect(notice.textContent).toContain('这里不会自动退出');
  });

  it('offers a return to the existing rest action after discovery, without a treatment or rest command', () => {
    const onNavigate = vi.fn();
    render(<RecoveryNotice value={recovery({ stage: 'CARE_READY', careKnown: true, careAvailable: true,
      nextAction: { kind: 'REST', label: '查看休养与处置', targetId: null, enabled: true, reason: null },
    })} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: '回到休养行动' }));
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: /支付|确认治疗|立即休养/ })).toBeNull();
  });

  it.each(['CURRENT_EVENT', 'WAIT_WEEK', 'NONE'] as const)('does not invent a navigation button for %s', kind => {
    render(<RecoveryNotice value={recovery({ nextAction: { kind, label: '当前步骤', targetId: null, enabled: true, reason: null } })} onNavigate={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides clear ordinary guidance unless combat explicitly requests the current risk', () => {
    const value = recovery({ needsAttention: false, summary: '当前无普通伤势。',
      nextLoss: { ...recovery().nextLoss, weights: { light: 65, heavy: 30, death: 5 } },
    });
    const { rerender } = render(<RecoveryNotice value={value} />);
    expect(screen.queryByRole('region', { name: '伤势与恢复路线' })).toBeNull();
    rerender(<RecoveryNotice value={value} showClearRisk />);
    expect(screen.getByText(/轻伤 65% · 重伤 30% · 死亡 5%/)).toBeTruthy();
    rerender(<RecoveryNotice value={undefined} showClearRisk />);
    expect(screen.queryByRole('region', { name: '伤势与恢复路线' })).toBeNull();
  });
});
