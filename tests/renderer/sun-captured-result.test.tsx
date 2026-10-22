/* @vitest-environment jsdom */
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { SUN_ABILITY_IDS } from '../../src/domain/sun/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';
import {
  ROOT, assertCurrentGlobal, assertGlobalPublic, assertPublicOnly, filePin, hash,
  migrateCapturedSunState, readActionAt, type FilePin,
} from '../helpers/sun-capture.js';

/** Actual captured public transitions only. The bridge adapter establishes
 * renderer display/retry/reopen behavior; real persistence is covered by the
 * separate SQLite suite. No producer, RNG control or synthesized success. */
const PANEL = '序列0 太阳';
const checkedFiles = new Map<string, FilePin>();
const checkedStates: Array<{ value: SliceState; sha256: string }> = [];
const disabled = (button: HTMLElement): boolean => (button as HTMLButtonElement).disabled;
const descriptions = (button: HTMLElement) => button.getAttribute('aria-describedby')!.split(' ')
  .map(id => document.getElementById(id)?.textContent);
function captured(count: number) {
  const action = readActionAt(count), path = join(ROOT, `action-${count}.json.gz`);
  checkedFiles.set(path, filePin(path));
  checkedStates.push({ value: action.beforeLast, sha256: action.audit.beforeStateSha256 },
    { value: action.final, sha256: action.audit.afterStateSha256 });
  const beforeState = migrateCapturedSunState(action.beforeLast), state = migrateCapturedSunState(action.final);
  const before = projectSliceState(beforeState), value = projectSliceState(state);
  assertCurrentGlobal(before, action, 'before'); assertCurrentGlobal(value, action, 'after');
  assertGlobalPublic(before, beforeState); assertGlobalPublic(value, state);
  expect(value.character.name).toBe('塞琳'); expect(value.character).toEqual(action.final.character);
  return { action, beforeState, state, before, value };
}
interface Transition { intent: SliceIntent; after: SliceProjection; firstResponse?: 'save-failed' | 'response-lost' }
function publicAdapter(initial: SliceProjection, transition: Transition) {
  let current = initial, commits = 0, failures = 0, pending: SliceEnvelope | null = null, saved: SliceReceipt | null = null;
  // Supplying closures through mockImplementation (rather than vi.fn(fn))
  // lets mockReset release complete captures at the end of each test.
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(current), runs: [{ runId: current.runId,
      name: current.character.name, portraitId: current.character.portraitId, week: current.week,
      date: current.date, status: current.status, revision: current.revision, updatedAt: '2026-10-18T05:30:00Z' }],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(current.runId); return { ok: true, value: structuredClone(current) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    expect(envelope).toEqual(pending ?? { intentId: expect.any(String), runId: initial.runId,
      expectedRevision: initial.revision, payload: transition.intent });
    if (saved) {
      expect(envelope.intentId).toBe(saved.intentId); pending = null;
      return { ok: true, value: { ...structuredClone(saved), replayed: true } };
    }
    const fail = failures === 0 && !!transition.firstResponse;
    if (fail) { failures++; pending = structuredClone(envelope); }
    if (fail && transition.firstResponse === 'save-failed')
      return { ok: false, error: { code: 'SAVE_FAILED', message: '保存失败', retryable: true } };
    expect(transition.after.revision).toBe(initial.revision + 1);
    saved = { intentId: envelope.intentId, runId: initial.runId, previousRevision: initial.revision,
      newRevision: transition.after.revision, committedAt: '2026-10-18T05:30:00Z', replayed: false,
      state: structuredClone(transition.after) };
    current = transition.after; commits++;
    if (fail && transition.firstResponse === 'response-lost')
      return { ok: false, error: { code: 'RESPONSE_LOST', message: '保存回执未收到', retryable: true } };
    pending = null; return { ok: true, value: structuredClone(saved) };
  });
  return { bridge: { getBootstrap, loadRun, submitIntent }, get current() { return current; }, get commits() { return commits; } };
}
type PublicAdapter = ReturnType<typeof publicAdapter>;
async function openPage(game: PublicAdapter) {
  const bootstrapCalls = game.bridge.getBootstrap.mock.calls.length, loadCalls = game.bridge.loadRun.mock.calls.length;
  window.sliceGame = game.bridge; const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(game.current.character.name) }));
  await screen.findByRole('region', { name: PANEL });
  expect(game.bridge.getBootstrap).toHaveBeenCalledTimes(bootstrapCalls + 1);
  expect(game.bridge.loadRun).toHaveBeenCalledTimes(loadCalls + 1);
  expect(game.bridge.loadRun).toHaveBeenLastCalledWith(game.current.runId); return view;
}
function assertPage(value: SliceProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: PANEL }), topbar = screen.getByRole('button', { name: '返回主菜单' }).closest('header');
  expect(topbar!.textContent).toContain(`${value.character.name} · ${value.sun.title}`);
  expect(topbar!.textContent).toContain(`第 ${value.week} 周`);
  const r = value.sun.resources;
  expect(panel.textContent).toContain(`健康 ${r.health} · 精神 ${r.mind} · 灵性 ${r.spirituality} · ${r.cash} · 本周行动 ${r.actionsRemaining}`);
  expect(panel.textContent).toContain(value.sun.story);
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.sun.nextStep);
  if (value.sun.promoted) {
    expect(value.maxSpirituality).toBe(150);
    expect(panel.textContent).toContain(`灵性${value.spirituality}/150`);
  }
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '纯白天使成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  assertGlobalPublic(value, state); assertPublicOnly({ renderedText: document.body.textContent }, state); return panel;
}
async function assertAbilities(value: SliceProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: PANEL }), summary = within(panel).getByText('已掌握的能力', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  expect(value.sun.abilities).toHaveLength(24);
  for (const ability of value.sun.abilities) {
    expect(ability.mastery).toBe(state.progression.mastery[ability.id]);
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  }
  for (const [id, mastery] of Object.entries(state.sun.source!.budget.mastery)) expect(state.progression.mastery[id]).toBe(mastery);
}
async function clickCapturedAction(value: SliceProjection, intent: SliceIntent) {
  if (intent.type !== 'SUN') throw Error('Expected an actual Sun command');
  const command = intent.command, action = value.sun.actions.find(item => hash(item.command) === hash(command))!;
  expect(action).toBeDefined(); expect(action.enabled).toBe(true);
  const panel = screen.getByRole('region', { name: PANEL });
  let button = within(panel).queryByRole('button', { name: action.label });
  if (!button) {
    const summary = within(panel).getByText('其他可选行动', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    button = within(panel).getByRole('button', { name: action.label });
  }
  expect(disabled(button)).toBe(false); expect(descriptions(button)).toEqual([action.cost]);
  fireEvent.click(button); fireEvent.click(button); return button;
}
async function settled(panel: HTMLElement) {
  await waitFor(() => expect(within(panel).queryByText('正在结算并保存这一次操作，请稍候。')).toBeNull());
}
async function assertBridgePublic(game: PublicAdapter, state: SliceState) {
  for (const mock of [game.bridge.getBootstrap, game.bridge.loadRun, game.bridge.submitIntent])
    for (const result of mock.mock.results) assertPublicOnly(await result.value, state);
}
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  for (const [path, pin] of checkedFiles) expect(filePin(path), 'Original compressed capture remains untouched').toEqual(pin);
  for (const { value, sha256 } of checkedStates) expect(hash(value), 'Original complete private state remains untouched').toBe(sha256);
  checkedFiles.clear(); checkedStates.length = 0;
});

