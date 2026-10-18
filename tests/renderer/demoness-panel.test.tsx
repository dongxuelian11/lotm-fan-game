/* @vitest-environment jsdom */
/** Untouched actual688, paid same-original controlled S1 recovery and genuine
 * S1 reflection followed by the real paid Demoness preparation. Only the future
 * S0 draw is controlled here. The public-only adapter
 * tests UI/retry transport, not SQLite durability or natural success. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection } from '../../src/domain/slice/types.js';
import { DEMONESS_ABILITY_IDS } from '../../src/domain/demoness/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { DemonessCommand, SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';
import {
  assertDemonessSourceUnmodified, demonessPublicLeaks, controlledDemonessRolls,
  preparedDemonessScenario, executeDemoness,
} from '../helpers/demoness-scenario.js';

interface Views {
  source: SliceProjection; guided: SliceProjection;
  beforeConsume: SliceProjection; success: SliceProjection; consume: DemonessCommand;
}
let views: Views | undefined;
function saved(): Views {
  if (!views) throw Error('The controlled Demoness route has not been constructed.');
  return views;
}
beforeAll(() => {
  const route = preparedDemonessScenario(), session = route.session;
  const restore = controlledDemonessRolls(route.beforeConsume, { [route.beforeConsume.random.cursor]: 1 });
  try {
    const source = projectSliceState(route.source), guided = projectSliceState(route.guided);
    const beforeConsume = session.project();
    const consume = beforeConsume.demoness.actions.find(action => action.enabled && action.command.type === 'CONSUME')!.command;
    if (consume.type !== 'CONSUME') throw Error('The real prepared dose has no enabled consumption command.');
    executeDemoness(session, consume);
    const success = session.project();
    for (const view of [source, guided, beforeConsume, success]) expect(demonessPublicLeaks(view)).toEqual([]);
    expect(source).toMatchObject({ progression: { pathwayId: 'demoness', sequence: 1, acting: 100 },
      apocalypseDemoness: { promoted: true, life: { reflected: true } }, demoness: { available: true } });
    expect(success).toMatchObject({ maxSpirituality: 150, canAct: false,
      progression: { pathwayId: 'demoness', sequence: 0 }, lastCheck: { roll: 1, tier: 'GREAT_SUCCESS' } });
    expect(success.lastCheck!.chance).toBeGreaterThanOrEqual(60);
    expect(success.lastCheck!.chance).toBeLessThanOrEqual(80);
    const root = route.beforeConsume.demoness;
    const ready = root.preparations.find(item => item.compoundId === consume.compoundId && item.status === 'READY')!;
    expect(ready).toMatchObject({ compoundId: consume.compoundId, location: root.frame!.location,
      status: 'READY', changedEventId: null });
    expect(root.frame!.nowSecond).toBeGreaterThanOrEqual(ready.preparedSecond);
    expect(root.frame!.nowSecond).toBeLessThanOrEqual(ready.expiresSecond);
    const preparation = root.journal.find(event => event.command.type === 'STABILIZE_PROMOTION' && event.command.compoundId === consume.compoundId)!;
    expect(preparation.command).toEqual({ type: 'STABILIZE_PROMOTION', compoundId: consume.compoundId });
    for (const [key, cost] of [['cash', 150], ['actions', 1], ['spirituality', 12], ['mind', 8]] as const)
      expect(preparation.after.budget[key]).toBe(preparation.before.budget[key] - cost);
    // The UI adapter captures only public projections, never private route authority.
    views = { source, guided, beforeConsume, success, consume };
  } finally { restore(); }
}, 120_000);

interface Transition { command: DemonessCommand; after: SliceProjection; failOnce?: boolean }
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
      updatedAt: '2026-10-18T22:00:00.000Z',
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
      expectedRevision: before.revision, payload: { type: 'DEMONESS', command: next.command } });
    if (next.failOnce && !failed) {
      failed = true; pending = structuredClone(envelope);
      return { ok: false, error: { code: 'SAVE_FAILED', message: '保存失败', retryable: true } };
    }
    expect(next.after.revision).toBe(before.revision + 1);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: before.runId,
      previousRevision: before.revision, newRevision: next.after.revision,
      committedAt: '2026-10-18T22:00:01.000Z', replayed: false, state: structuredClone(next.after) };
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
  if (game.current.demoness.guidanceKnown) {
    await screen.findByRole('region', { name: game.current.demoness.title });
  } else {
    const oldRound = screen.queryByRole('dialog', { name: '战斗回合结果' });
    if (oldRound) await userEvent.click(within(oldRound).getByRole('button', { name: '返回生活' }));
    await screen.findByRole('button', { name: '末日魔女与画廊附室' });
  }
  return view;
}
function assertPage(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: value.demoness.title }), r = value.demoness.resources;
  expect(panel.textContent).toContain('健康 ' + r.health + '/' + r.maxHealth + ' · 精神 ' + r.mind + '/' + r.maxMind
    + ' · 灵性 ' + r.spirituality + '/' + r.maxSpirituality + ' · 现金 ' + r.cash
    + ' · 本周行动 ' + r.actionsRemaining + '/' + r.weeklyBudget);
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, cash: value.cash + '便士', actionsRemaining: value.actionsRemaining });
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.demoness.nextStep);
  expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
    .toContain(value.character.name + ' · ' + value.demoness.title);
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '末日魔女成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|seed|cursor/);
  return panel;
}
function enabledAction(value: SliceProjection, command: DemonessCommand) {
  const action = value.demoness.actions.find(item => item.enabled && JSON.stringify(item.command) === JSON.stringify(command));
  if (!action) throw Error('The actual enabled Demoness action is missing.');
  return action;
}
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame;
  for (const dispose of disposers.splice(0)) dispose();
  vi.resetAllMocks(); vi.restoreAllMocks();
});
afterAll(() => { views = undefined; assertDemonessSourceUnmodified(); });

describe('Demoness218 real public SliceApp entry and controlled consumption', () => {
  it('enters from the actual S1 page with current originals, then keeps paid guidance as the current page', async () => {
    const { source, guided } = saved(), learn = enabledAction(source, { type: 'LEARN_GUIDANCE' });
    const game = publicAdapter(source, { command: learn.command, after: guided });
    await mount(game);
    await userEvent.click(screen.getByRole('button', { name: '末日魔女与画廊附室' }));
    const oldPanel = await screen.findByRole('region', { name: '末日魔女成长' });
    expect(within(oldPanel).getByRole('heading', { level: 2, name: source.apocalypseDemoness.title })).toBeTruthy();
    const oldResources = within(oldPanel).getByRole('region', { name: '末日魔女当前资源' });
    expect(oldResources.textContent).toContain('健康' + source.health + '/100');
    expect(oldResources.textContent).toContain('灵性' + source.spirituality + '/120');
    const originals = within(oldPanel).getByRole('region', { name: '末日魔女原人原物当前状态' });
    const live = source.apocalypseDemoness.life.site!;
    expect(live.playerLocation).toBe('OUTSIDE');
    expect(live.vera!.location).toBe('OUTSIDE'); expect(live.marcus!.location).toBe('OUTSIDE');
    expect(originals.textContent).toContain('精力' + live.playerEnergy + '/100');
    expect(originals.textContent).toContain('精力' + live.vera!.energy + '/100');
    expect(originals.textContent).toContain('精力' + live.marcus!.energy + '/100');
    await userEvent.click(screen.getByRole('button', { name: '查看魔女晋升准备' }));
    let panel = assertPage(source);
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('button', { name: '末日魔女与画廊附室' })).toBeTruthy();
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '末日魔女与画廊附室' }));
    await userEvent.click(screen.getByRole('button', { name: '查看魔女晋升准备' }));
    const trigger = within(assertPage(source)).getByRole('button', { name: learn.label });
    fireEvent.click(trigger); fireEvent.click(trigger);
    await waitFor(() => assertPage(guided)); panel = assertPage(guided);
    expect(guided.canAct).toBe(false); expect(guided.actionBlockedReason).toContain('魔女');
    expect(guided).toMatchObject({ cash: source.cash - 100, actionsRemaining: source.actionsRemaining - 1 });
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(within(panel).getByText('能力与掌握', { selector: 'summary' }));
    for (const ability of guided.demoness.abilities) {
      expect(ability.mastery).toBe(source.progression.mastery[ability.id]);
      expect(within(panel).getByRole('heading', { name: ability.label + ' · 熟练 ' + ability.mastery })).toBeTruthy();
    }
    expect(game.bridge.submitIntent).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: source.runId,
      expectedRevision: source.revision, payload: { type: 'DEMONESS', command: learn.command } });
    expect(game.commits).toBe(1);
  }, 30_000);

  it('cancels the actual CONSUME review, keeps old state on save failure, and retries once into the real S0 page', async () => {
    const { source, beforeConsume, success, consume } = saved(), action = enabledAction(beforeConsume, consume);
    const game = publicAdapter(beforeConsume, { command: consume, after: success, failOnce: true });
    const first = await mount(game);
    const preparedPanel = assertPage(beforeConsume);
    expect(action.cost).toContain(success.lastCheck!.chance + '%');
    expect(preparedPanel.textContent).toContain(success.lastCheck!.chance + '%');
    const trigger = within(preparedPanel).getByRole('button', { name: action.label });
    await userEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '魔女服药确认' });
    for (const text of [action.cost, '30灵性', '12精神', '死亡']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '魔女服药确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled(); assertPage(beforeConsume);
    await userEvent.click(trigger);
    dialog = screen.getByRole('dialog', { name: '魔女服药确认' });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    assertPage(beforeConsume);
    expect(game.current).toBe(beforeConsume); expect(game.commits).toBe(0);
    expect(disabled(trigger)).toBe(true);
    expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    fireEvent.click(trigger);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => assertPage(success));
    const panel = assertPage(success);
    expect(screen.queryByRole('dialog', { name: '魔女服药确认' })).toBeNull();
    expect(success.demoness.promoted).toBe(true);
    expect(success.canAct).toBe(false); expect(success.actionBlockedReason).toContain('魔女');
    expect(success.maxSpirituality).toBe(150);
    expect(success.spirituality).toBe(beforeConsume.spirituality - 30);
    expect(success.mind).toBe(beforeConsume.mind - 12);
    expect(success.spirituality).toBeLessThan(150);
    expect(panel.textContent).toContain('灵性 ' + success.spirituality + '/150');
    expect(within(panel).getByRole('region', { name: '最近行动结果' }).textContent).toContain('实际掷骰 1');
    expect(success.demoness.actions.some(item => item.command.type === 'CONSUME')).toBe(false);
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const retreat = enabledAction(success, { type: 'RETURN_ON_FOOT' });
    await waitFor(() => expect(disabled(within(panel).getByRole('button', { name: retreat.label }))).toBe(false));
    await userEvent.click(within(panel).getByText('能力与掌握', { selector: 'summary' }));
    expect(success.demoness.abilities).toHaveLength(Object.keys(source.progression.mastery).length + 2);
    for (const ability of success.demoness.abilities)
      expect(within(panel).getByRole('heading', { name: ability.label + ' · 熟练 ' + ability.mastery })).toBeTruthy();
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(success.progression.mastery[id]).toBe(mastery);
    for (const id of DEMONESS_ABILITY_IDS) expect(success.progression.mastery[id]).toBe(0);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(game.commits).toBe(1);
    first.unmount(); await mount(game);
    assertPage(success);
    expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
  }, 30_000);
});
