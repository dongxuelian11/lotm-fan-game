/* @vitest-environment jsdom */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import { stableStringify } from '../../src/domain/canonical.js';
import { PERFECTER_FROZEN_SOURCE_KEYS, perfecterBudget, perfecterHistoryDigest } from '../../src/domain/perfecter/source.js';
import type { PerfecterAction, PerfecterCommand, PerfecterProjection } from '../../src/domain/perfecter/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';

// The original living797-command capture is immutable. Only real public
// guidance/work commands continue its injuries, original devices and resources.
// Bridge delivery is controlled, not domain outcomes or SQLite persistence.
const ROOT = 'tests/fixtures/civilization-enlightener-v01890';
const SOURCE = `${ROOT}/natural.json`;
const PANEL = '序列0 完美者', ENLIGHTENER = '文明启蒙者成长';
const ENTRY = '查看完美者晋升准备';
const GUIDANCE: SliceIntent = { type: 'PERFECTER', command: { type: 'LEARN_GUIDANCE' } };
const WORK: SliceIntent = { type: 'PERFECTER', command: { type: 'WORK' } };
const hash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
const disabled = (button: HTMLElement): boolean => (button as HTMLButtonElement).disabled;

function original(): SliceState {
  const bytes = readFileSync(SOURCE, 'utf8');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('5d7a97347f8a555c91c7b1a57dc4acdebd78f3ac36414e1674d2bb5d34cc835f');
  const capture = JSON.parse(bytes) as { commands: SliceIntent[]; final: unknown };
  expect(capture.commands).toHaveLength(797);
  const raw = capture.final;
  expect(raw).toMatchObject({ schemaVersion: 186, contentVersion: 'civilization-enlightener-v186' });
  const state = migrateSliceState(raw); assertValidSliceState(state);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(state).toMatchObject({ runId: 'savant-rebuild-natural', revision: 798, status: 'ACTIVE', week: 188,
    character: { name: '伊文' }, health: 60, mind: 98, spirituality: 120, cash: 436, actionsRemaining: 3,
    random: { seed: 'savant-rebuild-first', cursor: 346 }, injuryRisk: 1,
    progression: { pathwayId: 'paragon', sequence: 1, acting: 100 },
    civilizationEnlightener: { life: { reflected: true } },
    perfecter: { guidanceKnown: false, source: null, frame: null, promotionWeek: null, journal: [] },
    combat: null, activeEvent: null, ending: null });
  expect(state.injuries.map(i=>i.severity)).toEqual(['LIGHT','HEAVY']);
  expect(state.lastCombatRound?.civilizationEnlightenerOutcome).toBeTruthy();
  return state;
}

function guided(): SliceState {
  const state = applySliceIntent(original(), GUIDANCE);
  assertValidSliceState(state);
  return state;
}

function assertPublic(value: SliceProjection): void {
  // Resolved public rolls are allowed. Random-stream and future-result fields
  // must never reach SliceApp, including through historical combat records.
  // Report paths only, rather than printing the entire historical campaign.
  const forbidden = /^(?:seed|cursor|randomSeed|randomCursor|randomCursorBefore|randomCursorAfter|cursorBefore|cursorAfter|preparedRoll|futureRoll)$/;
  const paths: string[] = [];
  function visit(current: unknown, path: string): void {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) { current.forEach((child, index) => visit(child, `${path}[${index}]`)); return; }
    for (const [key, child] of Object.entries(current)) {
      const next = `${path}.${key}`;
      if (forbidden.test(key)) paths.push(next);
      visit(child, next);
    }
  }
  visit(value, '$');
  expect(paths, `Private random-stream or future-result paths: ${paths.join(', ')}`).toEqual([]);
  expect(Object.keys(value.perfecter).sort()).toEqual([
    'abilities', 'actions', 'guidanceKnown', 'insideCase', 'nextStep', 'promoted', 'resources', 'risk', 'sections', 'story', 'title',
  ].sort());
}

