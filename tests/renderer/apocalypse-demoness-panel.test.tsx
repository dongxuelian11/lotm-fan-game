/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ApocalypseDemonessPanel, type ApocalypseDemonessPanelProps } from '../../src/renderer/ApocalypseDemonessPanel.js';
import { projectApocalypseDemoness } from '../../src/domain/apocalypse-demoness/index.js';
import type { ApocalypseDemonessAction, ApocalypseDemonessCommand, ApocalypseDemonessProjection } from '../../src/domain/apocalypse-demoness/types.js';
import type { ApocalypseDemonessCaseId } from '../../src/domain/apocalypse-demoness/life.js';
import { applySliceIntent, assertValidSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { ae, directedPrepared, originalCalamity, prepared, promoted, ready, taught } from '../domain/apocalypse-demoness-directed-helper.js';

afterEach(cleanup);

// All normal inputs are real public projections of the immutable S2 source,
// current product migration and subsequent public commands. No fabricated S1
// roots, free resources, revised history or selected successful combat result.
// Only the named malformed-presentation and literal-name tests edit projection
// fields; they never supply the edited projection to a domain reducer.
const projection = (s = originalCalamity()) => projectApocalypseDemoness(s);
function show(value = projection(), extra: Partial<ApocalypseDemonessPanelProps> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const props = { value, busy: false, onCommand, onClose, ...extra };
  return { ...render(<ApocalypseDemonessPanel {...props} />), props, onCommand, onClose };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const picker = () => screen.getByRole('combobox', { name: '末日魔女目标' });
const resources = () => screen.getAllByRole('region', { name: '末日魔女当前资源' })[0]!;
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '末日魔女操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function actualAction(value: ApocalypseDemonessProjection, predicate: (command: ApocalypseDemonessCommand) => boolean): ApocalypseDemonessAction {
  const action = value.actions.find(entry => entry.enabled && predicate(entry.command));
  if (!action) throw new Error('Expected a genuinely enabled projected action.');
  return action;
}
function openAction(action: ApocalypseDemonessAction) {
  let button = screen.queryAllByRole('button', { hidden: true }).find(entry => entry.getAttribute('data-action-id') === action.id);
  if (!button) {
    const select = screen.getByRole('combobox', { name: '末日魔女其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true;
    fireEvent.change(select, { target: { value: action.id } });
    button = screen.getAllByRole('button', { hidden: true }).find(entry => entry.getAttribute('data-action-id') === action.id);
  }
  if (!button) throw new Error(`Projected action was not accessible: ${action.label}`);
  const fold = button.closest('details'); if (fold) fold.open = true;
  fireEvent.click(button); return screen.getByRole('dialog');
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(?:OUTSIDE|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"(?:command|before|playerEnergy)"\s*:/;

describe('Apocalypse Demoness panel: actual source, independent bottles and unchanged body', () => {
  it('shows the actual wounded S2 source and latest outside scene instead of the stale entry snapshot', () => {
    const source = originalCalamity();
    expect(source).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    const value = projection(source), before = structuredClone(value), ui = show(value);
    expect(resources().textContent).toContain('健康70/100 · 精神100/100 · 灵性120/120 · 排异0');
    expect(resources().textContent).toContain('610便士 · 本周行动3 · 现有伤势1处 · 累计风险0');
    expect(resources().textContent).toContain('伤势1：重伤 · 尚未治疗');
    const originals = screen.getByRole('region', { name: '末日魔女原人原物当前状态' });
    expect(originals.closest('details')).toBeNull();
    for (const fact of ['本人当前在室外，精力22/100', '累计普通步行78米，现场时钟407秒', '维瑞娜·肖 · 46岁，当前在室外，独立精力92/100', '马库斯·赫尔 · 41岁，当前在室外，独立精力70/100', '镜面许可已经撤回', '原负载剩余0次，已实际施加1次', '原残留已耗尽', '既有焦痕仍在', '第1枚已归还，剩余0次', '第3枚已归还，剩余1次']) expect(originals.textContent).toContain(fact);
    expect(originals.textContent).not.toContain('现场时钟217秒'); expect(originals.textContent).not.toContain('精力28/100');
    expect(within(picker()).getAllByRole('option')).toHaveLength(3);
    expect(ui.container.textContent).not.toMatch(editorial); expect(ui.container.textContent).not.toMatch(/必须诊疗|先去诊所/);
    expect(value).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 240_000);

  it('selects each real bottle independently without granting it or submitting', () => {
    const value = projection(), before = structuredClone(value), ui = show(value);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[1]!.source);
    ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={projection(taught())} />);
    expect((picker() as HTMLSelectElement).value).toBe(value.bottles[1]!.id);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动0/5');
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  }, 240_000);

  it('confirms the actually acquired bottle, its risk and unchanged identity exactly once', () => {
    const value = projection(prepared()), action = actualAction(value, command => command.type === 'CONSUME'), before = structuredClone(value), ui = show(value);
    const dialog = openAction(action), bottle = value.bottles.find(entry => action.command.type === 'CONSUME' && entry.id === action.command.bottleId)!;
    for (const fact of [bottle.source, `当前成功率${bottle.chance}%`, '健康−15', '精神−25', '成功与失败均实际耗尽这一瓶及本次准备', '不改变性别、姓名、年龄、性格与取向', '原有十八项能力及其实际掌握保留', '两项新能力从0开始']) expect(dialog.textContent).toContain(fact);
    expect(ui.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command); expect(ui.onCommand.mock.calls[0]![0]).toBe(action.command);
    expect(value).toEqual(before);
  }, 240_000);

  it('retains a real failed dose, damage and spent preparation after the committed save', () => {
    const source = directedPrepared(['FAILURE']), value = projection(source), action = actualAction(value, command => command.type === 'CONSUME'), ui = show(value);
    fireEvent.click(confirm(openAction(action))); ui.rerender(<ApocalypseDemonessPanel {...ui.props} error="保存中断" />);
    const failed = ae(source, action.command), saved = projection(failed);
    expect(failed.progression.sequence).toBe(2); expect(saved.bottles[0]!.status).toContain('原瓶已耗尽');
    ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />); fireEvent.change(picker(), { target: { value: value.bottles[0]!.id } });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(resources().textContent).toContain(`健康${failed.health}/100 · 精神${failed.mind}/100 · 灵性${failed.spirituality}/120 · 排异${failed.seer.pollution}`);
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 240_000);

  it('preserves eighteen real inherited masteries, seven old zeroes and two new zeroes after real promotion', () => {
    const value = projection(promoted()), before = structuredClone(value), ui = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(20); expect(value.abilities.slice(0, 18).filter(ability => ability.mastery === 0)).toHaveLength(7);
    expect(value.abilities.slice(18).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(fold.textContent).toContain('CD2-COMBAT-PLATE'); expect(fold.textContent).toContain('当前女性');
    expect(ui.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 240_000);

  it('keeps user-authored names verbatim even when they resemble editorial copy', () => {
    const value = projection(); value.characterName = '原创G候选'; value.appearanceRecord = '原创G候选保有自己的身份。';
    const ui = show(value); expect(resources().textContent).toContain('原创G候选'); expect(ui.container.textContent).toContain('原创G候选保有自己的身份。');
    expect(ui.onCommand).not.toHaveBeenCalled();
  }, 240_000);
});

describe('Apocalypse Demoness panel: exact confirmation and same-save locks', () => {
  it('contains keyboard focus and cancels or escapes without dispatching', () => {
    const ui = show(), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getAllByRole('heading')[0]);
    expect(button.closest('[inert]')).toBeTruthy(); expect(disabled(picker())).toBe(true); expect(disabled(screen.getByRole('button', { name: '返回普通生活' }))).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  }, 240_000);

  it('locks duplicate clicks, unchanged saves and dismissed errors until committed facts change', () => {
    const value = projection(), ui = show(value), action = actualAction(value, command => command.type === 'LEARN_GUIDANCE');
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={structuredClone(value)} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    ui.rerender(<ApocalypseDemonessPanel {...ui.props} error="保存中断" />); expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存'); expect(screen.queryByRole('button', { name: /重试/ })).toBeNull();
    ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={structuredClone(value)} />); expect(disabled(primary())).toBe(true); fireEvent.click(primary());
    const saved = projection(ae(originalCalamity(), action.command)); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    expect(disabled(primary())).toBe(false); expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 240_000);

  it('invalidates an unsubmitted confirmation when newer authoritative facts arrive', () => {
    const ui = show(), oldConfirm = confirm(openPrimary());
    ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={projection(taught())} />); fireEvent.click(oldConfirm);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 240_000);

  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks all controls for the malformed or locked presentation: %s', mode => {
    const value = projection(); if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const ui = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary()); fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  }, 240_000);

  it('shows an actually unavailable action and its exact reason without dispatching', () => {
    const value = projection(taught()), ui = show(value), unavailable = value.actions.find(action => !action.enabled && action.reason && action.command.type === 'PREPARE_PROMOTION')!;
    expect(unavailable).toBeTruthy(); const select = screen.getByRole('combobox', { name: '末日魔女其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true; fireEvent.change(select, { target: { value: unavailable.id } });
    const button = screen.getByRole('button', { name: name => name.startsWith(unavailable.label) }); expect(disabled(button)).toBe(true);
    expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(unavailable.reason); fireEvent.click(button); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 240_000);

  it('closes an unlocked page as navigation without moving bodies or submitting', () => {
    const value = projection(), before = structuredClone(value), ui = show(value); fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(ui.onClose).toHaveBeenCalledExactlyOnceWith(); expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  }, 240_000);
});

function readyScene(s: SliceState): SliceState {
  s = ready(s, { ap: 3, cash: 250, health: 80, mind: 50, spirituality: 30 });
  while (s.apocalypseDemoness.life.site!.playerEnergy < 60) {
    s = ae(s, { type: 'RECOVER_ENERGY' }); s = ready(s, { ap: 3, cash: 250, health: 80, mind: 50, spirituality: 30 });
  }
  return s;
}
function beginCase(s: SliceState, caseId: ApocalypseDemonessCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = ae(readyScene(s), { type: 'OBSERVE', caseId }); s = ae(s, { type: 'PREPARE', caseId, method });
  for (const permission of ['OWNER', 'OPERATOR', 'PARTICIPANT'] as const) s = ae(s, { type: 'CONSENT', permission });
  if (method === 'ABILITY') s = ae(s, { type: 'CONSENT', permission: 'ABILITY' });
  return ae(s, { type: 'APPROACH' });
}
function finishCase(s: SliceState, caseId: ApocalypseDemonessCaseId): SliceState {
  if (s.apocalypseDemoness.life.cases[caseId].attempts.at(-1)!.plate.status === 'INSTALLED') s = ae(s, { type: 'REMOVE_PLATE' });
  for (const command of [{ type: 'EXIT_ROOM' }, { type: 'RETURN_PLATE' }, { type: 'LEAVE' }] as const) s = ae(s, command);
  return ae(ready(s), { type: 'REPORT', caseId });
}
function ordinaryCase(s: SliceState, caseId: ApocalypseDemonessCaseId): SliceState {
  s = beginCase(s, caseId, 'ORDINARY'); s = ae(s, { type: 'INSTALL_PLATE' }); s = ae(s, { type: 'ORDINARY_INSPECTION' });
  return finishCase(s, caseId);
}
function preparedPulse(s: SliceState, caseId: 'pulse-containment' | 'withdrawn-window'): SliceState {
  s = beginCase(s, caseId);
  for (const command of [{ type: 'BUY_RESIDUE' }, { type: 'RECEIVE_RESIDUE' }, { type: 'INSTALL_PLATE' }, { type: 'START_PULSE' }] as const) s = ae(s, command);
  return s;
}
function reportedLife(): SliceState {
  let s = promoted(); for (const caseId of ['pulse-containment', 'mirror-buffer', 'withdrawn-window'] as const) s = ordinaryCase(s, caseId);
  return ae(ready(s), { type: 'REFLECT' });
}

describe('Apocalypse Demoness panel: real finite cases and ordinary return', () => {
  it('does not turn a successful but unused cast into mastery, and only advances time through a committed wait', () => {
    let s = preparedPulse(promoted(), 'pulse-containment');
    const value = projection(s), action = actualAction(value, command => command.type === 'PULSE_CONTAINMENT'), ui = show(value), dialog = openAction(action);
    expect(dialog.textContent).toContain('8灵性'); expect(dialog.textContent).toContain('2精神'); fireEvent.click(confirm(dialog)); s = ae(s, action.command);
    let saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    const window = () => screen.getByRole('region', { name: '当前时钟与一次能力窗口' });
    expect(saved.life.currentAttempt!.containment.effects).toBe(0); expect(saved.abilities.find(ability => ability.id === 'assassin.s1.pulse-containment')!.mastery).toBe(0);
    if (saved.life.pending) {
      expect(window().textContent).toContain('还剩20秒'); const before = window().textContent;
      ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={structuredClone(saved)} />); expect(window().textContent).toBe(before);
      s = ae(s, actualAction(saved, command => command.type === 'WAIT_10').command); saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />); expect(window().textContent).toContain('还剩10秒');
      s = ae(s, actualAction(saved, command => command.type === 'WAIT_10').command); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={projection(s)} />);
      expect(window().textContent).toContain('当前没有尚未耗用的能力窗口'); expect(screen.getByRole('region', { name: '唯一新残留与脉冲处置' }).textContent).toContain('已经到期');
    } else {
      expect(window().textContent).toContain('当前没有尚未耗用的能力窗口'); expect(screen.getByRole('region', { name: '唯一新残留与脉冲处置' }).textContent).toContain('判定失败');
    }
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 240_000);

  it('shows one actual paid source, spent pulse and worn returned plate without refilling old items', () => {
    let s = preparedPulse(promoted(), 'pulse-containment'); s = ae(s, { type: 'PULSE_CONTAINMENT' }); s = ae(s, { type: 'APPLY_PULSE' });
    const value = projection(s), ui = show(value), source = screen.getByRole('region', { name: '唯一新残留与脉冲处置' });
    for (const fact of ['AD1-RESIDUE-1', '已实付50便士', '剩余0次，已实际消耗1次', '本次脉冲已经实际发生', '本次箱体焦痕已经记录']) expect(source.textContent).toContain(fact);
    expect(screen.getByRole('region', { name: '本案新护片与归还' }).textContent).toContain('剩余0次，实际磨损5，焦痕仍在');
    expect(screen.getByRole('region', { name: '末日魔女原人原物当前状态' }).textContent).toContain('原残留已耗尽');
    s = finishCase(s, 'pulse-containment'); const saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    fireEvent.change(picker(), { target: { value: 'pulse-containment' } }); expect(screen.getByRole('region', { name: '本案新护片与归还' }).textContent).toContain('已经归还');
    expect(screen.getByRole('region', { name: '末日魔女生活练习' }).textContent).toContain('当次已保存经历'); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 240_000);

  it('shows the actual new load, six-or-three health damage and spent plate without pretending the old load refilled', () => {
    let s = ordinaryCase(promoted(), 'pulse-containment'); s = beginCase(s, 'mirror-buffer');
    s = ae(s, { type: 'BUY_LOAD' }); const ui = show(projection(s)), section = () => screen.getByRole('region', { name: '一次新负载与本人冲击' });
    expect(section().textContent).toContain('已实付30便士，当前在供应方处，剩余1次'); expect(section().textContent).toContain('实际到货：尚未到货');
    for (const command of [{ type: 'RECEIVE_LOAD' }, { type: 'PREPARE_LOAD' }, { type: 'INSTALL_PLATE' }, { type: 'MIRROR_BUFFER' }, { type: 'APPLY_LOAD' }] as const) s = ae(s, command);
    const saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    expect(section().textContent).toContain('剩余0次，已实际耗用1次'); expect(section().textContent).toContain(`实际损失${saved.life.currentAttempt!.impactDamage}健康`);
    expect([3, 6]).toContain(saved.life.currentAttempt!.impactDamage); expect(screen.getByRole('region', { name: '本案新护片与归还' }).textContent).toContain('剩余0次，实际磨损5');
    expect(screen.getByRole('region', { name: '末日魔女原人原物当前状态' }).textContent).toContain('原负载剩余0次'); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 240_000);

  it('keeps withdrawal, pending cleanup and the real return separate, with no free teleport or duplicate command', () => {
    let s = ordinaryCase(promoted(), 'pulse-containment'); s = ordinaryCase(s, 'mirror-buffer'); s = preparedPulse(s, 'withdrawn-window');
    const value = projection(s), ui = show(value), withdraw = actualAction(value, command => command.type === 'WITHDRAW_CONSENT' && command.permission === 'OWNER');
    expect(disabled(picker())).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    fireEvent.click(confirm(openAction(withdraw))); s = ae(s, withdraw.command); let saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经撤回');
    expect(screen.getByRole('region', { name: '末日魔女原人原物当前状态' }).textContent).toContain('本人当前在原封存箱旁');
    expect(saved.life.residue!.pendingAt).not.toBeNull(); const seal = actualAction(saved, command => command.type === 'ORDINARY_SEAL');
    fireEvent.click(confirm(openAction(seal))); s = ae(s, seal.command); saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    expect(saved.life.residue!.pendingAt).toBeNull(); expect(saved.life.currentAttempt!.containment.effects).toBe(0);
    expect(screen.getByRole('region', { name: '唯一新残留与脉冲处置' }).textContent).toContain('已经通过普通方法封存');
    s = ae(s, { type: 'REMOVE_PLATE' }); s = ae(s, { type: 'EXIT_ROOM' }); saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    const returned = actualAction(saved, command => command.type === 'RETURN_PLATE'), dialog = openAction(returned); expect(dialog.textContent).toContain('已经走到室外');
    fireEvent.click(confirm(dialog)); expect(ui.onCommand).toHaveBeenNthCalledWith(1, withdraw.command); expect(ui.onCommand).toHaveBeenNthCalledWith(2, seal.command); expect(ui.onCommand).toHaveBeenNthCalledWith(3, returned.command);
    expect(ui.onClose).not.toHaveBeenCalled();
  }, 240_000);
});

describe('Apocalypse Demoness panel: new opponent and restored encounter state', () => {
  it('requires separate real talk, paid new plate and explicit policy before battle', () => {
    let s = readyScene(reportedLife()); const value = projection(s), ui = show(value);
    expect(screen.getByRole('region', { name: '末日魔女可选真实交战' }).textContent).toContain('尚未实际交谈'); expect(ui.container.textContent).not.toContain('莱奥娜·布莱克');
    const talk = actualAction(value, command => command.type === 'ENCOUNTER_TALK'), dialog = openAction(talk);
    expect(dialog.textContent).toContain('另付20便士'); expect(dialog.textContent).toContain('不自动交战'); fireEvent.click(confirm(dialog)); s = ae(s, talk.command);
    let saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    expect(screen.getByRole('region', { name: '末日魔女可选真实交战' }).textContent).toContain('莱奥娜·布莱克 · 43岁');
    expect(screen.getByRole('region', { name: '末日魔女战斗护片' }).textContent).toContain('AD1-COMBAT-PLATE');
    expect(screen.getByRole('region', { name: '末日魔女战斗护片' }).textContent).toContain('剩余3/3次');
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('默认显示不代表已经确认');
    const policy = actualAction(saved, command => command.type === 'ENCOUNTER_POLICY' && command.policy === 'ORDINARY');
    fireEvent.click(confirm(openAction(policy))); s = ae(s, policy.command); saved = projection(s); ui.rerender(<ApocalypseDemonessPanel {...ui.props} value={saved} />);
    const fight = actualAction(saved, command => command.type === 'ENCOUNTER_FIGHT'), battleDialog = openAction(fight);
    expect(battleDialog.textContent).toContain('普通死亡终结本周目'); expect(battleDialog.textContent).toContain('只作普通行动');
    fireEvent.click(within(battleDialog).getByRole('button', { name: '取消，返回查看' })); expect(ui.onCommand).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('region', { name: '战场位置与普通出口' }).textContent).toContain('维瑞娜·肖在室外');
    expect(s.calamityDemoness.encounter.enemySpirituality).toBe(97); expect(s.calamityDemoness.encounter.plate!.charges).toBe(3);
  }, 240_000);

  it('shows the latest real S1 enemy resources after save/reload rather than returning to old S2 promotion or Iris', () => {
    let s = readyScene(reportedLife()); s = ae(s, { type: 'ENCOUNTER_TALK' }); s = ae(s, { type: 'ENCOUNTER_POLICY', policy: 'ALL' }); s = ae(s, { type: 'ENCOUNTER_FIGHT' });
    s = applySliceIntent(s, { type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(s.lastCombatRound!.apocalypseDemonessOutcome).toBeTruthy();
    const restored = migrateSliceState(JSON.parse(JSON.stringify(s))); assertValidSliceState(restored);
    const value = projection(restored), ui = show(value), encounter = screen.getByRole('region', { name: '末日魔女可选真实交战' });
    expect((picker() as HTMLSelectElement).value).toBe('encounter'); expect(screen.queryByRole('region', { name: '末日魔女服药准备' })).toBeNull();
    expect(encounter.textContent).toContain('莱奥娜·布莱克 · 43岁');
    expect(encounter.textContent).toContain(`健康${restored.apocalypseDemoness.encounter.enemyHealth}/100、精神${restored.apocalypseDemoness.encounter.enemyMind}/100、独立灵性${restored.apocalypseDemoness.encounter.enemySpirituality}/120`);
    expect(screen.getByRole('region', { name: '末日魔女战斗护片' }).textContent).toContain(`剩余${restored.apocalypseDemoness.encounter.materials.plate!.charges}/3次`);
    expect(resources().textContent).toContain(`健康${restored.health}/100 · 精神${restored.mind}/100 · 灵性${restored.spirituality}/120`);
    expect(restored.calamityDemoness.encounter).toMatchObject({ targetId: 'CD2-IRIS', status: 'RETREATED', enemyHealth: 100, enemyMind: 100, enemySpirituality: 97 });
    expect(ui.container.textContent).not.toMatch(editorial); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 240_000);
});
