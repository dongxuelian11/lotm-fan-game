/* @vitest-environment jsdom */
/** Actual 198 / 287-command living source and paid bridge preparation. Only
 * the future S0 d100 at cursor 481 is controlled to 1. The public-only adapter
 * tests UI/retry transport, not SQLite durability or natural success. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection } from '../../src/domain/slice/types.js';
import { TWILIGHT_GIANT_ABILITY_IDS } from '../../src/domain/twilight-giant/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { TwilightGiantCommand, SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';
import {
  assertTwilightSourceUnmodified, twilightPublicLeaks, controlledTwilightRolls,
  preparedTwilightScenario, executeTwilight,
} from '../helpers/twilight-giant-scenario.js';

interface Views {
  source: SliceProjection; guided: SliceProjection;
  beforeConsume: SliceProjection; success: SliceProjection; consume: TwilightGiantCommand;
}
let views: Views | undefined;
function saved(): Views {
  if (!views) throw Error('The controlled Twilight route has not been constructed.');
  return views;
}
beforeAll(() => {
  const restore = controlledTwilightRolls({ 481: 1 });
  try {
    const route = preparedTwilightScenario(), session = route.session;
    const source = projectSliceState(route.source), guided = projectSliceState(route.guided);
    const beforeConsume = session.project();
    const consume = beforeConsume.twilightGiant.actions.find(action => action.enabled && action.command.type === 'CONSUME')!.command;
    executeTwilight(session, consume);
    const success = session.project();
    for (const view of [source, guided, beforeConsume, success]) expect(twilightPublicLeaks(view)).toEqual([]);
    expect(source).toMatchObject({ week: 175, health: 100, mind: 100, spirituality: 120, cash: 845, actionsRemaining: 2,
      progression: { pathwayId: 'warrior', sequence: 1 } });
    expect(success).toMatchObject({ maxSpirituality: 150, canAct: false,
      progression: { pathwayId: 'warrior', sequence: 0 }, lastCheck: { roll: 1, tier: 'GREAT_SUCCESS' } });
    expect(success.lastCheck).toMatchObject({ chance: 70, roll: 1 });
    const preparation = route.beforeConsume.twilightGiant.journal.at(-1)!;
    expect(preparation.command.type).toBe('STABILIZE_PROMOTION');
    for (const [key, cost] of [['cash', 150], ['actions', 1], ['spirituality', 12], ['mind', 8]] as const)
      expect(preparation.after.budget[key]).toBe(preparation.before.budget[key] - cost);
    // Keep only public projections between cases, never the multi-megabyte private route.
    views = { source, guided, beforeConsume, success, consume };
  } finally { restore(); }
}, 300_000);

interface Transition { command: TwilightGiantCommand; after: SliceProjection; failOnce?: boolean }
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
      expectedRevision: before.revision, payload: { type: 'TWILIGHT_GIANT', command: next.command } });
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
  if (game.current.twilightGiant.guidanceKnown) {
    await screen.findByRole('region', { name: game.current.twilightGiant.title });
  } else {
    const oldRound = screen.queryByRole('dialog', { name: '战斗回合结果' });
    if (oldRound) await userEvent.click(within(oldRound).getByRole('button', { name: '返回生活' }));
    await screen.findByRole('button', { name: '神明之手与修整室' });
  }
  return view;
}
function assertPage(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: value.twilightGiant.title }), r = value.twilightGiant.resources;
  expect(panel.textContent).toContain('健康 ' + r.health + '/' + r.maxHealth + ' · 精神 ' + r.mind + '/' + r.maxMind
    + ' · 灵性 ' + r.spirituality + '/' + r.maxSpirituality + ' · 现金 ' + r.cash
    + ' · 本周行动 ' + r.actionsRemaining + '/' + r.weeklyBudget);
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, cash: value.cash + '便士', actionsRemaining: value.actionsRemaining });
  expect(within(panel).getByRole('region', { name: '当前主目标' }).textContent).toContain(value.twilightGiant.nextStep);
  expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
    .toContain(value.character.name + ' · ' + value.twilightGiant.title);
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '神明之手成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|seed|cursor|原创|G\d+/);
  return panel;
}
function enabledAction(value: SliceProjection, command: TwilightGiantCommand) {
  const action = value.twilightGiant.actions.find(item => item.enabled && JSON.stringify(item.command) === JSON.stringify(command));
  if (!action) throw Error('The actual enabled Twilight action is missing.');
  return action;
}
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame;
  for (const dispose of disposers.splice(0)) dispose();
  vi.resetAllMocks(); vi.restoreAllMocks();
});
afterAll(() => { views = undefined; assertTwilightSourceUnmodified(); });

describe('Twilight220 real public SliceApp entry and controlled consumption', () => {
  it('opens from DivineHand with the original body/objects, then commits guidance and locks ordinary main actions', async () => {
    const { source, guided } = saved(), learn = enabledAction(source, { type: 'LEARN_GUIDANCE' });
    const game = publicAdapter(source, { command: learn.command, after: guided });
    await mount(game);
    await userEvent.click(screen.getByRole('button', { name: '神明之手与修整室' }));
    const divineHandPanel = await screen.findByRole('region', { name: '神明之手成长' });
    expect(within(divineHandPanel).getByRole('heading', { level: 2, name: source.divineHand.title })).toBeTruthy();
    expect(within(divineHandPanel).getByRole('region', { name: '神明之手当前资源' }).textContent)
      .toContain('健康100/100 · 精神100/100 · 灵性120/120');
    await userEvent.click(within(divineHandPanel).getByText('原修护室、原人和旧物当前记录', { selector: 'summary' }));
    const originals = within(divineHandPanel).getByRole('region', { name: '原修护室当前状态' });
    for (const text of ['精力29/100', '独立精力56/100', '独立精力58/100', '同一银甲当前完整度55', '原安全垫剩余0份', '原12千克负载剩余0次'])
      expect(originals.textContent).toContain(text);
    await userEvent.click(within(divineHandPanel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    for (const name of ['接触稳持 · 掌握0', '护甲合势 · 掌握0'])
      expect(within(divineHandPanel).getByRole('heading', { name })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '查看黄昏巨人晋升准备' }));
    let panel = assertPage(source);
    expect(panel.textContent).toContain('健康 100/100 · 精神 100/100 · 灵性 120/120 · 现金 845便士 · 本周行动 2/3');
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('当前没有伤势。');
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('button', { name: '神明之手与修整室' })).toBeTruthy();
    expect(game.bridge.submitIntent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '神明之手与修整室' }));
    await userEvent.click(screen.getByRole('button', { name: '查看黄昏巨人晋升准备' }));
    const trigger = within(assertPage(source)).getByRole('button', { name: learn.label });
    fireEvent.click(trigger); fireEvent.click(trigger);
    await waitFor(() => assertPage(guided));
    panel = assertPage(guided);
    expect(guided.canAct).toBe(false); expect(guided.actionBlockedReason).toContain('黄昏巨人');
    expect(guided).toMatchObject({ cash: source.cash - 100, actionsRemaining: source.actionsRemaining - 1 });
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(within(panel).getByRole('region', { name: '当前伤势' }).textContent).toContain('当前没有伤势。');
    expect(guided.twilightGiant.abilities).toHaveLength(22);
    for (const id of ['warrior.s1.beam-stabilize', 'warrior.s1.armor-convergence'])
      expect(guided.twilightGiant.abilities.find(ability => ability.id === id)?.mastery).toBe(0);
    expect(within(panel).getByRole('region', { name: '同一本人、原人物与旧物' }).textContent)
      .toContain('原银甲当前完整度55；旧垫片剩余0、旧负载剩余0');
    const preferred = guided.twilightGiant.actions.find(action => action.preferredAction && action.enabled)!;
    await waitFor(() => expect(disabled(within(panel).getByRole('button', { name: preferred.label }))).toBe(false));
    expect(game.bridge.submitIntent).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: source.runId,
      expectedRevision: source.revision, payload: { type: 'TWILIGHT_GIANT', command: learn.command } });
    expect(game.commits).toBe(1);
  }, 30_000);

  it('cancels the actual CONSUME review, keeps old state on save failure, and retries once into the real S0 page', async () => {
    const { source, beforeConsume, success, consume } = saved(), action = enabledAction(beforeConsume, consume);
    const game = publicAdapter(beforeConsume, { command: consume, after: success, failOnce: true });
    const first = await mount(game);
    const preparedPanel = assertPage(beforeConsume);
    expect(within(preparedPanel).getByRole('region', { name: '本瓶准备与实际风险' }).textContent)
      .toContain('本瓶当前实际成功率' + success.lastCheck!.chance + '%');
    expect(within(preparedPanel).getByRole('region', { name: '本瓶准备与实际风险' }).textContent)
      .toContain('可选准备实付150便士、1行动、12灵性和8精神');
    const trigger = within(preparedPanel).getByRole('button', { name: action.label });
    await userEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '黄昏巨人服药确认' });
    for (const text of [action.cost, '30灵性', '12精神', '已付费用不退还', '严重失败可能死亡', '载体仅有三件']) expect(dialog.textContent).toContain(text);
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '黄昏巨人服药确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(game.bridge.submitIntent).not.toHaveBeenCalled(); assertPage(beforeConsume);
    await userEvent.click(trigger);
    dialog = screen.getByRole('dialog', { name: '黄昏巨人服药确认' });
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
    expect(screen.queryByRole('dialog', { name: '黄昏巨人服药确认' })).toBeNull();
    expect(success.twilightGiant.promoted).toBe(true);
    expect(success.canAct).toBe(false); expect(success.actionBlockedReason).toContain('黄昏巨人');
    expect(success.maxSpirituality).toBe(150);
    expect(success.spirituality).toBe(beforeConsume.spirituality - 30);
    expect(success.mind).toBe(beforeConsume.mind - 12);
    expect(success.spirituality).toBeLessThan(150);
    expect(panel.textContent).toContain('灵性 ' + success.spirituality + '/150');
    expect(within(panel).getByRole('region', { name: '最近行动结果' }).textContent).toContain('实际掷骰 1');
    expect(success.twilightGiant.actions.some(item => item.command.type === 'CONSUME')).toBe(false);
    expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
    const retreat = enabledAction(success, { type: 'RETURN_ON_FOOT' });
    await waitFor(() => expect(disabled(within(panel).getByRole('button', { name: retreat.label }))).toBe(false));
    await userEvent.click(within(panel).getByText('能力与掌握', { selector: 'summary' }));
    expect(success.twilightGiant.abilities).toHaveLength(24);
    for (const ability of success.twilightGiant.abilities)
      expect(within(panel).getByRole('heading', { name: ability.label + ' · 熟练 ' + ability.mastery })).toBeTruthy();
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(success.progression.mastery[id]).toBe(mastery);
    for (const id of TWILIGHT_GIANT_ABILITY_IDS) expect(success.progression.mastery[id]).toBe(0);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
    expect(game.commits).toBe(1);
    first.unmount(); await mount(game);
    assertPage(success);
    expect(game.bridge.loadRun).toHaveBeenCalledTimes(2);
    expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
  }, 30_000);
});
