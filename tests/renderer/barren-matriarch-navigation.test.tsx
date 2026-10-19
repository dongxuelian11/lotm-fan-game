/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SliceApp } from '../../src/renderer/SliceApp.js';
import { applySliceIntent, assertValidSliceState, projectSliceState } from '../../src/domain/slice/index.js';
import { migrateSliceState } from '../../src/domain/slice/migration.js';
import { BARREN_MATRIARCH_CASE_IDS, type BarrenMatriarchCaseId } from '../../src/domain/barren-matriarch/life.js';
import { currentBarrenMatriarchCombatSource, replayBarrenMatriarchCombatRound, BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL, BARREN_MATRIARCH_ENEMY_COUNT_WHEEL } from '../../src/domain/barren-matriarch/combat.js';
import { BARREN_MATRIARCH_PREPARATION_IDS, type BarrenMatriarchCommand } from '../../src/domain/barren-matriarch/types.js';
import type { SliceCombatRound, SliceIntent, SliceState, SliceStance } from '../../src/domain/slice/types.js';
import { computeCheckChance } from '../../src/resolution/normal-check.js';
import { DeterministicActionRandomStream } from '../../src/resolution/deterministic-random.js';
import type { SliceBridge } from '../../src/shared/slice-contracts.js';
import { ba, directedInitial3, dose, oldMotherRoots, originalCoffinBearer, prepared, promoted } from '../domain/barren-matriarch-directed-helper.js';

beforeAll(() => { originalCoffinBearer(); }, 60_000);

const PANEL = '荒芜主母成长', ENTRY = '荒芜主母与当前动作', CONFIRMATION = '荒芜主母操作确认';
const view = (s: SliceState) => projectSliceState(s).barrenMatriarch;
/** Every setup starts from the helper's exact 674-command Mother source.
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
function actionButton(state: SliceState, command: BarrenMatriarchCommand): HTMLButtonElement {
  const action = view(state).actions.find(entry => JSON.stringify(entry.command) === JSON.stringify(command));
  if (!action) throw new Error(`Missing public BarrenMatriarch action: ${JSON.stringify(command)}`);
  return screen.getByRole('button', { name: name => name.startsWith(action.label), hidden: true }) as HTMLButtonElement;
}
async function control(state: SliceState, command: BarrenMatriarchCommand) {
  if ('bottleId' in command) {
    const bottle = view(state).bottles.find(entry => entry.id === command.bottleId)!;
    const goal = screen.getByRole('button', { name: `${bottle.title} · ${bottle.status}` }) as HTMLButtonElement;
    if (!goal.disabled) await userEvent.click(goal);
  }
  const button = actionButton(state, command), details = button.closest('details');
  if (details && !details.open) await userEvent.click(details.querySelector('summary')!);
  return button;
}
async function execute(game: SavedGame, command: BarrenMatriarchCommand) {
  const before = structuredClone(game.state), expected = ba(before, command);
  await userEvent.click(await control(before, command));
  const dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
  await userEvent.click(within(dialog).getByRole('button', { name: command.type === 'CONSUME' ? '接受角色变化，确认服用这一药瓶' : '确认执行这一次操作' }));
  await waitFor(() => expect(game.state).toEqual(expected));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: CONFIRMATION })).toBeNull());
  expect(vi.mocked(game.submit).mock.calls.at(-1)![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision,
    payload: { type: 'BARREN_MATRIARCH', command } });
}
function ordinaryCommands(caseId: BarrenMatriarchCaseId): BarrenMatriarchCommand[] {
  const bounded = caseId === 'bounded-dormancy', buffer = caseId === 'finite-root-buffer';
  return [
    { type: 'OBSERVE', caseId }, { type: 'PREPARE', caseId, method: 'ORDINARY' },
    { type: 'WALK', caseId, to: 'A' }, { type: 'CHECK_ORIGINALS', caseId },
    { type: 'CONSENT_OWNER', caseId }, { type: 'TAKE_KIT', caseId },
    ...(bounded ? [{ type: 'WALK', caseId, to: 'B' } as const] : []),
    { type: 'CHECK_SAMPLE', caseId }, { type: 'CONSENT_SAMPLE', caseId }, { type: 'TAKE_SAMPLE', caseId },
    { type: 'WALK', caseId, to: bounded ? 'A' : 'B' },
    ...(caseId === 'withdrawn-transfer' ? [{ type: 'WITHDRAW_PERMISSION', caseId } as const] : []),
    { type: 'VERIFY_TRANSPORT', caseId },
    ...(buffer ? [{ type: 'CONFIRM_LIMITED', caseId } as const, { type: 'ORDINARY_SUPPORT', caseId } as const] : []),
    { type: 'STOP', caseId }, { type: 'WALK', caseId, to: bounded ? 'B' : 'A' }, { type: 'RETURN_SAMPLE', caseId },
    ...(bounded ? [{ type: 'WALK', caseId, to: 'A' } as const] : []),
    { type: 'RETURN_KIT', caseId }, { type: 'WALK', caseId, to: 'START' },
    { type: 'INSPECT', caseId }, { type: 'LEAVE', caseId }, { type: 'REPORT', caseId },
  ];
}
function ordinaryCase(s: SliceState, caseId: BarrenMatriarchCaseId): SliceState {
  for (const command of ordinaryCommands(caseId)) s = ba(s, command);
  return s;
}
let readyCache: SliceState|undefined;
function encounterReady():SliceState{
  if(!readyCache){let s=ba(promoted(),{type:'BUY_ROOT_PAD'});for(const id of BARREN_MATRIARCH_CASE_IDS)s=ordinaryCase(s,id);s=ba(s,{type:'REFLECT'});s=ba(s,{type:'PREPARE_ENCOUNTER'});readyCache=ba(s,{type:'ENCOUNTER_TALK'});assertValidSliceState(readyCache);}
  return structuredClone(readyCache);
}
const fighting=()=>ba(encounterReady(),{type:'ENCOUNTER_FIGHT'});
const selectedCombat = new Map<'BODY' | 'MENTAL' | 'DEAD', SliceState>();
/** Bounded preview chooses only an initial original-seed cursor. The actual
 * tested save is rebuilt BEFORE its first S2 journal, then receives the real
 * potion, all ordinary case commands and combat setup. No saved roll, body,
 * resource, pending effect or result is edited. */
