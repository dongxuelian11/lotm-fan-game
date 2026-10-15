/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatastrophePanel } from '../../src/renderer/CatastrophePanel';
import { projectSliceState } from '../../src/domain/slice';
import type { SliceState } from '../../src/domain/slice/types';
import type { CatastropheCommand } from '../../src/domain/catastrophe/types';
import type { CatastropheCaseId } from '../../src/domain/catastrophe/life';
import { catastropheBoundaryForIntent, catastropheSnapshot, type CatastropheBoundary } from '../domain/catastrophe-helper';

// Every view below starts from a recorded public-command capture. These tests
// never edit a seed, resource, permission, injury, object, outcome or saved history.
const PANEL = '天灾有限切片';
const view = (state: SliceState) => projectSliceState(state).catastrophe;
const confirmationName = (command: CatastropheCommand) => command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次真实消耗与风险';
const confirmLabel = (command: CatastropheCommand) => command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作';
function boundary(type: CatastropheCommand['type'], accept?: (entry: CatastropheBoundary) => boolean) {
  return catastropheBoundaryForIntent(intent => intent.type === 'CATASTROPHE' && intent.command.type === type, accept);
}
function lifeBoundary(type: CatastropheCommand['type'], caseId: CatastropheCaseId) {
  return catastropheBoundaryForIntent(intent => intent.type === 'CATASTROPHE' && intent.command.type === type && 'caseId' in intent.command && intent.command.caseId === caseId);
}
function commandOf(entry: CatastropheBoundary) {
  if (entry.lastIntent.type !== 'CATASTROPHE') throw new Error('Expected an actual Catastrophe command capture.');
  return entry.lastIntent.command;
}
function actionButton(state: SliceState, command: CatastropheCommand) {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing recorded public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: CatastropheCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  if ('caseId' in command) {
    const select = screen.queryByRole('combobox', { name: '查看实践' }) as HTMLSelectElement | null;
    if (select && !select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
  const button = actionButton(state, command), folds: HTMLDetailsElement[] = [];
  for (let node = button.parentElement; node; node = node.parentElement) if (node instanceof HTMLDetailsElement && !node.open) folds.unshift(node);
  for (const fold of folds) await userEvent.click(fold.querySelector('summary')!);
  return button;
}
function playerCopy(node: HTMLElement) {
  // G in immutable ASCII identities/enums (CT2-GATE, GRANTED) is not an authoring badge.
  expect(node.textContent).not.toMatch(/未核实候选|候选G|名称编号待核|原文核验|原著|原创G|本作G|(?<![A-Za-z0-9_.-])G(?=\d)|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])|\dG(?=[\s，；。、：）)\/×%\u3400-\u9fff])/);
}
function renderState(state: SliceState) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const props = { value: view(state), busy: false, error: null, onCommand, onClose };
  return { ...render(<CatastrophePanel {...props}/>), props, onCommand, onClose };
}
function assertSite(state: SliceState) {
  const site = state.catastrophe.life.site, region = screen.getByRole('region', { name: '天灾当前原水与原物' });
  expect(region.closest('details')).toBeNull();
  for (const text of [site.id, site.water.id, `海湾${site.water.bayUnits}单位`, `水道${site.water.channelUnits}单位`, `原总量${site.water.originalUnits}单位`, `累计实际${site.clockSeconds}秒`]) expect(region.textContent).toContain(text);
  for (const object of [site.gate, site.mooring, site.winch, site.wheel]) {
    const term = within(region).getByText(name => name.includes(object.id), { selector: 'dt' });
    expect(term.parentElement!.textContent).toContain(`耐久${object.durability}/100`);
  }
  expect(region.textContent).toContain(`距原泊位${site.buoy.offsetMetres}米`);
  expect(region.textContent).toContain(`累计实际转动${site.wheel.turns}次`);
  expect(site.water.bayUnits + site.water.channelUnits).toBe(20);
  expect(region.textContent).toContain(site.gate.position === 'OPEN' ? '已打开' : site.gate.position === 'CLOSED' ? '已关闭' : '已损坏');
  playerCopy(region);
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

describe('Catastrophe natural player labels, separate drinking and saved-state locks', () => {
  it.each(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME'] as const)('shows real %s fees, resources and risks without authoring badges', async type => {
    const entry = boundary(type), state = entry.beforeLast, before = structuredClone(state), ui = renderState(state), value = view(state);
    const panel = screen.getByRole('region', { name: PANEL }), resources = screen.getByRole('region', { name: '天灾当前资源' });
    expect(resources.closest('details')).toBeNull();
    for (const text of [`${state.health}/100`, `${state.mind}/100`, `${state.spirituality}/120`, value.resources!.cash]) expect(resources.textContent).toContain(text);
    expect(within(panel).getByText(value.risk).closest('details')).toBeNull();
    for (const text of ['12整周', '消化100', '500便士', '6200便士', '5400便士', '800便士', '120便士', '下一真实周', '逐瓶付费']) expect(panel.textContent).toContain(text);
    expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    playerCopy(panel); expect(state).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(await control(state, commandOf(entry)));
    const dialog = screen.getByRole('dialog', { name: confirmationName(commandOf(entry)) });
    expect(dialog.textContent).toContain(value.actions.find(a => JSON.stringify(a.command) === JSON.stringify(commandOf(entry)))!.cost);
    playerCopy(dialog); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('reviews the exact independent bottle, cancels without consuming, then submits one explicit confirmed drink', async () => {
    const entry = boundary('CONSUME'), command = commandOf(entry), before = structuredClone(entry.beforeLast), ui = renderState(entry.beforeLast);
    if (command.type !== 'CONSUME') throw new Error('Expected captured drink.');
    const trigger = await control(before, command);
    for (const cancelKind of ['pointer', 'escape', 'native'] as const) {
      await userEvent.click(trigger); const dialog = screen.getByRole('dialog', { name: '独立确认服用这一原瓶' });
      const cancel = within(dialog).getByRole('button', { name: '取消，返回查看' });
      expect(document.activeElement).toBe(cancel);
      for (const text of [command.bottleId, '当前成功率', '成功失败均耗尽', '成本不退', '重新检查', '当前灵性不补满', '大成功', '成功', '失败', '灾难']) expect(dialog.textContent).toContain(text);
      expect(within(dialog).queryByRole('checkbox')).toBeNull(); playerCopy(dialog);
      if (cancelKind === 'pointer') await userEvent.click(cancel);
      else if (cancelKind === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' });
      else fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
      expect(ui.onCommand).not.toHaveBeenCalled(); expect(entry.beforeLast).toEqual(before);
    }
    await userEvent.click(trigger); const dialog = screen.getByRole('dialog', { name: '独立确认服用这一原瓶' });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: command.bottleId, confirmed: true });
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true');
    expect(entry.beforeLast).toEqual(before);
    ui.rerender(<CatastrophePanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).toHaveBeenCalledOnce();
  });

  it.each(['BUY_POTION', 'PREPARE_PROMOTION'] as const)('%s never drinks a bottle as a side effect of confirmation', async type => {
    const entry = boundary(type), command = commandOf(entry), ui = renderState(entry.beforeLast);
    await userEvent.click(await control(entry.beforeLast, command));
    await userEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    ui.rerender(<CatastrophePanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog', { name: '独立确认服用这一原瓶' })).toBeNull();
    expect(entry.final.catastrophe.bottles.filter(b => b.status === 'CONSUMED')).toEqual(entry.beforeLast.catastrophe.bottles.filter(b => b.status === 'CONSUMED'));
    expect(entry.final.progression.sequence).toBe(3);
  });

  it.each(['BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME'] as const)('keeps the original %s dialog and intent locked through pending, failed and cleared errors', async type => {
    const entry = boundary(type), before = entry.beforeLast, command = commandOf(entry), ui = renderState(before);
    await userEvent.click(await control(before, command));
    const name = confirmationName(command);
    fireEvent.click(within(screen.getByRole('dialog', { name })).getByRole('button', { name: confirmLabel(command) }));
    ui.rerender(<CatastrophePanel {...ui.props} busy/>);
    ui.rerender(<CatastrophePanel {...ui.props} error="本次原操作尚未保存"/>);
    expect(screen.getByRole('alert').textContent).toContain('上次已保存事实');
    for (const error of ['本次原操作尚未保存', null] as const) {
      ui.rerender(<CatastrophePanel {...ui.props} error={error}/>);
      const dialog = screen.getByRole('dialog', { name });
      for (const button of within(dialog).getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(actionButton(before, command).disabled).toBe(true);
      expect((screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: '关闭天灾页面' }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
      fireEvent.keyDown(dialog, { key: 'Escape' }); fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.getByRole('dialog', { name })).toBeTruthy();
      expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(ui.onClose).not.toHaveBeenCalled();
    }
    ui.rerender(<CatastrophePanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog', { name })).toBeNull();
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('false');
  });

  it.each(['busy', 'blocked'] as const)('%s blocks all commands, selectors and closing without inventing a submit', async lock => {
    const entry = boundary('BUY_POTION'), command = commandOf(entry), onCommand = vi.fn(), onClose = vi.fn();
    render(<CatastrophePanel value={view(entry.beforeLast)} busy={lock === 'busy'} blocked={lock === 'blocked'} onCommand={onCommand} onClose={onClose}/>);
    for (const button of screen.getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(actionButton(entry.beforeLast, command));
    expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Catastrophe actual water, paid windows, withdrawal and physical cleanup', () => {
  it.each([['STORM_FIELD', 'buoy-return', 7, '意志20'], ['WATER_PRESSURE', 'wheel-return', 6, '知识20']] as const)('shows the actual %s cost and distinguishes a saved check from application', async (type, caseId, cost, difficulty) => {
    const entry = lifeBoundary(type, caseId), command = commandOf(entry), ui = renderState(entry.beforeLast);
    await userEvent.click(await control(entry.beforeLast, command));
    const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    for (const text of [`${cost}灵性`, difficulty, '最多10秒', '另', '实际', '撤回']) expect(dialog.textContent).toContain(text);
    playerCopy(dialog); expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    ui.rerender(<CatastrophePanel {...ui.props} value={view(entry.final)}/>);
    const prior = entry.beforeLast.catastrophe.life.cases[caseId].attempts.at(-1)!, now = entry.final.catastrophe.life.cases[caseId].attempts.at(-1)!;
    const key = type === 'STORM_FIELD' ? 'storm' : 'pressure', use = now[key];
    expect(use.attempts).toBe(prior[key].attempts + 1); expect(use.effects).toBe(prior[key].effects);
    expect(entry.final.spirituality).toBe(entry.beforeLast.spirituality - cost);
    expect(entry.final.progression.mastery).toEqual(entry.beforeLast.progression.mastery);
    const record = screen.getByRole('region', { name: '天灾当前窗口与实际应用' });
    expect(record.textContent).toContain(`尝试${use.attempts} / 检定成功${use.successes} / 实际应用${use.effects}`);
    expect(record.textContent).toContain(`窗口剩余${use.remainingSeconds}秒`);
    assertSite(entry.final);
  });

  it.each(['OPEN_GATE', 'ADMIT_WATER', 'CLOSE_GATE', 'DRAIN_WATER', 'RETURN_KEEPER'] as const)('renders the actual %s boundary, original durability and water stock without resets', type => {
    const entry = boundary(type), before = structuredClone(entry.beforeLast), ui = renderState(entry.beforeLast);
    assertSite(entry.beforeLast);
    ui.rerender(<CatastrophePanel {...ui.props} value={view(entry.final)}/>); assertSite(entry.final);
    const region = screen.getByRole('region', { name: '天灾当前许可与真实位置' }), site = entry.final.catastrophe.life.site;
    expect(region.textContent).toContain(`精力${site.keeper.energy}/100`);
    expect(region.textContent).toContain(`累计实际行走${site.keeper.travelMetres}米`);
    expect(region.textContent).toContain('6米'); expect(region.textContent).toContain('2精力');
    expect(entry.beforeLast).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('puts current withdrawn permission before old success, retains paid windows and offers explicit cleanup', async () => {
    const entry = lifeBoundary('CHECK_CONTINUATION', 'withdrawn-request'), state = entry.final, before = structuredClone(state), ui = renderState(state);
    const prior = entry.beforeLast.catastrophe.life.cases['withdrawn-request'].attempts.at(-1)!, now = state.catastrophe.life.cases['withdrawn-request'].attempts.at(-1)!;
    expect(now.ownerConsent).toBe('WITHDRAWN'); expect(now.appliedAbilityIds).toEqual([]);
    expect(now.spiritualitySpent).toBe(prior.spiritualitySpent); expect(state.spirituality).toBe(entry.beforeLast.spirituality);
    const permission = screen.getByRole('region', { name: '天灾当前许可与真实位置' });
    expect(permission.closest('details')).toBeNull();
    for (const text of ['已撤回该次许可', '当前撤回优先', '禁止继续新应用', '已付成本', '仍须单独停止']) expect(permission.textContent).toContain(text);
    const stop = { type: 'STOP_EFFECT', caseId: 'withdrawn-request' } as const;
    expect(actionButton(state, stop).disabled).toBe(false);
    expect(actionButton(state, stop).closest('section')?.getAttribute('aria-label')).toBe('天灾停止与普通收束');
    expect(actionButton(state, stop).textContent).toContain('0行动0秒');
    for (const type of ['STORM_FIELD', 'WATER_PRESSURE', 'CONSENT_OWNER'] as const) expect(actionButton(state, { type, caseId: 'withdrawn-request' }).disabled).toBe(true);
    assertSite(state); await userEvent.click(await control(state, stop));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(stop); expect(state).toEqual(before);
    expect(state.catastrophe.life.site.keeper.position).toBe(entry.beforeLast.catastrophe.life.site.keeper.position);
  });

  it.each(['STOP_EFFECT', 'DRAIN_WATER', 'RETURN_KEEPER', 'EXIT_SITE'] as const)('keeps genuine zero-AP %s cleanup usable, with its actual time and ordinary costs visible', async type => {
    const entry = catastropheBoundaryForIntent(intent => intent.type === 'CATASTROPHE' && intent.command.type === type, item => item.beforeLast.actionsRemaining === 0);
    const command = commandOf(entry), before = structuredClone(entry.beforeLast), ui = renderState(entry.beforeLast);
    const button = await control(before, command); expect(button.disabled).toBe(false); expect(button.textContent).toContain('0行动');
    expect(button.closest('section')?.getAttribute('aria-label')).toBe('天灾停止与普通收束');
    if (type === 'DRAIN_WATER') expect(button.textContent).toContain('4秒');
    if (type === 'RETURN_KEEPER') { expect(button.textContent).toContain('6米/6秒'); expect(button.textContent).toContain('2精力'); }
    if (type === 'EXIT_SITE') expect(button.textContent).toContain('2米/2秒');
    await userEvent.click(button); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(entry.beforeLast).toEqual(before); expect(entry.final.actionsRemaining).toBe(0);
    expect(entry.final.spirituality).toBe(before.spirituality);
    ui.rerender(<CatastrophePanel {...ui.props} value={view(entry.final)}/>); assertSite(entry.final);
  });

  it('opens all saved history folds without changing current people, water, mastery or permission', async () => {
    const state = catastropheSnapshot('practiced'), before = structuredClone(state), ui = renderState(state);
    const panel = screen.getByRole('region', { name: PANEL });
    for (const summary of Array.from(panel.querySelectorAll('summary'))) await userEvent.click(summary);
    for (const ability of view(state).abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    expect(panel.textContent).toContain('旧20项掌握'); expect(panel.textContent).toContain('七阶');
    expect(panel.textContent).toContain('不免费治疗'); expect(panel.textContent).toContain('补满当前灵性');
    playerCopy(panel); assertSite(state); expect(state).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  });
});


describe('Catastrophe terminal original enemy facts remain current', () => {
  it('shows the actual surviving original Vale atS108 after the recorded terminal round, without restoring water or either body', async () => {
    const state = catastropheSnapshot('final'), before = structuredClone(state), value = view(state), onCommand = vi.fn();
    render(<CatastrophePanel value={value} busy={false} blocked onCommand={onCommand}/>);
    const summary = screen.getByText('独立原人的可选冲突', { selector: 'summary' });
    await userEvent.click(summary);
    const encounter = screen.getByRole('region', { name: '天灾原人可选遭遇' });
    expect(state.catastrophe.encounter.enemySpirituality).toBe(108);
    expect(encounter.textContent).toContain('独立S108/120');
    expect(encounter.textContent).toContain('CT2-VALE'); expect(encounter.textContent).toContain('水压2次');
    expect(encounter.textContent).not.toContain('独立S120/120');
    assertSite(state); playerCopy(encounter);
    expect(state.catastrophe.life.site).toEqual(state.lastCombatRound!.catastropheOutcome!.siteAfter);
    expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
