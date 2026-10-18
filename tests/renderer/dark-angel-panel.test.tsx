/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DarkAngelPanel, type DarkAngelPanelProps } from '../../src/renderer/DarkAngelPanel.js';
import { projectDarkAngel } from '../../src/domain/dark-angel/index.js';
import type { DarkAngelAction, DarkAngelCommand, DarkAngelProjection } from '../../src/domain/dark-angel/types.js';
import type { DarkAngelCaseId } from '../../src/domain/dark-angel/life.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { assertValidSliceState } from '../../src/domain/slice/index.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { da, originalElder, originalHangedManRoots, prepared, promoted, ready } from '../domain/dark-angel-directed-helper.js';

const PANEL = '暗天使成长', CONFIRM = '暗天使操作确认';
const GUIDANCE = 'hanged-man.s1.single-spirit-guidance', SHELTER = 'hanged-man.s1.single-spirit-shelter';
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|阶段根|\b(?:OUTSIDE|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED|INHERITED_ONLY|GUIDANCE|SHELTER|ORDINARY|SIGNAL|BRIEF_WARD|GRAZED|INTERNAL)\b|"(?:command|before|playerEnergy)"\s*:/;
// The actual immutable 615-command source is migrated by originalElder. The
// helper's promoted/prepared paths are explicitly directed UNIT setups, never
// natural captures. Later case scenes use public commands and actual resources.
const projection = (state = originalElder()) => projectDarkAngel(state);
function show(value = projection(), extra: Partial<DarkAngelPanelProps> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn(), props = { value, busy: false, onCommand, onClose, ...extra };
  return { ...render(<DarkAngelPanel {...props} />), props, onCommand, onClose };
}
const panel = () => screen.getByRole('region', { name: PANEL });
const primary = () => within(panel()).getByRole('region', { name: '当前主要操作' }).querySelector('button')!;
const picker = () => within(panel()).getByRole('combobox', { name: '暗天使目标' });
const resources = () => within(panel()).getAllByRole('region', { name: '暗天使当前资源' })[0]!;
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const confirm = (dialog = screen.getByRole('dialog', { name: CONFIRM })) => within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
function actionFor(value: DarkAngelProjection, predicate: (command: DarkAngelCommand) => boolean): DarkAngelAction {
  const found = value.actions.find(action => action.enabled && predicate(action.command));
  if (!found) throw new Error('Expected a genuinely enabled projected action.');
  return found;
}
function openAction(action: DarkAngelAction) {
  const command = action.command, goal = 'caseId' in command ? command.caseId : 'bottleId' in command ? command.bottleId
    : ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'SET_COMBAT_POLICY', 'SET_COMBAT_SPIRIT', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(command.type) ? 'encounter' : null;
  if (goal && !disabled(picker())) fireEvent.change(picker(), { target: { value: goal } });
  const buttons = () => within(panel()).queryAllByRole('button', { hidden: true }).filter(button => button.getAttribute('data-action-id') === action.id);
  if (!buttons().length) {
    const select = within(panel()).getByRole('combobox', { name: '暗天使其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true;
    fireEvent.change(select, { target: { value: action.id } });
  }
  expect(buttons()).toHaveLength(1);
  const button = buttons()[0]!, fold = button.closest('details'); if (fold) fold.open = true;
  fireEvent.click(button); return screen.getByRole('dialog', { name: CONFIRM });
}
function perform(state: SliceState, ...commands: DarkAngelCommand[]) {
  for (const command of commands) state = da(state, command);
  assertValidSliceState(state); return state;
}
function atSeal(state: SliceState, caseId: DarkAngelCaseId = 'guided-reading', method: 'ABILITY' | 'ORDINARY' = 'ABILITY') {
  // One actual case needs observe, prepare and report; no resource reset occurs
  // inside the scene, and no old spirit/mastery is edited for a test outcome.
  state = ready(state, { ap: 3, cash: 20, mind: 8, spirituality: 8 });
  state = perform(state, { type: 'OBSERVE', caseId }, { type: 'CONSENT', caseId, permission: 'OWNER' });
  if (method === 'ABILITY') state = da(state, { type: 'CONSENT', caseId, permission: 'ABILITY' });
  return perform(state, { type: 'PREPARE', caseId, method }, { type: 'WALK_TO_A', caseId }, { type: 'TAKE_CARD', caseId }, { type: 'WALK_TO_B', caseId });
}
function finish(state: SliceState, caseId: DarkAngelCaseId) {
  return perform(state, { type: 'RETURN_TO_A', caseId }, { type: 'RETURN_CARD', caseId }, { type: 'RETURN_TO_ENTRY', caseId },
    { type: 'RETURN_STRIP', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId });
}
function ordinaryCase(state: SliceState, caseId: DarkAngelCaseId) {
  state = atSeal(state, caseId, 'ORDINARY'); state = da(state, { type: 'READ_ORIGINAL', caseId });
  if (caseId === 'guarded-pulse') state = da(state, { type: 'PERFORM_OPERATION', caseId });
  return finish(state, caseId);
}
function practiced() {
  let state = promoted();
  for (const caseId of ['guided-reading', 'guarded-pulse', 'withdrawn-guidance'] as const) state = ordinaryCase(state, caseId);
  return da(ready(state), { type: 'REFLECT' });
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Dark Angel panel: original court, wounds and finite sources', () => {
  it('shows the migrated actual615 body, two original spirits and current court without resetting anything', () => {
    const source = originalElder(); expect(source).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    const value = projection(source), before = structuredClone(value), ui = show(value);
    expect(resources().textContent).toContain('健康60/100 · 精神94/100 · 灵性118/120');
    expect(resources().textContent).toContain('818便士 · 本周行动3 · 现有伤势2处 · 累计风险1');
    expect(resources().textContent).toContain('伤势1：轻伤 · 尚未治疗'); expect(resources().textContent).toContain('伤势2：重伤 · 尚未治疗');
    expect(resources().textContent).toContain('实际支付60便士治疗');
    const originals = within(panel()).getByRole('region', { name: '暗天使原人原物当前状态' }); expect(originals.closest('details')).toBeNull();
    for (const fact of ['本人当前在原封存院门口', '累计普通步行88米，现场时钟933秒', '玛拉·埃尔文 · 51岁，当前在室外', 'THT3-CARD在四米处原桌，数量1，累计实际行程40米', '基础压力3，原封条实际磨损5', 'EL2-KIT-1已归还，剩余1次，已耗1次', 'EL2-KIT-3已归还，剩余0次，已耗2次']) expect(originals.textContent).toContain(fact);
    const spirits = within(originals).getByRole('region', { name: '两位原灵的当前余量' });
    for (const fact of ['赫莲娜·奎因 · 54岁', '原灵灵性18，完整度60/100', '罗兰·维克 · 61岁', '原灵灵性21，完整度100/100', '有限信号、短暂护持、微弱照明', '有限信号、稳定持握、有限屏护', '既往中断记录保留']) expect(spirits.textContent).toContain(fact);
    expect(ui.container.textContent).not.toMatch(/本人精力|现场精力|候选|原创G/);
    expect(ui.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('selects each numbered original bottle without spending or dispatching', () => {
    const value = projection(), ui = show(value); expect(within(picker()).getAllByRole('option')).toHaveLength(3);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    expect(within(panel()).getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[1]!.source);
    const saved = projection(da(originalElder(), { type: 'LEARN_GUIDANCE' })); ui.rerender(<DarkAngelPanel {...ui.props} value={saved} />);
    expect((picker() as HTMLSelectElement).value).toBe(value.bottles[1]!.id); expect(ui.onCommand).not.toHaveBeenCalled();
    const terms = within(panel()).getByRole('region', { name: '暗天使服药准备' });
    for (const fact of ['7200便士', '1200便士', '180便士', '至少到下一真实周', '满12整周', '也可继续停留长老']) expect(terms.textContent).toContain(fact);
  }, 30_000);

  it('confirms exactly the selected original bottle once and retains the actual failure risk', () => {
    const value = projection(prepared()), before = structuredClone(value), ui = show(value);
    const action = actionFor(value, command => command.type === 'CONSUME'), dialog = openAction(action);
    const bottle = value.bottles.find(entry => action.command.type === 'CONSUME' && entry.id === action.command.bottleId)!;
    for (const fact of [bottle.source, `当前成功率${bottle.chance}%`, '健康−15', '精神−25', '成功与失败均实际耗尽这一瓶及本次准备', '原有十五项能力及其实际掌握保留', '两项新能力从0开始']) expect(dialog.textContent).toContain(fact);
    expect(ui.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command); expect(ui.onCommand.mock.calls[0]![0]).toBe(action.command); expect(value).toEqual(before);
  }, 30_000);

  it('preserves fifteen actual masteries including the two zeroes and displays two new zeroes', () => {
    const state = promoted(), value = projection(state), ui = show(value), fold = within(panel()).getByText('能力、消化与继承经历').closest('details')!;
    fold.open = true; expect(value.abilities).toHaveLength(17);
    expect(state.progression.mastery['hanged-man.s6.flesh-shaping']).toBe(0); expect(state.progression.mastery['hanged-man.s5.borrowed-arts']).toBe(0);
    expect(value.abilities.filter(ability => [GUIDANCE, SHELTER].includes(ability.id)).map(ability => ability.mastery)).toEqual([0, 0]);
    expect(within(panel()).getByRole('region', { name: '旧血肉储备与实际份额' }).textContent).toContain('现有血肉储备1/3');
    expect(within(panel()).getByRole('region', { name: '旧血肉储备与实际份额' }).textContent).toContain('其中已耗用6份');
    expect(within(panel()).getByRole('region', { name: '旧放牧来源的当前记录' }).textContent).toContain('第64周永久释放');
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(originalHangedManRoots(state)).toEqual(originalHangedManRoots(originalElder())); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('keeps player-authored names literal while filtering editorial prose', () => {
    const value = projection(); value.characterName = '原创G候选'; value.appearanceRecord = '原创G候选保有自己的身份。';
    const ui = show(value); expect(resources().textContent).toContain('原创G候选'); expect(ui.container.textContent).toContain('原创G候选保有自己的身份。'); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});

describe('Dark Angel panel: authoritative save and accessible confirmation', () => {
  it('contains focus and restores it after cancellation or Escape without dispatch', () => {
    const ui = show(), button = primary(); fireEvent.click(button); const dialog = screen.getByRole('dialog', { name: CONFIRM });
    expect(document.activeElement).toBe(within(dialog).getAllByRole('heading')[0]); expect(button.closest('[inert]')).toBeTruthy(); expect(disabled(picker())).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(document.activeElement).toBe(button);
    fireEvent.click(button); fireEvent.keyDown(screen.getByRole('dialog', { name: CONFIRM }), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  }, 30_000);

  it('locks duplicate clicks and unchanged facts even when a save error is dismissed', () => {
    const state = originalElder(), value = projection(state), ui = show(value), action = actionFor(value, command => command.type === 'LEARN_GUIDANCE');
    const dialog = openAction(action); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    ui.rerender(<DarkAngelPanel {...ui.props} value={structuredClone(value)} />); expect(disabled(primary())).toBe(true);
    ui.rerender(<DarkAngelPanel {...ui.props} error="保存中断" />); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    expect(within(panel()).getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    ui.rerender(<DarkAngelPanel {...ui.props} value={structuredClone(value)} />); expect(disabled(primary())).toBe(true);
    const saved = projection(da(state, action.command)); ui.rerender(<DarkAngelPanel {...ui.props} value={saved} />);
    expect(disabled(primary())).toBe(false); expect(document.activeElement).toBe(within(panel()).getByRole('heading', { name: saved.title })); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('invalidates a stale unsubmitted confirmation when newer saved facts arrive', () => {
    const state = originalElder(), ui = show(projection(state)); fireEvent.click(primary()); const stale = confirm();
    ui.rerender(<DarkAngelPanel {...ui.props} value={projection(da(state, { type: 'LEARN_GUIDANCE' }))} />); fireEvent.click(stale);
    expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks unavailable UI without mutating a source: %s', mode => {
    // Deliberately malformed presentation only; never passed into a reducer.
    const value = projection(); if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const ui = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary());
    fireEvent.click(within(panel()).getByRole('button', { name: '返回普通生活' })); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  }, 30_000);

  it('presents the exact domain blocker for an unavailable operation', () => {
    const value = projection(da(originalElder(), { type: 'LEARN_GUIDANCE' })), ui = show(value);
    const action = value.actions.find(entry => !entry.enabled && entry.reason && entry.command.type === 'PREPARE_PROMOTION')!; expect(action).toBeTruthy();
    const select = within(panel()).getByRole('combobox', { name: '暗天使其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true; fireEvent.change(select, { target: { value: action.id } });
    const button = within(panel()).getByRole('button', { name: name => name.startsWith(action.label) }); expect(disabled(button)).toBe(true);
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(action.reason); fireEvent.click(button); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});

describe('Dark Angel panel: one real spirit, finite effect and ordinary exit', () => {
  it('confirms the explicitly chosen original spirit and shows real paid costs before application', () => {
    const state = atSeal(promoted()), value = projection(state), ui = show(value);
    const action = actionFor(value, command => command.type === 'GUIDANCE' && command.spiritId === 'THT3-HELENA'), dialog = openAction(action);
    for (const fact of ['赫莲娜·奎因', '本人8灵性、2精神', '原灵3灵性', '失败总损失4精神', '不会自动换成另一位原灵']) expect(dialog.textContent).toContain(fact);
    fireEvent.click(confirm(dialog)); const savedState = da(state, action.command), saved = projection(savedState); ui.rerender(<DarkAngelPanel {...ui.props} value={saved} />);
    expect(savedState.spirituality).toBe(state.spirituality - 8); expect(saved.life.site.spirits['THT3-HELENA'].spirituality).toBe(value.life.site.spirits['THT3-HELENA'].spirituality - 3);
    expect(saved.life.site.spirits['THT3-ROLAND']).toEqual(value.life.site.spirits['THT3-ROLAND']); expect(savedState.progression.mastery[GUIDANCE]).toBe(0);
    expect(saved.life.strips[0]).toMatchObject({ charges: 1, wear: 0 }); expect(saved.life.currentAttempt!.appliedAbilityIds).toEqual([]);
    const clock = within(panel()).getByRole('region', { name: '当前时钟与一次能力窗口' }), before = clock.textContent;
    ui.rerender(<DarkAngelPanel {...ui.props} value={structuredClone(saved)} />); expect(clock.textContent).toBe(before);
    if (saved.life.pending) { expect(clock.textContent).toContain('还剩20秒'); expect(clock.textContent).toContain('有限信号'); }
    else expect(clock.textContent).toContain('判定失败');
    expect(within(panel()).queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 30_000);

  it('shows actual applied reading quality and paid-strip wear, only awarding mastery on the report', () => {
    let state = atSeal(promoted()); state = perform(state, { type: 'GUIDANCE', caseId: 'guided-reading', spiritId: 'THT3-ROLAND' }, { type: 'READ_ORIGINAL', caseId: 'guided-reading' });
    const value = projection(state), attempt = value.life.currentAttempt!, applied = attempt.appliedAbilityIds.includes(GUIDANCE), ui = show(value);
    expect(within(panel()).getByRole('region', { name: '有限效果的实际测量' }).textContent).toContain(`实际阅读质量${applied ? 6 : 3}`);
    expect(within(panel()).getByRole('region', { name: '本案有限封条' }).textContent).toContain(`剩余${applied ? 0 : 1}次，实际磨损${applied ? 1 : 0}`);
    expect(state.progression.mastery[GUIDANCE]).toBe(0); const completed = finish(state, 'guided-reading'); ui.rerender(<DarkAngelPanel {...ui.props} value={projection(completed)} />);
    fireEvent.change(picker(), { target: { value: 'guided-reading' } }); expect(within(panel()).getByRole('region', { name: '本案有限封条' }).textContent).toContain('已经归还');
    expect(completed.progression.mastery[GUIDANCE]).toBe(applied ? 8 : 0); expect(originalHangedManRoots(completed)).toEqual(originalHangedManRoots(originalElder())); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('shows finite shelter against contained pressure without changing the residual or the original adult', () => {
    let state = atSeal(ordinaryCase(promoted(), 'guided-reading'), 'guarded-pulse');
    state = perform(state, { type: 'READ_ORIGINAL', caseId: 'guarded-pulse' }, { type: 'SHELTER', caseId: 'guarded-pulse', spiritId: 'THT3-HELENA' }, { type: 'PERFORM_OPERATION', caseId: 'guarded-pulse' });
    const value = projection(state), attempt = value.life.currentAttempt!, ui = show(value);
    expect(within(panel()).getByRole('region', { name: '有限效果的实际测量' }).textContent).toContain(`本次操作基准压力3，实际承受压力${attempt.appliedAbilityIds.includes(SHELTER) ? 1 : 3}`);
    expect(value.life.operation).toMatchObject({ contained: true, residualPressure: 3 }); expect(value.life.site.owner).toMatchObject({ alive: true, location: 'START' });
    expect(within(panel()).getByRole('region', { name: '当前时钟与一次能力窗口' }).textContent).toContain('短暂护持'); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);

  it('withdraws an unused attempt without refund, new mastery or pretending cleanup is complete', () => {
    let state = ordinaryCase(ordinaryCase(promoted(), 'guided-reading'), 'guarded-pulse'); state = atSeal(state, 'withdrawn-guidance');
    state = da(state, { type: 'GUIDANCE', caseId: 'withdrawn-guidance', spiritId: 'THT3-HELENA' }); const value = projection(state), ui = show(value);
    const action = actionFor(value, command => command.type === 'WITHDRAW_CONSENT' && command.permission === 'ABILITY'), dialog = openAction(action);
    expect(dialog.textContent).toContain('撤回立即停止新施法并清除未用窗口'); fireEvent.click(confirm(dialog));
    const withdrawn = da(state, action.command), saved = projection(withdrawn); ui.rerender(<DarkAngelPanel {...ui.props} value={saved} />);
    expect(saved.life.pending).toBeNull(); expect(withdrawn.spirituality).toBe(state.spirituality); expect(withdrawn.mind).toBe(state.mind);
    expect(within(panel()).getByRole('region', { name: '本案的独立许可' }).textContent).toContain('有限能力用途的许可：已经撤回');
    expect(saved.life.strips.find(strip => strip.caseId === 'withdrawn-guidance')).toMatchObject({ charges: 1, wear: 0, status: 'PLAYER' });
    expect(within(panel()).queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(disabled(picker())).toBe(true);
    const completed = finish(da(withdrawn, { type: 'READ_ORIGINAL', caseId: 'withdrawn-guidance' }), 'withdrawn-guidance');
    expect(completed.progression.mastery[GUIDANCE]).toBe(0); expect(completed.progression.mastery[SHELTER]).toBe(0); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 60_000);

  it('keeps completed life practice outside the optional paid encounter until explicitly selected', () => {
    const value = projection(practiced()), ui = show(value);
    expect(panel().querySelector('.seer-next')?.textContent).toContain('生活报告与反思已完成，可以返回普通生活');
    expect(within(panel()).queryByRole('region', { name: '暗天使可选真实交战' })).toBeNull();
    expect(within(panel()).getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    fireEvent.change(picker(), { target: { value: 'encounter' } });
    expect(within(panel()).getByRole('region', { name: '暗天使可选真实交战' }).textContent).toContain('埃德加·沃德');
    const wheel = within(panel()).getByRole('region', { name: '对手当前能力盘' });
    for (const entry of value.encounter.enemyAbilityWheel) expect(wheel.textContent).toContain(`${entry.label} · 权重${entry.weight}`);
    expect(within(panel()).getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('尚未明确选择'); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('confirms a particular combat spirit without automatically fighting or changing a policy', () => {
    const state = perform(ready(practiced(), { ap: 1, cash: 30 }), { type: 'PREPARE_ENCOUNTER' }, { type: 'ENCOUNTER_TALK' }), value = projection(state), ui = show(value);
    const action = actionFor(value, command => command.type === 'SET_COMBAT_SPIRIT' && command.spiritId === 'THT3-ROLAND'), dialog = openAction(action);
    expect(dialog.textContent).toContain('本次明确选定：罗兰·维克'); expect(dialog.textContent).toContain('只保存本场明确选中的原灵');
    expect(ui.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
    const saved = projection(da(state, action.command)); ui.rerender(<DarkAngelPanel {...ui.props} value={saved} />);
    expect(within(panel()).getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('选定原灵：罗兰·维克');
    expect(within(panel()).getByRole('region', { name: '暗天使战斗封条' }).textContent).toContain('剩余3/3次，实际磨损0'); expect(saved.encounter.policy).toBe('ALL'); expect(ui.container.textContent).not.toMatch(editorial);
  }, 30_000);
});
