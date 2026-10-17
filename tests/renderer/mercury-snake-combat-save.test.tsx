/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { playerText, projectPlayerText } from '../../src/shared/player-text.js';
import { MERCURY_SNAKE_SOURCE_KEYS, MERCURY_SNAKE_ABILITY_IDS, type MercurySnakeAction } from '../../src/domain/mercury-snake/types.js';
import { getMercurySnakeCurrentSite } from '../../src/domain/mercury-snake/life.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { MERCURY_SNAKE_CAPTURE_EVIDENCE as evidence } from '../domain/mercury-snake-capture-evidence.js';
import { capturedSnapshot, capturedState, namedBoundary, observedCapture, currentCapture,
  sourceEntry, sameCaptureValue as same } from '../domain/mercury-snake-capture-helper.js';

const PANEL = '水银之蛇成长', PAGE = '水银之蛇与原机械工坊', CONFIRM = '水银之蛇操作确认', ROUND = '战斗回合结果';
const RECORD = '水银之蛇本回合实际记录', RESOURCES = '水银之蛇本回合实际资源', CURRENT = '水银之蛇当前资源';
const BODY = '本回合根据实际身体攻击结算伤势', MENTAL = '本回合只结算实际精神压力，不生成身体伤口';
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const roots = (s: SliceState) => MERCURY_SNAKE_SOURCE_KEYS.map(key => s[key]);
const rootBytes = (s: SliceState) => JSON.stringify(roots(s));