describe('Sun216 actual natural934 captured results', () => {
  it('keeps ordinary actions and lifestyle unreachable after actual guidance854 while allowing actual Sun travel855 once and after reopen', async () => {
    const guidance = readActionAt(854), { action, beforeState, state, before, value } = captured(855);
    const guidancePath = join(ROOT, 'action-854.json.gz'); checkedFiles.set(guidancePath, filePin(guidancePath));
    checkedStates.push({ value: guidance.beforeLast, sha256: guidance.audit.beforeStateSha256 },
      { value: guidance.final, sha256: guidance.audit.afterStateSha256 });
    expect(guidance.lastIntent).toEqual({ type: 'SUN', command: { type: 'LEARN_GUIDANCE' } });
    expect(guidance.beforeLast.sun.guidanceKnown).toBe(false); expect(guidance.beforeLast.sun.source).toBeNull();
    expect(guidance.final.sun.guidanceKnown).toBe(true); expect(guidance.final.sun.source).not.toBeNull();
    expect(hash(guidance.final)).toBe(action.audit.beforeStateSha256);
    expect(hash(guidance.globalPublic)).toBe(action.audit.globalPublicBeforeSha256);
    assertCurrentGlobal(before, guidance, 'after');
    expect(action.lastIntent).toEqual({ type: 'SUN', command: { type: 'TRAVEL', to: 'SUN0-WASHHOUSE' } });
    function ordinaryActionsUnavailable(current: SliceProjection) {
      expect(current.sun.guidanceKnown).toBe(true); expect(current.canAct).toBe(false);
      expect(current.actionBlockedReason).toBe('请在当前街区与筹备处继续行动。');
      // The authentic guided route renders the Sun page directly. It never
      // mounts the ordinary dashboard, so do not fabricate a route to test it.
      expect(screen.queryByRole('group', { name: '四个主要行动' })).toBeNull();
      expect(document.querySelectorAll('[data-life-action]')).toHaveLength(0);
      for (const label of ['工作', '学习', '调查', '休养'])
        expect(screen.queryByRole('button', { name: new RegExp(`^${label}，1行动，`) })).toBeNull();
      for (const name of ['调整下周生活', '返回普通生活']) expect(screen.queryByRole('button', { name })).toBeNull();
      for (const name of ['选择学习主题', '选择调查目标', '下周生活标准'])
        expect(screen.queryByRole('dialog', { name })).toBeNull();
    }
    const game = publicAdapter(before, { intent: action.lastIntent, after: value }), first = await openPage(game);
    assertPage(before, beforeState); ordinaryActionsUnavailable(before);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    await clickCapturedAction(before, action.lastIntent);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain(value.sun.nextStep));
    const panel = assertPage(value, state); ordinaryActionsUnavailable(value); await settled(panel);
    expect(game.commits).toBe(1); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    expect(game.bridge.submitIntent.mock.calls[0]![0].payload).toEqual(action.lastIntent);
    const text = panel.textContent; first.unmount(); await openPage(game);
    expect(assertPage(value, state).textContent).toBe(text); ordinaryActionsUnavailable(value);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); await assertBridgePublic(game, state);
  }, 120_000);

  it('reviews and cancels actual promotion923, then confirms once and reopens74% roll57 with new skills at zero and maximum150', async () => {
    const { action, beforeState, state, before, value } = captured(923);
    const game = publicAdapter(before, { intent: action.lastIntent, after: value }), first = await openPage(game);
    assertPage(before, beforeState); await clickCapturedAction(before, action.lastIntent);
    let dialog = screen.getByRole('dialog', { name: '太阳服药确认' });
    expect(dialog.textContent).toContain('74%'); expect(dialog.textContent).toContain('严重失败可能死亡');
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '太阳服药确认' })).toBeNull(); expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    await clickCapturedAction(before, action.lastIntent); dialog = screen.getByRole('dialog', { name: '太阳服药确认' });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '太阳服药确认' })).toBeNull());
    const panel = assertPage(value, state), result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['本次成功率 74%，实际掷骰 57', '精神变化-12', '灵性变化-30']) expect(result.textContent).toContain(text);
    expect(SUN_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([0, 0]);
    await assertAbilities(value, state); await settled(panel);
    const text = panel.textContent; first.unmount(); await openPage(game); await assertAbilities(value, state);
    expect(assertPage(value, state).textContent).toBe(text); expect(game.commits).toBe(1);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); await assertBridgePublic(game, state);
  }, 120_000);

  it('shows actual directed-radiance929 success and paid resources without claiming application or earned mastery', async () => {
    const { action, state, before, value } = captured(929);
    const game = publicAdapter(before, { intent: action.lastIntent, after: value }), first = await openPage(game);
    await clickCapturedAction(before, action.lastIntent);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('尚未实际清除残留'));
    const panel = assertPage(value, state), result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['成功 · 意志检定', '本次成功率 70%，实际掷骰 14', '现款变化-8便士', '精神变化-8', '灵性变化-14']) expect(result.textContent).toContain(text);
    expect(state.sun.epilogue!.radiance).toMatchObject({ passed: true, applied: false });
    expect(state.progression.mastery[SUN_ABILITY_IDS[0]]).toBe(0);
    expect([value.cash, value.mind, value.spirituality, value.actionsRemaining]).toEqual([42, 70, 50, 1]);
    await settled(panel); const text = panel.textContent; first.unmount(); await openPage(game);
    expect(assertPage(value, state).textContent).toBe(text); expect(game.commits).toBe(1);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); await assertBridgePublic(game, state);
  }, 120_000);

  it.each(['save-failed', 'response-lost'] as const)('keeps actual ward931 failure and retries the identical envelope after %s', async firstResponse => {
    const { action, beforeState, state, before, value } = captured(931);
    const game = publicAdapter(before, { intent: action.lastIntent, after: value, firstResponse }), first = await openPage(game);
    const trigger = await clickCapturedAction(before, action.lastIntent);
    const retry = await screen.findByRole('button', { name: '重试这次操作' }); assertPage(before, beforeState);
    expect(disabled(trigger)).toBe(true); expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); fireEvent.click(trigger); expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('护持失败，衬片已耗'));
    const panel = assertPage(value, state), result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['失败 · 知识检定', '本次成功率 70%，实际掷骰 95', '健康变化-8', '精神变化-6', '灵性变化-12', '现款变化-6便士']) expect(result.textContent).toContain(text);
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('1. 轻伤 · 未处理');
    expect([value.health, value.mind, value.spirituality, value.maxSpirituality, value.cash, value.actionsRemaining]).toEqual([92, 64, 38, 150, 36, 0]);
    await settled(panel);
    const exits = within(panel).getByRole('region', { name: '暂停与安全返回' }); expect(exits.closest('details')).toBeNull();
    const cutoff = within(exits).getByRole('button', { name: '普通切断供料、泄压并封闭原槽' });
    expect(disabled(cutoff)).toBe(false); expect(descriptions(cutoff)[0]).toContain('0行动、0便士、0灵性、0精神');
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(game.commits).toBe(1); const text = panel.textContent; first.unmount(); await openPage(game);
    expect(assertPage(value, state).textContent).toBe(text);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2); await assertBridgePublic(game, state);
  }, 120_000);

  it('keeps actual ordinary side-exit933 visible at zero actions and reopens the same rescued people, injury and costs', async () => {
    const { action, state, before, value } = captured(933);
    expect([before.actionsRemaining, value.actionsRemaining]).toEqual([0, 0]);
    expect(state.random).toEqual(action.beforeLast.random); expect(state.lastCheck).toBeNull();
    const game = publicAdapter(before, { intent: action.lastIntent, after: value }), first = await openPage(game);
    const exits = screen.getByRole('region', { name: '暂停与安全返回' }); expect(exits.closest('details')).toBeNull();
    const exit = within(exits).getByRole('button', { name: '沿普通侧道实际撤人' });
    expect(disabled(exit)).toBe(false); expect(descriptions(exit)[0]).toContain('0行动、0便士、0灵性、0精神');
    await clickCapturedAction(before, action.lastIntent);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('十八米普通侧道来到院内'));
    const panel = assertPage(value, state), result = within(panel).getByRole('region', { name: '最近行动结果' });
    expect(result.textContent).not.toContain('实际掷骰'); expect(result.textContent).toContain('原伤、损坏和已用材料全部保留');
    expect(state.sun.epilogue).toMatchObject({ status: 'RESOLVED', reported: false,
      resident: { position: 0, health: 100 }, arrival: { route: 'SIDE', residentMeters: 18, thermalHealthLoss: 0 } });
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('轻伤 · 未处理');
    await settled(panel); const text = panel.textContent; first.unmount(); await openPage(game);
    expect(assertPage(value, state).textContent).toBe(text); expect(game.commits).toBe(1);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1); await assertBridgePublic(game, state);
  }, 120_000);

  it('reopens actual final report934 after a lost response without awarding the failed ward or repairing original damage', async () => {
    const { action, state, before, value } = captured(934);
    const game = publicAdapter(before, { intent: action.lastIntent, after: value, firstResponse: 'response-lost' }), first = await openPage(game);
    await clickCapturedAction(before, action.lastIntent);
    const retry = await screen.findByRole('button', { name: '重试这次操作' }); fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('如实交接：托马斯·黑尔已在院内'));
    const panel = assertPage(value, state), result = within(panel).getByRole('region', { name: '最近行动结果' });
    for (const text of ['莉娜仍在院内且原脚踝伤存在', '原炉状况72', '两份原燃料均耗尽', '四份残留中和4、封闭0、外露0']) expect(result.textContent).toContain(text);
    expect(result.textContent).not.toContain('实际掷骰'); expect(SUN_ABILITY_IDS.map(id => state.progression.mastery[id])).toEqual([8, 0]);
    await assertAbilities(value, state); await settled(panel);
    expect(state.sun.epilogue).toMatchObject({ status: 'RESOLVED', reported: true, ward: { attempted: true, passed: false, applied: false } });
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    const text = panel.textContent; first.unmount(); await openPage(game); await assertAbilities(value, state);
    expect(assertPage(value, state).textContent).toBe(text); expect(game.commits).toBe(1);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2); await assertBridgePublic(game, state);
  }, 120_000);
});
