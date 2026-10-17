/* @vitest-environment jsdom */
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { KnowledgeMentorPanel } from '../../src/renderer/KnowledgeMentorPanel';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { KnowledgeMentorCommand } from '../../src/domain/knowledge-mentor/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';

export interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
const ROOT = 'tests/fixtures/knowledge-mentor-v01670';
// Read just one original snapshot at a time. The 84 MB boundary file must not be
// imported or decoded wholesale in a 512 MiB renderer worker.
export function naturalEntry<T = unknown>(name: string): T { return readObjectEntry<T>(`${ROOT}/natural.json`, name); }
export function boundary(name: string): Boundary { return readObjectEntry<Boundary>(`${ROOT}/boundaries.json`, name); }
// The manifest is a small index. Conditional captures (failed bottles, program
// starts and calibration) exist only if the actual natural branch reached them.
export interface BoundaryIndex { key: string; commandIndex: number; revision: number; path: string }
export const boundaryIndex = () => naturalEntry<BoundaryIndex[]>('boundaryManifest');
export const boundaryNames = (pattern: RegExp) => boundaryIndex().filter(entry => pattern.test(entry.key)).map(entry => entry.key);
export const NEW_IDS = ['paragon.s2.protocol-binding', 'paragon.s2.bounded-calibration'] as const;
export const CASES = ['documented-cycle', 'consented-transfer', 'blocked-cycle'] as const;
export const PANEL = '知识导师';
export const ENTRY = '知识导师与有限工序';
export const CONFIRM_TYPES = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'BUY_PLATE', 'BIND_PLATE', 'START_PROGRAM', 'PLACE_STOP_BAR', 'CALIBRATE', 'RECHARGE', 'PREPARE_COMBAT_PLATE', 'ENCOUNTER_FIGHT']);
export const view = (state: SliceState) => projectSliceState(state).knowledgeMentor;
/** Reconstruct an uncaptured input from the nearest earlier real boundary and
 * the recorded public commands only. No RNG rewrite or private-state editing. */
