/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { FerrymanCommand } from '../../src/domain/ferryman/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
interface Capture { prefixCount: number; commands: SliceIntent[]; departureStart: SliceState; handoffStart: SliceState; guidanceStart: SliceState; promoted: SliceState; practiced: SliceState; beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const natural = (): Capture => JSON.parse(readFileSync('tests/fixtures/ferryman-v01490/natural.json', 'utf8'));
const oldCapture = (name: string): Capture => JSON.parse(readFileSync(`tests/fixtures/${name}/natural.json`, 'utf8'));
function boundary(predicate: (b: Boundary) => boolean): Boundary { const values = Object.values(JSON.parse(readFileSync('tests/fixtures/ferryman-v01490/boundaries.json', 'utf8')) as Record<string, Boundary>); const found = values.find(predicate); if (!found) throw new Error('Missing actual Ferryman public boundary.'); return found; }
function savedGame(state: unknown, failFirstSave = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('This actual run already exists.');
    if (failFirstSave && attempts++ === 0) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '本次原操作尚未保存', retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId, previousRevision: envelope.expectedRevision, newRevision: current.revision, committedAt: '2026-10-13T11:00:00Z', replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-13T10:59:00Z' }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />); await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: '摆渡人' }) ?? screen.queryByRole('region', { name: '长期章节' }) ?? screen.queryByRole('heading', { name: '人物卷宗' }) ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null) ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function finishReveal() { const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' }); if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ })); }
