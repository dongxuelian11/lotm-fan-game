/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NatureWalkerPanel, type NatureWalkerPanelProps } from '../../src/renderer/NatureWalkerPanel.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { projectNatureWalker } from '../../src/domain/nature-walker/index.js';
import { NATURE_WALKER_ABILITY_IDS, NATURE_WALKER_SOURCE_KEYS, type NatureWalkerAction, type NatureWalkerProjection, type NatureWalkerCommand } from '../../src/domain/nature-walker/types.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { playerText } from '../../src/shared/player-text.js';
import { directedInitial2, dose, originalBarrenMatriarch, nw, prepared, promoted, promotedForLife, promotedDigested, taught } from '../domain/nature-walker-directed-helper.js';

const PANEL = '自然行者成长', PAGE = /^自然行者/, CONFIRM = '自然行者操作确认', ROUND = '战斗回合结果';
const roots = (state: SliceState) => JSON.stringify(NATURE_WALKER_SOURCE_KEYS.map(key => state[key]));
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const primary = () => within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
const targets = () => screen.getByRole('navigation', { name: '自然行者目标' });
const resources = () => screen.getByRole('region', { name: '自然行者当前资源' });
const room = () => screen.getByRole('region', { name: '自然行者原场事务' });
const editorial = /候选|原创G|本作G|原文未核|编号推断|CB3-|BM2-|NW1-|\bSTART\b|\bGUIDE\b|nature-walker-potion-/;
const confirm = (dialog = screen.getByRole('dialog', { name: CONFIRM })) => within(dialog).getByRole('button', { name: '确认执行这一次操作' });
function show(value: NatureWalkerProjection = projectNatureWalker(originalBarrenMatriarch()), extra: Partial<NatureWalkerPanelProps> = {}) {
  const onCommand = extra.onCommand ?? vi.fn<NatureWalkerPanelProps['onCommand']>().mockImplementation(() => {});
  return { ...render(<NatureWalkerPanel value={value} busy={false} {...extra} onCommand={onCommand} />), onCommand };
}
function openPrimary() { fireEvent.click(primary()); return screen.getByRole('dialog', { name: CONFIRM }); }
function actionFor(value: NatureWalkerProjection, command: NatureWalkerCommand) {
  const action = value.actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`No public action for ${JSON.stringify(command)}.`);
  return action;
}
function buttonFor(action: NatureWalkerAction) {
  const panel = screen.getByRole('region', { name: PANEL });
  const buttons = within(panel).getAllByRole('button', { hidden: true }).filter(button => button.textContent?.startsWith(playerText(action.label)));
  expect(buttons).toHaveLength(1);
  const button = buttons[0]!, fold = button.closest('details'); if (fold) fold.open = true;
  return button;
}
function openAction(action: NatureWalkerAction) {
  const button = buttonFor(action); expect(disabled(button)).toBe(false); fireEvent.click(button);
  return screen.getByRole('dialog', { name: CONFIRM });
}

