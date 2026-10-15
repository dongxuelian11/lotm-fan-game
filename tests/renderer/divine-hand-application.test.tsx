/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { stableStringify } from '../../src/domain/canonical';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { DivineHandCommand } from '../../src/domain/divine-hand/types';
import type { DivineHandCaseId } from '../../src/domain/divine-hand/life';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format';
import { ae, originalGlory, promoted, ready } from '../domain/divine-hand-directed-helper';
import { capturedState, captureValueHash } from '../domain/divine-hand-capture-helper';

const PANEL = '神明之手成长', ENTRY = '神明之手与修整室', CONFIRM = '神明之手操作确认';
const BEAM = 'warrior.s1.beam-stabilize';

// Real migrated raw173/actual158 Glory source, retaining its declared directed
// S3 prefix. All further preparation, potion, life and combat commands use the
// public reducer, original seed and cursor. This is directed UI coverage, not a
// new natural capture. No source resources, mastery or outcomes are rewritten.
function act(state: SliceState, ...commands: DivineHandCommand[]): SliceState {
  for (const command of commands) state = ae(state, command);
  assertValidSliceState(state); return state;
}
function enter(state: SliceState, caseId: DivineHandCaseId, method: 'ABILITY' | 'ORDINARY' = 'ABILITY'): SliceState {
  state = ready(state, { ap: 3, cash: 80, health: 60, mind: 20, spirituality: 20 });
  if (state.glory.life.site.playerEnergy < 9) {
    state = act(state, { type: 'RECOVER_ENERGY' });
    state = ready(state, { ap: 3, cash: 80 });
  }
  state = act(state, { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method },
    { type: 'CONSENT', permission: 'OWNER' }, { type: 'CONSENT', permission: 'OPERATOR' },
    { type: 'CONSENT', permission: 'PARTICIPANT' });
  if (method === 'ABILITY') state = act(state, { type: 'CONSENT', permission: 'ABILITY' });
  return act(state, { type: 'APPROACH' });
}
function practiced(): SliceState {
  let state = promoted();
  for (const caseId of ['beam-support', 'armor-window', 'withdrawn-support'] as const) {
    state = act(enter(state, caseId, 'ORDINARY'), { type: 'ORDINARY_INSPECTION' }, { type: 'EXIT_ROOM' }, { type: 'LEAVE' });
    state = act(ready(state), { type: 'REPORT', caseId });
  }
  state = act(ready(state), { type: 'REFLECT' });
  // Ordinary weekly recovery does not refill this same original body's local
  // energy. Pay for an actual local rest before the optional confrontation.
  state = act(ready(state, { cash: 15 }), { type: 'RECOVER_ENERGY' });
  return ready(state, { ap: 2, health: 100, mind: 100, spirituality: 120, pollution: 0 });
}

