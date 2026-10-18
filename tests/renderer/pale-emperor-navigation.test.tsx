/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { stableStringify } from '../../src/domain/canonical';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format';
import { readObjectEntry } from '../helpers/read-object-entry';

const ROOT = 'tests/fixtures/pale-emperor-v01950';
const PANEL = '苍白皇帝成长', ENTRY = '苍白皇帝与当代附廊';
const QUIETING = 'death.s1.residual-quieting', INTERDICTION = 'death.s1.spiritual-interdiction';
const EDITORIAL = /候选|原创G|本作G|原文未核|编号推断|来源未知|\"command\"|\"beforeLast\"/;
const natural = (key: string) => migrateSliceState(readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
function boundary(name: string) {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual Pale Emperor boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
}
function snapshot(name: string) {
  const snapshots = readObjectEntry<Record<string, string>>(`${ROOT}/natural.json`, 'snapshots');
  if (!snapshots[name]) throw new Error(`Missing actual Pale Emperor snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${snapshots[name]}`, 'utf8')));
}

/** Reopen the actual producer save, then apply only the captured single public
 * intent. The bridge owns persisted state: a failed save changes neither state
 * nor resources. No campaign replay, edited body, substitute originals or RNG search. */
function savedGame(input: unknown, failFirst = false) {
  let state = migrateSliceState(input), commits = 0;
  assertValidSliceState(state);
  expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
  const submit = vi.fn<SliceBridge['submitIntent']>().mockImplementation(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The actual campaign already exists.');
    expect(envelope.runId).toBe(state.runId);
    expect(envelope.expectedRevision).toBe(state.revision);
    if (failFirst) {
      failFirst = false;
      return { ok: false, error: { code: 'SAVE_FAILED', message: '本次保存失败，请重试同一次操作。', retryable: true } };
    }
    const next = applySliceIntent(state, envelope.payload);
    assertValidSliceState(next);
    state = next; commits++;
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId,
      previousRevision: envelope.expectedRevision, newRevision: state.revision,
      committedAt: '2026-10-15T17:30:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, get commits() { return commits; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>().mockImplementation(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>().mockImplementation(async () => ({ ok: true, value: {
      mode: 'desktop', activeState: state, runs: [{ runId: state.runId, name: state.character.name,
        portraitId: state.character.portraitId, week: state.week, date: state.date, status: state.status,
        revision: state.revision, updatedAt: '2026-10-15T17:29:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('region', { name: '当前时代生活' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
  assertAuthoredCopy(game.state);
}
async function reopen(game: SavedGame) { cleanup(); await mount(game); }
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function ensurePanel() {
  await acknowledgeRound();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function assertAuthoredCopy(state: SliceState) {
  expect(document.body.textContent!.split(state.character.name).join('')).not.toMatch(EDITORIAL);
}
function assertResources(state: SliceState) {
  const projected = projectSliceState(state), resources = screen.getByRole('region', { name: '苍白皇帝当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${projected.paleEmperor.title}`);
  expect(resources.textContent).toContain(`健康${projected.health}/${projected.maxHealth} · 精神${projected.mind}/${projected.maxMind} · 灵性${projected.spirituality}/${projected.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${state.actionsRemaining} · 现有伤势${state.injuries.length}处 · 累计风险${state.injuryRisk}`);
  expect(resources.textContent).toContain(projected.paleEmperor.resources!.cash);
}
function assertCurrentEra(state: SliceState) {
  const current = projectSliceState(state), era = screen.getByRole('region', { name: '当前时代生活' });
  expect(state.week).toBeGreaterThanOrEqual(3290);
  expect(state.date.year).toBeGreaterThanOrEqual(1412);
  expect(era.textContent).toContain(current.ferryman.era.current);
  expect(era.textContent).toContain(`当前实际地点：${current.ferryman.era.location}`);
  expect(era.textContent).toContain(current.ferryman.era.economy);
  expect(screen.getByRole('banner').textContent).toContain(`${state.date.year}年`);
  expect(screen.queryByText('贝克兰德 · 东区')).toBeNull();
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count = 1) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId,
    expectedRevision: before.revision, payload: intent });
}
async function capturedControl(state: SliceState, intent: SliceIntent) {
  if (intent.type !== 'PALE_EMPEROR') throw new Error('Expected a captured public Pale Emperor intent.');
  const action = projectSliceState(state).paleEmperor.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  const suffix = 'permission' in intent.command
    ? `：${intent.command.permission === 'CUSTODIAN' ? '诺拉本次保管参与' : '本人本次使用能力'}`
    : intent.command.type === 'INVITE' ? `：${intent.command.method === 'ORDINARY' ? '普通处理' : '尝试有限能力'}` : '';
  const label = action!.label + suffix;
  let button = screen.queryByRole('button', { name: name => name.startsWith(label) });
  if (!button) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '苍白皇帝其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(label) });
  }
  return button;
}
async function confirmCaptured(game: SavedGame, save: ReturnType<typeof boundary>, previousCalls = 0) {
  expect(game.state).toEqual(save.before);
  await userEvent.click(await capturedControl(save.before, save.intent));
  expect(game.submit).toHaveBeenCalledTimes(previousCalls);
  const dialog = screen.getByRole('dialog', { name: '苍白皇帝操作确认' });
  const confirm = within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
  fireEvent.click(confirm); fireEvent.click(confirm);
}
async function commitCaptured(game: SavedGame, save: ReturnType<typeof boundary>, count = 1) {
  await confirmCaptured(game, save, count - 1);
  await waitFor(() => expect(game.state.revision).toBe(save.final.revision));
  expect(game.state).toEqual(save.final); assertEnvelope(game, save.before, save.intent, count);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '苍白皇帝操作确认' })).toBeNull());
  assertAuthoredCopy(game.state);
}
function assertLifeFacts(state: SliceState) {
  const life = state.paleEmperor.life, attempt = life.activeCase ? life.cases[life.activeCase].attempts.at(-1) : null;
  const originals = screen.getByRole('region', { name: '附室当前人物与原物' });
  expect(originals.textContent).toContain(`精力${life.nora!.energy}/100`);
  expect(originals.textContent).toContain(`本人在${life.playerLocation === 'RECEPTION' ? '当代接待处' : life.playerLocation === 'NEAR' ? '近台' : '远台'}，累计实走${life.playerTravelMetres}米`);
  expect(originals.textContent).toContain(`擦痕${life.site!.vessel.scuffs}处；累计实搬${life.site!.vessel.travelledMetres}米`);
  expect(originals.textContent).toContain(`实际借用${life.site!.loan.grants}次，实际归还${life.site!.loan.returns}次`);
  if (attempt) {
    const costs = screen.getByRole('region', { name: '本次许可与实际代价' });
    expect(costs.textContent).toContain(`本次已经消耗${attempt.spiritualitySpent}灵性、${attempt.mindSpent}精神、诺拉${attempt.noraEnergySpent}精力`);
    expect(costs.textContent).toContain(`本人实走${attempt.playerTravelMetres}米，诺拉实走${attempt.noraTravelMetres}米，原容器实搬${attempt.vesselTravelMetres}米，经过${attempt.elapsedSeconds}秒`);
  }
}
function assertRound(reveal: HTMLElement, state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!, outcome = round.paleEmperorOutcome;
  if (!outcome) throw new Error('Expected an actual saved Pale Emperor round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  const record = within(reveal).getByRole('region', { name: '苍白皇帝本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, i) => {
    expect(rows[i]!.textContent).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：${action.label}`);
    expect(rows[i]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[i]!.textContent).toContain(`本槽原灵印消耗${action.spiritMarksSpent}；普通移动${action.travelMetres}米`);
    if (action.finiteResult === 'PENDING') expect(rows[i]!.textContent).toContain('当前只是建立有限窗口，尚未对后续动作生效');
    if (action.finiteResult === 'APPLIED') expect(rows[i]!.textContent).toContain('有限窗口已经在这个实际动作中消耗');
  });
  expect(record.textContent).toContain(round.consequenceDomain === 'BODY' ? '本回合按实际身体冲击结算伤势'
    : round.consequenceDomain === 'MENTAL' ? '本回合按实际精神压力结算，不生成身体伤口' : '本回合没有身体或精神后果盘');
  if (round.consequenceDomain !== 'BODY') expect(reveal.textContent).not.toContain('败者后果盘：轻伤');
  assertAuthoredCopy(state);
}

const showModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => {
  // Release each mock implementation's large private save after the test.
  cleanup(); delete window.sliceGame; vi.resetAllMocks(); vi.restoreAllMocks();
  if (showModal) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', showModal); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
  if (close) Object.defineProperty(HTMLDialogElement.prototype, 'close', close); else Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

describe('Pale Emperor actual saved campaign navigation and reopening', () => {
  it('reopens the injured original departure in the actual later era without resetting its body or old history', async () => {
    const state = snapshot('departure'), game = savedGame(state);
    expect(state).toMatchObject({ revision: 816, week: 3290, date: { year: 1412, month: 7, day: 15 },
      status: 'ACTIVE', health: 20, mind: 100, spirituality: 95, cash: 34, actionsRemaining: 1, injuryRisk: 6,
      progression: { pathwayId: 'death', sequence: 2, acting: 100 } });
    expect(state.injuries.map(injury => injury.severity)).toEqual(['HEAVY', 'LIGHT', 'LIGHT', 'HEAVY']);
    expect(state.injuries.every(injury => injury.treatedRevision === null)).toBe(true);
    expect(state.deathConsul.encounter).toMatchObject({ status: 'RETREATED', targetId: 'DC2-P-NOLAN',
      enemyHealth: 80, enemyMind: 100, enemySpirituality: 46, enemyStatus: 'RESISTING' });
    await mount(game); await acknowledgeRound(); assertCurrentEra(state);
    await ensurePanel(); assertResources(state);
    expect(screen.getByRole('region', { name: '苍白皇帝服药准备' })).toBeTruthy();
    expect(projectSliceState(state).paleEmperor).toMatchObject({ promoted: false, formulaKnown: false, formula: [] });
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    assertCurrentEra(state);
    expect(game.state).toEqual(state); expect(game.submit).not.toHaveBeenCalled();
  }, 120_000);

  it('reopens real S1 growth, keeps old S2 read-only and returns through the current-era page without replaying the old round', async () => {
    const state = snapshot('promoted'), game = savedGame(state);
    expect(state).toMatchObject({ revision: 961, week: 3317, date: { year: 1413, month: 1, day: 20 },
      status: 'ACTIVE', health: 100, mind: 85, spirituality: 120, cash: 18, actionsRemaining: 2,
      progression: { pathwayId: 'death', sequence: 1, acting: 0 }, injuries: [], injuryRisk: 0 });
    expect(state.paleEmperor.bottles.map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'SUCCESS']);
    expect(state.paleEmperor.bottles.every(bottle => bottle.status === 'CONSUMED')).toBe(true);
    expect(state.character).toMatchObject({ name: '伊莲', age: 26, gender: 'FEMALE',
      coreStats: { physique: 33, perception: 29, will: 27, knowledge: 23 } });
    expect(state.lastCombatRound?.deathConsulOutcome).toBeTruthy();
    await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    assertCurrentEra(state);
    const panel = await ensurePanel(); assertResources(state);
    expect(screen.queryByRole('region', { name: '死亡执政官' })).toBeNull();
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(state).paleEmperor.abilities;
    expect(abilities).toHaveLength(19);
    expect(abilities.slice(0, 17).filter(ability => ability.mastery === 0)).toHaveLength(5);
    expect(abilities.slice(17).map(ability => [ability.id, ability.mastery])).toEqual([[QUIETING, 0], [INTERDICTION, 0]]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    assertCurrentEra(state);
    await userEvent.click(screen.getByRole('button', { name: '死亡执政官与封存室' }));
    const old = await screen.findByRole('region', { name: '死亡执政官' });
    expect(projectSliceState(state).deathConsul.actions).toEqual([]);
    expect(within(old).getByRole('region', { name: '死亡执政官当前行动' }).querySelector('button')).toBeNull();
    await userEvent.click(within(old).getByText('封存场的可选冲突', { selector: 'summary' }));
    const oldEncounter = within(old).getByRole('region', { name: '死亡执政官可选遭遇' });
    expect(oldEncounter.textContent).toContain('诺兰·艾文');
    expect(oldEncounter.textContent).toContain('健康80/100、精神100/100、独立灵性46/120');
    expect(within(oldEncounter).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: '确认姿态，结算完整回合' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭死亡执政官页面' }));
    assertCurrentEra(state); await ensurePanel(); assertResources(state);
    await reopen(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await ensurePanel(); assertResources(state);
    expect(game.state.deathConsul).toEqual(state.deathConsul);
    expect(game.state.longChapter).toEqual(state.longChapter);
    expect(game.state).toEqual(state); expect(game.submit).not.toHaveBeenCalled();
  }, 120_000);

  it('cancels without intent, keeps failed-save UI authoritative and retries the same real failed quieting cast exactly once', async () => {
    const save = boundary('quiet-lid-one-paid-window-attempt'), game = savedGame(save.before, true);
    await mount(game); assertResources(save.before); assertLifeFacts(save.before);
    const resourceText = screen.getByRole('region', { name: '苍白皇帝当前资源' }).textContent;
    await userEvent.click(await capturedControl(save.before, save.intent));
    const dialog = screen.getByRole('dialog', { name: '苍白皇帝操作确认' });
    expect(dialog.textContent).toContain('本次消耗8灵性、2精神');
    expect(dialog.textContent).toContain('随后必须另行亲手合盖');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(game.submit).not.toHaveBeenCalled(); expect(game.state).toEqual(save.before);
    await confirmCaptured(game, save);
    await screen.findByRole('button', { name: '重试这次操作' });
    assertEnvelope(game, save.before, save.intent);
    expect(game.commits).toBe(0); expect(game.state).toEqual(save.before);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '苍白皇帝操作确认' })).toBeNull());
    expect(screen.getByRole('region', { name: '苍白皇帝当前资源' }).textContent).toBe(resourceText);
    expect(screen.getAllByRole('alert').some(alert => alert.textContent?.includes('当前进度保持不变'))).toBe(true);
    expect((screen.getByRole('combobox', { name: '苍白皇帝目标' }) as HTMLSelectElement).disabled).toBe(true);
    for (const button of within(screen.getByRole('region', { name: PANEL })).queryAllByRole('button'))
      expect((button as HTMLButtonElement).disabled).toBe(true);
    const firstEnvelope = game.submit.mock.calls[0]![0];
    const retry = screen.getByRole('button', { name: '重试这次操作' });
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(game.state.revision).toBe(save.final.revision));
    expect(game.state).toEqual(save.final);
    expect(game.submit).toHaveBeenCalledTimes(2); expect(game.submit.mock.calls[1]![0]).toEqual(firstEnvelope);
    expect(game.commits).toBe(1);
    await reopen(game); assertResources(save.final); assertLifeFacts(save.final);
    expect(game.state).toMatchObject({ revision: 975, week: 3318, health: 100, mind: 98, spirituality: 112,
      cash: 8, actionsRemaining: 0 });
    expect(game.state.paleEmperor.life.pending).toBeNull();
    expect(game.state.paleEmperor.life.cases['quiet-lid'].attempts[0]!.quieting)
      .toMatchObject({ attempts: 1, successes: 0, effects: 0, tier: 'FAILURE', state: 'FAILED' });
    expect(game.state.paleEmperor.life.site).toEqual(save.before.paleEmperor.life.site);
    expect(game.state.paleEmperor.life.nora).toEqual(save.before.paleEmperor.life.nora);
    expect(game.state.progression.mastery[QUIETING]).toBe(0);
    expect(screen.getByRole('region', { name: '两项残响能力的有限窗口' }).textContent)
      .toContain('残响安定：判定失败 · 尝试1次 · 成功开窗0次 · 实际应用0次');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
  }, 120_000);

  it('reopens the separate actual failed interdiction attempt with its paid costs and original four-metre line unchanged', async () => {
    const save = boundary('guarded-carry-one-paid-window-attempt'), game = savedGame(save.before);
    await mount(game); assertResources(save.before); assertLifeFacts(save.before);
    await commitCaptured(game, save); await reopen(game);
    assertResources(save.final); assertLifeFacts(save.final);
    expect(game.state).toMatchObject({ revision: 994, week: 3320, health: 100, mind: 98, spirituality: 113,
      cash: 14, actionsRemaining: 2 });
    expect(game.state.paleEmperor.life.pending).toBeNull();
    expect(game.state.paleEmperor.life.cases['guarded-carry'].attempts[0]!.interdiction)
      .toMatchObject({ attempts: 1, successes: 0, effects: 0, tier: 'FAILURE', state: 'FAILED' });
    expect(game.state.paleEmperor.life.site).toEqual(save.before.paleEmperor.life.site);
    expect(game.state.paleEmperor.life.nora).toEqual(save.before.paleEmperor.life.nora);
    expect(game.state.paleEmperor.life.playerLocation).toBe('NEAR');
    expect(game.state.paleEmperor.life.playerTravelMetres).toBe(36);
    expect(game.state.progression.mastery[INTERDICTION]).toBe(0);
    expect(screen.getByRole('region', { name: '两项残响能力的有限窗口' }).textContent)
      .toContain('灵迹阻隔：判定失败 · 尝试1次 · 成功开窗0次 · 实际应用0次');
    expect(game.state).toEqual(save.final); expect(game.commits).toBe(1);
  }, 120_000);

  it('persists current withdrawal and the distinct ordinary return, retaining paid costs, actual positions and exhausted seals', async () => {
    const withdrawal = boundary('withdrawn-return-actual-current-withdrawal-no-refund');
    const manual = boundary('withdrawn-return-screened-same-vessel4m-return-no-new-seal');
    const game = savedGame(withdrawal.before); await mount(game); assertLifeFacts(withdrawal.before);
    await commitCaptured(game, withdrawal); await reopen(game);
    assertResources(withdrawal.final); assertLifeFacts(withdrawal.final);
    expect(screen.getByRole('region', { name: '本次许可与实际代价' }).textContent).toContain('保管参与：已经撤回；本人施术：当前明确同意');
    expect(game.state.paleEmperor.life.pending).toBeNull();
    expect(game.state.paleEmperor.life.site).toEqual(withdrawal.before.paleEmperor.life.site);
    expect(game.state.paleEmperor.life.nora).toEqual(withdrawal.before.paleEmperor.life.nora);
    expect(game.state.paleEmperor.life.playerLocation).toBe('FAR');
    expect(game.state.paleEmperor.life.cases['withdrawn-return'].attempts[0]!.interdiction.state).toBe('FAILED');
    await commitCaptured(game, manual, 2); await reopen(game);
    assertResources(manual.final); assertLifeFacts(manual.final);
    expect(game.state).toMatchObject({ revision: 1014, week: 3321, health: 100, mind: 98, spirituality: 113,
      cash: 20, actionsRemaining: 0 });
    expect(game.state.paleEmperor.life).toMatchObject({ playerLocation: 'NEAR', playerTravelMetres: 76, clockSeconds: 205,
      nora: { location: 'FAR', energy: 84, travelMetres: 32 },
      site: { vessel: { id: 'PE1-VESSEL-1', holder: 'PLAYER', location: 'NEAR', lid: 'CLOSED', seal: 'BROKEN', scuffs: 5, travelledMetres: 8 } } });
    expect(game.state.paleEmperor.life.cases['withdrawn-return'].attempts[0]).toMatchObject({ result: 'ORDINARY',
      manualReturned: true, loanReturned: false, spiritualitySpent: 7, mindSpent: 2, elapsedSeconds: 45,
      permission: { custodian: 'WITHDRAWN', ability: 'GRANTED' } });
    expect(game.state.paleEmperor.life.site!.seals).toEqual(withdrawal.before.paleEmperor.life.site!.seals);
    expect(game.state.paleEmperor.life.site!.seals.map(seal => seal.state)).toEqual(['USED', 'USED']);
    expect(game.state.progression.mastery).toEqual(withdrawal.before.progression.mastery);
    expect(game.state.deathConsul).toEqual(withdrawal.before.deathConsul);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(game.state).toEqual(manual.final); expect(game.commits).toBe(2);
  }, 120_000);

  it('reopens all three honest ordinary reports without inventing successful windows or application mastery', async () => {
    const state = snapshot('practiced'), game = savedGame(state); await mount(game); await ensurePanel();
    assertResources(state);
    expect(screen.getByRole('region', { name: '苍白皇帝阶段总览' }).textContent)
      .toContain('生活报告3/3 · 反思已完成 · 苍白皇帝扮演100/100');
    for (const id of ['quiet-lid', 'guarded-carry', 'withdrawn-return'] as const) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '苍白皇帝目标' }), id);
      const entry = state.paleEmperor.life.cases[id];
      expect(entry).toMatchObject({ status: 'RESOLVED', result: 'ORDINARY', returned: true, contactOpen: false });
      expect(entry.attempts).toHaveLength(1); expect(entry.attempts[0]).toMatchObject({ closed: true, loanReturned: true });
      expect(screen.getByRole('region', { name: '本次许可与实际代价' }).textContent).toContain('本次同一原物已归还。本次人员已实际离场。');
      const use = id === 'quiet-lid' ? entry.attempts[0]!.quieting : entry.attempts[0]!.interdiction;
      expect(use).toMatchObject({ attempts: 1, successes: 0, effects: 0, state: 'FAILED' });
      expect(screen.getByRole('region', { name: '两项残响能力的有限窗口' }).textContent).toContain('成功开窗0次 · 实际应用0次');
    }
    assertLifeFacts(state);
    expect(state.paleEmperor.life).toMatchObject({ activeCase: null, pending: null, reflected: true,
      playerLocation: 'RECEPTION', playerTravelMetres: 88, clockSeconds: 231,
      nora: { present: false, location: 'AWAY', energy: 80, travelMetres: 40 },
      site: { loan: { grants: 3, returns: 3 }, vessel: { holder: 'ANNEX', agitation: 2, scuffs: 5, travelledMetres: 8 } } });
    expect([state.progression.mastery[QUIETING], state.progression.mastery[INTERDICTION]]).toEqual([0, 0]);
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' })); assertCurrentEra(state);
    expect(game.state).toEqual(state); expect(game.submit).not.toHaveBeenCalled();
  }, 120_000);

  it('gives the actual new battle priority over the old S2 round and current-era page on full reopening', async () => {
    const state = snapshot('combatStart'), game = savedGame(state), battle = projectSliceState(state).combat!;
    expect(state.combat).toMatchObject({ encounterId: 'PALE_EMPEROR_DISPUTE', round: 1, lastRound: null });
    expect(state.lastCombatRound?.deathConsulOutcome).toBeTruthy();
    expect(battle.paleEmperor).toMatchObject({ targetId: 'PE1-ALDEN-WARD', policy: 'ALL',
      enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    await mount(game);
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.queryByRole('region', { name: '当前时代生活' })).toBeNull();
    expect(screen.queryByRole('region', { name: '死亡执政官' })).toBeNull();
    const resources = within(stage).getByRole('region', { name: '苍白皇帝本回合实际资源' });
    expect(resources.textContent).toContain(`${battle.paleEmperor!.enemyName}：健康100、精神100、灵性120`);
    expect(resources.textContent).toContain('原灵印3');
    expect(resources.textContent).toContain('旧年代的原灵和器物没有搬入本场');
    expect(within(stage).queryByRole('region', { name: '死亡执政官本回合实际资源' })).toBeNull();
    await reopen(game);
    expect(await screen.findByRole('dialog', { name: battle.title! })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(game.state).toEqual(state); expect(game.submit).not.toHaveBeenCalled();
  }, 120_000);

  it('reopens the real twelfth-round enemy death and sixteen-metre living exit, then saves only the captured current-era work', async () => {
    const save = boundary('actual-current-era-paid-work-after-living16m-exit'), game = savedGame(save.before);
    expect(save.before).toEqual(snapshot('combatTerminal'));
    expect(save.before).toMatchObject({ status: 'ACTIVE', revision: 1038, week: 3323, health: 50,
      mind: 100, spirituality: 120, cash: 12, actionsRemaining: 2, injuryRisk: 2, combat: null, ending: null });
    expect(save.before.lastCombatRound).toMatchObject({ round: 12, stance: 'CONTROL', first: 'ENEMY',
      playerCount: 2, enemyCount: 3, consequenceDomain: 'BODY', consequenceRoll: 88, winner: 'PLAYER' });
    expect(save.before.paleEmperor.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 0,
      enemyMind: 100, enemySpirituality: 72, enemyStatus: 'DEAD', weaponLocation: 'FORECOURT',
      terminal: { outcome: 'ENEMY_DEAD', round: 12, exitMetres: 4, exitSeconds: 4, roadExitMetres: 12, roadExitSeconds: 12 } });
    await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.before);
    await acknowledgeRound();
    expect(screen.queryByText('只读封存卷宗')).toBeNull();
    expect(screen.queryByRole('button', { name: '确认姿态，结算完整回合' })).toBeNull();
    if (screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    assertCurrentEra(save.before);
    expect(save.intent).toEqual({ type: 'FERRYMAN', command: { type: 'ERA_WORK' } });
    const work = projectSliceState(save.before).ferryman.actions.find(action => action.command.type === 'ERA_WORK')!;
    expect(work.enabled).toBe(true);
    const button = within(screen.getByRole('region', { name: '当前时代生活' })).getByRole('button', { name: name => name.startsWith(work.label) });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(game.state.revision).toBe(save.final.revision));
    expect(game.state).toEqual(save.final); assertEnvelope(game, save.before, save.intent);
    expect(game.state).toMatchObject({ status: 'ACTIVE', revision: 1039, week: 3323,
      date: { year: 1413, month: 3, day: 3 }, health: 50, mind: 100, spirituality: 120,
      cash: 36, actionsRemaining: 1, injuryRisk: 2, random: { cursor: 490 }, combat: null, ending: null });
    expect(game.state.injuries.map(injury => [injury.severity, injury.treatedRevision])).toEqual([['HEAVY', null], ['LIGHT', null], ['LIGHT', null]]);
    expect(game.state.paleEmperor.encounter).toEqual(save.before.paleEmperor.encounter);
    expect(game.state.deathConsul).toEqual(save.before.deathConsul);
    expect(game.state.longChapter).toEqual(save.before.longChapter);
    expect(game.state).toEqual(natural('final'));
    expect(readObjectEntry<SliceIntent[]>(`${ROOT}/natural.json`, 'commands')).toHaveLength(1038);
    await reopen(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), game.state);
    await acknowledgeRound(); await ensurePanel(); assertResources(game.state);
    const encounter = screen.getByRole('region', { name: '苍白皇帝可选真实交战' });
    expect(encounter.textContent).toContain('健康0/100、精神100/100、灵性72/120 · 已死亡');
    expect(encounter.textContent).toContain('落在前庭地面');
    expect(encounter.textContent).toContain('原灵印剩余3/3枚，已经耗尽0枚');
    expect(projectSliceState(game.state).paleEmperor.actions.some(action => action.command.type === 'ENCOUNTER_FIGHT' && action.enabled)).toBe(false);
    expect([game.state.progression.mastery[QUIETING], game.state.progression.mastery[INTERDICTION]]).toEqual([0, 0]);
    expect(game.state).toEqual(save.final); expect(game.commits).toBe(1);
  }, 120_000);
});
