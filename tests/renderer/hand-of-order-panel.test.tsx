/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { HandOfOrderPanel, type HandOfOrderPanelProps } from '../../src/renderer/HandOfOrderPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectHandOfOrder } from '../../src/domain/hand-of-order/index.js';
import { HAND_OF_ORDER_ABILITY_IDS, HAND_OF_ORDER_SOURCE_KEYS, type HandOfOrderAction, type HandOfOrderProjection, type HandOfOrderCommand } from '../../src/domain/hand-of-order/types.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { playerText } from '../../src/shared/player-text.js';
import type { HandOfOrderCaseId } from '../../src/domain/hand-of-order/life.js';
import { directedInitial2, dose, originalBalancer, hoo, prepared, promoted, promotedForLife, promotedDigested, taught } from '../domain/hand-of-order-directed-helper.js';

const PANEL = '秩序之手成长', PAGE = '秩序之手与新划界场地', CONFIRM = '秩序之手操作确认', ROUND = '战斗回合结果';
const roots = (state: SliceState) => JSON.stringify(HAND_OF_ORDER_SOURCE_KEYS.map(key => state[key]));
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const targets = () => screen.getByRole('navigation', { name: '秩序之手目标' });
const resources = () => screen.getByRole('region', { name: '秩序之手当前资源' });
const room = () => screen.getByRole('region', { name: '秩序之手原场事务' });
const editorial = /候选|原创G|本作G|原文未核|编号推断|CH3-|BA2-|HO1-|\bSTART\b|\bGUIDE\b|hand-of-order-potion-/;
const confirm = (dialog = screen.getByRole('dialog', { name: CONFIRM })) => within(dialog).getByRole('button', { name: '确认执行这一次操作' });
function show(value: HandOfOrderProjection = projectHandOfOrder(originalBalancer()), extra: Partial<HandOfOrderPanelProps> = {}) {
  const onCommand = extra.onCommand ?? vi.fn<HandOfOrderPanelProps['onCommand']>().mockImplementation(() => {});
  return { ...render(<HandOfOrderPanel value={value} busy={false} {...extra} onCommand={onCommand} />), onCommand };
}
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: CONFIRM }); }
function actionFor(value: HandOfOrderProjection, command: HandOfOrderCommand) {
  const action = value.actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`No public action for ${JSON.stringify(command)}.`);
  return action;
}
function buttonFor(action: HandOfOrderAction) {
  const panel = screen.getByRole('region', { name: PANEL });
  const buttons = within(panel).getAllByRole('button', { hidden: true }).filter(button => button.textContent?.startsWith(playerText(action.label)));
  expect(buttons).toHaveLength(1);
  const button = buttons[0]!, fold = button.closest('details'); if (fold) fold.open = true;
  return button;
}
function openAction(action: HandOfOrderAction) {
  const button = buttonFor(action); expect(disabled(button)).toBe(false); fireEvent.click(button);
  return screen.getByRole('dialog', { name: CONFIRM });
}

