/* @vitest-environment jsdom */
/** Actual778 living source; only future controlled checks. Public-only UI transport. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection } from '../../src/domain/slice/types.js';
import { CHAINED_ABILITY_IDS } from '../../src/domain/chained/types.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { ChainedCommand, SliceBridge, SliceEnvelope, SliceReceipt } from '../../src/shared/slice-contracts.js';
import {
  assertChainedSourceUnmodified, chainedPublicLeaks, controlledChainedRolls,
  preparedChainedScenario, executeChained,
} from '../helpers/chained-scenario.js';

interface Views {
  source: SliceProjection; guided: SliceProjection;
  beforeConsume: SliceProjection; success: SliceProjection; consume: ChainedCommand;
}
let views: Views | undefined;
function saved(): Views {
  if (!views) throw Error('The controlled Chained route has not been constructed.');
  return views;
}
beforeAll(() => {
  const restore = controlledChainedRolls({});
  try {
    const route = preparedChainedScenario(), session = route.session;
    const source = projectSliceState(route.source), guided = projectSliceState(route.guided);
    const beforeConsume = session.project();
    const consume = beforeConsume.chained.actions.find(action => action.enabled && action.command.type === 'CONSUME')!.command;
    if (consume.type !== 'CONSUME') throw Error('The real prepared dose has no enabled consumption command.');
    executeChained(session, consume);
    const success = session.project();
    for (const view of [source, guided, beforeConsume, success]) expect(chainedPublicLeaks(view)).toEqual([]);
    expect(source).toMatchObject({ health:100, mind:48, spirituality:82, progression:{pathwayId:'chained',sequence:1} });
    expect(success).toMatchObject({maxSpirituality:150,canAct:false,progression:{pathwayId:'chained',sequence:0},lastCheck:{roll:1,chance:70}});
    // Keep only public projections between cases, never the multi-megabyte private route.
    views = { source, guided, beforeConsume, success, consume };
  } finally { restore(); }
}, 300_000);

interface Transition { command: ChainedCommand; after: SliceProjection; failOnce?: boolean }
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
      expectedRevision: before.revision, payload: { type: 'CHAINED', command: next.command } });
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
  if (game.current.chained.guidanceKnown) {
    await screen.findByRole('region', { name: game.current.chained.title });
  } else {
    const oldRound = screen.queryByRole('dialog', { name: '战斗回合结果' });
    if (oldRound) await userEvent.click(within(oldRound).getByRole('button', { name: '返回生活' }));
    await screen.findByRole('button', { name: '神孽与原安静室' });
  }
  return view;
}
function assertPage(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: value.chained.title }), r = value.chained.resources;
  expect(panel.textContent).toContain('健康 ' + r.health + '/' + r.maxHealth + ' · 精神 ' + r.mind + '/' + r.maxMind
    + ' · 灵性 ' + r.spirituality + '/' + r.maxSpirituality + ' · 现金 ' + r.cash
    + ' · 本周行动 ' + r.actionsRemaining + '/' + r.weeklyBudget);
  expect(r).toMatchObject({ health: value.health, mind: value.mind, spirituality: value.spirituality,
    maxSpirituality: value.maxSpirituality, cash: value.cash + '便士', actionsRemaining: value.actionsRemaining });
  expect(within(panel).getByRole('region', { name: '本章目标' }).textContent).toContain(value.chained.nextStep);
  expect(screen.getByRole('button', { name: '返回主菜单' }).closest('header')?.textContent)
    .toContain(value.character.name + ' · ' + value.chained.title);
  expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
  expect(screen.queryByRole('region', { name: '神孽成长' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.textContent).not.toMatch(/sourceDigest|randomCursor|seed|cursor|原创|G\d+/);
  return panel;
}
function enabledAction(value: SliceProjection, command: ChainedCommand) {
  const action = value.chained.actions.find(item => item.enabled && JSON.stringify(item.command) === JSON.stringify(command));
  if (!action) throw Error('The actual enabled Chained action is missing.');
  return action;
}
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => {
  cleanup(); delete window.sliceGame;
  for (const dispose of disposers.splice(0)) dispose();
  vi.resetAllMocks(); vi.restoreAllMocks();
});
afterAll(() => { views = undefined; assertChainedSourceUnmodified(); });

describe('Chained225 actual public entry and controlled promotion',()=>{
 it('opens the real original warehouse entry and commits guidance without enabling stale ordinary actions',async()=>{
  const {source,guided}=saved(),learn=enabledAction(source,{type:'LEARN_GUIDANCE'});
  const game=publicAdapter(source,{command:learn.command,after:guided});await mount(game);
  await userEvent.click(screen.getByRole('button',{name:'神孽与原安静室'}));
  await userEvent.click(screen.getByRole('button',{name:'查看被缚者晋升准备'}));
  const panel=assertPage(source);expect(panel.textContent).toContain('现金 '+source.cash+'便士');
  expect(game.bridge.submitIntent).not.toHaveBeenCalled();
  fireEvent.click(within(panel).getByRole('button',{name:learn.label}));
  await waitFor(()=>assertPage(guided));
  expect(guided.canAct).toBe(false);expect(guided.actionBlockedReason).toContain('被缚者');
  expect(guided.cash).toBe(source.cash-100);expect(guided.actionsRemaining).toBe(source.actionsRemaining-1);
  expect(guided.chained.actions.some(a=>a.enabled)).toBe(true);expect(game.commits).toBe(1);
 },30_000);
 it('reviews the actual dose, keeps failed-save state and retries one identical intent into immediately visible S0',async()=>{
  const {source,beforeConsume,success,consume}=saved(),action=enabledAction(beforeConsume,consume);
  const game=publicAdapter(beforeConsume,{command:consume,after:success,failOnce:true});const first=await mount(game);
  const trigger=within(assertPage(beforeConsume)).getByRole('button',{name:action.label});
  await userEvent.click(trigger);let dialog=screen.getByRole('dialog',{name:'被缚者服药确认'});
  expect(dialog.textContent).toContain(action.cost);
  await userEvent.click(within(dialog).getByRole('button',{name:'取消，继续准备'}));
  expect(game.bridge.submitIntent).not.toHaveBeenCalled();expect(document.activeElement).toBe(trigger);
  await userEvent.click(trigger);dialog=screen.getByRole('dialog',{name:'被缚者服药确认'});
  fireEvent.click(within(dialog).getByRole('button',{name:'确认服用这一份魔药'}));
  const retry=await screen.findByRole('button',{name:'重试这次操作'});assertPage(beforeConsume);
  expect(game.commits).toBe(0);expect(disabled(trigger)).toBe(true);fireEvent.click(retry);
  await waitFor(()=>assertPage(success));expect(screen.queryByRole('dialog',{name:'被缚者服药确认'})).toBeNull();
  expect(success.chained.promoted).toBe(true);expect(success.maxSpirituality).toBe(150);
  expect(success.spirituality).toBe(beforeConsume.spirituality-30);expect(success.mind).toBe(beforeConsume.mind-12);
  for(const [id,value]of Object.entries(source.progression.mastery))expect(success.progression.mastery[id]).toBe(value);
  for(const id of CHAINED_ABILITY_IDS)expect(success.progression.mastery[id]).toBe(0);
  expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);expect(game.bridge.submitIntent.mock.calls[1]![0]).toEqual(game.bridge.submitIntent.mock.calls[0]![0]);
  expect(game.commits).toBe(1);first.unmount();await mount(game);assertPage(success);expect(game.bridge.submitIntent).toHaveBeenCalledTimes(2);
 },30_000);
});
