/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LightSeekerPanel } from '../../src/renderer/LightSeekerPanel';
import { projectSliceState } from '../../src/domain/slice';
import type { SliceState } from '../../src/domain/slice/types';
import type { LightSeekerCommand, LightSeekerProjection } from '../../src/domain/light-seeker/types';
import type { LightSeekerCaseId } from '../../src/domain/light-seeker/life';
import { lightSeekerBoundaryForIntent, lightSeekerSnapshot, type LightSeekerBoundary } from '../domain/light-seeker-helper';

// Integration views use actual recorded before/command/after captures. Directed
// presentation-only projections are explicitly labelled and never replayed or saved.
const PANEL = '逐光者有限切片';
const view = (state: SliceState) => projectSliceState(state).lightSeeker;
const confirmationName = (command: LightSeekerCommand) => command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险';
const confirmLabel = (command: LightSeekerCommand) => command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作';
function boundary(type: LightSeekerCommand['type'], accept?: (entry: LightSeekerBoundary) => boolean) {
  return lightSeekerBoundaryForIntent(intent => intent.type === 'LIGHT_SEEKER' && intent.command.type === type, accept);
}
function lifeBoundary(type: LightSeekerCommand['type'], caseId: LightSeekerCaseId, accept?: (entry: LightSeekerBoundary) => boolean) {
  return lightSeekerBoundaryForIntent(intent => intent.type === 'LIGHT_SEEKER' && intent.command.type === type && 'caseId' in intent.command && intent.command.caseId === caseId, accept);
}
function commandOf(entry: LightSeekerBoundary) {
  if (entry.lastIntent.type !== 'LIGHT_SEEKER') throw new Error('Expected an actual Light Seeker command capture.');
  return entry.lastIntent.command;
}
function projectedAction(value: LightSeekerProjection, command: LightSeekerCommand) {
  const action = value.actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public action: ${JSON.stringify(command)}`);
  return action;
}
function actionButton(value: LightSeekerProjection, command: LightSeekerCommand) {
  const action = projectedAction(value, command);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(value: LightSeekerProjection, command: LightSeekerCommand) {
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
function playerCopy(node: HTMLElement) {
  // Immutable ASCII identities are not authoring badges.
  expect(node.textContent).not.toMatch(/未核实候选|候选G|名称编号待核|原文核验|原著|原创G|本作G|(?<![A-Za-z0-9_.-])G(?=\d)|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])|\dG(?=[\s，；。、：）)\/×%\u3400-\u9fff])/);
  expect(node.textContent).not.toMatch(/原海湾|原海水|诺拉|CT2-VALE|风浪窗口|水压窗口/);
  expect(node.textContent).not.toMatch(/"(?:operatorEnergy|playerLocation|appliedAbilityIds)"\s*:/);
}
function renderValue(value: LightSeekerProjection) {
  const onCommand = vi.fn(), onClose = vi.fn();
  const props = { value, busy: false, error: null, onCommand, onClose };
  return { ...render(<LightSeekerPanel {...props}/>), props, onCommand, onClose };
}
function renderState(state: SliceState) { return renderValue(view(state)); }
function assertSite(value: LightSeekerProjection) {
  const site = value.life.site, region = screen.getByRole('region', { name: '逐光者当前采光廊与原物' });
  expect(region.closest('details')).toBeNull();
  for (const text of [site.id, `直廊${site.lengthMetres}米`, `累计经过${site.elapsedSeconds}秒`, site.lamp.id, `剩余灯油${site.lamp.oil}份`, site.board.id]) expect(region.textContent).toContain(text);
  for (const object of [site.shutter, site.cover, site.screen]) {
    const term = within(region).getByText(name => name.includes(object.id), { selector: 'dt' });
    expect(term.parentElement!.textContent).toContain(`耐久${object.durability}/100`);
  }
  expect(region.textContent).toContain(`已操作${site.shutter.operations}次`);
  expect(region.textContent).toContain(`已检查${site.screen.inspections}次`);
  expect(region.textContent).toContain(site.shutter.state === 'OPEN' ? '已打开' : site.shutter.state === 'CLOSED' ? '已关闭' : '已损坏');
  expect(region.textContent).toContain(site.board.read ? site.board.inscription : '尚未核读刻字');
  if (!site.board.read) expect(region.textContent).not.toContain(site.board.inscription);
  const people = screen.getByRole('region', { name: '逐光者当前许可与真实位置' });
  expect(people.closest('details')).toBeNull();
  for (const text of [site.operatorId, site.spiritId, `精力${site.operatorEnergy}/100`, `精力${site.spiritEnergy}/100`, `累计行走${site.playerMetres}米`, `累计行走${site.operatorMetres}米`, `累计行走${site.spiritMetres}米`]) expect(people.textContent).toContain(text);
  playerCopy(region); playerCopy(people);
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

describe('Light Seeker independent bottles and saved-state submission locks', () => {
  it.each(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME'] as const)('shows actual %s cost, risk and current resources before asking for confirmation', async type => {
    const entry = boundary(type), before = structuredClone(entry.beforeLast), value = view(before), ui = renderValue(value), command = commandOf(entry);
    const panel = screen.getByRole('region', { name: PANEL }), resources = screen.getByRole('region', { name: '逐光者当前资源' });
    expect(resources.closest('details')).toBeNull();
    for (const text of [`${before.health}/100`, `${before.mind}/100`, `${before.spirituality}/120`, value.resources!.cash]) expect(resources.textContent).toContain(text);
    expect(within(panel).getByText(value.risk).closest('details')).toBeNull();
    for (const text of ['12整周', '消化100', '500便士', '6200便士', '5400便士', '800便士', '120便士', '下一真实周', '逐瓶付费']) expect(panel.textContent).toContain(text);
    expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
    playerCopy(panel); expect(entry.beforeLast).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(await control(value, command));
    const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    expect(dialog.textContent).toContain(projectedAction(value, command).cost);
    playerCopy(dialog); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('confirms only the selected bottle, supports cancellation and submits the identical drink once', async () => {
    const entry = boundary('CONSUME'), command = commandOf(entry), value = view(entry.beforeLast), before = structuredClone(value), ui = renderValue(value);
    if (command.type !== 'CONSUME') throw new Error('Expected recorded drink.');
    const trigger = await control(value, command);
    for (const cancelKind of ['pointer', 'escape', 'native'] as const) {
      await userEvent.click(trigger); const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
      const cancel = within(dialog).getByRole('button', { name: '取消，返回查看' });
      expect(document.activeElement).toBe(cancel);
      for (const text of [command.bottleId, '当前成功率', '成功失败均耗尽', '成本不退', '重新检查', '当前灵性不补满', '大成功', '成功', '失败', '严重失败']) expect(dialog.textContent).toContain(text);
      expect(within(dialog).queryByRole('checkbox')).toBeNull(); playerCopy(dialog);
      if (cancelKind === 'pointer') await userEvent.click(cancel);
      else if (cancelKind === 'escape') fireEvent.keyDown(dialog, { key: 'Escape' });
      else fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger); expect(ui.onCommand).not.toHaveBeenCalled();
    }
    await userEvent.click(trigger);
    const confirm = within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: command.bottleId, confirmed: true });
    expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('true'); expect(value).toEqual(before);
    ui.rerender(<LightSeekerPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).toHaveBeenCalledOnce();
  });

  it.each(['BUY_POTION', 'PREPARE_PROMOTION'] as const)('%s does not drink as a side effect', async type => {
    const entry = boundary(type), command = commandOf(entry), ui = renderState(entry.beforeLast);
    await userEvent.click(await control(ui.props.value, command));
    await userEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    ui.rerender(<LightSeekerPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog', { name: '独立确认服用这一药瓶' })).toBeNull();
    expect(entry.final.lightSeeker.bottles.filter(b => b.status === 'CONSUMED')).toEqual(entry.beforeLast.lightSeeker.bottles.filter(b => b.status === 'CONSUMED'));
    expect(entry.final.progression.sequence).toBe(3);
  });

  it.each(['BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'PERFORM'] as const)('keeps the same %s intent locked through pending, failed and cleared errors', async type => {
    const entry = boundary(type), command = commandOf(entry), ui = renderState(entry.beforeLast), value = ui.props.value;
    await userEvent.click(await control(value, command));
    const name = confirmationName(command);
    fireEvent.click(within(screen.getByRole('dialog', { name })).getByRole('button', { name: confirmLabel(command) }));
    ui.rerender(<LightSeekerPanel {...ui.props} busy/>);
    ui.rerender(<LightSeekerPanel {...ui.props} error="本次操作尚未保存"/>);
    expect(screen.getByRole('alert').textContent).toContain('上次已保存事实');
    for (const error of ['本次操作尚未保存', null] as const) {
      ui.rerender(<LightSeekerPanel {...ui.props} error={error}/>);
      const dialog = screen.getByRole('dialog', { name });
      for (const button of within(dialog).getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
      expect(actionButton(value, command).disabled).toBe(true);
      for (const select of screen.getAllByRole('combobox', { hidden: true })) expect((select as HTMLSelectElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: '关闭逐光者页面', hidden: true }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
      fireEvent.keyDown(dialog, { key: 'Escape' }); fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.getByRole('dialog', { name })).toBeTruthy();
      expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(ui.onClose).not.toHaveBeenCalled();
    }
    ui.rerender(<LightSeekerPanel {...ui.props} value={view(entry.final)}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('false');
  });

  it.each(['busy', 'blocked', 'error'] as const)('%s blocks commands, selection and closing before any submit', async lock => {
    const entry = boundary('BUY_POTION'), value = view(entry.beforeLast), command = commandOf(entry), onCommand = vi.fn(), onClose = vi.fn();
    render(<LightSeekerPanel value={value} busy={lock === 'busy'} blocked={lock === 'blocked'} error={lock === 'error' ? { message: '磁盘写入失败', retryable: false } : null} onCommand={onCommand} onClose={onClose}/>);
    for (const button of screen.getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(actionButton(value, command)); expect(screen.queryByRole('dialog')).toBeNull(); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    if (lock === 'error') expect(screen.getByRole('alert').textContent).toContain('重新加载');
  });

  it('traps keyboard focus in an unsubmitted confirmation and invalidates changed public facts', async () => {
    const entry = boundary('CONSUME'), command = commandOf(entry), ui = renderState(entry.beforeLast);
    await userEvent.click(await control(ui.props.value, command));
    const dialog = screen.getByRole('dialog'), cancel = within(dialog).getByRole('button', { name: '取消，返回查看' }), confirm = within(dialog).getByRole('button', { name: confirmLabel(command) });
    cancel.focus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm);
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(cancel);
    // Directed renderer-only update: a changed public balance invalidates prior review.
    const changed = structuredClone(ui.props.value); changed.resources!.cash = '0便士';
    ui.rerender(<LightSeekerPanel {...ui.props} value={changed}/>);
    expect(screen.queryByRole('dialog')).toBeNull(); expect(ui.onCommand).not.toHaveBeenCalled();
  });
});

describe('Light Seeker shared physical site, paid windows and ordinary cleanup', () => {
  it.each([['marker-path', 7, '意志20'], ['screened-return', 9, '知识20'], ['withdrawn-visit', 9, '知识20']] as const)('shows the full %s cost and never awards application merely for a check', async (caseId, cost, difficulty) => {
    const entry = lifeBoundary('PERFORM', caseId, item => item.beforeLast.lightSeeker.life.cases[caseId].method === 'ABILITY'), command = commandOf(entry), ui = renderState(entry.beforeLast);
    await userEvent.click(await control(ui.props.value, command));
    const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    for (const text of [`${cost}灵性`, difficulty, '20秒', '实际应用', '停光']) expect(dialog.textContent).toContain(text);
    playerCopy(dialog); expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    ui.rerender(<LightSeekerPanel {...ui.props} value={view(entry.final)}/>);
    const prior = entry.beforeLast.lightSeeker.life.cases[caseId].attempts.at(-1)!, now = entry.final.lightSeeker.life.cases[caseId].attempts.at(-1)!;
    expect(now.spiritualitySpent - prior.spiritualitySpent).toBe(cost); expect(now.appliedAbilityIds).toEqual(prior.appliedAbilityIds);
    expect(entry.final.spirituality).toBe(entry.beforeLast.spirituality - cost); expect(entry.final.progression.mastery).toEqual(entry.beforeLast.progression.mastery);
    const record = screen.getByRole('region', { name: '逐光者当前窗口与实际应用' });
    expect(record.textContent).toContain(`实付${now.spiritualitySpent}灵性`); expect(record.textContent).toContain('实际应用：无');
    if (now.abilityTier === 'SUCCESS' || now.abilityTier === 'GREAT_SUCCESS') expect(record.textContent).toContain('本次检定成功，尚未实际应用');
    else expect(record.textContent).toContain('本次检定失败，实际消耗保留');
    assertSite(view(entry.final));
  });

  it.each(['OPEN_SHUTTER', 'CLOSE_SHUTTER', 'PLACE_COVER', 'RETURN_COVER', 'MOVE_OPERATOR_FAR', 'RETURN_OPERATOR', 'INVITE_SPIRIT', 'RETIRE_SPIRIT', 'INSPECT_SCREEN'] as const)('renders the recorded %s before and after without resource resets', type => {
    const entry = boundary(type), before = structuredClone(entry.beforeLast), ui = renderState(entry.beforeLast);
    assertSite(ui.props.value); ui.rerender(<LightSeekerPanel {...ui.props} value={view(entry.final)}/>); assertSite(view(entry.final));
    expect(entry.beforeLast).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('puts current withdrawn permission before any old successful check and leaves explicit cleanup available', async () => {
    const entry = lifeBoundary('WITHDRAW_PERMISSION', 'withdrawn-visit'), state = entry.final, before = structuredClone(state), ui = renderState(state);
    const prior = entry.beforeLast.lightSeeker.life.cases['withdrawn-visit'].attempts.at(-1)!, now = state.lightSeeker.life.cases['withdrawn-visit'].attempts.at(-1)!;
    expect(state.lightSeeker.life.site.spiritConsent).toBe('WITHDRAWN'); expect(now.appliedAbilityIds).toEqual([]);
    expect(now.spiritualitySpent).toBe(prior.spiritualitySpent); expect(state.spirituality).toBe(entry.beforeLast.spirituality);
    expect(state.lightSeeker.life.site.spiritLocation).toBe(entry.beforeLast.lightSeeker.life.site.spiritLocation);
    const permission = screen.getByRole('region', { name: '逐光者当前许可与真实位置' });
    for (const text of ['已撤回本次许可', '当前撤回优先', '禁止继续本次应用', '已付成本', '仍须单独停光']) expect(permission.textContent).toContain(text);
    const command = { type: 'STOP', caseId: 'withdrawn-visit' } as const;
    const stop = actionButton(ui.props.value, command); expect(stop.disabled).toBe(false);
    expect(stop.closest('section')?.getAttribute('aria-label')).toBe('逐光者停止与普通收束');
    expect(stop.textContent).toContain('0行动0秒');
    expect(actionButton(ui.props.value, { type: 'CONSENT_SPIRIT', caseId: 'withdrawn-visit' }).disabled).toBe(true);
    expect(actionButton(ui.props.value, { type: 'INVITE_SPIRIT', caseId: 'withdrawn-visit' }).disabled).toBe(true);
    await userEvent.click(await control(ui.props.value, command));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command); expect(state).toEqual(before);
  });

  it.each(['STOP', 'CLOSE_SHUTTER', 'RETURN_COVER', 'RETURN_OPERATOR', 'INSPECT', 'LEAVE'] as const)('does not UI-gate the recorded zero-cost %s step when the displayed AP is zero', async type => {
    const entry = boundary(type), command = commandOf(entry), before = structuredClone(entry.beforeLast);
    // Directed presentation-only zero-AP display. The real boundary below proves
    // that this published action actually spent no AP; no game state is changed.
    const value = structuredClone(view(entry.beforeLast)); value.resources!.actionsRemaining = 0;
    const ui = renderValue(value);
    const button = await control(ui.props.value, command); expect(button.disabled).toBe(false); expect(button.textContent).toContain('0行动');
    expect(button.closest('section')?.getAttribute('aria-label')).toBe('逐光者停止与普通收束');
    expect(button.textContent).toContain(projectedAction(ui.props.value, command).cost);
    fireEvent.click(button); fireEvent.click(button); expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(entry.beforeLast).toEqual(before); expect(entry.final.actionsRemaining).toBe(before.actionsRemaining); expect(entry.final.spirituality).toBe(before.spirituality);
    ui.rerender(<LightSeekerPanel {...ui.props} value={view(entry.final)}/>); assertSite(view(entry.final));
  });

  it('shows paid success, failed checks and expired limited light distinctly in directed renderer projections', () => {
    const entry = lifeBoundary('PERFORM', 'screened-return'), original = view(entry.final), originalBefore = structuredClone(original);
    // These intentionally altered public projections exercise display branches only.
    // They are not saved, replayed or claimed as the natural recorded outcome.
    const success = structuredClone(original), a = success.life.currentAttempt!;
    a.abilityTier = 'SUCCESS'; a.window = 'ACTIVE'; a.windowExpiresAt = success.life.site.elapsedSeconds + 20; a.appliedAbilityIds = [];
    success.life.site.light = { mode: 'LIMITED', expiresAt: a.windowExpiresAt };
    const ui = renderValue(success), current = () => screen.getByRole('region', { name: '逐光者当前窗口与实际应用' });
    expect(current().textContent).toContain('本次检定成功，尚未实际应用'); expect(current().textContent).toContain('窗口剩余20秒');
    const failed = structuredClone(success); failed.life.currentAttempt!.abilityTier = 'FAILURE'; failed.life.currentAttempt!.window = 'FAILED'; failed.life.currentAttempt!.windowExpiresAt = null; failed.life.site.light = { mode: 'PLAIN', expiresAt: null };
    ui.rerender(<LightSeekerPanel {...ui.props} value={failed}/>);
    expect(current().textContent).toContain('本次检定失败，实际消耗保留'); expect(current().textContent).toContain(`实付${a.spiritualitySpent}灵性`);
    const expired = structuredClone(success); expired.life.site.elapsedSeconds += 20; expired.life.site.light = { mode: 'PLAIN', expiresAt: null }; expired.life.currentAttempt!.window = 'EXPIRED';
    ui.rerender(<LightSeekerPanel {...ui.props} value={expired}/>);
    expect(current().textContent).toContain('窗口已到期'); expect(current().textContent).toContain('窗口剩余0秒');
    expect(screen.getByRole('region', { name: '逐光者当前采光廊与原物' }).textContent).toContain('普通照明仍亮着');
    expect(original).toEqual(originalBefore); expect(ui.onCommand).not.toHaveBeenCalled();
  });

  it('never treats an unread engraving as a reading, and preserves current objects while inspecting history', async () => {
    const fresh = lightSeekerSnapshot('promoted'), ui = renderState(fresh);
    expect(ui.props.value.life.site.board.read).toBe(false); assertSite(ui.props.value);
    const state = lightSeekerSnapshot('practiced'), before = structuredClone(state), value = view(state);
    ui.rerender(<LightSeekerPanel {...ui.props} value={value}/>);
    const panel = screen.getByRole('region', { name: PANEL });
    for (const summary of ['三案历史与新掌握', '独立药瓶与专业准备记录', '身体与已有经历']) await userEvent.click(within(panel).getByText(summary, { selector: 'summary' }));
    for (const c of value.life.cases) {
      expect(panel.textContent).toContain(c.title);
      for (const a of c.attempts) {
        expect(panel.textContent).toContain(`第${a.week}周`);
        expect(panel.textContent).toContain(`开始时灯油${a.siteAtStart.lamp.oil}份`);
        if (a.siteAtClose) expect(panel.textContent).toContain(`收束时灯油${a.siteAtClose.lamp.oil}份`);
      }
    }
    expect(panel.textContent).toContain('当前位置、精力和许可以上方实况为准');
    expect(panel.textContent).toContain('十八项已有掌握'); expect(panel.textContent).toContain('不免费治疗');
    assertSite(value); playerCopy(panel); expect(state).toEqual(before); expect(ui.onCommand).not.toHaveBeenCalled(); expect(ui.onClose).not.toHaveBeenCalled();
  });

  it('leaves externally supplied custom names untouched', () => {
    // Directed text-only projection: this is user-authored data, not a developer badge.
    const value = structuredClone(view(lightSeekerSnapshot('promoted')));
    value.inheritedHistory = ['角色姓名：G·候选之光'];
    const ui = renderValue(value);
    expect(ui.container.textContent).toContain('角色姓名：G·候选之光'); expect(ui.onCommand).not.toHaveBeenCalled();
  });
});

describe('Light Seeker optional encounter and actual terminal facts', () => {
  it('confirms the same-site fight and shows the current enemy without refilling either body', async () => {
    const entry = boundary('ENCOUNTER_FIGHT'), command = commandOf(entry), ui = renderState(entry.beforeLast), value = ui.props.value;
    assertSite(value);
    await userEvent.click(await control(value, command));
    const dialog = screen.getByRole('dialog', { name: confirmationName(command) });
    for (const text of ['欧文·赛尔', '当前遮光闸', '伤势', '死亡', '抵挡棍击']) expect(dialog.textContent).toContain(text);
    playerCopy(dialog); expect(ui.onCommand).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: confirmLabel(command) }));
    expect(ui.onCommand).toHaveBeenCalledExactlyOnceWith(command);
  });

  it('shows the recorded final resources and positions rather than initial enemy or site values', async () => {
    const state = lightSeekerSnapshot('final'), before = structuredClone(state), value = view(state), onCommand = vi.fn();
    render(<LightSeekerPanel value={value} busy={false} blocked onCommand={onCommand}/>);
    const summary = screen.queryByText('采光廊的可选冲突', { selector: 'summary' }); if (summary) await userEvent.click(summary);
    const region = screen.getByRole('region', { name: '逐光者可选遭遇' }), enemy = value.encounter.enemy!;
    for (const text of [enemy.id, enemy.name, `${enemy.age}岁`, `健康${enemy.health}/100`, `独立灵性${enemy.spirituality}/120`, enemy.weaponId, '4米']) expect(region.textContent).toContain(text);
    expect(region.textContent).toContain(`光击${enemy.powerUses.LIGHT_STRIKE}次`); expect(region.textContent).toContain(`光照防护${enemy.powerUses.LIGHT_WARD}次`); expect(region.textContent).toContain(`普通关闸${enemy.powerUses.SHUTTER_CLOSE}次`);
    if (enemy.spirituality !== 120) expect(region.textContent).not.toContain('独立灵性120/120');
    assertSite(value); playerCopy(region); expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled();
  });
});
