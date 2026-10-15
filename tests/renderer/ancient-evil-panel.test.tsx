/* @vitest-environment jsdom */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AncientEvilPanel, type AncientEvilPanelProps } from '../../src/renderer/AncientEvilPanel.js';
import { projectAncientEvil } from '../../src/domain/ancient-evil/index.js';
import { ANCIENT_EVIL_PREPARATION_IDS, type AncientEvilProjection } from '../../src/domain/ancient-evil/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { ANCIENT_EVIL_CASE_IDS, type AncientEvilCaseId } from '../../src/domain/ancient-evil/life.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import { ae, directedInitial3, dose, originalSilentDisciple, prepared, promoted, taught } from '../domain/ancient-evil-directed-helper.js';

afterEach(cleanup);
// Actual source: the preserved living S3 ending of all 507 public commands.
// Interactive S2 states use only the explicitly declared pre-journal UNIT budgets
// in the shared helper. These renderer cases are not natural completion evidence.
beforeAll(() => { originalSilentDisciple(); promoted(); }, 60_000);
const source = () => projectAncientEvil(directedInitial3());
function show(value: AncientEvilProjection = source(), extra: Partial<AncientEvilPanelProps> = {}) {
  const onCommand = vi.fn();
  return { ...render(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} {...extra} />), onCommand };
}
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const targets = () => screen.getByRole('navigation', { name: '古代邪物目标' });
const resources = () => screen.getByRole('region', { name: '古代邪物当前资源' });
const room = () => screen.getByRole('region', { name: '古代邪物原场事务' });
const attempt = () => screen.getByRole('region', { name: '古代邪物本次实际尝试' });
function openPrimary() {
  fireEvent.click(primary());
  return screen.getByRole('dialog', { name: '古代邪物操作确认' });
}
function confirm(dialog = screen.getByRole('dialog')) {
  return within(dialog).getByRole('button', { name: '确认执行这一次操作' });
}
const editorial = /候选|原创G|本作G|原文未核|编号推断|SD3-QUIET-ROOM|\bSTART\b|\b[AB]\b/;

