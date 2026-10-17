/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { sha256Hex } from '../../src/domain/checksum.js';
import { foolBudget, foolFrozenSourceDigest } from '../../src/domain/fool/source.js';
import type { FoolAction, FoolCommand, FoolProjection } from '../../src/domain/fool/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// Intended destination: tests/renderer/fool-navigation.test.tsx.
// This is the unchanged 1868-command living S1 capture, explicitly migrated.
// Only LEARN_GUIDANCE and the first ordinary work are continued with public
// commands. These tests do not claim a new natural S0 capture, SQLite save,
// promotion, consumption, or post-promotion escape/ability evidence.
const SOURCE = 'tests/fixtures/attendant-mysteries-v01860/natural-battle.json';
const PANEL = '愚者晋升准备', PREDECESSOR = '诡秘侍者成长', ENTRY = '查看愚者晋升准备';
const GUIDANCE: SliceIntent = { type: 'FOOL', command: { type: 'LEARN_GUIDANCE' } };
const WORK: SliceIntent = { type: 'FOOL', command: { type: 'RECEPTION_WORK' } };
const hash = (value: unknown): string => sha256Hex(stableStringify(value));
const disabled = (button: HTMLElement): boolean => (button as HTMLButtonElement).disabled;

function original(): SliceState {
  const raw = readObjectEntry<unknown>(SOURCE, 'final');
  expect(raw).toMatchObject({ schemaVersion: 183, contentVersion: 'attendant-mysteries-v183' });
  const state = migrateSliceState(raw);
  assertValidSliceState(state);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(state).toMatchObject({ runId: 'seer-rebuild-natural', revision: 1869, status: 'ACTIVE', week: 15971,
    character: { name: '莉娜' }, health: 90, mind: 95, spirituality: 106, cash: 25, actionsRemaining: 3,
    random: { seed: 'seer-rebuild-first', cursor: 932 }, progression: { pathwayId: 'diviner', sequence: 1, acting: 100 },
    fool: { guidanceKnown: false, source: null, frame: null, promotionWeek: null, journal: [] },
    attendantMysteries: { life: { reflected: true } }, combat: null, activeEvent: null, ending: null });
  expect(state.lastCombatRound?.attendantMysteriesOutcome).toBeTruthy();
  return state;
}

function guided(): SliceState {
  const state = applySliceIntent(original(), GUIDANCE);
  assertValidSliceState(state);
  return state;
}

