/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import type { SliceBridge, SliceRunSummary } from '../../src/shared/slice-contracts.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// Actual completed 2083-command campaign, not an S1 save patched into S0.
// One production strict projection supplies every displayed fact. No output/
// benchmark file, fabricated public view, new action, replay or SQLite dependency.
const SOURCE = 'tests/fixtures/fool-v02080/natural.json';
const FINAL_SHA256 = '66b91d08d03b564d4e19d8acb8bcd47ead3233da1ba39561bc3d8945ca998d8a';
// Reviewed current public hash: only the historical S1 private source and random
// cursors were removed. Original capture/private hashes remain unchanged.
const PUBLIC_SHA256 = '0e0d77363984f154ac14fc8e5260d9bda59119a582aaf8bcd7549b727f34f5b3';
const PANEL = '愚者 · 当前现场';
const hash = (value: unknown): string => sha256Hex(stableStringify(value));

// The bridge owns only a detached PUBLIC value. It never captures the 9 MB
// private campaign or a game/session closure. Separate implementations and an
// explicit disposer release even public mock results after unmount/failure.
function readOnlyBridge(value: SliceProjection) {
  let saved: SliceProjection | null = structuredClone(value);
  const current = (): SliceProjection => {
    if (!saved) throw new Error('The read-only bridge has been disposed.');
    return saved;
  };
  const run: SliceRunSummary = { runId: value.runId, name: value.character.name, portraitId: value.character.portraitId,
    week: value.week, date: { ...value.date }, status: value.status, revision: value.revision, updatedAt: '2026-10-16T21:53:11Z' };
  const getBootstrap = vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: structuredClone(current()), runs: [structuredClone(run)],
  } }));
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async runId => {
    expect(runId).toBe(run.runId);
    return { ok: true, value: structuredClone(current()) };
  });
  const submitIntent = vi.fn<SliceBridge['submitIntent']>().mockResolvedValue({ ok: false,
    error: { code: 'UNEXPECTED_READ_ONLY_INTENT', message: '只读重开不应产生行动。', retryable: false } });
  return { bridge: { getBootstrap, loadRun, submitIntent } satisfies SliceBridge,
    publicHash: () => hash(current()),
    dispose() { saved = null; getBootstrap.mockReset(); loadRun.mockReset(); submitIntent.mockReset(); } };
}

async function continueOriginal(name: string) {
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: label => label.includes(name) }));
  return screen.findByRole('region', { name: PANEL });
}

