/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { playerText } from '../../src/shared/player-text.js';
import { HAND_OF_ORDER_SOURCE_KEYS, type HandOfOrderAction } from '../../src/domain/hand-of-order/types.js';
import { resolveHandOfOrderOriginalsSnapshot } from '../../src/domain/hand-of-order/index.js';
import { getHandOfOrderCurrentSite } from '../../src/domain/hand-of-order/life.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { capturedSnapshot, capturedState, namedBoundary, observedCapture, captureBody, captureValueHash, captureFileHash,
  currentCapture, sourceEntry, sameCaptureValue as same } from '../domain/hand-of-order-capture-helper.js';
import { GUIDANCE, LIFE_REOPEN_NAMES, UI_RETRY_NAMES, distinctObserved, assertCapturedResources,
  assertObservedBoundary, assertObservedRound, assertObservedFinal, assertCapturedRoundResources, assertPublicProjection } from '../domain/hand-of-order-save-ui-helper.js';

const PANEL = '秩序之手成长', PAGE = '秩序之手与新划界场地', CONFIRM = '秩序之手操作确认', ROUND = '战斗回合结果';
const RECORD = '秩序之手本回合实际记录', RESOURCES = '秩序之手本回合实际资源', CURRENT = '秩序之手当前资源';
const BODY = '本回合按实际身体打击或弧光冲击结算身体伤势';
const MENTAL = '本回合只结算实际精神压力，不生成身体伤口';
const NONE = '本回合没有实际致伤来源，不掷身体伤势盘';
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const rootsHash = (state: SliceState) => captureValueHash(HAND_OF_ORDER_SOURCE_KEYS.map(key => state[key]));
const places = { START: '原门口', A: '原标线处', B: '室内原空桌旁', OUTSIDE: '室外', ANNEX_A: '新场地甲处', ANNEX_B: '新场地乙处' };
const ARCHIVED_FOURTH = 'consume-hand-of-order-potion-4';

// Only this newly emitted guidance text changed. Keep the original archive,
// all other records and every gameplay/random field as the expected state.
function withCurrentGuidance(archived: SliceState): SliceState {
  const expected = structuredClone(archived), records = expected.chronicle.filter(record => record.id === 'record-602-943');
  expect(records).toHaveLength(1);
  const record = records[0]!;
  expect({ id: record.id, week: record.week, title: record.title }).toEqual({
    id: 'record-602-943', week: 136, title: '听取秩序之手独立成品与专业准备指导',
  });
  expect(createHash('sha256').update(record.text).digest('hex')).toBe('71580ffd37c86930cd2c48ca913eef9d0cec1ba009bd0306b73615b3fe67ec4b');
  const oldGuidance = '全批失败耗尽后，实付1行动与100便士申请独立三瓶，至少跨一真实周领取；每瓶另做五次劳动并付1200便士，或直接支付7200便士。';
  const currentGuidance = '最初三瓶全部失败耗尽后，只能在原服药准备与支持交接处以1行动和120便士调查同一原特性的归属与位置，经保管方本次许可实际核验封存；至少下一真实周以1行动和30便士当面交接。新普通药物与调配服务900便士，或五项新劳动后90便士；当周检查仍另付1行动和180便士。失败残留不会自动回收，旧瓶、原失败与旧成本不改写，不再供应第四份原特性。可另付60便士、8灵性、6精神为所选同瓶准备同场当周支持，0行动，意志临时+15；仍可能失败，换瓶、退出或跨周失效，已付成本不退。';
  expect(record.text.endsWith(oldGuidance)).toBe(true);
  expect(expected.chronicle.reduce((count, row) => count + row.text.split(oldGuidance).length - 1, 0)).toBe(1);
  const latestGuidance = expected.lastResult?.id === record.id ? expected.lastResult : null;
  if (latestGuidance) same(latestGuidance, record);
  record.text = record.text.slice(0, -oldGuidance.length) + currentGuidance;
  if (latestGuidance) latestGuidance.text = record.text;
  return expected;
}

