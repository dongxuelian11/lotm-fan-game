/* @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  wisdomAngelSnapshot, wisdomAngelBoundary, wisdomAngelBoundaryNames, wisdomAngelBoundaryForIntent,
  wisdomAngelFixturePath, type WisdomAngelBoundary,
} from '../domain/wisdom-angel-helper.js';
import { SliceApp } from '../../src/renderer/SliceApp';
import { WisdomAngelPanel } from '../../src/renderer/WisdomAngelPanel';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { WisdomAngelCommand } from '../../src/domain/wisdom-angel/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';

export type Boundary = WisdomAngelBoundary;
export const snapshot = wisdomAngelSnapshot;
export const boundary = wisdomAngelBoundary;
export const boundaryForIntent = wisdomAngelBoundaryForIntent;
export const boundaryNames = (pattern: RegExp = /.*/) => wisdomAngelBoundaryNames().filter(name => pattern.test(name));
// Stream one field, never aggregate all full-state natural or boundary captures.
export const naturalEntry = <T,>(name: string): T => readObjectEntry<T>(wisdomAngelFixturePath, name);
export const NEW_IDS = ['reader.s2.conditional-synthesis', 'reader.s2.observed-response'] as const;
export const PANEL = '智慧天使有限切片';
export const ENTRY = '智慧天使与条件验证';
export const PREPARATION_ENTRY = '查看智慧天使准备';
export const CONFIRM_TYPES = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'SYNTHESIS', 'RESPONSE', 'FIRST_DEMONSTRATION', 'SECOND_DEMONSTRATION', 'SWITCH_FILTER', 'ENCOUNTER_FIGHT', 'MAKE_INHERITED_FLASH']);
export const requiresConfirmation = (command: WisdomAngelCommand) => CONFIRM_TYPES.has(command.type);
export const confirmationName = (command: WisdomAngelCommand) => command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次真实消耗与风险';
export const confirmLabel = (command: WisdomAngelCommand) => command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作';
export const view = (state: SliceState) => projectSliceState(state).wisdomAngel;
export function capturedCommand(captured: Boundary): WisdomAngelCommand {
  if (captured.lastIntent.type !== 'WISDOM_ANGEL') throw new Error('Expected a recorded public WisdomAngel command.');
  return captured.lastIntent.command;
}
export function commandBoundary(type: WisdomAngelCommand['type'], accept?: (captured: Boundary) => boolean): Boundary {
  return boundaryForIntent(intent => intent.type === 'WISDOM_ANGEL' && intent.command.type === type, accept);
}
export function savedGame(input: unknown, options: { failFirstSave?: boolean; deferFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0;
  assertValidSliceState(state);
  let releaseFirstSave = () => {};
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '本次原操作尚未保存', retryable: true } };
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-14T02:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
export type SavedGame = ReturnType<typeof savedGame>;
export async function acknowledgeSavedRound() {
  const result = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (result) await userEvent.click(within(result).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
export async function mountGame(game: SavedGame, openPanel = true, recoveryNotice?: string) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: recoveryNotice ? 'desktop' : 'browser', ...(recoveryNotice ? { recoveryNotice } : {}), activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-14T01:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  if (recoveryNotice) await screen.findByText(recoveryNotice);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  // Old Harold/Alton rounds remain history; current S2 must not reopen their result overlay.
  if (state.wisdomAngel.promoted && state.lastCombatRound && !state.lastCombatRound.wisdomAngelOutcome) {
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }
  await acknowledgeSavedRound();
  if (state.ending) { await screen.findByRole('heading', { name: state.ending.title }); return; }
  if (state.combat) { await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" }); return; }
  if (state.wisdomAngel.insideCase) { await screen.findByRole('region', { name: PANEL }); return; }
  await screen.findByRole('heading', { name: '人物卷宗' });
  if (openPanel) { await userEvent.click(screen.getByRole('button', { name: ENTRY })); await screen.findByRole('region', { name: PANEL }); }
}
export function wisdomButtons(state: SliceState, command: WisdomAngelCommand): HTMLButtonElement[] {
  const action = view(state).actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public Wisdom Angel command: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement[];
}
export function actionButton(state: SliceState, command: WisdomAngelCommand): HTMLButtonElement {
  // The main control is last, after the optional next-step shortcut, and owns return focus.
  return wisdomButtons(state, command).at(-1)!;
}
export async function commandControl(state: SliceState, command: WisdomAngelCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  if ('caseId' in command) {
    const select = screen.queryByRole('combobox', { name: '查看实践' }) as HTMLSelectElement | null;
    if (select && !select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
  return actionButton(state, command);
}
export async function settled() {
  await waitFor(() => expect(screen.getByRole('region', { name: PANEL }).getAttribute('aria-busy')).toBe('false'));
}
export async function clickCommand(game: SavedGame, command: WisdomAngelCommand) {
  const revision = game.state.revision, control = await commandControl(game.state, command);
  expect(control.disabled).toBe(false); await userEvent.click(control);
  if (requiresConfirmation(command)) await userEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
  await waitFor(() => expect(game.state.revision).toBe(revision + 1));
  if (screen.queryByRole('region', { name: PANEL })) await settled();
}
export async function submitCapturedRound(game: SavedGame, intent: SliceIntent) {
  if (intent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual captured combat-round command.');
  const battle = projectSliceState(game.state).combat;
  if (!battle) throw new Error('The actual saved state has no active battle.');
  const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
  const stance = battle.stances.find(entry => entry.id === intent.stance);
  if (!stance) throw new Error('The captured stance is not publicly available.');
  await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
  await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
  return screen.findByRole('dialog', { name: '战斗回合结果' });
}
export function assertLegacyPreserved(before: SliceState, after: SliceState, options: { combat?: boolean } = {}) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed);
  expect(after.character.gender).toBe(before.character.gender);
  for (const key of ['reader', 'reasoner', 'detective', 'polymath', 'prophet', 'insightScholar'] as const) expect(after[key]).toEqual(before[key]);
  const currentMagister = structuredClone(after.mysticismMagister);
  if (options.combat) {
    const consumed = after.combatHistory.slice(before.combatHistory.length).flatMap(round => round.wisdomAngelOutcome?.consumedCraftIds ?? []);
    expect(currentMagister.crafts).toHaveLength(before.mysticismMagister.crafts.length);
    for (const [index, craft] of currentMagister.crafts.entries()) {
      const old = before.mysticismMagister.crafts[index]!;
      if (consumed.includes(craft.id)) {
        expect(old.status).toBe('PLAYER'); expect(craft.status).toBe('CONSUMED'); expect(craft.usedWeek).toBe(after.week);
        craft.status = old.status; craft.usedWeek = old.usedWeek;
      }
      expect(craft).toEqual(old);
    }
  }
  expect(currentMagister).toEqual(before.mysticismMagister);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) if (!NEW_IDS.includes(id as typeof NEW_IDS[number])) expect(after.progression.mastery[id]).toBe(mastery);
}
export function assertSavedEnvelope(game: SavedGame, before: SliceState, payload: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload });
}
export function renderBoundaryProjection(captured: Boundary) {
  const state = migrateSliceState(captured.final), before = structuredClone(state), value = view(state), onCommand = vi.fn(), onClose = vi.fn();
  render(<WisdomAngelPanel value={value} busy={false} blocked={state.status !== 'ACTIVE' || !!state.combat} onCommand={onCommand} {...(!value.insideCase ? { onClose } : {})}/>);
  const panel = screen.getByRole('region', { name: PANEL });
  expect(panel.textContent).toContain(value.title); expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
  const warning = within(panel).getByText('晋升须取得独立成品并完成专业准备。下一序列1尚未开放；判断仍须依据当前实际资料。');
  expect(warning.closest('details')).toBeNull();
  const resources = screen.getByRole('region', { name: '智慧天使当前资源' }); expect(resources.closest('details')).toBeNull();
  for (const text of [`${state.health}/100`, `${state.mind}/100`, `${state.spirituality}/120`, value.resources!.cash]) expect(resources.textContent).toContain(text);
  const risk = within(panel).getByText(value.risk); expect(risk.closest('details')).toBeNull();
  expect(risk.textContent).toContain('治疗仍须真实发现诊所、支付实际费用并后续休养');
  expect(value.currentGender).toBe(state.character.gender);
  if (value.promoted) for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
  expect(state).toEqual(before); expect(onCommand).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
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
