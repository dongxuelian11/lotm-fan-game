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
const ROOT = 'tests/fixtures/beauty-goddess-v01900';
const PANEL = '美神成长';
const ENTRY = '美神与原玻璃廊';
const natural = (key: string) => migrateSliceState(readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
const boundary = (name: string) => {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual Beauty Goddess boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const snapshot = (name: string) => {
  const snapshots = readObjectEntry<Record<string, string>>(`${ROOT}/natural.json`, 'snapshots');
  if (!snapshots[name]) throw new Error(`Missing actual Beauty Goddess snapshot: ${name}`);
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
  await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
  return screen.findByRole('region', { name: PANEL });
}
function assertResources(state: SliceState) {
  const current = projectSliceState(state), resources = screen.getByRole('region', { name: '美神当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${current.beautyGoddess.title}`);
  expect(resources.textContent).toContain(`健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${current.actionsRemaining} · 现有伤势${current.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
async function capturedControl(state: SliceState, intent: SliceIntent) {
  if (intent.type !== 'BEAUTY_GODDESS') throw new Error('Expected a captured public Beauty Goddess command.');
  const value = projectSliceState(state).beautyGoddess;
  const action = value.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  let button = screen.queryByRole('button', { name: name => name.startsWith(action!.label) });
  if (!button) {
    await userEvent.click(screen.getByText('其他操作与普通替代', { selector: 'summary' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '美神其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(action!.label) });
  }
  return button;
}
function assertRound(reveal: HTMLElement, round: SliceCombatRound) {
  const outcome = round.beautyGoddessOutcome;
  if (!outcome) throw new Error('Expected the actual saved Beauty Goddess round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  const record = within(reveal).getByRole('region', { name: '美神本回合实际记录' });
  expect(record.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(record.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(record).getAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, i) => {
    expect(rows[i]!.textContent).toContain(action.label);
    expect(rows[i]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
    expect(rows[i]!.textContent).toContain(`本槽实际原纸${action.paperId ?? '未使用'}、月片${action.pieceId ?? '未使用'}；对手原杆储能消耗${action.rodChargeSpent}`);
    expect(rows[i]!.textContent).toContain(`实灯余油${action.materialsAfter.lamp?.fuelSeconds ?? 0}秒`);
    if (action.fallbackReason) expect(rows[i]!.textContent).toContain(action.fallbackReason);
    if (action.finiteResult === 'PENDING') expect(rows[i]!.textContent).toContain('当前只是建立有限窗口，尚未对后续动作生效');
    if (action.finiteResult === 'APPLIED') expect(rows[i]!.textContent).toContain('有限窗口已经在这个实际动作中消耗');
  });
  const text = reveal.textContent!.replace(/\s+/g, ' ');
  if (round.consequenceDomain === 'BODY') {
    expect(record.textContent).toContain('本回合按实际身体冲击结算伤势');
    expect(round.consequenceWeights).not.toBeNull();
    const weights = round.consequenceWeights!;
    expect(text).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
    expect(text).not.toContain('精神后果盘');
  } else if (round.consequenceDomain === 'MENTAL') {
    expect(record.textContent).toContain('本回合按实际精神压力结算，不生成身体伤口');
    expect(round.consequenceWeights).not.toBeNull();
    const weights = round.consequenceWeights!;
    expect(text).toContain(`精神后果盘：损耗10点 ${weights.light}% · 损耗25点 ${weights.heavy}% · 损耗40点 ${weights.death}%`);
    expect(text).not.toContain('败者后果盘：轻伤');
  } else {
    expect(round.consequenceDomain).toBeUndefined(); expect(round.consequenceWeights).toBeNull();
    expect(record.textContent).toContain('本回合没有身体或精神后果盘');
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


describe('Beauty Goddess actual saved campaign navigation and reopening', () => {
  it('opens optional S1 preparation from the exact S2 body and returns to its original Life Giver page', async () => {
    const game = savedGame(natural('prefixFinal')), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(2); expect(before.beautyGoddess.guidanceKnown).toBe(false);
    expect(before.lastCombatRound?.lifeGiverOutcome).toBeTruthy();
    await mount(game);
    const history = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(history.textContent).toContain(projectSliceState(before).lastCombatRound!.consequence);
    expect(within(history).queryByRole('region', { name: '美神本回合实际记录' })).toBeNull();
    await acknowledgeRound(); await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(await screen.findByRole('region', { name: '美神服药准备' })).toBeTruthy(); assertResources(before);
    expect(screen.getByRole('region', { name: '美神当前资源' }).textContent).toContain('现有伤势3处');
    const guest = screen.getByRole('region', { name: '同一流灯的当前资源' });
    expect(guest.textContent).toContain('健康100/100 · 精神92/100 · 精力88/100');
    expect(guest.textContent).toContain('累计普通行走334米');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '创生者' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  it('separately saves the actual female-body acknowledgment once without consuming a bottle or changing resources', async () => {
    const capture = boundary('explicit-successful-female-body-confirmation'), game = savedGame(capture.before), before = structuredClone(game.state);
    expect(capture.intent).toEqual({ type: 'BEAUTY_GODDESS', command: { type: 'CONFIRM_TRANSFORMATION', confirmed: true } });
    await mount(game); await acknowledgeRound();
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    const trigger = await capturedControl(before, capture.intent); await userEvent.click(trigger);
    let dialog = screen.getByRole('dialog', { name: '美神操作确认' });
    expect(within(dialog).getByRole('region', { name: '本次身体变化确认' }).textContent).toContain('当前身体已经为女性。成功晋升美神后仍为女性');
    expect(dialog.textContent).toContain('不会服药，也不会立即改变身体'); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(before);
    await userEvent.click(trigger); dialog = screen.getByRole('dialog', { name: '美神操作确认' });
    const confirm = within(dialog).getByRole('button', { name: '确认接受晋升后的身体变化' }); fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    expect(game.state.beautyGoddess.transformation).toMatchObject({ originalGender: 'FEMALE', decision: 'ACCEPTED', outcome: null });
    expect(game.state.beautyGoddess.bottles).toEqual(before.beautyGoddess.bottles);
    cleanup(); await mount(game); await acknowledgeRound();
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    assertResources(capture.final);
    expect(screen.getByRole('region', { name: '美神身体变化记录' }).textContent).toContain('第133周已单独确认接受身体变化');
    expect(screen.getByRole('region', { name: '美神身体变化记录' }).textContent).toContain('尚未发生成功服药后的身体变化');
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('confirms the real first failed bottle once and reopens its paid failure with the original female body', async () => {
    const capture = boundary('consume-beauty-goddess-potion-1'), game = savedGame(capture.before), before = structuredClone(game.state);
    await mount(game); await acknowledgeRound();
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await userEvent.click(await capturedControl(before, capture.intent));
    const dialog = screen.getByRole('dialog', { name: '美神操作确认' });
    expect(dialog.textContent).toContain('第1瓶'); expect(dialog.textContent).toContain('当前成功率44%');
    expect(dialog.textContent).toContain('服药失败不改变原有身体性别'); expect(dialog.textContent).toContain('已保存的身体变化确认不代替本次服药选择');
    expect(game.submit).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一原瓶' }); fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    expect(game.state).toMatchObject({ health: 85, mind: 75, cash: 24, progression: { sequence: 2 }, character: { gender: 'FEMALE' } });
    cleanup(); await mount(game); await acknowledgeRound();
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '美神目标' }), 'beauty-goddess-potion-1');
    expect(screen.getByRole('region', { name: '独立原药瓶' }).textContent).toContain('已耗尽');
    expect(screen.getByRole('region', { name: '美神身体变化记录' }).textContent).toContain('当前身体：女性');
    assertResources(capture.final); expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('confirms the eighth original bottle and reopens21 unchanged inherited abilities and two new zeros', async () => {
    const capture = boundary('consume-beauty-goddess-potion-8'), game = savedGame(capture.before), before = structuredClone(game.state);
    expect(before.beautyGoddess.bottles.slice(0, 7).map(bottle => bottle.outcome)).toEqual(Array(7).fill('FAILURE'));
    await mount(game); await acknowledgeRound();
    if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    await userEvent.click(await capturedControl(before, capture.intent));
    const dialog = screen.getByRole('dialog', { name: '美神操作确认' });
    expect(dialog.textContent).toContain('第8瓶'); expect(dialog.textContent).toContain('成功晋升美神后仍为女性');
    expect(game.submit).not.toHaveBeenCalled();
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一原瓶' }); fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    expect(game.state.beautyGoddess.bottles[7]!.outcome).toBe('GREAT_SUCCESS');
    cleanup(); await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const panel = await openGrowth(); assertResources(capture.final);
    expect(screen.queryByRole('region', { name: '创生者' })).toBeNull();
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(game.state).beautyGoddess.abilities;
    expect(abilities).toHaveLength(23); expect(abilities.slice(0, 21).filter(ability => ability.mastery === 0)).toHaveLength(7);
    expect(abilities.slice(21).map(ability => ability.mastery)).toEqual([0, 0]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(screen.getByRole('region', { name: '美神身体变化记录' }).textContent).toContain('成功服药后的身体结果已保存');
    expect(screen.getByRole('region', { name: '同一流灯的当前资源' }).textContent).toContain('健康100/100 · 精神92/100 · 精力88/100');
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the actual840-command live invitation and walks the public next60 metres before consent', async () => {
    const capture = boundary('steady-hands-actual60metre-walk'), game = savedGame(capture.before), before = structuredClone(game.state);
    expect(before.revision).toBe(841); expect(before.beautyGoddess.life.cases['steady-hands'].visited).toBe(false);
    await mount(game); expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy(); assertResources(before);
    expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull(); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect((screen.getByRole('combobox', { name: '美神目标' }) as HTMLSelectElement).disabled).toBe(true);
    expect(projectSliceState(before).beautyGoddess.actions.some(action => action.command.type === 'CONSENT')).toBe(false);
    await userEvent.click(await capturedControl(before, capture.intent));
    const confirm = within(screen.getByRole('dialog', { name: '美神操作确认' })).getByRole('button', { name: '确认执行这一次操作' });
    fireEvent.click(confirm); fireEvent.click(confirm);
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    cleanup(); await mount(game);
    expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('本人累计实走60米');
    const next = projectSliceState(game.state).beautyGoddess.actions.find(action => action.enabled && action.command.type === 'CONSENT');
    expect(next).toBeDefined(); expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('尚未询问本次许可');
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens the paid finite window and submits the same Lumen’s independent carry without early mastery', async () => {
    const capture = boundary('same-guest-independent-carry'), game = savedGame(capture.before), before = structuredClone(game.state);
    await mount(game); assertResources(before);
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('月辉定形还剩');
    expect(screen.getByRole('region', { name: '原灯遮板与实付月片' }).textContent).toContain('第1片月片：已经耗尽');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    await userEvent.click(await capturedControl(before, capture.intent));
    await userEvent.click(within(screen.getByRole('dialog', { name: '美神操作确认' })).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    expect(game.state.beautyGoddess.life.practice.pendingMoonform).toBeNull(); expect(game.state.progression.mastery['moon.s1.bounded-moonform']).toBe(0);
    cleanup(); await mount(game);
    const finite = screen.getByRole('region', { name: '两项能力的有限窗口' });
    expect(finite.textContent).toContain('当前没有可应用的月辉定形窗口');
    expect(finite.textContent).toContain('本次能力判定：成功；独立普通操作：成功');
    expect(screen.getByRole('region', { name: '同一流灯的当前资源' }).textContent).toContain('精力82/100');
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('saves real shutter obscuration without refunding the successful but unapplied window', async () => {
    const capture = boundary('real-shutter-blocks-window'), game = savedGame(capture.before), before = structuredClone(game.state);
    await mount(game); expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('月辉定形还剩');
    await userEvent.click(await capturedControl(before, capture.intent));
    await userEvent.click(within(screen.getByRole('dialog', { name: '美神操作确认' })).getByRole('button', { name: '确认执行这一次操作' }));
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    cleanup(); await mount(game); assertResources(capture.final);
    expect(screen.getByRole('region', { name: '原灯遮板与实付月片' }).textContent).toContain('遮板已经放下，光路受阻');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('当前没有可应用的月辉定形窗口');
    expect(game.state.beautyGoddess.life.cases['withdrawn-moonlight']).toMatchObject({ moonformOutcome: 'SUCCESS', moonformEnd: 'OBSCURED', moonformApplied: false });
    expect(game.state.progression.mastery['moon.s1.bounded-moonform']).toBe(8);
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('reopens all three honest reports with mastery0/8, actual returns and withdrawn permission', async () => {
    const game = savedGame(snapshot('practiced')), before = structuredClone(game.state);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await openGrowth(); assertResources(before);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '美神目标' }), 'steady-hands');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('本次能力判定：失败；独立普通操作：失败');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '美神目标' }), 'lit-crossing');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('本次能力判定：成功；独立普通操作：成功');
    expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('本案实际还物与归程已完成');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '美神目标' }), 'withdrawn-moonlight');
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('流灯的本次搬运：已经撤回');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('本次能力判定：成功；独立普通操作：尚未进行');
    const guest = screen.getByRole('region', { name: '同一流灯的当前资源' });
    expect(guest.textContent).toContain('健康100/100 · 精神92/100 · 精力79/100'); expect(guest.textContent).toContain('累计普通行走338米');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect((screen.getByRole('button', { name: /^工作，1行动/ }) as HTMLButtonElement).disabled).toBe(false);
    await openGrowth(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  });

  // Both captured consequences are BODY. Round1 also has a real enemy mental
  // pressure slot: it must not relabel the player's winning body consequence.
  it.each([1, 2])('submits exact saved round%s once and reopens its real BODY consequence and finite costs', async number => {
    const capture = boundary(`combat-round-${number}`), game = savedGame(capture.before), before = structuredClone(game.state);
    if (capture.intent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual saved combat command.');
    const intent = capture.intent, battle = projectSliceState(before).combat!;
    await mount(game); await acknowledgeRound();
    const stage = await screen.findByRole('dialog', { name: battle.title! });
    const resources = within(stage).getByRole('region', { name: '美神本回合实际资源' });
    expect(resources.textContent).toContain(`本人健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);
    expect(resources.textContent).toContain('流灯仍在原家，健康100、精神92、精力79'); expect(resources.textContent).toContain('原纸可用0张');
    expect(battle.beautyGoddess!.targetId).toBe('BG1-OSWALD-REED'); expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
    const stance = battle.stances.find(stance => stance.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, intent);
    expect(capture.final.lastCombatRound!.consequenceDomain).toBe('BODY');
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), capture.final.lastCombatRound!);
    cleanup(); await mount(game);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), capture.final.lastCombatRound!);
    expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it('keeps actual surrender, the unspent returned battle pieces and ordinary work through repeated reopening', async () => {
    const capture = boundary('ordinary-life-after-exit'), game = savedGame(capture.before), before = structuredClone(game.state);
    expect(before.beautyGoddess.encounter.terminal).toMatchObject({ outcome: 'ENEMY_SURRENDERED', round: 2, exitMetres: 4, exitSeconds: 4 });
    await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), before.lastCombatRound!);
    await acknowledgeRound();
    if (screen.queryByRole('button', { name: '返回普通生活' })) await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(await screen.findByRole('button', { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state).toEqual(capture.final)); assertEnvelope(game, before, capture.intent);
    expect(game.state).toMatchObject({ week: 219, health: 100, mind: 98, spirituality: 110, cash: 314, actionsRemaining: 3, injuries: [], random: { cursor: 352 } });
    for (let n = 0; n < 2; n++) {
      cleanup(); await mount(game);
      assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), capture.final.lastCombatRound!); await acknowledgeRound();
      if (screen.queryByRole('button', { name: '返回普通生活' })) await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
      await openGrowth(); assertResources(capture.final);
      const encounter = screen.getByRole('region', { name: '美神可选真实交战' });
      expect(encounter.textContent).toContain('已投降'); expect(encounter.textContent).toContain('健康60/100、精神100/100、灵性80/120');
      expect(screen.getByRole('region', { name: '独立战场灯与有限月片' }).textContent).toContain('剩余燃料56/180秒');
      expect(screen.getByRole('region', { name: '对手原月杆与有限资源' }).textContent).toContain('可见冲击储能1/4');
      expect(screen.queryByRole('button', { name: '确认开始真实交战' })).toBeNull();
      expect(game.state).toEqual(capture.final); expect(game.submit).toHaveBeenCalledTimes(1);
    }
  });
});
