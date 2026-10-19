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

const ROOT = 'tests/fixtures/thunder-god-v01930';
const PANEL = '雷神成长';
const ENTRY = '雷神与原湾';
const GUIDED = 'tyrant.s1.guided-thunder', GUARD = 'tyrant.s1.storm-brace';
const natural = (key: string) => migrateSliceState(readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
const boundary = (name: string) => {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual Thunder God boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const snapshot = (name: string) => {
  const snapshots = readObjectEntry<Record<string, string>>(`${ROOT}/natural.json`, 'snapshots');
  if (!snapshots[name]) throw new Error(`Missing actual Thunder God snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${snapshots[name]}`, 'utf8')));
};

/** Actual producer boundaries only. No edited body, selected future RNG, invented
 * cast/application, substituted originals or replay of the 820-command campaign. */
function savedGame(input: unknown) {
  let state = migrateSliceState(input); assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T15:00:00Z', replayed: false, state: projectSliceState(state) } };
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
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-15T14:59:00Z' }],
    } })), loadRun, submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('dialog', { name: '战斗回合结果' })
    ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  expect(loadRun).toHaveBeenCalledExactlyOnceWith(state.runId);
}
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openThunderGodHistory() {
  // Completed S1 practice routes ordinary growth to the S0 preparation page.
  // Read the unchanged S1 reports through their explicit history entry.
  await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
async function ensurePanel() {
  await acknowledgeRound();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function assertResources(state: SliceState) {
  const current = projectSliceState(state), resources = screen.getByRole('region', { name: '雷神当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${current.thunderGod.title}`);
  expect(resources.textContent).toContain(`健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${current.actionsRemaining} · 现有伤势${current.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count = 1) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
async function capturedControl(state: SliceState, intent: SliceIntent) {
  if (intent.type !== 'THUNDER_GOD') throw new Error('Expected a captured public Thunder God command.');
  const action = projectSliceState(state).thunderGod.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  let button = screen.queryByRole('button', { name: name => name.startsWith(action!.label) });
  if (!button) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '雷神其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(action!.label) });
  }
  return button;
}
async function commitCaptured(game: SavedGame, save: ReturnType<typeof boundary>, count = 1) {
  expect(game.state).toEqual(save.before);
  await userEvent.click(await capturedControl(save.before, save.intent));
  expect(game.submit).toHaveBeenCalledTimes(count - 1);
  const dialog = screen.getByRole('dialog', { name: '雷神操作确认' });
  const confirm = within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await waitFor(() => expect(game.state).toEqual(save.final)); assertEnvelope(game, save.before, save.intent, count);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '雷神操作确认' })).toBeNull());
}
function assertRound(reveal: HTMLElement, round: SliceCombatRound) {
  const outcome = round.thunderGodOutcome;
  if (!outcome) throw new Error('Expected the actual saved Thunder God round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  const record = within(reveal).getByRole('region', { name: '雷神本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, i) => {
    expect(rows[i]!.textContent).toContain(`${action.actor === 'PLAYER' ? '本人' : '对手'}第${action.order + 1}槽：${action.label}`);
    expect(rows[i]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[i]!.textContent).toContain(`本槽实际经过${action.elapsedSeconds}秒`);
    expect(rows[i]!.textContent).toContain(`本槽原杆储能消耗${action.rodChargeSpent}；普通移动${action.travelMetres}米。现场条件${action.conditionVersionBefore}→${action.conditionVersionAfter}`);
    expect(rows[i]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}；对手精神${action.enemyMindAfter}、灵性${action.enemySpiritualityAfter}`);
    if (action.fallbackReason) expect(rows[i]!.textContent).toContain(action.fallbackReason);
    if (action.check) expect(rows[i]!.textContent).toContain(`检定骰${action.check.roll}，成功率${action.check.chance}%`);
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
    expect(text).toContain('实际精神来源：SEA_SONG');
    expect(text).not.toContain('精神后果盘'); expect(text).not.toContain('败者后果盘：轻伤');
  } else {
    expect(round.consequenceWeights).toBeNull(); expect(record.textContent).toContain('本回合没有身体或精神后果盘');
    expect(text).not.toContain('败者后果盘：轻伤'); expect(text).not.toMatch(/精神后果盘[：:]/);
  }
}
async function submitRound(game: SavedGame, save: ReturnType<typeof boundary>) {
  if (save.intent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual saved round command.');
  await acknowledgeRound();
  const battle = projectSliceState(save.before).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
  const stanceId = save.intent.stance, stance = battle.stances.find(stance => stance.id === stanceId)!;
  await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
  expect(game.state).toEqual(save.before); expect(game.submit).not.toHaveBeenCalled();
  await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
  await waitFor(() => expect(game.state).toEqual(save.final)); assertEnvelope(game, save.before, save.intent);
}
async function assertSealed(game: SavedGame) {
  await acknowledgeRound();
  const ending = await screen.findByRole('heading', { name: projectSliceState(game.state).ending!.title });
  expect(screen.getByText('只读封存卷宗')).toBeTruthy();
  expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
  expect(screen.queryByRole('button', { name: ENTRY })).toBeNull();
  expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
  expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
  expect(screen.queryByRole('button', { name: '确认姿态，结算完整回合' })).toBeNull();
  await userEvent.click(within(ending.parentElement!).getByRole('button', { name: '返回标题' }));
  expect((await screen.findByRole('button', { name: /继续游戏/ }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole('button', { name: /查看封存/ }) as HTMLButtonElement).disabled).toBe(false);
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

describe('Thunder God actual saved campaign navigation and reopening', () => {
  it('opens the original living599 boundary through the page and advance routes while growth still opens Catastrophe', async () => {
    const game = savedGame(natural('prefixFinal')), before = structuredClone(game.state);
    expect(before).toMatchObject({ revision: 600, week: 138, status: 'ACTIVE', progression: { sequence: 2 } });
    expect(before.thunderGod.guidanceKnown).toBe(false);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await ensurePanel(); assertResources(before);
    expect(screen.getByRole('region', { name: '雷神服药准备' })).toBeTruthy();
    expect(projectSliceState(before).thunderGod).toMatchObject({ formulaKnown: false, formula: [] });
    await userEvent.click(screen.getByText('原小湾、诺拉与旧物当前记录', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: '原小湾当前状态' }).textContent).toContain('诺拉 · 45岁，存活；精力88/100');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: '查看原湾与晋升' }));
    expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '天灾有限切片' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 60_000);

  it('confirms and spends the actual first prepared bottle once, preserving its saved failure after reopening', async () => {
    const save = boundary('actual-consumption-thunder-god-potion-1'), game = savedGame(save.before);
    await mount(game); await ensurePanel();
    expect(screen.getByRole('region', { name: '雷神阶段总览' }).textContent).toContain('当周准备已支付，选择原瓶');
    expect((screen.getByRole('combobox', { name: '雷神目标' }) as HTMLSelectElement).value).toBe('thunder-god-potion-1');
    await userEvent.click(await capturedControl(save.before, save.intent));
    const dialog = screen.getByRole('dialog', { name: '雷神操作确认' });
    const bottle = projectSliceState(save.before).thunderGod.bottles[0]!;
    expect(dialog.textContent).toContain('第1瓶'); expect(dialog.textContent).toContain(`当前成功率${bottle.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('健康−15精神−25排异+30');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向');
    expect(dialog.textContent).not.toContain('确认接受晋升后的身体变化'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(save.before);
    await commitCaptured(game, save); cleanup(); await mount(game); await ensurePanel(); assertResources(save.final);
    expect(game.state).toMatchObject({ revision: 639, health: 85, mind: 75, spirituality: 120, progression: { sequence: 2 }, seer: { pollution: 30 } });
    expect(game.state.thunderGod.preparedWeek).toBeNull();
    expect(game.state.thunderGod.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE', consumedWeek: 149 });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '雷神目标' }), bottle.id);
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('原瓶已耗尽 · 排异，仍为天灾');
    expect(game.state.character).toEqual(save.before.character); expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  }, 60_000);

  it('reads the archived fourth-bottle promotion without replaying legacy acquisition, preserving three failures and inherited abilities', async () => {
    const save = boundary('actual-consumption-thunder-god-potion-4'), archivedBefore = savedGame(save.before);
    expect(save.before.thunderGod.bottles.slice(0, 3).map(bottle => bottle.outcome)).toEqual(['FAILURE', 'FAILURE', 'FAILURE']);
    await mount(archivedBefore); await ensurePanel();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '雷神目标' }), 'thunder-god-potion-4');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('第170周实际到货');
    const consume = projectSliceState(save.before).thunderGod.actions.find(action =>
      action.command.type === 'CONSUME' && action.command.bottleId === 'thunder-god-potion-4')!;
    expect(consume.enabled).toBe(false);
    expect(consume.reason).toContain('历史独立第4份');
    await userEvent.click(screen.getByText('其他操作与普通替代', { selector: 'summary' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '雷神其他操作' }), consume.id);
    const blockedConsume = screen.getByRole('button', { name: name => name.startsWith(consume.label) });
    expect((blockedConsume as HTMLButtonElement).disabled).toBe(true); fireEvent.click(blockedConsume);
    expect(archivedBefore.state).toEqual(save.before); expect(archivedBefore.submit).not.toHaveBeenCalled();
    cleanup();

    // Preserve the already recorded historical success. This does not mint,
    // consume or relabel its independent fourth characteristic in current play.
    const game = savedGame(save.final); await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const panel = await openThunderGodHistory(); assertResources(save.final);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(game.state).thunderGod.abilities;
    expect(abilities).toHaveLength(24); expect(abilities.slice(0, 22).filter(ability => ability.mastery === 0)).toHaveLength(7);
    expect(abilities.slice(22).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(game.state).toMatchObject({ revision: 733, week: 178, health: 100, mind: 85, spirituality: 120, cash: 30, progression: { sequence: 1 } });
    expect(game.state.thunderGod.bottles.slice(0, 3)).toEqual(save.before.thunderGod.bottles.slice(0, 3));
    expect(game.state.thunderGod.bottles[3]).toMatchObject({ status: 'CONSUMED', outcome: 'SUCCESS' });
    expect({ ...game.state.character, coreStats: save.before.character.coreStats }).toEqual(save.before.character);
    expect(game.state).toEqual(save.final); expect(game.submit).not.toHaveBeenCalled();
  }, 60_000);

  it('keeps each actual successful life window pending until its separate saved discharge or personal impact', async () => {
    for (const [name, guard] of [
      ['located-target-separate-actual-will-check-and-original-target-hit-or-miss', false],
      ['personal-impact-actual-declared-impact-with-current-guard', true],
    ] as const) {
      const save = boundary(name), game = savedGame(save.before);
      await mount(game); assertResources(save.before);
      const finite = screen.getByRole('region', { name: '两项能力的有限窗口' });
      expect(finite.textContent).toContain('施放本身不完成放电或抵挡，也不增加掌握');
      expect(finite.textContent).toContain(guard ? '风雷护持还剩30秒，等待本人一次实际练习冲击；尚未抵挡伤害' : '雷势引导还剩30秒，等待一次独立放出雷势；尚未命中');
      expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
      expect((screen.getByRole('combobox', { name: '雷神目标' }) as HTMLSelectElement).disabled).toBe(true);
      await commitCaptured(game, save); cleanup(); await mount(game); assertResources(save.final);
      const id = guard ? 'personal-impact' : 'located-target', attempt = game.state.thunderGod.life.cases[id].attempts[0]!;
      expect(attempt[guard ? 'guard' : 'guided']).toMatchObject({ attempts: 1, successes: 1, effects: 1, state: 'APPLIED' });
      expect(game.state.thunderGod.life.pending).toBeNull();
      expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent)
        .toContain(`${guard ? '风雷护持' : '雷势引导'}：尝试1次，成功，已经实际应用，实际应用1次`);
      if (guard) {
        expect(attempt).toMatchObject({ impactReleased: true, healthLost: 0, healthPrevented: 5 });
        expect(game.state.thunderGod.life.pad.durability).toBe(90);
      } else {
        expect(attempt).toMatchObject({ dischargeTier: 'SUCCESS', targetHit: true });
        expect(game.state.thunderGod.life.target).toMatchObject({ durability: 95, marks: 1 });
      }
      // The actual report awards mastery later; applying a window does not submit that report.
      expect(game.state.progression.mastery[guard ? GUARD : GUIDED]).toBe(0);
      expect(game.state.health).toBe(save.before.health);
      expect([game.state.mind, game.state.spirituality]).toEqual([save.before.mind, save.before.spirituality]);
      expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1); cleanup();
    }
  }, 60_000);

  it('reopens the actual changed target and withdrawn consent, then saves ordinary stop and opening the same hood without refund', async () => {
    const saves = ['finn-actually-closes-original-hood-and-changes-version', 'current-keeper-withdrawal',
      'ordinary-stop-after-withdrawal', 'ordinary-real-walk-and-open-same-hood'].map(name => boundary(`obscured-return-${name}`));
    const game = savedGame(saves[0]!.before); await mount(game);
    expect(game.state.thunderGod.life.pending).toMatchObject({ kind: 'GUIDED', createdAt: 358, expiresAt: 388 });
    expect(game.state.thunderGod.life.playerLocation).toBe('CONTROL');
    expect(projectSliceState(game.state).thunderGod.actions.some(action => action.command.type === 'DISCHARGE_TARGET')).toBe(false);
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('原窗口当前不能应用');
    for (const [i, save] of saves.entries()) {
      await commitCaptured(game, save, i + 1); cleanup(); await mount(game); assertResources(save.final);
      expect(game.state.thunderGod.life.pending).toBeNull();
      expect(game.state.thunderGod.life.cases['obscured-return'].attempts[0]!.guided)
        .toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'INVALIDATED' });
      expect([game.state.spirituality, game.state.mind]).toEqual([save.before.spirituality, save.before.mind]);
      expect(game.state.progression.mastery[GUIDED]).toBe(8);
    }
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经撤回');
    expect(screen.getByRole('region', { name: '同一原目标与本人护垫' }).textContent).toContain('遮罩打开，视线畅通');
    expect(screen.getByRole('region', { name: '同一原目标与本人护垫' }).textContent).toContain('已经停止');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('条件改变，已经失效，实际应用0次');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull(); expect(game.submit).toHaveBeenCalledTimes(4);
  }, 60_000);

  it('reopens the three actual reports and original returns, then confirms the saved ALL policy and independent Oren fight once', async () => {
    const practiced = savedGame(snapshot('practiced')), before = structuredClone(practiced.state);
    await mount(practiced); await openThunderGodHistory(); assertResources(before);
    for (const id of ['located-target', 'personal-impact', 'obscured-return']) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '雷神目标' }), id);
      expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('本案原目标、护垫与人员的实际收尾已完成');
    }
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经离场');
    expect(screen.getByRole('region', { name: '同一原目标与本人护垫' }).textContent).toContain('耐久95/100、实际命中痕迹1处');
    expect(screen.getByRole('region', { name: '同一原目标与本人护垫' }).textContent).toContain('耐久90/100');
    expect([before.progression.mastery[GUIDED], before.progression.mastery[GUARD]]).toEqual([8, 8]);
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect(practiced.state).toEqual(before); expect(practiced.submit).not.toHaveBeenCalled(); cleanup();

    const policy = boundary('fixed-all-policy-before-fight'), fight = boundary('independent-optional-oren-fight'), game = savedGame(policy.before);
    await mount(game); assertResources(policy.before);
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('等待本场明确选择');
    await commitCaptured(game, policy); expect(game.state.combat).toBeNull();
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('本场明确选择已经保存');
    await commitCaptured(game, fight, 2);
    const battle = projectSliceState(fight.final).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(within(stage).getByRole('region', { name: '雷神本回合实际资源' }).textContent).toContain('原杆剩余雷击储能4');
    expect(battle.thunderGod).toMatchObject({ targetId: 'TG1-OREN-GAGE', policy: 'ALL' });
    cleanup(); await mount(game); expect(await screen.findByRole('dialog', { name: battle.title! })).toBeTruthy();
    expect(game.state.catastrophe.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'CT2-VALE', approachWeek: null });
    expect(game.state).toEqual(fight.final); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 60_000);

  it.each([[1, 'BODY'], [7, 'MENTAL']] as const)('submits actual saved round%s once and gives its %s record priority over growth and older combat', async (number, domain) => {
    const save = boundary(`combat-round-${number}`), game = savedGame(save.before);
    await mount(game);
    if (save.before.lastCombatRound?.thunderGodOutcome) assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.before.lastCombatRound);
    else expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await acknowledgeRound();
    const battle = projectSliceState(save.before).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(within(stage).getByRole('region', { name: '雷神本回合实际资源' }).textContent)
      .toContain(`本人健康${save.before.health}/100 · 精神${save.before.mind}/100 · 灵性${save.before.spirituality}/120`);
    expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
    expect(screen.queryByRole('region', { name: '天灾有限切片' })).toBeNull();
    await submitRound(game, save);
    const round = save.final.lastCombatRound!;
    expect(round.consequenceDomain).toBe(domain);
    expect(round.thunderGodOutcome!.source).toMatchObject({ runId: save.before.runId, revision: save.before.revision,
      week: save.before.week, round: number, targetId: 'TG1-OREN-GAGE', policy: 'ALL', playerHealth: save.before.health,
      playerMind: save.before.mind, playerSpirituality: save.before.spirituality });
    if (domain === 'MENTAL') {
      expect(game.state.health).toBe(10); expect(game.state.mind).toBe(90);
      expect(game.state.injuries).toEqual(save.before.injuries); expect(game.state.injuryRisk).toBe(save.before.injuryRisk);
    } else expect(game.state).toMatchObject({ health: 90, mind: 100, injuries: [{ severity: 'LIGHT', treatedRevision: null }] });
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), round);
    cleanup(); await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), round);
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  }, 60_000);

  it('saves actual round10 death after the real no-consequence round9 and reopens the final sealed820-command save without actions', async () => {
    const save = boundary('combat-round-10'), game = savedGame(save.before);
    await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.before.lastCombatRound!);
    expect(save.before.lastCombatRound!.consequenceWeights).toBeNull();
    await submitRound(game, save);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.final.lastCombatRound!);
    expect(game.state).toMatchObject({ status: 'DEAD', revision: 821, health: 0, mind: 84, spirituality: 106, week: 187, combat: null, ending: { kind: 'DEATH' } });
    expect(game.state.thunderGod.encounter).toMatchObject({ status: 'LOST', enemyHealth: 90, enemySpirituality: 2,
      terminal: { outcome: 'PLAYER_DEAD', round: 10, exitMetres: 0, exitSeconds: 0 }, scene: { playerLocation: 'PLATFORM' },
      materials: { weapon: { charge: 0, location: 'HAND' } } });
    expect(game.state.progression.mastery[GUIDED]).toBe(8); expect(game.state.progression.mastery[GUARD]).toBe(8);
    await assertSealed(game); expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1); cleanup();

    const final = natural('final'), reopened = savedGame(final);
    expect(final).toEqual(save.final);
    await mount(reopened); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), final.lastCombatRound!);
    await assertSealed(reopened);
    expect(reopened.state.catastrophe.encounter).toMatchObject({ status: 'AVAILABLE', targetId: 'CT2-VALE', approachWeek: null });
    expect(reopened.state).toEqual(final); expect(reopened.submit).not.toHaveBeenCalled();
  }, 60_000);

  it('keeps the separate original602-command Catastrophe death archived without retroactive promotion or revival', async () => {
    const provenance = readObjectEntry<{ source: string; original602CommandDeathPreserved: boolean }>(`${ROOT}/natural.json`, 'provenance');
    expect(provenance.original602CommandDeathPreserved).toBe(true);
    expect(provenance.source).toBe('tests/fixtures/catastrophe-v01710/natural.json');
    const original = migrateSliceState(readObjectEntry<unknown>(provenance.source, 'final')), game = savedGame(original);
    expect(original).toMatchObject({ status: 'DEAD', revision: 603, health: 0, mind: 100, spirituality: 107, week: 138,
      progression: { sequence: 2 }, ending: { kind: 'DEATH' } });
    expect(original.thunderGod.promotionWeek).toBeNull(); expect(original.thunderGod.guidanceKnown).toBe(false);
    expect(original.catastrophe.encounter).toMatchObject({ status: 'LOST', terminal: { outcome: 'PLAYER_DEAD', round: 1 } });
    await mount(game);
    const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(within(reveal).getByRole('heading', { name: '第 1 回合完整记录' })).toBeTruthy();
    expect(reveal.textContent).toContain(projectSliceState(original).lastCombatRound!.consequence);
    expect(within(reveal).queryByRole('region', { name: '雷神本回合实际记录' })).toBeNull();
    await assertSealed(game);
    expect(game.state).toEqual(original); expect(game.submit).not.toHaveBeenCalled();
    expect(migrateSliceState(readObjectEntry<unknown>(provenance.source, 'final'))).toEqual(original);
  }, 60_000);
});