async function openFerryman(game: SavedGame) {
  await mount(game); await finishReveal(); if (!screen.queryByRole('region', { name: '摆渡人' })) await userEvent.click(screen.getByRole('button', { name: '摆渡人与原灵交接' })); await screen.findByRole('region', { name: '摆渡人' });
}
function actionButton(s: SliceState, command: FerrymanCommand) {
  const a = projectSliceState(s).ferryman.actions.find(v => JSON.stringify(v.command) === JSON.stringify(command)); if (!a) throw new Error(`Missing public command ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(a.label) }) as HTMLButtonElement;
}
const settled = () => waitFor(() => expect(screen.getByRole('region', { name: '摆渡人' }).getAttribute('aria-busy')).toBe('false'));
function unchangedHistory(s: SliceState, before: SliceState) { for (const root of ['corpsecollector', 'gravedigger', 'spiritmedium', 'spiritGuide', 'gatekeeper', 'undying'] as const) expect(s[root]).toEqual(before[root]); if (before.longChapter.handoff) expect(s.longChapter).toEqual(before.longChapter); }
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe('Ferryman navigation from two actual eras', () => {
  it('opens the original422-command route without changing dead Owen or inherited original objects', async () => {
    const c = oldCapture('undying-v01260'), game = savedGame(c.final), before = structuredClone(game.state); expect(c.commands).toHaveLength(422); await openFerryman(game);
    expect(screen.getByRole('region', { name: '摆渡人当前目标' }).textContent).toContain('9/12');
    await userEvent.click(screen.getByText('原身体、实际周期与旧人旧物', { selector: 'summary' })); const history = screen.getByRole('region', { name: '摆渡人继承记录' }); expect(history.textContent).toContain('已死亡，不会复活'); expect(history.textContent).toContain('UDY4-OWEN-CLUB'); expect(within(history).queryByRole('button')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭摆渡人页面' })); expect(screen.getByRole('heading', { name: '人物卷宗' })).toBeTruthy(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 15000);
  it('publicly hands off the exact428-command residence without moving or refilling, then closes its readonly archive', async () => {
    const c = oldCapture('long-chapter-v01390'), game = savedGame(c.final), before = structuredClone(game.state); expect(c.commands).toHaveLength(428); await mount(game);
    const action = projectSliceState(before).longChapter.actions.find(a => a.command.type === 'CONTINUE_FERRYMAN')!; expect(action).toBeTruthy(); await userEvent.click(screen.getByRole('button', { name: name => name.startsWith(action.label) })); await settled();
    expect(game.state.longChapter.handoff).toMatchObject({ cash: 194, health: 55, mind: 68, spirituality: 104, actionsRemaining: 1, week: 3235 }); expect(game.state.ferryman.era).toMatchObject({ travelledMetres: 0, elapsedSeconds: 0, location: 'OUTSIDE' });
    expect([game.state.cash, game.state.actionsRemaining, game.state.health, game.state.mind, game.state.spirituality]).toEqual([194, 1, 55, 68, 104]); unchangedHistory(game.state, before);
    await userEvent.click(screen.getByRole('button', { name: '查看原居所与周期记录' })); const archive = await screen.findByRole('region', { name: '长期章节' });
    expect(within(archive).queryByRole('button', { name: /劳动|休整|进入接待|过去七天/ })).toBeNull(); const calls = vi.mocked(game.submit).mock.calls.length;
    await userEvent.click(within(archive).getByRole('button', { name: '关闭长期章节页面' })); await screen.findByRole('region', { name: '摆渡人' }); expect(game.submit).toHaveBeenCalledTimes(calls);
  }, 15000);
  it('retries the same failed handoff envelope without a second departure', async () => {
    const game = savedGame(oldCapture('long-chapter-v01390').final, true), before = structuredClone(game.state); await mount(game);
    const action = projectSliceState(before).longChapter.actions.find(a => a.command.type === 'CONTINUE_FERRYMAN')!; await userEvent.click(screen.getByRole('button', { name: name => name.startsWith(action.label) })); await screen.findByRole('alert'); expect(game.state).toEqual(before);
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await settled(); const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(game.state.longChapter.handoff?.actionsRemaining).toBe(1); expect(game.state.ferryman.channels).toEqual([]);
  }, 15000);
  it('charges actual post-cycle120 introduction, records12m and reloads directly into current life', async () => {
    const b = boundary(v => v.lastIntent.type === 'FERRYMAN' && v.lastIntent.command.type === 'LEARN_GUIDANCE'), game = savedGame(b.beforeLast), before = structuredClone(game.state); await openFerryman(game);
    await userEvent.click(actionButton(game.state, { type: 'LEARN_GUIDANCE' })); await settled(); expect(game.state).toEqual(migrateSliceState(b.final)); unchangedHistory(game.state, before);
    expect(game.state.ferryman.channels.at(-1)?.provider.id).toBe('FR3-HANNA'); expect(game.state.ferryman.era.travelledMetres).toBeGreaterThanOrEqual(12); expect(screen.getByRole('region', { name: '当前摆渡人渠道' }).textContent).toContain('汉娜');
    cleanup(); await mount(game); expect(screen.getByRole('region', { name: '摆渡人' })).toBeTruthy(); expect(screen.queryByRole('region', { name: '长期章节' })).toBeNull(); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }, 15000);
  it('locks actual current-week preparation while retaining a real zero-action cancellation', async () => {
    const b = boundary(v => v.lastIntent.type === 'FERRYMAN' && v.lastIntent.command.type === 'PREPARE_PROMOTION'), game = savedGame(b.beforeLast), before = structuredClone(game.state); await openFerryman(game); await userEvent.click(actionButton(game.state, { type: 'PREPARE_PROMOTION' })); await settled();
    expect(game.state).toEqual(migrateSliceState(b.final)); expect(actionButton(game.state, { type: 'LEAVE_PREPARATION' }).disabled).toBe(false); expect(screen.queryByRole('button', { name: '关闭摆渡人页面' })).toBeNull(); expect(screen.queryByRole('button', { name: '查看原居所与周期记录' })).toBeNull(); unchangedHistory(game.state, before);
  }, 15000);
  it('requires independent original-bottle confirmation and remains in the promoted current-era shell', async () => {
    const b = boundary(v => v.lastIntent.type === 'FERRYMAN' && v.lastIntent.command.type === 'CONSUME' && v.final.progression.sequence === 3), game = savedGame(b.beforeLast), before = structuredClone(game.state);
    if (b.lastIntent.type !== 'FERRYMAN' || b.lastIntent.command.type !== 'CONSUME') throw new Error('Expected actual consumption'); const command = b.lastIntent.command; await openFerryman(game);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '选择独立摆渡人原瓶' }), command.bottleId); await userEvent.click(actionButton(game.state, command)); const review = screen.getByRole('region', { name: '摆渡人原瓶服用确认' });
    expect(review.textContent).toContain(command.bottleId); expect(review.textContent).toContain('身体性别不改变'); expect(review.textContent).toContain('不补满'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(review).getByRole('button', { name: '暂不服用，返回准备' })); expect(game.state).toEqual(before); await userEvent.click(actionButton(game.state, command)); await userEvent.click(screen.getByRole('button', { name: '确认服用这一原瓶' })); await settled();
    expect(game.state).toEqual(migrateSliceState(b.final)); expect(game.state.progression.sequence).toBe(3); expect(screen.getByRole('region', { name: '摆渡人' })).toBeTruthy(); unchangedHistory(game.state, before);
  }, 15000);
  it('displays a new saved combat round rather than swallowing it in the completed residence', async () => {
    const b = boundary(v => v.lastIntent.type === 'COMBAT_ROUND' && !!v.final.lastCombatRound?.ferrymanOutcome), game = savedGame(b.beforeLast); await mount(game); await finishReveal();
    if (b.lastIntent.type !== 'COMBAT_ROUND') throw new Error('Expected actual round'); const intent = b.lastIntent, battle = projectSliceState(game.state).combat!, stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" }), stance = battle.stances.find(v => v.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) })); await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' })); await screen.findByRole('dialog', { name: '战斗回合结果' }); expect(game.state).toEqual(migrateSliceState(b.final));
  }, 15000);
  it('reloads the actual terminal result and never offers old residence revival for a new combat death', async () => {
    const c = natural(), game = savedGame(c.final); await mount(game); await finishReveal(); expect(game.state).toEqual(migrateSliceState(c.final));
    if (game.state.status === 'DEAD') { await screen.findByRole('heading', { name: game.state.ending!.title }); expect(screen.queryByRole('button', { name: /七天.*复起|等待.*复起|继续不死者/ })).toBeNull(); expect(screen.queryByRole('region', { name: '长期章节' })).toBeNull(); }
    else expect(screen.getByRole('region', { name: '摆渡人' })).toBeTruthy();
  }, 15000);
});
