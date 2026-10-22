/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { ChaosWalkerCommand } from '../../src/domain/chaos-walker/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

interface Capture { prefixCount: number; commands: SliceIntent[]; promoted: SliceState; practiced: SliceState; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = () => JSON.parse(readFileSync('tests/fixtures/misfortune-mage-v01350/natural.json', 'utf8')) as Capture;
const continued = () => JSON.parse(readFileSync('tests/fixtures/chaos-walker-v01580/natural.json', 'utf8')) as Capture;
const roots = ['monster', 'machine', 'lucky', 'calamityPriest', 'misfortuneMage'] as const;
function savedGame(state: unknown, failFirst = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The actual original run already exists.');
    if (failFirst && attempts++ === 0) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '本次原操作尚未保存', retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId, previousRevision: envelope.expectedRevision, newRevision: current.revision, committedAt: '2026-10-13T14:00:00Z', replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
// Read the producer's exact boundary key without materializing all 40 saved
// before/after pairs (the original JSON is over 50 MiB). Keep the same checks.
function boundary(key: string, type: ChaosWalkerCommand['type'], promotedOnly = false) {
  const result = readObjectEntry<Boundary>('tests/fixtures/chaos-walker-v01580/boundaries.json', key);
  if (!(result.lastIntent.type === 'CHAOS_WALKER' && result.lastIntent.command.type === type && (!promotedOnly || result.beforeLast.progression.sequence === 4 && result.final.progression.sequence === 3))) throw new Error(`Missing actual saved ${type} boundary; do not invent natural results.`); return result;
}
function expectOriginals(s: SliceState, before: SliceState) {
  for (const root of roots) expect(s[root]).toEqual(before[root]);
  const { luck, ...winner } = s.winner, { luck: oldLuck, ...oldWinner } = before.winner; expect(winner).toEqual(oldWinner);
  expect(luck.stored).toBe(luck.accumulated - luck.spent); expect(luck.spent).toBeGreaterThanOrEqual(oldLuck.spent); expect(s.character.gender).toBe(before.character.gender); expect(s.character.age).toBe(before.character.age); expect(s.random.seed).toBe(before.random.seed);
}
async function mount(game: SavedGame, openPanel = true) {
  const state = projectSliceState(game.state);
  window.sliceGame = { getBootstrap: vi.fn<SliceBridge["getBootstrap"]>().mockImplementation(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-13T13:59:00Z' }] } })), loadRun: vi.fn<SliceBridge["loadRun"]>().mockImplementation(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit };
  render(<SliceApp />); await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ })); await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' }) ?? screen.queryByRole('region', { name: '混乱行者' }) ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null) ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' }); if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
  if (state.ending) { await screen.findByRole('heading', { name: state.ending.title }); return; }
  if (state.combat) { await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" }); return; }
  if (!screen.queryByRole('region', { name: '混乱行者' }) && openPanel) { await screen.findByRole('heading', { name: '人物卷宗' }); await userEvent.click(screen.getByRole('button', { name: '混乱行者与有限概率' })); }
  if (openPanel) await screen.findByRole('region', { name: '混乱行者' });
}
async function action(game: SavedGame, command: ChaosWalkerCommand) {
  const projected = projectSliceState(game.state).chaosWalker, expected = projected.actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!expected) throw new Error(`No actual public action for ${JSON.stringify(command)}`);
  const select = screen.getByRole('combobox', { name: '选择混乱行者事项' }) as HTMLSelectElement;
  const goal = 'bottleId' in command ? `bottle:${command.bottleId}` : 'caseId' in command ? `case:${command.caseId}` : ['BUY_BLOCKS', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(command.type) ? 'encounter' : 'preparation';
  if (!select.disabled && Array.from(select.options).some(option => option.value === goal)) await userEvent.selectOptions(select, goal);
  const button = screen.getByRole('button', { name: name => name.startsWith(expected.label), hidden: true }) as HTMLButtonElement;
  const detail = button.closest('details'); if (detail && !detail.open) await userEvent.click(detail.querySelector('summary')!);
  return button;
}
async function expectSaved(game: SavedGame, expected: unknown) { await waitFor(() => expect(game.state).toEqual(migrateSliceState(expected))); }
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
// Reset registered vi.fn implementations and returned projections as well as
// spies; constructor implementations would otherwise retain each saved game.
afterEach(() => { cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks(); });

