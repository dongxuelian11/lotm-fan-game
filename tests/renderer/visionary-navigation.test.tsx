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
import { VISIONARY_FROZEN_SOURCE_KEYS, visionaryBudget, visionaryHistoryDigest } from '../../src/domain/visionary/source.js';
import type { VisionaryAction, VisionaryCommand, VisionaryProjection } from '../../src/domain/visionary/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

// The living 659-command capture and the separate 667-command death are kept
// distinct. Only real public guidance/work commands continue the living save.
// The bridge controls delivery, not domain results. These tests are navigation
// and retry evidence, not SQLite persistence or a successful S0 promotion.
const ROOT = 'tests/fixtures/writer-v01880';
const SOURCE = `${ROOT}/snapshot-practiced.json`;
const PANEL = '序列0 空想家', WRITER = '作家成长';
const ENTRY = '查看空想家晋升准备';
const GUIDANCE: SliceIntent = { type: 'VISIONARY', command: { type: 'LEARN_GUIDANCE' } };
const WORK: SliceIntent = { type: 'VISIONARY', command: { type: 'WORK' } };
const hash = (value: unknown): string => createHash('sha256').update(stableStringify(value)).digest('hex');
const disabled = (button: HTMLElement): boolean => (button as HTMLButtonElement).disabled;

