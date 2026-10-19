/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoonPanel } from '../../src/renderer/MoonPanel.js';
import type { MoonAction, MoonCommand, MoonProjection } from '../../src/domain/moon/types.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';

// Public component fixtures only. These do not establish natural progression,
// promotion, original-item provenance/conservation, random fairness, or a saved transaction.
function value(): MoonProjection {
  return {
    title: '月亮晋升准备', guidanceKnown: true, promoted: false, insideCase: false,
    story: '伊文来到三处旧渡口。这段未来经历中的六名成年乘客仍须实际抵达各自的彼岸。',
    nextStep: '先走查原灯、原船与普通岸路，再预约实际夜间窗口。',
    risk: '当前准备有时限，服药仍可能失败；原有伤势与已经支付的费用不会撤销。',
    resources: { health: 100, mind: 100, spirituality: 120, cash: '400便士', actionsRemaining: 3 },
    abilities: [{ id: 'moon.s1.self-poise', label: '辉映调息', mastery: 8, description: '为本人随后一次实际精细操作提供有限稳定窗口。' }],
    actions: [
      { id: 'work', label: '做一班实际劳动', cost: '1行动，实际收入24便士', enabled: true, reason: null,
        command: { type: 'WORK' }, preferredAction: true },
      { id: 'rest', label: '付费休养', cost: '1行动、8便士', enabled: true, reason: null, command: { type: 'REST' } },
      { id: 'week', label: '度过七天', cost: '实际经过七天并结算生活费', enabled: false, reason: '用完本周行动再推进。',
        command: { type: 'NEXT_WEEK' } },
    ],
    sections: [
      { id: 'body', title: '当前身体与代价', lines: ['原身体与已支付的费用继续保留；服药可能带来真实伤势与污染。'] },
      { id: 'clock', title: '当前时间与夜航窗口', lines: ['第120周，第3天18时30分。', '本次预约20时至24时；下一公布窗口可能因大风停航。'] },
      { id: 'station-NORTH', title: '北堤渡口', lines: ['原灯状况54，原船状况78；米拉与西蒙仍在原登船岸。'] },
      { id: 'station-REED', title: '芦湾码头', lines: ['原船员乔治已撤回本次许可；诺拉与埃德加尚未抵达彼岸。'] },
      { id: 'station-EAST', title: '东岸小栈', lines: ['原船员露西愿意配合；赫莲与奥斯卡仍须实际登船与下船。'] },
      { id: 'injuries', title: '当前伤势', lines: ['当前无伤；后续受伤会继续保留。'] },
      { id: 'materials', title: '原特性与唯一性', lines: ['第一份已融合于本人；另外两份尚未实际交付。'] },
      { id: 'finance', title: '个人账目', lines: ['原生活开支继续结算，夜航灯油须实际购买。'] },
    ],
  };
}

function addConsumption(current: MoonProjection) {
  current.sections.push({ id: 'promotion-stability', title: '本瓶当前服药准备',
    lines: ['本次公开成功率70%；本瓶准备到期便失效，不能沿用旧准备。'] });
  current.actions.push({ id: 'consume', label: '服用已核实的同一瓶魔药',
    cost: '1行动、30灵性；消耗同一瓶魔药的载体、已整合原物与本次准备',
    enabled: true, reason: null, command: { type: 'CONSUME', compoundId: 'ui-only-original-compound', confirmed: true } });
}

const safetyExits: MoonAction[] = [
  { id: 'suspend', label: '北堤渡口：立即停航并沿岸路返回', cost: '0行动、0便士；实际30分钟',
    enabled: true, reason: null, command: { type: 'SERVICE', command: { type: 'SUSPEND', stationId: 'NORTH' } } },
  { id: 'shore', label: '北堤渡口：沿普通岸路安全返程', cost: '0行动、0便士；实际30分钟',
    enabled: true, reason: null, command: { type: 'SERVICE', command: { type: 'SHORE_RETURN', stationId: 'NORTH' } } },
  { id: 'return', label: '沿普通道路步行返程', cost: '0行动、0便士；实际路程与原生活费继续结算',
    enabled: true, reason: null, command: { type: 'RETURN_ON_FOOT' } },
];

