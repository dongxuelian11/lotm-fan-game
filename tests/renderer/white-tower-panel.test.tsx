/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WhiteTowerPanel } from '../../src/renderer/WhiteTowerPanel.js';
import type { WhiteTowerAction, WhiteTowerCommand, WhiteTowerProjection } from '../../src/domain/white-tower/types.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';

// Public UI fixtures only. They do not establish natural progression, original
// provenance, promotion, RNG fairness or a committed/reopened SQLite transaction.
function value(): WhiteTowerProjection {
  return {
    title: '白塔晋升准备', guidanceKnown: true, promoted: false, insideCase: false,
    story: '原阅览处的两张纸和停止的器材留在原处。三处通路分别实勘与修补，居民须本人真实通过。',
    nextStep: '先当面询问伊娃，再实勘市场台阶；通过后仍须隔周复核。',
    risk: '本瓶准备有时限。失败留下真实重伤与污染，并可能死亡；已支付费用不退。',
    resources: { health: 80, mind: 90, spirituality: 120, cash: '400便士', actionsRemaining: 3 },
    abilities: [{ id: 'reader.s1.bounded-insight', label: '现场洞察', mastery: 8, description: '原有掌握继续保留。' }],
    actions: [
      { id: 'work', label: '做一班实际劳动', cost: '1行动；收入以本次结算为准', enabled: true, reason: null,
        command: { type: 'WORK' }, preferredAction: true },
      { id: 'rest', label: '按实际生活档休养', cost: '1行动；未处理重伤仍须实际治疗', enabled: true, reason: null, command: { type: 'REST' } },
      { id: 'week', label: '走到下一真实周界', cost: '结算实际生活费，不发工资或补资源', enabled: false, reason: '先收回现场工具。', command: { type: 'NEXT_WEEK' } },
    ],
    sections: [
      { id: 'body', title: '当前身体与代价', lines: ['原重伤需先花60便士在诊所处理，再实际休养两次；不会自动恢复。'] },
      { id: 'clock', title: '实际日历与当前地点', lines: ['第146周；街区接待处。晋升全知之眼尚未满12整周，暂不能付费准备服药。'] },
      { id: 'white-tower-passages', title: '三处原通路、实际居民与隔周复核', lines: [
        '市场台阶：伊娃34岁在入口0米，尚未当面询问；原扶栏状况35。',
        '运河检修廊：利昂46岁在入口0米，原铰链盖板尚未修补。',
        '公寓后巷：米娜29岁在入口0米，原格栅尚未固定。',
        '居民真实通过0/3；隔周复核0/3。',
      ] },
      { id: 'injuries', title: '当前伤势', lines: ['原重伤仍未处理。'] },
      { id: 'materials', title: '三份原特性与同一唯一性', lines: ['第一份融合于本人，另外两份尚未实际交付；唯一性须实地核验。'] },
      { id: 'source-history', title: '原阅览处经历', lines: ['原人、原纸和停止的装置仍在原处，仅供回顾。'] },
      { id: 'finance', title: '个人账目', lines: ['原生活开支继续结算。'] },
    ],
  };
}

function addConsumption(current: WhiteTowerProjection) {
  current.sections.push({ id: 'promotion-stability', title: '本瓶当前服药准备',
    lines: ['本次公开成功率70%；本瓶付费准备只在实际七天内有效。'] });
  current.actions.push({ id: 'consume', label: '服用已核实的同一瓶魔药',
    cost: '1行动、30灵性；本次载体与准备只消耗一次', enabled: true, reason: null,
    command: { type: 'CONSUME', compoundId: 'ui-original-compound', confirmed: true } });
}

const safetyExits: WhiteTowerAction[] = [
  { id: 'unload', label: '卸下当前临时支撑', cost: '0行动、0便士；实际卸载', enabled: true, reason: null,
    command: { type: 'PASSAGE', command: { type: 'UNLOAD', passageId: 'market-steps' } } },
  { id: 'route-return', label: '收回工具并原路返回入口', cost: '0行动、0便士；本人实际步行', enabled: true, reason: null,
    command: { type: 'PASSAGE', command: { type: 'RETURN_ON_FOOT', passageId: 'market-steps' } } },
  { id: 'return', label: '沿普通道路返回接待处', cost: '0行动、0便士；仍需实际时间', enabled: true, reason: null,
    command: { type: 'RETURN_ON_FOOT' } },
];
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const descriptions = (button: HTMLElement) => button.getAttribute('aria-describedby')!.split(' ')
  .map(id => document.getElementById(id)?.textContent);
