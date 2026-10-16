/* @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { concealmentServantSnapshot, concealmentServantBoundary, concealmentServantBoundaryNames } from '../domain/concealment-servant-test-fixture';
import { SliceApp } from '../../src/renderer/SliceApp';
import { ConcealmentServantPanel } from '../../src/renderer/ConcealmentServantPanel';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { ConcealmentServantCommand } from '../../src/domain/concealment-servant/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';

export interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
export const snapshot = concealmentServantSnapshot;
export const boundary = (name: string): Boundary => concealmentServantBoundary(name);
export const boundaryNames = (pattern: RegExp) => concealmentServantBoundaryNames().filter(name => pattern.test(name));
// Stream a selected scalar/list only. Never parse the full natural campaign file.
export const naturalEntry = <T,>(name: string): T => readObjectEntry<T>('tests/fixtures/concealment-servant-v01690/natural.json', name);
export const NEW_IDS = ['darkness.s2.bounded-concealment', 'darkness.s2.trace-veil'] as const;
export const CASES = ['consented-box', 'withdrawn-consent', 'blocked-door'] as const;
export const PANEL = '隐秘之仆有限切片';
export const ENTRY = '隐秘之仆与原门返回';
export const CONFIRM_TYPES = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'CONCEAL', 'TRACE_VEIL', 'BLOCK_DOOR', 'LIGHT_ANCHOR', 'ENCOUNTER_FIGHT']);
export const requiresConfirmation = (command: ConcealmentServantCommand) => CONFIRM_TYPES.has(command.type);
export const confirmationName = (command: ConcealmentServantCommand) => command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次真实消耗与风险';
export const confirmLabel = (command: ConcealmentServantCommand) => command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作';
export const view = (state: SliceState) => projectSliceState(state).concealmentServant;
export function capturedCommand(captured: Boundary): ConcealmentServantCommand {
  if (captured.lastIntent.type !== 'CONCEALMENT_SERVANT') throw new Error('Expected a recorded public ConcealmentServant command.');
  return captured.lastIntent.command;
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
      committedAt: '2026-10-14T01:00:00Z', replayed: false, state: projectSliceState(state) } };
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
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-14T00:59:00Z',
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
  // A retained Harlan result is historical. Loading current S2 cannot reopen it.
  if (state.concealmentServant.promoted && state.lastCombatRound && !state.lastCombatRound.concealmentServantOutcome) {
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }
  await acknowledgeSavedRound();
  if (state.ending) { await screen.findByRole('heading', { name: state.ending.title }); return; }
  if (state.combat) { await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" }); return; }
  if (state.concealmentServant.insideCase) { await screen.findByRole('region', { name: PANEL }); return; }
  await screen.findByRole('heading', { name: '人物卷宗' });
  if (openPanel) { await userEvent.click(screen.getByRole('button', { name: ENTRY })); await screen.findByRole('region', { name: PANEL }); }
}
export function actionButton(state: SliceState, command: ConcealmentServantCommand): HTMLButtonElement {
  const action = view(state).actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public command: ${JSON.stringify(command)}`);
  // The next-step shortcut repeats one main control. The main control is last,
  // which is also the panel's recorded focus-return target for the action ID.
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1) as HTMLButtonElement;
}
export async function commandControl(state: SliceState, command: ConcealmentServantCommand) {
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
export async function clickCommand(game: SavedGame, command: ConcealmentServantCommand) {
  const before = game.state.revision, button = await commandControl(game.state, command);
  expect(button.disabled).toBe(false); await userEvent.click(button);
  if (requiresConfirmation(command)) await userEvent.click(within(screen.getByRole('dialog', { name: confirmationName(command) })).getByRole('button', { name: confirmLabel(command) }));
  await waitFor(() => expect(game.state.revision).toBe(before + 1));
  if (screen.queryByRole('region', { name: PANEL })) await settled();
}
export function assertLegacyPreserved(before: SliceState, after: SliceState, options: { combat?: boolean } = {}) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed);
  expect(after.character.gender).toBe(before.character.gender);
  for (const key of ['sleepless', 'midnight', 'nightmare', 'soother', 'nightwatcher', 'fearBishop'] as const) expect(after[key]).toEqual(before[key]);
  const spirit = structuredClone(after.spiritWarlock), old = before.spiritWarlock.companion;
  if (options.combat) {
    expect(spirit.companion.source).toBe(old.source);
    expect(spirit.companion.deployments - old.deployments).toBe(spirit.companion.recalls - old.recalls);
    expect(spirit.companion.status).toBe(old.status);
    spirit.companion.deployments = old.deployments; spirit.companion.recalls = old.recalls;
  }
  expect(spirit).toEqual(before.spiritWarlock);
  for (const [id, mastery] of Object.entries(before.progression.mastery)) if (!NEW_IDS.includes(id as typeof NEW_IDS[number])) expect(after.progression.mastery[id]).toBe(mastery);
}
export function assertSavedEnvelope(game: SavedGame, before: SliceState, payload: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload });
}
export function renderBoundaryProjection(name: string) {
  const state = migrateSliceState(boundary(name).final), before = structuredClone(state), value = view(state), onCommand = vi.fn(), onClose = vi.fn();
  render(<ConcealmentServantPanel value={value} busy={false} blocked={state.status !== 'ACTIVE' || !!state.combat} onCommand={onCommand} {...(!value.insideCase ? { onClose } : {})}/>);
  const panel = screen.getByRole('region', { name: PANEL });
  expect(panel.textContent).toContain(value.title);
  const warning = within(panel).getByText('晋升须取得独立成品并完成专业准备。本阶段的隐秘与遮踪均有范围、时限和消耗，具体条件见下方。');
  expect(warning.closest('details')).toBeNull();
  expect(panel.textContent).toContain('隐秘之仆的完整配方与晋升仪式仍未知：材料、用量、调配顺序及仪式要求尚未掌握，仍须完成服药准备。');
  expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
  const resources = screen.getByRole('region', { name: '隐秘之仆当前资源' });
  expect(resources.closest('details')).toBeNull();
  for (const text of [`${state.health}/100`, `${state.mind}/100`, `${state.spirituality}/120`, value.resources!.cash]) expect(resources.textContent).toContain(text);
  const risk = within(panel).getByText(value.risk); expect(risk.closest('details')).toBeNull();
  expect(risk.textContent).toContain('旧伤护理须真实发现诊所、支付实际医疗费用并后续休养');
  expect(value.currentGender).toBe(state.character.gender);
  if (value.promoted) {
    const room = screen.getByRole('region', { name: '原房间当前状态' });
    for (const text of [value.life.room.id, value.life.room.doorId, value.life.box.id, value.life.page.id, '原艾琳38岁、存活']) expect(room.textContent).toContain(text);
    expect(value.life.erin).toEqual(state.concealmentServant.life.erin); expect(value.life.page).toEqual(state.concealmentServant.life.page);
    const current = value.life.currentAttempt;
    if (current) for (const [name, use] of [['有限房间隐秘', current.concealment], ['有限遮踪', current.traceVeil]] as const) {
      expect(room.textContent).toContain(`${name}：尝试${use.attempts} / 检定成功${use.successes} / 实际应用${use.effects}`);
      expect(room.textContent).toContain(`余${use.remainingSeconds}秒`);
    }
    for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
  }
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