async function assertCurrentScene(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: PANEL });
  expect(within(panel).getByRole('heading', { name: PANEL })).toBeTruthy();
  expect(panel.textContent).toContain('健康 65 · 精神 96 · 灵性 92 · 71便士 · 本周行动 2');
  expect(panel.textContent).toContain('本次救人与撤离已留下实际结果，可继续接待处生活。');
  expect(panel.textContent).toContain(value.fool.story);
  expect(panel.textContent).toContain(value.fool.risk);
  // jsdom exposes both the game HUD and this panel's own header as banners.
  // Account for both explicitly, so an extra/stale game's HUD cannot be hidden
  // by simply selecting the first banner or matching text anywhere on the page.
  const banners = screen.getAllByRole('banner');
  const huds = banners.filter(candidate => candidate.classList.contains('slice-topbar'));
  expect(huds).toHaveLength(1);
  const banner = huds[0]!;
  expect(banners.filter(candidate => candidate !== banner)).toEqual([within(panel).getByRole('banner')]);
  expect(within(banner).getByRole('button', { name: '返回主菜单' })).toBe(screen.getByRole('button', { name: '返回主菜单' }));
  expect(within(banner).getByText(`${value.character.name} · ${PANEL}`, { selector: 'strong', exact: true })).toBeTruthy();
  expect(within(banner).getByText('第五纪 1656年3月27日 · 第 16006 周', { selector: 'span', exact: true })).toBeTruthy();

  // The original final still retains an old S1 round and revival allowance.
  // Loading S0 must not route the player back into those historical screens.
  for (const name of ['愚者晋升准备', '诡秘侍者成长', '奇迹师', '古代学者', '有限复起待决选择']) {
    expect(screen.queryByRole('region', { name })).toBeNull();
  }
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.queryByRole('button', { name: '查看愚者晋升准备' })).toBeNull();
  expect(screen.queryByRole('button', { name: '返回当前生活' })).toBeNull();
  expect(screen.queryByRole('button', { name: '核对成神条件与原遗产' })).toBeNull();

  const abilities = within(panel).getByText('已掌握的能力', { selector: 'summary' });
  const details = abilities.closest('details'); expect(details).not.toBeNull();
  if (!details!.open) await userEvent.click(abilities);
  expect(details!.open).toBe(true);
  expect(within(panel).getByRole('heading', { name: '片刻盲愚 · 熟练 0' })).toBeTruthy();
  expect(within(panel).getByRole('heading', { name: '前刻留影 · 熟练 0' })).toBeTruthy();
  for (const ability of value.fool.abilities) {
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  }
  for (const section of value.fool.sections) {
    const region = within(panel).getByRole('region', { name: section.title });
    for (const line of section.lines) expect(region.textContent).toContain(line);
  }
  const escape = within(panel).getByRole('region', { name: '封存库的短撤离' });
  expect(escape.textContent).toContain('莉娜：健康65，在出口，实际走过12米。');
  expect(escape.textContent).toContain('苏莱：健康82，在出口，实际走过12米。');
  expect(escape.textContent).toContain('莉恩：健康82，在出口，实际走过12米。');

  // Available ordinary life choices and their real costs/reasons remain visible;
  // no action button is clicked during this read-only routing check.
  expect(value.fool.actions.map(action => action.command.type)).toEqual(['FOG', 'RECEPTION_WORK', 'RECEPTION_REST', 'RECEPTION_NEXT_WEEK']);
  for (const action of value.fool.actions) {
    const button = within(panel).getByRole('button', { name: action.label }) as HTMLButtonElement;
    expect(button.disabled).toBe(!action.enabled);
    const descriptions = (button.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent);
    expect(descriptions).toContain(action.cost);
    if (action.reason) expect(descriptions).toContain(action.reason);
  }
}

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Fool SliceApp actual completed S0 terminal navigation', () => {
  it('reopens the real injured S0 current life with both new masteries zero and never submits or changes the saved campaign', async () => {
    const original = readObjectEntry<SliceState>(SOURCE, 'final');
    expect(hash(original)).toBe(FINAL_SHA256);
    expect(original).toMatchObject({ schemaVersion: 205, contentVersion: 'fool-v205', runId: 'seer-rebuild-natural', revision: 2084,
      status: 'ACTIVE', week: 16006, date: { epoch: 'FIFTH_EPOCH', year: 1656, month: 3, day: 27 },
      character: { name: '莉娜' }, health: 65, mind: 96, spirituality: 92, cash: 71, actionsRemaining: 2,
      random: { seed: 'seer-rebuild-first', cursor: 956 }, progression: { pathwayId: 'diviner', sequence: 0, mastery: {
        'diviner.s0.momentary-blindness': 0, 'diviner.s0.prior-place': 0,
      } }, fool: { guidanceKnown: true }, combat: null, activeEvent: null, ending: null,
      miracleWorker: { revival: { allowance: 4, used: 0, pendingDeathId: null, records: [] } } });
    expect(original.lastCombatRound?.attendantMysteriesOutcome).toBeTruthy();
    const value = projectSliceState(original); // Actual current production projector, exactly once.
    expect(hash(value)).toBe(PUBLIC_SHA256); expect(hash(original)).toBe(FINAL_SHA256);
    expect(value.fool).toMatchObject({ title: PANEL, guidanceKnown: true, promoted: true, insideCase: false,
      resources: { health: 65, mind: 96, spirituality: 92, cash: '71便士', actionsRemaining: 2 } });
    expect(value.fool.abilities).toHaveLength(36);
    for (const ability of value.fool.abilities) expect(ability.mastery).toBe(original.progression.mastery[ability.id]);
    const saved = readOnlyBridge(value); window.sliceGame = saved.bridge;
    try {
      let mounted = render(<SliceApp />);
      for (let opening = 1; opening <= 3; opening++) {
        await continueOriginal(value.character.name); await assertCurrentScene(value);
        expect(saved.bridge.loadRun).toHaveBeenCalledTimes(opening);
        expect(saved.bridge.loadRun).toHaveBeenLastCalledWith(value.runId);
        expect(saved.bridge.submitIntent).not.toHaveBeenCalled();
        expect(hash(original)).toBe(FINAL_SHA256); expect(hash(value)).toBe(PUBLIC_SHA256); expect(saved.publicHash()).toBe(PUBLIC_SHA256);
        if (opening === 1) await userEvent.click(screen.getByRole('button', { name: '返回主菜单' }));
        if (opening === 2) { mounted.unmount(); mounted = render(<SliceApp />); }
      }
      expect(saved.bridge.getBootstrap).toHaveBeenCalledTimes(2);
      mounted.unmount();
    } finally { cleanup(); saved.dispose(); }
  }, 120_000);
});
