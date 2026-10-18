/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SliceProjection } from '../../src/domain/slice/types.js';
import { openDeathRuntimeSession } from '../../src/domain/death/owned-session.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { DeathCommand, DeathProjection, SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';
import {
  assertDeathPublicBoundary, controlledDeathSuccess, DEATH_CONTROLLED_CURSOR,
  installControlledDeathPromotion, projectSliceState,
} from '../helpers/death-scenario.js';

type Action = DeathProjection['actions'][number];
interface Views {
  source: SliceProjection;
  guided: SliceProjection;
  beforeConsume: SliceProjection;
  success: SliceProjection;
  walked: SliceProjection;
  returned: SliceProjection;
  travel: DeathCommand;
}
let views: Views | undefined;
function saved(): Views {
  if (!views) throw new Error('The controlled real campaign has not been constructed.');
  return views;
}
function actionFor(view: SliceProjection, type: DeathCommand['type']): Action {
  const action = view.death.actions.find(item => item.command.type === type && item.enabled);
  if (!action) throw new Error(`Missing actual enabled Death command: ${type}`);
  return action;
}
function resources(view: SliceProjection) {
  return { health: view.health, mind: view.mind, spirituality: view.spirituality,
    maxSpirituality: view.maxSpirituality, cash: view.cash, actionsRemaining: view.actionsRemaining,
    weeklyBudget: view.weeklyBudget, injuries: view.injuries, injuryRisk: view.injuryRisk };
}

// Construct the authentic 195 source and the real paid chapter route once.
// Only the new promotion draw at cursor 490 is controlled to roll 1. This is
// directed success, NOT a natural continuation. No resource/history edits or
// replacement public projections are used. Only public views survive setup.
beforeAll(() => {
  const control = installControlledDeathPromotion(1);
  try {
    const scenario = controlledDeathSuccess(control);
    const source = projectSliceState(scenario.source);
    const guided = projectSliceState(scenario.guided);
    const beforeConsume = projectSliceState(scenario.beforeConsume);
    const success = projectSliceState(scenario.success);
    for (const [view, state] of [[source, scenario.source], [guided, scenario.guided],
      [beforeConsume, scenario.beforeConsume], [success, scenario.success]] as const) {
      assertDeathPublicBoundary(view, state);
    }
    expect(DEATH_CONTROLLED_CURSOR).toBe(490);
    expect(control.substituted.every(draw => draw.cursorBefore === 490 && draw.cursorAfter === 491 && draw.controlled === 1)).toBe(true);
    expect(success.lastCheck).toMatchObject({ chance: 70, roll: 1, tier: 'GREAT_SUCCESS' });
    expect(source.progression.sequence).toBe(1);
    expect(source.death.abilities).toHaveLength(19);
    expect(source.death.abilities.filter(ability => ability.mastery === 0)).toHaveLength(7);
    for (const ability of source.death.abilities) {
      expect(ability.mastery).toBe(scenario.source.progression.mastery[ability.id]);
    }
    expect(success.progression.sequence).toBe(0);
    expect(success.maxSpirituality).toBe(150);
    expect(success.spirituality).toBe(beforeConsume.spirituality - 30);
    expect(success.spirituality).toBeLessThan(150);

    // Two genuine zero-resource movements; their committed revisions and
    // location/time records still change and must release the UI submit latch.
    const walking = openDeathRuntimeSession(scenario.guided);
    const travel = actionFor(guided, 'TRAVEL').command;
    let draft = walking.prepare({ type: 'DEATH', command: travel }, walking.inspect().revision);
    walking.commit(draft);
    const walked = walking.project();
    const back = actionFor(walked, 'RETURN_ON_FOOT').command;
    draft = walking.prepare({ type: 'DEATH', command: back }, walking.inspect().revision);
    walking.commit(draft);
    const returned = walking.project();
    expect(resources(walked)).toEqual(resources(guided));
    expect(resources(returned)).toEqual(resources(guided));
    expect([walked.revision, returned.revision]).toEqual([guided.revision + 1, guided.revision + 2]);
    views = { source, guided, beforeConsume, success, walked, returned, travel };
  } finally {
    control.restore();
  }
}, 300_000);

