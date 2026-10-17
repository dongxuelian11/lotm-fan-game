/* @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DivineHandPanel, type DivineHandPanelProps } from '../../src/renderer/DivineHandPanel.js';
import { projectDivineHand } from '../../src/domain/divine-hand/index.js';
import type { DivineHandAction, DivineHandCommand, DivineHandProjection } from '../../src/domain/divine-hand/types.js';
import type { DivineHandCaseId } from '../../src/domain/divine-hand/life.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { ae, directedPrepared, originalGlory, prepared, promoted, ready, taught } from '../domain/divine-hand-directed-helper.js';

afterEach(cleanup);

// All normal inputs come from the real public projection of migrated evidence
// and actual public commands. The source contains its explicit directed S3
// prefix; these renderer exercises are not a new natural campaign capture.
// Only the named malformed-presentation tests clone and change visible facts.
const projection = (s = originalGlory()) => projectDivineHand(s);
function show(value = projection(), extra: Partial<DivineHandPanelProps> = {}) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const props = { value, busy: false, onCommand, onClose, ...extra };
  return { ...render(<DivineHandPanel {...props} />), props, onCommand, onClose };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const picker = () => screen.getByRole('combobox', { name: '神明之手目标' });
const resources = () => screen.getAllByRole('region', { name: '神明之手当前资源' })[0]!;
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: '神明之手操作确认' }); }
function confirm(dialog = screen.getByRole('dialog')) { return within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ }); }
function actualAction(value: DivineHandProjection, predicate: (command: DivineHandCommand) => boolean): DivineHandAction {
  const action = value.actions.find(entry => entry.enabled && predicate(entry.command));
  if (!action) throw new Error('Expected a genuinely enabled projected action.');
  return action;
}
function openAction(action: DivineHandAction) {
  let button = screen.queryAllByRole('button', { hidden: true }).find(entry => entry.getAttribute('data-action-id') === action.id);
  if (!button) {
    const select = screen.getByRole('combobox', { name: '神明之手其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true;
    fireEvent.change(select, { target: { value: action.id } });
    button = screen.getAllByRole('button', { hidden: true }).find(entry => entry.getAttribute('data-action-id') === action.id);
  }
  if (!button) throw new Error(`Projected action was not accessible: ${action.label}`);
  const fold = button.closest('details'); if (fold) fold.open = true;
  fireEvent.click(button); return screen.getByRole('dialog');
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|来源未知|\b(?:BENCH|OUTSIDE|PLAYER|RESISTING|SURRENDERED|WITHDRAWN|GRANTED)\b|"(?:command|before|playerEnergy)"\s*:/;

describe('Divine Hand panel: real source, finite bottles and preserved body', () => {
  it('uses the current migration and shows the actual wounded source, original energies and current armor', () => {
    const source = originalGlory();
    expect(source).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    const value = projection(source), before = structuredClone(value), ui = show(value);
    expect(resources().textContent).toContain('健康90/100 · 精神100/100 · 灵性96/120 · 排异0');
    expect(resources().textContent).toContain('500便士 · 本周行动2 · 现有伤势1处 · 累计风险0');
    expect(resources().textContent).toContain('伤势1：轻伤 · 尚未治疗');
    expect(primary().textContent).toContain('500便士');
    const original = screen.getByRole('region', { name: '原修护室当前状态', hidden: true });
    expect(original.textContent).toContain('当前完整度60'); expect(original.textContent).not.toContain('当前完整度65');
    expect(original.textContent).toContain('本人当前在室外，精力35/100');
    expect(original.textContent).toContain('独立精力80/100'); expect(original.textContent).toContain('独立精力82/100');
    expect(original.textContent).toContain('原安全垫剩余1份，已消耗1份，当前在修护台旁，没有穿戴');
    expect(original.textContent).toContain('原12千克负载剩余0次，已实际施加1次');
    expect(original.textContent).toContain('第3枚余量1，在修护台旁，原价20便士');
    expect(within(picker()).getAllByRole('option')).toHaveLength(3);
    expect(ui.container.textContent).not.toMatch(editorial); expect(ui.container.textContent).not.toMatch(/必须诊疗|先去诊所/);
    expect(value).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 60_000);

  it('keeps all three original bottles separately selected without submitting or granting stock', () => {
    const value = projection(), ui = show(value), before = structuredClone(value);
    fireEvent.change(picker(), { target: { value: value.bottles[1]!.id } });
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[1]!.source);
    const saved = projection(taught()); ui.rerender(<DivineHandPanel {...ui.props} value={saved} />);
    expect((picker() as HTMLSelectElement).value).toBe(value.bottles[1]!.id);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('劳动0/5');
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  }, 60_000);

  it('confirms the actually acquired original bottle with failure costs and unchanged identity', () => {
    const value = projection(prepared()), action = actualAction(value, command => command.type === 'CONSUME'), before = structuredClone(value), ui = show(value);
    const dialog = openAction(action), bottle = value.bottles.find(entry => action.command.type === 'CONSUME' && entry.id === action.command.bottleId)!;
    expect(dialog.textContent).toContain(bottle.source); expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('健康−15'); expect(dialog.textContent).toContain('精神−25');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向');
    expect(dialog.textContent).toContain('两项新能力从0开始');
    expect(ui.onCommand).not.toHaveBeenCalled(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command); expect(ui.onCommand.mock.calls[0]![0]).toBe(action.command);
    expect(value).toEqual(before);
  }, 60_000);

  it('shows a real spent failure and committed damage without submitting a second dose', () => {
    const source = directedPrepared(['FAILURE']), value = projection(source), action = actualAction(value, command => command.type === 'CONSUME'), ui = show(value);
    fireEvent.click(confirm(openAction(action)));
    ui.rerender(<DivineHandPanel {...ui.props} error="保存中断" />);
    const failed = ae(source, action.command), saved = projection(failed);
    expect(failed.progression.sequence).toBe(2); expect(saved.bottles[0]!.status).toContain('原瓶已耗尽');
    ui.rerender(<DivineHandPanel {...ui.props} value={saved} />);
    fireEvent.change(picker(), { target: { value: value.bottles[0]!.id } });
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(resources().textContent).toContain(`健康${failed.health}/100 · 精神${failed.mind}/100 · 灵性${failed.spirituality}/120 · 排异${failed.seer.pollution}`);
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 60_000);

  it('shows twenty real inherited masteries, four old zeroes and two new zeroes after actual promotion', () => {
    const value = projection(promoted()), before = structuredClone(value), ui = show(value);
    const fold = screen.getByText('能力、消化与继承经历').closest('details')!; fold.open = true;
    expect(value.abilities).toHaveLength(22); expect(value.abilities.slice(0, 20).filter(ability => ability.mastery === 0)).toHaveLength(4);
    expect(value.abilities.slice(20).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const ability of value.abilities) expect(within(fold).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(ui.container.textContent).not.toMatch(editorial); expect(value).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 60_000);

  it('preserves user-authored names verbatim rather than applying an editorial-word filter', () => {
    const value = projection(); value.characterName = '原创G候选'; value.appearanceRecord = '原创G候选保有自己的身份。';
    const ui = show(value); expect(resources().textContent).toContain('原创G候选');
    expect(ui.container.textContent).toContain('原创G候选保有自己的身份。'); expect(ui.onCommand).not.toHaveBeenCalled();
  });
});

describe('Divine Hand panel: exact confirmations and same-save locking', () => {
  it('traps focus, disables the background, and cancels or escapes without a command', () => {
    const ui = show(), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取神明之手成品与专业准备指导' }));
    expect(button.closest('[inert]')).toBeTruthy(); expect(disabled(picker())).toBe(true);
    expect(disabled(screen.getByRole('button', { name: '返回普通生活' }))).toBe(true);
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' }); expect(document.activeElement).toBe(button);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  });

  it('locks repeated clicks, unchanged saves, errors and error dismissal until committed facts change', () => {
    const value = projection(), ui = show(value), action = actualAction(value, command => command.type === 'LEARN_GUIDANCE');
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    ui.rerender(<DivineHandPanel {...ui.props} value={structuredClone(value)} />);
    expect(disabled(primary())).toBe(true); expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    ui.rerender(<DivineHandPanel {...ui.props} error="保存中断" />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    expect(screen.queryByRole('button', { name: /重试/ })).toBeNull();
    ui.rerender(<DivineHandPanel {...ui.props} value={structuredClone(value)} />);
    expect(disabled(primary())).toBe(true); fireEvent.click(primary());
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
    const saved = projection(ae(originalGlory(), action.command));
    ui.rerender(<DivineHandPanel {...ui.props} value={saved} />);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(disabled(primary())).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: saved.title }));
    expect(ui.onCommand).toHaveBeenCalledOnce();
  }, 60_000);

  it('invalidates an open confirmation when a newer real save arrives', () => {
    const ui = show(), dialog = openPrimary(), oldConfirm = confirm(dialog);
    ui.rerender(<DivineHandPanel {...ui.props} value={projection(taught())} />);
    fireEvent.click(oldConfirm); expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 60_000);

  it.each(['busy', 'blocked', 'error', 'missing-resources', 'dead'] as const)('blocks commands and navigation while %s', mode => {
    const value = projection();
    if (mode === 'missing-resources') value.resources = null; else if (mode === 'dead') value.resources!.health = 0;
    const ui = show(value, { busy: mode === 'busy', blocked: mode === 'blocked', error: mode === 'error' ? '保存中断' : null });
    expect(disabled(primary())).toBe(true); expect(disabled(picker())).toBe(true); fireEvent.click(primary());
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  });

  it('keeps an actually unavailable action and its reason accessible without dispatching it', () => {
    const value = projection(taught()), ui = show(value);
    const unavailable = value.actions.find(action => !action.enabled && !!action.reason && action.command.type === 'PREPARE_PROMOTION')!;
    expect(unavailable).toBeTruthy();
    const select = screen.getByRole('combobox', { name: '神明之手其他操作', hidden: true });
    (select.closest('details') as HTMLDetailsElement).open = true; fireEvent.change(select, { target: { value: unavailable.id } });
    const button = screen.getByRole('button', { name: name => name.startsWith(unavailable.label) });
    expect(disabled(button)).toBe(true); expect(document.getElementById(button.getAttribute('aria-describedby')!)?.textContent).toBe(unavailable.reason);
    fireEvent.click(button); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('closes an unlocked page as navigation only', () => {
    const value = projection(), before = structuredClone(value), ui = show(value);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(ui.onClose).toHaveBeenCalledExactlyOnceWith(); expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

function beginCase(s: SliceState, caseId: DivineHandCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  s = ready(s, { ap: 3, cash: 80, health: 60, mind: 20, spirituality: 20 });
  s = ae(s, { type: 'OBSERVE', caseId }); s = ae(s, { type: 'PREPARE', caseId, method });
  for (const permission of ['OWNER', 'OPERATOR', 'PARTICIPANT'] as const) s = ae(s, { type: 'CONSENT', permission });
  if (method === 'ABILITY') s = ae(s, { type: 'CONSENT', permission: 'ABILITY' });
  return ae(s, { type: 'APPROACH' });
}
function ordinaryCase(s: SliceState, caseId: DivineHandCaseId): SliceState {
  s = beginCase(s, caseId, 'ORDINARY');
  for (const command of [{ type: 'ORDINARY_INSPECTION' }, { type: 'EXIT_ROOM' }, { type: 'LEAVE' }] as const) s = ae(s, command);
  return ae(ready(s), { type: 'REPORT', caseId });
}

describe('Divine Hand panel: actual finite practice and independent opponent', () => {
  it('shows the actual cast result and only advances a successful window through committed waiting', () => {
    let s = beginCase(promoted(), 'beam-support'); s = ae(s, { type: 'CONTACT_BEAM' });
    const value = projection(s), action = actualAction(value, command => command.type === 'BEAM_STABILIZE'), ui = show(value);
    const dialog = openAction(action); expect(dialog.textContent).toContain('8灵性'); expect(dialog.textContent).toContain('2精神');
    fireEvent.click(confirm(dialog)); s = ae(s, action.command);
    const saved = projection(s), window = () => screen.getByRole('region', { name: '当前时钟与一次能力窗口' });
    ui.rerender(<DivineHandPanel {...ui.props} value={saved} />);
    expect(saved.life.currentAttempt?.beam.effects).toBe(0);
    expect(saved.abilities.find(ability => ability.id === 'warrior.s1.beam-stabilize')?.mastery).toBe(0);
    if (saved.life.pending) {
      expect(window().textContent).toContain(`从${saved.life.pending.createdAt}秒至${saved.life.pending.expiresAt}秒，还剩20秒`);
      const before = window().textContent; ui.rerender(<DivineHandPanel {...ui.props} value={structuredClone(saved)} />);
      expect(window().textContent).toBe(before);
      s = ae(s, actualAction(saved, command => command.type === 'WAIT_10').command);
      const halfway = projection(s); ui.rerender(<DivineHandPanel {...ui.props} value={halfway} />);
      expect(window().textContent).toContain('还剩10秒');
      s = ae(s, actualAction(halfway, command => command.type === 'WAIT_10').command);
      ui.rerender(<DivineHandPanel {...ui.props} value={projection(s)} />);
      expect(window().textContent).toContain('当前没有尚未耗用的能力窗口');
      expect(screen.getByRole('region', { name: '原梁接触与实际检查' }).textContent).toContain('已经到期');
    } else {
      expect(window().textContent).toContain('当前没有尚未耗用的能力窗口');
      expect(screen.getByRole('region', { name: '原梁接触与实际检查' }).textContent).toContain('判定失败');
    }
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(action.command);
  }, 60_000);

  it('shows current permissions, real walking and a withdrawable next operation without local time', () => {
    let s = beginCase(promoted(), 'beam-support'); s = ae(s, { type: 'CONTACT_BEAM' });
    const value = projection(s), before = structuredClone(value), ui = show(value);
    expect(disabled(picker())).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('当前明确同意');
    expect(screen.getByRole('region', { name: '原梁接触与实际检查' }).textContent).toContain('当前实际接触原梁');
    expect(screen.getByRole('region', { name: '实际位置与普通退出' }).textContent).toContain('本阶段本人实走4米');
    expect(screen.getByRole('region', { name: '当前时钟与一次能力窗口' }).textContent).toContain(`现场时钟${s.glory.life.site.clockSeconds}秒`);
    const withdraw = actualAction(value, command => command.type === 'WITHDRAW_CONSENT' && command.permission === 'OWNER');
    fireEvent.click(confirm(openAction(withdraw))); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(withdraw.command);
    const withdrawn = projection(ae(s, withdraw.command)); ui.rerender(<DivineHandPanel {...ui.props} value={withdrawn} />);
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经撤回');
    expect(screen.getByRole('region', { name: '当前时钟与一次能力窗口' }).textContent).toContain('当前没有尚未耗用的能力窗口');
    expect(screen.getByRole('region', { name: '实际位置与普通退出' }).textContent).toContain('本人在修护台旁');
    expect(value).toEqual(before); expect(ui.onCommand).toHaveBeenCalledOnce();
  }, 60_000);

  it('shows a paid, delivered and prepared new load while the original load remains empty', () => {
    let s = ordinaryCase(promoted(), 'beam-support'); s = beginCase(s, 'armor-window');
    s = ae(s, { type: 'BUY_LOAD' }); const bought = projection(s), ui = show(bought);
    const section = () => screen.getByRole('region', { name: '有限新负载与原甲磨损' });
    expect(section().textContent).toContain('旧12千克负载剩余0次');
    expect(section().textContent).toContain('已实付30便士，12千克，当前在供应方处');
    expect(section().textContent).toContain('实际到货：尚未到货');
    for (const command of [{ type: 'RECEIVE_LOAD' }, { type: 'PREPARE_LOAD' }, { type: 'WEAR_PAD' }] as const) s = ae(s, command);
    const equipped = projection(s); ui.rerender(<DivineHandPanel {...ui.props} value={equipped} />);
    expect(section().textContent).toContain('当前在修护台旁；剩余1次'); expect(section().textContent).toContain('已经实际穿戴');
    s = ae(s, { type: 'ARMOR_CONVERGENCE' }); s = ae(s, { type: 'APPLY_LOAD' });
    const saved = projection(s); ui.rerender(<DivineHandPanel {...ui.props} value={saved} />);
    expect(section().textContent).toContain('剩余0次，已实际耗用1次'); expect(section().textContent).toContain('原安全垫剩余0份');
    expect(section().textContent).toContain('当前完整度55'); expect(section().textContent).toContain('原甲实际磨损5点');
    expect(saved.life.site.load.remainingLoads).toBe(0); expect(ui.onCommand).not.toHaveBeenCalled();
  }, 60_000);

  it('does not disclose the new opponent before real talk and requires a real policy confirmation', () => {
    let s = promoted();
    for (const caseId of ['beam-support', 'armor-window', 'withdrawn-support'] as const) s = ordinaryCase(s, caseId);
    s = ae(ready(s), { type: 'REFLECT' }); s = ready(s, { ap: 2, health: 60, mind: 20, spirituality: 20 });
    const value = projection(s), ui = show(value);
    expect(screen.getByRole('region', { name: '神明之手可选真实交战' }).textContent).toContain('尚未实际交谈');
    expect(ui.container.textContent).not.toContain('奥斯卡·里德');
    const talk = actualAction(value, command => command.type === 'ENCOUNTER_TALK');
    fireEvent.click(confirm(openAction(talk))); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(talk.command);
    s = ae(s, talk.command); const arrived = projection(s); ui.rerender(<DivineHandPanel {...ui.props} value={arrived} />);
    expect(screen.getByRole('region', { name: '神明之手可选真实交战' }).textContent).toContain('奥斯卡·里德');
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('默认显示不代表已经确认');
    const policy = actualAction(arrived, command => command.type === 'ENCOUNTER_POLICY' && command.policy === 'ORDINARY');
    fireEvent.click(confirm(openAction(policy))); s = ae(s, policy.command);
    const confirmed = projection(s); ui.rerender(<DivineHandPanel {...ui.props} value={confirmed} />);
    const fight = actualAction(confirmed, command => command.type === 'ENCOUNTER_FIGHT'), dialog = openAction(fight);
    expect(dialog.textContent).toContain('普通死亡终结本周目'); expect(dialog.textContent).toContain('只作普通行动');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(ui.onCommand).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('region', { name: '战场位置与普通出口' }).textContent).toContain('西莉娅在室外');
    expect(screen.getByRole('region', { name: '战场位置与普通出口' }).textContent).toContain('埃文在室外');
  }, 60_000);
});
