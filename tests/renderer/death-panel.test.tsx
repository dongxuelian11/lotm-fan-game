/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeathPanel } from '../../src/renderer/DeathPanel.js';
import type { DeathProjection } from '../../src/shared/slice-contracts.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';

// Public presentation data only. This does not establish domain, natural-run or SQLite evidence.
function value(): DeathProjection {
  return {
    title: '死神晋升准备', guidanceKnown: true, promoted: false, insideCase: false,
    story: '两份失败原瓶的残余仍待实地查验。旧码头的两位工人需要沿桥绳离开。',
    nextStep: '先照料伤势，再到现场核对原物与当次许可。',
    risk: '失败留下真实伤势与污染，严重失败可能死亡。',
    resources: { health: 50, maxHealth: 100, mind: 100, maxMind: 100, spirituality: 120,
      maxSpirituality: 120, cash: '36便士', actionsRemaining: 1, weeklyBudget: 4 },
    injuries: [
      { id: 'old-heavy', severity: 'HEAVY', treated: false },
      { id: 'old-light-1', severity: 'LIGHT', treated: false },
      { id: 'old-light-2', severity: 'LIGHT', treated: false },
    ], injuryRisk: 2,
    abilities: [
      ...Array.from({ length: 17 }, (_, index) => ({ id: `inherited-${index}`, label: `原能力${index + 1}`,
        mastery: index % 4 === 0 ? 0 : index + 3, description: '原有掌握保持不变。' })),
      { id: 'death.s1.residual-quieting', label: '残响安抚', mastery: 0, description: '尚无实际应用掌握。' },
      { id: 'death.s1.spiritual-interdiction', label: '灵性阻隔', mastery: 0, description: '尚无实际应用掌握。' },
    ],
    actions: [
      { id: 'work', label: '实际劳动', cost: '1行动，收入24便士', enabled: true, reason: null,
        command: { type: 'WORK' }, preferredAction: true },
      { id: 'clinic', label: '诊疗伤势', cost: '1行动，60便士', enabled: false,
        reason: '现金不足60便士，治疗不会立即恢复健康。', command: { type: 'CLINIC' } },
      { id: 'stop', label: '停止现场服务', cost: '0行动，0便士', enabled: true, reason: null,
        command: { type: 'SERVICE', command: { type: 'STOP_SERVICE', serviceId: 'old-wharf-exit' } } },
      { id: 'return', label: '沿普通路返回', cost: '0行动，0便士；实际步行', enabled: true,
        reason: null, command: { type: 'RETURN_ON_FOOT' } },
      { id: 'consume', label: '服用本瓶魔药', cost: '1行动、30灵性；消耗本瓶载体与准备', enabled: true,
        reason: null, command: { type: 'CONSUME', compoundId: 'death-compound-1', confirmed: true } },
    ],
    sections: [
      { id: 'clock', title: '实际日历', lines: ['第3323周，当前在接待处。'] },
      { id: 'death-services', title: '残余封存与码头撤离', lines: ['两位工人各自仍在原位置，需要分别经过桥绳离开。'] },
      { id: 'materials', title: '三份原特性与唯一性', lines: [
        '第三份已融合，另外两份失败残余尚待查找。',
        '每份调查4便士；指定劳务可抵8便士，隔周交接余4便士。',
        '第一件载体12便士，尚余三件；唯一性需核对来源、空位及当前许可。',
      ] },
      { id: 'promotion-stability', title: '本瓶准备', lines: ['当前成功率70%，实际准备有效七天。'] },
      { id: 'source-history', title: '过往人物与原物', lines: ['阿尔登已经死亡；他的棍仍归原主人。旧封条破损，旧封材已经耗尽。'] },
    ],
  };
}

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Death public panel', () => {
  it('shows actual current/max resources, weekly actions, injuries and material costs', () => {
    const view = render(<DeathPanel value={value()} busy={false} onCommand={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '死神晋升准备' }));
    expect(view.container.textContent).toContain('健康 50/100 · 精神 100/100 · 灵性 120/120 · 现金 36便士 · 本周行动 1/4');
    const injuries = screen.getByRole('region', { name: '当前伤势' });
    expect(within(injuries).getAllByRole('listitem')).toHaveLength(3);
    expect(injuries.textContent).toContain('伤势风险 2');
    expect(injuries.textContent).toContain('重伤 · 未处理');
    expect(screen.getByRole('region', { name: '残余封存与码头撤离' }).closest('details')).toBeNull();
    expect(screen.getByRole('region', { name: '三份原特性与唯一性' }).textContent).toContain('隔周交接余4便士');
    const clinic = screen.getByRole('button', { name: '诊疗伤势' });
    expect((clinic as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(clinic.getAttribute('aria-describedby')!.split(' ')[1])?.textContent).toContain('不会立即恢复健康');
  });

  it('retains every one of the 19 inherited masteries including all zeros and readonly history', async () => {
    const current = value(); render(<DeathPanel value={current} busy={false} onCommand={vi.fn()} />);
    await userEvent.click(screen.getByText('能力与掌握', { selector: 'summary' }));
    expect(current.abilities).toHaveLength(19);
    for (const ability of current.abilities) {
      expect(screen.getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    await userEvent.click(screen.getByText('过往经历与个人账目', { selector: 'summary' }));
    const history = screen.getByRole('region', { name: '过往人物与原物' });
    expect(history.textContent).toContain('阿尔登已经死亡');
    expect(within(history).queryAllByRole('button')).toHaveLength(0);
  });

  it('renders only public fields rather than unexpected raw runtime properties', () => {
    const current = Object.assign(value(), { source: { seed: 'secret-seed', cursor: 999 },
      sourceDigest: 'private-digest', internalLabel: '原创G217' });
    const view = render(<DeathPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(view.container.textContent).not.toMatch(/原创|G217|seed|cursor|source|digest|fixture/i);
    expect(view.container.innerHTML).not.toContain('death-compound-1');
  });

  it('keeps ordinary stop and return visible at zero cash and zero actions', () => {
    const current = value(); current.resources.cash = '0便士'; current.resources.actionsRemaining = 0;
    render(<DeathPanel value={current} busy={false} onCommand={vi.fn()} />);
    const exits = screen.getByRole('region', { name: '暂停与安全返回' });
    for (const name of ['停止现场服务', '沿普通路返回']) {
      expect((within(exits).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('allows cancelling the risk review and restores its trigger without submitting', async () => {
    const command = vi.fn(); render(<DeathPanel value={value()} busy={false} onCommand={command} />);
    const trigger = screen.getByRole('button', { name: '服用本瓶魔药' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '死神服药确认' });
    expect(dialog.textContent).toContain('70%');
    expect(dialog.textContent).toContain('严重失败可能死亡');
    expect(dialog.textContent).toContain('载体仅有三件');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(command).not.toHaveBeenCalled();
  });

  it('requires explicit risk confirmation and submits the original command only once', async () => {
    const command = vi.fn(); render(<DeathPanel value={value()} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '服用本瓶魔药' }));
    expect(command).not.toHaveBeenCalled();
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith({ type: 'DEATH', command: {
      type: 'CONSUME', compoundId: 'death-compound-1', confirmed: true,
    } });
  });

  it('invalidates an open confirmation when the resource maximum or injury treatment changes', async () => {
    const current = value(), command = vi.fn();
    const view = render(<DeathPanel value={current} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '服用本瓶魔药' }));
    const changed = { ...current, resources: { ...current.resources, maxSpirituality: 150 } };
    view.rerender(<DeathPanel value={changed} busy={false} onCommand={command} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: '服用本瓶魔药' }));
    view.rerender(<DeathPanel value={{ ...changed, injuries: changed.injuries.map(injury => ({ ...injury, treated: true })) }}
      busy={false} onCommand={command} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(command).not.toHaveBeenCalled();
  });

  it('retains saved resources and the submit latch across failure and a same-intent parent retry', async () => {
    const current = value(), command = vi.fn();
    const view = render(<DeathPanel value={current} committedRevision={1040} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '实际劳动' }));
    expect(view.container.textContent).toContain('现金 36便士 · 本周行动 1/4');
    view.rerender(<DeathPanel value={current} committedRevision={1040} busy={false} error="保存失败" onCommand={command} />);
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    fireEvent.click(screen.getByRole('button', { name: '实际劳动' }));
    view.rerender(<DeathPanel value={current} committedRevision={1040} busy onCommand={command} />);
    expect(view.container.textContent).toContain('现金 36便士 · 本周行动 1/4');
    // Only the parent's successful committed receipt publishes the replacement projection.
    view.rerender(<DeathPanel value={{ ...current, resources: { ...current.resources, cash: '60便士', actionsRemaining: 0 } }}
      committedRevision={1041} busy={false} onCommand={command} />);
    await waitFor(() => expect((screen.getByRole('button', { name: '实际劳动' }) as HTMLButtonElement).disabled).toBe(false));
    expect(view.container.textContent).toContain('现金 60便士 · 本周行动 0/4');
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('releases a saved non-resource action on its committed revision even when visible facts match', async () => {
    const current = value(), command = vi.fn();
    const view = render(<DeathPanel value={current} committedRevision={1040} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '沿普通路返回' }));
    view.rerender(<DeathPanel value={current} committedRevision={1041} busy={false} onCommand={command} />);
    await waitFor(() => expect((screen.getByRole('button', { name: '沿普通路返回' }) as HTMLButtonElement).disabled).toBe(false));
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('immediately shows committed promotion and reopened resources without filling the new maximum', async () => {
    const current = value(), command = vi.fn();
    const view = render(<DeathPanel value={current} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '服用本瓶魔药' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认服用这一份魔药' }));
    const promoted: DeathProjection = { ...current, title: '死神', promoted: true,
      resources: { ...current.resources, mind: 80, spirituality: 78, maxSpirituality: 150, actionsRemaining: 0 },
      abilities: [...current.abilities,
        { id: 'death.s0.partial-spirit-passage', label: '有限灵界通路', mastery: 0, description: '须在当前现场实际应用。' },
        { id: 'death.s0.residual-propagation-barrier', label: '残余传播阻隔', mastery: 0, description: '针对当前实查传播线。' }],
      actions: current.actions.filter(action => action.command.type !== 'CONSUME'),
    };
    view.rerender(<DeathPanel value={promoted} busy={false} onCommand={command} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { name: '死神', level: 2 })).toBeTruthy();
    expect(view.container.textContent).toContain('灵性 78/150');
    view.unmount();
    const reopened = render(<DeathPanel value={promoted} busy={false} onCommand={command} />);
    expect(reopened.container.textContent).toContain('灵性 78/150');
    await userEvent.click(screen.getByText('能力与掌握', { selector: 'summary' }));
    for (const ability of promoted.abilities) {
      expect(screen.getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('renders the actual saved check probability, roll and modifier values', () => {
    const check: PublicCheckResult = { ability: 'will', baseAbility: 26, effectiveAbility: 66,
      difficulty: 57, chance: 68, roll: 72, tier: 'FAILURE',
      modifiers: [{ source: '本瓶实际准备', value: 40 }] };
    render(<DeathPanel value={value()} busy={false} lastCheck={check} onCommand={vi.fn()} />);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('本次成功率 68%，实际掷骰 72');
    expect(result.textContent).toContain('本瓶实际准备 +40');
  });

  it('locks every action for death or a parent blocker and keeps treatment distinct from healing', () => {
    const current = value(); current.resources.health = 0; current.injuries[0].treated = true;
    const command = vi.fn(), close = vi.fn();
    const view = render(<DeathPanel value={current} busy={false} onCommand={command} onClose={close} />);
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('重伤 · 已处理');
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<DeathPanel value={value()} busy={false} blocked onCommand={command} onClose={close} />);
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '实际劳动' }));
    expect(command).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
});
