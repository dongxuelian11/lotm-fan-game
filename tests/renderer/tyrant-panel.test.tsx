/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TyrantAction, TyrantCommand, TyrantProjection } from '../../src/domain/tyrant/types.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';
import { TyrantPanel } from '../../src/renderer/TyrantPanel.js';

// Public presentation fixtures only: these assertions do not establish natural
// progression, canon, fair RNG, challenge completion or committed SQLite saves.
function projection(): TyrantProjection {
  return {
    title: '雷神的暴君晋升准备', guidanceKnown: true, promoted: false, insideCase: false,
    story: '原来的水量、闸门、轮具和伤势仍在；三岸居民各自作出当前选择。',
    nextStep: '现款不足以装粮，先劳动筹齐费用，再把北岸的同一包粮运到南岸。',
    risk: '挑战太阳真神时，即使撤退也会遭遇截击。服药失败会留下代价，严重失败可能死亡。',
    resources: { health: 73, mind: 82, spirituality: 94, cash: '40便士', actionsRemaining: 2 },
    abilities: [
      { id: 'sailor.inherited-zero', label: '原有航海知识', mastery: 0, description: '原有掌握仍为零。' },
      { id: 'sailor.s1.thunder-guidance', label: '雷势引导', mastery: 8, description: '只保留已经实际取得的掌握。' },
    ],
    actions: [
      { id: 'load', label: '付费装上原三粮包', cost: '180便士、1行动、600秒；装3粮并为北岸保留3粮',
        enabled: false, reason: '还缺140便士；先实际劳动筹款。', preferredAction: true,
        command: { type: 'COAST', command: { type: 'LOAD_TRANSFER', coastId: 'north' } } },
      { id: 'work', label: '做一班实际劳动', cost: '1行动；收入按本次结算，需实际时间', enabled: true,
        reason: null, command: { type: 'WORK' } },
      { id: 'rest', label: '按当前生活档休养', cost: '1行动；仍须结算生活费，重伤需先治疗', enabled: true,
        reason: null, command: { type: 'REST' } },
      { id: 'week', label: '度过下一周', cost: '结算本周生活开支；不会补粮或还原装备', enabled: false,
        reason: '须先从堤端实际返港。', command: { type: 'NEXT_WEEK' } },
    ],
    sections: [
      { id: 'body', title: '当前身体与代价', lines: ['当前健康73，精神82，灵性94；一处已处理轻伤。'] },
      { id: 'clock', title: '当前日历与地点', lines: ['第162周，北岸灯港。北岸居民答复有效至第170周开始，余8周。'] },
      { id: 'tyrant-coasts', title: '三岸居民与当前约定', lines: [
        '三岸原有居民270000人；同一批居民同时畏惧、服从并信仰者180000人，还差20000人。',
        '北岸灯港90000人，现存9粮；东岸礁港90000人，现存12粮；南岸浅港90000人，现存0粮。',
        '各岸约定须隔周复核，现有证据只保留12周；不同人群不能相加冒充同时满足。',
        '一包3粮：装运180便士、1行动、600秒；航行60便士、1行动、1真实周；卸粮1行动、600秒。',
      ] },
      { id: 'tyrant-challenge', title: '独自挑战太阳真神', lines: [
        '对方是仍在世、仍敌对的太阳途径序列0；本人尚未脱离，出口距开场60米。',
        '本人和太阳真神各自承担实际消耗，没有其他协助者。',
      ] },
      { id: 'materials', title: '三份原特性与同一暴君唯一性', lines: [
        '第一份原特性已在本人身上；第二份仍在原失败遗留处；第三份尚待保管者交付。',
        '同一唯一性仍待实际核验与交接，普通载体剩余3份。',
      ] },
      { id: 'injuries', title: '当前伤势', lines: ['一处已处理轻伤。'] },
      { id: 'source-history', title: '原小湾与原装备', lines: ['诺拉精力85；原水20、闸门96、系索99、绞盘99，未自动复原。'] },
      { id: 'finance', title: '个人账目', lines: ['旧债和本周生活开支仍需实际结算。'] },
    ],
  };
}
function addConsumption(current: TyrantProjection) {
  current.sections.push({ id: 'promotion-stability', title: '本瓶服药准备',
    lines: ['本瓶当前成功率70%；已付准备在七天内有效，剩5天。'] });
  current.actions.push({ id: 'consume', label: '服用当前这一瓶魔药', enabled: true, reason: null,
    cost: '1行动、30灵性；消耗本瓶载体和本次付费准备',
    command: { type: 'CONSUME', compoundId: 'public-original-compound', confirmed: true } });
}
const coastExit: TyrantAction = { id: 'return-coast', label: '沿原堤实际返港', enabled: true, reason: null,
  cost: '0行动、0便士、60秒；本人走完原三十米',
  command: { type: 'COAST', command: { type: 'RETURN_TO_HARBOR', coastId: 'north' } } };