afterEach(cleanup);

describe('White Tower public panel', () => {
  it('shows actual residents, stage, paid original materials and medical costs without hidden labels', () => {
    const view = render(<WhiteTowerPanel value={value()} busy={false} onCommand={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '白塔晋升准备' }));
    const passages = screen.getByRole('region', { name: '三处原通路、实际居民与隔周复核' });
    expect(passages.closest('details')).toBeNull();
    for (const text of ['伊娃34岁', '利昂46岁', '米娜29岁', '真实通过0/3', '隔周复核0/3']) expect(passages.textContent).toContain(text);
    expect(screen.getByRole('region', { name: '当前身体与代价' }).textContent).toContain('诊所处理，再实际休养两次');
    expect(screen.getByRole('region', { name: '实际日历与当前地点' }).textContent).toContain('暂不能付费准备服药');
    expect(screen.getByRole('region', { name: '三份原特性与同一唯一性' }).closest('details')).toBeNull();
    expect(view.container.textContent).toContain('健康 80 · 精神 90 · 灵性 120 · 400便士 · 本周行动 3');
    expect(view.container.textContent).not.toMatch(/fixture|Projection|G\d+|sourceDigest/);
  });

  it('preserves all supplied inherited mastery values and keeps old history read-only', async () => {
    const current = value();
    current.abilities = Array.from({ length: 21 }, (_, index) => ({ id: `public-inherited-${index}`,
      label: `已掌握能力${index + 1}`, mastery: index % 9, description: '已保存的实际掌握。' }));
    render(<WhiteTowerPanel value={current} busy={false} onCommand={vi.fn()} />);
    await userEvent.click(screen.getByText('已掌握的能力', { selector: 'summary' }));
    for (const ability of current.abilities) expect(screen.getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    expect(screen.queryByText(/结构洞察|有限弱处/)).toBeNull();
    await userEvent.click(screen.getByText('过往经历与个人账目', { selector: 'summary' }));
    const history = screen.getByRole('region', { name: '原阅览处经历' });
    expect(history.textContent).toContain('原人、原纸和停止的装置仍在原处');
    expect(within(history).queryAllByRole('button')).toHaveLength(0);
  });

  it('uses current injuries instead of stale history and exposes public disabled reasons', () => {
    const onCommand = vi.fn();
    render(<WhiteTowerPanel value={value()} busy={false} onCommand={onCommand} injuryRisk={2}
      injuries={[{ id: 'original-heavy', severity: 'HEAVY', acquiredRevision: 12, treatedRevision: 15 }]} />);
    const injuries = screen.getAllByRole('region', { name: '当前伤势' });
    expect(injuries).toHaveLength(1); expect(injuries[0]!.textContent).toContain('重伤 · 已处理');
    expect(injuries[0]!.textContent).toContain('伤势风险 2');
    expect(injuries[0]!.textContent).not.toContain('原重伤仍未处理');
    const button = screen.getByRole('button', { name: '走到下一真实周界' });
    expect(disabled(button)).toBe(true);
    expect(descriptions(button)).toEqual(['结算实际生活费，不发工资或补资源', '先收回现场工具。']);
    fireEvent.click(button); expect(onCommand).not.toHaveBeenCalled();
  });

  it('limits main choices to three and keeps ordinary safety exits outside folds', () => {
    const current = value();
    current.actions.unshift({ id: 'ask', label: '询问伊娃本人的许可', cost: '0行动；当面询问', enabled: true, reason: null,
      preferredAction: true, command: { type: 'PASSAGE', command: { type: 'ASK_PERMISSION', passageId: 'market-steps' } } });
    current.actions.push({ id: 'clinic', label: '求助诊所', cost: '1行动、60便士', enabled: true, reason: null,
      command: { type: 'CLINIC' } }, ...structuredClone(safetyExits));
    render(<WhiteTowerPanel value={current} busy={false} onCommand={vi.fn()} />);
    const goal = screen.getByRole('region', { name: '当前主目标' });
    expect(goal.querySelector(':scope > .seer-actions')!.querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: '求助诊所', hidden: true }).closest('details')).toBeTruthy();
    for (const action of safetyExits) expect(screen.getByRole('button', { name: action.label }).closest('details')).toBeNull();
  });

  it.each(safetyExits)('sends exact $id once with zero cash and action points', action => {
    const current = value(); current.resources.actionsRemaining = 0; current.resources.cash = '0便士';
    current.actions = structuredClone(safetyExits);
    const onCommand = vi.fn(); render(<WhiteTowerPanel value={current} busy={false} onCommand={onCommand} />);
    const button = screen.getByRole('button', { name: action.label });
    expect(disabled(button)).toBe(false); expect(descriptions(button)).toEqual([action.cost]);
    fireEvent.click(button); fireEvent.click(button);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WHITE_TOWER', command: action.command });
  });

  it('retains the submitted command latch through save failure, clearing only after changed saved facts', () => {
    const current = value(), onCommand = vi.fn(), onClose = vi.fn();
    const view = render(<WhiteTowerPanel value={current} busy={false} onCommand={onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    view.rerender(<WhiteTowerPanel value={current} busy={false} error="保存失败" onCommand={onCommand} onClose={onClose} />);
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    expect(view.container.textContent).toContain('400便士 · 本周行动 3');
    view.rerender(<WhiteTowerPanel value={structuredClone(current)} busy={false} onCommand={onCommand} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '做一班实际劳动' }));
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WHITE_TOWER', command: { type: 'WORK' } });
    expect(onClose).not.toHaveBeenCalled();
    const saved = structuredClone(current); saved.resources.cash = '580便士'; saved.resources.actionsRemaining = 2;
    view.rerender(<WhiteTowerPanel value={saved} busy={false} onCommand={onCommand} onClose={onClose}
      lastResult={{ id: 'saved-work', week: 146, title: '劳动已结算', text: '实际工资已记录。' }} />);
    expect(disabled(screen.getByRole('button', { name: '按实际生活档休养' }))).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['busy', 'blocked', 'error', 'dead'] as const)('locks actions, exits and close while %s', reason => {
    const current = value(); addConsumption(current); current.actions.push(...structuredClone(safetyExits));
    if (reason === 'dead') current.resources.health = 0;
    const onCommand = vi.fn(), onClose = vi.fn();
    render(<WhiteTowerPanel value={current} busy={reason === 'busy'} blocked={reason === 'blocked'}
      error={reason === 'error' ? '保存结果未确认' : null} onCommand={onCommand} onClose={onClose} />);
    for (const button of screen.getAllByRole('button', { hidden: true })) { expect(disabled(button)).toBe(true); fireEvent.click(button); }
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it('requires separate potion confirmation with the same dose, actual chance, material costs and death risk', () => {
    const current = value(); addConsumption(current); const onCommand = vi.fn();
    render(<WhiteTowerPanel value={current} busy={false} onCommand={onCommand} />);
    fireEvent.click(within(screen.getByRole('region', { name: '晋升与服药' })).getByRole('button', { name: '服用已核实的同一瓶魔药' }));
    const dialog = screen.getByRole('dialog', { name: '白塔服药确认' });
    for (const text of ['成功率70%', '1行动、30灵性', '第一份融合于本人', '实际七天内有效', '已付费用不退还', '真实伤势与污染', '严重失败可能死亡']) expect(dialog.textContent).toContain(text);
    expect(onCommand).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WHITE_TOWER', command: { type: 'CONSUME', compoundId: 'ui-original-compound', confirmed: true } });
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('contains dialog focus and returns cancel or Escape to the exact trigger', () => {
    const current = value(); addConsumption(current); const onCommand = vi.fn();
    render(<WhiteTowerPanel value={current} busy={false} onCommand={onCommand} />);
    const trigger = screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }); fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '白塔服药确认' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '确认服用这一份魔药' }));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger); fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '取消，继续准备' }));
    expect(document.activeElement).toBe(trigger); expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(['dose', 'resources', 'chance', 'body', 'resident', 'clock', 'blocked', 'error'] as const)(
    'invalidates an opened confirmation when reviewed %s changes', change => {
      const current = value(); addConsumption(current); const onCommand = vi.fn();
      const view = render(<WhiteTowerPanel value={current} busy={false} onCommand={onCommand} />);
      fireEvent.click(screen.getByRole('button', { name: '服用已核实的同一瓶魔药' }));
      const oldConfirm = screen.getByRole('button', { name: '确认服用这一份魔药' });
      const changed = structuredClone(current);
      if (change === 'dose') changed.actions.at(-1)!.command = { type: 'CONSUME', compoundId: 'ui-different-dose', confirmed: true };
      if (change === 'resources') changed.resources.cash = '390便士';
      if (change === 'chance') changed.sections.find(s => s.id === 'promotion-stability')!.lines = ['本次公开成功率65%。'];
      if (change === 'body') changed.resources.health = 60;
      if (change === 'resident') changed.sections.find(s => s.id === 'white-tower-passages')!.lines = ['伊娃撤回本次许可，仍在原位置。'];
      if (change === 'clock') changed.sections.find(s => s.id === 'clock')!.lines = ['已越过本次准备期限。'];
      view.rerender(<WhiteTowerPanel value={changed} busy={false} onCommand={onCommand}
        blocked={change === 'blocked'} error={change === 'error' ? '保存未确认' : null} />);
      expect(screen.queryByRole('dialog')).toBeNull(); fireEvent.click(oldConfirm);
      expect(onCommand).not.toHaveBeenCalled();
    },
  );

  it('shows actual action failure and its resolved check without promising a future outcome', () => {
    const current = value();
    current.sections.push({ id: 'recent-action', title: '最近实际行动', lines: ['结构洞察失败；消耗12灵性与8精神，原结构仍未核验。'] });
    const check: PublicCheckResult = { ability: 'knowledge', baseAbility: 31, effectiveAbility: 61,
      difficulty: 45, chance: 82, roll: 91, tier: 'FAILURE', modifiers: [{ source: '结构洞察', value: 30 }] };
    render(<WhiteTowerPanel value={current} busy={false} lastCheck={check} onCommand={vi.fn()} />);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('结构洞察失败'); expect(result.textContent).toContain('失败 · 知识检定');
    expect(result.textContent).toContain('实际掷骰 91'); expect(result.textContent).toContain('结构洞察 +30');
  });

  it.each(['STOP_EFFECTS', 'SECURE_GATE', 'UNLOAD_STRUT', 'ORDINARY_SIDE_EXIT', 'WITHDRAW'] as const)(
    'keeps promoted safety action %s visible with zero cash and actions', type => {
      const current = value(); current.promoted = true; current.insideCase = true;
      current.title = '序列0 白塔'; current.resources.cash = '0便士'; current.resources.actionsRemaining = 0;
      current.sections.push({ id: 'epilogue', title: '旧机械闸当前险情', lines: ['原居民仍在实际位置，旧伤与原装置损耗保留。'] });
      const command: WhiteTowerCommand = { type: 'EPILOGUE', command: { type } };
      current.actions = [{ id: 'safety', label: '执行当前安全退出', cost: '0行动、0便士；普通行动仍须实际时间', enabled: true, reason: null, command }];
      const onCommand = vi.fn(); render(<WhiteTowerPanel value={current} busy={false} onCommand={onCommand} />);
      expect(screen.getByRole('region', { name: '旧机械闸当前险情' }).closest('details')).toBeNull();
      expect(screen.getByText('三处通路与原居民记录', { selector: 'summary' }).closest('details')!.open).toBe(false);
      const button = screen.getByRole('button', { name: '执行当前安全退出' });
      expect(button.closest('details')).toBeNull(); expect(disabled(button)).toBe(false);
      fireEvent.click(button); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WHITE_TOWER', command });
    },
  );

  it('never reads private source/frame or displays hidden rolls and locked abilities', () => {
    const current = Object.assign(value(), { seed: 'PRIVATE_SEED', cursor: 987654321,
      preparedRoll: 'PRIVATE_ROLL', journal: ['PRIVATE_JOURNAL'], lockedAbilities: ['PRIVATE_POWER'] });
    Object.defineProperty(current, 'source', { enumerable: true, get: () => { throw Error('Do not read private source'); } });
    Object.defineProperty(current, 'frame', { enumerable: true, get: () => { throw Error('Do not read private frame'); } });
    const view = render(<WhiteTowerPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(view.container.innerHTML).not.toMatch(/PRIVATE_|987654321|preparedRoll|journal|lockedAbilities|cursor|seed|sourceDigest/);
    expect(view.container.textContent).not.toContain('实际掷骰');
  });
});
