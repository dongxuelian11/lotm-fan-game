/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { stableStringify } from '../../src/domain/canonical';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { ApocalypseDemonessCommand } from '../../src/domain/apocalypse-demoness/types';
import type { ApocalypseDemonessCaseId } from '../../src/domain/apocalypse-demoness/life';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format';
import { ae, originalCalamity, originalDemonessRoots, promoted, ready } from '../domain/apocalypse-demoness-directed-helper';

const PANEL = '末日魔女成长', ENTRY = '末日魔女与画廊附室', CONFIRM = '末日魔女操作确认';
const CONTAINMENT = 'assassin.s1.pulse-containment', BUFFER = 'assassin.s1.mirror-buffer';

// The unchanged actual585 Calamity capture is migrated by the shared helper.
// Setup continues through public commands with its original seed and cursor.
// No source resources, old histories, masteries or outcomes are rewritten, and
// these directed UI boundaries do not constitute a new natural capture.
function perform(state: SliceState, ...commands: ApocalypseDemonessCommand[]): SliceState {
  for (const command of commands) state = ae(state, command);
  assertValidSliceState(state); return state;
}
function readyScene(state: SliceState): SliceState {
  state = ready(state, { ap: 3, cash: 250, health: 80, mind: 50, spirituality: 30 });
  while (state.apocalypseDemoness.life.site!.playerEnergy < 60) {
    state = perform(state, { type: 'RECOVER_ENERGY' });
    state = ready(state, { ap: 3, cash: 250, health: 80, mind: 50, spirituality: 30 });
  }
  return state;
}
function enter(state: SliceState, caseId: ApocalypseDemonessCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  state = perform(readyScene(state), { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method },
    { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'OPERATOR' },
    { type: 'CONSENT', permission: 'PARTICIPANT' });
  if (method === 'ABILITY') state = perform(state, { type: 'CONSENT', permission: 'ABILITY' });
  return perform(state, { type: 'APPROACH' });
}
function pendingPulse(): SliceState {
  return perform(enter(promoted(), 'pulse-containment'), { type: 'BUY_RESIDUE' },
    { type: 'RECEIVE_RESIDUE' }, { type: 'INSTALL_PLATE' }, { type: 'START_PULSE' });
}
function practiced(): SliceState {
  let state = promoted();
  for (const caseId of ['pulse-containment', 'mirror-buffer', 'withdrawn-window'] as const) {
    state = perform(enter(state, caseId, 'ORDINARY'), { type: 'INSTALL_PLATE' },
      { type: 'ORDINARY_INSPECTION' }, { type: 'REMOVE_PLATE' }, { type: 'EXIT_ROOM' },
      { type: 'RETURN_PLATE' }, { type: 'LEAVE' });
    state = perform(ready(state), { type: 'REPORT', caseId });
  }
  return readyScene(perform(ready(state), { type: 'REFLECT' }));
}