// Cold migration validates all 594 original commands. This is directed UNIT
// coverage; it never substitutes for a natural capture or SQLite transaction.
beforeAll(() => { originalBalancer(); promoted(); }, 120_000);
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  // Implementations are installed with mockImplementation so resetAllMocks
  // releases full-state closures rather than restoring an initial closure.
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Hand of Order panel: living original and independent bottles', () => {
  it('shows the real W135 body, seventeen inherited abilities and three new bottles without spending', () => {
    const state = originalBalancer(), bytes = roots(state), privateBytes = JSON.stringify(state), value = projectHandOfOrder(state), view = show(value);
    expect(resources().textContent).toContain('健康60/100 · 精神96/100 · 灵性120/120');
    expect(resources().textContent).toContain('690便士 · 本周行动3');
    expect(value.abilities).toHaveLength(17);
    expect(value.abilities.filter(entry => entry.mastery === 0)).toHaveLength(6);
    for (const ability of value.abilities) expect(view.container.textContent).toContain(`${playerText(ability.label)} · 掌握${ability.mastery}`);
    expect(resources().textContent).toContain('现有伤势2处 · 伤势风险1');
    expect(screen.getByRole('list', { name: '当前伤势与处置' }).textContent).toContain('重伤');
    expect(value.abilities.map(entry => entry.id)).not.toEqual(expect.arrayContaining([...HAND_OF_ORDER_ABILITY_IDS]));
    expect(view.container.textContent).toContain('当前保留17项能力');
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(primary().textContent).toContain('500便士');
    expect(value.bottles).toHaveLength(3);
    expect(view.container.textContent).toContain('可选择继续停留平衡者');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled(); expect(roots(state)).toBe(bytes);
    expect(state.handOfOrder.bottles[0]!.source).toContain(state.handOfOrder.bottles[0]!.id);
    expect(value.bottles[0]!.source).toContain("第1号"); expect(JSON.stringify(state)).toBe(privateBytes);
  });

  it('uses the actual unavailable purchase reason after paying for guidance', () => {
    const state = hoo(originalBalancer(), { type: 'LEARN_GUIDANCE' }), value = projectHandOfOrder(state), view = show(value);
    const action = actionFor(value, { type: 'BUY_POTION', bottleId: value.bottles[0]!.id }), button = buttonFor(action);
    expect(action.enabled).toBe(false); expect(disabled(button)).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(`hand-of-order-reason-${action.id}`);
    expect(document.getElementById(`hand-of-order-reason-${action.id}`)?.textContent).toBe(playerText(action.reason!));
    expect(resources().textContent).toContain('190便士'); fireEvent.click(button); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('preserves the selected independent second bottle after its own paid work receipt', () => {
    const state = taught(), value = projectHandOfOrder(state), onCommand = vi.fn<HandOfOrderPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectHandOfOrder(hoo(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<HandOfOrderPanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title); expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('confirms the real held bottle once and states the irrecoverable success and failure costs', () => {
    const state = prepared(), value = projectHandOfOrder(state), bytes = roots(state), view = show(value), dialog = openAction(actionFor(value, dose));
    expect(dialog.textContent).toContain(playerText(value.bottles[0]!.source));
    expect(dialog.textContent).toContain(`当前成功率${value.bottles[0]!.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('失败保留已付代价');
    const button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(dose); expect(roots(state)).toBe(bytes);
  });

  it('renders an actual failed dose without renewing the bottle or hiding its paid costs', () => {
    const before = prepared('FAILURE'), state = hoo(before, dose), value = projectHandOfOrder(state), view = show(value);
    expect(value.promoted).toBe(false); expect(value.bottles[0]!.status).toContain('原瓶已耗尽');
    expect(state.handOfOrder.bottles[0]!.status).toBe('CONSUMED');
    expect(value.abilities).toHaveLength(17); expect(state.mind).toBeLessThan(before.mind);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(state.cash).toBe(before.cash); expect(roots(state)).toBe(roots(before)); expect(view.onCommand).not.toHaveBeenCalled();
  }, 60_000); // Independent failed preparation and real reducer receipt across the original history.

  it('retains all seventeen masteries and adds only two zero masteries after promotion', () => {
    const state = promoted(), value = projectHandOfOrder(state), source = originalBalancer(), view = show(value);
    expect(value.abilities).toHaveLength(19);
    expect(value.abilities.filter(entry => entry.mastery === 0)).toHaveLength(8);
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(value.abilities.find(entry => entry.id === id)?.mastery).toBe(mastery);
    expect(value.abilities.slice(-2).map(entry => [entry.id, entry.mastery])).toEqual(HAND_OF_ORDER_ABILITY_IDS.map(id => [id, 0]));
    expect(view.container.textContent).toContain('当前保留19项能力');
    expect(state.health).toBe(source.health); expect(state.injuries).toEqual(source.injuries);
    expect(state.spirituality).toBe(source.spirituality); expect(state.handOfOrder.life.guardPlate!.integrity).toBe(65);
    expect(resources().textContent).toContain('原伤继续生效');
    expect(room().textContent).toContain('薇娜·贝尔'); expect(room().textContent).toContain('米拉·佩恩');
    expect(room().textContent).not.toMatch(/灵性100|能量100|精力100/);
    expect(view.container.textContent).not.toMatch(editorial); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('preserves a custom player name while adapting only authored prose', () => {
    const state = originalBalancer(); state.character.name = '原创G候选艾洛';
    const value = projectHandOfOrder(state), before = structuredClone(value), view = show(value);
    expect(view.container.textContent).toContain(state.character.name); expect(value).toEqual(before);
  });
});

describe('Hand of Order panel: confirmation and save safety', () => {
  it('traps confirmation focus and restores the same action on cancellation', () => {
    const onClose = vi.fn<() => void>().mockImplementation(() => {}), view = show(undefined, { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(dialog.querySelector('h3'));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    for (const target of within(targets()).getAllByRole('button')) expect(disabled(target)).toBe(true);
    const exit = screen.getByRole('button', { name: '返回普通生活' }); expect(disabled(exit)).toBe(true); fireEvent.click(exit);
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    expect(view.onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });

  it('holds one submitted intent until changed saved facts arrive', async () => {
    const state = directedInitial2(), value = projectHandOfOrder(state), onCommand = vi.fn<HandOfOrderPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<HandOfOrderPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBe(dialog);
    const after = projectHandOfOrder(hoo(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<HandOfOrderPanel value={after} busy={false} onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.queryByRole('status')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('locks the unchanged saved view on failure and accepts only the externally retried receipt', async () => {
    const state = directedInitial2(), value = projectHandOfOrder(state), onCommand = vi.fn<HandOfOrderPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<HandOfOrderPanel value={value} busy={false} error="保存暂时失败" onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(resources().textContent).toContain(`${state.cash}便士`);
    view.rerender(<HandOfOrderPanel value={value} busy error={null} onCommand={onCommand} />);
    const saved = hoo(state, onCommand.mock.calls[0]![0]);
    view.rerender(<HandOfOrderPanel value={projectHandOfOrder(saved)} busy={false} onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.queryByRole('status')).toBeNull();
    expect(saved.handOfOrder.acquisitionJournal.filter(entry => entry.command.type === 'LEARN_GUIDANCE')).toHaveLength(1);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' }); expect(resources().textContent).toContain(`${saved.cash}便士`);
  });

  it('invalidates an old confirmation when a different saved state arrives', async () => {
    const state = prepared(), onCommand = vi.fn<HandOfOrderPanelProps['onCommand']>().mockImplementation(() => {}), view = show(projectHandOfOrder(state), { onCommand });
    openPrimary(); view.rerender(<HandOfOrderPanel value={projectHandOfOrder(hoo(state, dose))} busy={false} onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull()); expect(onCommand).not.toHaveBeenCalled();
  });

  it('blocks every action while externally busy and closes a free view without a domain command', () => {
    for (const mode of ['busy', 'blocked'] as const) {
      const view = show(undefined, { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn<() => void>().mockImplementation(() => {}) });
      for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
      expect(view.onCommand).not.toHaveBeenCalled(); view.unmount();
    }
    const onClose = vi.fn<() => void>().mockImplementation(() => {}), view = show(undefined, { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' })); expect(onClose).toHaveBeenCalledOnce(); expect(view.onCommand).not.toHaveBeenCalled();
  });
});


function observeCase(state: SliceState, caseId: HandOfOrderCaseId): SliceState {
  if (state.handOfOrder.life.site?.playerLocation === 'START') state = hoo(state, { type: 'EXIT_ORIGINAL' });
  if (state.handOfOrder.life.annex.paidWeek === null) state = hoo(state, { type: 'RENT_ANNEX' });
  return hoo(state, { type: 'OBSERVE', caseId });
}
function openCase(state: SliceState, caseId: HandOfOrderCaseId, method: 'ABILITY' | 'ORDINARY'): SliceState {
  state = observeCase(state, caseId);
  state = hoo(state, { type: 'PREPARE', caseId, method });
  state = hoo(state, { type: 'WALK', caseId, to: 'ANNEX_A' });
  for (const type of ['CHECK_ORIGINALS', 'CONSENT_MIRA', 'SETUP_OBJECTS'] as const) state = hoo(state, { type, caseId });
  return state;
}
function handoverReturn(caseId: HandOfOrderCaseId): HandOfOrderCommand[] {
  return [{ type: 'WALK', caseId, to: 'ANNEX_B' }, { type: 'TAKE_OBJECT', caseId }, { type: 'WALK', caseId, to: 'ANNEX_A' }, ...closeCase(caseId)];
}
function closeCase(caseId: HandOfOrderCaseId): HandOfOrderCommand[] {
  return [{ type: 'RETURN_OBJECTS', caseId }, { type: 'WALK', caseId, to: 'OUTSIDE' }, { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId }];
}
function ordinaryHandover(state: SliceState): SliceState {
  const caseId = 'paired-handover';
  state = openCase(state, caseId, 'ORDINARY'); state = hoo(state, { type: 'COMPLETE_HANDOVER', caseId });
  for (const command of handoverReturn(caseId)) state = hoo(state, command);
  return state;
}
function interactive(initial: SliceState) {
  let state = initial;
  const onCommand = vi.fn<HandOfOrderPanelProps['onCommand']>().mockImplementation(() => {});
  const onClose = vi.fn<() => void>().mockImplementation(() => {}), view = show(projectHandOfOrder(state), { onCommand, onClose });
  return { view, onCommand, onClose, current: () => state, async execute(command: HandOfOrderCommand) {
    const action = actionFor(projectHandOfOrder(state), command); expect(action.enabled, action.reason ?? JSON.stringify(command)).toBe(true);
    fireEvent.click(confirm(openAction(action))); expect(onCommand.mock.calls.at(-1)![0]).toEqual(command);
    state = hoo(state, command);
    view.rerender(<HandOfOrderPanel value={projectHandOfOrder(state)} busy={false} onCommand={onCommand} onClose={onClose} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    return state;
  } };
}

describe('Hand of Order panel: actual original objects and finite life practice', () => {
  it('requires the real four-metre exit and a separate paid annex without moving the old table', async () => {
    const initial = promotedForLife(), bytes = roots(initial), flow = interactive(initial);
    expect(room().textContent).toContain('累计普通步行124米'); expect(room().textContent).toContain('现场时钟767秒');
    expect(screen.getByRole('region', { name: '同一原护板当前状态' }).textContent).toContain('当前完整度65');
    const outside = await flow.execute({ type: 'EXIT_ORIGINAL' });
    expect(outside.handOfOrder.life.site).toMatchObject({ playerLocation: 'OUTSIDE', playerTravelMetres: 128, clockSeconds: 771 });
    expect(outside.handOfOrder.life.guardPlate).toMatchObject({ id: 'BA2-GUARD-PLATE', holder: 'PLAYER', location: 'OUTSIDE', integrity: 65 });
    expect(outside.cash).toBe(initial.cash); expect(outside.actionsRemaining).toBe(initial.actionsRemaining);
    const after = await flow.execute({ type: 'RENT_ANNEX' });
    expect(after.cash).toBe(outside.cash - 40); expect(after.actionsRemaining).toBe(outside.actionsRemaining - 1);
    expect(after.handOfOrder.life.annex).toMatchObject({ paidWeek: after.week, supportPieces: 3, effortSpent: 0, effortLimit: 9 });
    expect(after.handOfOrder.life.site!.table).toEqual(initial.chaosHunter.life.table);
    expect(screen.getByRole('region', { name: '另行付费的新划界场地', hidden: true }).textContent).toContain('已经实际支付40便士、1次行动');
    expect(room().textContent).toContain('室内原空桌仍在原处'); expect(room().textContent).not.toMatch(editorial);
    expect(roots(after)).toBe(bytes); expect(flow.onClose).not.toHaveBeenCalled();
  }, 120_000);

  it('does not add a resource gate to a domain-authorized ordinary movement', () => {
    const caseId = 'paired-handover', state = openCase(promotedForLife(), caseId, 'ORDINARY');
    const value = projectHandOfOrder(state), before = structuredClone(value);
    // Presentation-only boundary: the domain action stays authoritative. This
    // does not claim a new saved state or alter the original campaign budget.
    value.resources = { ...value.resources!, spirituality: 0, actionsRemaining: 0 };
    const command = { type: 'WALK', caseId, to: 'OUTSIDE' } as const;
    const action = actionFor(value, command), view = show(value);
    expect(action.enabled).toBe(true); fireEvent.click(confirm(openAction(action)));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(value.actions).toEqual(before.actions); expect(state.spirituality).toBe(before.resources!.spirituality);
  }, 120_000);

  it('shows one actual stopped crossing and awards mastery only after the physical return and report', async () => {
    const caseId = 'paired-handover', initial = openCase(promotedForLife('DIVISION'), caseId, 'ABILITY'), flow = interactive(initial);
    expect(initial.handOfOrder.life.site).toMatchObject({ playerLocation: 'ANNEX_A', guide: { location: 'ANNEX_A' }, volunteer: { location: 'ANNEX_B', mind: 99 }, parcel: { holder: 'GUIDE', location: 'ANNEX_A' } });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await flow.execute({ type: 'BATTLEFIELD_DIVISION', caseId });
    expect(flow.current().spirituality).toBe(initial.spirituality - 8); expect(flow.current().mind).toBe(initial.mind - 2);
    expect(flow.current().handOfOrder.life.annex.supportPieces).toBe(2);
    expect(flow.current().progression.mastery['justiciar.s1.battlefield-division']).toBe(0);
    expect(screen.getByRole('region', { name: '当前待执行的有限动作' }).textContent).toContain('还剩20秒');
    await flow.execute({ type: 'ATTEMPT_HANDOVER', caseId, response: 'COOPERATE' });
    expect(flow.current().handOfOrder.life.cases[caseId].attempts[0]).toMatchObject({ divisionOutcome: 'STOPPED', handoverCompleted: false });
    expect(flow.current().handOfOrder.life.site!.parcel).toMatchObject({ holder: 'GUIDE', location: 'ANNEX_A' });
    expect(flow.current().progression.mastery['justiciar.s1.battlefield-division']).toBe(0);
    await flow.execute({ type: 'COMPLETE_HANDOVER', caseId });
    for (const command of handoverReturn(caseId)) await flow.execute(command);
    const after = flow.current();
    expect(after.progression.mastery['justiciar.s1.battlefield-division']).toBe(8);
    expect(after.handOfOrder.life.site!.parcel).toMatchObject({ id: 'CH3-PARCEL', quantity: 1, massGrams: 350, holder: 'GUIDE', location: 'OUTSIDE' });
    expect(after.handOfOrder.life.site!.paper.text).toBe(initial.handOfOrder.life.site!.paper.text);
    expect(after.handOfOrder.life.annex.effortSpent).toBe(3); expect(after.handOfOrder.life.guardPlate!.integrity).toBe(65);
    expect(roots(after)).toBe(roots(initial)); expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
  }, 180_000);

  it('keeps a failed cast paid while ordinary transfer and physical return remain available', async () => {
    const caseId = 'paired-handover', initial = openCase(promotedForLife('DIVISION_FAIL'), caseId, 'ABILITY'), flow = interactive(initial);
    await flow.execute({ type: 'BATTLEFIELD_DIVISION', caseId });
    expect(flow.current().handOfOrder.life.operation.division).toBeNull();
    expect(flow.current().spirituality).toBe(initial.spirituality - 8); expect(flow.current().mind).toBe(initial.mind - 4);
    expect(flow.current().handOfOrder.life.annex.supportPieces).toBe(2);
    expect(room().textContent).toMatch(/分割战场：(严重)?失败/);
    await flow.execute({ type: 'COMPLETE_HANDOVER', caseId });
    for (const command of handoverReturn(caseId)) await flow.execute(command);
    expect(flow.current().handOfOrder.life.cases[caseId].attempts[0]).toMatchObject({ result: 'ORDINARY', objectsReturned: true, closed: true, appliedAbilityIds: [] });
    expect(flow.current().progression.mastery['justiciar.s1.battlefield-division']).toBe(0);
    expect(flow.current().cash).toBe(initial.cash); expect(flow.current().handOfOrder.life.annex.supportPieces).toBe(2);
    expect(roots(flow.current())).toBe(roots(initial));
  }, 180_000);

  it('shows real original-plate wear, then respects fresh withdrawal before the third pending transfer', async () => {
    const caseId = 'measured-aftermath', initial = openCase(ordinaryHandover(promotedForLife('AFTERMATH')), caseId, 'ABILITY'), flow = interactive(initial);
    expect(initial.progression.mastery['justiciar.s1.battlefield-division']).toBe(0);
    await flow.execute({ type: 'AFTERMATH_CONTROL', caseId });
    expect(flow.current().progression.mastery['justiciar.s1.aftermath-control']).toBe(0);
    const cast = flow.current(); await flow.execute({ type: 'APPLY_IMPACT', caseId });
    expect(flow.current().health).toBe(cast.health - 2); expect(flow.current().handOfOrder.life.guardPlate!.integrity).toBe(50);
    expect(flow.current().handOfOrder.life.cases[caseId].attempts[0]!.impact).toMatchObject({ healthLoss: 2, plateWear: 15, aftermathApplied: true });
    expect(room().textContent).toContain('实际损失2健康、磨损15护板完整度');
    for (const command of closeCase(caseId)) await flow.execute(command);
    expect(flow.current().progression.mastery['justiciar.s1.aftermath-control']).toBe(8);
    const next = 'withdrawn-boundary';
    await flow.execute({ type: 'OBSERVE', caseId: next }); await flow.execute({ type: 'PREPARE', caseId: next, method: 'ABILITY' });
    await flow.execute({ type: 'WALK', caseId: next, to: 'ANNEX_A' });
    for (const type of ['CHECK_ORIGINALS', 'CONSENT_MIRA', 'SETUP_OBJECTS', 'WITHDRAW_PERMISSION'] as const) await flow.execute({ type, caseId: next });
    const before = flow.current(), nextProjection = projectHandOfOrder(before);
    expect(nextProjection.actions.some(action => action.enabled && action.command.type === 'BATTLEFIELD_DIVISION')).toBe(false);
    expect(screen.queryByRole('button', { name: /尝试划分这一次跨界步骤/ })).toBeNull();
    expect(room().textContent).toContain('许可已撤回，不能继续施术');
    expect(actionFor(projectHandOfOrder(before), { type: 'COMPLETE_HANDOVER', caseId: next }).enabled).toBe(true);
    await flow.execute({ type: 'COMPLETE_HANDOVER', caseId: next });
    for (const command of handoverReturn(next)) await flow.execute(command);
    await flow.execute({ type: 'REFLECT' });
    const after = flow.current();
    expect(after.progression.acting).toBe(100); expect(after.handOfOrder.life.reflected).toBe(true);
    expect(after.handOfOrder.life.cases[next].attempts[0]).toMatchObject({ permissionWithdrawn: true, appliedAbilityIds: [], result: 'ORDINARY', closed: true });
    expect(after.spirituality).toBe(before.spirituality); expect(after.mind).toBe(before.mind);
    expect(after.handOfOrder.life.annex).toMatchObject({ supportPieces: 2, effortSpent: 9 });
    expect(after.handOfOrder.life.site!.volunteer.mind).toBe(97); expect(after.handOfOrder.life.guardPlate!.integrity).toBe(50);
    expect(screen.queryByRole('region', { name: '当前主要操作' })).toBeNull(); expect(room().textContent).not.toMatch(editorial);
    expect(roots(after)).toBe(roots(initial));
  }, 240_000);
});

// The bridge controls commit delivery only. Every candidate and successful
// receipt comes from the real reducer and validator, including all old history.
function savedGame(input: SliceState) {
  let state = structuredClone(input), commits = 0, failNext = false;
  let nextBarrier: Promise<void> | null = null;
  const attemptedStates: SliceState[] = [], receipts = new Map<string, SliceReceipt>();
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    const receipt = receipts.get(envelope.intentId);
    if (receipt) return { ok: true, value: { ...structuredClone(receipt), replayed: true } };
    if (envelope.payload.type === 'CREATE') throw new Error('The actual original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next); attemptedStates.push(next);
    const barrier = nextBarrier; nextBarrier = null; if (barrier) await barrier;
    if (failNext) { failNext = false; return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } }; }
    const previousRevision = state.revision; state = next; commits++;
    const saved: SliceReceipt = { intentId: envelope.intentId, runId: state.runId, previousRevision, newRevision: state.revision,
      committedAt: '2026-10-16T00:00:00Z', replayed: false, state: projectSliceState(state) };
    receipts.set(envelope.intentId, saved); return { ok: true, value: saved };
  });
  return { get state() { return state; }, get commits() { return commits; }, attemptedStates, submit,
    failNextSave() { failNext = true; }, holdNextSave() {
      if (nextBarrier) throw new Error('A save barrier is already pending.');
      let release = () => {}; nextBarrier = new Promise<void>(resolve => { release = resolve; }); return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mountSaved(game: SavedGame) {
  const value = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name, portraitId: value.character.portraitId,
        week: value.week, date: value.date, status: value.status, revision: value.revision, updatedAt: '2026-10-16T00:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }, { timeout: 30_000 }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  if (value.lastCombatRound?.handOfOrderOutcome) await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
  else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! }, { timeout: 30_000 });
  else if (value.handOfOrder.insideCase) await screen.findByRole('region', { name: PANEL }, { timeout: 30_000 });
  else await screen.findByRole('button', { name: PAGE }, { timeout: 30_000 });
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
}
async function reopenSaved(game: SavedGame) { cleanup(); await mountSaved(game); }
async function openSavedPanel() {
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: PAGE }));
  return screen.getByRole('region', { name: PANEL });
}
function assertRound(state: SliceState) {
  const round = state.lastCombatRound!;
  expect(round.handOfOrderOutcome).toBeTruthy();
  const dialog = screen.getByRole('dialog', { name: ROUND });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(within(dialog).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(dialog.textContent).toContain(`你的次数盘：${round.playerCount}次`);
  expect(dialog.textContent).toContain(`对手次数盘：${round.enemyCount}次`);
  expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
  const publicState = projectSliceState(state);
  const forbidden = new Set(['seed', 'cursor', 'randomSeed', 'randomCursor', 'cursorBefore', 'cursorAfter', 'preparationRoll']);
  const inspect = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(inspect); return; }
    for (const [key, child] of Object.entries(value)) { expect(forbidden.has(key), `Private field ${key}`).toBe(false); inspect(child); }
  };
  inspect(publicState.lastCombatRound);
  inspect(publicState.combat?.lastRound);
  inspect(publicState.combatHistory.at(-1));
}

describe('Hand of Order saved shell: one actual result and one retry envelope', () => {
  it('does not reopen the inherited surrender over the new stage and retries the same forty-penny annex purchase once', async () => {
    const before = hoo(promotedForLife(), { type: 'EXIT_ORIGINAL' }), expected = hoo(before, { type: 'RENT_ANNEX' });
    const game = savedGame(before), bytes = roots(before), releaseFailure = game.holdNextSave(); game.failNextSave();
    await mountSaved(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openSavedPanel();
    const action = actionFor(projectHandOfOrder(before), { type: 'RENT_ANNEX' }), dialog = openAction(action);
    expect(dialog.textContent).toContain('40便士'); const button = confirm(dialog); fireEvent.click(button); fireEvent.click(button);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.commits).toBe(0); expect(game.state).toEqual(before);
    expect(game.attemptedStates[0]).toEqual(expected); expect(disabled(button)).toBe(true);
    await act(async () => { releaseFailure(); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(resources().textContent).toContain(`${before.cash}便士`); expect(game.state.handOfOrder.life.annex.paidWeek).toBeNull();
    const envelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope); expect(game.state).toEqual(before);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(expected.revision), { timeout: 30_000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(game.state).toEqual(expected); expect(game.commits).toBe(1);
    expect(game.state.cash).toBe(before.cash - 40); expect(game.state.handOfOrder.life.annex).toEqual(expected.handOfOrder.life.annex);
    expect(game.state.random).toEqual(before.random); expect(roots(game.state)).toBe(bytes);
    await reopenSaved(game); await openSavedPanel();
    expect(resources().textContent).toContain(`${expected.cash}便士`);
    expect(screen.getByRole('region', { name: '另行付费的新划界场地', hidden: true }).textContent).toContain('实际支付40便士');
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 120_000); // Real original promotion, physical exit, two reducer/save attempts and a fresh shell load.

  it('opens the actual new fight ahead of the old promotion, then shows one identical retried round immediately and on reopen', async () => {
    let before = promotedDigested();
    for (const type of ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) before = hoo(before, { type });
    const value = projectSliceState(before), game = savedGame(before), intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    const expected = applySliceIntent(before, intent), bytes = roots(before), releaseFailure = game.holdNextSave(); game.failNextSave();
    expect(before.balancer.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 90, enemyMind: 100, enemySpirituality: 67 });
    expect(before.combat).toMatchObject({ encounterId: 'HAND_OF_ORDER_DISPUTE', round: 1, lastRound: null });
    expect(value.balancer.promoted).toBe(true); expect(value.handOfOrder.promoted).toBe(true);
    await mountSaved(game);
    expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }); expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(value.combat!.playerCountWheel).toHaveLength(6);
    expect(before.handOfOrder.life.site!.guide.location).toBe('OUTSIDE');
    expect(before.handOfOrder.life.site!.volunteer.location).toBe('OUTSIDE');
    const stance = value.combat!.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }); fireEvent.click(submit); fireEvent.click(submit);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.submit.mock.calls[0]![0].payload).toEqual(intent);
    expect(game.attemptedStates[0]).toEqual(expected); expect(game.state).toEqual(before); expect(game.commits).toBe(0);
    await act(async () => { releaseFailure(); });
    const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(disabled(submit)).toBe(true); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); expect(game.state.random).toEqual(before.random);
    const envelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope);
    await act(async () => { releaseSuccess(); }); await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
    assertRound(expected); expect(game.state).toEqual(expected); expect(game.commits).toBe(1); expect(game.attemptedStates[1]).toEqual(expected);
    expect(expected.combatHistory).toHaveLength(before.combatHistory.length + 1);
    expect(expected.combatHistory.slice(0, -1)).toEqual(before.combatHistory); expect(roots(expected)).toBe(bytes);
    expect(expected.handOfOrder.life.guardPlate!.integrity).toBeLessThanOrEqual(before.handOfOrder.life.guardPlate!.integrity);
    const resultText = screen.getByRole('dialog', { name: ROUND }).textContent;
    await reopenSaved(game); assertRound(expected); expect(screen.getByRole('dialog', { name: ROUND }).textContent).toBe(resultText);
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 240_000); // Three complete real life cases, reflection, optional approach and two full combat/save reductions.
});
