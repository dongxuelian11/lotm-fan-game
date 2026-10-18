/* @vitest-environment jsdom */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathConsulPanel } from '../../src/renderer/DeathConsulPanel';
import { projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { DeathConsulCommand, DeathConsulProjection } from '../../src/domain/death-consul/types';
import { readObjectEntry } from '../helpers/read-object-entry';

// Actual integration inputs are full recorded before/command/after boundaries.
// Directed renderer-only changes below are labelled and never saved or replayed.
// Missing natural evidence is a failure, never a synthesized successful outcome.
const ROOT = 'tests/fixtures/death-consul-v01730';
const PANEL = '死亡执政官';
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
function boundary(key: string): Boundary {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  const entry = index[key];
  if (!entry) throw new Error(`Missing actual Death Consul boundary: ${key}`);
  const file = resolve(ROOT, entry);
  return { beforeLast: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
}
function snapshot(key: 'promoted' | 'practiced' | 'final') {
  const file = `${ROOT}/snapshot-${key}.json`;
  return migrateSliceState(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
}
const view = (state: SliceState) => projectSliceState(state).deathConsul;
function commandOf(entry: Boundary): DeathConsulCommand {
  if (entry.lastIntent.type !== 'DEATH_CONSUL') throw new Error('Expected an actual Death Consul command capture.');
  return entry.lastIntent.command;
}
function projectedAction(value: DeathConsulProjection, command: DeathConsulCommand) {
  const action = value.actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public action: ${JSON.stringify(command)}`);
  return action;
}
function actionButton(value: DeathConsulProjection, command: DeathConsulCommand) {
  const action = projectedAction(value, command);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(value: DeathConsulProjection, command: DeathConsulCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  if ('caseId' in command) {
    const select = screen.queryByRole('combobox', { name: '查看实践' }) as HTMLSelectElement | null;
    if (select && !select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
  const button = actionButton(value, command), folds: HTMLDetailsElement[] = [];
  for (let node = button.parentElement; node; node = node.parentElement) if (node instanceof HTMLDetailsElement && !node.open) folds.unshift(node);
  for (const fold of folds) await userEvent.click(fold.querySelector('summary')!);
  return button;
}
const confirmationName = (command: DeathConsulCommand) => command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险';
const confirmLabel = (command: DeathConsulCommand) => command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作';
function renderValue(value: DeathConsulProjection) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const props = { value, busy: false, error: null, onCommand, onClose };
  return { ...render(<DeathConsulPanel {...props}/>), props, onCommand, onClose };
}
function playerCopy(node: HTMLElement) {
  expect(node.textContent).not.toMatch(/未核实候选|候选G|名称编号待核|原文核验|原创G|本作G|(?<![A-Za-z0-9_.-])G(?=\d)|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])/);
  expect(node.textContent).not.toMatch(/玛拉|芦影|采光廊|定向光辉|有限收光|灯油|遮光闸/);
  expect(node.textContent).not.toMatch(/"(?:operatorEnergy|playerLocation|appliedAbilityIds)"\s*:/);
}
function assertSite(value: DeathConsulProjection) {
  const p = value.life.site, site = screen.getByRole('region', { name: '死亡执政官双室封存场当前实况' });
  const people = screen.getByRole('region', { name: '死亡执政官本人同伴位置与当前许可' });
  expect(site.closest('details')).toBeNull(); expect(people.closest('details')).toBeNull();
  for (const text of [`直距${p.lengthMetres}米`, `每程${p.ordinaryRouteMetres}米`, `累计操作时间${p.elapsedSeconds}秒`]) expect(site.textContent).toContain(text);
  if (p.sourceEra === null) {
    expect(site.textContent).toContain('尚未当面接触'); expect(people.textContent).toContain('尚无本人的行程或同伴接触记录');
    expect(site.textContent).not.toContain('DC2-POST-CYCLE-ECHO'); expect(people.textContent).not.toContain('独立精力100');
  } else {
    for (const text of [p.residual.id!, `残余强度${p.residual.strength}`, `${p.residual.scorch}处灼痕`, `余热还需${p.residual.heatSeconds}秒`, `已实际操作${p.door.operations}次`]) expect(site.textContent).toContain(text);
    for (const text of [p.operatorName!, `${p.operatorAge}岁`, `独立精力${p.operatorEnergy}/100`, `累计普通行走${p.playerMetres}米`, `短渡${p.playerPassageMetres}米`, `累计普通行走${p.operatorMetres}米`, `短渡${p.operatorPassageMetres}米`]) expect(people.textContent).toContain(text);
    expect(site.textContent).toContain(p.material.acquired ? `已实付${p.material.paidPennies}便士，剩余${p.material.remaining}份` : '尚未购买，本人持有0份');
  }
  playerCopy(site); playerCopy(people);
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Death Consul actual channels, independent bottles and saved-state locks', () => {
  it('projects the genuine611 continuation with the real post-cycle quote and unchanged old wounds and reed', () => {
    const state = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/ferryman-v01490/natural.json', 'final'));
    const before = structuredClone(state), value = view(state), ui = renderValue(value);
    expect(state.week).toBe(3260); expect(state.health).toBe(40); expect(state.ferryman.life.reed.energy).toBe(91); expect(state.ferryman.life.reed.travelMetres).toBe(22);
    expect(value.sourceEra).toBeNull(); expect(value.prices).toEqual({ guidance: 120, potion: 1200, labourCredit: 1120, labourBalance: 80, preparation: 20 });
    const section = screen.getByRole('region', { name: '死亡执政官独立药瓶与准备' });
    for (const text of ['汉娜', '尚未完成本次来源登记', '专业指导120便士', '每瓶1200便士', '抵1120便士', '支付80便士', '20便士']) expect(section.textContent).toContain(text);
    expect(screen.getByRole('region', { name: '死亡执政官当前资源' }).textContent).toContain('40/100');
    expect(state).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('uses original-era quotations only from the separate genuine original branch', () => {
    const state = migrateSliceState(readObjectEntry<unknown>('tests/fixtures/ferryman-v01490/original.json', 'final'));
    const value = view(state), ui = renderValue(value);
    expect(value.prices).toEqual({ guidance: 500, potion: 6200, labourCredit: 5400, labourBalance: 800, preparation: 120 });
    const section = screen.getByRole('region', { name: '死亡执政官独立药瓶与准备' });
    for (const text of ['路易斯', '指导500便士', '每瓶6200便士', '抵5400便士', '支付800便士', '120便士']) expect(section.textContent).toContain(text);
    expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it.each(['independent-guidance', 'buy-independent-bottle', 'current-week-paid-preparation', 'public-consume'] as const)('%s shows the actual cost and original resources before any command', async key => {
    const entry = boundary(key), value = view(entry.beforeLast), command = commandOf(entry), original = structuredClone(value), ui = renderValue(value);
    const resource = screen.getByRole('region', { name: '死亡执政官当前资源' }); expect(resource.closest('details')).toBeNull();
    for (const text of [`${entry.beforeLast.health}/100`, `${entry.beforeLast.mind}/100`, `${entry.beforeLast.spirituality}/120`, value.resources!.cash]) expect(resource.textContent).toContain(text);
    await userEvent.click(await control(value, command));
    const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    expect(dialog.textContent).toContain(projectedAction(value, command).cost); playerCopy(dialog);
    expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(original);
  });

  it('cancels without cost, then submits only the reviewed original bottle once', async () => {
    const entry = boundary('public-consume'), value = view(entry.beforeLast), command = commandOf(entry), ui = renderValue(value), saved = structuredClone(value);
    if (command.type !== 'CONSUME') throw new Error('Expected actual consume capture.');
    const trigger = await control(value, command);
    for (const cancellation of ['pointer', 'escape', 'native'] as const) {
      await userEvent.click(trigger); const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
      const cancel = within(dialog).getByRole('button', { name: '取消，返回查看' }); expect(document.activeElement).toBe(cancel);
      for (const text of [command.bottleId, '当前成功率', '无论成功失败都会耗尽', '费用不退', '重新检查', '不补满当前灵性', '意志难度30', '严重失败']) expect(dialog.textContent).toContain(text);
      expect(within(dialog).queryByRole('checkbox')).toBeNull();
      if (cancellation === 'pointer') await userEvent.click(cancel);
      else if (cancellation === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' });
      else fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger); expect(ui.onCommand).not.toHaveBeenCalled();
    }
    await userEvent.click(trigger); const confirm = within(screen.getByRole('dialog')).getByRole('button', { name: confirmLabel(command) });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(ui.onCommand.mock.calls[0]![0]).toBe(projectedAction(value, command).command);
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true'); expect(value).toEqual(saved);
    ui.rerender(<DeathConsulPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).toHaveBeenCalledOnce();
  });

  it.each(['buy-independent-bottle', 'current-week-paid-preparation'] as const)('%s never drinks as a side effect', async key => {
    const entry = boundary(key), value = view(entry.beforeLast), command = commandOf(entry), ui = renderValue(value);
    await userEvent.click(await control(value, command)); await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    ui.rerender(<DeathConsulPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(entry.final.progression.sequence).toBe(3);
    expect(entry.final.deathConsul.bottles.filter(b => b.status === 'CONSUMED')).toEqual(entry.beforeLast.deathConsul.bottles.filter(b => b.status === 'CONSUMED'));
  });

  it.each(['buy-independent-bottle', 'current-week-paid-preparation', 'public-consume', 'pale-residue-paid-window'] as const)('%s remains the same locked intent through failed, cleared and unchanged-clone saves', async key => {
    const entry = boundary(key), value = view(entry.beforeLast), command = commandOf(entry), ui = renderValue(value);
    await userEvent.click(await control(value, command));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: confirmLabel(command) }));
    ui.rerender(<DeathConsulPanel {...ui.props} busy/>);
    for (const error of [{ message: '本次原操作保存失败', retryable: true }, null] as const) {
      ui.rerender(<DeathConsulPanel {...ui.props} value={structuredClone(value)} error={error}/>);
      const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
      for (const button of screen.getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
      for (const select of screen.getAllByRole('combobox', { hidden: true })) expect((select as HTMLSelectElement).disabled).toBe(true);
      expect(screen.queryByRole('button', { name: /重试/, hidden: true })).toBeNull();
      fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) })); fireEvent.keyDown(dialog, { key: 'Escape' }); fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.getByRole('dialog')).toBeTruthy(); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(ui.onClose).not.toHaveBeenCalled();
    }
    // Even changed public facts do not clear an outstanding parent save error.
    ui.rerender(<DeathConsulPanel {...ui.props} value={view(entry.final)} error="保存仍待同一次重试"/>);
    expect(screen.getByRole('dialog')).toBeTruthy(); expect(ui.onCommand).toHaveBeenCalledOnce();
    ui.rerender(<DeathConsulPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('false');
  });

  it.each(['busy', 'blocked', 'error'] as const)('%s blocks commands and navigation before submission', lock => {
    const value = view(boundary('buy-independent-bottle').beforeLast), onCommand = vi.fn(), onClose = vi.fn();
    render(<DeathConsulPanel value={value} busy={lock === 'busy'} blocked={lock === 'blocked'} error={lock === 'error' ? { message: '保存失败', retryable: false } : null} onCommand={onCommand} onClose={onClose}/>);
    for (const button of screen.getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement).disabled).toBe(true);
    expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    if (lock === 'error') expect(screen.getByRole('alert').textContent).toContain('重新加载');
  });

  it('traps confirmation focus and invalidates an unsubmitted review when public facts change', async () => {
    const entry = boundary('public-consume'), command = commandOf(entry), ui = renderValue(view(entry.beforeLast));
    await userEvent.click(await control(ui.props.value, command));
    const dialog = screen.getByRole('dialog'), cancel = within(dialog).getByRole('button', { name: '取消，返回查看' }), confirm = within(dialog).getByRole('button', { name: confirmLabel(command) });
    cancel.focus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(cancel);
    // Directed display-only update; this is not a new natural state or receipt.
    const changed = structuredClone(ui.props.value); changed.resources!.cash = '0便士';
    ui.rerender(<DeathConsulPanel {...ui.props} value={changed}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  });
});

describe('Death Consul original people, finite materials and current permission', () => {
  it('does not introduce a companion, residual identity or full-energy replacement before real observation', () => {
    const value = view(snapshot('promoted')), ui = renderValue(value);
    expect(value.life.site.sourceEra).toBeNull(); expect(value.life.site.operatorId).toBeNull(); expect(value.life.site.residual.id).toBeNull();
    assertSite(value); expect(value.encounter.enemy).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it.each([['pale-residue', 7, '意志20'], ['short-passage', 6, '知识20'], ['withdrawn-passage', 6, '知识20']] as const)('confirms actual %s cost without promising successful application', async (id, cost, difficulty) => {
    const entry = boundary(`${id}-paid-window`), command = commandOf(entry), value = view(entry.beforeLast), ui = renderValue(value);
    await userEvent.click(await control(value, command)); const dialog = screen.getByRole('dialog');
    for (const text of [`${cost}灵性`, difficulty, '20秒', '检定失败仍支付成本', '停止']) expect(dialog.textContent).toContain(text);
    expect(ui.onCommand).not.toHaveBeenCalled(); await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command); ui.rerender(<DeathConsulPanel {...ui.props} value={view(entry.final)}/>);
    expect(entry.final.spirituality).toBe(entry.beforeLast.spirituality - cost); expect(entry.final.progression.mastery).toEqual(entry.beforeLast.progression.mastery);
    expect(screen.getByRole('region', { name: '死亡执政官本次尝试' }).textContent).toContain('实际应用：无'); assertSite(view(entry.final));
  });

  it.each(['public-buy_seal-pale-residue', 'public-open_container-pale-residue', 'public-seal_container-pale-residue', 'public-check_endpoints-short-passage', 'public-return_group-short-passage', 'public-return_residual-short-passage'] as const)('shows actual %s resources and positions without restoration', key => {
    const entry = boundary(key), before = structuredClone(entry.beforeLast), ui = renderValue(view(entry.beforeLast));
    assertSite(ui.props.value); ui.rerender(<DeathConsulPanel {...ui.props} value={view(entry.final)}/>); assertSite(view(entry.final));
    expect(entry.beforeLast).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('keeps current withdrawal above history, forbids transport and exposes a real stop', async () => {
    const entry = boundary('withdrawn-passage-current-withdrawal'), value = view(entry.final), ui = renderValue(value), before = structuredClone(value);
    expect(value.life.site.operatorConsent).toBe('WITHDRAWN'); expect(value.life.currentAttempt!.appliedAbilityIds).toEqual([]);
    expect(entry.final.spirituality).toBe(entry.beforeLast.spirituality); expect(entry.final.deathConsul.life.site.operatorLocation).toBe(entry.beforeLast.deathConsul.life.site.operatorLocation);
    const people = screen.getByRole('region', { name: '死亡执政官本人同伴位置与当前许可' });
    for (const text of ['已撤回本次许可', '本次不得再运输她', '须停止通路', '行动、灵性和时间保留']) expect(people.textContent).toContain(text);
    const stop = value.actions.find(a => a.command.type === 'STOP' && a.enabled)!;
    expect(stop).toBeTruthy(); expect(actionButton(value, stop.command).disabled).toBe(false);
    expect(value.actions.filter(a => a.enabled && a.command.type === 'CROSS_PASSAGE')).toEqual([]);
    expect((screen.getByRole('button', { name: '关闭死亡执政官页面' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(await control(value, stop.command)); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(stop.command); expect(ui.onClose).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });

  it('distinguishes paid successful windows, failed windows and expiry in directed presentation-only projections', () => {
    const original = view(boundary('short-passage-paid-window').final), saved = structuredClone(original);
    const success = structuredClone(original), attempt = success.life.currentAttempt!;
    attempt.abilityTier = 'SUCCESS'; attempt.window = 'ACTIVE'; attempt.windowExpiresAt = success.life.site.elapsedSeconds + 20; attempt.appliedAbilityIds = [];
    success.life.site.effect = { mode: 'PASSAGE', expiresAt: attempt.windowExpiresAt };
    const ui = renderValue(success), current = () => screen.getByRole('region', { name: '死亡执政官本次尝试' });
    expect(current().textContent).toContain('检定成功，但没有实际应用'); expect(current().textContent).toContain('剩余20秒');
    const failed = structuredClone(success); failed.life.currentAttempt!.abilityTier = 'FAILURE'; failed.life.currentAttempt!.window = 'FAILED'; failed.life.currentAttempt!.windowExpiresAt = null; failed.life.site.effect = { mode: 'OFF', expiresAt: null };
    ui.rerender(<DeathConsulPanel {...ui.props} value={failed}/>);
    expect(current().textContent).toContain('检定失败，已付消耗保留'); expect(current().textContent).toContain(`实耗${attempt.spiritualitySpent}灵性`);
    const expired = structuredClone(success); expired.life.site.elapsedSeconds += 20; expired.life.site.effect = { mode: 'OFF', expiresAt: null }; expired.life.currentAttempt!.window = 'EXPIRED';
    ui.rerender(<DeathConsulPanel {...ui.props} value={expired}/>);
    expect(current().textContent).toContain('窗口已到期'); expect(current().textContent).toContain('实际应用：无');
    expect(original).toEqual(saved); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('displays directed persistent scorch, heat, spent material and different current body locations literally', () => {
    // This renderer-only projection intentionally covers a state the natural dice
    // may not produce. It is neither persisted nor evidence of legal eligibility.
    const value = structuredClone(view(snapshot('practiced'))), p = value.life.site;
    p.playerLocation = 'FAR'; p.operatorLocation = 'ENTRY'; p.playerMetres = 67; p.playerPassageMetres = 6;
    p.operatorMetres = 12; p.operatorPassageMetres = 6; p.operatorEnergy = 82;
    p.door.state = 'BLOCKED'; p.residual.strength = 1; p.residual.scorch = 1; p.residual.heatSeconds = 13;
    p.residual.seal = 'RESEALED'; p.material.acquired = true; p.material.paidPennies = 4; p.material.remaining = 0;
    const ui = renderValue(value); assertSite(value);
    const people = screen.getByRole('region', { name: '死亡执政官本人同伴位置与当前许可' });
    expect(people.textContent).toContain('本人当前在另一室端点（6米）'); expect(people.textContent).toContain('当前在近室入口（0米）');
    const site = screen.getByRole('region', { name: '死亡执政官双室封存场当前实况' });
    for (const text of ['门闩阻挡', '残余强度1', '1处灼痕', '余热还需13秒', '已实付4便士，剩余0份']) expect(site.textContent).toContain(text);
    expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('renders all17 actual mastery entries and keeps original reed and old episodes read-only', async () => {
    const state = snapshot('practiced'), saved = structuredClone(state), value = view(state), ui = renderValue(value);
    expect(value.abilities).toHaveLength(17); expect(new Set(value.abilities.map(a => a.id)).size).toBe(17);
    expect(state.ferryman.life.reed.energy).toBe(91); expect(state.ferryman.life.reed.travelMetres).toBe(22);
    for (const name of ['三案经历与技巧掌握', '身体与已有经历', '独立药瓶与专业准备记录']) {
      const summary = screen.getByText(name, { selector: 'summary' }); await userEvent.click(summary);
      expect(within(summary.closest('details')!).queryByRole('button')).toBeNull();
    }
    const panel = screen.getByRole('region', { name: PANEL });
    for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    for (const text of ['FR3-REED', '精力91', '22米', '普通死亡不会即时复活', '十五项已有掌握保留']) expect(panel.textContent).toContain(text);
    assertSite(value); expect(state).toEqual(saved); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  });

  it('preserves externally supplied custom names in a directed text-only projection', () => {
    const value = structuredClone(view(snapshot('promoted'))); value.inheritedHistory = ['角色姓名：G·候选之羽'];
    const ui = renderValue(value); expect(ui.container.textContent).toContain('角色姓名：G·候选之羽'); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('uses closing only for navigation after real cleanup', async () => {
    const value = view(snapshot('practiced')), before = structuredClone(value), ui = renderValue(value);
    expect(value.insideCase).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: '关闭死亡执政官页面' }));
    expect(ui.onClose).toHaveBeenCalledOnce(); expect(ui.onCommand).not.toHaveBeenCalled(); expect(value).toEqual(before);
  });
});

describe('Death Consul optional conflict retains the original bodies and finite budgets', () => {
  it('separately confirms real combat with the current adult after the companion actually exits', async () => {
    const entry = boundary('original-enemy-fight'), value = view(entry.beforeLast), command = commandOf(entry), ui = renderValue(value);
    expect(value.life.site.operatorLocation).toBe('OUTSIDE'); expect(value.encounter.enemy!.name).toBe('诺兰·艾文');
    assertSite(value); await userEvent.click(await control(value, command));
    const dialog = screen.getByRole('dialog');
    for (const text of ['诺兰·艾文', '各自的身体', '死亡', '实际离开', '不会恢复任何资源']) expect(dialog.textContent).toContain(text);
    playerCopy(dialog); expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) })); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
  });

  it('displays actual terminal resources, the same weapon and final positions without resetting the scene', async () => {
    const state = snapshot('final'), before = structuredClone(state), value = view(state), onCommand = vi.fn();
    render(<DeathConsulPanel value={value} busy={false} blocked onCommand={onCommand}/>);
    const summary = screen.queryByText('封存场的可选冲突', { selector: 'summary' }); if (summary) await userEvent.click(summary);
    const region = screen.getByRole('region', { name: '死亡执政官可选遭遇' }), enemy = value.encounter.enemy!;
    for (const text of [enemy.name, `${enemy.age}岁`, `健康${enemy.health}/100`, `独立灵性${enemy.spirituality}/120`, `有限苍白法术（每次5灵性）：${enemy.powerUses.PALE_STRIKE}次`, `一次定神（每次4灵性）：${enemy.powerUses.STEADY}次`]) expect(region.textContent).toContain(text);
    if (enemy.spirituality !== 120) expect(region.textContent).not.toContain('独立灵性120/120');
    expect(region.textContent).toContain(enemy.weaponLocation === 'HAND' ? `仍在${enemy.name}手中` : '留在另一室门内（4米）');
    assertSite(value); playerCopy(region); expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
