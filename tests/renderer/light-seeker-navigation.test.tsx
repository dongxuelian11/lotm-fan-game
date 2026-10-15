/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { LightSeekerCommand } from '../../src/domain/light-seeker/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { LIGHT_SEEKER_ENEMY_ABILITY_WHEEL, LIGHT_SEEKER_ENEMY_COUNT_WHEEL } from '../../src/domain/light-seeker/combat';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  lightSeekerSnapshot as snapshot, lightSeekerBoundary as boundary, lightSeekerBoundaryForIntent as boundaryForIntent,
  lightSeekerFixturePath, justiceMentorFixturePath, sunLegacyKeys, type LightSeekerBoundary,
} from '../domain/light-seeker-helper';

const PANEL = '逐光者有限切片', ENTRY = '逐光者与采光廊';
const view = (state: SliceState) => projectSliceState(state).lightSeeker;
function commandOf(captured: LightSeekerBoundary): LightSeekerCommand {
  if (captured.lastIntent.type !== 'LIGHT_SEEKER') throw new Error('Expected a recorded LightSeeker command.');
  return captured.lastIntent.command;
}
function commandBoundary(type: LightSeekerCommand['type']) {
  return boundaryForIntent(intent => intent.type === 'LIGHT_SEEKER' && intent.command.type === type);
}
function savedGame(input: unknown, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
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
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-14T03:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mountGame(game: SavedGame, openPanel = false) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{ runId: state.runId,
      name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
      status: state.status, revision: state.revision, updatedAt: '2026-10-14T02:59:00Z' }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp/>);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' }) ?? screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  if (state.lightSeeker.promoted && state.lastCombatRound && !state.lastCombatRound.lightSeekerOutcome) expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  const oldReveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (oldReveal) await userEvent.click(within(oldReveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
  if (state.ending) { await screen.findByRole('heading', { name: state.ending.title }); return; }
  if (state.combat) { await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" }); return; }
  if (state.lightSeeker.insideCase) { await screen.findByRole('region', { name: PANEL }); return; }
  await screen.findByRole('heading', { name: '人物卷宗' });
  if (openPanel) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
}
function actionButton(state: SliceState, command: LightSeekerCommand) {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: LightSeekerCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看药瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
const confirmName = (command: LightSeekerCommand) => command.type === 'CONSUME' ? '独立确认服用这一药瓶' : '确认本次消耗与风险';
const confirmLabel = (command: LightSeekerCommand) => command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作';
function assertLegacy(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed); expect(after.character.gender).toBe(before.character.gender);
  for (const key of sunLegacyKeys) expect(after[key]).toEqual(before[key]);
  for (const [id, value] of Object.entries(before.progression.mastery)) if (!id.startsWith('sun.s2.')) expect(after.progression.mastery[id]).toBe(value);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
function playerCopy(node: HTMLElement) {
  expect(node.textContent).not.toMatch(/未核实候选|候选G|名称编号待核|原文核验|原著|原创G|本作G|(?<![A-Za-z0-9_.-])G(?=\d)|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])|\dG(?=[\s，；。、：）)\/×%\u3400-\u9fff])/);
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('LightSeeker navigation with actual public saves',()=>{
 it('opens the new preparation from the living582 source and keeps all saved facts',async()=>{
  const game=savedGame(snapshot('departureStart')),before=structuredClone(game.state);await mountGame(game);await userEvent.click(screen.getByRole('button',{name:ENTRY}));
  const panel=screen.getByRole('region',{name:PANEL});playerCopy(panel);expect(panel.textContent).toContain('逐光者');expect(game.state).toEqual(before);expect(game.submit).not.toHaveBeenCalled();
 },20000);
 it.each(['promoted','practiced']as const)('routes currentS2 %s growth to20 real inherited skills',async key=>{
  const game=savedGame(snapshot(key));await mountGame(game);await userEvent.click(screen.getByRole('button',{name:/非凡成长/}));const panel=screen.getByRole('region',{name:PANEL});playerCopy(panel);
  expect(view(game.state).abilities).toHaveLength(20);for(const a of view(game.state).abilities)expect(panel.textContent).toContain(a.label);expect(game.submit).not.toHaveBeenCalled();
 },20000);
 it('submits the independent confirmed bottle once and preserves failed natural outcome',async()=>{
  const b=commandBoundary('CONSUME'),game=savedGame(b.beforeLast);await mountGame(game);const button=await control(game.state,commandOf(b));await userEvent.click(button);expect(game.submit).not.toHaveBeenCalled();
  const dialog=screen.getByRole('dialog',{name:confirmName(commandOf(b))});await userEvent.click(within(dialog).getByRole('button',{name:confirmLabel(commandOf(b))}));await waitFor(()=>expect(game.state).toEqual(b.final));assertEnvelope(game,b.beforeLast,b.lastIntent);assertLegacy(b.beforeLast,game.state);
 },20000);
 it('renders actual light/shutter combat wheels and physical consequence category',async()=>{
  const game=savedGame(snapshot('combatStart'));await mountGame(game);const panel=screen.getByRole('dialog',{name:projectSliceState(game.state).combat!.title ?? "普通人追击"});expect(panel.textContent).toContain('欧文');expect(screen.getByRole('region',{name:'逐光者本回合实际资源'}).textContent).toContain('遮板');
  expect(projectSliceState(game.state).combat!.enemyAbilityWheel).toEqual(LIGHT_SEEKER_ENEMY_ABILITY_WHEEL);expect(projectSliceState(game.state).combat!.enemyCountWheel).toEqual(LIGHT_SEEKER_ENEMY_COUNT_WHEEL);expect(game.submit).not.toHaveBeenCalled();
 },20000);
 it('returns to ordinary life with actual surviving wounds, no fabricated healing',async()=>{
  const game=savedGame(snapshot('final'));await mountGame(game);expect(game.state.status).toBe('ACTIVE');expect(game.state.health).toBe(50);expect(game.state.injuries).toHaveLength(3);expect(screen.getByRole('region',{name:'伤势与恢复路线'}).textContent).toContain('查看普通诊疗点');expect(game.submit).not.toHaveBeenCalled();
 },20000);
});