interface Transition {
  command: DeathCommand;
  after: SliceProjection;
  firstResponse?: 'save-failed' | 'response-lost';
}
const adapters = new Set<ReturnType<typeof publicAdapter>>();

// The adapter transports only actual, precomputed public states. It models
// bridge receipts and retry identity; it is not SQLite persistence evidence.
function publicAdapter(initial: SliceProjection, supplied: Transition[] = []) {
  let current: SliceProjection | null = structuredClone(initial);
  let transitions = [...supplied], step = 0, commits = 0;
  let pendingEnvelope: SliceEnvelope | null = null;
  const failed = new Set<number>(), receipts = new Map<string, SliceReceipt>();
  function head() {
    if (!current) throw new Error('The public bridge has been disposed.');
    return current;
  }
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => {
    const state = head();
    return { ok: true, value: { mode: 'desktop', activeState: structuredClone(state), runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision,
      updatedAt: '2026-10-18T08:00:00Z',
    }] } };
  });
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(head().runId);
    return { ok: true, value: structuredClone(head()) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (pendingEnvelope) expect(envelope).toEqual(pendingEnvelope);
    const replay = receipts.get(envelope.intentId);
    if (replay) {
      pendingEnvelope = null;
      return { ok: true, value: { ...structuredClone(replay), replayed: true } };
    }
    const transition = transitions[step], before = head();
    if (!transition) throw new Error('No actual saved transition was supplied for this command.');
    expect(envelope).toEqual({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: { type: 'DEATH', command: transition.command } });
    const firstFailure = !!transition.firstResponse && !failed.has(step);
    if (firstFailure) { failed.add(step); pendingEnvelope = structuredClone(envelope); }
    if (firstFailure && transition.firstResponse === 'save-failed') {
      return { ok: false, error: { code: 'SAVE_FAILED', message: '保存失败', retryable: true } };
    }
    expect(transition.after.revision).toBe(before.revision + 1);
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: before.runId,
      previousRevision: before.revision, newRevision: transition.after.revision,
      committedAt: '2026-10-18T08:01:00Z', replayed: false, state: structuredClone(transition.after) };
    current = structuredClone(transition.after); receipts.set(envelope.intentId, receipt); commits++; step++;
    if (firstFailure && transition.firstResponse === 'response-lost') {
      return { ok: false, error: { code: 'RESPONSE_LOST', message: '保存回执未收到', retryable: true } };
    }
    pendingEnvelope = null;
    return { ok: true, value: structuredClone(receipt) };
  });
  const adapter = {
    bridge: { getBootstrap, loadRun, submitIntent },
    get current() { return head(); }, get commits() { return commits; },
    dispose() {
      getBootstrap.mockReset(); loadRun.mockReset(); submitIntent.mockReset();
      receipts.clear(); failed.clear(); transitions = []; pendingEnvelope = null; current = null;
    },
  };
  adapters.add(adapter);
  return adapter;
}

async function mount(game: ReturnType<typeof publicAdapter>) {
  window.sliceGame = game.bridge;
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(game.current.character.name) }));
  await waitFor(() => expect(game.bridge.loadRun).toHaveBeenLastCalledWith(game.current.runId));
  if (!game.current.death.guidanceKnown) {
    // This is the real post-cycle reception, not an invented ordinary dashboard.
    // Its historical battle acknowledgement, if shown, is readonly navigation.
    const oldRound = screen.queryByRole('dialog', { name: '战斗回合结果' });
    if (oldRound) await userEvent.click(within(oldRound).getByRole('button', { name: '返回生活' }));
    await screen.findByRole('button', { name: '苍白皇帝与当代附廊' });
  } else {
    await screen.findByRole('region', { name: game.current.death.title });
  }
  return view;
}

