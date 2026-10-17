/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { readObjectEntry } from '../helpers/read-object-entry';

vi.setConfig({ testTimeout: 60_000 });
const ROOT = 'tests/fixtures/writer-v01880';
const PANEL = '作家成长';
const ENTRY = '作家与原阅览处';
const natural = (key: string) => migrateSliceState(readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
const boundary = (name: string) => {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual Writer boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const snapshot = (name: string) => {
  const snapshots = readObjectEntry<Record<string, string>>(`${ROOT}/natural.json`, 'snapshots');
  if (!snapshots[name]) throw new Error(`Missing actual Writer snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${snapshots[name]}`, 'utf8')));
};

/** Actual 667-command capture only. No directed resources, history edits,
 * selected cursors or alternate living ending. Migration is always applied. */
function savedGame(input: unknown) {
  let state = migrateSliceState(input); assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T10:39:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'browser', activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-15T10:38:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
}
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openGrowth() {
  await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
  return screen.findByRole('region', { name: PANEL });
}
function assertResources(state: SliceState) {
  const current = projectSliceState(state), resources = screen.getByRole('region', { name: '作家当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${current.writer.title}`);
  expect(resources.textContent).toContain(`健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${current.actionsRemaining} · 现有伤势${current.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertRound(reveal: HTMLElement, round: SliceCombatRound) {
  const outcome = round.writerOutcome;
  if (!outcome) throw new Error('Expected the actual saved Writer round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  const record = within(reveal).getByRole('region', { name: '作家本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, i) => {
    expect(rows[i]!.textContent).toContain(action.label);
    expect(rows[i]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
  });
  if (round.consequenceDomain === 'BODY') {
    expect(record.textContent).toContain('本回合按实际身体冲击结算伤势');
    expect(round.consequenceWeights).not.toBeNull();
    const weights = round.consequenceWeights!;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
  } else {
    expect(round.consequenceDomain).toBeUndefined(); expect(round.consequenceWeights).toBeNull();
    expect(record.textContent).toContain('本回合没有身体或精神后果盘');
    expect(reveal.textContent).not.toContain('败者后果盘：轻伤');
  }
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

describe('Writer actual saved campaign navigation and reopening', () => {
  it('opens optional Writer preparation from the exact S2 source without replacing its historical round or current growth', async () => {
    const game = savedGame(natural('prefixFinal')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(2); expect(before.writer.guidanceKnown).toBe(false);
    expect(before.lastCombatRound?.discernerOutcome).toBeTruthy();
    await mount(game);
    const history = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(history.textContent).toContain(projectSliceState(before).lastCombatRound!.consequence);
    expect(within(history).queryByRole('region', { name: '作家本回合实际记录' })).toBeNull();
    await acknowledgeRound(); await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(await screen.findByRole('region', { name: '作家服药准备' })).toBeTruthy(); assertResources(before);
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '洞察者' })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it('confirms the actual first bottle once and reopens its saved promotion with all 23 inherited and two zero new abilities', async () => {
    const capture = boundary('consume-writer-potion-1'), game = savedGame(capture.before), before = structuredClone(game.state);
    expect(capture.intent).toEqual({ type: 'WRITER', command: { type: 'CONSUME', bottleId: 'writer-potion-1', confirmed: true } });
    await mount(game); await acknowledgeRound();
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const trigger = within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button');
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '作家操作确认' });
    expect(dialog.textContent).toContain('第1瓶'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(before);
    await userEvent.click(trigger);
    const confirm = within(screen.getByRole('dialog', { name: '作家操作确认' })).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state).toEqual(capture.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: capture.intent });
    expect(game.state.writer.bottles[0]!.outcome).toBe('SUCCESS');
    cleanup(); await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const panel = await openGrowth(); assertResources(capture.final);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(game.state).writer.abilities;
    expect(abilities).toHaveLength(25); expect(abilities.slice(0, 23).filter(ability => ability.mastery === 0)).toHaveLength(8);
    expect(abilities.slice(23).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the actual completed life reports with mastery8/0, returns to ordinary living and keeps old S2 actions closed', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy(); assertResources(before);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '作家目标' }), 'scheduled-return');
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('能力判定：失败');
    expect(screen.getByRole('region', { name: '合理安排的当前窗口' }).textContent).toContain('合理安排：尝试1次、成功0次、实际生效0次');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /^工作，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /^休养，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(projectSliceState(game.state).discerner.actions).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const growth = await screen.findByRole('region', { name: '序列0 空想家' });
    expect(within(growth).getByRole('button', { name: '听取四方公共救援与原特性指导' })).toBeTruthy();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it.each([1, 5])('submits the exact captured round%s command once, then reopens its actual result without rerolling', async number => {
    const capture = boundary(`combat-round-${number}`), game = savedGame(capture.before), before = structuredClone(game.state);
    if (capture.intent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual saved combat command.');
    const intent = capture.intent, current = projectSliceState(before), battle = current.combat!;
    await mount(game); await acknowledgeRound();
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    const resources = within(stage).getByRole('region', { name: '作家本回合实际资源' });
    expect(resources.textContent).toContain(`本人健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);
    expect(battle.writer!.targetId).toBe('WR1-LUCIAN-VALE');
    const stance = battle.stances.find(stance => stance.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(capture.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), capture.final.lastCombatRound!);
    cleanup(); await mount(game);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), capture.final.lastCombatRound!);
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the genuine fifth-round death as read-only twice without inventing a successful exit or more ordinary work', async () => {
    const game = savedGame(natural('final')), before = structuredClone(game.state);
    expect(before).toMatchObject({ status: 'DEAD', health: 0, week: 144, combat: null });
    expect(before.writer.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 5, exitMetres: 0, exitSeconds: 0 });
    for (let n = 0; n < 2; n++) {
      await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), before.lastCombatRound!);
      await acknowledgeRound();
      const ending = await screen.findByRole('heading', { name: projectSliceState(before).ending!.title });
      expect(screen.getByText('只读封存卷宗')).toBeTruthy();
      expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull(); expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
      expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull(); expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
      await userEvent.click(within(ending.parentElement!).getByRole('button', { name: '返回标题' }));
      expect((await screen.findByRole('button', { name: /继续游戏/ }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: /查看封存/ }) as HTMLButtonElement).disabled).toBe(false);
      expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); cleanup();
    }
  });
});
