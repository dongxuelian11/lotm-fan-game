/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { directedCryPresentationRound } from './abomination-directed-combat-ui-fixture.js';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { playerText, projectPlayerText } from '../../src/shared/player-text.js';
import { ABOMINATION_SOURCE_KEYS, ABOMINATION_ABILITY_IDS, type AbominationAction } from '../../src/domain/abomination/types.js';
import { getAbominationCurrentSite } from '../../src/domain/abomination/life.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { ABOMINATION_CAPTURE_EVIDENCE as evidence } from '../domain/abomination-capture-evidence.js';
import { captureMetadata, capturedSnapshot, capturedState, namedBoundary, observedCapture, currentCapture,
  sourceEntry, sameCaptureValue as same } from '../domain/abomination-capture-helper.js';

const PANEL = '神孽成长', CONFIRM = '神孽操作确认', ROUND = '战斗回合结果';
const RECORD = '神孽本回合实际记录', RESOURCES = '神孽本回合实际资源';
const BODY = '本回合按实际身体冲击结算伤势', MENTAL = '本回合按实际精神压力结算后果';
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const roots = (s: SliceState) => ABOMINATION_SOURCE_KEYS.map(key => s[key]);
const rootBytes = (s: SliceState) => JSON.stringify(roots(s));
const currentBodyText = () => (screen.queryByRole('region', { name: '神孽独立小院冲突' }) ?? screen.getByRole('region', { name: '埃尔莎同一原身体' })).textContent;

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
  if (value.lastCombatRound?.abominationOutcome || !value.abomination.promoted && value.lastCombatRound) await screen.findByRole('dialog', { name: ROUND });
  else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! });
  else if (value.abomination.insideCase) await screen.findByRole('region', { name: PANEL });
  else await screen.findByRole('button', { name: '神孽与原安静室' });
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
  const site = getAbominationCurrentSite(s), value = projectSliceState(s), before = JSON.stringify(site);
  const places = { START: '原门口', A: '四米处', B: '八米处', YARD: '独立小院', OUTSIDE: '室外' };
  same(value.abomination.life.site, projectPlayerText(structuredClone(site), s.character.name));
  expect(JSON.stringify(getAbominationCurrentSite(s))).toBe(before);
  const yard = screen.queryByRole('region', { name: '神孽独立小院冲突' });
  if (yard) {
    expect(yard.textContent).toContain(`本人在${places[site.playerLocation]}，埃尔莎在${places[site.volunteer.location]}，原导师在${places[site.guide.location]}`);
    expect(yard.textContent).toContain(`累计普通步行${site.playerTravelMetres}米，原现场时钟${site.clockSeconds}秒`);
    expect(yard.textContent).toContain(`对手原刻片剩余${s.abomination.encounter.plates.filter(plate => plate.status === 'HELD').length}/3枚`);
  } else {
    const body = screen.getByRole('region', { name: '埃尔莎同一原身体' });
    expect(body.textContent).toContain(`${site.volunteer.name} · ${site.volunteer.age}岁`);
    expect(body.textContent).toContain(`实际在${places[site.volunteer.location]}`);
    expect(body.textContent).toContain(`健康${site.volunteer.health} · 精神${site.volunteer.mind} · 灵性${site.volunteer.spirituality}`);
    expect(body.textContent).toContain(`本人实际在${places[site.playerLocation]}，累计普通步行${site.playerTravelMetres}米，原室时钟${site.clockSeconds}秒`);
    expect(body.textContent).toContain(`本阶段协作耗力${s.abomination.life.volunteerEffortSpent}/12`);
    const objects = screen.getByRole('region', { name: '神孽原物实际去向' });
    expect(objects.textContent).toContain(`原衣物${site.clothing.quantity}套`);
    expect(objects.textContent).toContain(`原包${site.bag.quantity}个`);
    expect(objects.textContent).toContain(`唯一原托盘在${places[site.tray.location]}；唯一原纸在${places[site.note.location]}；原导师${site.guide.name}在${places[site.guide.location]}`);
  }
  const panel = screen.getByRole('region', { name: PANEL });
  expect(panel.textContent).not.toMatch(/本人精力|现场精力|playerEnergy|能量100/);
  expect(panel.textContent).toContain('莱娜原死亡及遗落兵器、卡尔德原投降与未治疗旧伤继续保留');
  expect(panel.textContent).toContain('旧记录不会复活或重开');
  expect(s.ancientEvil.encounter).toMatchObject({ targetId: 'AE2-LENA', enemyStatus: 'DEAD', enemyHealth: 0, enemyMind: 100, enemySpirituality: 98, weaponLocation: 'COURT' });
  expect(s.silentDisciple.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', enemyHealth: 70, enemyMind: 100, enemySpirituality: 116 });
  expect(s.ancientEvil.encounter.blocks).toHaveLength(3);
  expect(s.ancientEvil.encounter.blocks.every(block => block.status === 'SPENT' && block.location === 'TARGET_GROUND')).toBe(true);
  for (const key of ABOMINATION_SOURCE_KEYS) expect(value[key].actions.every(action => !action.enabled)).toBe(true);
}
function assertRound(state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.abominationOutcome;
  if (!outcome) throw new Error('Expected an actual captured Abomination round.');
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
    expect(rows[index]!.textContent).toContain(`有限效果实际应用${action.windowsApplied.reduce((total, applied) => total + applied.amount, 0)}`);
    if (action.windowGranted) expect(rows[index]!.textContent).toContain('本槽建立有限窗口；实际应用以相应后续动作记录为准，建立本身不计效果');
    if (action.hesitationSeconds > 0) expect(rows[index]!.textContent).toContain(`对手本次动作实际迟滞${action.hesitationSeconds}秒，动作与已付成本仍保留`);
    else expect(rows[index]!.textContent).not.toContain('对手本次动作实际迟滞');
    if (action.windowsApplied.length) {
      expect(action).toMatchObject({ actor: 'ENEMY', id: 'MIND_SPIKE', planned: 'MIND_SPIKE', attackKind: 'MENTAL', paidCost: 7 });
      expect(action.receipt).toMatchObject({ kind: 'MENTAL', paidCost: 7 });
      expect(action.windowsApplied.every(window => window.amount > 0 && window.amount <= 30)).toBe(true);
      expect(action.pieceChargePaid).toBe(action.windowsApplied.length);
    }
    if (action.attackKind === 'BODY') expect(action.windowsApplied).toEqual([]);
    if (action.hesitationSeconds) {
      expect(action.hesitationSeconds).toBe(3); expect(action.elapsedSeconds).toBe(8);
      expect(action.windowsApplied.some(window => window.kind === 'CRY')).toBe(true);
    }
  });
  expect(within(reveal).queryByRole('region', { name: '古代邪物本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '古代邪物成长' })).toBeNull();
  const next = state.ending ? '查看收尾卷宗' : state.combat ? '进入下一回合' : '返回生活';
  for (const label of ['查看收尾卷宗', '进入下一回合', '返回生活']) {
    if (label === next) expect(within(reveal).getByRole('button', { name: label })).toBeTruthy();
    else expect(within(reveal).queryByRole('button', { name: label })).toBeNull();
  }
  assertCurrentBody(state);
}
function openAction(action: AbominationAction) {
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
  // vi.fn(initialImplementation) retains that original closure on mockReset.
  // These mocks install implementations separately so reset releases large saved projections.
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

// Fail closed: a private scaffold must never be reported as a passing capture suite.
it('requires the coordinator-frozen778-command actual stage203 observations before claiming renderer coverage', () => {
  expect(observedCapture()).toMatchObject({ commands: 778, namedBoundaries: 140, uniqueTransitions: 137, aliases: 3,
    combatRounds: [1, 2, 3, 4], consequenceDomains: ['MENTAL', 'BODY'], promotionWeek: 169,
    final: { status: 'ACTIVE', week: 175, H: 100, M: 48, S: 82, cash: 180, AP: 2 },
    terminal: { outcome: 'ENEMY_SURRENDERED', round: 4 } });
});

describe.skipIf(evidence.observed === null)('Abomination actual saved UI and identical-intent retry', () => {
  it('opens any actual new live fight ahead of the inherited S2 promotion and historical last round', async () => {
    const observations = observedCapture();
    if (!observations.snapshots.includes('combatStart')) { expect(observations.combatRounds).toEqual([]); return; }
    const source = capturedSnapshot('combatStart'), value = projectSliceState(source), game = savedGame(source);
    expect(source.ancientEvil.promotionWeek).toBe(138); expect(value.ancientEvil.promoted).toBe(true); expect(value.ancientEvil.actions.every(action => !action.enabled)).toBe(true);
    expect(value.abomination.promoted).toBe(true); same(source.lastCombatRound, capturedState('prefixFinal').lastCombatRound);
    expect(source.combat).toMatchObject({ encounterId: 'ABOMINATION_DISPUTE', round: 1, lastRound: null });
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES }), battle = value.combat!.abomination!;
    expect(resources.textContent).toContain(`本人健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality}`);
    expect(resources.textContent).toContain(`${battle.enemyName}：健康${battle.enemyHealth}、精神${battle.enemyMind}、灵性${battle.enemySpirituality}`);
    expect(resources.textContent).toContain(`辅助片剩余${battle.piece!.charges}次，磨损${battle.piece!.wear}`);
    expect(within(stage).queryByRole('region', { name: '古代邪物本回合实际资源' })).toBeNull(); assertCurrentBody(source);
    const text = resources.textContent; await reopen(game); expect(screen.getByRole('region', { name: RESOURCES }).textContent).toBe(text);
    assertCurrentBody(source); same(projectSliceState(game.state), value); same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it('retains committed resources on a failed actual round and retries exactly one identical envelope without double fees', async () => {
    const observations = observedCapture(); if (!observations.combatRounds.length) { expect(capturedState('final').abomination.encounter.startSource).toBeNull(); return; }
    const boundary = namedBoundary(`combat-round-${observations.combatRounds[0]}`), before = boundary.before, expected = boundary.final;
    expect(boundary.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    // The UI explicitly submits its actual inherited policy controls; the producer omitted their identical defaults.
    const uiIntent: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: false, madmanPolicy: 'HOLD' };
    same(applySliceIntent(before, uiIntent), expected);
    const game = savedGame(before), value = projectSliceState(before), releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game);
    const stage = screen.getByRole('dialog', { name: value.combat!.title! }), resources = within(stage).getByRole('region', { name: RESOURCES }).textContent;
    const body = currentBodyText(), stance = value.combat!.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, uiIntent, 1);
    expect(disabled(submit)).toBe(true); expect(game.attemptedStates).toHaveLength(1); same(game.attemptedStates[0], expected);
    same(game.state, before); expect(game.commits).toBe(0); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    expect(within(stage).getByRole('region', { name: RESOURCES }).textContent).toBe(resources); expect(currentBodyText()).toBe(body);
    await act(async () => { releaseFailure(); }); const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(disabled(submit)).toBe(true); same(game.state, before); expect(game.commits).toBe(0); assertCurrentBody(before);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); assertEnvelope(game, before, uiIntent, 2);
    expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); same(game.state, before);
    await act(async () => { releaseSuccess(); }); await waitFor(() => expect(game.state.revision).toBe(expected.revision)); await screen.findByRole('dialog', { name: ROUND });
    expect(game.attemptedStates).toHaveLength(2); same(game.attemptedStates[1], expected); same(game.state, expected); expect(game.commits).toBe(1);
    const outcome = game.state.lastCombatRound!.abominationOutcome!, actions = [...outcome.playerActions, ...outcome.enemyActions];
    expect(outcome.playerSpiritualityAfter).toBe(before.spirituality - outcome.playerActions.reduce((n, a) => n + a.paidCost, 0));
    expect(game.state.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
    expect(game.state.abomination.encounter.enemySpirituality).toBe(before.abomination.encounter.enemySpirituality - outcome.enemyActions.reduce((n, a) => n + a.paidCost, 0));
    expect(outcome.piece!.charges).toBe(before.abomination.encounter.piece!.charges - actions.reduce((n, a) => n + a.pieceChargePaid, 0));
    expect(outcome.piece!.wear).toBe(before.abomination.encounter.piece!.wear + actions.reduce((n, a) => n + a.pieceWearPaid, 0));
    same(game.state.abomination.encounter.plates, outcome.plates); same(game.state.abomination.encounter.piece, outcome.piece!);
    expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1); same(game.state.combatHistory.slice(0, -1), before.combatHistory); same(roots(game.state), roots(before)); expect(rootBytes(game.state)).toBe(rootBytes(before));
    expect(game.state.cash).toBe(before.cash); expect(game.state.actionsRemaining).toBe(before.actionsRemaining);
    assertRound(expected); const record = screen.getByRole('dialog', { name: ROUND }).textContent, projection = projectSliceState(game.state);
    await reopen(game); assertRound(expected); expect(screen.getByRole('dialog', { name: ROUND }).textContent).toBe(record);
    same(projectSliceState(game.state), projection); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1); same(game.state, expected);
  }, 180_000);

  it('renders every observed BODY or MENTAL domain and selected versus actually consumed finite windows faithfully on reopen', async () => {
    const observations = observedCapture(), domains = new Set<string>();
    for (const id of ABOMINATION_ABILITY_IDS) expect(observations.combatAbilityUse[id]).toMatchObject({ actualApplications: 0, masteryApplications: 0 });
    for (const number of observations.combatRounds) {
      const source = namedBoundary(`combat-round-${number}`).final, game = savedGame(source), round = source.lastCombatRound!, outcome = round.abominationOutcome!;
      if (round.consequenceDomain) domains.add(round.consequenceDomain);
      if (round.consequenceDomain === 'MENTAL') { expect(round.consequenceRoll).toBeUndefined(); expect(round.consequenceWeights).toBeNull(); }
      if (round.consequenceDomain === 'BODY') { expect(round.consequenceRoll).toBeGreaterThanOrEqual(1); expect(round.consequenceWeights).not.toBeNull(); }
      cleanup(); await mount(game); assertRound(source); const record = screen.getByRole('region', { name: RECORD });
      const rows = within(record).getAllByRole('listitem');
      for (const action of outcome.playerActions.filter(a => ABOMINATION_ABILITY_IDS.some(id => id === a.id))) {
        const row = rows.find(item => item.textContent?.includes(`本人第${action.order + 1}槽：`))!;
        expect(row.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
        expect(action.paidCost).toBe(action.attempted ? 8 : 0);
        expect(action.mindCost).toBe(action.attempted ? action.succeeded ? 2 : 4 : 0);
        expect(action.pieceChargePaid).toBe(0); expect(action.masteryApplied).toEqual([]);
        expect(row.textContent).toContain('有限效果实际应用0');
        if (action.windowGranted) {
          expect(action.windowGranted.expiresAt - action.windowGranted.castAt).toBe(20);
          expect(row.textContent).toContain('建立本身不计效果');
        }
      }
      expect(outcome.hesitationSeconds).toBe(0); expect(outcome.piece).toMatchObject({ charges: 3, wear: 0 });
      expect([...outcome.playerActions, ...outcome.enemyActions].flatMap(action => action.windowsApplied)).toEqual([]);
      expect(outcome.elapsedSeconds).toBe(60 + outcome.hesitationSeconds - outcome.source.body.hesitationSeconds);
      expect(outcome.siteAfter.clockSeconds).toBe(outcome.source.site.clockSeconds + outcome.elapsedSeconds);
      for (const id of ABOMINATION_ABILITY_IDS) {
        const applications = [...outcome.playerActions, ...outcome.enemyActions].filter(action => action.masteryApplied.includes(id)).length;
        expect(outcome.masteryAfter[id]).toBe(Math.min(500, outcome.source.mastery[id]! + 8 * applications));
      }
      const text = record.textContent; await reopen(game); assertRound(source); expect(screen.getByRole('region', { name: RECORD }).textContent).toBe(text);
      same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
    }
    same([...domains], observations.consequenceDomains); // Empty/missing domains are explicitly unobserved, never fabricated.
  }, 300_000);

  it('protects the natural saved name and an adversarial display-only name without rewriting the capture or action receipts', async () => {
    const observations = observedCapture(); if (!observations.combatRounds.length) { expect(observations.consequenceDomains).toEqual([]); return; }
    const source = namedBoundary(`combat-round-${observations.combatRounds[0]}`).final, value = projectSliceState(source), game = savedGame(source);
    await mount(game); assertRound(source); expect(screen.getByRole('banner').textContent).toContain(`${source.character.name} · ${value.abomination.title}`);
    const displayName = '原创G · G候选映射 BODY MENTAL 冲动收束';
    const customNameOnly = (projection: SliceProjection) => { projection.character = { ...projection.character, name: displayName }; projection.abomination = { ...projection.abomination, characterName: displayName, appearanceRecord: projection.abomination.appearanceRecord.replace(source.character.name, displayName) }; };
    await reopen(game, customNameOnly); assertRound(source);
    function assertName() {
      expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${value.abomination.title}`);
      const current = within(screen.getByRole('region', { name: PANEL })).getByRole('region', { name: '神孽当前资源' });
      expect(current.textContent).toContain(`灵性${source.spirituality}/120`);
      expect(screen.getByRole('region', { name: PANEL }).textContent).toContain(displayName);
    }
    assertName(); await reopen(game, customNameOnly); assertName(); assertRound(source);
    same(projectSliceState(game.state), value); same(game.state, source); expect(game.state.character.name).toBe('艾洛'); expect(game.submit).not.toHaveBeenCalled();
  }, 180_000);

  it.each([
    'tray-pulse-spirit_barrier', 'tray-pulse-perform_pulse', 'spoken-hesitation-brief_cry',
    'spoken-hesitation-perform_cue', 'withdrawn-input-withdraw_consent',
  ])('reopens the actual original-room window, paid failure and finite test source at %s', async name => {
    const source = namedBoundary(name).final, game = savedGame(source), value = projectSliceState(source).abomination;
    const attempt = value.life.currentAttempt, piece = value.life.pieces.find(entry => entry.caseId === value.life.activeCase)!;
    if (!attempt) throw new Error('The captured original-room action has no actual current attempt.');
    function assertLifeFacts() {
      assertCurrentBody(source);
      const room = screen.getByRole('region', { name: '神孽原场事务' });
      expect(room.textContent).toContain(`实耗${attempt!.spiritualitySpent}灵性、${attempt!.mindSpent}精神`);
      expect(room.textContent).toContain(`能力用量剩余${piece.charges}/1 · 实际磨损${piece.wear}`);
      expect(room.textContent).toContain(`唯一测试源剩余${piece.testCharges}/1 · 已实际使用${piece.testUses}次`);
      if (name === 'tray-pulse-spirit_barrier') {
        expect(value.life.pending).not.toBeNull(); expect(value.life.pendingRemainingSeconds).toBeGreaterThan(0);
        expect(room.textContent).toContain(`灵性束障还剩${value.life.pendingRemainingSeconds}秒`);
        expect(room.textContent).toContain('只作用于当前这一次可见精神脉冲，最多减轻30；身体攻击不减');
        expect(piece).toMatchObject({ charges: 1, wear: 0, testCharges: 1, testUses: 0 });
        expect(attempt!.appliedAbilityIds).toEqual([]);
      } else if (name === 'tray-pulse-perform_pulse') {
        expect(room.textContent).toContain('本次精神脉冲实际压力45→15');
        expect(value.life.pending).toBeNull(); expect(attempt!.appliedAbilityIds).toEqual(['chained.s1.spirit-barrier']);
        expect(piece).toMatchObject({ charges: 0, wear: 1, testCharges: 0, testUses: 1 });
      } else if (name.startsWith('spoken-hesitation')) {
        expect(attempt).toMatchObject({ castTier: 'FAILURE', spiritualitySpent: 8, mindSpent: 4, appliedAbilityIds: [] });
        expect(value.life.cue).toMatchObject({ delayImposedSeconds: 0, delayRemainingSeconds: 0, executed: name.endsWith('perform_cue') });
        expect(screen.getByRole('region', { name: '神孽实际三秒等待' }).textContent).toContain('已施加延迟0秒');
        expect(room.textContent).not.toContain('仍须逐秒实际等待');
        expect(piece.charges).toBe(1); expect(piece.wear).toBe(0);
      } else {
        expect(attempt!.withdrawn).toBe(true); expect(value.life.pending).toBeNull();
        expect(room.textContent).toContain('本案许可已真实撤回'); expect(attempt!.appliedAbilityIds).toEqual([]);
      }
      return room.textContent;
    }
    await mount(game); const text = assertLifeFacts(); await reopen(game); expect(assertLifeFacts()).toBe(text);
    same(game.state, source); expect(rootBytes(game.state)).toBe(rootBytes(source)); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 180_000);

  it('keeps the actual paid preparation uncommitted on failure and retries one fee and one action only', async () => {
    const boundary = namedBoundary('tray-pulse-prepare'), before = boundary.before, expected = boundary.final;
    expect(boundary.intent).toEqual({ type: 'ABOMINATION', command: { type: 'PREPARE', caseId: 'tray-pulse', method: 'ABILITY' } });
    const game = savedGame(before), value = projectSliceState(before), releaseFailure = game.holdNextSave(); game.failNextSave(); await mount(game);
    const action = value.abomination.actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(boundary.intent.type === 'ABOMINATION' ? boundary.intent.command : null));
    if (!action) throw new Error('The actual paid preparation is not publicly offered.');
    const resourceText = screen.getByRole('region', { name: '神孽当前资源' }).textContent;
    const submit = within(openAction(action)).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, boundary.intent, 1);
    expect(disabled(submit)).toBe(true); same(game.state, before); same(game.attemptedStates[0], expected); expect(game.commits).toBe(0);
    await act(async () => { releaseFailure(); });
    expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    expect(screen.getByRole('region', { name: '神孽当前资源' }).textContent).toBe(resourceText);
    for (const button of within(screen.getByRole('region', { name: PANEL })).getAllByRole('button', { hidden: true })) expect(disabled(button)).toBe(true);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    const retry = screen.getByRole('button', { name: '重试这次操作' }); fireEvent.click(retry); fireEvent.click(retry);
    assertEnvelope(game, before, boundary.intent, 2); expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); same(game.state, before);
    await act(async () => { releaseSuccess(); }); await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    same(game.state, expected); expect(game.commits).toBe(1); expect(game.attemptedStates).toHaveLength(2);
    expect(game.state.cash).toBe(before.cash - 20); expect(game.state.actionsRemaining).toBe(before.actionsRemaining - 1);
    expect(game.state.abomination.life.pieces).toHaveLength(before.abomination.life.pieces.length + 1);
    expect(game.state.abomination.life.pieces.at(-1)).toMatchObject({ caseId: 'tray-pulse', paidPennies: 20, quantity: 1, charges: 1, testCharges: 1 });
    expect(rootBytes(game.state)).toBe(rootBytes(before)); await reopen(game); assertCurrentBody(expected);
    same(game.state, expected); expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1);
  }, 180_000);

  it('retains the original dead Lena and surrendered Calder records without reviving them or reopening their commands', async () => {
    const raw = sourceEntry<SliceState>('final');
    expect(raw.schemaVersion).toBe(178); expect(raw.contentVersion).toBe('ancient-evil-v178');
    const original = currentCapture(raw), source = capturedSnapshot('promoted'), game = savedGame(source), bytes = rootBytes(source);
    expect(original).toMatchObject({ status: 'ACTIVE', health: 100, revision: 643 });
    expect(rootBytes(original)).toBe(JSON.stringify(ABOMINATION_SOURCE_KEYS.map(key => raw[key])));
    expect(bytes).toBe(rootBytes(original)); expect(projectSliceState(source).ancientEvil.promoted).toBe(true);
    await mount(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '神孽与原安静室' })); assertCurrentBody(source);
    const panel = screen.getByRole('region', { name: PANEL });
    expect(panel.textContent).toContain('旧木块3块已耗尽'); expect(panel.textContent).toContain('旧记录不会复活或重开');
    expect(screen.queryByRole('region', { name: '古代邪物成长' })).toBeNull();
    const projection = projectSliceState(source);
    for (const historical of [projection.ancientEvil, projection.silentDisciple]) {
      expect(historical.actions.every(action => !action.enabled)).toBe(true);
      expect(historical.encounter.actions.every(action => !action.enabled)).toBe(true);
    }
    await reopen(game); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '神孽与原安静室' })); assertCurrentBody(source);
    expect(rootBytes(game.state)).toBe(bytes); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0); same(game.state, source);
  }, 180_000);

  it('requires the captured ordinary cleanup command rather than replacing the original-piece return with navigation', async () => {
    const observations = observedCapture(), caseId = observations.completedCases[0];
    if (!caseId) { expect(observations.completedCases).toEqual([]); return; }
    const boundary = namedBoundary(`${caseId}-leave`), before = boundary.before, expected = boundary.final, game = savedGame(before), loadRun = await mount(game);
    expect(boundary.intent).toEqual({ type: 'ABOMINATION', command: { type: 'LEAVE', caseId } });
    expect(projectSliceState(before).abomination.insideCase).toBe(true); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); assertCurrentBody(before);
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '返回主菜单' })); await chooseSavedRun(game);
    expect(loadRun).toHaveBeenCalledTimes(2); same(game.state, before); expect(game.submit).not.toHaveBeenCalled(); assertCurrentBody(before);
    const action = projectSliceState(before).abomination.actions.find(entry => entry.enabled && entry.command.type === 'LEAVE' && entry.command.caseId === caseId);
    if (!action) throw new Error('The captured ordinary exit is not publicly offered.');
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '取消，返回查看' })); expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull();
    same(game.state, before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '确认执行这一次操作' })); await waitFor(() => expect(game.state.revision).toBe(expected.revision));
    assertEnvelope(game, before, boundary.intent, 1); same(game.state, expected); expect(game.commits).toBe(1);
    expect(expected.abomination.life.site).toMatchObject({ playerLocation: 'START', volunteer: { location: 'A' }, clothing: { location: 'ELSA', worn: true }, bag: { location: 'ELSA' } });
    expect(projectSliceState(expected).abomination.insideCase).toBe(false); same(roots(expected), roots(before)); expect(rootBytes(expected)).toBe(rootBytes(before));
    same(expected.abomination.life.site, before.abomination.life.site); same(expected.abomination.life.pieces, before.abomination.life.pieces);
    await reopen(game); await userEvent.click(screen.getByRole('button', { name: '神孽与原安静室' })); await screen.findByRole('region', { name: PANEL });
    assertCurrentBody(expected); expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy(); expect(game.submit).toHaveBeenCalledTimes(1);
  }, 180_000);

  it('reopens the actual terminal body and preserves either sealed death or the saved four-metre living exit', async () => {
    const final = capturedState('final'), terminal = final.abomination.encounter.terminal;
    if (!terminal) { expect(observedCapture().terminal).toBeNull(); return; }
    const source = namedBoundary(`combat-round-${terminal.round}`).final, game = savedGame(source); await mount(game); assertRound(source);
    const outcome = source.lastCombatRound!.abominationOutcome!, site = getAbominationCurrentSite(source);
    fireEvent.keyDown(screen.getByRole('dialog', { name: ROUND }), { key: 'Escape' }); expect(screen.getByRole('dialog', { name: ROUND })).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: '快速显示本回合结果' })); same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
    await reopen(game); assertRound(source);
    if (terminal.outcome === 'PLAYER_DEAD') {
      expect(source).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } }); expect(terminal.exitMetres).toBe(0); expect(site.playerLocation).toBe('YARD'); expect(site.clockSeconds).toBe(outcome.siteAfter.clockSeconds + terminal.formWaitSeconds);
      await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '查看收尾卷宗' }));
      expect(await screen.findByText('只读封存卷宗')).toBeTruthy(); expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
      expect(screen.queryByRole('group', { name: '四个主要行动' })).toBeNull(); expect(projectSliceState(game.state).canAct).toBe(false);
    } else {
      expect(terminal).toMatchObject({ exitMetres: 4, exitSeconds: 4 }); expect(site.playerLocation).toBe('START');
      expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + 4); expect(site.clockSeconds).toBe(outcome.siteAfter.clockSeconds + terminal.formWaitSeconds + 4);
      same(source.abomination.encounter.piece, outcome.piece!); same(source.abomination.encounter.plates, outcome.plates);
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
  }, 180_000);
});


describe.skipIf(evidence.observed === null)('Abomination explicit directed presentation, separate from the natural saved campaign', () => {
  it('renders the otherwise unobserved real three-second cry semantics without attributing them to the natural capture', async () => {
    const observations = observedCapture();
    expect(observations.combatAbilityUse['chained.s1.brief-cry'].actualApplications).toBe(0);
    const source = capturedSnapshot('combatStart'), bytes = JSON.stringify(source), game = savedGame(source);
    const directed = directedCryPresentationRound(source), outcome = directed.abominationOutcome!;
    const player = outcome.playerActions[0]!, enemy = outcome.enemyActions[0]!;
    expect(player).toMatchObject({ id: 'chained.s1.brief-cry', paidCost: 8, mindCost: 2, pieceChargePaid: 0, succeeded: true });
    expect(enemy).toMatchObject({ id: 'MIND_SPIKE', planned: 'MIND_SPIKE', attackKind: 'MENTAL', paidCost: 7,
      hesitationSeconds: 3, elapsedSeconds: 8, pieceChargePaid: 1, pieceWearPaid: 1 });
    expect(enemy.receipt).toMatchObject({ kind: 'MENTAL', paidCost: 7 });
    expect(outcome.siteAfter.clockSeconds).toBe(outcome.source.site.clockSeconds + 63);
    expect(outcome.plates.filter(plate => plate.status === 'SPENT')).toHaveLength(1);
    expect(directed.consequenceRoll).toBeUndefined(); expect(directed.consequenceWeights).toBeNull();
    // Render-only boundary: the mount adapter supplies this clearly directed
    // round to the view. The original saved game and all commits stay untouched.
    const showDirectedRecord = (projection: SliceProjection) => { projection.lastCombatRound = projectPlayerText(structuredClone(directed), source.character.name); };
    function assertDirectedRecord() {
      const reveal = screen.getByRole('dialog', { name: ROUND }), record = within(reveal).getByRole('region', { name: RECORD });
      expect(record.textContent).toContain(MENTAL); expect(record.textContent).not.toContain(BODY);
      const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(2);
      expect(rows[0]!.textContent).toContain('实耗8灵性、2精神');
      expect(rows[0]!.textContent).toContain('本槽辅助片实耗0次、磨损0；有限效果实际应用0');
      expect(rows[0]!.textContent).toContain('建立本身不计效果');
      expect(rows[1]!.textContent).toContain('实耗7灵性、0精神');
      expect(rows[1]!.textContent).toContain('本槽实际经过8秒');
      expect(rows[1]!.textContent).toContain('本槽辅助片实耗1次、磨损1；有限效果实际应用30');
      expect(rows[1]!.textContent).toContain('对手本次动作实际迟滞3秒，动作与已付成本仍保留');
      expect(reveal.textContent).toContain('本轮真实经过63秒，包含3秒已执行迟疑');
      expect(within(reveal).queryByRole('region', { name: '古代邪物本回合实际记录' })).toBeNull();
      return record.textContent;
    }
    await mount(game, showDirectedRecord); const text = assertDirectedRecord();
    await reopen(game, showDirectedRecord); expect(assertDirectedRecord()).toBe(text);
    expect(JSON.stringify(source)).toBe(bytes); same(game.state, source); expect(rootBytes(game.state)).toBe(rootBytes(source));
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 180_000);
});
