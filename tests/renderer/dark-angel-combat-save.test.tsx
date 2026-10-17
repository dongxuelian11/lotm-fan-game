/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import type { SliceIntent, SliceProjection, SliceState } from '../../src/domain/slice/types.js';
import type { SliceBridge, SliceReceipt } from '../../src/shared/slice-contracts.js';
import { DARK_ANGEL_SOURCE_KEYS, type DarkAngelAction } from '../../src/domain/dark-angel/types.js';
import { getDarkAngelCurrentSite } from '../../src/domain/dark-angel/life.js';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format.js';
import { capturedSnapshot, namedBoundary, sameCaptureValue as same } from '../domain/dark-angel-capture-helper.js';
import { knowledgeSnapshot } from '../helpers/knowledge-emperor-capture.js';

const PANEL = '暗天使成长', CONFIRM = '暗天使操作确认', ROUND = '战斗回合结果';
const RECORD = '暗天使本回合实际记录', RESOURCES = '暗天使本回合实际资源', ORIGINALS = '暗天使原人原物当前状态';
const BODY = '本回合按实际身体冲击结算伤势', MENTAL = '本回合按实际精神压力结算后果';
const disabled = (element: HTMLElement) => (element as HTMLButtonElement).disabled;
const roots = (state: SliceState) => DARK_ANGEL_SOURCE_KEYS.map(key => state[key]);

