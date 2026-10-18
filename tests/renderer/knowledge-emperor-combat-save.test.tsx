/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { stableStringify } from '../../src/domain/canonical.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { KNOWLEDGE_EMPEROR_SOURCE_KEYS } from '../../src/domain/knowledge-emperor/types.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { knowledgeBoundary, knowledgeSnapshot } from '../helpers/knowledge-emperor-capture.js';

const PANEL = '知识皇帝成长', ROUND = '战斗回合结果', RECORD = '知识皇帝本回合实际记录';
const BODY = '本回合按实际身体冲击结算伤势', MENTAL = '本回合按实际精神压力结算后果';
const same = (actual: unknown, expected: unknown) => expect(stableStringify(actual)).toBe(stableStringify(expected));
const originalRoots = (state: SliceState) => KNOWLEDGE_EMPEROR_SOURCE_KEYS.map(key => state[key]);
const disabled = (control: HTMLElement) => (control as HTMLButtonElement).disabled;

// Only the IPC commit boundary is controlled. Each attempted write first runs
// the real reducer and validator; an injected commit failure discards that
// computed result. The unchanged captured seed/cursor, costs, bodies, histories
// and fatal outcome are never edited. Reopening loads only the committed state.
// These are renderer/IPC tests; actual SQLite rollback/seals are tested separately.
function savedGame(input: SliceState) {
  let state = structuredClone(input), commits = 0, failNext = false;
  let nextSaveBarrier: Promise<void> | null = null;
  const attemptedStates: SliceState[] = [], receipts = new Map<string, SliceReceipt>();
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    const prior = receipts.get(envelope.intentId);
    if (prior) return { ok: true, value: { ...structuredClone(prior), replayed: true } };
    if (envelope.payload.type === 'CREATE') throw new Error('The actual natural campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next); attemptedStates.push(next);
    const barrier = nextSaveBarrier; nextSaveBarrier = null;
    if (barrier) await barrier;
    if (failNext) {
      failNext = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    state = next; commits++;
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-16T01:00:00Z', replayed: false, state: projectSliceState(state) };
    receipts.set(envelope.intentId, receipt); return { ok: true, value: receipt };
  });
  return { get state() { return state; }, get commits() { return commits; }, attemptedStates, submit,
    failNextSave() { failNext = true; },
    holdNextSave() {
      if (nextSaveBarrier) throw new Error('A save barrier is already pending.');
      let release = () => {};
      nextSaveBarrier = new Promise<void>(resolve => { release = resolve; });
      return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;
// The optional transform is used solely by the explicitly labelled display
// branch test. It never reaches the reducer, validator, saved state or receipt.
async function mount(game: SavedGame, presentationOnly?: (value: SliceProjection) => void) {
  expect([game.state.schemaVersion, game.state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  function projection() {
    const value = projectSliceState(game.state); presentationOnly?.(value); return value;
  }
  const value = projection();
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projection() }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
        portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
        revision: value.revision, updatedAt: '2026-10-16T01:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  if (value.status === 'DEAD') {
    expect(disabled(await screen.findByRole('button', { name: /继续游戏/ }))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /查看封存/ }));
  } else await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  await screen.findByRole('dialog', { name: value.lastCombatRound?.knowledgeEmperorOutcome ? ROUND : value.combat!.title! });
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
}
async function reopen(game: SavedGame) { cleanup(); await mount(game); }
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
function assertCurrentBody(state: SliceState) {
  const site = state.knowledgeEmperor.encounter.currentSite!;
  const value = projectSliceState(state), body = screen.getByRole('region', { name: '知识皇帝原人原物当前状态' });
  same(value.knowledgeEmperor.life.site, site);
  expect(site.playerLocation).toBe('YARD'); expect(site.body).toBe('SOLID'); expect(site.form.active).toBe(false);
  expect(body.textContent).toContain(`本人当前在独立阅览院，精力${site.playerEnergy}/100，累计普通步行${site.playerTravelMetres}米，现场时钟${site.clockSeconds}秒`);
  expect(body.textContent).toContain('当前身体：完整实体；当前没有信息形态窗口');
  expect(body.textContent).toContain(`${site.iris!.name} · ${site.iris!.age}岁，当前在室外，独立精力${site.iris!.energy}/100，累计实走${site.iris!.travelMetres}米`);
  // The prior life scene remains an immutable record, never a replacement body.
  expect(body.textContent).not.toContain(`现场时钟${state.knowledgeEmperor.life.site.clockSeconds}秒`);
  expect(body.textContent).not.toContain(`现场时钟${state.sage.encounter.currentSite!.clockSeconds}秒`);
}
function assertRound(state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.knowledgeEmperorOutcome;
  if (!outcome) throw new Error('Expected the actual captured Knowledge Emperor round.');
  const reveal = screen.getByRole('dialog', { name: ROUND });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  expect(reveal.textContent).toContain(round.consequence);
  const record = within(reveal).getByRole('region', { name: RECORD });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  expect(record.textContent).toContain(BODY); expect(record.textContent).not.toContain(MENTAL);
  const actions = [...outcome.playerActions.map(action => ({ ...action, actor: 'PLAYER' as const })),
    ...outcome.enemyActions.map(action => ({ ...action, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order);
  const rows = within(within(record).getByRole('list')).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：${action.label}`);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[index]!.textContent).toContain(`本槽实际经过${action.elapsedSeconds}秒`);
    expect(rows[index]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}`);
    expect(rows[index]!.textContent).toContain(`对手灵性${action.enemySpiritualityAfter}`);
    expect(rows[index]!.textContent).toContain(`本槽便笺实耗${action.noteChargePaid}次、磨损${action.noteWearPaid}`);
    if (action.rolls.length > 0) expect(rows[index]!.textContent).toContain(`本槽实际检定骰：${action.rolls.join('、')}`);
  });
  expect(round).toMatchObject({ round: 1, consequenceDomain: 'BODY', consequenceRoll: 97,
    consequenceWeights: { light: 65, heavy: 30, death: 5 }, winner: 'ENEMY', playerCount: 3, enemyCount: 2 });
  expect(within(reveal).queryByRole('region', { name: '贤者本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '贤者' })).toBeNull();
  expect(within(reveal).queryByRole('button', { name: '进入下一回合' })).toBeNull();
  expect(within(reveal).queryByRole('button', { name: '返回生活' })).toBeNull();
  expect(within(reveal).getByRole('button', { name: '查看收尾卷宗' })).toBeTruthy();
  assertCurrentBody(state);
}
async function assertReadOnlyEnding(game: SavedGame) {
  await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '查看收尾卷宗' }));
  await screen.findByRole('heading', { name: game.state.ending!.title });
  expect(screen.getByText('只读封存卷宗')).toBeTruthy(); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
  expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
  expect(screen.queryByRole('button', { name: '进入下一回合' })).toBeNull();
  expect(screen.queryByRole('button', { name: '确认姿态，结算完整回合' })).toBeNull();
  expect(projectSliceState(game.state).canAct).toBe(false);
  for (const call of game.submit.mock.calls) expect(call[0].payload.type).not.toBe('CONTINUE_LIFE');
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

describe('Knowledge Emperor actual natural combat save, reopen and death archive UI', () => {
  it('opens the real combatStart ahead of inherited Sage round5 and uses the current yard body', async () => {
    const source = knowledgeSnapshot('combatStart'), boundary = knowledgeBoundary('combat-round-1'); same(source, boundary.before);
    const game = savedGame(source), value = projectSliceState(source); await mount(game);
    expect(value.sage.promoted).toBe(true); expect(value.knowledgeEmperor.promoted).toBe(true); expect(value.lastCombatRound?.sageOutcome).toBeTruthy();
    expect(source.combat).toMatchObject({ encounterId: 'KNOWLEDGE_EMPEROR_DISPUTE', round: 1, lastRound: null });
    expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! });
    const resource = within(stage).getByRole('region', { name: '知识皇帝本回合实际资源' });
    expect(resource.textContent).toContain('本人健康100/100 · 精神100/100 · 灵性120/120');
    expect(resource.textContent).toContain('达里安·洛克（44岁）：健康100、精神100、灵性120');
    expect(resource.textContent).toContain('新便笺剩余3次，磨损0');
    expect(within(stage).queryByRole('region', { name: '贤者本回合实际资源' })).toBeNull();
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy(); assertCurrentBody(source);
    const rendered = resource.textContent; await reopen(game);
    expect(screen.getByRole('region', { name: '知识皇帝本回合实际资源' }).textContent).toBe(rendered);
    assertCurrentBody(source); same(projectSliceState(game.state), value); same(game.state, source);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it('keeps the live saved body through failed commit, retries one identical intent and reopens the exact fatal round', async () => {
    const boundary = knowledgeBoundary('combat-round-1'), before = boundary.before, expected = boundary.final;
    expect(boundary.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    const game = savedGame(before), value = projectSliceState(before), stageTitle = value.combat!.title!;
    const releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game);
    const stage = screen.getByRole('dialog', { name: stageTitle });
    const savedResources = within(stage).getByRole('region', { name: '知识皇帝本回合实际资源' }).textContent;
    const savedBody = screen.getByRole('region', { name: '知识皇帝原人原物当前状态' }).textContent;
    const stance = value.combat!.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, boundary.intent, 1);
    expect(disabled(submit)).toBe(true); expect(game.attemptedStates).toHaveLength(1); same(game.attemptedStates[0], expected);
    same(game.state, before); expect(game.commits).toBe(0); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    expect(within(stage).getByRole('region', { name: '知识皇帝本回合实际资源' }).textContent).toBe(savedResources);
    expect(screen.getByRole('region', { name: '知识皇帝原人原物当前状态' }).textContent).toBe(savedBody);
    await act(async () => { releaseFailure(); });
    const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(screen.queryByRole('heading', { name: expected.ending!.title })).toBeNull();
    expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); assertCurrentBody(before);
    expect(disabled(submit)).toBe(true); same(game.state, before); expect(game.commits).toBe(0);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); assertEnvelope(game, before, boundary.intent, 2);
    expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); same(game.state, before);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(expected.revision)); await screen.findByRole('dialog', { name: ROUND });
    expect(game.attemptedStates).toHaveLength(2); same(game.attemptedStates[1], expected); same(game.state, expected); expect(game.commits).toBe(1);
    expect(game.state.spirituality).toBe(before.spirituality - 8); expect(game.state.mind).toBe(before.mind - 2);
    expect(game.state.cash).toBe(before.cash); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    expect(game.state.knowledgeEmperor.encounter.enemySpirituality).toBe(before.knowledgeEmperor.encounter.enemySpirituality - 7);
    same(game.state.knowledgeEmperor.encounter.note, before.knowledgeEmperor.encounter.note);
    expect(game.state.lastCombatRound!.knowledgeEmperorOutcome!.continuing).toBe(false);
    expect(game.state.spirituality).toBe(game.state.lastCombatRound!.knowledgeEmperorOutcome!.playerSpiritualityAfter);
    expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1); same(game.state.combatHistory.slice(0, -1), before.combatHistory);
    same(originalRoots(game.state), originalRoots(before));
    expect(game.state.knowledgeEmperor.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', exitMetres: 0, exitSeconds: 0, playerEnergyPaid: 0 });
    assertRound(expected); const immediateRecord = screen.getByRole('dialog', { name: ROUND }).textContent;
    await reopen(game); assertRound(expected);
    expect(screen.getByRole('dialog', { name: ROUND }).textContent).toBe(immediateRecord); same(projectSliceState(game.state), projectSliceState(expected));
    await assertReadOnlyEnding(game); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1); same(game.state, expected);
  }, 60_000);

  it('opens the actual terminal snapshot from the archive without a new round, ordinary exit or continuation', async () => {
    const source = knowledgeSnapshot('actualTerminal'), boundary = knowledgeBoundary('combat-round-1'); same(source, boundary.final);
    const game = savedGame(source); await mount(game); assertRound(source);
    fireEvent.keyDown(screen.getByRole('dialog', { name: ROUND }), { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: ROUND })).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: '快速显示本回合结果' }));
    assertRound(source); await assertReadOnlyEnding(game);
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '返回标题' }));
    expect(disabled(await screen.findByRole('button', { name: /继续游戏/ }))).toBe(true);
    expect(disabled(screen.getByRole('button', { name: /查看封存/ }))).toBe(false);
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 30_000);

  it.each(['BODY', 'MENTAL'] as const)('labels %s in an explicit presentation-only branch without fabricating a saved round', async domain => {
    // The natural run has exactly one BODY round. This is a view-only text
    // branch test, not natural MENTAL combat, causal evidence or a saved state.
    const source = knowledgeSnapshot('actualTerminal'), original = stableStringify(source), game = savedGame(source);
    await mount(game, value => { value.lastCombatRound = { ...value.lastCombatRound!, consequenceDomain: domain }; });
    const record = within(screen.getByRole('dialog', { name: ROUND })).getByRole('region', { name: RECORD });
    expect(record.textContent).toContain(domain === 'BODY' ? BODY : MENTAL);
    expect(record.textContent).not.toContain(domain === 'BODY' ? MENTAL : BODY);
    expect(stableStringify(source)).toBe(original); same(game.state, source);
    expect(game.state.lastCombatRound!.consequenceDomain).toBe('BODY'); expect(game.submit).not.toHaveBeenCalled();
  }, 30_000);
});
