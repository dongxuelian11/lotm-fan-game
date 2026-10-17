/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceCombatRound, SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { stableStringify } from '../../src/domain/canonical';
import { readObjectEntry } from '../helpers/read-object-entry';

vi.setConfig({ testTimeout: 60_000 });
const ROOT = 'tests/fixtures/all-knowing-eye-v01920';
const PANEL = '全知之眼成长';
const ENTRY = '全知之眼与阅览处';
const INSIGHT = 'reader.s1.bounded-insight', FORECAST = 'reader.s1.pending-forecast';
const natural = (key: string) => migrateSliceState(readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
const boundary = (name: string) => {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual All-Knowing Eye boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const snapshot = (name: string) => {
  const snapshots = readObjectEntry<Record<string, string>>(`${ROOT}/natural.json`, 'snapshots');
  if (!snapshots[name]) throw new Error(`Missing actual All-Knowing Eye snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${snapshots[name]}`, 'utf8')));
};

/** Real saved producer boundaries only: no injected body, selected future RNG,
 * synthetic life success, replacement originals or invented combat application. */
function savedGame(input: unknown) {
  let state = migrateSliceState(input); assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T14:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  const loadRun = vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) }));
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: {
      mode: 'browser', activeState: state, runs: [{ runId: state.runId, name: state.character.name, portraitId: state.character.portraitId,
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-15T13:59:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
}
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openGrowth() {
  await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
  return screen.findByRole('region', { name: PANEL });
}
async function ensurePanel() {
  await acknowledgeRound();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function assertResources(state: SliceState) {
  const current = projectSliceState(state), resources = screen.getByRole('region', { name: '全知之眼当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${current.allKnowingEye.title}`);
  expect(resources.textContent).toContain(`健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${current.actionsRemaining} · 现有伤势${current.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count = 1) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
async function capturedControl(state: SliceState, intent: SliceIntent) {
  if (intent.type !== 'ALL_KNOWING_EYE') throw new Error('Expected a captured public All-Knowing Eye command.');
  const action = projectSliceState(state).allKnowingEye.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  let button = screen.queryByRole('button', { name: name => name.startsWith(action!.label) });
  if (!button) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '全知之眼其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(action!.label) });
  }
  return button;
}
async function commitCaptured(game: SavedGame, save: ReturnType<typeof boundary>, count = 1) {
  expect(game.state).toEqual(save.before);
  await userEvent.click(await capturedControl(save.before, save.intent));
  expect(game.submit).toHaveBeenCalledTimes(count - 1);
  const dialog = screen.getByRole('dialog', { name: '全知之眼操作确认' });
  const confirm = within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await waitFor(() => expect(game.state).toEqual(save.final)); assertEnvelope(game, save.before, save.intent, count);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '全知之眼操作确认' })).toBeNull());
}
function assertRound(reveal: HTMLElement, round: SliceCombatRound) {
  const outcome = round.allKnowingEyeOutcome;
  if (!outcome) throw new Error('Expected the actual saved All-Knowing Eye round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  const record = within(reveal).getByRole('region', { name: '全知之眼本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, i) => {
    expect(rows[i]!.textContent).toContain(action.label);
    expect(rows[i]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[i]!.textContent).toContain(`本槽原杆储能消耗${action.rodChargeSpent}；原微光片${action.consumedCraftId ?? '本槽未消耗'}；普通移动${action.travelMetres}米`);
    expect(rows[i]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}；对手精神${action.enemyMindAfter}、灵性${action.enemySpiritualityAfter}`);
    if (action.fallbackReason) expect(rows[i]!.textContent).toContain(action.fallbackReason);
    if (action.finiteResult === 'PENDING') expect(rows[i]!.textContent).toContain('当前只是建立有限窗口，尚未对后续动作生效');
  });
  const text = reveal.textContent!.replace(/\s+/g, ' ');
  if (round.consequenceDomain === 'BODY') {
    expect(record.textContent).toContain('本回合按实际身体冲击结算伤势');
    const weights = round.consequenceWeights!;
    expect(text).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
    expect(text).not.toContain('精神后果盘');
  } else if (round.consequenceDomain === 'MENTAL') {
    expect(record.textContent).toContain('本回合按实际精神压力结算，不生成身体伤口');
    expect(round.consequenceWeights).toBeNull(); expect(text).toContain('精神减少10，没有新增身体伤口或身体风险');
    expect(text).not.toContain('精神后果盘'); expect(text).not.toContain('败者后果盘：轻伤');
  } else {
    expect(round.consequenceWeights).toBeNull(); expect(record.textContent).toContain('本回合没有身体或精神后果盘');
    expect(text).not.toContain('败者后果盘：轻伤');
    expect(within(reveal).queryByText(/^精神后果盘/)).toBeNull();
  }
}
async function submitRound(game: SavedGame, save: ReturnType<typeof boundary>) {
  await acknowledgeRound();
  const battle = projectSliceState(save.before).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
  const stance = battle.stances.find(stance => stance.id === 'CONTROL')!;
  await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
  expect(game.state).toEqual(save.before); expect(game.submit).not.toHaveBeenCalled();
  await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
  await waitFor(() => expect(game.state).toEqual(save.final)); assertEnvelope(game, save.before, save.intent);
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

describe('All-Knowing Eye actual saved campaign navigation and reopening', () => {
  it('opens the original living537-command boundary and keeps the existing Wisdom Angel growth route available', async () => {
    const game = savedGame(natural('prefixFinal')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(2); expect(before.allKnowingEye.guidanceKnown).toBe(false);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await ensurePanel(); assertResources(before);
    expect(screen.getByRole('region', { name: '全知之眼服药准备' })).toBeTruthy();
    expect(projectSliceState(before).allKnowingEye).toMatchObject({ formulaKnown: false, formula: [] });
    await userEvent.click(screen.getByText('原房间、玛拉与旧物当前记录', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: '原房间当前状态' }).textContent).toContain('玛拉 · 43岁，存活；健康100/100、精神100/100');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '智慧天使有限切片' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it('confirms the actual first original bottle once, then reopens nineteen inherited abilities and two new zeros', async () => {
    const save = boundary('actual-consumption-all-knowing-eye-potion-1'), game = savedGame(save.before);
    await mount(game); await ensurePanel();
    await userEvent.click(await capturedControl(save.before, save.intent));
    const dialog = screen.getByRole('dialog', { name: '全知之眼操作确认' });
    expect(dialog.textContent).toContain('第1瓶'); expect(dialog.textContent).toContain('当前成功率44%');
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('性别、姓名、年龄、性格与取向不变');
    expect(dialog.textContent).toContain('健康−15精神−25排异+30');
    expect(dialog.textContent).not.toContain('确认接受晋升后的身体变化'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(save.before);
    await commitCaptured(game, save); cleanup(); await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const panel = await openGrowth(); assertResources(save.final);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(game.state).allKnowingEye.abilities;
    expect(abilities).toHaveLength(21); expect(abilities.slice(0, 19).filter(ability => ability.mastery === 0)).toHaveLength(5);
    expect(abilities.slice(19).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(game.state).toMatchObject({ revision: 575, week: 136, health: 100, mind: 85, spirituality: 120, cash: 130 });
    expect({ ...game.state.character, coreStats: save.before.character.coreStats }).toEqual(save.before.character);
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the failed insight and the pending forecast as different actual saves, requiring each independent operation', async () => {
    for (const [name, forecast] of [['original-paper-check-independent-current-verification', false], ['pending-slider-actual-release-and-independent-catch', true]] as const) {
      const save = boundary(name), game = savedGame(save.before);
      await mount(game); assertResources(save.before);
      const finite = screen.getByRole('region', { name: '两项能力的有限窗口' });
      expect(finite.textContent).toContain('施放本身不完成核验或接取，也不增加掌握');
      expect(finite.textContent).toContain(forecast ? '先机预判还剩30秒，等待一次真实释放与接取' : '现场洞察：失败，判定失败，实际应用0次');
      expect(game.state.progression.mastery[forecast ? FORECAST : INSIGHT]).toBe(0);
      expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
      expect((screen.getByRole('combobox', { name: '全知之眼目标' }) as HTMLSelectElement).disabled).toBe(true);
      await commitCaptured(game, save); cleanup(); await mount(game); assertResources(save.final);
      expect(game.state.allKnowingEye.life.pending).toBeNull(); expect(game.state.progression.mastery[forecast ? FORECAST : INSIGHT]).toBe(0);
      expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent)
        .toContain(forecast ? '先机预判：成功，已经实际应用，实际应用1次' : '后续独立交接核验：成功');
      expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1); cleanup();
    }
  });

  it('reopens changed direction and withdrawn consent, then saves the same ordinary stop and clear without refund', async () => {
    const saves = ['actual-direction-and-sightline-change', 'current-owner-withdrawal', 'ordinary-stop-after-withdrawal', 'ordinary-open-same-shutter']
      .map(name => boundary(`changed-conditions-${name}`));
    const game = savedGame(saves[0]!.before); await mount(game);
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('先机预判还剩30秒');
    for (const [i, save] of saves.entries()) {
      await commitCaptured(game, save, i + 1); cleanup(); await mount(game); assertResources(save.final);
      expect(game.state.allKnowingEye.life.pending).toBeNull();
      expect(game.state.allKnowingEye.life.cases['changed-conditions'].attempts[0]!.forecast).toMatchObject({ effects: 0, state: 'INVALIDATED' });
      expect([game.state.spirituality, game.state.mind]).toEqual([save.before.spirituality, save.before.mind]);
      expect(game.state.progression.mastery[FORECAST]).toBe(8);
    }
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经撤回');
    expect(screen.getByRole('region', { name: '独立无动力滑块' }).textContent).toContain('已经实际停止；方向向右，视线畅通');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('条件改变，已经失效，实际应用0次');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(game.submit).toHaveBeenCalledTimes(4);
  });

  it('reopens all honest reports and original returns, then saves the fixed ALL policy and independent fight once', async () => {
    const practiced = savedGame(snapshot('practiced')), before = structuredClone(practiced.state);
    await mount(practiced); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const nextStage = await screen.findByRole('region', { name: '序列0 白塔' });
    const inherited = projectSliceState(before).whiteTower.abilities;
    expect(inherited).toHaveLength(21);
    await userEvent.click(within(nextStage).getByText('已掌握的能力', { selector: 'summary' }));
    for (const ability of inherited) {
      expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
      expect(within(nextStage).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    expect(practiced.state).toEqual(before); expect(practiced.submit).not.toHaveBeenCalled();
    await userEvent.click(within(nextStage).getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await screen.findByRole('region', { name: PANEL }); assertResources(before);
    for (const id of ['original-paper-check', 'pending-slider', 'changed-conditions']) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '全知之眼目标' }), id);
      expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('本案原纸、滑块与人员的实际收尾已完成');
    }
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经离场');
    expect(screen.getByRole('region', { name: '独立无动力滑块' }).textContent).toContain('实际移动1次、成功接取1次、手动制停1次');
    expect([practiced.state.progression.mastery[INSIGHT], practiced.state.progression.mastery[FORECAST]]).toEqual([0, 8]);
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '序列0 白塔' })).toBeTruthy();
    expect(practiced.state).toEqual(before); expect(practiced.submit).not.toHaveBeenCalled(); cleanup();

    const policy = boundary('fixed-all-policy-before-fight'), fight = boundary('independent-optional-edwin-fight'), game = savedGame(policy.before);
    await mount(game); assertResources(policy.before);
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('等待本场明确选择');
    await commitCaptured(game, policy); expect(game.state.combat).toBeNull();
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('本场明确选择已经保存');
    await commitCaptured(game, fight, 2);
    const battle = projectSliceState(fight.final).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(within(stage).getByRole('region', { name: '全知之眼本回合实际资源' }).textContent).toContain('MM5-FLASH-3、MM5-FLASH-4');
    expect(battle.allKnowingEye).toMatchObject({ targetId: 'AE1-EDWIN-ROSS', policy: 'ALL' });
    cleanup(); await mount(game); expect(await screen.findByRole('dialog', { name: battle.title! })).toBeTruthy();
    expect(game.state).toEqual(fight.final); expect(game.submit).toHaveBeenCalledTimes(2);
  });

  it.each([1, 2])('submits actual saved round%s once and reopens its current round before any inherited promotion record', async number => {
    const save = boundary(`combat-round-${number}`), game = savedGame(save.before);
    await mount(game);
    if (save.before.lastCombatRound?.allKnowingEyeOutcome) assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.before.lastCombatRound);
    else expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await acknowledgeRound();
    const battle = projectSliceState(save.before).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(within(stage).getByRole('region', { name: '全知之眼本回合实际资源' }).textContent)
      .toContain(`本人健康${save.before.health}/100 · 精神${save.before.mind}/100 · 灵性${save.before.spirituality}/120`);
    expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
    await submitRound(game, save);
    expect(save.final.lastCombatRound!.consequenceDomain).toBe(number === 1 ? 'MENTAL' : 'BODY');
    if (number === 1) { expect(game.state.health).toBe(100); expect(game.state.mind).toBe(88); expect(game.state.injuries).toEqual(save.before.injuries); }
    else expect(game.state).toMatchObject({ health: 70, mind: 86, injuries: [{ severity: 'HEAVY', treatedRevision: null }] });
    expect(game.state.progression.mastery[INSIGHT]).toBe(0);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.final.lastCombatRound!);
    cleanup(); await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.final.lastCombatRound!);
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('saves the actual fourth-round living surrender and reopens the later living save with its untreated wound and original tools', async () => {
    const save = boundary('combat-round-4'), game = savedGame(save.before);
    await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.before.lastCombatRound!);
    await submitRound(game, save);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.final.lastCombatRound!);
    expect(game.state.allKnowingEye.encounter).toMatchObject({ status: 'RESOLVED', enemyStatus: 'SURRENDERED', enemyHealth: 70,
      terminal: { outcome: 'ENEMY_SURRENDERED', round: 4, exitMetres: 4, exitSeconds: 4 }, scene: { playerLocation: 'OUTSIDE' } });
    expect(game.state.status).toBe('ACTIVE'); expect(game.state.ending).toBeNull();
    cleanup(); await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.final.lastCombatRound!);
    await ensurePanel(); assertResources(save.final);
    expect(screen.getByRole('region', { name: '全知之眼可选真实交战' }).textContent).toContain('已投降');
    expect(screen.getByRole('region', { name: '全知之眼当前资源' }).textContent).toContain('重伤 · 尚未治疗');
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1); cleanup();

    const final = natural('final'), reopened = savedGame(final);
    await mount(reopened); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), final.lastCombatRound!);
    await ensurePanel(); assertResources(final);
    expect(final).toMatchObject({ status: 'ACTIVE', health: 70, mind: 86, spirituality: 120, cash: 1390, week: 146, actionsRemaining: 3 });
    expect(screen.getByRole('region', { name: '已有样本与原微光片' }).textContent).toContain('当前尚持有2枚');
    expect(screen.getByRole('region', { name: '对手原杆与有限资源' }).textContent).toContain('可见闪光储能0/4');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /^工作，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    expect(reopened.state.wisdomAngel.encounter).toMatchObject({ status: 'AVAILABLE', approachWeek: null, targetId: 'WA2-VICTOR' });
    expect(reopened.state).toEqual(final); expect(reopened.submit).not.toHaveBeenCalled();
  });
});
