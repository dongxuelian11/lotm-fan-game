/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectSliceState } from '../../src/domain/slice/index.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { assertGlobalPublic, CURRENT_SUPPORTED_PROMOTION_CHECK, expectedCurrentGlobal, filePin, hash, historicalTyrantState, historicalTyrantPublic,
  json, migrateCapturedTyrantState, RAW_SUPPORTED_PROMOTION_CHECK, ROOT, type Action } from '../helpers/tyrant-capture.js';

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true,
    value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true,
    value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('actual717 promotion check in the reachable weekly dashboard', () => {
  it('returns from the Thunder God page and displays70, effective40, +13 and the original roll36', async () => {
    const capturePin = { bytes: 816812, sha256: '9e0d99dd618d2df3812dbf42e939e8159a1114b67f199bc03e95fccc279bd69b' };
    expect(filePin(`${ROOT}/action-717.json.gz`)).toEqual(capturePin);
    const action = json<Action>('action-717.json.gz'), state = migrateCapturedTyrantState(action.final), before = hash(state);
    const value = projectSliceState(state);
    expect(historicalTyrantPublic(value, state)).toEqual(expectedCurrentGlobal(action, 'after'));
    expect(value.lastCheck).toEqual(CURRENT_SUPPORTED_PROMOTION_CHECK);
    expect(value.thunderGod.insideCase).toBe(false);
    assertGlobalPublic(value, state);
    // Only current public projections cross the bridge. No intent is executed:
    // the immutable natural capture supplies the already-committed action717.
    const submitIntent = vi.fn<SliceBridge['submitIntent']>(async () => { throw Error('Read-only navigation must not submit an intent.'); });
    const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: structuredClone(value) }));
    window.sliceGame = {
      getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
        mode: 'desktop', activeState: structuredClone(value), runs: [{ runId: value.runId, name: value.character.name,
          portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
          revision: value.revision, updatedAt: '2026-10-18T03:49:00Z' }],
      } })), loadRun, submitIntent,
    };
    render(<SliceApp />);
    await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
    await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
    await userEvent.click(await screen.findByRole('button', { name: '雷神与原湾' }));
    const panel = await screen.findByRole('region', { name: '雷神成长' });
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    expect(screen.queryByRole('region', { name: '雷神成长' })).toBeNull();
    const summary = screen.getByText('查看本次检定与来源', { selector: 'summary' });
    await userEvent.click(summary);
    const details = summary.closest('details')!;
    expect(details.open).toBe(true);
    expect(within(details).getByRole('heading', { name: '成功 · 意志检定' })).toBeTruthy();
    expect(details.textContent).toContain('基础 27，有效能力 40，难度 30。成功率 70%，d100 掷骰 36。');
    expect(details.textContent).toContain('同瓶同场当周有价支持 +13');
    expect(details.textContent).not.toContain('成功率 44%');
    expect(submitIntent).not.toHaveBeenCalled(); expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
    expect(state.lastCheck).toEqual(RAW_SUPPORTED_PROMOTION_CHECK);
    expect(hash(state)).toBe(before); expect(hash(action.final)).toBe(hash(historicalTyrantState(state)));
    expect(filePin(`${ROOT}/action-717.json.gz`)).toEqual(capturePin);
  }, 120_000);
});
