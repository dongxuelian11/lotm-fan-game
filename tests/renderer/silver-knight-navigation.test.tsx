/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import type { SilverKnightCommand } from '../../src/domain/silver-knight/types';

interface Capture { creation: Parameters<typeof createSliceRun>[1]; seed: string; prefixCount: number; commands: SliceIntent[]; final: SliceState }
const original = () => JSON.parse(readFileSync('tests/fixtures/demon-hunter-v01290/natural.json', 'utf8')) as Capture;
const natural = () => JSON.parse(readFileSync('tests/fixtures/silver-knight-v01520/natural.json', 'utf8')) as Capture;
const roots = ['warrior', 'gladiator', 'weaponmaster', 'dawnPaladin', 'guardian', 'demonHunter'] as const;
function expectOriginals(s: SliceState, prior: SliceState) { for (const root of roots) expect(s[root]).toEqual(prior[root]); expect(s.character.gender).toBe(prior.character.gender); expect(s.random.seed).toBe(prior.random.seed); }
function savedGame(state: unknown, failFirst = false) {
  let current = migrateSliceState(state), attempts = 0;
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('Original run already exists.');
    if (failFirst && attempts++ === 0) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '这次原操作尚未保存', retryable: true } };
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId, previousRevision: envelope.expectedRevision, newRevision: current.revision, committedAt: '2026-10-13T13:00:00Z', replayed: false, state: projectSliceState(current) } };
  });
  return { get state() { return current; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function acknowledgeOldRound() { const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' }); if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ })); }
async function mount(game: SavedGame, openPanel = true) {
  const state = projectSliceState(game.state);
  window.sliceGame = { getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-13T12:59:00Z' }] } })), loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit };
  render(<SliceApp />); await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ })); await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' }) ?? screen.queryByRole('region', { name: '银骑士' }) ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null) ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  await acknowledgeOldRound(); if (state.ending) { await screen.findByRole('heading', { name: state.ending.title }); return; }
  if (state.combat) { await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" }); return; }
  if (!screen.queryByRole('region', { name: '银骑士' }) && openPanel) { await screen.findByRole('heading', { name: '人物卷宗' }); await userEvent.click(screen.getByRole('button', { name: '银骑士与六种亲猎仪式' })); }
  if (openPanel) await screen.findByRole('region', { name: '银骑士' });
}
function actualBoundary(type: SilverKnightCommand['type']) {
  const data = natural(); let state = createSliceRun(data.final.runId, data.creation, data.seed);
  for (const intent of data.commands) { const before = state; state = applySliceIntent(state, intent); if (intent.type === 'SILVER_KNIGHT' && intent.command.type === type) return { before, intent, final: state }; }
  throw new Error(`Natural continuation never issued ${type}; do not invent a successful boundary.`);
}
function action(state: SliceState, command: SilverKnightCommand) { const a = projectSliceState(state).silverKnight.actions.find(a => JSON.stringify(a.command) === JSON.stringify(command)); if (!a) throw new Error('No matching real public Silver Knight action.'); return screen.getByRole('button', { name: name => name.startsWith(a.label) }); }
async function settled() { await waitFor(() => expect(screen.getByRole('region', { name: '银骑士' }).getAttribute('aria-busy')).toBe('false')); }
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe('Silver Knight navigation using the actual unchanged natural prefix', () => {
  it('opens new path from originalW93 and closes without state edits, healing or waking old surrendered guard', async () => {
    const capture = original(); expect(capture.commands).toHaveLength(340); const game = savedGame(capture.final), before = structuredClone(game.state); await mount(game);
    expect(screen.getByRole('region', { name: '银骑士' })).toBeTruthy(); expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(before); expectOriginals(game.state, before);
    await userEvent.click(screen.getByRole('button', { name: '关闭银骑士页面' })); expect(screen.getByRole('button', { name: /^工作，1行动/ })).toBeTruthy(); expect(game.state).toEqual(before);
    await userEvent.click(screen.getByRole('button', { name: '银骑士与六种亲猎仪式' })); expect(screen.getByRole('region', { name: '银骑士' })).toBeTruthy(); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
  it('commits the actual first guidance once and stays on the new path with old six roots intact', async () => {
    const boundary = actualBoundary('LEARN_GUIDANCE'), game = savedGame(boundary.before), before = structuredClone(game.state); await mount(game);
    if (boundary.intent.type !== 'SILVER_KNIGHT') throw new Error('Expected actual Silver Knight intent.'); await userEvent.click(action(game.state, boundary.intent.command)); await settled();
    expect(game.state).toEqual(boundary.final); expectOriginals(game.state, before); expect(game.submit).toHaveBeenCalledOnce(); expect(screen.getByRole('region', { name: '银骑士' })).toBeTruthy();
    expect(game.state.silverKnight.ritual.meetings).toEqual([]); expect(game.state.silverKnight.encounter.remains).toEqual([]);
  }, 30_000);
  it('shows original uninvestigated target and commits real investigation without inventing a kill or blessing', async () => {
    const boundary = actualBoundary('INVESTIGATE_HUNT'), game = savedGame(boundary.before), before = structuredClone(game.state); await mount(game);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '选择银骑士事项' }), 'hunts');
    if (boundary.intent.type !== 'SILVER_KNIGHT' || !('speciesId' in boundary.intent.command)) throw new Error('Expected actual original hunt investigation.');
    const command = { type: 'INVESTIGATE_HUNT' as const, speciesId: boundary.intent.command.speciesId, huntBehaviorVersion: 2 as const };
    const expected = applySliceIntent(before, { type: 'SILVER_KNIGHT', command });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '选择亲猎物种' }), command.speciesId); await userEvent.click(action(game.state, command)); await settled();
    expect(game.state.silverKnight.encounter.hunts.find(h => h.speciesId === command.speciesId)?.huntBehaviorVersion).toBe(2);
    expect(game.submit).toHaveBeenCalledWith(expect.objectContaining({ payload: { type: 'SILVER_KNIGHT', command } }));
    expect(game.state).toEqual(expected); expectOriginals(game.state, before); expect(game.submit).toHaveBeenCalledOnce(); expect(game.state.silverKnight.encounter.remains).toEqual(before.silverKnight.encounter.remains); expect(game.state.silverKnight.ritual.meetings).toEqual(before.silverKnight.ritual.meetings);
  }, 30_000);
  it('save failure retains exact original state and locks unrelated new actions instead of claiming payment', async () => {
    const boundary = actualBoundary('LEARN_GUIDANCE'), game = savedGame(boundary.before, true), before = structuredClone(game.state); await mount(game);
    if (boundary.intent.type !== 'SILVER_KNIGHT') throw new Error('Expected original Silver intent.'); await userEvent.click(action(game.state, boundary.intent.command)); await screen.findAllByText('这次原操作尚未保存');
    expect(game.state).toEqual(before); expect(game.submit).toHaveBeenCalledOnce(); expectOriginals(game.state, before); expect(game.state.silverKnight.guidanceKnown).toBe(false);
  }, 30_000);
  it('reloads actual natural terminal without replacing its losses with a successful branch', async () => {
    const data = natural(), game = savedGame(data.final), before = structuredClone(game.state); await mount(game, false); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expectOriginals(game.state, migrateSliceState(original().final));
    if (game.state.status === 'DEAD') { expect(game.state.health).toBe(0); expect(screen.getByRole('heading', { name: game.state.ending!.title })).toBeTruthy(); expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull(); }
    else expect(game.state.health).toBeGreaterThan(0);
  }, 20_000);
});
