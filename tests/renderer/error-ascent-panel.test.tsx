/* @vitest-environment jsdom */
/** Actual public projections from the retained 197 history and paid Error route.
 * The sole future d100 at cursor 397 is explicitly controlled to 1. This bridge
 * tests UI/retry transport, not SQLite durability or a natural success run. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection } from '../../src/domain/slice/types.js';
import { openErrorAscentRuntimeSession } from '../../src/domain/error-ascent/owned-session.js';
import { ERROR_ASCENT_ABILITY_IDS } from '../../src/domain/error-ascent/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { ErrorAscentCommand, SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';
import {
  assertUnmodifiedErrorAscentInput, errorAscentPublicLeaks,
  installControlledErrorAscentReplacement, preparedErrorAscentRoute, stepErrorAscent,
} from '../helpers/error-ascent-scenario.js';

interface Views {
  source: SliceProjection; guided: SliceProjection;
  beforeReplace: SliceProjection; success: SliceProjection; replace: ErrorAscentCommand;
}
let views: Views | undefined;
function saved(): Views {
  if (!views) throw Error('The controlled Error route has not been constructed.');
  return views;
}
beforeAll(() => {
  const control = installControlledErrorAscentReplacement(1);
  try {
    const route = preparedErrorAscentRoute(), session = openErrorAscentRuntimeSession(route.beforeReplace);
    const source = projectSliceState(route.source), guided = projectSliceState(route.guided);
    const beforeReplace = session.project();
    stepErrorAscent(session, route.replace);
    const success = session.project();
    for (const view of [source, guided, beforeReplace, success]) expect(errorAscentPublicLeaks(view)).toEqual([]);
    expect(source).toMatchObject({ health: 70, mind: 96, spirituality: 112, cash: 867, actionsRemaining: 3,
      progression: { pathwayId: 'error', sequence: 1 } });
    expect(success).toMatchObject({ maxSpirituality: 150, canAct: false,
      progression: { pathwayId: 'error', sequence: 0 }, lastCheck: { roll: 1, tier: 'GREAT_SUCCESS' } });
    expect(control.substituted.length).toBeGreaterThan(0);
    expect(control.substituted.every(draw => draw.cursorBefore === 397 && draw.cursorAfter === 398 && draw.controlled === 1)).toBe(true);
    // Keep only public projections between cases, never the multi-megabyte private route.
    views = { source, guided, beforeReplace, success, replace: route.replace };
  } finally { control.restore(); }
}, 120_000);

interface Transition { command: ErrorAscentCommand; after: SliceProjection; failOnce?: boolean }
const disposers: (() => void)[] = [];
function publicAdapter(initial: SliceProjection, transition?: Transition) {
  let current: SliceProjection | null = initial, next: Transition | undefined = transition;
  let pending: SliceEnvelope | null = null, failed = false, commits = 0;
  const head = () => {
    if (!current) throw Error('The public bridge was disposed.');
    return current;
  };
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => {
    const value = head();
    return { ok: true, value: { mode: 'desktop', activeState: structuredClone(value), runs: [{
      runId: value.runId, name: value.character.name, portraitId: value.character.portraitId,
      week: value.week, date: value.date, status: value.status, revision: value.revision,
      updatedAt: '2026-10-18T17:00:00.000Z',
    }] } };
  });
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(head().runId);
    return { ok: true, value: structuredClone(head()) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (!next) throw Error('No additional real transition was supplied.');
    if (pending) expect(envelope).toEqual(pending);
    const before = head();
    expect(envelope).toEqual({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: { type: 'ERROR_ASCENT', command: next.command } });
    if (next.failOnce && !failed) {
      failed = true; pending = structuredClone(envelope);
      return { ok: false, error: { code: 'SAVE_FAILED', message: '保存失败', retryable: true } };
    }
    expect(next.after.revision).toBe(before.revision + 1);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: before.runId,
      previousRevision: before.revision, newRevision: next.after.revision,
      committedAt: '2026-10-18T17:00:01.000Z', replayed: false, state: structuredClone(next.after) };
    current = next.after; next = undefined; pending = null; commits++;
    return { ok: true, value: receipt };
  });
  disposers.push(() => {
    getBootstrap.mockReset(); loadRun.mockReset(); submitIntent.mockReset();
    current = null; next = undefined; pending = null;
  });
  return { bridge: { getBootstrap, loadRun, submitIntent },
    get current() { return head(); }, get commits() { return commits; } };
}
async function mount(game: ReturnType<typeof publicAdapter>) {
  window.sliceGame = game.bridge;
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(game.current.character.name) }));
  await waitFor(() => expect(game.bridge.loadRun).toHaveBeenLastCalledWith(game.current.runId));
  if (game.current.errorAscent.guidanceKnown) {
    await screen.findByRole('region', { name: game.current.errorAscent.title });
  } else {
    const oldRound = screen.queryByRole('dialog', { name: '战斗回合结果' });
    if (oldRound) await userEvent.click(within(oldRound).getByRole('button', { name: '返回生活' }));
    await screen.findByRole('button', { name: '时之虫与登记室' });
  }
  return view;
}
function assertPage(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: value.errorAscent.title }), r = value.errorAscent.resources;
  expect(panel.textContent).toContain('健康 ' + r.health + '/' + r.maxHealth + ' · 精神 ' + r.mind + '/' + r.maxMind
    + ' · 灵性 ' + r.spirituality + '/' + r.maxSpirituality + ' · 现金 ' + r.cash
    + ' · 本周行动 ' + r.actionsRemaining + '/' + r.weeklyBudget);
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, cash: value.cash + '便士', actionsRemaining: value.actionsRemaining });
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.errorAscent.nextStep);
  expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
    .toContain(value.character.name + ' · ' + value.errorAscent.title);
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '时之虫成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|seed|cursor|原创|G\d+/);
  return panel;
}
function enabledAction(value: SliceProjection, command: ErrorAscentCommand) {
  const action = value.errorAscent.actions.find(item => item.enabled && JSON.stringify(item.command) === JSON.stringify(command));
  if (!action) throw Error('The actual enabled Error action is missing.');
  return action;
}
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame;
  for (const dispose of disposers.splice(0)) dispose();
  vi.resetAllMocks(); vi.restoreAllMocks();
});
afterAll(() => { views = undefined; assertUnmodifiedErrorAscentInput(); });

describe('Error219 real public SliceApp entry and controlled replacement', () => {
  it('opens from TimeWorm with the original injury/resources, then commits guidance and locks ordinary main actions', async () => {
    const { source, guided } = saved(), learn = enabledAction(source, { type: 'LEARN_GUIDANCE' });
    const game = publicAdapter(source, { command: learn.command, after: guided });
    await mount(game);
    await userEvent.click(screen.getByRole('button', { name: '时之虫与登记室' }));
    const timeWormPanel = await screen.findByRole('region', { name: '时之虫成长' });
    expect(within(timeWormPanel).getByRole('heading', { level: 2, name: source.timeWorm.title })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '查看错误晋升准备' }));
    let panel = assertPage(source);
    expect(panel.textContent).toContain('健康 70/100 · 精神 96/100 · 灵性 112/120 · 现金 867便士 · 本周行动 3/3');
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('重伤 · 未处理');
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('button', { name: '时之虫与登记室' })).toBeTruthy();
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '时之虫与登记室' }));
    await userEvent.click(screen.getByRole('button', { name: '查看错误晋升准备' }));
    const trigger = within(assertPage(source)).getByRole('button', { name: learn.label });
    fireEvent.click(trigger); fireEvent.click(trigger);
    await waitFor(() => assertPage(guided));
    panel = assertPage(guided);
    expect(guided.canAct).toBe(false); expect(guided.actionBlockedReason).toContain('错误');
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('重伤 · 未处理');
    expect(guided.errorAscent.abilities).toHaveLength(16);
    expect(guided.errorAscent.abilities.filter(ability => ability.mastery === 0)).toHaveLength(2);
    const preferred = guided.errorAscent.actions.find(action => action.preferredAction && action.enabled)!;
    await waitFor(() => expect(disabled(within(panel).getByRole('button', { name: preferred.label }))).toBe(false));
    expect(game.bridge.submitIntent).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: source.runId,
      expectedRevision: source.revision, payload: { type: 'ERROR_ASCENT', command: learn.command } });
    expect(game.commits).toBe(1);
  }, 30_000);

  it('cancels the actual REPLACE review, keeps old state on save failure, and retries once into the real S0 page', async () => {
    const { source, beforeReplace, success, replace } = saved(), action = enabledAction(beforeReplace, replace);
    const game = publicAdapter(beforeReplace, { command: replace, after: success, failOnce: true });
    const first = await mount(game);
    const preparedPanel = assertPage(beforeReplace);
    expect(within(preparedPanel).getByRole('region', { name: '钟塔这一场仪式' }).textContent)
      .toContain('此刻替位成功率' + success.lastCheck!.chance + '%');
    const trigger = within(preparedPanel).getByRole('button', { name: action.label });
    await userEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '替代仪式确认' });
    for (const text of [action.cost, '30灵性', '8精神', '已付费用不会自动退还', '严重失败可能死亡']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '替代仪式确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled(); assertPage(beforeReplace);
    await userEvent.click(trigger);
    dialog = screen.getByRole('dialog', { name: '替代仪式确认' });
    const confirm = within(dialog).getByRole('button', { name: '确认执行本次替代' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    assertPage(beforeReplace);
    expect(game.current).toBe(beforeReplace); expect(game.commits).toBe(0);
    expect(disabled(trigger)).toBe(true);
    expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    fireEvent.click(trigger);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => assertPage(success));
    const panel = assertPage(success);
    expect(screen.queryByRole('dialog', { name: '替代仪式确认' })).toBeNull();
    expect(success.errorAscent.promoted).toBe(true);
    expect(success.canAct).toBe(false); expect(success.actionBlockedReason).toContain('错误');
    expect(success.maxSpirituality).toBe(150);
    expect(success.spirituality).toBe(beforeReplace.spirituality - 30);
    expect(success.mind).toBe(beforeReplace.mind - 8);
    expect(success.spirituality).toBeLessThan(150);
    expect(panel.textContent).toContain('灵性 ' + success.spirituality + '/150');
    expect(within(panel).getByRole('region', { name: '最近行动结果' }).textContent).toContain('实际掷骰 1');
    expect(success.errorAscent.actions.some(item => item.command.type === 'RITUAL' && item.command.command.type === 'REPLACE')).toBe(false);
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const retreat = enabledAction(success, { type: 'RITUAL', command: { type: 'RETREAT' } });
    await waitFor(() => expect(disabled(within(panel).getByRole('button', { name: retreat.label }))).toBe(false));
    await userEvent.click(within(panel).getByText('能力与掌握', { selector: 'summary' }));
    expect(success.errorAscent.abilities).toHaveLength(18);
    for (const ability of success.errorAscent.abilities)
      expect(within(panel).getByRole('heading', { name: ability.label + ' · 熟练 ' + ability.mastery })).toBeTruthy();
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(success.progression.mastery[id]).toBe(mastery);
    for (const id of ERROR_ASCENT_ABILITY_IDS) expect(success.progression.mastery[id]).toBe(0);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(game.commits).toBe(1);
    first.unmount(); await mount(game);
    assertPage(success);
    expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
  }, 30_000);
});