// Only the renderer/IPC commit boundary is controlled. A failed attempt runs
// the real reducer and validator, then discards its uncommitted state. The
// immutable capture, original seed/cursor, bodies and outcomes are never edited.
// Actual SQLite rollback and terminal seal files belong to integration tests.
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
      committedAt: '2026-10-16T03:00:00Z', replayed: false, state: projectSliceState(state) };
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
async function chooseSavedRun(game: SavedGame, value = projectSliceState(game.state)) {
  if (value.status === 'DEAD') {
    expect(disabled(await screen.findByRole('button', { name: /继续游戏/ }))).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /查看封存/ }));
  } else await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(value.character.name) }));
  if (value.lastCombatRound?.darkAngelOutcome || value.status === 'DEAD' && value.lastCombatRound?.knowledgeEmperorOutcome) await screen.findByRole('dialog', { name: ROUND });
  else if (value.combat) await screen.findByRole('dialog', { name: value.combat.title! });
  else if (value.darkAngel.insideCase) await screen.findByRole('region', { name: PANEL });
  else await screen.findByRole('button', { name: '暗天使与原封存院' });
}
// The optional transform is reserved for the explicitly labelled custom-name
// display assertion. It touches only fresh public projection clones, never
// captured bytes, the reducer input, committed state or saved receipts.
async function mount(game: SavedGame, presentationOnly?: (value: SliceProjection) => void) {
  expect([game.state.schemaVersion, game.state.contentVersion]).toEqual([CURRENT_SCHEMA_VERSION, CURRENT_CONTENT_VERSION]);
  function projection() { const value = projectSliceState(game.state); presentationOnly?.(value); return value; }
  const value = projection();
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projection() }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: value, runs: [{ runId: value.runId, name: value.character.name,
        portraitId: value.character.portraitId, week: value.week, date: value.date, status: value.status,
        revision: value.revision, updatedAt: '2026-10-16T03:00:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />); await chooseSavedRun(game, value);
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(value.runId);
  return loadRun;
}
async function reopen(game: SavedGame, presentationOnly?: (value: SliceProjection) => void) { cleanup(); await mount(game, presentationOnly); }
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count: number) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
function assertCurrentBody(state: SliceState) {
  const site = getDarkAngelCurrentSite(state), value = projectSliceState(state);
  const body = screen.getByRole('region', { name: ORIGINALS });
  same(value.darkAngel.life.site, site);
  const places = { START: '原封存院门口', A: '四米处原桌', B: '八米处原封条', YARD: '相邻院落', OUTSIDE: '室外' };
  expect(body.textContent).toContain(`本人当前在${places[site.playerLocation]}；累计普通步行${site.playerTravelMetres}米，现场时钟${site.clockSeconds}秒`);
  expect(body.textContent).toContain(`${site.owner.name} · ${site.owner.age}岁，当前在${places[site.owner.location]}`);
  expect(body.textContent).toContain(`同一原卡${site.card.id}在四米处原桌，数量${site.card.quantity}，累计实际行程${site.card.travelMetres}米`);
  const spirits = within(body).getByRole('region', { name: '两位原灵的当前余量' });
  for (const spirit of Object.values(site.spirits)) {
    expect(spirits.textContent).toContain(`${spirit.name} · ${spirit.age}岁`);
    expect(spirits.textContent).toContain(`原灵灵性${spirit.spirituality}，完整度${spirit.integrity}/100`);
  }
  expect(body.textContent).not.toMatch(/本人精力|现场精力|playerEnergy/);
  // Old roots retain their evidence but must never replace the current clock.
  if (site.clockSeconds !== state.threeHeadedTemplar.life.clockSeconds) {
    expect(body.textContent).not.toContain(`现场时钟${state.threeHeadedTemplar.life.clockSeconds}秒`);
  }
  if (state.darkAngel.encounter.currentSite && site.clockSeconds !== state.darkAngel.life.site.clockSeconds) {
    expect(body.textContent).not.toContain(`现场时钟${state.darkAngel.life.site.clockSeconds}秒`);
  }
}
function assertRound(state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.darkAngelOutcome;
  if (!outcome) throw new Error('Expected an actual captured Dark Angel round.');
  const reveal = screen.getByRole('dialog', { name: ROUND });
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  expect(reveal.textContent).toContain(round.consequence);
  const record = within(reveal).getByRole('region', { name: RECORD });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  expect(record.textContent).toContain(round.consequenceDomain === 'BODY' ? BODY : round.consequenceDomain === 'MENTAL' ? MENTAL : '本回合没有身体或精神后果盘');
  if (round.consequenceDomain !== 'BODY') expect(record.textContent).not.toContain(BODY);
  if (round.consequenceDomain !== 'MENTAL') expect(record.textContent).not.toContain(MENTAL);
  const actions = [...outcome.playerActions.map(action => ({ ...action, actor: 'PLAYER' as const })),
    ...outcome.enemyActions.map(action => ({ ...action, actor: 'ENEMY' as const }))].sort((a, b) => a.order - b.order);
  const rows = within(within(record).getByRole('list')).getAllByRole('listitem');
  expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    // This is the narrow renderer-only wording change. Captured labels and
    // canonical saved receipts keep their original bytes, including SIGNAL.
    const newSkill = action.actor === 'PLAYER' && (action.id === 'hanged-man.s1.single-spirit-guidance' || action.id === 'hanged-man.s1.single-spirit-shelter');
    const displayLabel = newSkill ? action.label
      .replace('的SIGNAL，实付本人8灵性2精神与原灵3灵性', '的有限信号，实付本人8灵性2精神与原灵3灵性')
      .replace('的BRIEF_WARD，实付本人8灵性2精神与原灵3灵性', '的短暂护持，实付本人8灵性2精神与原灵3灵性')
      .replace('的SCREEN，实付本人8灵性2精神与原灵3灵性', '的有限屏护，实付本人8灵性2精神与原灵3灵性') : action.label;
    expect(rows[index]!.textContent).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：${displayLabel}`);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[index]!.textContent).toContain(`本槽实际经过${action.elapsedSeconds}秒`);
    expect(rows[index]!.textContent).toContain(`本槽封条实耗${action.noteChargePaid}次、磨损${action.noteWearPaid}`);
    expect(rows[index]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}`);
    expect(rows[index]!.textContent).toContain(`对手灵性${action.enemySpiritualityAfter}`);
    if (action.rolls.length > 0) expect(rows[index]!.textContent).toContain(`本槽实际检定骰：${action.rolls.join('、')}`);
    if (action.actor === 'PLAYER' && action.spirit) {
      expect(rows[index]!.textContent).toContain(`实际借用原灵${action.spirit.id === 'THT3-HELENA' ? '赫莲娜' : '罗兰'}`);
      expect(rows[index]!.textContent).toContain(`原灵灵性${action.spirit.spiritualityBefore}→${action.spirit.spiritualityAfter}，完整度${action.spirit.integrity}`);
    }
  });
  expect(within(reveal).queryByRole('region', { name: '长老本回合实际记录' })).toBeNull();
  expect(screen.queryByRole('region', { name: '长老成长' })).toBeNull();
  const nextLabel = state.ending ? '查看收尾卷宗' : state.combat ? '进入下一回合' : '返回生活';
  for (const label of ['查看收尾卷宗', '进入下一回合', '返回生活']) {
    if (label === nextLabel) expect(within(reveal).getByRole('button', { name: label })).toBeTruthy();
    else expect(within(reveal).queryByRole('button', { name: label })).toBeNull();
  }
  assertCurrentBody(state);
}
function openAction(action: DarkAngelAction) {
  const panel = screen.getByRole('region', { name: PANEL });
  const buttons = () => within(panel).queryAllByRole('button', { hidden: true }).filter(button => button.getAttribute('data-action-id') === action.id);
  if (!buttons().length) {
    const picker = within(panel).getByRole('combobox', { name: '暗天使其他操作', hidden: true });
    (picker.closest('details') as HTMLDetailsElement).open = true;
    fireEvent.change(picker, { target: { value: action.id } });
  }
  expect(buttons()).toHaveLength(1);
  const button = buttons()[0]!, fold = button.closest('details'); if (fold) fold.open = true;
  fireEvent.click(button); return screen.getByRole('dialog', { name: CONFIRM });
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

// These tests load a completed long natural campaign without replaying its
// 615-command prefix. Read/reopen cases have 60 seconds; cases that apply and
// validate complete state transitions have 120 seconds. These are explicit
// budgets, not claims of measured performance or evidence that tests ran.
describe('Dark Angel actual natural save, reopen and physical exit UI', () => {
  it('opens the new live combat ahead of the inherited promoted Elder and its old round', async () => {
    const source = capturedSnapshot('combatStart'), boundary = namedBoundary('combat-round-1'); same(source, boundary.before);
    const game = savedGame(source), value = projectSliceState(source); await mount(game);
    expect(source.elder.promotionWeek).toBe(135); expect(value.elder.promoted).toBe(false); expect(value.elder.actions).toEqual([]); expect(value.darkAngel.promoted).toBe(true); expect(value.lastCombatRound?.elderOutcome).toBeTruthy();
    expect(source.combat).toMatchObject({ encounterId: 'DARK_ANGEL_DISPUTE', round: 1, lastRound: null });
    expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    const stage = screen.getByRole('dialog', { name: value.combat!.title! });
    const resources = within(stage).getByRole('region', { name: RESOURCES }), battle = value.combat!.darkAngel!;
    expect(resources.textContent).toContain(`本人健康${value.health}/${value.maxHealth} · 精神${value.mind}/${value.maxMind} · 灵性${value.spirituality}/${value.maxSpirituality}`);
    expect(resources.textContent).toContain(`${battle.enemyName}：健康${battle.enemyHealth}、精神${battle.enemyMind}、灵性${battle.enemySpirituality}`);
    expect(resources.textContent).toContain(`新封条剩余${battle.note!.charges}次，磨损${battle.note!.wear}`);
    expect(within(stage).queryByRole('region', { name: '长老本回合实际资源' })).toBeNull();
    expect(screen.getByRole('region', { name: PANEL })).toBeTruthy(); assertCurrentBody(source);
    const rendered = resources.textContent; await reopen(game);
    expect(screen.getByRole('region', { name: RESOURCES }).textContent).toBe(rendered);
    assertCurrentBody(source); same(projectSliceState(game.state), value); same(game.state, source);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 60_000);

  it('retains committed resources on failure, retries the identical intent once and reopens the actual round', async () => {
    const boundary = namedBoundary('combat-round-1'), before = boundary.before, expected = boundary.final;
    expect(boundary.intent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(expected).toMatchObject({ status: 'ACTIVE', health: 100, mind: 84, spirituality: 115, injuries: [], injuryRisk: 0 });
    expect(expected.lastCombatRound).toMatchObject({ round: 1, winner: 'ENEMY', consequenceDomain: 'MENTAL', consequenceWeights: null,
      playerCount: 3, enemyCount: 2, darkAngelOutcome: { continuing: true, playerSpiritualityAfter: 103 } });
    expect(expected.lastCombatRound!.consequenceRoll).toBeUndefined();
    const game = savedGame(before), value = projectSliceState(before), releaseFailure = game.holdNextSave();
    game.failNextSave(); await mount(game);
    const stage = screen.getByRole('dialog', { name: value.combat!.title! });
    const savedResources = within(stage).getByRole('region', { name: RESOURCES }).textContent;
    const savedBody = screen.getByRole('region', { name: ORIGINALS }).textContent;
    const stance = value.combat!.stances.find(entry => entry.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    const submit = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
    fireEvent.click(submit); fireEvent.click(submit); assertEnvelope(game, before, boundary.intent, 1);
    expect(disabled(submit)).toBe(true); expect(game.attemptedStates).toHaveLength(1); same(game.attemptedStates[0], expected);
    same(game.state, before); expect(game.commits).toBe(0); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    expect(within(stage).getByRole('region', { name: RESOURCES }).textContent).toBe(savedResources);
    expect(screen.getByRole('region', { name: ORIGINALS }).textContent).toBe(savedBody);
    await act(async () => { releaseFailure(); });
    const retry = await within(stage).findByRole('button', { name: '重试这次操作' });
    expect(disabled(submit)).toBe(true); same(game.state, before); expect(game.commits).toBe(0);
    expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull(); assertCurrentBody(before);
    const failedEnvelope = structuredClone(game.submit.mock.calls[0]![0]), releaseSuccess = game.holdNextSave();
    fireEvent.click(retry); fireEvent.click(retry); assertEnvelope(game, before, boundary.intent, 2);
    expect(game.submit.mock.calls[1]![0]).toEqual(failedEnvelope); same(game.state, before);
    await act(async () => { releaseSuccess(); });
    await waitFor(() => expect(game.state.revision).toBe(expected.revision)); await screen.findByRole('dialog', { name: ROUND });
    expect(game.attemptedStates).toHaveLength(2); same(game.attemptedStates[1], expected); same(game.state, expected); expect(game.commits).toBe(1);
    const outcome = game.state.lastCombatRound!.darkAngelOutcome!, actions = [...outcome.playerActions, ...outcome.enemyActions];
    expect(outcome.playerSpiritualityAfter).toBe(before.spirituality - outcome.playerActions.reduce((sum, action) => sum + action.paidCost, 0));
    expect(game.state.spirituality).toBe(outcome.continuing ? Math.min(120, outcome.playerSpiritualityAfter + 12) : outcome.playerSpiritualityAfter);
    expect(game.state.darkAngel.encounter.enemySpirituality).toBe(before.darkAngel.encounter.enemySpirituality - outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0));
    expect(outcome.noteAfter.charges).toBe(before.darkAngel.encounter.note!.charges - actions.reduce((sum, action) => sum + action.noteChargePaid, 0));
    expect(outcome.noteAfter.wear).toBe(before.darkAngel.encounter.note!.wear + actions.reduce((sum, action) => sum + action.noteWearPaid, 0));
    for (const id of ['THT3-HELENA', 'THT3-ROLAND'] as const) {
      expect(outcome.siteAfter.spirits[id].spirituality).toBe(before.darkAngel.encounter.currentSite!.spirits[id].spirituality - outcome.playerActions.filter(action => action.spirit?.id === id).reduce((sum, action) => sum + action.spirit!.spiritCost, 0));
    }
    expect(game.state.combatHistory).toHaveLength(before.combatHistory.length + 1); same(game.state.combatHistory.slice(0, -1), before.combatHistory);
    same(roots(game.state), roots(before)); assertRound(expected);
    const record = screen.getByRole('dialog', { name: ROUND }).textContent, committedPublic = projectSliceState(game.state);
    await reopen(game); assertRound(expected);
    expect(screen.getByRole('dialog', { name: ROUND }).textContent).toBe(record); same(projectSliceState(game.state), committedPublic);
    expect(game.submit).toHaveBeenCalledTimes(2); expect(game.commits).toBe(1); same(game.state, expected);
  }, 120_000);

  it('renders the actual round2 guidance as finite signal without converting its expired window into an application', async () => {
    const source = namedBoundary('combat-round-2').final, game = savedGame(source), value = projectSliceState(source);
    // Deliberately include both the raw token and the complete authored phrase
    // in a custom display name. Localization must be limited to known skill
    // labels, not applied to arbitrary character text or the whole projection.
    const displayName = 'SIGNAL的SIGNAL，实付本人8灵性2精神与原灵3灵性';
    const customNameOnly = (projection: SliceProjection) => {
      projection.character = { ...projection.character, name: displayName };
      projection.darkAngel = { ...projection.darkAngel, characterName: displayName };
    };
    function assertCustomDisplayName() {
      expect(screen.getByRole('banner').textContent).toContain(`${displayName} · ${value.darkAngel.title}`);
      const currentResources = within(screen.getByRole('region', { name: PANEL })).getByRole('region', { name: '暗天使当前资源' });
      expect(within(currentResources).getByText(displayName, { exact: true })).toBeTruthy();
    }
    const outcome = source.lastCombatRound!.darkAngelOutcome!;
    const guidance = outcome.playerActions.find(action => action.id === 'hanged-man.s1.single-spirit-guidance');
    expect(guidance).toMatchObject({ attempted: true, succeeded: true, applied: false, appliedAmount: 0, chargeGranted: true,
      chargeConsumedByOrder: null, paidCost: 8, mindCost: 2, noteChargePaid: 0, masteryApplied: [],
      spirit: { id: 'THT3-ROLAND', method: 'SIGNAL', spiritCost: 3, spiritualityBefore: 18, spiritualityAfter: 15 } });
    expect(guidance!.label).toContain('的SIGNAL，实付本人');
    expect(source.lastCombatRound).toMatchObject({ round: 2, winner: 'PLAYER', consequenceDomain: 'BODY', consequenceRoll: 34 });
    expect(source.progression.mastery['hanged-man.s1.single-spirit-guidance']).toBe(8);
    expect(outcome.noteAfter).toMatchObject({ charges: 3, wear: 0 });
    await mount(game, customNameOnly); assertRound(source); assertCustomDisplayName();
    const record = within(screen.getByRole('dialog', { name: ROUND })).getByRole('region', { name: RECORD });
    const row = within(record).getAllByRole('listitem').find(item => item.textContent?.includes('单灵引导只用当前选定'));
    expect(row).toBeDefined();
    expect(row!.textContent).toContain('的有限信号，实付本人');
    expect(row!.textContent).toContain('第5动作令窗口失效，费用不退');
    expect(row!.textContent).toContain('有限效果实际应用0');
    expect(row!.textContent).toContain('原灵灵性18→15，完整度100');
    expect(record.textContent).not.toMatch(/\bSIGNAL\b/);
    const rendered = record.textContent; await reopen(game, customNameOnly); assertRound(source); assertCustomDisplayName();
    expect(screen.getByRole('region', { name: RECORD }).textContent).toBe(rendered);
    same(projectSliceState(game.state), value); same(game.state, source); expect(guidance!.label).toContain('的SIGNAL，实付本人');
    expect(game.state.character.name).toBe(source.character.name); expect(game.state.character.name).not.toBe(displayName);
    expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 60_000);

  it('does not replace physical cleanup with navigation and reopens only the actual saved ordinary exit', async () => {
    const boundary = namedBoundary('guided-reading-leave'), before = boundary.before, expected = boundary.final;
    expect(boundary.intent).toEqual({ type: 'DARK_ANGEL', command: { type: 'LEAVE', caseId: 'guided-reading' } });
    const game = savedGame(before), loadRun = await mount(game);
    expect(projectSliceState(before).darkAngel.insideCase).toBe(true);
    expect(before.darkAngel.life.site).toMatchObject({ playerLocation: 'START', owner: { location: 'START' }, card: { location: 'TABLE' } });
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); assertCurrentBody(before);
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '返回主菜单' }));
    await chooseSavedRun(game); expect(loadRun).toHaveBeenCalledTimes(2);
    assertCurrentBody(before); same(game.state, before); expect(game.submit).not.toHaveBeenCalled();
    const action = projectSliceState(before).darkAngel.actions.find(entry => entry.enabled && entry.command.type === 'LEAVE' && entry.command.caseId === 'guided-reading');
    if (!action) throw new Error('The actual captured ordinary exit is not publicly offered.');
    const dialog = openAction(action);
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(screen.queryByRole('dialog', { name: CONFIRM })).toBeNull(); same(game.state, before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(openAction(action)).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state.revision).toBe(expected.revision)); assertEnvelope(game, before, boundary.intent, 1);
    same(game.state, expected); expect(game.commits).toBe(1); expect(expected.status).toBe('ACTIVE'); expect(expected.ending).toBeNull();
    expect(projectSliceState(expected).darkAngel.insideCase).toBe(false);
    expect(expected.darkAngel.life.site.owner.location).toBe('OUTSIDE');
    expect(expected.darkAngel.life.site.clockSeconds).toBe(before.darkAngel.life.site.clockSeconds + 2);
    expect(expected.darkAngel.life.site.playerTravelMetres).toBe(before.darkAngel.life.site.playerTravelMetres);
    same(expected.darkAngel.life.site.spirits, before.darkAngel.life.site.spirits);
    same(expected.darkAngel.life.strips, before.darkAngel.life.strips); same(roots(expected), roots(before));
    const committedPublic = projectSliceState(game.state); await reopen(game);
    await userEvent.click(screen.getByRole('button', { name: '暗天使与原封存院' }));
    await screen.findByRole('region', { name: PANEL }); assertCurrentBody(expected);
    expect(screen.getByRole('button', { name: '返回普通生活' })).toBeTruthy();
    same(projectSliceState(game.state), committedPublic); expect(game.submit).toHaveBeenCalledTimes(1); expect(game.commits).toBe(1);
  }, 120_000);

  it('reopens the real enemy surrender and four-metre exit, then saves the captured ordinary work and living continuation', async () => {
    const source = capturedSnapshot('combatTerminal'), terminalBoundary = namedBoundary('combat-round-3');
    const exitBoundary = namedBoundary('actual-ordinary-encounter-exit'), work = namedBoundary('actual-work-after-living-exit');
    same(source, terminalBoundary.final); same(source, exitBoundary.final); same(source, work.before);
    expect(work.intent).toEqual({ type: 'ACTION', action: 'WORK' });
    expect(source).toMatchObject({ status: 'ACTIVE', health: 100, mind: 82, spirituality: 104, injuries: [], injuryRisk: 0, combat: null, ending: null });
    expect(source.darkAngel.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 3,
      enemyHealth: 60, enemyMind: 100, enemySpirituality: 95, exitMetres: 4, exitSeconds: 4 });
    expect(source.lastCombatRound).toMatchObject({ round: 3, winner: 'PLAYER', consequenceDomain: 'BODY', consequenceRoll: 82,
      consequenceWeights: { light: 55, heavy: 30, death: 15 } });
    const outcome = source.lastCombatRound!.darkAngelOutcome!, site = source.darkAngel.encounter.currentSite!;
    expect(site.playerLocation).toBe('START'); expect(site.playerTravelMetres).toBe(outcome.siteAfter.playerTravelMetres + 4);
    expect(site.clockSeconds).toBe(outcome.clockSecondsAfter + 4); expect(site.owner.location).toBe('OUTSIDE');
    expect(source.darkAngel.encounter).toMatchObject({ enemyStatus: 'SURRENDERED', weaponLocation: 'YARD' });
    same(site.spirits, outcome.siteAfter.spirits); same(source.darkAngel.encounter.note, outcome.noteAfter);
    const game = savedGame(source); await mount(game); assertRound(source);
    fireEvent.keyDown(screen.getByRole('dialog', { name: ROUND }), { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: ROUND })).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: '快速显示本回合结果' }));
    assertRound(source); same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
    const originalRecord = screen.getByRole('dialog', { name: ROUND }).textContent;
    await reopen(game); assertRound(source);
    expect(screen.getByRole('dialog', { name: ROUND }).textContent).toBe(originalRecord);
    await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '返回生活' }));
    expect(screen.queryByText('只读封存卷宗')).toBeNull();
    const ordinary = await screen.findByRole('group', { name: '四个主要行动' });
    const workButton = within(ordinary).getByRole('button', { name: /^工作，1行动/ }); expect(disabled(workButton)).toBe(false);
    await userEvent.click(workButton);
    await waitFor(() => expect(game.state.revision).toBe(work.final.revision)); assertEnvelope(game, source, work.intent, 1);
    same(game.state, work.final); expect(game.commits).toBe(1);
    expect(game.state).toMatchObject({ status: 'ACTIVE', revision: 825, week: 197, health: 100, mind: 82,
      spirituality: 104, cash: 548, actionsRemaining: 3, injuries: [], injuryRisk: 0, ending: null });
    same(game.state.darkAngel.encounter, source.darkAngel.encounter); same(roots(game.state), roots(source));
    const committedPublic = projectSliceState(game.state); await reopen(game); assertRound(game.state);
    same(projectSliceState(game.state), committedPublic);
    await userEvent.click(within(screen.getByRole('dialog', { name: ROUND })).getByRole('button', { name: '返回生活' }));
    expect(projectSliceState(game.state).canAct).toBe(true);
    expect(disabled(within(screen.getByRole('group', { name: '四个主要行动' })).getByRole('button', { name: /^工作，1行动/ }))).toBe(false);
    expect(game.submit).toHaveBeenCalledTimes(1); expect(game.commits).toBe(1); same(game.state, work.final);
  }, 120_000);

  it('keeps the existing actual Knowledge Emperor death read-only without fabricating a Dark Angel death', async () => {
    // This new campaign survived. Death gating is a regression against the
    // separately captured, immutable stage200 natural death, never a mutated
    // Dark Angel projection or a newly claimed stage201 death result.
    const source = knowledgeSnapshot('actualTerminal'), game = savedGame(source);
    expect(source).toMatchObject({ status: 'DEAD', health: 0, ending: { kind: 'DEATH' } });
    expect(source.darkAngel.promotionWeek).toBeNull();
    expect(source.knowledgeEmperor.encounter.terminal).toMatchObject({ outcome: 'PLAYER_DEAD', exitMetres: 0, exitSeconds: 0 });
    expect(source.knowledgeEmperor.encounter.currentSite!.playerLocation).toBe('YARD');
    await mount(game);
    const reveal = screen.getByRole('dialog', { name: ROUND });
    expect(within(reveal).getByRole('region', { name: '知识皇帝本回合实际记录' })).toBeTruthy();
    expect(within(reveal).queryByRole('region', { name: RECORD })).toBeNull();
    for (const name of ['进入下一回合', '返回生活', '确认姿态，结算完整回合']) expect(within(reveal).queryByRole('button', { name })).toBeNull();
    fireEvent.keyDown(reveal, { key: 'Escape' }); expect(screen.getByRole('dialog', { name: ROUND })).toBeTruthy();
    await userEvent.click(screen.getByRole('checkbox', { name: '快速显示本回合结果' }));
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
    await screen.findByRole('heading', { name: source.ending!.title });
    expect(screen.getByText('只读封存卷宗')).toBeTruthy(); expect(screen.queryByRole('dialog', { name: ROUND })).toBeNull();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
    expect(screen.queryByRole('group', { name: '四个主要行动' })).toBeNull();
    expect(screen.queryByRole('button', { name: '暗天使与原封存院' })).toBeNull();
    expect(projectSliceState(game.state).canAct).toBe(false);
    await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '返回标题' }));
    expect(disabled(await screen.findByRole('button', { name: /继续游戏/ }))).toBe(true);
    expect(disabled(screen.getByRole('button', { name: /查看封存/ }))).toBe(false);
    await reopen(game);
    expect(within(screen.getByRole('dialog', { name: ROUND })).queryByRole('button', { name: '返回生活' })).toBeNull();
    same(game.state, source); expect(game.submit).not.toHaveBeenCalled(); expect(game.commits).toBe(0);
  }, 60_000);
});