// A failure-injected bridge models the save boundary only. Gameplay and public
// projection are real; rejection leaves the authoritative in-memory save intact.
// Remounting reloads that save. This is not SQLite/Electron persistence evidence.
function savedGame(input: SliceState, failFirst = false) {
  let state = structuredClone(input), commits = 0, failNext = failFirst;
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
      committedAt: '2026-10-15T22:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit,
    failNextSave() { failNext = true; } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  expect(game.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(game.state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  const state = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: state, runs: [{ runId: state.runId, name: state.character.name,
        portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status,
        revision: state.revision, updatedAt: '2026-10-15T22:00:00Z' }],
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
  const value = projectSliceState(state), resources = screen.getByRole('region', { name: '神明之手当前资源' });
  expect(resources.textContent).toContain(`健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality} · 排异${value.divineHand.pollution}`);
  expect(resources.textContent).toContain(`${value.divineHand.resources!.cash} · 本周行动${state.actionsRemaining} · 现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
async function assertOriginals(state: SliceState) {
  const summary = screen.getByText('原修护室、原人和旧物当前记录', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  const original = screen.getByRole('region', { name: '原修护室当前状态' }), site = state.glory.life.site;
  expect(original.textContent).toContain(`精力${site.playerEnergy}/100，累计普通步行${site.playerTravelMetres}米，现场时钟${site.clockSeconds}秒`);
  for (const person of [site.celia, site.evan]) {
    expect(original.textContent).toContain(`${person.name} · ${person.age}岁`);
    expect(original.textContent).toContain(`独立精力${person.energy}/100，累计实走${person.travelMetres}米`);
  }
  expect(original.textContent).toContain(`同一银甲当前完整度${site.armor!.integrity}`);
  expect(original.textContent).toContain(`原12千克负载剩余${site.load.remainingLoads}次，已实际施加${site.load.appliedLoads}次`);
}
function assertClock(state: SliceState) {
  const life = projectSliceState(state).divineHand.life;
  const clock = screen.getByRole('region', { name: '当前时钟与一次能力窗口' });
  expect(clock.textContent).toContain(`现场时钟${life.clockSeconds}秒；本阶段实际经过${life.elapsedSeconds}秒`);
  if (life.pending) expect(clock.textContent).toContain(`从${life.pending.createdAt}秒至${life.pending.expiresAt}秒，还剩${life.pendingRemainingSeconds}秒`);
  else expect(clock.textContent).toContain('当前没有尚未耗用的能力窗口');
}
async function publicControl(state: SliceState, command: DivineHandCommand) {
  const action = projectSliceState(state).divineHand.actions.find(entry => stableStringify(entry.command) === stableStringify(command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  const picker = screen.getByRole('combobox', { name: '神明之手目标' }) as HTMLSelectElement;
  const target = 'bottleId' in command ? command.bottleId : 'caseId' in command ? command.caseId
    : command.type.startsWith('ENCOUNTER_') || command.type === 'LEAVE_ENCOUNTER' ? 'encounter' : null;
  if (target !== null && !picker.disabled && picker.value !== target) await userEvent.selectOptions(picker, target);
  let button = screen.queryAllByRole('button').find(entry => entry.getAttribute('data-action-id') === action!.id);
  if (!button) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '神明之手其他操作' }), action!.id);
    button = screen.getAllByRole('button').find(entry => entry.getAttribute('data-action-id') === action!.id);
  }
  if (!button) throw new Error(`Projected action was not accessible: ${action!.label}`);
  return button;
}
async function confirm(state: SliceState, command: DivineHandCommand) {
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
  const round = projectSliceState(state).lastCombatRound!, outcome = round.divineHandOutcome;
  if (!outcome) throw new Error('Expected the actual committed Divine Hand round.');
  const reveal = screen.getByRole('dialog', { name: '战斗回合结果' });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  const record = within(reveal).getByRole('region', { name: '神明之手本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record.querySelector('ol')!).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(action.label);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[index]!.textContent).toContain(`本槽实际经过${action.elapsedSeconds}秒`);
    expect(rows[index]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}`);
    if (action.fallbackReason) expect(rows[index]!.textContent).toContain(action.fallbackReason);
  });
  const consequence = round.consequenceDomain === 'BODY' ? '本回合按实际身体冲击结算伤势'
    : round.consequenceDomain === 'MENTAL' ? '本回合按实际精神压力结算，不生成身体伤口' : '本回合没有身体或精神后果盘';
  expect(record.textContent).toContain(consequence);
  expect(within(reveal).queryByRole('region', { name: '荣耀者本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '荣耀者' })).toBeNull();
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

describe('Divine Hand actual campaign navigation and authoritative UI receipts', () => {
  it('opens the wounded S2 source and routes its next-stage entry without treating the original body or armor', async () => {
    const source = originalGlory(), game = savedGame(source); await mount(game); await acknowledgeRound();
    await openPanel(); assertResources(source); await assertOriginals(source);
    expect(screen.getByRole('region', { name: '神明之手当前资源' }).textContent).toContain('伤势1：轻伤 · 尚未治疗');
    expect(screen.getByRole('region', { name: '神明之手服药准备' })).toBeTruthy();
    expect(source).toMatchObject({ health: 90, mind: 100, spirituality: 96, cash: 500,
      actionsRemaining: 2, progression: { pathwayId: 'warrior', sequence: 2 } });
    await closePanel(); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '荣耀者' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭荣耀者页面' }));
    await userEvent.click(screen.getByRole('button', { name: '查看修整室与晋升' }));
    expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy();
    expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it('routes promoted S1 growth ahead of old Glory and preserves read-only history across reopening', async () => {
    const source = promoted(), game = savedGame(source), value = projectSliceState(source);
    expect(value.divineHand.promoted).toBe(true); expect(value.glory.promoted).toBe(true);
    expect(value.lastCombatRound?.gloryOutcome).toBeTruthy();
    await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL }); assertResources(source); await assertOriginals(source);
    expect(screen.getByRole('banner').textContent).toContain(`${source.character.name} · ${value.divineHand.title}`);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    expect(value.divineHand.abilities).toHaveLength(22);
    expect(value.divineHand.abilities.slice(0, 20).filter(ability => ability.mastery === 0)).toHaveLength(4);
    for (const ability of value.divineHand.abilities.slice(20)) {
      expect(ability.mastery).toBe(0);
      expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握0` })).toBeTruthy();
    }
    await closePanel(); await userEvent.click(screen.getByRole('button', { name: '荣耀者与护持修整室' }));
    const old = await screen.findByRole('region', { name: '荣耀者' });
    expect(value.glory.actions).toEqual([]);
    expect(within(old).getByRole('region', { name: '荣耀者当前行动' }).querySelector('button')).toBeNull();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭荣耀者页面' }));
    await reopen(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await openPanel(); assertResources(source); await assertOriginals(source);
    expect(game.state).toEqual(source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it('keeps old resources and clock on failed paid-cast save, then retries the identical intent exactly once', async () => {
    const before = act(enter(promoted(), 'beam-support'), { type: 'CONTACT_BEAM' });
    const command = { type: 'BEAM_STABILIZE' } as const, intent: SliceIntent = { type: 'DIVINE_HAND', command };
    const expected = applySliceIntent(before, intent); assertValidSliceState(expected);
    const game = savedGame(before, true); await mount(game); assertResources(before); assertClock(before);
    const resources = screen.getByRole('region', { name: '神明之手当前资源' }).textContent;
    const clock = screen.getByRole('region', { name: '当前时钟与一次能力窗口' }).textContent;
    await confirm(before, command); const retry = await screen.findByRole('button', { name: '重试这次操作' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull());
    assertEnvelope(game, before, intent, 1); expect(game.commits).toBe(0); expect(game.state).toEqual(before);
    expect(screen.getByRole('region', { name: '神明之手当前资源' }).textContent).toBe(resources);
    expect(screen.getByRole('region', { name: '当前时钟与一次能力窗口' }).textContent).toBe(clock);
    expect((screen.getByRole('combobox', { name: '神明之手目标' }) as HTMLSelectElement).disabled).toBe(true);
    for (const button of within(screen.getByRole('region', { name: PANEL })).queryAllByRole('button')) expect((button as HTMLButtonElement).disabled).toBe(true);
    const failedEnvelope = game.submit.mock.calls[0]![0];
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    expect(game.submit).toHaveBeenCalledTimes(2); expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope);
    expect(game.commits).toBe(1); expect(game.state).toEqual(expected);
    await reopen(game); assertResources(expected); assertClock(expected); await assertOriginals(expected);
    expect(game.state.spirituality).toBe(before.spirituality - 8); expect(game.state.mind).toBe(before.mind - 2);
    expect(game.state.glory.life.site.clockSeconds).toBe(before.glory.life.site.clockSeconds + 1);
    expect(game.state.random.cursor).toBe(before.random.cursor + 1);
    expect(game.state.actionsRemaining).toBe(before.actionsRemaining); expect(game.state.week).toBe(before.week);
    expect(game.state.glory.life.site.armor).toEqual(before.glory.life.site.armor);
    expect(game.state.glory.life.site.load).toEqual(before.glory.life.site.load);
    expect(game.state.divineHand.life.cases['beam-support'].attempts.at(-1)!.beam.effects).toBe(0);
    expect(game.state.progression.mastery[BEAM]).toBe(before.progression.mastery[BEAM]);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 60_000);

  it('shows the actual new round immediately and after reopening despite old Glory promotion, including failed-save retry', async () => {
    const source = act(practiced(), { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_POLICY', policy: 'ALL' });
    const startIntent: SliceIntent = { type: 'DIVINE_HAND', command: { type: 'ENCOUNTER_FIGHT' } };
    const fighting = applySliceIntent(source, startIntent); assertValidSliceState(fighting);
    const game = savedGame(source); await mount(game); await confirm(source, { type: 'ENCOUNTER_FIGHT' });
    await waitFor(() => expect(game.state.revision).toBe(fighting.revision));
    assertEnvelope(game, source, startIntent, 1); expect(game.state).toEqual(fighting);
    await reopen(game);
    const battle = projectSliceState(game.state).combat!;
    expect(game.state.combat).toMatchObject({ encounterId: 'DIVINE_HAND_DISPUTE', round: 1, lastRound: null });
    expect(projectSliceState(game.state).glory.promoted).toBe(true);
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.queryByRole('region', { name: '荣耀者' })).toBeNull();
    const resources = within(stage).getByRole('region', { name: '神明之手本回合实际资源' });
    expect(resources.textContent).toContain(`${battle.divineHand!.enemyName}：健康${battle.divineHand!.enemyHealth}、精神${battle.divineHand!.enemyMind}、灵性${battle.divineHand!.enemySpirituality}`);
    expect(within(stage).queryByRole('region', { name: '荣耀者本回合实际资源' })).toBeNull();
    const before = game.state, intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    const expected = applySliceIntent(before, intent); assertValidSliceState(expected); game.failNextSave();
    const stance = battle.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const button = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(button); fireEvent.click(button);
    const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    assertEnvelope(game, before, intent, 2); expect(game.state).toEqual(before); expect(game.commits).toBe(1);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const failedEnvelope = game.submit.mock.calls[1]![0];
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    expect(game.submit).toHaveBeenCalledTimes(3); expect(game.submit.mock.calls[2]![0]).toEqual(failedEnvelope);
    expect(game.state).toEqual(expected); expect(game.commits).toBe(2);
    await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(expected);
    const immediateRecord = screen.getByRole('dialog', { name: '战斗回合结果' }).textContent;
    await reopen(game); await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(expected);
    expect(screen.getByRole('dialog', { name: '战斗回合结果' }).textContent).toBe(immediateRecord);
    expect(game.state.combatHistory.slice(0, before.combatHistory.length)).toEqual(before.combatHistory);
    expect(game.state.glory.encounter).toEqual(before.glory.encounter);
    expect(game.state.glory.life.cases).toEqual(before.glory.life.cases);
    expect(game.state.silverKnight).toEqual(before.silverKnight);
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(3);
  }, 120_000);
  it('reopens the immutable actual seventh-round death as a sealed record and cannot resume life', async () => {
    const actual = capturedState('final'), hash = captureValueHash(actual), game = savedGame(actual);
    expect(actual.status).toBe('DEAD'); expect(actual.health).toBe(0);
    expect(actual.divineHand.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', round: 7, enemyHealth: 100, enemyStatus: 'RESISTING', exitMetres: 0 });
    await mount(game); await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(actual);
    const text = screen.getByRole('dialog', { name: '战斗回合结果' }).textContent;
    await acknowledgeRound();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
    expect(projectSliceState(game.state).canAct).toBe(false);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    expect(captureValueHash(game.state)).toBe(hash);
    await reopen(game); await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(actual);
    expect(screen.getByRole('dialog', { name: '战斗回合结果' }).textContent).toBe(text);
    expect(captureValueHash(game.state)).toBe(hash); expect(game.submit).not.toHaveBeenCalled();
  }, 30_000);

});
