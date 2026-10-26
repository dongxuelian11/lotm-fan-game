/* @vitest-environment jsdom */
import { assertCombatRiskDisclosure } from './combat-risk-assertions';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, createSliceRun, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import { sliceDefaultCreationSelection } from '../../src/content/slice-creation';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

interface Boundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
const naturalPath = 'tests/fixtures/chaos-hunter-v01600/natural.json';
const boundaryPath = 'tests/fixtures/chaos-hunter-v01600/boundaries.json';
const boundary = (key: string) => readObjectEntry<Boundary>(boundaryPath, key);

function beforeOriginalTalk(): SliceState {
  // Exact saved living S3 boundary, followed only by the four original ordinary commands.
  // Decode one top-level entry at a time; never retain the full natural or boundary archive.
  let state = migrateSliceState(readObjectEntry<SliceState>(naturalPath, 'practiced'));
  const commands = readObjectEntry<SliceIntent[]>(naturalPath, 'commands');
  const reflected = commands.findIndex(c => c.type === 'CHAOS_HUNTER' && c.command.type === 'REFLECT');
  const talk = commands.findIndex((c, index) => index > reflected && c.type === 'CHAOS_HUNTER' && c.command.type === 'ENCOUNTER_TALK');
  if (reflected < 0 || talk < 0) throw new Error('Missing original living pre-contact prefix.');
  const suffix = commands.slice(reflected + 1, talk);
  expect(suffix).toEqual([
    { type: 'ACTION', action: 'WORK' }, { type: 'ACTION', action: 'WORK' },
    { type: 'ACTION', action: 'REST' }, { type: 'ACTION', action: 'REST' },
  ]);
  for (const command of suffix) state = applySliceIntent(state, command);
  expect(state).toMatchObject({ health: 100, injuryRisk: 2, careKnown: false, actionsRemaining: 3,
    progression: { sequence: 3 }, chaosHunter: { encounter: { status: 'AVAILABLE' } },
  });
  expect(state.injuries).toHaveLength(1);
  expect(state.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
  return state;
}

function savedGame(saved: SliceState) {
  let current = migrateSliceState(saved);
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The selected actual run already exists.');
    if (envelope.expectedRevision !== current.revision) throw new Error('Stale renderer revision.');
    current = applySliceIntent(current, envelope.payload);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: current.runId,
      previousRevision: envelope.expectedRevision, newRevision: current.revision,
      committedAt: '2026-10-13T18:00:00Z', replayed: false, state: projectSliceState(current),
    } };
  });
  return { get state() { return current; }, submit };
}
type Game = ReturnType<typeof savedGame>;
async function mount(game: Game) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
      week: state.week, date: state.date, status: state.status, revision: state.revision,
      updatedAt: '2026-10-13T17:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })),
    submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(
    screen.queryByRole('heading', { name: '人物卷宗' })
      ?? screen.queryByRole('region', { name: '混乱猎手' })
      ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null),
  ).toBeTruthy());
}
function notice(scope: HTMLElement = document.body) {
  return within(scope).getByRole('region', { name: '伤势与恢复路线' });
}
function originalPeople(state: SliceState) {
  return JSON.stringify({ character: state.character, chaosHunter: state.chaosHunter,
    arbiter: state.arbiter, sheriff: state.sheriff, interrogator: state.interrogator,
    judge: state.judge, punishmentKnight: state.punishmentKnight, imperativeMage: state.imperativeMage,
  });
}
async function openGrowth() {
  await userEvent.click(screen.getByRole('button', { name: '混乱猎手与有限规则' }));
  await screen.findByRole('region', { name: '混乱猎手' });
}
function expectNoNavigationOrExit(game: Game, before: string) {
  for (const region of screen.getAllByRole('region', { name: '伤势与恢复路线', hidden: true })) {
    for (const button of within(region).queryAllByRole('button', { hidden: true }) as HTMLButtonElement[]) {
      expect(button.disabled).toBe(true); fireEvent.click(button);
    }
  }
  expect(screen.queryByRole('dialog', { name: '选择调查目标' })).toBeNull();
  expect(game.submit).not.toHaveBeenCalled(); expect(JSON.stringify(game.state)).toBe(before);
}
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { cleanup(); delete window.sliceGame; vi.restoreAllMocks(); });

