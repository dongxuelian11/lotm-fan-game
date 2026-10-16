/* @vitest-environment jsdom */
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { DiscernerPanel } from '../../src/renderer/DiscernerPanel';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { DiscernerCommand } from '../../src/domain/discerner/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';

export interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
const ROOT = 'tests/fixtures/discerner-v01660';
// Read just one original snapshot at a time. The 36 MB boundary file must not be
// imported or decoded wholesale in a 512 MiB renderer worker.
export function naturalEntry<T = unknown>(name: string): T { return readObjectEntry<T>(`${ROOT}/natural.json`, name); }
export function boundary(name: string): Boundary { return readObjectEntry<Boundary>(`${ROOT}/boundaries.json`, name); }
export const NAVIGATION_BOUNDARIES = ['clinic-discovery', 'clinic-pay60', 'clinic-later-rest', 'guidance', 'preparation-plan_withdrawal', 'potion-work-5', 'buy-independent-potion', 'prepare-current-week', 'consume-failure', 'promotion'] as const;
export const LIFE_BOUNDARIES = ['present-mark-formed', 'present-mark-ability-outcome', 'present-mark-card-taken', 'present-mark-checked', 'present-mark-returned', 'covered-mark-seal', 'covered-mark-ability-outcome', 'withdrawn-mark-revoked', 'withdrawn-mark-closed', 'reflection'] as const;
export const COMBAT_BOUNDARIES = ['combat-start', 'combat-first', 'combat-terminal', 'aid-enemy', 'ordinary-life-after-exit'] as const;
export function capturedCommand(captured: Boundary): DiscernerCommand {
  if (captured.lastIntent.type !== 'DISCERNER') throw new Error('Expected an actual Discerner command.');
  return captured.lastIntent.command;
}
export function savedGame(input: unknown, options: { failFirstSave?: boolean; deferFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0;
  assertValidSliceState(state);
  let releaseFirstSave = () => {};
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original run already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '本次原操作尚未保存', retryable: true } };
    state = applySliceIntent(state, envelope.payload);
    assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-13T23:20:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
export type SavedGame = ReturnType<typeof savedGame>;
export async function acknowledgeSavedRound() {
  const result = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (result) await userEvent.click(within(result).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
export async function continueRun(game: SavedGame) {
  const state = projectSliceState(game.state);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('region', { name: '洞察者' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  // Old S3 history stays saved; it must not reopen as the current S2 outcome.
  if (state.discerner.promoted && state.lastCombatRound && !state.lastCombatRound.discernerOutcome) {
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole('heading', { name: state.ending.title });
  else if (state.combat) await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" });
  else if (state.discerner.insideCase) await screen.findByRole('region', { name: '洞察者' });
  else await screen.findByRole('heading', { name: '人物卷宗' });
}
export async function mountGame(game: SavedGame, openDiscerner = true) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-13T23:19:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await continueRun(game);
  if (openDiscerner && !state.ending && !state.combat && !screen.queryByRole('region', { name: '洞察者' })) {
    await userEvent.click(screen.getByRole('button', { name: '洞察者与有限印记' }));
    await screen.findByRole('region', { name: '洞察者' });
  }
}
export function actionButton(state: SliceState, command: DiscernerCommand): HTMLButtonElement {
  const action = projectSliceState(state).discerner.actions.find(entry =>
    Object.entries(command).every(([key, value]) => (entry.command as unknown as Record<string, unknown>)[key] === value));
  if (!action) throw new Error(`Missing public Discerner action: ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement;
}
export async function selectCommandObject(command: DiscernerCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '选择独立洞察者原瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  if ('caseId' in command) {
    const select = screen.queryByRole('combobox', { name: '选择洞察者生活情境' }) as HTMLSelectElement | null;
    if (select && !select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
}
export async function commandControl(state: SliceState, command: DiscernerCommand) {
  await selectCommandObject(command);
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
export async function clickCommand(game: SavedGame, command: DiscernerCommand) {
  const button = await commandControl(game.state, command);
  expect(button.disabled).toBe(false);
  await userEvent.click(button);
  await settled();
}
export async function settled() {
  await waitFor(() => expect(screen.getByRole('region', { name: '洞察者' }).getAttribute('aria-busy')).toBe('false'));
}
export function assertLegacyPreserved(before: SliceState, after: SliceState) {
  expect(after.character.gender).toBe(before.character.gender);
  expect(after.random.seed).toBe(before.random.seed);
  for (const key of ['audience', 'mindreader', 'psychologist', 'hypnotist', 'dreamwalker', 'manipulator', 'dreamWeaver'] as const) expect(after[key]).toEqual(before[key]);
}
export function assertSavedEnvelope(game: SavedGame, before: SliceState, payload: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload });
}
export function renderBoundaryProjection(name: string) {
  const state = migrateSliceState(boundary(name).final), before = structuredClone(state), value = projectSliceState(state).discerner;
  const onCommand = vi.fn(), onClose = vi.fn();
  render(<DiscernerPanel value={value} busy={false} blocked={state.status !== 'ACTIVE' || !!state.combat} onCommand={onCommand} {...(!value.insideCase ? { onClose } : {})}/>);
  const panel = screen.getByRole('region', { name: '洞察者' });
  expect(panel.textContent).toContain(value.title);
  const resources = screen.getByRole('region', { name: '洞察者当前资源' });
  expect(resources.textContent).toContain(`${state.health} / 100`);
  expect(resources.textContent).toContain(`${state.mind} / 100`);
  expect(resources.textContent).toContain(`${state.spirituality} / 120`);
  expect(resources.textContent).toContain(`${state.cash}便士`);
  expect(panel.textContent).toContain(value.digestion);
  for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握 ${ability.mastery}`);
  const practice = value.life.practice;
  if (practice && !value.encounter.inside) {
    expect(panel.textContent).toContain(`本人在${practice.ownerNode === 'NEAR' ? '原近桌' : '原远桌'}`);
    for (const card of Object.values(practice.cards)) {
      expect(panel.textContent).toContain(card.id);
      if (card.marking !== undefined) expect(panel.textContent).toContain(card.marking);
    }
    if (!value.encounter.inside) expect(screen.getByRole('region', { name: '原保护封签' }).textContent).toContain(`剩余额度 ${practice.seal.charges}`);
  }
  expect(state).toEqual(before);
  expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
}
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShowModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
