/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrinceOfAbolitionPanel, type PrinceOfAbolitionPanelProps } from '../../src/renderer/PrinceOfAbolitionPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectPrinceOfAbolition } from '../../src/domain/prince-of-abolition/index.js';
import { PRINCE_OF_ABOLITION_ABILITY_IDS, PRINCE_OF_ABOLITION_SOURCE_KEYS, type PrinceOfAbolitionAction, type PrinceOfAbolitionProjection, type PrinceOfAbolitionCommand } from '../../src/domain/prince-of-abolition/types.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { playerText } from '../../src/shared/player-text.js';
import type { PrinceOfAbolitionCaseId } from '../../src/domain/prince-of-abolition/life.js';
import { directedInitial2, dose, originalEntropyDuke, poa, prepared, promoted, promotedForLife, promotedDigested, taught } from '../domain/prince-of-abolition-directed-helper.js';

const PANEL = '弑序亲王成长', PAGE = '弑序亲王与原物承接区', CONFIRM = '弑序亲王操作确认', ROUND = '战斗回合结果';
const roots = (state: SliceState) => JSON.stringify(PRINCE_OF_ABOLITION_SOURCE_KEYS.map(key => state[key]));
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const targets = () => screen.getByRole('navigation', { name: '弑序亲王目标' });
const resources = () => screen.getByRole('region', { name: '弑序亲王当前资源' });
const room = () => screen.getByRole('region', { name: '弑序亲王原场事务' });
const editorial = /候选|原创G|本作G|原文未核|编号推断|FM3-|PA1-|\bSTART\b|\bGUIDE\b|prince-of-abolition-potion-/;
const confirm = (dialog = screen.getByRole('dialog', { name: CONFIRM })) => within(dialog).getByRole('button', { name: '确认执行这一次操作' });
function show(value: PrinceOfAbolitionProjection = projectPrinceOfAbolition(originalEntropyDuke()), extra: Partial<PrinceOfAbolitionPanelProps> = {}) {
  const onCommand = extra.onCommand ?? vi.fn<PrinceOfAbolitionPanelProps['onCommand']>().mockImplementation(() => {});
  return { ...render(<PrinceOfAbolitionPanel value={value} busy={false} {...extra} onCommand={onCommand} />), onCommand };
}
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: CONFIRM }); }
function actionFor(value: PrinceOfAbolitionProjection, command: PrinceOfAbolitionCommand) {
  const action = value.actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`No public action for ${JSON.stringify(command)}.`);
  return action;
}
function buttonFor(action: PrinceOfAbolitionAction) {
  const panel = screen.getByRole('region', { name: PANEL });
  const buttons = within(panel).getAllByRole('button', { hidden: true }).filter(button => button.textContent?.startsWith(playerText(action.label)));
  expect(buttons).toHaveLength(1);
  const button = buttons[0]!, fold = button.closest('details'); if (fold) fold.open = true;
  return button;
}
function openAction(action: PrinceOfAbolitionAction) {
  const button = buttonFor(action); expect(disabled(button)).toBe(false); fireEvent.click(button);
  return screen.getByRole('dialog', { name: CONFIRM });
}

// Cold migration validates all 743 original commands. This is directed UNIT
// coverage; it never substitutes for a natural capture or SQLite transaction.
beforeAll(() => { originalEntropyDuke(); promoted(); }, 120_000);
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

