/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { ANCIENT_EVIL_ENEMY_ABILITY_WHEEL, ANCIENT_EVIL_ENEMY_COUNT_WHEEL } from '../../src/domain/ancient-evil/combat.js';
import { ANCIENT_EVIL_CASE_IDS, type AncientEvilCaseId } from '../../src/domain/ancient-evil/life.js';
import { ANCIENT_EVIL_PREPARATION_IDS, type AncientEvilCommand } from '../../src/domain/ancient-evil/types.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import type { SliceCombatRound, SliceIntent, SliceState, SliceStance } from '../../src/domain/slice/types.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { ae, directedInitial3, dose, oldChainedRoots, originalSilentDisciple, prepared, promoted } from '../domain/ancient-evil-directed-helper.js';

const PANEL = '古代邪物成长', ENTRY = '古代邪物与同体变形', CONFIRMATION = '古代邪物操作确认';
const view = (s: SliceState) => projectSliceState(s).ancientEvil;
/** Every setup starts from the helper's exact migrated 507-command living source.
 * Directed budgets/cursors are declared BEFORE the first S2 journal, never edits
 * to a saved roll, body, injury, old history or outcome; these are UNIT branches. */
function savedGame(input: SliceState, options: { deferFirstSave?: boolean; failFirstSave?: boolean } = {}) {
  let state = migrateSliceState(input), attempts = 0, releaseFirstSave = () => {};
  assertValidSliceState(state);
  const firstSave = new Promise<void>(resolve => { releaseFirstSave = resolve; });
  const submit: SliceBridge['submitIntent'] = vi.fn(async envelope => {
    if (envelope.payload.type === 'CREATE') throw new Error('The original campaign already exists.');
    const attempt = attempts++;
    if (attempt === 0 && options.deferFirstSave) await firstSave;
    if (attempt === 0 && options.failFirstSave) return { ok: false as const, error: { code: 'SAVE_FAILED', message: '这次原操作尚未保存', retryable: true } };
    expect(envelope.runId).toBe(state.runId); expect(envelope.expectedRevision).toBe(state.revision);
    state = applySliceIntent(state, envelope.payload); assertValidSliceState(state);
    return { ok: true as const, value: { intentId: envelope.intentId, runId: state.runId, previousRevision: envelope.expectedRevision,
      newRevision: state.revision, committedAt: '2026-10-15T03:00:00Z', replayed: false, state: projectSliceState(state) } };
  });
  return { get state() { return state; }, submit, releaseFirstSave };
}
type SavedGame = ReturnType<typeof savedGame>;
async function mount(game: SavedGame) {
  const state = projectSliceState(game.state);
  window.sliceGame = {
    getBootstrap: vi.fn<SliceBridge['getBootstrap']>(async () => ({ ok: true, value: { mode: 'browser', activeState: state, runs: [{
      runId: state.runId, name: state.character.name, portraitId: state.character.portraitId, week: state.week, date: state.date,
      status: state.status, revision: state.revision, updatedAt: '2026-10-15T02:59:00Z',
    }] } })),
    loadRun: vi.fn<SliceBridge['loadRun']>(async () => ({ ok: true, value: projectSliceState(game.state) })), submitIntent: game.submit,
  };
  render(<SliceApp />);
  await userEvent.click(await screen.findByRole('button', { name: state.status === 'DEAD' ? /查看封存/ : /继续游戏/ }));
  await userEvent.click(screen.getByRole('button', { name: name => name.includes(state.character.name) }));
  await waitFor(() => expect(screen.queryByRole('region', { name: PANEL }) ?? screen.queryByRole('heading', { name: '人物卷宗' })
    ?? screen.queryByRole('dialog', { name: '战斗回合结果' }) ?? (state.combat ? screen.queryByRole('dialog', { name: state.combat.title! }) : null)
    ?? (state.ending ? screen.queryByRole('heading', { name: state.ending.title }) : null)).toBeTruthy());
}
async function acknowledgeRound() {
  const reveal = screen.queryByRole('dialog', { name: '战斗回合结果' });
  if (reveal) await userEvent.click(within(reveal).getByRole('button', { name: /^(返回生活|进入下一回合|查看收尾卷宗)$/ }));
}
async function openPanel(game: SavedGame) {
  await mount(game); await acknowledgeRound();
  if (!screen.queryByRole('region', { name: PANEL })) await userEvent.click(screen.getByRole('button', { name: ENTRY }));
  return screen.findByRole('region', { name: PANEL });
}
function actionButton(state: SliceState, command: AncientEvilCommand): HTMLButtonElement {
  const action = view(state).actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public Ancient Evil action: ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement;
}
async function control(state: SliceState, command: AncientEvilCommand) {
  if ('bottleId' in command) {
    const bottle = view(state).bottles.find(entry => entry.id === command.bottleId)!;
    const goal = screen.getByRole('button', { name: `${bottle.title} · ${bottle.status}` }) as HTMLButtonElement;
    if (!goal.disabled) await userEvent.click(goal);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
async function execute(game: SavedGame, command: AncientEvilCommand) {
  const before = structuredClone(game.state), expected = ae(before, command);
  await userEvent.click(await control(before, command));
  const dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
  await userEvent.click(within(dialog).getByRole('button', { name: command.type === 'CONSUME' ? '确认服用这一药瓶' : '确认执行这一次操作' }));
  await waitFor(() => expect(game.state).toEqual(expected));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRMATION })).toBeNull());
  expect(vi.mocked(game.submit).mock.calls.at(-1)![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision,
    payload: { type: 'ANCIENT_EVIL', command } });
}
function begin(s: SliceState, id: AncientEvilCaseId, method: 'ORDINARY' | 'ABILITY') {
  for (const command of [{ type: 'OBSERVE', caseId: id }, { type: 'PREPARE', caseId: id, method }, { type: 'WALK', caseId: id, to: 'A' },
    { type: 'READ_IDENTITY', caseId: id }] as AncientEvilCommand[]) s = ae(s, command);
  if (method === 'ABILITY') for (const type of ['STORE_ITEMS', 'CONSENT_ELSA'] as const) s = ae(s, { type, caseId: id });
  return s;
}
function ordinaryCase(s: SliceState, caseId: AncientEvilCaseId) {
  s = begin(s, caseId, 'ORDINARY');
  for (const command of [{ type: 'WALK', caseId, to: 'B' }, { type: 'READ_NOTE', caseId }, { type: 'WALK', caseId, to: 'A' },
    { type: 'COMPARE_IDENTITY', caseId }, { type: 'MANUAL_OPERATION', caseId }, { type: 'WALK', caseId, to: 'START' },
    { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId }] as AncientEvilCommand[]) s = ae(s, command);
  return s;
}
let transformedCache: SliceState | undefined, readyCache: SliceState | undefined;
function transformed(): SliceState {
  if (!transformedCache) {
    let s = directedInitial3(); const potionChance = computeCheckChance({ baseAbility: s.character.coreStats.will, difficulty: 30, modifiers: [] });
    const formChance = computeCheckChance({ baseAbility: s.character.coreStats.knowledge + 1, difficulty: 20, modifiers: [] });
    let cursor: number | undefined;
    for (let n = s.random.cursor; n < s.random.cursor + 512; n++) {
      const rng = new DeterministicActionRandomStream(s.random.seed, n), potion = rng.nextInt(1, 100), form = rng.nextInt(1, 100);
      if (potion > 5 && potion <= potionChance && form > 5 && form <= formChance) { cursor = n; break; }
    }
    expect(cursor).toBeDefined(); s.random.cursor = cursor!; assertValidSliceState(s);
    s = ae(s, { type: 'LEARN_GUIDANCE' }); for (const taskId of ANCIENT_EVIL_PREPARATION_IDS) s = ae(s, { type: 'PREPARE_TASK', taskId });
    s = ae(s, { type: 'BUY_POTION', bottleId: dose.bottleId }); s = ae(s, { type: 'PREPARE_PROMOTION' }); s = ae(s, dose);
    transformedCache = ae(begin(s, 'lasting-form', 'ABILITY'), { type: 'ENDURING_TRANSFIGURATION', caseId: 'lasting-form' });
    expect(transformedCache.silentDisciple.life.volunteer.form).toBe('RABBIT'); assertValidSliceState(transformedCache);
  }
  return structuredClone(transformedCache);
}
function encounterReady(): SliceState {
  if (!readyCache) {
    let s = promoted(); for (const id of ANCIENT_EVIL_CASE_IDS) s = ordinaryCase(s, id);
    s = ae(s, { type: 'REFLECT' }); s = ae(s, { type: 'BUY_BLOCKS' }); s = ae(s, { type: 'PREPARE_ENCOUNTER' });
    readyCache = ae(s, { type: 'ENCOUNTER_TALK' }); assertValidSliceState(readyCache);
  }
  return structuredClone(readyCache);
}
const fighting = () => ae(encounterReady(), { type: 'ENCOUNTER_FIGHT' });
/** Unedited public continuation of the declared UNIT source. The guard detects
 * a stuck encounter; it never changes the outcome or turns a living end dead. */