describe('medical recovery navigation through the actual SliceBridge', () => {
  it('puts recovery before general growth and exposes the actual clinic in the first two homepage previews', async () => {
    const game = savedGame(beforeOriginalTalk()), before = JSON.stringify(game.state);
    const target = projectSliceState(game.state).investigateTargets.find(t => t.id === 'CARE-ACCESS-01')!;
    expect(target).toBeTruthy(); await mount(game);
    const hud = screen.getByRole('complementary', { name: '人物摘要，可向下滚动查看详情' });
    expect(within(hud).getByRole('meter', { name: '健康' }).getAttribute('aria-valuenow')).toBe('100');
    expect(notice(hud).textContent).toContain('健康100仍不等于伤势痊愈');
    const guide = screen.getByRole('region', { name: '接下来' });
    expect(guide.textContent).toMatch(/伤势|恢复|诊疗/);
    const clues = screen.getByRole('region', { name: '当前任务与线索' });
    // Identify actual investigation targets, excluding the unrelated growth shortcut in this region.
    const targetLabels = new Set(projectSliceState(game.state).investigateTargets.map(t => t.label));
    const previews = within(clues).getAllByRole('button').filter(b => targetLabels.has(b.textContent!.trim()));
    expect(previews).toHaveLength(Math.min(2, targetLabels.size));
    expect(previews.map(b => b.textContent!.trim())).toContain(target.label);
    await userEvent.click(within(guide).getByRole('button', { name: '查看普通诊疗点' }));
    const drawer = await screen.findByRole('dialog', { name: '选择调查目标' });
    expect(within(drawer).getByRole('button', { name: name => name.startsWith(target.label) })).toBeTruthy();
    expect(game.submit).not.toHaveBeenCalled(); expect(JSON.stringify(game.state)).toBe(before);
  }, 20_000);

  it('navigates from real pre-TALK S3 growth, then discovers, pays 60 and heals only after the later real REST', async () => {
    const game = savedGame(beforeOriginalTalk());
    const before = JSON.stringify(game.state), people = originalPeople(game.state);
    const wound = structuredClone(game.state.injuries[0]!);
    const random = structuredClone(game.state.random), cash = game.state.cash, revision = game.state.revision;
    await mount(game); await openGrowth();
    expect(notice().textContent).toContain('未治疗重伤1处');
    await userEvent.click(within(notice()).getByRole('button', { name: '查看普通诊疗点' }));
    const drawer = await screen.findByRole('dialog', { name: '选择调查目标' });
    expect(screen.queryByRole('region', { name: '混乱猎手' })).toBeNull();
    expect(game.submit).not.toHaveBeenCalled(); expect(JSON.stringify(game.state)).toBe(before);
    await userEvent.click(within(drawer).getByRole('button', { name: /^核实普通诊疗点/ }));
    await screen.findByRole('button', { name: '回到休养行动' });
    expect(vi.mocked(game.submit).mock.calls[0]![0].payload).toEqual({ type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' });
    expect(game.state).toMatchObject({ careKnown: true, health: 100, cash, actionsRemaining: 2, injuryRisk: 2 });
    expect(game.state.injuries).toEqual([wound]); expect(game.state.random).toEqual(random);

    // The route can also leave a dedicated growth page for the real, focusable REST button.
    await openGrowth();
    await userEvent.click(within(notice()).getByRole('button', { name: '回到休养行动' }));
    const rest = await screen.findByRole('button', { name: '休养，1行动，恢复身心' });
    await waitFor(() => expect(document.activeElement).toBe(rest));
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state.revision).toBe(revision + 1);
    await userEvent.click(rest);
    const care = await screen.findByRole('dialog', { name: '先处理伤口' });
    expect(game.state.actionsRemaining).toBe(1); expect(game.state.cash).toBe(cash);
    expect(game.state.injuries).toEqual([wound]);
    const event = game.state.activeEvent!;
    // This ordinary event remains the gate: recovery cannot close it or pay on the player's behalf.
    expect(projectSliceState(game.state).recovery).toMatchObject({ stage: 'CARE_CHOICE', locked: true });
    for (const region of screen.getAllByRole('region', { name: '伤势与恢复路线', hidden: true })) {
      expect(within(region).queryByRole('button', { hidden: true })).toBeNull();
    }
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: '先处理伤口' })).toBeTruthy();
    expect(game.submit).toHaveBeenCalledTimes(2);
    expect(game.state.activeEvent).toEqual(event);
    await userEvent.click(within(care).getByRole('button', { name: /^支付60便士处置/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '先处理伤口' })).toBeNull());
    expect(game.state.cash).toBe(cash - 60); expect(game.state.actionsRemaining).toBe(1);
    expect(game.state.injuries).toEqual([{ ...wound, treatedRevision: revision + 3 }]);
    expect(game.state.injuryRisk).toBe(2);
    expect(notice().textContent).toContain('已处置待康复重伤1处');
    expect(game.state.random).toEqual(random); expect(originalPeople(game.state)).toBe(people);
    await userEvent.click(screen.getByRole('button', { name: '休养，1行动，恢复身心' }));
    await waitFor(() => expect(game.state.injuries).toEqual([]));
    expect(game.state.injuryRisk).toBe(0); expect(game.state.health).toBe(100);
    expect(game.state.chaosHunter.encounter.status).toBe('AVAILABLE');
    expect(originalPeople(game.state)).toBe(people);
    expect(vi.mocked(game.submit).mock.calls.map(([envelope]) => envelope.payload)).toEqual([
      { type: 'ACTION', action: 'INVESTIGATE', targetId: 'CARE-ACCESS-01' },
      { type: 'ACTION', action: 'REST' },
      { type: 'EVENT_CHOICE', eventInstanceId: event.instanceId, choiceId: 'PAY' },
      { type: 'ACTION', action: 'REST' },
    ]);
  }, 30_000);

  it('keeps an actual in-case body in its original scene when the recovery route is locked', async () => {
    const game = savedGame(boundary('paired-line-actual-attempt').final), before = JSON.stringify(game.state);
    expect(projectSliceState(game.state).chaosHunter.insideCase).toBe(true);
    await mount(game);
    expect(notice().textContent).toContain('这里不会自动退出');
    expectNoNavigationOrExit(game, before);
    expect(screen.getByRole('region', { name: '混乱猎手' })).toBeTruthy();
  }, 20_000);

  it('keeps actual TALK-ready encounter lock and never sends LEAVE_ENCOUNTER from recovery guidance', async () => {
    const ready = applySliceIntent(beforeOriginalTalk(), { type: 'CHAOS_HUNTER', command: { type: 'ENCOUNTER_TALK' } });
    const game = savedGame(ready), before = JSON.stringify(game.state);
    expect(game.state.chaosHunter.encounter.status).toBe('READY');
    await mount(game);
    expect(notice().textContent).toContain('这里不会自动退出');
    expectNoNavigationOrExit(game, before);
    expect(game.state.chaosHunter.encounter.scene.playerPosition).toBe('COURT');
    expect(game.state.chaosHunter.encounter.status).toBe('READY');
  }, 20_000);

  it('makes 35/30/35 visible in the original battle while leaving the existing consequence wheel and save unchanged', async () => {
    const game = savedGame(boundary('combat-first').beforeLast), before = JSON.stringify(game.state);
    const view = projectSliceState(game.state);
    expect(view.combat!.consequenceWeights).toEqual({ light: 35, heavy: 30, death: 35 });
    expect(view.recovery.nextLoss.weights).toEqual(view.combat!.consequenceWeights);
    await mount(game);
    const battle = screen.getByRole('dialog', { name: view.combat!.title ?? "普通人追击" });
    const banner = await assertCombatRiskDisclosure(battle, view.combat!.consequenceWeights);
    expect(banner).toBe(notice(battle));
    expect(within(banner).getByText(/轻伤 35% · 重伤 30% · 死亡 35%/)).toBeTruthy();
    expect(banner.textContent).toMatch(/不是每回合死亡概率|并非每回合死亡概率/);
    expectNoNavigationOrExit(game, before);
    expect(screen.getByRole('button', { name: '确认姿态，结算完整回合' })).toBeTruthy();
    // Read one historical terminal only. No replay of or write to the immutable old-death fixture.
    expect(migrateSliceState(readObjectEntry<SliceState>(naturalPath, 'final'))).toMatchObject({
      status: 'DEAD', health: 0, chaosHunter: { encounter: { status: 'LOST', scene: { playerPosition: 'COURT' } } },
    });
  }, 20_000);

  it('shows the route in the common growth modal and closes only navigation before opening real investigation', async () => {
    // Directed UI-only variation of an ordinary creation: one untreated heavy/risk2 at H100.
    // This is not a campaign continuation or a claimed natural injury.
    let ordinary = createSliceRun('medical-common-ui', sliceDefaultCreationSelection, 'medical-common-ui');
    for (let i = 0; i < 8 && ordinary.activeEvent; i++) {
      const event = projectSliceState(ordinary).activeEvent!;
      const choice = event.choices.find(c => c.enabled)!;
      ordinary = applySliceIntent(ordinary, { type: 'EVENT_CHOICE', eventInstanceId: event.instanceId, choiceId: choice.id });
    }
    expect(ordinary.activeEvent).toBeNull();
    ordinary.injuries = [{ id: 'medical-common-ui:directed-heavy', severity: 'HEAVY', acquiredRevision: ordinary.revision, treatedRevision: null }];
    ordinary.injuryRisk = 2; ordinary.health = 100;
    const game = savedGame(ordinary), before = JSON.stringify(game.state);
    const originalTargets = projectSliceState(game.state).investigateTargets;
    expect(originalTargets.findIndex(t => t.id === 'CARE-ACCESS-01')).toBe(2);
    await mount(game);
    const clues = screen.getByRole('region', { name: '当前任务与线索' });
    expect(within(clues).getByRole('button', { name: '核实普通诊疗点' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const growth = screen.getByRole('dialog');
    await userEvent.click(within(notice(growth)).getByRole('button', { name: '查看普通诊疗点' }));
    const drawer = await screen.findByRole('dialog', { name: '选择调查目标' });
    expect(within(drawer).getByRole('button', { name: /^核实普通诊疗点/ })).toBeTruthy();
    expect(game.submit).not.toHaveBeenCalled(); expect(JSON.stringify(game.state)).toBe(before);
  }, 20_000);
});