describe('Prince of Abolition panel: living original and independent bottles', () => {
  it('shows the real W185 body, fourteen inherited abilities and three new bottles without spending', () => {
    const state = originalEntropyDuke(), bytes = roots(state), privateBytes = JSON.stringify(state), value = projectPrinceOfAbolition(state), view = show(value);
    expect(resources().textContent).toContain('健康100/100 · 精神95/100 · 灵性94/120');
    expect(resources().textContent).toContain('800便士 · 本周行动3');
    expect(value.abilities).toHaveLength(14);
    expect(value.abilities.map(entry => entry.id)).not.toEqual(expect.arrayContaining([...PRINCE_OF_ABOLITION_ABILITY_IDS]));
    expect(view.container.textContent).toContain('当前保留14项能力');
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(primary().textContent).toContain('500便士');
    expect(value.bottles).toHaveLength(3);
    expect(view.container.textContent).toContain('可选择继续停留熵之公爵');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled(); expect(roots(state)).toBe(bytes);
    expect(state.princeOfAbolition.bottles[0]!.source).toContain(state.princeOfAbolition.bottles[0]!.id);
    expect(value.bottles[0]!.source).toContain("第1号"); expect(JSON.stringify(state)).toBe(privateBytes);
  });

  it('uses the actual unavailable purchase reason after paying for guidance', () => {
    const state = poa(originalEntropyDuke(), { type: 'LEARN_GUIDANCE' }), value = projectPrinceOfAbolition(state), view = show(value);
    const action = actionFor(value, { type: 'BUY_POTION', bottleId: value.bottles[0]!.id }), button = buttonFor(action);
    expect(action.enabled).toBe(false); expect(disabled(button)).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(`prince-of-abolition-reason-${action.id}`);
    expect(document.getElementById(`prince-of-abolition-reason-${action.id}`)?.textContent).toBe(playerText(action.reason!));
    expect(resources().textContent).toContain('300便士'); fireEvent.click(button); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('preserves the selected independent second bottle after its own paid work receipt', () => {
    const state = taught(), value = projectPrinceOfAbolition(state), onCommand = vi.fn<PrinceOfAbolitionPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectPrinceOfAbolition(poa(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<PrinceOfAbolitionPanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title); expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('confirms the real held bottle once and states the irrecoverable success and failure costs', () => {
    const state = prepared(), value = projectPrinceOfAbolition(state), bytes = roots(state), view = show(value), dialog = openAction(actionFor(value, dose));
    expect(dialog.textContent).toContain(playerText(value.bottles[0]!.source));
    expect(dialog.textContent).toContain(`当前成功率${value.bottles[0]!.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('失败保留已付代价');
    const button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(dose); expect(roots(state)).toBe(bytes);
  });

  it('renders an actual failed dose without renewing the bottle or hiding its paid costs', () => {
    const before = prepared('FAILURE'), state = poa(before, dose), value = projectPrinceOfAbolition(state), view = show(value);
    expect(value.promoted).toBe(false); expect(value.bottles[0]!.status).toContain('原瓶已耗尽');
    expect(state.princeOfAbolition.bottles[0]!.status).toBe('CONSUMED');
    expect(value.abilities).toHaveLength(14); expect(state.mind).toBeLessThan(before.mind);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(state.cash).toBe(before.cash); expect(roots(state)).toBe(roots(before)); expect(view.onCommand).not.toHaveBeenCalled();
  }, 60_000); // Independent failed preparation and real reducer receipt across the original history.

  it('retains all fourteen masteries and adds only two zero masteries after promotion', () => {
    const state = promoted(), value = projectPrinceOfAbolition(state), source = originalEntropyDuke(), view = show(value);
    expect(value.abilities).toHaveLength(16);
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(value.abilities.find(entry => entry.id === id)?.mastery).toBe(mastery);
    expect(value.abilities.slice(-2).map(entry => [entry.id, entry.mastery])).toEqual(PRINCE_OF_ABOLITION_ABILITY_IDS.map(id => [id, 0]));
    expect(view.container.textContent).toContain('当前保留16项能力');
    expect(room().textContent).toContain('米蕾·沃德'); expect(room().textContent).toContain('达里安·维尔');
    expect(room().textContent).not.toMatch(/灵性100|能量100|精力100/);
    expect(view.container.textContent).not.toMatch(editorial); expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('preserves a custom player name while adapting only authored prose', () => {
    const state = originalEntropyDuke(); state.character.name = '原创G候选艾洛';
    const value = projectPrinceOfAbolition(state), before = structuredClone(value), view = show(value);
    expect(view.container.textContent).toContain(state.character.name); expect(value).toEqual(before);
  });
});

describe('Prince of Abolition panel: confirmation and save safety', () => {
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
    const state = directedInitial2(), value = projectPrinceOfAbolition(state), onCommand = vi.fn<PrinceOfAbolitionPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<PrinceOfAbolitionPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBe(dialog);
    const after = projectPrinceOfAbolition(poa(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<PrinceOfAbolitionPanel value={after} busy={false} onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.queryByRole('status')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('locks the unchanged saved view on failure and accepts only the externally retried receipt', async () => {
    const state = directedInitial2(), value = projectPrinceOfAbolition(state), onCommand = vi.fn<PrinceOfAbolitionPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<PrinceOfAbolitionPanel value={value} busy={false} error="保存暂时失败" onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(resources().textContent).toContain(`${state.cash}便士`);
    view.rerender(<PrinceOfAbolitionPanel value={value} busy error={null} onCommand={onCommand} />);
    const saved = poa(state, onCommand.mock.calls[0]![0]);
    view.rerender(<PrinceOfAbolitionPanel value={projectPrinceOfAbolition(saved)} busy={false} onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.queryByRole('status')).toBeNull();
    expect(saved.princeOfAbolition.acquisitionJournal.filter(entry => entry.command.type === 'LEARN_GUIDANCE')).toHaveLength(1);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' }); expect(resources().textContent).toContain(`${saved.cash}便士`);
  });

  it('invalidates an old confirmation when a different saved state arrives', async () => {
    const state = prepared(), onCommand = vi.fn<PrinceOfAbolitionPanelProps['onCommand']>().mockImplementation(() => {}), view = show(projectPrinceOfAbolition(state), { onCommand });
    openPrimary(); view.rerender(<PrinceOfAbolitionPanel value={projectPrinceOfAbolition(poa(state, dose))} busy={false} onCommand={onCommand} />);
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

function observeCase(state: SliceState, caseId: PrinceOfAbolitionCaseId): SliceState {
  if (state.princeOfAbolition.life.site.playerLocation === 'START') state = poa(state, { type: 'EXIT_ROOM' });
  if (!state.princeOfAbolition.life.annex) state = poa(state, { type: 'BUY_ANNEX' });
  return poa(state, { type: 'OBSERVE', caseId });
}
function openCase(state: SliceState, caseId: PrinceOfAbolitionCaseId, method: 'ABILITY' | 'ORDINARY'): SliceState {
  state = observeCase(state, caseId);
  for (const permission of ['OWNER', 'COOPERATION'] as const) state = poa(state, { type: 'CONSENT', caseId, permission });
  if (method === 'ABILITY') state = poa(state, { type: 'CONSENT', caseId, permission: 'ABILITY' });
  state = poa(state, method === 'ABILITY' ? { type: 'PREPARE', caseId, method } : { type: 'START_ORDINARY', caseId });
  for (const type of ['TAKE_BALL', 'WALK_TO_ANNEX', 'INSPECT', 'PREPARE_ACTION'] as const) state = poa(state, { type, caseId });
  return state;
}
const returnSteps = ['WAIT_FLIGHT', 'WALK_TO_RECEIVER', 'RETRIEVE_BALL', 'RETURN_TO_ANNEX', 'RETURN_TO_OUTSIDE', 'RETURN_OBJECTS', 'LEAVE', 'REPORT'] as const;
function ordinaryCase(state: SliceState, caseId: PrinceOfAbolitionCaseId): SliceState {
  state = openCase(state, caseId, 'ORDINARY'); state = poa(state, { type: 'THROW_BALL', caseId });
  for (const type of returnSteps) state = poa(state, { type, caseId });
  return state;
}
function interactive(initial: SliceState) {
  let state = initial;
  const onCommand = vi.fn<PrinceOfAbolitionPanelProps['onCommand']>().mockImplementation(() => {});
  const onClose = vi.fn<() => void>().mockImplementation(() => {}), view = show(projectPrinceOfAbolition(state), { onCommand, onClose });
  return { view, onCommand, onClose, current: () => state, async execute(command: PrinceOfAbolitionCommand) {
    const action = actionFor(projectPrinceOfAbolition(state), command); expect(action.enabled, action.reason ?? JSON.stringify(command)).toBe(true);
    fireEvent.click(confirm(openAction(action))); expect(onCommand.mock.calls.at(-1)![0]).toEqual(command);
    state = poa(state, command);
    view.rerender(<PrinceOfAbolitionPanel value={projectPrinceOfAbolition(state)} busy={false} onCommand={onCommand} onClose={onClose} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    return state;
  } };
}

describe('Prince of Abolition panel: original objects and finite new practice', () => {
  it('walks the original four metres before any purchase and keeps ordinary navigation available', async () => {
    const initial = promotedForLife(), source = initial.princeOfAbolition.sourceScene!.originals.site, flow = interactive(initial);
    expect(room().textContent).toContain(`本人实际在原门口，累计普通步行${source.playerTravelMetres}米，原现场时钟${source.clockSeconds}秒`);
    expect(screen.getByRole('region', { name: '另行付费的新承接区' }).textContent).toContain('尚未购入');
    const after = await flow.execute({ type: 'EXIT_ROOM' });
    expect(after.princeOfAbolition.life.site.playerLocation).toBe('OUTSIDE');
    expect(after.princeOfAbolition.life.site.playerTravelMetres).toBe(source.playerTravelMetres + 4);
    expect(after.princeOfAbolition.life.site.clockSeconds).toBe(source.clockSeconds + 4);
    expect(after.cash).toBe(initial.cash); expect(after.princeOfAbolition.life.annex).toBeNull();
    for (const key of ['parcel', 'ball', 'paper', 'pads'] as const) expect(after.princeOfAbolition.life.site[key]).toEqual(source[key]);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' })); expect(flow.onClose).toHaveBeenCalledOnce();
    expect(flow.onCommand).toHaveBeenCalledTimes(1); expect(roots(after)).toBe(roots(initial));
  });

  it('shows the real forty-penny annex separately from both unchanged indoor pads', async () => {
    const initial = poa(promotedForLife(), { type: 'EXIT_ROOM' }), flow = interactive(initial), source = initial.princeOfAbolition.life.site;
    const after = await flow.execute({ type: 'BUY_ANNEX' });
    expect(after.cash).toBe(initial.cash - 40); expect(after.actionsRemaining).toBe(initial.actionsRemaining - 1);
    expect(after.princeOfAbolition.life.annex).toMatchObject({ paidPennies: 40, surface: { placed: true, people: 0 } });
    expect(after.princeOfAbolition.life.site.pads).toEqual(source.pads);
    expect(after.princeOfAbolition.life.site.ball).toEqual(source.ball);
    expect(screen.getByRole('region', { name: '另行付费的新承接区' }).textContent).toContain('实际支付40便士');
    expect(screen.getByRole('list', { name: '室内原垫保持原位' }).textContent).toContain('原B空软垫仍在原室B');
    expect(screen.getByRole('list', { name: '室内原垫保持原位' }).textContent).toContain('原C空软垫仍在原室C');
    expect(room().textContent).toContain('室内两块原垫仍在原处');
    expect(roots(after)).toBe(roots(initial));
  });

  it('allows real refusal and closure at zero AP before buying a support piece', async () => {
    const initial = observeCase(promotedForLife('AMPLIFY', { actions: 7 }), 'directed-throw'), flow = interactive(initial);
    expect(initial.actionsRemaining).toBe(0); expect(initial.princeOfAbolition.life.pieces).toEqual([]);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await flow.execute({ type: 'WITHDRAW_CONSENT', caseId: 'directed-throw', permission: 'ABILITY' });
    expect(room().textContent).toContain('已撤回同意');
    const after = await flow.execute({ type: 'ABORT', caseId: 'directed-throw' });
    expect(after.princeOfAbolition.life.cases['directed-throw'].status).toBe('CANCELLED');
    expect(after.princeOfAbolition.life.pieces).toEqual([]);
    expect(after.princeOfAbolition.life.journal.at(-1)!.paid.pennies).toBe(0);
    // Actual zero-AP closure may settle the due week; that bill is not a support-piece purchase.
    expect(resources().textContent).toContain(`${after.cash}便士`);
    expect(after.princeOfAbolition.life.site.ball).toEqual(initial.princeOfAbolition.life.site.ball);
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
  }, 60_000); // Real five-action promotion plus annex, observation and zero-AP closure.

  it('offers the unpurchased ordinary method with individual object and cooperation consent', async () => {
    let initial = observeCase(promotedForLife(), 'directed-throw');
    for (const permission of ['OWNER', 'COOPERATION'] as const) initial = poa(initial, { type: 'CONSENT', caseId: 'directed-throw', permission });
    const flow = interactive(initial), cash = initial.cash;
    await flow.execute({ type: 'START_ORDINARY', caseId: 'directed-throw' });
    for (const type of ['TAKE_BALL', 'WALK_TO_ANNEX', 'INSPECT', 'PREPARE_ACTION', 'THROW_BALL', ...returnSteps] as const) await flow.execute({ type, caseId: 'directed-throw' });
    const after = flow.current(), attempt = after.princeOfAbolition.life.cases['directed-throw'].attempts[0]!;
    expect(after.cash).toBe(cash); expect(after.princeOfAbolition.life.pieces).toEqual([]);
    expect(attempt).toMatchObject({ method: 'ORDINARY', closed: true, returned: true, amplification: 0, maintenanceSeconds: 0, appliedAbilityIds: [] });
    expect(after.princeOfAbolition.life.volunteerMindSpent).toBe(1);
    const completed = projectPrinceOfAbolition(after).life.cases.find(entry => entry.id === 'directed-throw')!, calls = flow.onCommand.mock.calls.length;
    const completedButton = within(targets()).getByRole('button', { name: `${completed.title} · 已收束` });
    fireEvent.click(completedButton); expect(completedButton.getAttribute('aria-pressed')).toBe('true');
    expect(flow.onCommand.mock.calls).toHaveLength(calls); expect(flow.current()).toBe(after);
    expect(room().textContent).toContain('普通操作与失败收尾不冒充能力成功');
    expect(after.princeOfAbolition.life.site.ball).toMatchObject({ quantity: 1, massGrams: 80, holder: 'GUIDE', location: 'OUTSIDE' });
    expect(after.princeOfAbolition.life.site.paper).toMatchObject({ quantity: 1, holder: 'GUIDE', location: 'OUTSIDE', text: '从A到B' });
  }, 120_000); // Full actual ordinary life flow on the immutable 743-command campaign.

  it('shows the one pending +35 action, actual casting costs and a real trajectory that withdrawal cannot rewind', async () => {
    const initial = openCase(promotedForLife('AMPLIFY'), 'directed-throw', 'ABILITY'), flow = interactive(initial);
    await flow.execute({ type: 'DIRECTED_AMPLIFICATION', caseId: 'directed-throw' });
    const pending = screen.getByRole('region', { name: '本人待执行动作的有限强化' });
    expect(pending.textContent).toContain('一次尚未执行的投球增加35'); expect(pending.textContent).toContain('支付8灵性、2精神');
    expect(flow.current().spirituality).toBe(initial.spirituality - 8); expect(flow.current().mind).toBe(initial.mind - 2);
    await flow.execute({ type: 'THROW_BALL', caseId: 'directed-throw' });
    expect(screen.queryByRole('region', { name: '本人待执行动作的有限强化' })).toBeNull();
    const before = structuredClone(flow.current().princeOfAbolition.life.flight);
    const paid = { cash: flow.current().cash, mind: flow.current().mind, spirituality: flow.current().spirituality };
    await flow.execute({ type: 'WITHDRAW_CONSENT', caseId: 'directed-throw', permission: 'ABILITY' });
    expect(flow.current().princeOfAbolition.life.flight).toMatchObject({ id: before!.id, launchedAt: before!.launchedAt, originalLandAt: before!.originalLandAt, landsAt: before!.landsAt });
    expect(flow.current().princeOfAbolition.life.flight!.positionMm).toBeGreaterThan(before!.positionMm);
    expect(screen.getByRole('region', { name: '同一原球正在发生的有限轨迹' }).textContent).toContain('已经投出的原球照常落地');
    expect(actionFor(projectPrinceOfAbolition(flow.current()), { type: 'WAIT_FLIGHT', caseId: 'directed-throw' }).enabled).toBe(true);
    for (const type of returnSteps) await flow.execute({ type, caseId: 'directed-throw' });
    const after = flow.current();
    expect({ cash: after.cash, mind: after.mind, spirituality: after.spirituality }).toEqual(paid);
    expect(after.princeOfAbolition.life.pieces[0]).toMatchObject({ quantity: 1, charges: 0, wear: 1 });
    expect(after.princeOfAbolition.life.cases['directed-throw'].attempts[0]).toMatchObject({ amplification: 35, withdrawn: true, returned: true, closed: true });
    expect(after.princeOfAbolition.life.site.ball.throws).toBe(initial.princeOfAbolition.life.site.ball.throws + 1);
    expect(roots(after)).toBe(roots(initial));
  }, 120_000); // Complete paid cast, actual throw, withdrawal, wait and physical collection/report.

  it('maintains only the same already-flying ball for twenty seconds and displays the finite cost', async () => {
    let initial = ordinaryCase(promotedForLife('MAINTAIN'), 'directed-throw');
    initial = openCase(initial, 'maintained-flight', 'ABILITY'); initial = poa(initial, { type: 'THROW_BALL', caseId: 'maintained-flight' });
    const flow = interactive(initial), before = initial.princeOfAbolition.life.flight!;
    await flow.execute({ type: 'EFFECT_MAINTENANCE', caseId: 'maintained-flight' });
    const flight = flow.current().princeOfAbolition.life.flight!;
    expect(flight.id).toBe(before.id); expect(flight.landsAt).toBe(before.landsAt + 20);
    expect(flow.current().spirituality).toBe(initial.spirituality - 8); expect(flow.current().mind).toBe(initial.mind - 2);
    expect(screen.getByRole('region', { name: '同一原球正在发生的有限轨迹' }).textContent).toContain('已实际延长20秒');
    await flow.execute({ type: 'WITHDRAW_CONSENT', caseId: 'maintained-flight', permission: 'ABILITY' });
    expect(flow.current().princeOfAbolition.life.flight).toMatchObject({ id: flight.id, launchedAt: flight.launchedAt, landsAt: flight.landsAt });
    expect(flow.current().princeOfAbolition.life.flight!.positionMm).toBeGreaterThan(flight.positionMm);
    while (flow.current().princeOfAbolition.life.flight) await flow.execute({ type: 'WAIT_FLIGHT', caseId: 'maintained-flight' });
    for (const type of returnSteps.slice(1)) await flow.execute({ type, caseId: 'maintained-flight' });
    expect(flow.current().princeOfAbolition.life.cases['maintained-flight'].attempts[0]).toMatchObject({ maintenanceSeconds: 20, amplification: 0, returned: true, closed: true });
    expect(flow.current().princeOfAbolition.life.pieces.at(-1)).toMatchObject({ charges: 0, wear: 1 });
    expect(screen.queryByRole('region', { name: '同一原球正在发生的有限轨迹' })).toBeNull();
  }, 180_000); // A complete prior ordinary report plus the second real maintained trajectory and closure.

  it('keeps a failed paid cast distinct from ordinary collection and does not refund its piece', async () => {
    const initial = openCase(promotedForLife('AMPLIFY_FAIL'), 'directed-throw', 'ABILITY'), flow = interactive(initial);
    await flow.execute({ type: 'DIRECTED_AMPLIFICATION', caseId: 'directed-throw' });
    expect(screen.queryByRole('region', { name: '本人待执行动作的有限强化' })).toBeNull();
    expect(flow.current().spirituality).toBe(initial.spirituality - 8); expect(flow.current().mind).toBe(initial.mind - 4);
    expect(room().textContent).toContain('实际应用0项能力');
    await flow.execute({ type: 'THROW_BALL', caseId: 'directed-throw' });
    for (const type of returnSteps) await flow.execute({ type, caseId: 'directed-throw' });
    expect(flow.current().princeOfAbolition.life.cases['directed-throw'].attempts[0]).toMatchObject({ amplification: 0, appliedAbilityIds: [], closed: true });
    expect(flow.current().cash).toBe(initial.cash); expect(flow.current().princeOfAbolition.life.pieces[0]).toMatchObject({ charges: 0, wear: 1 });
  }, 120_000); // Full failed paid ability route retains real costs and ordinary physical cleanup.
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
  if (value.lastCombatRound?.princeOfAbolitionOutcome) await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
  else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! }, { timeout: 30_000 });
  else if (value.princeOfAbolition.insideCase) await screen.findByRole('region', { name: PANEL }, { timeout: 30_000 });
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
  expect(round.princeOfAbolitionOutcome).toBeTruthy();
  const dialog = screen.getByRole('dialog', { name: ROUND });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(within(dialog).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(dialog.textContent).toContain(`你的次数盘：${round.playerCount}次`);
  expect(dialog.textContent).toContain(`对手次数盘：${round.enemyCount}次`);
  expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
}

describe('Prince of Abolition saved shell: one actual result and one retry envelope', () => {
  it('does not reopen the inherited surrender over the new stage and retries the same forty-penny annex purchase once', async () => {
    const before = poa(promotedForLife(), { type: 'EXIT_ROOM' }), expected = poa(before, { type: 'BUY_ANNEX' });
    const game = savedGame(before), bytes = roots(before), releaseFailure = game.holdNextSave(); game.failNextSave();
    await mountSaved(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openSavedPanel();
    const action = actionFor(projectPrinceOfAbolition(before), { type: 'BUY_ANNEX' }), dialog = openAction(action);
    expect(dialog.textContent).toContain('40便士'); const button = confirm(dialog); fireEvent.click(button); fireEvent.click(button);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.commits).toBe(0); expect(game.state).toEqual(before);
    expect(game.attemptedStates[0]).toEqual(expected); expect(disabled(button)).toBe(true);
    await act(async () => { releaseFailure(); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(resources().textContent).toContain(`${before.cash}便士`); expect(game.state.princeOfAbolition.life.annex).toBeNull();
    const envelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope); expect(game.state).toEqual(before);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(expected.revision), { timeout: 30_000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(game.state).toEqual(expected); expect(game.commits).toBe(1);
    expect(game.state.cash).toBe(before.cash - 40); expect(game.state.princeOfAbolition.life.annex).toEqual(expected.princeOfAbolition.life.annex);
    expect(game.state.random).toEqual(before.random); expect(roots(game.state)).toBe(bytes);
    await reopenSaved(game); await openSavedPanel();
    expect(resources().textContent).toContain(`${expected.cash}便士`);
    expect(screen.getByRole('region', { name: '另行付费的新承接区' }).textContent).toContain('实际支付40便士');
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 120_000); // Real original promotion, physical exit, two reducer/save attempts and a fresh shell load.

  it('opens the actual new fight ahead of the old promotion, then shows one identical retried round immediately and on reopen', async () => {
    let before = promotedDigested();
    for (const type of ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) before = poa(before, { type });
    const value = projectSliceState(before), game = savedGame(before), intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    const expected = applySliceIntent(before, intent), bytes = roots(before), releaseFailure = game.holdNextSave(); game.failNextSave();
    expect(before.entropyDuke.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 85 });
    expect(before.combat).toMatchObject({ encounterId: 'PRINCE_OF_ABOLITION_DISPUTE', round: 1, lastRound: null });
    expect(value.entropyDuke.promoted).toBe(true); expect(value.princeOfAbolition.promoted).toBe(true);
    await mountSaved(game);
    expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }); expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(value.combat!.playerCountWheel).toHaveLength(6);
    expect(before.princeOfAbolition.encounter.currentSite!.guide.location).toBe('OUTSIDE');
    expect(before.princeOfAbolition.encounter.currentSite!.volunteer.location).toBe('OUTSIDE');
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
    expect(expected.princeOfAbolition.gifts.filter(gift => gift.location === 'PLAYER').length).toBeLessThanOrEqual(3);
    const resultText = screen.getByRole('dialog', { name: ROUND }).textContent;
    await reopenSaved(game); assertRound(expected); expect(screen.getByRole('dialog', { name: ROUND }).textContent).toBe(resultText);
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 240_000); // Three complete real life cases, reflection, optional approach and two full combat/save reductions.
});
