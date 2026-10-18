/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DoorPanel } from '../../src/renderer/DoorPanel.js';
import type { DoorProjection } from '../../src/shared/slice-contracts.js';
import type { PublicCheckResult } from '../../src/shared/contracts.js';

// Hand-authored public presentation snapshots only. These do not establish a valid
// domain continuation, natural-run history, resource ledger or SQLite persistence.
const inheritedAbilities = [
  ['door.s9.door-opening', '开门', 78],
  ['door.s8.tricks', '有限戏法', 45],
  ['door.s7.astrology', '有限占星', 66],
  ['door.s7.divination-interference', '占卜干扰', 8],
  ['door.s6.recording', '亲见记录', 8],
  ['door.s6.release', '消耗原记录释放', 8],
  ['door.s5.travel', '灵界旅行与定位', 46],
  ['door.s5.invisible-hand', '无形之手', 0],
  ['door.s4.space-hiding', '空间隐藏', 0],
  ['door.s4.space-pocket', '空间口袋', 0],
  ['door.s4.banishment', '放逐', 0],
  ['door.s3.star-wandering', '星空漫游', 0],
  ['door.s3.astral-positioning', '星界定位', 0],
  ['door.s2.symbolic-transit', '象征通行', 8],
  ['door.s2.pattern-reproduction', '光纹复现', 0],
  ['door.s1.endpoint-location', '端点定位', 8],
  ['door.s1.anchor-maintenance', '锚点维系', 0],
] as const;