function assertPage(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: value.death.title });
  const r = value.death.resources;
  expect(panel.textContent).toContain(`健康 ${r.health}/${r.maxHealth} · 精神 ${r.mind}/${r.maxMind} · 灵性 ${r.spirituality}/${r.maxSpirituality} · 现金 ${r.cash} · 本周行动 ${r.actionsRemaining}/${r.weeklyBudget}`);
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, actionsRemaining: value.actionsRemaining });
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.death.nextStep);
  const clock = value.death.sections.find(section => section.id === 'clock');
  if (clock) expect(within(panel).getByRole('region', { name: clock.title }).textContent).toContain(clock.lines[0]);
  const topbar = screen.getByRole('button', { name: '返回主菜单' }).closest('header');
  expect(topbar?.textContent).toContain(`${value.character.name} · ${value.death.title}`);
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '苍白皇帝成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.textContent).not.toMatch(/原创|G\d+|randomCursor|sourceDigest|seed|cursor/);
  return panel;
}

async function commandButton(view: SliceProjection, command: DeathCommand) {
  const action = view.death.actions.find(item => JSON.stringify(item.command) === JSON.stringify(command));
  if (!action) throw new Error('The actual command is absent from its public projection.');
  let button = within(assertPage(view)).queryByRole('button', { name: action.label });
  if (!button) {
    await userEvent.click(within(assertPage(view)).getByText('其他可选行动', { selector: 'summary' }));
    button = within(assertPage(view)).getByRole('button', { name: action.label });
  }
  return button;
}

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame;
  for (const adapter of adapters) adapter.dispose();
  adapters.clear(); vi.resetAllMocks(); vi.restoreAllMocks();
});
afterAll(() => { views = undefined; });

