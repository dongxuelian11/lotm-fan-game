/* @vitest-environment jsdom */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { PureWhiteAngelPanel } from '../../src/renderer/PureWhiteAngelPanel';
import { CURRENT_CONTENT_VERSION, CURRENT_SCHEMA_VERSION } from '../helpers/current-save-format';
import { stableStringify } from '../../src/domain/canonical';
import { readObjectEntry } from '../helpers/read-object-entry';

const ROOT = 'tests/fixtures/pure-white-angel-v01940';
const PANEL = '纯白天使成长';
const ENTRY = '纯白天使与采光廊';
const FOCUSED = 'sun.s1.focused-purification', GUARD = 'sun.s1.warm-radiance-guard';
const SOURCE = 'tests/fixtures/light-seeker-v01720/natural.json';
const EDITORIAL = /候选|原创G|本作G|原文未核|编号推断|来源未知|\"command\"|\"beforeLast\"/;
const natural = (key: string) => migrateSliceState(readObjectEntry<unknown>(`${ROOT}/natural.json`, key));
const boundary = (name: string) => {
  const index = JSON.parse(readFileSync(`${ROOT}/boundaries.index.json`, 'utf8')) as Record<string, string>;
  if (!index[name]) throw new Error(`Missing actual Pure White Angel boundary: ${name}`);
  const file = `${ROOT}/${index[name]}`;
  return { before: migrateSliceState(readObjectEntry<unknown>(file, 'beforeLast')),
    intent: readObjectEntry<SliceIntent>(file, 'lastIntent'), final: migrateSliceState(readObjectEntry<unknown>(file, 'final')) };
};
const snapshot = (name: string) => {
  const snapshots = readObjectEntry<Record<string, string>>(`${ROOT}/natural.json`, 'snapshots');
  if (!snapshots[name]) throw new Error(`Missing actual Pure White Angel snapshot: ${name}`);
  return migrateSliceState(JSON.parse(readFileSync(`${ROOT}/${snapshots[name]}`, 'utf8')));
};

/** Actual producer boundaries only. No edited body, selected future RNG, invented
 * cast/application, substituted originals or replay of the complete campaign. Each persisted boundary is migrated before use. */
