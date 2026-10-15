/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice';
import { migrateSliceState } from '../../src/domain/slice/migration';
import type { SliceIntent, SliceState } from '../../src/domain/slice/types';
import type { CatastropheCommand } from '../../src/domain/catastrophe/types';
import type { SliceBridge } from '../../src/shared/slice-contracts';
import { CATASTROPHE_ENEMY_ABILITY_WHEEL, CATASTROPHE_ENEMY_COUNT_WHEEL } from '../../src/domain/catastrophe/combat';
import { SEA_KING_ENEMY_ABILITY_WHEEL, SEA_KING_ENEMY_COUNT_WHEEL } from '../../src/domain/sea-king/combat';
import { readObjectEntry } from '../helpers/read-object-entry.js';
import {
  catastropheSnapshot as snapshot, catastropheBoundary as boundary, catastropheBoundaryForIntent as boundaryForIntent,
  catastropheFixturePath, seaKingFixturePath, tyrantLegacyKeys, type CatastropheBoundary,
} from '../domain/catastrophe-helper';

const PANEL = '天灾有限切片', ENTRY = '天灾与原湾风水';
const view = (state: SliceState) => projectSliceState(state).catastrophe;
function commandOf(captured: CatastropheBoundary): CatastropheCommand {
  if (captured.lastIntent.type !== 'CATASTROPHE') throw new Error('Expected a recorded Catastrophe command.');
  return captured.lastIntent.command;
}
function commandBoundary(type: CatastropheCommand['type']) {
  return boundaryForIntent(intent => intent.type === 'CATASTROPHE' && intent.command.type === type);
}
function savedGame(input: unknown, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0;
  assertValidSliceState(state);
  let releaseFirstSave = () => {};
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '本次原操作尚未保存', retryable: true } };
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-14T03:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mountGame(game: SavedGame, openPanel = false) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge["getBootstrap"]>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{ runId: state.runId,
      name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
      status: state.status, revision: state.revision, updatedAt: '2026-10-14T02:59:00Z' }] } })),
    loadRun: vi.fn<SliceBridge["loadRun"]>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp/>);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('heading', { name: '人物卷宗' }) ?? screen.queryByRole('region', { name: PANEL })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title ?? "普通人追击" }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
  if (state.catastrophe.promoted && state.lastCombatRound && !state.lastCombatRound.catastropheOutcome) expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
  const oldReveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (oldReveal) await userEvent.click(within(oldReveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
  if (state.ending) { await screen.findByRole('heading', { name: state.ending.title }); return; }
  if (state.combat) { await screen.findByRole('dialog', { name: state.combat.title ?? "普通人追击" }); return; }
  if (state.catastrophe.insideCase) { await screen.findByRole('region', { name: PANEL }); return; }
  await screen.findByRole('heading', { name: '人物卷宗' });
  if (openPanel) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
}
function actionButton(state: SliceState, command: CatastropheCommand) {
  const action = view(state).actions.find(a => JSON.stringify(a.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing actual public action: ${JSON.stringify(command)}`);
  return screen.getAllByRole('button', { name: name => name.startsWith(action.label), hidden: true }).at(-1)! as HTMLButtonElement;
}
async function control(state: SliceState, command: CatastropheCommand) {
  if ('bottleId' in command) {
    const select = screen.getByRole('combobox', { name: '查看原瓶' }) as HTMLSelectElement;
    if (!select.disabled && select.value !== command.bottleId) await userEvent.selectOptions(select, command.bottleId);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
const confirmName = (command: CatastropheCommand) => command.type === 'CONSUME' ? '独立确认服用这一原瓶' : '确认本次真实消耗与风险';
const confirmLabel = (command: CatastropheCommand) => command.type === 'CONSUME' ? '确认服用这一原瓶' : '确认执行这一次操作';
function assertLegacy(before: SliceState, after: SliceState) {
  expect(after.runId).toBe(before.runId); expect(after.random.seed).toBe(before.random.seed); expect(after.character.gender).toBe(before.character.gender);
  for (const key of tyrantLegacyKeys) expect(after[key]).toEqual(before[key]);
  for (const [id, value] of Object.entries(before.progression.mastery)) if (!id.startsWith('tyrant.s2.')) expect(after.progression.mastery[id]).toBe(value);
}
function assertEnvelope(game: SavedGame, before: SliceState, intent: SliceIntent) {
  expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: intent });
}
function playerCopy(node: HTMLElement) {
  expect(node.textContent).not.toMatch(/未核实候选|候选G|名称编号待核|原文核验|原著|原创G|本作G|(?<![A-Za-z0-9_.-])G(?=\d)|(?<![A-Za-z0-9_.-])G(?![A-Za-z0-9_.-])|\dG(?=[\s，；。、：）)\/×%\u3400-\u9fff])/);
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

describe('Catastrophe navigation preserves the actual injured original campaign', () => {
  it('keeps the same492-command history and puts genuine recovery ahead of promotion or an optional TALK', async () => {
    const commands = readObjectEntry<SliceIntent[]>(catastropheFixturePath, 'commands'), oldCommands = readObjectEntry<SliceIntent[]>(seaKingFixturePath, 'commands');
    expect(oldCommands).toHaveLength(492); expect(readObjectEntry<number>(catastropheFixturePath, 'prefixCount')).toBe(492);
    expect(commands.slice(0, oldCommands.length)).toEqual(oldCommands);
    const departure = snapshot('departureStart'), old = migrateSliceState(readObjectEntry(seaKingFixturePath, 'final'));
    expect(departure).toEqual(old);
    // The real source is H50 with two light wounds and one untreated heavy wound,
    // not an invented H100 fixture and not a new healed body.
    expect(departure).toMatchObject({ health: 50, injuryRisk: 2, random: { seed: 'sailor-natural-v026' }, progression: { pathwayId: 'tyrant', sequence: 3, acting: 100 } });
    expect(departure.injuries.filter(i => i.severity === 'HEAVY' && i.treatedRevision === null)).toHaveLength(1);
    const game = savedGame(departure), before = structuredClone(game.state); await mountGame(game);
    const guide = screen.getByRole('region', { name: '接下来' }), recovery = projectSliceState(before).recovery;
    expect(guide.textContent).toContain('先查看伤势恢复路线'); expect(guide.textContent).toContain(recovery.summary); expect(guide.textContent).toContain(recovery.guidance);
    expect(guide.textContent).toContain('60便士'); expect(guide.textContent).not.toContain('前往原干台交谈'); playerCopy(guide);
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(screen.getByRole('region', { name: '伤势与恢复路线' }).textContent).toContain(recovery.guidance);
    await userEvent.click(screen.getByRole('button', { name: '关闭天灾页面' }));
    expect(screen.getByRole('region', { name: '接下来' }).textContent).toContain(recovery.guidance);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('routes S3 current growth to Sea King and its separate preparation shortcut to Catastrophe', async () => {
    const game = savedGame(commandBoundary('BUY_POTION').beforeLast), before = structuredClone(game.state);
    expect(before.progression.sequence).toBe(3); expect(before.injuries).toEqual([]); expect(before.injuryRisk).toBe(0);
    await mountGame(game); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    expect(screen.getByRole('region', { name: '海王' })).toBeTruthy(); expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '关闭海王页面' }));
    await userEvent.click(screen.getByRole('button', { name: '查看天灾准备' }));
    playerCopy(screen.getByRole('region', { name: PANEL }));
    expect(view(before).formulaKnown).toBe(false); expect(view(before).formula).toEqual([]);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it.each(['promoted', 'practiced'] as const)('opens S2 %s growth with22 unique abilities and read-only seven-stage history', async name => {
    const game = savedGame(snapshot(name)), before = structuredClone(game.state), original = snapshot('departureStart'), publicState = projectSliceState(before);
    expect(before.progression.sequence).toBe(2);
    expect(view(before).abilities).toHaveLength(22); expect(new Set(view(before).abilities.map(a => a.id)).size).toBe(22);
    expect(view(before).abilities.slice(-2).map(a => a.id)).toEqual(['tyrant.s2.storm-field', 'tyrant.s2.water-pressure']);
    expect(before.catastrophe.seaKingActingAtPromotion).toBe(100); assertLegacy(original, before);
    for (const key of tyrantLegacyKeys) expect(publicState[key].actions).toEqual([]);
    await mountGame(game); await userEvent.click(screen.getByRole('button', { name: /非凡成长/ }));
    const panel = screen.getByRole('region', { name: PANEL });
    await userEvent.click(within(panel).getByText('三案历史与新掌握', { selector: 'summary' }));
    for (const ability of view(before).abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${ability.mastery}`);
    await userEvent.click(within(panel).getByText('原身体、七阶继承与来源边界', { selector: 'summary' }));
    for (const label of ['水手', '暴怒之民', '航海家', '风眷者', '海洋歌者', '灾难主祭', '海王']) expect(panel.textContent).toContain(label);
    playerCopy(panel);
    await userEvent.click(screen.getByRole('button', { name: '关闭天灾页面' }));
    await userEvent.click(screen.getByRole('button', { name: '海王与有限海域' }));
    expect(screen.getByRole('region', { name: '海王' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '关闭海王页面' }));
    await userEvent.click(screen.getByRole('button', { name: ENTRY }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('saves the real60p clinic payment while retaining the same treated wounds until later REST', async () => {
    const entry = boundary('clinic-pay60'), game = savedGame(entry.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await userEvent.click(screen.getByRole('button', { name: name => name.startsWith('支付60便士处置') }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    expect(game.state.cash).toBe(before.cash - 60); expect(game.state.injuries.map(i => i.id)).toEqual(before.injuries.map(i => i.id));
    expect(game.state.injuryRisk).toBe(before.injuryRisk);
    expect(projectSliceState(game.state).recovery.treatedHeavyCount).toBeGreaterThan(0);
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
  }, 20_000);

  it('clears the original treated injury only through the recorded later rest, without rewinding RNG', async () => {
    const entry = boundaryForIntent(intent => intent.type === 'ACTION' && intent.action === 'REST', item => item.beforeLast.injuries.length > 0 && item.final.injuries.length === 0);
    const game = savedGame(entry.beforeLast), before = structuredClone(game.state);
    await mountGame(game); await userEvent.click(screen.getByRole('button', { name: /^休养，1行动/ }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    expect(game.state.injuries).toEqual([]); expect(game.state.injuryRisk).toBe(0); expect(game.state.random.seed).toBe(before.random.seed);
    assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
  }, 20_000);
});

describe('Catastrophe persisted intent locks and actual source wheels', () => {
  it.each(['BUY_POTION', 'PREPARE_PROMOTION', 'CONSUME'] as const)('retries failed %s with its exact original envelope and no second cost', async type => {
    const entry = commandBoundary(type), game = savedGame(entry.beforeLast, { deferFirstSave: true, failFirstSave: true }), before = structuredClone(game.state), command = commandOf(entry);
    await mountGame(game, true); await userEvent.click(await control(before, command));
    const name = confirmName(command), confirm = within(screen.getByRole('dialog', { name })).getByRole('button', { name: confirmLabel(command) });
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before);
    expect((screen.getByRole('button', { name: '返回主菜单' }) as HTMLButtonElement).disabled).toBe(true);
    expect(actionButton(before, command).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert');
    expect(game.state).toEqual(before); expect(screen.getByRole('dialog', { name })).toBeTruthy();
    expect((within(screen.getByRole('dialog', { name })).getByRole('button', { name: confirmLabel(command) }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' }));
    await waitFor(() => expect(game.state).toEqual(entry.final));
    const calls = vi.mocked(game.submit).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]); expect(calls[0]![0].payload).toEqual(entry.lastIntent);
    expect(screen.queryByRole('dialog', { name })).toBeNull(); assertLegacy(before, game.state);
    if (type === 'PREPARE_PROMOTION') expect(game.state.cash).toBe(before.cash - 120);
    if (command.type === 'CONSUME') expect(game.state.catastrophe.bottles.find(b => b.id === command.bottleId)?.status).toBe('CONSUMED');
  }, 20_000);

  it('displays the actual original Sea King enemy wheel without substituting a generic wheel or mutating its history', async () => {
    const originalCombat = migrateSliceState(readObjectEntry(seaKingFixturePath, 'combatStart')), game = savedGame(originalCombat), before = structuredClone(game.state);
    const battle = projectSliceState(before).combat!;
    expect(battle.enemyAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual(SEA_KING_ENEMY_ABILITY_WHEEL.map(({ id, weight }) => ({ id, weight })));
    expect(battle.enemyCountWheel).toEqual(SEA_KING_ENEMY_COUNT_WHEEL);
    await mountGame(game); const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    const wheel = within(stage).getByText(/^对手能力盘：/);
    for (const entry of battle.enemyAbilityWheel) expect(wheel.textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const text of ['5S/75', '4S/减45', '4S/抵', '35%', '25%', '20%', '15%', '5%']) expect(wheel.textContent).toContain(text);
    playerCopy(wheel); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('shows current original water, wear, enemyS and the actual five-entry Catastrophe wheel before the real round', async () => {
    const game = savedGame(snapshot('combatStart')), before = structuredClone(game.state), battle = projectSliceState(before).combat!;
    expect(battle.enemyAbilityWheel.map(({ id, weight }) => ({ id, weight }))).toEqual(CATASTROPHE_ENEMY_ABILITY_WHEEL.map(({ id, weight }) => ({ id, weight })));
    expect(battle.enemyCountWheel).toEqual(CATASTROPHE_ENEMY_COUNT_WHEEL);
    await mountGame(game); const stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    const resources = within(stage).getByRole('region', { name: '天灾本回合实际资源' }), site = before.catastrophe.life.site;
    expect(resources.textContent).toContain(`独立灵性 ${before.catastrophe.encounter.enemySpirituality} / 120`);
    for (const text of [`湾内 ${site.water.bayUnits}`, `水渠 ${site.water.channelUnits}`, `耐久 ${site.gate.durability}`, `原系索耐久 ${site.mooring.durability}`, `原回收轮具 ${site.winch.durability}`]) expect(resources.textContent).toContain(text);
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    const wheel = within(stage).getByText(/^对手能力盘：/);
    for (const entry of battle.enemyAbilityWheel) expect(wheel.textContent).toContain(`${entry.label} ${entry.weight}%`);
    for (const text of ['7S/105', '6S/减60', '每轮一次', '耐久−1', '4单位', '35%', '25%', '20%', '15%', '5%']) expect(wheel.textContent).toContain(text);
    expect(stage.textContent).toContain('死亡 5%'); playerCopy(wheel); playerCopy(resources);
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('saves the actual healedH100/risk0 CONTROL first-round death with its physical65/30/5 wheel, roll100 and spent enemyS108', async () => {
    const entry = boundary('combat-first'), game = savedGame(entry.beforeLast), before = structuredClone(game.state);
    expect(entry.lastIntent).toEqual({ type: 'COMBAT_ROUND', stance: 'CONTROL' });
    expect(before).toMatchObject({ health: 100, mind: 100, spirituality: 120, injuries: [], injuryRisk: 0 });
    await mountGame(game); const battle = projectSliceState(before).combat!, stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    const recovery = within(stage).getByRole('region', { name: '伤势与恢复路线' });
    expect(recovery.textContent).toContain('死亡 5%'); expect(recovery.textContent).not.toContain('死亡 35%');
    const stance = battle.stances.find(s => s.id === 'CONTROL')!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    const result = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(game.state).toEqual(entry.final); assertEnvelope(game, before, entry.lastIntent); assertLegacy(before, game.state);
    const round = game.state.lastCombatRound!, outcome = round.catastropheOutcome!, displayed = projectSliceState(game.state).lastCombatRound!;
    expect(round).toMatchObject({ round: 1, stance: 'CONTROL', winner: 'ENEMY', consequenceRoll: 100, consequenceWeights: { light: 65, heavy: 30, death: 5 } });
    expect(outcome.source).toMatchObject({ playerHealth: 100, playerMind: 100, playerSpirituality: 120, playerInjuries: [], playerRisk: 0, enemySpirituality: 120, randomSeed: before.random.seed, randomCursor: before.random.cursor });
    expect(outcome.enemyActions.filter(a => a.threatens).length).toBeGreaterThan(0);
    expect(game.state.catastrophe.encounter.enemySpirituality).toBe(108);
    expect(outcome.enemySpirituality).toBe(120 - outcome.enemyActions.reduce((sum, a) => sum + a.paidCost, 0));
    expect(game.state).toMatchObject({ status: 'DEAD', health: 0, injuryRisk: 0, injuries: [], ending: { kind: 'DEATH' } });
    for (const text of ['轻伤 65%', '重伤 30%', '死亡 5%', '100/100', '维尔S108']) expect(result.textContent).toContain(text);
    expect(result.textContent).toContain(displayed.consequence); expect(result.textContent).not.toContain('精神后果盘');
    expect(result.textContent).not.toContain('损耗40点'); playerCopy(result);
    const saved = structuredClone(game.state);
    await userEvent.click(within(result).getByRole('checkbox', { name: '快速显示本回合结果' }));
    expect(game.state).toEqual(saved); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(within(result).getByRole('button', { name: '查看收尾卷宗' }));
    expect(screen.getByRole('heading', { name: game.state.ending!.title })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull(); expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
    cleanup(); delete window.sliceGame;
    const restored = savedGame(saved); await mountGame(restored);
    expect(restored.state).toEqual(saved); expect(restored.submit).not.toHaveBeenCalled();
    expect(restored.state.catastrophe.encounter.enemySpirituality).toBe(108);
    expect(restored.state.catastrophe.life.site).toEqual(outcome.siteAfter);
    expect(screen.getByRole('heading', { name: saved.ending!.title })).toBeTruthy();
  }, 30_000);
});


describe('Adjacent real S2 physical consequence display', () => {
  it('renders the genuine Wisdom Angel roll65 physical wound as65/30/5, without changing its outcome into mental loss', async () => {
    const file = 'tests/fixtures/wisdom-angel-v01700/combat-first.json';
    const before = migrateSliceState(readObjectEntry(file, 'beforeLast'));
    const expected = migrateSliceState(readObjectEntry(file, 'final'));
    const intent = readObjectEntry<SliceIntent>(file, 'lastIntent');
    if (intent.type !== 'COMBAT_ROUND') throw new Error('Expected the actual neighboring S2 combat command.');
    const game = savedGame(before); await mountGame(game);
    const battle = projectSliceState(before).combat!, stage = screen.getByRole('dialog', { name: battle.title ?? "普通人追击" });
    const stance = battle.stances.find(s => s.id === intent.stance)!;
    await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(stance.label) }));
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    const result = await screen.findByRole('dialog', { name: '战斗回合结果' });
    expect(game.state).toEqual(expected); assertEnvelope(game, before, intent);
    const round = game.state.lastCombatRound!;
    expect(round.wisdomAngelOutcome).toBeTruthy(); expect(round.pendingConsequence).toBeUndefined();
    expect(round).toMatchObject({ consequenceRoll: 65, consequenceWeights: { light: 65, heavy: 30, death: 5 }, winner: 'ENEMY' });
    expect(game.state.health).toBe(before.health - 10); expect(game.state.mind).toBe(before.mind);
    expect(game.state.injuries).toHaveLength(before.injuries.length + 1);
    for (const text of ['败者后果盘', '轻伤 65%', '重伤 30%', '死亡 5%', '65/100']) expect(result.textContent).toContain(text);
    expect(result.textContent).not.toContain('精神后果盘'); expect(result.textContent).not.toContain('损耗40点');
    expect(result.textContent).toContain(projectSliceState(game.state).lastCombatRound!.consequence);
    playerCopy(result);
  }, 30_000);
});