describe('Death SliceApp navigation from the authentic source and controlled real success', () => {
  it('opens Death preparation from the actual S1 growth page and reception without spending', async () => {
    const { source } = saved(), game = publicAdapter(source);
    await mount(game);
    expect(source.progression).toMatchObject({ pathwayId: 'death', sequence: 1, acting: 100 });
    await userEvent.click(screen.getByRole('button', { name: '苍白皇帝与当代附廊' }));
    expect(await screen.findByRole('region', { name: '苍白皇帝成长' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '查看死神晋升准备' }));
    let panel = assertPage(source);
    expect((within(panel).getByRole('button', { name: actionFor(source, 'LEARN_GUIDANCE').label }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('button', { name: '苍白皇帝与当代附廊' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '查看死神晋升准备' }));
    panel = assertPage(source);
    expect(panel.textContent).toContain('健康 50/100');
    expect(game.current.revision).toBe(source.revision);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
  });

  it('commits guidance into the chapter while ordinary canAct remains blocked, then reopens there', async () => {
    const { source, guided } = saved();
    const learn = actionFor(source, 'LEARN_GUIDANCE');
    const game = publicAdapter(source, [{ command: learn.command, after: guided }]);
    const first = await mount(game);
    await userEvent.click(screen.getByRole('button', { name: '查看死神晋升准备' }));
    const button = within(assertPage(source)).getByRole('button', { name: learn.label });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(within(assertPage(guided)).queryByRole('button', { name: learn.label })).toBeNull());
    expect(guided.canAct).toBe(false);
    expect(guided.actionBlockedReason).toContain('死神');
    const preferred = guided.death.actions.find(action => action.preferredAction && action.enabled)!;
    expect(preferred).toBeDefined();
    await waitFor(() => expect((within(assertPage(guided)).getByRole('button', { name: preferred.label }) as HTMLButtonElement).disabled).toBe(false));
    expect(within(assertPage(guided)).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(game.bridge.submitIntent).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: source.runId,
      expectedRevision: source.revision, payload: { type: 'DEATH', command: learn.command } });
    first.unmount(); await mount(game); assertPage(guided);
    expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
  });

  it('cancels a real prepared bottle review without changing saved resources or sending an intent', async () => {
    const { beforeConsume } = saved(), game = publicAdapter(beforeConsume);
    await mount(game);
    const consume = actionFor(beforeConsume, 'CONSUME');
    const trigger = within(assertPage(beforeConsume)).getByRole('button', { name: consume.label });
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '死神服药确认' });
    for (const text of ['70%', '30灵性', '已付费用不退还', '严重失败可能死亡']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '死神服药确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    assertPage(beforeConsume);
    expect(game.current.revision).toBe(beforeConsume.revision);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
  });

  it.each(['success', 'save-failed', 'response-lost'] as const)(
    'shows the real S0 current/150 immediately and on reopen after %s, retrying the identical intent if needed',
    async response => {
      const { source, beforeConsume, success } = saved();
      const consume = actionFor(beforeConsume, 'CONSUME');
      const game = publicAdapter(beforeConsume, [{ command: consume.command, after: success,
        ...(response === 'success' ? {} : { firstResponse: response }) }]);
      const first = await mount(game);
      await userEvent.click(within(assertPage(beforeConsume)).getByRole('button', { name: consume.label }));
      const confirm = within(screen.getByRole('dialog', { name: '死神服药确认' }))
        .getByRole('button', { name: '确认服用这一份魔药' });
      fireEvent.click(confirm); fireEvent.click(confirm);
      if (response !== 'success') {
        const retry = await screen.findByRole('button', { name: '重试这次操作' });
        const panel = assertPage(beforeConsume);
        expect(panel.textContent).toContain(`灵性 ${beforeConsume.spirituality}/120`);
        expect((within(panel).getByRole('button', { name: consume.label }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
        expect(game.bridge.submitIntent).toHaveBeenCalledTimes(1);
        fireEvent.click(retry); fireEvent.click(retry);
      }
      await waitFor(() => assertPage(success));
      const panel = assertPage(success);
      expect(screen.queryByRole('dialog', { name: '死神服药确认' })).toBeNull();
      expect(within(panel).queryByRole('button', { name: consume.label })).toBeNull();
      expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
      expect(success.death.promoted).toBe(true);
      expect(success.maxSpirituality).toBe(150);
      expect(success.spirituality).toBe(beforeConsume.spirituality - 30);
      expect(success.spirituality).toBeLessThan(success.maxSpirituality);
      expect(within(panel).getByRole('region', { name: '最近行动结果' }).textContent).toContain('实际掷骰 1');
      await userEvent.click(within(panel).getByText('能力与掌握', { selector: 'summary' }));
      for (const ability of success.death.abilities) {
        expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
      }
      expect(success.death.abilities).toHaveLength(21);
      for (const ability of source.death.abilities) {
        expect(success.progression.mastery[ability.id]).toBe(ability.mastery);
      }
      for (const id of ['death.s0.partial-spirit-passage', 'death.s0.residual-propagation-barrier']) {
        expect(success.progression.mastery[id]).toBe(0);
      }
      const calls = game.bridge.submitIntent.mock.calls;
      expect(calls).toHaveLength(response === 'success' ? 1 : 2);
      if (response !== 'success') expect(calls[1]![0]).toEqual(calls[0]![0]);
      expect(game.commits).toBe(1);
      expect(game.current.revision).toBe(success.revision);
      const text = panel.textContent;
      first.unmount(); await mount(game);
      expect(assertPage(success).textContent).toBe(text);
      expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
      expect(game.bridge.submitIntent).toHaveBeenCalledTimes(response === 'success' ? 1 : 2);
    },
  );

  it('releases both zero-resource movement submissions on their real committed revisions', async () => {
    const { guided, walked, returned, travel } = saved();
    const back = actionFor(walked, 'RETURN_ON_FOOT').command;
    const game = publicAdapter(guided, [{ command: travel, after: walked }, { command: back, after: returned }]);
    await mount(game);
    const outward = await commandButton(guided, travel);
    expect((outward as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(outward); fireEvent.click(outward);
    await waitFor(() => assertPage(walked));
    const homeward = await commandButton(walked, back);
    await waitFor(() => expect((homeward as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(homeward); fireEvent.click(homeward);
    await waitFor(() => assertPage(returned));
    const unlocked = await commandButton(returned, travel);
    await waitFor(() => expect((unlocked as HTMLButtonElement).disabled).toBe(false));
    expect(resources(returned)).toEqual(resources(guided));
    expect(game.bridge.submitIntent.mock.calls.map(([envelope]) => envelope.expectedRevision))
      .toEqual([guided.revision, walked.revision]);
    expect(game.commits).toBe(2);
    expect(game.current.revision).toBe(returned.revision);
  });
});
