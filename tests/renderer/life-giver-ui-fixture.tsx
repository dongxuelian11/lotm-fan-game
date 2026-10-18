/* @vitest-environment jsdom */
import { readObjectEntry } from '../helpers/read-object-entry.js';
import { lifeGiverBoundaryFile } from '../../scripts/play/life-giver-boundary-files.mjs';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { LifeGiverPanel } from '../../src/renderer/LifeGiverPanel';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { LifeGiverCommand } from '../../src/domain/life-giver/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';

export interface Boundary { beforeLast: unknown; lastIntent: SliceIntent; final: unknown }
const ROOT = 'tests/fixtures/life-giver-v01680';
// Read just one original snapshot at a time. A complete boundary part must not be
// imported or decoded wholesale in a 512 MiB renderer worker.
export function naturalEntry<T = unknown>(name: string): T { return readObjectEntry<T>(`${ROOT}/natural.json`, name); }
export function boundary(name: string): Boundary { return readObjectEntry<Boundary>(lifeGiverBoundaryFile(ROOT, name), name); }
export function directedBoundary(name: string): Boundary { return readObjectEntry<Boundary>(`${ROOT}/directed.json`, name); }
// The manifest is a small index. Conditional failures and combat effects exist
// only if the actual natural branch reached them.
export interface BoundaryIndex { key: string; commandIndex: number; revision: number; path: string }
export const boundaryIndex = () => naturalEntry<BoundaryIndex[]>('boundaryManifest');
export const boundaryNames = (pattern: RegExp) => boundaryIndex().filter(entry => pattern.test(entry.key)).map(entry => entry.key);
export const NEW_IDS = ['moon.s2.bounded-vitality', 'moon.s2.shared-shelter'] as const;
export const CASES = ['tired-guest', 'withdrawn-consent', 'interrupted-link'] as const;
export const PANEL = '创生者';
export const ENTRY = '创生者与有限生命支持';
export const CONFIRM_TYPES = new Set(['LEARN_GUIDANCE', 'BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME', 'VITALITY', 'SHELTER', 'PREPARE_BATTLE_BEAD', 'BUY_PAPERS', 'PREPARE_PAPER', 'REST_GUEST', 'ENCOUNTER_FIGHT']);
export const requiresConfirmation = (command: LifeGiverCommand) => CONFIRM_TYPES.has(command.type)
  || command.type === 'PREPARE' && command.method === 'ABILITY'
  || command.type === 'SET_GUEST_POLICY' && command.policy === 'ASK_HELP';
export const view = (state: SliceState) => projectSliceState(state).lifeGiver;
/** Reconstruct an uncaptured input from the nearest earlier real boundary and
 * the recorded public commands only. No RNG rewrite or private-state editing. */
