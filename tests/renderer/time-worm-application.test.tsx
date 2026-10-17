/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { TimeWormCommand } from '../../src/domain/time-worm/types';
import type { TimeWormCaseId } from '../../src/domain/time-worm/life';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { stableStringify } from '../../src/domain/canonical';
import { ae, dose, ordinary, originalErrorRoots, prepared, promoted, ready } from '../domain/time-worm-directed-helper';

vi.setConfig({ testTimeout: 120_000 });
const PANEL = '时之虫成长', ENTRY = '时之虫与登记室', CONFIRM = '时之虫操作确认';
const THEFT = 'error.s1.short-time-theft', RELEASE = 'error.s1.time-release';

// Directed public continuation of the existing actual551 source. Every potion,
// check, injury and combat outcome remains whatever the original reducer rolls.
// There are no edited resources, seeds/cursors, guaranteed wins or new captures.
function act(state: SliceState, ...commands: TimeWormCommand[]): SliceState {
  for (const command of commands) state = ae(state, command);
  assertValidSliceState(state); return state;
}
function enter(state: SliceState, caseId: TimeWormCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY', lastAp = false): SliceState {
  state = ready(state, { cash: 200, health: 100, mind: 30, spirituality: 30 });
  if (state.fateTrojan.life.site.playerEnergy < 9) state = act(state, { type: 'RECOVER_ENERGY' });
  state = act(state, { type: 'OBSERVE', caseId });
  state = ready(state, { ap: 1, cash: 200, mind: 30, spirituality: 30 });
  if (lastAp) while (state.actionsRemaining > 1) state = ordinary(state);
  return act(state, { type: 'PREPARE', caseId, method }, { type: 'CONSENT', permission: 'OWNER' },
    { type: 'CONSENT', permission: 'OBSERVER' }, { type: method === 'ABILITY' ? 'CONSENT' : 'DECLINE_CONSENT', permission: 'ABILITY' },
    { type: 'APPROACH' }, { type: 'BASELINE_LOOK' }, { type: 'DECLARE_LOOK' });
}
let practicedCache: SliceState | undefined;
function practiced(): SliceState {
  if (!practicedCache) {
    let state = promoted();
    for (const caseId of ['delayed-observation', 'released-interval', 'withdrawn-delay'] as const) {
      state = act(enter(state, caseId, 'ORDINARY'), { type: 'EXECUTE_LOOK' }, { type: 'EXIT_ROOM' }, { type: 'LEAVE' });
      state = act(ready(state), { type: 'REPORT', caseId });
    }
    practicedCache = act(ready(state), { type: 'REFLECT' });
  }
  return structuredClone(practicedCache);
}
function boundary(before: SliceState, command: TimeWormCommand) {
  const intent: SliceIntent = { type: 'TIME_WORM', command }, final = applySliceIntent(before, intent);
  assertValidSliceState(before); assertValidSliceState(final); return { before, intent, final };
}
type Boundary = ReturnType<typeof boundary>;