export function naturalCommandBoundary(command: KnowledgeMentorCommand): Boundary {
  const commands = naturalEntry<SliceIntent[]>('commands');
  const prefixCount = naturalEntry<number>('prefixCount');
  const index = commands.findIndex((intent, i) => i >= prefixCount
    && intent.type === 'KNOWLEDGE_MENTOR' && JSON.stringify(intent.command) === JSON.stringify(command));
  if (index < 0) throw new Error(`Missing actual natural command: ${JSON.stringify(command)}`);
  const preceding = boundaryIndex().filter(entry => entry.commandIndex <= index).at(-1);
  if (!preceding) throw new Error('No actual preceding save boundary.');
  let state = migrateSliceState(boundary(preceding.key).final);
  for (const intent of commands.slice(preceding.commandIndex, index)) state = applySliceIntent(state, intent);
  assertValidSliceState(state);
  const lastIntent = commands[index]!;
  const final = applySliceIntent(state, lastIntent); assertValidSliceState(final);
  return { beforeLast: state, lastIntent, final };
}
export function capturedCommand(captured: Boundary): KnowledgeMentorCommand {
  if (captured.lastIntent.type !== 'KNOWLEDGE_MENTOR') throw new Error('Expected an actual KnowledgeMentor command.');
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
    ?? screen.queryByRole('region', { name: '知识导师' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  // Old S3 history stays saved; it must not reopen as the current S2 outcome.
  if (state.knowledgeMentor.promoted && state.lastCombatRound && !state.lastCombatRound.knowledgeMentorOutcome) {
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole('heading', { name: state.ending.title });
  else if (state.combat) await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" });
  else if (state.knowledgeMentor.insideCase) await screen.findByRole('region', { name: '知识导师' });
  else await screen.findByRole('heading', { name: '人物卷宗' });
}
export async function mountGame(game: SavedGame, openKnowledgeMentor = true, recoveryNotice?: string) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: recoveryNotice ? 'desktop' : 'browser', ...(recoveryNotice ? { recoveryNotice } : {}), activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-13T23:19:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  if (recoveryNotice) await screen.findByText(recoveryNotice);
  await continueRun(game);
  if (openKnowledgeMentor && !state.ending && !state.combat && !screen.queryByRole('region', { name: '知识导师' })) {
    await userEvent.click(screen.getByRole('button', { name: '知识导师与有限工序' }));
    await screen.findByRole('region', { name: '知识导师' });
  }
}
export function actionButton(state: SliceState, command: KnowledgeMentorCommand): HTMLButtonElement {
  const action = projectSliceState(state).knowledgeMentor.actions.find(entry =>
    JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public KnowledgeMentor action: ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement;
}
export async function selectCommandObject(command: KnowledgeMentorCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '选择知识导师原瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  if ('caseId' in command) {
    const select = screen.queryByRole('combobox', { name: '选择知识导师生活情境' }) as HTMLSelectElement | null;
    if (select && !select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
}
export async function commandControl(state: SliceState, command: KnowledgeMentorCommand) {
  await selectCommandObject(command);
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
export async function clickCommand(game: SavedGame, command: KnowledgeMentorCommand) {
  const button = await commandControl(game.state, command);
  expect(button.disabled).toBe(false);
  await userEvent.click(button);
  if (CONFIRM_TYPES.has(command.type)) {
    const review = screen.getByRole('dialog', { name: command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次实际消耗与风险' });
    await userEvent.click(within(review).getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作' }));
  }
  await waitFor(() => expect(screen.queryAllByText('正在结算并保存这一原操作，请稍候。')).toHaveLength(0));
}
export async function settled() {
  await waitFor(() => expect(screen.getByRole('region', { name: '知识导师' }).getAttribute('aria-busy')).toBe('false'));
}
export function assertLegacyPreserved(before: SliceState, after: SliceState) {
  expect(after.character.gender).toBe(before.character.gender);
  expect(after.random.seed).toBe(before.random.seed);
  for (const key of ['savant', 'archaeologist', 'appraiser', 'artisan', 'astronomer', 'arcaneScholar'] as const) expect(after[key]).toEqual(before[key]);
  const old = structuredClone(before.alchemist), current = structuredClone(after.alchemist);
  expect(current.life.creations.map(o => o.id)).toEqual(old.life.creations.map(o => o.id));
  for (const original of current.life.creations) {
    const prior = old.life.creations.find(o => o.id === original.id)!;
    for (const key of ['charge', 'durability', 'location', 'active'] as const) Object.assign(original, { [key]: prior[key] });
  }
  expect(current).toEqual(old);
}
export function assertSavedEnvelope(game: SavedGame, before: SliceState, payload: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload });
}
export function renderBoundaryProjection(name: string) {
  const state = migrateSliceState(boundary(name).final), before = structuredClone(state), value = view(state);
  const onCommand = vi.fn(), onClose = vi.fn();
  render(<KnowledgeMentorPanel value={value} busy={false} blocked={state.status !== 'ACTIVE' || !!state.combat} onCommand={onCommand} {...(!value.insideCase ? { onClose } : {})}/>);
  const panel = screen.getByRole('region', { name: PANEL });
  expect(panel.textContent).toContain(value.title);
  const warning = within(panel).getByText('本阶段开放有限工序。');
  expect(warning.closest('details')).toBeNull();
  expect(panel.textContent).toContain('晋升须取得独立成品并完成专业准备；工序的持续时间、成本与奖励见下方。');
  expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
  if (value.story) expect(panel.textContent).toContain("知识导师为通识者序列2。当前渠道只提供成品魔药，不提供完整配方；服用前须完成专业准备。本阶段使用明确专业支持、独立序列2原瓶与实际准备，不重复炼金术士抽取原园生命的旧仪式。");
  const resources = screen.getByRole('region', { name: '知识导师当前资源' });
  for (const amount of [`${state.health} / 100`, `${state.mind} / 100`, `${state.spirituality} / 120`, value.resources!.cash]) expect(resources.textContent).toContain(amount);
  expect(panel.textContent).toContain(value.digestion);
  if (value.promoted) {
    for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    for (const original of value.life.creations) {
      const facts = screen.getByRole('region', { name: '知识导师唯一原造物' });
      expect(facts.textContent).toContain(original.id);
      expect(facts.textContent).toContain(`储能 ${original.charge}/3 · 耐久 ${original.durability}/100`);
    }
    const a = value.life.currentAttempt;
    if (a && !value.encounter.inside) {
      const facts = screen.getByRole('region', { name: '本次原片与实际工序' });
      if (a.plate) expect(facts.textContent).toContain(a.plate.id);
      expect(facts.textContent).toContain(`三步完成${a.completedSteps}/3，其中程序执行${a.automaticSteps}步`);
      expect(facts.textContent).toContain(`已付 ${a.paidPennies} 便士、${a.spiritualitySpent} 灵性`);
      expect(facts.textContent).toContain(`原盒储能−${a.boxChargeSpent}、原架储能−${a.frameChargeSpent}、原架耐久−${a.frameDurabilityLost}`);
      for (const step of a.stepHistory) expect(facts.textContent).toContain(step);
    }
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
