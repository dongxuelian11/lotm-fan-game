/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VisionaryPanel } from '../../src/renderer/VisionaryPanel.js';
import type { VisionaryProjection } from '../../src/domain/visionary/types.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';

// Public UI fixtures only. No fixture here establishes natural progression,
// promotion, original-item conservation, random fairness or a saved transaction.
function value(): VisionaryProjection {
  return {
    title: '空想家晋升准备', guidanceKnown: true, promoted: false, insideCase: false,
    story: '莉娜来到新的时代路口。这段未来经历围绕四方六城的灾报与救援展开，有明确的起止。',
    nextStep: '先实地核对当前城市的灾报与救援人手，再锁定尚未发生的预想。',
    risk: '转型窗口有时限，服药仍可能失败；既有伤势与已付代价不会撤销。',
    resources: { health: 100, mind: 100, spirituality: 120, cash: '400便士', actionsRemaining: 3 },
    abilities: [{ id: 'spectator.s1.mutual-knowledge', label: '互知线索', mastery: 8, description: '只能触及对方确实知晓的有限信息。' }],
    actions: [
      { id: 'work', label: '做一班实际劳动', cost: '1行动，实际收入24便士', enabled: true, reason: null,
        command: { type: 'WORK' }, preferredAction: true },
      { id: 'rest', label: '付费休养', cost: '1行动、8便士', enabled: true, reason: null, command: { type: 'REST' } },
      { id: 'week', label: '度过七天', cost: '实际经过七天并结算生活费', enabled: false, reason: '用完本周行动再推进。',
        command: { type: 'NEXT_WEEK' } },
    ],
    sections: [
      { id: 'era', title: '时代概览', lines: ['四方六城仍各自保有实际灾报、运输与救援人手；本季度节点尚未到来。'] },
      { id: 'injuries', title: '原有伤势', lines: ['当前无伤；后续受伤会继续保留。'] },
      { id: 'materials', title: '原特性与唯一性', lines: ['第1份已融合于本人；供应方的第2、3份尚未实际交付。'] },
      { id: 'finance', title: '个人账目', lines: ['原生活开支继续结算，供应与交接须有真实代价。'] },
    ],
  };
}
function addConsumption(current: VisionaryProjection) {
  current.sections.push({ id: 'promotion-stability', title: '当前服药准备', lines: ['本次公开成功率70%；季度窗口到期便失效，不能沿用旧准备。'] });
  current.actions.push({ id: 'consume', label: '服用已核实的原魔药', cost: '消耗同一瓶原魔药、已整合原物与本次准备',
    enabled: true, reason: null, command: { type: 'CONSUME', compoundId: 'ui-only-original-compound', confirmed: true } });
}
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
afterEach(cleanup);