// Control only the delivery/commit boundary. Even the failed attempt uses the
// real reducer and validator before its candidate is discarded. Keep hashes
// of attempts instead of retaining additional full campaign trees in mocks.
// This models a failed save before commit, not a lost SQLite acknowledgement.
const outstandingReleases = new Set<() => void>();
function savedGame(input: SliceState) {
  let state = input, commits = 0, failNext = false, barrier: Promise<void> | null = null;
  const attemptedHashes: string[] = [];
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original living campaign already exists.');
    expect(envelope.runId).toBe(state.runId);
    expect(envelope.expectedRevision).toBe(state.revision);
    const next = applySliceIntent(state, envelope.payload);
    assertValidSliceState(next);
    attemptedHashes.push(hash(next));
    const wait = barrier; barrier = null;
    if (wait) await wait;
    if (failNext) {
      failNext = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    state = next; commits++;
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-16T18:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit, attemptedHashes,
    failNextSave() { failNext = true; },
    holdNextSave() {
      if (barrier) throw new Error('A save barrier is already pending.');
      let resolve = () => {};
      barrier = new Promise<void>(done => { resolve = done; });
      const release = () => { outstandingReleases.delete(release); resolve(); };
      outstandingReleases.add(release);
      return release;
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
        revision: value.revision, updatedAt: '2026-10-16T18:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }, { timeout: 30_000 }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  await screen.findByRole('region', { name: value.fool.guidanceKnown ? PANEL : PREDECESSOR }, { timeout: 30_000 });
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
  return loadRun;
}

function assertPanel(value: FoolProjection, state: SliceState) {
  const panel = screen.getByRole('region', { name: value.title });
  const { health, mind, spirituality, cash, actionsRemaining } = value.resources;
  expect(panel.textContent).toContain(`健康 ${health} · 精神 ${mind} · 灵性 ${spirituality} · ${cash} · 本周行动 ${actionsRemaining}`);
  expect(panel.textContent).toContain(value.story);
  expect(panel.textContent).toContain(value.nextStep);
  expect(panel.textContent).toContain(value.risk);
  for (const section of value.sections) {
    const region = within(panel).getByRole('region', { name: section.title });
    for (const line of section.lines) expect(region.textContent).toContain(line);
  }
  for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 熟练 ${ability.mastery}`);
  const topbars = screen.getAllByRole('banner').filter(banner =>
    within(banner).queryByRole('button', { name: '返回主菜单' }) !== null);
  expect(topbars).toHaveLength(1);
  expect(topbars[0]!.textContent).toContain(`${state.character.name} · ${value.title}`);
  expect(screen.queryByRole('region', { name: PREDECESSOR })).toBeNull();
  expect(screen.queryByRole('region', { name: '奇迹师' })).toBeNull();
  expect(screen.queryByRole('region', { name: '古代学者' })).toBeNull();
  expect(screen.queryByRole('region', { name: '有限复起待决选择' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  return panel;
}

function control(value: FoolProjection, type: FoolCommand['type']): { action: FoolAction; button: HTMLElement } {
  const matches = value.actions.filter(action => action.command.type === type);
  expect(matches).toHaveLength(1);
  const action = matches[0]!;
  const button = within(screen.getByRole('region', { name: value.title })).getByRole('button', { name: action.label });
  expect(disabled(button)).toBe(!action.enabled);
  // Check the actual accessible cost/reason relationship, not a fabricated UI label.
  const descriptions = (button.getAttribute('aria-describedby') ?? '').split(' ').map(id => document.getElementById(id)?.textContent);
  expect(descriptions).toContain(action.cost);
  if (action.reason) expect(descriptions).toContain(action.reason);
  return { action, button };
}

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(async () => {
  await act(async () => { for (const release of outstandingReleases) release(); });
  // Install implementations separately above so resetAllMocks releases saved
  // state/projection closures instead of restoring vi.fn(initialImplementation).
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Fool SliceApp original S1 guidance and first-work continuation', () => {
  it('navigates from the actual 1868-command S1 save and commits only the issued guidance without replenishing the original body', async () => {
    expect(readObjectEntry<SliceIntent[]>(SOURCE, 'commands')).toHaveLength(1868);
    const before = original(), beforeHash = hash(before), roots = foolFrozenSourceDigest(before), game = savedGame(before);
    const preview = projectSliceState(before).fool;
    await mount(game);
    // The unchanged S1 save still owns its saved final round. Acknowledge that
    // actual result through the UI before opening the next-stage preparation.
    const originalRound = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(within(originalRound).getByRole('heading', { name: `第 ${before.lastCombatRound!.round} 回合完整记录` })).toBeTruthy();
    const fast = within(originalRound).getByRole('checkbox', { name: '快速显示本回合结果' }) as HTMLInputElement;
    expect(fast.checked).toBe(false);
    await userEvent.click(fast);
    expect(fast.checked).toBe(true);
    expect(game.submit).not.toHaveBeenCalled();
    expect(hash(game.state)).toBe(beforeHash);
    await userEvent.click(within(originalRound).getByRole('button', { name: '返回生活' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull());
    expect(game.submit).not.toHaveBeenCalled();
    expect(game.commits).toBe(0);
    expect(hash(game.state)).toBe(beforeHash);
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    assertPanel(preview, before);
    await userEvent.click(screen.getByRole('button', { name: '返回当前生活' }));
    await screen.findByRole('region', { name: PREDECESSOR });
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(game.submit).not.toHaveBeenCalled();
    expect(hash(game.state)).toBe(beforeHash);
    const { action, button } = control(preview, 'LEARN_GUIDANCE');
    expect(action.enabled).toBe(true);
    const release = game.holdNextSave();
    fireEvent.click(button); fireEvent.click(button);
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: GUIDANCE });
    expect(game.commits).toBe(0);
    expect(hash(game.state)).toBe(beforeHash);
    expect(disabled(button)).toBe(true);
    await act(async () => { release(); });
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    expect(game.commits).toBe(1);
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(foolBudget(game.state)).toEqual(foolBudget(before));
    expect(game.state.random).toEqual(before.random);
    expect(foolFrozenSourceDigest(game.state)).toBe(roots);
    expect(hash(game.state.lastCombatRound)).toBe(hash(before.lastCombatRound));
    expect(game.state.fool.source).toMatchObject({ runId: before.runId, revision: before.revision, random: before.random });
    expect(game.state.fool.source!.budget).toEqual(foolBudget(before));
    expect(game.state.fool.journal).toEqual([]);
    expect(game.state.fool.promotionWeek).toBeNull();
    const current = projectSliceState(game.state).fool;
    expect(current).toMatchObject({ guidanceKnown: true, promoted: false, insideCase: false });
    assertPanel(current, game.state);
    expect(screen.queryByRole('button', { name: action.label })).toBeNull();
    expect(screen.queryByRole('button', { name: '返回当前生活' })).toBeNull();
    expect(hash(before)).toBe(beforeHash);
  }, 90_000);

  it('holds the original resources through a failed first work save and retries the identical intent once with no extra income, action, RNG or revision', async () => {
    const before = guided(), beforeHash = hash(before), roots = foolFrozenSourceDigest(before), game = savedGame(before);
    const value = projectSliceState(before).fool;
    await mount(game);
    const panel = assertPanel(value, before), { action, button } = control(value, 'RECEPTION_WORK');
    expect(action.enabled).toBe(true);
    expect(action.command).toEqual(WORK.command);
    const savedText = panel.textContent;
    const releaseFailure = game.holdNextSave(); game.failNextSave();
    fireEvent.click(button); fireEvent.click(button);
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(game.commits).toBe(0);
    expect(hash(game.state)).toBe(beforeHash);
    expect(panel.textContent).toBe(savedText);
    expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    await act(async () => { releaseFailure(); });
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(game.commits).toBe(0);
    expect(hash(game.state)).toBe(beforeHash);
    expect(panel.textContent).toBe(savedText);
    for (const candidate of within(panel).getAllByRole('button')) expect(disabled(candidate)).toBe(true);
    fireEvent.click(button);
    expect(game.submit).toHaveBeenCalledTimes(1);
    const envelope = structuredClone(game.submit.mock.calls[0]![0]);
    expect(envelope).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: WORK });
    const releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry);
    expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope);
    expect(game.commits).toBe(0);
    expect(hash(game.state)).toBe(beforeHash);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(before.revision + 1));
    await waitFor(() => expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull());
    expect(game.commits).toBe(1);
    expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.attemptedHashes).toEqual([hash(game.state), hash(game.state)]);
    expect(game.state.cash).toBe(before.cash + 24);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(game.state.random).toEqual(before.random);
    expect(game.state.fool.frame!.nowSecond).toBe(before.fool.frame!.nowSecond + 1800);
    expect(game.state.fool.frame!.activityEpoch).toBe(before.fool.frame!.activityEpoch + 1);
    expect(game.state.fool.journal).toHaveLength(1);
    expect(game.state.fool.journal[0]).toMatchObject({ command: { type: 'RECEPTION_WORK' }, revision: before.revision + 1, randomReceipts: [] });
    expect(game.state.fool.reception).toMatchObject({ works: 1, income: 24, rests: 0, weeks: 0, expenses: 0 });
    expect(foolBudget(game.state)).toEqual({ ...foolBudget(before), actions: before.actionsRemaining - 1, cash: before.cash + 24 });
    expect(hash(game.state.fool.source)).toBe(hash(before.fool.source));
    expect(hash(game.state.fool.materials)).toBe(hash(before.fool.materials));
    expect(foolFrozenSourceDigest(game.state)).toBe(roots);
    assertPanel(projectSliceState(game.state).fool, game.state);
    expect(hash(before)).toBe(beforeHash);
  }, 90_000);

  it('loads persisted real guidance straight into the Fool panel twice without old round/revival overlays, new commands or rerolls', async () => {
    const state = guided(), beforeHash = hash(state), game = savedGame(state), value = projectSliceState(state).fool;
    expect(state.progression.sequence).toBe(1);
    expect(state.fool.promotionWeek).toBeNull();
    expect(state.lastCombatRound?.attendantMysteriesOutcome).toBeTruthy();
    for (let opening = 0; opening < 2; opening++) {
      await mount(game);
      assertPanel(value, game.state);
      expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
      expect(screen.queryByRole('button', { name: '核对成神条件与原遗产' })).toBeNull();
      expect(screen.queryByRole('button', { name: '返回当前生活' })).toBeNull();
      for (const type of ['RECEPTION_WORK', 'RECEPTION_REST', 'RECEPTION_NEXT_WEEK'] as const) control(value, type);
      const nextWeek = control(value, 'RECEPTION_NEXT_WEEK');
      expect(nextWeek.action.enabled).toBe(false);
      fireEvent.click(nextWeek.button);
      expect(game.submit).not.toHaveBeenCalled();
      expect(game.commits).toBe(0);
      expect(hash(game.state)).toBe(beforeHash);
      cleanup();
    }
    expect(game.state.random).toEqual({ seed: 'seer-rebuild-first', cursor: 932 });
    expect(game.state.revision).toBe(1870);
    expect(game.state.fool.journal).toEqual([]);
  }, 90_000);
});
