/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DarknessPanel } from '../../src/renderer/DarknessPanel.js';
import type { DarknessAction, DarknessCommand, DarknessProjection } from '../../src/domain/darkness/types.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';

// Public component fixtures only. These do not establish natural progression,
// promotion, original-item provenance/conservation, random fairness, or a saved transaction.
// Keep each fixture local and small; no full run or mock closure retains history.
function value(): DarknessProjection {
  return {
    title: '黑暗晋升准备', guidanceKnown: true, promoted: false, insideCase: false,
    story: '罗温来到黑夜街区。这段未来经历中的四名成年人仍须逐人实际到达安全屋。',
    nextStep: '先白昼实勘原路、登记四人的位置与意愿，再等到真实入夜。',
    risk: '当前准备有时限，服药仍可能失败；原有伤势与已经支付的费用不会撤销。',
    resources: { health: 100, mind: 100, spirituality: 120, cash: '400便士', actionsRemaining: 3 },
    abilities: [{ id: 'darkness.s1.guided-mishap', label: '厄势导引', mastery: 8, description: '原有有限能力与真实掌握继续保留。' }],
    actions: [
      { id: 'work', label: '做一班实际劳动', cost: '1行动，实际收入180便士', enabled: true, reason: null,
        command: { type: 'WORK' }, preferredAction: true },
      { id: 'rest', label: '按实际生活档休养', cost: '1行动，实际八小时；未处置重伤仍保留', enabled: true, reason: null, command: { type: 'REST' } },
      { id: 'week', label: '走到下一真实周界', cost: '结算生活费与约定还款，不发工资、不补资源', enabled: false, reason: '本次现场尚未安全收束。',
        command: { type: 'NEXT_WEEK' } },
    ],
    sections: [
      { id: 'body', title: '当前身体与代价', lines: ['原身体与已支付的费用继续保留；服药可能带来真实伤势与污染。'] },
      { id: 'clock', title: '实际日历与当前地点', lines: ['第158周，第3天18时30分；黑夜街区登记处。', '20时至次日6时才是夜间，等待不刷新居民。'] },
      { id: 'darkness-evacuation', title: '四位成年人的长夜撤离', lines: [
        '莱娜32岁在0米，乔纳41岁在10米；本人同意同行。',
        '艾达36岁在25米，本人拒绝或撤回；诺亚58岁在40米，尚未当面询问。',
        '已到达0/4；原灯状况100，余油3600灯秒；原绳全部随身未使用。',
      ] },
      { id: 'injuries', title: '当前伤势', lines: ['当前无伤；后续受伤会继续保留。'] },
      { id: 'materials', title: '原特性与唯一性', lines: ['第一份已融合于本人；另外两份尚未实际交付。'] },
      { id: 'finance', title: '个人账目', lines: ['原生活开支继续结算，撤离灯油须实际购买。'] },
    ],
  };
}

function addConsumption(current: DarknessProjection) {
  current.sections.push({ id: 'promotion-stability', title: '本瓶当前服药准备',
    lines: ['本次公开成功率70%；本瓶准备到期便失效，不能沿用旧准备。'] });
  current.actions.push({ id: 'consume', label: '服用已核实的同一瓶魔药',
    cost: '1行动、30灵性；载体与本次准备只花一次，三份原特性与唯一性继续保留',
    enabled: true, reason: null, command: { type: 'CONSUME', compoundId: 'ui-only-original-compound', confirmed: true } });
}

const safetyExits: DarknessAction[] = [
  { id: 'release', label: '立即停止搀扶，双方留在实际原处', cost: '0行动、0便士；停止搀扶不移动任何人',
    enabled: true, reason: null, command: { type: 'EVACUATION', command: { type: 'RELEASE' } } },
  { id: 'ordinary-return', label: '沿同一实路普通返回登记处', cost: '0行动、0便士；按实际路程返程',
    enabled: true, reason: null, command: { type: 'EVACUATION', command: { type: 'ORDINARY_RETURN' } } },
  { id: 'return', label: '本人沿普通路步行回原庭院', cost: '0行动、0便士；实际两小时，不能带走未同行者',
    enabled: true, reason: null, command: { type: 'RETURN_ON_FOOT' } },
];

