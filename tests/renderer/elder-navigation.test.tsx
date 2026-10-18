/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { ElderCommand } from '../../src/domain/elder/types';
import { ELDER_ENEMY_ABILITY_WHEEL, ELDER_ENEMY_COUNT_WHEEL } from '../../src/domain/elder/combat';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { dose, eg, oldHangedManRoots, originalTemplarFinal, prepared, promoted } from '../domain/elder-directed-helper';
import { readObjectEntry } from '../helpers/read-object-entry';

const PANEL = '秽语长老成长', ENTRY = '秽语长老与原庭院短咏';
const view = (s: SliceState) => projectSliceState(s).elder;
const NATURAL_ROOT = 'tests/fixtures/elder-v01790';
interface NaturalBoundary { beforeLast: SliceState; lastIntent: SliceIntent; final: SliceState }
/** Frozen actual captures, read without modifying seed, identity, rolls or resources. */
function naturalBoundary(name: string): NaturalBoundary {
  const index = JSON.parse(readFileSync(`${NATURAL_ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual Elder command boundary: ${name}`);
  const file = `${NATURAL_ROOT}/${index[name]}`;
  return { beforeLast: migrateSliceState(readObjectEntry(file, 'beforeLast')), lastIntent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry(file, 'final')) };
}
function naturalSnapshot(name: 'combatStart' | 'combatTerminal'): SliceState {
  return migrateSliceState(JSON.parse(readFileSync(`${NATURAL_ROOT}/snapshot-${name}.json`, 'utf8')));
}
/** These are explicitly directed UNIT continuations of the immutable natural
 * Templar source. Every subsequent state is produced by real public commands;
 * this suite does not claim a natural Elder capture or fabricate a battle. */
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
      newRevision: state.revision, committedAt: '2026-10-15T02:30:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
      status: state.status, revision: state.revision, updatedAt: '2026-10-15T02:29:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)).toBeTruthy());
}
async function acknowledgeOldRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
function actionButton(state: SliceState, command: ElderCommand): HTMLButtonElement {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual Elder public action: ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement;
}
async function control(state: SliceState, command: ElderCommand) {
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
async function saveCommand(game: SavedGame, command: ElderCommand) {
  const expected = eg(game.state, command);
  await userEvent.click(await control(game.state, command));
  const dialog = await screen.findByRole('dialog', { name: '秽语长老操作确认' });
  await userEvent.click(within(dialog).getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作' }));
  await waitFor(() => expect(game.state).toEqual(expected));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '秽语长老操作确认' })).toBeNull());
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});

function assertNaturalRound(reveal: HTMLElement, round: SliceCombatRound) {
  expect(round.elderOutcome).toBeTruthy(); expect(round.consequenceDomain).toBe('BODY');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).not.toContain('精神后果盘');
  if (round.consequenceWeights) {
    const weights = round.consequenceWeights;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
  }
  const outcome = round.elderOutcome!, actual = within(reveal).getByRole('region', { name: '秽语长老本回合实际记录' });
  expect(actual.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order), rows = within(actual).queryAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(action.label);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
  });
}

