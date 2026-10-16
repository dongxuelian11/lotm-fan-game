/* @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MercurySnakePanel, type MercurySnakePanelProps } from '../../src/renderer/MercurySnakePanel.js';
import { projectMercurySnake } from '../../src/domain/mercury-snake/index.js';
import { MERCURY_SNAKE_PREPARATION_IDS, type MercurySnakeProjection, type MercurySnakeCommand } from '../../src/domain/mercury-snake/types.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { MERCURY_SNAKE_CASE_IDS, type MercurySnakeCaseId } from '../../src/domain/mercury-snake/life.js';
import { playerText } from '../../src/shared/player-text.js';
import { directedInitial2, dose, ms, oldWheelRoots, originalFateProphet, prepared, promoted, promotedForLife, promotedDigested, taught } from '../domain/mercury-snake-directed-helper.js';

afterEach(cleanup);
// The real projector and current-schema helper retain the complete 703-command
// source. Initial migration/replay has an explicit two-minute cold-cache budget.
// Directed budgets are UNIT fixtures, never natural-play completion evidence.
beforeAll(() => { originalFateProphet(); promoted(); }, 120_000);
function show(value: MercurySnakeProjection = projectMercurySnake(originalFateProphet()), extra: Partial<MercurySnakePanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<MercurySnakePanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const targets = () => screen.getByRole('navigation', { name: '水银之蛇目标' });
const resources = () => screen.getByRole('region', { name: '水银之蛇当前资源' });
const room = () => screen.getByRole('region', { name: '水银之蛇原场事务' });
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '水银之蛇操作确认' }); }
const confirm = (dialog = screen.getByRole('dialog')) => within(dialog).getByRole('button', { name: '确认执行这一次操作' });
const editorial = /候选|原创G|本作G|原文未核|编号推断|CW3-|MS1-|\bSTART\b|\bGUIDE\b|mercury-snake-potion-/;
function buttonFor(value: MercurySnakeProjection, type: MercurySnakeCommand['type']) {
  const action = value.actions.find(action => action.command.type === type);
  if (!action) throw new Error(`No public ${type} action in this saved projection.`);
  const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes(playerText(action.label)));
  if (!button) throw new Error(`No displayed ${type} button.`);
  const details = button.closest('details');
  if (details && !details.open) fireEvent.click(details.querySelector('summary')!);
  return button;
}

describe('Mercury Snake panel: actual source and independent acquisition', () => {
  it('shows the living injured original body, one luck ledger and three independent bottles', () => {
    const state = originalFateProphet(), roots = oldWheelRoots(state), view = show(projectMercurySnake(state));
    expect(screen.getByRole('heading', { name: '水银之蛇·命运之轮序列1' })).toBeTruthy();
    expect(resources().textContent).toContain('健康90/100 · 精神95/100 · 灵性119/120');
    expect(resources().textContent).toContain('1060便士 · 本周行动2');
    expect(resources().textContent).toContain('原伤势1处');
    expect(resources().textContent).toContain('当前唯一幸运储备0/3 · 累计储存14 · 已实际花费14');
    expect(primary().textContent).toContain('500便士');
    expect(disabled(primary())).toBe(false);
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(view.container.textContent).toContain('可选择继续停留先知');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled(); expect(oldWheelRoots(state)).toEqual(roots);
  }, 30_000);

  it('shows actual unaffordable purchase reasons and does not spend on a disabled button', () => {
    const state = ms(originalFateProphet(), { type: 'LEARN_GUIDANCE' }), value = projectMercurySnake(state), view = show(value);
    const action = value.actions.find(a => a.command.type === 'BUY_POTION' && 'bottleId' in a.command && a.command.bottleId === value.bottles[0]!.id)!;
    expect(action.enabled).toBe(false);
    const button = buttonFor(value, 'BUY_POTION');
    expect(disabled(button)).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(`mercury-snake-reason-${action.id}`);
    expect(document.getElementById(`mercury-snake-reason-${action.id}`)?.textContent).toBe(playerText(action.reason!));
    expect(resources().textContent).toContain('560便士');
    fireEvent.click(button); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('keeps the selected second bottle after its real independent labour receipt', () => {
    const state = taught(), value = projectMercurySnake(state), onCommand = vi.fn(), view = show(value, { onCommand });
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectMercurySnake(ms(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<MercurySnakePanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title); expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('confirms the selected owned bottle once, showing success and failure costs', () => {
    let state = taught();
    for (const taskId of MERCURY_SNAKE_PREPARATION_IDS) state = ms(state, { type: 'PREPARE_TASK', taskId });
    state = ms(state, { type: 'BUY_POTION', bottleId: 'mercury-snake-potion-1' });
    state = ms(state, { type: 'BUY_POTION', bottleId: 'mercury-snake-potion-2' });
    state = ms(state, { type: 'PREPARE_PROMOTION' });
    const before = structuredClone(state), value = projectMercurySnake(state), bottle = value.bottles[1]!, view = show(value);
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(playerText(bottle.source));
    expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('失败保留已付代价');
    const button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(state).toEqual(before);
  }, 30_000);

  it('renders the real failed potion receipt without replacing the exhausted bottle or restoring luck', () => {
    const before = prepared('FAILURE'), state = ms(before, dose), roots = oldWheelRoots(before), value = projectMercurySnake(state), view = show(value);
    expect(value.promoted).toBe(false); expect(value.bottles[0]!.status).toContain('原瓶已耗尽');
    expect(state.mercurySnake.bottles[0]!.status).toBe('CONSUMED');
    expect(value.luck).toMatchObject({ stored: 0, accumulated: 14, spent: 14 });
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(resources().textContent).toContain(`${state.cash}便士`);
    expect(state.mind).toBeLessThan(before.mind);
    expect(state.mercurySnake.bottles.filter(bottle => bottle.status === 'CONSUMED')).toHaveLength(1);
    expect(oldWheelRoots(state)).toEqual(roots); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('preserves all 17 inherited masteries and both new zero masteries after promotion', () => {
    const state = promoted(), value = projectMercurySnake(state), roots = oldWheelRoots(state), view = show(value);
    expect(value.abilities).toHaveLength(19);
    expect(value.abilities.slice(-2).map(a => [a.id, a.mastery])).toEqual([['wheel.s1.local-restart', 0], ['wheel.s1.moment-anchor', 0]]);
    for (const [id, mastery] of Object.entries(originalFateProphet().progression.mastery)) expect(value.abilities.find(a => a.id === id)?.mastery).toBe(mastery);
    expect(room().textContent).toContain('薇拉·霍尔 · 39岁');
    expect(room().textContent).toContain('原导师');
    expect(room().textContent).not.toMatch(/埃尔莎|原衣物|原托盘|能量100/);
    expect(view.container.textContent).not.toMatch(editorial); expect(oldWheelRoots(state)).toEqual(roots);
  }, 30_000);

  it('keeps the custom player name exact while adapting authored prose', () => {
    // Display-only fixture; no new history, command, body or roll is fabricated.
    const state = originalFateProphet(); state.character.name = '原创G候选艾洛';
    const value = projectMercurySnake(state), before = structuredClone(value), view = show(value);
    expect(view.container.textContent).toContain(state.character.name); expect(value).toEqual(before);
  }, 30_000);
});

describe('Mercury Snake panel: confirmation and save retry safety', () => {
  it('traps focus, disables background choices and returns focus on cancellation', () => {
    const onClose = vi.fn(), view = show(undefined, { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(dialog.querySelector('h3'));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    for (const target of within(targets()).getAllByRole('button')) expect(disabled(target)).toBe(true);
    const close = screen.getByRole('button', { name: '返回普通生活' });
    expect(disabled(close)).toBe(true); fireEvent.click(close);
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button); expect(onClose).not.toHaveBeenCalled(); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('holds one submitted intent until changed saved facts arrive', () => {
    const state = directedInitial2(), value = projectMercurySnake(state), onCommand = vi.fn(), view = show(value, { onCommand });
    const dialog = openPrimary(), button = confirm(dialog); fireEvent.click(button); fireEvent.click(button);
    view.rerender(<MercurySnakePanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBe(dialog);
    const after = projectMercurySnake(ms(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<MercurySnakePanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.queryByRole('status')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  }, 30_000);

  it('keeps last saved facts locked on failure and accepts the one externally retried save receipt', () => {
    const state = directedInitial2(), before = structuredClone(state), value = projectMercurySnake(state), onCommand = vi.fn(), view = show(value, { onCommand });
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<MercurySnakePanel value={value} busy={false} error="保存暂时失败" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(resources().textContent).toContain(`${state.cash}便士`); expect(state).toEqual(before);
    // The shell owns retryLast: it retries the same persistence operation, while
    // the panel must never emit a second domain command against stale facts.
    view.rerender(<MercurySnakePanel value={value} busy={true} error={null} onCommand={onCommand} />);
    const command = onCommand.mock.calls[0]![0] as MercurySnakeCommand;
    const saved = ms(state, command), after = projectMercurySnake(saved);
    view.rerender(<MercurySnakePanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.queryByRole('status')).toBeNull();
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
    expect(saved.mercurySnake.acquisitionJournal.filter(entry => entry.command.type === 'LEARN_GUIDANCE')).toHaveLength(1);
    expect(resources().textContent).toContain(`${saved.cash}便士`);
  }, 30_000);

  it('invalidates a confirmation after a different actual saved state arrives', () => {
    const state = prepared(), value = projectMercurySnake(state), onCommand = vi.fn(), view = show(value, { onCommand });
    openPrimary(); view.rerender(<MercurySnakePanel value={projectMercurySnake(ms(state, dose))} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('blocks every button while busy or externally locked and closes outside scenes without a domain command', () => {
    for (const mode of ['busy', 'blocked'] as const) {
      const view = show(undefined, { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn() });
      for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
      expect(view.onCommand).not.toHaveBeenCalled(); view.unmount();
    }
    const onClose = vi.fn(), view = show(undefined, { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledOnce(); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});

function openLifeCase(state: SliceState, caseId: MercurySnakeCaseId, method: 'ABILITY' | 'ORDINARY'): SliceState {
  state = ms(state, { type: 'OBSERVE', caseId });
  state = ms(state, { type: 'CONSENT', caseId, permission: 'OWNER' });
  if (method === 'ABILITY') state = ms(state, { type: 'CONSENT', caseId, permission: 'ABILITY' });
  state = ms(state, { type: 'INVITE', caseId });
  state = ms(state, method === 'ABILITY' ? { type: 'PREPARE', caseId, method } : { type: 'START_ORDINARY', caseId });
  for (const type of ['WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A'] as const) state = ms(state, { type, caseId });
  if (method === 'ABILITY') for (const type of ['PLACE_PIECE', 'CAPTURE_MOMENT'] as const) state = ms(state, { type, caseId });
  return state;
}
function closeLifeCase(state: SliceState, caseId: MercurySnakeCaseId, report = true): SliceState {
  const hasPiece = state.mercurySnake.life.pieces.some(piece => piece.caseId === caseId);
  state = ms(state, { type: 'RETURN_OBJECT', caseId });
  if (hasPiece) state = ms(state, { type: 'TAKE_PIECE', caseId });
  state = ms(state, { type: 'RETURN_TO_ENTRY', caseId });
  if (hasPiece) state = ms(state, { type: 'RETURN_PIECE', caseId });
  state = ms(state, { type: 'LEAVE', caseId });
  return report ? ms(state, { type: 'REPORT', caseId }) : state;
}
function ordinaryCase(state: SliceState, caseId: MercurySnakeCaseId): SliceState {
  state = openLifeCase(state, caseId, 'ORDINARY');
  for (const type of ['RELEASE_CART', 'WALK_TO_B', 'PUSH_BACK'] as const) state = ms(state, { type, caseId });
  return closeLifeCase(state, caseId);
}
function interactive(initial: SliceState) {
  let state = initial;
  const onCommand = vi.fn(), view = show(projectMercurySnake(state), { onCommand, onClose: vi.fn() });
  return { view, onCommand, current: () => state, execute(command: MercurySnakeCommand) {
    const value = projectMercurySnake(state), action = value.actions.find(action => JSON.stringify(action.command) === JSON.stringify(command));
    if (!action) throw new Error(`No public action for ${JSON.stringify(command)}.`);
    expect(action.enabled, action.reason ?? JSON.stringify(command)).toBe(true);
    const button = Array.from(view.container.querySelectorAll('button')).find(button => button.textContent?.includes(playerText(action.label)));
    if (!button) throw new Error(`No displayed button for ${JSON.stringify(command)}.`);
    const details = button.closest('details');
    if (details && !details.open) fireEvent.click(details.querySelector('summary')!);
    expect(disabled(button)).toBe(false); fireEvent.click(button); fireEvent.click(confirm());
    expect(onCommand.mock.calls.at(-1)![0]).toEqual(command);
    state = ms(state, command);
    view.rerender(<MercurySnakePanel value={projectMercurySnake(state)} busy={false} onCommand={onCommand} onClose={() => {}} />);
    return state;
  } };
}

describe('Mercury Snake panel: same cart, original owners and finite returns', () => {
  it('keeps refusal and cancellation available at zero AP before any purchase', () => {
    const initial = promotedForLife('RESTART', { actions: 6 }), state = ms(initial, { type: 'OBSERVE', caseId: 'cart-return' });
    expect(state.actionsRemaining).toBe(0); expect(state.mercurySnake.life.pieces).toEqual([]);
    const flow = interactive(state);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(room().textContent).toContain('本案尚未购入连接片');
    expect(within(screen.getByRole('region', { name: '停止与普通退出' })).getAllByRole('button').length).toBeLessThanOrEqual(2);
    flow.execute({ type: 'WITHDRAW_CONSENT', caseId: 'cart-return', permission: 'ABILITY' });
    expect(room().textContent).toContain('已撤回同意');
    const after = flow.execute({ type: 'ABORT', caseId: 'cart-return' });
    expect(after.mercurySnake.life.cases['cart-return'].status).toBe('CANCELLED');
    expect(after.mercurySnake.life.pieces).toEqual([]);
    expect(after.mercurySnake.life.site.cart).toEqual(initial.mercurySnake.life.site.cart);
    expect(after.mercurySnake.life.site.parcel).toEqual(initial.mercurySnake.life.site.parcel);
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
  }, 30_000);

  it('offers a real unpurchased ordinary route without a supernatural success or fee', () => {
    const initial = promotedForLife(), before = initial.cash;
    let state = ms(initial, { type: 'OBSERVE', caseId: 'cart-return' });
    state = ms(state, { type: 'CONSENT', caseId: 'cart-return', permission: 'OWNER' });
    state = ms(state, { type: 'INVITE', caseId: 'cart-return' });
    const flow = interactive(state);
    flow.execute({ type: 'START_ORDINARY', caseId: 'cart-return' });
    for (const type of ['WALK_TO_A', 'WALK_TO_B', 'READ_ORIGINAL', 'RETURN_TO_A', 'RELEASE_CART', 'WALK_TO_B', 'PUSH_BACK'] as const) flow.execute({ type, caseId: 'cart-return' });
    expect(room().textContent).toContain('不计能力掌握');
    expect(flow.current().mercurySnake.life.pieces).toEqual([]);
    expect(flow.current().cash).toBe(before);
    expect(flow.current().mercurySnake.life.cases['cart-return'].attempts[0]!.appliedAbilityIds).toEqual([]);
  }, 30_000);

  it('displays current ownership and physically walked adults before recording only the original cart and parcel', () => {
    const initial = promotedForLife(), roots = oldWheelRoots(initial), state = openLifeCase(initial, 'cart-return', 'ABILITY'), value = projectMercurySnake(state), view = show(value);
    const original = initial.mercurySnake.life.site;
    expect(room().textContent).toContain('原导师实际走8米，薇拉实际走8米');
    expect(room().textContent).toContain('薇拉健康100 · 精神99');
    const objects = screen.getByRole('region', { name: '同一原车与封包的实际位置和所有权' });
    expect(objects.textContent).toContain('同一原车1辆，归原导师');
    expect(objects.textContent).toContain('400克，封口完整，归原导师');
    expect(objects.textContent).toContain('随车实际在四米处');
    const pouch = screen.getByRole('region', { name: '原袋原签与原转盘' });
    expect(pouch.textContent).toContain('归薇拉·霍尔所有'); expect(pouch.textContent).toContain('2枚在同一原袋内');
    expect(pouch.textContent).toContain('原指针仍指向甲区');
    expect(value.life.site.pouch).toEqual(original.pouch); expect(value.life.site.tags).toEqual(original.tags); expect(value.life.site.disc).toEqual(original.disc);
    expect(screen.getByRole('region', { name: '有限原物关系记录' }).textContent).toContain('没有记录可供恢复的健康、精神、灵性、日历、金钱或记忆');
    expect(value.life.site.clockSeconds).toBeGreaterThan(713); expect(oldWheelRoots(state)).toEqual(roots);
    expect(view.container.textContent).not.toMatch(editorial); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('returns only the same released cart and parcel at zero AP and leaves actual costs and clock intact', () => {
    let state = openLifeCase(promotedForLife('RESTART', { actions: 7 }), 'cart-return', 'ABILITY');
    state = ms(state, { type: 'RELEASE_CART', caseId: 'cart-return' });
    expect(state.actionsRemaining).toBe(0);
    const before = structuredClone(state), flow = interactive(state);
    expect(primary().textContent).toContain('局部重启');
    expect(room().textContent).toContain('随车实际在八米处');
    state = flow.execute({ type: 'LOCAL_RESTART', caseId: 'cart-return' });
    expect(state.mercurySnake.life.site.cart).toMatchObject({ id: before.mercurySnake.life.site.cart.id, owner: 'GUIDE', location: 'A', releases: before.mercurySnake.life.site.cart.releases });
    expect(state.mercurySnake.life.site.parcel).toEqual(before.mercurySnake.life.site.parcel);
    expect(state.mercurySnake.life.pieces[0]).toMatchObject({ charges: 0, wear: 1, returnUses: 1, anchorUses: 0 });
    expect(state.health).toBe(before.health); expect(state.injuries).toEqual(before.injuries); expect(state.cash).toBe(before.cash);
    expect(state.spirituality).toBe(before.spirituality - 8); expect(state.mind).toBe(before.mind - 2);
    expect(state.mercurySnake.life.site.clockSeconds).toBeGreaterThan(before.mercurySnake.life.site.clockSeconds);
    expect(room().textContent).toContain('实际施术1次，实际能力应用1项');
    expect(room().textContent).toContain('返回实际使用1/1');
    flow.execute({ type: 'WITHDRAW_CONSENT', caseId: 'cart-return', permission: 'ABILITY' });
    expect(flow.current().mercurySnake.life.cases['cart-return'].attempts[0]!.restartApplied).toBe(true);
    expect(flow.current().mercurySnake.life.site.cart.location).toBe('A');
    expect(room().textContent).toContain('已完成的真实返回不会撤销');
    for (const type of ['RETURN_OBJECT', 'TAKE_PIECE', 'RETURN_TO_ENTRY', 'RETURN_PIECE', 'LEAVE'] as const) flow.execute({ type, caseId: 'cart-return' });
    expect(flow.current().mercurySnake.life.pieces[0]!.location).toBe('RETURNED');
    expect(flow.current().mercurySnake.life.cases['cart-return'].attempts[0]!.closed).toBe(true);
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
  }, 30_000);

  it('shows a failed real restart, preserves its cost and offers ordinary push-back', () => {
    let state = openLifeCase(promotedForLife('RESTART_FAIL'), 'cart-return', 'ABILITY');
    state = ms(state, { type: 'RELEASE_CART', caseId: 'cart-return' });
    const before = structuredClone(state), flow = interactive(state);
    state = flow.execute({ type: 'LOCAL_RESTART', caseId: 'cart-return' });
    expect(state.mind).toBe(before.mind - 4); expect(state.spirituality).toBe(before.spirituality - 8);
    expect(state.mercurySnake.life.site.cart.location).toBe('B');
    expect(room().textContent).toContain('实际施术1次，实际能力应用0项');
    expect(state.mercurySnake.life.pieces[0]).toMatchObject({ charges: 1, wear: 0 });
    flow.execute({ type: 'WALK_TO_B', caseId: 'cart-return' });
    expect(primary().textContent).toContain('手推');
    state = flow.execute({ type: 'PUSH_BACK', caseId: 'cart-return' });
    expect(state.mercurySnake.life.cases['cart-return'].attempts[0]!.returnKind).toBe('ORDINARY');
    expect(room().textContent).toContain('不计能力掌握');
    expect(state.mind).toBe(before.mind - 4); expect(state.spirituality).toBe(before.spirituality - 8);
  }, 30_000);

  it('shows one paid twenty-second maintenance and a separately paid restart using two distinct charges', () => {
    const first = ordinaryCase(promotedForLife('ANCHOR'), 'cart-return');
    const state = openLifeCase(first, 'maintained-contact', 'ABILITY'), flow = interactive(state), before = structuredClone(state);
    flow.execute({ type: 'MOMENT_ANCHOR', caseId: 'maintained-contact' });
    const pending = screen.getByRole('region', { name: '片刻维系的实际二十秒窗口' });
    expect(pending.textContent).toContain('还剩20秒'); expect(pending.textContent).toContain('仍须另付8灵性2精神');
    expect(flow.current().mercurySnake.life.site.cart.location).toBe('A');
    expect(flow.current().mercurySnake.life.pieces.at(-1)).toMatchObject({ initialCharges: 2, charges: 2, anchorUses: 0, returnUses: 0 });
    expect(room().textContent).toContain('实际施术1次，实际能力应用0项');
    expect(primary().textContent).toContain('实际等待十秒');
    flow.execute({ type: 'WAIT_10', caseId: 'maintained-contact' });
    expect(screen.getByRole('region', { name: '片刻维系的实际二十秒窗口' }).textContent).toContain('还剩10秒');
    flow.execute({ type: 'RELEASE_CART', caseId: 'maintained-contact' });
    const after = flow.execute({ type: 'LOCAL_RESTART', caseId: 'maintained-contact' });
    expect(after.mercurySnake.life.site.cart.location).toBe('A');
    expect(after.mercurySnake.life.pieces.at(-1)).toMatchObject({ charges: 0, wear: 2, returnUses: 1, anchorUses: 1 });
    expect(after.spirituality).toBe(before.spirituality - 16); expect(after.mind).toBe(before.mind - 4); expect(after.cash).toBe(before.cash);
    expect(room().textContent).toContain('实际施术2次，实际能力应用2项');
    expect(room().textContent).toContain('维系实际使用1/1');
    expect(screen.queryByRole('region', { name: '片刻维系的实际二十秒窗口' })).toBeNull();
  }, 120_000); // Complete first case plus second-case replay across the immutable 703-command history.

  it('expires the real maintained relation after elapsed waits without a free return', () => {
    let state = openLifeCase(ordinaryCase(promotedForLife('ANCHOR'), 'cart-return'), 'maintained-contact', 'ABILITY');
    state = ms(state, { type: 'MOMENT_ANCHOR', caseId: 'maintained-contact' });
    const flow = interactive(state), before = structuredClone(state);
    flow.execute({ type: 'WAIT_10', caseId: 'maintained-contact' }); flow.execute({ type: 'WAIT_10', caseId: 'maintained-contact' });
    expect(screen.queryByRole('region', { name: '片刻维系的实际二十秒窗口' })).toBeNull();
    expect(room().textContent).toContain('已经到期');
    flow.execute({ type: 'RELEASE_CART', caseId: 'maintained-contact' });
    const after = flow.execute({ type: 'LOCAL_RESTART', caseId: 'maintained-contact' });
    expect(after.mercurySnake.life.site.cart.location).toBe('B');
    expect(after.mercurySnake.life.pieces.at(-1)).toMatchObject({ charges: 2, wear: 0 });
    expect(after.spirituality).toBe(before.spirituality - 8); expect(after.mind).toBe(before.mind - 4);
    expect(room().textContent).toContain('实际能力应用0项');
  }, 120_000); // Full prior-case replay plus genuine twenty-second expiry and failed paid attempt.

  it('never returns a removed parcel and shows the separate ordinary physical retrieval', () => {
    let state = openLifeCase(promotedForLife(), 'cart-return', 'ABILITY');
    for (const type of ['RELEASE_CART', 'WALK_TO_B', 'REMOVE_PARCEL', 'RETURN_TO_A'] as const) state = ms(state, { type, caseId: 'cart-return' });
    const before = structuredClone(state), flow = interactive(state);
    expect(screen.getByRole('region', { name: '同一原车与封包的实际位置和所有权' }).textContent).toContain('实际在八米处');
    state = flow.execute({ type: 'LOCAL_RESTART', caseId: 'cart-return' });
    expect(state.mercurySnake.life.site.cart.location).toBe('B'); expect(state.mercurySnake.life.site.parcel.location).toBe('B');
    expect(state.mind).toBe(before.mind - 4); expect(state.spirituality).toBe(before.spirituality - 8);
    flow.execute({ type: 'WALK_TO_B', caseId: 'cart-return' }); flow.execute({ type: 'PUSH_BACK', caseId: 'cart-return' });
    expect(flow.current().mercurySnake.life.site.cart.location).toBe('A'); expect(flow.current().mercurySnake.life.site.parcel.location).toBe('B');
    expect(room().textContent).not.toContain('随车实际在四米处');
    flow.execute({ type: 'WALK_TO_B', caseId: 'cart-return' }); state = flow.execute({ type: 'RETURN_PARCEL', caseId: 'cart-return' });
    expect(state.mercurySnake.life.site.parcel).toMatchObject({ id: before.mercurySnake.life.site.parcel.id, owner: 'GUIDE', quantity: 1, location: 'CW3-CART', massGrams: 400, sealed: true });
    expect(room().textContent).toContain('随车实际在四米处'); expect(room().textContent).toContain('不计能力掌握');
    expect(state.mercurySnake.life.pieces[0]!.charges).toBe(1);
  }, 30_000);

  it('invalidates withdrawn contact, preserves the paid cast and closes the third case ordinarily at zero AP', () => {
    let state = promotedForLife('ANCHOR', { actions: 11 });
    state = ordinaryCase(state, 'cart-return'); state = ordinaryCase(state, 'maintained-contact');
    state = openLifeCase(state, 'withdrawn-contact', 'ABILITY');
    expect(state.actionsRemaining).toBe(0);
    state = ms(state, { type: 'MOMENT_ANCHOR', caseId: 'withdrawn-contact' });
    const paid = { cash: state.cash, mind: state.mind, spirituality: state.spirituality }, flow = interactive(state);
    flow.execute({ type: 'WITHDRAW_CONSENT', caseId: 'withdrawn-contact', permission: 'ABILITY' });
    expect(room().textContent).toContain('本案许可已真实撤回');
    expect(screen.queryByRole('region', { name: '片刻维系的实际二十秒窗口' })).toBeNull();
    for (const type of ['RELEASE_CART', 'WALK_TO_B', 'PUSH_BACK', 'RETURN_OBJECT', 'TAKE_PIECE', 'RETURN_TO_ENTRY', 'RETURN_PIECE'] as const) flow.execute({ type, caseId: 'withdrawn-contact' });
    expect({ cash: flow.current().cash, mind: flow.current().mind, spirituality: flow.current().spirituality }).toEqual(paid);
    expect(flow.current().actionsRemaining).toBe(0);
    expect(flow.current().mercurySnake.life.pieces.at(-1)).toMatchObject({ charges: 1, wear: 0, returnUses: 0, anchorUses: 0, location: 'RETURNED' });
    state = flow.execute({ type: 'LEAVE', caseId: 'withdrawn-contact' });
    expect(state.mercurySnake.life.cases['withdrawn-contact'].attempts[0]!.closed).toBe(true);
    expect(state.mercurySnake.life.cases['withdrawn-contact'].attempts[0]!.appliedAbilityIds).toEqual([]);
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
  }, 120_000); // Two full ordinary reports, paid third-case cast, withdrawal and zero-AP physical closure.

  it('finishes all three real reports and reflection with no additional paid preparation or rest recommendation', () => {
    const state = promotedDigested(), roots = oldWheelRoots(state), value = projectMercurySnake(state), onClose = vi.fn(), view = show(value, { onClose });
    expect(state.progression.acting).toBe(100);
    expect(MERCURY_SNAKE_CASE_IDS.every(id => state.mercurySnake.life.cases[id].status === 'RESOLVED')).toBe(true);
    expect(state.mercurySnake.life.pieces.every(piece => piece.location === 'RETURNED')).toBe(true);
    expect(screen.queryByRole('region', { name: '当前主要操作' })).toBeNull();
    expect(view.container.textContent).toContain('三案已结束，可返回普通生活');
    expect(view.container.querySelector('.seer-next')?.textContent).not.toMatch(/休养|准备|购买/);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledOnce(); expect(view.onCommand).not.toHaveBeenCalled(); expect(oldWheelRoots(state)).toEqual(roots);
  }, 120_000); // All three complete new-stage life flows replay genuine source and finance.
});

describe('Mercury Snake panel: optional independent courtyard', () => {
  it('offers the new optional visit after closure, preserves original ownership and allows policy choice and ordinary departure', () => {
    const initial = promotedDigested(), roots = oldWheelRoots(initial), before = structuredClone(initial.mercurySnake.life.site), flow = interactive(initial);
    fireEvent.click(within(targets()).getByRole('button', { name: '可选小院交战' }));
    expect(primary().textContent).toContain('购买独立战斗辅助片');
    flow.execute({ type: 'PREPARE_ENCOUNTER' });
    flow.execute({ type: 'ENCOUNTER_TALK' });
    const yard = screen.getByRole('region', { name: '水银之蛇独立小院冲突' });
    expect(yard.textContent).toContain('奥斯温·贝尔 · 44岁');
    expect(yard.textContent).toContain('健康100 · 精神100 · 灵性120');
    expect(yard.textContent).toContain('本人在独立小院，薇拉在室外，原导师在室外');
    expect(yard.textContent).toContain('剩余3/3份用量');
    expect(yard.textContent).toContain('对手原刻片剩余3/3枚');
    expect(yard.textContent).toContain('MENTAL75'); expect(yard.textContent).toContain('BODY25');
    expect(yard.textContent).toContain('片刻维系仅维持一次真实位置关系20秒，本身不减少冲量');
    expect(yard.textContent).toContain('两者合用最多减少30');
    expect(yard.textContent).toContain('实际局部重启0次，片刻维系实际辅助0次');
    const site = flow.current().mercurySnake.encounter.currentSite!;
    expect(site.cart).toEqual(before.cart); expect(site.parcel).toEqual(before.parcel); expect(site.pouch).toEqual(before.pouch); expect(site.tags).toEqual(before.tags);
    expect(site.playerTravelMetres).toBe(before.playerTravelMetres + 4);
    expect(site.guideTravelMetres).toBe(before.guideTravelMetres + 8);
    expect(site.clockSeconds).toBe(before.clockSeconds + 20);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    flow.execute({ type: 'SET_COMBAT_POLICY', policy: 'ANCHOR' });
    expect(flow.current().mercurySnake.encounter.policy).toBe('ANCHOR');
    const action = projectMercurySnake(flow.current()).actions.find(action => action.command.type === 'LEAVE_ENCOUNTER')!;
    expect(action.enabled).toBe(true);
    const exit = within(screen.getByRole('region', { name: '停止与普通退出' })).getByRole('button', { name: name => name.includes(action.label) });
    expect(disabled(exit)).toBe(false);
    const paid = flow.current().cash, after = flow.execute({ type: 'LEAVE_ENCOUNTER' });
    expect(after.mercurySnake.encounter.currentSite!.playerLocation).toBe('START');
    expect(after.mercurySnake.encounter.currentSite!.playerTravelMetres).toBe(site.playerTravelMetres + 4);
    expect(after.mercurySnake.encounter.currentSite!.clockSeconds).toBe(site.clockSeconds + 4);
    expect(after.cash).toBe(paid); expect(oldWheelRoots(after)).toEqual(roots);
    expect(screen.queryByRole('region', { name: '当前主要操作' })).toBeNull();
    expect(flow.view.container.textContent).toContain('旁院经历已经结束');
    expect(after.fateProphet.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 83 });
    expect(flow.view.container.textContent).not.toMatch(editorial);
  }, 120_000); // Three full real life flows, reflection, optional preparation and actual adult departures.
});

describe('Mercury Snake panel: visibility and range remain real conditions', () => {
  for (const condition of ['OCCLUDE', 'STEP_BACK'] as const) it(`keeps the paid ${condition} failure distinct from a successful return`, () => {
    let state = openLifeCase(promotedForLife(), 'cart-return', 'ABILITY');
    state = ms(state, { type: 'RELEASE_CART', caseId: 'cart-return' });
    const flow = interactive(state);
    flow.execute({ type: condition, caseId: 'cart-return' });
    const before = structuredClone(flow.current());
    state = flow.execute({ type: 'LOCAL_RESTART', caseId: 'cart-return' });
    expect(state.mercurySnake.life.site.cart.location).toBe('B');
    expect(state.mercurySnake.life.pieces[0]).toMatchObject({ charges: 1, wear: 0 });
    expect(state.mind).toBe(before.mind - 4); expect(state.spirituality).toBe(before.spirituality - 8);
    expect(room().textContent).toContain('实际能力应用0项');
    if (condition === 'OCCLUDE') {
      expect(room().textContent).toContain('视线已遮挡');
      expect(primary().textContent).toContain('恢复普通视线');
      flow.execute({ type: 'RESTORE_VIEW', caseId: 'cart-return' });
    } else {
      expect(room().textContent).toContain('本人实际在原门口');
      flow.execute({ type: 'WALK_TO_A', caseId: 'cart-return' });
    }
    flow.execute({ type: 'WALK_TO_B', caseId: 'cart-return' });
    state = flow.execute({ type: 'PUSH_BACK', caseId: 'cart-return' });
    expect(state.mercurySnake.life.site.cart.location).toBe('A');
    expect(state.mercurySnake.life.cases['cart-return'].attempts[0]!.returnKind).toBe('ORDINARY');
    expect(state.spirituality).toBe(before.spirituality - 8);
  }, 30_000);
});