describe('AncientEvil panel: original source and independent potion choices', () => {
  it('shows the living original S3 resources, three independent bottles and the actual unaffordable next step', () => {
    const state = originalSilentDisciple(), value = projectAncientEvil(state), view = show(value);
    expect(screen.getByRole('heading', { name: '古代邪物·被缚者序列2' })).toBeTruthy();
    expect(resources().textContent).toContain('健康100/100 · 精神99/100 · 灵性116/120');
    expect(resources().textContent).toContain('360便士 · 本周行动3');
    expect(resources().textContent).toContain('原伤继续生效');
    expect(primary().textContent).toContain('1行动 · 500便士');
    expect(disabled(primary())).toBe(true);
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain(value.bottles[0]!.source);
    expect(view.container.textContent).toContain('可选择继续停留沉默门徒');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(state.injuries.some(injury => injury.severity === 'HEAVY')).toBe(true);
  });

  it('shows actual promotion costs, nineteen inherited and new skills, and one original adult body', () => {
    const state = promoted(), value = projectAncientEvil(state), view = show(value);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(resources().textContent).toContain(`灵性${state.spirituality}/120`);
    expect(state.mind).toBeLessThan(99);
    expect(value.abilities).toHaveLength(19);
    expect(value.abilities.slice(-2).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const history of value.inheritedHistory) expect(view.container.textContent).toContain(history);
    expect(room().textContent).toContain('埃尔莎·莫尔 · 43岁');
    expect(room().textContent).toContain('同一原身体');
    expect(room().textContent).toContain('原衣物');
    expect(room().textContent).toContain('原包');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(room().textContent).not.toMatch(/原卡|原铃|诺拉/);
  });

  it('keeps the selected bottle after its actual labour receipt and never dispatches a goal choice', () => {
    const state = taught(), value = projectAncientEvil(state), onCommand = vi.fn();
    const view = render(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectAncientEvil(ae(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<AncientEvilPanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title);
    expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('allows selecting either actually owned bottle after paid preparation and keeps the selected consume primary', () => {
    let state = taught();
    for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) state = ae(state, { type: 'PREPARE_TASK', taskId });
    state = ae(state, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-1' });
    state = ae(state, { type: 'BUY_POTION', bottleId: 'ancient-evil-potion-2' });
    state = ae(state, { type: 'PREPARE_PROMOTION' });
    const value = projectAncientEvil(state), view = show(value), bottle = value.bottles[1]!;
    expect(value.insideCase).toBe(true);
    const goal = within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` });
    expect(disabled(goal)).toBe(false);
    fireEvent.click(goal);
    expect(primary().textContent).toContain('独立确认服用第2瓶');
    const dialog = openPrimary();
    expect(dialog.textContent).toContain(bottle.source);
    fireEvent.click(within(dialog).getByRole('button', { name: '确认服用这一药瓶' }));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CONSUME', bottleId: bottle.id, confirmed: true });
    expect(state.ancientEvil.bottles.slice(0, 2).map(entry => entry.status)).toEqual(['PLAYER', 'PLAYER']);
  });

  it('confirms the exact bottle, success rate and paid failure risk and submits only one read-only intent', () => {
    const state = prepared(), value = projectAncientEvil(state), before = structuredClone(state), view = show(value);
    const dialog = openPrimary(), bottle = value.bottles[0]!;
    expect(dialog.textContent).toContain(bottle.source);
    expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('140便士');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('失败保留已付代价');
    const button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(dose);
    expect(state).toEqual(before);
  });
});

describe('AncientEvil panel: confirmation, focus and saved-state safety', () => {
  it('focuses and traps confirmation, blocks background controls and restores focus on cancel or Escape', () => {
    const onClose = vi.fn(), view = show(source(), { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(within(dialog).getByRole('heading', { name: '听取古代邪物成品与专业准备指导' }));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    for (const target of within(targets()).getAllByRole('button')) expect(disabled(target)).toBe(true);
    const close = screen.getByRole('button', { name: '返回普通生活' });
    expect(disabled(close)).toBe(true); fireEvent.click(close);
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(openPrimary(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps a double-clicked submission locked while the same saved facts await a receipt', () => {
    const value = source(), onCommand = vi.fn(), view = render(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    const dialog = openPrimary(), button = confirm(dialog);
    fireEvent.click(button); fireEvent.click(button);
    view.rerender(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    expect(disabled(within(dialog).getByRole('button', { name: '取消，返回查看' }))).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('正在结算并保存');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  });

  it('closes unsubmitted confirmation on save failure and delegates retry to the existing save operation', () => {
    const value = source(), onCommand = vi.fn(), view = render(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<AncientEvilPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('同一次保存');
    expect(screen.getByRole('alert').textContent).toContain('上次已保存的记录');
    expect(disabled(primary())).toBe(true);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('keeps a submitted intent locked through error clearing until changed saved facts arrive and then focuses the new phase', () => {
    const state = directedInitial3(), value = projectAncientEvil(state), onCommand = vi.fn();
    const view = render(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<AncientEvilPanel value={value} busy={false} error="保存中断" onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.rerender(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true);
    const after = projectAncientEvil(ae(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<AncientEvilPanel value={after} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(disabled(primary())).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: after.title }));
    expect(resources().textContent).toContain(`${state.cash - 500}便士`);
    expect(onCommand).toHaveBeenCalledTimes(1);
  });

  it('invalidates a stale unsubmitted confirmation when newer actual facts arrive', () => {
    const state = directedInitial3(), value = projectAncientEvil(state), onCommand = vi.fn();
    const view = render(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    openPrimary();
    view.rerender(<AncientEvilPanel value={projectAncientEvil(ae(state, { type: 'LEARN_GUIDANCE' }))} busy={false} onCommand={onCommand} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });

  it('disables all public buttons when busy, externally blocked or dead', () => {
    for (const mode of ['busy', 'blocked', 'dead'] as const) {
      // Explicit UNIT-only pre-journal terminal display fixture, not a natural death.
      const state = directedInitial3();
      if (mode === 'dead') { state.status = 'DEAD'; state.health = 0; }
      const view = show(projectAncientEvil(state), { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn() });
      for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
      if (mode === 'dead') expect(view.container.textContent).toContain('本周目已经死亡');
      expect(view.onCommand).not.toHaveBeenCalled();
      view.unmount();
    }
  });

  it('closes only outside an actual scene without submitting movement, healing, returns or a new sequence', () => {
    const onClose = vi.fn(), view = show(source(), { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.onCommand).not.toHaveBeenCalled();
  });
});

const lifeCache = new Map<string, SliceState>();
/** Explicit UNIT-only pre-journal cursor selection, keeping the source seed,
 * original body, injury, resources and all old journals. All resulting states
 * below are produced by actual public commands, never hand-written projections. */
function lifePromotion(formSucceeds = true, guidanceSucceeds = true): SliceState {
  const key = `${formSucceeds}:${guidanceSucceeds}`;
  if (!lifeCache.has(key)) {
    let state = directedInitial3();
    const potionChance = computeCheckChance({ baseAbility: state.character.coreStats.will, difficulty: 30, modifiers: [] });
    const lifeChance = computeCheckChance({ baseAbility: state.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
    let selected: number | null = null;
    for (let cursor = state.random.cursor; cursor < state.random.cursor + 512; cursor++) {
      const random = new DeterministicActionRandomStream(state.random.seed, cursor);
      const potion = random.nextInt(1, 100), form = random.nextInt(1, 100), guidance = random.nextInt(1, 100);
      if (potion > 5 && potion <= potionChance && (form > 5 && form <= lifeChance) === formSucceeds
        && (!formSucceeds ? form > lifeChance && form < 96 : true)
        && (guidance > 5 && guidance <= lifeChance) === guidanceSucceeds
        && (!guidanceSucceeds ? guidance > lifeChance && guidance < 96 : true)) { selected = cursor; break; }
    }
    if (selected === null) throw new Error('No bounded same-seed renderer UNIT source for the requested real checks.');
    state.random.cursor = selected;
    state = ae(state, { type: 'LEARN_GUIDANCE' });
    for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) state = ae(state, { type: 'PREPARE_TASK', taskId });
    state = ae(state, { type: 'BUY_POTION', bottleId: dose.bottleId });
    state = ae(state, { type: 'PREPARE_PROMOTION' });
    state = ae(state, dose);
    lifeCache.set(key, state);
  }
  return structuredClone(lifeCache.get(key)!);
}
function ordinaryCase(state: SliceState, caseId: AncientEvilCaseId): SliceState {
  state = ae(state, { type: 'OBSERVE', caseId });
  state = ae(state, { type: 'PREPARE', caseId, method: 'ORDINARY' });
  for (const command of [
    { type: 'WALK', caseId, to: 'A' }, { type: 'READ_IDENTITY', caseId },
    { type: 'WALK', caseId, to: 'B' }, { type: 'READ_NOTE', caseId },
    { type: 'WALK', caseId, to: 'A' }, { type: 'COMPARE_IDENTITY', caseId }, { type: 'MANUAL_OPERATION', caseId },
    { type: 'WALK', caseId, to: 'START' }, { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId },
  ] as const) state = ae(state, command);
  return state;
}
function formReady(caseId: AncientEvilCaseId = 'lasting-form', formSucceeds = true, guidanceSucceeds = true): SliceState {
  let state = lifePromotion(formSucceeds, guidanceSucceeds);
  for (const previous of ANCIENT_EVIL_CASE_IDS) {
    if (previous === caseId) break;
    state = ordinaryCase(state, previous);
  }
  state = ae(state, { type: 'OBSERVE', caseId });
  state = ae(state, { type: 'PREPARE', caseId, method: 'ABILITY' });
  state = ae(state, { type: 'WALK', caseId, to: 'A' });
  for (const type of ['READ_IDENTITY', 'STORE_ITEMS', 'CONSENT_ELSA', 'ENDURING_TRANSFIGURATION'] as const) state = ae(state, { type, caseId });
  return state;
}
function identityCompared(state: SliceState, caseId: AncientEvilCaseId): SliceState {
  state = ae(state, { type: caseId === 'revoked-form' ? 'WITHDRAW_PERMISSION' : 'STOP_INPUT', caseId });
  for (const command of [
    { type: 'WALK', caseId, to: 'B' }, { type: 'READ_NOTE', caseId },
    { type: 'WALK', caseId, to: 'A' }, { type: 'COMPARE_IDENTITY', caseId },
  ] as const) state = ae(state, command);
  return state;
}

describe('AncientEvil panel: actual same-body life, consent and safe exit', () => {
  it('shows one main legal goal and keeps the ordinary method as a separately confirmed alternative', () => {
    const value = projectAncientEvil(ae(promoted(), { type: 'OBSERVE', caseId: 'lasting-form' })), view = show(value);
    expect(within(screen.getByRole('region', { name: '当前主要操作' })).getAllByRole('button')).toHaveLength(1);
    expect(primary().textContent).toContain('能力方法');
    const future = within(targets()).getByRole('button', { name: /正确原身份的有限解咒/ });
    expect(disabled(future)).toBe(true);
    fireEvent.click(future);
    expect(primary().textContent).toContain('能力方法');
    const ordinary = value.actions.find(action => action.command.type === 'PREPARE' && action.command.method === 'ORDINARY')!;
    const details = screen.getByText('其他操作、普通替代与退出').closest('details')!;
    expect(details.open).toBe(false);
    fireEvent.click(screen.getByText('其他操作、普通替代与退出'));
    fireEvent.click(within(details).getByRole('button', { name: `${ordinary.label}${ordinary.cost}` }));
    expect(view.onCommand).not.toHaveBeenCalled();
    fireEvent.click(confirm());
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'PREPARE', caseId: 'lasting-form', method: 'ORDINARY' });
  });

  it('renders the actual current form, paid resources and private original belongings without creating or mutating a body', () => {
    const state = formReady(), before = structuredClone(state), value = projectAncientEvil(state), view = show(value, { onClose: vi.fn() });
    expect(room().textContent).toContain('同一原身体当前为兔形，实际在四米处');
    expect(room().textContent).toContain('本次同一身体的兔形还剩90秒');
    expect(room().textContent).toContain('本练习兔形最长90秒');
    expect(screen.getByRole('region', { name: '古代邪物原衣物与原包' }).textContent).toContain('原衣物1套，仍在原私密托盘，尚未实际穿回；原包1个，仍在同一托盘');
    expect(attempt().textContent).toContain('当前记录许可：仅同意本次有限练习');
    expect(attempt().textContent).toContain('本次实际消耗6灵性、2精神、0便士');
    expect(primary().textContent).toContain('停止新输入');
    expect(resources().textContent).toContain(`灵性${state.spirituality}/120`);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    for (const button of within(targets()).getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(view.container.textContent).not.toMatch(editorial);
    expect(screen.getAllByRole('region', { name: '埃尔莎同一原身体' })).toHaveLength(1);
    expect(state).toEqual(before);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('keeps a stopped form present until the actual zero-action wait receipt and still requires original belongings returned', () => {
    let state = ae(formReady(), { type: 'STOP', caseId: 'lasting-form' });
    const value = projectAncientEvil(state), onCommand = vi.fn(), onClose = vi.fn(), view = render(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} onClose={onClose} />);
    const remaining = state.ancientEvil.life.operation.form!.expiresAt - state.silentDisciple.life.clockSeconds;
    expect(primary().textContent).toContain('实际等待当前形态全部剩余时间');
    expect(primary().textContent).toContain(`0行动 · ${remaining}秒`);
    expect(room().textContent).toContain('0行动、0灵性实际等待');
    view.rerender(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    expect(room().textContent).toContain(`兔形还剩${remaining}秒`);
    fireEvent.click(confirm(openPrimary()));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'WAIT_FORM', caseId: 'lasting-form' });
    expect(room().textContent).toContain('当前为兔形');
    const before = state;
    state = ae(state, { type: 'WAIT_FORM', caseId: 'lasting-form' });
    view.rerender(<AncientEvilPanel value={projectAncientEvil(state)} busy={false} onCommand={onCommand} />);
    expect(room().textContent).toContain('同一原身体当前为人形');
    expect(attempt().textContent).toContain(`已实际等待${remaining}秒`);
    expect(primary().textContent).toContain('私下穿回原衣并归包');
    expect(room().textContent).toContain('尚未实际穿回');
    expect(state.spirituality).toBe(before.spirituality);
    expect(state.mind).toBe(before.mind);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    state = ae(state, { type: 'RETURN_ITEMS', caseId: 'lasting-form' });
    state = ae(state, { type: 'WALK', caseId: 'lasting-form', to: 'START' });
    state = ae(state, { type: 'INSPECT', caseId: 'lasting-form' });
    state = ae(state, { type: 'LEAVE', caseId: 'lasting-form' });
    view.rerender(<AncientEvilPanel value={projectAncientEvil(state)} busy={false} onCommand={onCommand} onClose={onClose} />);
    expect(room().textContent).toContain('原衣与原包已实际归还并穿回');
    expect(room().textContent).toContain('本人实际在原门口');
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onCommand).toHaveBeenCalledTimes(1);
    expect(state.spirituality).toBe(before.spirituality);
  });

  it('shows current withdrawn permission and real residual without allowing another cast or refund', () => {
    const state = ae(formReady('revoked-form'), { type: 'WITHDRAW_PERMISSION', caseId: 'revoked-form' });
    const view = show(projectAncientEvil(state));
    expect(attempt().textContent).toContain('已撤回同意');
    expect(attempt().textContent).toContain('已撤回的许可不能复用，禁止新变形');
    expect(attempt().textContent).toContain('本次实际消耗6灵性、2精神');
    expect(room().textContent).toContain('当前为兔形');
    expect(room().textContent).toContain('兔形还剩89秒');
    expect(screen.queryByRole('button', { name: /尝试同一身体的持久变形/ })).toBeNull();
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('requires the actual current form and correct identity for guided release and preserves a failed release cost', () => {
    const state = identityCompared(formReady('original-link', true, false), 'original-link');
    const value = projectAncientEvil(state), onCommand = vi.fn(), view = render(<AncientEvilPanel value={value} busy={false} onCommand={onCommand} />);
    expect(primary().textContent).toContain('按原身份引导结束自己本次变形');
    expect(primary().textContent).toContain('4灵性 · 成功2精神／失败4精神');
    expect(attempt().textContent).toContain('同一身体身份已实际核对，当时为兔形');
    fireEvent.click(confirm(openPrimary()));
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'CURSE_GUIDANCE', caseId: 'original-link' });
    const after = ae(state, { type: 'CURSE_GUIDANCE', caseId: 'original-link' });
    view.rerender(<AncientEvilPanel value={projectAncientEvil(after)} busy={false} onCommand={onCommand} />);
    expect(attempt().textContent).toContain('解咒引导：失败');
    expect(attempt().textContent).toContain('本次实际消耗10灵性、6精神');
    expect(room().textContent).toContain('当前为兔形');
    expect(primary().textContent).toContain('实际等待当前形态全部剩余时间');
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('shows a failed actual form attempt as paid human-form evidence without inventing a timer or ability success', () => {
    const state = formReady('lasting-form', false), view = show(projectAncientEvil(state));
    expect(room().textContent).toContain('同一原身体当前为人形');
    expect(room().textContent).toContain('兔形还剩0秒');
    expect(attempt().textContent).toContain('持续变形：失败');
    expect(attempt().textContent).toContain('本次实际消耗6灵性、4精神');
    expect(attempt().textContent).toContain('实际应用0项');
    expect(screen.queryByRole('button', { name: /实际等待当前形态全部剩余时间/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /按原身份引导结束自己本次变形/ })).toBeNull();
    expect(view.onCommand).not.toHaveBeenCalled();
  });

  it('allows ordinary life only after actual safe returns and keeps an optional conflict separate', () => {
    let state = lifePromotion();
    for (const caseId of ANCIENT_EVIL_CASE_IDS) state = ordinaryCase(state, caseId);
    state = ae(state, { type: 'REFLECT' });
    const value = projectAncientEvil(state), onClose = vi.fn(), view = show(value, { onClose });
    expect(value.insideCase).toBe(false);
    expect(room().textContent).toContain('同一原身体当前为人形');
    expect(room().textContent).toContain('本人实际在原门口');
    expect(room().textContent).toContain('已实际穿着');
    fireEvent.click(screen.getByRole('button', { name: '可选原房间交战' }));
    expect(screen.getByRole('region', { name: '古代邪物原房间冲突' }).textContent).toContain(value.encounter.story);
    expect(disabled(primary())).toBe(false);
    expect(screen.getByRole('region', { name: '古代邪物原房间冲突' }).textContent).toContain('莱娜 · 45岁');
    expect(screen.getByRole('region', { name: '古代邪物原房间冲突' }).textContent).toContain('本人在原门口，埃尔莎在四米处，哈伦在原门口');
    expect(view.container.textContent).not.toMatch(editorial);
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(view.onCommand).not.toHaveBeenCalled();
    expect(state.progression.mastery['chained.s2.enduring-transfiguration']).toBe(0);
    expect(state.progression.mastery['chained.s2.curse-guidance']).toBe(0);
    const approached = ae(ae(state, { type: 'PREPARE_ENCOUNTER' }), { type: 'ENCOUNTER_TALK' });
    view.rerender(<AncientEvilPanel value={projectAncientEvil(approached)} busy={false} onCommand={view.onCommand} onClose={onClose} />);
    const encounter = screen.getByRole('region', { name: '古代邪物原房间冲突' });
    expect(encounter.textContent).toContain('本人在四米处，埃尔莎在室外，哈伦在室外');
    expect(encounter.textContent).toContain(`原室时钟${state.silentDisciple.life.clockSeconds + 16}秒`);
    expect(encounter.textContent).toContain('唯一原杖仍由本人持有');
    expect(resources().textContent).toContain(`精神${state.mind - 2}/100`);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(view.container.textContent).not.toMatch(editorial);
  });

  it('renders and confirms from a deeply frozen actual projection without changing authoritative data', () => {
    const state = formReady(), value = projectAncientEvil(state), before = JSON.stringify(value);
    const freeze = (entry: unknown): void => {
      if (!entry || typeof entry !== 'object') return;
      Object.freeze(entry);
      Object.values(entry).forEach(freeze);
    };
    freeze(value);
    const view = show(value);
    fireEvent.click(confirm(openPrimary()));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'STOP_INPUT', caseId: 'lasting-form' });
    expect(JSON.stringify(value)).toBe(before);
    expect(state.silentDisciple.life.volunteer.form).toBe('RABBIT');
  });
});