function value(prepared = false): DoorProjection {
  return {
    title: '序列0 门', guidanceKnown: true, promoted: false, insideCase: false,
    story: prepared
      ? '三处居民通路已完成交接与现场核验，同一成药与付费准备在原调配室就绪。'
      : '账房门槛开裂，阿妲的同一封闭账箱仍待送到后室的内尔手中。先问过原人，查看两端，再用普通器具修通。',
    nextStep: prepared
      ? '核对同一瓶的当前资源、准备有效期与实际服药风险。'
      : '核对账房本次许可与原门槛；十八米侧廊可供普通步行返回。',
    risk: '失败会留下真实重伤与污染，严重失败可能死亡。原死者不会复活，也不产生第四份特性。',
    resources: { health: 80, maxHealth: 100, mind: prepared ? 90 : 98, maxMind: 100,
      spirituality: prepared ? 108 : 120, maxSpirituality: 120,
      cash: prepared ? '3750便士' : '3900便士', actionsRemaining: prepared ? 2 : 3, weeklyBudget: 3 },
    injuries: [
      { id: 'old-light-1', severity: 'LIGHT', treated: false },
      { id: 'old-light-2', severity: 'LIGHT', treated: false },
    ], injuryRisk: 1,
    abilities: inheritedAbilities.map(([id, label, mastery]) => ({ id, label, mastery,
      description: '原有掌握保持不变；没有实际应用的能力不补练。' })),
    actions: [
      { id: 'work', label: '做本周原职业工作', cost: '1行动，180便士，每周一次', enabled: true, reason: null,
        command: { type: 'WORK' }, preferredAction: true },
      { id: 'clinic', label: '付费普通处置真实重伤', cost: '1行动、60便士，之后仍须实际休养', enabled: false,
        reason: '没有尚未处置的重伤。', command: { type: 'CLINIC' } },
      { id: 'stop', label: '修整账房门槛并交付原账箱：停止当前作业', cost: '0行动、0便士，实际1秒', enabled: !prepared, reason: prepared ? '当前不在账房现场。' : null,
        command: { type: 'SERVICE', command: { type: 'STOP', jobId: 'ledger-threshold' } } },
      { id: 'return', label: '本人沿普通路返回街区接待处', cost: '0行动、0便士，实际两小时', enabled: true,
        reason: null, command: { type: 'RETURN_ON_FOOT' } },
      { id: 'consume', label: '独立确认当前风险并饮用同一瓶', cost: '1行动、30灵性；消耗本瓶载体与准备', enabled: prepared,
        reason: prepared ? null : '先取得同一原件并完成本瓶付费准备。',
        command: { type: 'CONSUME', compoundId: 'door-compound-1', confirmed: true } },
    ],
    sections: [
      { id: 'clock', title: '实际日历与当前地点', lines: [prepared
        ? '1353年，第230周，当前在门调配室。'
        : '1353年8月25日，第218周，当前在账册所门槛。'] },
      { id: 'door-services', title: '三件居民服务与现场核验', lines: [prepared
        ? '账箱、原搬运工与工具箱已分别送达接收人，并在各自现场核验。'
        : '阿妲的原账箱需要经过六米门槛送到后室收件台，内尔须本人核收；新嵌条8便士，十八米侧廊仍可步行。'] },
      { id: 'materials', title: '三份原特性与同一门唯一性', lines: [
        prepared
          ? '第一份失败原瓶的同一残余与第三份原供应瓶已交接到本瓶；第二份仍由本人融合，三份总量不增加。'
          : '第一份原瓶失败残余须实地查找；第二份已融合本人；第三份仍在原供应方库存。',
        '失败原份调查120便士，原处封存后隔一真实周重新取得许可，交接30便士。',
        '第三份原供应瓶6600便士，或完成本瓶五项真实劳动后支付1100便士。',
        '三件有限载体分别50、70、90便士；调配另付40便士。',
        prepared
          ? '同一门唯一性已在本瓶中；本瓶绑定第一件载体，尚有两件未使用。'
          : '唯一性须核对当前保管链与空位；查链180便士，交接200便士。',
      ] },
      { id: 'promotion-stability', title: '本瓶准备与实际服药风险', lines: [prepared
        ? '当前成功率70%，同一原调配室的实际准备有效七天。'
        : '尚无有效准备，当前不能饮用。',
      '准备实付150便士、1行动、12灵性与8精神；离场、过期或服药后失效。'] },
      { id: 'finance', title: '实际工资、生活与旧债', lines: ['本周原职业工资180便士，须本人实际工作一次；每周3行动，生活费30便士，等待不会发工资。'] },
      { id: 'source-originals', title: '原人原物的已知去向', lines: [
        '旧罗温已经死亡；原杆仍归他所有，三枚原印记已经耗尽。',
        '玛拉在原通行室场外，精力80，旧许可已撤回；原包在入口架，原油灯余油2，遮门关闭。',
        '异星封包仍在原远端，两套旧保护装具已归档，余量70秒与90秒不能自动用作本章物资。',
      ] },
    ],
  };
}

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Door public panel', () => {
  it('shows actual current/max resources, weekly actions, injuries and material costs', () => {
    const view = render(<DoorPanel value={value()} busy={false} onCommand={vi.fn()} />);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: '序列0 门' }));
    expect(view.container.textContent).toContain('健康 80/100 · 精神 98/100 · 灵性 120/120 · 现金 3900便士 · 本周行动 3/3');
    const injuries = screen.getByRole('region', { name: '当前伤势' });
    expect(within(injuries).getAllByRole('listitem')).toHaveLength(2);
    expect(injuries.textContent).toContain('伤势风险 1');
    expect(injuries.textContent).toContain('轻伤 · 未处理');
    expect(screen.getByRole('region', { name: '三件居民服务与现场核验' }).closest('details')).toBeNull();
    const materials = screen.getByRole('region', { name: '三份原特性与同一门唯一性' });
    for (const text of ['第一份原瓶失败残余须实地查找', '第二份已融合本人', '第三份仍在原供应方库存',
      '调查120便士', '隔一真实周重新取得许可，交接30便士', '本瓶五项真实劳动后支付1100便士',
      '三件有限载体分别50、70、90便士']) expect(materials.textContent).toContain(text);
    expect(screen.getByRole('region', { name: '实际日历与当前地点' }).textContent).toContain('1353年8月25日，第218周');
    expect(screen.getByRole('region', { name: '本瓶准备与实际服药风险' }).textContent).toContain('准备实付150便士、1行动、12灵性与8精神');
    const work = screen.getByRole('button', { name: '做本周原职业工作' });
    expect(document.getElementById(work.getAttribute('aria-describedby')!)?.textContent).toContain('180便士');
    const clinic = screen.getByRole('button', { name: '付费普通处置真实重伤' });
    expect((clinic as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById(clinic.getAttribute('aria-describedby')!.split(' ')[0]!)?.textContent).toContain('之后仍须实际休养');
    expect(document.getElementById(clinic.getAttribute('aria-describedby')!.split(' ')[1]!)?.textContent).toContain('没有尚未处置的重伤');
    expect((screen.getByRole('button', { name: '独立确认当前风险并饮用同一瓶' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders all 17 supplied inherited masteries including eight zeros and readonly history', async () => {
    const current = value(); render(<DoorPanel value={current} busy={false} onCommand={vi.fn()} />);
    await userEvent.click(screen.getByText('能力与掌握', { selector: 'summary' }));
    expect(current.abilities).toHaveLength(17);
    expect(current.abilities.filter(ability => ability.mastery === 0)).toHaveLength(8);
    for (const ability of current.abilities) {
      expect(screen.getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    await userEvent.click(screen.getByText('过往经历与个人账目', { selector: 'summary' }));
    const history = screen.getByRole('region', { name: '原人原物的已知去向' });
    expect(history.textContent).toContain('旧罗温已经死亡');
    expect(history.textContent).toContain('原杆仍归他所有，三枚原印记已经耗尽');
    expect(screen.getByRole('region', { name: '实际工资、生活与旧债' }).textContent).toContain('每周3行动，生活费30便士');
    expect(within(history).queryAllByRole('button')).toHaveLength(0);
  });

  it('renders only public fields rather than unexpected raw runtime properties', () => {
    const current = Object.assign(value(), { source: { seed: 'secret-seed', cursor: 999 },
      sourceDigest: 'private-digest', internalLabel: '原创G218' });
    const view = render(<DoorPanel value={current} busy={false} onCommand={vi.fn()} />);
    expect(view.container.textContent).not.toMatch(/原创|G218|seed|cursor|source|digest|fixture/i);
    expect(view.container.innerHTML).not.toContain('door-compound-1');
  });

  it('keeps ordinary stop and return visible at zero cash and zero actions', () => {
    const current = value(); current.resources.cash = '0便士'; current.resources.actionsRemaining = 0;
    render(<DoorPanel value={current} busy={false} onCommand={vi.fn()} />);
    const exits = screen.getByRole('region', { name: '暂停与安全返回' });
    for (const name of ['修整账房门槛并交付原账箱：停止当前作业', '本人沿普通路返回街区接待处']) {
      expect((within(exits).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('allows cancelling the risk review and restores its trigger without submitting', async () => {
    const command = vi.fn(); render(<DoorPanel value={value(true)} busy={false} onCommand={command} />);
    const trigger = screen.getByRole('button', { name: '独立确认当前风险并饮用同一瓶' });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '门服药确认' });
    expect(dialog.textContent).toContain('70%');
    expect(dialog.textContent).toContain('严重失败可能死亡');
    expect(dialog.textContent).toContain('载体仅有三件');
    expect(dialog.textContent).toContain('尚有两件未使用');
    expect(dialog.textContent).toContain('准备实付150便士');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(command).not.toHaveBeenCalled();
  });

  it('requires explicit risk confirmation and submits the original command only once', async () => {
    const command = vi.fn(); render(<DoorPanel value={value(true)} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '独立确认当前风险并饮用同一瓶' }));
    expect(command).not.toHaveBeenCalled();
    const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(command).toHaveBeenCalledTimes(1);
    expect(command).toHaveBeenCalledWith({ type: 'DOOR', command: {
      type: 'CONSUME', compoundId: 'door-compound-1', confirmed: true,
    } });
  });

  it('invalidates an open confirmation when the resource maximum or injury treatment changes', async () => {
    const current = value(true), command = vi.fn();
    const view = render(<DoorPanel value={current} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '独立确认当前风险并饮用同一瓶' }));
    const changed = { ...current, resources: { ...current.resources, maxSpirituality: 150 } };
    view.rerender(<DoorPanel value={changed} busy={false} onCommand={command} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: '独立确认当前风险并饮用同一瓶' }));
    view.rerender(<DoorPanel value={{ ...changed, injuries: changed.injuries.map(injury => ({ ...injury, treated: true })) }}
      busy={false} onCommand={command} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(command).not.toHaveBeenCalled();
  });

  it('retains saved resources and the submit latch across failure and a same-intent parent retry', async () => {
    const current = value(), command = vi.fn();
    const view = render(<DoorPanel value={current} committedRevision={1131} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '做本周原职业工作' }));
    expect(view.container.textContent).toContain('现金 3900便士 · 本周行动 3/3');
    view.rerender(<DoorPanel value={current} committedRevision={1131} busy={false} error="保存失败" onCommand={command} />);
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    fireEvent.click(screen.getByRole('button', { name: '做本周原职业工作' }));
    view.rerender(<DoorPanel value={current} committedRevision={1131} busy onCommand={command} />);
    expect(view.container.textContent).toContain('现金 3900便士 · 本周行动 3/3');
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    // The parent supplies this committed public snapshot; this mock does not prove a database save.
    const saved: DoorProjection = { ...current,
      resources: { ...current.resources, cash: '4080便士', actionsRemaining: 2 },
      actions: current.actions.map(action => action.command.type === 'WORK'
        ? { ...action, enabled: false, reason: '本周原职业工资已经结算。' } : action),
    };
    view.rerender(<DoorPanel value={saved} committedRevision={1132} busy={false} onCommand={command} />);
    await waitFor(() => expect((screen.getByRole('button', { name: '本人沿普通路返回街区接待处' }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole('button', { name: '做本周原职业工作' }) as HTMLButtonElement).disabled).toBe(true);
    expect(view.container.textContent).toContain('现金 4080便士 · 本周行动 2/3');
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('releases a saved non-resource action on its committed revision even when visible facts match', async () => {
    const current = value(), command = vi.fn();
    const view = render(<DoorPanel value={current} committedRevision={1131} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '本人沿普通路返回街区接待处' }));
    view.rerender(<DoorPanel value={current} committedRevision={1132} busy={false} onCommand={command} />);
    await waitFor(() => expect((screen.getByRole('button', { name: '本人沿普通路返回街区接待处' }) as HTMLButtonElement).disabled).toBe(false));
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('immediately shows committed promotion and reopened resources without filling the new maximum', async () => {
    const current = value(true), command = vi.fn();
    const view = render(<DoorPanel value={current} busy={false} onCommand={command} />);
    await userEvent.click(screen.getByRole('button', { name: '独立确认当前风险并饮用同一瓶' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认服用这一份魔药' }));
    const promoted: DoorProjection = { ...current, title: '序列0 门', promoted: true,
      story: '同一本人完成晋升；原伤势与旧掌握保留，两项新技巧尚未实际应用。',
      resources: { ...current.resources, mind: 78, spirituality: 78, maxSpirituality: 150, actionsRemaining: 1 },
      abilities: [...current.abilities,
        { id: 'door.s0.bounded-conceptual-escape', label: '有限概念化脱身', mastery: 0, description: '只对本人尚未落定的一次冲击尝试三秒窗口。' },
        { id: 'door.s0.single-exit-seal', label: '单出口短封', mastery: 0, description: '尝试封住当前亲见的一个出口二十秒。' }],
      actions: current.actions.filter(action => action.command.type !== 'CONSUME'),
      nextStep: '前往起重棚事故现场；新技巧仍须实际应用。',
      sections: current.sections.filter(section => section.id !== 'promotion-stability').map(section => section.id === 'materials'
        ? { ...section, lines: ['同三份原特性与同一门唯一性已由本人融合；本瓶载体与准备已经耗尽，尚有两件未使用。'] }
        : section),
    };
    view.rerender(<DoorPanel value={promoted} busy={false} onCommand={command} />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { name: '序列0 门', level: 2 })).toBeTruthy();
    expect(view.container.textContent).toContain('灵性 78/150');
    view.unmount();
    const reopened = render(<DoorPanel value={promoted} busy={false} onCommand={command} />);
    expect(reopened.container.textContent).toContain('灵性 78/150');
    await userEvent.click(screen.getByText('能力与掌握', { selector: 'summary' }));
    for (const ability of promoted.abilities) {
      expect(screen.getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    expect(command).toHaveBeenCalledTimes(1);
  });

  it('renders the actual saved check probability, roll and modifier values', () => {
    const check: PublicCheckResult = { ability: 'will', baseAbility: 28, effectiveAbility: 68,
      difficulty: 58, chance: 70, roll: 72, tier: 'FAILURE',
      modifiers: [{ source: '本瓶实际准备', value: 40 }] };
    render(<DoorPanel value={value()} busy={false} lastCheck={check} onCommand={vi.fn()} />);
    const result = screen.getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).toContain('本次成功率 70%，实际掷骰 72');
    expect(result.textContent).toContain('本瓶实际准备 +40');
  });

  it('locks every action for death or a parent blocker and keeps treatment distinct from healing', () => {
    const current = value(); current.resources.health = 0; current.injuries[0]!.treated = true;
    const command = vi.fn(), close = vi.fn();
    const view = render(<DoorPanel value={current} busy={false} onCommand={command} onClose={close} />);
    expect(screen.getByRole('region', { name: '当前伤势' }).textContent).toContain('轻伤 · 已处理');
    expect(view.container.textContent).toContain('健康 0/100');
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    view.rerender(<DoorPanel value={value()} busy={false} blocked onCommand={command} onClose={close} />);
    for (const button of screen.getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '做本周原职业工作' }));
    expect(command).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled();
  });
});