function savedGame(input: unknown) {
  let state = migrateSliceState(input); assertValidSliceState(state);
  expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  expect(state.contentVersion).toBe(CURRENT_CONTENT_VERSION);
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
  assertAuthoredCopy(game.state);
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
function assertAuthoredCopy(state: SliceState) {
  // Authored copy is checked separately from exact user-supplied names.
  const authored = document.body.textContent!.split(state.character.name).join('');
  expect(authored).not.toMatch(EDITORIAL);
}
function assertResources(state: SliceState) {
  const current = projectSliceState(state), resources = screen.getByRole('region', { name: '纯白天使当前资源' });
  expect(screen.getByRole('banner').textContent).toContain(`${state.character.name} · ${current.pureWhiteAngel.title}`);
  expect(resources.textContent).toContain(`健康${current.health}/${current.maxHealth} · 精神${current.mind}/${current.maxMind} · 灵性${current.spirituality}/${current.maxSpirituality}`);
  expect(resources.textContent).toContain(`本周行动${current.actionsRemaining} · 现有伤势${current.injuries.length}处 · 累计风险${state.injuryRisk}`);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent, count = 1) {
  expect(game.submit).toHaveBeenCalledTimes(count);
  expect(game.submit).toHaveBeenNthCalledWith(count, { intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
async function capturedControl(state: SliceState, intent: SliceIntent) {
  if (intent.type !== 'PURE_WHITE_ANGEL') throw new Error('Expected a captured public Pure White Angel command.');
  const action = projectSliceState(state).pureWhiteAngel.actions.find(action => stableStringify(action.command) === stableStringify(intent.command));
  expect(action).toBeDefined(); expect(action!.enabled).toBe(true);
  const permissions = { OWNER: '玛拉的原采光廊许可', TECHNICIAN: '伊文本次参与', ABILITY: '本人本次使用能力' };
  const label = action!.label + ('permission' in intent.command ? `：${permissions[intent.command.permission]}` : '');
  let button = screen.queryByRole('button', { name: name => name.startsWith(label) });
  if (!button) {
    const summary = screen.getByText('其他操作与普通替代', { selector: 'summary' });
    if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: '纯白天使其他操作' }), action!.id);
    button = screen.getByRole('button', { name: name => name.startsWith(label) });
  }
  return button;
}
async function commitCaptured(game: SavedGame, save: ReturnType<typeof boundary>, count = 1) {
  expect(game.state).toEqual(save.before);
  await userEvent.click(await capturedControl(save.before, save.intent));
  expect(game.submit).toHaveBeenCalledTimes(count - 1);
  const dialog = screen.getByRole('dialog', { name: '纯白天使操作确认' });
  const confirm = within(dialog).getByRole('button', { name: /^(确认执行这一次操作|确认服用这一原瓶|确认开始真实交战)$/ });
  fireEvent.click(confirm); fireEvent.click(confirm);
  await waitFor(() => expect(game.state).toEqual(save.final)); assertEnvelope(game, save.before, save.intent, count);
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '纯白天使操作确认' })).toBeNull());
  assertAuthoredCopy(game.state);
}
function assertRound(reveal: HTMLElement, state: SliceState) {
  const round = projectSliceState(state).lastCombatRound!;
  const outcome = round.pureWhiteAngelOutcome;
  if (!outcome) throw new Error('Expected the actual saved Pure White Angel round.');
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  expect(reveal.textContent).toContain(round.consequence);
  expect(reveal.textContent).toContain(`你的次数盘：${round.playerCount}次（掷骰 ${round.playerCountRoll}）`);
  expect(reveal.textContent).toContain(`对手次数盘：${round.enemyCount}次（掷骰 ${round.enemyCountRoll}）`);
  const record = within(reveal).getByRole('region', { name: '纯白天使本回合实际记录' });
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
    if (action.finiteResult === 'APPLIED') expect(rows[i]!.textContent).toContain('有限窗口已经在这个实际动作中消耗');
    if (action.finiteResult === 'PENDING') expect(rows[i]!.textContent).toContain('当前只是建立有限窗口，尚未对后续动作生效');
  });
  const text = reveal.textContent!.replace(/\s+/g, ' ');
  expect(text).toContain(`本回合胜率 ${Number.isInteger(round.winChance) ? round.winChance : round.winChance.toFixed(1)}%`);
  expect(text).toContain(`双方最终优势：你 ${round.playerAdvantage} / 对手 ${round.enemyAdvantage}`);
  expect(round.moves).toEqual(actions.map(action => ({ actor: action.actor, label: action.label, selfGain: action.selfGain, enemyReduction: action.enemyReduction })));
  expect(outcome.consequenceDomain).toBe(round.consequenceDomain ?? 'NONE');
  assertAuthoredCopy(state);
  if (round.consequenceDomain === 'BODY') {
    expect(record.textContent).toContain('本回合按实际身体冲击结算伤势');
    const weights = round.consequenceWeights!;
    expect(text).toContain(`败者后果盘：轻伤 ${weights.light}% · 重伤 ${weights.heavy}% · 死亡 ${weights.death}%`);
    expect(text).not.toContain('精神后果盘');
  } else if (round.consequenceDomain === 'MENTAL') {
    expect(record.textContent).toContain('本回合按实际精神压力结算，不生成身体伤口');
    expect(round.consequenceWeights).toBeNull();
    expect(text).toContain('没有新增身体伤口或身体风险');
    expect(text).toContain('实际精神来源：DAZZLING_PRESSURE');
    expect(text).not.toContain('精神后果盘'); expect(text).not.toContain('败者后果盘：轻伤');
  } else {
    expect(round.consequenceWeights).toBeNull(); expect(record.textContent).toContain('本回合没有身体或精神后果盘');
    expect(text).not.toContain('败者后果盘：轻伤'); expect(text).not.toMatch(/精神后果盘[：:]/);
  }
}
async function assertWheels(state: SliceState, stance: 'CONTROL') {
  const battle = projectSliceState(state).combat!;
  const stage = screen.getByRole('dialog', { name: battle.title! });
  const summary = within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' });
  if (!(summary.closest('details') as HTMLDetailsElement).open) await userEvent.click(summary);
  const text = summary.parentElement!.textContent!.replace(/\s+/g, ' ');
  const wheel = (entries: { label: string; weight: number }[]) => entries
    .map(entry => `${entry.label} ${Number.isInteger(entry.weight) ? entry.weight : entry.weight.toFixed(1)}%`).join('，');
  expect(text).toContain(`你的次数盘：${wheel(battle.playerCountWheel)}`);
  expect(text).toContain(`对手次数盘：${wheel(battle.enemyCountWheel)}`);
  expect(text).toContain(`你的能力盘：${wheel(battle.playerAbilityWheels?.[stance] ?? battle.playerAbilityWheel)}`);
  expect(text).toContain(`对手能力盘：${wheel(battle.enemyAbilityWheel)}`);
  expect(text).toContain(`你再次败北的后果盘：轻伤 ${battle.consequenceWeights.light}% · 重伤 ${battle.consequenceWeights.heavy}% · 死亡 ${battle.consequenceWeights.death}%`);
}
async function submitRound(game: SavedGame, save: ReturnType<typeof boundary>) {
  if (save.intent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual saved round command.');
  await acknowledgeRound();
  const battle = projectSliceState(save.before).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
  const stanceId = save.intent.stance, stance = battle.stances.find(stance => stance.id === stanceId)!;
  await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
  expect(game.state).toEqual(save.before); expect(game.submit).not.toHaveBeenCalled();
  expect(stanceId).toBe('CONTROL'); await assertWheels(save.before, 'CONTROL');
  const confirm = within(stage).getByRole('button', { name: '确认姿态，结算完整回合' });
  fireEvent.click(confirm); fireEvent.click(confirm);
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

describe('Pure White Angel actual saved campaign navigation and reopening', () => {
  it('keeps raw169 source evidence separate from CURRENT migration and exposes the untouched729-command living departure', async () => {
    const raw = readObjectEntry<SliceState>(SOURCE, 'final'), unchanged = stableStringify(raw);
    expect(raw).toMatchObject({ schemaVersion: 169, contentVersion: 'light-seeker-v169', revision: 730, week: 175,
      status: 'ACTIVE', health: 50, mind: 100, spirituality: 87, cash: 540, actionsRemaining: 3, injuryRisk: 3 });
    expect(createHash('sha256').update(unchanged).digest('hex')).toBe('07cac5fb2cbe060c179152c3f634bbc70a4534a2d2b752399bf31ae08df450ff');
    expect(readObjectEntry<SliceIntent[]>(SOURCE, 'commands')).toHaveLength(729);
    expect(raw.injuries.map(injury => [injury.severity, injury.treatedRevision])).toEqual([['LIGHT', null], ['LIGHT', null], ['HEAVY', null]]);
    expect(Object.keys(raw.progression.mastery)).toHaveLength(20);
    expect(Object.values(raw.progression.mastery).filter(value => value === 0)).toHaveLength(5);
    const current = migrateSliceState(raw), game = savedGame(current);
    expect(current).toMatchObject({ schemaVersion: CURRENT_SCHEMA_VERSION, contentVersion: CURRENT_CONTENT_VERSION });
    expect(natural('prefixFinal')).toEqual(current);
    expect(current.pureWhiteAngel.guidanceKnown).toBe(false);
    expect(current.pureWhiteAngel.promotionWeek).toBeNull();
    expect(current.lightSeeker.encounter).toMatchObject({ status: 'RESOLVED', targetId: 'LS2-OWEN', enemyStatus: 'DEAD', enemyHealth: 0 });
    await mount(game); await ensurePanel(); assertResources(current);
    expect(screen.getByRole('region', { name: '纯白天使服药准备' })).toBeTruthy();
    expect(projectSliceState(current).pureWhiteAngel).toMatchObject({ formulaKnown: false, formula: [] });
    await userEvent.click(screen.getByText('原采光廊、玛拉、芦影与旧物当前记录', { selector: 'summary' }));
    const originals = screen.getByRole('region', { name: '原采光廊当前状态' });
    expect(originals.textContent).toContain('玛拉 · 46岁；精力90/100');
    expect(originals.textContent).toContain('原油灯余油3份');
    expect(originals.textContent).toContain('耐久81/100，已经实际操作19次');
    expect(originals.textContent).toContain('芦影是同一独立灵体；精力96/100');
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: '查看采光廊与晋升' }));
    expect(await screen.findByRole('region', { name: PANEL })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(await screen.findByRole('region', { name: '逐光者有限切片' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    expect(game.state).toEqual(current); expect(game.submit).not.toHaveBeenCalled();
    expect(stableStringify(raw)).toBe(unchanged);
    expect(stableStringify(readObjectEntry<SliceState>(SOURCE, 'final'))).toBe(unchanged);
  }, 60_000);

  it('confirms the actual first-bottle great success once and gives reopened S1 growth priority over old Sun stages', async () => {
    const save = boundary('actual-consumption-pure-white-angel-potion-1'), game = savedGame(save.before);
    await mount(game); await ensurePanel(); assertResources(save.before);
    expect(screen.getByRole('region', { name: '纯白天使阶段总览' }).textContent).toContain('当周准备已支付，选择原瓶');
    expect((screen.getByRole('combobox', { name: '纯白天使目标' }) as HTMLSelectElement).value).toBe('pure-white-angel-potion-1');
    await userEvent.click(await capturedControl(save.before, save.intent));
    const dialog = screen.getByRole('dialog', { name: '纯白天使操作确认' });
    expect(dialog.textContent).toContain('第1瓶');
    expect(dialog.textContent).toContain(`当前成功率${projectSliceState(save.before).pureWhiteAngel.bottles[0]!.chance}%`);
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    expect(dialog.textContent).toContain('不改变性别、姓名、年龄、性格与取向');
    expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' }));
    expect(game.state).toEqual(save.before);
    await commitCaptured(game, save); cleanup(); await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    const panel = await openGrowth(); assertResources(save.final);
    expect(screen.queryByRole('region', { name: '逐光者有限切片' })).toBeNull();
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' }));
    const abilities = projectSliceState(game.state).pureWhiteAngel.abilities;
    expect(abilities).toHaveLength(22);
    expect(abilities.slice(0, 20).filter(ability => ability.mastery === 0)).toHaveLength(5);
    expect(abilities.slice(20).map(ability => [ability.id, ability.mastery])).toEqual([[FOCUSED, 0], [GUARD, 0]]);
    for (const ability of abilities) expect(within(panel).getByRole('heading', { name: `${ability.label} · 掌握${ability.mastery}` })).toBeTruthy();
    expect(game.state).toMatchObject({ revision: 768, week: 186, health: 100, mind: 92, spirituality: 120,
      cash: 20, injuries: [], injuryRisk: 0, progression: { sequence: 1, acting: 0 } });
    expect(game.state.pureWhiteAngel.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'GREAT_SUCCESS', consumedWeek: 186 });
    expect(game.state.pureWhiteAngel.bottles.slice(1)).toEqual(save.before.pureWhiteAngel.bottles.slice(1));
    expect(game.state.pureWhiteAngel.preparedWeek).toBeNull();
    expect({ ...game.state.character, coreStats: save.before.character.coreStats }).toEqual(save.before.character);
    expect(game.state).toEqual(snapshot('promoted')); expect(game.state).toEqual(save.final);
    expect(game.submit).toHaveBeenCalledTimes(1); assertAuthoredCopy(game.state);
  }, 60_000);

  it('saves the actual focused window separately from the one finite residue application and reopens both', async () => {
    const cast = boundary('residue-trace-one-paid-focused-window-attempt');
    const cleanse = boundary('residue-trace-separate-actual-will18-check-and-finite-unit-result');
    const game = savedGame(cast.before); await mount(game); assertResources(cast.before);
    await commitCaptured(game, cast); cleanup(); await mount(game);
    expect(game.state.pureWhiteAngel.life.pending).toMatchObject({ kind: 'FOCUSED', createdAt: 1027, expiresAt: 1057, sampleVersion: 1 });
    expect(game.state.pureWhiteAngel.life.sample).toMatchObject({ id: 'PW1-RESIDUE-1', residueUnits: 1, version: 1 });
    expect(game.state.progression.mastery[FOCUSED]).toBe(0);
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('净光定向还剩30秒，等待一次独立清理；尚未清除残留');
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect((screen.getByRole('combobox', { name: '纯白天使目标' }) as HTMLSelectElement).disabled).toBe(true);
    await commitCaptured(game, cleanse, 2); cleanup(); await mount(game); assertResources(cleanse.final);
    expect(game.state.pureWhiteAngel.life.pending).toBeNull();
    expect(game.state.pureWhiteAngel.life.cases['residue-trace'].attempts[0]).toMatchObject({
      cleanseTier: 'SUCCESS', focused: { attempts: 1, successes: 1, effects: 1, state: 'APPLIED' } });
    expect(game.state.pureWhiteAngel.life.sample).toMatchObject({ id: 'PW1-RESIDUE-1', residueUnits: 0, contained: false, version: 2 });
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('原样本残留已为0');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('已经实际应用，实际应用1次');
    // The saved report is a later command; the separate cleanse cannot award it early.
    expect(game.state.progression.mastery[FOCUSED]).toBe(0);
    expect([game.state.health, game.state.mind, game.state.spirituality]).toEqual([100, 98, 112]);
    expect(game.state).toEqual(cleanse.final); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 60_000);

  it('preserves the actual failed guard and ordinary handle reset, with paid costs, pad wear and no invented protection', async () => {
    const cast = boundary('personal-impact-one-paid-personal-guard-attempt');
    const reset = boundary('personal-impact-ordinary-safe-reset-after-failed-guard-with-actual-pad-wear');
    const game = savedGame(cast.before); await mount(game);
    await commitCaptured(game, cast); cleanup(); await mount(game); assertResources(cast.final);
    expect(game.state.pureWhiteAngel.life.pending).toBeNull();
    expect(game.state.pureWhiteAngel.life.cases['personal-impact'].attempts[0]!.guard)
      .toMatchObject({ attempts: 1, successes: 0, effects: 0, tier: 'FAILURE', state: 'FAILED' });
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('失败，判定失败，实际应用0次');
    expect(within(screen.getByRole('region', { name: '当前主要操作' })).getByRole('button').textContent).toContain('普通手动复位，原垫仍损10耐久');
    await commitCaptured(game, reset, 2); cleanup(); await mount(game); assertResources(reset.final);
    expect(game.state.pureWhiteAngel.life.pad).toMatchObject({ id: 'PW1-PAD-1', durability: 90, impacts: 0, resets: 1 });
    expect(game.state.pureWhiteAngel.life.cases['personal-impact'].attempts[0]).toMatchObject({
      impactReleased: false, impactReset: true, healthPrevented: 0, result: 'ORDINARY' });
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('本案已经普通手柄复位');
    expect([game.state.health, game.state.mind, game.state.spirituality]).toEqual([100, 98, 114]);
    expect(game.state.progression.mastery[GUARD]).toBe(0);
    expect(game.state).toEqual(reset.final); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 60_000);

  it('reopens actual condition invalidation, withdrawn consent and ordinary stop/reset/shutter recovery without refund', async () => {
    const saves = ['ivan-actual24metre-walk-and-original-shutter-close-wear', 'current-mara-withdrawal',
      'explicit-ordinary-stop-after-withdrawal', 'ordinary-safe-reset-with-pad10-no-impact-release',
      'ordinary-real-six-metre-walk-and-original-shutter-wear'].map(name => boundary(`screened-return-${name}`));
    const game = savedGame(saves[0]!.before); await mount(game);
    expect(game.state.pureWhiteAngel.life.pending).toMatchObject({ kind: 'GUARD', createdAt: 1187, expiresAt: 1217 });
    expect(game.state.pureWhiteAngel.life.cases['screened-return'].attempts[0]!.guard)
      .toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'ACTIVE' });
    for (const [i, save] of saves.entries()) {
      await commitCaptured(game, save, i + 1); cleanup(); await mount(game); assertResources(save.final);
      expect(game.state.pureWhiteAngel.life.pending).toBeNull();
      expect(game.state.pureWhiteAngel.life.cases['screened-return'].attempts[0]!.guard)
        .toMatchObject({ attempts: 1, successes: 1, effects: 0, state: 'INVALIDATED' });
      expect([game.state.health, game.state.mind, game.state.spirituality, game.state.cash]).toEqual([100, 98, 114, 830]);
      expect(game.state.progression.mastery[GUARD]).toBe(0);
      expect(game.state.pureWhiteAngel.life.cases['screened-return'].attempts[0]!.impactReleased).toBe(false);
    }
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经撤回');
    expect(screen.getByRole('region', { name: '同一原样本与本人护垫' }).textContent).toContain('当前原遮板开放，耐久79/100、实际操作21次');
    expect(screen.getByRole('region', { name: '两项能力的有限窗口' }).textContent).toContain('条件改变，已经失效，实际应用0次');
    expect(game.state.pureWhiteAngel.life.pad).toMatchObject({ id: 'PW1-PAD-1', durability: 80, impacts: 0, resets: 2 });
    expect(game.state.pureWhiteAngel.life.ivan.travelMetres).toBe(89);
    expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
    expect(game.submit).toHaveBeenCalledTimes(5);
  }, 120_000);

  it('asks the same independent spirit and preserves its current refusal without moving or spending its energy', async () => {
    const ask = boundary('residue-trace-ask-same-original-reed-and-record-current-refusal');
    const respect = boundary('residue-trace-respect-original-reed-without-motion-or-energy-cost');
    const game = savedGame(ask.before); await mount(game);
    await commitCaptured(game, ask); cleanup(); await mount(game);
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('明确拒绝来访；待确认尊重本次拒绝');
    await commitCaptured(game, respect, 2); cleanup(); await mount(game);
    expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('明确拒绝来访；已确认尊重本次拒绝');
    const before = ask.before.lightSeeker.life.site, after = game.state.lightSeeker.life.site;
    for (const key of ['spiritId', 'spiritName', 'spiritLocation', 'spiritMetres', 'spiritEnergy'] as const)
      expect(after[key]).toEqual(before[key]);
    expect(after).toMatchObject({ spiritId: 'LS2-REED', spiritLocation: 'SIDE', spiritEnergy: 96, spiritMetres: 18, spiritConsent: 'DECLINED', spiritConsentWeek: 188 });
    expect(game.state.progression.mastery).toEqual(ask.before.progression.mastery);
    expect(game.state).toEqual(respect.final); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 60_000);

  it('reopens all three honest reports and the same returned originals with only the one actual focused application rewarded', async () => {
    const practiced = snapshot('practiced'), game = savedGame(practiced);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await openGrowth(); assertResources(practiced);
    expect(screen.getByRole('region', { name: '纯白天使阶段总览' }).textContent).toContain('生活报告3/3 · 反思已完成 · 纯白天使扮演100/100');
    for (const id of ['residue-trace', 'personal-impact', 'screened-return']) {
      await userEvent.selectOptions(screen.getByRole('combobox', { name: '纯白天使目标' }), id);
      expect(screen.getByRole('region', { name: '实际位置与归还' }).textContent).toContain('本案原样本、护垫与人员的实际收尾已完成');
      expect(screen.getByRole('region', { name: '本案的独立许可' }).textContent).toContain('已经离场');
    }
    expect(screen.getByRole('region', { name: '同一原样本与本人护垫' }).textContent).toContain('超自然残留0份');
    expect(screen.getByRole('region', { name: '同一原样本与本人护垫' }).textContent).toContain('耐久80/100');
    expect([game.state.progression.mastery[FOCUSED], game.state.progression.mastery[GUARD]]).toEqual([8, 0]);
    expect(game.state.pureWhiteAngel.life).toMatchObject({ pending: null, reflected: true, playerLocation: 'OUTSIDE',
      playerTravelMetres: 66, ivan: { present: false, location: 'AWAY', travelMetres: 102 } });
    await userEvent.click(screen.getByText('原采光廊、玛拉、芦影与旧物当前记录', { selector: 'summary' }));
    const originals = screen.getByRole('region', { name: '原采光廊当前状态' });
    expect(originals.textContent).toContain('玛拉 · 46岁；精力84/100');
    expect(originals.textContent).toContain('芦影是同一独立灵体；精力96/100');
    expect(originals.textContent).toContain('原油灯余油3份');
    expect(game.state.lightSeeker.encounter).toEqual(natural('prefixFinal').lightSeeker.encounter);
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' }));
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect(game.state).toEqual(practiced); expect(game.submit).not.toHaveBeenCalled();
  }, 60_000);

  it('confirms the captured ALL strategy and separate Silas fight once without reopening old Owen or replenishing originals', async () => {
    const policy = boundary('fixed-all-policy-before-fight'), fight = boundary('independent-optional-silas-fight');
    const game = savedGame(policy.before); await mount(game); assertResources(policy.before);
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('等待本场明确选择');
    await commitCaptured(game, policy); expect(game.state.combat).toBeNull();
    expect(screen.getByRole('region', { name: '开战前的能力策略' }).textContent).toContain('本场明确选择已经保存');
    await commitCaptured(game, fight, 2);
    const battle = projectSliceState(fight.final).combat!, stage = await screen.findByRole('dialog', { name: battle.title! });
    expect(within(stage).getByRole('region', { name: '纯白天使本回合实际资源' }).textContent).toContain('原杆剩余光击储能4');
    expect(battle.pureWhiteAngel).toMatchObject({ targetId: 'PW1-SILAS-DANE', policy: 'ALL', enemyHealth: 100, enemyMind: 100, enemySpirituality: 120 });
    expect(game.state.lightSeeker.encounter).toMatchObject({ targetId: 'LS2-OWEN', enemyStatus: 'DEAD', enemyHealth: 0 });
    cleanup(); await mount(game); expect(await screen.findByRole('dialog', { name: battle.title! })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '逐光者有限切片' })).toBeNull();
    expect(game.state).toEqual(snapshot('combatStart')); expect(game.state).toEqual(fight.final);
    expect(game.submit).toHaveBeenCalledTimes(2);
  }, 60_000);

  it('submits the sole actual BODY round with its real wheels, nine actions and finite charges, then reopens the living surrender', async () => {
    const save = boundary('combat-round-1'), game = savedGame(save.before); await mount(game);
    expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '人物卷宗' })).toBeNull();
    expect(screen.queryByRole('region', { name: '逐光者有限切片' })).toBeNull();
    await submitRound(game, save);
    const round = game.state.lastCombatRound!, outcome = round.pureWhiteAngelOutcome!;
    expect(round).toMatchObject({ round: 1, stance: 'CONTROL', first: 'PLAYER', playerCount: 5, enemyCount: 4,
      playerCountRoll: 87, enemyCountRoll: 68, consequenceDomain: 'BODY', consequenceRoll: 76,
      consequenceWeights: { light: 65, heavy: 30, death: 5 }, winner: 'PLAYER' });
    expect(outcome.source).toMatchObject({ runId: save.before.runId, revision: 852, week: 195, round: 1,
      targetId: 'PW1-SILAS-DANE', policy: 'ALL', playerHealth: 100, playerMind: 100, playerSpirituality: 120 });
    expect(outcome.playerActions).toHaveLength(5); expect(outcome.enemyActions).toHaveLength(4);
    expect(outcome.enemyActions.map(action => action.attackKind)).toEqual(['NONE', 'MENTAL', 'BODY', 'NONE']);
    expect(outcome.enemyActions.reduce((sum, action) => sum + action.rodChargeSpent, 0)).toBe(1);
    expect(outcome.materialsAfter.weapon).toMatchObject({ id: 'PW1-SILAS-ROD', owner: 'PW1-SILAS-DANE', location: 'FORECOURT', charge: 3, capacity: 4 });
    expect(outcome.materialsAfter.weapon.pieces.map(piece => piece.state)).toEqual(['SPENT', 'CHARGED', 'CHARGED', 'CHARGED']);
    expect(outcome.enemyActions.reduce((sum, action) => sum + action.paidCost, 0)).toBe(21);
    expect(outcome.enemySpirituality).toBe(99);
    expect(game.state).toMatchObject({ status: 'ACTIVE', revision: 853, health: 100, mind: 98, spirituality: 106, combat: null, ending: null });
    expect(game.state.injuries).toEqual(save.before.injuries); expect(game.state.injuryRisk).toBe(save.before.injuryRisk);
    expect(game.state.pureWhiteAngel.encounter).toMatchObject({ status: 'RESOLVED', enemyHealth: 70,
      enemyStatus: 'SURRENDERED', terminal: { outcome: 'ENEMY_SURRENDERED', round: 1, exitMetres: 4, exitSeconds: 4 },
      scene: { playerLocation: 'OUTSIDE', playerCoordinate: 0, playerTravelMetres: 8, clockSeconds: 68 } });
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), game.state);
    cleanup(); await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), game.state);
    expect(game.state).toEqual(snapshot('combatTerminal')); expect(game.state).toEqual(save.final);
    expect(game.submit).toHaveBeenCalledTimes(1);
  }, 60_000);

  it('returns from the real surrender, commits the captured paid work and reopens the final853-command living save', async () => {
    const save = boundary('actual-paid-work-after-living-exit'), game = savedGame(save.before); await mount(game);
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), game.state);
    await acknowledgeRound();
    expect(await screen.findByRole('heading', { name: '人物卷宗' })).toBeTruthy();
    expect(screen.queryByText('只读封存卷宗')).toBeNull();
    expect(screen.queryByRole('button', { name: '确认姿态，结算完整回合' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^工作，1行动/ }));
    await waitFor(() => expect(game.state).toEqual(save.final)); assertEnvelope(game, save.before, save.intent);
    expect(game.state).toMatchObject({ status: 'ACTIVE', revision: 854, week: 196, health: 100, mind: 98,
      spirituality: 106, cash: 1250, actionsRemaining: 3, injuryRisk: 0, random: { cursor: 385 }, combat: null, ending: null });
    expect(natural('final')).toEqual(save.final);
    expect(readObjectEntry<SliceIntent[]>(`${ROOT}/natural.json`, 'commands')).toHaveLength(853);
    cleanup(); await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), game.state);
    await acknowledgeRound(); await openGrowth(); assertResources(save.final);
    const encounter = screen.getByRole('region', { name: '纯白天使可选真实交战' });
    expect(encounter.textContent).toContain('健康70/100、精神100/100、灵性99/120');
    expect(encounter.textContent).toContain('已投降'); expect(encounter.textContent).toContain('光击储能3/4');
    expect(encounter.textContent).toContain('已落在前庭地面');
    expect(game.state.pureWhiteAngel.encounter).toEqual(save.before.pureWhiteAngel.encounter);
    expect(game.state.lightSeeker.life.site).toEqual(save.before.lightSeeker.life.site);
    expect(game.state.lightSeeker.encounter).toEqual(natural('prefixFinal').lightSeeker.encounter);
    expect(game.state).toEqual(save.final); expect(game.submit).toHaveBeenCalledTimes(1); assertAuthoredCopy(game.state);
  }, 60_000);

  it.each(['本作G候选', '编号推断G'])('preserves custom name %s in a display-only projection without changing the captured identity', name => {
    // This isolated display fixture is not a save, replay, alternate character or campaign outcome.
    const state = snapshot('promoted'), original = structuredClone(state);
    const value = structuredClone(projectSliceState(state).pureWhiteAngel);
    const originalName = value.characterName;
    value.characterName = name; value.appearanceRecord = value.appearanceRecord.split(originalName).join(name);
    const onCommand = vi.fn(), view = render(<PureWhiteAngelPanel value={value} busy={false} onCommand={onCommand} />);
    expect(screen.getByRole('region', { name: '纯白天使当前资源' }).textContent).toContain(name);
    expect(view.container.textContent).toContain(`${name}，原创建年龄26岁`);
    expect(view.container.textContent!.split(name).join('')).not.toMatch(EDITORIAL);
    expect(state).toEqual(original); expect(state.character.name).toBe('塞琳'); expect(onCommand).not.toHaveBeenCalled();
  });
});