function fightingFor(kind: 'BODY' | 'MENTAL' | 'DEAD'): SliceState {
  if (!selectedCombat.has(kind)) {
    const original = directedInitial3(), baseline = currentBarrenMatriarchCombatSource(fighting())!;
    const chance = computeCheckChance({ baseAbility: original.character.coreStats.will, difficulty: 30, modifiers: [] });
    let selected: number | null = null;
    for (let cursor = baseline.randomCursor; cursor < baseline.randomCursor + 512; cursor++) {
      const potion = new DeterministicActionRandomStream(original.random.seed, cursor - 1).nextInt(1, 100);
      if (potion <= 5 || potion > chance) continue;
      const preview = replayBarrenMatriarchCombatRound({ ...baseline, randomCursor: cursor }, 'CONTROL');
      if (kind === 'DEAD' ? preview.outcome === 'PLAYER_DEAD' : preview.round.consequenceDomain === kind) { selected = cursor - 1; break; }
    }
    if (selected === null) throw new Error(`No same-seed initial UNIT source for ${kind} among 512 candidates.`);
    original.random.cursor = selected;
    let state = ba(original, { type: 'LEARN_GUIDANCE' });
    for (const taskId of BARREN_MATRIARCH_PREPARATION_IDS) state = ba(state, { type: 'PREPARE_TASK', taskId });
    state = ba(state, { type: 'BUY_POTION', bottleId: dose.bottleId });
    state = ba(state, { type: 'PREPARE_PROMOTION' }); state = ba(state, dose);
    state = ba(state, { type: 'BUY_ROOT_PAD' });
    for (const caseId of BARREN_MATRIARCH_CASE_IDS) state = ordinaryCase(state, caseId);
    for (const type of ['REFLECT', 'PREPARE_ENCOUNTER', 'ENCOUNTER_TALK', 'ENCOUNTER_FIGHT'] as const) state = ba(state, { type });
    assertValidSliceState(state); selectedCombat.set(kind, state);
  }
  return structuredClone(selectedCombat.get(kind)!);
}
function assertRound(reveal:HTMLElement,round:SliceCombatRound){
  expect(round.barrenMatriarchOutcome).toBeTruthy();expect(within(reveal).getByRole('heading',{name:`第 ${round.round} 回合完整记录`})).toBeTruthy();
  if(round.consequenceDomain==='BODY'){expect(reveal.textContent).not.toContain('精神后果盘');if(round.consequenceWeights){const w=round.consequenceWeights;expect(reveal.textContent!.replace(/\s+/g,' ')).toContain(`败者后果盘：轻伤 ${w.light}% · 重伤 ${w.heavy}% · 死亡 ${w.death}%`);}}
  if(round.consequenceDomain==='MENTAL'){expect(reveal.textContent).toContain('实际精神压力');expect(reveal.textContent).not.toContain('败者后果盘：轻伤');}
  expect(reveal.textContent).not.toMatch(/S2_RESOURCES_UNAVAILABLE|PENDING_OR_RESOURCES|NO_EXTENDABLE_OWN_EFFECT|INSUFFICIENT_RESOURCES/);
  const o=round.barrenMatriarchOutcome!,actual=within(reveal).getByRole('region',{name:'荒芜主母本回合实际记录'});
  expect(actual.textContent).toContain(`本人健康${o.playerHealthAfter}、精神${o.playerMindAfter}、灵性${o.playerSpiritualityAfter}`);
  expect(actual.textContent).toContain(`对手健康${o.enemyHealth}、精神${o.enemyMind}、灵性${o.enemySpirituality}`);
  expect(actual.textContent).toContain(`原根系垫完整度${o.rootPadAfter.integrity}/65`);
  const actions=[...o.playerActions,...o.enemyActions].sort((a,b)=>a.order-b.order),rows=within(actual).queryAllByRole('listitem');expect(rows).toHaveLength(actions.length);
  actions.forEach((a,i)=>{expect(rows[i]!.textContent).toContain(a.label);expect(rows[i]!.textContent).toContain(`实耗${a.paidCost}灵性、${a.mindCost}精神`);});
}
async function selectRound(game:SavedGame,stance:SliceStance){const battle=projectSliceState(game.state).combat!,stage=screen.getByRole('dialog',{name:battle.title!}),option=battle.stances.find(x=>x.id===stance)!;await userEvent.click(within(stage).getByRole('button',{name:name=>name.startsWith(option.label)}));return stage;}
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