function terminalTrace(stance: SliceStance) {
  let state = fighting(), beforeLast = state;
  const intent: SliceIntent = { type: 'COMBAT_ROUND', stance, puppetCurse: false, madmanPolicy: 'HOLD' };
  for (let n = 0; state.combat && n < 100; n++) { beforeLast = state; state = applySliceIntent(state, intent); assertValidSliceState(state); }
  expect(state.combat).toBeNull(); return { beforeLast, intent, final: state };
}
function assertRound(reveal: HTMLElement, round: SliceCombatRound) {
  expect(round.ancientEvilOutcome).toBeTruthy();
  expect(within(reveal).getByRole('heading', { name: `第 ${round.round} 回合完整记录` })).toBeTruthy();
  if (round.consequenceDomain === 'BODY') {
    expect(reveal.textContent).not.toContain('精神后果盘');
    if (round.consequenceWeights) {
      const w = round.consequenceWeights;
      expect(reveal.textContent!.replace(/\s+/g, ' ')).toContain(`败者后果盘：轻伤 ${w.light}% · 重伤 ${w.heavy}% · 死亡 ${w.death}%`);
    }
  }
  const outcome = round.ancientEvilOutcome!, actual = within(reveal).getByRole('region', { name: '古代邪物本回合实际记录' });
  expect(actual.textContent).toContain(`本人健康${outcome.playerHealthAfter}、精神${outcome.playerMindAfter}、灵性${outcome.playerSpiritualityAfter}`);
  expect(actual.textContent).toContain(`对手健康${outcome.enemyHealth}、精神${outcome.enemyMind}、灵性${outcome.enemySpirituality}`);
  const actions = [...outcome.playerActions, ...outcome.enemyActions].sort((a, b) => a.order - b.order);
  const rows = within(actual).queryAllByRole('listitem'); expect(rows).toHaveLength(actions.length);
  actions.forEach((action, index) => {
    expect(rows[index]!.textContent).toContain(action.label);
    expect(rows[index]!.textContent).toContain(`实耗${action.paidCost}灵性、${action.mindCost}精神`);
  });
}
async function selectRound(game: SavedGame, stance: SliceStance) {
  const battle = projectSliceState(game.state).combat!, stage = screen.getByRole('dialog', { name: battle.title! });
  const option = battle.stances.find(entry => entry.id === stance)!;
  await userEvent.click(within(stage).getByRole('button', { name: name => name.startsWith(option.label) }));
  return stage;
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

describe('Ancient Evil actual SliceApp acquisition and current S2 navigation', () => {
  it('opens the immutable living507 source without inventing maturity, money, healing or a new save', async () => {
    const before = originalSilentDisciple(), game = savedGame(before); expect(before).toMatchObject({ week: 119, revision: 508, cash: 360, health: 100, mind: 99, spirituality: 116 });
    const panel = await openPanel(game); expect(panel.textContent).toContain('继续停留沉默门徒'); expect(panel.textContent).toContain('500便士');
    expect(actionButton(before, { type: 'LEARN_GUIDANCE' }).disabled).toBe(true);
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' })); await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expect(oldChainedRoots(game.state)).toEqual(oldChainedRoots(before));
  }, 20_000);

  it('loads current S2 growth ahead of the stale S3 round and shows all19 actual mastery values and untreated injury', async () => {
    const before = promoted(), game = savedGame(before); expect(before.lastCombatRound?.silentDiscipleOutcome).toBeTruthy();
    expect(before.injuries).toEqual(originalSilentDisciple().injuries); expect(before.injuries[0]).toMatchObject({ severity: 'HEAVY', treatedRevision: null });
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ })); const panel = await screen.findByRole('region', { name: PANEL });
    expect(screen.queryByRole('region', { name: '沉默门徒', hidden: true })).toBeNull();
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' })); expect(view(before).abilities).toHaveLength(19);
    for (const ability of view(before).abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${before.progression.mastery[ability.id]}`);
    expect(within(panel).getByRole('region', { name: '古代邪物当前资源' }).textContent).toContain('健康100/100 · 精神84/100 · 灵性116/120');
    expect(panel.textContent).not.toMatch(/候选|原创G|本作G|原文未核|编号推断/); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('cancels the selected failing dose, prevents duplicates, and retries the identical failed-save envelope once', async () => {
    const before = prepared('FAILURE'), expected = ae(before, dose), game = savedGame(before, { deferFirstSave: true, failFirstSave: true });
    expect(expected.ancientEvil.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE' }); await openPanel(game);
    await userEvent.click(await control(before, dose)); let dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await control(before, dose)); dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    const confirm = within(dialog).getByRole('button', { name: '确认服用这一药瓶' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before); expect(actionButton(before, dose).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert'); expect(game.state).toEqual(before);
    fireEvent.click(actionButton(before, dose)); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await waitFor(() => expect(game.state).toEqual(expected));
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: { type: 'ANCIENT_EVIL', command: dose } });
    expect(game.state).toMatchObject({ health: 85, mind: 74, progression: { sequence: 3 }, ancientEvil: { preparedWeek: null } });
    expect(game.state.random.cursor).toBe(before.random.cursor + 1); expect(oldChainedRoots(game.state)).toEqual(oldChainedRoots(before)); expect(game.state.injuries).toEqual(before.injuries);
    cleanup(); await openPanel(game); expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 20_000);

  it('saves a real zero-action preparation exit without refunding the paid room or consuming the original bottle', async () => {
    const before = prepared(), game = savedGame(before); await openPanel(game); await execute(game, { type: 'LEAVE_PREPARATION' });
    expect(game.state.ancientEvil.preparedWeek).toBeNull(); expect(game.state.ancientEvil.bottles).toEqual(before.ancientEvil.bottles);
    expect([game.state.cash, game.state.actionsRemaining, game.state.random.cursor]).toEqual([before.cash, before.actionsRemaining, before.random.cursor]);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.submit).toHaveBeenCalledOnce();
  }, 20_000);
});

describe('Ancient Evil original body, belongings and ordinary navigation', () => {
  it('reopens the saved rabbit body and stored originals twice without implicit time, healing, permission or movement', async () => {
    const before = transformed(), game = savedGame(before); expect(before.silentDisciple.life).toMatchObject({ playerLocation: 'A', volunteer: { form: 'RABBIT', age: 43 }, clothing: { location: 'TRAY', worn: false }, bag: { location: 'TRAY' } });
    for (let n = 0; n < 2; n++) {
      await mount(game); const panel = await screen.findByRole('region', { name: PANEL }); expect(screen.queryByRole('region', { name: '沉默门徒', hidden: true })).toBeNull();
      expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull(); expect(screen.queryByRole('button', { name: '返回普通生活' })).toBeNull();
      const body = within(panel).getByRole('region', { name: '埃尔莎同一原身体' }); expect(body.textContent).toContain('同一原身体当前为兔形');
      expect(body.textContent).toContain(`累计普通步行${before.silentDisciple.life.playerTravelMetres}米`);
      expect(within(panel).getByRole('region', { name: '古代邪物原衣物与原包' }).textContent).toContain('尚未实际穿回');
      expect(panel.textContent).toContain('本次同一身体的兔形还剩90秒'); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); cleanup();
    }
  }, 20_000);

  it('actually stops, waits the remaining89seconds and separately returns the original clothes and bag through saved commands', async () => {
    const before = transformed(), game = savedGame(before); await mount(game); await execute(game, { type: 'STOP_INPUT', caseId: 'lasting-form' });
    expect(game.state.silentDisciple.life.volunteer.form).toBe('RABBIT'); expect(screen.getByRole('region', { name: PANEL }).textContent).toContain('兔形还剩89秒');
    await execute(game, { type: 'WAIT_FORM', caseId: 'lasting-form' }); expect(game.state.silentDisciple.life.volunteer.form).toBe('HUMAN');
    expect(game.state.silentDisciple.life.clothing).toMatchObject({ location: 'TRAY', worn: false }); expect(game.state.silentDisciple.life.bag.location).toBe('TRAY');
    expect(screen.getByRole('region', { name: '古代邪物原衣物与原包' }).textContent).toContain('尚未实际穿回');
    await execute(game, { type: 'RETURN_ITEMS', caseId: 'lasting-form' }); expect(game.state.silentDisciple.life.clothing).toMatchObject({ location: 'ELSA', worn: true });
    expect(game.state.silentDisciple.life.bag.location).toBe('ELSA'); expect(game.state.silentDisciple.life.playerLocation).toBe('A');
    expect([game.state.health, game.state.mind, game.state.spirituality, game.state.actionsRemaining]).toEqual([before.health, before.mind, before.spirituality, before.actionsRemaining]);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.state.ancientEvil.life.cases['lasting-form'].attempts.at(-1)!.waitedSeconds).toBe(89); expect(game.submit).toHaveBeenCalledTimes(3);
  }, 30_000);

  it('saves the real peaceful four-metre exit after both original adults have physically left, preserving old enemy and blocks', async () => {
    const before = encounterReady(), game = savedGame(before); expect(before.silentDisciple.life).toMatchObject({ playerLocation: 'A', volunteer: { location: 'OUTSIDE', form: 'HUMAN' }, guide: { location: 'OUTSIDE' } });
    await mount(game); const panel = await screen.findByRole('region', { name: PANEL }); expect(within(panel).getByRole('region', { name: '莱娜同一原身体' }).textContent).toContain('莱娜 · 45岁');
    await execute(game, { type: 'LEAVE_ENCOUNTER' }); expect(game.state.ancientEvil.encounter.status).toBe('RESOLVED'); expect(game.state.combat).toBeNull();
    expect(game.state.silentDisciple.life.playerLocation).toBe('START'); expect(game.state.silentDisciple.life.playerTravelMetres).toBe(before.silentDisciple.life.playerTravelMetres + 4);
    expect(game.state.silentDisciple.life.clockSeconds).toBe(before.silentDisciple.life.clockSeconds + 4); expect(game.state.silentDisciple.encounter).toEqual(before.silentDisciple.encounter);
    expect(game.state.ancientEvil.encounter.blocks).toEqual(before.ancientEvil.encounter.blocks); expect(game.state.injuries).toEqual(before.injuries);
    await userEvent.click(screen.getByRole('button', { name: '返回普通生活' })); await screen.findByRole('heading', { name: '人物卷宗' }); expect(game.submit).toHaveBeenCalledOnce();
  }, 30_000);
});

describe('Ancient Evil actual public battle, latest round and archive priority', () => {
  it('prioritizes the new original-body battle over stale SilentDisciple history and shows actual resources and enemy wheels', async () => {
    const before = fighting(), game = savedGame(before), battle = projectSliceState(before).combat!;
    expect(before.lastCombatRound?.silentDiscipleOutcome).toBeTruthy(); expect(battle.enemyAbilityWheel).toEqual(ANCIENT_EVIL_ENEMY_ABILITY_WHEEL); expect(battle.enemyCountWheel).toEqual(ANCIENT_EVIL_ENEMY_COUNT_WHEEL);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull(); const stage = await screen.findByRole('dialog', { name: battle.title! });
    const resources = within(stage).getByRole('region', { name: '古代邪物本回合实际资源' }); expect(resources.textContent).toContain(`本人健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);
    expect(resources.textContent).toContain('本场没有成人同伴参战'); expect(resources.textContent).toContain('普通出口存在，撤退仍可能失败');
    await userEvent.click(within(stage).getByText('查看公开轮盘与风险', { selector: 'summary' }));
    for (const wheel of battle.enemyAbilityWheel) expect(stage.textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    for (const wheel of battle.enemyCountWheel) expect(within(stage).getByText(/^对手次数盘：/).textContent).toContain(`${wheel.label} ${wheel.weight}%`);
    const panel = screen.getByRole('region', { name: PANEL, hidden: true }); for (const button of within(panel).getAllByRole('button', { hidden: true })) expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('region', { name: '沉默门徒', hidden: true })).toBeNull(); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('submits only the explicitly selected inherited strategies in a real full-round envelope and reopens its actual result', async () => {
    const before = fighting(), game = savedGame(before); await mount(game); const stage = await selectRound(game, 'CONTROL');
    const curse = within(stage).getByRole('group', { name: '本回合木偶伤己联系' }), toggle = within(curse).getByRole('checkbox') as HTMLInputElement;
    expect(toggle.checked).toBe(false); expect((within(stage).getByRole('radio', { name: '保持理智' }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(toggle); await userEvent.click(within(stage).getByRole('radio', { name: '首次条件满足时短暂强化' }));
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    const payload: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL', puppetCurse: true, madmanPolicy: 'BURST_FIRST' }, expected = applySliceIntent(before, payload);
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' })); await waitFor(() => expect(game.state).toEqual(expected));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload });
    let reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(reveal, game.state.lastCombatRound!);
    cleanup(); await mount(game); reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(reveal, expected.lastCombatRound!);
    expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledOnce();
  }, 30_000);

  it('reopens the latest living round without applying regeneration again or replacing current body resources with stale S3 results', async () => {
    const before = applySliceIntent(fighting(), { type: 'COMBAT_ROUND', stance: 'CONTROL' }), game = savedGame(before);
    expect(before.status).toBe('ACTIVE'); expect(before.combat?.encounterId).toBe('ANCIENT_EVIL_DISPUTE');
    for (let n = 0; n < 2; n++) {
      await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), before.lastCombatRound!); await acknowledgeRound();
      const stage = await screen.findByRole('dialog', { name: projectSliceState(before).combat!.title! });
      expect(within(stage).getByRole('region', { name: '古代邪物本回合实际资源' }).textContent).toContain(`本人健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);
      expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); cleanup();
    }
  }, 30_000);

  it('executes an ordinary retreat as a public round, saves the actual exit and reopens that exact terminal record', async () => {
    const trace = terminalTrace('RETREAT'), before = trace.beforeLast, game = savedGame(before);
    expect(trace.final.ancientEvil.encounter.terminal).toMatchObject({ outcome: 'RETREATED', exitMetres: 4, exitSeconds: 4 });
    expect(trace.final.status).toBe('ACTIVE'); expect(trace.final.lastCombatRound!.retreat).toBe('SUCCESS');
    await mount(game); await acknowledgeRound(); const stage = await selectRound(game, 'RETREAT');
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(trace.final));
    expect(game.submit).toHaveBeenCalledExactlyOnceWith({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: trace.intent });
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), game.state.lastCombatRound!);
    expect(game.state.silentDisciple.life.playerLocation).toBe('START'); expect(game.state.silentDisciple.encounter).toEqual(before.silentDisciple.encounter);
    expect(game.state.silentDisciple.life.playerTravelMetres).toBe(before.silentDisciple.life.playerTravelMetres + 4);
    expect([game.state.health, game.state.mind, game.state.spirituality]).toEqual([trace.final.lastCombatRound!.ancientEvilOutcome!.playerHealthAfter,
      trace.final.lastCombatRound!.ancientEvilOutcome!.playerMindAfter, trace.final.lastCombatRound!.ancientEvilOutcome!.playerSpiritualityAfter]);
    cleanup(); await mount(game); assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), trace.final.lastCombatRound!);
    await acknowledgeRound(); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull(); expect(game.state).toEqual(trace.final); expect(game.submit).toHaveBeenCalledOnce();
  }, 30_000);

  it('archives the actual ninth-round BODY death and reopens its latest saved record without revival, healing or invented movement', async () => {
    const trace = terminalTrace('CONTROL'), before = trace.final, game = savedGame(before);
    expect(before).toMatchObject({ status: 'DEAD', health: 0, combat: null });
    expect(before.ancientEvil.encounter).toMatchObject({ status: 'LOST', terminal: { outcome: 'PLAYER_DEAD', round: 9, exitMetres: 0, exitSeconds: 0 } });
    expect(before.lastCombatRound).toMatchObject({ round: 9, consequenceDomain: 'BODY', winner: 'ENEMY' });
    expect(before.silentDisciple.life).toMatchObject({ playerLocation: 'A', volunteer: { location: 'OUTSIDE', form: 'HUMAN' }, guide: { location: 'OUTSIDE' } });
    expect(before.silentDisciple.encounter).toEqual(trace.beforeLast.silentDisciple.encounter);
    for (let n = 0; n < 2; n++) {
      await mount(game); const reveal = await screen.findByRole('dialog', { name: '战斗回合结果' }); assertRound(reveal, before.lastCombatRound!);
      await userEvent.click(within(reveal).getByRole('button', { name: '查看收尾卷宗' }));
      const heading = await screen.findByRole('heading', { name: projectSliceState(before).ending!.title });
      expect(screen.getByText('只读封存卷宗')).toBeTruthy(); expect(screen.queryByRole('button', { name: '继续生活' })).toBeNull();
      expect(screen.queryByRole('button', { name: ENTRY })).toBeNull(); expect(screen.queryByRole('region', { name: PANEL })).toBeNull();
      expect(screen.queryByRole('region', { name: '沉默门徒', hidden: true })).toBeNull(); expect(screen.queryByRole('button', { name: /^工作，1行动/ })).toBeNull();
      await userEvent.click(within(heading.parentElement!).getByRole('button', { name: '返回标题' }));
      expect((await screen.findByRole('button', { name: /继续游戏/ }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole('button', { name: /查看封存/ }) as HTMLButtonElement).disabled).toBe(false);
      expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); cleanup();
    }
  }, 30_000);

});