// Only IPC delivery is controlled. Every candidate comes from the real reducer
// on the complete captured state. SQLite behavior is covered by the save suite.
// Retain hashes, not attempted multi-megabyte state trees or synthetic outcomes.
function savedGame(input: SliceState) {
  let state = input, commits = 0, failNext = false, barrier: Promise<void> | null = null;
  const attemptedHashes: string[] = [], receipts = new Map<string, SliceReceipt>();
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    const prior = receipts.get(envelope.intentId);
    if (prior) return { ok: true, value: { ...structuredClone(prior), replayed: true } };
    if (envelope.payload.type === 'CREATE') throw new Error('The original natural campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next);
    attemptedHashes.push(captureValueHash(next));
    const wait = barrier; barrier = null; if (wait) await wait;
    if (failNext) { failNext = false; return { ok: false, error: {
      code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true,
    } }; }
    state = next; commits++;
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-16T00:00:00Z', replayed: false, state: projectSliceState(state) };
    receipts.set(envelope.intentId, receipt); return { ok: true, value: receipt };
  });
  return { get state() { return state; }, get commits() { return commits; }, attemptedHashes, submit,
    failNextSave() { failNext = true; }, holdNextSave() {
      if (barrier) throw new Error('A save barrier is already pending.');
      let release = () => {}; barrier = new Promise<void>(resolve => { release = resolve; }); return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function chooseSavedRun(game: SavedGame, value = projectSliceState(game.state)) {
  const continueButton = await screen.findByRole('button', { name: /继续游戏/ }, { timeout: 30_000 });
  if (value.status === 'DEAD') {
    expect(disabled(continueButton)).toBe(true); await userEvent.click(screen.getByRole('button', { name: /查看封存/ }));
  } else await userEvent.click(continueButton);
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  if (value.lastCombatRound?.handOfOrderOutcome || !value.handOfOrder.guidanceKnown && value.lastCombatRound) {
    await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
  } else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! }, { timeout: 30_000 });
  else if (value.status === 'DEAD' || value.ending) await screen.findByRole('heading', { name: value.ending!.title }, { timeout: 30_000 });
  else if (value.handOfOrder.insideCase) await screen.findByRole('region', { name: PANEL }, { timeout: 30_000 });
  else await screen.findByRole('button', { name: PAGE }, { timeout: 30_000 });
}
async function mount(game: SavedGame, presentationOnly?: (value: SliceProjection) => void) {
  expect([game.state.schemaVersion, game.state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  function projection() { const value = projectSliceState(game.state); presentationOnly?.(value); return value; }
  const value = projection(), loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async () => ({ ok: true, value: projection() }));
  window.sliceGame = { getBootstrap: vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
    mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name, portraitId: value.character.portraitId,
      week: value.week, date: value.date, status: value.status, revision: value.revision, updatedAt: '2026-10-16T00:00:00Z' }],
  } })), loadRun, submitIntent: game.submit };
  render(<SliceApp />); await chooseSavedRun(game, value); expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId); return loadRun;
}
async function reopen(game: SavedGame, presentationOnly?: (value: SliceProjection) => void) { cleanup(); await mount(game, presentationOnly); }
async function openPanel() {
  const oldRound = screen.queryByRole('dialog', { name: ROUND });
  if (oldRound) await userEvent.click(within(oldRound).getByRole('button', { name: '返回生活' }));
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: PAGE }));
  return screen.getByRole('region', { name: PANEL });
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
function assertCurrentBody(state: SliceState) {
  const value = projectSliceState(state), p = value.handOfOrder, panel = screen.getByRole('region', { name: PANEL });
  assertPublicProjection(state, value);
  const resources = within(panel).getByRole('region', { name: CURRENT });
  expect(resources.textContent).toContain(`健康${state.health}/${value.maxHealth} · 精神${state.mind}/${value.maxMind} · 灵性${state.spirituality}/${value.maxSpirituality}`);
  expect(resources.textContent).toContain(`${p.resources!.cash} · 本周行动${state.actionsRemaining}`);
  expect(resources.textContent).toContain(`现有伤势${state.injuries.length}处 · 伤势风险${state.injuryRisk}`);
  expect(panel.textContent).not.toMatch(/本人精力|现场精力|playerEnergy|能量100/);
  expect(state.balancer.encounter).toMatchObject({ status: 'RETREATED', enemyStatus: 'RESISTING', enemyHealth: 90,
    enemyMind: 100, enemySpirituality: 67, weaponLocation: 'HAND', enemyPosition: 'BETWEEN_A_AND_B' });
  expect(state.balancer.life.guardPlate.integrity).toBe(65);
  if (!p.promoted) return;
  const site = getHandOfOrderCurrentSite(state), yard = within(panel).queryByRole('region', { name: '秩序之手独立旁院冲突' });
  if (yard) {
    expect(yard.textContent).toContain(`本人在${places[site.playerLocation]}，米拉在${places[site.volunteer.location]}，薇娜在${places[site.guide.location]}`);
    expect(yard.textContent).toContain(`累计步行${site.playerTravelMetres}米，现场时钟${site.clockSeconds}秒`);
    expect(yard.textContent).toContain(`同一原护板当前完整度${p.encounter.guardPlate!.integrity}`);
  } else {
    const room = within(panel).getByRole('region', { name: '秩序之手原场事务' });
    expect(room.textContent).toContain(`本人在${places[site.playerLocation]}，累计普通步行${site.playerTravelMetres}米；现场时钟${site.clockSeconds}秒`);
    const body = within(panel).getByRole('region', { name: '原成年协作者与原物的实际位置', hidden: true });
    for (const field of ['guide', 'volunteer', 'parcel', 'line', 'paper', 'table'] as const) expect(body.textContent).toContain(playerText(p.life.site[field]));
    expect(room.textContent).toContain(`有限支撑片剩余${p.life.annex.supportPieces}枚；本阶段协作已耗力${p.life.annex.effortSpent}/${p.life.annex.effortLimit}，米拉当前精神${p.life.annex.volunteerMind}`);
    expect(within(room).getByRole('region', { name: '同一原护板当前状态' }).textContent).toContain(`当前完整度${p.life.guardPlate.integrity}`);
  }
}
function assertLife(state: SliceState) {
  assertCurrentBody(state);
  const value = projectSliceState(state).handOfOrder.life, room = screen.getByRole('region', { name: '秩序之手原场事务' });
  const attempt = value.currentAttempt;
  if (attempt) {
    const actual = within(room).getByRole('region', { name: '秩序之手本次实际尝试', hidden: true });
    expect(actual.textContent).toContain(`实耗${attempt.spiritualitySpent}灵性、${attempt.mindSpent}精神、${attempt.healthLost}健康；本人步行${attempt.playerTravelMetres}米，经过${attempt.elapsedSeconds}秒`);
    expect(actual.textContent).toContain(`协作耗力${attempt.effortSpent}，米拉消耗${attempt.volunteerMindSpent}精神`);
    if (attempt.permissionWithdrawn) expect(room.textContent).toContain('许可已撤回，不能继续施术');
    if (attempt.impact) expect(actual.textContent).toContain(`这次可见冲击实际损失${attempt.impact.healthLoss}健康、磨损${attempt.impact.plateWear}护板完整度`);
  }
  const pending = within(room).queryByRole('region', { name: '当前待执行的有限动作' });
  if (value.pendingAction && value.activeCase) {
    expect(pending).not.toBeNull(); expect(pending!.textContent).toContain(playerText(value.pendingAction));
    if (value.effectRemainingSeconds > 0) expect(pending!.textContent).toContain(`当前作用还剩${value.effectRemainingSeconds}秒`);
  } else expect(pending).toBeNull();
  return room.textContent;
}
function assertRound(state: SliceState) {
  const value = projectSliceState(state), round = value.lastCombatRound!, outcome = round.handOfOrderOutcome;
  if (!outcome) throw new Error('Expected an actual captured Hand of Order round.');
  assertObservedRound(state); assertPublicProjection(state, value);
  const reveal = screen.getByRole('dialog', { name: ROUND }), record = within(reveal).getByRole('region', { name: RECORD });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  expect(record.textContent).toContain(`回合结束：本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  expect(record.textContent).toContain(`本回合实际经过${outcome.elapsedSeconds}秒；回合结算时现场时钟${outcome.siteAfter.clockSeconds}秒，本人累计普通移动${outcome.siteAfter.playerTravelMetres}米`);
  expect(record.textContent).toContain(`独立护片余${outcome.supportPieces.filter(piece => piece.status === 'HELD').length}/${outcome.supportPieces.length}枚，累计实际磨损${outcome.supportPieces.reduce((n, piece) => n + piece.wear, 0)}`);
  expect(record.textContent).toContain(`原护板当前完整度${outcome.guardPlateAfter.integrity}`);
  const domainText = round.consequenceDomain === 'BODY' ? BODY : round.consequenceDomain === 'MENTAL' ? MENTAL : NONE;
  expect(record.textContent).toContain(domainText);
  for (const text of [BODY, MENTAL, NONE]) if (text !== domainText) expect(record.textContent).not.toContain(text);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(within(record).getByRole('list', { name: '秩序之手实际动作' })).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    const text = rows[index]!.textContent;
    expect(text).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：`);
    expect(text).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(text).toContain(`现场第${action.atSeconds}秒开始，实际经过${action.elapsedSeconds}秒，普通移动${action.travelMetres}米`);
    expect(text).toContain(`本槽后本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}；对手灵性${action.enemySpiritualityAfter}`);
    if (action.supportId) expect(text).toContain(`实际消耗同一枚独立护片，磨损${action.supportWearPaid}`);
    if (action.enemyChargeId) expect(text).toContain('对手实际消耗一枚原刻片');
    if (action.resisted) expect(text).toContain('对手已经实际抵抗');
    for (const window of action.windowsApplied) {
      expect(text).toContain(window.kind === 'DIVISION'
        ? `先前付费的分场控制现已为本人这次未结算身体行动增加${window.amount}`
        : `先前付费的余波控制现已为这次身体或弧光冲击减去${window.amount}贡献`);
    }
    if (action.attackKind === 'MIND') {
      expect(text).toContain('实际精神压力，不生成身体伤口');
      expect(action.windowsApplied.some(window => window.kind === 'AFTERMATH')).toBe(false);
    }
  });
  expect(within(reveal).queryByRole('region', { name: '平衡者本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '平衡者成长' })).toBeNull();
  const next = state.ending ? '查看收尾卷宗' : state.combat ? '进入下一回合' : '返回生活';
  for (const label of ['查看收尾卷宗', '进入下一回合', '返回生活']) {
    if (label === next) expect(within(reveal).getByRole('button', { name: label })).toBeTruthy();
    else expect(within(reveal).queryByRole('button', { name: label })).toBeNull();
  }
  if (!state.ending) assertCurrentBody(state);
}
function openAction(action: HandOfOrderAction) {
  const panel = screen.getByRole('region', { name: PANEL });
  const buttons = within(panel).getAllByRole('button', { hidden: true }).filter(button => button.textContent?.startsWith(playerText(action.label)));
  expect(buttons).toHaveLength(1); const button = buttons[0]!, fold = button.closest('details'); if (fold) fold.open = true;
  expect(disabled(button)).toBe(false); fireEvent.click(button); return screen.getByRole('dialog', { name: CONFIRM });
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  // Separate mockImplementation calls let resetAllMocks release captured states.
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('requires coordinator-frozen actual stage206 capture before claiming renderer coverage', () => {
  const observed = observedCapture();
  expect(observed.commands).toBe(801); expect(observed.combatRounds).toEqual([1, 2, 3]); expect(observed.promotionWeek).toBe(179);
  expect(observed.stage).toBe('ACTUAL_TERMINAL_WITH_NATURAL594_HISTORY'); expect(observed.boundarySteps[GUIDANCE]).toBeDefined();
  expect(observed.pendingIntent).toBeNull(); expect(observed.failurePhase).toBe('IDLE');
  expect(observed.freezeSha256).toBe('82595e0577e1408fe3343da02116e90f99f4ac129af355b3ad57947655dc8b90');
  for (const round of observed.combatRounds) expect(observed.boundarySteps[`combat-round-${round}`]).toBeDefined();
  if (observed.promotionWeek !== null) expect(observed.boundarySteps.promotion).toBeDefined();
}, 30_000);

describe('Hand of Order actual saved UI and identical-intent retry', () => {
  it.each(UI_RETRY_NAMES.filter(name => name !== ARCHIVED_FOURTH))('%s keeps real resources uncommitted on failure and commits the identical retry once', async name => {
    const boundary = namedBoundary(name), before = boundary.before, expected = name === GUIDANCE ? withCurrentGuidance(boundary.final) : boundary.final;
    if (boundary.intent.type !== 'HAND_OF_ORDER') throw new Error('Expected a real panel operation.');
    const command = boundary.intent.command, game = savedGame(before), releaseFailure = game.holdNextSave();
    game.failNextSave(); await mount(game); await openPanel();
    const action = projectSliceState(before).handOfOrder.actions.find(row => JSON.stringify(row.command) === JSON.stringify(command));
    if (!action) throw new Error('The captured operation is not publicly offered.');
    const resources = screen.getByRole('region', { name: CURRENT }).textContent;
    const submit = within(openAction(action)).getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, boundary.intent, 1);
    expect(disabled(submit)).toBe(true); same(game.state, before); expect(game.commits).toBe(0);
    expect(game.attemptedHashes).toEqual([captureValueHash(expected)]);
    await act(async () => { releaseFailure(); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(), { timeout: 30_000 });
    expect(screen.getByRole('region', { name: CURRENT }).textContent).toBe(resources); assertCurrentBody(before);
    for (const button of within(screen.getByRole('region', { name: PANEL })).getAllByRole('button', { hidden: true })) expect(disabled(button)).toBe(true);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    const retry = screen.getByRole('button', { name: '重试这次操作' }); fireEvent.click(retry); fireEvent.click(retry);
    assertEnvelope(game, before, boundary.intent, 2); expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope);
    same(game.state, before); expect(game.commits).toBe(0);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(expected.revision), { timeout: 30_000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(), { timeout: 30_000 });
    same(game.state, expected); expect(game.commits).toBe(1);
    expect(game.attemptedHashes).toEqual([captureValueHash(expected), captureValueHash(expected)]);
    assertObservedBoundary(name, expected); assertCapturedResources(before, boundary.intent, expected); expect(rootsHash(game.state)).toBe(rootsHash(before));
    assertCurrentBody(expected); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    await reopen(game); await openPanel(); assertCurrentBody(expected);
    same(game.state, expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 180_000);

  it('reopens both actual fourth-independent-bottle endpoints as read-only history and rejects live consumption without writes', async () => {
    expect(UI_RETRY_NAMES).toContain(ARCHIVED_FOURTH);
    const boundary = namedBoundary(ARCHIVED_FOURTH), archiveHash = await captureFileHash(boundary.path);
    expect(archiveHash).toBe('24ff09f0bc982dcd9adf05c661825568e7ddca7595e1c9682e3fd022fe703009');
    expect(boundary.intent).toEqual({ type: 'HAND_OF_ORDER', command: { type: 'CONSUME', bottleId: 'hand-of-order-potion-4', confirmed: true } });
    assertCapturedResources(boundary.before, boundary.intent, boundary.final); assertObservedBoundary(ARCHIVED_FOURTH, boundary.final);
    // Load each authentic endpoint independently; never synthesize a successful
    // current-rule receipt for the archived fourth independent original.
    for (const state of [boundary.before, boundary.final]) {
      cleanup();
      const game = savedGame(state), hash = captureValueHash(state), value = projectSliceState(state);
      expect(state.handOfOrder.bottles).toHaveLength(6);
      expect(state.handOfOrder.bottles.every(bottle => bottle.recovery === undefined)).toBe(true);
      expect(resolveHandOfOrderOriginalsSnapshot(state.handOfOrder)).toBeNull();
      const action = value.handOfOrder.actions.find(row => JSON.stringify({ type: 'HAND_OF_ORDER', command: row.command }) === JSON.stringify(boundary.intent));
      expect(action?.enabled ?? false).toBe(false);
      const envelope = { intentId: `archived-fourth:${state.revision}`, runId: state.runId, expectedRevision: state.revision, payload: boundary.intent };
      await mount(game);
      for (let attempt = 0; attempt < 2; attempt++) {
        if (attempt) await reopen(game);
        const panel = await openPanel(); assertCurrentBody(state);
        if (!value.handOfOrder.promoted) {
          expect(action).toBeDefined();
          expect(action!.reason).toBe('历史独立第4份及以后原特性存在守恒冲突；旧记录只读，不能改标为回收件或继续本入口。');
          const bottle = value.handOfOrder.bottles.find(row => row.id === 'hand-of-order-potion-4')!;
          await userEvent.click(within(within(panel).getByRole('navigation', { name: '秩序之手目标' })).getByRole('button', { name: name => name.startsWith(bottle.title) }));
          const buttons = within(panel).getAllByRole('button', { hidden: true }).filter(button => button.textContent?.startsWith(playerText(action!.label)));
          expect(buttons).toHaveLength(1);
          const consume = buttons[0]!, fold = consume.closest('details'); if (fold) fold.open = true;
          expect(disabled(consume)).toBe(true); fireEvent.click(consume);
          expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
        }
        expect(game.submit).toHaveBeenCalledTimes(attempt);
        await expect(game.submit(envelope)).rejects.toThrow();
        assertEnvelope(game, state, boundary.intent, attempt + 1);
        expect(game.attemptedHashes).toEqual([]); expect(game.commits).toBe(0);
        expect(captureValueHash(game.state)).toBe(hash); expect(captureValueHash(state)).toBe(hash);
      }
      await reopen(game); await openPanel(); assertCurrentBody(state);
      expect(captureValueHash(game.state)).toBe(hash); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(0);
    }
    expect(await captureFileHash(boundary.path)).toBe(archiveHash);
  }, 180_000);

  it('reopens the genuine treated source without a free refill or restoration of old opponents', async () => {
    const source = capturedSnapshot('treated'), game = savedGame(source), hash = captureValueHash(source);
    expect(source.health).toBe(100); expect(source.injuries).toEqual([]); expect(source.handOfOrder.guidanceKnown).toBe(false);
    expect(source.balancer.life.guardPlate.integrity).toBe(65);
    await mount(game); await openPanel(); assertCurrentBody(source);
    await reopen(game); await openPanel(); assertCurrentBody(source);
    expect(captureValueHash(game.state)).toBe(hash); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it.each(['guidance', 'promoted'])
  ('reopens %s without replaying historical Caspar or changing the actual bottles and original guard plate', async name => {
    const source = capturedSnapshot(name), game = savedGame(source), original = currentCapture(sourceEntry('final'));
    expect(rootsHash(source)).toBe(rootsHash(original));
    expect(source.balancer.promotionWeek).toBe(126); expect(source.progression.promotionWeek).toBe(9);
    if (name === 'promoted') expect(source.handOfOrder.promotionWeek).toBe(observedCapture().promotionWeek);
    const bottleHash = captureValueHash(source.handOfOrder.bottles), plateHash = captureValueHash(source.handOfOrder.life.guardPlate);
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openPanel(); assertCurrentBody(source);
    expect(screen.queryByRole('region', { name: '平衡者成长' })).toBeNull();
    await reopen(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openPanel(); assertCurrentBody(source);
    expect(captureValueHash(game.state.handOfOrder.bottles)).toBe(bottleHash);
    expect(captureValueHash(game.state.handOfOrder.life.guardPlate)).toBe(plateHash);
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it.each(LIFE_REOPEN_NAMES)('reopens the actual finite life operation %s with its paid costs, clock and original parcel and guard plate', async name => {
    const source = namedBoundary(name).final, game = savedGame(source); await mount(game); await openPanel();
    const text = assertLife(source), hash = captureValueHash(source);
    await reopen(game); await openPanel(); expect(assertLife(source)).toBe(text);
    expect(captureValueHash(game.state)).toBe(hash); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 180_000);

  it.each(['combatStart'])
  ('opens the real S1 fight at %s before inherited S2 promotion and the historical Caspar record', async name => {
    const source = capturedSnapshot(name), game = savedGame(source), value = projectSliceState(source);
    expect(source.combat).toMatchObject({ encounterId: 'HAND_OF_ORDER_DISPUTE', round: 1, lastRound: null });
    expect(value.balancer.promoted).toBe(true); expect(value.handOfOrder.promoted).toBe(true);
    expect(source.lastCombatRound?.balancerOutcome).toBeDefined();
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES });
    expect(resources.textContent).toContain(`本人健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality}`);
    const battle = value.combat!.handOfOrder!;
    expect(resources.textContent).toContain(`${battle.enemyName}健康${battle.enemyHealth}/100 · 精神${battle.enemyMind}/100 · 独立灵性${battle.enemySpirituality}/120`);
    expect(resources.textContent).toContain(`本次独立护片余${battle.supportPieces.filter(piece => piece.status === 'HELD').length}/${battle.supportPieces.length}枚`);
    expect(within(stage).queryByRole('radio', { name: '本回合保留幸运' })).toBeNull();
    expect(within(stage).queryByRole('region', { name: '平衡者本回合实际资源' })).toBeNull(); assertCurrentBody(source);
    const text = resources.textContent; await reopen(game); expect(screen.getByRole('region', { name: RESOURCES }).textContent).toBe(text);
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it.each(observedCapture().combatRounds)('keeps real round %i failed and uncommitted, then reveals one identical retry before reopen', async number => {
    const boundary = namedBoundary(`combat-round-${number}`), before = boundary.before, expected = boundary.final;
    const intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    expect(boundary.intent).toEqual(intent); expect(Object.hasOwn(boundary.intent, 'winnerPolicy')).toBe(false);
    const game = savedGame(before), value = projectSliceState(before), releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game);
    if (before.lastCombatRound?.handOfOrderOutcome) await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '进入下一回合' }));
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES }).textContent;
    const stance = value.combat!.stances.find(row => row.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, intent, 1); expect(disabled(submit)).toBe(true);
    same(game.state, before); expect(game.commits).toBe(0); expect(game.attemptedHashes).toEqual([captureValueHash(expected)]);
    expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    expect(within(stage).getByRole('region', { name: RESOURCES }).textContent).toBe(resources);
    await act(async () => { releaseFailure(); }); const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(disabled(submit)).toBe(true); same(game.state.random, before.random); assertCurrentBody(before);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); assertEnvelope(game, before, intent, 2);
    expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); same(game.state, before);
    await act(async () => { releaseSuccess(); }); await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
    assertRound(expected); same(game.state, expected); expect(game.commits).toBe(1);
    expect(game.attemptedHashes).toEqual([captureValueHash(expected), captureValueHash(expected)]);
    assertCapturedRoundResources(before, expected);
    expect(rootsHash(game.state)).toBe(rootsHash(before)); const text = screen.getByRole('region', { name: RECORD }).textContent;
    await reopen(game); assertRound(expected); expect(screen.getByRole('region', { name: RECORD }).textContent).toBe(text);
    same(game.state, expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 180_000);

  it.each(distinctObserved(['paired-handover-leave']))('requires the actual cleanup command at %s rather than title navigation', async name => {
    const boundary = namedBoundary(name), before = boundary.before, expected = boundary.final, game = savedGame(before), loadRun = await mount(game);
    expect(boundary.intent).toEqual({ type: 'HAND_OF_ORDER', command: { type: 'LEAVE', caseId: 'paired-handover' } });
    expect(projectSliceState(before).handOfOrder.insideCase).toBe(true);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '返回主菜单' })); await chooseSavedRun(game);
    expect(loadRun).toHaveBeenCalledTimes(2); same(game.state, before); expect(game.submit).not.toHaveBeenCalled(); assertCurrentBody(before);
    const action = projectSliceState(before).handOfOrder.actions.find(row => row.enabled && row.command.type === 'LEAVE' && row.command.caseId === 'paired-handover');
    if (!action) throw new Error('The actual ordinary exit is not publicly offered.');
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '取消，返回查看' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull()); same(game.state, before);
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state.revision).toBe(expected.revision), { timeout: 30_000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(), { timeout: 30_000 });
    assertEnvelope(game, before, boundary.intent, 1); assertCapturedResources(before, boundary.intent, expected); same(game.state, expected);
    expect(getHandOfOrderCurrentSite(expected).playerLocation).toBe('OUTSIDE');
    expect(expected.handOfOrder.life.cases['paired-handover'].attempts[0]!.objectsReturned).toBe(true);
    expect(expected.handOfOrder.life.guardPlate!.location).toBe('OUTSIDE');
    expect(projectSliceState(expected).handOfOrder.insideCase).toBe(false);
    await reopen(game); await openPanel(); assertCurrentBody(expected); expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    same(game.state, expected); expect(game.commits).toBe(1); expect(game.submit).toHaveBeenCalledTimes(1);
  }, 180_000);

  it.each((observedCapture().combatRounds).slice(0, 1))('preserves authored-token lookalikes in a custom display name at actual round %i', async number => {
    const source = namedBoundary(`combat-round-${number}`).final, game = savedGame(source), hash = captureValueHash(source);
    const displayName = '原创G · G候选映射 BODY MENTAL SUCCESS FAILURE';
    const presentationOnly = (value: SliceProjection) => {
      value.character = { ...value.character, name: displayName };
      value.handOfOrder = { ...value.handOfOrder, characterName: displayName,
        appearanceRecord: value.handOfOrder.appearanceRecord.replace(source.character.name, displayName) };
    };
    await mount(game, presentationOnly); assertRound(source);
    expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${PAGE}`);
    if (!source.ending) expect(screen.getByRole('region', { name: PANEL }).textContent).toContain(displayName);
    await reopen(game, presentationOnly); assertRound(source);
    expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${PAGE}`);
    expect(captureValueHash(game.state)).toBe(hash); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it('reopens the actual three-round player death as a sealed record with the original body and plate', async () => {
    const source = capturedState('final'), game = savedGame(source), observed = observedCapture(), hash = captureValueHash(source);
    assertObservedFinal(source); same(captureBody(source), observed.final); same(source.handOfOrder.encounter.terminal, observed.terminal);
    await mount(game);
    if (source.lastCombatRound?.handOfOrderOutcome) {
      assertRound(source);
      fireEvent.keyDown(screen.getByRole('dialog', { name: ROUND }), { key: 'Escape' });
      expect(screen.getByRole('dialog', { name: ROUND })).toBeTruthy();
      await userEvent.click(screen.getByRole('checkbox', { name: '快速显示本回合结果' })); same(game.state, source);
      await reopen(game); assertRound(source);
      const outcome = source.lastCombatRound.handOfOrderOutcome, terminal = source.handOfOrder.encounter.terminal;
      if (terminal) {
        const site = getHandOfOrderCurrentSite(source), exit = source.status === 'DEAD' ? 0 : 4;
        expect(terminal.exitMetres).toBe(exit); expect(terminal.exitSeconds).toBe(exit);
        expect(site.playerLocation).toBe(exit ? 'OUTSIDE' : 'ANNEX_A');
        expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + exit);
        expect(site.clockSeconds).toBe(outcome.siteAfter.clockSeconds + exit);
        same(source.handOfOrder.encounter.supportPieces, outcome.supportPieces); same(source.handOfOrder.encounter.enemyCharges, outcome.enemyCharges);
        expect(source.handOfOrder.life.guardPlate!.integrity).toBe(outcome.guardPlateAfter.integrity);
      }
      if (source.status === 'DEAD') {
        await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '查看收尾卷宗' }));
        expect(await screen.findByRole('heading', { name: source.ending!.title })).toBeTruthy();
        expect(screen.queryByRole('group', { name: '四个主要行动' })).toBeNull();
      } else if (!source.combat && !source.ending) {
        await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '返回生活' }));
        if (screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
        expect(await screen.findByRole('group', { name: '四个主要行动' })).toBeTruthy();
      }
    } else if (source.status === 'ACTIVE' && !source.combat && !source.ending) {
      await openPanel(); assertCurrentBody(source); await reopen(game); await openPanel(); assertCurrentBody(source);
    } else {
      await reopen(game); expect(projectSliceState(game.state).canAct).toBe(false);
    }
    expect(captureValueHash(game.state)).toBe(hash); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 180_000);
});