describe('BarrenMatriarch actual SliceApp acquisition and current S2 navigation', () => {
  it('opens the immutable original674 source without inventing maturity, money, healing or a new save', async () => {
    const before = originalCoffinBearer(), game = savedGame(before); expect(before).toMatchObject({ week: 174, revision: 675, cash: 335, health: 50, mind: 100, spirituality: 116, character: { gender: 'FEMALE' } });
    const panel = await openPanel(game); expect(panel.textContent).toContain('继续停留抬棺人'); expect(panel.textContent).toContain('500便士');
    expect(actionButton(before, { type: 'LEARN_GUIDANCE' }).disabled).toBe(true);
    await userEvent.click(within(panel).getByRole('button', { name: '返回普通生活' })); await screen.findByRole('heading', { name: '人物卷宗' });
    expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); expect(oldMotherRoots(game.state)).toEqual(oldMotherRoots(before));
  }, 20_000);

  it('opens the available S1 preparation ahead of the older saved round while preserving all15 current S2 mastery values and untreated injury', async () => {
    const before = promoted(), game = savedGame(before); expect(before.lastCombatRound?.coffinBearerOutcome).toBeTruthy();
    expect(before.injuries).toEqual(originalCoffinBearer().injuries); expect(before.injuries).toHaveLength(4); expect(before.injuries.map(injury => injury.severity)).toEqual(['HEAVY', 'LIGHT', 'HEAVY', 'LIGHT']);
    await mount(game); expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /非凡成长/ })); const panel = await screen.findByRole('region', { name: '自然行者成长' });
    expect(screen.queryByRole('region', { name: '抬棺人', hidden: true })).toBeNull();
    await userEvent.click(within(panel).getByText('能力、消化与继承经历', { selector: 'summary' })); expect(view(before).abilities).toHaveLength(15); expect(projectSliceState(before).natureWalker.abilities).toHaveLength(15);
    for (const ability of view(before).abilities) expect(panel.textContent).toContain(`${ability.label} · 掌握${before.progression.mastery[ability.id]}`);
    expect(within(panel).getByRole('region', { name: '自然行者当前资源' }).textContent).toContain(`健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);
    expect(panel.textContent).not.toMatch(/候选|原创G|本作G|原文未核|编号推断/); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
  }, 20_000);

  it('cancels the selected failing dose and character change, prevents duplicates, and retries the identical accepted envelope once', async () => {
    const before = prepared('FAILURE'), expected = ba(before, dose), game = savedGame(before, { deferFirstSave: true, failFirstSave: true });
    expect(expected.barrenMatriarch.bottles[0]).toMatchObject({ status: 'CONSUMED', outcome: 'FAILURE' }); await openPanel(game);
    await userEvent.click(await control(before, dose)); let dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    expect(dialog.textContent).toContain('成功与失败均实际耗尽这一瓶及本次准备'); expect(dialog.textContent).toContain('男性角色的性别会实际变为女性'); expect(dialog.textContent).toContain('服药失败时，角色性别保持原状');
    await userEvent.click(within(dialog).getByRole('button', { name: '取消，返回查看' })); expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled();
    await userEvent.click(await control(before, dose)); dialog = await screen.findByRole('dialog', { name: CONFIRMATION });
    const confirm = within(dialog).getByRole('button', { name: '接受角色变化，确认服用这一药瓶' }); fireEvent.click(confirm); fireEvent.click(confirm);
    expect(game.submit).toHaveBeenCalledOnce(); expect(game.state).toEqual(before); expect(actionButton(before, dose).disabled).toBe(true);
    await act(async () => { game.releaseFirstSave(); }); await screen.findAllByRole('alert'); expect(game.state).toEqual(before);
    fireEvent.click(actionButton(before, dose)); expect(game.submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '重试这次操作' })); await waitFor(() => expect(game.state).toEqual(expected));
    const calls = vi.mocked(game.submit).mock.calls; expect(calls).toHaveLength(2); expect(calls[1]![0]).toEqual(calls[0]![0]);
    expect(calls[0]![0]).toEqual({ intentId: expect.any(String), runId: before.runId, expectedRevision: before.revision, payload: { type: 'BARREN_MATRIARCH', command: dose } });
    expect(game.state).toMatchObject({ health: before.health - 15, mind: before.mind - 25, character: { gender: before.character.gender }, progression: { sequence: 3 }, barrenMatriarch: { preparedWeek: null } });
    expect(game.state.random.cursor).toBe(before.random.cursor + 1); expect(oldMotherRoots(game.state)).toEqual(oldMotherRoots(before)); expect(game.state.injuries).toEqual(before.injuries);
    cleanup(); await openPanel(game); expect(game.state).toEqual(expected); expect(game.submit).toHaveBeenCalledTimes(2);
  }, 20_000);

  it('saves a real zero-action preparation exit without refunding the paid room or consuming the original bottle', async () => {
    const before = prepared(), game = savedGame(before); await openPanel(game); await execute(game, { type: 'LEAVE_PREPARATION' });
    expect(game.state.barrenMatriarch.preparedWeek).toBeNull(); expect(game.state.barrenMatriarch.bottles).toEqual(before.barrenMatriarch.bottles);
    expect([game.state.cash, game.state.actionsRemaining, game.state.random.cursor]).toEqual([before.cash, before.actionsRemaining, before.random.cursor]);
    expect(game.state.injuries).toEqual(before.injuries); expect(game.submit).toHaveBeenCalledOnce();
  }, 20_000);
});


describe('Barren Matriarch saved character and active nursery reopening', () => {
  it('saves an explicitly accepted male-character success and reopens the same female character without rewriting old history', async () => {
    const before = prepared('SUCCESS', false, 'MALE'), game = savedGame(before);
    const panel = await openPanel(game); expect(panel.textContent).toContain('当前角色性别：男性');
    await execute(game, dose);
    expect(game.state.character.gender).toBe('FEMALE'); expect(game.state.progression.sequence).toBe(2);
    expect(oldMotherRoots(game.state)).toEqual(oldMotherRoots(before)); expect(game.state.injuries).toEqual(before.injuries);
    const after = structuredClone(game.state); cleanup(); const reopened = await openPanel(game);
    expect(reopened.textContent).toContain('当前角色性别：女性'); expect(game.state).toEqual(after); expect(game.submit).toHaveBeenCalledOnce();
  }, 30_000);

  it('reopens the actual active nursery case and saved finite-effect clock ahead of an old S3 battle', async () => {
    const caseId = 'bounded-dormancy' as const;
    let before = ba(promoted(), { type: 'OBSERVE', caseId }); before = ba(before, { type: 'PREPARE', caseId, method: 'ABILITY' });
    before = ba(before, { type: 'WALK', caseId, to: 'A' });
    for (const type of ['CHECK_ORIGINALS', 'CONSENT_OWNER', 'TAKE_KIT'] as const) before = ba(before, { type, caseId });
    before = ba(before, { type: 'WALK', caseId, to: 'B' });
    for (const type of ['CHECK_SAMPLE', 'CONSENT_SAMPLE', 'TAKE_SAMPLE', 'BOUNDED_DORMANCY'] as const) before = ba(before, { type, caseId });
    const game = savedGame(before), actual = view(before);
    for (let n = 0; n < 2; n++) {
      await mount(game); const panel = await screen.findByRole('region', { name: PANEL });
      expect(screen.queryByRole('dialog', { name: '战斗回合结果' })).toBeNull();
      expect(panel.textContent).toContain(`原苗圃时钟${actual.life.clockSeconds}秒`);
      expect(panel.textContent).toContain(`本次有限效果还剩${actual.life.currentAttempt!.effectRemainingSeconds}秒`);
      expect(within(panel).queryByRole('button', { name: '返回普通生活' })).toBeNull();
      expect(game.state).toEqual(before); expect(game.submit).not.toHaveBeenCalled(); cleanup();
    }
  }, 30_000);
});


describe('BarrenMatriarch actual original-body combat and saved latest-round priority',()=>{
 it('opens real enemy resources and wheel ahead of older saved results, with actual adults outside',async()=>{
  const before=fighting(),game=savedGame(before),battle=projectSliceState(before).combat!;expect(before.lastCombatRound?.coffinBearerOutcome).toBeTruthy();expect(battle.enemyAbilityWheel).toEqual(BARREN_MATRIARCH_ENEMY_ABILITY_WHEEL);expect(battle.enemyCountWheel).toEqual(BARREN_MATRIARCH_ENEMY_COUNT_WHEEL);expect(before.coffinBearer.life.owner.location).toBe('OUTSIDE');expect(before.coffinBearer.life.recipient.location).toBe('OUTSIDE');expect(before.barrenMatriarch.encounter.targetId).toBe('BM2-MARTIN');expect(before.coffinBearer.encounter.targetId).toBe('CB3-NOLAN');expect(before.coffinBearer.encounter.enemyStatus).toBe('SURRENDERED');
  await mount(game);expect(screen.queryByRole('dialog',{name:'战斗回合结果'})).toBeNull();const stage=await screen.findByRole('dialog',{name:battle.title!}),resources=within(stage).getByRole('region',{name:'荒芜主母本回合实际资源'});
  expect(resources.textContent).toContain(`本人健康${before.health}/100 · 精神${before.mind}/100 · 灵性${before.spirituality}/120`);expect(resources.textContent).toContain('两位成年协作者已实际离场');
  await userEvent.click(within(stage).getByText('查看公开轮盘与风险',{selector:'summary'}));for(const w of battle.enemyAbilityWheel)expect(stage.textContent).toContain(`${w.label} ${w.weight}%`);
  expect(within(stage).queryByRole('radio',{name:'本回合保留幸运'})).toBeNull();expect(game.state).toEqual(before);expect(game.submit).not.toHaveBeenCalled();
 },20000);
 it('saves the actual selected stance and reopens the same actual round without another draw',async()=>{
  const before=fighting(),game=savedGame(before);await mount(game);const stage=await selectRound(game,'CONTROL');
  const payload:SliceIntent={type:'COMBAT_ROUND',stance:'CONTROL'},expected=applySliceIntent(before,payload);assertValidSliceState(expected);
  await userEvent.click(within(stage).getByRole('button',{name:'确认姿态，结算完整回合'}));await waitFor(()=>expect(game.state).toEqual(expected));expect(game.submit).toHaveBeenCalledExactlyOnceWith({intentId:expect.any(String),runId:before.runId,expectedRevision:before.revision,payload});
  assertRound(await screen.findByRole('dialog',{name:'战斗回合结果'}),expected.lastCombatRound!);cleanup();await mount(game);assertRound(await screen.findByRole('dialog',{name:'战斗回合结果'}),expected.lastCombatRound!);expect(game.state).toEqual(expected);expect(game.submit).toHaveBeenCalledOnce();
 },30000);
 it('uses the real peaceful ordinary four-metre exit and retains surrendered Nolan and the old histories',async()=>{
  const before=encounterReady(),game=savedGame(before);await mount(game);await execute(game,{type:'LEAVE_ENCOUNTER'});expect(game.state.coffinBearer.life.playerLocation).toBe('START');expect(game.state.coffinBearer.life.playerTravelMetres).toBe(before.coffinBearer.life.playerTravelMetres+4);expect(game.state.coffinBearer.life.clockSeconds).toBe(before.coffinBearer.life.clockSeconds+4);expect(game.state.coffinBearer.encounter).toEqual(before.coffinBearer.encounter);expect(game.state.coffinBearer.encounter.enemyStatus).toBe('SURRENDERED');expect(game.state.ancientAlchemist).toEqual(before.ancientAlchemist);expect(game.state.druid).toEqual(before.druid);expect(game.submit).toHaveBeenCalledOnce();
 },30000);
 it('reopens the exact terminal public continuation, never giving a dead body an ordinary exit',async()=>{
  const before=applySliceIntent(fightingFor('DEAD'),{type:'COMBAT_ROUND',stance:'CONTROL'}),game=savedGame(before);expect(before.status).toBe('DEAD');expect(before.barrenMatriarch.encounter.terminal).toBeTruthy();
  for(let n=0;n<2;n++){await mount(game);const reveal=await screen.findByRole('dialog',{name:'战斗回合结果'});assertRound(reveal,before.lastCombatRound!);await acknowledgeRound();
   if(before.status==='DEAD'){expect(before.barrenMatriarch.encounter.terminal!.exitMetres).toBe(0);expect(before.coffinBearer.life.playerLocation).toBe('A');expect(screen.queryByRole('button',{name:ENTRY})).toBeNull();expect(screen.getByText('只读封存卷宗')).toBeTruthy();}
   else{expect(before.barrenMatriarch.encounter.terminal!.exitMetres).toBe(4);expect(before.coffinBearer.life.playerLocation).toBe('START');}
   expect(game.state).toEqual(before);expect(game.submit).not.toHaveBeenCalled();cleanup();}
 },30000);
});


describe('BarrenMatriarch explicit actual consequence domains', () => {
  it.each(['BODY', 'MENTAL'] as const)('shows the real %s round and never substitutes the other consequence display', async domain => {
    const before = fightingFor(domain), game = savedGame(before);
    const payload: SliceIntent = { type: 'COMBAT_ROUND', stance: 'CONTROL' };
    const expected = applySliceIntent(before, payload); assertValidSliceState(expected);
    expect(expected.lastCombatRound!.consequenceDomain).toBe(domain);
    if (domain === 'MENTAL') {
      const outcome = expected.lastCombatRound!.barrenMatriarchOutcome!;
      // Mental consequences do not add body wounds. Independent, paid inherited
      // life-support slots may still restore actual health earlier in the round.
      const recoveryActions = outcome.playerActions.filter(action => action.recoveredHealth > 0);
      expect(expected.health).toBe(before.health + recoveryActions.reduce((total, action) => total + action.recoveredHealth, 0));
      expect(expected.injuries).toEqual(before.injuries); expect(expected.injuryRisk).toBe(before.injuryRisk);
      for (const action of recoveryActions) {
        expect(action.id).toBe('mother.s7.life-support'); expect(action.paidCost).toBe(4);
        expect(action.playerHealthAfter - action.playerHealthBefore).toBe(action.recoveredHealth);
      }
      expect(outcome.enemyActions.some(action => action.attackKind === 'MIND' && action.mentalPressure)).toBe(true);
    }
    await mount(game); const stage = await selectRound(game, 'CONTROL');
    await userEvent.click(within(stage).getByRole('button', { name: '确认姿态，结算完整回合' }));
    await waitFor(() => expect(game.state).toEqual(expected));
    assertRound(await screen.findByRole('dialog', { name: '战斗回合结果' }), expected.lastCombatRound!);
    expect(game.submit).toHaveBeenCalledOnce();
  }, 30_000);
});
