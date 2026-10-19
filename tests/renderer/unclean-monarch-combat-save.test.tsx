/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { projectPlayerText } from '../../src/shared/player-text.js';
import { UNCLEAN_MONARCH_SOURCE_KEYS, UNCLEAN_MONARCH_ABILITY_IDS, type UncleanMonarchAction } from '../../src/domain/unclean-monarch/types.js';
import { getUncleanMonarchCurrentSite } from '../../src/domain/unclean-monarch/life.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { UNCLEAN_MONARCH_CAPTURE_EVIDENCE as evidence } from '../domain/unclean-monarch-capture-evidence.js';
import { captureMetadata, capturedSnapshot, capturedState, namedBoundary, observedCapture, currentCapture,
  sourceEntry, sameCaptureValue as same } from '../domain/unclean-monarch-capture-helper.js';

const PANEL = '污秽君王成长', CONFIRM = '污秽君王操作确认', ROUND = '战斗回合结果';
const RECORD = '污秽君王本回合实际记录', RESOURCES = '污秽君王本回合实际资源', ORIGINALS = '污秽君王原人原物当前状态';
const BODY = '本回合按实际身体冲击结算伤势', MENTAL = '本回合按实际精神压力结算后果';
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const roots = (s: SliceState) => UNCLEAN_MONARCH_SOURCE_KEYS.map(key => s[key]);

