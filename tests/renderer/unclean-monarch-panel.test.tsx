/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UncleanMonarchPanel, type UncleanMonarchPanelProps } from '../../src/renderer/UncleanMonarchPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectUncleanMonarch } from '../../src/domain/unclean-monarch/index.js';
import type { UncleanMonarchAction, UncleanMonarchCommand, UncleanMonarchProjection } from '../../src/domain/unclean-monarch/types.js';
import type { UncleanMonarchCaseId } from '../../src/domain/unclean-monarch/life.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { um, originalBloodDuke, originalAbyssRoots, prepared, promoted, ready } from '../domain/unclean-monarch-directed-helper.js';

const PANEL = '污秽君王成长', ENTRY = '污秽君王与原安静室', CONFIRM = '污秽君王操作确认';
const BINDING = 'abyss.s1.impulse-binding', INTERFERENCE = 'abyss.s1.focused-interference';
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|阶段根|\b(?:OUTSIDE|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED|INHERITED_ONLY|IMPULSE_BINDING|FOCUSED_INTERFERENCE|SOURCE|ORDINARY)\b|"(?:command|before|playerEnergy)"\s*:/;
// originalBloodDuke migrates the genuine raw177 beforeLast at revision719,
// after exactly718 commands. The old724 terminal death is never revived.
// prepared/promoted are explicitly directed UNIT setups from the shared helper,
// not natural captures. All UI facts thereafter come from real public reducers
// and projections. No fabricated projection fields are passed to reducers.
const projection = (state = originalBloodDuke()) => projectUncleanMonarch(state);
function show(value = projection(), extra: Partial<UncleanMonarchPanelProps> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), props = { value, busy: false, onCommand, onClose, ...extra };
  return { ...render(<UncleanMonarchPanel {...props} />), props, onCommand, onClose };
}
const panel = () => screen.getByRole('region', { name: PANEL });
const primary = () => within(panel()).getByRole('region', { name: '当前主要操作' }).querySelector('button')!;
const picker = () => within(panel()).getByRole('combobox', { name: '污秽君王目标' });
const resources = () => within(panel()).getAllByRole('region', { name: '污秽君王当前资源' })[0]!;
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const confirm = (dialog = screen.getByRole('dialog', { name: CONFIRM })) => within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
function actualAction(value: UncleanMonarchProjection, predicate: (command: UncleanMonarchCommand) => boolean): UncleanMonarchAction {
  const action = value.actions.find(entry => entry.enabled && predicate(entry.command));
  if (!action) throw new Error('Expected a genuinely enabled projected action.');
  return action;
}
function openAction(action: UncleanMonarchAction) {
  const command = action.command, goal = 'caseId' in command ? command.caseId : 'bottleId' in command ? command.bottleId
    : ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'SET_COMBAT_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(command.type) ? 'encounter' : null;
  if (goal && !disabled(picker())) fireEvent.change(picker(), { target: { value: goal } });
  const buttons = () => within(panel()).queryAllByRole('button', { hidden: true }).filter(entry => entry.getAttribute('data-action-id') === action.id);
  if (buttons().length === 0) {
    const select = within(panel()).getByRole('combobox', { name: '污秽君王其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true; fireEvent.change(select, { target: { value: action.id } });
  }
  const matches = buttons(); expect(matches).toHaveLength(1);
  const button = matches[0]!; const fold = button.closest('details'); if (fold) fold.open = true;
  fireEvent.click(button); return screen.getByRole('dialog', { name: CONFIRM });
}
function perform(state: SliceState, ...commands: UncleanMonarchCommand[]) {
  for (const command of commands) state = um(state, command);
  assertValidSliceState(state); return state;
}
function readCase(state: SliceState, caseId: UncleanMonarchCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  // Request only this case's real budget; no global budget or old mastery edit.
  state = ready(state, { ap: 3, cash: 20, mind: 8, spirituality: 8 });
  state = perform(state, { type: 'OBSERVE', caseId }, { type: 'CONSENT', caseId, permission: 'OWNER' });
  if (method === 'ABILITY') state = um(state, { type: 'CONSENT', caseId, permission: 'ABILITY' });
  return perform(state, { type: 'PREPARE', caseId, method }, { type: 'WALK_TO_A', caseId },
    { type: 'TAKE_CARD', caseId }, { type: 'WALK_TO_B', caseId }, { type: 'READ_ORIGINAL', caseId });
}
function finishCase(state: SliceState, caseId: UncleanMonarchCaseId) {
  if (!state.uncleanMonarch.life.cases[caseId].attempts[0]!.stopped) state = um(state, { type: 'STOP_METHOD', caseId });
  state = perform(state, { type: 'RETURN_TO_A', caseId }, { type: 'RETURN_CARD', caseId },
    { type: 'RETURN_TO_ENTRY', caseId }, { type: 'RETURN_PIECE', caseId }, { type: 'LEAVE', caseId });
  return um(ready(state), { type: 'REPORT', caseId });
}
function ordinaryCase(state: SliceState, caseId: UncleanMonarchCaseId) {
  state = readCase(state, caseId, 'ORDINARY');
  return finishCase(um(state, { type: 'MANUAL_OPERATION', caseId }), caseId);
}
function practiced() {
  let state = promoted();
  for (const caseId of ['measured-reading', 'observed-tension', 'withdrawn-input'] as const) state = ordinaryCase(state, caseId);
  return um(ready(state), { type: 'REFLECT' });
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Unclean Monarch panel: original source, bottles and immutable body', () => {
  it('shows the current migrated living actual718 source without restoring the old terminal death', () => {
    const source = originalBloodDuke(); expect(source).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    const value = projection(source), before = structuredClone(value), ui = show(value);
    expect(resources().textContent).toContain('健康100/100 · 精神100/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('710便士 · 本周行动3 · 现有伤势0处 · 累计风险0');
    const originals = within(panel()).getByRole('region', { name: '污秽君王原人原物当前状态' });
    expect(originals.closest('details')).toBeNull();
    for (const fact of ['本人当前在原安静室门口', '累计普通步行96米，现场时钟317秒', '诺拉·温特 · 46岁，当前在四米处原桌', '累计本阶段协作耗力0/12', '罗安·费里当前在室外，累计实际步行24米', '原卡BL3-CARD在诺拉本人处，数量1，累计实际行程40米', '原铃BL3-BELL与原纸BL3-NOTE均在八米处原铃', '普通门路保持开放', '铃声排练累计记录2次', '旧恶魔负荷当前为3']) expect(originals.textContent).toContain(fact);
    expect(ui.container.textContent).not.toMatch(/精力|体力100|强制诊所|恢复满/);
    expect(within(picker()).getAllByRole('option')).toHaveLength(3); expect(ui.container.textContent).not.toMatch(editorial);
    expect(value).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('selects each real independent bottle without granting or consuming it', () => {
    const source = originalBloodDuke(), value = projection(source), ui = show(value);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    expect(within(panel()).getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[1]!.source);
    const saved = projection(um(source, { type: 'LEARN_GUIDANCE' })); ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />);
    expect((picker() as HTMLSelectElement).value).toBe(value.bottles[1]!.id); expect(ui.onCommand).not.toHaveBeenCalled();
    expect(within(panel()).getByRole('region', { name: '污秽君王服药准备' }).textContent).toContain('7200便士');
    expect(within(panel()).getByRole('region', { name: '污秽君王服药准备' }).textContent).toContain('1200便士');
  }, 30_000);

  it('confirms exactly the acquired directed-unit bottle and its actual failure cost once', () => {
    const value = projection(prepared()), before = structuredClone(value), ui = show(value);
    const action = actualAction(value, command => command.type === 'CONSUME'), dialog = openAction(action);
    const bottle = value.bottles.find(entry => action.command.type === 'CONSUME' && entry.id === action.command.bottleId)!;
    for (const fact of [bottle.source, `当前成功率${bottle.chance}%`, '健康−15', '精神−25', '成功与失败均实际耗尽这一瓶及本次准备', '原有十六项能力及其实际掌握保留', '两项新能力从0开始']) expect(dialog.textContent).toContain(fact);
    expect(ui.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command); expect(ui.onCommand.mock.calls[0]![0]).toBe(action.command); expect(value).toEqual(before);
  }, 30_000);

  it('retains a real directed-unit failed dose and spent preparation after committed facts arrive', () => {
    const source = prepared('FAILURE'), value = projection(source), action = actualAction(value, command => command.type === 'CONSUME'), ui = show(value);
    fireEvent.click(confirm(openAction(action))); ui.rerender(<UncleanMonarchPanel {...ui.props} error="保存中断" />);
    const failed = um(source, action.command), saved = projection(failed); expect(failed.progression.sequence).toBe(2);
    ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />);
    fireEvent.change(picker(), { target: { value: value.bottles[0]!.id } }); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    expect(within(panel()).getByRole('region', { name: '独立原药瓶' }).textContent).toContain(saved.bottles[0]!.status);
    expect(resources().textContent).toContain(`健康${failed.health}/100 · 精神${failed.mind}/100 · 灵性${failed.spirituality}/120 · 排异${failed.seer.pollution}`);
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('displays sixteen inherited masteries, four retained zeroes and two new zeroes after directed-unit promotion', () => {
    const source = promoted(), value = projection(source), ui = show(value), fold = within(panel()).getByText('能力、消化与继承经历').closest('details')!;
    fold.open = true; expect(value.abilities).toHaveLength(18); expect(value.abilities.slice(0, 16).filter(ability => ability.mastery === 0)).toHaveLength(4);
    expect(value.abilities.slice(16).map(ability => [ability.id, ability.mastery])).toEqual([[BINDING, 0], [INTERFERENCE, 0]]);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(originalAbyssRoots(source)).toEqual(originalAbyssRoots(originalBloodDuke())); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('keeps user-authored names literal, without rewriting them as editorial copy', () => {
    const value = projection(); value.characterName = '原创G候选'; value.appearanceRecord = '原创G候选保有自己的身份。';
    const ui = show(value); expect(resources().textContent).toContain('原创G候选'); expect(ui.container.textContent).toContain('原创G候选保有自己的身份。');
    expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});

describe('Unclean Monarch panel: confirmation and authoritative save locks', () => {
  it('contains keyboard focus and restores focus after cancellation or Escape without dispatch', () => {
    const ui = show(), button = primary(); fireEvent.click(button); const dialog = screen.getByRole('dialog', { name: CONFIRM });
    expect(document.activeElement).toBe(within(dialog).getAllByRole('heading')[0]); expect(button.closest('[inert]')).toBeTruthy(); expect(disabled(picker())).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(); expect(document.activeElement).toBe(button);
    fireEvent.click(button); fireEvent.keyDown(screen.getByRole('dialog', { name: CONFIRM }), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  }, 30_000);

  it('locks duplicate clicks, unchanged projections and dismissed errors until saved facts change', () => {
    const source = originalBloodDuke(), value = projection(source), ui = show(value), action = actualAction(value, command => command.type === 'LEARN_GUIDANCE');
    const dialog = openAction(action); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    ui.rerender(<UncleanMonarchPanel {...ui.props} value={structuredClone(value)} />); expect(disabled(primary())).toBe(true);
    ui.rerender(<UncleanMonarchPanel {...ui.props} error="保存中断" />); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    expect(within(panel()).getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(within(panel()).queryByRole('button', { name: /重试/ })).toBeNull();
    ui.rerender(<UncleanMonarchPanel {...ui.props} value={structuredClone(value)} />); expect(disabled(primary())).toBe(true);
    const saved = projection(um(source, action.command)); ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />);
    expect(disabled(primary())).toBe(false); expect(document.activeElement).toBe(within(panel()).getByRole('heading', { name: saved.title })); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('invalidates an unsubmitted confirmation after a newer authoritative save', () => {
    const source = originalBloodDuke(), ui = show(projection(source)); fireEvent.click(primary()); const stale = confirm();
    ui.rerender(<UncleanMonarchPanel {...ui.props} value={projection(um(source, { type: 'LEARN_GUIDANCE' }))} />); fireEvent.click(stale);
    expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks the explicitly malformed or unavailable presentation: %s', mode => {
    const value = projection(); if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const ui = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary());
    fireEvent.click(within(panel()).getByRole('button', { name: '返回普通生活' })); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  }, 30_000);

  it('shows the exact domain reason for an unavailable action without dispatching it', () => {
    const value = projection(um(originalBloodDuke(), { type: 'LEARN_GUIDANCE' })), ui = show(value);
    const unavailable = value.actions.find(action => !action.enabled && action.reason && action.command.type === 'PREPARE_PROMOTION')!;
    expect(unavailable).toBeTruthy(); const select = within(panel()).getByRole('combobox', { name: '污秽君王其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true; fireEvent.change(select, { target: { value: unavailable.id } });
    const button = within(panel()).getByRole('button', { name: name => name.startsWith(unavailable.label) }); expect(disabled(button)).toBe(true);
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(unavailable.reason); fireEvent.click(button); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});

describe('Unclean Monarch panel: real collaboration, one-use windows and ordinary return', () => {
  it('charges no invented energy for consent, then records only actual stage collaboration', () => {
    const caseId = 'measured-reading';
    let state = perform(ready(promoted(), { ap: 3, cash: 20 }), { type: 'OBSERVE', caseId },
      { type: 'CONSENT', caseId, permission: 'OWNER' }, { type: 'CONSENT', caseId, permission: 'ABILITY' });
    const before = structuredClone(state), ui = show(projection(state));
    expect(within(panel()).getByRole('region', { name: '污秽君王原人原物当前状态' }).textContent).toContain('累计本阶段协作耗力0/12');
    expect(state.uncleanMonarch.life.volunteerEffortSpent).toBe(0);
    state = perform(state, { type: 'PREPARE', caseId, method: 'ABILITY' }, { type: 'WALK_TO_A', caseId },
      { type: 'TAKE_CARD', caseId }, { type: 'WALK_TO_B', caseId }, { type: 'READ_ORIGINAL', caseId });
    const value = projection(state); ui.rerender(<UncleanMonarchPanel {...ui.props} value={value} />);
    expect(state.cash).toBe(before.cash - 20); expect(state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(state.uncleanMonarch.life.volunteerEffortSpent).toBe(3);
    expect(within(panel()).getByRole('region', { name: '污秽君王原人原物当前状态' }).textContent).toContain('累计本阶段协作耗力3/12');
    expect(value.life.site.volunteer).toEqual(before.uncleanMonarch.life.site.volunteer);
    expect(Object.hasOwn(value.life.site.volunteer, 'energy')).toBe(false);
    ui.rerender(<UncleanMonarchPanel {...ui.props} value={structuredClone(value)} />);
    expect(value.life.volunteerEffortSpent).toBe(3); expect(ui.container.textContent).not.toMatch(/精力|恢复满/);
    expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('allows ordinary cancellation before purchase without presenting it as a report', () => {
    const caseId = 'measured-reading', before = promoted(), state = um(before, { type: 'OBSERVE', caseId }), value = projection(state), ui = show(value);
    const action = actualAction(value, command => command.type === 'ABORT'), dialog = openAction(action);
    expect(dialog.textContent).toContain('即使尚未购买或本周行动用尽，也保留普通退路'); fireEvent.click(confirm(dialog));
    const stopped = um(state, action.command), saved = projection(stopped); ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />);
    expect(stopped.cash).toBe(before.cash); expect(stopped.actionsRemaining).toBe(state.actionsRemaining);
    expect(saved.life.pieces).toEqual([]); expect(saved.life.volunteerEffortSpent).toBe(0);
    expect(saved.life.cases.find(entry => entry.id === caseId)!.status).toBe('CANCELLED');
    expect(saved.actions.find(entry => entry.command.type === 'REPORT' && 'caseId' in entry.command && entry.command.caseId === caseId)?.enabled).not.toBe(true);
    expect(within(panel()).getByRole('button', { name: '返回普通生活' })).toBeTruthy(); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('shows real cast costs and zero mastery before application; only saved waits advance a successful window', () => {
    const caseId = 'measured-reading'; let state = um(readCase(promoted(), caseId), { type: 'NOTICE_IMPULSE', caseId });
    const before = structuredClone(state), value = projection(state), ui = show(value), action = actualAction(value, command => command.type === 'IMPULSE_BINDING');
    const dialog = openAction(action); for (const fact of ['8灵性', '2精神', '意志18', '20秒一次窗口', '失败总损失4精神']) expect(dialog.textContent).toContain(fact);
    fireEvent.click(confirm(dialog)); state = um(state, action.command); let saved = projection(state); ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />);
    const succeeded = ['SUCCESS', 'GREAT_SUCCESS'].includes(saved.life.currentAttempt!.castTier!);
    expect(state.spirituality).toBe(before.spirituality - 8); expect(state.mind).toBe(before.mind - (succeeded ? 2 : 4));
    expect(state.actionsRemaining).toBe(before.actionsRemaining); expect(state.progression.mastery[BINDING]).toBe(0);
    expect(saved.life.currentAttempt!.appliedAbilityIds).toEqual([]); expect(saved.life.pieces[0]).toMatchObject({ charges: 1, wear: 0 });
    expect(saved.life.clockSeconds).toBe(before.uncleanMonarch.life.site.clockSeconds + 1);
    const clock = () => within(panel()).getByRole('region', { name: '当前时钟与一次能力窗口' });
    const unchanged = clock().textContent; ui.rerender(<UncleanMonarchPanel {...ui.props} value={structuredClone(saved)} />); expect(clock().textContent).toBe(unchanged);
    if (saved.life.pending) {
      expect(clock().textContent).toContain('还剩20秒'); expect(clock().textContent).toContain('BL3-CARD');
      state = um(state, { type: 'WAIT_10', caseId }); saved = projection(state); ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />); expect(clock().textContent).toContain('还剩10秒');
      state = um(state, { type: 'WAIT_10', caseId }); saved = projection(state); ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />);
      expect(clock().textContent).toContain('当前没有尚未耗用的能力窗口'); expect(clock().textContent).toContain('已经到期');
      expect(saved.life.pieces[0]).toMatchObject({ charges: 1, wear: 0 });
    } else expect(clock().textContent).toContain('判定失败');
    expect(within(panel()).queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('shows the actual knowledge check and spent piece, without promising success or early mastery', () => {
    const caseId = 'measured-reading'; let state = perform(readCase(promoted(), caseId), { type: 'NOTICE_IMPULSE', caseId },
      { type: 'IMPULSE_BINDING', caseId }, { type: 'CHECK_ORIGINAL', caseId });
    const value = projection(state), attempt = value.life.currentAttempt!, applied = attempt.appliedAbilityIds.includes(BINDING), ui = show(value);
    expect(within(panel()).getByRole('region', { name: '有限作用与普通核对' }).textContent).toContain(`本次实际核对基础${attempt.checkBase}，其中冲动收束增加${attempt.checkBonus}`);
    expect(within(panel()).getByRole('region', { name: '本案的一次耗材' }).textContent).toContain(`剩余${applied ? 0 : 1}次，实际磨损${applied ? 1 : 0}`);
    expect(state.progression.mastery[BINDING]).toBe(0);
    if (!attempt.verified) state = um(state, { type: 'MANUAL_OPERATION', caseId });
    const closed = finishCase(state, caseId); ui.rerender(<UncleanMonarchPanel {...ui.props} value={projection(closed)} />); fireEvent.change(picker(), { target: { value: caseId } });
    expect(within(panel()).getByRole('region', { name: '本案的一次耗材' }).textContent).toContain('已经归还');
    expect(closed.progression.mastery[BINDING]).toBe(applied ? 8 : 0); expect(closed.uncleanMonarch.life.site.card.location).toBe('NORA');
    expect(originalAbyssRoots(closed)).toEqual(originalAbyssRoots(originalBloodDuke())); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('shows one real bell event and actual reduced pressure with no extra collaboration charge', () => {
    const caseId = 'observed-tension'; let state = readCase(ordinaryCase(promoted(), 'measured-reading'), caseId);
    const before = structuredClone(state); state = perform(state, { type: 'REHEARSE_BELL', caseId }, { type: 'CONFIRM_EMOTION', caseId },
      { type: 'FOCUSED_INTERFERENCE', caseId }, { type: 'PERFORM_OPERATION', caseId });
    const value = projection(state), attempt = value.life.currentAttempt!, ui = show(value);
    expect(value.life.volunteerEffortSpent).toBe(6); expect(value.life.volunteerEffortSpent).toBe(before.uncleanMonarch.life.volunteerEffortSpent);
    expect(value.life.operation.bellRehearsals).toBe(before.uncleanMonarch.life.operation.bellRehearsals + 1);
    expect(within(panel()).getByRole('region', { name: '有限作用与普通核对' }).textContent).toContain(`本次操作基准压力45，实际承受压力${attempt.feltPressure}`);
    expect(attempt.feltPressure).toBe(attempt.appliedAbilityIds.includes(INTERFERENCE) ? 15 : 45);
    expect(value.life.site.volunteer).toEqual(before.uncleanMonarch.life.site.volunteer); expect(value.life.pending).toBeNull(); expect(value.life.pulse?.resolved).toBe(true);
    expect(ui.container.textContent).not.toMatch(editorial); expect(state.progression.mastery[INTERFERENCE]).toBe(0);
  }, 30_000);

  it('withdraws before application, preserves paid costs and requires ordinary return of the same card', () => {
    const caseId = 'withdrawn-input'; let state = ordinaryCase(ordinaryCase(promoted(), 'measured-reading'), 'observed-tension');
    state = perform(readCase(state, caseId), { type: 'NOTICE_IMPULSE', caseId }, { type: 'IMPULSE_BINDING', caseId });
    const value = projection(state), ui = show(value), action = actualAction(value, command => command.type === 'WITHDRAW_CONSENT' && command.permission === 'ABILITY');
    const dialog = openAction(action); expect(dialog.textContent).toContain('撤回立即停止新施法并清除未用窗口'); fireEvent.click(confirm(dialog));
    const before = structuredClone(state); state = um(state, action.command); const saved = projection(state); ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />);
    expect(saved.life.pending).toBeNull(); expect(state.spirituality).toBe(before.spirituality); expect(state.mind).toBe(before.mind);
    expect(within(panel()).getByRole('region', { name: '本案的独立许可' }).textContent).toContain('有限能力用途的许可：已经撤回');
    expect(saved.life.pieces.find(piece => piece.caseId === caseId)).toMatchObject({ charges: 1, wear: 0, status: 'PLAYER' });
    expect(saved.life.site.card.location).toBe('PLAYER'); expect(saved.life.site.playerLocation).toBe('B');
    expect(within(panel()).queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    state = finishCase(um(state, { type: 'MANUAL_OPERATION', caseId }), caseId); ui.rerender(<UncleanMonarchPanel {...ui.props} value={projection(state)} />); fireEvent.change(picker(), { target: { value: caseId } });
    expect(within(panel()).getByRole('region', { name: '本案的一次耗材' }).textContent).toContain('已经归还');
    expect(state.progression.mastery[BINDING]).toBe(0); expect(state.progression.mastery[INTERFERENCE]).toBe(0);
    expect(state.uncleanMonarch.life.volunteerEffortSpent).toBe(9); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('keeps completed practice separate from the explicitly optional paid encounter', () => {
    const value = projection(practiced()), ui = show(value);
    expect(panel().querySelector('.seer-next')?.textContent).toContain('生活报告与反思已完成，可以返回普通生活');
    expect(within(panel()).queryByRole('region', { name: '污秽君王可选真实交战' })).toBeNull();
    expect(within(panel()).getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    fireEvent.change(picker(), { target: { value: 'encounter' } });
    expect(within(panel()).getByRole('region', { name: '污秽君王可选真实交战' }).textContent).toContain('哈伦·维斯 · 47岁');
    const wheel = within(panel()).getByRole('region', { name: '对手当前能力盘' });
    for (const entry of value.encounter.enemyAbilityWheel) expect(wheel.textContent).toContain(`${entry.label} · 权重${entry.weight}`);
    expect(within(panel()).getByRole('region', { name: '污秽君王战斗耗材' }).textContent).toContain('另付30便士、1行动');
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('uses current encounter positions, real Nora travel and a separate finite combat piece', () => {
    const before = ready(practiced(), { ap: 2, cash: 30 }), state = perform(before, { type: 'PREPARE_ENCOUNTER' }, { type: 'ENCOUNTER_TALK' }), value = projection(state), ui = show(value);
    expect(value.life.site).toEqual(state.uncleanMonarch.encounter.currentSite); expect(state.uncleanMonarch.life.site.playerLocation).toBe('START');
    expect(value.life.site.volunteer.location).toBe('OUTSIDE'); expect(value.life.site.card.location).toBe('NORA');
    expect(value.life.site.card.travelMetres).toBe(before.uncleanMonarch.life.site.card.travelMetres + 8);
    expect(value.life.site.playerTravelMetres).toBe(before.uncleanMonarch.life.site.playerTravelMetres + 4);
    expect(value.life.site.clockSeconds).toBe(before.uncleanMonarch.life.site.clockSeconds + 12);
    expect(within(panel()).getByRole('region', { name: '污秽君王原人原物当前状态' }).textContent).toContain('本人当前在相邻院落');
    expect(within(panel()).getByRole('region', { name: '污秽君王战斗耗材' }).textContent).toContain('UM1-COMBAT-PIECE：已实付30便士，当前由本人持有，剩余3/3次，实际磨损0');
    expect(within(panel()).getByRole('region', { name: '对手原棍与有限铭片' }).textContent).toContain('铭片剩余3/3枚');
    const policy = actualAction(value, command => command.type === 'SET_COMBAT_POLICY' && command.policy === 'ORDINARY'), dialog = openAction(policy);
    expect(dialog.textContent).toContain('本次明确选择：只作普通行动'); fireEvent.click(confirm(dialog)); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(policy.command);
    expect(originalAbyssRoots(state)).toEqual(originalAbyssRoots(originalBloodDuke())); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);
});

describe('Unclean Monarch panel: ordinary encounter departure', () => {
  it('confirms actual walking out without refunding the paid piece or moving Nora back inside', () => {
    const state = perform(ready(practiced(), { ap: 2, cash: 30 }), { type: 'PREPARE_ENCOUNTER' }, { type: 'ENCOUNTER_TALK' });
    const value = projection(state), ui = show(value), action = actualAction(value, command => command.type === 'LEAVE_ENCOUNTER');
    const dialog = openAction(action); expect(dialog.textContent).toContain('实走4米、经过4秒返回原门口'); fireEvent.click(confirm(dialog));
    const exited = um(state, action.command), saved = projection(exited); ui.rerender(<UncleanMonarchPanel {...ui.props} value={saved} />);
    expect(saved.life.site.playerLocation).toBe('START'); expect(saved.life.site.volunteer.location).toBe('OUTSIDE');
    expect(saved.life.site.card.location).toBe('NORA'); expect(saved.life.site.card.travelMetres).toBe(value.life.site.card.travelMetres);
    expect(saved.life.site.playerTravelMetres).toBe(value.life.site.playerTravelMetres + 4); expect(saved.life.site.clockSeconds).toBe(value.life.site.clockSeconds + 4);
    expect(exited.cash).toBe(state.cash); expect(exited.actionsRemaining).toBe(state.actionsRemaining);
    expect(saved.encounter.piece).toEqual(value.encounter.piece); expect(saved.encounter.plates).toEqual(value.encounter.plates);
    expect(within(panel()).getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);
});

// Only the IPC save boundary is controlled. Successful submissions run the
// real reducer and validator; held/failed saves leave the authoritative state
// intact. Remounting reloads that state. This is not Electron/SQLite evidence.
function savedGame(input: SliceState) {
  let state = structuredClone(input), commits = 0, failNext = false;
  let nextSaveBarrier: Promise<void> | null = null;
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    const barrier = nextSaveBarrier; nextSaveBarrier = null;
    if (barrier) await barrier;
    if (failNext) {
      failNext = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next);
    state = next; commits++;
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-16T04:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit,
    failNextSave() { failNext = true; },
    holdNextSave() {
      if (nextSaveBarrier) throw new Error('A save barrier is already pending.');
      let release = () => {};
      nextSaveBarrier = new Promise<void>(resolve => { release = resolve; });
      return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame, displayName?: string) {
  expect(game.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(game.state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  function projection() {
    const value = projectSliceState(game.state);
    // The separate literal-name renderer test changes public display fields
    // only. It does not modify the source save or send gameplay commands.
    if (displayName !== undefined) {
      value.character = { ...value.character, name: displayName };
      value.uncleanMonarch = { ...value.uncleanMonarch, characterName: displayName };
    }
    return value;
  }
  const value = projection();
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projection() }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
        portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
        revision: value.revision, updatedAt: '2026-10-16T04:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: value.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (value.combat ? screen.queryByRole('dialog', { name: value.combat.title! }) : null)
    ?? (value.ending ? screen.queryByRole('heading', { name: value.ending.title }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
}
async function reopen(game: SavedGame, displayName?: string) { cleanup(); await mount(game, displayName); }
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) {
    await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull());
  }
}
async function openPanel() {
  await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
async function closePanel() {
  await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })).toBeNull());
}
function assertSavedResourceText(state: SliceState) {
  const value = projectSliceState(state), current = resources();
  expect(current.textContent).toContain(`健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality} · 排异${value.uncleanMonarch.pollution}`);
  expect(current.textContent).toContain(`${value.uncleanMonarch.resources!.cash} · 本周行动${state.actionsRemaining} · 现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}

describe('Unclean Monarch saved campaign navigation and same-intent retry', () => {
  it('opens and closes the actual living source without moving original bodies or submitting', async () => {
    const source = originalBloodDuke(), game = savedGame(source); await mount(game); await acknowledgeRound(); await openPanel();
    assertSavedResourceText(source);
    expect(within(panel()).getByRole('region', { name: '污秽君王原人原物当前状态' }).textContent).toContain('累计普通步行96米，现场时钟317秒');
    await closePanel(); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const old = await screen.findByRole('region', { name: '鲜血大公成长' }); expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(within(old).getByRole('button', { name: '返回普通生活' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '鲜血大公成长' })).toBeNull()); await openPanel();
    assertSavedResourceText(source); expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it('routes S1 growth ahead of the historical Blood Duke page while retaining all old mastery and histories', async () => {
    const source = promoted(), game = savedGame(source), value = projectSliceState(source);
    expect(value.uncleanMonarch.promoted).toBe(true);
    // The historical promotion week is the inheritance evidence. A predecessor
    // public page's current-stage promoted flag is not that historical fact.
    expect(source.bloodDuke.promotionWeek).toBe(172); expect(source.progression.promotionWeek).toBe(5);
    await mount(game); await acknowledgeRound(); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    await screen.findByRole('region', { name: PANEL }); assertSavedResourceText(source);
    expect(screen.getByRole('banner').textContent).toContain(`${source.character.name} · ${value.uncleanMonarch.title}`);
    await closePanel();
    expect(value.bloodDuke.discovered).toBe(false); expect(value.bloodDuke.actions).toEqual([]);
    expect(screen.queryByRole('button', { name: '鲜血大公与原房约束' })).toBeNull();
    expect(screen.queryByRole('region', { name: '鲜血大公成长' })).toBeNull();
    await reopen(game); await acknowledgeRound(); await openPanel(); assertSavedResourceText(source);
    expect(originalAbyssRoots(game.state)).toEqual(originalAbyssRoots(originalBloodDuke())); expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled();
  }, 30_000);

  it('retries exactly the same failed paid envelope and waits for modal effects without double-charging', async () => {
    const source = originalBloodDuke(), command = { type: 'LEARN_GUIDANCE' } as const, intent: SliceIntent = { type: 'UNCLEAN_MONARCH', command };
    const expected = applySliceIntent(source, intent); assertValidSliceState(expected); const game = savedGame(source);
    const releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game); await acknowledgeRound(); await openPanel();
    const savedText = resources().textContent, savedOriginals = within(panel()).getByRole('region', { name: '污秽君王原人原物当前状态' }).textContent;
    const action = actualAction(projection(source), c => c.type === command.type), dialog = openAction(action), submit = confirm(dialog);
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, source, intent, 1);
    expect(resources().textContent).toBe(savedText); expect(within(dialog).getByRole('region', { name: '污秽君王当前资源' }).textContent).toBe(savedText);
    for (const button of within(dialog).getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(game.state).toEqual(source); expect(game.commits).toBe(0);
    await act(async () => { releaseFailure(); }); const retry = await screen.findByRole('button', { name: '重试这次操作' });
    // Wait for the confirmation-clearing effect, rather than treating the
    // appearance of the outer retry button as proof that the modal is gone.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(resources().textContent).toBe(savedText); expect(within(panel()).getByRole('region', { name: '污秽君王原人原物当前状态' }).textContent).toBe(savedOriginals);
    expect(disabled(picker())).toBe(true); for (const button of within(panel()).queryAllByRole('button')) expect(disabled(button)).toBe(true);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave(); fireEvent.click(retry); fireEvent.click(retry);
    assertEnvelope(game, source, intent, 2); expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); expect(game.state).toEqual(source);
    await act(async () => { releaseSuccess(); }); await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    assertSavedResourceText(expected); expect(game.state).toEqual(expected); expect(game.commits).toBe(1);
    expect(game.state.cash).toBe(source.cash - 500); expect(game.state.actionsRemaining).toBe(source.actionsRemaining - 1);
    expect(game.state.health).toBe(source.health); expect(game.state.mind).toBe(source.mind); expect(game.state.injuries).toEqual(source.injuries);
    expect(originalAbyssRoots(game.state)).toEqual(originalAbyssRoots(source));
    await reopen(game); await acknowledgeRound(); await openPanel(); assertSavedResourceText(expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 30_000);
});