// This adapter controls only renderer/IPC commit delivery. Every attempt uses
// the real reducer and validator on the full original saved history. Failed
// delivery discards the candidate; actual SQLite is tested in the save suite.
function savedGame(input: SliceState) {
  let state = structuredClone(input), commits = 0, failNext = false;
  let nextSaveBarrier: Promise<void> | null = null;
  const attemptedStates: SliceState[] = [], receipts = new Map<string, SliceReceipt>();
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    const prior = receipts.get(envelope.intentId);
    if (prior) return { ok: true, value: { ...structuredClone(prior), replayed: true } };
    if (envelope.payload.type === 'CREATE') throw new Error('The original natural campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    const next = applySliceIntent(state, envelope.payload); assertValidSliceState(next); attemptedStates.push(next);
    const barrier = nextSaveBarrier; nextSaveBarrier = null; if (barrier) await barrier;
    if (failNext) { failNext = false; return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } }; }
    state = next; commits++;
    const receipt: SliceReceipt = { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-16T00:00:00Z', replayed: false, state: projectSliceState(state) };
    receipts.set(envelope.intentId, receipt); return { ok: true, value: receipt };
  });
  return { get state() { return state; }, get commits() { return commits; }, attemptedStates, submit,
    failNextSave() { failNext = true; }, holdNextSave() {
      if (nextSaveBarrier) throw new Error('A save barrier is already pending.');
      let release = () => {}; nextSaveBarrier = new Promise<void>(resolve => { release = resolve; }); return release;
    } };
}
type SavedGame = ReturnType<typeof savedGame>;
async function chooseSavedRun(game: SavedGame, value = projectSliceState(game.state)) {
  expect(value.status).toBe('ACTIVE');
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }, { timeout: 30_000 }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  if (value.lastCombatRound?.mercurySnakeOutcome) await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
  else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! }, { timeout: 30_000 });
  else if (value.mercurySnake.insideCase) await screen.findByRole('region', { name: PANEL }, { timeout: 30_000 });
  else await screen.findByRole('button', { name: PAGE }, { timeout: 30_000 });
}
// The optional adapter changes a display-only custom name, never the original
// save, reducer input, command, receipt or immutable source bytes.
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
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: PAGE }));
  return screen.getByRole('region', { name: PANEL });
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count); expect(game.submit).toHaveBeenNthCalledWith(count, {
    intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
function assertCurrentBody(s: SliceState) {
  const site = getMercurySnakeCurrentSite(s), value = projectSliceState(s), bytes = JSON.stringify(site);
  const places = { START: '原门口', A: '四米处', B: '八米处', C: '另一原挡处', YARD: '独立小院', OUTSIDE: '室外' };
  same(value.mercurySnake.life.site, projectPlayerText(structuredClone(site), s.character.name));
  expect(JSON.stringify(getMercurySnakeCurrentSite(s))).toBe(bytes);
  const yard = screen.queryByRole('region', { name: '水银之蛇独立小院冲突' });
  if (yard) {
    expect(yard.textContent).toContain(`本人在${places[site.playerLocation]}，薇拉在${places[site.volunteer.location]}，原导师在${places[site.guide.location]}`);
    expect(yard.textContent).toContain(`累计普通步行${site.playerTravelMetres}米，原现场时钟${site.clockSeconds}秒`);
    expect(yard.textContent).toContain(`对手原刻片剩余${s.mercurySnake.encounter.plates.filter(plate => plate.status === 'HELD').length}/3枚`);
  } else {
    const body = screen.getByRole('region', { name: '原成年协作者的实际位置' });
    expect(body.textContent).toContain(`${site.volunteer.name} · ${site.volunteer.age}岁`);
    expect(body.textContent).toContain(`薇拉实际在${places[site.volunteer.location]}；原导师${site.guide.name}实际在${places[site.guide.location]}`);
    expect(body.textContent).toContain(`薇拉健康${site.volunteer.health} · 精神${site.volunteer.mind} · 灵性${site.volunteer.spirituality}`);
    expect(body.textContent).toContain(`本人实际在${places[site.playerLocation]}，累计普通步行${site.playerTravelMetres}米，原现场时钟${site.clockSeconds}秒`);
    const objects = screen.getByRole('region', { name: '同一原车与封包的实际位置和所有权' });
    expect(objects.textContent).toContain(`同一原车${site.cart.quantity}辆`);
    expect(objects.textContent).toContain(`同一原封包${site.parcel.quantity}件，${site.parcel.massGrams}克`);
    expect(objects.textContent).toContain(`原车累计实际释放${site.cart.releases}次、返回${site.cart.returns}次`);
  }
  const panel = screen.getByRole('region', { name: PANEL });
  expect(panel.textContent).not.toMatch(/本人精力|现场精力|playerEnergy|能量100/);
  const resources = within(panel).getByRole('region', { name: CURRENT });
  expect(resources.textContent).toContain(`健康${s.health}/100 · 精神${s.mind}/100 · 灵性${s.spirituality}/120`);
  expect(resources.textContent).toContain('当前唯一幸运储备0/3 · 累计储存14 · 已实际花费14');
  expect(s.fateProphet.encounter).toMatchObject({ targetId: 'FP2-ROWAN', enemyStatus: 'SURRENDERED', enemyHealth: 60, enemyMind: 100, enemySpirituality: 83 });
  for (const key of MERCURY_SNAKE_SOURCE_KEYS) expect(value[key].actions.every(action => !action.enabled)).toBe(true);
}
function assertRound(state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.mercurySnakeOutcome;
  if (!outcome) throw new Error('Expected an actual captured Mercury Snake round.');
  const reveal = screen.getByRole('dialog', { name: ROUND }), record = within(reveal).getByRole('region', { name: RECORD });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  expect(record.textContent).toContain(`回合结束：本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  expect(record.textContent).toContain(`原现场时钟${outcome.source.site.clockSeconds}秒→${outcome.siteAfter.clockSeconds}秒，本回合真实经过${outcome.elapsedSeconds}秒`);
  expect(record.textContent).toContain(`辅助片剩余${outcome.piece!.charges}/3，累计磨损${outcome.piece!.wear}`);
  expect(record.textContent).toContain(round.consequenceDomain === 'BODY' ? BODY : round.consequenceDomain === 'MENTAL' ? MENTAL : '本回合没有实际致伤来源，不掷身体伤势盘');
  if (round.consequenceDomain !== 'BODY') expect(record.textContent).not.toContain(BODY);
  if (round.consequenceDomain !== 'MENTAL') expect(record.textContent).not.toContain(MENTAL);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(within(record).getByRole('list', { name: '水银之蛇实际动作' })).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    const text = rows[index]!.textContent;
    expect(text).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：`);
    expect(text).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神、${action.luckCost}份幸运`);
    expect(text).toContain(`实际经过${action.elapsedSeconds}秒，普通移动${action.travelMetres}米`);
    expect(text).toContain(`本人局部位置${action.playerPositionBefore}米→${action.playerPositionAfter}米`);
    expect(text).toContain(`身体冲量实际移${action.impulseMetres}米，局部重启实际返回${action.returnedMetres}米`);
    expect(text).toContain(`辅助片实耗${action.pieceChargePaid}次、磨损${action.pieceWearPaid}`);
    expect(text).toContain(`本槽后本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}；对手灵性${action.enemySpiritualityAfter}`);
    if (action.check) expect(text).toContain(`本次检定骰${action.check.roll}，成功率${action.check.chance}%`);
    if (action.windowGranted) {
      expect(text).toContain(`记录于现场第${action.windowGranted.castAt}秒，原期限第${action.windowGranted.expiresAt}秒`);
      expect(action.masteryApplied).toEqual([]); expect(action.pieceChargePaid).toBe(0);
    }
    if (action.windowsApplied.length) {
      expect(action).toMatchObject({ actor: 'ENEMY', id: 'BODY_STRIKE', attackKind: 'BODY', paidCost: 0,
        pieceChargePaid: 1, pieceWearPaid: 1, impulseMetres: 1, returnedMetres: 1 });
      expect(action.receipt).toMatchObject({ kind: 'BODY', contribution: 25, paidCost: 0, unsettled: true });
      expect(action.windowsApplied).toEqual([{ kind: 'RESTART', round: 2, order: 3, amount: 25 }]);
      expect(text).toContain('另付费的局部重启实际减去25贡献，并仅返回本人被移动的1米');
    } else expect(text).not.toContain('另付费的局部重启实际减去');
    if (action.attackKind === 'MENTAL') { expect(action.windowsApplied).toEqual([]); expect(action.returnedMetres).toBe(0); }
  });
  expect(within(reveal).queryByRole('region', { name: '先知本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '先知成长' })).toBeNull();
  const next = state.combat ? '进入下一回合' : '返回生活';
  expect(within(reveal).getByRole('button', { name: next })).toBeTruthy();
  expect(within(reveal).queryByRole('button', { name: '查看收尾卷宗' })).toBeNull();
  assertCurrentBody(state);
}
function openAction(action: MercurySnakeAction) {
  const panel = screen.getByRole('region', { name: PANEL });
  const buttons = within(panel).getAllByRole('button', { hidden: true }).filter(button => button.textContent?.startsWith(playerText(action.label)));
  expect(buttons).toHaveLength(1); const button = buttons[0]!, fold = button.closest('details'); if (fold) fold.open = true;
  expect(disabled(button)).toBe(false); fireEvent.click(button); return screen.getByRole('dialog', { name: CONFIRM });
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'), close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  // vi.fn(initialImplementation) keeps its original large-state closure after
  // mockReset. Install all saved-state implementations separately instead.
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

it('requires the frozen 841-command stage204 natural capture before claiming renderer coverage', () => {
  expect(observedCapture()).toMatchObject({ files: 154, commands: 841, namedBoundaries: 182, uniqueTransitions: 139, aliases: 43,
    combatRounds: [1, 2], consequenceDomains: ['BODY'], promotionWeek: 196,
    final: { status: 'ACTIVE', week: 202, H: 90, M: 88, S: 86, cash: 20, AP: 3 },
    lifeAbilityUse: { 'wheel.s1.local-restart': { actualApplications: 1 }, 'wheel.s1.moment-anchor': { actualApplications: 0 } },
    combatAbilityUse: { 'wheel.s1.local-restart': { actualApplications: 1, contributionReduction: 25, masteryApplications: 1 },
      'wheel.s1.moment-anchor': { castingSuccesses: 1, actualApplications: 0, masteryApplications: 0 } },
    terminal: { outcome: 'ENEMY_SURRENDERED', round: 2, enemyHealth: 70, enemyMind: 100, enemySpirituality: 95 } });
}, 30_000);

describe.skipIf(evidence.observed === null)('Mercury Snake actual saved UI and identical-intent retry', () => {
  it('opens the actual live S1 fight ahead of inherited S2 promotion and the historical Rowan round', async () => {
    const source = capturedSnapshot('combatStart'), value = projectSliceState(source), game = savedGame(source);
    expect(source.fateProphet.promotionWeek).toBe(166); expect(value.fateProphet.promoted).toBe(true);
    expect(value.mercurySnake.promoted).toBe(true); same(source.lastCombatRound, capturedState('prefixFinal').lastCombatRound);
    expect(source.combat).toMatchObject({ encounterId: 'MERCURY_SNAKE_DISPUTE', round: 1, lastRound: null });
    expect(source.mercurySnake.encounter.startSource).toMatchObject({ actualBody: true, independentMind: true,
      thirdPartiesInArea: 0, pursuit: false, automaticAllyImmunity: false });
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES }), battle = value.combat!.mercurySnake!;
    expect(resources.textContent).toContain(`本人健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality}`);
    expect(resources.textContent).toContain(`${battle.enemyName}健康${battle.enemyHealth}/100 · 精神${battle.enemyMind}/100 · 独立灵性${battle.enemySpirituality}/120`);
    expect(resources.textContent).toContain('辅助片余3/3，实际磨损0');
    expect((within(stage).getByRole('radio', { name: '本回合保留幸运' }) as HTMLInputElement).checked).toBe(true);
    expect(within(stage).queryByRole('region', { name: '先知本回合实际资源' })).toBeNull(); assertCurrentBody(source);
    const text = resources.textContent; await reopen(game); expect(screen.getByRole('region', { name: RESOURCES }).textContent).toBe(text);
    assertCurrentBody(source); same(game.state, source); same(projectSliceState(game.state), value); expect(game.submit).not.toHaveBeenCalled();
  }, 120_000);

  it.each([1, 2])('keeps failed real round %i uncommitted, then immediately shows one identical retry result', async number => {
    const boundary = namedBoundary(`combat-round-${number}`), before = boundary.before, expected = boundary.final;
    const intent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL', winnerPolicy: 'HOLD' };
    expect(boundary.intent).toEqual(intent);
    const game = savedGame(before), value = projectSliceState(before), releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game);
    if (number === 2) await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '进入下一回合' }));
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES }).textContent;
    const stance = value.combat!.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, intent, 1);
    expect(disabled(submit)).toBe(true); same(game.attemptedStates[0], expected); same(game.state, before); expect(game.commits).toBe(0);
    expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); expect(within(stage).getByRole('region', { name: RESOURCES }).textContent).toBe(resources);
    await act(async () => { releaseFailure(); }); const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(disabled(submit)).toBe(true); same(game.state.random, before.random); assertCurrentBody(before);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); assertEnvelope(game, before, intent, 2);
    expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); same(game.state, before);
    await act(async () => { releaseSuccess(); }); await screen.findByRole('dialog', { name: ROUND }, { timeout: 30_000 });
    // This assertion occurs before reopening: inherited S2 promotion must not
    // suppress the newly committed S1 outcome or reveal the old Rowan record.
    assertRound(expected); same(game.state, expected); same(game.attemptedStates[1], expected);
    expect(game.attemptedStates).toHaveLength(2); expect(game.commits).toBe(1);
    const outcome = expected.lastCombatRound!.mercurySnakeOutcome!;
    expect(outcome.playerSpiritualityAfter).toBe(before.spirituality - outcome.playerActions.reduce((n, a) => n + a.paidCost, 0));
    expect(expected.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
    expect(outcome.enemySpirituality).toBe(before.mercurySnake.encounter.enemySpirituality - outcome.enemyActions.reduce((n, a) => n + a.paidCost, 0));
    expect(expected.combatHistory).toHaveLength(before.combatHistory.length + 1); same(expected.combatHistory.slice(0, -1), before.combatHistory);
    expect(expected.cash).toBe(number === 1 ? before.cash : 20); expect(expected.actionsRemaining).toBe(number === 1 ? before.actionsRemaining : 3);
    const actions = [...outcome.playerActions, ...outcome.enemyActions];
    expect(expected.mercurySnake.encounter.piece!.charges).toBe(before.mercurySnake.encounter.piece!.charges - actions.reduce((n, a) => n + a.pieceChargePaid, 0));
    expect(expected.mercurySnake.encounter.piece!.wear).toBe(before.mercurySnake.encounter.piece!.wear + actions.reduce((n, a) => n + a.pieceWearPaid, 0));
    expect(expected.progression.mastery['wheel.s1.local-restart']).toBe(number === 1 ? 8 : 16);
    expect(expected.progression.mastery['wheel.s1.moment-anchor']).toBe(0);
    same(expected.random, { seed: before.random.seed, cursor: outcome.randomCursorAfter }); same(expected.mercurySnake.luck, before.mercurySnake.luck);
    expect(rootBytes(game.state)).toBe(rootBytes(before)); const text = screen.getByRole('region', { name: RECORD }).textContent;
    await reopen(game); assertRound(expected); expect(screen.getByRole('region', { name: RECORD }).textContent).toBe(text);
    same(game.state, expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 120_000);

  it.each([1, 2])('reopens actual saved round %i with exact BODY facts, movement, costs and applications', async number => {
    const source = namedBoundary(`combat-round-${number}`).final, game = savedGame(source), round = source.lastCombatRound!, outcome = round.mercurySnakeOutcome!;
    expect(round.consequenceDomain).toBe('BODY'); expect(round.consequenceRoll).toBeGreaterThanOrEqual(1); expect(round.consequenceWeights).not.toBeNull();
    expect(outcome.winnerPolicy).toBe('HOLD'); expect(outcome.elapsedSeconds).toBe(60);
    const actions = [...outcome.playerActions, ...outcome.enemyActions];
    for (const id of MERCURY_SNAKE_ABILITY_IDS) {
      const applications = actions.filter(action => action.masteryApplied.includes(id)).length;
      expect(outcome.masteryAfter[id]).toBe(outcome.source.mastery[id]! + 8 * applications);
    }
    expect(outcome.anchorApplications).toBe(0);
    expect(outcome.piece!.charges).toBe(outcome.source.body.piece!.charges - actions.reduce((n, a) => n + a.pieceChargePaid, 0));
    expect(outcome.piece!.wear).toBe(outcome.source.body.piece!.wear + actions.reduce((n, a) => n + a.pieceWearPaid, 0));
    const applied = actions.flatMap(action => action.windowsApplied);
    expect(applied).toEqual(number === 1 ? [] : [{ kind: 'RESTART', round: 2, order: 3, amount: 25 }]);
    expect(outcome.masteryAfter['wheel.s1.local-restart']).toBe(number === 1 ? 8 : 16);
    expect(outcome.masteryAfter['wheel.s1.moment-anchor']).toBe(0);
    await mount(game); assertRound(source); const text = screen.getByRole('region', { name: RECORD }).textContent;
    await reopen(game); assertRound(source); expect(screen.getByRole('region', { name: RECORD }).textContent).toBe(text);
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 120_000);

  it('preserves a custom display name containing authored-token lookalikes without changing the saved identity', async () => {
    const source = namedBoundary('combat-round-2').final, game = savedGame(source), value = projectSliceState(source), bytes = rootBytes(source);
    const displayName = '原创G · G候选映射 BODY MENTAL SUCCESS FAILURE';
    const customNameOnly = (projection: SliceProjection) => {
      projection.character = { ...projection.character, name: displayName };
      projection.mercurySnake = { ...projection.mercurySnake, characterName: displayName,
        appearanceRecord: projection.mercurySnake.appearanceRecord.replace(source.character.name, displayName) };
    };
    await mount(game, customNameOnly); assertRound(source);
    expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${PAGE}`);
    expect(screen.getByRole('region', { name: PANEL }).textContent).toContain(displayName);
    await reopen(game, customNameOnly); assertRound(source);
    expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${PAGE}`);
    same(projectSliceState(game.state), value); expect(rootBytes(game.state)).toBe(bytes); same(game.state, source);
    expect(game.state.character.name).toBe('艾洛'); expect(game.submit).not.toHaveBeenCalled();
  }, 120_000);

  it.each(['cart-return-local_restart', 'maintained-contact-moment_anchor', 'maintained-contact-local_restart',
    'withdrawn-contact-moment_anchor', 'withdrawn-contact-withdraw_consent-ability'])('reopens the real finite life attempt at %s', async name => {
    const source = namedBoundary(name).final, game = savedGame(source), value = projectSliceState(source).mercurySnake;
    const attempt = value.life.currentAttempt, piece = value.life.pieces.find(entry => entry.caseId === value.life.activeCase)!;
    if (!attempt) throw new Error('The captured original-room action has no actual current attempt.');
    function assertLife() {
      assertCurrentBody(source);
      const room = screen.getByRole('region', { name: '水银之蛇原场事务' });
      expect(room.textContent).toContain(`本次实耗${attempt!.spiritualitySpent}灵性、${attempt!.mindSpent}精神、${attempt!.penniesSpent}便士`);
      expect(room.textContent).toContain(`实际用量剩余${piece.charges}/${piece.initialCharges} · 实际磨损${piece.wear}`);
      if (name === 'cart-return-local_restart') {
        expect(attempt).toMatchObject({ restartTier: 'SUCCESS', restartApplied: true, anchorApplied: false, returnKind: 'RESTART', appliedAbilityIds: ['wheel.s1.local-restart'] });
        expect(piece).toMatchObject({ charges: 0, wear: 1, returnUses: 1, anchorUses: 0 });
        expect(room.textContent).toContain('同一车与原包已通过局部重启返回');
      } else if (name.startsWith('maintained-contact')) {
        expect(attempt!.anchorTier).toBe('GREAT_FAILURE'); expect(attempt!.appliedAbilityIds).toEqual([]);
        expect(attempt!.spiritualitySpent).toBe(name.endsWith('local_restart') ? 16 : 8);
        expect(attempt!.mindSpent).toBe(name.endsWith('local_restart') ? 8 : 4);
        expect(piece).toMatchObject({ initialCharges: 2, charges: 2, wear: 0 }); expect(value.life.pending).toBeNull();
      } else if (name.endsWith('moment_anchor')) {
        expect(attempt).toMatchObject({ anchorTier: 'SUCCESS', anchorApplied: false, appliedAbilityIds: [] });
        expect(value.life.pending).not.toBeNull(); expect(value.life.pendingRemainingSeconds).toBeGreaterThan(0);
        expect(screen.getByRole('region', { name: '片刻维系的实际二十秒窗口' }).textContent).toContain(`片刻维系还剩${value.life.pendingRemainingSeconds}秒`);
        expect(piece).toMatchObject({ initialCharges: 1, charges: 1, wear: 0 });
      } else {
        expect(attempt).toMatchObject({ withdrawn: true, anchorApplied: false, appliedAbilityIds: [], windowEnd: 'WITHDRAWN' });
        expect(value.life.pending).toBeNull(); expect(room.textContent).toContain('本案许可已真实撤回');
        expect(screen.queryByRole('region', { name: '片刻维系的实际二十秒窗口' })).toBeNull(); expect(piece).toMatchObject({ charges: 1, wear: 0 });
      }
      return room.textContent;
    }
    await mount(game); const text = assertLife(); await reopen(game); expect(assertLife()).toBe(text);
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 120_000);

  it('closes the real confirmation before checking unique saved resources after a paid preparation fails and retries', async () => {
    const boundary = namedBoundary('cart-return-prepare'), before = boundary.before, expected = boundary.final;
    expect(boundary.intent).toEqual({ type: 'MERCURY_SNAKE', command: { type: 'PREPARE', caseId: 'cart-return', method: 'ABILITY' } });
    const game = savedGame(before), value = projectSliceState(before), releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game); await openPanel();
    const action = value.mercurySnake.actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(boundary.intent.type === 'MERCURY_SNAKE' ? boundary.intent.command : null));
    if (!action) throw new Error('The actual paid preparation is not publicly offered.');
    const resources = screen.getByRole('region', { name: CURRENT }).textContent;
    const submit = within(openAction(action)).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, boundary.intent, 1);
    expect(disabled(submit)).toBe(true); same(game.state, before); same(game.attemptedStates[0], expected); expect(game.commits).toBe(0);
    await act(async () => { releaseFailure(); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(), { timeout: 30_000 });
    // Both panel and confirmation deliberately contain resource regions while
    // open. Wait for the real effect closure, then require exactly one region.
    expect(screen.getByRole('region', { name: CURRENT }).textContent).toBe(resources);
    for (const button of within(screen.getByRole('region', { name: PANEL })).getAllByRole('button', { hidden: true })) expect(disabled(button)).toBe(true);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    const retry = screen.getByRole('button', { name: '重试这次操作' }); fireEvent.click(retry); fireEvent.click(retry);
    assertEnvelope(game, before, boundary.intent, 2); expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); same(game.state, before);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(expected.revision), { timeout: 30_000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(), { timeout: 30_000 });
    same(game.state, expected); expect(game.commits).toBe(1); expect(game.attemptedStates).toHaveLength(2);
    expect(game.state.cash).toBe(before.cash - 20); expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1); same(game.state.random, before.random);
    expect(game.state.mercurySnake.life.pieces).toHaveLength(before.mercurySnake.life.pieces.length + 1);
    expect(game.state.mercurySnake.life.pieces.at(-1)).toMatchObject({ caseId: 'cart-return', paidPennies: 20, quantity: 1, charges: 1, initialCharges: 1, wear: 0 });
    assertCurrentBody(expected); expect(rootBytes(game.state)).toBe(rootBytes(before));
    await reopen(game); assertCurrentBody(expected); same(game.state, expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 120_000);

  it('keeps the real two-bottle promotion, unused third bottle and surrendered Rowan closed on reopen', async () => {
    const raw = sourceEntry<SliceState>('final'); expect([raw.schemaVersion, raw.contentVersion]).toEqual([179, 'fate-prophet-v179']);
    const original = currentCapture(raw), source = capturedSnapshot('promoted'), game = savedGame(source), bytes = rootBytes(source);
    expect(rootBytes(original)).toBe(JSON.stringify(MERCURY_SNAKE_SOURCE_KEYS.map(key => raw[key]))); expect(bytes).toBe(rootBytes(original));
    expect(source.mercurySnake.promotionWeek).toBe(196);
    expect(source.mercurySnake.bottles.map(bottle => [bottle.status, bottle.outcome])).toEqual([['CONSUMED', 'FAILURE'], ['CONSUMED', 'SUCCESS'], ['SUPPLIER', null]]);
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openPanel(); assertCurrentBody(source);
    expect(screen.queryByRole('region', { name: '先知成长' })).toBeNull();
    const projection = projectSliceState(source); expect(projection.fateProphet.actions.every(action => !action.enabled)).toBe(true);
    expect(projection.fateProphet.encounter.actions.every(action => !action.enabled)).toBe(true);
    await reopen(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); await openPanel(); assertCurrentBody(source);
    same(game.state, source); expect(rootBytes(game.state)).toBe(bytes); expect(game.submit).not.toHaveBeenCalled();
  }, 120_000);

  it('requires the captured ordinary cleanup command instead of treating title navigation as returning the original piece', async () => {
    const boundary = namedBoundary('cart-return-leave'), before = boundary.before, expected = boundary.final, game = savedGame(before), loadRun = await mount(game);
    expect(boundary.intent).toEqual({ type: 'MERCURY_SNAKE', command: { type: 'LEAVE', caseId: 'cart-return' } });
    expect(projectSliceState(before).mercurySnake.insideCase).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '返回主菜单' })); await chooseSavedRun(game);
    expect(loadRun).toHaveBeenCalledTimes(2); same(game.state, before); expect(game.submit).not.toHaveBeenCalled(); assertCurrentBody(before);
    const action = projectSliceState(before).mercurySnake.actions.find(entry => entry.enabled && entry.command.type === 'LEAVE' && entry.command.caseId === 'cart-return');
    if (!action) throw new Error('The captured ordinary exit is not publicly offered.');
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '取消，返回查看' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull()); same(game.state, before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state.revision).toBe(expected.revision), { timeout: 30_000 });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(), { timeout: 30_000 });
    assertEnvelope(game, before, boundary.intent, 1); same(game.state, expected); expect(game.commits).toBe(1);
    expect(expected.mercurySnake.life.site).toMatchObject({ playerLocation: 'START', cart: { location: 'A', control: 'GUIDE' }, parcel: { location: 'CW3-CART' } });
    expect(expected.mercurySnake.life.pieces[0]).toMatchObject({ status: 'RETURNED', location: 'RETURNED', charges: 0, wear: 1 });
    expect(projectSliceState(expected).mercurySnake.insideCase).toBe(false); same(roots(expected), roots(before));
    same(expected.mercurySnake.life.site, before.mercurySnake.life.site); same(expected.mercurySnake.life.pieces, before.mercurySnake.life.pieces);
    await reopen(game); await openPanel(); assertCurrentBody(expected); expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    same(game.state, expected); expect(game.submit).toHaveBeenCalledTimes(1);
  }, 120_000);

  it('reopens the actual two-round surrender and final living exit with its one light injury and due weekly settlement intact', async () => {
    const source = capturedState('final'), game = savedGame(source), terminal = source.mercurySnake.encounter.terminal!, outcome = source.lastCombatRound!.mercurySnakeOutcome!, site = getMercurySnakeCurrentSite(source);
    expect(source).toMatchObject({ status: 'ACTIVE', week: 202, health: 90, mind: 88, spirituality: 86, cash: 20, actionsRemaining: 3, combat: null, ending: null });
    expect(source.injuries).toHaveLength(1); expect(source.injuries[0]).toMatchObject({ severity: 'LIGHT', treatedRevision: null });
    expect(terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 2, exitMetres: 4, exitSeconds: 4, enemyHealth: 70, enemyMind: 100, enemySpirituality: 95 });
    expect(site.playerLocation).toBe('START'); expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + terminal.exitMetres);
    expect(site.clockSeconds).toBe(outcome.siteAfter.clockSeconds + terminal.windowWaitSeconds + terminal.exitSeconds);
    expect(site.guide.location).toBe('OUTSIDE'); expect(site.volunteer.location).toBe('OUTSIDE');
    same(source.mercurySnake.encounter.piece, outcome.piece); same(source.mercurySnake.encounter.plates, outcome.plates);
    await mount(game); assertRound(source);
    fireEvent.keyDown(screen.getByRole('dialog', { name: ROUND }), { key: 'Escape' }); expect(screen.getByRole('dialog', { name: ROUND })).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: '快速显示本回合结果' })); same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
    await reopen(game); assertRound(source);
    await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '返回生活' }));
    expect(screen.queryByText('只读封存卷宗')).toBeNull();
    // The completed workshop may remain open after acknowledging the result;
    // its explicit ordinary-life navigation does not commit another command.
    if (screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('group', { name: '四个主要行动' })).toBeTruthy();
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 120_000);
});