// Only renderer/IPC commit delivery is controlled. Every submission uses the
// real reducer and validator against the unchanged original capture. Failed
// writes discard the uncommitted result. SQLite rollback belongs to its separate
// full verifier; this test does not claim to exercise a SQLite implementation.
function savedGame(input: SliceState) {
  let state = structuredClone(input), commits = 0, failNext = false;
  let nextSaveBarrier: Promise<void> | null = null;
  const attemptedStates: SliceState[] = [], receipts = new Map<string, SliceReceipt>();
  assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    const prior = receipts.get(envelope.intentId);
    if (prior) return { ok: true, value: { ...structuredClone(prior), replayed: true } };
    if (envelope.payload.type === 'CREATE') throw new Error('The actual natural campaign already exists.');
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
  if (value.status === 'DEAD') {
    expect(disabled(await screen.findByRole('button', { name: /继续游戏/ }))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /查看封存/ }));
  } else await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  if (value.lastCombatRound?.uncleanMonarchOutcome || value.status === 'DEAD' && value.lastCombatRound) await screen.findByRole('dialog', { name: ROUND });
  else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! });
  else if (value.uncleanMonarch.insideCase) await screen.findByRole('region', { name: PANEL });
  else await screen.findByRole('button', { name: '污秽君王与原安静室' });
}
// Presentation-only custom-name regression: never edits source bytes, reducer
// inputs, receipts or the original saved character. Normal tests use no override.
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
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count); expect(game.submit).toHaveBeenNthCalledWith(count, {
    intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
function assertCurrentBody(s: SliceState) {
  const site = getUncleanMonarchCurrentSite(s), value = projectSliceState(s), body = screen.getByRole('region', { name: ORIGINALS });
  const places = { START: '原安静室门口', A: '四米处原桌', B: '八米处原铃', YARD: '相邻院落', OUTSIDE: '室外', NORA: '诺拉本人处', PLAYER: '本人处' };
  const originalSite = structuredClone(site);
  same(value.uncleanMonarch.life.site, projectPlayerText(structuredClone(site), s.character.name));
  same(getUncleanMonarchCurrentSite(s), originalSite);
  expect(body.textContent).toContain(`本人当前在${places[site.playerLocation]}，累计普通步行${site.playerTravelMetres}米，现场时钟${site.clockSeconds}秒`);
  expect(body.textContent).toContain(`${site.volunteer.name} · ${site.volunteer.age}岁，当前在${places[site.volunteer.location]}`);
  expect(body.textContent).toContain(`累计本阶段协作耗力${s.uncleanMonarch.life.volunteerEffortSpent}/12`);
  expect(body.textContent).toContain(`${site.guide.name}当前在${places[site.guide.location]}，累计实际步行${site.guide.travelMetres}米`);
  expect(body.textContent).toContain(`原卡${site.card.id}在${places[site.card.location]}，数量${site.card.quantity}，累计实际行程${site.card.travelMetres}米`);
  expect(body.textContent).toContain(`旧恶魔负荷当前为${value.uncleanMonarch.encounter.strain}`);
  expect(body.textContent).not.toMatch(/本人精力|现场精力|playerEnergy|原灵灵性|完整度|energy100/);
  if (site.clockSeconds !== s.blatherer.life.clockSeconds) expect(body.textContent).not.toContain(`现场时钟${s.blatherer.life.clockSeconds}秒`);
  if (s.uncleanMonarch.encounter.currentSite && site.clockSeconds !== s.uncleanMonarch.life.site.clockSeconds) expect(body.textContent).not.toContain(`现场时钟${s.uncleanMonarch.life.site.clockSeconds}秒`);
}
function assertRound(state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.uncleanMonarchOutcome;
  if (!outcome) throw new Error('Expected an actual captured Unclean Monarch round.');
  const reveal = screen.getByRole('dialog', { name: ROUND }), record = within(reveal).getByRole('region', { name: RECORD });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`); expect(reveal.textContent).toContain(round.consequence);
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  expect(record.textContent).toContain(round.consequenceDomain === 'BODY' ? BODY : round.consequenceDomain === 'MENTAL' ? MENTAL : '本回合没有身体或精神后果盘');
  if (round.consequenceDomain !== 'BODY') expect(record.textContent).not.toContain(BODY);
  if (round.consequenceDomain !== 'MENTAL') expect(record.textContent).not.toContain(MENTAL);
  const actions = [...outcome.playerActions.map(action => ({ ...action, actor: 'PLAYER' as const })),
    ...outcome.enemyActions.map(action => ({ ...action, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order);
  const rows = within(within(record).getByRole('list')).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：${action.label}`);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[index]!.textContent).toContain(`本槽实际经过${action.elapsedSeconds}秒`);
    expect(rows[index]!.textContent).toContain(`本槽辅助片实耗${action.pieceChargePaid}次、磨损${action.pieceWearPaid}`);
    expect(rows[index]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}`);
    expect(rows[index]!.textContent).toContain(`对手灵性${action.enemySpiritualityAfter}`);
    if (action.rolls.length) expect(rows[index]!.textContent).toContain(`本槽实际检定骰：${action.rolls.join('、')}`);
    if (action.chargeGranted && action.chargeConsumedByOrder === null) expect(rows[index]!.textContent).toContain('仅建立有限窗口；尚未应用的窗口不计实际效果');
  });
  expect(within(reveal).queryByRole('region', { name: '鲜血大公本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '鲜血大公成长' })).toBeNull();
  const next = state.ending ? '查看收尾卷宗' : state.combat ? '进入下一回合' : '返回生活';
  for (const label of ['查看收尾卷宗', '进入下一回合', '返回生活']) {
    if (label === next) expect(within(reveal).getByRole('button', { name: label })).toBeTruthy();
    else expect(within(reveal).queryByRole('button', { name: label })).toBeNull();
  }
  assertCurrentBody(state);
}
function openAction(action: UncleanMonarchAction) {
  const panel = screen.getByRole('region', { name: PANEL });
  const buttons = () => within(panel).queryAllByRole('button', { hidden: true }).filter(button => button.getAttribute('data-action-id') === action.id);
  if (!buttons().length) {
    const picker = within(panel).getByRole('combobox', { name: '污秽君王其他操作', hidden: true });
    (picker.closest('details') as HTMLDetailsElement).open = true; fireEvent.change(picker, { target: { value: action.id } });
  }
  expect(buttons()).toHaveLength(1); const button = buttons()[0]!, fold = button.closest('details'); if (fold) fold.open = true;
  fireEvent.click(button); return screen.getByRole('dialog', { name: CONFIRM });
}
const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'), close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  // Install implementations separately so reset releases completed saved campaigns.
  // vi.fn(initialImplementation) would retain the original saved-state closure.
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

// Fail closed: a private scaffold must never be reported as a passing capture suite.
it('requires coordinator-frozen stage202 observations before claiming renderer capture coverage', () => { observedCapture(); });

describe.skipIf(evidence.observed === null)('Unclean Monarch actual saved UI and identical-intent retry', () => {
  it('opens any actual new live fight ahead of the inherited S2 promotion and historical last round', async () => {
    const observations = observedCapture();
    if (!observations.snapshots.includes('combatStart')) { expect(observations.combatRounds).toEqual([]); return; }
    const source = capturedSnapshot('combatStart'), value = projectSliceState(source), game = savedGame(source);
    expect(source.bloodDuke.promotionWeek).toBe(172); expect(value.bloodDuke.promoted).toBe(false); expect(value.bloodDuke.actions).toEqual([]);
    expect(value.uncleanMonarch.promoted).toBe(true); same(source.lastCombatRound, capturedState('prefixFinal').lastCombatRound);
    expect(source.combat).toMatchObject({ encounterId: 'UNCLEAN_MONARCH_DISPUTE', round: 1, lastRound: null });
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES }), battle = value.combat!.uncleanMonarch!;
    expect(resources.textContent).toContain(`本人健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality}`);
    expect(resources.textContent).toContain(`${battle.enemyName}：健康${battle.enemyHealth}、精神${battle.enemyMind}、灵性${battle.enemySpirituality}`);
    expect(resources.textContent).toContain(`辅助片剩余${battle.piece!.charges}次，磨损${battle.piece!.wear}`);
    expect(within(stage).queryByRole('region', { name: '鲜血大公本回合实际资源' })).toBeNull(); assertCurrentBody(source);
    const text = resources.textContent; await reopen(game); expect(screen.getByRole('region', { name: RESOURCES }).textContent).toBe(text);
    assertCurrentBody(source); same(projectSliceState(game.state), value); same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
  }, 60_000);

  it('retains committed resources on a failed actual round and retries exactly one identical envelope without double fees', async () => {
    const observations = observedCapture(); if (!observations.combatRounds.length) { expect(capturedState('final').uncleanMonarch.encounter.startSource).toBeNull(); return; }
    const boundary = namedBoundary(`combat-round-${observations.combatRounds[0]}`), before = boundary.before, expected = boundary.final;
    expect(boundary.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    const game = savedGame(before), value = projectSliceState(before), releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game);
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES }).textContent;
    const body = screen.getByRole('region', { name: ORIGINALS }).textContent, stance = value.combat!.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, boundary.intent, 1);
    expect(disabled(submit)).toBe(true); expect(game.attemptedStates).toHaveLength(1); same(game.attemptedStates[0], expected);
    same(game.state, before); expect(game.commits).toBe(0); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    expect(within(stage).getByRole('region', { name: RESOURCES }).textContent).toBe(resources); expect(screen.getByRole('region', { name: ORIGINALS }).textContent).toBe(body);
    await act(async () => { releaseFailure(); }); const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(disabled(submit)).toBe(true); same(game.state, before); expect(game.commits).toBe(0); assertCurrentBody(before);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); assertEnvelope(game, before, boundary.intent, 2);
    expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); same(game.state, before);
    await act(async () => { releaseSuccess(); }); await waitFor(() => expect(game.state.revision).toBe(expected.revision)); await screen.findByRole('dialog', { name: ROUND });
    expect(game.attemptedStates).toHaveLength(2); same(game.attemptedStates[1], expected); same(game.state, expected); expect(game.commits).toBe(1);
    const outcome = game.state.lastCombatRound!.uncleanMonarchOutcome!, actions = [...outcome.playerActions, ...outcome.enemyActions];
    expect(outcome.playerSpiritualityAfter).toBe(before.spirituality - outcome.playerActions.reduce((n, a) => n + a.paidCost, 0));
    expect(game.state.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
    expect(game.state.uncleanMonarch.encounter.enemySpirituality).toBe(before.uncleanMonarch.encounter.enemySpirituality - outcome.enemyActions.reduce((n, a) => n + a.paidCost, 0));
    expect(outcome.pieceAfter.charges).toBe(before.uncleanMonarch.encounter.piece!.charges - actions.reduce((n, a) => n + a.pieceChargePaid, 0));
    expect(outcome.pieceAfter.wear).toBe(before.uncleanMonarch.encounter.piece!.wear + actions.reduce((n, a) => n + a.pieceWearPaid, 0));
    expect(outcome.strainAfter).toBe(before.uncleanMonarch.encounter.strain! + outcome.playerActions.reduce((n, a) => n + a.strainCost, 0));
    same(game.state.uncleanMonarch.encounter.plates, outcome.platesAfter); same(game.state.uncleanMonarch.encounter.piece, outcome.pieceAfter);
    expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1); same(game.state.combatHistory.slice(0, -1), before.combatHistory); same(roots(game.state), roots(before));
    assertRound(expected); const record = screen.getByRole('dialog', { name: ROUND }).textContent, projection = projectSliceState(game.state);
    await reopen(game); assertRound(expected); expect(screen.getByRole('dialog', { name: ROUND }).textContent).toBe(record);
    same(projectSliceState(game.state), projection); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1); same(game.state, expected);
  }, 120_000);

  it('renders every observed BODY or MENTAL domain and selected versus actually consumed finite windows faithfully on reopen', async () => {
    const observations = observedCapture(), domains = new Set<string>();
    for (const number of observations.combatRounds) {
      const source = namedBoundary(`combat-round-${number}`).final, game = savedGame(source), round = source.lastCombatRound!, outcome = round.uncleanMonarchOutcome!;
      if (round.consequenceDomain) domains.add(round.consequenceDomain);
      if (round.consequenceDomain === 'MENTAL') { expect(round.consequenceRoll).toBeUndefined(); expect(round.consequenceWeights).toBeNull(); }
      if (round.consequenceDomain === 'BODY') { expect(round.consequenceRoll).toBeGreaterThanOrEqual(1); expect(round.consequenceWeights).not.toBeNull(); }
      cleanup(); await mount(game); assertRound(source); const record = screen.getByRole('region', { name: RECORD });
      const rows = within(record).getAllByRole('listitem');
      for (const action of outcome.playerActions.filter(a => UNCLEAN_MONARCH_ABILITY_IDS.some(id => id === a.id))) {
        const row = rows.find(item => item.textContent?.includes(`本人第${action.order + 1}槽：`))!;
        expect(row.textContent).toContain(`本槽辅助片实耗${action.pieceChargePaid}次、磨损${action.pieceWearPaid}`);
        if (action.chargeGranted && !action.applied) { expect(row.textContent).toContain('有限效果实际应用0'); expect(action.masteryApplied).toEqual([]); }
        if (action.applied) { expect(action.chargeConsumedByOrder).not.toBeNull(); expect(action.masteryApplied).toContain(action.id); }
      }
      const text = record.textContent; await reopen(game); assertRound(source); expect(screen.getByRole('region', { name: RECORD }).textContent).toBe(text);
      same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    }
    same([...domains], observations.consequenceDomains); // Empty/missing domains are explicitly unobserved, never fabricated.
  }, 120_000);

  it('protects the natural saved name and an adversarial display-only name without rewriting the capture or action receipts', async () => {
    const observations = observedCapture(); if (!observations.combatRounds.length) { expect(observations.consequenceDomains).toEqual([]); return; }
    const source = namedBoundary(`combat-round-${observations.combatRounds[0]}`).final, value = projectSliceState(source), game = savedGame(source);
    await mount(game); assertRound(source); expect(screen.getByRole('banner').textContent).toContain(`${source.character.name} · ${value.uncleanMonarch.title}`);
    const displayName = '原创G · G候选映射 BODY MENTAL 冲动收束';
    const customNameOnly = (projection: SliceProjection) => { projection.character = { ...projection.character, name: displayName }; projection.uncleanMonarch = { ...projection.uncleanMonarch, characterName: displayName }; };
    await reopen(game, customNameOnly); assertRound(source);
    function assertName() {
      expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${value.uncleanMonarch.title}`);
      const current = within(screen.getByRole('region', { name: PANEL })).getByRole('region', { name: '污秽君王当前资源' });
      expect(within(current).getByText(displayName, { exact: true })).toBeTruthy();
    }
    assertName(); await reopen(game, customNameOnly); assertName(); assertRound(source);
    same(projectSliceState(game.state), value); same(game.state, source); expect(game.state.character.name).toBe('艾洛'); expect(game.submit).not.toHaveBeenCalled();
  }, 60_000);

  it('requires the captured ordinary cleanup command rather than replacing original-card return with navigation', async () => {
    const observations = observedCapture(), caseId = observations.completedCases[0];
    if (!caseId) { expect(observations.completedCases).toEqual([]); return; }
    const boundary = namedBoundary(`${caseId}-leave`), before = boundary.before, expected = boundary.final, game = savedGame(before), loadRun = await mount(game);
    expect(boundary.intent).toEqual({ type: 'UNCLEAN_MONARCH', command: { type: 'LEAVE', caseId } });
    expect(projectSliceState(before).uncleanMonarch.insideCase).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); assertCurrentBody(before);
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '返回主菜单' })); await chooseSavedRun(game);
    expect(loadRun).toHaveBeenCalledTimes(2); same(game.state, before); expect(game.submit).not.toHaveBeenCalled(); assertCurrentBody(before);
    const action = projectSliceState(before).uncleanMonarch.actions.find(entry => entry.enabled && entry.command.type === 'LEAVE' && entry.command.caseId === caseId);
    if (!action) throw new Error('The captured ordinary exit is not publicly offered.');
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '取消，返回查看' })); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    same(game.state, before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '确认执行这一次操作' })); await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    assertEnvelope(game, before, boundary.intent, 1); same(game.state, expected); expect(game.commits).toBe(1);
    expect(expected.uncleanMonarch.life.site).toMatchObject({ playerLocation: 'START', volunteer: { location: 'A' }, card: { location: 'NORA' } });
    expect(projectSliceState(expected).uncleanMonarch.insideCase).toBe(false); same(roots(expected), roots(before));
    same(expected.uncleanMonarch.life.site, before.uncleanMonarch.life.site); same(expected.uncleanMonarch.life.pieces, before.uncleanMonarch.life.pieces);
    await reopen(game); await userEvent.click(screen.getByRole('button', { name: '污秽君王与原安静室' })); await screen.findByRole('region', { name: PANEL });
    assertCurrentBody(expected); expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy(); expect(game.submit).toHaveBeenCalledTimes(1);
  }, 120_000);

  it('reopens the actual terminal body and preserves either sealed death or the saved four-metre living exit', async () => {
    const final = capturedState('final'), terminal = final.uncleanMonarch.encounter.terminal;
    if (!terminal) { expect(observedCapture().terminal).toBeNull(); return; }
    const source = namedBoundary(`combat-round-${terminal.round}`).final, game = savedGame(source); await mount(game); assertRound(source);
    const outcome = source.lastCombatRound!.uncleanMonarchOutcome!, site = getUncleanMonarchCurrentSite(source);
    fireEvent.keyDown(screen.getByRole('dialog', { name: ROUND }), { key: 'Escape' }); expect(screen.getByRole('dialog', { name: ROUND })).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: '快速显示本回合结果' })); same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
    await reopen(game); assertRound(source);
    if (terminal.outcome === 'PLAYER_DEAD') {
      expect(source).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } }); expect(terminal.exitMetres).toBe(0); same(site, outcome.siteAfter);
      await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '查看收尾卷宗' }));
      expect(await screen.findByText('只读封存卷宗')).toBeTruthy(); expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
      expect(screen.queryByRole('group', { name: '四个主要行动' })).toBeNull(); expect(projectSliceState(game.state).canAct).toBe(false);
    } else {
      expect(terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 }); expect(site.playerLocation).toBe('START');
      expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + 4); expect(site.clockSeconds).toBe(outcome.clockSecondsAfter + 4);
      same(source.uncleanMonarch.encounter.piece, outcome.pieceAfter); same(source.uncleanMonarch.encounter.plates, outcome.platesAfter);
      await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '返回生活' }));
      expect(screen.queryByText('只读封存卷宗')).toBeNull(); expect(await screen.findByRole('group', { name: '四个主要行动' })).toBeTruthy();
    }
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    // The ordinary work, if actually captured, is checked as its own real save.
    if (captureMetadata().boundaries['actual-work-after-living-exit']) {
      const work = namedBoundary('actual-work-after-living-exit'); expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' });
      const workGame = savedGame(work.before); cleanup(); await mount(workGame);
      if (screen.queryByRole('dialog', { name: ROUND })) await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '返回生活' }));
      await userEvent.click(within(await screen.findByRole('group', { name: '四个主要行动' })).getByRole('button', { name: /^工作，1行动/ }));
      await waitFor(() => expect(workGame.state.revision).toBe(work.final.revision)); assertEnvelope(workGame, work.before, work.intent, 1);
      same(workGame.state, work.final); same(roots(workGame.state), roots(work.before)); expect(workGame.commits).toBe(1);
      await reopen(workGame); same(workGame.state, work.final); expect(workGame.submit).toHaveBeenCalledTimes(1);
    }
  }, 120_000);
});

it('keeps the independently preserved724-command Blood Duke death read-only without inventing a stage202 death', async () => {
  const source = currentCapture(sourceEntry('final')), game = savedGame(source);
  expect(source).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } }); expect(source.uncleanMonarch.promotionWeek).toBeNull();
  await mount(game); const reveal = screen.getByRole('dialog', { name: ROUND });
  expect(within(reveal).queryByRole('region', { name: RECORD })).toBeNull();
  for (const name of ['进入下一回合', '返回生活', '确认姿态，结算完整回合']) expect(within(reveal).queryByRole('button', { name })).toBeNull();
  await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' })); expect(await screen.findByText('只读封存卷宗')).toBeTruthy();
  expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull(); expect(screen.queryByRole('group', { name: '四个主要行动' })).toBeNull();
  expect(screen.queryByRole('button', { name: '污秽君王与原安静室' })).toBeNull(); expect(projectSliceState(source).canAct).toBe(false);
  await reopen(game); expect(within(screen.getByRole('dialog', { name: ROUND })).queryByRole('button', { name: '返回生活' })).toBeNull();
  same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
}, 60_000);