export function naturalCommandBoundary(command: LifeGiverCommand): Boundary {
  const commands = naturalEntry<SliceIntent[]>('commands');
  const prefixCount = naturalEntry<number>('prefixCount');
  const index = commands.findIndex((intent, i) => i >= prefixCount
    && intent.type === 'LIFE_GIVER' && JSON.stringify(intent.command) === JSON.stringify(command));
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
export function capturedCommand(captured: Boundary): LifeGiverCommand {
  if (captured.lastIntent.type !== 'LIFE_GIVER') throw new Error('Expected an actual LifeGiver command.');
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
    ?? screen.queryByRole('region', { name: '创生者' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  // Old S3 history stays saved; it must not reopen as the current S2 outcome.
  if (state.lifeGiver.promoted && state.lastCombatRound && !state.lastCombatRound.lifeGiverOutcome) {
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }
  await acknowledgeSavedRound();
  if (state.ending) await screen.findByRole('heading', { name: state.ending.title });
  else if (state.combat) await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" });
  else if (state.lifeGiver.insideCase) await screen.findByRole('region', { name: '创生者' });
  else await screen.findByRole('heading', { name: '人物卷宗' });
}
export async function mountGame(game: SavedGame, openLifeGiver = true, recoveryNotice?: string) {
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
  if (openLifeGiver && !state.ending && !state.combat && !screen.queryByRole('region', { name: '创生者' })) {
    await userEvent.click(screen.getByRole('button', { name: '创生者与有限生命支持' }));
    await screen.findByRole('region', { name: '创生者' });
  }
}
export function actionButton(state: SliceState, command: LifeGiverCommand): HTMLButtonElement {
  const action = projectSliceState(state).lifeGiver.actions.find(entry =>
    JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public LifeGiver action: ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement;
}
export async function selectCommandObject(command: LifeGiverCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '选择创生者原瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  if ('paperId' in command) {
    const select = screen.queryByRole('combobox', { name: '选择创生者继承原纸', hidden: true }) as HTMLSelectElement | null;
    if (select && !select.disabled && select.value !== command.paperId) await userEvent.selectOptions(select, command.paperId);
  }
  if ('caseId' in command) {
    const select = screen.queryByRole('combobox', { name: '选择创生者生活情境' }) as HTMLSelectElement | null;
    if (select && !select.disabled && select.value !== command.caseId) await userEvent.selectOptions(select, command.caseId);
  }
}
export async function commandControl(state: SliceState, command: LifeGiverCommand) {
  await selectCommandObject(command);
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
export async function clickCommand(game: SavedGame, command: LifeGiverCommand) {
  const button = await commandControl(game.state, command);
  expect(button.disabled).toBe(false);
  await userEvent.click(button);
  if (requiresConfirmation(command)) {
    const review = screen.getByRole('dialog', { name: command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次实际消耗与风险' });
    await userEvent.click(within(review).getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作' }));
  }
  await waitFor(() => expect(screen.queryAllByText('正在结算并保存这一原操作，请稍候。')).toHaveLength(0));
}
export async function settled() {
  await waitFor(() => expect(screen.getByRole('region', { name: '创生者' }).getAttribute('aria-busy')).toBe('false'));
}
export function assertLegacyPreserved(before: SliceState, after: SliceState) {
  expect(after.character.gender).toBe(before.character.gender);
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed);
  for (const key of ['apothecary', 'tamer', 'vampire', 'potionProfessor', 'crimsonScholar'] as const) expect(after[key]).toEqual(before[key]);
  const witch = structuredClone(after.witchKing), priorWitch = before.witchKing;
  expect(witch.life.papers.map(p => p.id)).toEqual(priorWitch.life.papers.map(p => p.id));
  for (const paper of witch.life.papers) {
    const prior = priorWitch.life.papers.find(p => p.id === paper.id)!;
    if (prior.status === 'CONSUMED') expect(paper).toEqual(prior);
    for (const key of ['status', 'preparedWeek', 'consumedWeek', 'consumedBy', 'combatRound'] as const) Object.assign(paper, { [key]: prior[key] });
  }
  expect(witch).toEqual(priorWitch);
  const summoning = structuredClone(after.summoningMaster), prior = before.summoningMaster;
  const guest = summoning.life.partner, oldGuest = prior.life.partner;
  expect(guest.restHistory.slice(0, oldGuest.restHistory.length)).toEqual(oldGuest.restHistory);
  for (const key of ['location', 'health', 'mind', 'stamina', 'status', 'metWeek', 'ordinaryDistanceM', 'gateCrossings', 'restHistory'] as const) Object.assign(guest, { [key]: structuredClone(oldGuest[key]) });
  expect(summoning).toEqual(prior);
}
export function assertSavedEnvelope(game: SavedGame, before: SliceState, payload: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload });
}
export function renderBoundaryProjection(name: string) {
  const state = migrateSliceState(boundary(name).final), before = structuredClone(state), value = view(state);
  const onCommand = vi.fn(), onClose = vi.fn();
  render(<LifeGiverPanel value={value} busy={false} blocked={state.status !== 'ACTIVE' || !!state.combat} onCommand={onCommand} {...(!value.insideCase ? { onClose } : {})}/>);
  const panel = screen.getByRole('region', { name: PANEL });
  expect(panel.textContent).toContain(value.title);
  const warning = within(panel).getByText('创生者为序列2，下一阶为美神序列1。当前渠道只提供独立成品魔药，不提供完整配方；服用前须完成专业准备。本阶能力与限制以当前说明为准，不改变性别。');
  expect(warning.closest('details')).toBeNull();
  for (const marker of ['名称已核实', '原著仪式', '原创G']) expect(warning.textContent).not.toContain(marker);
  expect(panel.textContent).toContain('须从召唤大师实际晋升周起12整周、旧消化100，完成三项不同专业准备；当周场地检查另付1行动120便士。');
  expect(panel.textContent).toContain('服用前须实际完成上述专业准备。');
  expect(value.formulaKnown).toBe(false); expect(value.formula).toEqual([]);
  const resources = screen.getByRole('region', { name: '创生者当前资源' });
  for (const amount of [`${state.health} / 100`, `${state.mind} / 100`, `${state.spirituality} / 120`, value.resources!.cash]) expect(resources.textContent).toContain(amount);
  expect(panel.textContent).toContain(value.digestion);
  expect(value.currentGender).toBe(state.character.gender);
  if (value.promoted) {
    const guest = screen.getByRole('region', { name: '创生者原来客当前身体' });
    for (const text of [value.life.partner.id, value.life.partner.bodyId, value.life.partner.chime.id,
      `${value.life.partner.health} / 100`, `${value.life.partner.mind} / 100`, `${value.life.partner.stamina} / 100`]) expect(guest.textContent).toContain(text);
    for (const ability of value.abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    for (const bead of value.life.beads.filter(b => b.purpose === 'COMBAT' || !value.encounter.inside && b.caseId === (value.life.activeCase ?? value.life.cases.find(c => c.contactOpen || c.status === 'PREPARED')?.id ?? value.life.cases.find(c => c.status !== 'RESOLVED')?.id ?? value.life.cases[0]?.id))) {
      expect(panel.textContent).toContain(bead.id);
      expect(panel.textContent).toContain(`第${bead.preparedWeek}周实付${bead.paidPennies}便士`);
    }
    const a = value.life.currentAttempt;
    if (a && !value.encounter.inside) {
      expect(panel.textContent).toContain(`实际恢复精力${a.vitalityRestored}`);
      expect(panel.textContent).toContain(`流灯实际搬运${a.guestTrips}程`);
      expect(panel.textContent).toContain(`实耗${a.elapsedSeconds}秒`);
      expect(panel.textContent).toContain(`实耗灵性${a.spiritualitySpent}、来客精力${a.guestStaminaSpent}、本人健康${a.playerHealthSpent}`);
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
