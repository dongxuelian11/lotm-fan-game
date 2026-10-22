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
const ROOT = 'tests/fixtures/civilization-enlightener-v01890';
const PANEL = '文明启蒙者成长';
const ENTRY = '文明启蒙者与原工坊';
const natural = (key: string) => migrateSliceState(readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
const boundary = (name: string) => {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual Civilization Enlightener boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const snapshot = (name: string) => {
  const snapshots = readObjectEntry<Record<string, string>>(`${ROOT}/natural.json`, 'snapshots');
  if (!snapshots[name]) throw new Error(`Missing actual Civilization Enlightener snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${snapshots[name]}`, 'utf8')));
};

/** Actual saved campaign only: no selected future cursor, injected resources,
 * repaired source history or alternate combat/life outcome. */
function savedGame(input: unknown) {
  let state = migrateSliceState(input); assertValidSliceState(state);
  const submit = vi.fn<SliceBridge['submitIntent']>(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T11:10:00Z', replayed: false, state: projectSliceState(state) } };
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
        week: state.week, date: state.date, status: state.status, revision: state.revision, updatedAt: '2026-10-15T11:09:00Z' }],
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
  await userEvent.click(screen.queryByRole('button', { name: '文明启蒙者与原工坊' })
    ?? screen.getByRole('button', { name: /非凡成长/ }));
  return screen.findByRole('region', { name: PANEL });
}
function assertResources(state: SliceState) {
  const current = projectSliceState(state), resources = screen.getByRole('region', { name: '文明启蒙者当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${current.civilizationEnlightener.title}`);
  expect(resources.textContent).toContain(`健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${current.actionsRemaining} · 现有伤势${current.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
async function capturedControl(state: SliceState, intent: SliceIntent) {
  if (intent.type !== 'CIVILIZATION_ENLIGHTENER') throw new Error('Expected a captured public Civilization Enlightener command.');
  const value = projectSliceState(state).civilizationEnlightener;
  const action = value.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  let button = screen.queryByRole('button', { name: name => name.startsWith(action!.label) });
  if (!button) {
    await userEvent.click(screen.getByText('其他操作与普通替代', { selector: 'summary' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '文明启蒙者其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(action!.label) });
  }
  return button;
}
function assertRound(reveal: HTMLElement, round: SliceCombatRound) {
  const outcome = round.civilizationEnlightenerOutcome;
  if (!outcome) throw new Error('Expected the actual saved Civilization Enlightener round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  const record = within(reveal).getByRole('region', { name: '文明启蒙者本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, i) => {
    expect(rows[i]!.textContent).toContain(action.label);
    expect(rows[i]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[i]!.textContent).toContain(`原盒耗能${action.boxChargeSpent}，原架耗能${action.frameChargeSpent}、耐久损耗${action.frameDurabilityDamage}`);
    if (action.fallbackReason) expect(rows[i]!.textContent).toContain(action.fallbackReason);
  });
  if (round.consequenceDomain === 'BODY') {
    expect(record.textContent).toContain('本回合按实际身体冲击结算伤势');
    expect(round.consequenceWeights).not.toBeNull();
    const weights = round.consequenceWeights!;
    expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
  } else {
    expect(round.consequenceDomain).toBeUndefined(); expect(round.consequenceWeights).toBeNull();
    expect(record.textContent).toContain('本回合没有身体或精神后果盘');
    expect(reveal.textContent).not.toContain('败者后果盘：轻伤');
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

describe('Civilization Enlightener actual saved campaign navigation and reopening', () => {
  it('opens optional S1 preparation from the actual S2 body and returns to its original Knowledge Mentor page', async () => {
    const game = savedGame(natural('prefixFinal')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(2); expect(before.civilizationEnlightener.guidanceKnown).toBe(false);
    expect(before.lastCombatRound?.knowledgeMentorOutcome).toBeTruthy();
    await mount(game);
    const history = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(history.textContent).toContain(projectSliceState(before).lastCombatRound!.consequence);
    expect(within(history).queryByRole('region', { name: '文明启蒙者本回合实际记录' })).toBeNull();
    await acknowledgeRound(); await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(await screen.findByRole('region', { name: '文明启蒙者服药准备' })).toBeTruthy(); assertResources(before);
    expect(screen.getByRole('region', { name: '文明启蒙者当前资源' }).textContent).toContain('重伤 · 尚未治疗');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '知识导师' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it('confirms the actual first bottle once and reopens all19 inherited abilities and two new zeros', async () => {
    const capture = boundary('consume-civilization-enlightener-potion-1'), game = savedGame(capture.before), before = structuredClone(game.state);
    expect(capture.intent).toEqual({ type: 'CIVILIZATION_ENLIGHTENER', command: { type: 'CONSUME', bottleId: 'civilization-enlightener-potion-1', confirmed: true } });
    await mount(game); await acknowledgeRound();
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const trigger = await capturedControl(before, capture.intent);
    await userEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '文明启蒙者操作确认' });
    expect(dialog.textContent).toContain('第1瓶'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(before);
    await userEvent.click(trigger);
    const confirm = within(screen.getByRole('dialog', { name: '文明启蒙者操作确认' })).getByRole('button', { name: '确认服用这一原瓶' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    expect(game.state.civilizationEnlightener.bottles[0]!.outcome).toBe('SUCCESS');
    cleanup(); await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const panel = await openGrowth(); assertResources(capture.final);
    expect(screen.queryByRole('region', { name: '知识导师' })).toBeNull();
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(game.state).civilizationEnlightener.abilities;
    expect(abilities).toHaveLength(21); expect(abilities.slice(0, 19).filter(ability => ability.mastery === 0)).toHaveLength(7);
    expect(abilities.slice(19).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(game.state.alchemist.life.creations.map(item => [item.charge, item.durability])).toEqual([[0, 100], [0, 90]]);
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the active original workshop before ordinary pages and applies only the captured paid-material repair', async () => {
    const capture = boundary('explicit-frame90-to95-no-recharge'), game = savedGame(capture.before), before = structuredClone(game.state);
    await mount(game);
    expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy(); assertResources(before);
    expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect((screen.getByRole('combobox', { name: '文明启蒙者目标' }) as HTMLSelectElement).disabled).toBe(true);
    const originals = screen.getByRole('region', { name: '同一原盒与原架' });
    expect(originals.textContent).toContain('AL4-FRAME-1：储能0/3，耐久90/100');
    expect(screen.getByRole('region', { name: '原工台、工具与实际位置' }).textContent).toContain('已实付购买，尚未耗用');
    await userEvent.click(await capturedControl(before, capture.intent));
    const confirm = within(screen.getByRole('dialog', { name: '文明启蒙者操作确认' })).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    cleanup(); await mount(game); assertResources(capture.final);
    expect(screen.getByRole('region', { name: '原工台、工具与实际位置' }).textContent).toContain('同一原架耐久90→95，储能0→0');
    expect(screen.getByRole('region', { name: '同一原盒与原架' }).textContent).toContain('AL4-FRAME-1：储能0/3，耐久95/100');
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('shows the adult learner’s failed saved attempt and requires her actual exit before reporting', async () => {
    const capture = boundary('taught-stop-actual-participant-exit'), game = savedGame(capture.before), before = structuredClone(game.state);
    await mount(game);
    const participant = screen.getByRole('region', { name: '维拉的本次参与' });
    expect(participant.textContent).toContain('维拉 · 39岁 · 实际在场');
    expect(screen.getByRole('region', { name: '普通停载与有限教学' }).textContent).toContain('维拉的独立尝试：失败');
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('能力判定：失败');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(await capturedControl(before, capture.intent));
    await userEvent.click(within(screen.getByRole('dialog', { name: '文明启蒙者操作确认' })).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    expect(game.state.civilizationEnlightener.life.practice.participant).toMatchObject({ present: false, walkedMetres: 8 });
    expect(game.state.civilizationEnlightener.life.cases['taught-stop'].status).toBe('EXAMINED');
    expect(game.state.progression.mastery['paragon.s1.operational-guidance']).toBe(0);
    cleanup(); await mount(game);
    if (!screen.queryByRole('region', { name: PANEL })) await openGrowth();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '文明启蒙者目标' }), 'taught-stop');
    expect(screen.getByRole('region', { name: '维拉的本次参与' }).textContent).toContain('维拉 · 39岁 · 当前不在场');
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens all three honest reports with mastery8/0, failed teaching and withdrawn permission, then returns to ordinary life', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await openGrowth(); assertResources(before);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '文明启蒙者目标' }), 'worn-bearing');
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('能力判定：成功');
    expect(screen.getByRole('region', { name: '原工台、工具与实际位置' }).textContent).toContain('同一原架耐久90→95，储能0→0');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '文明启蒙者目标' }), 'taught-stop');
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('能力判定：失败');
    const teaching = screen.getByRole('region', { name: '普通停载与有限教学' });
    expect(teaching.textContent).toContain('维拉的独立尝试：失败');
    expect(teaching.textContent).toContain('操作启示：尝试1次、成功0次、实际应用0次');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '文明启蒙者目标' }), 'withdrawn-operation');
    expect(screen.getByRole('region', { name: '维拉的本次参与' }).textContent).toContain('能力许可：已经撤回');
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('能力判定：尚无实际判定');
    expect(screen.getByRole('region', { name: '本次许可与实际消耗' }).textContent).toContain('维拉已离场');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /^工作，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: /^休养，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    const inheritedActions = projectSliceState(game.state).knowledgeMentor.actions;
    expect(inheritedActions.map(action => action.command)).toEqual([
      { type: 'RECHARGE', objectId: 'AL4-BOX-1' }, { type: 'RECHARGE', objectId: 'AL4-FRAME-1' },
      { type: 'PREPARE_COMBAT_PLATE' }, { type: 'ENCOUNTER_TALK' }, { type: 'ENCOUNTER_FIGHT' }, { type: 'LEAVE_ENCOUNTER' },
    ]);
    for (const action of inheritedActions) {
      expect(action.enabled, action.id).toBe(false); expect(action.reason, action.id).toBeTruthy();
    }
    await openGrowth(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it.each([1, 2, 3, 4])('submits exact saved round%s once and reopens its real injury, fallback and resource result', async number => {
    const capture = boundary(`combat-round-${number}`), game = savedGame(capture.before), before = structuredClone(game.state);
    if (capture.intent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual saved combat command.');
    const intent = capture.intent, battle = projectSliceState(before).combat!;
    await mount(game); await acknowledgeRound();
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    const resources = within(stage).getByRole('region', { name: '文明启蒙者本回合实际资源' });
    expect(resources.textContent).toContain(`本人健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);
    expect(resources.textContent).toContain('AL4-BOX-1：储能0、耐久100');
    expect(resources.textContent).toContain('AL4-FRAME-1：储能0、耐久95');
    expect(battle.civilizationEnlightener!.targetId).toBe('CE1-ADRIAN-HALE');
    expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
    const stance = battle.stances.find(stance => stance.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, intent);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), capture.final.lastCombatRound!);
    cleanup(); await mount(game);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), capture.final.lastCombatRound!);
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('keeps the wounded retreat history through actual ordinary work and repeated saved reopening', async () => {
    const capture = boundary('ordinary-life-after-exit'), game = savedGame(capture.before), before = structuredClone(game.state);
    expect(before).toMatchObject({ status: 'ACTIVE', health: 60, combat: null });
    expect(before.civilizationEnlightener.encounter.terminal).toMatchObject({ outcome: 'RETREATED', round: 4, exitMetres: 4, exitSeconds: 4 });
    await mount(game);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), before.lastCombatRound!);
    await acknowledgeRound();
    if (screen.queryByRole('button', { name: '返回普通生活' })) await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(await screen.findByRole('button', { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    expect(game.state).toMatchObject({ week: 188, health: 60, mind: 98, spirituality: 120, cash: 436, actionsRemaining: 3, random: { cursor: 346 } });
    expect(game.state.injuries.map(injury => injury.severity)).toEqual(['LIGHT', 'HEAVY']);
    for (let n = 0; n < 2; n++) {
      cleanup(); await mount(game);
      assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), capture.final.lastCombatRound!);
      await acknowledgeRound();
      if (screen.queryByRole('button', { name: '返回普通生活' })) await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
      await openGrowth(); assertResources(capture.final);
      const encounter = screen.getByRole('region', { name: '文明启蒙者可选真实交战' });
      expect(encounter.textContent).toContain('已撤退'); expect(encounter.textContent).toContain('健康90/100、精神100/100、灵性83/120');
      expect(encounter.textContent).toContain('原可见机械储能1/4');
      expect(screen.getByRole('region', { name: '文明启蒙者当前资源' }).textContent).toContain('现有伤势2处');
      expect(screen.queryByRole('button', { name: '确认开始真实交战' })).toBeNull();
      expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
    }
  });
});
