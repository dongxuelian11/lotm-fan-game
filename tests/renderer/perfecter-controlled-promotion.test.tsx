/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { PERFECTER_ABILITY_IDS } from '../../src/domain/perfecter/types.js';
import {
  authenticPerfecterBeforeConsume, assertControlledPerfecterPromotion, assertUnmodifiedPerfecterCapture,
  CONTROLLED_CONSUME, controlledHash, installControlledPerfecterPromotion,
} from '../helpers/perfecter-controlled-success.js';

// Real SliceApp, public projection and reducer, with a controlled bridge delivery.
// Only first-new RNG draw 346 is explicitly replaced with 1 by the scoped helper.
// This is independent controlled UI coverage, NOT natural play or SQLite proof.
const PANEL = '序列0 完美者';
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const releases = new Set<() => void>();
function savedGame(before: SliceState) {
  let state = before, commits = 0, failNext = false, barrier: Promise<void> | null = null;
  const attemptedHashes: string[] = [];
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    expect(envelope).toMatchObject({ runId: state.runId, expectedRevision: state.revision, payload: CONTROLLED_CONSUME });
    if (envelope.payload.type !== 'PERFECTER') throw new Error('Controlled promotion bridge only accepts the exact Perfecter intent');
    const candidate = applySliceIntent(state, envelope.payload);
    assertValidSliceState(candidate);
    attemptedHashes.push(controlledHash(candidate));
    const wait = barrier; barrier = null;
    if (wait) await wait;
    if (failNext) {
      failNext = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    state = candidate; commits++;
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-17T14:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit, attemptedHashes,
    failNextSave() { failNext = true; },
    holdNextSave() {
      let finish = () => {};
      barrier = new Promise<void>(resolve => { finish = resolve; });
      const release = () => { releases.delete(release); finish(); };
      releases.add(release); return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const value = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
        portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
        revision: value.revision, updatedAt: '2026-10-17T14:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  await screen.findByRole('region', { name: PANEL });
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
  return view;
}
function assertCurrentPage(state: SliceState) {
  const value = projectSliceState(state).perfecter, panel = screen.getByRole('region', { name: PANEL });
  expect(panel.textContent).toContain(value.story);
  expect(panel.textContent).toContain(value.nextStep);
  const { health, mind, spirituality, cash, actionsRemaining } = value.resources;
  expect(panel.textContent).toContain(`健康 ${health} · 精神 ${mind} · 灵性 ${spirituality} · ${cash} · 本周行动 ${actionsRemaining}`);
  const banner = screen.getAllByRole('banner').find(item => within(item).queryByRole('button', { name: '返回主菜单' }))!;
  expect(banner.textContent).toContain(`${state.character.name} · ${value.title}`);
  expect(screen.queryByRole('region', { name: '文明启蒙者成长' })).toBeNull();
  expect(screen.queryByRole('region', { name: '知识导师' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('region', { name: '有限复起待决选择' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/savant-rebuild-first|preparedRoll|futureRoll|randomCursor|cursorBefore|cursorAfter|sourceDigest|historyDigest/);
  return panel;
}
function consumeTrigger(state: SliceState) {
  const action = projectSliceState(state).perfecter.actions.find(item => item.command.type === 'CONSUME')!;
  expect(action).toMatchObject({ enabled: true, command: CONTROLLED_CONSUME.command });
  const button = within(screen.getByRole('region', { name: '晋升与服药' })).getByRole('button', { name: action.label });
  expect(disabled(button)).toBe(false);
  expect((button.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent)).toContain(action.cost);
  return button;
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(async () => {
  await act(async () => { for (const release of releases) release(); });
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Perfecter real promotion UI with one explicitly controlled success draw', () => {
  it('shows actual prepared risk and costs, and cancels both ways without an intent or RNG draw', async () => {
    const before = authenticPerfecterBeforeConsume(), beforeHash = controlledHash(before);
    const seam = installControlledPerfecterPromotion(), game = savedGame(before);
    await mount(game); assertCurrentPage(before);
    const trigger = consumeTrigger(before);
    fireEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '完美者服药确认' });
    expect(dialog.textContent).toContain('70%');
    expect(dialog.textContent).toContain('1行动、30灵性');
    expect(dialog.textContent).toContain('可能死亡');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '完美者服药确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    dialog = screen.getByRole('dialog', { name: '完美者服药确认' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '完美者服药确认' })).toBeNull();
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    expect(seam.substituted).toEqual([]); expect(controlledHash(game.state)).toBe(beforeHash);
    assertCurrentPage(before); assertUnmodifiedPerfecterCapture();
  }, 60_000);

  it('retries the same confirmed intent after save failure, charges once, immediately shows real S0 and reopens the exact state', async () => {
    const before = authenticPerfecterBeforeConsume(), beforeHash = controlledHash(before);
    const seam = installControlledPerfecterPromotion(), game = savedGame(before); game.failNextSave();
    const view = await mount(game), panel = assertCurrentPage(before), beforeText = panel.textContent;
    fireEvent.click(consumeTrigger(before));
    const confirm = screen.getByRole('button', { name: '确认服用这一份原魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.commits).toBe(0);
    expect(controlledHash(game.state)).toBe(beforeHash);
    expect(panel.textContent).toBe(beforeText);
    expect(screen.queryByRole('dialog', { name: '完美者服药确认' })).toBeNull();
    for (const button of within(panel).getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    const envelope = structuredClone(game.submit.mock.calls[0]![0]);
    expect(envelope).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: 919, payload: CONTROLLED_CONSUME });
    const release = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry);
    expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope);
    expect(game.commits).toBe(0); expect(controlledHash(game.state)).toBe(beforeHash);
    await act(async () => { release(); });
    await waitFor(() => expect(game.commits).toBe(1));
    const after = game.state, afterHash = controlledHash(after);
    assertControlledPerfecterPromotion(before, after);
    expect(game.attemptedHashes).toEqual([afterHash, afterHash]);
    expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull();
    expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: '完美者服药确认' })).toBeNull();
    const current = assertCurrentPage(after);
    expect(current.textContent).toContain('实际掷骰 1');
    expect(current.textContent).toContain('大成功');
    await userEvent.click(within(current).getByText('已掌握的能力', { selector: 'summary' }));
    const abilities = projectSliceState(after).perfecter.abilities;
    expect(abilities).toHaveLength(23);
    for (const ability of abilities) expect(within(current).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    expect(abilities.filter(ability => PERFECTER_ABILITY_IDS.some(id => id === ability.id)).map(ability => ability.mastery)).toEqual([0, 0]);
    view.unmount(); await mount(game); assertCurrentPage(after);
    expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
    expect(controlledHash(game.state)).toBe(afterHash); expect(controlledHash(before)).toBe(beforeHash);
    expect(seam.substituted.length).toBeGreaterThan(0);
    expect(seam.substituted.every(draw => draw.cursorBefore === 346 && draw.actual === 81 && draw.controlled === 1)).toBe(true);
    assertUnmodifiedPerfecterCapture();
  }, 60_000);
});
