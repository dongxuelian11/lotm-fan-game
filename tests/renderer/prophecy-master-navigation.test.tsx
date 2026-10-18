/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { ProphecyMasterCommand } from '../../src/domain/prophecy-master/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';

interface Capture { prefixCount: number; commands: SliceIntent[]; promoted: SliceState; practiced: SliceState; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const original = () => JSON.parse(readFileSync('tests/fixtures/mystic-v01310/natural.json', 'utf8')) as Capture;
const continued = () => JSON.parse(readFileSync('tests/fixtures/prophecy-master-v01540/natural.json', 'utf8')) as Capture;
const roots = ['pryer', 'combatScholar', 'wizard', 'scrollProfessor', 'starMystic', 'mystic'] as const;
function savedGame(state: unknown, failFirst = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The actual original run already exists.');
    if (failFirst && attempts++ === 0) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '本次原操作尚未保存', retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId, previousRevision: envelope.expectedRevision, newRevision: current.revision, committedAt: '2026-10-13T14:00:00Z', replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
function boundary(type: ProphecyMasterCommand['type'], promotedOnly = false) {
  const all = Object.values(JSON.parse(readFileSync('tests/fixtures/prophecy-master-v01540/boundaries.json', 'utf8')) as Record<string, Boundary>);
  const result = all.find(b => b.lastIntent.type === 'PROPHECY_MASTER' && b.lastIntent.command.type === type && (!promotedOnly || b.beforeLast.progression.sequence === 4 && b.final.progression.sequence === 3));
  if (!result) throw new Error(`Missing actual saved ${type} boundary; do not invent natural results.`); return result;
}
function expectOriginals(s: SliceState, before: SliceState) {
  for (const root of roots) expect(s[root]).toEqual(before[root]); expect(s.character.gender).toBe(before.character.gender); expect(s.character.age).toBe(before.character.age); expect(s.random.seed).toBe(before.random.seed);
}
async function mount(game: SavedGame, openPanel = true) {
  const state = projectSliceState(game.state);
  window.sliceGame = { getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-13T13:59:00Z' }] } })), loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit };
  render(<SliceApp />); await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ })); await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' }) ?? screen.queryByRole('region', { name: '预言大师' }) ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null) ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' }); if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
  if (state.ending) { await screen.findByRole('heading', { name: state.ending.title }); return; }
  if (state.combat) { await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" }); return; }
  if (!screen.queryByRole('region', { name: '预言大师' }) && openPanel) { await screen.findByRole('heading', { name: '人物卷宗' }); await userEvent.click(screen.getByRole('button', { name: '预言大师与有限预兆' })); }
  if (openPanel) await screen.findByRole('region', { name: '预言大师' });
}
async function action(game: SavedGame, command: ProphecyMasterCommand) {
  const projected = projectSliceState(game.state).prophecyMaster, expected = projected.actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!expected) throw new Error(`No actual public action for ${JSON.stringify(command)}`);
  const select = screen.getByRole('combobox', { name: '选择预言大师事项' }) as HTMLSelectElement;
  const goal = 'bottleId' in command ? `bottle:${command.bottleId}` : 'caseId' in command ? `case:${command.caseId}` : ['ENCOUNTER_TALK', 'ENCOUNTER_FIGHT', 'LEAVE_ENCOUNTER'].includes(command.type) ? 'encounter' : 'preparation';
  if (!select.disabled && Array.from(select.options).some(option => option.value === goal)) await userEvent.selectOptions(select, goal);
  const button = screen.getByRole('button', { name: name => name.startsWith(expected.label), hidden: true }) as HTMLButtonElement;
  const detail = button.closest('details'); if (detail && !detail.open) await userEvent.click(detail.querySelector('summary')!);
  return button;
}
async function expectSaved(game: SavedGame, expected: unknown) { await waitFor(() => expect(game.state).toEqual(migrateSliceState(expected))); }
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe('Prophecy Master navigation with actual saved command boundaries', () => {
  it('opens at the exact living411-command prefix and closes without moving or healing any original', async () => {
    const old = original(), next = continued(), game = savedGame(old.final), before = structuredClone(game.state);
    expect(old.commands).toHaveLength(411); expect(next.prefixCount).toBe(411); expect(next.commands.slice(0, 411)).toEqual(old.commands);
    expect(before).toMatchObject({ week: 108, health: 100, mind: 100, spirituality: 112, cash: 750, actionsRemaining: 2 }); await mount(game);
    expect(screen.getByRole('region', { name: '预言大师当前目标' }).textContent).toContain('13/12');
    await userEvent.click(screen.getByText('原故事、原卷与旧隐者路线记录', { selector: 'summary' }));
    const history = screen.getByRole('region', { name: '预言大师继承记录' });
    for (const text of ['MY4-LUCAN-VEY', 'SURRENDERED', '健康70/100', '105', '15%']) expect(history.textContent).toContain(text);
    expect(within(history).queryByRole('button')).toBeNull(); await userEvent.click(screen.getByRole('button', { name: '关闭预言大师页面' }));
    expect(screen.getByRole('heading', { name: '人物卷宗' })).toBeTruthy(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expectOriginals(game.state, before);
  }, 20_000);
  it('retries the exact original guidance envelope after a failed save without charging twice', async () => {
    const b = boundary('LEARN_GUIDANCE'), game = savedGame(b.beforeLast, true), before = structuredClone(game.state); await mount(game);
    await userEvent.click(await action(game, { type: 'LEARN_GUIDANCE' })); await screen.findByRole('alert'); expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledOnce();
    expect((screen.getByRole('button', { name: '关闭预言大师页面' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await expectSaved(game, b.final);
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expectOriginals(game.state, before);
  }, 20_000);
  it('saves the actual current-week140 preparation and allows zero-action exit without refund or redose', async () => {
    const b = boundary('PREPARE_PROMOTION'), game = savedGame(b.beforeLast), before = structuredClone(game.state); await mount(game);
    await userEvent.click(await action(game, { type: 'PREPARE_PROMOTION' })); await expectSaved(game, b.final);
    await waitFor(() => expect(screen.getByRole('region', { name: '预言大师' }).getAttribute('aria-busy')).toBe('false'));
    const prepared = structuredClone(game.state), expected = applySliceIntent(prepared, { type: 'PROPHECY_MASTER', command: { type: 'LEAVE_PREPARATION' } });
    expect(prepared.prophecyMaster.preparedWeek).toBe(prepared.week);
    await userEvent.click(await action(game, { type: 'LEAVE_PREPARATION' })); await expectSaved(game, expected);
    expect(game.state.cash).toBe(prepared.cash); expect(game.state.prophecyMaster.bottles).toEqual(prepared.prophecyMaster.bottles); expectOriginals(game.state, before);
  }, 20_000);
  it('requires an independent selected-bottle confirmation and cancellation does not mutate the real save', async () => {
    const b = boundary('CONSUME', true), game = savedGame(b.beforeLast), before = structuredClone(game.state); await mount(game);
    if (b.lastIntent.type !== 'PROPHECY_MASTER') throw new Error('Expected real original dose.'); const command = b.lastIntent.command;
    await userEvent.click(await action(game, command)); const confirm = screen.getByRole('region', { name: '预言大师原瓶服用确认' });
    expect(confirm.textContent).toContain('意志难度30'); expect(confirm.textContent).toContain('140便士'); expect(confirm.textContent).toContain('完整配方'); expect(confirm.textContent).toContain('未知');
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    await userEvent.click(within(confirm).getByRole('button', { name: '暂不服用，返回准备' })); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await action(game, command)); await userEvent.click(screen.getByRole('button', { name: '确认服用这一原瓶' })); await expectSaved(game, b.final);
    expect(game.submit).toHaveBeenCalledOnce(); expect(vi.mocked(game.submit).mock.calls[0]![0].payload).toEqual(b.lastIntent); expectOriginals(game.state, before);
    expect(game.state.character.age).toBe(26); expect(game.state.spirituality).toBe(before.spirituality);
  }, 20_000);
  it('shows completed original records and honest spell outcomes without requiring every natural spell to succeed', async () => {
    const game = savedGame(continued().practiced), before = structuredClone(game.state); await mount(game);
    await userEvent.click(screen.getByText('三项原案的观察与实际结果', { selector: 'summary' })); const reports = screen.getByRole('region', { name: '预言大师生活记录' });
    expect(reports.textContent).toContain('铃'); expect(reports.textContent).toContain('原封包'); expect(reports.textContent).toContain('停止');
    expect(game.state.progression.acting).toBe(100); expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before);
    await userEvent.click(screen.getByText('原故事、原卷与旧隐者路线记录', { selector: 'summary' })); expect(screen.getByRole('region', { name: '预言大师继承记录' }).textContent).toContain('105'); expect(screen.getByRole('region', { name: '预言大师继承记录' }).textContent).toContain('15%'); expectOriginals(game.state, original().final);
  }, 20_000);
  it('opens the inherited original workshop from the real S3 page without submitting a gameplay action', async () => {
    const game = savedGame(continued().practiced), before = structuredClone(game.state); await mount(game);
    await userEvent.click(screen.getByRole('button', { name: '打开继承卷轴工坊' }));
    const workshop = await screen.findByRole('region', { name: '卷轴工坊与实际原件' });
    await userEvent.click(within(workshop).getByText('材料原份 · 实际持有与耗用', { selector: 'summary' }));
    expect(workshop.textContent).toContain('scroll-professor-material-12');
    expect(workshop.textContent).toContain('scroll-professor-scroll-8');
    expect(game.state.scrollProfessor.workshop.materials[11]).toMatchObject({ id: 'scroll-professor-material-12', status: 'HELD', spentWeek: null });
    expect(game.state.scrollProfessor.workshop.scrolls).toHaveLength(8);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before); expectOriginals(game.state, original().final);
  }, 20_000);
  it('loads the real optional-combat terminal honestly, including death when the original branch died', async () => {
    const game = savedGame(continued().final), before = structuredClone(game.state); await mount(game, false);
    if (before.status === 'DEAD') { expect(screen.getByRole('heading', { name: projectSliceState(before).ending!.title })).toBeTruthy(); expect(game.state.health).toBe(0); }
    else expect(screen.getByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expectOriginals(game.state, before);
    expect(game.state.mystic).toEqual(original().final.mystic);
  }, 20_000);
});