const challengeExits: TyrantAction[] = [
  { id: 'withdraw', label: '付灵性掩护并后撤', enabled: true, reason: null,
    cost: '0行动、4灵性、20秒；仍会遭遇敌对截击', command: { type: 'CHALLENGE', command: { type: 'WITHDRAW' } } },
  { id: 'retreat', label: '沿原路普通撤退', enabled: true, reason: null,
    cost: '0行动、0灵性、30秒；仍会受伤或死亡', command: { type: 'CHALLENGE', command: { type: 'RETREAT' } } },
  { id: 'break-contact', label: '撑过出口截击并脱离', enabled: true, reason: null,
    cost: '0行动、0灵性、10秒；必须实际撑过这一次截击', command: { type: 'CHALLENGE', command: { type: 'BREAK_CONTACT' } } },
];
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const descriptions = (element: HTMLElement) => element.getAttribute('aria-describedby')!.split(' ')
  .map(id => document.getElementById(id)?.textContent);
afterEach(cleanup);

describe('Tyrant public chapter panel', () => {
  it('shows three aggregate coasts, the same current intersection, finite grain, clocks and real materials', () => {
    const view = render(<TyrantPanel value={projection()} busy={false} onCommand={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '雷神的暴君晋升准备' }));
    const coasts = screen.getByRole('region', { name: '三岸居民与当前约定' });
    for (const text of ['270000人', '同时畏惧、服从并信仰者180000人', '还差20000人', '现存0粮', '12周', '1真实周'])
      expect(coasts.textContent).toContain(text);
    expect(coasts.closest('details')).toBeNull();
    expect(screen.getByRole('region', { name: '当前日历与地点' }).textContent).toContain('余8周');
    expect(screen.getByRole('region', { name: '三份原特性与同一暴君唯一性' }).closest('details')).toBeNull();
    expect(screen.getByRole('region', { name: '独自挑战太阳真神' }).textContent).toContain('仍在世、仍敌对的太阳途径序列0');
    expect(view.container.textContent).toContain('健康 73 · 精神 82 · 灵性 94 · 40便士 · 本周行动 2');
    expect(view.container.querySelector('table')).toBeNull();
    expect(view.container.textContent).not.toMatch(/fixture|Projection|G\d+|原创规则|sourceDigest/);
  });

  it('recommends an enabled affordable action instead of the disabled preferred ritual and keeps shortage instructions', async () => {
    render(<TyrantPanel value={projection()} busy={false} onCommand={vi.fn()} />);
    expect(screen.getByText('当前可做：做一班实际劳动')).toBeTruthy();
    const primary = screen.getByRole('button', { name: '做一班实际劳动' });
    expect(disabled(primary)).toBe(false); expect(primary.className).not.toContain('quiet');
    const goal = screen.getByRole('region', { name: '当前主目标' });
    const buttons = goal.querySelector(':scope > .seer-actions')!.querySelectorAll('button');
    expect(buttons.length).toBeLessThanOrEqual(3);
    for (const button of buttons) expect(button.disabled).toBe(false);
    await userEvent.click(screen.getByText('其他可选行动', { selector: 'summary' }));
    expect(within(screen.getByText('其他可选行动', { selector: 'summary' }).parentElement!).getAllByRole('button')).toHaveLength(1);
    const unavailable = screen.getByRole('button', { name: '付费装上原三粮包' });
    expect(disabled(unavailable)).toBe(true);
    expect(descriptions(unavailable)).toEqual(['180便士、1行动、600秒；装3粮并为北岸保留3粮', '还缺140便士；先实际劳动筹款。']);
  });

  it('can make an available potion the primary action without duplicating its button', () => {
    const value = projection(); addConsumption(value); value.actions.at(-1)!.preferredAction = true;
    render(<TyrantPanel value={value} busy={false} onCommand={vi.fn()} />);
    expect(screen.getByText('当前可做：服用当前这一瓶魔药')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: '服用当前这一瓶魔药', hidden: true })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '服用当前这一瓶魔药' }).closest('details')).toBeNull();
  });

  it.each([coastExit, ...challengeExits])('keeps $id outside folds and submits the exact public command once with zero cash and actions', action => {
    const value = projection(); value.resources.cash = '0便士'; value.resources.actionsRemaining = 0;
    value.actions = [structuredClone(action)]; const onCommand = vi.fn();
    render(<TyrantPanel value={value} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole('button', { name: action.label });
    expect(button.closest('details')).toBeNull(); expect(disabled(button)).toBe(false);
    expect(descriptions(button)).toEqual([action.cost]);
    expect(screen.getByText(`当前可做：${action.label}`)).toBeTruthy();
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'TYRANT', command: action.command });
  });

  it('retains zero mastery and current original gear without creating sequence-zero skills', async () => {
    const value = projection(); render(<TyrantPanel value={value} busy={false} onCommand={vi.fn()} />);
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    for (const ability of value.abilities)
      expect(screen.getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    await userEvent.click(screen.getByText('过往经历与个人账目', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: '原小湾与原装备' }).textContent).toContain('诺拉精力85；原水20、闸门96、系索99、绞盘99');
    expect(screen.queryByText('有限物质转换')).toBeNull();
  });

  it('renders the supplied current injuries and updates resources and energy after a saved action', async () => {
    const value = projection(); const onCommand = vi.fn();
    const view = render(<TyrantPanel value={value} busy={false} onCommand={onCommand} injuryRisk={1}
      injuries={[{ id: 'current-light', severity: 'LIGHT', acquiredRevision: 12, treatedRevision: 14 }]} />);
    const injuries = screen.getByRole('region', { name: '当前伤势' });
    expect(injuries.textContent).toContain('轻伤 · 已处理'); expect(injuries.textContent).not.toContain('重伤');
    const changed = structuredClone(value); changed.resources.health = 91; changed.resources.spirituality = 66;
    changed.sections.find(section => section.id === 'body')!.lines = ['当前健康91，精神82，灵性66；没有伤势。'];
    changed.sections.find(section => section.id === 'source-history')!.lines = ['诺拉精力79，原水20，原器材继续保留实际损耗。'];
    view.rerender(<TyrantPanel value={changed} busy={false} onCommand={onCommand} injuries={[]} injuryRisk={0} />);
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('当前没有伤势');
    expect(screen.getByRole('region', { name: '当前身体与代价' }).textContent).toContain('健康91');
    expect(view.container.textContent).toContain('健康 91 · 精神 82 · 灵性 66');
    await userEvent.click(screen.getByText('过往经历与个人账目', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: '原小湾与原装备' }).textContent).toContain('诺拉精力79');
  });

  it('keeps the same submission latched through a failed save until changed saved public facts arrive', () => {
    const value = projection(); const onCommand = vi.fn(), onClose = vi.fn();
    const view = render(<TyrantPanel value={value} busy={false} onCommand={onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    view.rerender(<TyrantPanel value={value} busy={false} error="保存失败" onCommand={onCommand} onClose={onClose} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    expect(view.container.textContent).toContain('40便士 · 本周行动 2');
    view.rerender(<TyrantPanel value={structuredClone(value)} busy={false} onCommand={onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'TYRANT', command: { type: 'WORK' } });
    expect(onClose).not.toHaveBeenCalled();
    const saved = structuredClone(value); saved.resources.cash = '220便士'; saved.resources.actionsRemaining = 1;
    view.rerender(<TyrantPanel value={saved} busy={false} onCommand={onCommand} onClose={onClose}
      lastResult={{ id: 'saved-work', week: 162, title: '劳动结算', text: '已收到实际工资。' }} />);
    expect(disabled(screen.getByRole('button', { name: '按当前生活档休养' }))).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['busy', 'blocked', 'error', 'dead'] as const)('locks actions and close when %s', reason => {
    const value = projection(); addConsumption(value); value.actions.push(structuredClone(coastExit));
    if (reason === 'dead') value.resources.health = 0;
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<TyrantPanel value={value} busy={reason === 'busy'} blocked={reason === 'blocked'}
      error={reason === 'error' ? '保存未确认' : null} onCommand={onCommand} onClose={onClose} />);
    for (const button of screen.getAllByRole('button', { hidden: true })) {
      expect(disabled(button)).toBe(true); fireEvent.click(button);
    }
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it('requires a separate same-bottle confirmation with current chance, window, resources and death risk', () => {
    const value = projection(); addConsumption(value); const onCommand = vi.fn();
    render(<TyrantPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '服用当前这一瓶魔药' }));
    const dialog = screen.getByRole('dialog', { name: '暴君服药确认' });
    for (const text of ['70%', '剩5天', '1行动、30灵性', '第一份原特性已在本人身上', '已付费用不退还', '严重失败可能死亡'])
      expect(dialog.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一份魔药' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一份魔药' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'TYRANT', command: {
      type: 'CONSUME', compoundId: 'public-original-compound', confirmed: true,
    } });
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('contains confirmation focus and returns it to the exact trigger on cancellation', () => {
    const value = projection(); addConsumption(value); const onCommand = vi.fn();
    render(<TyrantPanel value={value} busy={false} onCommand={onCommand} />);
    const trigger = screen.getByRole('button', { name: '服用当前这一瓶魔药' }); fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '暴君服药确认' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '确认服用这一份魔药' }));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(['dose', 'resources', 'chance', 'coasts', 'challenge', 'clock', 'injuries', 'blocked', 'error'] as const)(
    'invalidates reviewed confirmation when %s changes', change => {
      const value = projection(); addConsumption(value); const onCommand = vi.fn();
      const view = render(<TyrantPanel value={value} busy={false} onCommand={onCommand} injuries={[]} />);
      fireEvent.click(screen.getByRole('button', { name: '服用当前这一瓶魔药' }));
      const oldConfirm = screen.getByRole('button', { name: '确认服用这一份魔药' });
      const changed = structuredClone(value);
      if (change === 'dose') changed.actions.at(-1)!.command = { type: 'CONSUME', compoundId: 'other-dose', confirmed: true };
      if (change === 'resources') changed.resources.cash = '30便士';
      if (change === 'chance') changed.sections.find(section => section.id === 'promotion-stability')!.lines = ['本瓶当前成功率65%。'];
      if (change === 'coasts') changed.sections.find(section => section.id === 'tyrant-coasts')!.lines = ['一岸约定过期，当前同时满足人数不足。'];
      if (change === 'challenge') changed.sections.find(section => section.id === 'tyrant-challenge')!.lines = ['本人尚未实际脱离。'];
      if (change === 'clock') changed.sections.find(section => section.id === 'clock')!.lines = ['当前准备已过期。'];
      view.rerender(<TyrantPanel value={changed} busy={false} onCommand={onCommand}
        injuries={change === 'injuries' ? [{ id: 'new', severity: 'LIGHT', acquiredRevision: 22, treatedRevision: null }] : []}
        blocked={change === 'blocked'} error={change === 'error' ? '保存未确认' : null} />);
      expect(screen.queryByRole('dialog')).toBeNull(); fireEvent.click(oldConfirm);
      expect(onCommand).not.toHaveBeenCalled();
    },
  );

  it('shows actual failure, real consumed costs and its resolved check, then clears stale dice on a later ordinary action', () => {
    const value = projection(); const onCommand = vi.fn();
    value.sections.push({ id: 'recent-action', title: '最近实际行动', lines: ['护堤失败；实耗3粮、6灵性、1行动和600秒，留下轻伤。'] });
    const check: PublicCheckResult = { ability: 'will', baseAbility: 37, effectiveAbility: 57,
      difficulty: 40, chance: 71, roll: 89, tier: 'FAILURE', modifiers: [{ source: '原有护堤能力', value: 20 }] };
    const view = render(<TyrantPanel value={value} busy={false} lastCheck={check} onCommand={onCommand} />);
    let result = screen.getByRole('region', { name: '最近行动结果' });
    for (const text of ['护堤失败', '实耗3粮、6灵性、1行动和600秒', '失败 · 意志检定', '实际掷骰 89', '原有护堤能力 +20'])
      expect(result.textContent).toContain(text);
    const saved = structuredClone(value); saved.sections.find(section => section.id === 'recent-action')!.lines = ['本人已沿原三十米返港；用时60秒，未扣行动、便士或灵性。'];
    view.rerender(<TyrantPanel value={saved} busy={false} lastCheck={null} onCommand={onCommand} />);
    result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('用时60秒'); expect(result.textContent).not.toMatch(/实际掷骰|意志检定/);
  });

  it('shows sequence-zero rescue and inherited zero values while keeping ordinary return separate from unfinished rescue', async () => {
    const value = projection(); value.promoted = true; value.title = '序列0 暴君'; value.insideCase = true;
    value.abilities.push({ id: 'sailor.s0.material-change', label: '有限物质转换', mastery: 0, description: '尚未实际应用。' });
    value.sections.push({ id: 'tyrant-epilogue', title: '岸边两位居民的当前险情', lines: ['伊芙32岁在8米处，托马斯47岁在14米处；原缆绳尚未架好，须先隔离危险再普通救援。'] });
    const onClose = vi.fn(); const view = render(<TyrantPanel value={value} busy={false} onCommand={vi.fn()} onClose={onClose} />);
    expect(screen.getByRole('region', { name: '岸边两位居民的当前险情' }).closest('details')).toBeNull();
    expect(screen.getByText('三岸居民与粮食记录', { selector: 'summary' }).closest('details')!.open).toBe(false);
    expect(screen.getByText('独自挑战与脱离经过', { selector: 'summary' }).closest('details')!.open).toBe(false);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    expect(screen.getByRole('heading', { name: '有限物质转换 · 熟练 0' })).toBeTruthy();
    const finished = structuredClone(value); finished.insideCase = false;
    view.rerender(<TyrantPanel value={finished} busy={false} onCommand={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' })); expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(['ISOLATE', 'SECURE_ROPE', 'RESCUE_IVA', 'RESCUE_TOMAS', 'WITHDRAW'] as const)(
    'keeps the ordinary rescue command %s available outside folds with no cash, action points or spirituality', type => {
      const value = projection(); value.promoted = true; value.insideCase = true;
      value.resources.cash = '0便士'; value.resources.actionsRemaining = 0; value.resources.spirituality = 0;
      const command: TyrantCommand = { type: 'EPILOGUE', command: { type } };
      value.actions = [{ id: 'ordinary-rescue', label: '执行当前普通救援', enabled: true, reason: null,
        cost: '0行动、0便士、0灵性；仍需实际时间、原工具和当前同意', command, preferredAction: true }];
      const onCommand = vi.fn(); render(<TyrantPanel value={value} busy={false} onCommand={onCommand} />);
      const button = screen.getByRole('button', { name: '执行当前普通救援' });
      expect(button.closest('details')).toBeNull(); expect(disabled(button)).toBe(false);
      fireEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'TYRANT', command });
    },
  );

  it('does not read private state or display private random, future dice or locked powers', () => {
    const value = Object.assign(projection(), { seed: 'PRIVATE_SEED', cursor: 987654321,
      futureRoll: 'PRIVATE_ROLL', journal: ['PRIVATE_JOURNAL'], lockedAbilities: ['PRIVATE_POWER'] });
    Object.defineProperty(value, 'source', { enumerable: true, get: () => { throw Error('Private source must not be read'); } });
    Object.defineProperty(value, 'frame', { enumerable: true, get: () => { throw Error('Private frame must not be read'); } });
    const view = render(<TyrantPanel value={value} busy={false} onCommand={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/PRIVATE_|987654321|futureRoll|journal|lockedAbilities|cursor|seed|sourceDigest/);
    expect(view.container.textContent).not.toContain('实际掷骰');
  });
});