const epilogueExits: MoonAction[] = [
  { id: 'stop-service', label: '立即停止水上服务', cost: '0行动、0便士，1分钟',
    enabled: true, reason: null, command: { type: 'EPILOGUE', command: { type: 'STOP_SERVICE' } } },
  { id: 'evacuate', label: '沿普通堤路带原乘客撤离', cost: '0行动、0便士，实际半小时',
    enabled: true, reason: null, command: { type: 'EPILOGUE', command: { type: 'EVACUATE' } } },
  { id: 'withdraw', label: '本人沿普通堤路离场', cost: '0行动、0便士，实际10分钟',
    enabled: true, reason: null, command: { type: 'EPILOGUE', command: { type: 'WITHDRAW' } } },
];

const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const descriptions = (button: HTMLElement) => button.getAttribute('aria-describedby')!.split(' ')
  .map(id => document.getElementById(id)?.textContent);
afterEach(cleanup);

describe('Moon public panel', () => {
  it('shows one three-station overview, the actual clock, present goal, body, injuries and resources', () => {
    const view = render(<MoonPanel value={value()} busy={false} onCommand={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: '月亮晋升准备' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getAllByRole('region', { name: '三处夜航站点' })).toHaveLength(1);
    const overview = screen.getByRole('region', { name: '三处夜航站点' });
    expect(within(overview).getAllByRole('region')).toHaveLength(3);
    expect(within(overview).getByRole('region', { name: '北堤渡口' }).textContent).toContain('原灯状况54，原船状况78');
    expect(within(overview).getByRole('region', { name: '芦湾码头' }).textContent).toContain('已撤回本次许可');
    expect(within(overview).getByRole('region', { name: '东岸小栈' }).textContent).toContain('仍须实际登船与下船');
    expect(screen.getByRole('region', { name: '当前时间与夜航窗口' }).textContent).toContain('第3天18时30分');
    expect(screen.getByRole('region', { name: '当前时间与夜航窗口' }).textContent).toContain('20时至24时');
    expect(screen.getByRole('region', { name: '当前主目标' }).textContent).toContain('先走查原灯、原船与普通岸路');
    expect(screen.getByRole('region', { name: '当前身体与代价' }).textContent).toContain('真实伤势与污染');
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('当前无伤');
    expect(view.container.textContent).toContain('健康 100 · 精神 100 · 灵性 120 · 400便士 · 本周行动 3');
    expect(view.container.textContent).toContain('这段未来经历');
    expect(view.container.textContent).toContain('当前准备有时限');
    expect(view.container.textContent).not.toMatch(/候选|fixture|Projection|G\d+/);
  });

  it('keeps exact public names and displays only the supplied unlocked skills', async () => {
    const current = value();
    current.title = '艾琳·桑德 [七] 的夜航记录';
    current.story = '艾琳·桑德 [七] 与露西·费恩 [原船员] 来到原渡口。';
    current.sections.find(section => section.id === 'station-EAST')!.lines = ['露西·费恩 [原船员] 仍在同一渡船上。'];
    const view = render(<MoonPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(screen.getByRole('heading', { name: current.title })).toBeTruthy();
    expect(view.container.textContent).toContain(current.story);
    expect(screen.getByRole('region', { name: '东岸小栈' }).textContent).toContain('露西·费恩 [原船员]');
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    expect(screen.getByRole('heading', { name: '辉映调息 · 熟练 8' })).toBeTruthy();
    expect(screen.queryByText(/月照航道|柔和渡行|月辉定形/)).toBeNull();
  });

  it('uses current injury entries and treatment facts instead of a stale section', () => {
    render(<MoonPanel value={value()} busy={false} onCommand={vi.fn()} injuryRisk={2} injuries={[
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
    render(<MoonPanel value={value()} busy={false} onCommand={vi.fn()} injuries={[]} />);
    const injuries = screen.getByRole('region', { name: '当前伤势' });
    expect(injuries.textContent).toContain('当前没有伤势');
    expect(injuries.textContent).not.toContain('伤势风险');
  });

  it('associates exact public costs and disabled reasons with the affected action', () => {
    const onCommand = vi.fn();
    render(<MoonPanel value={value()} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole('button', { name: '度过七天' });
    expect(disabled(button)).toBe(true);
    expect(descriptions(button)).toEqual(['实际经过七天并结算生活费', '用完本周行动再推进。']);
    expect(descriptions(screen.getByRole('button', { name: '付费休养' }))).toEqual(['1行动、8便士']);
    fireEvent.click(button);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('limits main work to three while keeping safety exits outside the secondary fold', async () => {
    const current = value();
    current.actions.push(
      { id: 'clinic', label: '求助诊所', cost: '1行动、12便士', enabled: true, reason: null, command: { type: 'CLINIC' } },
      { id: 'inspect', label: '北堤渡口：走查原灯、原船与普通退路', cost: '1行动、0便士；实际30分钟',
        enabled: true, reason: null, preferredAction: true,
        command: { type: 'SERVICE', command: { type: 'INSPECT', stationId: 'NORTH' } } },
      ...structuredClone(safetyExits),
    );
    render(<MoonPanel value={current} busy={false} onCommand={vi.fn()} />);
    const goal = screen.getByRole('region', { name: '当前主目标' });
    const main = goal.querySelector<HTMLElement>(':scope > .seer-actions')!;
    expect(within(main).getAllByRole('button')).toHaveLength(3);
    expect(within(main).getByRole('button', { name: '北堤渡口：走查原灯、原船与普通退路' })).toBeTruthy();
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
    render(<MoonPanel value={current} busy={false} onCommand={onCommand} />);
    const button = within(screen.getByRole('region', { name: '暂停与安全返回' })).getByRole('button', { name: action.label });
    expect(button.closest('details')).toBeNull();
    expect(disabled(button)).toBe(false);
    expect(descriptions(button)).toEqual([action.cost]);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'MOON', command: action.command });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sends one stationId-based typed intent and locks equivalent rerenders until new acknowledged facts', () => {
    const current = value(), onCommand = vi.fn();
    current.actions.unshift({ id: 'inspect', label: '走查北堤原设备', cost: '1行动、0便士；实际30分钟',
      enabled: true, reason: null, preferredAction: true,
      command: { type: 'SERVICE', command: { type: 'INSPECT', stationId: 'NORTH' } } });
    const lastResult = { id: 'ui-old-result', week: 120, title: '已抵达', text: '没有新的检定。' };
    const view = render(<MoonPanel value={current} lastResult={lastResult} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '走查北堤原设备' }));
    view.rerender(<MoonPanel value={structuredClone(current)} lastResult={{ ...lastResult }} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '走查北堤原设备' }));
    fireEvent.click(screen.getByRole('button', { name: '付费休养' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'MOON', command: { type: 'SERVICE', command: { type: 'INSPECT', stationId: 'NORTH' } } });
    expect(disabled(screen.getByRole('button', { name: '付费休养' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    view.rerender(<MoonPanel value={current} lastResult={lastResult} busy onCommand={onCommand} />);
    view.rerender(<MoonPanel value={structuredClone(current)} lastResult={{ ...lastResult }} busy={false} onCommand={onCommand} />);
    expect(disabled(screen.getByRole('button', { name: '付费休养' }))).toBe(true);
    const next = structuredClone(current);
    next.resources.actionsRemaining = 2;
    view.rerender(<MoonPanel value={next} lastResult={{ id: 'ui-inspection-result', week: 120, title: '已走查', text: '实际支付一次行动，原灯仍待修。' }}
      busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '付费休养' }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: 'MOON', command: { type: 'REST' } });
    expect(onCommand).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed-save intent locked after clearing the error until new saved facts arrive', () => {
    const current = value(), onCommand = vi.fn(), onClose = vi.fn();
    const lastResult = { id: 'ui-last-saved-result', week: 120, title: '旧记录', text: '此前已支付的费用保留。' };
    const view = render(<MoonPanel value={current} lastResult={lastResult} busy={false} onCommand={onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    view.rerender(<MoonPanel value={current} lastResult={lastResult} busy={false} error="本次保存失败" onCommand={onCommand} onClose={onClose} />);
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    expect(view.container.textContent).toContain('400便士 · 本周行动 3');
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    view.rerender(<MoonPanel value={structuredClone(current)} lastResult={{ ...lastResult }} busy={false} onCommand={onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    const saved = value(); saved.resources.cash = '424便士'; saved.resources.actionsRemaining = 2;
    view.rerender(<MoonPanel value={saved} lastResult={{ id: 'ui-saved-work-result', week: 120, title: '劳动完成', text: '实际收入24便士。' }}
      busy onCommand={onCommand} onClose={onClose} />);
    expect(disabled(screen.getByRole('button', { name: '付费休养' }))).toBe(true);
    view.rerender(<MoonPanel value={saved} lastResult={{ id: 'ui-saved-work-result', week: 120, title: '劳动完成', text: '实际收入24便士。' }}
      busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled(screen.getByRole('button', { name: '付费休养' }))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'MOON', command: { type: 'WORK' } });
  });

  it.each(['busy', 'blocked', 'error', 'dead'] as const)('locks all actions, safety exits and close controls while %s', reason => {
    const current = value(); addConsumption(current); current.actions.push(...structuredClone(safetyExits));
    if (reason === 'dead') current.resources.health = 0;
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<MoonPanel value={current} busy={reason === 'busy'} blocked={reason === 'blocked'}
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
    render(<MoonPanel value={current} busy={false} onCommand={onCommand} />);
    const promotion = screen.getByRole('region', { name: '晋升与服药' });
    const trigger = within(promotion).getByRole('button', { name: '服用已核实的同一瓶魔药' });
    expect(within(screen.getByRole('region', { name: '当前主目标' })).queryByRole('button', { name: trigger.textContent! })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '月亮服药确认' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('本次公开成功率70%');
    expect(dialog.textContent).toContain('1行动、30灵性；消耗同一瓶魔药的载体、已整合原物与本次准备');
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
    render(<MoonPanel value={current} busy={false} onCommand={onCommand} onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: '服用已核实的同一瓶魔药' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '月亮服药确认' });
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '月亮服药确认' }));
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
    const onCommand = vi.fn(), view = render(<MoonPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const expired = structuredClone(current), action = expired.actions.find(action => action.id === 'consume')!;
    action.enabled = false; action.reason = '当前同瓶准备已经到期，需实际重新准备。';
    view.rerender(<MoonPanel value={expired} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    const disabledTrigger = screen.getByRole('button', { name: '服用已核实的同一瓶魔药' });
    expect(disabled(disabledTrigger)).toBe(true);
    expect(descriptions(disabledTrigger)).toContain(action.reason);
    expect(onCommand).not.toHaveBeenCalled();
    const renewed = structuredClone(current);
    const command: MoonCommand = { type: 'CONSUME', compoundId: 'ui-current-original-compound', confirmed: true };
    renewed.actions.find(action => action.id === 'consume')!.command = command;
    view.rerender(<MoonPanel value={renewed} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const confirm = screen.getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'MOON', command });
    expect(disabled(screen.getByRole('button', { name: '取消，继续准备' }))).toBe(true);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('rejects the previously opened confirmation when the compound changes without an intermediate disabled state', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<MoonPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const oldConfirm = screen.getByRole('button', { name: '确认服用这一份魔药' });
    const replacement = structuredClone(current);
    replacement.actions.find(action => action.id === 'consume')!.command = { type: 'CONSUME', compoundId: 'ui-other-compound', confirmed: true };
    view.rerender(<MoonPanel value={replacement} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(oldConfirm);
    expect(onCommand).not.toHaveBeenCalled();
    expect(disabled(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }))).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: replacement.title }));
  });

  it.each(['health', 'mind', 'spirituality', 'cash', 'actionsRemaining'] as const)(
    'requires a fresh consumption decision when the public %s resource changes', resource => {
      const current = value(); addConsumption(current);
      const onCommand = vi.fn(), view = render(<MoonPanel value={current} busy={false} onCommand={onCommand} />);
      fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
      const changed = structuredClone(current);
      if (resource === 'cash') changed.resources.cash = '392便士';
      else changed.resources[resource] -= 1;
      view.rerender(<MoonPanel value={changed} busy={false} onCommand={onCommand} />);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(onCommand).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(onCommand).not.toHaveBeenCalled();
    },
  );

  it('requires a fresh consumption decision when the reviewed chance and cost change', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<MoonPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const changed = structuredClone(current);
    changed.sections.find(section => section.id === 'promotion-stability')!.lines = ['本次公开成功率65%；须依据当前身体重新决定。'];
    changed.actions.find(action => action.id === 'consume')!.cost = '1行动、32灵性；仍消耗同一瓶魔药';
    view.rerender(<MoonPanel value={changed} busy={false} onCommand={onCommand} />);
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
    const onCommand = vi.fn(), view = render(<MoonPanel value={current} busy={false} injuries={[]} injuryRisk={0} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    view.rerender(<MoonPanel value={current} busy={false} injuryRisk={2} injuries={[
      { id: 'new-original-injury', severity: 'HEAVY', acquiredRevision: 18, treatedRevision: null },
    ]} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('重伤 · 未处理');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(['blocked', 'error', 'dead'] as const)('dismisses an open consumption confirmation when %s arrives', reason => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<MoonPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const changed = structuredClone(current);
    if (reason === 'dead') changed.resources.health = 0;
    view.rerender(<MoonPanel value={changed} busy={false} blocked={reason === 'blocked'}
      error={reason === 'error' ? '本次保存失败' : null} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(view.container.textContent).toContain('400便士');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('locks both confirmation buttons and Escape while an operation is busy', () => {
    const current = value(); addConsumption(current);
    const onCommand = vi.fn(), view = render(<MoonPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    view.rerender(<MoonPanel value={current} busy onCommand={onCommand} />);
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
    current.sections.push({ id: 'recent-action', title: '最近实际行动', lines: ['修整原灯失败，实际支付12便士、1行动；原灯仍待修。'] });
    current.resources.cash = '388便士'; current.resources.actionsRemaining = 2;
    const check: PublicCheckResult = { ability: 'knowledge', baseAbility: 40, effectiveAbility: 48, difficulty: 50,
      chance: 48, roll: 79, tier: 'FAILURE', modifiers: [{ source: '实际查验', value: 8 }] };
    const view = render(<MoonPanel value={current} lastCheck={check} busy={false} onCommand={vi.fn()} />);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('失败，实际支付12便士、1行动');
    expect(result.textContent).toContain('失败 · 知识检定');
    expect(result.textContent).toContain('本次成功率 48%');
    expect(result.textContent).toContain('实际掷骰 79');
    expect(result.textContent).toContain('实际查验 +8');
    expect(view.container.textContent).toContain('388便士 · 本周行动 2');
  });

  it('does not read or render raw source, seed, cursor, future rolls or locked abilities', () => {
    const current = Object.assign(value(), {
      seed: 'PRIVATE_RANDOM_SEED', cursor: 987654321, preparedRoll: 'PRIVATE_FUTURE_ROLL',
      journal: ['PRIVATE_JOURNAL'], lockedAbilities: [{ label: 'PRIVATE_LOCKED_POWER' }],
    });
    Object.defineProperty(current, 'source', { enumerable: true, get: () => { throw new Error('Private source must not be read'); } });
    Object.defineProperty(current, 'frame', { enumerable: true, get: () => { throw new Error('Private random frame must not be read'); } });
    Object.assign(current.resources, { seed: 'PRIVATE_RESOURCE_SEED', cursor: 987654321 });
    const view = render(<MoonPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/PRIVATE_|987654321|preparedRoll|journal|lockedAbilities|cursor|seed|sourceDigest/);
    expect(view.container.textContent).not.toContain('实际掷骰');
    expect(screen.queryByRole('region', { name: '最近行动结果' })).toBeNull();
  });

  it.each(epilogueExits)('keeps epilogue $id visible at zero resources and sends only its immediate safety intent', async action => {
    const current = value();
    current.promoted = true; current.insideCase = true; current.title = '月亮 · 东岸原船后续处置';
    current.resources.cash = '0便士'; current.resources.actionsRemaining = 0;
    current.abilities = [
      { id: 'moon.s0.moonlit-channel', label: '月照航道', mastery: 0, description: '只照明已知水道，最多维持随后两次现场动作；不能平息风暴。' },
      { id: 'moon.s0.gentle-crossing', label: '柔和渡行', mastery: 0, description: '只稳定同一渡船的一次靠泊，至多六十秒；不能代替实际转移。' },
    ];
    current.sections.push({ id: 'epilogue', title: '东岸原船与同一乘客', lines: ['两名原乘客仍在彼岸登船台；旧伤与原船磨损保留。'] });
    current.sections.find(section => section.id === 'injuries')!.lines = ['一处原重伤仍未处理。'];
    current.actions = [
      { id: 'channel', label: '用月照航道照明已知水道', cost: '1行动、12便士、12灵性、8精神；仅一次',
        enabled: false, reason: '当前行动与现款不足，仍可沿普通岸路撤离。',
        command: { type: 'EPILOGUE', command: { type: 'MOONLIT_CHANNEL' } } },
      ...structuredClone(epilogueExits),
    ];
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<MoonPanel value={current} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(screen.getByRole('region', { name: '东岸原船与同一乘客' }).textContent).toContain('两名原乘客仍在彼岸');
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('一处原重伤仍未处理');
    expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull();
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    expect(screen.getByRole('heading', { name: '月照航道 · 熟练 0' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '柔和渡行 · 熟练 0' })).toBeTruthy();
    expect(screen.getByText(/至多六十秒；不能代替实际转移/)).toBeTruthy();
    const exits = screen.getByRole('region', { name: '暂停与安全返回' });
    expect(within(exits).getAllByRole('button')).toHaveLength(3);
    const button = within(exits).getByRole('button', { name: action.label });
    expect(button.closest('details')).toBeNull();
    expect(descriptions(button)).toEqual([action.cost]);
    expect(disabled(button)).toBe(false);
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'MOON', command: action.command });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
