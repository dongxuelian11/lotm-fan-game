/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { playerText } from '../../src/shared/player-text.js';
import { PRINCE_OF_ABOLITION_SOURCE_KEYS, type PrinceOfAbolitionAction } from '../../src/domain/prince-of-abolition/types.js';
import { getPrinceOfAbolitionCurrentSite } from '../../src/domain/prince-of-abolition/life.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { PRINCE_OF_ABOLITION_CAPTURE_EVIDENCE as evidence } from '../domain/prince-of-abolition-capture-evidence.js';
import { capturedSnapshot, capturedState, namedBoundary, observedCapture, captureBody, captureValueHash,
  currentCapture, sourceEntry, sameCaptureValue as same } from '../domain/prince-of-abolition-capture-helper.js';
import { GUIDANCE, LIFE_REOPEN_NAMES, UI_RETRY_NAMES, distinctObserved, assertCapturedResources,
  assertObservedBoundary, assertObservedRound, assertObservedFinal, assertPublicProjection } from '../domain/prince-of-abolition-save-ui-helper.js';

const PANEL = '弑序亲王成长', PAGE = '弑序亲王与原物承接区', CONFIRM = '弑序亲王操作确认', ROUND = '战斗回合结果';
const RECORD = '弑序亲王本回合实际记录', RESOURCES = '弑序亲王本回合实际资源', CURRENT = '弑序亲王当前资源';
const BODY = '本回合按实际身体打击或弧光冲击结算身体伤势';
const MENTAL = '本回合只结算实际精神压力，不生成身体伤口';
const NONE = '本回合没有实际致伤来源，不掷身体伤势盘';
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const rootsHash = (state: SliceState) => captureValueHash(PRINCE_OF_ABOLITION_SOURCE_KEYS.map(key => state[key]));
const places = { START: '原门口', A: '原室操作处', B: '室内原接收垫', C: '室内另一原接收垫',
  OUTSIDE: '室外', ANNEX: '新承接区出手处', RECEIVER: '新接球软垫', YARD: '独立旁院' };

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
  if (value.lastCombatRound?.princeOfAbolitionOutcome || !value.princeOfAbolition.guidanceKnown && value.lastCombatRound) {
    await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
  } else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! }, { timeout: 30_000 });
  else if (value.status === 'DEAD' || value.ending) await screen.findByRole('heading', { name: value.ending!.title }, { timeout: 30_000 });
  else if (value.princeOfAbolition.insideCase) await screen.findByRole('region', { name: PANEL }, { timeout: 30_000 });
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
  const value = projectSliceState(state), p = value.princeOfAbolition, panel = screen.getByRole('region', { name: PANEL });
  assertPublicProjection(state, value);
  const resources = within(panel).getByRole('region', { name: CURRENT });
  expect(resources.textContent).toContain(`健康${state.health}/${value.maxHealth} · 精神${state.mind}/${value.maxMind} · 灵性${state.spirituality}/${value.maxSpirituality}`);
  expect(resources.textContent).toContain(`${p.resources!.cash} · 本周行动${state.actionsRemaining}`);
  expect(resources.textContent).toContain(`当前原赠物仍持有${p.gifts.held}份，已经实际送出${p.gifts.given}份`);
  expect(resources.textContent).toContain(`原伤势${state.injuries.length}处 · 伤势风险${state.injuryRisk}`);
  expect(panel.textContent).not.toMatch(/本人精力|现场精力|playerEnergy|能量100/);
  if (!p.promoted) return;
  const site = getPrinceOfAbolitionCurrentSite(state), yard = within(panel).queryByRole('region', { name: '弑序亲王独立旁院冲突' });
  if (yard) {
    expect(yard.textContent).toContain(`本人在${places[site.playerLocation]}，达里安在${places[site.volunteer.location]}，米蕾在${places[site.guide.location]}`);
    expect(yard.textContent).toContain(`累计普通步行${site.playerTravelMetres}米，原现场时钟${site.clockSeconds}秒`);
  } else {
    const body = within(panel).getByRole('region', { name: '原成年协作者与原物的实际位置' });
    expect(body.textContent).toContain(`本人实际在${places[site.playerLocation]}，累计普通步行${site.playerTravelMetres}米，原现场时钟${site.clockSeconds}秒`);
    for (const field of ['guide', 'volunteer', 'parcel', 'ball', 'paper'] as const) expect(body.textContent).toContain(playerText(p.life.site[field]));
    expect(body.textContent).toContain(`本阶段协作实际耗力${p.life.cooperationEffortSpent}，达里安实际消耗${p.life.volunteerMindSpent}精神`);
    const pads = within(body).getByRole('list', { name: '室内原垫保持原位' });
    expect(within(pads).getAllByRole('listitem').map(item => item.textContent)).toEqual(p.life.site.pads.map(playerText));
  }
  expect(state.entropyDuke.encounter).toMatchObject({ targetId: 'ED2-OSWIN', enemyStatus: 'SURRENDERED',
    enemyHealth: 60, enemyMind: 100, enemySpirituality: 85, weaponLocation: 'HAND' });
}
function assertLife(state: SliceState) {
  assertCurrentBody(state);
  const value = projectSliceState(state).princeOfAbolition.life, room = screen.getByRole('region', { name: '弑序亲王原场事务' });
  const attempt = value.currentAttempt;
  if (attempt) {
    const actual = within(room).getByRole('region', { name: '弑序亲王本次实际尝试' });
    expect(actual.textContent).toContain(`本次实耗${attempt.spiritualitySpent}灵性、${attempt.mindSpent}精神、${attempt.penniesSpent}便士；实际应用${attempt.appliedAbilityIds.length}项能力`);
    expect(actual.textContent).toContain(`本人实际走${attempt.playerTravelMetres}米，实际经过${attempt.elapsedSeconds}秒`);
    expect(actual.textContent).toContain(`实际强化增加${attempt.amplification}，同一未结束轨迹实际延长${attempt.maintenanceSeconds}秒`);
    if (attempt.withdrawn) expect(actual.textContent).toContain('本案许可已真实撤回');
    const piece = value.pieces.find(row => row.caseId === value.activeCase);
    if (piece) expect(room.textContent).toContain(`实际用量剩余${piece.charges}/1 · 实际磨损${piece.wear}`);
  }
  const window = within(room).queryByRole('region', { name: '本人待执行动作的有限强化' });
  if (value.pending) expect(window!.textContent).toContain(`定向强化还剩${value.pending.remainingSeconds}秒`); else expect(window).toBeNull();
  const flight = within(room).queryByRole('region', { name: '同一原球正在发生的有限轨迹' });
  if (value.flight) {
    expect(flight!.textContent).toContain(`已经前进${value.flight.positionMetres}米，实际还需等待${value.flight.remainingSeconds}秒`);
    if (value.flight.maintenanceSeconds) expect(flight!.textContent).toContain(`这次未结束轨迹已实际延长${value.flight.maintenanceSeconds}秒`);
    else expect(flight!.textContent).toContain('这次轨迹尚未延长');
  } else expect(flight).toBeNull();
  return room.textContent;
}
function assertRound(state: SliceState) {
  const value = projectSliceState(state), round = value.lastCombatRound!, outcome = round.princeOfAbolitionOutcome;
  if (!outcome) throw new Error('Expected an actual captured Prince of Abolition round.');
  assertObservedRound(state);
  assertPublicProjection(state, value);
  const reveal = screen.getByRole('dialog', { name: ROUND }), record = within(reveal).getByRole('region', { name: RECORD });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  expect(record.textContent).toContain(`回合结束：本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  expect(record.textContent).toContain(`本回合实际经过${outcome.elapsedSeconds}秒；回合结算时现场时钟${outcome.siteAfter.clockSeconds}秒，本人累计普通移动${outcome.siteAfter.playerTravelMetres}米`);
  expect(record.textContent).toContain(`独立护片余${outcome.supportPieces.filter(piece => piece.status === 'HELD').length}/${outcome.supportPieces.length}枚，累计实际磨损${outcome.supportPieces.reduce((n, piece) => n + piece.wear, 0)}`);
  expect(record.textContent).toContain(`本人仍持有${outcome.giftsAfter.filter(gift => gift.location === 'PLAYER').length}份原赠物`);
  const domainText = round.consequenceDomain === 'BODY' ? BODY : round.consequenceDomain === 'MENTAL' ? MENTAL : NONE;
  expect(record.textContent).toContain(domainText);
  for (const text of [BODY, MENTAL, NONE]) if (text !== domainText) expect(record.textContent).not.toContain(text);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(within(record).getByRole('list', { name: '弑序亲王实际动作' })).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    const text = rows[index]!.textContent;
    expect(text).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：`);
    expect(text).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(text).toContain(`现场第${action.atSeconds}秒开始，实际经过${action.elapsedSeconds}秒，普通移动${action.travelMetres}米`);
    expect(text).toContain(`本槽后本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}；对手灵性${action.enemySpiritualityAfter}`);
    if (action.supportId) expect(text).toContain(`实际消耗同一枚独立护片，磨损${action.supportWearPaid}`);
    if (action.enemyChargeId) expect(text).toContain('对手实际消耗一枚原刻片');
    if (action.giftId) expect(text).toContain('同一份原木筹的实际给予记录');
    if (action.resisted) expect(text).toContain('对手已经实际抵抗');
    for (const window of action.windowsApplied) {
      expect(text).toContain(window.kind === 'DIRECTED'
        ? `先前付费的定向增幅现已为本人这次未结算身体行动增加${window.amount}`
        : `先前付费的效果维持现已为这次身体或弧光冲击减去${window.amount}贡献`);
    }
    if (action.attackKind === 'MIND') {
      expect(text).toContain('实际精神压力，不生成身体伤口');
      expect(action.windowsApplied.some(window => window.kind === 'MAINTENANCE')).toBe(false);
    }
  });
  expect(within(reveal).queryByRole('region', { name: '熵之公爵本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '熵之公爵成长' })).toBeNull();
  const next = state.ending ? '查看收尾卷宗' : state.combat ? '进入下一回合' : '返回生活';
  for (const label of ['查看收尾卷宗', '进入下一回合', '返回生活']) {
    if (label === next) expect(within(reveal).getByRole('button', { name: label })).toBeTruthy();
    else expect(within(reveal).queryByRole('button', { name: label })).toBeNull();
  }
  if (!state.ending) assertCurrentBody(state);
}
function openAction(action: PrinceOfAbolitionAction) {
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

it('requires the coordinator-frozen actual stage205 capture before claiming renderer coverage', () => {
  const observed = observedCapture();
  expect(observed.commands).toBe(924); expect(observed.boundarySteps[GUIDANCE]).toBeDefined();
  expect(observed.pendingIntent).toBeNull(); expect(observed.stage).toBe('NATURAL743_PREFIX_PUBLIC_PRINCE_OF_ABOLITION_CONTINUATION');
  expect(observed.combatRounds).toEqual([1, 2, 3, 4, 5, 6]);
  expect(observed.promotionWeek).toBe(216); expect(observed.boundarySteps['combat-actual-effect-maintenance']).toBeUndefined();
  for (const round of observed.combatRounds) expect(observed.boundarySteps[`combat-round-${round}`]).toBeDefined();
  if (observed.promotionWeek !== null) expect(observed.boundarySteps.promotion).toBeDefined();
}, 30_000);

describe.skipIf(evidence.observed === null)('Prince of Abolition actual saved UI and identical-intent retry', () => {
  it.each(UI_RETRY_NAMES)('%s keeps real resources uncommitted on failure and commits the identical retry once', async name => {
    const boundary = namedBoundary(name), before = boundary.before, expected = boundary.final;
    if (boundary.intent.type !== 'PRINCE_OF_ABOLITION') throw new Error('Expected a real panel operation.');
    const command = boundary.intent.command, game = savedGame(before), releaseFailure = game.holdNextSave();
    game.failNextSave(); await mount(game); await openPanel();
    const action = projectSliceState(before).princeOfAbolition.actions.find(row => JSON.stringify(row.command) === JSON.stringify(command));
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

  it.each((evidence.observed?.snapshots ?? []).filter(name => ['guidance', 'promoted'].includes(name)))
  ('reopens %s without replaying historical Oswin or changing the actual bottles and original gifts', async name => {
    const source = capturedSnapshot(name), game = savedGame(source), original = currentCapture(sourceEntry('final'));
    expect(rootsHash(source)).toBe(rootsHash(original));
    expect(source.entropyDuke.promotionWeek).toBe(175); expect(source.progression.promotionWeek).toBe(6);
    if (name === 'promoted') expect(source.princeOfAbolition.promotionWeek).toBe(observedCapture().promotionWeek);
    const bottleHash = captureValueHash(source.princeOfAbolition.bottles), giftsHash = captureValueHash(source.princeOfAbolition.gifts);
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openPanel(); assertCurrentBody(source);
    expect(screen.queryByRole('region', { name: '熵之公爵成长' })).toBeNull();
    await reopen(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openPanel(); assertCurrentBody(source);
    expect(captureValueHash(game.state.princeOfAbolition.bottles)).toBe(bottleHash);
    expect(captureValueHash(game.state.princeOfAbolition.gifts)).toBe(giftsHash);
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it.each(LIFE_REOPEN_NAMES)('reopens the actual finite life operation %s with its paid costs, clock and original ball', async name => {
    const source = namedBoundary(name).final, game = savedGame(source); await mount(game); await openPanel();
    const text = assertLife(source), hash = captureValueHash(source);
    await reopen(game); await openPanel(); expect(assertLife(source)).toBe(text);
    expect(captureValueHash(game.state)).toBe(hash); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 180_000);

  it.each((evidence.observed?.snapshots ?? []).filter(name => name === 'combatStart'))
  ('opens the real S1 fight at %s before inherited S2 promotion and the historical Oswin record', async name => {
    const source = capturedSnapshot(name), game = savedGame(source), value = projectSliceState(source);
    expect(source.combat).toMatchObject({ encounterId: 'PRINCE_OF_ABOLITION_DISPUTE', round: 1, lastRound: null });
    expect(value.entropyDuke.promoted).toBe(true); expect(value.princeOfAbolition.promoted).toBe(true);
    expect(source.lastCombatRound?.entropyDukeOutcome).toBeDefined();
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES });
    expect(resources.textContent).toContain(`本人健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality}`);
    const battle = value.combat!.princeOfAbolition!;
    expect(resources.textContent).toContain(`${battle.enemyName}健康${battle.enemyHealth}/100 · 精神${battle.enemyMind}/100 · 独立灵性${battle.enemySpirituality}/120`);
    expect(resources.textContent).toContain(`本次独立护片余${battle.supportPieces.filter(piece => piece.status === 'HELD').length}/${battle.supportPieces.length}枚`);
    expect(within(stage).queryByRole('radio', { name: '本回合保留幸运' })).toBeNull();
    expect(within(stage).queryByRole('region', { name: '熵之公爵本回合实际资源' })).toBeNull(); assertCurrentBody(source);
    const text = resources.textContent; await reopen(game); expect(screen.getByRole('region', { name: RESOURCES }).textContent).toBe(text);
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it.each(evidence.observed?.combatRounds ?? [])('keeps real round %i failed and uncommitted, then reveals one identical retry before reopen', async number => {
    const boundary = namedBoundary(`combat-round-${number}`), before = boundary.before, expected = boundary.final;
    const intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    expect(boundary.intent).toEqual(intent); expect(Object.hasOwn(boundary.intent, 'winnerPolicy')).toBe(false);
    const game = savedGame(before), value = projectSliceState(before), releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game);
    if (before.lastCombatRound?.princeOfAbolitionOutcome) await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '进入下一回合' }));
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
    const outcome = expected.lastCombatRound!.princeOfAbolitionOutcome!, actions = [...outcome.playerActions, ...outcome.enemyActions];
    expect(outcome.playerSpiritualityAfter).toBe(before.spirituality - outcome.playerActions.reduce((n, action) => n + action.paidCost, 0));
    const actualMentalConsequence = number === 2 ? 10 : 0;
    expect(outcome.playerMindAfter).toBe(before.mind - outcome.playerActions.reduce((n, action) => n + action.mindCost, 0) - actualMentalConsequence);
    expect(expected.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
    expect(outcome.enemySpirituality).toBe(before.princeOfAbolition.encounter.enemySpirituality - outcome.enemyActions.reduce((n, action) => n + action.paidCost, 0));
    expect(outcome.supportPieces.filter(piece => piece.status === 'SPENT').length).toBe(outcome.source.body.supportPieces.filter(piece => piece.status === 'SPENT').length + actions.reduce((n, action) => n + action.supportWearPaid, 0));
    expect(outcome.enemyCharges.filter(piece => piece.status === 'SPENT').length).toBe(outcome.source.body.enemyCharges.filter(piece => piece.status === 'SPENT').length + actions.filter(action => action.enemyChargeId !== null).length);
    const given = outcome.playerActions.filter(action => action.id === 'black-emperor.s7.bribery-weakening' && action.giftId !== null);
    expect(outcome.giftsAfter.filter(gift => gift.location === 'PLAYER').length).toBe(outcome.source.gifts.filter(gift => gift.location === 'PLAYER').length - given.length);
    for (const [id, mastery] of Object.entries(outcome.source.mastery)) {
      expect(outcome.masteryAfter[id]).toBe(Math.min(500, mastery + 8 * actions.filter(action => action.masteryApplied.includes(id)).length));
    }
    same(expected.random, { seed: before.random.seed, cursor: outcome.randomCursorAfter });
    expect(expected.combatHistory).toHaveLength(before.combatHistory.length + 1); same(expected.combatHistory.slice(0, -1), before.combatHistory);
    expect(rootsHash(game.state)).toBe(rootsHash(before)); const text = screen.getByRole('region', { name: RECORD }).textContent;
    await reopen(game); assertRound(expected); expect(screen.getByRole('region', { name: RECORD }).textContent).toBe(text);
    same(game.state, expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 180_000);

  it.each(distinctObserved(['directed-throw-leave']))('requires the actual cleanup command at %s rather than title navigation', async name => {
    const boundary = namedBoundary(name), before = boundary.before, expected = boundary.final, game = savedGame(before), loadRun = await mount(game);
    expect(boundary.intent).toEqual({ type: 'PRINCE_OF_ABOLITION', command: { type: 'LEAVE', caseId: 'directed-throw' } });
    expect(projectSliceState(before).princeOfAbolition.insideCase).toBe(true);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '返回主菜单' })); await chooseSavedRun(game);
    expect(loadRun).toHaveBeenCalledTimes(2); same(game.state, before); expect(game.submit).not.toHaveBeenCalled(); assertCurrentBody(before);
    const action = projectSliceState(before).princeOfAbolition.actions.find(row => row.enabled && row.command.type === 'LEAVE' && row.command.caseId === 'directed-throw');
    if (!action) throw new Error('The actual ordinary exit is not publicly offered.');
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '取消，返回查看' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull()); same(game.state, before);
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state.revision).toBe(expected.revision), { timeout: 30_000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(), { timeout: 30_000 });
    assertEnvelope(game, before, boundary.intent, 1); assertCapturedResources(before, boundary.intent, expected); same(game.state, expected);
    expect(getPrinceOfAbolitionCurrentSite(expected).playerLocation).toBe('OUTSIDE');
    expect(expected.princeOfAbolition.life.pieces.find(piece => piece.caseId === 'directed-throw')!.location).toBe('RETURNED');
    expect(projectSliceState(expected).princeOfAbolition.insideCase).toBe(false);
    await reopen(game); await openPanel(); assertCurrentBody(expected); expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    same(game.state, expected); expect(game.commits).toBe(1); expect(game.submit).toHaveBeenCalledTimes(1);
  }, 180_000);

  it.each((evidence.observed?.combatRounds ?? []).slice(0, 1))('preserves authored-token lookalikes in a custom display name at actual round %i', async number => {
    const source = namedBoundary(`combat-round-${number}`).final, game = savedGame(source), hash = captureValueHash(source);
    const displayName = '原创G · G候选映射 BODY MENTAL SUCCESS FAILURE';
    const presentationOnly = (value: SliceProjection) => {
      value.character = { ...value.character, name: displayName };
      value.princeOfAbolition = { ...value.princeOfAbolition, characterName: displayName,
        appearanceRecord: value.princeOfAbolition.appearanceRecord.replace(source.character.name, displayName) };
    };
    await mount(game, presentationOnly); assertRound(source);
    expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${PAGE}`);
    if (!source.ending) expect(screen.getByRole('region', { name: PANEL }).textContent).toContain(displayName);
    await reopen(game, presentationOnly); assertRound(source);
    expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${PAGE}`);
    expect(captureValueHash(game.state)).toBe(hash); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it('reopens the actual six-round surrender with the living injured body, spent supports and ordinary exit', async () => {
    const source = capturedState('final'), game = savedGame(source), terminal = source.princeOfAbolition.encounter.terminal;
    assertObservedFinal(source); same(captureBody(source), observedCapture().final); same(terminal, observedCapture().terminal);
    expect(terminal?.outcome).toBe('ENEMY_SURRENDERED'); await mount(game); assertRound(source);
    const outcome = source.lastCombatRound!.princeOfAbolitionOutcome!, site = getPrinceOfAbolitionCurrentSite(source);
    fireEvent.keyDown(screen.getByRole('dialog', { name: ROUND }), { key: 'Escape' }); expect(screen.getByRole('dialog', { name: ROUND })).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: '快速显示本回合结果' })); same(game.state, source);
    await reopen(game); assertRound(source); assertObservedFinal(game.state);
    expect(terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 }); expect(site.playerLocation).toBe('OUTSIDE');
    expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + 4); expect(site.clockSeconds).toBe(outcome.siteAfter.clockSeconds + 4);
    expect(site).toMatchObject({ playerTravelMetres: 236, clockSeconds: 983, volunteer: { mind: 97, location: 'OUTSIDE' }, guide: { location: 'OUTSIDE' } });
    same(source.princeOfAbolition.encounter.supportPieces, outcome.supportPieces); same(source.princeOfAbolition.encounter.enemyCharges, outcome.enemyCharges);
    same(source.princeOfAbolition.gifts, outcome.giftsAfter);
    await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '返回生活' }));
    if (screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(screen.queryByText('只读封存卷宗')).toBeNull(); expect(await screen.findByRole('group', { name: '四个主要行动' })).toBeTruthy();
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 180_000);
});