// Only the IPC save boundary is controlled. Successful submissions run the
// real reducer and validator; held/failed saves leave the authoritative state
// intact. Remounting reloads that state. This is not Electron/SQLite evidence.
function savedGame(input: SliceState) {
  let state = structuredClone(input), commits = 0, failNext = false;
  let nextSaveBarrier: Promise<void> | null = null;
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    const barrier = nextSaveBarrier; nextSaveBarrier = null;
    if (barrier) await barrier;
    if (failNext) {
      failNext = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next);
    state = next; commits++;
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-15T23:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit,
    failNextSave() { failNext = true; },
    holdNextSave() {
      if (nextSaveBarrier) throw new Error('A save barrier is already pending.');
      let release = () => {};
      nextSaveBarrier = new Promise<void>(resolve => { release = resolve; });
      return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame, displayName?: string) {
  expect(game.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(game.state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  function projection() {
    const value = projectSliceState(game.state);
    // The separate literal-name renderer test changes public display fields
    // only. It does not modify the source save or send gameplay commands.
    if (displayName !== undefined) {
      value.character = { ...value.character, name: displayName };
      value.apocalypseDemoness = { ...value.apocalypseDemoness, characterName: displayName };
    }
    return value;
  }
  const value = projection();
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projection() }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
        portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
        revision: value.revision, updatedAt: '2026-10-15T23:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: value.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (value.combat ? screen.queryByRole('dialog', { name: value.combat.title! }) : null)
    ?? (value.ending ? screen.queryByRole('heading', { name: value.ending.title }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
}
async function reopen(game: SavedGame, displayName?: string) { cleanup(); await mount(game, displayName); }
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) {
    await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull());
  }
}
async function openPanel() {
  await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
async function closePanel() {
  await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })).toBeNull());
}
function assertResources(state: SliceState) {
  const value = projectSliceState(state), resources = screen.getByRole('region', { name: '末日魔女当前资源' });
  expect(resources.textContent).toContain(`健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality} · 排异${value.apocalypseDemoness.pollution}`);
  expect(resources.textContent).toContain(`${value.apocalypseDemoness.resources!.cash} · 本周行动${state.actionsRemaining} · 现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertOriginals(state: SliceState) {
  const site = projectSliceState(state).apocalypseDemoness.life.site!;
  const original = screen.getByRole('region', { name: '末日魔女原人原物当前状态' });
  expect(original.textContent).toContain(`精力${site.playerEnergy}/100，累计普通步行${site.playerTravelMetres}米，现场时钟${site.clockSeconds}秒`);
  for (const person of [site.vera!, site.marcus!]) {
    expect(original.textContent).toContain(`${person.name} · ${person.age}岁`);
    expect(original.textContent).toContain(`独立精力${person.energy}/100，累计实走${person.travelMetres}米`);
  }
  expect(original.textContent).toContain(`原负载剩余${site.load.remainingLoads}次，已实际施加${site.load.appliedLoads}次`);
  expect(original.textContent).toContain('原残留已耗尽'); expect(original.textContent).toContain('既有焦痕仍在');
  site.plates.forEach((plate, index) => expect(original.textContent).toContain(`第${index + 1}枚已归还，剩余${plate.charges}次、磨损${plate.wear}`));
}
function assertClock(state: SliceState) {
  const life = projectSliceState(state).apocalypseDemoness.life;
  const clock = screen.getByRole('region', { name: '当前时钟与一次能力窗口' });
  expect(clock.textContent).toContain(`现场时钟${life.clockSeconds}秒；本阶段实际经过${life.elapsedSeconds}秒`);
  if (life.pending) expect(clock.textContent).toContain(`从${life.pending.createdAt}秒至${life.pending.expiresAt}秒，还剩${life.pendingRemainingSeconds}秒`);
  else expect(clock.textContent).toContain('当前没有尚未耗用的能力窗口');
}
async function publicControl(state: SliceState, command: ApocalypseDemonessCommand) {
  const action = projectSliceState(state).apocalypseDemoness.actions.find(entry => stableStringify(entry.command) === stableStringify(command));
  if (!action) throw new Error(`Missing public action: ${JSON.stringify(command)}`);
  expect(action.enabled).toBe(true);
  const picker = screen.getByRole('combobox', { name: '末日魔女目标' }) as HTMLSelectElement;
  const target = 'bottleId' in command ? command.bottleId : 'caseId' in command ? command.caseId
    : command.type.startsWith('ENCOUNTER_') || command.type === 'LEAVE_ENCOUNTER' ? 'encounter' : null;
  if (target !== null && !picker.disabled && picker.value !== target) await userEvent.selectOptions(picker, target);
  const matches = () => screen.queryAllByRole('button').filter(button => button.getAttribute('data-action-id') === action.id);
  if (matches().length === 0) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '末日魔女其他操作' }), action.id);
  }
  const buttons = matches(); expect(buttons).toHaveLength(1);
  expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
  return buttons[0]!;
}
async function confirm(state: SliceState, command: ApocalypseDemonessCommand) {
  await userEvent.click(await publicControl(state, command));
  const dialog = screen.getByRole('dialog', { name: CONFIRM });
  const button = within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
  fireEvent.click(button); fireEvent.click(button);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
function assertRound(state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.apocalypseDemonessOutcome;
  if (!outcome) throw new Error('Expected the actual committed Apocalypse Demoness round.');
  const reveal = screen.getByRole('dialog', { name: '战斗回合结果' });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  const record = within(reveal).getByRole('region', { name: '末日魔女本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(within(record).getByRole('list')).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：${action.label}`);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[index]!.textContent).toContain(`本槽实际经过${action.elapsedSeconds}秒`);
    expect(rows[index]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}`);
    if (action.fallbackReason) expect(rows[index]!.textContent).toContain(action.fallbackReason);
  });
  const consequence = round.consequenceDomain === 'BODY' ? '本回合按实际身体冲击结算伤势'
    : round.consequenceDomain === 'MENTAL' ? '本回合按实际精神压力结算，不生成身体伤口' : '本回合没有身体或精神后果盘';
  expect(record.textContent).toContain(consequence);
  expect(within(reveal).queryByRole('region', { name: '灾难魔女本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '灾难魔女' })).toBeNull();
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

describe('Apocalypse Demoness saved campaign navigation and authoritative UI receipts', () => {
  it('opens the actual injured S2 source at its current outside position without restoring its old entry snapshot', async () => {
    const source = originalCalamity(), game = savedGame(source);
    await mount(game); await acknowledgeRound(); await openPanel();
    assertResources(source); assertOriginals(source);
    expect(source).toMatchObject({ week: 143, health: 70, mind: 100, spirituality: 120, cash: 610,
      actionsRemaining: 3, progression: { pathwayId: 'demoness', sequence: 2, acting: 100 } });
    expect(screen.getByRole('region', { name: '末日魔女当前资源' }).textContent).toContain('伤势1：重伤 · 尚未治疗');
    const original = screen.getByRole('region', { name: '末日魔女原人原物当前状态' });
    expect(original.textContent).toContain('本人当前在室外，精力22/100，累计普通步行78米，现场时钟407秒');
    expect(original.textContent).not.toContain('现场时钟217秒');
    expect(screen.getByRole('region', { name: '末日魔女服药准备' })).toBeTruthy();
    await closePanel(); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '灾难魔女' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭灾难魔女页面' }));
    await userEvent.click(screen.getByRole('button', { name: '查看画廊附室与晋升' }));
    expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy();
    expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it('routes S1 growth ahead of promoted S2 while preserving eighteen inherited abilities and read-only old history', async () => {
    const source = promoted(), original = originalCalamity(), game = savedGame(source), value = projectSliceState(source);
    expect(value.apocalypseDemoness.promoted).toBe(true); expect(value.calamityDemoness.promoted).toBe(true);
    expect(value.lastCombatRound?.calamityDemonessOutcome).toBeTruthy();
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL }); assertResources(source); assertOriginals(source);
    expect(screen.getByRole('banner').textContent).toContain(`${source.character.name} · ${value.apocalypseDemoness.title}`);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = value.apocalypseDemoness.abilities;
    expect(abilities).toHaveLength(20);
    expect(abilities.slice(0, 18).map(ability => [ability.id, ability.mastery])).toEqual(
      abilities.slice(0, 18).map(ability => [ability.id, original.progression.mastery[ability.id]]));
    expect(abilities.slice(0, 18).filter(ability => ability.mastery === 0)).toHaveLength(7);
    expect(abilities.slice(18).map(ability => [ability.id, ability.mastery])).toEqual([[CONTAINMENT, 0], [BUFFER, 0]]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(originalDemonessRoots(source)).toEqual(originalDemonessRoots(original));
    await closePanel(); await userEvent.click(screen.getByRole('button', { name: '灾难魔女与镜廊附室' }));
    const old = await screen.findByRole('region', { name: '灾难魔女' });
    expect(value.calamityDemoness.actions).toEqual([]);
    expect(within(old).getByRole('region', { name: '灾难魔女当前行动' }).querySelector('button')).toBeNull();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭灾难魔女页面' }));
    await reopen(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await openPanel(); assertResources(source); assertOriginals(source);
    expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it('keeps a custom name literal in the full-page banner and resources across reopening', async () => {
    const source = promoted(), game = savedGame(source), name = '原创G候选';
    await mount(game, name); await openPanel();
    expect(screen.getByRole('banner').textContent).toContain(`${name} · ${projectSliceState(source).apocalypseDemoness.title}`);
    expect(within(screen.getByRole('region', { name: '末日魔女当前资源' })).getByText(name, { exact: true })).toBeTruthy();
    await reopen(game, name); await openPanel();
    expect(screen.getByRole('banner').textContent).toContain(name);
    expect(within(screen.getByRole('region', { name: '末日魔女当前资源' })).getByText(name, { exact: true })).toBeTruthy();
    expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it('retains committed resources through a pending and failed paid cast, then retries the same intent without double cost', async () => {
    const before = pendingPulse(), command = { type: 'PULSE_CONTAINMENT' } as const;
    const intent: SliceIntent = { type: 'APOCALYPSE_DEMONESS', command };
    const expected = applySliceIntent(before, intent); assertValidSliceState(expected);
    const game = savedGame(before), releaseFailure = game.holdNextSave(); game.failNextSave();
    await mount(game); assertResources(before); assertClock(before);
    const resources = screen.getByRole('region', { name: '末日魔女当前资源' });
    const clock = screen.getByRole('region', { name: '当前时钟与一次能力窗口' });
    const savedResources = resources.textContent, savedClock = clock.textContent;
    await confirm(before, command); assertEnvelope(game, before, intent, 1);
    const dialog = screen.getByRole('dialog', { name: CONFIRM });
    expect(within(dialog).getByRole('region', { name: '末日魔女当前资源' }).textContent).toBe(savedResources);
    expect(resources.textContent).toBe(savedResources); expect(clock.textContent).toBe(savedClock);
    for (const button of within(dialog).getAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    expect(game.state).toEqual(before); expect(game.commits).toBe(0);
    await act(async () => { releaseFailure(); });
    const retry = await screen.findByRole('button', { name: '重试这次操作' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    expect(screen.getByRole('region', { name: '末日魔女当前资源' }).textContent).toBe(savedResources);
    expect(screen.getByRole('region', { name: '当前时钟与一次能力窗口' }).textContent).toBe(savedClock);
    expect((screen.getByRole('combobox', { name: '末日魔女目标' }) as HTMLSelectElement).disabled).toBe(true);
    for (const button of within(screen.getByRole('region', { name: PANEL })).queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(game.state).toEqual(before); expect(game.commits).toBe(0);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]);
    const releaseSuccess = game.holdNextSave(); fireEvent.click(retry); fireEvent.click(retry);
    assertEnvelope(game, before, intent, 2);
    expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); expect(game.state).toEqual(before); expect(game.commits).toBe(0);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    assertResources(expected); assertClock(expected); expect(game.state).toEqual(expected); expect(game.commits).toBe(1);
    await reopen(game); assertResources(expected); assertClock(expected); assertOriginals(expected);
    expect(game.state.spirituality).toBe(before.spirituality - 8); expect(game.state.mind).toBe(before.mind - 2);
    expect(game.state.apocalypseDemoness.life.clockSeconds).toBe(before.apocalypseDemoness.life.clockSeconds + 1);
    expect(game.state.random.cursor).toBe(before.random.cursor + 1);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.cash).toBe(before.cash);
    expect(game.state.health).toBe(before.health); expect(game.state.injuries).toEqual(before.injuries); expect(game.state.week).toBe(before.week);
    expect(game.state.apocalypseDemoness.life.residue).toEqual(before.apocalypseDemoness.life.residue);
    const attempt = game.state.apocalypseDemoness.life.cases['pulse-containment'].attempts.at(-1)!;
    expect(attempt.containment.attempts).toBe(1); expect(attempt.containment.effects).toBe(0);
    expect(attempt.plate).toEqual(before.apocalypseDemoness.life.cases['pulse-containment'].attempts.at(-1)!.plate);
    expect(game.state.progression.mastery[CONTAINMENT]).toBe(before.progression.mastery[CONTAINMENT]);
    expect(originalDemonessRoots(game.state)).toEqual(originalDemonessRoots(before));
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 30_000);

  it('shows a real saved S1 round immediately and on reopening ahead of old S2 promotion, including same-intent retry', async () => {
    const source = perform(practiced(), { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_POLICY', policy: 'ALL' });
    const startIntent: SliceIntent = { type: 'APOCALYPSE_DEMONESS', command: { type: 'ENCOUNTER_FIGHT' } };
    const fighting = applySliceIntent(source, startIntent); assertValidSliceState(fighting);
    const game = savedGame(source); await mount(game); await confirm(source, { type: 'ENCOUNTER_FIGHT' });
    await waitFor(() => expect(game.state.revision).toBe(fighting.revision));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    assertEnvelope(game, source, startIntent, 1); expect(game.state).toEqual(fighting);
    await reopen(game);
    const battle = projectSliceState(game.state).combat!;
    expect(game.state.combat).toMatchObject({ encounterId: 'APOCALYPSE_DEMONESS_DISPUTE', round: 1, lastRound: null });
    expect(projectSliceState(game.state).calamityDemoness.promoted).toBe(true);
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const resources = within(stage).getByRole('region', { name: '末日魔女本回合实际资源' });
    expect(resources.textContent).toContain(`${battle.apocalypseDemoness!.enemyName}：健康${battle.apocalypseDemoness!.enemyHealth}、精神${battle.apocalypseDemoness!.enemyMind}、灵性${battle.apocalypseDemoness!.enemySpirituality}`);
    expect(resources.textContent).toContain('莱奥娜');
    expect(within(stage).queryByRole('region', { name: '灾难魔女本回合实际资源' })).toBeNull();
    const savedRoundResources = resources.textContent;
    const before = game.state, intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    const expected = applySliceIntent(before, intent); assertValidSliceState(expected); game.failNextSave();
    expect(expected.lastCombatRound!.apocalypseDemonessOutcome).toBeTruthy();
    const stance = battle.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const button = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(button); fireEvent.click(button);
    const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    assertEnvelope(game, before, intent, 2); expect(game.state).toEqual(before); expect(game.commits).toBe(1);
    expect(within(stage).getByRole('region', { name: '末日魔女本回合实际资源' }).textContent).toBe(savedRoundResources);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const failedEnvelope = structuredClone(game.submit.mock.calls[1]![0]);
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    expect(game.submit).toHaveBeenCalledTimes(3); expect(game.submit.mock.calls[2]![0]).toEqual(failedEnvelope);
    expect(game.state).toEqual(expected); expect(game.commits).toBe(2);
    await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(expected);
    const immediateRecord = screen.getByRole('dialog', { name: '战斗回合结果' }).textContent;
    await reopen(game); await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(expected);
    expect(screen.getByRole('dialog', { name: '战斗回合结果' }).textContent).toBe(immediateRecord);
    expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1);
    expect(game.state.revision).toBe(before.revision + 1);
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
    expect(originalDemonessRoots(game.state)).toEqual(originalDemonessRoots(before));
    expect(game.state.calamityDemoness.encounter).toMatchObject({ targetId: 'CD2-IRIS', status: 'RETREATED',
      enemyHealth: 100, enemyMind: 100, enemySpirituality: 97, plate: { id: 'CD2-COMBAT-PLATE', charges: 3 } });
    expect(game.state.apocalypseDemoness.encounter.targetId).toBe('AD1-LEONA');
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(3);
  }, 30_000);
});