const epilogueExits: DarknessAction[] = [
  { id: 'stop-effects', label: '停止维持临时效果', cost: '0行动、0便士；既有费用不退',
    enabled: true, reason: null, command: { type: 'EPILOGUE', command: { type: 'STOP_EFFECTS' } } },
  { id: 'side-exit', label: '陪同原两人沿普通侧路回登记处', cost: '0行动、0便士；按实际位置慢行',
    enabled: true, reason: null, command: { type: 'EPILOGUE', command: { type: 'ORDINARY_SIDE_EXIT' } } },
  { id: 'withdraw', label: '本人沿普通道路返回', cost: '0行动、0便士；仅本人实走，不搬他人',
    enabled: true, reason: null, command: { type: 'EPILOGUE', command: { type: 'WITHDRAW' } } },
];

const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const descriptions = (button: HTMLElement) => button.getAttribute('aria-describedby')!.split(' ')
  .map(id => document.getElementById(id)?.textContent);
afterEach(cleanup);

describe('Darkness public panel', () => {
  it('shows the four actual residents, clock, present goal, body, injuries and resources', () => {
    const view = render(<DarknessPanel value={value()} busy={false} onCommand={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: '黑暗晋升准备' });
    expect(document.activeElement).toBe(heading);
    const overview = screen.getByRole('region', { name: '四位成年人的长夜撤离' });
    expect(overview.closest('details')).toBeNull();
    expect(overview.textContent).toContain('莱娜32岁在0米，乔纳41岁在10米');
    expect(overview.textContent).toContain('本人拒绝或撤回');
    expect(overview.textContent).toContain('尚未当面询问');
    expect(overview.textContent).toContain('已到达0/4');
    expect(overview.textContent).toContain('原灯状况100，余油3600灯秒');
    expect(screen.getByRole('region', { name: '实际日历与当前地点' }).textContent).toContain('第3天18时30分');
    expect(screen.getByRole('region', { name: '实际日历与当前地点' }).textContent).toContain('20时至次日6时');
    expect(screen.getByRole('region', { name: '当前主目标' }).textContent).toContain('先白昼实勘原路');
    expect(screen.getByRole('region', { name: '当前身体与代价' }).textContent).toContain('真实伤势与污染');
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('当前无伤');
    expect(view.container.textContent).toContain('健康 100 · 精神 100 · 灵性 120 · 400便士 · 本周行动 3');
    expect(view.container.textContent).toContain('这段未来经历');
    expect(view.container.textContent).toContain('当前准备有时限');
    expect(view.container.textContent).not.toMatch(/候选|fixture|Projection|G\d+/);
  });

  it('keeps exact public names and displays only the supplied unlocked skills', async () => {
    const current = value();
    current.title = '罗温 [七] 的长夜记录';
    current.story = '罗温 [七] 与莱娜 [原居民] 来到登记处。';
    current.sections.find(section => section.id === 'darkness-evacuation')!.lines = ['莱娜 [原居民] 仍在同一处街口。'];
    const view = render(<DarknessPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(screen.getByRole('heading', { name: current.title })).toBeTruthy();
    expect(view.container.textContent).toContain(current.story);
    expect(screen.getByRole('region', { name: '四位成年人的长夜撤离' }).textContent).toContain('莱娜 [原居民]');
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    expect(screen.getByRole('heading', { name: '厄势导引 · 熟练 8' })).toBeTruthy();
    expect(screen.queryByText(/短隐秘|有限厄难偏导/)).toBeNull();
  });

  it('uses current injury entries and treatment facts instead of a stale section', () => {
    render(<DarknessPanel value={value()} busy={false} onCommand={vi.fn()} injuryRisk={2} injuries={[
      { id: 'same-original-heavy-injury', severity: 'HEAVY', acquiredRevision: 12, treatedRevision: null },
      { id: 'same-original-light-injury', severity: 'LIGHT', acquiredRevision: 8, treatedRevision: 10 },
    ]} />);
    const injuries = screen.getAllByRole('region', { name: '当前伤势' });
    expect(injuries).toHaveLength(1);
    expect(injuries[0]!.textContent).toContain('伤势风险 2');
    expect(injuries[0]!.textContent).toContain('1. 重伤 · 未处理');
    expect(injuries[0]!.textContent).toContain('2. 轻伤 · 已处理');
    expect(injuries[0]!.textContent).not.toContain('当前无伤');
  });

  it('shows confirmed absence of injuries without inventing an omitted injury risk', () => {
    render(<DarknessPanel value={value()} busy={false} onCommand={vi.fn()} injuries={[]} />);
    const injuries = screen.getByRole('region', { name: '当前伤势' });
    expect(injuries.textContent).toContain('当前没有伤势');
    expect(injuries.textContent).not.toContain('伤势风险');
  });

  it('associates exact public costs and disabled reasons with the affected action', () => {
    const onCommand = vi.fn();
    render(<DarknessPanel value={value()} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole('button', { name: '走到下一真实周界' });
    expect(disabled(button)).toBe(true);
    expect(descriptions(button)).toEqual(['结算生活费与约定还款，不发工资、不补资源', '本次现场尚未安全收束。']);
    expect(descriptions(screen.getByRole('button', { name: '按实际生活档休养' }))).toEqual(['1行动，实际八小时；未处置重伤仍保留']);
    fireEvent.click(button);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('limits main work to three while keeping safety exits outside the secondary fold', async () => {
    const current = value();
    current.actions.push(
      { id: 'clinic', label: '求助诊所', cost: '1行动、60便士', enabled: true, reason: null, command: { type: 'CLINIC' } },
      { id: 'inspect', label: '白昼开始实勘实际道路', cost: '1行动、0便士；实际120秒',
        enabled: true, reason: null, preferredAction: true,
        command: { type: 'EVACUATION', command: { type: 'SURVEY_DAY' } } },
      ...structuredClone(safetyExits),
    );
    render(<DarknessPanel value={current} busy={false} onCommand={vi.fn()} />);
    const goal = screen.getByRole('region', { name: '当前主目标' });
    const main = goal.querySelector<HTMLElement>(':scope > .seer-actions')!;
    expect(within(main).getAllByRole('button')).toHaveLength(3);
    expect(within(main).getByRole('button', { name: '白昼开始实勘实际道路' })).toBeTruthy();
    expect(within(main).queryByRole('button', { name: '求助诊所' })).toBeNull();
    const exits = within(goal).getByRole('region', { name: '暂停与安全返回' });
    expect(within(exits).getAllByRole('button')).toHaveLength(3);
    for (const action of safetyExits) {
      expect(within(exits).getByRole('button', { name: action.label }).closest('details')).toBeNull();
    }
    const other = screen.getByText('其他可选行动', { selector: 'summary' }).closest('details')!;
    const accounts = screen.getByText('原物与个人账目', { selector: 'summary' }).closest('details')!;
    expect(other.open).toBe(false);
    expect(accounts.open).toBe(false);
    await userEvent.click(screen.getByText('其他可选行动', { selector: 'summary' }));
    expect(other.open).toBe(true);
    expect(within(other).getByRole('button', { name: '求助诊所' })).toBeTruthy();
    for (const action of safetyExits) expect(within(other).queryByRole('button', { name: action.label })).toBeNull();
    await userEvent.click(screen.getByText('原物与个人账目', { selector: 'summary' }));
    expect(accounts.open).toBe(true);
    expect(screen.getByRole('region', { name: '原特性与唯一性' }).textContent).toContain('尚未实际交付');
  });

  it.each(safetyExits)('keeps $id visible and usable with zero action points and cash', action => {
    const current = value();
    current.resources.actionsRemaining = 0;
    current.resources.cash = '0便士';
    current.actions = current.actions.map(item => ({ ...item, enabled: false, reason: '当前行动或现款不足。' }));
    current.actions.push(...structuredClone(safetyExits));
    const onCommand = vi.fn();
    render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
    const button = within(screen.getByRole('region', { name: '暂停与安全返回' })).getByRole('button', { name: action.label });
    expect(button.closest('details')).toBeNull();
    expect(disabled(button)).toBe(false);
    expect(descriptions(button)).toEqual([action.cost]);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'DARKNESS', command: action.command });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sends one residentId-based typed intent and locks equivalent rerenders until new acknowledged facts', () => {
    const current = value(), onCommand = vi.fn();
    current.actions.unshift({ id: 'inspect', label: '当面登记莱娜的位置与本人意愿', cost: '0行动、0便士；当面确认实际意愿',
      enabled: true, reason: null, preferredAction: true,
      command: { type: 'EVACUATION', command: { type: 'REGISTER_RESIDENT', residentId: 'DN-LENA' } } });
    const lastResult = { id: 'ui-old-result', week: 158, title: '已抵达', text: '没有新的检定。' };
    const view = render(<DarknessPanel value={current} lastResult={lastResult} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '当面登记莱娜的位置与本人意愿' }));
    view.rerender(<DarknessPanel value={structuredClone(current)} lastResult={{ ...lastResult }} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '当面登记莱娜的位置与本人意愿' }));
    fireEvent.click(screen.getByRole('button', { name: '按实际生活档休养' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'DARKNESS', command: { type: 'EVACUATION', command: { type: 'REGISTER_RESIDENT', residentId: 'DN-LENA' } } });
    expect(disabled(screen.getByRole('button', { name: '按实际生活档休养' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    view.rerender(<DarknessPanel value={current} lastResult={lastResult} busy onCommand={onCommand} />);
    view.rerender(<DarknessPanel value={structuredClone(current)} lastResult={{ ...lastResult }} busy={false} onCommand={onCommand} />);
    expect(disabled(screen.getByRole('button', { name: '按实际生活档休养' }))).toBe(true);
    const next = structuredClone(current);
    next.sections.find(section => section.id === 'clock')!.lines = ['真实经过60秒，居民仍在原处。'];
    view.rerender(<DarknessPanel value={next} lastResult={{ id: 'ui-registration-result', week: 158, title: '已当面登记', text: '实际经过60秒，原居民仍在实际原处。' }}
      busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '按实际生活档休养' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'DARKNESS', command: { type: 'REST' } });
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed-save intent locked after clearing the error until new saved facts arrive', () => {
    const current = value(), onCommand = vi.fn(), onClose = vi.fn();
    const lastResult = { id: 'ui-last-saved-result', week: 158, title: '旧记录', text: '此前已支付的费用保留。' };
    const view = render(<DarknessPanel value={current} lastResult={lastResult} busy={false} onCommand={onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    view.rerender(<DarknessPanel value={current} lastResult={lastResult} busy={false} error="本次保存失败" onCommand={onCommand} onClose={onClose} />);
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    expect(view.container.textContent).toContain('400便士 · 本周行动 3');
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    view.rerender(<DarknessPanel value={structuredClone(current)} lastResult={{ ...lastResult }} busy={false} onCommand={onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    const saved = value(); saved.resources.cash = '580便士'; saved.resources.actionsRemaining = 2;
    view.rerender(<DarknessPanel value={saved} lastResult={{ id: 'ui-saved-work-result', week: 158, title: '劳动完成', text: '实际收入180便士。' }}
      busy onCommand={onCommand} onClose={onClose} />);
    expect(disabled(screen.getByRole('button', { name: '按实际生活档休养' }))).toBe(true);
    view.rerender(<DarknessPanel value={saved} lastResult={{ id: 'ui-saved-work-result', week: 158, title: '劳动完成', text: '实际收入180便士。' }}
      busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled(screen.getByRole('button', { name: '按实际生活档休养' }))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'DARKNESS', command: { type: 'WORK' } });
  });

  it.each(['busy', 'blocked', 'error', 'dead'] as const)('locks all actions, safety exits and close controls while %s', reason => {
    const current = value(); addConsumption(current); current.actions.push(...structuredClone(safetyExits));
    if (reason === 'dead') current.resources.health = 0;
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<DarknessPanel value={current} busy={reason === 'busy'} blocked={reason === 'blocked'}
      error={reason === 'error' ? '尚未确认保存结果' : null} onCommand={onCommand} onClose={onClose} />);
    for (const button of screen.getAllByRole('button', { hidden: true })) {
      expect(disabled(button)).toBe(true);
      fireEvent.click(button);
    }
    expect(onCommand).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('requires an independent consumption decision showing the actual 70 percent chance, costs and death risk', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn();
    render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
    const promotion = screen.getByRole('region', { name: '晋升与服药' });
    const trigger = within(promotion).getByRole('button', { name: '服用已核实的同一瓶魔药' });
    expect(within(screen.getByRole('region', { name: '当前主目标' })).queryByRole('button', { name: trigger.textContent! })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '黑暗服药确认' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('本次公开成功率70%');
    expect(dialog.textContent).toContain('1行动、30灵性；载体与本次准备只花一次，三份原特性与唯一性继续保留');
    expect(dialog.textContent).toContain('健康 100 · 精神 100 · 灵性 120 · 400便士 · 本周行动 3');
    expect(dialog.textContent).toContain(current.risk);
    expect(dialog.textContent).toContain('已付费用不退还');
    expect(dialog.textContent).toContain('真实伤势与污染');
    expect(dialog.textContent).toContain('严重失败可能死亡');
    expect(dialog.textContent).toContain('另行治疗、回收与重新准备');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('contains confirmation focus and makes both cancel and Escape return to the original trigger', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<DarknessPanel value={current} busy={false} onCommand={onCommand} onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: '服用已核实的同一瓶魔药' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '黑暗服药确认' });
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '黑暗服药确认' }));
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份魔药' });
    const cancel = within(dialog).getByRole('button', { name: '取消，继续准备' });
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(cancel);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm);
    const close = screen.getByRole('button', { name: '返回普通生活', hidden: true });
    expect(disabled(close)).toBe(true);
    fireEvent.click(close);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onCommand).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('invalidates an expired preparation before accepting a fresh decision for the current bottle once', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const expired = structuredClone(current), action = expired.actions.find(action => action.id === 'consume')!;
    action.enabled = false; action.reason = '当前同瓶准备已经到期，需实际重新准备。';
    view.rerender(<DarknessPanel value={expired} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    const disabledTrigger = screen.getByRole('button', { name: '服用已核实的同一瓶魔药' });
    expect(disabled(disabledTrigger)).toBe(true);
    expect(descriptions(disabledTrigger)).toContain(action.reason);
    expect(onCommand).not.toHaveBeenCalled();
    const renewed = structuredClone(current);
    const command: DarknessCommand = { type: 'CONSUME', compoundId: 'ui-current-original-compound', confirmed: true };
    renewed.actions.find(action => action.id === 'consume')!.command = command;
    view.rerender(<DarknessPanel value={renewed} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const confirm = screen.getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'DARKNESS', command });
    expect(disabled(screen.getByRole('button', { name: '取消，继续准备' }))).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('rejects the previously opened confirmation when the compound changes without an intermediate disabled state', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const oldConfirm = screen.getByRole('button', { name: '确认服用这一份魔药' });
    const replacement = structuredClone(current);
    replacement.actions.find(action => action.id === 'consume')!.command = { type: 'CONSUME', compoundId: 'ui-other-compound', confirmed: true };
    view.rerender(<DarknessPanel value={replacement} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(oldConfirm);
    expect(onCommand).not.toHaveBeenCalled();
    expect(disabled(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }))).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: replacement.title }));
  });

  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining'] as const)(
    'requires a fresh consumption decision when the public %s resource changes', resource => {
      const current = value(); addConsumption(current);
      const onCommand = vi.fn(), view = render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
      fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
      const changed = structuredClone(current);
      if (resource === 'cash') changed.resources.cash = '392便士';
      else changed.resources[resource] -= 1;
      view.rerender(<DarknessPanel value={changed} busy={false} onCommand={onCommand} />);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(onCommand).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(onCommand).not.toHaveBeenCalled();
    },
  );

  it('requires a fresh consumption decision when the reviewed chance and cost change', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const changed = structuredClone(current);
    changed.sections.find(section => section.id === 'promotion-stability')!.lines = ['本次公开成功率65%；须依据当前身体重新决定。'];
    changed.actions.find(action => action.id === 'consume')!.cost = '1行动、32灵性；仍消耗同一瓶魔药';
    view.rerender(<DarknessPanel value={changed} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('本次公开成功率65%');
    expect(dialog.textContent).toContain('1行动、32灵性');
    expect(dialog.textContent).not.toContain('成功率70%');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('requires a fresh consumption decision when the original injuries change', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<DarknessPanel value={current} busy={false} injuries={[]} injuryRisk={0} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    view.rerender(<DarknessPanel value={current} busy={false} injuryRisk={2} injuries={[
      { id: 'new-original-injury', severity: 'HEAVY', acquiredRevision: 18, treatedRevision: null },
    ]} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('重伤 · 未处理');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(['blocked', 'error', 'dead'] as const)('dismisses an open consumption confirmation when %s arrives', reason => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const changed = structuredClone(current);
    if (reason === 'dead') changed.resources.health = 0;
    view.rerender(<DarknessPanel value={changed} busy={false} blocked={reason === 'blocked'}
      error={reason === 'error' ? '本次保存失败' : null} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(view.container.textContent).toContain('400便士');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('locks both confirmation buttons and Escape while an operation is busy', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    view.rerender(<DarknessPanel value={current} busy onCommand={onCommand} />);
    const dialog = screen.getByRole('dialog');
    for (const button of within(dialog).getAllByRole('button')) {
      expect(disabled(button)).toBe(true);
      fireEvent.click(button);
    }
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('renders acknowledged failure and actual costs without inventing a future check', () => {
    const current = value();
    current.sections.push({ id: 'recent-action', title: '最近实际行动', lines: ['短隐秘失败，实际消耗12灵性、8精神、1行动；原视线仍在。'] });
    current.resources.spirituality = 108; current.resources.mind = 89; current.resources.actionsRemaining = 2;
    const check: PublicCheckResult = { ability: 'will', baseAbility: 31, effectiveAbility: 61, difficulty: 45,
      chance: 82, roll: 91, tier: 'FAILURE', modifiers: [{ source: '短隐秘', value: 30 }] };
    const view = render(<DarknessPanel value={current} lastCheck={check} busy={false} onCommand={vi.fn()} />);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('失败，实际消耗12灵性、8精神、1行动');
    expect(result.textContent).toContain('失败 · 意志检定');
    expect(result.textContent).toContain('本次成功率 82%');
    expect(result.textContent).toContain('实际掷骰 91');
    expect(result.textContent).toContain('短隐秘 +30');
    expect(view.container.textContent).toContain('精神 89 · 灵性 108 · 400便士 · 本周行动 2');
  });

  it.each(['story', 'risk', 'clock', 'resident-consent', 'current-scene', 'last-result'] as const)(
    'invalidates consent when reviewed %s facts change', changedFact => {
      const current = value(); addConsumption(current);
      const onCommand = vi.fn(), view = render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
      fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
      const oldConfirm = screen.getByRole('button', { name: '确认服用这一份魔药' });
      const changed = structuredClone(current);
      if (changedFact === 'story') changed.story = '当前已经返回原庭院，原瓶准备不能沿用。';
      if (changedFact === 'risk') changed.risk = '当前伤势使原先风险说明失效。';
      if (changedFact === 'clock') changed.sections.find(section => section.id === 'clock')!.lines = ['已越过本次实际七日期限。'];
      if (changedFact === 'resident-consent') changed.sections.find(section => section.id === 'darkness-evacuation')!.lines = ['莱娜已撤回本次同行意愿，仍在原处。'];
      if (changedFact === 'current-scene') changed.insideCase = true;
      view.rerender(<DarknessPanel value={changed} busy={false} onCommand={onCommand}
        lastResult={changedFact === 'last-result' ? { id: 'ui-new-receipt', week: 158, title: '当前记录已更新', text: '须重新审阅当前实际事实。' } : null} />);
      expect(screen.queryByRole('dialog')).toBeNull();
      fireEvent.click(oldConfirm);
      expect(onCommand).not.toHaveBeenCalled();
    },
  );

  it.each([
    { type: 'EVACUATION', command: { type: 'WALK', to: 25, pace: 'CAREFUL' } },
    { type: 'EPILOGUE', command: { type: 'SHORT_CONCEALMENT' } },
    { type: 'EPILOGUE', command: { type: 'BOUNDED_MISFORTUNE_DIVERSION' } },
  ] satisfies DarknessCommand[])('sends the actual bounded $type command once without rewriting it', command => {
    const current = value();
    current.actions = [{ id: 'actual-bounded-action', label: '执行当前明确行动', cost: '按投影所列实际费用与秒数',
      command, enabled: true, reason: null }];
    const onCommand = vi.fn();
    render(<DarknessPanel value={current} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole('button', { name: '执行当前明确行动' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'DARKNESS', command });
  });

  it('does not read or render raw source, seed, cursor, future rolls or locked abilities', () => {
    const current = Object.assign(value(), {
      seed: 'PRIVATE_RANDOM_SEED', cursor: 987654321, preparedRoll: 'PRIVATE_FUTURE_ROLL',
      journal: ['PRIVATE_JOURNAL'], lockedAbilities: [{ label: 'PRIVATE_LOCKED_POWER' }],
    });
    Object.defineProperty(current, 'source', { enumerable: true, get: () => { throw new Error('Private source must not be read'); } });
    Object.defineProperty(current, 'frame', { enumerable: true, get: () => { throw new Error('Private random frame must not be read'); } });
    Object.assign(current.resources, { seed: 'PRIVATE_RESOURCE_SEED', cursor: 987654321 });
    const view = render(<DarknessPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/PRIVATE_|987654321|preparedRoll|journal|lockedAbilities|cursor|seed|sourceDigest/);
    expect(view.container.textContent).not.toContain('实际掷骰');
    expect(screen.queryByRole('region', { name: '最近行动结果' })).toBeNull();
  });

  it.each(epilogueExits)('keeps epilogue $id visible at zero resources and sends only its immediate safety intent', async action => {
    const current = value();
    current.promoted = true; current.insideCase = true; current.title = '黑暗 · 原居民返街后的有限事故';
    current.resources.cash = '0便士'; current.resources.actionsRemaining = 0;
    current.abilities = [
      { id: 'darkness.s0.short-concealment', label: '短隐秘', mastery: 0, description: '只遮断已观察视线，至多30秒和10米；仍须实际行走。' },
      { id: 'darkness.s0.bounded-misfortune-diversion', label: '有限厄难偏导', mastery: 0, description: '只偏导同一尚未释放的危险，至多10秒；不能改写已经发生的伤害。' },
    ];
    current.sections.push({ id: 'epilogue', title: '原居民返街后的有限事故', lines: ['两名原居民仍在40米街口；旧伤与原百叶损耗保留。'] });
    current.sections.find(section => section.id === 'injuries')!.lines = ['一处原重伤仍未处理。'];
    current.actions = [
      { id: 'concealment', label: '用短隐秘遮断已知视线', cost: '1行动、12灵性、8精神；仅一次，最多30秒与10米',
        enabled: false, reason: '当前行动不足，仍可沿普通侧路撤离。',
        command: { type: 'EPILOGUE', command: { type: 'SHORT_CONCEALMENT' } } },
      ...structuredClone(epilogueExits),
    ];
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<DarknessPanel value={current} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(screen.getByRole('region', { name: '原居民返街后的有限事故' }).textContent).toContain('两名原居民仍在40米街口');
    const history = screen.getByText('原夜间撤离记录', { selector: 'summary' }).closest('details')!;
    expect(history.open).toBe(false);
    expect(screen.getByRole('region', { name: '原居民返街后的有限事故' }).closest('details')).toBeNull();
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('一处原重伤仍未处理');
    expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull();
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    expect(screen.getByRole('heading', { name: '短隐秘 · 熟练 0' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '有限厄难偏导 · 熟练 0' })).toBeTruthy();
    expect(screen.getByText(/至多10秒；不能改写已经发生的伤害/)).toBeTruthy();
    const exits = screen.getByRole('region', { name: '暂停与安全返回' });
    expect(within(exits).getAllByRole('button')).toHaveLength(3);
    const button = within(exits).getByRole('button', { name: action.label });
    expect(button.closest('details')).toBeNull();
    expect(descriptions(button)).toEqual([action.cost]);
    expect(disabled(button)).toBe(false);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'DARKNESS', command: action.command });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
