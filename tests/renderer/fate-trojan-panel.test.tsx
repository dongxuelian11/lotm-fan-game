/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FateTrojanPanel } from '../../src/renderer/FateTrojanPanel';
import { projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { FateTrojanCommand, FateTrojanProjection } from '../../src/domain/fate-trojan/types';
import { readObjectEntry } from '../helpers/read-object-entry';

// Actual recorded commands are the primary inputs. Renderer-only state variants below
// are explicitly labelled and are never replayed, persisted or called natural outcomes.
const ROOT = 'tests/fixtures/fate-trojan-v01750';
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const index = () => JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
function boundary(key: string): Boundary {
  const file = index()[key];
  if (!file) throw new Error(`Missing actual Fate Trojan boundary: ${key}`);
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(resolve(ROOT, file), 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(resolve(ROOT, file), 'lastIntent'),
    final: migrateSliceState(readObjectEntry<unknown>(resolve(ROOT, file), 'final')) };
}
function matching(fragment: string): Boundary {
  const key = Object.keys(index()).find(key => key.includes(fragment));
  if (!key) throw new Error(`Missing actual Fate Trojan boundary matching: ${fragment}`);
  return boundary(key);
}
const view = (state: SliceState) => projectSliceState(state).fateTrojan;
function commandOf(entry: Boundary): FateTrojanCommand {
  if (entry.lastIntent.type !== 'FATE_TROJAN') throw new Error('Expected an actual Fate Trojan public command.');
  return entry.lastIntent.command;
}
function projectedAction(value: FateTrojanProjection, command: FateTrojanCommand) {
  const action = value.actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing original projected action for ${command.type}`);
  return action;
}
async function control(value: FateTrojanProjection, command: FateTrojanCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  if ('caseId' in command) {
    const select = screen.queryByRole('combobox', { name: '查看实践' }) as HTMLSelectElement | null;
    if (select && !select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
  const action = projectedAction(value, command);
  const button = screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
  const folds: HTMLDetailsElement[] = [];
  for (let node = button.parentElement; node; node = node.parentElement) if (node instanceof HTMLDetailsElement && !node.open) folds.unshift(node);
  for (const fold of folds) await userEvent.click(fold.querySelector('summary')!);
  return button;
}
function renderValue(value: FateTrojanProjection) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const props = { value, busy: false, error: null, onCommand, onClose };
  return { ...render(<FateTrojanPanel {...props}/>), props, onCommand, onClose };
}
const confirmLabel = (command: FateTrojanCommand) => command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作';
function playerCopy(node: HTMLElement) {
  expect(node.textContent).not.toMatch(/候选G|原创G|本作G|原文核验|名称编号待核|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])/);
  expect(node.textContent).not.toMatch(/"(?:playerEnergy|recognitionHolder|appliedAbilityIds)"\s*:/);
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
beforeEach(() => Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } }));
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});

describe('Fate Trojan original bottles, preparation and commit-safe confirmation', () => {
  it.each(['independent-guidance-paid500', 'independent-purchase900', 'actual-current-week-preparation140', 'actual-promotion'])('%s shows real costs without submitting', async fragment => {
    const entry = matching(fragment), value = view(entry.beforeLast), command = commandOf(entry), saved = structuredClone(value), ui = renderValue(value);
    const resources = screen.getByRole('region', { name: '命运木马当前资源' });
    expect(resources.closest('details')).toBeNull();
    for (const text of [`${entry.beforeLast.health}/100`, `${entry.beforeLast.mind}/100`, `${entry.beforeLast.spirituality}/120`, value.resources!.cash]) expect(resources.textContent).toContain(text);
    await userEvent.click(await control(value, command));
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain(projectedAction(value, command).cost); playerCopy(dialog);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(saved);
  });

  it('cancels with focus restoration, then submits the selected original bottle exactly once', async () => {
    const entry = boundary('actual-promotion'), value = view(entry.beforeLast), command = commandOf(entry), ui = renderValue(value), saved = structuredClone(value);
    const trigger = await control(value, command);
    for (const mode of ['button', 'escape', 'native']) {
      await userEvent.click(trigger); const dialog = screen.getByRole('dialog');
      const cancel = within(dialog).getByRole('button', { name: '取消，返回查看' }); expect(document.activeElement).toBe(cancel);
      for (const text of ['当前成功率', '无论成功失败都会耗尽', '费用不退', '重新检查', '十二项已有掌握', '不补满当前灵性']) expect(dialog.textContent).toContain(text);
      if (mode === 'button') await userEvent.click(cancel);
      else if (mode === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' });
      else fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger); expect(ui.onCommand).not.toHaveBeenCalled();
    }
    await userEvent.click(trigger); const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: confirmLabel(command) });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(ui.onCommand.mock.calls[0]![0]).toBe(projectedAction(value, command).command); expect(value).toEqual(saved);
    ui.rerender(<FateTrojanPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).toHaveBeenCalledOnce();
  });

  it.each(['independent-purchase900', 'actual-current-week-preparation140', 'actual-promotion', 'identity-paid-check-and-actual-taken-state'])('%s keeps one pending intent across failed and unchanged saves', async fragment => {
    const entry = matching(fragment), value = view(entry.beforeLast), command = commandOf(entry), ui = renderValue(value);
    await userEvent.click(await control(value, command));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: confirmLabel(command) }));
    ui.rerender(<FateTrojanPanel {...ui.props} busy/>);
    for (const error of [{ message: '本次原操作保存失败', retryable: true }, null]) {
      ui.rerender(<FateTrojanPanel {...ui.props} value={structuredClone(value)} error={error}/>);
      for (const button of screen.getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
      for (const select of screen.getAllByRole('combobox', { hidden: true })) expect((select as HTMLSelectElement).disabled).toBe(true);
      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) })); fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(screen.getByRole('dialog')).toBeTruthy(); expect(ui.onCommand).toHaveBeenCalledOnce(); expect(ui.onClose).not.toHaveBeenCalled();
      expect(screen.queryByRole('button', { name: /重试/, hidden: true })).toBeNull();
    }
    ui.rerender(<FateTrojanPanel {...ui.props} value={view(entry.final)} error="保存仍待同一次重试"/>);
    expect(screen.getByRole('dialog')).toBeTruthy(); expect(ui.onCommand).toHaveBeenCalledOnce();
    ui.rerender(<FateTrojanPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByRole('region', { name: '命运木马' }).getAttribute('aria-busy')).toBe('false');
  });

  it('invalidates an unsubmitted confirmation when public facts change', async () => {
    const entry = boundary('actual-promotion'), value = view(entry.beforeLast), ui = renderValue(value);
    await userEvent.click(await control(value, commandOf(entry)));
    ui.rerender(<FateTrojanPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('traps keyboard focus in confirmation without spending resources', async () => {
    const entry = boundary('actual-promotion'), value = view(entry.beforeLast), ui = renderValue(value);
    await userEvent.click(await control(value, commandOf(entry)));
    const dialog = screen.getByRole('dialog'), buttons = within(dialog).getAllByRole('button');
    buttons[0]!.focus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(buttons.at(-1));
    buttons.at(-1)!.focus(); fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(buttons[0]);
    expect(ui.onCommand).not.toHaveBeenCalled();
  });
});

describe('Fate Trojan actual recognition, responsibility, original people and cleanup', () => {
  it('shows all twelve inherited masteries and the two new actual values from the full public projection', async () => {
    const value = view(boundary('actual-promotion').final); renderValue(value);
    expect(value.abilities).toHaveLength(14);
    const fresh = screen.getByRole('region', { name: '命运木马两项技巧' });
    await userEvent.click(screen.getByText('身体与已有经历'));
    const inherited = screen.getByRole('region', { name: '命运木马十二项已有掌握' });
    for (const ability of value.abilities) {
      const target = ability.id === 'error.s2.identity-link' || ability.id === 'error.s2.fate-assumption' ? fresh : inherited;
      expect(target.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    }
    playerCopy(fresh); playerCopy(inherited);
  });

  it.each(['identity-paid-check-and-actual-taken-state', 'fate-paid-check-and-actual-assumption', 'revoked-current-owner-withdrawal-after-paid-preparation'])('%s displays current evidence outside folds', key => {
    const entry = boundary(key), value = view(entry.final), saved = structuredClone(value), ui = renderValue(value), p = value.life.site;
    const site = screen.getByRole('region', { name: '命运木马登记室当前实况' }), people = screen.getByRole('region', { name: '命运木马本人及原人位置与当前许可' });
    expect(site.closest('details')).toBeNull(); expect(people.closest('details')).toBeNull();
    for (const text of [`累计现场时间${p.clockSeconds}秒`, `实际搬运${p.parcel.ordinaryMetres}米`, `已付本人${p.fate.paidToPlayer}便士`]) expect(site.textContent).toContain(text);
    for (const text of ['莉娜，39岁', '维克托，43岁', `本场精力${p.playerEnergy}/100`, `累计普通步行${p.playerTravelMetres}米`]) expect(people.textContent).toContain(text);
    expect(site.textContent).toContain(p.link.returnPending ? '仍欠当面归还，另付4灵性' : '没有尚欠的身份联系');
    expect(site.textContent).toContain(p.fate.status === 'ASSUMED' ? '本人已接下，仍须亲自完成' : p.fate.status === 'COMPLETED' ? '已经实际完成' : '原主原先的待办尚未完成');
    expect((screen.getByRole('button', { name: '关闭命运木马页面' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看实践' }) as HTMLSelectElement).disabled).toBe(true);
    playerCopy(site); playerCopy(people); expect(value).toEqual(saved); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('shows the actual identity result without turning a failed or unused check into mastery', () => {
    const value = view(boundary('identity-paid-check-and-actual-taken-state').final); renderValue(value);
    const a = value.life.currentAttempt!, attempt = screen.getByRole('region', { name: '命运木马本次尝试' });
    expect(attempt.textContent).toContain('实际应用：无');
    expect(attempt.textContent).toContain(a.identityTaken ? '检定成功，但尚无实际应用' : '检定失败，已经支付的成本保留');
    expect(value.abilities.find(a => a.id === 'error.s2.identity-link')?.mastery).toBe(0);
  });

  it('confirms real carry costs and retains original ownership, burden and one payout', async () => {
    const entry = matching('carry-and-cost'), value = view(entry.beforeLast), command = commandOf(entry), ui = renderValue(value);
    await userEvent.click(await control(value, command)); const dialog = screen.getByRole('dialog');
    for (const text of ['步行8米', '5健康', '5精力', '12便士', '仍归维克托所有', '亲自返回原柜合门']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand.mock.calls[0]![0]).toBe(projectedAction(value, command).command);
    ui.rerender(<FateTrojanPanel {...ui.props} value={view(entry.final)}/>);
    const site = screen.getByRole('region', { name: '命运木马登记室当前实况' });
    expect(site.textContent).toContain('已付本人12便士'); expect(site.textContent).toContain('已付5健康、5精力');
    expect(site.textContent).toContain('已在室外'); expect(site.textContent).toContain('由本人完成');
  });

  it('keeps actual STOP available while navigation is locked after withdrawal', async () => {
    const value = view(boundary('revoked-current-owner-withdrawal-after-paid-preparation').final), ui = renderValue(value);
    const command = value.actions.find(a => a.enabled && a.command.type === 'STOP')!.command;
    const stop = await control(value, command); expect(stop.disabled).toBe(false);
    await userEvent.click(stop); expect(ui.onCommand.mock.calls[0]![0]).toBe(projectedAction(value, command).command); expect(ui.onClose).not.toHaveBeenCalled();
  });

  it('directed renderer case: real-cost return still asks for 4 spirituality and never calls page-close', async () => {
    // Directed display coverage if the natural check happened to fail. No domain state is changed.
    const value = structuredClone(view(boundary('identity-paid-check-and-actual-taken-state').final));
    const command: FateTrojanCommand = { type: 'RETURN_LINK', caseId: 'identity-link' };
    value.actions = [{ id: 'renderer-only-return', label: '当面归还同一识别联系', cost: '0行动 · 4灵性', enabled: true, reason: null, command }];
    value.life.site.link.holder = 'PLAYER'; value.life.site.link.returnPending = true; value.life.site.playerLocation = 'DESK';
    value.life.site.cabinet.open = false; value.life.site.cabinet.recognitionHolder = 'PLAYER'; value.life.ownerCanOpenCabinet = false;
    const ui = renderValue(value); await userEvent.click(await control(value, command));
    const dialog = screen.getByRole('dialog'); for (const text of ['另付4灵性', '耗时2秒', '当面归还维克托', '到期和停止都不能免除']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand.mock.calls[0]![0]).toBe(command); expect(ui.onClose).not.toHaveBeenCalled();
  });

  it('shows Elias as a separate original adult with actual remaining enemy resources', async () => {
    const entry = boundary('original-elias46-actual-consented-approach'), value = view(entry.final), ui = renderValue(value), e = value.encounter.enemy!;
    const encounter = screen.getByRole('region', { name: '命运木马可选遭遇' });
    for (const text of ['伊莱亚斯，46岁', `健康${e.health}/100`, `精神${e.mind}/100`, `独立灵性${e.spirituality}/120`, '他原来的一根棍']) expect(encounter.textContent).toContain(text);
    const leave = value.actions.find(a => a.enabled && a.command.type === 'LEAVE_ENCOUNTER')!;
    expect((screen.getByRole('button', { name: '关闭命运木马页面' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(await control(value, leave.command)); const dialog = screen.getByRole('dialog');
    for (const text of ['步行2米', '2秒和2精力', '原棍留在庭院']) expect(dialog.textContent).toContain(text);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  });
});