// One authoritative in-memory save. A failed persistence request applies
// nothing; only a successful receipt replaces the public state on reopening.
function savedGame(input: SliceState, failFirst = false) {
  let state = migrateSliceState(input), commits = 0, failNext = failFirst;
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    if (failNext) {
      failNext = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next);
    state = next; commits++;
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-15T21:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit,
    failNextSave() { failNext = true; } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: state, runs: [{ runId: state.runId, name: state.character.name,
        portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status,
        revision: state.revision, updatedAt: '2026-10-15T20:59:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
}
async function reopen(game: SavedGame) { cleanup(); await mount(game); }
async function ensurePanel() {
  const old = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (old) {
    await userEvent.click(within(old).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull());
  }
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
async function publicControl(state: SliceState, command: TimeWormCommand) {
  const action = projectSliceState(state).timeWorm.actions.find(entry => stableStringify(entry.command) === stableStringify(command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  const picker = screen.getByRole('combobox', { name: '时之虫目标' }) as HTMLSelectElement;
  const target = 'bottleId' in command ? command.bottleId : 'caseId' in command ? command.caseId
    : command.type.startsWith('ENCOUNTER_') || command.type === 'LEAVE_ENCOUNTER' ? 'encounter' : null;
  if (target !== null && !picker.disabled && picker.value !== target) await userEvent.selectOptions(picker, target);
  const direct = screen.queryAllByRole('button', { name: name => name.startsWith(action!.label) });
  // Owner and ability withdrawal currently share authored button copy. When
  // both are in the common-action area, retain their public action order.
  const sameLabel = projectSliceState(state).timeWorm.actions.filter(entry => entry.label === action!.label);
  let button = direct.length > 1 ? direct[sameLabel.findIndex(entry => entry.id === action!.id)] : direct[0];
  if (direct.length > 1) expect(direct).toHaveLength(sameLabel.length);
  if (!button) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '时之虫其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(action!.label) });
  }
  return button;
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
async function confirm(game: SavedGame, save: Boundary) {
  if (save.intent.type !== 'TIME_WORM') throw new Error('Expected a Time Worm boundary.');
  expect(game.state).toEqual(save.before);
  await userEvent.click(await publicControl(save.before, save.intent.command));
  const dialog = screen.getByRole('dialog', { name: CONFIRM });
  const button = within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
  fireEvent.click(button); fireEvent.click(button);
}
async function commit(game: SavedGame, save: Boundary) {
  const count = game.submit.mock.calls.length + 1;
  await confirm(game, save);
  await waitFor(() => expect(game.state.revision).toBe(save.final.revision));
  expect(game.state).toEqual(save.final); assertEnvelope(game, save.before, save.intent, count);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
}
function assertResources(state: SliceState) {
  const view = projectSliceState(state), resources = screen.getByRole('region', { name: '时之虫当前资源' });
  expect(resources.textContent).toContain(`健康${view.health}/${view.maxHealth} · 精神${view.mind}/${view.maxMind} · 灵性${view.spirituality}/${view.maxSpirituality} · 排异${view.timeWorm.pollution}`);
  expect(resources.textContent).toContain(`${view.timeWorm.resources!.cash} · 本周行动${state.actionsRemaining} · 现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertClock(state: SliceState) {
  const life = projectSliceState(state).timeWorm.life;
  const clock = screen.getByRole('region', { name: '当前时钟与待执行查看' });
  expect(clock.textContent).toContain(`现场时钟${life.clockSeconds}秒；本阶段实际经过${life.elapsedSeconds}秒`);
  if (life.declaration) {
    expect(clock.textContent).toContain(`声明于${life.declaration.declaredAt}秒，原定${life.declaration.baselineDueAt}秒`);
    if (life.declaration.delayStartedAt !== null) expect(clock.textContent).toContain(`本次延迟从${life.declaration.delayStartedAt}秒开始，原定到${life.declaration.dueAt}秒；已实际延迟${life.declaration.delayedSeconds}秒`);
  }
  const positions = screen.getByRole('region', { name: '实际位置与普通退出' });
  expect(positions.textContent).toContain(`本阶段本人实走${life.playerTravelMetres}米，莉娜实走${life.linaTravelMetres}米，维克托实走${life.victorTravelMetres}米`);
  const intervals = screen.getByRole('region', { name: '暂存时段与实际应用' });
  if (life.pending) expect(intervals.textContent).toContain(`还剩${life.pendingRemainingSeconds}秒，到${life.pending.expiresAt}秒到期`);
  else expect(intervals.textContent).toContain('当前没有尚未用掉的暂存时段');
}
function assertRound(state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.timeWormOutcome;
  if (!outcome) throw new Error('Expected the actual committed Time Worm round.');
  const reveal = screen.getByRole('dialog', { name: '战斗回合结果' });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  const record = within(reveal).getByRole('region', { name: '时之虫本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record.querySelector('ol')!).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(action.label);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[index]!.textContent).toContain(`本槽实际从第${action.atSeconds}秒执行至第${action.completedAtSeconds}秒，经过${action.elapsedSeconds}秒`);
    expect(rows[index]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}`);
    if (action.fallbackReason) expect(rows[index]!.textContent).toContain(action.fallbackReason);
    if (action.finiteResult === 'PENDING') expect(rows[index]!.textContent).toContain('当前只是建立有限窗口，尚未对后续动作生效');
  });
  for (const wait of outcome.waits.filter(wait => wait.reason === 'DELAYED_ENEMY')) {
    expect(record.textContent).toContain(`已声明动作实际等候：第${wait.fromSeconds}秒至第${wait.toSeconds}秒，共${wait.seconds}秒`);
  }
  const consequence = round.consequenceDomain === 'BODY' ? '本回合按实际身体冲击结算伤势'
    : round.consequenceDomain === 'MENTAL' ? '本回合按实际精神压力结算，不生成身体伤口' : '本回合没有身体或精神后果盘';
  expect(record.textContent).toContain(consequence);
  expect(within(reveal).queryByRole('region', { name: '命运木马本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '命运木马' })).toBeNull();
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

describe('Time Worm application receipts, interruption and authoritative reopening', () => {
  it('cancels then consumes the actual first original bottle once and reopens its unchosen result', async () => {
    const save = boundary(prepared(), dose), game = savedGame(save.before);
    await mount(game); await ensurePanel(); assertResources(save.before);
    await userEvent.click(await publicControl(save.before, dose));
    const dialog = screen.getByRole('dialog', { name: CONFIRM });
    const bottle = projectSliceState(save.before).timeWorm.bottles.find(entry => entry.id === dose.bottleId)!;
    expect(dialog.textContent).toContain(bottle.title); expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(save.before); expect(game.submit).not.toHaveBeenCalled();
    await commit(game, save); await reopen(game); await ensurePanel(); assertResources(save.final);
    expect(game.state.timeWorm.bottles.find(entry => entry.id === dose.bottleId)).toEqual(save.final.timeWorm.bottles.find(entry => entry.id === dose.bottleId));
    expect(game.state.timeWorm.bottles.find(entry => entry.id === dose.bottleId)!.status).toBe('CONSUMED');
    expect({ ...game.state.character, coreStats: save.before.character.coreStats }).toEqual(save.before.character);
    expect(originalErrorRoots(game.state)).toEqual(originalErrorRoots(save.before));
    expect(game.state).toEqual(save.final); expect(game.commits).toBe(1);
  });

  it('keeps old time and resources on failed paid-cast persistence and retries the identical envelope once', async () => {
    const save = boundary(enter(promoted(), 'delayed-observation'), { type: 'SHORT_TIME_THEFT' });
    const game = savedGame(save.before, true); await mount(game); assertResources(save.before); assertClock(save.before);
    const resources = screen.getByRole('region', { name: '时之虫当前资源' }).textContent;
    const clock = screen.getByRole('region', { name: '当前时钟与待执行查看' }).textContent;
    await confirm(game, save); await screen.findByRole('button', { name: '重试这次操作' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    assertEnvelope(game, save.before, save.intent, 1); expect(game.commits).toBe(0); expect(game.state).toEqual(save.before);
    expect(screen.getByRole('region', { name: '时之虫当前资源' }).textContent).toBe(resources);
    expect(screen.getByRole('region', { name: '当前时钟与待执行查看' }).textContent).toBe(clock);
    expect((screen.getByRole('combobox', { name: '时之虫目标' }) as HTMLSelectElement).disabled).toBe(true);
    for (const button of within(screen.getByRole('region', { name: PANEL })).queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    const envelope = game.submit.mock.calls[0]![0], retry = screen.getByRole('button', { name: '重试这次操作' });
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(game.state.revision).toBe(save.final.revision));
    expect(game.submit).toHaveBeenCalledTimes(2); expect(game.submit.mock.calls[1]![0]).toEqual(envelope); expect(game.commits).toBe(1);
    await reopen(game); assertResources(save.final); assertClock(save.final);
    expect(game.state).toEqual(save.final);
    expect(game.state.spirituality).toBe(save.before.spirituality - 8); expect(game.state.mind).toBe(save.before.mind - 2);
    expect(game.state.timeWorm.life.clockSeconds).toBe(save.before.timeWorm.life.clockSeconds + 1);
    expect(game.state.actionsRemaining).toBe(save.before.actionsRemaining); expect(game.state.week).toBe(save.before.week);
    expect(game.state.fateTrojan.life.site.parcel).toEqual(save.before.fateTrojan.life.site.parcel);
    expect(game.state.timeWorm.life.cases['delayed-observation'].attempts.at(-1)!.theft.effects).toBe(0);
    expect(game.state.progression.mastery[THEFT]).toBe(save.before.progression.mastery[THEFT]);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
  });

  it('reopens zero-AP owner withdrawal and actual ordinary departure without reversing time or costs', async () => {
    const state = act(enter(promoted(), 'delayed-observation', 'ABILITY', true), { type: 'SHORT_TIME_THEFT' });
    expect(state.actionsRemaining).toBe(0);
    const game = savedGame(state); await mount(game);
    const withdrawal = boundary(state, { type: 'WITHDRAW_CONSENT', permission: 'OWNER' });
    await commit(game, withdrawal); await reopen(game); assertResources(withdrawal.final); assertClock(withdrawal.final);
    const attempt = game.state.timeWorm.life.cases['delayed-observation'].attempts.at(-1)!;
    expect(attempt.permission.owner).toBe('WITHDRAWN'); expect(attempt.declaration!.state).toBe('CANCELLED');
    expect(game.state.timeWorm.life.pending).toBeNull(); expect(game.state.timeWorm.life.clockSeconds).toBe(state.timeWorm.life.clockSeconds);
    const beforeExit = structuredClone(game.state.fateTrojan.life.site);
    for (const command of [{ type: 'EXIT_ROOM' }, { type: 'LEAVE' }] as const) {
      expect(game.state.actionsRemaining).toBe(0); const save = boundary(game.state, command); await commit(game, save);
      const receipt = game.state.timeWorm.life.journal.at(-1)!;
      expect(receipt.before.actions).toBe(0); expect(receipt.after.actions).toBe(0);
      expect(game.state.spirituality).toBe(state.spirituality); expect(game.state.mind).toBe(state.mind);
    }
    await reopen(game); await ensurePanel(); assertResources(game.state); assertClock(game.state);
    const site = game.state.fateTrojan.life.site;
    expect(site.playerLocation).toBe('OUTSIDE'); expect(site.lina.location).toBe('OUTSIDE'); expect(site.victor).toEqual(beforeExit.victor);
    expect(site.playerTravelMetres).toBe(beforeExit.playerTravelMetres + 4); expect(site.playerEnergy).toBe(beforeExit.playerEnergy - 4);
    expect(site.lina.travelMetres).toBe(beforeExit.lina.travelMetres + 4); expect(site.lina.energy).toBe(beforeExit.lina.energy - 4);
    expect(site.clockSeconds).toBe(beforeExit.clockSeconds + 9);
    for (const key of ['parcel', 'cabinet', 'link', 'fate', 'seals'] as const) expect(site[key]).toEqual(beforeExit[key]);
    expect(game.state.week).toBe(state.week + 1); expect(game.state.actionsRemaining).toBe(state.weeklyBudget);
    expect(game.state.progression.mastery[THEFT]).toBe(state.progression.mastery[THEFT]); expect(game.state.progression.mastery[RELEASE]).toBe(state.progression.mastery[RELEASE]);
    expect(game.commits).toBe(3); expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
  });

  it('prioritizes the new battle and exact saved round after a failed-intent retry and full reopening', async () => {
    const state = act(ready(practiced(), { ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 }),
      { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_POLICY', policy: 'ALL' });
    const start = boundary(state, { type: 'ENCOUNTER_FIGHT' }), game = savedGame(state);
    await mount(game); await commit(game, start); await reopen(game);
    const battle = projectSliceState(start.final).combat!;
    expect(start.final.combat).toMatchObject({ encounterId: 'TIME_WORM_DISPUTE', round: 1, lastRound: null });
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.queryByRole('region', { name: '命运木马' })).toBeNull();
    const resources = within(stage).getByRole('region', { name: '时之虫本回合实际资源' });
    expect(resources.textContent).toContain(`${battle.timeWorm!.enemyName}：健康${battle.timeWorm!.enemyHealth}、精神${battle.timeWorm!.enemyMind}、灵性${battle.timeWorm!.enemySpirituality}`);
    expect(within(stage).queryByRole('region', { name: '命运木马本回合实际资源' })).toBeNull();
    const before = game.state, intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    const expected = applySliceIntent(before, intent); assertValidSliceState(expected); game.failNextSave();
    const stance = battle.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const button = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(game.submit).toHaveBeenCalledTimes(2));
    const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(game.state).toEqual(before); expect(game.commits).toBe(1);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const failedEnvelope = game.submit.mock.calls[1]![0]; assertEnvelope(game, before, intent, 2);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    expect(game.submit).toHaveBeenCalledTimes(3); expect(game.submit.mock.calls[2]![0]).toEqual(failedEnvelope);
    expect(game.state).toEqual(expected); expect(game.commits).toBe(2);
    await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(expected);
    await reopen(game); await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(expected);
    expect(originalErrorRoots(game.state)).toEqual(originalErrorRoots(before));
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(3);
  });
});