describe('ChaosWalker navigation with actual saved command boundaries', () => {
  it('opens at the exact living333-command prefix and closes without moving or healing any original', async () => {
    const old = original(), next = continued(), game = savedGame(old.final), before = structuredClone(game.state);
    expect(old.commands).toHaveLength(333); expect(next.prefixCount).toBe(333); expect(next.commands.slice(0, 333)).toEqual(old.commands);
    expect(before).toMatchObject({ week: 87, health: 70, mind: 100, spirituality: 113, cash: 360, actionsRemaining: 1 }); await mount(game);
    expect(screen.getByRole('region', { name: '混乱行者当前目标' }).textContent).toContain('8/12');
    await userEvent.click(screen.getByText('原人物、原物与旧命运之轮路线记录', { selector: 'summary' }));
    const history = screen.getByRole('region', { name: '混乱行者继承记录' });
    for (const text of ['MM4-FERRIS-LORNE', 'SURRENDERED', '健康70/100', '灵性16', '原伤势1处']) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole('button')).toBeNull(); await userEvent.click(screen.getByRole('button', { name: '关闭混乱行者页面' }));
    expect(screen.getByRole('heading', { name: '人物卷宗' })).toBeTruthy(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expectOriginals(game.state, before);
  }, 20_000);
  it('retries the exact original guidance envelope after a failed save without charging twice', async () => {
    const b = boundary('guidance', 'LEARN_GUIDANCE'), game = savedGame(b.beforeLast, true), before = structuredClone(game.state); await mount(game);
    await userEvent.click(await action(game, { type: 'LEARN_GUIDANCE' })); await screen.findByRole('alert'); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: '关闭混乱行者页面' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await expectSaved(game, b.final);
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expectOriginals(game.state, before);
  }, 20_000);
  it('saves the actual current-week140 preparation and allows zero-action exit without refund or redose', async () => {
    const b = boundary('prepare-current-week', 'PREPARE_PROMOTION'), game = savedGame(b.beforeLast), before = structuredClone(game.state); await mount(game);
    await userEvent.click(await action(game, { type: 'PREPARE_PROMOTION' })); await expectSaved(game, b.final);
    await waitFor(() => expect(screen.getByRole('region', { name: '混乱行者' }).getAttribute('aria-busy')).toBe('false'));
    const prepared = structuredClone(game.state), expected = applySliceIntent(prepared, { type: 'CHAOS_WALKER', command: { type: 'LEAVE_PREPARATION' } });
    expect(prepared.chaosWalker.preparedWeek).toBe(prepared.week);
    await userEvent.click(await action(game, { type: 'LEAVE_PREPARATION' })); await expectSaved(game, expected);
    expect(game.state.cash).toBe(prepared.cash); expect(game.state.chaosWalker.bottles).toEqual(prepared.chaosWalker.bottles); expectOriginals(game.state, before);
  }, 20_000);
  it('requires an independent selected-bottle confirmation and cancellation does not mutate the real save', async () => {
    const b = boundary('promotion', 'CONSUME', true), game = savedGame(b.beforeLast), before = structuredClone(game.state); await mount(game);
    if (b.lastIntent.type !== 'CHAOS_WALKER') throw new Error('Expected real original dose.'); const command = b.lastIntent.command;
    await userEvent.click(await action(game, command)); const confirm = screen.getByRole('region', { name: '混乱行者原瓶服用确认' });
    expect(confirm.textContent).toContain('意志难度30'); expect(confirm.textContent).toContain('140便士'); expect(confirm.textContent).toContain('完整配方'); expect(confirm.textContent).toContain('未知');
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    await userEvent.click(within(confirm).getByRole('button', { name: '暂不服用，返回准备' })); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await action(game, command)); await userEvent.click(screen.getByRole('button', { name: '确认服用这一原瓶' })); await expectSaved(game, b.final);
    expect(game.submit).toHaveBeenCalledOnce(); expect(vi.mocked(game.submit).mock.calls[0]![0].payload).toEqual(b.lastIntent); expectOriginals(game.state, before);
    expect(game.state.character.age).toBe(26); expect(game.state.spirituality).toBe(before.spirituality);
  }, 20_000);
  it('shows completed original records and honest spell outcomes without requiring every natural spell to succeed', async () => {
    const game = savedGame(continued().practiced), before = structuredClone(game.state); await mount(game);
    await userEvent.click(screen.getByText('三项原案的观察与实际结果', { selector: 'summary' })); const reports = screen.getByRole('region', { name: '混乱行者生活记录' });
    expect(reports.textContent).toContain('原'); expect(reports.textContent).toContain('普通');
    expect(game.state.progression.acting).toBe(100); expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    await userEvent.click(screen.getByText('原人物、原物与旧命运之轮路线记录', { selector: 'summary' })); expect(screen.getByRole('region', { name: '混乱行者继承记录' }).textContent).toContain('MM4-FERRIS-LORNE'); expect(screen.getByRole('region', { name: '混乱行者继承记录' }).textContent).toContain('原伤势1处'); expectOriginals(game.state, original().final);
  }, 20_000);
  it('loads the real optional-combat terminal honestly, including death when the original branch died', async () => {
    const game = savedGame(continued().final), before = structuredClone(game.state); await mount(game, false);
    if (before.status === 'DEAD') { expect(screen.getByRole('heading', { name: projectSliceState(before).ending!.title })).toBeTruthy(); expect(game.state.health).toBe(0); }
    else expect(screen.getByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expectOriginals(game.state, before);
    expect(game.state.misfortuneMage).toEqual(original().final.misfortuneMage);
  }, 20_000);
  it.each(['HOLD', 'SPEND_FIRST'] as const)('defaults to HOLD and sends explicit%s without pre-spending the only original luck', async policy => {
    const b = readObjectEntry<Boundary>('tests/fixtures/chaos-walker-v01580/boundaries.json', 'combat-first');
    if (b.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual first combat-round boundary.');
    const game = savedGame(b.beforeLast), before = structuredClone(game.state); await mount(game, false);
    const reserve = screen.getByRole('group', { name: `本回合幸运储备 · 当前 ${before.winner.luck.stored} / 3` });
    expect(reserve.textContent).toContain('5灵性');
    expect((screen.getByRole('radio', { name: '本回合保留幸运' }) as HTMLInputElement).checked).toBe(true);
    if (policy === 'SPEND_FIRST') await userEvent.click(screen.getByRole('radio', { name: '首次合格防护或厄运时使用1份' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.submit).toHaveBeenCalledOnce());
    const payload = vi.mocked(game.submit).mock.calls[0]![0].payload;
    expect(payload).toMatchObject({ type: 'COMBAT_ROUND', winnerPolicy: policy });
    await expectSaved(game, applySliceIntent(before, payload as SliceIntent)); expectOriginals(game.state, before);
  }, 20_000);
});