// The full 851-command historical source is streamed and migrated to CURRENT. This is directed UNIT
// coverage; it never substitutes for a natural capture or SQLite transaction.
beforeAll(() => { originalBarrenMatriarch(); promoted(); }, 30_000);
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  // Implementations are installed with mockImplementation so resetAllMocks
  // releases full-state closures rather than restoring an initial closure.
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Nature Walker panel: living original and independent bottles', () => {
  it('shows the real W212 body, fifteen inherited abilities and three new bottles without spending', () => {
    const state = originalBarrenMatriarch(), bytes = roots(state), privateBytes = JSON.stringify(state), value = projectNatureWalker(state), view = show(value);
    expect(resources().textContent).toContain('健康100/100 · 精神96/100 · 灵性114/120');
    expect(resources().textContent).toContain('885便士 · 本周行动3');
    expect(value.abilities).toHaveLength(15);
    expect(value.abilities.filter(entry => entry.mastery === 0)).toHaveLength(3);
    for (const ability of value.abilities) expect(view.container.textContent).toContain(`${playerText(ability.label)} · 掌握${ability.mastery}`);
    expect(resources().textContent).toContain('现有伤势0处 · 伤势风险0');
    expect(screen.queryByRole('list', { name: '当前伤势与处置' })).toBeNull();
    expect(resources().textContent).toContain('当前角色性别：女性');
    expect(value.abilities.map(entry => entry.id)).not.toEqual(expect.arrayContaining([...NATURE_WALKER_ABILITY_IDS]));
    expect(view.container.textContent).toContain('当前保留15项能力');
    expect(within(targets()).getAllByRole('button')).toHaveLength(3);
    expect(primary().textContent).toContain('500便士');
    expect(value.bottles).toHaveLength(3);
    expect(view.container.textContent).toContain('可选择继续停留荒芜主母');
    expect(view.container.textContent).not.toMatch(editorial);
    expect(view.onCommand).not.toHaveBeenCalled(); expect(roots(state)).toBe(bytes);
    expect(state.natureWalker.bottles[0]!.source).toContain(state.natureWalker.bottles[0]!.id);
    expect(value.bottles[0]!.source).toContain("第1号"); expect(JSON.stringify(state)).toBe(privateBytes);
  }, 30_000);

  it('uses the actual unavailable purchase reason after paying for guidance', () => {
    const state = nw(originalBarrenMatriarch(), { type: 'LEARN_GUIDANCE' }), value = projectNatureWalker(state), view = show(value);
    const action = actionFor(value, { type: 'BUY_POTION', bottleId: value.bottles[0]!.id }), button = buttonFor(action);
    expect(action.enabled).toBe(false); expect(disabled(button)).toBe(true);
    expect(button.getAttribute('aria-describedby')).toBe(`nature-walker-reason-${action.id}`);
    expect(document.getElementById(`nature-walker-reason-${action.id}`)?.textContent).toBe(playerText(action.reason!));
    expect(resources().textContent).toContain('385便士'); fireEvent.click(button); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('preserves the selected independent second bottle after its own paid work receipt', () => {
    const state = taught(), value = projectNatureWalker(state), onCommand = vi.fn<NatureWalkerPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    const bottle = value.bottles[1]!;
    fireEvent.click(within(targets()).getByRole('button', { name: `${bottle.title} · ${bottle.status}` }));
    const after = projectNatureWalker(nw(state, { type: 'POTION_WORK', bottleId: bottle.id }));
    view.rerender(<NatureWalkerPanel value={after} busy={false} onCommand={onCommand} />);
    const selected = screen.getByRole('region', { name: '独立原药瓶' });
    expect(selected.textContent).toContain(bottle.title); expect(selected.textContent).toContain('劳动1/5');
    expect(onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('confirms the real held bottle once and states the irrecoverable success and failure costs', () => {
    const state = prepared(), value = projectNatureWalker(state), bytes = roots(state), view = show(value), dialog = openAction(actionFor(value, dose));
    expect(dialog.textContent).toContain(playerText(value.bottles[0]!.source));
    expect(dialog.textContent).toContain(`当前成功率${value.bottles[0]!.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('失败保留已付代价');
    const button = within(dialog).getByRole('button', { name: '确认服用这一药瓶' });
    fireEvent.click(button); fireEvent.click(button);
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(dose); expect(roots(state)).toBe(bytes);
    expect(dose).toEqual({ type: 'CONSUME', bottleId: 'nature-walker-potion-1', confirmed: true });
    expect(dialog.textContent).not.toMatch(/接受角色变化|成功晋升会使男性/);
  }, 30_000);

  it('renders an actual failed dose without renewing the bottle or hiding its paid costs', () => {
    const before = prepared('FAILURE'), state = nw(before, dose), value = projectNatureWalker(state), view = show(value);
    expect(value.promoted).toBe(false); expect(value.bottles[0]!.status).toContain('原瓶已耗尽');
    expect(state.natureWalker.bottles[0]!.status).toBe('CONSUMED');
    expect(value.abilities).toHaveLength(15); expect(state.mind).toBeLessThan(before.mind);
    expect(resources().textContent).toContain(`精神${state.mind}/100`);
    expect(state.cash).toBe(before.cash); expect(roots(state)).toBe(roots(before)); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000); // Independent failed preparation and real reducer receipt across the original history.

  it('retains all fifteen masteries and adds only two zero masteries after promotion', () => {
    const state = promoted(), value = projectNatureWalker(state), source = originalBarrenMatriarch(), view = show(value);
    expect(value.abilities).toHaveLength(17);
    expect(value.abilities.filter(entry => entry.mastery === 0)).toHaveLength(5);
    for (const [id, mastery] of Object.entries(source.progression.mastery)) expect(value.abilities.find(entry => entry.id === id)?.mastery).toBe(mastery);
    expect(value.abilities.slice(-2).map(entry => [entry.id, entry.mastery])).toEqual(NATURE_WALKER_ABILITY_IDS.map(id => [id, 0]));
    expect(view.container.textContent).toContain('当前保留17项能力');
    expect(state.health).toBe(source.health); expect(state.injuries).toEqual(source.injuries);
    expect(state.spirituality).toBe(source.spirituality); expect(state.natureWalker.life.rootPad!.integrity).toBe(50);
    expect(resources().textContent).toContain('原伤继续生效');
    expect(room().textContent).toContain('艾达·芬恩'); expect(room().textContent).toContain('莉娜·肖');
    expect(room().textContent).not.toMatch(/灵性100|能量100|精力100/);
    expect(view.container.textContent).not.toMatch(editorial); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('preserves a custom player name while adapting only authored prose', () => {
    const state = originalBarrenMatriarch(); state.character.name = '原创G候选艾洛';
    const value = projectNatureWalker(state), before = structuredClone(value), view = show(value);
    expect(view.container.textContent).toContain(state.character.name); expect(value).toEqual(before);
  }, 30_000);
});

describe('Nature Walker panel: confirmation and save safety', () => {
  it('traps confirmation focus and restores the same action on cancellation', () => {
    const onClose = vi.fn<() => void>().mockImplementation(() => {}), view = show(undefined, { onClose }), button = primary(), dialog = openPrimary();
    expect(document.activeElement).toBe(dialog.querySelector('h3'));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm(dialog));
    fireEvent.keyDown(dialog, { key: 'Tab' }); expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    for (const target of within(targets()).getAllByRole('button')) expect(disabled(target)).toBe(true);
    const exit = screen.getByRole('button', { name: '返回普通生活' }); expect(disabled(exit)).toBe(true); fireEvent.click(exit);
    fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(button);
    expect(view.onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  }, 30_000);

  it('holds one submitted intent until changed saved facts arrive', async () => {
    const state = directedInitial2(), value = projectNatureWalker(state), onCommand = vi.fn<NatureWalkerPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    const dialog = openPrimary(); fireEvent.click(confirm(dialog)); fireEvent.click(confirm(dialog));
    view.rerender(<NatureWalkerPanel value={value} busy={false} onCommand={onCommand} />);
    expect(disabled(primary())).toBe(true); fireEvent.keyDown(dialog, { key: 'Escape' }); expect(screen.getByRole('dialog')).toBe(dialog);
    const after = projectNatureWalker(nw(state, { type: 'LEARN_GUIDANCE' }));
    view.rerender(<NatureWalkerPanel value={after} busy={false} onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.queryByRole('status')).toBeNull(); expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' });
  }, 30_000);

  it('locks the unchanged saved view on failure and accepts only the externally retried receipt', async () => {
    const state = directedInitial2(), value = projectNatureWalker(state), onCommand = vi.fn<NatureWalkerPanelProps['onCommand']>().mockImplementation(() => {}), view = show(value, { onCommand });
    fireEvent.click(confirm(openPrimary()));
    view.rerender(<NatureWalkerPanel value={value} busy={false} error="保存暂时失败" onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.getByRole('alert').textContent).toContain('重试操作处理同一次保存');
    for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
    expect(resources().textContent).toContain(`${state.cash}便士`);
    view.rerender(<NatureWalkerPanel value={value} busy error={null} onCommand={onCommand} />);
    const saved = nw(state, onCommand.mock.calls[0]![0]);
    view.rerender(<NatureWalkerPanel value={projectNatureWalker(saved)} busy={false} onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.queryByRole('status')).toBeNull();
    expect(saved.natureWalker.acquisitionJournal.filter(entry => entry.command.type === 'LEARN_GUIDANCE')).toHaveLength(1);
    expect(onCommand).toHaveBeenCalledExactlyOnceWith({ type: 'LEARN_GUIDANCE' }); expect(resources().textContent).toContain(`${saved.cash}便士`);
  }, 30_000);

  it('invalidates an old confirmation when a different saved state arrives', async () => {
    const state = prepared(), onCommand = vi.fn<NatureWalkerPanelProps['onCommand']>().mockImplementation(() => {}), view = show(projectNatureWalker(state), { onCommand });
    openPrimary(); view.rerender(<NatureWalkerPanel value={projectNatureWalker(nw(state, dose))} busy={false} onCommand={onCommand} />);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull()); expect(onCommand).not.toHaveBeenCalled();
  }, 30_000);

  it('blocks every action while externally busy and closes a free view without a domain command', () => {
    for (const mode of ['busy', 'blocked'] as const) {
      const view = show(undefined, { busy: mode === 'busy', blocked: mode === 'blocked', onClose: vi.fn<() => void>().mockImplementation(() => {}) });
      for (const button of screen.getAllByRole('button')) expect(disabled(button)).toBe(true);
      expect(view.onCommand).not.toHaveBeenCalled(); view.unmount();
    }
    const onClose = vi.fn<() => void>().mockImplementation(() => {}), view = show(undefined, { onClose });
    fireEvent.click(screen.getByRole('button', { name: '返回普通生活' })); expect(onClose).toHaveBeenCalledOnce(); expect(view.onCommand).not.toHaveBeenCalled();
  }, 30_000);
});

// The bridge controls commit delivery only. Every candidate and successful
// receipt comes from the real reducer and validator, including all old history.
function savedGame(input: SliceState) {
  let state = structuredClone(input), commits = 0, failNext = false;
  let nextBarrier: Promise<void> | null = null;
  const attemptedStates: SliceState[] = [], receipts = new Map<string, SliceReceipt>();
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    const receipt = receipts.get(envelope.intentId);
    if (receipt) return { ok: true, value: { ...structuredClone(receipt), replayed: true } };
    if (envelope.payload.type === 'CREATE') throw new Error('The actual original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next); attemptedStates.push(next);
    const barrier = nextBarrier; nextBarrier = null; if (barrier) await barrier;
    if (failNext) { failNext = false; return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } }; }
    const previousRevision = state.revision; state = next; commits++;
    const saved: SliceReceipt = { intentId: envelope.intentId, runId: state.runId, previousRevision, newRevision: state.revision,
      committedAt: '2026-10-16T00:00:00Z', replayed: false, state: projectSliceState(state) };
    receipts.set(envelope.intentId, saved); return { ok: true, value: saved };
  });
  return { get state() { return state; }, get commits() { return commits; }, attemptedStates, submit,
    failNextSave() { failNext = true; }, holdNextSave() {
      if (nextBarrier) throw new Error('A save barrier is already pending.');
      let release = () => {}; nextBarrier = new Promise<void>(resolve => { release = resolve; }); return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mountSaved(game: SavedGame) {
  const value = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name, portraitId: value.character.portraitId,
        week: value.week, date: value.date, status: value.status, revision: value.revision, updatedAt: '2026-10-16T00:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }, { timeout: 30_000 }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  if (value.lastCombatRound?.natureWalkerOutcome) await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
  else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! }, { timeout: 30_000 });
  else if (value.natureWalker.insideCase) await screen.findByRole('region', { name: PANEL }, { timeout: 30_000 });
  else await screen.findByRole('button', { name: PAGE }, { timeout: 30_000 });
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
}
async function reopenSaved(game: SavedGame) { cleanup(); await mountSaved(game); }
async function openSavedPanel() {
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: PAGE }));
  return screen.getByRole('region', { name: PANEL });
}
describe('Nature Walker saved shell: one actual result and one retry envelope', () => {
  it('does not reopen the inherited surrender over the new stage and retries the same forty-penny annex purchase once', async () => {
    const before = nw(promotedForLife(), { type: 'EXIT_ORIGINAL' }), expected = nw(before, { type: 'INITIALISE_WORKAREA' });
    const game = savedGame(before), bytes = roots(before), releaseFailure = game.holdNextSave(); game.failNextSave();
    await mountSaved(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openSavedPanel();
    const action = actionFor(projectNatureWalker(before), { type: 'INITIALISE_WORKAREA' }), dialog = openAction(action);
    expect(dialog.textContent).toContain('40便士'); const button = confirm(dialog); fireEvent.click(button); fireEvent.click(button);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.commits).toBe(0); expect(game.state).toEqual(before);
    expect(game.attemptedStates[0]).toEqual(expected); expect(disabled(button)).toBe(true);
    await act(async () => { releaseFailure(); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(resources().textContent).toContain(`${before.cash}便士`); expect(game.state.natureWalker.life.annex.paidWeek).toBeNull();
    const envelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope); expect(game.state).toEqual(before);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(expected.revision), { timeout: 30_000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(game.state).toEqual(expected); expect(game.commits).toBe(1);
    expect(game.state.cash).toBe(before.cash - 40); expect(game.state.natureWalker.life.annex).toEqual(expected.natureWalker.life.annex);
    expect(game.state.random).toEqual(before.random); expect(roots(game.state)).toBe(bytes);
    await reopenSaved(game); await openSavedPanel();
    expect(resources().textContent).toContain(`${expected.cash}便士`);
    expect(screen.getByRole('region', { name: '另行付费的新照料场地', hidden: true }).textContent).toContain('实际支付40便士');
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 30_000); // Real original promotion, physical exit, two reducer/save attempts and a fresh shell load.

});

function openCare(initial: SliceState, caseId: 'living-response' | 'withdrawn-care' | 'root-impact' = 'living-response', method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  let state = initial;
  if (state.natureWalker.life.site!.playerLocation === 'START') state = nw(state, { type: 'EXIT_ORIGINAL' });
  if (state.natureWalker.life.annex.paidWeek === null) state = nw(state, { type: 'INITIALISE_WORKAREA' });
  state = nw(state, { type: 'OBSERVE', caseId }); state = nw(state, { type: 'PREPARE', caseId, method });
  state = nw(state, { type: 'WALK', caseId, to: 'ANNEX_A' });
  for (const type of ['CHECK_ORIGINALS', 'CONSENT_OWNER', 'SETUP_OBJECTS'] as const) state = nw(state, { type, caseId });
  state = nw(state, { type: 'WALK', caseId, to: 'ANNEX_B' });
  return nw(state, { type: 'CHECK_SAMPLE', caseId });
}
function finishCare(state: SliceState, caseId: 'living-response' | 'withdrawn-care' | 'root-impact'): SliceState {
  state = nw(state, { type: 'RETURN_OBJECTS', caseId });
  state = nw(state, { type: 'WALK', caseId, to: 'ANNEX_A' });
  state = nw(state, { type: 'WALK', caseId, to: 'OUTSIDE' });
  for (const type of ['INSPECT', 'LEAVE', 'REPORT'] as const) state = nw(state, { type, caseId });
  return state;
}
describe('Nature Walker panel: original care, finite costs and ordinary return', () => {
  it('does not add a resource gate to an authorized ordinary cancellation or movement', () => {
    const state = openCare(promotedForLife()), value = projectNatureWalker(state);
    // Presentation boundary only. Actual domain-enabled actions remain authoritative.
    value.resources = { ...value.resources!, spirituality: 0, cash: '0便士', actionsRemaining: 0 };
    const command = { type: 'CANCEL_CASE', caseId: 'living-response' } as const, action = actionFor(value, command), view = show(value);
    expect(action.enabled).toBe(true); fireEvent.click(confirm(openAction(action)));
    expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(state.natureWalker.life.site!.samples.map(sample => sample.vitality)).toEqual([47, 47, 0]);
  }, 30_000);

  it('shows a paid successful response before application and awards mastery only after actual return and report', () => {
    const initial = openCare(promotedForLife()), cast = nw(initial, { type: 'LIVING_RESPONSE', caseId: 'living-response' });
    expect(cast.spirituality).toBe(initial.spirituality - 8); expect(cast.mind).toBe(initial.mind - 2);
    expect(cast.natureWalker.life.annex.supportPieces).toBe(2);
    expect(cast.progression.mastery['mother.s1.living-response']).toBe(0);
    const view = show(projectNatureWalker(cast));
    expect(room().textContent).toContain('当前作用还剩20秒'); expect(room().textContent).toContain('实耗8灵性、2精神');
    const applied = nw(cast, { type: 'CARE_CHECK', caseId: 'living-response', response: 'COOPERATE' });
    expect(applied.natureWalker.life.cases['living-response'].attempts[0]!.careAssisted).toBe(true);
    view.rerender(<NatureWalkerPanel value={projectNatureWalker(applied)} busy={false} onCommand={view.onCommand} />);
    expect(room().textContent).toContain('先前付费的生机辨应已为这一次本人核查增加35');
    expect(applied.progression.mastery['mother.s1.living-response']).toBe(0);
    const after = finishCare(applied, 'living-response');
    expect(after.progression.mastery['mother.s1.living-response']).toBe(8);
    expect(after.natureWalker.life.site!.samples.map(sample => sample.vitality)).toEqual([47, 47, 0]);
    expect(after.natureWalker.life.rootPad!.integrity).toBe(50); expect(roots(after)).toBe(roots(initial));
  }, 30_000);

  it('keeps a failed response paid and exposes the ordinary care alternative', () => {
    const initial = openCare(promotedForLife('LIVING_RESPONSE_FAIL')), state = nw(initial, { type: 'LIVING_RESPONSE', caseId: 'living-response' });
    const value = projectNatureWalker(state), view = show(value);
    expect(state.spirituality).toBe(initial.spirituality - 8); expect(state.mind).toBe(initial.mind - 4);
    expect(state.natureWalker.life.annex.supportPieces).toBe(2); expect(state.natureWalker.life.operation.livingResponse).toBeNull();
    expect(room().textContent).toMatch(/生机辨应：(严重)?失败/);
    const command = { type: 'ORDINARY_CARE', caseId: 'living-response' } as const;
    fireEvent.click(confirm(openAction(actionFor(value, command)))); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    const after = finishCare(nw(state, command), 'living-response');
    expect(after.progression.mastery['mother.s1.living-response']).toBe(0); expect(roots(after)).toBe(roots(initial));
  }, 30_000);

  it('shows fresh withdrawal and free cancellation without replaying old permission', () => {
    const first = openCare(promotedForLife(), 'living-response', 'ORDINARY');
    const closed = finishCare(nw(first, { type: 'ORDINARY_CARE', caseId: 'living-response' }), 'living-response');
    const before = openCare(closed, 'withdrawn-care'), state = nw(before, { type: 'WITHDRAW_PERMISSION', caseId: 'withdrawn-care' });
    const value = projectNatureWalker(state), view = show(value);
    expect(room().textContent).toContain('许可已撤回，不能继续施术');
    expect(value.actions.some(action => action.enabled && action.command.type === 'LIVING_RESPONSE')).toBe(false);
    const command = { type: 'CANCEL_CASE', caseId: 'withdrawn-care' } as const;
    fireEvent.click(confirm(openAction(actionFor(value, command)))); expect(view.onCommand).toHaveBeenCalledExactlyOnceWith(command);
    const after = finishCare(nw(state, command), 'withdrawn-care');
    expect(after.spirituality).toBe(before.spirituality); expect(after.mind).toBe(before.mind);
    expect(after.natureWalker.life.annex.effortSpent).toBe(6); expect(after.natureWalker.life.site!.recipient.mind).toBe(98);
    expect(after.natureWalker.life.site!.owner.location).toBe('OUTSIDE'); expect(after.natureWalker.life.site!.recipient.location).toBe('OUTSIDE');
    expect(roots(after)).toBe(roots(before));
  }, 30_000);
});

function assertNatureWalkerRound(state: SliceState) {
  const round = state.lastCombatRound!;
  expect(round.natureWalkerOutcome).toBeTruthy();
  const dialog = screen.getByRole('dialog', { name: ROUND });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(within(dialog).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(dialog.textContent).toContain(`你的次数盘：${round.playerCount}次`);
  expect(dialog.textContent).toContain(`对手次数盘：${round.enemyCount}次`);
  expect(dialog.textContent).toContain('原根纤维衬垫当前完整度');
  expect(dialog.textContent).toContain('同一原护腕未用');
  expect(dialog.textContent).not.toMatch(/本人下一.*身体行动.*35|原护板|薇娜|米拉|布拉姆/);
  expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
  const publicState = projectSliceState(state);
  const forbidden = new Set(['seed', 'cursor', 'randomSeed', 'randomCursor', 'cursorBefore', 'cursorAfter', 'randomCursorBefore', 'randomCursorAfter', 'truth', 'mechanicalPreparation', 'preparationRoll']);
  const inspect = (value: unknown, path = ''): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((child, index) => inspect(child, `${path}[${index}]`)); return; }
    for (const [key, child] of Object.entries(value)) {
      expect(forbidden.has(key), `Private field ${path}.${key}`).toBe(false);
      if (key === 'source') expect(/\.modifiers\[\d+\]$/.test(path), `Private source at ${path}`).toBe(true);
      inspect(child, `${path}.${key}`);
    }
  };
  inspect(publicState.lastCombatRound); inspect(publicState.combat?.lastRound); inspect(publicState.combatHistory.at(-1));
}

describe('Nature Walker saved combat round ownership', () => {
  it('shows the new round once and reopens it without replaying either old surrender or a failed save', async () => {
    let before = promotedDigested();
    for (const type of ['PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) before = nw(before, { type });
    const value = projectSliceState(before), game = savedGame(before), intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    const expected = applySliceIntent(before, intent), bytes = roots(before), releaseFailure = game.holdNextSave(); game.failNextSave();
    expect(before.barrenMatriarch.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70 });
    expect(before.coffinBearer.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 50 });
    expect(before.combat).toMatchObject({ encounterId: 'NATURE_WALKER_DISPUTE', round: 1, lastRound: null });
    expect(before.natureWalker.life.site!.owner.location).toBe('OUTSIDE'); expect(before.natureWalker.life.site!.recipient.location).toBe('OUTSIDE');
    await mountSaved(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }); expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(stage.textContent).toContain('同一原护腕未用'); expect(stage.textContent).toContain('没有照料对象');
    const stance = value.combat!.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }); fireEvent.click(submit); fireEvent.click(submit);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.attemptedStates[0]).toEqual(expected); expect(game.state).toEqual(before);
    await act(async () => { releaseFailure(); });
    const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(disabled(submit)).toBe(true); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const envelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope); expect(game.state.random).toEqual(before.random);
    await act(async () => { releaseSuccess(); }); await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
    assertNatureWalkerRound(expected); expect(game.state).toEqual(expected); expect(game.commits).toBe(1); expect(game.attemptedStates[1]).toEqual(expected);
    expect(expected.combatHistory).toHaveLength(before.combatHistory.length + 1); expect(expected.combatHistory.slice(0, -1)).toEqual(before.combatHistory);
    expect(roots(expected)).toBe(bytes); expect(expected.natureWalker.life.rootPad!.integrity).toBeLessThanOrEqual(before.natureWalker.life.rootPad!.integrity);
    const resultText = screen.getByRole('dialog', { name: ROUND }).textContent;
    await reopenSaved(game); assertNatureWalkerRound(expected); expect(screen.getByRole('dialog', { name: ROUND }).textContent).toBe(resultText);
    expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 30_000);
});