// Calculate every candidate through the actual reducer before a delivery can
// fail or wait. Retain only hashes for discarded attempts, not campaign trees.
const outstandingReleases = new Set<() => void>();
function savedGame(input: SliceState) {
  let state = input, commits = 0, failNext = false, barrier: Promise<void> | null = null;
  const attemptedHashes: string[] = [];
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (envelope.payload.type !== 'PERFECTER') throw new Error('Expected the public PERFECTER wrapper.');
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
    const value = projectSliceState(state); assertPublic(value);
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-17T12:00:00Z', replayed: false, state: value } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit, attemptedHashes,
    failNextSave() { failNext = true; },
    holdNextSave() {
      if (barrier) throw new Error('A save is already waiting.');
      let resolve = () => {};
      barrier = new Promise<void>(done => { resolve = done; });
      const release = () => { outstandingReleases.delete(release); resolve(); };
      outstandingReleases.add(release);
      return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;

async function mount(game: SavedGame) {
  const value = projectSliceState(game.state); assertPublic(value);
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async () => {
    const current = projectSliceState(game.state); assertPublic(current);
    return { ok: true, value: current };
  });
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
        portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
        revision: value.revision, updatedAt: '2026-10-17T12:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  const view = render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: value.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  if (value.status === 'DEAD') await screen.findByRole('dialog', { name: '战斗回合结果' });
  else if (value.perfecter.guidanceKnown) await screen.findByRole('region', { name: PANEL });
  else {
    // A saved completed round is shown on reopen. Acknowledge it through the
    // real control before navigating; it is not an active encounter.
    await screen.findByRole('region', { name: ENLIGHTENER });
    await userEvent.click(await screen.findByRole('button', { name: '返回生活' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull());
    await userEvent.click(await screen.findByRole('button', { name: '文明启蒙者与原工坊' }));
    await screen.findByRole('region', { name: ENLIGHTENER });
  }
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
  return view;
}

async function openPreparation() {
  await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}

function assertPanel(value: PerfecterProjection, state: SliceState): HTMLElement {
  const panel = screen.getByRole('region', { name: value.title });
  const { health, mind, spirituality, cash, actionsRemaining } = value.resources;
  expect(panel.textContent).toContain(`健康 ${health} · 精神 ${mind} · 灵性 ${spirituality} · ${cash} · 本周行动 ${actionsRemaining}`);
  expect(panel.textContent).toContain(value.story);
  expect(panel.textContent).toContain(value.nextStep);
  expect(panel.textContent).toContain(value.risk);
  const injuries = within(panel).getByRole('region', { name: '原有伤势' });
  expect(injuries.textContent).toContain(`伤势风险 ${state.injuryRisk}`);
  if (!state.injuries.length) expect(injuries.textContent).toContain('当前没有伤势');
  const topbar = screen.getAllByRole('banner').find(banner =>
    within(banner).queryByRole('button', { name: '返回主菜单' }) !== null)!;
  expect(topbar.textContent).toContain(`${state.character.name} · ${value.title}`);
  expect(screen.queryByRole('region', { name: ENLIGHTENER })).toBeNull();
  expect(screen.queryByRole('region', { name: '知识导师' })).toBeNull();
  expect(screen.queryByRole('region', { name: '有限复起待决选择' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/savant-rebuild-first|preparedRoll|futureRoll|randomCursor|cursorBefore|cursorAfter/);
  return panel;
}

async function control(value: PerfecterProjection, type: PerfecterCommand['type']): Promise<{ action: PerfecterAction; button: HTMLElement }> {
  const matches = value.actions.filter(action => action.command.type === type);
  expect(matches).toHaveLength(1);
  const action = matches[0]!, panel = screen.getByRole('region', { name: value.title });
  let button = within(panel).queryByRole('button', { name: action.label });
  if (!button) {
    await userEvent.click(within(panel).getByText('其他可选行动', { selector: 'summary' }));
    button = within(panel).getByRole('button', { name: action.label });
  }
  expect(disabled(button)).toBe(!action.enabled);
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
  cleanup(); delete window.sliceGame;
  // Implementations were installed separately so this drops their state and
  // projection closures, instead of restoring vi.fn(initialImplementation).
  vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Perfecter navigation from the genuine living CivilizationEnlightener save', () => {
  it('opens and closes optional S0 preparation without changing any of the living 797-command source', async () => {
    const before = original(), beforeHash = hash(before), game = savedGame(before);
    await mount(game); await openPreparation();
    const value = projectSliceState(before).perfecter;
    assertPanel(value, before);
    expect(value).toMatchObject({ guidanceKnown: false, promoted: false, insideCase: false });
    const guidance = await control(value, 'LEARN_GUIDANCE');
    expect(guidance.action).toMatchObject({ enabled: true, cost: '1行动、100便士', command: GUIDANCE.command });
    expect(screen.queryByRole('dialog', { name: '完美者服药确认' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '返回当前生活' }));
    expect(await screen.findByRole('button', { name: ENTRY })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await openPreparation(); assertPanel(value, before);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    expect(hash(game.state)).toBe(beforeHash); expect(hash(before)).toBe(beforeHash);
  }, 60_000);

  it('reaches preparation from the actual CivilizationEnlightener page and preserves all 21 old abilities, including exactly eight zero masteries', async () => {
    const before = original(), beforeHash = hash(before), game = savedGame(before);
    await mount(game);
    expect(await screen.findByRole('region', { name: ENLIGHTENER })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const value = projectSliceState(before).perfecter, panel = assertPanel(value, before);
    await userEvent.click(within(panel).getByText('已掌握的能力', { selector: 'summary' }));
    expect(value.abilities).toHaveLength(21);
    expect(value.abilities.filter(ability => ability.mastery === 0)).toHaveLength(8);
    expect(value.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(before.progression.mastery).sort());
    for (const ability of value.abilities) {
      expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    expect(value.abilities.some(ability => ability.id.startsWith('paragon.s0.'))).toBe(false);
    expect(panel.textContent).not.toContain('文明画页');
    expect(panel.textContent).not.toContain('构式校准');
    expect(game.submit).not.toHaveBeenCalled(); expect(hash(game.state)).toBe(beforeHash);
  }, 60_000);

  it('commits actual guidance once for 100 pence and one action, immediately shows the current facilities and reopens that exact state', async () => {
    const before = original(), beforeHash = hash(before), game = savedGame(before);
    const expected = applySliceIntent(before, GUIDANCE), expectedHash = hash(expected);
    await mount(game); await openPreparation();
    const { button } = await control(projectSliceState(before).perfecter, 'LEARN_GUIDANCE');
    await userEvent.click(button);
    await waitFor(() => expect(game.commits).toBe(1));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: GUIDANCE });
    expect(hash(game.state)).toBe(expectedHash);
    expect(game.state).toMatchObject({ revision: 799, cash: 336, actionsRemaining: 2,
      health: 60, mind: 98, spirituality: 120, progression: { sequence: 1 },
      perfecter: { guidanceKnown: true, promotionWeek: null, journal: [] } });
    expect(game.state.perfecter.source!.budget).toEqual(perfecterBudget(before));
    expect(game.state.random).toEqual(before.random); expect(game.state.progression).toEqual(before.progression);
    expect(game.state.lastCombatRound).toEqual(before.lastCombatRound);
    for (const key of PERFECTER_FROZEN_SOURCE_KEYS) expect(game.state[key]).toEqual(before[key]);
    const value = projectSliceState(game.state).perfecter;
    assertPanel(value, game.state);
    expect(screen.getAllByRole('region', { name: '三站真实修理与持续运行' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '听取三站修理与特性指导' })).toBeNull();
    expect(screen.queryByRole('button', { name: '返回当前生活' })).toBeNull();
    expect(value.promoted).toBe(false);
    cleanup(); await mount(game); assertPanel(value, game.state);
    expect(hash(game.state)).toBe(expectedHash); expect(game.submit).toHaveBeenCalledTimes(1);
    expect(hash(before)).toBe(beforeHash);
  }, 60_000);

  it('keeps the original save on guidance failure and retries the same intent ID, payload and revision for one actual charge', async () => {
    const before = original(), beforeHash = hash(before), expectedHash = hash(applySliceIntent(before, GUIDANCE));
    const game = savedGame(before); game.failNextSave();
    await mount(game); await openPreparation();
    const panel = assertPanel(projectSliceState(before).perfecter, before), savedText = panel.textContent;
    const { button } = await control(projectSliceState(before).perfecter, 'LEARN_GUIDANCE');
    await userEvent.click(button);
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    expect(game.commits).toBe(0); expect(hash(game.state)).toBe(beforeHash);
    expect(panel.textContent).toBe(savedText);
    for (const candidate of within(panel).getAllByRole('button')) expect(disabled(candidate)).toBe(true);
    expect(disabled(screen.getByRole('button', { name: '返回主菜单' }))).toBe(true);
    fireEvent.click(button); expect(game.submit).toHaveBeenCalledTimes(1);
    const envelope = structuredClone(game.submit.mock.calls[0]![0]);
    expect(envelope).toEqual({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: GUIDANCE });
    const release = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry);
    expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.submit.mock.calls[1]![0]).toEqual(envelope);
    expect(hash(game.state)).toBe(beforeHash); expect(game.commits).toBe(0);
    await act(async () => { release(); });
    await waitFor(() => expect(game.commits).toBe(1));
    expect(game.attemptedHashes).toEqual([expectedHash, expectedHash]);
    expect(hash(game.state)).toBe(expectedHash);
    expect([game.state.cash, game.state.actionsRemaining, game.state.revision]).toEqual([336, 2, 799]);
    expect(game.state.random).toEqual(before.random);
    expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull();
    assertPanel(projectSliceState(game.state).perfecter, game.state);
    expect(hash(before)).toBe(beforeHash);
  }, 60_000);

  it('blocks duplicate guidance and navigation while the actual commit response is pending', async () => {
    const before = original(), beforeHash = hash(before), expectedHash = hash(applySliceIntent(before, GUIDANCE));
    const game = savedGame(before), release = game.holdNextSave();
    await mount(game); await openPreparation();
    const panel = assertPanel(projectSliceState(before).perfecter, before), savedText = panel.textContent;
    const { button } = await control(projectSliceState(before).perfecter, 'LEARN_GUIDANCE');
    fireEvent.click(button); fireEvent.click(button);
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: GUIDANCE });
    expect(game.commits).toBe(0); expect(hash(game.state)).toBe(beforeHash);
    expect(panel.textContent).toBe(savedText);
    for (const candidate of screen.getAllByRole('button')) { expect(disabled(candidate)).toBe(true); fireEvent.click(candidate); }
    expect(game.submit).toHaveBeenCalledTimes(1);
    await act(async () => { release(); });
    await waitFor(() => expect(game.commits).toBe(1));
    expect(hash(game.state)).toBe(expectedHash);
    assertPanel(projectSliceState(game.state).perfecter, game.state);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(hash(before)).toBe(beforeHash);
  }, 60_000);

  it('sends the first ordinary work with the PERFECTER wrapper and reopens only its real acknowledged resources and history', async () => {
    const before = guided(), beforeHash = hash(before), roots = perfecterHistoryDigest(before);
    const expectedHash = hash(applySliceIntent(before, WORK)), game = savedGame(before);
    await mount(game);
    const value = projectSliceState(before).perfecter;
    assertPanel(value, before);
    const { action, button } = await control(value, 'WORK');
    expect(action.enabled).toBe(true); expect(action.command).toEqual(WORK.command);
    await userEvent.click(button);
    await waitFor(() => expect(game.commits).toBe(1));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: WORK });
    expect(hash(game.state)).toBe(expectedHash);
    expect(game.state.cash).toBe(before.cash + before.character.weeklyWage);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(game.state.wagePaidWeek).toBe(before.week);
    expect(game.state.revision).toBe(before.revision + 1); expect(game.state.random).toEqual(before.random);
    expect(game.state.perfecter.journal).toHaveLength(1);
    expect(game.state.perfecter.journal[0]).toMatchObject({ command: WORK.command, randomReceipts: [] });
    expect(game.state.perfecter.promotionWeek).toBeNull(); expect(game.state.progression.sequence).toBe(1);
    expect(perfecterHistoryDigest(game.state)).toBe(roots);
    assertPanel(projectSliceState(game.state).perfecter, game.state);
    cleanup(); await mount(game);
    assertPanel(projectSliceState(game.state).perfecter, game.state);
    const repeat = await control(projectSliceState(game.state).perfecter, 'WORK');
    expect(repeat.action.enabled).toBe(false); fireEvent.click(repeat.button);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(hash(game.state)).toBe(expectedHash);
    expect(hash(before)).toBe(beforeHash);
  }, 60_000);

});
