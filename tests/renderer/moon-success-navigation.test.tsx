/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { MOON_ABILITIES, MOON_ABILITY_IDS } from '../../src/domain/moon/content.js';
import {
  controlledMoonSuccess, installControlledMoonSuccess, type ControlledMoonSuccess,
} from '../helpers/moon-success.js';
import { assertUnmodifiedMoonRecoverySource, moonStateHash } from '../helpers/moon-source.js';

// Actual SliceApp and public reducer/projection, with a controlled save bridge.
// Build the real paid route once from unchanged exact670. Only the declared new
// S1 draw318 and S0 draw319 return1 after their real generator calls advance.
// This is controlled UI/reload coverage, not natural play or SQLite durability
// evidence; the latter is covered separately in moon-success-save.test.ts.
const PANEL = '序列0 月亮';
const CONSUME = {
  type: 'MOON', command: { type: 'CONSUME', compoundId: 'moon-compound-1', confirmed: true },
} as const satisfies SliceIntent;
const disabled = (button: HTMLElement) => (button as HTMLButtonElement).disabled;
const releases = new Set<() => void>();
let route: ControlledMoonSuccess | undefined;
let seam: ReturnType<typeof installControlledMoonSuccess> | undefined;

function savedGame(before: SliceState) {
  let state = before, commits = 0, failNext = false, barrier: Promise<void> | null = null;
  const attemptedHashes: string[] = [];
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    expect(envelope).toMatchObject({ runId: state.runId, expectedRevision: state.revision, payload: CONSUME });
    if (envelope.payload.type !== 'MOON') throw Error('This controlled bridge only accepts the exact Moon consumption');
    const candidate = applySliceIntent(state, envelope.payload);
    assertValidSliceState(candidate);
    attemptedHashes.push(moonStateHash(candidate));
    const wait = barrier; barrier = null;
    if (wait) await wait;
    if (failNext) {
      failNext = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    state = candidate; commits++;
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-17T15:00:00Z', replayed: false, state: projectSliceState(state) } };
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
        revision: value.revision, updatedAt: '2026-10-17T15:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  await waitFor(() => expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId));
  return { view, value, loadRun };
}

function assertCurrentPage(value: SliceProjection) {
  const panel = screen.getByRole('region', { name: PANEL }), moon = value.moon;
  expect(panel.textContent).toContain(moon.story);
  expect(panel.textContent).toContain(moon.nextStep);
  const { health, mind, spirituality, cash, actionsRemaining } = moon.resources;
  expect(panel.textContent).toContain(`健康 ${health} · 精神 ${mind} · 灵性 ${spirituality} · ${cash} · 本周行动 ${actionsRemaining}`);
  const banner = screen.getAllByRole('banner').find(item => within(item).queryByRole('button', { name: '返回主菜单' }))!;
  expect(banner.textContent).toContain(`${value.character.name} · ${moon.title}`);
  expect(screen.queryByRole('region', { name: '美神成长' })).toBeNull();
  expect(screen.queryByRole('region', { name: '同一流灯的当前资源' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/apothecary-rebuild-first|preparedRoll|futureRoll|randomCursor|cursorBefore|cursorAfter|sourceDigest|historyDigest/);
  return panel;
}

async function assertAbilities(value: SliceProjection, state: SliceState, promoted: boolean) {
  const panel = screen.getByRole('region', { name: PANEL });
  const summary = within(panel).getByText('已掌握的能力', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  const abilities = value.moon.abilities;
  const inherited = abilities.filter(ability => !MOON_ABILITY_IDS.some(id => id === ability.id));
  expect(inherited).toHaveLength(23);
  expect(inherited.map(({ id, mastery }) => ({ id, mastery }))).toEqual(
    inherited.map(({ id }) => ({ id, mastery: route!.source.progression.mastery[id] })),
  );
  for (const ability of abilities) {
    expect(state.progression.mastery[ability.id]).toBe(ability.mastery);
    expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
  }
  expect(abilities).toHaveLength(promoted ? 25 : 23);
  for (const ability of MOON_ABILITIES) {
    if (promoted) {
      expect(state.progression.mastery[ability.id]).toBe(0);
      expect(abilities.find(item => item.id === ability.id)?.mastery).toBe(0);
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 0` })).toBeTruthy();
    } else {
      expect(Object.hasOwn(state.progression.mastery, ability.id)).toBe(false);
      expect(abilities.some(item => item.id === ability.id)).toBe(false);
      expect(within(panel).queryByRole('heading', { name: `${ability.label} · 熟练 0` })).toBeNull();
    }
  }
}

function consumeTrigger(value: SliceProjection) {
  const action = value.moon.actions.find(item => item.command.type === 'CONSUME')!;
  expect(action).toMatchObject({ enabled: true, command: CONSUME.command });
  const button = within(screen.getByRole('region', { name: '晋升与服药' })).getByRole('button', { name: action.label });
  expect(disabled(button)).toBe(false);
  expect((button.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent)).toContain(action.cost);
  return button;
}

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  const control = installControlledMoonSuccess();
  try {
    route = controlledMoonSuccess(control);
    expect(route.cursorAdvancements.map(draw => [draw.stage, draw.cursorBefore, draw.cursorAfter, draw.roll, draw.chance]))
      .toEqual([['S1', 318, 319, 1, 44], ['S0', 319, 320, 1, 70]]);
  } finally { control.restore(); control.substituted.length = 0; }
}, 180_000);
beforeEach(() => {
  seam = installControlledMoonSuccess();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(async () => {
  await act(async () => { for (const release of releases) release(); });
  cleanup(); delete window.sliceGame;
  seam?.restore(); if (seam) seam.substituted.length = 0; seam = undefined;
  // Clearing calls alone retains mock implementations and their full-save closures.
  vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
afterAll(() => { route = undefined; });

describe('Moon real controlled success and saved-page navigation', () => {
  it('opens unpaid Moon guidance from the actual reflected Beauty page without submitting or granting new abilities', async () => {
    const source = route!.source, sourceHash = moonStateHash(source), game = savedGame(source);
    const { value } = await mount(game);
    expect(value.beautyGoddess).toMatchObject({ promoted: true, acting: 100, life: { reflected: true } });
    expect(value.moon).toMatchObject({ guidanceKnown: false, promoted: false });
    await userEvent.click(await screen.findByRole('button', { name: '美神与原玻璃廊' }));
    expect(screen.getByRole('region', { name: '美神成长' })).toBeTruthy();
    const draws = seam!.substituted.length;
    await userEvent.click(screen.getByRole('button', { name: '查看月亮晋升准备' }));
    const panel = assertCurrentPage(value);
    const guidance = value.moon.actions.find(action => action.command.type === 'LEARN_GUIDANCE')!;
    expect(guidance).toMatchObject({ enabled: true, cost: '1行动、100便士' });
    expect(disabled(within(panel).getByRole('button', { name: guidance.label }))).toBe(false);
    expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull();
    await assertAbilities(value, game.state, false);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    expect(seam!.substituted).toHaveLength(draws);
    expect(moonStateHash(game.state)).toBe(sourceHash);
    assertUnmodifiedMoonRecoverySource();
  }, 60_000);

  it('shows actual paid preparation and cancels both ways without consuming or changing the saved S1', async () => {
    const before = route!.beforeConsume, beforeHash = moonStateHash(before), game = savedGame(before);
    const { value } = await mount(game);
    await screen.findByRole('region', { name: PANEL }); assertCurrentPage(value);
    await assertAbilities(value, before, false);
    const trigger = consumeTrigger(value), draws = seam!.substituted.length;
    fireEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '月亮服药确认' });
    expect(dialog.textContent).toContain('70%');
    expect(dialog.textContent).toContain('1行动、30灵性');
    expect(dialog.textContent).toContain('100便士、1行动、12灵性和8精神');
    expect(dialog.textContent).toContain('可能死亡');
    fireEvent.click(within(dialog).getByRole('button', { name: '取消，继续准备' }));
    expect(screen.queryByRole('dialog', { name: '月亮服药确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    dialog = screen.getByRole('dialog', { name: '月亮服药确认' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: '月亮服药确认' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    expect(seam!.substituted).toHaveLength(draws);
    expect(game.state.random.cursor).toBe(319); expect(moonStateHash(game.state)).toBe(beforeHash);
    expect(game.state.moon.promotionStability.preparations.at(-1)).toMatchObject({ status: 'READY', spentEventId: null });
    assertCurrentPage(value); assertUnmodifiedMoonRecoverySource();
  }, 60_000);

  it('retries the same failed-save intent once, shows paid S0 immediately and reloads the identical saved page', async () => {
    const before = route!.beforeConsume, beforeHash = moonStateHash(before), game = savedGame(before);
    game.failNextSave();
    const { view, value } = await mount(game);
    await screen.findByRole('region', { name: PANEL }); const panel = assertCurrentPage(value);
    await assertAbilities(value, before, false);
    fireEvent.click(consumeTrigger(value));
    const confirm = screen.getByRole('button', { name: '确认服用这一份魔药' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.commits).toBe(0);
    expect(moonStateHash(game.state)).toBe(beforeHash);
    assertCurrentPage(value); await assertAbilities(value, game.state, false);
    expect(panel.textContent).toContain('当前仍显示上次已保存的记录');
    expect(screen.queryByRole('dialog', { name: '月亮服药确认' })).toBeNull();
    for (const button of within(panel).getAllByRole('button', { hidden: true })) expect(disabled(button)).toBe(true);
    expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    const envelope = structuredClone(game.submit.mock.calls[0]![0]);
    expect(envelope).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: CONSUME });
    const release = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry);
    expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope);
    expect(game.commits).toBe(0); expect(moonStateHash(game.state)).toBe(beforeHash);
    await assertAbilities(value, game.state, false);
    await act(async () => { release(); });
    await waitFor(() => expect(game.commits).toBe(1));
    const after = game.state, afterHash = moonStateHash(after), saved = projectSliceState(after);
    expect(afterHash).toBe(moonStateHash(route!.success));
    expect(game.attemptedHashes).toEqual([afterHash, afterHash]);
    expect(after).toMatchObject({ revision: before.revision + 1, status: 'ACTIVE',
      progression: { pathwayId: 'moon', sequence: 0, acting: 0 }, random: { seed: before.random.seed, cursor: 320 } });
    expect([after.health, after.mind, after.spirituality, after.cash, after.actionsRemaining])
      .toEqual([before.health, before.mind, before.spirituality - 30, before.cash, before.actionsRemaining - 1]);
    expect(after.progression.mastery).toEqual({ ...before.progression.mastery,
      'moon.s0.moonlit-channel': 0, 'moon.s0.gentle-crossing': 0 });
    const paid = after.moon.journal.find(event => event.command.type === 'STABILIZE_PROMOTION')!;
    expect([paid.before.budget.cash - paid.after.budget.cash, paid.before.budget.actions - paid.after.budget.actions,
      paid.before.budget.spirituality - paid.after.budget.spirituality, paid.before.budget.mind - paid.after.budget.mind]).toEqual([100, 1, 12, 8]);
    expect(after.moon.journal).toHaveLength(before.moon.journal.length + 1);
    expect(after.moon.journal.at(-1)).toMatchObject({ command: CONSUME.command,
      randomReceipts: [{ cursorBefore: 319, cursorAfter: 320, check: { chance: 70, roll: 1, tier: 'GREAT_SUCCESS' } }] });
    expect(after.moon.materials!.settlements).toHaveLength(1);
    expect(after.moon.materials!.settlements[0]).toMatchObject({ success: true, alive: true });
    expect(after.moon.promotionStability.preparations.at(-1)).toMatchObject({ status: 'SPENT', spentEventId: after.moon.journal.at(-1)!.id });
    expect(saved.moon.promoted).toBe(true);
    expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull();
    expect(screen.queryByRole('region', { name: '晋升与服药' })).toBeNull();
    expect(screen.queryByRole('dialog', { name: '月亮服药确认' })).toBeNull();
    const current = assertCurrentPage(saved);
    expect(current.textContent).toContain('实际掷骰 1'); expect(current.textContent).toContain('大成功');
    await assertAbilities(saved, after, true);
    const immediateText = current.textContent;
    view.unmount();
    const reopened = await mount(game);
    await screen.findByRole('region', { name: PANEL });
    expect(reopened.value).toEqual(saved);
    const reloaded = assertCurrentPage(reopened.value);
    await assertAbilities(reopened.value, game.state, true);
    expect(reloaded.textContent).toBe(immediateText);
    expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
    expect(moonStateHash(game.state)).toBe(afterHash); expect(moonStateHash(before)).toBe(beforeHash);
    expect(seam!.substituted.some(draw => draw.stage === 'S0' && draw.cursorBefore === 319)).toBe(true);
    expect(seam!.substituted.every(draw => (draw.cursorBefore === 318 || draw.cursorBefore === 319)
      && draw.cursorAfter === draw.cursorBefore + 1 && draw.controlled === 1)).toBe(true);
    assertUnmodifiedMoonRecoverySource();
  }, 120_000);
});