describe('Elder unchanged natural battle and living terminal navigation', () => {
  it('loads the actual new battle above the stale Templar round with independent enemy wheels and original spirits', async () => {
    const before = naturalSnapshot('combatStart'), game = savedGame(before), battle = projectSliceState(before).combat!;
    expect(before.combat?.encounterId).toBe('ELDER_DISPUTE'); expect(before.lastCombatRound?.threeHeadedTemplarOutcome).toBeTruthy();
    expect(battle.enemyAbilityWheel).toEqual(ELDER_ENEMY_ABILITY_WHEEL); expect(battle.enemyCountWheel).toEqual(ELDER_ENEMY_COUNT_WHEEL);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    const resources = within(stage).getByRole('region', { name: '秽语长老本回合实际资源' });
    expect(resources.textContent).toContain('本人健康100/100'); expect(resources.textContent).toContain('本场没有成人同伴参战');
    expect(before.threeHeadedTemplar.life.owner.location).toBe('OUTSIDE');
    expect(before.threeHeadedTemplar.life.spirits['THT3-HELENA']).toMatchObject({ spirituality: 18, integrity: 60 });
    expect(before.threeHeadedTemplar.life.spirits['THT3-ROLAND']).toMatchObject({ spirituality: 21, integrity: 100 });
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of battle.enemyAbilityWheel) expect(stage.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    for (const wheel of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    const panel = screen.getByRole('region', { name: PANEL, hidden: true });
    for (const button of within(panel).getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('region', { name: '三首圣堂', hidden: true })).toBeNull(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each([
    ['combat-round-1', 1, 90, 0, ['LIGHT'], 'NONE'],
    ['combat-round-2', 2, 60, 1, ['LIGHT', 'HEAVY'], 'NONE'],
    ['combat-round-3', 3, 60, 1, ['LIGHT', 'HEAVY'], 'SUCCESS'],
  ] as const)('reloads actual %s twice with the recorded BODY injury or retreat before any old page', async (name, number, health, risk, injuries, retreat) => {
    const before = naturalBoundary(name).final, game = savedGame(before), round = before.lastCombatRound!;
    expect(before).toMatchObject({ status: 'ACTIVE', health, injuryRisk: risk }); expect(before.injuries.map(i => i.severity)).toEqual(injuries);
    expect(round).toMatchObject({ round: number, consequenceDomain: 'BODY', retreat });
    await mount(game); let reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertNaturalRound(reveal, round);
    expect(screen.queryByRole('region', { name: '三首圣堂', hidden: true })).toBeNull();
    if (retreat === 'SUCCESS') {
      expect(reveal.textContent).toContain('成功脱离');
      await userEvent.click(within(reveal).getByRole('button', { name: '返回生活' }));
      await screen.findByRole('heading', { name: '人物卷宗' });
    } else {
      await userEvent.click(within(reveal).getByRole('button', { name: '进入下一回合' }));
      const battle = await screen.findByRole('dialog', { name: projectSliceState(before).combat!.title! });
      expect(within(battle).getByRole('region', { name: '秽语长老本回合实际资源' }).textContent).toContain(`本人健康${health}/100`);
    }
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    cleanup(); await mount(game); reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertNaturalRound(reveal, round);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(naturalBoundary(name).final);
  }, 20_000);

  it('returns the actual living retreat to ordinary life with both new wounds and replays the saved WORK without healing them', async () => {
    const terminal = naturalSnapshot('combatTerminal'), game = savedGame(terminal), ordinary = naturalBoundary('ordinary-life-after-actual-exit');
    expect(terminal).toMatchObject({ status: 'ACTIVE', health: 60, injuryRisk: 1, combat: null });
    expect(terminal.injuries.map(i => i.severity)).toEqual(['LIGHT', 'HEAVY']); expect(ordinary.beforeLast).toEqual(terminal);
    expect(terminal.elder.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 100, enemySpirituality: 90, terminal: { outcome: 'RETREATED', round: 3, exitMetres: 4, exitSeconds: 4 } });
    expect(terminal.threeHeadedTemplar.life).toMatchObject({ playerLocation: 'START', playerTravelMetres: 88, clockSeconds: 933, owner: { location: 'OUTSIDE' } });
    await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertNaturalRound(reveal, terminal.lastCombatRound!);
    await userEvent.click(within(reveal).getByRole('button', { name: '返回生活' })); await screen.findByRole('heading', { name: '人物卷宗' });
    const recovery = screen.getByRole('region', { name: '伤势与恢复路线' }); expect(recovery.textContent).toContain(projectSliceState(terminal).recovery.summary);
    await userEvent.click(screen.getByRole('button', { name: '查看详情' })); const details = await screen.findByRole('dialog', { name: '人物详情' });
    expect(details.textContent).toContain('1. 轻伤 · 尚未处置'); expect(details.textContent).toContain('2. 重伤 · 尚未处置');
    await userEvent.click(within(details).getByRole('button', { name: '关闭人物详情' }));
    const work = screen.getByRole('button', { name: /^工作，1行动/ }); expect((work as HTMLButtonElement).disabled).toBe(false); await userEvent.click(work);
    await waitFor(() => expect(game.state).toEqual(ordinary.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: terminal.runId, expectedRevision: terminal.revision, payload: ordinary.lastIntent });
    expect(game.state.injuries).toEqual(terminal.injuries); expect(game.state.elder.encounter).toEqual(terminal.elder.encounter);
    expect(game.state.lastCombatRound).toEqual(terminal.lastCombatRound); expect(game.state.threeHeadedTemplar.life).toEqual(terminal.threeHeadedTemplar.life);
    expect(game.state).toEqual(migrateSliceState(readObjectEntry(`${NATURAL_ROOT}/natural.json`, 'final')));
  }, 20_000);
});
afterEach(() => {
  cleanup(); delete window.sliceGame; vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Elder real SliceApp navigation from original S3 and explicitly directed S2 saves', () => {
  it('opens S3 advancement at11/12 weeks and returns without healing or modifying the original campaign', async () => {
    const before = originalTemplarFinal(), game = savedGame(before);
    expect(before.progression.sequence).toBe(3); expect(before.lastCombatRound?.threeHeadedTemplarOutcome).toBeTruthy();
    await mount(game); await acknowledgeOldRound();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    await screen.findByRole('region', { name: '三首圣堂' });
    await userEvent.click(screen.getByRole('button', { name: '关闭三首圣堂页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '三首圣堂' })).toBeNull();
    expect(panel.textContent).toContain('三首圣堂消化100'); expect(panel.textContent).toContain('当前11/12');
    expect(within(panel).getByRole('region', { name: '秽语长老当前资源' }).textContent).toContain('健康40/100');
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('opens S2 growth before the old Templar page or stale old round and retains exact original spirits and skills', async () => {
    const before = promoted(), game = savedGame(before); await mount(game);
    expect(before.lastCombatRound?.threeHeadedTemplarOutcome).toBeTruthy(); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.getByText(`秽语长老 · 序列2 · ${projectSliceState(before).character.professionName}`, { selector: 'p' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = await screen.findByRole('region', { name: PANEL }); expect(screen.queryByRole('region', { name: '三首圣堂' })).toBeNull();
    const court = within(panel).getByRole('region', { name: '秽语长老原场事务' });
    expect(court.textContent).toContain('灵性18，完整度60'); expect(court.textContent).toContain('灵性27，完整度100');
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    for (const ability of view(before).abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${before.progression.mastery[ability.id]}`);
    expect(view(before).abilities).toHaveLength(15); expect(panel.textContent).toContain('RELEASED'); expect(panel.textContent).toContain('ISOLATED');
    expect(within(panel).getByRole('button', { name: '可选原庭院交战' })).toBeTruthy();
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' }));
    await screen.findByRole('heading', { name: '人物卷宗' });
    await userEvent.click(screen.getByRole('button', { name: ENTRY })); await screen.findByRole('region', { name: PANEL });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('reopens the same actually saved current Elder case ahead of old Templar history without duplicating material or permission', async () => {
    const before = promoted(), game = savedGame(before); await mount(game);
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    await screen.findByRole('region', { name: PANEL });
    await saveCommand(game, { type: 'OBSERVE', caseId: 'sealed-whisper' });
    await saveCommand(game, { type: 'CONSENT_OWNER', caseId: 'sealed-whisper' });
    await saveCommand(game, { type: 'PREPARE', caseId: 'sealed-whisper', method: 'ORDINARY' });
    const saved = structuredClone(game.state), calls = vi.mocked(game.submit).mock.calls.length;
    expect(saved.elder.life.activeCase).toBe('sealed-whisper'); expect(saved.cash).toBe(before.cash - 24);
    expect(saved.elder.life.operation.materials[0]).toMatchObject({ status: 'PLAYER', paidPennies: 24 });
    expect(oldHangedManRoots(saved).slice(0, -1)).toEqual(oldHangedManRoots(before).slice(0, -1));
    expect(saved.threeHeadedTemplar).toEqual({ ...before.threeHeadedTemplar, life: { ...before.threeHeadedTemplar.life, clockSeconds: before.threeHeadedTemplar.life.clockSeconds + 8 } });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    cleanup(); await mount(game);
    const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '三首圣堂' })).toBeNull(); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(within(panel).getByRole('region', { name: '秽语长老原场事务' }).textContent).toContain('原耗材尚未归还');
    expect(game.state).toEqual(saved); expect(game.submit).toHaveBeenCalledTimes(calls);
  }, 20_000);

  it('keeps a real prepared bottle unchanged through cancel and failed duplicate clicks, then retries the exact save once', async () => {
    const before = prepared(), expected = eg(before, dose), game = savedGame(before, { deferFirstSave: true, failFirstSave: true });
    await mount(game); await acknowledgeOldRound(); await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '三首圣堂' })).toBeNull();
    await userEvent.click(await control(game.state, dose));
    let dialog = await screen.findByRole('dialog', { name: '秽语长老操作确认' });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await control(game.state, dose)); dialog = await screen.findByRole('dialog', { name: '秽语长老操作确认' });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一药瓶' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before); expect(actionButton(before, dose).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(actionButton(before, dose).disabled).toBe(true);
    fireEvent.click(actionButton(before, dose)); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' }));
    await waitFor(() => expect(game.state).toEqual(expected));
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: { type: 'ELDER', command: dose } });
    expect(game.state.random.cursor).toBe(before.random.cursor + 1); expect(game.state.health).toBe(40); expect(game.state.injuries).toEqual(before.injuries);
    expect(oldHangedManRoots(game.state)).toEqual(oldHangedManRoots(before)); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    cleanup(); await mount(game); expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ })); await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '三首圣堂' })).toBeNull();
  }, 20_000);
});