describe('Visionary public panel', () => {
  it('shows one era overview, the present goal, original injuries and actual resources', () => {
    const view = render(<VisionaryPanel value={value()} busy={false} onCommand={vi.fn()} />);
    expect(screen.getByRole('heading', { name: '空想家晋升准备' })).toBeTruthy();
    expect(screen.getAllByRole('region', { name: '时代概览' })).toHaveLength(1);
    expect(screen.getByRole('region', { name: '当前主目标' }).textContent).toContain('锁定尚未发生的预想');
    expect(screen.getByRole('region', { name: '原有伤势' }).textContent).toContain('当前无伤');
    expect(view.container.textContent).toContain('健康 100 · 精神 100 · 灵性 120 · 400便士 · 本周行动 3');
    expect(view.container.textContent).toContain('这段未来经历');
    expect(view.container.textContent).toContain('转型窗口有时限');
    expect(view.container.textContent).not.toMatch(/候选|fixture|Projection|G\d+/);
  });

  it('keeps exact public names and only the supplied unlocked abilities', async () => {
    const current = value(); current.title = '艾琳·桑德 [七] 的时代记录'; current.story = '艾琳·桑德 [七] 已来到此地。';
    render(<VisionaryPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(screen.getByRole('heading', { name: current.title })).toBeTruthy();
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    expect(screen.getByRole('heading', { name: '互知线索 · 熟练 8' })).toBeTruthy();
    expect(screen.queryByText(/临时空想原结构|心灵引导/)).toBeNull();
  });

  it('shows the original injury array and treatment state instead of a stale descriptive section', () => {
    render(<VisionaryPanel value={value()} busy={false} onCommand={vi.fn()} injuryRisk={2} injuries={[
      { id: 'same-original-heavy-injury', severity: 'HEAVY', acquiredRevision: 12, treatedRevision: null },
      { id: 'same-original-light-injury', severity: 'LIGHT', acquiredRevision: 8, treatedRevision: 10 },
    ]} />);
    const injuries = screen.getAllByRole('region', { name: '原有伤势' });
    expect(injuries).toHaveLength(1);
    expect(injuries[0]!.textContent).toContain('伤势风险 2');
    expect(injuries[0]!.textContent).toContain('1. 重伤 · 未处理');
    expect(injuries[0]!.textContent).toContain('2. 轻伤 · 已处理');
    expect(injuries[0]!.textContent).not.toContain('当前无伤');
  });

  it('shows confirmed no-injury facts without inventing a missing injury risk', () => {
    render(<VisionaryPanel value={value()} busy={false} onCommand={vi.fn()} injuries={[]} />);
    const injuries = screen.getByRole('region', { name: '原有伤势' });
    expect(injuries.textContent).toContain('当前没有伤势');
    expect(injuries.textContent).not.toContain('伤势风险');
  });

  it('associates exact costs and blocking reasons with each action', () => {
    const onCommand = vi.fn(); render(<VisionaryPanel value={value()} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole('button', { name: '度过七天' });
    expect(disabled(button)).toBe(true);
    expect(button.getAttribute('aria-describedby')!.split(' ').map(id => document.getElementById(id)?.textContent))
      .toEqual(['实际经过七天并结算生活费', '用完本周行动再推进。']);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it('limits main actions to three, keeps the ordinary exit visible and groups extra choices', async () => {
    const current = value();
    current.actions.push(
      { id: 'clinic', label: '求助诊所', cost: '1行动、12便士', enabled: true, reason: null, command: { type: 'CLINIC' } },
      { id: 'return', label: '沿原路步行返程', cost: '实际路程与生活费继续结算', enabled: true, reason: null, command: { type: 'RETURN_ON_FOOT' } },
    );
    const onCommand = vi.fn(); render(<VisionaryPanel value={current} busy={false} onCommand={onCommand} />);
    const main = screen.getByRole('region', { name: '当前主目标' }).querySelector<HTMLElement>(':scope > .seer-actions')!;
    expect(within(main).getAllByRole('button')).toHaveLength(3);
    expect(within(main).getByRole('button', { name: '沿原路步行返程' })).toBeTruthy();
    expect(within(main).queryByRole('button', { name: '求助诊所' })).toBeNull();
    const other = screen.getByText('其他可选行动', { selector: 'summary' }).closest('details')!;
    const accounts = screen.getByText('原物与个人账目', { selector: 'summary' }).closest('details')!;
    expect(other.open).toBe(false); expect(accounts.open).toBe(false);
    await userEvent.click(screen.getByText('其他可选行动', { selector: 'summary' }));
    expect(other.open).toBe(true);
    await userEvent.click(screen.getByText('原物与个人账目', { selector: 'summary' }));
    expect(accounts.open).toBe(true);
    expect(screen.getByRole('region', { name: '原特性与唯一性' }).textContent).toContain('尚未实际交付');
    fireEvent.click(screen.getByRole('button', { name: '沿原路步行返程' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'VISIONARY', command: { type: 'RETURN_ON_FOOT' } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sends one typed intent and stays locked across equivalent rerenders until an acknowledged result', () => {
    const current = value(), onCommand = vi.fn();
    const lastResult = { id: 'ui-old-result', week: 144, title: '已抵达', text: '没有新的检定。' };
    const view = render(<VisionaryPanel value={current} lastResult={lastResult} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    view.rerender(<VisionaryPanel value={structuredClone(current)} lastResult={{ ...lastResult }} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '付费休养' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'VISIONARY', command: { type: 'WORK' } });
    expect(disabled(screen.getByRole('button', { name: '付费休养' }))).toBe(true);
    view.rerender(<VisionaryPanel value={current} busy onCommand={onCommand} />);
    const next = value(); next.resources.cash = '424便士'; next.resources.actionsRemaining = 2;
    view.rerender(<VisionaryPanel value={next} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '付费休养' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'VISIONARY', command: { type: 'REST' } });
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it.each(['busy', 'blocked', 'error', 'dead'] as const)('locks action and close controls while %s', reason => {
    const current = value(); if (reason === 'dead') current.resources.health = 0;
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<VisionaryPanel value={current} busy={reason === 'busy'} blocked={reason === 'blocked'}
      error={reason === 'error' ? '尚未确认保存结果。' : null} onCommand={onCommand} onClose={onClose} />);
    for (const button of screen.getAllByRole('button')) { expect(disabled(button)).toBe(true); fireEvent.click(button); }
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps consumption separate with one cancellable, focus-contained confirmation', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<VisionaryPanel value={current} busy={false} onCommand={onCommand} onClose={onClose} />);
    const trigger = within(screen.getByRole('region', { name: '晋升与服药' })).getByRole('button', { name: '服用已核实的原魔药' });
    expect(within(screen.getByRole('region', { name: '当前主目标' })).queryByRole('button', { name: '服用已核实的原魔药' })).toBeNull();
    fireEvent.click(trigger);
    expect(onCommand).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: '空想家服药确认' });
    expect(dialog.textContent).toContain('消耗同一瓶原魔药');
    expect(dialog.textContent).toContain('本次公开成功率70%');
    expect(dialog.textContent).toContain('可能死亡');
    expect(dialog.textContent).toContain('不保证保有可追回的残余');
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份原魔药' });
    const cancel = within(dialog).getByRole('button', { name: '取消，继续准备' });
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  });

  it('invalidates a stale quarterly confirmation and submits the current bottle only once', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<VisionaryPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的原魔药' }));
    const expired = structuredClone(current), action = expired.actions.find(action => action.id === 'consume')!;
    action.enabled = false; action.reason = '当前季度窗口已经到期，需在后续节点实际重新核对。';
    view.rerender(<VisionaryPanel value={expired} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(disabled(screen.getByRole('button', { name: '服用已核实的原魔药' }))).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
    const renewed = structuredClone(current);
    renewed.actions.find(action => action.id === 'consume')!.command = { type: 'CONSUME', compoundId: 'ui-current-original-compound', confirmed: true };
    view.rerender(<VisionaryPanel value={renewed} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的原魔药' }));
    const confirm = screen.getByRole('button', { name: '确认服用这一份原魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'VISIONARY', command: { type: 'CONSUME', compoundId: 'ui-current-original-compound', confirmed: true } });
    expect(disabled(screen.getByRole('button', { name: '取消，继续准备' }))).toBe(true);
  });

  it('cancels confirmation after an unresolved save and retains original public costs', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<VisionaryPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的原魔药' }));
    view.rerender(<VisionaryPanel value={current} busy={false} error="本次保存失败。" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.container.textContent).toContain('400便士');
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('requires a fresh consumption decision when original injuries change', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<VisionaryPanel value={current} busy={false} injuries={[]} injuryRisk={0} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的原魔药' }));
    view.rerender(<VisionaryPanel value={current} busy={false} injuryRisk={2} injuries={[
      { id: 'new-original-injury', severity: 'HEAVY', acquiredRevision: 18, treatedRevision: null },
    ]} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: '原有伤势' }).textContent).toContain('重伤 · 未处理');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('renders acknowledged failure and real costs without displaying a future result', () => {
    const current = value();
    current.sections.push({ id: 'recent-action', title: '最近动作', lines: ['灾报核对失败，实际支付18便士、1行动；原记录仍待修正。'] });
    current.resources.cash = '382便士'; current.resources.actionsRemaining = 2;
    const check: PublicCheckResult = { ability: 'knowledge', baseAbility: 40, effectiveAbility: 48, difficulty: 50,
      chance: 48, roll: 79, tier: 'FAILURE', modifiers: [{ source: '实际查验', value: 8 }] };
    const view = render(<VisionaryPanel value={current} lastCheck={check} busy={false} onCommand={vi.fn()} />);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('失败，实际支付18便士、1行动');
    expect(result.textContent).toContain('失败 · 知识检定');
    expect(result.textContent).toContain('实际掷骰 79');
    expect(result.textContent).toContain('实际查验 +8');
    expect(view.container.textContent).toContain('382便士 · 本周行动 2');
  });

  it('does not read or render private source, future rolls or undisclosed abilities', () => {
    const current = Object.assign(value(), { preparedRoll: 'PRIVATE_FUTURE_ROLL', journal: ['PRIVATE_JOURNAL'],
      lockedAbilities: [{ label: 'PRIVATE_LOCKED_POWER' }] });
    Object.defineProperty(current, 'source', { enumerable: true, get: () => { throw new Error('Private source must not be read'); } });
    const view = render(<VisionaryPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/PRIVATE_|preparedRoll|journal|lockedAbilities|cursor|seed/);
    expect(view.container.textContent).not.toContain('实际掷骰');
  });

  it('shows bounded S0 rescue, persistent original injuries and an immediate ordinary withdrawal', () => {
    const current = value(); current.promoted = true; current.insideCase = true; current.title = '空想家 · 失联站救援';
    current.abilities = [
      { id: 'spectator.s0.temporary-structure', label: '临时空想原结构', mastery: 0, description: '只暂时支撑现场已有结构，不能创造生命。' },
      { id: 'spectator.s0.pending-guidance', label: '待行动心灵引导', mastery: 0, description: '只引导尚未发生的有限行动，不能改写既成结果。' },
    ];
    current.sections = [
      { id: 'epilogue', title: '当前救援', lines: ['原站短时失联；已转运1人，2人仍在原处。'] },
      { id: 'injuries', title: '原有伤势', lines: ['一处原重伤仍未处理；已救出的伤员仍带原伤。'] },
    ];
    current.actions = [{ id: 'withdraw', label: '沿原安全路线撤出', cost: '未救出的原伤员仍留在原站，已付代价不退还',
      enabled: true, reason: null, command: { type: 'EPILOGUE', command: { type: 'WITHDRAW' } } }];
    const onCommand = vi.fn(); render(<VisionaryPanel value={current} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '当前救援' }).textContent).toContain('2人仍在原处');
    expect(screen.getByRole('region', { name: '原有伤势' }).textContent).toContain('一处原重伤仍未处理');
    expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '沿原安全路线撤出' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'VISIONARY', command: { type: 'EPILOGUE', command: { type: 'WITHDRAW' } } });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
