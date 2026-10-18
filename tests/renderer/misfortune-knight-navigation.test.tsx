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

vi.setConfig({ testTimeout: 30_000 });
const ROOT = 'tests/fixtures/misfortune-knight-v01910';
const PANEL = '厄难骑士成长';
const ENTRY = '厄难骑士与原房';
const natural = (key: string) => migrateSliceState(readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
const boundary = (name: string) => {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual Misfortune Knight boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const snapshot = (name: string) => {
  const snapshots = readObjectEntry<Record<string, string>>(`${ROOT}/natural.json`, 'snapshots');
  if (!snapshots[name]) throw new Error(`Missing actual Misfortune Knight snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${snapshots[name]}`, 'utf8')));
};

/** Only real producer saves: no directed inputs, selected future cursor,
 * injected health, replaced original objects or invented combat result. */
function savedGame(input: unknown) {
  let state = migrateSliceState(input); assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T13:10:00Z', replayed: false, state: projectSliceState(state) } };
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
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-15T13:09:00Z' }],
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
  const current = projectSliceState(state), resources = screen.getByRole('region', { name: '厄难骑士当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${current.misfortuneKnight.title}`);
  expect(resources.textContent).toContain(`健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${current.actionsRemaining} · 现有伤势${current.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count = 1) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
async function capturedControl(state: SliceState, intent: SliceIntent) {
  if (intent.type !== 'MISFORTUNE_KNIGHT') throw new Error('Expected a captured public Misfortune Knight command.');
  const action = projectSliceState(state).misfortuneKnight.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  let button = screen.queryByRole('button', { name: name => name.startsWith(action!.label) });
  if (!button) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '厄难骑士其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(action!.label) });
  }
  return button;
}
async function commitCaptured(game: SavedGame, save: ReturnType<typeof boundary>, count = 1) {
  expect(game.state).toEqual(save.before);
  await userEvent.click(await capturedControl(save.before, save.intent));
  expect(game.submit).toHaveBeenCalledTimes(count - 1);
  const dialog = screen.getByRole('dialog', { name: '厄难骑士操作确认' });
  const confirm = within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await waitFor(() => expect(game.state).toEqual(save.final)); assertEnvelope(game, save.before, save.intent, count);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '厄难骑士操作确认' })).toBeNull());
}
function assertRound(reveal: HTMLElement, round: SliceCombatRound) {
  const outcome = round.misfortuneKnightOutcome;
  if (!outcome) throw new Error('Expected the actual saved Misfortune Knight round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  const record = within(reveal).getByRole('region', { name: '厄难骑士本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, i) => {
    expect(rows[i]!.textContent).toContain(action.label);
    expect(rows[i]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[i]!.textContent).toContain(`本槽原板磨损${action.plateWear}，原杆储能消耗${action.rodChargeSpent}；普通移动${action.travelMetres}米`);
    expect(rows[i]!.textContent).toContain(`本人精神${action.playerMindAfter}、灵性${action.playerSpiritualityAfter}；对手精神${action.enemyMindAfter}、灵性${action.enemySpiritualityAfter}`);
    if (action.fallbackReason) expect(rows[i]!.textContent).toContain(action.fallbackReason);
    if (action.finiteResult === 'PENDING') expect(rows[i]!.textContent).toContain('当前只是建立有限窗口，尚未对后续动作生效');
    if (action.finiteResult === 'APPLIED') expect(rows[i]!.textContent).toContain('有限窗口已经在这个实际动作中消耗');
  });
  const text = reveal.textContent!.replace(/\s+/g, ' ');
  if (round.consequenceDomain === 'BODY') {
    expect(record.textContent).toContain('本回合按实际身体冲击结算伤势'); expect(round.consequenceWeights).not.toBeNull();
    const weights = round.consequenceWeights!;
    expect(text).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`); expect(text).not.toContain('精神后果盘');
  } else if (round.consequenceDomain === 'MENTAL') {
    expect(record.textContent).toContain('本回合按实际精神压力结算，不生成身体伤口');
    // Actual round8 applies ten mental damage directly, with no invented wheel.
    expect(round.consequenceWeights).toBeNull(); expect(text).toContain('精神减少10，没有新增身体伤口或身体风险');
    expect(text).not.toContain('精神后果盘'); expect(text).not.toContain('败者后果盘：轻伤');
  } else {
    expect(round.consequenceWeights).toBeNull(); expect(record.textContent).toContain('本回合没有身体或精神后果盘');
    expect(text).not.toContain('败者后果盘：轻伤'); expect(text).not.toContain('精神后果盘');
  }
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

describe('Misfortune Knight actual saved campaign navigation and reopening', () => {
  it('opens the original living518-command boundary and returns to its existing growth page without mutation', async () => {
    const game = savedGame(natural('prefixFinal')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(2); expect(before.misfortuneKnight.guidanceKnown).toBe(false);
    await mount(game);
    expect(before.lastCombatRound?.fearBishopOutcome).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await ensurePanel(); expect(screen.getByRole('region', { name: '厄难骑士服药准备' })).toBeTruthy(); assertResources(before);
    await userEvent.click(screen.getByText('原房间、艾琳与旧物当前记录', { selector: 'summary' }));
    const original = screen.getByRole('region', { name: '原房间当前状态' });
    expect(original.textContent).toContain('艾琳 · 38岁，存活；健康100/100、精神100/100');
    expect(original.textContent).toContain('实际检索2次，其中延迟1次、共20秒'); expect(original.textContent).toContain('当前身体：女性');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '隐秘之仆有限切片' })).toBeTruthy(); expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it('confirms the actual promoting original bottle once and reopens eighteen inherited abilities plus two zeros', async () => {
    const save = boundary('consume-misfortune-knight-potion-3'), game = savedGame(save.before), before = structuredClone(game.state);
    expect(before.misfortuneKnight.bottles.slice(0, 2).map(row => row.outcome)).toEqual(['FAILURE', 'FAILURE']);
    await mount(game); await ensurePanel();
    await userEvent.click(await capturedControl(before, save.intent));
    const dialog = screen.getByRole('dialog', { name: '厄难骑士操作确认' });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备'); expect(dialog.textContent).toContain('性别、姓名、年龄、性格与取向不变');
    expect(dialog.textContent).toContain('第3瓶'); expect(dialog.textContent).toContain('当前成功率50%');
    expect(dialog.textContent).not.toContain('确认接受晋升后的身体变化'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(before);
    await commitCaptured(game, save);
    cleanup(); await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const panel = await openGrowth(); assertResources(save.final);
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(game.state).misfortuneKnight.abilities;
    expect(abilities).toHaveLength(20); expect(abilities.slice(0, 18).filter(ability => ability.mastery === 0)).toHaveLength(5);
    expect(abilities.slice(18).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect({ ...game.state.character, coreStats: before.character.coreStats }).toEqual(before.character);
    expect(game.state).toMatchObject({ revision: 617, week: 151, health: 100, mind: 85, spirituality: 120, cash: 130,
      character: { coreStats: { physique: 31, perception: 29, will: 31, knowledge: 24 } } });
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the actual paid invitation and walks the saved40 metres before requesting fresh permissions', async () => {
    const save = boundary('pending-parcel-actual40metre-walk'), game = savedGame(save.before);
    expect(game.state.misfortuneKnight.life.cases['pending-parcel'].visited).toBe(false);
    await mount(game); expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy(); assertResources(save.before);
    expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull(); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect((screen.getByRole('combobox', { name: '厄难骑士目标' }) as HTMLSelectElement).disabled).toBe(true);
    expect(projectSliceState(save.before).misfortuneKnight.actions.some(action => action.command.type === 'CONSENT')).toBe(false);
    await commitCaptured(game, save); cleanup(); await mount(game);
    expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('累计实走40米');
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('尚未询问本次许可');
    expect(projectSliceState(game.state).misfortuneKnight.actions.some(action => action.enabled && action.command.type === 'CONSENT')).toBe(true);
    expect(game.state.concealmentServant.life.playerTravelMetres).toBe(save.before.concealmentServant.life.playerTravelMetres + 40);
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the actual paid guided attempt and submits the independent original-box catch without early mastery', async () => {
    const save = boundary('pending-parcel-actual-independent-catch'), game = savedGame(save.before);
    await mount(game); assertResources(save.before);
    const finite = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(finite.textContent).toContain('厄势导引还剩30秒，等待一次真实接取');
    expect(finite.textContent).toContain('施放本身不完成接取或释放，也不增加掌握');
    expect(screen.getByRole('region', { name: '原托盘木板与待发动作' }).textContent).toContain('原盒滑动尚未发生，等待真实接取');
    expect(game.state.progression.mastery['darkness.s1.guided-mishap']).toBe(0); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await commitCaptured(game, save); cleanup(); await mount(game); assertResources(save.final);
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('当前没有可应用的厄势导引窗口');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('本次能力判定：成功；独立普通接取：成功');
    expect(game.state.misfortuneKnight.life.practice.pendingGuided).toBeNull(); expect(game.state.progression.mastery['darkness.s1.guided-mishap']).toBe(0);
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('keeps a paid guard attempt distinct from the actual subsequent release of the same calibration weight', async () => {
    const save = boundary('personal-dark-guard-actual-light-impact'), game = savedGame(save.before);
    await mount(game); assertResources(save.before);
    expect(screen.getByRole('region', { name: '原托盘木板与待发动作' }).textContent).toContain('完整度55/65；已磨损10');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('隐夜护持还剩30秒，等待一次真实轻触');
    expect(game.state.misfortuneKnight.life.practice.rig.weightState).toBe('ARMED');
    expect(game.state.misfortuneKnight.life.cases['personal-dark-guard'].guardApplied).toBe(false);
    await commitCaptured(game, save); cleanup(); await mount(game);
    expect(game.state.misfortuneKnight.life.cases['personal-dark-guard'].impactReleased).toBe(true);
    expect(game.state.misfortuneKnight.life.cases['personal-dark-guard']).toMatchObject({ guardApplied: true, guardEnd: 'APPLIED', result: 'ABILITY' });
    expect(game.state.progression.mastery['darkness.s1.bounded-night-guard']).toBe(0);
    expect(screen.getByRole('region', { name: '原托盘木板与待发动作' }).textContent).toContain('已实际释放1次');
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens actual obstruction and withdrawn consent, then saves ordinary stop and clear without refunds or restored plate', async () => {
    const names = ['withdrawn-path-current-owner-withdrawal', 'withdrawn-path-actual-unreleased-weight-stop', 'withdrawn-path-ordinary-clear-original-door'];
    const saves = names.map(boundary), game = savedGame(saves[0]!.before);
    await mount(game); assertResources(game.state);
    expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('原门实际受阻');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('当前没有可应用的隐夜护持窗口');
    for (const [i, save] of saves.entries()) {
      await commitCaptured(game, save, i + 1); cleanup(); await mount(game); assertResources(save.final);
      expect(game.state.misfortuneKnight.life.practice.plate.integrity).toBe(45);
      expect([game.state.spirituality, game.state.mind]).toEqual([save.before.spirituality, save.before.mind]);
    }
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经撤回');
    expect(game.state.misfortuneKnight.life.practice.rig).toMatchObject({ weightState: 'STOPPED', releases: 1, remainingForce: 0 });
    expect(game.state.concealmentServant.life.room.doorBlocked).toBe(false); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(projectSliceState(game.state).misfortuneKnight.actions.some(action => action.enabled && action.command.type === 'ORDINARY_CARRY')).toBe(true);
    expect(game.submit).toHaveBeenCalledTimes(3);
  });

  it('reopens all honest reports and original returns without replaying costs or borrowing the sealed twelve-use leaf', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull(); await ensurePanel(); assertResources(before);
    for (const id of ['pending-parcel', 'personal-dark-guard', 'withdrawn-path']) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '厄难骑士目标' }), id);
      expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('本案实际还物与归程已完成');
    }
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经撤回');
    expect(screen.getByRole('region', { name: '原托盘木板与待发动作' }).textContent).toContain('完整度45/65；已磨损20');
    await userEvent.click(screen.getByText('原房间、艾琳与旧物当前记录', { selector: 'summary' }));
    expect(screen.getByRole('region', { name: '原房间当前状态' }).textContent).toContain(`累计实际搬动${before.concealmentServant.life.box.travelMetres}米`);
    expect(game.state.spiritWarlock.companion).toMatchObject({ status: 'SEALED', deployments: 12, recalls: 12 });
    expect([game.state.progression.mastery['darkness.s1.guided-mishap'], game.state.progression.mastery['darkness.s1.bounded-night-guard']]).toEqual([8, 8]);
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const darkness = await screen.findByRole('region', { name: '序列0 黑暗' });
    const value = projectSliceState(before).darkness;
    expect(before.progression.sequence).toBe(1); expect(value.promoted).toBe(false);
    expect(value.abilities).toHaveLength(20);
    await userEvent.click(within(darkness).getByText('已掌握的能力', { selector: 'summary' }));
    for (const ability of value.abilities) {
      expect(ability.mastery).toBe(before.progression.mastery[ability.id]);
      expect(within(darkness).getByRole('heading', { name: `${ability.label} · 熟练 ${ability.mastery}` })).toBeTruthy();
    }
    expect(value.abilities.some(ability => ability.id.startsWith('darkness.s0.'))).toBe(false);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(darkness).getByRole('button', { name: '返回普通生活' }));
    await ensurePanel(); assertResources(before);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it('saves the declared ALL policy separately, then confirms the actual independent fight once with current original resources', async () => {
    const policy = boundary('fixed-all-policy-before-fight'), fight = boundary('independent-optional-fight'), game = savedGame(policy.before);
    await mount(game); expect(screen.getByRole('region', { name: PANEL })).toBeTruthy(); assertResources(policy.before);
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('等待本场明确选择');
    await commitCaptured(game, policy); expect(game.state.combat).toBeNull();
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('本场明确选择已经保存');
    expect(game.state.spiritWarlock.companion).toEqual(policy.before.spiritWarlock.companion);
    await commitCaptured(game, fight, 2);
    const battle = projectSliceState(fight.final).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(within(stage).getByRole('region', { name: '厄难骑士本回合实际资源' }).textContent).toContain('同一封叶已派出12次、收回12次');
    expect(battle.misfortuneKnight!.targetId).toBe('MK1-ALDEN-WARD'); expect(battle.misfortuneKnight!.policy).toBe('ALL');
    cleanup(); await mount(game); expect(await screen.findByRole('dialog', { name: battle.title! })).toBeTruthy();
    expect(game.state).toEqual(fight.final); expect(game.submit).toHaveBeenCalledTimes(2);
  });

  it.each([1, 8])('submits actual saved round%s once and reopens its saved counts, source costs and consequence before the next stance', async number => {
    const save = boundary(`combat-round-${number}`), game = savedGame(save.before), before = structuredClone(game.state);
    if (save.intent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual saved combat command.');
    const intent = save.intent, battle = projectSliceState(before).combat!;
    await mount(game);
    if (before.lastCombatRound?.misfortuneKnightOutcome) assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), before.lastCombatRound);
    await acknowledgeRound();
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    const resources = within(stage).getByRole('region', { name: '厄难骑士本回合实际资源' });
    expect(resources.textContent).toContain(`本人健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);
    expect(resources.textContent).toContain(`同一封叶已派出${before.spiritWarlock.companion.deployments}次、收回${before.spiritWarlock.companion.recalls}次`);
    expect(resources.textContent).toContain('全部实际能力'); expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
    const stance = battle.stances.find(stance => stance.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(save.final)); assertEnvelope(game, before, intent);
    expect(save.final.lastCombatRound!.consequenceDomain).toBe(number === 1 ? 'BODY' : 'MENTAL');
    if (number === 8) {
      expect(save.final).toMatchObject({ health: 30, mind: 90, injuryRisk: 2 }); expect(save.final.injuries).toEqual(before.injuries);
      expect(save.final.lastCombatRound!.misfortuneKnightOutcome!.playerActions.filter(action => action.planned === 'darkness.s1.guided-mishap'))
        .toEqual(expect.arrayContaining([expect.objectContaining({ selectedAbility: 'BLOCK', finiteResult: 'UNAVAILABLE', paidCost: 0, masteryApplied: [] })]));
    }
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.final.lastCombatRound!);
    cleanup(); await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.final.lastCombatRound!);
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('saves the actual ninth-round death and repeatedly reopens its final record without revival, invented exit or restored originals', async () => {
    const save = boundary('combat-round-9'), game = savedGame(save.before), final = natural('final');
    expect(save.final).toEqual(final); expect(final).toMatchObject({ status: 'DEAD', revision: 695, week: 159, health: 0, mind: 90, spirituality: 120, cash: 510, combat: null });
    expect(final.misfortuneKnight.encounter).toMatchObject({ status: 'LOST', enemyHealth: 90, enemyMind: 100, enemySpirituality: 18, enemyStatus: 'RESISTING',
      terminal: { outcome: 'PLAYER_DEAD', round: 9, exitMetres: 0, exitSeconds: 0 },
      materials: { weapon: { location: 'HAND', charge: 0 }, plate: { location: 'YARD', integrity: 65 } }, scene: { playerLocation: 'YARD', playerTravelMetres: 8 } });
    await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), save.before.lastCombatRound!); await acknowledgeRound();
    const battle = projectSliceState(save.before).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
    const stance = battle.stances.find(stance => stance.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(final)); assertEnvelope(game, save.before, save.intent);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), final.lastCombatRound!);
    cleanup();
    for (let n = 0; n < 2; n++) {
      await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(reveal, final.lastCombatRound!);
      await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
      const heading = await screen.findByRole('heading', { name: projectSliceState(final).ending!.title });
      expect(screen.getByText('只读封存卷宗')).toBeTruthy(); expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
      expect(screen.queryByRole('button', { name: ENTRY })).toBeNull(); expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
      expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
      expect(game.state.spiritWarlock.companion).toMatchObject({ source: 'SW5-LEAF-1', status: 'SEALED', deployments: 15, recalls: 15 });
      expect(game.state.concealmentServant.encounter.status).toBe('AVAILABLE'); expect(game.state.nightwatcher.encounter.enemy.status).toBe('DEAD');
      await userEvent.click(within(heading.parentElement!).getByRole('button', { name: '返回标题' }));
      expect((await screen.findByRole('button', { name: /继续游戏/ }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: /查看封存/ }) as HTMLButtonElement).disabled).toBe(false);
      expect(game.state).toEqual(final); expect(game.submit).toHaveBeenCalledTimes(1); cleanup();
    }
  });
});
