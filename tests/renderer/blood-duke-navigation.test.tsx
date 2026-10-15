/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { BLOOD_DUKE_ENEMY_ABILITY_WHEEL, BLOOD_DUKE_ENEMY_COUNT_WHEEL } from '../../src/domain/blood-duke/combat.js';
import type { BloodDukeCommand } from '../../src/domain/blood-duke/types.js';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { readObjectEntry } from '../helpers/read-object-entry.js';

const ROOT = 'tests/fixtures/blood-duke-v01800';
const PANEL = '鲜血大公成长', ENTRY = '鲜血大公与原房约束', CONFIRMATION = '鲜血大公操作确认';
interface NaturalBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
/** Immutable actual 724-command capture, including its failed first potion and
 * three-round death. Read one entry at a time; never manufacture a living end. */
function boundary(name: string): NaturalBoundary {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  const file = index[name]; if (!file) throw new Error(`Missing actual Blood Duke boundary: ${name}`);
  return { beforeLast: migrateSliceState(readObjectEntry(`${ROOT}/${file}`, 'beforeLast')),
    lastIntent: readObjectEntry<SliceIntent>(`${ROOT}/${file}`, 'lastIntent'),
    final: migrateSliceState(readObjectEntry(`${ROOT}/${file}`, 'final')) };
}
const projection = (state: SliceState) => projectSliceState(state).bloodDuke;
function savedGame(input: SliceState, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0, releaseFirstSave = () => {};
  assertValidSliceState(state);
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('This original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '这次原操作尚未保存', retryable: true } };
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T03:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
      status: state.status, revision: state.revision, updatedAt: '2026-10-15T02:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function acknowledgeOldRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
function actionButton(state: SliceState, command: BloodDukeCommand): HTMLButtonElement {
  const action = projection(state).actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual Blood Duke action: ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement;
}
async function control(state: SliceState, command: BloodDukeCommand) {
  if ('bottleId' in command) {
    const bottle = projection(state).bottles.find(entry => entry.id === command.bottleId)!;
    const goal = screen.getByRole('button', { name: `${bottle.title} · ${bottle.status}` }) as HTMLButtonElement;
    if (!goal.disabled) await userEvent.click(goal);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
function doseFrom(entry: NaturalBoundary): Extract<BloodDukeCommand, { type: 'CONSUME' }> {
  if (entry.lastIntent.type !== 'BLOOD_DUKE' || entry.lastIntent.command.type !== 'CONSUME') throw new Error('Expected an actual potion boundary.');
  return entry.lastIntent.command;
}
function assertNaturalRound(reveal: HTMLElement, round: SliceCombatRound) {
  expect(round.bloodDukeOutcome).toBeTruthy(); expect(round.consequenceDomain).toBe('BODY');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).not.toContain('精神后果盘');
  if (round.consequenceWeights) {
    const weights = round.consequenceWeights;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
  }
  const outcome = round.bloodDukeOutcome!, actual = within(reveal).getByRole('region', { name: '鲜血大公本回合实际记录' });
  expect(actual.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(actual.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order), rows = within(actual).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(action.label);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
  });
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

describe('Blood Duke actual natural growth and original selected bottles', () => {
  it('opens the actual S3 source, preserves the option to remain a Blatherer and closes without changing the campaign', async () => {
    expect(readObjectEntry<number>(`${ROOT}/natural.json`, 'prefixCount')).toBe(583);
    expect(readObjectEntry<SliceIntent[]>(`${ROOT}/natural.json`, 'commands')).toHaveLength(724);
    const before = boundary('guidance').beforeLast, game = savedGame(before);
    expect(before).toMatchObject({ week: 154, cash: 500, health: 100, mind: 100, spirituality: 120, progression: { sequence: 3, acting: 100 } });
    await mount(game); await acknowledgeOldRound();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    await screen.findByRole('region', { name: '呓语者' });
    await userEvent.click(screen.getByRole('button', { name: '关闭呓语者页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '呓语者' })).toBeNull();
    expect(panel.textContent).toContain('当前8/12'); expect(panel.textContent).toContain('继续停留呓语者');
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('loads the actual second-bottle promotion ahead of stale Devil results and old Blatherer growth', async () => {
    const before = boundary('consume-blood-duke-potion-2').final, game = savedGame(before);
    expect(before.lastCombatRound?.devilOutcome).toBeTruthy(); expect(before.progression.sequence).toBe(2);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '呓语者' })).toBeNull();
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    expect(projection(before).abilities).toHaveLength(16);
    for (const ability of projection(before).abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${before.progression.mastery[ability.id]}`);
    expect(panel.textContent).not.toMatch(/候选|原创G|本作G|原文未核|编号推断/);
    expect(within(panel).getByRole('region', { name: '鲜血大公当前资源' }).textContent).toContain('精神85/100');
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('reopens the actually borrowed original card and current S2 case without copying permission, people or movement', async () => {
    const before = boundary('door-restraint-take_card-actual').final, game = savedGame(before);
    expect(before.blatherer.life).toMatchObject({ playerLocation: 'A', card: { location: 'PLAYER', owner: 'BL3-NORA' }, volunteer: { age: 46, location: 'A' } });
    for (let load = 0; load < 2; load++) {
      await mount(game); const panel = await screen.findByRole('region', { name: PANEL });
      expect(screen.queryByRole('region', { name: '呓语者', hidden: true })).toBeNull();
      expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
      const room = within(panel).getByRole('region', { name: '鲜血大公原场事务' });
      expect(room.textContent).toContain('原卡已借持，尚未归还');
      expect(room.textContent).toContain(`本人实际累计步行${before.blatherer.life.playerTravelMetres}米`);
      expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
      expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); cleanup();
    }
  }, 20_000);

  it('cancels the real failing first dose, blocks duplicate saves, then retries the same envelope with its actual failed outcome', async () => {
    const capture = boundary('consume-blood-duke-potion-1'), dose = doseFrom(capture), before = capture.beforeLast;
    expect(capture.final).toMatchObject({ health: 85, mind: 75, progression: { sequence: 3 } });
    expect(capture.final.bloodDuke.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE' });
    const game = savedGame(before, { deferFirstSave: true, failFirstSave: true }); await mount(game); await acknowledgeOldRound();
    await userEvent.click(await control(game.state, dose));
    let dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await control(game.state, dose)); dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一药瓶' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before); expect(actionButton(before, dose).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(screen.queryByRole('dialog', { name: CONFIRMATION })).toBeNull(); expect(game.state).toEqual(before);
    fireEvent.click(actionButton(before, dose)); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' }));
    await waitFor(() => expect(game.state).toEqual(capture.final));
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: capture.lastIntent });
    expect(game.state.random.cursor).toBe(before.random.cursor + 1); expect(game.state.bloodDuke.preparedWeek).toBeNull();
    expect(game.state.blatherer).toEqual(before.blatherer); expect(game.state.injuries).toEqual(before.injuries);
    cleanup(); await mount(game); expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 20_000);

  it('distinguishes the spent first bottle from the real second bottle and saves only the selected second dose', async () => {
    const capture = boundary('consume-blood-duke-potion-2'), dose = doseFrom(capture), before = capture.beforeLast, game = savedGame(before);
    await mount(game); await acknowledgeOldRound();
    const [first, second] = projection(before).bottles;
    expect(before.bloodDuke.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE' });
    expect(before.bloodDuke.bottles[1]!.status).toBe('PLAYER');
    await userEvent.click(screen.getByRole('button', { name: `${first!.title} · ${first!.status}` }));
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽');
    expect(screen.queryByRole('button', { name: /^独立确认服用第1瓶/, hidden: true })).toBeNull();
    await userEvent.click(await control(game.state, dose)); const dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    expect(dialog.textContent).toContain(second!.source); expect(dialog.textContent).toContain('第2瓶');
    await userEvent.click(within(dialog).getByRole('button', { name: '确认服用这一药瓶' }));
    await waitFor(() => expect(game.state).toEqual(capture.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: capture.lastIntent });
    expect(game.state.bloodDuke.bottles[0]).toEqual(before.bloodDuke.bottles[0]);
    expect(game.state.bloodDuke.bottles[1]).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS' });
    expect(game.state.progression.sequence).toBe(2); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  }, 20_000);
});

describe('Blood Duke actual three-round BODY battle and read-only death navigation', () => {
  it('prioritizes the real new battle over the stale Devil round with its own enemy wheels and actual cleared room', async () => {
    const before = boundary('independent-optional-fight').final, game = savedGame(before), battle = projectSliceState(before).combat!;
    expect(before.combat?.encounterId).toBe('BLOOD_DUKE_DISPUTE'); expect(before.lastCombatRound?.devilOutcome).toBeTruthy();
    expect(battle.enemyAbilityWheel).toEqual(BLOOD_DUKE_ENEMY_ABILITY_WHEEL); expect(battle.enemyCountWheel).toEqual(BLOOD_DUKE_ENEMY_COUNT_WHEEL);
    expect(before.blatherer.life).toMatchObject({ playerLocation: 'A', volunteer: { location: 'OUTSIDE' }, card: { location: 'NORA' } });
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    const resources = within(stage).getByRole('region', { name: '鲜血大公本回合实际资源' });
    expect(resources.textContent).toContain(`本人健康${before.health}/100`); expect(resources.textContent).toContain('本场没有成人同伴参战');
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of battle.enemyAbilityWheel) expect(stage.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    for (const wheel of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    const panel = screen.getByRole('region', { name: PANEL, hidden: true });
    for (const button of within(panel).getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('region', { name: '呓语者', hidden: true })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each([
    ['combat-round-1', 1, 'ACTIVE', 100, 'ENEMY'],
    ['combat-round-2', 2, 'ACTIVE', 100, 'PLAYER'],
    ['combat-round-3', 3, 'DEAD', 0, 'ENEMY'],
  ] as const)('reopens actual %s twice with its saved BODY result before old growth or ending navigation', async (name, number, status, health, winner) => {
    const before = boundary(name).final, game = savedGame(before), round = before.lastCombatRound!;
    expect(before).toMatchObject({ status, health, injuryRisk: 0 }); expect(before.injuries).toEqual([]);
    expect(round).toMatchObject({ round: number, consequenceDomain: 'BODY', winner, retreat: 'NONE' });
    await mount(game); let reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertNaturalRound(reveal, round);
    expect(screen.queryByRole('region', { name: '呓语者', hidden: true })).toBeNull();
    if (status === 'DEAD') {
      await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
      await screen.findByRole('heading', { name: projectSliceState(before).ending!.title });
      expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
      expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    } else {
      await userEvent.click(within(reveal).getByRole('button', { name: '进入下一回合' }));
      const battle = await screen.findByRole('dialog', { name: projectSliceState(before).combat!.title! });
      expect(within(battle).getByRole('region', { name: '鲜血大公本回合实际资源' }).textContent).toContain(`本人健康${health}/100`);
    }
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    cleanup(); await mount(game); reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertNaturalRound(reveal, round);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('keeps the actual final death archived without healing, revival, invented exit or reopening old enemies', async () => {
    const before = migrateSliceState(readObjectEntry(`${ROOT}/natural.json`, 'final')), game = savedGame(before);
    expect(before).toEqual(boundary('combat-round-3').final);
    expect(before).toMatchObject({ status: 'DEAD', health: 0, mind: 97, spirituality: 116, combat: null });
    expect(before.bloodDuke.encounter).toMatchObject({ status: 'LOST', terminal: { outcome: 'PLAYER_DEAD', round: 3, exitMetres: 0, exitSeconds: 0 } });
    expect(before.blatherer.life).toMatchObject({ playerLocation: 'A', volunteer: { location: 'OUTSIDE' }, card: { location: 'NORA' } });
    expect(before.blatherer.encounter.status).toBe('AVAILABLE'); expect(before.devil.encounter.enemyStatus).toBe('SURRENDERED');
    await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertNaturalRound(reveal, before.lastCombatRound!);
    await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
    const endingHeading = await screen.findByRole('heading', { name: projectSliceState(before).ending!.title });
    expect(screen.getByText('只读封存卷宗')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull(); expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
    expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
    await userEvent.click(within(endingHeading.parentElement!).getByRole('button', { name: '返回标题' }));
    expect((await screen.findByRole('button', { name: /继续游戏/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /查看封存/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);
});
