/* @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { BloodDukePanel, type BloodDukePanelProps } from '../../src/renderer/BloodDukePanel.js';
import { projectBloodDuke } from '../../src/domain/blood-duke/index.js';
import { BLOOD_DUKE_CASE_IDS, type BloodDukeActivityCommand } from '../../src/domain/blood-duke/life.js';
import { BLOOD_DUKE_PREPARATION_IDS, type BloodDukeProjection } from '../../src/domain/blood-duke/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { bd, directedInitial3, originalBlathererDead, originalBlathererPrefix, prepared, promoted, taught } from '../domain/blood-duke-directed-helper.js';

afterEach(cleanup);
// The S3 view replays the actual 583-command living prefix. S2 fixtures use only
// the explicitly declared pre-journal unit budgets in the shared directed helper.
beforeAll(() => { originalBlathererPrefix(); promoted(); }, 60_000);
const source = () => projectBloodDuke(originalBlathererPrefix());
function show(value: BloodDukeProjection = source(), extra: Partial<BloodDukePanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<BloodDukePanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
function openPrimary() {
  fireEvent.click(primary());
  return screen.getByRole('dialog', { name: '鲜血大公操作确认' });
}
const isDisabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const room = () => screen.getByRole('region', { name: '鲜血大公原场事务' });
const encounter = () => screen.getByRole('region', { name: '鲜血大公原房间冲突' });
function selfReady(): SliceState {
  let state = promoted();
  const caseId = 'door-restraint';
  for (const command of [
    { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ABILITY' },
    { type: 'WALK', caseId, to: 'A' }, { type: 'CONSENT_NORA', caseId }, { type: 'TAKE_CARD', caseId },
    { type: 'WALK', caseId, to: 'B' }, { type: 'READ_NOTE', caseId }, { type: 'WALK', caseId, to: 'A' },
    { type: 'NOTICE_IMPULSE', caseId },
  ] as const) state = bd(state, command);
  return state;
}
let closedCache: SliceState | undefined;
function closedLife(): SliceState {
  if (!closedCache) {
    let state = promoted();
    for (const caseId of BLOOD_DUKE_CASE_IDS) {
      const commands: BloodDukeActivityCommand[] = [
        { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
        { type: 'WALK', caseId, to: 'A' }, { type: 'CONSENT_NORA', caseId }, { type: 'TAKE_CARD', caseId },
        { type: 'WALK', caseId, to: 'B' }, { type: 'READ_NOTE', caseId }, { type: 'WALK', caseId, to: 'A' },
        { type: 'MANUAL_OPERATION', caseId },
        ...(caseId === 'withdrawn-rehearsal' ? [{ type: 'WITHDRAW_PERMISSION', caseId } as const] : []),
        { type: 'RETURN_CARD', caseId }, { type: 'WALK', caseId, to: 'START' }, { type: 'INSPECT', caseId },
        { type: 'LEAVE', caseId }, { type: 'REPORT', caseId },
      ];
      for (const command of commands) state = bd(state, command);
    }
    closedCache = bd(state, { type: 'REFLECT' });
  }
  return structuredClone(closedCache);
}

describe('BloodDuke panel: actual resources and independent potion choices', () => {
  it('shows the original living S3 resources, exact guidance cost, three real bottles and an S3 alternative', () => {
    const state = originalBlathererPrefix(), value = projectBloodDuke(state), view = show(value);
    expect(screen.getByRole('heading', { name: '鲜血大公·深渊序列2' })).toBeTruthy();
    const resources = screen.getByRole('region', { name: '鲜血大公当前资源' });
    expect(resources.textContent).toContain(`健康${state.health}/100 · 精神${state.mind}/100 · 灵性${state.spirituality}/120`);
    expect(resources.textContent).toContain(`${state.cash}便士 · 本周行动${state.actionsRemaining}`);
    expect(resources.textContent).toContain('原伤继续生效');
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(within(screen.getByRole('navigation', { name: '鲜血大公目标' })).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[0]!.source);
    expect(view.container.textContent).toContain('可选择继续停留呓语者');
    expect(view.container.textContent).not.toMatch(/候选|原创G|本作G|原文未核|编号推断|两位实际原灵/);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows the actual paid promotion result without refilling the current mind or inventing mastery', () => {
    const state = promoted(), value = projectBloodDuke(state), view = show(value);
    expect(state.mind).toBeLessThan(100);
    expect(screen.getByRole('region', { name: '鲜血大公当前资源' }).textContent).toContain(`精神${state.mind}/100`);
    expect(value.abilities).toHaveLength(16);
    expect(value.abilities.slice(-2).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(view.container.textContent).toContain('诺拉');
    expect(view.container.textContent).toContain('46岁');
    expect(view.container.textContent).toContain('罗安');
    expect(view.container.textContent).toContain('原卡');
    expect(view.container.textContent).toContain('原铃');
    expect(view.container.textContent).not.toMatch(/候选|原创G|本作G|原文未核|编号推断|两位实际原灵/);
  });

  it('keeps the selected independent bottle after a real labour receipt and never submits a goal change', () => {
    const state = taught(), value = projectBloodDuke(state), onCommand = vi.fn();
    const view = render(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    const bottle = value.bottles[1]!;
    fireEvent.click(screen.getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(bottle.title);
    expect(onCommand).not.toHaveBeenCalled();
    const after = projectBloodDuke(bd(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<BloodDukePanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title);
    expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('confirms the exact owned bottle, current success rate and paid preparation before consumption', () => {
    const state = prepared(), value = projectBloodDuke(state), view = show(value);
    const bottle = value.bottles.find(entry => entry.id === 'blood-duke-potion-1')!;
    const navigation = screen.getByRole('navigation', { name: '鲜血大公目标' });
    fireEvent.click(within(navigation).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(bottle.source);
    expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('140便士');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('继续停留呓语者');
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(view.onCommand).toHaveBeenCalledTimes(1);
    expect(view.onCommand).toHaveBeenCalledWith({ type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(state.bloodDuke.bottles[0]!.status).toBe('PLAYER');
  });

  it('allows choosing another actual owned bottle within the paid preparation and keeps its consumption primary', () => {
    let state = taught();
    for (const taskId of BLOOD_DUKE_PREPARATION_IDS) state = bd(state, { type: 'PREPARE_TASK', taskId });
    state = bd(state, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-1' });
    state = bd(state, { type: 'BUY_POTION', bottleId: 'blood-duke-potion-2' });
    state = bd(state, { type: 'PREPARE_PROMOTION' });
    const value = projectBloodDuke(state), view = show(value), bottle = value.bottles[1]!;
    expect(value.insideCase).toBe(true);
    const goal = screen.getByRole('button', { name: `${bottle.title} · ${bottle.status}` });
    expect(isDisabled(goal)).toBe(false); fireEvent.click(goal);
    expect(primary().textContent).toContain('独立确认服用第2瓶');
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(bottle.source);
    fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一药瓶' }));
    expect(view.onCommand).toHaveBeenCalledTimes(1);
    expect(view.onCommand).toHaveBeenCalledWith({ type: 'CONSUME', bottleId: 'blood-duke-potion-2', confirmed: true });
    expect(state.bloodDuke.bottles.slice(0, 2).map(entry => entry.status)).toEqual(['PLAYER', 'PLAYER']);
  });
});

describe('BloodDuke panel: confirmations, pending saves and interruption', () => {
  it('focuses confirmation, traps keyboard navigation and restores the action after cancellation', () => {
    const view = show(), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取鲜血大公成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '确认执行这一次操作' }));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.keyDown(openPrimary(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('blocks background goals and ordinary close while reviewing a confirmation', () => {
    const onClose = vi.fn(), view = show(source(), { onClose });
    openPrimary();
    for (const button of within(screen.getByRole('navigation', { name: '鲜血大公目标' })).getAllByRole('button')) expect(isDisabled(button)).toBe(true);
    const close = screen.getByRole('button', { name: '返回普通生活' });
    expect(isDisabled(close)).toBe(true); fireEvent.click(close);
    expect(onClose).not.toHaveBeenCalled();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('submits one intention and remains locked while the same public facts await a receipt', () => {
    const value = source(), onCommand = vi.fn(), view = render(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), confirm = within(dialog).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledWith({ type: 'LEARN_GUIDANCE' });
    view.rerender(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    expect(isDisabled(primary())).toBe(true);
    expect(isDisabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('closes an unsubmitted confirmation on a save error without dispatching or providing a second retry', () => {
    const value = source(), onCommand = vi.fn(), view = render(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<BloodDukePanel value={value} busy={false} error="写入失败" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(isDisabled(primary())).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps the submitted intention locked through an error until the actual changed receipt arrives', () => {
    const state = directedInitial3(), value = projectBloodDuke(state), onCommand = vi.fn();
    const view = render(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(within(openPrimary()).getByRole('button', { name: '确认执行这一次操作' }));
    view.rerender(<BloodDukePanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    expect(isDisabled(primary())).toBe(true);
    const after = projectBloodDuke(bd(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<BloodDukePanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(isDisabled(primary())).toBe(false);
    expect(screen.getByRole('region', { name: '鲜血大公当前资源' }).textContent).toContain(`${state.cash - 500}便士`);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates an old unsubmitted confirmation when newer actual saved facts arrive', () => {
    const state = directedInitial3(), value = projectBloodDuke(state), onCommand = vi.fn();
    const view = render(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<BloodDukePanel value={projectBloodDuke(bd(state, { type: 'LEARN_GUIDANCE' }))} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it.each(['busy', 'blocked', 'dead'] as const)('blocks every public button when %s', mode => {
    const value = mode === 'dead' ? projectBloodDuke(originalBlathererDead()) : source();
    const onClose = vi.fn(), view = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', onClose });
    for (const button of screen.getAllByRole('button')) expect(isDisabled(button)).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(view.onCommand).not.toHaveBeenCalled();
    if (mode === 'dead') expect(view.container.textContent).toContain('本周目已经死亡');
  });

  it('closes the page without submitting movement, item return, healing or a sequence change', () => {
    const onClose = vi.fn(), view = show(source(), { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

describe('BloodDuke panel: actual original room, finite operations and goals', () => {
  it('separates the primary operation from an actual ordinary fallback', () => {
    const state = bd(promoted(), { type: 'OBSERVE', caseId: 'door-restraint' }), value = projectBloodDuke(state), view = show(value);
    expect(within(screen.getByRole('region', { name: '当前主要操作' })).getAllByRole('button')).toHaveLength(1);
    expect(primary().textContent).toContain('能力方法');
    const summary = screen.getByText('其他操作、普通替代与退出'), details = summary.closest('details')!;
    expect(details.open).toBe(false); fireEvent.click(summary);
    const ordinary = value.actions.find(action => action.command.type === 'PREPARE' && action.command.method === 'ORDINARY')!;
    fireEvent.click(within(details).getByRole('button', { name: `${ordinary.label}${ordinary.cost}` }));
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认执行这一次操作' }));
    expect(view.onCommand).toHaveBeenCalledWith({ type: 'PREPARE', caseId: 'door-restraint', method: 'ORDINARY' });
  });

  it('selects a different case or optional encounter without inventing progression', () => {
    const value = projectBloodDuke(promoted()), view = show(value), second = value.life.cases[1]!;
    fireEvent.click(screen.getByRole('button', { name: `${second.title} · 尚未接触` }));
    expect(within(room()).getByRole('heading', { name: second.title })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '当前主要操作' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '可选原房间交战' }));
    expect(encounter().textContent).toContain('加雷斯');
    expect(encounter().textContent).toContain('本人在原门口，诺拉在四米处');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows exact finite-operation cost before submitting and the actual paid attempt afterward', () => {
    const state = selfReady(), value = projectBloodDuke(state), onCommand = vi.fn(), before = structuredClone(state);
    const view = render(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    expect(primary().textContent).toContain('1行动 · 6灵性 · 成功2精神／失败4精神 · 知识20');
    const dialog = openPrimary();
    expect(dialog.textContent).toContain('1行动 · 6灵性 · 成功2精神／失败4精神 · 知识20');
    fireEvent.click(within(dialog).getByRole('button', { name: '确认执行这一次操作' }));
    expect(onCommand).toHaveBeenCalledWith({ type: 'SELF_RESTRAINT', caseId: 'door-restraint' });
    expect(state).toEqual(before);
    const after = bd(state, { type: 'SELF_RESTRAINT', caseId: 'door-restraint' }), attempt = after.bloodDuke.life.cases['door-restraint'].attempts.at(-1)!;
    view.rerender(<BloodDukePanel value={projectBloodDuke(after)} busy={false} onCommand={onCommand} />);
    const actual = screen.getByRole('region', { name: '鲜血大公本次实际尝试' });
    expect(actual.textContent).toContain(`本次实际消耗${attempt.spiritualitySpent}灵性、${attempt.mindSpent}精神、0便士`);
    expect(actual.textContent).toContain(`已移动${attempt.playerTravelMetres}米，实际经过${attempt.elapsedSeconds}秒`);
    expect(actual.textContent).toContain('自制：成功');
    expect(actual.textContent).toContain('原卡已借持，尚未归还');
    expect(room().textContent).toContain('自己的有限约束还剩8秒');
    expect(screen.getByRole('region', { name: '鲜血大公当前资源' }).textContent).toContain(`灵性${state.spirituality - 6}/120`);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    for (const button of within(screen.getByRole('navigation', { name: '鲜血大公目标' })).getAllByRole('button')) expect(isDisabled(button)).toBe(true);
  });

  it('displays actual withdrawn consent without raw enum text or refunding the finite attempt', () => {
    let state = bd(selfReady(), { type: 'SELF_RESTRAINT', caseId: 'door-restraint' });
    state = bd(state, { type: 'WITHDRAW_PERMISSION', caseId: 'door-restraint' });
    const value = projectBloodDuke(state), view = show(value), actual = screen.getByRole('region', { name: '鲜血大公本次实际尝试' });
    expect(actual.textContent).toContain('已撤回同意');
    expect(actual.textContent).not.toContain('WITHDRAWN');
    expect(actual.textContent).toContain('实际消耗6灵性、2精神');
    expect(state.bloodDuke.life.operation.restraintUntil! - state.blatherer.life.clockSeconds).toBe(7);
    expect(room().textContent).toContain('自己的有限约束还剩7秒');
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('shows actual original-player and Nora locations, sword and enemy resources before and after approach', () => {
    const closed = closedLife(), value = projectBloodDuke(closed), onCommand = vi.fn();
    const view = render(<BloodDukePanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(screen.getByRole('button', { name: '可选原房间交战' }));
    expect(encounter().textContent).toContain('本人在原门口，诺拉在四米处');
    expect(encounter().textContent).toContain('健康100 · 精神100 · 灵性120');
    expect(encounter().textContent).toContain('原剑仍由本人持有');
    const ready = bd(bd(closed, { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' });
    view.rerender(<BloodDukePanel value={projectBloodDuke(ready)} busy={false} onCommand={onCommand} />);
    expect(projectBloodDuke(ready).encounter.scene?.courtId).toBe('BL3-QUIET-ROOM');
    expect(encounter().textContent).toContain('原安静室');
    expect(encounter().textContent).not.toContain('BL3-QUIET-ROOM');
    expect(encounter().textContent).toContain('本人在四米处，诺拉在室外');
    expect(encounter().textContent).toContain(`累计实际步行${closed.blatherer.life.playerTravelMetres + 4}米`);
    expect(encounter().textContent).toContain(`原室时钟${closed.blatherer.life.clockSeconds + 12}秒`);
    expect(screen.getByRole('region', { name: '鲜血大公当前资源' }).textContent).toContain(`精神${closed.mind - 2}/100`);
    expect(view.container.textContent).not.toMatch(/原庭院|候选|原创G|本作G|原文未核|编号推断/);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  }, 60_000);
});
