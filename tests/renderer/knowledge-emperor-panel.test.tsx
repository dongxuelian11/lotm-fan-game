/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnowledgeEmperorPanel, type KnowledgeEmperorPanelProps } from '../../src/renderer/KnowledgeEmperorPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectKnowledgeEmperor } from '../../src/domain/knowledge-emperor/index.js';
import type { KnowledgeEmperorAction, KnowledgeEmperorCommand, KnowledgeEmperorProjection } from '../../src/domain/knowledge-emperor/types.js';
import type { KnowledgeEmperorCaseId } from '../../src/domain/knowledge-emperor/life.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { ke, originalSage, originalHermitRoots, prepared, promoted, ready } from '../domain/knowledge-emperor-directed-helper.js';

const PANEL = '知识皇帝成长', ENTRY = '知识皇帝与原档室', CONFIRM = '知识皇帝操作确认';
const KP = 'hermit.s1.knowledge-power', PK = 'hermit.s1.power-knowledge';
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|阶段根|\b(?:OUTSIDE|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED|INHERITED_ONLY|KNOWLEDGE_POWER|POWER_KNOWLEDGE|ORDINARY)\b|"(?:command|before|playerEnergy)"\s*:/;
// originalSage is the unchanged actual651 input after real product migration.
// prepared/promoted are explicitly directed UNIT setups from the shared helper,
// not natural captures. All UI facts thereafter come from real public reducers
// and projections. No fabricated projection fields are passed to reducers.
const projection = (state = originalSage()) => projectKnowledgeEmperor(state);
function show(value = projection(), extra: Partial<KnowledgeEmperorPanelProps> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), props = { value, busy: false, onCommand, onClose, ...extra };
  return { ...render(<KnowledgeEmperorPanel {...props} />), props, onCommand, onClose };
}
const panel = () => screen.getByRole('region', { name: PANEL });
const primary = () => within(panel()).getByRole('region', { name: '当前主要操作' }).querySelector('button')!;
const picker = () => within(panel()).getByRole('combobox', { name: '知识皇帝目标' });
const resources = () => within(panel()).getAllByRole('region', { name: '知识皇帝当前资源' })[0]!;
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
const confirm = (dialog = screen.getByRole('dialog', { name: CONFIRM })) => within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
function actualAction(value: KnowledgeEmperorProjection, predicate: (command: KnowledgeEmperorCommand) => boolean): KnowledgeEmperorAction {
  const action = value.actions.find(entry => entry.enabled && predicate(entry.command));
  if (!action) throw new Error('Expected a genuinely enabled projected action.');
  return action;
}
function openAction(action: KnowledgeEmperorAction) {
  const command = action.command, goal = 'caseId' in command ? command.caseId : 'bottleId' in command ? command.bottleId
    : ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'SET_COMBAT_POLICY', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(command.type) ? 'encounter' : null;
  if (goal && !disabled(picker())) fireEvent.change(picker(), { target: { value: goal } });
  const buttons = () => within(panel()).queryAllByRole('button', { hidden: true }).filter(entry => entry.getAttribute('data-action-id') === action.id);
  if (buttons().length === 0) {
    const select = within(panel()).getByRole('combobox', { name: '知识皇帝其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true; fireEvent.change(select, { target: { value: action.id } });
  }
  const matches = buttons(); expect(matches).toHaveLength(1);
  const button = matches[0]!; const fold = button.closest('details'); if (fold) fold.open = true;
  fireEvent.click(button); return screen.getByRole('dialog', { name: CONFIRM });
}
function perform(state: SliceState, ...commands: KnowledgeEmperorCommand[]) {
  for (const command of commands) state = ke(state, command);
  assertValidSliceState(state); return state;
}
function readyScene(state: SliceState) {
  state = ready(state, { ap: 3, cash: 200, health: 80, mind: 40, spirituality: 30 });
  while (state.knowledgeEmperor.life.site.playerEnergy < 48) state = ke(ready(state, { ap: 3, cash: 200 }), { type: 'RECOVER_ENERGY' });
  return state;
}
function copiedCase(state: SliceState, caseId: KnowledgeEmperorCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  state = perform(readyScene(state), { type: 'OBSERVE', caseId }, { type: 'CONSENT', caseId, permission: 'OWNER' });
  if (method === 'ABILITY') state = ke(state, { type: 'CONSENT', caseId, permission: 'ABILITY' });
  return perform(state, { type: 'PREPARE', caseId, method }, { type: 'APPROACH', caseId }, { type: 'WALK_TO_A', caseId },
    { type: 'WALK_TO_B', caseId }, { type: 'READ_ORIGINAL', caseId }, { type: 'COPY_NOTE', caseId });
}
function finishCase(state: SliceState, caseId: KnowledgeEmperorCaseId) {
  state = perform(state, { type: 'RETURN_TO_A', caseId }, { type: 'RETURN_TO_ENTRY', caseId }, { type: 'LEAVE', caseId }, { type: 'RETURN_NOTE', caseId });
  return ke(ready(state), { type: 'REPORT', caseId });
}
function ordinaryCase(state: SliceState, caseId: KnowledgeEmperorCaseId) {
  state = copiedCase(state, caseId, 'ORDINARY');
  state = ke(state, caseId === 'knowledge-power' ? { type: 'APPLY_POWER', caseId }
    : caseId === 'power-knowledge' ? { type: 'VERIFY_REACTION', caseId } : { type: 'WITHDRAW_CONSENT', caseId, permission: 'OWNER' });
  return finishCase(state, caseId);
}
function practiced() {
  let state = promoted();
  for (const caseId of ['knowledge-power', 'power-knowledge', 'withdrawn-consent'] as const) state = ordinaryCase(state, caseId);
  return readyScene(ke(ready(state), { type: 'REFLECT' }));
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

describe('Knowledge Emperor panel: original source, bottles and immutable body', () => {
  it('shows current migrated actual651 wounded source and current outside site without restoring a historical scene', () => {
    const source = originalSage(); expect(source).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    const value = projection(source), before = structuredClone(value), ui = show(value);
    expect(resources().textContent).toContain('健康40/100 · 精神98/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('770便士 · 本周行动3 · 现有伤势2处 · 累计风险1');
    expect(resources().textContent).toContain('伤势1：重伤 · 尚未治疗'); expect(resources().textContent).toContain('伤势2：重伤 · 尚未治疗');
    const originals = within(panel()).getByRole('region', { name: '知识皇帝原人原物当前状态' });
    expect(originals.closest('details')).toBeNull();
    for (const fact of ['本人当前在室外，精力30/100', '累计普通步行66米，现场时钟510秒', '艾瑞丝·沃德 · 49岁，当前在室外，独立精力78/100', '原记录页PM3-BOUNDARY-RECORD在原物主处，实际行程72米', '实际阅读2次，已核验2次', '已有实际通行2次', 'SG2-KIT-1已归还', '实际磨损4']) expect(originals.textContent).toContain(fact);
    expect(within(picker()).getAllByRole('option')).toHaveLength(3); expect(ui.container.textContent).not.toMatch(editorial);
    expect(value).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('selects each real independent bottle without granting or consuming it', () => {
    const source = originalSage(), value = projection(source), ui = show(value);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    expect(within(panel()).getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[1]!.source);
    const saved = projection(ke(source, { type: 'LEARN_GUIDANCE' })); ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={saved} />);
    expect((picker() as HTMLSelectElement).value).toBe(value.bottles[1]!.id); expect(ui.onCommand).not.toHaveBeenCalled();
    expect(within(panel()).getByRole('region', { name: '知识皇帝服药准备' }).textContent).toContain('7200便士');
    expect(within(panel()).getByRole('region', { name: '知识皇帝服药准备' }).textContent).toContain('1200便士');
  }, 30_000);

  it('confirms exactly the acquired directed-unit bottle and its actual failure cost once', () => {
    const value = projection(prepared()), before = structuredClone(value), ui = show(value);
    const action = actualAction(value, command => command.type === 'CONSUME'), dialog = openAction(action);
    const bottle = value.bottles.find(entry => action.command.type === 'CONSUME' && entry.id === action.command.bottleId)!;
    for (const fact of [bottle.source, `当前成功率${bottle.chance}%`, '健康−15', '精神−25', '成功与失败均实际耗尽这一瓶及本次准备', '原有十三项能力及其实际掌握保留', '两项新能力从0开始']) expect(dialog.textContent).toContain(fact);
    expect(ui.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command); expect(ui.onCommand.mock.calls[0]![0]).toBe(action.command); expect(value).toEqual(before);
  }, 30_000);

  it('retains a real directed-unit failed dose, injury and spent preparation after committed facts arrive', () => {
    const source = prepared('FAILURE'), value = projection(source), action = actualAction(value, command => command.type === 'CONSUME'), ui = show(value);
    fireEvent.click(confirm(openAction(action))); ui.rerender(<KnowledgeEmperorPanel {...ui.props} error="保存中断" />);
    const failed = ke(source, action.command), saved = projection(failed); expect(failed.progression.sequence).toBe(2);
    ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={saved} />);
    fireEvent.change(picker(), { target: { value: value.bottles[0]!.id } }); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    expect(within(panel()).getByRole('region', { name: '独立原药瓶' }).textContent).toContain(saved.bottles[0]!.status);
    expect(resources().textContent).toContain(`健康${failed.health}/100 · 精神${failed.mind}/100 · 灵性${failed.spirituality}/120 · 排异${failed.seer.pollution}`);
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('displays thirteen inherited masteries, three retained zeroes and two new zeroes after directed-unit promotion', () => {
    const source = promoted(), value = projection(source), ui = show(value), fold = within(panel()).getByText('能力、消化与继承经历').closest('details')!;
    fold.open = true; expect(value.abilities).toHaveLength(15); expect(value.abilities.slice(0, 13).filter(ability => ability.mastery === 0)).toHaveLength(3);
    expect(value.abilities.slice(13).map(ability => [ability.id, ability.mastery])).toEqual([[KP, 0], [PK, 0]]);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(originalHermitRoots(source)).toEqual(originalHermitRoots(originalSage())); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('keeps user-authored names literal, without rewriting them as editorial copy', () => {
    const value = projection(); value.characterName = '原创G候选'; value.appearanceRecord = '原创G候选保有自己的身份。';
    const ui = show(value); expect(resources().textContent).toContain('原创G候选'); expect(ui.container.textContent).toContain('原创G候选保有自己的身份。');
    expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});

describe('Knowledge Emperor panel: confirmation and authoritative save locks', () => {
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
    const source = originalSage(), value = projection(source), ui = show(value), action = actualAction(value, command => command.type === 'LEARN_GUIDANCE');
    const dialog = openAction(action); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={structuredClone(value)} />); expect(disabled(primary())).toBe(true);
    ui.rerender(<KnowledgeEmperorPanel {...ui.props} error="保存中断" />); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    expect(within(panel()).getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(within(panel()).queryByRole('button', { name: /重试/ })).toBeNull();
    ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={structuredClone(value)} />); expect(disabled(primary())).toBe(true);
    const saved = projection(ke(source, action.command)); ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={saved} />);
    expect(disabled(primary())).toBe(false); expect(document.activeElement).toBe(within(panel()).getByRole('heading', { name: saved.title })); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('invalidates an unsubmitted confirmation after a newer authoritative save', () => {
    const source = originalSage(), ui = show(projection(source)); fireEvent.click(primary()); const stale = confirm();
    ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={projection(ke(source, { type: 'LEARN_GUIDANCE' }))} />); fireEvent.click(stale);
    expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks the explicitly malformed or unavailable presentation: %s', mode => {
    const value = projection(); if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const ui = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary());
    fireEvent.click(within(panel()).getByRole('button', { name: '返回普通生活' })); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  }, 30_000);

  it('shows the exact domain reason for an unavailable action without dispatching it', () => {
    const value = projection(ke(originalSage(), { type: 'LEARN_GUIDANCE' })), ui = show(value);
    const unavailable = value.actions.find(action => !action.enabled && action.reason && action.command.type === 'PREPARE_PROMOTION')!;
    expect(unavailable).toBeTruthy(); const select = within(panel()).getByRole('combobox', { name: '知识皇帝其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true; fireEvent.change(select, { target: { value: unavailable.id } });
    const button = within(panel()).getByRole('button', { name: name => name.startsWith(unavailable.label) }); expect(disabled(button)).toBe(true);
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(unavailable.reason); fireEvent.click(button); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});

describe('Knowledge Emperor panel: finite original-page practice and actual return', () => {
  it('keeps cast costs, exact source and zero mastery before application; only saved waits advance the window', () => {
    let source = copiedCase(promoted(), 'knowledge-power'); const value = projection(source), ui = show(value);
    const action = actualAction(value, command => command.type === 'KNOWLEDGE_POWER'), dialog = openAction(action);
    expect(dialog.textContent).toContain('8灵性'); expect(dialog.textContent).toContain('2精神'); fireEvent.click(confirm(dialog));
    const before = source; source = ke(source, action.command); let saved = projection(source); ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={saved} />);
    expect(source.spirituality).toBe(before.spirituality - 8); expect(source.mind).toBe(before.mind - 2); expect(source.actionsRemaining).toBe(before.actionsRemaining);
    expect(source.knowledgeEmperor.life.site.clockSeconds).toBe(before.knowledgeEmperor.life.site.clockSeconds + 1);
    expect(saved.life.currentAttempt!.appliedAbilityIds).toEqual([]); expect(source.progression.mastery[KP]).toBe(0);
    const clock = () => within(panel()).getByRole('region', { name: '当前时钟与一次能力窗口' });
    if (saved.life.pending) {
      expect(clock().textContent).toContain('还剩20秒'); const unchanged = clock().textContent;
      ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={structuredClone(saved)} />); expect(clock().textContent).toBe(unchanged);
      source = ke(source, { type: 'WAIT_10', caseId: 'knowledge-power' }); saved = projection(source); ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={saved} />); expect(clock().textContent).toContain('还剩10秒');
      source = ke(source, { type: 'WAIT_10', caseId: 'knowledge-power' }); ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={projection(source)} />);
      expect(clock().textContent).toContain('当前没有尚未耗用的能力窗口'); expect(clock().textContent).toContain('已经到期');
    } else expect(clock().textContent).toContain('判定失败');
    expect(within(panel()).queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('shows the same paid substrate, one spent charge and the actual measured result without inventing success', () => {
    const caseId = 'knowledge-power', before = copiedCase(promoted(), caseId);
    const source = perform(before, { type: 'KNOWLEDGE_POWER', caseId }, { type: 'APPLY_POWER', caseId });
    const value = projection(source), attempt = value.life.currentAttempt!, ui = show(value);
    const note = within(panel()).getByRole('region', { name: '同一纸张与有限记录' });
    for (const fact of ['KE1-PAPER-1已经亲手抄成KE1-NOTE-1', '数量1，已实付20便士', '剩余0次，实际磨损1', '第三格原盒已经盖好', '缺失正文仍然未知']) expect(note.textContent).toContain(fact);
    expect(within(panel()).getByRole('region', { name: '知识赋力的实际测量' }).textContent).toContain(`记录基准3，实测稳定度${attempt.measuredStabilization}`);
    expect(attempt.measuredStabilization).toBe(attempt.appliedAbilityIds.includes(KP) ? 6 : 3);
    expect(source.progression.mastery[KP]).toBe(0); expect(originalHermitRoots(source)).toEqual(originalHermitRoots(originalSage()));
    const reported = finishCase(source, caseId); ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={projection(reported)} />);
    fireEvent.change(picker(), { target: { value: caseId } });
    expect(within(panel()).getByRole('region', { name: '同一纸张与有限记录' }).textContent).toContain('已经归还，当前在原物主处，剩余0次，实际磨损1');
    expect(reported.progression.mastery[KP]).toBe(attempt.appliedAbilityIds.includes(KP) ? 8 : 0); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('shows a real four-spirituality force source separately from the eight-spirituality check and actual owner travel', () => {
    let source = ordinaryCase(promoted(), 'knowledge-power'); source = copiedCase(source, 'power-knowledge');
    const before = source; source = perform(source, { type: 'SPEND_FORCE', caseId: 'power-knowledge' }, { type: 'POWER_KNOWLEDGE', caseId: 'power-knowledge' }, { type: 'VERIFY_REACTION', caseId: 'power-knowledge' });
    const value = projection(source), ui = show(value), attempt = value.life.currentAttempt!;
    expect(source.spirituality).toBe(before.spirituality - 12); expect(source.mind).toBe(before.mind - 2); expect(attempt.forceSpiritualitySpent).toBe(4); expect(attempt.checkSpiritualitySpent).toBe(8);
    const force = within(panel()).getByRole('region', { name: '循力求知的实际来源' });
    for (const fact of ['KE1-FORCE-2', '实耗4灵性', '推力6，纸缘实际位移1毫米', '能力检定实耗8灵性，原推力另实耗4灵性', attempt.observedReaction!]) expect(force.textContent).toContain(fact);
    expect(within(panel()).getByRole('region', { name: '同一纸张与有限记录' }).textContent).toContain('剩余0次，实际磨损2');
    expect(within(panel()).getByRole('region', { name: '实际位置与普通退出' }).textContent).toContain('原物主实走12米');
    expect(value.life.site.iris?.location).toBe('B'); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('withdraws new consent without refund or fake failure reset and still requires the same note to return', () => {
    let source = ordinaryCase(ordinaryCase(promoted(), 'knowledge-power'), 'power-knowledge');
    source = copiedCase(source, 'withdrawn-consent'); source = ke(source, { type: 'KNOWLEDGE_POWER', caseId: 'withdrawn-consent' });
    const before = source, value = projection(source), ui = show(value), action = actualAction(value, command => command.type === 'WITHDRAW_CONSENT' && command.permission === 'ABILITY');
    const dialog = openAction(action); expect(dialog.textContent).toContain('撤回立即停止新施法并清除未用窗口'); fireEvent.click(confirm(dialog));
    source = ke(source, action.command); const saved = projection(source); ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={saved} />);
    expect(saved.life.pending).toBeNull(); expect(source.spirituality).toBe(before.spirituality); expect(source.mind).toBe(before.mind);
    expect(within(panel()).getByRole('region', { name: '本案的独立许可' }).textContent).toContain('有限能力用途的许可：已经撤回');
    expect(saved.life.currentAttempt!.appliedAbilityIds).toEqual([]); expect(saved.life.notes.find(note => note.caseId === 'withdrawn-consent')!.charges).toBe(1);
    expect(within(panel()).queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    const reported = finishCase(source, 'withdrawn-consent'); ui.rerender(<KnowledgeEmperorPanel {...ui.props} value={projection(reported)} />);
    fireEvent.change(picker(), { target: { value: 'withdrawn-consent' } });
    expect(within(panel()).getByRole('region', { name: '同一纸张与有限记录' }).textContent).toContain('已经归还，当前在原物主处，剩余1次，实际磨损0');
    expect(reported.progression.mastery[KP]).toBe(0); expect(reported.progression.mastery[PK]).toBe(0); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('uses the encounter continuation for current positions and separately paid combat note without restoring life history', () => {
    const closed = practiced(), source = perform(closed, { type: 'PREPARE_ENCOUNTER' }, { type: 'ENCOUNTER_TALK' }), value = projection(source), ui = show(value);
    // Only the private ancestry snapshot is omitted from the public current site.
    const { source: privateSource, ...publicSite } = source.knowledgeEmperor.encounter.currentSite!;
    expect(privateSource).toBeDefined(); expect(value.life.site).toEqual(publicSite);
    expect(Object.hasOwn(value.life.site, 'source')).toBe(false); expect(source.knowledgeEmperor.life.site.playerLocation).toBe('OUTSIDE');
    expect(within(panel()).getByRole('region', { name: '知识皇帝原人原物当前状态' }).textContent).toContain('本人当前在独立阅览院');
    expect(within(panel()).getByRole('region', { name: '知识皇帝战斗笔记' }).textContent).toContain('KE1-COMBAT-NOTE：已实付30便士，当前由本人持有，剩余3/3次，实际磨损0');
    const enemy = within(panel()).getByRole('region', { name: '知识皇帝可选真实交战' });
    expect(enemy.textContent).toContain('达里安·洛克 · 44岁；健康100/100、精神100/100、独立灵性120/120');
    expect(enemy.textContent).toContain('印记剩余3/3枚'); expect(enemy.textContent).toContain('尚无对手实际消耗力量的凭据');
    const policy = actualAction(value, command => command.type === 'SET_COMBAT_POLICY' && command.policy === 'ORDINARY'), dialog = openAction(policy);
    expect(dialog.textContent).toContain('本次明确选择：只作普通行动'); fireEvent.click(confirm(dialog)); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(policy.command);
    expect(originalHermitRoots(source)).toEqual(originalHermitRoots(originalSage())); expect(ui.container.textContent).not.toMatch(editorial);
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
      committedAt: '2026-10-15T23:00:00Z', replayed: false, state: projectSliceState(state) } };
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
      value.knowledgeEmperor = { ...value.knowledgeEmperor, characterName: displayName };
    }
    return value;
  }
  const value = projection();
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projection() }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
        portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
        revision: value.revision, updatedAt: '2026-10-15T23:00:00Z' }],
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
  expect(current.textContent).toContain(`健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality} · 排异${value.knowledgeEmperor.pollution}`);
  expect(current.textContent).toContain(`${value.knowledgeEmperor.resources!.cash} · 本周行动${state.actionsRemaining} · 现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}

describe('Knowledge Emperor saved campaign navigation and same-intent retry', () => {
  it('opens and really closes the actual source without moving bodies, changing resource history or submitting', async () => {
    const source = originalSage(), game = savedGame(source); await mount(game); await acknowledgeRound(); await openPanel();
    assertSavedResourceText(source);
    expect(within(panel()).getByRole('region', { name: '知识皇帝原人原物当前状态' }).textContent).toContain('本人当前在室外，精力30/100，累计普通步行66米，现场时钟510秒');
    await closePanel(); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '贤者' })).toBeTruthy(); expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭贤者页面' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '贤者' })).toBeNull()); await openPanel();
    assertSavedResourceText(source); expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it('routes promoted S1 growth ahead of historical Sage and keeps old actions read-only across reopening', async () => {
    const source = promoted(), game = savedGame(source), value = projectSliceState(source);
    expect(value.knowledgeEmperor.promoted).toBe(true); expect(value.sage.promoted).toBe(true);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ })); await screen.findByRole('region', { name: PANEL }); assertSavedResourceText(source);
    expect(screen.getByRole('banner').textContent).toContain(`${source.character.name} · ${value.knowledgeEmperor.title}`);
    await closePanel(); await userEvent.click(screen.getByRole('button', { name: '贤者与档案灾难' }));
    const historical = await screen.findByRole('region', { name: '贤者' }); expect(value.sage.actions).toEqual([]);
    expect(within(historical).getByRole('region', { name: '贤者当前行动' }).querySelector('button')).toBeNull();
    await userEvent.click(within(historical).getByRole('button', { name: '关闭贤者页面' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: '贤者' })).toBeNull());
    await reopen(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull(); await openPanel(); assertSavedResourceText(source);
    expect(originalHermitRoots(game.state)).toEqual(originalHermitRoots(originalSage())); expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled();
  }, 30_000);

  it('retries the same failed paid intent once while preserving the last committed projection and preventing double cost', async () => {
    const source = originalSage(), command = { type: 'LEARN_GUIDANCE' } as const, intent: SliceIntent = { type: 'KNOWLEDGE_EMPEROR', command };
    const expected = applySliceIntent(source, intent); assertValidSliceState(expected); const game = savedGame(source);
    const releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game); await acknowledgeRound(); await openPanel();
    const savedText = resources().textContent, savedOriginals = within(panel()).getByRole('region', { name: '知识皇帝原人原物当前状态' }).textContent;
    const action = actualAction(projection(source), c => c.type === command.type), dialog = openAction(action), submit = confirm(dialog);
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, source, intent, 1);
    expect(resources().textContent).toBe(savedText); expect(within(dialog).getByRole('region', { name: '知识皇帝当前资源' }).textContent).toBe(savedText);
    for (const button of within(dialog).getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(game.state).toEqual(source); expect(game.commits).toBe(0);
    await act(async () => { releaseFailure(); }); const retry = await screen.findByRole('button', { name: '重试这次操作' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(resources().textContent).toBe(savedText); expect(within(panel()).getByRole('region', { name: '知识皇帝原人原物当前状态' }).textContent).toBe(savedOriginals);
    expect(disabled(picker())).toBe(true); for (const button of within(panel()).queryAllByRole('button')) expect(disabled(button)).toBe(true);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave(); fireEvent.click(retry); fireEvent.click(retry);
    assertEnvelope(game, source, intent, 2); expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); expect(game.state).toEqual(source);
    await act(async () => { releaseSuccess(); }); await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    assertSavedResourceText(expected); expect(game.state).toEqual(expected); expect(game.commits).toBe(1);
    expect(game.state.cash).toBe(source.cash - 500); expect(game.state.actionsRemaining).toBe(source.actionsRemaining - 1);
    expect(game.state.health).toBe(source.health); expect(game.state.mind).toBe(source.mind); expect(game.state.injuries).toEqual(source.injuries);
    expect(originalHermitRoots(game.state)).toEqual(originalHermitRoots(source));
    await reopen(game); await acknowledgeRound(); await openPanel(); assertSavedResourceText(expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 30_000);
});