function original(): SliceState {
  const bytes = readFileSync(SOURCE, 'utf8');
  expect(createHash('sha256').update(bytes).digest('hex'))
    .toBe('49e6d09f367fab24667093f32a1a887aef5b000a2fe505a56cb3190276e3a0bc');
  const raw: unknown = JSON.parse(bytes);
  expect(raw).toMatchObject({ schemaVersion: 185, contentVersion: 'writer-v185' });
  const state = migrateSliceState(raw);
  assertValidSliceState(state);
  expect([state.schemaVersion, state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  expect(state).toMatchObject({ runId: 'audience-rebuild-natural', revision: 660, status: 'ACTIVE', week: 144,
    character: { name: '莉娜' }, health: 100, mind: 100, spirituality: 120, cash: 400, actionsRemaining: 3,
    random: { seed: 'audience-rebuild-first', cursor: 480 }, injuries: [], injuryRisk: 0,
    progression: { pathwayId: 'audience', sequence: 1, acting: 100 },
    writer: { life: { reflected: true } },
    visionary: { guidanceKnown: false, source: null, frame: null, promotionWeek: null, journal: [] },
    combat: null, activeEvent: null, ending: null });
  expect(state.lastCombatRound?.discernerOutcome).toBeTruthy();
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
  expect(paths, 'Private random-stream or future-result fields in the public projection').toEqual([]);
  expect(Object.keys(value.visionary).sort()).toEqual([
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
    if (envelope.payload.type !== 'VISIONARY') throw new Error('Expected the public VISIONARY wrapper.');
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
  else if (value.visionary.guidanceKnown) await screen.findByRole('region', { name: PANEL });
  else await screen.findByRole('heading', { name: '人物卷宗' });
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
  return view;
}

async function openPreparation() {
  await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
  return screen.findByRole('region', { name: PANEL });
}

function assertPanel(value: VisionaryProjection, state: SliceState): HTMLElement {
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
  expect(screen.queryByRole('region', { name: WRITER })).toBeNull();
  expect(screen.queryByRole('region', { name: '洞察者' })).toBeNull();
  expect(screen.queryByRole('region', { name: '有限复起待决选择' })).toBeNull();
  expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  expect(panel.innerHTML).not.toMatch(/audience-rebuild-first|preparedRoll|futureRoll|randomCursor|cursorBefore|cursorAfter/);
  return panel;
}

async function control(value: VisionaryProjection, type: VisionaryCommand['type']): Promise<{ action: VisionaryAction; button: HTMLElement }> {
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

describe('Visionary navigation from the genuine living Writer save', () => {
  it('opens and closes optional S0 preparation without changing any of the living 659-command source', async () => {
    const before = original(), beforeHash = hash(before), game = savedGame(before);
    await mount(game); await openPreparation();
    const value = projectSliceState(before).visionary;
    assertPanel(value, before);
    expect(value).toMatchObject({ guidanceKnown: false, promoted: false, insideCase: false });
    const guidance = await control(value, 'LEARN_GUIDANCE');
    expect(guidance.action).toMatchObject({ enabled: true, cost: '1行动、100便士', command: GUIDANCE.command });
    expect(screen.queryByRole('dialog', { name: '空想家服药确认' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '返回当前生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    await openPreparation(); assertPanel(value, before);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    expect(hash(game.state)).toBe(beforeHash); expect(hash(before)).toBe(beforeHash);
  }, 60_000);

  it('reaches preparation from the actual Writer page and preserves all 25 old abilities, including exactly nine zero masteries', async () => {
    const before = original(), beforeHash = hash(before), game = savedGame(before);
    await mount(game);
    await userEvent.click(screen.getByRole('button', { name: '作家与原阅览处' }));
    expect(await screen.findByRole('region', { name: WRITER })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const value = projectSliceState(before).visionary, panel = assertPanel(value, before);
    await userEvent.click(within(panel).getByText('已掌握的能力', { selector: 'summary' }));
    expect(value.abilities).toHaveLength(25);
    expect(value.abilities.filter(ability => ability.mastery === 0)).toHaveLength(9);
    expect(value.abilities.map(ability => ability.id).sort()).toEqual(Object.keys(before.progression.mastery).sort());
    for (const ability of value.abilities) {
      expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    expect(value.abilities.some(ability => ability.id.startsWith('audience.s0.'))).toBe(false);
    expect(panel.textContent).not.toContain('有限空想支撑');
    expect(panel.textContent).not.toContain('待行心灵引导');
    expect(game.submit).not.toHaveBeenCalled(); expect(hash(game.state)).toBe(beforeHash);
  }, 60_000);

  it('commits actual guidance once for 100 pence and one action, immediately shows the new era and reopens that exact state', async () => {
    const before = original(), beforeHash = hash(before), game = savedGame(before);
    const expected = applySliceIntent(before, GUIDANCE), expectedHash = hash(expected);
    await mount(game); await openPreparation();
    const { button } = await control(projectSliceState(before).visionary, 'LEARN_GUIDANCE');
    await userEvent.click(button);
    await waitFor(() => expect(game.commits).toBe(1));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId,
      expectedRevision: before.revision, payload: GUIDANCE });
    expect(hash(game.state)).toBe(expectedHash);
    expect(game.state).toMatchObject({ revision: 661, cash: 300, actionsRemaining: 2,
      health: 100, mind: 100, spirituality: 120, progression: { sequence: 1 },
      visionary: { guidanceKnown: true, promotionWeek: null, journal: [] } });
    expect(game.state.visionary.source!.budget).toEqual(visionaryBudget(before));
    expect(game.state.random).toEqual(before.random); expect(game.state.progression).toEqual(before.progression);
    expect(game.state.lastCombatRound).toEqual(before.lastCombatRound);
    for (const key of VISIONARY_FROZEN_SOURCE_KEYS) expect(game.state[key]).toEqual(before[key]);
    const value = projectSliceState(game.state).visionary;
    assertPanel(value, game.state);
    expect(screen.getAllByRole('region', { name: '四方六城的真实时代事务' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '听取四方公共救援与原特性指导' })).toBeNull();
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
    const panel = assertPanel(projectSliceState(before).visionary, before), savedText = panel.textContent;
    const { button } = await control(projectSliceState(before).visionary, 'LEARN_GUIDANCE');
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
    expect([game.state.cash, game.state.actionsRemaining, game.state.revision]).toEqual([300, 2, 661]);
    expect(game.state.random).toEqual(before.random);
    expect(screen.queryByRole('button', { name: '重试这次操作' })).toBeNull();
    assertPanel(projectSliceState(game.state).visionary, game.state);
    expect(hash(before)).toBe(beforeHash);
  }, 60_000);

  it('blocks duplicate guidance and navigation while the actual commit response is pending', async () => {
    const before = original(), beforeHash = hash(before), expectedHash = hash(applySliceIntent(before, GUIDANCE));
    const game = savedGame(before), release = game.holdNextSave();
    await mount(game); await openPreparation();
    const panel = assertPanel(projectSliceState(before).visionary, before), savedText = panel.textContent;
    const { button } = await control(projectSliceState(before).visionary, 'LEARN_GUIDANCE');
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
    assertPanel(projectSliceState(game.state).visionary, game.state);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(hash(before)).toBe(beforeHash);
  }, 60_000);

  it('sends the first ordinary work with the VISIONARY wrapper and reopens only its real acknowledged resources and history', async () => {
    const before = guided(), beforeHash = hash(before), roots = visionaryHistoryDigest(before);
    const expectedHash = hash(applySliceIntent(before, WORK)), game = savedGame(before);
    await mount(game);
    const value = projectSliceState(before).visionary;
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
    expect(game.state.visionary.journal).toHaveLength(1);
    expect(game.state.visionary.journal[0]).toMatchObject({ command: WORK.command, randomReceipts: [] });
    expect(game.state.visionary.promotionWeek).toBeNull(); expect(game.state.progression.sequence).toBe(1);
    expect(visionaryHistoryDigest(game.state)).toBe(roots);
    assertPanel(projectSliceState(game.state).visionary, game.state);
    cleanup(); await mount(game);
    assertPanel(projectSliceState(game.state).visionary, game.state);
    const repeat = await control(projectSliceState(game.state).visionary, 'WORK');
    expect(repeat.action.enabled).toBe(false); fireEvent.click(repeat.button);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(hash(game.state)).toBe(expectedHash);
    expect(hash(before)).toBe(beforeHash);
  }, 60_000);

  it('reopens the separate actual 667-command death twice as read-only, with no Visionary start or revival', async () => {
    expect(readObjectEntry<SliceIntent[]>(`${ROOT}/natural.json`, 'commands')).toHaveLength(667);
    const raw = readObjectEntry<unknown>(`${ROOT}/natural.json`, 'final');
    expect(raw).toMatchObject({ schemaVersion: 185, contentVersion: 'writer-v185' });
    const dead = migrateSliceState(raw); assertValidSliceState(dead);
    expect(dead).toMatchObject({ revision: 668, status: 'DEAD', health: 0, week: 144, combat: null,
      random: { seed: 'audience-rebuild-first', cursor: 537 },
      writer: { encounter: { terminal: { outcome: 'PLAYER_DEAD', round: 5 } } },
      visionary: { guidanceKnown: false, source: null, promotionWeek: null, journal: [] } });
    const beforeHash = hash(dead), game = savedGame(dead), value = projectSliceState(dead);
    for (let opening = 0; opening < 2; opening++) {
      await mount(game);
      const round = screen.getByRole('dialog', { name: '战斗回合结果' });
      expect(round.textContent).toContain(value.lastCombatRound!.consequence);
      expect(within(round).getByRole('region', { name: '作家本回合实际记录' })).toBeTruthy();
      await userEvent.click(within(round).getByRole('button', { name: '查看收尾卷宗' }));
      const ending = await screen.findByRole('heading', { name: value.ending!.title });
      expect(screen.getByText('只读封存卷宗')).toBeTruthy();
      expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
      expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
      expect(screen.queryByRole('button', { name: '听取四方公共救援与原特性指导' })).toBeNull();
      expect(screen.queryByRole('button', { name: /非凡成长|空想家晋升|继续生活|复起|复活/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
      await userEvent.click(within(ending.parentElement!).getByRole('button', { name: '返回标题' }));
      expect(disabled(await screen.findByRole('button', { name: /继续游戏/ }))).toBe(true);
      expect(disabled(screen.getByRole('button', { name: /查看封存/ }))).toBe(false);
      expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
      expect(hash(game.state)).toBe(beforeHash); expect(hash(dead)).toBe(beforeHash);
      cleanup();
    }
  }, 60_000);
});
